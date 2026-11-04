"""Phase 308-06 (HOOK-02; D-11, D-13, D-57; Pitfalls 3 and 8) — our hand-rolled signer verified by the
reference Standard Webhooks library.

``app.services.webhook_signer`` is written from the spec (308-02). A receiver will verify with the
official library, so that is the bar: the headers ``build_headers`` produces must pass
``Webhook(secret).verify(body, headers)`` — not a re-derivation of our own HMAC, which would agree
with any bug it shares.

⛔ A HARD IMPORT, never ``importorskip``. ``standardwebhooks==1.1.0`` is a test-only dependency
(``backend/requirements-dev.txt``, installed by ``backend-tests.yml`` and in the local venv in the same
plan — D-54). A skip here would turn "the signer is interoperable" into "the signer was not checked"
without anyone seeing it.
"""
from __future__ import annotations

import json
import time
import uuid

import pytest
from standardwebhooks import Webhook
from standardwebhooks.webhooks import WebhookVerificationError

from app.services.webhook_signer import (
    SECRET_PREFIX,
    build_headers,
    message_id,
    new_secret,
)

BODY = json.dumps(
    {"type": "run.finished", "timestamp": "2026-11-04T10:00:00Z", "data": {"run_id": "r1", "status": "completed"}},
    separators=(",", ":"),
).encode("utf-8")


def _headers(*, current: str, previous: str | None = None, ts: int | None = None, body: bytes = BODY, msg: str | None = None):
    return build_headers(
        msg_id=msg or message_id(uuid.uuid4()),
        timestamp=int(time.time()) if ts is None else ts,
        body=body,
        current=current,
        previous=previous,
    )


def test_reference_library_verifies_our_headers_and_returns_the_json():
    secret = new_secret()
    headers = _headers(current=secret)
    assert Webhook(secret).verify(BODY, headers) == json.loads(BODY)


def test_overlap_carries_both_signatures_and_each_secret_verifies_alone():
    """D-13: during a roll's 24 h overlap a receiver holding EITHER secret must accept the message."""
    new, old = new_secret(), new_secret()
    headers = _headers(current=new, previous=old)
    assert len(headers["webhook-signature"].split(" ")) == 2
    assert Webhook(new).verify(BODY, headers) == json.loads(BODY)
    assert Webhook(old).verify(BODY, headers) == json.loads(BODY)
    with pytest.raises(WebhookVerificationError):
        Webhook(new_secret()).verify(BODY, headers)


def test_a_body_changed_by_one_byte_is_refused():
    secret = new_secret()
    headers = _headers(current=secret)
    tampered = BODY.replace(b"completed", b"completeD")
    assert tampered != BODY and len(tampered) == len(BODY)
    with pytest.raises(WebhookVerificationError):
        Webhook(secret).verify(tampered, headers)


def test_a_resend_is_signed_fresh_with_the_same_webhook_id():
    """Pitfall 3: the library rejects a timestamp outside its 5-minute window, so a retry or resend that
    replayed the FIRST attempt's signature would be refused. Only the body is frozen; each attempt signs
    with its own now() and keeps the same ``webhook-id`` (D-09)."""
    secret = new_secret()
    msg = message_id(uuid.uuid4())
    first = _headers(current=secret, ts=int(time.time()) - 600, msg=msg)
    with pytest.raises(WebhookVerificationError):
        Webhook(secret).verify(BODY, first)
    resend = _headers(current=secret, msg=msg)
    assert resend["webhook-id"] == first["webhook-id"] == msg
    assert Webhook(secret).verify(BODY, resend) == json.loads(BODY)


def test_new_secret_round_trips_through_the_library_whsec_decoding():
    secret = new_secret()
    assert secret.startswith(SECRET_PREFIX)
    # The library strips whsec_ and base64-decodes the rest itself; a secret it could not decode, or
    # decoded to different key bytes, would fail the verify below.
    wh = Webhook(secret)
    assert wh.verify(BODY, _headers(current=secret)) == json.loads(BODY)
    # And a key built from the bare base64 part (no prefix) is the same key.
    assert Webhook(secret[len(SECRET_PREFIX):]).verify(BODY, _headers(current=secret)) == json.loads(BODY)
