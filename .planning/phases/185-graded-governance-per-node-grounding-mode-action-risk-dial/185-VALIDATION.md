---
phase: 185
slug: graded-governance-per-node-grounding-mode-action-risk-dial
status: awaiting-operator-gate
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-29
updated: 2026-07-31
---

> **`nyquist_compliant: false` is a DELIBERATE reading, not an unfilled default.** Thirty-three of the
> thirty-four tasks in the map below carry an `<automated>` command, and no three consecutive tasks
> lack one — the sampling architecture is sound. The one that does not is **11-3**, the blocking
> `checkpoint:human-verify`, and it is the task that owns criterion **17** (a colour-stripped render
> — jsdom computes no paint) and criterion **22** (the cross-provider scoreboard — needs four live
> providers), plus the visual half of criterion **16** and the D-185-18 screenshot diff. Those four
> have no automatable proof and never will. **Flip this to `true` when 11-3's rows are recorded** —
> at that point every task carries either an automated verify or a recorded operator result. Setting
> it `true` before the operator has driven a single row would be the false-completion pattern this
> project has flagged twice.

# Phase 185 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `185-RESEARCH.md` §"Validation Architecture" and `185-SPEC.md`'s 23 acceptance criteria
> (24 with the Req 8 amendment). **SC#10 rows and the G-4 lived-experience scenarios are authored HERE,
> never in PLAN.md tasks** (CLAUDE.md §"UAT scoreboard recipe").

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | pytest — `backend/tests/unit/`, run from the `venv` |
| **Framework (frontend)** | vitest 4 + @testing-library/react |
| **Config file** | `frontend/vitest.config.*`; backend `backend/pytest.ini` / `pyproject` |
| **Quick run (backend)** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_validator_kinds.py tests/unit/test_harness_models.py tests/unit/test_ask_user_disposition.py -x -q` |
| **Quick run (frontend)** | `cd frontend && npx vitest run src/components/workflows` |
| **Full suite + count gate** | `node scripts/vitest-count-gate.cjs` **(mandatory — see Wave 0)** |
| **Typecheck** | `cd frontend && npx tsc -b` — **`-b`, not `--noEmit`** (the v3.3 lesson) |
| **Estimated runtime** | quick ~25 s · full ~180 s |

---

## Sampling Rate

- **After every task commit:** the quick run for the half being touched (backend pytest subset **or** the
  frontend workflows subset) + `npx tsc -b`
- **After every plan wave:** `node scripts/vitest-count-gate.cjs` + `cd backend && venv/Scripts/python -m pytest tests/unit -q`
- **Before `/gsd:verify-work`:** both full suites green **AND** the 4 G-4 scenarios **AND** the SC#10 scoreboard
- **Max feedback latency:** 30 s

---

## Acceptance Criteria → Cheapest Honest Proof

The SPEC's 23 criteria plus the Req 8 amendment. `PLAN`/`TASK` columns are filled after planning.

| # | Acceptance criterion | Proof type | Where |
|---|---|---|---|
| 1 | Pre-185 JSONB row `model_validate()`s with neither new key | pytest | `test_harness_models.py` |
| 2 | ~~`git diff -- supabase/migrations` is 0 lines; live head still 113~~ **AMENDED 2026-07-31** → `git diff -- supabase/migrations` is **exactly one file** (`114_harness_audit_action_risk_pending.sql`, +1 CHECK literal, no other schema object); live head **114**. Superseded wording preserved, not deleted. **Reason: the zero-migration promise was a scoping convenience; the honest-pause vocabulary is a correctness property, and the alternative knowingly ships the defect the phase existed to fix** (BUG-260731-02 — an armed checkpoint kills the run; operator decision, plan `185-13`) | grep/CI step + operator-applied migration | plan `185-13` Task 1 (author) + Task 3 (operator applies) |
| 3 | Grounding field round-trips `toCanvas`→`fromCanvas`, reference identity preserved | vitest | `canvasModel.roundtrip.test.ts` (`toBe`) |
| 4 | Each of the 5 `KB_TOOLS`, in isolation, detects ⇒ cause `detected` | pytest ×5 parametrized | new `test_185_detection.py` |
| 5 | `llm_agent` w/ only non-KB tools = free · `llm_single` never auto-locks · `llm_emit` strict ⇒ `already-set` | pytest | `test_185_detection.py` |
| 6 | `folder_scope` alone never triggers detection | pytest | `test_185_detection.py` |
| 7 | Hand-escalated step + KB tool ⇒ cause flips `escalated`→`detected`, undo disappears | pytest + vitest | `test_185_detection.py` + DOM absence test |
| 8 | No code path sets a `detected` step back to *free to think* | grep/source-guard | `canvasModel.purity.test.ts` idiom — true by construction (D-185-07) |
| 9 | Published definition + KB tool + **no** declared validator ⇒ run fails on uncited output | pytest (engine) | new `test_185_engine_attachment.py` |
| 10 | Deleting the validator from JSONB does not remove enforcement | pytest | `test_185_engine_attachment.py`, `validators: []` fixture |
| 11 | Deep chat path byte-identical (D-14) | git-diff fence + suite | `git diff --stat` over the Deep path = 0 lines |
| 12 | Refused dial press renders the reason as text-queryable DOM; `getByTitle` finds none | vitest | new `GovernanceSection.test.tsx` |
| 13 | A step type where grounding cannot apply renders **no** dial (null, not disabled) | vitest | `GovernanceSection.test.tsx` |
| 14 | 0 occurrences of the 3 retired badge strings in the workflow tree | grep assertion | plan verification step |
| 15 | 0 for each banned term in user-visible strings; ≥1 for each required term | grep assertion (word-anchored) | plan verification step |
| 16 | Corner seal renders identically across idle / running / needs-you / failed | vitest props-fence **+ operator UAT** | seal markup must not read `status`; visual claim is UAT-only (G-4 #2) |
| 17 | A colour-stripped render still distinguishes grounded from open | **operator UAT only** | jsdom has no computed paint |
| 18 | Arming leaves `len(phases)==5`, every `phase_index` unchanged, canvas renders 5 nodes | pytest + vitest | `effective_phase` adds no phase; `toCanvas` node count |
| 19 | Checkpoint **set** + `subscribe_for_response`→`None` ⇒ run does NOT advance | pytest | `test_ask_user_disposition.py` sibling |
| 20 | Checkpoint **unset** ⇒ `_exec_llm_human_input` byte-identical | pytest + git diff | existing suite passes unchanged; 0 diff lines in the executor body |
| 21 | `PhaseFormPanel.tsx` grows by a mount point only | git-diff assertion | `git diff --stat` ≤ ~4 lines; section is its own file |
| 22 | SC#10 covers 4 providers + multi-tool + parallel-thread + long-message | cross-provider UAT | the scoreboard below |
| 23 | Verdict mark at the card's LEFT; zone check over {icon, verdict, seal, stepNumber, run-state} = 0 overlaps | vitest geometry test | **requires the Wave-1 137-B rebuild (D-185-17)** — cannot pass on shipped 137-D |
| 24 | Armed mark has no `role="button"` / `tabIndex` / click handler; exactly ONE tab stop per node | vitest | extend `WorkflowCanvas.test.tsx:231-238` |

---

## Count-gate posture — READ BEFORE ASSERTING `exits 0`

**`node scripts/vitest-count-gate.cjs` CANNOT exit 0 in this phase, and that is not this phase's fault.**
Measured at `59c32a06` (phase start, before any 185 commit) and re-measured after plan `185-01`:

| Run | total | failed | pinned-file count violations |
|---|---|---|---|
| pre-185 baseline (`59c32a06`, measured by the 185-01 executor) | 1497 | **34** | none |
| after `185-01` | 1504 | **35** | none |
| orchestrator re-run, same tree | 1504 | **40** | none |

The gate fails on `[failing-tests] N > 0`. Those failures are **pre-existing suite rot (SEED-056)** and
they **churn between runs (34 → 35 → 40 on an unchanged tree)** — they are flaky, not deterministic.
Failing files at the 40-failure reading: `PublishGauntlet` (10), `WorkflowBuilderPage.canvas` (6),
`WorkflowBuilderPage` (5), `WorkflowCanvas.composition` (5), `WorkflowCanvas` (4),
`WorkflowBuilderPage.header` (3), `PhaseSpineGraph` (2), `StepTypePicker` (2),
`WorkflowCanvas.editing` (2), `revertByteIdentical` (1).

**The half that matters for this phase is intact.** Every one of the 16 pinned files reports delta ≥ 0.
The gate's real job here — catching the `it()` blocks that vanish when `185-08` deletes `groundingFor()`
(`phaseVocabulary.test.ts`, pinned 42) — works exactly as designed. `[count-decrease]` is live.

### The rule every plan in this phase uses instead of `exits 0`

A count-gate check PASSES when **all** of these hold:

1. No `[count-decrease]` — no pinned file reports fewer tests than its pin. **This is the load-bearing one.**
2. No `[total-below-baseline]` and no `[missing-file]`.
3. **No NEW failing test in any file the plan touched.** Compare against the table above. Churn in a file
   the plan never opened is pre-existing rot — record it, do not chase it.
4. Where a plan deliberately re-pins a count (`185-08` only), the `BASELINE` edit lands in the **same
   commit** as the deletion, with the number **read from the gate's own output**, never guessed.

`[failing-tests]` alone is a KNOWN, RECORDED block. Do not fix the 40 rotted tests inside this phase — it
is unscoped, unrelated to GOVERN-01/02/03, and the churn makes it a moving target.

**Deferred:** re-pin the three stale positive pins the gate reports (`canvasModel.purity.test.ts` 69 → 79,
`WorkflowCanvas.test.tsx` 31 → 33, `WorkflowBuilderPage.canvas.test.tsx` 22 → 72) and triage the 40 rotted
tests. **Re-open trigger:** the next phase that touches the frontend workflow suite, or the moment a
`[count-decrease]` is ever masked by the noise. Tracked against SEED-056.

---

## Per-Task Verification Map

Thirty-four tasks across twelve plans. Filled by plan `185-11` Task 2 once every wave had landed —
the criterion column is derived from the "Where" column of the criteria table above cross-read
against each plan's task names and `must_haves`, not lifted from planner output. `G-4 #n` and
`D-185-18` name the manual rows in §"Manual-Only Verifications"; those tasks are green on their
automated half and their lived-experience half belongs to 11-3.

> **Amended 2026-07-31 — Wave 7 (`185-12`) postdates this map's first filling.** The map was written
> by `185-11` Task 2 on 2026-07-30, when the phase was eleven plans. `185-12` is a **gap-closure**
> plan that exists because the operator gate itself found a blocker: **BUG-260730-01** — the
> auto-attached `retrieved_and_cited` gate demanded inline `[1]` / `(doc-N)` markers that nothing in
> the step prompt, the attachment seam, or the retry feedback ever instructed the model to write, so
> a detected grounded step that retrieved *correctly* still burned all three attempts
> (`workflow_runs.id = ded89703-44c4-4e40-b5fe-9af35a44a54d`). Its three tasks are appended below.
> Leaving them out would make this file understate what shipped.

| Task ID | Plan | Wave | Requirement | Criterion | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-----------|-------------------|--------|
| 01-1 | 185-01 | 1 | GOVERN-02 | 23 | vitest (geometry) | `cd frontend && npx vitest run src/components/workflows/PhaseNodeCard.test.tsx src/components/workflows/WorkflowCanvas.test.tsx` | ✅ |
| 01-2 | 185-01 | 1 | GOVERN-02 | 23 | vitest (zone overlap + layout table) | `cd frontend && npx vitest run src/components/workflows && cd .. && node scripts/vitest-count-gate.cjs` | ✅ |
| 02-1 | 185-02 | 1 | GOVERN-01, GOVERN-03 | 1 | pytest (model) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_harness_models.py -x -q` | ✅ |
| 02-2 | 185-02 | 1 | GOVERN-01 | 4, 5, 6, 7, 8 | pytest + source guard | `cd backend && venv/Scripts/python -m pytest tests/unit/test_185_detection.py -x -q` | ✅ |
| 02-3 | 185-02 | 1 | GOVERN-01 | 4 (server-supplied KB list) | pytest (route) | `cd backend && venv/Scripts/python -m pytest tests/unit -q -k "grounding or 185 or workflows"` | ✅ |
| 03-1 | 185-03 | 2 | GOVERN-01, GOVERN-03 | 9, 10 | pytest (validator kinds) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_validator_kinds.py -x -q` | ✅ |
| 03-2 | 185-03 | 2 | GOVERN-01 | 18 (adds no phase) | pytest | `cd backend && venv/Scripts/python -m pytest tests/unit/test_185_detection.py tests/unit/test_validator_kinds.py -x -q` | ✅ |
| 03-3 | 185-03 | 2 | GOVERN-01 | 9, 10 | pytest (engine seam, index-0 pin) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py -x -q` | ✅ |
| 04-1 | 185-04 | 3 | GOVERN-03 | 19 | pytest | `cd backend && venv/Scripts/python -m pytest tests/unit -q -k "ask_user"` | ✅ |
| 04-2 | 185-04 | 3 | GOVERN-03 | 19 (fail-open fix) | pytest | `cd backend && venv/Scripts/python -m pytest tests/unit/test_ask_user_disposition.py -x -q` | ✅ |
| 04-3 | 185-04 | 3 | GOVERN-03 | 19, 20 | pytest | `cd backend && venv/Scripts/python -m pytest tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py -x -q` | ✅ |
| 05-1 | 185-05 | 4 | GOVERN-03 | 19 · G-4 #3 | pytest (event fence) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py -x -q` | ✅ |
| 05-2 | 185-05 | 4 | GOVERN-03 | G-4 #3 | pytest (resume sweep) | `cd backend && venv/Scripts/python -m pytest tests/unit -q -k "185 or ask_user or resume"` | ✅ |
| 05-3 | 185-05 | 4 | GOVERN-03 | G-4 #3 | vitest (no-deadline card) | `cd frontend && npx vitest run src/components/panel/__tests__/PendingAskCard.test.tsx` | ✅ |
| 06-1 | 185-06 | 2 | GOVERN-01 | 4 (client half) | vitest + tsc | `cd frontend && npx vitest run src/hooks && npx tsc -b` | ✅ |
| 06-2 | 185-06 | 2 | GOVERN-01, GOVERN-03 | 3 | vitest (round-trip `toBe`) | `cd frontend && npx vitest run src/components/workflows/definitionOps.test.ts src/components/workflows/canvasModel.roundtrip.test.ts` | ✅ |
| 06-3 | 185-06 | 2 | GOVERN-01, GOVERN-03 | 3 (write seam) | vitest + tsc | `cd frontend && npx vitest run src/stores src/components/workflows/definitionOps.test.ts && npx tsc -b` | ✅ |
| 07-1 | 185-07 | 3 | GOVERN-01 | 12, 13 | vitest + tsc | `cd frontend && npx tsc -b && npx vitest run src/components/workflows/GovernanceSection.test.tsx` | ✅ |
| 07-2 | 185-07 | 3 | GOVERN-01 | 7 (DOM absence), 12, 13 | vitest | `cd frontend && npx vitest run src/components/workflows/GovernanceSection.test.tsx && cd .. && node scripts/vitest-count-gate.cjs` | ✅ |
| 07-3 | 185-07 | 3 | GOVERN-01 | 21 | vitest (mount point) | `cd frontend && npx vitest run src/components/workflows && cd .. && node scripts/vitest-count-gate.cjs` | ✅ |
| 08-1 | 185-08 | 4 | GOVERN-01, GOVERN-02 | 14 | vitest + count-gate re-pin | `cd frontend && npx vitest run src/components/workflows && cd .. && node scripts/vitest-count-gate.cjs` | ✅ |
| 08-2 | 185-08 | 4 | GOVERN-02 | 18 (node count) | vitest (canvas model) | `cd frontend && npx vitest run src/components/workflows/canvasModel.test.ts src/components/workflows/canvasModel.purity.test.ts src/components/workflows/canvasModel.roundtrip.test.ts` | ✅ |
| 08-3 | 185-08 | 4 | GOVERN-01 | 12 · G-4 #1 | vitest (page write chain) | `cd frontend && npx vitest run src/pages src/components/workflows && cd .. && node scripts/vitest-count-gate.cjs` | ✅ |
| 09-1 | 185-09 | 5 | GOVERN-02 | 16 (markup half) | vitest | `cd frontend && npx vitest run src/components/workflows/PhaseNodeCard.test.tsx src/components/workflows/WorkflowCanvas.test.tsx` | ✅ |
| 09-2 | 185-09 | 5 | GOVERN-02 | 16, 23, 24 | vitest (props fence, zone check, tab-stop walk) | `cd frontend && npx vitest run src/components/workflows && cd .. && node scripts/vitest-count-gate.cjs` | ✅ |
| 10-1 | 185-10 | 5 | GOVERN-03 | 24 · D-185-18 | vitest (projection) | `cd frontend && npx vitest run src/components/workflows/canvasModel.fixtures.test.ts src/components/workflows/canvasModel.test.ts src/components/workflows/canvasModel.purity.test.ts` | ✅ |
| 10-2 | 185-10 | 5 | GOVERN-03 | D-185-18 · G-4 #4 | vitest + tsc | `cd frontend && npx tsc -b && npx vitest run src/components/workflows/FlowEdge.test.tsx src/components/workflows/WorkflowCanvas.test.tsx` | ✅ |
| 10-3 | 185-10 | 5 | GOVERN-02, GOVERN-03 | 24 · D-185-18 | vitest (ordinary-edge regression guard) | `cd frontend && npx vitest run src/components/workflows && cd .. && node scripts/vitest-count-gate.cjs` | ✅ |
| 11-1 | 185-11 | 6 | GOVERN-01, GOVERN-02 | 14, 15 · D-185-02 | vitest (source sweep, parser-scoped) | `cd frontend && npx vitest run src/components/workflows/governanceVocabulary.test.ts && cd .. && node scripts/vitest-count-gate.cjs` | ✅ |
| 11-2 | 185-11 | 6 | GOVERN-01, GOVERN-02, GOVERN-03 | 2, 11, 20, 21 | git-diff fences + grep | `git diff --stat 59c32a06..HEAD -- supabase/migrations backend/app/services/agent_loop.py backend/app/services/tool_dispatcher.py backend/app/services/openai_service.py backend/app/services/anthropic_service.py backend/app/services/harness/phase_types.py` | ✅ *(criterion-2 half SUPERSEDED 2026-07-31 — accurate when taken; migration 114 lands via plan `185-13`, see fence 1b)* |
| 11-3 | 185-11 | 6 | GOVERN-01, GOVERN-02, GOVERN-03 | 16 (visual), 17, 22 · D-185-18 · G-4 #1–#4 | **operator UAT — Chrome MCP** | *(none — `<human-check>`; this is the one task with no automated half, and the reason `nyquist_compliant` is still `false`)* | 🟨 |
| 12-1 | 185-12 | 7 | GOVERN-01 | BUG-260730-01 | pytest (validator remedy + one-home constant) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_validator_kinds.py -q` | ✅ |
| 12-2 | 185-12 | 7 | GOVERN-01 | BUG-260730-01 · D-14 | pytest (prompt suffix on BOTH agent executors; `''` when no gate) | `cd backend && venv/Scripts/python -m pytest tests/unit -q -k "phase_types or detection or harness"` | ✅ |
| 12-3 | 185-12 | 7 | GOVERN-01 | BUG-260730-01 | pytest (drift pin: instructed example must match the compiled pattern) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_185_detection.py tests/unit/test_validator_kinds.py -q` | ✅ |

*Status: ⬜ pending · 🟨 partly recorded · ✅ green · ❌ red · ⚠️ flaky*

**11-3 is 🟨, not ✅.** Six of its fourteen rows are now recorded (G-4 #1, G-4 #4, criterion 17, the
SC#10 Google row, and the end-to-end publish); G-4 #2, G-4 #3, D-185-18's screenshot diff and seven
scoreboard rows remain. It flips to ✅ only when every row below carries a result.

**Sampling continuity holds:** the longest run of consecutive tasks without an automated verify is
**one** (11-3, the terminal checkpoint). Criteria with NO automated row anywhere — 17, 22, the visual
half of 16, and D-185-18 — are all owned by 11-3 by design, not by omission.

---

## Wave 0 Requirements

- [x] `backend/tests/unit/test_185_detection.py` — criteria 4, 5, 6, 7, 8 · landed in `185-02`
- [x] `backend/tests/unit/test_185_engine_attachment.py` — criteria 9, 10, 18, 19 · landed in `185-03`,
      grown by `185-04` (22 passed at the `185-05` reading)
- [x] `frontend/src/components/workflows/GovernanceSection.test.tsx` — criteria 12, 13, 21 · landed in
      `185-07`, **42 tests** at the final count-gate reading
- [x] `frontend/src/components/workflows/FlowEdge.test.tsx` — criterion 24 + detour geometry · landed in
      `185-10`, **22 tests**
- [x] **`scripts/vitest-count-gate.cjs` baseline update** — done in `185-08` Task 1, in the **same commit**
      as the deletion (`30cb77f9`), with the number read from the gate's own `actual` column:
      `phaseVocabulary.test.ts` **42 → 33**, `BASELINE_TOTAL` **424 → 415**. `WorkflowCanvas.test.tsx`
      needed **no** re-pin — it GAINED tests (pinned 31, actual 35 after `185-09`/`185-10`), and a positive
      delta is not a gate failure. The stale-positive re-pin stays deferred against SEED-056 below.
- [x] No framework install needed — pytest and vitest both ship. RESEARCH's Package Legitimacy Audit
      found this phase installs nothing; no legitimacy checkpoint was required and none was raised.
- [x] **New in `185-11`:** `frontend/src/components/workflows/governanceVocabulary.test.ts` — criteria 14,
      15 and the D-185-02 overclaim guard, **30 tests**, correctly NOT added to `BASELINE` (it reports
      `new`).

---

## Manual-Only Verifications

### G-4 lived-experience UAT — MANDATORY

Operator-defined at scope time; carried verbatim from `185-CONTEXT.md` §specifics. Chrome MCP drives all
four at phase verification. **Wire format + screenshot are insufficient.**

| # | Scenario | Requirement | Failure condition | Result (2026-07-31) |
|---|---|---|---|---|
| 1 | **Watch a step lock in front of you.** Switch on *Search your documents*; three things move at once with no reload — the loose side strikes through, pressing it prints the refusal reason as readable text, the canvas card grows its corner seal. | GOVERN-01, GOVERN-02 | Any of the three lags behind the chip, flickers, or only appears after a refresh | **PASS — with one wording deviation, see below** |
| 2 | **The seal survives a live run.** Launch a run; watch a grounded card go idle → running → needs-you → failed. | GOVERN-02 | The seal dims, hides, shifts, or is swallowed by the status colour — at exactly the moment it matters most | **NOT OBSERVABLE IN THIS PHASE → deferred to Phase 188** — see below |
| 3 | **Arm it and walk away.** Arm an outbound step, launch, close the tab, come back much later. | GOVERN-03 | The run advanced on its own (today's behaviour), or the prompt survived but is unreachable | ⬜ not run — **operator-only** (needs a real absence) |
| 4 | **The detour reads as a detour.** Armed: the connector visibly leaves the flow and returns through the person-point, with NO straight line past it. Unarmed: faint dashed ghost with the line through. | GOVERN-03 | Armed and unarmed are indistinguishable at a glance, or the arc collides with the ✕ or ＋ | **PASS — measured** |

**Recorded 2026-07-31**, driven in Chrome against `http://localhost:5173/` on the
`compliance-gap-report-3qh9oe` draft. Measurements are DOM/geometry reads in a real browser (which,
unlike jsdom, computes paint), not wire format and not screenshots alone.

**G-4 #1 — PASS, exercised in BOTH directions.** One click on *Search documents*, three marks moved
together with no reload:

| | tool ON | tool OFF |
|---|---|---|
| canvas seals rendered | 2 | **1** |
| `○ Free to think` text-decoration | `line-through` | **`none`** |
| `○ Free to think` opacity | `0.42` | **`1`** |
| `○ Free to think` selectable | `disabled` / `aria-disabled=true` / `cursor: not-allowed` | **enabled** |

Toggling back restored all three, so the transition is symmetric, not one-way. The seal itself
measures 21 px with its OWN background `rgba(255,255,255,.1)` and OWN border `1px
rgba(255,255,255,.34)`, `pointer-events: none`, **no `role`, no `tabIndex`, no handler**, screen-reader
text **"Must prove it"** — and white-alpha only, so governance spends no colour (SPEC Req 6).

> **DEVIATION, recorded rather than smoothed over.** The scenario as authored says *"pressing it
> prints the refusal reason"*. It does not work that way: the loose side is a genuinely `disabled`
> button, so pressing it fires nothing. The refusal reason is instead **always rendered** beneath the
> dial — *"Because this step reads your documents. Reading your files is what this step is for, so it
> has to show where its answers came from. You can switch off the document tools below — but that
> does not loosen the step, it stops it opening your files at all."* The scenario's INTENT (a
> readable refusal, not a dead greyed-out button) is satisfied, arguably better than press-to-reveal.
> The literal wording is not what shipped. Scored PASS on intent, with the discrepancy stated so the
> next reader is not misled.

**G-4 #4 — PASS, geometry measured rather than eyeballed.** Arming the target step moved its incoming
edge from **2 paths / 0 circles** to **3 paths / 1 circle**, with **0 straight-line paths** through
the gap — i.e. the arc IS the path and nothing runs past it. Arrowhead preserved; **0 focusables** on
the edge subtree (`role`, `tabIndex`, click handler all absent), so the mark is a signal and the
one-tab-stop-per-node contract holds. Armed label reads **"you say yes"**, character-identical to the
exported const. Unarmed-**absent** renders as the ordinary connector (0 circles, 0 dashed), which is
the three-state model `185-10` established (absent / `false` / `true`).

**G-4 #2 — NOT OBSERVABLE IN PHASE 185. Deferred to Phase 188 with a concrete trigger, not skipped.**

Attempting to drive this row surfaced the reason it cannot be driven: **the canvas has no run states
to show yet.** Verified in source, not inferred —

- `PhaseNodeCard.tsx:204` declares `status?: NodeRunStatus`, but it is an **extensibility seam**, and
  the card's own docblock (`:18`) names its consumers as "185 / 188 / 189 ADD DATA, NOT LAYOUT".
- `PhaseNode.tsx:183` states it outright: *"`status`, `technicalLine` and `stepNumber` are still
  deliberately NOT passed"*.
- `grep -n status canvasModel.ts` returns **nothing** — the projection does not carry run status at all.

So there is no idle → running → needs-you → failed transition to watch on a card in this phase. Live
run state on the canvas is **RUNVIZ-01, Phase 188's** deliverable. Scoring this row PASS today would
be scoring a surface that does not exist; scoring it FAIL would blame 185 for not shipping 188.

**What holds the invariant in the meantime is stronger than a screenshot would have been.** The
guarantee is *structural*: the seal's markup cannot express a dependency on run state, so it cannot
regress into one. `PhaseNodeCard.test.tsx:987-1007` extracts the seal's own JSX block — asserting the
extractor really carved a slice (`< source.length / 4`, contains the testid, `aria-hidden`, `sr-only`)
rather than matching nothing — then asserts that block never names the run-state prop, with the prop
name **assembled from fragments** so the guard cannot be satisfied by editing the docblock that
explains it (the D-ITEM-183-02 trap). Critically it carries a **POSITIVE CONTROL**: a planted seal
that *does* read run state turns the fence red. Paired with the four-value render asserting identical
class list and text, and the `outerHTML` comparison `185-09` strengthened it to after finding the
original assertion passed under a planted `data-run={props.status}`.

> **Re-open trigger (carry into Phase 188):** the first commit that passes `status` into
> `PhaseNodeCard` — i.e. when `canvasModel` or `PhaseNode` starts carrying run state — MUST drive this
> row: launch a run and confirm the corner seal is byte-identical in position, size and brightness at
> idle, running, needs-you and failed. That is the moment the visual claim becomes checkable, and the
> moment the status colour first overwrites the border the seal is designed to outlive.

**G-4 #4 clearance — measured, and 1 px tighter than the sketch.** Sampling the rendered cubic at 4000
> points and mapping through the screen CTM, the arc's minimum clearance below the ＋ box is
> **7.17 px** (＋ box measured at exactly 26 px). `entersBox: false` — the curve never enters the
> button, so the scenario's failure condition does not fire and the row is a genuine PASS. But sketch
> 147 computed **8.2 px** and `FlowEdge.test.tsx` asserts **≥ 8 px**. The unit test passes because it
> measures against the nominal box in its own frame; the *rendered* margin is tighter. **The test is
> not measuring what ships.** Not a defect — no collision — but it is a soft spot worth a follow-up,
> and it is recorded here rather than in a SUMMARY so it does not rot.

### Other manual-only

| Behavior | Criterion | Why manual | Instructions | Result (2026-07-31) |
|---|---|---|---|---|
| Colour-stripped render still distinguishes grounded from open | 17 | jsdom computes no paint | Screenshot the canvas with `filter: grayscale(1)` applied; a grounded and an open card must remain tellable apart | **PASS — and structurally, not just visually** |
| Ordinary (unarmed, non-risky) flow edges render identically after the `edgeTypes` switch | D-185-18 | Every edge changes renderer; only a visual diff catches regression | Screenshot a 5-step unarmed workflow before and after the `FlowEdge` landing; edges must be indistinguishable | ⬜ not run — needs a pre-`FlowEdge` reference capture |

**Criterion 17 — PASS.** Captured with `filter: grayscale(1)` applied to the document root, one step
open and one grounded. The two cards remain plainly tellable apart. The stronger reading is that this
holds **by construction, not by luck**: the seal's two load-bearing carriers are its own background
`rgb(255,255,255)` @ .1 and its own border `rgb(255,255,255)` @ .34 — both perfectly achromatic, so
greyscale is a mathematical **no-op** on them. And the grounded/open distinction is
*presence-vs-absence of a shape*, which cannot depend on hue at all. The glyph fill is
`rgb(243,245,252)`, very slightly cool but within ~3.5% of neutral — it greyscales to a near-identical
value and stays legible. Screenshot retained at
`claude-chrome-screenshots-XG0OW4/screenshot-1785419139087-0.jpg`.

**D-185-18 — deliberately NOT scored.** It requires a *before* capture from a tree that predates
`FlowEdge`, which no longer exists in the working tree. Honest options: capture it from a checkout of
`53e6e683` (the Wave-4 tip), or accept `FlowEdge.test.tsx`'s mechanical baseline as the proof and
downgrade this row from "visual diff" to "recorded as covered by test". Left open rather than
silently marked done.

---

## SC#10 Cross-Provider Scoreboard — MANDATORY

CLAUDE.md §"UAT scoreboard recipe": *any phase touching streaming, agent loop, provider routing, or UI
state MUST include rows for cross-provider × multi-tool × parallel-thread × long-message.* A grounded
node's citation enforcement rides the provider-sensitive retrieval/agent path, so D-185-01's
`citations`-non-empty check is exactly the thing that can vary per provider.

> **READ THIS BEFORE SCORING — set the expectation up front so a Google failure is not misread as a
> regression (RESEARCH §L-3).** `citations` are built by the dispatcher's tool handlers and harvested
> off `ToolResult` — a **provider-independent** path — and `apply_tool_budget` never drops a
> whitelisted tool (`openai_service.py:1193-1196`, a *verified negative*, not an assumption). So there
> is no per-provider divergence in how a citation becomes a citation. **The divergence lives one layer
> up: whether the MODEL emits a tool call at all.** A model that answers from the prompt without
> searching produces `citations == []`, so the gate fails — **which is the gate working exactly as
> designed**, and is the same thing the Negative row deliberately provokes. Google is the
> highest-risk row precisely because it is the likeliest to answer without searching. Per the
> **provider-docs-first** rule, research that provider's OWN tool-use documentation before attributing
> any failure to our code, and keep any fix at the **service boundary** — never on the shared path.
> A red Google row is only a defect if the model DID call the KB tool and the gate still failed.

| Axis | Row | Model | What it proves | Result |
|---|---|---|---|---|
| **Cross-provider** | OpenAI | `gpt-5.5` | grounded `llm_agent` w/ `search_documents`, no declared validator ⇒ `citations` non-empty ⇒ gate passes | **✅ PASS** |
| **Cross-provider** | Anthropic (native) | `claude-sonnet-5` | same definition — the native tool-use path populates citations identically | **✅ PASS on this axis** (emit failed separately — see below) |
| **Cross-provider** | Google | `gemini-3.6-flash` | **highest-risk row** — the model may answer without calling the KB tool (RESEARCH L-3) | **✅ PASS** — see below |
| **Cross-provider** | OpenRouter | `z-ai/glm-5.2` | experimental path; fix only if native-safe and low-complexity | **✅ PASS** |
| **Multi-tool** | one prompt exercising `search_documents` **+** `execute_code` on a detected step | `gpt-5.5` | the KB tool is still called when it competes with another | **✅ PASS** |
| **Parallel-thread** | Thread A mid-armed-wait while Thread B launches a second run | `gpt-5.5` | one indefinite pub/sub subscriber does not starve the other; verify with `WORKER_COUNT=2` | **⛔ BLOCKED — [[BUG-260731-02]]** |
| **Long-message** | ≥ 50 prior messages **or** a ≥ 5 KB prompt on a detected step | `gpt-5.5` | citations still harvested under context pressure | **✅ PASS** (8 709-byte prompt) |
| **Negative** | a detected step where the model answers **without** searching | `gpt-5.5` | the gate FAILS honestly and the retry feedback names what was missing | **✅ PASS — failed exactly as designed** |

**Provider-docs-first:** any divergence found here must be researched against that provider's OWN tool-use
documentation before being attributed to our code, and any fix stays at the service boundary — never on the
shared path.

### Roster amendment — the board was 4 providers wide and the product is 8

**Raised by the operator, 2026-07-31, and it is a defect in the STANDARD, not in one execution:**
*"What about the other providers — DeepSeek, MiniMax, Z[hipu], Moonshot? Why do you always test those
four main providers, ignoring the others? We should make it resistant for the future."*

Correct. CLAUDE.md's §"UAT scoreboard recipe" said verbatim *"Cross-provider | OpenAI, Anthropic,
Google, OpenRouter (4 providers)"*, so every scoreboard in this project has tested four of the eight
providers the app actually ships and called the axis covered. That under-specification is why it
recurs. **CLAUDE.md has been amended** (2026-07-31): the required set is now the full native roster +
OpenRouter (8 rows), the roster must be **derived from `MODEL_CAPABILITIES` by grouping on
`provider`** rather than transcribed, representatives must be registry-backed (an inferred id
silently loses `emit_tier`), and a row that cannot run is recorded ⛔ with its blocker — never dropped.

**The four missing rows, driven 2026-07-31 on the same definition and method:**

| Provider | Model | `retrieve` (the axis this row measures) | Full run |
|---|---|---|---|
| DeepSeek | `deepseek-v4-pro` | **✅ completed** | emit still running at time of writing |
| MiniMax | `MiniMax-M3` | **✅ completed** | emit failed — see below |
| Zhipu / GLM | `glm-5.2` | **✅ completed** | emit still running at time of writing |
| Moonshot / Kimi | `kimi-k2.6` | **✅ completed** | **✅ completed end-to-end** |

**All four passed the grounded-retrieval axis** — the detected step called the KB tool, `citations`
came back non-empty, and the engine-synthesized gate cleared. So the graded-governance path is
**8-for-8 across the entire provider roster** on the property GOVERN-01 actually claims.

Two findings worth keeping:

1. **Moonshot completed the whole workflow on `emit_tier: coerce`.** `kimi-k2.6` carries the weakest
   emission guarantee in the registry (the only native `coerce` rows) and still produced a valid
   field-map and rendered the deliverable. That is evidence the coerce ladder is genuinely functional,
   not a paper fallback — relevant to [[SEED-135]], which flags those rows as judge-ineligible.
2. **`offending` is populated for MiniMax and empty for Anthropic, from the same validator.** MiniMax:
   `uncited=8 invented=25 offending=['scalar.report_date', 'scalar.report_title', 'scalar.scope', …]`.
   Anthropic earlier: `invented=24 offending=[]`. So the empty-list case is **conditional**, not a
   validator that never populates it — which makes [[BUG-260730-02]] sharper than first written: the
   surfaced message *can* name what is wrong and sometimes does not. Fold this evidence into that
   report rather than opening a new one.

> **Two rows remain in flight** (`deepseek-v4-pro`, `glm-5.2` — both on `emit`) and are recorded here
> as retrieve-PASS / emit-pending rather than being held back. They are markedly slower than the
> big-four on forced structured emission, which is itself the honest observation.

---

### Rows driven 2026-07-31 — method, and what each one actually showed

**Method.** Each row was launched as a real run via `POST /threads/{id}/messages` with a **per-request**
`model` + `provider` against the published `compliance-gap-report` definition
(`fd6f35a5-2f48-4d01-a405-a9214fee6971`) — so **no global setting was mutated to score the board**.
Verdicts are read from `workflow_runs.status`, `workflow_phases.status` / `_failure_reason` and
`harness_audit`, not from the UI. Two fixtures were created for the axes the published definition
cannot express (`sc10-multitool-*` adds `execute_code` beside `search_documents`; `sc10-armed-*` sets
`action_risk_armed` on `emit`).

> **Both fixtures are RETAINED, deliberately.** They are FK-referenced by the `workflow_runs` rows
> that back the verdicts above, so deleting them would delete the evidence for a recorded result —
> and `sc10-armed-*` is the standing reproduction for [[BUG-260731-02]]. They are throwaway test data
> (every `workflow_definitions` row in this project is), safe to remove once that bug is closed and
> these rows are no longer the live proof.

**OpenAI — `gpt-5.5` — PASS.** Both phases completed. Clean.

**OpenRouter — `z-ai/glm-5.2` — PASS, and more informative than expected.** Every OpenRouter row in
`MODEL_CAPABILITIES` carries `native_tools: False`, so this row exercised the **non-native** tool
path — and the detected step still called the KB tool, still returned non-empty `citations`, and
still cleared the gate. The "experimental path" caveat did not bite here.

**Anthropic — `claude-sonnet-5` — PASS on the axis this row measures, with a separate finding.** The
row's contract is the *retrieve* step ("grounded `llm_agent` w/ `search_documents`, no declared
validator ⇒ citations non-empty ⇒ gate passes") and it **completed**. The run then failed one step
later, at `emit`, on the **author-declared** `citations_required` validator:

```
Phase 2 (emit) gate failed after 3 attempt(s): citations_required: uncited=0 invented=24 offending=[]
```

> **Recorded as a separate observation, not scored against this row.** `uncited=0` with
> `invented=24` says every cell carried a citation and 24 of them pointed at ids the model was never
> shown — a real, correct rejection. But **`offending=[]` is empty while the count is 24**, so the
> message states a quantity and then names nothing. That is the same shape as [[BUG-260730-02]]: the
> gate knows precisely what is wrong and the surfaced string does not carry it. Worth folding into
> that report rather than opening a third.

**Multi-tool — `gpt-5.5` — PASS.** On a fixture whose detected step whitelists `search_documents`
**and** `execute_code`, with a prompt that explicitly demanded both, the run completed — the KB tool
was still called when it had competition. (`execute_code` is not a `KB_TOOLS` member, so adding it
leaves the step *detected*, which is what makes this a valid probe rather than a different test.)

**Long-message — `gpt-5.5` — PASS.** Kickoff prompt of **8 709 bytes** (≥ 5 KB bar) on the detected
step; citations were still harvested under context pressure and both phases completed.

**Negative — `gpt-5.5` — PASS, and this is the row that proves the gate is real.** Given a kickoff
that explicitly forbade searching (*"Do NOT search or open any documents… answer purely from your own
general knowledge"*), the model complied, retrieved nothing, and the gate **failed honestly** after 3
attempts with half (a)'s message:

```
citations_required: nothing was retrieved (0 sources) — this step reads your documents
and must show where its answer came from
```

That is the correct half firing (retrieval, not markers) and it names what was missing — which is
exactly what this row exists to demand. It also demonstrates that the [[BUG-260730-01]] fix did not
weaken the gate: a step that genuinely did not retrieve still fails.

**Parallel-thread — BLOCKED, not failed.** This row needs Thread A parked mid-armed-wait. Creating
that condition surfaced [[BUG-260731-02]]: an armed action-risk checkpoint **crashes the run** on an
unregistered audit kind (`action_risk_pending` is absent from both `_AUDIT_EVENT_TYPES` and the
`harness_audit` CHECK constraint), so no armed wait can be established to run a second thread against.
The row is unscoreable until that is fixed, and it is recorded as blocked rather than skipped.

---

### Google row — recorded 2026-07-31

**PASS, and it is the strongest single piece of GOVERN-01 evidence the phase has.** Golden run
`ced8005d-24b9-413b-8edc-56beb8743298`, `llm_model = gemini-3.6-flash`, on the published
`compliance-gap-report` definition. The `retrieve` phase is a detected grounded `llm_agent` with
`search_documents` and no author-declared validator — exactly the row's definition. It **completed**:
the model called the KB tool, `citations` came back non-empty, and the engine-synthesized
`retrieved_and_cited` gate passed. The highest-risk row did not fire its risk.

The independent publish judge (`gpt-5.5`, OpenAI — a *different provider from the run*, so this row
doubles as genuine cross-provider evidence) scored it **82 / passed**:

> "…six obligation rows, each with source_clause, current_state, gap, severity, and owner, **every
> populated cell carrying a citation to a named knowledge-base document**, and the one unsupported
> field (`report_title`) **correctly nulled rather than invented** … it is legitimately cited, so
> **grounding holds**."

That sentence is GOVERN-01's whole contract — retrieved, pointed-at, and refusing to invent —
confirmed by a model that did not run the workflow. `publish_succeeded`, version 1.

**Two caveats kept attached to this row, so it is not over-read:**

1. **It only passed after BUG-260730-01 was fixed.** The same definition on the same path failed three
   consecutive golden runs before `185-12` landed. A green Google row here is evidence about the
   *fixed* engine, not about the engine as `185-11` Task 2 found it.
2. **`gemini-3.6-flash` is NOT in `MODEL_CAPABILITIES`**, so it resolved `capability_source=inferred`
   with `emit_tier=None` and the `emit` phase silently ran at tier **`coerce`** instead of `force`
   (`harness_audit.emit_rendered.tier` on run `da5541c0`). It succeeded anyway — but this row was
   scored on a model running with *weaker* emission guarantees than the registry would have given it,
   and nothing warned. Captured as [[SEED-040]] scope item (e) and [[SEED-135]].

**Judge-on-Google is a separate, still-open finding.** With `harness_judge_model = gemini-3.5-flash`
the publish judge returned `failure: "provider_error"`, `overall_score: null`, no verdict at all
(run `da5541c0`) — while the *same Google model ran the workflow itself fine*. Switching the judge to
`gpt-5.5` cleared it immediately. So a tenant standardised on Google can execute workflows but
**cannot publish one**, and the only way to discover that today is a burned golden run. Suspected
cause: `JudgeVerdict.model_json_schema()` carries `$defs` + a `$ref` for its nested `criteria` array,
and `google_service.py`'s `_GOOGLE_UNSUPPORTED_SCHEMA_KEYS` strips both — leaving `criteria.items` as
a content-free `{}`. **HIGH confidence the wire schema loses `criteria`'s shape; MEDIUM that this is
what surfaces as `provider_error`; never live-verified.** Tracked in [[SEED-135]]; do not state it as
fact anywhere until reproduced.

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a Wave 0 dependency — **33 of 34** (Wave 7's `12-1`,
      `12-2`, `12-3` each carry one). The exception is `11-3`, the blocking `checkpoint:human-verify`,
      which is manual by construction.
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify — longest gap is **one**
- [x] Wave 0 covers all MISSING references (incl. the vitest count-gate baseline) — see the ticked list above
- [x] No watch-mode flags — every command in the map is `vitest run` or `pytest`, none is `--watch`
- [x] Feedback latency < 30 s — quick runs measured at ~3–6 s (the new sweep: 5.27 s cold)
- [ ] **All 4 G-4 scenarios executed via Chrome MCP** — **3 of 4 dispositioned 2026-07-31**: #1 PASS
      (wording deviation recorded), #4 PASS (geometry measured), **#2 deferred to Phase 188 with a
      re-open trigger** — the canvas carries no run status in this phase, so the row is not observable
      here; the invariant is held structurally by the props fence + its positive control. **Only #3
      remains owed, and it is operator-only** — it requires a real absence long enough that the
      pre-185 timeout would have fired.
- [ ] **SC#10 scoreboard complete — 4 providers + 3 axes + the negative row** — **7 of 8 PASS,
      1 BLOCKED (2026-07-31).** ✅ OpenAI `gpt-5.5` · ✅ Anthropic `claude-sonnet-5` (on this row's
      axis) · ✅ Google `gemini-3.6-flash` · ✅ OpenRouter `z-ai/glm-5.2` · ✅ multi-tool · ✅
      long-message (8 709 B) · ✅ negative (failed honestly, named the deficit). ⛔ **parallel-thread
      is BLOCKED by [[BUG-260731-02]]** — an armed checkpoint crashes the run, so the precondition
      (Thread A parked mid-wait) cannot be created. Not skipped; unscoreable until that ships.
      No row was blocked on credentials: all provider keys resolve from the env-backed settings
      (openai · anthropic · google · openrouter · deepseek · moonshot · zhipu · minimax · tavily) —
      the empty `app_settings.*_api_key` columns are an unused DB overlay, not the source of truth
      (`user_settings.llm_api_key or settings.llm_api_key`).
- [ ] `nyquist_compliant: true` set in frontmatter — deliberately still `false`; see the note under the
      frontmatter for exactly what must land first

### Phase-level fences — recorded by plan `185-11` Task 2 (2026-07-30)

Base for every phase-wide diff is **`59c32a06`** (`docs(185): operator ratifies D-185-17` — the last
commit before any 185 code), 48 commits back from the reading.

| # | Fence | Command | Result |
|---|---|---|---|
| 1 | ~~**Criterion 2 — no migration**~~ **SUPERSEDED 2026-07-31 — see fence 1b** | `git diff --stat 59c32a06..HEAD -- supabase/migrations` | **0 files** *(reading of 2026-07-30, accurate when taken and preserved as the record of what plan `185-11` verified)*. Live head confirmed still **113**: `public.sso_configs` exists with 113's firming columns (`status`, `approved_by`, `approved_at`) via psycopg2 on `127.0.0.1:54322`, and no `114_*.sql` existed in the repo. (`supabase_migrations.schema_migrations` tops out at `036` and is NOT the source of truth here — this project applies migrations through the SQL editor, which registers no row.) |
| 1b | **Criterion 2 as AMENDED (2026-07-31, plan `185-13`)** — exactly one migration | `git diff --stat 59c32a06..HEAD -- supabase/migrations` | **Expected: 1 file — `114_harness_audit_action_risk_pending.sql`**, which adds exactly one literal (`action_risk_pending`, 22 → 23) to `harness_audit_event_type_check` and no other schema object (no table, column, index, grant or policy; the INSERT-only RLS is untouched). **Reason: the zero-migration promise was a scoping convenience; the honest-pause vocabulary is a correctness property, and the alternative knowingly ships the defect the phase existed to fix** (BUG-260731-02). Live head becomes **114** only after Task 3 — the operator applies it via the Supabase SQL editor, then regenerates `full-schema.sql` (no reset). **Status at the close of plan `185-13` Tasks 1-2: file authored, NOT applied — `pg_get_constraintdef` still reports the 22-literal form.** |
| 2 | **Criterion 11 / D-14 — the Deep chat path** | `git diff --stat 59c32a06..HEAD -- backend/app/services/agent_loop.py …/tool_dispatcher.py …/openai_service.py …/anthropic_service.py` | **0 files.** |
| 2b | **Criterion 20 — the harness phase executor types** | `git diff --stat 59c32a06..HEAD -- backend/app/services/harness/phase_types.py` | **0 files.** |
| 3 | **Criterion 21 / G-5 — `PhaseFormPanel.tsx`** | `git diff --stat 59c32a06..HEAD -- frontend/src/components/workflows/PhaseFormPanel.tsx` | **23 insertions, 6 deletions.** Split: **16 ins / 6 del are docblock prose only**; **2 ins are type declarations** (`kbTools?: readonly string[]`, `onGovernanceChange?: …`); **1 ins is the import**; **4 ins are the render body** — one destructure line plus the 3-line `{rails && <GovernanceSection … />}` mount point. The render-body portion is **≤ 4 lines** as criterion 21 requires, and the whole dial, its refusal and the arming switch live in `GovernanceSection.tsx`, a file of their own. |
| 4 | **Req 6 — the retired grounding symbols** | `grep -rn "groundingFor\|GROUNDINGS" frontend/src \| wc -l` | **0.** |

**Approval:** pending — blocked on task 11-3 (G-4 ×4 + the two other manual rows + the 8-row SC#10
scoreboard). Every automated gate is green; nothing else is owed.
