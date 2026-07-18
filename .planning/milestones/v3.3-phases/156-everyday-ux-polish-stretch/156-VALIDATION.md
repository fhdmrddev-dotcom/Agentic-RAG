---
phase: 156
slug: everyday-ux-polish-stretch
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-16
---

# Phase 156 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Source: `156-RESEARCH.md` § Validation Architecture (HIGH confidence, in-repo verified).
> **⌘K palette decision:** hand-rolled on the existing `ui/dialog.tsx` (Radix Dialog) —
> no `cmdk` dependency (avoids the unattended-run-blocking `checkpoint:human-verify`).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `4.1.0` + `@testing-library/react` `16.3.2` + `@testing-library/user-event` `14.6.1` + `vitest-axe` `0.1.0` (jsdom) |
| **Config file** | `frontend/vitest.config.ts` (jsdom, `setupFiles: ./src/setupTests.ts`, `@`→`./src`) |
| **Quick run command** | `cd frontend && npx vitest run <single-new-file>` |
| **Full suite command** | `cd frontend && npm run test` (`vitest run`) |
| **Build check** | `cd frontend && npm run build` (`tsc -b && vite build`) + `npm run lint:a11y` (Phase-155 CI gate) |
| **Estimated runtime** | ~60–120s full suite |

---

## Sampling Rate

- **After every task commit:** Run the single relevant new test file (`npx vitest run <file>`).
- **After every plan wave:** Run `npm run test` (full vitest) + `npm run build` (tsc + vite) + `npm run lint:a11y`.
- **Before `/gsd:verify-work`:** Full suite green **+ live Chrome-MCP lived-experience UAT** (jsdom cannot prove "the rail stops starving history").
- **Max feedback latency:** ~120 seconds.

---

## Per-Task Verification Map

| Req / SC | Behavior | Test Type | Automated Command | File Exists |
|----------|----------|-----------|-------------------|-------------|
| SC#1 (New Chat reachable) | Rail/history renders a New-Chat button with an accessible name, reachable on every `activeView` | unit/RTL | `npx vitest run src/components/layout/__tests__/*` | ❌ W0 |
| SC#2 (inline search) | Typing the filter narrows rows to title-substring matches, highlights match (JSX text — no `innerHTML`), folds empty groups, honest empty-state | unit + RTL | `npx vitest run src/components/layout/__tests__/ChatHistoryColumn.test.tsx` | ❌ W0 |
| SC#2 (⌘K palette) | `⌘K` opens the Dialog-based palette; typing filters; `↑↓` roving; `↵`→`selectThread`+navigate; `Esc` closes + restores focus | RTL (`user.keyboard("{Meta>}k{/Meta}")`) | `npx vitest run src/components/layout/__tests__/ThreadCommandPalette.test.tsx` | ❌ W0 |
| SC#3 (date grouping) | `bucketFor`/`groupByDate` — Today/Yesterday/≤7/≤30/Older boundaries, empty-bucket fold, within-bucket DESC | unit | `npx vitest run src/lib/__tests__/threadGroups.test.ts` | ❌ W0 |
| A11Y-01 (do-no-harm) | No axe AA violations across populated/empty/filtered; moved rows keep real `<button>` + focus-within reveal; palette exposes dialog + listbox/option roles | a11y (vitest-axe) | `npx vitest run src/components/layout/__tests__/ChatHistoryColumn.a11y.test.tsx` | ❌ W0 |
| D-07 lock (regression) | `NAV_ITEMS` carries no control-room entry (operator shield stays outside the array) | unit (exists) | `npx vitest run src/lib/nav-items.test.ts` | ✅ must stay green |
| D-09 (behavior preserve) | `ChatLayoutLaunch.test.tsx` still green after the composition change | integration (exists) | `npx vitest run src/components/layout/__tests__/ChatLayoutLaunch.test.tsx` | ✅ re-run |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `frontend/src/lib/threadGroups.ts` + `frontend/src/lib/__tests__/threadGroups.test.ts` — SC#3 date bucketing + the SHARED title-filter predicate (reused by the column, the ⌘K palette, and the mobile drawer).
- [ ] `frontend/src/components/layout/__tests__/ChatHistoryColumn.test.tsx` — SC#2 inline filter / highlight / empty-state + D-09 preserved row behaviors (rename, delete-confirm, SEED-064 dot/Stop, options menu).
- [ ] `frontend/src/components/layout/__tests__/ChatHistoryColumn.a11y.test.tsx` — vitest-axe (A11Y-01 do-no-harm).
- [ ] `frontend/src/components/layout/__tests__/ThreadCommandPalette.test.tsx` — ⌘K open / filter / roving-select / Esc + a11y roles.
- [ ] Framework install: **none** — vitest/RTL/vitest-axe already present. No `cmdk` install (hand-rolled palette).

---

## Manual-Only Verifications (G-4 live Chrome-MCP — jsdom CANNOT cover)

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rail stops starving history (BUG-260711-01) | SC#1 | jsdom has no layout | With 20+ threads the history column shows many rows at rest; visit Documents/Settings/Workflows and back — the rail never hides New Chat; a hypothetical 9th nav icon doesn't shrink visible-row count |
| ⌘K from a non-chat view | SC#2 | keyboard + portal + focus | Press `⌘K` on Documents → palette opens over the whole backlog; `↑↓` moves, `↵` opens the thread and lands on chat; `Esc` closes + restores focus |
| Date groups render | SC#3 | visual grouping | Rows grouped Today/Yesterday/Last 7/Last 30/Older with counts; empty buckets absent |
| Preserved row behaviors | D-09 | felt interaction | Select, inline rename (Enter/Esc), delete-confirm, SEED-064 running dot + Stop + ActiveRunsTray, options menu all work; keyboard-Tab reaches Stop/Rename/Delete on a focused row |
| On-system feel + no overflow | POLISH-01 | contrast/scroll/themes | Deep Midnight tokens, same active/hover/`focus-visible` ring, both themes; mobile drawer shows the new search box; no horizontal overflow at ~800px with the workspace panel open |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
