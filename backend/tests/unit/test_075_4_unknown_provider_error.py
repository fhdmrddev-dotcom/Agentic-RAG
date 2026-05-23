"""Phase 075.4 Plan 02 Task 1 — UnknownProviderError lifespan-startup tests.

Covers (per 075.4-02-PLAN.md <behavior>):
  Test 1: UnknownProviderError is a subclass of ValueError.
  Test 2: UnknownProviderError("foobar", [...]) has .provider + .known_providers
          attributes set correctly.
  Test 3: str(UnknownProviderError("foobar", [...])) contains the literal
          "Unknown LLM_PROVIDER 'foobar'", the list of known providers, and the
          pointer string "backend/app/config.py::_PROVIDER_BASE_URLS".
  Test 4: Calling resolve_llm_provider at startup with an unknown provider
          raises UnknownProviderError (not bare ValueError).
  Test 5: ModelCapability TypedDict accepts optional uses_max_completion_tokens
          + supports_parallel_tools fields.
  Test 6: _PROVIDER_BASE_URLS remains the single source of truth — there is no
          second hardcoded validation dict. The provider-membership check goes
          through _PROVIDER_BASE_URLS.keys() (D-075.4-B2).

Conventions mirror backend/tests/unit/test_075_1_observability.py — pure
unit tests, no Supabase / Redis bootstrap required.
"""
from __future__ import annotations

import inspect
import os

import pytest


# ── Test 1 + 2 + 3: UnknownProviderError surface ─────────────────────────────


def test_unknown_provider_error_is_value_error_subclass() -> None:
    """Test 1: subclass of ValueError so legacy ``except ValueError`` keeps working."""
    from app.config import UnknownProviderError

    assert issubclass(UnknownProviderError, ValueError)


def test_unknown_provider_error_carries_structured_attrs() -> None:
    """Test 2: .provider + .known_providers attributes are populated and stable
    (FORWARD-REF #6 — Phase 082.5 unified error sink reads these)."""
    from app.config import UnknownProviderError

    known = ["openai", "anthropic", "google", "openrouter", "ollama"]
    err = UnknownProviderError("foobar", known)

    assert err.provider == "foobar"
    assert err.known_providers == known


def test_unknown_provider_error_message_contains_actionable_pointer() -> None:
    """Test 3: str(err) cites the offending provider, the list of known providers,
    and the file path that must be edited to register a new one."""
    from app.config import UnknownProviderError

    known = ["openai", "anthropic", "google", "openrouter", "ollama"]
    msg = str(UnknownProviderError("foobar", known))

    assert "Unknown LLM_PROVIDER 'foobar'" in msg
    for prov in known:
        assert prov in msg
    assert "_PROVIDER_BASE_URLS" in msg
    # The actionable pointer must include the path so an operator knows
    # where to register a new provider without grepping the codebase.
    assert "backend/app/config.py" in msg


# ── Test 4: resolve_llm_provider raises UnknownProviderError at startup ───────


def test_resolve_llm_provider_raises_unknown_provider_error(monkeypatch) -> None:
    """Test 4: Settings(llm_provider='foobar') raises UnknownProviderError
    (not bare ValueError) at lifespan startup.

    Pydantic Settings wraps the model_validator raise in a ValidationError;
    the original UnknownProviderError lives in .errors()[0]['ctx']['error'].
    """
    from pydantic import ValidationError

    from app.config import Settings, UnknownProviderError

    # Need supabase_* envs because Settings has them as required fields.
    monkeypatch.setenv("SUPABASE_URL", "http://localhost:54321")
    monkeypatch.setenv("SUPABASE_SERVICE_ROLE_KEY", "test-key")
    monkeypatch.setenv("LLM_PROVIDER", "foobar")

    with pytest.raises(ValidationError) as excinfo:
        # _env_file=None so pydantic-settings doesn't pull from .env file
        # which would override the monkeypatched env var on Windows.
        Settings(_env_file=None)

    # Walk to the root cause — UnknownProviderError must be in there.
    errs = excinfo.value.errors()
    assert any(
        isinstance(e.get("ctx", {}).get("error"), UnknownProviderError)
        for e in errs
    ), f"Expected UnknownProviderError in ValidationError chain; got: {errs}"


# ── Test 5: ModelCapability TypedDict has the two new optional fields ─────────


def test_model_capability_typeddict_has_new_optional_fields() -> None:
    """Test 5: ModelCapability declares uses_max_completion_tokens and
    supports_parallel_tools (Plan 075.4-02 D-075.4-NN)."""
    from app.config import ModelCapability

    # TypedDict introspection — annotations include all declared fields.
    annotations = ModelCapability.__annotations__
    assert "uses_max_completion_tokens" in annotations
    assert annotations["uses_max_completion_tokens"] is bool
    assert "supports_parallel_tools" in annotations
    assert annotations["supports_parallel_tools"] is bool


# ── Test 6: _PROVIDER_BASE_URLS is the single source of truth ────────────────


def test_provider_base_urls_is_single_source_of_truth() -> None:
    """Test 6: D-075.4-B2 — the provider-membership check in resolve_llm_provider
    goes through ``_PROVIDER_BASE_URLS`` (not a second hardcoded dict).

    Audit: source of resolve_llm_provider must contain
    ``if provider not in _PROVIDER_BASE_URLS:`` and raise
    ``UnknownProviderError`` immediately after — NOT raise on a separate
    key_map dict membership check (which is the pre-075.4-02 shape).
    """
    from app import config

    src = inspect.getsource(config.Settings.resolve_llm_provider)
    assert "if provider not in _PROVIDER_BASE_URLS" in src
    assert "raise UnknownProviderError(" in src
    # The legacy ``if provider not in key_map:`` membership check must be GONE
    # (key_map still exists for api-key resolution, a different concern).
    assert "if provider not in key_map" not in src


# ── Auxiliary: known providers list shape stability (regression guard) ────────


def test_known_providers_includes_all_five_providers() -> None:
    """Sanity: the 5 providers currently shipped (openai, anthropic, google,
    openrouter, ollama) are all in _PROVIDER_BASE_URLS. If you add a 6th,
    update this test + the UAT scoreboard recipe in CLAUDE.md."""
    from app.config import _PROVIDER_BASE_URLS

    expected = {"openai", "anthropic", "google", "openrouter", "ollama"}
    assert set(_PROVIDER_BASE_URLS.keys()) == expected
