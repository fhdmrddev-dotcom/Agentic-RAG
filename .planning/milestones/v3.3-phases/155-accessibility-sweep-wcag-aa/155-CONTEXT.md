# Phase 155: Accessibility Sweep — WCAG AA - Context

**Gathered:** 2026-07-15
**Status:** Ready for planning

<domain>
## Phase Boundary

Every net-new v3.3 surface passes an automated axe scan (zero unexplained
violations) plus a manual keyboard walkthrough at WCAG 2.1 AA, AND the two
worst pre-existing app-wide offender classes — low-contrast muted-text tokens
and unlabeled icon-only buttons (SEED-092: Lighthouse 87/100, 19 color-contrast
nodes + 46 button-name nodes) — are fixed at the source in the same pass.
Regression protection lands as build gates (`eslint-plugin-jsx-a11y` as errors
+ per-surface `vitest-axe` tests).

**Frontend-only. No redesign, no new features, no backend, no migration.**
The one visible change for a typical user: dim gray helper text gets slightly
brighter (AA-passing) while keeping the quiet Deep Midnight read.

**Out of scope (redirect):** the exhaustive app-wide audit of every old page +
full screen-reader UX pass (→ SEED-092 remainder, future polish slot per
REQUIREMENTS.md "Future Requirements"); Playwright E2E harness revival
(→ SEED-049); nav/thread-list layout polish (→ Phase 156 POLISH-01);
provider/model icon polish in the selector/composer (→ Phase 156, see Deferred);
any new capability.
</domain>

<decisions>
## Implementation Decisions

### Axe tooling & gate home (D-01..D-03)
- **D-01 (gate home — HYBRID):** The repeatable CI gate is **`vitest-axe`
  per-surface `*.a11y.test.tsx` suites**, extending the shipped Phase 112/117
  pattern (`DocumentDetailPanel.a11y.test.tsx` is the reference: axe AA scan +
  role/aria contract asserts + reduced-motion + never-color-alone). PLUS **one
  live real-browser axe/Lighthouse scan per surface via Chrome DevTools MCP at
  verification** — required because jsdom-based vitest-axe CANNOT compute
  color-contrast (no rendering engine); the contrast half of this phase is only
  machine-checkable in a real browser.
- **D-01a (rejected):** `@axe-core/playwright` (the roadmap's literal
  prescription) is **rejected** — it presumes the Playwright E2E harness, which
  is known-rotted (SEED-049: 16/17 specs fail, stale login fixtures). Reviving
  it is NOT this phase's job. Do not add the dep.
- **D-02 (lint — errors, fix all):** Add **`eslint-plugin-jsx-a11y`** (dev dep)
  with the recommended rule-set enabled **as errors app-wide**, and fix EVERY
  violation it surfaces as part of this phase. This is the one natural moment to
  eat the whole backlog; afterwards regressions cannot merge. Expect mostly
  mechanical aria-label adds.
- **D-03 (live pass bar — category-zero):** Verification evidence = **zero axe
  violations on every net-new v3.3 surface (live scan)** AND **zero failing
  nodes in the two named categories (color-contrast, button-name) app-wide** on
  the pages the SEED-092 Lighthouse baseline flagged. No Lighthouse-score
  threshold (score blends out-of-scope audits).

### Pre-existing offender strategy (D-04..D-07)
- **D-04 (contrast — fix at source):** Retune the **global dim tokens to
  AA-passing values** (the Phase 088-05 panel math is the proven precedent:
  lifting muted text to ~65–70% lightness keeps the blue-gray "muted" read at
  7–8:1) AND **sweep away opacity-modified text** (`text-muted-foreground/60`,
  `/50`) onto real AA-passing tokens. Truly decorative/disabled elements stay
  exempt (WCAG-allowed). One decision, app-wide — no page can regress by using
  the old token because the old token itself becomes safe. The `index.css`
  token block documents the existing contrast math; extend it.
- **D-05 (icon buttons — full app sweep):** Label **every icon-only button
  app-wide** with `aria-label`. The D-02 lint errors force most of this anyway —
  the lint rule and the sweep are the same work done once. Closes the
  button-name category permanently.
- **D-06 (scope line — lint-drawn):** Fix = the two named offender classes +
  whatever the jsx-a11y errors force + anything on net-new surfaces. **Every
  OTHER pre-existing finding** (focus-visible gaps on old pages, heading order,
  missing alt…) is **logged to a documented SEED-092-remainder follow-up list**
  — visible, not lost, explicitly NOT fixed this phase. The requirement reserves
  the exhaustive sweep for a later polish slot.
- **D-07 (look check — quick eyeball):** The token retune gets a **mid-execution
  operator checkpoint**: a 2-minute before/after look at 2–3 representative
  pages (chat, documents, Control Room) — approve or nudge the values, then the
  sweep proceeds. NOT a full G-2 sketch (a lightness nudge on already-designed
  surfaces).

### Keyboard walkthrough protocol (D-08..D-11)
- **D-08 (who drives):** **Claude drives first via Chrome MCP keyboard events**
  (Tab/Enter/Esc/arrows), recording per-surface results — satisfies G-4's
  "Chrome MCP drives" rule. The **operator then personally re-runs the four
  must-pass scenarios** for the lived-experience judgment (focus LOOKS visible,
  order FEELS right). Fallback if Chrome MCP wedges (known risk per memory):
  operator drives from Claude's written script.
- **D-09 (G-4 must-pass scenarios — ALL FOUR, defined at scope time):**
  1. **Launch a workflow run** — open Run modal → upload a template file →
     change KB folder scope → launch (Phase 152 surface; file inputs are a
     classic keyboard-trap spot).
  2. **Navigate a cited answer** — Tab to a citation marker → open peek → pin →
     Esc back → open the source document (Phase 153 surface; proves the shipped
     contracts live).
  3. **Operate the Control Room** — reach `/admin` → switch operator tabs →
     flip a kill-switch through its arm-to-confirm guard → read the audit
     receipt (146–149; destructive-action guards MUST be keyboard-safe).
  4. **Settings + nav traversal** — collapse/expand nav → reach every nav
     destination → flip the 154 "Show technical names" toggle (the
     154-deferred toggle + newly-labeled nav icons).
  These become VALIDATION.md rows the operator personally confirms.
- **D-10 (pass bar — task + 3 invariants):** Each scenario completes
  keyboard-only, PLUS three invariants everywhere on the surface: **visible
  focus indicator** on every interactive element, **no keyboard trap** (always
  Tab/Esc out), **logical focus order** (follows visual reading order).
- **D-11 (screen reader — names only):** NO live NVDA/JAWS pass. Accessible
  names are verified via the axe scan + the DevTools accessibility tree
  (machine-checkable — what WCAG AA + the requirement wording actually demand).
  A full screen-reader UX pass goes on the SEED-092-remainder list.

### Surface boundary & violation disposition (D-12..D-14)
- **D-12 (net-new surface inventory — FULL):** The zero-violations bar covers:
  - **Control Room `/admin`, all tabs** — 146 shell/OperatorBand/HealthSignals,
    147 Control Plane (active runs + Kill, capability grid, maintenance) + the
    150 encryption tile, 148 audit browser + users roster + feature visibility,
    149 Model Registry tab.
  - **Run modal + run-input controls + workflow-delete confirm** (152).
  - **Citation UI** — CitedMarkdown markers, CitationPeek, CitationList/
    CitationCard, AbsenceHint (153).
  - **154 surfaces** — Settings "Show technical names" toggle row, relabeled
    document status badge / detail header, composer mode helpers (154 explicitly
    deferred its a11y here).
  NOT included: the chat tool-cards the 151 file tools render through (a
  pre-existing Phase-095 frame — SEED-092 remainder territory).
- **D-13 (shared-primitive violations — fix at primitive):** When a violation
  on a net-new surface traces to a shared shadcn/ui or Radix wrapper, **fix the
  shared component once** (a11y fixes are almost always additive — aria
  attributes, focus styles); re-run consumer test suites as non-regression.
  **G-5 exception:** inside `MessageItem.tsx` / `StreamsProvider.tsx`, only
  display-additive attribute changes — never render/stream-logic edits.
- **D-14 (unfixable findings — documented exclusions):** A genuinely unfixable
  violation (Radix internal we don't own, confirmed axe false-positive) is
  listed in VALIDATION.md with the rule, the node, and WHY (upstream bug link /
  false-positive reasoning), AND the axe test encodes the exclusion explicitly
  (per-rule, per-selector) so it's visible in code review. NEVER a silent
  global rule-disable. "Zero violations" = zero UNEXPLAINED violations.

### Guardrail assessments (MANDATORY, CLAUDE.md)
- **G-2 (sketch before plan):** No sketch — no new visual surface; the only
  visible change is a token lightness nudge, covered by the D-07 mid-execution
  eyeball instead.
- **G-4 (lived-experience UAT):** Satisfied by construction — D-08/D-09 define
  the operator's "I'd-recognize-failure-here" scenarios at scope time, Chrome
  MCP drives at verification.
- **G-5 (hot files):** `MessageItem.tsx` / `StreamsProvider.tsx` (citation
  markers live inside MessageItem) — D-13's exception applies: attribute-level
  additive edits only, re-run their suites. `backend/app/api/threads.py`
  untouched (frontend-only phase).
- **G-3:** N/A — multi-file sweep. **G-6:** see "How we'd know this failed".

### Reported-bugs cross-check (MANDATORY, CLAUDE.md)
- Swept `.planning/reported-bugs/*.md` for `status: open` AND
  `surface: Agentic-RAG` (15 reports). **None are accessibility bugs** — all
  streaming / provider / run-honesty / chat-display / layout
  (`chat-list-too-narrow-nav-panel-crowding` is layout, already routed →
  Phase 156 POLISH-01). **None folded.**

### How we'd know this failed (G-6)
- The axe gate passes in CI but a live scan still shows contrast failures
  (the jsdom-can't-check-contrast gap papered over instead of closed by D-01's
  live-scan half).
- "Zero violations" achieved via silent rule-disables or undocumented excludes
  (D-14 violated — the false-green pattern).
- A keyboard user gets trapped in the Run-modal file input or the kill-switch
  confirm (D-09 scenarios 1/3 fail).
- The token retune makes the app look washed-out / breaks the Deep Midnight
  feel (D-07 eyeball skipped or ignored).
- jsx-a11y lands as errors but with sweeping per-file disables instead of fixes
  (D-02 violated in spirit).
- MessageItem/StreamsProvider render or stream logic changed (G-5 breach) —
  citation replay/render tests would catch it.
- A pre-existing finding outside the scope line silently swallowed instead of
  logged to the SEED-092-remainder list (D-06 violated — items get lost).

### Claude's Discretion
- Exact retuned token values (within "AA-passing + still reads muted"; D-07
  eyeball is the approval gate), test file naming/placement (follow the
  `*.a11y.test.tsx` convention), CI wiring, the live-scan tooling detail
  (DevTools MCP vs Lighthouse CLI), aria-label copy for each icon button
  (plain-language, consistent with the 154 term-map where a term exists),
  and the order/wave structure of plans.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement + roadmap (this phase)
- `.planning/ROADMAP.md` §"Phase 155: Accessibility Sweep — WCAG AA" — goal + 3 success criteria.
- `.planning/REQUIREMENTS.md` — A11Y-01 row + "Future Requirements" ("Full app-wide WCAG AA sweep" explicitly deferred — this phase is net-new + worst offenders ONLY).
- `.planning/seeds/SEED-092-app-wide-wcag-aa-contrast-and-icon-button-labels.md` — the quantified offender baseline (Lighthouse 87/100; 19 color-contrast nodes on `text-muted-foreground/60|/50`; 46 button-name nodes; named offender files) + the "decide once app-wide" rationale D-04/D-05 honor.
- `.planning/seeds/SEED-049-e2e-suite-revival.md` — Playwright E2E rot; why D-01a rejects `@axe-core/playwright`.

### Shipped patterns to extend (reuse — do NOT reinvent)
- `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx` — THE vitest-axe a11y-contract reference (axe AA scan + role/aria asserts + reduced-motion + never-color-alone; "keyboard-sweep stays manual in VALIDATION.md" convention).
- `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx` — second pattern instance.
- `frontend/src/index.css` (token block ~L100–140 + citation block ~L671) — documented contrast math: global `--muted-foreground-dim` (220 16% 45%) = 3.59:1 FAILS on `--panel-surface`; Phase 088-05 panel-scoped AA fix (65–70% L → 7.2–8.4:1) is the D-04 retune precedent; Phase 153's "--muted-foreground for meaningful text" note.
- `frontend/eslint.config.js` — current flat config (react-hooks + react-refresh only); D-02 adds jsx-a11y here.

### Surfaces under audit (D-12 inventory)
- `frontend/src/components/admin/` — ControlRoomPage + OperatorBand/HealthSignals/ActiveRunsSection/CapabilityGrid/MaintenancePanel/AuditTab/users/FeatureVisibility/ModelRegistryTab (146–150).
- `frontend/src/components/workflows/` — Run modal + run-input controls + delete confirm (152); `frontend/src/pages/WorkflowsPage.tsx`.
- `frontend/src/components/chat/CitedMarkdown.tsx`, `CitationPeek.tsx`, `CitationList.tsx`, `CitationCard.tsx`, `AbsenceHint.tsx` (153 — a11y contracts already built in; verify, don't rebuild).
- `frontend/src/pages/SettingsPage.tsx` (154 toggle row), `frontend/src/components/chat/DocumentStatusBadge` + `DocumentDetailPanel` relabels, `MessageInput.tsx` composer helpers (154).
- `frontend/src/components/layout/NavPanel.tsx` — the named "unlabeled nav icons" offender (some buttons title=-only).

### Guardrails + verification conventions
- `CLAUDE.md` §"Workflow guardrails" (G-4 Chrome-MCP-driven scenarios, G-5 hot files) + §"UAT scoreboard recipe" (SC#10 n/a — no streaming/provider/loop changes, but VALIDATION.md rows are the D-09 home).
- `.planning/phases/154-plain-language-layer/154-CONTEXT.md` — the 154→155 deferral this phase inherits (toggle + relabeled surfaces a11y).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`vitest-axe` (already installed)** + two shipped `*.a11y.test.tsx` suites —
  the D-01 gate extends this, no new test infrastructure needed.
- **Phase 088-05 panel token math** (`index.css`) — proven AA-passing values
  that keep the muted read; the D-04 retune template.
- **154 term-map (`frontend/src/lib/termMap.ts`)** — aria-label copy for icon
  buttons should stay consistent with its plain-language vocabulary.
- **Chrome DevTools MCP + a11y-debugging skill** — the D-03 live-scan and D-08
  keyboard-drive vehicle.

### Established Patterns
- a11y contract = automatable core in vitest-axe + manual keyboard sweep
  documented in VALIDATION.md (112/117 convention — this phase generalizes it).
- 153's citation components shipped WITH a11y contracts (role=dialog
  aria-modal=false, state-toggled aria-labels, reduced-motion, never
  color-alone) — audit verifies rather than rebuilds.
- Icon-button labeling precedent: ~199 aria-labels already exist; the sweep
  closes the gap, it doesn't invent a new pattern.

### Integration Points
- `frontend/eslint.config.js` — jsx-a11y plugin lands here (D-02).
- `frontend/package.json` — ONE new dev dep (`eslint-plugin-jsx-a11y`);
  `@axe-core/playwright` explicitly NOT added (D-01a).
- CI `frontend-tests.yml` — the new a11y suites run with the existing vitest
  invocation automatically.
- SEED-056/049 baseline rot: tsc baseline = 30 errors, some vitest files rot —
  net-new a11y tests must be green; pre-existing rot is not this phase's bar.
</code_context>

<specifics>
## Specific Ideas

- The operator's mental model for delivery: (1) faint gray text becomes
  readable everywhere, (2) the whole app works keyboard-only with visible
  focus, (3) every icon button announces its purpose, (4) lint+tests make it
  impossible to regress — plus documented WCAG 2.1 AA evidence as a B2B
  procurement answer.
- Keep the Deep Midnight look — "muted" stays muted-feeling, just AA-passing
  (the Phase 088 panel lift is the taste reference).
</specifics>

<deferred>
## Deferred Ideas

- **Provider/model icons in the provider selector + selected-state icon in the
  composer** (operator request, 2026-07-15): the provider selector dropdown
  lacks the Phase-127 `@lobehub/icons` provider logos, and once a provider +
  model are selected the chat input area should display the selected
  provider's/model's icon. → **Phase 156 POLISH-01** (Everyday UX Polish
  umbrella). Implementation note: extend the shipped Phase-127 single-source
  icon convention (`@lobehub/icons`) to the selector menu items + a selected
  provider/model chip in the composer. (155's new lint rules will force any
  such icons to ship decorative-or-labeled.)
- **Exhaustive app-wide a11y audit** (every legacy page, full screen-reader UX
  pass, one-off NVDA run) → SEED-092 remainder, future polish slot. This
  phase's D-06 sweep produces the documented follow-up list that seeds it.
- **Playwright E2E revival** (would unlock `@axe-core/playwright` later) →
  SEED-049, its own effort.

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` — reviewed, NOT folded: false-positive
  keyword match ("inputs, phases, run"); NL→workflow authoring is unrelated to
  the a11y sweep.

</deferred>

---

*Phase: 155-accessibility-sweep-wcag-aa*
*Context gathered: 2026-07-15*
