---
phase: 103-workflows-page-authoring-api-nl-authoring
plan: 04
subsystem: frontend
tags: [react, typescript, vite, vitest, workflow-authoring, read-only-graph, form-led, describe-first, no-router, no-drag-canvas, tdd]

# Dependency graph
requires:
  - phase: 103-workflows-page-authoring-api-nl-authoring
    plan: "03"
    provides: the authoring client fns (generateWorkflow / createWorkflowDraft / updateWorkflowDraft) + GenerateResult/WorkflowDefinitionJSON types the Builder consumes (no recreation — consumed AS-IS)
provides:
  - "PhaseSpineGraph — the read-only VERTICAL phase-spine graph (plain HTML/CSS, no graph lib): phase_index order + solid i->i+1 edges + one dashed skip_to_phase edge + View-only badge/legend + 6 phase-type glyphs + phase.name fallback; drag-free by static check; never imports the run-surface timeline/card (G-5)"
  - "PhaseFormPanel — the 400px push (never overlay) form panel + the 6 phase_type-conditioned forms; integrity_policy greyed/read-only ONLY on llm_emit; folder_scope = name + bound UUID, never a path; onChange/onPersist seam"
  - "WorkflowBuilderPage — the describe-first Builder: empty = describe box + hint + disabled button; single-state-transition reveal (empty|composing|drafted|error union); the push grid wiring; honest ok:false/throw failure (no broken draft); a typed renderPublish prop seam for Plan 05"
  - "PhaseSpecJSON / parseSkipTarget / READ_ONLY_LEGEND exports (the Builder's working draft read-shape + the client-side skip-target resolver mirroring parse_skip_target)"
affects:
  - "103-05 (publish gauntlet UI — the WorkflowBuilderPage.renderPublish prop seam is where PublishGauntlet mounts)"
  - "103-06 (Workflows page — the Builder is the 'Build a workflow' / Tweak destination; consumes the same PhaseSpecJSON read-shape + deriveTier badge)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Read-only authoring graph as plain HTML/CSS (NO graph lib / NO drag-canvas / NO router) — a vertical <ol> spine with CSS gutter edges + one dashed skip branch; nodes are <button>s (keyboard-select, selection only, never draggable)"
    - "Form-led refinement on a read-only spine: the 400px push PhaseFormPanel is the SECOND grid column (parent owns gridTemplateColumns reflow) — push, never overlay; mirrors the shipped ChatLayout 2-state track"
    - "Single state transition (a discriminated union empty|composing|drafted|error): ok:true commits the COMPLETE definition + 'drafted' in ONE setState — the whole graph renders in one DOM batch, no per-node reveal/stagger/timed append"
    - "Honest-failure-at-the-UI-seam: ok:false OR a thrown/network error renders the 'could not generate' surface and ZERO phase nodes — never a partial/broken draft (the G-6 silent-invalid-draft guard, T-103-04-01)"
    - "6 phase_type-conditioned forms render ONLY each type's real fields (programmatic/llm_human_input: no model/tools/scope); integrity_policy is disabled/greyed ONLY inside the llm_emit branch (schema-declared, Phase 106 wiring)"
    - "Source-grep tests via Vite ?raw imports (typecheck-clean under vite/client) instead of node:fs/process — the G-5 / no-overlay static checks survive tsc -b"

key-files:
  created:
    - frontend/src/components/workflows/PhaseSpineGraph.tsx
    - frontend/src/components/workflows/PhaseSpineGraph.test.tsx
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/PhaseFormPanel.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - frontend/src/pages/WorkflowBuilderPage.test.tsx
  modified: []

key-decisions:
  - "The dashed skip edge resolves its target client-side via parseSkipTarget (split on the last ':' → trailing slug) mirroring the backend parse_skip_target; an edge renders ONLY when the resolved slug matches a real node (a dangling skip target draws nothing — no phantom edge)."
  - "Publish is a typed renderPublish?(def, draftId) prop seam, NOT an imported PublishGauntlet — so Plan 05 can land independently without an import-before-exists break; the publish-disabled-on-empty-golden_input rule stays inside the gauntlet (Plan 05), not the page."
  - "A generated draft is persisted lazily: createWorkflowDraft on the FIRST form save (keep the returned id), then updateWorkflowDraft PATCH thereafter — the page holds the in-memory draft as the source of truth; a persist 409/404 is caught and is non-fatal (the visible conflict/Tweak-fork surface is Plan 06)."
  - "Theme: used the REAL app Tailwind tokens (bg-background/bg-card/text-foreground/border-border/text-accent-violet/bg-primary/text-destructive + amber-500/600 for the warning skip edge) — the sketch's --color-* names are sketch-local; the Deep Midnight values come through the app's HSL-var Tailwind utilities."

patterns-established:
  - "Net-new-failure proof the additive way: Plan 04 ADDED 6 files and MODIFIED zero pre-existing files (git status A for all 6), so no pre-existing test's behavior can change by construction. Empirically confirmed: simulated base (full suite minus the 3 net-new test files) = 17 failed / 658, HEAD = 17 failed / 687 → delta 0 failures, +29 passing (all mine). The 17 are documented rot (SEED-056) in 7 untouched files."

requirements-completed: [WFAUTH-01, WFAUTH-02, WFAUTH-03]

# Metrics
duration: 22min
completed: 2026-06-14
---

# Phase 103 Plan 04: Workflow Builder — Describe-First Authoring + Read-Only Spine + Form Panel Summary

**The headline authoring surface, form-led on a read-only spine exactly as the locked sketch-018/019 contract demands: `PhaseSpineGraph` (a drag-FREE plain-HTML/CSS vertical phase-spine — phase_index order, solid i→i+1 edges, one dashed `skip_to_phase` branch, View-only badge + verbatim legend, 6 phase-type glyphs, `phase.name` fallback, never importing the run-surface timeline/card), `PhaseFormPanel` (the 400px PUSH-not-overlay panel with the 6 phase_type-conditioned forms — only each type's real fields, `integrity_policy` greyed/read-only only on `llm_emit`, `folder_scope` as name+UUID never a path), and `WorkflowBuilderPage` (the describe-box-only empty screen → a SINGLE-state-transition whole-draft reveal → the push grid; an `ok:false`/thrown generate renders an honest failure and ZERO phase nodes, never a broken draft) — 29 vitest cases GREEN, net-new failures = 0 (additive-only + base-checkout proven), tsc -b clean, no router, no graph lib, no drag-canvas.**

## Performance

- **Duration:** ~22 min
- **Started:** 2026-06-14 14:21 UTC
- **Completed:** 2026-06-14 14:43 UTC
- **Tasks:** 3 (all TDD: RED → GREEN)
- **Files changed:** 6 created (3 source + 3 tests); 0 pre-existing modified

## Accomplishments

- **REQ-4 / WFAUTH-03 — `PhaseSpineGraph` (read-only vertical spine, drag-free).** One node per `PhaseSpec` ordered by `phase_index` on a vertical `<ol>` spine with a CSS gutter line as the solid run-order `i→i+1` edge (suppressed on the last node). Each phase scans its validators for a `skip_to_phase:<slug>` on-fail value, resolved client-side by `parseSkipTarget` (split on the LAST `:` → trailing slug, mirroring the backend `parse_skip_target`); an edge renders ONLY when the resolved slug matches a real node — **exactly one dashed amber `⤳` skip branch** for the test draft, none for a draft without one. A `👁 View only` badge + the **verbatim** `READ-ONLY GRAPH · … · inspect, don't drag` legend + the 6 phase-type glyphs (⚙ ✎ 🤖 ⛓ ☺ ◆) + a non-empty `phase.name`-or-fallback title. Every node is a `<button>` (keyboard-selectable, `aria-pressed`, fires `onSelectNode(slug)` — selection only, never reorders); **NO `draggable`, NO drag handler, NO connection handle, NO add-node control** (static-DOM-asserted). Plain HTML/CSS — **no graph lib**; never imports the run-surface `PhaseTimeline`/`PhaseCard` (G-5, source-grep-asserted).
- **REQ-5 / WFAUTH-01 — `PhaseFormPanel` (400px push panel, 6 conditioned forms).** The SECOND grid column (the page owns the `gridTemplateColumns` reflow) — **push, never overlay** (no `position:absolute`/`fixed`, source-grep-asserted; a resting 44px rail when closed). A `switch` over all 6 `phase.config.phase_type` values renders ONLY that type's real fields per `harness.py`: `programmatic` → fn + input_keys (no model/tools/scope); `llm_single` → prompt+model+temperature+folder_scope+skill_ref; `llm_agent` → + available_tools + max_steps(**12**) + wall_clock_seconds; `llm_batch_agents` → + max_parallel_agents(**5**) + merge_strategy; `llm_human_input` → prompt+options+timeout_seconds(**300**) (no model/tools/scope); `llm_emit` → + emitter + citation_policy (**editable**) + **integrity_policy (disabled/greyed — the ONLY type with the policy enums)**. `folder_scope` renders `📁 {folderName} {uuid}` — **name + bound UUID, never a path**. A field edit calls `onChange(patch)`; a blur calls `onPersist()`.
- **REQ-5 / WFAUTH-01/02 — `WorkflowBuilderPage` (describe-first + single-state-transition).** The empty screen is **EXACTLY one describe `<textarea>` + one hint line + one DISABLED submit button** centered in a `max-w-[640px]` column — and **nothing else** (no grounding chip, strictness dial, folder picker, phase node, or left rail; all test-asserted absent). The button is `disabled` on empty/whitespace. Submit → a `"Composing…"` loading state → `generateWorkflow({ describe })`; on `ok:true` the **complete definition + the `"drafted"` state commit in ONE `setState`** so the whole graph renders in one DOM batch (no per-node reveal/stagger/timed append — source-grep-clean of `setTimeout|stagger|…Delay`). On `ok:false` **or a thrown/network error** the page renders the honest `data-testid="generate-error"` "could not generate" surface and **ZERO phase nodes** (never a partial/broken draft — T-103-04-01). The drafted view is the push grid (`gridTemplateColumns: minmax(0,1fr) ` + `panelOpen ? "400px" : "44px"`, `motion-safe:transition-[grid-template-columns]`, mirroring the shipped `ChatLayout`) with `PhaseSpineGraph` (col 1) + `PhaseFormPanel` (col 2); a node click sets `panelOpen` (the graph column shrinks). `onPersist` lazily wires `createWorkflowDraft` (first save) then `updateWorkflowDraft` PATCH. Publish is a typed `renderPublish?` prop seam for Plan 05. **No router.**

## Task Commits

Each task was committed atomically (TDD RED → GREEN):

1. **Task 1: PhaseSpineGraph read-only vertical spine** — `180bd0b2` (feat) — 10 vitest cases.
2. **Task 2: PhaseFormPanel 400px push panel + 6 forms** — `983d2aa3` (feat) — 12 vitest cases.
3. **Task 3: WorkflowBuilderPage describe-first + single-state-transition + push grid** — `1dec2a2d` (feat) — 7 vitest cases.

## Files Created

- `frontend/src/components/workflows/PhaseSpineGraph.tsx` (239 lines) + `PhaseSpineGraph.test.tsx`.
- `frontend/src/components/workflows/PhaseFormPanel.tsx` (326 lines) + `PhaseFormPanel.test.tsx`.
- `frontend/src/pages/WorkflowBuilderPage.tsx` (236 lines) + `WorkflowBuilderPage.test.tsx`.

## Decisions Made

- **Client-side skip-target resolution (`parseSkipTarget`).** Mirrors the backend `parse_skip_target` (split on the last `:`); an edge draws only when the target resolves to a real node — a dangling `skip_to_phase` draws nothing (no phantom edge), which is the honest read-only contract.
- **`renderPublish` as a typed prop seam (not an import).** Lets Plan 05's `PublishGauntlet` land independently; the publish-disabled-on-empty-golden_input rule stays in the gauntlet, not the page.
- **Lazy persistence (create-then-PATCH).** The in-memory draft is the source of truth; `createWorkflowDraft` on the first save, `updateWorkflowDraft` thereafter; a 409/404 is caught and non-fatal (the conflict/Tweak-fork surface is Plan 06).
- **Real app Tailwind tokens, not sketch `--color-*` names.** The sketch CSS variables are sketch-local; the Deep Midnight values arrive through the app's HSL-var Tailwind utilities (`bg-background`/`text-foreground`/`text-accent-violet`/`bg-primary`/`text-destructive`), with `amber-500/600` for the warning skip edge.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Source-grep tests used node:fs/process — broke tsc -b (typecheck), though vitest ran them fine.**
- **Found during:** Task 3 (`tsc -b` after the three tasks).
- **Issue:** My Task-1/Task-2 G-5 / no-overlay source-grep tests read the component source via `node:fs` + `node:path` + `process.cwd()`. Those RUN under vitest (vite resolves node builtins) but **fail typecheck** under the app tsconfig (`"types": ["vite/client"]` — no `node` globals), and they introduced a net-new `within`-unused TS6133 in the form-panel test. These were net-new tsc errors in MY files (not the documented rot).
- **Fix:** Switched both source-grep tests to Vite's idiomatic `?raw` import (`import src from "./X?raw"`), which is typed by `vite/client` (so `tsc -b` is clean) and removed the unused `within` import. The grep assertions are unchanged.
- **Files modified:** `PhaseSpineGraph.test.tsx`, `PhaseFormPanel.test.tsx` (both my own, same task wave).
- **Verification:** `tsc -b` exits 0 with zero errors in any Plan-04 file; the 3 test files still GREEN (29/29).
- **Committed in:** `1dec2a2d` (Task 3 commit, with the `?raw` refactor).

**2. [Rule 1 - Bug] Docstrings tripped my own static-grep acceptance checks.**
- **Found during:** Tasks 1–3 (the acceptance greps for `PhaseTimeline|PhaseCard`, `position:(absolute|fixed)`, `setTimeout|stagger`).
- **Issue:** My docstrings DESCRIBED the forbidden patterns (e.g. "never imports PhaseCard", "NO position:absolute", "no setTimeout stagger") in prose — which the literal source-greps would flag as present, even though no actual code uses them.
- **Fix:** Reworded the docstrings to avoid the literal forbidden tokens (e.g. "the run-surface timeline/card", "no absolutely-positioned overlay", "no timed reveal") while keeping the meaning. The runtime behavior is unchanged.
- **Files modified:** `PhaseSpineGraph.tsx`, `PhaseFormPanel.tsx`, `WorkflowBuilderPage.tsx`.
- **Verification:** All acceptance greps now return NOTHING for the forbidden tokens; the source-grep tests GREEN.
- **Committed in:** the respective task commits (`180bd0b2`, `983d2aa3`, `1dec2a2d`).

**Total deviations:** 2 auto-fixed (both test-correctness / docstring-hygiene bugs in my OWN new code). No production-behavior or scope changes; no pre-existing file touched.

## Known Stubs

- **None that affect the plan's goal.** `WorkflowBuilderPage.renderPublish?` is an intentional **typed prop seam** for Plan 05's `PublishGauntlet` (documented inline) — the Publish affordance is composed by the parent when Plan 05 lands; it is NOT a hidden empty/mock data source. The page is fully functional for describe → draft → refine-by-form → persist without it.

## Threat Surface (plan threat_model)

All four registered threats are mitigated at the UI seam:
- **T-103-04-01** (broken/ungrounded draft renders as a "draft") → the page renders a draft ONLY on `ok:true`; `ok:false`/thrown → honest error + ZERO nodes (test-asserted, both `ok:false` and the thrown-error path).
- **T-103-04-02** (the read-only graph offers a drag/edit affordance) → static-DOM check: no draggable/drag-handler/connection-handle/add-node (Task 1, test-asserted).
- **T-103-04-03** (a form edit silently overwrites a published row) → `updateWorkflowDraft` throws `WorkflowConflictError` on 409 (Plan 03); the page's `onPersist` catches it (non-fatal in-memory) — the visible conflict/Tweak-fork surface is Plan 06 (published refinement is a fork, not an in-place edit).
- **T-103-04-04** (folder_scope renders a path) → `folder_scope`/`project_folder_id` render the folder NAME + bound UUID, never a path (Task 2, test-asserted no `/X` and no `X:\` substrings).

No NEW security-relevant surface beyond the plan's threat_model (this is a pure frontend, read-only-against-server plan).

## Test Results

- **Plan target suite** (`PhaseSpineGraph.test.tsx` + `PhaseFormPanel.test.tsx` + `WorkflowBuilderPage.test.tsx`): **29 passed** (10 + 12 + 7), exit 0.
- **`tsc -b`:** exits 0; **zero errors in any Plan-04 file** (the rot errors reported are all pre-existing in 16 untouched files — SEED-056).
- **Net-new vitest failures = 0 (additive-only + base-checkout proven):**
  - Plan 04 ADDED 6 files and MODIFIED **zero** pre-existing files (`git diff --name-status 6ce5755e HEAD` = all `A`), so no pre-existing test's behavior can change by construction.
  - Empirically: **simulated base** (full suite minus the 3 net-new test files) = **17 failed / 658 total** (7 files); **HEAD** = **17 failed / 687 total** (same 7 files). Delta = **0 new failures, +29 passing** (all mine, all GREEN).
  - The 17 failures live in 7 untouched files (MessageItem, useMessages, StreamsProvider×3, model-info, and the coincidentally-named `Plan04.frontend.test.tsx` from Phase **095**-05 — NOT this plan's files) — documented pre-existing rot.
- **Sketch contract honored:** read-only spine (no drag-canvas / no graph lib / no router), form-led 400px push (not overlay), describe-box-only empty screen, single-state-transition reveal, honest ok:false failure — all test-asserted; the operator-approved sketch-018/019 mockup is the acceptance bar.

## Self-Check: PASSED

- All 6 created files exist on disk: `PhaseSpineGraph.tsx`/`.test.tsx`, `PhaseFormPanel.tsx`/`.test.tsx`, `WorkflowBuilderPage.tsx`/`.test.tsx` (verified).
- All 3 task commits exist in git history: `180bd0b2`, `983d2aa3`, `1dec2a2d` (verified).
- Plan target suite GREEN (29/29); `tsc -b` exit 0; net-new failures = 0 (additive-only, 17 = 17 base-vs-HEAD); read-only-spine / form-led / no-router / no-drag-canvas / no-graph-lib contract honored.

---
*Phase: 103-workflows-page-authoring-api-nl-authoring*
*Completed: 2026-06-14*
