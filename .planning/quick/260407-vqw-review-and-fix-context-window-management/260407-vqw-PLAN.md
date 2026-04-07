---
phase: quick
plan: 260407-vqw
type: execute
wave: 1
depends_on: []
files_modified:
  - backend/app/services/context_window.py
  - backend/app/api/threads.py
  - backend/app/config.py
  - backend/tests/unit/test_context_window.py
autonomous: true
must_haves:
  truths:
    - "Long conversations with many tool calls no longer silently fail or stop returning results"
    - "System prompt is always preserved (never trimmed)"
    - "Recent messages are preserved; oldest non-system messages are trimmed first"
    - "Token estimation is fast and does not require external API calls"
  artifacts:
    - path: "backend/app/services/context_window.py"
      provides: "Token counting and message trimming logic"
      exports: ["estimate_tokens", "trim_messages_to_fit"]
    - path: "backend/tests/unit/test_context_window.py"
      provides: "Unit tests for token estimation and trimming"
  key_links:
    - from: "backend/app/api/threads.py"
      to: "backend/app/services/context_window.py"
      via: "trim_messages_to_fit called before each create_streaming_chat"
      pattern: "trim_messages_to_fit.*messages"
---

<objective>
Implement context window management for the chat agent loop to prevent silent failures
when conversation history grows too large for the LLM's context window.

Purpose: Long conversations with many tool calls accumulate messages (system + user + assistant
+ tool results) that can exceed the model's context limit, causing the LLM to either error
silently, return empty responses, or hit finish_reason="length" immediately. This is the
#1 cause of agent stoppage on complex tasks.

Output: A context_window service module with token estimation and sliding-window trimming,
integrated into the agent loop in threads.py.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@backend/app/api/threads.py (main agent loop — lines 310-915)
@backend/app/services/openai_service.py (create_streaming_chat, tool defs)
@backend/app/config.py (Settings class)
@backend/app/models/message.py (MessageCreate, MessageResponse)

Key findings from investigation:

1. **No token counting exists.** The `event_stream()` function (threads.py:310) loads ALL
   message history from DB, reconstructs it via `_reconstruct_history()`, prepends system
   prompt, and sends the entire array to `create_streaming_chat()` with zero size checks.

2. **Tool result capping is insufficient.** Lines 428-434 cap individual tool results
   (_CTX_LIMIT_DEFAULT=3000, _CTX_LIMIT_SUBAGENT=10000) but do NOT address the cumulative
   growth of the messages array across iterations and across conversation turns.

3. **The system prompt is large.** SYSTEM_PROMPT (lines 31-96) is ~2000 tokens by itself.
   With folder scope augmentation and skills catalog injection, it can reach 3000+ tokens.

4. **Each tool call generates 3 messages.** Per `_reconstruct_history` (line 228): assistant
   (with tool_calls), tool result, assistant text. A 12-iteration conversation turn with
   2 tool calls each = 72+ messages added to history per turn.

5. **The model context limit varies.** Users can configure any model via OpenRouter/OpenAI.
   Default is gpt-4o (128k tokens) but users might use smaller models.

Approach: Character-based token estimation (1 token ~ 4 chars for English, widely used
heuristic — no tiktoken dependency needed). Trim oldest non-system messages first, preserving
system prompt and the most recent N messages. Apply trimming before each `create_streaming_chat`
call, both for initial history and after tool call iterations.
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create context_window service with token estimation and trimming</name>
  <files>backend/app/services/context_window.py, backend/app/config.py, backend/tests/unit/test_context_window.py</files>
  <behavior>
    - estimate_tokens("hello world") returns ~3 (len/4 rounded up)
    - estimate_tokens on a messages list sums all content + tool_calls JSON
    - trim_messages_to_fit preserves system message (index 0) when trimming
    - trim_messages_to_fit preserves the last N messages (most recent context)
    - trim_messages_to_fit returns messages unchanged when under the token limit
    - trim_messages_to_fit removes oldest non-system messages first when over limit
    - trim_messages_to_fit never removes the system message even if it alone exceeds limit
    - trim_messages_to_fit handles tool_call sequences atomically: if an assistant message with tool_calls is removed, its corresponding tool result messages are also removed (orphaned tool results cause OpenAI API errors)
    - When messages are trimmed, a synthetic "[Earlier conversation trimmed]" user message is inserted after the system prompt to signal context loss to the LLM
  </behavior>
  <action>
    1. Add to backend/app/config.py Settings class:
       - `context_window_max_tokens: int = 100000` (safe default for gpt-4o 128k, leaves room for response)
       - `context_window_reserve_recent: int = 10` (minimum recent messages to always keep)

    2. Create backend/app/services/context_window.py with:

       `estimate_tokens(text: str) -> int`:
       - Return `max(1, len(text) // 4)` — standard chars/4 heuristic
       - Handle None input gracefully (return 0)

       `estimate_messages_tokens(messages: list[dict]) -> int`:
       - For each message, sum tokens from: role (~1 token), content, tool_calls
         (serialize to JSON string if present), function name/arguments in tool_calls
       - Add 4 tokens per message for OpenAI message overhead

       `trim_messages_to_fit(messages: list[dict], max_tokens: int, reserve_recent: int = 10) -> list[dict]`:
       - If estimate_messages_tokens(messages) <= max_tokens, return messages unchanged
       - Separate: system_msg = messages[0] if role=="system" else None
       - Protected tail = last `reserve_recent` messages (never trimmed)
       - Trimmable = messages between system and protected tail
       - Remove from the START of the trimmable section (oldest first)
       - When removing, handle tool_call atomicity: if removing an assistant message
         that has tool_calls, also remove all immediately following tool-role messages
         that reference those tool_call IDs. Conversely, if removing a tool message,
         also remove its parent assistant+tool_calls message and sibling tool messages.
       - After trimming, insert a marker message: {"role": "user", "content": "[Earlier conversation history was trimmed to fit context window. Some prior context may be missing.]"}
       - Return [system_msg, marker, ...remaining_trimmable, ...protected_tail]
       - Keep trimming until under max_tokens or only system + protected tail remain

    3. Create backend/tests/unit/test_context_window.py with tests for all behaviors listed above.
       Use plain pytest (no mocks needed — pure functions). Include:
       - test_estimate_tokens_basic
       - test_estimate_tokens_none
       - test_estimate_messages_tokens
       - test_trim_noop_when_under_limit
       - test_trim_removes_oldest_first
       - test_trim_preserves_system_message
       - test_trim_preserves_recent_messages
       - test_trim_atomic_tool_call_removal (assistant+tool_calls and their tool results removed together)
       - test_trim_inserts_marker_message
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/unit/test_context_window.py -v --tb=short 2>&1 | tail -30</automated>
  </verify>
  <done>
    - context_window.py exists with estimate_tokens, estimate_messages_tokens, trim_messages_to_fit
    - config.py has context_window_max_tokens and context_window_reserve_recent settings
    - All unit tests pass
  </done>
</task>

<task type="auto">
  <name>Task 2: Integrate context window trimming into the agent loop</name>
  <files>backend/app/api/threads.py</files>
  <action>
    1. At the top of threads.py, add import:
       `from app.services.context_window import trim_messages_to_fit, estimate_messages_tokens`

    2. In `event_stream()`, after the messages list is fully constructed (after line 411:
       `messages.extend(_reconstruct_history(history_resp.data))`), add trimming:

       ```python
       # Trim conversation history to fit context window
       messages = trim_messages_to_fit(
           messages,
           max_tokens=settings.context_window_max_tokens,
           reserve_recent=settings.context_window_reserve_recent,
       )
       ```

    3. Inside the tool call iteration loop, BEFORE `create_streaming_chat` is called
       (around line 440, inside the `for iteration in range(max_iterations):` loop),
       add trimming again to handle growth during multi-tool-call iterations:

       ```python
       # Re-trim after tool results have been appended (context grows each iteration)
       messages = trim_messages_to_fit(
           messages,
           max_tokens=settings.context_window_max_tokens,
           reserve_recent=settings.context_window_reserve_recent,
       )
       ```

    4. Add a debug log at the start of each iteration showing estimated token count:
       ```python
       logger.debug("Agent iteration %d: ~%d tokens in %d messages",
                     iteration, estimate_messages_tokens(messages), len(messages))
       ```

    5. Do NOT change the existing _CTX_LIMIT_DEFAULT / _CTX_LIMIT_SUBAGENT caps —
       they serve a complementary purpose (per-tool-result limits vs overall context limit).

    6. Do NOT change _reconstruct_history — it correctly rebuilds the message format.
       The trimming operates on the already-reconstructed messages list.
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" && python -m pytest tests/unit/test_context_window.py tests/integration/test_threads.py -v --tb=short 2>&1 | tail -40</automated>
  </verify>
  <done>
    - threads.py imports and calls trim_messages_to_fit before each create_streaming_chat call
    - Debug logging shows token estimates per iteration
    - Existing tests still pass (integration tests for threads)
    - The agent loop will now gracefully handle conversations that exceed context limits
      by trimming oldest history rather than failing silently
  </done>
</task>

</tasks>

<verification>
1. Unit tests for context_window.py all pass
2. Existing thread integration tests still pass (no regression)
3. Manual verification: start a chat, send many messages with tool calls, observe that
   the agent continues to respond even after 20+ exchanges (previously would stop)
4. Check server logs for "Agent iteration N: ~X tokens in Y messages" debug output
</verification>

<success_criteria>
- Long conversations (20+ turns with tool calls) no longer cause silent agent failure
- System prompt is always preserved in the messages array
- Token estimation runs in <1ms (no external API calls, no tiktoken dependency)
- Context window limit is configurable via CONTEXT_WINDOW_MAX_TOKENS env var
- Existing behavior for short conversations is completely unchanged (trim is a no-op)
</success_criteria>

<output>
After completion, create `.planning/quick/260407-vqw-review-and-fix-context-window-management/260407-vqw-SUMMARY.md`
</output>
