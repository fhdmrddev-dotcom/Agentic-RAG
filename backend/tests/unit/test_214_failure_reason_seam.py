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
