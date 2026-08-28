"""Phase 214 plan 16 (STEP-02 / D-214-04) — THE LAUNCH-INPUTS WIRE, DRIVEN END TO END.

⚠ **A HANDED-IN DICT PROVES NOTHING ABOUT A WIRE.** Plan ``214-14``'s S-5 case passes
``run_inputs`` straight to ``resolve_arguments`` in-process — the launcher's half supplied by
the test rather than by the product — and it is GREEN over a hole where the value never left
the browser. Phase 204 is the recorded precedent for that shape: one plan wrote
``workflow_runs.inputs``, another read ``workflow_runs.metadata``, the read failed open
SILENTLY, and **106 tests were green**. Phase 212's D-1 / D-2 is the same finding one level
up: a test that MOCKS THE THING UNDER TEST proves only that the caller is self-consistent.

So every case below drives the REAL ``POST /threads/{id}/messages`` through the ASGI app and
reads ``workflow_runs.inputs`` back **out of Postgres**. Nothing on the path under test is
patched, and that is asserted mechanically rather than promised (case 1).

WHAT IS FAKED, AND WHY EACH IS OFF THE PATH:

  * Supabase (``get_supabase`` / ``get_user_supabase_client``) — the thread-ownership SELECT,
    the definition resolve and the user-message INSERT. PostgREST is not the wire this plan
    builds; the run's ``inputs`` jsonb is written by ``create_workflow_run`` on the REAL
    asyncpg pool, which is not faked.
  * Redis — ``register_run_start``'s two best-effort mirror ZADDs. Not on the inputs path.
  * ``run_producer.run_producer`` — the detached producer task, which would drive a real LLM
    run. The row this suite reads is created BEFORE the spawn (the two-rows ordering), so
    stubbing the producer removes an LLM call without removing a single step of the wire.

⚠ **THE ROWS ARE REAL AND THEY ARE CLEANED UP.** Every case seeds its own
``auth.users`` + ``threads`` under generated ids and deletes them FK-safely; the definition
FK target is an EXISTING published row, read never written. The last case asserts the
``workflow_runs`` count returned to the baseline captured at import. The operator's local
database is not a fixture.

Skips cleanly (never errors) when local Postgres :54322 is unreachable.
"""
from __future__ import annotations

import ast
import asyncio
import io
import json
import os
import pathlib
from types import SimpleNamespace
from unittest.mock import patch
from uuid import UUID, uuid4

import asyncpg
import httpx
import pytest
import pytest_asyncio
from httpx import ASGITransport

from app.dependencies import get_current_user, get_redis, get_supabase, get_user_supabase_client
from app.main import app
from app.models.message import MessageCreate


_POSTGRES_TEST_DSN = os.environ.get(
    "POSTGRES_DSN",
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
)


async def _pg_reachable(dsn: str = _POSTGRES_TEST_DSN) -> bool:
    try:
        conn = await asyncio.wait_for(asyncpg.connect(dsn), timeout=2.0)
        await conn.close()
        return True
    except Exception:  # noqa: BLE001 — a probe never raises
        return False


def _sync(coro_factory):
    """Run one coroutine on a throwaway loop — the collection-time probe idiom."""
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro_factory())
        finally:
            loop.close()
    except Exception:  # noqa: BLE001
        return None


PG_AVAILABLE = bool(_sync(_pg_reachable))
pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping the 214 wire suite",
)


async def _collect_baseline():
    conn = await asyncpg.connect(_POSTGRES_TEST_DSN)
    try:
        return await conn.fetchval("SELECT count(*) FROM workflow_runs")
    finally:
        await conn.close()


# The row count BEFORE a single case ran. The last case asserts we gave it back.
BASELINE_RUN_COUNT = _sync(_collect_baseline) if PG_AVAILABLE else None


# ──────────────────────────────────────────────────────────────────────────────
# Reading the jsonb back — and the trap that makes a naive read lie
# ──────────────────────────────────────────────────────────────────────────────

def decode_inputs(raw):
    """``workflow_runs.inputs`` as a dict, whatever shape the column is really in.

    ⚠ MEASURED, NOT ASSUMED. ``db/workflows.py``'s own docblock records it against the live
    database: ``jsonb_typeof(inputs)`` reads ``string`` on **230 of 230** rows, because
    ``create_workflow_run`` hands ``json.dumps(inputs)`` to a pool whose ``init`` hook already
    installs a ``jsonb`` codec with ``encoder=json.dumps`` — so the value is dumped TWICE and
    lands as a jsonb STRING SCALAR holding the JSON text.

    A read that stopped at the first ``json.loads`` would therefore hand back a ``str`` and
    every ``in`` assertion below would be a substring test that passes for the wrong reason —
    ``"to" in '{"to": "a@example.test"}'`` is ``True``. That is why this unwraps to a **dict**
    and the caller asserts the type. It also means this suite keeps working on the day the
    double-dump is fixed: one fewer round, same answer.
    """
    value = raw
    for _ in range(4):
        if isinstance(value, dict):
            return value
        if isinstance(value, (bytes, bytearray)):
            value = value.decode("utf-8")
        if isinstance(value, str):
            value = json.loads(value)
            continue
        break
    raise AssertionError(f"workflow_runs.inputs did not unwrap to a dict: {type(raw)!r} {raw!r}")


# ──────────────────────────────────────────────────────────────────────────────
# Fixtures — a REAL pool, a REAL user/thread, an EXISTING definition as FK target
# ──────────────────────────────────────────────────────────────────────────────

@pytest_asyncio.fixture
async def pg_pool():
    """Function-scoped raw pool — NO jsonb codec, deliberately.

    The app's own pool installs one (``dependencies._init_pg_connection``); this one does not,
    so the value read back here is the column's LITERAL text and ``decode_inputs`` can say
    honestly what shape it is in. Function scope is required: asyncpg pools are loop-bound and
    pytest-asyncio builds a fresh loop per test.
    """
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def seeded(pg_pool):
    """A throwaway owner + thread, and the id of an EXISTING published definition.

    The definition is read, never written: ``create_workflow_run``'s ``definition_id`` FKs to
    ``workflow_definitions(id)``, and the parsed definition the route actually runs on comes
    from the faked PostgREST resolve — so the row only has to EXIST. Writing one would mean
    inventing an ``org_id`` and leaving a second kind of litter.
    """
    user_id, thread_id = uuid4(), uuid4()
    def_id = await pg_pool.fetchval(
        "SELECT id FROM workflow_definitions WHERE status = 'published' LIMIT 1"
    )
    if def_id is None:
        pytest.skip("no published workflow_definitions row present to use as an FK target")
    try:
        await pg_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-214-16-{user_id}@test.local",
        )
        await pg_pool.execute(
            "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
            thread_id, user_id, "phase 214-16 wire thread",
        )
    except Exception as exc:  # noqa: BLE001
        pytest.skip(f"seed failed: {type(exc).__name__}: {exc}")

    yield SimpleNamespace(user_id=user_id, thread_id=thread_id, definition_id=def_id)

    for sql in (
        ("DELETE FROM harness_audit WHERE user_id = $1", user_id),
        ("DELETE FROM workflow_phases WHERE workflow_run_id IN "
         "(SELECT id FROM workflow_runs WHERE thread_id = $1)", thread_id),
        ("UPDATE threads SET active_workflow_run_id = NULL WHERE id = $1", thread_id),
        ("DELETE FROM workflow_runs WHERE thread_id = $1", thread_id),
        ("DELETE FROM runs WHERE thread_id = $1", thread_id),
        ("DELETE FROM messages WHERE thread_id = $1", thread_id),
        ("DELETE FROM threads WHERE id = $1", thread_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await pg_pool.execute(*sql)
        except Exception:  # noqa: BLE001 — teardown is best-effort, FK-ordered
            pass


# ──────────────────────────────────────────────────────────────────────────────
# The fakes — PostgREST + Redis, and nothing else
# ──────────────────────────────────────────────────────────────────────────────

class _Result:
    def __init__(self, data):
        self.data = data


class _Builder:
    """A postgrest-py query builder stand-in: chainable, table-aware, single-aware."""

    def __init__(self, table, rows):
        self._table, self._rows = table, rows
        self._op, self._payload, self._single = None, None, False

    def select(self, *_a, **_k):
        self._op = "select"
        return self

    def insert(self, row, *_a, **_k):
        self._op, self._payload = "insert", row
        return self

    def update(self, row, *_a, **_k):
        self._op, self._payload = "update", row
        return self

    def upsert(self, row, *_a, **_k):
        self._op, self._payload = "upsert", row
        return self

    def delete(self, *_a, **_k):
        self._op = "delete"
        return self

    def single(self):
        self._single = True
        return self

    def maybe_single(self):
        self._single = True
        return self

    def __getattr__(self, _name):
        # eq / neq / or_ / in_ / is_ / order / limit / gte / lt / range — all no-op filters.
        def _chain(*_a, **_k):
            return self
        return _chain

    def execute(self):
        if self._op in ("insert", "upsert"):
            row = dict(self._payload or {})
            row.setdefault("id", str(uuid4()))
            return _Result(row if self._single else [row])
        if self._op in ("update", "delete"):
            return _Result([])
        rows = self._rows.get(self._table)
        if rows is None:
            return _Result(None if self._single else [])
        return _Result(rows if self._single else [rows])


class _FakeSupabase:
    def __init__(self, rows):
        self._rows = rows

    def table(self, name):
        return _Builder(name, self._rows)

    def rpc(self, *_a, **_k):
        return _Builder("__rpc__", {})


class _FakeRedis:
    """Records; never raises. ``register_run_start``'s mirror ZADDs are best-effort anyway."""

    def __init__(self):
        self.calls = []

    def __getattr__(self, name):
        async def _op(*a, **k):
            self.calls.append((name, a, k))
            return 0
        return _op


def _definition_json(*, slug="p214_wire", with_external_action=False):
    """A minimal parseable published definition. UNBOUND (no project_folder_id) and
    skill-free, so the 098 scope assert and the 099 snapshot materializer are both no-ops."""
    phases = [{
        "slug": "step_one",
        "phase_index": 0,
        "config": {"phase_type": "llm_single", "prompt": "say hello"},
    }]
    if with_external_action:
        phases.append({
            "slug": "notify",
            "phase_index": 1,
            "config": {
                "phase_type": "external_action",
                "capability": "send_email",
                "arg_sources": {"to": {"source": "ask"}},
            },
        })
    return {
        "slug": slug,
        "version": 1,
        "name": "Phase 214-16 wire",
        "status": "published",
        "phases": phases,
    }


def _rows_for(seeded, *, definition=None):
    return {
        "threads": {
            "id": str(seeded.thread_id),
            "active_workflow_run_id": None,
            "folder_id": None,
            # NOT "New Chat" — so maybe_autotitle_thread no-ops and no title model is called.
            "title": "phase 214-16 wire thread",
        },
        "workflow_definitions": {
            "id": str(seeded.definition_id),
            "definition": definition or _definition_json(),
            "status": "published",
            "is_system_global": False,
            "created_by": str(seeded.user_id),
            "skill_snapshots": None,
        },
    }


class _Wired:
    """Installs the dependency overrides + the producer stub, and takes them back down."""

    def __init__(self, seeded, *, definition=None):
        self.seeded, self.definition = seeded, definition
        self.redis = _FakeRedis()
        self._patch = None

    def __enter__(self):
        sb = _FakeSupabase(_rows_for(self.seeded, definition=self.definition))
        app.dependency_overrides[get_current_user] = lambda: {"id": str(self.seeded.user_id)}
        app.dependency_overrides[get_supabase] = lambda: sb
        app.dependency_overrides[get_user_supabase_client] = lambda: sb
        app.dependency_overrides[get_redis] = lambda: self.redis

        async def _no_producer(*_a, **_k):
            return None

        # The DETACHED producer only — it runs AFTER create_workflow_run (the two-rows
        # ordering), so this removes an LLM call and no step of the wire under test.
        self._patch = patch("app.services.run_producer.run_producer", _no_producer)
        self._patch.start()
        return self

    def __exit__(self, *_exc):
        self._patch.stop()
        for dep in (get_current_user, get_supabase, get_user_supabase_client, get_redis):
            app.dependency_overrides.pop(dep, None)
        return False


async def _post(seeded, payload):
    async with httpx.AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as client:
        return await client.post(
            f"/threads/{seeded.thread_id}/messages",
            headers={"Authorization": "Bearer test-token"},
            json=payload,
        )


async def _run_inputs_for_thread(pg_pool, thread_id):
    raw = await pg_pool.fetchval(
        "SELECT inputs FROM workflow_runs WHERE thread_id = $1 ORDER BY created_at DESC LIMIT 1",
        thread_id,
    )
    assert raw is not None, "no workflow_runs row was created for this thread"
    return decode_inputs(raw)


# ══════════════════════════════════════════════════════════════════════════════
# 1 — the self-check: nothing on the path under test is patched
# ══════════════════════════════════════════════════════════════════════════════

FORBIDDEN_PATCH_TARGETS = (
    "create_workflow_run",
    "build_harness_run_context",
    "_external_action_inputs",
    "send_message",
)


def _patched_names(source: str) -> list[str]:
    """Every string literal handed to a ``patch(...)`` call, via the AST.

    ⚠ AST, NOT GREP, AND FOR A REASON THIS PROJECT HAS MEASURED SIX TIMES. This module's own
    prose names all four functions — it has to, they are the thing being forbidden — so a
    text search would count the paragraph that states the rule and the fence would report its
    own documentation as the violation (the 187-24 trap). A comment and a docstring are not
    ``Call`` nodes, so an AST walk structurally cannot see them.
    """
    found: list[str] = []
    for node in ast.walk(ast.parse(source)):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        name = func.attr if isinstance(func, ast.Attribute) else getattr(func, "id", None)
        if name not in ("patch", "patch_object"):
            continue
        for arg in list(node.args) + [kw.value for kw in node.keywords]:
            if isinstance(arg, ast.Constant) and isinstance(arg.value, str):
                found.append(arg.value)
    return found


def test_SELF_CHECK_this_suite_patches_nothing_on_the_wire():
    source = io.open(__file__, encoding="utf-8").read()
    patched = _patched_names(source)
    # Non-vacuity FIRST: the walk really found this module's one patch target.
    assert patched, "the AST walk found no patch() targets at all — the detector is broken"
    offenders = [t for t in patched if any(f in t for f in FORBIDDEN_PATCH_TARGETS)]
    assert offenders == [], f"a wire function is patched in this suite: {offenders}"
    # …and the four names ARE present in this file as prose, which is exactly why the
    # detector had to be an AST walk rather than a grep. Stated, not left to be inferred.
    assert all(name in source for name in FORBIDDEN_PATCH_TARGETS)


def test_SELF_CHECK_CONTROL_the_detector_sees_a_planted_patch_and_spares_prose():
    planted = (
        '"""A docstring naming create_workflow_run and build_harness_run_context."""\n'
        "# a comment naming _external_action_inputs\n"
        'with patch("app.db.workflows.create_workflow_run"):\n'
        "    pass\n"
    )
    names = _patched_names(planted)
    assert names == ["app.db.workflows.create_workflow_run"]
    assert [t for t in names if any(f in t for f in FORBIDDEN_PATCH_TARGETS)]
    # The prose-only half is invisible to the detector, which is the property that keeps
    # this suite's own documentation from failing it.
    prose_only = planted.split("with patch")[0] + "pass\n"
    assert _patched_names(prose_only) == []


# ══════════════════════════════════════════════════════════════════════════════
# 2 — THE WIRE CASE
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_WIRE_declared_values_land_in_workflow_runs_inputs(pg_pool, seeded):
    """A real POST carrying ``inputs`` puts those keys in the run's durable jsonb.

    ⚠ THE RESPONSE BODY IS NOT THE ASSERTION AND MUST NOT BECOME ONE. The POST answers
    ``{message_id, run_id, model, provider}`` — it does not carry the run's inputs — so a
    test that read the response would be asserting on a value it supplied itself. The row is
    the only witness that the value crossed the process boundary.
    """
    with _Wired(seeded):
        resp = await _post(seeded, {
            "content": "send the renewal summary",
            "workflow_definition_id": str(seeded.definition_id),
            "inputs": {"to": "a@example.test", "subject": "S"},
        })
    assert resp.status_code == 201, f"{resp.status_code}: {resp.text[:400]}"

    stored = await _run_inputs_for_thread(pg_pool, seeded.thread_id)
    assert isinstance(stored, dict), "the jsonb did not unwrap to an object — see decode_inputs"
    assert stored["to"] == "a@example.test"
    assert stored["subject"] == "S"
    # …alongside the reserved scaffolding, which the merge never displaces.
    assert stored["kickoff_prompt"] == "send the renewal summary"


# ══════════════════════════════════════════════════════════════════════════════
# 3 — THE BYTE-IDENTICAL ARM
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_BYTE_IDENTICAL_an_absent_map_stores_the_pre_214_literal(pg_pool, seeded):
    """No ``inputs`` on the POST → the dict is DEEP-EQUAL to the pre-change literal.

    Asserted as an equality against a literal, never as a subset: a subset match cannot see
    an ADDED key, and an added key is the whole regression this arm exists to catch.
    """
    with _Wired(seeded):
        resp = await _post(seeded, {
            "content": "no declared inputs here",
            "workflow_definition_id": str(seeded.definition_id),
        })
    assert resp.status_code == 201, f"{resp.status_code}: {resp.text[:400]}"

    stored = await _run_inputs_for_thread(pg_pool, seeded.thread_id)
    assert stored == {"kickoff_prompt": "no declared inputs here"}


@pytest.mark.asyncio
async def test_BYTE_IDENTICAL_an_empty_map_is_the_same_dict(pg_pool, seeded):
    """``inputs: {}`` is indistinguishable from absent, on the server as on the client.

    The merge spreads ``body.inputs or {}``, so absent and empty produce the SAME dict — which
    is precisely why the client is allowed to send neither.
    """
    with _Wired(seeded):
        resp = await _post(seeded, {
            "content": "empty map",
            "workflow_definition_id": str(seeded.definition_id),
            "inputs": {},
        })
    assert resp.status_code == 201, f"{resp.status_code}: {resp.text[:400]}"

    stored = await _run_inputs_for_thread(pg_pool, seeded.thread_id)
    assert stored == {"kickoff_prompt": "empty map"}


# ══════════════════════════════════════════════════════════════════════════════
# 4 — THE PRECEDENCE ARM
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_PRECEDENCE_reserved_keys_win_over_a_launcher_key(pg_pool, seeded):
    """A launcher may not impersonate ``kickoff_prompt`` or ``folder_id``.

    ⚠ THIS CASE FOUND A REAL DEFECT AND IS THE REASON THE MERGE STRIPS RATHER THAN
    OUT-RANKS. "The reserved keys are spread LAST and therefore win" is only true when they
    are PRESENT, and ``folder_id`` is spread conditionally — so on the first run of this case
    the stored dict was
    ``{'folder_id': '1111…', 'kickoff_prompt': 'the real kickoff', 'to': 'b@example.test'}``
    and the launcher's value had survived untouched. ``workflow_runs.inputs['folder_id']`` is
    read back as the per-run retrieval override on the resume/Continue path, so the request
    below is the one that has no reserved value to lose the race to.
    """
    with _Wired(seeded):
        resp = await _post(seeded, {
            "content": "the real kickoff",
            "workflow_definition_id": str(seeded.definition_id),
            "inputs": {
                "kickoff_prompt": "IMPERSONATED",
                "folder_id": "11111111-1111-1111-1111-111111111111",
                "to": "b@example.test",
            },
        })
    assert resp.status_code == 201, f"{resp.status_code}: {resp.text[:400]}"

    stored = await _run_inputs_for_thread(pg_pool, seeded.thread_id)
    assert stored["kickoff_prompt"] == "the real kickoff"
    # No folder override was requested, so the reserved key must be ABSENT ENTIRELY — not
    # merely different from the launcher's string. Absence is the assertion; a value here of
    # any provenance would be a second door into an owner-gated field.
    assert "folder_id" not in stored, stored
    # The author's own declared key is untouched by the precedence rule.
    assert stored["to"] == "b@example.test"


@pytest.mark.asyncio
async def test_PRECEDENCE_neither_reserved_key_reaches_an_adapter_argument(pg_pool, seeded):
    """Exercised through the REAL consumers, not quoted from their comments.

    ⚠ TWO DIFFERENT MECHANISMS, AND CONFLATING THEM WOULD BE THE EASY MISTAKE:

      * ``kickoff_prompt`` is dropped by ``_external_action_inputs`` BY NAME
        (``_NON_ACTION_RUN_INPUTS``) — a closed, named frozenset, never a heuristic.
      * ``folder_id`` is NOT in that frozenset and DOES survive into the resolved bag. It
        never reaches a vendor because ``resolve_arguments`` walks the SCHEMA'S DECLARED
        properties and drops everything undeclared. Both are asserted, separately.
    """
    from app.services.connectors.args import resolve_arguments
    from app.services.harness.phase_types import _NON_ACTION_RUN_INPUTS, _external_action_inputs

    with _Wired(seeded):
        resp = await _post(seeded, {
            "content": "kick",
            "workflow_definition_id": str(seeded.definition_id),
            "inputs": {"kickoff_prompt": "IMPERSONATED", "folder_id": "not-a-folder",
                       "to": "c@example.test"},
        })
    assert resp.status_code == 201, f"{resp.status_code}: {resp.text[:400]}"
    stored = await _run_inputs_for_thread(pg_pool, seeded.thread_id)

    # Neither reserved key is even in the bag any more — they are stripped at the merge.
    assert "kickoff_prompt" in stored and "folder_id" not in stored

    resolved = _external_action_inputs({}, SimpleNamespace(inputs=stored))
    assert "kickoff_prompt" in _NON_ACTION_RUN_INPUTS
    assert "kickoff_prompt" not in resolved, "run scaffolding leaked into the action inputs"
    assert resolved["to"] == "c@example.test"

    # ⚠ THE SECOND MECHANISM, DRIVEN SEPARATELY. `folder_id` is NOT in the frozenset, so if
    # one ever reached the bag it would survive `_external_action_inputs`. What stops it is
    # the schema projection below — asserted over a bag that DOES carry it, so the claim is
    # exercised rather than made vacuous by the strip above.
    assert "folder_id" not in _NON_ACTION_RUN_INPUTS
    leaky = _external_action_inputs({}, SimpleNamespace(inputs={**stored, "folder_id": "x"}))
    assert leaky["folder_id"] == "x"  # it survives the frozenset…

    args = resolve_arguments(
        config={"arg_sources": {"to": {"source": "ask"}}, "tool_args": {}},
        schema={"properties": {"to": {"type": "string"}}},
        upstream_outputs={},
        run_inputs=leaky,
    )
    # …and dies here, because the walk is over the schema's DECLARED properties.
    assert args == {"to": "c@example.test"}, "an undeclared key reached the argument object"


# ══════════════════════════════════════════════════════════════════════════════
# 5 — THE MIRROR CASE (the fifth file no plan owned)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_MIRROR_live_ctx_inputs_equals_the_persisted_row(pg_pool, seeded):
    """``build_harness_run_context``'s ``ctx.inputs`` == the row ``create_workflow_run`` wrote.

    ⚠ THIS IS THE ONLY ASSERTION IN THE PHASE THAT COMPARES THE TWO LITERALS. The F8 comment
    in ``workflow_kickoff.py`` has claimed *"mirror EXACTLY what was persisted"* since Phase
    092 and nothing checked it. Widening only the persisted copy would leave a workflow's
    FIRST, LIVE run resolving every ``ask`` argument to nothing while a RESUMED run — which
    rebuilds its inputs from this same jsonb (``runs.py``) — resolved them all: a defect that
    reproduces only on a resume, and that no unit test in this phase would look for.

    ⚠ The case is only meaningful once ONE side is widened; before this plan both literals
    dropped the declared keys and agreed trivially. It was therefore driven with
    ``workflow_kickoff.py`` reverted to its base text, and it FAILED — recorded in the summary.
    """
    from app.services import workflow_kickoff
    from app.models.user_settings import load_user_settings

    payload = {
        "content": "mirror me",
        "workflow_definition_id": str(seeded.definition_id),
        "inputs": {"to": "d@example.test", "subject": "Mirror"},
    }
    with _Wired(seeded) as wired:
        resp = await _post(seeded, payload)
        assert resp.status_code == 201, f"{resp.status_code}: {resp.text[:400]}"
        run_id = await pg_pool.fetchval(
            "SELECT id FROM workflow_runs WHERE thread_id = $1 "
            "ORDER BY created_at DESC LIMIT 1", seeded.thread_id,
        )
        stored = await _run_inputs_for_thread(pg_pool, seeded.thread_id)

        # The SAME request body the route just ran, through the REAL context builder.
        from app.models.harness import WorkflowDefinition
        definition = WorkflowDefinition.model_validate(_definition_json())

        async def _emit(*_a, **_k):
            return None

        ctx = await workflow_kickoff.build_harness_run_context(
            active_workflow_run_id=run_id,
            producer_run_id=uuid4(),
            kickoff_definition=definition,
            thread_id=str(seeded.thread_id),
            body=MessageCreate(**payload),
            current_user={"id": str(seeded.user_id)},
            user_settings=load_user_settings(str(seeded.user_id)),
            supabase=_FakeSupabase(_rows_for(seeded)),
            redis=wired.redis,
            pool=pg_pool,
            harness_emit=_emit,
            spawn=None,
        )

    assert ctx.inputs == stored, (
        "the LIVE ctx.inputs and the PERSISTED workflow_runs.inputs disagree — "
        f"live={ctx.inputs!r} persisted={stored!r}"
    )
    # Non-vacuity: two empty dicts would also be equal.
    assert ctx.inputs["to"] == "d@example.test"
    assert ctx.inputs["kickoff_prompt"] == "mirror me"


# ══════════════════════════════════════════════════════════════════════════════
# 6 — THE END-TO-END ARM (run inputs sourced from the DB, never from a literal)
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_END_TO_END_the_ask_argument_resolves_from_the_database_read(pg_pool, seeded):
    """A ``send_email`` step declaring ``to`` as ``ask`` gets its recipient.

    ⚠ ``run_inputs`` COMES FROM THE ROW, never from a Python literal. That single sourcing
    choice is the whole difference between this case and ``214-14``'s S-5, which supplies the
    launcher's half itself and is green over the hole this plan fills.
    """
    from app.services.connectors.args import resolve_arguments

    with _Wired(seeded, definition=_definition_json(with_external_action=True)):
        resp = await _post(seeded, {
            "content": "email the summary",
            "workflow_definition_id": str(seeded.definition_id),
            "inputs": {"to": "recipient@example.test"},
        })
    assert resp.status_code == 201, f"{resp.status_code}: {resp.text[:400]}"

    run_inputs = await _run_inputs_for_thread(pg_pool, seeded.thread_id)
    config = {"arg_sources": {"to": {"source": "ask"}}, "tool_args": {}}
    schema = {"properties": {"to": {"type": "string"}}, "required": ["to"]}

    args = resolve_arguments(
        config=config, schema=schema, upstream_outputs={}, run_inputs=run_inputs,
    )
    assert args["to"] == "recipient@example.test"

    # ⚠ THE COUNTERFACTUAL, AND IT IS WHAT MAKES THE LINE ABOVE MEAN SOMETHING. The SAME
    # config and the SAME schema, against the pre-214 run-inputs literal, resolve to NOTHING
    # — which is `BUG-260826-01` reproduced in one call: "the 'to' recipient must be a
    # string, got NoneType". So the recipient came from the WIRE, not from the schema, not
    # from `tool_args`, and not from this test.
    pre_214 = {"kickoff_prompt": run_inputs["kickoff_prompt"]}
    assert resolve_arguments(
        config=config, schema=schema, upstream_outputs={}, run_inputs=pre_214,
    ) == {}


# ══════════════════════════════════════════════════════════════════════════════
# 7 — THE 422 ARM
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_422_a_non_string_value_is_refused_and_writes_no_run_row(pg_pool, seeded):
    """``dict[str, str]`` means a nested object never reaches the flat path — and the refusal
    happens in FastAPI validation, BEFORE the handler, so no partial row is left behind."""
    before = await pg_pool.fetchval(
        "SELECT count(*) FROM workflow_runs WHERE thread_id = $1", seeded.thread_id,
    )
    with _Wired(seeded):
        resp = await _post(seeded, {
            "content": "bad value",
            "workflow_definition_id": str(seeded.definition_id),
            "inputs": {"to": {"nested": "object"}},
        })
    assert resp.status_code == 422, f"{resp.status_code}: {resp.text[:400]}"
    after = await pg_pool.fetchval(
        "SELECT count(*) FROM workflow_runs WHERE thread_id = $1", seeded.thread_id,
    )
    assert after == before == 0, "a refused request created a workflow_runs row"


# ══════════════════════════════════════════════════════════════════════════════
# 8 — THE LITTER CHECK
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_CLEANUP_the_workflow_runs_count_returned_to_its_baseline(pg_pool):
    """Every row this suite created was its own, and every one was given back.

    ⚠ Run in isolation this is trivially true; run as a file it is the check that the
    per-case teardown actually fired. It reads the whole table on purpose — a per-thread
    count could not see a row leaked under a thread the teardown failed to delete.
    """
    assert BASELINE_RUN_COUNT is not None
    now = await pg_pool.fetchval("SELECT count(*) FROM workflow_runs")
    assert now == BASELINE_RUN_COUNT, (
        f"workflow_runs grew by {now - BASELINE_RUN_COUNT} — this suite left litter"
    )


def test_MODULE_this_file_is_where_the_plan_said_it_would_be():
    """A cheap structural anchor: the suite's own path, so a rename cannot silently orphan
    the plan's `min_lines` / `contains` artifact assertions."""
    here = pathlib.Path(__file__)
    assert here.name == "test_214_launch_inputs_wire.py"
    assert here.parent.name == "integration"
    assert isinstance(UUID(str(uuid4())), UUID)
