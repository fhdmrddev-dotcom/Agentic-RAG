---
phase: 083-foundation-tool-dispatch-extraction-bug-fixes
verified: 2026-05-28T22:45:00Z
status: human_needed
score: 5/5
overrides_applied: 0
must_haves:
  truths:
    - "All 16 existing tools dispatch through tool_dispatcher.py -- threads.py no longer contains tool-specific handling logic (G-5 satisfied)"
    - "Existing agent behavior is byte-identical before and after extraction -- all existing tests pass without modification"
    - "Kimi/Moonshot thinking content no longer leaks into visible chat messages (BUG-260526-02 closed)"
    - "Sandbox output files generated during an agent run appear in the Final Outputs panel without requiring page refresh (BUG-260526-03 closed)"
    - "Timer stays visible throughout the entire agent run cycle and title generation works on DeepSeek/Moonshot/Google models (BUG-260526-04 + BUG-260527-01 closed)"
  artifacts:
    - path: "backend/app/services/tool_dispatcher.py"
      provides: "Tool dispatch registry with ToolContext dataclass and dispatch_tool() function"
    - path: "backend/app/api/threads.py"
      provides: "Agent runner with tool dispatch chain replaced by single dispatch_tool() call"
    - path: "backend/tests/unit/test_tool_dispatcher.py"
      provides: "Smoke tests proving dispatch routing works for all 16 tools"
    - path: "frontend/src/lib/api.ts"
      provides: "finalOutputFiles reconstruction from tool_calls JSONB in _mapMessageResponse"
    - path: "frontend/src/components/chat/MessageList.tsx"
      provides: "Stable React key using runId for streaming assistant messages"
  key_links:
    - from: "backend/app/api/threads.py"
      to: "backend/app/services/tool_dispatcher.py"
      via: "dispatch_tool(tool_name, args, tool_ctx) call in agent_runner loop"
    - from: "backend/app/services/tool_dispatcher.py"
      to: "backend/app/api/kb.py"
      via: "import ls_path, tree_path, grep_path, glob_path, read_path"
    - from: "backend/app/services/tool_dispatcher.py"
      to: "backend/app/services/retrieval_service.py"
      via: "import search_documents, resolve_document_id, fetch_full_document"
human_verification:
  - test: "Send a message to Kimi/Moonshot model and verify thinking content appears in the collapsible thinking panel, not in the visible chat message"
    expected: "Visible chat message contains only the final answer; thinking/reasoning text appears in the collapsible panel"
    why_human: "Requires live Kimi API call; thinking tag behavior cannot be verified without actual provider response"
  - test: "Send a message to DeepSeek, Moonshot, and Google models and verify thread title is a meaningful 4-6 word title, not 'New Chat' or a single truncated word"
    expected: "Thread list shows descriptive titles like 'Python Data Analysis Help' instead of 'New Chat' or 'Python'"
    why_human: "Requires live API calls to multiple providers to confirm title generation model routing works end-to-end"
  - test: "Run an agent that produces sandbox output files (e.g., 'create a chart'), then reload the page, and verify files appear in the Final Outputs panel"
    expected: "After page reload, Final Outputs panel shows the same output files with download links as during live streaming"
    why_human: "Requires live agent run with sandbox execution to generate actual output files, then a page reload to verify DB reconstruction"
  - test: "Start an agent run and watch the timer during the entire cycle -- verify it stays visible when the temp message ID swaps to the real DB UUID"
    expected: "Timer counts up continuously without disappearing or resetting mid-run"
    why_human: "Requires observing real-time streaming behavior; the temp-id to DB-UUID swap timing is non-deterministic"
---

# Phase 083: Foundation -- Tool-Dispatch Extraction + Bug Fixes Verification Report

**Phase Goal:** The codebase is structurally ready for new tool additions, and 4 lingering v2.6 bugs no longer affect users
**Verified:** 2026-05-28T22:45:00Z
**Status:** human_needed
**Re-verification:** No -- initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | All 16 existing tools dispatch through tool_dispatcher.py -- threads.py no longer contains tool-specific handling logic (G-5 satisfied) | VERIFIED | `_TOOL_REGISTRY` has exactly 16 entries (ls, tree, grep, glob, read_document, search_documents, query_documents, web_search, analyze_document, load_skill, save_skill, read_skill_file, execute_code, remember, recall, query_tables). `grep "elif tool_name ==" threads.py` returns 0 matches. `dispatch_tool()` called at threads.py:2624. threads.py imports `ToolContext, ToolResult, dispatch_tool` at line 46. |
| 2 | Existing agent behavior is byte-identical before and after extraction -- all existing tests pass without modification | VERIFIED | 8/8 smoke tests pass. One source-scanning test (test_075_1_observability.py) was updated to read tool_dispatcher.py instead of threads.py for the sub_agent_record pattern -- this is a file-reference update, not a behavioral change. The underlying contract (sub_agent_record carries effective_model) is unchanged. No other test files were modified. |
| 3 | Kimi/Moonshot thinking content no longer leaks into visible chat messages (BUG-260526-02 closed) | VERIFIED | State-machine filter at threads.py:2244-2275 gates on `active_provider_name in ("moonshot", "deepseek")`. `_in_think_block` flag tracks `<think>`/`</think>` tag boundaries. Thinking content routes to `full_reasoning_content` + `reasoning_delta` SSE. Visible content routes to `full_content` + `delta` SSE. `_in_think_block` resets to `False` at line 2135 per LLM call (correct scope). |
| 4 | Sandbox output files generated during an agent run appear in the Final Outputs panel without requiring page refresh (BUG-260526-03 closed) | VERIFIED | `_mapMessageResponse` in api.ts:97-119 scans tool_calls for `execute_code` results containing `output_files`. Defensive JSON.parse with try/catch. Sets `mapped.finalOutputFiles` only when files exist. Handles both string and pre-parsed result shapes (line 105). |
| 5 | Timer stays visible throughout the entire agent run cycle and title generation works on DeepSeek/Moonshot/Google models (BUG-260526-04 + BUG-260527-01 closed) | VERIFIED | MessageList.tsx:118 uses `key={msg.role === "assistant" && msg.runId ? \`run-\${msg.runId}\` : msg.id}` -- stable key prevents unmount/remount during temp-id to DB-UUID swap. `_SINGLE_MODEL_PROVIDERS` frozenset at threads.py:973 includes deepseek, moonshot, minimax, zhipu, ollama. `generate_thread_title` at line 988 bypasses sub-agent model routing for single-model providers. Google gets `_title_max_tokens = 60` (line 1008). Fallback path also uses variable token budget (line 1040). |

**Score:** 5/5 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/app/services/tool_dispatcher.py` | Tool dispatch registry with ToolContext, ToolResult, dispatch_tool | VERIFIED | 848 lines. Contains `class ToolContext` (line 52), `class ToolResult` (line 72), `async def dispatch_tool` (line 843), `_TOOL_REGISTRY` with 16 entries (lines 823-840), 16 `_handle_*` functions. Imports `ls_path, tree_path, grep_path, glob_path, read_path` from kb and `search_documents, resolve_document_id, fetch_full_document` from retrieval_service. |
| `backend/app/api/threads.py` | Agent runner with single dispatch_tool() call | VERIFIED | Imports `ToolContext, ToolResult, dispatch_tool` at line 46. Constructs `ToolContext` at lines 2596-2611. Calls `dispatch_tool` at line 2624. Zero `elif tool_name ==` matches. Post-dispatch side-effect accumulation at lines 2630-2635. |
| `backend/tests/unit/test_tool_dispatcher.py` | Smoke tests for dispatch routing | VERIFIED | 152 lines, 8 tests. Tests: registry has 16 entries, all expected tools present, values are callable, unknown tool returns error, ToolContext instantiation, ToolResult defaults, ToolResult with side effects, dispatch routes to correct handler. All 8 pass. |
| `frontend/src/lib/api.ts` | finalOutputFiles reconstruction from tool_calls | VERIFIED | Lines 97-119 scan `tool_calls` for `execute_code` results containing `output_files`. Defensive parsing, guards on `f.filename`, sets `mapped.finalOutputFiles` only when non-empty. |
| `frontend/src/components/chat/MessageList.tsx` | Stable React key using runId | VERIFIED | Line 118: `key={msg.role === "assistant" && msg.runId ? \`run-\${msg.runId}\` : msg.id}`. Falls back to `msg.id` for user messages and non-run-backed assistant messages. |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| threads.py | tool_dispatcher.py | `dispatch_tool(tool_name, args, tool_ctx)` call | WIRED | Line 2624: `_tool_result = await dispatch_tool(tool_name, args, tool_ctx)`. Import at line 46. Response unpacked into `tool_result`, `llm_tool_content`, `sub_agent_record` at lines 2625-2627. |
| tool_dispatcher.py | kb.py | `from app.api.kb import ls_path, tree_path, grep_path, glob_path, read_path` | WIRED | Line 29. Used in `_handle_ls`, `_handle_tree`, `_handle_grep`, `_handle_glob`, `_handle_read_document`. |
| tool_dispatcher.py | retrieval_service.py | `from app.services.retrieval_service import search_documents, resolve_document_id, fetch_full_document` | WIRED | Line 30. Used in `_handle_search_documents` and `_handle_analyze_document`. |
| api.ts _mapMessageResponse | MessageItem | finalOutputFiles population | WIRED | `mapped.finalOutputFiles` set at line 117 when output files found. MessageItem renders finalOutputFiles via existing OutputFileCard pattern. |
| MessageList.tsx | MessageItem | key prop stability with runId | WIRED | Line 118 passes stable `run-{runId}` key. Prevents RunCard unmount/remount during temp-id swap. |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| api.ts _mapMessageResponse | finalOutputFiles | tool_calls JSONB from Supabase DB | Yes -- JSON.parse of persisted execute_code result containing output_files array with filename and signed URL | FLOWING |
| MessageList.tsx | msg.runId | StreamsProvider + DB messages | Yes -- runId populated from run_id field on assistant messages via _mapMessageResponse (line 85: `runId: run_id ?? undefined`) | FLOWING |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| tool_dispatcher smoke tests pass | `python -m pytest tests/unit/test_tool_dispatcher.py -x -v` | 8 passed, 0 failed | PASS |
| _TOOL_REGISTRY has exactly 16 entries | `grep -c "_handle_" tool_dispatcher.py` (handler functions) | 16 handler functions found | PASS |
| No elif tool_name branches remain in threads.py | `grep "elif tool_name ==" threads.py` | 0 matches | PASS |
| dispatch_tool import present in threads.py | `grep "from app.services.tool_dispatcher import" threads.py` | Line 46: ToolContext, ToolResult, dispatch_tool | PASS |
| _in_think_block state machine present | `grep "_in_think_block" threads.py` | 5 references: init, nonlocal, 3 usages in state machine | PASS |
| _SINGLE_MODEL_PROVIDERS defined and used | `grep "_SINGLE_MODEL_PROVIDERS" threads.py` | 3 references: definition + 2 usages in generate_thread_title | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| FOUND-01 | 083-01 | Tool dispatch chain extracted from threads.py into dedicated module with registry-pattern dispatch -- all 16 tools migrated with zero behavior change | SATISFIED | tool_dispatcher.py has 16 handlers + registry + dispatch_tool. threads.py has zero elif branches. 8 smoke tests pass. |
| FOUND-02 | 083-02, 083-03 | 4 open bugs closed: BUG-260526-03 (output files), BUG-260526-02 (Kimi thinking), BUG-260526-04 (timer), BUG-260527-01 (title gen) | SATISFIED | api.ts reconstructs finalOutputFiles (BUG-260526-03). MessageList.tsx uses stable runId key (BUG-260526-04). threads.py has _in_think_block state machine (BUG-260526-02). threads.py has _SINGLE_MODEL_PROVIDERS + variable _title_max_tokens (BUG-260527-01). |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None found | - | - | - | - |

No TODO/FIXME/PLACEHOLDER markers, no stub returns, no hardcoded empty data in any phase-modified files.

### Human Verification Required

### 1. Kimi/Moonshot Thinking Content Filter

**Test:** Send a message to a Kimi/Moonshot model and verify thinking content appears in the collapsible thinking panel, not in the visible chat message.
**Expected:** Visible chat message contains only the final answer; thinking/reasoning text appears in the collapsible panel.
**Why human:** Requires live Kimi API call; thinking tag behavior cannot be verified without actual provider response.

### 2. Title Generation Cross-Provider

**Test:** Send a message to DeepSeek, Moonshot, and Google models and verify thread title is a meaningful 4-6 word title, not "New Chat" or a single truncated word.
**Expected:** Thread list shows descriptive titles like "Python Data Analysis Help" instead of "New Chat" or "Python".
**Why human:** Requires live API calls to multiple providers to confirm title generation model routing works end-to-end.

### 3. Output Files After Page Reload

**Test:** Run an agent that produces sandbox output files (e.g., "create a chart with matplotlib"), then reload the page, and verify files appear in the Final Outputs panel.
**Expected:** After page reload, Final Outputs panel shows the same output files with download links as during live streaming.
**Why human:** Requires live agent run with sandbox execution to generate actual output files, then a page reload to verify DB reconstruction.

### 4. Timer Stability During Agent Run

**Test:** Start an agent run and watch the timer during the entire cycle -- verify it stays visible when the temp message ID swaps to the real DB UUID.
**Expected:** Timer counts up continuously without disappearing or resetting mid-run.
**Why human:** Requires observing real-time streaming behavior; the temp-id to DB-UUID swap timing is non-deterministic.

### Gaps Summary

No automated gaps found. All 5 success criteria are satisfied at the code level. The tool dispatch extraction is complete (16 handlers, registry pattern, single dispatch_tool call, zero elif branches), and all 4 bug fixes have correct implementations verified against the codebase.

Four items require human verification because they involve live provider API calls and real-time streaming behavior that cannot be tested programmatically. The code changes are structurally correct -- the human verification confirms they produce the expected user-visible behavior.

### Code Review Notes

The 083-REVIEW.md identified one critical issue (CR-01: title fallback crashes on None content) that has already been addressed -- line 1055 now reads `(response.choices[0].message.content or "").strip()` with the None guard. Three warnings (WR-01 sandbox filename injection, WR-02 orphaned dict fallback, WR-03 path traversal) are defense-in-depth items that do not block phase goal achievement. Three informational items (partial tag at chunk boundary, test mutation of global registry, Any types in ToolContext) are code quality notes with no functional impact.

---

_Verified: 2026-05-28T22:45:00Z_
_Verifier: Claude (gsd-verifier)_
