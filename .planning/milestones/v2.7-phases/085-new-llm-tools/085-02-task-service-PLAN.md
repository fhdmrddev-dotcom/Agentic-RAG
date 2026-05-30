---
phase: 085-new-llm-tools
plan: 02
type: execute
wave: 2
depends_on: [01]
files_modified:
  - backend/app/services/task_service.py
  - backend/app/services/sub_agent_models.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/api/threads.py
  - backend/app/config.py
  - backend/tests/unit/test_085_task_service.py
  - backend/tests/integration/test_085_concurrency.py
  - backend/tests/integration/test_085_sub_agent_emit.py
autonomous: true
requirements:
  - TOOL-02
requirements_addressed:
  - TOOL-02
tags:
  - backend
  - sub-agent
  - concurrency
  - tool-dispatcher
  - phase-085

must_haves:
  truths:
    - "task() spawns a sub-agent with its own runs row (parent_run_id set), own SSE Stream run:{sub_run_id}, and own tool-dispatch loop"
    - "task() requested tools is validated as a subset of parent's available_tools; task/ask_user/write_todos are excluded from sub-agent toolsets"
    - "Sub-agent's _handle_task short-circuits when ctx.parent_run_id is non-null (1-level nesting cap)"
    - "Per-run concurrency cap fires at the 4th simultaneous task() call (default = 3)"
    - "Global Redis counter blocks the 21st task() call (default = 20)"
    - "sub_agent_start{sub_run_id, description, tools, max_steps} emits on PARENT's run:{parent_run_id} stream"
    - "sub_agent_done{sub_run_id, status, summary} emits on PARENT's run:{parent_run_id} stream"
    - "All sub-agent internal tool calls emit on the SUB-agent's own run:{sub_run_id} stream — never on parent's"
    - "Cross-provider model footgun (D-075.5-04) avoided via resolve_sub_agent_model_safely helper replicated from sub_agent_service.py:62-89"
    - "task_service.py is a NEW file; sub_agent_service.py is byte-identical (D-085-16 — no edits)"
  artifacts:
    - path: "backend/app/services/task_service.py"
      provides: "run_task_sub_agent() entry point — sub-agent loop with own runs row + nested tool dispatch + Lua concurrency helpers"
      exports: ["run_task_sub_agent", "acquire_global_task_slot", "release_global_task_slot"]
    - path: "backend/app/services/sub_agent_models.py"
      provides: "resolve_sub_agent_model_safely() shared helper used by task_service (NOT imported by sub_agent_service.py per D-085-16 freeze)"
      exports: ["resolve_sub_agent_model_safely"]
    - path: "backend/app/services/tool_dispatcher.py"
      provides: "_handle_task handler + task registry entry; ToolContext extended with parent_run_id, per_run_task_semaphore, available_tools, tool_call_id fields"
      contains: "\"task\": _handle_task"
    - path: "backend/app/api/threads.py"
      provides: "agent_runner constructs per-run asyncio.Semaphore once; populates new ToolContext fields per dispatch"
      contains: "task_per_run_concurrency"
    - path: "backend/app/config.py"
      provides: "task_max_steps + task_per_run_concurrency + task_global_concurrency + ask_user_max_timeout_seconds Settings fields"
      contains: "task_per_run_concurrency"
  key_links:
    - from: "tool_dispatcher.py:_handle_task"
      to: "task_service.py:run_task_sub_agent"
      via: "import inside handler"
      pattern: "from app.services.task_service import run_task_sub_agent"
    - from: "task_service.py:run_task_sub_agent"
      to: "tool_dispatcher.py:dispatch_tool"
      via: "sub-agent loop calls dispatch_tool with sub_ctx (parent_run_id non-null)"
      pattern: "await dispatch_tool"
    - from: "task_service.py"
      to: "db/runs.py:insert_run / finalize_run"
      via: "creates own runs row with parent_run_id set, finalizes in try/finally"
      pattern: "parent_run_id=parent_ctx.run_id"
    - from: "task_service.py"
      to: "Redis tasks:global:active counter"
      via: "Lua INCR+EXPIRE script (atomic, multi-worker-safe)"
      pattern: "tasks:global:active"
    - from: "_handle_task"
      to: "ctx.per_run_task_semaphore"
      via: "asyncio.wait_for(sem.acquire(), timeout=0) — non-blocking try-acquire"
      pattern: "per_run_task_semaphore"
---

<objective>
Ship `task_service.py` (NEW sub-agent loop with parent_run_id + own SSE stream + own tool dispatch), the `_handle_task` dispatcher handler, ToolContext extensions, per-run + global concurrency caps, and a shared model-routing safety helper extracted from sub_agent_service.py (without modifying that file).

Purpose: Deliver TOOL-02 — agent calls `task()`, sub-agent runs with constrained toolset + 1-level nesting cap + per-run/global concurrency limits, returning a summary string to the parent.

Output: 2 NEW service files (`task_service.py`, `sub_agent_models.py`), `_handle_task` handler + registry entry, ToolContext extension, per_run_task_semaphore init in agent_runner, 4 new Settings fields, 3 new test files.
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
@backend/app/services/sub_agent_service.py
@backend/app/services/tool_dispatcher.py
@backend/app/services/openai_service.py
@backend/app/api/threads.py
@backend/app/db/runs.py
@backend/app/dependencies.py
@backend/app/config.py
@backend/tests/unit/test_tool_dispatcher.py

<interfaces>
<!-- Contracts the executor needs. -->

From `backend/app/services/sub_agent_service.py:62-89` (MUST NOT be edited per D-085-16; REPLICATE its model-routing safety into the new sub_agent_models.py helper):
```python
_active_provider = (user_settings.active_provider if user_settings else "") or ""
_active_models = (user_settings.llm_models if (user_settings and getattr(user_settings, "llm_models", None)) else "")
_active_models_list = [m.strip() for m in _active_models.split(",") if m.strip()] if _active_models else []
_provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(_active_provider, "")

if override_model and _active_models_list and override_model not in _active_models_list:
    logger.warning(
        "sub_agent_model=%r is not in active provider=%r's model list — "
        "falling back to default to avoid cross-provider call.",
        override_model, _active_provider,
    )
    effective_model = (
        _provider_default
        or (user_settings.llm_model if user_settings else None)
        or model
        or settings.llm_model
    )
```

From `backend/app/services/tool_dispatcher.py` (extend ToolContext):
```python
@dataclass
class ToolContext:
    redis: Any
    run_id: Any
    thread_id: str
    supabase: Any
    pool: Any
    user_settings: Any
    current_user: dict
    folder_subtree_ids: list | None
    scoped_folder_path: str | None
    emit: Callable
    spawn: Callable
    model: str | None = None
    iteration: int = 0
    tool_index: int = 0
    previous_files_in_run: dict = field(default_factory=dict)
```

From `backend/app/api/threads.py` ToolContext construction site (around lines 2603-2618) — executor must read to locate exact line and add 3 new kwargs.

From `backend/app/db/runs.py` `insert_run` — extended in Plan 01 to accept `parent_run_id` kwarg.

Default sub-agent toolset (per D-085-09):
```python
DEFAULT_READ_ONLY = {
    "search_documents", "query_documents", "read_document",
    "web_search", "ls", "tree", "grep", "glob",
    "analyze_document", "query_tables",
    "workspace_read", "workspace_list",
}
EXCLUDED = {"task", "ask_user", "write_todos"}
```

Decision IDs implemented in this plan:
- D-085-08: `task(description, instructions?, tools?, max_steps?)` signature
- D-085-09: tools subset enforcement; default = read-only set; EXCLUDED set
- D-085-10: max_steps clamped to TASK_MAX_STEPS (default 10); default-when-omitted = 5
- D-085-11: NO model_override / system_prompt_override exposure
- D-085-12: 1-level nesting cap via ToolContext.parent_run_id
- D-085-13: task() returns final assistant message text only (summary)
- D-085-14: each task() gets own runs row + run:{sub_run_id} Stream; sub_agent_start/done on PARENT stream
- D-085-15: per-run cap = 3 (asyncio.Semaphore); global cap = 20 (Redis tasks:global:active counter via Lua)
- D-085-16: NEW file task_service.py; sub_agent_service.py stays byte-identical
- D-085-28: blocking I/O wraps; redis.asyncio + asyncpg are async-native (no wrap)
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| LLM → backend (task tool args) | LLM can request arbitrary tools/max_steps/nesting; must validate before spawning sub-agent |
| Sub-agent → backend (sub_ctx tool dispatch) | Sub-agent might call task() recursively; must enforce nesting cap at handler entry |
| Worker A ↔ Worker B (tasks:global:active counter) | Concurrent task() spawns across workers must atomically reserve a slot |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-085-T6 | Elevation of privilege | `_handle_task` toolset validation | high | mitigate | Server-side validation: requested `tools` is filtered to `(ctx.available_tools - EXCLUDED)`; any non-member triggers `ToolResult(result="task() refused: tools {invalid} not available to sub-agent")`. (Task 4 — RESEARCH §B.1) |
| T-085-T7 | DoS | nested task() worker pool exhaustion | high | mitigate | `ctx.parent_run_id is not None` causes early-return at handler entry; sub-agent's ToolContext sets parent_run_id non-null. (Task 4 — RESEARCH §B.2) |
| T-085-T8 | DoS | LLM spawns unbounded parallel task() calls | high | mitigate | Per-run `asyncio.Semaphore(3)` non-blocking try-acquire; global Redis Lua-atomic counter capped at 20 with 7200s EXPIRE for crash-safety. (Task 4 — RESEARCH §B.3) |
| T-085-T9 | Spoofing / Tampering | Sub-agent inherits wrong provider/model (D-075.5-04 footgun) | high | mitigate | Replicate sub_agent_service.py:62-89 verbatim into NEW `sub_agent_models.py` helper; task_service imports and uses it. Sub-agent UAT (Plan 04 Row 8, 9) verifies no cross-provider 400 errors. (Task 1) |
| T-085-T10 | Information disclosure | Sub-agent's `previous_files_in_run` leaks parent's execute_code output state | low | mitigate | Sub-agent's ToolContext sets `previous_files_in_run={}` (fresh dict) per Pitfall 7. Reviewed in Task 3. |
| T-085-T11 | Repudiation | Sub-agent crashes mid-loop leaving runs row as `streaming` forever | medium | mitigate | task_service wraps loop in try/except/finally with `finalize_run` in finally block; mirrors `_shielded_finalize` discipline (Pitfall 5). |
</threat_model>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1 (Wave 0 + impl): Extract sub_agent_models helper + Settings fields + test scaffolds</name>
  <files>
    backend/app/services/sub_agent_models.py,
    backend/app/config.py,
    backend/tests/unit/test_085_task_service.py,
    backend/tests/integration/test_085_concurrency.py,
    backend/tests/integration/test_085_sub_agent_emit.py
  </files>
  <read_first>
    backend/app/services/sub_agent_service.py (lines 1-126 — model-routing safety pattern; DO NOT MODIFY this file),
    backend/app/config.py (lines 540-790 — _SUB_AGENT_MODEL_DEFAULTS at 546-556 + sub_agent_* settings at 777-789),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§B.3 — concurrency cap Lua skeleton),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on task_service.py analog A; section on config.py),
    .planning/phases/085-new-llm-tools/085-VALIDATION.md (Wave 0 Requirements list)
  </read_first>
  <behavior>
    - Test 1: `resolve_sub_agent_model_safely(user_settings, override_model=None)` returns `user_settings.llm_model` when no override
    - Test 2: `resolve_sub_agent_model_safely(user_settings, override_model="gpt-4")` returns "gpt-4" when "gpt-4" is in `user_settings.llm_models`
    - Test 3: `resolve_sub_agent_model_safely(user_settings, override_model="claude-3")` returns the provider default for `user_settings.active_provider` when "claude-3" is NOT in `llm_models` (cross-provider footgun mitigation)
    - Test 4: `config.settings` has 4 new fields: `ask_user_max_timeout_seconds` (1800), `task_max_steps` (10), `task_per_run_concurrency` (3), `task_global_concurrency` (20)
    - Test 5 (scaffolding only — RED until Tasks 3-4): `tests/unit/test_085_task_service.py` imports `task_service.run_task_sub_agent`
  </behavior>
  <action>
    Create `backend/app/services/sub_agent_models.py` (NEW shared helper) — REPLICATE (don't import from) the `sub_agent_service.py:62-89` logic. Reason: D-085-16 freezes sub_agent_service.py, but we still want one place to fix this if the model-routing safety needs a future patch:

    ```python
    """Phase 085 — shared sub-agent model-routing safety helper.

    REPLICATES the logic in sub_agent_service.py:62-89 (D-075.5-04 footgun mitigation)
    so task_service.py can use the same safety net WITHOUT modifying sub_agent_service.py
    (which is byte-frozen per D-085-16).
    """
    from __future__ import annotations

    import logging
    from typing import TYPE_CHECKING

    if TYPE_CHECKING:
        from app.models.user_settings import UserEffectiveSettings

    from app.config import settings, _SUB_AGENT_MODEL_DEFAULTS

    logger = logging.getLogger(__name__)


    def resolve_sub_agent_model_safely(
        user_settings: "UserEffectiveSettings | None",
        override_model: str | None = None,
        fallback_model: str | None = None,
    ) -> str:
        """Return a safe model name for sub-agent use, falling back when override
        would route to a different provider than user_settings.active_provider.

        Mirrors sub_agent_service.py:62-89 verbatim.
        """
        _active_provider = (user_settings.active_provider if user_settings else "") or ""
        _active_models = (
            user_settings.llm_models
            if (user_settings and getattr(user_settings, "llm_models", None))
            else ""
        )
        _active_models_list = (
            [m.strip() for m in _active_models.split(",") if m.strip()]
            if _active_models else []
        )
        _provider_default = _SUB_AGENT_MODEL_DEFAULTS.get(_active_provider, "")

        if override_model and _active_models_list and override_model not in _active_models_list:
            logger.warning(
                "sub_agent_model=%r is not in active provider=%r's model list — "
                "falling back to default to avoid cross-provider call.",
                override_model, _active_provider,
            )
            return (
                _provider_default
                or (user_settings.llm_model if user_settings else None)
                or fallback_model
                or settings.llm_model
            )

        return (
            override_model
            or (user_settings.llm_model if user_settings else None)
            or fallback_model
            or settings.llm_model
        )
    ```

    Extend `backend/app/config.py` Settings class — append after `sub_agent_max_output_tokens` (line around 789):
    ```python
    # Phase 085 — D-085-03, D-085-10, D-085-15
    ask_user_max_timeout_seconds: int = 1800   # 30 min hard cap; default per-call 300
    task_max_steps: int = 10                   # Sub-agent iteration cap (default per-call: 5)
    task_per_run_concurrency: int = 3          # asyncio.Semaphore size per top-level run
    task_global_concurrency: int = 20          # tasks:global:active Redis counter cap
    ```

    Create Wave 0 test scaffolds (per VALIDATION.md):

    `backend/tests/unit/test_085_task_service.py` (scaffold + Tests 1-4):
    ```python
    import pytest

    def test_task_service_module_importable():
        from backend.app.services import task_service
        assert hasattr(task_service, "run_task_sub_agent")

    def test_resolve_no_override_returns_user_model():
        from backend.app.services.sub_agent_models import resolve_sub_agent_model_safely
        # construct a minimal user_settings stand-in (real one is a pydantic model)
        class US:
            active_provider = "openai"
            llm_model = "gpt-4o"
            llm_models = "gpt-4o,gpt-4o-mini"
        assert resolve_sub_agent_model_safely(US(), override_model=None) == "gpt-4o"

    def test_resolve_override_in_provider_list_passes_through():
        from backend.app.services.sub_agent_models import resolve_sub_agent_model_safely
        class US:
            active_provider = "openai"
            llm_model = "gpt-4o"
            llm_models = "gpt-4o,gpt-4o-mini"
        assert resolve_sub_agent_model_safely(US(), override_model="gpt-4o-mini") == "gpt-4o-mini"

    def test_resolve_override_cross_provider_falls_back():
        from backend.app.services.sub_agent_models import resolve_sub_agent_model_safely
        class US:
            active_provider = "openai"
            llm_model = "gpt-4o"
            llm_models = "gpt-4o,gpt-4o-mini"
        # claude-3 not in OpenAI provider's llm_models list — must fall back to OpenAI default or llm_model
        result = resolve_sub_agent_model_safely(US(), override_model="claude-3-haiku")
        assert result != "claude-3-haiku"
        # must be one of: provider default, user's llm_model, or fallback_model
        assert result in ("gpt-4o", "gpt-4o-mini") or result.startswith("gpt-")

    def test_config_settings_phase_085_fields():
        from backend.app.config import settings
        assert settings.ask_user_max_timeout_seconds == 1800
        assert settings.task_max_steps == 10
        assert settings.task_per_run_concurrency == 3
        assert settings.task_global_concurrency == 20
    ```

    `backend/tests/integration/test_085_concurrency.py` (scaffold only):
    ```python
    import pytest

    @pytest.mark.asyncio
    async def test_global_slot_helpers_exist():
        from backend.app.services.task_service import acquire_global_task_slot, release_global_task_slot
        assert callable(acquire_global_task_slot)
        assert callable(release_global_task_slot)
    ```

    `backend/tests/integration/test_085_sub_agent_emit.py` (scaffold only):
    ```python
    def test_module_exists():
        from backend.app.services import task_service
        assert task_service is not None
    ```
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/unit/test_085_task_service.py -x -k "resolve or settings" ; grep -q "task_per_run_concurrency: int = 3" backend/app/config.py ; grep -q "ask_user_max_timeout_seconds: int = 1800" backend/app/config.py ; test -f backend/app/services/sub_agent_models.py</automated>
  </verify>
  <acceptance_criteria>
    - `backend/app/services/sub_agent_models.py` exists
    - `grep -q "def resolve_sub_agent_model_safely" backend/app/services/sub_agent_models.py` matches
    - `grep -q "is not in active provider" backend/app/services/sub_agent_models.py` matches (the D-075.5-04 fallback path)
    - `backend/app/services/sub_agent_service.py` is unmodified (D-085-16 — `git diff backend/app/services/sub_agent_service.py` is empty)
    - `grep -q "task_per_run_concurrency: int = 3" backend/app/config.py` matches
    - `grep -q "task_global_concurrency: int = 20" backend/app/config.py` matches
    - `grep -q "ask_user_max_timeout_seconds: int = 1800" backend/app/config.py` matches
    - `grep -q "task_max_steps: int = 10" backend/app/config.py` matches
    - Three new test files exist at `backend/tests/unit/test_085_task_service.py`, `backend/tests/integration/test_085_concurrency.py`, `backend/tests/integration/test_085_sub_agent_emit.py`
    - `cd backend && pytest tests/unit/test_085_task_service.py -k "resolve or settings" -x` exits 0
  </acceptance_criteria>
  <done>Model-routing helper extracted (sub_agent_service.py untouched), 4 Settings fields added, Wave 0 test scaffolds in place.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Extend ToolContext (4 new fields) + agent_runner construction + populate tool_call_id per dispatch</name>
  <files>
    backend/app/services/tool_dispatcher.py,
    backend/app/api/threads.py,
    backend/tests/unit/test_085_tool_registration.py
  </files>
  <read_first>
    backend/app/services/tool_dispatcher.py (lines 59-77 — ToolContext dataclass current shape),
    backend/app/api/threads.py (lines 1402-1508 — agent_runner setup; lines 2600-2700 — ToolContext construction site + tool_index assignment in the for-loop; lines 1499-1506 — active_tools derivation from get_tools()),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§B.2 + §B.3 — semaphore init + parent_run_id + available_tools + tool_call_id fields),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on backend/app/api/threads.py — ToolContext extension diff),
    backend/tests/unit/test_tool_dispatcher.py (lines 64-82 — test fixture instantiation pattern)
  </read_first>
  <behavior>
    - Test 1: `ToolContext(redis=..., run_id=..., ...)` (existing required args only) constructs successfully with the new fields defaulting safely (parent_run_id=None, per_run_task_semaphore=None, available_tools=[], tool_call_id="")
    - Test 2: Existing test_tool_dispatcher.py tests still pass (no regression on existing 21 handlers)
    - Test 3: In threads.py, after agent_runner construction, ctx.available_tools is a list[str] of tool name strings extracted via `[t["function"]["name"] for t in ...]`
    - Test 4: In threads.py, ctx.per_run_task_semaphore is created via `asyncio.Semaphore(settings.task_per_run_concurrency)` (default bound = 3)
    - Test 5: In threads.py per-tool-call loop, ctx.tool_call_id is populated from `tc.get("id", "")` before each dispatch_tool call
  </behavior>
  <action>
    Edit `backend/app/services/tool_dispatcher.py` — extend `ToolContext` dataclass with 4 new fields. Defaults are safe no-ops so existing handlers don't break:

    ```python
    @dataclass
    class ToolContext:
        # ... existing fields unchanged ...
        iteration: int = 0
        tool_index: int = 0
        previous_files_in_run: dict = field(default_factory=dict)
        # Phase 085 — D-085-09 / D-085-12 / D-085-15 / D-085-01
        parent_run_id: "UUID | None" = None              # non-null inside sub-agent enforces 1-level nesting cap
        per_run_task_semaphore: "asyncio.Semaphore | None" = None  # per-run task() cap; init once in agent_runner
        available_tools: list[str] = field(default_factory=list)   # tool-name list for sub-agent subset validation
        tool_call_id: str = ""                            # populated per tool call by agent_runner; used by ask_user channel naming
    ```

    Add `from uuid import UUID` and `import asyncio` if not already imported (verify imports section at the top of tool_dispatcher.py).

    Then edit `backend/app/api/threads.py`:

    1. At the agent_runner setup site, BEFORE the `for iteration in range(max_iterations):` loop (read the file to locate exactly — typically around line 2580-2600 where the ToolContext is first constructed):
       ```python
       # Phase 085 D-085-15 — per-run task() concurrency semaphore (once per top-level run)
       _per_run_task_semaphore = asyncio.Semaphore(settings.task_per_run_concurrency)
       ```

    2. At the ToolContext(...) construction site (around lines 2603-2618). Add 3 new kwargs at the end of the constructor call:
       ```python
           # Phase 085 additions
           parent_run_id=None,                              # top-level run; task_service overrides for sub-agents
           per_run_task_semaphore=_per_run_task_semaphore,
           available_tools=[t["function"]["name"] for t in (active_tools or get_tools(user_settings))],
       ```
       (tool_call_id is set per-tool-call inside the for-loop, not at construction time.)

    3. Inside the per-tool-call for-loop (where `tool_index` is currently assigned to ctx — typically `for tool_index, tc in enumerate(tool_calls):`), also assign:
       ```python
       tool_ctx.tool_index = tool_index
       tool_ctx.tool_call_id = tc.get("id", "")  # Phase 085 D-085-01 — for ask_user channel naming
       _tool_result = await dispatch_tool(tool_name, args, tool_ctx)
       ```

    Update `backend/tests/unit/test_085_tool_registration.py` (created in Plan 01) to add a ToolContext defaults test:
    ```python
    @pytest.mark.asyncio
    async def test_tool_context_default_new_fields():
        from backend.app.services.tool_dispatcher import ToolContext
        from unittest.mock import AsyncMock
        ctx = ToolContext(
            redis=None, run_id=None, thread_id="t", supabase=None, pool=None,
            user_settings=None, current_user={"id": "u"},
            folder_subtree_ids=None, scoped_folder_path=None,
            emit=AsyncMock(), spawn=lambda c: None,
        )
        assert ctx.parent_run_id is None
        assert ctx.per_run_task_semaphore is None
        assert ctx.available_tools == []
        assert ctx.tool_call_id == ""
    ```
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/unit/test_085_tool_registration.py -x ; grep -q "_per_run_task_semaphore = asyncio.Semaphore" backend/app/api/threads.py ; grep -q "per_run_task_semaphore=_per_run_task_semaphore" backend/app/api/threads.py ; grep -q "tool_ctx.tool_call_id" backend/app/api/threads.py ; cd backend && python -m pytest tests/unit/test_tool_dispatcher.py -x</automated>
  </verify>
  <acceptance_criteria>
    - ToolContext has 4 new fields with safe defaults: `parent_run_id`, `per_run_task_semaphore`, `available_tools`, `tool_call_id`
    - `grep -q "parent_run_id" backend/app/services/tool_dispatcher.py` matches in ToolContext block
    - `grep -q "per_run_task_semaphore" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "tool_call_id" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "_per_run_task_semaphore = asyncio.Semaphore" backend/app/api/threads.py` matches (init site)
    - `grep -q "available_tools=" backend/app/api/threads.py` matches (population in ToolContext construction)
    - `grep -q "tool_ctx.tool_call_id" backend/app/api/threads.py` matches (per-tool-call assignment)
    - `cd backend && pytest tests/unit/test_085_tool_registration.py -x` exits 0
    - `cd backend && pytest tests/unit/test_tool_dispatcher.py -x` exits 0 (no regression on existing 21 handlers)
  </acceptance_criteria>
  <done>ToolContext carries the 4 new fields with safe defaults; agent_runner populates them correctly; existing handlers unchanged.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Implement task_service.py — concurrency cap helpers + sub-agent loop with SSE emit discipline</name>
  <files>
    backend/app/services/task_service.py,
    backend/tests/unit/test_085_task_service.py,
    backend/tests/integration/test_085_concurrency.py,
    backend/tests/integration/test_085_sub_agent_emit.py
  </files>
  <read_first>
    backend/app/services/sub_agent_service.py (FULL file — reference shape; DO NOT EDIT),
    backend/app/api/threads.py (lines 109-141 — _emit and _emit_terminal; lines 1700-2400 — agent_runner stream consumption shape; lines 2989-3097 — _shielded_finalize 5-step discipline),
    backend/app/db/runs.py (lines 1-103 — insert_run extended in Plan 01, finalize_run),
    backend/app/services/openai_service.py (lines 651-680 — get_tools + create_adaptive_streaming_chat call shape),
    backend/app/dependencies.py (lines 26-100 — get_redis singleton + get_pg_pool),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§B.3 — concurrency Lua + §B.4 — sub-agent loop sketch + §R9),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on task_service.py analogs A + B)
  </read_first>
  <behavior>
    - Test 1 (unit): `acquire_global_task_slot(redis_mock, max_concurrent=20)` returns True when Lua script returns 1; False when it returns 0
    - Test 2 (unit): `release_global_task_slot(redis_mock)` calls `redis.decr("tasks:global:active")`
    - Test 3 (integration, mocked Redis + pool): `run_task_sub_agent` calls `insert_run` with `parent_run_id=parent_ctx.run_id`
    - Test 4 (integration, mocked Redis): emits `sub_agent_start` on parent's stream (parent_ctx.run_id) BEFORE the loop begins
    - Test 5 (integration, mocked Redis): emits `sub_agent_done` on parent's stream AFTER loop completion (in finally)
    - Test 6 (integration, mocked Redis): sub-agent's internal tool calls (via dispatch_tool) execute against sub_ctx whose `run_id == sub_run_id` (NOT parent's run_id)
    - Test 7 (integration, mocked Redis): on exception in sub-agent loop, `finalize_run(status='error')` is called in finally block
    - Test 8 (integration, mocked Redis): sub_ctx.previous_files_in_run is a fresh empty dict (`sub_ctx.previous_files_in_run is not parent_ctx.previous_files_in_run`)
  </behavior>
  <action>
    Create `backend/app/services/task_service.py` per RESEARCH §B.3-B.4 and PATTERNS analogs:

    ```python
    """Phase 085 D-085-08..16 — task() sub-agent service.

    Spawns a sub-agent with constrained toolset, 1-level nesting cap (via
    parent_run_id), per-run + global concurrency caps. Own runs row + own
    SSE Stream run:{sub_run_id}. Parent's run:{parent_run_id} only sees
    sub_agent_start/done bookend events.

    Cross-provider model safety: resolve_sub_agent_model_safely mirrors
    sub_agent_service.py:62-89 (D-075.5-04 footgun mitigation).
    """
    from __future__ import annotations

    import asyncio
    import logging
    from datetime import datetime, timezone
    from uuid import UUID, uuid4

    from app.config import settings
    from app.dependencies import get_pg_pool
    from app.db.runs import insert_run, finalize_run
    from app.services.openai_service import get_tools, create_adaptive_streaming_chat
    from app.services.sub_agent_models import resolve_sub_agent_model_safely
    from app.services.tool_dispatcher import ToolContext, dispatch_tool

    logger = logging.getLogger(__name__)


    # --- Global concurrency cap helpers (D-085-15) ---

    _ACQUIRE_LUA = """
    local cur = redis.call('GET', KEYS[1])
    if cur and tonumber(cur) >= tonumber(ARGV[1]) then return 0 end
    redis.call('INCR', KEYS[1])
    redis.call('EXPIRE', KEYS[1], ARGV[2])
    return 1
    """


    async def acquire_global_task_slot(redis, max_concurrent: int) -> bool:
        """Lua-atomic INCR with cap + EXPIRE (TTL 7200s — crash-safety per RESEARCH §B.3)."""
        try:
            result = await redis.eval(
                _ACQUIRE_LUA, 1, "tasks:global:active", str(max_concurrent), "7200"
            )
            return bool(int(result))
        except Exception:
            logger.exception("acquire_global_task_slot failed")
            return False


    async def release_global_task_slot(redis) -> None:
        """DECR the global counter. EXPIRE TTL handles eventual cleanup of any drift."""
        try:
            await redis.decr("tasks:global:active")
        except Exception:
            logger.exception("release_global_task_slot failed")


    # --- Sub-agent loop (D-085-08..16) ---

    def _build_sub_agent_system_prompt(
        description: str, instructions: str | None, allowed_tools: list[str],
    ) -> str:
        """Server-controlled base prompt + appended task-specific instructions per D-085-08."""
        base = (
            "You are a focused sub-agent spawned to complete a specific task. "
            f"Your task: {description}\n\n"
            f"Available tools: {', '.join(sorted(allowed_tools)) or 'none'}\n"
            "You CANNOT call task(), ask_user(), or write_todos(). "
            "When done, produce a concise final message summarizing what you accomplished."
        )
        if instructions:
            return base + "\n\nTask-specific guidance:\n" + instructions
        return base


    async def run_task_sub_agent(
        *,
        parent_ctx: ToolContext,
        description: str,
        instructions: str | None,
        allowed_tools: list[str],
        max_steps: int,
    ) -> dict:
        """Returns {"sub_run_id": uuid, "summary": str, "status": "completed"|"error"}.

        Mirrors sub_agent_service.py shape but with own runs row + own tool-loop
        + parent-stream bookend emits (RESEARCH §B.4 + R9).
        """
        sub_run_id = uuid4()
        pool = await get_pg_pool()

        effective_model = resolve_sub_agent_model_safely(
            parent_ctx.user_settings,
            override_model=None,                                # D-085-11 — no LLM override
            fallback_model=parent_ctx.model,
        )

        # 1. Create sub-agent's runs row WITH parent_run_id
        provider = (
            parent_ctx.user_settings.active_provider
            if parent_ctx.user_settings else None
        )
        await insert_run(
            pool=pool,
            run_id=sub_run_id,
            thread_id=UUID(parent_ctx.thread_id),
            user_id=UUID(parent_ctx.current_user["id"]),
            status="streaming",
            model=effective_model,
            provider=provider,
            parent_run_id=parent_ctx.run_id,
        )

        # 2. Emit sub_agent_start on PARENT's stream
        await parent_ctx.emit(
            parent_ctx.redis, parent_ctx.run_id, 'sub_agent_start',
            sub_run_id=str(sub_run_id),
            description=description,
            tools=allowed_tools,
            max_steps=max_steps,
        )

        # 3. Build sub-agent's ToolContext — parent_run_id non-null, fresh previous_files dict
        sub_ctx = ToolContext(
            redis=parent_ctx.redis,
            run_id=sub_run_id,
            thread_id=parent_ctx.thread_id,
            supabase=parent_ctx.supabase,
            pool=parent_ctx.pool,
            user_settings=parent_ctx.user_settings,
            current_user=parent_ctx.current_user,
            folder_subtree_ids=parent_ctx.folder_subtree_ids,
            scoped_folder_path=parent_ctx.scoped_folder_path,
            emit=parent_ctx.emit,
            spawn=parent_ctx.spawn,
            model=effective_model,
            previous_files_in_run={},                            # Pitfall 7 — fresh dict
            parent_run_id=parent_ctx.run_id,                      # non-null causes _handle_task short-circuit
            per_run_task_semaphore=parent_ctx.per_run_task_semaphore,
            available_tools=allowed_tools,
        )

        # 4. Minimal sub-agent loop
        messages = [
            {"role": "system", "content": _build_sub_agent_system_prompt(description, instructions, allowed_tools)},
            {"role": "user", "content": description},
        ]
        summary = ""
        content = ""
        final_status = "completed"
        error_msg: str | None = None

        try:
            sub_tool_schemas = [
                t for t in get_tools(parent_ctx.user_settings)
                if t["function"]["name"] in allowed_tools
            ]

            for step in range(max_steps):
                await parent_ctx.emit(parent_ctx.redis, sub_run_id, 'iteration_start', iteration=step)

                content, tool_calls = await _stream_one_iteration(
                    messages=messages,
                    tools=sub_tool_schemas,
                    model=effective_model,
                    user_settings=parent_ctx.user_settings,
                )

                if not tool_calls:
                    summary = content or ""
                    break

                # Dispatch each tool via the shared dispatcher with sub_ctx
                tool_results = []
                for idx, tc in enumerate(tool_calls):
                    sub_ctx.tool_call_id = tc.get("id", "")
                    sub_ctx.tool_index = idx
                    tr = await dispatch_tool(tc["name"], tc.get("args") or {}, sub_ctx)
                    tool_results.append({
                        "role": "tool",
                        "tool_call_id": tc.get("id", ""),
                        "content": tr.result,
                    })

                messages.append({"role": "assistant", "content": content, "tool_calls": tool_calls})
                messages.extend(tool_results)
            else:
                # max_steps exhausted without producing a tool-free final answer
                summary = content or "Sub-agent reached max_steps without producing a final answer."

        except Exception as e:
            logger.exception("task_service sub-agent loop failed (sub_run_id=%s)", sub_run_id)
            final_status = "error"
            error_msg = str(e)
            summary = f"Sub-agent failed: {e}"
        finally:
            # Finalize sub-agent's runs row
            try:
                await finalize_run(
                    pool=pool,
                    run_id=sub_run_id,
                    status=final_status,
                    error=error_msg,
                    completed_at=datetime.now(timezone.utc),
                    message_id=None,
                    input_tokens=None,
                    output_tokens=None,
                )
            except Exception:
                logger.exception("finalize_run failed for sub_run_id=%s", sub_run_id)
            # Terminal sentinel on sub-agent's stream
            try:
                from app.api.threads import _emit_terminal  # noqa: PLC0415 — avoid circular import at module level
                await _emit_terminal(
                    parent_ctx.redis, sub_run_id,
                    "done" if final_status == "completed" else "error",
                )
            except Exception:
                logger.exception("_emit_terminal failed for sub_run_id=%s", sub_run_id)
            # sub_agent_done on PARENT's stream
            try:
                await parent_ctx.emit(
                    parent_ctx.redis, parent_ctx.run_id, 'sub_agent_done',
                    sub_run_id=str(sub_run_id),
                    status=final_status,
                    summary=summary,
                )
            except Exception:
                logger.exception("sub_agent_done emit failed for sub_run_id=%s", sub_run_id)

        return {"sub_run_id": sub_run_id, "summary": summary, "status": final_status}


    async def _stream_one_iteration(
        *, messages, tools, model, user_settings,
    ) -> "tuple[str, list[dict]]":
        """Consume one streaming completion; return (final_content_text, tool_calls_list).

        Mirrors the agent_runner stream consumption logic. EXECUTOR: read
        backend/app/api/threads.py lines 1700-2400 for the exact chunk shape +
        delta-accumulation pattern + tool-call extraction from create_adaptive_streaming_chat,
        and re-use it here.
        """
        full_text_parts: list[str] = []
        tool_calls: list[dict] = []
        async for chunk in create_adaptive_streaming_chat(
            messages=messages,
            tools=tools,
            model=model,
            user_settings=user_settings,
        ):
            if (delta := chunk.get("content")):
                full_text_parts.append(delta)
            for tc in chunk.get("tool_calls", []) or []:
                tool_calls.append(tc)
        return "".join(full_text_parts), tool_calls
    ```

    EXECUTOR NOTE: The exact chunk shape from `create_adaptive_streaming_chat` is provider-routed. Read `backend/app/api/threads.py:1700-2400` to confirm the delta-accumulation + tool-call-extraction pattern used by agent_runner today, and mirror it here. If `create_adaptive_streaming_chat` is NOT an async iterator but instead a function that returns the complete (content, tool_calls) tuple, simplify `_stream_one_iteration` to a single await.

    Write integration tests in `backend/tests/integration/test_085_concurrency.py` for Tests 1-2, 7. Write tests in `backend/tests/integration/test_085_sub_agent_emit.py` for Tests 3-6, 8.

    Use:
    - `unittest.mock.AsyncMock` for Redis (configure `.eval` to return 1 for "slot acquired", 0 for "cap reached"; `.decr` as AsyncMock)
    - `unittest.mock.AsyncMock` for asyncpg pool (patch `get_pg_pool` to return a mock with `.execute` AsyncMock)
    - `unittest.mock.AsyncMock` for `parent_ctx.emit`; capture `call_args_list` and assert tuples like `(parent_ctx.redis, parent_ctx.run_id, 'sub_agent_start', ...)`
    - Patch `_stream_one_iteration` (or `create_adaptive_streaming_chat`) to yield a single empty tool_calls chunk, so the loop ends on iteration 0 (Tests 3-5, 7-8 don't depend on real LLM calls)
    - For Test 6: patch `dispatch_tool` to record `ctx.run_id` when called; assert it equals `sub_run_id` (NOT parent's run_id)
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/integration/test_085_concurrency.py tests/integration/test_085_sub_agent_emit.py -x ; grep -q "async def run_task_sub_agent" backend/app/services/task_service.py ; grep -q "tasks:global:active" backend/app/services/task_service.py ; grep -q "resolve_sub_agent_model_safely" backend/app/services/task_service.py ; grep -q "previous_files_in_run={}" backend/app/services/task_service.py</automated>
  </verify>
  <acceptance_criteria>
    - `backend/app/services/task_service.py` exists
    - `grep -q "async def run_task_sub_agent" backend/app/services/task_service.py` matches
    - `grep -q "async def acquire_global_task_slot" backend/app/services/task_service.py` matches
    - `grep -q "async def release_global_task_slot" backend/app/services/task_service.py` matches
    - `grep -q "tasks:global:active" backend/app/services/task_service.py` matches
    - `grep -q "resolve_sub_agent_model_safely" backend/app/services/task_service.py` matches (imports from sub_agent_models)
    - `grep -q "'sub_agent_start'" backend/app/services/task_service.py` matches
    - `grep -q "'sub_agent_done'" backend/app/services/task_service.py` matches
    - `grep -q "parent_run_id=parent_ctx.run_id" backend/app/services/task_service.py` matches (sub_ctx construction)
    - `grep -q "previous_files_in_run={}" backend/app/services/task_service.py` matches (Pitfall 7)
    - `grep -q "finalize_run" backend/app/services/task_service.py` matches (within try/finally)
    - All 8 behavior tests pass: `cd backend && pytest tests/integration/test_085_concurrency.py tests/integration/test_085_sub_agent_emit.py -x` exits 0
    - `backend/app/services/sub_agent_service.py` is unmodified (D-085-16 hard freeze) — `git diff backend/app/services/sub_agent_service.py` empty
  </acceptance_criteria>
  <done>task_service.py ships with full sub-agent loop, concurrency caps, parent_run_id propagation, fresh previous_files dict, finalize_run discipline, and correct parent vs sub stream emit routing.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 4: Register _handle_task in tool_dispatcher with toolset validation, nesting cap, and concurrency-cap-gated spawn</name>
  <files>
    backend/app/services/tool_dispatcher.py,
    backend/tests/unit/test_085_task_service.py,
    backend/tests/integration/test_085_concurrency.py
  </files>
  <read_first>
    backend/app/services/tool_dispatcher.py (lines 865-1006 — workspace handler analogs; lines 1013-1036 — _TOOL_REGISTRY),
    backend/app/services/task_service.py (just created — entry points + concurrency helpers),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§B.1 — toolset validation; §B.3 — concurrency caps),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (section on tool_dispatcher.py — _handle_task block)
  </read_first>
  <behavior>
    - Test 1: `_handle_task` with `ctx.parent_run_id != None` returns `ToolResult` whose `result` contains `"1-level nesting cap"` (does NOT spawn sub-agent)
    - Test 2: `_handle_task` with empty/missing `description` returns `ToolResult` containing `"description"`
    - Test 3: `_handle_task` with `tools=["task"]` (excluded) returns `ToolResult` containing `"refused"` (or `"not available"`)
    - Test 4: `_handle_task` with `tools=["nonexistent_tool"]` returns `ToolResult` containing `"refused"`
    - Test 5: `_handle_task` with `tools=None` uses the DEFAULT_READ_ONLY intersection with ctx.available_tools
    - Test 6: `_handle_task` with `max_steps=20` is clamped to `settings.task_max_steps` (default 10)
    - Test 7: `_handle_task` per-run cap — 4 simultaneous calls, the 4th returns `ToolResult` containing `"per-run concurrency"` (semaphore at 3 saturated)
    - Test 8: `_handle_task` global cap — when `acquire_global_task_slot` returns False, returns `ToolResult` containing `"concurrency limit reached"`
    - Test 9: `_handle_task` happy path — spawns `run_task_sub_agent`, awaits, returns `ToolResult(result=<summary text>)`
    - Test 10: `_TOOL_REGISTRY["task"]` equals `_handle_task`
    - Test 11: After a call that ACQUIRED a slot, the corresponding RELEASE is called in finally
  </behavior>
  <action>
    Add `_handle_task` to `backend/app/services/tool_dispatcher.py`:

    ```python
    # Module-level constants — Phase 085
    _SUB_AGENT_DEFAULT_READ_ONLY = frozenset({
        "search_documents", "query_documents", "read_document",
        "web_search", "ls", "tree", "grep", "glob",
        "analyze_document", "query_tables",
        "workspace_read", "workspace_list",
    })
    _SUB_AGENT_EXCLUDED = frozenset({"task", "ask_user", "write_todos"})


    async def _handle_task(args: dict, ctx: ToolContext) -> ToolResult:
        """Phase 085 D-085-08..16 — task() spawns a sub-agent."""
        # D-085-12 — 1-level nesting cap (HARD GATE — first check)
        if ctx.parent_run_id is not None:
            return ToolResult(result="task() unavailable inside a sub-agent — 1-level nesting cap")

        description = (args.get("description") or "").strip()
        if not description:
            return ToolResult(result="task() requires a non-empty description argument")

        instructions = args.get("instructions")
        requested_tools = args.get("tools")
        max_steps_arg = args.get("max_steps")

        # D-085-09 — toolset subset validation
        available = set(ctx.available_tools or [])
        if requested_tools is None:
            sub_tools = sorted(available & _SUB_AGENT_DEFAULT_READ_ONLY)
        else:
            invalid = [
                t for t in requested_tools
                if t not in available or t in _SUB_AGENT_EXCLUDED
            ]
            if invalid:
                return ToolResult(
                    result=f"task() refused: tools {invalid} not available to sub-agent "
                           "(must be subset of parent's available_tools, excluding task/ask_user/write_todos)"
                )
            sub_tools = [t for t in requested_tools if t not in _SUB_AGENT_EXCLUDED]

        if not sub_tools:
            return ToolResult(result="task() refused: no usable tools after subset filter")

        # D-085-10 — max_steps clamping
        from app.config import settings  # noqa: PLC0415
        if max_steps_arg is None:
            max_steps = 5
        else:
            try:
                max_steps = max(1, min(int(max_steps_arg), settings.task_max_steps))
            except (TypeError, ValueError):
                return ToolResult(result="task() max_steps must be a positive integer")

        # D-085-15 — Per-run concurrency cap (non-blocking try-acquire)
        sem = ctx.per_run_task_semaphore
        if sem is None:
            return ToolResult(result="task() unavailable: per-run semaphore not initialized")
        try:
            await asyncio.wait_for(sem.acquire(), timeout=0)
        except asyncio.TimeoutError:
            return ToolResult(result="task() per-run concurrency limit reached")

        # D-085-15 — Global concurrency cap (Redis Lua atomic INCR)
        from app.services.task_service import (  # noqa: PLC0415
            acquire_global_task_slot, release_global_task_slot, run_task_sub_agent,
        )

        global_acquired = await acquire_global_task_slot(
            ctx.redis, settings.task_global_concurrency,
        )
        if not global_acquired:
            try:
                sem.release()
            except (ValueError, RuntimeError):
                pass
            return ToolResult(
                result=f"task() concurrency limit reached — global cap of "
                       f"{settings.task_global_concurrency} active sub-agents"
            )

        # Spawn — try/finally guarantees release of BOTH slots
        try:
            result = await run_task_sub_agent(
                parent_ctx=ctx,
                description=description,
                instructions=instructions,
                allowed_tools=sub_tools,
                max_steps=max_steps,
            )
        finally:
            try:
                sem.release()
            except (ValueError, RuntimeError):
                logger.exception("per-run semaphore release failed")
            try:
                await release_global_task_slot(ctx.redis)
            except Exception:
                logger.exception("global task slot release failed")

        # D-085-13 — return summary text only
        return ToolResult(result=result.get("summary") or "")
    ```

    Add to `_TOOL_REGISTRY` (next to the write_todos entry from Plan 01):
    ```python
        "task": _handle_task,
    ```

    Ensure `import asyncio` and `import logging` (and `logger = logging.getLogger(__name__)`) are present in tool_dispatcher.py — they should be from prior phases; verify.

    Update tests:
    - `test_085_task_service.py`: cover Tests 1-6, 9 by mocking `ctx.per_run_task_semaphore` with a real `asyncio.Semaphore(3)`, mocking `ctx.redis` with `AsyncMock` (eval returns 1 for acquire-success path), and patching `task_service.run_task_sub_agent` to return `{"summary": "ok", "status": "completed", "sub_run_id": uuid4()}`. Assert Test 10 by reading `_TOOL_REGISTRY` and confirming `_TOOL_REGISTRY["task"] is _handle_task`.
    - `test_085_concurrency.py`: cover Tests 7, 8, 11. For Test 7: spawn 4 coroutines awaiting `_handle_task` on the same ctx (Semaphore(3)) with `run_task_sub_agent` patched to sleep 1s; assert the 4th returns the per-run-cap error. For Test 8: patch `acquire_global_task_slot` to return False; assert the result text + that `sem.release()` was called.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/unit/test_085_task_service.py tests/integration/test_085_concurrency.py -x ; grep -q "\"task\": _handle_task" backend/app/services/tool_dispatcher.py ; grep -q "1-level nesting cap" backend/app/services/tool_dispatcher.py ; grep -q "_SUB_AGENT_EXCLUDED" backend/app/services/tool_dispatcher.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "async def _handle_task" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "\"task\": _handle_task" backend/app/services/tool_dispatcher.py` matches (registry entry)
    - `grep -q "1-level nesting cap" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "_SUB_AGENT_EXCLUDED" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "_SUB_AGENT_DEFAULT_READ_ONLY" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "per-run concurrency limit" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "global cap of" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "release_global_task_slot" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "asyncio.wait_for(sem.acquire" backend/app/services/tool_dispatcher.py` matches (non-blocking try-acquire)
    - All 11 behavior tests pass: `cd backend && pytest tests/unit/test_085_task_service.py tests/integration/test_085_concurrency.py -x` exits 0
    - Registry size is now 23 entries (21 existing + write_todos from Plan 01 + task from this plan)
  </acceptance_criteria>
  <done>_handle_task wired with nesting cap, toolset validation, per-run + global concurrency caps, and finally-block release discipline. Sub-agent spawn path returns the summary text per D-085-13.</done>
</task>

</tasks>

<verification>
- VALIDATION.md sampling rate:
  - Per-task: `cd backend && pytest tests/unit/test_085_*.py -x` exits 0
  - Per-wave (this plan): `cd backend && pytest -x -k "085_task or 085_concurrency or 085_sub_agent_emit"` exits 0 within 30s
- `backend/app/services/sub_agent_service.py` unmodified across the whole plan: `git diff backend/app/services/sub_agent_service.py` returns empty
- Existing analyze_document path still passes its tests (`cd backend && pytest tests/ -x -k "analyze_document"` exits 0) — proves D-085-16 freeze didn't break anything
- ToolContext defaults: a fresh ToolContext built with the old required-args set constructs with all 4 new fields at safe defaults (no TypeError)
- Threats T-085-T6 through T-085-T11 all map to specific tasks above and have automated assertions
</verification>

<success_criteria>
1. `task()` returns a summary string when invoked normally; returns the exact error strings above when nesting cap / toolset / concurrency cap / max_steps validation fails.
2. Sub-agent's `runs` row exists with `parent_run_id = <parent_run_id>` (verifiable via SQL after a UAT run).
3. `sub_agent_start{sub_run_id, description, tools, max_steps}` SSE event appears on parent's `run:{parent_run_id}` stream exactly once per task() call.
4. `sub_agent_done{sub_run_id, status, summary}` SSE event appears on parent's stream exactly once (in finally block).
5. Sub-agent's internal tool calls (e.g. `search_documents` invoked by the sub-agent) emit on `run:{sub_run_id}` stream — NOT on parent's stream. Phase 086 demuxer will rely on this routing.
6. 4-concurrent-task() stress: 3 succeed, 4th returns per-run concurrency error.
7. 21-concurrent-task() stress (mocked Redis eval): 20 succeed, 21st returns global concurrency error.
8. `sub_agent_service.py` is byte-identical to pre-Plan-02 state (`git diff` empty).
9. Cross-provider routing: when user_settings.active_provider="openai" and an attempted override is a non-OpenAI model, `resolve_sub_agent_model_safely` returns an OpenAI-safe fallback (D-075.5-04 footgun closed for task path).
</success_criteria>

<output>
After completion, create `.planning/phases/085-new-llm-tools/085-02-task-service-SUMMARY.md` per `.claude/get-shit-done/templates/summary.md` documenting: what landed (task_service + sub_agent_models + 4 ToolContext fields + Settings fields + concurrency caps), how the cross-provider footgun is mitigated (sub_agent_models replicates sub_agent_service.py:62-89), and why the sub-agent's internal tool dispatch routes events to `run:{sub_run_id}` (R9 + R10 — Phase 086 demux contract).
</output>
