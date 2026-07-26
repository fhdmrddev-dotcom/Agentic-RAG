---
phase: 184
slug: editable-canvas-live-structural-validation-round-trip
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-26
---

# Phase 184 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `184-RESEARCH.md` § Validation Architecture. Frontend-only phase —
> **zero backend change, zero migration**; the backend suite is not in this sampling loop.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 + `@testing-library/react` 16.3.2, jsdom 29, `vitest-axe` 0.1.0 |
| **Config file** | `frontend/vite.config.ts` (`test:` block) · setup `frontend/src/setupTests.ts` |
| **Quick run command** | `cd frontend && npx vitest run src/components/workflows src/pages/WorkflowBuilderPage.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/admin/revertByteIdentical.test.tsx` |
| **Full suite command** | `cd frontend && npm test` |
| **Type gate (DIFFERENTIAL)** | `cd frontend && npx tsc -b 2>&1 \| grep -c "error TS"` — **baseline 33 on `develop`**, must not increase (D-ITEM-183-01) |
| **Estimated runtime** | ~45 s quick · ~3 min full |

> `--reporter=basic` was **removed in vitest 4** — use `--reporter=json`.

---

## Sampling Rate

- **After every task commit:** run the **quick run command**. 424 tests must not regress.
- **After every plan wave:** `npm test` (full) + `npx tsc -b 2>&1 | grep -c "error TS"` ≤ 33
  + during Wave 0 only: `git diff --exit-code -- 'frontend/src/**/__snapshots__/*'`
- **Before `/gsd:verify-work`:** full suite green, then the 5 G-4 live rows driven by the operator.
- **Max feedback latency:** ~60 seconds (quick run).

---

## Wave 0 Count Pin (D-184-08 — the mechanical half)

Measured this session on `develop`, all green. **This table IS the pin** — the Phase-177 lesson
is that a failures-only differential cannot see a *deleted* test, so counts are pinned per file,
not just failures.

| File | Tests |
|---|---|
| `canvasModel.fixtures.test.ts` | 100 |
| `canvasModel.purity.test.ts` | 69 |
| `phaseVocabulary.test.ts` | 42 |
| `WorkflowCanvas.test.tsx` | 31 |
| `canvasModel.test.ts` | 26 |
| `PublishGauntlet.test.tsx` | 24 |
| `WorkflowBuilderPage.canvas.test.tsx` | 22 |
| `PhaseFormPanel.test.tsx` | 19 |
| `WorkflowBuilderPage.test.tsx` | 15 |
| `PhaseSpineGraph.test.tsx` | 14 |
| `soulData.test.ts` | 14 |
| `WorkflowDoorSwitch.test.tsx` | 13 |
| `PhaseSpine.test.tsx` | 11 |
| `deriveTier.test.ts` | 9 |
| `WorkflowSoul.test.tsx` | 8 |
| `revertByteIdentical.test.tsx` | 7 |
| **TOTAL** | **424 / 424 passing, 0 failing** |

Reproduce mechanically:

```bash
cd frontend
npx vitest run src/components/workflows src/pages/WorkflowBuilderPage.test.tsx \
  src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/admin/revertByteIdentical.test.tsx \
  --reporter=json --outputFile=../.planning/tmp/vitest-after.json
node -e "const r=require('../.planning/tmp/vitest-after.json');
  console.log('total',r.numTotalTests,'failed',r.numFailedTests);
  for(const s of r.testResults) console.log(s.name.replace(/.*[\\\\/]/,''), s.assertionResults.length)"
```

**Gate:** total ≥ 424 · failed = 0 · **no per-file count decreases**.
Feature waves may *increase* counts; **Wave 0 must not change any of them.**

**Carve-out:** the D-184-07 icon-swap commit (`llm_agent` → `compass`,
`llm_batch_agents` → `handshake`) **must** edit `soulData.test.ts:132-133`, which pins
`"robot"` / `"busts-in-silhouette"`. D-184-08's zero-assertion-edit gate is scoped to the
**extraction** commits with the icon commit explicitly carved out.

---

## Per-Requirement Verification Map

Task IDs are assigned by the planner; this map is the contract each task's
`<acceptance_criteria>` must land on.

| Req | Behaviour | Wave | Test Type | Automated Command | File Exists | Status |
|-----|-----------|------|-----------|-------------------|-------------|--------|
| R1 | add/insert/reorder/delete → `phase_index` exactly `[0..n-1]`, no dup/hole | 0 | pure unit | `npx vitest run src/components/workflows/definitionOps.test.ts` | ❌ W0 | ⬜ pending |
| R1 | insert-at-middle on the 5-phase `eval_coverage` shape increments every downstream index by exactly 1 | 0 | pure unit | same | ❌ W0 | ⬜ pending |
| R2 | `fromCanvas(toCanvas(p), p)` ≡ `[...p].sort(byIndexThenSlug)` **by reference** (`toBe` per element), over the committed dump + generated shapes | 1 | property | `npx vitest run src/components/workflows/canvasModel.roundtrip.test.ts` | ❌ W1 | ⬜ pending |
| R2 | `fromCanvas` reads no `node.position`/`node.data`, never renumbers, is pure | 1 | source-grep (`?raw`) | extend `canvasModel.purity.test.ts` | ✅ extend | ⬜ pending |
| R3 | no migration file added by this phase | 0 | fs/git check | `git diff --name-only <base>..HEAD -- supabase/migrations \| wc -l` → 0 | ❌ new | ⬜ pending |
| R3 | serialized create/PATCH body contains no `position`/`x`/`y`/`layout` key | 2 | component (mocked api) | extend `WorkflowBuilderPage.canvas.test.tsx`, reuse `forbiddenKeysIn` (`canvasModel.purity.test.ts:35`) | ✅ extend | ⬜ pending |
| R3 | a `dy` nudge issues **zero** network requests | 2 | component (fetch call-count 0) | new canvas editing suite | ❌ W2 | ⬜ pending |
| R4 | `⌘Z`/`Ctrl+Z`/`⇧⌘Z`/`Ctrl+Y` step through structural edits | 0 | store unit + component | `npx vitest run src/components/workflows/builderStore.test.ts` | ❌ W0 | ⬜ pending |
| R4 | a nudge leaves `pastStates.length` unchanged | 0 | store unit | same | ❌ W0 | ⬜ pending |
| R4 | undo stack holds the definition slice only (`partialize`) — a `verdicts` set pushes nothing | 0 | store unit | same | ❌ W0 | ⬜ pending |
| R4 | two config edits within 500 ms coalesce to ONE entry; a structural edit pushes immediately | 0 | store unit + fake timers | same | ❌ W0 | ⬜ pending |
| R5 | canvas selection opens the **same** `PhaseFormPanel`; `onClose` stays required | 2 | component + `tsc` | existing `WorkflowBuilderPage.canvas.test.tsx` + `tsc -b` | ✅ extend | ⬜ pending |
| R5 | per-type field conditioning unchanged; **no second form component** | 2 | component + source-grep | `PhaseFormPanel.test.tsx` (19, unmodified) + new "exactly one form component" grep | ✅ / ❌ new | ⬜ pending |
| R6 | a session issues exactly one `POST` then `PATCH`; no new endpoint; saved wording implies no publish | 2 | component (mocked api call log) | new editing-session suite | ❌ W2 | ⬜ pending |
| R7 | two edits, responses resolved **out of order** → the newer verdict renders | 1 | component + fake timers + deferreds | `npx vitest run src/hooks/useLiveValidation.test.tsx` | ❌ W1 | ⬜ pending |
| R7 | rejected/timed-out `/validate` ⇒ no node clean, publish stays blocked | 1 | component | same | ❌ W1 | ⬜ pending |
| R7 | `grounding_unavailable` renders as "we could not check", never `ok` | 1 | component | same | ❌ W1 | ⬜ pending |
| R7 | 422 vs network produce different wording, same behaviour; the 422 body is **not shown** | 1 | component | same | ❌ W1 | ⬜ pending |
| R8 | marks change when **only the server response** changes, local state identical | 1 | component | new verdict-render suite | ❌ W1 | ⬜ pending |
| R8 | an unrecognised code renders (as `error`), never dropped | 1 | component | same | ❌ W1 | ⬜ pending |
| R8 | a `phase: null` verdict appears in the tray | 1 | component | same | ❌ W1 | ⬜ pending |
| R9 | 3-`incomplete`/0-`error` fixture renders **zero** destructive-token elements; two-count tray wording present before expansion | 1 | component (token scan) | same | ❌ W1 | ⬜ pending |
| R10a | an orphaning delete is refused with a stated reason; a non-orphaning delete proceeds | 0 | pure unit | `definitionOps.test.ts` | ❌ W0 | ⬜ pending |
| R10b | a stranding add choice is offered **disabled with a reason** | 0/2 | pure unit + component | `definitionOps.test.ts` + picker suite | ❌ W0/W2 | ⬜ pending |
| R10 | neither refusal consults `/validate` | 2 | source-grep + fetch call-count 0 | picker/refusal suite | ❌ W2 | ⬜ pending |
| R11 | tool options come from the bundle response (change the mock ⇒ options change); **no free-text box** | 2 | component (mocked `getGroundingBundle`) | new rails suite | ❌ W2 | ⬜ pending |
| R11 | a `degraded` bundle renders the could-not-load message, never an empty-but-normal picker | 2 | component | same | ❌ W2 | ⬜ pending |
| R11 | a 🔒 gate row has **no removal control in the DOM**; a named-but-unregistered tool renders struck through | 2 | component | same | ❌ W2 | ⬜ pending |
| R11 | no `grounding_mode` anywhere (185's field, not 184's) | 2 | source-grep | existing `WorkflowCanvas.test.tsx:427` + extend to panel/store | ✅ extend | ⬜ pending |
| R12 | at 900 px: exactly one bottom-edge region, no horizontal overflow | 2 | component (structural) + **live G-4** | new composition suite (jsdom cannot measure real overflow) | ❌ W2 | ⬜ pending |
| R12 | disabled publish's accessible name / adjacent text contains the first verdict message | 2 | component | same | ❌ W2 | ⬜ pending |
| R12 | no net-new header band | 2 | DOM structure assertion | same | ❌ W2 | ⬜ pending |
| D-14 | flag-off Builder byte-identical for every audience incl. operators | 0→2 | component | `revertByteIdentical.test.tsx` (7) + new "panel without `rails` prop is unchanged" assertion | ✅ extend | ⬜ pending |
| D-184-08 | Wave 0 assertion-free: per-file counts pinned, canvas snapshot byte-unchanged, `tsc` errors ≤ 33 | 0 | script gate | JSON-reporter script above + `git diff --exit-code -- 'src/**/__snapshots__/*'` + `tsc` count | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/components/workflows/definitionOps.test.ts` — R1, R10a, R10b (pure, no React, no store)
- [ ] `frontend/src/components/workflows/builderStore.test.ts` — R4 (`zundo` temporal store + fake timers; also proves research assumption A3 on `handleSet`)
- [ ] `frontend/src/components/workflows/PhaseNodeCard.test.tsx` — renders with **zero `@xyflow` import**, outside a `ReactFlowProvider` (D-184-06's whole point) + exceeding the max-2 badge tuple is a **typecheck error**
- [ ] `scripts/vitest-count-gate.(sh|cjs)` — the JSON-reporter per-file count differential (D-184-08's mechanical half)
- [ ] Extend `frontend/src/components/workflows/canvasModel.purity.test.ts` — `fromCanvas` purity + no-edge-read + no-renumber guards
- [ ] `frontend/src/hooks/useLiveValidation.test.tsx` — R7 (lands Wave 1, but the deferred-promise helper is shared infrastructure — author it once)
- [ ] `scripts/dump-workflow-corpus.(sh|py)` + a committed `corpusDump.json` — D-184-17. **⚠ Requires a running local Supabase** (`supabase start`); one-off, human-run, records its own provenance (date, row count, query)
- [ ] `frontend/src/components/workflows/__fixtures__/shapeGenerator.ts` — the hand-rolled generator (**no new dependency**; `zundo` is the only net-new dep)

*Framework install: none needed — vitest, RTL, jsdom and vitest-axe are all present.*

> **Do NOT touch `__fixtures__/canvasFixtures.ts`.** Its header docblock carries an acceptance
> guard that FORBIDS live-read tokens; D-184-17's dump is a **separate** committed artifact for
> the round-trip property suite. `canvasFixtures.ts` stays as-is for the snapshot suite.

---

## Manual-Only Verifications (the 5 G-4 live rows)

| Row | Behaviour | Req | Automatable? | Why Manual | Test Instructions |
|-----|-----------|-----|--------------|------------|-------------------|
| **U-1** | Empty draft → first step → blocked publish | R1, R12, D-184-15 | **Partly** | Mechanics (add works, publish disabled, reason named) are component-testable. *"Reads as an invitation, not a broken screen"* is an operator judgement on a rendered screen | Open a new draft on the flagged canvas. Confirm: no tray, no marks, publish disabled reading *"Add a step to get started"*. Add one step — the live loop takes over |
| **U-2** | Delete a middle step | R1, R10a, D-184-12 | **Mostly** — the **drag** half is not | d3-drag is unusable in jsdom | Build 4 steps. **Drag** step 3 to position 2 (pointer path). Then delete a middle step; confirm re-stitch, renumber, *"Removed X · N steps renumbered"* with inline **Undo**. Attempt an orphaning delete → refusal names its reason |
| **U-3** | Mid-build never reads as failure | R9 | **Partly** | *"Zero destructive-token elements"* is a mechanical scan; *"does not look alarming"* is not | Reach a 3-`incomplete` / 0-`error` state. Confirm dashed grey `○` marks only, no red anywhere, tray summary reads *"N problems · N things to finish"* before expansion |
| **U-4** | Save → reload → nothing lost or invented | R2, R3, R6 | **No** | Needs a real backend, a real Supabase row, a real hard reload, and real `localStorage` persistence across it. jsdom cannot reload | Author ≥4 steps incl. config edits + a `dy` nudge. Save. **Hard reload.** Confirm every step/config survives, no `position`/`x`/`y` in the stored JSONB, and the nudge is restored from `localStorage` |
| **U-5** | Flag off = yesterday's Builder (incl. an operator account) | D-14, D-181-01 | **Partly** | The operator-account audience path and *"no editing affordance reachable anywhere"* need the real Control-Room flip | Flip `visual_workflow_canvas` off in `/admin`. Reload. Confirm on **both** a normal user and an **operator** account: no toggle, no canvas, no editing affordance, byte-identical Builder |

---

## Cross-Provider / SC#10

**Not applicable.** SC#10's 4-axis bandwidth (cross-provider × multi-tool × parallel-thread ×
long-message) governs phases touching streaming, the agent loop, provider routing, or chat UI
state. Phase 184 is **authoring-surface only** — no run stream, no provider call, no agent loop.
The ROADMAP flags record this explicitly (`no SC#10`).

---

## Validation Sign-Off

- [ ] All tasks have an `<automated>` verify or a named Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without an automated verify
- [ ] Wave 0 covers all ❌-MISSING references above
- [ ] No watch-mode flags in any committed command
- [ ] Feedback latency < 60 s (quick run)
- [ ] The 5 G-4 live rows executed by the operator before `/gsd:verify-work`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
