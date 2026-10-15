"""BUG-261015-04: an Anthropic "credit balance is too low" refusal reached chat as
"Model parameter error — this model may not support the current configuration".

Measured on the Phase 282 board (row 2, run d512fe97): Anthropic returns it as a **400**
``invalid_request_error`` whose STRUCTURED body message names the credit balance, so the typed
``BadRequestError`` arm classified it ``bad_request``. Row 8 (OpenRouter) was a **402** — HTTP
Payment Required — which fell through ``_classify_status`` to ``unknown``.

Both must read as ``billing``. As with every other signature in ``errors.py``, the match reads the
STRUCTURED body only, never ``str(exc)``, so a crafted message cannot force it.
"""
from __future__ import annotations

import anthropic
import httpx
import openai

import app.main  # noqa: F401
from app.services.provider_gateway import classify_provider_error, message_for_kind

_REQ = httpx.Request("POST", "https://api.example.test/v1/messages")

_ANTHROPIC_CREDIT_BODY = {
    "type": "error",
    "error": {
        "type": "invalid_request_error",
        "message": (
            "Your credit balance is too low to access the Anthropic API. Please go to "
            "Plans & Billing to upgrade or purchase credits."
        ),
    },
}


def _anthropic_400(body):
    return anthropic.BadRequestError(
        "Error code: 400", response=httpx.Response(400, request=_REQ), body=body
    )


def test_anthropic_credit_400_is_billing():
    exc = _anthropic_400(_ANTHROPIC_CREDIT_BODY)
    assert classify_provider_error("anthropic", exc) == "billing"
    assert "credit" in message_for_kind("billing").lower()


def test_an_ordinary_anthropic_400_stays_bad_request():
    exc = _anthropic_400(
        {"type": "error", "error": {"type": "invalid_request_error", "message": "max_tokens: too large"}}
    )
    assert classify_provider_error("anthropic", exc) == "bad_request"


def test_the_signature_is_read_from_the_body_not_the_top_level_message():
    exc = anthropic.BadRequestError(
        "Your credit balance is too low",  # crafted top-level text only
        response=httpx.Response(400, request=_REQ),
        body={"type": "error", "error": {"type": "invalid_request_error", "message": "bad tool schema"}},
    )
    assert classify_provider_error("anthropic", exc) == "bad_request"


def test_anthropic_billing_error_type_is_billing():
    """Anthropic's documented 402 ``billing_error`` type."""
    exc = anthropic.APIStatusError(
        "Error code: 402",
        response=httpx.Response(402, request=_REQ),
        body={"type": "error", "error": {"type": "billing_error", "message": "billing issue"}},
    )
    assert classify_provider_error("anthropic", exc) == "billing"


def test_openrouter_402_is_billing():
    exc = openai.APIStatusError(
        "Error code: 402",
        response=httpx.Response(402, request=_REQ),
        body={"error": {"message": "This request requires more credits, or fewer max_tokens.", "code": 402}},
    )
    assert classify_provider_error("openrouter", exc) == "billing"
