"""Phase 295 (D-51, resolving D-32) — the engine-ask seam is a PURE MOVE, proven.

``harness_engine.py`` (3,396 lines at PHASE_BASE, G-5 FIRING) gives up its engine-ask
disposition family to ``app/services/harness/engine_ask.py`` BEFORE any 295 feature code
touches it: plans 295-03 / 295-04 then add the durable pause inside the new module, and the
engine keeps only its call lines. This suite is landed FIRST (295-01 Task 1, TDD RED) and is
the proof that the move cut code and rewrote none of it:

1. **AST equality of every moved binding.** Each name in ``MOVED``, parsed from
   ``git show PHASE_BASE_SHA:backend/app/services/harness_engine.py``, dumps to the same AST
   as its binding in ``engine_ask.py``. ``ast.dump`` ignores comments and line numbers, so a
   verbatim cut passes and one retyped token fails — which, for ``_is_abort_choice`` and
   ``_ACTION_RISK_APPROVE_CHOICE`` (the consent allow-list, T-185-04-01), is the point.
2. **One home per name.** Each moved name is DEFINED in ``engine_ask.py`` exactly once and is
   NOT defined in ``harness_engine.py`` — there it is only an import binding (copy-not-move
   fails). Each ``STAYS`` name is still defined in the engine and never in the leaf.
3. **Same object (the load-bearing re-export).** ``harness_engine.X is engine_ask.X`` for every
   moved name — the 22 test references to ``harness_engine._resolve_failure_with_ask_user`` and
   the engine's own call sites resolve through the engine's module global.
4. **The re-export form is the measured one.** The import of ``engine_ask`` in the engine sits
   AFTER every top-level definition (form (b) of the 295-01 cycle probe — form (a), the top
   import block, failed every import order). ``engine_ask`` binds only ``PhaseOutcome`` and
   ``_emit`` from the engine and never imports ``phase_types`` at module level.
5. **Each module imports FIRST in a fresh interpreter** (``sys.modules`` caching hides
   partial-init cycles in-process), in the three boot orders plus the leaf itself, and **every
   global a body reads is bound** (stdlib ``symtable`` — a dropped import inside a moved body
   only fails at CALL time, so an import probe cannot see it).

⚠ Structured like ``test_278_pure_move.py`` so a later plan can retire ONE name BY NAME, with
the reason as the dict value (SEED-177: retire a fence deliberately, never trip it by
surprise). ``RETIRED`` is EMPTY in 295-01 — a pure move changes nothing on purpose. Plans
295-03 / 295-04 change bodies in ``engine_ask.py`` deliberately; the plan that edits a moved
body records the name and the reason HERE, in the same commit.
"""
from __future__ import annotations

import ast
import builtins
import importlib
import subprocess
import symtable
import sys
from pathlib import Path

import pytest

PHASE_BASE_SHA = "7fdf86e70dcf2b27a54be48fc7df7c4762e9d8dd"

REPO_ROOT = Path(__file__).resolve().parents[3]
BACKEND_DIR = REPO_ROOT / "backend"

_ENGINE_REL = "backend/app/services/harness_engine.py"
_ASK_REL = "backend/app/services/harness/engine_ask.py"

# The engine-ask disposition family (D-51). Every one moves, with the comment block above it.
MOVED: tuple[str, ...] = (
    "_OnFailure",
    "_parse_on_failure",
    "_failing_on_failure",
    "_route_on_failure",
    "_ask_user_choices_from_finding",
    "_ACTION_RISK_APPROVE_CHOICE",
    "_ABORT_LIKE_CHOICES",
    "_is_abort_choice",
    "_ACTION_RISK_FINDING_PREFIX",
    "_resolve_failure_with_ask_user",
)

# Stays in the engine (D-51: PhaseOutcome and the outcome arms are test_200's source fences).
STAYS: tuple[str, ...] = (
    "PhaseOutcome",
    "_run_phase_with_gates",
    "_attempt_identity",
    "_clear_retry_feedback",
    "run_workflow",
    "_resume_run",
    "resume_stranded_workflows",
)

# The ONLY names the leaf may bind from the engine (the honest-leaf invariant).
_FROM_ENGINE = frozenset({"PhaseOutcome", "_emit"})

# name → the reason it is no longer compared. EMPTY in 295-01 — a pure move changes nothing.
RETIRED: dict[str, str] = {
    "_resolve_failure_with_ask_user": (
        "295-03 Task 1 (D-01 / D-18 / D-37 / D-51): the body changed DELIBERATELY. The engine "
        "citations gate (grounding.is_engine_citation_gate, not an outage) and a live armed "
        "approval now return engine_ask.engine_pause(...) — a durable pause — instead of "
        "blocking in-process on subscribe_for_response. Author ask_user gates and every other "
        "disposition are unchanged. Task 2 (D-18): a live armed call first takes an approval "
        "consumed on this re-drive (receipt + run the body once). Task 3 (D-48): an author's "
        "post-gate Proceed now runs the engine citations gate on the produced output before "
        "returning completed."
    ),
}

# 295-03 (D-18): the in-process ARMED observables retired when engine asks stopped waiting
# in-process. ``RETIRED`` above is keyed by MOVED names (its own invariant), so these live in a
# sibling dict. Key: ``<suite>::<test as it is named now>``; value: the old observable and the
# reason. Every entry is checked to still exist below — a retirement that names a test which is
# gone is a deletion wearing a record.
_D18 = "D-18: engine asks no longer wait in-process; the answer is consumed on a re-drive"
RETIRED_ARMED_ASSERTIONS: dict[str, str] = {
    "test_185_engine_attachment.py::test_armed_gate_pauses_with_no_timeout_at_all": (
        "was test_armed_gate_subscribes_with_no_timeout_at_all: `subscribe.await_args[3] is "
        f"None` → the durable prompt row's timeout_seconds is None and nothing subscribed. {_D18}"
    ),
    "test_185_engine_attachment.py::test_criterion_19_unanswered_armed_gate_does_not_advance_the_run": (
        "`outcome.kind == 'fail_run'` after an unanswered in-process wait and "
        "`write_audit.await_count == 0` → `pause_run` (D-01: an unanswered engine ask never "
        f"fails the run) and zero APPROVAL receipts (the pause writes policy_applied). {_D18}"
    ),
    "test_185_engine_attachment.py::test_armed_prompt_is_the_generated_sentence_character_identically": (
        "read `ctx.emit.await_args` and a MagicMock insert after a scripted in-process answer → "
        f"the same emit and row, read off the durable world. {_D18}"
    ),
    "test_185_engine_attachment.py::test_armed_prompt_and_row_carry_a_null_deadline_never_zero": (
        f"same observables as above, read off the durable world. {_D18}"
    ),
    "test_185_engine_attachment.py::test_shutdown_mid_wait_leaves_an_armed_run_resumable": (
        "`pytest.raises(CancelledError)` on a shutdown payload mid-wait → there is no wait to "
        "interrupt: the run is already paused with its prompt row and nothing subscribed. "
        f"{_D18}"
    ),
    "test_ask_user_disposition.py::test_armed_decline_fails_the_run_and_writes_no_approval": (
        f"subscribe returned the decline in-process; `write_audit.await_count` → approval "
        f"receipts only (the pause writes policy_applied). {_D18}"
    ),
    "test_ask_user_disposition.py::test_armed_approval_runs_the_body_and_writes_the_receipt": (
        f"approval handed back in-process → consumed on the re-drive; receipts counted by kind. {_D18}"
    ),
    "test_ask_user_disposition.py::test_armed_empty_answer_fails_the_run": (
        f"empty in-process payload → empty durable answer consumed on the re-drive. {_D18}"
    ),
    "test_ask_user_disposition.py::test_armed_decline_by_choice_index_also_fails": (
        f"choice_index decline in-process → on the re-drive. {_D18}"
    ),
    "test_ask_user_disposition.py::test_armed_typed_refusal_is_never_approval": (
        f"typed refusals in-process → durable answers consumed on the re-drive. {_D18}"
    ),
    "test_ask_user_disposition.py::test_armed_approval_by_choice_index_still_proceeds": (
        f"choice_index approval in-process → on the re-drive. {_D18}"
    ),
    "test_ask_user_disposition.py::test_armed_checkpoint_on_a_fail_run_phase_still_asks": (
        "`subscribe.assert_awaited()` / `await_count == 1` (the rendezvous) → the durable "
        f"prompt row count is 1 and subscribe is awaited 0 times. {_D18}"
    ),
    "test_187_armed_checkpoint_property.py::test_p1_body_implies_the_armed_prompt_was_awaited_first": (
        "`ask_orders_for` joined subscribe awaits to emits → durable armed prompt rows (author "
        f"gates still in-process); two drives over one world. {_D18}"
    ),
    "test_187_armed_checkpoint_property.py::test_p2_reaching_the_body_implies_exactly_one_armed_prompt": (
        f"exactly one armed ask across the pause AND its re-drive. {_D18}"
    ),
    "test_187_armed_checkpoint_property.py::test_p3_a_typed_refusal_runs_nothing_and_writes_zero_approval_receipts": (
        f"the typed refusal is a durable answer consumed on the re-drive. {_D18}"
    ),
    "test_214_approval_names_service.py::test_MEASURED_the_approval_receipt_ALREADY_copies_the_whole_sentence_into_the_ledger": (
        "`_drive` approved in-process → `_drive(approve=True)` answers the durable card and "
        f"re-drives; the receipt is written on the re-drive. {_D18}"
    ),
}


def _blob_at_base(rel_path: str, sha: str = PHASE_BASE_SHA) -> str:
    """A tracked file's contents at the phase base commit."""
    # ⚠ `encoding` IS LOAD-BEARING ON WINDOWS (the test_214 / test_272 / test_278 precedent).
    # `text=True` alone decodes with the locale codec (cp1252 here), and the engine carries
    # `⚠` / `—` / `→` in its comments — the reader thread dies with a UnicodeDecodeError,
    # `.stdout` comes back None, and the fence fails with an error unlike the property it pins.
    return subprocess.run(
        ["git", "show", f"{sha}:{rel_path}"],
        cwd=REPO_ROOT,
        capture_output=True,
        text=True,
        encoding="utf-8",
        check=True,
    ).stdout


def _module_source(rel_path: str) -> str:
    path = REPO_ROOT / rel_path
    assert path.is_file(), f"{rel_path} does not exist — the D-51 seam has not been taken"
    return path.read_text(encoding="utf-8")


def _bindings(src: str) -> dict[str, ast.AST]:
    """Top-level DEFINITIONS: def / async def / class, and Assign / AnnAssign to a plain Name."""
    out: dict[str, ast.AST] = {}
    for node in ast.parse(src).body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            out[node.name] = node
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            for target in node.targets if isinstance(node, ast.Assign) else [node.target]:
                if isinstance(target, ast.Name):
                    out[target.id] = node
    return out


def _definition_names(src: str) -> list[str]:
    """Like ``_bindings`` but as a list, so a name defined TWICE in one file is visible."""
    names: list[str] = []
    for node in ast.parse(src).body:
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            names.append(node.name)
        elif isinstance(node, (ast.Assign, ast.AnnAssign)):
            for target in node.targets if isinstance(node, ast.Assign) else [node.target]:
                if isinstance(target, ast.Name):
                    names.append(target.id)
    return names


def _import_from_names(tree: ast.Module, module: str) -> list[tuple[int, str]]:
    """(top-level statement index, bound name) for every module-level `from <module> import`."""
    out: list[tuple[int, str]] = []
    for idx, node in enumerate(tree.body):
        if isinstance(node, ast.ImportFrom) and node.module == module:
            out.extend((idx, a.asname or a.name) for a in node.names)
    return out


def _module_level_statements(body: list[ast.stmt]):
    """Every statement NOT inside a function or class body (descends into if / try / with)."""
    for node in body:
        yield node
        if isinstance(node, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
            continue
        for field in ("body", "orelse", "finalbody"):
            yield from _module_level_statements(getattr(node, field, []) or [])
        for handler in getattr(node, "handlers", []) or []:
            yield from _module_level_statements(handler.body)


# ── 0. the lists themselves (GREEN at base) ────────────────────────────────────────────────


def test_moved_and_stays_are_disjoint_and_all_exist_at_base():
    base = _bindings(_blob_at_base(_ENGINE_REL))
    assert not (set(MOVED) & set(STAYS))
    assert set(RETIRED) <= set(MOVED)
    missing = [n for n in (*MOVED, *STAYS) if n not in base]
    assert missing == [], f"not defined in {_ENGINE_REL} at {PHASE_BASE_SHA}: {missing}"
    assert len(MOVED) == 10 and len(STAYS) == 7


# ── 1. AST equality of every moved binding ─────────────────────────────────────────────────


def test_moved_bindings_are_ast_identical_to_base():
    base = _bindings(_blob_at_base(_ENGINE_REL))
    home = _bindings(_module_source(_ASK_REL))
    compared = []
    for name in MOVED:
        if name in RETIRED:
            continue
        assert name in home, f"{name} not found in {_ASK_REL}"
        assert ast.dump(home[name]) == ast.dump(base[name]), (
            f"{name} in {_ASK_REL} is not AST-identical to its PHASE_BASE source — the move "
            "retyped it. A pure move is a cut, never a rewrite."
        )
        compared.append(name)
    # Non-vacuity: every promised name was found in BOTH sources and compared.
    assert len(compared) == len(MOVED) - len(RETIRED)


# ── 2. one home per name ───────────────────────────────────────────────────────────────────


def test_each_moved_name_has_exactly_one_home():
    ask_src = _module_source(_ASK_REL)
    eng_src = _module_source(_ENGINE_REL)
    ask_defs = _definition_names(ask_src)
    eng_defs = _definition_names(eng_src)
    reexported = {n for _, n in _import_from_names(ast.parse(eng_src), "app.services.harness.engine_ask")}
    problems = []
    for name in MOVED:
        if ask_defs.count(name) != 1:
            problems.append(f"{name}: defined {ask_defs.count(name)}x in {_ASK_REL}, expected 1")
        if name in eng_defs:
            problems.append(f"{name}: still DEFINED in {_ENGINE_REL} (copy, not move)")
        if name not in reexported:
            problems.append(f"{name}: not re-exported from {_ENGINE_REL}")
    for name in STAYS:
        if eng_defs.count(name) != 1:
            problems.append(f"{name}: defined {eng_defs.count(name)}x in {_ENGINE_REL}, expected 1")
        if name in ask_defs:
            problems.append(f"{name}: defined in {_ASK_REL} — it STAYS in the engine (D-51)")
    assert problems == [], "\n".join(problems)


# ── 3. the re-export is the SAME object ────────────────────────────────────────────────────


def test_reexports_are_the_same_objects():
    engine = importlib.import_module("app.services.harness_engine")
    ask = importlib.import_module("app.services.harness.engine_ask")
    checked = 0
    for name in MOVED:
        assert hasattr(engine, name), f"harness_engine.{name} is gone — tests and call sites read it"
        assert getattr(engine, name) is getattr(ask, name), (
            f"harness_engine.{name} is not the object in engine_ask — a copy, not a re-export"
        )
        checked += 1
    # And the two names the leaf binds back are the engine's own objects, not copies.
    for name in _FROM_ENGINE:
        assert getattr(ask, name) is getattr(engine, name)
        checked += 1
    assert checked == len(MOVED) + len(_FROM_ENGINE)


# ── 4. the measured re-export form and the honest-leaf invariant ───────────────────────────


def test_reexport_sits_after_every_engine_definition():
    """Form (b): in the top import block (form (a)) the cold engine import fails (cycle probe)."""
    tree = ast.parse(_module_source(_ENGINE_REL))
    idxs = {i for i, _ in _import_from_names(tree, "app.services.harness.engine_ask")}
    assert len(idxs) == 1, f"expected ONE `from app.services.harness.engine_ask import`, got {len(idxs)}"
    (reexport_idx,) = idxs
    last_def = max(
        i for i, n in enumerate(tree.body)
        if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef, ast.Assign, ast.AnnAssign))
    )
    assert reexport_idx > last_def, (
        "the engine_ask re-export must come AFTER every top-level definition in harness_engine.py "
        "(engine_ask binds PhaseOutcome/_emit back; earlier, a cold import is a partial-init cycle)"
    )


def test_engine_ask_is_an_honest_leaf():
    tree = ast.parse(_module_source(_ASK_REL))
    offenders = []
    from_engine: set[str] = set()
    for node in _module_level_statements(tree.body):
        if isinstance(node, ast.ImportFrom) and node.module:
            if "phase_types" in node.module or (
                node.module == "app.services.harness" and any(a.name == "phase_types" for a in node.names)
            ):
                offenders.append(f"phase_types import at line {node.lineno}")
            if node.module == "app.services.harness_engine":
                from_engine |= {a.asname or a.name for a in node.names}
        elif isinstance(node, ast.Import):
            for a in node.names:
                if "phase_types" in a.name or a.name == "app.services.harness_engine":
                    offenders.append(f"`import {a.name}` at line {node.lineno}")
    assert offenders == [], f"engine_ask closes a cycle: {offenders}"
    assert from_engine == _FROM_ENGINE, (
        f"engine_ask binds {sorted(from_engine)} from harness_engine; only {sorted(_FROM_ENGINE)} "
        "may come back (everything else is imported from its real home)"
    )


# ── 5. fresh-interpreter import + every global a body reads is bound ───────────────────────


@pytest.mark.parametrize(
    "mod",
    [
        "app.services.harness_engine",
        "app.services.harness",
        "app.main",
        "app.services.harness.engine_ask",
    ],
)
def test_each_import_order_works_in_a_fresh_interpreter(mod):
    proc = subprocess.run(
        [sys.executable, "-c", f"import {mod}"],
        cwd=BACKEND_DIR,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    assert proc.returncode == 0, f"`import {mod}` failed in a fresh interpreter:\n{proc.stderr}"


_MODULE_DUNDERS = frozenset({
    "__name__", "__file__", "__doc__", "__spec__", "__package__", "__loader__", "__builtins__",
    "__path__", "__annotations__", "__dict__",
})


def _child_tables(table: symtable.SymbolTable):
    for child in table.get_children():
        yield child
        yield from _child_tables(child)


def _unbound_globals(source: str, filename: str) -> list[str]:
    module = symtable.symtable(source, filename, "exec")
    bound = {
        s.get_name() for s in module.get_symbols()
        if s.is_assigned() or s.is_imported() or s.is_namespace()
    }
    allowed = bound | set(dir(builtins)) | _MODULE_DUNDERS
    unresolved: set[str] = set()
    for sym in module.get_symbols():
        if sym.is_referenced() and sym.get_name() not in allowed:
            unresolved.add(f"<module>:{sym.get_name()}")
    for scope in _child_tables(module):
        for sym in scope.get_symbols():
            if sym.is_referenced() and sym.is_global() and sym.get_name() not in allowed:
                unresolved.add(f"{scope.get_name()}:{sym.get_name()}")
    return sorted(unresolved)


@pytest.mark.parametrize("rel", [_ASK_REL, _ENGINE_REL], ids=["engine_ask", "harness_engine"])
def test_every_global_a_body_reads_is_bound(rel):
    unresolved = _unbound_globals(_module_source(rel), str(REPO_ROOT / rel))
    assert unresolved == [], (
        f"{rel}: names read as globals but bound nowhere in the module (a dropped import — this "
        f"only fails at CALL time): {unresolved}"
    )


# ── 6. 295-03: every retired ARMED observable names a test that still exists ───────────────


def test_every_retired_armed_assertion_names_a_living_test():
    """A retirement is a record, never a deletion: each entry's suite still defines the test
    it names, and its reason cites D-18."""
    tests_dir = BACKEND_DIR / "tests" / "unit"
    assert RETIRED_ARMED_ASSERTIONS, "the 295-03 retirement record is empty"
    missing = []
    for key, reason in RETIRED_ARMED_ASSERTIONS.items():
        suite, name = key.split("::", 1)
        tree = ast.parse((tests_dir / suite).read_text(encoding="utf-8"))
        defined = {n.name for n in ast.walk(tree) if isinstance(n, (ast.FunctionDef, ast.AsyncFunctionDef))}
        if name not in defined:
            missing.append(key)
        assert "D-18" in reason, f"{key}: the reason must cite D-18"
    assert missing == [], f"retired entries name tests that no longer exist: {missing}"
