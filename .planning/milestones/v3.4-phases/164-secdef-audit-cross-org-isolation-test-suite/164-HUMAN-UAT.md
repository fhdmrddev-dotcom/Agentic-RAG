---
status: complete
phase: 164-secdef-audit-cross-org-isolation-test-suite
source: [164-VERIFICATION.md]
started: 2026-07-20T18:00:00Z
updated: 2026-07-20T22:15:00Z
---

## Current Test

[testing complete]

## Tests

### 1. SC#10 — 4-axis live cross-provider isolation UAT
expected: With migration 110 applied and the producer retrieval/text-to-SQL routed onto the asyncpg user-context, the agent still answers correctly across all 4 provider axes (OpenAI, Anthropic, Google, OpenRouter reps) with cross-org isolation intact and Deep Mode byte-identical.
- **Cross-provider:** ask a KB-grounded question that triggers `search_documents` on one representative model per provider — each returns cited results from YOUR org only; no empty-retrieval regression (the org predicate must resolve via the user-context, not return 0 rows).
- **Multi-tool:** one prompt exercising `search_documents` + `execute_code` (or `query_documents` text-to-SQL) — both run under the user-context; text-to-SQL returns only your rows.
- **Parallel-thread:** Thread A streaming while Thread B accepts a new prompt — no cross-thread/cross-org leak.
- **Long-message:** a ≥50-message or ≥5KB-prompt thread — retrieval + text-to-SQL still scoped correctly.
result: pass
note: |
  Operator confirmed live cross-provider. DB double-confirm (:54322, 2026-07-20):
  7 recent test threads (18:12-18:14) all single-org (22f9c615) — no cross-org bleed;
  multi-tool fired live (search_documents + query_documents text-to-SQL + ls + grep);
  every search_documents turn returned >=1 citation (5/5/5/13/5/5/5/8) — no
  empty-retrieval regression, so the producer→asyncpg user-context swap resolves
  auth.uid() and mig-110's org gate returns the caller's rows (not 0-for-everyone).

### 2. Frontend null-owner UI contract (minor)
expected: The backend now returns `user_id: null` for non-owner readers of global/system-shared folders/skills/views (SEED-091/TEN-06). Load the Folders + Skills lists as a NON-owner of a shared resource — owner-gated affordances (edit/delete/"yours" badges) stay hidden/inert; no crash, no "undefined owner" UI glitch. (`frontend/src/types/index.ts:451,495` still type `user_id` as required `string` — a null owner is inert for the `user_id === me.id` checks, but loosening those to `string | null` is a clean follow-up.)
result: pass
note: |
  Verified live via Chrome MCP (localhost:5173, logged in as fhdmrd@gmail.com),
  2026-07-20. Skills page rendered clean. The is_system skill-creator (owned by
  seed@system.local 00000000, NOT the test user → backend serializes user_id:null)
  shows a "Built-in" badge and — confirmed in the accessibility tree (ref_33) — only
  a "Try in Chat" button, NO Edit/Delete owner controls. Every owned skill card DOES
  show Edit/Delete. No crash, no "undefined owner" text. Owner-gated affordances
  correctly hidden on the non-owned/null-owner resource. (frontend TS string→string|null
  loosening remains a clean forward follow-up, inert today.)

## Summary

total: 2
passed: 2
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps
