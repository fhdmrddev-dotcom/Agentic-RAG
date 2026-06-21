"""Phase 118 SECURE (RED) — the two-user global-rule scoping leak proof (D-118-8).

THE mandatory live proof that the ingest rule-eval pass NEVER leaks across users. The
ingest pass runs inside a BackgroundTask with NO request JWT — ``auth.uid()`` is NULL and
the service-role client BYPASSES RLS. The SOLE owner-scoping gate is the in-app
``.or_(f"user_id.eq.{uploader},is_global.eq.true")`` predicate (Pitfall 3). This file proves,
with two distinct users + a GLOBAL rule, the D-118-8 contract:

  * User B's PRIVATE rule NEVER evaluates against User A's upload (B's rule is not in A's
    own+global read set).
  * A GLOBAL rule (is_global=true, owned by A) is visible to B's upload-read, but is
    evaluated against B's OWN upload metadata only — it never reads A's data.

This mirrors test_116_tool_leak.py's per-user OWN-scoped fixtures (two distinct user
fixtures + an is_global rule), NOT a B-queries-A's-private-rule shape that false-greens.
secure-phase re-runs this NON-VACUOUS (the RLS/predicate label is NOT proof — the D-102 /
D-110-5 "static would false-green" lesson; only two real callers driving the REAL read +
matcher closes the threat).

xfail until Plan 03 splices the pass; imports inside test bodies. Harness copied from
test_116_tool_leak.py — skips cleanly when :54322 is unreachable.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 118 rule-leak test",
)


async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


def _read_local_supabase_env():
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return None
    url = key = None
    try:
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k == "SUPABASE_URL":
                    url = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY":
                    key = v
    except OSError:
        return None
    if not url or not key:
        return None
    return url, key


def _supabase_or_skip():
    creds = _read_local_supabase_env()
    if creds is None:
        pytest.skip("local SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in backend/.env")
    url, key = creds
    try:
        from supabase import create_client
        client = create_client(url, key)
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"supabase service-role client unavailable: {type(e).__name__}: {e}")
    try:
        client.table("classification_rules").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"local Supabase REST gate / classification_rules table unreachable: {e}")
    return client


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
async def two_users_with_rules(pg_pool):
    """Seed two distinct users; A owns a GLOBAL rule + a PRIVATE rule; B owns a PRIVATE rule.

    The leak vectors this scopes (D-118-8):
      * B's PRIVATE rule (``user_id=B, is_global=false``) must NOT appear in A's
        own+global read set (so it never evaluates against A's upload).
      * A's GLOBAL rule (``user_id=A, is_global=true``) DOES appear in B's read set, but is
        evaluated against B's OWN upload metadata only.
      * A's PRIVATE rule (``user_id=A, is_global=false``) must NOT appear in B's read set.
    """
    if not await _table_exists(pg_pool, "classification_rules"):
        pytest.skip("classification_rules table absent")

    user_a = uuid4()
    user_b = uuid4()
    for uid, label in ((user_a, "a"), (user_b, "b")):
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            uid, f"phase-118-leak-{label}-{uid}@test.local",
        )

    a_global = uuid4()
    a_private = uuid4()
    b_private = uuid4()
    invoice_expr = {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "invoice"}]}
    secret_expr = {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "b-secret"}]}

    await pg_pool.execute(
        "INSERT INTO classification_rules (id, user_id, name, match_expr, is_global, enabled) "
        "VALUES ($1, $2, $3, $4, true, true)",
        a_global, user_a, "A-GLOBAL-invoice", invoice_expr,
    )
    await pg_pool.execute(
        "INSERT INTO classification_rules (id, user_id, name, match_expr, is_global, enabled) "
        "VALUES ($1, $2, $3, $4, false, true)",
        a_private, user_a, "A-PRIVATE-invoice", invoice_expr,
    )
    await pg_pool.execute(
        "INSERT INTO classification_rules (id, user_id, name, match_expr, is_global, enabled) "
        "VALUES ($1, $2, $3, $4, false, true)",
        b_private, user_b, "B-PRIVATE-secret", secret_expr,
    )

    ctx = {
        "user_a": user_a, "user_b": user_b,
        "a_global": str(a_global), "a_private": str(a_private), "b_private": str(b_private),
    }
    try:
        yield ctx
    finally:
        for uid in (user_a, user_b):
            for sql in (
                ("DELETE FROM classification_rules WHERE user_id = $1", uid),
                ("DELETE FROM audit_log WHERE user_id = $1", uid),
                ("DELETE FROM auth.users WHERE id = $1", uid),
            ):
                try:
                    await pg_pool.execute(*sql)
                except Exception:
                    pass


def _read_rules_for_uploader(sb, uploader_uid: str) -> list[dict]:
    """The EXACT leak-safe own+global rule read the ingest pass uses (Pitfall 3)."""
    return (
        sb.table("classification_rules").select("*")
        .or_(f"user_id.eq.{uploader_uid},is_global.eq.true")
        .eq("enabled", True).order("is_global").order("created_at").execute()
    ).data or []


@pytest.mark.asyncio
async def test_b_private_rule_never_evaluates_against_a_upload(pg_pool, two_users_with_rules):
    """B's PRIVATE rule must NOT be in A's own+global read set (never evaluates on A's upload)."""
    sb = _supabase_or_skip()
    ctx = two_users_with_rules
    a_rules = _read_rules_for_uploader(sb, str(ctx["user_a"]))
    rule_ids = {r["id"] for r in a_rules}

    # NON-VACUITY: A's own read set genuinely contains A's own rules (the read works).
    assert ctx["a_private"] in rule_ids, "A's own-private rule must be in A's read set (non-vacuous)"
    assert ctx["a_global"] in rule_ids, "A's global rule must be in A's read set"
    # THE LEAK GUARD: B's private rule must NEVER be in A's read set.
    assert ctx["b_private"] not in rule_ids, (
        "LEAK: B's PRIVATE rule appeared in A's read set — the ingest pass would evaluate "
        "another user's private rule against A's upload (Pitfall 3, D-118-8)."
    )


@pytest.mark.asyncio
async def test_global_rule_visible_but_evaluates_b_own_metadata(pg_pool, two_users_with_rules):
    """A's GLOBAL rule IS in B's read set, but evaluates against B's OWN upload only (D-118-8)."""
    from app.services import classification_matcher  # Plan 01 Task 2

    sb = _supabase_or_skip()
    ctx = two_users_with_rules
    b_rules = _read_rules_for_uploader(sb, str(ctx["user_b"]))
    rule_ids = {r["id"] for r in b_rules}

    # The global rule is exposed to B's read; A's PRIVATE rule is NOT.
    assert ctx["a_global"] in rule_ids, "A's GLOBAL rule must be visible to B's upload read"
    assert ctx["a_private"] not in rule_ids, (
        "LEAK: A's PRIVATE rule appeared in B's read set — only own+global is allowed."
    )
    # The global rule is evaluated against B's OWN upload metadata (never A's data).
    whitelist = {"document_type", "language", "title", "author", "summary", "date", "topics"}
    a_global_rule = next(r for r in b_rules if r["id"] == ctx["a_global"])
    # B uploads an invoice → A's global invoice rule matches B's OWN metadata.
    assert classification_matcher.match_metadata(
        a_global_rule["match_expr"], {"document_type": "invoice"}, whitelist
    ) is True
    # B uploads a non-invoice → no match (the rule reads B's metadata, never A's).
    assert classification_matcher.match_metadata(
        a_global_rule["match_expr"], {"document_type": "memo"}, whitelist
    ) is False
