---
phase: 197
slug: guided-authoring
status: approved
nyquist_compliant: true
wave_0_complete: false
created: 2026-08-18
approved: 2026-08-18
---

# Phase 197 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source of every measured figure below: `197-RESEARCH.md` §Validation Architecture / §G-4.
> ⚠ **Re-derive counts; never inherit them.** This project's gate totals have rotted three times,
> once in a single day.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (frontend)** | Vitest + @testing-library/react (jsdom) |
| **Framework (backend)** | pytest |
| **Config file** | `frontend/vitest.config.ts` · gate `scripts/vitest-count-gate.cjs` |
| **Quick run (frontend, in-scope only)** | `cd frontend && GSD_VITEST_MAX_WORKERS=2 npx vitest run <paths>` |
| **Quick run (backend)** | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit/test_workflow_authoring_requirement.py -q` |
| **Full suite (frontend)** | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` |
| **Full suite (backend)** | `backend/venv/Scripts/python.exe -m pytest backend/tests/unit -q` |
| **Typecheck** | `cd frontend && npx tsc --noEmit -p tsconfig.app.json` — ⚠ the `-p` is load-bearing; a bare `--noEmit` checks ZERO files |
| **Estimated runtime** | in-scope suites ~60s · full frontend gate ~6-9 min · backend unit ~4 min |

---

## Sampling Rate

- **After every task commit:** in-scope suites by path at `GSD_VITEST_MAX_WORKERS=2`, plus
  `npx tsc --noEmit -p tsconfig.app.json`
- **After every plan wave:** full count gate **plus** the numstat deletion checks (below)
  **plus** `pytest backend/tests/unit -q`
- **Before `/gsd:verify-work`:** full suites green, every source fence green, tsc at the
  pre-existing baseline (**33** at Phase 196 close — re-derive, do not inherit)
- **Max feedback latency:** ~60 seconds per task

### ⚠ How to read a RED gate — non-negotiable procedure

1. Take failing filenames from the gate's **own persisted JSON** *before any re-run*.
2. Check each against `git diff --numstat <base> HEAD` and `git status --short`.
3. **Do not touch the cap.** `GSD_VITEST_MAX_WORKERS=2` stands, but it does **not** fix
   SEED-171's flake — that causal claim is refuted (CLAUDE.md CORRECTION 2026-08-17).
4. ⚠ **`WorkflowBuilderPage.canvas.test.tsx` is BOTH a SEED-171 flaky suite AND a suite this
   phase extends.** A red run on it is genuinely ambiguous. If it is in the diff it is **not**
   provably a flake. Say *"provably unmodified"*, never *"fine"*.
5. ⚠ **A red gate is sometimes REAL** — `196-08` hit **249** real failures from missing `@/lib/api`
   mock exports. D-13 adds a *type*, not a runtime export, so that trigger should not fire; if any
   plan adds a runtime export to `api.ts`, budget one mock line per mounting suite.

---

## Per-Task Verification Map

⚠ **This table is deliberately NOT duplicated here.** Every task in the eleven plans already carries
its own `<acceptance_criteria>` and `<automated>` command, verified present on **every** task by
`gsd-plan-checker` (2026-08-18). Re-typing ~28 rows into a second home would create exactly the
drift this project keeps paying for — *"a second, different answer to one question."*

**The map lives in the plans.** Read `197-01-PLAN.md` … `197-11-PLAN.md`.

| Plan | Wave | Tasks | depends_on | Requirement |
|---|---|---|---|---|
| `197-01` | 1 | 3 | — | AUTH-02 · **`files_modified: []` by design** |
| `197-02` | 2 | 3 | 01 | AUTH-02 · backend readiness + D-14 fence |
| `197-03` | 2 | 2 | 01 | AUTH-02 · `decisionsVocabulary.ts` |
| `197-04` | 2 | 2 | 01 | AUTH-02 · `terminalEmitSlug` |
| `197-05` | 2 | 2 | 01 | AUTH-02 · `setName` |
| `197-06` | 2 | 3 | 01 | AUTH-02 · `api.ts` type + hook thread |
| `197-07` | 3 | 3 | 03,04,05,06 | AUTH-02 · `DecisionsList` |
| `197-08` | 4 | 3 | 07 | AUTH-02 · `DraftArrivalCard` |
| `197-09` | 5 | 3 | 08,06 | AUTH-02 · the page mount |
| `197-10` | 6 | 2 | 09 | AUTH-02 · D-19 header + pin disposition |
| `197-11` | 7 | 3 | 10 | AUTH-02 · pins, ledger, close-out |

*Status is tracked by `/gsd:execute-phase`, not here.*

---

## Requirements → Test Map

| Req / Decision | Behaviour | Type | Command | Exists? |
|---|---|---|---|---|
| SC#2 · D-05 | Pre-draft describe screen byte-unchanged (6 states) | characterization | `npx vitest run src/pages/WorkflowBuilderPage.preDraft.baseline.test.tsx` | ✅ **exists, predates by 4 phases** |
| SC#2 · D-05 | Loose door byte-unchanged | characterization | `npx vitest run src/components/workflows/WorkflowDoorSwitch.baseline.test.tsx` | ✅ exists |
| SC#2 · D-05 | `git diff --numstat <base> HEAD -- <both baselines>` deletions == 0 | source | shell, every wave merge | ❌ W0 declares |
| SC#1 · D-07 | Exactly 5 rows, always, same order | unit | new list suite | ❌ W0 |
| SC#1 · D-07 | Each row renders its CURRENT answer off the definition | unit | new list suite | ❌ W0 |
| SC#1 · D-03 | Answering a row writes through the store; re-render agrees | unit | `builderStore.test.ts` + list suite | ⚠ partly (rows 1-3 shipped) |
| D-02 | `SeedReceipt.tsx` byte-unchanged | source | `git diff --numstat … SeedReceipt.tsx` → `0 0` | ❌ W0 |
| D-13 ⭐ | **readiness ABSENT ⇒ NO positive verdict rendered anywhere** | unit | list suite | ❌ W0 |
| D-13 | readiness `"missing"` ⇒ the gate's own sentence, character-identical | unit | list suite | ❌ W0 |
| D-13 | `/generate` success dict carries the key; failure arms do not | unit | `pytest -k generate_readiness` | ❌ W0 |
| D-09 ⭐ | Every string an imported identifier — no literal sentence in the component | source | `?raw` sweep (`SeedReceipt.test.tsx` idiom) | ❌ W0 |
| D-14 ⭐ | Advertised-but-not-asked == the allowlist | unit | `pytest test_workflow_authoring_requirement.py -k advertised` | ❌ W0 |
| D-14 ⭐ | Accepted-but-never-sent == the allowlist (**RED on `template_asset_id`**) | unit | same | ❌ W0 |
| D-14 | Positive control — a synthetic extra field IS reported | unit | same | ❌ W0 |
| D-11 | The publish gauntlet is byte-unchanged | source | `git diff --numstat … publish_service.py` → `0 0` | ❌ W0 |
| layout ⭐ | `graphColumn` has exactly THREE children (a 4th strands the graph at 0 px) | unit | `WorkflowBuilderPage.canvas.test.tsx` | ⚠ extend |
| snapshot | Post-arrival edits do not rewrite the card's past-tense sentences | unit | `WorkflowBuilderPage.canvas.test.tsx` | ⚠ extend |
| D-15 | **`slug` is NEVER written** | unit | `builderStore.test.ts` | ❌ W0 |
| row 5 | `terminalEmitSlug` — null when no emit; last by `phase_index` when several | unit | `soulData.test.ts` | ❌ W0 |

### Gated suites already pinned (pins re-derive from `scripts/vitest-count-gate.cjs`)

`WorkflowBuilderPage.preDraft.baseline.test.tsx` · `WorkflowDoorSwitch.baseline.test.tsx` ·
`WorkflowBuilderPage.describe.test.tsx` · `WorkflowBuilderPage.header.test.tsx` ·
`WorkflowBuilderPage.canvas.test.tsx` · `SeedReceipt.test.tsx` · `builderStore.test.ts` ·
`useTemplateFirstDraft.test.tsx` · `definitionOps.test.ts` · `phaseVocabulary.test.ts` ·
`soulData.test.ts` · `DescribeKbPicker.test.tsx` · `DescribeTemplateRow.test.tsx` ·
`PhaseFormPanel.test.tsx` · `WorkflowDoorSwitch.test.tsx`

⚠ **New suites under `src/pages` need BOTH gate knobs** (named files only, no directory entry);
under `src/components/workflows` the directory entry runs them and only a BASELINE pin is needed.
**Put the new components under `src/components/workflows`** — one knob, and it is where every
sibling lives.

⚠ `builderStore.test.ts` sweeps its source for the API-client specifier and **fires on PROSE too** —
a comment mentioning the client will red it.

---

## Wave 0 Requirements

- [ ] ⭐ **`WorkflowBuilderPage.preDraft.baseline.test.tsx` run GREEN at the base SHA, SHA recorded** —
      SC#2 / D-05. **FIRST plan, before any source edit.** 188.1's lesson is binding: a baseline
      taken after the first edit proves nothing. ⚠ The file **already exists and predates by four
      phases** — do NOT author a new one.
- [ ] numstat deletion criterion declared for both baselines (D-05), `SeedReceipt.tsx` (D-02) and
      `publish_service.py` (D-11)
- [ ] `DecisionsList.test.tsx` — five rows, their answers, their writes, the readiness three-arm read
- [ ] `DraftArrivalCard.test.tsx` — ONE card; `SeedReceipt` composed unmodified; graphColumn child count
- [ ] `decisionsVocabulary.test.ts` — character-identity + the `?raw` no-literal-sentence sweep **with a
      positive control** (a fence swept against an empty set passes green while defending nothing)
- [ ] backend `test_workflow_authoring_requirement.py` — D-14 halves A and B + the synthetic positive control
- [ ] backend — `/generate` success dict carries `readiness`; the four failure arms do not
- [ ] `soulData.test.ts` — `terminalEmitSlug`
- [ ] `builderStore.test.ts` — `setName` (if taken): writes `name`, never `slug`, arms `dirty`,
      bails outside `drafted`, untracked
- [ ] Gate pins for every new suite (BASELINE; **plus TARGETS if any lands under `src/pages`**)

**Framework install:** none needed.

---

## Manual-Only Verifications — G-4 lived-experience rows

**G-4 binds; these are defined at scope time, not post-hoc.**

⚠ **Sketch 174's hardest-won lesson governs every row: geometry proves composition; only looking
proves appearance.** Three pages of green assertions did not notice every page rendered in LIGHT
mode, nor that the header contradicted the card. **Screenshot / look — do not only measure.**

| Row | "I'd recognise failure here" | Method |
|---|---|---|
| **U1 — the arrival moment** | I describe a workflow, press the CTA, and what lands is **ONE card of about four lines** — not two stacked cards, not a wall. The graph is still the biggest thing on screen | Operator, live. ⚠ Also **below ~900 px**: 662 px of chrome left the graph 25 px at a 700 px column |
| **U2 — the fast door still feels fast** | The describe screen asks me for **nothing new**. No extra control, no extra required field, no new gate | Operator, live. ⚠ **BOTH doors** — loose (`WorkflowDoorSwitch`) and govern (`WorkflowBuilderPage`) |
| **U3 — a decision is answerable and the answer sticks** | I change the knowledge base; the header agrees instantly. I reload the draft and my answer is still there | Operator, live + a DB read of the definition JSONB |
| **U4 — the requirement row, on ≥ 2 providers** ⭐ | On one provider the row shows something durable; on another it names one run's parameters and I can see and fix that **in the row** | ⚠ **MUST NOT be scored on one provider** — measured anthropic **0/5**, openai **5/5** (`193.2-FREQUENCY.md` §6c) |
| **U5 — row and header do not contradict** | The card says "Vendor contracts" and the header strip says the same. Never two answers to one question | Operator, live. ⚠ the exact defect sketch 174 shipped and caught only by looking |
| **U6 — the name row is the name's first honest display** | The row shows my workflow's **name**; after I edit it, what I typed is what I see — not `northwind-qbr-fa65a43c` | Operator, live. ⚠ Drive **after** the Q2 disposition, not before |
| **U7 — dismissal is an offer, not a wall** | I press ✕, the card goes, the graph takes the space. Nothing lost, nothing saved | Operator, live |
| **U8 — the deliverable row leads somewhere real** | The deliverable row's action opens the step that actually produces the file, on the field that decides what it says | Operator, live (**option (ii) only**) |
| **U9 — legibility of the 11 px controls** ⚠ | If rows route me to the header controls I can actually **read** them, and `AI-proposed` reads beside a real sentence | Operator judgement. ⚠ Inherits **193.2-09's owed sliver** — that mark shipped with no browser UAT |

### 4-axis scoreboard obligation — stated, not assumed

| Axis | This phase's obligation |
|---|---|
| **Cross-provider** | ⚠ **Split.** (a) **U4 is a generation-quality row: ≥ 2 providers minimum — anthropic + openai**, the two the 0/5-vs-5/5 contrast was measured on; google recommended as a third. (b) **The surface itself must be shown provider-independent** — one row proving the five questions and five verdicts are byte-identical across a provider switch. That is the honest proof of D-09's "no provider call". |
| **Multi-tool** | ⛔ **Not applicable** — no tool call on this path. **Recorded, never silently omitted.** |
| **Parallel-thread** | ⛔ **Not applicable** — authoring is not a run. **Recorded, never silently omitted.** |
| **Long-message** | ⚠ **Applicable, worth one row** — a very long describe text yields a long `business_requirement` and a long name. Does row 3's (or row 4's) 240 px truncated input become unusable? A real failure mode, not a formality. |

⚠ **Derive the roster from `MODEL_CAPABILITIES`; never re-type it.** Measured this session: 8
provider groups / 61 models. Prefer a **registry-backed** id per provider — an id absent from the
registry resolves `capability_source=inferred` and silently loses `emit_tier`, so the row would
measure a weaker configuration than the one that ships.

⚠ **Rows may be blocked, never silently omitted.** A provider with no key is recorded ⛔ with the
reason and the blocking id. **A scoreboard that lists only what passed is not a scoreboard.**

---

## Validation Sign-Off

Checked against the eleven plans by `gsd-plan-checker`, 2026-08-18 (verdict:
**VERIFICATION PASSED**, no blockers). ⚠ **`wave_0_complete` stays `false` — Wave 0 runs at
EXECUTION, not at planning.** Ticking it here would be the kind of paperwork-ahead-of-reality this
project has been bitten by.

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [~] Feedback latency < 60s — ⚠ **TWO ACCEPTED EXCEPTIONS, recorded rather than waved through:**
      `197-01` task 2 and `197-11` task 1 each use the full count gate (~6-9 min) as their sole
      automated verify. That is *literally their purpose* — they are the phase's opening and closing
      baseline records, not dev-loop tasks. Every other task samples in-scope suites by path.
- [ ] D-05 baseline run GREEN at the base SHA **before any source edit**, SHA recorded
      — ⚠ **EXECUTION-TIME. Plan `197-01`, wave 1, alone, `files_modified: []`.**
- [x] Every source fence carries a positive control — verified across `197-02/03/04/05/07/08`
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-08-18 (plan-checker: VERIFICATION PASSED, 11 plans, 4 non-blocking
findings, 2 applied)
