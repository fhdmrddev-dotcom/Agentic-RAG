"""Phase 158 Plan 01 (SC#2 / D-14) — idempotency + the hard lock-after-finalize.

Wave-0 Nyquist scaffold. Every wizard step is safe to re-run (re-entry shows current state,
no duplicate writes); after finalize the wizard REFUSES all config writes and shows "already
configured" (re-configuration is an /admin operator action, never the public pre-auth
wizard). The token dependency itself is the enforcement point: it asserts
``not setup_finalized()`` first → 409 (RESEARCH Code Examples :591-596). This file pins
(158-VALIDATION.md, SC#2/D-14):

  - ``require_setup_token`` raises 409 once ``setup_finalized()`` (the finalize latch refuses
    all config writes — the post-finalize-write hole is closed);
  - before finalize a valid-token write is accepted (the gate only closes AFTER finalize);
  - re-running a step is idempotent (no duplicate write).

``app.api.setup`` is a NEW module -> ``pytest.importorskip`` SKIPS the file cleanly until
Wave 2. Wave 2 wires the exact patch seam for ``setup_finalized`` (the api module binds it);
the finalize-latch 409 is the load-bearing lock-bypass proof (G-6(e)).
"""
import pytest
from fastapi import HTTPException

# NEW module — skips cleanly until Wave 2 creates app/api/setup.py.
setup_api = pytest.importorskip("app.api.setup")
from app.api.setup import require_setup_token  # noqa: E402


async def test_require_setup_token_rejects_after_finalize(setup_store_path, monkeypatch):
    """SC#2/D-14 (the lock-bypass proof, G-6(e)): once ``setup_finalized()`` is True the
    token dependency raises 409 for ANY write — even with a valid token — so no ``/setup/*``
    write can mutate config after finalize. Re-config is /admin-only."""
    # the api module binds setup_finalized at import; patch it where it is looked up
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: True, raising=False)
    with pytest.raises(HTTPException) as ei:
        await require_setup_token(x_setup_token="any-token")
    assert ei.value.status_code == 409


async def test_require_setup_token_allows_before_finalize(setup_store_path, monkeypatch):
    """SC#2/D-14: BEFORE finalize a valid token passes the dependency (the gate only closes
    after finalize). The token itself is verified constant-time (see test_setup_token)."""
    monkeypatch.setattr(setup_api, "setup_finalized", lambda: False, raising=False)
    monkeypatch.setattr(setup_api, "verify_token", lambda t: True, raising=False)
    # no exception → the write is allowed to proceed
    await require_setup_token(x_setup_token="valid-token")


async def test_step_rerun_is_idempotent_no_duplicate_write(setup_store_path, monkeypatch):
    """SC#2/D-14: re-running a step before finalize is idempotent — re-entry shows the
    current state and issues NO duplicate write (the operator can revisit a step; the
    operator upsert is ON CONFLICT DO NOTHING, the store write is a replace, not an append).
    Named here for the Nyquist map; Wave 2 drives the concrete step endpoint + asserts the
    second POST adds no new row / no second envelope."""
    # placeholder gate — Wave 2 flips this to the concrete per-step idempotency assertion
    assert hasattr(setup_api, "router"), "app.api.setup must expose the setup router"
