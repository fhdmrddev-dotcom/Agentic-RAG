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

PHASE_BASE = "a5a94ba676a63a595f0c2408c7ce17b2ddfe5ada"

REPO_ROOT = Path(__file__).resolve().parents[3]
THREADS_PATH = REPO_ROOT / "backend" / "app" / "api" / "threads.py"

USER_ID = "11111111-1111-1111-1111-111111111111"
ORG_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
THREAD_ID = "33333333-3333-3333-3333-333333333333"
EXPERT_ID = "44444444-4444-4444-4444-444444444444"

_PENDING = "RED until 279-02 lands _require_thread_org"

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
    """D-05 (G-5): `threads.py` is FIRING — the send door gets one CALL, zero new `if`s."""
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
    assert _ifs(head_src, "send_message") == base_count


# ── the helper and its four call sites (strict xfail until 279-02) ───────────────────────────


@pytest.mark.xfail(strict=True, reason=_PENDING)
def test_the_helper_exists():
    assert callable(getattr(threads_mod, "_require_thread_org", None))


@pytest.mark.parametrize(
    "door",
    [pytest.param(d, id=d, marks=pytest.mark.xfail(strict=True, reason=_PENDING)) for d in _DOORS],
)
def test_each_door_calls_the_helper_exactly_once(door):
    src = inspect.getsource(getattr(threads_mod, door))
    assert src.count("_require_thread_org(") == 1, f"{door}: one helper call per door (D-05)"


_INLINE_ORG_COMPARE = re.compile(r"""str\(\s*\w+\.get\(\s*["']org_id["']\s*\)""")


@pytest.mark.xfail(strict=True, reason=_PENDING)
def test_no_inline_org_compare_remains_in_any_door():
    """D-05: the two inline checks (PATCH, handoff) are REPLACED by the helper, not kept beside it."""
    assert callable(getattr(threads_mod, "_require_thread_org", None))  # non-vacuity: replaced BY it
    offenders = [d for d in _DOORS if _INLINE_ORG_COMPARE.search(inspect.getsource(getattr(threads_mod, d)))]
    assert offenders == [], f"inline org-equality compare still in: {offenders}"


# ── behaviour on the send door ───────────────────────────────────────────────────────────────


@pytest.mark.xfail(strict=True, reason=_PENDING)
@pytest.mark.asyncio
async def test_an_expert_thread_in_another_org_is_refused_before_any_write():
    """CR-03(b): thread in ORG_A with an Expert, active org ORG_B → 409, nothing written."""
    h = _SendHarness(active_org=ORG_B, thread_row=_expert_thread(ORG_A), scoping=_scoping(uuid4()))
    with pytest.raises(HTTPException) as exc:
        await _send(h)
    assert exc.value.status_code == 409
    _assert_nothing_written(h)


@pytest.mark.xfail(strict=True, reason=_PENDING)
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
