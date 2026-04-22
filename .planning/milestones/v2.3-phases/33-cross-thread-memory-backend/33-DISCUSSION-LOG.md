# Phase 33: Cross-Thread Memory — Backend - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-16
**Phase:** 33-cross-thread-memory-backend
**Areas discussed:** Key semantics, Injection format, recall() behavior, Audit logging

---

## Pre-Discussion: Industry Context Question

**User asked:** Before proceeding with implementation decisions, user asked whether cross-thread memory is appropriate for a RAG app, and what industry standards look like.

**Claude's response:** Clarified the critical distinction:
- Memory = agent stores facts/preferences the user explicitly states (user-profile layer)
- RAG = retrieves from document library
- These are fully separate — memory does NOT RAG-search old chat threads

Industry standard cited: ChatGPT Memory (2024) — agent-triggered via `bio()`/`remember()` tool, shown in Settings, injected into system prompt. Also: Claude.ai Projects, Perplexity Pro. This pattern is widely accepted.

**User decision:** Confirmed understanding, comfortable with the feature scope.

---

## A. Key Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Upsert by key | Same key overwrites previous value; `updated_at` refreshed | ✓ |
| Accumulate | Multiple entries per key allowed; all stored | |

**User's choice:** Delegated to Claude ("you decide based on best fit")
**Claude's decision:** Upsert — prevents contradictory stale entries in the injection block; mirrors ChatGPT Memory behavior
**Notes:** Case-insensitive key normalization to prevent `"Language"` vs `"language"` duplicates

---

## B. Injection Format

| Option | Description | Selected |
|--------|-------------|----------|
| Structured block with header | `## User Memory` + key-value pairs, appended after SYSTEM_PROMPT | ✓ |
| Inline prose | Natural language summary of memories | |
| Separate message | Injected as a `system` message in the messages array | |

**User's choice:** Delegated to Claude
**Claude's decision:** Structured block using same append pattern as skill catalog (threads.py:463-484); header includes parenthetical to explain provenance to LLM
**Notes:** Omit block entirely if zero entries; top-10 by `updated_at DESC`

---

## C. recall() Behavior

| Option | Description | Selected |
|--------|-------------|----------|
| All entries when no arg | `recall()` → full list; `recall(key)` → specific entry | ✓ |
| Summary only | Always return a summary, never raw entries | |

**User's choice:** Delegated to Claude
**Claude's decision:** Full list on no-arg call; specific entry on key call; graceful "not found" string on missing key — no exceptions
**Notes:** `recall()` with no entries returns "No memories stored yet."

---

## D. Audit Logging

| Option | Description | Selected |
|--------|-------------|----------|
| Log both remember + recall | `memory.remember` and `memory.recall` action types | ✓ |
| Log remember only | Writes only; recall is read-only so skip | |
| No logging | Keep audit log for user-facing actions only | |

**User's choice:** Delegated to Claude
**Claude's decision:** Log both — consistent with existing pattern (skill.load, search.query, code.execute); memory is persistent user data, warrants audit trail
**Notes:** Metadata schema defined in CONTEXT.md D-15

---

## Claude's Discretion

- DB schema column names
- Exact RLS policy SQL
- Non-blocking implementation internals (fire-and-forget background task)
- Tool JSON schema descriptions

## Deferred Ideas

None surfaced during discussion.
