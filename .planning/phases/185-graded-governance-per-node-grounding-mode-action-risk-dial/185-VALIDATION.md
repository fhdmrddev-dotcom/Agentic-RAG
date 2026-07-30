---
phase: 185
slug: graded-governance-per-node-grounding-mode-action-risk-dial
status: awaiting-operator-gate
nyquist_compliant: false
wave_0_complete: true
created: 2026-07-29
updated: 2026-07-30
---

> **`nyquist_compliant: false` is a DELIBERATE reading, not an unfilled default.** Thirty of the
> thirty-one tasks in the map below carry an `<automated>` command, and no three consecutive tasks
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
| 2 | `git diff -- supabase/migrations` is 0 lines; live head still 113 | grep/CI step | plan verification step |
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

Thirty-one tasks across eleven plans. Filled by plan `185-11` Task 2 once every wave had landed —
the criterion column is derived from the "Where" column of the criteria table above cross-read
against each plan's task names and `must_haves`, not lifted from planner output. `G-4 #n` and
`D-185-18` name the manual rows in §"Manual-Only Verifications"; those tasks are green on their
automated half and their lived-experience half belongs to 11-3.

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
| 11-2 | 185-11 | 6 | GOVERN-01, GOVERN-02, GOVERN-03 | 2, 11, 20, 21 | git-diff fences + grep | `git diff --stat 59c32a06..HEAD -- supabase/migrations backend/app/services/agent_loop.py backend/app/services/tool_dispatcher.py backend/app/services/openai_service.py backend/app/services/anthropic_service.py backend/app/services/harness/phase_types.py` | ✅ |
| 11-3 | 185-11 | 6 | GOVERN-01, GOVERN-02, GOVERN-03 | 16 (visual), 17, 22 · D-185-18 · G-4 #1–#4 | **operator UAT — Chrome MCP** | *(none — `<human-check>`; this is the one task with no automated half, and the reason `nyquist_compliant` is still `false`)* | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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

| # | Scenario | Requirement | Failure condition |
|---|---|---|---|
| 1 | **Watch a step lock in front of you.** Switch on *Search your documents*; three things move at once with no reload — the loose side strikes through, pressing it prints the refusal reason as readable text, the canvas card grows its corner seal. | GOVERN-01, GOVERN-02 | Any of the three lags behind the chip, flickers, or only appears after a refresh |
| 2 | **The seal survives a live run.** Launch a run; watch a grounded card go idle → running → needs-you → failed. | GOVERN-02 | The seal dims, hides, shifts, or is swallowed by the status colour — at exactly the moment it matters most |
| 3 | **Arm it and walk away.** Arm an outbound step, launch, close the tab, come back much later. | GOVERN-03 | The run advanced on its own (today's behaviour), or the prompt survived but is unreachable |
| 4 | **The detour reads as a detour.** Armed: the connector visibly leaves the flow and returns through the person-point, with NO straight line past it. Unarmed: faint dashed ghost with the line through. | GOVERN-03 | Armed and unarmed are indistinguishable at a glance, or the arc collides with the ✕ or ＋ |

### Other manual-only

| Behavior | Criterion | Why manual | Instructions |
|---|---|---|---|
| Colour-stripped render still distinguishes grounded from open | 17 | jsdom computes no paint | Screenshot the canvas with `filter: grayscale(1)` applied; a grounded and an open card must remain tellable apart |
| Ordinary (unarmed, non-risky) flow edges render identically after the `edgeTypes` switch | D-185-18 | Every edge changes renderer; only a visual diff catches regression | Screenshot a 5-step unarmed workflow before and after the `FlowEdge` landing; edges must be indistinguishable |

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
| **Cross-provider** | OpenAI | *(representative)* | grounded `llm_agent` w/ `search_documents`, no declared validator ⇒ `citations` non-empty ⇒ gate passes | ⬜ |
| **Cross-provider** | Anthropic (native) | *(representative)* | same definition — the native tool-use path populates citations identically | ⬜ |
| **Cross-provider** | Google | *(representative)* | **highest-risk row** — the model may answer without calling the KB tool (RESEARCH L-3) | ⬜ |
| **Cross-provider** | OpenRouter | *(representative)* | experimental path; fix only if native-safe and low-complexity | ⬜ |
| **Multi-tool** | one prompt exercising `search_documents` **+** `execute_code` on a detected step | — | the KB tool is still called when it competes with another | ⬜ |
| **Parallel-thread** | Thread A mid-armed-wait while Thread B launches a second run | — | one indefinite pub/sub subscriber does not starve the other; verify with `WORKER_COUNT=2` | ⬜ |
| **Long-message** | ≥ 50 prior messages **or** a ≥ 5 KB prompt on a detected step | — | citations still harvested under context pressure | ⬜ |
| **Negative** | a detected step where the model answers **without** searching | any | the gate FAILS honestly and the retry feedback names what was missing | ⬜ |

**Provider-docs-first:** any divergence found here must be researched against that provider's OWN tool-use
documentation before being attributed to our code, and any fix stays at the service boundary — never on the
shared path.

---

## Validation Sign-Off

- [x] All tasks have an `<automated>` verify or a Wave 0 dependency — **30 of 31**. The exception is
      `11-3`, the blocking `checkpoint:human-verify`, which is manual by construction.
- [x] Sampling continuity: no 3 consecutive tasks without an automated verify — longest gap is **one**
- [x] Wave 0 covers all MISSING references (incl. the vitest count-gate baseline) — see the ticked list above
- [x] No watch-mode flags — every command in the map is `vitest run` or `pytest`, none is `--watch`
- [x] Feedback latency < 30 s — quick runs measured at ~3–6 s (the new sweep: 5.27 s cold)
- [ ] **All 4 G-4 scenarios executed via Chrome MCP** — **owed by task 11-3; the operator gate has not run**
- [ ] **SC#10 scoreboard complete — 4 providers + 3 axes + the negative row** — **owed by task 11-3**
- [ ] `nyquist_compliant: true` set in frontmatter — deliberately still `false`; see the note under the
      frontmatter for exactly what must land first

### Phase-level fences — recorded by plan `185-11` Task 2 (2026-07-30)

Base for every phase-wide diff is **`59c32a06`** (`docs(185): operator ratifies D-185-17` — the last
commit before any 185 code), 48 commits back from the reading.

| # | Fence | Command | Result |
|---|---|---|---|
| 1 | **Criterion 2 — no migration** | `git diff --stat 59c32a06..HEAD -- supabase/migrations` | **0 files.** Live head confirmed still **113**: `public.sso_configs` exists with 113's firming columns (`status`, `approved_by`, `approved_at`) via psycopg2 on `127.0.0.1:54322`, and no `114_*.sql` exists in the repo. (`supabase_migrations.schema_migrations` tops out at `036` and is NOT the source of truth here — this project applies migrations through the SQL editor, which registers no row.) |
| 2 | **Criterion 11 / D-14 — the Deep chat path** | `git diff --stat 59c32a06..HEAD -- backend/app/services/agent_loop.py …/tool_dispatcher.py …/openai_service.py …/anthropic_service.py` | **0 files.** |
| 2b | **Criterion 20 — the harness phase executor types** | `git diff --stat 59c32a06..HEAD -- backend/app/services/harness/phase_types.py` | **0 files.** |
| 3 | **Criterion 21 / G-5 — `PhaseFormPanel.tsx`** | `git diff --stat 59c32a06..HEAD -- frontend/src/components/workflows/PhaseFormPanel.tsx` | **23 insertions, 6 deletions.** Split: **16 ins / 6 del are docblock prose only**; **2 ins are type declarations** (`kbTools?: readonly string[]`, `onGovernanceChange?: …`); **1 ins is the import**; **4 ins are the render body** — one destructure line plus the 3-line `{rails && <GovernanceSection … />}` mount point. The render-body portion is **≤ 4 lines** as criterion 21 requires, and the whole dial, its refusal and the arming switch live in `GovernanceSection.tsx`, a file of their own. |
| 4 | **Req 6 — the retired grounding symbols** | `grep -rn "groundingFor\|GROUNDINGS" frontend/src \| wc -l` | **0.** |

**Approval:** pending — blocked on task 11-3 (G-4 ×4 + the two other manual rows + the 8-row SC#10
scoreboard). Every automated gate is green; nothing else is owed.
