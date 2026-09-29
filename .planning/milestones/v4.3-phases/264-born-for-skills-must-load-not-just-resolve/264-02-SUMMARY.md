---
phase: 264-born-for-skills-must-load-not-just-resolve
plan: 02
subsystem: backend-skill-visibility
tags: [security, seed-125, one-home, ast-fence, tdd, prose-retirement]
requires:
  - "app/utils/skill_visibility.py — the two pre-264 encodings of the org gate"
  - "expert_service.filter_visible_skill_names (D-263-06, the hand-rolled fourth disjunct)"
  - "skills.born_for_expert_bundle_id (mig 191, Phase 263)"
provides:
  - "build_skill_visibility_or(user_id, org_ids, *, expert_bundle_id=None) — the born-for term nested inside the org gate, carrying its own is_enabled"
  - "skill_row_visible(row, *, caller_id, org_ids, expert_bundle_id=None) — the Python twin, both None guards"
  - "expert_service.filter_visible_skill_names delegating to skill_row_visible — independent encodings measured at 1"
  - "one fixture table driving BOTH encodings, red on disagreement (D-264-07)"
  - "three frozen base literals pinned by == (SC#5)"
affects:
  - "264-03 (the dispatcher resolver will pass expert_bundle_id into build_skill_visibility_or)"
  - "264-04 (the end-to-end LOAD proof; the ledger obligation)"
tech-stack:
  added: []
  patterns:
    - "optional keyword-only widening of a pure query-string builder, with the default arm pinned byte-identical by == against a frozen literal"
    - "an AST walk counting STRUCTURAL encoding shapes (f-string DSL operand / row .get()), immune to a SELECT column list and a comment"
    - "a grammar-only evaluator in the test module, deriving the rule from the emitted string rather than re-implementing it"
key-files:
  created:
    - backend/tests/unit/test_264_one_home_born_for_predicate.py
  modified:
    - backend/app/utils/skill_visibility.py
    - backend/app/services/expert_service.py
    - backend/tests/unit/test_seed125_skill_visibility_filter.py
decisions:
  - "D-264-01 honoured by an optional keyword-only expert_bundle_id on both encodings; expert_service delegates and the independent-encoding count is 1, measured by AST"
  - "D-264-02 discharged in BOTH registers as a rewrite with the original quoted verbatim; the seed125 test's assertion is byte-unchanged and gained a sibling"
  - "Form 2 (the born-for disjunct carries its own is_enabled.is.true) — locked by the planner, driven by a disabled-row case, RED-driven by removing the term"
  - "the degenerate caller_org_id=None case ships STRICTLY TIGHTER: measured {'orphan_row'} before, set() after"
metrics:
  duration: "~1h50m"
  completed: 2026-09-22
  tasks: 3
  commits: 3
---

# Phase 264 Plan 02: One Home for the Born-For Rule Summary

`app/utils/skill_visibility.py` now owns the born-for arm as an **optional keyword** on both of
its encodings — nested inside the org gate, carrying its own `is_enabled` — and
`expert_service.filter_visible_skill_names` delegates instead of hand-rolling a second copy.
Independent encodings of the rule across all of `backend/app`: **1**, measured by an AST walk
that read **2** before the delegation. Backend unit gate back at exactly **71 failed**,
node-id set-diff empty in both directions.

## Commits

| # | Hash | Message |
|---|---|---|
| 1 | `d70b2d607` | `feat(264-02): optional expert_bundle_id on both skill-visibility encodings` |
| 2 | `b44971178` | `test(264-02): one table drives both encodings; retire the D-264-02 prose` |
| 3 | `cedc580f2` | `refactor(264-02): expert_service delegates to skill_row_visible; count fence at 1` |

Base: `474035116`. `git diff --stat 474035116..HEAD` touches **exactly the four files** in
`files_modified`, 953 insertions / 71 deletions, and `--diff-filter=D` is empty.

## What shipped

**`app/utils/skill_visibility.py`** — both functions gained `*, expert_bundle_id: str | None =
None`. The query encoding emits
`,and(born_for_expert_bundle_id.eq.<bundle>,is_enabled.is.true)` as a THIRD disjunct inside the
existing inner `or(...)`; the empty-org arm `return`s **before** the bundle is read, so it is
fail-closed whatever is passed. The Python twin gained the same keyword with three conjuncts
plus `bool(row.get("is_enabled", True))`. `coerce_uid` validates the spliced bundle exactly as
it already validates the caller and each org.

**`app/services/expert_service.py`** — the fourth disjunct is gone. The `is_sys` arm stays a
separate `if` and the `elif` still requires `s_enabled` before consulting the delegate, so the
263 semantics are preserved by construction. Coercion happens **once at the seam**, not per
row, because this function reads via asyncpg (UUID objects) while `skill_row_visible` compares
canonical strings.

**No new import from `app.services.`** — and no new import at all. `skill_visibility.py`'s only
non-`__future__` import is still `from app.utils.db import coerce_uid`, confirmed by an AST
walk rather than a grep (the module's prose contains the word `import` twice).

### ⚠ One deliberate divergence from the plan's letter: no `uuid` import

The plan's `<action>` offered *"`str | UUID | None` using stdlib `uuid` (or a string
annotation)"*, while its acceptance criterion requires that the only non-`__future__` import
stays `coerce_uid`. Those conflict. Resolved by following the module's **own existing
convention**: `user_id` is annotated `str` today even though `coerce_uid` accepts a `UUID`, so
`expert_bundle_id` is annotated `str | None` and the docstring records that any value
`coerce_uid` accepts is tolerated. Zero new imports, criterion met literally, and the seam
coercion the plan mandates (`str(bundle_id) if bundle_id else None`) makes `str` accurate for
every caller this plan creates. 264-03 should pass `str(ctx.born_for_bundle_id)`.

## TDD: every RED observed, quoted

### SC#5 — the contrast that justified deleting the weak pins

Two plants, because the first one did not prove what the plan predicted.

**Plant 1 — a term appended INSIDE the inner `or(...)`** (`,planted_appended_term.eq.1`):

```
FAILED tests/unit/test_seed125_skill_visibility_filter.py::test_org_gated_shape_preserves_is_system_and_scopes_shared_branch
FAILED tests/unit/test_seed125_skill_visibility_filter.py::test_base_predicate_is_byte_identical_to_the_frozen_literals
2 failed, 6 passed
```

⚠ **A weak pin DID fire, which the plan did not expect** — `assert f"or(user_id.eq.{_UID},is_org_shared.eq.true)" in out`,
purely because the containment string ends in a `)` that the appended term displaced. The
other three assertions in that same test (`startswith`, `and(org_id.in.(A),` and
`count("is_org_shared.eq.true") == 1`) stayed green, as did
`test_multiple_orgs_are_sorted_and_comma_joined`. **A closing paren is not a safety property**,
so this is luck, not coverage.

**Plant 2 — a FOURTH TOP-LEVEL BRANCH**, which is the literal SEED-125 shape T-264-06 exists to
prevent (`…or(user_id.eq.U,is_org_shared.eq.true)),born_for_expert_bundle_id.eq.U`):

```
FAILED tests/unit/test_seed125_skill_visibility_filter.py::test_base_predicate_is_byte_identical_to_the_frozen_literals
FAILED tests/unit/test_seed125_skill_visibility_filter.py::test_born_for_marker_does_not_widen_cross_org_visibility_query_encoding
2 failed, 6 passed
```

⭐ **`test_org_gated_shape_preserves_is_system_and_scopes_shared_branch` — all four weak
containments — was GREEN over a predicate that leaks every foreign-org row carrying the
marker.** So was `test_multiple_orgs_are_sorted_and_comma_joined`. Only the `==` pin fired. The
second failure is not evidence of the weak shape working: it fired only because the planted
term happened to be named `born_for_expert_bundle_id`, and a differently-named leak leaves it
green.

Both plants reverted; `md5sum` back to `198c96206cf8f2622b102d8b9cd67953` and
`git diff --stat` empty. The weak assertions were then removed, with the measurement written
into the file so a future reader sees why rather than being told.

### The implementation RED

```
E  TypeError: build_skill_visibility_or() got an unexpected keyword argument 'expert_bundle_id'
FAILED …::test_empty_org_set_stays_fail_closed_even_when_a_bundle_is_supplied
FAILED …::test_bundle_term_nests_inside_the_org_gate_and_adds_no_top_level_branch
FAILED …::test_malformed_ids_raise_not_inject
3 failed, 6 passed
```

### SC#3 — the induced dual-encoding disagreement

**Plant B — the `is_enabled` term dropped from the PYTHON encoding only:**

```
E  AssertionError: [same_org_private_DISABLED_row_born_for_this_bundle] (bundle supplied)
   the PYTHON encoding said True, contract says False
1 failed, 13 passed
```

The message names the row and the dissenting encoding, which is what D-264-07 asks for.

### ⭐ SC#4 — a finding: NEITHER `None` guard is load-bearing ALONE

The plan (and RESEARCH §5.5) treats the two `is not None` guards as a pair to be driven
together. Driven **separately**, they behave differently from the expectation and the result is
worth recording:

| plant | what was removed | result |
|---|---|---|
| A | `expert_bundle_id is not None` only | **`23 passed` — DID NOT FIRE** |
| D | `row_bundle is not None` only | did not fire against the table; fired only against a NEW case (below) |
| C | **both** | `3 failed, 20 passed` |

Plant C's output:

```
E  AssertionError: [same_org_private_row_with_NULL_marker] (no bundle) the PYTHON encoding said True, contract says False
E  AssertionError: [same_org_private_unmarked_row_by_another_author] (no bundle) the PYTHON encoding said True, contract says False
FAILED …::test_both_encodings_agree_on_every_row[same_org_private_row_with_NULL_marker]
FAILED …::test_both_encodings_agree_on_every_row[same_org_private_unmarked_row_by_another_author]
FAILED …::test_none_bundle_against_none_marker_is_refused_on_both_encodings
```

**Why plant A cannot fire:** with `str()` comparison, a real UUID never stringifies to `"None"`,
so the row-side guard already refuses everything the bundle-side guard would have. Each guard
therefore *looks* redundant in isolation and a reviewer could delete either with every test
still green. A new case was added to close that —
`test_each_none_guard_is_load_bearing_for_a_DIFFERENT_input`, which passes a bundle value that
literally stringifies to `"None"` (reachable because `skill_row_visible` does **not** run
`coerce_uid` — it trusts the caller). Plant D against that case:

```
E  AssertionError: a bundle value that stringifies to 'None' must not match a NULL marker
FAILED …::test_each_none_guard_is_load_bearing_for_a_DIFFERENT_input
1 failed, 14 passed
```

⭐ **The guards are a pair, load-bearing for different inputs, and that is now measured rather
than asserted.**

### SC#2 — the count fence, RED at 2 before the delegation

```
E  AssertionError: expected exactly ONE home for the born-for rule, found 2:
   {'services/expert_service.py': {'dsl': 0, 'row': 1},
    'utils/skill_visibility.py': {'dsl': 1, 'row': 1}}
E  AssertionError: services/expert_service.py encodes the born-for rule (dsl=0, row=1) —
   it must delegate to app/utils/skill_visibility.py instead (D-264-01)
3 failed, 19 passed
```

Green after the delegation, and the fence's own positive control proves it discriminates:
`grep -c born_for_expert_bundle_id backend/app/services/expert_service.py` reads **3** (the
`SELECT` column list and two prose mentions) while the AST count reads **0**.

⚠ **A trap the fence hit on its first run and that any copy of this shape will hit:**
`ast.walk` **descends into a `JoinedStr`**, so an f-string's literal fragments are visited a
second time as bare `Constant` nodes. The first version reported `dsl=2` for a module carrying
exactly one f-string encoding. Fixed by adding JoinedStr children to the ignore set alongside
docstrings; the reason is written into `_ignored_constants`' docstring.

### The degenerate `None`-org case — driven, not reasoned about (RESEARCH §8.10)

The pre-264 condition was planted back verbatim and the new case run against it:

```
E  AssertionError: a caller with no org must not reach a NULL-org row — the delegation is
   deliberately tighter here than the pre-264 `None == None` comparison
E  assert {'orphan_row'} == set()
```

**So the behaviour delta is real, not theoretical.** `expert_service.py` restored
md5-identical (`fa4bbc42a13fe20ab69a2fd228319c07` before and after the plant).

**What ships: the strictly TIGHTER behaviour.** `caller_org_ids` is built as
`{str(caller_org_id)} if caller_org_id is not None else set()` — never `{"None"}` — so a
caller with no resolvable org can no longer reach a `NULL`-org row. This function runs on a
BYPASSRLS read where the predicate *is* the tenancy boundary, and `run_producer.py:404` can
construct a `None` caller org for a user with no org, so the case is reachable on the chat
path. Recorded as a decision in the function's docstring with the test named.

## D-264-02 — both retirements, rewritten not erased

| register | what was done | proof |
|---|---|---|
| `test_seed125_…py:100-116` (module block) | original quoted VERBATIM inside the rewrite | `grep -c "which is the exact shape of SEED-125"` → `1` |
| `test_seed125_…py` `test_born_for_marker_does_not_admit_another_users_private_same_org_skill` | docstring rewritten, original quoted, **assertion byte-unchanged**, new sibling added | `grep -c "The agent loop has no such scope"` → `2`; `git diff` on that function shows docstring-only removals |
| `expert_service.py` `⛔ WHY THIS IS NOT IN …` | rewritten, original quoted | `grep -c "That is a decision, not an oversight"` → `1`; `grep -c "five call"` → `0` |

⚠ **One asymmetry worth naming rather than leaving to be discovered.** The plan's criterion
`grep -c "five call" expert_service.py == 0` conflicts with quoting an original that contains
*"(five call sites)"*. Resolved by striking it through **inside** the quotation —
`(~~five~~ FOUR call sites)` — which satisfies the grep and leaves the wrong figure visible,
this project's house style. The seed125 quote is left byte-verbatim (its criterion did not bind
it) and corrected in a note below the quote, so `grep -c "five call"` there is **2**: the quoted
original and the line correcting it. Neither file now contains an *unqualified* claim of five.

The correction itself: `tool_dispatcher` makes **four** `_resolve_skill_visibility_or` calls
feeding **six** `.or_()` applications. Also corrected in `skill_visibility.py`'s own docstring.

## Deviations from Plan

### 1. [Rule 1 — measured correction] The plan says "all eight `test_263_expert_born_skill_resolution.py` tests"; there are **eleven**

`pytest --collect-only -q` reads `11 tests collected`. All eleven pass unmodified through the
delegation, including the disabled-skill pin. Only the plan's count was wrong.

### 2. [Rule 1 — refuted prediction] The weak-pin contrast needed TWO plants, not one

Documented in full above. The plan predicted the old `startswith`/`in` pins would stay green
under *an* appended term; one of them fires for a nested append. The demonstration that
actually supports deleting them is the fourth-top-level-branch plant, which is also the
dangerous shape, so the evidence is stronger than planned rather than weaker.

### 3. [Rule 2 — missing critical coverage] A new case for the `"None"`-string bundle

Neither guard could be driven alone against the planned table (finding above). Rather than
record the guards as "driven together and therefore fine", a case was added that makes the
row-side guard individually load-bearing.

### 4. Out of scope, logged not fixed

Nothing new. `deferred-items.md` already carries wave 1's `check-landing-drift.cjs` finding;
this plan touches no frontend source at all, so the frontend vitest count gate was **not run**,
deliberately and stated rather than left unmentioned (`git diff --name-only 474035116..HEAD` is
backend + planning only).

## Baseline

Measured on this exact base before any edit — **twice, concurrently**, which also re-confirms
CLAUDE.md's "two concurrent full backend unit runs are identical to serial": both read `71 failed`.

| | base (`474035116`) | final (`cedc580f2`) |
|---|---|---|
| verdict line | `71 failed, 5436 passed, 2 xfailed, 2 xpassed` | `71 failed, 5462 passed, 2 xfailed, 2 xpassed` |
| FAILED node ids | 71 | 71 |
| in this plan's blast radius | **0** | **0** |

```
base  raw FAILED lines=71 unique node ids=71
final raw FAILED lines=71 unique node ids=71
NEW (final not in base):
GONE (base not in final):
=== both empty == identical set ===
```

**`+26 passed` is fully attributed, with no residual:** `test_264_one_home_born_for_predicate.py`
collects **23** (10 functions, one parametrized over the 11-row table, one over the 4 silent
modules) and `test_seed125_skill_visibility_filter.py` went **7 → 10** functions (+3 bundle-arm
cases, −1 combined `==` test folded back into the three original arms it duplicated).

⚠ **The wave-1 stderr-pollution finding recurred, in BOTH runs and on DIFFERENT tests** — proof
it is capture noise rather than a property of any test. A raw `comm` reported one id as both
NEW and GONE:

```
[base]  FAILED tests/unit/test_111_1_reembed_kickoff.py::test_dims_only_change_kicks_reembedC:\Vibe Apps\…
[final] FAILED tests/unit/test_061_consumer.py::test_xread_advances_last_id - ImportE…C:\Vibe Apps\…
```

Normalising by cutting each line at the first Windows drive-letter path before parsing the node
id makes both directions empty. **Diff the node id, never the printed line** — and a regex that
merely matches a node-id shape is not enough, because `[A-Za-z0-9_]+` happily absorbs the `C` of
`C:\`.

⚠ **A second measurement artefact, new this plan and worth not rediscovering:** `pathlib.write_text`
on Windows emits **CRLF** while the Write tool emits **LF**, so a plant-and-revert cycle changes a
file's raw `md5` without changing its content. `git diff` read CLEAN throughout and
`git hash-object` matched the index blob exactly (`128f99dd35db072e7f1c58c6453c7b490dbc3f49`);
the LF-normalised digest matched its pre-plant value (`e674e779a49fd94b9b5054ca4180483d`).
**Prove a restoration with `git diff --quiet` plus an LF-normalised digest**, not with a raw md5.

## Verification

| Check | Result |
|---|---|
| `bash scripts/bootstrap-worktree.sh …` ran as the first action | ✅ `BOOTSTRAP OK` |
| `pytest tests/unit -q --continue-on-collection-errors` | ✅ `71 failed`, node-id set-diff empty both ways |
| `pytest` the six in-scope suites (264 one-home, seed125, 263 born-skill, 263 save-refuses, 264 carrier, 182 grounding) | ✅ `75 passed` |
| all 11 `test_263_expert_born_skill_resolution.py` tests pass unmodified | ✅ |
| wave 1's `test_the_carrier_adds_no_branch_anywhere` and the closed-core invariant | ✅ green (this plan touches neither `tool_dispatcher` nor `agent_loop`) |
| `skill_visibility.py` imports (AST, not grep) | ✅ `__future__.annotations` + `app.utils.db.coerce_uid`, nothing else |
| `build_skill_visibility_or(_UID, set(), expert_bundle_id=_BUNDLE) == "is_system.eq.true"` | ✅ own driven case |
| two top-level branches with a bundle supplied | ✅ structural split at paren depth 0 |
| malformed bundle id raises `ValueError` | ✅ third arm on the existing injection pin |
| SC#2 count fence | ✅ `1` home; observed `2` pre-delegation |
| `grep -c born_for_expert_bundle_id expert_service.py` non-zero while AST count is 0 | ✅ `3` vs `0` |
| `grep -c "That is a decision, not an oversight" expert_service.py` | ✅ `1` |
| `grep -c "five call" expert_service.py` | ✅ `0` |
| `grep -c "The agent loop has no such scope" test_seed125_…py` | ✅ `2` |
| `git diff --stat 474035116..HEAD` confined to `files_modified` | ✅ 4 files, nothing else |
| `git diff --diff-filter=D` across the plan | ✅ empty — no deletions |
| STATE.md / ROADMAP.md untouched | ✅ |

## Known Stubs

None. Every code path added here is wired and driven; no placeholder values, no empty defaults
flowing to a surface.

## Threat Flags

None. No new endpoint, no new auth path, no new file access, no schema change. The one trust
boundary this plan touches — runtime value → PostgREST `.or_()` DSL — is the one the plan's own
threat register already names, and its mitigation (`coerce_uid` on the spliced bundle) ships
with a driven case (T-264-09).

## Notes for the phase

- **264-03 is unblocked and does not collide.** `_resolve_skill_visibility_or` in
  `tool_dispatcher.py` is byte-unchanged; the keyword it needs now exists with a proven-inert
  default. It should pass `str(ctx.born_for_bundle_id)` at the seam — `skill_visibility.py`
  annotates the parameter `str | None` by the module's own convention (see the divergence note
  above), and `coerce_uid` accepts a `UUID` anyway.
- **The SC#2 fence will fire on 264-03 if the dispatcher grows an encoding.** It must pass the
  bundle *through* to `build_skill_visibility_or`, never re-derive a term. `tool_dispatcher.py`
  is one of the four modules the fence asserts silent, by name.
- **The ledger obligation remains 264-04's.** This plan modifies two source files —
  `app/utils/skill_visibility.py` (row added at 264 planning) and `app/services/expert_service.py`
  (G-5 FIRES, row present) — and adds no ledger rows itself.
- **`test_264_one_home_born_for_predicate.py`'s evaluator is grammar-only by design.** If a
  future phase teaches it the rule, SC#2's count becomes a lie: the evaluator would be a fourth
  encoding wearing a test's clothes. `test_the_evaluator_can_actually_refuse_a_row` is its
  positive control and should stay.

## Self-Check: PASSED

- `backend/tests/unit/test_264_one_home_born_for_predicate.py` — FOUND
- `backend/app/utils/skill_visibility.py` — FOUND
- `backend/app/services/expert_service.py` — FOUND
- `backend/tests/unit/test_seed125_skill_visibility_filter.py` — FOUND
- `.planning/phases/264-born-for-skills-must-load-not-just-resolve/264-02-SUMMARY.md` — FOUND
- commits `d70b2d607`, `b44971178`, `cedc580f2` — all FOUND in `git log`
