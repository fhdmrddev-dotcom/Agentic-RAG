"""Phase 308-03 (D-05 / D-06 / D-07 / D-08 b / D-42 / D-43 / D-47; SC#2) — the EMISSION MATRIX, LIVE.

Every writer of ``workflow_runs.status`` and ``documents.status = 'completed'`` is driven against the
local database (127.0.0.1:54322) and the number of ``webhook_events`` rows it wrote is counted. The
claim is "exactly one event per transition — or none, where none is right", and it is proven by
driving each writer, not by reading its SQL.

HOW EACH WRITER IS DRIVEN (recorded so the evidence is auditable):

* REAL FUNCTIONS, inside one rolled-back transaction through ``_ConnPool`` (a pool-shaped shim over
  one connection: ``acquire()`` yields it, a nested ``transaction()`` becomes a savepoint):
  ``db.workflows.finish_run`` / ``pause_run`` / ``resume_run``, ``harness.run_handoff.end_run``
  (``_GUARDED_TERMINAL_SQL``), ``api.runs._fail_redrive`` (the ask re-drive failure SQL),
  ``db.ingestion_jobs.reconcile_finished_job_documents`` (the set-based bulk sweep).
* THE RECONCILER BOOT SWEEP is driven through the exact ``end_run(..., from_statuses=("active",),
  reason=_REASON_WORKFLOW)`` call ``run_reconciler._reconcile_workflow_runs`` makes per row — the
  sweep's own row selection scans the whole dev database, so it is not run here.
* THE SPLICE COMPLETION WRITE (upload / watched source / mail) is a supabase-py update: driven once
  with its exact SET list through asyncpg AND once through the LOCAL POSTGREST with the service-role
  client on a COMMITTED row. ``ingest_document``'s SET list (re-ingest, email attachments) through
  asyncpg. The DEDUP path is driven through the real ``mint_document_row`` on PostgREST.
* THE PLANTED FAILURE (D-06): a NOT VALID ``CHECK (false)`` on webhook_events inside the rolled-back
  transaction; the status write still lands and the trigger's WARNING arrives.

Skip-guarded on :54322 and on migration 225; run with ``-rs`` (a silent skip reads as green).
"""
from __future__ import annotations

import hashlib
from contextlib import asynccontextmanager
from uuid import uuid4

import pytest

from tests.integration._rls_harness import PG_TEST_DSN, requires_pg
from tests.integration.test_308_db_live import requires_225

pytestmark = [requires_pg, requires_225]

SECRET = "enc:v1:QUFBQQ"
ALL_TYPES = ("run.finished", "run.waiting", "document.ingested")


class _ConnPool:
    """A pool-shaped view of ONE connection, so pool-taking writers run inside the test's
    rolled-back transaction (their own ``transaction()`` becomes a savepoint)."""

    def __init__(self, con) -> None:
        self._con = con

    @asynccontextmanager
    async def acquire(self):
        yield self._con

    def __getattr__(self, name):
        return getattr(self._con, name)


async def _in_rollback(body) -> None:
    import asyncpg

    con = await asyncpg.connect(PG_TEST_DSN)
    try:
        tr = con.transaction()
        await tr.start()
        try:
            await body(con)
        finally:
            await tr.rollback()
    finally:
        await con.close()


async def _seed(c, *, label="m") -> dict:
    user = uuid4()
    await c.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", user, f"308-03-{label}-{user.hex[:8]}@test.local")
    org = await c.fetchval("INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", f"308-03 {user.hex[:8]}")
    await c.execute("INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')", org, user)
    thread = await c.fetchval(
        "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, '308-03 thread') RETURNING id", user, org,
    )
    definition = await c.fetchval(
        "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
        " VALUES ($1, '308-03 wf', $2, $3, 'published') RETURNING id",
        f"p308-03-{uuid4().hex[:8]}", user, org,
    )
    return {"user": user, "org": org, "thread": thread, "definition": definition}


async def _member(c, w, *, label="other") -> dict:
    other = uuid4()
    await c.execute("INSERT INTO auth.users (id, email) VALUES ($1, $2)", other, f"308-03-{label}-{other.hex[:8]}@test.local")
    await c.execute("INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')", w["org"], other)
    return {**w, "user": other}


async def _endpoint(c, w, *, events=ALL_TYPES, enabled=True):
    return await c.fetchval(
        "INSERT INTO public.webhook_endpoints (user_id, org_id, url, event_types, secret_ciphertext, enabled,"
        " disabled_reason) VALUES ($1, $2, 'https://hooks.example.com/in', $3::text[], $4, $5, $6) RETURNING id",
        w["user"], w["org"], list(events), SECRET, enabled, None if enabled else "admin",
    )


async def _run(c, w, *, origin="app", golden=False, status="active"):
    return await c.fetchval(
        "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id, is_golden_run,"
        " inputs, origin_kind) VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, $7) RETURNING id",
        w["thread"], w["definition"], status, w["org"], w["user"], golden, origin,
    )


async def _doc(c, w, *, status="pending", content_hash=None):
    return await c.fetchval(
        "INSERT INTO public.documents (user_id, org_id, filename, mime_type, file_size, file_path, status, content_hash)"
        " VALUES ($1, $2, $3, 'text/plain', 1, $4, $5, $6) RETURNING id",
        w["user"], w["org"], f"308-03-{uuid4().hex[:6]}.txt", f"308-03/{uuid4()}", status, content_hash,
    )


async def _events(c, item) -> list[tuple]:
    return [tuple(r) for r in await c.fetch(
        "SELECT type, status, origin_kind FROM public.webhook_events WHERE item_id = $1 ORDER BY created_at, id", item
    )]


async def _status(c, table, item) -> str:
    return await c.fetchval(f"SELECT status FROM public.{table} WHERE id = $1", item)


# ── runs: finish_run x four origins x three terminal statuses (12) ──────────────────────────


@pytest.mark.parametrize("status", ["completed", "failed", "cancelled"])
@pytest.mark.parametrize("origin", ["app", "schedule", "key", "mcp"])
async def test_finish_run_emits_one_run_finished_per_origin_and_status(origin, status):
    from app.db.workflows import finish_run

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w, origin=origin)
        await finish_run(_ConnPool(c), run, status)
        assert await _status(c, "workflow_runs", run) == status
        assert await _events(c, run) == [("run.finished", status, origin)]

    await _in_rollback(body)


# ── runs: the guarded terminal SQL, the ask re-drive failure, the reconciler's end ─────────


@pytest.mark.parametrize("status", ["completed", "failed", "cancelled"])
async def test_the_guarded_terminal_sql_emits_once(status):
    from app.services.harness import run_handoff

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w, origin="schedule")
        # end_run = _GUARDED_TERMINAL_SQL, then finish_run with the SAME status (must add nothing)
        assert await run_handoff.end_run(_ConnPool(c), run, status) is True
        assert await _events(c, run) == [("run.finished", status, "schedule")]
        # a second guarded end loses (already terminal) and adds nothing
        assert await run_handoff.end_run(_ConnPool(c), run, "failed") is False
        assert len(await _events(c, run)) == 1

    await _in_rollback(body)


async def test_the_ask_redrive_failure_emits_once():
    from app.api.runs import _fail_redrive

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w, origin="key")
        await _fail_redrive(_ConnPool(c), run, w["user"])
        assert await _status(c, "workflow_runs", run) == "failed"
        assert await _events(c, run) == [("run.finished", "failed", "key")]

    await _in_rollback(body)


async def test_the_reconciler_boot_sweep_end_emits_once():
    from app.services import run_reconciler
    from app.services.harness.run_handoff import end_run

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w, origin="mcp")
        # the exact call _reconcile_workflow_runs makes for one finalised row
        won = await end_run(_ConnPool(c), run, "failed", from_statuses=("active",),
                            user_id=w["user"], reason=run_reconciler._REASON_WORKFLOW)
        assert won is True
        assert await _events(c, run) == [("run.finished", "failed", "mcp")]

    await _in_rollback(body)


# ── runs: waiting, and the transitions that must add nothing ───────────────────────────────


async def test_pause_run_emits_one_run_waiting():
    from app.db.workflows import pause_run

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w)
        await pause_run(_ConnPool(c), run)
        assert await _events(c, run) == [("run.waiting", "paused", "app")]

    await _in_rollback(body)


async def test_resume_then_pause_again_emits_a_second_run_waiting():
    from app.db.workflows import pause_run, resume_run

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w)
        pool = _ConnPool(c)
        await pause_run(pool, run)
        await resume_run(pool, run)
        assert await _status(c, "workflow_runs", run) == "active"
        await pause_run(pool, run)
        assert [e[0] for e in await _events(c, run)] == ["run.waiting", "run.waiting"]

    await _in_rollback(body)


async def test_a_same_value_rewrite_emits_nothing_more():
    from app.db.workflows import finish_run

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w)
        await finish_run(_ConnPool(c), run, "completed")
        await finish_run(_ConnPool(c), run, "completed")
        await c.execute("UPDATE public.workflow_runs SET status = 'completed' WHERE id = $1", run)
        assert len(await _events(c, run)) == 1

    await _in_rollback(body)


async def test_a_second_terminal_write_refused_by_finish_run_stays_one():
    from app.db.workflows import finish_run

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w)
        await finish_run(_ConnPool(c), run, "completed")
        await finish_run(_ConnPool(c), run, "failed")
        assert await _status(c, "workflow_runs", run) == "completed"
        assert await _events(c, run) == [("run.finished", "completed", "app")]

    await _in_rollback(body)


async def test_a_golden_run_emits_nothing():
    from app.db.workflows import finish_run

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w, origin=None, golden=True)
        await finish_run(_ConnPool(c), run, "completed")
        assert await _events(c, run) == []

    await _in_rollback(body)


async def test_only_another_members_endpoint_means_no_run_event():
    from app.db.workflows import finish_run

    async def body(c):
        w = await _seed(c)
        other = await _member(c, w)
        await _endpoint(c, other)
        run = await _run(c, w)
        await finish_run(_ConnPool(c), run, "completed")
        assert await _events(c, run) == [], "a run event is for the run owner's endpoints only (D-03)"

    await _in_rollback(body)


async def test_the_owner_and_another_member_both_subscribed_is_still_one_event():
    from app.db.workflows import finish_run

    async def body(c):
        w = await _seed(c)
        other = await _member(c, w)
        await _endpoint(c, other)
        await _endpoint(c, w)
        run = await _run(c, w)
        await finish_run(_ConnPool(c), run, "completed")
        assert len(await _events(c, run)) == 1

    await _in_rollback(body)


@pytest.mark.parametrize("variant", ["unsubscribed", "disabled", "none"])
async def test_no_subscribed_enabled_endpoint_means_no_event(variant):
    from app.db.workflows import finish_run

    async def body(c):
        w = await _seed(c)
        if variant == "unsubscribed":
            await _endpoint(c, w, events=("document.ingested",))
        elif variant == "disabled":
            await _endpoint(c, w, enabled=False)
        run = await _run(c, w)
        await finish_run(_ConnPool(c), run, "completed")
        assert await _events(c, run) == []

    await _in_rollback(body)


async def test_the_run_trigger_set_keeps_cap_paused():
    """D-43: nothing writes cap_paused to workflow_runs today; the set is pinned for later."""
    async def body(c):
        triggerdef = await c.fetchval(
            "SELECT pg_get_triggerdef(t.oid) FROM pg_trigger t"
            " WHERE t.tgname = 'workflow_runs_webhook_emit' AND t.tgrelid = 'public.workflow_runs'::regclass"
        )
        src = await c.fetchval("SELECT prosrc FROM pg_proc WHERE oid = 'public.webhook_emit_run_event()'::regprocedure")
        assert "cap_paused" in triggerdef, triggerdef
        assert "'paused', 'cap_paused'" in src and "run.waiting" in src

    await _in_rollback(body)


# ── D-06: a trigger failure never blocks the writer ────────────────────────────────────────


async def test_a_planted_trigger_failure_is_swallowed_and_warned():
    async def body(c):
        warnings: list[str] = []
        c.add_log_listener(lambda _con, msg: warnings.append(str(msg)))
        w = await _seed(c)
        await _endpoint(c, w)
        run = await _run(c, w)
        await c.execute(
            "ALTER TABLE public.webhook_events ADD CONSTRAINT p308_03_planted CHECK (false) NOT VALID"
        )
        # the finish_run-shaped status write
        await c.execute(
            "UPDATE workflow_runs SET status = $2 WHERE id = $1"
            "  AND (status IS NULL OR status NOT IN ('completed', 'failed', 'cancelled') OR status = $2)",
            run, "completed",
        )
        assert await _status(c, "workflow_runs", run) == "completed", "the writer's row must commit"
        assert await _events(c, run) == []
        assert any("swallowed" in m for m in warnings), warnings

    await _in_rollback(body)


# ── documents ─────────────────────────────────────────────────────────────────────────────


async def test_the_splice_completion_set_list_emits_one_document_ingested():
    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w, events=("document.ingested",))
        doc = await _doc(c, w)
        await c.execute("UPDATE public.documents SET status = 'processing' WHERE id = $1", doc)
        # ingest_splice.py's completion write, exact SET list
        await c.execute(
            "UPDATE public.documents SET status = 'completed', chunk_count = $2, full_markdown = $3,"
            " extractor = $4 WHERE id = $1",
            doc, 3, "# text", "legacy",
        )
        assert await _events(c, doc) == [("document.ingested", "completed", None)]

    await _in_rollback(body)


async def test_ingest_documents_completion_set_list_emits_one():
    import json

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w, events=("document.ingested",))
        doc = await _doc(c, w, status="processing")
        # api/documents.py ingest_document's completion write (re-ingest, email attachments)
        await c.execute(
            "UPDATE public.documents SET status = 'completed', chunk_count = $2, full_markdown = $3,"
            " extractor = $4, metadata = $5::jsonb, thread_key = $6 WHERE id = $1",
            doc, 2, "# text", "legacy", json.dumps({"title": "t"}), "tk-308",
        )
        assert len(await _events(c, doc)) == 1

    await _in_rollback(body)


async def test_the_ingestion_jobs_bulk_sweep_emits_one_per_row():
    from app.db.ingestion_jobs import reconcile_finished_job_documents

    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w, events=("document.ingested",))
        docs = [await _doc(c, w, status="processing") for _ in range(2)]
        for d in docs:
            await c.execute(
                "INSERT INTO public.document_chunks (document_id, user_id, content, chunk_index, org_id)"
                " VALUES ($1, $2, 'chunk', 0, $3)", d, w["user"], w["org"],
            )
            await c.execute(
                "INSERT INTO public.ingestion_jobs (document_id, user_id, org_id, status, stage, updated_at)"
                " VALUES ($1, $2, $3, 'completed', 'completed', now() - interval '1 hour')",
                d, w["user"], w["org"],
            )
        await reconcile_finished_job_documents(_ConnPool(c), grace_seconds=60)
        for d in docs:
            assert await _status(c, "documents", d) == "completed"
            assert await _events(c, d) == [("document.ingested", "completed", None)]

    await _in_rollback(body)


async def test_a_reingest_emits_one_more():
    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w, events=("document.ingested",))
        doc = await _doc(c, w, status="processing")
        await c.execute("UPDATE public.documents SET status = 'completed' WHERE id = $1", doc)
        for step in ("pending", "processing", "completed"):
            await c.execute("UPDATE public.documents SET status = $2 WHERE id = $1", doc, step)
        assert [e[0] for e in await _events(c, doc)] == ["document.ingested", "document.ingested"]

    await _in_rollback(body)


async def test_an_insert_already_completed_emits_one():
    """D-47's defence arm: no writer inserts a completed row today."""
    async def body(c):
        w = await _seed(c)
        await _endpoint(c, w, events=("document.ingested",))
        doc = await _doc(c, w, status="completed")
        assert len(await _events(c, doc)) == 1

    await _in_rollback(body)


# ── documents through the local PostgREST (committed rows) ─────────────────────────────────


def _service_role_client():
    from tests.integration.test_111_audit_field_create import _supabase_or_skip

    return _supabase_or_skip()


@asynccontextmanager
async def _committed_world():
    import asyncpg

    pool = await asyncpg.create_pool(PG_TEST_DSN, min_size=1, max_size=2)
    w = None
    created_orgs: list = []
    try:
        async with pool.acquire() as c:
            w = await _seed(c, label="rest")
            created_orgs += [r["org_id"] for r in await c.fetch(
                "SELECT org_id FROM public.org_members WHERE user_id = $1", w["user"])]
            await _endpoint(c, w, events=("document.ingested",))
        yield pool, w
    finally:
        leftover = None
        async with pool.acquire() as c:
            if w is not None:
                await c.execute("DELETE FROM public.documents WHERE user_id = $1", w["user"])
                await c.execute("DELETE FROM public.workflow_definitions WHERE id = $1", w["definition"])
                await c.execute("DELETE FROM public.threads WHERE id = $1", w["thread"])
                await c.execute("DELETE FROM public.organizations WHERE id = ANY($1::uuid[])", created_orgs)
                await c.execute("DELETE FROM auth.users WHERE id = $1", w["user"])
                leftover = await c.fetchval(
                    "SELECT (SELECT count(*) FROM auth.users WHERE id = $1)"
                    " + (SELECT count(*) FROM public.documents WHERE user_id = $1)"
                    " + (SELECT count(*) FROM public.webhook_endpoints WHERE user_id = $1)"
                    " + (SELECT count(*) FROM public.webhook_events WHERE org_id = ANY($2::uuid[]))"
                    " + (SELECT count(*) FROM public.organizations WHERE id = ANY($2::uuid[]))",
                    w["user"], created_orgs,
                )
        await pool.close()
        assert leftover in (0, None), "the committed fixture left rows behind"


async def test_the_splice_update_through_postgrest_emits_one():
    sb = _service_role_client()
    async with _committed_world() as (pool, w):
        async with pool.acquire() as c:
            doc = await _doc(c, w, status="processing")
        sb.table("documents").update({
            "status": "completed", "chunk_count": 1, "full_markdown": "# t", "extractor": "legacy",
        }).eq("id", str(doc)).execute()
        async with pool.acquire() as c:
            assert await _events(c, doc) == [("document.ingested", "completed", None)]


async def test_the_dedup_path_inserts_nothing_and_emits_nothing():
    from app.services.ingest_splice import mint_document_row

    sb = _service_role_client()
    raw = f"308-03 dedup {uuid4()}".encode()
    async with _committed_world() as (pool, w):
        async with pool.acquire() as c:
            original = await _doc(c, w, status="completed", content_hash=hashlib.sha256(raw).hexdigest())
            before = await c.fetchval("SELECT count(*) FROM public.webhook_events WHERE org_id = $1", w["org"])
            docs_before = await c.fetchval("SELECT count(*) FROM public.documents WHERE user_id = $1", w["user"])
        assert before == 1, "non-vacuity: the completed original emitted its own one event"
        result = mint_document_row(
            raw=raw, filename="dup.txt", mime_type="text/plain", user_id=str(w["user"]), supabase=sb,
            org_id=str(w["org"]),
        )
        assert result.is_duplicate is True and str(result.document["id"]) == str(original)
        async with pool.acquire() as c:
            assert await c.fetchval("SELECT count(*) FROM public.documents WHERE user_id = $1", w["user"]) == docs_before
            assert await c.fetchval("SELECT count(*) FROM public.webhook_events WHERE org_id = $1", w["org"]) == before
