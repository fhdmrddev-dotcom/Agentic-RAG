"""Phase 295 plan 05 (RUN-01 read half / RUN-04 / D-04, D-22, D-37, D-40).

Two facts ride every run read after this plan, off ONE helper module each read imports:

  * ``unsourced`` — the mark 295-03 writes on a step kept without sources. Stored as
    ``{"continued_by": <answering user uuid>, "at": <ISO>}``; on the wire it is
    ``{"continued_by": <viewer-aware words>, "at": <ISO>}``. The uuid never reaches a client.
  * ``end_reason`` — why a failed or cancelled run stopped, read only from what was RECORDED
    (the failed step's ``_failure_reason``, else the run's ``run_failed`` audit reason, else a
    cancelled run's ``policy_applied`` / ``run_cancelled`` audit reason). Never fabricated.

The three reads are driven through their REAL serializers (the 214 rule: declared AND populated):
``GET /workflow-runs/{id}`` (owner read), ``read_run_evidence`` (owner or org colleague) and
``GET /threads/{id}/workflow`` (the chat panel). No case touches a database.
"""
from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import pytest

from tests.test_188_workflow_run_read import _FakeSupabase, _flipped_on, _is_op_false

OWNER = "00000000-0000-0000-0000-0000000295a1"
COLLEAGUE = "00000000-0000-0000-0000-0000000295a2"
ORG = "00000000-0000-0000-0000-0000000295b1"
RUN = "29505000-0000-4000-8000-000000000001"
THREAD = "29505000-0000-4000-8000-000000000002"
DEF_ID = "29505000-0000-4000-8000-000000000003"
AT = "2026-10-20T12:30:00+00:00"
OWNER_NAME = "Fahad Murad"
SECRET = "SECRET-PRODUCED-SENTENCE"

DEFINITION = {
    "slug": "vendor-review",
    "version": 1,
    "name": "Vendor review",
    "phases": [
        {"slug": "research", "phase_index": 0, "name": "Find the evidence",
         "config": {"phase_type": "llm_agent"}},
        {"slug": "write", "phase_index": 1, "name": "Write the memo",
         "config": {"phase_type": "llm_single"}},
    ],
}

STORED_UNSOURCED = {"continued_by": OWNER, "at": AT}
AWAITING = {
    "_awaiting_answer": {
        "tool_call_id": "t1",
        "produced_output": {"text": SECRET, "citations": []},
    }
}


# ══ 1) the pure leaf ═══════════════════════════════════════════════════════════════════════


def test_the_leaf_imports_nothing_from_the_app():
    from pathlib import Path

    src = (Path(__file__).resolve().parents[2] / "app/services/harness/run_read_wire.py").read_text(
        encoding="utf-8"
    )
    for line in src.splitlines():
        assert not line.startswith(("from app", "import app")), line


@pytest.mark.parametrize(
    "raw",
    [None, "not a dict", 7, [], {}, {"continued_by": OWNER}, {"continued_by": OWNER, "at": "  "},
     {"continued_by": OWNER, "at": 5}],
)
def test_unsourced_for_wire_absent_or_malformed_is_none(raw):
    from app.services.harness.run_read_wire import unsourced_for_wire

    assert unsourced_for_wire(raw, who="Fahad Murad (you)") is None


def test_unsourced_for_wire_replaces_the_uuid_with_the_words():
    from app.services.harness.run_read_wire import unsourced_for_wire

    out = unsourced_for_wire(STORED_UNSOURCED, who="Fahad Murad (you)")
    assert out == {"continued_by": "Fahad Murad (you)", "at": AT}
    assert OWNER not in json.dumps(out)


@pytest.mark.parametrize(
    ("raw", "expected"),
    [(None, None), (5, None), ("", None), ("   \n", None), ("  It stopped.  ", "It stopped.")],
)
def test_end_reason_for_wire_normalises_blank_to_none(raw, expected):
    from app.services.harness.run_read_wire import end_reason_for_wire

    assert end_reason_for_wire(raw) == expected


def _audit(kind, meta, at="2026-10-20T12:00:00+00:00", *, encode=True):
    return {"event_type": kind, "metadata": json.dumps(meta) if encode else meta,
            "created_at": at}


@pytest.mark.parametrize(
    ("status", "phase_reasons", "audit", "expected"),
    [
        ("failed", ["The search found nothing."], [_audit("run_failed", {"reason": "other"})],
         "The search found nothing."),
        ("failed", [None, "  "], [_audit("run_failed", {"reason": "Run failed: timeout."})],
         "Run failed: timeout."),
        ("failed", [], [_audit("run_failed", {"reason": "old"}, "2026-10-20T11:00:00+00:00"),
                        _audit("run_failed", {"reason": "newest"}, "2026-10-20T12:00:00+00:00")],
         "newest"),
        ("failed", [], [], None),
        ("failed", [], [_audit("policy_applied",
                               {"policy": "run_cancelled", "reason": "Stopped by Fahad Murad."})],
         None),
        ("cancelled", [], [_audit("policy_applied",
                                  {"policy": "run_cancelled", "reason": "Stopped by Fahad Murad."})],
         "Stopped by Fahad Murad."),
        ("cancelled", [], [_audit("policy_applied",
                                  {"policy": "engine_ask_pause", "reason": "Paused."})],
         None),
        ("cancelled", [], [_audit("run_failed", {"reason": "Finalised by the reconciler."})],
         "Finalised by the reconciler."),
        ("cancelled", [], [], None),
        ("completed", ["leftover"], [_audit("run_failed", {"reason": "x"})], None),
        ("active", [], [_audit("run_failed", {"reason": "x"})], None),
        # a double-encoded and a plain dict metadata read the same
        ("failed", [], [_audit("run_failed", {"reason": "plain"}, encode=False)], "plain"),
    ],
)
def test_resolve_end_reason(status, phase_reasons, audit, expected):
    from app.services.harness.run_read_wire import resolve_end_reason

    assert resolve_end_reason(status, phase_reasons, audit) == expected


def test_deadline_passed_is_a_fact_about_time_not_status():
    from app.services.harness.run_read_wire import deadline_passed

    now = datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc)
    long_ago = (now - timedelta(minutes=10)).isoformat()
    just_now = (now - timedelta(seconds=30)).isoformat()
    assert deadline_passed(None, long_ago, now) is False  # an engine pause has no deadline
    assert deadline_passed(300, long_ago, now) is True
    assert deadline_passed(300, just_now, now) is False
    assert deadline_passed(300, now - timedelta(minutes=10), now) is True  # datetime form
    assert deadline_passed(300, None, now) is False  # an unmeasurable deadline never "passed"
    assert deadline_passed("300", long_ago, now) is False  # never coerced


# ══ 2) GET /workflow-runs/{id} — the owner read ════════════════════════════════════════════


def _run_store(phase_rows, *, status="completed", audit=None, display_name=OWNER_NAME):
    return _FakeSupabase(
        {
            "workflow_runs": [
                {"id": RUN, "thread_id": THREAD, "definition_id": DEF_ID, "status": status,
                 "created_at": "2026-10-20T12:00:00+00:00",
                 "updated_at": "2026-10-20T12:40:00+00:00", "claimed_at": None,
                 "user_id": OWNER, "definition_snapshot": DEFINITION}
            ],
            "workflow_definitions": [
                {"id": DEF_ID, "slug": "vendor-review", "version": 1, "name": "Vendor review",
                 "definition": DEFINITION}
            ],
            "workflow_phases": [dict(r, workflow_run_id=RUN) for r in phase_rows],
            "profiles": [{"id": OWNER, "display_name": display_name}],
            "harness_audit": [dict(a, run_id=RUN) for a in (audit or [])],
        }
    )


def _row(slug, index, output, *, status="completed"):
    return {"slug": slug, "phase_index": index, "status": status,
            "started_at": "2026-10-20T12:01:00+00:00",
            "completed_at": "2026-10-20T12:02:00+00:00", "output": output}


def _read_run(client, monkeypatch, store, *, email="owner@x.co"):
    import app.dependencies as deps
    from app.dependencies import get_user_supabase_client
    from app.main import app

    _flipped_on(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": OWNER, "email": email}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)
    app.dependency_overrides[get_user_supabase_client] = lambda: store
    resp = client.get(f"/workflow-runs/{RUN}")
    assert resp.status_code == 200, resp.text
    return resp


def test_run_read_carries_the_owners_words_and_never_the_uuid(client, monkeypatch):
    output = json.dumps({"text": "Kept as produced.", "unsourced": STORED_UNSOURCED})
    resp = _read_run(client, monkeypatch, _run_store(
        [_row("research", 0, output), _row("write", 1, {"text": "memo"})]
    ))
    phases = resp.json()["phases"]
    assert phases[0]["unsourced"] == {"continued_by": f"{OWNER_NAME} (you)", "at": AT}
    assert phases[1]["unsourced"] is None
    assert OWNER not in resp.text


def test_run_read_blank_display_name_falls_back_to_the_owners_email(client, monkeypatch):
    output = {"text": "x", "unsourced": STORED_UNSOURCED}
    resp = _read_run(client, monkeypatch, _run_store([_row("research", 0, output)],
                                                      display_name="   "))
    assert resp.json()["phases"][0]["unsourced"]["continued_by"] == "owner@x.co (you)"


def test_run_read_looks_up_no_name_when_no_step_is_unsourced(client, monkeypatch):
    store = _run_store([_row("research", 0, {"text": "x"})])
    _read_run(client, monkeypatch, store)
    assert not any(c[1] == "profiles" for c in store.calls if c[0] == "select")


@pytest.mark.parametrize(
    ("status", "phase_output", "phase_status", "audit", "expected"),
    [
        ("failed", {"_failure_reason": "The search found nothing."}, "failed",
         [_audit("run_failed", {"reason": "the audit's words"})], "The search found nothing."),
        ("failed", json.dumps({"_failure_reason": "   "}), "failed",
         [_audit("run_failed", {"reason": "Run failed: the provider timed out."})],
         "Run failed: the provider timed out."),
        ("failed", {}, "failed", [], None),
        ("cancelled", {}, "cancelled",
         [_audit("policy_applied", {"policy": "run_cancelled", "reason": "Stopped by Fahad Murad."})],
         "Stopped by Fahad Murad."),
        ("cancelled", {}, "cancelled",
         [_audit("policy_applied", {"policy": "something_else", "reason": "no"})], None),
        ("completed", {"text": "done"}, "completed",
         [_audit("run_failed", {"reason": "stale"})], None),
    ],
)
def test_run_read_end_reason(client, monkeypatch, status, phase_output, phase_status, audit,
                             expected):
    resp = _read_run(client, monkeypatch, _run_store(
        [_row("research", 0, phase_output, status=phase_status)], status=status, audit=audit
    ))
    assert resp.json()["end_reason"] == expected


def test_run_read_completed_run_reads_no_audit(client, monkeypatch):
    store = _run_store([_row("research", 0, {"text": "done"})])
    _read_run(client, monkeypatch, store)
    assert not any(c[1] == "harness_audit" for c in store.calls if c[0] == "select")


def test_D40_run_read_leaks_no_stashed_produced_output(client, monkeypatch):
    resp = _read_run(client, monkeypatch, _run_store(
        [_row("research", 0, json.dumps(AWAITING), status="active")], status="paused"
    ))
    assert SECRET not in resp.text
    assert "_awaiting_answer" not in resp.text
    assert resp.json()["phases"][0]["deliverable_text"] is None


# ══ 3) the evidence read (owner and a same-org colleague) ═════════════════════════════════


class _EvidencePool:
    def __init__(self, *, status, phase_rows, end_audit):
        self.status = status
        self.phase_rows = phase_rows
        self.end_audit = end_audit
        self.calls: list[tuple[str, tuple]] = []

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_runs wr" in sql:
            return {"id": uuid.UUID(RUN), "thread_id": uuid.UUID(THREAD),
                    "definition_id": uuid.UUID(DEF_ID), "status": self.status,
                    "org_id": uuid.UUID(ORG), "user_id": uuid.UUID(OWNER),
                    "created_at": datetime(2026, 10, 20, 12, 0, tzinfo=timezone.utc),
                    "updated_at": datetime(2026, 10, 20, 12, 40, tzinfo=timezone.utc),
                    "definition_snapshot": json.dumps(DEFINITION), "model": "gpt-5"}
        if "FROM workflow_definitions WHERE id" in sql:
            return {"slug": "vendor-review", "version": 1, "name": "Vendor review",
                    "status": "published", "definition": json.dumps(DEFINITION)}
        raise AssertionError(f"unexpected fetchrow: {sql}")

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_phases" in sql:
            return self.phase_rows
        if "FROM harness_audit" in sql:
            kinds = set(args[1]) if len(args) > 1 else set()
            if "run_failed" in kinds:
                return self.end_audit
            return []
        if "SELECT version FROM workflow_definitions" in sql:
            return [{"version": 1}]
        raise AssertionError(f"unexpected fetch: {sql}")

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM profiles" in sql:
            return OWNER_NAME
        if "FROM organizations" in sql:
            return "Acme"
        return None


class _Conn:
    async def fetch(self, sql, *args):
        return [{"id": i} for i in args[0]]

    async def fetchval(self, sql, *args):
        return None


def _evidence_wire(monkeypatch, pool):
    import app.dependencies as deps

    async def _get_pool():
        return pool

    @asynccontextmanager
    async def _rls(request, current_user):
        yield _Conn()

    monkeypatch.setattr(deps, "get_pg_pool", _get_pool)
    monkeypatch.setattr(deps, "get_user_pg_connection", _rls)


async def _evidence(viewer, email="viewer@x.co"):
    from app.api.workflow_run_evidence import read_run_evidence

    out = await read_run_evidence(workflow_run_id=uuid.UUID(RUN),
                                  current_user={"id": viewer, "email": email})
    return out.model_dump_json()


def _ev_rows():
    return [
        {"slug": "research", "phase_index": 0, "status": "completed",
         "started_at": "2026-10-20T12:01:00+00:00", "completed_at": "2026-10-20T12:02:00+00:00",
         "output": json.dumps({"text": "Kept.", "unsourced": STORED_UNSOURCED})},
        {"slug": "write", "phase_index": 1, "status": "completed",
         "started_at": "2026-10-20T12:02:00+00:00", "completed_at": "2026-10-20T12:03:00+00:00",
         "output": {"text": "memo"}},
    ]


@pytest.mark.asyncio
async def test_evidence_owner_reads_the_mark_with_their_words(monkeypatch):
    _evidence_wire(monkeypatch, _EvidencePool(status="completed", phase_rows=_ev_rows(),
                                              end_audit=[]))
    raw = await _evidence(OWNER, "owner@x.co")
    body = json.loads(raw)
    assert body["phase_log"][0]["unsourced"] == {"continued_by": f"{OWNER_NAME} (you)", "at": AT}
    assert body["phase_log"][1]["unsourced"] is None
    assert body["run"]["end_reason"] is None
    assert OWNER not in raw


@pytest.mark.asyncio
async def test_evidence_colleague_reads_the_person_who_started_this_run(monkeypatch):
    _evidence_wire(monkeypatch, _EvidencePool(status="completed", phase_rows=_ev_rows(),
                                              end_audit=[]))
    raw = await _evidence(COLLEAGUE)
    body = json.loads(raw)
    assert body["phase_log"][0]["unsourced"] == {
        "continued_by": "the person who started this run", "at": AT,
    }
    assert "(you)" not in body["phase_log"][0]["unsourced"]["continued_by"]
    assert OWNER not in raw


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "audit", "expected"),
    [
        ("failed", [_audit("run_failed", {"reason": "Run failed: the provider timed out."})],
         "Run failed: the provider timed out."),
        ("failed", [], None),
        ("cancelled",
         [_audit("policy_applied", {"policy": "run_cancelled", "reason": "Stopped by Fahad Murad."})],
         "Stopped by Fahad Murad."),
        ("cancelled", [_audit("policy_applied", {"policy": "other", "reason": "no"})], None),
    ],
)
async def test_evidence_end_reason(monkeypatch, status, audit, expected):
    rows = [{"slug": "research", "phase_index": 0, "status": "cancelled", "started_at": None,
             "completed_at": None, "output": {}}]
    _evidence_wire(monkeypatch, _EvidencePool(status=status, phase_rows=rows, end_audit=audit))
    body = json.loads(await _evidence(OWNER, "owner@x.co"))
    assert body["run"]["end_reason"] == expected


@pytest.mark.asyncio
async def test_evidence_failed_step_reason_wins(monkeypatch):
    rows = [{"slug": "research", "phase_index": 0, "status": "failed", "started_at": None,
             "completed_at": None, "output": json.dumps({"_failure_reason": "Step said why."})}]
    _evidence_wire(monkeypatch, _EvidencePool(
        status="failed", phase_rows=rows,
        end_audit=[_audit("run_failed", {"reason": "the audit's words"})],
    ))
    body = json.loads(await _evidence(OWNER, "owner@x.co"))
    assert body["run"]["end_reason"] == "Step said why."


@pytest.mark.asyncio
async def test_D40_evidence_leaks_no_stashed_produced_output(monkeypatch):
    rows = [{"slug": "research", "phase_index": 0, "status": "active", "started_at": None,
             "completed_at": None, "output": json.dumps(AWAITING)}]
    _evidence_wire(monkeypatch, _EvidencePool(status="cancelled", phase_rows=rows, end_audit=[]))
    for viewer in (OWNER, COLLEAGUE):
        raw = await _evidence(viewer)
        assert SECRET not in raw
        assert "_awaiting_answer" not in raw


# ══ 4) the chat panel — GET /threads/{id}/workflow ════════════════════════════════════════


def _thread_frame(client, mock_asyncpg_pool, mock_execute_result, phase_rows, *,
                  display_row=None):
    from unittest.mock import AsyncMock, patch

    thread_id = uuid.uuid4()
    run_id = uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": None}
    mock_asyncpg_pool.set_fetchrow_results(
        [
            None,  # the deep cap_paused probe
            {"id": run_id, "status": "completed", "created_at": None, "updated_at": None},
            {"definition": DEFINITION},  # the definition join
            display_row,  # the owner's display name (only read when a row is unsourced)
        ]
    )
    mock_asyncpg_pool.set_fetch_results([list(phase_rows), []])
    with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), patch(
        "app.dependencies.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)
    ):
        resp = client.get(f"/threads/{thread_id}/workflow")
    assert resp.status_code == 200, resp.text
    return resp, resp.json()["phases"]


def _panel_row(slug, index, output, *, status="completed"):
    return {"slug": slug, "phase_index": index, "status": status, "started_at": None,
            "completed_at": None, "output": output}


def test_panel_carries_the_mark_with_the_owners_words(client, mock_asyncpg_pool,
                                                      mock_execute_result):
    from tests.conftest import mock_user_data

    stored = {"continued_by": mock_user_data["id"], "at": AT}
    resp, phases = _thread_frame(
        client, mock_asyncpg_pool, mock_execute_result,
        [_panel_row("research", 0, json.dumps({"text": "Kept.", "unsourced": stored})),
         _panel_row("write", 1, {"text": "memo"})],
        display_row={"display_name": OWNER_NAME},
    )
    assert phases[0]["unsourced"] == {"continued_by": f"{OWNER_NAME} (you)", "at": AT}
    assert phases[1]["unsourced"] is None
    assert mock_user_data["id"] not in json.dumps(phases)


def test_D40_panel_leaks_no_stashed_produced_output(client, mock_asyncpg_pool,
                                                     mock_execute_result):
    resp, phases = _thread_frame(
        client, mock_asyncpg_pool, mock_execute_result,
        [_panel_row("research", 0, json.dumps(AWAITING), status="active")],
    )
    assert SECRET not in resp.text
    assert "_awaiting_answer" not in resp.text
    assert phases[0]["unsourced"] is None
