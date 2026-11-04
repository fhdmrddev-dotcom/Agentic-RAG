"""Phase 308-02 (D-09 / D-11 / D-13; T-308-05) — the Standard Webhooks signer, hand-rolled on purpose.

Spec: headers ``webhook-id``, ``webhook-timestamp`` (unix seconds) and ``webhook-signature``, where
each signature is ``v1,<base64 HMAC-SHA256(key, "{msg_id}.{timestamp}.{body}")>`` and several are
space-separated. A secret is ``whsec_`` + base64 of 32 random bytes; the HMAC key is the DECODED bytes.

sign at EVERY attempt and resend (the receiver's 5-minute window); only the body bytes are frozen
(Pitfall 3). ``webhook-id`` is ``msg_<event id>`` and never changes across retries and resends, so a
receiver can de-duplicate on it (D-09). During a roll's overlap the header carries the new signature
first and the previous one second (D-13).

No I/O, and nothing here is ever logged. Interop with the reference ``standardwebhooks`` library is proven in 308-06 (D-57).
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

SECRET_PREFIX = "whsec_"
SECRET_BYTES = 32
USER_AGENT = "Syrel-Webhooks/1"


def new_secret() -> str:
    """A fresh signing secret: ``whsec_`` + base64 of 32 random bytes."""
    return SECRET_PREFIX + base64.b64encode(secrets.token_bytes(SECRET_BYTES)).decode("ascii")


def _key(secret: str) -> bytes:
    raw = secret[len(SECRET_PREFIX):] if secret.startswith(SECRET_PREFIX) else secret
    return base64.b64decode(raw)


def sign(secret: str, msg_id: str, timestamp: int, body: bytes) -> str:
    """``v1,<base64 HMAC-SHA256(key, "{msg_id}.{timestamp}.{body}")>``."""
    mac = hmac.new(_key(secret), f"{msg_id}.{timestamp}.".encode("ascii") + body, hashlib.sha256)
    return "v1," + base64.b64encode(mac.digest()).decode("ascii")


def message_id(event_id: object) -> str:
    """``msg_`` + the event id — identical across every retry and resend of that event (D-09)."""
    return "msg_" + str(event_id)


def build_headers(
    *, msg_id: str, timestamp: int, body: bytes, current: str, previous: str | None,
) -> dict[str, str]:
    """The five request headers. ``timestamp`` is the caller's now() for THIS attempt."""
    signatures = [sign(current, msg_id, timestamp, body)]
    if previous:
        signatures.append(sign(previous, msg_id, timestamp, body))
    return {
        "webhook-id": msg_id,
        "webhook-timestamp": str(timestamp),
        "webhook-signature": " ".join(signatures),
        "content-type": "application/json",
        "user-agent": USER_AGENT,
    }
