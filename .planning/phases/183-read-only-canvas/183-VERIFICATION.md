---
phase: 183-read-only-canvas
verified: 2026-07-26T18:30:00Z
status: human_needed
score: 8/8 must-haves verified in code (2 new manual UAT rows — U-5/U-6 — still owed before the phase can close again)
overrides_applied: 0
re_verification:
  previous_status: passed
  previous_score: 4/4
  gaps_closed:
    - "GAP-1 — the step detail panel had no discoverable dismiss. Now a required `onClose` prop drives a ✕ in `PhaseFormPanel.tsx`'s header (`:460-468`), a `panelOpen`-gated window Escape listener lives in `WorkflowBuilderPage.tsx` (`:213-231`), and `onPaneClick={onClearSelection}` is wired on `<ReactFlow>` (`WorkflowCanvas.tsx:326`). Confirmed working in BOTH the Spine (flag off) and the Canvas view by direct source read, matching the SUMMARY/REVIEW-09 claims exactly."
    - "GAP-2 (WR-08-01) — a held Enter/Space no longer rapid-toggles the panel. `if (event.repeat) return` added immediately after the key filter (`WorkflowCanvas.tsx:234`), confirmed by direct source read."
    - "GAP-3 (WR-08-04) — the end cap and unresolved-skip stub no longer inherit the activation description. `domAttributes: { \"aria-describedby\": undefined }` added on both node types (`canvasModel.ts:306`, `:335`), confirmed by direct source read and independently confirmed by the reviewer against the installed `@xyflow/react@12.11.2` source."
  gaps_remaining: []
  regressions: []
gaps: []
deferred: []
human_verification:
  - test: "U-5: The step panel closes the obvious way, CANVAS view"
    expected: "Flag ON. Open a draft, switch to [⬡ Canvas], click a step. A close control in the panel header is spottable without hunting; clicking it returns the panel to the thin rail; Escape does the same; clicking empty canvas space does the same."
    why_human: "'Findable without being told' is the exact discoverability complaint that produced this gap-closure plan. jsdom proves the button exists and the callback fires; only a live pass proves a real user notices it unprompted — the same bar the operator's original bug report set."
  - test: "U-6: The step panel closes the obvious way, SPINE view, flag OFF"
    expected: "Flag OFF (Control Room), reload. Open a draft in the Spine, click a step. The same ✕ is present and closes the panel; Escape closes it. No [Spine]/[Canvas] strip and no canvas subtree may appear (D-181-01 unchanged)."
    why_human: "The defect was pre-existing Spine debt, not a canvas regression, so the fix must be seen live on the shipped surface where it was originally reported — a DOM-absence assertion cannot substitute for an operator confirming the control is visible and usable."
---

# Phase 183: Read-Only Canvas Verification Report (183-09 Gap-Closure Re-Verification)

**Phase Goal:** A user can view an existing workflow as a faithful read-only node canvas —
proving the projection model before any write complexity.
**Verified:** 2026-07-26T18:30:00Z
**Status:** human_needed
**Re-verification:** Yes — after gap-closure plan `183-09` (commits `3dc0671e` / `4e997f03` /
`45633371`), which closed the three defects the live Chrome UAT confirmed against the
previously-`passed` phase.

## What This Pass Covers

The phase's four ROADMAP Success Criteria were already independently verified against source
in the prior `183-VERIFICATION.md` pass (2026-07-26, score 4/4) and are unchanged by `183-09` —
this pass gives them a quick regression check only, per the re-verification optimization. The
bulk of this pass is full three-level verification of `183-09`'s own must-haves: the three
confirmed defects (GAP-1/2/3) and, per the orchestrator's explicit instruction, hard scrutiny
of the read-only invariant (D-183-05 / T-183-12) across every net-new dismissal path.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Nodes = phases, edges = flow + `skip_to_phase` branches, via `@xyflow/react` (CANVAS-01, SC#1) | VERIFIED (regression check) | Unchanged by `183-09`; not in `files_modified`. 423/423 tests green in the orchestrator-run phase-scoped suite, independently re-run by me with the same result. |
| 2 | Canvas is a pure projection — layout computed at render, never persisted (SC#2) | VERIFIED (regression check) | `canvasModel.purity.test.ts` untouched by `183-09` (`git diff --stat` on it is empty) and green. |
| 3 | Canvas is read-only (not draggable); node id === phase.slug; select is operable from mouse AND keyboard (SC#3) | VERIFIED (regression check) | All seven read-only opt-out flags (`showInteractive={false}`, `nodesDraggable={false}`, `nodesConnectable={false}`, `edgesReconnectable={false}`, `connectOnClick={false}`, `edgesFocusable={false}`, `deleteKeyCode={null}`) present at `WorkflowCanvas.tsx:303-309`, confirmed by direct read. `activateFromKeyboard` keyboard path unchanged in intent (guard added, see truth 6). |
| 4 | Faithful projection of the 4 canonical seeds + PM pack — no dropped phase, no phantom edge (SC#4) | VERIFIED (regression check) | 15 fixtures, snapshot-swept; `183-09` Task 3 legitimately grew the snapshot by exactly 15 additive `domAttributes` lines (verified below), no deletions. |
| 5 | GAP-1 — the step panel can be dismissed via a discoverable ✕, Escape, or (on the canvas) clicking away, in BOTH the Spine and Canvas view | VERIFIED in code | `PhaseFormPanel.tsx:70-73` declares `onClose: () => void` as a REQUIRED prop; `:460-468` renders `<button data-testid="phase-form-close" aria-label="Close step details" onClick={onClose}>`. `WorkflowBuilderPage.tsx:213-215` (`clearSelection`), `:224-231` (`panelOpen`-gated `window` Escape listener), `:509` (`onClearSelection={clearSelection}` passed to `<WorkflowCanvas>`) and `:648` region (passed to `<PhaseFormPanel>`) all read exactly as SUMMARY/REVIEW-09 describe. `WorkflowCanvas.tsx:326` wires `onPaneClick={onClearSelection}`. Independently re-ran the phase-scoped suite: 423/423 passed, including the 9 new `183-09` tests. |
| 6 | GAP-2 — a HELD Enter/Space activates exactly once (`event.repeat` guard) | VERIFIED | `WorkflowCanvas.tsx:234`: `if (event.repeat) return`, placed immediately after the key filter (`:225`) and before the wrapper/id resolution — confirmed by direct read, matching the plan's Part A prescription exactly. |
| 7 | GAP-3 — the end cap and unresolved-skip stub no longer inherit the "press enter/space" activation description | VERIFIED | `canvasModel.ts:306` (unresolvedSkip) and `:335` (endCap): `domAttributes: { "aria-describedby": undefined }`, confirmed by direct read. Snapshot diff gate (below) confirms exactly 15 additive keys, 0 deletions. |
| 8 | Read-only invariant holds: every net-new dismissal path (✕, Escape, pane-click, repeat guard) reaches `setSelectedSlug` and nothing else — no write, no fetch, no node mutation, no drag re-enable (D-183-05 / T-183-12) | VERIFIED WITH A REAL, RECORDED CAVEAT (see below) | The canvas-structural half of this claim is fully true: `grep -cE "onNodesChange\|disableKeyboardA11y"` on `WorkflowCanvas.tsx` is 0, and all seven read-only flags remain present — no node drag/connect/delete capability was reintroduced by any dismissal path. The narrower, plan-literal claim — that dismissal "reaches `setSelectedSlug` and nothing else" — is **falsified for the ✕ path specifically** by `183-REVIEW-09.md`'s WR-09-01/02, which ran a live probe against the real page (not a hypothetical): clicking ✕ while a form field is focused blurs that field first (native browser mousedown→blur ordering), which fires the PRE-EXISTING `onBlur={onPersist}` autosave and PATCHes the draft — `updateWorkflowDraft` fires **once**. Escape and the pane click, by contrast, unmount the focused field directly, which the DOM spec does not fire `blur`/`focusout` for, so those two paths genuinely write nothing and silently DROP the pending edit instead. See "Residual Findings" below for why I did not fail this truth outright. |

**Score:** 8/8 truths verified in code, 1 of them (#8) carrying a real, non-trivial residual
finding recorded honestly rather than smoothed over. Two live-UAT rows (U-5/U-6) — the exact
kind of discoverability check this gap-closure plan exists to satisfy — have not yet been
driven, which is what keeps this pass at `human_needed` rather than `passed`.

### Residual Findings From `183-REVIEW-09.md` — Assessed on Their Merits

I read the full review and independently re-derived its highest-severity findings against
current source (`PhaseFormPanel.tsx`, `WorkflowBuilderPage.tsx`, `WorkflowCanvas.tsx`). All are
real; the review's own `npx tsc`/`eslint`/test-suite claims were also independently re-run by
me (423/423 green) rather than trusted from the SUMMARY.

| Finding | Verified against source? | Severity | Does it re-break a closed truth? |
|---|---|---|---|
| **WR-09-01** — ✕ blurs (and persists) a focused field; Escape/pane-click unmount it directly and drop the edit silently, with no dirty indicator | YES — `WorkflowBuilderPage.tsx:213-231` (no blur-before-unmount logic), `PhaseFormPanel.tsx:183,193` (`onBlur={onPersist}`) confirm the asymmetry the review's live probe measured (`Escape → 0 PATCH`, `✕ → 1 PATCH`) | Warning (reviewer's own call — not Critical, because `onPersist` PATCHes the WHOLE definition, so any later blur/explicit Save re-sends the dropped edit) | Narrows, does not reverse, truth #8's canvas-structural half. It is a genuine, bounded data-loss-adjacent bug in the NEW dismissal surface and deserves more weight than a pure a11y nit — flagged prominently here, not silently passed. |
| **WR-09-02** — the T-183-12 "dismissal writes nothing" test assertion is pinned on the ✕ tests (the one path that DOES write when a field is focused) and omitted from the Escape/pane-click tests (the two paths that provably never write) | YES — confirmed by reading `WorkflowBuilderPage.canvas.test.tsx`'s dismissal block: neither ✕ test ever focuses a field, so the `mockUpdate`-called-0-times assertion is green by construction | Warning ("a gate that lies" — the same failure class this phase has now named three times) | The SUMMARY's claim "Dismissal writes nothing... confirmed" is **true only for the untested case**; the real-world case (a user edits a field, then clicks ✕) is unproven by the suite and disproven live by the reviewer's probe. |
| **WR-09-03** — dismissal drops keyboard focus to `<body>`, no restoration to the originating node | YES — confirmed no `.focus()` call anywhere in `clearSelection` or the ✕ handler | Warning (bounded — surface stays operable, but it lands on exactly the keyboard/switch-user population CR-01/WR-08-01 were fixed for) | Does not reverse GAP-1's core capability (the panel CAN be closed); it is a focus-management gap in how it closes. |
| **WR-09-04** — the `event.repeat` guard returns before `event.preventDefault()`, so `preventDefault` only fires on the first event of a held press | YES — confirmed at `WorkflowCanvas.tsx:234` (`if (event.repeat) return`) sitting BEFORE `:247` (`event.preventDefault()`) | Warning (low practical impact today — ancestors are `overflow-hidden`) | Does not reverse GAP-2's core fix (one activation per press still holds); it reopens a smaller version of the same "comment promises more than the code does" pattern this phase keeps tripping on. |
| **WR-09-05** — the header is `justify-between` with 3 children now; the phase-type chip floats mid-header instead of sitting flush with the ✕ | YES — confirmed `PhaseFormPanel.tsx:447` (`className="flex items-center justify-between ..."`) with three children at `:448-468`, none carrying `flex-1` | Warning (visual regression on a sketch-governed surface, invisible to the suite) | Cosmetic; does not affect any must-have. |
| **WR-09-06** — `onClose` being required pins the WIRING, not the STATE; a `selectedSlug` that no longer resolves to a phase would still render the unclosable resting rail | YES — confirmed `panelOpen = selectedSlug !== null` (`WorkflowBuilderPage.tsx:188`) is independent of `selectedPhase` resolution (`:236-239`) | Warning (latent — reviewer could not construct a reachable path today; becomes live once Phase 184 allows phase deletion/rename) | Does not reverse GAP-1 today; correctly flagged as a landmine for Phase 184. |

**Judgment.** GAP-1/2/3's core defects are genuinely, substantively fixed — not nominally. The
one finding I weighed most heavily against the phase's own "read-only" framing is WR-09-01/02,
because the orchestrator specifically asked me to scrutinize the invariant that every net-new
path "reaches `setSelectedSlug` and nothing else." Read literally, that claim is false for the
✕ path. I did not fail truth #8 outright because: (a) the write in question is the SAME
pre-existing field-level autosave mechanism that already shipped before `183-09` — no NEW write
capability was introduced, and no canvas node was ever mutated; (b) the independent code
reviewer classified it Warning, not Critical, with a reasoned bounded-impact argument
(`onPersist` PATCHes the whole definition, so the edit is not permanently lost, only delayed);
and (c) the project's own established precedent (this phase's `183-REVIEW.md` WR-02/03/04 and
`183-REVIEW-08.md` WR-08-01..04) treats reviewer Warnings that don't reverse a core truth for
the common case as recorded debt requiring a team decision, not an automatic `gaps_found`
trigger. I am recording it with more prominence than a typical Warning, though, because it
touches user data (a silently dropped edit) rather than pure presentation — **this specific
finding deserves an explicit operator/team decision**, not a default "accept as debt."

**If the team wants a harder bar:** WR-09-01 has a concrete, small fix already specified in
`183-REVIEW-09.md` (blur the active element inside the panel before releasing the selection,
so Escape/pane-click match the ✕'s save behavior) with a pinned regression test. This is the
single highest-value follow-up item from this pass.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/components/workflows/PhaseFormPanel.tsx` | Required `onClose` prop, ✕ button in header | VERIFIED | `:70-73` (prop), `:460-468` (button); resting rail unchanged (`:416-428`, no close control — correct per Test 7) |
| `frontend/src/pages/WorkflowBuilderPage.tsx` | `clearSelection` + Escape effect + both mount-site wirings | VERIFIED | `:213-215`, `:224-231`, `:509`, panel mount site (region ~`:648`) |
| `frontend/src/components/workflows/WorkflowCanvas.tsx` | `onPaneClick`, `event.repeat` guard | VERIFIED | `:234` (guard), `:326` (`onPaneClick={onClearSelection}`); guard fires before `preventDefault` (WR-09-04, Warning) |
| `frontend/src/components/workflows/canvasModel.ts` | `domAttributes` clearing `aria-describedby` on both inert node types | VERIFIED | `:306`, `:335` — exactly 2 occurrences, matching the plan's acceptance criterion |
| `__snapshots__/canvasModel.fixtures.test.ts.snap` | Additive-only growth, 15 `domAttributes` keys | VERIFIED | Independently confirmed via git history described in SUMMARY (0 deletions, 15 keys added); not re-diffed byte-for-byte in this pass but consistent with the green `canvasModel.fixtures.test.ts` run inside the 423-test suite I re-ran |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `PhaseFormPanel.tsx` (✕ button) | `WorkflowBuilderPage.clearSelection` → `setSelectedSlug(null)` | required `onClose` prop | WIRED | Confirmed `onClick={onClose}` (`:464`) and the prop threaded from `WorkflowBuilderPage.tsx`'s panel mount site |
| `WorkflowCanvas.tsx` (`<ReactFlow onPaneClick>`) | `WorkflowBuilderPage.clearSelection` | required `onClearSelection` prop | WIRED | Confirmed `:326` and `:509` |
| `window` Escape listener | `WorkflowBuilderPage.clearSelection` | `panelOpen`-gated `useEffect` | WIRED | Confirmed `:224-231`; add/remove symmetric, gated so no listener exists at rest |
| `WorkflowCanvas.tsx` keyboard (mouse-equivalent) | `WorkflowBuilderPage.handleSelectNode` | `onKeyDown={activateFromKeyboard}` with the new `event.repeat` guard | WIRED, guard confirmed | `:234` guard sits ahead of the existing `:236-248` selection logic — unchanged in intent, narrowed in event count |
| **Field autosave (pre-existing) ↔ the NEW ✕ path** | `updateWorkflowDraft` (PATCH) | native `blur` firing before `click` on a focused field | **WIRED — but asymmetrically, per WR-09-01/02** | This is the finding discussed above: a real, live-probed write path exists on the ✕ but not on Escape/pane-click, contradicting the plan's literal "reaches setSelectedSlug and nothing else" framing for that one path. |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|--------------|-------------|--------------|--------|----------|
| CANVAS-01 | 183-01 through 183-09 (all 9 plans) | "A user can view an existing workflow as a visual node canvas — a read-only projection of its WorkflowDefinition (nodes = phases, edges = flow + skip_to_phase branches), rendered via @xyflow/react." | SATISFIED | `REQUIREMENTS.md:27` carries `[x] CANVAS-01`; `:105` maps it to "Phase 183 / Complete." This verification treats those lines as the plan's aspiration, not evidence — the evidence is the source-level checks above. No orphaned CANVAS-* requirement exists for this phase (only one row maps to Phase 183). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `WorkflowBuilderPage.tsx` / `PhaseFormPanel.tsx` | `:213-231` / `:183,193` | Escape/pane-click silently drop an in-flight field edit while the ✕ saves it (WR-09-01) | Warning (elevated prominence — touches user data) | A user who edits a field then presses Escape or clicks the canvas loses that edit until their next blur/explicit Save; no dirty indicator warns them |
| `WorkflowBuilderPage.canvas.test.tsx` | dismissal block | The T-183-12 "writes nothing" assertion is pinned on the one path that can write and omitted from the two that cannot (WR-09-02) | Warning | The suite is green by construction on the untested (no-focused-field) case; does not protect the real-world scenario |
| `PhaseFormPanel.tsx` / `WorkflowBuilderPage.tsx` | `:460-468` / `:213-215` | No focus restoration to the originating node after dismissal (WR-09-03) | Warning | Keyboard/switch users lose their place after closing the panel |
| `WorkflowCanvas.tsx` | `:234-247` | `event.repeat` guard returns before `preventDefault` (WR-09-04) | Warning | Held Space's default action is suppressed for only the first event of the press |
| `PhaseFormPanel.tsx` | `:447-469` | `justify-between` header with 3 un-flexed children; the type chip floats mid-header (WR-09-05) | Warning | Cosmetic, on a sketch-governed surface |
| `PhaseFormPanel.tsx` / `WorkflowBuilderPage.tsx` | `:188` vs `:236-239` | `panelOpen` and `selectedPhase` can theoretically disagree, reopening the unclosable-rail condition (WR-09-06) | Warning (latent, no reachable path today) | Becomes live once Phase 184 allows phase delete/rename |
| — | — | Debt markers (`TBD`/`FIXME`/`XXX`) | None found | `grep` clean across all four `183-09`-touched source files, independently re-run |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Phase-scoped suite green (incl. all 9 new `183-09` tests) | `cd frontend && npx vitest run src/components/workflows src/pages/WorkflowBuilderPage.canvas.test.tsx src/providers/EffectiveFeaturesProvider.test.tsx src/components/admin/revertByteIdentical.test.tsx` — independently re-run by me | 16 files, **423 passed, 0 failed** | PASS |
| Per-file test-count pins hold (Phase 177 lesson) | `grep -c "it(" <file>` on the three touched test files — independently re-run by me | `PhaseFormPanel.test.tsx` 19, `WorkflowCanvas.test.tsx` 31, `WorkflowBuilderPage.canvas.test.tsx` 22 — all match plan targets exactly | PASS |
| ✕ button exists and is required-prop-wired | Direct source read | Confirmed at `PhaseFormPanel.tsx:460-468` | PASS |
| `event.repeat` guard present | Direct source read | Confirmed at `WorkflowCanvas.tsx:234` | PASS |
| `domAttributes` ARIA suppression present | Direct source read | Confirmed at `canvasModel.ts:306`, `:335` | PASS |
| Dismissal is write-free in ALL cases (not just the untested one) | No such test exists for the focused-field ✕ case | Reviewer's live probe shows `updateWorkflowDraft` fires once via the ✕ when a field is focused | FAIL (WR-09-01/02, Warning-level per the judgment above, not phase-blocking) |
| No source file uncommitted / drifted | `git status --porcelain -- frontend/src/components/workflows frontend/src/pages/WorkflowBuilderPage.tsx` | Empty | PASS |

### Probe Execution

Not applicable — no `scripts/*/tests/probe-*.sh` declared or discovered; this is a frontend
component gap-closure plan, not a migration/tooling phase.

### Human Verification Required

The four original G-4 rows (U-1..U-4) plus the post-183-08 keyboard/screen-reader row remain
closed from the prior pass (`183-HUMAN-UAT.md`, commit `65e6ff5d`, 5/5 pass) and are NOT
re-opened by this pass — `183-09` did not touch anything those rows exercise. Two NEW rows were
added to `183-VALIDATION.md` by `183-09` specifically because jsdom cannot settle the
operator's original complaint (discoverability), and neither has been driven live yet:

### 1. U-5: The step panel closes the obvious way, CANVAS view

**Test:** Flag ON. Open a draft → `[⬡ Canvas]` → click a step.
**Expected:** A close control in the panel header is spottable without hunting; clicking it
returns the panel to the thin rail; Escape does the same; clicking empty canvas space does the
same.
**Why human:** "Findable without being told" is exactly the discoverability complaint that
produced this gap-closure plan (`183-HUMAN-UAT.md` Gap 1). A DOM test proves the button
exists and the callback fires; only a live pass proves a real user notices it unprompted.

### 2. U-6: The step panel closes the obvious way, SPINE view, flag OFF

**Test:** Flag OFF (Control Room), reload. Open a draft → the Spine → click a step.
**Expected:** The same ✕ is present and closes the panel; Escape closes it. No
`[Spine]/[Canvas]` strip and no canvas subtree may appear (D-181-01 unchanged).
**Why human:** The defect was pre-existing Spine debt inherited by the canvas, not a canvas
regression, so the fix must be confirmed live on the shipped surface where it was originally
reported — the exact surface an operator will actually use day to day.

**Recommended additional live check while U-5/U-6 are being driven (not a new formal row, but
cheap to fold in given the operator is already there):** edit a field's text in the panel, then
dismiss via Escape or pane-click instead of the ✕, and confirm whether the edit survives a
reload. This would give the operator direct, first-hand visibility into WR-09-01 rather than
leaving it as a code-only finding.

### Gaps Summary

No must-have FAILED outright. All three confirmed live-UAT defects (GAP-1/2/3) are genuinely,
substantively fixed in code, verified by direct source read (not the SUMMARY's narration) and
by an independently re-run 423/423-green test suite with exact per-file test-count matches
(the Phase 177 lesson). No regression was introduced in any of the phase's original four
Success Criteria.

One finding — WR-09-01/02, the ✕-path autosave firing while Escape/pane-click silently drop an
in-flight edit — contradicts the plan's own literal "reaches setSelectedSlug and nothing else"
framing for the read-only invariant. I did not fail the phase over it because the write in
question is a PRE-EXISTING autosave mechanism (not a new canvas-mutation capability), the
independent code reviewer classified it Warning/bounded-impact rather than Critical, and the
project's own established precedent for this phase treats non-reversing Warnings as recorded
debt for a team decision rather than an automatic gate. It is recorded here with elevated
prominence, not silently passed, because it touches user data rather than pure presentation.

**What keeps this pass at `human_needed` rather than `passed` is the same category of gate
that has gated every 183 pass so far: live UAT.** `183-09` added exactly two rows (U-5, U-6) to
close the discoverability question its own gap-closure work exists to answer, and neither has
been driven yet. Per the phase's own validation strategy (and the G-4 guardrail), this is the
honest status, not a paperwork formality — jsdom proved the button EXISTS; nothing yet proves a
real user FINDS it, which is the entire premise of `183-09`.

**Recommended next steps, in order:**
1. Operator (or Claude driving Chrome MCP) drives U-5 and U-6 live and records the result in an
   updated `183-HUMAN-UAT.md`, ideally including the WR-09-01 edit-then-Escape survival check
   above.
2. Separately: decide whether WR-09-01 (the edit-loss asymmetry) warrants a small immediate
   follow-up — it already has a specified fix and test in `183-REVIEW-09.md` — or should join
   WR-08-02/03, WR-02/03/04, IN-01…IN-09-05 as accepted, recorded debt carried into Phase 184.

---

_Verified: 2026-07-26T18:30:00Z_
_Verifier: Claude (gsd-verifier)_
