"""Phase 140 Plan 01 (TRIG-02) — LIVE-DB gate for migration 091 (skill_embeddings).

DB-CHECK suite proving every DDL object authored in
``supabase/migrations/091_skill_embeddings.sql`` physically exists in the live local
Supabase DB (:54322): the ``skill_embeddings`` table (with a pgvector ``embedding`` column
+ a NOT NULL ``source_text_hash``), its owner-only RLS SELECT policy, the ``match_skills``
cosine RPC, the two mark-stale triggers (``stale_skill_embedding`` on ``skills`` and
``stale_skill_embedding_from_case`` on ``skill_test_cases``), and the
``app_settings.skill_catalog_max_tokens`` budget column (integer, DEFAULT 1500). These are
DB-level structural gates the app code cannot fabricate — a mock store cannot reproduce a
trigger firing or an RPC's WHERE-clause scope — so the only honest proof is a psycopg2 query
against the real catalog.

STATUS — EXPECTED RED UNTIL PLAN 05: migration 091 is AUTHORED in Plan 01 but is NOT applied
to the live DB here. The live-DB apply is the [BLOCKING] Plan 05 (autonomous:false — apply via
the Supabase SQL editor / psycopg2-direct to :54322; NEVER the destructive reset/push CLI). So
these assertions are RED (failing) right now BY DESIGN and flip GREEN only after migration 091
is applied to the live local DB — see 140-05-PLAN. The ONLY clean skip is when :54322 is
unreachable (no live DB to gate); a reachable-but-unapplied DB is the intended RED state.

All queries are read-only catalog lookups (information_schema / pg_proc / pg_trigger /
pg_policies) on a read-only autocommit connection — the suite never writes and never mutates
dev data. Skips gracefully when :54322 is unreachable (mirrors the reembed DB-check guard).
"""

import os

import psycopg2
import pytest


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = psycopg2.connect(dsn, connect_timeout=2)
        conn.close()
        return True
    except Exception:
        return False


PG_AVAILABLE = _pg_reachable()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=(
        f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 140 "
        "migration-091 DB-CHECK (expected RED until Plan 05 applies migration 091)"
    ),
)


@pytest.fixture
def pg_conn():
    """Read-only, autocommit psycopg2 connection to local Postgres :54322 (catalog lookups only)."""
    conn = psycopg2.connect(_POSTGRES_TEST_DSN, connect_timeout=5)
    conn.set_session(readonly=True, autocommit=True)
    try:
        yield conn
    finally:
        conn.close()


def test_skill_embeddings_table(pg_conn):
    """public.skill_embeddings exists with a pgvector `embedding` column + NOT NULL `source_text_hash`."""
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT column_name, udt_name, is_nullable
              FROM information_schema.columns
             WHERE table_schema = 'public' AND table_name = 'skill_embeddings'
            """
        )
        cols = {row[0]: (row[1], row[2]) for row in cur.fetchall()}

    assert cols, (
        "table public.skill_embeddings is absent — migration 091 not applied to the live DB "
        "(EXPECTED RED until Plan 05; see 140-05-PLAN)"
    )
    assert "embedding" in cols, "skill_embeddings must have an `embedding` column"
    assert cols["embedding"][0] == "vector", (
        f"skill_embeddings.embedding must be a pgvector `vector` type; got udt {cols['embedding'][0]!r}"
    )
    assert "source_text_hash" in cols, "skill_embeddings must have a `source_text_hash` column"
    assert cols["source_text_hash"][1] == "NO", (
        "skill_embeddings.source_text_hash must be NOT NULL (staleness fingerprint)"
    )
    # skill_id PK + user_id owner scope are load-bearing for the RPC join + hand-scoped writes (V4).
    assert "skill_id" in cols, "skill_embeddings must have a `skill_id` column (PK / FK to skills)"
    assert "user_id" in cols, "skill_embeddings must have a `user_id` column (owner scope, V4)"


def test_match_skills_rpc(pg_conn):
    """public.match_skills exists and returns a (id, name, description, similarity) TABLE."""
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT pg_get_function_result(p.oid)
              FROM pg_proc p
              JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'match_skills'
            """
        )
        rows = cur.fetchall()

    assert rows, (
        "function public.match_skills is absent — migration 091 not applied to the live DB "
        "(EXPECTED RED until Plan 05; see 140-05-PLAN)"
    )
    result_sig = rows[0][0] or ""
    for expected in ("id", "name", "description", "similarity"):
        assert expected in result_sig, (
            f"match_skills result signature must expose `{expected}`; got: {result_sig!r}"
        )


def test_stale_triggers(pg_conn):
    """Both mark-stale triggers exist: stale_skill_embedding (skills) + _from_case (skill_test_cases)."""
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT t.tgname, c.relname
              FROM pg_trigger t
              JOIN pg_class c     ON c.oid = t.tgrelid
              JOIN pg_namespace n ON n.oid = c.relnamespace
             WHERE n.nspname = 'public'
               AND NOT t.tgisinternal
               AND t.tgname IN ('stale_skill_embedding', 'stale_skill_embedding_from_case')
            """
        )
        triggers = {row[0]: row[1] for row in cur.fetchall()}

    assert triggers.get("stale_skill_embedding") == "skills", (
        "trigger stale_skill_embedding must exist on public.skills — migration 091 not applied "
        "(EXPECTED RED until Plan 05; see 140-05-PLAN)"
    )
    assert triggers.get("stale_skill_embedding_from_case") == "skill_test_cases", (
        "trigger stale_skill_embedding_from_case must exist on public.skill_test_cases — "
        "migration 091 not applied (EXPECTED RED until Plan 05; see 140-05-PLAN)"
    )


def test_budget_column(pg_conn):
    """app_settings.skill_catalog_max_tokens exists as integer with DEFAULT 1500 (D-04 kill switch)."""
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT data_type, column_default
              FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'app_settings'
               AND column_name = 'skill_catalog_max_tokens'
            """
        )
        row = cur.fetchone()

    assert row is not None, (
        "column app_settings.skill_catalog_max_tokens is absent — migration 091 not applied to "
        "the live DB (EXPECTED RED until Plan 05; see 140-05-PLAN)"
    )
    data_type, column_default = row
    assert data_type == "integer", (
        f"skill_catalog_max_tokens must be integer; got {data_type!r}"
    )
    assert column_default is not None and "1500" in column_default, (
        f"skill_catalog_max_tokens must DEFAULT 1500 (D-04); got default {column_default!r}"
    )


def test_owner_only_rls_policy(pg_conn):
    """An owner-only SELECT RLS policy (auth.uid() = user_id) exists on public.skill_embeddings."""
    with pg_conn.cursor() as cur:
        cur.execute(
            """
            SELECT policyname, cmd, qual
              FROM pg_policies
             WHERE schemaname = 'public' AND tablename = 'skill_embeddings'
            """
        )
        policies = cur.fetchall()

    assert policies, (
        "no RLS policy on public.skill_embeddings — migration 091 not applied to the live DB "
        "(EXPECTED RED until Plan 05; see 140-05-PLAN)"
    )
    select_policies = [p for p in policies if p[1] in ("SELECT", "ALL")]
    assert select_policies, "skill_embeddings must have a SELECT (owner-only) RLS policy"
    owner_scoped = [
        p for p in select_policies
        if p[2] and "auth.uid()" in p[2] and "user_id" in p[2]
    ]
    assert owner_scoped, (
        "the skill_embeddings SELECT policy must be owner-scoped (auth.uid() = user_id); "
        f"got quals: {[p[2] for p in select_policies]!r}"
    )
