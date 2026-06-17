"""Phase 112 Plan 02 — re-extract merge guard preserves human edits (META-05, AC7).

LIVE :54322. AC7 of SPEC + Pitfall 1/2.

This test drives the REAL `ingest_document` (the SINGLE metadata-write site) so it
genuinely exercises the Phase-112 D-03 merge guard — NOT a hand-written post-guard
stand-in. The extraction + embedding boundaries are monkeypatched to keep the test
hermetic (no LLM / no OpenAI embedding network call), but chunking, the merge guard,
the prior-_source read, and the documents UPDATE are all the production code path.

Contract proven:
  - Edit field A is preserved (value + _source='user') across a re-extract whose fresh
    extraction would otherwise overwrite A.
  - An un-edited extracted field B IS refreshed from the (fresh) extraction.
  - A preserved user field carries NO _confidence entry (the chip renders neutral
    "Edited", never a fabricated model score).
  - A degrade (extraction returns None) does NOT wipe the human edit (Pitfall 2:
    metadata_dict None -> {} before the user-field loop).
  - A cleared field (top-level key absent but _source.A=='user') stays cleared after
    re-extract (the model is not allowed to re-add it).
  - The guard reads the PRIOR doc's _source map, never a request-scoped `body` field
    (Pitfall 1 — there is no `body` in ingest_document's scope, structurally enforced).

Live-DB harness copied verbatim from test_111_flat_filter_compat.py /
test_112_flat_filter_with_source.py. Skips when :54322 unreachable or service-role
creds are absent.
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
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping live 112 merge tests",
)


# ---------------------------------------------------------------------------
# Service-role supabase client (the REST client ingest_document writes through).
# Pattern copied from test_112_patch_audit.py / test_112_patch_rls.py.
# ---------------------------------------------------------------------------
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
        client.table("documents").select("id").limit(1).execute()
    except Exception as e:  # noqa: BLE001
        pytest.skip(f"supabase service-role client cannot reach documents table: {type(e).__name__}: {e}")
    return client


@pytest_asyncio.fixture
async def pg_pool():
    async def _init(conn):
        await conn.set_type_codec(
            "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog",
        )
    pool = await asyncpg.create_pool(
        _POSTGRES_TEST_DSN, min_size=1, max_size=4, init=_init,
    )
    try:
        yield pool
    finally:
        await pool.close()


# ---------------------------------------------------------------------------
# Hermetic extraction / embedding boundary patches so driving the REAL
# ingest_document makes no LLM / OpenAI-embedding network call. The MERGE GUARD,
# chunking, the prior-_source read and the documents UPDATE remain production code.
# ---------------------------------------------------------------------------
def _patch_ingest_boundaries(monkeypatch, *, fresh_extraction: dict | None):
    """Force legacy enrichment mode (so extract_metadata is the extraction seam),
    stub extract_metadata to a deterministic result, and stub the embedding step.

    fresh_extraction=None models the degrade case (extract_metadata -> None).
    """
    from app.api import documents as docs_mod
    from app.models.document import DocumentMetadata

    class _FakeSettings:
        # Only the attributes ingest_document reads off app_settings.
        metadata_enrichment_mode = "legacy"   # -> extract_metadata(text) seam
        extraction_model = None
        extraction_window_cap = 32000
        extraction_provider = ""
        embedding_model = "text-embedding-3-small"
        embedding_dimensions = 1536

    monkeypatch.setattr(docs_mod, "load_app_settings", lambda: _FakeSettings())

    def _fake_extract_metadata(content, model=None):
        if fresh_extraction is None:
            return None  # degrade: layer-2 produces metadata_dict=None
        # DocumentMetadata only carries the 7 built-ins; the guard restores the
        # user field regardless. Use the model so model_dump(exclude_none=True) runs.
        return DocumentMetadata(**{
            k: v for k, v in fresh_extraction.items()
            if k in DocumentMetadata.model_fields
        })

    monkeypatch.setattr(docs_mod, "extract_metadata", _fake_extract_metadata)

    # Hermetic embedding: one deterministic 1536-d zero vector per chunk, no network.
    monkeypatch.setattr(docs_mod, "chunk_text", lambda text, *a, **k: ["merge-probe chunk"])
    monkeypatch.setattr(
        docs_mod, "embed_chunks",
        lambda chunks, model=None, user_settings=None: [[0.0] * 1536 for _ in chunks],
    )


@pytest_asyncio.fixture
async def seeded_doc(pg_pool):
    """Seed a throwaway user + a documents row carrying a human-edited field A
    (with _source) plus an extracted field B and a _confidence map. The merge guard
    reads the prior _source map off THIS row."""
    user_id = uuid4()
    doc_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-112-merge-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            doc_id, user_id, "merge-probe.txt", f"{user_id}/merge-probe.txt",
            123, "text/plain", "completed",
            {
                "title": "Human Edited Title",        # field A (user)
                "document_type": "report",             # field B (extracted)
                "_confidence": {"document_type": 0.91, "title": 0.88},
                "_source": {"title": "user"},
            },
        )
    except Exception as e:
        pytest.skip(f"seeded_doc fixture setup failed: {type(e).__name__}: {e}")
    yield (user_id, doc_id)
    for sql in (
        ("DELETE FROM document_chunks WHERE document_id = $1", doc_id),
        ("DELETE FROM documents WHERE id = $1", doc_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_reextract_preserves_user_field_and_refreshes_extracted(
    pg_pool, seeded_doc, monkeypatch
):
    """AC7 — drive the REAL ingest_document: the human-edited field A is preserved
    (value + _source='user', NO _confidence) while an extracted field B is refreshed."""
    from app.api.documents import ingest_document

    user_id, doc_id = seeded_doc
    supabase = _supabase_or_skip()

    # Fresh extraction would overwrite title; the guard must keep the human value.
    _patch_ingest_boundaries(
        monkeypatch,
        fresh_extraction={"title": "Re-Extracted Title", "document_type": "memo"},
    )

    # The REAL single metadata-write site runs the merge guard before the UPDATE.
    ingest_document(str(doc_id), "merge probe text body", str(user_id), supabase)

    row = await pg_pool.fetchrow("SELECT metadata FROM documents WHERE id = $1", doc_id)
    meta = row["metadata"] or {}

    assert meta.get("title") == "Human Edited Title", \
        "user-edited field A must survive re-extract"
    assert meta.get("_source", {}).get("title") == "user", \
        "_source[A]='user' must persist"
    assert meta.get("document_type") == "memo", \
        "an un-edited extracted field B must be refreshed from the fresh extraction"
    # A human override carries no model score -> the chip renders neutral "Edited".
    assert "title" not in (meta.get("_confidence") or {}), \
        "a preserved user field must carry NO _confidence entry"


@pytest.mark.asyncio
async def test_reextract_degrade_does_not_wipe_user_edits(
    pg_pool, seeded_doc, monkeypatch
):
    """Pitfall 2 — when extraction degrades (returns None), the merge guard must
    promote None->{} and still restore the human-edited fields, never wiping them."""
    from app.api.documents import ingest_document

    user_id, doc_id = seeded_doc
    supabase = _supabase_or_skip()

    _patch_ingest_boundaries(monkeypatch, fresh_extraction=None)  # degrade

    ingest_document(str(doc_id), "merge probe text body", str(user_id), supabase)

    row = await pg_pool.fetchrow("SELECT metadata FROM documents WHERE id = $1", doc_id)
    meta = row["metadata"] or {}

    assert meta.get("title") == "Human Edited Title", \
        "a degrade must NOT wipe a human edit (None promoted to {})"
    assert meta.get("_source", {}).get("title") == "user"


@pytest_asyncio.fixture
async def seeded_doc_cleared(pg_pool):
    """Seed a row where the human CLEARED title (top-level key absent) but kept
    _source.title='user' — the merge guard must keep it cleared across re-extract."""
    user_id = uuid4()
    doc_id = uuid4()
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-112-clear-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO documents (id, user_id, filename, file_path, file_size, mime_type, status, metadata) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            doc_id, user_id, "merge-clear.txt", f"{user_id}/merge-clear.txt",
            123, "text/plain", "completed",
            {
                # title intentionally ABSENT (human cleared it) but marked user-owned.
                "document_type": "report",
                "_source": {"title": "user"},
            },
        )
    except Exception as e:
        pytest.skip(f"seeded_doc_cleared fixture setup failed: {type(e).__name__}: {e}")
    yield (user_id, doc_id)
    for sql in (
        ("DELETE FROM document_chunks WHERE document_id = $1", doc_id),
        ("DELETE FROM documents WHERE id = $1", doc_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:
            pass


@pytest.mark.asyncio
async def test_reextract_keeps_cleared_field_cleared(
    pg_pool, seeded_doc_cleared, monkeypatch
):
    """A human cleared field A (key absent, _source.A='user'): a fresh extraction that
    re-proposes A must NOT re-add it — the guard keeps it cleared (else: pop branch)."""
    from app.api.documents import ingest_document

    user_id, doc_id = seeded_doc_cleared
    supabase = _supabase_or_skip()

    _patch_ingest_boundaries(
        monkeypatch,
        fresh_extraction={"title": "Model Re-Proposed Title", "document_type": "memo"},
    )

    ingest_document(str(doc_id), "merge probe text body", str(user_id), supabase)

    row = await pg_pool.fetchrow("SELECT metadata FROM documents WHERE id = $1", doc_id)
    meta = row["metadata"] or {}

    assert "title" not in meta, \
        "a human-cleared field must stay cleared — the model may not re-add it"
    assert meta.get("_source", {}).get("title") == "user", \
        "the _source marker for the cleared field must persist"
    assert meta.get("document_type") == "memo", \
        "an un-edited extracted field is still refreshed"
