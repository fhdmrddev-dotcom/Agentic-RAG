---
status: passed
phase: 154-plain-language-layer
source: [154-VERIFICATION.md]
started: 2026-07-15
updated: 2026-07-15
---

## Current Test

Live cross-surface reveal + persistence + one-switch — COMPLETED (Claude-driven, operator-requested). Copy-naturalness = operator taste (Claude's read: plain labels are clear; see notes).

## Context

Phase 154 verification returned `human_needed` (8/8 must-haves code-verified). Per the
148–153 convention, LANG-01 closes at verify + live UAT. This file records the live UAT
Claude ran unattended (Chrome MCP, operator session already authenticated) plus the
operator-judgment items that remain.

## Live UAT run by Claude (2026-07-15, Chrome MCP, operator-requested — screenshot path recovered on a fresh tab; coordinate-driven)

| # | Criterion | Result | Evidence (all observed live in-browser) |
|---|-----------|--------|----------|
| U1 | SC#1 — plain labels by default | ✅ PASS | With the reveal OFF: Settings tab **"Search"**; Settings › Search embedding picker **"Search index"** (helper "Turns your documents into search vectors…"); composer mode **"General"**; Documents statuses all **"Ready"**; document detail header **"DETAILS"**; Control Room cards plain ("The agent can search the live web", "…save new skills for later"). No jargon leaked. |
| U2 | SC#3 — reveal flips to technical, both directions | ✅ PASS (decisive) | Flip ON → tab **"Search"→"Search & Retrieval"**, embedding **"Search index"→"Embedding model"**, Control Room revealed raw field names (`redis_active_runs`, `postgres_pool_in_use`, `web_search_enabled`, `secrets_encryption.state`, …). Flip OFF → all reverted to plain. Both directions observed. |
| U3 | App-wide mount / no regression | ✅ PASS | Chat, Workflows, Documents, Settings, Control Room, document detail panel all render normally with `TechnicalNamesProvider` mounted app-wide — no white-screen, no provider-throw. ConfidenceChip values (HIGH · 0.99) untouched. |
| U4 | Persistence across reload + new tab | ✅ PASS | The ON state set in an earlier session survived a hard reload AND a brand-new tab (`localStorage["technical-names"]`) — on opening Settings in the fresh tab the tab already read "Search & Retrieval" before any interaction. |
| U5 | D-01a "one switch" (Settings ↔ Control Room shared context) | ✅ PASS (both directions) | Flipping the toggle in **Settings** turned the reveal ON in the **Control Room** (its own ⌥ toggle showed ON, raw field names visible) without touching the Control Room toggle. Then flipping OFF **from the Control Room** turned technical names OFF app-wide. One shared context, no drift, either home. |

**Courtesy:** Claude left the app in the **plain default** (toggle OFF) at the end of the run.

## Copy-naturalness read (SC#1 — ultimately operator taste)

Claude's observation from the live walk: the plain labels read clearly and are not more
confusing than the technical terms they replace — "Search", "Search index", "Ready",
"Details", "General", and the Control Room plain descriptions ("The agent can run code in a
sandbox", etc.) are all natural. **Operator sign-off on wording is still the final call** —
this is the one genuinely subjective item (research flagged the copy as `[ASSUMED]` A1).

**Minor observation (not a defect — bounded scope, D-04):** the Documents table **"Chunks"**
column header stays technical (not in the relabel set this phase). It's a cheap future
term-map addition, consistent with the documented "bounded set + term-map inherits" decision.

## Automated backstop (already green)

- 8/8 must-haves code-verified (independent gsd-verifier, ran the suites itself).
- Touched suites: 14 files / 115 tests green; `tsc -b` = exactly 30 SEED-056/049 baseline
  errors (0 net-new); `vite build` exit 0.
- SC#2 contract-safety: `git diff --name-only` shows ZERO backend / ZERO migration files;
  G-5 hot files (`MessageItem.tsx`, `StreamsProvider.tsx`) untouched; every term-map
  `technical` value verified === the pre-phase shipped string (F-01 fixed for
  `settings.embedding` → "Embedding model").
