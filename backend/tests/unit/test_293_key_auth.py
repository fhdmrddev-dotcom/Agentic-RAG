"""Phase 293-01 (START-02; D-01, D-05, D-06, D-19; T-293-01, T-293-07, T-293-08) — the API key.

Mint, one-way digest, and the resolver that re-checks live state on EVERY call. The resolver is
mounted on a FRESH ``FastAPI()`` with ``get_pg_pool`` overridden. ⛔ It never enters
``app.main.app``'s lifespan (SEED-363: the real lifespan sweeps the shared local DB).

What is pinned here, and why each matters:
  * a missing key and a bad key answer with two DIFFERENT sentences, but every bad key — garbage,
    unknown, revoked, expired, orphaned, banned — answers with ONE byte-identical body, so a caller
    cannot tell a revoked key from one that never existed (D-06);
  * a refusal for a key we CAN attribute writes an ``api_key.refused`` audit row naming the reason,
    the key id and the label, and never the secret or its digest (D-16, T-293-07);
  * an unknown key has no owner to attribute (``audit_log.user_id`` is NOT NULL) so it writes no
    audit row, and logs only a 12-character fingerprint (T-293-08, T-293-09).
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.security import api_key_auth as auth

KEY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ORG_ID = "44444444-4444-4444-8444-444444444444"
USER_ID = "33333333-3333-4333-8333-333333333333"
WF_ID = "55555555-5555-4555-8555-555555555555"


# ── mint + digest ───────────────────────────────────────────────────────────────────────────────


def test_mint_returns_a_prefixed_secret_its_digest_and_a_13_char_prefix():
    minted = auth.mint_key()
    assert minted.secret.startswith("srl_live_")
    assert len(minted.secret) >= 50
    assert minted.key_hash == hashlib.sha256(minted.secret.encode()).hexdigest()
    assert minted.key_prefix == minted.secret[:13]
    assert len(minted.key_prefix) == 13
    assert auth.KEY_PREFIX == "srl_live_"


def test_two_mints_never_collide():
    a, b = auth.mint_key(), auth.mint_key()
    assert a.secret != b.secret
    assert a.key_hash != b.key_hash


def test_digest_matches_the_mint():
    minted = auth.mint_key()
    assert auth.digest_key(minted.secret) == minted.key_hash


@pytest.mark.parametrize(
    "presented",
    [
        "sk_live_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG",   # wrong prefix
        "srl_live_" + "a" * 120,                                  # longer than 128
        "srl_live_abc def",                                       # space outside urlsafe set
        "srl_live_abc$%^&*()",                                    # punctuation outside the set
        "srl_live_",                                              # the prefix alone
        "",
    ],
)
def test_digest_refuses_a_malformed_key(presented):
    assert auth.digest_key(presented) is None


# ── the resolver ────────────────────────────────────────────────────────────────────────────────


class _Pool:
    """Stands in for the asyncpg pool. The resolver only talks to it through ``db/api_keys``,
    which these tests replace, so this object is only ever passed through."""


@pytest.fixture
def world(monkeypatch):
    minted = auth.mint_key()
    state = {
        "minted": minted,
        "row": {
            "id": KEY_ID,
            "org_id": ORG_ID,
            "user_id": USER_ID,
            "label": "Zapier intake",
            "key_prefix": minted.key_prefix,
            "key_hash": minted.key_hash,
            "workflows": [{"id": WF_ID, "name": "Contract review"}],
            "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
            "revoked_at": None,
        },
        "member": True,
        "banned": False,
        "audits": [],
        "touched": [],
        "lookups": [],
    }

    async def _get_key_for_auth(pool, key_hash):
        state["lookups"].append(key_hash)
        row = state["row"]
        if row is not None and row["key_hash"] == key_hash:
            return dict(row)
        return None

    async def _is_org_member(pool, *, org_id, user_id):
        return state["member"]

    async def _touch(pool, key_id, *, org_id):
        state["touched"].append((key_id, org_id))

    async def _banned(user_id):
        return state["banned"]

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        state["audits"].append(
            {"user_id": user_id, "action_type": action_type, "metadata": metadata, "org_id": org_id}
        )

    monkeypatch.setattr(auth.api_keys_db, "get_key_for_auth", _get_key_for_auth)
    monkeypatch.setattr(auth.api_keys_db, "is_org_member", _is_org_member)
    monkeypatch.setattr(auth.api_keys_db, "touch_last_used", _touch)
    monkeypatch.setattr(deps, "_is_banned", _banned)
    monkeypatch.setattr(auth, "write_audit_entry", _write)
    monkeypatch.setattr(auth, "get_service_role_supabase", lambda org_id: object())
    return state


@pytest.fixture
def client(world):
    app = FastAPI()

    async def _pool():
        return _Pool()

    app.dependency_overrides[deps.get_pg_pool] = _pool

    @app.post("/probe")
    async def probe(key: auth.ResolvedKey = Depends(auth.resolve_api_key)):
        return {
            "id": key.id,
            "org_id": key.org_id,
            "user_id": key.user_id,
            "label": key.label,
            "workflows": key.workflows,
        }

    @app.get("/probe")
    async def probe_read(key: auth.ResolvedKey = Depends(auth.resolve_api_key)):
        return {"id": key.id}

    return TestClient(app)


def _bearer(secret: str) -> dict:
    return {"Authorization": f"Bearer {secret}"}


def test_no_authorization_header_is_401_with_the_no_key_sentence(client, world):
    r = client.post("/probe")
    assert r.status_code == 401
    assert r.json() == {"detail": auth.NO_KEY_DETAIL}
    assert auth.NO_KEY_DETAIL == (
        "This call has no API key. Send one as `Authorization: Bearer <key>`."
    )
    assert world["audits"] == []


def test_a_live_key_resolves_and_touches_last_used(client, world):
    r = client.post("/probe", headers=_bearer(world["minted"].secret))
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["id"] == KEY_ID
    assert body["org_id"] == ORG_ID
    assert body["user_id"] == USER_ID
    assert body["label"] == "Zapier intake"
    assert body["workflows"] == [{"id": WF_ID, "name": "Contract review"}]
    assert world["touched"] == [(KEY_ID, ORG_ID)]
    assert world["audits"] == []


def test_a_key_that_never_expires_resolves(client, world):
    world["row"]["expires_at"] = None
    r = client.post("/probe", headers=_bearer(world["minted"].secret))
    assert r.status_code == 200, r.text


def _arm(world, name: str) -> None:
    if name == "revoked":
        world["row"]["revoked_at"] = datetime.now(timezone.utc) - timedelta(minutes=1)
    elif name == "expired":
        world["row"]["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    elif name == "not_member":
        world["member"] = False
    elif name == "banned":
        world["banned"] = True


REFUSED_ARMS = ["revoked", "expired", "not_member", "banned"]


def test_every_bad_key_answers_with_one_byte_identical_401(world):
    """D-06 — garbage, unknown, revoked, expired, orphaned and banned keys are indistinguishable."""
    bodies: dict[str, bytes] = {}
    secret = world["minted"].secret

    def fresh_client():
        app = FastAPI()

        async def _pool():
            return _Pool()

        app.dependency_overrides[deps.get_pg_pool] = _pool

        @app.post("/probe")
        async def probe(key: auth.ResolvedKey = Depends(auth.resolve_api_key)):
            return {"id": key.id}

        return TestClient(app)

    c = fresh_client()
    bodies["garbage"] = c.post("/probe", headers=_bearer("not-a-key")).content
    bodies["unknown"] = c.post("/probe", headers=_bearer(auth.mint_key().secret)).content
    original = dict(world["row"])
    for arm in REFUSED_ARMS:
        world["row"] = dict(original)
        world["member"], world["banned"] = True, False
        _arm(world, arm)
        r = c.post("/probe", headers=_bearer(secret))
        assert r.status_code == 401, (arm, r.text)
        bodies[arm] = r.content

    assert len(set(bodies.values())) == 1, bodies
    assert next(iter(bodies.values())) == (
        b'{"detail":"This API key is not valid. It may have been revoked or have expired."}'
    )
    assert auth.INVALID_KEY_DETAIL == (
        "This API key is not valid. It may have been revoked or have expired."
    )


@pytest.mark.parametrize("arm", REFUSED_ARMS)
def test_each_refused_arm_writes_an_api_key_refused_audit(client, world, arm):
    _arm(world, arm)
    r = client.post("/probe", headers=_bearer(world["minted"].secret))
    assert r.status_code == 401
    assert r.json() == {"detail": auth.INVALID_KEY_DETAIL}
    assert len(world["audits"]) == 1, world["audits"]
    entry = world["audits"][0]
    assert entry["action_type"] == "api_key.refused"
    assert entry["user_id"] == USER_ID
    assert entry["org_id"] == ORG_ID   # explicit org, never the trigger's guess (RESEARCH pitfall 10)
    md = entry["metadata"]
    assert md["reason"] == arm
    assert md["api_key_id"] == KEY_ID
    assert md["api_key_label"] == "Zapier intake"
    assert md["call"] == "start"
    # A refused key is never touched — last_used_at means "last ACCEPTED call".
    assert world["touched"] == []


@pytest.mark.parametrize("arm", REFUSED_ARMS)
def test_no_audit_metadata_ever_carries_the_secret_or_its_digest(client, world, arm):
    _arm(world, arm)
    client.post("/probe", headers=_bearer(world["minted"].secret))
    md = world["audits"][0]["metadata"]
    flat = repr(md)
    assert "secret" not in md and "key_hash" not in md
    assert world["minted"].secret not in flat
    assert world["minted"].key_hash not in flat


def test_a_status_read_is_audited_as_a_read_call(client, world):
    _arm(world, "revoked")
    client.get("/probe", headers=_bearer(world["minted"].secret))
    assert world["audits"][0]["metadata"]["call"] == "read"


def test_an_unknown_key_writes_no_audit_and_logs_only_a_fingerprint(client, world, caplog):
    stranger = auth.mint_key().secret
    with caplog.at_level(logging.INFO, logger=auth.logger.name):
        r = client.post("/probe", headers=_bearer(stranger))
    assert r.status_code == 401
    assert world["audits"] == []
    text = caplog.text
    fp = hashlib.sha256(stranger.encode()).hexdigest()[:12]
    assert fp in text
    assert stranger not in text
    assert hashlib.sha256(stranger.encode()).hexdigest() not in text


def test_a_malformed_key_never_reaches_the_database(client, world):
    client.post("/probe", headers=_bearer("srl_live_has spaces in it"))
    assert world["lookups"] == []


def test_the_resolver_never_depends_on_the_jwt_user():
    src = open(auth.__file__, encoding="utf-8").read()
    code = "\n".join(l for l in src.splitlines() if not l.lstrip().startswith("#"))
    assert "get_current_user" not in code
    assert "compare_digest" in code
    assert not re.search(r"^\s*(from|import)\s+.*secret_cipher", code, re.M)


def test_the_key_scheme_is_named_for_the_public_spec():
    scheme = auth._key_bearer_scheme
    assert scheme.scheme_name == "ApiKey"
    assert scheme.auto_error is False
