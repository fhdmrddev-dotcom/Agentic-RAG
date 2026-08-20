"""Phase 200.1 (RUN-04 / D-200.1-02-A / D-200.1-02-B) — the deliverable arm's wire fence.

``GET /workflow-runs/{id}`` now carries ONE new field, ``WorkflowRunPhaseRead.deliverable_text``:
the phase's own ``output["text"]``, the answer the step produced. That field opens a boundary
that did not exist before — **a jsonb column that has never been on the wire now has one key on
it** — and ``_persist_output`` stores each executor's dict FULL AND INLINE, so the same object
carries retrieval citations, internal sub-run ids, field maps and prompts.

This file exists to prove the exposure is bounded, and to prove it **the way that can fail**:

  1. **The leak fence is a SET EQUALITY over the real ``response.json()``**, not a list of
     per-key absences. A deny-list only refuses the keys someone thought to name — and a census
     of all 588 non-null ``output`` values on the live local DB (2026-08-20) found NINETEEN
     distinct keys, EIGHT of which appear in no design document at all (``answer``,
     ``retrieved_ids``, ``placeholder_keys``, ``sub_questions``, ``sub_run_ids``, ``failure``,
     ``recorded_intent``, ``_surfaced``). **The deny-list was already incomplete on the day it
     would have been written**, which is Phase 185's recorded finding that such a list cannot be
     made fail-closed. A set equality also fails on a key invented tomorrow. The per-key absence
     assertions are kept ALONGSIDE it, so a failure NAMES the leaked key instead of only
     reporting a mismatched set.
  2. **A POSITIVE CONTROL for non-vacuity.** Every leak assertion is preceded by an assertion
     that the planted keys WERE on the row before serialization. Without it the fence passes
     just as happily against a row that never carried them, which is a green test measuring
     nothing.
  3. **Asserted on the BODY, never on the model and never on the serializer source.** The route
     declares ``response_model=WorkflowRunRead`` and FastAPI **drops undeclared keys silently**,
     so the model and the body are different claims: only the body proves the three-place
     lockstep (projection · model · serializer) actually closed. 192.2 measured the other
     direction on ``api/workflows.py`` — a green db test sitting beside an unchanged UI.
  4. **The string-scalar shape is served too.** ``jsonb_typeof(output) = 'string'`` on **484 of
     484** ``completed`` rows, so a reader that only handles dicts is dead on every historical
     row that matters — silently, because the absent arm renders honestly. Case 4 drives the
     ``json.dumps`` shape and proves ``200.1-01``'s ``phase_output_object`` is the door this
     plan reads through.

**The DB seam is SHARED, not re-implemented.** ``_FakeSupabase`` comes from
``tests/test_188_workflow_run_read.py``, whose ``select`` REALLY PROJECTS — a column the handler
did not ask for is absent from the row it gets back. A second fake built beside it would have
started life without that property, which is how a discarded column list shipped the first time.

Fully offline: no DB, no pg pool, no network.
"""
import ast
import inspect
import json
import textwrap
from pathlib import Path

from tests.test_188_workflow_run_read import (  # noqa: F401 — the shared, projecting DB seam
    _FakeSupabase,
    _flipped_on,
    _is_op_false,
)

_OWNER_ID = "00000000-0000-0000-0000-0000000000a1"
_RUN_ID = "5c0d1e2f-0000-4000-8000-0000002001a0"
_THREAD_ID = "5c0d1e2f-0000-4000-8000-0000002001b0"
_DEF_ID = "5c0d1e2f-0000-4000-8000-0000002001c0"

# The answer a step produced. Deliberately multi-line and punctuated: the client renders it as a
# React text node with `whitespace-pre-wrap`, and a payload that survives JSON round-tripping
# with its newlines intact is part of what makes that render honest.
_ANSWER = "Revenue rose 4.1% QoQ.\n\nDrivers:\n  - renewals\n  - one large new logo"

# ⚠ THE PROMPT SENTINEL IS ASSERTED ABSENT FROM THE WHOLE RESPONSE TEXT, not merely from the
# phase object's keys. A leak through a nested structure, an error body or a validation echo
# would evade a key-set check and would not evade this.
_PROMPT_SENTINEL = "SECRET-SYSTEM-PROMPT-MUST-NOT-SHIP-200-1"

# ⚠ A KEY THAT EXISTS NOWHERE IN THE PRODUCT TODAY. It stands in for the key invented after this
# plan ships — the case a deny-list structurally cannot cover and a set equality catches free.
_NEVER_SEEN_KEY = "quantum_provenance_ledger_v9"

# The six keys named in the ROADMAP's (incomplete) list, kept as their own tuple so a failure
# names the leaked key rather than only reporting a set mismatch.
_ROADMAP_NAMED_KEYS = (
    "citations",
    "source_refs",
    "field_map",
    "tool_call_id",
    "sub_run_id",
    "_internal_prompt",
)

# Every key the live census found, planted at once. `text` is deliberately NOT in here — it is
# the one key that is SUPPOSED to leave, and mixing it in would make the fence untestable.
_PLANTED_INTERNALS = {
    "citations": [{"document_id": "d1", "filename": "q3.pdf", "chunk_index": 4, "passage": "…"}],
    "similarity_scores": [0.91, 0.88],
    "source_refs": ["doc:1", "doc:2"],
    "sub_run_id": "11111111-1111-1111-1111-111111111111",
    "sub_run_ids": ["22222222-2222-2222-2222-222222222222"],
    "field_map": {"customer": "ACME", "quarter": "Q3"},
    "tool_call_id": "call_abc123",
    "retrieved_ids": [7, 8, 9],
    "placeholder_keys": ["{{customer}}"],
    "sub_questions": ["what drove renewals?"],
    "answer": "a SECOND answer-shaped key that is NOT the one we ship",
    "failure": None,
    "_failure_reason": None,
    "_surfaced": True,
    "recorded_intent": {"kind": "email", "to": "someone@example.com"},
    "output_file": "/workspace/report.docx",
    "path": "/workspace/report.docx",
    "_internal_prompt": _PROMPT_SENTINEL,
    _NEVER_SEEN_KEY: "invented-after-this-plan-shipped",
}

# The exact key set `WorkflowRunPhaseRead` declares. Nine fields, no more.
_EXPECTED_PHASE_KEYS = {
    "slug",
    "phase_index",
    "status",
    "phase_type",
    "started_at",
    "completed_at",
    "step_count",
    "step_noun",
    "deliverable_text",
}

_DEFINITION_JSON = {
    "slug": "quarterly-report",
    "version": 1,
    "name": "Quarterly report",
    "phases": [
        {"slug": "gather", "phase_index": 0, "config": {"phase_type": "llm_agent"}},
        {"slug": "draft", "phase_index": 1, "config": {"phase_type": "llm_single"}},
        {"slug": "confirm", "phase_index": 2, "config": {"phase_type": "llm_human_input"}},
    ],
}


def _phase_row(slug, index, output, *, status="completed"):
    row = {
        "workflow_run_id": _RUN_ID,
        "slug": slug,
        "phase_index": index,
        "status": status,
        "started_at": "2026-08-20T10:00:00+00:00",
        "completed_at": "2026-08-20T10:02:00+00:00",
    }
    # ⚠ THE KEY IS OMITTED ENTIRELY when `output` is the `_ABSENT` sentinel — that is a
    # different row shape from `output: None`, and case 5 turns on the distinction.
    if output is not _ABSENT:
        row["output"] = output
    return row


class _Absent:
    """Sentinel: this row has NO ``output`` key at all."""


_ABSENT = _Absent()


def _store(phase_rows) -> _FakeSupabase:
    return _FakeSupabase(
        {
            "workflow_runs": [
                {
                    "id": _RUN_ID,
                    "thread_id": _THREAD_ID,
                    "definition_id": _DEF_ID,
                    "status": "completed",
                    "created_at": "2026-08-20T09:59:00+00:00",
                    "updated_at": "2026-08-20T10:05:00+00:00",
                    "claimed_at": "2026-08-20T09:59:02+00:00",
                    "user_id": _OWNER_ID,
                    "definition_snapshot": _DEFINITION_JSON,
                }
            ],
            "workflow_definitions": [
                {
                    "id": _DEF_ID,
                    "slug": "quarterly-report",
                    "version": 1,
                    "name": "Quarterly report",
                    "definition": _DEFINITION_JSON,
                }
            ],
            "workflow_phases": list(phase_rows),
        }
    )


def _canvas_on(monkeypatch, phase_rows) -> _FakeSupabase:
    """Flag ON + an injected canvas caller + the projecting fake wired onto the user-JWT dep."""
    import app.dependencies as deps
    from app.dependencies import get_user_supabase_client
    from app.main import app

    _flipped_on(monkeypatch)

    async def _fake_caller(credentials, supabase):
        return {"id": _OWNER_ID, "email": "owner@x.co"}

    monkeypatch.setattr(deps, "authenticate_canvas_request", _fake_caller)
    monkeypatch.setattr(deps, "is_operator", _is_op_false)

    store = _store(phase_rows)
    # conftest's autouse reset_mocks restores this override before the next test.
    app.dependency_overrides[get_user_supabase_client] = lambda: store
    return store


def _phases(client, monkeypatch, phase_rows):
    """Drive the real route and hand back ``(response, body["phases"])``."""
    _canvas_on(monkeypatch, phase_rows)
    resp = client.get(f"/workflow-runs/{_RUN_ID}")
    assert resp.status_code == 200, resp.text
    return resp, resp.json()["phases"]


# ══ 1) BEHAVIOR — the field reaches the CLIENT, asserted on the body ═══════════════════════


def test_deliverable_text_reaches_the_client(client, monkeypatch):
    """``phases[0].deliverable_text`` equals the planted answer, read off ``response.json()``.

    ⚠ Asserted on the BODY and not on ``WorkflowRunPhaseRead``. ``response_model`` drops
    undeclared keys silently, so a green model proves nothing about what shipped: only the body
    proves the projection, the model and the serializer all moved. Falsifiable — delete the
    ``deliverable_text=`` argument in the serializer and this reads ``None``.
    """
    output = {"text": _ANSWER, **_PLANTED_INTERNALS}
    _, phases = _phases(client, monkeypatch, [_phase_row("draft", 0, output)])

    assert phases[0]["deliverable_text"] == _ANSWER
    # The newlines survive the trip — the render's `whitespace-pre-wrap` has something to do.
    assert "\n" in phases[0]["deliverable_text"]


# ══ 2) BEHAVIOR — THE LEAK FENCE, as a SET EQUALITY, with its POSITIVE CONTROL ═════════════


def test_phase_object_carries_exactly_the_declared_keys(client, monkeypatch):
    """``set(body["phases"][0])`` is EXACTLY the nine declared fields — nothing else.

    This is the criterion that catches a key invented tomorrow. A list of
    ``assert "citations" not in …`` cannot; it refuses only what someone thought to name, and
    the census proves that list was already incomplete before it was written.
    """
    output = {"text": _ANSWER, **_PLANTED_INTERNALS}
    row = _phase_row("draft", 0, output)

    # ── POSITIVE CONTROL (non-vacuity) — the planted keys WERE on the row ──
    # ⚠ Without this, the fence below passes just as happily against a row that never carried
    # a single internal key. A leak test with nothing to leak is a green test measuring nothing.
    for key in _ROADMAP_NAMED_KEYS:
        assert key in row["output"], f"positive control broken: {key} never planted"
    assert _NEVER_SEEN_KEY in row["output"]
    assert len(row["output"]) == len(_PLANTED_INTERNALS) + 1  # +1 for `text`

    _, phases = _phases(client, monkeypatch, [row])

    assert set(phases[0].keys()) == _EXPECTED_PHASE_KEYS


def test_no_internal_output_key_reaches_the_wire(client, monkeypatch):
    """Per-key absence for the six ROADMAP-named keys, so a failure NAMES the leak.

    Kept ALONGSIDE the set equality rather than instead of it: the set equality is the fence,
    this is the diagnostic. A set mismatch says "the shapes differ"; this says which key.
    """
    output = {"text": _ANSWER, **_PLANTED_INTERNALS}
    row = _phase_row("draft", 0, output)
    for key in _ROADMAP_NAMED_KEYS:  # positive control, again — this test must not be vacuous
        assert key in row["output"]

    resp, phases = _phases(client, monkeypatch, [row])

    for key in _ROADMAP_NAMED_KEYS:
        assert key not in phases[0], f"{key} LEAKED onto the wire"
    for key in _PLANTED_INTERNALS:
        assert key not in phases[0], f"{key} LEAKED onto the wire"

    # ⚠ AND THE PROMPT IS ABSENT FROM THE WHOLE RESPONSE TEXT, not merely from the key set —
    # a leak nested inside `definition`, an error body or a validation echo would evade a
    # key-set check and cannot evade this.
    assert _PROMPT_SENTINEL not in resp.text
    assert _NEVER_SEEN_KEY not in resp.text


# ══ 3) BEHAVIOR — `_measure` still works BESIDE it (the one-parse refactor regressed nothing) ══


def test_measure_survives_the_one_parse_refactor(client, monkeypatch):
    """The same response carries ``step_count`` / ``step_noun`` from the SAME parsed object.

    The serializer now parses each row ONCE (``obj = phase_output_object(...)``) and feeds that
    object to both reads. This pins Phase 200's field pair against that change — a refactor that
    quietly stopped feeding `declared_phase_measure` would go red here rather than in a UI.
    """
    output = {"text": _ANSWER, "_measure": {"count": 312, "noun": "sources"}, **_PLANTED_INTERNALS}
    _, phases = _phases(client, monkeypatch, [_phase_row("gather", 0, output)])

    assert phases[0]["step_count"] == 312
    assert phases[0]["step_noun"] == "sources"
    assert phases[0]["deliverable_text"] == _ANSWER


def test_measure_zero_is_still_distinct_from_null(client, monkeypatch):
    """``0`` is a real measurement and is NOT ``null`` — pinned again beside the new field.

    Phase 200's own rule, re-asserted here because the serializer that produces it moved.
    """
    rows = [
        _phase_row("gather", 0, {"text": "a", "_measure": {"count": 0, "noun": "sources"}}),
        _phase_row("draft", 1, {"text": "b"}),
    ]
    _, phases = _phases(client, monkeypatch, rows)

    assert phases[0]["step_count"] == 0
    assert phases[1]["step_count"] is None


# ══ 4) BEHAVIOR — THE STRING-SCALAR SHAPE, the door 200.1-01 repaired ══════════════════════


def test_string_scalar_output_yields_the_same_deliverable_text(client, monkeypatch):
    """An ``output`` that is ``json.dumps({...})`` serves the SAME answer as the dict shape.

    ⚠ THIS IS THE SHAPE **484 OF 484** ``completed`` ROWS ACTUALLY HAVE. A reader that only
    handled dicts would be dead on every historical row that matters, and it would be dead
    SILENTLY, because "no answer" renders honestly. This case is what proves the deliverable arm
    reads through ``models/thread.py::phase_output_object`` — ``200.1-01``'s door — rather than
    through a second parser of its own.
    """
    payload = {"text": _ANSWER, **_PLANTED_INTERNALS}
    scalar = _phase_row("draft", 0, json.dumps(payload))
    assert isinstance(scalar["output"], str)  # positive control: really the scalar shape

    _, phases = _phases(client, monkeypatch, [scalar])

    assert phases[0]["deliverable_text"] == _ANSWER
    # ...and the bound holds identically on this shape. A second parser would be the place a
    # filtered copy crept back in, so the set equality is re-asserted here rather than assumed.
    assert set(phases[0].keys()) == _EXPECTED_PHASE_KEYS


def test_string_scalar_carrying_a_measure_serves_both_facts(client, monkeypatch):
    """One parse, both facts, on the shape history actually has."""
    payload = {"text": _ANSWER, "_measure": {"count": 7, "noun": "fields"}}
    _, phases = _phases(client, monkeypatch, [_phase_row("gather", 0, json.dumps(payload))])

    assert phases[0]["deliverable_text"] == _ANSWER
    assert (phases[0]["step_count"], phases[0]["step_noun"]) == (7, "fields")


# ══ 5) BEHAVIOR — THREE ARMS OF ABSENCE, none folded into another ══════════════════════════
#
# ⚠ They are three separate cases ON PURPOSE. Folding them into one parametrised assertion
# would still pass if two arms started sharing a wrong answer, and this repo has recorded the
# "two facts folded into one" defect four times (`runFacts.ts` CR-01, `DecisionsList` D-20,
# `phaseDuration.ts`, `transcriptVocabulary.ts`).


def test_absent_output_key_yields_null(client, monkeypatch):
    """No ``output`` column value at all → ``deliverable_text`` is ``null``, never ``""``."""
    _, phases = _phases(client, monkeypatch, [_phase_row("draft", 0, _ABSENT)])
    assert phases[0]["deliverable_text"] is None


def test_output_without_a_text_key_yields_null(client, monkeypatch):
    """An output object that simply has no ``text`` key → ``null``."""
    _, phases = _phases(client, monkeypatch, [_phase_row("draft", 0, dict(_PLANTED_INTERNALS))])
    assert phases[0]["deliverable_text"] is None
    assert set(phases[0].keys()) == _EXPECTED_PHASE_KEYS


def test_empty_text_yields_null_and_never_an_empty_string(client, monkeypatch):
    """``output["text"] == ""`` → ``null``. An empty answer and no answer are ONE fact here.

    Stated as its own case because the alternative is plausible and wrong: shipping ``""`` would
    make a client's truthiness branch and a client's ``=== null`` branch disagree about the same
    row, which is the "two shapes for one fact" shape this project keeps recording.
    """
    _, phases = _phases(client, monkeypatch, [_phase_row("draft", 0, {"text": ""})])
    assert phases[0]["deliverable_text"] is None
    assert phases[0]["deliverable_text"] != ""


def test_non_string_text_yields_null(client, monkeypatch):
    """A model-influenced ``text`` that is not a string degrades to ``null`` and does NOT 500.

    ``output`` is model-influenced jsonb. A serializer that handed Pydantic a list would raise a
    ``ValidationError`` and 500 the run page **for the owner of that run** — the same
    degrade-never-raise posture ``phase_output_object`` carries.
    """
    _, phases = _phases(client, monkeypatch, [_phase_row("draft", 0, {"text": ["a", "b"]})])
    assert phases[0]["deliverable_text"] is None


def test_output_that_is_a_json_list_scalar_yields_null(client, monkeypatch):
    """A string scalar that parses to a LIST is not an object — ``null``, and no raise."""
    _, phases = _phases(client, monkeypatch, [_phase_row("draft", 0, json.dumps(["a"]))])
    assert phases[0]["deliverable_text"] is None


def test_unparseable_string_output_yields_null(client, monkeypatch):
    """Unparseable jsonb text degrades quietly rather than 500-ing the page."""
    _, phases = _phases(client, monkeypatch, [_phase_row("draft", 0, "{not json at all")])
    assert phases[0]["deliverable_text"] is None


# ══ 6) BEHAVIOR — the server ships EVERY row's text; the CHOICE is the client's ════════════


def test_a_confirm_steps_question_ships_too_and_the_server_makes_no_judgement(
    client, monkeypatch
):
    """A ``confirm``-type step carries ``text`` and it is a QUESTION, not a deliverable.

    Measured on the live local DB 2026-08-20, verbatim:
    ``"Does this draft answer your question? Add any corrections."`` So *"the run's answer"*
    cannot be *"any row with text"* — and the server deliberately does NOT try to decide. It
    ships the fact (this row's text) and the client applies the rule (**the LAST server-ordered
    row carrying a non-empty ``deliverable_text``**).

    ⚠ A serializer rule that populated only the final row would be INVISIBLE ON THE WIRE
    (D-200.1-02-B) — this case is what pins the decision to the visible half.
    """
    rows = [
        _phase_row("draft", 0, {"text": _ANSWER}),
        _phase_row(
            "confirm",
            1,
            {"text": "Does this draft answer your question? Add any corrections."},
        ),
    ]
    _, phases = _phases(client, monkeypatch, rows)

    assert phases[0]["deliverable_text"] == _ANSWER
    assert phases[1]["deliverable_text"].startswith("Does this draft answer")


# ══ 7) SOURCE FENCE — the serializer reads EXACTLY ONE KEY BY NAME ════════════════════════

_MODULE_PATH = Path(__file__).resolve().parents[2] / "app" / "api" / "workflow_runs.py"


def _loop_source() -> str:
    """The phase serializer loop's own source, dedented.

    ⚠ AST, NOT A REGEX STRIPPER. Comments never enter the tree at all, which is what makes this
    fence immune to the 187-24 trap: this module's docblocks legitimately name ``citations``,
    ``field_map`` and ``prompts`` at length, and a text matcher would count its own prose and
    report a leak that is a paragraph.
    """
    import app.api.workflow_runs as mod

    src = inspect.getsource(mod)
    tree = ast.parse(src)
    lines = src.splitlines()
    for node in ast.walk(tree):
        if (
            isinstance(node, ast.For)
            and isinstance(node.target, ast.Name)
            and node.target.id == "row"
            and isinstance(node.iter, ast.Name)
            and node.iter.id == "phase_rows"
        ):
            return textwrap.dedent("\n".join(lines[node.lineno - 1 : node.end_lineno]))
    raise AssertionError("the phase serializer loop was not found — this fence is vacuous")


def _keys_read_from_unwrapped_object(source: str) -> set[str]:
    """Every string key the source reads off the name ``obj`` — ``obj.get("k")`` or ``obj["k"]``."""
    found: set[str] = set()
    for node in ast.walk(ast.parse(source)):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "get"
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "obj"
            and node.args
            and isinstance(node.args[0], ast.Constant)
            and isinstance(node.args[0].value, str)
        ):
            found.add(node.args[0].value)
        if (
            isinstance(node, ast.Subscript)
            and isinstance(node.value, ast.Name)
            and node.value.id == "obj"
            and isinstance(node.slice, ast.Constant)
            and isinstance(node.slice.value, str)
        ):
            found.add(node.slice.value)
    return found


def test_serializer_reads_exactly_one_key_by_name():
    """Over the loop's AST, the ONLY key read off the unwrapped object is ``"text"``.

    This is the ALLOW-LIST expressed as a fence. It fails on a filtered copy, on a second key
    added without a model field, and on a ``for k in obj`` iteration (which reads no named key
    and would therefore also fail the set equality in case 2).
    """
    source = _loop_source()
    assert "phase_output_object(" in source, "the loop no longer parses through the ONE door"
    assert _keys_read_from_unwrapped_object(source) == {"text"}


def test_the_one_key_fence_can_see_a_planted_second_key():
    """POSITIVE CONTROL — plant ``obj.get("citations")`` into the REAL loop source; matcher sees it.

    Without this, a matcher that silently found nothing (a renamed local, a restructured loop)
    would report a perfectly green fence over an empty set.
    """
    source = _loop_source()
    assert _keys_read_from_unwrapped_object(source) == {"text"}  # baseline

    # ⚠ THE PLANT IS ANCHORED BY CONTENT AND INDENTED FROM WHAT IT FINDS, never by a quoted
    # literal with a hard-coded indent. The first draft of this control quoted the line at its
    # ORIGINAL eight-space indent, and `_loop_source` dedents — so the replace matched nothing
    # and the control was silently vacuous. It went RED on its own `planted != source` guard,
    # which is precisely why that guard is there.
    lines = source.splitlines()
    anchors = [i for i, ln in enumerate(lines) if "obj = phase_output_object(" in ln]
    assert len(anchors) == 1, "the one-parse anchor is not unique — this control is vacuous"
    idx = anchors[0]
    indent = lines[idx][: len(lines[idx]) - len(lines[idx].lstrip())]
    planted = "\n".join(
        lines[: idx + 1] + [f'{indent}leaked = obj.get("citations")'] + lines[idx + 1 :]
    )
    assert planted != source, "the plant did not land — this control is vacuous"
    assert _keys_read_from_unwrapped_object(planted) == {"text", "citations"}


def test_no_iteration_over_the_unwrapped_object():
    """No ``for … in obj`` and no ``obj.keys()`` / ``obj.items()`` — the bound is named keys.

    A filtered copy is the shape that looks careful and is not: it ships whatever the column
    grows next, minus whatever was known when it was written.
    """
    for node in ast.walk(ast.parse(_loop_source())):
        if isinstance(node, ast.For) and isinstance(node.iter, ast.Name):
            assert node.iter.id != "obj"
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and isinstance(node.func.value, ast.Name)
            and node.func.value.id == "obj"
        ):
            assert node.func.attr == "get", f"obj.{node.func.attr}() is not a named-key read"


# ══ 8) SOURCE — the query is UNCHANGED: no `select("*")`, projection + ownership byte-identical ══
#
# The two literals below were captured from the phase's base commit `3a14fc08` and are pinned
# here verbatim. A characterization pin, not a description: if either statement is edited, this
# file must be edited too, which is the point.

_BASE_PHASES_SELECT = '.select("slug, phase_index, status, started_at, completed_at, output")'

_BASE_OWNERSHIP_CHAIN = (
    '        .eq("id", str(workflow_run_id))\n'
    '        .eq("user_id", current_user["id"])\n'
    "        .maybe_single()"
)


def _star_select_calls(source: str) -> int:
    """How many REAL ``.select("*")`` calls the module makes — AST, never a text count."""
    count = 0
    for node in ast.walk(ast.parse(source)):
        if (
            isinstance(node, ast.Call)
            and isinstance(node.func, ast.Attribute)
            and node.func.attr == "select"
            and any(
                isinstance(a, ast.Constant) and a.value == "*" for a in node.args
            )
        ):
            count += 1
    return count


def test_no_star_select_call_anywhere_in_the_module():
    """ZERO real ``.select("*")`` calls. A star select ships whatever the table grows next.

    ⚠ **AN AST WALK, NOT A TEXT COUNT — AND THE PLAN'S OWN CRITERION ASKED FOR THE TEXT COUNT.**
    ``grep -c 'select("\\*")'`` over this module returns **2**, and BOTH are comments: one is the
    argument shipped at the base commit (*"A `.select("*")` would also 'work' and would WEAKEN
    the read; reject it"*) and one is 200.1's restatement of it. **The criterion was
    unsatisfiable the day it was written**, because a whole-file text match cannot tell a
    refusal from an adoption — the 187-24 trap, which this tree has now recorded firing five
    times (``toolNames.ts``, ``receiptVocabulary.ts`` ×2, ``db/workflows.py``, here).
    The remedy is the recorded one: fence the CODE with an AST walk and leave the prose free to
    name what it rejects. The intent — no star select ships — is asserted more strongly than the
    grep would have asserted it, because a variable-composed ``select`` argument is also visible
    here as a non-``"*"`` constant.
    """
    source = _MODULE_PATH.read_text(encoding="utf-8")
    assert len(source) > 1000, "read the wrong file — this fence would be vacuous"
    assert _star_select_calls(source) == 0


def test_the_star_select_fence_can_see_a_planted_one():
    """POSITIVE CONTROL — the matcher finds a planted ``.select("*")`` and ignores the comments.

    Both halves matter: the plant proves the walk is not silently matching nothing, and the
    comment-bearing real source scoring ZERO proves it is not counting prose.
    """
    source = _MODULE_PATH.read_text(encoding="utf-8")
    assert 'select("*")' in source, "the comments no longer name it — this control is vacuous"
    assert _star_select_calls(source) == 0

    planted = source + '\n\ndef _planted(supabase):\n    return supabase.table("x").select("*")\n'
    assert _star_select_calls(planted) == 1


def test_phase_projection_is_byte_identical_to_the_base_commit():
    """The phases ``.select(...)`` is unchanged: ``output`` was ALREADY selected (T-200.1-10).

    The deliverable arm asks the database for nothing new. A widened projection here would be a
    genuinely new read on a jsonb column, and would deserve its own review — this asserts there
    is none.
    """
    source = _MODULE_PATH.read_text(encoding="utf-8")
    assert source.count(_BASE_PHASES_SELECT) == 1


def test_ownership_select_is_byte_identical_to_the_base_commit():
    """``id`` AND ``user_id`` on the SAME select, then ``maybe_single()`` — untouched.

    This chain is what makes a foreign run id indistinguishable from a nonexistent one. Nothing
    in this plan goes near it, and "nothing went near it" is asserted rather than assumed.
    """
    source = _MODULE_PATH.read_text(encoding="utf-8")
    assert source.count(_BASE_OWNERSHIP_CHAIN) == 1


# ══ 9) SOURCE — both decisions are recorded where a reader will find them ══════════════════


def test_both_decisions_are_greppable_in_the_route_module():
    source = _MODULE_PATH.read_text(encoding="utf-8")
    assert "D-200.1-02-A" in source
    assert "D-200.1-02-B" in source


def test_the_asymmetry_is_recorded_where_the_lockstep_rule_lives():
    """``D-200.1-02-A`` is ALSO in ``models/thread.py`` — beside the rule it excepts.

    A rule whose exception lives only in the other file is a rule whose next reader will apply it
    and be wrong.
    """
    thread_models = _MODULE_PATH.parents[1] / "models" / "thread.py"
    source = thread_models.read_text(encoding="utf-8")
    assert "D-200.1-02-A" in source
    assert "WorkflowPhaseState" in source


def test_the_second_wire_model_was_not_widened():
    """``WorkflowPhaseState`` declares NO ``deliverable_text`` (T-200.1-11), deliberately.

    Asserted on the MODEL rather than on a diff, so it keeps holding after this phase closes.
    """
    from app.models.thread import WorkflowPhaseState

    assert "deliverable_text" not in WorkflowPhaseState.model_fields
    # positive control — the field name is spelled correctly and really is absent, not typo'd
    assert "step_count" in WorkflowPhaseState.model_fields


def test_the_run_page_model_does_not_declare_output():
    """``WorkflowRunPhaseRead`` declares no ``output`` field — the drop behaviour still binds."""
    from app.api.workflow_runs import WorkflowRunPhaseRead

    assert "output" not in WorkflowRunPhaseRead.model_fields
    assert set(WorkflowRunPhaseRead.model_fields) == _EXPECTED_PHASE_KEYS
