"""Phase 267 (D-267-34 / D-267-16 / D-267-09) — the rows this phase writes, against REAL RLS.

What this proves, and what it refuses to prove vacuously:

  * The SUBJECT U belongs to TWO orgs. The ``messages`` / ``threads`` autofill trigger
    (``autofill_org_id_by_owner``) resolves a missing ``org_id`` with
    ``SELECT org_id FROM org_members WHERE user_id = … LIMIT 1`` — for U that is ONE of the two,
    called A here, and the fixture ASSERTS it by running the trigger's own query. The thread T
    lives in the OTHER org, B. A single-org subject would make "org_id == the thread's org" true
    by accident and prove nothing about the trigger (T-267-52).
  * CONTROL (non-vacuity): as U, a messages INSERT on T with NO explicit ``org_id`` lands in A —
    so the explicit value in the phase's writers is what makes their rows right.
  * ``_write_expert_change`` (the exact function ``PATCH /threads/{id}`` runs) and
    ``write_handoff`` (the exact function ``POST /threads/{id}/handoff`` runs) are executed on an
    ``open_user_conn`` (role swap + both JWT GUC forms, the app's own ``_apply_rls_user_context``)
    with the fail-loud ``assert_auth_uid`` preflight first. Nothing on either side is mocked.
  * ROLLBACK: the handoff's third INSERT is made to violate the REAL ``messages_role_check``;
    the first two INSERTs are proven to have EXECUTED, and afterwards zero of the three rows exist.
  * READ-BACK: U's RLS read of T returns the ``expert_changed`` row AND a seeded
    ``ask_user_prompt`` system row; ``_visible_transcript_rows`` keeps the first and drops the
    second — so the exclusion is the allowlist, not RLS.

Everything seeded is deleted in ``finally``. Skip-guarded on the local Postgres :54322 — a
skipped run is a SKIP, never a pass (run with ``-rs``).
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID, uuid4

import pytest

from app.api.threads import _visible_transcript_rows, _write_expert_change
from app.models.message import ExpertChangedEvent
from app.services.thread_handoff import handoff_title, write_handoff
from tests.integration._rls_harness import assert_auth_uid, open_user_conn, requires_pg
from tests.integration.test_163_rls_documents import _drop_user

try:
    import asyncpg
except ImportError:  # pragma: no cover
    asyncpg = None

pytestmark = requires_pg

FA_BUNDLE_ID = UUID("00000000-0000-0000-0000-000000000259")
FIXTURES = Path(__file__).resolve().parents[1] / "fixtures" / "phase267"
TRIGGER_ORG_SQL = "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1"


def _event() -> ExpertChangedEvent:
    return ExpertChangedEvent.model_validate(
        json.loads((FIXTURES / "expert_changed.json").read_text(encoding="utf-8"))
    )


def _kind(row) -> str | None:
    calls = row["tool_calls"]
    if isinstance(calls, str):
        calls = json.loads(calls)
    if isinstance(calls, list) and calls and isinstance(calls[0], dict):
        return calls[0].get("kind")
    return None


@pytest.fixture
async def two_org_subject(pg_pool):
    """U in orgs A (the trigger's LIMIT-1 pick) and B; folder F and thread T in B, owned by U."""
    uid = uuid4()
    created_orgs: list[UUID] = []
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"phase-267-fence-{uid}@test.local",
        )
        personal = await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid)
        if personal is None:  # handle_new_user absent: provision the first org explicitly
            org = uuid4()
            await pg_pool.execute(
                "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
                org, f"267-fence-first-{org}",
            )
            await pg_pool.execute(
                "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
                org, uid,
            )
        created_orgs.append((await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid))["org_id"])

        second = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
            second, f"267-fence-second-{second}",
        )
        created_orgs.append(second)
        await pg_pool.execute(
            "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
            second, uid,
        )

        members = {r["org_id"] for r in await pg_pool.fetch(
            "SELECT org_id FROM public.org_members WHERE user_id = $1", uid
        )}
        assert len(members) == 2, f"U must belong to exactly two orgs, got {members}"
        # A = whatever the trigger's own query picks; B = the other one (never assumed).
        org_a = (await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid))["org_id"]
        (org_b,) = members - {org_a}

        folder_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.folders (id, user_id, org_id, name) VALUES ($1, $2, $3, $4)",
            folder_id, uid, org_b, f"267-fence-client-acme-{folder_id.hex[:6]}",
        )
        thread_id = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.threads (id, user_id, org_id, title, folder_id, active_expert_id) "
            "VALUES ($1, $2, $3, '267 fence source', $4, $5)",
            thread_id, uid, org_b, folder_id, FA_BUNDLE_ID,
        )
        for role, content, calls in (
            ("user", "What was ACME's Q3 revenue?", None),
            ("assistant", "ACME's Q3 revenue was $124.5M.", None),
            ("system", "ask_user prompt (internal)", [{"kind": "ask_user_prompt", "question": "?"}]),
        ):
            await pg_pool.execute(
                "INSERT INTO public.messages (thread_id, user_id, org_id, role, content, tool_calls) "
                "VALUES ($1, $2, $3, $4, $5, $6::jsonb)",
                thread_id, uid, org_b, role, content, calls,
            )
        yield {
            "uid": str(uid), "org_a": org_a, "org_b": org_b,
            "folder_id": folder_id, "thread_id": thread_id,
        }
    finally:
        for sql in (
            "DELETE FROM public.messages WHERE user_id = $1",
            "DELETE FROM public.threads WHERE user_id = $1",
            "DELETE FROM public.folders WHERE user_id = $1",
        ):
            try:
                await pg_pool.execute(sql, uid)
            except Exception:
                pass
        await _drop_user(pg_pool, uid)
        for org in created_orgs:
            try:
                await pg_pool.execute("DELETE FROM public.organizations WHERE id = $1", org)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_subject_is_two_org_and_the_trigger_picks_the_wrong_org(pg_pool, two_org_subject):
    s = two_org_subject
    assert s["org_a"] != s["org_b"]
    assert (await pg_pool.fetchrow(TRIGGER_ORG_SQL, UUID(s["uid"])))["org_id"] == s["org_a"]
    t_org = await pg_pool.fetchval("SELECT org_id FROM public.threads WHERE id = $1", s["thread_id"])
    assert t_org == s["org_b"], "the thread must live in the org the trigger does NOT pick"


@pytest.mark.asyncio
async def test_expert_changed_row_lands_in_the_threads_org_not_the_triggers(pg_pool, two_org_subject):
    s = two_org_subject
    assert s["org_a"] != s["org_b"]  # precondition before the org assertion (T-267-52)

    # CONTROL — the trigger path: no explicit org_id, as U, under RLS → lands in A.
    async with open_user_conn(pg_pool, s["uid"]) as conn:
        await assert_auth_uid(conn, s["uid"])
        control_org = await conn.fetchval(
            "INSERT INTO public.messages (thread_id, user_id, role, content) "
            "VALUES ($1, $2, 'user', 'control row, no org_id') RETURNING org_id",
            s["thread_id"], UUID(s["uid"]),
        )
    assert control_org == s["org_a"], (
        f"control: a row with no org_id should take the trigger's LIMIT-1 org A, got {control_org}"
    )
    assert control_org != s["org_b"]

    # The route's own writer, as U, under RLS.
    async with open_user_conn(pg_pool, s["uid"]) as conn:
        await assert_auth_uid(conn, s["uid"])
        await _write_expert_change(
            conn,
            thread_id=str(s["thread_id"]),
            user_id=s["uid"],
            org_id=str(s["org_b"]),
            update_data={"active_expert_id": None},
            event=_event(),
        )

    rows = await pg_pool.fetch(
        "SELECT org_id, role, tool_calls, content FROM public.messages "
        "WHERE thread_id = $1 AND role = 'system'",
        s["thread_id"],
    )
    events = [r for r in rows if _kind(r) == "expert_changed"]
    assert len(events) == 1, f"exactly one expert_changed row expected, got {len(events)}"
    assert events[0]["org_id"] == s["org_b"], (
        f"expert_changed row org_id={events[0]['org_id']} — expected the THREAD's org "
        f"{s['org_b']}, not the trigger's {s['org_a']}"
    )
    assert events[0]["content"].startswith("Financial Analyzer → HR Advisor")
    # The UPDATE committed in the same transaction.
    assert await pg_pool.fetchval(
        "SELECT active_expert_id FROM public.threads WHERE id = $1", s["thread_id"]
    ) is None


@pytest.mark.asyncio
async def test_handoff_writes_three_rows_in_the_source_org_and_inherits_the_folder(
    pg_pool, two_org_subject
):
    s = two_org_subject
    assert s["org_a"] != s["org_b"]
    source = {
        "id": s["thread_id"], "org_id": s["org_b"], "title": "267 fence source",
        "folder_id": s["folder_id"],
    }
    title = handoff_title("Financial Analyzer", source["title"])
    async with open_user_conn(pg_pool, s["uid"]) as conn:
        await assert_auth_uid(conn, s["uid"])
        new_thread = await write_handoff(
            conn,
            source_thread=source,
            user_id=s["uid"],
            expert={"id": FA_BUNDLE_ID, "name": "Financial Analyzer"},
            summary=["ACME Q3 revenue $124.5M", "+18.2% YoY"],
            title=title,
            folder_name="Client ACME",
            stays_expert_name="Financial Analyzer",
            at=datetime.now(timezone.utc),
        )
    new_id = new_thread["id"]

    t = await pg_pool.fetchrow(
        "SELECT org_id, folder_id, active_expert_id, title FROM public.threads WHERE id = $1", new_id
    )
    assert t["org_id"] == s["org_b"], f"new thread org {t['org_id']} != source org {s['org_b']}"
    assert t["folder_id"] == s["folder_id"], "the new thread must inherit the source folder"
    assert t["active_expert_id"] == FA_BUNDLE_ID

    first = await pg_pool.fetch(
        "SELECT org_id, role, tool_calls FROM public.messages WHERE thread_id = $1", new_id
    )
    assert len(first) == 1
    assert first[0]["role"] == "user" and _kind(first[0]) == "handoff"
    assert first[0]["org_id"] == s["org_b"]

    ev = [r for r in await pg_pool.fetch(
        "SELECT org_id, tool_calls FROM public.messages WHERE thread_id = $1 AND role = 'system'",
        s["thread_id"],
    ) if _kind(r) == "expert_handoff"]
    assert len(ev) == 1 and ev[0]["org_id"] == s["org_b"]

    # D-267-16: the source keeps its Expert.
    assert await pg_pool.fetchval(
        "SELECT active_expert_id FROM public.threads WHERE id = $1", s["thread_id"]
    ) == FA_BUNDLE_ID


class _FailThirdInsert:
    """Delegates to the real connection; rewrites ONLY the source-event INSERT's role literal so
    the REAL ``messages_role_check`` rejects it. Counts what actually executed."""

    def __init__(self, conn, source_id):
        self._conn, self._source_id = conn, source_id
        self.fetchrow_calls = 0
        self.execute_calls = 0

    async def fetchrow(self, sql, *args):
        self.fetchrow_calls += 1
        return await self._conn.fetchrow(sql, *args)

    async def execute(self, sql, *args):
        self.execute_calls += 1
        if args and args[0] == self._source_id and "'system'" in sql:
            sql = sql.replace("'system'", "'narrator'")
        return await self._conn.execute(sql, *args)

    def __getattr__(self, name):
        return getattr(self._conn, name)


@pytest.mark.asyncio
async def test_handoff_rolls_back_all_three_rows_when_the_last_insert_fails(
    pg_pool, two_org_subject
):
    s = two_org_subject
    uid = UUID(s["uid"])

    async def _counts():
        return (
            await pg_pool.fetchval("SELECT count(*) FROM public.threads WHERE user_id = $1", uid),
            await pg_pool.fetchval("SELECT count(*) FROM public.messages WHERE user_id = $1", uid),
        )

    before = await _counts()
    proxy = None
    with pytest.raises(asyncpg.exceptions.CheckViolationError):
        async with open_user_conn(pg_pool, s["uid"]) as conn:
            await assert_auth_uid(conn, s["uid"])
            proxy = _FailThirdInsert(conn, s["thread_id"])
            await write_handoff(
                proxy,
                source_thread={
                    "id": s["thread_id"], "org_id": s["org_b"], "title": "267 fence source",
                    "folder_id": s["folder_id"],
                },
                user_id=s["uid"],
                expert={"id": FA_BUNDLE_ID, "name": "Financial Analyzer"},
                summary=["ACME Q3 revenue $124.5M"],
                title="Financial Analyzer: 267 fence source",
                folder_name="Client ACME",
                stays_expert_name="Financial Analyzer",
                at=datetime.now(timezone.utc),
            )
    # Non-vacuity: the thread INSERT and the marker INSERT really ran before the failure.
    assert proxy is not None and proxy.fetchrow_calls == 1 and proxy.execute_calls == 2
    assert await _counts() == before, "a failed handoff left rows behind — it must be all or nothing"
    assert await pg_pool.fetchval(
        "SELECT count(*) FROM public.threads WHERE user_id = $1 AND title = $2",
        uid, "Financial Analyzer: 267 fence source",
    ) == 0


@pytest.mark.asyncio
async def test_rls_read_back_passes_the_event_and_drops_ask_user_prompt(pg_pool, two_org_subject):
    s = two_org_subject
    async with open_user_conn(pg_pool, s["uid"]) as conn:
        await assert_auth_uid(conn, s["uid"])
        await _write_expert_change(
            conn,
            thread_id=str(s["thread_id"]),
            user_id=s["uid"],
            org_id=str(s["org_b"]),
            update_data={"active_expert_id": None},
            event=_event(),
        )
    async with open_user_conn(pg_pool, s["uid"]) as conn:
        await assert_auth_uid(conn, s["uid"])
        raw = [dict(r) for r in await conn.fetch(
            "SELECT id, role, content, tool_calls FROM public.messages "
            "WHERE thread_id = $1 ORDER BY created_at",
            s["thread_id"],
        )]
    raw_kinds = [(r["role"], _kind(r)) for r in raw]
    # RLS returns BOTH system rows to their owner — the exclusion must be the allowlist's.
    assert ("system", "ask_user_prompt") in raw_kinds
    assert ("system", "expert_changed") in raw_kinds
    visible = [(r["role"], _kind(r)) for r in _visible_transcript_rows(raw)]
    assert ("system", "expert_changed") in visible
    assert ("system", "ask_user_prompt") not in visible
    assert ("user", None) in visible and ("assistant", None) in visible
    assert len(visible) == len(raw) - 1
