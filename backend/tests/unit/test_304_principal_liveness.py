"""Phase 304-02 (KEY-05, KEY-06; D-18; T-304-13, T-304-18) — the ONE liveness predicate.

``principal_still_allowed`` is what 304's resolver and 306/307/308's per-call rechecks all ask:
is the credential still revoked-free, unexpired, its owner still a member and not banned, and —
for an MCP key only — are the org and deployment MCP switches still on? Pinned here:

  * the order is exactly D-18 (the first failing fact names the refusal);
  * nothing is cached — flip a fact between two calls and the second call sees it;
  * a missing or NULL switch refuses (fail CLOSED — an access gate, not a capability toggle);
  * a workflow key never reads the switches;
  * the module is importable WITHOUT ``api_key_auth`` and never reads ``load_app_settings``
    (its 30 s per-worker TTL would break "refused on the next call", R-09);
  * it calls ``api_keys_db.is_org_member`` / ``deps._is_banned`` by module attribute, so the
    293 monkeypatches drive it.
"""

from __future__ import annotations

import asyncio
import pathlib
import re
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

import pytest

from app import dependencies as deps
from app.db import api_keys as api_keys_db
from app.security import principal_liveness as liveness

KEY_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
ORG_ID = "44444444-4444-4444-8444-444444444444"
USER_ID = "33333333-3333-4333-8333-333333333333"


def _run(coro):
    return asyncio.run(coro)


@pytest.fixture
def world(monkeypatch):
    state = {
        "member": True,
        "banned": False,
        "switches": {"org_on": True, "deploy_on": True, "org_name": "Acme"},
        "reads": [],
        "key_row": None,
    }

    async def _is_org_member(pool, *, org_id, user_id):
        state["reads"].append("member")
        return state["member"]

    async def _banned(user_id):
        state["reads"].append("banned")
        return state["banned"]

    async def _switches(pool, org_id):
        state["reads"].append("switches")
        return None if state["switches"] is None else dict(state["switches"])

    async def _get_key_row(pool, *, key_id, org_id):
        state["reads"].append(("key_row", key_id, org_id))
        return None if state["key_row"] is None else dict(state["key_row"])

    monkeypatch.setattr(api_keys_db, "is_org_member", _is_org_member)
    monkeypatch.setattr(api_keys_db, "mcp_switches", _switches, raising=False)
    monkeypatch.setattr(api_keys_db, "get_key_row", _get_key_row, raising=False)
    monkeypatch.setattr(deps, "_is_banned", _banned)
    return state


def _row(kind: str = "mcp", **kw) -> dict:
    base = {
        "id": KEY_ID,
        "org_id": ORG_ID,
        "user_id": USER_ID,
        "kind": kind,
        "revoked_at": None,
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    }
    base.update(kw)
    return base


async def _ask(row):
    return await liveness.principal_still_allowed(object(), key_row=row)


def test_a_live_mcp_key_is_allowed(world):
    assert _run(_ask(_row())) is None
    assert world["reads"] == ["member", "banned", "switches"]


def test_a_live_workflow_key_is_allowed_and_never_reads_the_switches(world):
    assert _run(_ask(_row("workflow"))) is None
    assert "switches" not in world["reads"]


def test_a_row_without_kind_is_a_workflow_key(world):
    row = _row()
    del row["kind"]
    world["switches"]["org_on"] = False
    assert _run(_ask(row)) is None
    assert "switches" not in world["reads"]


@pytest.mark.parametrize(
    "facts, reason",
    [
        # Every fact false at once: the FIRST in D-18 order wins.
        ({"revoked": True, "expired": True, "member": False, "banned": True,
          "org_on": False, "deploy_on": False}, "revoked"),
        ({"expired": True, "member": False, "banned": True,
          "org_on": False, "deploy_on": False}, "expired"),
        ({"member": False, "banned": True, "org_on": False, "deploy_on": False}, "not_member"),
        ({"banned": True, "org_on": False, "deploy_on": False}, "banned"),
        # 304-REVIEW WR-03: the deployment's switch wins (D-30), the same order the screen uses.
        ({"org_on": False, "deploy_on": False}, "mcp_off_deployment"),
        ({"org_on": False}, "mcp_off_org"),
    ],
)
def test_the_order_is_exactly_d18(world, facts, reason):
    row = _row()
    if facts.get("revoked"):
        row["revoked_at"] = datetime.now(timezone.utc) - timedelta(minutes=1)
    if facts.get("expired"):
        row["expires_at"] = datetime.now(timezone.utc) - timedelta(seconds=1)
    world["member"] = facts.get("member", True)
    world["banned"] = facts.get("banned", False)
    world["switches"]["org_on"] = facts.get("org_on", True)
    world["switches"]["deploy_on"] = facts.get("deploy_on", True)
    refusal = _run(_ask(row))
    assert refusal is not None
    assert refusal.reason == reason


def test_both_switches_off_names_the_deployment_like_the_screen(world):
    """304-REVIEW WR-03: with both switches off, a refused call and the key screen (``_mcp_off``)
    name the SAME switch — the deployment's (D-30)."""
    from app.api.api_keys import _mcp_off

    world["switches"]["org_on"] = False
    world["switches"]["deploy_on"] = False
    refusal = _run(_ask(_row()))
    assert refusal.reason == "mcp_off_deployment"
    assert refusal.sentence == liveness.MCP_OFF_DEPLOYMENT_SENTENCE
    assert _mcp_off(world["switches"]) == "deployment"


def test_a_workflow_key_reports_its_credential_refusals_with_no_sentence(world):
    world["banned"] = True
    refusal = _run(_ask(_row("workflow")))
    assert refusal.reason == "banned"
    assert refusal.sentence is None


def test_the_switch_refusals_carry_their_own_plain_sentences(world):
    world["switches"]["org_on"] = False
    refusal = _run(_ask(_row()))
    assert refusal.sentence == liveness.MCP_OFF_ORG_SENTENCE
    world["switches"]["org_on"] = True
    world["switches"]["deploy_on"] = False
    refusal = _run(_ask(_row()))
    assert refusal.sentence == liveness.MCP_OFF_DEPLOYMENT_SENTENCE
    assert liveness.MCP_OFF_ORG_SENTENCE == (
        "MCP access is switched off for this organisation by an admin."
    )
    assert liveness.MCP_OFF_DEPLOYMENT_SENTENCE == (
        "MCP access is switched off for this deployment by the operator."
    )


@pytest.mark.parametrize(
    "switches, reason",
    [
        (None, "mcp_off_org"),                                         # no organisations row
        ({"org_on": None, "deploy_on": True}, "mcp_off_org"),          # NULL org switch
        ({"org_on": True, "deploy_on": None}, "mcp_off_deployment"),   # no app_settings row
    ],
)
def test_a_missing_or_null_switch_refuses(world, switches, reason):
    world["switches"] = switches
    refusal = _run(_ask(_row()))
    assert refusal is not None and refusal.reason == reason


def test_a_switch_read_failure_admits_nothing(world, monkeypatch):
    async def _boom(pool, org_id):
        raise RuntimeError("db down")

    monkeypatch.setattr(api_keys_db, "mcp_switches", _boom)
    with pytest.raises(RuntimeError):
        _run(_ask(_row()))


def test_nothing_is_cached_between_calls(world):
    row = _row()
    assert _run(_ask(row)) is None
    world["switches"]["org_on"] = False
    assert _run(_ask(row)).reason == "mcp_off_org"
    world["switches"]["org_on"] = True
    assert _run(_ask(row)) is None
    world["member"] = False
    assert _run(_ask(row)).reason == "not_member"
    assert world["reads"].count("switches") == 3


# ── recheck_principal — the entry 306/307/308 call ───────────────────────────────────────────────


@dataclass(frozen=True)
class _Principal:
    key_id: str
    org_id: str


def test_recheck_rereads_the_row_by_id_and_org(world):
    world["key_row"] = _row()
    assert _run(liveness.recheck_principal(object(), _Principal(KEY_ID, ORG_ID))) is None
    assert world["reads"][0] == ("key_row", KEY_ID, ORG_ID)


def test_recheck_refuses_a_vanished_row_as_revoked(world):
    world["key_row"] = None
    refusal = _run(liveness.recheck_principal(object(), _Principal(KEY_ID, ORG_ID)))
    assert refusal.reason == "revoked"


def test_recheck_sees_a_revoke_made_after_the_first_call(world):
    world["key_row"] = _row()
    principal = _Principal(KEY_ID, ORG_ID)
    assert _run(liveness.recheck_principal(object(), principal)) is None
    world["key_row"]["revoked_at"] = datetime.now(timezone.utc)
    assert _run(liveness.recheck_principal(object(), principal)).reason == "revoked"


def test_recheck_sees_the_switch_go_off(world):
    world["key_row"] = _row()
    world["switches"]["deploy_on"] = False
    refusal = _run(liveness.recheck_principal(object(), _Principal(KEY_ID, ORG_ID)))
    assert refusal.reason == "mcp_off_deployment"


# ── static fences ──────────────────────────────────────────────────────────────────────────────


def _source() -> str:
    return pathlib.Path(liveness.__file__).read_text(encoding="utf-8")


def test_the_predicate_never_imports_the_key_module_or_the_settings_cache():
    src = _source()
    assert "api_key_auth" not in src
    assert "load_app_settings" not in src


def test_the_predicate_reads_through_module_attributes():
    src = _source()
    assert re.search(r"api_keys_db\.is_org_member\(", src)
    assert re.search(r"deps\._is_banned\(", src)
    assert re.search(r"api_keys_db\.mcp_switches\(", src)
    assert not re.search(r"from app\.db\.api_keys import", src)
    assert not re.search(r"from app\.dependencies import", src)


def test_the_refusal_is_a_frozen_value():
    import dataclasses

    refusal = liveness.Refusal("revoked")
    assert refusal.sentence is None
    with pytest.raises(dataclasses.FrozenInstanceError):
        refusal.reason = "other"  # type: ignore[misc]
