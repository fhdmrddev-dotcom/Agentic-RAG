"""Phase 264 (PACK-17 / D-264-04) — what did NOT widen, proven; and the disabled arm, driven.

Three sites of the six D-264-04 rules on are UNCHANGED, and this file is the reason that is a
DECISION rather than an omission. A comment saying "we deliberately did not widen this" is not
executable; these are.

  * `tool_dispatcher._handle_save_skill`'s sibling-lint filter (`:1459`) — resolved on a ctx
    that DOES carry a live Expert bundle, and pinned BYTE-IDENTICAL to the base literal.
  * `harness/grounding.py` — the predicate it actually emits at runtime, not just its source
    text, carries no born-for term. ⚠ The fence is meaningful because the caller set was
    MEASURED (RESEARCH §2.5): `assemble_grounding_bundle` is called only from
    `api/workflows.py:1055` and `:1193`, `harness/publish_service.py:1422` and
    `workflow_authoring.py:283` — **none** of which is `run_producer`, `agent_loop`,
    `task_service` or `tool_dispatcher`. Workflow grounding is unreachable from a chat Expert
    run, so widening it would open a surface nobody asked for.
  * `harness/phase_types._build_phase_tool_context` — the harness phase ctx carries NO
    consultant scope EVEN WHEN ITS PARENT DOES. ⭐ That "even when" is the whole point and is
    what separates this from wave 1's fence: 264-01 plant 6 vs plant 7 measured that an AST
    keyword count and a behavioural assertion catch DIFFERENT things, and a parent ctx with no
    bundle at all makes the behavioural arm vacuous.

And the arm D-264-04a exists for: `_handle_read_skill_file` and the `execute_code` skill-file
injection apply **no** `.eq("is_enabled", True)` of their own (RESEARCH §2.7 / §8.5, measured).
The ONLY thing refusing a DISABLED born-for skill at those two sites is the `is_enabled.is.true`
term 264-02 put inside the born-for disjunct. Both are driven here, on the LOAD path, and both
were driven RED by removing that term.

⛔ Every negative fence below was driven RED against a planted violation, reverted, and the file
proven restored (`git diff --quiet` + `git hash-object` against the index blob — NOT a raw md5,
because `pathlib.write_text` emits CRLF on Windows while the Write tool emits LF; 264-02's
finding). The pairs are recorded in `264-03-SUMMARY.md`.
"""
from __future__ import annotations

import ast
import inspect
import json
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

import app.services.tool_dispatcher as td
from app.services.tool_dispatcher import ToolContext
from app.utils.skill_visibility import build_skill_visibility_or

# ⛔ IMPORTED, never copied — a second recording fake is a second thing that can disagree with
# the handler, and 264-02's SC#2 discipline is that the rule has exactly one home.
from tests.unit.test_264_load_skill_born_for import (  # noqa: F401
    _AUTHOR,
    _BUNDLE,
    _COLLEAGUE,
    _ORG,
    SKILL_NAME,
    _FakeSupabase,
    _make_ctx,
    _skill_row,
)

_APP = Path(inspect.getsourcefile(td)).parents[1]  # backend/app
_GROUNDING = _APP / "services" / "harness" / "grounding.py"
_PHASE_TYPES = _APP / "services" / "harness" / "phase_types.py"

# The frozen base literal 264-02 pinned in `test_seed125_skill_visibility_filter.py`, re-declared
# here identically for the one caller/org pair this file drives. If the two ever disagree, one of
# them is wrong and that is the point of writing it out rather than computing it.
_BASE_PREDICATE = (
    f"is_system.eq.true,"
    f"and(org_id.in.({_ORG}),"
    f"or(user_id.eq.{_AUTHOR},is_org_shared.eq.true))"
)


def _org_supabase(rows: list[dict], *, blobs: dict[str, bytes] | None = None) -> _FakeSupabase:
    return _FakeSupabase(
        skills=rows,
        skill_files=[],
        org_members=[
            {"user_id": _AUTHOR, "org_id": _ORG},
            {"user_id": _COLLEAGUE, "org_id": _ORG},
        ],
        blobs=blobs,
    )


# ─────────────────────────────────────────────────────────────────────────────
# 1) `_handle_save_skill`'s lint corpus — the one site that must NOT widen
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_save_skill_sibling_filter_is_the_BASE_predicate_even_with_a_bundle_on_the_ctx():
    """D-264-04's DO-NOT-WIDEN row, driven rather than read off a comment.

    Three measured reasons, all of which the source comment beside the call also states:
    `save_skill` is in NEITHER Expert tool set so it is **not advertised** to an Expert run
    (⚠ not "unreachable" — `dispatch_tool`'s only backstop is `phase_whitelist`, `None` on a
    chat run); the read feeds a non-blocking description-lint corpus with no user-visible
    capability; and it is a WRITE handler's helper, while PACK-17's axis is *read the body you
    were promised*.
    """
    sb = _org_supabase([_skill_row(name="an-existing-sibling")])
    ctx = _make_ctx(sb, caller=_AUTHOR, bundle=_BUNDLE)

    result = await td._handle_save_skill(
        {"name": "brand-new-skill", "description": "does a thing", "instructions": "do it"},
        ctx,
    )
    payload = json.loads(result.result)
    assert payload["status"] in ("created", "updated"), payload

    assert len(sb.predicates) == 1, (
        f"expected exactly ONE .or_() in the save path (the lint sibling read), "
        f"got {sb.predicates}"
    )
    assert sb.predicates[0] == _BASE_PREDICATE, (
        "the save_skill lint corpus was WIDENED — an Expert's borrowed skills would then "
        "influence another user's save-time warnings, which D-264-04 refuses"
    )
    assert "born_for_expert_bundle_id" not in sb.predicates[0]


# ─────────────────────────────────────────────────────────────────────────────
# 2) `harness/grounding.py` and `harness/phase_types.py` — unchanged, provably
# ─────────────────────────────────────────────────────────────────────────────
def _keyword_names(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    return [k.arg for n in ast.walk(tree) if isinstance(n, ast.Call) for k in n.keywords if k.arg]


@pytest.mark.parametrize("path", [_GROUNDING, _PHASE_TYPES], ids=["grounding", "phase_types"])
def test_neither_harness_module_passes_either_spelling_of_the_bundle_id(path: Path):
    """No `expert_bundle_id=` and no `born_for_bundle_id=` keyword ANYWHERE in either module.

    Both spellings, because `expert_bundle_id` is what `build_skill_visibility_or` takes and
    `born_for_bundle_id` is what the ctx carries — a future edit must not reintroduce the
    concept here under either name.
    """
    names = _keyword_names(path)
    for kw in ("expert_bundle_id", "born_for_bundle_id"):
        assert names.count(kw) == 0, (
            f"{path.name} passes `{kw}=` {names.count(kw)} time(s) — workflow grounding and "
            f"the harness phase ctx are fenced UNCHANGED by D-264-04 (RESEARCH §2.5)"
        )


def test_grounding_emits_an_UNWIDENED_predicate_at_RUNTIME_and_refuses_a_born_for_row():
    """The behavioural half — stronger than a source-text grep, which is all wave 1 had.

    Since 264-02, `build_skill_visibility_or` CAN emit the born-for term. This drives
    `_skill_registry` for real and reads the predicate it actually pushed down, then confirms
    its Python post-filter also refuses the marked row. Modelled on
    `test_182_grounding_skill_org_gate.py`, whose `_Query` returns every row regardless of the
    filter — which is exactly the condition that isolates the post-filter.

    ⭐ MEASURED, NOT ASSUMED: the PREDICATE assertion is the load-bearing half and the OUTCOME
    assertion alone would NOT have caught the plant. With `expert_bundle_id=<bundle>` planted at
    `grounding.py:208`, this function returned **0 rows** while its query was fully widened —
    because `_skill_registry`'s post-filter calls `skill_row_visible` WITHOUT a bundle, so the
    two encodings silently disagree in the safe direction. A fence here that only asserted the
    returned rows would have been green over a widened query (264-03, plant P2).
    """
    from app.services.harness.grounding import _skill_registry  # noqa: PLC0415

    born_for_row = {
        "id": "55555555-5555-5555-5555-555555555555",
        "name": "Born For The Consultant",
        "user_id": _COLLEAGUE,
        "is_org_shared": False,
        "is_system": False,
        "org_id": _ORG,
        "is_enabled": True,
        "born_for_expert_bundle_id": _BUNDLE,
    }

    class _Query:
        def __init__(self, rows):
            self._rows = rows
            self.or_arg = None

        def select(self, *_a, **_k):
            return self

        def eq(self, *_a, **_k):
            return self

        def or_(self, expr):
            self.or_arg = expr
            return self

        def execute(self):
            return SimpleNamespace(data=list(self._rows))

    class _SB:
        def __init__(self, rows):
            self.q = _Query(rows)

        def table(self, _name):
            return self.q

    sb = _SB([born_for_row])
    out = _skill_registry(sb, _AUTHOR, {_ORG})

    assert sb.q.or_arg == _BASE_PREDICATE, sb.q.or_arg
    assert "born_for_expert_bundle_id" not in sb.q.or_arg
    assert out == [], (
        "workflow grounding admitted a born-for row — the canvas skill palette has no Expert "
        "scope and must stay org+owner+shared only"
    )


def test_the_harness_phase_ctx_is_None_EVEN_WHEN_ITS_PARENT_CARRIES_A_BUNDLE():
    """⭐ The arm wave 1's fence could not reach, and the reason is measured.

    264-01 plant 6 added the keyword at this builder with a value that resolved to `None`
    anyway: the AST count fired, the behavioural fence did NOT. A behavioural assertion whose
    parent ctx has no bundle at all is therefore vacuous. This one hands the builder a parent
    carrying a real bundle and still requires `None` out.
    """
    from app.services.harness.phase_types import _build_phase_tool_context  # noqa: PLC0415

    phase = SimpleNamespace(
        config=SimpleNamespace(folder_scope=None, available_tools=["search_documents"], model=None)
    )
    parent = SimpleNamespace(
        producer_run_id=uuid4(),
        run_id=uuid4(),
        folder_subtree_ids=None,
        model="m",
        born_for_bundle_id=uuid4(),  # a REAL bundle on the parent
    )

    tc = _build_phase_tool_context(phase, parent)

    assert isinstance(tc, ToolContext)
    assert tc.born_for_bundle_id is None, (
        "the harness phase ToolContext INHERITED a consultant scope — the harness has no "
        "Expert and is governed by phase_whitelist instead (D-264-04)"
    )


# ─────────────────────────────────────────────────────────────────────────────
# 3) A DISABLED born-for skill, refused at the two sites that filter enablement nowhere
# ─────────────────────────────────────────────────────────────────────────────
def test_neither_widened_handler_filters_is_enabled_itself():
    """The premise behind D-264-04a, asserted structurally so the two cases below MEAN something.

    If either handler ever grew its own `.eq("is_enabled", True)`, the refusals driven below
    would pass for a second reason and stop testing the born-for disjunct's own term.
    """
    tree = ast.parse(Path(inspect.getsourcefile(td)).read_text(encoding="utf-8"))
    for fn_name in ("_handle_read_skill_file", "_handle_execute_code"):
        fn = next(
            n
            for n in ast.walk(tree)
            if isinstance(n, ast.AsyncFunctionDef) and n.name == fn_name
        )
        enablement_filters = [
            n
            for n in ast.walk(fn)
            if isinstance(n, ast.Call)
            and isinstance(n.func, ast.Attribute)
            and n.func.attr == "eq"
            and n.args
            and isinstance(n.args[0], ast.Constant)
            and n.args[0].value == "is_enabled"
        ]
        assert enablement_filters == [], (
            f"{fn_name} now filters is_enabled itself — the disabled-skill refusals in this "
            f"file would then pass for the wrong reason (RESEARCH §2.7 / §8.5)"
        )


@pytest.mark.asyncio
async def test_read_skill_file_refuses_a_DISABLED_born_for_skill():
    """T-264-15, arm one. The enablement term inside the born-for disjunct is all there is."""
    # positive control: the SAME skill, ENABLED, IS readable by the same non-author.
    enabled_sb = _org_supabase(
        [_skill_row()], blobs={f"{_AUTHOR}/skill-1/margin.md": b"# the helper"}
    )
    ok = await td._handle_read_skill_file(
        {"skill_name": SKILL_NAME, "filename": "margin.md"},
        _make_ctx(enabled_sb, caller=_COLLEAGUE, bundle=_BUNDLE),
    )
    assert ok.result == "# the helper", (
        f"positive-control failure: an ENABLED born-for skill's file is unreadable — {ok.result}"
    )

    # the target: the same row, DISABLED.
    disabled_sb = _org_supabase(
        [_skill_row(is_enabled=False)], blobs={f"{_AUTHOR}/skill-1/margin.md": b"# the helper"}
    )
    refused = await td._handle_read_skill_file(
        {"skill_name": SKILL_NAME, "filename": "margin.md"},
        _make_ctx(disabled_sb, caller=_COLLEAGUE, bundle=_BUNDLE),
    )
    assert json.loads(refused.result) == {"error": f"Skill '{SKILL_NAME}' not found."}
    assert "the helper" not in refused.result


class _StopBeforeSandbox(RuntimeError):
    """Raised by the fake session once the wrapped code (preamble + user code) is in hand.

    `_handle_execute_code` wraps everything in one broad `except Exception`, so this aborts the
    handler cleanly at the first container write and leaves the injection decision already made
    and observable — without a Docker daemon, a drain loop or a harvest.
    """


class _FakeSession:
    def __init__(self):
        self.wrapped: str | None = None

    def execute_command(self, *_a, **_k):
        return SimpleNamespace(exit_code=0, stdout="", stderr="")

    def copy_to_runtime(self, local_path, _remote):
        self.wrapped = Path(local_path).read_text(encoding="utf-8")
        raise _StopBeforeSandbox("captured the wrapped code")


async def _drive_injection(monkeypatch, sb, *, bundle) -> str:
    session = _FakeSession()
    monkeypatch.setattr(
        td, "sandbox_manager", SimpleNamespace(get_or_create=lambda _tid: session)
    )
    monkeypatch.setattr(td, "snapshot_output_baseline", lambda _s: {})
    monkeypatch.setattr(td, "_hydrate_thread_attachments", AsyncMock(return_value=[]))

    ctx = _make_ctx(sb, caller=_COLLEAGUE, bundle=bundle)
    await td._handle_execute_code(
        {
            "code": "print(open('/sandbox/margin.md').read())",
            "skill_files": [{"skill_name": SKILL_NAME, "filename": "margin.md"}],
        },
        ctx,
    )
    assert session.wrapped is not None, "the handler never reached the container write"
    return session.wrapped


@pytest.mark.asyncio
async def test_execute_code_injection_refuses_a_DISABLED_born_for_skill(monkeypatch):
    """T-264-15, arm two — and the QUIETEST failure of the three widened sites.

    An unresolved skill here is a `logger.warning` and a silently-skipped file, so the sandbox
    runs WITHOUT the helper and the model reasons on from a false premise. The observable is
    therefore the injected preamble, not an error string.
    """
    enabled = await _drive_injection(
        monkeypatch,
        _org_supabase([_skill_row()], blobs={f"{_AUTHOR}/skill-1/margin.md": b"helper bytes"}),
        bundle=_BUNDLE,
    )
    assert "Injected skill file: margin.md" in enabled, (
        f"positive-control failure: an ENABLED born-for skill's file was not injected\n{enabled}"
    )

    disabled = await _drive_injection(
        monkeypatch,
        _org_supabase(
            [_skill_row(is_enabled=False)],
            blobs={f"{_AUTHOR}/skill-1/margin.md": b"helper bytes"},
        ),
        bundle=_BUNDLE,
    )
    assert "Injected skill file" not in disabled, (
        f"a DISABLED born-for skill's bytes reached the sandbox\n{disabled}"
    )
    assert "margin.md" not in disabled.split("print(open(")[0]


@pytest.mark.asyncio
async def test_execute_code_injection_refuses_the_same_skill_with_NO_bundle(monkeypatch):
    """Narrowness, at the injection site too: no active Expert ⇒ no borrowed files."""
    out = await _drive_injection(
        monkeypatch,
        _org_supabase([_skill_row()], blobs={f"{_AUTHOR}/skill-1/margin.md": b"helper bytes"}),
        bundle=None,
    )
    assert "Injected skill file" not in out, out


def test_the_born_for_disjunct_carries_its_own_enablement_term():
    """The one-line statement of what the two refusals above depend on.

    Driven RED by deleting `,is_enabled.is.true` from `skill_visibility.build_skill_visibility_or`
    — at which point both handler cases above admit the disabled row, because neither applies an
    enablement filter of its own.
    """
    widened = build_skill_visibility_or(_AUTHOR, {_ORG}, expert_bundle_id=_BUNDLE)
    assert (
        f"and(born_for_expert_bundle_id.eq.{_BUNDLE},is_enabled.is.true)" in widened
    ), widened
