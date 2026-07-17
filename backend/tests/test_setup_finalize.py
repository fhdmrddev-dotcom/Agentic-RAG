"""Phase 158 Plan 01 (SC#2 / D-05) — finalize writes BOTH markers; setup_finalized latches.

Wave-0 Nyquist scaffold. The finalize marker is dual (D-05): the LOCAL file marker
(``/data/setup.json`` ``finalized:true``) is the blip-proof GATE AUTHORITY (read cheaply,
immune to a transient DB outage — a DB blip must NEVER bounce a live box's users into the
wizard), and the DB ``app_settings.setup_complete`` boolean is the AUDITABLE/app-facing
signal. Finalize writes BOTH. This file pins the ``setup_store`` file-marker latch behavior
(158-VALIDATION.md, SC#2/D-05):

  - a fresh box (no marker) → ``setup_finalized()`` is False (setup needed);
  - after ``finalized:true`` is written → ``setup_finalized()`` returns True;
  - the latch is MONOTONIC / sticky-True — once True it STAYS True even if the marker file
    is later cleared (a box never un-finalizes via the wizard; the byte-identical hot path
    never re-reads the file);
  - finalize ALSO writes the auditable DB signal via the ``setup_complete()`` read side.

``app.services.setup_store`` is a NEW module -> ``pytest.importorskip`` SKIPS the file
cleanly until Wave 1. The store is the throwaway ``setup_store_path`` tmp file.
"""
# app/services/setup_store.py landed in Wave 1 (Plan 158-03) — direct import (the module
# now exists, so the 158-01 importorskip guard is retired).
from app.services.setup_store import setup_finalized, write_store


def test_setup_finalized_false_on_fresh_store(setup_store_path):
    """D-05: a fresh box (no marker file) → ``setup_finalized()`` is False → setup is
    needed. The gate authority defaults to 'not configured' when the marker is absent."""
    assert setup_finalized() is False


def test_finalize_marker_latches_true(setup_store_path):
    """D-05: writing ``finalized:true`` to the store → ``setup_finalized()`` returns True.
    The file marker (not the DB flag) is the blip-proof gate authority."""
    write_store({"finalized": True})
    assert setup_finalized() is True


def test_setup_finalized_is_sticky_true(setup_store_path):
    """D-05 (the monotonic latch): once finalized, ``setup_finalized()`` stays True even if
    the marker is later cleared — a box never un-finalizes via the wizard, and the
    byte-identical hot path never re-reads the file (RESEARCH Pattern 4)."""
    write_store({"finalized": True})
    assert setup_finalized() is True
    write_store({})  # clear the marker on disk
    assert setup_finalized() is True, "the finalized latch must be sticky-True (monotonic)"


def test_finalize_also_writes_auditable_db_flag(setup_store_path):
    """D-05: finalize writes BOTH markers — the auditable DB half is
    ``app_settings.setup_complete``, read via the ``user_settings.setup_complete()`` helper
    (beside ``maintenance_mode()``). Named here for the Nyquist map; the write path is
    exercised in the api/finalize wave. Honest RED via getattr until the helper lands."""
    import app.models.user_settings as us
    setup_complete = getattr(us, "setup_complete", None)
    assert setup_complete is not None and callable(setup_complete), (
        "RED until Wave 1/2: user_settings.setup_complete() (the auditable DB signal, "
        "default False on cold cache / DB blip — mirrors maintenance_mode())"
    )
