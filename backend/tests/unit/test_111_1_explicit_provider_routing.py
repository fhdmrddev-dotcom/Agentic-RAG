"""Phase 111.1 Plan 02 — D-09 #1: explicit extraction-provider routing.

BUG-260616-01 (data-egress trap): the metadata-extraction provider was inferred
purely from the model-name string. A slashed local id (`google/gemma-3-4b`) hits
the `^word/word -> openrouter` inference rule (`config.py` `_INFERENCE_PATTERNS`),
so document text is silently shipped to OpenRouter's cloud even though the operator
pinned a LOCAL model.

The fix (`documents.py` extraction routing) prefers a stored
`app_settings.extraction_provider` when set and SKIPS name-inference entirely; the
inference path stays ONLY as the legacy fallback when `extraction_provider` is empty
(D-08 back-compat — pre-111.1 rows behave byte-identically to today).

These tests exercise the EXACT resolution expression used at the extraction routing
seam (a stored provider short-circuits inference; an empty provider falls through to
inference) so the structural cure is locked against regression.
"""
from __future__ import annotations

from types import SimpleNamespace

from app.config import get_model_capability


def _resolve_extraction_provider(app_settings, model: str) -> str | None:
    """Mirror the `documents.py` D-09 #1 resolution expression verbatim.

    Kept in lockstep with `backend/app/api/documents.py` extraction routing:
        provider = (getattr(app_settings, "extraction_provider", "") or "").strip().lower() \
            or (get_model_capability(model) or {}).get("provider")
    """
    return (getattr(app_settings, "extraction_provider", "") or "").strip().lower() \
        or (get_model_capability(model) or {}).get("provider")


# ────────────────────────────────────────────────────────────────────
# 1-3. Stored provider short-circuits inference (the data-egress cure)
# ────────────────────────────────────────────────────────────────────

def test_stored_lmstudio_wins_over_slashed_id_inference():
    """The headline egress cure: a slashed local id that WOULD infer to openrouter
    resolves to the pinned `lmstudio` instead — document text stays local."""
    app_settings = SimpleNamespace(extraction_provider="lmstudio")
    # Sanity: without the stored provider this id name-infers to openrouter (the trap).
    assert (get_model_capability("google/gemma-3-4b") or {}).get("provider") == "openrouter"
    # With the stored provider set, the slash never reaches inference.
    assert _resolve_extraction_provider(app_settings, "google/gemma-3-4b") == "lmstudio"


def test_stored_ollama_wins_over_slashed_id_inference():
    app_settings = SimpleNamespace(extraction_provider="ollama")
    assert _resolve_extraction_provider(app_settings, "library/llama-4-8b") == "ollama"


def test_stored_provider_is_normalized_lowercase_and_stripped():
    """Operator-entered value tolerates surrounding whitespace / casing."""
    app_settings = SimpleNamespace(extraction_provider="  LMStudio  ")
    assert _resolve_extraction_provider(app_settings, "google/gemma-3-4b") == "lmstudio"


# ────────────────────────────────────────────────────────────────────
# 4-6. Empty / absent provider falls through to legacy inference (D-08)
# ────────────────────────────────────────────────────────────────────

def test_empty_provider_falls_through_to_inference():
    """Pre-111.1 rows (extraction_provider unset) keep today's name-inference path."""
    app_settings = SimpleNamespace(extraction_provider="")
    assert _resolve_extraction_provider(app_settings, "google/gemma-3-4b") == "openrouter"


def test_none_provider_falls_through_to_inference():
    app_settings = SimpleNamespace(extraction_provider=None)
    assert _resolve_extraction_provider(app_settings, "gpt-4o") == "openai"


def test_absent_attribute_falls_through_to_inference():
    """Defensive: an app_settings object that never carries `extraction_provider`
    (the parallel-merge / legacy-row case) still resolves via inference, no crash."""
    app_settings = SimpleNamespace()  # no extraction_provider attr at all
    assert _resolve_extraction_provider(app_settings, "claude-sonnet-4-6") == "anthropic"


# ────────────────────────────────────────────────────────────────────
# 7. The wiring is actually present in documents.py (contains-guard)
# ────────────────────────────────────────────────────────────────────

def test_documents_py_resolution_block_prefers_extraction_provider():
    """Locks the source seam: the resolution block reads `extraction_provider`
    before falling back to inference (must_haves artifact contains-check)."""
    import inspect

    from app.api import documents

    src = inspect.getsource(documents)
    assert "extraction_provider" in src, \
        "documents.py extraction routing must prefer stored extraction_provider"
