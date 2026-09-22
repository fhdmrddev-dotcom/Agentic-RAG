"""Phase 264 (PACK-17 / D-264-03 / D-264-03a) — the born-for CARRIER integrity fence.

Phase 263 shipped `skills.born_for_expert_bundle_id` (mig 191) and taught RESOLVE time about
it. The LOAD path had no way to even know which Expert was active: `ToolContext` carries 30+
fields and none of them was the bundle. Plan 264-01 lays the carrier — and nothing else.

What these tests measure:

* `born_for_bundle_id` is a field of BOTH `RunContext` (frozen) and `ToolContext`, default
  `None`, so every existing caller is a literal no-op.
* The keyword is passed at EXACTLY the four build sites plus the one `sub_ctx` propagation —
  counted by an `ast.parse` walk over each module, never by `grep`. A comment mentioning the
  name satisfies a grep and satisfies nothing real.
* The PACK-01 Closed-Core Invariant on `agent_loop.py` is re-driven here rather than
  inherited: the field is named for the mig-191 COLUMN, not for the Expert concept, so the
  invariant stays green by CONSTRUCTION and not by exemption.

* The harness (`phase_types.py`), the eval harness (`eval_runner_service.py`) and workflow
  grounding (`harness/grounding.py`) stay UNWIRED — asserted as a NEGATIVE, because
  D-264-04's discipline is "a recorded decision, not an omission". Each of those fences was
  driven RED against a planted keyword and the file restored md5-identical.
* Both arms of `_resolve_thread_scoping` are driven against the real function: the
  no-consultant arm yields a five-wide all-`None` tuple, and the failure arm re-raises
  instead of short-returning a tuple of the old arity.

⛔ What a green here does NOT prove — read this before quoting it:

* **Nothing about what any consumer does with the field.** No consumer reads it in 264-01;
  `_resolve_skill_visibility_or` and the four dispatcher call sites are 264-03's subject.
* **Nothing about which skill rows Postgres would return.** These are source-structure and
  object-shape assertions plus two resolver arms with mocked fakes — not a visibility test.
  A green here says the harness, eval and grounding paths carry no consultant scope; it says
  nothing about whether a born-for skill LOADS, which is the phase's actual goal.
"""
from __future__ import annotations

import ast
import pathlib
from dataclasses import FrozenInstanceError, fields
from types import SimpleNamespace
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from app.services.agent_loop import RunContext
from app.services.tool_dispatcher import ToolContext

APP_DIR = pathlib.Path(__file__).resolve().parent.parent.parent / "app"

FIELD = "born_for_bundle_id"


def _keyword_count(module_relpath: str, keyword: str) -> int:
    """Count `ast.keyword` nodes named `keyword` in a module under backend/app/.

    An AST walk, deliberately — a `grep -c` would be satisfied by a comment or a docstring
    that merely mentions the name, and would therefore pass over an unwired build site.
    """
    src = (APP_DIR / module_relpath).read_text(encoding="utf-8")
    tree = ast.parse(src, filename=str(APP_DIR / module_relpath))
    return sum(
        1
        for node in ast.walk(tree)
        if isinstance(node, ast.keyword) and node.arg == keyword
    )


def _field_default(cls, name):
    """Return the declared default of a dataclass field, or MISSING when it has none."""
    for f in fields(cls):
        if f.name == name:
            return f.default
    raise AssertionError(f"{cls.__name__} has no field '{name}'")


# ── The two dataclasses ───────────────────────────────────────────────────────

def test_run_context_carries_born_for_bundle_id_defaulting_none():
    """D-264-03: `RunContext.born_for_bundle_id` exists and defaults to None."""
    names = {f.name for f in fields(RunContext)}
    assert FIELD in names, f"RunContext is missing '{FIELD}' — the carrier's first half"
    assert _field_default(RunContext, FIELD) is None, (
        "the default must be None, or every existing caller changes behaviour"
    )


def test_tool_context_carries_born_for_bundle_id_defaulting_none():
    """D-264-03: `ToolContext.born_for_bundle_id` exists and defaults to None."""
    names = {f.name for f in fields(ToolContext)}
    assert FIELD in names, f"ToolContext is missing '{FIELD}' — the carrier's second half"
    assert _field_default(ToolContext, FIELD) is None


def test_run_context_without_the_new_field_is_none_and_still_frozen():
    """8.3, CORRECTED BY MEASUREMENT — a caller that never heard of 264 builds the same object.

    ⚠ RESEARCH §8.3 argues the new field "must be hashable" because the dataclass is
    `frozen=True`. **The premise was measured FALSE on 2026-09-22 and the original wording is
    recorded here rather than quietly dropped**: `RunContext` INSTANCES have been unhashable
    since Phase 260, because the required `current_user: dict` field is unhashable. Driven
    against the phase-base copy of `agent_loop.py` (`e9d6a9410`, 16 fields, no
    `born_for_bundle_id`): `hash(ctx)` raises `TypeError: unhashable type: 'dict'`.

    ⭐ The DISCIPLINE survives the refutation and is what this test pins instead: `frozen=True`
    still forbids reassignment, and the declared field type must itself be hashable so the
    field never becomes the reason an instance cannot be hashed. `UUID` and `None` both are;
    a `dict` or `set` default would not be.
    """
    ctx = RunContext(
        run_id=uuid4(),
        thread_id="t",
        current_user={"id": str(uuid4())},
        user_settings=MagicMock(),
        body=MagicMock(),
        redis=MagicMock(),
        supabase=MagicMock(),
        resolved_model="gpt-4o",
        resolved_provider="openai",
    )
    assert getattr(ctx, FIELD) is None
    assert RunContext.__dataclass_params__.frozen is True
    with pytest.raises(FrozenInstanceError):
        setattr(ctx, FIELD, uuid4())

    bundle = uuid4()
    scoped = RunContext(
        run_id=uuid4(),
        thread_id="t",
        current_user={"id": str(uuid4())},
        user_settings=MagicMock(),
        body=MagicMock(),
        redis=MagicMock(),
        supabase=MagicMock(),
        resolved_model="gpt-4o",
        resolved_provider="openai",
        born_for_bundle_id=bundle,
    )
    assert getattr(scoped, FIELD) == bundle
    # The field's own type must never be the reason an instance is unhashable.
    hash(getattr(scoped, FIELD))
    hash(getattr(ctx, FIELD))  # None is hashable too


# ── The four build sites + the one propagation ────────────────────────────────

def test_run_producer_passes_the_field_at_both_run_context_builds():
    """8.6 / D-264-03a: `run_producer` builds `RunContext` TWICE — Deep AND continuation.

    No test exercises the continuation path's scoping, so a one-site fix is a defect every
    existing test would miss. Pin the count, not the presence.
    """
    n = _keyword_count("services/run_producer.py", FIELD)
    assert n == 2, (
        f"expected exactly 2 `{FIELD}=` keyword args in run_producer.py (the Deep build and "
        f"the continuation build), found {n}"
    )


def test_agent_loop_passes_the_field_at_both_tool_context_builds():
    """T-264-02 / 8.6: `agent_loop` builds `ToolContext` TWICE — resume AND per-iteration.

    A field set at one build and not the other yields a run whose scope depends on whether
    it resumed. The 135 `skill_instructions_override` comment exists because that exact
    mistake is easy here.
    """
    n = _keyword_count("services/agent_loop.py", FIELD)
    assert n == 2, (
        f"expected exactly 2 `{FIELD}=` keyword args in agent_loop.py (the resume ToolContext "
        f"build and the primary per-iteration build), found {n}"
    )


def test_task_service_propagates_the_field_onto_sub_ctx():
    """D-264-05: a sub-agent dispatches with `sub_ctx`, never `parent_ctx`.

    An unpropagated field is structurally unreachable on the live path — the same class as
    the 096-02 `phase_whitelist` and 099 CR-02 `skill_snapshot` fixes.
    """
    n = _keyword_count("services/task_service.py", FIELD)
    assert n == 1, (
        f"expected exactly 1 `{FIELD}=` keyword arg in task_service.py (the sub_ctx build), "
        f"found {n}"
    )

    src = (APP_DIR / "services" / "task_service.py").read_text(encoding="utf-8")
    assert f"{FIELD}=parent_ctx.{FIELD}" in src, (
        "the sub_ctx value must come from parent_ctx — this is an immutable scope id, NOT a "
        "fresh-per-sub-agent accumulator like dead_gap_tokens_in_run / previous_files_in_run"
    )


# ── The invariant this plan must keep green by construction ───────────────────

def test_agent_loop_closed_core_invariant_still_green_after_the_carrier():
    """PACK-01 / EXT-01 / D-260-05, re-driven here rather than inherited.

    `RunContext` is DEFINED in `agent_loop.py`, so a field named `expert_bundle_id` would be
    an `ast.Name` and `ctx.expert_bundle_id` an `ast.Attribute` — both forbidden. The name
    `born_for_bundle_id` names the mig-191 COLUMN (`born_for_expert_bundle_id`), not the
    Expert concept, so the loop still never learns that concept.

    ⛔ The `ast.keyword` loophole (a kwarg NAME is not an `ast.Name`) is a trick, not a
    design: this test walks Name / Attribute / def exactly as the 260 original does.
    """
    loop_path = APP_DIR / "services" / "agent_loop.py"
    tree = ast.parse(loop_path.read_text(encoding="utf-8"), filename=str(loop_path))

    for node in ast.walk(tree):
        if isinstance(node, ast.Name):
            assert "expert" not in node.id.lower(), (
                f"Forbidden AST Name '{node.id}' in agent_loop.py:{node.lineno}"
            )
        if isinstance(node, ast.Attribute):
            assert "expert" not in node.attr.lower(), (
                f"Forbidden AST Attribute '{node.attr}' in agent_loop.py:{node.lineno}"
            )
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef)):
            assert "expert" not in node.name.lower(), (
                f"Forbidden function name '{node.name}' in agent_loop.py:{node.lineno}"
            )


def test_the_carrier_adds_no_branch_anywhere():
    """D-264-03 / the plan's red line: this plan wires a carrier and reads it NOWHERE.

    No `if` / `elif` / ternary / boolean op in any of the four modified modules may test
    `born_for_bundle_id`. A branch here would be behaviour, and 264-01 adds none.
    """
    offenders: list[str] = []
    for rel in (
        "services/run_producer.py",
        "services/agent_loop.py",
        "services/tool_dispatcher.py",
        "services/task_service.py",
    ):
        path = APP_DIR / rel
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
        for node in ast.walk(tree):
            tests = []
            if isinstance(node, ast.If):
                tests = [node.test]
            elif isinstance(node, ast.IfExp):
                tests = [node.test]
            elif isinstance(node, ast.While):
                tests = [node.test]
            for t in tests:
                if FIELD in ast.unparse(t):
                    offenders.append(f"{rel}:{node.lineno}: {ast.unparse(t)}")

    assert offenders == [], (
        "264-01 lays an INERT carrier; a consumer belongs in 264-03. Found: " + "; ".join(offenders)
    )


# ── The sites that stay UNCHANGED — asserted NEGATIVELY, never by silence ─────
#
# D-264-04's discipline is "a recorded decision, not an omission". RESEARCH §3.G/H/I
# names three modules that must NOT learn about the born-for scope: the harness phase
# ctx builder, the eval RunContext build, and workflow grounding. A comment saying so
# is not executable; these are.
#
# ⛔ Each of the three fences below was driven RED by PLANTING the keyword at the site,
# watching it fire, reverting, and confirming the file md5-identical (see 264-01-SUMMARY).

UNWIRED_MODULES = (
    "services/harness/phase_types.py",
    "services/eval_runner_service.py",
    "services/harness/grounding.py",
)


def test_harness_and_eval_and_grounding_pass_no_born_for_keyword():
    """G/H/I: the three modules with no Expert must pass NEITHER spelling of the id.

    `born_for_bundle_id` is what 264 adds; `expert_bundle_id` is the name D-264-03
    originally proposed and RESEARCH §2.1 refuted. Both are excluded so a future edit
    cannot reintroduce the concept here under the older name either.
    """
    for rel in UNWIRED_MODULES:
        for kw in (FIELD, "expert_bundle_id"):
            n = _keyword_count(rel, kw)
            assert n == 0, (
                f"{rel} passes `{kw}=` {n} time(s) — this path has no consultant. "
                f"The harness is governed by phase_whitelist, the eval harness has no "
                f"Expert, and grounding is unreachable from a chat Expert run (RESEARCH §2.5)."
            )


def test_grounding_predicate_never_mentions_the_born_for_column():
    """§2.5: workflow grounding builds the UNWIDENED visibility predicate.

    Mirrors `test_seed125_skill_visibility_filter.py:96`'s own
    `"born_for_expert_bundle_id" not in out` shape, one layer up: the grounding module
    must not name the mig-191 provenance column at all.
    """
    src = (APP_DIR / "services" / "harness" / "grounding.py").read_text(encoding="utf-8")
    assert "born_for_expert_bundle_id" not in src, (
        "grounding.py names the born-for provenance column — the workflow grounding path "
        "is fenced UNCHANGED by D-264-04 and must stay org+owner+shared only"
    )


def test_build_phase_tool_context_yields_a_none_born_for_tool_context():
    """H: the harness ToolContext takes the dataclass DEFAULT — driven, not read.

    An AST count of zero says the keyword is absent from the source; this says the
    object the harness actually hands to `dispatch_tool` carries no consultant scope.
    """
    from app.services.harness.phase_types import _build_phase_tool_context  # noqa: PLC0415

    phase = SimpleNamespace(
        config=SimpleNamespace(
            folder_scope=None,
            available_tools=["search_documents"],
            model=None,
        )
    )
    harness_ctx = SimpleNamespace(
        producer_run_id=uuid4(),
        run_id=uuid4(),
        folder_subtree_ids=None,
        model="m",
    )
    tc = _build_phase_tool_context(phase, harness_ctx)
    assert isinstance(tc, ToolContext)
    assert getattr(tc, FIELD) is None, (
        "the harness phase ToolContext must carry NO consultant scope — the harness has "
        "no Expert and is governed by phase_whitelist instead"
    )


# ── The two arms of the resolver, driven against the real function ────────────

@pytest.mark.asyncio
async def test_resolve_thread_scoping_no_expert_yields_a_none_fifth_element():
    """D-264-03a: the no-consultant arm returns five values, the fifth `None`.

    Driven against the real `_resolve_thread_scoping` with the thread-row fake
    `test_260_expert_chat_scoping.py::test_resolve_thread_scoping_no_expert` builds —
    not asserted from source.
    """
    from app.services.run_producer import _resolve_thread_scoping  # noqa: PLC0415

    mock_supabase = MagicMock()
    mock_query = MagicMock()
    mock_query.execute.return_value = MagicMock(data={"active_expert_id": None})
    mock_supabase.table.return_value.select.return_value.eq.return_value.maybe_single.return_value = mock_query

    result = await _resolve_thread_scoping(
        supabase=mock_supabase,
        thread_id=str(uuid4()),
        current_user={"id": str(uuid4()), "org_id": str(uuid4())},
        pool=MagicMock(),
    )
    assert len(result) == 5, f"expected a 5-tuple, got {len(result)}"
    assert result == (None, None, None, None, None)


@pytest.mark.asyncio
async def test_resolve_thread_scoping_failure_arm_raises_and_returns_no_tuple():
    """E6: the `except` arm re-raises (fail-closed) — the widening added no 4-tuple path.

    A silent short return here would hand the caller a tuple of the OLD arity and
    resurrect the `ValueError: too many values to unpack` the arity change just closed,
    on the failure path only — where no test would look.
    """
    from app.services.run_producer import _resolve_thread_scoping  # noqa: PLC0415

    mock_supabase = MagicMock()
    thread_row = MagicMock()
    thread_row.data = {"active_expert_id": str(uuid4())}
    mock_table = MagicMock()
    mock_supabase.table.return_value = mock_table
    mock_table.select.return_value = mock_table
    mock_table.eq.return_value = mock_table

    async def _aexec(_query):
        return thread_row

    with patch("app.utils.db.aexec", side_effect=_aexec), patch(
        "app.services.expert_service.resolve_expert_bundle", new_callable=AsyncMock
    ) as mock_resolve:
        mock_resolve.side_effect = RuntimeError("boom")
        with pytest.raises(RuntimeError, match="boom"):
            await _resolve_thread_scoping(
                supabase=mock_supabase,
                thread_id=str(uuid4()),
                current_user={"id": str(uuid4()), "org_id": str(uuid4())},
                pool=MagicMock(),
            )

    # And the source carries no short 4-tuple return that could bypass the raise.
    src = (APP_DIR / "services" / "run_producer.py").read_text(encoding="utf-8")
    assert "return None, None, None, None\n" not in src.replace("\r\n", "\n"), (
        "a 4-tuple return survives in run_producer.py — every arm must be five wide"
    )
