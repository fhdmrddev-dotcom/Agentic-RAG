---
phase: 155-accessibility-sweep-wcag-aa
verified: 2026-07-16T05:10:00Z
status: human_needed
score: 6/6 code-verifiable must-haves verified; 8 items require human/live verification
overrides_applied: 0
human_verification:
  - test: "Deep Midnight look preserved after the muted-token retune (D-07 full-app confirmation)"
    expected: "The app-wide opacity-modifier sweep (155-07, 27 files) still reads 'quiet muted' on Chat, Documents, Skills Studio, Settings, Control Room — not washed out. D-07's own eyeball only covered 2-3 representative pages before the full sweep landed; the remaining pages were never operator-reviewed."
    why_human: "Visual/taste judgment; no automated proxy for 'still reads muted'"
  - test: "Live color-contrast scan (D-03): 0 failing color-contrast nodes on the SEED-092 baseline pages (dark theme; spot-check light if used)"
    expected: "Chrome DevTools / Lighthouse contrast audit reports zero failing nodes on Chat, Documents, Control Room, Settings"
    why_human: "jsdom (vitest-axe) cannot compute rendered color contrast — no rendering engine. This is a hard SC#3 requirement, not optional."
  - test: "Live button-name scan (D-03): 0 failing button-name nodes app-wide on the SEED-092 pages"
    expected: "Chrome DevTools / Lighthouse button-name audit reports zero failing nodes"
    why_human: "Live scan is the source of truth for the residual set; a static grep sweep (performed by this verifier, see Anti-Patterns section) found zero unlabeled icon-only buttons among 33 sampled candidates, but a full DOM-rendered axe scan is the authoritative check the phase's own D-03 decision requires."
  - test: "Keyboard scenario 1 — Launch a workflow run (D-09.1): Run modal -> Tab through file-upload proxy button -> KB folder scope -> launch, all keyboard-only"
    expected: "No keyboard trap on the file input; visible focus indicator throughout; logical focus order"
    why_human: "Lived-experience keyboard operability judgment (G-4); RunModal.a11y.test.tsx only proves structural roles/names in jsdom, not an actual Tab-key walkthrough in a real browser"
  - test: "Keyboard scenario 2 — Navigate a cited answer (D-09.2): Tab to citation marker -> open peek -> pin -> Esc (focus returns to marker) -> open source document"
    expected: "No trap; Esc restores focus to the marker; all 3 D-10 invariants hold"
    why_human: "Same as above — CitationUI.a11y.test.tsx is a structural jsdom suite, not a live Tab-key trace"
  - test: "Keyboard scenario 3 — Operate the Control Room (D-09.3): reach /admin -> switch tabs -> flip a kill-switch through its arm-to-confirm guard -> read the audit receipt, keyboard-only"
    expected: "Destructive-action guard fully keyboard-operable end-to-end; all 3 D-10 invariants hold"
    why_human: "G-4 destructive-action guard must be proven live; CapabilityGrid/MaintenancePanel a11y suites assert role+name reachability in jsdom only"
  - test: "Keyboard scenario 4 — Settings + nav traversal (D-09.4): collapse/expand nav -> reach every nav destination -> flip the 154 'Show technical names' toggle, keyboard-only"
    expected: "All destinations reachable; toggle operable; all 3 D-10 invariants hold"
    why_human: "Collapsed-nav tooltip reveal + real focus-order behavior can't be proven in jsdom"
  - test: "Accessible names present on every interactive control across net-new surfaces (D-11), inspected via the live DevTools accessibility tree"
    expected: "Every control has a non-empty accessible name"
    why_human: "DevTools a11y tree is the specified machine-checkable source for this bar; not yet run against the live app"
---

# Phase 155: Accessibility Sweep — WCAG AA Verification Report

**Phase Goal:** Every net-new v3.3 surface passes automated and manual accessibility checks at WCAG 2.1 AA, and the worst pre-existing app-wide offenders are fixed in the same pass.
**Verified:** 2026-07-16T05:10:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

The phase goal has two explicit halves per its own wording ("automated **and manual**"), and the ROADMAP's own 3 Success Criteria split the same way (SC#1 automated axe, SC#2 manual keyboard walkthrough, SC#3 worst-offenders fixed — which itself has an automated-fix half + a live-scan-confirmation half per D-03/D-04). All code-level (automated, git-verifiable) work is genuinely done and green. The live-browser half (color-contrast measurement, button-name live scan, and the 4 keyboard walkthrough scenarios) was deliberately deferred by every plan in this phase to `/gsd:verify-work` (confirmed in 155-01/02/03/06/07 SUMMARY frontmatter: `requirements-completed: []` with the explicit note "closes at /gsd:verify-work 155"). This verifier does not have Chrome MCP / live-browser tooling available, so that half cannot be closed here — it is correctly surfaced below as `human_needed`, not silently passed and not falsely failed.

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | D-02: `eslint-plugin-jsx-a11y` runs app-wide at error severity; CI genuinely fails on a new a11y violation | VERIFIED | `frontend/eslint.a11y.config.js` enforces `jsxA11y.flatConfigs.recommended.rules`; `npm run lint:a11y` exits 0 on the current tree (ran directly); `.github/workflows/frontend-tests.yml` runs `npm run lint:a11y` as a CI step; code review independently injected a missing-`alt` probe and confirmed exit 1, removed it and confirmed exit 0 |
| 2 | D-04: the global dim token is lifted from a failing to an AA-passing value, and the opacity-modifier sweep removes offending classes on meaningful text app-wide | VERIFIED | `frontend/src/index.css:118` = `--muted-foreground-dim: 220 16% 70%` (8.42:1, was 220 16% 45% / 3.59:1 — old failing value absent from file); residual `grep -rnE "text-muted-foreground/(40|50|60|70)" src` = exactly 20 occurrences, and this verifier manually inspected all 20 — every one is a decorative `aria-hidden` icon, a disabled/`cursor-not-allowed` control, or an input `placeholder:` class (all WCAG-1.4.3-exempt categories), matching the SUMMARY's documented exemption list exactly |
| 3 | D-05: every icon-only button app-wide carries an accessible name | VERIFIED (static) / re-confirm live per D-03 | Ran an independent heuristic scan across all non-test `.tsx` files for `<button>` elements lacking `aria-label` near an icon; 33 raw hits, manually inspected all 33 — every one resolves to a button with visible text content adjacent to the icon (a valid accessible-name source per WCAG 4.1.2), zero true icon-only-unlabeled buttons found. This corroborates but does not replace the D-03 live axe/Lighthouse button-name scan the phase's own contract requires |
| 4 | D-01: every net-new v3.3 surface (Control Room all tabs, Run modal, citation UI, 154 relabels) has a `*.a11y.test.tsx` vitest-axe suite passing zero structural violations | VERIFIED | 18 net-new `*.a11y.test.tsx` files exist (+2 pre-existing reference suites = 20 total); ran all 20 directly with `npx vitest run` — 166/166 tests pass, 20/20 files green |
| 5 | D-14: any documented axe exclusion is narrowly per-rule/per-selector with a positive counter-assertion, never a blanket disable | VERIFIED | Both registered exclusions (`empty-table-header` in `ModelRegistryTab.a11y.test.tsx`, `nested-interactive` in `CitationUI.a11y.test.tsx`) are scoped via `rules: { "<rule-id>": { enabled: false } }` on specific test blocks only, each followed by a positive `getByRole(...)` assertion proving the underlying barrier doesn't exist; no `eslint-disable` or global axe-config bypass found anywhere in `src` |
| 6 | Code-review Critical + Warnings (CR-01 keyboard-unreachable Stop/options; WR-01 invisible-focus hover-reveal ×3; WR-02 misapplied `aria-pressed`; WR-03 misleading focus-reveal comment) are fixed, not just claimed | VERIFIED | Read the actual diffs: `NavPanel.tsx` actions row is now unconditionally rendered + `group-focus-within:opacity-100` (CR-01); `MessageFeedback.tsx`/`MemorySection.tsx`/`HealthDocumentRow.tsx` all now carry `group-focus-within:opacity-100` alongside `group-hover:opacity-100` (WR-01); `DocumentList.tsx` uses `aria-current` in place of `aria-pressed` (WR-02); both `PlainLabel.tsx` and `PhaseFormPanel.tsx` `InfoHint` comments now honestly describe hover-only native-title behavior (WR-03). Non-regression: `DocumentList.test.tsx` (both copies) 11/11 green |
| 7 | SC#2: each net-new surface is fully operable via keyboard — MANUAL walkthrough at WCAG 2.1 AA | **NOT YET VERIFIED — human required** | No `*-HUMAN-UAT.md` or equivalent live-walkthrough record exists for the 4 D-09 scenarios; every plan SUMMARY explicitly defers this to `/gsd:verify-work`; this verifier has no Chrome MCP / live-browser access |
| 8 | SC#3 (live half): 0 failing color-contrast + button-name nodes on a REAL rendered page (D-03) | **NOT YET VERIFIED — human required** | jsdom (vitest-axe) structurally cannot compute contrast; no live Chrome/Lighthouse scan record exists in VALIDATION.md's Documented Exclusions or elsewhere; static code inspection (truths #2, #3 above) is strong corroborating evidence but is explicitly not accepted by the phase's own D-01/D-03 decisions as a substitute |

**Score:** 6/6 code-verifiable truths VERIFIED. 2 truths (SC#2 keyboard walkthrough, SC#3 live-scan half) remain open pending human/live-browser verification — this is the correctly-scoped remainder per the phase's own HYBRID-gate design (D-01), not a defect in the executed work.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/eslint.a11y.config.js` | jsx-a11y-only ESLint flat config | VERIFIED | Exists, enforces `jsxA11y.flatConfigs.recommended.rules`, excludes test files |
| `frontend/package.json` (`lint:a11y` script) | New a11y-scoped lint script | VERIFIED | `"lint:a11y": "eslint . -c eslint.a11y.config.js"` present; `"lint": "eslint ."` kept |
| `.github/workflows/frontend-tests.yml` | CI step running `npm run lint:a11y` | VERIFIED | "Lint (jsx-a11y as errors)" step present, runs after `npm test` |
| `frontend/src/index.css` (`--muted-foreground-dim`) | Token lifted to AA-passing value | VERIFIED | `220 16% 70%` (8.42:1); old `220 16% 45%` value absent |
| `.planning/seeds/SEED-092-remainder.md` | Documented out-of-scope follow-up list | VERIFIED | Exists, has `re_open_triggers`, lists legacy focus-visible gaps, heading order, alt-text, full SR pass, Phase-095 tool-cards, light-theme audit as explicitly deferred |
| 18 net-new `*.a11y.test.tsx` suites (Control Room, Run modal, citation UI, 154 surfaces) | vitest-axe structural coverage | VERIFIED | All 18 present + 2 pre-existing reference suites; 20/20 files green, 166/166 tests pass |
| `155-REVIEW.md` gap-closure commits | CR-01 + WR-01/02/03 fixed | VERIFIED | Commits `30879e4f`, `07d3803b`, `b31220e3`, `ff0cde20` present in `git log`; diffs read and confirmed to implement the prescribed fixes |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `frontend-tests.yml` CI job | `lint:a11y` script | `run: npm run lint:a11y` step | WIRED | Confirmed present and ordered after the vitest step |
| `eslint.a11y.config.js` | `eslint-plugin-jsx-a11y` recommended rules | `rules: jsxA11y.flatConfigs.recommended.rules` | WIRED | Confirmed at error severity; empirically fails on an injected violation per code review, reconfirmed by this verifier's clean-tree `exit 0` run |
| `index.css` `--muted-foreground-dim` token | opacity-swept components | Tailwind `text-muted-foreground` full-opacity class (not the dim token directly — 155-02/07 chose the full-opacity token per D-07 sign-off) | WIRED | Grep-confirmed 73 sweeps landed on `text-muted-foreground` (no opacity suffix); 20 documented residuals all exempt |
| `NavPanel.tsx` thread-row `group` wrapper | actions row reveal | `group-focus-within:opacity-100` CSS class | WIRED | Read the live component: `group` on row wrapper (line 168), `group-focus-within:opacity-100` on the actions div (line 223) — CR-01 fix is structurally correct |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| A11Y-01 | 155-01..07 (all 7 plans declare it) | All net-new v3.3 surfaces pass automated axe scan + manual keyboard walkthrough at WCAG 2.1 AA; worst pre-existing offenders fixed | PARTIALLY SATISFIED — automated + code-level fix half SATISFIED; manual/live half NEEDS HUMAN | `.planning/REQUIREMENTS.md:99` correctly still shows "Pending" (not falsely marked Satisfied); no orphaned requirements found — A11Y-01 is the only requirement mapped to Phase 155 in REQUIREMENTS.md, and all 7 plans declare it |

No orphaned requirements: `grep -n "Phase 155" .planning/REQUIREMENTS.md` returns only the A11Y-01 row.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX` debt markers found in any file touched by this phase (checked NavPanel, PlainLabel, PhaseFormPanel, MessageFeedback, MemorySection, HealthDocumentRow, DocumentList, admin components, citation components) | — | none |
| — | — | Zero `eslint-disable.*jsx-a11y` suppressions anywhere in `src` (grep-confirmed) | — | none — matches D-02's "real fixes, no suppressions" claim |
| `frontend/src/components/admin/__tests__/LockedTab.a11y.test.tsx:8,41` | — | "Not built yet — coming soon" text | INFO | This is a legitimate, intentional product-status message for genuinely-not-yet-built admin features (unrelated to this phase's completeness) — not a stub in the a11y work |

No blocker-level anti-patterns found. The two D-14 axe exclusions are correctly narrow-scoped, not blanket disables (verified directly in test source).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| a11y test suites pass | `npx vitest run <all 20 *.a11y.test.tsx>` | 20 files / 166 tests, all green | PASS |
| a11y lint gate is real and green | `npm run lint:a11y` | exit 0 | PASS |
| tsc build baseline unchanged | `npx tsc -b` | 30 errors (matches documented SEED-056/049 baseline, 0 net-new) | PASS |
| vite build succeeds | `npx vite build` | exit 0 (7.96s) | PASS |
| Non-regression on a WR-02-touched file | `npx vitest run src/components/ingestion/DocumentList.test.tsx src/__tests__/components/DocumentList.test.tsx` | 2 files / 11 tests, all green | PASS |
| Residual opacity-offender count matches documentation | `grep -rnE "text-muted-foreground/(40\|50\|60\|70)" src \| wc -l` | 20 (matches SUMMARY claim exactly); manually inspected all 20, all legitimate exemptions | PASS |
| No unlabeled icon-only buttons (independent static sweep) | custom Node heuristic scan across all non-test `.tsx` for `<button>` + icon without `aria-label` and without adjacent text | 33 raw hits, all 33 manually confirmed to have visible text labels (false positives of the heuristic, not real gaps) | PASS |

### Human Verification Required

See YAML frontmatter `human_verification` for the full structured list (8 items). Summary:

1. **Live color-contrast scan (D-03)** — Chrome DevTools/Lighthouse on Chat, Documents, Control Room (+ light theme spot-check) confirming 0 failing color-contrast nodes. This is the authoritative proof for SC#3's contrast half — jsdom cannot compute it.
2. **Live button-name scan (D-03)** — same tooling, confirming 0 failing button-name nodes app-wide on the SEED-092 baseline pages. This verifier's static analysis strongly corroborates zero gaps but is not the tool the phase's own decisions designate as authoritative.
3. **4 keyboard walkthrough scenarios (D-09.1-4)** — workflow launch, cited-answer navigation, Control Room kill-switch arm-to-confirm, Settings+nav traversal — each keyboard-only, each asserting the 3 D-10 invariants (visible focus, no trap, logical order). CR-01 (a real keyboard trap on NavPanel) was caught by code review reading, not by an actual live Tab-through — which underscores why the live walkthrough still matters even after the code-level fix.
4. **Accessible-name DevTools-tree spot check (D-11)** on each net-new surface.
5. **Full-app D-07 look-preservation re-check** — the original D-07 eyeball covered only 2-3 pages before the 155-07 sweep touched 27 more files; a broader visual pass would close this out with more confidence (lower priority than 1-4; the token math is objectively unchanged from the approved value).

### Gaps Summary

No code-level gaps. All automatable/static must-haves are VERIFIED, including the code-review Critical (CR-01) and all 3 Warnings, which were found, fixed, and the fixes independently confirmed in this verification pass (not merely trusted from SUMMARY claims). The remaining work is exactly the live-browser half the phase's own D-01 HYBRID-gate design always intended to close at `/gsd:verify-work` — it was never claimed complete by any plan SUMMARY (`requirements-completed: []` with explicit "closes at /gsd:verify-work" notes across 155-01/02/07), so nothing here is a false-green. Because this verifier has no Chrome MCP / live-browser tool access, these 8 items are correctly routed to human_verification rather than either being silently skipped (false pass) or invented as failures.

---

_Verified: 2026-07-16T05:10:00Z_
_Verifier: Claude (gsd-verifier)_
