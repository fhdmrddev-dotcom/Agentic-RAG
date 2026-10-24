"""Phase 279 (SEAM-01 / SEED-328 CR-03(b) + IN-01, D-05 / D-18) — ONE org-equality helper, one call
per door. Wave-0 pins, landed in 279-01 BEFORE the helper exists; 279-02 turns them green.

The contract 279-02's ``_require_thread_org`` must meet:

* **One helper, four doors (D-05).** ``send_message``, ``rename_thread`` (PATCH),
  ``handoff_thread`` and ``get_expert_scope_preview`` each call ``_require_thread_org(`` exactly
  ONCE, and the two inline ``str(<row>.get("org_id") …)`` compares that exist today (PATCH and
  handoff) are REPLACED by it, never kept beside it.
* **Refusal before any write.** On send, an Expert thread whose ``org_id`` differs from the active
  org is refused with 409 BEFORE the workflow preflight, the user-message INSERT, the scoping
  resolve and ``register_run_start`` — so no orphan message is left for a later run to answer
  (D-11).
* **Fail closed with no active org (D-18).** An Expert thread with NO active org is refused the same
  way (today it clears the Expert at send; that is struck through in the 279 record, not silently
  replaced).
* **A plain thread is never refused** (no ``active_expert_id`` → the helper is a no-op). This case is
  plain, not xfail: it holds at base and must keep holding — a strict xfail here would XPASS.

⚠ Roadmap SC#3 / "How we'd know this failed": *CR-03(b) arrives as a second inline org check on the
send path.* ``test_send_message_gains_no_branch_relative_to_the_phase_base`` makes "0 new send-path
branches" mechanical rather than prose: ``send_message``'s ``ast.If`` count at HEAD equals its count at
PHASE_BASE — GREEN now and forever (the helper is a CALL, never an ``if`` in the door).

Every pin that reads post-helper code is ``xfail(strict=True)`` PER TEST / PER PARAM (never module
level), because the backend gate has zero headroom and a plain failing test is never committed.
279-02 removes those markers in the commit that lands the helper.

⚠ 279-02 Commit A: the markers are GONE (every pin is a plain test now), and two cases are added
beside them — the preview door refusing before ``describe_expert_scope``, and a CLEAR on a
cross-org thread proceeding (clearing is never gated).
"""
from __future__ import annotations

import ast
import asyncio
import inspect
import re
import subprocess
from contextlib import ExitStack
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest
from fastapi import HTTPException

import app.api.threads as threads_mod
import app.services.run_producer as rp
from app.models.message import MessageCreate

# Re-based 2026-10-24 by 292.1-03 (D-12 / D-20) from a5a94ba676a63a595f0c2408c7ce17b2ddfe5ada onto
# the 292.1 plan base; see test_send_message_gains_no_branch_relative_to_the_phase_base.
PHASE_BASE = "9d3b77c88b2e2b175c76a069dd2aa4896d73b6b8"

REPO_ROOT = Path(__file__).resolve().parents[3]
THREADS_PATH = REPO_ROOT / "backend" / "app" / "api" / "threads.py"

USER_ID = "11111111-1111-1111-1111-111111111111"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
THREAD_ID = "33333333-3333-3333-3333-333333333333"
EXPERT_ID = "44444444-4444-4444-4444-444444444444"

_DOORS = ("send_message", "rename_thread", "handoff_thread", "get_expert_scope_preview")


def _scoping(bundle: UUID | None) -> rp.ThreadScoping:
    return rp.ThreadScoping(None, None, None, bundle, None)


class _SendHarness:
    """Copied from ``test_268_send_path_stamp._SendHarness``; the thread read can carry ``org_id`` /
    ``active_expert_id`` and the workflow preflight is kept as an attribute so a test can prove it was
    never awaited. The default row is 268's ``{"id", "active_workflow_run_id": None}``."""

    def __init__(self, *, active_org, thread_row=None, kickoff=None, scoping=None, scoping_exc=None):
        self.active_org = active_org
        self.kickoff = kickoff
        self.thread_row = thread_row or {"id": THREAD_ID, "active_workflow_run_id": None}
        self.inserted_rows: list[dict] = []
        self.order: list[str] = []
        self.register = AsyncMock(side_effect=self._register)
        self.producer = AsyncMock(return_value=None)
        self.resolve = AsyncMock(side_effect=self._resolve)
        self.preflight = AsyncMock(return_value=(self.kickoff, str(uuid4()) if self.kickoff else None))
        self._scoping = scoping
        self._scoping_exc = scoping_exc

    async def _register(self, **kwargs):
        self.order.append("register_run_start")

    async def _resolve(self, **kwargs):
        self.order.append("_resolve_thread_scoping")
        if self._scoping_exc is not None:
            raise self._scoping_exc
        return self._scoping

    async def aexec(self, builder):
        # 1st call: the thread ownership read. 2nd: the user-message insert.
        rec = getattr(builder, "_rec", None)
        if rec is not None:
            self.inserted_rows.append(rec)
            return SimpleNamespace(data=[{"id": str(uuid4())}])
        return SimpleNamespace(data=dict(self.thread_row))

    def supabase(self):
        sb = MagicMock()

        def _table(_name):
            t = MagicMock()

            def _insert(row):
                b = MagicMock()
                b._rec = row
                return b

            t.insert.side_effect = _insert
            sel = MagicMock()
            sel._rec = None
            sel.eq.return_value = sel
            sel.single.return_value = sel
            sel.maybe_single.return_value = sel
            t.select.return_value = sel
            return t

        sb.table.side_effect = _table
        return sb

    def patches(self):
        settings = SimpleNamespace(active_provider="openai", llm_model="gpt-4o")
        return [
            patch.object(threads_mod, "resolve_active_org_or_none", AsyncMock(return_value=self.active_org)),
            patch.object(threads_mod, "aexec", self.aexec),
            patch.object(threads_mod, "preflight_workflow_kickoff", self.preflight),
            patch.object(threads_mod, "load_user_settings", MagicMock(return_value=settings)),
            patch.object(threads_mod._run_model_resolution, "apply_user_model_default",
                         AsyncMock(return_value=settings)),
            patch.object(threads_mod, "resolve_run_model",
                         AsyncMock(side_effect=lambda *, body, user_settings:
                                   ("gpt-4o", "openai", None, body, user_settings))),
            patch.object(threads_mod, "register_run_start", self.register),
            patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())),
            patch.object(threads_mod, "create_workflow_run", AsyncMock(return_value=uuid4())),
            patch.object(threads_mod, "maybe_autotitle_thread", AsyncMock(return_value=None)),
            patch.object(rp, "run_producer", self.producer),
            patch.object(rp, "_resolve_thread_scoping", self.resolve),
        ]


async def _send(h: _SendHarness):
    with ExitStack() as stack:
        for p in h.patches():
            stack.enter_context(p)
        resp = await threads_mod.send_message(
            THREAD_ID,
            MessageCreate(content="hello"),
            SimpleNamespace(headers={}, state=SimpleNamespace()),
            current_user={"id": USER_ID, "email": "u@example.com"},
            supabase=h.supabase(),
            service_supabase=MagicMock(name="service_supabase"),
            redis=MagicMock(),
        )
        await asyncio.sleep(0)  # let the spawned producer task run its (mocked) body
    return resp


def _expert_thread(org_id: str | None) -> dict:
    return {
        "id": THREAD_ID,
        "active_workflow_run_id": None,
        "org_id": org_id,
        "active_expert_id": EXPERT_ID,
    }


def _assert_nothing_written(h: _SendHarness) -> None:
    assert h.inserted_rows == [], "a refused send wrote a message row (D-11: refuse BEFORE the INSERT)"
    assert h.register.await_count == 0, "a refused send registered a run row"
    assert h.resolve.await_count == 0, "a refused send resolved scoping"
    assert h.preflight.await_count == 0, "the org refusal must come before the workflow preflight"


# ── 0 new send-path branches (GREEN now and forever) ─────────────────────────────────────────


def _ifs(src: str, fn_name: str) -> int:
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, (ast.AsyncFunctionDef, ast.FunctionDef)) and node.name == fn_name:
            return sum(isinstance(n, ast.If) for n in ast.walk(node))
    raise AssertionError(f"{fn_name} not found")


def test_send_message_gains_no_branch_relative_to_the_phase_base():
    """D-05 (G-5): `threads.py` is FIRING — the send door gets one CALL, zero new `if`s.

    Re-based 2026-10-24 by 292.1-03 (D-12/D-20): the typed-continue gate adds exactly ONE delegating
    `if`; its logic lives in `_typed_continue_or_none`. The fence still forbids any further branch."""
    try:
        base_src = subprocess.run(
            ["git", "show", f"{PHASE_BASE}:backend/app/api/threads.py"],
            cwd=REPO_ROOT, capture_output=True, text=True, encoding="utf-8", check=True,
        ).stdout
    except (subprocess.CalledProcessError, FileNotFoundError):
        pytest.skip("phase base not reachable from this checkout")
    head_src = THREADS_PATH.read_text(encoding="utf-8")
    base_count = _ifs(base_src, "send_message")
    assert base_count > 0  # non-vacuity: the walker found the real function
    assert _ifs(head_src, "send_message") == base_count + 1


# ── the helper and its four call sites (279-02 Commit A removed the strict-xfail markers) ────


def test_the_helper_exists():
    assert callable(getattr(threads_mod, "_require_thread_org", None))


@pytest.mark.parametrize(
    "door",
    [pytest.param(d, id=d) for d in _DOORS],
)
def test_each_door_calls_the_helper_exactly_once(door):
    src = inspect.getsource(getattr(threads_mod, door))
    assert src.count("_require_thread_org(") == 1, f"{door}: one helper call per door (D-05)"


_INLINE_ORG_COMPARE = re.compile(r"""str\(\s*\w+\.get\(\s*["']org_id["']\s*\)""")


def test_no_inline_org_compare_remains_in_any_door():
    """D-05: the two inline checks (PATCH, handoff) are REPLACED by the helper, not kept beside it."""
    assert callable(getattr(threads_mod, "_require_thread_org", None))  # non-vacuity: replaced BY it
    offenders = [d for d in _DOORS if _INLINE_ORG_COMPARE.search(inspect.getsource(getattr(threads_mod, d)))]
    assert offenders == [], f"inline org-equality compare still in: {offenders}"


# ── behaviour on the send door ───────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_an_expert_thread_in_another_org_is_refused_before_any_write():
    """CR-03(b): thread in ORG_A with an Expert, active org ORG_B → 409, nothing written."""
    h = _SendHarness(active_org=ORG_B, thread_row=_expert_thread(ORG_A), scoping=_scoping(uuid4()))
    with pytest.raises(HTTPException) as exc:
        await _send(h)
    assert exc.value.status_code == 409
    _assert_nothing_written(h)


@pytest.mark.asyncio
async def test_an_expert_thread_with_no_active_org_is_refused_before_any_write():
    """D-18: no active org on an Expert thread fails CLOSED (409), never clears the Expert at send."""
    h = _SendHarness(active_org=None, thread_row=_expert_thread(ORG_A), scoping=_scoping(uuid4()))
    with pytest.raises(HTTPException) as exc:
        await _send(h)
    assert exc.value.status_code == 409
    _assert_nothing_written(h)


@pytest.mark.asyncio
async def test_a_plain_thread_in_another_org_is_not_refused():
    """No Expert in play → the helper is a no-op; the send proceeds exactly as 268 drives it."""
    row = {"id": THREAD_ID, "active_workflow_run_id": None, "org_id": ORG_A, "active_expert_id": None}
    h = _SendHarness(active_org=ORG_B, thread_row=row, scoping=_scoping(None))
    await _send(h)
    assert len(h.inserted_rows) == 1, "the user message was written"
    assert h.preflight.await_count == 1
    assert h.register.await_count == 1


# ── the preview door and the clear (279-02 Commit A) ─────────────────────────────────────────


@pytest.mark.asyncio
async def test_the_preview_refuses_an_expert_gated_in_another_org_before_describing():
    """IN-01: the thread is in ORG_A, the gate validated ORG_B → 409 before any statement is built,
    so another org's folders are never described against this thread."""
    gate = AsyncMock(return_value=({"id": EXPERT_ID}, ORG_B))
    desc = AsyncMock(side_effect=AssertionError("describe_expert_scope must not run"))
    row = {"id": THREAD_ID, "folder_id": None, "org_id": ORG_A}
    with patch.object(threads_mod, "assert_expert_bindable", gate), \
         patch.object(threads_mod, "describe_expert_scope", desc), \
         patch.object(threads_mod, "aexec", AsyncMock(return_value=SimpleNamespace(data=row))):
        with pytest.raises(HTTPException) as exc:
            await threads_mod.get_expert_scope_preview(
                request=MagicMock(),
                expert_id=UUID(EXPERT_ID),
                thread_id=UUID(THREAD_ID),
                current_user={"id": USER_ID},
                supabase=MagicMock(),
            )
    assert exc.value.status_code == 409
    assert exc.value.detail == "Switch to this chat's organization to preview an Expert."
    gate.assert_awaited_once()
    desc.assert_not_awaited()


@pytest.mark.asyncio
async def test_clearing_the_expert_on_a_thread_of_another_org_is_never_gated():
    """D-05: the helper is a no-op without an Expert, so a CLEAR on an ORG_A thread while ORG_B is
    active goes through (empty thread → the plain update, no event machinery)."""
    from app.models.thread import ThreadUpdate
    from tests.unit.test_267_expert_changed_event import FakeConn, FakeTxn, ThreadsDb, _patch_thread
    from tests.unit.test_267_scope_preview import FA_ID

    db = ThreadsDb(before_expert=FA_ID, messages=0, after_expert=None)  # thread org = THREAD_ORG
    txn = FakeTxn(FakeConn())
    resp = await _patch_thread(ThreadUpdate(clear_active_expert=True), db, txn, active_org=ORG_B)
    assert txn.entered == 0
    assert len(db.updates()) == 1
    assert resp["active_expert_id"] is None


# ── 279-REVIEW WR-02: the scoping RE-READ fails closed on an org mismatch ────────────────────────
#
# The send door checks the row it read; ``_resolve_thread_scoping`` re-reads the thread after the
# preflight and the user INSERT, and THAT row is the one the run acts on. A bind landing between the
# two reads (two tabs, two X-Org-Id) used to be resolved in the caller's org: cleared (D-18's struck
# clear-at-send) when the Expert is not accessible there, or scoped to the wrong org's folders when it
# is. D-19: the user message already saved stays unanswered in this race — accepted.

_WR02_SENTENCE = "Switch to this chat's organization to keep chatting with its Expert."


async def _scope_reread(thread_row: dict, caller_org: str | None):
    aexec = AsyncMock(return_value=SimpleNamespace(data=dict(thread_row)))
    resolve = AsyncMock(side_effect=AssertionError("resolve_expert_bundle must not run"))
    pool = MagicMock()
    pool.fetchval = AsyncMock(side_effect=AssertionError("the role read must not run"))
    user = {"id": USER_ID, **({"org_id": caller_org} if caller_org else {})}
    with patch("app.utils.db.aexec", aexec), \
         patch("app.services.expert_service.resolve_expert_bundle", resolve):
        try:
            return await rp._resolve_thread_scoping(
                supabase=MagicMock(), thread_id=THREAD_ID, current_user=user, pool=pool,
            ), aexec, resolve
        except Exception as exc:  # noqa: BLE001 — returned for the asserts
            return exc, aexec, resolve


@pytest.mark.asyncio
async def test_WR02_an_expert_bound_in_the_race_window_is_refused_not_resolved_or_cleared():
    row = {"active_expert_id": EXPERT_ID, "folder_id": None, "org_id": ORG_A}
    out, aexec, resolve = await _scope_reread(row, ORG_B)
    assert isinstance(out, rp.ExpertThreadOrgMismatch) and isinstance(out, ValueError)
    assert str(out) == _WR02_SENTENCE  # the send door's own sentence
    assert aexec.await_count == 1, "only the thread re-read ran — no clear UPDATE, no event"
    resolve.assert_not_awaited()


@pytest.mark.asyncio
async def test_WR02_no_caller_org_on_an_expert_thread_fails_closed():
    row = {"active_expert_id": EXPERT_ID, "folder_id": None, "org_id": ORG_A}
    out, aexec, resolve = await _scope_reread(row, None)
    assert isinstance(out, rp.ExpertThreadOrgMismatch)
    assert aexec.await_count == 1
    resolve.assert_not_awaited()


@pytest.mark.asyncio
async def test_WR02_a_plain_thread_in_another_org_is_not_refused_here():
    row = {"active_expert_id": None, "folder_id": None, "org_id": ORG_A}
    out, _aexec, resolve = await _scope_reread(row, ORG_B)
    assert out == rp.ThreadScoping(None, None, None, None, None)
    resolve.assert_not_awaited()


@pytest.mark.asyncio
async def test_WR02_the_send_door_still_refuses_a_null_org_expert_thread():
    """The re-read check compares only when the thread HAS an org (a bind on a null-org thread is a
    409 at the PATCH door, so the race cannot create one); a legacy null-org Expert thread is refused
    by the send door's strict helper, pinned here so the narrowing is never silent."""
    h = _SendHarness(active_org=ORG_B, thread_row=_expert_thread(None), scoping=_scoping(uuid4()))
    with pytest.raises(HTTPException) as exc:
        await _send(h)
    assert exc.value.status_code == 409
    _assert_nothing_written(h)
