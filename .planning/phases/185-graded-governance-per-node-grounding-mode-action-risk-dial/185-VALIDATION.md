---
phase: 185
slug: graded-governance-per-node-grounding-mode-action-risk-dial
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-29
---

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

*Filled after planning. One row per task; every task must map to a criterion above or to a Wave-0 stub.*

| Task ID | Plan | Wave | Requirement | Criterion | Test Type | Automated Command | Status |
|---------|------|------|-------------|-----------|-----------|-------------------|--------|
| *(pending planner output)* | | | | | | | ⬜ |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_185_detection.py` — criteria 4, 5, 6, 7, 8
- [ ] `backend/tests/unit/test_185_engine_attachment.py` — criteria 9, 10, 18, 19
- [ ] `frontend/src/components/workflows/GovernanceSection.test.tsx` — criteria 12, 13, 21
- [ ] `frontend/src/components/workflows/FlowEdge.test.tsx` — criterion 24 + detour geometry
- [ ] **`scripts/vitest-count-gate.cjs` baseline update** for `phaseVocabulary.test.ts` and
      `WorkflowCanvas.test.tsx`. Deleting `groundingFor()` removes its `it()` blocks, and a **decrease is a
      hard gate failure** (the Phase-177 lesson). This edit MUST land in the **same commit** as the deletion,
      with the new pin **measured, not guessed**.
- [ ] No framework install needed — pytest and vitest both ship.

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

- [ ] All tasks have an `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all MISSING references (incl. the vitest count-gate baseline)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s
- [ ] All 4 G-4 scenarios executed via Chrome MCP
- [ ] SC#10 scoreboard complete — 4 providers + 3 axes + the negative row
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
