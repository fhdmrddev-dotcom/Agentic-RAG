# Phase 6: Read Tool - Research

**Researched:** 2026-03-22
**Domain:** FastAPI tool endpoint, Supabase `full_markdown` column, line-range slicing, OpenAI function spec, React ToolCallPanel extension
**Confidence:** HIGH

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TOOL-05 | Agent can use `read(document_id)` to read full document content | `full_markdown` already stored in `documents` table; Supabase direct select by `id` + `user_id` enforces RLS at query level |
| TOOL-06 | Agent can use `read(document_id, start_line, end_line)` to read specific line range | `full_markdown.splitlines()` slice with Python 0-based indexing; line numbers must be returned in response for agent orientation |
</phase_requirements>

---

## Summary

Phase 6 adds a single new agent capability: `read_document`. The backend work is small because the foundational data (`full_markdown`) already exists in the `documents` table, written by Phase 2's ingestion pipeline. The tool needs a new `read_path()` helper in `kb.py` (following the exact same pattern as `ls_path`, `tree_path`, `grep_path`, `glob_path`), a GET endpoint `/kb/read`, a new OpenAI tool spec `READ_DOCUMENT_TOOL` in `openai_service.py`, a handler branch in the `threads.py` tool-execution loop, and a `ReadDocumentResult` UI component in `ToolCallPanel.tsx`.

The line-range requirement (TOOL-06) is pure Python: split the stored markdown on newlines, slice `lines[start_line-1 : end_line]` (converting from 1-based spec to 0-based Python), then return each line prefixed with its 1-based line number so the agent can orient further reads. The "line numbers in the response" requirement is explicit in the success criteria — this is the format `{n}: {line_content}`.

The frontend change is additive: add `BookOpen` to the icon map, add a `ReadDocumentResult` component that renders a collapsible pre-formatted block (same pattern as `SubAgentBlock`), and register it in `renderResult()`.

No new database migrations are required. No new npm packages are required. No new Python dependencies are required.

**Primary recommendation:** Keep the implementation maximally parallel with existing kb tool patterns. Do not invent new patterns. The entire phase can be done in two plans: (1) backend read tool, (2) frontend ToolCallPanel extension.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Python (FastAPI) | existing | Backend endpoint | Project stack |
| supabase-py | existing | Supabase client | Project stack |
| Pydantic v2 | existing | Response model | Project rule — structured outputs via Pydantic |
| pytest | existing | Unit + integration tests | Project convention |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| React + TypeScript | existing | Frontend ToolCallPanel extension | Project stack |
| lucide-react | existing | `BookOpen` icon for read tool row | Already imported in ToolCallPanel |
| shadcn/ui ScrollArea | existing | Scrollable pre block for long content | Already installed: `src/components/ui/scroll-area.tsx` |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Direct `full_markdown` column select | Chunk reconstruction (like `fetch_full_document`) | Chunk reconstruction is slower (N+1 query) and returns reassembled text. `full_markdown` is the canonical, already-stored single-field source of truth per DOC-03. Use it directly. |
| GET `/kb/read` endpoint | Inline tool execution without HTTP | Other kb tools already have HTTP endpoints that are also callable directly via `*_path()` helpers. Maintain consistency. |

**Installation:** No new packages required.

---

## Architecture Patterns

### Recommended Project Structure

The read tool follows the same four-layer pattern used by all Phase 4/5 tools:

```
backend/app/
├── models/kb.py          # Add ReadResponse Pydantic model
├── api/kb.py             # Add read_path() helper + GET /kb/read endpoint
├── services/openai_service.py   # Add READ_DOCUMENT_TOOL spec + include in get_tools()
├── api/threads.py        # Add "read_document" branch in tool-execution loop
└── tests/integration/test_kb.py  # Add TestRead class

frontend/src/
├── components/chat/ToolCallPanel.tsx   # Add icon, label, summary, ReadDocumentResult
```

### Pattern 1: read_path() helper (mirrors existing kb tool pattern)

**What:** A module-level function callable from both the HTTP endpoint and the `threads.py` agent loop, without going through HTTP.

**When to use:** All kb tools use this — it is the established pattern in this project. Do not route the agent through HTTP.

**Example (follows the existing grep_path / glob_path signature pattern):**

```python
# Source: backend/app/api/kb.py — established pattern from Phase 4/5

def read_path(
    document_id: str,
    user_id: str,
    supabase: Client,
    start_line: int | None = None,
    end_line: int | None = None,
) -> dict:
    """Fetch full_markdown for a document, optionally sliced to a line range."""
    result = (
        supabase.table("documents")
        .select("id, filename, full_markdown")
        .eq("id", document_id)
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not result.data:
        return {"error": f"Document '{document_id}' not found or access denied."}

    doc = result.data
    markdown = doc.get("full_markdown") or ""

    if not markdown:
        return {"error": "No content available for this document."}

    lines = markdown.splitlines()
    total_lines = len(lines)

    if start_line is not None and end_line is not None:
        # Validate bounds (1-based, inclusive)
        if start_line < 1 or end_line < start_line or start_line > total_lines:
            return {"error": f"Line range {start_line}–{end_line} is out of bounds. Document has {total_lines} lines."}
        # Clamp end_line to total_lines
        end_line = min(end_line, total_lines)
        sliced = lines[start_line - 1 : end_line]
        # Prefix each line with its 1-based number
        numbered = "\n".join(f"{start_line + i}: {line}" for i, line in enumerate(sliced))
        return {
            "document_id": document_id,
            "filename": doc["filename"],
            "start_line": start_line,
            "end_line": end_line,
            "total_lines": total_lines,
            "content": numbered,
        }

    # Full document: no line numbering required, but include total_lines for orientation
    return {
        "document_id": document_id,
        "filename": doc["filename"],
        "total_lines": total_lines,
        "content": markdown,
    }
```

### Pattern 2: Pydantic response models (mirrors existing kb models)

**What:** Add `ReadResponse` to `backend/app/models/kb.py`.

```python
# Source: backend/app/models/kb.py — existing pattern

class ReadResponse(BaseModel):
    document_id: UUID
    filename: str
    total_lines: int
    content: str
    start_line: int | None = None
    end_line: int | None = None
```

Error responses are returned as HTTPException (404), not as a field in ReadResponse.

### Pattern 3: HTTP endpoint (mirrors /kb/ls, /kb/tree, /kb/grep, /kb/glob)

```python
@router.get("/read", response_model=ReadResponse)
async def read(
    document_id: str = Query(description="UUID of the document to read"),
    start_line: int | None = Query(default=None, ge=1, description="First line to return (1-based, inclusive)"),
    end_line: int | None = Query(default=None, ge=1, description="Last line to return (1-based, inclusive)"),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    result = read_path(document_id, current_user["id"], supabase, start_line, end_line)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return ReadResponse(**result)
```

### Pattern 4: OpenAI tool spec (mirrors GREP_TOOL / GLOB_TOOL)

```python
READ_DOCUMENT_TOOL = {
    "type": "function",
    "function": {
        "name": "read_document",
        "description": (
            "Read the raw markdown content of a document by its ID. "
            "Use after grep or glob to inspect the full content or a specific section. "
            "Provide start_line and end_line to read a specific range (1-based, inclusive). "
            "Omit both to read the full document. "
            "Line-range results include line numbers so you can orient further reads."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "document_id": {
                    "type": "string",
                    "description": "UUID of the document to read.",
                },
                "start_line": {
                    "type": "integer",
                    "description": "First line to return (1-based, inclusive). Omit for full document.",
                },
                "end_line": {
                    "type": "integer",
                    "description": "Last line to return (1-based, inclusive). Omit for full document.",
                },
            },
            "required": ["document_id"],
        },
    },
}
```

Add to `get_tools()` list alongside existing tools.

### Pattern 5: threads.py handler branch (mirrors existing tool branches)

```python
elif tool_name == "read_document":
    result = read_path(
        args["document_id"],
        current_user["id"],
        supabase,
        args.get("start_line"),
        args.get("end_line"),
    )
    tool_result = json.dumps(result)
```

Import `read_path` from `app.api.kb` — it is already imported as `from app.api.kb import ls_path, tree_path, grep_path, glob_path`. Extend the import.

### Pattern 6: System prompt addition (mirrors existing tool descriptions)

Add a ninth entry to `SYSTEM_PROMPT` in `threads.py`:

```
9. read_document — Read the full markdown content of a document (or a specific line range) by its document_id.
Use AFTER grep or glob to inspect actual content. Pass start_line/end_line for a targeted section.
Line-range output includes line numbers for orientation. document_id is a UUID from grep/glob/ls results.
```

Update the Key rules section to add: `- Read full document content or a line range → read_document`.

Also update the header count from "eight tools" to "nine tools".

### Pattern 7: Frontend ReadDocumentResult component (mirrors SubAgentBlock)

**What:** A collapsible sub-block inside ToolCallPanel showing the read content.

```tsx
// Source: ToolCallPanel.tsx — follows SubAgentBlock pattern

function ReadDocumentResult({ tc }: { tc: ToolCall }) {
  const [open, setOpen] = useState(false)

  let parsed: any = null
  try {
    parsed = tc.result ? JSON.parse(tc.result) : null
  } catch { /* ignore */ }

  if (!parsed) return null

  if (parsed.error) {
    return <div className="mt-1 text-xs text-destructive italic">{parsed.error}</div>
  }

  const isRange = parsed.start_line != null && parsed.end_line != null
  const header = isRange
    ? `Lines ${parsed.start_line}–${parsed.end_line}`
    : "Full document"
  const content: string = parsed.content ?? ""

  return (
    <div className="mt-1.5">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground/70 transition-colors"
      >
        {open ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
        <span>{header}</span>
      </button>
      {open && (
        <div className="mt-1.5 ml-4 rounded-md border border-border/40 bg-background/60">
          <ScrollArea className="max-h-64">
            <pre className="p-2 text-xs font-mono leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
              {content || <span className="italic text-muted-foreground">No content available for this document.</span>}
            </pre>
          </ScrollArea>
        </div>
      )}
    </div>
  )
}
```

Register in `toolIcon`, `toolLabel`, `toolSummary`, and `renderResult`:

```tsx
// toolIcon
if (name === "read_document") return <BookOpen className="w-3.5 h-3.5" />

// toolLabel
if (name === "read_document") return "Reading document"

// toolSummary
if (tc.name === "read_document" && tc.args.document_id)
  return tc.args.filename ?? tc.args.document_id

// renderResult
if (name === "read_document") return <ReadDocumentResult tc={tc} />
```

Add `BookOpen` to the lucide-react import line.

Note: `tc.args.filename` is not sent by the LLM as an arg — use `tc.args.document_id` for the summary. The filename is available in the result payload (`parsed.filename`) if needed for a richer summary, but `toolSummary` runs before the result arrives (during streaming), so `document_id` is the correct fallback.

### Anti-Patterns to Avoid

- **Chunk reconstruction for read:** `fetch_full_document()` in `retrieval_service.py` rebuilds content from `document_chunks`. For the read tool, use `full_markdown` directly — it is faster (one query, one column) and is the canonical stored source per DOC-03.
- **Returning raw content without line numbers on line-range:** TOOL-06 explicitly requires line numbers in the range response so the agent can orient further reads.
- **Off-by-one errors on line slicing:** The API contract uses 1-based inclusive line numbers (matching the UI-SPEC's `Lines {start}–{end}` display). Python slicing is 0-based: `lines[start_line-1 : end_line]` is correct.
- **No bounds check on end_line > total_lines:** Clamp silently (`end_line = min(end_line, total_lines)`) rather than erroring — partial results are better than no results for the agent.
- **start_line > total_lines:** Return a clear error — there is nothing to return.
- **Missing `read_document` in `get_tools()` list:** The tool spec must be registered in `get_tools()` otherwise the LLM will never see it.
- **Not updating the import in threads.py:** `read_path` must be added to the `from app.api.kb import ...` line.
- **Not updating system prompt tool count:** The header says "eight tools" — it must become "nine tools" when `read_document` is added.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Access control on document reads | Custom user-ownership check | `.eq("user_id", user_id)` on the Supabase query | RLS is already enabled on `documents`; the `.eq("user_id", ...)` filter in every existing tool is the project's established pattern. Supabase service role bypasses RLS, so the filter in the query IS the authorization check. |
| Content fetching | Chunk reconstruction | `full_markdown` column direct select | Already stored since Phase 2 (migration 014). One query, correct canonical content. |
| Line splitting | Custom parser | Python `str.splitlines()` | Handles `\n`, `\r\n`, `\r` consistently. |

---

## Common Pitfalls

### Pitfall 1: `full_markdown` may be NULL for legacy documents

**What goes wrong:** Documents ingested before Phase 2 (migration 014) may have `full_markdown = NULL`. A NULL content select returns `None` in Python.

**Why it happens:** Migration 014 added `full_markdown` as a nullable column. Existing documents ingested before Phase 2 would have `NULL`.

**How to avoid:** Treat `full_markdown = None` as "No content available for this document." — return the error string, not a crash. The `read_path` pattern above already handles this: `markdown = doc.get("full_markdown") or ""`.

**Warning signs:** `read_path` returns the no-content error during testing against a document that was never re-ingested.

### Pitfall 2: Line range end_line clamping vs. error

**What goes wrong:** Agent requests `start_line=1, end_line=9999` on a 200-line document. Returning an error is unhelpful; returning lines 1–200 is correct.

**Why it happens:** LLM may guess a large end_line to "read everything."

**How to avoid:** Clamp `end_line = min(end_line, total_lines)` silently. Only error when `start_line > total_lines` (nothing to return) or `start_line < 1` (invalid).

### Pitfall 3: `toolSummary` runs before result arrives

**What goes wrong:** Attempting to display `parsed.filename` (from result JSON) in the running-state tool row — but the result doesn't exist yet during streaming.

**Why it happens:** `toolSummary(tc)` is called when `tc.status === "running"`, before `tc.result` is set.

**How to avoid:** `toolSummary` for `read_document` should use `tc.args.document_id`, not `tc.result`. The filename in the completed result is available to `ReadDocumentResult` (which only runs when `tc.status === "done"`).

### Pitfall 4: `single()` throws on zero rows in supabase-py

**What goes wrong:** `supabase.table("documents").select(...).eq("id", ...).eq("user_id", ...).single().execute()` raises an exception when no row is found, rather than returning `data = None`.

**Why it happens:** supabase-py's `.single()` throws `APIError` on zero rows in some client versions.

**How to avoid:** Wrap the `.single().execute()` call in a try/except, or use `.maybe_single()` if available. The existing `fetch_full_document` in `retrieval_service.py` uses `.single()` directly and checks `if not doc_result.data:` — replicate that exact pattern (including exception handling in the caller if needed). The integration tests mock `.single()` via the shared `_builder` fixture which already has `single.return_value = b`.

### Pitfall 5: `get_tools()` system-prompt count mismatch

**What goes wrong:** The LLM system prompt says "eight tools" but there are now nine. The LLM may be confused or the prompt reads inaccurately.

**Why it happens:** The count is hardcoded in `SYSTEM_PROMPT` in `threads.py`.

**How to avoid:** Update the header line from "eight tools" to "nine tools" as part of the `READ_DOCUMENT_TOOL` addition task.

### Pitfall 6: Test mock requires `ilike` wiring if testing document lookup by filename

**What goes wrong:** If any test variant uses filename-based lookup, `ilike` is not wired in the conftest builder.

**Why it happens:** The existing conftest does not wire `.ilike()`. The read tool uses `.eq("id", ...)` not `.ilike()`, so this is not actually a problem for read tool tests. Note it anyway.

**How to avoid:** Use document UUID lookups in tests (not filename lookups). The read tool spec requires `document_id` (UUID), not filename.

---

## Code Examples

### Database column confirmed available

```sql
-- Source: backend/supabase/migrations/014_document_folder_integration.sql
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.folders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS full_markdown text;
```

The `full_markdown` column exists and is already populated by ingestion. No new migration is needed.

### Existing fetch_full_document in retrieval_service.py (DO NOT USE FOR READ TOOL)

```python
# Source: backend/app/services/retrieval_service.py
# This function reconstructs content from chunks — slower, not for read tool.
# The read tool should use full_markdown directly.
def fetch_full_document(document_id: str, user_id: str, supabase: Client) -> dict | None:
    ...
    chunks_result = (
        supabase.table("document_chunks")
        .select("content")
        .eq("document_id", document_id)
        .order("chunk_index")
        .execute()
    )
    full_text = "\n\n".join(c["content"] for c in chunks)
```

### conftest mock builder — wired methods available for tests

```python
# Source: backend/tests/conftest.py
# Available on _builder (no extra wiring needed for read tool tests):
# .select(), .eq(), .single(), .execute(), .or_(), .is_()
```

The `read_path` function uses only `.select().eq().eq().single().execute()` — all already wired in the shared builder fixture. No conftest changes needed.

### ToolCall type (frontend)

```typescript
// Source: frontend/src/types/index.ts
export interface ToolCall {
  name: string
  args: Record<string, string>   // NOTE: values are strings — start_line/end_line are strings in args
  status: "running" | "done"
  result?: string                // JSON-serialized result string
  sub_agent?: SubAgentState
}
```

Important: `tc.args.start_line` and `tc.args.end_line` will be **strings** (e.g., `"10"`, `"30"`) when read from `args`. Parse them with `parseInt()` when constructing the header label:

```tsx
const startLine = parseInt(tc.args.start_line)
const endLine = parseInt(tc.args.end_line)
const header = `Lines ${startLine}–${endLine}`
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Chunk reconstruction for full content | `full_markdown` direct column | Phase 2 (DOC-03) | Simpler, faster, no join |

---

## Open Questions

1. **Should `read_document` be usable with filename instead of document_id?**
   - What we know: `resolve_document_id()` in `retrieval_service.py` already provides filename-to-ID resolution. The `analyze_document` tool accepts filenames.
   - What's unclear: TOOL-05/06 explicitly say `read(document_id)` — the interface is UUID-based. The agent gets UUIDs from `grep`, `glob`, `ls` results.
   - Recommendation: Implement UUID-only per REQUIREMENTS.md. The agent workflow is: grep/glob/ls to discover → read with the UUID. Do not add filename lookup to keep Phase 6 minimal.

2. **Should full-document reads be truncated to protect the context window?**
   - What we know: The UI-SPEC specifies `max-h-64` (256px) visual truncation for the UI display. The actual content returned to the LLM is not truncated by any existing tool — `tool_result` is trimmed to `[:2000]` chars when stored in `persisted_tool_calls` in `threads.py`.
   - What's unclear: A large document could send 50k+ tokens to the LLM context.
   - Recommendation: The 2000-char trim in `persisted_tool_calls` is for persistence only, not for the live tool result message. The existing `analyze_document` tool passes the full content to a sub-agent which handles it. For the read tool, the agent already had this capability via `analyze_document`. The read tool is designed for targeted line-range reads, not whole-document consumption. No truncation in the tool result itself — let the agent use line ranges. Document this in the system prompt description.

---

## Sources

### Primary (HIGH confidence)

- Codebase — `backend/app/api/kb.py` — complete source of all existing kb tool patterns (ls_path, tree_path, grep_path, glob_path, HTTP endpoints)
- Codebase — `backend/app/services/openai_service.py` — all existing tool specs and get_tools() structure
- Codebase — `backend/app/api/threads.py` — tool-execution loop, system prompt, import pattern
- Codebase — `backend/app/models/kb.py` — existing Pydantic response model patterns
- Codebase — `backend/supabase/migrations/014_document_folder_integration.sql` — confirms `full_markdown` column exists as `text` (nullable)
- Codebase — `backend/tests/conftest.py` — mock builder wiring, available methods
- Codebase — `backend/tests/integration/test_kb.py` — test class pattern, mock setup for kb endpoints
- Codebase — `frontend/src/components/chat/ToolCallPanel.tsx` — component structure, existing patterns
- Codebase — `frontend/src/types/index.ts` — ToolCall interface (args are `Record<string, string>`)
- Codebase — `.planning/phases/06-read-tool/06-UI-SPEC.md` — confirmed frontend design contract

### Secondary (MEDIUM confidence)

- `.planning/STATE.md` — decision: `full_markdown excluded from DocumentResponse (too large); Phase 6 read tool retrieves it via dedicated query` — confirms this is the intended design
- `.planning/REQUIREMENTS.md` — TOOL-05, TOOL-06 definitions confirmed

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already in use, no new dependencies
- Architecture: HIGH — patterns directly observed in existing Phase 4/5 code
- Pitfalls: HIGH — most derived from existing code decisions in STATE.md
- Frontend: HIGH — ToolCallPanel source read directly, pattern clear

**Research date:** 2026-03-22
**Valid until:** 2026-04-22 (stable codebase, no external dependencies changing)
