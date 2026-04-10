"""Tests for APIError context-window keyword detection (Phase 19)."""

CONTEXT_KEYWORDS = ("context", "maximum", "too long", "too large", "max_tokens", "token limit", "overloaded")


def _is_context_error(err_str: str) -> bool:
    return any(kw in err_str.lower() for kw in CONTEXT_KEYWORDS)


def test_context_keyword_detected():
    assert _is_context_error("This request exceeds the context length")


def test_maximum_keyword_detected():
    assert _is_context_error("This model's maximum context length is 128000 tokens")


def test_maximum_context_length_message():
    assert _is_context_error("The conversation has grown too long for this model's maximum context window")


def test_too_long_detected():
    assert _is_context_error("Input is too long for this model")


def test_too_large_detected():
    assert _is_context_error("Request payload is too large")


def test_max_tokens_detected():
    assert _is_context_error("Reduce your prompt; max_tokens exceeded")


def test_token_limit_detected():
    assert _is_context_error("You have hit the token limit for this model")


def test_overloaded_detected():
    assert _is_context_error("Model is overloaded, please retry later")


def test_unrelated_timeout_not_matched():
    assert not _is_context_error("Connection timeout after 30 seconds")


def test_unrelated_auth_not_matched():
    assert not _is_context_error("Invalid API key provided")


def test_unrelated_rate_limit_not_matched():
    assert not _is_context_error("Rate limit exceeded, retry after 60s")


def test_case_insensitive_maximum():
    assert _is_context_error("MAXIMUM CONTEXT LENGTH EXCEEDED")


def test_case_insensitive_context():
    assert _is_context_error("CONTEXT window is full")
