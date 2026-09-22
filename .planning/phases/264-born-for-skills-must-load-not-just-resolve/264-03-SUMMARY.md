---
phase: 264-born-for-skills-must-load-not-just-resolve
plan: 03
subsystem: backend-tool-dispatch
tags: [pack-17, defect-closed, tdd, per-site-decision, recording-fake, negative-fences]
requires:
  - "ToolContext.born_for_bundle_id (264-01, the inert carrier)"
  - "build_skill_visibility_or(..., expert_bundle_id=None) (264-02, the one home)"
provides:
  - "_resolve_skill_visibility_or(ctx, *, born_for=False) — the decision in the signature"
  - "load_skill / read_skill_file / execute_code skill-file injection opt in (3 sites)"
  - "save_skill's lint corpus refuses IN SOURCE, and the refusal is driven"
  - "the first tests/unit proof that a same-org NON-AUTHOR gets the instruction BODY"
  - "a recording+FILTERING supabase fake, importable, with no catch-all attribute hook"
  - "negative fences over grounding.py / phase_types.py, runtime as well as AST"
  - "a DISABLED born-for skill refused at the two handlers that filter enablement nowhere"
affects:
  - "264-04 (the real-DB driver; the ledger + prose obligations, now with one more owed correction)"
tech-stack:
  added: []
  patterns:
    - "an explicit keyword-only opt-in so a widening cannot happen by omission"
    - "a query fake whose .or_() RECORDS and FILTERS, using the sibling suite's grammar evaluator"
    - "AST counts over text counts wherever the docstring must quote the token it fences"
key-files:
  created:
    - backend/tests/unit/test_264_load_skill_born_for.py
    - backend/tests/unit/test_264_unchanged_sites_fenced.py
  modified:
    - backend/app/services/tool_dispatcher.py
decisions:
  - "D-264-04 honoured site-by-site: three born_for=True, one written refusal, three fenced UNCHANGED"
  - "D-264-08 honoured: six RED drives, every failure quoted, every plant restored to its index blob"
  - "the plan's grep criteria were met LITERALLY by rewording docstrings; the executable fences are AST"
metrics:
  duration: "~2h15m"
  completed: 2026-09-22
  tasks: 3
  commits: 4
---

# Phase 264 Plan 03: The Born-For Arm Reaches the Load Path Summary

`_resolve_skill_visibility_or` now takes a keyword-only `born_for`, three of its four call
sites pass it, the fourth refuses in writing — and a same-org **non-author** on a run with
that Expert active gets the **instruction body** of a born-for skill back from `load_skill`,
proven by the first test in this repository that drives that handler without neutralising the
predicate. Backend unit gate at exactly **71 failed**, node-id set-diff empty both directions.

## Commits

| # | Hash | Message |
|---|---|---|
| 1 | `a94d41f99` | `test(264-03): the resolver arms and the four per-site decisions, RED` |
| 2 | `44b15deaa` | `feat(264-03): born_for keyword carries each site's D-264-04 decision` |
| 3 | `286d7a745` | `test(264-03): SC#1 — a same-org non-author gets the instruction BODY` |
| 4 | `b59eb11a5` | `test(264-03): fence what did NOT widen; refuse a disabled born-for skill` |

Base: `53ece799f`. `git diff --stat 53ece799f..HEAD` touches **exactly the three files** in
`files_modified` — 1233 insertions / 5 deletions — and `--diff-filter=D` is empty.

## What shipped

**`tool_dispatcher.py`** — `_resolve_skill_visibility_or(ctx, *, born_for: bool = False)`. When
true it reads `getattr(ctx, "born_for_bundle_id", None)` and forwards `str(...)` of it as
`expert_bundle_id`; when false it calls the builder exactly as before. **No term is re-derived
here** — the bundle is passed *through* to the one home, which is why 264-02's SC#2 count fence
still reads `1` with `tool_dispatcher.py` named among its four silent modules.

The four sites, each stating its decision in its own source lines:

| Site | Decision | What the comment records |
|---|---|---|
| `_handle_load_skill` | **WIDEN** | the defect itself — 263 admits the row at RESOLVE time, the body was fetched through an unwidened predicate. Also records that the filter is resolved ONCE and reused, which fixes `available_skills` by construction. |
| `_handle_save_skill` siblings | ⛔ **NOT WIDENED** | all three measured reasons: not in either Expert tool set so **not advertised** (⚠ not *unreachable* — `phase_whitelist` is `None` on a chat run); a lint corpus with no user-visible capability; a WRITE handler's helper. |
| `_handle_read_skill_file` | **WIDEN** | `load_skill` returns `files: [...]`, so a loadable body with unreadable files is the same defect one layer down. Names the no-`is_enabled` caveat. |
| `_handle_execute_code` injection | **WIDEN** | the quietest failure of the three — a `logger.warning` and a silently skipped file, so the sandbox runs without the helper. |

⛔ **No `.or_()` application line moved.** `git diff -U0 53ece799f..HEAD | grep "^[-+].*\.or_("`
returns nothing.

**Two new test modules** — `test_264_load_skill_born_for.py` (18 cases) and
`test_264_unchanged_sites_fenced.py` (10 cases). The first ships the recording + **filtering**
supabase fake the second imports rather than copies; its `.or_()` stores the predicate AND
narrows the rows by evaluating it through `_predicate_admits`, **imported** from 264-02's
module so no second encoding of the rule exists.

## TDD: six RED drives, every failure quoted

### RED 1 — the resolver arms, before the keyword existed (commit 1 → 2)

```
E  TypeError: _resolve_skill_visibility_or() got an unexpected keyword argument 'born_for'   (×5)
E  AssertionError: expected exactly 3 sites passing born_for=True (load_skill, read_skill_file,
   the execute_code injection), found 0
E  assert 'EXPERT_CORE_TOOLS' in '        .eq("name", name)\n        .limit(1)\n …'
8 failed, 2 passed
```

### RED 2 — ⭐ THE DEFECT ITSELF, reproduced by reverting the three `born_for=True` keywords

Plant: `sed -i 's/, born_for=True)/)/g'` on `tool_dispatcher.py` (3 → 0 occurrences).

```
E  assert 'error' not in {'available_skills': ['shared-helper'],
                          'error': "Skill 'quarterly-margin-brief' not found or not enabled.",
                          'hint': 'Call load_skill again with one of the names in available_skills,
                                   exactly as written.'}
E  AssertionError: assert ['shared-helper'] == ['quarterly-margin-brief', 'shared-helper']
E  AssertionError: expected ONE opted-in resolver call, got [False]
4 failed, 14 passed
```

⭐ **That first line is PACK-17 verbatim** — the miss branch hands the model an error whose
"loadable names" list EXCLUDES the one the Expert's prompt just promised, and instructs it to
retry with one of the others.

### RED 3-7 — the five planted violations behind the negative fences

| # | File planted | Plant | Fence(s) that fired | Failure text |
|---|---|---|---|---|
| P1 | `tool_dispatcher.py` | `born_for=True` added at the `_sibling_filter` call | the `:1459` base-literal pin **and** the 3-sites AST count | `assert 'is_system.eq…ed.is.true)))' == 'is_system.eq…red.eq.true))'` · `found 4` |
| P2 | `harness/grounding.py` | `expert_bundle_id="3333…"` on its `build_skill_visibility_or` call | the AST keyword fence, the RUNTIME predicate read, **and** wave 1's own fence | `assert 1 == 0` · `assert 'is_system.eq…ed.is.true)))' == …` |
| P3 | `harness/phase_types.py` | `born_for_bundle_id=getattr(ctx, …)` on the phase `ToolContext` build | the AST keyword fence **and** the parent-carries-a-bundle behavioural arm | `assert UUID('8f13da29-…') is None` |
| P4 | `utils/skill_visibility.py` | `,is_enabled.is.true` deleted from the born-for disjunct | BOTH disabled-refusal cases, the term pin, 264-02's table, 3 of this file's own | `AssertionError: a DISABLED born-for skill's bytes reached the sandbox` + `print('Injected skill file: margin.md')` |
| P5 | `tool_dispatcher.py` | `.eq("is_enabled", True)` added inside `_handle_read_skill_file` | `test_neither_widened_handler_filters_is_enabled_itself` | `assert [<ast.Call …>] == []` |

**Every plant restored, proven per 264-02's rule** — `git diff --quiet` **plus**
`git hash-object` against the index blob, never a raw md5:

| File | blob before | blob after plant | blob after revert |
|---|---|---|---|
| `tool_dispatcher.py` (RED 2) | `8940dbde…` | `c5717eb3…` | **`8940dbde…`** |
| `tool_dispatcher.py` (P1) | `8940dbde…` | `39d63dc7…` | **`8940dbde…`** |
| `harness/grounding.py` (P2) | `e7c38982…` | `c68cee41…` | **`e7c38982…`** |
| `harness/phase_types.py` (P3) | `214fb43f…` | `a958ce52…` | **`214fb43f…`** |
| `utils/skill_visibility.py` (P4) | `128f99dd…` | `54086ee3…` | **`128f99dd…`** |
| `tool_dispatcher.py` (P5) | `8940dbde…` | `820b6c56…` | **`8940dbde…`** |

⚠ **No gate was running during any plant** (264-01's `inspect.getsource` lesson). Each plant was
applied, the targeted suites run, and the file reverted before the next.

## Findings

### 1. ⭐ THE GROUNDING FENCE'S OUTCOME HALF WOULD NOT HAVE CAUGHT P2 — measured, not assumed

With `expert_bundle_id` planted at `grounding.py:208`, `_skill_registry` returned **0 rows**
while its pushed-down query was **fully widened**:

```
OUTCOME rows: 0
PREDICATE widened: True
```

Because `_skill_registry`'s Python post-filter calls `skill_row_visible` **without** a bundle,
the two encodings disagree in the safe direction and the leak is invisible to any
rows-returned assertion. **The predicate read is the load-bearing half of that fence**, and the
measurement is written into its docstring rather than left as an inference.

### 2. ⭐ WAVE 1's PHASE_TYPES BEHAVIOURAL FENCE IS GREEN UNDER P3; THIS PLAN'S IS RED

264-01 recorded that its plant 6 (a `getattr` resolving to `None`) fired the AST count but not
the behavioural fence, and re-planted with a real UUID to drive them separately. P3 confirms
the structural cause: wave 1's fixture parent carries **no bundle at all**, so its behavioural
assertion is vacuous against a real inheritance bug. The new
`test_the_harness_phase_ctx_is_None_EVEN_WHEN_ITS_PARENT_CARRIES_A_BUNDLE` hands the builder a
parent with a live `born_for_bundle_id` and went red where wave 1's stayed green — both in the
same run.

### 3. ⚠ A TEXT FENCE TRIPPED ON ITS OWN PROSE — THREE TIMES IN ONE PLAN

`src.count('getattr(ctx, "born_for_bundle_id", None)') == 1` read **2** against correct code,
because the resolver's docstring quotes the expression deliberately. `src.count("def __getattr__") == 0`
read **2**, because the test asserting it names the token. And the plan's own
`grep -c "born_for=True" == 3` read **5** for the same reason.

Resolution, both halves:
- **The executable fences are AST counts** — `ast.Call` for the `getattr`, `ast.FunctionDef` for
  the attribute hook, `ast.keyword` for the opt-in. A comment cannot satisfy any of them.
- **The plan's literal grep criteria are met anyway**, by rewording the docstrings so the code
  is the only place the token appears (and, in the sibling-hook case, by building the token from
  `"def " + hook`). Measured at close: `3 / 5 / 1 / 0 / 0`.

### 4. ⚠ THE `.or_()` APPLICATION COUNT IS SEVEN, NOT SIX — a prose correction owed in two registers

`RESEARCH §2.3` and, quoting it verbatim, `app/utils/skill_visibility.py`'s module docstring both
say the four resolver calls feed **six** applications and enumerate them; the enumeration omits
`_handle_save_skill`'s, which the same paragraph's own prose says exists. Measured:
**1330 / 1358 / 1474 / 1605 / 1617 / 2217 / 2229** — `_skill_filter` ×4, `_sf_filter` ×2,
`_sibling_filter` ×1.

⭐ **The `four call sites` figure is correct and every D-264-04 decision rests on that one.** Only
the applications count is wrong. ⚠ That paragraph is itself a correction — 264-02 rewrote it to
retire a "five call sites" claim — so this is the **second** wrong number in one sentence.
Pinned executably at **7** here; the prose fix is registered in `deferred-items.md` and owned by
`264-04`, whose `files_modified` covers `skill_visibility.py`.

### 5. ⚠ CRLF BITES AGAIN, IN A NEW PLACE

`tool_dispatcher.py` is **CRLF** in this worktree, and `cat -A` under Git Bash printed bare `$`
rather than `^M$`, so the line endings were invisible to inspection. A `read_bytes().decode()`
plant pattern written with `\n` matched **zero** times against correct code. `sed` was unaffected
(it matches within a line). 264-02's finding was about digests; this is the same cause biting
pattern matching. **Read the bytes, not `cat -A`.**

## Deviations from Plan

### 1. [Rule 3 — blocking] Task 1's RED needed a test file, which the plan assigned to Task 2

Task 1's `<files>` lists only `tool_dispatcher.py`, but `tdd="true"` and D-264-08 require the
RED first. The resolver-arm cases were therefore written into
`backend/tests/unit/test_264_load_skill_born_for.py` — Task 2's designated file, inside the
plan's overall `files_modified` — and committed as commit 1 before the implementation in
commit 2. Task 2 then extended the same file. No file outside `files_modified` was touched.

### 2. [Rule 1 — measured correction] The plan's `.or_()` count criterion was wrong

`test_no_or_application_line_moved` was authored at the plan's **6** and went red at **7**
against correct code. Fixed to 7 with the derivation in its docstring; see finding 4.

### 3. [Rule 1 — measured correction] Three grep criteria were satisfiable by a comment

See finding 3. The AST forms are strictly stronger and the literal criteria hold too.

### 4. Out of scope, logged not fixed

`node scripts/check-landing-drift.cjs` still FAILS at this plan's base (`SURFACE_TABS.orgAdmin`
vs the landing `facts.ts`) — the hook fired on every edit in this worktree. Reproduced on a tree
whose only modified file was `backend/app/services/tool_dispatcher.py`. **This plan touches zero
frontend source**, so the frontend vitest count gate was deliberately **not run** and is stated
rather than left unmentioned. Recorded in `deferred-items.md`, unchanged from 264-01's entry.

## Baseline

Measured on this exact base before any edit, and again on a quiet tree at the close.

| | base (`53ece799f`) | final (`b59eb11a5`) |
|---|---|---|
| verdict line | `71 failed, 5462 passed, 2 xfailed, 2 xpassed` | `71 failed, 5490 passed, 2 xfailed, 2 xpassed` |
| FAILED node ids | 71 | 71 |
| in this plan's blast radius | **0** | **0** |

```
base=71 final=71
NEW (final not in base):
GONE (base not in final):
=== both empty == identical set ===
```

**`+28 passed` is fully attributed with no residual:** `test_264_load_skill_born_for.py` collects
**18** and `test_264_unchanged_sites_fenced.py` collects **10**.

⚠ Node ids were extracted by cutting each `FAILED` line at the **first Windows drive-letter
path** before parsing, per 264-01/02's finding — interleaved stderr otherwise makes one test read
as both NEW and GONE.

## Verification

| Check | Result |
|---|---|
| `bash scripts/bootstrap-worktree.sh …` ran as the first action | ✅ `BOOTSTRAP OK` |
| HEAD on `worktree-agent-a1c325a065bba81ae`, reset to `53ece799f` | ✅ |
| `pytest tests/unit -q --continue-on-collection-errors` | ✅ `71 failed`, node-id set-diff empty both ways |
| the eight in-scope suites (264 ×4, seed125, 182 grounding, 142 load_skill, 263 born-skill) | ✅ `98 passed` |
| `grep -c "born_for=True"` | ✅ `3` |
| `grep -c "_resolve_skill_visibility_or("` | ✅ `5` (1 def + 4 calls) — unchanged from base |
| `grep -c 'getattr(ctx, "born_for_bundle_id", None)'` / `grep -c "ctx.born_for_bundle_id"` | ✅ `1` / `0` |
| `grep -c "def __getattr__"` in the SC#1 file | ✅ `0` |
| `git diff -U0 … \| grep "^[-+].*\.or_("` | ✅ empty |
| the save_skill comment carries `EXPERT_CORE_TOOLS`, `not advertised`, `lint` | ✅ driven by a test, not eyeballed |
| 264-02's SC#2 one-home count fence | ✅ still `1` — the bundle is passed through, never re-derived |
| wave 1's carrier fences (closed-core, no-branch, the three UNWIRED modules) | ✅ green |
| `min_lines` 120 / 80 | ✅ 758 / 394 |
| `git diff --stat 53ece799f..HEAD` confined to `files_modified` | ✅ 3 files |
| `git diff --diff-filter=D` across the plan | ✅ empty |
| STATE.md / ROADMAP.md untouched | ✅ |

## G-5 — `backend/app/services/tool_dispatcher.py`

**Triple re-derived 2026-09-22 at this plan's base: `88 / 38 / 5093`** (40 buckets minus the two
six-digit dated quick tasks `260529` and `260705`). The CLAUDE.md row reads a stale
`85 / 35 / 5048`; the plan's own text read `87 / 37 / 5082`. **G-5 FIRES.**

**Honoured by construction:** one keyword-only parameter on one existing helper, three existing
call sites gaining that keyword, one existing call site gaining a comment, and four comment
blocks. **No new handler, no new query, no new branch inside any handler** — the resolver's one
new statement is a conditional expression on a local, and every `.or_()` application line is
byte-unchanged.

⛔ **The named seam is NOT discharged and this plan does not claim it is.** If a FIFTH resolution
site ever appears, the extraction is a `skills`-resolution module, not another handler-local
helper. The ledger row obligation for this phase remains `264-04`'s.

## Known Stubs

None. Every path added here is wired and driven; no placeholder values, no empty defaults
flowing to a surface.

## Threat Flags

None. No new endpoint, no new auth path, no new file access pattern, no schema change. The one
trust boundary touched — a run-scoped id becoming a tenancy decision — is the one this plan's own
threat register names, and T-264-13 / -14 / -15 / -16 / -17 / -18 each ship with a driven case.

## Notes for the phase

- **264-04 inherits one more prose correction** (finding 4) alongside the ledger rows. Both live
  in `deferred-items.md` with an owner and a trigger.
- **The recording fake is the reusable asset.** Any future test that must prove *which rows a
  handler would get* should import `_RecordingQuery` / `_FakeSupabase` from
  `test_264_load_skill_born_for.py` rather than copy `test_142`'s passthrough shape — that shape
  is why this defect survived 263.
- **`[ASSUMED]` from RESEARCH §8.11 is still assumed.** Whether born-for skills in this
  deployment actually bundle files is not established by anything here; the `read_skill_file` /
  `execute_code` widenings are justified by the `files: [...]` promise, not by an inspected row.
  D-264-09 / UAT owes that.
- **`agent_loop.py:1435` (SEED-129) was NOT touched.** This plan's only source diff is
  `tool_dispatcher.py`.

## Self-Check: PASSED

- `backend/app/services/tool_dispatcher.py` — FOUND
- `backend/tests/unit/test_264_load_skill_born_for.py` — FOUND
- `backend/tests/unit/test_264_unchanged_sites_fenced.py` — FOUND
- `.planning/phases/264-born-for-skills-must-load-not-just-resolve/264-03-SUMMARY.md` — FOUND
- `.planning/phases/264-born-for-skills-must-load-not-just-resolve/deferred-items.md` — FOUND
- commits `a94d41f99`, `44b15deaa`, `286d7a745`, `b59eb11a5` — all FOUND in `git log`
