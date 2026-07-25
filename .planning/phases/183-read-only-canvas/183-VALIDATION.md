---
phase: 183
slug: read-only-canvas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-25
---

# Phase 183 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `183-RESEARCH.md` → `## Validation Architecture`. The Per-Task
> Verification Map is filled by the planner once task IDs exist.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.0 + `@testing-library/react` 16.3.2, jsdom 29 (+ `vitest-axe`, globally extended) |
| **Config file** | `frontend/vitest.config.ts` (`unplugin-icons` + `@iconify-json/fluent-emoji` wired in BOTH vite and vitest configs — 3D glyphs resolve in tests) |
| **Quick run command** | `cd frontend && npx vitest run src/components/workflows` |
| **Full suite command** | `cd frontend && npm test` (≈ 268 s) |
| **Type/build gate** | `cd frontend && npx tsc -b` — ⚠ `tsc -b` ≠ `tsc --noEmit` (v3.3 lesson); `npm run build` = `tsc -b && vite build` |
| **Baseline (2026-07-25)** | **33 failed / 1844 passed of 1877**; 10 failed files of 205; **flaky, 28–35 range** — grade on a failing-test **name-set differential** plus a **test-count guard** (the 177 lesson), never on "failures only" |
| **Backend half (C-1 parity only)** | `cd backend && venv/Scripts/python -m pytest tests/unit/test_183_skip_parse_parity.py -q` |
| **Estimated runtime** | seconds for the phase's own files; ~268 s full suite |

**Framework install required:** none. Vitest, jsdom, Testing Library, `vitest-axe`, and the icon
plugins are all installed. The ONE net-new dependency is `@xyflow/react` ^12.11.2 (MIT, slopcheck
`[OK]`, no postinstall) — installing it IS a Wave-0 task.

**jsdom + xyflow:** `@xyflow/react` needs `ResizeObserver` and measured dimensions. The official
four-mock recipe goes in a **file-local** helper (`src/test-utils/mockReactFlow.ts`), imported by the
component suites only — **NOT** into `setupTests.ts`. The global-setup route would perturb the
already-flaky 1877-test baseline.

---

## Sampling Rate

- **After every task commit:** `cd frontend && npx vitest run src/components/workflows` (the phase's
  own files — seconds, not minutes)
- **After every plan wave:** `cd frontend && npm test` + `cd frontend && npx tsc -b` — capture the
  failing-test **name set** AND the **total count**; diff against the recorded baseline
  (33 failed / 1877 total). A new name in the set or a drop in the total is a regression even if the
  failure count looks flat.
- **Before `/gsd:verify-work`:** full-suite differential green (no new failures, no test-count
  regression) **plus** all four G-4 rows driven live.
- **Max feedback latency:** < 30 s for the per-task workflows set.
- **No SC#10:** this is a static projection — no streaming, no provider routing, no run state. The
  4-axis cross-provider scoreboard does not apply (ROADMAP flag confirms).

---

## Per-Task Verification Map

> **20 tasks across 7 plans** (183-01 ×3, 183-02 ×3, 183-03 ×2, 183-04 ×3, 183-05 ×3, 183-06 ×3,
> 183-07 ×3). **Every task carries an `<automated>` verify command** — Dimension 8 PASS, and there is
> no run of 3 consecutive tasks without one. Status flips during execution.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 183-01-01 | 01 | 1 | CANVAS-01 | T-183-SC | Audited MIT dep, no postinstall; never the frozen v11 `reactflow` name | build gate | `cd frontend && npx tsc -b && npx vite build` | ✅ (toolchain) | ⬜ pending |
| 183-01-02 | 01 | 1 | CANVAS-01 | T-183-05 | Third-party CSS imported above `@tailwind base` so app tokens still win the cascade | build + asset grep | `cd frontend && npx vite build && grep -l "react-flow" dist/assets/*.css` | ✅ (toolchain) | ⬜ pending |
| 183-01-03 | 01 | 1 | CANVAS-01 | — | jsdom mocks stay file-local; `setupTests.ts` untouched (baseline not perturbed) | unit (spike) | `cd frontend && npx vitest run src/test-utils/handleSpike.test.tsx` | ❌ W0 | ⬜ pending |
| 183-02-01 | 02 | 1 | CANVAS-01 | T-183-01, T-183-06 | Total resolvers over unknown type / policy / kind; no fetch, no markup construction | unit (TDD) | `cd frontend && npx vitest run src/components/workflows/phaseVocabulary.test.ts` | ❌ W0 | ⬜ pending |
| 183-02-02 | 02 | 1 | CANVAS-01 | T-183-07 | ONE shared case table; client parse ≡ backend prefix-slice semantics (C-1) | unit + type gate | `cd frontend && npx tsc -b && npx vitest run src/components/workflows/phaseVocabulary.test.ts -t "parity"` | ❌ W0 | ⬜ pending |
| 183-02-03 | 02 | 1 | CANVAS-01 | T-183-07 | The Python half of the parity pin — the control that would have caught C-1 | unit (pytest) | `cd backend && venv/Scripts/python -m pytest tests/unit/test_183_skip_parse_parity.py -q` | ❌ W0 | ⬜ pending |
| 183-03-01 | 03 | 1 | CANVAS-01 | T-183-03 | Null context is FAIL-CLOSED; provider holds no state and fetches nothing | unit (component) | `cd frontend && npx vitest run src/providers/EffectiveFeaturesProvider.test.tsx` | ❌ W0 | ⬜ pending |
| 183-03-02 | 03 | 1 | CANVAS-01 | T-183-03, T-183-04 | Exactly one `GET /features`; nav map + D-04 bounce byte-unchanged; 181 gate green **unmodified** | regression | `cd frontend && npx tsc -b && npx vitest run src/components/admin/revertByteIdentical.test.tsx src/providers/EffectiveFeaturesProvider.test.tsx` | ✅ (existing gate) | ⬜ pending |
| 183-04-01 | 04 | 2 | CANVAS-01 | T-183-01, T-183-08, T-183-09 | Glyph via build-time bundled SVG components; the false parity docblock deleted; the ⌥ reveal picks between two plain strings (constructs no markup) and reads the NON-throwing optional accessor, so a provider-less render cannot crash | regression + component | `cd frontend && npx tsc -b && npx vitest run src/components/workflows/PhaseSpine.test.tsx && npx vitest run src/components/workflows/PhaseSpineGraph.test.tsx -t "technical names"` | ✅ (existing) + ⚠ net-new `technical names` block in `PhaseSpineGraph.test.tsx` | ⬜ pending |
| 183-04-02 | 04 | 2 | CANVAS-01 | T-183-09 | All FIVE importers repointed in one commit; no re-export shim | regression | `cd frontend && npx tsc -b && npx vitest run src/components/workflows/PhaseSpineGraph.test.tsx src/components/workflows/PhaseFormPanel.test.tsx` | ⚠ exists — `:94-96` **must be migrated** | ⬜ pending |
| 183-04-03 | 04 | 2 | CANVAS-01 | T-183-09 | One-home guard extended to the 4th consumer; the pre-existing RED resolved | regression | `cd frontend && npx vitest run src/components/workflows/PhaseSpine.test.tsx src/components/workflows/soulData.test.ts` | ⚠ `soulData.test.ts:121-132` **RED at HEAD** | ⬜ pending |
| 183-05-01 | 05 | 2 | CANVAS-01 | T-183-04, T-183-06, T-183-07 | Index-lookup adjacency (no phantom edge); honest broken-ref stub; zero network | unit (TDD) | `cd frontend && npx vitest run src/components/workflows/canvasModel.test.ts` | ❌ W0 | ⬜ pending |
| 183-05-02 | 05 | 2 | CANVAS-01 | T-183-06 | 14-fixture SC#4 sweep; inputs TRANSCRIBED from checked-in migrations, never read live | unit (snapshot) | `cd frontend && npx vitest run src/components/workflows/canvasModel.fixtures.test.ts` | ❌ W0 | ⬜ pending |
| 183-05-03 | 05 | 2 | CANVAS-01 | T-183-04, T-183-10 | Determinism, non-mutation, no `position`/`x`/`y`/`layout` key in the definition, no DOM read | unit (purity + `?raw`) | `cd frontend && npx vitest run src/components/workflows/canvasModel.purity.test.ts` | ❌ W0 | ⬜ pending |
| 183-06-01 | 06 | 3 | CANVAS-01 | T-183-01, T-183-08 | Plain React text children only; no new icon slug (D-183-14 fence); no interactive element inside a node | type gate + unit | `cd frontend && npx tsc -b && npx vitest run src/components/workflows/canvasModel.test.ts` | ✅ (from 183-05) | ⬜ pending |
| 183-06-02 | 06 | 3 | CANVAS-01 | T-183-11, T-183-04 | `showInteractive={false}` + the six read-only flags; empty state mounts NO `<ReactFlow>` | build gate | `cd frontend && npx tsc -b && npx vite build` | ✅ (toolchain) | ⬜ pending |
| 183-06-03 | 06 | 3 | CANVAS-01 | T-183-11, T-183-06 | Drag-free DOM, no lock button, exactly one tab stop per node, axe clean, broken-ref marker | component (jsdom) | `cd frontend && npx vitest run src/components/workflows/WorkflowCanvas.test.tsx` | ❌ W0 | ⬜ pending |
| 183-07-01 | 07 | 4 | CANVAS-01 | T-183-03, T-183-12 | Strict `=== true` + `!loading` + null-fail-closed gate; no save/persist path touched | regression | `cd frontend && npx tsc -b && npx vitest run src/pages/WorkflowBuilderPage.test.tsx` | ✅ (existing) | ⬜ pending |
| 183-07-02 | 07 | 4 | CANVAS-01 | T-183-03, T-183-12 | Flag-off VANISH proven in 5 render variants; looking mints no `workflow_definitions` row | component (jsdom) | `cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx` | ❌ W0 | ⬜ pending |
| 183-07-03 | 07 | 4 | CANVAS-01 | T-183-SC | 181 scope-freeze assertions byte-identical (comments only); lazy chunk measured (A6) | regression + build | `cd frontend && npx vitest run src/components/admin/revertByteIdentical.test.tsx && npx vite build` | ✅ (existing gate) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · `nyquist_compliant`/`wave_0_complete` flip during execution once Wave 0 tests exist and pass.*

### Threat reference key (registers live in each PLAN.md `<threat_model>`)

| ID | Category | What it names |
|----|----------|---------------|
| T-183-01 | Tampering | XSS via an authored `phase.name` / slug / declared skip target rendered into a node |
| T-183-02 | Elevation of Privilege | client-side authz bypass — the flag hide is cosmetic; `require_visible` / `require_canvas` are the wall |
| T-183-03 | Information Disclosure | a governed surface flashing pre-resolve, on a fetch blip, or with no provider mounted |
| T-183-04 | Tampering / Info Disclosure | canvas layout leaking into `workflow_definitions.definition` (Pitfall 3 / G-6) |
| T-183-05 | Tampering | third-party CSS entering the app cascade |
| T-183-06 | Denial of Service | a malformed definition crashing the projection or the render (totality is the control) |
| T-183-07 | Tampering | the client edge set diverging from `reachability.py`'s adjacency (C-1 / C-2) |
| T-183-08 | Tampering | SVG injection via a phase-type-derived icon path |
| T-183-09 | Repudiation | a stale in-code parity / extraction claim misleading a future reader |
| T-183-10 | Information Disclosure | a client-side call leaking definition content (there is none — zero network) |
| T-183-11 | Elevation of Privilege | `<Controls>`'s interactivity lock re-enabling dragging in two clicks (Pitfall 1) |
| T-183-12 | Tampering | opening a view mutating persisted state (D-183-04 / G-6) |
| T-183-SC | Tampering | supply chain on the one net-new dependency `@xyflow/react@12.11.2` |

### Research test map (source for the planner)

| Req / SC / Decision | Behaviour | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| **SC#1** | Nodes = phases; edges = `phase_index` flow + parsed `skip_to_phase`, via `@xyflow/react` | unit (pure) + component | `npx vitest run src/components/workflows/canvasModel.test.ts -t "edges"` | ❌ W0 |
| **SC#1** (branch edge) | A `skip_to_phase` fixture yields one skip edge to the resolved node | unit (pure) | `… -t "skip"` | ❌ W0 |
| **SC#2** | Pure projection; positions computed, never persisted | unit (purity + source-grep) | `npx vitest run src/components/workflows/canvasModel.purity.test.ts` | ❌ W0 |
| **SC#3a** | Nodes not draggable | component (DOM) | `npx vitest run src/components/workflows/WorkflowCanvas.test.tsx -t "drag-free"` | ❌ W0 |
| **SC#3b** | `node.id === phase.slug` | unit (pure) | `… -t "node id"` | ❌ W0 |
| **SC#4** | 4 canonical seeds + Starter Library + `eval_coverage` + empty + branching + broken-ref + index-gap ⇒ no dropped phase, no phantom edge | unit (snapshot over fixtures) | `npx vitest run src/components/workflows/canvasModel.fixtures.test.ts` | ❌ W0 |
| **D-183-03** | Flag off ⇒ toggle absent + no `.react-flow` root | component (DOM) | `npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx -t "flag off"` | ❌ W0 |
| **D-183-05** | Node click fires `onSelectNode(slug)` | component | `… -t "onSelectNode"` | ❌ W0 |
| **D-183-06** | Fallback title is a plain-language sentence; slug never on the face by default — on **both** views, with the slug still revealable via ⌥ | unit + component | `npx vitest run src/components/workflows/phaseVocabulary.test.ts` **and** `npx vitest run src/components/workflows/PhaseSpineGraph.test.tsx -t "technical names"` | ❌ W0 / ⚠ net-new block |
| **D-183-07** | Grounding badge derivation (strict/flag/open) + `llm_human_input` second badge only | unit | `… -t "grounding"` | ❌ W0 |
| **D-183-08** | ONE app-wide ⌥ state flips every node at once — and the **Spine reads the same state**, so both views resolve a phase's title identically in both modes (the G-6 tripwire) | component ×2 | `npx vitest run src/components/workflows/WorkflowCanvas.test.tsx -t "technical names"` **and** `npx vitest run src/components/workflows/PhaseSpineGraph.test.tsx -t "technical names"` | ❌ W0 (canvas) / ⚠ net-new block (spine) |
| **D-183-10** | Unresolvable skip renders an honest broken-reference stub, connected to no phase node | unit + component | `… -t "unresolvable"` | ❌ W0 |
| **D-183-11** | Zero-phase ⇒ named empty state, **no** `.react-flow`, no grid/controls/minimap, no ghost node | component | `… -t "empty"` | ❌ W0 |
| **D-183-12** | Same definition ⇒ byte-identical positions; source contains no DOM-read call | unit + source-grep | `npx vitest run src/components/workflows/canvasModel.purity.test.ts` | ❌ W0 |
| **D-183-13** | ONE glyph map + ONE `parseSkipTarget` in the tree; `PhaseSpineGraph` renders the 3D marks | source-grep + component | `npx vitest run src/components/workflows/PhaseSpine.test.tsx src/components/workflows/PhaseSpineGraph.test.tsx` | ⚠ exists, **must be updated** (`PhaseSpineGraph.test.tsx:94-96` breaks under the migration) |
| **D-183-15 / C-1** | Client parse ≡ `reachability.parse_skip_target` over the shared case table (**backend semantics authoritative** — operator-approved amendment) | unit ×2 (TS + Python) | `npx vitest run … -t "parity"` **and** `cd backend && venv/Scripts/python -m pytest tests/unit/test_183_skip_parse_parity.py` | ❌ W0 |
| **C-2** | Non-contiguous `phase_index` ⇒ exactly one sequential edge, matching `reachability.py:164`'s index **lookup** (no phantom `1→3`) | unit | `… -t "non-contiguous"` | ❌ W0 |
| **Pitfall 1** | No interactivity-lock button in the controls (`showInteractive={false}`) | component | `… -t "showInteractive"` | ❌ W0 |
| **181 gate** | `revertByteIdentical.test.tsx` scope-freeze assertions still pass **unmodified** | regression | `npx vitest run src/components/admin/revertByteIdentical.test.tsx` | ✅ exists — assertions stay untouched; only stale COMMENTS are corrected (183-07-03) |
| **a11y** | Rendered canvas has no axe violations; exactly one tab stop per node | component | `… -t "accessib"` | ❌ W0 |
| **G-6** | No `position` / `x` / `y` / `layout` key reaches a definition object | unit | in `canvasModel.purity.test.ts` | ❌ W0 |

---

## Wave 0 Requirements

- [ ] `npm i @xyflow/react@^12.11.2` in `frontend/` — the ONE net-new dep; then prove the toolchain
      with `npx tsc -b && npx vite build` **before** any component work (assumption A4) → **183-01-01**
- [ ] **Spike (≈5 min, assumption A1):** does a `<Handle>`-free custom node render edges? Render a
      2-node fixture with and without handles, count `.react-flow__edge`. This shapes `PhaseNode`
      → **183-01-03**
- [ ] `frontend/src/test-utils/mockReactFlow.ts` — the official four-mock jsdom helper
      (**file-local import, NOT `setupTests.ts`**) → **183-01-03**
- [ ] `frontend/src/components/workflows/__fixtures__/canvasFixtures.ts` — the D-183-09 corpus,
      transcribed from migrations **061 / 066 / 094** + `scripts/seed-pm-pack.py`, each entry citing
      its source `file:line`. **Transcribed, never read live** — two live reads on the same day
      disagreed (C-3) → **183-05-02**
- [ ] `frontend/src/components/workflows/__fixtures__/skipParseCases.json` — the C-1 parity table,
      read by BOTH the TS and the Python suite (requires `resolveJsonModule` — F-1) → **183-02-02**
- [ ] `frontend/src/components/workflows/canvasModel.test.ts` — SC#1 / SC#3b / SC#4, C-2, D-183-10
      → **183-05-01**
- [ ] `frontend/src/components/workflows/canvasModel.purity.test.ts` — SC#2, D-183-12, G-6 → **183-05-03**
- [ ] `frontend/src/components/workflows/canvasModel.fixtures.test.ts` — the SC#4 snapshot sweep → **183-05-02**
- [ ] `frontend/src/components/workflows/phaseVocabulary.test.ts` — D-183-06 / D-183-07, C-1 parity
      (TS half) → **183-02-01 / 183-02-02**
- [ ] `frontend/src/components/workflows/WorkflowCanvas.test.tsx` — SC#3a, D-183-08 / 10 / 11,
      Pitfall 1, a11y → **183-06-03**
- [ ] `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — D-183-03 (flag off ⇒ vanish),
      D-183-05 → **183-07-02**
- [ ] `frontend/src/providers/EffectiveFeaturesProvider.test.tsx` — the null-context fail-closed rule
      (new plumbing, OP-2) → **183-03-01**
- [ ] `backend/tests/unit/test_183_skip_parse_parity.py` — the C-1 parity Python half (the control
      that would have caught C-1 in the first place) → **183-02-03**
- [ ] **Update** `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` — migrate `:94-96` off
      literal `🤖`/`◆` onto `data-phase-type` hooks (pattern: `PhaseSpine.test.tsx:38-39`); extend
      `:158`'s no-graph-lib regex with `|xyflow`; delete the **false** parity comment at `:110-111`
      → **183-04-02**
- [ ] **Add** a `technical names` describe block to
      `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` — the D-183-06 / D-183-08 cross-view
      reveal regression (plain sentence with ⌥ OFF; `<label> · <slug>` with ⌥ ON on ≥ 2 nodes; no
      throw and no slug with NO provider), using the shipped `termMap.test.tsx:138-164` harness idiom.
      This is the automated backstop under manual row **U-1** → **183-04-01**
- [ ] **Update** `frontend/src/components/workflows/PhaseSpine.test.tsx:104` — extend the
      `not.toMatch(/const PHASE_GLYPHS/)` guard to cover `PhaseSpineGraph?raw` (D-183-13) → **183-04-03**
- [x] **Decided:** `soulData.test.ts:121-132` — **already RED at HEAD**, in exactly D-183-13's
      territory. **Disposition: FIX in-phase** (research recommendation; leaving it makes the suite
      self-contradictory while declaring `PHASE_GLYPHS` the single source of truth). The failing-name
      differential must therefore SHRINK by exactly that one name → **183-04-03**

---

## Manual-Only Verifications

The four G-4 lived-experience scenarios are **operator-defined at scope time** and MUST be driven
live (Chrome MCP or operator-clicks) at phase verification. Wire format and screenshots are
explicitly insufficient. Chrome MCP is known to hang (`chrome_mcp_dropdown_wedge`) — the documented
fallback is operator-driven clicks with named steps.

**These rows are deliberately NOT plan-task assertions.** No plan attempts to automate them away.

| ID | Behaviour | Requirement | Why Manual | Test Instructions |
|----|-----------|-------------|------------|-------------------|
| **U-1** | Spine ⇄ Canvas agree — in BOTH ⌥ modes | CANVAS-01, D-183-13, D-183-06, D-183-08 | Cross-view agreement of rendered 3D SVG marks — a DOM test can compare slugs but not that they *look* the same. The ⌥ half is the G-6 tripwire: `TechnicalNamesProvider` is app-wide (`App.tsx:252`), so a reveal wired on one view only surfaces as two different titles for the same phase after a toggle flip | Open a real draft in the Builder. **(a)** With ⌥ Technical names **OFF**, flip `[≣ Spine] ⇄ [⬡ Canvas]` both ways. **(b)** Turn ⌥ Technical names **ON** (Settings or the Canvas header) and flip `[≣ Spine] ⇄ [⬡ Canvas]` both ways again. **Pass — in BOTH modes:** the two views name the same steps, in the same order, with the same icons, and a given phase's title text is identical across the toggle. No step in one view and not the other. **Fail:** at the same ⌥ setting the Spine shows a plain-language sentence while the Canvas shows `<label> · <slug>` (or vice versa). |
| **U-2** | The 5-phase maximum reads | SC#1, SC#4 | Legibility and truncation are perceptual; jsdom has no layout | Open `eval_coverage` (the only 5-phase definition; ~1,600 px horizontal per sketch 136-B) on Canvas. **Pass:** legible at default zoom, titles not truncated to nonsense, **no horizontal page overflow**, the `○ end` cap visible. |
| **U-3** | The empty draft doesn't look broken | D-183-11 | "Doesn't look broken" is a judgement, not an assertion | Open one of the zero-phase drafts (the single most common canvas state) on Canvas. **Pass:** reads as "nothing here yet" — no stray grid, zoom pills, or minimap floating in space; no ghost/placeholder node. |
| **U-4** | Flag off = yesterday's Builder | D-183-03, D-181-01 | Requires a real operator session + a live `app_settings` write; the vitest analogue proves the render branch, not the end-to-end flag path | Operator flips `visual_workflow_canvas` → **Off** in the Control Room, reloads. **Pass:** the toggle is gone and the graph column is exactly as before — **including on an operator account**. |

---

## Forward Flags (recorded, NOT acted on in 183)

| Flag | Finding | Where it bites |
|------|---------|----------------|
| **C-5 — `@xyflow/react` bundles its OWN zustand `^4.4.0`** | A SECOND zustand copy enters the tree, contradicting `.planning/research/STACK.md:137`'s "same store" claim. 183 does not care: the canvas is read-only and holds no shared store. | **Phase 184.** `zundo` cannot wrap xyflow's internal store as STACK.md assumes, so 184's undo/redo plan is invalid as written and must be re-scoped at its discuss/sketch step. |
| **A2 — React Flow attribution** | `proOptions={{ hideAttribution: true }}` is left OFF; the attribution link stays visible. Removal appears to require a Pro subscription under xyflow's terms (MEDIUM confidence — not re-verified this session). | Raise at UAT if the operator objects; it is a licensing decision, not an engineering one. |
| **D-183-04 — the published-workflow canvas door** | Deferred, not built. Viewing a published definition's canvas requires Tweak, which calls `createWorkflowDraft` (an INSERT) — looking would mint a v(N+1) draft row. | **Phase 184** (if the editable canvas needs a view-only sibling) or **Phase 188** (a run view opening a canvas nobody can edit). |
| **D-183-14 — the cross-cutting icon slug swaps** | `llm_agent` → `compass` (operator-chosen) and `llm_batch_agents` → `handshake` (still open). One additive `phaseGlyph.tsx` map change, five shipped surfaces. 183 ships only the canvas-local icon-well lightening. | A separate dedicated `/gsd:quick` or `/gsd:fast` commit with its own before/after check, so a canvas rollback cannot silently revert an app-wide icon decision. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies — 20/20 carry an `<automated>` command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all ❌ MISSING references above
- [x] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Full-suite differential green: no new failing test **names**, no test-**count** regression vs. 33/1877
- [ ] `revertByteIdentical.test.tsx` green with every **assertion** byte-identical (comment-only correction permitted, 183-07-03)
- [ ] All four G-4 rows (U-1 … U-4) driven live before `/gsd:verify-work`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** planner-filled 2026-07-25 — Per-Task Verification Map complete, Dimension 8 PASS.
