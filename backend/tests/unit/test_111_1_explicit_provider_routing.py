"""Phase 111.1 Wave-0 (RED) — stored provider short-circuits name-inference (D-09 #1).

BUG-260616-01 root cause: a slashed model id (`org/model`) is inferred to
`openrouter` by `_INFERENCE_PATTERNS`, so a LOCAL extraction model silently routes
to the OpenRouter cloud endpoint (data egress). The structural cure: when
`app_settings.extraction_provider` (or `embedding_provider`) is explicitly stored,
prefer it and SKIP name-inference entirely.

Mirrors `test_get_model_capability_inference.py` + `test_chunk_handler_provider_aware.py`
(NOTE: `test_provider_router.py` does NOT exist). The explicit-provider preference
lands in Plan 02. RED convention: import inside the body; xfail(strict=False).
"""

import pytest


def test_slashed_id_infers_openrouter_today():
    """Non-xfail anchor: documents the CURRENT (buggy) inference the fix overrides."""
    from app.config import _infer_provider_for

    # A slashed id infers openrouter today — this is exactly the egress trap D-09 #1
    # short-circuits when an explicit provider is stored.
    assert _infer_provider_for("mistral/mistral-small") == "openrouter"


@pytest.mark.xfail(
    reason="explicit extraction_provider short-circuit lands in Plan 02 (D-09 #1)",
    strict=False,
)
def test_stored_extraction_provider_wins_over_inference():
    from app.config import resolve_extraction_provider

    # A slashed local id WOULD infer openrouter; the stored provider must win.
    provider = resolve_extraction_provider(
        model="myorg/local-extract",
        stored_provider="ollama",
    )
    assert provider == "ollama", "stored extraction_provider must short-circuit name-inference"


@pytest.mark.xfail(
    reason="explicit embedding_provider short-circuit lands in Plan 02/03 (D-09 #1)",
    strict=False,
)
def test_inference_only_used_as_last_resort():
    from app.config import resolve_extraction_provider

    # With NO stored provider, fall back to inference (legacy behavior preserved).
    provider = resolve_extraction_provider(
        model="mistral/mistral-small",
        stored_provider=None,
    )
    assert provider == "openrouter", "absent a stored provider, inference is the last-resort fallback"
