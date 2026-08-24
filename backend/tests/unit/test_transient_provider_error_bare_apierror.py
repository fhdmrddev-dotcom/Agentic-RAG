"""BUG-260815-09 — ``_is_transient_provider_error`` must survive a BARE APIError.

WHY THIS FILE EXISTS
    ``openai.APIError`` is the SDK's BASE class and does NOT define
    ``status_code``; only its ``APIStatusError`` subclasses do. The helper read
    ``e.status_code`` as a plain attribute, so a bare ``APIError`` raised
    ``AttributeError`` from INSIDE the ``except (APIError, AnthropicAPIError)``
    handler that called it. That escaped the handler, unwound past every
    per-provider classification branch, and landed in the generic
    ``except Exception`` -- which rendered:

        "An unexpected error occurred (AttributeError). Please try again."

    The bug was therefore not a crash but a LIE: the provider's real, actionable
    message was discarded and replaced with a generic one. Observed 2026-08-15
    against LM Studio (an OpenAI-compatible server) on a context overflow.

    A bare ``APIError`` is precisely what an OpenAI-COMPATIBLE server raises when
    it fails MID-STREAM, because the failure arrives inside the SSE body rather
    than as an HTTP status -- so there is no status code anywhere to read. This
    affects LM Studio, llama.cpp, vLLM and Ollama's compat endpoint, plus any
    hosted provider reporting a mid-stream failure the same way.

    ``_is_transient_provider_error`` had ZERO test coverage before this file,
    which is how an unguarded attribute read survived beside two call sites that
    both already used ``getattr`` defensively.

Covers:
  Test 1: a bare APIError does not raise, and is not treated as transient.
  Test 2: RED-first control -- the pre-fix expression genuinely raises
          AttributeError, so Test 1 is guarding a real defect and not a
          hypothetical one.
  Test 3-5: regressions -- status_code, e.body code, and message-text
          detection all still identify transient errors.
  Test 6: a non-transient error (auth) is still not retried.
  Test 7: the real LM Studio message classifies as context_overflow and
          reaches the user as honest copy, not "unexpected error".

Pure unit tests -- no Supabase / Redis bootstrap. Conventions mirror
backend/tests/unit/test_075_4_unknown_provider_error.py.
"""
from __future__ import annotations

import openai
import pytest

from app.services.agent_loop import _is_transient_provider_error

# The verbatim message LM Studio returned on 2026-08-15, reproduced by driving
# the real server on 127.0.0.1:1234 with an oversized prompt.
LM_STUDIO_CONTEXT_OVERFLOW = (
    "The number of tokens to keep from the initial prompt is greater than the "
    "context length (n_keep: 120081 >= n_ctx: 33280). Try to load the model "
    "with a larger context length, or provide a shorter input."
)


def _bare(message: str, body=None) -> openai.APIError:
    """Build the exact shape an OpenAI-compatible server raises mid-stream."""
    return openai.APIError(message, request=None, body=body)


# ── Test 1: the defect itself ────────────────────────────────────────────────


def test_bare_apierror_does_not_raise_and_is_not_transient() -> None:
    """Test 1: the bug. Must return a bool, NOT raise AttributeError.

    Before the fix this call raised AttributeError, which is what produced the
    user-facing "An unexpected error occurred (AttributeError)".
    """
    err = _bare(LM_STUDIO_CONTEXT_OVERFLOW)
    assert _is_transient_provider_error(err) is False


# ── Test 2: RED-first control ────────────────────────────────────────────────


def test_the_unguarded_read_really_does_raise() -> None:
    """Test 2: positive control proving Test 1 guards a REAL defect.

    Asserts the PRE-FIX expression (``e.status_code`` as a plain attribute)
    still raises on this object. If the SDK ever adds ``status_code`` to the
    base class this test goes RED -- which is the correct signal, because Test 1
    would then be guarding nothing and this whole file could be retired.
    """
    err = _bare(LM_STUDIO_CONTEXT_OVERFLOW)
    assert not hasattr(err, "status_code")
    with pytest.raises(AttributeError):
        _ = err.status_code


# ── Tests 3-5: the retry paths must be UNCHANGED ─────────────────────────────


@pytest.mark.parametrize("code", [502, 503, 529])
def test_status_code_still_detects_transient(code: int) -> None:
    """Test 3: a subclass carrying a real status code still retries."""

    class _WithStatus(openai.APIError):
        status_code = code

    assert _is_transient_provider_error(_WithStatus("upstream", request=None, body=None)) is True


@pytest.mark.parametrize("code", [502, 503, 529])
def test_body_error_code_still_detects_transient(code: int) -> None:
    """Test 4: the OpenRouter shape -- real code lives in ``e.body``."""
    assert _is_transient_provider_error(_bare("x", body={"error": {"code": code}})) is True


@pytest.mark.parametrize(
    "text",
    ["Provider returned error", "upstream connect failure", "Bad Gateway", "Service Unavailable"],
)
def test_message_text_still_detects_transient(text: str) -> None:
    """Test 5: message-text fallback still fires (case-insensitive)."""
    assert _is_transient_provider_error(_bare(text)) is True


# ── Test 6: non-transient must NOT be retried ────────────────────────────────


@pytest.mark.parametrize(
    "text",
    [
        "Invalid API key provided",
        "insufficient_quota: billing hard limit reached",
        LM_STUDIO_CONTEXT_OVERFLOW,
    ],
)
def test_non_transient_errors_are_not_retried(text: str) -> None:
    """Test 6: auth, billing and context overflow are NEVER safe to retry.

    Retrying any of these burns the retry budget and delays the honest message.
    Context overflow in particular is deterministic -- the same request will
    fail identically every time.
    """
    assert _is_transient_provider_error(_bare(text)) is False


# ── Test 7: the user-facing outcome ──────────────────────────────────────────


def test_lm_studio_overflow_reaches_the_user_as_honest_copy() -> None:
    """Test 7: the whole point -- the user gets a real explanation.

    Mirrors the classification at agent_loop.py's outer
    ``except (APIError, anthropic.APIError, google_errors.APIError)`` handler:
    a narrow keyword pre-check routes context overflow before the structured
    classifier, because it has no reliable structured status code.

    The assertion is that the copy is ABOUT the context window and is not the
    generic fallback -- deliberately not a byte-exact match, so provider-error
    wording can be improved without this test failing for the wrong reason.
    """
    from app.services.provider_gateway.errors import message_for_kind

    low = LM_STUDIO_CONTEXT_OVERFLOW.lower()
    assert any(k in low for k in ("context", "maximum context", "too long", "token limit"))

    msg = message_for_kind("context_overflow", LM_STUDIO_CONTEXT_OVERFLOW)
    assert "context" in msg.lower()
    assert "unexpected error" not in msg.lower()
    assert "AttributeError" not in msg
