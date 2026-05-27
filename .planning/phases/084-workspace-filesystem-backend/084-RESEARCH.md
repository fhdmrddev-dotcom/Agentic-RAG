# Phase 084: Workspace Filesystem Backend - Research

**Researched:** 2026-05-28
**Domain:** Per-thread virtual filesystem, hybrid storage (Postgres + Supabase Storage), file versioning, REST API, LLM tool handlers
**Confidence:** HIGH

## Summary

Phase 084 builds the backend layer for a per-thread workspace filesystem: database tables, hybrid inline/bucket storage, auto-versioning on every write, difflib-based diffing, five new tool handlers in the existing `tool_dispatcher.py` registry, REST API endpoints, and SSE events riding the existing Redis Streams infrastructure. No UI ships in this phase.

The competitive landscape confirms this is the right architecture. Every major AI platform (Claude.ai Artifacts, ChatGPT Canvas, Gemini Canvas, Cursor 3, Windsurf Cascade) and every serious OSS alternative (Open WebUI, LibreChat, LobeChat, AnythingLLM, Dify) has converged on per-session persistent file storage with version history. The consistent pattern is: database rows for metadata + object storage for large files + version rows for history. Our hybrid bytea/Supabase Storage approach with 256KB threshold aligns with PostgreSQL TOAST best practices and matches the pattern used by production platforms.

The riskiest aspect is NOT the storage layer (well-understood patterns) but the RLS design: this is the first table in the codebase to use FK-chain RLS (`auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)`) instead of a direct `user_id` column. The tool schema design also needs care since we're adding 5 tools to an already-large toolset (16 existing + 5 = 21, approaching Google's 20-tool accuracy threshold).

**Primary recommendation:** Build in 4 waves: (1) migration + RLS + bucket, (2) workspace_service.py with hybrid storage, (3) five tool handlers in tool_dispatcher.py, (4) REST API endpoints + SSE events. Use asyncpg for all hot-path writes (tool handlers inside agent loop), aexec for cold-path reads (REST endpoints).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-01:** Nested paths, UNIQUE(thread_id, path), no OS directories, no separate folders table
- **D-02:** Path validation: no leading/trailing whitespace, no double slashes, no `..` traversal, max 500 chars
- **D-03:** Single-file size cap 10 MB
- **D-04:** Soft 100 files/thread limit (warning, not block)
- **D-05:** 256KB hybrid storage threshold (inline bytea vs Storage bucket), configurable via app_settings
- **D-06:** Auto-versioning every write via workspace_file_versions; difflib for diffs
- **D-07:** Diff format at Claude's discretion (unified text, JSON delta, or both)
- **D-08:** REST API endpoints curl-able for dev testing
- **D-09:** No UI in this phase
- **D-10:** Two SSE events: workspace_file_written, workspace_file_deleted
- **D-11:** RLS via FK chain: auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)
- **D-12:** Storage bucket RLS with path prefix {user_id}/{thread_id}/{filename}
- **D-13:** Five tools in tool_dispatcher.py: workspace_write, workspace_read, workspace_list, workspace_delete, workspace_diff
- **D-14:** Tool definitions in openai_service.py:get_tools()

### Claude's Discretion
- Whether workspace_service.py is one file or split into service + storage adapter
- Diff output format details (unified text vs JSON delta vs both)
- Migration numbering starting point (next after 053)
- Whether workspace_file_written SSE includes content preview or metadata-only
- Test strategy: unit tests, integration tests, or both

### Deferred Ideas (OUT OF SCOPE)
- User inline editing of workspace files
- Workspace files as RAG corpus
- Cross-thread file sharing
- Auto-pruning of old versions
- File type restrictions / content scanning
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WS-01 | Agent can write a file to per-thread workspace via workspace_write(path, content) -- persists across turns and reloads | Hybrid storage pattern (Section: Architecture Patterns), tool handler registration (Section: Standard Stack), asyncpg write path (Section: Code Examples) |
| WS-02 | Agent can read workspace files via workspace_read(path) with configurable max chars and truncation | Content cap pattern from Pitfall 4 in PITFALLS.md research, tool schema design (Section: Code Examples) |
| WS-03 | Agent can list via workspace_list(prefix) and delete via workspace_delete(path) | REST API + tool handler patterns (Section: Architecture Patterns) |
| WS-04 | Every workspace_write auto-creates version row; workspace_diff returns structured diff | difflib unified_diff pattern (Section: Code Examples), delta storage approach (Section: Versioning Patterns) |
| WS-05 | Files <= threshold stored inline in Postgres; larger in Supabase Storage bucket -- threshold tunable | PostgreSQL TOAST best practices (Section: Common Pitfalls), Supabase Storage patterns (Section: Standard Stack) |
| WS-06 | Per-thread scoping with UNIQUE path constraint and RLS -- cross-user isolation | FK-chain RLS pattern (Section: Architecture Patterns), Storage bucket RLS (Section: Code Examples) |
| WS-07 | SSE events for workspace writes/deletes via existing run:{run_id} Redis Stream | Existing _emit() pattern (Section: Code Examples), proven pattern from ARCHITECTURE.md Section 5.1 |
</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| File write/read/delete (tool handlers) | API / Backend | Database / Storage | Tool handlers execute in the agent loop; they call workspace_service which talks to Postgres + Storage |
| Hybrid storage routing | API / Backend | Database / Storage | The 256KB threshold decision lives in workspace_service.py; Postgres and Storage are dumb stores |
| Version tracking | Database / Storage | -- | Pure DB concern: INSERT into workspace_file_versions on every write |
| Diff computation | API / Backend | -- | Python difflib runs in the backend; result stored as JSONB in version row |
| RLS enforcement | Database / Storage | -- | Postgres RLS policies enforce access at the query level; backend never bypasses |
| SSE event emission | API / Backend | -- | _emit() XADD to Redis Stream; consumed by frontend in Phase 086 |
| REST API endpoints | API / Backend | -- | FastAPI router; cold-path reads via aexec or asyncpg |
| Path validation | API / Backend | -- | Python regex/validation in workspace_service before any DB write |

## Standard Stack

### Core (No New Dependencies)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `asyncpg` | existing (0.30.0) | Hot-path DB writes for workspace_files, workspace_file_versions | Already in project via Phase 073; proven pattern in `backend/app/db/runs.py` [VERIFIED: codebase] |
| `supabase-py` | existing (2.x) | Storage bucket uploads for files > 256KB; cold-path reads via `aexec` | Already in project; proven pattern in `sandbox_service.py:harvest_output_files` [VERIFIED: codebase] |
| `difflib` (stdlib) | Python 3.11+ | Diff computation between file versions | Python stdlib; no external dep needed. `unified_diff` produces standard unified-diff format [VERIFIED: Python docs] |
| `mimetypes` (stdlib) | Python 3.11+ | MIME type detection from file path | Python stdlib; used to set mime_type column on workspace_files rows |
| `re` (stdlib) | Python 3.11+ | Path validation regex | Python stdlib; enforces D-02 path rules |
| FastAPI | existing (0.115.x) | REST API router for workspace endpoints | Already in project; follows existing `sandbox_outputs.py` router pattern [VERIFIED: codebase] |

### Supporting (Existing Project Dependencies Used)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `starlette.concurrency.run_in_threadpool` | existing | Wrap sync supabase-py Storage uploads in async handlers | Any supabase.storage.from_().upload() call per D-v2.5-01 [VERIFIED: codebase pattern] |
| `redis.asyncio` | existing | _emit() XADD for SSE events | workspace_file_written/deleted events per D-10 [VERIFIED: codebase] |
| `pydantic` | existing (2.x) | Response models for REST API endpoints | Type-safe response schemas for /workspace/files endpoints [VERIFIED: codebase pattern] |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| asyncpg for hot-path writes | aexec (supabase-py) | aexec adds threadpool overhead per call; asyncpg is direct async. Hot-path writes (inside agent loop) must use asyncpg per D-073-04 |
| difflib for diffs | jsondiff library | jsondiff is for JSON object diffs, not text file diffs. workspace files are primarily text; unified_diff is the right tool |
| bytea inline storage | Always use Storage bucket | Adds a round-trip for every small file read; 256KB is well below PostgreSQL TOAST threshold; inline is faster for small files |
| Version rows (full content per version) | Content-addressable storage (CAS) | CAS adds dedup complexity for marginal storage savings; version rows are simpler and match competitive precedent (ChatGPT Canvas, Open WebUI). Dedup deferred |

**No new pip or npm packages required for this phase.** [VERIFIED: all dependencies already in project]

## Architecture Patterns

### System Architecture Diagram

```
User prompt: "Write a report to /reports/weekly.md"
    |
    v
agent_runner (threads.py) -- LLM returns tool_call: workspace_write
    |
    v
dispatch_tool("workspace_write", args, ctx) -- tool_dispatcher.py
    |
    v
_handle_workspace_write(args, ctx) -- tool_dispatcher.py (new handler)
    |
    v
workspace_service.write_file(pool, thread_id, user_id, path, content)
    |
    +-- validate_path(path) -- regex check per D-02
    |
    +-- check_file_count(pool, thread_id) -- soft 100-file warning per D-04
    |
    +-- check_file_size(content) -- 10MB cap per D-03
    |
    +-- len(content) <= 256KB?
    |       |
    |       YES --> UPSERT workspace_files SET content_inline = $content
    |       |       content_storage_path = NULL
    |       |
    |       NO  --> upload to workspace-files bucket at
    |               {user_id}/{thread_id}/{file_id}/v{version}
    |               UPSERT workspace_files SET content_storage_path = $path
    |               content_inline = NULL
    |
    +-- INSERT workspace_file_versions (version N, content, delta_from_prev)
    |       |
    |       +-- if version > 1: compute delta via difflib.unified_diff
    |
    +-- detect MIME type via mimetypes.guess_type(path)
    |
    v
_emit(redis, run_id, 'workspace_file_written',
      path="/reports/weekly.md", version=2, size_bytes=1234,
      mime_type="text/markdown")
    |
    v
ToolResult(result=json.dumps({status, path, version, size_bytes}))
```

### Recommended Project Structure

```
backend/
  app/
    services/
      workspace_service.py      # NEW: write_file, read_file, list_files,
                                #       delete_file, get_diff, get_versions
                                #       Hybrid storage logic (inline vs bucket)
                                #       Path validation, size checks
    db/
      workspace.py              # NEW: asyncpg helpers for workspace tables
                                #       (upsert_file, insert_version, etc.)
    api/
      workspace.py              # NEW: FastAPI router for REST endpoints
                                #       GET /threads/{id}/workspace/files
                                #       GET .../files/{id}/content
                                #       GET .../files/{id}/versions
                                #       GET .../files/{id}/diff
    models/
      workspace.py              # NEW: Pydantic models for API responses
  supabase/
    migrations/
      054_workspace_files.sql   # NEW: tables, indexes, RLS, bucket
```

### Pattern 1: Hybrid Storage Write (Hot Path via asyncpg)

**What:** Write file content either inline (bytea) or to Storage bucket based on size threshold.
**When to use:** Every `workspace_write` tool call inside the agent loop.

```python
# Source: D-05 (256KB threshold), existing sandbox_service.py pattern
async def write_file(
    pool: asyncpg.Pool,
    supabase: Client,
    *,
    thread_id: str,
    user_id: str,
    path: str,
    content: bytes,
) -> dict:
    validate_path(path)
    if len(content) > MAX_FILE_SIZE:
        raise FileTooLargeError(f"File exceeds {MAX_FILE_SIZE} byte limit")

    threshold = 256 * 1024  # D-05, configurable via app_settings later
    is_inline = len(content) <= threshold

    # UPSERT the file row (asyncpg hot path per D-073-04)
    file_row = await pool.fetchrow(
        """
        INSERT INTO workspace_files (thread_id, path, size_bytes, mime_type,
                                     content_inline, content_storage_path,
                                     created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (thread_id, path) DO UPDATE SET
            size_bytes = EXCLUDED.size_bytes,
            mime_type = EXCLUDED.mime_type,
            content_inline = EXCLUDED.content_inline,
            content_storage_path = EXCLUDED.content_storage_path,
            updated_at = now()
        RETURNING id, (xmax = 0) AS is_new
        """,
        thread_id, path, len(content),
        guess_mime_type(path),
        content if is_inline else None,
        None,  # storage_path filled below if not inline
        user_id,
    )
    file_id = file_row["id"]

    if not is_inline:
        # Upload to Storage bucket (sync call, wrapped per D-v2.5-01)
        storage_path = f"{user_id}/{thread_id}/{file_id}/v{version}"
        await run_in_threadpool(
            supabase.storage.from_("workspace-files").upload,
            storage_path, content,
            {"content-type": guess_mime_type(path), "upsert": "true"},
        )
        await pool.execute(
            "UPDATE workspace_files SET content_storage_path = $1 WHERE id = $2",
            storage_path, file_id,
        )

    # Create version row
    version = await _create_version(pool, file_id, content, ...)
    return {"file_id": file_id, "version": version, "size_bytes": len(content)}
```

### Pattern 2: FK-Chain RLS (New Pattern for This Project)

**What:** Row-level security that checks ownership via a JOIN to the `threads` table instead of a direct `user_id` column.
**When to use:** workspace_files and workspace_file_versions tables.
**Why new:** All existing tables (messages, runs, sandbox_files) have a direct `user_id` column. workspace_files uses `thread_id` as the ownership key, requiring a subquery to threads.

```sql
-- Source: D-11 decision, Supabase RLS docs
ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workspace files"
  ON workspace_files
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)
  )
  WITH CHECK (
    auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)
  );
```

**Important:** This subquery executes on EVERY row access. For workspace_list queries returning many files, the Postgres query planner should optimize this with the existing threads PK index. Verify with EXPLAIN ANALYZE during testing.

### Pattern 3: Tool Handler Registration (Proven Pattern from Phase 083)

**What:** Register new workspace tool handlers in the existing `_TOOL_REGISTRY` dict.
**When to use:** Adding each of the 5 workspace tools.

```python
# Source: tool_dispatcher.py existing pattern [VERIFIED: codebase]
async def _handle_workspace_write(args: dict, ctx: ToolContext) -> ToolResult:
    content = args["content"].encode("utf-8")
    result = await write_file(
        ctx.pool, ctx.supabase,
        thread_id=ctx.thread_id, user_id=ctx.current_user["id"],
        path=args["path"], content=content,
    )
    await ctx.emit(ctx.redis, ctx.run_id, 'workspace_file_written',
                   path=args["path"], version=result["version"],
                   size_bytes=result["size_bytes"],
                   mime_type=guess_mime_type(args["path"]))
    return ToolResult(result=json.dumps(result))

# Register in _TOOL_REGISTRY
_TOOL_REGISTRY["workspace_write"] = _handle_workspace_write
_TOOL_REGISTRY["workspace_read"] = _handle_workspace_read
_TOOL_REGISTRY["workspace_list"] = _handle_workspace_list
_TOOL_REGISTRY["workspace_delete"] = _handle_workspace_delete
_TOOL_REGISTRY["workspace_diff"] = _handle_workspace_diff
```

### Anti-Patterns to Avoid

- **DO NOT add a `user_id` column to `workspace_files`:** The ownership chain goes through `thread_id -> threads.user_id`. Adding a redundant `user_id` column creates a denormalization that can drift. The FK-chain RLS pattern is the correct approach per D-11. [VERIFIED: CONTEXT.md decision]

- **DO NOT store Storage bucket signed URLs in the database:** Signed URLs expire (60s-3600s). Store the raw storage_path (`{user_id}/{thread_id}/{file_id}/v{version}`) and generate signed URLs on-demand when serving content via REST API. This matches the `sandbox_outputs.py` pattern. [VERIFIED: codebase]

- **DO NOT use aexec for workspace writes inside the agent loop:** Per D-073-04, hot-path writes (anything inside the agent_runner iteration) MUST use the asyncpg pool. The workspace tool handlers are hot-path. REST endpoint reads (cold path) can use aexec. [VERIFIED: codebase convention]

- **DO NOT return raw bytea content in workspace_read tool results for binary files:** Return metadata-only for binary MIME types (images, PDFs, etc.) with a note directing the agent to reference the file in the panel. [CITED: PITFALLS.md Pitfall 4]

- **DO NOT skip content cap on workspace_read:** Must cap at configurable max chars (recommend 8K chars) with truncation notice per PITFALLS.md Pitfall 4. [CITED: PITFALLS.md]

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Text diff computation | Custom diff algorithm | Python stdlib `difflib.unified_diff()` | O(n*m) optimal algorithm; handles edge cases (binary files, empty content, unicode). Standard unified-diff format understood by all diff viewers [VERIFIED: Python docs] |
| MIME type detection | Extension-to-MIME mapping dict | Python stdlib `mimetypes.guess_type()` | Maintains 300+ MIME mappings; handles compound extensions (.tar.gz). Falls back gracefully to application/octet-stream [VERIFIED: Python docs] |
| Path validation | Ad-hoc string checks | Compiled regex pattern | Regex is faster for repeated validation; captures all D-02 rules in one pattern: `^/[a-zA-Z0-9._/ -]+$` with length check and no `..` [ASSUMED] |
| Storage bucket upload | Direct HTTP to Supabase Storage API | `supabase.storage.from_("bucket").upload()` | supabase-py handles auth headers, retry, content-type. Already proven in sandbox_service.py and harvest_output_files [VERIFIED: codebase] |
| Signed URL generation | Manual JWT signing | `supabase.storage.from_("bucket").create_signed_url()` | Already proven in sandbox_outputs.py; handles URL formatting and TTL [VERIFIED: codebase] |

**Key insight:** This phase introduces zero new external dependencies. Every capability (storage, diffing, MIME detection, RLS) uses existing project infrastructure or Python stdlib. The innovation is in the architecture (hybrid storage routing, FK-chain RLS, version tracking), not in new libraries.

## Competitive Landscape Deep Dive

### Big Provider Implementations

#### Claude.ai Artifacts
- **Storage model:** Persistent storage up to 20MB per artifact on paid plans (Pro, Max, Team, Enterprise). Each artifact is a standalone unit tied to a conversation. [CITED: support.claude.com/en/articles/9487310]
- **Version history:** Artifacts track revisions; users can browse previous versions. No public details on delta storage vs full-content-per-version. [CITED: albato.com/blog/publications/how-to-use-claude-artifacts-guide]
- **Rendering:** Live Artifacts (April 2026) can execute React/HTML in sandboxed iframes with persistent storage via a Firebase-backed key-value API. Regular artifacts use sandboxed rendering with no localStorage/sessionStorage access. [CITED: eigent.ai/blog/claude-live-artifacts-guide]
- **Relevance to us:** Claude's 20MB cap is generous; our 10MB (D-03) is conservative but sufficient. Their version history approach validates our auto-version-per-write design. Key difference: Claude artifacts are per-conversation but NOT per-thread in a multi-thread sense -- each conversation is implicitly a thread.

#### ChatGPT Canvas
- **Storage model:** Documents persist within conversations. Every change is auto-saved. Full version history with forward/backward navigation arrows. [CITED: help.openai.com/en/articles/9930697]
- **Version history:** Built-in version control system with "Show Changes" button showing additions/deletions in diff view. Side-by-side comparison between drafts. [CITED: certlibrary.com/blog/comprehensive-guide-to-chatgpt-canvas]
- **Rendering:** Inline code editor with syntax highlighting. Supports both text documents and code. No public details on storage backend. [ASSUMED: SaaS product, likely proprietary]
- **Relevance to us:** Canvas's version arrows + diff view validate our workspace_diff tool and version history API. Their "Show Changes" is exactly what our Phase 087 DiffViewer will consume from workspace_diff output.

#### Google Gemini Canvas
- **Storage model:** Each update generates a completely new Canvas artifact; existing artifact is NOT modified or versioned in-place. Users navigate versions via undo/redo or previous/next arrows. [CITED: docs.cloud.google.com/gemini/enterprise/docs/assistant-canvas]
- **Duplicate creation:** Known limitation -- editing creates "V2" labeled copies, causing workspace clutter. [CITED: geeky-gadgets.com/google-gemini-file-creation-update]
- **Relevance to us:** Gemini's approach (create new artifact per edit) is explicitly what we are NOT doing. Our UPSERT + version rows approach avoids the "workspace clutter" problem Gemini users complain about. This validates D-01 (UNIQUE(thread_id, path) with version rows for history).

#### Cursor 3 / Windsurf Cascade (IDE Agents)
- **Cursor 3:** Uses git worktrees for file isolation per agent. Plans saved to `.cursor/plans/` as Markdown. Multi-repo workspace support. Changes reviewed via diff panel. [CITED: infoq.com/news/2026/04/cursor-3-agent-first-interface, cursor.com/blog/agent-best-practices]
- **Windsurf Cascade:** Indexes project via "Fast Context" system. Workflows stored as `.md` files in `.windsurf/workflows/`. Multi-file edits with diff-staging and per-step approval. Memories system persists context across sessions. [CITED: docs.windsurf.com/plugins/cascade/cascade-overview]
- **VS Code Copilot Agents Window:** Files tab + Changes tab with multi-file diff view. Git worktree isolation for agent sessions. "Add Feedback" inline in diff view. [CITED: code.visualstudio.com/docs/copilot/agents/agents-window]
- **Relevance to us:** IDE agents operate on actual filesystems (git worktrees). Our virtual filesystem (DB rows) is the right choice for a web-based chat platform -- no volume management, built-in versioning, cross-worker access, backup. The diff review pattern (Cursor/VS Code) validates our workspace_diff tool.

### Open Source Community Deep Dive

#### Open WebUI (Most Mature OSS Implementation)
- **Architecture:** SQLAlchemy ORM + Alembic migrations. SQLite default, PostgreSQL for production. S3/GCS/Azure for cloud storage. [CITED: docs.openwebui.com database schema]
- **File storage:** Dedicated `file` table with `id, user_id, hash, filename, path, meta (JSON), data (JSON)`. Junction table `chat_file` links files to chats with optional `message_id` for message-level attachment. [CITED: github.com/open-webui/docs database-schema.md]
- **Artifacts:** Key-value storage API for artifact persistence. Personal and shared data scopes. Version selector UI. Sandpack-style rendering for HTML/SVG. [CITED: docs.openwebui.com/features artifacts]
- **Access control:** Unified `access_grant` table managing permissions across resource types (files, chats, knowledge, tools) with `resource_type, resource_id, principal_type, principal_id, permission`. [CITED: github.com/open-webui/docs database-schema.md]
- **Relevance to us:** Open WebUI's `chat_file` junction table is simpler than our approach (we embed thread_id directly in workspace_files). Their `access_grant` table is more flexible (generic RBAC) but overkill for our single-user-per-thread model. Their file hash column is interesting for dedup but deferred per our scope.

#### LibreChat
- **Artifacts:** Uses CodeSandbox's Sandpack library for rendering HTML/JS code. Artifacts configured at agent level, not app-wide. [CITED: librechat.ai/docs/features/artifacts]
- **File storage:** Per-conversation file uploads indexed by RAG API. No published workspace filesystem abstraction. [CITED: librechat.ai/docs/configuration/rag_api]
- **2025 roadmap:** Teams, groups, workspaces (#4730), file storage limits per user (#3057), conversation/file retention settings (#2365). [CITED: librechat.ai/blog/2025-02-20_2025_roadmap]
- **Relevance to us:** LibreChat is behind us on workspace features. Their roadmap validates that persistent file storage and per-user limits are the right direction. Our D-03/D-04 limits are ahead of their planned feature.

#### LobeChat
- **File storage:** S3-compatible object storage (recently switched to RustFS). Client-side image storage in IndexedDB. PostgreSQL + Redis for server-side. [CITED: github.com/lobehub/lobe-chat s3.mdx]
- **Artifacts:** Replicates Claude Artifacts UX -- SVG graphics, HTML pages, rich documents rendered inline. [CITED: lobehub.com/changelog/2024-09-20-artifacts]
- **Known issues:** Ghost files from failed uploads consuming storage. No file manager interface for cleanup. [CITED: github.com/lobehub/lobe-chat issues/10780]
- **Relevance to us:** LobeChat's ghost file problem validates our design choice of DB-backed files with explicit CRUD operations (no orphan files possible since the DB is the source of truth). Their S3-compatible storage approach matches our Supabase Storage (S3 under the hood).

#### AnythingLLM
- **Storage model:** Dual-scope architecture. Thread-scoped files: attached in chat, exist only in current session. Workspace-scoped files: embedded via RAG, available across all threads in workspace. [CITED: docs.anythingllm.com/chatting-with-documents/introduction]
- **Database:** SQLite for config + vector DB (various: LanceDB, Chroma, Pinecone, etc.) for embeddings. [CITED: docs.anythingllm.com/installation-desktop/storage]
- **Relevance to us:** AnythingLLM's dual-scope model is interesting but different from ours. Our workspace files are strictly per-thread (D-01), not workspace-scoped. Their thread-scoped attachments are ephemeral; ours persist across turns (WS-01).

#### Dify
- **Storage model:** Key-value (KV) storage system for plugin persistence. Data stored in bytes format. Workspace-level isolation. [CITED: docs.dify.ai/en/develop-plugin/features-and-specs/plugin-types/persistent-storage-kv]
- **File handling:** S3-compatible cloud storage for knowledge base uploads, temporary workflow assets, logs. Tool outputs support image URLs, links, text, files, JSON. [CITED: fast.io/resources/dify-file-storage]
- **Known issues:** No file retention management; temporary files accumulate. [CITED: github.com/langgenius/dify/discussions/11219]
- **Relevance to us:** Dify's KV storage is simpler than our file-with-versioning approach. Their lack of retention management validates our decision to defer auto-pruning while still tracking versions (future-proofing). Their plugin storage model is relevant for Phase 085 (plugin contract), not Phase 084.

#### Jan.ai
- **Architecture:** Local-first Electron app. Chat threads stored locally. Go microservices for server edition with S3 integration. [CITED: github.com/janhq/jan]
- **Relevance to us:** Jan's local-first model is architecturally different (filesystem-native). Not directly applicable to our web-based approach, but their per-user isolation pattern (each user has own chat history, documents, assistants) validates our thread-level scoping.

### Competitive Pattern Synthesis

| Pattern | Claude.ai | ChatGPT | Gemini | Open WebUI | Our Design |
|---------|-----------|---------|--------|------------|------------|
| Per-session persistence | Yes | Yes | Yes | Yes | Yes (D-01, WS-01) |
| Version history | Yes | Yes (arrows) | Sort of (clones) | Yes (selector) | Yes (auto-version, D-06) |
| Diff view | No | Yes ("Show Changes") | No | No | Yes (workspace_diff, D-06) |
| Size cap | 20MB | Unknown | Unknown | Configurable | 10MB (D-03) |
| File count limit | Unknown | Unknown | Unknown | Unknown | 100 soft (D-04) |
| Hybrid storage | Unknown (SaaS) | Unknown (SaaS) | Firebase KV | SQLite + S3 | Postgres bytea + Storage (D-05) |
| RLS / access control | SaaS auth | SaaS auth | Google auth | access_grant table | FK-chain RLS (D-11) |

**Key takeaway:** Our design is MORE feature-complete than any single OSS competitor at the storage layer. The diff tool (workspace_diff) is ahead of even ChatGPT Canvas, which only shows latest-version changes, not arbitrary version-pair diffs.

## Versioning and Diffing Patterns

### Chosen Approach: Full Content Per Version + Computed Delta

**Why full content per version (not delta-only storage):**
1. **Fast reads:** Reading any version is a single row fetch, no chain of deltas to reconstruct
2. **Independent diffs:** Can diff any two versions, not just sequential ones
3. **Simpler implementation:** No dependency on previous versions being intact
4. **Competitive precedent:** ChatGPT Canvas and Open WebUI both appear to store full content per version [ASSUMED: based on version-selector UX implying random access]

**Delta storage for optimization:**
The `delta_from_prev` JSONB column stores the computed diff FROM the previous version. This is a read optimization: the Phase 087 DiffViewer can render the delta directly without fetching two full versions and diffing client-side.

### Diff Format Recommendation (Claude's Discretion per D-07)

**Recommendation: Unified text diff as the primary format, stored as JSONB array.**

```python
# Source: Python difflib docs [VERIFIED: docs.python.org/3/library/difflib.html]
import difflib

def compute_delta(old_content: str, new_content: str, path: str) -> dict:
    """Compute structured delta between two text file versions."""
    old_lines = old_content.splitlines(keepends=True)
    new_lines = new_content.splitlines(keepends=True)

    # Generate unified diff hunks
    diff_lines = list(difflib.unified_diff(
        old_lines, new_lines,
        fromfile=f"v{from_version}", tofile=f"v{to_version}",
        lineterm="",
    ))

    # Structure as JSONB for the panel DiffViewer
    return {
        "format": "unified",
        "hunks": _parse_hunks(diff_lines),
        "stats": {
            "additions": sum(1 for l in diff_lines if l.startswith("+") and not l.startswith("+++")),
            "deletions": sum(1 for l in diff_lines if l.startswith("-") and not l.startswith("---")),
        },
        "truncated": len(diff_lines) > 500,  # Cap per Pitfall 15
    }
```

**Rationale:**
- Unified diff is the universal format (git, GitHub, VS Code all use it)
- Stored as JSONB for efficient frontend rendering without re-parsing
- Stats (additions/deletions) enable summary display before full diff load
- Truncation flag prevents browser freeze on large diffs (Pitfall 15 from PITFALLS.md)
- Binary files: store `{"format": "binary", "note": "Binary file changed"}` instead of attempting text diff

### Content-Addressable Storage: NOT Recommended

Content-addressable storage (hash-based dedup) would save disk space when the same content is written multiple times. However:
- Adds complexity (hash computation, reference counting for GC)
- Marginal savings (workspace files are agent-authored, rarely identical)
- Dedup deferred to post-v2.7 per CONTEXT.md deferred ideas
[ASSUMED: based on competitive analysis showing no OSS platform uses CAS for workspace files]

## Tool Schema Design

### Cross-Provider Compatibility

The 5 workspace tools follow OpenAI function calling format, which is natively supported by all 4 provider paths in this codebase:
- **OpenAI:** Native function calling [VERIFIED: codebase openai_service.py]
- **Anthropic:** Mapped via anthropic_service.py tool_use blocks [VERIFIED: codebase]
- **Google:** Mapped via google_service.py function declarations [VERIFIED: codebase]
- **OpenRouter:** OpenAI-compatible function calling [VERIFIED: codebase]

### Tool Count Budget Warning

Current tools: 16. Adding 5 workspace tools = 21 total. OpenAI documentation warns that tool accuracy degrades above 20 tools. [CITED: developers.openai.com/api/docs/guides/function-calling -- "Keep initially available functions under 20"]

**Mitigation options:**
1. Group workspace tools under a single `workspace` tool with an `action` parameter (reduces count by 4)
2. Make workspace tools conditional on a thread having workspace activity (lazy registration)
3. Accept the 21-tool count since Google is the only provider with documented degradation >20

**Recommendation:** Keep as 5 separate tools. The tool descriptions are more discoverable as individual tools. The 21 count is only 1 over the threshold, and the existing 16 tools already exceed Google's comfort zone. Monitor tool-calling accuracy in UAT across providers. [ASSUMED: marginal accuracy impact at 21 vs 20]

### Recommended Tool Schemas

```python
# Source: openai_service.py existing patterns [VERIFIED: codebase]
WORKSPACE_WRITE_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_write",
        "description": (
            "Write or update a file in the thread's persistent workspace. "
            "The workspace is a virtual filesystem that persists across conversation turns. "
            "Use for saving reports, plans, code, data exports, or any content the user "
            "might want to reference later. Files are versioned automatically -- every "
            "write creates a new version. "
            "Path must start with / and use forward slashes (e.g. /reports/weekly.md). "
            "Maximum file size: 10MB. Workspace holds up to 100 files per thread."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path in the workspace (e.g. /plan.md, /data/results.csv). Must start with /.",
                },
                "content": {
                    "type": "string",
                    "description": "File content to write. For text files, this is the full content. Binary files are not supported via this tool.",
                },
            },
            "required": ["path", "content"],
        },
    },
}

WORKSPACE_READ_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_read",
        "description": (
            "Read a file from the thread's workspace. Returns file content (truncated "
            "for large files). Use start_line and end_line for targeted reads of large files. "
            "For binary files, returns metadata only (size, type)."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to read (e.g. /plan.md).",
                },
                "start_line": {
                    "type": "integer",
                    "description": "Optional: start reading from this line number (1-indexed).",
                },
                "end_line": {
                    "type": "integer",
                    "description": "Optional: stop reading at this line number (inclusive).",
                },
            },
            "required": ["path"],
        },
    },
}

WORKSPACE_LIST_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_list",
        "description": (
            "List files in the thread's workspace, optionally filtered by path prefix. "
            "Returns file paths, sizes, MIME types, and last-modified timestamps."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "prefix": {
                    "type": "string",
                    "description": "Optional path prefix to filter (e.g. /reports/ lists only files under /reports/). Omit to list all files.",
                },
            },
            "required": [],
        },
    },
}

WORKSPACE_DELETE_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_delete",
        "description": (
            "Delete a file from the thread's workspace. This also deletes all version history. "
            "Use with caution -- deletion is permanent."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to delete (e.g. /draft.md).",
                },
            },
            "required": ["path"],
        },
    },
}

WORKSPACE_DIFF_TOOL = {
    "type": "function",
    "function": {
        "name": "workspace_diff",
        "description": (
            "Show the differences between two versions of a workspace file. "
            "Returns a unified diff with additions and deletions. "
            "Use to review changes made to a file across versions."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "File path to diff (e.g. /plan.md).",
                },
                "from_version": {
                    "type": "integer",
                    "description": "Version number to diff from (older version). Omit to use the previous version.",
                },
                "to_version": {
                    "type": "integer",
                    "description": "Version number to diff to (newer version). Omit to use the latest version.",
                },
            },
            "required": ["path"],
        },
    },
}
```

## Common Pitfalls

### Pitfall 1: FK-Chain RLS Subquery Performance

**What goes wrong:** The RLS policy `auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)` executes a subquery for every row evaluated. On a `workspace_list` returning 50 files, this means 50 subquery executions.
**Why it happens:** Postgres RLS policies are appended to every query as additional WHERE conditions. The subquery is re-evaluated per row unless the planner can hoist it.
**How to avoid:** (1) The `threads.id` column has a PRIMARY KEY index, so the subquery is O(1) per row. (2) For bulk operations, prefer asyncpg queries in the service layer where the backend already knows the user_id (bypass RLS via service role or pass user_id in WHERE). (3) REST endpoints going through supabase-py will use RLS; tool handlers going through asyncpg will add explicit WHERE clauses.
**Warning signs:** `workspace_list` taking >50ms for threads with 100 files. Profile with `EXPLAIN ANALYZE`.
[ASSUMED: subquery performance, based on PostgreSQL documentation for indexed subqueries]

### Pitfall 2: Workspace Read Content Leak into LLM Context

**What goes wrong:** `workspace_read` returns file content as tool_result, which enters the LLM context. A 256KB file at ~3 chars/token = ~85K tokens, potentially blowing the context window.
**Why it happens:** The agent writes a large file, then later calls `workspace_read` on it.
**How to avoid:** Cap `workspace_read` output at configurable max chars (recommend 8,192 chars = ~2.7K tokens). Return truncation notice: `"[Truncated at 8192 chars. Full file is {size} bytes. Use start_line/end_line for specific sections.]"`. Binary files return metadata only.
**Warning signs:** Token consumption spikes when workspace_read is called on large files.
[CITED: PITFALLS.md Pitfall 4]

### Pitfall 3: Storage Bucket Upload Race with Version Row Insert

**What goes wrong:** For files >256KB, the flow is: (1) UPSERT workspace_files row, (2) upload to Storage bucket, (3) INSERT version row. If the upload fails between steps 1 and 2, the DB row exists but the content is unreachable.
**Why it happens:** Supabase Storage uploads are HTTP calls that can fail independently of DB transactions.
**How to avoid:** (1) Upload to Storage FIRST, then UPSERT the DB row in a single asyncpg transaction. If upload fails, no DB state is created. (2) Store a `storage_status` column or use the absence of `content_storage_path` as the "upload in progress" indicator.
**Warning signs:** workspace_read returning 404 for files that workspace_list shows as existing.
[ASSUMED: based on general distributed systems patterns]

### Pitfall 4: Soft File Count Warning Not Reaching the Agent

**What goes wrong:** D-04 says "write succeeds but tool result includes a warning." If the warning is buried in JSON, the LLM may ignore it and keep writing files.
**Why it happens:** LLMs skip structured metadata in tool results unless the warning is prominently formatted.
**How to avoid:** Format the warning as the FIRST line of the tool result: `"WARNING: 102/100 files in workspace. Consider deleting unused files.\n\n{...normal result...}"`. Prefix text is more likely to influence the next LLM decision than a nested JSON field.
[ASSUMED: based on LLM behavior patterns with tool results]

### Pitfall 5: Migration Numbering Collision

**What goes wrong:** Latest migration is 053. If another phase or hotfix ships migration 054 before this phase, there's a numbering collision.
**Why it happens:** Multiple phases in parallel.
**How to avoid:** Check `supabase/migrations/` directory at execution time, not at planning time. Use the next available number. Currently safe to plan for 054.
**Warning signs:** Migration CLI rejecting a file with a duplicate number prefix.
[VERIFIED: codebase -- latest is 053_settings_unification.sql]

## Code Examples

### Migration: workspace_files + workspace_file_versions + bucket

```sql
-- Source: D-01, D-05, D-06, D-11, D-12 decisions; migration 029 pattern [VERIFIED: codebase]
-- Migration 054: Workspace filesystem tables + storage bucket

-- ============================================================
-- workspace_files table
-- ============================================================
CREATE TABLE public.workspace_files (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
    path text NOT NULL,
    size_bytes bigint NOT NULL DEFAULT 0,
    mime_type text NOT NULL DEFAULT 'application/octet-stream',
    content_inline bytea,           -- inline storage for files <= 256KB
    content_storage_path text,      -- bucket path for files > 256KB
    created_by uuid NOT NULL,       -- user who authored (via agent)
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT workspace_files_thread_path_unique UNIQUE (thread_id, path),
    CONSTRAINT workspace_files_path_length CHECK (char_length(path) <= 500),
    CONSTRAINT workspace_files_size_limit CHECK (size_bytes <= 10485760)
);

CREATE INDEX idx_workspace_files_thread ON workspace_files(thread_id);

-- ============================================================
-- workspace_file_versions table
-- ============================================================
CREATE TABLE public.workspace_file_versions (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    workspace_file_id uuid NOT NULL REFERENCES workspace_files(id) ON DELETE CASCADE,
    version integer NOT NULL,
    content_inline bytea,
    content_storage_path text,
    size_bytes bigint NOT NULL DEFAULT 0,
    delta_from_prev jsonb,          -- unified diff from previous version (null for v1)
    created_at timestamptz DEFAULT now() NOT NULL,
    CONSTRAINT workspace_versions_file_version_unique
        UNIQUE (workspace_file_id, version)
);

CREATE INDEX idx_workspace_versions_file
    ON workspace_file_versions(workspace_file_id, version DESC);

-- ============================================================
-- RLS: workspace_files via FK chain to threads (D-11)
-- ============================================================
ALTER TABLE workspace_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_files_select_own" ON workspace_files
    FOR SELECT TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workspace_files_insert_own" ON workspace_files
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workspace_files_update_own" ON workspace_files
    FOR UPDATE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

CREATE POLICY "workspace_files_delete_own" ON workspace_files
    FOR DELETE TO authenticated
    USING (auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id));

-- ============================================================
-- RLS: workspace_file_versions inherits via workspace_file_id FK
-- ============================================================
ALTER TABLE workspace_file_versions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_versions_select_own" ON workspace_file_versions
    FOR SELECT TO authenticated
    USING (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workspace_files wf ON wf.thread_id = t.id
            WHERE wf.id = workspace_file_id
        )
    );

CREATE POLICY "workspace_versions_insert_own" ON workspace_file_versions
    FOR INSERT TO authenticated
    WITH CHECK (
        auth.uid() = (
            SELECT t.user_id FROM threads t
            JOIN workspace_files wf ON wf.thread_id = t.id
            WHERE wf.id = workspace_file_id
        )
    );

-- ============================================================
-- workspace-files storage bucket (D-12)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('workspace-files', 'workspace-files', false)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: path prefix is {user_id}/{thread_id}/{file_id}/v{version}
CREATE POLICY "workspace_storage_select_own" ON storage.objects
    FOR SELECT TO authenticated
    USING (
        bucket_id = 'workspace-files'
        AND (storage.foldername(name))[1] = (select auth.uid()::text)
    );

CREATE POLICY "workspace_storage_insert_own" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'workspace-files'
        AND (storage.foldername(name))[1] = (select auth.uid()::text)
    );

CREATE POLICY "workspace_storage_delete_own" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'workspace-files'
        AND (storage.foldername(name))[1] = (select auth.uid()::text)
    );
```

### asyncpg Helper: workspace write

```python
# Source: db/runs.py pattern [VERIFIED: codebase]
# File: backend/app/db/workspace.py

import asyncpg
from uuid import UUID


async def upsert_workspace_file(
    pool: asyncpg.Pool,
    *,
    thread_id: UUID,
    path: str,
    size_bytes: int,
    mime_type: str,
    content_inline: bytes | None,
    content_storage_path: str | None,
    created_by: UUID,
) -> tuple[UUID, bool]:
    """Upsert a workspace file row. Returns (file_id, is_new)."""
    row = await pool.fetchrow(
        """
        INSERT INTO workspace_files
            (thread_id, path, size_bytes, mime_type,
             content_inline, content_storage_path, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (thread_id, path) DO UPDATE SET
            size_bytes = EXCLUDED.size_bytes,
            mime_type = EXCLUDED.mime_type,
            content_inline = EXCLUDED.content_inline,
            content_storage_path = EXCLUDED.content_storage_path,
            updated_at = now()
        RETURNING id, (xmax = 0) AS is_new
        """,
        thread_id, path, size_bytes, mime_type,
        content_inline, content_storage_path, created_by,
    )
    return row["id"], row["is_new"]


async def insert_version(
    pool: asyncpg.Pool,
    *,
    workspace_file_id: UUID,
    version: int,
    content_inline: bytes | None,
    content_storage_path: str | None,
    size_bytes: int,
    delta_from_prev: dict | None,
) -> None:
    """Insert a new version row for a workspace file."""
    await pool.execute(
        """
        INSERT INTO workspace_file_versions
            (workspace_file_id, version, content_inline,
             content_storage_path, size_bytes, delta_from_prev)
        VALUES ($1, $2, $3, $4, $5, $6)
        """,
        workspace_file_id, version, content_inline,
        content_storage_path, size_bytes, delta_from_prev,
    )


async def get_next_version(
    pool: asyncpg.Pool,
    workspace_file_id: UUID,
) -> int:
    """Get the next version number for a workspace file."""
    result = await pool.fetchval(
        """
        SELECT COALESCE(MAX(version), 0) + 1
        FROM workspace_file_versions
        WHERE workspace_file_id = $1
        """,
        workspace_file_id,
    )
    return result


async def count_files_in_thread(
    pool: asyncpg.Pool,
    thread_id: UUID,
) -> int:
    """Count workspace files in a thread (for D-04 soft limit check)."""
    return await pool.fetchval(
        "SELECT COUNT(*) FROM workspace_files WHERE thread_id = $1",
        thread_id,
    )
```

### REST API Router

```python
# Source: sandbox_outputs.py pattern [VERIFIED: codebase]
# File: backend/app/api/workspace.py

from fastapi import APIRouter, Depends, HTTPException, Query
from app.dependencies import get_current_user, get_supabase
from app.utils.db import aexec

router = APIRouter(prefix="/threads/{thread_id}/workspace", tags=["workspace"])

@router.get("/files")
async def list_workspace_files(
    thread_id: str,
    prefix: str | None = None,
    current_user: dict = Depends(get_current_user),
    supabase = Depends(get_supabase),
):
    """List workspace files for a thread (D-08)."""
    query = (
        supabase.table("workspace_files")
        .select("id, path, size_bytes, mime_type, created_at, updated_at")
        .eq("thread_id", thread_id)
        .order("path")
    )
    if prefix:
        query = query.like("path", f"{prefix}%")
    resp = await aexec(query)
    return resp.data or []
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Artifacts as ephemeral chat content | Persistent per-session file storage | 2024-2025 (Claude Artifacts Jun 2024, ChatGPT Canvas Oct 2024) | Users expect files to survive page refresh and session boundaries |
| Full-content-only version history | Version history with visual diff | 2025 (ChatGPT "Show Changes") | Users expect to SEE what changed, not just browse versions |
| Single storage backend | Hybrid storage (inline + object store) | 2024-2025 (Open WebUI, LobeChat) | Performance optimization: small files fast from DB, large files from CDN |
| OpenAI-style function calling | Strict mode function calling with null-typed optionals | 2026 (OpenAI strict mode default) | Required: `additionalProperties: false`, all fields in `required`, optional fields use `["type", "null"]` |
| Agent workspace resets per session | Persistent workspace across sessions | 2025-2026 (Cursor 3 plans, Windsurf memories) | Devin's session-reset was a negative precedent; persistence is now expected |

**Deprecated/outdated:**
- **Embedding workspace files in message content (inline artifacts):** Claude.ai originally did this; now artifacts are separate entities. Do not embed file content in message rows. [CITED: features research FEATURES.md AF-07]
- **Polling for file changes:** All modern platforms use SSE/WebSocket push. Do not poll. [CITED: PITFALLS.md Pitfall, FEATURES.md AF-06]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | FK-chain RLS subquery is O(1) per row due to PK index on threads.id | Pitfall 1 | Performance degradation on workspace_list for threads with many files; would need denormalized user_id column |
| A2 | 21 tools (16 existing + 5 new) causes only marginal accuracy degradation | Tool Schema Design | LLM may struggle to pick the right tool; would need tool consolidation or conditional registration |
| A3 | ChatGPT Canvas and Open WebUI store full content per version (not deltas only) | Versioning Patterns | Our full-content approach might use more storage than necessary; delta-only could save space |
| A4 | Path validation regex `^/[a-zA-Z0-9._/ -]+$` is sufficient for D-02 rules | Don't Hand-Roll | Edge cases with unicode filenames, special characters not covered; may need broader or narrower charset |
| A5 | 8,192 char cap for workspace_read is the right default | Pitfall 2 | Too small = agent can't read useful file sections; too large = context window pressure. Tunable via app_settings mitigates |

## Open Questions

1. **Diff format for binary files**
   - What we know: Text files get unified diff. Binary files cannot be meaningfully diffed.
   - What's unclear: Should workspace_diff return an error for binary files, or return metadata ("size changed from X to Y bytes")?
   - Recommendation: Return metadata diff `{"format": "binary", "old_size": X, "new_size": Y}`. The tool should not error on valid input.

2. **Storage path structure for versioned bucket files**
   - What we know: D-12 specifies `{user_id}/{thread_id}/{filename}` path prefix.
   - What's unclear: When a file is updated and the old version was in the bucket, should the new version overwrite or use a versioned path like `{user_id}/{thread_id}/{file_id}/v{N}`?
   - Recommendation: Use `{user_id}/{thread_id}/{file_id}/v{N}` to preserve all versions in the bucket. Matches the version row pattern. Old bucket files cleaned up on file delete.

3. **Should workspace_file_versions also store content in the bucket for large files?**
   - What we know: workspace_files has the hybrid storage pattern. Versions also need content.
   - What's unclear: Should version rows duplicate the inline/bucket pattern, or should they always store inline (since the current file row has the latest content)?
   - Recommendation: Version rows MUST also use hybrid storage. If the file is >256KB, both the current file row and each version row use bucket storage. Otherwise version history for large files becomes unreadable.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| asyncpg pool | Hot-path DB writes | Yes | 0.30.0 | -- |
| supabase-py | Storage uploads, cold-path reads | Yes | 2.x | -- |
| Redis | SSE event emission via _emit() | Yes | docker-compose.dev.yml | -- |
| Supabase (local) | Postgres + Storage | Yes | supabase CLI | -- |
| Python difflib | Diff computation | Yes | stdlib | -- |
| Python mimetypes | MIME detection | Yes | stdlib | -- |

**Missing dependencies:** None. All required infrastructure already exists in the project.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x + pytest-asyncio |
| Config file | `backend/pytest.ini` |
| Quick run command | `cd backend && python -m pytest tests/unit/test_workspace_service.py -x` |
| Full suite command | `cd backend && python -m pytest tests/ -x --timeout=30` |

### Phase Requirements to Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WS-01 | workspace_write persists file, survives re-read | unit | `pytest tests/unit/test_workspace_service.py::test_write_and_read -x` | Wave 0 |
| WS-02 | workspace_read truncates at max chars, returns notice | unit | `pytest tests/unit/test_workspace_service.py::test_read_truncation -x` | Wave 0 |
| WS-03 | workspace_list filters by prefix; workspace_delete removes file + versions | unit | `pytest tests/unit/test_workspace_service.py::test_list_and_delete -x` | Wave 0 |
| WS-04 | Auto-version on write; workspace_diff returns unified diff | unit | `pytest tests/unit/test_workspace_service.py::test_versioning_and_diff -x` | Wave 0 |
| WS-05 | Files <= 256KB inline, > 256KB in bucket | unit | `pytest tests/unit/test_workspace_service.py::test_hybrid_storage -x` | Wave 0 |
| WS-06 | UNIQUE constraint on (thread_id, path); cross-user isolation | integration | `pytest tests/integration/test_workspace_rls.py -x` | Wave 0 |
| WS-07 | workspace_file_written and workspace_file_deleted SSE events emitted | unit | `pytest tests/unit/test_workspace_service.py::test_sse_events -x` | Wave 0 |

### Sampling Rate
- **Per task commit:** `cd backend && python -m pytest tests/unit/test_workspace_service.py -x`
- **Per wave merge:** `cd backend && python -m pytest tests/ -x --timeout=30`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/test_workspace_service.py` -- covers WS-01 through WS-05, WS-07
- [ ] `tests/integration/test_workspace_rls.py` -- covers WS-06 (FK-chain RLS)
- [ ] `tests/unit/test_workspace_tools.py` -- covers tool handler dispatch for all 5 tools
- [ ] Fixtures for mock asyncpg pool and supabase storage client

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | Handled by existing Supabase Auth |
| V3 Session Management | No | Handled by existing JWT flow |
| V4 Access Control | **Yes** | FK-chain RLS on workspace_files + workspace_file_versions; Storage bucket RLS with user_id path prefix |
| V5 Input Validation | **Yes** | Path validation (D-02): no `..`, no double slashes, max 500 chars, leading `/` required. Size validation (D-03): 10MB cap. Content encoding validation. |
| V6 Cryptography | No | No new crypto operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via `..` in workspace path | Tampering | Regex validation rejecting `..` per D-02; DB constraint CHECK |
| Cross-user file access via thread_id guessing | Information Disclosure | FK-chain RLS policy: `auth.uid() = (SELECT user_id FROM threads WHERE id = thread_id)` |
| Storage bucket direct URL access | Information Disclosure | Bucket is private; signed URLs with 60s TTL; Storage RLS with user_id path prefix |
| Content injection via workspace_write | Tampering | Content stored as bytea (not executed); no server-side rendering of workspace files |
| DoS via large file writes | Denial of Service | 10MB per-file cap (D-03); 100-file soft limit (D-04); MAXLEN on Redis Stream |
| SQL injection via path parameter | Tampering | All DB operations use asyncpg positional parameters ($1, $2); never string interpolation |

## Sources

### Primary (HIGH confidence)
- **Codebase verification** -- `tool_dispatcher.py` (registry pattern, ToolContext, ToolResult), `db/runs.py` (asyncpg pattern), `sandbox_outputs.py` (signed URL pattern), `openai_service.py:get_tools()` (tool schema pattern), `migrations/029_storage_buckets.sql` (bucket + RLS pattern), `full-schema.sql` (threads, sandbox_files, messages table schemas)
- **Python difflib docs** -- [docs.python.org/3/library/difflib.html](https://docs.python.org/3/library/difflib.html) -- unified_diff API, SequenceMatcher performance
- **Supabase Storage Access Control docs** -- [supabase.com/docs/guides/storage/security/access-control](https://supabase.com/docs/guides/storage/security/access-control) -- storage.foldername(), RLS policy patterns, signed URL semantics
- **OpenAI Function Calling docs** -- [developers.openai.com/api/docs/guides/function-calling](https://developers.openai.com/api/docs/guides/function-calling) -- strict mode, schema design, tool count guidance
- **Anthropic Tool Use docs** -- [platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works](https://platform.claude.com/docs/en/agents-and-tools/tool-use/how-tool-use-works) -- tool schema contract, execution model

### Secondary (MEDIUM confidence)
- **PostgreSQL TOAST/bytea best practices** -- [cybertec-postgresql.com/en/binary-data-performance-in-postgresql](https://www.cybertec-postgresql.com/en/binary-data-performance-in-postgresql/) -- confirmed 256KB threshold is within PostgreSQL inline storage comfort zone
- **Open WebUI database schema** -- [github.com/open-webui/docs database-schema.md](https://github.com/open-webui/docs/blob/main/docs/reference/database-schema.md) -- file table, chat_file junction, access_grant patterns
- **Supabase Storage Deep Dive** -- [dev.to/kanta13jp1/supabase-storage-deep-dive](https://dev.to/kanta13jp1/supabase-storage-deep-dive-bucket-design-signed-urls-image-transforms-and-rls-3b9k) -- signed URL caching, CDN behavior
- **ChatGPT Canvas docs** -- [help.openai.com/en/articles/9930697](https://help.openai.com/en/articles/9930697-what-is-the-canvas-feature-in-chatgpt-and-how-do-i-use-it) -- version history, Show Changes feature
- **Claude.ai Artifacts docs** -- [support.claude.com/en/articles/9487310](https://support.claude.com/en/articles/9487310-what-are-artifacts-and-how-do-i-use-them) -- persistent storage, 20MB limit

### Tertiary (LOW confidence)
- **Competitive storage backend assumptions** -- ChatGPT and Claude.ai storage backends are proprietary SaaS; implementation details are inferred from user-facing behavior, not verified
- **Google Gemini Canvas versioning** -- [docs.cloud.google.com/gemini/enterprise/docs/assistant-canvas](https://docs.cloud.google.com/gemini/enterprise/docs/assistant-canvas) -- "each update generates a new artifact" behavior confirmed but internal storage model unknown

## Metadata

**Confidence breakdown:**
- Standard stack: **HIGH** -- zero new dependencies; all patterns verified against live codebase
- Architecture: **HIGH** -- hybrid storage, tool dispatch, SSE emission all follow established patterns with codebase precedent
- Pitfalls: **HIGH** -- FK-chain RLS is the only truly new pattern; all other risks have mitigation patterns from v2.6 phases
- Competitive landscape: **MEDIUM** -- user-facing features well-documented; internal implementations largely inferred
- Tool schema design: **MEDIUM** -- follows OpenAI/Anthropic best practices; 21-tool count impact is assumed not verified

**Research date:** 2026-05-28
**Valid until:** 2026-06-28 (stable domain; PostgreSQL and Supabase patterns change slowly)
