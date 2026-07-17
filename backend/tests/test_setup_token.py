"""Phase 158 Plan 01 (D-15) — first-boot setup token: 401 gate + constant-time verify.

Wave-0 Nyquist scaffold. The setup token is the pre-auth anti-hijack credential (the
n8n/Jupyter idiom): minted once on first unfinalized boot, printed to backend stdout
(``docker compose logs backend``), required + constant-time-verified on every ``/setup/*``
write. This file pins the ``setup_store`` token primitives (158-VALIDATION.md, SC#2/D-15):

  - a missing token is rejected (``verify_token(None)`` is False);
  - a wrong token is rejected;
  - the correct persisted token verifies True;
  - ``verify_token`` uses ``hmac.compare_digest`` (constant-time — anti-brute-force);
  - ``get_or_create_token`` persists (stable across calls — the operator reads it once).

``app.services.setup_store`` is a NEW module -> ``pytest.importorskip`` SKIPS the file
cleanly until Wave 1 lands it. All token values are throwaway (generated per test into the
``setup_store_path`` tmp store — never a real token; T-158-scaffold).
"""
import inspect

import pytest

# NEW module — skips cleanly until Wave 1 creates app/services/setup_store.py.
setup_store = pytest.importorskip("app.services.setup_store")
from app.services.setup_store import get_or_create_token, verify_token  # noqa: E402


def test_verify_token_rejects_missing(setup_store_path):
    """D-15: a MISSING ``X-Setup-Token`` is rejected — ``verify_token(None)`` is False
    (the api dependency turns this into a 401)."""
    assert verify_token(None) is False


def test_verify_token_rejects_wrong(setup_store_path):
    """D-15: a WRONG token is rejected even though a real token exists in the store."""
    get_or_create_token()  # mint the real one into the throwaway store
    assert verify_token("definitely-not-the-real-token") is False


def test_verify_token_accepts_correct(setup_store_path):
    """D-15: the correct persisted token verifies True (the api dependency lets the write
    through)."""
    tok = get_or_create_token()
    assert verify_token(tok) is True


def test_verify_token_uses_constant_time_compare(setup_store_path):
    """D-15: ``verify_token`` compares with ``hmac.compare_digest`` (constant-time) so the
    token cannot be recovered by a timing side-channel (T-158 brute-force)."""
    src = inspect.getsource(verify_token)
    assert "compare_digest" in src, "verify_token must use hmac.compare_digest (constant-time)"


def test_get_or_create_token_is_stable(setup_store_path):
    """D-15: the token PERSISTS in the 0600 store — a second call returns the SAME value
    (re-printed each unfinalized boot so it stays discoverable; the finalize lock is the
    real boundary, not token rotation)."""
    assert get_or_create_token() == get_or_create_token()
