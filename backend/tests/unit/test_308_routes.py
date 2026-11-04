"""Phase 308-04 Task 1 (HOOK-01, HOOK-02, HOOK-05; D-04, D-12, D-13, D-23, D-24, D-27, D-28, D-31,
D-46, D-53; T-308-01, T-308-04, T-308-06, T-308-18, T-308-20) — the member endpoint routes.

``/webhooks``: list, create (the secret shown once), edit, turn off / on, roll, delete — with the
save-time address refusal (``check_webhook_url`` then ``egress.validate_destination`` OFF the event
loop) and the cipher probe (no cipher -> 503, nothing stored, no fallback).

Mounted on a FRESH ``FastAPI()`` with dependency overrides (SEED-363: the real lifespan never runs);
``app.db.webhooks`` is replaced by the in-memory ``Store`` below, which the Task 2 suites
(``test_308_test_and_log_routes``, ``test_308_admin_routes``) import rather than retype. The store
mirrors 308-01's contracts: the owner predicate on every member call, ``owner_id=None`` = admin,
``EndpointAdminOff`` returned (never raised), ``changed_now`` on a toggle.
"""
from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone

import pytest
from cryptography.fernet import Fernet, MultiFernet
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.api import webhooks as route
from app.db import webhooks as webhooks_db
from app.security import egress, secret_cipher

ORG = "44444444-4444-4444-8444-444444444444"
ORG_B = "99999999-9999-4999-8999-999999999999"
USER = "33333333-3333-4333-8333-333333333333"
OTHER = "88888888-8888-4888-8888-888888888888"
ADMIN = "66666666-6666-4666-8666-666666666666"

URL = "https://hooks.example.com/syrel?token=abc"
HOST = "hooks.example.com"

ADDRESS_REFUSED = "That address can't be reached from the internet, so Syrel won't send to it."
SECRET_KEYS = {"secret", "secret_ciphertext", "previous_secret_ciphertext"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


def keys_of(obj):
    """Every key anywhere in a JSON value (the recursive key scan)."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield k
            yield from keys_of(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from keys_of(v)


def strings_of(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            yield str(k)
            yield from strings_of(v)
    elif isinstance(obj, list):
        for v in obj:
            yield from strings_of(v)
    elif obj is not None:
        yield str(obj)


class FakeRedis:
    """A pipeline-shaped counter. The bucket's minute suffix is dropped, so a run that straddles a
    minute boundary still counts into one bucket (no flake)."""

    def __init__(self):
        self.counts: dict[str, int] = {}
        self.down = False

    def pipeline(self, transaction=True):
        return _Pipe(self)


class _Pipe:
    def __init__(self, redis: FakeRedis):
        self.redis = redis
        self.ops: list[tuple[str, str]] = []

    async def __aenter__(self):
        return self

    async def __aexit__(self, *exc):
        return False

    def incr(self, key):
        self.ops.append(("incr", key.rsplit(":", 1)[0]))

    def expire(self, key, ttl):
        self.ops.append(("expire", key))

    async def execute(self):
        if self.redis.down:
            raise ConnectionError("redis down")
        out = []
        for op, key in self.ops:
            if op == "incr":
                self.redis.counts[key] = self.redis.counts.get(key, 0) + 1
                out.append(self.redis.counts[key])
            else:
                out.append(True)
        return out


_CLIENT_COLUMNS = (
    "id", "user_id", "org_id", "url", "description", "event_types", "enabled", "disabled_reason",
    "disabled_at", "previous_secret_expires_at", "consecutive_failures", "last_success_at",
    "created_at", "updated_at",
)


class Store:
    def __init__(self):
        self.endpoints: dict[str, dict] = {}
        self.events: dict[str, dict] = {}
        self.deliveries: dict[str, dict] = {}
        self.audits: list[dict] = []
        self.caller = USER
        self.is_admin = False
        self.org_names = {ORG: "Acme Legal", ORG_B: "Beta Corp"}
        self.names = {USER: "Dana Kim", OTHER: "Lee Park", ADMIN: "Ada Admin"}
        self.members = {(ORG, USER), (ORG, OTHER), (ORG, ADMIN), (ORG_B, USER)}
        self.cipher = MultiFernet([Fernet(Fernet.generate_key())])
        self.refuse_address = False
        self.validate_calls: list[tuple] = []
        self.threadpool_calls: list[tuple] = []
        self.create_calls: list[dict] = []
        self.test_deliveries: list[dict] = []
        self.test_outcomes: list[dict] = []
        self.redis = FakeRedis()

    # ── fixtures ──
    def add(self, *, user=USER, org=ORG, url=URL, event_types=("run.finished",), enabled=True,
            disabled_reason=None, description=None, secret="whsec_" + "A" * 44, created=None,
            consecutive_failures=0, last_success_at=None):
        eid = uuid.uuid4()
        now = created or _now()
        self.endpoints[str(eid)] = {
            "id": eid, "user_id": uuid.UUID(user), "org_id": uuid.UUID(org), "url": url,
            "description": description, "event_types": list(event_types), "enabled": enabled,
            "disabled_reason": disabled_reason, "disabled_at": None if enabled else now,
            "previous_secret_expires_at": None, "consecutive_failures": consecutive_failures,
            "last_success_at": last_success_at, "created_at": now, "updated_at": now,
            "secret_ciphertext": secret_cipher.encrypt_secret(secret, self.cipher),
            "previous_secret_ciphertext": None,
        }
        return str(eid)

    def add_delivery(self, endpoint_id, *, event_type="run.finished", status="sent", item_id=None,
                     created=None, attempts=1):
        event_id = uuid.uuid4()
        did = uuid.uuid4()
        self.events[str(event_id)] = {"id": event_id, "type": event_type,
                                      "item_id": item_id or uuid.uuid4()}
        self.deliveries[str(did)] = {
            "id": did, "endpoint_id": uuid.UUID(endpoint_id), "event_id": event_id, "status": status,
            "reason": None, "attempts": attempts, "last_status_code": 204, "last_latency_ms": 80,
            "last_error": None, "last_attempt_at": created or _now(), "next_attempt_at": None,
            "sent_at": created or _now(), "created_at": created or _now(),
        }
        return str(did)

    def view(self, row: dict) -> dict:
        return {k: row[k] for k in _CLIENT_COLUMNS}

    def owned(self, endpoint_id, org_id, user_id):
        row = self.endpoints.get(str(endpoint_id))
        if row is None or str(row["org_id"]) != str(org_id):
            return None
        if user_id is not None and str(row["user_id"]) != str(user_id):
            return None
        return row


@pytest.fixture
def store(monkeypatch):
    s = Store()

    async def create_endpoint(pool, *, user_id, org_id, url, description, event_types, secret_ciphertext):
        s.create_calls.append({"user_id": user_id, "org_id": org_id, "url": url,
                               "description": description, "event_types": list(event_types),
                               "secret_ciphertext": secret_ciphertext})
        mine = [r for r in s.endpoints.values()
                if str(r["user_id"]) == str(user_id) and str(r["org_id"]) == str(org_id)]
        if len(mine) >= webhooks_db.MAX_ENDPOINTS_PER_MEMBER:
            raise webhooks_db.EndpointCapReached()
        eid = s.add(user=str(user_id), org=str(org_id), url=url, event_types=event_types,
                    description=description)
        s.endpoints[eid]["secret_ciphertext"] = secret_ciphertext
        return s.view(s.endpoints[eid])

    async def list_endpoints_for_owner(pool, *, user_id, org_id):
        rows = [r for r in s.endpoints.values()
                if str(r["user_id"]) == str(user_id) and str(r["org_id"]) == str(org_id)]
        return [s.view(r) for r in sorted(rows, key=lambda r: r["created_at"], reverse=True)]

    async def get_endpoint_for_owner(pool, *, endpoint_id, user_id, org_id):
        row = s.owned(endpoint_id, org_id, user_id)
        return s.view(row) if row else None

    async def get_endpoint_signing(pool, *, endpoint_id, org_id):
        row = s.owned(endpoint_id, org_id, None)
        return dict(row) if row else None

    async def update_endpoint(pool, *, endpoint_id, user_id, org_id, url=None,
                              description=webhooks_db._UNSET, event_types=None):
        row = s.owned(endpoint_id, org_id, user_id)
        if row is None:
            return None
        if url is not None:
            row["url"] = url
        if description is not webhooks_db._UNSET:
            row["description"] = description
        if event_types is not None:
            row["event_types"] = list(event_types)
        return s.view(row)

    async def set_endpoint_enabled(pool, *, endpoint_id, org_id, owner_id, enabled, reason):
        admin = owner_id is None
        if not admin and reason is not None:
            raise ValueError("the owner's own turn-off carries no reason (D-58)")
        row = s.owned(endpoint_id, org_id, owner_id)
        if row is None:
            return None
        changed = False
        if enabled:
            if not admin and not row["enabled"] and row["disabled_reason"] == "admin":
                return webhooks_db.EndpointAdminOff
            if not row["enabled"]:
                row.update(enabled=True, disabled_reason=None, disabled_at=None, consecutive_failures=0)
                changed = True
        else:
            new_reason = (reason or "admin") if admin else None
            if row["enabled"] or (admin and row["disabled_reason"] != new_reason):
                row.update(enabled=False, disabled_reason=new_reason, disabled_at=_now())
                changed = True
        return {**s.view(row), "changed_now": changed}

    async def roll_secret(pool, *, endpoint_id, user_id, org_id, new_ciphertext):
        row = s.owned(endpoint_id, org_id, user_id)
        if row is None:
            return None
        old = row["previous_secret_expires_at"]
        row["previous_secret_ciphertext"] = row["secret_ciphertext"]
        row["previous_secret_expires_at"] = _now() + webhooks_db.PREVIOUS_SECRET_TTL
        row["secret_ciphertext"] = new_ciphertext
        return {**s.view(row), "ended_overlap": old is not None and old > _now()}

    async def delete_endpoint(pool, *, endpoint_id, org_id, owner_id):
        row = s.owned(endpoint_id, org_id, owner_id)
        if row is None:
            return None
        del s.endpoints[str(endpoint_id)]
        return {k: row[k] for k in ("id", "org_id", "user_id", "url", "description")}

    async def list_endpoints_for_org(pool, *, org_id):
        rows = [r for r in s.endpoints.values() if str(r["org_id"]) == str(org_id)]
        return [
            {**s.view(r), "owner_name": s.names.get(str(r["user_id"])),
             "owner_is_member": (str(r["org_id"]), str(r["user_id"])) in s.members}
            for r in sorted(rows, key=lambda r: r["created_at"], reverse=True)
        ]

    async def list_deliveries(pool, *, endpoint_id, user_id, org_id, before, limit):
        if s.owned(endpoint_id, org_id, user_id) is None:
            return None
        rows = [d for d in s.deliveries.values() if str(d["endpoint_id"]) == str(endpoint_id)]
        rows.sort(key=lambda d: (d["created_at"], str(d["id"])), reverse=True)
        if before is not None:
            rows = [d for d in rows if (d["created_at"], str(d["id"])) < (before[0], str(before[1]))]
        page = rows[: limit + 1]
        items = []
        for d in page[:limit]:
            ev = s.events[str(d["event_id"])]
            items.append({
                "id": d["id"], "event_type": ev["type"],
                "item_id": None if d["status"] == "skipped_not_visible" else ev["item_id"],
                **{k: d[k] for k in ("status", "reason", "attempts", "last_status_code",
                                     "last_latency_ms", "last_error", "last_attempt_at",
                                     "next_attempt_at", "sent_at", "created_at")},
            })
        nxt = (items[-1]["created_at"], items[-1]["id"]) if len(page) > limit and items else None
        return {"items": items, "next_cursor": nxt}

    async def create_test_delivery(pool, *, endpoint_id, org_id, payload):
        if s.owned(endpoint_id, org_id, None) is None:
            return None
        event_id, did = uuid.uuid4(), uuid.uuid4()
        s.events[str(event_id)] = {"id": event_id, "type": "webhook.test", "item_id": None,
                                   "payload": payload}
        s.deliveries[str(did)] = {
            "id": did, "endpoint_id": uuid.UUID(str(endpoint_id)), "event_id": event_id,
            "status": "sending", "reason": None, "attempts": 1, "last_status_code": None,
            "last_latency_ms": None, "last_error": None, "last_attempt_at": None,
            "next_attempt_at": _now(), "sent_at": None, "created_at": _now(),
        }
        s.test_deliveries.append({"endpoint_id": str(endpoint_id), "org_id": str(org_id),
                                  "payload": payload, "event_id": event_id, "delivery_id": did})
        return event_id, did

    async def record_test_outcome(pool, *, delivery_id, sent, status_code, latency_ms, error):
        s.test_outcomes.append({"delivery_id": delivery_id, "sent": sent, "status_code": status_code,
                                "latency_ms": latency_ms, "error": error})
        d = s.deliveries[str(delivery_id)]
        d.update(status="sent" if sent else "failed", reason=None if sent else "not_retried",
                 last_status_code=status_code, last_latency_ms=latency_ms, last_error=error)
        return True

    async def resend_delivery(pool, *, delivery_id, endpoint_id, user_id, org_id):
        row = s.owned(endpoint_id, org_id, user_id)
        d = s.deliveries.get(str(delivery_id))
        if row is None or d is None or str(d["endpoint_id"]) != str(endpoint_id):
            return None
        if s.events[str(d["event_id"])]["type"] == "webhook.test":
            return None
        if d["status"] not in ("sent", "failed"):
            return None
        if not row["enabled"]:
            raise webhooks_db.EndpointOff()
        d.update(status="pending", attempts=0, next_attempt_at=_now())
        return {k: d[k] for k in ("id", "endpoint_id", "event_id", "status", "attempts",
                                  "next_attempt_at")}

    for name, fn in {
        "create_endpoint": create_endpoint, "list_endpoints_for_owner": list_endpoints_for_owner,
        "get_endpoint_for_owner": get_endpoint_for_owner, "get_endpoint_signing": get_endpoint_signing,
        "update_endpoint": update_endpoint, "set_endpoint_enabled": set_endpoint_enabled,
        "roll_secret": roll_secret, "delete_endpoint": delete_endpoint,
        "list_endpoints_for_org": list_endpoints_for_org, "list_deliveries": list_deliveries,
        "create_test_delivery": create_test_delivery, "record_test_outcome": record_test_outcome,
        "resend_delivery": resend_delivery,
    }.items():
        monkeypatch.setattr(webhooks_db, name, fn)

    monkeypatch.setattr(secret_cipher, "get_cipher", lambda: s.cipher)

    def validate_destination(capability, url_or_host, port=None, *, allowed_host=None, resolver=None):
        s.validate_calls.append((capability, url_or_host, port, allowed_host))
        if s.refuse_address:
            raise egress.EgressRefused(reason_code="address_not_public", host=allowed_host or "",
                                       capability=capability, ip="10.0.0.1")
        return None

    s.validate_fake = validate_destination
    monkeypatch.setattr(egress, "validate_destination", validate_destination)

    real_threadpool = route.run_in_threadpool

    async def spy_threadpool(func, *args, **kwargs):
        s.threadpool_calls.append((func, args, kwargs))
        return await real_threadpool(func, *args, **kwargs)

    monkeypatch.setattr(route, "run_in_threadpool", spy_threadpool)

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        s.audits.append({"user_id": user_id, "action_type": action_type, "metadata": metadata,
                         "org_id": org_id})

    monkeypatch.setattr(route, "write_audit_entry", _write)
    monkeypatch.setattr(route, "get_service_role_supabase", lambda org_id=None: object())

    async def mcp_switches(pool, org_id):
        name = s.org_names.get(str(org_id))
        return None if name is None else {"org_on": True, "deploy_on": True, "org_name": name}

    monkeypatch.setattr(route.api_keys_db, "mcp_switches", mcp_switches)

    async def _perm(request, current_user, active_org, perm):
        return s.is_admin

    monkeypatch.setattr(deps, "_has_org_permission", _perm)
    return s


def make_client(store: Store) -> TestClient:
    app = FastAPI()
    app.include_router(route.router)
    app.include_router(route.org_router)
    store.active_org = ORG

    async def _user():
        return {"id": store.caller, "email": "t@example.com"}

    async def _org():
        return store.active_org

    async def _pool():
        return object()

    app.dependency_overrides[deps.get_current_user] = _user
    app.dependency_overrides[deps.get_active_org_id] = _org
    app.dependency_overrides[deps.get_pg_pool] = _pool
    app.dependency_overrides[deps.get_redis] = lambda: store.redis
    return TestClient(app)


@pytest.fixture
def client(store):
    return make_client(store)


def _audit_actions(store):
    return [a["action_type"] for a in store.audits]


# ── list ──────────────────────────────────────────────────────────────────────────────────────


def test_list_is_the_callers_endpoints_in_the_active_org_only(client, store):
    mine = store.add()
    store.add(user=OTHER)
    store.add(org=ORG_B)
    r = client.get("/webhooks")
    assert r.status_code == 200, r.text
    body = r.json()
    assert [e["id"] for e in body["endpoints"]] == [mine]
    assert body["cap"] == 10
    assert body["org_name"] == "Acme Legal"
    assert set(body["endpoints"][0]) == {
        "id", "url", "description", "event_types", "enabled", "disabled_reason", "disabled_at",
        "last_success_at", "consecutive_failures", "previous_secret_expires_at", "created_at",
    }
    assert not (set(keys_of(body)) & SECRET_KEYS)


def test_list_survives_an_unreadable_org_name(client, store, monkeypatch):
    async def boom(pool, org_id):
        raise RuntimeError("db")

    monkeypatch.setattr(route.api_keys_db, "mcp_switches", boom)
    r = client.get("/webhooks")
    assert r.status_code == 200
    assert r.json()["org_name"] == ""


# ── create ────────────────────────────────────────────────────────────────────────────────────


def test_create_shows_the_secret_once_and_stores_only_ciphertext(client, store):
    r = client.post("/webhooks", json={
        "url": URL, "event_types": ["run.finished", "run.finished", "document.ingested"],
        "description": "  Ops alerts  ",
    })
    assert r.status_code == 201, r.text
    body = r.json()
    secret = body["secret"]
    assert secret.startswith("whsec_")
    assert set(body) == {"endpoint", "secret"}
    assert not (set(keys_of(body["endpoint"])) & SECRET_KEYS)
    assert body["endpoint"]["event_types"] == ["run.finished", "document.ingested"]
    assert body["endpoint"]["description"] == "Ops alerts"

    (call,) = store.create_calls
    assert call["secret_ciphertext"].startswith("enc:v1:")
    assert secret not in "".join(str(v) for v in call.values())
    assert secret_cipher.decrypt_secret(call["secret_ciphertext"], store.cipher) == secret

    assert store.audits == [{
        "user_id": USER, "action_type": "webhook.endpoint.created", "org_id": ORG,
        "metadata": {"actor": "owner", "endpoint_id": body["endpoint"]["id"], "host": HOST},
    }]


def test_create_validates_the_destination_off_the_event_loop(client, store):
    r = client.post("/webhooks", json={"url": URL, "event_types": ["run.waiting"]})
    assert r.status_code == 201, r.text
    assert store.validate_calls == [("webhook", URL, None, HOST)]
    offloaded = [c for c in store.threadpool_calls if c[0] is store.validate_fake]
    assert offloaded == [(store.validate_fake, ("webhook", URL, None), {"allowed_host": HOST})]


@pytest.mark.parametrize("url, code, message", [
    ("http://hooks.example.com/x", "address_refused", ADDRESS_REFUSED),
    ("https://user:pw@hooks.example.com/x", "invalid_url",
     "Take out the name and password before the @. If your receiver needs a token, put it in the "
     "query instead."),
    ("https://hooks.example.com/x#frag", "invalid_url", "Take out the part after #."),
    ("not a url", "invalid_url", "That isn't a web address."),
    ("https://", "invalid_url", "That isn't a web address."),
])
def test_create_refuses_a_bad_url_with_one_sentence(client, store, url, code, message):
    r = client.post("/webhooks", json={"url": url, "event_types": ["run.finished"]})
    assert r.status_code == 422, r.text
    assert r.json()["detail"] == {"code": code, "message": message}
    assert store.create_calls == [] and store.audits == []
    assert store.validate_calls == []   # the URL rules run first; egress never sees it


def test_create_refuses_an_internal_address_without_naming_why(client, store):
    store.refuse_address = True
    r = client.post("/webhooks", json={"url": "https://internal.example.com/x",
                                       "event_types": ["run.finished"]})
    assert r.status_code == 422
    assert r.json()["detail"] == {"code": "address_refused", "message": ADDRESS_REFUSED}
    assert "10.0.0.1" not in r.text and "address_not_public" not in r.text
    assert store.create_calls == [] and store.audits == []


@pytest.mark.parametrize("payload", [
    {"url": URL, "event_types": []},
    {"url": URL, "event_types": ["run.started"]},
    {"url": URL, "event_types": ["run.finished"], "description": "x" * 101},
    {"url": "https://h.example.com/" + "a" * 2048, "event_types": ["run.finished"]},
])
def test_create_refuses_a_malformed_body(client, store, payload):
    r = client.post("/webhooks", json=payload)
    assert r.status_code == 422
    assert store.create_calls == []


def test_the_eleventh_endpoint_is_refused(client, store):
    for _ in range(10):
        store.add()
    r = client.post("/webhooks", json={"url": URL, "event_types": ["run.finished"]})
    assert r.status_code == 409
    assert r.json()["detail"] == {
        "code": "cap_reached",
        "message": "You have 10 endpoints in Acme Legal, the most allowed. Delete one to add another.",
    }
    assert store.audits == []


def test_no_cipher_refuses_and_stores_nothing(client, store, monkeypatch):
    monkeypatch.setattr(secret_cipher, "get_cipher", lambda: None)
    r = client.post("/webhooks", json={"url": URL, "event_types": ["run.finished"]})
    assert r.status_code == 503
    assert r.json()["detail"] == {
        "code": "no_cipher",
        "message": "This Syrel deployment can't store a signing secret yet, so it can't add "
                   "webhooks. Ask the person who runs it to set up secret encryption.",
    }
    assert store.create_calls == [] and store.endpoints == {} and store.audits == []


# ── edit ──────────────────────────────────────────────────────────────────────────────────────


def test_patch_description_and_events_without_revalidating(client, store):
    eid = store.add(description="Old")
    r = client.patch(f"/webhooks/{eid}", json={"description": "New", "event_types": ["run.waiting"]})
    assert r.status_code == 200, r.text
    ep = r.json()["endpoint"]
    assert ep["description"] == "New" and ep["event_types"] == ["run.waiting"]
    assert store.validate_calls == []
    assert _audit_actions(store) == ["webhook.endpoint.updated"]
    assert store.audits[0]["metadata"] == {"actor": "owner", "endpoint_id": eid, "host": HOST}


def test_patch_empty_description_clears_it_and_omitting_keeps_it(client, store):
    eid = store.add(description="Keep me")
    r = client.patch(f"/webhooks/{eid}", json={"event_types": ["run.finished"]})
    assert r.json()["endpoint"]["description"] == "Keep me"
    r = client.patch(f"/webhooks/{eid}", json={"description": ""})
    assert r.json()["endpoint"]["description"] is None


def test_patch_a_new_url_reruns_both_checks(client, store):
    eid = store.add()
    new = "https://other.example.org/in"
    r = client.patch(f"/webhooks/{eid}", json={"url": new})
    assert r.status_code == 200
    assert store.validate_calls == [("webhook", new, None, "other.example.org")]
    assert r.json()["endpoint"]["url"] == new

    r = client.patch(f"/webhooks/{eid}", json={"url": "https://u:p@other.example.org/in"})
    assert r.status_code == 422 and r.json()["detail"]["code"] == "invalid_url"
    store.refuse_address = True
    r = client.patch(f"/webhooks/{eid}", json={"url": "https://intranet.example.org/in"})
    assert r.json()["detail"] == {"code": "address_refused", "message": ADDRESS_REFUSED}
    assert store.endpoints[eid]["url"] == new
    assert _audit_actions(store) == ["webhook.endpoint.updated"]


def test_patch_another_members_endpoint_is_a_404(client, store):
    eid = store.add(user=OTHER)
    r = client.patch(f"/webhooks/{eid}", json={"description": "mine now"})
    assert r.status_code == 404
    assert store.endpoints[eid]["description"] is None and store.audits == []


# ── turn off / on ─────────────────────────────────────────────────────────────────────────────


def test_turn_off_then_on_audits_each_change_once(client, store):
    eid = store.add()
    r = client.post(f"/webhooks/{eid}/disable")
    assert r.status_code == 200, r.text
    assert r.json()["endpoint"]["enabled"] is False
    assert r.json()["endpoint"]["disabled_reason"] is None
    assert "changed_now" not in r.json()["endpoint"]
    client.post(f"/webhooks/{eid}/disable")   # a repeat: no second row
    r = client.post(f"/webhooks/{eid}/enable")
    assert r.json()["endpoint"]["enabled"] is True
    client.post(f"/webhooks/{eid}/enable")
    assert _audit_actions(store) == ["webhook.endpoint.disabled", "webhook.endpoint.enabled"]
    assert all(a["metadata"]["actor"] == "owner" for a in store.audits)


def test_owner_cannot_turn_on_an_admin_off_endpoint(client, store):
    eid = store.add(enabled=False, disabled_reason="admin")
    r = client.post(f"/webhooks/{eid}/enable")
    assert r.status_code == 403
    assert r.json()["detail"] == {"code": "admin_off",
                                  "message": "Only an org admin can turn this back on."}
    assert store.endpoints[eid]["enabled"] is False and store.audits == []


def test_toggle_another_members_endpoint_is_a_404(client, store):
    eid = store.add(user=OTHER)
    assert client.post(f"/webhooks/{eid}/disable").status_code == 404
    assert client.post(f"/webhooks/{eid}/enable").status_code == 404
    assert store.endpoints[eid]["enabled"] is True


# ── roll ──────────────────────────────────────────────────────────────────────────────────────


def test_roll_shows_the_new_secret_once_and_keeps_the_old_for_24h(client, store):
    eid = store.add()
    before = store.endpoints[eid]["secret_ciphertext"]
    r = client.post(f"/webhooks/{eid}/roll-secret")
    assert r.status_code == 200, r.text
    body = r.json()
    assert set(body) == {"endpoint", "secret", "previous_secret_expires_at"}
    assert body["secret"].startswith("whsec_")
    assert not (set(keys_of(body["endpoint"])) & SECRET_KEYS)
    expires = datetime.fromisoformat(body["previous_secret_expires_at"])
    assert abs((expires - (_now() + timedelta(hours=24))).total_seconds()) < 60
    row = store.endpoints[eid]
    assert row["previous_secret_ciphertext"] == before
    assert secret_cipher.decrypt_secret(row["secret_ciphertext"], store.cipher) == body["secret"]
    assert _audit_actions(store) == ["webhook.endpoint.secret_rolled"]


def test_roll_without_a_cipher_is_refused(client, store, monkeypatch):
    eid = store.add()
    monkeypatch.setattr(secret_cipher, "get_cipher", lambda: None)
    r = client.post(f"/webhooks/{eid}/roll-secret")
    assert r.status_code == 503 and r.json()["detail"]["code"] == "no_cipher"
    assert store.endpoints[eid]["previous_secret_ciphertext"] is None


def test_roll_another_members_endpoint_is_a_404(client, store):
    eid = store.add(user=OTHER)
    assert client.post(f"/webhooks/{eid}/roll-secret").status_code == 404
    assert store.audits == []


# ── delete ────────────────────────────────────────────────────────────────────────────────────


def test_delete_own_endpoint(client, store):
    eid = store.add()
    r = client.delete(f"/webhooks/{eid}")
    assert r.status_code == 204
    assert eid not in store.endpoints
    assert store.audits == [{
        "user_id": USER, "action_type": "webhook.endpoint.deleted", "org_id": ORG,
        "metadata": {"actor": "owner", "endpoint_id": eid, "host": HOST},
    }]


def test_delete_another_members_endpoint_is_a_404(client, store):
    eid = store.add(user=OTHER)
    assert client.delete(f"/webhooks/{eid}").status_code == 404
    assert eid in store.endpoints and store.audits == []


# ── never a query, a path token or a secret in an audit row (T-308-18) ───────────────────────


def test_audit_metadata_never_carries_the_query_or_path(client, store):
    r = client.post("/webhooks", json={
        "url": "https://hooks.example.com/hooks/catch/123/abcdefghijklmnopqrstu?sig=s3cr3t",
        "event_types": ["run.finished"],
    })
    assert r.status_code == 201
    (audit,) = store.audits
    flat = " ".join(strings_of(audit))
    assert "s3cr3t" not in flat and "abcdefghijklmnopqrstu" not in flat
    assert r.json()["secret"] not in flat
