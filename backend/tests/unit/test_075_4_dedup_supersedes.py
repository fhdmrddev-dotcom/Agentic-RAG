"""Phase 075.4 Plan 03 Task 1 — content-hash dedup + supersedes coverage.

Tests for ``harvest_output_files`` SHA-256 content-hash dedup behavior:
- Test 1: identical hash → skip (true duplicate; structurally closes
  BUG-260523-03 OpenRouter duplicate outputs).
- Test 2: same filename, different hash → delta carries ``supersedes`` key
  (Plan 04 Wave 2 hook — OutputFileCard "Replaces: <prev>" affordance).
- Test 3: empty previous + 5 distinct files → 5 delta entries, no
  supersedes key on any.
- Test 4: ``hashlib.sha256(data).hexdigest()`` returns 64-char hex
  (verify our hash-shape assumption for ~5MB payloads).
- Test 5: closure var ``_previous_files_in_run: dict[str, dict] = {}``
  shape at threads.py: source-text assertion.
- Test 7: same hash + different filename (operator-renamed) → no-op
  skip (hash is the authority, not the filename).

(Test 6 lives in test_075_4_final_output_files_payload.py.)
"""
from __future__ import annotations

import hashlib
import os
import re
from pathlib import Path
from unittest.mock import MagicMock


def _build_mock_session_with_payloads(payloads: dict[str, bytes]):
    """Build a MagicMock session whose copy_from_runtime writes the given
    filename → bytes payloads into the destination tmpdir."""
    def _copy_from_runtime(_src_path, tmpdir):
        for fname, payload in payloads.items():
            with open(os.path.join(tmpdir, fname), "wb") as f:
                f.write(payload)

    session = MagicMock()
    session.execute_command = MagicMock()
    session.copy_from_runtime = MagicMock(side_effect=_copy_from_runtime)
    return session


def _build_mock_supabase():
    """Build a MagicMock supabase client that no-ops storage uploads + table inserts."""
    sb = MagicMock()
    sb.storage.from_.return_value.upload = MagicMock()
    sb.table.return_value.insert.return_value.execute = MagicMock()
    return sb


# ── Test 1: identical hash → skip (true duplicate) ────────────────────────────


def test_identical_hash_returns_empty_delta() -> None:
    """When a new harvest produces a file whose SHA-256 matches a previous
    iteration's entry, the delta MUST be empty (skip true duplicate).

    Structurally closes BUG-260523-03 (OpenRouter duplicate output rendering).
    """
    from app.services.sandbox_service import harvest_output_files

    payload = b"identical bytes - iteration 1 and 2 produce same file"
    h = hashlib.sha256(payload).hexdigest()

    session = _build_mock_session_with_payloads({"out.pptx": payload})
    sb = _build_mock_supabase()

    previous = {
        h: {
            "filename": "out.pptx",
            "url": "/sandbox-outputs/u-1/exec-prev/out.pptx",
            "size": len(payload),
            "iteration": 0,
        }
    }

    delta_files, current = harvest_output_files(
        session=session,
        execution_id="exec-1",
        user_id="u-1",
        supabase=sb,
        previous_files=previous,
        iteration=1,
    )
    assert delta_files == [], "identical hash must produce empty delta"
    # cumulative still tracks the current state
    assert h in current
    assert current[h]["filename"] == "out.pptx"


# ── Test 2: same filename, different hash → delta with supersedes key ─────────


def test_same_filename_different_hash_emits_supersedes() -> None:
    """When iteration N produces a file with the SAME filename but a DIFFERENT
    hash than a previous iteration's file, the delta entry MUST carry a
    ``supersedes`` key naming the previous filename.

    Plan 04 (Wave 2) OutputFileCard reads this to render the
    "Replaces: <prev_filename>" affordance.
    """
    from app.services.sandbox_service import harvest_output_files

    old_payload = b"v1 deck content"
    new_payload = b"v2 deck content (revised charts)"
    old_hash = hashlib.sha256(old_payload).hexdigest()

    session = _build_mock_session_with_payloads({"deck.pptx": new_payload})
    sb = _build_mock_supabase()

    previous = {
        old_hash: {
            "filename": "deck.pptx",
            "url": "/sandbox-outputs/u-1/exec-prev/deck.pptx",
            "size": len(old_payload),
            "iteration": 0,
        }
    }

    delta_files, current = harvest_output_files(
        session=session,
        execution_id="exec-2",
        user_id="u-1",
        supabase=sb,
        previous_files=previous,
        iteration=1,
    )
    assert len(delta_files) == 1
    entry = delta_files[0]
    assert entry["filename"] == "deck.pptx"
    assert entry["size"] == len(new_payload)
    assert "supersedes" in entry, "delta must carry supersedes key when hash differs"
    assert entry["supersedes"] == "deck.pptx"
    # current contains BOTH hashes (cumulative state; not a replace)
    assert len(current) == 1  # current iteration only writes its own files; previous gets re-passed by caller
    # The NEW hash is in current
    new_hash = hashlib.sha256(new_payload).hexdigest()
    assert new_hash in current


# ── Test 3: empty previous + 5 distinct files → 5 delta, no supersedes ────────


def test_empty_previous_with_distinct_files_returns_all_no_supersedes() -> None:
    """First iteration of a run: previous={}; 5 distinct-payload files → all
    5 appear in delta, none carry supersedes."""
    from app.services.sandbox_service import harvest_output_files

    payloads = {
        "a.png": b"alpha bytes",
        "b.png": b"bravo bytes",
        "c.png": b"charlie bytes",
        "d.png": b"delta bytes",
        "e.png": b"echo bytes",
    }
    session = _build_mock_session_with_payloads(payloads)
    sb = _build_mock_supabase()

    delta_files, current = harvest_output_files(
        session=session,
        execution_id="exec-3",
        user_id="u-1",
        supabase=sb,
        previous_files={},
        iteration=0,
    )
    assert len(delta_files) == 5
    assert {f["filename"] for f in delta_files} == set(payloads.keys())
    for entry in delta_files:
        assert "supersedes" not in entry, f"first-iteration delta should not carry supersedes; got {entry}"
    # Each unique payload → unique hash → 5 keys in current
    assert len(current) == 5


# ── Test 4: SHA-256 shape sanity ──────────────────────────────────────────────


def test_sha256_hex_is_64_char_string_for_5mb_payload() -> None:
    """Verify hashlib.sha256(data).hexdigest() returns a 64-char hex string
    for a ~5MB payload (D-075.4-D1 — RESEARCH confirmed perf is fine at
    ~5MB/s; this test guards the SHAPE assumption, not the speed)."""
    payload = os.urandom(5 * 1024 * 1024)  # 5 MB random
    h = hashlib.sha256(payload).hexdigest()
    assert len(h) == 64
    assert re.fullmatch(r"[0-9a-f]{64}", h), f"hex digest shape wrong: {h!r}"


# ── Test 5: closure-var shape at threads.py ──────────────────────────────────


def test_previous_files_in_run_closure_shape() -> None:
    """The closure-local var at threads.py:~1630 region MUST be typed as
    ``dict[str, dict]`` with empty-dict initializer (D-075.4-D1/D2)."""
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")
    # canonical shape (allow extra whitespace, optional trailing comment)
    assert re.search(
        r"_previous_files_in_run\s*:\s*dict\[\s*str\s*,\s*dict\s*\]\s*=\s*\{\}",
        text,
    ), "_previous_files_in_run must be initialized as dict[str, dict] = {}"
    # Old set-shape MUST be gone
    assert not re.search(
        r"_previous_files_in_run\s*:\s*set\[\s*str\s*\]\s*=\s*set\(\)",
        text,
    ), "Old set[str] = set() shape must be removed"


# ── Test 7: same hash + different filename → skip ─────────────────────────────


def test_same_hash_different_filename_is_skipped() -> None:
    """If an operator renames a sandbox-emitted file across iterations
    (filename changes, bytes don't), the hash dedup catches it — no
    duplicate render."""
    from app.services.sandbox_service import harvest_output_files

    payload = b"identical bytes despite rename"
    h = hashlib.sha256(payload).hexdigest()

    session = _build_mock_session_with_payloads({"renamed.png": payload})
    sb = _build_mock_supabase()

    previous = {
        h: {
            "filename": "original.png",
            "url": "/sandbox-outputs/u-1/exec-prev/original.png",
            "size": len(payload),
            "iteration": 0,
        }
    }

    delta_files, current = harvest_output_files(
        session=session,
        execution_id="exec-rename",
        user_id="u-1",
        supabase=sb,
        previous_files=previous,
        iteration=1,
    )
    assert delta_files == [], "same hash → skip even when filename changes"
    assert h in current  # current iteration still records what it produced
