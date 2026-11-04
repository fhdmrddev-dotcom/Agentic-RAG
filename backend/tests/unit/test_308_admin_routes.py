"""Phase 308-04 Task 2 (HOOK-06; D-30, D-31, D-51; T-308-15, T-308-20, T-308-21) — the org admin's
webhook routes on ``/org/webhooks``, behind ``require_org_manage``.

* The list is every endpoint in the active org with its owner, host and a MASKED path — no ``url``
  key and no query value anywhere (a receiver's token lives in the path or the query).
* Turn off sets reason ``admin``; turn on works only for an admin-off endpoint; delete is final.
* Every confirmed write is one audit row with actor ``admin`` and an explicit org.
* A non-admin is refused 403 on every route.
"""
from __future__ import annotations

import pytest

from tests.unit.test_308_routes import (  # noqa: F401 — the shared fixtures
    ADMIN,
    HOST,
    ORG,
    ORG_B,
    OTHER,
    USER,
    client,
    keys_of,
    store,
    strings_of,
)

TOKEN = "T0K3NabcdefghijklmnopqrstuVWX"
ZAPIER_URL = f"https://hooks.example.com/hooks/catch/123/{TOKEN}/?secret=qv4lu3"

ADMIN_ROW_KEYS = {
    "id", "owner_name", "owner_is_you", "owner_is_member", "host", "path", "has_query",
    "event_types", "enabled", "disabled_reason", "last_success_at", "consecutive_failures",
}


@pytest.fixture
def admin(store):
    store.caller = ADMIN
    store.is_admin = True
    return store


def _scan_clean(body):
    flat = list(strings_of(body))
    assert "url" not in set(keys_of(body))
    assert not any("?" in s for s in flat)
    assert not any(TOKEN in s or "qv4lu3" in s for s in flat)


def test_the_admin_list_shows_every_endpoint_in_the_org_without_the_query(client, admin):
    mine = admin.add(user=ADMIN)
    theirs = admin.add(user=OTHER, url=ZAPIER_URL, event_types=("run.finished", "run.waiting"))
    admin.add(user=USER, org=ORG_B)
    r = client.get("/org/webhooks")
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["org_name"] == "Acme Legal"
    rows = {e["id"]: e for e in body["endpoints"]}
    assert set(rows) == {mine, theirs}
    assert all(set(e) == ADMIN_ROW_KEYS for e in body["endpoints"])
    z = rows[theirs]
    assert z["host"] == HOST
    assert z["path"] == "/…"  # CR-01 / D-59: no path segment reaches an admin, whatever its length
    assert z["has_query"] is True
    assert z["owner_name"] == "Lee Park" and z["owner_is_you"] is False and z["owner_is_member"] is True
    assert rows[mine]["owner_is_you"] is True
    _scan_clean(body)


ZAPIER_SHORT = "https://hooks.zapier.com/hooks/catch/1234567/abc1234/"
PIPEDREAM = "https://eo3x9k2m7q1zpd4.m.pipedream.net/"


def test_cr01_a_real_zapier_catch_hook_never_reaches_the_admin(client, admin):
    """CR-01: every segment of a real Zapier hook is under 16 characters, so D-51's length mask
    showed the whole working URL. The admin row now carries the host and a neutral marker only."""
    eid = admin.add(user=OTHER, url=ZAPIER_SHORT)
    (row,) = [e for e in client.get("/org/webhooks").json()["endpoints"] if e["id"] == eid]
    assert (row["host"], row["path"], row["has_query"]) == ("hooks.zapier.com", "/…", False)
    flat = " ".join(strings_of(row))
    assert "1234567" not in flat and "abc1234" not in flat and "catch" not in flat


def test_cr01_a_token_in_the_host_is_masked_in_the_list_and_the_audit(client, admin):
    """CR-01: Pipedream-style receivers carry the token in the leftmost label; it is masked in the
    admin row AND in the audit metadata host (which reaches the org and operator audit tabs)."""
    eid = admin.add(user=OTHER, url=PIPEDREAM)
    (row,) = [e for e in client.get("/org/webhooks").json()["endpoints"] if e["id"] == eid]
    assert row["host"] == "….m.pipedream.net" and row["path"] == ""
    assert client.post(f"/org/webhooks/{eid}/disable").status_code == 200
    assert admin.audits[-1]["metadata"]["host"] == "….m.pipedream.net"
    assert "eo3x9k2m7q1zpd4" not in repr(admin.audits)


def test_the_admin_list_marks_an_owner_who_left(client, admin):
    admin.members.discard((ORG, OTHER))
    eid = admin.add(user=OTHER, enabled=False, disabled_reason="owner_removed")
    (row,) = client.get("/org/webhooks").json()["endpoints"]
    assert row["id"] == eid and row["owner_is_member"] is False
    assert row["disabled_reason"] == "owner_removed"


def test_admin_turn_off_sets_reason_admin_and_audits_once(client, admin):
    eid = admin.add(user=OTHER, url=ZAPIER_URL)
    r = client.post(f"/org/webhooks/{eid}/disable")
    assert r.status_code == 200, r.text
    ep = r.json()["endpoint"]
    assert ep["enabled"] is False and ep["disabled_reason"] == "admin"
    _scan_clean(r.json())
    client.post(f"/org/webhooks/{eid}/disable")   # a repeat writes no second row
    assert admin.audits == [{
        "user_id": ADMIN, "action_type": "webhook.endpoint.disabled", "org_id": ORG,
        "metadata": {"actor": "admin", "endpoint_id": eid, "host": HOST},
    }]


def test_admin_turn_off_replaces_a_failing_reason(client, admin):
    eid = admin.add(user=OTHER, enabled=False, disabled_reason="failing")
    r = client.post(f"/org/webhooks/{eid}/disable")
    assert r.json()["endpoint"]["disabled_reason"] == "admin"
    assert [a["action_type"] for a in admin.audits] == ["webhook.endpoint.disabled"]


def test_admin_turn_on_only_for_an_admin_off_endpoint(client, admin):
    off = admin.add(user=OTHER, enabled=False, disabled_reason="admin")
    r = client.post(f"/org/webhooks/{off}/enable")
    assert r.status_code == 200, r.text
    assert r.json()["endpoint"]["enabled"] is True
    assert admin.audits[-1]["action_type"] == "webhook.endpoint.enabled"
    assert admin.audits[-1]["metadata"]["actor"] == "admin"

    failing = admin.add(user=OTHER, enabled=False, disabled_reason="failing")
    r = client.post(f"/org/webhooks/{failing}/enable")
    assert r.status_code == 409
    assert r.json()["detail"]["code"] == "not_admin_off"
    assert admin.endpoints[failing]["enabled"] is False
    assert len(admin.audits) == 1


def test_admin_turn_on_of_an_endpoint_already_on_changes_nothing(client, admin):
    eid = admin.add(user=OTHER)
    r = client.post(f"/org/webhooks/{eid}/enable")
    assert r.status_code == 200 and r.json()["endpoint"]["enabled"] is True
    assert admin.audits == []


def test_admin_delete(client, admin):
    eid = admin.add(user=OTHER, url=ZAPIER_URL)
    r = client.delete(f"/org/webhooks/{eid}")
    assert r.status_code == 204
    assert eid not in admin.endpoints
    assert admin.audits == [{
        "user_id": ADMIN, "action_type": "webhook.endpoint.deleted", "org_id": ORG,
        "metadata": {"actor": "admin", "endpoint_id": eid, "host": HOST},
    }]


def test_admin_routes_cannot_reach_another_org(client, admin):
    eid = admin.add(user=USER, org=ORG_B)
    assert client.post(f"/org/webhooks/{eid}/disable").status_code == 404
    assert client.post(f"/org/webhooks/{eid}/enable").status_code == 404
    assert client.delete(f"/org/webhooks/{eid}").status_code == 404
    assert eid in admin.endpoints and admin.endpoints[eid]["enabled"] is True
    assert admin.audits == []


@pytest.mark.parametrize("method, path", [
    ("get", "/org/webhooks"),
    ("post", "/org/webhooks/{eid}/disable"),
    ("post", "/org/webhooks/{eid}/enable"),
    ("delete", "/org/webhooks/{eid}"),
])
def test_a_non_admin_is_refused_on_every_admin_route(client, store, method, path):
    eid = store.add(user=OTHER, enabled=False, disabled_reason="admin")
    r = getattr(client, method)(path.format(eid=eid))
    assert r.status_code == 403
    assert store.endpoints[eid]["enabled"] is False and store.audits == []
