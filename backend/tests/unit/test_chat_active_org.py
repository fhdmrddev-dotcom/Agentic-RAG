"""2026-08-31 — A CHAT TURN BELONGS TO THE ACTIVE ORG, NOT TO THE OLDEST MEMBERSHIP.

⚠ ONE ROOT CAUSE, FOUR SYMPTOMS THAT ALL LOOKED LIKE DIFFERENT BUGS. Chat resolved its org
by taking the caller's oldest `org_members` row, while every other surface honoured the
validated `X-Org-Id` the org switcher sets (`OrgProvider` persists it to localStorage and
syncs it onto every request). For an account in ONE org the two agree and nothing shows.
For an account in two they disagree permanently, and on this install that produced:

  · connectors in the active org were invisible in chat — grants applied through the
    settings panel appeared to "do nothing", because the turn was reading a different org;
  · "Always allow" refused with *"needs an organisation admin"* for an account that IS an
    org-admin of the active org;
  · the folder-scope picker never rendered — it is gated on `folders.length > 0` and the
    fallback org has none;
  · and the knowledge base looked empty, because every document is in the other org.

⚠ THE FIX IS NOT A BETTER GUESS, AND THAT DISTINCTION IS THE POINT. `X-Org-Id` was already
being sent and already re-validated server-side; chat simply was not reading it. Nothing
here invents a heuristic about which org a person "probably meant".

⚠ THE VALIDATION IS THE SECURITY PROPERTY. The header is client-supplied, so a caller who
typed another org's id would otherwise read that org's connections. Membership is checked
on the caller's own RLS connection (`auth.uid()`), and a non-member is IGNORED — the same
check `get_active_org_id` performs, differing only in that it refuses softly, because a
chat message must not 400 for someone who belongs to two organisations.

Driven end to end after the fix: `jira__list_projects` — a connector that exists ONLY in
the active org — was offered to the model, called, paused on its `ask` posture, approved
and executed. Before it, the same call answered "Connector service 'jira' is not
connected or not found."
"""
from __future__ import annotations

import ast
from contextlib import asynccontextmanager
from pathlib import Path
from types import SimpleNamespace

import pytest

import app.dependencies as deps

USER = {"id": "11111111-1111-1111-1111-111111111111"}
ORG = "22222222-2222-2222-2222-222222222222"


def _request(headers: dict | None = None):
    return SimpleNamespace(headers=headers or {}, state=SimpleNamespace())


def _pg(row):
    @asynccontextmanager
    async def _cm(request, current_user):
        class _Conn:
            async def fetchrow(self, *_a, **_k):
                if isinstance(row, Exception):
                    raise row
                return row
        yield _Conn()
    return _cm


@pytest.mark.asyncio
async def test_a_valid_member_org_is_returned(monkeypatch):
    monkeypatch.setattr(deps, "get_user_pg_connection", _pg({"role": "member"}))
    got = await deps.resolve_active_org_or_none(_request({"X-Org-Id": ORG}), USER)
    assert got == ORG


@pytest.mark.asyncio
async def test_an_org_the_caller_is_NOT_a_member_of_is_IGNORED(monkeypatch):
    """⚠ THE SECURITY PROPERTY. The header is client-supplied; without this check a caller
    could read another organisation's connectors by typing its id."""
    monkeypatch.setattr(deps, "get_user_pg_connection", _pg(None))
    got = await deps.resolve_active_org_or_none(_request({"X-Org-Id": ORG}), USER)
    assert got is None


@pytest.mark.asyncio
async def test_an_absent_header_is_None_not_an_error(monkeypatch):
    """⚠ SOFT, UNLIKE `get_active_org_id`. That gate 400s a two-org caller with no header —
    correct for `/org/*`, and it would break chat outright for the same person."""
    async def _must_not_read(*_a, **_k):
        raise AssertionError("no DB read may happen without a header")

    monkeypatch.setattr(deps, "get_user_pg_connection", _must_not_read)
    assert await deps.resolve_active_org_or_none(_request({}), USER) is None


@pytest.mark.asyncio
async def test_a_malformed_header_is_ignored_without_touching_the_database(monkeypatch):
    async def _must_not_read(*_a, **_k):
        raise AssertionError("a malformed id can match no membership; do not query")

    monkeypatch.setattr(deps, "get_user_pg_connection", _must_not_read)
    for junk in ("not-a-uuid", "'; drop table org_members; --", " "):
        assert await deps.resolve_active_org_or_none(_request({"X-Org-Id": junk}), USER) is None


@pytest.mark.asyncio
async def test_a_database_failure_falls_back_rather_than_failing_the_message(monkeypatch):
    monkeypatch.setattr(deps, "get_user_pg_connection", _pg(RuntimeError("boom")))
    assert await deps.resolve_active_org_or_none(_request({"X-Org-Id": ORG}), USER) is None


# ══════════════════════════════════════════════════════════════════════════════════════
# The wiring: send_message stamps it, and the readers already prefer it
# ══════════════════════════════════════════════════════════════════════════════════════
def _send_message_source() -> str:
    src = (Path(__file__).resolve().parents[2] / "app" / "api" / "threads.py").read_text(
        encoding="utf-8"
    )
    tree = ast.parse(src)
    for node in ast.walk(tree):
        if isinstance(node, ast.AsyncFunctionDef) and node.name == "send_message":
            return ast.get_source_segment(src, node) or ""
    raise AssertionError("send_message not found")


def test_send_message_resolves_the_active_org_and_carries_it_on_current_user():
    body = _send_message_source()
    assert "resolve_active_org_or_none(request, current_user)" in body
    # ⚠ A COPY, NOT A MUTATION. The dependency-cached dict belongs to the request and the
    # detached producer outlives it.
    assert '{**current_user, "org_id": active_org_id}' in body


def test_it_is_stamped_BEFORE_the_producer_is_spawned():
    """Stamped afterwards it would reach nothing: the producer captures `current_user` at
    spawn time and the loop reads it from the frozen RunContext."""
    body = _send_message_source()
    assert body.index("resolve_active_org_or_none") < body.index("run_producer(")


def test_resolve_connector_org_PREFERS_the_stamped_org_over_the_oldest_membership():
    """The reader half. This branch existed before the fix and had no supplier — which is
    why the two never met."""
    import inspect

    from app.services.connectors.org_scope import resolve_connector_org

    src = inspect.getsource(resolve_connector_org)
    assert 'upstream = (current_user or {}).get("org_id")' in src
    assert "if upstream:" in src
    # And it must win WITHOUT a second read — two sources that can disagree is the bug.
    upstream_at = src.index("if upstream:")
    query_at = src.index('supabase.table("org_members")')
    assert upstream_at < query_at
