# Phase 31: Audit Log — Settings UI — Research

**Researched:** 2026-04-14
**Domain:** FastAPI router + React Settings UI (table, filters, CSV export)
**Confidence:** HIGH — all decisions locked in CONTEXT.md, all patterns verified from existing codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Pagination:** Prev/Next button navigation with "Page N of M" indicator. Backend returns page_size=50 rows plus a total count. Frontend computes `ceil(total / page_size)`.

**D-02 — Date Range Filter:** Preset pill buttons: All | 7d | 30d | 90d. No custom date picker library. Active preset highlighted with `bg-primary/10 text-primary` chip style. Pressing a preset changes the `since` query param.

**D-03 — Action Type Filter:** Single-select `<select>` dropdown with all 8 action types + "All types" default. Renders with existing `ghost-border` style.

**D-04 — Metadata Column (Details):** Per-action-type formatted one-liner (human-readable, no raw JSON):

| Action type | Details format |
|---|---|
| `document.upload` | `{filename} ({file_size formatted})` |
| `document.delete` | `{filename}` |
| `search.query` | `"{query_text}"` (truncated to ~60 chars) |
| `code.execute` | `{language}` |
| `skill.load` | `{skill_name}` |
| `thread.create` | — |
| `thread.delete` | — |
| `settings.update` | comma-joined changed field names (keys with `_key`/`_secret` already redacted by Phase 30) |

**D-05 — CSV Export:** Separate `GET /audit-logs/export` endpoint accepts same filter params, returns all matching rows with `Content-Disposition: attachment; filename=audit-log.csv`. Frontend triggers via blob URL. CSV columns: `timestamp`, `action_type`, `details` (same one-liner format), `metadata_json` (raw).

**D-06 — Backend API:** Two new FastAPI endpoints on a new `audit` router:
- `GET /audit-logs?page=1&page_size=50&since=7d&action_type=search.query` → `{entries: [...], total: N, page: 1, page_size: 50}`
- `GET /audit-logs/export?since=7d&action_type=search.query` → CSV with `Content-Disposition: attachment`

Both use `get_current_user` dependency. Query `audit_log` table filtering `user_id = current_user.id`. Order by `created_at DESC`. `since` values: `7d`, `30d`, `90d`, or absent (all time).

**D-07 — UI Placement:** New `SectionCard` at the bottom of SettingsPage, below the Code Execution section. Title: "Audit Log", description: "Your account activity — all significant actions recorded for security and compliance." Filters row above the table inside the card. Export CSV button in the card header (right side).

### Claude's Discretion

- Loading state: spinner replacing table content (not skeleton rows)
- Empty state: "No entries found for this period." centered in the table area
- Error state: muted error message replacing table, same pattern as SettingsPage main error
- Table styling: `<table>` with `text-sm`, column widths fixed (timestamp: 160px, action type: 160px, details: flex), `divide-y divide-border/30` row separators
- Timestamp display: local time, formatted as "Apr 14, 2026 10:32 AM"
- No shadcn Table component needed — plain styled `<table>`

### Deferred Ideas (OUT OF SCOPE)

None identified for this phase.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| AUDIT-04 | User can view their own audit log in Settings, filterable by date range and action type, paginated | Backend: `GET /audit-logs` endpoint querying `audit_log` table via service-role client with user_id filter; Frontend: AuditLogSection component in SettingsPage with filter state + pagination state |
| AUDIT-05 | User can export their audit log as a CSV file | Backend: `GET /audit-logs/export` endpoint returning `StreamingResponse` with CSV content; Frontend: blob URL download pattern (already established in `exportSkill` in api.ts) |
</phase_requirements>

---

## Summary

Phase 31 adds a read-only Audit Log section to the existing SettingsPage. It is a pure UI/API addition — no schema changes, no new migrations, no changes to existing instrumentation. Phase 30 delivered a complete `audit_log` table (INSERT-only RLS) and the write service; this phase delivers the read side.

The backend requires one new FastAPI router (`audit.py`) with two GET endpoints. Because the `audit_log` table has INSERT-only RLS for users (no SELECT policy), all reads must go through the FastAPI backend using the Supabase service-role client — direct Supabase JS client calls would fail with a permission denied error. The service-role client is already how `get_supabase()` in `dependencies.py` works, so this is the existing pattern with no special handling needed.

The frontend adds an `AuditLogSection` component inside `SettingsPage.tsx` (or as a separate file imported there), plus two new functions in `api.ts` (`getAuditLogs` and `exportAuditLogs`). All UI components are already installed: `Button`, `Label`, `Card`/`CardHeader`/`CardContent`/`CardTitle`/`CardDescription`, and lucide icons. No new shadcn installs required.

**Primary recommendation:** Implement backend router first (Wave 1), then frontend component (Wave 2). Both are low-complexity — single-plan execution is realistic.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| FastAPI | existing | New `audit` router, two GET endpoints | Already in use for all API routes |
| Supabase-py | existing | `audit_log` table SELECT via service-role | Established pattern for all DB reads |
| Python `csv` stdlib | stdlib | CSV generation in export endpoint | Already used in `documents.py` for CSV processing; no new dep |
| React + TypeScript | existing | `AuditLogSection` component | Project stack |
| shadcn/ui Button, Card | existing (installed) | Export CSV button, SectionCard wrapper | UI-SPEC confirmed all components installed |
| lucide-react | existing | `Download`, `ChevronLeft`, `ChevronRight`, `Loader2` icons | Already used throughout app |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| FastAPI `StreamingResponse` | existing | Stream CSV content with correct headers | Required for `Content-Disposition: attachment` CSV export |
| `io.StringIO` | stdlib | Build CSV string in memory | Used with `csv.writer` for small-to-medium datasets |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `io.StringIO` + `csv.writer` | Third-party CSV library | No benefit — stdlib covers this perfectly |
| `StreamingResponse` | `Response(content=...)` | `StreamingResponse` is correct for file downloads with proper headers |

**Installation:** No new packages needed. All dependencies already in the project.

---

## Architecture Patterns

### Recommended Project Structure

```
backend/app/api/
├── audit.py          # NEW — audit router (two GET endpoints)
├── documents.py
└── ...

backend/tests/integration/
└── test_audit.py     # NEW — integration tests for GET /audit-logs and /audit-logs/export

frontend/src/pages/
└── SettingsPage.tsx  # MODIFIED — add AuditLogSection at bottom

frontend/src/lib/
└── api.ts            # MODIFIED — add getAuditLogs() and exportAuditLogs()
```

### Pattern 1: FastAPI Router with Service-Role Supabase Client

**What:** New router file in `backend/app/api/` using `get_current_user` and `get_supabase` dependencies. The `get_supabase()` dependency returns a service-role client, which bypasses RLS and can SELECT from `audit_log`. Filter by `user_id = current_user["id"]` in application code.

**When to use:** All Phase 31 backend endpoints.

**Example (from existing documents.py pattern):**
```python
# Source: backend/app/api/documents.py
from fastapi import APIRouter, Depends
from supabase import Client
from app.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/audit-logs", tags=["audit"])

@router.get("")
async def list_audit_logs(
    page: int = 1,
    page_size: int = 50,
    since: str | None = None,
    action_type: str | None = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = current_user["id"]
    # Build query: filter user_id, apply since/action_type, count + paginate
    ...
```

**Registration in main.py (existing pattern):**
```python
from app.api import audit
app.include_router(audit.router)
```

### Pattern 2: `since` Parameter to Timestamp Conversion

**What:** Convert `since` string values (`7d`, `30d`, `90d`) to a UTC datetime for the `gte` filter on `created_at`.

**Example:**
```python
from datetime import datetime, timezone, timedelta

def _since_to_dt(since: str | None) -> datetime | None:
    if since == "7d":
        return datetime.now(timezone.utc) - timedelta(days=7)
    if since == "30d":
        return datetime.now(timezone.utc) - timedelta(days=30)
    if since == "90d":
        return datetime.now(timezone.utc) - timedelta(days=90)
    return None  # all time
```

Then apply: `query = query.gte("created_at", dt.isoformat())` when `dt is not None`.

### Pattern 3: Supabase Pagination with Total Count

**What:** Supabase-py supports count queries. Use two queries or a count query to get total. The simplest approach is two separate queries: one for `count` (using `.select("*", count="exact")`) and one for paginated data.

**Example:**
```python
# Count query
count_res = (
    supabase.table("audit_log")
    .select("id", count="exact")
    .eq("user_id", user_id)
    .execute()
)
total = count_res.count  # supabase-py exposes .count when count="exact"

# Data query
offset = (page - 1) * page_size
data_res = (
    supabase.table("audit_log")
    .select("id, action_type, metadata, created_at")
    .eq("user_id", user_id)
    .order("created_at", desc=True)
    .range(offset, offset + page_size - 1)
    .execute()
)
```

**Important:** Apply the same `since`/`action_type` filters to BOTH the count query and the data query so the total reflects the filtered dataset.

**Supabase-py `.range()`:** The `range(from, to)` method is 0-indexed and inclusive on both ends. For page 1, page_size 50: `range(0, 49)`. For page 2: `range(50, 99)`.

### Pattern 4: CSV Export via StreamingResponse

**What:** The export endpoint generates a CSV in memory using `io.StringIO` and `csv.writer`, returns a `StreamingResponse` with `Content-Disposition: attachment`.

**Example (matches existing `documents.py` pattern):**
```python
import csv
import io
from fastapi.responses import StreamingResponse

@router.get("/export")
async def export_audit_logs(
    since: str | None = None,
    action_type: str | None = None,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    # Fetch ALL matching rows (no pagination)
    rows = _fetch_all_filtered(supabase, current_user["id"], since, action_type)

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["timestamp", "action_type", "details", "metadata_json"])
    for row in rows:
        writer.writerow([
            row["created_at"],
            row["action_type"],
            _format_details(row["action_type"], row["metadata"]),
            json.dumps(row["metadata"]),
        ])

    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=audit-log.csv"},
    )
```

### Pattern 5: Frontend Blob URL Download

**What:** The existing `exportSkill` function in `api.ts` (lines 469-484) demonstrates the exact blob URL download pattern to reuse for CSV export.

**Source: `frontend/src/lib/api.ts` lines 469-484:**
```typescript
export async function exportAuditLogs(since?: string, actionType?: string): Promise<void> {
  const token = await getAuthToken()
  const params = new URLSearchParams()
  if (since) params.set("since", since)
  if (actionType) params.set("action_type", actionType)
  const res = await fetch(`${API_BASE}/audit-logs/export?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error("Failed to export audit log")
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = "audit-log.csv"
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

**Key:** Use `getAuthToken()` (not `getAuthHeaders()`) — do not set Content-Type when downloading a blob; the response type is determined by the server.

### Pattern 6: SettingsPage SectionCard with Custom Header

**What:** The existing `SectionCard` component (SettingsPage.tsx lines 113–127) wraps children in a Card with title + description. For the Audit Log section, the card header needs a two-column layout (title+description left, Export CSV button right).

**The existing SectionCard does not support a right-side header action.** The planner must decide: either (a) render a custom Card structure inline (not using SectionCard), or (b) modify/extend SectionCard to accept a `headerAction` prop.

**Recommended approach (inline Card):** Because SectionCard is defined inline in SettingsPage.tsx, the planner should create the Audit Log section directly using Card/CardHeader components with `className="flex flex-row items-start justify-between"` on the CardHeader, rather than trying to fit it into the existing SectionCard wrapper. This avoids modifying a shared component that 7 other sections depend on.

**UI-SPEC confirmed layout:**
```
<Card className="ghost-border bg-card/50 shadow-sm">
  <CardHeader className="flex flex-row items-start justify-between">
    <div>
      <CardTitle className="text-base font-headline font-bold">Audit Log</CardTitle>
      <CardDescription>Your account activity — all significant actions...</CardDescription>
    </div>
    <Button size="sm" className="gap-2 gradient-primary shrink-0">
      <Download className="h-3.5 w-3.5" /> Export CSV
    </Button>
  </CardHeader>
  <CardContent>...</CardContent>
</Card>
```

### Pattern 7: Filter State + Fetch Trigger

**What:** Audit log filter state lives in component-local `useState`. Any filter change resets page to 1 and triggers a new fetch. The fetch fires in `useEffect` whenever `[page, since, actionType]` dependencies change.

**Example:**
```typescript
const [page, setPage] = useState(1)
const [since, setSince] = useState<string | undefined>(undefined)  // undefined = all time
const [actionType, setActionType] = useState<string | undefined>(undefined)
const [entries, setEntries] = useState<AuditEntry[]>([])
const [total, setTotal] = useState(0)
const [loading, setLoading] = useState(false)
const [error, setError] = useState<string | null>(null)

useEffect(() => {
  setLoading(true)
  setError(null)
  getAuditLogs(page, since, actionType)
    .then(({ entries, total }) => { setEntries(entries); setTotal(total) })
    .catch((e: Error) => setError(e.message))
    .finally(() => setLoading(false))
}, [page, since, actionType])

// On filter change: reset page first (triggers re-fetch via useEffect)
const handleSinceChange = (value: string | undefined) => {
  setSince(value)
  setPage(1)
}
```

### Anti-Patterns to Avoid

- **Direct Supabase JS client SELECT on `audit_log`:** RLS has INSERT-only policy for users. Direct SELECT from the frontend/Supabase JS client returns 0 rows or a permission error. All reads must go through FastAPI backend with service-role client.
- **Calling `.count` on builder without `count="exact"` param:** Supabase-py only populates `.count` on the result when the select call includes `count="exact"`. Without it, `.count` is `None`.
- **Forgetting to apply filters to both count and data queries:** If only the data query is filtered, the total will be wrong (showing count of all entries, not filtered).
- **Page reset race condition:** If `setPage(1)` and `setSince(value)` are called separately, the `useEffect` may fire twice (once with new `since` but old page, once with page=1). Use a single state update or functional `setPage(1)` before `setSince` inside the same handler — React batches state updates inside event handlers in React 18, so this is safe.
- **Using `getAuthHeaders()` for blob download:** Always use `getAuthToken()` for blob/file downloads. Setting `Content-Type: application/json` breaks the response parsing.
- **Pagination off-by-one with `.range()`:** Supabase range is 0-indexed inclusive. For page 1, size 50: `range(0, 49)`. For page 2: `range(50, 99)`. Formula: `range((page-1)*page_size, page*page_size - 1)`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| CSV generation | Custom string concatenation | `csv.writer` + `io.StringIO` | Handles quoting, escaping, line endings correctly |
| File download trigger | Custom iframe/window.open | Blob URL + `<a download>` click | Established pattern already in `exportSkill` (api.ts:469) |
| Timestamp formatting | Custom date formatter | `new Date(ts).toLocaleString('en-US', {...})` | Handles locale, AM/PM, DST correctly |
| Auth header injection | Manual token retrieval inline | `getAuthToken()` from api.ts | Consistent, already handles session expiry error |

**Key insight:** The `exportSkill` function in `api.ts` is a direct template for `exportAuditLogs` — copy the blob download pattern verbatim.

---

## Common Pitfalls

### Pitfall 1: INSERT-Only RLS Breaks Backend SELECT

**What goes wrong:** Developer queries `audit_log` table using the anon or user JWT (e.g., via Supabase JS client or a Supabase-py client initialized with the anon key). Returns 0 rows or a permission denied error.

**Why it happens:** Migration `017_audit_log.sql` created only an INSERT policy, no SELECT policy. This is intentional (AUDIT-03 — entries cannot be modified or deleted).

**How to avoid:** Use `get_supabase()` which returns a `create_client(supabase_url, supabase_service_role_key)` — the service-role key bypasses RLS. Then filter `user_id = current_user["id"]` in the query itself. This is the existing pattern for all backend endpoints.

**Warning signs:** Endpoint returns `{"entries": [], "total": 0}` even when entries exist in the DB. Check client initialization key (service role vs anon).

### Pitfall 2: Supabase Count Query Returning None

**What goes wrong:** `.count` attribute on the query result is `None` even though rows exist.

**Why it happens:** Must pass `count="exact"` to `.select()` for Supabase to populate `.count`. Using `.select("*")` without count param leaves `.count` as `None`.

**How to avoid:** Use `.select("id", count="exact")` for the count query. Alternatively, fetch data with count in one call: `.select("*", count="exact")` and read both `.data` and `.count`.

**Warning signs:** `total` is always `None` or `0` in the response. Add a print/log of `count_res.count` to verify.

### Pitfall 3: SectionCard Header Cannot Hold a Right-Side Button

**What goes wrong:** Developer tries to pass Export CSV button as a child of the existing `SectionCard` component, which places all children inside a `divide-y divide-border/30` div inside `CardContent`. The button ends up in the wrong position.

**Why it happens:** `SectionCard` renders: `CardHeader` (title + description), then `CardContent > div.divide-y` (children). There is no slot for a header action.

**How to avoid:** Do not use the `SectionCard` helper for the Audit Log section. Render the Card, CardHeader, and CardContent directly, giving CardHeader `className="flex flex-row items-start justify-between"`.

### Pitfall 4: Filter Change Not Resetting Page

**What goes wrong:** User selects "7d" filter while on page 3. Fetch fires with `page=3&since=7d` but only 2 pages of 7-day data exist. Backend returns empty results for page 3.

**Why it happens:** Page state was not reset to 1 when a filter changed.

**How to avoid:** In all filter-change handlers (`handleSinceChange`, `handleActionTypeChange`), always call `setPage(1)` before or alongside the filter state update. React 18 batches these in event handlers so only one `useEffect` fires.

### Pitfall 5: CSV Details Column for `thread.create` and `thread.delete`

**What goes wrong:** `_format_details` function attempts to access `metadata.get("filename")` or similar for `thread.create`, returns empty string or `None`, which serializes as blank cell in CSV.

**Why it happens:** `thread.create` and `thread.delete` have no meaningful metadata (per D-04 decision).

**How to avoid:** In the `_format_details` function (both Python and TypeScript), explicitly handle `thread.create` and `thread.delete` with `return "—"` (em-dash). Do not fall through to generic metadata access.

### Pitfall 6: Conftest Mock Missing `.gte()` and `.range()` Method Wiring

**What goes wrong:** Integration tests for the new `audit` router fail with `AttributeError` because the shared `_builder` mock does not have `.gte()` or `.range()` wired to return `_builder`.

**Why it happens:** The shared `conftest.py` builder mock wires specific methods (`select`, `insert`, `eq`, `order`, etc.) but does not wire `.gte()` or `.range()` — these are new to Phase 31.

**How to avoid:** Add `.gte.return_value = b` and `.range.return_value = b` to `_make_builder()` in `conftest.py`, and add the same reset lines to the `reset_mocks` fixture. This is the established pattern (previous phases added `.neq`, `.is_`, `.or_`, `.limit` for the same reason).

---

## Code Examples

### Backend: `_format_details` Helper (Python)

```python
import json

def _format_details(action_type: str, metadata: dict) -> str:
    """Produce the human-readable Details one-liner for a given audit entry."""
    if action_type == "document.upload":
        fname = metadata.get("filename", "")
        size = metadata.get("file_size")
        if size is not None:
            return f"{fname} ({_format_bytes(size)})"
        return fname
    if action_type == "document.delete":
        return metadata.get("filename", "")
    if action_type == "search.query":
        text = metadata.get("query_text", "")
        if len(text) > 60:
            text = text[:60] + "…"
        return f'"{text}"'
    if action_type == "code.execute":
        return metadata.get("language", "")
    if action_type == "skill.load":
        return metadata.get("skill_name", "")
    if action_type in ("thread.create", "thread.delete"):
        return "\u2014"  # em-dash
    if action_type == "settings.update":
        keys = metadata.get("changed_keys", [])
        return ", ".join(keys)
    return ""

def _format_bytes(size: int) -> str:
    if size < 1024:
        return f"{size} B"
    if size < 1024 * 1024:
        return f"{size / 1024:.1f} KB"
    return f"{size / (1024 * 1024):.1f} MB"
```

### Frontend: `formatDetails` Helper (TypeScript)

```typescript
function formatDetails(actionType: string, metadata: Record<string, unknown>): string {
  switch (actionType) {
    case "document.upload": {
      const fname = metadata.filename as string ?? ""
      const size = metadata.file_size as number | undefined
      return size !== undefined ? `${fname} (${formatBytes(size)})` : fname
    }
    case "document.delete":
      return (metadata.filename as string) ?? ""
    case "search.query": {
      let text = (metadata.query_text as string) ?? ""
      if (text.length > 60) text = text.slice(0, 60) + "…"
      return `"${text}"`
    }
    case "code.execute":
      return (metadata.language as string) ?? ""
    case "skill.load":
      return (metadata.skill_name as string) ?? ""
    case "thread.create":
    case "thread.delete":
      return "\u2014"
    case "settings.update": {
      const keys = (metadata.changed_keys as string[]) ?? []
      return keys.join(", ")
    }
    default:
      return ""
  }
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}
```

### Frontend: `getAuditLogs` API Function

```typescript
export interface AuditEntry {
  id: string
  action_type: string
  metadata: Record<string, unknown>
  created_at: string
}

export interface AuditLogsResponse {
  entries: AuditEntry[]
  total: number
  page: number
  page_size: number
}

export async function getAuditLogs(
  page = 1,
  since?: string,
  actionType?: string,
): Promise<AuditLogsResponse> {
  const headers = await getAuthHeaders()
  const params = new URLSearchParams({ page: String(page), page_size: "50" })
  if (since) params.set("since", since)
  if (actionType) params.set("action_type", actionType)
  const res = await fetch(`${API_BASE}/audit-logs?${params}`, { headers })
  if (!res.ok) throw new Error("Failed to load audit log")
  return res.json() as Promise<AuditLogsResponse>
}
```

### Frontend: Timestamp Formatting

```typescript
// Source: CONTEXT.md + UI-SPEC Interaction Contract
function formatTimestamp(ts: string): string {
  return new Date(ts).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  })
  // Output: "Apr 14, 2026 10:32 AM"
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Direct Supabase JS client for DB reads | FastAPI backend with service-role client | Phase 30 (audit_log INSERT-only RLS) | Frontend cannot read audit_log directly |
| Blob download via window.open | Blob URL + programmatic `<a>` click | Phase 13 (skill export) | More reliable, works in all browsers |

---

## Environment Availability

Step 2.6: SKIPPED — this phase is a code-only addition (new router file + frontend component). All runtime dependencies (FastAPI, Supabase, React, Node) are already verified operational from previous phases. No new external tools, services, or runtimes are required.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | pytest 8.x (backend), no frontend test framework |
| Config file | `backend/pytest.ini` or `pyproject.toml` (existing) |
| Quick run command | `cd backend && python -m pytest tests/integration/test_audit.py -x -q` |
| Full suite command | `cd backend && python -m pytest -x -q` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUDIT-04 | `GET /audit-logs` returns paginated entries filtered by user_id | integration | `pytest tests/integration/test_audit.py::TestListAuditLogs -x` | ❌ Wave 0 |
| AUDIT-04 | `since=7d` filter excludes entries older than 7 days | integration | `pytest tests/integration/test_audit.py::TestListAuditLogs::test_since_filter -x` | ❌ Wave 0 |
| AUDIT-04 | `action_type` filter returns only matching entries | integration | `pytest tests/integration/test_audit.py::TestListAuditLogs::test_action_type_filter -x` | ❌ Wave 0 |
| AUDIT-04 | Unauthenticated request returns 401 | integration | `pytest tests/integration/test_audit.py::TestListAuditLogs::test_requires_auth -x` | ❌ Wave 0 |
| AUDIT-05 | `GET /audit-logs/export` returns CSV with correct headers | integration | `pytest tests/integration/test_audit.py::TestExportAuditLogs -x` | ❌ Wave 0 |
| AUDIT-05 | CSV contains `timestamp, action_type, details, metadata_json` columns | integration | `pytest tests/integration/test_audit.py::TestExportAuditLogs::test_csv_columns -x` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd backend && python -m pytest tests/integration/test_audit.py -x -q`
- **Per wave merge:** `cd backend && python -m pytest -x -q`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `backend/tests/integration/test_audit.py` — covers AUDIT-04 and AUDIT-05
- [ ] `conftest.py` — needs `.gte.return_value = b` and `.range.return_value = b` added to `_make_builder` and `reset_mocks`

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 31 |
|-----------|-------------------|
| No LangChain, no LangGraph — raw SDK calls only | Not relevant (no LLM calls in this phase) |
| Use Pydantic for structured LLM outputs | Not relevant (no LLM calls) |
| All tables need Row-Level Security | `audit_log` RLS already exists (Phase 30). No new tables. |
| Stream chat responses via SSE | Not applicable (this phase uses regular JSON + CSV responses) |
| Python backend must use a `venv` virtual environment | Plan must use `venv` for running tests and the backend |
| No admin UI — config via env vars | Audit log UI is user-facing, not admin — compliant |
| Save all plans to `.agent/plans/` — naming convention `{sequence}.{plan-name}.md` | GSD planner handles plan location; note that CLAUDE.md has a separate `.agent/plans/` convention which predates GSD. GSD plans go to `.planning/phases/` per current workflow. |

---

## Open Questions

1. **`_format_details` for `settings.update` — what shape does `changed_keys` have in Phase 30 metadata?**
   - What we know: Phase 30 sanitizes keys containing `_key` or `_secret`. The `changed_keys` field is stored in `metadata`.
   - What's unclear: Is it `changed_keys: ["llm_model", "active_provider"]` (list of strings) or a different structure?
   - Recommendation: Read `backend/app/api/settings.py` to verify the exact metadata shape before implementing `_format_details`. Likely a list of strings — use `", ".join(keys)`.

2. **Supabase-py `.count` attribute availability on service-role client**
   - What we know: Supabase-py supports `count="exact"` parameter on `.select()`.
   - What's unclear: Exact attribute name — is it `result.count` or `result.data`-derived?
   - Recommendation: In the implementation, verify with `count_res.count` — supabase-py exposes `.count` on the `APIResponse` when `count="exact"` is passed. If uncertain, fetch all IDs and use `len(result.data)` as a fallback (only acceptable for small datasets).

---

## Sources

### Primary (HIGH confidence)

- Existing codebase — `backend/app/dependencies.py` — service-role client pattern, `get_current_user` dependency
- Existing codebase — `backend/supabase/migrations/017_audit_log.sql` — table schema, RLS policy (INSERT-only)
- Existing codebase — `backend/app/services/audit_service.py` — VALID_ACTION_TYPES frozenset
- Existing codebase — `frontend/src/lib/api.ts` lines 469-484 — blob URL download pattern (`exportSkill`)
- Existing codebase — `frontend/src/pages/SettingsPage.tsx` — SectionCard, FieldRow, ghost-border patterns
- Existing codebase — `backend/tests/conftest.py` — test fixture patterns, builder mock wiring
- `.planning/phases/31-audit-log-settings-ui/31-CONTEXT.md` — all locked decisions
- `.planning/phases/31-audit-log-settings-ui/31-UI-SPEC.md` — visual/interaction contract

### Secondary (MEDIUM confidence)

- Supabase-py documentation pattern for `count="exact"` — consistent with supabase-py v2 API
- FastAPI `StreamingResponse` pattern — standard FastAPI response type for file streaming

### Tertiary (LOW confidence)

None.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all existing libraries, no new deps
- Architecture: HIGH — all patterns verified from existing codebase (documents.py, api.ts, conftest.py)
- Pitfalls: HIGH — derived from existing Phase 30 decisions (INSERT-only RLS) and established codebase patterns

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack, locked decisions)
