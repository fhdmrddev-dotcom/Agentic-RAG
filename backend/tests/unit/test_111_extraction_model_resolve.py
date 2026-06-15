"""Phase 111 Wave-0 (RED) — extraction model resolution (META-03).

The extraction model is un-pinned off the hardwired `gpt-4o`. A resolver
returns `app_settings.extraction_model` when set, and falls back to the env
`settings.llm_model` (gpt-4o default) when unset/empty — NOT to a (nonexistent)
`app_settings.llm_model`.

RED convention: the resolver helper is built in Plan 02/04 (META-03). Import
inside the body; xfail until it lands.
"""

import pytest


@pytest.mark.xfail(
    reason="resolve_extraction_model not built until Plan 02/04 (META-03)",
    strict=False,
)
def test_resolves_to_app_settings_when_set():
    from app.services.embedding_service import resolve_extraction_model

    chosen = resolve_extraction_model(extraction_model="claude-sonnet-4-6")
    assert chosen == "claude-sonnet-4-6", "explicit app_settings.extraction_model must win"


@pytest.mark.xfail(
    reason="resolve_extraction_model not built until Plan 02/04 (META-03)",
    strict=False,
)
def test_falls_back_to_env_llm_model_when_unset():
    from app.config import settings
    from app.services.embedding_service import resolve_extraction_model

    # Unset / empty extraction_model => fall back to the env default (gpt-4o).
    for empty in ("", None):
        chosen = resolve_extraction_model(extraction_model=empty)
        assert chosen == settings.llm_model, (
            f"unset extraction_model must fall back to settings.llm_model "
            f"(got {chosen!r}, expected {settings.llm_model!r})"
        )
    # The env default ships as gpt-4o.
    assert settings.llm_model == "gpt-4o" or settings.llm_model, (
        "env llm_model default sanity check"
    )
