"""Phase 305-01 — the app a LIVE test serves, with the boot sweeps OFF.

``uvicorn tests.fixtures.phase305.serve_app:app`` serves the REAL ``app.main.app`` (every
middleware, the real lifespan, the real ``/mcp`` mount) with one difference: ``RUN_BOOT_SWEEPS`` is
False, exactly as ``tests/conftest.py`` sets it for in-process suites (SEED-363). Without this, a
spawned test server would run the resume sweep, the orphan reconciler and the notification drainer
against the SHARED local database the operator's own backend is using. Each uvicorn worker imports
this module, so each worker's lifespan reads the flag as False.
"""
from __future__ import annotations

import app.main as _main

_main.RUN_BOOT_SWEEPS = False

app = _main.app
