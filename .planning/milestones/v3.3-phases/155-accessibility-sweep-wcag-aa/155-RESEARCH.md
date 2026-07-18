# Phase 155: Accessibility Sweep — WCAG AA - Research

**Researched:** 2026-07-15
**Domain:** Frontend web accessibility (WCAG 2.1 AA) — axe-core testing, ESLint a11y linting, CSS color-contrast tokens, keyboard operability
**Confidence:** HIGH (stack + patterns verified against the live repo; token math computed from `index.css`; package facts verified on the npm registry and via slopcheck)

## Summary

This is a **frontend-only remediation + regression-lock phase**, not a feature phase. Every decision was already locked in `155-CONTEXT.md` (D-01..D-14); the research job is to hand the planner the concrete repo facts each decision needs: which packages are already installed vs. what to add, the exact contrast-token values that fail and the proven fix precedent, the full net-new surface file inventory, and how the existing `vitest-axe` a11y-test pattern is wired so plans extend it rather than reinvent it.

The good news from the investigation: **most of the infrastructure already exists.** `vitest-axe@0.1.0` (axe-core 4.11.4) is installed, wired through `src/setupTests.ts` (`expect.extend(axeMatchers)`) and type-augmented in `src/vitest-axe.d.ts`; two reference `*.a11y.test.tsx` suites (Phase 112 `DocumentDetailPanel`, Phase 117 `RelationshipsSection`) are the exact pattern to copy. The 153 citation components already shipped with their a11y contracts built in. `index.css` already documents the contrast math (Phase 088-05) that D-04 extends. Only **one** new dev dependency is required: `eslint-plugin-jsx-a11y`.

The two genuinely hard/verify-carefully points: (1) **jsdom cannot compute color-contrast** — axe's `color-contrast` rule is a no-op under vitest, so the contrast half of this phase is ONLY machine-checkable in a real browser (this is exactly why D-01 is HYBRID; do not let a green vitest suite paper over it — that is failure mode G-6 #1). (2) **The ESLint lint gate is currently NOT run in CI** — `frontend-tests.yml` runs `npm test` (vitest) only, and `npm run build` = `tsc -b && vite build` with no eslint; so making `eslint-plugin-jsx-a11y` a true regression gate requires adding a `npm run lint` step to CI, otherwise D-02's "afterwards regressions cannot merge" promise is not actually enforced.

**Primary recommendation:** Add `eslint-plugin-jsx-a11y@6.10.2` via `jsxA11y.flatConfigs.recommended` (already error-severity) in the ESLint 9 flat config + wire `npm run lint` into `frontend-tests.yml`; lift the dark `--muted-foreground-dim` token (220 16% 45% → ~68-70% L) and sweep the 133 `text-muted-foreground/{60,50,40,70}` opacity offenders onto real tokens; copy the `DocumentDetailPanel.a11y.test.tsx` pattern into one `*.a11y.test.tsx` per net-new surface; and drive the contrast + keyboard proof through a live Chrome DevTools scan at verification (not vitest).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (D-01..D-14 — verbatim intent)

**Axe tooling & gate home (D-01..D-03)**
- **D-01 (HYBRID gate):** Repeatable CI gate = `vitest-axe` per-surface `*.a11y.test.tsx` suites (extend the shipped `DocumentDetailPanel.a11y.test.tsx` pattern) PLUS one live real-browser axe/Lighthouse scan per surface via Chrome DevTools MCP at verification — because jsdom-based vitest-axe CANNOT compute color-contrast.
- **D-01a (rejected):** `@axe-core/playwright` is REJECTED (presumes the rotted Playwright harness, SEED-049). Do NOT add the dep.
- **D-02 (lint — errors, fix all):** Add `eslint-plugin-jsx-a11y` (dev dep), recommended rule-set as ERRORS app-wide, fix EVERY violation this phase. Mostly mechanical aria-label adds.
- **D-03 (live pass bar — category-zero):** Evidence = zero axe violations on every net-new v3.3 surface (live scan) AND zero failing nodes in the two named categories (color-contrast, button-name) app-wide on the SEED-092 Lighthouse-baseline pages. No Lighthouse-score threshold.

**Pre-existing offender strategy (D-04..D-07)**
- **D-04 (contrast — fix at source):** Retune global dim tokens to AA-passing values (Phase 088-05 panel math is the precedent: lift muted text to ~65-70% L, keeps blue-gray muted read at 7-8:1) AND sweep opacity-modified text (`text-muted-foreground/60`, `/50`) onto real AA-passing tokens. Decorative/disabled stay exempt. One decision, app-wide.
- **D-05 (icon buttons — full app sweep):** Label EVERY icon-only button app-wide with `aria-label`. Closes the button-name category permanently.
- **D-06 (scope line — lint-drawn):** Fix = the two named offender classes + whatever jsx-a11y errors force + anything on net-new surfaces. Every OTHER pre-existing finding → documented SEED-092-remainder follow-up list (visible, explicitly NOT fixed this phase).
- **D-07 (look check):** Token retune gets a mid-execution operator checkpoint — 2-min before/after look at 2-3 representative pages (chat, documents, Control Room). NOT a full G-2 sketch.

**Keyboard walkthrough protocol (D-08..D-11)**
- **D-08 (who drives):** Claude drives first via Chrome MCP keyboard events; operator then personally re-runs the four must-pass scenarios. Fallback if Chrome MCP wedges: operator drives from Claude's written script.
- **D-09 (G-4 must-pass scenarios — ALL FOUR):** (1) Launch a workflow run (Run modal → upload template → change KB folder scope → launch; Phase 152). (2) Navigate a cited answer (Tab to marker → peek → pin → Esc → open source doc; Phase 153). (3) Operate the Control Room (`/admin` → switch tabs → flip kill-switch through arm-to-confirm → read audit receipt; 146-149). (4) Settings + nav traversal (collapse/expand nav → reach every destination → flip 154 "Show technical names" toggle). These become VALIDATION.md rows.
- **D-10 (pass bar):** Each scenario completes keyboard-only, PLUS three invariants everywhere: visible focus indicator, no keyboard trap, logical focus order.
- **D-11 (screen reader — names only):** NO live NVDA/JAWS. Accessible names verified via axe scan + DevTools accessibility tree. Full SR UX pass → SEED-092-remainder.

**Surface boundary & violation disposition (D-12..D-14)**
- **D-12 (net-new surface inventory — FULL):** Control Room `/admin` all tabs (146-150); Run modal + run-input controls + workflow-delete confirm (152); Citation UI — CitedMarkdown/CitationPeek/CitationList/CitationCard/AbsenceHint (153); 154 surfaces (Settings "Show technical names" row, relabeled document status badge/detail header, composer mode helpers). NOT included: the chat tool-cards the 151 file tools render through (Phase-095 frame → SEED-092 remainder).
- **D-13 (shared-primitive violations — fix at primitive):** When a violation traces to a shared shadcn/Radix wrapper, fix the shared component once (a11y fixes are additive). Re-run consumer suites as non-regression. **G-5 exception:** inside `MessageItem.tsx` / `StreamsProvider.tsx`, only display-additive attribute changes — NEVER render/stream-logic edits.
- **D-14 (unfixable findings — documented exclusions):** A genuinely unfixable violation is listed in VALIDATION.md with rule + node + WHY, AND the axe test encodes the exclusion explicitly (per-rule, per-selector). NEVER a silent global rule-disable. "Zero violations" = zero UNEXPLAINED violations.

### Claude's Discretion
- Exact retuned token values (within "AA-passing + still reads muted"; D-07 eyeball is the approval gate)
- Test file naming/placement (follow the `*.a11y.test.tsx` convention)
- CI wiring; the live-scan tooling detail (DevTools MCP vs Lighthouse CLI)
- aria-label copy for each icon button (plain-language, consistent with the 154 term-map where a term exists)
- The order/wave structure of plans

### Deferred Ideas (OUT OF SCOPE)
- Provider/model icons in the provider selector + selected-state icon in the composer → Phase 156 POLISH-01 (via the Phase-127 `@lobehub/icons` convention).
- Exhaustive app-wide a11y audit (every legacy page, full screen-reader UX pass, one-off NVDA run) → SEED-092 remainder. This phase's D-06 sweep produces the follow-up list that seeds it.
- Playwright E2E revival (would unlock `@axe-core/playwright` later) → SEED-049.
- NOT folded: `spike-nl-workflow-authoring.md` (false-positive keyword match).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| A11Y-01 | All net-new v3.3 surfaces (admin shell, Run-modal inputs, citation UI) pass an automated axe-core scan + manual keyboard walkthrough at WCAG 2.1 AA; worst pre-existing app-wide offenders (contrast tokens, unlabeled icon buttons) fixed in the same pass | (1) `vitest-axe` gate — already installed, pattern in "Standard Stack" + "Code Examples"; per-surface file inventory in "Architecture Patterns → Net-New Surface Inventory". (2) Live-scan contrast half — "Common Pitfalls → jsdom cannot compute contrast" + "Validation Architecture". (3) Contrast token fix — "Architecture Patterns → Contrast Token Retune" with computed failing/target values. (4) Icon-button sweep — "Don't Hand-Roll" + `eslint-plugin-jsx-a11y` wiring. (5) Keyboard walkthrough — "Validation Architecture → Keyboard scenarios (D-09)". |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| axe-core structural scan (roles, names, aria) | Browser / Client (jsdom test) | — | Component-level DOM assertions run in vitest/jsdom; no server involvement |
| Color-contrast verification | Browser / Client (real rendering engine) | — | Requires layout + `getComputedStyle` — jsdom cannot compute it; Chrome DevTools/Lighthouse only |
| Contrast token values | CDN / Static (`index.css` design tokens) | — | Global CSS custom properties; one edit fixes every consumer |
| Icon-button accessible names | Browser / Client (component JSX) | — | `aria-label` attributes are display/markup, added at each `<button>` |
| Lint enforcement (jsx-a11y) | Build tooling (ESLint flat config) | CI (`frontend-tests.yml`) | Static analysis at author time; must be wired into CI to be a real gate |
| Keyboard operability | Browser / Client (focus management, DOM order) | — | Tab order, focus-visible, no-trap are pure client-side behaviors |

**Note:** Zero backend, database, or API tier involvement. This phase touches only `frontend/src/**` + `frontend/eslint.config.js` + (recommended) `.github/workflows/frontend-tests.yml`.

## Standard Stack

### Core (already installed — verify, do not reinstall)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `vitest-axe` | 0.1.0 (installed) | axe-core matcher for Vitest (`toHaveNoViolations`) | The project runner is Vitest 4.1.0; `vitest-axe` is the Vitest-native wrapper (NOT `jest-axe`). `[VERIFIED: npm ls]` |
| `axe-core` | 4.11.4 (transitive via vitest-axe) | The accessibility rule engine | Industry-standard a11y ruleset; ships WCAG 2.0/2.1 A+AA tags. `[VERIFIED: npm ls]` |
| `@testing-library/react` | 16.3.2 (installed) | Render components for axe scan + role/name queries | Already the project's component-test harness. `[VERIFIED: package.json]` |
| `@testing-library/user-event` | 14.6.1 (installed) | Simulate keyboard (Tab/Enter/Arrow) in unit tests | Used by both reference a11y suites for interaction assertions. `[VERIFIED: package.json]` |

### Supporting (add exactly one)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `eslint-plugin-jsx-a11y` | 6.10.2 | Static a11y lint rules as ERRORS (D-02) — forces the icon-button labeling sweep and prevents regressions | The ONE new dev dep. Wire `jsxA11y.flatConfigs.recommended` into `frontend/eslint.config.js`. `[VERIFIED: npm registry + slopcheck OK]` |

### Live-scan tooling (verification-time, Claude's discretion per D-01/D-03)
| Option | Adds a dep? | Notes |
|--------|-------------|-------|
| **Chrome DevTools MCP** (CONTEXT-preferred) | No | Drives a real browser for both the contrast scan (D-03) and keyboard events (D-08). Known wedge risk (memory: `chrome_mcp_dropdown_wedge`) — fallback = operator-driven from Claude's script. **Recommended — no dependency, satisfies G-4 "Chrome MCP drives".** |
| Lighthouse CLI (`npx lighthouse`) | No (npx, ephemeral) | Score blends out-of-scope audits (D-03 explicitly rejects a score threshold); use only for the named color-contrast/button-name audit nodes, not the aggregate score. Avoid `npx --yes` auto-download. |
| `@axe-core/cli` | Yes (new dev dep) | Cleanest headless contrast check against a running dev server, but adds a dependency and needs its own legitimacy gate. Not required — DevTools MCP covers it. Only consider if the operator wants a scriptable CI contrast check later. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `vitest-axe` | `jest-axe` | Wrong runner — project is Vitest 4, not Jest. Already rejected in `setupTests.ts` comment. |
| `@axe-core/playwright` (roadmap's literal text) | — | **REJECTED by D-01a** — presumes the rotted Playwright harness (SEED-049). Do NOT add. |
| jsx-a11y `strict` config | jsx-a11y `recommended` config | D-02 says "recommended rule-set". `strict` adds rules (e.g. stricter label/interactive-supports-focus) that would balloon the sweep beyond the D-06 scope line. Use `recommended`. |

**Installation:**
```bash
cd frontend
npm install --save-dev eslint-plugin-jsx-a11y@6.10.2
```

**Version verification (performed this session):**
```
npm view eslint-plugin-jsx-a11y version   → 6.10.2  (published 2024-10-26; first published 2016-02-29)
npm view eslint-plugin-jsx-a11y dist-tags → { 'v5-backport': '5.1.1', latest: '6.10.2' }
npm view eslint-plugin-jsx-a11y scripts.postinstall → (none)
npm view vitest-axe version               → 0.1.0   (already installed, is latest)
npm ls axe-core                           → axe-core@4.11.4 (transitive via vitest-axe@0.1.0)
```

## Package Legitimacy Audit

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `eslint-plugin-jsx-a11y` | npm | ~10 yrs (first pub 2016-02-29; latest 2024-10-26) | ~30M/wk (jsx-eslint org) | github.com/jsx-eslint/eslint-plugin-jsx-a11y | **[OK]** | **Approved** |

- **slopcheck verdict:** `slopcheck install eslint-plugin-jsx-a11y` → `1 OK`. No postinstall script. Source repo is the well-known `jsx-eslint` org (same org as `eslint-plugin-react`).
- **Packages removed due to slopcheck [SLOP] verdict:** none.
- **Packages flagged as suspicious [SUS]:** none.
- **Cleanup note:** slopcheck's `install` subcommand ran `npm install` into `node_modules` but did NOT modify `frontend/package.json` or `package-lock.json` (verified `git status --short` = clean). The plan's own install task (`--save-dev`) is still required to record the dep.

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────────────┐
                    │  PHASE 155 — two verification tracks, one remediation    │
                    └─────────────────────────────────────────────────────────┘

  REMEDIATION (source edits)                     REGRESSION GATE (author + CI time)
  ─────────────────────────                      ─────────────────────────────────
  index.css tokens ──► lift --muted-        ┌──► eslint.config.js
    -foreground-dim (45%→~70% L)            │      + jsxA11y.flatConfigs.recommended (ERROR)
                                            │           │
  ~42 files ──► sweep text-muted-           │           ▼
    -foreground/{60,50,40,70} opacity ──────┤      npm run lint  ──►  MUST be added to
    onto real tokens                        │                          frontend-tests.yml
                                            │                          (currently NOT run in CI!)
  ~N icon buttons ──► add aria-label ───────┘
                                            
  net-new surface components ──► one *.a11y.test.tsx each
                                            │
                                            ▼
              ┌──────────── AUTOMATED (vitest / jsdom) ────────────┐
              │  axe(container) → structural rules ONLY            │
              │  (roles, aria, names, labels)                      │
              │  ✗ color-contrast = NO-OP under jsdom (no layout)  │
              └──────────────────────┬─────────────────────────────┘
                                     │  (contrast + keyboard cannot be proven here)
                                     ▼
              ┌──────────── LIVE (Chrome DevTools MCP) ────────────┐
              │  • color-contrast scan on SEED-092 pages (D-03)    │
              │  • button-name = 0 nodes app-wide (D-03)           │
              │  • keyboard-drive 4 G-4 scenarios (D-08/D-09)      │
              │  • DevTools a11y tree = accessible names (D-11)    │
              └──────────────────────┬─────────────────────────────┘
                                     ▼
              operator personally re-runs the 4 scenarios (D-08) → VALIDATION.md rows
```

### Net-New Surface Inventory (D-12) — the zero-violations bar

Each surface below needs (a) a `*.a11y.test.tsx` vitest suite [D-01] and (b) a live-scan pass [D-03]. File paths verified present in the repo this session.

**Control Room `/admin` (146-150)** — `frontend/src/components/admin/`
- `ControlRoomPage.tsx` (shell; uses a CUSTOM `role="tablist"`/`role="tab"` at L566, NOT Radix Tabs — panels conditionally render, so an axe suite must either test each tab-panel sub-component in isolation OR render the page and switch tabs)
- `OperatorBand.tsx`, `HealthSignals.tsx`, `ActiveRunsSection.tsx` (has `__tests__/`), `CapabilityGrid.tsx` (has `__tests__/`), `MaintenancePanel.tsx`, `AuditTab.tsx`, `UsersAndAccess.tsx`, `FeatureVisibility.tsx`, `ModelRegistryTab.tsx` (has `__tests__/`), `ModelDiscoveryPanel.tsx` (has `__tests__/`), `RecentActionsCard.tsx`, `LockedTab.tsx`, `TechnicalNamesToggle.tsx`
- **Recommendation:** mirror the DocumentDetailPanel/RelationshipsSection precedent — test sub-components in isolation (most already have `__tests__/` dirs to co-locate with). The kill-switch arm-to-confirm guard (D-09 scenario 3) lives in `CapabilityGrid.tsx` / `MaintenancePanel.tsx`.

**Run modal + run-input controls + workflow-delete confirm (152)**
- `frontend/src/pages/WorkflowsPage.tsx` — `RunModal` is defined here (`function RunModal({` at L957). The template file-input (L1196) already uses the **accessible hidden-input pattern**: `type="file" tabIndex={-1} className="hidden" aria-label="Upload template file"` + a visible proxy `<button>` (L1226) that calls `fileInputRef.current?.click()`. The remove-template button (L1212) has `aria-label="Remove template"`. **Verify this is keyboard-safe (D-09 scenario 1), do NOT rebuild.**
- `frontend/src/components/layout/ChatLayout.tsx` — `doRun` (launch flow, upload + postMessage, WR-04 error `role="alert"`).
- `frontend/src/pages/__tests__/RunModal.test.tsx` + `ChatLayoutLaunch.test.tsx` already exist (non-a11y) — a new `RunModal.a11y.test.tsx` co-locates.

**Citation UI (153)** — `frontend/src/components/chat/` (all present)
- `CitedMarkdown.tsx`, `CitationPeek.tsx`, `CitationList.tsx`, `CitationCard.tsx`, `AbsenceHint.tsx`
- **These shipped WITH a11y contracts** (153 execution notes): `role="dialog" aria-modal="false"`, state-toggled `aria-label` (`Pin citation {n}` ↔ `Unpin citation {n}`, `aria-pressed`), Esc-to-close, reduced-motion, never-color-alone, no `dangerouslySetInnerHTML`. **Audit verifies these hold; do not rebuild.**

**154 surfaces**
- `frontend/src/pages/SettingsPage.tsx` (the "Show technical names" toggle row + relabeled tabs)
- `frontend/src/components/chat/DocumentStatusBadge.tsx` + `frontend/src/components/metadata/DocumentDetailPanel.tsx` (relabels; DocumentDetailPanel already has `DocumentDetailPanel.a11y.test.tsx`)
- `frontend/src/components/chat/MessageInput.tsx` (composer mode helpers; **G-5-adjacent but NOT a hot file itself** — MessageInput ≠ MessageItem)

**Pre-existing offender surface (D-04/D-05, app-wide, NOT the zero-violations bar)**
- `frontend/src/components/layout/NavPanel.tsx` — named "unlabeled nav icons" offender. Inspection found: the "New Chat" button (L353) and "Choose folder" button (L363) use `title=` only (axe accepts `title` as an accessible name, so these may NOT be axe `button-name` failures — the live scan determines this); the row-menu `MoreHorizontal` trigger (L214) is a `<span onClick>` (NOT a `<button>`, no role/name — a jsx-a11y `no-static-element-interactions` / `click-events-have-key-events` target). The collapse/expand, Stop, theme, sign-out, and shield buttons already carry `aria-label` or visible text.

### Contrast Token Retune (D-04) — computed values

The Deep Midnight (`.dark`) theme is the default and the SEED-092 baseline surface. Computed contrast (WCAG relative-luminance formula) against the darkest common background `--background: 216 45% 4%` (≈ `#060a0f`, L≈0.0027):

| Token | Value | Composited | Contrast | Verdict |
|-------|-------|-----------|----------|---------|
| `--muted-foreground` (dark, global) | `220 16% 65%` (`#97a1b4`) | full opacity | **~7.7:1** | PASSES — the base token is already safe |
| `text-muted-foreground/60` | 65% L @ 0.6 alpha over bg | `≈#5d646f` | **~3.4:1** | **FAILS** — the #1 SEED-092 offender (opacity is the killer) |
| `--muted-foreground-dim` (dark) | `220 16% 45%` (`#606d85`) | full opacity | **~3.8:1** on bg / **3.59:1** on `--panel-surface` (per index.css comment) | **FAILS** |
| `--panel-muted-foreground-dim` (dark) | `220 16% 70%` (`#a6aebf`) | full opacity | **8.42:1** on panel (per index.css) | PASSES — the D-04 target template |

**The precedent (Phase 088-05, `index.css` L123-132):** panel-scoped tokens already lift muted text to 65-70% L for AA. D-04 promotes that fix to the **global** dim token.

**Prescriptive fix (planner):**
1. **Lift `--muted-foreground-dim` (dark)** from `220 16% 45%` → **`220 16% 70%`** (same H/S as `--panel-muted-foreground-dim`; ~8:1 on bg, still reads muted). Add the AA math to the existing documented token block (D-04: "extend it").
2. **Sweep the 133 opacity offenders** (`text-muted-foreground/{60,50,40,70}` across 42 files) onto full-opacity tokens: meaningful text → `text-muted-foreground`; the quietest meta → `text-muted-foreground-dim` (now lifted). **Truly decorative/disabled elements stay exempt** (WCAG-allowed — e.g. the `opacity-50` on the decorative `MessageSquare` icon in NavPanel L176 is graphic, not text).
3. **Light theme:** the same `/60` opacity sweep fixes light too. Light `--muted-foreground` (`220 9% 46%`, `#6b7280`) on light bg ≈ 4.8:1 (borderline pass full-opacity); light `--muted-foreground-dim` does not exist as a global token (only panel-scoped). Verify light with the live scan if the operator uses it, but the visible target per CONTEXT is the dark theme.

### ESLint flat-config wiring (D-02)

`frontend/eslint.config.js` is an **ESLint 9 flat config** (`defineConfig([...])`, currently react-hooks + react-refresh only). `eslint-plugin-jsx-a11y@6.10.2` exports `flatConfigs.recommended` / `flatConfigs.strict`.

**Pattern:** import the plugin, spread `jsxA11y.flatConfigs.recommended` into the config array. Its `recommended` config already sets rules to **error** severity (no manual escalation needed for D-02). See "Code Examples".

**CRITICAL CI gap:** `frontend-tests.yml` runs `npm test` (vitest) ONLY. `npm run build` = `tsc -b && vite build` — **eslint is never invoked in CI**. To make D-02's "regressions cannot merge" real, the plan MUST add a lint step (e.g. a `- run: cd frontend && npm run lint` in the `vitest` job, or a new `lint` job). Without this, jsx-a11y is a local-only convenience and a regression WILL merge. This is failure mode G-6 #5's structural sibling.

### Anti-Patterns to Avoid
- **Silent rule-disable to hit "zero"** — G-6 #2 / D-14 violation. Every exclusion is per-rule + per-selector in the axe test AND documented in VALIDATION.md with WHY. Never `/* eslint-disable jsx-a11y/... */` a whole file (G-6 #5) — that's D-02 violated in spirit.
- **Asserting contrast in vitest** — jsdom returns no computed styles; `color-contrast` silently passes (incomplete), giving false green. Contrast lives ONLY in the live scan.
- **Editing MessageItem/StreamsProvider render or stream logic** — G-5 RED LINE (D-13). Only additive aria attributes; re-run citation replay/render suites as non-regression proof.
- **Rebuilding the 153 citation a11y or the Run-modal file input** — they already carry their contracts. Audit = verify, not re-author.
- **Rewriting the global `--muted-foreground` token** — it already passes (~7.7:1). Only the DIM token + the opacity modifiers are broken. Changing the base token would wash out the whole app (G-6 #4).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Detecting a11y violations | A custom DOM walker checking roles/aria | `vitest-axe` + `axe(container)` | axe encodes 90+ WCAG rules with edge cases; already installed & wired |
| Enforcing icon-button labels | Grep for `<button>` in review | `eslint-plugin-jsx-a11y` `alt-text`/`anchor-has-content`/`control-has-associated-label` as errors | Static, exhaustive, blocks at author time |
| Color-contrast math in a test | Hand-computed luminance ratios | Chrome DevTools / axe live scan | jsdom has no layout; the browser engine is the source of truth |
| Keyboard-trap detection | Manual Tab counting only | Chrome MCP keyboard-drive (D-08) + operator re-run | Automated drive covers order/trap; operator covers "focus LOOKS visible / order FEELS right" |
| Global focus indicator | Per-component `focus-visible:ring` | The existing `:where(a,button,input,select,textarea,[tabindex]):focus-visible` floor in `index.css` L177 (Phase 088-01) | Zero-specificity floor already ships; do not duplicate |
| Reduced-motion handling | New media queries per animation | The existing `@media (prefers-reduced-motion: reduce)` blocks in `index.css` | Already covers citation/gauntlet/file-flash motion |

**Key insight:** This phase is ~90% wiring existing tools + mechanical attribute adds. The only "authoring" is the token lightness values (D-07 approves) and one aria-label per unlabeled button (D-05, copy consistent with `termMap.ts`). Every detection/enforcement mechanism already exists in the repo.

## Common Pitfalls

### Pitfall 1: jsdom cannot compute color-contrast (the phase's central trap)
**What goes wrong:** A `*.a11y.test.tsx` suite goes green, everyone assumes contrast is fixed, but a live Lighthouse scan still shows the 19 contrast nodes failing.
**Why it happens:** axe-core's `color-contrast` rule needs `getComputedStyle` + layout, which jsdom does not implement. Under vitest, axe marks `color-contrast` as *incomplete* (not *violation*) and `toHaveNoViolations` still passes. The reference suites (`DocumentDetailPanel.a11y.test.tsx`, `RelationshipsSection.a11y.test.tsx`) deliberately assert only STRUCTURAL rules for this reason.
**How to avoid:** Treat the vitest suite and the live scan as two non-overlapping halves (D-01 HYBRID). The vitest suite owns roles/names/aria; the live Chrome DevTools/Lighthouse scan owns contrast (D-03) + keyboard (D-08). Never claim the contrast SC from a green vitest run. (This IS G-6 failure mode #1.)
**Warning signs:** A plan task says "add a11y test that verifies contrast" — that task is impossible in vitest and must move to the live-scan/VALIDATION.md track.

### Pitfall 2: `title=` vs `aria-label` for icon buttons
**What goes wrong:** The sweep changes `title="New Chat"` buttons but the live scan still flags others, or vice-versa.
**Why it happens:** axe's `button-name` rule ACCEPTS `title` as an accessible name — so `<button title="X"><Icon/></button>` may already pass axe. But `title` is a poor UX name (tooltip-only, not announced consistently) and jsx-a11y may still want a better label. The 46 button-name nodes are the ones with NEITHER text, aria-label, NOR title.
**How to avoid:** Let the live `button-name` scan (D-03) enumerate the actual 46 nodes; fix those with `aria-label`. Prefer `aria-label` over `title` for new labels (consistent, announced). Don't assume a `title`-bearing button is broken.
**Warning signs:** A plan hard-codes "46 buttons to fix" from the baseline — the exact set must come from a fresh live scan against current code (146-154 shipped many labeled buttons since the 2026-06-20 baseline).

### Pitfall 3: The custom Control Room tablist hides inactive panels
**What goes wrong:** An axe scan of `ControlRoomPage` only covers the active tab's panel; other tabs' violations go unseen.
**Why it happens:** `ControlRoomPage.tsx` uses a custom `role="tablist"`/`role="tab"` (L566) where inactive tab panels are conditionally NOT rendered.
**How to avoid:** Follow the existing precedent — scan each tab-panel SUB-component in isolation (`CapabilityGrid`, `AuditTab`, `UsersAndAccess`, `ModelRegistryTab`, etc., several already have `__tests__/` dirs), OR render the page and `user.click` through each tab before scanning. Isolation matches the DocumentDetailPanel/RelationshipsSection pattern and is simpler.
**Warning signs:** A single `ControlRoomPage.a11y.test.tsx` that renders once and scans — it will miss 4 of 5 tabs.

### Pitfall 4: The 30-error tsc baseline (SEED-056/049)
**What goes wrong:** A plan reports "tsc has errors" and thinks it broke the build.
**Why it happens:** `npx tsc -b` has a KNOWN 30-error pre-existing baseline (SEED-056 vitest-file rot + SEED-049 e2e rot). Every 148-154 phase confirmed "exactly 30, 0 net-new".
**How to avoid:** The gate is **0 NET-NEW** tsc errors (line-number shifts of the same 30 are fine), `npx vite build` exit 0, and all NEW a11y suites green. Pre-existing rot is explicitly NOT this phase's bar (CONTEXT `<code_context>`).
**Warning signs:** A verification step that asserts "tsc clean / 0 errors" — it will false-fail. Assert "30 baseline, 0 net-new".

### Pitfall 5: Chrome MCP wedge during keyboard drive
**What goes wrong:** Chrome DevTools MCP hangs mid-scenario (documented risk: `chrome_mcp_dropdown_wedge` — Radix menu open → screenshot API wedges).
**Why it happens:** Known environment instability driving Radix dropdowns/menus via MCP.
**How to avoid:** D-08's built-in fallback — Claude writes the exact keyboard script (Tab/Enter/Esc/arrow sequence per scenario) and the operator drives it manually, confirming the 3 invariants (D-10). A fresh tab recovers the MCP once. Drive by ref + verify via `read_page`/psycopg2 rather than screenshotting an open menu.
**Warning signs:** A VALIDATION.md row that depends SOLELY on automated MCP with no operator-driven fallback.

## Code Examples

Verified patterns from the live repo.

### Per-surface a11y test (copy this shape — Source: `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx`)
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"                       // matcher extended in setupTests.ts
import { SurfaceComponent } from "./SurfaceComponent"

// mock @/lib/supabase + @/lib/api as the reference suites do (deterministic settle)

afterEach(() => { cleanup(); vi.clearAllMocks() })

describe("SurfaceComponent a11y — WCAG 2.1 AA (structural)", () => {
  it("no aXe violations across states", async () => {
    const { container } = render(<SurfaceComponent /* representative props */ />)
    await screen.findByText(/* something that proves render settled */)
    expect(await axe(container)).toHaveNoViolations()   // structural rules; contrast is a no-op here
  })

  // + role/aria contract asserts (role=dialog aria-modal, aria-expanded/controls,
  //   state-toggled aria-label), never-color-alone (a visible WORD present),
  //   reduced-motion (element STILL renders when matchMedia reduce=true).
})
```

### D-14 documented per-rule/per-selector exclusion (when a Radix internal is genuinely unfixable)
```typescript
// axe accepts a rules/exclude config — encode the exclusion IN the test so review sees it.
const results = await axe(container, {
  rules: {
    // WHY: <upstream bug link / false-positive reasoning>. Also listed in VALIDATION.md.
    "some-rule-id": { enabled: false },
  },
})
expect(results).toHaveNoViolations()
// NEVER a global disable in eslint.config.js or a whole-file /* eslint-disable */.
```

### ESLint flat-config wiring (D-02 — Source: jsx-eslint docs, verified for ESLint 9 flat config)
```javascript
// frontend/eslint.config.js
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import jsxA11y from 'eslint-plugin-jsx-a11y'          // NEW
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  jsxA11y.flatConfigs.recommended,                    // NEW — recommended = error severity
  {
    files: ['**/*.{ts,tsx}'],
    extends: [ js.configs.recommended, tseslint.configs.recommended,
               reactHooks.configs.flat.recommended, reactRefresh.configs.vite ],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser },
    // optional: pin specific jsx-a11y rules to 'error' explicitly if any land as 'warn'
  },
])
```

### CI lint gate (recommended — closes the D-02 enforcement gap)
```yaml
# .github/workflows/frontend-tests.yml — add to the `vitest` job (or a new `lint` job)
      - name: Lint (jsx-a11y as errors)
        run: |
          cd frontend
          npm run lint
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `jest-axe` | `vitest-axe` | Project on Vitest 4 | Use `vitest-axe/matchers` + `expect.extend`; already wired |
| jsx-a11y `.eslintrc` `extends: ['plugin:jsx-a11y/recommended']` | flat-config `jsxA11y.flatConfigs.recommended` | ESLint 9 flat config (plugin 6.9.0+) | Import + spread into the array; no `.eslintrc` |
| Per-component `focus-visible:ring` classes | Global `:where(...):focus-visible` floor (Phase 088-01) | Already shipped in `index.css` | Do not re-add; it's a zero-specificity floor |
| Panel-scoped AA contrast tokens (088-05) | Global dim-token lift (this phase, D-04) | Phase 155 | Promotes the 088-05 fix app-wide |

**Deprecated/outdated:**
- `@axe-core/playwright` path — blocked by SEED-049 (Playwright harness rotted, 16/17 fail). Not usable until SEED-049 revival.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | jsx-a11y `flatConfigs.recommended` lands all its rules at ERROR severity (no manual escalation needed for D-02) | ESLint wiring | LOW — if any rule is `warn`, the plan pins it to `error` explicitly; verified via docs that recommended uses error, but exact per-rule severity not enumerated this session `[CITED: jsx-eslint docs]` |
| A2 | The exact set of `button-name` failing nodes (baseline said 46) has shifted since 2026-06-20 because 146-154 shipped many labeled buttons | Pitfall 2 | LOW — the live scan (D-03) is the source of truth; the plan must re-enumerate, not trust the stale 46 count `[ASSUMED]` |
| A3 | Lifting dark `--muted-foreground-dim` to `220 16% 70%` reads as "still muted" and passes D-07 | Contrast Token Retune | LOW — mirrors the already-shipped `--panel-muted-foreground-dim` value (8.42:1, operator-approved in 088-05); D-07 eyeball is the gate `[VERIFIED: index.css math]` |
| A4 | The Run-modal hidden file-input pattern (`tabIndex={-1}` + proxy button) is keyboard-safe (not a trap) | Net-New Inventory | LOW — standard accessible upload pattern; D-09 scenario 1 confirms live `[VERIFIED: WorkflowsPage.tsx L1196-1240]` |
| A5 | Contrast ratios computed here (7.7:1, 3.4:1, 3.8:1) match a real browser scan | Contrast Token Retune | MEDIUM — hand-computed via WCAG luminance formula from HSL; sub-pixel antialiasing + font-weight can shift the browser's number slightly. The live scan (D-03) is authoritative `[ASSUMED — math verified, browser rendering not]` |

## Open Questions (RESOLVED)

1. **RESOLVED (Plan 155-01 Task 2 adds the `npm run lint` CI step) — Does CI enforcement of jsx-a11y land in this phase or is lint left local-only?**
   - What we know: `frontend-tests.yml` currently runs no lint; D-02 promises "regressions cannot merge."
   - What's unclear: whether the operator wants the CI lint step added now (recommended) or accepts local-only enforcement.
   - Recommendation: Add `npm run lint` to the `vitest` CI job in this phase — it's a 3-line change and is the only thing that makes D-02's promise structurally true. Flag it as a plan task.

2. **RESOLVED (Plans 155-04/155-05 use per-sub-component isolation suites) — Isolation vs. whole-page scan for the Control Room tabs?**
   - What we know: custom tablist conditionally renders panels; sub-components mostly have `__tests__/` dirs.
   - What's unclear: whether the planner prefers per-sub-component suites (simpler, matches precedent) or one page suite that clicks through tabs.
   - Recommendation: per-sub-component `*.a11y.test.tsx` (matches DocumentDetailPanel/RelationshipsSection precedent, avoids Pitfall 3).

3. **RESOLVED (dark theme is the primary zero-contrast bar; light spot-checked per 155-VALIDATION.md live rows) — Is the light theme in the D-03 zero-contrast bar, or dark only?**
   - What we know: SEED-092 baseline was measured on Deep Midnight (dark, the default); the opacity sweep fixes both themes.
   - What's unclear: whether the operator's live scan covers the light theme too.
   - Recommendation: run the live scan on the dark theme (the shipped default + baseline surface); spot-check light if the operator uses it. Note in VALIDATION.md which theme(s) were scanned.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| `eslint-plugin-jsx-a11y` | D-02 lint gate | ✗ (to install) | 6.10.2 (target) | none — must install (verified legit) |
| `vitest-axe` | D-01 vitest suites | ✓ | 0.1.0 | — |
| `axe-core` | D-01/D-03 rule engine | ✓ (transitive) | 4.11.4 | — |
| ESLint 9 flat config | D-02 wiring | ✓ | 9.39.4 | — |
| Chrome DevTools MCP | D-03 live scan + D-08 keyboard drive | ⚠ (assumed present per CONTEXT; can wedge) | — | operator-driven from Claude's script (D-08) |
| a11y-debugging skill (project) | referenced in CONTEXT | ✗ | — | Not found under `.claude/skills/` (only `sketch-findings-agentic-rag` exists) — the live scan relies on DevTools MCP directly, not a project skill |
| Local dev app (`localhost:5173`) | live scan target | ✓ (operator starts) | — | operator starts uvicorn + vite per memory `feedback_user_starts_backend` |

**Missing dependencies with no fallback:** `eslint-plugin-jsx-a11y` (install task, verified `[OK]`).
**Missing dependencies with fallback:** Chrome DevTools MCP (fallback: operator-driven keyboard from Claude's written script, per D-08). The referenced "a11y-debugging skill" does not exist as a project skill — no impact, the DevTools live scan is the actual vehicle.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.0 (jsdom) + `@testing-library/react` 16.3.2 + `vitest-axe` 0.1.0 (axe-core 4.11.4) |
| Config file | `frontend/vitest.config.ts` (setupFiles: `./src/setupTests.ts`; e2e excluded) |
| Matcher setup | `frontend/src/setupTests.ts` (`expect.extend(axeMatchers)`) + `frontend/src/vitest-axe.d.ts` (type augmentation) |
| Quick run command | `cd frontend && npx vitest run <path/to/Surface.a11y.test.tsx>` |
| Full suite command | `cd frontend && npm test` (= `vitest run`) |
| Build gate | `cd frontend && npm run build` (= `tsc -b && vite build`) — assert **30 baseline tsc errors, 0 net-new**, vite exit 0 |
| Lint gate | `cd frontend && npm run lint` (= `eslint .`) — **must go green after the D-02 sweep; add to CI** |
| Live gate | Chrome DevTools MCP / Lighthouse scan (contrast + button-name + keyboard) — VALIDATION.md, not automatable in vitest |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| A11Y-01 | Net-new surface has zero STRUCTURAL axe violations | unit (vitest-axe) | `npx vitest run <Surface>.a11y.test.tsx` | ❌ Wave 0 (per surface) |
| A11Y-01 | Net-new surface passes zero-contrast LIVE scan | manual/live | Chrome DevTools MCP scan → VALIDATION.md | ❌ live (not vitest) |
| A11Y-01 | button-name = 0 nodes app-wide (SEED-092 pages) | manual/live | Chrome DevTools/Lighthouse button-name audit | ❌ live |
| A11Y-01 | color-contrast = 0 nodes app-wide (SEED-092 pages) | manual/live | Chrome DevTools/Lighthouse color-contrast audit | ❌ live |
| A11Y-01 | jsx-a11y lint = 0 errors after sweep | static | `npm run lint` | ⚠ needs the plugin installed + CI step |
| A11Y-01 | 4 G-4 keyboard scenarios pass (task + 3 invariants) | manual (Chrome MCP + operator) | VALIDATION.md rows (D-09) | ❌ manual |
| A11Y-01 | Accessible NAMES present (D-11) | unit + live tree | axe scan + DevTools a11y tree | ❌ Wave 0 + live |

### Keyboard Scenarios (D-09 — VALIDATION.md rows the operator personally confirms)
| # | Scenario | Surface | Trap risk to prove absent |
|---|----------|---------|---------------------------|
| 1 | Launch a workflow run (Run modal → upload template → change KB folder scope → launch) | `WorkflowsPage.tsx` RunModal + `ChatLayout.tsx` | file input (classic keyboard-trap spot) — verify the `tabIndex={-1}` + proxy-button pattern lets Tab pass through |
| 2 | Navigate a cited answer (Tab to marker → peek → pin → Esc → open source doc) | `CitedMarkdown`/`CitationPeek` (inside MessageItem — G-5) | Esc restores marker focus; no trap in the `role=dialog aria-modal=false` peek |
| 3 | Operate the Control Room (reach `/admin` → switch tabs → flip kill-switch through arm-to-confirm → read audit receipt) | `ControlRoomPage` + `CapabilityGrid`/`MaintenancePanel` + `AuditTab` | destructive-action guard MUST be keyboard-operable end-to-end |
| 4 | Settings + nav traversal (collapse/expand nav → reach every destination → flip "Show technical names" toggle) | `NavPanel.tsx` + `SettingsPage.tsx` | collapsed-nav tooltips + toggle reachable by keyboard |

**Every scenario also asserts the 3 D-10 invariants: visible focus indicator, no keyboard trap (Tab/Esc out), logical focus order.**

### Sampling Rate
- **Per task commit:** the touched surface's `*.a11y.test.tsx` + any consumer suites (D-13 non-regression, esp. citation replay/render suites when a shared primitive changes).
- **Per wave merge:** `npm test` (full vitest) + `npm run lint` (0 jsx-a11y errors) + `npm run build` (30 baseline tsc, 0 net-new; vite 0).
- **Phase gate:** full vitest green + lint green + live Chrome scan (contrast 0 / button-name 0 on SEED-092 pages) + operator-confirmed 4 keyboard scenarios, before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `frontend/src/components/admin/**/*.a11y.test.tsx` — per net-new admin sub-component (several have `__tests__/` dirs to co-locate)
- [ ] `frontend/src/pages/__tests__/RunModal.a11y.test.tsx` (or co-located) — covers Run modal + file input (152)
- [ ] `frontend/src/components/chat/{CitedMarkdown,CitationPeek,CitationList,CitationCard,AbsenceHint}.a11y.test.tsx` — verify the already-shipped 153 contracts hold
- [ ] `frontend/src/pages/SettingsPage.a11y.test.tsx` + `MessageInput`/`DocumentStatusBadge` (154 surfaces; DocumentDetailPanel.a11y already exists)
- [ ] Framework install: `npm install --save-dev eslint-plugin-jsx-a11y@6.10.2` (the one new dep)
- [ ] CI: add `npm run lint` step to `frontend-tests.yml` (D-02 enforcement — otherwise local-only)
- [ ] `.planning/seeds/SEED-092-remainder.md` (or an append to SEED-092) — the D-06 documented follow-up list for out-of-scope findings

*(Existing test infra — `vitest-axe`, `setupTests.ts`, `vitest-axe.d.ts`, the two reference suites — fully covers the pattern; only the per-surface suites + the one dep + the CI lint step are net-new.)*

## Security Domain

> `security_enforcement` is not present in `.planning/config.json` (absent = enabled). This is a frontend-only, display-additive a11y phase — the security surface is minimal but documented for completeness.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth code touched (display-only aria/token edits) |
| V3 Session Management | no | Untouched |
| V4 Access Control | no | No RLS/permission logic; NavPanel operator-shield gating is render-only and untouched |
| V5 Input Validation / Output Encoding | yes (verify, not change) | Citation components already use DOMPurify + auto-escaped React text nodes; the audit must NOT reintroduce `dangerouslySetInnerHTML` when touching CitedMarkdown (153 dropped it deliberately) |
| V6 Cryptography | no | Untouched (150's encryption tile is display-audited, not modified) |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Reintroducing XSS via `dangerouslySetInnerHTML` during a citation-marker aria edit | Tampering | Keep the layout-effect-owns-innerHTML pattern (153-05); markers are `document.createElement` `<sup>`, never raw HTML injection |
| Accidental G-5 breach (editing MessageItem/StreamsProvider render/stream logic) | Tampering | D-13 RED LINE — additive aria attributes ONLY; citation replay/render suites are the non-regression tripwire |
| aria-label leaking sensitive data | Information Disclosure | LOW — labels are UI verbs ("Remove template", "Stop run"); keep copy consistent with `termMap.ts`, no IDs/secrets in labels |

**Net:** the phase's own axe/keyboard checks ARE partly a security-adjacent control (they harden operability), and the primary security discipline is *negative* — do not regress the DOMPurify/no-innerHTML and G-5 contracts while adding attributes.

## Sources

### Primary (HIGH confidence)
- Repo files (read this session): `frontend/package.json`, `frontend/eslint.config.js`, `frontend/vitest.config.ts`, `frontend/src/setupTests.ts`, `frontend/src/vitest-axe.d.ts`, `frontend/src/index.css`, `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx`, `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx`, `frontend/src/components/layout/NavPanel.tsx`, `frontend/src/pages/WorkflowsPage.tsx` (RunModal), `frontend/src/components/admin/ControlRoomPage.tsx`, `.github/workflows/frontend-tests.yml`, `.planning/config.json`
- `.planning/phases/155-accessibility-sweep-wcag-aa/155-CONTEXT.md` — D-01..D-14 locked decisions
- `.planning/seeds/SEED-092-*.md` — the quantified offender baseline (Lighthouse 87/100; 19 color-contrast + 46 button-name nodes)
- `.planning/REQUIREMENTS.md` — A11Y-01 row + "Future Requirements" deferral
- npm registry (verified this session): `eslint-plugin-jsx-a11y@6.10.2`, `vitest-axe@0.1.0`, `axe-core@4.11.4`; slopcheck `[OK]`
- jsx-eslint/eslint-plugin-jsx-a11y GitHub docs — ESLint 9 flat-config usage (`flatConfigs.recommended`/`strict`)

### Secondary (MEDIUM confidence)
- Computed WCAG contrast ratios (HSL→sRGB→relative luminance) for the dark theme tokens — math confirmed against `index.css` documented values (`--panel-muted-foreground-dim` 8.42:1); real-browser numbers may differ sub-pixel (A5).

### Tertiary (LOW confidence)
- The stale "46 button-name nodes" count (2026-06-20 baseline) — must be re-enumerated by a fresh live scan (A2).

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified on registry + slopcheck; installed versions read from `npm ls`/`package.json`.
- Architecture / surface inventory: HIGH — every file path confirmed present; test pattern read from the two shipped reference suites.
- Contrast token math: MEDIUM-HIGH — computed values align with `index.css` documented ratios; browser scan is the authoritative final check (D-03).
- Pitfalls: HIGH — jsdom-contrast limitation and the CI-lint gap are directly evidenced in the repo config; tsc-baseline and Chrome-MCP-wedge are documented in project memory.

**Research date:** 2026-07-15
**Valid until:** 2026-08-14 (stable — a11y tooling + design tokens are slow-moving; re-verify `eslint-plugin-jsx-a11y` latest only if a plan defers past a month)
