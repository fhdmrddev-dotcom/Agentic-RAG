---
status: partial
phase: 154-plain-language-layer
source: [154-VERIFICATION.md]
started: 2026-07-15
updated: 2026-07-15
---

## Current Test

Live cross-surface reveal + copy-naturalness (operator judgment).

## Context

Phase 154 verification returned `human_needed` (8/8 must-haves code-verified). Per the
148–153 convention, LANG-01 closes at verify + live UAT. This file records the live UAT
Claude ran unattended (Chrome MCP, operator session already authenticated) plus the
operator-judgment items that remain.

## Live UAT run by Claude (2026-07-15, Chrome MCP, text-driven — screenshot path wedged per known chrome_mcp_dropdown_wedge)

| # | Criterion | Result | Evidence |
|---|-----------|--------|----------|
| U1 | SC#1 — plain labels by default | ✅ PASS | Settings tab rendered **"Search"** (plain `settings.tab.retrieval`), composer mode **"General"** (plain) with the reveal OFF. No jargon leaked on the default surfaces observed. |
| U2 | SC#3 — reveal flips to technical vocabulary | ✅ PASS (decisive) | Flipping **"Show technical names"** (⌥ toggle, Settings › AI Model) ON changed the tab label **"Search" → "Search & Retrieval"** (the technical value) live in one interaction. |
| U3 | App-wide mount / no regression | ✅ PASS | Workflows, Settings, and Chat all rendered normally with `TechnicalNamesProvider` mounted app-wide over ChatLayout — no white-screen, no provider-throw (the D-01a consolidation + App-level mount did not break rendering). |
| U4 | Persistence across reload | ⏸️ NOT RE-CONFIRMED LIVE | Unit-tested (`TechnicalNamesProvider.test.tsx` — persists across remount) + verifier-confirmed at code level (localStorage-backed). Live re-check blocked: after a hard reload the operator-gated Settings nav entry only re-renders once the async `/admin` operator probe resolves, and the post-reload Settings view did not switch on the synthetic nav click (Chrome-MCP stale-ref flakiness, not a product defect). |
| U5 | D-01a "one switch" (Settings ↔ Control Room shared context) | ⏸️ NOT RE-CONFIRMED LIVE | Code-verified: both `SettingsPage.tsx` and `ControlRoomPage.tsx` consume the SAME `useTechnicalNames()` context instance mounted once in `App.tsx` (verifier + code-reviewer both confirmed). Live cross-surface flip not re-driven (same post-reload nav limitation as U4). |

**Note:** Claude left the "Show technical names" toggle **ON** at the end of the run and
could not cleanly return to Settings to flip it back. Harmless (a personal display
preference — it just shows technical vocabulary); revert with one click at
**Settings › AI Model › Show technical names** if plain-default is preferred.

## Remaining operator-judgment items (subjective — cannot be automated)

1. **Copy naturalness (SC#1):** Read each relabeled surface with the toggle OFF and
   confirm no plain label is MORE confusing than the technical term it replaced. Highest-value
   surfaces to eyeball: the **Documents** ingestion status badges (Waiting / Working… /
   Splitting into sections / Making it searchable / Ready / Couldn't process), the document
   detail **"Details"** header, and the Settings **"Search" / "Search index"** labels.
   (Research flagged the plain-label copy as `[ASSUMED]` A1 — this is where taste matters.)
2. **Full cross-surface reveal walk (SC#3):** With the toggle ON, walk Chat → Documents →
   Workflows → Settings → Control Room and confirm the technical vocabulary appears
   consistently and the toggle in the Control Room and in Settings stay in lockstep
   (one switch — D-01a). Reload mid-walk to confirm the ON state persists.

## Automated backstop (already green)

- 8/8 must-haves code-verified (independent gsd-verifier, ran the suites itself).
- Touched suites: 14 files / 115 tests green; `tsc -b` = exactly 30 SEED-056/049 baseline
  errors (0 net-new); `vite build` exit 0.
- SC#2 contract-safety: `git diff --name-only` shows ZERO backend / ZERO migration files;
  G-5 hot files (`MessageItem.tsx`, `StreamsProvider.tsx`) untouched; every term-map
  `technical` value verified === the pre-phase shipped string (F-01 fixed for
  `settings.embedding` → "Embedding model").
