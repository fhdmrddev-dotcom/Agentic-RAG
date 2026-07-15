---
seed_id: SEED-092-remainder
parent_seed: SEED-092
title: App-wide WCAG 2.1 AA — the exhaustive remainder left after the Phase 155 net-new + worst-offender sweep
status: planted
planted: 2026-07-16
phase_origin: "Phase 155 (A11Y-01) — the D-06 lint-drawn scope line. Phase 155 fixed the two named SEED-092 offender classes (muted-token contrast + unlabeled icon buttons), every jsx-a11y lint error, and the net-new v3.3 surfaces. Everything OUTSIDE that scope line is logged here — visible, explicitly NOT fixed this phase."
category: accessibility / design-system — the exhaustive app-wide WCAG 2.1 AA audit that A11Y-01 deliberately deferred (REQUIREMENTS.md "Future Requirements → Full app-wide WCAG AA sweep")
related_seeds: [SEED-092, SEED-049]
related_memories: [feedback_exhaustive_ui_state_sweep, feedback_uat_lived_experience_gap, project_155_planned]
related_decisions:
  - "D-06 (Phase 155): the scope line is lint-drawn — fix = the two named offender classes + whatever jsx-a11y errors force + net-new v3.3 surfaces. Every OTHER pre-existing finding is logged here."
  - "D-11 (Phase 155): accessible NAMES are the bar this phase (axe + DevTools a11y tree). NO live NVDA/JAWS screen-reader UX pass was done — that rides this remainder."
  - "D-14 (Phase 155): genuinely-unfixable / false-positive violations get documented per-rule/per-selector exclusions, never a blanket disable. Any surfaced during the sweep are recorded in the append section below."
re_open_triggers:
  - "The future exhaustive-WCAG-AA polish slot: REQUIREMENTS.md 'Future Requirements → Full app-wide WCAG AA sweep' (A11Y-01 covers net-new + worst offenders; the exhaustive audit rides a later polish slot — this remainder is its seed)."
  - "A formal accessibility audit / VPAT request / enterprise-procurement requirement that demands documented WCAG 2.1 AA conformance across EVERY page (not just the net-new v3.3 surfaces)."
  - "A design-system / token refresh touching color or focus tokens anyway — cheapest moment to close the legacy focus-visible + heading-order + alt-text gaps."
  - "Playwright E2E revival (SEED-049) — would unlock @axe-core/playwright for a repeatable full-page live scan, the tool Phase 155 D-01a rejected because the harness is rotted."
priority: medium
suggested_phase: a dedicated app-wide accessibility-remediation pass (decide once, app-wide) — the exhaustive sibling of Phase 155's net-new + worst-offender pass. NOT folded into a feature phase.
---

# SEED-092-remainder — the exhaustive WCAG 2.1 AA audit deferred by Phase 155

Phase 155 (A11Y-01) closed the two named SEED-092 offender classes app-wide
(muted-token contrast + unlabeled icon-only buttons), fixed **every** jsx-a11y
lint error at the source (zero suppressions), and passed the net-new v3.3
surfaces (Control Room / Run modal / citation UI / 154 relabels) at WCAG 2.1 AA.

The D-06 scope line was drawn at "the two named categories + whatever the
jsx-a11y errors force + net-new surfaces." **Everything below is OUTSIDE that
line** — real WCAG work that a keyboard/screen-reader user would still notice on
the LEGACY (non-net-new) surfaces. It is deferred, visible, and NOT fixed this
phase, so nothing is silently swallowed (G-6 #7).

## Known out-of-scope categories (D-06 defers these)

1. **Legacy focus-visible gaps** — the global zero-specificity
   `:where(a,button,input,select,textarea,[tabindex]):focus-visible` floor
   (index.css, Phase 088-01) covers most controls, but old pages may hold
   custom controls that suppress or never opt into a visible focus ring. Only
   the net-new v3.3 surfaces were keyboard-swept this phase (D-08/D-09).
2. **Heading-order issues on legacy pages** — `h1→h3` skips / multiple `h1`s on
   the older Documents / Skills / Settings pages. Not audited this phase.
3. **Missing `alt` on legacy images** — any decorative-vs-informative image
   audit on pre-v3.3 surfaces. (jsx-a11y `alt-text` is now enforced app-wide, so
   NEW images can't regress, but existing non-`<img>` graphics / bg-images were
   not swept.)
4. **Full screen-reader UX pass** — D-11 kept the bar at accessible NAMES
   (axe + the DevTools accessibility tree). NO live NVDA/JAWS/VoiceOver run was
   done. A real SR walkthrough (announcement order, live-region politeness,
   landmark navigation, form-error association) rides this remainder.
5. **The Phase-095 chat tool-cards frame** — explicitly excluded from the D-12
   net-new inventory (a pre-existing Phase-095 surface). The tool-call panel /
   tool-body cards were NOT audited for AA this phase.
6. **Light-theme-only deep audit** — Phase 155's contrast retune lifted the
   dark `--muted-foreground-dim` token + swept opacity modifiers; a full
   light-theme contrast pass beyond that sweep (every token pairing on the light
   surface) is deferred.
7. **Non-name axe categories app-wide** — this phase's live bar (D-03) was
   category-zero for `color-contrast` + `button-name` only (the SEED-092
   baseline categories). Other axe rules (aria-required-children,
   landmark-unique, region, list, etc.) were only cleared on the net-new
   surfaces, not audited exhaustively app-wide.

## Discovered during the 155 sweep / live scan — append here

Findings the Task 1/2 fix-sweep or the D-03 live scan surfaced that fall OUTSIDE
the scope line. Append; nothing gets lost.

- **Shared row/card primitives use `role="button"` containers, not fully
  separated select/action regions.** `NavRow` (Folders/Views tree rows) and
  `SkillCard` host nested interactive controls (an actions menu / inline-rename
  input / Try-in-Chat + toggle + export/edit/delete), so a native `<button>` is
  impossible (nested interactives are invalid HTML). Phase 155 used the rule's
  sanctioned fallback — `role="button"` + `tabIndex` + a guarded Enter/Space
  handler — which satisfies jsx-a11y and makes the rows keyboard-operable, but
  it leaves the container with `role="button"` wrapping focusable descendants
  (axe `nested-interactive` would flag it on a full-page scan). NavRow/SkillCard
  are NOT net-new v3.3 surfaces, so they were out of the D-03 live-scan target.
  **Follow-up:** restructure these shared primitives into a fully-separated
  primary-select region + sibling action controls (the truly-correct pattern),
  once a documents/skills refactor phase touches them. (NavPanel's chat-thread
  row WAS restructured this way in Phase 155 as the reference.)
- **Icon-only button residual is confirmed LIVE, not by lint.** jsx-a11y's
  recommended set has no generic button-name rule (`control-has-associated-label`
  is off by recommended's own defaults), so the exhaustive icon-only-button
  residual is enumerated by the D-03 live `button-name` scan at
  `/gsd:verify-work 155`, not by `npm run lint:a11y`. Phase 155 labeled the
  SEED-092-named offenders (NavPanel + DocumentList row icons) plus a broad
  high-value sweep (MemorySection, SkillCard, MessageFeedback, FolderNode,
  FolderTree, HealthDocumentRow, ProviderPicker + Settings password-eye toggles).
  Any node the live scan still flags on a legacy page lands here.
- **D-14 documented exclusions:** two this phase (Plan 05 + Plan 06).
  **(1, Plan 05)** The 070-A
  `ModelRegistryTab` trailing actions column is `<th aria-label="Row actions" />`
  (an intentionally text-less action column). axe's `empty-table-header` rule
  (a **best-practice** rule, NOT WCAG A/AA) flags it for having no *visible* text,
  yet the header IS accessibly named via `aria-label`, so the barrier the rule
  guards does not exist. Encoded as a per-rule/per-selector exclusion in
  `ModelRegistryTab.a11y.test.tsx` (scoped to the two table-rendering scans; every
  WCAG-AA rule stays on; the header name is asserted positively) + mirrored in the
  155-VALIDATION.md D-14 register. **Additive real-fix follow-up (out of Plan 05's
  test-only scope):** give that `<th>` an `sr-only` visible-to-SR header text so
  the best-practice rule passes without the exclusion — do it whenever a Control
  Room refactor phase next touches ModelRegistryTab.
  **(2, Plan 06)** The 153 References footer ROW (`.citation-ref-row[role="button"]`
  in `CitationCard`) is a CONVENIENCE click-target (flashes the in-text marker) that
  wraps a proper, independently-reachable "Open document" `<button>` — the SAME
  sanctioned `role="button"` container pattern noted for NavRow/SkillCard above.
  axe's `nested-interactive` (WCAG 4.1.2 A) flags the focusable-descendant nesting,
  but the barrier it guards does not exist here: the nested Open-document button is
  in the tab order AND independently named (asserted positively). Encoded per-rule
  in `CitationUI.a11y.test.tsx` (constant `CITATION_ROW_AXE_OPTS`, scoped to the two
  citation-row scans; every other WCAG-AA rule stays on) + mirrored in the
  155-VALIDATION.md D-14 register. **Additive real-fix follow-up (out of Plan 06's
  test-only + verify-not-rebuild scope):** the fully-separated row → non-interactive
  wrapper + sibling controls restructure, folded into the same NavRow/SkillCard
  primitive-restructure follow-up above (the citation footer row is the third
  instance of the shared pattern). All other jsx-a11y errors were
  fixed at the source with real changes (no other exclusions). If the D-03 live axe
  scan surfaces a further genuine false-positive, record it here per-rule/per-selector.

## Concrete starting points when this re-opens

- Wire @axe-core/playwright once SEED-049 (E2E revival) lands → a repeatable
  full-page live scan across every route (the tool D-01a rejected on the rotted
  harness).
- Keyboard-sweep the legacy pages (Documents, Skills list, Governance, Settings
  deep tabs) with the D-08/D-09/D-10 protocol (visible focus, no trap, logical
  order) the way Phase 155 swept the net-new surfaces.
- Run one real NVDA (Windows) + VoiceOver (macOS) pass on the primary flows
  (chat, upload, workflow run) and fix announcement-order / live-region issues.
- Audit heading order + landmarks + `alt` per legacy page.
- Restructure the `NavRow` / `SkillCard` shared primitives to eliminate the
  `role="button"`-wrapping-interactives pattern (see append note above).
