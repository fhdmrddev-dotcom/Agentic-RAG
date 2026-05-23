"""Phase 075.4 Plan 03 Task 1 — final_output_files SSE payload shape.

Test 6 (BUG-260522-02 close + BUG-260521-02 auto-close):
The ``final_output_files`` SSE event payload emitted at the end of an agent
run MUST carry filename + url + size for every entry — not just filename.

Before Plan 03, the emit was:
    files=[{"filename": fname} for fname in sorted(_previous_files_in_run)]
The frontend pinned panel therefore had no signed URL to render a download
link, surfacing as BUG-260521-02 (pinned panel no download link).

After Plan 03, the dedup refactor pivots _previous_files_in_run to a
``dict[content_hash, {filename, url, size, iteration}]`` shape; the emit
becomes a comprehension over .values() that propagates url + size from
the per-hash meta — naturally closing BUG-260522-02 (which auto-closes
BUG-260521-02 per its re_open_trigger).

This test exercises the emit shape via source-text assertion (the
emit lives deep in send_message and isn't a clean function-call to mock).
"""
from __future__ import annotations

import re
from pathlib import Path


def test_final_output_files_emit_carries_filename_url_size_keys() -> None:
    """The final_output_files emit list-comprehension at threads.py:~2964-2982
    region MUST iterate ``_previous_files_in_run.values()`` and project
    filename + url + size from each meta dict.

    Closes BUG-260522-02 (no url in payload) — auto-closes BUG-260521-02
    (pinned panel no download link) per its re_open_trigger.
    """
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")

    # 1. The emit MUST iterate .values() (per-hash meta), not iterate the
    #    keys (which would yield content_hash strings).
    assert re.search(
        r"_previous_files_in_run\.values\(\)",
        text,
    ), (
        "final_output_files emit must iterate _previous_files_in_run.values() "
        "to access per-hash meta dicts (filename, url, size, iteration)."
    )

    # 2. The comprehension must project filename, url, size keys from each
    #    meta dict. We look for the canonical shape.
    assert re.search(
        r'"filename"\s*:\s*meta\["filename"\]',
        text,
    ), 'Comprehension must include `"filename": meta["filename"]`'
    assert re.search(
        r'"url"\s*:\s*meta\["url"\]',
        text,
    ), 'Comprehension must include `"url": meta["url"]` (BUG-260522-02 close)'
    assert re.search(
        r'"size"\s*:\s*meta\["size"\]',
        text,
    ), 'Comprehension must include `"size": meta["size"]` (BUG-260522-02 close)'

    # 3. The old filename-only emit must be GONE.
    assert not re.search(
        r'\[\s*\{\s*"filename"\s*:\s*fname\s*\}\s+for\s+fname\s+in\s+sorted\(_previous_files_in_run\)\s*\]',
        text,
    ), "Old filename-only emit shape must be removed (BUG-260522-02 root cause)."


def test_final_output_files_emit_under_if_guard() -> None:
    """The emit must be guarded by ``if _previous_files_in_run:`` so empty-
    output runs don't emit a no-op SSE event."""
    src = Path(__file__).parent.parent.parent / "app" / "api" / "threads.py"
    text = src.read_text(encoding="utf-8")

    # Match the if-guard + emit pattern (allowing whitespace + intermediate text)
    m = re.search(
        r"if\s+_previous_files_in_run:\s*\n\s*await\s+_emit\(\s*\n?\s*redis,\s*run_id,\s*'final_output_files'",
        text,
    )
    assert m, "final_output_files emit must be inside `if _previous_files_in_run:` guard"
