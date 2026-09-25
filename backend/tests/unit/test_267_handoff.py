"""Phase 267 (D-267-14 / D-267-15 / D-267-16 / D-267-33 / D-267-34 / PACK-24) — "Ask a second Expert"
is ONE request that either creates a context-carrying, correctly-owned thread and leaves a pointer in
the original, or creates NOTHING and says why.

* The summary is a SERVICE (``app.services.thread_handoff``), not a tool: ``emit_handoff_summary`` is a
  name passed to ``forced_emit`` only — EMITTER_REGISTRY stays 1, _TOOL_REGISTRY stays 29.
* Summarise FIRST, outside any transaction. A summary failure answers 502 and
  ``get_user_pg_connection`` is never entered — zero writes (D-267-16).
* Then ONE user-JWT transaction: the new thread (Expert set, source folder inherited, org from the
  SOURCE thread), its first message (a ``role='user'`` row carrying the ``handoff`` marker), and the
  source thread's ``expert_handoff`` event. The source keeps its Expert.
"""
from __future__ import annotations

import ast
import json
import pathlib
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

from app.models.thread import ThreadHandoffRequest
from tests.unit.test_267_scope_preview import ACME_FOLDER, CR_ID, FA_ID, FIXTURES, ORG_ID, USER_ID, FakeSupabase

APP_DIR = pathlib.Path(__file__).resolve().parents[2] / "app"

SOURCE_ID = "50000000-0000-4000-8000-00000000000a"
NEW_ID = "60000000-0000-4000-8000-00000000000b"
SOURCE_ORG = "5a0c1d2e-0000-4000-8000-0000000000bb"  # the source thread's org; the gate fixture returns it (WR-03)
AT = datetime(2026, 9, 25, 14, 45, tzinfo=timezone.utc)
ITEMS = [
    "ACME Q3 invoices: $412K (+9% on Q2)",
    "Two invoices overdue > 30 days",
    "Open: does the MSA late-payment clause apply?",
]


def _emit_ok(items=ITEMS):
    from app.services.thread_handoff import HandoffSummary

    return {"emitted": HandoffSummary(items=list(items)), "failure": None, "tier": "force", "emit_rung": "x"}


def _rows():
    return [
        {"role": "user", "content": "What did ACME invoice in Q3?", "reasoning_content": None},
        {"role": "assistant", "content": "$412K, up 9% on Q2.", "reasoning_content": "SECRET-REASONING"},
        {"role": "system", "content": "Financial Analyzer joined.", "tool_calls": [{"kind": "expert_changed"}]},
        {"role": "user", "content": "Any overdue?", "reasoning_content": None},
    ]


# ── the service ────────────────────────────────────────────────────────────────────────────────


async def _summarise(rows, emit):
    from app.services.thread_handoff import summarise_thread_for_handoff

    with patch("app.services.thread_handoff.forced_emit", emit):
        return await summarise_thread_for_handoff(
            rows=rows,
            source_title="Q3 board prep",
            expert_name="Contract Reviewer",
            model="claude-x",
            provider="anthropic",
            user_settings=SimpleNamespace(),
        )


@pytest.mark.asyncio
async def test_the_summary_reads_only_user_and_assistant_text_through_forced_emit():
    from app.services.thread_handoff import HandoffSummary

    emit = AsyncMock(return_value=_emit_ok())
    items = await _summarise(_rows(), emit)
    assert items == ITEMS

    kw = emit.await_args.kwargs
    assert kw["emitter"] == "emit_handoff_summary"
    assert kw["schema_model"] is HandoffSummary
    assert kw["strict"] is False
    assert (kw["model"], kw["provider"]) == ("claude-x", "anthropic")
    assert kw["tools"][0]["function"]["name"] == "emit_handoff_summary"
    prompt = kw["messages"][0]["content"]
    assert kw["messages"][0]["role"] == "user"
    assert "What did ACME invoice in Q3?" in prompt and "Any overdue?" in prompt
    assert "SECRET-REASONING" not in prompt
    assert "Financial Analyzer joined." not in prompt
    # oldest first
    assert prompt.index("What did ACME invoice in Q3?") < prompt.index("Any overdue?")


@pytest.mark.asyncio
async def test_a_long_history_is_capped_from_the_end():
    from app.services.thread_handoff import HANDOFF_INPUT_CHAR_CAP

    assert HANDOFF_INPUT_CHAR_CAP == 20000
    rows = [{"role": "user" if i % 2 == 0 else "assistant", "content": f"M{i:03d}-" + "x" * 995} for i in range(30)]
    emit = AsyncMock(return_value=_emit_ok())
    await _summarise(rows, emit)
    prompt = emit.await_args.kwargs["messages"][0]["content"]
    assert "M029-" in prompt          # the newest survives
    assert "M000-" not in prompt      # the oldest is cut
    assert len(prompt) <= HANDOFF_INPUT_CHAR_CAP + 1000


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "result",
    [
        {"emitted": None, "failure": "model_failed_to_emit"},
        {"emitted": None, "failure": None},
        {"emitted": {"items": ["only one", "two"]}, "failure": None},          # < 3 items
        {"emitted": {"items": ["a", "b", "x" * 161]}, "failure": None},        # > 160 chars
        {"emitted": {"items": ["a", "b", "c", "d", "e", "f", "g"]}, "failure": None},  # > 6 items
    ],
    ids=["failure", "no-emission", "too-few", "too-long", "too-many"],
)
async def test_every_failed_summary_is_a_refusal(result):
    from app.services.thread_handoff import HandoffSummaryFailed

    with pytest.raises(HandoffSummaryFailed):
        await _summarise(_rows(), AsyncMock(return_value=result))


@pytest.mark.asyncio
async def test_a_provider_exception_is_a_refusal_too():
    from app.services.thread_handoff import HandoffSummaryFailed

    with pytest.raises(HandoffSummaryFailed):
        await _summarise(_rows(), AsyncMock(side_effect=RuntimeError("provider 500")))


def test_the_title_is_expert_dot_source_capped_at_60():
    from app.services.thread_handoff import handoff_title

    assert handoff_title("Contract Reviewer", "Q3 board prep") == "Contract Reviewer · Q3 board prep"
    long = handoff_title("Contract Reviewer", "A very long source thread title that keeps on going and going")
    assert len(long) <= 60 and long.endswith("…")


# ── the route ──────────────────────────────────────────────────────────────────────────────────


class HConn:
    def __init__(self, fail_at: int | None = None):
        self.fail_at = fail_at
        self.calls: list[tuple[str, tuple]] = []

    async def fetchrow(self, sql, *args):
        return self._run(sql, args)

    async def execute(self, sql, *args):
        self._run(sql, args)
        return "OK"

    def _run(self, sql, args):
        self.calls.append((sql, args))
        if self.fail_at == len(self.calls):
            raise RuntimeError("simulated write failure")
        if "INSERT INTO public.threads" in sql:
            return {
                "id": UUID(NEW_ID), "user_id": args[0], "title": args[2], "active_expert_id": args[3],
                "folder_id": args[4], "created_at": AT, "updated_at": AT,
            }
        return {"id": uuid4()}


class Txn:
    def __init__(self, conn):
        self.conn = conn
        self.entered = 0
        self.committed = None

    def __call__(self, request, current_user):
        return self

    async def __aenter__(self):
        self.entered += 1
        return self.conn

    async def __aexit__(self, et, e, tb):
        self.committed = et is None
        return False


SOURCE = {
    "id": SOURCE_ID, "title": "Q3 board prep", "folder_id": ACME_FOLDER,
    "org_id": SOURCE_ORG, "active_expert_id": FA_ID,
}
SETTINGS = SimpleNamespace(active_provider="openai", llm_model="gpt-default")


def _sb(source=SOURCE, rows=None, folder_name="Client ACME"):
    return FakeSupabase(answers={
        "threads": SimpleNamespace(data=dict(source) if source else None),
        "messages": SimpleNamespace(data=[r for r in (_rows() if rows is None else rows) if r["role"] != "system"]),
        "folders": SimpleNamespace(data={"name": folder_name} if folder_name else None),
    })


async def _handoff(sb, *, emit=None, txn=None, gate=None, body=None, overrides=None):
    from contextlib import ExitStack

    from app.api import threads as threads_mod

    emit = emit or AsyncMock(return_value=_emit_ok())
    txn = txn or Txn(HConn())
    # 267-REVIEW WR-03: the gate's validated org must BE the source thread's org, or the route
    # refuses (409). The fixture used to hand back ORG_ID (≠ SOURCE_ORG) and every success case
    # passed through the tier-bypass it pinned; the refusal has its own case below.
    gate = gate or AsyncMock(return_value=({"id": CR_ID, "name": "Contract Reviewer"}, SOURCE_ORG))
    body = body or ThreadHandoffRequest(expert_id=UUID(CR_ID))
    o = {
        "load_user_settings": MagicMock(return_value=SETTINGS),
        "apply": AsyncMock(side_effect=lambda request, current_user, s: s),
        "override_provider": MagicMock(side_effect=lambda s, p: SimpleNamespace(active_provider=p, llm_model=s.llm_model)),
        "resolve_run_model": AsyncMock(side_effect=lambda *, body, user_settings: ("claude-x", "anthropic", None, body, user_settings)),
    }
    o.update(overrides or {})
    with ExitStack() as st:
        st.enter_context(patch.object(threads_mod, "assert_expert_bindable", gate))
        st.enter_context(patch.object(threads_mod, "get_user_pg_connection", txn))
        st.enter_context(patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())))
        st.enter_context(patch.object(threads_mod, "load_user_settings", o["load_user_settings"]))
        st.enter_context(patch.object(threads_mod._run_model_resolution, "apply_user_model_default", o["apply"]))
        st.enter_context(patch.object(threads_mod, "override_provider", o["override_provider"]))
        st.enter_context(patch.object(threads_mod, "resolve_run_model", o["resolve_run_model"]))
        st.enter_context(patch("app.services.thread_handoff.forced_emit", emit))
        st.enter_context(patch(
            "app.services.expert_service.get_expert_service",
            AsyncMock(return_value={"id": FA_ID, "name": "Financial Analyzer"}),
        ))
        resp = await threads_mod.handoff_thread(
            thread_id=SOURCE_ID, body=body, request=MagicMock(),
            current_user={"id": USER_ID}, supabase=sb,
        )
    return resp, emit, txn, gate, o


@pytest.mark.asyncio
async def test_a_thread_the_caller_does_not_own_is_404_before_anything_else():
    emit = AsyncMock()
    gate = AsyncMock()
    txn = Txn(HConn())
    with pytest.raises(HTTPException) as exc:
        await _handoff(_sb(source=None), emit=emit, gate=gate, txn=txn)
    assert exc.value.status_code == 404 and exc.value.detail == "Thread not found"
    gate.assert_not_awaited()
    emit.assert_not_awaited()
    assert txn.entered == 0


@pytest.mark.asyncio
async def test_a_gate_refusal_answers_its_own_status_and_calls_no_model():
    emit = AsyncMock()
    gate = AsyncMock(side_effect=HTTPException(status_code=403, detail="Choose an organization before inviting an Expert."))
    txn = Txn(HConn())
    with pytest.raises(HTTPException) as exc:
        await _handoff(_sb(), emit=emit, gate=gate, txn=txn)
    assert exc.value.status_code == 403
    emit.assert_not_awaited()
    assert txn.entered == 0


@pytest.mark.asyncio
async def test_a_chat_with_no_messages_is_refused_before_any_llm_call():
    emit = AsyncMock()
    txn = Txn(HConn())
    with pytest.raises(HTTPException) as exc:
        await _handoff(_sb(rows=[]), emit=emit, txn=txn)
    assert exc.value.status_code == 409
    assert exc.value.detail == "This chat has no messages to hand off."
    emit.assert_not_awaited()
    assert txn.entered == 0


@pytest.mark.asyncio
async def test_a_failed_summary_writes_nothing_at_all():
    """D-267-16: the transaction is never opened."""
    txn = Txn(HConn())
    with pytest.raises(HTTPException) as exc:
        await _handoff(_sb(), emit=AsyncMock(return_value={"emitted": None, "failure": "provider_error"}), txn=txn)
    assert exc.value.status_code == 502
    assert exc.value.detail == "This chat could not be summarised."
    assert txn.entered == 0
    assert txn.conn.calls == []


@pytest.mark.asyncio
async def test_success_writes_thread_marker_and_source_event_in_one_txn():
    sb = _sb()
    resp, _emit, txn, _gate, _o = await _handoff(sb)

    assert txn.entered == 1 and txn.committed is True
    calls = txn.conn.calls
    assert len(calls) == 3
    assert all("UPDATE" not in sql for sql, _ in calls)  # the source keeps its Expert

    # 1. the new thread — org from the SOURCE thread, folder inherited (D-267-33), Expert set.
    sql, args = calls[0]
    assert "INSERT INTO public.threads" in sql
    user_id, org_id, title, expert_id, folder_id = args
    assert str(user_id) == USER_ID
    assert str(org_id) == SOURCE_ORG
    assert title == "Contract Reviewer · Q3 board prep"
    assert str(expert_id) == CR_ID
    assert str(folder_id) == ACME_FOLDER

    # 2. its first message: a USER row with the handoff marker.
    sql, args = calls[1]
    assert "INSERT INTO public.messages" in sql and "'user'" in sql and "org_id" in sql
    thread_id, user_id, org_id, content, tool_calls = args
    assert str(thread_id) == NEW_ID and str(org_id) == SOURCE_ORG
    assert content == "Handed off from “Q3 board prep”\n- " + "\n- ".join(ITEMS)
    marker = tool_calls[0]
    assert marker["kind"] == "handoff"
    assert marker["source_thread_id"] == SOURCE_ID
    assert marker["source_title"] == "Q3 board prep"
    assert marker["summary"] == ITEMS
    assert marker["folder_name"] == "Client ACME"

    # 3. the source thread's pointer event.
    sql, args = calls[2]
    assert "INSERT INTO public.messages" in sql and "'system'" in sql and "org_id" in sql
    thread_id, user_id, org_id, content, tool_calls = args
    assert str(thread_id) == SOURCE_ID and str(org_id) == SOURCE_ORG
    ev = tool_calls[0]
    assert ev["kind"] == "expert_handoff"
    assert ev["target_thread_id"] == NEW_ID
    assert ev["target_title"] == "Contract Reviewer · Q3 board prep"
    assert ev["expert_name"] == "Contract Reviewer"
    assert ev["stays_expert_name"] == "Financial Analyzer"
    assert ev["folder_name"] == "Client ACME"
    assert content

    assert str(resp["id"]) == NEW_ID
    assert str(resp["active_expert_id"]) == CR_ID


@pytest.mark.asyncio
async def test_a_source_with_no_expert_and_no_folder_names_neither():
    source = dict(SOURCE, folder_id=None, active_expert_id=None)
    _resp, _e, txn, _g, _o = await _handoff(_sb(source=source, folder_name=None))
    ev = txn.conn.calls[2][1][4][0]
    assert ev["stays_expert_name"] is None
    assert ev["folder_name"] is None
    assert txn.conn.calls[0][1][4] is None


@pytest.mark.asyncio
async def test_a_failure_on_the_third_insert_rolls_everything_back():
    txn = Txn(HConn(fail_at=3))
    with pytest.raises(HTTPException) as exc:
        await _handoff(_sb(), txn=txn)
    assert exc.value.status_code == 500
    assert exc.value.detail == "The new chat could not be created."
    assert txn.entered == 1
    assert txn.committed is False


@pytest.mark.asyncio
async def test_the_model_is_resolved_through_the_send_paths_own_chain():
    body = ThreadHandoffRequest(expert_id=UUID(CR_ID), model="claude-x", provider="anthropic")
    _resp, emit, _txn, _gate, o = await _handoff(_sb(), body=body)
    o["load_user_settings"].assert_called_once_with(USER_ID)
    o["apply"].assert_awaited_once()
    o["override_provider"].assert_called_once()
    assert o["override_provider"].call_args.args[1] == "anthropic"
    rkw = o["resolve_run_model"].await_args.kwargs
    assert rkw["body"].model == "claude-x"
    assert rkw["user_settings"].active_provider == "anthropic"
    ekw = emit.await_args.kwargs
    assert (ekw["model"], ekw["provider"]) == ("claude-x", "anthropic")


@pytest.mark.asyncio
async def test_the_same_provider_is_not_overridden():
    body = ThreadHandoffRequest(expert_id=UUID(CR_ID), provider="openai")
    _resp, _emit, _txn, _gate, o = await _handoff(_sb(), body=body)
    o["override_provider"].assert_not_called()


# ── what the model sees, and the closed core ──────────────────────────────────────────────────


def test_the_marker_row_reaches_every_provider_as_plain_user_content():
    from app.models.message import HandoffMarker
    from app.services.agent_loop import _reconstruct_history

    content = "Handed off from “Q3 board prep”\n- " + "\n- ".join(ITEMS)
    marker = HandoffMarker(
        source_thread_id=UUID(SOURCE_ID), source_title="Q3 board prep", expert_name="Contract Reviewer",
        summary=ITEMS, folder_name="Client ACME",
    )
    row = {"role": "user", "content": content, "tool_calls": [marker.model_dump(mode="json")]}
    assert _reconstruct_history([row]) == [{"role": "user", "content": content}]


def test_the_summary_emitter_is_a_name_not_a_registered_emitter_or_tool():
    from app.services.harness.emitters import EMITTER_REGISTRY
    from app.services.tool_dispatcher import _TOOL_REGISTRY

    assert "emit_handoff_summary" not in EMITTER_REGISTRY
    assert "emit_handoff_summary" not in _TOOL_REGISTRY
    assert len(EMITTER_REGISTRY) == 1
    assert len(_TOOL_REGISTRY) == 29


def test_the_service_filename_is_not_a_forbidden_expert_runtime_pattern():
    services = APP_DIR / "services"
    assert (services / "thread_handoff.py").exists()
    for pattern in ("*expert*agent*", "*expert*loop*", "*expert*runtime*", "*expert*executor*"):
        assert "thread_handoff.py" not in [p.name for p in services.glob(pattern)]


def test_expert_service_stays_a_pure_data_manifest():
    src = (APP_DIR / "services" / "expert_service.py").read_text(encoding="utf-8")
    assert "forced_emit" not in src and "thread_handoff" not in src
    tree = ast.parse(src)
    assert not [n for n in ast.walk(tree) if isinstance(n, ast.While)]


# ── the wire fixtures 267-04 renders ───────────────────────────────────────────────────────────


def _fixture_models():
    from app.models.message import ExpertHandoffEvent, HandoffMarker

    event = ExpertHandoffEvent(
        at=AT, target_thread_id=UUID(NEW_ID), target_title="Contract Reviewer · Q3 board prep",
        expert_name="Contract Reviewer", stays_expert_name="Financial Analyzer", folder_name="Client ACME",
    )
    marker = HandoffMarker(
        source_thread_id=UUID(SOURCE_ID), source_title="Q3 board prep", expert_name="Contract Reviewer",
        summary=ITEMS, folder_name="Client ACME",
    )
    return event, marker


def test_the_handoff_fixtures_are_the_models_output():
    event, marker = _fixture_models()
    assert json.loads((FIXTURES / "expert_handoff.json").read_text(encoding="utf-8")) == event.model_dump(mode="json")
    assert json.loads((FIXTURES / "handoff_marker.json").read_text(encoding="utf-8")) == marker.model_dump(mode="json")
    assert '"kind": "handoff"' in (FIXTURES / "handoff_marker.json").read_text(encoding="utf-8")


@pytest.mark.asyncio
async def test_the_route_writes_exactly_the_fixture_shapes():
    """The rows the route writes carry the same keys the fixtures pin (no drift between them)."""
    _resp, _e, txn, _g, _o = await _handoff(_sb())
    event, marker = _fixture_models()
    assert set(txn.conn.calls[1][1][4][0]) == set(marker.model_dump(mode="json"))
    assert set(txn.conn.calls[2][1][4][0]) == set(event.model_dump(mode="json"))


# ── 267-REVIEW WR-03: the gate's org and the org the new thread is written into must be ONE org ──
#
# ``list_threads`` returns a two-org user's threads from every org, so the source thread can live in
# org A while the active org (X-Org-Id, which the gate checks entitlement and access in) is B. The
# writer stamps the SOURCE org (D-267-34), so without this refusal an Expert gated in B was bound
# inside an A thread — including when A does not hold the ``experts`` entitlement at all.


@pytest.mark.asyncio
async def test_WR03_a_source_thread_in_another_org_is_refused_before_any_model_call_or_write():
    emit = AsyncMock()
    txn = Txn(HConn())
    gate = AsyncMock(return_value=({"id": CR_ID, "name": "Contract Reviewer"}, ORG_ID))
    assert ORG_ID != SOURCE_ORG
    with pytest.raises(HTTPException) as exc:
        await _handoff(_sb(), emit=emit, txn=txn, gate=gate)
    assert exc.value.status_code == 409
    assert exc.value.detail == "Switch to this chat's organization to hand it off."
    emit.assert_not_awaited()
    assert txn.entered == 0
