"""Phase 264 (PACK-17) — ONE home for the born-for rule, and ONE table driving both encodings.

`app/utils/skill_visibility.py` declares, in its own docstring, that its two encodings
"MUST agree — a post-filter looser than the query re-opens the leak the moment the query is
bypassed, degraded, or widened. Change one, change both, in one commit." Until Phase 264 that
was a sentence. This module makes it **executable** (D-264-07): one parametrized table of rows
drives `skill_row_visible` directly AND is evaluated against the semantics of the string
`build_skill_visibility_or` emits for the same caller, and any disagreement turns the table red
naming the row and the encoding that dissented.

⛔ WHAT A GREEN HERE MEANS, AND WHAT IT DOES NOT. These cases prove that **the predicate we
would send** and **the rule we evaluate in Python** agree. They say nothing about the rows
Postgres actually returns — no database is touched. The live cross-org proof is
`tests/integration/test_v3_4_org_isolation.py`, and the end-to-end born-for LOAD proof is
264-04's subject. A fence that overstates its own reach is worse than no fence, so this
paragraph is part of the deliverable.

⛔ THE EVALUATOR BELOW IMPLEMENTS THE PostgREST **GRAMMAR**, NEVER THE RULE. It splits on
commas at paren depth 0, recurses into `and(...)` / `or(...)`, and applies `eq` / `in` / `is`
to a row dict. It contains no knowledge of org gates, ownership, sharing or provenance — all
of that arrives from the emitted string. If it re-implemented the rule from memory it would
BE a fourth independent encoding, which is precisely what SC#2's count fence exists to forbid.

SC coverage in this file:
  * SC#3 — the one-table dual-encoding fence (`test_both_encodings_agree_on_every_row`).
  * SC#4 — a NULL/absent marker, a WRONG bundle, a DIFFERENT org and `None == None` each
    refused, plus the disabled arm and two positive arms. They are rows in the SAME table,
    not a separate suite, so none of them can drift away from the agreement check.
"""
from __future__ import annotations

import pytest

from app.utils.skill_visibility import build_skill_visibility_or as _build_skill_visibility_or
from app.utils.skill_visibility import skill_row_visible as _skill_row_visible

# Fixture identities are REUSED verbatim from tests/unit/test_seed125_skill_visibility_filter.py
# (:31-33, :118-119) rather than re-invented, so the frozen SC#5 literals there and the rows
# here describe the same world.
_UID = "00000000-0000-0000-0000-000000000042"
_ORG_A = "11111111-1111-1111-1111-111111111111"
_ORG_B = "22222222-2222-2222-2222-222222222222"
_BUNDLE = "33333333-3333-3333-3333-333333333333"
_OTHER_BUNDLE = "44444444-4444-4444-4444-444444444444"
_OTHER_USER = "99999999-9999-9999-9999-999999999999"

_COLUMNS = (
    "is_system",
    "org_id",
    "user_id",
    "is_org_shared",
    "is_enabled",
    "born_for_expert_bundle_id",
)


def _row(
    *,
    is_system: bool = False,
    org_id: str | None = _ORG_A,
    user_id: str | None = _OTHER_USER,
    is_org_shared: bool = False,
    is_enabled: bool = True,
    born_for_expert_bundle_id: str | None = None,
) -> dict:
    """A dict shaped like a `public.skills` row — EVERY column present, always.

    Deliberate: the string evaluator below models PostgREST, and PostgREST is answered by a
    table where every column exists. The "column simply absent" case is a Python-fixture
    concern, not a query concern, and is driven separately against `skill_row_visible` alone.
    """
    return {
        "is_system": is_system,
        "org_id": org_id,
        "user_id": user_id,
        "is_org_shared": is_org_shared,
        "is_enabled": is_enabled,
        "born_for_expert_bundle_id": born_for_expert_bundle_id,
    }


# ---------------------------------------------------------------------------
# THE ONE TABLE. Each entry: (name, row, visible_with_bundle, visible_without_bundle).
#
# The two expectations are written by HAND — they are the contract, not a recording of
# current behaviour — and BOTH encodings are checked against them. That is strictly stronger
# than asserting the encodings merely agree with each other, which two identically-wrong
# encodings would also satisfy.
# ---------------------------------------------------------------------------
TABLE: list[tuple[str, dict, bool, bool]] = [
    # --- positive arms -----------------------------------------------------
    (
        "system_row_in_a_foreign_org",
        _row(is_system=True, org_id=_ORG_B),
        True,
        True,
    ),
    (
        "authors_own_private_row",
        _row(user_id=_UID),
        True,
        True,
    ),
    (
        "same_org_shared_row_by_another_author",
        _row(is_org_shared=True),
        True,
        True,
    ),
    (
        # THE arm Phase 264 exists to open: a same-org colleague's PRIVATE skill that its
        # author opted into this Expert. Visible only while that Expert is the active scope.
        "same_org_private_row_born_for_THIS_bundle",
        _row(born_for_expert_bundle_id=_BUNDLE),
        True,
        False,
    ),
    # --- SC#4 narrowness arms ---------------------------------------------
    (
        # SC#4 / T-263-02: a NULL marker must never match, and `str(None) == str(None)` is
        # `True`, so this row is the one that catches a missing row-side guard.
        "same_org_private_row_with_NULL_marker",
        _row(born_for_expert_bundle_id=None),
        False,
        False,
    ),
    (
        "same_org_private_row_born_for_a_DIFFERENT_bundle",
        _row(born_for_expert_bundle_id=_OTHER_BUNDLE),
        False,
        False,
    ),
    (
        # SC#4 / T-264-06: the org gate outranks provenance. This is the SEED-125 shape and
        # the reason the born-for term nests inside `and(org_id.in.(...), ...)`.
        "FOREIGN_org_private_row_born_for_this_bundle",
        _row(org_id=_ORG_B, born_for_expert_bundle_id=_BUNDLE),
        False,
        False,
    ),
    (
        "FOREIGN_org_shared_row_born_for_this_bundle",
        _row(org_id=_ORG_B, is_org_shared=True, born_for_expert_bundle_id=_BUNDLE),
        False,
        False,
    ),
    (
        # SC#4 / T-264-11: the arm carries its own `is_enabled`, because two of the four
        # dispatcher call sites apply no enablement filter to the query at all.
        "same_org_private_DISABLED_row_born_for_this_bundle",
        _row(is_enabled=False, born_for_expert_bundle_id=_BUNDLE),
        False,
        False,
    ),
    (
        "same_org_private_unmarked_row_by_another_author",
        _row(),
        False,
        False,
    ),
    (
        # A NULL org is not "no org" — it is an unknown org, and unknown is refused.
        "row_with_a_NULL_org_and_the_right_marker",
        _row(org_id=None, born_for_expert_bundle_id=_BUNDLE),
        False,
        False,
    ),
]

_IDS = [name for name, _row_, _a, _b in TABLE]


# ---------------------------------------------------------------------------
# The PostgREST `or=` evaluator. GRAMMAR ONLY — see the module docstring.
# ---------------------------------------------------------------------------
def _split_top_level(body: str) -> list[str]:
    """Split on commas at paren depth 0."""
    parts: list[str] = []
    depth = 0
    start = 0
    for i, ch in enumerate(body):
        if ch == "(":
            depth += 1
        elif ch == ")":
            depth -= 1
        elif ch == "," and depth == 0:
            parts.append(body[start:i])
            start = i + 1
    parts.append(body[start:])
    return parts


def _eval_term(term: str, row: dict) -> bool:
    if term.startswith("and(") and term.endswith(")"):
        return all(_eval_term(t, row) for t in _split_top_level(term[4:-1]))
    if term.startswith("or(") and term.endswith(")"):
        return any(_eval_term(t, row) for t in _split_top_level(term[3:-1]))

    column, operator, value = term.split(".", 2)
    assert column in _COLUMNS, f"predicate names an unknown column: {column!r}"
    actual = row[column]

    if operator == "eq":
        if value in ("true", "false"):
            return bool(actual) is (value == "true")
        return actual is not None and str(actual) == value
    if operator == "is":
        if value == "null":
            return actual is None
        assert value in ("true", "false"), f"unsupported IS operand: {value!r}"
        return actual is (value == "true")
    if operator == "in":
        assert value.startswith("(") and value.endswith(")")
        members = {v for v in value[1:-1].split(",") if v}
        return actual is not None and str(actual) in members
    raise AssertionError(f"the evaluator does not model the operator {operator!r}")


def _predicate_admits(predicate: str, row: dict) -> bool:
    """Would PostgREST return this row for `?or=(<predicate>)`? Top level is an OR."""
    return any(_eval_term(t, row) for t in _split_top_level(predicate))


@pytest.mark.parametrize(("name", "row", "with_bundle", "without_bundle"), TABLE, ids=_IDS)
def test_both_encodings_agree_on_every_row(
    name: str, row: dict, with_bundle: bool, without_bundle: bool
) -> None:
    """SC#3 — `skill_row_visible` and `build_skill_visibility_or` decide every row alike.

    Driven in BOTH modes: with the caller's Expert bundle supplied and with it omitted. A row
    whose two expectations differ is a row the opt-in keyword actually moves, and there is
    exactly one such row in the table — which is itself the narrowness claim, measured.
    """
    for bundle, expected in ((_BUNDLE, with_bundle), (None, without_bundle)):
        predicate = _build_skill_visibility_or(_UID, {_ORG_A}, expert_bundle_id=bundle)
        by_row = _skill_row_visible(
            row, caller_id=_UID, org_ids={_ORG_A}, expert_bundle_id=bundle
        )
        by_query = _predicate_admits(predicate, row)
        mode = "bundle supplied" if bundle else "no bundle"
        assert by_row is expected, (
            f"[{name}] ({mode}) the PYTHON encoding said {by_row}, contract says {expected}"
        )
        assert by_query is expected, (
            f"[{name}] ({mode}) the QUERY encoding said {by_query}, contract says "
            f"{expected} — predicate was: {predicate}"
        )
        assert by_row is by_query, (
            f"[{name}] ({mode}) THE TWO ENCODINGS DISAGREE: python={by_row} "
            f"query={by_query}. A post-filter looser than the query re-opens SEED-125."
        )


def test_a_row_simply_missing_the_provenance_column_changes_nothing():
    """The companion assertion `test_seed125_…:131-142` already uses, extended to the arm.

    A pre-263 fixture is a plain dict with no `born_for_expert_bundle_id` key at all. `.get()`
    rather than `row[...]` is what keeps that a visibility MISS instead of a `KeyError` that
    surfaces as a handler crash. An assertion about the marked row alone could not tell
    "still closed" from "never open", so the same row minus the key is driven too.
    """
    marked = _row(born_for_expert_bundle_id=_BUNDLE)
    unmarked = {k: v for k, v in marked.items() if k != "born_for_expert_bundle_id"}

    assert (
        _skill_row_visible(marked, caller_id=_UID, org_ids={_ORG_A}, expert_bundle_id=_BUNDLE)
        is True
    )
    assert (
        _skill_row_visible(
            unmarked, caller_id=_UID, org_ids={_ORG_A}, expert_bundle_id=_BUNDLE
        )
        is False
    )
    # ...and the key's absence must not crash the enablement read either.
    no_enabled = {k: v for k, v in marked.items() if k != "is_enabled"}
    assert (
        _skill_row_visible(
            no_enabled, caller_id=_UID, org_ids={_ORG_A}, expert_bundle_id=_BUNDLE
        )
        is True
    ), "is_enabled absent must read as enabled — the column is NOT NULL DEFAULT true"


def test_none_bundle_against_none_marker_is_refused_on_both_encodings():
    """T-264-08 — the `str()` variant of the T-263-02 trap, driven explicitly.

    `str(None) == str(None)` is `"None" == "None"` → `True`. The table covers this as a row;
    this case states it as its own named property so a future reader sees the hazard rather
    than a parametrize id. Save-time callers pass `expert_bundle_id=None` and every unstamped
    row carries `None`, so a single missing guard admits every colleague's private skill.
    """
    unstamped = _row(born_for_expert_bundle_id=None)
    assert (
        _skill_row_visible(unstamped, caller_id=_UID, org_ids={_ORG_A}, expert_bundle_id=None)
        is False
    )
    predicate = _build_skill_visibility_or(_UID, {_ORG_A}, expert_bundle_id=None)
    assert "born_for_expert_bundle_id" not in predicate
    assert _predicate_admits(predicate, unstamped) is False


def test_each_none_guard_is_load_bearing_for_a_DIFFERENT_input():
    """T-264-08, measured rather than asserted: the two guards are a PAIR, not a belt and braces.

    ⭐ A finding from driving them separately rather than together. Dropping EITHER guard on
    its own changes no answer in the whole table, because a real UUID never stringifies to
    `"None"` — so each one looks redundant in isolation and a reviewer could delete either
    with every test still green. They are load-bearing for DIFFERENT inputs:

      * both dropped, bundle `None` vs marker `None`  → `"None" == "None"` admits every
        colleague's private unstamped row (driven: 3 cases red).
      * the ROW-side guard alone saves the case below, where the bundle is a value that
        STRINGIFIES to `"None"`. `skill_row_visible` does not run `coerce_uid` — it trusts the
        caller to have done that when building the query predicate — so a caller that passes
        a raw, unvalidated value reaches this comparison.

    Which is why the docstring says the second guard makes the arm safe BY CONSTRUCTION
    rather than by a property of UUID formatting.
    """
    unstamped = _row(born_for_expert_bundle_id=None)
    assert (
        _skill_row_visible(
            unstamped, caller_id=_UID, org_ids={_ORG_A}, expert_bundle_id="None"
        )
        is False
    ), "a bundle value that stringifies to 'None' must not match a NULL marker"
    assert (
        _skill_row_visible(unstamped, caller_id=_UID, org_ids={_ORG_A}, expert_bundle_id=None)
        is False
    )


def test_the_evaluator_can_actually_refuse_a_row():
    """A positive control for the evaluator itself — a green it could not have failed is noise.

    If `_predicate_admits` returned `True` unconditionally (or `False` unconditionally) the
    agreement fence above would be satisfiable by an encoding that decides nothing. So: the
    same predicate, two rows, two different answers, plus a term the evaluator must refuse to
    model rather than silently treat as false.
    """
    predicate = _build_skill_visibility_or(_UID, {_ORG_A}, expert_bundle_id=_BUNDLE)
    assert _predicate_admits(predicate, _row(user_id=_UID)) is True
    assert _predicate_admits(predicate, _row(org_id=_ORG_B)) is False

    with pytest.raises(AssertionError):
        _eval_term("is_org_shared.gte.true", _row())
    with pytest.raises(AssertionError):
        _eval_term("no_such_column.eq.1", _row())

@pytest.mark.asyncio
async def test_a_none_caller_org_no_longer_matches_a_null_org_row():
    """RESEARCH §8.10 — the ONE behaviour the delegation changes, driven not assumed.

    Before Phase 264, `filter_visible_skill_names` compared `s_org_id == caller_org_id`
    directly. With BOTH sides `None` that is `True`, so a caller with no resolvable org
    could see a row whose `org_id` is `NULL`. The delegation builds an EMPTY org set for a
    `None` caller org — never `{"None"}` — so the row is now refused.

    ⭐ WHAT SHIPS AND WHY: the strictly TIGHTER behaviour. This function runs on a
    BYPASSRLS read where the predicate IS the tenancy boundary, and the shared rule's own
    line is "an unknown / foreign / NULL org is never visible". `run_producer.py:404`
    builds `caller_org_id` as `None` for a user with no org, so the case is reachable on
    the chat path rather than theoretical — which is exactly why it is a recorded decision
    with a driven case instead of a silent side effect of a refactor.
    """
    from unittest.mock import AsyncMock, MagicMock  # noqa: PLC0415

    from app.services.expert_service import filter_visible_skill_names  # noqa: PLC0415

    pool = MagicMock()
    pool.fetch = AsyncMock(
        return_value=[
            {
                "name": "orphan_row",
                "is_system": False,
                "org_id": None,
                "user_id": None,
                "is_org_shared": True,
                "is_enabled": True,
                "born_for_expert_bundle_id": None,
            }
        ]
    )

    visible = await filter_visible_skill_names(
        pool,
        ["orphan_row"],
        caller_org_id=None,
        caller_user_id=None,
    )
    assert visible == set(), (
        "a caller with no org must not reach a NULL-org row — the delegation is "
        "deliberately tighter here than the pre-264 `None == None` comparison"
    )


# ---------------------------------------------------------------------------
# SC#2 — "exactly ONE independent encoding" measured by an AST walk, not by grep.
#
# ⛔ A GREP CANNOT DO THIS JOB, and the proof is in this repo: `expert_service.py`
# still SELECTs `born_for_expert_bundle_id` as a column, so `grep -c` there is
# non-zero forever. A comment, a docstring and a SQL column list all satisfy a
# grep and none of them is an encoding of the rule. The walk below counts two
# STRUCTURAL shapes instead, and `test_the_count_fence_discriminates_a_select_from_an_encoding`
# proves the distinction is real rather than asserted.
#
# Shape 1 — the PUSHED-DOWN encoding: a string (plain or f-string) whose literal
#           text names the column followed by a PostgREST operator, e.g.
#           `born_for_expert_bundle_id.eq.`. Docstrings are excluded.
# Shape 2 — the IN-PYTHON encoding: reading the column off a row, i.e.
#           `<expr>.get("born_for_expert_bundle_id")` or `<expr>["born_for_..."]`.
#
# A module with either shape is a HOME of the rule. After D-264-01 there must be
# exactly one home in all of `backend/app`, and it must carry exactly one of each
# shape — the "TWO ENCODINGS, ONE RULE" contract, counted.
# ---------------------------------------------------------------------------

import ast  # noqa: E402
import re  # noqa: E402
from pathlib import Path  # noqa: E402

APP_DIR = Path(__file__).resolve().parents[2] / "app"

_COLUMN = "born_for_expert_bundle_id"
_DSL_OPERAND = re.compile(re.escape(_COLUMN) + r"\.(eq|neq|is|in|gt|lt|gte|lte|like|ilike)\.")

_MUST_BE_SILENT = (
    "services/expert_service.py",
    "services/tool_dispatcher.py",
    "services/agent_loop.py",
    "services/harness/grounding.py",
)


def _ignored_constants(tree: ast.AST) -> set[int]:
    """Ids of Constant nodes that must not be counted as a standalone DSL string.

    Two kinds, and the second is a MEASURED trap rather than caution: `ast.walk`
    descends INTO a JoinedStr, so an f-string's literal fragments are visited a
    second time as bare Constants. Without this the one f-string in
    `skill_visibility.py` counted as TWO encodings and the fence read `dsl=2` for
    a module carrying exactly one.
    """
    out: set[int] = set()
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = getattr(node, "body", None)
            if (
                body
                and isinstance(body[0], ast.Expr)
                and isinstance(body[0].value, ast.Constant)
                and isinstance(body[0].value.value, str)
            ):
                out.add(id(body[0].value))
        elif isinstance(node, ast.JoinedStr):
            for part in node.values:
                if isinstance(part, ast.Constant):
                    out.add(id(part))
    return out


def _encoding_sites(path: Path) -> tuple[int, int]:
    """(pushed-down DSL sites, in-Python row-read sites) for one module."""
    source = path.read_text(encoding="utf-8")
    if _COLUMN not in source:
        return (0, 0)
    tree = ast.parse(source, filename=str(path))
    skip = _ignored_constants(tree)

    dsl = 0
    rows = 0
    for node in ast.walk(tree):
        if isinstance(node, ast.JoinedStr):
            literal = "".join(
                v.value
                for v in node.values
                if isinstance(v, ast.Constant) and isinstance(v.value, str)
            )
            if _DSL_OPERAND.search(literal):
                dsl += 1
        elif isinstance(node, ast.Constant) and isinstance(node.value, str):
            if id(node) not in skip and _DSL_OPERAND.search(node.value):
                dsl += 1
        elif isinstance(node, ast.Call):
            func = node.func
            if (
                isinstance(func, ast.Attribute)
                and func.attr == "get"
                and node.args
                and isinstance(node.args[0], ast.Constant)
                and node.args[0].value == _COLUMN
            ):
                rows += 1
        elif isinstance(node, ast.Subscript):
            index = node.slice
            if isinstance(index, ast.Constant) and index.value == _COLUMN:
                rows += 1
    return (dsl, rows)


def _homes() -> dict[str, tuple[int, int]]:
    found: dict[str, tuple[int, int]] = {}
    for path in sorted(APP_DIR.rglob("*.py")):
        dsl, rows = _encoding_sites(path)
        if dsl or rows:
            found[path.relative_to(APP_DIR).as_posix()] = (dsl, rows)
    return found


def test_the_born_for_rule_has_exactly_one_home_in_the_whole_app():
    """SC#2 / D-264-01 — independent encodings of the born-for predicate == 1.

    The scan set is DERIVED (`rglob` over `app/`), never a hand-written list, so a
    fourth copy in a module nobody thought to name still fires this. Before the
    Phase 264 delegation this read TWO homes — `utils/skill_visibility.py` and
    `services/expert_service.py`, which hand-rolled the arm at D-263-06.
    """
    homes = _homes()
    assert set(homes) == {"utils/skill_visibility.py"}, (
        f"expected exactly ONE home for the born-for rule, found {len(homes)}: "
        f"{ {k: {'dsl': v[0], 'row': v[1]} for k, v in homes.items()} }"
    )


def test_the_one_home_carries_exactly_one_of_each_encoding():
    """TWO ENCODINGS, ONE RULE — counted, so a third copy inside the home also fires."""
    dsl, rows = _encoding_sites(APP_DIR / "utils" / "skill_visibility.py")
    assert (dsl, rows) == (1, 1), (
        f"skill_visibility.py must carry exactly one pushed-down encoding and one "
        f"in-Python encoding; measured dsl={dsl} row={rows}"
    )


@pytest.mark.parametrize("rel", _MUST_BE_SILENT)
def test_the_four_consumer_modules_encode_the_rule_nowhere(rel: str):
    """Named explicitly so a failure says WHICH consumer grew a second copy."""
    dsl, rows = _encoding_sites(APP_DIR / rel)
    assert (dsl, rows) == (0, 0), (
        f"{rel} encodes the born-for rule (dsl={dsl}, row={rows}) — it must delegate "
        f"to app/utils/skill_visibility.py instead (D-264-01)"
    )


def test_the_count_fence_discriminates_a_select_from_an_encoding():
    """The fence's own positive control: a SELECT column list must NOT count.

    `expert_service.py` still names the column in its `SELECT` and in prose, so a
    grep there is non-zero — and its AST count must still be zero. A fence that
    could not tell those apart would be satisfied by deleting a comment.
    """
    source = (APP_DIR / "services" / "expert_service.py").read_text(encoding="utf-8")
    assert source.count(_COLUMN) > 0, "the SELECT column list is expected to remain"
    assert _encoding_sites(APP_DIR / "services" / "expert_service.py") == (0, 0)

    # ...and the walk must genuinely see BOTH shapes when they are present.
    assert _DSL_OPERAND.search(f"and({_COLUMN}.eq.x,is_enabled.is.true)")
    assert not _DSL_OPERAND.search(f"SELECT {_COLUMN} FROM public.skills")
    assert not _DSL_OPERAND.search(f"-- {_COLUMN} is the mig-191 provenance column")
