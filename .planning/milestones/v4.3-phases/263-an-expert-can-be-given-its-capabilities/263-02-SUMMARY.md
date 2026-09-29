---
phase: 263-an-expert-can-be-given-its-capabilities
plan: 02
subsystem: experts / skill authoring
tags: [PACK-14, PACK-15, PACK-16, D-263-02, D-263-13, D-263-14, forced_emit, structured-output]

plan_base_commit: 9c01c74e9c5b20d15d6d446041e519f533a67106
phase_base_commit: 48976e11e71a5986483546a5625e18064c3c474b   # NOT this plan's base — see 263-01

requires:
  - phase: 263-01
    provides: skill provenance (migration 191, born_for_expert_bundle_id) — read, not extended here
  - backend/app/services/forced_emit.py — the recovery ladder that makes a REQUIRED field safe
  - backend/app/services/skill_tuner_service.py — _emit_tool + resolve_skill_builder_model, IMPORTED
  - public.skills row 00000000-0000-0000-0000-000000000010 (skill-creator), migrations 087/088/089/093
provides:
  - ExpertDraftOutput.suggested_new_skills (REQUIRED, empty-able) + the SuggestedNewSkill model
  - a de-hatched drafter prompt — invented names can no longer enter member_skills
  - backend/app/services/skill_body_authoring.py — author_skill_body, the PACK-15 DRIVER
  - the falsifiable proof that the craft doctrine is BORROWED, not owned (unit + live fences)
affects:
  - 263-03 (the POST /experts/draft-skill-body route consumes author_skill_body)
  - 263-04 (the Studio renders suggested_new_skills and the authored body)

tech-stack:
  added: []          # ⭐ this plan installs NOTHING — T-263-SC has no subject
  patterns:
    - "doctrine READ from the DB at call time, never inlined as module prose — the difference between a driver and an engine"
    - "sentence-granular + lead-sentence strip: a whole-line filter cannot keep six doctrine tokens and drop seven tool tokens off ONE line"
    - "slice a skill section to its BULLET RUN, not to the next heading — a section's tail is choreography the token strip cannot see"
    - "a kill-switch refusal is an EXCEPTION, not None; None already means 'ran and produced nothing honest'"

key-files:
  created:
    - backend/app/services/skill_body_authoring.py
    - backend/tests/unit/test_263_craft_block_is_read.py
    - backend/tests/integration/test_263_craft_block_live_read.py
    - backend/tests/unit/test_263_expert_draft_suggested_skills.py
    - .planning/phases/263-an-expert-can-be-given-its-capabilities/deferred-items.md
  modified:
    - backend/app/services/expert_authoring.py
    - docs/HOT-FILE-LEDGER.md
    - backend/tests/unit/test_256_judge_usage_counted.py     # NOT in files_modified — deviation 2
    - backend/tests/unit/test_261_expert_authoring.py        # NOT in files_modified — deviation 2
  NOT_modified:
    - CLAUDE.md   # deliberate — see deviation 3

key-decisions:
  - "The craft slice ends at the doctrine BULLET RUN, not at the next `## ` heading. Measured on the live row, the section bound carried ~700 of 1466 chars of interview choreography that contradicts the module's own framing. D-263-13 says 'the five bullets', so the bullet run is the decision's own boundary."
  - "_strip_tool_choreography is SENTENCE-granular with a lead-sentence rule, not line-granular as the plan's action text says — measured, a whole-line strip CANNOT satisfy the plan's own acceptance criteria."
  - "skill_body_authoring enrolled NO-RUN in _EXPECTED_FORCED_EMIT_SITES — a second registry no 263 document names."
  - "The new ledger row went into docs/HOT-FILE-LEDGER.md only, not CLAUDE.md's table: the gate reads only the former, and CLAUDE.md's table is explicitly the G-5-FIRING abridged list."

requirements-completed: [PACK-14, PACK-15]

metrics:
  duration: ~45 min
  tasks: 2
  commits: 7
  completed: 2026-09-21
---

# Phase 263 Plan 02: The Drafter Names Its Gaps, and the Body It Writes Is Provably Borrowed — Summary

**`ExpertDraftOutput` now carries a REQUIRED `suggested_new_skills`, the hatch that let invented
names into `member_skills` is deleted, and `skill_body_authoring.py` authors a skill body by
reading `skill-creator`'s craft doctrine out of the database at call time — a claim made
falsifiable by a fence that was driven RED against a planted inline bullet.**

## Performance

- **Duration:** ~45 min · **Tasks:** 2 · **Commits:** 7 · **Files created:** 5 · **Files modified:** 4

## Commits

| # | Hash | Subject |
|---|---|---|
| 1 | `dd4bec4fb` | `test(263-02)` drive D-263-02 RED before the field exists |
| 2 | `4f840aa96` | `feat(263-02)` the drafter names the skills it cannot find |
| 3 | `e29dbddc8` | `test(263-02)` drive the PACK-15 reuse fences RED before the driver exists |
| 4 | `da237c53d` | `feat(263-02)` the body-authoring DRIVER borrows its doctrine, never owns it |
| 5 | `794517218` | `test(263-02)` drive RED on the interview choreography the token strip cannot see |
| 6 | `84fa20013` | `fix(263-02)` end the craft slice at the doctrine, not at the section |
| 7 | `0dd045200` | `fix(263-02)` enrol the new forced_emit site and repair two stale mock payloads |

RED precedes GREEN in every behaviour-adding pair (1→2, 3→4, 5→6).

⚠ **The worktree base assertion FIRED, as predicted.** The worktree arrived on the default branch
at `5ff8c584`; `git merge-base` returned `658cb8547`, not the required base, and the `git reset
--hard 9c01c74e9` corrected it. Recorded because the dispatch asked for it, not as an anomaly.

---

## Task 1 — the drafter names what it cannot find

`SuggestedNewSkill` (draft-only, floored 3/40/40) sits above `ExpertDraftOutput`;
`suggested_new_skills` is the 14th field as `Field(..., min_length=0)`.

### The trap the plan named, measured

`_generate_fallback_draft` takes explicit kwargs and no `**extra`, and it is reached from inside
`except Exception`. It got `suggested_new_skills=[]` in the same task. `test_263_expert_draft_suggested_skills.py`
calls it **directly** rather than through the `forced_emit` success path, because the success path
structurally cannot see this failure.

### ⛔ A SECOND half of that same trap the plan did NOT name, and it shipped red

The plan warned about the fallback constructor only. But `generate_expert_draft` also builds
`ExpertDraftOutput(**emitted)` from the emitted **dict**, inside the same `try`. Two pre-existing
cases in `test_261_expert_authoring.py` mock an emission without the new field, so the model
raised, the `except` swallowed it, and the fallback answered instead — and **the assertion that
went red was an unrelated one about the NAME**:

```
E   AssertionError: assert 'Synthesize Quarterly Taxes Specialist' == 'Tax Synthesizer'
```

⚠ **That is the failure mode to remember: a missing required field on the SUCCESS path does not
surface as a `ValidationError` anywhere — it surfaces as the fallback quietly answering.** Fixed in
commit 7 by adding the field to both mocked payloads; the comment in the test records why.

### The hatch is deleted, not softened

Prompt item 11 lost `, or include 3-5 recommended domain skill names`; a new item 14 routes genuine
gaps to the field and carries an explicit `NEVER put a name from this list into member_skills`. The
hatch's **absence** is asserted from the module source, and the positive arm asserts the
replacement is present — without it, deleting the hatch alone would still pass.

### Recorded rather than repeated: the safety argument is thinner than CONTEXT.md implies

`generate_expert_draft` passes `strict=False`, and `forced_emit:490-491` skips the `strict_force`
rung when `strict is False`. On a `force_strict`-tier model the ladder is **two rungs, not three** —
one retry, then the honest floor. Written into the module comment beside the field.

### Acceptance criteria, measured

| Criterion | Measured |
|---|---|
| ≥ 6 cases pass | **7 passed** |
| `grep -c "or include 3-5 recommended domain skill names"` | **0** |
| `grep -c "min_length=0"` | **2** (field + comment) |
| `grep -c "suggested_new_skills: list\[SuggestedNewSkill\] = Field(default"` | **0** |
| `grep -c "suggested_new_skills=\[\]"` | **1** (the fallback constructor) |
| `ExpertDraftOutput.model_fields[…].is_required()` | **`True`** |
| `test_261_single_expert_authoring_gate.py` | **passes** |

---

## Task 2 — the DRIVER, and the fence that makes PACK-15 a measurement

### ⭐ The Fence-1 RED drive, verbatim

Planted one craft bullet as a module literal inside `_compose_system_prompt`:

```
E       AssertionError: module contributed its own craft doctrine: ['Imperative form']
E       assert ['Imperative form'] == []
E         Left contains one more item: 'Imperative form'
```

| | md5 of `backend/app/services/skill_body_authoring.py` |
|---|---|
| before plant | `ac1d8d6fee0f8ff42b71f6c487668e1e` |
| after restore | `ac1d8d6fee0f8ff42b71f6c487668e1e` |

**Identical.** 1 of 9 cases went red — the negative arm only, which is the correct blast radius:
the positive arm supplies the block, so the planted token is legitimately present there.

### The six tokens, read from the LIVE DB row

Fetched with `SELECT instructions FROM public.skills WHERE id = '…0010'` against local :54322,
9714 chars. All six present in the extraction, zero of the seven tool tokens:

```
Apply this craft (it is what makes skills work or fail):
- **Imperative form.** Write directives to the agent (…).
- **Explain the why, sparingly.** A short reason beats a wall of MUST rules …
- **Generalize, don't overfit.** Describe the shape of the task …
- **A pushy-but-honest description.** … never claim more than the skill actually does.
- **Progressive disclosure — but know the limit.** Keep the core instructions lean.
```

### ⛔ THREE MEASURED CORRECTIONS TO THE PLAN'S OWN PREMISES

**(1) The live row is migration 093's, not 089's.** `263-02-PLAN.md` says *"⛔ **NOT 087 and NOT
088** — 088 and 089 each do a FULL rewrite, so the live row is 089's"*. Measured:

```
$ grep -n "SET instructions" supabase/migrations/*.sql
087_skill_creator_reborn.sql             088_skill_creator_eval_step_sequencing.sql
089_skill_creator_file_attach_honesty.sql  093_skill_creator_sandbox_library_awareness.sql
```

**093 rewrites it again** and adds a **SIXTH** craft bullet (*"Author against installed sandbox
libraries"*), which `263-CONTEXT.md`'s *"the five bullets"* does not know about. ⭐ **This is the
third time in one phase that a migration number in prose went stale** (RESEARCH said 087; CONTEXT
corrected it to 089; both are now superseded). The integration fence's hard-failure message names
093 and the chain, derived at execution rather than inherited.

**(2) The line-wise strip the plan specifies CANNOT satisfy the plan's own acceptance criteria.**
The live fifth bullet is ONE line carrying `Progressive disclosure` **and** `workspace_write`,
`read_skill_file`, `Skills page`. Dropping the line removes a pinned doctrine token; keeping it
leaks three tool tokens. `_strip_tool_choreography` is therefore **sentence-granular** with a
**lead-sentence rule** (a line whose FIRST sentence carries the choreography is dropped whole —
otherwise 093's sixth bullet degrades to a headless *"For PDFs use `reportlab`…"*).

**(3) ⛔ The section bound leaks ~700 chars of interview choreography that CONTRADICTS the module's
own framing.** Measured on the live row, heading → next `## ` yields **1466 chars**, of which the
tail is *"Confirm the draft with the user, then save."*, *"Tell the user the skill is now saved in
their Skills tab"*, the eval-case handoff. **None of those lines names a tool**, so the seven-token
strip is structurally blind to them. And this module's framing says *"do not tell anyone the skill
has been saved — persisting it is a separate, human-reviewed step"* — so the composed prompt would
have instructed and forbidden the same thing. `_doctrine_bullets_only` trims to the bullet run,
which is **D-263-13's own boundary** (*"its §3 craft block (the five bullets…)"*).

Live result: **1466 → 767 chars.** Driven RED first, on both the unit and the live fence:

```
E   AssertionError: interview choreography leaked: 'Confirm the draft with the user'
```

### Acceptance criteria, measured

| Criterion | Measured |
|---|---|
| unit fence ≥ 7 cases | **10 passed** |
| live fence passes and does NOT skip | **5 passed, 0 skipped** |
| `grep -c "00000000-0000-0000-0000-000000000010"` | **1** |
| `grep -c "from app.services.skill_tuner_service import"` | **1** |
| `grep -cE "INSERT INTO\|UPDATE public.skills\|\.table\(\"skills\"\)"` | **0** |
| `grep -c "self_improve_enabled"` | **4** |
| module line count (`min_lines: 120`) | **373** |
| `test_259_closed_core_inventory.py` | **6 passed** |
| `_TOOL_REGISTRY` / `EMITTER_REGISTRY` / `PHASE_TYPE_REGISTRY_ENTRIES` at base and HEAD | **29 / 1 / 7**, unchanged |
| ledger row + section AT CREATION, same commit | `da237c53d` |

---

## Backend baseline — SET DIFF, both directions

Measured in this worktree at the plan base **before the first edit**, and again at HEAD.

| | base (`9c01c74e9`) | HEAD (`0dd045200`) |
|---|---|---|
| failed | **71** | **71** |
| passed | 5334 | **5351** (+17) |
| xfailed / xpassed | 2 / 2 | 2 / 2 |
| collection errors | 0 | 0 |

```
comm -13 base head   ->   (empty)   # zero NEW failures
comm -23 base head   ->   (empty)   # zero disappeared
71 lines each, sets IDENTICAL
```

**+17 is fully accounted, zero residual:** 7 cases in `test_263_expert_draft_suggested_skills.py`
plus 10 in `test_263_craft_block_is_read.py`. (The live fence's 5 cases live in `tests/integration/`
and are outside the `tests/unit` gate.) The base reading matches the orchestrator's independent
re-measurement of 71 exactly, and my new test files were **not** collected by the base run
(`grep -c test_263_expert_draft_suggested_skills` → 0), confirming it reflects the base tree.

### ⚠ AN INTERMEDIATE RUN READ **74**, AND THAT IS THE MOST USEFUL NUMBER IN THIS SUMMARY

Measured at `da237c53d`, after both tasks looked green on their targeted suites: **74 failed** —
three over a ceiling with zero headroom. The set diff named them in one step, and **all three were
mine and invisible to every targeted command the plan specifies**:

| New failure | Cause |
|---|---|
| `test_256_judge_usage_counted.py::test_every_forced_emit_call_site_carries_a_disposition` | A **second registry no 263 document names** |
| `test_261_expert_authoring.py::test_generate_expert_draft_uses_forced_emit` | Mocked emission missing the new required field |
| `test_261_expert_authoring.py::test_expert_draft_pdf_docx_extraction` | Same |

⭐ **The plan named `test_259_closed_core_inventory.py` as the registry a new service must not
disturb. There is another: `_EXPECTED_FORCED_EMIT_SITES` in `test_256_judge_usage_counted.py`, and
every `forced_emit` call site must declare a token-accounting disposition in it.** Enrolled
`NO-RUN`, the same argument `skill_proposer_service.py` and `expert_authoring.py` carry — and that
argument is *driven*, not asserted: a companion case reads the source and fails if `run_usage_box`
appears. ⛔ **A full backend run is not optional here.** Both task-level verify commands, the
42-test targeted loop and all three gates were green while the suite sat 3 over the ceiling.

### ⚠ THE NORMALISATION TRAP FIRED, EXACTLY AS THE DISPATCH WARNED — AND MY FIRST FIX FOR IT ALSO FAILED

The dispatch said to truncate at the first `C:\` as well as stripping ` - <reason>`. I did write
`sed -E 's/C:\\.*$//'` **and it did not strip anything**, which produced a phantom matched pair —
the same test appearing once as new and once as gone, with and without a glued
`…unraisableexception.py:33: RuntimeWarning: coroutine 'handle_query_tables' was never awaited`.
Worse, **the warning attached to a DIFFERENT test in each run** (`test_071_1_threadpool_sweep` at
base, `test_retrieval_service` at head), so the artefact reads like two independent changes rather
than one formatting difference.

⛔ **The working normalisation is `sed 's/C:.*$//'` — truncate at `C:`, without trying to match the
backslash at all.** Recorded because "I applied the documented fix" was not the same as "the fix
worked", and only re-reading the output caught it.

---

## Deviations from Plan

### 1. [Rule 1 — Bug] The craft slice ends at the bullet run, not at the next `## ` heading

- **Found during:** Task 2, by printing the live extraction rather than trusting the fence.
- **Issue:** The plan's bound (action **(c)**) carried ~700 of 1466 live chars of interview
  choreography that the seven-token strip cannot see, and which **contradicts** the module's own
  framing about saving.
- **Fix:** `_doctrine_bullets_only`, driven RED first on both fences (commit 5), then GREEN
  (commit 6). Warranted by D-263-13's own wording — *"the five bullets under 'Apply this craft…'"*.
- **Also deviated, same area:** `_strip_tool_choreography` is sentence-granular rather than
  line-granular as action **(c)** specifies. **This is not a preference** — measured, a line-wise
  strip cannot satisfy the plan's own criterion that the live block keep all six doctrine tokens
  and drop all seven tool tokens, because one live line carries both.
- **Commits:** `794517218`, `84fa20013`

### 2. [Rule 3 — Blocking] Two test files edited that are absent from `files_modified`

- `backend/tests/unit/test_256_judge_usage_counted.py` — enrolment in a registry no 263 document
  names. Without it the suite sits over the ceiling.
- `backend/tests/unit/test_261_expert_authoring.py` — two mocked emissions predate the required
  field.
- ⚠ **Both are TEST files**, so `check-hot-file-ledger.cjs` exempts them and no row was owed. But
  the structural gap wave 1 passed forward still holds: **had either been a non-test source file,
  the gate would never have demanded a row**, because it audits the plan's *declared* surface and
  not the commit's *actual* diff.
- **Commit:** `0dd045200`

### 3. [Deliberate] The new ledger row went to `docs/HOT-FILE-LEDGER.md` only, not CLAUDE.md

Plan action **(m)** says *"Add the row to CLAUDE.md's scan table and its section to
docs/HOT-FILE-LEDGER.md"*. Measured: `check-hot-file-ledger.cjs:42` reads **only**
`docs/HOT-FILE-LEDGER.md`, and CLAUDE.md's table is explicitly *"G-5-FIRING files (113 of 224)"*.
A brand-new 1-phase file does not belong in a firing-only list, and the closest precedent —
`expert_authoring.py`, created by Phase 261 — lives in the detail file only. Putting it in CLAUDE.md
would have spent budget without making G-5 any more able to fire. **The gate is satisfied and the
same-commit sync rule is honoured.**

### 4. [Rule-scope boundary] `expert_authoring.py`'s ledger row was STALE and was re-derived

`1 / 1 / 233` → **`4 / 2 / 389`** — stale by 3 commits, a phase and 156 lines on a file two phases
old. Both registers updated in commit 2. Still below the G-5 threshold at 2 phases.

### 5. [Out of scope — logged, NOT fixed]

`backend/app/services/logging_sink.py:84` redacts any word containing `sk-` followed by 6+
characters, so `risk-register` logs as `risk-***REDACTED***`. Found in the Fence-1 RED drive's own
captured log (`skill=contract-risk-***REDACTED***`) and reproduced directly across five inputs.
Not a security defect — it errs safe — but a diagnostics one, and PACK-14 makes the drafter emit
exactly the kebab-case shapes that trip it. Full write-up, repro table and suggested one-line fix:
`deferred-items.md` in this phase directory.

---

## Provider-docs-first

⚠ **Honest limitation, stated rather than papered over:** neither the Context7 MCP tools nor the
`ctx7` CLI is available in this worktree (`command -v ctx7` → not found), and the guidance forbids
`npx --yes`. So the provider half was done against **this app's measured behaviour** instead of
vendor docs, which is the rule's second clause.

What that produced, and it is not nothing:

- **No new provider surface was added.** The shot goes through `forced_emit` → the Phase 092.5
  gateway. Provider-specific handling stays at the service boundary; the module touches no adapter.
- `_emit_tool` is **imported** from `skill_tuner_service`, not re-implemented, so `_flatten_nullable`
  (Google's `type: [...]` sanitizer trap + the minimax/moonshot strict validators) applies for free.
  ⚠ It is already duplicated in two modules; a third copy is how a provider fix lands in two of
  three homes.
- `AuthoredSkillBody` is flat and single-typed (`str`, `str`) — no union or Optional at property
  level, so there is no nullable for a sanitizer to drop.
- ⚠ **Measured, and worth a line:** the "Anthropic 400s on an empty system block" constraint this
  repo relies on exists **only as a comment** in `skill_proposer_service.py:77` and is enforced by
  nothing executable. This module makes it structural instead — the framing text is unconditional,
  so `_compose_system_prompt("")` is still non-empty, and the unit fence asserts it.

## UAT rows owed (unchanged — both belong to 263-04)

| # | Row | Status |
|---|---|---|
| U-03 | Cross-provider board for the NEW `emit_skill_body` call — FULL native roster + OpenRouter = **8 rows**, derived from `MODEL_CAPABILITIES` by grouping on `provider`, never re-typed | **OWED at 263-04**, where the route and UI exist |
| U-04 | FLAG-01 off ⇒ generation refuses, proposals still LIST, manual creation still works | **OWED at 263-04.** The unit case proves the refusal; only the UAT can prove that *only* generation was gated |

## Success criteria

| Criterion | Status |
|---|---|
| `suggested_new_skills` required, empty-able, fallback still constructs | ✅ |
| The drafter can no longer route an invented name into `member_skills` | ✅ hatch absent, asserted from source |
| Stubbing the read to empty leaves ZERO craft tokens; inlining one turns it RED | ✅ verbatim above, md5 identical |
| Extracted block carries doctrine and none of the seven tool tokens | ✅ measured on the LIVE row |
| FLAG-01 off refuses before any provider call; listing/manual untouched | ✅ unit; UAT owed at 263-04 |
| `_TOOL_REGISTRY` 29, `EMITTER_REGISTRY` 1, `PHASE_TYPE_REGISTRY_ENTRIES` 7 | ✅ unchanged at base and HEAD |
| New module carries a ledger row and section from its creating commit | ✅ `da237c53d` |
| Backend baseline ≤ 71, set-diffed both directions | ✅ 71 / 71, sets identical |
| No modification to STATE.md or ROADMAP.md | ✅ |

## Gates

| Gate | Result |
|---|---|
| `pytest tests/unit` | **71 failed / 5351 passed / 0 collection errors** — set identical to base |
| targeted 42-test expert loop | **42 passed** |
| `node scripts/check-hot-file-ledger.cjs 263` | exit 1, `watched: 10` — the **only** `[no-row]` is `ProposedSkillCard.tsx`, named by **263-04**. Zero findings on this plan's surface |
| `node scripts/check-claude-md-size.cjs` | **exit 0** — 114,454 chars, 76.3%, headroom 35,546; no `[disposition-too-long]` / `[duplicate-row]` / `[malformed-row]` |
| `node scripts/check-seeds-register.cjs --phase 263` | **gate OK** — 310/310 parsed |
| frontend vitest count gate | **N/A — not run and no number quoted.** This plan touches no frontend file |

## Self-Check

```
FOUND: backend/app/services/skill_body_authoring.py
FOUND: backend/tests/unit/test_263_craft_block_is_read.py
FOUND: backend/tests/integration/test_263_craft_block_live_read.py
FOUND: backend/tests/unit/test_263_expert_draft_suggested_skills.py
FOUND: .planning/phases/263-an-expert-can-be-given-its-capabilities/deferred-items.md
FOUND commit: dd4bec4fb  4f840aa96  e29dbddc8  da237c53d  794517218  84fa20013  0dd045200
```

## Self-Check: PASSED
