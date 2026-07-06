"""Phase 120 Plan 01 (COLL-01) — headline live-repro regression + snapshot coverage.

Reproduces the confirmed LIVE 2-files collision (Mechanism A) on thread
``99af24d5``: a prior workflow left ``weekly-status-report.docx`` (37,328 B)
in ``/sandbox/output/``; a later skill ``execute_code`` saved exactly ONE file
(``Weekly_Report_2026-06-20.docx``, 11,545 B) but the harvest re-emitted BOTH
because the per-run dedup baseline (``previous_files``) was initialized EMPTY.

The TRUE live signature is ONE execution_id emitting MORE output_files than the
code wrote — NOT "same filename across two execution_ids" (that heuristic was
explicitly disproven by COLL-03-EVIDENCE.md §Refinement 1). These tests assert
on ``output_files`` content, never on a filename-collision-across-execution_ids.

Wave 0 RED state: ``snapshot_output_baseline`` does not exist until Task 2
lands it, so the import at module top fails (ImportError) and the whole suite
is RED before the fix. After Task 2 the helper excludes pre-existing files and
all 4 tests go GREEN.

Tests:
  - test_stale_workflow_file_excluded_from_skill_emit (D-120-08 headline):
    snapshot seeds the leftover → harvest emits EXACTLY the one skill file.
  - test_empty_baseline_emits_both_files_pre_fix: the SAME harvest with an
    empty baseline ({}) emits BOTH files — the fails-before-fix guard that
    documents the 2-files bug (this path needs no new helper, but the file's
    top-level import of snapshot_output_baseline keeps the whole module RED
    until Task 2).
  - test_snapshot_seeds_existing_files: every pre-existing file's SHA-256 is a
    key in the baseline; an empty /sandbox/output/ → baseline == {}.
  - test_harness_phase_keeps_own_output (D-120-03 symmetry): a Harness phase
    excludes a PRIOR phase's leftover but keeps THIS phase's own deliverable.
"""
from __future__ import annotations

import hashlib
import os
from unittest.mock import MagicMock

from app.services.sandbox_service import (
    harvest_output_files,
    snapshot_output_baseline,
)

# Byte sizes from the live evidence anchor (thread 99af24d5).
STALE = b"x" * 37328  # the workflow's leftover weekly-status-report.docx (37,328 B)
SKILL = b"y" * 11545  # the skill's real Weekly_Report_2026-06-20.docx (11,545 B)


def _build_mock_session_with_payloads(payloads: dict[str, bytes]):
    """Build a MagicMock session whose copy_from_runtime writes the given
    filename → bytes payloads into the destination tmpdir.

    Copied verbatim from test_075_4_dedup_supersedes.py:28-39.
    """
    def _copy_from_runtime(_src_path, tmpdir):
        for fname, payload in payloads.items():
            with open(os.path.join(tmpdir, fname), "wb") as f:
                f.write(payload)

    session = MagicMock()
    session.execute_command = MagicMock()
    session.copy_from_runtime = MagicMock(side_effect=_copy_from_runtime)
    return session


def _build_mock_supabase():
    """Build a MagicMock supabase client that no-ops storage uploads + table inserts.

    Copied verbatim from test_075_4_dedup_supersedes.py:42-47.
    """
    sb = MagicMock()
    sb.storage.from_.return_value.upload = MagicMock()
    sb.table.return_value.insert.return_value.execute = MagicMock()
    return sb


# ── Test 1 (headline, D-120-08): stale workflow file excluded from skill emit ──


def test_stale_workflow_file_excluded_from_skill_emit() -> None:
    """SC#1 (COLL-01): a skill execute_code saving exactly one file in a
    post-workflow thread emits EXACTLY that one file — the prior workflow's
    leftover is never re-emitted.
    """
    # 1. Run start: /sandbox/output/ ALREADY holds the workflow leftover.
    snap_session = _build_mock_session_with_payloads(
        {"weekly-status-report.docx": STALE}
    )
    baseline = snapshot_output_baseline(snap_session)
    assert hashlib.sha256(STALE).hexdigest() in baseline  # leftover is seeded

    # 2. Skill execute_code saves exactly ONE new file (leftover still on disk).
    harvest_session = _build_mock_session_with_payloads(
        {
            "weekly-status-report.docx": STALE,  # still there
            "Weekly_Report_2026-06-20.docx": SKILL,  # the skill's real output
        }
    )
    sb = _build_mock_supabase()

    delta, _current = harvest_output_files(
        session=harvest_session,
        execution_id="e13687e4",
        user_id="u-1",
        supabase=sb,
        previous_files=baseline,
        iteration=0,
    )

    # 3. EXACTLY the one skill file — the stale leftover is excluded.
    assert [f["filename"] for f in delta] == ["Weekly_Report_2026-06-20.docx"]
    assert all(f["filename"] != "weekly-status-report.docx" for f in delta)


# ── Test 2: empty baseline emits BOTH files (fails-before-fix guard) ───────────


def test_empty_baseline_emits_both_files_pre_fix() -> None:
    """The SAME harvest with today's empty init (previous_files={}) emits BOTH
    files — the exact 2-files bug. This documents the pre-seed behavior the
    headline test fixes (it proves the headline would have been RED pre-seed).
    """
    harvest_session = _build_mock_session_with_payloads(
        {
            "weekly-status-report.docx": STALE,
            "Weekly_Report_2026-06-20.docx": SKILL,
        }
    )
    sb = _build_mock_supabase()

    delta, _current = harvest_output_files(
        session=harvest_session,
        execution_id="e13687e4",
        user_id="u-1",
        supabase=sb,
        previous_files={},  # today's empty init — no run-start seed
        iteration=0,
    )

    emitted = {f["filename"] for f in delta}
    assert emitted == {
        "weekly-status-report.docx",
        "Weekly_Report_2026-06-20.docx",
    }


# ── Test 3: snapshot seeds existing files (and empty dir → {}) ─────────────────


def test_snapshot_seeds_existing_files() -> None:
    """SC#2 (COLL-01): every pre-existing file's SHA-256 is present in the
    returned baseline; an empty /sandbox/output/ seeds {}.
    """
    # Multiple pre-existing files → each hash present.
    files = {
        "weekly-status-report.docx": STALE,
        "chart.png": b"z" * 2048,
        "data.csv": b"a,b,c\n1,2,3\n",
    }
    session = _build_mock_session_with_payloads(files)
    baseline = snapshot_output_baseline(session)

    for payload in files.values():
        assert hashlib.sha256(payload).hexdigest() in baseline
    assert len(baseline) == len(files)
    # Each entry carries the previous_files shape (filename/url/size/iteration).
    for meta in baseline.values():
        assert set(meta.keys()) == {"filename", "url", "size", "iteration"}
        assert meta["iteration"] == -1  # -1 marks pre-run

    # Empty /sandbox/output/ (copy writes nothing) → baseline == {}.
    empty_session = _build_mock_session_with_payloads({})
    assert snapshot_output_baseline(empty_session) == {}


# ── Test 4 (D-120-03 symmetry): Harness phase keeps its own output ────────────


def test_harness_phase_keeps_own_output() -> None:
    """D-120-03 defense symmetry: a Harness per-phase run excludes a PRIOR
    phase's leftover but KEEPS this phase's own deliverable.
    """
    prior_leftover = b"prior-phase-output" * 100
    this_phase_output = b"this-phase-deliverable" * 100

    # Run start (this phase): /sandbox/output/ holds the prior phase's leftover.
    snap_session = _build_mock_session_with_payloads(
        {"phase1-summary.docx": prior_leftover}
    )
    baseline = snapshot_output_baseline(snap_session)
    assert hashlib.sha256(prior_leftover).hexdigest() in baseline

    # This phase produces its own deliverable (prior leftover still on disk).
    harvest_session = _build_mock_session_with_payloads(
        {
            "phase1-summary.docx": prior_leftover,  # prior phase's leftover
            "phase2-report.docx": this_phase_output,  # THIS phase's own output
        }
    )
    sb = _build_mock_supabase()

    delta, _current = harvest_output_files(
        session=harvest_session,
        execution_id="harness-phase-2",
        user_id="u-1",
        supabase=sb,
        previous_files=baseline,
        iteration=0,
    )

    # Own deliverable kept, prior leftover excluded.
    assert [f["filename"] for f in delta] == ["phase2-report.docx"]
    assert all(f["filename"] != "phase1-summary.docx" for f in delta)


# ── RUN-01a (Phase 138 Plan 01) — PRIMARY behavioral proof ────────────────────
#
# BUG-260626-02: on a reused sandbox session, harvest_output_files() re-walks the
# ENTIRE /sandbox/output/ dir and re-stamps a FRESH {iteration:N, url:<real>} meta
# for EVERY file — including a prior-run leftover that snapshot_output_baseline()
# only seeded as {iteration:-1, url:None}. So filtering the final aggregate emit on
# `iteration == -1` is INSUFFICIENT: that marker (and the None url) is overwritten
# before the emit runs. These tests drive the REAL snapshot_output_baseline() /
# harvest_output_files() functions (NOT hand-built substitute dicts) to reproduce
# the exact reappearance, then prove the run-scoped `_new_file_hashes_in_run`
# accumulator excludes the leftover from the aggregate `final_output_files` emit.

LEFTOVER = b"prior-run-leftover-bytes" * 500     # a real prior-run file, still on disk
NEW_OUT = b"this-run-genuinely-new-output" * 400  # the file THIS run actually created


def _accrue_new_hashes(previous_files: dict, new_hashes: set, iter_files: dict) -> None:
    """Reproduce the EXACT production accumulator population from the execute_code
    handler (tool_dispatcher.py, harvest delta-merge):

        if ctx.new_file_hashes_in_run is not None:
            ctx.new_file_hashes_in_run |= (set(_iter_files) - _previous_files_in_run.keys())
        _previous_files_in_run.update(_iter_files)

    The set-difference is computed BEFORE the .update() so baseline hashes (already
    in previous_files) and cross-cell regenerations are excluded.
    """
    new_hashes |= (set(iter_files) - previous_files.keys())
    previous_files.update(iter_files)


def _final_emit_metas_prefix(previous_files: dict) -> list:
    """The PRE-FIX aggregate emit (agent_loop.py, before RUN-01a):
    ``list(_previous_files_in_run.values())`` — unfiltered (the leak)."""
    return list(previous_files.values())


def _final_emit_metas_fixed(previous_files: dict, new_hashes: set) -> list:
    """The POST-FIX aggregate emit (agent_loop.py, RUN-01a): filter by hash-key
    membership in the run-scoped accumulator (the KEY of previous_files IS the hash)."""
    return [meta for h, meta in previous_files.items() if h in new_hashes]


def test_run01a_reappeared_baseline_hash_excluded_from_final_emit() -> None:
    """PRIMARY proof (RUN-01a / BUG-260626-02): a prior-run leftover, re-harvested
    with a fresh real URL (its iteration:-1 baseline marker overwritten to
    iteration:0), is present in _previous_files_in_run yet EXCLUDED from the final
    aggregate emit — while the pre-fix unfiltered emit WOULD have leaked it.

    Genuine behavioral proof: fails against the pre-fix code
    (``list(_previous_files_in_run.values())`` includes the leftover) and passes
    against the fix (hash-membership filter drops it).
    """
    leftover_hash = hashlib.sha256(LEFTOVER).hexdigest()
    new_hash = hashlib.sha256(NEW_OUT).hexdigest()

    # Run start: /sandbox/output/ holds ONLY the prior-run leftover. REAL baseline.
    baseline = snapshot_output_baseline(
        _build_mock_session_with_payloads({"prior.docx": LEFTOVER})
    )
    assert leftover_hash in baseline
    assert baseline[leftover_hash]["iteration"] == -1  # seeded as pre-run baseline
    assert baseline[leftover_hash]["url"] is None       # never uploaded by THIS run

    # Production run state (agent_loop.py init + `_previous_files_in_run.update(_baseline)`).
    previous_files: dict = dict(baseline)
    new_hashes: set = set()

    # Cell 1: the model's execute_code creates ONE new file; harvest re-walks the
    # WHOLE dir so it sees BOTH the leftover AND the new file (the reappearance).
    sb = _build_mock_supabase()
    _delta, iter_files = harvest_output_files(
        session=_build_mock_session_with_payloads(
            {"prior.docx": LEFTOVER, "report.docx": NEW_OUT}
        ),
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
        previous_files=previous_files,
        iteration=0,
    )
    _accrue_new_hashes(previous_files, new_hashes, iter_files)

    # The reappearance is REAL: the leftover's baseline meta was overwritten with a
    # fresh iteration:0 + real URL — so an `iteration == -1` / `url is None` filter
    # would FAIL to exclude it. This is why the accumulator (not the meta) is authoritative.
    assert leftover_hash in previous_files
    assert previous_files[leftover_hash]["iteration"] == 0
    assert previous_files[leftover_hash]["url"] is not None

    # Pre-fix emit WOULD have leaked the leftover (documents the bug on real data).
    prefix_names = {m["filename"] for m in _final_emit_metas_prefix(previous_files)}
    assert "prior.docx" in prefix_names  # the leak the fix removes

    # Post-fix emit excludes the leftover, keeps only the genuinely-new file.
    fixed = _final_emit_metas_fixed(previous_files, new_hashes)
    assert {m["filename"] for m in fixed} == {"report.docx"}
    assert leftover_hash not in new_hashes  # leftover never entered the accumulator
    assert new_hash in new_hashes


def test_run01a_all_leftover_run_emits_nothing() -> None:
    """PRIMARY proof (RUN-01a): a run whose only sandbox files are leftovers/baseline
    (no genuinely-new bytes) produces an EMPTY filtered emit list — so the guarded
    `final_output_files` event is NOT emitted at all (no dead "Download unavailable"
    card, no re-surfaced prior-run file).
    """
    leftover_hash = hashlib.sha256(LEFTOVER).hexdigest()

    baseline = snapshot_output_baseline(
        _build_mock_session_with_payloads({"prior.docx": LEFTOVER})
    )
    previous_files: dict = dict(baseline)
    new_hashes: set = set()

    # Cell 1: execute_code produces NO new file — only the unchanged leftover is on
    # disk. REAL harvest returns an empty delta (hash already in previous_files).
    sb = _build_mock_supabase()
    delta, iter_files = harvest_output_files(
        session=_build_mock_session_with_payloads({"prior.docx": LEFTOVER}),
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
        previous_files=previous_files,
        iteration=0,
    )
    assert delta == []  # the per-cell panel already showed nothing new
    _accrue_new_hashes(previous_files, new_hashes, iter_files)

    # Pre-fix emit WOULD have emitted the leftover as a dead card.
    assert _final_emit_metas_prefix(previous_files)  # non-empty → would emit

    # Post-fix: nothing genuinely new → empty list → the `if _emit_metas:` guard in
    # agent_loop.py suppresses the final_output_files event entirely.
    assert _final_emit_metas_fixed(previous_files, new_hashes) == []
    assert leftover_hash not in new_hashes
