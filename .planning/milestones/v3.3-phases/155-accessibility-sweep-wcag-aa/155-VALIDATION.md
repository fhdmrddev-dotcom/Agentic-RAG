---
phase: 155
slug: accessibility-sweep-wcag-aa
status: draft
nyquist_compliant: true
wave_0_complete: false
created: 2026-07-15
updated: 2026-07-15
---

# Phase 155 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> HYBRID gate (D-01): vitest-axe suites own STRUCTURAL rules; the LIVE Chrome scan owns
> color-contrast + button-name + the keyboard walkthrough. jsdom CANNOT compute contrast —
> never claim the contrast SC from a green vitest run (G-6 #1).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (frontend, jsdom) + vitest-axe 0.1.0 (axe-core 4.11.4) + @testing-library/react |
| **Config file** | `frontend/vitest.config.ts` (setup: `frontend/src/setupTests.ts` — axe matcher already extended) |
| **Quick run command** | `cd frontend && npx vitest run <touched .a11y.test.tsx suites>` |
| **Full suite command** | `cd frontend && npm test` |
| **Lint gate** | `cd frontend && npm run lint` (= `eslint .` — must be GREEN after Plan 03; enforced in CI per Plan 01) |
| **Build gate** | `cd frontend && npm run build` (= `tsc -b && vite build`) — assert **30 baseline tsc errors, 0 net-new** (SEED-056/049), vite exit 0 |
| **Live gate** | Chrome DevTools MCP / Lighthouse scan (color-contrast + button-name + keyboard) — manual, NOT automatable in vitest |
| **Estimated runtime** | ~60-90 seconds (full vitest) |

---

## Sampling Rate

- **After every task commit:** Run TARGETED suites only — the touched surface's `*.a11y.test.tsx` / `__tests__` directory (+ consumer suites on a D-13 shared-primitive fix, esp. `MessageItem.test.tsx` when the citation cluster is touched). Task-level verify commands never run the full `npm test`.
- **After every plan wave:** `npm test` (full vitest) + `npm run lint` (0 jsx-a11y errors, after Plan 03) + `npm run build` (30 baseline tsc, 0 net-new; vite 0).
- **Before `/gsd:verify-work`:** Full vitest green + lint green + LIVE Chrome scan (contrast 0 / button-name 0 on SEED-092 pages) + operator-confirmed 4 keyboard scenarios.
- **Max feedback latency:** 120 seconds (task-level targeted runs are well under this).

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 155-01-01 | 01 | 1 | A11Y-01 | T-155-01-SC | Pinned legit dep; jsx-a11y at error app-wide; no @axe-core/playwright | static | `cd frontend && grep -q "jsxA11y.flatConfigs.recommended" eslint.config.js && npx eslint --print-config src/main.tsx \| grep -q "jsx-a11y/"` | ❌ W0 | ⬜ pending |
| 155-01-02 | 01 | 1 | A11Y-01 | T-155-01-CI | Additive CI lint step, no new secrets/actions | static | `grep -q "npm run lint" .github/workflows/frontend-tests.yml` | ❌ W0 | ⬜ pending |
| 155-02-01 | 02 | 1 | A11Y-01 | T-155-02-VIS | Dim token lifted to AA; base token untouched | static+build | `cd frontend && grep -q "muted-foreground-dim: 220 16% 70%" src/index.css && ! grep -q "220 16% 45%" src/index.css && npx vite build` | ✅ | ⬜ pending |
| 155-02-02 | 02 | 1 | A11Y-01 | T-155-02-G5 | Admin-cluster opacity offenders swept (11 files); MessageItem/StreamsProvider untouched | unit (targeted) | `cd frontend && npx vitest run src/components/admin/__tests__ && npx vite build` | ✅ | ⬜ pending |
| 155-02-03 | 02 | 1 | A11Y-01 | T-155-02-VIS | Deep Midnight look preserved | manual (D-07 checkpoint) | see Manual-Only #1 | N/A | ⬜ pending |
| 155-07-01 | 07 | 1 | A11Y-01 | T-155-07-G5 | Chat-cluster opacity offenders swept (7 files); G-5 files untouched; ToolCallPanel className-only | unit (targeted) | `cd frontend && npx vitest run src/components/chat/__tests__ && npx vite build` | ✅ | ⬜ pending |
| 155-07-02 | 07 | 1 | A11Y-01 | T-155-07-VIS | Studio/classification/settings cluster swept (11 files), className-only | unit (targeted) | `cd frontend && npx vitest run src/components/skills src/components/settings && npx vite build` | ✅ | ⬜ pending |
| 155-07-03 | 07 | 1 | A11Y-01 | T-155-07-VIS | Long-tail cluster swept (13 files); app-wide residuals = documented exemptions only | unit (targeted) | `cd frontend && npx vitest run src/pages/__tests__ src/components/ingestion && npx vite build` | ✅ | ⬜ pending |
| 155-03-01 | 03 | 2 | A11Y-01 | T-155-03-SUPPRESS | Lint zero via real fixes, no suppressions (two committed sub-passes if inventory > ~20 files) | static | `cd frontend && npm run lint && [ $(grep -rc "eslint-disable.*jsx-a11y" src \| grep -v ':0$' \| wc -l) -eq 0 ]` | ✅ | ⬜ pending |
| 155-03-02 | 03 | 2 | A11Y-01 | T-155-03-INFO | Every icon button labeled; no IDs/secrets in labels | static+unit (targeted) | `cd frontend && npm run lint && npx vitest run src/components/chat/__tests__ src/components/admin/__tests__` | ✅ | ⬜ pending |
| 155-03-03 | 03 | 2 | A11Y-01 | T-155-03-SUPPRESS | Out-of-scope findings logged, not lost | static | `test -f .planning/seeds/SEED-092-remainder.md && grep -q "re_open_trigger" .planning/seeds/SEED-092-remainder.md` | ❌ W0 | ⬜ pending |
| 155-04-01 | 04 | 3 | A11Y-01 | T-155-04-FALSEGREEN | Structural zero-violations on shell/status components | unit | `cd frontend && npx vitest run src/components/admin/__tests__/OperatorBand.a11y.test.tsx src/components/admin/__tests__/HealthSignals.a11y.test.tsx src/components/admin/__tests__/RecentActionsCard.a11y.test.tsx src/components/admin/__tests__/LockedTab.a11y.test.tsx src/components/admin/__tests__/TechnicalNamesToggle.a11y.test.tsx` | ❌ W0 | ⬜ pending |
| 155-04-02 | 04 | 3 | A11Y-01 | T-155-04-GUARD | Kill-switch/Kill/read-only guards reachable by role+name | unit | `cd frontend && npx vitest run src/components/admin/__tests__/ActiveRunsSection.a11y.test.tsx src/components/admin/__tests__/CapabilityGrid.a11y.test.tsx src/components/admin/__tests__/MaintenancePanel.a11y.test.tsx` | ❌ W0 | ⬜ pending |
| 155-05-01 | 05 | 3 | A11Y-01 | T-155-05-INFO | Governance controls labeled; no leaked IDs | unit | `cd frontend && npx vitest run src/components/admin/__tests__/AuditTab.a11y.test.tsx src/components/admin/__tests__/UsersAndAccess.a11y.test.tsx src/components/admin/__tests__/FeatureVisibility.a11y.test.tsx` | ❌ W0 | ⬜ pending |
| 155-05-02 | 05 | 3 | A11Y-01 | T-155-05-EXCLUDE | Registry controls labeled; icons decorative-or-labeled | unit (targeted) | `cd frontend && npx vitest run src/components/admin/__tests__/ModelRegistryTab.a11y.test.tsx src/components/admin/__tests__/ModelDiscoveryPanel.a11y.test.tsx && npx vitest run src/components/admin/__tests__` | ❌ W0 | ⬜ pending |
| 155-06-01 | 06 | 3 | A11Y-01 | T-155-06-FALSEGREEN | Run-modal file-input Tab-through (not a trap); delete-confirm role/name | unit | `cd frontend && npx vitest run src/pages/__tests__/RunModal.a11y.test.tsx` | ❌ W0 | ⬜ pending |
| 155-06-02 | 06 | 3 | A11Y-01 | T-155-06-XSS / T-155-06-G5 | Citation contracts hold; no innerHTML; MessageItem untouched | unit | `cd frontend && npx vitest run src/components/chat/__tests__/CitationUI.a11y.test.tsx src/components/chat/__tests__/MessageItem.test.tsx` | ❌ W0 | ⬜ pending |
| 155-06-03 | 06 | 3 | A11Y-01 | T-155-06-FALSEGREEN | Settings toggle/tabs + composer + badge roles/names | unit (targeted) | `cd frontend && npx vitest run src/pages/__tests__/SettingsPage.a11y.test.tsx src/components/chat/__tests__/MessageInput.a11y.test.tsx src/components/ingestion/__tests__/DocumentStatusBadge.a11y.test.tsx && npx vitest run src/pages/SettingsPage.test.tsx src/__tests__/components/DocumentStatusBadge.test.tsx src/components/chat/__tests__/MessageItem.test.tsx` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*
*File Exists column: ✅ = production/config file already exists; ❌ W0 = net-new artifact created by the plan (Wave 0 gap).*
*Full `npm test` is NOT embedded in any task-level command — it runs at wave boundaries per Sampling Rate (Nyquist 8b feedback latency).*

---

## Wave 0 Requirements

Net-new artifacts each plan creates (the "does not exist yet" set). Each is authored inside its plan — none blocks another plan's start beyond the declared `depends_on`. Plans 155-02 and 155-07 create no new artifacts (source edits to existing files only).

- [ ] **Dep + gate:** `eslint-plugin-jsx-a11y@6.10.2` installed + `jsxA11y.flatConfigs.recommended` in `frontend/eslint.config.js` (Plan 01 T1)
- [ ] **CI enforcement:** `npm run lint` step in `.github/workflows/frontend-tests.yml` (Plan 01 T2)
- [ ] **Lint inventory:** `.planning/phases/155-accessibility-sweep-wcag-aa/155-lint-inventory.txt` (Plan 01 T1 → Plan 03 consumes)
- [ ] **Follow-up list:** `.planning/seeds/SEED-092-remainder.md` (Plan 03 T3)
- [ ] **Admin Control-Plane suites:** `admin/__tests__/{OperatorBand,HealthSignals,RecentActionsCard,LockedTab,TechnicalNamesToggle,ActiveRunsSection,CapabilityGrid,MaintenancePanel}.a11y.test.tsx` (Plan 04)
- [ ] **Admin Governance/Registry suites:** `admin/__tests__/{AuditTab,UsersAndAccess,FeatureVisibility,ModelRegistryTab,ModelDiscoveryPanel}.a11y.test.tsx` (Plan 05)
- [ ] **Net-new surface suites:** `pages/__tests__/RunModal.a11y.test.tsx`, `chat/__tests__/CitationUI.a11y.test.tsx`, `pages/__tests__/SettingsPage.a11y.test.tsx`, `chat/__tests__/MessageInput.a11y.test.tsx`, `ingestion/__tests__/DocumentStatusBadge.a11y.test.tsx` (Plan 06)

*(Existing infra — `vitest-axe`, `setupTests.ts`, `vitest-axe.d.ts`, the two reference suites, the global focus floor + reduced-motion blocks in index.css — fully covers the pattern; only the per-surface suites + the one dep + the CI lint step + the token lift + the remainder doc are net-new.)*

---

## Manual-Only Verifications

These are the LIVE half of the D-01 HYBRID gate — not automatable in jsdom. Executed at `/gsd:verify-work`. Fallback if Chrome MCP wedges (known risk): the operator drives from Claude's written keyboard/scan script (D-08).

| # | Behavior | Requirement | Why Manual | Test Instructions |
|---|----------|-------------|------------|-------------------|
| 1 | Token retune preserves the Deep Midnight look (D-07) | A11Y-01 | Visual taste judgment; no automated proxy for "still reads muted" | Plan 02 T3 checkpoint: 2-min before/after eyeball on Chat + Documents + Control Room; approve or nudge the lightness. The 155-07 clusters sweep onto the approved value. |
| 2 | color-contrast = 0 failing nodes app-wide on SEED-092 pages (D-03) | A11Y-01 | jsdom cannot compute contrast — requires a real rendering engine | Chrome DevTools MCP / Lighthouse color-contrast audit on the SEED-092 baseline pages (dark theme, the default + baseline surface; spot-check light if the operator uses it). Run AFTER both 155-02 and 155-07 have landed. Record which theme(s) scanned. |
| 3 | button-name = 0 failing nodes app-wide on SEED-092 pages (D-03) | A11Y-01 | Live scan is the source of truth for the residual set (count shifted since 2026-06-20) | Chrome DevTools/Lighthouse button-name audit on the SEED-092 pages; enumerate any residual node and fix (should be closed by Plan 03). |
| 4 | Accessible NAMES present on every interactive control (D-11) | A11Y-01 | DevTools a11y tree is the machine-checkable name source; NO live NVDA/JAWS pass this phase | Inspect the DevTools accessibility tree on each net-new surface; confirm every control has a non-empty accessible name. Full screen-reader UX pass → SEED-092-remainder. |
| 5 | Keyboard scenario 1 — Launch a workflow run (D-09.1) | A11Y-01 | Lived-experience keyboard operability + focus-visibility judgment (G-4) | Claude drives via Chrome MCP, then operator re-runs: open Run modal → Tab to upload template (file input must NOT trap — Tab passes through the hidden input to the proxy button) → change KB folder scope → launch. Assert the 3 D-10 invariants. |
| 6 | Keyboard scenario 2 — Navigate a cited answer (D-09.2) | A11Y-01 | Same (G-4); citation peek is inside MessageItem (G-5) | Tab to a citation marker → open peek → pin → Esc (focus returns to the marker, no trap) → open the source document. Assert the 3 D-10 invariants. |
| 7 | Keyboard scenario 3 — Operate the Control Room (D-09.3) | A11Y-01 | Destructive-action guard MUST be keyboard-safe (G-4) | Reach `/admin` → switch operator tabs → flip a kill-switch through its arm-to-confirm guard → read the audit receipt — all keyboard-only. Assert the 3 D-10 invariants. |
| 8 | Keyboard scenario 4 — Settings + nav traversal (D-09.4) | A11Y-01 | Collapsed-nav tooltips + the 154 toggle reachable (G-4) | Collapse/expand nav → reach every nav destination → flip the 154 "Show technical names" toggle — keyboard-only. Assert the 3 D-10 invariants. |

**The 3 D-10 invariants asserted on EVERY scenario:** (1) visible focus indicator on every interactive element, (2) no keyboard trap (always Tab/Esc out), (3) logical focus order (follows visual reading order).

### Keyboard Scenario → Surface map (D-09)

| # | Scenario | Surface(s) | Trap risk to prove absent | Vitest structural backstop |
|---|----------|-----------|---------------------------|----------------------------|
| 1 | Launch a workflow run | `WorkflowsPage.tsx` RunModal + `ChatLayout.tsx` | file input (classic trap) — `tabIndex={-1}` hidden input + proxy button lets Tab pass | 155-06-01 |
| 2 | Navigate a cited answer | `CitedMarkdown`/`CitationPeek` (inside MessageItem — G-5) | Esc restores marker focus; no trap in `role=dialog aria-modal=false` | 155-06-02 |
| 3 | Operate the Control Room | `ControlRoomPage` + `CapabilityGrid`/`MaintenancePanel` + `AuditTab` | destructive-action guard keyboard-operable end-to-end | 155-04-02 |
| 4 | Settings + nav traversal | `NavPanel.tsx` + `SettingsPage.tsx` | collapsed-nav tooltips + toggle reachable by keyboard | 155-06-03 (settings) / 155-03 (nav labels) |

---

## Documented Exclusions (D-14 register)

*Populated during execution + the live scan. Every entry is ALSO encoded as a per-rule/per-selector `axe(container, { rules: { "<rule-id>": { enabled: false } } })` exclusion in the owning `*.a11y.test.tsx` with a WHY comment. "Zero violations" = zero UNEXPLAINED violations. NEVER a global disable.*

| Rule ID | Selector / Node | Surface | WHY (upstream link / false-positive reasoning) | Encoded in test |
|---------|-----------------|---------|-------------------------------------------------|-----------------|
| `empty-table-header` | `th[aria-label="Row actions"]` | ModelRegistryTab (070-A) — the registry table's trailing actions column | Confirmed false-positive for the WCAG-AA bar. `empty-table-header` is an axe **best-practice** rule (tag: `best-practice`, NOT WCAG A/AA). The `<th>` is an intentionally text-less actions column that IS accessibly named via `aria-label="Row actions"` (asserted positively in the suite via `getByRole("columnheader", { name: /row actions/i })`), so the barrier the rule guards — an unnamed column header — does not exist for AT users. The rule only fires because the name is not *visible* text. Cannot be source-fixed this pass (Plan 05 is test-only; a real fix = add `sr-only` header text, logged to SEED-092-remainder as the additive follow-up). | `ModelRegistryTab.a11y.test.tsx` — per-rule exclusion `axe(container, { rules: { "empty-table-header": { enabled: false } } })` applied ONLY to the two table-rendering scans (populated + ⌥ technical); every other WCAG-AA structural rule stays ON; header name asserted positively. |
| `nested-interactive` | `.citation-ref-row[role="button"]` (hosting the nested "Open document" `<button>`) | CitationCard / CitationList (153) — the References footer rows | Known, tracked design tradeoff (NOT a false-positive, NOT source-fixable this pass). The Phase-153 footer row is a CONVENIENCE click-target (activating it flashes the in-text marker) that deliberately wraps a proper, independently-reachable "Open document" `<button>` — the sanctioned `role="button"+tabIndex+guarded-keydown` container pattern 155-03 adopted for rows that host nested interactives (a native `<button>` wrapping another button is invalid HTML). The barrier `nested-interactive` guards — a control unreachable/unannounced due to nesting — does NOT exist here: the nested "Open document" button is in the tab order AND carries its own accessible name (asserted positively via `getByRole("button", { name: /Open document/ })`). The fully-separated restructure (row → non-interactive wrapper) is a render-logic change out of scope for Plan 06 (TEST-ONLY verify; D-13 is additive-only + must not rebuild the citation components) and was already logged to SEED-092-remainder by 155-03. | `CitationUI.a11y.test.tsx` — per-rule exclusion `axe(container, { rules: { "nested-interactive": { enabled: false } } })` (constant `CITATION_ROW_AXE_OPTS`) applied ONLY to the two citation-row scans (CitationList open footer + CitationCard numbered card); every other WCAG-AA structural rule stays ON; the row's name AND the nested Open-document button asserted positively. |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or are the single D-07 manual checkpoint (155-02-03), which is flanked by automated tasks (no 3 consecutive manual)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references (per-surface suites + dep + CI step + token + remainder doc)
- [x] No watch-mode flags (all `vitest run`, never `vitest` watch)
- [x] Feedback latency < 120s — task-level verifies are TARGETED suites only; full `npm test` runs at wave boundaries (Nyquist 8b)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for execution (live/keyboard rows confirmed by the operator at `/gsd:verify-work`)
