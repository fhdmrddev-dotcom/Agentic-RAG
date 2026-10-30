"""Phase 304-02 (KEY-05, KEY-06, SC5; D-06, D-17, D-19, D-20, D-26, D-36) — the ``mcp`` key kind.

ONE resolver core (``authenticate_presented_key``) serves both kinds. What is pinned here:

  * an ``srl_mcp_`` key is refused where a workflow key is expected, and the reverse, TWICE over:
    by prefix in ``digest_key`` (before any database read) and by the ``kind`` column after the
    lookup (D-06). At ``/inbound`` both answer the one byte-identical 401 (SC5);
  * the core raises a typed ``KeyRefused(reason, sentence)`` that 305 maps onto its transport;
    attributable refusals go through the existing throttled ``api_key.refused`` path (D-19, D-36);
  * every liveness fact is read LIVE: flip it between two calls and the second is refused;
  * a workflow key never reads the MCP switches, and its audit metadata is byte-identical to 293's;
  * ``resolve_mcp_principal`` builds a frozen ``McpPrincipal`` from the resolved key only (D-20).

Mounted on a FRESH ``FastAPI()`` — never ``app.main.app``'s lifespan (SEED-363). Fakes only.
"""

from __future__ import annotations

import asyncio
import dataclasses
import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app import dependencies as deps
from app.security import api_key_auth as auth
from app.security import principal_liveness as liveness
from tests.unit.phase293_inbound_fakes import FakeRedis

KEY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ORG_ID = "44444444-4444-4444-8444-444444444444"
USER_ID = "33333333-3333-4333-8333-333333333333"
FOLDER_A = "f0000000-0000-4000-8000-00000000000a"
WF_ID = "55555555-5555-4555-8555-555555555555"

INVALID_BODY = b'{"detail":"This API key is not valid. It may have been revoked or have expired."}'


class _Pool:
    """Passed through only — every read goes through the patched ``db/api_keys`` functions."""


def _run(coro):
    return asyncio.run(coro)


def _row_for(minted, *, kind: str) -> dict:
    row = {
        "id": KEY_ID,
        "org_id": ORG_ID,
        "user_id": USER_ID,
        "label": "Claude Desktop" if kind == "mcp" else "Zapier intake",
        "key_prefix": minted.key_prefix,
        "key_hash": minted.key_hash,
        "workflows": [] if kind == "mcp" else [{"id": WF_ID, "name": "Contract review"}],
        "expires_at": datetime.now(timezone.utc) + timedelta(days=30),
        "revoked_at": None,
        "kind": kind,
        "folder_ids": [FOLDER_A] if kind == "mcp" else None,
        "tools": ["search_knowledge_base", "read_document"] if kind == "mcp" else None,
        "include_external": kind == "mcp",
    }
    return row


@pytest.fixture
def world(monkeypatch):
    workflow_minted = auth.mint_key()
    state = {
        "minted": workflow_minted,
        "row": _row_for(workflow_minted, kind="workflow"),
        "member": True,
        "banned": False,
        "switches": {"org_on": True, "deploy_on": True, "org_name": "Acme"},
        "switch_reads": [],
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

    async def _switches(pool, org_id):
        state["switch_reads"].append(org_id)
        return None if state["switches"] is None else dict(state["switches"])

    async def _write(user_id, action_type, metadata, supabase, org_id=None):
        state["audits"].append(
            {"user_id": user_id, "action_type": action_type, "metadata": metadata, "org_id": org_id}
        )

    monkeypatch.setattr(auth.api_keys_db, "get_key_for_auth", _get_key_for_auth)
    monkeypatch.setattr(auth.api_keys_db, "is_org_member", _is_org_member)
    monkeypatch.setattr(auth.api_keys_db, "touch_last_used", _touch)
    monkeypatch.setattr(auth.api_keys_db, "mcp_switches", _switches, raising=False)
    monkeypatch.setattr(deps, "_is_banned", _banned)
    monkeypatch.setattr(auth, "write_audit_entry", _write)
    monkeypatch.setattr(auth, "get_service_role_supabase", lambda org_id: object())
    return state


def _use_mcp_key(world) -> str:
    minted = auth.mint_key(kind="mcp")
    world["minted"] = minted
    world["row"] = _row_for(minted, kind="mcp")
    return minted.secret


@pytest.fixture
def client(world):
    app = FastAPI()

    async def _pool():
        return _Pool()

    app.dependency_overrides[deps.get_pg_pool] = _pool
    redis = FakeRedis()
    app.dependency_overrides[deps.get_redis] = lambda: redis

    @app.post("/probe")
    async def probe(key: auth.ResolvedKey = Depends(auth.resolve_api_key)):
        return {"id": key.id, "kind": key.kind}

    return TestClient(app)


def _bearer(secret: str) -> dict:
    return {"Authorization": f"Bearer {secret}"}


async def _core(world, secret: str, *, expected_kind: str, redis=None, call: str = "read"):
    return await auth.authenticate_presented_key(
        secret, pool=_Pool(), redis=redis or FakeRedis(), call=call, expected_kind=expected_kind
    )


# ── mint + digest ───────────────────────────────────────────────────────────────────────────────


def test_mint_keeps_the_workflow_default_and_mints_an_mcp_prefix():
    plain = auth.mint_key()
    assert plain.secret.startswith("srl_live_") and len(plain.key_prefix) == 13
    mcp = auth.mint_key(kind="mcp")
    assert auth.MCP_KEY_PREFIX == "srl_mcp_"
    assert mcp.secret.startswith("srl_mcp_")
    assert mcp.key_prefix == mcp.secret[:12]
    assert len(mcp.key_prefix) == 12   # the prefix + 4
    assert mcp.key_hash == hashlib.sha256(mcp.secret.encode()).hexdigest()


def test_digest_refuses_the_other_kinds_prefix_both_ways():
    live, mcp = auth.mint_key(), auth.mint_key(kind="mcp")
    assert auth.digest_key(mcp.secret, kind="workflow") is None
    assert auth.digest_key(live.secret, kind="mcp") is None
    assert auth.digest_key(mcp.secret, kind="mcp") == mcp.key_hash
    # No kind: exactly as 293 — a workflow key digests, an MCP key does not.
    assert auth.digest_key(live.secret) == live.key_hash
    assert auth.digest_key(mcp.secret) is None


# ── cross-kind refusal (SC5) ────────────────────────────────────────────────────────────────────


def test_an_mcp_secret_at_the_inbound_door_is_the_one_401_and_never_reaches_the_db(client, world):
    secret = auth.mint_key(kind="mcp").secret
    r = client.post("/probe", headers=_bearer(secret))
    assert r.status_code == 401
    assert r.content == INVALID_BODY
    assert world["lookups"] == []
    assert world["audits"] == []


def test_an_mcp_row_reached_as_a_workflow_key_is_refused_by_the_kind_column(client, world):
    # The secret carries the workflow prefix, so refusal #1 passes; the row says mcp (refusal #2).
    world["row"]["kind"] = "mcp"
    r = client.post("/probe", headers=_bearer(world["minted"].secret))
    assert r.status_code == 401
    assert r.content == INVALID_BODY
    assert len(world["audits"]) == 1
    md = world["audits"][0]["metadata"]
    assert world["audits"][0]["action_type"] == "api_key.refused"
    assert md["reason"] == "wrong_kind"
    assert md["kind"] == "mcp"
    assert world["touched"] == []


def test_a_workflow_row_reached_as_an_mcp_key_raises_wrong_kind_and_is_audited_once(world):
    secret = _use_mcp_key(world)
    world["row"]["kind"] = "workflow"
    redis = FakeRedis()
    for _ in range(3):
        with pytest.raises(auth.KeyRefused) as exc:
            _run(_core(world, secret, expected_kind="mcp", redis=redis))
        assert exc.value.reason == "wrong_kind"
    # Throttled through the existing _refuse path: one row per key, reason and minute.
    assert [a["metadata"]["reason"] for a in world["audits"]] == ["wrong_kind"]
    assert "kind" not in world["audits"][0]["metadata"]   # the ROW is a workflow key


def test_a_workflow_secret_at_the_mcp_core_is_unknown_and_unaudited(world):
    with pytest.raises(auth.KeyRefused) as exc:
        _run(_core(world, world["minted"].secret, expected_kind="mcp"))
    assert exc.value.reason == "unknown"
    assert exc.value.sentence is None
    assert world["lookups"] == []
    assert world["audits"] == []


def test_an_unknown_mcp_key_is_unknown_and_unaudited(world):
    _use_mcp_key(world)
    stranger = auth.mint_key(kind="mcp").secret
    with pytest.raises(auth.KeyRefused) as exc:
        _run(_core(world, stranger, expected_kind="mcp"))
    assert exc.value.reason == "unknown"
    assert world["audits"] == []


# ── MCP liveness through the core ─────────────────────────────────────────────────────────────


def _arm(world, name: str) -> None:
    if name == "revoked":
        world["row"]["revoked_at"] = datetime.now(timezone.utc) - timedelta(minutes=1)
    elif name == "expired":
        world["row"]["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    elif name == "not_member":
        world["member"] = False
    elif name == "banned":
        world["banned"] = True
    elif name == "mcp_off_org":
        world["switches"]["org_on"] = False
    elif name == "mcp_off_deployment":
        world["switches"]["deploy_on"] = False


MCP_ARMS = ["revoked", "expired", "not_member", "banned", "mcp_off_org", "mcp_off_deployment"]


@pytest.mark.parametrize("arm", MCP_ARMS)
def test_each_mcp_refusal_names_its_reason_and_is_audited_with_kind_mcp(world, arm):
    secret = _use_mcp_key(world)
    _arm(world, arm)
    with pytest.raises(auth.KeyRefused) as exc:
        _run(_core(world, secret, expected_kind="mcp"))
    assert exc.value.reason == arm
    expected_sentence = {
        "mcp_off_org": liveness.MCP_OFF_ORG_SENTENCE,
        "mcp_off_deployment": liveness.MCP_OFF_DEPLOYMENT_SENTENCE,
    }.get(arm)
    assert exc.value.sentence == expected_sentence
    assert len(world["audits"]) == 1
    entry = world["audits"][0]
    assert entry["action_type"] == "api_key.refused"
    assert entry["metadata"]["reason"] == arm
    assert entry["metadata"]["kind"] == "mcp"
    assert entry["metadata"]["call"] == "read"
    assert entry["org_id"] == ORG_ID
    assert world["touched"] == []


def test_a_revoked_key_with_the_org_switch_off_reports_revoked(world):
    secret = _use_mcp_key(world)
    _arm(world, "revoked")
    _arm(world, "mcp_off_org")
    with pytest.raises(auth.KeyRefused) as exc:
        _run(_core(world, secret, expected_kind="mcp"))
    assert exc.value.reason == "revoked"


def test_a_missing_switch_row_refuses(world):
    secret = _use_mcp_key(world)
    world["switches"] = None
    with pytest.raises(auth.KeyRefused) as exc:
        _run(_core(world, secret, expected_kind="mcp"))
    assert exc.value.reason in {"mcp_off_org", "mcp_off_deployment"}


def test_each_check_is_read_live_between_two_calls(world):
    secret = _use_mcp_key(world)
    assert _run(_core(world, secret, expected_kind="mcp")).kind == "mcp"
    world["member"] = False
    with pytest.raises(auth.KeyRefused) as exc:
        _run(_core(world, secret, expected_kind="mcp"))
    assert exc.value.reason == "not_member"

    world["member"] = True
    assert _run(_core(world, secret, expected_kind="mcp")).kind == "mcp"
    world["switches"]["deploy_on"] = False
    with pytest.raises(auth.KeyRefused) as exc:
        _run(_core(world, secret, expected_kind="mcp"))
    assert exc.value.reason == "mcp_off_deployment"
    # One live read per MCP resolution that got past membership (the not_member call stops
    # before the switches), never a cached answer.
    assert len(world["switch_reads"]) == 3


def test_a_live_mcp_key_resolves_with_its_narrowing_and_touches_last_used(world):
    secret = _use_mcp_key(world)
    key = _run(_core(world, secret, expected_kind="mcp"))
    assert key.kind == "mcp"
    assert key.folder_ids == (FOLDER_A,)
    assert key.tools == ("search_knowledge_base", "read_document")
    assert key.include_external is True
    assert key.workflows == []
    assert world["touched"] == [(KEY_ID, ORG_ID)]
    assert world["audits"] == []


# ── workflow keys are unchanged ────────────────────────────────────────────────────────────────


def test_a_workflow_key_never_reads_the_switches(client, world):
    r = client.post("/probe", headers=_bearer(world["minted"].secret))
    assert r.status_code == 200, r.text
    assert r.json() == {"id": KEY_ID, "kind": "workflow"}
    for arm in ["revoked", "not_member", "banned"]:
        world["row"]["revoked_at"], world["member"], world["banned"] = None, True, False
        _arm(world, arm)
        client.post("/probe", headers=_bearer(world["minted"].secret))
    assert world["switch_reads"] == []


def test_a_workflow_key_resolves_with_no_narrowing(world):
    key = _run(_core(world, world["minted"].secret, expected_kind="workflow", call="start"))
    assert key.kind == "workflow"
    assert key.folder_ids is None and key.tools is None and key.include_external is False


def test_a_workflow_keys_audit_metadata_has_no_kind(client, world):
    _arm(world, "revoked")
    client.post("/probe", headers=_bearer(world["minted"].secret))
    md = world["audits"][0]["metadata"]
    assert set(md) == {"api_key_id", "api_key_label", "call", "reason"}


def test_a_row_without_a_kind_column_is_a_workflow_key(client, world):
    del world["row"]["kind"]
    r = client.post("/probe", headers=_bearer(world["minted"].secret))
    assert r.status_code == 200, r.text


# ── the principal (D-20) ────────────────────────────────────────────────────────────────────────


def test_resolve_mcp_principal_builds_a_frozen_value_from_the_key(world):
    from app.security.mcp_principal import McpPrincipal, resolve_mcp_principal

    secret = _use_mcp_key(world)
    principal = _run(resolve_mcp_principal(secret, pool=_Pool(), redis=FakeRedis()))
    assert isinstance(principal, McpPrincipal)
    assert principal.key_id == KEY_ID
    assert principal.user_id == USER_ID
    assert principal.org_id == ORG_ID
    assert principal.folder_ids == (FOLDER_A,)
    assert principal.tools == ("search_knowledge_base", "read_document")
    assert principal.include_external is True
    assert principal.credential_kind == "key"
    with pytest.raises(dataclasses.FrozenInstanceError):
        principal.org_id = "other"  # type: ignore[misc]


def test_resolve_mcp_principal_refuses_a_workflow_key_and_audits_as_a_read(world):
    from app.security.mcp_principal import resolve_mcp_principal

    secret = _use_mcp_key(world)
    _arm(world, "revoked")
    with pytest.raises(auth.KeyRefused) as exc:
        _run(resolve_mcp_principal(secret, pool=_Pool(), redis=FakeRedis()))
    assert exc.value.reason == "revoked"
    assert world["audits"][0]["metadata"]["call"] == "read"

    with pytest.raises(auth.KeyRefused) as exc:
        _run(resolve_mcp_principal(auth.mint_key().secret, pool=_Pool(), redis=FakeRedis()))
    assert exc.value.reason == "unknown"


# ── one resolver ────────────────────────────────────────────────────────────────────────────────


def test_there_is_one_core_and_one_wrapper():
    import pathlib
    import re

    app_dir = pathlib.Path(auth.__file__).resolve().parents[1]
    hits = []
    for path in app_dir.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        hits += re.findall(r"def (authenticate_presented_key|resolve_api_key)\b", text)
    assert sorted(hits) == ["authenticate_presented_key", "resolve_api_key"]
