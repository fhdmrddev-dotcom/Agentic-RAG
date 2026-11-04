"""Phase 308-02 (D-09 / D-11 / D-13; T-308-05) — the hand-rolled Standard Webhooks signer.

Known-answer vectors are recomputed here with stdlib ``hmac`` over the spec's signed content
``{msg_id}.{timestamp}.{body}``. The proof against the reference ``standardwebhooks`` library is
308-06's job (D-57) — this suite proves the algorithm and the header shape.
"""
from __future__ import annotations

import ast
import base64
import hashlib
import hmac
import inspect
import logging
from uuid import UUID

import pytest

from app.services import webhook_signer
from app.services.webhook_signer import (
    SECRET_PREFIX,
    build_headers,
    message_id,
    new_secret,
    sign,
)

EVENT = UUID("12345678-1234-4234-8234-123456789abc")
BODY = b'{"a":1}'
TS = 1_700_000_000


def _expected(secret: str, msg_id: str, ts: int, body: bytes) -> str:
    key = base64.b64decode(secret[len("whsec_"):])
    mac = hmac.new(key, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()
    return "v1," + base64.b64encode(mac).decode()


def test_prefix_and_constants():
    assert SECRET_PREFIX == "whsec_"
    assert webhook_signer.SECRET_BYTES == 32
    assert webhook_signer.USER_AGENT == "Syrel-Webhooks/1"


def test_new_secret_is_whsec_plus_32_random_bytes():
    a, b = new_secret(), new_secret()
    assert a.startswith("whsec_") and b.startswith("whsec_")
    assert len(base64.b64decode(a[len("whsec_"):], validate=True)) == 32
    assert a != b


def test_message_id_is_msg_plus_the_event_id():
    assert message_id(EVENT) == "msg_" + str(EVENT)
    assert message_id(str(EVENT)) == "msg_" + str(EVENT)


def test_sign_matches_the_known_answer_vector():
    secret = new_secret()
    assert sign(secret, "msg_x", TS, BODY) == _expected(secret, "msg_x", TS, BODY)


def test_a_fixed_secret_gives_a_fixed_signature():
    secret = "whsec_" + base64.b64encode(bytes(range(32))).decode()
    sig = sign(secret, "msg_x", TS, BODY)
    assert sig == _expected(secret, "msg_x", TS, BODY)
    assert sig.startswith("v1,")
    assert sign(secret, "msg_x", TS, BODY) == sig


@pytest.mark.parametrize("change", ["msg", "ts", "body"])
def test_every_signed_part_changes_the_signature(change):
    secret = new_secret()
    base = sign(secret, "msg_x", TS, BODY)
    other = {
        "msg": lambda: sign(secret, "msg_y", TS, BODY),
        "ts": lambda: sign(secret, "msg_x", TS + 1, BODY),
        "body": lambda: sign(secret, "msg_x", TS, b'{"a":2}'),
    }[change]()
    assert other != base


def test_build_headers_has_exactly_the_five_headers():
    secret = new_secret()
    h = build_headers(msg_id="msg_x", timestamp=TS, body=BODY, current=secret, previous=None)
    assert h == {
        "webhook-id": "msg_x",
        "webhook-timestamp": str(TS),
        "webhook-signature": _expected(secret, "msg_x", TS, BODY),
        "content-type": "application/json",
        "user-agent": "Syrel-Webhooks/1",
    }
    assert h["webhook-signature"].count("v1,") == 1


def test_an_overlap_carries_both_signatures_new_first_space_separated():
    s0, s1 = new_secret(), new_secret()
    h = build_headers(msg_id="msg_x", timestamp=TS, body=BODY, current=s1, previous=s0)
    assert h["webhook-signature"] == (
        _expected(s1, "msg_x", TS, BODY) + " " + _expected(s0, "msg_x", TS, BODY)
    )


def test_the_timestamp_is_the_callers_so_each_attempt_is_signed_fresh():
    secret = new_secret()
    first = build_headers(msg_id="msg_x", timestamp=TS, body=BODY, current=secret, previous=None)
    later = build_headers(msg_id="msg_x", timestamp=TS + 600, body=BODY, current=secret, previous=None)
    assert first["webhook-id"] == later["webhook-id"]
    assert later["webhook-timestamp"] == str(TS + 600)
    assert first["webhook-signature"] != later["webhook-signature"]


def test_no_secret_appears_in_any_log_record(caplog):
    caplog.set_level(logging.DEBUG)
    secret = new_secret()
    previous = new_secret()
    build_headers(msg_id="msg_x", timestamp=TS, body=BODY, current=secret, previous=previous)
    sign(secret, "msg_x", TS, BODY)
    for record in caplog.records:
        text = record.getMessage()
        assert secret not in text and previous not in text
        assert secret[len("whsec_"):] not in text


def test_the_signer_imports_only_stdlib_and_does_no_io():
    src = inspect.getsource(webhook_signer)
    imported = set()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.Import):
            imported |= {a.name.split(".")[0] for a in node.names}
        elif isinstance(node, ast.ImportFrom) and node.module:
            imported.add(node.module.split(".")[0])
    assert imported <= {"__future__", "base64", "hashlib", "hmac", "secrets", "typing"}, imported
    assert "logging" not in src and "AsyncClient" not in src
