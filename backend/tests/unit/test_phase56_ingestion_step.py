"""Unit tests for Phase 56 ingestion_step column updates in ingest_document() (D-10/D-11).

TDD RED phase: tests are written against behaviors not yet in production code.
They WILL FAIL until Task 4 (documents.py patch) is applied.

Tests:
  - test_ingestion_step_values_are_hardcoded_strings: source-inspect documents.py,
    confirm four literal strings appear each adjacent to 'ingestion_step'.
    Guards against f-string interpolation of user-controlled values (security).
  - test_ingestion_step_updates_present_in_ingest_document: source-inspect the
    ingest_document function; assert 'ingestion_step' appears >= 4 times.
  - test_ingestion_step_never_uses_user_input: lines containing 'ingestion_step'
    must NOT contain f-strings or interpolation of function parameters.
"""
import inspect
import os
import sys

import pytest

# ---------------------------------------------------------------------------
# Path setup — mirror pattern from test_streaming_reliability.py
# ---------------------------------------------------------------------------
backend_path = os.path.join(os.path.dirname(__file__), "..", "..")
if os.path.abspath(backend_path) not in sys.path:
    sys.path.insert(0, os.path.abspath(backend_path))


# ---------------------------------------------------------------------------
# CLASS 1: Source-inspection of documents.py for ingestion_step writes
# ---------------------------------------------------------------------------

class TestIngestionStepSequence:
    """Source-inspect documents.py to confirm ingestion_step writes are present."""

    def test_ingestion_step_values_are_hardcoded_strings(self):
        """All four stage literal strings appear in documents.py, each within
        ±2 lines of 'ingestion_step'.  Guards against the strings being only
        in comments or docstrings that are never executed.

        Required strings: 'extracting', 'chunking', 'embedding', 'metadata'
        (as values of the ingestion_step key in a dict literal).
        """
        import app.api.documents as documents_module

        source = inspect.getsource(documents_module)
        lines = source.splitlines()

        required_stages = ["extracting", "chunking", "embedding", "metadata"]

        for stage in required_stages:
            assert f'"ingestion_step": "{stage}"' in source or f"'ingestion_step': '{stage}'" in source, (
                f"documents.py must contain an ingestion_step update with the literal value "
                f'"{stage}". Task 4 has not been applied yet.'
            )

        # Confirm each stage appears within ±2 lines of 'ingestion_step'
        for stage in required_stages:
            found_adjacent = False
            for i, line in enumerate(lines):
                if "ingestion_step" in line and stage in line:
                    found_adjacent = True
                    break
                # Check ±2 line window (stage on adjacent lines)
                window_start = max(0, i - 2)
                window_end = min(len(lines), i + 3)
                if "ingestion_step" in line:
                    window = lines[window_start:window_end]
                    if any(stage in wl for wl in window):
                        found_adjacent = True
                        break
            assert found_adjacent, (
                f"Stage '{stage}' not found adjacent to 'ingestion_step' in documents.py. "
                "The value may only appear in a comment or doc, not an actual update call."
            )

    def test_ingestion_step_updates_present_in_ingest_document(self):
        """ingest_document() source must contain 'ingestion_step' at least 4 times
        (one per processing stage: extracting, chunking, embedding, metadata).
        """
        import app.api.documents as documents_module

        func_source = inspect.getsource(documents_module.ingest_document)
        count = func_source.count("ingestion_step")
        assert count >= 4, (
            f"ingest_document() must reference 'ingestion_step' at least 4 times "
            f"(one per stage), found {count}. Task 4 has not been applied yet."
        )


# ---------------------------------------------------------------------------
# CLASS 2: Security guard — no user input in ingestion_step values
# ---------------------------------------------------------------------------

class TestIngestionStepNoUserInput:
    """Verify ingestion_step writes use only hardcoded string literals."""

    def test_ingestion_step_never_uses_user_input(self):
        """Lines containing 'ingestion_step' in ingest_document() must NOT contain
        f-strings or interpolation of function parameters.

        The ingestion_step column must only ever receive one of the four
        hardcoded string constants.  Any line that contains both 'ingestion_step'
        and an f-string token, or a reference to the function parameters
        (filename, text, mime_type, user_id) is a potential injection vector.

        Forbidden tokens on the same line as 'ingestion_step':
          f"  f'  {filename}  {text}  {mime_type}  {user_id}
        """
        import app.api.documents as documents_module

        func_source = inspect.getsource(documents_module.ingest_document)
        func_lines = func_source.splitlines()

        forbidden_tokens = ['f"', "f'", "{filename}", "{text}", "{mime_type}", "{user_id}"]

        violations = []
        for lineno, line in enumerate(func_lines, start=1):
            if "ingestion_step" in line:
                for token in forbidden_tokens:
                    if token in line:
                        violations.append(
                            f"Line {lineno}: contains both 'ingestion_step' and forbidden "
                            f"token '{token}': {line.strip()!r}"
                        )

        assert not violations, (
            "Security violation: ingestion_step update uses user-controlled input or f-string.\n"
            + "\n".join(violations)
        )
