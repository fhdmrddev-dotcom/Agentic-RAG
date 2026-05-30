# Phase 083: Foundation — Tool-Dispatch Extraction + Bug Fixes - Context

**Gathered:** 2026-05-28
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract the ~800 LOC tool-dispatch chain from `threads.py` into a dedicated `tool_dispatcher.py` module (G-5 mandated refactor), and close 4 open v2.6 bugs (BUG-260526-02, BUG-260526-03, BUG-260526-04, BUG-260527-01). The codebase must be structurally ready for new tool additions in Phases 084-085 with zero regression in existing agent behavior.

</domain>

<decisions>
## Implementation Decisions

### Tool-Dispatch Extraction (FOUND-01)

- **D-01:** Extract the `elif tool_name ==` chain (threads.py:2555-3357) to `backend/app/services/tool_dispatcher.py`. Define a `ToolContext` dataclass carrying `redis`, `run_id`, `thread_id`, `supabase`, `pool`, `user_settings`, `current_user`, `folder_subtree_ids`, `scoped_folder_path`, `_emit` ref. The `agent_runner` calls `result = await dispatch_tool(tool_name, args, tool_ctx)` where `dispatch_tool` routes to per-tool handler functions.
- **D-02:** Agent_runner iteration loop, LLM streaming, context window management, and finalization logic stay in `threads.py`. Only the dispatch branch is extracted.
- **D-03:** All 16 existing tools must pass through the new dispatcher — `ls`, `tree`, `grep`, `glob`, `read_document`, `search_documents`, `query_documents`, `web_search`, `analyze_document`, `load_skill`, `save_skill`, `read_skill_file`, `execute_code`, `remember`, `recall`, `query_tables`.
- **D-04:** Extraction strategy per research ARCHITECTURE.md Section 8. The dispatcher is the extension point for Phase 084/085 new tools — `workspace_write`, `workspace_read`, `write_todos`, `task`, `ask_user` all register through the same pattern.

### Output Files After Reload (BUG-260526-03)

- **D-05:** Reconstruct `finalOutputFiles` client-side from `tool_calls` JSONB in `_mapMessageResponse` (`api.ts`). Scan tool_calls for `execute_code` results containing `output_files` arrays. Zero schema change, zero migration — the data already exists in the message row.

### Kimi Thinking Content Leak (BUG-260526-02)

- **D-06:** Provider-gated content gate in the chunk handler. When provider is Moonshot/Kimi, inspect chunks for thinking markers and strip thinking content from `full_content`, accumulating it into `reasoning_content` instead. Needs investigation of Kimi's exact response format (likely `<think>` tags or similar wrapper) during planning.

### Timer Disappearance Mid-Cycle (BUG-260526-04)

- **D-07:** Use `run_id` as the stable React key for assistant messages with active runs (`MessageList.tsx`). Instead of `key={msg.id}` (which changes when temp-id swaps to DB UUID), use `key={\`run-${msg.runId}\`}` for streaming assistant messages. Prevents React from unmounting/remounting the RunCard, preserving timer state, expanded state, and thinking block state.

### Title Generation Broken on DeepSeek/Moonshot/Google (BUG-260527-01)

- **D-08:** Single-model providers (DeepSeek, Moonshot, MiniMax, GLM) use the user's main model for title generation — no cost savings from routing to a "smaller" model since they're the same tier. Multi-model providers (OpenAI, Anthropic, Google, OpenRouter) keep current sub-agent model routing. Google's `max_tokens` investigated and bumped if truncation persists.

### Claude's Discretion

- Tool handler organization within `tool_dispatcher.py` (flat functions vs grouped by domain — KB tools, skill tools, etc.) is Claude's call based on what keeps the file maintainable
- Whether the `ToolContext` dataclass uses `dataclass`, `NamedTuple`, or `TypedDict` — pick what fits the codebase patterns
- Test strategy for the extraction: whether to verify via existing test suite only or add targeted dispatch tests

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Architecture & Extraction Strategy
- `.planning/research/ARCHITECTURE.md` §8 — threads.py god-file extraction strategy; `ToolContext` dataclass spec, `dispatch_tool()` routing, per-tool handler pattern
- `.planning/codebase/ARCHITECTURE.md` — System overview, component responsibilities, data flow diagrams

### Bug Reports (root causes & fix surfaces)
- `.planning/reported-bugs/final-output-files-not-persisted.md` — BUG-260526-03; fix surface: `api.ts:61-98` `_mapMessageResponse`
- `.planning/reported-bugs/kimi-thinking-leaks-into-content.md` — BUG-260526-02; fix surface: `threads.py:2210-2218` chunk handler
- `.planning/reported-bugs/timer-disappears-mid-cycle.md` — BUG-260526-04; fix surface: `MessageList.tsx:118` key prop, `RunCard.tsx:46-96`
- `.planning/reported-bugs/title-generation-broken-deepseek-moonshot-google.md` — BUG-260527-01; fix surface: `threads.py:975-1034` `generate_thread_title`

### Requirements
- `.planning/REQUIREMENTS.md` — FOUND-01 (tool dispatch extraction), FOUND-02 (4 bugs closed)
- `.planning/ROADMAP.md` Phase 083 section — success criteria, dependency map, research flag

### Hot-File Ledger (from CLAUDE.md)
- `backend/app/api/threads.py` — 9+ phases, G-5 fires; extraction is the G-5 resolution for this file

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/app/utils/db.py:aexec()` — async wrapper for sync supabase-py calls; tool handlers already use this
- `backend/app/services/sandbox_service.py` — `harvest_output_files` pattern for sandbox file management
- `frontend/src/lib/api.ts:_mapMessageResponse` — message mapping function where output file reconstruction will be added
- `frontend/src/components/chat/MessageList.tsx` — where `key` prop fix applies for timer stability

### Established Patterns
- Tool dispatch is currently a ~800 LOC `elif tool_name ==` chain in `threads.py:2555-3357`
- Each tool handler accesses `redis`, `run_id`, `thread_id`, `supabase`, `user_settings`, `current_user` from the enclosing `agent_runner` scope
- `_emit()` helper for SSE events is used by multiple tools (sandbox output files, tool results)
- Per-provider chunk handling at `threads.py:2210-2218` (content + reasoning_content separation)
- `_SUB_AGENT_MODEL_DEFAULTS` dict at `threads.py` for per-provider model routing

### Integration Points
- `agent_runner` at `threads.py:1059` — the extraction point; loop stays, dispatch moves out
- `frontend/src/providers/StreamsProvider.tsx` — callbacks where new SSE events would route (future phases)
- `frontend/src/stores/streamsStore.ts` — per-thread Map pattern from D-075.4-A1

</code_context>

<specifics>
## Specific Ideas

- The dispatcher must be designed as the extension point for Phases 084-085 (workspace tools, todos, task, ask_user) — adding a new tool should be adding a handler function and registering it, not modifying threads.py
- Output file reconstruction should scan the same `output_files` array structure that the SSE `final_output_files` event currently emits — same shape, different source (DB vs live SSE)
- Timer fix via `run_id` key avoids the complexity of state-lifting solutions; if run_id is not yet available on the message, fall back to `msg.id` (user messages, non-streaming assistant messages)

</specifics>

<deferred>
## Deferred Ideas

- **True resume from failure (continue mid-agent-loop):** Current Resume button re-sends the original prompt, starting the cycle over. True continuation would need persisted agent loop state (iteration count, accumulated tool results). This may be partially enabled by the `ask_user` pause/resume infrastructure in Phase 085.
- **anthropic-end-of-cycle-shows-actions-not-summary (deferred, major):** Anthropic shows tool action names instead of a synthesized summary as the final message. Touches system prompts + agent loop — deferred, not Phase 083 scope.
- **anthropic-excessive-tool-iterations (deferred, minor):** Anthropic runs 20+ iterations on multi-step tasks. System prompt tuning issue — deferred.

</deferred>

---

*Phase: 083-foundation-tool-dispatch-extraction-bug-fixes*
*Context gathered: 2026-05-28*
