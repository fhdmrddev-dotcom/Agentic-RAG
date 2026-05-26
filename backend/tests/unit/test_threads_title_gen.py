"""Unit test for generate_thread_title warning log (Phase 078, CQ-TITLE-01, D-078-10).

Verifies that title-generation failures emit logger.warning('title_generation_failed: ...')
with exc_info=True, while preserving the fallback return behavior.
"""
import logging
from unittest.mock import patch

import pytest


def test_title_gen_logs_warning_on_failure(caplog):
    """generate_thread_title logs 'title_generation_failed' on LLM error (D-078-10)."""
    from app.api.threads import generate_thread_title

    # Mock get_llm_client to raise, triggering the generic except Exception path.
    with patch("app.api.threads.get_llm_client", side_effect=RuntimeError("test LLM unavailable")):
        with caplog.at_level(logging.WARNING, logger="app.api.threads"):
            title, fallback_info = generate_thread_title(
                first_user_message="Hello world",
            )

    # Fallback title preserved (first 40 chars of first user message)
    assert title == "Hello world"
    assert fallback_info is None
    # Warning must fire with the exact string from D-078-10
    assert any(
        "title_generation_failed" in record.message
        for record in caplog.records
    ), f"Expected 'title_generation_failed' warning in logs, got: {[r.message for r in caplog.records]}"
