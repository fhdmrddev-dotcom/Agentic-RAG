"""Tests for the per-provider error classifier (D-095.1-03).

The classifier maps each provider's NATIVE SDK error to a normalized
``ErrorKind`` from STRUCTURED status codes — killing the keyword-soup
billing-misclassification (the old ``agent_loop.py`` keyword ladder that
checked "billing" first, with "quota" in its keyword list, so Google's 429
``RESOURCE_EXHAUSTED`` text tripped the billing branch).

LOAD-BEARING row (BUG-260606-01): a Google error with ``code=429`` /
``status="RESOURCE_EXHAUSTED"`` MUST classify as ``rate_limit``, NOT billing.

Pure unit — no DB, no app fixtures, no network. SDK exceptions are simulated
with ``MagicMock`` (attrs set explicitly per feedback_mock_completeness).
"""
from unittest.mock import MagicMock

from app.services.provider_gateway.errors import (
    classify_provider_error,
    message_for_kind,
)


# ───────────────────────── Google (the headline case) ──────────────────────

def test_google_429_resource_exhausted_is_rate_limit_not_billing():
    # NOT billing — BUG-260606-01. Google uses .code + .status, NOT .status_code.
    exc = MagicMock(spec=[])
    exc.code = 429
    exc.status = "RESOURCE_EXHAUSTED"
    assert classify_provider_error("google", exc) == "rate_limit"


def test_google_401_is_auth():
    exc = MagicMock(spec=[])
    exc.code = 401
    exc.status = "UNAUTHENTICATED"
    assert classify_provider_error("google", exc) == "auth"


def test_google_403_is_auth():
    exc = MagicMock(spec=[])
    exc.code = 403
    exc.status = "PERMISSION_DENIED"
    assert classify_provider_error("google", exc) == "auth"


def test_google_400_is_bad_request():
    exc = MagicMock(spec=[])
    exc.code = 400
    exc.status = "INVALID_ARGUMENT"
    assert classify_provider_error("google", exc) == "bad_request"


def test_google_500_is_server():
    exc = MagicMock(spec=[])
    exc.code = 503
    exc.status = "UNAVAILABLE"
    assert classify_provider_error("google", exc) == "server"


def test_google_no_code_is_unknown():
    exc = MagicMock(spec=[])
    exc.code = None
    assert classify_provider_error("google", exc) == "unknown"


# ─────────────────── Anthropic / OpenAI-compatible (status_code) ────────────

def test_openai_status_429_is_rate_limit():
    exc = MagicMock(spec=[])
    exc.status_code = 429
    assert classify_provider_error("openai", exc) == "rate_limit"


def test_anthropic_status_429_is_rate_limit():
    exc = MagicMock(spec=[])
    exc.status_code = 429
    assert classify_provider_error("anthropic", exc) == "rate_limit"


def test_openai_status_401_is_auth():
    exc = MagicMock(spec=[])
    exc.status_code = 401
    assert classify_provider_error("openai", exc) == "auth"


def test_openai_status_403_is_auth():
    exc = MagicMock(spec=[])
    exc.status_code = 403
    assert classify_provider_error("openai", exc) == "auth"


def test_openai_status_400_is_bad_request():
    exc = MagicMock(spec=[])
    exc.status_code = 400
    assert classify_provider_error("openai", exc) == "bad_request"


def test_openai_status_503_is_server():
    exc = MagicMock(spec=[])
    exc.status_code = 503
    assert classify_provider_error("openai", exc) == "server"


def test_deepseek_routes_through_openai_compat_branch():
    # deepseek/moonshot/glm/minimax/openrouter are OpenAI-compatible → same path
    exc = MagicMock(spec=[])
    exc.status_code = 429
    assert classify_provider_error("deepseek", exc) == "rate_limit"


# ───────────────────────────── Billing (structural only) ───────────────────

def test_openai_insufficient_quota_code_is_billing():
    exc = MagicMock(spec=[])
    exc.status_code = 429
    exc.code = "insufficient_quota"
    # ORDER GUARD: a 429 with an insufficient_quota STRUCTURAL code IS billing,
    # but the absence of insufficient_quota must NEVER fall into billing (below).
    assert classify_provider_error("openai", exc) == "billing"


def test_openai_insufficient_quota_in_body_is_billing():
    exc = MagicMock(spec=[])
    exc.status_code = 402
    exc.body = {"error": {"code": "insufficient_quota", "message": "..."}}
    assert classify_provider_error("openai", exc) == "billing"


def test_plain_429_without_quota_code_is_rate_limit_not_billing():
    # The bug class: a 429 whose MESSAGE contains "quota" must NOT be billing.
    exc = MagicMock(spec=[])
    exc.status_code = 429
    exc.code = None
    exc.body = "Rate limit exceeded — you have exceeded your quota for this minute"
    assert classify_provider_error("openai", exc) == "rate_limit"


# ───────────────────────────────── Unknown ─────────────────────────────────

def test_bare_exception_is_unknown():
    assert classify_provider_error("openai", Exception("something broke")) == "unknown"


def test_bare_exception_google_is_unknown():
    assert classify_provider_error("google", Exception("???")) == "unknown"


def test_unrecognized_provider_falls_back_to_openai_compat_path():
    # An unknown provider name still classifies via the status_code path.
    exc = MagicMock(spec=[])
    exc.status_code = 401
    assert classify_provider_error("some-new-provider", exc) == "auth"


# ─────────────────────────────── message_for_kind ──────────────────────────

def test_message_for_rate_limit_never_says_billing():
    msg = message_for_kind("rate_limit")
    assert "billing" not in msg.lower()
    assert "retry" in msg.lower()


def test_message_for_auth_mentions_api_key():
    msg = message_for_kind("auth").lower()
    assert "api key" in msg
    assert "billing" not in msg


def test_message_for_billing_mentions_credits():
    msg = message_for_kind("billing").lower()
    assert "credit" in msg or "billing" in msg


def test_message_for_server_is_temporary():
    msg = message_for_kind("server").lower()
    assert "unavailable" in msg or "try again" in msg


def test_message_for_context_overflow_mentions_context():
    msg = message_for_kind("context_overflow").lower()
    assert "context" in msg or "too long" in msg


def test_message_for_unknown_bounds_raw_detail_to_300_chars():
    raw = "x" * 1000
    msg = message_for_kind("unknown", raw)
    # the raw detail is truncated to 300 chars — never the full 1000-char blob
    assert raw not in msg
    assert "x" * 300 in msg
    assert len(msg) < 400  # neutral copy + bounded detail, no stack trace


def test_message_for_unknown_is_neutral_no_guessed_cause():
    msg = message_for_kind("unknown", "boom").lower()
    assert "billing" not in msg
    # neutral truthful phrasing
    assert "provider returned an error" in msg


def test_specific_kinds_never_interpolate_raw_detail():
    # rate_limit/auth/billing/server must NOT leak the raw detail
    secret = "sk-SUPERSECRETKEY-do-not-leak"
    for kind in ("rate_limit", "auth", "billing", "server", "context_overflow"):
        assert secret not in message_for_kind(kind, secret)


# ─────────── agent_loop wiring guard (Plan 095.1-04 — the consumer) ──────────
# These assert the EXACT composition the agent_loop catch block now performs —
# ``message_for_kind(classify_provider_error(_resolved_provider, e), str(e))`` —
# so the BUG-260606-01 fix is guarded at the wiring boundary, not just at the
# classifier unit. The wiring test lives here (NOT a heavy streaming-harness
# agent_loop test) per the plan: it exercises the identical 2-call composition
# the consumer uses, with the in-scope provider as the key.

class _FakeGoogleError(Exception):
    """A Google-SDK-shaped error: ``.code`` (int) + ``.status`` (str), no
    ``.status_code`` — with a controllable ``str()`` (the message the wiring
    feeds to ``message_for_kind`` as ``err_str``)."""

    def __init__(self, code, status, message):
        super().__init__(message)
        self.code = code
        self.status = status


class _FakeOpenAIError(Exception):
    """An OpenAI-compat-shaped error: ``.status_code`` (int) + optional
    structural ``.code``/``.body`` — with a controllable ``str()``."""

    def __init__(self, status_code, message, code=None, body=None):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.body = body


def test_wiring_google_429_renders_rate_limit_message_not_billing():
    # BUG-260606-01 at the WIRING boundary: a Google 429/RESOURCE_EXHAUSTED whose
    # str() text contains "quota"+"billing" must render the rate-limit copy.
    exc = _FakeGoogleError(
        429,
        "RESOURCE_EXHAUSTED",
        "429 RESOURCE_EXHAUSTED: You exceeded your current quota, please "
        "check your plan and billing details.",
    )
    err_str = str(exc)
    # the exact composition the agent_loop catch block performs:
    kind = classify_provider_error("google", exc)
    user_msg = message_for_kind(kind, err_str)
    assert kind == "rate_limit"
    assert "billing" not in user_msg.lower()
    assert "retry" in user_msg.lower()


def test_wiring_openai_429_text_quota_renders_rate_limit_not_billing():
    # Same wiring guard for the OpenAI-compat family: a plain 429 whose message
    # contains "quota" (no structural insufficient_quota) renders rate-limit.
    exc = _FakeOpenAIError(
        429, "Rate limit reached: you have exceeded your quota.", code=None, body=None
    )
    err_str = str(exc)
    kind = classify_provider_error("openai", exc)
    user_msg = message_for_kind(kind, err_str)
    assert kind == "rate_limit"
    assert "billing" not in user_msg.lower()


def test_wiring_unknown_error_renders_neutral_message_with_bounded_detail():
    # An uncertain error (no structured signal) renders the neutral truthful copy
    # plus bounded raw detail — never a guessed billing cause.
    exc = Exception("connection reset by peer")
    err_str = str(exc)
    kind = classify_provider_error("anthropic", exc)
    user_msg = message_for_kind(kind, err_str)
    assert kind == "unknown"
    assert "billing" not in user_msg.lower()
    assert "provider returned an error" in user_msg.lower()
    assert "connection reset by peer" in user_msg
