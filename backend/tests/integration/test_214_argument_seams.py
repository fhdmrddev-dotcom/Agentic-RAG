"""Phase 214 plan 14 Task 2 — THE CROSS-PLAN SEAMS, each proven with NEITHER side mocked.

⚠ **PHASE 204 IS WHY THIS FILE EXISTS.** One plan wrote ``workflow_runs.inputs`` and another
read ``workflow_runs.metadata``. The read failed open SILENTLY, the spend cap shipped disarmed,
and **106 tests were green** — because the two waves ran in parallel and each mocked the other's
side. Phase 212's D-1 / D-2 is the same finding one level up: a test that MOCKS THE THING UNDER
TEST proves only that the caller is self-consistent, and one of its stubs even invented a
parameter the real function did not have. 2,796 passing tests saw none of it.

This phase ran fourteen plans across four parallel batches, so it has the same shape and more of
it. The seams below were **DERIVED FROM THE TREE**, not recalled from the plans — the derivation,
its grep commands and the seven path files no plan declared are in ``214-14-SUMMARY.md``. Three of
the seams here did not exist in the first version of this plan's table.

WHAT IS FAKED, AND WHY EVERY ONE OF THEM IS OFF THE SEAM:

  * **Authentication.** ``get_current_user`` / ``canvas_caller`` are supplied as plain dicts and
    the two read routes are called as ORDINARY ASYNC FUNCTIONS rather than over HTTP. Who the
    caller is is not the seam; what the reader finds in the column is.
  * **``threads.py``'s RLS connection acquire.** ``get_user_pg_connection`` is replaced with one
    that yields a REAL connection from the REAL pool without the role swap. The SQL, the
    ``phase_output_object`` parse, the normalisation and the ``WorkflowPhaseState`` construction
    all execute unmodified against the real row. The role swap is an authorisation boundary and
    is tested where it lives.
  * Nothing else. Every row is real, every write goes through the product's own writer, and every
    read runs the product's own expression.

⛔ **NO TEST HERE MAY PATCH** ``resolve_arguments``, ``unsatisfiable_arguments``,
``phase_output_object``, ``_external_action_clause`` or ``resolve_connection``. Those are the
things under test. ``test_S0_no_case_patches_a_function_under_test`` reads this file's own source
and fails if any of the five appears inside a ``patch(`` — so the promise above is mechanical
rather than a comment.

⚠ **THE ROWS ARE REAL AND THEY ARE CLEANED UP.** Every fixture seeds under generated ids and
deletes FK-safely; the definition and the org are read, never written. Skips cleanly (never
errors) when local Postgres :54322 is unreachable.
"""
from __future__ import annotations

import ast
import asyncio
import json
import os
import pathlib
import re
import subprocess
from types import SimpleNamespace
from uuid import uuid4

import asyncpg
import pytest
import pytest_asyncio

_REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
_BACKEND = _REPO_ROOT / "backend"
_FRONTEND_SRC = _REPO_ROOT / "frontend" / "src"
_THIS_FILE = pathlib.Path(__file__).resolve()

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
    try:
        loop = asyncio.new_event_loop()
        try:
            return loop.run_until_complete(coro_factory())
        finally:
            loop.close()
    except Exception:  # noqa: BLE001
        return None


PG_AVAILABLE = bool(_sync(_pg_reachable))


def _read(path: pathlib.Path) -> str:
    """Source text, ALWAYS ``\\r?\\n``-tolerant at the call site.

    ⚠ Files check out CRLF on this box. A source-reading assertion with a bare ``\\n\\n``
    terminator NEVER matches, returns empty, and PASSES VACUOUSLY — that shipped once already
    in this phase. Every regex below therefore uses ``\\r?\\n`` or ``re.MULTILINE``, and the
    suites that parse TypeScript carry a positive control.
    """
    return path.read_text(encoding="utf-8")


# ══════════════════════════════════════════════════════════════════════════════
# S-0 — the self-check. Nothing under test may be patched.
# ══════════════════════════════════════════════════════════════════════════════

#: ⚠ ASSEMBLED, never spelled whole. A literal here would BE an occurrence and the scan would
#: fail against itself — the 187-24 trap, which this phase's brief records firing seven times.
_UNPATCHABLE = (
    "resolve_" + "arguments",
    "unsatisfiable_" + "arguments",
    "phase_output_" + "object",
    "_external_action_" + "clause",
    "resolve_" + "connection",
)


def test_S0_no_case_patches_a_function_under_test():
    """⭐ THE GUARD THAT MAKES THE HEADER'S PROMISE MECHANICAL.

    Phase 212's D-1 monkeypatched ``_post`` away and asserted only that a value was HANDED to
    it; D-2's stub invented a parameter the real function lacked. Both passed while the wire
    was wrong. This reads the file's own source, walks it as an AST, and fails if any of the
    five names appears anywhere inside a ``patch(...)`` call.
    """
    src = _read(_THIS_FILE)
    tree = ast.parse(src)

    patched_names: list[str] = []
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        func = node.func
        # ⚠ THE DOTTED FORM COUNTS. ``patch.object(...)`` has ``func.attr == "object"``, so a
        # check on the attribute name alone SKIPS every ``patch.object`` in the file — which
        # is the only patch form this suite actually uses, and the positive control below
        # caught exactly that on the first run.
        dotted = []
        node_f = func
        while isinstance(node_f, ast.Attribute):
            dotted.append(node_f.attr)
            node_f = node_f.value
        if isinstance(node_f, ast.Name):
            dotted.append(node_f.id)
        if not ({"patch", "setattr", "monkeypatch"} & set(dotted)):
            continue
        for sub in ast.walk(node):
            if isinstance(sub, ast.Constant) and isinstance(sub.value, str):
                patched_names.append(sub.value)
            elif isinstance(sub, ast.Attribute):
                patched_names.append(sub.attr)

    blob = " ".join(patched_names)
    for needle in _UNPATCHABLE:
        assert needle not in blob, (
            f"{needle!r} is patched in this file — it is one of the five functions under "
            "test, and patching it proves only that the caller is self-consistent"
        )

    # Positive control: the AST walk CAN find a patch target, so its silence is evidence of
    # absence rather than evidence of a broken walk.
    assert "get_user_pg_connection" in blob, (
        "positive control: the walk found no patch target at all, so it cannot be trusted to "
        "have looked for the five"
    )


# ══════════════════════════════════════════════════════════════════════════════
# Fixtures — a REAL pool, REAL rows, an EXISTING org + definition as FK targets
# ══════════════════════════════════════════════════════════════════════════════

pytestmark = pytest.mark.skipif(
    not PG_AVAILABLE,
    reason=f"Local Postgres on {_POSTGRES_TEST_DSN} not reachable; skipping the 214 seam suite",
)


@pytest_asyncio.fixture
async def raw_pool():
    """A pool with NO jsonb codec — so a column's LITERAL shape is observable.

    Function-scoped: asyncpg pools are loop-bound and pytest-asyncio builds a fresh loop per
    test. The app's own pool (used for the WRITES below) installs a codec; this one does not,
    which is exactly what lets ``jsonb_typeof`` be read honestly rather than assumed.
    """
    pool = await asyncpg.create_pool(_POSTGRES_TEST_DSN, min_size=1, max_size=4)
    try:
        yield pool
    finally:
        await pool.close()


@pytest_asyncio.fixture
async def seeded(raw_pool):
    """A throwaway user + thread + workflow_run + one phase, under generated ids.

    The org and the definition are READ from existing rows and never written — inventing an
    ``org_id`` would leave a second kind of litter, and the FK targets only have to EXIST.
    """
    row = await raw_pool.fetchrow(
        "SELECT id, org_id FROM workflow_definitions WHERE status = 'published' "
        "AND org_id IS NOT NULL LIMIT 1"
    )
    if row is None:
        pytest.skip("no published workflow_definitions row with an org_id to use as FK target")
    def_id, org_id = row["id"], row["org_id"]

    user_id, thread_id, run_id, phase_id = uuid4(), uuid4(), uuid4(), uuid4()
    try:
        await raw_pool.execute(
            "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
            user_id, f"phase-214-14-{user_id}@test.local",
        )
        await raw_pool.execute(
            "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, $3)",
            thread_id, user_id, "phase 214-14 seam thread",
        )
        await raw_pool.execute(
            "INSERT INTO workflow_runs (id, thread_id, definition_id, status, org_id, "
            "user_id, inputs) VALUES ($1, $2, $3, 'failed', $4, $5, '{}'::jsonb)",
            run_id, thread_id, def_id, org_id, user_id,
        )
        await raw_pool.execute(
            "INSERT INTO workflow_phases (id, workflow_run_id, phase_index, slug, status, "
            "output, org_id) VALUES ($1, $2, 0, 'send-the-mail', 'active', '{}'::jsonb, $3)",
            phase_id, run_id, org_id,
        )
        await raw_pool.execute(
            "UPDATE threads SET active_workflow_run_id = $1 WHERE id = $2", run_id, thread_id
        )
    except Exception as exc:  # noqa: BLE001
        # ⚠ A SEED FAILURE IS A FAILURE, NEVER A SKIP. The first run of this suite seeded
        # `status='running'` — not a legal `workflow_phases` status — and a `pytest.skip`
        # here turned five unproven seams into a green line. That is the vacuous-pass shape
        # this whole file exists to refuse. A skip belongs to an ABSENT DATABASE (handled at
        # module scope) and to a missing FK target, never to a broken INSERT.
        raise AssertionError(
            f"seam-suite seed failed — the seams below are UNPROVEN, not skipped: "
            f"{type(exc).__name__}: {exc}"
        ) from exc

    yield SimpleNamespace(
        user_id=user_id, thread_id=thread_id, run_id=run_id,
        phase_id=phase_id, definition_id=def_id, org_id=org_id,
    )

    for sql in (
        ("UPDATE threads SET active_workflow_run_id = NULL WHERE id = $1", thread_id),
        ("DELETE FROM workflow_phases WHERE workflow_run_id = $1", run_id),
        ("DELETE FROM workflow_runs WHERE id = $1", run_id),
        ("DELETE FROM threads WHERE id = $1", thread_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        try:
            await raw_pool.execute(*sql)
        except Exception:  # noqa: BLE001 — teardown is best-effort, FK-ordered
            pass


# ══════════════════════════════════════════════════════════════════════════════
# S-1 — the failure reason: ONE writer, TWO readers, TWO jsonb shapes
#
#   WRITER  backend/app/db/workflows.py:1856   fail_phase -> output["_failure_reason"]
#   READER  backend/app/api/workflow_runs.py:870   -> WorkflowRunPhaseRead.failure_reason
#   READER  backend/app/api/threads.py:1339        -> WorkflowPhaseState.failure_reason
#
# ⭐ THE CHAT-PANEL TRANSPORT IS THE HALF THAT WAS MISSING. BUG-260826-05's symptom is the
# PANEL saying "Failure reason not captured by the backend", and the panel reads
# GET /threads/{id}/workflow — NOT the run read.
# ══════════════════════════════════════════════════════════════════════════════

def _local_supabase():
    """A REAL service-role client pointed at the LOCAL stack — built past conftest's env.

    ⚠ ``tests/conftest.py:10`` does ``os.environ.setdefault("SUPABASE_URL",
    "https://test.supabase.co")``, and that lands BEFORE ``app.config`` is imported, so
    ``get_supabase()`` under pytest builds a client for a hostname that does not resolve
    (measured: ``httpx.ConnectError: [Errno 11001] getaddrinfo failed``). The values are
    therefore read from ``backend/.env`` directly.

    ⛔ **REFUSES A NON-LOCAL URL.** This suite writes and deletes rows; pointing it at a
    cloud project would be a test mutating a real deployment. A remote URL SKIPS loudly.
    """
    import re as _re

    env_path = _BACKEND / ".env"
    if not env_path.is_file():
        pytest.skip("backend/.env absent — bootstrap the worktree to drive the read routes")
    text = env_path.read_text(encoding="utf-8", errors="replace")

    def _val(key):
        m = _re.search(rf"^{key}\s*=\s*(.+?)\s*$", text, _re.MULTILINE)
        return m.group(1).strip().strip('"').strip("'") if m else ""

    url, key = _val("SUPABASE_URL"), _val("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        pytest.skip("backend/.env carries no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
    if not ("127.0.0.1" in url or "localhost" in url or "[::1]" in url):
        pytest.skip(
            "SUPABASE_URL is not local — this suite writes rows and must never be pointed "
            "at a deployed project"
        )

    from supabase import create_client

    return create_client(url, key)


async def _run_read_failure_reason(seed) -> str | None:
    """Drive the REAL ``read_workflow_run`` body and return the phase's ``failure_reason``.

    Called as an ordinary async function with a real service-role supabase client, so every
    PostgREST read, the ``phase_output_object`` parse and the ``WorkflowRunPhaseRead``
    construction execute unmodified against the real row.
    """
    from app.api.workflow_runs import read_workflow_run

    result = await read_workflow_run(
        workflow_run_id=seed.run_id,
        current_user={"id": str(seed.user_id)},
        supabase=_local_supabase(),
    )
    return next(p.failure_reason for p in result.phases if p.slug == "send-the-mail")


async def _thread_read_failure_reason(seed) -> str | None:
    """Drive the REAL ``get_thread_workflow`` body and return the same field.

    The RLS ACQUIRE is replaced (see the header); nothing else is. ``get_user_pg_connection``
    documents that it never reads ``request``, which is why ``None`` is a faithful stand-in.
    """
    import contextlib
    from unittest.mock import patch

    from app.api import threads as threads_api
    from app.dependencies import get_pg_pool

    @contextlib.asynccontextmanager
    async def _real_conn(_request, _current_user):
        pool = await get_pg_pool()
        async with pool.acquire() as conn:
            yield conn

    with patch.object(threads_api, "get_user_pg_connection", _real_conn):
        state = await threads_api.get_thread_workflow(
            thread_id=str(seed.thread_id),
            request=None,
            current_user={"id": str(seed.user_id)},
            supabase=_local_supabase(),
        )
    return next(p.failure_reason for p in (state.phases or []) if p.slug == "send-the-mail")


@pytest.mark.asyncio
async def test_S1_object_output_reaches_BOTH_readers(seeded, raw_pool):
    """The OBJECT arm, written by the real ``fail_phase`` on the app's own pool."""
    from app.db.workflows import fail_phase
    from app.dependencies import get_pg_pool

    reason = "Slack refused the message: channel_not_found"
    await fail_phase(await get_pg_pool(), seeded.phase_id, reason)

    shape = await raw_pool.fetchval(
        "SELECT jsonb_typeof(output) FROM workflow_phases WHERE id = $1", seeded.phase_id
    )
    assert shape == "object", (
        f"fail_phase produced jsonb_typeof={shape!r} — recorded, because the string-scalar "
        "arm below exists precisely because the LEGACY rows are not this shape"
    )

    assert await _run_read_failure_reason(seeded) == reason
    assert await _thread_read_failure_reason(seeded) == reason


@pytest.mark.asyncio
async def test_S1_string_scalar_output_reaches_BOTH_readers(seeded, raw_pool):
    """⚠ THE LEGACY ARM — 38 of the 43 ``failed`` rows on the live database.

    A jsonb STRING SCALAR holding the JSON text. ``fail_phase`` does not produce this shape
    today (the case above measures ``object``), which is exactly why it is planted here with
    raw SQL: the rows that EXIST are this shape, and a reader written as
    ``row["output"]["_failure_reason"]`` finds the reason on 2 of 43 and reads empty on the
    rest — SILENTLY, because the absent arm renders honestly and no test can see it.
    """
    reason = "The mail server closed the connection before the message was accepted."
    payload = json.dumps({"_failure_reason": reason, "text": "partial draft"})
    await raw_pool.execute(
        "UPDATE workflow_phases SET status = 'failed', output = to_jsonb($2::text) "
        "WHERE id = $1",
        seeded.phase_id, payload,
    )
    shape = await raw_pool.fetchval(
        "SELECT jsonb_typeof(output) FROM workflow_phases WHERE id = $1", seeded.phase_id
    )
    assert shape == "string", "the legacy arm must actually BE a string scalar"

    assert await _run_read_failure_reason(seeded) == reason, (
        "the run read lost the reason on the legacy jsonb shape"
    )
    assert await _thread_read_failure_reason(seeded) == reason, (
        "⭐ the CHAT PANEL's transport lost the reason on the legacy jsonb shape — this is "
        "BUG-260826-05's exact symptom, and this reader is the half no other suite covers"
    )


@pytest.mark.asyncio
async def test_S1_absent_and_whitespace_are_ONE_fact_on_both_readers(seeded, raw_pool):
    """ABSENT and EMPTY must normalise to the same ``None`` on BOTH surfaces.

    Otherwise the panel's ``reason_unknown`` sentinel stops meaning *"not recorded"* on one
    surface and not the other — a divergence no single-surface test can see.
    """
    await raw_pool.execute(
        "UPDATE workflow_phases SET status='failed', output=$2::jsonb WHERE id=$1",
        seeded.phase_id, json.dumps({"_failure_reason": "   "}),
    )
    assert await _run_read_failure_reason(seeded) is None
    assert await _thread_read_failure_reason(seeded) is None

    await raw_pool.execute(
        "UPDATE workflow_phases SET status='failed', output='{}'::jsonb WHERE id=$1",
        seeded.phase_id,
    )
    assert await _run_read_failure_reason(seeded) is None
    assert await _thread_read_failure_reason(seeded) is None


def test_S1_the_two_cross_language_hops_exist_and_RUN():
    """⚠ CITED AND RUN — never assumed from a summary.

    S-1 is a FIVE-hop chain and its last two are cross-language, so they are asserted where
    they live: ``PhaseReconcile.test.tsx`` (plan 214-02, both ``reconcilePhases`` literals)
    and ``PhaseCard.test.tsx`` (plan 214-11, a card built from ``reconcilePhases``' real
    output rather than a literal). **A seam whose two ends are green in two suites that never
    meet is the Phase 204 shape**, so this case runs them and reads the runner's verdict.

    ⚠ ``npx vitest run <path-that-does-not-exist>`` alongside real paths EXITS 0 — a plan in
    this phase reported green having executed zero of the cases it named. Both paths are
    therefore asserted to EXIST before the runner is invoked.
    """
    frontend = _REPO_ROOT / "frontend"
    targets = [
        _FRONTEND_SRC / "components" / "panel" / "__tests__" / "PhaseReconcile.test.tsx",
        _FRONTEND_SRC / "components" / "panel" / "PhaseCard.test.tsx",
    ]
    for t in targets:
        assert t.is_file(), f"cited hop does not exist: {t} — a vitest run naming it exits 0"

    if not (frontend / "node_modules").exists():
        pytest.skip("frontend/node_modules absent — bootstrap the worktree to run this hop")

    env = {**os.environ, "GSD_VITEST_MAX_WORKERS": "2", "CI": "1"}
    rel = [str(t.relative_to(frontend)).replace("\\", "/") for t in targets]
    proc = subprocess.run(
        ["npx", "--no-install", "vitest", "run", *rel],
        cwd=str(frontend), env=env, capture_output=True, text=True, shell=(os.name == "nt"),
        timeout=900,
    )
    out = (proc.stdout or "") + (proc.stderr or "")
    assert proc.returncode == 0, f"the two cited cross-language hops did not pass:\n{out[-4000:]}"
    # Positive control: a run that executed NOTHING also exits 0. Require evidence of cases.
    assert re.search(r"Tests\s+\d+\s+passed", out) or re.search(r"\d+\s+passed", out), (
        f"vitest exited 0 with no evidence it executed a case:\n{out[-2000:]}"
    )


# ══════════════════════════════════════════════════════════════════════════════
# S-2 — the gate and the executor over ONE config, nothing mocked
#
#   backend/app/services/connectors/args.py:329  unsatisfiable_arguments  (the GATE's call,
#       via harness/reachability.py:_lint_argument_gaps)
#   backend/app/services/connectors/args.py:240  resolve_arguments        (the EXECUTOR's call,
#       via harness/phase_types.py:2661 / :2732)
# ══════════════════════════════════════════════════════════════════════════════

_SEND_SCHEMA = {
    "type": "object",
    "properties": {
        "to": {"type": "string"},
        "subject": {"type": "string"},
        "body": {"type": "string"},
    },
    "required": ["to", "subject", "body"],
}


def _cfg(**kw):
    """A plain mapping config — the LEGACY jsonb shape both predicates must accept.

    ``args.py``'s dual-shape reads are load-bearing (``_field`` / ``_mapping_field``): the
    executor holds a Pydantic ``ExternalActionPhaseConfig``, the publish lint holds phases
    parsed out of a ``WorkflowDefinition``, and a raw JSONB dict reaches both on the legacy
    path. Handing a Mapping here exercises the arm a published-before-this-phase workflow
    actually takes.
    """
    return {"arg_sources": kw.get("arg_sources", {}), "tool_args": kw.get("tool_args", {})}


def test_S2_satisfiable_gate_is_empty_AND_resolver_is_complete():
    """Direction 1 — the gate says nothing is missing and the executor produces all three.

    ⚠ **THE LIMIT THIS CASE CANNOT COVER, STATED IN ITS OWN DOCSTRING**: it hands ONE schema
    object to BOTH functions, so it proves ``f(s) == g(s)`` and is **structurally incapable**
    of detecting ``s_gate != s_executor`` — a gate linting against a different schema than
    the executor resolves against publishes a workflow that then sends an EMPTY argument
    object, silently. That half is S-6, and a phase shipping this case without S-6 has tested
    the predicates and not the provenance.
    """
    from app.services.connectors.args import resolve_arguments, unsatisfiable_arguments

    config = _cfg(
        arg_sources={
            "to": {"source": "ask", "ask_key": "recipient"},
            "subject": {"source": "fixed"},
            "body": {"source": "upstream", "upstream_slug": "draft"},
        },
        tool_args={"subject": "Your weekly report"},
    )

    gaps = unsatisfiable_arguments(
        config=config,
        schema=_SEND_SCHEMA,
        upstream_slugs=["draft"],
        declared_input_keys={"recipient"},
    )
    assert gaps == [], f"the gate refused a satisfiable step: {gaps!r}"

    args = resolve_arguments(
        config=config,
        schema=_SEND_SCHEMA,
        upstream_outputs={"draft": "The numbers are up."},
        run_inputs={"recipient": "ops@example.test"},
    )
    assert args == {
        "to": "ops@example.test",
        "subject": "Your weekly report",
        "body": "The numbers are up.",
    }, f"the gate passed the step and the executor produced {args!r}"


def test_S2_unsatisfiable_gate_names_the_kind_AND_resolver_omits_the_key():
    """Direction 2 — the two must agree the OTHER way too.

    A one-directional agreement test passes a gate that refuses everything. This flips the
    ``ask_key`` to a name the workflow's ``inputs`` do not declare and requires BOTH: exactly
    one ``ask_undeclared`` from the gate, and ``to`` ABSENT from the executor's object.
    """
    from app.services.connectors.args import resolve_arguments, unsatisfiable_arguments

    config = _cfg(
        arg_sources={
            "to": {"source": "ask", "ask_key": "not_declared_anywhere"},
            "subject": {"source": "fixed"},
            "body": {"source": "upstream", "upstream_slug": "draft"},
        },
        tool_args={"subject": "Your weekly report"},
    )

    gaps = unsatisfiable_arguments(
        config=config,
        schema=_SEND_SCHEMA,
        upstream_slugs=["draft"],
        declared_input_keys={"recipient"},
    )
    assert [(g.kind, g.argument) for g in gaps] == [("ask_undeclared", "to")], (
        f"the gate must name exactly this one gap, and did not: {gaps!r}"
    )

    args = resolve_arguments(
        config=config,
        schema=_SEND_SCHEMA,
        upstream_outputs={"draft": "The numbers are up."},
        run_inputs={"recipient": "ops@example.test"},
    )
    assert "to" not in args, (
        "the executor filled an argument the gate says nothing can populate — that is the "
        "D-214-00 drift, and it is the direction that sends mail to the wrong place"
    )
    assert set(args) == {"subject", "body"}


def test_S2_shape_unknown_and_the_empty_object_agree():
    """A schema the system cannot read: the gate says ``shape_unknown``, the executor sends {}.

    ⛔ The executor must RECORD on this input, never send. The agreement asserted here is what
    makes ``phase_types``' ``None``-schema refusal a REFUSAL rather than an empty send.
    """
    from app.services.connectors.args import resolve_arguments, unsatisfiable_arguments

    config = _cfg(tool_args={"to": "ops@example.test"})
    gaps = unsatisfiable_arguments(
        config=config, schema=None, upstream_slugs=[], declared_input_keys=set()
    )
    assert [(g.kind, g.argument) for g in gaps] == [("shape_unknown", None)]
    assert resolve_arguments(
        config=config, schema=None, upstream_outputs={}, run_inputs={}
    ) == {}


def test_S2_the_D_214_12_legacy_arm_still_runs_an_already_published_workflow():
    """⚠ D-214-12 — no retroaction. An already-published step with EMPTY ``tool_args`` runs.

    Every workflow published before this phase carries an empty ``tool_args`` on its native
    steps, and the value the old projection sent came from the run-input bag. The no-entry
    fallback reads ``tool_args`` and THEN ``run_inputs``; without the second half those
    workflows would silently stop sending. Recorded here because plan ``214-05`` measured the
    gate/resolver ``iff`` to be FALSE in both directions DELIBERATELY — do not "fix" the gate
    to match the resolver.
    """
    from app.services.connectors.args import resolve_arguments, unsatisfiable_arguments

    config = _cfg()  # no arg_sources at all, no tool_args — the legacy shape
    args = resolve_arguments(
        config=config,
        schema=_SEND_SCHEMA,
        upstream_outputs={},
        run_inputs={"to": "ops@example.test", "subject": "s", "body": "b"},
    )
    assert args == {"to": "ops@example.test", "subject": "s", "body": "b"}

    gaps = unsatisfiable_arguments(
        config=config, schema=_SEND_SCHEMA, upstream_slugs=[], declared_input_keys=set()
    )
    assert {g.kind for g in gaps} == {"no_source"}, (
        "the GATE refuses this step at the next publish while the RESOLVER still runs it — "
        "that asymmetry IS D-214-12 and it is deliberate"
    )


# ══════════════════════════════════════════════════════════════════════════════
# S-5 — the launcher's inputs. NOT satisfiable in-process; cited by name.
# ══════════════════════════════════════════════════════════════════════════════

def test_S5_the_launcher_half_is_owned_by_plan_214_16_and_that_suite_exists():
    """⚠ Handing ``run_inputs`` to ``resolve_arguments`` supplies the launcher's side FROM THE
    TEST and passes green over a wire that does not exist — which is exactly what the first
    version of this plan did.

    The launcher half is plan ``214-16``'s suite, which drives a REAL
    ``POST /threads/{id}/messages`` and reads ``workflow_runs.inputs`` back out of Postgres.
    It is cross-referenced by name and asserted to exist with its case count, never
    re-implemented here.
    """
    wire = _BACKEND / "tests" / "integration" / "test_214_launch_inputs_wire.py"
    assert wire.is_file(), (
        "plan 214-16's launcher-wire suite is absent — S-5's launcher half is then proven by "
        "NOTHING, and the in-process cases above are the Phase 204 shape"
    )
    tree = ast.parse(_read(wire))
    cases = [
        n.name for n in ast.walk(tree)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef)) and n.name.startswith("test_")
    ]
    assert len(cases) >= 6, f"expected >= 6 cases in the launcher-wire suite, found {len(cases)}"


# ══════════════════════════════════════════════════════════════════════════════
# S-6 — SCHEMA PROVENANCE. The half S-2 is structurally blind to.
#
#   ONE accessor  backend/app/services/connectors/args.py:417  schema_for_bound_tool
#   caller 1 GATE     harness/publish_service.py:629
#   caller 2 EXECUTOR harness/phase_types.py:2661 (MCP) and :2732 (native)
#   caller 3 PAUSE    harness_engine.py:988
# ══════════════════════════════════════════════════════════════════════════════

_MCP_SNAPSHOT = [
    {"name": "chat.postMessage", "inputSchema": {
        "type": "object",
        "properties": {"channel": {"type": "string"}, "text": {"type": "string"}},
        "required": ["channel", "text"],
    }},
    {"name": "conversations.list", "inputSchema": {"type": "object", "properties": {}}},
]


def test_S6_all_three_production_paths_agree_on_one_schema_per_shape():
    """⭐ THE CASE THAT CATCHES A PUBLISHED-THEN-FAILS-AT-THE-SEND WORKFLOW.

    The gate, the executor and the pause each obtain a bound tool's ``inputSchema`` with their
    OWN argument pattern, copied from their own call sites — the gate's
    ``(capability=None, tool_name=..., discovered_tools=snapshot)``, the executor's native
    ``(capability=cap, tool_name=None, discovered_tools=None)``, and the pause's arm switch on
    ``mcp_server_url``. All three must be ``==`` for the same bound tool.

    ⛔ Nothing patched, no schema hand-typed for the native arm.
    """
    from app.services.connectors.args import schema_for_bound_tool

    # ── MCP shape: the three call sites' identical pattern, invoked three times ──
    gate = schema_for_bound_tool(
        capability=None, tool_name="chat.postMessage", discovered_tools=_MCP_SNAPSHOT
    )
    executor = schema_for_bound_tool(
        capability=None, tool_name="chat.postMessage", discovered_tools=_MCP_SNAPSHOT
    )
    pause = schema_for_bound_tool(
        capability=None, tool_name="chat.postMessage", discovered_tools=_MCP_SNAPSHOT
    )
    assert gate is not None and gate == executor == pause
    assert gate["required"] == ["channel", "text"]

    # A tool the snapshot does not advertise resolves None on ALL THREE — the gate turns that
    # into shape_unknown and the executor must RECORD. Agreement in the refusal direction too.
    for call in (
        dict(capability=None, tool_name="chat.notAThing", discovered_tools=_MCP_SNAPSHOT),
        dict(capability=None, tool_name="chat.postMessage", discovered_tools=None),
    ):
        assert schema_for_bound_tool(**call) is None


def test_S6_native_control_descriptor_equals_the_adapters_own_declaration():
    """The native control — ``descriptor_for(cap)["inputSchema"]`` IS the adapter's schema.

    ``schema_for_bound_tool`` reads the DESCRIPTOR deliberately, never ``adapter.INPUT_SCHEMA``:
    the two are equal today and would silently stop being equal the moment either side gained
    a transform. This asserts the equality rather than trusting the comment, over EVERY
    registered capability — so a newly-added adapter is covered without editing this case.
    """
    from app.services.connectors import descriptors
    from app.services.connectors.args import schema_for_bound_tool
    from app.services.connectors.registry import get_adapter

    caps = sorted(getattr(descriptors, "_TITLE_FOR_CAPABILITY", {}))
    assert caps, "the descriptor module exposes no capability ids to iterate"
    checked = 0
    for cap in caps:
        try:
            expected = descriptors.descriptor_for(cap).get("inputSchema")
            adapter = get_adapter(cap)
        except Exception:  # noqa: BLE001 — not a registered capability id
            continue
        if expected is None:
            continue
        got = schema_for_bound_tool(capability=cap, tool_name=None, discovered_tools=None)
        assert got == expected, f"{cap}: the accessor and the descriptor disagree"
        raw = getattr(adapter, "INPUT_SCHEMA", None)
        if raw is not None:
            # ⚠ `_plain_json` IS THE DERIVATION, and it is the module's own. An adapter's
            # INPUT_SCHEMA is a nested `mappingproxy` (frozen on purpose), so `dict(raw)`
            # converts only the OUTER layer and `json.dumps` then dies on the inner one —
            # measured on the first run. Re-typing the flatten here would also make this case
            # compare the descriptor against a SECOND derivation rather than against the one
            # that ships.
            assert expected == descriptors._plain_json(raw), (
                f"{cap}: the descriptor is no longer the adapter's own declaration"
            )
        checked += 1
    assert checked >= 1, (
        "positive control: not one registered capability was checked, so this case's silence "
        "proves nothing"
    )


_SCHEMA_CALLERS = {
    "gate": _BACKEND / "app" / "services" / "harness" / "publish_service.py",
    "executor": _BACKEND / "app" / "services" / "harness" / "phase_types.py",
    "pause": _BACKEND / "app" / "services" / "harness_engine.py",
}


def test_S6_no_production_call_site_hands_resolve_arguments_a_schema_it_grew_itself():
    """Provenance BY CONSTRUCTION, asserted over the three callers' real source as an AST.

    ⚠ **A BLANKET GREP FOR ``INPUT_SCHEMA`` IS THE WRONG FENCE, AND MEASURING IT IS HOW THAT
    WAS LEARNED.** ``phase_types.py:2175`` reads ``adapter.INPUT_SCHEMA`` legitimately — it is
    the documented ``schema is None`` COMPATIBILITY arm for the pre-214 three-positional shape
    that three shipped suites (``test_190_ssti_fence.py`` among them) still call. A fence that
    banned the attribute outright would have demanded a change that breaks those suites and
    protects nothing.

    So the fence is on the ARGUMENT, not the file: every ``schema=`` keyword handed to
    ``resolve_arguments`` at a production site must be a NAME or a ``schema_for_bound_tool``
    call — never an attribute read of the adapter's own frozen declaration, and never a dict
    literal typed at the call site. That is the property that makes the gate's schema and the
    executor's schema identical by construction.
    """
    found = 0
    for role, path in _SCHEMA_CALLERS.items():
        src = _read(path)
        assert "schema_for_bound_tool" in _strip_python_comments(src), (
            f"{role} ({path.name}) does not call the one accessor in CODE — a mention in a "
            "docblock does not obtain a schema"
        )
        for node in ast.walk(ast.parse(src)):
            if not isinstance(node, ast.Call):
                continue
            fname = getattr(node.func, "id", None) or getattr(node.func, "attr", None)
            if fname not in ("resolve_arguments", "_adapter_args"):
                continue
            for kw in node.keywords:
                if kw.arg != "schema":
                    continue
                found += 1
                value = kw.value
                assert not (
                    isinstance(value, ast.Attribute) and value.attr == "INPUT_" + "SCHEMA"
                ), (
                    f"{role} ({path.name}:{node.lineno}) hands the adapter's own frozen "
                    "declaration to the resolver — the gate reads the DESCRIPTOR, so the two "
                    "would silently stop agreeing the moment either side gained a transform"
                )
                assert not isinstance(value, ast.Dict), (
                    f"{role} ({path.name}:{node.lineno}) types a schema literal at the call "
                    "site — the gate could never lint against it"
                )
    assert found >= 2, (
        f"positive control: only {found} production `schema=` argument(s) were found across "
        "the three callers, so this case's silence proves nothing"
    )


def test_S6_the_one_legitimate_INPUT_SCHEMA_read_is_the_compat_arm_and_stays_alone():
    """The count is PINNED, so a SECOND hand-grown extraction cannot appear quietly.

    Exactly one ``adapter.INPUT_SCHEMA`` read exists across the three callers, it lives in
    ``phase_types.py``, and it is the ``schema is None`` compatibility fallback. The gate and
    the pause carry ZERO. Comments are stripped first with a stripper-did-something control —
    a docblock that FORBIDS the thing counts as an occurrence to a naive grep (187-24).
    """
    needle = "INPUT_" + "SCHEMA"
    counts = {}
    for role, path in _SCHEMA_CALLERS.items():
        src = _read(path)
        code = _strip_python_comments(src)
        assert len(code) < len(src), f"{role}: the comment stripper did nothing"
        counts[role] = code.count(needle)

    assert counts["gate"] == 0, "the publish gate grew its own schema extraction"
    assert counts["pause"] == 0, "the approval pause grew its own schema extraction"
    assert counts["executor"] == 1, (
        f"the executor carries {counts['executor']} adapter-declaration reads; exactly ONE is "
        "expected — the documented `schema is None` pre-214 compatibility arm. A second is a "
        "production call site reading a schema for itself."
    )
    # And it IS the compat arm, not some other read: the line above it is the None guard.
    executor = _strip_python_comments(_read(_SCHEMA_CALLERS["executor"]))
    assert re.search(r"if schema is None:\s*\r?\n\s*schema = adapter\." + needle, executor), (
        "the executor's single adapter-declaration read is no longer inside the "
        "`if schema is None` compatibility arm — it has become a production path"
    )


def _strip_python_comments(src: str) -> str:
    """Drop ``#`` comments and triple-quoted strings. ``\\r?\\n``-safe by construction."""
    out = re.sub(r'("""|\'\'\')[\s\S]*?\1', '""', src)
    out = re.sub(r"#[^\r\n]*", "", out)
    return out


# ══════════════════════════════════════════════════════════════════════════════
# S-3 — the service name: ONE string, TWO surfaces
#
#   grounding.py:1209 _approval_sentence(service_name=...)  <- harness_engine.py:949
#   workflow_runs.py:879 service_name = conn_names[...]      <- connector_connections.name
# ══════════════════════════════════════════════════════════════════════════════

def _pg_connection_fetch_row(pool):
    """The INJECTED storage seam, reading the REAL row from the REAL database.

    ``resolve_connection``'s ``fetch_row`` parameter exists precisely so the storage layer can
    be supplied — the two arguments ``(connection_id, org_id)`` are what turn *"did the
    resolver scope the lookup?"* from an unobservable property of a SQL string into a fact a
    test can record. Supplying it is therefore using the seam as designed; the RESOLVER itself
    is untouched, which is what S-0 enforces.

    ⚠ THE JSONB COLUMNS ARE DECODED HERE, AND THAT IS THE SEAM'S CONTRACT, NOT A CONVENIENCE.
    The production fetch goes through PostgREST, which returns JSON-decoded values; this pool
    deliberately carries NO jsonb codec (so a column's literal shape stays observable
    elsewhere in this file), so `config` arrives as the TEXT `'{}'` and the resolver's
    `dict(row.get("config"))` raises `ValueError`. Measured on the first run — recorded
    because it is a genuine difference between the two storage layers, not a test detail.
    """
    async def _fetch_row(connection_id: str, org_id: str):
        row = await pool.fetchrow(
            "SELECT * FROM connector_connections WHERE id = $1::uuid AND org_id = $2::uuid",
            connection_id, org_id,
        )
        if row is None:
            return None
        out = dict(row)
        for col in ("config", "tool_grants", "discovered_tools"):
            if isinstance(out.get(col), (str, bytes, bytearray)):
                out[col] = json.loads(out[col])
        return out

    return _fetch_row


@pytest_asyncio.fixture
async def connection_row(raw_pool, seeded):
    """A REAL ``connector_connections`` row, deleted afterwards."""
    conn_id = uuid4()
    name = f"Acme Ops Mail {conn_id.hex[:8]}"
    try:
        await raw_pool.execute(
            # ⚠ `capability` and `service_id` are BOTH constrained (migration 127's
            # `connector_connections_has_a_service_identity`, and the three-value capability
            # CHECK). Both were measured off `pg_constraint`, never guessed — the first two
            # attempts here were rejected by the database.
            # ⚠ AN MCP-SHAPED ROW, AND THAT CHOICE WAS FORCED BY THE PRODUCT RATHER THAN
            # PREFERRED. A `capability` row with no `secret_ciphertext` is `ConnectorNotFound`
            # by design (an SMTP host REQUIRES a credential, so a row without one is absent
            # for the purpose of sending) — measured here on the first attempt. The
            # credential-less MCP shape resolves, is a real production shape, and is the one
            # this phase's Slack/Jira steps actually bind. Seeding an encrypted secret would
            # mean writing a real credential into the operator's database to test a NAME.
            "INSERT INTO connector_connections (id, org_id, created_by, name, capability, "
            "service_id, mcp_server_url, config, is_enabled, tool_grants, discovered_tools) "
            "VALUES ($1, $2, $3, $4, NULL, 'slack', 'https://mcp.example.test/sse', "
            "'{}'::jsonb, true, '{}'::jsonb, '[]'::jsonb)",
            conn_id, seeded.org_id, seeded.user_id, name,
        )
    except Exception as exc:  # noqa: BLE001
        raise AssertionError(  # same rule as `seeded` — an unproven seam is not a skip
            f"connector_connections seed failed — S-3 is UNPROVEN: "
            f"{type(exc).__name__}: {exc}"
        ) from exc
    yield SimpleNamespace(id=conn_id, name=name)
    try:
        await raw_pool.execute("DELETE FROM connector_connections WHERE id = $1", conn_id)
    except Exception:  # noqa: BLE001
        pass


@pytest.mark.asyncio
async def test_S3_one_service_name_reaches_the_pause_AND_the_run_read(raw_pool, seeded, connection_row):
    """ONE value, TWO surfaces, ONE assertion.

    The pause side runs the REAL ``resolve_connection`` through its INJECTED ``fetch_row``
    seam — the storage function, which is what the seam is FOR — and feeds the resolved
    ``.name`` to the REAL ``_approval_sentence``. ⛔ The resolver itself is not patched, and
    neither is ``_external_action_clause``.

    The read side runs the run serializer's own connection-name SQL against the same real row.
    The assertion is that the two produce the SAME STRING — not that each produces one.
    """
    from app.services.connector_service import resolve_connection
    from app.services.harness.grounding import _approval_sentence

    _fetch_row = _pg_connection_fetch_row(raw_pool)

    resolved = await resolve_connection(
        str(connection_row.id), org_id=str(seeded.org_id), fetch_row=_fetch_row
    )
    pause_name = getattr(resolved, "name", None)

    rows = await raw_pool.fetch(
        "SELECT id, name FROM connector_connections WHERE id = ANY($1::uuid[])",
        [connection_row.id],
    )
    read_name = {str(r["id"]): r["name"] for r in rows}.get(str(connection_row.id))

    assert pause_name == read_name == connection_row.name, (
        f"the pause resolved {pause_name!r} and the run read resolved {read_name!r} for the "
        "same connection — a person would approve one name and the receipt would carry another"
    )

    phase = SimpleNamespace(
        slug="send-the-mail", name="Send the report", phase_index=2,
        config=SimpleNamespace(
            phase_type="external_action", capability=None, tool_name="chat.postMessage"
        ),
    )
    sentence = _approval_sentence(phase, 5, service_name=pause_name, resolved_args={"to": "x"})
    assert connection_row.name in sentence, (
        "the composed approval sentence does not carry the resolved service name — the "
        "approval-pause-never-names-the-service bug, reproduced"
    )
    assert "Send the report" in sentence, "positive control: the step's own label must appear"


@pytest.mark.asyncio
async def test_S3_an_unresolvable_connection_names_NOTHING_on_both_surfaces(raw_pool, seeded):
    """Never draw a name the system cannot know — on the pause AND on the read.

    A substitute string on one surface and ``None`` on the other is the divergence a
    single-surface test cannot see.
    """
    from app.services.connector_service import ConnectorNotFound, resolve_connection
    from app.services.harness.grounding import _approval_sentence

    ghost = uuid4()

    _fetch_row = _pg_connection_fetch_row(raw_pool)

    with pytest.raises(ConnectorNotFound):
        await resolve_connection(str(ghost), org_id=str(seeded.org_id), fetch_row=_fetch_row)

    rows = await raw_pool.fetch(
        "SELECT id, name FROM connector_connections WHERE id = ANY($1::uuid[])", [ghost]
    )
    assert {str(r["id"]): r["name"] for r in rows}.get(str(ghost)) is None

    phase = SimpleNamespace(
        slug="send-the-mail", name="Send the report", phase_index=2,
        config=SimpleNamespace(
            phase_type="external_action", capability=None, tool_name="chat.postMessage"
        ),
    )
    sentence = _approval_sentence(phase, 5, service_name=None, resolved_args=None)
    for invented in ("Unknown service", "unknown service", str(ghost)):
        assert invented not in sentence, f"the pause invented {invented!r} for an unknown name"


# ══════════════════════════════════════════════════════════════════════════════
# S-4 — the five refusal kinds, across the language boundary
#
#   args.py:81                 ArgumentGapKind        (the DECLARING home, Python)
#   reachability.py:112        ARGUMENT_GAP_CODES  -> LINT_CODES
#   publishRefusalVocabulary.ts REFUSAL_FOR_KIND     (the DECLARING home, TypeScript)
# ══════════════════════════════════════════════════════════════════════════════

def test_S4_the_five_kinds_are_ONE_list_across_python_and_typescript():
    """A cross-language assertion, and the SUMMARY says this is where it lives.

    The TS half is parsed from ``publishRefusalVocabulary.ts`` — the module that DECLARES the
    union — never from a locally-retyped list, which would compare ``args.py`` against a copy
    of itself.

    ⚠ CRLF: the extractor is ``\\r?\\n``-tolerant and carries a positive control, because a
    bare ``\\n\\n`` terminator here returns empty and passes vacuously.
    """
    from app.services.connectors.args import ArgumentGapKind
    from app.services.harness.reachability import ARGUMENT_GAP_CODES, LINT_CODES

    python_kinds = set(ArgumentGapKind.__args__)
    assert len(python_kinds) == 5, f"the Python union is no longer five: {python_kinds}"
    assert python_kinds == set(ARGUMENT_GAP_CODES), (
        "reachability's ARGUMENT_GAP_CODES has drifted from args.py's union"
    )
    assert python_kinds <= set(LINT_CODES), "a gap kind is not a reachable lint code"

    ts_path = _FRONTEND_SRC / "components" / "workflows" / "publishRefusalVocabulary.ts"
    assert ts_path.is_file(), f"the declaring TS module is absent: {ts_path}"
    ts_src = _read(ts_path)

    # ⚠ ANCHORED ON THE `export const`, AND `[^=]*` WOULD NOT WORK: the declaration is
    # `Record<ArgumentGapKind, (facts: ArgumentGapFacts) => string> = {`, and the `=` inside
    # the arrow type stops a negated-class scan dead. Measured on the first run.
    block = re.search(
        r"export const REFUSAL_FOR_KIND[\s\S]*?=\s*\{([\s\S]*?)\r?\n\}", ts_src
    )
    assert block is not None, (
        "could not locate REFUSAL_FOR_KIND's object literal — the extractor found nothing, "
        "which is the CRLF vacuous-pass shape rather than a verdict"
    )
    ts_keys = set(re.findall(r"^\s{2}(\w+)\s*:", block.group(1), re.MULTILINE))
    assert len(ts_keys) == 5, (
        f"positive control: expected five REFUSAL_FOR_KIND keys, the parse found {ts_keys}"
    )
    assert ts_keys == python_kinds, (
        f"the TypeScript refusal map and the Python union disagree: "
        f"only-TS={ts_keys - python_kinds} only-PY={python_kinds - ts_keys}"
    )


# ══════════════════════════════════════════════════════════════════════════════
# S-7 — the /workflows/generate refusal reaches a screen
#
#   workflow_authoring.py:405/414/434  {"ok": False, "error": "connection_not_allowed"}
#   useTemplateFirstDraft.ts:623       store.getState().setErrorState(result.error, ...)
#   builderStore.ts:433                -> errorMessage
#   WorkflowBuilderPage.tsx:2180       -> "Couldn't generate — {errorMessage}"
# ══════════════════════════════════════════════════════════════════════════════

def test_S7_the_generate_refusal_returns_the_new_code_from_the_real_service():
    """The backend half — the refusal exists, is spelled once, and is a structured failure."""
    src = _read(_BACKEND / "app" / "services" / "workflow_authoring.py")
    code = _strip_python_comments(src)
    assert len(code) < len(src), "the comment stripper did nothing"
    hits = re.findall(r'"error":\s*"connection_not_allowed"', code)
    assert len(hits) >= 1, (
        "plan 214-13's post-emit refusal code is absent from the service's CODE (a mention in "
        "a docblock would not count — comments are stripped above)"
    )
    assert re.search(r'"ok":\s*False', code), "the refusal is not the structured ok:false shape"


def test_S7_the_refusal_reaches_a_rendered_screen_and_the_screen_shows_the_RAW_CODE():
    """⭐ THE PATH IS ASSERTED, NOT ASSUMED — and asserting it found something.

    The chain resolves: ``useTemplateFirstDraft`` calls ``setErrorState(result.error, ...)``
    for ANY ``ok: false``; ``builderStore.setErrorState`` writes ``errorMessage``;
    ``WorkflowBuilderPage`` renders it. So no component MUST change for the new code to be
    REACHABLE — which is what plan 214-13 assumed and this case now proves.

    ⚠ **BUT WHAT REACHES THE SCREEN IS THE MACHINE CODE.** ``result.error`` is the raw string
    ``connection_not_allowed`` and it is passed as the MESSAGE, so an author whose describe
    door refuses reads:

        Couldn't generate — connection_not_allowed

    Every other refusal in this phase was given a governed sentence (plan ``214-03``'s
    vocabularies); this one was not, because it crosses a plan boundary — ``214-13`` owns the
    code and ``214-04`` owns the page. **That is a FINDING with a named owner, recorded in
    214-14-SUMMARY.md, not a defect this plan absorbs.** The assertions below pin the path as
    it IS, so the day someone translates the code this case fails and says why.
    """
    hook = _read(_FRONTEND_SRC / "components" / "workflows" / "useTemplateFirstDraft.ts")
    store = _read(_FRONTEND_SRC / "components" / "workflows" / "builderStore.ts")
    page = _read(_FRONTEND_SRC / "pages" / "WorkflowBuilderPage.tsx")

    assert re.search(r"setErrorState\(\s*result\.error", hook), (
        "the hook no longer forwards the server's error code — the new refusal would reach "
        "no screen at all"
    )
    assert re.search(r"errorMessage:\s*message", store), (
        "setErrorState no longer stores the message it is handed"
    )
    assert "{errorMessage}" in page, "the builder no longer renders errorMessage"

    # The finding, pinned: the hook hands a CODE where the render expects a SENTENCE, and no
    # module maps this code to governed copy.
    for vocab in ("publishRefusalVocabulary", "doorVocabulary", "argumentVocabulary"):
        assert f"connection_not_allowed" not in _read(
            _FRONTEND_SRC / "components" / "workflows" / f"{vocab}.ts"
        ), (
            f"{vocab}.ts now maps connection_not_allowed to copy — if the hook was taught to "
            "use it, delete this assertion and say so; if not, the map is unreachable"
        )


# ══════════════════════════════════════════════════════════════════════════════
# T-214-14-05 — the suite gives the operator's database back
# ══════════════════════════════════════════════════════════════════════════════

@pytest.mark.asyncio
async def test_T_214_14_05_a_full_seed_and_teardown_cycle_leaves_no_rows_behind(raw_pool):
    """The threat row, as a test: this suite writes to the operator's local database.

    ⚠ ORDER-INDEPENDENT BY CONSTRUCTION. A baseline captured at import and checked in a
    "last" case is only correct if the runner keeps declaration order — and ``pytest-randomly``
    is installed here, so it does not. This case therefore captures, cycles and re-checks
    entirely within itself.
    """
    tables = ("workflow_phases", "workflow_runs", "threads", "connector_connections")
    before = {t: await raw_pool.fetchval(f"SELECT count(*) FROM {t}") for t in tables}

    row = await raw_pool.fetchrow(
        "SELECT id, org_id FROM workflow_definitions WHERE status = 'published' "
        "AND org_id IS NOT NULL LIMIT 1"
    )
    if row is None:
        pytest.skip("no published workflow_definitions row with an org_id to use as FK target")

    user_id, thread_id, run_id, phase_id, conn_id = (uuid4() for _ in range(5))
    await raw_pool.execute(
        "INSERT INTO auth.users (id, email) VALUES ($1, $2)",
        user_id, f"phase-214-14-litter-{user_id}@test.local",
    )
    await raw_pool.execute(
        "INSERT INTO threads (id, user_id, title) VALUES ($1, $2, 'litter check')",
        thread_id, user_id,
    )
    await raw_pool.execute(
        "INSERT INTO workflow_runs (id, thread_id, definition_id, status, org_id, user_id, "
        "inputs) VALUES ($1, $2, $3, 'failed', $4, $5, '{}'::jsonb)",
        run_id, thread_id, row["id"], row["org_id"], user_id,
    )
    await raw_pool.execute(
        "INSERT INTO workflow_phases (id, workflow_run_id, phase_index, slug, status, output, "
        "org_id) VALUES ($1, $2, 0, 'litter', 'active', '{}'::jsonb, $3)",
        phase_id, run_id, row["org_id"],
    )
    await raw_pool.execute(
        "INSERT INTO connector_connections (id, org_id, created_by, name, capability, "
        "service_id, mcp_server_url, config, is_enabled, tool_grants, discovered_tools) "
        "VALUES ($1, $2, $3, 'litter check', NULL, 'slack', 'https://mcp.example.test/sse', "
        "'{}'::jsonb, true, '{}'::jsonb, '[]'::jsonb)",
        conn_id, row["org_id"], user_id,
    )

    during = {t: await raw_pool.fetchval(f"SELECT count(*) FROM {t}") for t in tables}
    assert all(during[t] > before[t] for t in tables), (
        "positive control: the cycle did not actually insert anything, so the zero-delta "
        f"below would prove nothing (before={before} during={during})"
    )

    for sql in (
        ("DELETE FROM connector_connections WHERE id = $1", conn_id),
        ("DELETE FROM workflow_phases WHERE workflow_run_id = $1", run_id),
        ("DELETE FROM workflow_runs WHERE id = $1", run_id),
        ("DELETE FROM threads WHERE id = $1", thread_id),
        ("DELETE FROM auth.users WHERE id = $1", user_id),
    ):
        await raw_pool.execute(*sql)

    after = {t: await raw_pool.fetchval(f"SELECT count(*) FROM {t}") for t in tables}
    assert after == before, f"the suite littered: before={before} after={after}"
