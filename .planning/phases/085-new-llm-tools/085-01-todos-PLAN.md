---
phase: 085-new-llm-tools
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/055_todos_table.sql
  - supabase/full-schema.sql
  - backend/app/services/todos_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/app/db/runs.py
  - backend/tests/unit/test_085_todos_service.py
  - backend/tests/unit/test_085_tool_registration.py
autonomous: false
requirements:
  - TOOL-01
requirements_addressed:
  - TOOL-01
tags:
  - backend
  - migration
  - tool-dispatcher
  - todos
  - phase-085
user_setup:
  - service: supabase-local-studio
    why: "Apply migration 055 to live local DB via SQL editor (CLAUDE.md project rule — never supabase db push/db reset)"
    dashboard_config:
      - task: "Paste contents of supabase/migrations/055_todos_table.sql into Supabase SQL editor and run"
        location: "Supabase Studio local URL → SQL editor"

must_haves:
  truths:
    - "Agent calling write_todos persists a todo list per-thread; reload returns the same list"
    - "Migration 055 is live in local DB — \\d todos shows 9 columns + RLS enabled"
    - "Migration 055 adds runs.parent_run_id column (FK to runs.run_id, ON DELETE SET NULL)"
    - "messages.tool_calls jsonb column carries a doc-comment listing ask_user_prompt + ask_user_response kind values"
    - "Concurrent write_todos calls do not interleave (single transaction)"
    - "RLS prevents user X from reading user Y's todos"
    - "Tool registry has write_todos handler (entry: 22 of eventual 24)"
  artifacts:
    - path: "supabase/migrations/055_todos_table.sql"
      provides: "todos table DDL + RLS + runs.parent_run_id column + messages.tool_calls.kind doc-comment"
      contains: "CREATE TABLE public.todos"
    - path: "backend/app/services/todos_service.py"
      provides: "replace_todos() async function — full-state-replace transaction"
      exports: ["replace_todos"]
    - path: "backend/app/services/tool_dispatcher.py"
      provides: "_handle_write_todos handler + write_todos registry entry"
      contains: "\"write_todos\": _handle_write_todos"
    - path: "backend/app/db/runs.py"
      provides: "insert_run extended with parent_run_id kwarg"
      contains: "parent_run_id"
    - path: "backend/tests/unit/test_085_todos_service.py"
      provides: "Unit tests for replace_todos transaction + validation"
  key_links:
    - from: "tool_dispatcher.py:_handle_write_todos"
      to: "todos_service.py:replace_todos"
      via: "import inside handler (lazy import; matches Phase 084 _handle_workspace_write pattern)"
      pattern: "from app.services.todos_service import replace_todos"
    - from: "tool_dispatcher.py:_handle_write_todos"
      to: "Redis Stream run:{run_id} via _emit"
      via: "await ctx.emit(ctx.redis, ctx.run_id, 'todo_updated', todos=todos_payload)"
      pattern: "todo_updated"
    - from: "supabase/migrations/055_todos_table.sql"
      to: "auth.uid() via threads FK chain"
      via: "RLS policy USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id))"
      pattern: "auth.uid\\(\\) = \\(SELECT user_id FROM threads"
---

<objective>
Ship migration 055 (todos table + runs.parent_run_id column + messages.tool_calls.kind doc-comment), the todos service module, and the write_todos tool handler. This plan owns the SQL editor step and the foundation Plan 02 depends on (runs.parent_run_id).

Purpose: Deliver TOOL-01 — agent can manage a persistent per-thread todo list with SSE emit, plus seat the runs.parent_run_id column that Plan 02's sub-agent service needs.

Output: 1 migration (applied via SQL editor), 1 new service file, 1 new dispatcher handler + registry entry, 1 extended db/runs.py signature, 2 new test files, regenerated full-schema.sql.
</objective>

<execution_context>
@.claude/get-shit-done/workflows/execute-plan.md
@.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@CLAUDE.md
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/phases/085-new-llm-tools/085-CONTEXT.md
@.planning/phases/085-new-llm-tools/085-RESEARCH.md
@.planning/phases/085-new-llm-tools/085-PATTERNS.md
@.planning/phases/085-new-llm-tools/085-VALIDATION.md
@supabase/migrations/054_workspace_files.sql
@backend/app/services/tool_dispatcher.py
@backend/app/services/workspace_service.py
@backend/app/db/runs.py
@backend/tests/unit/test_tool_dispatcher.py

<interfaces>
<!-- Key contracts the executor needs. Extracted from codebase + CONTEXT.md decisions. -->

From `backend/app/services/tool_dispatcher.py` (Phase 083+084 baseline — extended by this plan):
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

@dataclass
class ToolResult:
    result: str
    is_error: bool = False

_TOOL_REGISTRY: dict[str, Callable] = { ... 21 existing entries ... }
async def dispatch_tool(tool_name, args, ctx) -> ToolResult
```

From `backend/app/db/runs.py` (current signature — extend in Task 4):
```python
async def insert_run(pool, *, run_id, thread_id, user_id, status, model, provider, spawned_by_worker=None):
    await pool.execute(
        "INSERT INTO runs (run_id, thread_id, user_id, status, model, provider, spawned_by_worker) "
        "VALUES ($1, $2, $3, $4, $5, $6, $7)",
        run_id, thread_id, user_id, status, model, provider, spawned_by_worker,
    )
```

Decision IDs implemented in this plan:
- D-085-17: write_todos signature → `write_todos(todos: list[Todo]) -> {accepted: int, version: int}`
- D-085-18: full-state-replace (DELETE + INSERT in one transaction)
- D-085-19: status enum = pending | in_progress | completed
- D-085-20: optional parent_id column for nesting
- D-085-21: SSE `todo_updated{todos: [...]}` full list
- D-085-22: dedicated todos table with FK-chain RLS
- D-085-14 (column-only): runs.parent_run_id added now so Plan 02 doesn't need its own migration
- D-085-05 (doc-only): messages.tool_calls.kind extended values documented in COMMENT
</interfaces>
</context>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client → API (write_todos via LLM tool call) | LLM-emitted todos arrive via tool_call args; status enum + ids untrusted until validated |
| client → DB (RLS-enforced reads) | user A must not see user B's todos under any auth state |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-085-T1 | Tampering | `_handle_write_todos` status enum | medium | mitigate | Server-side pre-DB validation: reject any todo whose `status` is not in `{pending, in_progress, completed}` with `ToolResult(result="write_todos: invalid status ...")`. Enforced again at DB level via CHECK constraint in migration 055. (Task 1 SQL + Task 3 handler) |
| T-085-T2 | Information disclosure | `todos` table cross-user reads | high | mitigate | RLS policies (SELECT/INSERT/UPDATE/DELETE) gated by `auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)` — same FK-chain pattern proven on Phase 084 `workspace_files`. (Task 1) |
| T-085-T3 | Tampering | LLM emits arbitrary `tool_calls.kind` value in messages | low | mitigate (doc-only) | COMMENT on `messages.tool_calls` documents allowed `kind` values; service-layer code in Plans 03/04 validates kind against an allowlist before persisting. (Task 1 SQL comment) |
| T-085-T4 | DoS | Concurrent write_todos calls interleave DELETE+INSERT and lose data | medium | mitigate | Single asyncpg transaction (`async with conn.transaction():`) per call serializes via Postgres MVCC. (Task 2 — RESEARCH §C.2; Pitfall 6) |
| T-085-T5 | Tampering | parent_id references arbitrary todo_id outside the thread | low | accept | parent_id is a free-text column scoped within a thread; cross-thread reference is impossible because UNIQUE (thread_id, todo_id) constrains the namespace. Cycles/dangling parents are display-only concerns deferred to Phase 087's render. |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1 (Wave 0 — test scaffolding + migration authoring): Create migration 055 SQL file and test scaffolds</name>
  <files>
    supabase/migrations/055_todos_table.sql,
    backend/tests/unit/test_085_todos_service.py,
    backend/tests/unit/test_085_tool_registration.py
  </files>
  <read_first>
    supabase/migrations/054_workspace_files.sql,
    supabase/migrations/048_messages_allow_system_role.sql,
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§C.1 + §C.2 — migration SQL + transaction shape),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (`### supabase/migrations/055_todos_table.sql` section),
    backend/tests/unit/test_tool_dispatcher.py (registry assertion pattern)
  </read_first>
  <action>
    Per D-085-14 / D-085-19 / D-085-22 and RESEARCH §C.1, write `supabase/migrations/055_todos_table.sql` containing FOUR sections in this exact order:

    Section 1 — todos table:
    ```sql
    CREATE TABLE public.todos (
        id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
        thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
        todo_id text NOT NULL,
        content text NOT NULL,
        status text NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
        parent_id text,
        order_index integer NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT todos_thread_todo_unique UNIQUE (thread_id, todo_id)
    );
    CREATE INDEX idx_todos_thread ON public.todos(thread_id, order_index);
    ```

    Section 2 — RLS policies (mirror `054_workspace_files.sql` lines 37-53 verbatim, swap table name to `todos`): ENABLE ROW LEVEL SECURITY + 4 policies (SELECT/INSERT/UPDATE/DELETE) each with `USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id))` / `WITH CHECK (...)` for INSERT.

    Section 3 — runs.parent_run_id column (per D-085-14 + RESEARCH §B.2):
    ```sql
    ALTER TABLE public.runs
        ADD COLUMN parent_run_id uuid REFERENCES public.runs(run_id) ON DELETE SET NULL;
    CREATE INDEX idx_runs_parent ON public.runs(parent_run_id) WHERE parent_run_id IS NOT NULL;
    ```

    Section 4 — messages.tool_calls.kind doc-comment (per D-085-05 doc-only; RESEARCH §C.1):
    ```sql
    COMMENT ON COLUMN public.messages.tool_calls IS
    'JSONB array. For role=system rows, first element may carry a "kind" discriminator: '
    'context_truncated | iteration_cap_dropped_tool_calls (Phase 075.4) | '
    'ask_user_prompt | ask_user_response (Phase 085).';
    ```

    Filename must be exactly `055_todos_table.sql` — no letter suffix (CLAUDE.md hard rule).

    Then create Wave 0 test scaffolds:

    `backend/tests/unit/test_085_todos_service.py` — pytest async file with placeholder fixtures and one passing smoke import test:
    ```python
    import pytest
    from backend.app.services import todos_service  # will fail until Task 2 — Wave 0 sets up scaffolding

    @pytest.mark.asyncio
    async def test_module_imports():
        assert hasattr(todos_service, "replace_todos")
    ```
    (Will fail until Task 2 — that's expected RED for TDD.)

    `backend/tests/unit/test_085_tool_registration.py` (per VALIDATION.md Wave 0 list + PATTERNS analog test_tool_dispatcher.py):
    ```python
    from backend.app.services.tool_dispatcher import _TOOL_REGISTRY

    def test_write_todos_in_registry():
        assert "write_todos" in _TOOL_REGISTRY

    def test_registry_minimum_size_after_085_plan_01():
        # Plan 01 adds 1 tool (write_todos); plans 02 + 03 add 2 more.
        # This test asserts the lower bound; phase-end gate tightens to 24.
        assert len(_TOOL_REGISTRY) >= 22
    ```
  </action>
  <verify>
    <automated>test -f supabase/migrations/055_todos_table.sql && grep -q "CREATE TABLE public.todos" supabase/migrations/055_todos_table.sql && grep -q "parent_run_id uuid REFERENCES public.runs(run_id)" supabase/migrations/055_todos_table.sql && grep -q "ask_user_prompt | ask_user_response" supabase/migrations/055_todos_table.sql && grep -q "todos_thread_todo_unique" supabase/migrations/055_todos_table.sql && grep -q "CHECK (status IN" supabase/migrations/055_todos_table.sql && test -f backend/tests/unit/test_085_todos_service.py && test -f backend/tests/unit/test_085_tool_registration.py</automated>
  </verify>
  <acceptance_criteria>
    - `supabase/migrations/055_todos_table.sql` exists
    - File contains literal string `CREATE TABLE public.todos`
    - File contains literal `CHECK (status IN ('pending', 'in_progress', 'completed'))`
    - File contains literal `CONSTRAINT todos_thread_todo_unique UNIQUE (thread_id, todo_id)`
    - File contains 4 RLS policies for todos table (todos_select_own, todos_insert_own, todos_update_own, todos_delete_own)
    - File contains literal `ALTER TABLE public.runs` and `ADD COLUMN parent_run_id uuid REFERENCES public.runs(run_id) ON DELETE SET NULL`
    - File contains literal `CREATE INDEX idx_runs_parent`
    - File contains literal `COMMENT ON COLUMN public.messages.tool_calls`
    - File contains literal `ask_user_prompt | ask_user_response (Phase 085)` in the comment
    - `backend/tests/unit/test_085_todos_service.py` exists
    - `backend/tests/unit/test_085_tool_registration.py` exists and references `_TOOL_REGISTRY`
  </acceptance_criteria>
  <done>Migration file authored matching RESEARCH §C.1; Wave 0 test stubs created (will be RED until Tasks 2–3 ship).</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Implement todos_service.py with full-state-replace transaction + extend db/runs.py with parent_run_id</name>
  <files>
    backend/app/services/todos_service.py,
    backend/app/db/runs.py,
    backend/tests/unit/test_085_todos_service.py
  </files>
  <read_first>
    backend/app/services/workspace_service.py (lines 1-31 — imports + module pattern; service-layer style),
    backend/app/db/runs.py (lines 1-103 — insert_run/finalize_run current signatures),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§C.2 — replace_todos verbatim sketch),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (`### backend/app/services/todos_service.py` and runs.py extension notes),
    backend/tests/unit/test_tool_dispatcher.py (lines 1-117 — mocking conventions)
  </read_first>
  <behavior>
    - Test 1 — `replace_todos` empty list: passing `[]` deletes all rows for the thread; returns `{"accepted": 0, "version": <int>}`
    - Test 2 — `replace_todos` happy path: inserting 3 todos returns `{"accepted": 3, "version": <int>}`; SELECT returns 3 rows in `order_index` order
    - Test 3 — `replace_todos` full-state-replace: first call inserts 3 todos; second call with 1 todo replaces — final SELECT returns 1 row only
    - Test 4 — `replace_todos` transactional atomicity: simulated INSERT failure (duplicate todo_id within same payload) rolls back the DELETE (final state = pre-call state)
    - Test 5 — `insert_run` accepts `parent_run_id` kwarg; INSERT statement includes the column
    - Test 6 — `insert_run` with `parent_run_id=None` (default) still works for top-level runs (backward compat)
  </behavior>
  <action>
    Create `backend/app/services/todos_service.py` per RESEARCH §C.2 + PATTERNS analog:

    ```python
    """Phase 085 D-085-17..22 — write_todos full-state-replace service."""
    from __future__ import annotations

    import logging
    import time
    from typing import TYPE_CHECKING
    from uuid import UUID

    if TYPE_CHECKING:
        import asyncpg

    logger = logging.getLogger(__name__)


    _ALLOWED_STATUS = {"pending", "in_progress", "completed"}


    class TodosValidationError(ValueError):
        """Raised when todo payload validation fails. Handler converts to ToolResult."""


    async def replace_todos(pool: "asyncpg.Pool", thread_id: UUID, todos: list[dict]) -> dict:
        """Full-state-replace per D-085-18. DELETE all + INSERT new in a single transaction.

        Returns {"accepted": <count>, "version": <ms-timestamp>} per D-085-17.
        """
        # Pre-validate inside the function so concurrent callers can't slip through
        for t in todos:
            if not t.get("id") or not t.get("content"):
                raise TodosValidationError("each todo requires id and content")
            if t.get("status") not in _ALLOWED_STATUS:
                raise TodosValidationError(
                    f"invalid status {t.get('status')!r}; must be one of {sorted(_ALLOWED_STATUS)}"
                )

        async with pool.acquire() as conn:
            async with conn.transaction():
                await conn.execute("DELETE FROM todos WHERE thread_id = $1", thread_id)
                if todos:
                    rows = [
                        (
                            thread_id,
                            t["id"],
                            t["content"],
                            t["status"],
                            t.get("parent_id"),
                            int(t.get("order_index", 0)),
                        )
                        for t in todos
                    ]
                    await conn.executemany(
                        """INSERT INTO todos
                           (thread_id, todo_id, content, status, parent_id, order_index)
                           VALUES ($1, $2, $3, $4, $5, $6)""",
                        rows,
                    )
        return {"accepted": len(todos), "version": int(time.time() * 1000)}
    ```

    Then extend `backend/app/db/runs.py` `insert_run` signature to accept `parent_run_id: "UUID | None" = None`. Update the INSERT statement to include `parent_run_id` as the 8th column. KEEP backward compat: default `None` so all existing callers (16+) work without changes:

    ```python
    async def insert_run(
        pool,
        *,
        run_id,
        thread_id,
        user_id,
        status,
        model,
        provider,
        spawned_by_worker=None,
        parent_run_id=None,  # Phase 085 D-085-14 — non-null for sub-agent runs
    ):
        await pool.execute(
            "INSERT INTO runs (run_id, thread_id, user_id, status, model, provider, "
            "spawned_by_worker, parent_run_id) "
            "VALUES ($1, $2, $3, $4, $5, $6, $7, $8)",
            run_id, thread_id, user_id, status, model, provider, spawned_by_worker, parent_run_id,
        )
    ```

    Update `backend/tests/unit/test_085_todos_service.py` to cover the 6 behaviors above. Use `pytest-asyncio` patterns from existing tests; mock the asyncpg pool via `AsyncMock` (real Postgres not required at unit-test layer — the SQL was already validated at the migration layer).

    For tests that need real asyncpg semantics (Test 3, Test 4), use the integration-style fixture pattern from `backend/tests/conftest.py` if `pg_pool` fixture exists; if not, those two cases can use a mocked-pool that tracks call order.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/unit/test_085_todos_service.py -x</automated>
  </verify>
  <acceptance_criteria>
    - `backend/app/services/todos_service.py` exists
    - `grep -q "async def replace_todos" backend/app/services/todos_service.py` matches
    - `grep -q "async with conn.transaction" backend/app/services/todos_service.py` matches (atomicity per Pitfall 6)
    - `grep -q "DELETE FROM todos WHERE thread_id" backend/app/services/todos_service.py` matches
    - `grep -q "executemany" backend/app/services/todos_service.py` matches
    - `grep -q "TodosValidationError" backend/app/services/todos_service.py` matches
    - `backend/app/db/runs.py` insert_run signature includes `parent_run_id=None` kwarg
    - `grep -q "parent_run_id" backend/app/db/runs.py` matches in `insert_run` block
    - All 6 behavior tests pass: `cd backend && pytest tests/unit/test_085_todos_service.py -x` exits 0
  </acceptance_criteria>
  <done>Todos service ships with atomic full-state-replace; insert_run carries parent_run_id; unit tests green.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Register _handle_write_todos in tool_dispatcher + emit todo_updated SSE</name>
  <files>
    backend/app/services/tool_dispatcher.py,
    backend/tests/unit/test_085_tool_registration.py
  </files>
  <read_first>
    backend/app/services/tool_dispatcher.py (lines 1-77 — ToolContext/ToolResult dataclasses; lines 865-897 — _handle_workspace_write analog; lines 1013-1036 — _TOOL_REGISTRY),
    .planning/phases/085-new-llm-tools/085-RESEARCH.md (§C.3 — handler shape with validation + re-SELECT + emit),
    .planning/phases/085-new-llm-tools/085-PATTERNS.md (`### backend/app/services/tool_dispatcher.py` handler shapes — _handle_write_todos block)
  </read_first>
  <behavior>
    - Test 1 — `_handle_write_todos` with invalid status returns `ToolResult` whose `result` contains `"invalid status"`
    - Test 2 — `_handle_write_todos` with missing `id` returns `ToolResult` whose `result` contains `"requires id and content"`
    - Test 3 — `_handle_write_todos` happy path calls `replace_todos`, then re-SELECTs, then emits `'todo_updated'` SSE event with the todos array
    - Test 4 — `_handle_write_todos` happy path returns `ToolResult` containing JSON with `"accepted"` and `"version"` keys
    - Test 5 — `_TOOL_REGISTRY["write_todos"]` is `_handle_write_todos`
  </behavior>
  <action>
    Add `_handle_write_todos` to `backend/app/services/tool_dispatcher.py` matching the `_handle_workspace_write` analog shape (lines 865-897) and per RESEARCH §C.3:

    ```python
    async def _handle_write_todos(args: dict, ctx: ToolContext) -> ToolResult:
        """Phase 085 D-085-17..21 — write_todos handler.

        Validates payload, calls replace_todos, re-SELECTs canonical list, emits
        todo_updated SSE event with the full list, returns {accepted, version} JSON.
        """
        todos_in = args.get("todos") or []
        # Pre-DB validation — fast-fail with a friendly LLM-readable error
        for t in todos_in:
            if not t.get("id") or not t.get("content"):
                return ToolResult(result="write_todos: each todo requires id and content")
            if t.get("status") not in ("pending", "in_progress", "completed"):
                return ToolResult(
                    result=f"write_todos: invalid status {t.get('status')!r}; "
                           "must be pending|in_progress|completed"
                )

        from app.services.todos_service import replace_todos  # noqa: PLC0415  (lazy — mirrors workspace handlers)

        try:
            result = await replace_todos(ctx.pool, UUID(ctx.thread_id), todos_in)
        except Exception as e:  # noqa: BLE001 — broad catch returns to LLM cleanly
            logger.exception("write_todos: replace_todos failed for thread=%s", ctx.thread_id)
            return ToolResult(result=json.dumps({"error": f"write_todos failed: {e}"}))

        # Re-SELECT canonical list for SSE payload (RESEARCH §C.3)
        rows = await ctx.pool.fetch(
            "SELECT todo_id AS id, content, status, parent_id, order_index "
            "FROM todos WHERE thread_id = $1 ORDER BY order_index, created_at",
            UUID(ctx.thread_id),
        )
        todos_payload = [dict(r) for r in rows]

        await ctx.emit(
            ctx.redis, ctx.run_id, 'todo_updated',
            todos=todos_payload,
        )

        return ToolResult(result=json.dumps({
            "accepted": result["accepted"],
            "version": result["version"],
        }))
    ```

    Register in `_TOOL_REGISTRY` (find the existing dict at ~lines 1013-1036 and append before the closing brace):
    ```python
        # Phase 085 — D-085 new tools (write_todos = Plan 01; task + ask_user = Plans 02/03)
        "write_todos": _handle_write_todos,
    ```

    Update `backend/tests/unit/test_085_tool_registration.py` to cover the 5 behaviors. For Tests 1-4, use a `ToolContext` with mocked `pool` (AsyncMock that returns Empty list for `.fetch` after success) and a mocked `emit` (AsyncMock) — assert call shapes.
  </action>
  <verify>
    <automated>cd backend && python -m pytest tests/unit/test_085_tool_registration.py -x && grep -q "\"write_todos\": _handle_write_todos" backend/app/services/tool_dispatcher.py && grep -q "todo_updated" backend/app/services/tool_dispatcher.py</automated>
  </verify>
  <acceptance_criteria>
    - `grep -q "async def _handle_write_todos" backend/app/services/tool_dispatcher.py` matches
    - `grep -q "\"write_todos\": _handle_write_todos" backend/app/services/tool_dispatcher.py` matches (registry entry)
    - `grep -q "ctx.emit(ctx.redis, ctx.run_id, 'todo_updated'" backend/app/services/tool_dispatcher.py` matches (SSE event)
    - `grep -q "must be pending|in_progress|completed" backend/app/services/tool_dispatcher.py` matches (status enum error)
    - `grep -q "from app.services.todos_service import replace_todos" backend/app/services/tool_dispatcher.py` matches (lazy import)
    - All 5 behavior tests pass: `cd backend && pytest tests/unit/test_085_tool_registration.py -x` exits 0
    - Registry size increased by exactly 1 (write_todos)
  </acceptance_criteria>
  <done>_handle_write_todos handler is wired into the dispatcher, validates payload, emits SSE event, and registered in _TOOL_REGISTRY.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 4 [BLOCKING] human-action: Apply migration 055 via Supabase SQL editor + regenerate full-schema.sql</name>
  <files>supabase/migrations/055_todos_table.sql, supabase/full-schema.sql</files>
  <read_first>
    supabase/migrations/055_todos_table.sql (the migration file authored in Task 1 — paste its contents into the SQL editor),
    CLAUDE.md (Local dev infrastructure section — NEVER use supabase db push / db reset)
  </read_first>
  <action>
    This task requires the human operator to apply migration 055 to the live local DB via the Supabase Studio SQL editor (per CLAUDE.md project rule — `supabase db push` and `supabase db reset` would wipe dev data).

    **Steps for the operator:**
    1. Open Supabase Studio SQL editor at `http://127.0.0.1:54323` (or URL from `supabase status`)
    2. Copy the ENTIRE contents of `supabase/migrations/055_todos_table.sql`
    3. Paste into the SQL editor and click Run — verify no errors
    4. Run this validation query in the SQL editor:
       ```sql
       SELECT
         (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='todos') AS todos_table,
         (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='runs' AND column_name='parent_run_id') AS parent_run_id_col,
         (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='todos') AS rls_policies;
       ```
       Expected: `todos_table=1, parent_run_id_col=1, rls_policies=4`

    **After operator confirms "migration applied":**
    5. Executor runs `bash scripts/regenerate-full-schema.sh` (default — no `--reset` flag; preserves data)
    6. Executor verifies `grep -c "CREATE TABLE.*public.todos" supabase/full-schema.sql` returns 1
    7. Executor commits BOTH `supabase/migrations/055_todos_table.sql` AND `supabase/full-schema.sql`

    **Do NOT run `supabase db push` or `supabase db reset` anywhere in this task.**
  </action>
  <what-built>Migration 055 SQL authored in `supabase/migrations/055_todos_table.sql`. Service layer + dispatcher handler already shipped in Tasks 2-3 (will fail at runtime until DB has the table — that's expected).</what-built>
  <how-to-verify>
    1. Open your local Supabase Studio SQL editor (URL printed by `supabase status`; default `http://127.0.0.1:54323`).
    2. Copy the ENTIRE contents of `supabase/migrations/055_todos_table.sql` and paste into the SQL editor.
    3. Click **Run** — verify the result pane shows no errors. (Migration is idempotent against fresh DBs; if you've manually pre-created any object, you'll see a conflict — back out and tell Claude.)
    4. In the SQL editor, run this validation query:
       ```sql
       SELECT
         (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name='todos') AS todos_table,
         (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='runs' AND column_name='parent_run_id') AS parent_run_id_col,
         (SELECT COUNT(*) FROM pg_policies WHERE schemaname='public' AND tablename='todos') AS rls_policies;
       ```
       Expected result: `todos_table=1, parent_run_id_col=1, rls_policies=4`.
    5. From the repo root, run `bash scripts/regenerate-full-schema.sh` (defaults to live-DB dump, NO --reset flag — preserves data).
    6. Verify `supabase/full-schema.sql` was updated by running `grep -c "CREATE TABLE.*public.todos" supabase/full-schema.sql` — must return `1`.
    7. Confirm here when complete. Claude will then commit migration + regenerated schema.

    **Do NOT run `supabase db push` or `supabase db reset` — they will wipe your dev data (CLAUDE.md hard rule).**
  </how-to-verify>
  <resume-signal>Type "migration applied" once SQL editor query shows the expected counts AND `supabase/full-schema.sql` has been regenerated. If anything blocks, paste the error and Claude will diagnose.</resume-signal>
  <verify>
    <automated>grep -c "CREATE TABLE.*public.todos" supabase/full-schema.sql ; grep -c "parent_run_id uuid" supabase/full-schema.sql ; grep -c "todos_select_own" supabase/full-schema.sql</automated>
  </verify>
  <done>Migration 055 applied to live local DB via Supabase SQL editor; `supabase/full-schema.sql` regenerated via the no-reset script; both files staged for commit by the executor.</done>
</task>

</tasks>

<verification>
- After Task 4 confirmation:
  - `grep -c "CREATE TABLE public.todos" supabase/full-schema.sql` returns 1
  - `grep -c "parent_run_id uuid" supabase/full-schema.sql` returns ≥ 1
  - `grep -c "todos_select_own\|todos_insert_own\|todos_update_own\|todos_delete_own" supabase/full-schema.sql` returns 4
- Per-task sampling (VALIDATION.md):
  - After Task 2: `cd backend && pytest tests/unit/test_085_todos_service.py -x` exits 0
  - After Task 3: `cd backend && pytest tests/unit/test_085_tool_registration.py -x` exits 0
- Tool registry has `write_todos` entry: `grep -q '"write_todos": _handle_write_todos' backend/app/services/tool_dispatcher.py`
- No `supabase db push` or `supabase db reset` invocation anywhere in this plan's history (`git log --all --oneline | grep -i "db push\|db reset"` returns empty)
</verification>

<success_criteria>
1. Migration 055 is live in local Supabase: `\d todos` shows 9 columns + RLS enabled; `\d runs` shows `parent_run_id` column.
2. `replace_todos` runs as a single transaction (DELETE + INSERT atomic) — concurrent calls cannot leave todo rows from BOTH callers in the DB.
3. `_handle_write_todos` emits exactly one `todo_updated` SSE event per successful call, carrying the FULL canonical todo list in order.
4. RLS: a user impersonation test (insert into `todos` with `thread_id` belonging to another user) returns 0 rows from the SELECT-after-INSERT pattern (Phase 084 verified this works for `workspace_files`).
5. `_TOOL_REGISTRY` has `write_todos` key.
6. `supabase/full-schema.sql` regenerated and committed alongside migration 055.
</success_criteria>

<output>
After completion, create `.planning/phases/085-new-llm-tools/085-01-todos-SUMMARY.md` per `.claude/get-shit-done/templates/summary.md` documenting: what landed (migration + service + handler), what Plan 02 inherits (runs.parent_run_id column ready), and how Tasks 1-3 were RED before Task 4 (DB-dependent tests will start passing only after migration is live).
</output>
