"""Phase 111.1 Wave-0 (RED) — local-aware forced_emit injection (D-09 #2).

`forced_emit`'s cross-provider injection block only injects creds when
`settings.{provider}_api_key` is truthy. Local providers have no such env key, so
a forced shot targeting an lmstudio/ollama model falls through to the WRONG active
provider (a forced emit aimed at a local model leaks to the cloud / errors).

Fix (Plan 02): a local-provider branch injects the dummy key + local base_url
(mirroring `resolve_llm_provider`):
  - ollama:   llm_api_key="ollama",    llm_base_url=ollama_base_url + "/v1"
  - lmstudio: llm_api_key="lm-studio", llm_base_url=lmstudio_base_url AS-IS

RED convention: import inside the body; xfail(strict=False).
"""

import pytest


@pytest.mark.xfail(
    reason="local-aware forced_emit branch lands in Plan 02 (D-09 #2)",
    strict=False,
)
def test_forced_emit_injects_ollama_dummy_key_and_local_base_url():
    from app.services.forced_emit import _inject_local_provider_creds

    settings_like = _inject_local_provider_creds(provider="ollama", base_url="http://localhost:11434")
    assert settings_like["llm_api_key"] == "ollama", "ollama forced shot uses the dummy 'ollama' key"
    assert settings_like["llm_base_url"].rstrip("/").endswith("/v1"), "ollama appends /v1"


@pytest.mark.xfail(
    reason="local-aware forced_emit branch lands in Plan 02 (D-09 #2)",
    strict=False,
)
def test_forced_emit_lmstudio_no_double_v1():
    from app.services.forced_emit import _inject_local_provider_creds

    settings_like = _inject_local_provider_creds(provider="lmstudio", base_url="http://localhost:1234/v1")
    assert settings_like["llm_api_key"] == "lm-studio", "lmstudio forced shot uses the dummy 'lm-studio' key"
    assert "/v1/v1" not in settings_like["llm_base_url"], "LM Studio URL already ends /v1 — no double append"
