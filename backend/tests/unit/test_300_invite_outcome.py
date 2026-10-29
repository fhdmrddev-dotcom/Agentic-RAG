"""Phase 300-03 (NOTE-06 / D-11) — an invitation says whether its email went, and never fails on it.

Until 300 a delivery failure was only LOGGED (``org.py`` ``except Exception: logger.error``): the
inviter saw "Invitation ready" either way. Now the send and resend responses carry
``email_delivery`` ("sent" | "failed" | "not_configured"), the row stores it (migration 218's
``org_invitations.email_delivery`` / ``email_failed_at`` / ``email_failure``), and the list
returns it. Link-first is unchanged: no outcome — not even a raise, not even a failure to store
the outcome — fails the invite.

Harness: the shipped ``tests/test_167_invitations.py`` seams (``mock_asyncpg_pool`` drives the
user-JWT connection; ``_has_org_permission`` and ``write_audit_entry`` patched), with
``app.api.org.send_invite`` replaced by a stub returning a canned ``SendOutcome``.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone

import pytest

from app.services.email_provider import SendOutcome

ACTIVE_ORG = "11111111-1111-1111-1111-111111111111"
INVITE_ID = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa"
INVITEE = "invitee@example.com"
FUTURE = datetime.now(timezone.utc) + timedelta(days=7)


@pytest.fixture
def wired(monkeypatch, mock_asyncpg_pool):
    monkeypatch.setattr("app.dependencies._pg_pool", mock_asyncpg_pool)

    async def _perm(request, current_user, org_id, permission_key):
        return permission_key == "org:invite"

    async def _audit(**kwargs):
        return None

    monkeypatch.setattr("app.dependencies._has_org_permission", _perm)
    monkeypatch.setattr("app.api.org.write_audit_entry", _audit)
    return mock_asyncpg_pool


def _stub_send(monkeypatch, outcome=None, *, raises=False):
    sent = []

    def _send(to, link, org_name):
        sent.append((to, link, org_name))
        if raises:
            raise RuntimeError("boom")
        return outcome

    monkeypatch.setattr("app.api.org.send_invite", _send)
    return sent


def _seed_send(pool):
    pool.set_fetchrow_results([
        {"role": "org-admin"},
        None,  # no pending invite to refresh → INSERT
        {"id": INVITE_ID, "email": INVITEE, "role": "member", "status": "pending",
         "expires_at": FUTURE},
        {"name": "Acme"},
    ])


def _seed_resend(pool):
    pool.set_fetchrow_results([
        {"role": "org-admin"},
        {"id": INVITE_ID, "email": INVITEE, "role": "member"},
        {"name": "Acme"},
    ])


def _outcome_updates(pool):
    return [(sql, args) for sql, args in pool.calls
            if isinstance(sql, str) and "email_delivery" in sql and sql.lstrip().upper().startswith("UPDATE")]


def _post(client, auth_headers):
    return client.post("/org/invitations", headers={**auth_headers, "X-Org-Id": ACTIVE_ORG},
                       json={"email": INVITEE, "role": "member"})


@pytest.mark.parametrize("outcome, delivery", [
    (SendOutcome("sent", provider="resend", provider_id="x"), "sent"),
    (SendOutcome("failed", reason="Resend refused the email (HTTP 500).", provider="resend",
                 retryable=True), "failed"),
    (SendOutcome("suppressed", reason="Email is not set up on this server."), "not_configured"),
])
def test_send_returns_and_stores_the_delivery(client, auth_headers, wired, monkeypatch,
                                              outcome, delivery):
    _seed_send(wired)
    sent = _stub_send(monkeypatch, outcome)

    res = _post(client, auth_headers)

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["email_delivery"] == delivery
    assert body["invitation"]["id"] == INVITE_ID and "token=" in body["link"]
    assert sent and sent[0][0] == INVITEE and sent[0][2] == "Acme"
    (sql, args), = _outcome_updates(wired)
    assert "org_invitations" in sql and "email_failed_at" in sql and "email_failure" in sql
    assert str(args[0]) == INVITE_ID
    assert args[1] == delivery
    assert args[2] == (outcome.reason if delivery == "failed" else None)


def test_a_raising_sender_is_a_failed_delivery_never_a_500(client, auth_headers, wired,
                                                          monkeypatch, caplog):
    _seed_send(wired)
    _stub_send(monkeypatch, raises=True)

    with caplog.at_level(logging.WARNING):
        res = _post(client, auth_headers)

    assert res.status_code == 200, res.text
    assert res.json()["email_delivery"] == "failed"
    (_, args), = _outcome_updates(wired)
    assert args[1] == "failed" and args[2] == "The email could not be sent."
    # the failure log names the invitation, never the address
    assert INVITE_ID in caplog.text
    assert INVITEE not in caplog.text


def test_a_failure_to_store_the_outcome_never_fails_the_invite(client, auth_headers, wired,
                                                              monkeypatch, caplog):
    _seed_send(wired)
    _stub_send(monkeypatch, SendOutcome("sent", provider="resend"))
    original = wired._conn.execute

    async def _execute(sql, *args):
        if "email_delivery" in sql:
            raise RuntimeError("column does not exist")
        return await original(sql, *args)

    monkeypatch.setattr(wired._conn, "execute", _execute)

    with caplog.at_level(logging.WARNING):
        res = _post(client, auth_headers)

    assert res.status_code == 200, res.text
    assert res.json()["email_delivery"] == "sent"
    assert INVITE_ID in caplog.text


@pytest.mark.parametrize("outcome, delivery", [
    (SendOutcome("sent", provider="smtp"), "sent"),
    (SendOutcome("failed", reason="The mail server could not be reached.", provider="smtp",
                 retryable=True), "failed"),
    (SendOutcome("suppressed", reason="Email is not set up on this server."), "not_configured"),
])
def test_resend_returns_and_stores_the_delivery(client, auth_headers, wired, monkeypatch,
                                                outcome, delivery):
    _seed_resend(wired)
    _stub_send(monkeypatch, outcome)

    res = client.post(f"/org/invitations/{INVITE_ID}/resend",
                      headers={**auth_headers, "X-Org-Id": ACTIVE_ORG})

    assert res.status_code == 200, res.text
    body = res.json()
    assert body["email_delivery"] == delivery
    assert body["invitation"] == {"id": INVITE_ID, "email": INVITEE, "role": "member"}
    (_, args), = _outcome_updates(wired)
    assert args[1] == delivery


def test_resend_with_a_raising_sender_still_returns_the_fresh_link(client, auth_headers, wired,
                                                                  monkeypatch):
    _seed_resend(wired)
    _stub_send(monkeypatch, raises=True)
    res = client.post(f"/org/invitations/{INVITE_ID}/resend",
                      headers={**auth_headers, "X-Org-Id": ACTIVE_ORG})
    assert res.status_code == 200, res.text
    assert res.json()["email_delivery"] == "failed" and "token=" in res.json()["link"]


def test_the_list_returns_each_rows_delivery(client, auth_headers, wired):
    wired.set_fetchrow_result({"role": "org-admin"})
    wired.set_fetch_result([
        {"id": INVITE_ID, "email": INVITEE, "role": "member", "status": "pending",
         "expires_at": FUTURE, "invited_by": None, "created_at": FUTURE, "email_delivery": "failed"},
        {"id": "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", "email": "b@example.com", "role": "member",
         "status": "pending", "expires_at": FUTURE, "invited_by": None, "created_at": FUTURE,
         "email_delivery": None},
    ])

    res = client.get("/org/invitations", headers={**auth_headers, "X-Org-Id": ACTIVE_ORG})

    assert res.status_code == 200, res.text
    rows = res.json()["invitations"]
    assert [r["email_delivery"] for r in rows] == ["failed", None]
    select_sql = next(sql for sql, _ in wired.calls
                      if isinstance(sql, str) and "FROM public.org_invitations" in sql)
    assert "email_delivery" in select_sql
    assert "token_hash" not in select_sql
