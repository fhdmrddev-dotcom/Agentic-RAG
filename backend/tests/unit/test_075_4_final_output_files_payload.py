"""Phase 075.4 Plan 03 Task 1 — final_output_files SSE payload shape.
   Phase 138 Plan 01 (RUN-01a) — baseline/leftover exclusion filter (source-shape).

Test 6 (BUG-260522-02 close + BUG-260521-02 auto-close):
The ``final_output_files`` SSE event payload emitted at the end of an agent
run MUST carry filename + url + size for every entry — not just filename.

Before Plan 03, the emit was:
    files=[{"filename": fname} for fname in sorted(_previous_files_in_run)]
The frontend pinned panel therefore had no signed URL to render a download
link, surfacing as BUG-260521-02 (pinned panel no download link).

After Plan 03, the dedup refactor pivoted _previous_files_in_run to a
``dict[content_hash, {filename, url, size, iteration}]`` shape.

Phase 138 (RUN-01a / BUG-260626-02): the aggregate emit no longer iterates
``_previous_files_in_run.values()`` unfiltered — that leaked baseline/leftover
files re-harvested with fresh URLs. The emit now iterates
``_previous_files_in_run.items()`` (the KEY is the SHA-256 content-hash) and
keeps only metas whose hash is in the run-scoped ``_new_file_hashes_in_run``
accumulator. It still propagates filename + url + size + is_hero.

SUPPLEMENTARY / source-shape only: this file has always been a source-text
(regex) assertion test — the emit lives deep in run_agent_loop and isn't a
clean function-call to mock. It is NOT authoritative proof that the filtering
BEHAVIOR is correct; that proof lives in test_120_collision_regression.py
(real snapshot_output_baseline()/harvest_output_files() reappearance case).
"""
from __future__ import annotations

import re
from pathlib import Path


def _agent_loop_text() -> str:
    src = Path(__file__).parent.parent.parent / "app" / "services" / "agent_loop.py"
    return src.read_text(encoding="utf-8")


def test_final_output_files_emit_carries_filename_url_size_keys() -> None:
    """The final_output_files emit list-comprehension MUST project filename +
    url + size (+ is_hero) from each per-hash meta dict.

    Closes BUG-260522-02 (no url in payload) — auto-closes BUG-260521-02
    (pinned panel no download link) per its re_open_trigger.
    """
    text = _agent_loop_text()

    # 1. The comprehension must project filename, url, size, is_hero from each
    #    meta dict (the payload wire shape — D-14 unchanged).
    assert re.search(
        r'"filename"\s*:\s*meta\["filename"\]',
        text,
    ), 'Comprehension must include `"filename": meta["filename"]`'
    assert re.search(
        r'"url"\s*:\s*meta\.get\("url"\)\s*or\s*""',
        text,
    ), 'Comprehension must include a url guarded via `meta.get("url") or ""`'
    assert re.search(
        r'"size"\s*:\s*meta\["size"\]',
        text,
    ), 'Comprehension must include `"size": meta["size"]` (BUG-260522-02 close)'
    assert re.search(
        r'"is_hero"\s*:\s*meta\["filename"\]\s+in\s+_hero_set',
        text,
    ), 'Comprehension must include the additive `"is_hero"` flag'

    # 2. The old filename-only emit must be GONE.
    assert not re.search(
        r'\[\s*\{\s*"filename"\s*:\s*fname\s*\}\s+for\s+fname\s+in\s+sorted\(_previous_files_in_run\)\s*\]',
        text,
    ), "Old filename-only emit shape must be removed (BUG-260522-02 root cause)."


def test_final_output_files_emit_filters_new_this_run_hashes() -> None:
    """RUN-01a source-shape: the emit metas MUST be derived by filtering
    ``_previous_files_in_run.items()`` (the KEY is the content-hash) against the
    run-scoped ``_new_file_hashes_in_run`` accumulator — NOT the old unfiltered
    ``list(_previous_files_in_run.values())``.

    SUPPLEMENTARY only — the authoritative behavioral proof lives in
    test_120_collision_regression.py.
    """
    text = _agent_loop_text()

    # The aggregate emit must read identity from .items() (the hash key) and
    # filter by membership in the run-scoped accumulator.
    assert re.search(
        r"_previous_files_in_run\.items\(\)",
        text,
    ), "emit metas must be derived from _previous_files_in_run.items() (hash key)"
    assert re.search(
        r"if\s+_h\s+in\s+_new_file_hashes_in_run",
        text,
    ), "emit metas must be filtered by `if _h in _new_file_hashes_in_run` (RUN-01a)"

    # The old UNFILTERED aggregate emit must be GONE.
    assert not re.search(
        r"_emit_metas\s*=\s*list\(_previous_files_in_run\.values\(\)\)",
        text,
    ), "Old unfiltered `list(_previous_files_in_run.values())` emit must be removed (RUN-01a)."


def test_final_output_files_emit_under_if_guard() -> None:
    """The emit must be guarded so empty runs don't emit a no-op SSE event.

    Two nested guards after RUN-01a: the outer ``if _previous_files_in_run:``
    (any files tracked at all) and the inner ``if _emit_metas:`` (at least one
    file genuinely new to THIS run — a run that surfaced only leftovers/baseline
    emits nothing).
    """
    text = _agent_loop_text()

    assert re.search(
        r"if\s+_previous_files_in_run:",
        text,
    ), "outer `if _previous_files_in_run:` guard must remain"
    assert re.search(
        r"if\s+_emit_metas:",
        text,
    ), "inner `if _emit_metas:` guard must gate the emit (RUN-01a all-leftover run emits nothing)"

    # The actual emit call is still reached under the guards.
    assert re.search(
        r"await\s+_emit\(\s*redis,\s*run_id,\s*'final_output_files'",
        text,
    ), "final_output_files emit call must remain under the guards"
