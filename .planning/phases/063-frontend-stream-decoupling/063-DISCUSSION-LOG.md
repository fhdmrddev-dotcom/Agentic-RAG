---
phase: 063
date: 2026-05-03
mode: default (batched)
---

# Phase 063 Discussion Log

## Context

User invoked `/gsd:discuss-phase 063` after Phase 062 completion. Prior conversation established the user-visible problem (refresh kills stream UI even though Phase 061 producer survives) and that the permanent fix is Phase 063 (Frontend Stream Decoupling). User explicitly asked for a permanent solution and accepted "plan another phase" as the right path.

ROADMAP entry for Phase 063 was already richly specified — 7 success criteria, 4 explicit risk/pitfall notes. Most decisions were pre-committed in the ROADMAP. Only 4 implementation-detail gray areas required user input.

## Areas Discussed

### Area 1: POST endpoint migration strategy

**Question:** ROADMAP risk note says "don't keep two streaming code paths longer than one phase". How aggressive should the cutover be?

**Options presented:**
1. Hard cutover — rewrite POST to return `{message_id, run_id}`, delete legacy SSE-on-POST entirely (recommended)
2. Additive — add new endpoint, leave legacy alone, defer cleanup
3. Feature flag — runtime dispatch based on request flag

**User selected:** Option 1 (Hard cutover)

**Rationale:** Single-developer dev project, no external API consumers. Aligned with ROADMAP risk guidance. Cleanest possible architecture.

### Area 2: Local offset tracking for replay-and-tail

**Question:** Phase 062 tests showed `?since=0` returns 95 events in 152ms — full replay is fast. How should the frontend track offset?

**Options presented:**
1. Always `since=0` (simplest, recommended)
2. Persist last entry ID per run_id in localStorage
3. Persist offset in sessionStorage (tab-scoped)

**User selected:** Option 1 (Always `since=0`)

**Rationale:** Implementation cost of persistence not justified by 152ms savings. Idempotent re-render. Uniform across all reattach triggers. Matches ChatGPT/Claude.ai recovery semantics.

### Area 3: Stop button semantics

**Question:** With run-backed streaming the request is detached, so client AbortController doesn't cancel the producer. What should Stop do?

**Options presented:**
1. Server-only: Stop calls `DELETE /runs/{rid}` (recommended — aligned with SC#5)
2. Defensive double-abort: client AbortController.abort() AND server DELETE

**User selected:** Option 1 (Server-only)

**Rationale:** Single source of truth (server). Cross-tab Stop works automatically via terminal sentinel propagation. Matches Claude.ai/ChatGPT semantics. The client SSE subscription closes naturally when terminal arrives.

### Area 4: Resume button trigger

**Question:** SC#7 says active-runs returns a `failed` run — what should the frontend show?

**Options presented:**
1. Resume button on failed message; clicking re-POSTs original user message (recommended; D-v2.5-05 alignment)
2. Show error inline + Resume + Retry buttons (more affordances)
3. Auto-retry once silently; show error+Resume on second failure

**User selected:** Option 1 (Resume button only, no auto-retry)

**Rationale:** D-v2.5-05 explicit-intent principle: never auto-retry LLM calls (costs money). User stays in control of paid retries.

## Decisions Captured

- **D-063-01:** Hard cutover — POST returns `{message_id, run_id}` synchronously; delete legacy SSE-on-POST code path (event_consumer + EventSourceResponse return at threads.py:331-426 + 2241-2244)
- **D-063-02:** Always `?since=0` for reattach — no client-side offset persistence
- **D-063-03:** Stop = `DELETE /runs/{rid}` server-only — terminal sentinel propagates to all consumers including other tabs
- **D-063-04:** Resume button on failed runs only — re-POSTs original user message; no auto-retry

## Claude's Discretion (recorded for transparency)

These were not put to user vote but documented for downstream agents:

- **Reconciliation hook ordering:** active-runs query fires in parallel with loadMessages on mount; on `visibilitychange`/`focus`/`pageshow` only active-runs runs. Per ROADMAP risk note explicit guidance.
- **bfcache:** Hook to `pageshow` with `event.persisted === true` always re-reconciles. Per ROADMAP risk note explicit guidance.
- **Multi-tab sync:** Falls out automatically from Phase 062 fan-out. No frontend dedupe code needed.
- **Test rewrite:** Backend integration tests that exercise the legacy POST-streaming SSE path (test_058, test_059, test_061 patterns) get rewritten or deleted as part of execution. Cannot keep them — they exercise removed code.

## Deferred Ideas

None surfaced.

## Scope Creep Redirected

None. The user stayed focused on the permanent fix scope.
