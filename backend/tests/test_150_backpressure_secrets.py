"""Phase 150 Plan 05 Task 1 (SEC-01 / D-150-02) — the additive secrets_encryption
field on GET /admin/backpressure.

Nyquist: these cases exercise the NEW field DIRECTLY (not only the pre-existing
backpressure regression). They prove:
  - the payload carries a `secrets_encryption` dict whose `state` is one of the
    three honest states {encrypted, plaintext, error};
  - the field is derived from the RAW (ciphertext) app_settings row — fed a row of
    enc:v1: values under an active key it reports "encrypted"; fed a plaintext value
    under an active key it reports "error" + columns_plaintext (the swallowed-sweep
    lingering-plaintext case) — so the raw-row contract (NOT the decrypted load) is
    load-bearing and locked;
  - the four original backpressure keys + the Phase-147 dependencies block stay
    present alongside it (the D-078-08 additive contract);
  - a failed raw-row load NEVER 500s the health endpoint — it degrades to plaintext.

Driven through the SAME harness as the existing `-k backpressure` tests (the HTTP
client + operator pool mock + probe_dependencies stub), additionally monkeypatching
the RAW-row loader `_load_settings_from_db` to a known dict.
"""
from cryptography.fernet import Fernet

from app.config import settings
from app.security.secret_cipher import encrypt_secret, get_cipher


def _fake_probe_dependencies():
    async def _fake():
        return {
            "redis": {"state": "up", "latency_ms": 2},
            "supabase": {"state": "up", "latency_ms": 5},
            "sandbox": {"state": "off", "latency_ms": None},
        }

    return _fake


def _stub_raw_row(monkeypatch, row):
    """Monkeypatch the RAW-row loader admin.get_backpressure imports lazily.

    admin.py does `from app.models.user_settings import _load_settings_from_db`
    INSIDE the handler, so patching the module attribute re-binds it at call time.
    """
    async def _fake():
        return dict(row)

    monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _fake)


def _operator(mock_asyncpg_pool, monkeypatch):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)
    mock_asyncpg_pool.set_fetchrow_result({"user_id": "op-1"})  # operator present
    monkeypatch.setattr(
        "app.services.health_probe.probe_dependencies", _fake_probe_dependencies()
    )


# ── The additive three-state field, alongside the existing contract ───────────

def test_backpressure_carries_secrets_encryption(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """The payload carries secrets_encryption.state ∈ {encrypted, plaintext, error};
    the four original signals + the dependencies block stay present (additive)."""
    _operator(mock_asyncpg_pool, monkeypatch)
    # No key configured (default test env) → the honest state is "plaintext".
    _stub_raw_row(monkeypatch, {"openai_api_key": "sk-live-plaintext"})

    res = client.get("/admin/backpressure", headers=auth_headers)
    assert res.status_code == 200
    body = res.json()

    # The NEW field, proven directly (not inferred).
    assert "secrets_encryption" in body
    assert body["secrets_encryption"]["state"] in {"encrypted", "plaintext", "error"}

    # The additive contract: existing keys + the Phase-147 dependencies block intact.
    for key in (
        "anyio_threadpool_depth",
        "redis_active_runs",
        "postgres_pool_in_use",
        "per_worker_run_count",
        "dependencies",
    ):
        assert key in body, f"additive contract broken: {key!r} missing"


def test_secrets_encryption_reports_encrypted_over_ciphertext_row(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """Fed a RAW row of enc:v1: values under an active key → state 'encrypted'.

    Proves encryption_status is fed CIPHERTEXT (the raw row) — a decrypted row here
    would misread the plaintext values as 'error'/columns_plaintext."""
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(settings, "secrets_encryption_key", key)
    cipher = get_cipher()
    assert cipher is not None
    _operator(mock_asyncpg_pool, monkeypatch)
    _stub_raw_row(
        monkeypatch,
        {
            "openai_api_key": encrypt_secret("sk-secret-1", cipher),
            "anthropic_api_key": encrypt_secret("sk-secret-2", cipher),
            "google_api_key": "",  # unset secret — ignored
        },
    )

    res = client.get("/admin/backpressure", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["secrets_encryption"] == {"state": "encrypted"}


def test_secrets_encryption_reports_error_on_lingering_plaintext(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """A plaintext secret while a key is active → state 'error' + columns_plaintext
    (the swallowed-sweep case — MUST surface honestly, never read as 'encrypted')."""
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(settings, "secrets_encryption_key", key)
    _operator(mock_asyncpg_pool, monkeypatch)
    _stub_raw_row(monkeypatch, {"openai_api_key": "sk-still-plaintext"})

    res = client.get("/admin/backpressure", headers=auth_headers)
    assert res.status_code == 200
    se = res.json()["secrets_encryption"]
    assert se["state"] == "error"
    assert se["columns_plaintext"] == 1


def test_secrets_encryption_degrades_to_plaintext_when_raw_load_fails(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """A failed raw-row load must NEVER 500 the health endpoint (dep-probe posture);
    it degrades to the plaintext state."""
    _operator(mock_asyncpg_pool, monkeypatch)

    async def _boom():
        raise RuntimeError("settings substrate unreachable")

    monkeypatch.setattr("app.models.user_settings._load_settings_from_db", _boom)

    res = client.get("/admin/backpressure", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["secrets_encryption"] == {"state": "plaintext"}


def test_secrets_encryption_unknown_on_empty_cold_row(
    client, auth_headers, mock_asyncpg_pool, monkeypatch
):
    """WR-02: a cold-cache / DB-outage raw load that returns {} WITHOUT raising must NOT
    render false-green. _load_settings_from_db swallows DB errors and returns {}, so the
    admin.py try/except degrade-branch never fires — the honesty must live in
    encryption_status. With a key active and an empty raw row the field is the neutral
    non-green "unknown", never "encrypted"."""
    key = Fernet.generate_key().decode()
    monkeypatch.setattr(settings, "secrets_encryption_key", key)
    _operator(mock_asyncpg_pool, monkeypatch)
    _stub_raw_row(monkeypatch, {})  # cold cache / DB blip returned {} (did NOT raise)

    res = client.get("/admin/backpressure", headers=auth_headers)
    assert res.status_code == 200
    se = res.json()["secrets_encryption"]
    assert se["state"] != "encrypted", "an empty cold-cache row must never read as encrypted"
    assert se == {"state": "unknown"}
