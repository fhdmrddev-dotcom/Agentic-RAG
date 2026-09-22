"""Phase 264 (PACK-17) — the born-for arm reaches the LOAD path, driven as a non-author.

⛔ WHAT A GREEN HERE MEANS, AND WHAT IT DOES NOT. Every case below proves **the query this
process would send** and **the rows that query would admit, evaluated in-process by the
grammar evaluator 264-02 wrote**. It does NOT prove what Postgres returns — no database is
touched. The real-DB driver is 264-04's subject, and the live cross-org proof is
`tests/integration/test_v3_4_org_isolation.py`. A fence that overstates its own reach is worse
than no fence, so this paragraph is part of the deliverable.

⛔ WHY THIS FILE EXISTS AT ALL, MEASURED (RESEARCH §2.6 / §8.9). Before Phase 264 **no test in
this repository drove `_handle_load_skill` against a real predicate.** `test_142_load_skill_flag.py`
builds a `_PassthroughQuery` whose `__getattr__` turns `select`/`or_`/`eq`/`order` into chainable
**no-ops**, and `test_260_financial_analyzer_conversation.py` patches `aexec` out entirely — so a
correct predicate, a widened one and an absent one all return the same rows. That is exactly how
the PACK-17 defect survived Phase 263. The fake here therefore **records AND filters**: `.or_()`
stores its argument and narrows the seeded rows by evaluating it, and `.eq()` narrows too. A
A grep for a catch-all attribute-hook definition in this file must read `0` — and the token is
never spelled out here, because a fence that trips on the sentence describing it is not a fence.

The evaluator is IMPORTED from `tests/unit/test_264_one_home_born_for_predicate.py`, never copied:
a second evaluator would be a second encoding of the rule, which is precisely what that file's
SC#2 count fence exists to forbid.
"""
from __future__ import annotations

import ast
import inspect
import json
import re
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import AsyncMock
from uuid import uuid4

import pytest

import app.services.tool_dispatcher as td
from app.services.tool_dispatcher import ToolContext, _resolve_skill_visibility_or
from app.utils.skill_visibility import build_skill_visibility_or

# The grammar-only PostgREST evaluator 264-02 built. IMPORTED, never re-implemented.
from tests.unit.test_264_one_home_born_for_predicate import _predicate_admits

# ── identities, reused verbatim from the 264-02 table so both files describe one world ──
_AUTHOR = "00000000-0000-0000-0000-000000000042"
_COLLEAGUE = "99999999-9999-9999-9999-999999999999"
_ORG = "11111111-1111-1111-1111-111111111111"
_BUNDLE = "33333333-3333-3333-3333-333333333333"

SKILL_NAME = "quarterly-margin-brief"
SKILL_BODY = "Open the ledger, reconcile the margin, then write the brief."

# The two predicate strings, FROZEN as literals rather than computed, so a change to the
# rule turns these red instead of silently moving with it (the SC#5 discipline 264-02 set).
_BASE_PREDICATE = (
    f"is_system.eq.true,"
    f"and(org_id.in.({_ORG}),"
    f"or(user_id.eq.{_AUTHOR},is_org_shared.eq.true))"
)
_WIDENED_PREDICATE = (
    f"is_system.eq.true,"
    f"and(org_id.in.({_ORG}),"
    f"or(user_id.eq.{_AUTHOR},is_org_shared.eq.true,"
    f"and(born_for_expert_bundle_id.eq.{_BUNDLE},is_enabled.is.true)))"
)

_DISPATCHER_SRC = Path(inspect.getsourcefile(td))


# ─────────────────────────────────────────────────────────────────────────────
# The recording + FILTERING fake. ⛔ No `__getattr__` anywhere — see the docstring.
# ─────────────────────────────────────────────────────────────────────────────
class _FakeResult:
    """Copied verbatim from `test_142_load_skill_flag.py:42-45` — shape only."""

    def __init__(self, data):
        self.data = data
        self.count = len(data) if isinstance(data, list) else None


class _RecordingQuery:
    """A supabase-py query stand-in that RECORDS the `.or_()` it is handed AND applies it.

    Every builder verb is written out by hand. `.or_()` appends the predicate to the shared
    recorder and narrows the row list through `_predicate_admits`; `.eq()` narrows too, because
    `_handle_load_skill` carries `is_enabled` / `name` OUTSIDE the `.or_()` and a fake that
    ignored them would answer a different question from the one the handler asks.
    """

    def __init__(self, rows: list[dict], recorder: list[str]):
        self._rows = [dict(r) for r in rows]
        self._recorder = recorder
        self._single = False
        self._writes: list[tuple[str, dict]] = []

    # -- projection / ordering: shape-only, deliberately inert -----------------
    def select(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def maybe_single(self):
        self._single = True
        return self

    # -- the two verbs that actually decide anything ---------------------------
    def or_(self, predicate: str):
        self._recorder.append(predicate)
        self._rows = [r for r in self._rows if _predicate_admits(predicate, r)]
        return self

    def eq(self, column: str, value):
        def _match(row: dict) -> bool:
            actual = row.get(column)
            if isinstance(value, bool):
                return bool(actual) is value
            return actual is not None and str(actual) == str(value)

        self._rows = [r for r in self._rows if _match(r)]
        return self

    # -- writes: shape-only, recorded so a caller can assert they happened ----
    def insert(self, payload, **_k):
        self._writes.append(("insert", payload))
        self._rows = [{"id": "written-row"}]
        return self

    def update(self, payload, **_k):
        self._writes.append(("update", payload))
        self._rows = [{"id": "written-row"}]
        return self

    def execute(self):
        if self._single:
            return _FakeResult(self._rows[0] if self._rows else None)
        return _FakeResult(list(self._rows))


class _FakeStorageBucket:
    def __init__(self, blobs: dict[str, bytes]):
        self._blobs = blobs

    def download(self, path: str) -> bytes:
        if path not in self._blobs:
            raise FileNotFoundError(path)
        return self._blobs[path]


class _FakeStorage:
    def __init__(self, blobs: dict[str, bytes]):
        self._blobs = blobs

    def from_(self, _bucket: str):
        return _FakeStorageBucket(self._blobs)


class _FakeSupabase:
    """Per-table fake. `table()` mirrors `test_142_load_skill_flag.py:69-79` in shape."""

    def __init__(
        self,
        *,
        skills: list[dict],
        skill_files: list[dict],
        org_members: list[dict],
        blobs: dict[str, bytes] | None = None,
    ):
        self._tables = {
            "skills": skills,
            "skill_files": skill_files,
            "org_members": org_members,
        }
        self.predicates: list[str] = []
        self.writes: list[tuple[str, dict]] = []
        self.storage = _FakeStorage(blobs or {})

    def table(self, name: str):
        q = _RecordingQuery(self._tables.get(name, []), self.predicates)
        q._writes = self.writes
        return q


def _skill_row(
    *,
    skill_id: str = "skill-1",
    name: str = SKILL_NAME,
    user_id: str = _AUTHOR,
    is_org_shared: bool = False,
    is_enabled: bool = True,
    born_for_expert_bundle_id: str | None = _BUNDLE,
    instructions: str = SKILL_BODY,
) -> dict:
    """A `public.skills` row with EVERY column the predicate can name, always present.

    Shape follows `test_142_load_skill_flag.py:82-93`; the three provenance/tenancy columns
    the org gate reads are added because this fake actually evaluates the gate.
    """
    return {
        "id": skill_id,
        "name": name,
        "description": "writes the quarterly margin brief",
        "instructions": instructions,
        "user_id": user_id,
        "is_system": False,
        "org_id": _ORG,
        "is_org_shared": is_org_shared,
        "is_enabled": is_enabled,
        "born_for_expert_bundle_id": born_for_expert_bundle_id,
    }


def _make_ctx(supabase, *, caller: str, bundle: str | None) -> ToolContext:
    return ToolContext(
        redis=None,
        run_id=uuid4(),
        thread_id="born-for-thread",
        supabase=supabase,
        pool=None,
        user_settings=None,
        current_user={"id": caller},
        folder_subtree_ids=None,
        scoped_folder_path=None,
        emit=AsyncMock(return_value=None),
        spawn=lambda c: c.close(),
        skill_instructions_override=None,
        born_for_bundle_id=bundle,
    )


def _empty_supabase(*, org_member: bool = True) -> _FakeSupabase:
    return _FakeSupabase(
        skills=[],
        skill_files=[],
        org_members=[{"user_id": _AUTHOR, "org_id": _ORG}] if org_member else [],
    )


# ─────────────────────────────────────────────────────────────────────────────
# Task 1 — the resolver carries the decision in its SIGNATURE
# ─────────────────────────────────────────────────────────────────────────────
@pytest.mark.asyncio
async def test_a_non_opting_caller_cannot_be_widened_even_with_a_bundle_on_the_ctx():
    """⛔ THE POINT OF THE KEYWORD. A ctx carrying a live bundle, resolved WITHOUT
    `born_for=True`, yields the byte-identical pre-264 predicate.

    A resolver that read `ctx.born_for_bundle_id` unconditionally would widen all four
    dispatcher call sites by OMISSION, and `_handle_save_skill`'s D-264-04 refusal would be
    a comment with nothing behind it (T-264-13).
    """
    sb = _empty_supabase()
    ctx = _make_ctx(sb, caller=_AUTHOR, bundle=_BUNDLE)

    assert await _resolve_skill_visibility_or(ctx) == _BASE_PREDICATE


@pytest.mark.asyncio
async def test_opting_in_without_a_bundle_is_also_the_base_predicate():
    """`born_for=True` on a run with no active Expert changes nothing — the overwhelmingly
    common case on every widened site."""
    sb = _empty_supabase()
    ctx = _make_ctx(sb, caller=_AUTHOR, bundle=None)

    assert await _resolve_skill_visibility_or(ctx, born_for=True) == _BASE_PREDICATE


@pytest.mark.asyncio
async def test_opting_in_with_a_bundle_nests_the_born_for_term_inside_the_org_gate():
    """The widened arm, pinned as a frozen literal AND against the one home that emits it."""
    sb = _empty_supabase()
    ctx = _make_ctx(sb, caller=_AUTHOR, bundle=_BUNDLE)

    out = await _resolve_skill_visibility_or(ctx, born_for=True)

    assert out == _WIDENED_PREDICATE
    # The resolver must PASS THROUGH to the one home, never re-derive the term (SC#2).
    assert out == build_skill_visibility_or(_AUTHOR, {_ORG}, expert_bundle_id=str(_BUNDLE))


@pytest.mark.asyncio
async def test_a_duck_typed_ctx_lacking_the_field_entirely_does_not_raise():
    """T-264-18. Three existing suites build `ToolContext`-shaped stubs predating this field.

    `getattr(ctx, "born_for_bundle_id", None)` means an absent field yields the BASE predicate
    — fail-closed — where `ctx.born_for_bundle_id` would raise an `AttributeError` that a broad
    `except` (the `save_skill` lint wrapper, the `execute_code` outer guard) would swallow.
    """
    sb = _empty_supabase()
    stub = SimpleNamespace(supabase=sb, current_user={"id": _AUTHOR})
    assert not hasattr(stub, "born_for_bundle_id")

    assert await _resolve_skill_visibility_or(stub, born_for=True) == _BASE_PREDICATE


@pytest.mark.asyncio
async def test_a_uuid_bundle_is_accepted_at_the_seam():
    """`ToolContext.born_for_bundle_id` is typed `UUID | None`, while `skill_visibility`
    annotates its parameter `str | None` (264-02's zero-new-imports convention). The seam
    coerces with `str(...)`, so a real `UUID` must produce the same predicate a string does."""
    from uuid import UUID

    sb = _empty_supabase()
    ctx = _make_ctx(sb, caller=_AUTHOR, bundle=UUID(_BUNDLE))

    assert await _resolve_skill_visibility_or(ctx, born_for=True) == _WIDENED_PREDICATE


@pytest.mark.asyncio
async def test_the_fail_closed_empty_org_arm_survives_the_widening():
    """A caller with no resolvable org membership gets the bare `is_system` term whatever
    bundle rides the ctx — the SEED-124/125 fail-closed arm, unchanged by Phase 264."""
    sb = _empty_supabase(org_member=False)
    ctx = _make_ctx(sb, caller=_AUTHOR, bundle=_BUNDLE)

    assert await _resolve_skill_visibility_or(ctx, born_for=True) == "is_system.eq.true"


# ─────────────────────────────────────────────────────────────────────────────
# The four per-site DECISIONS, readable in source (D-264-04)
# ─────────────────────────────────────────────────────────────────────────────
def _resolver_calls() -> list[ast.Call]:
    tree = ast.parse(_DISPATCHER_SRC.read_text(encoding="utf-8"))
    return [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "_resolve_skill_visibility_or"
    ]


def test_exactly_four_call_sites_and_exactly_three_of_them_opt_in():
    """T-264-13, structurally. Four calls — `load_skill`, `save_skill` siblings,
    `read_skill_file`, the `execute_code` injection — and exactly THREE carry `born_for=True`.

    ⛔ A count, not a grep: a comment mentioning `born_for=True` satisfies a grep and wires
    nothing, and a FIFTH call site appearing silently is the way this decision would rot.
    """
    calls = _resolver_calls()
    assert len(calls) == 4, f"expected 4 resolver call sites, found {len(calls)}"

    opted = [
        c
        for c in calls
        if any(
            k.arg == "born_for" and isinstance(k.value, ast.Constant) and k.value.value is True
            for k in c.keywords
        )
    ]
    assert len(opted) == 3, (
        f"expected exactly 3 sites passing born_for=True (load_skill, read_skill_file, "
        f"the execute_code injection), found {len(opted)}"
    )


def test_the_born_for_bundle_id_is_read_through_getattr_never_as_an_attribute():
    """The `:1408` / `:1566` precedent in this very file (`skill_instructions_override`,
    `skill_snapshot`), and the reason is a real one: duck-typed ctx stubs."""
    tree = ast.parse(_DISPATCHER_SRC.read_text(encoding="utf-8"))
    attribute_reads = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Attribute)
        and node.attr == "born_for_bundle_id"
        and isinstance(node.value, ast.Name)
        and node.value.id == "ctx"
    ]
    assert not attribute_reads, (
        "tool_dispatcher reads ctx.born_for_bundle_id as an attribute — use "
        'getattr(ctx, "born_for_bundle_id", None) so a duck-typed stub cannot raise'
    )

    # ⛔ COUNTED AS CALLS, NOT AS TEXT. The resolver's own docstring quotes this exact
    # expression (deliberately — the reason it is a `getattr` belongs where the read is), so a
    # `src.count(...)` fence reads 2 against correct code and would be "fixed" by deleting the
    # documentation. Measured: this is exactly what the first version of this assertion did.
    getattr_reads = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Name)
        and node.func.id == "getattr"
        and len(node.args) >= 2
        and isinstance(node.args[1], ast.Constant)
        and node.args[1].value == "born_for_bundle_id"
    ]
    assert len(getattr_reads) == 1, (
        f"the born-for read must live at exactly ONE place — the resolver — "
        f"found {len(getattr_reads)} getattr call(s)"
    )

    # …and that one place is the resolver, not a handler that bypassed it.
    resolver = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "_resolve_skill_visibility_or"
    )
    assert getattr_reads[0] in set(ast.walk(resolver)), (
        "the born-for read is outside _resolve_skill_visibility_or — a handler reading the "
        "field directly is a fifth encoding of the decision"
    )


def test_the_save_skill_site_states_its_refusal_in_source():
    """D-264-04: the one site that must NOT widen says so where the call is, not in a plan.

    `save_skill` is in NEITHER `EXPERT_CORE_TOOLS` nor `EXPERT_DELIVERABLE_TOOLS`, so it is
    **not advertised** to an Expert run; its read feeds a non-blocking description **lint**
    corpus and produces no user-visible capability; and it is a WRITE handler's helper while
    PACK-17's axis is *read the body you were promised*.
    """
    lines = _DISPATCHER_SRC.read_text(encoding="utf-8").splitlines()
    call_idx = [
        i
        for i, line in enumerate(lines)
        if "_sibling_filter = await _resolve_skill_visibility_or(" in line
    ]
    assert len(call_idx) == 1, f"expected one _sibling_filter call site, found {len(call_idx)}"

    i = call_idx[0]
    window = "\n".join(lines[max(0, i - 12) : i + 4])
    for token in ("EXPERT_CORE_TOOLS", "not advertised", "lint"):
        assert token in window, (
            f"the save_skill resolver call must carry {token!r} in the comment beside it — "
            "a DO-NOT-WIDEN decision that is not written down is an omission, not a decision"
        )


def test_no_or_application_line_moved():
    """The `.or_(...)` applications are byte-unchanged by this plan.

    Every widened handler already resolves ONCE and reuses the returned string, which is what
    fixes `_handle_load_skill`'s `available_skills` miss-branch listing BY CONSTRUCTION
    (RESEARCH §8.8). Counting them here makes an accidental re-derivation visible.

    ⚠ MEASURED CORRECTION, 2026-09-22 (264-03). RESEARCH §2.3 — and, quoting it,
    `app/utils/skill_visibility.py`'s own module docstring — say the four resolver calls feed
    **six** `.or_(...)` applications and enumerate them: `:1319, :1347, :1594, :1606, :2204,
    :2219`. There are **SEVEN**. The enumeration omits `_handle_save_skill`'s single
    `.or_(_sibling_filter)` application, which the same paragraph's own prose says exists
    ("applied once"). Measured here at lines 1330 / 1358 / 1474 / 1605 / 1617 / 2217 / 2229.
    The `four call sites` figure — which is the one D-264-04 turns on — is correct and
    unaffected; only the applications count is wrong. Recorded rather than silently fenced at
    the wrong number, because the previous correction in that same paragraph replaced a
    "five call sites" claim and this is the sentence that replaced it.
    """
    src = _DISPATCHER_SRC.read_text(encoding="utf-8")
    applications = re.findall(r"^\s*\.or_\((_\w+)\)", src, flags=re.MULTILINE)
    assert len(applications) == 7, (
        f"expected the seven SEED-125 .or_() applications, found {len(applications)}"
    )
    # Two per widened handler (primary + normalised-name retry), one on the unwidened
    # save_skill lint corpus. Every application reads a resolved VARIABLE.
    assert applications.count("_skill_filter") == 4      # load_skill ×2, read_skill_file ×2
    assert applications.count("_sf_filter") == 2         # the execute_code injection loop
    assert applications.count("_sibling_filter") == 1    # save_skill — NOT widened
    # and no application inlines a resolver call, which would break the one-await contract
    assert ".or_(await " not in src


# ─────────────────────────────────────────────────────────────────────────────
# SC#1 — `load_skill` driven as a SAME-ORG NON-AUTHOR, against a real predicate
# ─────────────────────────────────────────────────────────────────────────────
_SHARED_NAME = "shared-helper"
_SHARED_BODY = "Anyone in the org may use this one."


def _two_skill_supabase() -> _FakeSupabase:
    """One born-for PRIVATE skill by the author, one ORG-SHARED skill, one shared org.

    The second row is what makes the miss-branch listing meaningful: a caller who is refused
    the born-for skill must still be offered the one they CAN load, so an empty list would
    pass a weaker assertion for the wrong reason.
    """
    return _FakeSupabase(
        skills=[
            _skill_row(),  # private, born for _BUNDLE, authored by _AUTHOR
            _skill_row(
                skill_id="skill-2",
                name=_SHARED_NAME,
                is_org_shared=True,
                born_for_expert_bundle_id=None,
                instructions=_SHARED_BODY,
            ),
        ],
        skill_files=[{"filename": "margin.xlsx", "skill_id": "skill-1"}],
        org_members=[
            {"user_id": _AUTHOR, "org_id": _ORG},
            {"user_id": _COLLEAGUE, "org_id": _ORG},
        ],
    )


@pytest.mark.asyncio
async def test_a_same_org_non_author_gets_the_instruction_BODY_of_a_born_for_skill():
    """⭐ SC#1 — THE DEFECT, CLOSED. Positive control FIRST, then the target.

    Phase 263 already admits this row at RESOLVE time, so the Expert's prompt NAMES the skill.
    Before 264 the BODY was fetched through a predicate that had never heard of
    `born_for_expert_bundle_id`, so every org member but the author fell into the miss branch
    and was handed an error listing "loadable" names that EXCLUDED the one just promised.

    The assertion is on the parsed `instructions` value — the full body string, by equality.
    Never a status word, never a substring, never the name (RESEARCH §8.9).
    """
    # ── positive control: the AUTHOR can load its own skill. If this fails, nothing below
    #    means anything — a fake that admits nothing would pass the target vacuously.
    author_out = json.loads(
        (
            await td._handle_load_skill(
                {"skill_name": SKILL_NAME},
                _make_ctx(_two_skill_supabase(), caller=_AUTHOR, bundle=_BUNDLE),
            )
        ).result
    )
    assert author_out.get("instructions") == SKILL_BODY, (
        f"positive-control failure: the author cannot load its OWN skill — {author_out}"
    )

    # ── the target: a same-org NON-AUTHOR, on a run with that Expert active.
    sb = _two_skill_supabase()
    colleague_out = json.loads(
        (
            await td._handle_load_skill(
                {"skill_name": SKILL_NAME},
                _make_ctx(sb, caller=_COLLEAGUE, bundle=_BUNDLE),
            )
        ).result
    )

    assert "error" not in colleague_out, (
        f"PACK-17 is OPEN: a same-org non-author was refused the body of a skill the Expert's "
        f"prompt already named — {colleague_out}"
    )
    assert colleague_out["instructions"] == SKILL_BODY
    assert colleague_out["name"] == SKILL_NAME
    # `load_skill` promises the bundled files by name — which is why read_skill_file widened too.
    assert colleague_out["files"] == ["margin.xlsx"]

    # ── and the predicate actually sent carries the born-for term NESTED in the org gate,
    #    never as a fourth top-level branch (T-264-06).
    sent = sb.predicates[0]
    assert f"and(org_id.in.({_ORG})," in sent, sent
    assert f"and(born_for_expert_bundle_id.eq.{_BUNDLE},is_enabled.is.true)" in sent, sent
    assert sent.split("and(org_id.in.", 1)[1].count("born_for_expert_bundle_id") == 1, sent


@pytest.mark.asyncio
async def test_the_same_non_author_without_the_bundle_hits_the_miss_branch():
    """No active Expert ⇒ no widening ⇒ the colleague's own private skill stays private.

    This is the narrowness half of SC#1: the arm opens only while that Expert is the active
    scope, and closes the moment it is not.
    """
    sb = _two_skill_supabase()
    out = json.loads(
        (
            await td._handle_load_skill(
                {"skill_name": SKILL_NAME},
                _make_ctx(sb, caller=_COLLEAGUE, bundle=None),
            )
        ).result
    )

    assert "instructions" not in out, out
    assert out["error"].startswith(f"Skill '{SKILL_NAME}' not found")
    assert SKILL_NAME not in out["available_skills"], (
        "the miss branch OFFERED the very skill the predicate refused"
    )
    assert out["available_skills"] == [_SHARED_NAME]


@pytest.mark.asyncio
async def test_the_miss_branch_listing_moves_with_the_SAME_filter_as_the_primary_query():
    """T-264-14, behaviourally: `available_skills` can never name a different set.

    Asked for a name that does not exist at all, the listing is exactly what the caller's
    predicate admits — so it GROWS by the born-for row when the Expert is active and shrinks
    back when it is not. Both directions, one test, because either alone is satisfiable by a
    listing that ignores the bundle in the convenient direction.
    """
    sb_without = _two_skill_supabase()
    without = json.loads(
        (
            await td._handle_load_skill(
                {"skill_name": "no-such-skill"},
                _make_ctx(sb_without, caller=_COLLEAGUE, bundle=None),
            )
        ).result
    )
    sb_with = _two_skill_supabase()
    with_bundle = json.loads(
        (
            await td._handle_load_skill(
                {"skill_name": "no-such-skill"},
                _make_ctx(sb_with, caller=_COLLEAGUE, bundle=_BUNDLE),
            )
        ).result
    )

    # the handler `sorted(...)`s the names, so the born-for slug sorts FIRST here
    assert without["available_skills"] == [_SHARED_NAME]
    assert with_bundle["available_skills"] == sorted([_SHARED_NAME, SKILL_NAME])
    assert SKILL_NAME in with_bundle["available_skills"]

    # …and both branches inside ONE invocation applied the IDENTICAL predicate string.
    assert len(sb_with.predicates) == 2, sb_with.predicates
    assert sb_with.predicates[0] == sb_with.predicates[1]


@pytest.mark.asyncio
async def test_a_disabled_born_for_skill_is_refused_on_the_load_path():
    """The born-for disjunct carries its own `is_enabled.is.true` (264-02, Form 2).

    `load_skill` also applies `.eq("is_enabled", True)` of its own, so this case is belt AND
    braces here — it is the two handlers that filter enablement NOWHERE that need the term,
    and they are driven in `test_264_unchanged_sites_fenced.py`.
    """
    sb = _FakeSupabase(
        skills=[_skill_row(is_enabled=False)],
        skill_files=[],
        org_members=[{"user_id": _COLLEAGUE, "org_id": _ORG}],
    )
    out = json.loads(
        (
            await td._handle_load_skill(
                {"skill_name": SKILL_NAME},
                _make_ctx(sb, caller=_COLLEAGUE, bundle=_BUNDLE),
            )
        ).result
    )

    assert "instructions" not in out, out
    assert out["available_skills"] == []


@pytest.mark.asyncio
async def test_a_foreign_org_row_carrying_the_marker_is_still_refused():
    """SEED-125 stands. The born-for arm is nested UNDER the org gate, so a disjoint-org row
    with the same marker is invisible however the Expert is scoped."""
    foreign = _skill_row()
    foreign["org_id"] = "22222222-2222-2222-2222-222222222222"
    sb = _FakeSupabase(
        skills=[foreign],
        skill_files=[],
        org_members=[{"user_id": _COLLEAGUE, "org_id": _ORG}],
    )
    out = json.loads(
        (
            await td._handle_load_skill(
                {"skill_name": SKILL_NAME},
                _make_ctx(sb, caller=_COLLEAGUE, bundle=_BUNDLE),
            )
        ).result
    )

    assert "instructions" not in out, out


@pytest.mark.asyncio
async def test_the_handler_resolves_the_filter_exactly_ONCE_per_invocation(monkeypatch):
    """RESEARCH §8.8 — the reuse, measured at runtime rather than inferred.

    Two `.or_()` applications, ONE resolver await. An implementation that re-resolved at the
    miss branch would still pass every outcome test above while firing a second `org_members`
    round-trip per miss — and, worse, could resolve a DIFFERENT string.
    """
    calls: list[bool] = []
    real = td._resolve_skill_visibility_or

    async def _counting(ctx, *, born_for=False):
        calls.append(born_for)
        return await real(ctx, born_for=born_for)

    monkeypatch.setattr(td, "_resolve_skill_visibility_or", _counting)

    sb = _two_skill_supabase()
    await td._handle_load_skill(
        {"skill_name": "no-such-skill"}, _make_ctx(sb, caller=_COLLEAGUE, bundle=_BUNDLE)
    )

    assert calls == [True], f"expected ONE opted-in resolver call, got {calls}"
    assert len(sb.predicates) == 2  # both branches, one resolution


def test_the_miss_branch_reads_the_SAME_variable_the_primary_query_applied():
    """⛔ STRUCTURAL, not outcome-based — this is the assertion the outcome tests cannot make.

    A future refactor that re-derived the filter at the miss branch would keep every green
    above (the two derivations would agree, today) and silently re-open half the defect the
    moment they stopped agreeing. So: inside `_handle_load_skill` there is exactly ONE
    assignment to `_skill_filter`, exactly ONE resolver call, and BOTH `.or_()` applications
    read that same Name.
    """
    tree = ast.parse(_DISPATCHER_SRC.read_text(encoding="utf-8"))
    handler = next(
        n
        for n in ast.walk(tree)
        if isinstance(n, ast.AsyncFunctionDef) and n.name == "_handle_load_skill"
    )

    assignments = [
        n
        for n in ast.walk(handler)
        if isinstance(n, ast.Assign)
        and any(isinstance(t, ast.Name) and t.id == "_skill_filter" for t in n.targets)
    ]
    assert len(assignments) == 1, (
        f"_handle_load_skill assigns _skill_filter {len(assignments)} times — the miss branch "
        "must REUSE the primary query's filter, never re-derive it (RESEARCH §8.8)"
    )

    resolver_calls = [
        n
        for n in ast.walk(handler)
        if isinstance(n, ast.Call)
        and isinstance(n.func, ast.Name)
        and n.func.id == "_resolve_skill_visibility_or"
    ]
    assert len(resolver_calls) == 1

    or_calls = [
        n
        for n in ast.walk(handler)
        if isinstance(n, ast.Call)
        and isinstance(n.func, ast.Attribute)
        and n.func.attr == "or_"
    ]
    assert len(or_calls) == 2, f"expected the primary + miss-branch applications, got {len(or_calls)}"
    for call in or_calls:
        assert len(call.args) == 1
        assert isinstance(call.args[0], ast.Name) and call.args[0].id == "_skill_filter", (
            "an .or_() application inside _handle_load_skill does not read _skill_filter — "
            "the available_skills listing could then name a set the primary query would refuse"
        )


def test_this_file_contains_no_universal_no_op_getattr():
    """The single property that separates this suite from every prior `load_skill` test.

    `_PassthroughQuery`'s catch-all attribute hook (test_142) makes `.or_()` a chainable no-op,
    so a correct predicate, a widened one and an absent one all return the same rows. Copying
    that shape here would make every green above meaningless.

    ⚠ The forbidden token is BUILT, never written out, so this file satisfies its own
    `grep -c` criterion — the third time in this phase a text fence tripped on its own prose.
    """
    src = Path(__file__).read_text(encoding="utf-8")
    hook = "__getattr__"
    tree = ast.parse(src)
    dunder_getattrs = [
        n for n in ast.walk(tree) if isinstance(n, ast.FunctionDef) and n.name == hook
    ]
    assert dunder_getattrs == []
    assert src.count("def " + hook) == 0
