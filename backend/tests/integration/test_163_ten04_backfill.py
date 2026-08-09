"""Phase 163 TEN-04 — migration 107 applied-state contract (RED until plan 163-05 applies it).

Encodes the exact post-apply shape migration ``107_ten04_chunk_embedding_org_id.sql`` must
produce on the two pgvector HOT tables ``document_chunks`` + ``skill_embeddings``:

  (a) ``org_id`` column exists and is NOT NULL on BOTH tables (information_schema.columns);
  (b) ZERO rows have ``org_id IS NULL`` in either table (the backfill filled every row);
  (c) a btree index on ``org_id`` exists for each table (pg_indexes);
  (d) REGRESSION GUARD — the document_chunks HNSW (``document_chunks_embedding_idx``) and
      GIN (``document_chunks_search_vector_idx``) vector indexes STILL exist and are untouched
      (the migration must never drop/recreate the pgvector indexes — CONCUR-01);
  (e) the mig-106 BEFORE-INSERT autofill trigger exists on BOTH tables (pg_trigger), so future
      chunk/embedding INSERTs auto-fill org_id from the parent FK.

STATE CONTRACT: this test is RED *now* (migration 107 is authored in plan 163-02 but NOT applied
— ``document_chunks.org_id`` does not exist yet, so the column/null/index/trigger asserts fail).
It goes GREEN in plan 163-05 after the operator applies 107 to the live local DB. For THIS plan
the acceptance bar is ``pytest ... --collect-only`` succeeding (imports resolve) — do NOT try to
make it pass green here (the migration is deliberately not applied yet).

Live-DB harness: reuses the shared plan-01 substrate (``_rls_harness`` skip-guard + the conftest
``pg_pool`` fixture). Skips cleanly when local Postgres :54322 is unreachable.
"""
from __future__ import annotations

import pytest

from tests.integration._rls_harness import requires_pg

# Whole module skips when the local Postgres :54322 is down (mirrors test_111_1_reembed_rls).
# The conftest ``pg_pool`` fixture ALSO skips, but a module-level guard keeps a stack-down run clean.
pytestmark = requires_pg


# ── the applied-state contract, as named constants (the shape plan 163-05 must satisfy) ──

# The two pgvector tables mig 104 deferred to 163 (104:442-443).
_TARGET_TABLES = ("document_chunks", "skill_embeddings")

# btree(org_id) index names the migration creates (§4).
_ORG_ID_BTREE = {
    "document_chunks": "idx_document_chunks_org_id",
    "skill_embeddings": "idx_skill_embeddings_org_id",
}

# The document_chunks vector indexes that MUST survive untouched (full-schema.sql:2572 / :2579).
_HNSW_INDEX = "document_chunks_embedding_idx"          # USING hnsw (embedding vector_cosine_ops)
_GIN_INDEX = "document_chunks_search_vector_idx"       # USING gin (search_vector)

# The mig-106 BEFORE-INSERT autofill triggers the migration attaches (§5).
_AUTOFILL_TRIGGER = {
    "document_chunks": "document_chunks_autofill_org_id",
    "skill_embeddings": "skill_embeddings_autofill_org_id",
}


# ── introspection helpers (pure SQL against the live DB — no app code, no MagicMock) ──

async def _column_is_nullable(pool, table: str, column: str) -> str | None:
    """Return 'YES' / 'NO' from information_schema, or None if the column does not exist."""
    return await pool.fetchval(
        "SELECT is_nullable FROM information_schema.columns "
        "WHERE table_schema='public' AND table_name=$1 AND column_name=$2",
        table, column,
    )


async def _null_org_id_count(pool, table: str) -> int:
    # Parameterising a table name is not possible; the name comes from the module-local
    # allow-list _TARGET_TABLES (never user input), so the format() is injection-safe.
    assert table in _TARGET_TABLES, f"refusing to query non-allow-listed table {table!r}"
    return await pool.fetchval(
        f"SELECT count(*) FROM public.{table} WHERE org_id IS NULL"
    )


async def _index_def(pool, table: str, indexname: str) -> str | None:
    """Return the CREATE INDEX definition string, or None if the index is absent."""
    return await pool.fetchval(
        "SELECT indexdef FROM pg_indexes "
        "WHERE schemaname='public' AND tablename=$1 AND indexname=$2",
        table, indexname,
    )


async def _trigger_exists(pool, table: str, trigger: str) -> bool:
    """True if a NON-internal trigger named ``trigger`` is attached to public.``table``."""
    return bool(await pool.fetchval(
        "SELECT EXISTS ("
        "  SELECT 1 FROM pg_trigger tg "
        "  JOIN pg_class c ON c.oid = tg.tgrelid "
        "  JOIN pg_namespace n ON n.oid = c.relnamespace "
        "  WHERE n.nspname='public' AND c.relname=$1 AND tg.tgname=$2 AND NOT tg.tgisinternal"
        ")",
        table, trigger,
    ))


# ── (a) org_id column exists AND is NOT NULL on both tables ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _TARGET_TABLES)
async def test_org_id_column_is_not_null(pg_pool, table):
    nullable = await _column_is_nullable(pg_pool, table, "org_id")
    assert nullable is not None, (
        f"{table}.org_id column is missing - migration 107 not applied yet "
        f"(expected RED until plan 163-05)."
    )
    assert nullable == "NO", (
        f"{table}.org_id must be NOT NULL after the self-guarded flip, got is_nullable={nullable!r}"
    )


# ── (b) zero rows with org_id IS NULL (the parent-FK backfill filled every row) ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _TARGET_TABLES)
async def test_zero_null_org_id(pg_pool, table):
    n = await _null_org_id_count(pg_pool, table)
    assert n == 0, f"{table} has {n} rows with org_id IS NULL - backfill incomplete (T-163-BF)"


# ── (c) a btree index on org_id exists for each table ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _TARGET_TABLES)
async def test_btree_org_id_index_present(pg_pool, table):
    indexname = _ORG_ID_BTREE[table]
    definition = await _index_def(pg_pool, table, indexname)
    assert definition is not None, f"btree index {indexname} on {table} is absent (migration 107 sec.4)"
    lower = definition.lower()
    assert "btree" in lower and "org_id" in lower, (
        f"{indexname} is not a btree(org_id) index: {definition!r}"
    )


# ── (d) REGRESSION GUARD — the document_chunks HNSW + GIN vector indexes are untouched ──

@pytest.mark.asyncio
async def test_hnsw_vector_index_untouched(pg_pool):
    definition = await _index_def(pg_pool, "document_chunks", _HNSW_INDEX)
    assert definition is not None, (
        f"{_HNSW_INDEX} (HNSW) missing - the migration must NEVER drop the pgvector index (CONCUR-01)"
    )
    assert "hnsw" in definition.lower(), f"{_HNSW_INDEX} is no longer an HNSW index: {definition!r}"


@pytest.mark.asyncio
async def test_gin_search_vector_index_untouched(pg_pool):
    definition = await _index_def(pg_pool, "document_chunks", _GIN_INDEX)
    assert definition is not None, (
        f"{_GIN_INDEX} (GIN) missing - the migration must NEVER drop the full-text index"
    )
    assert "gin" in definition.lower(), f"{_GIN_INDEX} is no longer a GIN index: {definition!r}"


# ── (e) the mig-106 BEFORE-INSERT autofill trigger is attached to both tables ──

@pytest.mark.asyncio
@pytest.mark.parametrize("table", _TARGET_TABLES)
async def test_autofill_trigger_attached(pg_pool, table):
    trigger = _AUTOFILL_TRIGGER[table]
    assert await _trigger_exists(pg_pool, table, trigger), (
        f"autofill trigger {trigger} absent on {table} - future INSERTs won't auto-fill org_id (T-163-05)"
    )
