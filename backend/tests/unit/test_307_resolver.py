"""Phase 307-01 (D-21, D-15, D-18, D-23, D-48; T-307-14/-15/-16/-20) — ONE resolver, two lookups.

An OAuth access token (``srl_oat_``) is a credential lookup in front of the SAME admission tail a
personal MCP key (``srl_mcp_``) goes through: kind -> grant-vs-key -> liveness -> touch -> the one
``McpPrincipal``. Proven here with fakes at the module seams (the test_304_resolver_kind style):

* a key row that names an OAuth client is refused on the key path (``wrong_kind``, audited), and a
  token whose grant row names none is refused on the token path (``wrong_kind``);
* an unknown / malformed / expired / revoked access token is the plain ``KeyRefused("unknown")``,
  never audited, and a malformed one never touches the pool;
* a token minted for another resource is refused ``wrong_resource`` and audited;
* every liveness refusal ``principal_still_allowed`` can return passes through unchanged;
* ``grant_still_live_for_refresh`` (D-48) returns the four life-or-death refusals and drops the two
  switch refusals — a switched-off org or deployment never blocks a refresh.
"""
from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.security import api_key_auth as auth
from app.security import mcp_principal as mp
from app.security import oauth_tokens as ot
from app.security.principal_liveness import (
    MCP_OFF_DEPLOYMENT_SENTENCE,
    MCP_OFF_ORG_SENTENCE,
    Refusal,
)

RESOURCE = "http://localhost:8000/mcp"
ORG, USER, CLIENT = str(uuid4()), str(uuid4()), uuid4()
FOLDER = str(uuid4())


class _PoolThatMustNotBeUsed:
    def __getattr__(self, name):
        raise AssertionError(f"the pool was used ({name}) for a string that is not a token")


def _grant_row(*, grant_id=None, oauth_client_id=CLIENT, label="Claude") -> dict:
    return {
        "id": grant_id or uuid4(),
        "org_id": ORG,
        "user_id": USER,
        "label": label,
        "key_prefix": "srl_mcp_abcd",
        "workflows": [],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=90),
        "revoked_at": None,
        "revoked_by": None,
        "last_used_at": None,
        "created_at": datetime.now(timezone.utc),
        "kind": "mcp",
        "folder_ids": [FOLDER],
        "tools": ["search_knowledge_base", "read_document"],
        "include_external": False,
        "key_hash": "f" * 64,
        "oauth_client_id": oauth_client_id,
    }


def _token_row(token: str, **grant) -> dict:
    return {
        **_grant_row(**grant),
        "token_id": uuid4(),
        "token_kind": "access",
        "token_hash": hashlib.sha256(token.encode()).hexdigest(),
        "resource": RESOURCE,
        "token_expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
        "token_created_at": datetime.now(timezone.utc),
        "token_used_at": None,
        "token_replaced_by": None,
        "token_revoked_at": None,
    }


@pytest.fixture
def world(monkeypatch):
    access = ot.mint_token("access")
    state = {
        "access": access,
        "token_row": _token_row(access),
        "key_row": None,
        "refusal": None,
        "liveness_calls": [],
        "audits": [],
        "touched": [],
        "lookups": [],
    }

    async def _get_access_token_for_auth(pool, digest):
        state["lookups"].append(("oauth", digest))
        row = state["token_row"]
        if row is not None and row["token_hash"] == digest:
            return dict(row)
        return None

    async def _get_key_for_auth(pool, digest):
        state["lookups"].append(("key", digest))
        row = state["key_row"]
        if row is not None and row["key_hash"] == digest:
            return dict(row)
        return None

    async def _touch(pool, key_id, *, org_id):
        state["touched"].append((key_id, org_id))

    async def _still_allowed(pool, *, key_row):
        state["liveness_calls"].append(key_row["id"])
        return state["refusal"]

    async def _slot(redis, *, key_id, reason):
        return 0

    async def _audit_now(key, action_type, *, call, reason=None, detail=None, **_):
        state["audits"].append({"action_type": action_type, "reason": reason, "call": call,
                                "key_id": key.get("id") if isinstance(key, dict) else key.id})

    monkeypatch.setattr(auth.oauth_db, "get_access_token_for_auth", _get_access_token_for_auth)
    monkeypatch.setattr(auth.api_keys_db, "get_key_for_auth", _get_key_for_auth)
    monkeypatch.setattr(auth.api_keys_db, "touch_last_used", _touch)
    monkeypatch.setattr(auth, "principal_still_allowed", _still_allowed)
    monkeypatch.setattr(auth, "refusal_audit_slot", _slot)
    monkeypatch.setattr(auth, "audit_key_call_now", _audit_now)
    monkeypatch.setattr(mp, "mcp_url", lambda: RESOURCE)
    return state


async def _resolve(presented, pool=None):
    return await mp.resolve_mcp_principal(presented, pool=pool or object(), redis=object())


# ── the key path is unchanged, and refuses a grant row ───────────────────────────────────────


def _use_key(world, *, oauth_client_id=None) -> str:
    minted = auth.mint_key("mcp")
    row = _grant_row(oauth_client_id=oauth_client_id, label="My key")
    row["key_hash"] = minted.key_hash
    world["key_row"] = row
    return minted.secret


async def test_a_key_still_resolves_as_a_key(world):
    secret = _use_key(world)
    p = await _resolve(secret)
    assert isinstance(p, mp.McpPrincipal)
    assert p.credential_kind == "key" and p.label == "My key"
    assert p.key_id == str(world["key_row"]["id"]) and p.org_id == ORG and p.user_id == USER
    assert p.folder_ids == (FOLDER,) and p.tools == ("search_knowledge_base", "read_document")
    assert world["touched"] and world["audits"] == []
    assert [k for k, _ in world["lookups"]] == ["key"]


async def test_a_grant_row_presented_through_the_key_path_is_wrong_kind(world):
    secret = _use_key(world, oauth_client_id=CLIENT)
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(secret)
    assert exc.value.reason == "wrong_kind"
    assert [a["reason"] for a in world["audits"]] == ["wrong_kind"]
    assert world["liveness_calls"] == [] and world["touched"] == []


# ── the access-token path ────────────────────────────────────────────────────────────────────


async def test_a_live_access_token_resolves_as_an_oauth_principal(world):
    p = await _resolve(world["access"])
    row = world["token_row"]
    assert p == mp.McpPrincipal(
        key_id=str(row["id"]), user_id=USER, org_id=ORG, folder_ids=(FOLDER,),
        tools=("search_knowledge_base", "read_document"), include_external=False,
        credential_kind="oauth", label="Claude",
    )
    assert world["touched"] == [(row["id"], ORG)]
    assert world["liveness_calls"] == [row["id"]]
    assert world["audits"] == []
    assert [k for k, _ in world["lookups"]] == ["oauth"]


@pytest.mark.parametrize(
    "presented",
    ["srl_oat_", "srl_oat_has space", "srl_oat_" + "a" * 130, "srl_oat_bad+chars/="],
)
async def test_a_malformed_access_token_never_touches_the_pool(world, presented):
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(presented, pool=_PoolThatMustNotBeUsed())
    assert exc.value.reason == "unknown" and exc.value.sentence is None
    assert world["lookups"] == [] and world["audits"] == []


async def test_an_unknown_access_token_is_unknown_and_unaudited(world):
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(ot.mint_token("access"))
    assert exc.value.reason == "unknown" and world["audits"] == []
    assert world["liveness_calls"] == [] and world["touched"] == []


@pytest.mark.parametrize("field,value", [
    ("token_expires_at", datetime.now(timezone.utc) - timedelta(seconds=1)),
    ("token_revoked_at", datetime.now(timezone.utc)),
])
async def test_an_expired_or_revoked_access_token_is_unknown_and_unaudited(world, field, value):
    world["token_row"][field] = value
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(world["access"])
    assert exc.value.reason == "unknown" and exc.value.sentence is None
    assert world["audits"] == [] and world["liveness_calls"] == [] and world["touched"] == []


async def test_a_stored_hash_mismatch_is_unknown(world, monkeypatch):
    async def _lying(pool, digest):
        return {**world["token_row"], "token_hash": "0" * 64}

    monkeypatch.setattr(auth.oauth_db, "get_access_token_for_auth", _lying)
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(world["access"])
    assert exc.value.reason == "unknown" and world["audits"] == []


async def test_a_token_for_another_resource_is_refused_and_audited(world):
    world["token_row"]["resource"] = "https://other.example/mcp"
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(world["access"])
    assert exc.value.reason == "wrong_resource"
    assert [a["reason"] for a in world["audits"]] == ["wrong_resource"]
    assert world["audits"][0]["call"] == "read"
    assert world["touched"] == []


async def test_a_canonically_equal_resource_is_accepted(world):
    world["token_row"]["resource"] = "HTTP://LocalHost:8000/mcp/"
    p = await _resolve(world["access"])
    assert p.credential_kind == "oauth"


async def test_no_served_address_refuses_every_token(world, monkeypatch):
    monkeypatch.setattr(mp, "mcp_url", lambda: None)
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(world["access"])
    assert exc.value.reason == "wrong_resource"


async def test_a_token_whose_grant_names_no_client_is_wrong_kind(world):
    world["token_row"]["oauth_client_id"] = None
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(world["access"])
    assert exc.value.reason == "wrong_kind"
    assert [a["reason"] for a in world["audits"]] == ["wrong_kind"]
    assert world["touched"] == []


@pytest.mark.parametrize("refusal", [
    Refusal("revoked"), Refusal("expired"), Refusal("not_member"), Refusal("banned"),
    Refusal("mcp_off_org", MCP_OFF_ORG_SENTENCE),
    Refusal("mcp_off_deployment", MCP_OFF_DEPLOYMENT_SENTENCE),
])
async def test_every_liveness_refusal_applies_to_a_grant(world, refusal):
    world["refusal"] = refusal
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(world["access"])
    assert exc.value.reason == refusal.reason
    assert exc.value.sentence == refusal.sentence
    assert [a["reason"] for a in world["audits"]] == [refusal.reason]
    assert world["touched"] == []


async def test_a_refresh_token_cannot_act_at_mcp(world):
    with pytest.raises(auth.KeyRefused) as exc:
        await _resolve(ot.mint_token("refresh"))
    assert exc.value.reason == "unknown"
    assert world["lookups"] == [] and world["audits"] == []


async def test_authenticate_presented_access_token_requires_a_resource(world):
    with pytest.raises(auth.KeyRefused) as exc:
        await auth.authenticate_presented_access_token(
            world["access"], pool=object(), redis=object(), resource=None
        )
    assert exc.value.reason == "wrong_resource"


# ── D-48: the refresh pre-check ──────────────────────────────────────────────────────────────


@pytest.mark.parametrize("refusal,expected", [
    (None, None),
    (Refusal("revoked"), "revoked"),
    (Refusal("expired"), "expired"),
    (Refusal("not_member"), "not_member"),
    (Refusal("banned"), "banned"),
    (Refusal("mcp_off_org", MCP_OFF_ORG_SENTENCE), None),
    (Refusal("mcp_off_deployment", MCP_OFF_DEPLOYMENT_SENTENCE), None),
])
async def test_grant_still_live_for_refresh(world, refusal, expected):
    world["refusal"] = refusal
    row = _grant_row()
    out = await auth.grant_still_live_for_refresh(object(), row)
    if expected is None:
        assert out is None
    else:
        assert out is refusal and out.reason == expected and out.sentence == refusal.sentence
    assert world["liveness_calls"] == [row["id"]]
    assert world["touched"] == [] and world["audits"] == []
