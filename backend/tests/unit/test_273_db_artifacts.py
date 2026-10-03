"""Phase 273-01 — db/artifacts.py against a fake asyncpg pool (Pitfall 11, UI-D-03, Pattern 4, T-273-08).

⛔ The pool connects as ``postgres`` and BYPASSES RLS, so every read here must bind the thread AND
the user. These tests record the SQL and the bound args of every call and assert both.
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from uuid import UUID, uuid4

import asyncpg
import pytest

from app.db import artifacts as dba

THREAD = UUID("5b1f6c2e-8a47-4d3b-9e0f-2c7a1d9b4e63")
USER = UUID("0f3a9c71-2b6e-4f18-a5d4-7e8b9c0d1a2f")
ORG = UUID("c4e2a817-6d09-4b5f-8a3e-91f0b7d2c654")
RUN = UUID("9d7e3b21-4c58-4a6f-b0e2-1f8c6a3d5b79")

SPEC = {"title": "Revenue", "columns": [{"name": "q", "type": "string", "unit": None}],
        "rows": [["Q1"]], "chart": None, "metric": None}
CAPTION = {"row_count": 1, "sources": [], "source_count": 0, "lineage": None}


class _Tx:
    def __init__(self, conn):
        self.conn = conn

    async def __aenter__(self):
        self.conn.log.append(("BEGIN", ()))
        return self

    async def __aexit__(self, exc_type, *_):
        self.conn.log.append(("ROLLBACK" if exc_type else "COMMIT", ()))
        return False


class _Conn:
    def __init__(self, pool):
        self.pool = pool
        self.log = pool.log

    def transaction(self):
        return _Tx(self)

    async def execute(self, sql, *args):
        self.log.append((sql, args))
        return "SELECT 1"

    async def fetchval(self, sql, *args):
        self.log.append((sql, args))
        return self.pool.next_ordinal

    async def fetchrow(self, sql, *args):
        self.log.append((sql, args))
        if self.pool.fail_inserts:
            self.pool.fail_inserts -= 1
            exc = asyncpg.exceptions.UniqueViolationError("duplicate key")
            exc.constraint_name = self.pool.fail_constraint
            raise exc
        return self.pool.row_for(sql, args)

    async def fetch(self, sql, *args):
        self.log.append((sql, args))
        return self.pool.fetch_rows


class _Acquire:
    def __init__(self, pool):
        self.pool = pool

    async def __aenter__(self):
        return _Conn(self.pool)

    async def __aexit__(self, *_):
        return False


class FakePool:
    def __init__(self):
        self.log: list[tuple[str, tuple]] = []
        self.next_ordinal = 3
        self.fail_inserts = 0
        self.fail_constraint = "message_artifacts_pkey"
        self.fetch_rows: list[dict] = []
        self.read_row: dict | None = None

    def acquire(self):
        return _Acquire(self)

    async def fetchrow(self, sql, *args):
        self.log.append((sql, args))
        return self.read_row

    async def fetch(self, sql, *args):
        self.log.append((sql, args))
        return self.fetch_rows

    def row_for(self, sql, args):
        cols = ["id", "thread_id", "user_id", "org_id", "run_id", "tool_call_id", "parent_id",
                "label", "component", "spec", "caption", "row_count"]
        row = dict(zip(cols, args))
        row["org_id"] = row["org_id"] or ORG  # the autofill trigger
        row["spec_version"] = 1
        row["created_at"] = datetime(2026, 10, 3, 14, 22, 7, 481233, tzinfo=timezone.utc)
        return row


def _sqls(pool) -> list[str]:
    return [s for s, _ in pool.log]


async def _insert(pool, **over):
    kw = dict(thread_id=THREAD, user_id=USER, org_id=ORG, run_id=RUN, tool_call_id="call_1",
              parent_id=None, component="chart", spec=SPEC, caption=CAPTION, row_count=1)
    kw.update(over)
    return await dba.insert_artifact(pool, **kw)


# ── insert_artifact ─────────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_insert_takes_the_thread_lock_then_numbers_then_inserts_in_one_transaction():
    pool = FakePool()
    row = await _insert(pool)
    sqls = _sqls(pool)
    assert sqls[0] == "BEGIN" and sqls[-1] == "COMMIT"
    lock_i = next(i for i, s in enumerate(sqls) if "pg_advisory_xact_lock" in s)
    ord_i = next(i for i, s in enumerate(sqls) if "message_artifacts" in s and s.lstrip().upper().startswith("SELECT"))
    ins_i = next(i for i, s in enumerate(sqls) if "INSERT INTO public.message_artifacts" in s)
    assert lock_i < ord_i < ins_i
    assert pool.log[lock_i][1] == (str(THREAD),)
    ord_sql, ord_args = pool.log[ord_i]
    assert "thread_id = $1" in ord_sql and "component = $2" in ord_sql
    assert ord_args == (THREAD, "chart")
    assert row["label"] == "chart 3"
    assert "RETURNING" in pool.log[ins_i][0]


@pytest.mark.asyncio
async def test_insert_uses_placeholders_only_and_passes_jsonb_as_dicts():
    pool = FakePool()
    await _insert(pool)
    ins_sql, ins_args = next((s, a) for s, a in pool.log if "INSERT INTO" in s)
    assert "{" not in ins_sql, "no format interpolation in SQL"
    assert ins_sql.count("$") == 12
    assert isinstance(ins_args[9], dict) and ins_args[9] == SPEC
    assert isinstance(ins_args[10], dict) and ins_args[10] == CAPTION
    for s, _ in pool.log:
        assert "Revenue" not in s and str(THREAD) not in s and str(USER) not in s


@pytest.mark.asyncio
async def test_insert_returns_a_json_safe_dict():
    pool = FakePool()
    row = await _insert(pool)
    json.dumps(row)  # must not raise
    assert row["thread_id"] == str(THREAD)
    assert row["run_id"] == str(RUN)
    assert row["created_at"] == "2026-10-03T14:22:07.481233+00:00"
    assert row["spec"] == SPEC
    assert row["id"].startswith("a_") and len(row["id"]) == 12


@pytest.mark.asyncio
async def test_insert_without_org_passes_none_so_the_trigger_fills_it():
    pool = FakePool()
    row = await _insert(pool, org_id=None, run_id=None)
    _, ins_args = next((s, a) for s, a in pool.log if "INSERT INTO" in s)
    assert ins_args[3] is None
    assert row["org_id"] == str(ORG)
    assert row["run_id"] is None


@pytest.mark.asyncio
async def test_generated_ids_match_the_wire_pattern():
    ids = {dba.new_artifact_id() for _ in range(200)}
    assert len(ids) == 200
    from app.models.artifact import ARTIFACT_ID_RE
    assert all(ARTIFACT_ID_RE.fullmatch(i) for i in ids)


@pytest.mark.asyncio
async def test_pk_collision_retries_once_with_a_new_id():
    pool = FakePool()
    pool.fail_inserts = 1
    row = await _insert(pool)
    inserts = [a for s, a in pool.log if "INSERT INTO" in s]
    assert len(inserts) == 2
    assert inserts[0][0] != inserts[1][0]
    assert row["id"] == inserts[1][0]


@pytest.mark.asyncio
async def test_pk_collision_twice_raises():
    pool = FakePool()
    pool.fail_inserts = 2
    with pytest.raises(asyncpg.exceptions.UniqueViolationError):
        await _insert(pool)


@pytest.mark.asyncio
async def test_a_label_collision_is_not_retried():
    pool = FakePool()
    pool.fail_inserts = 1
    pool.fail_constraint = "message_artifacts_thread_label_key"
    with pytest.raises(asyncpg.exceptions.UniqueViolationError):
        await _insert(pool)
    assert len([s for s, _ in pool.log if "INSERT INTO" in s]) == 1


@pytest.mark.asyncio
async def test_insert_rejects_an_unknown_component_before_any_query():
    pool = FakePool()
    with pytest.raises(ValueError):
        await _insert(pool, component="pie")
    assert pool.log == []


# ── get_artifact_by_ref (Pitfall 11 / 12) ───────────────────────────────────────────────────────


@pytest.mark.asyncio
@pytest.mark.parametrize("ref", ["a_k3j9x0p2qd", "chart 1", "Chart 1", " table 12 ", "A_K3J9X0P2QD"])
async def test_get_by_ref_binds_ref_thread_and_user(ref):
    pool = FakePool()
    pool.read_row = {"id": "a_k3j9x0p2qd", "thread_id": THREAD, "label": "chart 1",
                     "created_at": datetime(2026, 10, 3, tzinfo=timezone.utc)}
    row = await dba.get_artifact_by_ref(pool, ref=ref, thread_id=THREAD, user_id=USER)
    assert row["thread_id"] == str(THREAD)
    (sql, args), = pool.log
    assert "(id = $1 OR label = $1) AND thread_id = $2 AND user_id = $3" in sql
    assert args == (ref.strip().lower(), THREAD, USER)
    assert "{" not in sql


@pytest.mark.asyncio
@pytest.mark.parametrize("ref", ["", "a_short", "chart", "chart 0", "pie 1", "1; DROP TABLE x", None, 7,
                                 "a_k3j9x0p2qd'--", "chart 1 OR 1=1"])
async def test_malformed_ref_returns_none_without_a_query(ref):
    pool = FakePool()
    assert await dba.get_artifact_by_ref(pool, ref=ref, thread_id=THREAD, user_id=USER) is None
    assert pool.log == []


@pytest.mark.asyncio
async def test_get_by_ref_returns_none_when_no_row():
    pool = FakePool()
    assert await dba.get_artifact_by_ref(pool, ref="chart 9", thread_id=THREAD, user_id=USER) is None


# ── list_thread_labels ──────────────────────────────────────────────────────────────────────────


@pytest.mark.asyncio
async def test_list_thread_labels_binds_thread_and_user_in_creation_order():
    pool = FakePool()
    pool.fetch_rows = [{"label": "chart 1"}, {"label": "table 1"}, {"label": "chart 2"}]
    labels = await dba.list_thread_labels(pool, thread_id=THREAD, user_id=USER)
    assert labels == ["chart 1", "table 1", "chart 2"]
    (sql, args), = pool.log
    assert "thread_id = $1 AND user_id = $2" in sql
    assert "ORDER BY created_at" in sql
    assert args == (THREAD, USER)


# ── module hygiene ──────────────────────────────────────────────────────────────────────────────


def test_module_has_no_update_and_no_formatted_sql():
    from pathlib import Path
    src = Path(dba.__file__).read_text(encoding="utf-8")
    code = "\n".join(line.split("#", 1)[0] for line in src.splitlines())
    assert "UPDATE " not in code.upper().replace("NO UPDATE", "")
    assert ".format(" not in code
    assert 'f"""' not in code and "f'''" not in code


def test_tool_context_gains_turn_tool_calls_defaulting_to_none():
    from app.services.tool_dispatcher import ToolContext
    import dataclasses
    names = [f.name for f in dataclasses.fields(ToolContext)]
    assert names.index("turn_tool_calls") == names.index("empty_filter_fields_in_run") + 1
    ctx = ToolContext(redis=None, run_id=uuid4(), thread_id="t", supabase=None, pool=None,
                      user_settings=None, current_user={"id": "u"}, folder_subtree_ids=None,
                      scoped_folder_path=None, emit=None, spawn=None)
    assert ctx.turn_tool_calls is None
