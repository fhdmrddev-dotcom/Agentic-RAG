---
phase: 118-auto-classification
plan: 06
subsystem: frontend
tags: [frontend, classification, rules-page, rule-builder, automation-sidebar, push-split-panel, CLASS-01, UX-01]
requires:
  - "Plan 04 client seam: ClassificationRule type + listRules/createRule/updateRule/deleteRule + the 'classification-rules' ActiveView (frontend/src/lib/api.ts + types/index.ts + App.tsx)"
  - "Plan 04: resolveAdHoc/resolveFilterCount (the 'would match N' count, REUSED) + the SAME ViewFilter AST for match_expr"
  - "Plan 02 live /classification-rules CRUD backend (request/response shapes, is_global hard-set, leak-safe own+global)"
  - "Phase 114 ConditionPopover + ViewCondition chip-strip grammar (the builder condition editor, reused verbatim)"
  - "Phase 114 NavRow shared sidebar-row primitive + ViewsGroup clone-target shape"
provides:
  - "RuleBuilderPanel — chip-strip condition + folder-only action + scope segmented + live resolveAdHoc preview + honesty line; create/update save omitting is_global"
  - "AutomationGroup — the 'Automation' sidebar group (peer to Folders + Views): NavRow rule rows with the 037-A anatomy, live enabled toggle, G pill, kebab edit/delete"
  - "ClassificationRulesPage — rules list (via listRules) + right-side push/split builder (state-switch, no router); honest loading/error/empty states"
affects:
  - "Phase 118 verify-phase (G-4 lived-experience UI UAT: builder live count, toggle, edit/delete, mobile)"
  - "The IngestionPage/ChatLayout mount of the 'classification-rules' route + the sidebar Automation group launcher (a follow-on wiring step — NOT in this plan's files_modified scope)"
tech-stack:
  added: []
  patterns:
    - "Builder reuses the EXISTING resolveAdHoc({count_only:true}) for the 'would match N' preview — a rule's match_expr is the SAME ViewFilter AST (no new count fn, no new endpoint)"
    - "createRule's body OMITS is_global (server hard-sets it; the scope toggle is an authoring affordance, never a create-body flag — T-118-06-01)"
    - "right-side push/split panel as a React state-switch (minmax(0,1fr) <panel>, no router) — the 027/112/117 shell"
    - "AutomationGroup clones ViewsGroup: shared NavRow rows (never a FolderNode clone) + Radix kebab + inline delete-confirm"
    - "the enabled toggle rides updateRule(id,{enabled}) — no separate endpoint"
key-files:
  created:
    - "frontend/src/components/classification/RuleBuilderPanel.tsx"
    - "frontend/src/components/classification/RuleBuilderPanel.test.tsx"
    - "frontend/src/components/classification/ClassificationRulesPage.tsx"
    - "frontend/src/components/classification/ClassificationRulesPage.test.tsx"
    - "frontend/src/components/ingestion/AutomationGroup.tsx"
    - "frontend/src/components/ingestion/AutomationGroup.test.tsx"
  modified: []
decisions:
  - "AutomationGroup uses a native role=switch toggle button (aria-checked + aria-label) — the app ships no shadcn Switch component; keyboard-operable + coarse-pointer friendly (UX-01 / AA)"
  - "The rule-row 'condition (mono) → 📁 action' summary is a STATIC frozen render under the NavRow — the per-rule 'would match N' live count is owned by the builder, not the row (D-118-2: a rule is a forward-only upload trigger, not a live saved filter), so AutomationGroup has NO lazy fetchCount"
  - "RuleBuilderPanel's folder action is a plain <select> over the caller's own+global folders (the 📁-only action, the 🏷 tag radio DROPPED per D-118-1)"
  - "The scope segmented control maps to private/global state but the create body NEVER sends is_global (T-118-06-01); EDIT mode seeds the toggle from rule.is_global for display only"
metrics:
  duration: "~8 min"
  completed: "2026-06-21"
  tasks: 2
  commits: 2
  files_changed: 6
---

# Phase 118 Plan 06: Classification Rules Page (Builder + Automation Sidebar) Summary

The rules-authoring surface of CLASS-01 + UX-01 (locked G-2 sketch 037-A, Winner A): a
dedicated Classification-rules page that lists rules with the 037-A row anatomy and opens
a right-side push/split builder. The builder composes a chip-strip condition (reusing the
029/114 `ViewCondition` grammar) → a 📁-folder-only action (the 🏷 tag radio dropped per
D-118-1) → a scope segmented control → a live "would match N of M" preview that reuses the
EXISTING `resolveAdHoc({count_only:true})` with the forward-only honesty line, and saves via
`createRule`/`updateRule` (the create body omitting `is_global`). The "Automation" sidebar
group (peer to Folders + Views) lists rules from the shared `NavRow` with a live enabled
toggle, the `G` global pill, and a kebab that edits/deletes.

## What Was Built

### Task 1 — `RuleBuilderPanel.tsx` (+ test) — commit `56d07c5c`

The builder in the right-side push/split panel shell (027/112/117 — `minmax(0,1fr) <panel>`,
no-router state-switch):

- **Chip-strip condition** — reuses the `ConditionPopover` field→type-aware-op→value editor
  (Phase 114) verbatim; chips render the SAME plain-language summary as the FilterBar
  (`field is value` + `＋condition`, flat AND). Add/edit/remove a chip mutates the local
  `ViewFilter`.
- **📁 folder action ONLY** (D-118-1) — a labeled `<select>` over the caller's own+global
  folders (`aria-label="Suggested folder"`). **There is NO 🏷 tag radio** — the only `tag`
  strings in the file are the comments documenting that it was dropped.
- **scope segmented** — native radios (`👤 Only me` / `🌐 Global G`), **default Only me**;
  keyboard-operable + screen-reader legible (UX-01 / AA).
- **Live "would match N of M" preview** — a debounced (`300ms` default) call to the EXISTING
  `resolveAdHoc({ op:"and", conditions }, { count_only: true })` — **a rule's `match_expr` is
  the SAME `ViewFilter` AST, so NO new count fn and NO new backend endpoint**; amber at zero;
  + the verbatim forward-only honesty line *"existing docs aren't moved — rules suggest on
  new uploads only"* (D-118-2).
- **Save** — `createRule(name, match_expr, suggest_folder_id)` with a body that **OMITS
  `is_global`** (the server hard-sets it false; the scope toggle is an authoring affordance,
  not a create-body flag — T-118-06-01); `updateRule(id, {...})` when editing an existing
  rule (pre-filled name + conditions + folder).

### Task 2 — `AutomationGroup.tsx` + `ClassificationRulesPage.tsx` (+ tests) — commit `dc7ce84f`

**`AutomationGroup.tsx`** — clones `ViewsGroup`: an uppercase tracked **"Automation"** group
header (peer to Folders + Views), each rule row built from the **SHARED `NavRow`** (never a
FolderNode clone) with a `Zap` icon (green when enabled, dim when disabled — the 037-A enabled
dot), the tooltip-labeled `G` global pill (`isGlobal={rule.is_global}` — shown only for global
rules), a **live `role="switch"` enabled toggle** that PATCHes `updateRule(id, {enabled})`, and
Edit / Delete kebab actions (delete → inline confirm → `deleteRule`). The 037-A
`condition (mono) → 📁 action` summary is a **static frozen render under the row** (the per-rule
"would match N" live count is owned by the builder, not the row — D-118-2), so there is NO lazy
`fetchCount`. Honest empty state ("No classification rules yet").

**`ClassificationRulesPage.tsx`** — the dedicated page (the `App.tsx` `ActiveView`
`"classification-rules"` from Plan 04 routes here): lists rules via `listRules()` in the
`AutomationGroup`, opens `RuleBuilderPanel` in the right-side push/split panel
(`minmax(0,1fr) 430px`, no router; React state-switch) on **New rule** / Edit, with **honest
states** loading (`role=status`) ≠ error (`role=alert` + Try again) ≠ a calm empty. Save / toggle
/ delete **reconcile by re-fetch** (`listRules`), not an optimistic splice. Folders (the builder's
📁 options) + custom fields (the condition popover) load alongside and degrade to empty sets on
failure (never a page error). Collapses to a single full-width column below the 768px mobile
breakpoint.

## Verification Results

- **Plan-owned tests GREEN:** `vitest run RuleBuilderPanel AutomationGroup ClassificationRulesPage`
  → **3 files / 19 tests passed** (RuleBuilderPanel 7 + AutomationGroup 6 + ClassificationRulesPage 6).
- `npx tsc --noEmit` **EXIT 0** (run after each task).
- **Task 1 acceptance greps:** `grep -niE "tag" RuleBuilderPanel.tsx` shows only the D-118-1
  drop comments (no tag-radio action); `resolveAdHoc({...},{count_only:true})` is the preview
  source (no new count fn); the exact honesty copy renders; `createRule(name.trim(), matchExpr,
  suggestFolder)` is a **3-arg call with no `is_global`** (the test also asserts
  `createRule.mock.calls[0].toHaveLength(3)`); the only `is_global` references seed the EDIT
  scope toggle (display) + a folder-global label + comments.
- **Task 2 acceptance greps:** `NavRow` imported + used in AutomationGroup (shared row, not a
  FolderNode clone); `updateRule(rule.id, { enabled: !rule.enabled })` (live toggle);
  `RuleBuilderPanel` imported + mounted in ClassificationRulesPage; the "Automation" header
  literal present; ClassificationRulesPage is **201 lines** (≥ 50 `min_lines`).
- **G-5:** `threads.py` byte-untouched (`git diff a7986c2b HEAD -- backend/app/api/threads.py`
  = 0 lines).
- **Net-new failures = 0 (by construction):** all 6 files are net-new; **no existing source
  file imports any of the 3 new components** (`grep -rln` outside their own test files = empty),
  so no existing symbol was modified. The only importers are the 3 new test files (all GREEN).
  Sibling-dir regression spot-check `vitest run NavRow ViewsGroup FilterBar DocumentList
  ClassificationSection` → **6 files / 59 tests passed** (the shared ingestion dir is
  unaffected).
- No file deletions in either commit; no new untracked files under classification/ingestion.
- No new package, no new migration.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Toggle test regex matched the wrong accessible name**
- **Found during:** Task 2
- **Issue:** The AutomationGroup enabled toggle's `aria-label` is action-relative — for an
  ENABLED rule it reads "Disable rule {name}". The first draft of the toggle test searched for
  `role="switch"` with a name regex `/enable.../i`, which does not match "Disable rule Acme
  Invoices" → the test failed though the component was correct.
- **Fix:** Corrected the test regex to `/disable rule Acme Invoices/i` (the real accessible name
  for an enabled rule) and asserted the switch is `toBeChecked()`. Test-only change; the
  component's action-relative label is the intended a11y wording.
- **Files modified:** `frontend/src/components/ingestion/AutomationGroup.test.tsx`
- **Commit:** `dc7ce84f`

**2. [Rule 3 - Blocking] Radix DropdownMenu kebab did not open under `fireEvent.click` in jsdom**
- **Found during:** Task 2
- **Issue:** The 037-A kebab uses the Radix `DropdownMenu` (cloned from `ViewsGroup`). Radix
  listens for pointer-capture events and calls `scrollIntoView` — APIs jsdom does not implement —
  so `fireEvent.click` on the trigger is a no-op and the menu items (Edit rule / Delete) never
  mount into the portal. The kebab-edit / kebab-delete tests (AutomationGroup + the
  ClassificationRulesPage edit test) could not find the items.
- **Fix:** Added the standard Radix-+-jsdom shim (`hasPointerCapture`/`setPointerCapture`/
  `releasePointerCapture`/`scrollIntoView` no-op stubs) in a `beforeEach` and drove the menu
  with `@testing-library/user-event` (which fires the pointer events Radix needs) instead of
  `fireEvent.click` — mirrored verbatim from the shipped `ViewsGroup.test.tsx`. Test-harness
  only; the component is unchanged and matches the ViewsGroup kebab pattern.
- **Files modified:** `frontend/src/components/ingestion/AutomationGroup.test.tsx`,
  `frontend/src/components/classification/ClassificationRulesPage.test.tsx`
- **Commit:** `dc7ce84f`

### Scope note (not a deviation)

This plan's `files_modified` scopes the three classification components + their tests ONLY. The
`App.tsx` `ActiveView` union member `"classification-rules"` already exists (Plan 04), but the
actual **mount** of `ClassificationRulesPage` into `ChatLayout` and a sidebar **launcher** for
the Automation group are a follow-on wiring step (`ChatLayout.tsx` / `IngestionPage.tsx` are not
in this plan's files). Surfaced under `affects:` so verify-phase / a wiring plan can close it; the
page renders correctly when routed.

## Authentication Gates

None.

## Known Stubs

None. The three components are real and fully wired against the Plan-04 client family
(`listRules`/`createRule`/`updateRule`/`deleteRule` + the reused `resolveAdHoc`) and the Plan-02
live backend. Grep-verified: no `TODO`/`FIXME`/placeholder/"coming soon"/"not available" stubs
(the only `placeholder=` occurrences are real UX input hints). The page is not yet mounted into
the app shell — that is an out-of-scope wiring step (see Scope note), not a stub of this plan.

## Threat Flags

None. The three components introduce no new network surface — they consume the existing
Plan-04 client family (the leak-safe own+global rule reads, the `is_global` hard-set, and the
`match_expr` whitelist validation are all server-side; the client is not a trust boundary, per
the plan threat register T-118-06-01/02). The "Global" scope toggle cannot self-elevate a created
rule because the create body never carries `is_global` (asserted by the
`createRule.mock.calls[0].toHaveLength(3)` test).

## Self-Check: PASSED

- Created files exist:
  - `frontend/src/components/classification/RuleBuilderPanel.tsx` — FOUND
  - `frontend/src/components/classification/RuleBuilderPanel.test.tsx` — FOUND
  - `frontend/src/components/classification/ClassificationRulesPage.tsx` — FOUND
  - `frontend/src/components/classification/ClassificationRulesPage.test.tsx` — FOUND
  - `frontend/src/components/ingestion/AutomationGroup.tsx` — FOUND
  - `frontend/src/components/ingestion/AutomationGroup.test.tsx` — FOUND
- Commits exist:
  - `56d07c5c` — FOUND (Task 1: RuleBuilderPanel)
  - `dc7ce84f` — FOUND (Task 2: AutomationGroup + ClassificationRulesPage)
