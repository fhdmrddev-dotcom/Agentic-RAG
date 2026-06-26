---
phase: 124-workflow-studio-ux-soul-strict-loose
verified: 2026-06-27T01:50:00Z
status: passed
human_verification_result: operator-approved 2026-06-27 (all 7 human-UAT items confirmed — sketch-match 046-A/047-A, A1 label, live tier recompute + CR-01 draft hand-off, Deep Mode byte-identical, SC#10 cross-provider smoke, mobile 375px)
score: 4/4 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Sketch-match across all 3 soul sizes against 046-A"
    expected: "In the live app, a workflow's library card / run header (WorkspacePanel 'This workflow' section) / publish-summary all show the same purpose HERO, glyph-dot spine (no ribbons, no index numbers), one tier chip (glyph + WORD), needs, and output — switching workflows changes all three in lockstep"
    why_human: "Visual fidelity to operator-approved sketch 046-A is the SC#4 acceptance bar — not assertable by render shape alone"
  - test: "Two-door sketch-match against 047-A"
    expected: "The Studio entry shows two big side-by-side door cards; describe door shows soul preview + 'switch to Author & govern ›' strip; govern door shows the real Builder with controls; '‹ both doors' returns to chooser; nothing is removed"
    why_human: "Visual and interaction fidelity to operator-approved sketch 047-A is the SC#4 acceptance bar"
  - test: "A1 deliverable-label string against 046-A"
    expected: "The output atom in WorkflowSoul shows a friendly '<workflow name> · file' label that matches the 046-A example for a workflow with a terminal llm_emit phase"
    why_human: "The emitter exposes no guaranteed static deliverable name; the exact friendly label copy was explicitly deferred to operator UAT (A1 decision in Plan 01 and 03)"
  - test: "Live deriveTier recompute + locked judge in Author & govern door"
    expected: "In the govern door, flipping citation_policy strict→draft causes the tier chip to recompute (STRICT→MIDDLE→LOOSE); llm_judge_rubric stays LOCKED on and cannot be toggled off"
    why_human: "Interactive recompute and the judge-always-on lock are felt behaviors inside the real Builder that can only be confirmed in the live app"
  - test: "Deep Mode byte-identical (D-08)"
    expected: "Opening a Deep chat thread (no harness run) shows NO 'This workflow' PanelSection in WorkspacePanel — the soul section is absent and the panel is otherwise unchanged from pre-124"
    why_human: "Runtime gate condition (showTimeline = false) must be confirmed in the live app; can't be fully asserted in jsdom"
  - test: "SC#10 cross-provider smoke check (SC10-1 through SC10-7)"
    expected: "For each of the 7 VALIDATION.md rows: the soul header appears above the live PhaseTimeline, the timeline still streams normally, no console errors from soul components, no soul-state bleed between parallel threads"
    why_human: "Requires a live harness run on each of the 4 providers × multi-tool × parallel-thread × long-message axes; pure FE chrome smoke check per VALIDATION.md (not agent-logic UAT)"
  - test: "Mobile / 375 px legibility"
    expected: "At 375 px viewport, the soul remains legible at card + run scale — no layout collapse or text overflow"
    why_human: "Responsive legibility is visual"
---

# Phase 124: Workflow Studio UX — Soul + Strict↔Loose Verification Report

**Phase Goal:** A user immediately sees the "soul" of a workflow (its purpose, what it needs, its phase spine, its tier, its output) in three consistent sizes, and meets a clear strict↔loose disclosure that offers two doors ("Describe & run" vs "Author & govern") without removing any control — accuracy and governance preserved, complexity demoted one click.
**Verified:** 2026-06-27T01:50:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | A user sees a workflow's "soul" at a glance in three sizes (library card / run header / publish summary): purpose (`business_requirement`), what it needs, a glyph-dot phase spine (no type ribbons/index noise), one tier chip, and its output line | ✓ VERIFIED | `WorkflowSoul.tsx` renders all 5 atoms (purpose/needs/spine/tier/output) at scales card/run/pub. `WorkflowSoul` mounts in: `WorkflowsPage.tsx` (cards, scale="card"), `WorkspacePanel.tsx` RunSoul helper (scale="run"), `PublishGauntlet.tsx` (scale="pub"). `PhaseSpine.tsx` strips type ribbons and phase-index numbers — only glyph dots. 17/17 WorkflowSoul+PhaseSpine tests green. |
| 2 | The library card / run header / publish summary all show the SAME soul object consistently (same tier/glyphs/needs/output in all three) | ✓ VERIFIED | Single `soulData.ts` module owns `tierForDefinition` (one copy) and `PHASE_GLYPHS` (one map). All three soul sizes import from `soulData` — no per-size re-derivation. Tier-consistency invariant test (`WorkflowSoul.test.tsx`) asserts identical `data-tier` across card/run/pub with the same fixture. 14/14 soulData tests green. WorkflowsPage.tsx has zero local `PHASE_GLYPHS` or `tierForDefinition` definitions (grep confirms). |
| 3 | Authoring and running expose a strict↔loose disclosure keyed off `deriveTier` — two clear doors ("Describe & run" vs "Author & govern") — where nothing is removed and advanced controls are demoted exactly one click | ✓ VERIFIED | `WorkflowDoorSwitch.tsx` implements the explicit-fork shell (door state `both|describe|govern`). Both door cards render at `"both"`. Describe door shows soul preview + "switch to Author & govern ›" strip (`switch-strip`) + "‹ both doors" return. Govern door mounts the EXISTING `WorkflowBuilderPage` (delegated, not re-implemented — confirmed by `?raw` source-grep test in `WorkflowDoorSwitch.test.tsx`). CR-01 FIXED (commit `d60d04b9`): the loose door now seeds `initialDescribe` + `autoDraft` into WorkflowBuilderPage. 13/13 WorkflowDoorSwitch tests green. |
| 4 | The strict↔loose split preserves accuracy and control — a power user can still reach every advanced control, and a loose user can describe-and-run without meeting governance complexity (sketch-approved mockup is the acceptance bar) | ? HUMAN | The code correctly delegates all advanced controls to the existing Builder (citation_policy / gate chips / model / folder_scope / locked judge are delegated to WorkflowBuilderPage). The `judge-locked` affordance renders in the govern door header (data-testid="judge-locked"). However SC#4 specifies the **sketch-approved mockup is the acceptance bar** — visual confirmation against sketches 046-A and 047-A is required by a human operator. |

**Score:** 4/4 truths verified (SC#4 visual acceptance bar surfaces 7 human_verification items; automated evidence is complete for the code path)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/workflows/soulData.ts` | Single shared tier derivation, glyph map, needs resolver, deliverable resolver | ✓ VERIFIED | Exports `tierForDefinition`, `PHASE_GLYPHS`, `entryInputKeys`, `soulDeliverable`, `DefShape`, `SoulDeliverable`. No `@/lib/api` import. Pure computation only. File exists and is substantive (136 lines). |
| `frontend/src/components/workflows/WorkflowSoul.tsx` | Scale-keyed 5-atom soul (card|run|pub) with honest empty-states | ✓ VERIFIED | Renders all 5 atoms in LOCKED 046-A order; `data-tier` carries tier.id for consistency invariant; honest D-03 empty-states for null purpose and no llm_emit. XSS clean — no `dangerouslySetInnerHTML`. |
| `frontend/src/components/workflows/PhaseSpine.tsx` | Horizontal glyph-dot spine (ribbons+indices stripped, emit tinted) | ✓ VERIFIED | Strips type ribbons and phase-index numbers; `◆` llm_emit node gets `border-accent-violet text-accent-violet` tint; sorts by `phase_index`; names only via `title=` at card scale. |
| `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` | Two-door disclosure shell | ✓ VERIFIED | Three door states (`both|describe|govern`); govern door delegates to WorkflowBuilderPage; describe door shows soul preview + switch strip + both-doors return; CR-01 fix: `initialDescribe` + `autoDraft` wired to Builder. |
| `frontend/src/pages/WorkflowsPage.tsx` | Card-scale soul on library cards; door fork at Studio entry | ✓ VERIFIED | DraftCard + PublishedCard both render `<WorkflowSoul def={def} scale="card" />`. Builder host mounts `<WorkflowDoorSwitch>`. `published-run` button (`data-testid`) still calls `onLaunch` directly (D-01 preserved). Local PHASE_GLYPHS / tierForDefinition / DefShape definitions deleted. |
| `frontend/src/components/panel/WorkspacePanel.tsx` | Additive sibling PanelSection with WorkflowSoul scale="run" gated to showTimeline | ✓ VERIFIED | `RunSoul` helper (inline) uses `getThreadWorkflow` + `listPublishedWorkflows` for the additive by-id read. New `"This workflow"` PanelSection added ABOVE the existing `"Workflow"` PhaseTimeline section. Gated to `showTimeline`. |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | WorkflowSoul scale="pub" prepended above the 8-stage ladder | ✓ VERIFIED | `<WorkflowSoul def={definition} scale="pub">` is the first child of the top-level `<div className="w-full">` above the resting publish form (line ~406). Optional `definition` prop; absent = honest empty-states, no crash. STAGES ladder / GauntletSpine / verdict untouched. |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | initialDescribe + autoDraft props for CR-01 fix | ✓ VERIFIED | Props declared at lines 85/89; `useState(initialDescribe ?? "")` seeds the describe box; `autoDraftFiredRef` effect fires `onDraft()` once on mount when `autoDraft=true` and text is non-empty. |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `WorkflowSoul.tsx` | `soulData.ts` | `import tierForDefinition / entryInputKeys / soulDeliverable` | ✓ WIRED | Line 34: `from "@/components/workflows/soulData"` |
| `PhaseSpine.tsx` | `soulData.ts` | `import PHASE_GLYPHS` | ✓ WIRED | Line 19: `import { PHASE_GLYPHS, type DefShape } from "@/components/workflows/soulData"` |
| `soulData.ts` | `deriveTier.ts` | `deriveTier` call inside `tierForDefinition` | ✓ WIRED | Line 17: `import { deriveTier, ... } from "@/components/workflows/deriveTier"` — no local re-derivation |
| `WorkflowsPage.tsx` | `WorkflowSoul.tsx` | card-scale soul on DraftCard + PublishedCard | ✓ WIRED | Line 43 import; lines 490 + 549 render at scale="card" |
| `WorkflowDoorSwitch.tsx` | `WorkflowBuilderPage.tsx` | govern door mounts Builder (delegated) | ✓ WIRED | Line 33: `import { WorkflowBuilderPage }` + line 120: `<WorkflowBuilderPage ... initialDescribe={describe} autoDraft={handoffDraft} />` |
| `WorkflowDoorSwitch.tsx` | `WorkflowSoul.tsx` | describe-door soul preview | ✓ WIRED | Line 34: `import { WorkflowSoul }` + line 216: `<WorkflowSoul def={previewDef} scale="card" />` |
| `WorkspacePanel.tsx` | `WorkflowSoul.tsx` | new sibling PanelSection at scale=run | ✓ WIRED | Line 64: import; line 142: `<WorkflowSoul def={def} scale="run" />` inside RunSoul |
| `PublishGauntlet.tsx` | `WorkflowSoul.tsx` | prepended pub-scale soul block | ✓ WIRED | Line 47: import; line 407: `<WorkflowSoul def={definition} scale="pub" />` |
| `WorkflowsPage.tsx` Run button | `onLaunch` (D-01) | `published-run` testid still invokes onLaunch directly | ✓ WIRED | Line 564: `data-testid="published-run"`; line 436 calls `onLaunch(target, text)` — NOT routed through WorkflowDoorSwitch |
| CR-01: `WorkflowDoorSwitch.tsx` → `WorkflowBuilderPage.tsx` | `initialDescribe` + `autoDraft` | describe-door CTA hands off text + auto-draft flag | ✓ WIRED | `setHandoffDraft(true)` + `setDoor("govern")` on CTA click; Builder reads `initialDescribe` into useState + fires autoDraft effect once |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `WorkflowSoul.tsx` | `tier`, `needs`, `deliverable`, `purpose` | `tierForDefinition(def)`, `entryInputKeys(def)`, `soulDeliverable(def)`, `def?.business_requirement` | Yes — pure computation over the `def` prop passed from the host surface | ✓ FLOWING |
| `WorkspacePanel.tsx` RunSoul | `def: DefShape` | `getThreadWorkflow(threadId)` → `listPublishedWorkflows()` → match by slug | Yes — real API read of the owner-scoped published definition; falls back to null (honest empty-state) on failure | ✓ FLOWING (with accepted WR-03/WR-04 limitations) |
| `PublishGauntlet.tsx` | `definition: DefShape` | Threaded from Builder's `renderPublish(state.definition, draftId)` via WorkflowsPage call site | Yes — the Builder's working definition is passed through; absent renders honest empty-states | ✓ FLOWING |
| `WorkflowDoorSwitch.tsx` `previewDef` | Synthesized from `describe` textarea | `def ?? (describe.trim().length > 0 ? { business_requirement: describe } : undefined)` | Yes — WR-01 fix: tracks live typed text | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| soulData.ts: 14 unit tests | `cd frontend && npx vitest run src/components/workflows/soulData.test.ts` | 14/14 pass | ✓ PASS |
| WorkflowSoul + PhaseSpine: 17 unit tests | `cd frontend && npx vitest run src/components/workflows/WorkflowSoul.test.tsx src/components/workflows/PhaseSpine.test.tsx` | 17/17 pass | ✓ PASS |
| WorkflowDoorSwitch: 13 unit tests (includes CR-01, ?raw delegation source-grep, judge-locked) | `cd frontend && npx vitest run src/components/workflows/WorkflowDoorSwitch.test.tsx` | 13/13 pass | ✓ PASS |
| WorkflowsPage: 20 tests (includes D-01 Run-not-wrapped, soul tier chip, door-fork render) | `cd frontend && npx vitest run src/pages/WorkflowsPage.test.tsx` | 20/20 pass | ✓ PASS |
| WorkspacePanel + PublishGauntlet: 50 tests (G-5 source-grep, run soul mount, pub soul prepend, DOM order) | `cd frontend && npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx src/components/workflows/PublishGauntlet.test.tsx` | 50/50 pass | ✓ PASS |
| Full workflows/panel/pages regression | `cd frontend && npx vitest run src/components/workflows src/components/panel src/pages` | 326/326 pass (27 test files) | ✓ PASS |

---

### Probe Execution

Step 7c: SKIPPED — no probe-*.sh files declared for this phase. Phase is pure frontend; behavioral spot-checks above cover the runnable contract.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|---------|
| WUX-01 | 124-01, 124-02, 124-03 | A user sees the workflow soul at a glance in three sizes (library card / run header / publish summary) — purpose, needs, glyph-dot spine, tier chip, output | ✓ SATISFIED | soulData.ts + WorkflowSoul.tsx + PhaseSpine.tsx (Wave 1); card mount in WorkflowsPage.tsx + two-door shell (Wave 2 Plan 02); run-header mount in WorkspacePanel.tsx + publish-summary mount in PublishGauntlet.tsx (Wave 2 Plan 03); 326/326 tests green |
| WUX-02 | 124-02 | Strict↔loose disclosure — two doors ("Describe & run" vs "Author & govern") — nothing removed, advanced controls one click away, accuracy and control preserved | ✓ SATISFIED | WorkflowDoorSwitch.tsx: two-door fork at Studio entry only; govern door delegates to WorkflowBuilderPage (not re-implemented); judge locked always-on; D-01 Run path not wrapped; CR-01 fixed so loose door actually drafts |

---

### G-5 Red Line Verification

| File | Expected Blob Hash | Actual Blob Hash | Status |
|------|--------------------|------------------|--------|
| `frontend/src/components/panel/PhaseTimeline.tsx` | `9bf88c9bf41780153b267a95947643174059b46f` | `9bf88c9bf41780153b267a95947643174059b46f` | ✓ BYTE-IDENTICAL |
| `frontend/src/components/panel/PhaseCard.tsx` | `a489492fc3c7367e442e4b18ad3e934ed247d8aa` | `a489492fc3c7367e442e4b18ad3e934ed247d8aa` | ✓ BYTE-IDENTICAL |

`git diff --stat -- frontend/src/components/panel/PhaseTimeline.tsx frontend/src/components/panel/PhaseCard.tsx` is EMPTY. The G-5 red line held.

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `WorkspacePanel.tsx` | 103-145 | `RunSoul` defined inline in the panel file; does a full `listPublishedWorkflows` on every thread switch (WR-03/WR-04) | ℹ️ Info | Performance: full-list refetch per panel mount. Accepted/deferred per the code review resolution — WR-03 perf is out of v1 scope; WR-04 null→honest-empty-state is the designed draft behavior on a G-5 hot file. Both were dispositioned explicitly in commit `d60d04b9`. Not a blocker. |

No TBD / FIXME / XXX markers found in any phase-modified file. No empty implementations or hardcoded empty returns in the soul rendering path.

---

### Human Verification Required

#### 1. 046-A Sketch-Match — All 3 Soul Sizes

**Test:** Open the live app. Navigate to Workflows. Pick one STRICT workflow and one LOOSE workflow. Open each workflow's (a) library card, (b) run a harness run and watch the WorkspacePanel "This workflow" section, (c) enter the Builder and open the Publish modal. Diff each against `.planning/sketches/046-workflow-soul-object/index.html`.
**Expected:** Purpose is the HERO at every size. Glyph-dot spine has no type ribbons ("server"/"agent") and no index numbers. One tier chip shows glyph + WORD. Needs list shows the entry input keys. Output line reads either `"<name> · file"` or `"produces: answer in chat"`. Switching workflows changes tier/spine/needs/output in lockstep across all three sizes.
**Why human:** SC#4 acceptance bar — visual fidelity to an operator-approved sketch is not assertable by render shape alone.

#### 2. 047-A Sketch-Match — Both Doors

**Test:** Click New Workflow (fresh build). Compare the chooser screen against `.planning/sketches/047-strict-loose-two-doors/index.html`. Click "Describe & run" and check the describe door. Click "switch to Author & govern ›" and check the switch. Click "‹ both doors" and return. Then click "Author & govern" from the chooser.
**Expected:** Two big side-by-side door cards at the chooser. Describe door shows the soul preview (live-updating as you type) and the "switch to Author & govern ›" strip. Govern door shows the real Builder with all controls (citation_policy, gate chips, folder scope, model). "‹ both doors" returns. Nothing is locked or removed.
**Why human:** SC#4 visual and interaction fidelity to 047-A; felt two-door behavior.

#### 3. A1 Deliverable-Label String

**Test:** Pick a published workflow that has a terminal `llm_emit` phase. Check its output atom across the three soul sizes.
**Expected:** The output atom shows `"<workflow name> · file"` — the friendly, honest, name-derived label that matches the 046-A example. The "produces: answer in chat" fallback shows for a workflow with no `llm_emit` phase.
**Why human:** The exact label copy was explicitly deferred to operator UAT (A1 decision — the emitter does not expose a guaranteed static deliverable name; only the mechanism is locked-asserted).

#### 4. Live deriveTier Recompute + Locked Judge

**Test:** Open a published workflow via "Author & govern" (govern door / Tweak). In the PhaseFormPanel, flip `citation_policy` from `strict` to `draft`.
**Expected:** The tier chip in the WorkflowSoul (visible in the pub-summary soul block when you open Publish) recomputes from STRICT to LOOSE (or MIDDLE depending on validators). The `llm_judge_rubric` gate shows locked / cannot be removed (the "🔒 judge always-on" badge is present in the govern door header and the judge gate in the gauntlet is a hard wall with no "override" control).
**Why human:** Interactive tier recompute and the judge-always-on invariant are felt behaviors in the live Builder that require hands-on testing.

#### 5. Deep Mode Byte-Identical (D-08)

**Test:** Open a Deep chat thread (no harness run). Check WorkspacePanel.
**Expected:** No "This workflow" PanelSection appears. The panel is otherwise unchanged from pre-124 (Todos / Files / Versions sections only, or PanelEmpty if no activity).
**Why human:** Runtime gate condition (`showTimeline = false`) must be confirmed in the live app.

#### 6. SC#10 Cross-Provider Smoke Check (7 rows from VALIDATION.md)

**Test:** For each of the 4 providers (OpenAI, Anthropic, Google, OpenRouter), run a harness workflow and observe: (a) soul header above live PhaseTimeline, (b) timeline still streams, (c) no console errors. Add multi-tool (2+ tools in one phase), parallel-thread (Thread A running, Thread B starts), and long-message (≥50 prior messages) rows.
**Expected:** SC10-1 through SC10-7 from VALIDATION.md all pass. Soul state does not bleed between threads (SC10-6 parallel-thread invariant).
**Why human:** Requires live provider runs; pure FE chrome smoke check per D-08 (not full agent-logic UAT).

#### 7. Mobile 375 px Legibility

**Test:** Resize browser to 375 px. Check card soul on library cards and run soul in the WorkspacePanel mobile bottom-sheet.
**Expected:** Soul is legible at card + run scale; no layout collapse or text overflow.
**Why human:** Responsive legibility is visual.

---

## Gaps Summary

No automated gaps. All 4 observable truths are VERIFIED by the codebase:

- SC#1: Three-size soul (card/run/pub) exists and renders the 5 atoms — confirmed in code and 326/326 tests.
- SC#2: Consistency invariant (single soulData.ts, one tierForDefinition, one PHASE_GLYPHS) — confirmed by grep, by architecture, and by the tier-consistency test.
- SC#3: Two-door strict↔loose disclosure — confirmed in WorkflowDoorSwitch.tsx; CR-01 blocker FIXED; 13/13 tests including delegation source-grep and judge-locked.
- G-5 red line: PhaseTimeline.tsx / PhaseCard.tsx blob hashes match pre-phase baseline exactly.

The 7 human_verification items are all in SC#4 (sketch-approved mockup acceptance bar) and SC#10 (cross-provider smoke, per VALIDATION.md) — these are correctly classified as human-needed by the plan, the validation strategy, and the success criteria. No blocker gaps block automated evidence.

---

_Verified: 2026-06-27T01:50:00Z_
_Verifier: Claude (gsd-verifier)_
