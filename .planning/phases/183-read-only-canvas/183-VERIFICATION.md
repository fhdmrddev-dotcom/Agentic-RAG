---
phase: 183-read-only-canvas
verified: 2026-07-26T03:00:00Z
status: gaps_found
score: 3/4 must-haves verified (SC#3 partial)
overrides_applied: 0
gaps:
  - truth: "SC#3: The canvas is read-only and each node id equals phase.slug — the identity later run-viz paints onto"
    status: partial
    reason: "Non-draggability and node.id === phase.slug both hold structurally (verified in canvasModel.ts and by 237 passing unit/component tests). But the canvas's ONLY interaction — click a node to open the phase — is mouse-only. React Flow's node wrapper handles onClick and onKeyDown on separate paths; the keyboard path (Enter/Space) never invokes the user's onNodeClick, and because WorkflowCanvas.tsx passes a controlled `nodes` array with no `onNodesChange`, the library's internal selection state-change is also a no-op. Confirmed directly in source: WorkflowCanvas.tsx:231-233 wires selection exclusively through `onNodeClick`, with no `onKeyDown` handler anywhere in the file, and WorkflowCanvas.test.tsx contains zero `fireEvent.keyDown` assertions (grepped, zero hits). Meanwhile the model deliberately advertises the node as keyboard-operable (`ariaRole: 'button'` in canvasModel.ts:241, `nodesFocusable` left at its `true` default 'to preserve keyboard reachability' per WorkflowCanvas.tsx:12-16) — the promise is made in code/docblock and not kept. This is code-review finding CR-01 (Critical), raised 2026-07-25T22:43:52Z and NOT remediated in any subsequent commit — `git log` on WorkflowCanvas.tsx shows only the original 183-06 commit, no follow-up fix."
    artifacts:
      - path: "frontend/src/components/workflows/WorkflowCanvas.tsx"
        issue: "onNodeClick is the sole selection entry point (lines 231-233); no onKeyDown/keyboard activation path exists despite nodesFocusable=true and ariaRole='button' on every phase node"
      - path: "frontend/src/components/workflows/WorkflowCanvas.test.tsx"
        issue: "Only fireEvent.click is exercised; the 'one tab stop per node' test asserts reachability but never activation, so the suite is green while the behavior is broken"
    missing:
      - "A bubbling onKeyDown handler on <ReactFlow> (or equivalent) that fires onSelectNode on Enter/Space, matching CR-01's proposed fix"
      - "A regression test asserting fireEvent.keyDown(node, {key:'Enter'}) calls onSelectNode"
      - "Correction of the React-Flow default ariaLabelConfig, which currently tells screen readers 'Press enter or space to select... press delete to remove it' — neither half is true on this surface (WR-06, same review)"
deferred: []
human_verification:
  - test: "U-1: Spine <-> Canvas agree, in both Technical-names OFF and ON modes"
    expected: "Open a real draft in the Builder. With the reveal OFF, flip [Spine] <-> [Canvas] both ways -- same steps, same order, same icons. Turn the reveal ON and flip both ways again -- same result, and a given phase's title text is identical across the toggle at the same reveal setting."
    why_human: "Cross-view visual agreement of rendered 3D SVG marks and layout is a perceptual judgment; a DOM test can compare slugs/labels but not that they visually agree. Requires a live app session (flag must first be turned On in the Control Room, since visual_workflow_canvas cold-defaults to off)."
  - test: "U-2: The 5-phase maximum (eval_coverage) reads at default zoom"
    expected: "Titles not truncated to nonsense, no horizontal page overflow, the end cap visible."
    why_human: "Legibility and truncation are perceptual; jsdom has no real layout engine."
  - test: "U-3: The empty draft (0 phases) doesn't look broken"
    expected: "Reads as 'nothing here yet' -- no stray grid, zoom pills, or minimap floating in space; no ghost/placeholder node."
    why_human: "'Doesn't look broken' is a judgement call, not an assertion; requires visually opening one of the 40 zero-phase drafts."
  - test: "U-4: Flag off = yesterday's Builder, including on an operator account"
    expected: "Operator flips visual_workflow_canvas to Off in the Control Room, reloads. The [Spine]/[Canvas] toggle strip is gone and no .react-flow subtree mounts -- for every account type, including operators."
    why_human: "Requires a real operator session and a live app_settings write; the vitest DOM-absence test proves the render branch but not the end-to-end flag path through a live Control Room session."
---

# Phase 183: Read-Only Canvas Verification Report

**Phase Goal:** A user can view an existing workflow as a visual node canvas — a faithful
read-only projection of its definition — proving the projection model cheaply before any
write / persistence complexity.
**Verified:** 2026-07-26T03:00:00Z
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Nodes = phases, edges = flow + `skip_to_phase` branches, via `@xyflow/react` (CANVAS-01, SC#1) | VERIFIED | `@xyflow/react@^12.11.2` in `frontend/package.json:33`; `canvasModel.ts:toCanvas` builds one node per phase (id=slug) and a sequential edge via `phase_index+1` LOOKUP plus a `skip:` edge per parsed `skip_to_phase`. 5 core test files (`canvasModel.test.ts`, `.fixtures.test.ts`, `.purity.test.ts`, `WorkflowCanvas.test.tsx`, `WorkflowBuilderPage.canvas.test.tsx`) run green independently: 237/237 passing. |
| 2 | Canvas is a pure projection — layout computed at render, never persisted (SC#2, Pitfall 3) | VERIFIED | `toCanvas(phases: PhaseSpecJSON[])` reads only its argument, does no DOM read/network/clock/randomness, never mutates input (`[...phases].sort(...)` non-mutating idiom), and returns fixed-pitch `x`/`y` from a frozen `CANVAS_LAYOUT` const table — no `position`/`x`/`y`/`layout` key is ever written onto a `PhaseSpecJSON`. `canvasModel.purity.test.ts` (part of the 237 green) asserts determinism + no-mutation + source has no DOM-read call. |
| 3 | Canvas is read-only (not draggable); node id === phase.slug (SC#3) | PARTIAL — see gap | `nodesDraggable={false}` explicitly set (`WorkflowCanvas.tsx:214`) plus per-node `draggable: false` in the model; `nodes.push({ id: phase.slug, ... })` in `canvasModel.ts:236` confirms node-id-equals-slug. HOWEVER: the sole interaction (click-to-select, D-183-05) is mouse-only — keyboard Enter/Space is inert despite the node advertising `ariaRole: "button"` and staying keyboard-focusable. This is code-review CR-01 (Critical), confirmed unresolved by direct source inspection and by the absence of any `keyDown` assertion in `WorkflowCanvas.test.tsx`. |
| 4 | Faithful projection of the 4 canonical seeds + PM pack — no dropped phase, no phantom edge (SC#4) | VERIFIED (with noted edge-case debt) | `__fixtures__/canvasFixtures.ts` carries all 4 canonical seeds (`research_summarize`, `plan_execute_verify`, `literature_review`, `doc_qa_human`), the 3 Starter Library entries, 2 PM-pack entries, `eval_coverage` (5-phase max), the empty draft, single-phase, synthetic branching, unresolvable-skip, and non-contiguous-index fixtures — 15 named fixtures, snapshot-swept in `canvasModel.fixtures.test.ts` (green). Two documented, non-blocking gaps from code review: duplicate-slug collision (WR-03) and colon-bearing-slug edge-id collision (WR-04) are real but require inputs (duplicate/colon-bearing slugs) not present in the live 95-definition/119-phase corpus this phase inventoried — logged as quality debt, not exercised by any shipped data today. |

**Score:** 3/4 truths fully verified; 1/4 partial (SC#3 — structural read-only + identity hold; keyboard operability does not).

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/workflows/canvasModel.ts` | Pure projection function | VERIFIED | Reviewed in full; matches docblock claims; 237 tests including a dedicated purity suite pass |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | Read-only `@xyflow/react` shell | VERIFIED (with CR-01 gap) | All interaction flags explicitly turned off except selection; `<Controls showInteractive={false}>` present, killing the drag re-enable padlock (Pitfall 1) |
| `frontend/src/components/workflows/phaseVocabulary.ts` | Single shared glyph/parse/title vocabulary | VERIFIED | `parseSkipTarget` matches backend `reachability.py:89-98` prefix-slice semantics exactly (verified by reading both files + green cross-language parity test, 13/13 backend + TS-side green); `nodeTitle`/`technicalTitle`/`groundingFor`/`waitsForYou` all total functions, no throw paths |
| `frontend/src/components/workflows/PhaseNode.tsx`, `PhaseSpineGraph.tsx` (repoint) | Node face rendering; Spine no longer duplicates glyph/parse | VERIFIED | `PhaseSpineGraph.tsx` now imports `PHASE_GLYPHS` from `soulData` and `parseSkipTarget` from `phaseVocabulary` — grep confirms zero remaining local re-declarations |
| `frontend/src/pages/WorkflowBuilderPage.tsx` (toggle) | `[Spine]/[Canvas]` in-Builder toggle, flag-gated | VERIFIED | `canvasEnabled` uses the fail-closed 3-part gate (`featuresCtx !== null && !loading && === true`); `activeGraphView = canvasEnabled ? graphView : "spine"` — flag out-ranks stale session state; flag-off path renders `graphChild` alone (no wrapper, no strip) confirmed by source read and by `revertByteIdentical.test.tsx` (2/2 green) |
| `backend/tests/unit/test_183_skip_parse_parity.py` | Cross-language parity pin | VERIFIED | Ran independently: 13/13 passed |
| `frontend/src/components/workflows/__fixtures__/canvasFixtures.ts` | 4 canonical + PM pack + edge-case fixtures | VERIFIED | 15 named fixtures present as listed above (grep-confirmed); IN-05 notes 5 are byte-identical duplicates (info-level, non-blocking) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `WorkflowBuilderPage.tsx` | `WorkflowCanvas.tsx` | Lazy `<Suspense>`-wrapped mount, `activeGraphView === "canvas"` | WIRED | Confirmed at `WorkflowBuilderPage.tsx:469-484`; only requested when the flag is strictly on |
| `WorkflowCanvas.tsx` | `canvasModel.toCanvas` | `useMemo(() => toCanvas(phases), [phases])` | WIRED | `WorkflowCanvas.tsx:137` |
| `WorkflowCanvas.tsx` (click) | `WorkflowBuilderPage.handleSelectNode` | `onNodeClick` prop → `onSelectNode(node.id)` | WIRED (mouse only) | Same D-183-05 contract as `PhaseSpineGraph`; opens the existing 400px `PhaseFormPanel`. Keyboard path NOT wired (CR-01) |
| `canvasModel.parseSkipTarget` (via `phaseVocabulary`) | `reachability.py:parse_skip_target` | Shared JSON case table, parity test | WIRED | `skipParseCases.json` read by both suites; both green independently |
| `useEffectiveFeatures` | `WorkflowBuilderPage` toggle gate | `useEffectiveFeaturesOptional()` | WIRED | Fail-closed 3-part gate confirmed in source |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `WorkflowCanvas` | `phases` prop | `state.definition.phases` (the live draft in `WorkflowBuilderPage`) | Yes — same draft state the Spine reads | FLOWING |
| `WorkflowCanvas` | `projection.nodes/edges` | `canvasModel.toCanvas(phases)`, a pure client-side derivation | Yes, deterministic over real phase data, zero network (by design — D-183-15) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Core canvas unit/component suite green | `npx vitest run src/components/workflows/canvasModel.fixtures.test.ts src/components/workflows/canvasModel.test.ts src/components/workflows/canvasModel.purity.test.ts src/components/workflows/WorkflowCanvas.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx` | 5 files / 237 tests passed | PASS |
| Flag-off regression gate green | `npx vitest run src/components/admin/revertByteIdentical.test.tsx src/providers/EffectiveFeaturesProvider.test.tsx` | 2 files / 21 tests passed | PASS |
| Backend parity half green | `venv/Scripts/python -m pytest tests/unit/test_183_skip_parse_parity.py -q` | 13 passed | PASS |
| Production build succeeds, canvas is a separate lazy chunk | `npx vite build` | exit 0; `dist/assets/WorkflowCanvas-DWoW14H5.js` 174.16 kB as its own chunk | PASS |
| Keyboard activation of a canvas node | `fireEvent.keyDown(node, {key:'Enter'})` → expect `onSelectNode` called | No such test exists in the suite; source inspection confirms no `onKeyDown` handler in `WorkflowCanvas.tsx` | FAIL (CR-01) |
| No debt markers in phase-touched files | grep `TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER` across `canvasModel.ts`, `WorkflowCanvas.tsx`, `phaseVocabulary.ts`, `PhaseNode.tsx`, `PhaseSpineGraph.tsx` | Zero hits (one prose match for "placeholder" describing a design rule, not a stub) | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|-------------|--------|----------|
| CANVAS-01 | 183-01 through 183-07 (all 7 plans) | "A user can view an existing workflow as a visual node canvas — a read-only projection of its WorkflowDefinition (nodes = phases, edges = flow + skip_to_phase branches), rendered via @xyflow/react." | SATISFIED with one open accessibility defect | Core viewing, projection purity, and faithfulness are all verified in the codebase (mouse-driven). The requirement text itself does not explicitly demand keyboard operability, but the shipped code advertises button/focusable semantics it does not honor (CR-01), which is a real, unaddressed gap on the delivered surface. No orphaned CANVAS-* requirements found in REQUIREMENTS.md beyond CANVAS-01 (`grep "Phase 183" REQUIREMENTS.md` → exactly one row). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `WorkflowCanvas.tsx` | 231-233 | Selection wired exclusively through mouse `onNodeClick`; no keyboard path despite `ariaRole="button"` + focusable nodes | Blocker (code review CR-01, confirmed unresolved) | Keyboard-only and screen-reader users cannot activate the canvas's only interaction; contradicts the file's own "read-only is TRUE" accessibility framing |
| `phaseVocabulary.ts` | 210-217 (`groundingFor`) | `citation_policy: "partial"` silently folds into "No sources needed", contradicting `deriveTier.ts`'s own MIDDLE-tier honest labeling of the same value | Warning (WR-01) | Canvas badge and workflow-soul badge disagree about a real governance control for the same phase |
| `WorkflowCanvas.tsx` | 226 | `colorMode="dark"` hardcoded regardless of the app's saved light/dark theme | Warning (WR-02) | Canvas plane renders `#141414` inside a light-themed app for light-mode users |
| `canvasModel.ts` | 225-244 | Node id keyed on raw `phase.slug` with no collision handling; two phases sharing a slug in an unsaved (lint-ungated) draft silently collapse to one node | Warning (WR-03) | A theoretical dropped-phase faithfulness violation on draft data; not observed in the 95-definition live corpus this phase inventoried |
| `canvasModel.ts` | 261, 289, 307, 332 | Reserved/edge id built by raw string concatenation over unconstrained slugs; a colon-bearing slug (a modeled input per correction C-1) can collide two distinct ids | Warning (WR-04) | Theoretical phantom-edge/dropped-edge faithfulness violation; same class as WR-03 |
| `PhaseNode.tsx` | 159, 238, 289 | New (non-CI-gated) ESLint errors: `react-hooks/static-components`, unused `_props` | Info (WR-05) | Quality debt, not a build break (repo eslint is not CI-gated except the a11y-scoped config, which is clean) |
| `WorkflowCanvas.tsx` | 208-234 | Default React-Flow screen-reader description promises "press enter or space to select... press delete to remove it", neither of which is true | Warning (WR-06, paired with CR-01) | Actively misleads assistive-technology users about the surface's real behavior |

### Human Verification Required

See `human_verification` in frontmatter (U-1 through U-4). All four are explicitly documented in `183-VALIDATION.md` as operator-defined "I'd recognize failure here" scenarios that MUST be driven live, and `183-07-SUMMARY.md` itself marks them "⚠ OUTSTANDING" — they were never executed during this phase's build, and the flag (`visual_workflow_canvas`) cold-defaults to off, so the toggle is not even visible to end users without an operator action first.

### Gaps Summary

The read-only canvas is real, substantively implemented, and does what its four Success
Criteria describe for a sighted mouse user: it renders `@xyflow/react` nodes/edges as a
faithful, deterministic, non-persisted projection of a `WorkflowDefinition`, matches the
4 canonical seed shapes plus the PM pack, and correctly refuses to persist layout or drag
state. All of the phase's own automated gates (237 core unit/component tests, the 21-test
flag-off regression gate, the 13-test backend parity half, and a clean `vite build`
producing the expected separate lazy chunk) pass when run independently — the SUMMARY
claims on these points hold up.

The one genuine blocker is CR-01 from the phase's own code review, which remains
unaddressed in the code as committed: the canvas's only interaction (selecting a node)
is mouse-only despite every node advertising itself as a keyboard-focusable button. This
is not a cosmetic nit — it is a broken accessibility contract on a surface the phase's own
decisions (D-183-07's WCAG 1.4.1 citation, the axe-clean claims) treat as a first-class
concern, and it was flagged Critical by the review that already ran. Five further Warnings
(governance-label dishonesty for `partial` citation policy, a hardcoded dark canvas inside
a light-theme app, two theoretical id-collision faithfulness edge cases, and a misleading
screen-reader description) round out the debt but do not, on their own, defeat a Success
Criterion given the live corpus this phase inventoried.

Separately — and this would gate `passed` even if CR-01 were fixed — none of the four
G-4 lived-experience UAT rows (U-1 spine/canvas agreement, U-2 five-phase legibility, U-3
empty-state honesty, U-4 flag-off byte-identity on a live operator session) have been
driven live yet. The phase's own validation strategy designates these as mandatory,
non-automatable checks required before `/gsd:verify-work`, and `183-07-SUMMARY.md`
explicitly marks them outstanding.

**This looks like an intentional two-part handoff, not a fabricated claim** — the SUMMARY
is honest about both the CR-01 defect (via the code-review artifact) and the outstanding
UAT rows. To proceed, either fix CR-01 (small, well-scoped per the review's own patch) and
then run U-1 through U-4 live, or record an explicit override if the team judges mouse-only
interaction acceptable for this phase's read-only preview and wants to carry the keyboard
fix into Phase 184.

```yaml
overrides:
  - must_have: "SC#3: canvas nodes are keyboard-operable (Enter/Space activates the click contract)"
    reason: "<fill in — e.g. 'draft-only read-only preview behind a default-off flag; mouse operability is sufficient for the closed beta; keyboard parity ships in Phase 184 alongside the editable canvas'>"
    accepted_by: "<name>"
    accepted_at: "<ISO timestamp>"
```

---

_Verified: 2026-07-26T03:00:00Z_
_Verifier: Claude (gsd-verifier)_
