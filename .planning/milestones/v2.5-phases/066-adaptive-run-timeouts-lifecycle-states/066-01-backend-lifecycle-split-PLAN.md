---
phase: 066-adaptive-run-timeouts-lifecycle-states
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - supabase/migrations/038_runs_timed_out_status.sql
  - supabase/full-schema.sql
  - backend/app/models/message.py
  - backend/app/api/threads.py
autonomous: false
requirements:
  - STREAM-04-polish

user_setup:
  - service: supabase
    why: "Apply migration 038 to live local DB via SQL editor (CLAUDE.md project rule — never `db push`/`db reset`)"
    dashboard_config:
      - task: "Paste migration 038_runs_timed_out_status.sql contents into Supabase Studio SQL editor and Run"
        location: "Supabase Studio → SQL Editor (http://127.0.0.1:54323/project/default/sql)"

must_haves:
  truths:
    - "Database CHECK constraint admits 5 values (streaming, completed, failed, cancelled, timed_out) — verified by inserting a test row with status='timed_out'"
    - "Pydantic MessageResponse.run_status Literal admits 'timed_out' — verified by Pydantic validation accepting it"
    - "Producer's TimeoutError handler writes status='timed_out' (NOT 'failed/hard_timeout') with discriminator-prefixed runs.error"
    - "Producer's CancelledError handler writes status='cancelled' (UNCHANGED partition guard)"
    - "Producer's Exception handler writes status='failed' with type(e).__name__: <truncated≤200chars> format"
    - "_RUN_STATUS_TO_TERMINAL_TYPE includes 'timed_out': 'timed_out' and TERMINAL_TYPES set includes 'timed_out'"
    - "_emit_terminal accepts 'timed_out' as a valid type (no ValueError)"
    - "supabase/full-schema.sql regenerated via scripts/regenerate-full-schema.sh and contains the 5-value CHECK"
  artifacts:
    - path: "supabase/migrations/038_runs_timed_out_status.sql"
      provides: "DROP+ADD CHECK constraint extending runs.status to 5 values in single transaction"
      contains: "timed_out"
    - path: "backend/app/models/message.py"
      provides: "Pydantic MessageResponse.run_status 5-value Literal"
      contains: 'Literal["streaming", "completed", "failed", "cancelled", "timed_out"]'
    - path: "backend/app/api/threads.py"
      provides: "5-value sentinel map + new terminal classification (timed_out branch + extended runs.error format)"
      contains: '"timed_out": "timed_out"'
  key_links:
    - from: "backend/app/api/threads.py except asyncio.TimeoutError branch (line ~2140)"
      to: "_RUN_STATUS_TO_TERMINAL_TYPE → _emit_terminal"
      via: "_terminal_status='timed_out' → finalizer maps to wire-format 'timed_out' sentinel"
      pattern: '_terminal_status = "timed_out"'
    - from: "supabase/migrations/038_*.sql"
      to: "supabase/full-schema.sql"
      via: "bash scripts/regenerate-full-schema.sh after manual SQL editor apply"
      pattern: "CHECK \\(status IN \\('streaming','completed','failed','cancelled','timed_out'\\)\\)"
---

<objective>
Land the lifecycle-state split (D-066-04, 05, 06, 07, 08): extend `public.runs.status` CHECK constraint to admit a 5th value `timed_out`; mirror that in Pydantic `MessageResponse.run_status` Literal; rewrite the producer's terminal classification at `threads.py:2140-2158` so `TimeoutError` writes `timed_out` (NOT `failed/hard_timeout`), `CancelledError` continues to write `cancelled`, and `Exception` writes `failed: <type>: <truncated msg>`; extend the SSE sentinel namespace map and `TERMINAL_TYPES` set to carry `timed_out` end-to-end.

Purpose: Foundation layer for Phase 066 — Plans 02/03/04 all depend on the 5-value enum existing in DB + Pydantic + producer. This plan does NOT change timeout machinery (Plan 02 wraps the per-LLM-call timer); it only adds the 5th terminal state and rewires classification + SSE wire-format to support it.

Output:
- Migration `supabase/migrations/038_runs_timed_out_status.sql` (single-transaction DROP+ADD CHECK).
- Regenerated `supabase/full-schema.sql` (live-DB dump via `scripts/regenerate-full-schema.sh`).
- `backend/app/models/message.py` Pydantic Literal: 4 → 5 values.
- `backend/app/api/threads.py:81-94` 5-value `_RUN_STATUS_TO_TERMINAL_TYPE` map and `TERMINAL_TYPES` set.
- `backend/app/api/threads.py:2140-2158` rewritten terminal-classification block.
</objective>

<execution_context>
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/workflows/execute-plan.md
@C:/Vibe Apps/Agentic RAG/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@C:/Vibe Apps/Agentic RAG/.planning/PROJECT.md
@C:/Vibe Apps/Agentic RAG/.planning/ROADMAP.md
@C:/Vibe Apps/Agentic RAG/.planning/STATE.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md
@C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-VALIDATION.md
@C:/Vibe Apps/Agentic RAG/CLAUDE.md
@C:/Vibe Apps/Agentic RAG/supabase/migrations/035_runs_table.sql
@C:/Vibe Apps/Agentic RAG/backend/app/models/message.py
@C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py
@C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py

<interfaces>
<!-- Existing contracts the executor MUST preserve. Extracted directly from the codebase. -->

From backend/app/models/message.py (CURRENT 4-value Literal — to be extended to 5):
```python
class MessageResponse(BaseModel):
    id: UUID
    thread_id: UUID
    user_id: UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    updated_at: datetime
    tool_calls: list[dict] | None = None
    source_refs: list[dict] | None = None
    confidence_level: str | None = None
    confidence_avg_similarity: float | None = None
    confidence_disclaimer: str | None = None
    # Phase 063.1 D-063.1-15: snake_case on the wire; api.ts mapper renames to camelCase.
    run_id: UUID | None = None
    run_status: Literal["streaming", "completed", "failed", "cancelled"] | None = None
```

From backend/app/api/threads.py:81-94 (CURRENT 4-value namespace map + TERMINAL_TYPES set — to be extended):
```python
# Terminal sentinel discriminator types (D-061-12). Consumer breaks when
# it XREADs an entry whose data.type is in this set.
TERMINAL_TYPES = frozenset({"done", "error", "cancelled"})

# D-061-09 runs.status enum → SSE TERMINAL_TYPES mapping. The runs table
# uses {"streaming","completed","failed","cancelled"} per the migration
# CHECK constraint; the SSE wire uses TERMINAL_TYPES. They overlap on
# "cancelled" only, so the producer's finally must translate before
# calling _emit_terminal.
_RUN_STATUS_TO_TERMINAL_TYPE: dict[str, str] = {
    "completed": "done",
    "failed": "error",
    "cancelled": "cancelled",
}
```

From backend/app/api/threads.py:2140-2158 (CURRENT terminal classification — TimeoutError branch flips to timed_out; CancelledError UNCHANGED; Exception extends format):
```python
except asyncio.TimeoutError:
    # CR-01 fix: catch terminal classifications BEFORE the line-1942 finally
    # runs. ... D-061-01: producer body exceeded settings.run_hard_timeout_seconds.
    _terminal_status = "failed"
    _terminal_error = "hard_timeout"
    logger.warning("Run %s exceeded hard timeout %ds", run_id, settings.run_hard_timeout_seconds)
except asyncio.CancelledError:
    _terminal_status = "cancelled"
    _terminal_error = None
    raise
except Exception as e:
    _terminal_status = "failed"
    _terminal_error = type(e).__name__
    logger.exception("Run %s failed", run_id)
```

From backend/app/api/runs.py:386, 422-424 (CURRENT — MUST stay status="cancelled"; partition guard per D-066-05):
```python
# Step 2: already-terminal → 204 silent (D-062-09 idempotent)
if row["status"] in ("completed", "failed", "cancelled"):
    return Response(status_code=status.HTTP_204_NO_CONTENT)

# Zombie heal — Step 1 UPDATE
await aexec(
    supabase.table("runs").update({
        "status": "cancelled",
        "error": "cancelled_by_user",
        "completed_at": datetime.now(timezone.utc).isoformat(),
    }).eq("run_id", str(run_id))
)
```

From supabase/migrations/035_runs_table.sql:25 (CURRENT 4-value inline CHECK — auto-named `runs_status_check` per Postgres convention):
```sql
status        text NOT NULL CHECK (status IN ('streaming','completed','failed','cancelled')),
```

The constraint auto-name `runs_status_check` is the deterministic Postgres auto-naming for inline column CHECK (table_column_check). Verify before authoring with:
```sql
SELECT conname FROM pg_constraint WHERE conrelid = 'public.runs'::regclass AND contype = 'c';
```
</interfaces>

<key_decisions>
**Locked decisions from CONTEXT.md (NON-NEGOTIABLE):**
- D-066-04: 5th `runs.status` value `timed_out` via DROP+ADD CHECK in single transaction. Migration filename `038_runs_timed_out_status.sql` (verified in RESEARCH.md Pitfall 6 — 037 is latest, no `038_*` exists).
- D-066-05: Terminal classification map — TimeoutError → `timed_out`; CancelledError → `cancelled` (UNCHANGED, raise after assignment); Exception → `failed`. **`runs.py:386, 422-424` UNCHANGED — partition guard: timer fire = system = `timed_out`; DELETE verb = user = `cancelled`. NEVER `timed_out` from cancel_run.**
- D-066-06: SSE terminal sentinel adds 5th type `timed_out`. `TERMINAL_TYPES` set + `_RUN_STATUS_TO_TERMINAL_TYPE` dict both extend.
- D-066-07: `runs.error` format — prefix-discriminated plain text (no JSON).
  - System timeouts: `f"timed_out: {per_call_budget}s per-call deadline exceeded at iteration {iteration} (model={_model_id})"` — but Plan 01 cannot reference `per_call_budget` / `iteration` / `_model_id` because Plan 02 introduces them. **Plan 01 writes a stable error format that Plan 02 will refine** (see action below).
  - User cancels: `cancelled: user clicked Stop` (Plan 01 leaves `runs.py:423` `cancelled_by_user` UNCHANGED — backward-compat). The producer's CancelledError branch leaves `_terminal_error = None` (today's behavior — DELETE handler writes its own error string).
  - Real failures: `failed: <ExceptionClass>: <truncated≤200chars>`.
- D-066-08: NO retroactive classification. Historical `cancelled` rows stay `cancelled`. The migration is forward-only.

**Plan 01 / Plan 02 sequencing detail:** Plan 01 changes the TimeoutError branch to write `_terminal_status = "timed_out"` with a static-string format (since Plan 02 introduces `per_call_budget` / `iteration` / `_model_id` as locals). Plan 02 will refine the error string with the actual values once the per-call timer is in place.
</key_decisions>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| Postgres CHECK ↔ application writes | Migration 038 is forward-only — application MUST write `timed_out` only from system-timeout source (producer); NEVER from user-Stop source (runs.py cancel handler) |
| Producer agent_runner ↔ runs.py DELETE | Two distinct write paths to `public.runs.status` — partition guard (D-066-05) is enforced by code structure: TimeoutError → `timed_out` lives in `threads.py:agent_runner` only; `cancelled` lives in `runs.py:cancel_run` only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-066-01 | Tampering / Inconsistency | DELETE /runs/{id} writes `timed_out` instead of `cancelled` (regression of D-066-05 partition) | mitigate | Plan 01 explicitly does NOT modify `runs.py:386, 422-424`. Plan 04 test `test_delete_writes_cancelled_not_timed_out` asserts the partition holds. |
| T-066-02 | Information Disclosure | `runs.error` leaks full traceback / API key fragment via `str(e)` | mitigate | D-066-07 caps Exception detail at `[:200]`; type(e).__name__ is the discriminator. Implemented in this plan's terminal classification rewrite. |
| T-066-03 | DoS / availability | Migration 038 applies during in-flight INSERT → CHECK violation | accept | DROP+ADD in single ALTER TABLE acquires ACCESS EXCLUSIVE lock; in-flight transactions queue; operator coordinates apply during low-traffic window per CLAUDE.md SQL editor flow. Best-effort already inherent to `db push`-discipline policy. |
| T-066-04 | Tampering | Auto-named constraint `runs_status_check` mismatch on DROP → migration fails silently | mitigate | Migration includes `\d+ public.runs` verification step (or `pg_constraint` SELECT documented in comment); operator reads error if DROP fails. |
</threat_model>

<tasks>

<task type="auto">
  <name>Task 1: Author migration 038 + extend Pydantic Literal + extend SSE namespace + rewrite terminal classification</name>
  <files>supabase/migrations/038_runs_timed_out_status.sql, backend/app/models/message.py, backend/app/api/threads.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (D-066-04, 05, 06, 07, 08)
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-RESEARCH.md (Pattern 3 — Single-transaction CHECK constraint replacement; "Code Examples → Terminal classification update at threads.py:2140-2158"; "Code Examples → _RUN_STATUS_TO_TERMINAL_TYPE map extension"; Pitfall 6 — Migration filename collisions)
    - C:/Vibe Apps/Agentic RAG/CLAUDE.md (migration discipline — apply via SQL editor only)
    - C:/Vibe Apps/Agentic RAG/supabase/migrations/035_runs_table.sql (current 4-value CHECK shape — line 25)
    - C:/Vibe Apps/Agentic RAG/backend/app/models/message.py (current MessageResponse Literal — line 39)
    - C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py lines 81-94 (current TERMINAL_TYPES + _RUN_STATUS_TO_TERMINAL_TYPE)
    - C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py lines 2140-2158 (current terminal classification — the diff target)
  </read_first>
  <action>
**Subtask 1a — Author migration `supabase/migrations/038_runs_timed_out_status.sql`** with EXACTLY this content (D-066-04, RESEARCH.md Pattern 3):

```sql
-- Migration 038: extend public.runs.status CHECK to admit 'timed_out'
-- Phase 066 (D-066-04, D-066-08). Companion to:
--   - threads.py terminal classification (D-066-05): TimeoutError → 'timed_out'
--   - runs.py cancel_run (UNCHANGED per D-066-05): user-Stop → 'cancelled'
--   - SSE TERMINAL_TYPES set (D-066-06): adds 'timed_out' wire-format value
--   - Pydantic MessageResponse.run_status (D-066-04): 4-value Literal → 5-value
--
-- D-066-08: NO retroactive classification. Historical rows with
-- status='cancelled' STAY 'cancelled' — the migration is forward-only.
--
-- Atomic single-statement DROP+ADD CHECK per Postgres docs
-- (postgresql.org/docs/current/sql-altertable.html — multiple alterations
-- on a single table can be combined into one ALTER TABLE statement).
--
-- The constraint auto-name `runs_status_check` is the deterministic
-- Postgres auto-naming for inline column CHECK on table public.runs
-- column status (verified at migration 035 line 25, no explicit name).
-- If the auto-name differs in your DB, run this verification first:
--   SELECT conname FROM pg_constraint
--    WHERE conrelid = 'public.runs'::regclass AND contype = 'c';
-- and substitute the actual name in the DROP CONSTRAINT clause.

ALTER TABLE public.runs
    DROP CONSTRAINT runs_status_check,
    ADD  CONSTRAINT runs_status_check
        CHECK (status IN ('streaming','completed','failed','cancelled','timed_out'));
```

**Subtask 1b — Extend Pydantic Literal in `backend/app/models/message.py:39`** by replacing the line:

```python
    run_status: Literal["streaming", "completed", "failed", "cancelled"] | None = None
```

with:

```python
    # Phase 066 D-066-04: 5-value Literal mirrors public.runs CHECK constraint
    # post-migration 038. The 5th value 'timed_out' (NEW) is written by the
    # producer's TimeoutError handler (threads.py:agent_runner) when the
    # per-LLM-call asyncio.timeout fires. NEVER written by runs.py:cancel_run
    # (partition guard per D-066-05).
    run_status: Literal["streaming", "completed", "failed", "cancelled", "timed_out"] | None = None
```

**Subtask 1c — Extend SSE namespace at `backend/app/api/threads.py:83-94`** by replacing:

```python
TERMINAL_TYPES = frozenset({"done", "error", "cancelled"})
```

with:

```python
# Phase 066 D-066-06: 5th SSE terminal type 'timed_out' — distinct wire-format
# value from 'error' so the frontend's onTerminal callback can route to a
# dedicated "Agent reached time limit" banner (D-066-10) and the Resume
# button gating extends to runStatus === 'timed_out' (D-066-09).
TERMINAL_TYPES = frozenset({"done", "error", "cancelled", "timed_out"})
```

AND replace the `_RUN_STATUS_TO_TERMINAL_TYPE` dict body to include the 5th row:

```python
_RUN_STATUS_TO_TERMINAL_TYPE: dict[str, str] = {
    "completed": "done",
    "failed": "error",
    "cancelled": "cancelled",
    "timed_out": "timed_out",  # Phase 066 D-066-06 — system-timeout sentinel
}
```

**Subtask 1d — Rewrite terminal classification at `backend/app/api/threads.py:2140-2159`** by replacing the existing TimeoutError / CancelledError / Exception branches with:

```python
                except asyncio.TimeoutError:
                    # Phase 066 D-066-05: per-LLM-call asyncio.timeout(per_call_budget)
                    # fired (Plan 02 wraps the timer around the SDK iteration loop).
                    # Strict partition guard: timer fire = system = 'timed_out'.
                    # The user-Stop write at runs.py:422 stays 'cancelled' (UNCHANGED).
                    #
                    # D-066-07 error format — Plan 01 writes a stable static-prefix
                    # string here. Plan 02 refines this to include per_call_budget,
                    # iteration, and _model_id values once the per-call timer is in
                    # place: f"timed_out: {per_call_budget}s per-call deadline ..."
                    _terminal_status = "timed_out"
                    _terminal_error = "timed_out: per-call deadline exceeded"
                    logger.warning(
                        "Run %s timed out (Plan 01 placeholder — Plan 02 will refine)",
                        run_id,
                    )
                except asyncio.CancelledError:
                    # D-066-05 UNCHANGED: cancellation comes from app lifespan shutdown
                    # OR DELETE /runs/{id} (cancel verb). The DELETE handler writes its
                    # own error string ('cancelled_by_user') in runs.py:423; this branch
                    # leaves _terminal_error = None and lets the finalizer write NULL,
                    # which is the legacy contract for in-process producer cancellation.
                    _terminal_status = "cancelled"
                    _terminal_error = None
                    raise   # MUST re-raise so timeout context + asyncio task state stay correct (Pitfall 3)
                except Exception as e:
                    # D-066-07 extended format: 'failed: <ExceptionClass>: <truncated≤200chars>'
                    # supersedes today's bare type(e).__name__. The 200-char cap (T-066-02
                    # mitigation) prevents accidental traceback / API-key-fragment leakage
                    # via RLS-readable runs.error column.
                    _terminal_status = "failed"
                    _truncated_msg = (str(e) or "")[:200]
                    _terminal_error = f"failed: {type(e).__name__}: {_truncated_msg}"
                    logger.exception("Run %s failed", run_id)
```

**DO NOT TOUCH `backend/app/api/runs.py:386, 422-424`** — the user-Stop cancel handler MUST keep writing `status="cancelled"`, `error="cancelled_by_user"`. T-066-01 partition guard.

**DO NOT TOUCH `backend/app/api/threads.py:855` (the outer `async with asyncio.timeout(settings.run_hard_timeout_seconds)`)** — Plan 02 owns deletion of that wrapper and the per-call timer wrapping at lines 1149-1244. Plan 01 only changes terminal classification + sentinel namespace.
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; (test -f supabase/migrations/038_runs_timed_out_status.sql || (echo "MISSING migration 038" &amp;&amp; exit 1))</automated>
    <automated>grep -q "CHECK (status IN ('streaming','completed','failed','cancelled','timed_out'))" "C:/Vibe Apps/Agentic RAG/supabase/migrations/038_runs_timed_out_status.sql"</automated>
    <automated>grep -q "DROP CONSTRAINT runs_status_check" "C:/Vibe Apps/Agentic RAG/supabase/migrations/038_runs_timed_out_status.sql"</automated>
    <automated>grep -q 'Literal\["streaming", "completed", "failed", "cancelled", "timed_out"\]' "C:/Vibe Apps/Agentic RAG/backend/app/models/message.py"</automated>
    <automated>grep -q '"timed_out": "timed_out"' "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>grep -q 'frozenset({"done", "error", "cancelled", "timed_out"})' "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>grep -q '_terminal_status = "timed_out"' "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>grep -q "f\"failed: {type(e).__name__}: {_truncated_msg}\"" "C:/Vibe Apps/Agentic RAG/backend/app/api/threads.py"</automated>
    <automated>! grep -E '(status="cancelled"|"status": "cancelled")' "C:/Vibe Apps/Agentic RAG/backend/app/api/runs.py" | grep -q "timed_out"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "from app.models.message import MessageResponse; from datetime import datetime; from uuid import uuid4; m = MessageResponse(id=uuid4(), thread_id=uuid4(), user_id=uuid4(), role='assistant', content='', created_at=datetime.utcnow(), updated_at=datetime.utcnow(), run_status='timed_out'); print('OK', m.run_status)"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "from app.api.threads import TERMINAL_TYPES, _RUN_STATUS_TO_TERMINAL_TYPE; assert 'timed_out' in TERMINAL_TYPES; assert _RUN_STATUS_TO_TERMINAL_TYPE['timed_out'] == 'timed_out'; print('OK')"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG/backend" &amp;&amp; venv/Scripts/python.exe -c "import ast; t = ast.parse(open('app/api/threads.py').read()); print('threads.py parses OK')"</automated>
  </verify>
  <done>
    - Migration `supabase/migrations/038_runs_timed_out_status.sql` exists with single-transaction DROP+ADD CHECK and 5 enum values
    - `backend/app/models/message.py:39` Literal extends to 5 values; Pydantic constructor accepts `run_status='timed_out'`
    - `backend/app/api/threads.py:83` TERMINAL_TYPES set includes 'timed_out'; `_RUN_STATUS_TO_TERMINAL_TYPE` dict has 5 rows
    - `backend/app/api/threads.py:2140-2159` TimeoutError branch writes `_terminal_status = "timed_out"`; Exception branch uses `f"failed: {type(e).__name__}: {_truncated_msg}"` with `[:200]` cap
    - `backend/app/api/runs.py` cancel handler UNCHANGED (still `status="cancelled"`, `error="cancelled_by_user"`)
    - `threads.py` parses as valid Python AST; importable
  </done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 2: [BLOCKING] Apply migration 038 via Supabase SQL editor + regenerate full-schema.sql</name>
  <files>supabase/migrations/038_runs_timed_out_status.sql, supabase/full-schema.sql</files>
  <action>See <how-to-verify> below — this is a checkpoint:human-action task; the developer pastes the migration SQL into Supabase Studio SQL editor (CLAUDE.md project rule: never `supabase db push`/`db reset`) then runs `bash scripts/regenerate-full-schema.sh` to update the bootstrap artifact. The detailed step-by-step instructions are in the <how-to-verify> block below.</action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; grep -c "'timed_out'" supabase/full-schema.sql | tr -d ' ' | grep -E "^[1-9]"</automated>
  </verify>
  <done>User replied "applied"; full-schema.sql contains "timed_out" at least once; SQL editor smoke test INSERT succeeded (Step 6 in how-to-verify). Working tree shows supabase/full-schema.sql modified.</done>
  <what-built>Migration 038 file exists at `supabase/migrations/038_runs_timed_out_status.sql` (Task 1). Backend code in Task 1 already writes `status='timed_out'` on TimeoutError, but the live DB still has the 4-value CHECK constraint — INSERT/UPDATE attempts with `status='timed_out'` will FAIL with a CHECK violation until this migration is applied. Plan 04 backend integration tests CANNOT pass until this is done.</what-built>
  <how-to-verify>
**Why manual:** Project rule from CLAUDE.md (also recorded in user memory): apply migrations by pasting SQL into the **Supabase SQL editor** — NEVER `supabase db push` / `supabase db reset` (those wipe local dev data). Only the developer can perform this UI action.

**Steps:**

1. Open the Supabase Studio SQL editor at http://127.0.0.1:54323/project/default/sql

2. (Optional pre-flight verification) Run this SELECT to confirm the auto-named constraint:
   ```sql
   SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.runs'::regclass AND contype = 'c';
   ```
   Expected output includes `runs_status_check`. If a different name appears, edit the migration file's `DROP CONSTRAINT` clause to match before proceeding.

3. Copy the entire contents of `supabase/migrations/038_runs_timed_out_status.sql` into a new SQL editor query.

4. Click **Run**. Expected output: `Success. No rows returned.`

5. Verify the new constraint shape:
   ```sql
   SELECT pg_get_constraintdef(oid) FROM pg_constraint
    WHERE conrelid = 'public.runs'::regclass
      AND contype = 'c'
      AND conname = 'runs_status_check';
   ```
   Expected: `CHECK (status = ANY (ARRAY['streaming'::text, 'completed'::text, 'failed'::text, 'cancelled'::text, 'timed_out'::text]))`

6. Quick-confirm INSERT works:
   ```sql
   -- Smoke test (will roll back via the implicit transaction; no permanent row created)
   BEGIN;
   INSERT INTO public.runs (run_id, thread_id, user_id, status, model, provider)
   VALUES (gen_random_uuid(),
           (SELECT id FROM public.threads LIMIT 1),
           (SELECT user_id FROM public.threads LIMIT 1),
           'timed_out',
           'gpt-4o',
           'openai');
   ROLLBACK;
   ```
   Expected: `INSERT 0 1` then `ROLLBACK`. If you get a CHECK violation, the migration didn't apply — re-run step 4.

7. Regenerate the bootstrap artifact (in a Bash terminal at repo root):
   ```bash
   bash scripts/regenerate-full-schema.sh
   ```
   Expected: `supabase/full-schema.sql` updated; file contains the 5-value CHECK.

8. Verify regen output:
   ```bash
   grep -c "'timed_out'" supabase/full-schema.sql
   ```
   Expected: at least `1` (the new value appears in the runs.status CHECK).

9. Reply with one of:
   - `applied` — migration ran clean, full-schema regenerated, smoke test INSERT worked
   - `applied + diff` — applied but with notes (constraint name differed, regen warning, etc.)
   - `failed: <reason>` — describe the error so we can adjust the migration before retrying
  </how-to-verify>
  <resume-signal>Type "applied" if the migration ran cleanly and `full-schema.sql` was regenerated. Otherwise describe the failure.</resume-signal>
</task>

<task type="auto">
  <name>Task 3: Commit migration 038 + regenerated full-schema + Pydantic + threads.py rewrite</name>
  <files>supabase/migrations/038_runs_timed_out_status.sql, supabase/full-schema.sql, backend/app/models/message.py, backend/app/api/threads.py</files>
  <read_first>
    - C:/Vibe Apps/Agentic RAG/.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-CONTEXT.md (commit message style — see git log for prior phase commit conventions: `docs(NNN-MM): ...`, `feat(NNN-MM): ...`)
    - C:/Vibe Apps/Agentic RAG/CLAUDE.md (commit migration + full-schema together)
  </read_first>
  <action>
Stage exactly these four files (no `git add -A`, no globbing):

```bash
git add supabase/migrations/038_runs_timed_out_status.sql supabase/full-schema.sql backend/app/models/message.py backend/app/api/threads.py
```

Commit with this message (HEREDOC to preserve formatting):

```
feat(066-01): add 'timed_out' lifecycle state — DB CHECK + Pydantic Literal + producer terminal classification

Phase 066 D-066-04, 05, 06, 07, 08: split overloaded `cancelled` terminal
state into `cancelled` (user-Stop, runs.py UNCHANGED) vs `timed_out`
(system per-LLM-call timeout, written by threads.py agent_runner only).

- supabase/migrations/038_runs_timed_out_status.sql: single-transaction
  DROP CONSTRAINT runs_status_check + ADD CONSTRAINT with 5 values
  (D-066-04). D-066-08: forward-only — no retroactive classification.
- supabase/full-schema.sql: regenerated via scripts/regenerate-full-schema.sh
  after manual SQL editor apply (CLAUDE.md migration discipline).
- backend/app/models/message.py:39: MessageResponse.run_status Literal
  extends 4 → 5 values mirroring DB CHECK.
- backend/app/api/threads.py:83-94: TERMINAL_TYPES + _RUN_STATUS_TO_TERMINAL_TYPE
  add 'timed_out' (D-066-06).
- backend/app/api/threads.py:2140-2159: TimeoutError branch writes
  status='timed_out' (was 'failed'/'hard_timeout'). Exception branch
  extends format to 'failed: <ExceptionClass>: <truncated≤200chars>'
  per D-066-07 (T-066-02 mitigation — caps traceback leakage).
- backend/app/api/runs.py UNCHANGED: cancel_run still writes 'cancelled'
  per D-066-05 partition guard (T-066-01 mitigation).

Plan 02 will refine the 'timed_out' error string to include per_call_budget,
iteration, and _model_id once the per-LLM-call asyncio.timeout wrapper is
in place at threads.py:1149-1244 (D-066-01, 02, 11).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
  </action>
  <verify>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --pretty=%s | grep -q "066-01"</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git log -1 --name-only --pretty=format: | sort | tr -d '\r' | tr -s ' ' &gt; /tmp/066-01-files.txt &amp;&amp; grep -q "supabase/migrations/038_runs_timed_out_status.sql" /tmp/066-01-files.txt &amp;&amp; grep -q "supabase/full-schema.sql" /tmp/066-01-files.txt &amp;&amp; grep -q "backend/app/models/message.py" /tmp/066-01-files.txt &amp;&amp; grep -q "backend/app/api/threads.py" /tmp/066-01-files.txt</automated>
    <automated>cd "C:/Vibe Apps/Agentic RAG" &amp;&amp; git status --porcelain | grep -E "^(M|A)" | grep -v "^A.*PLAN\.md$" | wc -l | tr -d ' ' | grep -E "^0$"</automated>
  </verify>
  <done>
    - Single commit on current branch named "feat(066-01): ..."
    - Commit touches exactly these 4 files: migration 038, full-schema.sql, message.py, threads.py
    - Working tree clean post-commit (no stray modifications outside the staged set)
  </done>
</task>

</tasks>

<verification>
- All Task 1 grep gates pass
- Task 2 user replied "applied"
- `cd backend && venv/Scripts/python.exe -c "from app.api.threads import TERMINAL_TYPES; assert 'timed_out' in TERMINAL_TYPES"` exits 0
- Live DB INSERT with `status='timed_out'` succeeds in SQL editor smoke test (Task 2 step 6)
- `supabase/full-schema.sql` contains `'timed_out'` (Task 2 step 8)
- Single commit landed; working tree clean
- `runs.py:422-424` UNCHANGED — verified by `git diff HEAD~1 backend/app/api/runs.py` returning no output
</verification>

<success_criteria>
- DB CHECK constraint admits 5 values (post-Task 2 SQL editor apply)
- Pydantic constructor accepts `run_status='timed_out'`
- TERMINAL_TYPES set has 4 → 5 entries
- `_RUN_STATUS_TO_TERMINAL_TYPE` map has 4 → 5 rows
- Producer's TimeoutError branch sets `_terminal_status = "timed_out"` (NOT "failed"); Exception branch uses extended format with 200-char cap
- runs.py cancel handler UNCHANGED (T-066-01 partition guard intact)
- Single feature commit on Phase 066's branch
</success_criteria>

<output>
After completion, create `.planning/phases/066-adaptive-run-timeouts-lifecycle-states/066-01-SUMMARY.md` documenting:
- Migration 038 application result (constraint name verified, smoke test passed)
- Files modified with line numbers
- Plan 02's prerequisite: the 'timed_out' string at threads.py:2147 is a static placeholder; Plan 02 must refine it once per_call_budget / iteration / _model_id are in scope at the per-call timer site
- Any deviation from the action steps (constraint auto-name mismatch, regen script warnings, etc.)
</output>
