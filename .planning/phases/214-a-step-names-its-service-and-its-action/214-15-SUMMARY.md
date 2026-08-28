---
phase: 214-a-step-names-its-service-and-its-action
plan: 15
subsystem: project-governance
tags: [hot-file-ledger, vitest-count-gate, registers, threat-model, uat, phase-close]
status: checkpoint-reached
requires:
  - "214-01 .. 214-14, 214-16 — every prior plan of the phase, merged at bc1340772"
provides:
  - "the phase's single ledger commit: 38 rows re-derived, 25 added, 1 re-keyed, every row synced with its section"
  - "twelve BASELINE pins taken from the gate's own printed figures"
  - "seven registers written + SEED-217..223 for the seven findings that had none"
  - "the mitigation->test map for all sixteen threat models"
  - "214-UAT.md filled — 23 rows, every one 'not run'"
affects:
  - "the operator — one blocking G-4 drive is owed and nothing has been driven"
tech-stack:
  added: []
  patterns:
    - "row and section in ONE commit (same-commit sync rule)"
    - "existence-check every declared test path before running it"
    - "a finding with no register entry is a deletion that looks like a decision"
key-files:
  created:
    - .planning/seeds/SEED-217-an-upstream-argument-source-is-inert-on-native-capability-rows.md
    - .planning/seeds/SEED-218-the-refusals-connect-button-is-a-no-op-onopensettings-is-unwired.md
    - .planning/seeds/SEED-219-a-shipped-pause-vocabulary-with-no-consumer.md
    - .planning/seeds/SEED-220-the-lint-drift-detector-has-been-structurally-blind-since-phase-182.md
    - .planning/seeds/SEED-221-a-refusal-reaches-the-screen-as-a-machine-code.md
    - .planning/seeds/SEED-222-three-verification-blind-spots-measured-at-phase-214s-close.md
    - .planning/seeds/SEED-223-the-approval-receipt-records-the-approval-sentence-itself.md
  modified:
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - scripts/vitest-count-gate.cjs
    - .planning/phases/214-a-step-names-its-service-and-its-action/214-UAT.md
    - .planning/reported-bugs/BUG-260826-01-send-email-arguments-unreachable-from-every-launch-path.md
    - .planning/reported-bugs/BUG-260826-02-publish-gauntlet-does-not-validate-adapter-argument-satisfiability.md
    - .planning/reported-bugs/BUG-260826-05-run-failed-reason-empty-for-external-action-failure.md
    - .planning/reported-bugs/approval-pause-never-names-the-service.md
    - .planning/seeds/SEED-206-the-service-mark-belongs-on-every-step-surface-not-only-the-canvas.md
    - .planning/seeds/SEED-208-the-describe-door-hands-the-generator-its-connections-as-vocabulary.md
decisions:
  - "D-214-15-01: every touched ledger row was STALE — 38 of 38, not a sample. The batch re-derivation is the only thing that could have found that."
  - "D-214-15-02: no bug or seed gets verified_closed_by: 214. The drive has not happened, and a bug closed on a green gate is T-214-15-05."
  - "D-214-15-03: the seeds register was untouched by all sixteen prior plans, so seven findings had no re-open trigger. SEED-217..223 close that."
  - "D-214-15-04: five gate suites stay unpinned deliberately (none guards a file in the phase's diff) — recorded as SEED-222(c), not as a silence."
  - "D-214-15-05: T-214-03-01 and T-214-06-03 map as OPEN FINDINGS, not mitigations. A refuted fence and a partial one are not clean rows."
metrics:
  duration: ~1h
  completed: 2026-08-28
  tasks_completed: 1
  tasks_total: 2
---

# Phase 214 Plan 15: Phase close — the ledger, the gate, the registers, and a drive nobody has run

**The batch re-derivation found 38 of 38 touched hot-file rows stale and 25 files with no row at all
— and the phase's own seeds register had not been touched once in sixteen plans, so seven measured
findings were deferrals with no re-open. All of that is now written. Not one UAT row has been driven,
and every one of them says `not run`.**

---

## What was done

| # | Task | Status | Commit |
|---|---|---|---|
| 1 | The ledger, the gate pins, and the registers | ✅ done | `ad16bfc41`, `ed127dff9`, `26e5ffac2`, `cf3f70332` |
| 2 | G-4 — the lived-experience checks, driven | ⛔ **CHECKPOINT — awaiting the operator** | — |

⚠ **The worktree forked from the WRONG base and only the assertion caught it.** `git merge-base HEAD
bc13407727ad` returned **`f7cfa4a53d7a6006d89423e1c65e6f8f95a85c33`** — the same wrong base four
earlier worktrees in this phase hit. Reset to `bc1340772` before any file was read. Without the
assertion this plan would have re-derived a ledger against a tree missing eleven plans.

---

## 1 · The hot-file ledger — one batch pass, one commit (`ad16bfc41`)

### The headline

**38 of 38 touched rows were STALE. Not a sample — every single one.**

That is the strongest version of this ledger's own recurring finding. The 2026-08-17 audit found
*five* wrong out of thirty-one and called it a crisis; this pass found a **100 % staleness rate** on
the rows a single phase touched. **A figure written at a phase's close is stale by the next commit,
and this measurement is now unambiguous rather than suggestive.**

### The counts

| | before | after |
|---|---|---|
| rows in CLAUDE.md | 122 | **146** |
| sections in `docs/HOT-FILE-LEDGER.md` | 233 | **257** |
| rows with an unresolvable anchor | **5** | **0** |
| rows whose path no longer exists | **1** | **0** |
| disposition cells over 200 chars | 0 | **0** |
| CLAUDE.md size | 94,044 → **96,617 chars (64.4 % of limit)** | gate exit **0** |

Verified by `C:\Users\fhdmr\AppData\Local\Temp\claude\C--Vibe-Apps-Agentic-RAG\36976876-687a-4014-82ec-53bfeaa3bf9c\scratchpad\anchors.cjs`:
`rows=146 sections=257 unresolved=0 over200=0 pathGone=0`.

### Every changed cell, before → after

| file | ledger cell | **measured 2026-08-28** |
|---|---|---|
| `backend/app/api/threads.py` | 234 / 76 / 1273 | **238 / 78 / 1408** |
| `backend/app/api/workflow_runs.py` | 7 / 5 / 776 | **11 / 8 / 1003** |
| `backend/app/api/workflows.py` | 38 / 19 / 2143 | **41 / 21 / 2211** |
| `backend/app/db/workflows.py` | 43 / 21 / 2194 | **48 / 25 / 2585** |
| `backend/app/models/harness.py` | 17 / 16 / 611 | **20 / 19 / 766** |
| `backend/app/models/thread.py` | 14 / 9 / 319 | **16 / 10 / 438** |
| `backend/app/services/harness/grounding.py` | 19 / 6 / 1311 | **21 / 8 / 1414** |
| `backend/app/services/harness/phase_types.py` | 47 / 21 / 2664 | **50 / 23 / 2809** |
| `backend/app/services/harness/publish_service.py` | 22 / 9 / 1223 | **23 / 10 / 1567** |
| `backend/app/services/harness_engine.py` | 46 / 16 / 2567 | **54 / 20 / 3135** |
| `backend/app/services/workflow_authoring.py` | 13 / 7 / 625 | **14 / 8 / 881** |
| `frontend/src/components/chat/RunCard.tsx` | 21 / 9 / 608 | **22 / 10 / 661** |
| `frontend/src/components/layout/ChatLayout.tsx` | 40 / 21 / 815 | **41 / 22 / 911** |
| `frontend/src/components/panel/PendingAskCard.tsx` | 10 / 5 / 629 | **13 / 7 / 736** |
| `frontend/src/components/panel/PhaseCard.tsx` | 13 / 9 / 623 | **16 / 10 / 755** |
| `frontend/src/components/panel/PhaseTimeline.tsx` | 8 / 6 / 370 | **9 / 7 / 385** |
| `frontend/src/components/settings/ConnectionsTab.tsx` | 13 / 5 / 1414 | **17 / 7 / 1477** |
| `frontend/src/components/workflows/ConnectionPicker.tsx` | 5 / 3 / 651 | **7 / 5 / 888** |
| `frontend/src/components/workflows/ExternalActionSection.tsx` | 4 / 3 / 498 | **8 / 5 / 179** ⚠ net **−319 L** |
| `frontend/src/components/workflows/McpToolPicker.tsx` | 3 / 3 / 645 | **5 / 5 / 601** (net −44 L) |
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | 29 / 13 / 1561 | **30 / 14 / 1566** |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | 14 / 7 / 1025 | **16 / 8 / 1245** |
| `frontend/src/components/workflows/RunSpine.tsx` | 3 / 2 / 372 | **5 / 3 / 426** ⚠ now FIRES |
| `frontend/src/components/workflows/RunStepList.tsx` | 1 / 1 / 298 | **2 / 2 / 339** |
| `frontend/src/components/workflows/RunTranscript.tsx` | *no (2 phases)* | **7 / 3 / 652** ⚠ now FIRES |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | 27 / 8 / 1565 | **31 / 9 / 1708** |
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` | 13 / 9 / 575 | **18 / 12 / 1075** |
| `frontend/src/components/workflows/doorVocabulary.ts` | 4 / 3 / 341 | **6 / 4 / 540** |
| `frontend/src/components/workflows/library/RunModal.tsx` | 4 / 3 / 526 | **8 / 5 / 713** |
| `frontend/src/components/workflows/soulData.ts` | 9 / 7 / 373 | **11 / 9 / 465** |
| `frontend/src/components/workflows/useTemplateFirstDraft.ts` | 5 / 2 / 630 | **6 / 3 / 673** ⚠ now FIRES |
| `frontend/src/lib/api.ts` | 182 / 105 / 412 | **187 / 110 / 422** |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | 51 / 17 / 2867 | **55 / 20 / 2956** |
| `frontend/src/pages/WorkflowRunPage.tsx` | 25 / 8 / 1601 | **28 / 9 / 1670** |
| `frontend/src/pages/WorkflowsPage.tsx` | 41 / 16 / 1383 | **43 / 17 / 1415** |
| `frontend/src/providers/StreamsProvider.tsx` | 84 / 33 / 4119 | **85 / 34 / 4144** |
| `frontend/src/types/index.ts` | 70 / 56 / 1154 | **71 / 57 / 1203** |
| `scripts/vitest-count-gate.cjs` | 118 / 21 / 3909 | **124 / 24 / 4045** |

⚠ **Five plan-time figures the phase supplied were themselves already stale by execute time** —
`WorkflowBuilderPage.tsx` (`54 / 22 / 2937` → **55 / 20 / 2956**), `WorkflowCanvas.tsx`
(`31 / 9 / 1708`, held), `api/workflows.py` (`40 / 21 / 2192` → **41 / 21 / 2211**),
`api/workflow_runs.py` and `db/workflows.py`. **The plan brief's own instruction to re-derive rather
than trust it was correct, and it was correct about its own numbers.**

⚠ **`WorkflowBuilderPage.tsx`'s PHASE COUNT WENT DOWN, 22 → 20, while its commit count went UP.**
That is not an error: the plan-time figure counted two dated six-digit buckets as phases. The recipe
subtracts them. **A phase count that falls is a sign the recipe was applied, not that history changed.**

### The move: `connectionMark.tsx`

`214-08` moved it from `frontend/src/components/settings/` to `frontend/src/lib/`. **A row whose path
no longer exists is invisible to the audit scan**, so the row was **re-keyed, not edited**, and its
section moved with it in the same commit.

Re-derived with **`git log --follow`** — without it the file reads `1 / 1 / 313` and looks brand new:

```
4 / 2 / 217   (the stale cell)      ->   7 / 4 / 313   (--follow, buckets: 206.1 209 212 214)
```

`grep -c "components/settings/connectionMark" CLAUDE.md docs/HOT-FILE-LEDGER.md` → **0 and 0.**

### ⚠ A defect this pass found that nobody was looking for: five DEAD ANCHORS

`CLAUDE.md` links each row to `docs/HOT-FILE-LEDGER.md#<anchor>`. **Five of those anchors resolved to
nothing**, because their headings carried trailing prose (`### \`path\` — young (2 phases)`), which
GitHub slugs as `path--young-2-phases`:

`decisionsVocabulary.ts` · `DecisionsList.tsx` · `DraftArrivalCard.tsx` · `useTemplateFirstDraft.ts` ·
`RunTranscript.tsx`

⚠ **A row with a dead anchor is the same failure as a row with a dead path**: the auditor clicks
through to nothing and the section might as well not exist. The headings are normalised (the prose
moved to a blockquote directly beneath) and all 146 anchors now resolve.

### The 25 rows that did not exist

**Absences, not stale cells — and G-5 could never have fired on any of them at any count.**

| file | measured | verdict |
|---|---|---|
| `backend/app/models/user_settings.py` | **46 / 30 / 1352** | ⚠ **30 phases, invisible for its ENTIRE LIFE** |
| `backend/app/models/message.py` | 15 / 8 / 120 | ⚠ 8 phases; on every chat send |
| `backend/app/services/workflow_kickoff.py` | 8 / 6 / 554 | ⚠ 6 phases — **and `214-16` records this invisibility as the CAUSE of the unowned `ctx.inputs` mirror** |
| `frontend/src/components/workflows/nodePresentation.ts` | 8 / 7 / 221 | ⚠ 7 phases |
| `backend/app/services/harness/reachability.py` | 4 / 4 / 463 | ⚠ 4 phases — **the home of this phase's safety-gate predicate** |
| `frontend/src/lib/api/workflows.ts` | 3 / 3 / 1055 | ⚠ crossed the threshold with no row |
| `frontend/src/components/workflows/WorkflowScheduleModal.tsx` | 3 / 3 / 601 | ⚠ crossed it in `214-09`, on a launch-critical path |
| `frontend/src/lib/api/threads.ts` | 3 / 2 / 1600 | ⚠ **1600 L, no row, for its entire life** |
| `frontend/src/lib/api/knowledge.ts` | 2 / 2 / 775 | young |
| `frontend/src/lib/connectionMark.tsx` | 7 / 4 / 313 | the re-keyed row |
| + 15 young files this phase created | 1–2 phases each | rows added so the scan list stays complete |

⚠ **`lib/api.ts`'s row is the BARREL and does NOT cover `lib/api/*.ts`.** The 207 split moved the code
into twelve domain modules and left the guardrail behind on the re-export barrel. Three of the twelve
now have rows; **the other nine are still absent from the scan list** — recorded here rather than
fixed, since this phase touched only three.

### ⚠ Three obligations this phase does NOT discharge, recorded so `honoured` cannot read as `satisfied`

1. **`backend/app/api/workflows.py` — `extraction due` is still OWED.** `214-05` added the
   argument-satisfiability gate and explicitly declined the extraction. Third consecutive phase.
2. **`backend/app/services/harness/grounding.py` — `extraction still owed`.** 211 changed the
   connection's axis, 214 changed nothing beyond what the argument leaf required.
3. **`ExternalActionSection.tsx` / `ConnectionPicker.tsx` — their named seams are untaken.**
   ⚠ `ConnectionPicker.tsx` is **the honest outlier of the phase**: `+186 L`, the largest single
   growth 214 put on a G-5-firing file, on a file whose seam has been named since 206.2.

⚠ **`WorkflowsPage.tsx`'s cell said `satisfied` and no longer does.** That is the exact word
`StreamsProvider.tsx`'s row carried when it turned out to be wrong by 28 phases. It now says the
extraction is **taken**, which is a historical fact, rather than **satisfied**, which is a standing
claim nothing renews.

---

## 2 · The gate (`ed127dff9`)

### The verdict line, verbatim, before pinning

```
  total                                      5266    6355   +1089
  total 6355  ·  failed 0  ·  pinned total 5266
count gate OK — 120/120 pinned files present, no per-file decrease, 0 failing.
```

**Exactly reproduces the orchestrator's authoritative figures at this base.**

### The verdict line, verbatim, after pinning

```
  total                                      5565    6355    +790
  total 6355  ·  failed 0  ·  pinned total 5565
count gate OK — 132/132 pinned files present, no per-file decrease, 0 failing.
```

**The arithmetic closes with no residual:** pinned `5266 → 5565` = **`+299`**, which is exactly
`33+20+15+22+23+9+26+44+15+41+34+17`. The grand total is **unchanged at 6355** — pinning changes what
is guarded, never what runs. Pinned files `120 → 132`.

### The twelve pins — every figure the gate's OWN printed `— N new`

`ArgumentEditor.test.tsx` 33 · `DescribeServicePicker.test.tsx` 20 · `LaunchInputFields.test.tsx` 15 ·
`PublishRefusalList.test.tsx` 22 · `StepIdentity.coverage.test.tsx` 23 ·
`WorkflowScheduleModal.test.tsx` 9 · `argumentModel.test.ts` 26 · `argumentVocabulary.test.ts` 44 ·
`describeServiceMatch.test.ts` 15 · `publishRefusalVocabulary.test.ts` 41 ·
`stepIdentityVocabulary.test.ts` 34 · **`RunStepList.test.tsx` 17 (adopted)**.

⚠ **`StepIdentity.test.tsx` needed no pin — it was already at 41 and actual 41.** The brief listed it
as owed; measurement says `214-08` already did it.

### ⚠ THE TARGETS/BASELINE CHECK REFUTED THE PLAN'S OWN BELIEF

The plan recorded `WorkflowScheduleModal.test.tsx` as being **in NEITHER knob**. Measured: the gate
was **already running it** — the `src/components/workflows` entry in `TARGETS` is a **DIRECTORY**
entry and recurses into `__tests__/`. So it was **executed and guarded by nothing**, which is the
worse of the two halves: a green gate read as covering a launch-critical launch door. No `TARGETS`
edit was needed; the pin is the whole fix.

The two suites the plan said needed no `TARGETS` edit were confirmed: `214-16` extends the already-
pinned `src/lib/apiRunFields.fences.test.ts` (a **file** entry), and `214-07`'s reachability case
lives inside `ArgumentEditor.test.tsx` (a **directory** entry).

⛔ **Backend suites are not and cannot be gate-pinned** — the gate is vitest-only.
`test_214_launch_inputs_wire.py` and `test_214_argument_seams.py` are guarded by their plans' pytest
criteria and by the failure-count baseline. **Recorded as a decision so nobody later reads the gate's
green as covering them.**

### The in-scope suites, run EXPLICITLY by path

⚠ **Every path was existence-checked FIRST** (`count=36 missing_flag=0`), because `214-14` measured
that `npx vitest run` **exits 0** when a non-existent path is named alongside real ones — so a
verification citing an absent path has run zero of the cases it believes it ran (`SEED-222(a)`).

**36 files · 1640 cases · `failed 0`.** Every per-file count matches the gate's own column exactly.
Selected: `PublishGauntlet` 78 · `WorkflowDoorSwitch` 81 · `WorkflowRunPage` 173 ·
`WorkflowBuilderPage.canvas` 154 · `ChatLayout.launch` 35 · `ConnectionFormPanel` 157 ·
`connectionMark` 74 · `doorVocabulary` 60 · `WorkflowsPage` 59 · `RunModal` 54 · `PhaseCard` 55.
**No per-file decrease anywhere in the gate's 120-row delta table.**

### ⚠ `0 failing` is recorded as an OBSERVATION, triaged — not as a bald pass

`SEED-171` names five suites that flake independent of the worker cap. **Three of them sit inside
this phase's blast radius and were EDITED by it**: `WorkflowsPage.test.tsx` (59),
`WorkflowBuilderPage.canvas.test.tsx` (154), `WorkflowRunPage.test.tsx` (173). All three were green
on **every** invocation — the two full gate runs and the explicit by-path run.

⚠ **That is an observation, never proof of innocence.** One green sample of a flaky suite proves
nothing. **The cap was never touched**, per CLAUDE.md's correction (b): adjusting it is measured NOT
to fix these. SEED-171's triage procedure was never entered because nothing went red.

---

## 3 · The other verification gates

| gate | baseline | **measured** | verdict |
|---|---|---|---|
| `backend/tests/unit` (venv pytest) | ≤ 68 failed | **68 failed / 3055 passed / 2 xfailed / 2 xpassed** | ✅ exactly the recorded rot baseline |
| `npx tsc --noEmit -p tsconfig.app.json` | ≤ 34 errors | **34** | ✅ unmoved |
| `bash scripts/check-deploy-drift.sh` | exit 0 | **`RESULT: PASS`, exit 0** | ✅ unaffected (2 pre-existing non-blocking WARNs) |
| `node scripts/check-claude-md-size.cjs` | exit 0 | **96,617 chars · 64.4 % · exit 0** | ✅ zero `[disposition-too-long]` |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` | — | **132/132, 0 failing, 6355 / 5565** | ✅ |

---

## 4 · The mitigation→test map — all sixteen threat models

**102 threat rows across sixteen registers.** This map exists because **Phase 203 wrote three
mitigations, implemented none, and every task passed.** A mitigation with no test row is an open
finding, not a mitigation.

| bucket | count | how it is evidenced |
|---|---|---|
| cited **by id inside a test file** (strongest — `file:line` grep-provable) | **23** | the test names the threat id in a comment or case title |
| carries a **per-row verdict table in its plan's SUMMARY** | **57** | the executing plan tabulated it against a named assertion |
| **mapped manually here** (the plan's SUMMARY carried no per-row table) | **22** | located and verified below |
| — of which **OPEN FINDINGS**, not mitigations | **2** | `T-214-03-01` (refuted) · `T-214-06-03` (partial) |

### The 22 rows plans `214-08`, `214-11`, `214-14` and this plan left untabulated

⚠ **Three plans shipped a threat model with no per-row verdict table in their SUMMARY.** That is the
Phase 203 gap in miniature — the mitigations were implemented, but nothing in the paperwork said so,
which is indistinguishable from not having done them. Each was located and verified:

| Threat ID | evidence |
|---|---|
| T-214-08-01 | `frontend/src/components/workflows/StepIdentity.coverage.test.tsx:404` — the ClickUp case takes the NEUTRAL mark |
| T-214-08-02 | `StepIdentity.test.tsx:423` / `:426` — `dangerouslySetInnerHTML` absent from source |
| T-214-08-03 | `StepIdentity.test.tsx:389` — `container.innerHTML` carries no wire id |
| T-214-08-04 | `StepIdentity.coverage.test.tsx:397` / `:421` — resolved-but-invisible; `svg.innerHTML` length > 0 |
| T-214-08-05 | `StepIdentity.test.tsx:246`–`:254` — `service: null` renders the action alone; `Unknown service` greps to 0 |
| T-214-08-SC | **measured**: `git diff --name-only bd495af0f HEAD -- frontend/package.json frontend/package-lock.json backend/requirements.txt` is **EMPTY across the whole phase** |
| T-214-11-01 | `frontend/src/components/panel/PhaseCard.test.tsx:955` (id cited in-code) |
| T-214-11-02 | `PhaseCard.test.tsx:833` / `:850` / `:856` — both arms; whitespace-only is not a reason |
| T-214-11-03 | `StepIdentity.coverage.test.tsx:322` / `:335` / `:350` / `:363` — `assertNoWireIds` per surface |
| T-214-11-04 | `PhaseTimeline.test.tsx:1099` · `StepIdentity.coverage.test.tsx:285` · `PendingAskCard.retired.baseline.test.tsx:198` |
| T-214-11-05 | `StepIdentity.coverage.test.tsx:404` + `PhaseCard.test.tsx:942`–`:944` |
| T-214-11-06 | ⚠ *accept, unchanged* — **and its premise is contradicted by `T-214-06-03`**; see below |
| T-214-11-SC / T-214-14-SC | same empty-package-diff measurement as `T-214-08-SC` |
| T-214-14-01 | `backend/tests/unit/test_214_flag_cold_default.py:86` (canvas `everyone`) + `:137` `:149` `:155` (`live_connectors` **off**) |
| T-214-14-02 | `test_214_flag_cold_default.py:232` — `test_no_case_in_this_file_seeds_the_flag`, plus the `unseeded_settings` fixture |
| T-214-14-03 | `backend/tests/integration/test_214_argument_seams.py:114` — `test_S0_no_case_patches_a_function_under_test` |
| T-214-14-04 | *accept, NAMED* — `check-deploy-drift.sh` cannot see `feature_visibility`; the parity is asserted instead at `test_214_flag_cold_default.py:187` with a positive control at `:212` |
| T-214-14-05 | `test_214_argument_seams.py:1124` — named for the threat: `test_T_214_14_05_a_full_seed_and_teardown_cycle_leaves_no_rows_behind` |
| T-214-15-01 | **this map** |
| T-214-15-02 | the batch re-derivation — 38/38 stale, table above |
| T-214-15-03 | 25 rows added; `rows=146 sections=257 unresolved=0 pathGone=0` |
| T-214-15-04 | `check-claude-md-size.cjs` exit 0, **zero** `[disposition-too-long]`, 96,617 chars |
| T-214-15-05 | **grep-proved**: no frontmatter line anywhere sets `verified_closed_by: 214` |
| T-214-15-06 | `214-UAT.md` — 23 rows, 0 unfilled, every one `not run` |

### ⛔ The two rows that are OPEN FINDINGS, not mitigations

**`T-214-03-01` is REFUTED AS WRITTEN.** It asked for `dangerouslySetInnerHTML` to appear **zero**
times under `src/components/workflows`. Driven literally it returns **eight** — every one a docblock
saying *"NEVER use it"*. **That is the 187-24 trap: a criterion that greps raw text COUNTS ITS OWN
PROSE**, and it fired at least seven times across this phase. The shipped fence anchors on the `=` of
the prop assignment (`doorVocabulary.test.ts:688`). **The corrected wording is recorded; the original
is not repeated as though it held.**

**`T-214-06-03` is PARTIAL.** `_resolve_failure_with_ask_user`'s governance receipt writes
`metadata["finding"] = error_message`, and for an ARMED checkpoint that string is the entire approval
sentence. **D-213-14's *"shown once, recorded never"* holds for `_write_send_receipt` and FAILS for
the approval receipt.** Pre-existing since Phase 187 — **but this phase WIDENED its content to
launcher-supplied and LLM-produced text.** It is bounded and pinned, **not closed**, and it needs an
operator decision → **`SEED-223`**.

⚠ **`T-214-11-06` inherits that contradiction.** It reads *accept, unchanged — D-213-14 stands*, and
`T-214-06-03` measured that D-213-14 does **not** stand on one of its two receipts. Recorded so the
two rows are not read as agreeing.

---

## 5 · The registers (`26e5ffac2`)

### ⚠ The finding that made this section necessary

```
git diff --name-only bd495af0f HEAD -- .planning/seeds .planning/reported-bugs
(empty)
```

**Not one register file was touched by any of the sixteen prior plans.** So every finding this phase
surfaced and deliberately did not fix was a deferral **with no re-open trigger** — which, as CLAUDE.md
puts it, is *a deletion that looks like a decision*. And nothing executable reads these registers:
`grep -rln "SEED" .claude/commands/gsd/` returns `capture.md` only, **the writer**.

### What was written

| record | `status` | `folded_into` | `verified_closed_by` | why |
|---|---|---|---|---|
| `BUG-260826-01` | `folded` | `214` | **`null`** | needs **G4-3 on all three doors**. Both halves shipped (`214-09`/`214-12` forms, `214-16` wire) — two of three would still be `folded`, with the un-driven door named |
| `BUG-260826-02` | `folded` | `214` | **`null`** | needs **G4-4** — a lint that fires correctly and refuses illegibly is still this bug |
| `BUG-260826-05` | `folded` | `214` | **`null`** | needs **G4-5 against a RELOADED run** — the defect is on the reconcile path |
| `BUG-260828-01` | `folded` | `214` | **`null`** | needs **G4-6** — service named + all three arguments, on both shapes |
| `SEED-206` | `folded` | `214` | — | five surfaces shipped; **the ClickUp hole is closed by REFUSAL, not by an icon** |
| `SEED-208` | `folded` | `214` | — | shipped by `214-13`; ⚠ **two defects on its own surface** (`SEED-221`, `SEED-218`) |
| `BUG-260815-06` | **`open`** | **`null`** | `null` | ✅ **verified INTACT — `git diff` is EMPTY.** D-214-13's second decline preserved verbatim |
| `BUG-260823-04` | `open` | `null` | — | reviewed-not-folded; untouched |
| `SEED-214` | `partially-folded` · `SEED-199` `planted` | — | — | untouched, as required |

`grep -c "folded_into: 214"` → **6 files**, meeting the ≥ 6 criterion.

⛔ **NOTHING got `verified_closed_by: 214`.** `T-214-15-05` names the failure directly: *a bug closed
on a green gate rather than a drive.* Phase 212 did exactly that and the operator then found two more
defects, one nobody had thought to look for.

### The seven findings that had no register at all — `SEED-217` … `SEED-223`

| seed | finding | severity |
|---|---|---|
| **SEED-217** | an `upstream` argument source is **INERT on native capability rows** — `subject` sourced `upstream(draft)` is silently DROPPED, `body` falls back to the *latest* phase. ⚠ **directly threatens SC#2** | major |
| **SEED-218** | `onOpenSettings` is **UNWIRED** — the describe refusal's *connect* button is a no-op | major |
| **SEED-219** | `stepIdentityVocabulary`'s six PAUSE sentences are consumed by **nothing** (`ASK_PAUSED` count 0); `PendingAskCard` still says `Needs you` | minor |
| **SEED-220** | `test_182`'s lint-drift detector has been **structurally blind since Phase 182** — it matches only a string-literal first arg to `LintError(` | major |
| **SEED-221** | the describe refusal reaches a real screen as a **MACHINE CODE** — *"Couldn't generate — `connection_not_allowed`"* | major |
| **SEED-222** | three verification blind spots: (a) vitest exits 0 on a named-but-absent path; (b) a baseline scoped to `backend/tests/unit` cannot see a global-default change — the flip inverted **18 assertions across seven suites, none of them there**; (c) five gate suites run and guard nothing | major |
| **SEED-223** | the approval receipt records the approval sentence verbatim (`T-214-06-03`) — an operator decision, three named options | major |

**Each carries a concrete `re_open_trigger` AND a mechanical check** that the gap is still real, so
the next sweep can verify rather than re-litigate.

⚠ **`SEED-218` and `SEED-221` are the SAME failure mode twice in one phase**: a cross-plan seam where
one plan owns the code, another owns the page, and **neither owns the join**. Both sides green. That
is verbatim the shape the 204 pre-flight recorded and the one this phase's own seam audit was built
to catch — **it caught them, at the close, after the merge.**

---

## 6 · The UAT scoreboard (`cf3f70332`) — ⛔ nothing driven

**All 23 rows read `not run`**: the eight-provider roster, the three axis rows, the eight G-4 checks.
The plan's own automated check passes with **0 unfilled**.

⚠ **`not run` is deliberately NOT `⛔ blocked`.** Blocked means *attempted and refused*, with a named
reason and a blocking id. **Nothing here was attempted.** Writing `blocked` would have been a second
kind of lie.

A §5 was added naming **which row to run first and why** — `G4-3`, because it alone decides whether
**SC#2 is met**, and the flag state every row must declare.

---

## Deviations from Plan

### `[Rule 2 — missing critical functionality]` Seven new seed files, not in `files_modified`

The plan's `files_modified` names ten register files and none of them is new. But CLAUDE.md's seeds
rule is **MANDATORY**, the register was measurably untouched by all sixteen plans, and the objective
required *"an OPEN FINDING recorded in the summary, not quietly dropped."* **A finding recorded only
in a SUMMARY is invisible to every sweep** — `status:` frontmatter IS the index. Written as
`SEED-217`…`SEED-223`.

### `[Rule 1 — bug]` Five dead anchors in the ledger, repaired

Not in scope as written; found by the row↔section audit the plan mandates. A row whose anchor does not
resolve is as invisible as one whose path does not exist, so leaving them would have shipped a ledger
that passes its own count check and fails a reader.

### `[Rule 2]` `RunStepList.test.tsx` adopted into `BASELINE`

`RunStepList.tsx` **is** in this phase's diff (`214-11` mounted the shared identity in it) and its only
suite was unpinned — executed by the directory entry, guarded by nothing. The other five unpinned
suites guard no file in the phase's diff and were **deliberately not** adopted (`SEED-222(c)`).

### `[base correction]` The worktree forked from `f7cfa4a53`, not `bc1340772`

Corrected by `git reset --hard` inside the branch-check step, before any file was read.

---

## Known Stubs

None. This plan writes no application source.

## Threat Flags

None. No new network endpoint, auth path, file access or schema surface. ⚠ **`SEED-223` records a
pre-existing information-disclosure surface this phase WIDENED** — it is a register entry and an
operator decision, not a flag raised by this plan's own diff.

---

## Self-Check: PASSED

**Files created — all 7 present:**
`SEED-217` ✓ `SEED-218` ✓ `SEED-219` ✓ `SEED-220` ✓ `SEED-221` ✓ `SEED-222` ✓ `SEED-223` ✓

**Commits — all 4 present in `git log`:**
`ad16bfc41` ✓ (ledger) · `ed127dff9` ✓ (gate) · `26e5ffac2` ✓ (registers) · `cf3f70332` ✓ (UAT)

**Every claim re-run at write time:**
`check-claude-md-size.cjs` exit 0 · `anchors.cjs` `146/257/0/0/0` ·
`count gate OK — 132/132` · pytest `68 failed` · `tsc` `34` · deploy-drift `PASS` ·
UAT `23 rows, 0 unfilled` · `verified_closed_by: 214` set **nowhere**.

---

## ⛔ CHECKPOINT — Task 2 is `gate="blocking"` and belongs to the operator

**Every automated gate in this plan is green, and per this plan's own `<how_wed_know_this_failed>`
they are evidence of NON-REGRESSION, not evidence of ARRIVAL.** Phase 213 closed once at `93fc2f521`
with every gate green and its headline feature inert; the post-flight refused it and a driven check
found it.

**This phase cannot be closed as *verified* on this SUMMARY.** It can be closed as a **recorded
DECISION** naming the owed rows — which `214-UAT.md` §5 now does, in order, with G4-3 first.
