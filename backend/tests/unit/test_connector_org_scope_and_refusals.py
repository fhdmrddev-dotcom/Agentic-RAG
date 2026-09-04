"""2026-08-31 — A CONNECTOR REFUSAL MUST NAME WHICH FAILURE IT WAS.

⚠ WHY THIS FILE EXISTS. `_handle_connector_chat_tool` resolved the caller's org with a
swallowed `except: pass` followed by `org_id = str(user_id)`, then listed connections
under `except: conns = []`. A user id matches no `connector_connections.org_id`, so FOUR
different situations — an RLS denial on `org_members`, a dropped DB connection, an
account in no org, and a service that genuinely is not connected — all ended at the one
sentence `"Connector service 'x' is not connected or not found."`

⚠ AND A WRONG CAUSE IS WORSE THAN NO CAUSE, because the model relays it. Measured the
same day one level up: handed only `HTTP 403`, the model told the operator to
"reconnect Google Workspace with the correct scopes". The scopes were already granted;
the Drive API was disabled in the Cloud project, and re-consenting could never have
fixed it. That is what an unnamed failure costs.

⚠ NOTHING HERE IS AN AST FENCE. `test_216_connector_wiring_reachable.py` deliberately
guards the SHAPE of the wiring because driving the real loop needs a provider, Redis and
Supabase. These cases guard BEHAVIOUR: each one calls the real function and reads the
sentence it produces. Every case was driven RED against the pre-fix code first — the
four refusal cases returned the identical "not connected or not found" string.
"""
from __future__ import annotations

import json
from types import SimpleNamespace

import pytest

from app.services.connectors.org_scope import OrgScope, resolve_connector_org


# ── A supabase double thin enough to be obviously honest ──────────────────────────────
class _Query:
    def __init__(self, outcome):
        self._outcome = outcome

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    # `aexec` calls `.execute()` in a threadpool.
    def execute(self):
        if isinstance(self._outcome, Exception):
            raise self._outcome
        return SimpleNamespace(data=self._outcome)


class _Supabase:
    def __init__(self, outcome):
        self._outcome = outcome

    def table(self, _name):
        return _Query(self._outcome)


USER = {"id": "11111111-1111-1111-1111-111111111111"}
ORG_A = "22222222-2222-2222-2222-222222222222"
ORG_B = "33333333-3333-3333-3333-333333333333"


# ══════════════════════════════════════════════════════════════════════════════════════
# resolve_connector_org — the five outcomes, each distinguishable
# ══════════════════════════════════════════════════════════════════════════════════════
@pytest.mark.asyncio
async def test_membership_resolves_to_the_first_org():
    scope = await resolve_connector_org(USER, _Supabase([{"org_id": ORG_A}]))
    assert scope.ok
    assert scope.org_id == ORG_A
    assert scope.problem is None
    assert scope.membership_count == 1


@pytest.mark.asyncio
async def test_two_memberships_are_COUNTED_not_hidden():
    """⚠ THE SECOND ORG'S CONNECTIONS ARE INVISIBLE IN CHAT, AND THAT IS UNCHANGED.

    This case does not assert that behaviour is right — it asserts the count is
    REPORTED, so the situation is legible to the next reader instead of silent. A chat
    turn carries no `X-Org-Id`, so the ordered read picks the oldest membership.
    """
    scope = await resolve_connector_org(
        USER, _Supabase([{"org_id": ORG_A}, {"org_id": ORG_B}])
    )
    assert scope.org_id == ORG_A
    assert scope.membership_count == 2


@pytest.mark.asyncio
async def test_a_failed_membership_read_is_a_PROBLEM_not_a_user_id_fallback():
    """The exact defect: the old code caught this and substituted the USER id."""
    scope = await resolve_connector_org(USER, _Supabase(RuntimeError("permission denied")))
    assert not scope.ok
    assert scope.org_id is None
    assert scope.problem is not None
    assert "could not be read" in scope.problem
    assert "RuntimeError" in scope.problem
    # ⭐ The load-bearing negative: the user id must NEVER appear as an org.
    assert USER["id"] not in (scope.org_id or "")


@pytest.mark.asyncio
async def test_no_membership_says_so_rather_than_inventing_a_scope():
    scope = await resolve_connector_org(USER, _Supabase([]))
    assert not scope.ok
    assert "not a member of any organisation" in (scope.problem or "")


@pytest.mark.asyncio
async def test_no_authenticated_user_is_named():
    scope = await resolve_connector_org(None, _Supabase([]))
    assert not scope.ok
    assert "no authenticated user" in (scope.problem or "")


@pytest.mark.asyncio
async def test_an_upstream_org_id_wins_without_a_second_read():
    """If it ever gets populated, it is trusted — and the DB double would RAISE if read."""
    scope = await resolve_connector_org(
        {**USER, "org_id": ORG_B}, _Supabase(AssertionError("must not be read"))
    )
    assert scope.org_id == ORG_B


# ══════════════════════════════════════════════════════════════════════════════════════
# _handle_connector_chat_tool — the three refusals are three different sentences
# ══════════════════════════════════════════════════════════════════════════════════════
def _ctx(supabase, current_user=USER):
    return SimpleNamespace(
        current_user=current_user,
        supabase=supabase,
        redis=None,
        thread_id="t-1",
        run_id=None,
        emit=None,
        tool_call_id=None,
        phase_whitelist=None,
    )


@pytest.mark.asyncio
async def test_unresolved_scope_refuses_WITHOUT_claiming_the_service_is_disconnected():
    from app.services.tool_dispatcher import _handle_connector_chat_tool

    res = await _handle_connector_chat_tool(
        "google", "search_files", {}, _ctx(_Supabase(RuntimeError("42501")))
    )
    payload = json.loads(res.result)
    assert payload["error"] == "connector_scope_unresolved"
    # ⭐ THE WHOLE POINT: the old sentence must NOT be what a person reads here.
    assert "is not connected or not found" not in payload["message"]
    assert "was NEVER looked up" in payload["message"].replace("never", "NEVER")


@pytest.mark.asyncio
async def test_a_failed_connection_LIST_is_not_reported_as_an_empty_one(monkeypatch):
    from app.services import tool_dispatcher

    async def _boom(**_kwargs):
        raise RuntimeError("permission denied for table connector_connections")

    monkeypatch.setattr(
        "app.services.connector_service.list_connections", _boom, raising=True
    )
    res = await tool_dispatcher._handle_connector_chat_tool(
        "google", "search_files", {}, _ctx(_Supabase([{"org_id": ORG_A}]))
    )
    payload = json.loads(res.result)
    assert payload["error"] == "connector_lookup_failed"
    assert "RuntimeError" in payload["message"]
    # ⭐ It explicitly refuses to claim the service is absent — it does not know.
    assert "may well be connected" in payload["message"]


@pytest.mark.asyncio
async def test_a_genuinely_absent_connection_still_says_not_connected(monkeypatch):
    """The original sentence survives — but ONLY on the path where it is true."""
    from app.services import tool_dispatcher

    async def _empty(**_kwargs):
        return []

    monkeypatch.setattr(
        "app.services.connector_service.list_connections", _empty, raising=True
    )
    res = await tool_dispatcher._handle_connector_chat_tool(
        "google", "search_files", {}, _ctx(_Supabase([{"org_id": ORG_A}]))
    )
    assert "is not connected or not found" in res.result


# ══════════════════════════════════════════════════════════════════════════════════════
# The Google error reason — the enum half travels, the message half never does
# ══════════════════════════════════════════════════════════════════════════════════════
def test_google_error_reason_carries_the_enums_and_not_the_message():
    from app.services.cloud_storage import _google_error_reason

    body = json.dumps({
        "error": {
            "code": 403,
            # ⚠ A REAL DRIVE ERROR MESSAGE ECHOES THE `q` PARAMETER, which carries
            # whatever the person searched for. This one is planted with a secret in it.
            "message": "the query 'name contains SECRET-SALARY-2026' was refused",
            "errors": [{"reason": "accessNotConfigured", "domain": "usageLimits",
                        "message": "the query 'name contains SECRET-SALARY-2026' failed"}],
            "status": "PERMISSION_DENIED",
        }
    }).encode()
    out = _google_error_reason(body)
    assert out == " (PERMISSION_DENIED / accessNotConfigured)"
    assert "SECRET-SALARY-2026" not in out
    assert "query" not in out


def test_google_error_reason_never_raises_on_junk():
    from app.services.cloud_storage import _google_error_reason

    for junk in (None, b"", b"not json", b"[]", b'{"error": "a string"}', b'{"error":{}}'):
        assert _google_error_reason(junk) == ""


def test_google_error_reason_drops_a_non_enum_reason():
    """Defence in depth: only alphanumeric enum tokens travel, never free text."""
    from app.services.cloud_storage import _google_error_reason

    body = json.dumps({
        "error": {"status": "PERMISSION DENIED because of 'my secret query'",
                  "errors": [{"reason": "contains spaces and 'quotes'"}]}
    }).encode()
    assert _google_error_reason(body) == ""
