"""
Tests for the sandbox-outputs re-sign endpoint (D-067.2-03).

Per Phase 067.2-03 PLAN.md <deviation_note>: cross-user IDOR returns
HTTP 404 (NOT 403) — D-062-12 project invariant takes precedence over
CONTEXT.md acceptance criterion #3 which used 403. The 404 prevents
existence-leakage of file paths whose names may embed user-supplied
prompt artifacts (e.g. chart_FahedMrad_q3.png).
"""
from unittest.mock import MagicMock

from fastapi.testclient import TestClient

from app.main import app
from app.dependencies import get_current_user, get_supabase


USER_AAA = "00000000-0000-0000-0000-00000000aaaa"
USER_BBB = "00000000-0000-0000-0000-00000000bbbb"


def _user(uid=USER_AAA):
    return {"id": uid, "email": "test@example.com"}


def _make_result(data):
    r = MagicMock()
    r.data = data
    return r


def _make_builder():
    """Fresh fully-wired Supabase query builder mock."""
    b = MagicMock()
    b.select.return_value = b
    b.insert.return_value = b
    b.update.return_value = b
    b.delete.return_value = b
    b.eq.return_value = b
    b.neq.return_value = b
    b.in_.return_value = b
    b.order.return_value = b
    b.limit.return_value = b
    b.single.return_value = b
    b.maybe_single.return_value = b
    b.is_.return_value = b
    b.or_.return_value = b
    b.execute.return_value = _make_result([])
    return b


def _make_supabase(builder, signed_url_value=None):
    sb = MagicMock()
    sb.table.return_value = builder
    sb.rpc.return_value = builder
    storage_bucket = MagicMock()
    if signed_url_value is not None:
        storage_bucket.create_signed_url.return_value = {
            "signedURL": signed_url_value
        }
    sb.storage.from_.return_value = storage_bucket
    return sb


def test_path_segment_mismatch_returns_404():
    """Path-segment user_id != current_user.id → 404 (D-062-12, not 403).

    Asserts the canonical D-062-12 invariant — cross-user resource access
    returns 404, not 403, to prevent existence-leakage of file paths.
    """
    builder = _make_builder()
    supabase = _make_supabase(builder)

    app.dependency_overrides[get_current_user] = lambda: _user(USER_AAA)
    app.dependency_overrides[get_supabase] = lambda: supabase
    try:
        with TestClient(app) as client:
            # storage_path = "{USER_BBB}/exec-1/file.png" — first segment is
            # a different user. Endpoint must reject with 404 BEFORE any
            # Postgres query runs (path-segment fence is the first check).
            r = client.get(
                f"/sandbox-outputs/{USER_BBB}/exec-1/file.png",
                headers={"Authorization": "Bearer test-token"},
                follow_redirects=False,
            )
            assert r.status_code == 404, (
                f"expected 404 (D-062-12), got {r.status_code}: {r.text}"
            )
            assert r.json().get("detail") == "File not found"
    finally:
        app.dependency_overrides.clear()


def test_missing_sandbox_files_row_returns_404():
    """Path-segment matches but no sandbox_files row → 404 (defense-in-depth).

    The path-segment fence passes (parts[0] == USER_AAA), so the endpoint
    proceeds to the sandbox_files row check. With the row missing, the
    second 404 branch must fire (also D-062-12 — no leak of which paths
    exist for which users).
    """
    builder = _make_builder()
    # maybe_single() returns a result with .data == None when no row
    builder.execute.return_value = _make_result(None)
    supabase = _make_supabase(builder)

    app.dependency_overrides[get_current_user] = lambda: _user(USER_AAA)
    app.dependency_overrides[get_supabase] = lambda: supabase
    try:
        with TestClient(app) as client:
            r = client.get(
                f"/sandbox-outputs/{USER_AAA}/exec-1/file.png",
                headers={"Authorization": "Bearer test-token"},
                follow_redirects=False,
            )
            assert r.status_code == 404, (
                f"expected 404, got {r.status_code}: {r.text}"
            )
    finally:
        app.dependency_overrides.clear()


def test_happy_path_returns_302_with_signed_url():
    """Path-segment matches, row exists → 302 redirect to short-TTL signed URL."""
    SIGNED_URL = "https://storage.example/sign?token=abc"
    builder = _make_builder()
    # Row exists for (storage_path, user_id) — defense-in-depth fence passes.
    builder.execute.return_value = _make_result({"id": "file-1"})
    supabase = _make_supabase(builder, signed_url_value=SIGNED_URL)

    app.dependency_overrides[get_current_user] = lambda: _user(USER_AAA)
    app.dependency_overrides[get_supabase] = lambda: supabase
    try:
        with TestClient(app) as client:
            # follow_redirects=False is critical — TestClient default is to
            # follow 3xx, which would chase the fake CDN URL and noisify
            # the test with an unrelated network failure.
            r = client.get(
                f"/sandbox-outputs/{USER_AAA}/exec-1/file.png",
                headers={"Authorization": "Bearer test-token"},
                follow_redirects=False,
            )
            assert r.status_code == 302, (
                f"expected 302, got {r.status_code}: {r.text}"
            )
            assert r.headers["location"] == SIGNED_URL
    finally:
        app.dependency_overrides.clear()
