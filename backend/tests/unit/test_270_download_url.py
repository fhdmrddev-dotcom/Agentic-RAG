"""Phase 270 Plan 02 Task 2 — POST /documents/{id}/download-url (FIND-04, D-04..D-07, P-01, P-06).

TWO DISTINCT DOUBLES. `conftest` mirrors `get_user_supabase_client` onto the `get_supabase`
override, so by default both dependencies are the SAME mock and a test cannot tell the RLS
client from the service-role client. Here both overrides are set to different recorders that
append to ONE ordered log, so "RLS read first, service-role sign second" is a measured fact
rather than an assumption. (conftest's autouse fixture restores both overrides per test.)
"""
import ast
import logging
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

import pytest
from fastapi.testclient import TestClient
from storage3.exceptions import StorageApiError

from app.dependencies import get_supabase, get_user_supabase_client
from app.main import app

USER_ID = "00000000-0000-0000-0000-000000000001"
OTHER_ID = "00000000-0000-0000-0000-0000000000aa"
DOC_ID = "11111111-1111-1111-1111-111111111111"
FILE_PATH = f"{OTHER_ID}/{DOC_ID}/report.pdf"
SIGNED = "https://storage.example/sign/documents/abc?token=SECRETTOKEN123"
DOCUMENTS_PY = Path(__file__).resolve().parents[2] / "app" / "api" / "documents.py"


class _Query:
    def __init__(self, owner, table):
        self.owner, self.table_name = owner, table
        self.cols, self.eqs, self.has_in = None, {}, False

    def select(self, cols="*"):
        self.cols = cols
        return self

    def eq(self, k, v):
        self.eqs[k] = v
        return self

    def in_(self, k, v):
        self.has_in = True
        return self

    def maybe_single(self):
        return self

    def execute(self):
        self.owner.log.append((self.owner.name, f"read:{self.table_name}:{self.cols}"))
        return SimpleNamespace(data=self.owner.resolve(self))


class _Bucket:
    def __init__(self, owner):
        self.owner = owner

    def create_signed_url(self, path, expires_in, options=None):
        self.owner.log.append((self.owner.name, "storage/create_signed_url"))
        self.owner.sign_calls.append((path, expires_in, options))
        if isinstance(self.owner.sign_result, Exception):
            raise self.owner.sign_result
        return self.owner.sign_result


class _Storage:
    def __init__(self, owner):
        self.owner = owner

    def from_(self, bucket):
        assert bucket == "documents"
        return _Bucket(self.owner)


class _Double:
    def __init__(self, name, log, resolve=None, sign_result=None):
        self.name, self.log, self.sign_calls = name, log, []
        self.resolve = resolve or (lambda q: None)
        self.sign_result = sign_result
        self.storage = _Storage(self)

    def table(self, name):
        return _Query(self, name)


def _setup(mode="owner", file_path=FILE_PATH, version=1, sign_result=None, ttl=60):
    """mode: owner | colleague | invisible. Returns (client, user_double, service_double, log)."""
    log: list[tuple[str, str]] = []
    row = {
        "id": DOC_ID,
        "filename": "report.pdf",
        "user_id": USER_ID if mode == "owner" else OTHER_ID,
        "folder_id": "ffffffff-ffff-ffff-ffff-ffffffffffff",
        "file_path": file_path,
        "version_number": version,
    }

    def resolve(q):
        if q.table_name != "documents":
            return None
        if mode == "invisible":
            return None
        if q.cols == "id, filename, user_id, folder_id":  # visibility gate
            if mode == "owner" and "user_id" in q.eqs:
                return {k: row[k] for k in ("id", "filename", "user_id", "folder_id")}
            if mode == "colleague" and q.has_in:
                return {k: row[k] for k in ("id", "filename", "user_id", "folder_id")}
            return None
        if q.cols == "id, file_path, filename, version_number":
            return {k: row[k] for k in ("id", "file_path", "filename", "version_number")}
        return None

    user = _Double("user", log, resolve=resolve)
    service = _Double("service", log, sign_result=sign_result if sign_result is not None else {"signedURL": SIGNED})
    app.dependency_overrides[get_user_supabase_client] = lambda: user
    app.dependency_overrides[get_supabase] = lambda: service
    return TestClient(app), user, service, log


def _post(client, ttl_setting=60, folders=("ffffffff-ffff-ffff-ffff-ffffffffffff",)):
    async def _settings():
        return SimpleNamespace(document_download_url_ttl_seconds=ttl_setting)

    with patch("app.api.documents.get_globally_visible_folder_ids", return_value=list(folders)), patch(
        "app.api.documents.load_app_settings_async", _settings
    ):
        return client.post(f"/documents/{DOC_ID}/download-url")


def _storage_ops(log):
    return [e for e in log if e[1].startswith("storage/")]


# ── authorization order ──────────────────────────────────────────────────────


def test_invisible_document_is_404_with_zero_storage_calls():
    client, user, service, log = _setup("invisible")
    res = _post(client)
    assert res.status_code == 404
    assert "url" not in res.text
    assert _storage_ops(log) == []
    assert user.sign_calls == [] and service.sign_calls == []


def test_owner_gets_url_user_reads_precede_service_sign():
    client, user, service, log = _setup("owner")
    res = _post(client)
    assert res.status_code == 200, res.text
    body = res.json()
    assert body == {"url": SIGNED, "expires_in": 60, "version_number": 1, "filename": "report.pdf"}
    assert service.sign_calls == [(FILE_PATH, 60, {"download": "report.pdf"})]
    assert user.sign_calls == []
    idx_sign = log.index(("service", "storage/create_signed_url"))
    user_reads = [i for i, e in enumerate(log) if e[0] == "user" and e[1].startswith("read:documents")]
    assert user_reads and max(user_reads) < idx_sign
    assert all(e[0] == "user" for e in log[:idx_sign])  # nothing service-side before the sign


def test_colleague_who_can_see_the_row_gets_a_url():
    client, user, service, log = _setup("colleague")
    res = _post(client)
    assert res.status_code == 200, res.text
    assert service.sign_calls and service.sign_calls[0][0] == FILE_PATH
    assert user.sign_calls == []


def test_cache_control_no_store():
    client, *_ = _setup("owner")
    assert _post(client).headers["cache-control"] == "no-store"


# ── TTL ──────────────────────────────────────────────────────────────────────


@pytest.mark.parametrize(
    "setting,expected",
    [(120, 120), (5, 10), (3600, 900), (None, 60), ("abc", 60), (10, 10), (900, 900)],
)
def test_ttl_is_clamped(setting, expected):
    client, user, service, log = _setup("owner")
    res = _post(client, ttl_setting=setting)
    assert res.status_code == 200, res.text
    assert res.json()["expires_in"] == expected
    assert service.sign_calls[0][1] == expected


# ── honest failures ──────────────────────────────────────────────────────────


def test_empty_file_path_is_409_not_stored():
    client, user, service, log = _setup("owner", file_path="")
    res = _post(client)
    assert res.status_code == 409
    assert res.json()["detail"]["reason_code"] == "not_stored"
    assert "url" not in res.text
    assert _storage_ops(log) == []


def test_missing_object_is_410_file_missing():
    client, *_ = _setup("owner", sign_result=StorageApiError("gone", "NotFound", 404))
    res = _post(client)
    assert res.status_code == 410
    assert res.json()["detail"]["reason_code"] == "file_missing"
    assert "url" not in res.text


def test_signer_returning_no_url_is_500():
    client, *_ = _setup("owner", sign_result={"other": 1})
    res = _post(client)
    assert res.status_code == 500
    assert "url" not in res.text.replace("download URL", "")


def test_returns_the_authorized_rows_own_version():
    client, user, service, log = _setup("owner", version=2)
    res = _post(client)
    assert res.json()["version_number"] == 2


def test_url_never_logged(caplog):
    client, *_ = _setup("owner")
    with caplog.at_level(logging.DEBUG):
        _post(client)
    assert SIGNED not in caplog.text
    assert "token=" not in caplog.text


# ── AST order fence ──────────────────────────────────────────────────────────


def _fence_violations(source: str) -> list[str]:
    tree = ast.parse(source)
    fn = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "create_document_download_url"
    )
    gate_lines = [
        n.lineno
        for n in ast.walk(fn)
        if isinstance(n, ast.Await)
        and isinstance(n.value, ast.Call)
        and getattr(n.value.func, "id", None) == "_assert_document_visible"
    ]
    refs = [n.lineno for n in ast.walk(fn) if isinstance(n, ast.Name) and n.id == "service_supabase"]
    out = []
    if not gate_lines:
        out.append("no awaited _assert_document_visible")
    if len(refs) != 1:
        out.append(f"service_supabase referenced {len(refs)} times, expected 1")
    if gate_lines and refs and min(refs) < min(gate_lines):
        out.append("service_supabase used before the visibility gate")
    return out


def test_ast_fence_clean_on_real_source():
    assert _fence_violations(DOCUMENTS_PY.read_text(encoding="utf-8")) == []


def test_ast_fence_reds_on_planted_reorder():
    src = DOCUMENTS_PY.read_text(encoding="utf-8")
    marker = "await _assert_document_visible(document_id"
    start = src.index("async def create_document_download_url")
    at = src.index(marker, start)
    line_start = src.rfind("\n", 0, at) + 1
    indent = src[line_start:at]
    planted = src[:line_start] + f"{indent}_early = service_supabase\n" + src[line_start:]
    v = _fence_violations(planted)
    assert v, "the planted reorder must trip the fence"
