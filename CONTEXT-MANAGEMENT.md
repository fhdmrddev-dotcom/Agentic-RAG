# Agent Context Management — Approaches & Trade-offs

This document tracks the context management strategy for the agentic chat loop (`backend/app/api/threads.py`)
and captures approaches for future improvement.

---

## Current Architecture

Every LLM call in `send_message` sends:

```
[system prompt]           ~1,500–2,500 tokens (fixed per turn)
[full DB history]         all prior turns, grows indefinitely
[this turn's tool calls]  each tool_use + tool_result pair
```

The loop runs up to `max_iterations = 12` (general) / `8` (explorer) before forcing a text-only wrap-up.

---

## Implemented: Option B — Tool Result Truncation (in messages array)

**Where:** `threads.py`, after each tool result, before appending to `messages[]`

**What it does:** Caps the tool result that gets sent in the LLM's context window:
- Most tools: 3,000 chars (`_CTX_LIMIT_DEFAULT`)
- `analyze_document`: 6,000 chars (`_CTX_LIMIT_SUBAGENT`) — richer synthesis output

The full result is still emitted via SSE to the frontend and persisted to the DB.
Only the LLM's view of past results is compressed.

**Why this matters:** `analyze_document` used to inject 4,000–8,000 tokens of sub-agent output
into every subsequent LLM call in the same turn. With 12 iterations, that means the 12th call
carries ~96k tokens just from prior sub-agent results if uncapped.

**Cost estimate (claude-sonnet-4-6 ~$3/M input):**
- Before: complex task (4 tool calls, 1 analyze_document) ≈ 35k–50k tokens across iterations → ~$0.15
- After: same task ≈ 15k–20k tokens → ~$0.06

---

## Option A — Sliding Window with Summarization (not implemented)

**How it works:**
Before each LLM call, count tokens in `messages[]`. If over a threshold (e.g. 60k):
1. Extract all messages from the beginning up to the last N turns
2. Call the LLM once with a summarization prompt: *"Summarize this conversation in under 800 words, preserving all decisions made, tool results found, and the user's goal."*
3. Replace the old messages with `{"role": "system", "content": "## Prior context (summarized):\n{summary}"}` + the last N turns
4. Continue

**Pros:**
- Keeps every call under a predictable token budget regardless of thread length
- Works well for long multi-session conversations
- Preserves key decisions without full verbatim history

**Cons:**
- Adds a non-streaming LLM call (latency spike) when the threshold is hit
- Summarization can lose detail (file names, exact numbers, code snippets)
- Needs a separate token counting step (rough heuristic: `len(str(messages)) / 4`)

**Where to add:** In `send_message` before the iteration loop:
```python
if _estimate_tokens(messages) > TOKEN_SUMMARIZE_THRESHOLD:
    messages = await _summarize_history(messages, client, model)
```

---

## Option C — Per-Call Token Budget Enforcement (not implemented)

**How it works:**
Before each LLM call, estimate token count. If over a hard limit, remove the oldest
non-system tool-use/tool-result pairs until under budget.

```python
while _estimate_tokens(messages) > MAX_TOKENS_PER_CALL:
    # Find and remove oldest tool_use + its tool_result pair
    _drop_oldest_tool_pair(messages)
```

**Pros:** Simple, predictable, no extra LLM calls
**Cons:** Silently removes context — LLM may reference tools it "used" but no longer sees

**Best for:** Emergency cost cap / hard context limit enforcement as a safety net

---

## Option D — Parallel Research + Focused Execution (not implemented)

**How it works:**
For tasks like "analyze document + create PPT":
1. Spawn a research sub-agent (separate context window) that reads/analyzes
2. Sub-agent returns a compact summary (< 1,500 tokens)
3. Main loop receives only the summary, then runs code generation
4. Main loop never sees the raw document text

This is already done for `analyze_document` (the `run_sub_agent` function), but the sub-agent
output still gets injected into the main messages array in full.

The missing piece: cap the sub-agent output at the summary level before injecting it.
Currently done via `_CTX_LIMIT_SUBAGENT = 6000` (Option B above), but a purpose-built
compact-summary instruction in `run_sub_agent` would be more precise.

**Best for:** Long-document analysis + code generation workflows

---

## Option E — Thread Forking / Conversation Branches (future)

For very long agentic runs, split the conversation into segments. Each segment gets a
fresh context window with a handoff summary from the previous segment. The user sees one
continuous thread; the backend manages segments transparently.

Requires: DB schema change (segment FK on messages), segment boundary detection logic.

---

## Token Estimation Helper (for future use)

```python
def _estimate_tokens(messages: list[dict]) -> int:
    """Rough token estimate: 1 token ≈ 4 chars. Accurate to ±20%."""
    return sum(len(str(m.get("content") or "")) + len(str(m.get("tool_calls") or "")) for m in messages) // 4
```

---

## Current Limits Reference

| Setting | Value | File |
|---------|-------|------|
| `max_iterations` (general) | 12 | `threads.py` |
| `max_iterations` (explorer) | 8 | `threads.py` |
| Tool result in DB | 2,000 chars (most tools) | `threads.py` |
| Tool result in DB (execute_code) | Full output_files + 800 stdout chars | `threads.py` |
| Tool result in LLM context (most) | 3,000 chars | `threads.py` `_CTX_LIMIT_DEFAULT` |
| Tool result in LLM context (analyze_document) | 6,000 chars | `threads.py` `_CTX_LIMIT_SUBAGENT` |
| Signed URL expiry | 1 hour | `sandbox_service.py` |
| Sub-agent max chars | `settings.sub_agent_max_chars` | `sub_agent_service.py` |
