# Phase 33: Cross-Thread Memory — Backend - Research

**Researched:** 2026-04-16
**Domain:** Supabase schema, FastAPI tool dispatch, system prompt injection
**Confidence:** HIGH

## Summary

Phase 33 adds a persistent user memory layer to the General Mode agent. It has three tightly coupled deliverables: a `user_memory` Supabase table with RLS, two new OpenAI function-calling tools (`remember` / `recall`) wired into `get_tools()` only, and a system prompt injection block that prepends the top-10 most-recently updated memory entries at the start of each General Mode turn.

All architectural decisions were locked in CONTEXT.md. The implementation follows patterns already established in the codebase. The migration style is proven (see `014_folders.sql` through `025_document_versioning.sql`). The non-blocking write pattern is directly available in `suggestion_service.py`. Audit logging via `asyncio.create_task(write_audit_entry(...))` is the established SSE-generator pattern.

The only genuinely new piece is the upsert-by-key semantics with case-insensitive key normalization. PostgreSQL supports this cleanly via `INSERT ... ON CONFLICT (user_id, key) DO UPDATE`.

**Primary recommendation:** Write the migration, extend the tool registry, implement the two tool handlers in threads.py tool dispatch, inject the memory block after the skill catalog block. All sub-patterns are direct copies or minor adaptations of existing code.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**A. Key Semantics**
- D-01: `remember(key, value)` performs an upsert by key — if the key already exists for this user, update the value and refresh `updated_at`; otherwise insert a new row.
- D-02: Key matching is case-insensitive (normalize to lowercase on write and read).
- D-03: All entries are stored in the DB. Top-10 by `updated_at DESC` are selected at injection time — no hard DB cap.
- D-04: No automatic expiry or max-entry limit at the DB level; capacity management delegated to Phase 34.

**B. Memory Injection Format**
- D-05: Memory block injected after the main SYSTEM_PROMPT body, before the skill catalog block, using the same string-append pattern already in threads.py (lines 463-484).
- D-06: Format:
  ```
  ## User Memory
  (Preferences and facts you've remembered about this user across conversations)
  - {key}: {value}
  - {key}: {value}
  ```
- D-07: If the user has zero memory entries, the block is omitted entirely — no empty header.
- D-08: Token cap: top-10 entries by `updated_at`. At ~50 tokens per entry max, stays well under 500 tokens.

**C. recall() Behavior**
- D-09: `recall()` with no argument returns all stored memory entries as a formatted list.
- D-10: `recall(key="x")` returns the value for that specific key.
- D-11: Key not found → return graceful string `"No memory entry found for key: x"`. No exception.
- D-12: `recall()` with no entries → return `"No memories stored yet."`.

**D. Audit Logging**
- D-13: Both `remember` and `recall` logged via `write_audit_entry`.
- D-14: Action types: `memory.remember` and `memory.recall`.
- D-15: Metadata schema:
  - `memory.remember`: `{"key": key, "value": value, "action": "upsert"}`
  - `memory.recall`: `{"key": key}` or `{"key": null}` when recalling all.

**E. Non-Blocking Writes**
- D-16: Memory writes (`remember`) must not delay the chat response. Use fire-and-forget background task.
- D-17: If the background write fails, it fails silently.

### Claude's Discretion
- DB schema column names (suggested: `id`, `user_id`, `key`, `value`, `created_at`, `updated_at`)
- Exact RLS policy SQL
- Error handling internals
- Tool JSON schema descriptions (follow existing tool style in openai_service.py)

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MEM-01 | User's stated preferences (e.g. "respond in bullet points") persist across conversation threads via a `remember` tool | user_memory table + remember tool handler in threads.py + get_tools() registration |
| MEM-03 | Memory summary is injected at the start of each turn (capped to limit context window cost) | System prompt injection block in threads.py General Mode branch, top-10 query |
</phase_requirements>

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| supabase-py | Already installed | Postgres upsert, RLS-enforced queries | Project's only DB client |
| FastAPI BackgroundTasks / asyncio.create_task | stdlib | Non-blocking writes inside SSE generator | Established pattern in codebase |
| Python stdlib (json, asyncio) | stdlib | Tool argument parsing, task scheduling | No new dependencies needed |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| pytest-asyncio | Already installed | Unit tests for async tool handlers | All new tests in backend/tests/unit/ |

**No new package installations required.** All required libraries are already present.

---

## Architecture Patterns

### Recommended Project Structure

New files to create:
```
supabase/migrations/026_user_memory.sql         # Table + RLS
backend/tests/unit/test_memory_tools.py         # Unit tests
```

Files to modify:
```
backend/app/services/audit_service.py           # Add memory.remember / memory.recall to VALID_ACTION_TYPES
backend/app/services/openai_service.py          # Add REMEMBER_TOOL, RECALL_TOOL constants; add to get_tools()
backend/app/api/threads.py                      # Memory injection block + two tool dispatch branches
```

### Pattern 1: Supabase Upsert by Composite Key

The `user_memory` table needs a unique constraint on `(user_id, key)` to enable PostgreSQL upsert semantics. The supabase-py client exposes this via `.upsert()` with `on_conflict`:

```python
# Source: supabase-py docs — upsert with conflict target
supabase.table("user_memory").upsert(
    {
        "user_id": current_user["id"],
        "key": key.lower(),
        "value": value,
        "updated_at": "now()",
    },
    on_conflict="user_id,key"
).execute()
```

Note: `updated_at` must be explicitly set to `"now()"` (a SQL expression string) since supabase-py does not auto-call `now()` on upsert unless a trigger is in place. Using a DB trigger (`BEFORE INSERT OR UPDATE`) is the cleaner approach and matches project conventions — the migration should add `updated_at` with a `moddatetime` trigger or equivalent `BEFORE UPDATE` trigger.

### Pattern 2: Memory Injection Block (threads.py)

Follows the same pattern as the skill catalog block at lines 463-484. The memory fetch and injection occurs in the `if body.agent_mode != "explorer":` branch, AFTER the skill catalog block:

```python
# Source: threads.py lines 463-484 (skill catalog pattern to replicate)
if body.agent_mode != "explorer":
    # ... existing skill catalog injection ...

    # Memory injection — after skill catalog (D-05)
    memory_rows = (
        supabase.table("user_memory")
        .select("key, value")
        .eq("user_id", current_user["id"])
        .order("updated_at", desc=True)
        .limit(10)
        .execute()
    ).data or []

    if memory_rows:
        memory_lines = "\n".join(f"- {r['key']}: {r['value']}" for r in memory_rows)
        memory_note = (
            "\n\n## User Memory\n"
            "(Preferences and facts you've remembered about this user across conversations)\n"
            f"{memory_lines}"
        )
        active_system_prompt = active_system_prompt + memory_note
```

### Pattern 3: Non-Blocking remember Write (Fire-and-Forget)

Inside the SSE generator's tool dispatch loop (same location as `asyncio.create_task(write_audit_entry(...))` calls):

```python
# Source: threads.py ~line 771 — asyncio.create_task pattern inside async generator
elif tool_name == "remember":
    key = args.get("key", "").strip().lower()   # D-02: normalize
    value = args.get("value", "")
    tool_result = json.dumps({"status": "remembered", "key": key})

    async def _write_memory():
        try:
            supabase.table("user_memory").upsert(
                {"user_id": current_user["id"], "key": key, "value": value},
                on_conflict="user_id,key"
            ).execute()
        except Exception as e:
            logger.warning("memory.remember write failed: %s", e)  # D-17: silent fail

    asyncio.create_task(_write_memory())  # D-16: fire-and-forget
    asyncio.create_task(write_audit_entry(
        user_id=current_user["id"],
        action_type="memory.remember",
        metadata={"key": key, "value": value, "action": "upsert"},
        supabase=supabase,
    ))

elif tool_name == "recall":
    key = args.get("key", "")
    if key:
        key = key.strip().lower()  # D-02
        row = (
            supabase.table("user_memory")
            .select("value")
            .eq("user_id", current_user["id"])
            .eq("key", key)
            .maybe_single()
            .execute()
        ).data
        if row:
            tool_result = row["value"] if isinstance(row, dict) else row[0]["value"]
        else:
            tool_result = f"No memory entry found for key: {key}"  # D-11
    else:
        rows = (
            supabase.table("user_memory")
            .select("key, value")
            .eq("user_id", current_user["id"])
            .order("updated_at", desc=True)
            .execute()
        ).data or []
        if rows:
            tool_result = "\n".join(f"- {r['key']}: {r['value']}" for r in rows)
        else:
            tool_result = "No memories stored yet."  # D-12
    asyncio.create_task(write_audit_entry(
        user_id=current_user["id"],
        action_type="memory.recall",
        metadata={"key": key or None},
        supabase=supabase,
    ))
```

### Pattern 4: Migration SQL

Follows the `014_folders.sql` style:

```sql
-- Migration 026: user_memory table for cross-thread persistent memory
CREATE TABLE IF NOT EXISTS public.user_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_memory_user_key_unique UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS user_memory_user_id_updated_idx
  ON public.user_memory (user_id, updated_at DESC);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can select own memory"
  ON public.user_memory FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own memory"
  ON public.user_memory FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own memory"
  ON public.user_memory FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own memory"
  ON public.user_memory FOR DELETE
  USING (auth.uid() = user_id);
```

Note: The `updated_at` column refresh on upsert can be handled either by (a) passing an explicit `updated_at` value from Python using `datetime.utcnow().isoformat()`, or (b) adding a `BEFORE UPDATE` trigger. A trigger is cleaner and the established project pattern — add `CREATE OR REPLACE FUNCTION update_updated_at_column()` if not already present, or inline the trigger SQL.

### Pattern 5: Tool Constants (openai_service.py)

Tool definitions follow the established pattern (JSON schema objects alongside `SEARCH_DOCUMENTS_TOOL`, etc.):

```python
REMEMBER_TOOL = {
    "type": "function",
    "function": {
        "name": "remember",
        "description": (
            "Store a fact or preference about the user that should persist across conversations. "
            "Use when the user states a preference (e.g. 'I prefer bullet points'), "
            "shares a personal fact (e.g. 'I work in finance'), or asks you to remember something. "
            "Key should be a short label (e.g. 'response_format', 'industry'). "
            "Calling remember with an existing key overwrites the previous value."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "Short label for the fact (e.g. 'response_format', 'name', 'industry').",
                },
                "value": {
                    "type": "string",
                    "description": "The fact or preference to store.",
                },
            },
            "required": ["key", "value"],
        },
    },
}

RECALL_TOOL = {
    "type": "function",
    "function": {
        "name": "recall",
        "description": (
            "Retrieve stored memory entries. "
            "Call with no arguments to list all stored facts. "
            "Call with a key to retrieve a specific entry."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "key": {
                    "type": "string",
                    "description": "The key to look up. Omit to retrieve all stored entries.",
                },
            },
            "required": [],
        },
    },
}
```

Add both to `get_tools()` list. Do NOT add to `get_explorer_tools()`.

### Anti-Patterns to Avoid

- **Blocking remember write in SSE generator:** The `remember` DB write must use `asyncio.create_task()`, not `await`. Awaiting would block the SSE stream.
- **Using BackgroundTasks for SSE-internal writes:** `BackgroundTasks` is only available in route handler scope, not inside `async_generator` bodies. The codebase uses `asyncio.create_task()` for all audit writes inside SSE generators — use the same approach for memory writes. (See Phase 30 decision: "asyncio.create_task() used in SSE generator for audit writes — BackgroundTasks not available inside async generator bodies".)
- **Case-sensitive key storage:** Never store keys without `.strip().lower()`. Both `remember` and `recall` must normalize before any DB interaction.
- **Injecting memory block in Explorer Mode:** The memory injection is inside `if body.agent_mode != "explorer":`. Explorer Mode must remain unchanged.
- **Injecting empty memory block:** Skip the entire injection when `memory_rows` is empty (D-07).
- **Adding memory tools to `get_explorer_tools()`:** Explorer Mode must not expose `remember` or `recall`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Key uniqueness per user | Custom dedup logic | PostgreSQL UNIQUE constraint + upsert `ON CONFLICT` | Atomic, race-condition-safe |
| Non-blocking writes | Thread executor or queue | `asyncio.create_task()` inside async generator | Already the established pattern, zero boilerplate |
| Audit logging | Custom log table | `write_audit_entry()` | Existing service handles all error swallowing |
| RLS | Application-layer user_id checks | PostgreSQL RLS policies (`auth.uid() = user_id`) | Required by CLAUDE.md for all tables |

**Key insight:** Every sub-problem in this phase has a direct, existing solution in the codebase. This phase is an integration task, not a design task.

---

## Common Pitfalls

### Pitfall 1: BackgroundTasks vs asyncio.create_task in SSE generators
**What goes wrong:** Using `BackgroundTasks.add_task()` inside the `event_stream` async generator raises an error or has no effect because `BackgroundTasks` only works at request handler scope.
**Why it happens:** FastAPI's `BackgroundTasks` is bound to the response lifecycle, not the generator lifecycle.
**How to avoid:** Use `asyncio.create_task(coroutine())` for all fire-and-forget operations inside the SSE generator. This is already the pattern used for audit writes in the codebase.
**Warning signs:** `RuntimeError: Task attached to a different loop` or tasks that never execute.

### Pitfall 2: Upsert updated_at not refreshing
**What goes wrong:** After an upsert, `updated_at` retains the original `created_at` value, so the top-10 injection uses stale ordering.
**Why it happens:** PostgreSQL upsert does not automatically refresh `updated_at` unless a trigger or explicit value is provided in the `DO UPDATE SET` clause.
**How to avoid:** Either (a) include `updated_at` in the upsert payload with the current timestamp from Python, or (b) add a `BEFORE UPDATE` trigger in the migration. Option (b) is cleaner — add a trigger function. Confirm the migration sets `updated_at = now()` in the conflict resolution clause: `ON CONFLICT (user_id, key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`.
**Warning signs:** Memory injection always shows oldest entries first regardless of which keys were recently written.

### Pitfall 3: Empty key string stored
**What goes wrong:** The LLM calls `remember(key="", value="something")` and a row is inserted with an empty key.
**Why it happens:** LLMs occasionally produce malformed tool arguments.
**How to avoid:** Add a guard in the `remember` handler: if `key` is empty after strip, return an error result immediately without writing. Example: `if not key: tool_result = json.dumps({"error": "key cannot be empty"}); continue`.
**Warning signs:** `recall(key="")` returns unexpected results or injection block has blank-key entries.

### Pitfall 4: VALID_ACTION_TYPES not updated
**What goes wrong:** `write_audit_entry` is called with `action_type="memory.remember"` but `VALID_ACTION_TYPES` in `audit_service.py` does not include it, causing silent filter failures if callers check against the frozenset.
**Why it happens:** The frozenset is a dual-validation point (see Phase 30 decision).
**How to avoid:** Add `"memory.remember"` and `"memory.recall"` to `VALID_ACTION_TYPES` in `audit_service.py`. The unit test `test_write_audit_entry_all_action_types` iterates over all valid types — new tests should cover the two new types explicitly.
**Warning signs:** If any future code gates on `VALID_ACTION_TYPES` membership, memory audit entries would be silently dropped.

### Pitfall 5: recall with maybe_single() on dict vs list
**What goes wrong:** `maybe_single().execute().data` returns either a dict or `None` in real Supabase, but mock objects return a list. Tests fail because code accesses `row["value"]` directly when `row` is a list.
**Why it happens:** This is a known project pitfall documented in STATE.md: "Toggle endpoints use isinstance(current.data, list) guard for maybe_single() mock compatibility."
**How to avoid:** Use `row[0]["value"] if isinstance(row, list) else row["value"]` when accessing the result of `maybe_single()`.

---

## Code Examples

### Migration: user_memory table
```sql
-- Source: project migration conventions (014_folders.sql, 025_document_versioning.sql)
CREATE TABLE IF NOT EXISTS public.user_memory (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_memory_user_key_unique UNIQUE (user_id, key)
);

CREATE INDEX IF NOT EXISTS user_memory_user_updated_idx
  ON public.user_memory (user_id, updated_at DESC);

ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

-- RLS: owner-only SELECT, INSERT, UPDATE, DELETE
CREATE POLICY "Users can select own memory"
  ON public.user_memory FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own memory"
  ON public.user_memory FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own memory"
  ON public.user_memory FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own memory"
  ON public.user_memory FOR DELETE USING (auth.uid() = user_id);

-- Trigger to keep updated_at current on upsert
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_memory_updated_at
  BEFORE UPDATE ON public.user_memory
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
```

### audit_service.py VALID_ACTION_TYPES update
```python
VALID_ACTION_TYPES = frozenset({
    "document.upload", "document.delete", "search.query",
    "code.execute", "skill.load", "thread.create",
    "thread.delete", "settings.update",
    "memory.remember", "memory.recall",   # Phase 33
})
```

### threads.py injection position (pseudocode)
```python
# After skill catalog injection (line ~484), still inside `if body.agent_mode != "explorer":` block:
memory_rows = (
    supabase.table("user_memory")
    .select("key, value")
    .eq("user_id", current_user["id"])
    .order("updated_at", desc=True)
    .limit(10)
    .execute()
).data or []

if memory_rows:  # D-07: omit entirely when zero entries
    memory_lines = "\n".join(f"- {r['key']}: {r['value']}" for r in memory_rows)
    memory_note = (
        "\n\n## User Memory\n"
        "(Preferences and facts you've remembered about this user across conversations)\n"
        f"{memory_lines}"
    )
    active_system_prompt = active_system_prompt + memory_note
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 33 has no external dependencies beyond the project's existing stack. All required tools (Python, Supabase, FastAPI) are already in use.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest + pytest-asyncio |
| Config file | backend/pytest.ini (or pyproject.toml) |
| Quick run command | `cd backend && python -m pytest tests/unit/test_memory_tools.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -x -q` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MEM-01 | remember tool upserts key/value, fires audit | unit | `pytest tests/unit/test_memory_tools.py::test_remember_upsert -x` | Wave 0 |
| MEM-01 | remember normalizes key to lowercase | unit | `pytest tests/unit/test_memory_tools.py::test_remember_key_normalization -x` | Wave 0 |
| MEM-01 | remember with empty key returns error without DB write | unit | `pytest tests/unit/test_memory_tools.py::test_remember_empty_key -x` | Wave 0 |
| MEM-01 | recall(key) returns value; key-not-found returns graceful string | unit | `pytest tests/unit/test_memory_tools.py::test_recall_specific_key -x` | Wave 0 |
| MEM-01 | recall() with no args returns all entries; no entries returns sentinel string | unit | `pytest tests/unit/test_memory_tools.py::test_recall_all -x` | Wave 0 |
| MEM-03 | Memory block present in General Mode system prompt when entries exist | unit | `pytest tests/unit/test_memory_tools.py::test_memory_injection_general_mode -x` | Wave 0 |
| MEM-03 | Memory block absent in Explorer Mode | unit | `pytest tests/unit/test_memory_tools.py::test_memory_injection_explorer_mode -x` | Wave 0 |
| MEM-03 | Memory block omitted when zero entries (D-07) | unit | `pytest tests/unit/test_memory_tools.py::test_memory_injection_empty -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/unit/test_memory_tools.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `backend/tests/unit/test_memory_tools.py` — covers all MEM-01 and MEM-03 behaviors listed above

---

## Open Questions

1. **updated_at trigger: new function or reuse existing?**
   - What we know: The migration should keep `updated_at` current on upsert. A `set_updated_at()` trigger function is the cleanest approach.
   - What's unclear: Whether a generic `set_updated_at()` trigger function already exists in the DB (it is not visible in any migration file).
   - Recommendation: The migration should use `CREATE OR REPLACE FUNCTION` so it is safe to run even if a prior version exists.

2. **Supabase upsert with on_conflict — client library syntax**
   - What we know: `supabase-py` exposes `.upsert(data, on_conflict="user_id,key")` which maps to `INSERT ... ON CONFLICT (user_id, key) DO UPDATE SET ...`.
   - What's unclear: Whether `updated_at` is refreshed by the library or requires explicit inclusion in the payload.
   - Recommendation: Rely on the DB trigger (see above) rather than passing `updated_at` from Python to avoid clock skew issues.

---

## Sources

### Primary (HIGH confidence)
- `backend/app/api/threads.py` lines 463-484 — skill catalog injection pattern (directly replicable for memory injection)
- `backend/app/api/threads.py` lines 770-776, 1115-1120 — `asyncio.create_task(write_audit_entry(...))` pattern inside SSE generator
- `backend/app/services/audit_service.py` — `write_audit_entry` signature, `VALID_ACTION_TYPES` frozenset
- `backend/app/services/openai_service.py` lines 408-421 — `get_tools()` / `get_explorer_tools()` structure
- `supabase/migrations/014_folders.sql` — canonical table + RLS + index migration pattern
- `supabase/migrations/025_document_versioning.sql` — most recent migration style reference
- `.planning/phases/33-cross-thread-memory-backend/33-CONTEXT.md` — all locked decisions
- `.planning/STATE.md` — established decisions including `maybe_single()` mock compatibility guard

### Secondary (MEDIUM confidence)
- supabase-py documentation (general knowledge) — `.upsert(data, on_conflict="col1,col2")` syntax
- PostgreSQL documentation — `INSERT ... ON CONFLICT DO UPDATE` semantics

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies, all existing libraries
- Architecture: HIGH — all patterns directly verified in codebase source files
- Pitfalls: HIGH — three of five pitfalls are documented in STATE.md decisions from prior phases

**Research date:** 2026-04-16
**Valid until:** 2026-05-16 (stable domain)
