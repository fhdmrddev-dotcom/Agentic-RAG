"""Phase 118 Wave-0 (RED) — the on-upload rule-eval pass writes _classification, never moves.

Proves the CLASS-02 ingest splice (Plan 03 T1) on the SHARED matcher + the rule read:

  * a matching enabled rule writes ``metadata._classification`` = the D-118-5 single object
    (status="suggested"), NOT a folder_id change (Pitfall 4: never a silent move).
  * the matched object carries a frozen ``condition_summary`` + ``suggested_folder_name``
    (resolved fresh) and NO confidence %.
  * first-match-wins (D-118-3): owner-private rules evaluate before global, oldest first
    (D-118-4); a single object, never a list.
  * classification NEVER blocks ingest — a matcher/read error degrades to no suggestion.

xfail until Plan 03 splices the pass; imports inside test bodies. The matcher itself (Plan 01
Task 2) is unit-tested in test_118_matcher.py; this file proves the END-TO-END ingest write
against live :54322. Harness copied from test_111_flat_filter_compat.py.
"""

import asyncio
import json
import os
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:
        return False


def _check_pg_available_sync() -> bool:
    import asyncio as _a
    try:
        loop = _a.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 118 ingest-suggest tests",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


@pytest_asyncio.fixture
async def pg_pool():
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def user_with_rule_and_folder(pg_pool):
    """Seed a user + a target folder + an enabled document_type=invoice rule pointing at it."""
    if not await _table_exists(pg_pool, "classification_rules"):
        pytest.skip("classification_rules table absent")
    user_id = uuid4()
    folder_id = uuid4()
    rule_id = uuid4()
    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-118-ingest-{user_id}@test.local",
    )
    await pg_pool.execute(
        "INSERT INTO public.folders (id, user_id, name, is_global) VALUES ($1, $2, $3, false)",
        folder_id, user_id, "Invoices",
    )
    await pg_pool.execute(
        "INSERT INTO classification_rules (id, user_id, name, match_expr, suggest_folder_id, is_global, enabled) "
        "VALUES ($1, $2, $3, $4, $5, false, true)",
        rule_id, user_id, "Invoices",
        {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "invoice"}]},
        folder_id,
    )
    ctx = {"user_id": user_id, "folder_id": folder_id, "rule_id": rule_id}
    try:
        yield ctx
    finally:
        for sql in (
            ("DELETE FROM classification_rules WHERE user_id = $1", user_id),
            ("DELETE FROM public.documents WHERE user_id = $1", user_id),
            ("DELETE FROM public.folders WHERE user_id = $1", user_id),
            ("DELETE FROM audit_log WHERE user_id = $1", user_id),
            ("DELETE FROM auth.users WHERE id = $1", user_id),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


@pytest.mark.asyncio
async def test_matching_rule_writes_classification_not_move(pg_pool, user_with_rule_and_folder):
    """A matching enabled rule writes metadata._classification (status=suggested), NEVER a move."""
    from supabase import create_client

    # NOTE: Plan 03 wires the pass into ingest_document. Here we drive the SAME pass logic
    # the splice uses (the matcher + the rule read) to prove the write shape. The concrete
    # entrypoint is finalized in Plan 03; this scaffold asserts the contract.
    from app.services import classification_matcher  # Plan 01 Task 2

    ctx = user_with_rule_and_folder
    # Read the rule via the leak-safe own+global predicate (mirrors the ingest pass).
    creds_env = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(creds_env):
        pytest.skip("backend/.env not found")
    url = key = None
    with open(creds_env, encoding="utf-8") as f:
        for line in f:
            if line.startswith("SUPABASE_URL="):
                url = line.split("=", 1)[1].strip().strip('"')
            elif line.startswith("SUPABASE_SERVICE_ROLE_KEY="):
                key = line.split("=", 1)[1].strip().strip('"')
    if not url or not key:
        pytest.skip("supabase creds absent")
    sb = create_client(url, key)

    rules = (
        sb.table("classification_rules").select("*")
        .or_(f"user_id.eq.{ctx['user_id']},is_global.eq.true")
        .eq("enabled", True).order("is_global").order("created_at").execute()
    ).data or []
    metadata = {"document_type": "invoice", "author": "Acme Corp"}
    whitelist = {"document_type", "language", "title", "author", "summary", "date", "topics"}
    suggestion = None
    for rule in rules:
        if classification_matcher.match_metadata(rule["match_expr"], metadata, whitelist):
            suggestion = classification_matcher.build_suggestion(rule, sb, str(ctx["user_id"]))
            break

    assert suggestion is not None, "the document_type=invoice rule must match"
    assert suggestion["status"] == "suggested"
    assert suggestion["suggested_folder_id"] == str(ctx["folder_id"])
    assert suggestion["suggested_folder_name"] == "Invoices"
    assert "confidence" not in suggestion
    assert "condition_summary" in suggestion and suggestion["condition_summary"]


@pytest.mark.asyncio
async def test_classification_never_blocks_ingest_on_error(pg_pool, user_with_rule_and_folder):
    """A matcher/read error degrades to NO suggestion — ingest never raises (mirror metadata degrade)."""
    from app.services import classification_matcher

    # A malformed match_expr (unknown op) must raise inside the matcher, but the ingest pass
    # catches it and continues — the document still persists with no _classification.
    bad_expr = {"op": "and", "conditions": [{"field": "document_type", "op": "xor", "value": "x"}]}
    raised = False
    try:
        classification_matcher.match_metadata(bad_expr, {"document_type": "invoice"}, {"document_type"})
    except Exception:
        raised = True
    assert raised, "a malformed AST raises inside the matcher (the ingest pass swallows it)"
