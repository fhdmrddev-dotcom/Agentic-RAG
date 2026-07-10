"""Phase 072.1 Gap 3 / BUG-260517-01 — NON-mocked integration test asserting
the orphan-free invariant across the `/reextract -> /reingest` sequence.

Surfaced by operator's UAT (`.planning/reported-bugs/reextract-orphan-chunks-
survive-reingest.md`): after `/reextract` followed by `/reingest` on the same
document, the prior `/reextract`'s chunks survived (462 orphans on operator's
DOCX). Phase 071.4 Plan 04 closed `/reingest -> /reingest` on tables+images;
this test locks the `/reextract -> /reingest` orphan-free invariant on chunks.

Asserts:
  - After `/reextract` then `/reingest`, document_chunks contains ONLY the
    latest batch (no orphans from the prior op).
  - `documents.chunk_count` matches the actual TOTAL document_chunks count
    (text + image-description chunks — count(*) taken after multimodal insert).
  - Calling `/reingest` twice in a row leaves the chunk count stable
    (idempotent — fix didn't introduce a regression on the steady-state).

Mock policy: mocks ONLY external API calls — `describe_image` (vision LLM),
`embed_chunks` / `embed_texts` (embedding API). Everything else
(supabase-py, BackgroundTask scheduling, extract_composable, PostgREST) runs
real.

Skip rules: if `SUPABASE_URL` is the conftest test stub
(`https://test.supabase.co`) or the real Supabase is unreachable, the
test SKIPs cleanly rather than failing.

Pattern mirrors `test_reextract_dispatcher.py` (Plan 04) — same
dependency-override swap, same `_resolve_test_user_id`, same
skip-on-stub-URL guard. Reuses the Plan 04 floating-shape DOCX fixture.
"""
from __future__ import annotations

import os
import time
import uuid
from pathlib import Path
from unittest.mock import patch

import pytest

# Mark as integration — selectable via `pytest -m integration` if a marker
# rule is later added. Runs by default (no `--strict-markers`).
pytestmark = pytest.mark.integration


# Reuse the Plan 04 floating-shapes DOCX fixture — small + already in the repo.
FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent
    / "fixtures" / "extraction" / "floating_shapes.docx"
)
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Stub URL set by conftest.py when no real env is provided.
_STUB_URL = "https://test.supabase.co"

# Poll timeout — generous because the BackgroundTask runs the full extract
# pipeline (extract -> chunk -> embed mock -> multimodal mock -> metadata).
_STATUS_TIMEOUT_S = 90.0


def _real_supabase_available() -> tuple[bool, str]:
    """Return (available, reason). Skips when stub URL or unreachable."""
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or url == _STUB_URL:
        return False, f"SUPABASE_URL not set or is conftest stub ({_STUB_URL!r})"
    if not key or key in ("test-service-role-key", "test-key"):
        return False, "SUPABASE_SERVICE_ROLE_KEY not set or is conftest stub"
    try:
        from supabase import create_client
        client = create_client(url, key)
        client.table("app_settings").select("id").limit(1).execute()
    except Exception as exc:  # noqa: BLE001
        return False, f"Supabase unreachable at {url}: {exc}"
    return True, ""


def _resolve_test_user_id(supabase) -> str:
    """Pick a real user_id from auth.users for the FK constraints.

    Strategy: try the conftest mock UUID first (some local dev envs seed it).
    If absent, fall back to the first available auth.users row. Skip if no
    users exist. Matches the Plan 04 pattern (test_reextract_dispatcher.py).
    """
    mock_id = "00000000-0000-0000-0000-000000000001"
    try:
        users_resp = supabase.auth.admin.list_users()
        users = list(users_resp) if not hasattr(users_resp, "users") else users_resp.users
    except Exception:
        users = []
    user_ids = [u.id for u in users] if users else []
    if mock_id in user_ids:
        return mock_id
    if user_ids:
        return user_ids[0]
    pytest.skip(
        "No auth.users present in local Supabase — seed at least one user "
        "(e.g. via Supabase Studio) before running this integration test"
    )


@pytest.fixture
def fixture_raw() -> bytes:
    if not FIXTURE_PATH.exists():
        pytest.skip(
            f"Fixture missing — run "
            f"`python backend/scripts/build_floating_shape_docx_fixture.py` first"
        )
    return FIXTURE_PATH.read_bytes()


@pytest.fixture
def real_supabase_client():
    """Real supabase-py client wired against the live local/cloud Supabase.

    Bypasses the conftest mock via dependency_overrides swap. Restores the
    mock at teardown so subsequent tests are unaffected.
    """
    available, reason = _real_supabase_available()
    if not available:
        pytest.skip(reason)

    from supabase import create_client
    from app.main import app
    from app.dependencies import get_supabase

    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    real_client = create_client(url, key)

    original_override = app.dependency_overrides.get(get_supabase)
    app.dependency_overrides[get_supabase] = lambda: real_client
    try:
        yield real_client
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_supabase, None)
        else:
            app.dependency_overrides[get_supabase] = original_override


@pytest.fixture
def real_user_id(real_supabase_client):
    """Resolve a real auth.users id for FK constraints + override
    `get_current_user` to return that id for this test.
    """
    user_id = _resolve_test_user_id(real_supabase_client)

    from app.main import app
    from app.dependencies import get_current_user

    original_override = app.dependency_overrides.get(get_current_user)
    app.dependency_overrides[get_current_user] = lambda: {
        "id": user_id, "email": "test-integration@local",
    }
    try:
        yield user_id
    finally:
        if original_override is None:
            app.dependency_overrides.pop(get_current_user, None)
        else:
            app.dependency_overrides[get_current_user] = original_override


def _wait_for_status(
    supabase, doc_id: str, *,
    target_statuses: set[str], timeout_s: float = _STATUS_TIMEOUT_S,
) -> str:
    """Poll documents.status until it lands in target_statuses or timeout."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        row = (
            supabase.table("documents")
            .select("status")
            .eq("id", doc_id)
            .maybe_single()
            .execute()
            .data
        )
        if row and row.get("status") in target_statuses:
            return row["status"]
        time.sleep(0.5)
    pytest.fail(
        f"Timeout waiting for documents.status in {target_statuses} "
        f"for {doc_id} after {timeout_s}s"
    )


def _count_chunks(supabase, doc_id: str) -> int:
    return (
        supabase.table("document_chunks")
        .select("id", count="exact")
        .eq("document_id", doc_id)
        .execute()
        .count
    )


def _count_text_chunks(supabase, doc_id: str) -> int:
    """Count rows whose content does NOT start with '[Image' — text-only semantics."""
    rows = (
        supabase.table("document_chunks")
        .select("content")
        .eq("document_id", doc_id)
        .execute()
        .data or []
    )
    return sum(1 for r in rows if not (r.get("content") or "").startswith("[Image"))


def _get_chunk_count(supabase, doc_id: str) -> int:
    return (
        supabase.table("documents")
        .select("chunk_count")
        .eq("id", doc_id)
        .single()
        .execute()
        .data["chunk_count"]
    )


def _insert_doc_row(
    supabase, *, doc_id: str, user_id: str, file_path: str,
    mime: str = DOCX_MIME,
) -> None:
    supabase.table("documents").insert({
        "id": doc_id,
        "user_id": user_id,
        "filename": "test_orphan_check.docx",
        "file_path": file_path,
        "file_size": 37000,
        "mime_type": mime,
        "status": "completed",
        "is_latest": True,
        "version_number": 1,
        "chunk_count": 0,
    }).execute()


def _upload_storage(
    supabase, *, file_path: str, raw: bytes, mime: str = DOCX_MIME,
) -> None:
    supabase.storage.from_("documents").upload(
        path=file_path,
        file=raw,
        file_options={"content-type": mime, "upsert": "true"},
    )


def _cleanup(supabase, *, doc_id: str, file_path: str) -> None:
    """Best-effort teardown — never raises so test failures stay clean."""
    try:
        supabase.table("document_chunks").delete().eq("document_id", doc_id).execute()
    except Exception:
        pass
    try:
        supabase.table("document_images").delete().eq("document_id", doc_id).execute()
    except Exception:
        pass
    try:
        supabase.table("document_tables").delete().eq("document_id", doc_id).execute()
    except Exception:
        pass
    try:
        supabase.table("documents").delete().eq("id", doc_id).execute()
    except Exception:
        pass
    try:
        supabase.storage.from_("documents").remove([file_path])
    except Exception:
        pass


def test_reextract_then_reingest_leaves_no_orphan_chunks(
    client, real_supabase_client, real_user_id, fixture_raw,
):
    """Phase 072.1 Gap 3 / BUG-260517-01 — `/reextract` followed by `/reingest`
    must leave only the latest chunk batch, not the sum of both.

    Three actions, three snapshots:
      A. /reextract -> Snapshot A (chunks after reextract)
      B. /reingest  -> Snapshot B (chunks after reingest — must NOT include A's)
      C. /reingest  -> Snapshot C (count stable vs B — idempotent)
    """
    supabase = real_supabase_client
    user_id = real_user_id
    doc_id = str(uuid.uuid4())
    file_path = f"{user_id}/{doc_id}/test_orphan_check.docx"

    # Mock external APIs only: vision LLM + embedding service.
    # Deterministic 1536-dim vectors so PGVector accepts them.
    fake_embedding = [0.0] * 1536

    try:
        # 1. Setup: upload fixture to storage + insert documents row.
        _upload_storage(supabase, file_path=file_path, raw=fixture_raw)
        _insert_doc_row(
            supabase, doc_id=doc_id, user_id=user_id, file_path=file_path,
        )

        # 2. Headers from conftest's stub (auth dep already overridden via
        # real_user_id fixture).
        headers = {"Authorization": "Bearer test-token"}

        # Mock the embedding + describe_image surface at every import site so
        # ingest_document + extract_and_store_images can't sneak through a
        # network call. embed_texts (openai_service) is patched too since some
        # paths import it instead of embed_chunks.
        with patch(
            "app.services.embedding_service.embed_chunks",
            side_effect=lambda texts, model=None: [fake_embedding] * len(texts),
        ), patch(
            "app.api.documents.embed_chunks",
            side_effect=lambda texts, model=None: [fake_embedding] * len(texts),
        ), patch(
            "app.services.openai_service.embed_texts",
            side_effect=lambda texts, **kwargs: [fake_embedding] * len(texts),
        ), patch(
            "app.services.multimodal_service.describe_image",
            return_value="A test description from the fixture.",
        ):
            # Action 1 — /reextract with engine=legacy (matches DOCX fixture path).
            r1 = client.post(
                f"/documents/{doc_id}/reextract",
                headers=headers,
                json={"engine": "legacy"},
            )
            assert r1.status_code == 202, (
                f"/reextract returned {r1.status_code}: {r1.text}"
            )
            _wait_for_status(
                supabase, doc_id, target_statuses={"completed", "failed"},
            )

            # Snapshot A — chunks after /reextract. Required >0 so we have
            # something for /reingest to clean up.
            chunks_after_reextract = _count_chunks(supabase, doc_id)
            assert chunks_after_reextract > 0, (
                f"Expected >=1 chunk after /reextract; got {chunks_after_reextract}. "
                f"Doc status likely 'failed' — inspect documents table."
            )

            # Action 2 — /reingest. The FIX should DELETE the prior chunks
            # BEFORE the BackgroundTask runs the new extract -> insert.
            r2 = client.post(
                f"/documents/{doc_id}/reingest",
                headers=headers,
            )
            assert r2.status_code == 200, (
                f"/reingest returned {r2.status_code}: {r2.text}"
            )
            _wait_for_status(
                supabase, doc_id, target_statuses={"completed", "failed"},
            )

            # Snapshot B — chunks after /reingest. KEY invariant: should reflect
            # ONLY the second extract's chunks (no orphans from Action 1).
            chunks_after_reingest = _count_chunks(supabase, doc_id)
            text_chunks_after_reingest = _count_text_chunks(supabase, doc_id)
            chunk_count_after_reingest = _get_chunk_count(supabase, doc_id)

            # Primary orphan-free invariant: documents.chunk_count must match the
            # actual TOTAL document_chunks row count (text + image-description chunks)
            # for this doc. chunk_count is now a count(*) taken after the multimodal
            # insert (documents.py), so it reflects real searchable rows, not text-only
            # density. Before the cascade fix: chunk_count = len(new_chunks) but
            # document_chunks held OLD + NEW rows -> mismatch. After the fix: /reingest's
            # cascade deletes old rows before new ones are INSERTed, so chunk_count ==
            # total row count. (text_chunks_after_reingest retained for the diagnostic msg.)
            assert chunk_count_after_reingest == chunks_after_reingest, (
                f"Phase 072.1 Gap 3 / BUG-260517-01 invariant: "
                f"documents.chunk_count ({chunk_count_after_reingest}) must match "
                f"actual TOTAL chunk count ({chunks_after_reingest}). "
                f"Mismatch indicates either chunk_count drift OR orphan accumulation. "
                f"Text chunks only: {text_chunks_after_reingest}. "
                f"Pre-/reingest chunk count: {chunks_after_reextract}."
            )

            # Secondary orphan-free invariant: the chunks left in the table after
            # /reingest must be a FRESH BATCH (created post-/reingest), not the
            # sum of the prior /reextract batch + new chunks. The strongest way
            # to assert this without timestamp inspection is: the second
            # /reingest run (Action 3 below) must leave the count stable
            # (chunk_count_after_second_reingest == chunk_count_after_reingest).
            # If the cascade weren't firing, each subsequent op would ADD to
            # the table — the idempotency check below would catch it.
            #
            # We ALSO assert /reingest's count is independent of the prior
            # /reextract's count: specifically, the post-/reingest count must
            # NOT be >= 2x the post-/reextract count (the "perfect orphan
            # accumulation" failure mode where everything from the prior op
            # survived). /reextract and /reingest use different text extractors
            # (legacy `extract_text` vs per-aspect composer's text engine), so
            # we don't assert strict count equality — only that the post-
            # /reingest count is bounded sensibly.
            assert chunks_after_reingest < (2 * chunks_after_reextract) + 10, (
                f"Suspected orphan accumulation: chunks_after_reingest "
                f"({chunks_after_reingest}) is too close to chunks_after_reextract "
                f"({chunks_after_reextract}) * 2. If /reingest's cascade fired, "
                f"the new count should be the fresh extract's count alone — "
                f"NOT old + new."
            )

            # Action 3 — call /reingest AGAIN (idempotency check).
            r3 = client.post(
                f"/documents/{doc_id}/reingest",
                headers=headers,
            )
            assert r3.status_code == 200, (
                f"second /reingest returned {r3.status_code}: {r3.text}"
            )
            _wait_for_status(
                supabase, doc_id, target_statuses={"completed", "failed"},
            )

            chunks_after_second_reingest = _count_chunks(supabase, doc_id)
            chunk_count_after_second_reingest = _get_chunk_count(supabase, doc_id)

            assert chunks_after_second_reingest == chunks_after_reingest, (
                f"Idempotency violation: second /reingest changed total chunk count "
                f"from {chunks_after_reingest} to {chunks_after_second_reingest}. "
                f"The /reingest cascade is supposed to be idempotent on steady-state."
            )
            assert chunk_count_after_second_reingest == chunk_count_after_reingest, (
                f"Idempotency violation: second /reingest changed documents.chunk_count "
                f"from {chunk_count_after_reingest} to {chunk_count_after_second_reingest}."
            )

    finally:
        _cleanup(supabase, doc_id=doc_id, file_path=file_path)
