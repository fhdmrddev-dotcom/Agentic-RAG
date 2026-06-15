"""Phase 111 Wave-0 — lmstudio first-class provider registration (D-111-7).

LM Studio is registered as a first-class provider (no Ollama-impersonation):
  - `"lmstudio"` is a key in `config._PROVIDER_BASE_URLS`;
  - after `Settings(llm_provider="lmstudio", ...)` resolves, `llm_base_url` ==
    the configured `lmstudio_base_url` with NO extra `/v1` appended (LM Studio's
    URL already ends in /v1 — unlike ollama which appends /v1);
  - the resolved key is the dummy `lm-studio`.

This file starts xfail (Wave-0 RED), and Task 3 of Plan 01 flips it GREEN by
registering the provider. After Task 3 the @pytest.mark.xfail decorators are
removed and these are real assertions.
"""

import pytest


@pytest.mark.xfail(
    reason="lmstudio provider not registered until Plan 01 Task 3 (D-111-7)",
    strict=False,
)
def test_lmstudio_in_provider_base_urls():
    from app.config import _PROVIDER_BASE_URLS

    assert "lmstudio" in _PROVIDER_BASE_URLS, "lmstudio must be a registered provider"


@pytest.mark.xfail(
    reason="lmstudio provider not registered until Plan 01 Task 3 (D-111-7)",
    strict=False,
)
def test_lmstudio_resolves_base_url_no_v1_append_and_dummy_key():
    from app.config import Settings

    s = Settings(
        llm_provider="lmstudio",
        lmstudio_base_url="http://localhost:1234/v1",
    )
    # The URL already includes /v1 — NO extra append (the ollama branch DOES append).
    assert s.llm_base_url == "http://localhost:1234/v1", (
        f"lmstudio base_url must NOT double-append /v1 (got {s.llm_base_url!r})"
    )
    assert not s.llm_base_url.endswith("/v1/v1"), "no /v1/v1 double-append"
    # Dummy key (like ollama's keyless 'ollama').
    assert s.llm_api_key == "lm-studio", (
        f"lmstudio resolves the dummy 'lm-studio' key (got {s.llm_api_key!r})"
    )
