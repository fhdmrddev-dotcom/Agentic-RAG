"""Phase 158 Plan 01 (SC#3 / D-03) — the setup-mode-tolerant lifespan (the ONE crash path).

Wave-0 Nyquist scaffold. On a fresh/unbound box the DB is a placeholder/unreachable; the
lifespan must DEGRADE, not crash. RESEARCH Pattern 3 verified (line-by-line) that the ONLY
un-guarded DB-touching hard-fail is ``assert_action_types_synced(await get_pg_pool())`` at
``main.py:356-357`` — every other startup step is already best-effort ``try/except``. D-03 =
guard exactly that call (and skip spawning the background reconcilers) behind
``if not _setup_mode`` where ``_setup_mode = not setup_finalized()`` (a cheap file read, no DB).

``app.main`` already imports (MODIFIED module) so these are HONEST REDs (source/marker
assertions that fail until the guard lands), never collection errors. The mechanism is the
file marker, so the green-signal is ``setup_finalized`` appearing in the lifespan source +
the ``setup_store.setup_finalized`` marker existing. Wave 1 replaces these with the full
monkeypatch-marker behavioral test ("setup mode → spy NOT called; configured mode → called").

Pinned (158-VALIDATION.md, SC#3/D-03):
  - the lifespan computes setup-mode from the blip-proof file marker (setup_store.setup_finalized);
  - in setup mode the lifespan does NOT call ``assert_action_types_synced`` (guarded);
  - in configured mode it STILL calls it (the loud audit-enum drift guard is preserved).
"""
import importlib
from pathlib import Path

import app.main as main_mod


def _import_or_none(name: str):
    try:
        return importlib.import_module(name)
    except Exception:
        return None


def test_setup_store_marker_available_for_boot_guard():
    """SC#3/D-03: the lifespan computes ``_setup_mode`` from the file marker
    (``setup_store.setup_finalized`` — a cheap file read, no DB, blip-proof). RED until the
    marker module lands in Wave 1."""
    store = _import_or_none("app.services.setup_store")
    assert getattr(store, "setup_finalized", None) is not None, (
        "RED until Wave 1: app.services.setup_store.setup_finalized must exist so the "
        "lifespan can compute _setup_mode = not setup_finalized() and guard main.py:357"
    )


def test_setup_mode_defers_audit_drift_guard():
    """SC#3/D-03: in setup mode the lifespan does NOT call ``assert_action_types_synced``
    (the ONE un-guarded DB-touch at main.py:356-357). The guard is ``if not _setup_mode``,
    so a fresh/unbound box boots into setup mode and PRINTS the token instead of
    crash-looping (Pitfall 3). Green-signal: the lifespan source references the file marker
    that gates the call."""
    src = Path(main_mod.__file__).read_text(encoding="utf-8")
    assert "setup_finalized" in src, (
        "RED until Wave 1: the lifespan must import/compute setup mode from the file marker "
        "(setup_finalized) and guard the assert_action_types_synced call behind it"
    )


def test_configured_mode_still_runs_audit_drift_guard():
    """SC#3/D-03: configured mode STILL calls ``assert_action_types_synced`` — the loud
    audit-enum drift guard (Phase 110 DMF-01) is only DEFERRED in setup mode, never removed;
    a bound box must still hard-fail on a frozenset⊄live-CHECK drift."""
    src = Path(main_mod.__file__).read_text(encoding="utf-8")
    # present today (green half) — the guard must survive the D-03 change
    assert "assert_action_types_synced" in src, "the audit-drift guard must remain in the lifespan"
    # RED half — until the setup-mode branch exists around it
    assert "setup_finalized" in src, (
        "RED until Wave 1: the audit-drift guard must be wrapped in `if not _setup_mode:` "
        "so configured-mode keeps it while setup-mode defers it"
    )
