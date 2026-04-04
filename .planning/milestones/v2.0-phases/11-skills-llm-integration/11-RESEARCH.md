# Phase 11: Skills LLM Integration - Research

**Researched:** 2026-03-31
**Domain:** OpenAI tool-calling, SSE event streaming, FastAPI async generators, system prompt injection
**Confidence:** HIGH

---

## Summary

Phase 11 wires the Phase 10 skills database into the live chat loop. The work is entirely backend
(threads.py and openai_service.py) plus a small frontend SSE-event extension for `skill_activated`.
No new dependencies are required — the project already uses OpenAI's tool-calling API with streaming
SSE, which is the exact mechanism needed for `load_skill`, `save_skill`, and `read_skill_file`.

The architecture follows the established pattern exactly: new tools are defined as JSON Schema objects
in `openai_service.py`, dispatched in the `send_message` event loop in `threads.py`, and `tool_start`
/ `tool_end` SSE events are emitted around each dispatch. The only novel element is the `skill_activated`
SSE event (SKIL-12), which must be emitted **before** the `tool_end` event so the frontend can display
a visual indicator as soon as `load_skill` fires.

The skill catalog injection (SKIL-09) is a system-prompt augmentation — the same pattern already used
for folder-scope context. A single Supabase query at the top of `event_stream()` fetches all enabled
skills for the user and appends a formatted catalog block to the active system prompt (General Mode
only). Explorer Mode is excluded by the existing `if body.agent_mode == "explorer"` branch.

`save_skill` (SKIL-11) is the most complex tool: it calls the existing skills CRUD logic (POST to the
skills table) directly via Supabase inside the tool dispatch, without an HTTP round-trip. The return
value should confirm success and echo the new skill's name so the LLM can confirm to the user.

`read_skill_file` (FILE-05) fetches the content of a file from the `skill-files` Supabase Storage
bucket. Files are stored at `user_id/skill_id/filename`; to resolve `skill_id` from `skill_name`,
a lookup against the skills table is required. The file is downloaded via `supabase.storage.from_("skill-files").download(path)`, which returns raw bytes; these must be decoded as UTF-8 for text
files (scripts, markdown) and returned as a string.

**Primary recommendation:** Extend `threads.py` and `openai_service.py` following the existing
tool-addition pattern. Keep all new tool dispatch inline in the `send_message` loop — no new service
files needed.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SKIL-09 | Enabled skills catalog injected into system prompt on every General Mode chat turn | System prompt augmentation pattern — same as folder-scope injection; single DB query at top of event_stream() |
| SKIL-10 | LLM can call `load_skill(skill_name)` to get full instructions + file list | New tool definition in openai_service.py; dispatch in threads.py queries skills table by name |
| SKIL-11 | LLM can call `save_skill(name, description, instructions)` to create/update a skill | New tool definition; dispatch inserts into skills table via supabase.table("skills").insert() |
| SKIL-12 | `skill_activated` SSE event emitted when `load_skill` dispatches | Yield SSE event after tool args are parsed, before returning tool result; frontend handles in api.ts |
| SKIL-13 | Skills tools available in General Mode only — Explorer Mode excluded | `if body.agent_mode == "explorer"` branch in threads.py already gates tool list; skill tools only added in the else branch |
| FILE-04 | `load_skill` response includes list of attached filenames | Query skill_files table by skill_id and include filenames in tool result JSON |
| FILE-05 | LLM can call `read_skill_file(skill_name, filename)` to read file content | New tool definition; dispatch resolves skill_id from name, then downloads from skill-files storage bucket |
</phase_requirements>

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| openai (Python SDK) | already installed | Tool-calling API, streaming completions | Project stack — all LLM calls go through this |
| supabase-py | already installed | skills table queries + Storage download | Already used by skills.py and all other routers |
| fastapi | already installed | SSE via StreamingResponse + AsyncGenerator | Project stack |

### No New Dependencies Required

All capabilities needed for Phase 11 exist in the currently installed packages.
- Tool definitions: plain Python dicts (existing pattern)
- Supabase Storage download: `supabase.storage.from_("skill-files").download(path)` — in supabase-py
- SSE events: `yield f"data: {json.dumps(...)}\n\n"` — existing pattern in threads.py

**Installation:** None needed.

---

## Architecture Patterns

### Recommended File Changes

```
backend/
├── app/
│   ├── api/
│   │   └── threads.py           # Catalog injection + 3 new tool dispatchers
│   └── services/
│       └── openai_service.py    # 3 new tool definitions; get_tools() adds them for General Mode
├── tests/
│   └── integration/
│       └── test_threads_skills.py   # New test file for skill tool dispatch (Wave 0 scaffold)
frontend/
└── src/
    └── lib/
        └── api.ts               # Handle skill_activated SSE event type in streamMessage()
```

### Pattern 1: Tool Definition (follows existing pattern in openai_service.py)

The three new tool definitions follow the identical JSON Schema pattern of all existing tools.

```python
# Source: existing openai_service.py patterns
LOAD_SKILL_TOOL = {
    "type": "function",
    "function": {
        "name": "load_skill",
        "description": (
            "Load the full instructions and attached file list for a skill by name. "
            "Use when the user's request matches a skill in the catalog. "
            "After loading, follow the skill instructions to fulfil the request."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "skill_name": {
                    "type": "string",
                    "description": "The exact name of the skill to load, as shown in the catalog.",
                }
            },
            "required": ["skill_name"],
        },
    },
}

SAVE_SKILL_TOOL = {
    "type": "function",
    "function": {
        "name": "save_skill",
        "description": (
            "Create or update a skill with the given name, description, and instructions. "
            "Use when the user wants to save a new skill or update an existing one."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {"type": "string", "description": "Skill name (unique per user)."},
                "description": {"type": "string", "description": "One-sentence summary shown in the catalog."},
                "instructions": {"type": "string", "description": "Full markdown instructions for the skill."},
            },
            "required": ["name", "description", "instructions"],
        },
    },
}

READ_SKILL_FILE_TOOL = {
    "type": "function",
    "function": {
        "name": "read_skill_file",
        "description": (
            "Read the content of a file attached to a skill. "
            "Use after load_skill returns a file list to inspect building-block files."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "skill_name": {"type": "string", "description": "Name of the skill that owns the file."},
                "filename": {"type": "string", "description": "Exact filename as returned by load_skill."},
            },
            "required": ["skill_name", "filename"],
        },
    },
}
```

### Pattern 2: Tool List Gating (SKIL-13)

In `openai_service.py`, `get_tools()` returns General Mode tools. Skill tools are added here.
`get_explorer_tools()` returns Explorer Mode tools — skill tools are NOT added there.

```python
# Source: openai_service.py get_tools()
def get_tools() -> list[dict]:
    tools = [SEARCH_DOCUMENTS_TOOL, QUERY_DOCUMENTS_TOOL, LS_TOOL, TREE_TOOL,
             GREP_TOOL, GLOB_TOOL, READ_DOCUMENT_TOOL, ANALYZE_DOCUMENT_TOOL,
             LOAD_SKILL_TOOL, SAVE_SKILL_TOOL, READ_SKILL_FILE_TOOL]  # ADD these 3
    if settings.web_search_enabled:
        tools.append(WEB_SEARCH_TOOL)
    return tools
# get_explorer_tools() is unchanged — skill tools not included
```

### Pattern 3: Skill Catalog Injection (SKIL-09)

At the top of `event_stream()` in `threads.py`, after the folder-scope query, add a skills catalog
query and augment `active_system_prompt` (General Mode only).

```python
# Source: threads.py event_stream() — follows folder_scope_note pattern
if body.agent_mode != "explorer":
    enabled_skills = (
        supabase.table("skills")
        .select("name, description")
        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
        .eq("is_enabled", True)
        .order("name")
        .execute()
    ).data or []

    if enabled_skills:
        catalog_lines = "\n".join(
            f"- **{s['name']}**: {s['description']}" for s in enabled_skills
        )
        catalog_note = (
            f"\n\n## Available Skills\n"
            f"The following skills are enabled. Call `load_skill(skill_name)` when the user's "
            f"request matches a skill description:\n{catalog_lines}"
        )
        active_system_prompt = active_system_prompt + catalog_note
```

**Critical detail:** Query uses `.or_()` to include both user-owned and global enabled skills.
Only `name` and `description` are fetched — full instructions are NOT injected (per REQUIREMENTS.md
"Out of Scope" table, which explicitly forbids injecting full instructions into every prompt).

### Pattern 4: skill_activated SSE Event (SKIL-12)

Emitted immediately when `load_skill` dispatch begins, before the Supabase query resolves.

```python
# In the tool dispatch block for load_skill:
elif tool_name == "load_skill":
    skill_name = args.get("skill_name", "")
    yield f"data: {json.dumps({'type': 'skill_activated', 'skill_name': skill_name})}\n\n"
    # ... then query DB and build tool_result
```

**Frontend side:** `api.ts streamMessage()` needs a new `onSkillActivated` callback parameter
and corresponding handler in `useMessages.ts`. The UI can display a badge or indicator.

### Pattern 5: load_skill Dispatch (SKIL-10, FILE-04)

```python
elif tool_name == "load_skill":
    skill_name = args.get("skill_name", "")
    yield f"data: {json.dumps({'type': 'skill_activated', 'skill_name': skill_name})}\n\n"
    # Resolve skill (own or global)
    skill_row = (
        supabase.table("skills")
        .select("id, name, description, instructions")
        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
        .eq("name", skill_name)
        .eq("is_enabled", True)
        .maybe_single()
        .execute()
    ).data
    if not skill_row:
        tool_result = json.dumps({"error": f"Skill '{skill_name}' not found or not enabled."})
    else:
        # Resolve attached file names (FILE-04)
        files = (
            supabase.table("skill_files")
            .select("filename")
            .eq("skill_id", skill_row["id"])
            .order("filename")
            .execute()
        ).data or []
        file_names = [f["filename"] for f in files]
        tool_result = json.dumps({
            "name": skill_row["name"],
            "instructions": skill_row["instructions"],
            "files": file_names,
        })
```

### Pattern 6: save_skill Dispatch (SKIL-11)

```python
elif tool_name == "save_skill":
    name = args.get("name", "").strip()
    description = args.get("description", "")
    instructions = args.get("instructions", "")
    # Check if skill already exists for this user (update) or needs creating (insert)
    existing = (
        supabase.table("skills")
        .select("id")
        .eq("user_id", current_user["id"])
        .eq("name", name)
        .maybe_single()
        .execute()
    ).data
    if existing:
        skill_id = existing["id"] if isinstance(existing, dict) else existing[0]["id"]
        supabase.table("skills").update({
            "description": description,
            "instructions": instructions,
        }).eq("id", skill_id).eq("user_id", current_user["id"]).execute()
        tool_result = json.dumps({"status": "updated", "name": name})
    else:
        supabase.table("skills").insert({
            "user_id": current_user["id"],
            "name": name,
            "description": description,
            "instructions": instructions,
        }).execute()
        tool_result = json.dumps({"status": "created", "name": name})
```

### Pattern 7: read_skill_file Dispatch (FILE-05)

```python
elif tool_name == "read_skill_file":
    skill_name = args.get("skill_name", "")
    filename = args.get("filename", "")
    # Resolve skill_id from name
    skill_row = (
        supabase.table("skills")
        .select("id, user_id")
        .or_(f"user_id.eq.{current_user['id']},is_global.eq.true")
        .eq("name", skill_name)
        .maybe_single()
        .execute()
    ).data
    if not skill_row:
        tool_result = json.dumps({"error": f"Skill '{skill_name}' not found."})
    else:
        s = skill_row[0] if isinstance(skill_row, list) else skill_row
        storage_path = f"{s['user_id']}/{s['id']}/{filename}"
        try:
            raw_bytes = supabase.storage.from_("skill-files").download(storage_path)
            tool_result = raw_bytes.decode("utf-8", errors="replace")
        except Exception as e:
            tool_result = json.dumps({"error": f"File '{filename}' not found: {e}"})
```

**Important:** `supabase.storage.from_("skill-files").download(path)` returns `bytes` directly
in supabase-py 2.x. No streaming — full file bytes are loaded into memory. This is acceptable for
skill files (max 10 MB per FILE-01, but in practice scripts and templates are kilobytes).

### Pattern 8: Frontend skill_activated Handling

```typescript
// api.ts streamMessage() — add new optional callback parameter
onSkillActivated?: (skillName: string) => void,

// In the SSE parsing loop:
} else if (parsed.type === "skill_activated" && onSkillActivated) {
  onSkillActivated(parsed.skill_name as string)
}
```

```typescript
// useMessages.ts sendMessage() — pass new callback to streamMessage()
// onSkillActivated (minimal — can be extended in Phase 12 for full UI)
(skillName) => {
  // Could set a transient state — Phase 12 handles full badge UI
  // For Phase 11: console.log or no-op is acceptable
},
```

For Phase 11, the `skill_activated` event just needs to be handled without errors. Full UI treatment
(badge, indicator) is a Phase 12 concern.

### Anti-Patterns to Avoid

- **Do NOT inject full skill instructions into the system prompt** — this is explicitly listed in
  REQUIREMENTS.md "Out of Scope" (10 skills × avg instructions = 5–15k tokens per request). The
  catalog pattern (name + description only) is the correct approach.
- **Do NOT make HTTP round-trips for save_skill** — call Supabase directly from the tool dispatch,
  same as all other tool implementations in threads.py.
- **Do NOT add skill tools to Explorer Mode** — the `get_explorer_tools()` function must remain
  unchanged. Skills are General Mode only (SKIL-13).
- **Do NOT use maybe_single() without the list guard** — the `isinstance(data, list)` guard from
  Phase 10 decisions must be applied wherever maybe_single() is used with the mock.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| File content download from Storage | Custom HTTP call to Supabase Storage URL | `supabase.storage.from_("skill-files").download(path)` | Already in supabase-py; handles auth headers |
| Skills lookup for load_skill | A separate service function | Inline Supabase query in tool dispatch | Consistent with all other tool implementations in threads.py |
| Skill name → skill_id resolution | Caching layer | Inline DB query per tool call | Skills are not hot-path enough to need caching; simple is correct |
| Catalog formatting | Complex template engine | f-string with join() | Plain string injection is the established pattern (see folder_scope_note) |

---

## Common Pitfalls

### Pitfall 1: maybe_single() Returns List in Test Mocks
**What goes wrong:** `maybe_single().execute()` returns a list in test mocks but a dict in real
Supabase. Code that does `result.data["id"]` crashes in production; code that does
`result.data[0]["id"]` crashes in tests.
**Why it happens:** supabase-py `maybe_single()` returns a single dict in production, but the mock
builder returns the raw list from `execute.return_value.data`.
**How to avoid:** Always use the guard: `row = data[0] if isinstance(data, list) else data`
**Warning signs:** `TypeError: list indices must be integers or slices, not str` in production, or
`IndexError` in tests.

### Pitfall 2: Skill Lookup Must Include Global Skills
**What goes wrong:** `load_skill` only queries by `user_id`, so it cannot load global skills.
**Why it happens:** Forgetting the `.or_()` filter pattern.
**How to avoid:** Always use `.or_(f"user_id.eq.{current_user['id']},is_global.eq.true")` when
querying skills in tool dispatch — same pattern as `list_skills` endpoint.
**Warning signs:** `load_skill` returns "not found" for global skills.

### Pitfall 3: Storage Path Must Use skill.user_id, Not current_user['id']
**What goes wrong:** For global skills, `current_user['id']` != the skill owner's `user_id`, so
the storage path is wrong.
**Why it happens:** The storage path is `owner_user_id/skill_id/filename` — it was set when the
skill owner uploaded the file. A different user reading a global skill must use the owner's ID.
**How to avoid:** In `read_skill_file`, select `user_id` from the skills table and use that as the
first path segment. The code examples above do this correctly.
**Warning signs:** 403 or 404 from Storage for global skill files.

### Pitfall 4: Catalog Injection on Every Turn (Performance)
**What goes wrong:** The catalog DB query fires on every chat turn, even in long conversations
where skills haven't changed.
**Why it happens:** There is no caching layer in the current architecture.
**How to avoid:** This is acceptable for v2.0 — a single lightweight query (name + description
only, no joins) is fast enough. Do NOT add premature caching complexity.
**Warning signs:** N/A — this is an accepted cost for simplicity.

### Pitfall 5: save_skill Must Handle Duplicate Names (Update vs Insert)
**What goes wrong:** LLM calls `save_skill` with a name that already exists, causing a unique
constraint violation on the `skills` table.
**Why it happens:** The LLM may call `save_skill` to update an existing skill.
**How to avoid:** Check for existing skill by name + user_id first (maybe_single). If found,
UPDATE; if not found, INSERT. See Pattern 6 above.
**Warning signs:** 500 error from `supabase.table("skills").insert()` with `duplicate key value`.

### Pitfall 6: Tool Result Truncation in Persistence
**What goes wrong:** The `load_skill` tool result (instructions can be long) gets truncated when
persisted to the `messages.tool_calls` JSONB column (existing 2000-char cap).
**Why it happens:** Existing code does `tool_result[:2000]` before persisting. Instructions may
exceed this.
**How to avoid:** This is expected and acceptable — the truncation affects only the stored history
(for multi-turn context reconstruction), not the live tool result sent to the LLM. The LLM receives
the full result during the current turn. No code change needed — document this as known behaviour.
**Warning signs:** History reconstruction in turn N+2 has truncated skill instructions.

---

## Code Examples

### Verified: Supabase Storage download() in supabase-py

```python
# supabase-py 2.x — download returns bytes directly
raw_bytes: bytes = supabase.storage.from_("bucket-name").download("path/to/file.py")
text_content: str = raw_bytes.decode("utf-8", errors="replace")
```

**Confidence:** HIGH — consistent with supabase-py 2.x Storage API. The `download` method is
documented as returning `bytes` (the raw file content).

### Verified: Existing SSE event pattern in threads.py

```python
# Yield a custom SSE event (follows existing sub_agent_start pattern)
yield f"data: {json.dumps({'type': 'skill_activated', 'skill_name': skill_name})}\n\n"
```

### Verified: System prompt augmentation pattern (from threads.py)

```python
# Pattern: augment active_system_prompt after mode selection, before messages list construction
if scoped_folder_path:
    folder_scope_note = f"\n\n**IMPORTANT: ...**"
    active_system_prompt = active_system_prompt + folder_scope_note
# Skill catalog follows same pattern
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inject all skill instructions into system prompt | Catalog (name+description) + on-demand load | Phase 11 design decision | Reduces per-turn token cost from ~15k to ~200 tokens for 10 skills |
| Static tool list | Mode-gated tool list | Phase 7 (explorer mode) | Explorer and General Mode have different tool sets |

---

## Open Questions

1. **Skill name uniqueness across user + global scope**
   - What we know: The `skills` table has a unique constraint on `(user_id, name)` for owned
     skills. Global skills from other users may share a name with a user's own skill.
   - What's unclear: If a user has a private skill named "SQL Writer" and a global skill also named
     "SQL Writer" exists, `load_skill("SQL Writer")` is ambiguous.
   - Recommendation: In `load_skill`, query with `user_id` priority — prefer owned over global when
     names conflict. Use `.order("is_global")` (ascending = owned first) and take the first result.

2. **skill_activated UI treatment in Phase 11 vs Phase 12**
   - What we know: SKIL-12 only requires the SSE event to be emitted. Phase 12 owns the Skills UI.
   - What's unclear: What minimal frontend change is required in Phase 11 vs deferred to Phase 12?
   - Recommendation: Phase 11 adds the `onSkillActivated` callback to `streamMessage()` in api.ts
     and `useMessages.ts` — wired but as a no-op or console.log. The actual badge/indicator UI
     is Phase 12 work. This satisfies SKIL-12 (event emitted) without scope creep.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest (already installed) |
| Config file | `backend/pytest.ini` or runs via `pytest` from `backend/` |
| Quick run command | `cd backend && python -m pytest tests/integration/test_threads_skills.py -x -q` |
| Full suite command | `cd backend && python -m pytest tests/ -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SKIL-09 | Skill catalog appended to system prompt when skills exist | unit | `pytest tests/integration/test_threads_skills.py::TestCatalogInjection -x` | Wave 0 |
| SKIL-10 | `load_skill` returns instructions + file list | integration | `pytest tests/integration/test_threads_skills.py::TestLoadSkill -x` | Wave 0 |
| SKIL-11 | `save_skill` creates new skill or updates existing | integration | `pytest tests/integration/test_threads_skills.py::TestSaveSkill -x` | Wave 0 |
| SKIL-12 | `skill_activated` SSE event emitted before tool_end | integration | `pytest tests/integration/test_threads_skills.py::TestSkillActivatedEvent -x` | Wave 0 |
| SKIL-13 | Explorer Mode does not receive skill tools | unit | `pytest tests/integration/test_threads_skills.py::TestExplorerModeNoSkills -x` | Wave 0 |
| FILE-04 | `load_skill` response includes filename list | integration | `pytest tests/integration/test_threads_skills.py::TestLoadSkillFiles -x` | Wave 0 |
| FILE-05 | `read_skill_file` returns decoded file content | integration | `pytest tests/integration/test_threads_skills.py::TestReadSkillFile -x` | Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/integration/test_threads_skills.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest tests/ -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/integration/test_threads_skills.py` — covers all 7 requirements above
- [ ] `conftest.py` already has all needed fixtures (`client`, `auth_headers`, `mock_builder`,
  `mock_execute_result`) — no new fixtures needed

*(Existing test infrastructure in conftest.py fully covers the new test file's requirements.)*

---

## Sources

### Primary (HIGH confidence)

- `backend/app/api/threads.py` (codebase) — full event_stream() implementation, SSE pattern, tool dispatch loop, system prompt augmentation pattern
- `backend/app/services/openai_service.py` (codebase) — all existing tool definitions, get_tools() / get_explorer_tools() pattern
- `backend/app/api/skills.py` (codebase) — existing CRUD endpoints, or_() pattern, maybe_single() guard, storage path convention
- `backend/tests/conftest.py` (codebase) — mock builder wiring, test patterns for new integration tests
- `.planning/REQUIREMENTS.md` — explicit "Out of Scope" prohibition on injecting full instructions

### Secondary (MEDIUM confidence)

- supabase-py 2.x Storage API — `download()` returns `bytes` (consistent across supabase-py 2.x changelog and source code inspection patterns)

### Tertiary (LOW confidence)

- None — all findings are derived from first-party codebase examination.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependencies; all patterns verified in existing codebase
- Architecture: HIGH — all patterns directly derived from live code in threads.py and openai_service.py
- Pitfalls: HIGH — most pitfalls derived from Phase 10 decisions log (STATE.md) and direct code review

**Research date:** 2026-03-31
**Valid until:** 2026-04-30 (stable architecture; supabase-py and OpenAI SDK are stable)
