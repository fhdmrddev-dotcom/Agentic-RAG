"""Phase 300-04 (D-09 / D-13 / D-20 / D-31 / NOTE-02 / NOTE-04) — the outbox sends ONCE, LIVE.

Two ``NotificationDrainer`` instances race over one due delivery on the REAL local Postgres and a
counting fake ``send``: exactly one send. Then the re-checks: an answered question sends nothing,
an opted-out owner sends nothing (the notice stays), a sent delivery is never sent again, a retry
resends the frozen payload under the same key, and a crash mid-send is re-sent on Resend only.

⚠ THESE ROWS ARE COMMITTED — two drainers on two connections must both see them, which a single
rolled-back transaction cannot give. Every row is created with an id this file knows and deleted
in ``finally``; run under the local-DB lock. The notice and its delivery are written by migration
218's own trigger from a real harness prompt row, never inserted by hand.

⚠ ISOLATION FROM THE DEV OUTBOX: every tick here is pinned to a time in the year 2000, and this
file moves its own deliveries' ``due_at`` (and stale ``claimed_at``) into 1999-2000. A real row is
due at ``created_at + delay`` (2026+) and claimed at a real ``now()``, so a pinned tick can never
claim or reclaim a row this file did not create. Skip-guarded on :54322 and on 218; run ``-rs``.
"""
from __future__ import annotations

import json
import threading
from contextlib import asynccontextmanager
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

import pytest

from app.services import notification_drainer as drainer_mod
from app.services.email_provider import OutboundEmail, SendOutcome
from app.services.notification_drainer import NotificationDrainer
from tests.integration._rls_harness import PG_TEST_DSN, requires_pg
from tests.integration.test_300_notice_triggers_live import requires_218

pytestmark = [requires_pg, requires_218]

T0 = datetime(2000, 1, 1, 0, 0, tzinfo=timezone.utc)
NOW = T0 + timedelta(minutes=1)


class CountingSend:
    def __init__(self, *outcomes: SendOutcome) -> None:
        self.outcomes = list(outcomes) or [SendOutcome("sent", provider="resend", provider_id="re_live")]
        self.calls: list[tuple[OutboundEmail, str | None]] = []
        self._lock = threading.Lock()

    def __call__(self, msg: OutboundEmail, *, idempotency_key: str | None = None) -> SendOutcome:
        with self._lock:
            self.calls.append((msg, idempotency_key))
            return self.outcomes[min(len(self.calls) - 1, len(self.outcomes) - 1)]


@dataclass
class World:
    pool: object
    owner: UUID
    org: UUID
    thread: UUID
    definition: UUID
    run: UUID
    notice: UUID
    delivery: UUID
    tool_call_id: str
    created_orgs: list = field(default_factory=list)


async def _prompt(con, w_thread, owner, org, run_id, tcid: str) -> None:
    tool_call = {
        "kind": "ask_user_prompt", "tool_call_id": tcid, "prompt": "Which client is this for?",
        "options": [], "timeout_seconds": None, "run_id": str(run_id),
    }
    await con.execute(
        "INSERT INTO public.messages (thread_id, user_id, role, content, origin, org_id, tool_calls)"
        " VALUES ($1, $2, 'system', $3, 'harness', $4, $5::jsonb)",
        w_thread, owner, tool_call["prompt"], org, json.dumps([tool_call]),
    )


async def _answer(con, w: World) -> None:
    tool_call = {"kind": "ask_user_response", "tool_call_id": w.tool_call_id, "response_text": "Acme",
                 "choice_index": None, "folder_id": None}
    await con.execute(
        "INSERT INTO public.messages (thread_id, user_id, role, content, origin, org_id, tool_calls)"
        " VALUES ($1, $2, 'system', 'Acme', 'harness', $3, $4::jsonb)",
        w.thread, w.owner, w.org, json.dumps([tool_call]),
    )


@asynccontextmanager
async def _world(*, opted_out: bool = False):
    """Commit one owner / org / thread / definition / active run / harness prompt; delete it all."""
    import asyncpg

    pool = await asyncpg.create_pool(PG_TEST_DSN, min_size=2, max_size=4)
    owner = uuid4()
    org = thread = definition = run = None
    created_orgs: list[UUID] = []
    try:
        async with pool.acquire() as con:
            await con.execute(
                "INSERT INTO auth.users (id, email) VALUES ($1, $2)", owner, f"300-04-{owner}@test.local"
            )
            # handle_new_user provisions a personal org; remember it so finally removes it too.
            created_orgs += [r["org_id"] for r in await con.fetch(
                "SELECT org_id FROM public.org_members WHERE user_id = $1", owner)]
            org = await con.fetchval(
                "INSERT INTO public.organizations (name) VALUES ($1) RETURNING id", f"300-04 Org {owner.hex[:6]}"
            )
            created_orgs.append(org)
            await con.execute(
                "INSERT INTO public.org_members (org_id, user_id, role) VALUES ($1, $2, 'member')"
                " ON CONFLICT DO NOTHING", org, owner,
            )
            if opted_out:
                await con.execute(
                    "INSERT INTO public.user_settings (user_id, org_id, preferences) VALUES ($1, $2, $3::jsonb)",
                    owner, org, json.dumps({"notification_email_enabled": False}),
                )
            thread = await con.fetchval(
                "INSERT INTO public.threads (user_id, org_id, title) VALUES ($1, $2, '300-04 thread') RETURNING id",
                owner, org,
            )
            definition = await con.fetchval(
                "INSERT INTO public.workflow_definitions (slug, name, created_by, org_id, status)"
                " VALUES ($1, 'Compliance Gap Report', $2, $3, 'published') RETURNING id",
                f"300-04-{owner.hex[:8]}", owner, org,
            )
            run = await con.fetchval(
                "INSERT INTO public.workflow_runs (thread_id, definition_id, status, org_id, user_id, inputs)"
                " VALUES ($1, $2, 'active', $3, $4, '{}'::jsonb) RETURNING id",
                thread, definition, org, owner,
            )
            tcid = f"tc-300-04-{uuid4().hex[:8]}"
            await _prompt(con, thread, owner, org, run, tcid)
            notice = await con.fetchval("SELECT id FROM public.notifications WHERE run_id = $1", run)
            assert notice is not None, "non-vacuity: migration 218's trigger must have written the notice"
            # Pin this file's rows into 2000 so a pinned tick sees them and nothing else.
            await con.execute(
                "UPDATE public.notifications SET created_at = $2 WHERE id = $1", notice, T0 - timedelta(minutes=2)
            )
            delivery = await con.fetchval(
                "UPDATE public.notification_deliveries SET due_at = $2 WHERE notification_id = $1 RETURNING id",
                notice, T0,
            )
            assert delivery is not None, "non-vacuity: the trigger must have queued one delivery"
        yield World(pool, owner, org, thread, definition, run, notice, delivery, tcid, created_orgs)
    finally:
        async with pool.acquire() as con:
            if run is not None:
                await con.execute("DELETE FROM public.workflow_runs WHERE id = $1", run)
            if thread is not None:
                await con.execute("DELETE FROM public.threads WHERE id = $1", thread)
            if definition is not None:
                await con.execute("DELETE FROM public.workflow_definitions WHERE id = $1", definition)
            await con.execute("DELETE FROM public.user_settings WHERE user_id = $1", owner)
            await con.execute("DELETE FROM auth.users WHERE id = $1", owner)
            for o in created_orgs:
                await con.execute("DELETE FROM public.organizations WHERE id = $1", o)
            leftover = await con.fetchval(
                "SELECT (SELECT count(*) FROM auth.users WHERE id = $1)"
                " + (SELECT count(*) FROM public.notifications WHERE recipient_id = $1)"
                " + (SELECT count(*) FROM public.organizations WHERE id = ANY($2::uuid[]))"
                " + (SELECT count(*) FROM public.workflow_definitions WHERE created_by = $1)"
                " + (SELECT count(*) FROM public.threads WHERE user_id = $1)"
                " + (SELECT count(*) FROM public.workflow_runs WHERE user_id = $1)",
                owner, created_orgs,
            )
        await pool.close()
        assert leftover == 0, "the live fixture left committed rows behind"


async def _delivery(w: World):
    return await w.pool.fetchrow(
        "SELECT status, attempts, subject, text_body, html_body, waited_seconds, provider,"
        " provider_message_id, reason, sent_at, claimed_at FROM public.notification_deliveries WHERE id = $1",
        w.delivery,
    )


@pytest.fixture(autouse=True)
def _resend_is_configured(monkeypatch):
    monkeypatch.setattr(drainer_mod, "configured_provider", lambda: "resend")


async def test_two_drainers_over_one_due_row_send_exactly_once():
    async with _world() as w:
        before = await _delivery(w)
        assert before["status"] == "pending" and before["attempts"] == 0, "non-vacuity: one due row"
        send = CountingSend()
        a = NotificationDrainer(w.pool, send=send)
        b = NotificationDrainer(w.pool, send=send)

        import asyncio

        await asyncio.gather(a.tick(now=NOW), b.tick(now=NOW))

        assert len(send.calls) == 1, f"two drainers sent {len(send.calls)} times"
        msg, key = send.calls[0]
        assert key == f"run-waiting/{w.delivery}"
        assert msg.to == f"300-04-{w.owner}@test.local"
        after = await _delivery(w)
        assert after["status"] == "sent" and after["attempts"] == 1
        assert after["sent_at"] is not None and after["provider_message_id"] == "re_live"
        assert after["provider"] == "resend"
        # frozen once, from the five facts (D-31, NOTE-03)
        assert after["subject"] == "Compliance Gap Report is waiting on you" == msg.subject
        assert after["text_body"] == msg.text and after["html_body"] == msg.html
        assert after["waited_seconds"] == 180 and "3 minutes" in msg.text
        assert "Which client is this for?" not in msg.text + msg.html, "NOTE-03: prompt text leaked"
        assert a.sent + b.sent == 1

        # a later tick after 'sent' sends nothing
        await a.tick(now=NOW + timedelta(hours=1))
        assert len(send.calls) == 1


async def test_a_question_answered_before_due_is_skipped_answered_and_sends_nothing():
    async with _world() as w:
        async with w.pool.acquire() as con:
            await _answer(con, w)
        send = CountingSend()
        await NotificationDrainer(w.pool, send=send).tick(now=NOW)
        assert send.calls == []
        row = await _delivery(w)
        # answering closes the notice; the delivery is still claimed once and recorded skipped
        assert row["status"] == "skipped_answered", row


async def test_a_still_open_notice_whose_prompt_was_answered_is_skipped():
    """The EXISTS half alone: the notice is open, but no unanswered prompt remains for the run."""
    async with _world() as w:
        async with w.pool.acquire() as con:
            await _answer(con, w)
            await con.execute("UPDATE public.notifications SET closed_at = NULL, closed_reason = NULL WHERE id = $1",
                              w.notice)
        send = CountingSend()
        await NotificationDrainer(w.pool, send=send).tick(now=NOW)
        assert send.calls == []
        assert (await _delivery(w))["status"] == "skipped_answered"


async def test_an_owner_who_left_the_org_is_not_emailed():
    """v4.8 audit W-1: the list hides a notice once its owner leaves the org (LIST_OPEN_SQL's
    org_members join), and the run link then reads "can't be opened" (link_resolver's membership
    arm). The email must agree: no send to someone who can no longer open the run."""
    async with _world() as w:
        async with w.pool.acquire() as con:
            await con.execute("DELETE FROM public.org_members WHERE org_id = $1 AND user_id = $2", w.org, w.owner)
        send = CountingSend()
        await NotificationDrainer(w.pool, send=send).tick(now=NOW)
        assert send.calls == [], "an ex-member was emailed a link they cannot open"
        assert (await _delivery(w))["status"] == "skipped_answered"


async def test_an_opted_out_owner_is_skipped_and_the_notice_stays():
    async with _world(opted_out=True) as w:
        send = CountingSend()
        await NotificationDrainer(w.pool, send=send).tick(now=NOW)
        assert send.calls == []
        assert (await _delivery(w))["status"] == "skipped_opted_out"
        notice = await w.pool.fetchrow(
            "SELECT closed_at, closed_reason FROM public.notifications WHERE id = $1", w.notice
        )
        assert notice is not None and notice["closed_at"] is None, "NOTE-04: the notice is still recorded"


async def test_a_retry_resends_the_frozen_payload_under_the_same_key():
    async with _world() as w:
        send = CountingSend(
            SendOutcome("failed", reason="Resend is busy.", provider="resend", retryable=True),
            SendOutcome("sent", provider="resend", provider_id="re_second"),
        )
        d = NotificationDrainer(w.pool, send=send)
        await d.tick(now=NOW)
        mid = await _delivery(w)
        assert mid["status"] == "retry" and mid["attempts"] == 1 and mid["reason"] == "Resend is busy."

        # the frozen payload must survive even if the facts it was rendered from change
        # (a published definition is immutable, so the org's name is the fact that moves)
        await w.pool.execute("UPDATE public.organizations SET name = 'Renamed Org' WHERE id = $1", w.org)
        await d.tick(now=NOW + timedelta(minutes=2))

        assert len(send.calls) == 2
        assert send.calls[0] == send.calls[1], "a retry must send byte-identical mail under the same key"
        done = await _delivery(w)
        assert done["status"] == "sent" and done["attempts"] == 2
        assert done["subject"] == "Compliance Gap Report is waiting on you"


@pytest.mark.parametrize("row_provider, configured, expected", [
    ("resend", "resend", "sent"),
    ("smtp", "smtp", "failed"),
    ("none", "none", "failed"),
])
async def test_a_crash_mid_send_is_resent_only_on_resend(monkeypatch, row_provider, configured, expected):
    monkeypatch.setattr(drainer_mod, "configured_provider", lambda: configured)
    async with _world() as w:
        # First claim freezes the payload, then the worker "dies" before recording anything.
        send = CountingSend()
        d = NotificationDrainer(w.pool, send=send)
        from app.db import notifications as db

        claimed = await db.claim_due_deliveries(w.pool, limit=5, render=drainer_mod.render_delivery,
                                                now=NOW, provider=row_provider)
        assert [c.id for c in claimed] == [w.delivery]
        await w.pool.execute(
            "UPDATE public.notification_deliveries SET claimed_at = $2 WHERE id = $1",
            w.delivery, NOW - timedelta(hours=1),
        )
        frozen = await _delivery(w)
        assert frozen["status"] == "sending"

        await d.tick(now=NOW)

        row = await _delivery(w)
        assert row["status"] == expected, row
        if expected == "sent":
            (msg, key), = send.calls
            assert key == f"run-waiting/{w.delivery}"
            assert msg.subject == frozen["subject"] and msg.html == frozen["html_body"]
            assert row["attempts"] == 2
        else:
            assert send.calls == [], "SMTP / none are at-most-once: never re-sent after a crash"
            assert row["reason"] == "Interrupted while sending; not retried to avoid a duplicate."


@pytest.mark.parametrize("provider", ["smtp", "resend"])
async def test_a_row_reclaimed_while_queued_in_a_slow_batch_is_never_sent_by_its_first_worker(
    monkeypatch, provider
):
    """300-REVIEW WR-03, live. Worker A claims a row; while it is still QUEUED behind slow sends,
    its lease passes and worker B reclaims it (SMTP: 'failed'; Resend: 'retry', then B claims it
    again). When A reaches the row it must send nothing and record nothing over B's outcome."""
    monkeypatch.setattr(drainer_mod, "configured_provider", lambda: provider)
    from app.db import notifications as db

    async with _world() as w:
        a_send = CountingSend()
        a = NotificationDrainer(w.pool, send=a_send)
        (a_row,) = await db.claim_due_deliveries(
            w.pool, limit=5, render=drainer_mod.render_delivery, now=NOW, provider=provider
        )
        assert a_row.id == w.delivery and a_row.attempts == 1
        # A's batch is slow: this row's shared claimed_at is past the lease when B ticks.
        await w.pool.execute(
            "UPDATE public.notification_deliveries SET claimed_at = $2 WHERE id = $1",
            w.delivery, NOW - timedelta(hours=1),
        )
        b_send = CountingSend()
        b = NotificationDrainer(w.pool, send=b_send)
        await b.tick(now=NOW)
        after_b = await _delivery(w)
        if provider == "smtp":
            assert after_b["status"] == "failed" and b_send.calls == []
        else:
            assert after_b["status"] == "sent" and after_b["attempts"] == 2 and len(b_send.calls) == 1

        # A finally reaches the row it claimed earlier.
        sent = await a._process(a_row, now=NOW)

        assert sent is False
        assert a_send.calls == [], "WR-03: the first worker sent a row it no longer owned"
        final = await _delivery(w)
        assert final["status"] == after_b["status"] and final["attempts"] == after_b["attempts"]
        assert final["reason"] == after_b["reason"]


async def test_renewing_the_lease_keeps_a_queued_row_from_being_reclaimed():
    """WR-03: the row whose send starts is re-stamped, so another worker's reclaim skips it."""
    from app.db import notifications as db

    async with _world() as w:
        (row,) = await db.claim_due_deliveries(
            w.pool, limit=5, render=drainer_mod.render_delivery, now=NOW, provider="smtp"
        )
        await w.pool.execute(
            "UPDATE public.notification_deliveries SET claimed_at = $2 WHERE id = $1",
            w.delivery, NOW - timedelta(hours=1),
        )
        assert await db.renew_delivery_lease(w.pool, row) is True
        # A reclaim pinned to the claim's era sees a lease stamped at a real now(): not stale.
        await db.reclaim_stale_sending(w.pool, lease_seconds=600, provider="smtp", now=NOW)
        assert (await _delivery(w))["status"] == "sending"


async def test_a_resend_row_re_claimed_elsewhere_is_not_sent_by_its_first_worker_too(monkeypatch):
    """WR-03, the attempts half: B reclaimed AND re-claimed the row, so it is 'sending' again (one
    attempt later) while B's send is in flight. A's renew must not match it: no concurrent send."""
    monkeypatch.setattr(drainer_mod, "configured_provider", lambda: "resend")
    from app.db import notifications as db

    async with _world() as w:
        (a_row,) = await db.claim_due_deliveries(
            w.pool, limit=5, render=drainer_mod.render_delivery, now=NOW, provider="resend"
        )
        await w.pool.execute(
            "UPDATE public.notification_deliveries SET claimed_at = $2 WHERE id = $1",
            w.delivery, NOW - timedelta(hours=1),
        )
        assert await db.reclaim_stale_sending(w.pool, lease_seconds=600, provider="resend", now=NOW) == 1
        (b_row,) = await db.claim_due_deliveries(
            w.pool, limit=5, render=drainer_mod.render_delivery, now=NOW, provider="resend"
        )
        assert b_row.attempts == 2 and (await _delivery(w))["status"] == "sending"

        a_send = CountingSend()
        assert await NotificationDrainer(w.pool, send=a_send)._process(a_row, now=NOW) is False
        assert a_send.calls == [], "WR-03: two workers would POST the same delivery at once"
        row = await _delivery(w)
        assert row["status"] == "sending" and row["attempts"] == 2
