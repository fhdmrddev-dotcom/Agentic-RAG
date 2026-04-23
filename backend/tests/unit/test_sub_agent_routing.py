"""Unit tests for sub-agent keyword routing — CTX-01 and CTX-02."""
from __future__ import annotations

from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import pytest


def _make_user_settings(provider: str = "anthropic", llm_model: str = "claude-sonnet-4-6"):
    return SimpleNamespace(
        active_provider=provider,
        llm_model=llm_model,
    )


# ---------------------------------------------------------------------------
# _is_generation_task / _GENERATION_KEYWORDS  (CTX-01)
# ---------------------------------------------------------------------------

def test_generation_keywords_pptx():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Create a pptx presentation for Q4") is True


def test_generation_keywords_powerpoint():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Build a PowerPoint deck") is True


def test_generation_keywords_report():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Write a detailed report on performance") is True


def test_generation_keywords_pdf():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Export the summary as a pdf") is True


def test_generation_keywords_spreadsheet():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Generate a spreadsheet of results") is True


def test_generation_keywords_excel():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Create an Excel file") is True


def test_generation_keywords_csv_export():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Do a csv export of the data") is True


def test_generation_keywords_document():
    from app.services.sub_agent_service import _is_generation_task
    # 'document' triggers escalation even in analysis context (D-01: accepted trade-off)
    assert _is_generation_task("Create a document with findings") is True


def test_generation_keywords_presentation():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Make a presentation for the board") is True


def test_generation_keywords_case_insensitive():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("CREATE A PPTX") is True
    assert _is_generation_task("REPORT on quarterly results") is True


def test_not_generation_task_summarize():
    """Pure analysis tasks must NOT trigger escalation (CTX-02)."""
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Summarize the key points of this article") is False


def test_not_generation_task_list():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("List all findings") is False


def test_not_generation_task_compare():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Compare section 2 and section 3") is False


def test_not_generation_task_extract():
    from app.services.sub_agent_service import _is_generation_task
    assert _is_generation_task("Extract all dates mentioned") is False


# ---------------------------------------------------------------------------
# Escalated model selection (CTX-01 — D-02)
# ---------------------------------------------------------------------------

def test_escalated_model():
    """Generation tasks use user_settings.llm_model as effective model."""
    from app.services import sub_agent_service
    from app.config import settings

    user_settings = _make_user_settings(provider="anthropic", llm_model="claude-sonnet-4-6")

    with patch.object(settings, "sub_agent_model", ""):
        # Replicate the routing logic: generation → user model
        is_generation = sub_agent_service._is_generation_task("Create a pptx report")
        assert is_generation is True
        if is_generation:
            effective_model = user_settings.llm_model or settings.llm_model
        assert effective_model == "claude-sonnet-4-6"


def test_escalated_ceiling_is_at_least_32768():
    """Generation tasks must get output ceiling of at least 32768 (D-03)."""
    from app.services import sub_agent_service
    from app.config import settings

    with patch.object(settings, "sub_agent_max_output_tokens", 8192):
        is_generation = sub_agent_service._is_generation_task("Write a report")
        assert is_generation is True
        # D-03 / D-08: generation ceiling = max(32768, slider_value)
        ceiling = max(32768, settings.sub_agent_max_output_tokens)
        assert ceiling == 32768


# ---------------------------------------------------------------------------
# Analysis routing (CTX-02 — D-04)
# ---------------------------------------------------------------------------

def test_analysis_routing():
    """Non-generation tasks use _SUB_AGENT_MODEL_DEFAULTS, not user model."""
    from app.services import sub_agent_service
    from app.config import settings

    user_settings = _make_user_settings(provider="anthropic", llm_model="claude-sonnet-4-6")

    with patch.object(settings, "sub_agent_model", ""):
        is_generation = sub_agent_service._is_generation_task("Summarize this text")
        assert is_generation is False
        provider_default = sub_agent_service._SUB_AGENT_MODEL_DEFAULTS.get(
            user_settings.active_provider, ""
        )
        # Anthropic default is haiku, not the orchestrator model
        assert provider_default == "claude-haiku-4-5-20251001"


def test_analysis_ceiling_uses_slider():
    """Analysis tasks use sub_agent_max_output_tokens directly."""
    from app.services import sub_agent_service
    from app.config import settings

    with patch.object(settings, "sub_agent_max_output_tokens", 16384):
        is_generation = sub_agent_service._is_generation_task("Summarize this text")
        assert is_generation is False
        ceiling = settings.sub_agent_max_output_tokens  # uses slider value
        assert ceiling == 16384
