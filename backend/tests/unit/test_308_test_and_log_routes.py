"""Phase 308-04 Task 2 (HOOK-04; D-20, D-21, D-29, D-41; P-6; T-308-16) — Send test, the delivery
log, Resend, and the two per-member rate-limit buckets.

* ``POST /webhooks/{id}/test`` is synchronous: the same payload freezing, signer and send path the
  drainer uses, recorded as a ``webhook.test`` delivery with ONE attempt, never retried.
* ``GET /webhooks/{id}/deliveries`` pages newest first with words and numbers only — no body.
* ``POST /webhooks/{id}/deliveries/{did}/resend`` queues a finished delivery again.
* Every refusal is ``{code, message}`` (P-6) so the client never shows "status 429".

Same harness as ``test_308_routes`` (fresh FastAPI, in-memory db store, nothing touches Postgres).
"""
from __future__ import annotations

import base64
import json
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import HTTPException

from app.services import rate_limit, webhook_sender, webhook_signer
from app.services.webhook_sender import SendOutcome
from tests.unit.test_308_routes import (  # noqa: F401 — the shared fixtures
    HOST,
    ORG,
    OTHER,
    URL,
    USER,
    FakeRedis,
    client,
    keys_of,
    store,
)

SECRET = "whsec_" + base64.b64encode(b"k" * 32).decode()
PREVIOUS = "whsec_" + base64.b64encode(b"p" * 32).decode()


def _ok(code=204, latency=120):
    return SendOutcome(delivered=True, status_code=code, latency_ms=latency, error=None, retryable=False)


def _failed(error, code=None, retryable=False):
    return SendOutcome(delivered=False, status_code=code, latency_ms=95, error=error, retryable=retryable)


@pytest.fixture
def sends(monkeypatch):
    calls: list[dict] = []
    box = {"outcome": _ok()}

    async def fake_send(url, body, headers, **kwargs):
        calls.append({"url": url, "body": body, "headers": dict(headers)})
        return box["outcome"]

    monkeypatch.setattr(webhook_sender, "send", fake_send)
    calls_box = type("Sends", (), {})()
    calls_box.calls = calls
    calls_box.box = box
    return calls_box


# ── rate_limit: the two buckets ───────────────────────────────────────────────────────────────


def test_the_two_kinds_and_constants_exist():
    assert "webhook_test" in rate_limit.Kind.__args__
    assert "webhook_resend" in rate_limit.Kind.__args__
    assert rate_limit.WEBHOOK_TESTS_PER_MINUTE == 5
    assert rate_limit.WEBHOOK_RESENDS_PER_MINUTE == 20


@pytest.mark.asyncio
@pytest.mark.parametrize("kind, limit", [("webhook_test", 5), ("webhook_resend", 20)])
async def test_enforce_user_webhook_limit_refuses_over_the_bucket(kind, limit):
    redis = FakeRedis()
    for _ in range(limit):
        await rate_limit.enforce_user_webhook_limit(redis, user_id=USER, kind=kind)
    with pytest.raises(HTTPException) as exc:
        await rate_limit.enforce_user_webhook_limit(redis, user_id=USER, kind=kind)
    assert exc.value.status_code == 429
    assert exc.value.detail["code"] == "rate_limited"
    assert isinstance(exc.value.detail["message"], str) and "429" not in exc.value.detail["message"]
    assert 1 <= int(exc.value.headers["Retry-After"]) <= 60
    # another member has their own bucket
    await rate_limit.enforce_user_webhook_limit(redis, user_id=OTHER, kind=kind)


@pytest.mark.asyncio
async def test_the_buckets_are_independent():
    redis = FakeRedis()
    for _ in range(5):
        await rate_limit.enforce_user_webhook_limit(redis, user_id=USER, kind="webhook_test")
    await rate_limit.enforce_user_webhook_limit(redis, user_id=USER, kind="webhook_resend")


@pytest.mark.asyncio
async def test_enforce_user_webhook_limit_fails_closed():
    redis = FakeRedis()
    redis.down = True
    with pytest.raises(HTTPException) as exc:
        await rate_limit.enforce_user_webhook_limit(redis, user_id=USER, kind="webhook_test")
    assert exc.value.status_code == 503
    assert exc.value.detail == {"code": "unavailable", "message": rate_limit.UNAVAILABLE_DETAIL}


@pytest.mark.asyncio
async def test_enforce_user_webhook_limit_refuses_a_foreign_kind():
    with pytest.raises(ValueError):
        await rate_limit.enforce_user_webhook_limit(FakeRedis(), user_id=USER, kind="start")


# ── Send test ─────────────────────────────────────────────────────────────────────────────────


def test_test_delivers_through_the_shared_send_path(client, store, sends, monkeypatch):
    seen_headers: list[dict] = []
    real_build = webhook_signer.build_headers

    def spy_build(**kwargs):
        seen_headers.append(kwargs)
        return real_build(**kwargs)

    monkeypatch.setattr(webhook_signer, "build_headers", spy_build)
    eid = store.add(secret=SECRET)
    before = int(datetime.now(timezone.utc).timestamp())
    r = client.post(f"/webhooks/{eid}/test")
    after = int(datetime.now(timezone.utc).timestamp())
    assert r.status_code == 200, r.text
    assert r.json() == {"delivered": True, "status_code": 204, "latency_ms": 120, "error": None}

    (created,) = store.test_deliveries
    payload = json.loads(created["payload"])
    assert payload["type"] == "webhook.test"
    assert payload["data"]["endpoint_id"] == eid
    (call,) = sends.calls
    assert call["url"] == URL
    assert call["body"] == created["payload"].encode("ascii")
    (kw,) = seen_headers
    assert kw["msg_id"] == f"msg_{created['event_id']}"
    assert before <= kw["timestamp"] <= after
    assert kw["current"] == SECRET and kw["previous"] is None
    expected = webhook_signer.sign(SECRET, kw["msg_id"], kw["timestamp"], call["body"])
    assert call["headers"]["webhook-signature"] == expected

    assert store.test_outcomes == [{"delivery_id": created["delivery_id"], "sent": True,
                                    "status_code": 204, "latency_ms": 120, "error": None}]
    assert [a["action_type"] for a in store.audits] == ["webhook.endpoint.test_sent"]
    assert store.audits[0]["metadata"] == {"actor": "owner", "endpoint_id": eid, "host": HOST}


def test_test_signs_with_both_secrets_during_an_overlap(client, store, sends):
    from app.security import secret_cipher

    eid = store.add(secret=SECRET)
    row = store.endpoints[eid]
    row["previous_secret_ciphertext"] = secret_cipher.encrypt_secret(PREVIOUS, store.cipher)
    row["previous_secret_expires_at"] = datetime.now(timezone.utc) + timedelta(hours=3)
    assert client.post(f"/webhooks/{eid}/test").status_code == 200
    sigs = sends.calls[0]["headers"]["webhook-signature"].split(" ")
    assert len(sigs) == 2


def test_test_ignores_an_expired_previous_secret(client, store, sends):
    from app.security import secret_cipher

    eid = store.add(secret=SECRET)
    row = store.endpoints[eid]
    row["previous_secret_ciphertext"] = secret_cipher.encrypt_secret(PREVIOUS, store.cipher)
    row["previous_secret_expires_at"] = datetime.now(timezone.utc) - timedelta(minutes=1)
    assert client.post(f"/webhooks/{eid}/test").status_code == 200
    assert len(sends.calls[0]["headers"]["webhook-signature"].split(" ")) == 1


@pytest.mark.parametrize("outcome, expected", [
    (_failed("http_status", 500, True), {"delivered": False, "status_code": 500, "latency_ms": 95,
                                         "error": "http_status"}),
    (_failed("timeout", None, True), {"delivered": False, "status_code": None, "latency_ms": 95,
                                      "error": "timeout"}),
    (_failed("refused_address"), {"delivered": False, "status_code": None, "latency_ms": 95,
                                  "error": "refused_address"}),
])
def test_test_reports_a_failed_send_and_records_it_once(client, store, sends, outcome, expected):
    sends.box["outcome"] = outcome
    eid = store.add(secret=SECRET)
    r = client.post(f"/webhooks/{eid}/test")
    assert r.status_code == 200
    assert r.json() == expected
    (rec,) = store.test_outcomes
    assert rec["sent"] is False and rec["error"] == expected["error"]
    assert len(sends.calls) == 1   # never retried


def test_test_with_a_guard_failure_sends_nothing(client, store, sends, monkeypatch):
    async def withheld(model, *, org_id, is_on):
        return None

    monkeypatch.setattr(webhook_sender, "freeze_payload", withheld)
    eid = store.add(secret=SECRET)
    r = client.post(f"/webhooks/{eid}/test")
    assert r.status_code == 200
    assert r.json() == {"delivered": False, "status_code": None, "latency_ms": None, "error": None}
    assert sends.calls == []
    (rec,) = store.test_outcomes
    assert rec["sent"] is False
    # 308 orchestrator fix: the log names WHY nothing was sent, not a generic "not retried".
    assert rec["reason"] == "redaction_failed"
    (created,) = store.test_deliveries
    assert created["payload"] is None


def test_test_with_an_unreadable_secret_records_secret_unreadable(client, store, sends, monkeypatch):
    from app.api import webhooks as webhooks_api

    async def unreadable(pool, endpoint_id, org, now):
        return None

    monkeypatch.setattr(webhooks_api, "_signing_secrets", unreadable)
    eid = store.add(secret=SECRET)
    r = client.post(f"/webhooks/{eid}/test")
    assert r.status_code == 200
    assert sends.calls == []
    (rec,) = store.test_outcomes
    assert rec["sent"] is False and rec["reason"] == "secret_unreadable"


def test_test_on_an_off_endpoint_is_refused(client, store, sends):
    eid = store.add(enabled=False)
    r = client.post(f"/webhooks/{eid}/test")
    assert r.status_code == 409
    assert r.json()["detail"] == {"code": "endpoint_off", "message": "Turn the endpoint on to send a test."}
    assert store.test_deliveries == [] and sends.calls == [] and store.audits == []


def test_the_sixth_test_in_a_minute_is_refused(client, store, sends):
    eid = store.add(secret=SECRET)
    for _ in range(5):
        assert client.post(f"/webhooks/{eid}/test").status_code == 200
    r = client.post(f"/webhooks/{eid}/test")
    assert r.status_code == 429
    assert r.json()["detail"]["code"] == "rate_limited"
    assert "Retry-After" in r.headers
    assert len(sends.calls) == 5


def test_test_fails_closed_when_the_limiter_is_down(client, store, sends):
    eid = store.add(secret=SECRET)
    store.redis.down = True
    r = client.post(f"/webhooks/{eid}/test")
    assert r.status_code == 503 and r.json()["detail"]["code"] == "unavailable"
    assert sends.calls == []


def test_test_on_another_members_endpoint_is_a_404(client, store, sends):
    eid = store.add(user=OTHER)
    assert client.post(f"/webhooks/{eid}/test").status_code == 404
    assert sends.calls == [] and store.test_deliveries == []


# ── the delivery log ──────────────────────────────────────────────────────────────────────────

LOG_KEYS = {
    "id", "event_type", "item_kind", "item_id", "status", "reason", "attempts", "last_status_code",
    "last_latency_ms", "last_error", "last_attempt_at", "next_attempt_at", "created_at",
}


def test_the_log_pages_newest_first_with_words_only(client, store):
    eid = store.add()
    t0 = datetime.now(timezone.utc) - timedelta(hours=1)
    first = store.add_delivery(eid, event_type="run.finished", created=t0)
    second = store.add_delivery(eid, event_type="document.ingested", created=t0 + timedelta(minutes=1))
    third = store.add_delivery(eid, event_type="webhook.test", created=t0 + timedelta(minutes=2))

    r = client.get(f"/webhooks/{eid}/deliveries", params={"limit": 2})
    assert r.status_code == 200, r.text
    page = r.json()
    assert [d["id"] for d in page["deliveries"]] == [third, second]
    assert [d["item_kind"] for d in page["deliveries"]] == ["test", "document"]
    assert all(set(d) == LOG_KEYS for d in page["deliveries"])
    assert page["next_cursor"]

    r = client.get(f"/webhooks/{eid}/deliveries", params={"limit": 2, "before": page["next_cursor"]})
    page2 = r.json()
    assert [d["id"] for d in page2["deliveries"]] == [first]
    assert page2["deliveries"][0]["item_kind"] == "run"
    assert page2["next_cursor"] is None


def test_the_log_hides_an_item_the_owner_can_no_longer_see(client, store):
    eid = store.add()
    store.add_delivery(eid, status="skipped_not_visible")
    (row,) = client.get(f"/webhooks/{eid}/deliveries").json()["deliveries"]
    assert row["item_id"] is None


def test_the_log_page_is_capped_at_50(client, store):
    eid = store.add()
    t0 = datetime.now(timezone.utc) - timedelta(days=1)
    for i in range(55):
        store.add_delivery(eid, created=t0 + timedelta(seconds=i))
    page = client.get(f"/webhooks/{eid}/deliveries", params={"limit": 500}).json()
    assert len(page["deliveries"]) == 50 and page["next_cursor"]


def test_a_garbled_cursor_is_refused(client, store):
    eid = store.add()
    r = client.get(f"/webhooks/{eid}/deliveries", params={"before": "not-a-cursor!"})
    assert r.status_code == 422
    assert r.json()["detail"]["code"] == "bad_cursor"


def test_the_log_of_another_members_endpoint_is_a_404(client, store):
    eid = store.add(user=OTHER)
    store.add_delivery(eid)
    assert client.get(f"/webhooks/{eid}/deliveries").status_code == 404


def test_the_log_never_carries_a_body(client, store):
    eid = store.add()
    store.add_delivery(eid)
    keys = set(keys_of(client.get(f"/webhooks/{eid}/deliveries").json()))
    assert not keys & {"body", "payload", "response", "headers", "request_body"}


# ── Resend ────────────────────────────────────────────────────────────────────────────────────


def test_resend_queues_a_finished_delivery_again(client, store):
    eid = store.add()
    did = store.add_delivery(eid, status="failed", attempts=7)
    r = client.post(f"/webhooks/{eid}/deliveries/{did}/resend")
    assert r.status_code == 200, r.text
    d = r.json()["delivery"]
    assert d["id"] == did and d["status"] == "pending" and d["attempts"] == 0
    assert store.audits == [{
        "user_id": USER, "action_type": "webhook.endpoint.delivery_resent", "org_id": ORG,
        "metadata": {"actor": "owner", "endpoint_id": eid, "host": HOST},
    }]


def test_resend_on_an_off_endpoint_is_refused(client, store):
    eid = store.add(enabled=False)
    did = store.add_delivery(eid, status="sent")
    r = client.post(f"/webhooks/{eid}/deliveries/{did}/resend")
    assert r.status_code == 409
    assert r.json()["detail"] == {"code": "endpoint_off", "message": "Resend works when the endpoint is on."}
    assert store.audits == []


@pytest.mark.parametrize("event_type, status", [
    ("webhook.test", "sent"), ("run.finished", "skipped_disabled"), ("run.finished", "sending"),
])
def test_resend_refuses_a_test_a_skipped_or_an_in_flight_delivery(client, store, event_type, status):
    eid = store.add()
    did = store.add_delivery(eid, event_type=event_type, status=status)
    assert client.post(f"/webhooks/{eid}/deliveries/{did}/resend").status_code == 404
    assert store.audits == []


def test_resend_on_another_members_endpoint_is_a_404(client, store):
    eid = store.add(user=OTHER)
    did = store.add_delivery(eid)
    assert client.post(f"/webhooks/{eid}/deliveries/{did}/resend").status_code == 404
    assert store.deliveries[did]["status"] == "sent"


def test_resend_is_rate_limited(client, store):
    eid = store.add()
    dids = [store.add_delivery(eid) for _ in range(21)]
    for did in dids[:20]:
        assert client.post(f"/webhooks/{eid}/deliveries/{did}/resend").status_code == 200
    r = client.post(f"/webhooks/{eid}/deliveries/{dids[20]}/resend")
    assert r.status_code == 429 and r.json()["detail"]["code"] == "rate_limited"
    assert store.deliveries[dids[20]]["status"] == "sent"


def test_resend_with_an_unknown_delivery_is_a_404(client, store):
    eid = store.add()
    assert client.post(f"/webhooks/{eid}/deliveries/{uuid.uuid4()}/resend").status_code == 404
