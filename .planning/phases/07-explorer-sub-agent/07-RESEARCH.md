# Phase 7: Explorer Sub-Agent - Research

**Researched:** 2026-03-22
**Domain:** LLM orchestration, multi-tool agent loop, SSE streaming, React agent mode UI
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AGENT-01 | Explorer sub-agent has access to all KB tools (ls, tree, grep, glob, read) | All five KB tool functions are already implemented as importable Python helpers in `app/api/kb.py` and wired into the existing tool dispatch loop in `threads.py`. The explorer agent simply needs its own system prompt and tool list that includes only the KB tools. |
| AGENT-02 | Explorer sub-agent can invoke the document analysis sub-agent for deep document analysis | `run_sub_agent()` in `app/services/sub_agent_service.py` is already a reusable generator. The explorer agent needs to call it when the user's question requires full-document analysis on a specific document_id gathered from KB tool output. |
| AGENT-03 | Explorer sub-agent returns synthesized findings, not raw tool output | The existing tool loop already feeds raw tool results back into the message history, and the LLM synthesizes from them. A focused system prompt for the explorer mode — emphasizing "write a coherent answer, not raw JSON" — is the primary implementation lever here. |
</phase_requirements>

---

## Summary

Phase 7 creates an "Explorer" agent mode alongside the existing general-purpose chat mode. The explorer sub-agent receives all five KB exploration tools (ls, tree, grep, glob, read_document) plus the ability to invoke the existing document analysis sub-agent (`analyze_document`), and it returns synthesized prose answers rather than raw JSON.

Critically, **all the backend machinery already exists**: the tool dispatch loop, the five KB helper functions, the document analysis sub-agent, and the SSE streaming pipeline. This phase is almost entirely about wiring — connecting the existing pieces under a new `agent_mode` parameter, writing a focused system prompt for explorer mode, and adding a mode-selector control to the chat UI.

The biggest design decision is **where agent mode lives in the request**. The cleanest approach is a new optional field `agent_mode: str` on the `MessageCreate` request body (values: `"default"` | `"explorer"`). Backend `send_message` branches on this to select the system prompt and tool list for the current call. No new endpoints are needed.

**Primary recommendation:** Add `agent_mode` to `MessageCreate`, branch in `send_message` event_stream to use an explorer-specific system prompt and KB-only tool list, and add a mode toggle button to `MessageInput` (same pattern as the existing model selector dropdown).

---

## Standard Stack

No new libraries are required for this phase. All dependencies are already installed and in use.

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai (Python SDK) | already in requirements.txt | LLM calls and tool dispatch | Existing pattern throughout |
| fastapi | already installed | HTTP endpoint, SSE streaming | Existing pattern |
| pydantic | already installed | Request body validation | Project rule: Pydantic for all structured I/O |
| React + TypeScript | already installed | Agent mode toggle UI | Existing frontend stack |
| shadcn/ui DropdownMenu | already installed | Mode selector control | Already used for model selector — same pattern |
| lucide-react | already installed | Mode indicator icon | Already used throughout |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Pattern: agent_mode field on MessageCreate

The cleanest extension is adding an `agent_mode` field to the existing `MessageCreate` Pydantic model. The `send_message` endpoint already receives this model. No new endpoints or routers.

```python
# app/models/message.py — add field
class MessageCreate(BaseModel):
    content: str
    model: str | None = None
    agent_mode: str = "default"   # "default" | "explorer"
```

```python
# threads.py send_message — branch on agent_mode
if body.agent_mode == "explorer":
    system_prompt = EXPLORER_SYSTEM_PROMPT
    tools = get_explorer_tools()   # KB tools + analyze_document only
else:
    system_prompt = SYSTEM_PROMPT
    tools = get_tools()            # all tools (existing)
```

### Explorer System Prompt Design

The explorer system prompt must:
1. Direct the agent to use ls/tree/grep/glob/read to navigate the KB before answering
2. Explicitly state it should invoke `analyze_document` when deep per-document analysis is needed, passing the `document_id` (or filename) obtained from KB tool results
3. Require a synthesized prose answer — "do not return raw JSON or lists of filenames as your final answer"
4. Handle the empty-results case: "if no matching documents are found, say so explicitly"

```python
EXPLORER_SYSTEM_PROMPT = (
    "You are a Knowledge Base Explorer. You navigate the user's document library "
    "using filesystem-like tools to find and synthesize information.\n\n"
    "Available tools:\n"
    "1. ls — list files and subfolders at a path\n"
    "2. tree — view hierarchical folder structure\n"
    "3. grep — search document contents by regex pattern\n"
    "4. glob — find documents by filename pattern\n"
    "5. read_document — read full or partial document content by document_id\n"
    "6. analyze_document — perform deep analysis of a full document\n\n"
    "Exploration strategy:\n"
    "- Start with ls('/') or tree('/') to orient yourself\n"
    "- Use grep to find documents containing relevant content\n"
    "- Use glob to find documents by filename pattern\n"
    "- Use read_document to inspect content after grep/glob identifies candidates\n"
    "- Use analyze_document when the task requires understanding an entire document\n\n"
    "Rules:\n"
    "- Always return a coherent synthesized answer in prose — never return raw JSON, "
    "raw filenames, or tool output as your final response\n"
    "- If no relevant documents are found, say so clearly\n"
    "- Cite which document(s) your answer draws from\n"
    "- Use document_id from grep/glob/ls results when calling read_document"
)
```

### Explorer Tool List

The explorer agent uses only the KB tools — it does not need semantic search, SQL query, or web search in this mode.

```python
# openai_service.py — new function
def get_explorer_tools() -> list[dict]:
    """Tool list for the explorer sub-agent: KB navigation + document analysis."""
    return [LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL]
```

### Frontend Mode Selector

The mode selector follows the exact same pattern as the existing model selector: a `DropdownMenu` in the `MessageInput` toolbar, state lifted to `ChatArea`, passed down as prop. The `sendMessage` call in `useMessages` needs an `agentMode` parameter forwarded to `streamMessage`, which includes it in the POST body.

Key changes:
1. `MessageInput` props: add `agentMode: string`, `onAgentModeChange: (mode: string) => void`
2. `ChatArea`: manage `agentMode` state, pass to `MessageInput`; pass to `sendMessage`
3. `useMessages.sendMessage`: add `agentMode?: string` param
4. `streamMessage` in `api.ts`: add `agentMode?: string` to body JSON
5. `MessageCreate` model in backend: add `agent_mode` field

### Recommended Project Structure (no new files needed for backend)

The backend additions fit within existing files:
```
backend/app/
├── models/message.py        # add agent_mode field to MessageCreate
├── services/openai_service.py   # add EXPLORER_SYSTEM_PROMPT, get_explorer_tools()
└── api/threads.py           # branch on agent_mode in send_message
```

Frontend additions also fit within existing files:
```
frontend/src/
├── components/chat/MessageInput.tsx   # add mode selector control
├── components/chat/ChatArea.tsx       # manage agentMode state
├── hooks/useMessages.ts               # pass agentMode through
└── lib/api.ts                         # include agent_mode in POST body
```

### Anti-Patterns to Avoid

- **Separate endpoint for explorer mode:** Do not create a new `/threads/{id}/explore` endpoint. The existing endpoint supports multiple modes cleanly via the request body. Separate endpoints would duplicate all the tool dispatch logic.
- **Separate tool dispatch loop:** Do not duplicate the tool execution loop. The only differences between modes are (a) system prompt and (b) tool list. The loop itself is identical — reuse it.
- **Streaming `analyze_document` differently:** The explorer calling `analyze_document` uses the same `run_sub_agent()` path as the general mode. The existing SSE events (`sub_agent_start`, `sub_agent_delta`, `sub_agent_done`) and frontend handling already work — do not change them.
- **Storing agent_mode in thread/message:** The mode is a per-request parameter. There is no need to persist it per thread or per message.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tool dispatch loop | New loop for explorer | Existing loop in `threads.py` | Only system prompt and tool list differ; loop logic is identical |
| Document analysis integration | New sub-agent runner | `run_sub_agent()` in `sub_agent_service.py` | Already streaming, already LangSmith-traced |
| SSE event protocol | New event types | Existing `tool_start`/`tool_end`/`sub_agent_*` events | Frontend already handles all needed events |
| Mode selector UI | Custom dropdown component | shadcn `DropdownMenu` (already used for model selector) | Identical pattern, consistent UX |
| KB tool specs | Redeclare tool JSON | Existing `LS_TOOL`, `TREE_TOOL`, `GREP_TOOL`, `GLOB_TOOL`, `READ_DOCUMENT_TOOL`, `ANALYZE_DOCUMENT_TOOL` constants | Already defined in `openai_service.py` |

**Key insight:** This phase is assembly, not construction. Every piece exists; the work is connecting them under a new mode parameter and writing a focused system prompt.

---

## Common Pitfalls

### Pitfall 1: analyze_document tool uses filename, not document_id
**What goes wrong:** The `analyze_document` tool spec takes `filename` (for fuzzy matching via `resolve_document_id`). The KB tools (grep, glob, ls) return `document_id` (UUID). If the explorer agent calls `analyze_document` with a UUID, `resolve_document_id` may fail to match.
**Why it happens:** The two tools were designed independently. `analyze_document` pre-dates the KB tools and matches by name, not UUID.
**How to avoid:** Two options: (A) Update the `ANALYZE_DOCUMENT_TOOL` spec to also accept `document_id` directly, bypassing the fuzzy match; (B) In the system prompt, instruct the explorer to pass the filename from ls/grep results (which include filename alongside document_id). Option B is simpler — no tool spec change needed. The system prompt should say: "when calling analyze_document, use the filename returned by ls/grep/glob, not the document_id UUID."
**Warning signs:** LLM passes a UUID to `analyze_document` and gets "Document not found."

### Pitfall 2: Explorer system prompt must suppress raw-output responses
**What goes wrong:** Without explicit instruction, the LLM may return a message like "Found 3 documents: `[{'document_id': '...', 'filename': '...'}]`" instead of synthesizing a prose answer.
**Why it happens:** Tool result content is raw JSON that the LLM can parrot back unchanged.
**How to avoid:** Include in the system prompt: "Do not return raw JSON or filename lists as your final answer. Always synthesize the information into a coherent prose response." Confirm during validation that final assistant messages are prose, not JSON.

### Pitfall 3: Empty KB handled silently
**What goes wrong:** If no documents match, the tool returns `{"matches": [], "total": 0}` and the LLM may not communicate this clearly, leaving the user wondering if it searched at all.
**Why it happens:** The LLM sees an empty result and moves on without explicitly stating "no documents found."
**How to avoid:** System prompt should include: "If your exploration finds no relevant documents, explicitly tell the user no matching documents were found and what you searched for."

### Pitfall 4: Mode selector state lost on thread switch
**What goes wrong:** User switches to explorer mode, sends a message, then clicks a different thread. On return to the original thread, the mode may have reset to default.
**Why it happens:** `agentMode` state lives in `ChatArea`, not per-thread.
**How to avoid:** For v1.0, this is acceptable behavior — mode resets on navigation. Document it as known behavior, not a bug. The requirement is only that the mode is "selectable" — not that it persists across thread switches.

### Pitfall 5: Iteration limit can exhaust before synthesis
**What goes wrong:** The explorer may need several tool rounds (ls, grep, glob, read) before it has enough to answer. The existing `MAX_ITERATIONS = 5` may be hit on complex explorations.
**Why it happens:** Complex KB questions may require 4+ tool calls before the LLM can synthesize.
**How to avoid:** For explorer mode, consider raising `MAX_ITERATIONS` to 8 or 10. This is a backend branch — only applied when `agent_mode == "explorer"`. Alternatively, keep 5 and accept it as a v1.0 constraint (AGENT-04 caching in v2 requirements addresses this more holistically).

---

## Code Examples

### MessageCreate model addition
```python
# Source: app/models/message.py — current file
class MessageCreate(BaseModel):
    content: str
    model: str | None = None
    agent_mode: str = "default"   # "default" | "explorer"
```

### Backend branching in send_message (threads.py)
```python
# Source: app/api/threads.py — send_message event_stream inner function
if body.agent_mode == "explorer":
    active_system_prompt = EXPLORER_SYSTEM_PROMPT
    active_tools_fn = get_explorer_tools
    max_iterations = 10
else:
    active_system_prompt = SYSTEM_PROMPT
    active_tools_fn = get_tools
    max_iterations = 5

messages: list[dict] = [{"role": "system", "content": active_system_prompt}]
# ... load history, then use active_tools_fn() in create_streaming_chat call
```

### create_streaming_chat accepting a tools override
```python
# Source: app/services/openai_service.py — updated signature
def create_streaming_chat(
    messages: list[dict],
    tool_choice: str = "auto",
    model: str | None = None,
    user_settings: UserEffectiveSettings | None = None,
    tools_override: list[dict] | None = None,
):
    ...
    if tool_choice == "auto":
        kwargs["tools"] = tools_override if tools_override is not None else get_tools()
        kwargs["tool_choice"] = "auto"
```

### Frontend: agent mode state in ChatArea
```typescript
// Source: frontend/src/components/chat/ChatArea.tsx
const [agentMode, setAgentMode] = useState<"default" | "explorer">("default")

// Pass to handleSend → sendMessage → streamMessage → POST body
const handleSend = async (content: string) => {
  ...
  await sendMessage(activeThread.id, content, selectedModel || undefined, onTitleUpdate, agentMode)
}
```

### Frontend: agent mode selector in MessageInput
```typescript
// Source: frontend/src/components/chat/MessageInput.tsx
// Same DropdownMenu pattern as model selector, adjacent to it in the toolbar
// Values: "default" (label: "General") | "explorer" (label: "Explorer")
// Icon: use Map or Compass from lucide-react for explorer mode
```

### streamMessage: include agent_mode in POST body
```typescript
// Source: frontend/src/lib/api.ts — streamMessage function
body: JSON.stringify({ content, model, agent_mode: agentMode ?? "default" }),
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Single system prompt for all queries | Mode-specific system prompts | Phase 7 | Explorer gets a KB-focused prompt; general chat keeps existing prompt |
| All tools always available | Mode-specific tool lists | Phase 7 | Explorer sees only KB tools; prevents semantic search / SQL diluting the exploration loop |

**No deprecated patterns introduced.** This phase extends the existing architecture without changing it.

---

## Open Questions

1. **Should `analyze_document` in explorer mode accept document_id directly?**
   - What we know: Current spec takes `filename` for fuzzy matching. KB tools return `document_id`.
   - What's unclear: Whether a system prompt instruction to use the filename is reliable enough, or if the tool spec should be updated.
   - Recommendation: Start with system prompt instruction (simpler). If validation shows the LLM consistently passes UUIDs to analyze_document, update the tool spec to accept an optional `document_id` bypass.

2. **What iteration limit for explorer mode?**
   - What we know: Current `MAX_ITERATIONS = 5`. Complex KB explorations may need more rounds.
   - What's unclear: Whether real queries exhaust 5 rounds in practice.
   - Recommendation: Set explorer mode to `MAX_ITERATIONS = 8` as a simple safeguard. Easy to tune.

3. **Should mode selection persist per thread?**
   - What we know: v2 requirement AGENT-04 is about caching exploration state, not mode persistence.
   - What's unclear: Whether users expect mode to "stick" to a thread.
   - Recommendation: v1.0 — mode is session-only UI state, resets on thread switch. Document as known behavior.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (configured in `backend/pytest.ini`) |
| Config file | `backend/pytest.ini` |
| Quick run command | `pytest tests/unit/ -x -q` |
| Full suite command | `pytest tests/ -x -q` |

### Phase Requirements to Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AGENT-01 | Explorer mode sends only KB tools to the LLM | unit | `pytest tests/unit/test_explorer_agent.py -x` | No — Wave 0 |
| AGENT-01 | Explorer mode uses EXPLORER_SYSTEM_PROMPT | unit | `pytest tests/unit/test_explorer_agent.py -x` | No — Wave 0 |
| AGENT-02 | `analyze_document` tool call path works from explorer mode (reuses run_sub_agent) | unit | `pytest tests/unit/test_explorer_agent.py -x` | No — Wave 0 |
| AGENT-03 | System prompt includes instruction to synthesize, not return raw JSON | unit | `pytest tests/unit/test_explorer_agent.py -x` | No — Wave 0 |
| AGENT-03 | Empty-result case: grep/glob returning empty still yields LLM response | integration | `pytest tests/integration/test_threads.py -x` | Yes — existing file |

### Sampling Rate
- **Per task commit:** `pytest tests/unit/ -x -q`
- **Per wave merge:** `pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_explorer_agent.py` — covers AGENT-01, AGENT-02, AGENT-03 — unit tests for system prompt content, tool list contents, and branching logic

*(Existing `tests/integration/test_threads.py` and `tests/unit/` suite covers existing functionality and needs no new setup.)*

---

## Sources

### Primary (HIGH confidence)
- Direct code audit: `backend/app/api/threads.py` — full tool dispatch loop, sub_agent wiring
- Direct code audit: `backend/app/services/openai_service.py` — all tool specs, `get_tools()`, `create_streaming_chat()`
- Direct code audit: `backend/app/services/sub_agent_service.py` — `run_sub_agent()` signature and streaming pattern
- Direct code audit: `backend/app/api/kb.py` — all five KB helper functions (`ls_path`, `tree_path`, `grep_path`, `glob_path`, `read_path`)
- Direct code audit: `frontend/src/components/chat/MessageInput.tsx` — existing model selector pattern to replicate
- Direct code audit: `frontend/src/lib/api.ts` — `streamMessage` function signature and POST body structure
- Direct code audit: `frontend/src/hooks/useMessages.ts` — callback chain for sub-agent events
- Direct code audit: `backend/app/models/message.py` — `MessageCreate` model

### Secondary (MEDIUM confidence)
- `backend/tests/conftest.py` and existing test files — test patterns for new unit tests

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new libraries; confirmed all required pieces exist in codebase
- Architecture: HIGH — branching pattern is a direct extension of existing code; every function referenced exists and is confirmed readable
- Pitfalls: HIGH — pitfalls identified from direct reading of existing tool specs and system prompts, not from speculation

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable stack; Python + OpenAI SDK not changing rapidly)
