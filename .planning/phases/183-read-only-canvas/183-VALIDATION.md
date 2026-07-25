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

> Filled by the planner once task IDs exist. Every task must carry an `<automated>` verify command
> or an explicit Wave-0 dependency (Dimension 8).

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _pending planner_ | — | — | CANVAS-01 | — | — | — | — | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky · `nyquist_compliant`/`wave_0_complete` flip during execution once Wave 0 tests exist and pass.*

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
| **D-183-06** | Fallback title is a plain-language sentence; slug never on the face by default | unit | `npx vitest run src/components/workflows/phaseVocabulary.test.ts` | ❌ W0 |
| **D-183-07** | Grounding badge derivation (strict/flag/open) + `llm_human_input` second badge only | unit | `… -t "grounding"` | ❌ W0 |
| **D-183-08** | One canvas-level ⌥ toggle flips every node at once | component | `… -t "technical names"` | ❌ W0 |
| **D-183-10** | Unresolvable skip renders an honest broken-reference stub, connected to no phase node | unit + component | `… -t "unresolvable"` | ❌ W0 |
| **D-183-11** | Zero-phase ⇒ named empty state, **no** `.react-flow`, no grid/controls/minimap, no ghost node | component | `… -t "empty"` | ❌ W0 |
| **D-183-12** | Same definition ⇒ byte-identical positions; source contains no DOM-read call | unit + source-grep | `npx vitest run src/components/workflows/canvasModel.purity.test.ts` | ❌ W0 |
| **D-183-13** | ONE glyph map + ONE `parseSkipTarget` in the tree; `PhaseSpineGraph` renders the 3D marks | source-grep + component | `npx vitest run src/components/workflows/PhaseSpine.test.tsx src/components/workflows/PhaseSpineGraph.test.tsx` | ⚠ exists, **must be updated** (`PhaseSpineGraph.test.tsx:94-96` breaks under the migration) |
| **D-183-15 / C-1** | Client parse ≡ `reachability.parse_skip_target` over the shared case table (**backend semantics authoritative** — operator-approved amendment) | unit ×2 (TS + Python) | `npx vitest run … -t "parity"` **and** `cd backend && venv/Scripts/python -m pytest tests/unit/test_183_skip_parse_parity.py` | ❌ W0 |
| **C-2** | Non-contiguous `phase_index` ⇒ exactly one sequential edge, matching `reachability.py:164`'s index **lookup** (no phantom `1→3`) | unit | `… -t "non-contiguous"` | ❌ W0 |
| **Pitfall 1** | No interactivity-lock button in the controls (`showInteractive={false}`) | component | `… -t "showInteractive"` | ❌ W0 |
| **181 gate** | `revertByteIdentical.test.tsx` scope-freeze assertions still pass **unmodified** | regression | `npx vitest run src/components/admin/revertByteIdentical.test.tsx` | ✅ exists — must stay green untouched |
| **a11y** | Rendered canvas has no axe violations; exactly one tab stop per node | component | `… -t "accessib"` | ❌ W0 |
| **G-6** | No `position` / `x` / `y` / `layout` key reaches a definition object | unit | in `canvasModel.purity.test.ts` | ❌ W0 |

---

## Wave 0 Requirements

- [ ] `npm i @xyflow/react@^12.11.2` in `frontend/` — the ONE net-new dep; then prove the toolchain
      with `npx tsc -b && npx vite build` **before** any component work (assumption A4: no explicit
      Vite-8 statement in the official docs)
- [ ] **Spike (≈5 min, assumption A1):** does a `<Handle>`-free custom node render edges? Render a
      2-node fixture with and without handles, count `.react-flow__edge`. This shapes `PhaseNode`.
- [ ] `frontend/src/test-utils/mockReactFlow.ts` — the official four-mock jsdom helper
      (**file-local import, NOT `setupTests.ts`**)
- [ ] `frontend/src/components/workflows/__fixtures__/canvasFixtures.ts` — the D-183-09 corpus,
      transcribed from migrations **061 / 066 / 094** + `scripts/seed-pm-pack.py`, each entry citing
      its source `file:line`. **Transcribed, never read live** — two live reads on the same day
      disagreed (C-3).
- [ ] `frontend/src/components/workflows/__fixtures__/skipParseCases.json` — the C-1 parity table,
      read by BOTH the TS and the Python suite
- [ ] `frontend/src/components/workflows/canvasModel.test.ts` — SC#1 / SC#3b / SC#4, C-2, D-183-10
- [ ] `frontend/src/components/workflows/canvasModel.purity.test.ts` — SC#2, D-183-12, G-6
- [ ] `frontend/src/components/workflows/canvasModel.fixtures.test.ts` — the SC#4 snapshot sweep
- [ ] `frontend/src/components/workflows/phaseVocabulary.test.ts` — D-183-06 / D-183-07, C-1 parity (TS half)
- [ ] `frontend/src/components/workflows/WorkflowCanvas.test.tsx` — SC#3a, D-183-08 / 10 / 11, Pitfall 1, a11y
- [ ] `frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx` — D-183-03 (flag off ⇒ vanish), D-183-05
- [ ] `backend/tests/unit/test_183_skip_parse_parity.py` — the C-1 parity Python half (the control
      that would have caught C-1 in the first place)
- [ ] **Update** `frontend/src/components/workflows/PhaseSpineGraph.test.tsx` — migrate `:94-96` off
      literal `🤖`/`◆` onto `data-phase-type` hooks (pattern: `PhaseSpine.test.tsx:38-39`); extend
      `:158`'s no-graph-lib regex with `|xyflow`; delete the **false** parity comment at `:110-111`
- [ ] **Update** `frontend/src/components/workflows/PhaseSpine.test.tsx:104` — extend the
      `not.toMatch(/const PHASE_GLYPHS/)` guard to cover `PhaseSpineGraph?raw` (D-183-13)
- [ ] **Decide + record:** fix or accept `soulData.test.ts:121-132` — **already RED at HEAD**, and in
      exactly D-183-13's territory (research recommends fix; leaving it makes the suite
      self-contradictory)

---

## Manual-Only Verifications

The four G-4 lived-experience scenarios are **operator-defined at scope time** and MUST be driven
live (Chrome MCP or operator-clicks) at phase verification. Wire format and screenshots are
explicitly insufficient. Chrome MCP is known to hang (`chrome_mcp_dropdown_wedge`) — the documented
fallback is operator-driven clicks with named steps.

| ID | Behaviour | Requirement | Why Manual | Test Instructions |
|----|-----------|-------------|------------|-------------------|
| **U-1** | Spine ⇄ Canvas agree | CANVAS-01, D-183-13 | Cross-view agreement of rendered 3D SVG marks — a DOM test can compare slugs but not that they *look* the same | Open a real draft in the Builder, flip `[≣ Spine] ⇄ [⬡ Canvas]` both ways. **Pass:** both views name the same steps, in the same order, with the same icons. No step in one view and not the other. |
| **U-2** | The 5-phase maximum reads | SC#1, SC#4 | Legibility and truncation are perceptual; jsdom has no layout | Open `eval_coverage` (the only 5-phase definition; ~1,600 px horizontal per sketch 136-B) on Canvas. **Pass:** legible at default zoom, titles not truncated to nonsense, **no horizontal page overflow**, the `○ end` cap visible. |
| **U-3** | The empty draft doesn't look broken | D-183-11 | "Doesn't look broken" is a judgement, not an assertion | Open one of the zero-phase drafts (the single most common canvas state) on Canvas. **Pass:** reads as "nothing here yet" — no stray grid, zoom pills, or minimap floating in space; no ghost/placeholder node. |
| **U-4** | Flag off = yesterday's Builder | D-183-03, D-181-01 | Requires a real operator session + a live `app_settings` write; the vitest analogue proves the render branch, not the end-to-end flag path | Operator flips `visual_workflow_canvas` → **Off** in the Control Room, reloads. **Pass:** the toggle is gone and the graph column is exactly as before — **including on an operator account**. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all ❌ MISSING references above
- [ ] No watch-mode flags (`vitest run`, never bare `vitest`)
- [ ] Full-suite differential green: no new failing test **names**, no test-**count** regression vs. 33/1877
- [ ] `revertByteIdentical.test.tsx` green and **unmodified**
- [ ] All four G-4 rows (U-1 … U-4) driven live before `/gsd:verify-work`
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
