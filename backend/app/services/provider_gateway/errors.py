"""Per-provider error classification (D-095.1-03 — PROVIDER-ERR).

THE BUG this replaces: the ``agent_loop`` catch block classified an API error's
CAUSE by keyword-scanning the stringified exception, checking "billing" FIRST
with a keyword list that contained "quota". Google's 429 ``RESOURCE_EXHAUSTED``
text contains "quota", so a Google rate-limit read as "billing" (BUG-260606-01).

THE FIX: map each provider's NATIVE SDK error to a normalized ``ErrorKind`` from
STRUCTURED status codes — never keyword guessing. 429 → ``rate_limit`` ALWAYS
precedes any billing classification, so a rate-limit can NEVER read as billing
again. Billing is claimed ONLY when a structured ``insufficient_quota`` signal
proves it; when uncertain → ``unknown`` (neutral truthful copy), never a guess.

INVARIANTS (mirrors the gateway-package convention, see events.py):
  - This is a PURE helper called from the ``agent_loop`` CONSUMER catch block —
    NOT inside the adapter generators. The adapters are byte-identical clean-move
    stream constructors; touching them risks the Deep byte-identical invariant
    the 092.5 gate proved (RESEARCH Pitfall 5). The classifier lives here so
    provider knowledge stays in the gateway package without touching the stream.
  - NO IMPORT CYCLE: this module imports ONLY the SDK error types (below the
    gateway in the dep graph, same as the adapters). It MUST NEVER import
    ``agent_loop`` or ``threads.py``.

The SDK signal shapes (VERIFIED via introspection 2026-06-06):
  - anthropic / openai (+ the openai-compatible deepseek/moonshot/glm/minimax/
    openrouter): typed subclasses RateLimitError(429), AuthenticationError(401),
    PermissionDeniedError(403), BadRequestError(400), InternalServerError(5xx);
    every APIStatusError carries ``.status_code``.
  - google.genai.errors.APIError: ``.code`` (int HTTP status; 429 for
    RESOURCE_EXHAUSTED) + ``.status`` (string). NOT ``.status_code`` (Pitfall 6).
"""
from __future__ import annotations

from typing import Literal

# SDK error types — wrapped so the module never hard-fails if an SDK isn't
# installed. When a class is unavailable, its isinstance branch is skipped and
# the numeric ``.status_code`` fallback handles the same case.
try:  # pragma: no cover - import guard
    from openai import (
        AuthenticationError as _OpenAIAuthError,
        BadRequestError as _OpenAIBadRequestError,
        InternalServerError as _OpenAIServerError,
        PermissionDeniedError as _OpenAIPermissionError,
        RateLimitError as _OpenAIRateLimitError,
    )
except ImportError:  # pragma: no cover
    _OpenAIAuthError = _OpenAIBadRequestError = _OpenAIServerError = None  # type: ignore[assignment]
    _OpenAIPermissionError = _OpenAIRateLimitError = None  # type: ignore[assignment]

try:  # pragma: no cover - import guard
    from anthropic import (
        AuthenticationError as _AnthropicAuthError,
        BadRequestError as _AnthropicBadRequestError,
        InternalServerError as _AnthropicServerError,
        PermissionDeniedError as _AnthropicPermissionError,
        RateLimitError as _AnthropicRateLimitError,
    )
except ImportError:  # pragma: no cover
    _AnthropicAuthError = _AnthropicBadRequestError = _AnthropicServerError = None  # type: ignore[assignment]
    _AnthropicPermissionError = _AnthropicRateLimitError = None  # type: ignore[assignment]


ErrorKind = Literal[
    "rate_limit",
    "auth",
    "billing",
    "bad_request",
    "reasoning_tools_unsupported",
    "server",
    "context_overflow",
    "unknown",
]

__all__ = ["ErrorKind", "classify_provider_error", "message_for_kind"]


def _isinstance_any(exc: Exception, *classes: object) -> bool:
    """isinstance against only the SDK classes that imported successfully."""
    real = tuple(c for c in classes if isinstance(c, type))
    return bool(real) and isinstance(exc, real)


def _has_insufficient_quota(exc: Exception) -> bool:
    """Detect a STRUCTURAL billing signal (insufficient_quota error code).

    Only structured proof counts — never the word "quota" in a message string
    (that is the exact bug being fixed; rate-limit messages contain "quota").
    """
    code = getattr(exc, "code", None)
    if isinstance(code, str) and code == "insufficient_quota":
        return True
    body = getattr(exc, "body", None)
    if isinstance(body, dict):
        err = body.get("error")
        if isinstance(err, dict) and err.get("code") == "insufficient_quota":
            return True
        if err == "insufficient_quota":
            return True
    return False


# Phase 175 XPROV-01 (D-04): the exact OpenAI 400 substrings for the reasoning-first
# tools-unsupported constraint (gpt-5.6-class). Matched only against the STRUCTURED body
# message, lower-cased — never str(exc) — so a crafted top-level message cannot force a
# misclassification of an unrelated 400 (T-175-03-02).
_REASONING_TOOLS_SIGNATURES = (
    "function tools with reasoning_effort are not supported",
    "reasoning_effort to 'none'",
    "/v1/responses",
)


def _is_bad_request(exc: Exception) -> bool:
    """True when the exception represents an HTTP 400 (typed subclass OR numeric status)."""
    if _isinstance_any(exc, _OpenAIBadRequestError, _AnthropicBadRequestError):
        return True
    status = getattr(exc, "status_code", None)
    return isinstance(status, int) and status == 400


def _has_reasoning_tools_signature(exc: Exception) -> bool:
    """Detect the gpt-5.6 reasoning-tools-unsupported 400 from its STRUCTURED body.

    Mirrors :func:`_has_insufficient_quota`: reads ``exc.body["error"]["message"]`` —
    NEVER a loose scan of ``str(exc)`` (the exact info-tampering guard T-175-03-02).
    Returns False when there is no structured body, so any 400 lacking the signature
    stays ``bad_request`` (D-14).

    WR-02 (Phase 175 code-review): the MESSAGE signature is the sole authority. An
    earlier ``param == "reasoning_effort"`` short-circuit was too broad — an *invalid
    reasoning_effort VALUE* 400 (now reachable because XPROV-04 injects
    ``reasoning_effort="none"`` on the title call) also carries ``param ==
    "reasoning_effort"`` but is a DIFFERENT error and must stay ``bad_request``.
    """
    body = getattr(exc, "body", None)
    if not isinstance(body, dict):
        return False
    err = body.get("error")
    if not isinstance(err, dict):
        return False
    msg = err.get("message")
    if isinstance(msg, str):
        low = msg.lower()
        return any(sig in low for sig in _REASONING_TOOLS_SIGNATURES)
    return False


def _classify_status(status: int | None) -> ErrorKind:
    """Map a numeric HTTP status to an ErrorKind (429 → rate_limit FIRST)."""
    if status is None:
        return "unknown"
    if status == 429:
        return "rate_limit"
    if status in (401, 403):
        return "auth"
    if status == 400:
        return "bad_request"
    if status >= 500:
        return "server"
    return "unknown"


def classify_provider_error(provider: str, exc: Exception) -> ErrorKind:
    """Classify a provider's native SDK error into a normalized ErrorKind.

    Branches by provider family on STRUCTURED signals only. Ordered so 429 →
    ``rate_limit`` ALWAYS precedes any billing classification (BUG-260606-01).

    :param provider: the resolved provider name (case-insensitive).
    :param exc: the native SDK exception raised by the provider call.
    """
    fam = (provider or "").lower()

    if fam == "google":
        # Google uses .code (int HTTP status) + .status (string), NOT .status_code.
        code = getattr(exc, "code", None)
        if not isinstance(code, int):
            return "unknown"
        # 429 → rate_limit first (RESOURCE_EXHAUSTED can NEVER fall into billing).
        if code == 429:
            return "rate_limit"
        return _classify_status(code)

    # Anthropic + all OpenAI-compatible providers (openai/deepseek/moonshot/glm/
    # zhipu/minimax/openrouter) and any unrecognized provider name.
    # Phase 175 XPROV-01 (D-04): the gpt-5.6-class reasoning-tools 400 gets a dedicated honest
    # kind BEFORE the generic bad_request classification. NARROW by construction — fires only
    # when the error is a 400 AND its STRUCTURED body carries the reasoning-tools signature
    # (mirrors _has_insufficient_quota); a 400 lacking the signature is untouched (bad_request,
    # D-14) and a crafted str(exc) cannot force it (T-175-03-02).
    if _is_bad_request(exc) and _has_reasoning_tools_signature(exc):
        return "reasoning_tools_unsupported"
    # isinstance against the typed SDK subclasses FIRST (where importable).
    if _isinstance_any(exc, _OpenAIRateLimitError, _AnthropicRateLimitError):
        # A rate-limit is rate_limit even if a billing code rides along —
        # but a genuine insufficient_quota (402-style) should read as billing.
        if _has_insufficient_quota(exc):
            return "billing"
        return "rate_limit"
    if _isinstance_any(exc, _OpenAIAuthError, _AnthropicAuthError):
        return "auth"
    if _isinstance_any(exc, _OpenAIPermissionError, _AnthropicPermissionError):
        return "auth"
    if _isinstance_any(exc, _OpenAIBadRequestError, _AnthropicBadRequestError):
        return "bad_request"
    if _isinstance_any(exc, _OpenAIServerError, _AnthropicServerError):
        return "server"

    # Fall back to the numeric status_code on any APIStatusError-shaped exception.
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        # ORDER GUARD: 429 → rate_limit precedes billing. Billing ONLY when
        # structurally proven (insufficient_quota), never from "quota" text.
        if status == 429 and not _has_insufficient_quota(exc):
            return "rate_limit"
        if _has_insufficient_quota(exc):
            return "billing"
        return _classify_status(status)

    # No structured signal at all → billing only if structurally proven, else unknown.
    if _has_insufficient_quota(exc):
        return "billing"
    return "unknown"


# Honest, per-kind user-facing copy. The specific kinds NEVER interpolate the
# raw detail (no key/trace leak); only ``unknown`` appends a BOUNDED raw detail.
_MESSAGES: dict[str, str] = {
    "rate_limit": (
        "*Rate limited by the provider — please retry in a moment.*"
    ),
    "auth": (
        "*Authentication error: the API key for this provider is invalid or "
        "expired. Please check your API key in Settings.*"
    ),
    "billing": (
        "*Billing error: your account has insufficient credits. Please check "
        "your provider's billing dashboard.*"
    ),
    "bad_request": (
        "*Model parameter error — this model may not support the current "
        "configuration.*"
    ),
    "reasoning_tools_unsupported": (
        "*This reasoning model can't use tools on the current endpoint yet, so "
        "it was switched to prompt-based tools automatically. If tool calls keep "
        "failing, pick a non-reasoning OpenAI model in Settings.*"
    ),
    "context_overflow": (
        "*The conversation has grown too long for this model's context window. "
        "Please start a new chat or reduce history.*"
    ),
    "server": (
        "*The AI provider is temporarily unavailable. Please try again in a "
        "moment.*"
    ),
}


def message_for_kind(kind: ErrorKind, raw_detail: str = "") -> str:
    """The honest per-kind user message.

    Specific kinds get a fixed truthful copy with NO raw-detail interpolation.
    ``unknown`` gets a neutral message plus a BOUNDED (300-char) raw detail —
    never a stack trace, never a key, never a guessed cause (Information-
    Disclosure control T-095.1-01-02).
    """
    if kind == "unknown":
        return f"*The provider returned an error: {raw_detail[:300]}*"
    return _MESSAGES.get(kind, f"*The provider returned an error: {raw_detail[:300]}*")
