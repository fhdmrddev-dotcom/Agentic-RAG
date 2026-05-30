---
phase: 085-new-llm-tools
plan: 04
type: execute
wave: 4
depends_on: [01, 02, 03]
files_modified:
  - backend/app/api/panel.py
  - backend/app/main.py
  - backend/app/services/openai_service.py
  - backend/tests/integration/test_085_panel_endpoints.py
autonomous: false
requirements:
  - TOOL-01
  - TOOL-02
  - TOOL-03
  - TOOL-04
requirements_addressed:
  - TOOL-01
  - TOOL-02
  - TOOL-03
  - TOOL-04
tags:
  - backend
  - rest-api
  - tool-schemas
  - uat
  - phase-085

must_haves:
  truths:
    - "GET /threads/{tid}/todos returns the canonical todo list for the thread (RLS-enforced; user X cannot read user Y's todos)"
    - "GET /threads/{tid}/ask_user/pending returns ask_user_prompt messages rows that have no matching ask_user_response companion (jsonb scan via asyncpg)"
    - "GET /threads/{tid}/tasks returns sub-agent run index (runs WHERE parent_run_id IN parent-runs-for-thread)"
    - "3 new tool JSON schemas (WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL) registered in openai_service.get_tools() — lead with 'Use when…' + 'Do not use for…' per D-085-25"
    - "Tool count is 24 after this plan (16 existing + 5 workspace + 3 new)"
    - "panel router included in main.py with prefix /threads/{thread_id}"
    - "SC#10 4-axis UAT matrix executed (18 rows; Chrome MCP automates Rows 1-5 + 8-17; Rows 6,7,18 manual operator actions) — sign-off before phase ends"
    - "VALIDATION.md frontmatter flips nyquist_compliant: true after plan-checker passes (closes Phase 085 verify gate)"
  artifacts:
    - path: "backend/app/api/panel.py"
      provides: "3 GET endpoints under /threads/{thread_id} — /todos, /ask_user/pending, /tasks"
      exports: ["router"]
      contains: "router = APIRouter(prefix=\"/threads/{thread_id}\""
    - path: "backend/app/main.py"
      provides: "panel router include (one-line addition)"
      contains: "app.include_router(panel.router)"
    - path: "backend/app/services/openai_service.py"
      provides: "WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL constants + appended in get_tools()"
      contains: "WRITE_TODOS_TOOL"
  key_links:
    - from: "panel.py:GET /todos"
      to: "supabase.table('todos') select via aexec"
      via: "RLS-enforced supabase-py call"
      pattern: "supabase.table\\(.todos.\\)"
    - from: "panel.py:GET /ask_user/pending"
      to: "asyncpg pool jsonb @> containment query"
      via: "messages.tool_calls @> '[{\"kind\":\"ask_user_prompt\"}]'::jsonb NOT EXISTS response"
      pattern: "ask_user_prompt.*ask_user_response"
    - from: "panel.py:GET /tasks"
      to: "asyncpg pool runs WHERE parent_run_id IN (...)"
      via: "subquery on parent's user/thread filter"
      pattern: "parent_run_id"
    - from: "openai_service.py:get_tools"
      to: "agent_runner picks up 3 new tools automatically"
      via: "list append — no call-site change needed"
      pattern: "WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL"
---

<objective>
Close the Phase 085 loop: ship the 3 GET REST endpoints (`/threads/{tid}/todos`, `/threads/{tid}/ask_user/pending`, `/threads/{tid}/tasks`) that Phase 086/087 will consume, register the 3 new tool JSON schemas in openai_service.get_tools(), and execute the SC#10 4-axis UAT matrix.

Purpose: Make the new tools visible to the LLM (schemas), make the panel-ready data available to the frontend (REST), and verify the whole phase across the 4-axis matrix.

Output: 1 NEW router file (`panel.py`), main.py router include, 3 new tool schema constants + `get_tools()` extension, 1 integration test file, executed UAT matrix.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/085-new-llm-tools/085-CONTEXT.md
@.planning/phases/085-new-llm-tools/085-RESEARCH.md
@.planning/phases/085-new-llm-tools/085-PATTERNS.md
@.planning/phases/085-new-llm-tools/085-VALIDATION.md
@.planning/phases/085-new-llm-tools/085-01-todos-PLAN.md
@.planning/phases/085-new-llm-tools/085-02-task-service-PLAN.md
@.planning/phases/085-new-llm-tools/085-03-ask-user-PLAN.md
@backend/app/api/workspace.py
@backend/app/api/runs.py
@backend/app/services/openai_service.py
@backend/app/main.py
@backend/app/dependencies.py
@backend/app/utils/db.py

<interfaces>
<!-- Contracts the executor needs. -->

3 new tool JSON schemas — VERBATIM from RESEARCH §E (lines 767-862). Lead with "Use when…" + "Do not use for…" per D-085-25 to mitigate 24-tool selection-accuracy concern.

**WRITE_TODOS_TOOL** — full schema in RESEARCH §E. Required fields: id, content, status, parent_id, order_index (status enum: pending|in_progress|completed; parent_id type ["string","null"]; order_index int).

**TASK_TOOL** — full schema in RESEARCH §E. Required fields: description (string), instructions (string|null), tools (array|null), max_steps (integer|null). Description must include "Sub-agents cannot call task(), ask_user(), or write_todos()".

**ASK_USER_TOOL** — full schema in RESEARCH §E. Required fields: prompt (string), options (array|null), timeout_seconds (integer|null).

Provider quirks (RESEARCH §E + Assumption A3):
- Google rejects `"type": ["integer", "null"]` union — Phase 084 Plan 05 added a sanitizer; verify it covers new tools in UAT Row 13.
- OpenRouter weak models stringify args — Phase 084 Plan 05 added `_normalize_optional_int`; verify in UAT Row 18.

GET endpoint SQL (per RESEARCH §D.3-D.5):

`GET /threads/{tid}/todos` — supabase-py select, ordered by order_index, created_at.

`GET /threads/{tid}/ask_user/pending` — asyncpg jsonb @> containment + NOT EXISTS:
```sql
SELECT m.id, m.tool_calls, m.created_at
FROM messages m
WHERE m.thread_id = $1
  AND m.role = 'system'
  AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
  AND NOT EXISTS (
    SELECT 1 FROM messages r
    WHERE r.thread_id = m.thread_id
      AND r.role = 'system'
      AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
      AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'
  )
ORDER BY m.created_at ASC;
```

`GET /threads/{tid}/tasks` — asyncpg runs subquery:
```sql
SELECT r.run_id AS sub_run_id, r.started_at, r.completed_at, r.status, r.model, r.provider
FROM runs r
WHERE r.parent_run_id IN (
  SELECT run_id FROM runs WHERE thread_id = $1 AND user_id = $2
)
ORDER BY r.started_at DESC;
```

From `backend/app/api/workspace.py:1-49` (panel.py scaffolding template — prefix, _verify_thread_ownership helper, aexec usage).

From `backend/app/main.py:303-317` (router include block — `app.include_router(panel.router)` goes after workspace.router).

Decision IDs implemented in this plan:
- D-085-23: 4 endpoints total (the 4th is POST in Plan 03; this plan owns the 3 GET endpoints)
- D-085-24: FastAPI router pattern with supabase-py + RLS + run_in_threadpool
- D-085-25: Tool description style — "Use when…" + "Do not use for…" leading
- D-085-27: SC#10 4-axis UAT (executed in Task 5 checkpoint)
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → API (GET /threads/{tid}/*) | User Y must not read User X's todos / pending prompts / sub-agent runs |
| client → API (large jsonb scan) | Pathological thread with N messages — slow scan = DoS vector |
| LLM → backend (tool schema injection) | LLM cannot inject tool definitions; schemas are server-controlled constants |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-085-T19 | Information disclosure | GET /threads/{tid}/* cross-user reads | high | mitigate | Every endpoint calls `_verify_thread_ownership` (returns 404 on cross-user, not 403); supabase-py queries use RLS-enforced auth.uid() chain; asyncpg queries filter by user_id explicitly. (Tasks 2-3) |
| T-085-T20 | DoS | jsonb @> scan on messages.tool_calls with 10K+ rows | medium | accept (with monitor) | RESEARCH Assumption A2 — sub-100ms for N≈500; SEED-able if regresses. Add partial GIN index if UAT Row reveals p95 > 500ms. (Task 3) |
| T-085-T21 | Tampering | LLM emits messages.tool_calls.kind value not in the allowed enum | medium | mitigate | Plan 03's `_handle_ask_user` validates kind before insert; this plan's GET endpoints only READ — they filter by the allowed `kind` values via `@>` containment. Defense-in-depth at the consumer layer. |
| T-085-T22 | Tool-selection regression | Google/DeepSeek can't pick the right tool in 24-tool toolbox | medium | monitor (SEED-035) | Task 4 UAT matrix has rows on Anthropic/Google/OpenRouter for each new tool; SEED-035 fires if accuracy <90%. |
</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (Wave 0 + impl): 3 new tool JSON schemas in openai_service.py + extend get_tools()</name>
  <files>
    backend/app/services/openai_service.py
  </files>
  <read_first>
    backend/app/services/openai_service.py (lines 495-625 — WORKSPACE_*_TOOL shape; lines 651-680 — get_tools() current body),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§E — full WRITE_TODOS_TOOL / TASK_TOOL / ASK_USER_TOOL schemas at lines 767-862, copy verbatim),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on openai_service.py — tool schema constant pattern + get_tools extension site)
  </read_first>
  <behavior>
    - Test 1: `WRITE_TODOS_TOOL`, `TASK_TOOL`, `ASK_USER_TOOL` are module-level dicts in openai_service with `"type": "function"` and `"function": {...}` shapes
    - Test 2: Each tool's description starts with "Use when:" or "Use when …" (the leading style per D-085-25)
    - Test 3: Each tool's description contains "Do not use for:" (the closing style)
    - Test 4: TASK_TOOL description contains "Sub-agents cannot call task(), ask_user(), or write_todos()"
    - Test 5: `get_tools()` returns a list including all 3 new tools (WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL)
    - Test 6: `get_tools()` returns a list of length 24 (when user_settings enables all conditional tools — web_search + sandbox per existing logic) — OR at minimum, the 3 new tools are present alongside the 5 workspace tools
    - Test 7: All 3 new tools' `"required"` field includes ALL parameter names (strict-mode compatible across providers per RESEARCH §E)
  </behavior>
  <action>
    Append the 3 new tool schema constants to `backend/app/services/openai_service.py`. Copy VERBATIM from RESEARCH §E (lines 767-862 of `085-RESEARCH.md`). These are the canonical schemas — DO NOT abbreviate the descriptions; cross-provider tool selection accuracy depends on the explicit "Use when…" / "Do not use for…" wording.

    Locate the WORKSPACE_DIFF_TOOL constant (around line 600-625) and append after it:

    ```python
    # Phase 085 D-085-17..22 — write_todos tool schema
    WRITE_TODOS_TOOL = {
        "type": "function",
        "function": {
            "name": "write_todos",
            "description": (
                "Replace the thread's todo list with a new list. "
                "Use when: you need to break a complex multi-step task into trackable items the user can see, "
                "or when updating the status of in-flight work. "
                "Do not use for: short single-step answers, scratch notes, or per-message reminders. "
                "Semantics: full-state-replace — every call OVERWRITES the entire todo list. "
                "Include all current todos (both new and existing) in every call, not just the changes. "
                "Status values: pending | in_progress | completed."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "todos": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "id": {"type": "string", "description": "Stable client-supplied identifier (e.g. 't1', 't2'). Reuse the same id when updating status of an existing todo."},
                                "content": {"type": "string", "description": "What needs to be done. One sentence."},
                                "status": {"type": "string", "enum": ["pending", "in_progress", "completed"]},
                                "parent_id": {"type": ["string", "null"], "description": "Optional id of a parent todo for nesting. Omit or null for top-level items."},
                                "order_index": {"type": "integer", "description": "Display order within the list. 0-indexed."},
                            },
                            "required": ["id", "content", "status", "parent_id", "order_index"],
                        },
                    },
                },
                "required": ["todos"],
            },
        },
    }


    # Phase 085 D-085-08..16 — task sub-agent tool schema
    TASK_TOOL = {
        "type": "function",
        "function": {
            "name": "task",
            "description": (
                "Spawn a focused sub-agent to perform a delegated piece of work and return a summary. "
                "Use when: the work has a clear bounded objective that benefits from its own short context "
                "(e.g. 'find all mentions of X across these documents and summarize') and would otherwise pollute "
                "the main conversation. "
                "Do not use for: simple lookups (use search_documents directly), or for tasks that need "
                "to ask the user a question (sub-agents cannot call ask_user). "
                "Sub-agents cannot call task(), ask_user(), or write_todos(). "
                "Max sub-agent steps clamped server-side; long-running work should still be broken into multiple task() calls."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "description": {"type": "string", "description": "Required. What the sub-agent should accomplish, in one or two sentences."},
                    "instructions": {"type": ["string", "null"], "description": "Optional task-specific guidance APPENDED to the server's base sub-agent prompt."},
                    "tools": {
                        "type": ["array", "null"],
                        "items": {"type": "string"},
                        "description": "Optional. Restrict the sub-agent's toolset to these tool names (must be a subset of your own tools). Omit/null = use a safe read-only default set.",
                    },
                    "max_steps": {"type": ["integer", "null"], "description": "Optional. Maximum sub-agent iterations. Server clamps to a hard maximum."},
                },
                "required": ["description", "instructions", "tools", "max_steps"],
            },
        },
    }


    # Phase 085 D-085-01..07 — ask_user pause/resume tool schema
    ASK_USER_TOOL = {
        "type": "function",
        "function": {
            "name": "ask_user",
            "description": (
                "Pause and ask the user a question. The agent waits for the user's response (up to a timeout) "
                "before continuing. "
                "Use when: you have a true blocker that requires a decision only the user can make "
                "(e.g. 'which of these 3 files should I overwrite?'), or when proceeding without confirmation "
                "would risk destructive action. "
                "Do not use for: clarification questions you can answer yourself, or as a substitute for "
                "writing final assistant content (just respond normally instead). "
                "Always pass a clear, specific prompt — never ask 'are you sure?' without context."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "prompt": {"type": "string", "description": "Required. The question to show the user. Be specific."},
                    "options": {
                        "type": ["array", "null"],
                        "items": {"type": "string"},
                        "description": "Optional. Multiple-choice options. If provided, panel renders as buttons; user can still type free-text.",
                    },
                    "timeout_seconds": {"type": ["integer", "null"], "description": "Optional. Maximum seconds to wait. Server clamps."},
                },
                "required": ["prompt", "options", "timeout_seconds"],
            },
        },
    }
    ```

    Extend `get_tools()` (around line 651-680). Find the existing `tools = [...]` list and append the 3 new tools after `WORKSPACE_DIFF_TOOL`:
    ```python
    def get_tools(user_settings: "UserEffectiveSettings | None" = None) -> list[dict]:
        # ... existing prologue ...
        tools = [
            SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, LS_TOOL, TREE_TOOL, GREP_TOOL, GLOB_TOOL,
            READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL,
            LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL,
            REMEMBER_TOOL, RECALL_TOOL, QUERY_TABLES_TOOL,
            WORKSPACE_WRITE_TOOL, WORKSPACE_READ_TOOL, WORKSPACE_LIST_TOOL,
            WORKSPACE_DELETE_TOOL, WORKSPACE_DIFF_TOOL,
            # Phase 085 — D-085-25 — 3 new tools
            WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL,
        ]
        # ... existing conditional web_search + sandbox append (unchanged) ...
        return tools
    ```

    Tests live alongside existing tool-schema unit tests in `backend/tests/unit/` if such exist; otherwise add them to `backend/tests/unit/test_085_tool_registration.py` (created in Plan 01):
    ```python
    def test_phase_085_tool_schemas_present():
        from backend.app.services.openai_service import WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL
        assert WRITE_TODOS_TOOL["function"]["name"] == "write_todos"
        assert TASK_TOOL["function"]["name"] == "task"
        assert ASK_USER_TOOL["function"]["name"] == "ask_user"

    def test_descriptions_lead_with_use_when():
        from backend.app.services.openai_service import WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL
        for tool in (WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL):
            desc = tool["function"]["description"]
            assert "Use when" in desc, f"{tool['function']['name']} description missing 'Use when'"
            assert "Do not use for" in desc, f"{tool['function']['name']} description missing 'Do not use for'"

    def test_task_tool_excludes_self_and_friends():
        from backend.app.services.openai_service import TASK_TOOL
        assert "task(), ask_user(), or write_todos()" in TASK_TOOL["function"]["description"]

    def test_get_tools_includes_phase_085():
        from backend.app.services.openai_service import get_tools
        names = {t["function"]["name"] for t in get_tools(None)}
        assert {"write_todos", "task", "ask_user"}.issubset(names)
    ```
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/unit/test_085_tool_registration.py -x -k "phase_085 or use_when or excludes or get_tools" ; grep -q "WRITE_TODOS_TOOL" backend/app/services/openai_service.py ; grep -q "TASK_TOOL" backend/app/services/openai_service.py ; grep -q "ASK_USER_TOOL" backend/app/services/openai_service.py ; grep -q "Sub-agents cannot call task" backend/app/services/openai_service.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "WRITE_TODOS_TOOL = {" backend/app/services/openai_service.py` matches
    - `grep -q "TASK_TOOL = {" backend/app/services/openai_service.py` matches
    - `grep -q "ASK_USER_TOOL = {" backend/app/services/openai_service.py` matches
    - `grep -q "Use when:" backend/app/services/openai_service.py` matches (at least 3 times — one per new tool)
    - `grep -q "Do not use for:" backend/app/services/openai_service.py` matches (at least 3 times)
    - `grep -q "Sub-agents cannot call task" backend/app/services/openai_service.py` matches (TASK_TOOL description)
    - `grep -q "WRITE_TODOS_TOOL, TASK_TOOL, ASK_USER_TOOL" backend/app/services/openai_service.py` matches (get_tools list)
    - All 7 behavior tests pass: `cd backend && pytest tests/unit/test_085_tool_registration.py -x` exits 0
  </acceptance_criteria>
  <done>3 new tool schemas constants defined verbatim from RESEARCH §E; get_tools() returns them; descriptions follow Use when/Do not use for / sub-agent-restriction patterns.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2 (Wave 0 + impl): Create panel.py with GET /threads/{tid}/todos endpoint + test fixtures</name>
  <files>
    backend/app/api/panel.py,
    backend/app/main.py,
    backend/tests/integration/test_085_panel_endpoints.py
  </files>
  <read_first>
    backend/app/api/workspace.py (lines 1-49 — router scaffolding + _verify_thread_ownership helper; lines 98-123 — GET endpoint pattern),
    backend/app/main.py (lines 303-317 — router include block),
    backend/app/utils/db.py (aexec async helper for supabase calls),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§D.1 — file placement; §D.3 — /todos endpoint),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on backend/app/api/panel.py — full scaffolding skeleton)
  </read_first>
  <behavior>
    - Test 1: GET `/threads/{tid}/todos` with authenticated user returns 200 + JSON list of todos for the thread
    - Test 2: GET on a thread owned by a different user returns 404 (D-062-12 — not 403)
    - Test 3: Returned todos are ordered by `order_index ASC, created_at ASC`
    - Test 4: Each returned todo has keys: `id, content, status, parent_id, order_index, created_at, updated_at` (i.e. todo_id is aliased to `id` in the response — match wire format from RESEARCH §F SSE shape)
    - Test 5: `panel.router` is included in the FastAPI app (import + verify)
  </behavior>
  <action>
    Create `backend/app/api/panel.py` per PATTERNS scaffolding:

    ```python
    """Phase 085 D-085-23 — REST endpoints for thread-scoped panel data.

    Consumed by Phase 086 (StreamsProvider reconcile-on-thread-switch via fetch per
    D-v2.5-03) + Phase 087 (Panel UI).

    Endpoints:
      - GET /threads/{thread_id}/todos                — current todo list
      - GET /threads/{thread_id}/ask_user/pending     — pending ask_user prompts (Task 3)
      - GET /threads/{thread_id}/tasks                — sub-agent run index (Task 3)
    """
    from __future__ import annotations

    import logging
    from uuid import UUID

    from fastapi import APIRouter, Depends, HTTPException, status
    from supabase import Client

    from app.dependencies import get_current_user, get_supabase, get_pg_pool
    from app.utils.db import aexec

    logger = logging.getLogger(__name__)

    router = APIRouter(
        prefix="/threads/{thread_id}",
        tags=["panel"],
    )


    async def _verify_thread_ownership(thread_id: str, current_user: dict, supabase: Client) -> None:
        """Verify the authenticated user owns this thread. Raises 404 on failure (D-062-12 — never leak existence)."""
        resp = await aexec(
            supabase.table("threads")
            .select("id")
            .eq("id", thread_id)
            .eq("user_id", current_user["id"])
            .maybe_single()
        )
        row = resp.data if resp is not None else None
        if not row:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Thread not found")


    @router.get("/todos")
    async def get_thread_todos(
        thread_id: str,
        current_user: dict = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
    ):
        """Phase 085 D-085-23 — current canonical todo list for the thread."""
        await _verify_thread_ownership(thread_id, current_user, supabase)
        resp = await aexec(
            supabase.table("todos")
            .select("todo_id, content, status, parent_id, order_index, created_at, updated_at")
            .eq("thread_id", thread_id)
            .order("order_index")
            .order("created_at")
        )
        rows = resp.data or []
        # Rename todo_id -> id to match the SSE wire shape (RESEARCH §F)
        return [
            {
                "id": r["todo_id"],
                "content": r["content"],
                "status": r["status"],
                "parent_id": r["parent_id"],
                "order_index": r["order_index"],
                "created_at": r["created_at"],
                "updated_at": r["updated_at"],
            }
            for r in rows
        ]
    ```

    Register the router in `backend/app/main.py`. Locate the router-include block (around lines 303-317) and add:
    ```python
    from app.api import (..., panel)  # add panel to the existing import line

    app.include_router(panel.router)   # Phase 085 — thread-scoped panel data endpoints
    ```

    Create `backend/tests/integration/test_085_panel_endpoints.py` covering Tests 1-5. Use FastAPI TestClient or AsyncClient with dependency overrides for `get_current_user` + `get_supabase`. For Test 2: dependency-override `get_current_user` with a user that doesn't own the thread; mocked supabase `_verify_thread_ownership` returns no row; assert 404. For Test 4: assert response JSON keys.

    Tasks 3 below will extend this file with the other two endpoints + their tests.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/integration/test_085_panel_endpoints.py -x -k "todos or verify or thread_ownership" ; test -f backend/app/api/panel.py ; grep -q "router = APIRouter" backend/app/api/panel.py ; grep -q "prefix=.\\/threads\\/.thread_id" backend/app/api/panel.py ; grep -q "panel.router" backend/app/main.py</automated>
  </verify>
  <acceptance_criteria>
    - `backend/app/api/panel.py` exists
    - `grep -q "router = APIRouter" backend/app/api/panel.py` matches
    - `grep -q "/threads/{thread_id}" backend/app/api/panel.py` matches (prefix)
    - `grep -q "async def _verify_thread_ownership" backend/app/api/panel.py` matches
    - `grep -q "@router.get(\"/todos\")" backend/app/api/panel.py` matches
    - `grep -q "panel.router" backend/app/main.py` matches (include)
    - `grep -q "from app.api import" backend/app/main.py | grep -q "panel"` (or panel appears in the existing import line)
    - All 5 behavior tests for /todos pass: `cd backend && pytest tests/integration/test_085_panel_endpoints.py -x -k "todos"` exits 0
  </acceptance_criteria>
  <done>panel.py router scaffolded + included in main.py + /todos endpoint shipped + tested.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Add GET /ask_user/pending + GET /tasks endpoints (asyncpg jsonb scans)</name>
  <files>
    backend/app/api/panel.py,
    backend/tests/integration/test_085_panel_endpoints.py
  </files>
  <read_first>
    backend/app/api/panel.py (just created in Task 2 — for the _verify_thread_ownership helper + router pattern),
    backend/app/dependencies.py (get_pg_pool singleton),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§D.4 — /ask_user/pending jsonb scan SQL; §D.5 — /tasks subquery),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on panel.py — asyncpg divergences)
  </read_first>
  <behavior>
    - Test 1: GET `/threads/{tid}/ask_user/pending` with thread containing 1 ask_user_prompt row (no matching response) returns a 1-element list
    - Test 2: After POST `/runs/{rid}/ask_user_response` for that tool_call_id, GET `/pending` returns an empty list (the prompt is no longer "pending")
    - Test 3: GET `/pending` returns rows ordered by `created_at ASC` (oldest first)
    - Test 4: Each row contains the prompt details (prompt text, options, timeout_seconds, tool_call_id) extracted from `tool_calls[0]`
    - Test 5: GET `/threads/{tid}/tasks` returns sub-agent runs whose `parent_run_id` belongs to a run owned by the current user in this thread
    - Test 6: GET `/tasks` returns rows ordered by `started_at DESC` (newest first)
    - Test 7: GET on a thread owned by a different user returns 404
  </behavior>
  <action>
    Append two more endpoints to `backend/app/api/panel.py`:

    ```python
    @router.get("/ask_user/pending")
    async def get_pending_ask_user(
        thread_id: str,
        current_user: dict = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
    ):
        """Phase 085 D-085-23 — ask_user_prompt rows without a matching ask_user_response companion.

        Uses asyncpg directly for the jsonb @> containment scan + NOT EXISTS subquery
        (supabase-py doesn't natively express these). Per RESEARCH §D.4. RLS via the
        thread-ownership check + manual user_id filter in the SQL.
        """
        await _verify_thread_ownership(thread_id, current_user, supabase)
        pool = await get_pg_pool()
        rows = await pool.fetch(
            """
            SELECT m.id, m.tool_calls, m.created_at
            FROM messages m
            WHERE m.thread_id = $1
              AND m.role = 'system'
              AND m.tool_calls @> '[{"kind": "ask_user_prompt"}]'::jsonb
              AND NOT EXISTS (
                SELECT 1 FROM messages r
                WHERE r.thread_id = m.thread_id
                  AND r.role = 'system'
                  AND r.tool_calls @> '[{"kind": "ask_user_response"}]'::jsonb
                  AND r.tool_calls->0->>'tool_call_id' = m.tool_calls->0->>'tool_call_id'
              )
            ORDER BY m.created_at ASC
            """,
            UUID(thread_id),
        )
        result = []
        for r in rows:
            tcs = r["tool_calls"] or []
            payload = tcs[0] if tcs else {}
            result.append({
                "message_id": str(r["id"]),
                "tool_call_id": payload.get("tool_call_id"),
                "prompt": payload.get("prompt"),
                "options": payload.get("options"),
                "timeout_seconds": payload.get("timeout_seconds"),
                "run_id": payload.get("run_id"),
                "created_at": r["created_at"].isoformat() if r["created_at"] else None,
            })
        return result


    @router.get("/tasks")
    async def get_thread_tasks(
        thread_id: str,
        current_user: dict = Depends(get_current_user),
        supabase: Client = Depends(get_supabase),
    ):
        """Phase 085 D-085-23 — sub-agent run index for Phase 087 drill-down.

        Returns runs whose parent_run_id is a parent run owned by the current user
        in this thread. Per RESEARCH §D.5. Frontend joins with sub_agent_start SSE
        payload for description/tools/max_steps (those live in messages.tool_calls
        on the parent's stream).
        """
        await _verify_thread_ownership(thread_id, current_user, supabase)
        pool = await get_pg_pool()
        rows = await pool.fetch(
            """
            SELECT r.run_id AS sub_run_id, r.started_at, r.completed_at,
                   r.status, r.model, r.provider, r.parent_run_id
            FROM runs r
            WHERE r.parent_run_id IN (
              SELECT run_id FROM runs
              WHERE thread_id = $1 AND user_id = $2
            )
            ORDER BY r.started_at DESC
            """,
            UUID(thread_id), UUID(current_user["id"]),
        )
        return [
            {
                "sub_run_id": str(r["sub_run_id"]),
                "parent_run_id": str(r["parent_run_id"]) if r["parent_run_id"] else None,
                "status": r["status"],
                "model": r["model"],
                "provider": r["provider"],
                "started_at": r["started_at"].isoformat() if r["started_at"] else None,
                "completed_at": r["completed_at"].isoformat() if r["completed_at"] else None,
            }
            for r in rows
        ]
    ```

    Extend `backend/tests/integration/test_085_panel_endpoints.py` to cover Tests 1-7. For tests that need real asyncpg queries:
    - Use a real test DB connection if available (integration test conftest fixture for `pg_pool`)
    - For Tests 1-4: seed `messages` rows manually via the pool: 1 prompt row + 0 response rows (assert 1 pending), then 1 response row matching tool_call_id (assert 0 pending), order by created_at
    - For Tests 5-6: seed `runs` rows with parent_run_id chains (use the parent_run_id column added in Plan 01's migration); assert filter + ordering
    - For Test 7: assert 404 via dependency-override
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/integration/test_085_panel_endpoints.py -x ; grep -q "@router.get(.\\/ask_user\\/pending.)" backend/app/api/panel.py ; grep -q "@router.get(.\\/tasks.)" backend/app/api/panel.py ; grep -q "tool_calls @> " backend/app/api/panel.py ; grep -q "parent_run_id IN" backend/app/api/panel.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "@router.get(\"/ask_user/pending\")" backend/app/api/panel.py` matches
    - `grep -q "@router.get(\"/tasks\")" backend/app/api/panel.py` matches
    - `grep -q "tool_calls @> " backend/app/api/panel.py` matches (jsonb containment)
    - `grep -q "ask_user_prompt" backend/app/api/panel.py` matches (kind filter for /pending)
    - `grep -q "ask_user_response" backend/app/api/panel.py` matches (NOT EXISTS subquery)
    - `grep -q "parent_run_id IN" backend/app/api/panel.py` matches (/tasks SQL)
    - All 7 behavior tests pass: `cd backend && pytest tests/integration/test_085_panel_endpoints.py -x` exits 0
    - Endpoint count: panel.py has 3 GET endpoints — `grep -c "@router.get" backend/app/api/panel.py` returns 3
  </acceptance_criteria>
  <done>3 GET endpoints shipped; jsonb @> + NOT EXISTS pattern works for /pending; parent_run_id subquery works for /tasks; RLS chain via _verify_thread_ownership.</done>
</task>

<task type="auto">
  <name>Task 4: Update VALIDATION.md with per-task verification map + flip nyquist_compliant flag</name>
  <files>
    .planning/phases/085-new-llm-tools/085-VALIDATION.md
  </files>
  <read_first>
    .planning/phases/085-new-llm-tools/085-VALIDATION.md (current state — populate the Per-Task Verification Map section),
    .planning/phases/085-new-llm-tools/085-01-todos-PLAN.md (tasks for Plan 01),
    .planning/phases/085-new-llm-tools/085-02-task-service-PLAN.md (tasks for Plan 02),
    .planning/phases/085-new-llm-tools/085-03-ask-user-PLAN.md (tasks for Plan 03)
  </read_first>
  <action>
    Edit `.planning/phases/085-new-llm-tools/085-VALIDATION.md`:

    1. Populate the `## Per-Task Verification Map` table with rows for each Phase 085 task that ships behavior. One row per task across all 4 plans. Columns: Task ID, Plan, Wave, Requirement, Threat Ref, Secure Behavior, Test Type, Automated Command, File Exists, Status.

       Source the rows from each plan's `<tasks>` block. Map each task to:
       - Requirement: which of TOOL-01..TOOL-04 it addresses
       - Threat Ref: which T-085-T## threat it mitigates (from any plan's threat_model)
       - Automated Command: the `<automated>` value from that task
       - File Exists: ✅ (after Wave 0 scaffolds land in Plans 01-03)

    2. Set frontmatter `nyquist_compliant: true` and `wave_0_complete: true`.

    3. Add an "Approval" timestamp once Task 5 (the UAT execution checkpoint) signs off.
  </action>
  <verify>
    <automated>grep -q "nyquist_compliant: true" .planning/phases/085-new-llm-tools/085-VALIDATION.md ; grep -q "wave_0_complete: true" .planning/phases/085-new-llm-tools/085-VALIDATION.md ; grep -c "| 085-01-" .planning/phases/085-new-llm-tools/085-VALIDATION.md ; grep -c "| 085-02-" .planning/phases/085-new-llm-tools/085-VALIDATION.md ; grep -c "| 085-03-" .planning/phases/085-new-llm-tools/085-VALIDATION.md</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "nyquist_compliant: true" .planning/phases/085-new-llm-tools/085-VALIDATION.md` matches
    - `grep -q "wave_0_complete: true" .planning/phases/085-new-llm-tools/085-VALIDATION.md` matches
    - Per-Task Verification Map has at least 12 task rows (3 tasks Plan 01 + 4 tasks Plan 02 + 4 tasks Plan 03 + 4 tasks Plan 04 = 15 rows minimum)
    - Each row has a non-empty Automated Command column
    - Failure Criteria Coverage Map remains intact (all 10 FC# rows present)
  </acceptance_criteria>
  <done>VALIDATION.md per-task map populated; nyquist_compliant flag flipped; ready for Task 5 UAT.</done>
</task>

<task type="checkpoint:human-verify" gate="blocking">
  <name>Task 5 [BLOCKING] human-verify: Execute SC#10 4-axis UAT matrix from VALIDATION.md (18 rows)</name>
  <files>.planning/phases/085-new-llm-tools/085-VALIDATION.md</files>
  <read_first>
    .planning/phases/085-new-llm-tools/085-VALIDATION.md (UAT matrix sign-off table; failure-criteria coverage map),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (## Validation Architecture › SC#10 4-Axis UAT Matrix — 18 canonical rows),
    .planning/phases/085-new-llm-tools/085-CONTEXT.md (<failure_criteria> FC#1..FC#10 — every row maps to >=1 FC),
    CLAUDE.md (SC#10 4-axis UAT MANDATORY rule + reported-bugs cross-check),
    REDIS-SETUP.md (redis-cli client list command for FC#2 leak check)
  </read_first>
  <action>
    This task is a human-driven UAT execution against the live local dev stack. The full procedure lives under <how-to-verify> below.

    Summary of what the operator does:
    1. Start backend with WORKER_COUNT=2 and frontend on localhost:5173 (operator runs uvicorn personally per feedback_user_starts_backend)
    2. Drive UAT Rows 1-5 + 8-17 via Chrome DevTools MCP (provider switch in Settings, prompt, observe SSE + tool result)
    3. Manually execute Rows 6, 7, 18 (Stop button + redis-cli, browser reload, OpenRouter free-tier)
    4. Update `085-VALIDATION.md` per-task map with pass/fail per row; flip `**Approval:**` to "approved <date>"
    5. If LangSmith shows Google or DeepSeek/Moonshot tool-selection accuracy < 90% on Rows 1-4 + 13 + 18, plant SEED-035 per D-085-26 re_open_trigger
    6. If any row fails: document under .planning/reported-bugs/ (use TEMPLATE.md) AND decide gap-closure plan vs deferral

    Claude (executor) does not run any commands during this task — operator is in the driver's seat.
  </action>
  <what-built>
    Phase 085 ships 3 new tools (write_todos, task, ask_user), 4 REST endpoints, 5 new SSE event types, and 1 migration. All automated unit + integration tests are green from Plans 01-04 Tasks 1-4. The 4-axis UAT matrix is the manual cross-provider validation gate per SC#10 (CLAUDE.md MANDATORY).
  </what-built>
  <how-to-verify>
    Read `.planning/phases/085-new-llm-tools/085-VALIDATION.md` and `085-RESEARCH.md` `## Validation Architecture › SC#10 4-Axis UAT Matrix` (18 rows). For each row:

    **Setup once:**
    1. Start backend uvicorn with WORKER_COUNT=2 in your terminal (you start it yourself per `feedback_user_starts_backend`):
       ```
       cd backend && uvicorn app.main:app --reload --workers 2 --port 8000
       ```
    2. Start frontend: `cd frontend && npm run dev` (port 5173 — local dev app per `reference_local_dev_app.md`)
    3. Log in as `fhdmrd@gmail.com / 123456` via Chrome MCP

    **Chrome MCP rows (automated — Rows 1-5, 8-17):**
    Drive these via Chrome DevTools MCP. For each row:
    - Switch the user's active_provider in Settings to the row's target (OpenAI / Anthropic / Google / OpenRouter)
    - Issue the prompt that triggers the row's tool(s)
    - Verify the pass criterion (SSE events, no provider 400 errors, summary text returned, etc.)
    - Record pass/fail in VALIDATION.md per-task map

    **Manual rows (Rows 6, 7, 18):**
    - **Row 6 (ask_user + Stop)**: trigger an ask_user; while paused, click Stop button; in a SEPARATE terminal run `redis-cli client list | grep subscribe` — must return 0 lines after ~5s
    - **Row 7 (ask_user + reload)**: trigger an ask_user; while paused, browser-refresh (F5); verify the panel re-renders the prompt via the GET /threads/{tid}/ask_user/pending endpoint; submit; verify POST /runs/{rid}/ask_user_response returns 200; verify the runs.status flips to `error` (run is no longer alive after the reload)
    - **Row 18 (OpenRouter free-tier all 3 tools)**: switch to OpenRouter free-tier model; issue prompts triggering each of the 3 new tools; observe that the Phase 084 Plan 05 sanitizer + normalizer handle any stringified args or schema quirks

    **Per-row sign-off:**
    For each of the 18 rows, update VALIDATION.md per-task map row Status column to ✅ (pass) or ❌ (fail with note). At the end:
    - Set VALIDATION.md `## Validation Sign-Off` section's last checkbox `Chrome MCP UAT matrix (Rows 1-5, 8-17 automated; Rows 6, 7, 18 manual) executed before /gsd-verify-work 085`
    - Set `**Approval:**` field to "approved YYYY-MM-DD" (today's date)

    **If any row fails:**
    - Document the failure in VALIDATION.md and STATE.md
    - Decide: in-band gap closure (Plan 05) vs deferred bug report under `.planning/reported-bugs/`
    - Do NOT mark Approval until all blocking failures are addressed

    **Tool selection accuracy check (D-085-26 / SEED-035 trigger):**
    During Rows 1-4 + 13 + 18, check LangSmith trace count for failed/wrong tool picks. If accuracy drops below 90% on Google or DeepSeek/Moonshot, plant SEED-035 with `re_open_trigger` set per CONTEXT D-085-26.
  </how-to-verify>
  <resume-signal>Type "UAT complete" along with the per-row pass/fail tally and any SEED plant decisions. Claude will then commit the VALIDATION.md updates and proceed to Phase 085 verify-work.</resume-signal>
  <verify>
    <automated>grep -q "Approval:.*approved" .planning/phases/085-new-llm-tools/085-VALIDATION.md ; grep -c "✅\|❌" .planning/phases/085-new-llm-tools/085-VALIDATION.md</automated>
  </verify>
  <done>All 18 UAT rows have a pass/fail status in VALIDATION.md; Approval timestamp set; any FC failures triaged (in-band gap-closure plan OR new bug report). SEED-035 plant decision recorded.</done>
</task>

</tasks>

<verification>
- VALIDATION.md sampling rate:
  - Per-task automated: `cd backend && pytest tests/integration/test_085_panel_endpoints.py tests/unit/test_085_tool_registration.py -x` exits 0
  - Phase gate: ALL Phase 085 tests green + SC#10 UAT matrix signed off in VALIDATION.md
- Tool count: `cd backend && python -c "from app.services.openai_service import get_tools; print(len([t for t in get_tools(None) if t['function']['name'] in {'write_todos', 'task', 'ask_user'}]))"` returns 3
- Phase 085 closes the loop: VALIDATION.md `nyquist_compliant: true` + Approval set
- _TOOL_REGISTRY size: from the dispatcher module — assert `len(_TOOL_REGISTRY)` is 24 after Plans 01+02+03+04 land (16 existing + 5 workspace + write_todos + task + ask_user)
</verification>

<success_criteria>
1. GET /threads/{tid}/todos returns the canonical todo list with RLS enforcement (cross-user attempt = 404).
2. GET /threads/{tid}/ask_user/pending returns ONLY ask_user_prompt rows without a matching ask_user_response (FC#3 + FC#10 verified).
3. GET /threads/{tid}/tasks returns sub-agent runs filtered by parent_run_id ∈ user's runs in this thread (FC#9 — no cross-thread leakage).
4. 3 new tool schemas in `openai_service.get_tools()` — total tool count is 24 per D-085-25; descriptions lead with "Use when…" + "Do not use for…".
5. panel.router included in main.py; reachable via FastAPI route inspection.
6. SC#10 4-axis UAT matrix (18 rows) executed and signed off in VALIDATION.md (with Approval timestamp).
7. SEED-035 status: either planted (if accuracy regressed) or left unplanted (if all providers ≥90%).
8. No `supabase db push` / `supabase db reset` invoked anywhere across all 4 plans (`git log --all --oneline | grep -i "db push\|db reset"` empty).
</success_criteria>

<output>
After completion, create `.planning/phases/085-new-llm-tools/085-04-rest-tools-uat-SUMMARY.md` per `.claude/get-shit-done/templates/summary.md` documenting:
- 3 GET endpoints shipped + 3 tool schemas registered (with their full descriptions verbatim if not yet in the codebase docs)
- 24-tool toolbox confirmed; tool-selection accuracy result from Task 5 UAT
- 4-axis UAT result summary (rows pass/fail, any SEED-035 plant decision)
- Cross-references to Plans 01-03's SUMMARYs for the full Phase 085 picture
- Confirmation that SEED-035 was/was-not planted with the rationale
</output>
