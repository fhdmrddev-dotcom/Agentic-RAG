"""Phase 268 (METER-08 / D-268-19 / D-268-07 / D-268-22 / T-268-05) — resolve ONCE, stamp at the insert.

The Expert that scopes a Deep turn and the Expert written on that turn's ``runs`` row must be
the SAME object. Before 268 the row was inserted in ``send_message`` and the Expert was resolved
later, inside the detached producer — so a row could only be stamped by a SECOND read, and a
PATCH between the two reads would stamp one Expert and scope another (Option C, rejected).

Option A, driven here:

* ``send_message`` calls ``_resolve_thread_scoping`` exactly ONCE, before ``register_run_start``,
  only on a Deep turn (``_kickoff_definition is None``), and stamps
  ``expert_id = ThreadScoping.born_for_bundle_id`` + ``org_id = <validated active org>``.
* The SAME ``ThreadScoping`` object reaches ``run_producer(scoping=...)``; the producer does not
  resolve again when handed one, and still does when it is not (every older call shape).
* A resolution ERROR is carried (``scoping_error=``) and re-raised INSIDE the producer's existing
  ``try`` — so ``runs.error`` reads exactly what it read at base.
* The user-message row carries the active org when there is one, and is byte-identical when
  there is not; ``create_thread`` stamps the validated org too.

⛔ What this does NOT prove: which org Postgres actually stores. The trigger is the other writer
of ``org_id``; ``tests/integration/test_268_two_org_rows.py`` reads rows back from the real DB.
"""
from __future__ import annotations

import asyncio
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import UUID, uuid4

import pytest

import app.api.threads as threads_mod
import app.services.run_producer as rp
from app.models.message import MessageCreate

USER_ID = "11111111-1111-1111-1111-111111111111"
ORG_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb"
THREAD_ID = "33333333-3333-3333-3333-333333333333"


def _scoping(bundle: UUID | None) -> rp.ThreadScoping:
    return rp.ThreadScoping(None, None, None, bundle, None)


class _SendHarness:
    """Patches everything ``send_message`` touches, recording the calls this phase cares about."""

    def __init__(self, *, active_org, kickoff=None, scoping=None, scoping_exc=None):
        self.active_org = active_org
        self.kickoff = kickoff
        self.inserted_rows: list[dict] = []
        self.order: list[str] = []
        self.register = AsyncMock(side_effect=self._register)
        self.producer = AsyncMock(return_value=None)
        self.resolve = AsyncMock(side_effect=self._resolve)
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
        return SimpleNamespace(data={"id": THREAD_ID, "active_workflow_run_id": None})

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
            t.select.return_value = sel
            return t

        sb.table.side_effect = _table
        return sb

    def patches(self):
        settings = SimpleNamespace(active_provider="openai", llm_model="gpt-4o")
        return [
            patch.object(threads_mod, "resolve_active_org_or_none", AsyncMock(return_value=self.active_org)),
            patch.object(threads_mod, "aexec", self.aexec),
            patch.object(threads_mod, "preflight_workflow_kickoff",
                         AsyncMock(return_value=(self.kickoff, str(uuid4()) if self.kickoff else None))),
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
    from contextlib import ExitStack

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


@pytest.mark.asyncio
async def test_deep_turn_resolves_once_before_the_insert_and_stamps_that_expert_and_org():
    bundle = uuid4()
    h = _SendHarness(active_org=ORG_B, scoping=_scoping(bundle))
    await _send(h)

    assert h.resolve.await_count == 1, "resolve ONCE — a second read is the mis-stamp window"
    assert h.order == ["_resolve_thread_scoping", "register_run_start"]
    kw = h.register.await_args.kwargs
    assert kw["expert_id"] == bundle
    assert kw["org_id"] == ORG_B


@pytest.mark.asyncio
async def test_the_same_scoping_object_reaches_the_producer():
    s = _scoping(uuid4())
    h = _SendHarness(active_org=ORG_B, scoping=s)
    await _send(h)
    pkw = h.producer.call_args.kwargs
    assert pkw["scoping"] is s, "the row's Expert and the run's scope must come from ONE object"
    assert pkw["scoping_error"] is None


@pytest.mark.asyncio
async def test_a_resolution_error_is_carried_and_the_row_is_unstamped():
    exc = rp.ExpertScopeUnavailable("HR Advisor has no knowledge folders this organization can read.")
    h = _SendHarness(active_org=ORG_B, scoping_exc=exc)
    await _send(h)
    assert h.register.await_args.kwargs["expert_id"] is None
    pkw = h.producer.call_args.kwargs
    assert pkw["scoping"] is None
    assert pkw["scoping_error"] is exc


@pytest.mark.asyncio
async def test_a_harness_kickoff_does_not_resolve_and_stamps_no_expert():
    h = _SendHarness(active_org=ORG_B, kickoff={"phases": []}, scoping=_scoping(uuid4()))
    await _send(h)
    assert h.resolve.await_count == 0
    assert h.register.await_args.kwargs["expert_id"] is None
    assert h.register.await_args.kwargs["org_id"] == ORG_B


@pytest.mark.asyncio
async def test_no_header_means_no_org_on_the_run_and_no_org_key_on_the_user_message():
    h = _SendHarness(active_org=None, scoping=_scoping(None))
    await _send(h)
    assert h.register.await_args.kwargs["org_id"] is None
    (user_row,) = h.inserted_rows
    assert "org_id" not in user_row, "no-header callers must write a byte-identical dict"
    assert set(user_row) == {"thread_id", "user_id", "role", "content"}


@pytest.mark.asyncio
async def test_the_user_message_carries_the_active_org():
    h = _SendHarness(active_org=ORG_B, scoping=_scoping(None))
    await _send(h)
    (user_row,) = h.inserted_rows
    assert user_row["org_id"] == ORG_B


# ── the producer half ────────────────────────────────────────────────────────


async def _drive_producer(**extra):
    captured: dict = {}

    async def _loop(ctx, **_kw):
        captured["ctx"] = ctx

    async def _fin(**kw):
        captured["finalize"] = kw

    resolve = AsyncMock(side_effect=extra.pop("resolve_side_effect", None),
                        return_value=extra.pop("resolve_return", _scoping(None)))
    with patch.object(threads_mod, "run_agent_loop", _loop), \
            patch.object(threads_mod, "get_pg_pool", AsyncMock(return_value=MagicMock())), \
            patch.object(rp, "_resolve_thread_scoping", resolve), \
            patch.object(rp, "_finalize_producer_run", _fin):
        await rp.run_producer(
            uuid4(),
            thread_id=THREAD_ID,
            current_user={"id": USER_ID, "org_id": ORG_B},
            supabase=MagicMock(),
            redis=MagicMock(),
            user_settings=MagicMock(),
            body=MessageCreate(content="x"),
            resolved_model="gpt-4o",
            resolved_provider="openai",
            active_workflow_run_id=None,
            kickoff_definition=None,
            kickoff_definition_id=None,
            **extra,
        )
    return captured, resolve


@pytest.mark.asyncio
async def test_the_producer_uses_the_handed_scoping_and_does_not_resolve_again():
    bundle = uuid4()
    captured, resolve = await _drive_producer(scoping=_scoping(bundle))
    assert resolve.await_count == 0
    assert captured["ctx"].born_for_bundle_id == bundle


@pytest.mark.asyncio
async def test_the_producer_still_resolves_when_no_scoping_is_handed():
    bundle = uuid4()
    captured, resolve = await _drive_producer(resolve_return=_scoping(bundle))
    assert resolve.await_count == 1
    assert captured["ctx"].born_for_bundle_id == bundle


@pytest.mark.asyncio
async def test_a_carried_error_fails_the_run_with_the_identical_error_text():
    msg = "HR Advisor has no knowledge folders this organization can read."
    carried, _ = await _drive_producer(scoping_error=rp.ExpertScopeUnavailable(msg))
    base_shape, _ = await _drive_producer(resolve_side_effect=rp.ExpertScopeUnavailable(msg))
    assert carried["finalize"]["terminal_status"] == "failed"
    assert carried["finalize"]["terminal_error"] == f"failed: ExpertScopeUnavailable: {msg}"
    assert carried["finalize"]["terminal_error"] == base_shape["finalize"]["terminal_error"]
    assert "ctx" not in carried, "the loop must not run on a failed resolution"


# ── create_thread ────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_create_thread_stamps_the_validated_active_org():
    inserted: list[dict] = []

    async def _aexec(builder):
        inserted.append(builder._rec)
        return SimpleNamespace(data=[{"id": THREAD_ID, "user_id": USER_ID, "title": "t"}])

    sb = MagicMock()
    t = MagicMock()

    def _insert(row):
        b = MagicMock()
        b._rec = row
        return b

    t.insert.side_effect = _insert
    sb.table.return_value = t

    from app.models.thread import ThreadCreate

    with patch.object(threads_mod, "aexec", _aexec), \
            patch.object(threads_mod, "resolve_active_org_or_none", AsyncMock(return_value=ORG_B)):
        try:
            await threads_mod.create_thread(
                MagicMock(), SimpleNamespace(headers={}, state=SimpleNamespace()),
                body=ThreadCreate(), current_user={"id": USER_ID}, supabase=sb,
            )
        except Exception:  # noqa: BLE001 — the response model is not this test's subject
            pass
    assert inserted and inserted[0]["org_id"] == ORG_B


@pytest.mark.asyncio
async def test_create_thread_without_an_active_org_is_byte_identical():
    inserted: list[dict] = []

    async def _aexec(builder):
        inserted.append(builder._rec)
        return SimpleNamespace(data=[{"id": THREAD_ID, "user_id": USER_ID, "title": "t"}])

    sb = MagicMock()
    t = MagicMock()

    def _insert(row):
        b = MagicMock()
        b._rec = row
        return b

    t.insert.side_effect = _insert
    sb.table.return_value = t

    from app.models.thread import ThreadCreate

    with patch.object(threads_mod, "aexec", _aexec), \
            patch.object(threads_mod, "resolve_active_org_or_none", AsyncMock(return_value=None)):
        try:
            await threads_mod.create_thread(
                MagicMock(), SimpleNamespace(headers={}, state=SimpleNamespace()),
                body=ThreadCreate(), current_user={"id": USER_ID}, supabase=sb,
            )
        except Exception:  # noqa: BLE001
            pass
    assert inserted and "org_id" not in inserted[0]
