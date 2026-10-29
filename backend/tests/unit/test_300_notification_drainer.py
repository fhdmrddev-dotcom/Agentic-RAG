"""Phase 300-04 (D-09 / D-12 / D-13 / D-20 / D-31 / NOTE-03) — the run-waiting outbox drainer, unit.

Every database function is faked here; the exactly-once property itself is driven against the
REAL local Postgres in ``tests/integration/test_300_drainer_once_live.py``. What this file pins:

* the outcome mapping (sent / suppressed / retry with backoff / failed) and the 3-attempt bound;
* the re-checks that run before EVERY send, retries included (still waiting, then the opt-out);
* the frozen payload and the one idempotency key a retry reuses;
* that the claim renders an unrendered row ONCE, inside the claiming transaction, and never
  re-renders a row that already carries a subject;
* that one bad row never stops the batch and a failed tick never ends the loop;
* that no SQL the drainer runs reads prompt text or the message body (NOTE-03).
"""
from __future__ import annotations

import asyncio
import re
import threading
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest

from app.db import notifications as db
from app.services import notification_drainer as drainer_mod
from app.services.email_provider import OutboundEmail, SendOutcome
from app.services.notification_drainer import NotificationDrainer

PINNED = datetime(2030, 1, 1, 12, 0, tzinfo=timezone.utc)


def _claimed(*, attempts: int = 1, subject: str = "Gap Report is waiting on you") -> db.ClaimedDelivery:
    return db.ClaimedDelivery(
        id=uuid4(),
        notification_id=uuid4(),
        recipient_id=uuid4(),
        run_id=uuid4(),
        kind="question",
        attempts=attempts,
        subject=subject,
        text_body="plain body",
        html_body="<p>html body</p>",
    )


class Recorder:
    """A counting fake ``send`` — thread-safe, because the drainer calls it in a threadpool."""

    def __init__(self, *outcomes: SendOutcome) -> None:
        self._outcomes = list(outcomes) or [SendOutcome("sent", provider="resend", provider_id="re_1")]
        self.calls: list[tuple[OutboundEmail, str | None]] = []
        self._lock = threading.Lock()

    def __call__(self, msg: OutboundEmail, *, idempotency_key: str | None = None) -> SendOutcome:
        with self._lock:
            self.calls.append((msg, idempotency_key))
            index = min(len(self.calls) - 1, len(self._outcomes) - 1)
            return self._outcomes[index]


@pytest.fixture
def fake_db(monkeypatch):
    """Patch every db.notifications function the drainer calls; return the knobs and the log."""
    state = {
        "claims": [],          # list[list[ClaimedDelivery]] — one batch per tick
        "waiting": True,
        "opted_in": True,
        "email": "owner@example.com",
        "outcomes": [],        # recorded record_delivery_outcome calls
        "reclaims": [],
        "raise_for": set(),    # delivery ids whose still_waiting raises
        "claim_kwargs": [],
        "lease_lost": set(),   # delivery ids another worker reclaimed (WR-03)
        "renewed": [],         # renew_delivery_lease calls, in order
        "events": [],          # ordering log: ("renew", id) / ("send", id)
    }

    async def claim_due_deliveries(pool, *, limit, render, now=None, provider="none"):
        state["claim_kwargs"].append({"limit": limit, "render": render, "now": now, "provider": provider})
        return state["claims"].pop(0) if state["claims"] else []

    async def reclaim_stale_sending(pool, *, lease_seconds=600, provider, now=None):
        state["reclaims"].append({"lease_seconds": lease_seconds, "provider": provider, "now": now})
        return 0

    async def still_waiting(pool, notification_id):
        if notification_id in state["raise_for"]:
            raise RuntimeError("boom")
        return state["waiting"]

    async def email_opted_in(pool, user_id):
        return state["opted_in"]

    async def recipient_email(pool, user_id):
        return state["email"]

    async def record_delivery_outcome(pool, delivery_id, **kwargs):
        state["outcomes"].append({"id": delivery_id, **kwargs})

    async def renew_delivery_lease(pool, delivery):
        state["renewed"].append(delivery.id)
        state["events"].append(("renew", delivery.id))
        return delivery.id not in state["lease_lost"]

    for name, fn in {
        "claim_due_deliveries": claim_due_deliveries,
        "reclaim_stale_sending": reclaim_stale_sending,
        "still_waiting": still_waiting,
        "email_opted_in": email_opted_in,
        "recipient_email": recipient_email,
        "record_delivery_outcome": record_delivery_outcome,
        "renew_delivery_lease": renew_delivery_lease,
    }.items():
        monkeypatch.setattr(db, name, fn)
    monkeypatch.setattr(drainer_mod, "configured_provider", lambda: "resend")
    return state


def _drainer(send) -> NotificationDrainer:
    return NotificationDrainer(object(), send=send, poll_interval_seconds=0.05)


# ── the outcome mapping (D-12) ───────────────────────────────────────────────────


async def test_a_sent_send_records_sent_with_the_provider_message_id(fake_db):
    row = _claimed()
    fake_db["claims"].append([row])
    send = Recorder(SendOutcome("sent", provider="resend", provider_id="re_abc"))
    d = _drainer(send)

    await d.tick(now=PINNED)

    assert len(send.calls) == 1
    msg, key = send.calls[0]
    assert key == f"run-waiting/{row.id}"
    assert msg == OutboundEmail(to="owner@example.com", subject=row.subject, text=row.text_body,
                                html=row.html_body)
    assert fake_db["outcomes"] == [{
        "id": row.id, "status": "sent", "reason": None, "provider": "resend",
        "provider_message_id": "re_abc", "retry_due_at": None,
    }]
    assert d.sent == 1


async def test_a_suppressed_send_records_suppressed_with_its_reason(fake_db):
    row = _claimed()
    fake_db["claims"].append([row])
    send = Recorder(SendOutcome("suppressed", reason="Email is not set up on this server.", provider="none"))

    await _drainer(send).tick(now=PINNED)

    (out,) = fake_db["outcomes"]
    assert out["status"] == "suppressed"
    assert out["reason"] == "Email is not set up on this server."


@pytest.mark.parametrize("attempts, backoff", [(1, 60), (2, 300)])
async def test_a_retryable_failure_under_three_attempts_is_retried_with_backoff(fake_db, attempts, backoff):
    row = _claimed(attempts=attempts)
    fake_db["claims"].append([row])
    send = Recorder(SendOutcome("failed", reason="Resend is busy.", provider="resend", retryable=True))

    await _drainer(send).tick(now=PINNED)

    (out,) = fake_db["outcomes"]
    assert out["status"] == "retry"
    assert out["reason"] == "Resend is busy."
    assert out["retry_due_at"] == PINNED + timedelta(seconds=backoff)


async def test_a_retryable_failure_on_the_third_attempt_is_failed(fake_db):
    row = _claimed(attempts=3)
    fake_db["claims"].append([row])
    send = Recorder(SendOutcome("failed", reason="Resend is busy.", provider="resend", retryable=True))
    d = _drainer(send)

    await d.tick(now=PINNED)

    (out,) = fake_db["outcomes"]
    assert out["status"] == "failed" and out["reason"] == "Resend is busy."
    assert out["retry_due_at"] is None
    assert d.failed == 1


async def test_a_non_retryable_failure_is_failed_at_once(fake_db):
    row = _claimed(attempts=1)
    fake_db["claims"].append([row])
    send = Recorder(SendOutcome("failed", reason="The API key was refused.", provider="resend", retryable=False))

    await _drainer(send).tick(now=PINNED)

    (out,) = fake_db["outcomes"]
    assert out["status"] == "failed" and out["reason"] == "The API key was refused."


# ── the re-checks before each send (D-13, D-09) ──────────────────────────────────


async def test_a_run_no_longer_waiting_is_skipped_answered_and_nothing_is_sent(fake_db):
    fake_db["claims"].append([_claimed()])
    fake_db["waiting"] = False
    send = Recorder()
    d = _drainer(send)

    await d.tick(now=PINNED)

    assert send.calls == []
    (out,) = fake_db["outcomes"]
    assert out["status"] == "skipped_answered"
    assert d.skipped == 1


async def test_an_opted_out_owner_is_skipped_opted_out_and_nothing_is_sent(fake_db):
    fake_db["claims"].append([_claimed()])
    fake_db["opted_in"] = False
    send = Recorder()

    await _drainer(send).tick(now=PINNED)

    assert send.calls == []
    (out,) = fake_db["outcomes"]
    assert out["status"] == "skipped_opted_out"


async def test_no_address_on_record_is_failed_with_words(fake_db):
    fake_db["claims"].append([_claimed()])
    fake_db["email"] = None
    send = Recorder()

    await _drainer(send).tick(now=PINNED)

    assert send.calls == []
    (out,) = fake_db["outcomes"]
    assert out["status"] == "failed" and out["reason"] == "No email address on record."


async def test_a_retry_re_checks_and_resends_the_identical_frozen_payload_under_the_same_key(fake_db):
    first = _claimed(attempts=1)
    # the retry claim returns the SAME frozen payload (the claim never re-renders a subject)
    second = db.ClaimedDelivery(**{**first.__dict__, "attempts": 2})
    fake_db["claims"].extend([[first], [second]])
    send = Recorder(
        SendOutcome("failed", reason="Resend is busy.", provider="resend", retryable=True),
        SendOutcome("sent", provider="resend", provider_id="re_2"),
    )
    d = _drainer(send)

    await d.tick(now=PINNED)
    await d.tick(now=PINNED + timedelta(seconds=61))

    assert len(send.calls) == 2
    assert send.calls[0] == send.calls[1], "a retry must send the byte-identical payload and key"
    assert send.calls[0][1] == f"run-waiting/{first.id}"
    assert [o["status"] for o in fake_db["outcomes"]] == ["retry", "sent"]


async def test_a_retry_whose_run_was_answered_meanwhile_sends_nothing(fake_db):
    first = _claimed(attempts=1)
    fake_db["claims"].extend([[first], [db.ClaimedDelivery(**{**first.__dict__, "attempts": 2})]])
    send = Recorder(SendOutcome("failed", reason="Resend is busy.", provider="resend", retryable=True))
    d = _drainer(send)

    await d.tick(now=PINNED)
    fake_db["waiting"] = False
    await d.tick(now=PINNED + timedelta(seconds=61))

    assert len(send.calls) == 1
    assert [o["status"] for o in fake_db["outcomes"]] == ["retry", "skipped_answered"]


# ── isolation and the loop (D-20) ────────────────────────────────────────────────


# ── WR-03: the lease is stamped when each row's send STARTS ──────────────────────


async def test_a_row_reclaimed_by_another_worker_mid_batch_is_never_sent(fake_db):
    """300-REVIEW WR-03: a batch claims 20 rows under one claimed_at and sends them one at a time.
    On a slow relay the lease of a row still QUEUED can expire, and another worker reclaims it
    (SMTP: 'failed', Resend: 'retry' and a second claim). The first worker must then not send it
    and must not record over the other worker's outcome."""
    first, lost, last = _claimed(), _claimed(), _claimed()
    fake_db["claims"].append([first, lost, last])
    fake_db["lease_lost"].add(lost.id)
    send = Recorder()
    d = _drainer(send)

    sent = await d.tick(now=PINNED)

    assert sent == 2
    assert [key for _, key in send.calls] == [f"run-waiting/{first.id}", f"run-waiting/{last.id}"]
    assert [o["id"] for o in fake_db["outcomes"]] == [first.id, last.id]
    assert fake_db["renewed"] == [first.id, lost.id, last.id]


async def test_the_lease_is_renewed_after_the_re_checks_and_just_before_the_send(fake_db):
    row = _claimed()
    fake_db["claims"].append([row])

    def send(msg, *, idempotency_key=None):
        fake_db["events"].append(("send", row.id))
        return SendOutcome("sent", provider="resend", provider_id="re_1")

    await _drainer(send).tick(now=PINNED)
    assert fake_db["events"] == [("renew", row.id), ("send", row.id)]


async def test_a_skipped_row_renews_no_lease(fake_db):
    row = _claimed()
    fake_db["claims"].append([row])
    fake_db["waiting"] = False
    await _drainer(Recorder()).tick(now=PINNED)
    assert fake_db["renewed"] == []


async def test_one_row_raising_never_stops_the_rest_of_the_batch(fake_db):
    bad, good = _claimed(), _claimed()
    fake_db["claims"].append([bad, good])
    fake_db["raise_for"].add(bad.notification_id)
    send = Recorder()

    await _drainer(send).tick(now=PINNED)

    assert len(send.calls) == 1 and send.calls[0][1] == f"run-waiting/{good.id}"
    statuses = {o["id"]: o["status"] for o in fake_db["outcomes"]}
    assert statuses[good.id] == "sent"
    # the bad row was never sent, so it may be tried again — never left 'sending' with no word
    assert statuses[bad.id] == "retry"


async def test_tick_reclaims_stale_rows_first_with_the_configured_provider(fake_db):
    await _drainer(Recorder()).tick(now=PINNED)
    assert fake_db["reclaims"] == [{"lease_seconds": 600, "provider": "resend", "now": PINNED}]
    (kw,) = fake_db["claim_kwargs"]
    assert kw["provider"] == "resend" and kw["now"] == PINNED and kw["limit"] == 20


async def test_a_failed_tick_never_ends_the_loop_and_stop_returns_promptly(monkeypatch):
    calls = {"n": 0}

    async def exploding_tick(self, *, now=None):
        calls["n"] += 1
        raise RuntimeError("tick boom")

    monkeypatch.setattr(NotificationDrainer, "tick", exploding_tick)
    d = NotificationDrainer(object(), send=Recorder(), poll_interval_seconds=0.02)
    d.start()
    d.start()  # idempotent
    await asyncio.sleep(0.15)
    started = asyncio.get_running_loop().time()
    await d.stop()
    assert asyncio.get_running_loop().time() - started < 0.5
    assert calls["n"] >= 2, "a raising tick must not end the loop"
    await d.stop()  # idempotent


# ── the render callback wraps the 300-03 renderer ────────────────────────────────


def test_the_render_callback_uses_only_the_five_allowed_facts():
    run_id = uuid4()
    rendered = drainer_mod.render_delivery({
        "workflow_name": "Gap Report", "org_name": "Acme", "waited_seconds": 185,
        "run_id": run_id, "kind": "approval",
    })
    assert rendered.subject == "Gap Report is waiting on you"
    assert f"/app/runs/{run_id}" in rendered.text
    assert "3 minutes" in rendered.text


# ── the claim: render once, inside the transaction (D-31) ────────────────────────


class _Tx:
    def __init__(self, con):
        self.con = con

    async def __aenter__(self):
        self.con.log.append("BEGIN")

    async def __aexit__(self, *exc):
        self.con.log.append("COMMIT")
        return False


class _FakeCon:
    def __init__(self, rows):
        self.rows = rows
        self.log: list = []

    def transaction(self):
        return _Tx(self)

    async def fetch(self, sql, *args):
        self.log.append(("fetch", sql, args))
        return self.rows

    async def fetchrow(self, sql, *args):
        self.log.append(("fetchrow", sql, args))
        row = next(r for r in self.rows if r["id"] == args[0])
        return {
            "attempts": row["attempts"] + 1,
            "subject": row["subject"] if row["subject"] is not None else args[2],
            "text_body": row["text_body"] if row["text_body"] is not None else args[3],
            "html_body": row["html_body"] if row["html_body"] is not None else args[4],
        }


class _Acquire:
    def __init__(self, con):
        self.con = con

    async def __aenter__(self):
        return self.con

    async def __aexit__(self, *exc):
        return False


class _FakePool:
    def __init__(self, con):
        self.con = con

    def acquire(self):
        return _Acquire(self.con)


def _due(*, subject=None):
    return {
        "id": uuid4(), "notification_id": uuid4(), "recipient_id": uuid4(), "run_id": uuid4(),
        "kind": "question", "attempts": 0 if subject is None else 1,
        "subject": subject, "text_body": None if subject is None else "t",
        "html_body": None if subject is None else "<p>h</p>",
        "workflow_name": "Gap Report", "org_name": "Acme", "waited_seconds": 150,
    }


async def test_the_claim_renders_an_unrendered_row_once_and_never_re_renders_a_frozen_one():
    fresh, frozen = _due(), _due(subject="Frozen subject")
    con = _FakeCon([fresh, frozen])
    rendered: list = []

    def render(facts):
        rendered.append(facts)
        return drainer_mod.render_delivery(facts)

    claimed = await db.claim_due_deliveries(_FakePool(con), limit=5, render=render, now=PINNED,
                                            provider="resend")

    assert [f["run_id"] for f in rendered] == [fresh["run_id"]], "render runs only for the unrendered row"
    assert set(rendered[0]) == {"workflow_name", "org_name", "waited_seconds", "run_id", "kind"}
    by_id = {c.id: c for c in claimed}
    assert by_id[frozen["id"]].subject == "Frozen subject"
    assert by_id[fresh["id"]].subject == "Gap Report is waiting on you"
    assert by_id[fresh["id"]].attempts == 1 and by_id[frozen["id"]].attempts == 2
    # the select, both updates and nothing else happen between BEGIN and COMMIT
    assert con.log[0] == "BEGIN" and con.log[-1] == "COMMIT"
    assert sum(1 for e in con.log if isinstance(e, tuple) and e[0] == "fetchrow") == 2
    select_sql = con.log[1][1]
    assert "FOR UPDATE OF d SKIP LOCKED" in select_sql
    assert "COALESCE($2::timestamptz, now())" in select_sql


# ── NOTE-03: no SQL the drainer runs reads prompt text or a message body ──────────


_SQL_CONSTANTS = [name for name in dir(db) if name.endswith("_SQL") and isinstance(getattr(db, name), str)]


def test_the_sql_constants_exist_and_are_scanned():
    assert {"CLAIM_SQL", "STILL_WAITING_SQL"} <= set(_SQL_CONSTANTS), _SQL_CONSTANTS


@pytest.mark.parametrize("name", _SQL_CONSTANTS)
def test_no_sql_constant_selects_message_text_or_prompt_keys(name):
    sql = getattr(db, name)
    assert not re.search(r"\bcontent\b", sql, re.IGNORECASE), f"{name} names a content column"
    for key in ("prompt", "question", "options", "response_text"):
        assert f"'{key}'" not in sql and f'"{key}"' not in sql, f"{name} reads the {key!r} JSON key"
    # tool_calls is read only for the two ids that link a prompt to its run and its answer
    for match in re.finditer(r"tool_calls->0->>'([a-z_]+)'", sql):
        assert match.group(1) in {"run_id", "tool_call_id"}, f"{name} reads tool_calls {match.group(1)!r}"


def test_the_still_waiting_read_is_an_exists_and_returns_one_boolean():
    sql = db.STILL_WAITING_SQL
    assert sql.strip().upper().startswith("SELECT EXISTS")
    assert "closed_at IS NULL" in sql
    assert "('active', 'paused')" in sql
    assert "NOT EXISTS" in sql


def test_the_drainer_logs_no_address_subject_or_body():
    """Logs carry delivery ids and outcome words only (T-300-33)."""
    import inspect

    src = inspect.getsource(drainer_mod)
    for call in re.findall(r"logger\.\w+\((.*?)\)\n", src, re.DOTALL):
        for forbidden in ("subject", "text_body", "html_body", ".to", "email"):
            assert forbidden not in call.split(",", 1)[-1], f"a log call names {forbidden!r}: {call!r}"


def test_the_idempotency_key_is_built_once_from_the_delivery_id():
    import inspect

    src = inspect.getsource(drainer_mod)
    assert src.count('idempotency_key=f"run-waiting/') == 1
    assert isinstance(uuid4(), UUID)
