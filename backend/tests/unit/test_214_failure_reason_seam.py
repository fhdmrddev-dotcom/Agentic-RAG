"""Phase 214 plan 02 (STEP-04 / STEP-05 / D-214-23) — the failure-reason READ/SERIALIZE seam.

WHY THIS FILE EXISTS
--------------------
`BUG-260826-05` reported *"run failed, reason empty"* on an external-action failure, and
`D-214-18` posed the fix as a binary: either the emitter is wrong or the executor's failure
path is. **D-214-23's measurement refuted both arms.** The reason IS captured — every
`fail_phase` writes it to `output._failure_reason` (`db/workflows.py:1835`) — and **nothing
projects it**. `grep -rn "_failure_reason" frontend/src` returned ZERO, so
`PhaseCard.classifyFailure` read `phase.error` (documented live-SSE-only), found it empty on
any reconciled run, and fired the `reason_unknown` sentinel **while the reason sat in the row**.
That is D-v2.5-03 exactly: Realtime is a hint, the fetch is the truth, and the fetch was not
carrying the fact.

AND THE HALF THAT MAKES A NAIVE FIX SHIP GREEN AND READ EMPTY
-------------------------------------------------------------
Of the **43** `failed` phase rows on the live local DB (2026-08-28): **38 are
`jsonb_typeof = 'string'`**; only **5** are `'object'`, of which only **2** carry the
`_failure_reason` key. A reader written as `output["_failure_reason"]` therefore finds the
reason on **2 of 43** rows and reads empty on the rest — silently, because the absent arm
renders honestly. That is the `declared_phase_measure` / Phase 200.1 string-scalar trap,
measured on the FAILURE path for the first time.

So the load-bearing case in this file is the **string-scalar RED driver**, and it is paired
with a **driven counterfactual**: a LOCAL re-statement of the dict-only reader, asserted to
find nothing on the very fixture the shipped path answers. A fence that was never driven RED
is a fence that could not fire, and asserting against the shipped function post-fix would
assert the fix against itself.

⚠ THE COUNTERFACTUAL IS A LOCAL RE-STATEMENT, NEVER AN IMPORT (the `test_200_1_phase_output_shape`
discipline). `_dict_only_reader` below is written out here; it is not the product's code.

Fully offline: no DB, no pg pool, no network. Nothing here mutates state, so this suite is
parallel-safe under CLAUDE.md's worktree rule 4.
"""

import ast
import json
import subprocess
from pathlib import Path

from app.api.workflow_runs import WorkflowRunPhaseRead
from app.models.thread import phase_output_object
from tests.test_188_workflow_run_read import (  # noqa: F401 — the shared, PROJECTING db seam
    _FakeSupabase,
    _flipped_on,
    _is_op_false,
)

# The commit this plan was dispatched against. The SQL byte-identity fence diffs the shipped
# literal against THIS revision, so "the SELECT moved not one byte" is proved, not claimed.
PLAN_BASE_SHA = "bd495af0f4da31b7665ca7900b9a35898d68c12e"

REPO_ROOT = Path(__file__).resolve().parents[3]

_OWNER_ID = "00000000-0000-0000-0000-0000000000a1"
_RUN_ID = "7e1a2b3c-0000-4000-8000-000000021400"
_THREAD_ID = "7e1a2b3c-0000-4000-8000-000000021401"
_DEF_ID = "7e1a2b3c-0000-4000-8000-000000021402"

# A REAL failure reason, verbatim off the live database (D-214-23 §3). Not a made-up string:
# the point of this suite is that this exact sentence was already in the row and reached nobody.
_REAL_REASON = "tool 'read_wiki_structure' refused: permission not granted"


def _blob_at_base(rel_path: str) -> str:
    """A tracked file's contents at the plan's base commit."""
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS. `text=True` alone decodes with the locale
    # codec (cp1252 here), and these modules carry `⚠` / `—` in their comments — so the
    # reader thread dies with a `UnicodeDecodeError`, `.stdout` comes back `None`, and the
    # fence fails with an `AttributeError` that looks nothing like the property it pins.
    # Measured while driving this suite RED, not reasoned about.
    return subprocess.run(
        ["git", "show", f"{PLAN_BASE_SHA}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout


# ── THE COUNTERFACTUAL — the dict-only reader, re-stated LOCALLY ───────────────────────────
def _dict_only_reader(raw: object) -> str | None:
    """What a reader written as ``output["_failure_reason"]`` finds.

    This is the shape the fix would have taken had it been driven only against an object
    fixture. It is written out here rather than imported because the product does not contain
    it — and must not.
    """
    if isinstance(raw, dict):
        value = raw.get("_failure_reason")
        return value if isinstance(value, str) else None
    return None


# ── fixtures: the two shapes the column really holds ───────────────────────────────────────
_REASON_OBJECT = {"_failure_reason": _REAL_REASON, "text": "…"}
#  38 of 43 failed rows look like THIS: a jsonb STRING SCALAR whose text is the JSON object.
_REASON_STRING_SCALAR = json.dumps(_REASON_OBJECT)

_DEFINITION_JSON = {
    "slug": "wiki-sync",
    "version": 1,
    "name": "Wiki sync",
    "phases": [
        {"slug": "gather", "phase_index": 0, "config": {"phase_type": "llm_agent"}},
        {"slug": "notify", "phase_index": 1, "config": {"phase_type": "external_action"}},
    ],
}


def _phase_row(slug, index, output, *, status="failed"):
    return {
        "workflow_run_id": _RUN_ID,
        "slug": slug,
        "phase_index": index,
        "status": status,
        "started_at": "2026-08-28T10:00:00+00:00",
        "completed_at": "2026-08-28T10:02:00+00:00",
        "output": output,
    }


def _store(phase_rows, *, connections=None, definition=None) -> _FakeSupabase:
    defn = _DEFINITION_JSON if definition is None else definition
    return _FakeSupabase(
        {
            "workflow_runs": [
                {
                    "id": _RUN_ID,
                    "thread_id": _THREAD_ID,
                    "definition_id": _DEF_ID,
                    "status": "failed",
                    "created_at": "2026-08-28T09:59:00+00:00",
                    "updated_at": "2026-08-28T10:05:00+00:00",
                    "claimed_at": None,
                    "user_id": _OWNER_ID,
                    "definition_snapshot": defn,
                }
            ],
            "workflow_definitions": [
                {
                    "id": _DEF_ID,
                    "slug": defn.get("slug", "wiki-sync"),
                    "version": defn.get("version", 1),
                    "name": defn.get("name", "Wiki sync"),
                    "definition": defn,
                }
            ],
            "workflow_phases": list(phase_rows),
            "connector_connections": list(connections or []),
        }
    )


def _canvas_on(monkeypatch, store) -> _FakeSupabase:
    """Flag ON + an injected canvas caller + the projecting fake wired onto the user-JWT dep."""
    import app.dependencies as deps
    from app.dependencies import get_user_supabase_client
    from app.main import app

    _flipped_on(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": _OWNER_ID, "email": "owner@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)

    app.dependency_overrides[get_user_supabase_client] = lambda: store
    return store


def _phases(client, monkeypatch, phase_rows, **kw):
    """Drive the REAL route and hand back ``body["phases"]``."""
    _canvas_on(monkeypatch, _store(phase_rows, **kw))
    resp = client.get(f"/workflow-runs/{_RUN_ID}")
    assert resp.status_code == 200, resp.text
    return resp, resp.json()["phases"]


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 1. THE RED DRIVER — a jsonb STRING SCALAR row surfaces its reason (D-214-23(b))
# ═══════════════════════════════════════════════════════════════════════════════════════════


def test_the_reason_reaches_the_client_from_a_STRING_SCALAR_row(client, monkeypatch):
    """The 38-of-43 shape. THIS is the case a dict-only reader ships green and reads empty on.

    OBSERVED RED against the pre-fix source (no `failure_reason` field existed at all):
    ``KeyError: 'failure_reason'`` — the key was absent from the serialized phase object.
    """
    _, phases = _phases(
        client, monkeypatch, [_phase_row("notify", 0, _REASON_STRING_SCALAR)]
    )
    assert phases[0]["failure_reason"] == _REAL_REASON


def test_THE_COUNTERFACTUAL_a_dict_only_reader_finds_nothing_on_that_same_row(client, monkeypatch):
    """The driven counterfactual: the old shape, re-stated locally, over the SAME fixture.

    Non-vacuity is the first assertion — the reason IS in the payload — so this can never pass
    because the fixture was empty.
    """
    assert _REAL_REASON in _REASON_STRING_SCALAR  # positive control: it really is in there
    # The dict-only reader finds NOTHING on the shape 38 of 43 failed rows actually have…
    assert _dict_only_reader(_REASON_STRING_SCALAR) is None
    # …while the shipped door parses it, and the wire carries it.
    assert phase_output_object(_REASON_STRING_SCALAR)["_failure_reason"] == _REAL_REASON
    _, phases = _phases(client, monkeypatch, [_phase_row("notify", 0, _REASON_STRING_SCALAR)])
    assert phases[0]["failure_reason"] == _REAL_REASON


def test_the_dict_only_reader_DOES_find_it_on_the_2_of_43_object_rows(client, monkeypatch):
    """The counterfactual's own positive control — it is not simply broken for every input.

    Without this, "the old reader finds nothing" would be satisfied by a reader that finds
    nothing anywhere, which measures the assertion rather than the defect.
    """
    assert _dict_only_reader(_REASON_OBJECT) == _REAL_REASON


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 2. THE OTHER ARMS — object, absent, null output, unparseable
# ═══════════════════════════════════════════════════════════════════════════════════════════


def test_the_object_arm_carries_the_reason_too(client, monkeypatch):
    _, phases = _phases(client, monkeypatch, [_phase_row("notify", 0, _REASON_OBJECT)])
    assert phases[0]["failure_reason"] == _REAL_REASON


def test_an_ABSENT_reason_is_null_and_never_an_empty_string(client, monkeypatch):
    """⚠ ABSENT and EMPTY must stay different facts, or `reason_unknown` loses its meaning.

    The panel's sentinel exists to say *"the backend did not capture this"*. If an absent
    reason arrived as `""` the sentinel would still fire but the wire would have stopped being
    able to say WHY — and a `""` that ever appeared would be indistinguishable from it.
    """
    _, phases = _phases(client, monkeypatch, [_phase_row("gather", 0, {"text": "done"})])
    assert phases[0]["failure_reason"] is None
    assert phases[0]["failure_reason"] != ""


def test_a_null_output_yields_a_null_reason(client, monkeypatch):
    _, phases = _phases(client, monkeypatch, [_phase_row("gather", 0, None)])
    assert phases[0]["failure_reason"] is None


def test_an_unparseable_output_string_yields_a_null_reason_and_never_raises(client, monkeypatch):
    """Model-influenced jsonb. The route must degrade, never 500 the run page for its owner."""
    _, phases = _phases(client, monkeypatch, [_phase_row("gather", 0, "{not json at all")])
    assert phases[0]["failure_reason"] is None


def test_a_whitespace_only_reason_normalises_to_null(client, monkeypatch):
    """`""` is impossible by construction (`fail_phase` always writes a non-empty reason).

    If one is ever read anyway, it becomes `None` so the sentinel keeps meaning
    NOT RECORDED rather than "recorded as nothing".
    """
    _, phases = _phases(
        client, monkeypatch, [_phase_row("notify", 0, {"_failure_reason": "   "})]
    )
    assert phases[0]["failure_reason"] is None


def test_a_non_string_reason_is_refused_rather_than_coerced(client, monkeypatch):
    _, phases = _phases(
        client, monkeypatch, [_phase_row("notify", 0, {"_failure_reason": {"nested": 1}})]
    )
    assert phases[0]["failure_reason"] is None


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 3. THE THREAT REGISTER — T-214-02-02 (tampering) and T-214-02-03 (DoS)
# ═══════════════════════════════════════════════════════════════════════════════════════════


def test_T_214_02_02_a_script_bearing_reason_round_trips_as_TEXT_not_markup(client, monkeypatch):
    """Third-party error text now reaches two client surfaces that never rendered it.

    The wire carries it as a plain `str`; React renders it as a text node. This case pins the
    wire half — the value arrives byte-identical and is NOT html-typed, escaped or rewritten,
    so the render site is the ONE place responsible (plan 214-11), and it is a text node.
    """
    hostile = "<script>alert(1)</script> refused: permission not granted"
    _, phases = _phases(
        client, monkeypatch, [_phase_row("notify", 0, {"_failure_reason": hostile})]
    )
    assert phases[0]["failure_reason"] == hostile
    assert isinstance(phases[0]["failure_reason"], str)


def test_T_214_02_03_a_deeply_nested_output_string_degrades_and_never_raises():
    """`json.loads` recurses per nesting level; `RecursionError` is NOT a `ValueError`.

    This plan reads THROUGH `phase_output_object`, which already names `RecursionError` in its
    catch tuple, and adds no second parser. Driven here rather than trusted.
    """
    bomb = "[" * 20000 + "]" * 20000
    assert phase_output_object(bomb) is None


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 4. THE STRUCTURAL FENCES — one door, one parse, and a SELECT that moved not one byte
# ═══════════════════════════════════════════════════════════════════════════════════════════


def _module_source(rel_path: str) -> str:
    return (REPO_ROOT / rel_path).read_text(encoding="utf-8")


def test_this_plan_ADDED_no_new_parse_site():
    """The `phase_output_object(` call-site count is UNCHANGED from the base commit.

    ⚠ **THE RECORDED NUMBER IS TWO, NOT ONE, AND IT WAS MEASURED RATHER THAN ASSUMED.** This
    plan's acceptance criterion says "the pre-existing call sites plus zero"; the pre-existing
    count reads **2** — `read_workflow_run`'s per-row loop (`:825`) and a second route's
    single-row read (`:932`). "One parse per row" is a per-loop property, not a per-module one,
    and stating it as `== 1` would have been a fence asserting a number the module never had.
    What this plan must not do is add a THIRD, and that is what is pinned.
    """
    calls = _module_source("backend/app/api/workflow_runs.py").count("phase_output_object(")
    base_calls = _blob_at_base("backend/app/api/workflow_runs.py").count("phase_output_object(")
    assert calls == base_calls == 2


def _star_selects(source: str) -> list[ast.Call]:
    """Every `.select("*")` CALL — from the AST, so a comment can never be one."""
    return [
        node
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "select"
        and any(isinstance(a, ast.Constant) and a.value == "*" for a in node.args)
    ]


def _select_calls(source: str) -> list[ast.Call]:
    return [
        node
        for node in ast.walk(ast.parse(source))
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "select"
    ]


def test_the_read_is_never_widened_to_a_star_select():
    """A star select would 'work' and would WEAKEN the read. Asserted at zero CALL SITES.

    ⚠ **THE PLAIN GREP THE PLAN ASKED FOR IS UNSATISFIABLE AT HEAD, AND THAT IS THE 187-24
    TRAP RATHER THAN A DEFECT IN THE SOURCE.** This module's own two comments — at `:727` and
    at `:752` — SPELL the forbidden form in order to reject it in writing, so a whole-file
    count reads 2 and can only be driven to 0 by deleting the two paragraphs that state the
    rule. Measured, not predicted: the grep read `2 == 0` on the unmodified base commit.
    An AST walk sees CALLS and never prose, so this fence pins the property the criterion
    meant rather than the spelling it named.
    """
    src = _module_source("backend/app/api/workflow_runs.py")
    assert _star_selects(src) == []
    # ── NON-VACUITY — the walk really reaches this module's `.select(...)` calls ──
    # Without it, a matcher that finds nothing at all passes exactly as happily.
    assert len(_select_calls(src)) >= 3
    # …and the contrast that makes the trap visible rather than merely asserted.
    assert src.count('select("*")') == 2  # both in COMMENTS; the AST sees neither


def _select_literals_of(source: str, func_name: str) -> list[str]:
    """Every SQL string constant inside one function — the DOCSTRING deliberately excluded.

    ⚠ THE EXCLUSION IS LOAD-BEARING AND WAS MEASURED. This plan's own added docstring paragraph
    contains the word `SELECT` (it states that the statement must not move), so a naive "every
    constant containing SELECT" walk picked the PROSE up and the fence reddened on the comment
    that documents the rule. That is the 187-24 trap, one file over. A docstring is the first
    statement of the function body and is skipped structurally, never by string matching.
    """
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == func_name:
            body = node.body
            if (
                body
                and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)
            ):
                body = body[1:]
            found: list[str] = []
            for stmt in body:
                found.extend(
                    n.value
                    for n in ast.walk(stmt)
                    if isinstance(n, ast.Constant)
                    and isinstance(n.value, str)
                    and "SELECT" in n.value
                )
            return found
    raise AssertionError(f"{func_name} not found")


def test_load_run_phases_SQL_is_byte_identical_to_the_base_commit():
    """The gap is PROJECTION, not SELECTION — `output` was already selected on all three readers.

    So the SQL must not move. Diffed against the plan's base SHA rather than eyeballed.
    """
    now = _select_literals_of(
        _module_source("backend/app/db/workflows.py"), "load_run_phases"
    )
    base = _select_literals_of(
        _blob_at_base("backend/app/db/workflows.py"), "load_run_phases"
    )
    assert now == base
    # Non-vacuity: the extraction really found the statement it claims to be pinning.
    assert len(now) == 1
    assert "workflow_phases" in now[0]
    assert "output" in now[0]


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 5. THE MODEL — the field exists and is nullable (declaration only; see group (a) below)
# ═══════════════════════════════════════════════════════════════════════════════════════════


def test_failure_reason_is_declared_nullable_with_a_None_default():
    """`None` must remain EXPRESSIBLE — an absent reason is a fact, not a missing value."""
    field = WorkflowRunPhaseRead.model_fields["failure_reason"]
    assert field.default is None
    assert field.is_required() is False


# ═══════════════════════════════════════════════════════════════════════════════════════════
# 6. TASK 2 — THE TWO WIRE MODELS
#
# ⚠ **GROUP (a) AND GROUP (b) CHECK DIFFERENT PROPERTIES AND ARE NAMED SO THEY CANNOT BE
# CONFUSED.** A `model_fields` check passes, unchanged, on a field that is `None` on every row
# for the life of the product — and because `214-11`'s `serviceOf` renders the ACTION ALONE
# when `service_name` is `null` (the honest arm), such a field ships with every typecheck
# green, every unit case green and nothing on screen looking wrong. The only assertion that
# fails in that world is a VALUE assertion over each builder's real serializer path. That is
# group (b), and it is not substitutable by group (a).
# ═══════════════════════════════════════════════════════════════════════════════════════════

_FOUR_FIELDS = {"failure_reason", "tool_name", "capability", "service_name"}

# An `external_action` step bound to a REAL connection row. The strings are distinct from every
# other string in this file so an assertion cannot pass by coincidence.
_CONN_ID = "7e1a2b3c-0000-4000-8000-0000002140c0"
_CONN_NAME = "Acme Slack (production)"
_DEAD_CONN_ID = "7e1a2b3c-0000-4000-8000-0000002140dd"

_EXTERNAL_DEFINITION = {
    "slug": "wiki-sync",
    "version": 1,
    "name": "Wiki sync",
    "phases": [
        {"slug": "gather", "phase_index": 0, "config": {"phase_type": "llm_agent"}},
        {
            "slug": "notify",
            "phase_index": 1,
            "config": {
                "phase_type": "external_action",
                "tool_name": "post_message",
                "capability": "post_message",
                "connection_id": _CONN_ID,
            },
        },
    ],
}


def _dead_connection_definition():
    """The same definition, bound to a connection id no row answers for."""
    import copy

    defn = copy.deepcopy(_EXTERNAL_DEFINITION)
    defn["phases"][1]["config"]["connection_id"] = _DEAD_CONN_ID
    return defn


_CONNECTION_ROWS = [
    {
        "id": _CONN_ID,
        "org_id": "7e1a2b3c-0000-4000-8000-0000002140ff",
        "name": _CONN_NAME,
        "capability": "post_message",
        # ⚠ PLANTED SO THE PROJECTION CAN BE MEASURED RATHER THAN TRUSTED. `_FakeSupabase`
        # REALLY projects, so a handler that asked for a column it should not have would
        # receive it — and these two are exactly what T-214-02-01 is about.
        "config": {"webhook": "https://hooks.example.invalid/T000/B000/xyz"},
        "mcp_server_url": "https://mcp.example.invalid/sse",
    }
]


# ── (a) DECLARATION — mechanical, over `model_fields`. NOT a population check. ─────────────


def test_both_models_DECLARE_the_four_fields_neither_widened_alone():
    """The two halves of ONE contract, asserted mechanically rather than by prose.

    `models/thread.py`'s two-wire-model rule states it in writing — *"widening only the other
    model would ship a run page with durations and a chat panel without them"* — and PATTERNS
    §G names that prose the weakest of the five same-commit pairs. This is its mechanical form:
    the case fails if EITHER side is widened alone.

    ⚠ **THIS PASSES, UNCHANGED, ON A FIELD THAT IS `None` ON EVERY ROW FOREVER.** It says the
    field is declared and says nothing about whether anything populates it. The population is
    group (b) below, and it may never be substituted by this case.
    """
    from app.models.thread import WorkflowPhaseState

    assert set(WorkflowRunPhaseRead.model_fields) >= _FOUR_FIELDS
    assert set(WorkflowPhaseState.model_fields) >= _FOUR_FIELDS
    # Widened TOGETHER: the two intersections agree, so widening one alone reds this.
    assert (
        (set(WorkflowRunPhaseRead.model_fields) & _FOUR_FIELDS)
        == (set(WorkflowPhaseState.model_fields) & _FOUR_FIELDS)
        == _FOUR_FIELDS
    )


def test_all_four_are_nullable_on_both_models_so_an_ABSENCE_stays_expressible():
    from app.models.thread import WorkflowPhaseState

    for model in (WorkflowRunPhaseRead, WorkflowPhaseState):
        for name in sorted(_FOUR_FIELDS):
            field = model.model_fields[name]
            assert field.default is None, f"{model.__name__}.{name} must default to None"
            assert field.is_required() is False


# ── (b) POPULATION, `WorkflowRunPhaseRead` — a VALUE off the run page's real path ──────────


def test_POPULATION_run_page_carries_the_resolved_service_and_action(client, monkeypatch):
    """The run page's wire carries a REAL `service_name`, equal to the connection row's `name`.

    ⚠ **THE COUNTERFACTUAL THIS CASE EXISTS FOR:** a build whose serializer loop DECLARES the
    three identity fields and passes no value for them. `model_fields` still passes. Every
    typecheck still passes. `214-11`'s `serviceOf` renders the action alone on a `null` service
    — the honest arm — so `RunSpine` and `RunStepList` look correct while having lost the
    service permanently, and `214-11`'s own per-surface cases stay green because they SEED the
    prop and therefore supply the very hop that is broken. **This assertion is the only thing
    that reds in that world.** Delete `service_name=service_name` from the serializer and this
    goes red; nothing else in the repository does.
    """
    _, phases = _phases(
        client,
        monkeypatch,
        [_phase_row("notify", 0, _REASON_STRING_SCALAR)],
        connections=_CONNECTION_ROWS,
        definition=_EXTERNAL_DEFINITION,
    )
    assert phases[0]["service_name"] == _CONN_NAME
    assert isinstance(phases[0]["service_name"], str) and phases[0]["service_name"].strip()
    assert phases[0]["tool_name"] == "post_message"
    assert phases[0]["capability"] == "post_message"


def test_POPULATION_run_page_an_unresolvable_connection_is_null_with_NO_substitute(
    client, monkeypatch
):
    """The paired NEGATIVE. A deleted / another-org's connection yields `null`, not a stand-in.

    ⚠ Asserted over the WHOLE serialized payload, not merely the field: a substitute smuggled
    in anywhere (the capability id used as a name, the connection id, the words "Unknown
    service") would evade a field-only check.
    """
    resp, phases = _phases(
        client,
        monkeypatch,
        [_phase_row("notify", 0, _REASON_STRING_SCALAR)],
        connections=_CONNECTION_ROWS,  # the row EXISTS — the step just points elsewhere
        definition=_dead_connection_definition(),
    )
    assert phases[0]["service_name"] is None
    # …while the ACTION is still named: the absence is scoped to the thing we cannot know.
    assert phases[0]["tool_name"] == "post_message"
    assert "Unknown service" not in resp.text
    assert _CONN_NAME not in resp.text  # no guessing from the one resolvable row
    assert _DEAD_CONN_ID not in str(phases[0])  # the id is never rendered as a name


def test_POPULATION_a_non_external_action_phase_carries_three_NULLS_on_the_run_page(
    client, monkeypatch
):
    """A phase type with no service and no action says so, rather than borrowing one."""
    _, phases = _phases(
        client,
        monkeypatch,
        [_phase_row("gather", 0, {"text": "…"}, status="completed")],
        connections=_CONNECTION_ROWS,
        definition=_EXTERNAL_DEFINITION,
    )
    assert phases[0]["slug"] == "gather"
    assert phases[0]["tool_name"] is None
    assert phases[0]["capability"] is None
    assert phases[0]["service_name"] is None


def test_T_214_02_01_only_the_display_name_crosses_from_the_connection_row(client, monkeypatch):
    """The connection's URL-bearing columns never reach the wire — planted, then measured.

    `_FakeSupabase` REALLY projects, so a handler that selected `config` or `mcp_server_url`
    would receive them; the plant is what makes this a measurement rather than a restatement.
    """
    # ── POSITIVE CONTROL — the columns really were on the row before serialization ──
    assert "mcp_server_url" in _CONNECTION_ROWS[0]
    assert "config" in _CONNECTION_ROWS[0]

    resp, phases = _phases(
        client,
        monkeypatch,
        [_phase_row("notify", 0, _REASON_STRING_SCALAR)],
        connections=_CONNECTION_ROWS,
        definition=_EXTERNAL_DEFINITION,
    )
    assert phases[0]["service_name"] == _CONN_NAME
    assert "mcp.example.invalid" not in resp.text
    assert "hooks.example.invalid" not in resp.text
    # A URL-shaped service name would mean the wrong column was read into the right field.
    for token in ("http", "://"):
        assert token not in phases[0]["service_name"]


def test_the_connection_lookup_is_ONE_query_for_the_whole_run(client, monkeypatch):
    """Resolved BEFORE the loop, not inside it: three phases on one connection ⇒ ONE select.

    Falsifiable by moving the lookup inside `for row in phase_rows` — the count becomes 3.
    """
    store = _store(
        [
            _phase_row("notify", 0, _REASON_STRING_SCALAR),
            _phase_row("notify", 1, _REASON_STRING_SCALAR),
            _phase_row("notify", 2, _REASON_STRING_SCALAR),
        ],
        connections=_CONNECTION_ROWS,
        definition=_EXTERNAL_DEFINITION,
    )
    _canvas_on(monkeypatch, store)
    resp = client.get(f"/workflow-runs/{_RUN_ID}")
    assert resp.status_code == 200, resp.text
    assert len(resp.json()["phases"]) == 3  # non-vacuity: three rows really were served
    executes = [c for c in store.calls if c[0] == "execute" and c[1] == "connector_connections"]
    assert len(executes) == 1


def test_no_connection_query_is_issued_when_no_step_binds_one(client, monkeypatch):
    """A run with no external step asks the connections table nothing at all."""
    store = _store(
        [_phase_row("gather", 0, {"text": "…"}, status="completed")],
        connections=_CONNECTION_ROWS,
        definition=_DEFINITION_JSON,  # no external_action phase
    )
    _canvas_on(monkeypatch, store)
    resp = client.get(f"/workflow-runs/{_RUN_ID}")
    assert resp.status_code == 200, resp.text
    assert [c for c in store.calls if c[1] == "connector_connections"] == []


# ── (b) POPULATION, `WorkflowPhaseState` — a VALUE off the CHAT PANEL's real path ──────────
#
# The chat frame is served by `GET /threads/{id}/workflow`, which reads through the asyncpg
# user-JWT path rather than a supabase client — so its seam is the conftest mocked pool, and
# the read ORDER is the contract:
#   fetchrow (1) the deep cap_paused probe · (2) the latest workflow_runs row · (3) the
#   definition join;   fetch (1) the phase rows · (2) the connection names.
# ⚠ The connection fetch is the LAST one and is CONDITIONAL, which is why every pre-existing
# suite that drives this route is unaffected: a run with no external step never issues it.


def _thread_phase_row(slug, index, output, *, status="failed"):
    return {
        "slug": slug,
        "phase_index": index,
        "status": status,
        "started_at": None,
        "completed_at": None,
        "output": output,
    }


def _thread_frame(
    client, mock_asyncpg_pool, mock_execute_result, phase_rows, *, definition, connection_rows
):
    """Drive the REAL `GET /threads/{id}/workflow` and hand back ``(response, phases)``."""
    import uuid as _uuid
    from unittest.mock import AsyncMock, patch

    from app.dependencies import get_user_supabase_client
    from app.main import app

    # ⚠ THE TWO ROUTES SHARE ONE DEPENDENCY, AND THE AGREEMENT CASE DRIVES BOTH IN ONE TEST.
    # `_canvas_on` overrides `get_user_supabase_client` with the RUN PAGE's projecting fake;
    # the thread route resolves its ownership check through that SAME dependency and answers
    # `404 Thread not found` against a store that holds no `threads` table. Measured, not
    # predicted — and clearing the override is NOT the repair either: conftest installs its own
    # override there, which is what `mock_execute_result` drives, so popping it 404s too.
    # (Both wrong answers were observed, in that order.) The order therefore matters, so it is
    # made LOUD rather than left to a future reader to rediscover from a 404.
    assert get_user_supabase_client not in app.dependency_overrides or not isinstance(
        app.dependency_overrides[get_user_supabase_client](), _FakeSupabase
    ), (
        "the run page's `_FakeSupabase` is still installed on `get_user_supabase_client`; "
        "drive `_thread_frame` BEFORE `_phases` in any case that uses both"
    )

    thread_id = _uuid.uuid4()
    run_id = _uuid.uuid4()
    mock_execute_result.data = {"id": str(thread_id), "active_workflow_run_id": None}
    mock_asyncpg_pool.set_fetchrow_results(
        [
            None,  # the deep cap_paused probe
            {"id": run_id, "status": "failed", "created_at": None, "updated_at": None},
            {"definition": definition},  # the definition join
        ]
    )
    mock_asyncpg_pool.set_fetch_results([list(phase_rows), list(connection_rows)])

    with patch("app.api.threads.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)), patch(
        "app.dependencies.get_pg_pool", AsyncMock(return_value=mock_asyncpg_pool)
    ):
        resp = client.get(f"/threads/{thread_id}/workflow")
    assert resp.status_code == 200, resp.text
    return resp, resp.json()["phases"]


def test_POPULATION_chat_panel_carries_the_reason_and_the_resolved_service(
    client, mock_asyncpg_pool, mock_execute_result
):
    """The SAME four facts on the SECOND wire model, off `threads.py`'s own builder.

    This is the half the two-wire-model rule exists to force: the chat panel and the run page
    read the same rows and must not disagree about them. Falsifiable by deleting any of the
    four keyword arguments from the `WorkflowPhaseState(...)` call.
    """
    _, phases = _thread_frame(
        client,
        mock_asyncpg_pool,
        mock_execute_result,
        [_thread_phase_row("notify", 0, _REASON_STRING_SCALAR)],
        definition=_EXTERNAL_DEFINITION,
        connection_rows=[{"id": _CONN_ID, "name": _CONN_NAME}],
    )
    assert phases[0]["failure_reason"] == _REAL_REASON
    assert phases[0]["service_name"] == _CONN_NAME
    assert phases[0]["tool_name"] == "post_message"
    assert phases[0]["capability"] == "post_message"


def test_POPULATION_chat_panel_an_unresolvable_connection_is_null_with_NO_substitute(
    client, mock_asyncpg_pool, mock_execute_result
):
    resp, phases = _thread_frame(
        client,
        mock_asyncpg_pool,
        mock_execute_result,
        [_thread_phase_row("notify", 0, _REASON_STRING_SCALAR)],
        definition=_dead_connection_definition(),
        connection_rows=[],  # the id resolves to no row
    )
    assert phases[0]["service_name"] is None
    assert phases[0]["tool_name"] == "post_message"
    assert "Unknown service" not in resp.text
    assert _DEAD_CONN_ID not in str(phases[0])


def test_POPULATION_chat_panel_a_non_external_action_phase_carries_three_NULLS(
    client, mock_asyncpg_pool, mock_execute_result
):
    _, phases = _thread_frame(
        client,
        mock_asyncpg_pool,
        mock_execute_result,
        [_thread_phase_row("gather", 0, {"text": "…"}, status="completed")],
        definition=_EXTERNAL_DEFINITION,
        connection_rows=[{"id": _CONN_ID, "name": _CONN_NAME}],
    )
    assert phases[0]["tool_name"] is None
    assert phases[0]["capability"] is None
    assert phases[0]["service_name"] is None


def test_the_chat_panel_reads_the_reason_off_a_STRING_SCALAR_row_too(
    client, mock_asyncpg_pool, mock_execute_result
):
    """`threads.py`'s builder read `declared_phase_measure(r["output"])` off the RAW value.

    It is ported to the parse-once shape here, so the reason and the measure come off ONE
    unwrap on BOTH shapes. This case pins the string-scalar arm on the CHAT side specifically —
    the run-page arm proves nothing about it.
    """
    _, phases = _thread_frame(
        client,
        mock_asyncpg_pool,
        mock_execute_result,
        [
            _thread_phase_row(
                "notify",
                0,
                json.dumps(
                    {
                        "_failure_reason": _REAL_REASON,
                        "_measure": {"count": 4, "noun": "fields"},
                    }
                ),
            )
        ],
        definition=_EXTERNAL_DEFINITION,
        connection_rows=[{"id": _CONN_ID, "name": _CONN_NAME}],
    )
    assert phases[0]["failure_reason"] == _REAL_REASON
    assert (phases[0]["step_count"], phases[0]["step_noun"]) == (4, "fields")


# ── AGREEMENT — the two models must not disagree about the same row ────────────────────────


def test_AGREEMENT_the_identity_values_are_equal_on_both_models(
    client, monkeypatch, mock_asyncpg_pool, mock_execute_result
):
    """One identical fixture definition + phase row, read through BOTH builders.

    The chat panel and the run page read the SAME `workflow_phases` rows. This is the
    disagreement the two-wire-model rule was written to prevent, asserted rather than trusted
    to two independently-written builders staying in step.
    """
    # ⚠ THE CHAT FRAME IS DRIVEN FIRST, DELIBERATELY — see `_thread_frame`'s own guard: the
    # two routes share `get_user_supabase_client`, and the run page's fake store answers the
    # thread route's ownership check with a 404.
    _, chat_phases = _thread_frame(
        client,
        mock_asyncpg_pool,
        mock_execute_result,
        [_thread_phase_row("notify", 0, _REASON_STRING_SCALAR)],
        definition=_EXTERNAL_DEFINITION,
        connection_rows=[{"id": _CONN_ID, "name": _CONN_NAME}],
    )
    _, run_phases = _phases(
        client,
        monkeypatch,
        [_phase_row("notify", 0, _REASON_STRING_SCALAR)],
        connections=_CONNECTION_ROWS,
        definition=_EXTERNAL_DEFINITION,
    )
    for key in ("tool_name", "capability", "service_name", "failure_reason"):
        assert run_phases[0][key] == chat_phases[0][key], f"the two models disagree about {key}"
    # Non-vacuity: they agree on VALUES, not on a pair of Nones.
    assert run_phases[0]["service_name"] == _CONN_NAME
    assert run_phases[0]["failure_reason"] == _REAL_REASON


# ── ONE DERIVATION, TWO CONSUMERS — and the two shipped phase_type loops left alone ────────


def _function_source(source: str, name: str) -> str:
    tree = ast.parse(source)
    lines = source.splitlines()
    for node in ast.walk(tree):
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)) and node.name == name:
            return "\n".join(lines[node.lineno - 1 : node.end_lineno])
    raise AssertionError(f"{name} not found")


def test_one_definition_to_identity_derivation_imported_by_BOTH_api_modules():
    """Two copies of one derivation is how two surfaces come to disagree. There is one."""
    threads_src = _module_source("backend/app/api/threads.py")
    runs_src = _module_source("backend/app/api/workflow_runs.py")
    models_src = _module_source("backend/app/models/thread.py")
    assert "def step_identity(" in models_src
    assert "step_identity" in threads_src
    assert "step_identity" in runs_src
    # …and it is IMPORTED from the one home rather than re-declared in either module.
    assert "def step_identity(" not in threads_src
    assert "def step_identity(" not in runs_src


def test_the_two_shipped_phase_type_loops_are_byte_unchanged():
    """The new derivation sits BESIDE them; re-pointing them is a refactor this plan does not own."""
    runs_now = _module_source("backend/app/api/workflow_runs.py")
    runs_base = _blob_at_base("backend/app/api/workflow_runs.py")
    assert _function_source(runs_now, "_slug_to_phase_type") == _function_source(
        runs_base, "_slug_to_phase_type"
    )
    threads_now = _module_source("backend/app/api/threads.py")
    threads_base = _blob_at_base("backend/app/api/threads.py")
    marker = "slug_to_type[slug] = ptype"
    assert threads_now.count(marker) == threads_base.count(marker) == 1


# ⚠ ASSEMBLED FROM PARTS so this suite's OWN source can never satisfy a grep run over it
# (the 187-24 discipline). The two halves are never adjacent as a literal anywhere below.
_SUBSTITUTE = "Unknown" + " service"


def _emittable_string_constants(source: str) -> list[str]:
    """Every string constant a request could EMIT — docstrings and field docs excluded.

    ⚠ **THIS FENCE'S FIRST DRAFT WAS A WHOLE-FILE GREP AND IT FIRED ON ITS OWN RULE.** The
    plan's criterion is `grep -rn "Unknown service" backend/app | wc -l` == 0, and the two
    serializers now carry comments and a Pydantic field description that SPELL the forbidden
    substitute in order to forbid it — so the grep read 3 and could only be driven to 0 by
    deleting the paragraphs that state the rule. That is the 187-24 trap, which this repo has
    recorded six times, and it fired here on the third try in one plan.

    The property that actually matters is *no code path EMITS it as a value*. So:
      · `#` comments are invisible to the AST by construction;
      · a docstring is the first statement of a module / class / function and is skipped;
      · a `description=` keyword is Pydantic FIELD DOCUMENTATION, not an emittable value,
        and is skipped for the same reason.
    Everything else is a string this package could put on a wire, and none of it may be the
    substitute. The positive control below plants one and proves the matcher sees it.
    """
    tree = ast.parse(source)
    skip: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = getattr(node, "body", [])
            if (
                body
                and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)
            ):
                skip.add(id(body[0].value))
        if isinstance(node, ast.Call):
            for kw in node.keywords:
                if kw.arg == "description" and isinstance(kw.value, ast.Constant):
                    skip.add(id(kw.value))
                # A description built by implicit concatenation arrives as one Constant; a
                # parenthesised multi-part one is a single Constant too. A JoinedStr would not
                # be — and is deliberately NOT skipped, because an f-string in a field doc
                # could interpolate a value.
    return [
        n.value
        for n in ast.walk(tree)
        if isinstance(n, ast.Constant) and isinstance(n.value, str) and id(n) not in skip
    ]


def test_T_214_02_04_no_substitute_service_name_is_EMITTABLE_anywhere_in_the_backend():
    """A fabricated service name is a SPOOF. Swept over every module in `backend/app`.

    An unresolvable connection yields `None`, and the surface renders the ACTION ALONE —
    `grounding.py`'s shipped rule: never draw a name the system cannot know.
    """
    root = REPO_ROOT / "backend" / "app"
    files = sorted(root.rglob("*.py"))
    offenders = []
    for path in files:
        text = path.read_text(encoding="utf-8")
        if _SUBSTITUTE not in text:
            continue  # cheap pre-filter; the AST walk is the decision
        if any(_SUBSTITUTE in const for const in _emittable_string_constants(text)):
            offenders.append(str(path))
    assert offenders == []
    # ── NON-VACUITY — the sweep really walked the package ──
    assert len(files) > 50
    # ── AND THE PRE-FILTER REALLY MATCHED SOMETHING, so the AST walk was actually reached.
    # If this ever reads 0 the fence has gone vacuous: nothing in the package would even
    # mention the rule, and the walk above would never run on a single file.
    hits = [p for p in files if _SUBSTITUTE in p.read_text(encoding="utf-8")]
    assert hits, "no module mentions the forbidden substitute — this fence is now vacuous"


def test_the_substitute_fence_can_SEE_a_planted_emission():
    """POSITIVE CONTROL — the matcher distinguishes an EMISSION from the prose that forbids it."""
    forbidding_prose = "\n".join(
        [
            '"""A module docstring that names ' + _SUBSTITUTE + ' in order to forbid it."""',
            "# A comment that also names " + _SUBSTITUTE + ".",
            "from pydantic import BaseModel, Field",
            "class M(BaseModel):",
            "    x: str | None = Field(default=None, description=(",
            '        "never ' + _SUBSTITUTE + '"',
            "    ))",
        ]
    )
    planted = forbidding_prose + "\n" + 'FALLBACK = "' + _SUBSTITUTE + '"\n'

    # The prose-only source is CLEAN…
    assert not any(_SUBSTITUTE in c for c in _emittable_string_constants(forbidding_prose))
    # …while the same source plus ONE emittable literal is caught.
    assert any(_SUBSTITUTE in c for c in _emittable_string_constants(planted))


# ── the shared derivation itself, as a pure function ───────────────────────────────────────


def test_step_identity_contributes_nothing_for_a_non_external_phase():
    """Every other phase type is ABSENT from the mapping, so all three fields resolve None."""
    from app.models.thread import step_identity

    non_external = {
        "slug": "reporting",
        "phases": [
            {"slug": "gather", "config": {"phase_type": "llm_agent"}},
            {"slug": "draft", "config": {"phase_type": "llm_single"}},
            {"slug": "confirm", "config": {"phase_type": "llm_human_input"}},
        ],
    }
    assert step_identity(non_external) == {}
    # …and the SAME walk does find one when there is one, so this is not a broken matcher.
    assert step_identity(_EXTERNAL_DEFINITION) != {}


def test_step_identity_reads_the_three_fields_off_an_external_action_phase():
    from app.models.thread import step_identity

    assert step_identity(_EXTERNAL_DEFINITION) == {
        "notify": ("post_message", "post_message", _CONN_ID)
    }


def test_step_identity_parses_a_definition_that_arrives_as_a_json_STRING():
    """`workflow_definitions.definition` is a jsonb string scalar on 261 of 291 rows."""
    from app.models.thread import step_identity

    assert step_identity(json.dumps(_EXTERNAL_DEFINITION)) == {
        "notify": ("post_message", "post_message", _CONN_ID)
    }


def test_step_identity_never_raises_on_anything_malformed():
    """It reads authored / model-influenced JSON on two read paths that must not 500."""
    from app.models.thread import step_identity

    for bad in (
        None,
        7,
        "not json",
        "[1,2,3]",
        [],
        {"phases": "not a list"},
        {"phases": [None, 3, "x"]},
        {"phases": [{"slug": "a"}]},  # no config
        {"phases": [{"config": {"phase_type": "external_action"}}]},  # no slug
    ):
        assert isinstance(step_identity(bad), dict)
    # An external step that names nothing contributes three honest Nones — an absence, not a guess.
    assert step_identity(
        {"phases": [{"slug": "a", "config": {"phase_type": "external_action"}}]}
    ) == {"a": (None, None, None)}


def test_step_identity_refuses_a_non_string_field_rather_than_coercing_it():
    from app.models.thread import step_identity

    got = step_identity(
        {
            "phases": [
                {
                    "slug": "a",
                    "config": {
                        "phase_type": "external_action",
                        "tool_name": 42,
                        "capability": "",
                    },
                }
            ]
        }
    )
    assert got == {"a": (None, None, None)}
