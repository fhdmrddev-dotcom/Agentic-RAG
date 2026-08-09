"""Phase 118 — CLASS-02 non-vacuous regression test.

Closes AR-118-03 (118-SECURITY.md): the two existing ingest-suggest tests are VACUOUS
because they re-implement the rule-read + match loop in-test and never call
``ingest_document()``.  This file drives the REAL ``ingest_document()`` function against a
seeded doc in the live :54322 DB, then re-SELECTs the persisted row and asserts on the
actual stored columns.

Tests
-----
test_real_ingest_writes_classification_never_moves
    A matching enabled rule must write ``metadata._classification`` (status="suggested")
    into the persisted row and MUST NOT change ``documents.folder_id`` (the milestone
    anti-feature / D-118-2 no-silent-move invariant).

test_real_ingest_never_blocks_on_bad_rule
    When every enabled rule is malformed (unknown op) the try/except at
    ``documents.py:1883-1901`` swallows the error; the doc still reaches
    ``status="completed"`` with NO ``_classification`` key in its metadata.

Both tests are NON-VACUOUS: they call ``ingest_document(document_id=..., text=...,
user_id=..., supabase=<service-role>)`` with two heavy seams patched (``embed_chunks``
and ``extract_metadata``) to avoid network I/O, then assert on the PERSISTED row via
asyncpg re-SELECT.
"""

import asyncio
import json
import os
from unittest.mock import patch
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio


# ---------------------------------------------------------------------------
# Reachability guard (mirrors test_118_ingest_suggest.py)
# ---------------------------------------------------------------------------

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
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(_pg_reachable())
        finally:
            loop.close()
    except Exception:
        return False


PG_AVAILABLE = _check_pg_available_sync()
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 118 real-splice tests",
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def _table_exists(pool, table: str) -> bool:
    return bool(await pool.fetchval(
        "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
        "WHERE table_schema='public' AND table_name=$1)",
        table,
    ))


def _read_local_supabase_creds():
    """Return (url, key) from backend/.env or None if absent."""
    env_path = os.path.join(os.path.dirname(__file__), "..", "..", ".env")
    if not os.path.exists(env_path):
        return None
    url = key = None
    try:
        with open(env_path, encoding="utf-8") as fh:
            for raw in fh:
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                if k == "SUPABASE_URL":
                    url = v
                elif k == "SUPABASE_SERVICE_ROLE_KEY":
                    key = v
    except OSError:
        return None
    if not url or not key:
        return None
    return url, key


def _supabase_service_client_or_skip():
    """Build a service-role supabase Client or pytest.skip() if unavailable."""
    creds = _read_local_supabase_creds()
    if creds is None:
        pytest.skip("backend/.env missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
    url, key = creds
    try:
        from supabase import create_client
        client = create_client(url, key)
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"supabase client unavailable: {exc}")
    # Quick liveness check
    try:
        client.table("classification_rules").select("id").limit(1).execute()
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"local Supabase REST unreachable: {exc}")
    return client


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

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
async def ingest_seed(pg_pool):
    """Seed user + folder + matching rule + doc (folder_id=NULL, status='pending')."""
    if not await _table_exists(pg_pool, "classification_rules"):
        pytest.skip("classification_rules table absent")

    user_id = uuid4()
    folder_id = uuid4()
    rule_id = uuid4()
    doc_id = uuid4()

    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-118-real-splice-{user_id}@test.local",
    )
    await pg_pool.execute(
        "INSERT INTO public.folders (id, user_id, name, is_org_shared) VALUES ($1, $2, $3, false)",
        folder_id, user_id, "Invoices",
    )
    await pg_pool.execute(
        "INSERT INTO classification_rules "
        "(id, user_id, name, match_expr, suggest_folder_id, is_system_global, enabled) "
        "VALUES ($1, $2, $3, $4, $5, false, true)",
        rule_id, user_id, "Invoices",
        {"op": "and", "conditions": [{"field": "document_type", "op": "eq", "value": "invoice"}]},
        folder_id,
    )
    await pg_pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7)",
        doc_id, user_id, "invoice-42.txt", f"{user_id}/invoice-42.txt", 512, "text/plain", "pending",
    )

    ctx = {
        "user_id": user_id,
        "folder_id": folder_id,
        "rule_id": rule_id,
        "doc_id": doc_id,
    }
    try:
        yield ctx
    finally:
        # Teardown: child rows first, then parent rows
        for sql in (
            ("DELETE FROM document_chunks WHERE user_id = $1", user_id),
            ("DELETE FROM classification_rules WHERE user_id = $1", user_id),
            ("DELETE FROM documents WHERE user_id = $1", user_id),
            ("DELETE FROM public.folders WHERE user_id = $1", user_id),
            ("DELETE FROM audit_log WHERE user_id = $1", user_id),
            ("DELETE FROM auth.users WHERE id = $1", user_id),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


@pytest_asyncio.fixture
async def ingest_seed_bad_rule(pg_pool):
    """Seed user + folder + MALFORMED rule (unknown op 'xor') + doc (folder_id=NULL)."""
    if not await _table_exists(pg_pool, "classification_rules"):
        pytest.skip("classification_rules table absent")

    user_id = uuid4()
    folder_id = uuid4()
    rule_id = uuid4()
    doc_id = uuid4()

    await pg_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-118-bad-rule-{user_id}@test.local",
    )
    await pg_pool.execute(
        "INSERT INTO public.folders (id, user_id, name, is_org_shared) VALUES ($1, $2, $3, false)",
        folder_id, user_id, "BadFolder",
    )
    await pg_pool.execute(
        "INSERT INTO classification_rules "
        "(id, user_id, name, match_expr, suggest_folder_id, is_system_global, enabled) "
        "VALUES ($1, $2, $3, $4, $5, false, true)",
        rule_id, user_id, "Bad Rule",
        # "xor" is not a valid op → ViewFilter.model_validate raises ValidationError
        {"op": "and", "conditions": [{"field": "document_type", "op": "xor", "value": "invoice"}]},
        folder_id,
    )
    await pg_pool.execute(
        "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7)",
        doc_id, user_id, "bad-rule-test.txt", f"{user_id}/bad-rule-test.txt", 512, "text/plain", "pending",
    )

    ctx = {
        "user_id": user_id,
        "folder_id": folder_id,
        "rule_id": rule_id,
        "doc_id": doc_id,
    }
    try:
        yield ctx
    finally:
        for sql in (
            ("DELETE FROM document_chunks WHERE user_id = $1", user_id),
            ("DELETE FROM classification_rules WHERE user_id = $1", user_id),
            ("DELETE FROM documents WHERE user_id = $1", user_id),
            ("DELETE FROM public.folders WHERE user_id = $1", user_id),
            ("DELETE FROM audit_log WHERE user_id = $1", user_id),
            ("DELETE FROM auth.users WHERE id = $1", user_id),
        ):
            try:
                await pg_pool.execute(*sql)
            except Exception:
                pass


# ---------------------------------------------------------------------------
# Patch factories
# ---------------------------------------------------------------------------

def _make_fake_embed_chunks(n_dims: int = 1536):
    """Return a drop-in for embed_chunks that returns fake zero-vectors (no network).

    The document_chunks table enforces vector(1536) dimensions — use 1536 zeros.
    """
    def _fake(chunks, model=None, user_settings=None):
        return [[0.0] * n_dims for _ in chunks]
    return _fake


async def _fake_extract_metadata_enriched_invoice(**kwargs):
    """Async stand-in for extract_metadata_enriched that returns document_type=invoice.

    This is called as asyncio.run(extract_metadata_enriched(...)) inside the sync
    ingest_document function running in a thread.  The coroutine must be awaitable.
    The returned dict shape mirrors the real forced_emit result.
    """
    from app.models.document import DocumentMetadata
    # Build a minimal model with document_type="invoice"; model_dump(exclude_none=True)
    # will produce {"document_type": "invoice"}.
    emitted = DocumentMetadata(document_type="invoice")
    return {"emitted": emitted}


async def _fake_extract_metadata_enriched_noop(**kwargs):
    """Async stand-in that returns emitted=None (simulates extraction failure/skip)."""
    return {"emitted": None}


def _run_ingest_in_thread(ingest_fn, **kwargs):
    """Run ingest_document (sync) in the current thread (expected: already a worker thread).

    ingest_document calls asyncio.run() internally (for extract_metadata_enriched).
    When called directly from an async pytest test, asyncio.run() raises
    "RuntimeError: This event loop is already running" because the test's event loop
    is active on the main thread.

    Calling this via asyncio.to_thread() puts execution in a worker thread that has
    NO running event loop, so asyncio.run() succeeds normally.

    unittest.mock.patch() patches module attribute dicts globally (not per-thread),
    so patches applied in the caller's `with patch(...)` context are visible here.
    """
    ingest_fn(**kwargs)


# ---------------------------------------------------------------------------
# Test 1 — real ingest writes _classification, NEVER changes folder_id
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_real_ingest_writes_classification_never_moves(pg_pool, ingest_seed):
    """NON-VACUOUS: drives real ingest_document(), asserts on PERSISTED documents row.

    Requirement CLASS-02 / AR-118-03 closure:
    - metadata._classification.status == "suggested" (splice wrote the suggestion)
    - metadata._classification.suggested_folder_id == seeded folder_id
    - documents.folder_id IS STILL NULL (no silent move — D-118-2 anti-feature)
    """
    sb = _supabase_service_client_or_skip()
    ctx = ingest_seed

    text = "Invoice #42 from Acme Corp. Total due: $1,500.00. Payment terms: Net 30."

    # Patch strategy:
    # 1. embed_chunks → fake 1536-dim zeros (no embedding provider contacted)
    # 2. extract_metadata_enriched → fake async fn returning document_type="invoice"
    #    (the enriched branch is the DEFAULT path; we patch it to return deterministic data
    #    without hitting any LLM provider, which avoids the asyncio.run-inside-async-test
    #    conflict by running ingest_document in a thread pool worker — see _run_ingest_in_thread)
    # 3. No patching of load_app_settings needed — the real settings are fine; the enriched
    #    branch calls asyncio.run(extract_metadata_enriched(...)) which works in the thread.
    with (
        patch("app.api.documents.embed_chunks", side_effect=_make_fake_embed_chunks()),
        patch(
            "app.services.embedding_service.extract_metadata_enriched",
            new=_fake_extract_metadata_enriched_invoice,
        ),
    ):
        from app.api.documents import ingest_document
        # Run ingest_document in a worker thread so asyncio.run() inside it gets a
        # fresh event loop (the test's loop is on the main thread, not the worker).
        await asyncio.to_thread(
            ingest_document,
            document_id=str(ctx["doc_id"]),
            text=text,
            user_id=str(ctx["user_id"]),
            supabase=sb,
            raw=b"",
            mime_type="",
        )

    # Re-SELECT the PERSISTED row — this is the non-vacuous assertion
    row = await pg_pool.fetchrow(
        "SELECT status, metadata, folder_id FROM documents WHERE id = $1",
        ctx["doc_id"],
    )
    assert row is not None, "document row must exist after ingest"

    # (a) Ingest must complete successfully
    assert row["status"] == "completed", (
        f"expected status='completed', got '{row['status']}'"
    )

    # (b) metadata._classification must be written by the splice
    meta = row["metadata"] or {}
    assert "_classification" in meta, (
        f"metadata must contain '_classification' key after matching rule; got keys: {list(meta.keys())}"
    )
    classification = meta["_classification"]
    assert classification["status"] == "suggested", (
        f"_classification.status must be 'suggested', got: {classification.get('status')!r}"
    )
    assert classification["suggested_folder_id"] == str(ctx["folder_id"]), (
        f"_classification.suggested_folder_id must point to seeded folder {ctx['folder_id']}, "
        f"got: {classification.get('suggested_folder_id')!r}"
    )

    # (c) THE LOAD-BEARING NO-SILENT-MOVE ASSERTION:
    # folder_id must remain NULL — the splice MUST NEVER write folder_id
    assert row["folder_id"] is None, (
        f"REGRESSION: ingest_document() CHANGED folder_id to {row['folder_id']!r}; "
        "the classification splice must NEVER write folder_id (D-118-2 anti-feature)"
    )


# ---------------------------------------------------------------------------
# Test 2 — real ingest swallows bad-rule error, doc still completes
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_real_ingest_never_blocks_on_bad_rule(pg_pool, ingest_seed_bad_rule):
    """NON-VACUOUS: drives real ingest_document() with a malformed rule.

    Requirement CLASS-02 / AR-118-03 closure:
    - The try/except at documents.py:1883-1901 swallows the matcher ValidationError
    - The doc reaches status='completed' (ingest was NOT blocked)
    - '_classification' is absent from metadata (degraded to no suggestion)
    """
    sb = _supabase_service_client_or_skip()
    ctx = ingest_seed_bad_rule

    text = "Invoice #99 from Bad Corp. This rule should fail to parse."

    with (
        patch("app.api.documents.embed_chunks", side_effect=_make_fake_embed_chunks()),
        patch(
            "app.services.embedding_service.extract_metadata_enriched",
            new=_fake_extract_metadata_enriched_invoice,
        ),
    ):
        from app.api.documents import ingest_document
        await asyncio.to_thread(
            ingest_document,
            document_id=str(ctx["doc_id"]),
            text=text,
            user_id=str(ctx["user_id"]),
            supabase=sb,
            raw=b"",
            mime_type="",
        )

    # Re-SELECT the PERSISTED row — non-vacuous assertion
    row = await pg_pool.fetchrow(
        "SELECT status, metadata, folder_id FROM documents WHERE id = $1",
        ctx["doc_id"],
    )
    assert row is not None, "document row must exist after ingest"

    # (a) Ingest must NOT be blocked — doc completes despite bad rule
    assert row["status"] == "completed", (
        f"REGRESSION: bad rule BLOCKED ingest; expected status='completed', got '{row['status']}'"
    )

    # (b) No suggestion written — the try/except swallowed the error, so no _classification
    meta = row["metadata"] or {}
    assert "_classification" not in meta, (
        f"REGRESSION: '_classification' present even though the rule AST is malformed; "
        f"got: {meta.get('_classification')!r}"
    )
