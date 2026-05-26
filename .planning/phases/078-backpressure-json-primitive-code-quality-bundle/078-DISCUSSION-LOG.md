# Phase 078: Backpressure JSON Primitive + Code-Quality Bundle - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 078-backpressure-json-primitive-code-quality-bundle
**Areas discussed:** Context-window overrun, Duplicate upload behavior, Backpressure signal details

---

## Context-Window Overrun

| Option | Description | Selected |
|--------|-------------|----------|
| Progressive trim (Recommended) | Start trimming the oldest 'protected' messages too, working inward. The agent keeps working but loses some recent context. A trim-marker tells the LLM that history was cut. Matches how Claude.ai and ChatGPT handle long threads. | ✓ |
| Hard error | Raise ConversationTooLongError — the agent stops and the user sees 'This conversation is too long, please start a new thread.' Prevents any risk of the LLM seeing truncated context and hallucinating, but blocks the user. | |
| Progressive then error | Try progressive trim first, but if even the system prompt + last 2 messages don't fit, THEN raise the error. Belt-and-suspenders approach. | |

**User's choice:** Progressive trim (Recommended)
**Notes:** User selected the recommended approach. Matches the behavior of major AI chat products (Claude.ai, ChatGPT) — keep the agent working, silently drop oldest context, mark the cut with a trim marker.

---

## Duplicate Upload Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| Silent winner-takes-all (Recommended) | The first upload succeeds normally. The second upload's INSERT fails on the unique constraint — the backend catches the conflict, returns 409 with a message like 'File already exists in this folder', and the frontend shows a toast. | ✓ |
| Return existing document | The second upload detects the conflict and returns the existing document's ID with 200 (as if the upload succeeded). The user doesn't know a duplicate happened. | |
| You decide | Claude picks the approach that fits the existing upload error-handling pattern. | |

**User's choice:** Silent winner-takes-all (Recommended)
**Notes:** User chose the transparent approach — 409 error with clear messaging rather than hiding the duplicate.

---

## Backpressure Signal Details

| Option | Description | Selected |
|--------|-------------|----------|
| Looks good | Proceed with the 4-signal JSON shape, env-var auth gating, and fail-closed in production. Claude handles the implementation details. | |
| Add more signals | Discuss additional metrics beyond the 4 specified. | |
| Change auth approach | Different auth pattern than env-var user ID allow-list. | |

**User's choice:** (Free text) "you decide based on the benefit of this app later and according to future plans and competitive advantage of this app against others, we should leverage whatever available"
**Notes:** User delegated to Claude with strategic direction: design for future competitive advantage, make the endpoint enrichable. Decision: ship 4 SC-specified signals now, additive JSON shape, deferred additional signals (uptime, sandbox, memory, latency) to v3.1 dashboard phase. Auth escalation path mapped: env-var (v2.6) → RBAC (v3.1) → API key (v3.3).

---

## Claude's Discretion

- Migration 043 DDL syntax
- Test structure for lifespan, context window, backpressure integration tests
- Plan/wave ordering across the 5 items

## Deferred Ideas

- Additional backpressure signals (uptime, sandbox sessions, memory, latency percentiles) — v3.1
- RBAC auth for admin endpoints — v3.1
- ConversationTooLongError hard-error path — rejected, revisit only if users report confusion
