"""Phase 293 plan 03 (START-04 / D-22, D-23, A8): how a run started, on every run read.

293-02 stamps ``workflow_runs.origin_kind`` / ``origin_label`` once, at start. This suite pins
the READ half: one pure helper (``origin_for_wire``) turns the recorded columns into
``{kind, label, actor_name}`` or ``None``, and the run page read, the run log list, the evidence
read and the chat message read all carry it. Nothing is inferred: a NULL or unknown kind is
``None`` everywhere (D-23 — never "app", never "manual").

Every read is driven through its REAL serializer (the 214 rule: declared AND selected AND
populated). The run reads use ``test_188``'s projecting fake, so a column missing from a
``.select()`` goes red here rather than shipping as a silent null. No case touches a database.
"""
from __future__ import annotations

import json
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone

import pytest

from tests.test_188_workflow_run_read import _FakeSupabase, _flipped_on, _is_op_false

OWNER = "00000000-0000-0000-0000-0000000293a1"
COLLEAGUE = "00000000-0000-0000-0000-0000000293a2"
ORG = "00000000-0000-0000-0000-0000000293b1"
RUN_KEY = "29303000-0000-4000-8000-000000000001"
RUN_APP = "29303000-0000-4000-8000-000000000002"
RUN_OLD = "29303000-0000-4000-8000-000000000003"
THREAD = "29303000-0000-4000-8000-000000000009"
DEF_ID = "29303000-0000-4000-8000-00000000000d"
OWNER_NAME = "Dana Whitfield"

DEFINITION = {
    "slug": "vendor-review",
    "version": 1,
    "name": "Vendor review",
    "phases": [{"slug": "research", "phase_index": 0, "name": "Find the evidence",
                "config": {"phase_type": "llm_agent"}}],
}


# ══ 1) the pure helper ═════════════════════════════════════════════════════════════════════


@pytest.mark.parametrize(
    ("args", "expected"),
    [
        (("key", "n8n-prod", None), {"kind": "key", "label": "n8n-prod", "actor_name": None}),
        (("schedule", None, None), {"kind": "schedule", "label": None, "actor_name": None}),
        (("schedule", "Monday digest", None),
         {"kind": "schedule", "label": "Monday digest", "actor_name": None}),
        (("app", None, OWNER_NAME), {"kind": "app", "label": None, "actor_name": OWNER_NAME}),
        (("app", None, "   "), {"kind": "app", "label": None, "actor_name": None}),
        (("key", "   ", None), {"kind": "key", "label": None, "actor_name": None}),
        # an actor name is an app fact only; a key or schedule start names no person
        (("key", "n8n-prod", OWNER_NAME), {"kind": "key", "label": "n8n-prod", "actor_name": None}),
        ((None, "n8n-prod", OWNER_NAME), None),
        (("manual", None, OWNER_NAME), None),
        (("", None, None), None),
        ((7, None, None), None),
    ],
)
def test_origin_for_wire(args, expected):
    from app.services.harness.run_read_wire import origin_for_wire

    assert origin_for_wire(*args) == expected


def test_origin_wire_model_admits_only_the_three_kinds():
    from pydantic import ValidationError

    from app.services.harness.run_read_wire import ORIGIN_KINDS, RunOriginWire

    assert ORIGIN_KINDS == frozenset({"app", "schedule", "key"})
    assert RunOriginWire(kind="key", label="x").actor_name is None
    with pytest.raises(ValidationError):
        RunOriginWire(kind="manual")


# ══ 2) GET /workflow-runs/{id} and GET /workflow-runs ══════════════════════════════════════


def _run(run_id, *, origin_kind, origin_label, created_at="2026-10-25T09:00:00+00:00"):
    row = {"id": run_id, "thread_id": THREAD, "definition_id": DEF_ID, "status": "completed",
           "created_at": created_at, "updated_at": created_at, "claimed_at": None,
           "user_id": OWNER, "definition_snapshot": DEFINITION}
    if origin_kind is not None or origin_label is not None:
        row["origin_kind"] = origin_kind
        row["origin_label"] = origin_label
    return row


def _store(display_name=OWNER_NAME):
    return _FakeSupabase(
        {
            "workflow_runs": [
                _run(RUN_KEY, origin_kind="key", origin_label="n8n-prod",
                     created_at="2026-10-25T09:00:00+00:00"),
                _run(RUN_APP, origin_kind="app", origin_label=None,
                     created_at="2026-10-24T09:00:00+00:00"),
                # an old run: never backfilled, both columns NULL
                _run(RUN_OLD, origin_kind=None, origin_label=None,
                     created_at="2026-10-23T09:00:00+00:00"),
            ],
            "workflow_definitions": [
                {"id": DEF_ID, "slug": "vendor-review", "version": 1, "name": "Vendor review",
                 "definition": DEFINITION}
            ],
            "workflow_phases": [],
            "profiles": [{"id": OWNER, "display_name": display_name}],
            "harness_audit": [],
        }
    )


def _as_owner(client, monkeypatch, store):
    import app.dependencies as deps
    from app.dependencies import get_user_supabase_client
    from app.main import app

    _flipped_on(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": OWNER, "email": "dana@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)
    app.dependency_overrides[get_user_supabase_client] = lambda: store


def test_run_read_carries_a_key_origin(client, monkeypatch):
    store = _store()
    _as_owner(client, monkeypatch, store)
    resp = client.get(f"/workflow-runs/{RUN_KEY}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["origin"] == {"kind": "key", "label": "n8n-prod", "actor_name": None}
    # a key start names no person, so no profile is read for it
    assert not any(c[1] == "profiles" for c in store.calls if c[0] == "select")


def test_run_read_names_the_owner_on_an_app_origin(client, monkeypatch):
    _as_owner(client, monkeypatch, _store())
    resp = client.get(f"/workflow-runs/{RUN_APP}")
    assert resp.json()["origin"] == {"kind": "app", "label": None, "actor_name": OWNER_NAME}


def test_run_read_app_origin_with_no_display_name_has_no_actor(client, monkeypatch):
    _as_owner(client, monkeypatch, _store(display_name=None))
    resp = client.get(f"/workflow-runs/{RUN_APP}")
    assert resp.json()["origin"] == {"kind": "app", "label": None, "actor_name": None}


def test_run_read_unrecorded_origin_is_null(client, monkeypatch):
    _as_owner(client, monkeypatch, _store())
    resp = client.get(f"/workflow-runs/{RUN_OLD}")
    assert resp.status_code == 200, resp.text
    assert resp.json()["origin"] is None
    assert "manual" not in resp.text


def test_run_read_selects_both_origin_columns(client, monkeypatch):
    store = _store()
    _as_owner(client, monkeypatch, store)
    client.get(f"/workflow-runs/{RUN_KEY}")
    run_selects = [c[2] for c in store.calls if c[0] == "select" and c[1] == "workflow_runs"]
    assert run_selects and all(
        "origin_kind" in cols and "origin_label" in cols for cols in run_selects
    )


def test_run_list_carries_origin_per_row(client, monkeypatch):
    store = _store()
    _as_owner(client, monkeypatch, store)
    resp = client.get("/workflow-runs")
    assert resp.status_code == 200, resp.text
    by_id = {r["id"]: r["origin"] for r in resp.json()["runs"]}
    assert by_id[RUN_KEY] == {"kind": "key", "label": "n8n-prod", "actor_name": None}
    assert by_id[RUN_APP] == {"kind": "app", "label": None, "actor_name": OWNER_NAME}
    assert by_id[RUN_OLD] is None
    # ONE name lookup per request, never one per row
    assert sum(1 for c in store.calls if c[0] == "select" and c[1] == "profiles") == 1


def test_run_list_with_no_app_row_reads_no_profile(client, monkeypatch):
    store = _store()
    store.rows["workflow_runs"] = [r for r in store.rows["workflow_runs"] if r["id"] != RUN_APP]
    _as_owner(client, monkeypatch, store)
    client.get("/workflow-runs")
    assert not any(c[1] == "profiles" for c in store.calls if c[0] == "select")


# ══ 3) the evidence read ═══════════════════════════════════════════════════════════════════


class _EvidencePool:
    def __init__(self, *, origin_kind, origin_label, display_name=OWNER_NAME):
        self.origin_kind = origin_kind
        self.origin_label = origin_label
        self.display_name = display_name
        self.calls: list[tuple[str, tuple]] = []

    async def fetchrow(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_runs wr" in sql:
            row = {"id": uuid.UUID(RUN_KEY), "thread_id": uuid.UUID(THREAD),
                   "definition_id": uuid.UUID(DEF_ID), "status": "completed",
                   "org_id": uuid.UUID(ORG), "user_id": uuid.UUID(OWNER),
                   "created_at": datetime(2026, 10, 25, 9, 0, tzinfo=timezone.utc),
                   "updated_at": datetime(2026, 10, 25, 9, 5, tzinfo=timezone.utc),
                   "definition_snapshot": json.dumps(DEFINITION), "model": "gpt-5"}
            # the access SQL must SELECT the two columns for them to exist on the row
            if "origin_kind" in sql and "origin_label" in sql:
                row["origin_kind"] = self.origin_kind
                row["origin_label"] = self.origin_label
            return row
        if "FROM workflow_definitions WHERE id" in sql:
            return {"slug": "vendor-review", "version": 1, "name": "Vendor review",
                    "status": "published", "definition": json.dumps(DEFINITION)}
        raise AssertionError(f"unexpected fetchrow: {sql}")

    async def fetch(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM workflow_phases" in sql:
            return []
        if "FROM harness_audit" in sql:
            return []
        if "SELECT version FROM workflow_definitions" in sql:
            return [{"version": 1}]
        raise AssertionError(f"unexpected fetch: {sql}")

    async def fetchval(self, sql, *args):
        self.calls.append((sql, args))
        if "FROM profiles" in sql:
            return self.display_name
        if "FROM organizations" in sql:
            return "Acme"
        return None


class _Conn:
    async def fetch(self, sql, *args):
        return [{"id": i} for i in args[0]]

    async def fetchval(self, sql, *args):
        return None


async def _evidence(monkeypatch, pool, viewer):
    import app.dependencies as deps
    from app.api.workflow_run_evidence import read_run_evidence

    async def _get_pool():
        return pool

    @asynccontextmanager
    async def _rls(request, current_user):
        yield _Conn()

    monkeypatch.setattr(deps, "get_pg_pool", _get_pool)
    monkeypatch.setattr(deps, "get_user_pg_connection", _rls)
    out = await read_run_evidence(workflow_run_id=uuid.UUID(RUN_KEY),
                                  current_user={"id": viewer, "email": "v@x.co"})
    return json.loads(out.model_dump_json())


@pytest.mark.asyncio
async def test_evidence_carries_the_key_origin_for_owner_and_colleague(monkeypatch):
    for viewer in (OWNER, COLLEAGUE):
        body = await _evidence(
            monkeypatch, _EvidencePool(origin_kind="key", origin_label="n8n-prod"), viewer
        )
        assert body["run"]["origin"] == {"kind": "key", "label": "n8n-prod", "actor_name": None}


@pytest.mark.asyncio
async def test_evidence_app_origin_names_the_starter(monkeypatch):
    body = await _evidence(
        monkeypatch, _EvidencePool(origin_kind="app", origin_label=None), COLLEAGUE
    )
    assert body["run"]["origin"] == {"kind": "app", "label": None, "actor_name": OWNER_NAME}


@pytest.mark.asyncio
async def test_evidence_unrecorded_origin_is_null(monkeypatch):
    body = await _evidence(
        monkeypatch, _EvidencePool(origin_kind=None, origin_label=None), OWNER
    )
    assert body["run"]["origin"] is None


@pytest.mark.asyncio
async def test_evidence_and_run_read_agree_for_the_same_run(client, monkeypatch):
    _as_owner(client, monkeypatch, _store())
    read = client.get(f"/workflow-runs/{RUN_KEY}").json()["origin"]
    body = await _evidence(
        monkeypatch, _EvidencePool(origin_kind="key", origin_label="n8n-prod"), OWNER
    )
    assert body["run"]["origin"] == read


# ══ 4) the chat message read — _enrich_messages_with_runs ══════════════════════════════════


class _Resp:
    def __init__(self, data):
        self.data = data


class _Q:
    def __init__(self, db, table):
        self.db = db
        self.table = table
        self.filters: dict[str, object] = {}
        self.columns = ""
        self.single = False

    def select(self, columns, **_kw):
        self.columns = columns
        self.db.selects.append((self.table, columns))
        return self

    def eq(self, col, val):
        self.filters[col] = str(val)
        return self

    def is_(self, *_a):
        return self

    def order(self, *_a, **_kw):
        return self

    def maybe_single(self):
        self.single = True
        return self

    def execute(self):
        rows = [r for r in self.db.rows.get(self.table, [])
                if all(str(r.get(k)) == v for k, v in self.filters.items())]
        if self.single:
            return _Resp(rows[0] if rows else None)
        return _Resp(rows)


class _Db:
    def __init__(self, rows):
        self.rows = rows
        self.selects: list[tuple[str, str]] = []

    def table(self, name):
        return _Q(self, name)


def _messages():
    return [
        {"id": "m-user", "role": "user", "content": "go"},
        {"id": "m-asst", "role": "assistant", "content": "done"},
    ]


async def _enrich(workflow_runs, *, display_name=OWNER_NAME):
    from app.api.threads import _enrich_messages_with_runs

    db = _Db({
        "runs": [],
        "workflow_runs": [dict(r, thread_id=THREAD, user_id=OWNER) for r in workflow_runs],
        "profiles": [{"id": OWNER, "display_name": display_name}],
    })
    msgs = await _enrich_messages_with_runs(
        _messages(), thread_id=THREAD, user_id=OWNER, supabase=db
    )
    return msgs, db


@pytest.mark.asyncio
async def test_chat_one_key_origin_stamps_every_message():
    msgs, _ = await _enrich([{"origin_kind": "key", "origin_label": "n8n-prod"},
                             {"origin_kind": "key", "origin_label": "n8n-prod"}])
    for m in msgs:
        assert m["run_origin"] == {"kind": "key", "label": "n8n-prod", "actor_name": None}


@pytest.mark.asyncio
async def test_chat_app_origin_names_the_caller():
    msgs, _ = await _enrich([{"origin_kind": "app", "origin_label": None}])
    assert msgs[1]["run_origin"] == {"kind": "app", "label": None, "actor_name": OWNER_NAME}


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "runs",
    [
        # an app start and a key start in one thread: ambiguous, so silent (A8)
        [{"origin_kind": "app", "origin_label": None},
         {"origin_kind": "key", "origin_label": "n8n-prod"}],
        # two different keys
        [{"origin_kind": "key", "origin_label": "a"}, {"origin_kind": "key", "origin_label": "b"}],
        # one recorded, one never recorded: still ambiguous, never guessed
        [{"origin_kind": "key", "origin_label": "a"}, {"origin_kind": None, "origin_label": None}],
        # never recorded at all
        [{"origin_kind": None, "origin_label": None}],
        # no workflow runs on the thread
        [],
    ],
)
async def test_chat_ambiguous_or_absent_origin_stamps_none(runs):
    msgs, db = await _enrich(runs)
    assert all(m["run_origin"] is None for m in msgs)
    assert not any(t == "profiles" for t, _ in db.selects)


@pytest.mark.asyncio
async def test_chat_workflow_runs_read_is_two_columns_owner_scoped():
    _, db = await _enrich([{"origin_kind": "key", "origin_label": "x"}])
    wr = [cols for t, cols in db.selects if t == "workflow_runs"]
    assert wr == ["origin_kind, origin_label"]


def test_chat_runs_select_text_is_unchanged():
    """The `runs` select and its parent filter are byte-identical to base (the ⛔ budget)."""
    from pathlib import Path

    src = (Path(__file__).resolve().parents[2] / "app/api/threads.py").read_text(encoding="utf-8")
    src = src.replace("\r\n", "\n")  # the checkout may be CRLF (autocrlf)
    assert (
        '"run_id, message_id, status, model, provider, started_at, completed_at, "\n'
        '            "org_id, input_tokens, output_tokens"'
    ) in src
    assert src.count('.is_("parent_run_id", "null")') >= 1
    assert src.count("fail silent, never guess") == 1


def test_message_response_declares_run_origin():
    from app.models.message import MessageResponse

    assert "run_origin" in MessageResponse.model_fields
    m = MessageResponse(
        id=uuid.uuid4(), thread_id=uuid.uuid4(), user_id=uuid.uuid4(), role="assistant",
        content="x", created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
        run_origin={"kind": "key", "label": "n8n-prod", "actor_name": None},
    )
    assert m.model_dump()["run_origin"] == {"kind": "key", "label": "n8n-prod",
                                            "actor_name": None}


# ══ 5) the chat thread's run line — GET /threads/{id}/workflow (293-03 Task 2, branch B) ══
#
# Step 0 measured that a workflow run's turn carries no tool_calls, so RunCard never mounts for
# it; ThreadRunLine is the chat surface a run renders, and it reads this frame.


def _workflow_frame(client, mock_asyncpg_pool, mock_execute_result, latest_row, *,
                    profile_row=None):
    from unittest.mock import AsyncMock, patch

    thread_id = uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": None}
    mock_asyncpg_pool.set_fetchrow_results(
        [
            None,  # the deep cap_paused probe
            latest_row,  # the thread's latest workflow run (ARM B)
            {"definition": DEFINITION},  # the definition join
            profile_row,  # the caller's display name (only read for an app origin)
        ]
    )
    mock_asyncpg_pool.set_fetch_results(
        [[{"slug": "research", "phase_index": 0, "status": "cancelled", "started_at": None,
           "completed_at": None, "output": {}}], []]
    )
    with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), patch(
        "app.dependencies.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)
    ):
        resp = client.get(f"/threads/{thread_id}/workflow")
    assert resp.status_code == 200, resp.text
    return resp.json()


def _latest(**origin):
    return {"id": uuid.uuid4(), "status": "cancelled", "created_at": None, "updated_at": None,
            **origin}


def test_thread_frame_carries_a_key_origin(client, mock_asyncpg_pool, mock_execute_result):
    body = _workflow_frame(client, mock_asyncpg_pool, mock_execute_result,
                           _latest(origin_kind="key", origin_label="n8n-prod"))
    assert body["origin"] == {"kind": "key", "label": "n8n-prod", "actor_name": None}


def test_thread_frame_app_origin_names_the_caller(client, mock_asyncpg_pool,
                                                   mock_execute_result):
    body = _workflow_frame(client, mock_asyncpg_pool, mock_execute_result,
                           _latest(origin_kind="app", origin_label=None),
                           profile_row={"display_name": OWNER_NAME})
    assert body["origin"] == {"kind": "app", "label": None, "actor_name": OWNER_NAME}


def test_thread_frame_unrecorded_origin_is_null(client, mock_asyncpg_pool, mock_execute_result):
    body = _workflow_frame(client, mock_asyncpg_pool, mock_execute_result,
                           _latest(origin_kind=None, origin_label=None))
    assert body["origin"] is None


def test_thread_frame_selects_the_origin_columns_on_both_arms():
    from pathlib import Path

    src = (Path(__file__).resolve().parents[2] / "app/api/threads.py").read_text(encoding="utf-8")
    src = src.replace("\r\n", "\n")
    assert '"SELECT id, status, created_at, updated_at, origin_kind, origin_label FROM workflow_runs' in src
    assert "wr.origin_kind," in src and "wr.origin_label," in src


def test_thread_workflow_state_declares_origin():
    from app.models.thread import ThreadWorkflowState

    assert "origin" in ThreadWorkflowState.model_fields
    assert ThreadWorkflowState.model_fields["origin"].default is None
