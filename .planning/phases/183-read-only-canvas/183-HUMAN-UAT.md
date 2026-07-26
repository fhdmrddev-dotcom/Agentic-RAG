---
status: diagnosed
phase: 183-read-only-canvas
source: [183-VERIFICATION.md]
started: 2026-07-26T05:10:00Z
updated: 2026-07-26T07:20:00Z
---

## Current Test

[testing complete]

## Precondition (do this first)

`visual_workflow_canvas` cold-defaults to `"off"`. Flip it **On** in the Control Room before
running U-1 … U-3. U-4 is the test that flips it back Off.

## Tests

### 1. U-1: Spine ⇄ Canvas agree, in both Technical-names OFF and ON modes
expected: Open a real draft in the Builder. With the reveal OFF, flip [≣ Spine] ⇄ [⬡ Canvas] both ways — same steps, same order, same icons. Turn the reveal ON and flip both ways again — same result, and a given phase's title text is identical across the toggle at the same reveal setting.
result: pass

### 2. U-2: The 5-phase maximum (eval_coverage) reads at default zoom
expected: Titles not truncated to nonsense, no horizontal page overflow, the end cap visible.
result: pass
note: "Passed as specified. User reported a SEPARATE issue observed during this test — see Test 6 / Gap 1: opening the side panel for any node gives no way to close it."

### 3. U-3: The empty draft (0 phases) doesn't look broken
expected: Reads as "nothing here yet" — no stray grid, zoom pills, or minimap floating in space; no ghost/placeholder node. (40 of 95 live definitions have zero phases, so this is the most common canvas state.)
result: pass
evidence: |
  Driven live in Chrome (Claude at the wheel, operator confirmed the visual). The empty
  state does NOT mount React Flow at all — DOM check: `.react-flow` absent, 0 nodes,
  no `.react-flow__background` / `__controls` / `__minimap` / `__attribution`. Renders a
  dedicated "No steps yet · Add a step to this workflow and it will appear here."
note: |
  TEST-DESIGN DEFECT FOUND (does not affect the pass). The row's premise — "40 of 95 live
  definitions have zero phases, so this is the most common canvas state" — is wrong, and
  the state was UNREACHABLE through the UI when this row was first authored:
    - Those 40 zero-step rows are Phase-167 routing-test fixtures named `Global WF` /
      `Preview WF`, all `status: published`. They render on NO shelf: Published fetches
      `scope:"mine"` (WorkflowsPage.tsx:151) so `is_system_global` rows are excluded;
      Starters shows only curated starters; Drafts shows only drafts.
    - The [Spine]/[Canvas] toggle only exists in the Builder's `drafted` state
      (WorkflowBuilderPage.tsx:380), and the Builder has no delete-step affordance, so a
      user cannot reduce a draft to zero steps either.
  To make the row testable, a throwaway zero-step draft (`uat183-empty-canvas`) was
  seeded into the local dev DB under the operator's account, driven, then deleted.
  Carry into Phase 184: once authoring lands and steps CAN be deleted, this state becomes
  genuinely user-reachable and this row becomes a real regression guard.

### 4. U-4: Flag off = yesterday's Builder, including on an operator account
expected: Operator flips `visual_workflow_canvas` to Off in the Control Room, reloads. The [Spine]/[Canvas] toggle strip is gone and no `.react-flow` subtree mounts — for every account type, including operators.
result: pass
evidence: |
  Operator flipped the flag Off in the Control Room; Claude drove the reload + Builder
  open in Chrome on the same operator account. DOM check on a real draft:
  `[Spine]/[Canvas]` toggle absent, `.react-flow` absent, and
  `document.querySelectorAll('[class*="react-flow"]').length === 0` — no subtree at all,
  not merely a hidden one. Builder renders the pre-183 spine unchanged.
note: |
  OPERATOR OBSERVATION (not a defect — expected behavior, confirmed against source).
  The operator noted the flip "only [takes effect] if I refresh, not directly."
  This is BY DESIGN: `EffectiveFeaturesProvider` documents "a context keeps the fetch
  budget at exactly one per session" — the effective-features probe runs once at app
  mount, and `refetch` is reachable only from App's `FEATURE_FORBIDDEN_EVENT` (a server
  403) and the WR-01 `userId`-keyed re-probe on SPA sign-in. U-4's own expected text
  includes "reloads", so the row is satisfied as written.
  CARRY-FORWARD CONSIDERATION for the v3.6 revert story: `visual_workflow_canvas` is the
  master KILL SWITCH for the whole canvas layer (D-181-01..08). Because propagation is
  reload-gated, already-open sessions keep rendering the canvas after an operator kills
  it, until each tab reloads or the server 403s one of their calls. Acceptable for a
  planned rollback; worth a decision if the switch is ever needed as an INCIDENT control.

### 5. Keyboard activation with a real screen reader (added after 183-08 closed CR-01)
expected: Tab to a step and press Enter, then Space. The step's details open, and what the screen reader announces matches what the surface actually does — no promise of arrow-key movement or delete-to-remove on this read-only canvas. jsdom proves the callback fires and the string is present; only a live pass proves what a user hears.
result: pass
evidence: |
  Driven live in Chrome by Claude against the real accessibility tree (the same source a
  screen reader reads from) + REAL key presses via CDP, on the flag-ON Builder Canvas.
  PASSING:
    - Tab reaches the steps (both phase nodes in tab order, right after ⌥ Technical names)
    - Real phase nodes: role="button", tabindex="0"
    - Accessible name: "Phase 1: Work out how to do it (llm_agent)"
    - aria-describedby -> "Press enter or space to open this step's details."
      HONEST — no arrow-key-move / delete-to-remove text anywhere in the tree (WR-06
      confirmed CLOSED live, not just in jsdom)
    - Enter opens the step's detail panel; Space activates; Space does NOT scroll the
      page (preventDefault confirmed: window.scrollY stayed 0)
  Not verifiable by Claude: the literal Narrator/NVDA audio. The a11y tree above is the
  source a screen reader renders, so the announced string is determined by it.
note: |
  TWO PREVIOUSLY-THEORETICAL WARNINGS CONFIRMED LIVE (operator accepted as recorded debt):
    - WR-08-01 (held-key repeat, UNGUARDED — confirmed by experiment): fired 1 real
      keydown + 1 `repeat:true` keydown on a focused node; the panel returned to its
      starting state, proving BOTH events toggled. Holding Enter/Space therefore
      rapid-toggles the panel and settles on whatever parity the key release lands on —
      hitting exactly the keyboard/switch-user population CR-01 was fixed for.
    - WR-08-04 (aria-describedby leak on inert nodes — confirmed): the `__canvas__end`
      end-cap node has role=null and is NOT focusable, yet still carries
      aria-describedby -> "Press enter or space to open this step's details.", a promise
      it cannot honor.
  Operator verdict at the checkpoint: PASS, defects stay recorded debt (consistent with
  183-VERIFICATION.md's treatment of WR-08-01..04). Both remain candidates for a 183-09
  gap-closure plan before Phase 184 builds on this surface.

### 6. Node side panel can be dismissed (observed during U-2)
expected: After selecting a node and opening its side panel, the user can close/dismiss the panel and return to the full canvas.
result: issue
reported: "on Note if I open the side panel for any node there is no close button to that panel"
severity: major

## Summary

total: 6
passed: 5
issues: 1
pending: 0
skipped: 0
blocked: 0

## Gaps

- truth: "After selecting a node, the opened side panel can be closed/dismissed by the user"
  status: failed
  reason: "User reported: on Note if I open the side panel for any node there is no close button to that panel"
  severity: major
  test: 6
  root_cause: |
    The panel has exactly ONE dismissal path and it is undiscoverable: re-activating the
    SAME node. `handleSelectNode` (WorkflowBuilderPage.tsx:206) is a toggle —
    `setSelectedSlug(cur => (cur === slug ? null : slug))` — and `panelOpen` is derived
    purely from `selectedSlug !== null` (:188). Nothing else clears it. Confirmed live in
    Chrome: the panel subtree contains ZERO buttons; Escape does not close it; clicking
    the empty `.react-flow__pane` does not close it. Clicking (or pressing Enter/Space on)
    the already-selected node DOES close it — the only exit.
    SCOPE — NOT a Phase 183 regression: `handleSelectNode` + `PhaseFormPanel` are the
    shipped Spine-view pair, and Claude reproduced the identical zero-button panel by
    selecting a step in the [≣ Spine] view with the Canvas never opened. Phase 183 wired
    the canvas to the SAME callback (:484 alongside the Spine's :490), so it inherited
    the defect rather than introducing it — it just made it far easier to hit.
  artifacts:
    - path: "frontend/src/pages/WorkflowBuilderPage.tsx"
      issue: "handleSelectNode (:206) toggle is the sole dismissal path; no Escape handler; onPaneClick never wired to clear selectedSlug"
    - path: "frontend/src/components/workflows/PhaseFormPanel.tsx"
      issue: "Panel header renders no close (✕) control — 0 buttons in the panel subtree (verified live)"
  missing:
    - "A close (✕) button in the PhaseFormPanel header calling onSelectNode(selectedSlug) or a dedicated onClose -> setSelectedSlug(null)"
    - "Escape-to-close while the panel is open"
    - "Wire <ReactFlow onPaneClick> (and the Spine's empty-area click) to setSelectedSlug(null) so clicking away dismisses"
    - "Regression test: panel opens on select, closes via ✕ / Escape / click-away — asserted in BOTH Spine and Canvas views"
  debug_session: ""
  diagnosed_by: "orchestrator (live Chrome DevTools + source trace) — no debug subagent spawned"
