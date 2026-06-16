"""Phase 111.1 Wave-0 (RED) — OpenRouter mangle does NOT fire for local ids (D-09 #3).

`openai_service`'s OpenRouter quality strategy appends `:exacto` + a
`response-healing` plugin whenever `effective_model` contains a slash. Every
Ollama/LM Studio model id is `org/model` — so the mangle fires against the LOCAL
server and 500s it.

Fix (Plan 02): gate the mangle on the RESOLVED provider (`provider == "openrouter"`),
not on the presence of a slash. A local slashed id passes through untouched.

RED convention: import inside the body; xfail(strict=False).
"""

import pytest


@pytest.mark.xfail(
    reason="OpenRouter mangle gated on provider (not slash) in Plan 02 (D-09 #3)",
    strict=False,
)
def test_local_slashed_id_not_mangled():
    from app.services.openai_service import _apply_openrouter_quality_strategy

    kwargs = {"model": "myorg/local-model"}
    out = _apply_openrouter_quality_strategy(kwargs, provider="ollama", model="myorg/local-model")
    assert ":exacto" not in out["model"], "local slashed id must NOT get the :exacto suffix"
    assert "plugins" not in out.get("extra_body", {}), "no response-healing plugin on a local id"


@pytest.mark.xfail(
    reason="OpenRouter mangle gated on provider (not slash) in Plan 02 (D-09 #3)",
    strict=False,
)
def test_openrouter_slashed_id_still_mangled():
    from app.services.openai_service import _apply_openrouter_quality_strategy

    kwargs = {"model": "anthropic/claude-3.5-sonnet"}
    out = _apply_openrouter_quality_strategy(
        kwargs, provider="openrouter", model="anthropic/claude-3.5-sonnet"
    )
    # The genuine OpenRouter path keeps its quality strategy.
    assert ":exacto" in out["model"] or out.get("extra_body", {}).get("plugins"), (
        "genuine OpenRouter ids must still receive the quality strategy"
    )
