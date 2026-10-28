"""Phase 299 (299-01, D-06..D-10 / D-33..D-35) — the links resolver's pure half, without a DB.

``app.services.link_resolver`` owns ONE constant statement per kind (``SQL_BY_KIND``), the one
``lookup`` that issues it, and two pure folds: ``audience_of`` (who a link to this item opens for)
and ``to_target`` (a row -> the ``LinkTarget`` wire model).

Pinned here:
  * the per-kind predicates, read as text: the run statement carries the terminal-status literals
    and the org-member arm keyed on the RUN's org and ``$2`` (D-34, the evidence rule); the workflow
    statement has NO org-member arm (D-33); the Expert statement evaluates membership in the
    BUNDLE's org (never an active-org parameter) and carries the ``experts:manage`` arm inline;
  * ``POOL_KINDS`` is exactly {run, expert} (planner corrections P1 / P2 — their RLS policies are
    narrower than their read rules, so they run on the pool with the caller bound as ``$2``);
  * ``lookup`` issues exactly ONE ``fetchrow`` per call, with ``$2`` bound only for pool kinds;
  * ``audience_of`` matches every row of ``fixtures/link_audience_cases.json`` (the file is
    iterated: adding a row adds a case — the frontend ``linkAudience`` leaf is pinned to it too);
  * ``to_target`` nulls org_id/org_name for a system-global workflow and a system Expert (D-35);
  * ``WorkflowRunRead`` carries the additive ``org_id`` (D-10).

The live proof of the statements is ``tests/integration/test_299_links_live.py``.
"""
from __future__ import annotations

import importlib
import json
import re
from pathlib import Path
from uuid import UUID, uuid4

import pytest

FIXTURE = Path(__file__).parent / "fixtures" / "link_audience_cases.json"
CASES = json.loads(FIXTURE.read_text(encoding="utf-8"))
ORG_A = UUID("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa")


@pytest.fixture
def mod():
    # Imported per test so a missing module fails each behaviour test on its own (RED).
    return importlib.import_module("app.services.link_resolver")


def _flat(sql: str) -> str:
    return re.sub(r"\s+", " ", sql)


# ── §1 the per-kind statements ──────────────────────────────────────────────────


def test_there_is_exactly_one_statement_per_kind(mod):
    assert set(mod.SQL_BY_KIND) == {"thread", "workflow", "run", "expert"}
    for sql in mod.SQL_BY_KIND.values():
        assert isinstance(sql, str) and "$1" in sql


def test_pool_kinds_are_run_and_expert(mod):
    assert mod.POOL_KINDS == frozenset({"run", "expert"})


def test_thread_statement_is_the_owner_read(mod):
    sql = _flat(mod.SQL_BY_KIND["thread"])
    assert "t.id = $1" in sql and "t.user_id = auth.uid()" in sql
    assert "LEFT JOIN public.organizations o ON o.id = t.org_id" in sql
    assert "$2" not in sql  # RLS kind: the caller is auth.uid(), never a parameter


def test_workflow_statement_is_owner_or_global_published_with_no_member_arm(mod):
    sql = _flat(mod.SQL_BY_KIND["workflow"])
    assert "d.id = $1" in sql
    assert "d.created_by = auth.uid()" in sql
    assert "d.is_system_global AND d.status = 'published'" in sql
    assert "org_members" not in sql  # D-33: no org-member arm
    assert "$2" not in sql


def test_run_statement_is_owner_or_member_once_finished(mod):
    sql = _flat(mod.SQL_BY_KIND["run"])
    assert "wr.id = $1" in sql
    assert "wr.user_id = $2" in sql
    for literal in ("'completed'", "'failed'", "'cancelled'"):
        assert literal in sql
    assert "EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = wr.org_id AND m.user_id = $2)" in sql
    assert "auth.uid()" not in sql  # pool kind: auth.uid() is NULL there


def test_run_statement_requires_membership_on_the_owner_arm_too(mod):
    # 299-REVIEW WR-02: the membership EXISTS is ANDed with BOTH arms, matching RLS's
    # workflow_runs_select_own — never only with the member arm.
    sql = _flat(mod.SQL_BY_KIND["run"])
    assert (
        "AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = wr.org_id AND m.user_id = $2)"
        " AND (wr.user_id = $2 OR wr.status IN ('completed', 'failed', 'cancelled'))"
    ) in sql


def test_run_statement_reads_the_chat_title_only_for_its_owner(mod):
    # 299-REVIEW CR-02: a member of a finished run's org must never read the owner's private chat
    # title; everyone else reads the run's frozen workflow name (the evidence report's).
    sql = _flat(mod.SQL_BY_KIND["run"])
    assert "LEFT JOIN public.threads t ON t.id = wr.thread_id AND t.user_id = $2" in sql
    assert "wr.definition_snapshot->>'name'" in sql


def test_expert_statement_evaluates_membership_in_the_bundles_org(mod):
    sql = _flat(mod.SQL_BY_KIND["expert"])
    assert "b.id = $1" in sql
    assert "m.org_id = b.org_id AND m.user_id = $2" in sql
    assert "b.visibility IN ('org','public')" in sql
    assert "b.created_by = $2" in sql
    assert "g.grantee_type = 'user' AND g.grantee_id = $2::text" in sql
    assert "g.grantee_type = 'role' AND g.grantee_id = m.role" in sql
    assert "rp.permission_key = 'experts:manage'" in sql
    assert "m2.org_id = b.org_id AND m2.user_id = $2" in sql
    assert "auth.uid()" not in sql
    assert "current_user_has_permission" not in sql  # auth.uid() is NULL on the pool
    assert "$3" not in sql  # never an active-org parameter


# ── §2 lookup: exactly one statement ────────────────────────────────────────────


class _Conn:
    def __init__(self, row=None):
        self.calls: list = []
        self.row = row

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        return self.row


@pytest.mark.parametrize("kind", ["thread", "workflow", "run", "expert"])
async def test_lookup_issues_one_fetchrow_with_the_kinds_statement(mod, kind):
    item, caller = uuid4(), uuid4()
    conn = _Conn()
    assert await mod.lookup(conn, kind, item, caller) is None
    assert len(conn.calls) == 1
    sql, args = conn.calls[0]
    assert sql == mod.SQL_BY_KIND[kind]
    assert args == ((item, caller) if kind in mod.POOL_KINDS else (item,))


# ── §3 audience_of (the shared fixture) ─────────────────────────────────────────


def test_fixture_is_non_vacuous():
    assert len(CASES) == 15
    assert {c["kind"] for c in CASES} == {"thread", "workflow", "run", "expert"}
    assert {c["audience"] for c in CASES} == {
        "only_you", "org_members", "granted", "everyone", "managers_only",
    }


@pytest.mark.parametrize("case", CASES, ids=lambda c: f"{c['kind']}-{c['audience']}-{json.dumps(c['facts'])}")
def test_audience_of_matches_the_fixture(mod, case):
    assert mod.audience_of(case["kind"], case["facts"]) == case["audience"]


@pytest.mark.parametrize("status", ["failed", "cancelled"])
def test_every_terminal_run_status_opens_for_members(mod, status):
    assert mod.audience_of("run", {"status": status, "has_org": True}) == "org_members"


@pytest.mark.parametrize("status", ["paused", "cap_paused"])
def test_an_unfinished_run_opens_only_for_its_owner(mod, status):
    assert mod.audience_of("run", {"status": status, "has_org": True}) == "only_you"


def test_a_public_expert_opens_for_members(mod):
    facts = {"is_system": False, "is_enabled": True, "visibility": "public"}
    assert mod.audience_of("expert", facts) == "org_members"


# ── §4 to_target ────────────────────────────────────────────────────────────────


def test_to_target_thread(mod):
    tid = uuid4()
    t = mod.to_target("thread", {"id": tid, "title": "Q3 notes", "org_id": ORG_A, "org_name": "Acme"})
    assert t.model_dump() == {
        "kind": "thread", "id": tid, "org_id": ORG_A, "org_name": "Acme",
        "title": "Q3 notes", "state": None, "audience": "only_you",
    }


def test_to_target_workflow_carries_its_state(mod):
    wid = uuid4()
    row = {"id": wid, "title": "Tender", "status": "draft", "is_system_global": False,
           "org_id": ORG_A, "org_name": "Acme"}
    t = mod.to_target("workflow", row)
    assert (t.state, t.org_id, t.org_name, t.audience) == ("draft", ORG_A, "Acme", "only_you")


def test_to_target_global_workflow_has_no_org(mod):
    row = {"id": uuid4(), "title": "Starter", "status": "published", "is_system_global": True,
           "org_id": ORG_A, "org_name": "Acme"}
    t = mod.to_target("workflow", row)
    assert (t.org_id, t.org_name, t.state, t.audience) == (None, None, "published", "everyone")


def test_to_target_finished_run_opens_for_members(mod):
    row = {"id": uuid4(), "title": "Tender run", "status": "completed", "org_id": ORG_A,
           "org_name": "Acme"}
    t = mod.to_target("run", row)
    assert (t.state, t.org_id, t.audience) == (None, ORG_A, "org_members")


def test_to_target_system_expert_has_no_org(mod):
    row = {"id": uuid4(), "title": "Analyst", "is_system": True, "is_enabled": True,
           "visibility": "public", "org_id": None, "org_name": None}
    t = mod.to_target("expert", row)
    assert (t.org_id, t.org_name, t.state, t.audience) == (None, None, None, "everyone")


def test_to_target_never_returns_an_empty_title(mod):
    t = mod.to_target("thread", {"id": uuid4(), "title": None, "org_id": ORG_A, "org_name": "A"})
    assert t.title


# ── §5 the run read carries org_id (D-10) ───────────────────────────────────────


def test_workflow_run_read_declares_org_id():
    from app.api.workflow_runs import WorkflowRunRead

    field = WorkflowRunRead.model_fields.get("org_id")
    assert field is not None
    assert field.default is None
    assert "UUID" in str(field.annotation) and "None" in str(field.annotation)


def test_read_workflow_run_populates_org_id_from_the_selected_column():
    import inspect

    from app.api import workflow_runs

    src = inspect.getsource(workflow_runs.read_workflow_run)
    # Only the model construction counts: the handler already passes org_id to a helper above it.
    ctor = src[src.index("return WorkflowRunRead("):]
    assert 'org_id=run.get("org_id")' in ctor or 'org_id=run["org_id"]' in ctor
