"""Phase 072.1 Gap 2 fix — NON-mocked integration test for the
`/reextract?retry_empty_descriptions_only=true` retry helper.

Plan 03's existing `test_reextract_retry_empty_descriptions_only_branch`
test mocks supabase-py + the dispatcher, which is why Gap 1 (PostgREST
syntax) AND Gap 2 (engine mismatch) both slipped into production. This
test exercises the live PostgREST layer + the real `extract_composable`
+ the real `zip_xpath_docx` engine, mocking ONLY the vision LLM
(`describe_image`) to avoid external API dependencies in CI.

Asserts:
  - Retry endpoint returns 202 (no 500 from PostgREST filter syntax — Gap 1 stays fixed).
  - At least one empty `document_images` row is UPDATEd with a non-empty description
    (proves engine + composite-key match works end-to-end — Gap 2 fixed).
  - Non-empty control row is NOT touched.
  - `document_chunks` count is unchanged across the call (delete-cascade still skipped).
  - `documents.chunk_count` is unchanged.
  - No new `document_images` rows are INSERTed (helper only UPDATEs).

Skip rules: if `SUPABASE_URL` is the conftest test stub
(`https://test.supabase.co`) or the real Supabase is unreachable, the
test SKIPs cleanly rather than failing. This makes the test safe to
run in CI without a local Supabase.
"""
from __future__ import annotations

import os
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

import pytest


# Mark as integration — selectable via `pytest -m integration` if a marker
# rule is later added. Runs by default (no `--strict-markers`).
pytestmark = pytest.mark.integration


FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent
    / "fixtures" / "extraction" / "floating_shapes.docx"
)
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

# Stub URL set by conftest.py when no real env is provided. If we see this,
# skip — there's no live Supabase to talk to.
_STUB_URL = "https://test.supabase.co"


def _real_supabase_available() -> tuple[bool, str]:
    """Return (available, reason). Skips when stub URL or unreachable."""
    url = os.environ.get("SUPABASE_URL", "")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
    if not url or url == _STUB_URL:
        return False, f"SUPABASE_URL not set or is conftest stub ({_STUB_URL!r})"
    if not key or key in ("test-service-role-key", "test-key"):
        return False, "SUPABASE_SERVICE_ROLE_KEY not set or is conftest stub"
    # Lightweight reachability probe — try to construct a client and run a
    # trivial query with a short timeout.
    try:
        from supabase import create_client
        client = create_client(url, key)
        # `app_settings` is a single-row table — quick probe.
        client.table("app_settings").select("id").limit(1).execute()
    except Exception as exc:  # noqa: BLE001
        return False, f"Supabase unreachable at {url}: {exc}"
    return True, ""


def _resolve_test_user_id(supabase) -> str:
    """Pick a real user_id from auth.users for the FK constraints.

    Strategy: try the conftest mock UUID first (some local dev envs seed
    it). If absent, fall back to the first available auth.users row
    (any real user — the test only needs FK-valid). Skip if no users exist.
    """
    mock_id = "00000000-0000-0000-0000-000000000001"
    # supabase-py exposes auth.admin.list_users() for service-role queries.
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

    Bypasses the conftest mock via dependency_overrides swap. Restores
    the mock at teardown so subsequent tests are unaffected.
    """
    available, reason = _real_supabase_available()
    if not available:
        pytest.skip(reason)

    from supabase import create_client
    from app.main import app
    from app.dependencies import get_supabase

    # Build a fresh real client (do NOT reuse the module-level singleton —
    # the test's lifecycle is independent of the app's).
    url = os.environ["SUPABASE_URL"]
    key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
    real_client = create_client(url, key)

    # Override the dependency to return the real client for this test.
    original_override = app.dependency_overrides.get(get_supabase)
    app.dependency_overrides[get_supabase] = lambda: real_client
    try:
        yield real_client
    finally:
        # Restore conftest's mock override (or remove if absent).
        if original_override is None:
            app.dependency_overrides.pop(get_supabase, None)
        else:
            app.dependency_overrides[get_supabase] = original_override


@pytest.fixture
def real_user_id(real_supabase_client):
    """Resolve a real auth.users id for FK constraints + override the
    `get_current_user` dependency to return that id for this test.
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


def _insert_doc_row(
    supabase, *, doc_id: str, user_id: str, file_path: str,
    mime: str = DOCX_MIME, chunk_count: int = 5,
) -> None:
    supabase.table("documents").insert({
        "id": doc_id,
        "user_id": user_id,
        "filename": "test_floating_shapes.docx",
        "file_path": file_path,
        "file_size": 37000,
        "mime_type": mime,
        "status": "completed",
        "is_latest": True,
        "version_number": 1,
        "chunk_count": chunk_count,
    }).execute()


def _upload_storage(
    supabase, *, file_path: str, raw: bytes, mime: str = DOCX_MIME,
) -> None:
    # supabase-py: storage.from_("documents").upload(path, file, file_options=...)
    # upsert=true so test reruns over a pre-existing path don't fail.
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
        supabase.table("documents").delete().eq("id", doc_id).execute()
    except Exception:
        pass
    try:
        supabase.storage.from_("documents").remove([file_path])
    except Exception:
        pass


def test_retry_refills_floating_shapes_via_real_dispatcher(
    client, auth_headers, real_supabase_client, real_user_id, fixture_raw,
):
    """Phase 072.1 Gap 2 fix — proves the helper dispatches through the
    REAL `zip_xpath_docx` engine and refills empty rows that the legacy
    `extract_docx_images` (inline_shapes-only) silently skipped.

    Uses the conftest's `client` (TestClient) and `auth_headers` fixtures.
    Swaps `get_supabase` to a real client + `get_current_user` to a real
    user_id so FK constraints + RLS predicates (eq user_id) line up
    end-to-end.
    """
    supabase = real_supabase_client
    user_id = real_user_id
    doc_id = str(uuid.uuid4())
    file_path = f"{user_id}/{doc_id}/test_floating_shapes.docx"

    try:
        # 1. Setup: upload fixture to storage + insert documents row.
        _upload_storage(supabase, file_path=file_path, raw=fixture_raw)
        _insert_doc_row(
            supabase, doc_id=doc_id, user_id=user_id, file_path=file_path,
        )

        # 2. Pre-state: insert 2 empty image rows matching what zip_xpath_docx
        # will return (image_index=0,page=None and image_index=1,page=None).
        # Set created_at to >5min ago to clear the helper's thrash-guard.
        old_ts = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
        supabase.table("document_images").insert([
            {
                "document_id": doc_id, "user_id": user_id,
                "description": "", "image_index": 0, "page": None,
                "bbox": {"location": "floating"}, "created_at": old_ts,
            },
            {
                "document_id": doc_id, "user_id": user_id,
                "description": "", "image_index": 1, "page": None,
                "bbox": {"location": "floating"}, "created_at": old_ts,
            },
            # Control row: non-empty description — helper MUST NOT touch.
            {
                "document_id": doc_id, "user_id": user_id,
                "description": "already filled", "image_index": 2, "page": None,
                "bbox": {"location": "floating"}, "created_at": old_ts,
            },
        ]).execute()

        # 3. Pre-state: insert >=1 chunk row to prove helper doesn't touch chunks.
        supabase.table("document_chunks").insert([
            {
                "document_id": doc_id, "user_id": user_id,
                "content": "test chunk content", "chunk_index": 0,
                "embedding": [0.0] * 1536,
            },
        ]).execute()

        # Snapshot pre-call.
        chunks_before = (
            supabase.table("document_chunks")
            .select("id", count="exact")
            .eq("document_id", doc_id)
            .execute()
            .count
        )
        images_before = (
            supabase.table("document_images")
            .select("id", count="exact")
            .eq("document_id", doc_id)
            .execute()
            .count
        )
        doc_before = (
            supabase.table("documents")
            .select("chunk_count")
            .eq("id", doc_id)
            .single()
            .execute()
            .data
        )

        # 4. Action: call /reextract?retry_empty_descriptions_only=true.
        # Mock ONLY describe_image (no vision API call). Everything else
        # (PostgREST, dispatcher, zip_xpath_docx, downscale) runs real.
        with patch(
            "app.services.multimodal_service.describe_image",
            return_value="A test description from the fixture.",
        ):
            response = client.post(
                f"/documents/{doc_id}/reextract?retry_empty_descriptions_only=true",
                headers=auth_headers,
                json={"engine": "pymupdf"},
            )

        # 5. Assertions.
        assert response.status_code == 202, (
            f"Expected 202; got {response.status_code}: {response.text}"
        )

        # No new images INSERTed; existing rows MAY have been UPDATEd.
        images_after = (
            supabase.table("document_images")
            .select("id", count="exact")
            .eq("document_id", doc_id)
            .execute()
            .count
        )
        assert images_after == images_before, (
            f"Helper must NOT INSERT new image rows (UPDATE only); "
            f"before={images_before}, after={images_after}"
        )

        # Chunks count unchanged (delete-cascade skipped).
        chunks_after = (
            supabase.table("document_chunks")
            .select("id", count="exact")
            .eq("document_id", doc_id)
            .execute()
            .count
        )
        assert chunks_after == chunks_before, (
            f"Helper must NOT touch document_chunks; "
            f"before={chunks_before}, after={chunks_after}"
        )

        # documents.chunk_count unchanged.
        doc_after = (
            supabase.table("documents")
            .select("chunk_count")
            .eq("id", doc_id)
            .single()
            .execute()
            .data
        )
        assert doc_after["chunk_count"] == doc_before["chunk_count"], (
            f"Helper must NOT touch documents.chunk_count; "
            f"before={doc_before['chunk_count']}, after={doc_after['chunk_count']}"
        )

        # At least 2 rows have non-empty descriptions after retry
        # (2 refilled by helper + 1 pre-existing control = 3, with floor 2
        # in case storage upload races collapse one row).
        refilled = (
            supabase.table("document_images")
            .select("id, description")
            .eq("document_id", doc_id)
            .neq("description", "")
            .execute()
            .data
        )
        non_empty_ids = {r["id"] for r in refilled}
        assert len(non_empty_ids) >= 2, (
            f"Phase 072.1 Gap 2 fix: expected >=2 non-empty descriptions "
            f"after retry (>=1 refilled + 1 pre-existing control); "
            f"got {len(non_empty_ids)}: {refilled!r}"
        )

        # Control row's description preserved.
        control = (
            supabase.table("document_images")
            .select("description")
            .eq("document_id", doc_id)
            .eq("image_index", 2)
            .single()
            .execute()
            .data
        )
        assert control["description"] == "already filled", (
            f"Helper must NOT touch non-empty rows; control row now has: {control!r}"
        )

    finally:
        _cleanup(supabase, doc_id=doc_id, file_path=file_path)
