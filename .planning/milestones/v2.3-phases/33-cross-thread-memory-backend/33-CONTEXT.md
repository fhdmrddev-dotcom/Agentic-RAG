# Phase 33: Cross-Thread Memory — Backend - Context

**Gathered:** 2026-04-16
**Status:** Ready for planning

<domain>
## Phase Boundary

Implement the backend for persistent cross-thread user memory. Three deliverables:
1. `user_memory` table in Supabase with RLS (INSERT/SELECT/UPDATE/DELETE by owner only)
2. `remember(key, value)` and `recall(key?)` tools wired into General Mode tool list only
3. Top-10 most-recently updated memory entries injected as a structured block in the system prompt at the start of each General Mode turn (~500 token cap); absent in Explorer Mode

**Important distinction:** This is a user-profile layer — the agent stores facts/preferences the user explicitly states. It does NOT RAG-search old chat threads or surface conversation content cross-thread. Memory and RAG remain fully separate.

</domain>

<decisions>
## Implementation Decisions

### A. Key Semantics
- **D-01:** `remember(key, value)` performs an **upsert by key** — if the key already exists for this user, update the value and refresh `updated_at`; otherwise insert a new row.
- **D-02:** Key matching is **case-insensitive** (normalize to lowercase on write and read) to prevent `"Language"` / `"language"` duplicates.
- **D-03:** All entries are stored in the DB. Top-10 by `updated_at DESC` are selected at injection time — no hard DB cap.
- **D-04:** There is no automatic expiry or max-entry limit at the DB level; capacity management is delegated to Phase 34 (Settings UI with delete).

### B. Memory Injection Format
- **D-05:** Memory block is injected **after the main SYSTEM_PROMPT body and after the skill catalog block**, using the same string-append pattern already in threads.py (lines 463-484). It is the last appended block before `messages` is composed.
- **D-06:** Format:
  ```
  ## User Memory
  (Preferences and facts you've remembered about this user across conversations)
  - {key}: {value}
  - {key}: {value}
  ```
- **D-07:** If the user has zero memory entries, the block is omitted entirely — no empty header injected.
- **D-08:** Token cap: top-10 entries by `updated_at`. At ~50 tokens per entry max, this stays well under 500 tokens.

### C. recall() Behavior
- **D-09:** `recall()` with no argument returns all stored memory entries for the user as a formatted list.
- **D-10:** `recall(key="x")` returns the value for that specific key.
- **D-11:** Key not found → return graceful string `"No memory entry found for key: x"`. No exception raised, no silent null — the LLM should know the lookup failed.
- **D-12:** `recall()` with no entries → return `"No memories stored yet."`.

### D. Audit Logging
- **D-13:** Both `remember` and `recall` are logged via `write_audit_entry` — consistent with `skill.load`, `search.query`, `code.execute` already in place.
- **D-14:** Action types: `memory.remember` and `memory.recall`.
- **D-15:** Metadata schema:
  - `memory.remember`: `{"key": key, "value": value, "action": "upsert"}`
  - `memory.recall`: `{"key": key}` or `{"key": null}` when recalling all

### E. Non-Blocking Writes
- **D-16:** Memory writes (`remember`) must not delay the chat response. Use a fire-and-forget background task (same non-blocking pattern as suggestion_service.py). The tool result is returned to the LLM immediately with a success acknowledgement while the DB write happens asynchronously.
- **D-17:** If the background write fails, it fails silently — no error surfaced to the user. The tool result already returned "remembered" so the LLM won't re-ask.

### Claude's Discretion
- DB schema column names (suggested: `id`, `user_id`, `key`, `value`, `created_at`, `updated_at`)
- Exact RLS policy SQL
- Error handling internals
- Tool JSON schema descriptions (follow existing tool style in openai_service.py)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### System Prompt & Tool Registry
- `backend/app/api/threads.py` §57-90 — SYSTEM_PROMPT definition and skill catalog injection pattern (lines 463-484); memory injection follows same append pattern
- `backend/app/services/openai_service.py` §408-420 — `get_tools()` and `get_explorer_tools()`; add `remember`/`recall` to General Mode only

### Non-Blocking Pattern Reference
- `backend/app/services/suggestion_service.py` — fire-and-forget async pattern to replicate for memory writes

### Audit Logging Pattern
- `backend/app/services/audit_service.py` — `write_audit_entry` signature and usage
- `backend/app/api/threads.py` — search for `action_type=` to see existing audit call sites (skill.load, code.execute, search.query)

### Requirements
- `.planning/REQUIREMENTS.md` §MEM-01, MEM-03 — acceptance criteria this phase must satisfy

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `write_audit_entry` (audit_service.py): drop-in for memory.remember / memory.recall audit calls
- Skill catalog injection block (threads.py:463-484): template for memory injection — same string-append pattern, same General-Mode-only gate
- `get_tools()` / `get_explorer_tools()` (openai_service.py): add remember/recall to General list only; Explorer list unchanged
- Non-blocking task pattern (suggestion_service.py): reference for fire-and-forget DB write

### Established Patterns
- Tool definitions: JSON schema objects in openai_service.py alongside existing tools (ls, grep, web_search, etc.)
- RLS: every user-scoped table uses `auth.uid() = user_id` policies — same for user_memory
- Mode gating: General Mode = `active_system_prompt = SYSTEM_PROMPT`; Explorer = `EXPLORER_SYSTEM_PROMPT`. Memory injection only in the General branch.

### Integration Points
- New `user_memory` Supabase table (migration needed)
- `get_tools()` in openai_service.py — add remember/recall tool schemas
- threads.py General Mode branch — add memory fetch + injection after skill catalog block
- threads.py tool dispatch loop — handle `tool_name == "remember"` and `tool_name == "recall"`

</code_context>

<specifics>
## Specific Ideas

- Industry reference: ChatGPT Memory (2024) is the closest production analogue — agent-triggered, user-reviewable, system-prompt-injected. Phase 33 mirrors this pattern intentionally.
- The `## User Memory` header with a parenthetical description ensures the LLM understands the provenance of these entries (user-stated facts, not document content).

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 33-cross-thread-memory-backend*
*Context gathered: 2026-04-16*
