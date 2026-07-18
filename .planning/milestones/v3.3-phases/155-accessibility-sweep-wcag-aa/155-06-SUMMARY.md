---
phase: 155-accessibility-sweep-wcag-aa
plan: 06
subsystem: testing
tags: [a11y, wcag, vitest-axe, react, workflows, citations, settings, composer]

# Dependency graph
requires:
  - phase: 155-03
    provides: the jsx-a11y fix-to-zero + icon-button aria-label sweep this suite locks as a regression gate
  - phase: 152
    provides: the Run modal + run-input controls + workflow-delete confirm (WFIN-01/02/03) these suites audit
  - phase: 153
    provides: the citation UI cluster (CitedMarkdown/CitationPeek/CitationList/CitationCard/AbsenceHint) whose shipped a11y contracts this suite VERIFIES
  - phase: 154
    provides: the Settings "Show technical names" toggle + relabeled DocumentStatusBadge + composer mode helpers this suite audits
provides:
  - "Five `*.a11y.test.tsx` vitest-axe suites (RunModal, CitationUI, SettingsPage, MessageInput, DocumentStatusBadge) asserting zero STRUCTURAL axe violations across each surface's honest states — closes the D-12 net-new v3.3 surface inventory (152 + 153 + 154)"
  - "D-09 role/name proof the live operator keyboard drive depends on: scenario 1 (Run-modal file-input Tab-through + delete confirm), scenario 2 (citation peek role=dialog aria-modal=false + Esc), scenario 4 (Settings toggle + relabeled tabs + composer)"
  - "D-13 verify (not rebuild) of the 153 citation a11y contracts + G-5 proof (MessageItem/StreamsProvider untouched; replay suite green)"
  - "One D-14 documented per-rule exclusion (nested-interactive on the 153 role=button footer rows) + one D-06 deferred pre-existing-findings note (SettingsPage expert-config select-name + heading-order)"
affects: [155-verify-work, future-wcag-aa-sweep]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "settle-then-scan a11y leaf: render honest state → settle (findBy) → expect(await axe(el)).toHaveNoViolations() (STRUCTURAL only; jsdom can't compute contrast)"
    - "scope the axe scan to the NET-NEW surface, not the whole page: SettingsPage scans the toggle-row + tablist (net-new 154), deferring pre-existing expert-config findings to SEED-092-remainder (D-06)"
    - "VERIFY suite for a G-5-adjacent cluster: render the citation components DIRECTLY (never MessageItem/StreamsProvider); the MessageItem.test replay is the G-5 tripwire"
    - "D-14 per-rule exclusion scoped to the exact citation-row scans, with the row name AND the nested Open-document button asserted positively so the exclusion can never hide a real barrier"

key-files:
  created:
    - frontend/src/pages/__tests__/RunModal.a11y.test.tsx
    - frontend/src/components/chat/__tests__/CitationUI.a11y.test.tsx
    - frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx
    - frontend/src/components/chat/__tests__/MessageInput.a11y.test.tsx
    - frontend/src/components/ingestion/__tests__/DocumentStatusBadge.a11y.test.tsx
  modified:
    - .planning/phases/155-accessibility-sweep-wcag-aa/155-VALIDATION.md
    - .planning/seeds/SEED-092-remainder.md

key-decisions:
  - "D-14 exclusion: nested-interactive (WCAG 4.1.2 A) on the 153 `.citation-ref-row[role=button]` footer rows is a KNOWN, tracked design tradeoff (the sanctioned role=button container hosting an independently-reachable Open-document button) — excluded per-rule/per-selector, never globally, with the nested button asserted reachable; restructure logged to SEED-092-remainder (same pattern as NavRow/SkillCard)"
  - "D-06 deferral: a full-page SettingsPage scan surfaces PRE-EXISTING select-name (rerank/openrouter expert-config selects) + heading-order that predate v3.3 and sit outside the net-new 154 surface — the scan is SCOPED to the toggle row + tablist; the whole-page findings are logged to SEED-092-remainder, not fixed (test-only plan)"
  - "ASSERT-REAL-CONTRACT: the Settings 'Show technical names' control is a toggle BUTTON exposing aria-pressed (the shipped TechnicalNamesToggle), NOT a role=switch — the suite asserts the actual shipped contract (mirrors the 155-04 finding)"

patterns-established:
  - "net-new-surface a11y gate: scan the net-new region, assert the D-09 roles/names, defer pre-existing whole-page findings to SEED-092-remainder"
  - "citation VERIFY suite: prove 153 contracts (role=dialog aria-modal=false, aria-pressed pin toggle, Esc, no dangerouslySetInnerHTML) hold without touching G-5 hot files"

requirements-completed: [A11Y-01]

# Metrics
duration: 14min
completed: 2026-07-15
---

# Phase 155 Plan 06: Run modal + citation UI + 154-surface a11y suites Summary

**Five vitest-axe `*.a11y.test.tsx` suites (58 tests) close the D-12 net-new v3.3 surface inventory — the 152 Run modal (file-input trap-spot + workflow-delete confirm), the 153 citation cluster (VERIFIED, not rebuilt), and the 154 surfaces (Settings toggle/tabs, composer mode helpers, DocumentStatusBadge) — locking zero STRUCTURAL violations + the D-09 roles/names the live keyboard drive needs, with one honest D-14 exclusion and one D-06 deferral; no component source touched.**

## Performance

- **Duration:** 14 min
- **Started:** 2026-07-15T22:36:33Z
- **Completed:** 2026-07-15T22:50:00Z
- **Tasks:** 3 (+ 1 tsc-gate follow-up commit)
- **Files created:** 5 (test suites) · **Files modified:** 2 (planning docs)

## Accomplishments

- **RunModal.a11y.test.tsx** (8 tests) — axe scans the open modal + a staged-template state; asserts the D-09 scenario-1 file-input trap-spot contract (the hidden `<input type=file>` carries `tabIndex=-1` + `aria-label="Upload template file"` so Tab passes THROUGH it — not a trap — while a named proxy `<button>` drives the upload), the remove-template `aria-label="Remove template"`, the KB-scope combobox by role+name, `launchError` as `role="alert"`, and the workflow-delete confirm as a `role="dialog"` with an accessible name + a NAMED "Delete forever" (never colour-alone).
- **CitationUI.a11y.test.tsx** (20 tests) — a VERIFY suite (D-13) proving the shipped 153 contracts STILL hold: CitationPeek pinned = `role="dialog" aria-modal="false"` + accessible name + no trap; the pin toggle exposes `aria-pressed` + the state-toggled `aria-label` (Pin ↔ Unpin); Esc closes + restores marker focus; markers are `role="button"` owned nodes and a `<script>`/HTML payload stays inert (no `dangerouslySetInnerHTML`, T-155-06-XSS); reduced-motion honoured; never-colour-alone. Rendered the citation components DIRECTLY — MessageItem/StreamsProvider untouched (G-5), the MessageItem replay suite is green.
- **SettingsPage.a11y.test.tsx** (4 tests) — scans the net-new 154 surfaces (the "Show technical names" toggle row + the relabeled tablist); asserts the toggle's REAL contract (a `<button aria-pressed>`, NOT `role=switch`) and the relabeled tabs keep `role=tablist`/`role=tab` with accessible names (Search = the plain default of the D-04 relabel).
- **MessageInput.a11y.test.tsx** (7 tests) — scans idle/full/streaming composer states; asserts the textarea + Send/Stop + mode-selector by role+name, and that opening the mode menu exposes General/Explorer as named `menuitem`s whose one-line helper text is ASSOCIATED/announced (inside the item, never orphaned).
- **DocumentStatusBadge.a11y.test.tsx** (19 tests) — scans every status; asserts each status is conveyed by a visible WORD (never colour-alone) in BOTH audiences — plain default (Waiting/Working…/Splitting into sections/Making it searchable/Ready/Couldn't process) and the technical reveal (pending/processing/Chunking/Embedding/completed/failed).
- **All 58 new a11y tests green**, run per-suite + all-together (6 files / 66 tests incl. the MessageItem G-5 tripwire). No component source modified.

## Task Commits

1. **Task 1: Run modal a11y suite (152)** — `70d2fef3` (test)
2. **Task 2: Citation UI a11y verify suite (153) + D-14 exclusion** — `bca8d277` (test)
3. **Task 3: 154-surface a11y suites (Settings toggle/tabs, composer, doc badge)** — `dd18b5e1` (test)
4. **tsc-gate follow-up (0 net-new)** — `d157dad7` (fix)

**Plan metadata:** the final docs commit (SUMMARY + STATE + ROADMAP).

## Files Created/Modified

- `frontend/src/pages/__tests__/RunModal.a11y.test.tsx` (created) — 152 Run modal a11y contract
- `frontend/src/components/chat/__tests__/CitationUI.a11y.test.tsx` (created) — 153 citation cluster VERIFY contract
- `frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx` (created) — 154 Settings toggle/tabs a11y contract
- `frontend/src/components/chat/__tests__/MessageInput.a11y.test.tsx` (created) — 154 composer mode-helper a11y contract
- `frontend/src/components/ingestion/__tests__/DocumentStatusBadge.a11y.test.tsx` (created) — 154 status-badge never-colour-alone contract
- `.planning/phases/155-accessibility-sweep-wcag-aa/155-VALIDATION.md` (modified) — D-14 register row appended (nested-interactive)
- `.planning/seeds/SEED-092-remainder.md` (modified) — D-14 mirror (2 exclusions now) + the D-06 deferred SettingsPage findings note

## Decisions Made

- **The 153 contracts still hold (VERIFY, not rebuild).** Every shipped citation a11y contract passed unchanged — no additive citation-component fix (D-13) was needed. The suite renders CitedMarkdown/CitationPeek/CitationList/CitationCard/AbsenceHint directly; MessageItem/StreamsProvider are absent from the diff and the MessageItem replay suite is green (G-5 RED LINE honored).
- **Run-modal file-input trap-spot result: PASS.** The shipped accessible-hidden-input + proxy-button pattern is intact — the hidden input is Tab-through (`tabIndex=-1`) yet queryable by its `aria-label`, and the visible proxy button carries its own accessible name. No rebuild; the D-09 scenario-1 keyboard drive can succeed.
- **ASSERT-REAL-CONTRACT (Settings toggle).** The "Show technical names" control ships as a `<button aria-pressed>` (⌥ glyph aria-hidden → name "Technical names"), NOT a `role=switch`. The suite asserts the actual contract + explicitly asserts NO `role=switch` masquerade — mirroring the 155-04 TechnicalNamesToggle finding.

## Deviations from Plan

### Documented Exclusion (D-14)

**1. [D-14 - Known/tracked tradeoff] `nested-interactive` on the 153 citation footer rows**
- **Found during:** Task 2 (CitationList open-footer + CitationCard axe scans)
- **Finding:** `.citation-ref-row[role="button"]` (a convenience click-target that flashes the in-text marker) wraps a proper, independently-reachable "Open document" `<button>` → axe `nested-interactive` (WCAG 4.1.2 A). This is the SAME sanctioned `role="button"`+guarded-keydown container pattern 155-03 adopted for NavRow/SkillCard (a native `<button>` wrapping another button is invalid HTML); the barrier the rule guards does not exist (the nested button is in the tab order AND independently named — asserted positively). NOT a false-positive, NOT source-fixable in a test-only verify plan (the restructure is render-logic, out of D-13's additive-only scope, and the plan must not rebuild the citation components).
- **Fix:** Per-rule exclusion `axe(container, { rules: { "nested-interactive": { enabled: false } } })` (constant `CITATION_ROW_AXE_OPTS`) scoped to ONLY the two citation-row scans; every other WCAG-AA structural rule stays ON; the row name AND the nested Open-document button asserted positively. Mirrored in 155-VALIDATION.md D-14 register + SEED-092-remainder (folded into the existing NavRow/SkillCard restructure follow-up — the citation row is the third instance).
- **Files:** `CitationUI.a11y.test.tsx`, `155-VALIDATION.md`, `SEED-092-remainder.md`
- **Committed in:** `bca8d277`

### Auto-fixed Issues

**2. [Rule 3 - Blocking] Keep the a11y suites tsc-clean (0 net-new)**
- **Found during:** overall verification (`npx tsc -b` = 32, baseline 30)
- **Issue:** `RunModal.a11y.test.tsx` imported an unused `waitFor` (TS6133); `SettingsPage.a11y.test.tsx`'s `mkSettings` (copied from the existing `SettingsPage.test.tsx` shape, which is itself SEED-056 baseline-rot) omitted the 147 flag fields required by `FullAppSettings` → a duplicate `self_improve_enabled` type error.
- **Fix:** Dropped the unused import; added `self_improve_enabled`/`workflows_enabled`/`maintenance_mode` to the a11y test's `mkSettings`. `tsc -b` back to exactly 30 baseline, 0 net-new; the two edited suites re-run green; `vite build` exit 0.
- **Files:** `RunModal.a11y.test.tsx`, `SettingsPage.a11y.test.tsx`
- **Committed in:** `d157dad7`

### Scope Adjustment (D-06, logged not fixed)

**3. [D-06 - Pre-existing finding, deferred] SettingsPage whole-page axe findings**
- **Found during:** Task 3 (SettingsPage full-container axe scan)
- **Finding:** A full-page scan surfaces `select-name` on the rerank-provider + `openrouter_tool_strategy` expert-config `<select>`s and `heading-order` on the SectionCard heading levels — all PRE-EXISTING controls that predate v3.3 and are NOT part of the 154 relabel (the net-new 154 surface is the toggle row + the relabeled tabs).
- **Resolution:** Scoped the axe scan to the net-new 154 surfaces (toggle row + tablist), which are clean. Logged the whole-page pre-existing findings to SEED-092-remainder (D-06 — visible, not swallowed, explicitly not fixed this test-only plan).
- **Files:** `SettingsPage.a11y.test.tsx`, `SEED-092-remainder.md`
- **Committed in:** `dd18b5e1`

---

**Total deviations:** 1 D-14 documented exclusion + 1 Rule-3 auto-fix (tsc-clean) + 1 D-06 deferral. No component source modified; no D-13 additive citation-component fix was required (the 153 contracts held).
**Impact on plan:** No scope creep. The D-14 exclusion + D-06 deferral are honest, narrowly-scoped, and mirrored in the VALIDATION + SEED docs; the tsc-fix was required to keep the gate real.

## Issues Encountered

- **jsdom `HTMLCanvasElement.getContext` warnings** during runs — pre-existing environment noise (a charting dep in a co-loaded module); not from these suites, no effect on results.
- **Contrast is NOT covered here (by design).** jsdom cannot compute colour-contrast — the contrast half of D-01 is the LIVE Chrome scan at `/gsd:verify-work` (G-6 #1). No suite asserts contrast.

## Known Stubs

None — these are net-new test suites that render real components with representative props; no stubbed data flows to a shipped UI.

## User Setup Required

None — frontend test-only, no external service configuration, no migration, no backend.

## Next Phase Readiness

- The D-01/D-12 zero-STRUCTURAL-violations regression gate now covers the ENTIRE net-new v3.3 surface inventory (Control Room via 155-04/05, Run modal + citation UI + 154 surfaces via this plan). A regression on any of these surfaces fails the targeted vitest run (and CI).
- **A11Y-01 phase-open work remaining:** the LIVE Chrome DevTools scan (D-03 contrast + button-name, jsdom can't compute contrast) + the D-08/D-09/D-10 operator keyboard walkthrough (scenarios 1/2/3/4 with the 3 invariants) close A11Y-01 at `/gsd:verify-work 155`.
- Two additive real-fix follow-ups logged to SEED-092-remainder: (a) the shared `role="button"` container restructure (NavRow/SkillCard + the citation footer row); (b) the SettingsPage expert-config select-name + heading-order.

## Self-Check: PASSED

- Created files verified on disk: all five `*.a11y.test.tsx` suites + this SUMMARY
- Task commits verified in git: `70d2fef3`, `bca8d277`, `dd18b5e1`, `d157dad7`

---
*Phase: 155-accessibility-sweep-wcag-aa*
*Completed: 2026-07-15*
