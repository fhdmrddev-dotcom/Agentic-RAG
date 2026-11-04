"""Phase 308-03 (D-03, D-09..D-11, D-13, D-15, D-17..D-19, D-25, D-26, D-41, D-44, D-48) —
``WebhookDrainer`` against fakes.

The outbox module, liveness, visibility, the cipher, the guard and the send are all replaced, so
every arm of the drainer's decision table is driven without a database or a network: the retry
schedule with jitter and Retry-After, the outcome -> record table, auto-disable with one audit for
the winner only, fan-out with visibility (no row for an owner who cannot see the document) and
liveness (skipped_owner_gone + owner_removed), the payload frozen once per event, the send-time
check order, per-attempt signing with the overlap secret, one failing row never stopping the batch,
the hourly purge, and logs that never carry a URL, a secret or the payload.

The real database behaviour of the same statements is proven in ``tests/integration/test_308_*_live``.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import logging
from contextlib import asynccontextmanager
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest
from cryptography.fernet import Fernet, MultiFernet

from app.db import webhook_outbox as outbox
from app.security import secret_cipher
from app.services import webhook_drainer as wd
from app.services import webhook_sender, webhook_signer
from app.services.webhook_sender import SendOutcome

NOW = datetime(2000, 1, 1, 0, 1, tzinfo=timezone.utc)
URL = "https://hooks.example.com/in/tok_SECRETPATH?key=QUERYTOKEN"
CIPHER = MultiFernet([Fernet(Fernet.generate_key())])
CURRENT = webhook_signer.new_secret()
PREVIOUS = webhook_signer.new_secret()
PAYLOAD = '{"data":{"run_id":"x"},"type":"run.finished"}'


def _ok(**kw) -> SendOutcome:
    base = dict(delivered=True, status_code=200, latency_ms=12, error=None, retryable=False)
    base.update(kw)
    return SendOutcome(**base)


def _fail(status_code=None, error="http_status", retryable=True, **kw) -> SendOutcome:
    return SendOutcome(delivered=False, status_code=status_code, latency_ms=9, error=error,
                       retryable=retryable, **kw)


def _row(**kw) -> outbox.ClaimedWebhookDelivery:
    base = dict(
        id=uuid4(), endpoint_id=uuid4(), event_id=uuid4(), attempts=1, event_type="run.finished",
        item_id=uuid4(), org_id=uuid4(), user_id=uuid4(), payload=PAYLOAD, url=URL,
        secret_ciphertext=secret_cipher.encrypt_secret(CURRENT, CIPHER),
        previous_secret_ciphertext=None, previous_secret_expires_at=None, enabled=True,
        event_created_at=NOW - timedelta(minutes=1),
    )
    base.update(kw)
    return outbox.ClaimedWebhookDelivery(**base)


@asynccontextmanager
async def _acm(value=None):
    yield value


class FakeCon:
    def transaction(self):
        return _acm()


class FakePool:
    def __init__(self) -> None:
        self.con = FakeCon()

    def acquire(self):
        return _acm(self.con)


class FakeOutbox:
    """Every outbox function the drainer calls, recording its calls."""

    def __init__(self, *, events=(), candidates=None, claimed=(), renew=True, register=None,
                 disable_wins=True) -> None:
        self.events = list(events)
        self.candidates = candidates or {}
        self.claimed = list(claimed)
        self.renew = renew
        self.register = register
        self.disable_wins = disable_wins
        self.calls: list[tuple] = []

    def install(self, monkeypatch) -> "FakeOutbox":
        for name in (
            "claim_next_event", "candidate_endpoints", "insert_deliveries", "fail_unfrozen_deliveries",
            "mark_fanned_out", "reclaim_stale_sending", "claim_due_deliveries", "renew_lease",
            "record_outcome", "skip_delivery", "mark_success", "register_failure", "disable_endpoint",
            "purge_old_events", "erase_expired_previous_secrets",
        ):
            monkeypatch.setattr(outbox, name, getattr(self, name))
        return self

    def named(self, name):
        return [c[1] for c in self.calls if c[0] == name]

    async def claim_next_event(self, con, *, now=None):
        self.calls.append(("claim_next_event", {"now": now}))
        return self.events.pop(0) if self.events else None

    async def candidate_endpoints(self, con, *, event):
        self.calls.append(("candidate_endpoints", {"event": event["id"]}))
        return list(self.candidates.get(event["id"], []))

    async def insert_deliveries(self, con, *, event_id, rows, now=None):
        self.calls.append(("insert_deliveries", {"event_id": event_id, "rows": list(rows)}))
        return [{"id": uuid4(), "endpoint_id": e, "status": s} for e, s in rows]

    async def fail_unfrozen_deliveries(self, con, *, event_id, reason):
        self.calls.append(("fail_unfrozen_deliveries", {"event_id": event_id, "reason": reason}))

    async def mark_fanned_out(self, con, *, event_id, payload, now=None):
        self.calls.append(("mark_fanned_out", {"event_id": event_id, "payload": payload}))

    async def reclaim_stale_sending(self, pool, *, lease_seconds, max_attempts, now=None):
        self.calls.append(("reclaim_stale_sending", {"lease_seconds": lease_seconds, "max_attempts": max_attempts}))
        return 0

    async def claim_due_deliveries(self, pool, *, limit, now=None, max_attempts):
        self.calls.append(("claim_due_deliveries", {"limit": limit, "max_attempts": max_attempts}))
        rows, self.claimed = self.claimed, []
        return rows

    async def renew_lease(self, pool, *, delivery_id, attempts, now=None):
        self.calls.append(("renew_lease", {"delivery_id": delivery_id, "attempts": attempts}))
        return self.renew

    async def record_outcome(self, pool, **kw):
        self.calls.append(("record_outcome", kw))
        return True

    async def skip_delivery(self, pool, *, delivery_id, status, attempts=None):
        self.calls.append(("skip_delivery", {"delivery_id": delivery_id, "status": status}))
        return True

    async def mark_success(self, pool, *, endpoint_id, now=None):
        self.calls.append(("mark_success", {"endpoint_id": endpoint_id}))

    async def register_failure(self, pool, *, endpoint_id, threshold, now=None):
        self.calls.append(("register_failure", {"endpoint_id": endpoint_id, "threshold": threshold}))
        return self.register

    async def disable_endpoint(self, pool, *, endpoint_id, reason, now=None):
        self.calls.append(("disable_endpoint", {"endpoint_id": endpoint_id, "reason": reason}))
        if not self.disable_wins:
            return None
        return {"id": endpoint_id, "user_id": uuid4(), "org_id": uuid4(), "url": URL}

    async def purge_old_events(self, pool, *, older_than_days, batch=1000, max_batches=20, now=None):
        self.calls.append(("purge_old_events", {"older_than_days": older_than_days}))
        return 0

    async def erase_expired_previous_secrets(self, pool, *, now=None):
        self.calls.append(("erase_expired_previous_secrets", {}))
        return 0


class CountingSend:
    def __init__(self, *outcomes: SendOutcome) -> None:
        self.outcomes = list(outcomes) or [_ok()]
        self.calls: list[tuple[str, bytes, dict]] = []

    async def __call__(self, url, body, headers):
        self.calls.append((url, body, dict(headers)))
        return self.outcomes[min(len(self.calls) - 1, len(self.outcomes) - 1)]


class Recorder:
    """An async callable recording its calls and returning a fixed answer (or raising)."""

    def __init__(self, answer=True, *, raises: Exception | None = None) -> None:
        self.answer = answer
        self.raises = raises
        self.calls: list = []

    async def __call__(self, *args, **kw):
        self.calls.append((args, kw))
        if self.raises is not None:
            raise self.raises
        return self.answer(*args, **kw) if callable(self.answer) else self.answer


def _drainer(fake: FakeOutbox, *, send=None, liveness=None, visibility=None, cipher=CIPHER,
             audit=None, clock=None, **kw) -> wd.WebhookDrainer:
    return wd.WebhookDrainer(
        FakePool(),
        send=send or CountingSend(),
        liveness=liveness or Recorder(True),
        visibility=visibility or Recorder(lambda **k: set(k["ids"])),
        cipher_getter=lambda: cipher,
        is_on=Recorder(False),
        audit=audit or Recorder(None),
        rng=lambda: 0.5,
        clock=clock or (lambda: 0.0),
        **kw,
    )


# ── constants and the schedule (D-17) ──────────────────────────────────────────────────────


def test_the_constants():
    assert wd.RETRY_SCHEDULE_SECONDS == (0, 30, 300, 1800, 7200, 28800)
    assert wd.MAX_ATTEMPTS == 6 == len(wd.RETRY_SCHEDULE_SECONDS)
    assert wd.AUTO_DISABLE_AFTER == 5
    assert wd.PURGE_EVERY_SECONDS == 3600
    assert wd.RETENTION_DAYS == 30
    assert wd.JITTER_FRACTION == 0.1
    d = wd.WebhookDrainer(FakePool())
    assert (d._poll_interval_seconds, d._max_claims_per_tick, d._lease_seconds) == (20, 20, 600)


@pytest.mark.parametrize("done", [1, 2, 3, 4, 5])
@pytest.mark.parametrize("r", [0.0, 0.25, 0.5, 0.75, 0.999])
def test_next_delay_is_the_step_with_ten_percent_jitter(done, r):
    step = wd.RETRY_SCHEDULE_SECONDS[done]
    delay = wd.next_delay(done, None, rng=lambda: r)
    assert step * 0.9 <= delay <= step * 1.1
    assert wd.next_delay(done, None, rng=lambda: 0.5) == step


@pytest.mark.parametrize("done, retry_after, expected", [
    (1, 120, 120),       # replaces the 30 s step
    (1, 1000, 300),      # clamped to the next step's delay
    (1, 0, 1),           # never below 1 s
    (4, 50000, 28800),   # clamped to the 8 h step
    (5, 99999, 28800),   # past the end: the last step
])
def test_retry_after_replaces_the_step_clamped_to_the_next(done, retry_after, expected):
    assert wd.next_delay(done, retry_after, rng=lambda: 0.0) == expected


# ── outcome -> record (D-17, D-18, D-19) ───────────────────────────────────────────────────


async def test_delivered_is_recorded_sent_and_resets_the_failure_run(monkeypatch):
    fake = FakeOutbox().install(monkeypatch)
    row = _row()
    assert await _drainer(fake)._record(row, _ok(), now=NOW) is True
    (rec,) = fake.named("record_outcome")
    assert rec["status"] == "sent" and rec["status_code"] == 200 and rec["latency_ms"] == 12
    assert rec["attempts"] == row.attempts and rec["error"] is None and rec["attempted"] is True
    assert fake.named("mark_success") == [{"endpoint_id": row.endpoint_id}]
    assert fake.named("register_failure") == []


async def test_gone_fails_turns_the_endpoint_off_and_audits_once(monkeypatch):
    fake = FakeOutbox().install(monkeypatch)
    audit = Recorder(None)
    row = _row()
    await _drainer(fake, audit=audit)._record(row, _fail(410, "gone", retryable=False, gone=True), now=NOW)
    (rec,) = fake.named("record_outcome")
    assert (rec["status"], rec["reason"], rec["error"]) == ("failed", "not_retried", "gone")
    assert fake.named("disable_endpoint") == [{"endpoint_id": row.endpoint_id, "reason": "gone"}]
    assert fake.named("register_failure") == []
    assert len(audit.calls) == 1
    meta = audit.calls[0][1]
    assert meta["reason"] == "gone" and meta["endpoint_id"] == row.endpoint_id
    assert meta["host"] == "hooks.example.com"


@pytest.mark.parametrize("attempts", [1, 2, 3, 4, 5])
async def test_a_retryable_failure_with_attempts_left_is_retrying_on_schedule(monkeypatch, attempts):
    fake = FakeOutbox().install(monkeypatch)
    await _drainer(fake)._record(_row(attempts=attempts), _fail(503), now=NOW)
    (rec,) = fake.named("record_outcome")
    assert rec["status"] == "retrying" and rec["error"] == "http_status" and rec["status_code"] == 503
    assert rec["next_attempt_at"] == NOW + timedelta(seconds=wd.RETRY_SCHEDULE_SECONDS[attempts])
    assert fake.named("register_failure") == []


async def test_retry_after_moves_the_next_attempt(monkeypatch):
    fake = FakeOutbox().install(monkeypatch)
    await _drainer(fake)._record(_row(attempts=1), _fail(429, retry_after_seconds=120), now=NOW)
    assert fake.named("record_outcome")[0]["next_attempt_at"] == NOW + timedelta(seconds=120)


async def test_the_sixth_retryable_failure_is_failed_max_attempts(monkeypatch):
    fake = FakeOutbox().install(monkeypatch)
    row = _row(attempts=6)
    await _drainer(fake)._record(row, _fail(None, "timeout"), now=NOW)
    (rec,) = fake.named("record_outcome")
    assert (rec["status"], rec["reason"], rec["error"]) == ("failed", "max_attempts", "timeout")
    assert fake.named("register_failure") == [{"endpoint_id": row.endpoint_id, "threshold": 5}]


@pytest.mark.parametrize("outcome", [
    _fail(400, retryable=False), _fail(302, "redirect", retryable=False),
    _fail(None, "refused_address", retryable=False), _fail(None, "response_too_large", retryable=False),
])
async def test_a_not_retried_failure_counts_toward_auto_disable(monkeypatch, outcome):
    fake = FakeOutbox().install(monkeypatch)
    await _drainer(fake)._record(_row(), outcome, now=NOW)
    (rec,) = fake.named("record_outcome")
    assert (rec["status"], rec["reason"]) == ("failed", "not_retried")
    assert len(fake.named("register_failure")) == 1


async def test_the_auto_disable_winner_audits_and_a_loser_does_not(monkeypatch):
    row = _row()
    won = {"id": row.endpoint_id, "user_id": row.user_id, "org_id": row.org_id, "url": URL}
    audit = Recorder(None)
    fake = FakeOutbox(register=won).install(monkeypatch)
    await _drainer(fake, audit=audit)._record(row, _fail(400, retryable=False), now=NOW)
    assert len(audit.calls) == 1
    kw = audit.calls[0][1]
    assert kw["reason"] == "failing" and kw["owner_id"] == row.user_id and kw["org_id"] == row.org_id

    audit2 = Recorder(None)
    fake2 = FakeOutbox(register=None).install(monkeypatch)
    await _drainer(fake2, audit=audit2)._record(row, _fail(400, retryable=False), now=NOW)
    assert audit2.calls == []


async def test_a_record_that_did_not_land_counts_nothing(monkeypatch):
    fake = FakeOutbox().install(monkeypatch)

    async def lost(pool, **kw):
        fake.calls.append(("record_outcome", kw))
        return False

    monkeypatch.setattr(outbox, "record_outcome", lost)
    await _drainer(fake)._record(_row(), _fail(400, retryable=False), now=NOW)
    await _drainer(fake)._record(_row(), _ok(), now=NOW)
    assert fake.named("register_failure") == [] and fake.named("mark_success") == []


async def test_the_default_audit_is_the_auto_disabled_action_with_syrel_as_actor(monkeypatch):
    seen = {}

    async def fake_write(**kw):
        seen.update(kw)

    monkeypatch.setattr("app.services.audit_service.write_audit_entry", fake_write)
    monkeypatch.setattr("app.dependencies.get_service_role_supabase", lambda org: f"client-{org}")
    owner, org, ep = uuid4(), uuid4(), uuid4()
    await wd.audit_auto_disabled(owner_id=owner, org_id=org, endpoint_id=ep, host="hooks.example.com", reason="failing")
    assert seen["action_type"] == "webhook.endpoint.auto_disabled"
    assert seen["user_id"] == str(owner) and seen["org_id"] == str(org)
    assert seen["metadata"] == {"actor": "syrel", "endpoint_id": str(ep), "host": "hooks.example.com", "reason": "failing"}
    assert seen["supabase"] == f"client-{org}"


# ── fan-out (D-03, D-15, D-25, D-26, D-41) ─────────────────────────────────────────────────


def _event(type_="run.finished", **kw) -> dict:
    base = dict(id=uuid4(), type=type_, org_id=uuid4(), item_id=uuid4(), owner_id=uuid4(),
                status="completed", origin_kind="app", definition_id=uuid4(), folder_id=None,
                created_at=NOW - timedelta(minutes=1))
    if type_ == "document.ingested":
        base.update(owner_id=None, origin_kind=None, definition_id=None, folder_id=uuid4())
    base.update(kw)
    return base


def _ep(owner, org) -> dict:
    return {"id": uuid4(), "user_id": owner, "org_id": org}


async def test_a_run_event_fans_out_to_its_candidates_with_the_payload_frozen_once(monkeypatch):
    ev = _event()
    eps = [_ep(ev["owner_id"], ev["org_id"]), _ep(ev["owner_id"], ev["org_id"])]
    fake = FakeOutbox(events=[ev], candidates={ev["id"]: eps}).install(monkeypatch)
    freezes = Recorder("FROZEN")
    monkeypatch.setattr(webhook_sender, "freeze_payload", freezes)
    visibility = Recorder(set())
    d = _drainer(fake, visibility=visibility)
    assert await d._fan_out(now=NOW) == 1
    (ins,) = fake.named("insert_deliveries")
    assert ins["rows"] == [(e["id"], "pending") for e in eps]
    assert fake.named("mark_fanned_out") == [{"event_id": ev["id"], "payload": "FROZEN"}]
    assert len(freezes.calls) == 1
    model = freezes.calls[0][0][0]
    assert model.type == "run.finished" and model.data.run_id == ev["item_id"]
    assert model.timestamp == ev["created_at"]
    assert freezes.calls[0][1]["org_id"] == str(ev["org_id"])
    assert visibility.calls == [], "run events are re-checked at send, not at fan-out"


async def test_a_document_event_reaches_only_owners_who_can_see_it_asked_once_per_owner(monkeypatch):
    ev = _event("document.ingested")
    a, b = uuid4(), uuid4()
    eps = [_ep(a, ev["org_id"]), _ep(a, ev["org_id"]), _ep(b, ev["org_id"])]
    fake = FakeOutbox(events=[ev], candidates={ev["id"]: eps}).install(monkeypatch)
    monkeypatch.setattr(webhook_sender, "freeze_payload", Recorder("FROZEN"))
    visibility = Recorder(lambda **k: set(k["ids"]) if k["owner_id"] == b else set())
    await _drainer(fake, visibility=visibility)._fan_out(now=NOW)
    (ins,) = fake.named("insert_deliveries")
    assert ins["rows"] == [(eps[2]["id"], "pending")], "no delivery row for an owner who cannot see it"
    asked = [(c[1]["owner_id"], c[1]["table"], c[1]["ids"]) for c in visibility.calls]
    assert sorted(asked, key=str) == sorted([(a, "documents", [ev["item_id"]]), (b, "documents", [ev["item_id"]])], key=str)


async def test_an_owner_refused_by_liveness_gets_a_skipped_row_and_the_endpoint_turned_off(monkeypatch):
    ev = _event()
    ep = _ep(ev["owner_id"], ev["org_id"])
    fake = FakeOutbox(events=[ev], candidates={ev["id"]: [ep]}).install(monkeypatch)
    freezes = Recorder("FROZEN")
    monkeypatch.setattr(webhook_sender, "freeze_payload", freezes)
    await _drainer(fake, liveness=Recorder(False))._fan_out(now=NOW)
    assert fake.named("insert_deliveries")[0]["rows"] == [(ep["id"], "skipped_owner_gone")]
    assert fake.named("disable_endpoint") == [{"endpoint_id": ep["id"], "reason": "owner_removed"}]
    assert freezes.calls == [], "nothing to send, nothing to freeze"


async def test_a_payload_the_guard_cannot_freeze_fails_every_delivery_and_sends_nothing(monkeypatch):
    ev = _event()
    eps = [_ep(ev["owner_id"], ev["org_id"])]
    fake = FakeOutbox(events=[ev], candidates={ev["id"]: eps}).install(monkeypatch)
    monkeypatch.setattr(webhook_sender, "freeze_payload", Recorder(None))
    send = CountingSend()
    await _drainer(fake, send=send)._fan_out(now=NOW)
    assert fake.named("insert_deliveries")[0]["rows"] == [(eps[0]["id"], "pending")]
    assert fake.named("fail_unfrozen_deliveries") == [{"event_id": ev["id"], "reason": "redaction_failed"}]
    assert fake.named("mark_fanned_out") == [{"event_id": ev["id"], "payload": None}]
    assert send.calls == []


async def test_the_guard_reads_the_switch_through_is_on_and_freezes_the_real_bytes(monkeypatch):
    """No fake freeze: the real freeze_payload through the real guard (textless_ok inside)."""
    ev = _event()
    fake = FakeOutbox(events=[ev], candidates={ev["id"]: [_ep(ev["owner_id"], ev["org_id"])]}).install(monkeypatch)
    for switch in (False, True):
        fake.events = [ev]
        fake.calls.clear()
        is_on = Recorder(switch)
        d = _drainer(fake)
        d._is_on = is_on
        await d._fan_out(now=NOW)
        frozen = fake.named("mark_fanned_out")[0]["payload"]
        assert frozen and frozen.startswith("{") and str(ev["item_id"]) in frozen
        assert is_on.calls and is_on.calls[0][0][0] == str(ev["org_id"])
        if switch is False:
            off = frozen
    assert frozen == off, "D-41: the redaction switch ON must not change the frozen bytes"


async def test_no_candidates_still_marks_the_event_fanned_out(monkeypatch):
    ev = _event()
    fake = FakeOutbox(events=[ev], candidates={}).install(monkeypatch)
    await _drainer(fake)._fan_out(now=NOW)
    assert fake.named("insert_deliveries") == []
    assert fake.named("mark_fanned_out") == [{"event_id": ev["id"], "payload": None}]


async def test_fan_out_stops_at_the_claim_limit(monkeypatch):
    events = [_event() for _ in range(5)]
    fake = FakeOutbox(events=events).install(monkeypatch)
    assert await _drainer(fake, max_claims_per_tick=3)._fan_out(now=NOW) == 3
    assert len(fake.events) == 2


# ── send (D-09, D-11, D-13, D-25, D-26) ───────────────────────────────────────────────────


async def _send_one(monkeypatch, row, **kw):
    fake = FakeOutbox(claimed=[row]).install(monkeypatch)
    send = kw.pop("send", None) or CountingSend()
    d = _drainer(fake, send=send, **kw)
    sent = await d._send_pass(now=NOW)
    return fake, send, sent, d


async def test_a_disabled_endpoint_is_skipped_and_nothing_sent(monkeypatch):
    row = _row(enabled=False)
    fake, send, sent, _ = await _send_one(monkeypatch, row)
    assert send.calls == [] and sent == 0
    assert fake.named("skip_delivery") == [{"delivery_id": row.id, "status": "skipped_disabled"}]


async def test_an_owner_no_longer_allowed_is_skipped_owner_gone_and_turned_off(monkeypatch):
    row = _row()
    liveness = Recorder(False)
    fake, send, _, _ = await _send_one(monkeypatch, row, liveness=liveness)
    assert send.calls == []
    assert fake.named("skip_delivery") == [{"delivery_id": row.id, "status": "skipped_owner_gone"}]
    assert fake.named("disable_endpoint") == [{"endpoint_id": row.endpoint_id, "reason": "owner_removed"}]
    owner = liveness.calls[0][0][0]
    assert (owner.user_id, owner.org_id) == (row.user_id, row.org_id)


async def test_an_item_the_owner_cannot_see_is_skipped_not_visible(monkeypatch):
    row = _row()
    fake, send, _, _ = await _send_one(monkeypatch, row, visibility=Recorder(set()))
    assert send.calls == []
    assert fake.named("skip_delivery") == [{"delivery_id": row.id, "status": "skipped_not_visible"}]
    assert fake.named("disable_endpoint") == []


async def test_visibility_is_asked_once_per_owner_org_and_table(monkeypatch):
    owner, org = uuid4(), uuid4()
    runs = [_row(user_id=owner, org_id=org) for _ in range(3)]
    docs = [_row(user_id=owner, org_id=org, event_type="document.ingested") for _ in range(2)]
    other = _row(org_id=org)
    fake = FakeOutbox(claimed=runs + docs + [other]).install(monkeypatch)
    visibility = Recorder(lambda **k: set(k["ids"]))
    send = CountingSend()
    await _drainer(fake, send=send, visibility=visibility)._send_pass(now=NOW)
    assert len(send.calls) == 6
    groups = sorted(((c[1]["owner_id"], c[1]["table"], len(c[1]["ids"])) for c in visibility.calls), key=str)
    assert groups == sorted([(owner, "workflow_runs", 3), (owner, "documents", 2), (other.user_id, "workflow_runs", 1)], key=str)


async def test_a_lost_lease_never_sends_and_records_nothing(monkeypatch):
    row = _row()
    fake = FakeOutbox(claimed=[row], renew=False).install(monkeypatch)
    send = CountingSend()
    await _drainer(fake, send=send)._send_pass(now=NOW)
    assert send.calls == []
    assert fake.named("record_outcome") == [] and fake.named("skip_delivery") == []


@pytest.mark.parametrize("variant", ["no_cipher", "invalid_token"])
async def test_an_unreadable_secret_fails_the_delivery_and_sends_nothing(monkeypatch, variant):
    if variant == "no_cipher":
        row, cipher = _row(), None
    else:
        other = MultiFernet([Fernet(Fernet.generate_key())])
        row, cipher = _row(secret_ciphertext=secret_cipher.encrypt_secret(CURRENT, other)), CIPHER
    fake, send, _, _ = await _send_one(monkeypatch, row, cipher=cipher)
    assert send.calls == []
    (rec,) = fake.named("record_outcome")
    assert (rec["status"], rec["reason"], rec["attempted"]) == ("failed", "secret_unreadable", False)
    assert fake.named("register_failure") == []


async def test_a_missing_frozen_payload_is_redaction_failed_and_not_sent(monkeypatch):
    row = _row(payload=None)
    fake, send, _, _ = await _send_one(monkeypatch, row)
    assert send.calls == []
    assert fake.named("record_outcome")[0]["reason"] == "redaction_failed"


def _verify(secret: str, msg_id: str, ts: str, body: bytes, sig: str) -> bool:
    key = base64.b64decode(secret[len("whsec_"):])
    mac = hmac.new(key, f"{msg_id}.{ts}.".encode() + body, hashlib.sha256).digest()
    return sig == "v1," + base64.b64encode(mac).decode()


async def test_the_send_is_signed_now_with_the_stable_webhook_id(monkeypatch):
    row = _row()
    fake, send, sent, _ = await _send_one(monkeypatch, row)
    assert sent == 1
    ((url, body, headers),) = send.calls
    assert url == URL and body == PAYLOAD.encode("ascii")
    assert headers["webhook-id"] == f"msg_{row.event_id}"
    assert headers["webhook-timestamp"] == str(int(NOW.timestamp()))
    sigs = headers["webhook-signature"].split(" ")
    assert len(sigs) == 1 and _verify(CURRENT, headers["webhook-id"], headers["webhook-timestamp"], body, sigs[0])
    assert fake.named("renew_lease") == [{"delivery_id": row.id, "attempts": row.attempts}]


async def test_an_unexpired_previous_secret_adds_the_second_signature(monkeypatch):
    row = _row(previous_secret_ciphertext=secret_cipher.encrypt_secret(PREVIOUS, CIPHER),
               previous_secret_expires_at=NOW + timedelta(hours=1))
    _, send, _, _ = await _send_one(monkeypatch, row)
    _, body, headers = send.calls[0]
    new, old = headers["webhook-signature"].split(" ")
    ts = headers["webhook-timestamp"]
    assert _verify(CURRENT, headers["webhook-id"], ts, body, new)
    assert _verify(PREVIOUS, headers["webhook-id"], ts, body, old)


async def test_an_expired_previous_secret_is_not_used(monkeypatch):
    row = _row(previous_secret_ciphertext=secret_cipher.encrypt_secret(PREVIOUS, CIPHER),
               previous_secret_expires_at=NOW - timedelta(seconds=1))
    _, send, _, _ = await _send_one(monkeypatch, row)
    assert len(send.calls[0][2]["webhook-signature"].split(" ")) == 1


async def test_the_timestamp_is_recomputed_per_attempt_and_the_id_is_not(monkeypatch):
    row = _row()
    fake = FakeOutbox(claimed=[row]).install(monkeypatch)
    send = CountingSend(_fail(503), _ok())
    d = _drainer(fake, send=send)
    await d._send_pass(now=NOW)
    fake.claimed = [replace(row, attempts=2)]
    await d._send_pass(now=NOW + timedelta(seconds=40))
    (_, b1, h1), (_, b2, h2) = send.calls
    assert h1["webhook-id"] == h2["webhook-id"] == f"msg_{row.event_id}" and b1 == b2
    assert int(h2["webhook-timestamp"]) - int(h1["webhook-timestamp"]) == 40
    assert h1["webhook-signature"] != h2["webhook-signature"]


async def test_one_failing_row_never_stops_the_batch(monkeypatch):
    bad, good = _row(), _row()

    async def liveness(owner):
        if owner.user_id == bad.user_id:
            raise RuntimeError("db blip")
        return True

    fake = FakeOutbox(claimed=[bad, good]).install(monkeypatch)
    send = CountingSend()
    sent = await _drainer(fake, send=send, liveness=liveness)._send_pass(now=NOW)
    assert sent == 1 and len(send.calls) == 1
    recs = {r["delivery_id"]: r for r in fake.named("record_outcome")}
    assert recs[bad.id]["status"] == "retrying" and recs[bad.id]["attempted"] is False
    assert recs[good.id]["status"] == "sent"


async def test_an_unclassified_send_error_is_failed_not_retried_and_never_crashes(monkeypatch):
    row = _row()

    async def boom(url, body, headers):
        raise ValueError("a programming error in the sender")

    fake = FakeOutbox(claimed=[row, _row()]).install(monkeypatch)
    await _drainer(fake, send=boom)._send_pass(now=NOW)
    recs = fake.named("record_outcome")
    assert len(recs) == 2
    assert all((r["status"], r["reason"], r["error"], r["attempted"]) == ("failed", "not_retried", None, False) for r in recs)
    assert fake.named("register_failure") == []


async def test_the_send_claim_asks_for_six_attempts_and_reclaims_first(monkeypatch):
    fake = FakeOutbox().install(monkeypatch)
    await _drainer(fake)._send_pass(now=NOW)
    names = [c[0] for c in fake.calls]
    assert names[:2] == ["reclaim_stale_sending", "claim_due_deliveries"]
    assert fake.named("claim_due_deliveries")[0]["max_attempts"] == 6
    assert fake.named("reclaim_stale_sending")[0] == {"lease_seconds": 600, "max_attempts": 6}


# ── defaults: the ONE liveness predicate, the ONE acting connection (D-25, D-26) ────────────


async def test_the_default_liveness_is_principal_still_allowed_with_kind_webhook(monkeypatch):
    seen = {}

    async def fake_allowed(pool, *, key_row):
        seen.update(key_row)
        return None

    monkeypatch.setattr(wd, "principal_still_allowed", fake_allowed)
    owner = wd.EndpointOwner(user_id=uuid4(), org_id=uuid4())
    assert await wd.endpoint_owner_allowed("POOL", owner) is True
    assert seen == {"org_id": owner.org_id, "user_id": owner.user_id, "kind": "webhook"}

    async def refuse(pool, *, key_row):
        return object()

    monkeypatch.setattr(wd, "principal_still_allowed", refuse)
    assert await wd.endpoint_owner_allowed("POOL", owner) is False


@pytest.mark.parametrize("table", ["workflow_runs", "documents"])
async def test_the_default_visibility_is_one_acting_connection_and_one_select(monkeypatch, table):
    opened = []
    ids = [uuid4(), uuid4()]

    class Conn:
        async def fetch(self, sql, arg):
            opened[-1]["sql"] = sql
            opened[-1]["arg"] = arg
            return [{"id": ids[0]}]

    @asynccontextmanager
    async def fake_acting(*, user_id, org_id):
        opened.append({"user_id": user_id, "org_id": org_id})
        yield Conn()

    monkeypatch.setattr(wd, "acting_member_connection", fake_acting)
    owner, org = uuid4(), uuid4()
    got = await wd.visible_item_ids(owner_id=owner, org_id=org, table=table, ids=ids)
    assert got == {ids[0]}
    assert len(opened) == 1 and opened[0]["user_id"] == str(owner) and opened[0]["org_id"] == str(org)
    assert opened[0]["sql"].startswith(f"SELECT id FROM public.{table} WHERE id = ANY($1::uuid[])")
    assert opened[0]["arg"] == ids


async def test_visibility_refuses_any_other_table():
    with pytest.raises(ValueError):
        await wd.visible_item_ids(owner_id=uuid4(), org_id=uuid4(), table="threads", ids=[uuid4()])


# ── tick, purge, loop (D-10, D-44) ────────────────────────────────────────────────────────


async def test_tick_fans_out_then_sends_then_purges_hourly(monkeypatch):
    t = {"now": 0.0}
    fake = FakeOutbox().install(monkeypatch)
    d = _drainer(fake, clock=lambda: t["now"])
    await d.tick(now=NOW)
    names = [c[0] for c in fake.calls]
    assert names.index("claim_next_event") < names.index("claim_due_deliveries") < names.index("purge_old_events")
    assert fake.named("purge_old_events") == [{"older_than_days": 30}]
    assert len(fake.named("erase_expired_previous_secrets")) == 1
    t["now"] = 10.0
    await d.tick(now=NOW)
    assert len(fake.named("purge_old_events")) == 1, "the purge runs at most hourly"
    t["now"] = 3601.0
    await d.tick(now=NOW)
    assert len(fake.named("purge_old_events")) == 2
    assert d.ticks == 3


async def test_a_failed_fan_out_never_blocks_the_send_pass(monkeypatch):
    fake = FakeOutbox().install(monkeypatch)

    async def broken(con, *, now=None):
        raise RuntimeError("fan-out broke")

    monkeypatch.setattr(outbox, "claim_next_event", broken)
    await _drainer(fake).tick(now=NOW)
    assert fake.named("claim_due_deliveries")


async def test_start_and_stop_never_wait_out_a_poll(monkeypatch):
    FakeOutbox().install(monkeypatch)
    d = _drainer(FakeOutbox().install(monkeypatch), poll_interval_seconds=3600)
    d.start()
    d.start()  # idempotent
    await asyncio.sleep(0.05)
    await asyncio.wait_for(d.stop(), timeout=2)
    assert d._task is None


# ── logs (T-308-13) ───────────────────────────────────────────────────────────────────────


async def test_a_full_tick_logs_no_url_path_query_secret_or_payload(monkeypatch, caplog):
    caplog.set_level(logging.DEBUG)
    ev = _event()
    eps = [_ep(ev["owner_id"], ev["org_id"])]
    rows = [
        _row(), _row(enabled=False), _row(attempts=6), _row(payload=None),
        _row(previous_secret_ciphertext=secret_cipher.encrypt_secret(PREVIOUS, CIPHER),
             previous_secret_expires_at=NOW + timedelta(hours=1)),
    ]
    won = {"id": uuid4(), "user_id": uuid4(), "org_id": uuid4(), "url": URL}
    fake = FakeOutbox(events=[ev], candidates={ev["id"]: eps}, claimed=rows, register=won).install(monkeypatch)
    send = CountingSend(_ok(), _fail(503), _fail(400, retryable=False), _fail(410, "gone", retryable=False, gone=True))
    await _drainer(fake, send=send, liveness=Recorder(True)).tick(now=NOW)
    assert caplog.records, "non-vacuity: the tick logged"
    text = "\n".join(r.getMessage() + " " + repr(r.args) for r in caplog.records)
    for leak in ("hooks.example.com/in", "tok_SECRETPATH", "QUERYTOKEN", CURRENT, PREVIOUS, PAYLOAD, "whsec_"):
        assert leak not in text, f"a log record carries {leak!r}"
