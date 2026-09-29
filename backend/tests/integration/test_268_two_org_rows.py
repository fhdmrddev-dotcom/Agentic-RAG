"""Phase 268 (METER-08 / D-268-07 / D-268-22 / D-268-05 / SEED-314) — every row a turn writes, on REAL Postgres.

The subject is the exact user shape the mig-106 autofill trigger gets wrong: U belongs to TWO
orgs. ``autofill_org_id_by_owner`` resolves a missing ``org_id`` with
``SELECT org_id FROM org_members WHERE user_id = … LIMIT 1`` — no ORDER BY — so for U it picks
ONE of the two, called A here, and the fixture DERIVES A by running the trigger's own query
(never assumes it) and asserts A ≠ B before any org assertion. U sends with a validated
``X-Org-Id`` of B. Before 268 every row that turn wrote landed in A.

What is driven, with the REAL writers (nothing about the INSERT is mocked):

  * CONTROL (non-vacuity): ``insert_run`` with no ``org_id`` lands in A — so the explicit value is
    what makes the B rows right, and a green below cannot come from the trigger happening to agree.
  * ``register_run_start(org_id=B, expert_id=E)`` → the run is B / E / attributed.
  * ``insert_run(parent_run_id=<that run>)`` with NO org and NO Expert → B / E / attributed: the
    SQL parent copy (D-268-19), the path every sub-agent takes.
  * the user-message row in the exact shape ``send_message`` builds, the thread row in the exact
    shape ``create_thread`` builds, ``insert_assistant_message(org_id=B)``, a system-warning row in
    the exact shape ``_persist_system_messages`` builds, and the cap-paused carrier built by the
    REAL ``persist_cap_paused`` (its supabase insert captured, then written) → all B.
  * the Continue lookup: ``load_cap_paused_tool_calls(pool, thread, org_id=B)`` finds the carrier,
    and ``org_id=A`` does not — the lookup is org-strict, which is why the carrier must be B too.
  * a pre-268-shaped row (raw SQL, no ``expert_attributed``) reads ``false`` = "Not recorded".

Everything seeded is deleted in ``finally`` (runs BEFORE threads). Skip-guarded on the local
Postgres :54322 — run with ``-rs``; a skip is a SKIP, never a pass.
"""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import UUID, uuid4

import pytest

from app.db.runs import insert_assistant_message, insert_run, load_cap_paused_tool_calls
from app.services.agent_loop import persist_cap_paused
from app.services.run_lifecycle import register_run_start
from tests.integration._rls_harness import requires_pg
from tests.integration.test_163_rls_documents import _drop_user

pytestmark = requires_pg

TRIGGER_ORG_SQL = "SELECT org_id FROM public.org_members WHERE user_id = $1 LIMIT 1"


class _Redis:
    async def zadd(self, *_a, **_k):
        return 1


class _CapturingSupabase:
    """Stands in for the service client ``persist_cap_paused`` inserts through; keeps the dict."""

    def __init__(self):
        self.rows: list[dict] = []

    def table(self, name):
        assert name == "messages"
        outer = self

        class _T:
            def insert(self, row):
                outer.rows.append(row)
                return SimpleNamespace(execute=lambda: SimpleNamespace(data=[row]))

        return _T()


@pytest.fixture
async def two_org_subject(pg_pool):
    """U in orgs A (the trigger's LIMIT-1 pick) and B; thread T in B, owned by U."""
    uid = uuid4()
    created_orgs: list[UUID] = []
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"phase-268-two-org-{uid}@test.local",
        )
        personal = await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid)
        if personal is None:  # handle_new_user absent: provision the first org explicitly
            org = uuid4()
            await pg_pool.execute(
                "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
                org, f"268-two-org-first-{org}",
            )
            await pg_pool.execute(
                "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')",
                org, uid,
            )
        created_orgs.append((await pg_pool.fetchrow(TRIGGER_ORG_SQL, uid))["org_id"])

        second = uuid4()
        await pg_pool.execute(
            "INSERT INTO public.organizations (id, name) VALUES ($1, $2)",
            second, f"268-two-org-second-{second}",
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

        # The thread, in the exact shape create_thread builds with a validated active org.
        insert_data = {"user_id": str(uid), "title": "268 two-org", "org_id": str(org_b)}
        thread_id = await pg_pool.fetchval(
            "INSERT INTO public.threads (user_id, title, org_id) VALUES ($1::uuid, $2, $3::uuid) RETURNING id",
            insert_data["user_id"], insert_data["title"], insert_data["org_id"],
        )
        yield {"uid": uid, "org_a": org_a, "org_b": org_b, "thread_id": thread_id}
    finally:
        for sql in (
            "DELETE FROM public.runs WHERE user_id = $1",
            "DELETE FROM public.messages WHERE user_id = $1",
            "DELETE FROM public.threads WHERE user_id = $1",
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


async def _run_row(pg_pool, run_id):
    return await pg_pool.fetchrow(
        "SELECT org_id, expert_id, expert_attributed FROM public.runs WHERE run_id = $1", run_id
    )


@pytest.mark.asyncio
async def test_subject_is_two_org_and_the_trigger_picks_A_not_B(pg_pool, two_org_subject):
    s = two_org_subject
    assert s["org_a"] != s["org_b"]
    assert (await pg_pool.fetchrow(TRIGGER_ORG_SQL, s["uid"]))["org_id"] == s["org_a"]
    t_org = await pg_pool.fetchval("SELECT org_id FROM public.threads WHERE id = $1", s["thread_id"])
    assert t_org == s["org_b"], "the thread (create_thread's shape, active org B) must be in B"


@pytest.mark.asyncio
async def test_control_a_run_with_no_org_lands_in_A(pg_pool, two_org_subject):
    """Non-vacuity: without the explicit org the trigger decides, and for U it decides A."""
    s = two_org_subject
    assert s["org_a"] != s["org_b"]
    run_id = uuid4()
    await insert_run(
        pg_pool, run_id=run_id, thread_id=s["thread_id"], user_id=s["uid"],
        status="streaming", model="gpt-4o", provider="openai",
    )
    row = await _run_row(pg_pool, run_id)
    assert row["org_id"] == s["org_a"], f"control landed in {row['org_id']}, expected the trigger's A"
    # A root with no Expert passed is still ATTRIBUTED — "No Expert", not "Not recorded".
    assert row["expert_id"] is None and row["expert_attributed"] is True


@pytest.mark.asyncio
async def test_the_run_and_its_sub_agent_land_in_B_with_the_expert(pg_pool, two_org_subject):
    s = two_org_subject
    assert s["org_a"] != s["org_b"]
    expert_e = uuid4()  # runs.expert_id has no FK (D-268-04) — any id is storable
    root = uuid4()
    await register_run_start(
        pool=pg_pool, redis=_Redis(), run_id=root, thread_id=s["thread_id"], user_id=s["uid"],
        model="gpt-4o", provider="openai", spawned_by_worker="268-it",
        org_id=str(s["org_b"]), expert_id=expert_e,
    )
    row = await _run_row(pg_pool, root)
    assert row["org_id"] == s["org_b"], f"run landed in {row['org_id']}, expected B (trigger's A = {s['org_a']})"
    assert row["expert_id"] == expert_e
    assert row["expert_attributed"] is True

    # The sub-agent: task_service's exact call shape — parent_run_id, NO org, NO Expert.
    sub = uuid4()
    await insert_run(
        pool=pg_pool, run_id=sub, thread_id=s["thread_id"], user_id=s["uid"],
        status="streaming", model="gpt-4o-mini", provider="openai", parent_run_id=root,
    )
    srow = await _run_row(pg_pool, sub)
    assert srow["org_id"] == s["org_b"], "a sub-agent takes its PARENT's org, not the trigger's A"
    assert srow["expert_id"] == expert_e, "a sub-agent takes its PARENT's Expert"
    assert srow["expert_attributed"] is True


@pytest.mark.asyncio
async def test_every_message_the_turn_writes_lands_in_B_and_continue_finds_the_carrier(
    pg_pool, two_org_subject,
):
    s = two_org_subject
    org_b = str(s["org_b"])
    uid = str(s["uid"])
    tid = s["thread_id"]
    assert s["org_a"] != s["org_b"]

    # 1. The user message, in the exact dict send_message builds with an active org.
    user_row = {"thread_id": str(tid), "user_id": uid, "role": "user", "content": "hi", "org_id": org_b}
    user_org = await pg_pool.fetchval(
        "INSERT INTO public.messages (thread_id, user_id, role, content, org_id) "
        "VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid) RETURNING org_id",
        user_row["thread_id"], user_row["user_id"], user_row["role"], user_row["content"], user_row["org_id"],
    )
    assert user_org == s["org_b"]

    # 2. The assistant message — the real writer, as agent_loop calls it.
    msg_id = await insert_assistant_message(
        pg_pool, thread_id=tid, user_id=s["uid"], content="answer", org_id=org_b,
    )
    assert await pg_pool.fetchval("SELECT org_id FROM public.messages WHERE id = $1", msg_id) == s["org_b"]

    # 3. A system warning, in the exact dict _persist_system_messages builds.
    current_user = {"id": uid, "org_id": org_b}
    warn = {
        "thread_id": str(tid), "user_id": current_user["id"], "role": "system",
        "content": "provider warning", "tool_calls": [{"kind": "provider_warning"}],
        **({"org_id": current_user["org_id"]} if current_user.get("org_id") else {}),
    }
    warn_org = await pg_pool.fetchval(
        "INSERT INTO public.messages (thread_id, user_id, role, content, tool_calls, org_id) "
        "VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::uuid) RETURNING org_id",
        warn["thread_id"], warn["user_id"], warn["role"], warn["content"], warn["tool_calls"], warn["org_id"],
    )
    assert warn_org == s["org_b"]

    # 4. The cap-paused carrier, built by the REAL persist_cap_paused, then written.
    sb = _CapturingSupabase()
    await persist_cap_paused(
        redis=None, run_id=uuid4(), thread_id=str(tid), user_id=uid, supabase=sb,
        tool_calls_buffer={0: {"id": "call_1", "name": "search_documents", "arguments": "{}"}},
        continues_used=0, emit=AsyncMock(), org_id=org_b,
    )
    (carrier,) = sb.rows
    assert carrier["org_id"] == org_b, "persist_cap_paused must put the active org on the carrier"
    await pg_pool.execute(
        "INSERT INTO public.messages (thread_id, user_id, role, content, tool_calls, org_id) "
        "VALUES ($1::uuid, $2::uuid, $3, $4, $5::jsonb, $6::uuid)",
        carrier["thread_id"], carrier["user_id"], carrier["role"], carrier["content"],
        carrier["tool_calls"], carrier["org_id"],
    )

    # 5. The Continue lookup — keyed by the RUN's org, which is now B.
    found = await load_cap_paused_tool_calls(pg_pool, tid, org_id=s["org_b"])
    assert [c["tool_call_id"] for c in found] == ["call_1"], "Continue could not find the carrier in B"
    assert await load_cap_paused_tool_calls(pg_pool, tid, org_id=s["org_a"]) == [], (
        "the lookup is org-strict — which is exactly why a carrier left to the trigger (A) was "
        "invisible to a run stamped B"
    )


@pytest.mark.asyncio
async def test_a_pre_268_shaped_row_reads_not_recorded(pg_pool, two_org_subject):
    s = two_org_subject
    run_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO public.runs (run_id, thread_id, user_id, status, model, provider) "
        "VALUES ($1, $2, $3, 'completed', 'gpt-4o', 'openai')",
        run_id, s["thread_id"], s["uid"],
    )
    row = await _run_row(pg_pool, run_id)
    assert row["expert_attributed"] is False, "the column default must mean Not recorded (before 268)"
    assert row["expert_id"] is None
