# Phase 217: The Library — One Home for Documents · Pattern Map

**Mapped:** 2026-08-29
**Files analyzed:** 31 (10 backend · 15 frontend · 6 tooling/test-infra)
**Analogs found:** 28 / 31 (2 partial · 1 no analog)

> **How to read this file.** `217-RESEARCH.md` already measured *what* to build and *where the
> facts live*. This file answers a narrower question: **for each new or modified file, which
> shipped file is its nearest sibling, and what exactly does it copy from it.** Where RESEARCH
> already carries the excerpt, this file **cites the section rather than repeating it** and adds
> only the missing half — the sibling's import block, its export shape, its test counterpart, and
> which side of the vitest count gate it sits on.
>
> ⚠ **Every line number below was re-read on 2026-08-29.** Six differ from `217-RESEARCH.md`
> (measured 2026-08-28) and each divergence is recorded inline as a **CORRECTION**, never silently
> overwritten. Re-derive rather than quote: this repo's own repeated finding is that a figure goes
> stale within a day.

---

## Corrections to 217-RESEARCH.md's cited lines (re-measured 2026-08-29)

| Claim in RESEARCH | RESEARCH said | **measured 2026-08-29** | Why it matters |
|---|---|---|---|
| `PanelSection` conditional body | `:93` | **`:94`** | this is the ⭐ lazy-mount mechanism; a plan quoting `:93` cites a `}` |
| `useDocuments` spread-merge | `:56-58` | **`:57-58`** | D-217-10's reconcile site |
| `DocumentUpload` `accept` literal | `:132` | **`:138`** | D-217-18's single source; the file is 144 L, so `:132` is 6 lines off |
| `multimodal_service` tables `return` | `:502` | **`:504`** | the "marker proves nothing" fact (D-217-24) |
| `knowledge_health.WINDOW_DAYS` | `:28` | **`:27`** | sketch fence `A6e` pins the *30 days* label to this constant |
| `kb.py` route 404-fold | `:478-480` | **`:474`** | the line `/content` must **not** copy |
| `drive.cjs` assertion count | 193 (2026-08-28) | **193 passed · 0 failed** (re-run 2026-08-29) | unchanged — confirmed, not inherited |

Unchanged and re-confirmed: `kb.py:397` (`read_path`), `kb.py:446` (the numbering), `nav-items.ts:37`,
`ChatLayout.tsx:757/758/879`, `types/index.ts:499`, `DocumentList.tsx:349-355` + `:422`,
`IngestionPage.tsx:449-450`, `DocumentDetailPanel.tsx:242/265/279`, `multimodal_service.py:759`,
`models/document.py` = 48 lines.

---

## File Classification

**Gate column legend** — `T` = in `TARGETS` (the gate *runs* it) · `B` = in `BASELINE` (the gate
*guards* it) · `—` = neither. Source: `scripts/vitest-count-gate.cjs` (`BASELINE` keys are bare
filenames via `bareName()` `:4112-4114`; `TARGETS` are explicit paths, one directory entry only —
`src/components/workflows`). Backend files are outside the vitest gate entirely and are marked `n/a
(pytest)`.

### Backend — new

| New file / route | Role | Data flow | Closest analog | Match | Gate |
|---|---|---|---|---|---|
| `GET /documents/{id}/content` | route | request-response (blob slice) | `backend/app/api/kb.py:397-461` `read_path` + `:464-481` `/read` | **exact** | n/a (pytest) |
| `GET /documents/{id}/chunks` | route | CRUD-read (list) | `backend/app/api/documents.py:773-800` `list_document_versions` | **exact (role+flow)** | n/a |
| `GET /documents/{id}/tables` | route | CRUD-read (list) | same | **exact** | n/a |
| `GET /documents/{id}/images` | route | CRUD-read (list) | same | **exact** | n/a |
| `GET /documents/{id}/queries` (recommend new module `backend/app/api/document_queries.py`) | route + module | analytics read (service-role) | `backend/app/api/knowledge_health.py:1-12` + `:51-77` + `:555-566` | **exact** | n/a |
| new response models in `backend/app/models/document.py` | model | — | `backend/app/models/kb.py:70-76` `ReadResponse` · `models/document.py:30-48` | **exact** | n/a |
| `_stage_applies` helper in `multimodal_service.py` (D-217-24) | utility | pure predicate | `multimodal_service.py:186-196` `_mime_to_extractor` | **exact** | n/a |
| `backend/tests/test_217_document_detail_routes.py` | test | — | `backend/tests/test_knowledge_health.py:1-60` + `:213-223` | **exact** | n/a |
| `backend/tests/test_217_document_response_fields.py` | test | — | same | **exact** | n/a |

### Backend — modified

| File | Role | Data flow | Analog for the change | Match | Gate |
|---|---|---|---|---|---|
| `backend/app/models/document.py` (`DocumentResponse` +4 fields) | model | — | its own `table_count: int = 0` / `image_count: int = 0` (`:47-48`) — **defaulted scalars already on this model** | **exact (in-file)** | n/a |
| `backend/app/services/multimodal_service.py` (+1 helper) | service | pure | `_mime_to_extractor` `:186-196` | **exact (in-file)** | n/a |
| `backend/app/main.py` (`include_router` if a new module lands) | config | — | `main.py:751` import list + `:761` `include_router(knowledge_health.router)` | **exact** | n/a |
| `backend/app/api/documents.py:558` error string (optional one-liner) | route | — | its own `ALLOWED_MIME_TYPES` `:91` | in-file | n/a |

### Frontend — new

| New file | Role | Data flow | Closest analog | Match | Gate |
|---|---|---|---|---|---|
| `frontend/src/pages/LibraryPage.tsx` (git mv of `IngestionPage.tsx`) | page | composition | itself (rename) — shell analog: `frontend/src/pages/KnowledgeHealthPage.tsx` (the shipped 4-tab `ui/tabs` mount) | **exact** | `—` → must become `T`+`B` |
| `frontend/src/pages/librarySelection.ts` (reducer + discriminated union) | store/model | state transform | `frontend/src/components/workflows/argumentModel.ts` (pure leaf, zero imports, fenced against its mirror) | **role-match** | `—` (new) |
| the six-stage ingestion strip component | component | derived render | `frontend/src/components/ingestion/DocumentStatusBadge.tsx` (the `ingestion_step`-only-while-processing guard `:27-32`) | **partial** — no strip exists | `—` (new) |
| the accepted-formats constant (D-217-18) | config/constant | — | `frontend/src/components/workflows/argumentModel.ts:57-59` (`SCALAR_TYPES`/`COMPOSITE_KEYS` — module constants fenced against a `.py` mirror) | **role-match** | `—` (new) |
| the full-width dropzone | component | file-I/O | `frontend/src/components/ingestion/DocumentUpload.tsx` (144 L — the existing path, **reused not rebuilt**) | **exact** | `—` |
| 5 × detail-panel section (`content`/`chunks`/`tables`/`images`/`queries`) | component | request-response (lazy) | `frontend/src/components/relationships/RelationshipsSection.tsx` | **exact** | `—` (new) |
| the shared table renderer for `/tables` | component | render | `frontend/src/components/panel/CsvTablePreview.tsx:123-176` | **exact** | `—` |
| Views tab body | component | composition | `frontend/src/components/ingestion/ViewsGroup.tsx:35-57` — **mounted, not reimplemented** | **exact** | `—` |
| Indexing tab body | component | composition | `frontend/src/components/settings/ReembedStatusCard.tsx:37` — **composed unchanged** (D-217-16/22) | **exact** | `—` |
| new client fns in `frontend/src/lib/api/documents.ts` | service (client) | request-response | `lib/api/documents.ts:15-20` `listDocuments` | **exact (in-file)** | file is `—`; its barrel test is `T`+`B` |
| 7 × Wave-0 vitest suites (see VALIDATION.md) | test | — | see § *Test-file analogs* | **exact** | must land `T`+`B` in the creating commit |

### Frontend — modified

| File | Role | Data flow | Analog for the change | Match | Gate |
|---|---|---|---|---|---|
| `frontend/src/components/ui/tabs.tsx` | primitive | — | its own `TabsList:15` / `TabsTrigger:30` class strings; token precedent `--panel-*` in `index.css` + `tailwind.config.js` | in-file | `—` (no suite exists) |
| `frontend/src/lib/nav-items.ts:37` | config | — | the sibling entries `:42`, `:43` | in-file | `—` |
| `frontend/src/components/layout/ChatLayout.tsx:8, :757-758` | layout | — | the adjacent `activeView === "skills"` arm `:759` | in-file | `—` |
| `frontend/src/hooks/useDocuments.ts` | hook | event-driven + fetch reconcile | its own UPDATE arm `:47-62` (the spread-merge comment states the rule) | in-file | `—` → adopt `T`+`B` |
| `frontend/src/components/metadata/DocumentDetailPanel.tsx` | component (shell) | composition | its own Relationships mount `:265-274` | in-file | `DocumentDetailPanel.images.test.tsx` is `T`+`B`@3; the panel's other suites are `—` |
| `frontend/src/components/ingestion/DocumentList.tsx` | component | render | its own `:422` badge mount | in-file | `—` |
| `frontend/src/types/index.ts` | types (barrel) | — | its own `Document` block `:488-...`, `ingestion_step` `:499` | in-file | `—` |
| `scripts/vitest-count-gate.cjs` | tooling | — | the SEED-227 pair: `BASELINE "DocumentDetailPanel.images.test.tsx": 3` (`:2805`) + `TARGETS "src/components/metadata/DocumentDetailPanel.images.test.tsx"` (`:3996`) | **exact** | n/a |
| `.planning/sketches/218-…/{COPY.js,index.html,drive.cjs}` + regenerate contract | sketch | — | `drive.cjs:48-51` `src()` / `:25-27` `ok()` | in-file | n/a |

---

## Pattern Assignments

### 1 · `GET /documents/{id}/content` (route, blob slice)

**Analog:** `backend/app/api/kb.py:397-461` (`read_path`) + `:464-481` (`/kb/read`).
RESEARCH § */content — what `kb.py` actually does, and what it should NOT copy* carries the envelope
and the reuse/don't-reuse split. **Not repeated here.** What it did not give:

**The owner→global-folder two-step, verbatim (`kb.py:405-425`) — this is the access pattern to copy:**

```python
result = await aexec(
    supabase.table("documents").select("id, filename, full_markdown")
    .eq("id", document_id).eq("user_id", user_id).maybe_single()
)
if not result or not result.data:
    global_folder_ids = await get_globally_visible_folder_ids(supabase, user_id)
    if global_folder_ids:
        result = await aexec(
            supabase.table("documents").select("id, filename, full_markdown")
            .eq("id", document_id).in_("folder_id", global_folder_ids).maybe_single()
        )
```

⛔ **The three lines NOT to copy**, each re-measured today:

| Line | Shipped behaviour | Why `/content` must differ |
|---|---|---|
| `kb.py:446` | `numbered = "\n".join(f"{start_line + i}: {line}" …)` | a human reading their own document must not get `42: ` glued to every line; Markdown breaks outright |
| `kb.py:436` | `return {"error": "No content available for this document."}` | an empty-text document is not a missing document |
| `kb.py:474` | `raise HTTPException(status_code=404, detail=result["error"])` | it folds *both* errors above into a 404 |

**Response-model analog:** `backend/app/models/kb.py:70-76` — `ReadResponse` already carries
`{document_id, filename, total_lines, content, start_line?, end_line?}`; the new envelope is that
plus `has_more`.

---

### 2 · `/chunks` · `/tables` · `/images` (route, CRUD-read list)

**Nearest sibling in the destination file:** `backend/app/api/documents.py:773-800`
(`list_document_versions`) — the *only* `documents.py` route that does **parent-check-then-list**,
which is exactly the new shape.

```python
@router.get("/{document_id}/versions", response_model=list[DocumentResponse])
async def list_document_versions(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_user_supabase_client),
):
    """Return all versions of a document ordered by version_number descending."""
    # 1. Verify doc exists and user has access
    doc = (supabase.table("documents").select("filename, user_id, folder_id")
           .eq("id", document_id).eq("user_id", current_user["id"])
           .maybe_single().execute())            # ⚠ BARE .execute() — see below
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
```

**Copy:** the signature (`document_id: str` + `get_current_user` + `get_user_supabase_client`), the
`maybe_single()` parent check, the verbatim `detail="Document not found"`, and the numbered
`# 1. / # 2.` comment shape.
⛔ **Do not copy its `.execute()`** — it is the same D-v2.5-01 violation RESEARCH Pitfall 1 names in
`list_documents`. Substitute `await aexec(...)` (§ *Shared Pattern A*).

**Response models** go beside `DocumentResponse` in `backend/app/models/document.py` (48 L today).
RESEARCH § *Response models — the convention* gives the five model bodies. The **in-file precedent
for a defaulted scalar** is that file's own last two lines:

```python
    table_count: int = 0
    image_count: int = 0
```

— which is precisely the shape the four new `DocumentResponse` fields take (Pitfall 4: default
everything).

---

### 3 · `GET /documents/{id}/queries` (route, analytics read, **service-role carve-out**)

**Analog:** `backend/app/api/knowledge_health.py` — and RESEARCH recommends a **dedicated module**
so the exception keeps ONE auditable rationale. The three parts, read verbatim today:

**(a) the module docstring (`:1-12`)** — copy its *structure* (which table forces it → the RLS fact →
the sole app-level gate → read-only/parameterized), including this sentence which is the argument for
a dedicated module:

```
Like ``governance_service.py``, this is the plan's "aggregate/analytics call that legitimately
needs service-role" carve-out: every query stays owner-scoped in app code via
``.eq("user_id", user_id)`` (D-14 belt-and-suspenders — the sole gate), parameterized, and
read-only. … the module is kept uniformly service-role so the surface has ONE auditable
rationale rather than a per-handler split.
```

**(b) the per-route inline comment, verbatim (`:559`, and 7 more sites):**

```python
    supabase: Client = Depends(get_supabase),  # SERVICE-ROLE (classified): reads audit_log (no authenticated SELECT policy) — see module docstring
```

**(c) the query shape (`:51-61`)** — `.eq("user_id", user_id)` is the **first** filter, taken from
`current_user["id"]`, never from the request:

```python
res = (supabase.table("audit_log").select("metadata, created_at")
       .eq("user_id", user_id)
       .eq("action_type", "search.query")
       .gte("created_at", _window_cutoff(WINDOW_DAYS))
       .execute())
```

**Window constant:** `WINDOW_DAYS = 30` — **`knowledge_health.py:27`** *(CORRECTION: RESEARCH said
`:28`)*. Sketch fence `A6e` labels every retrieval count *30 days*; a different window here breaks a
live assertion.

**Route-shell + error envelope analog (`:555-566`):** every handler is
`try: return _fetch_x(...) except Exception as exc: raise HTTPException(502, detail="Health metrics
temporarily unavailable") from exc`. Copy the try/502 shape; **choose your own detail string** — the
Library's is not a health metric.

**Registration analog:** `backend/app/main.py:751` (one flat import list) + `:761`
(`app.include_router(knowledge_health.router)`).

---

### 4 · `multimodal_service.py` stage-applicability helper (D-217-24)

**Analog — the nearest sibling is 160 lines above the code it guards:** `multimodal_service.py:186-196`

```python
def _mime_to_extractor(mime: str) -> str:
    """Return a short extractor tag for the given MIME type (document_tables.extractor)."""
    if mime == PDF_MIME:
        return "pdfplumber"
    if mime == DOCX_MIME:
        return "python-docx"
    if mime in CSV_MIMES:
        return "csv-reader"
    if mime in EXCEL_MIMES:
        return "openpyxl"
    return "unknown"
```

**This is the exact shape the two new predicates take** — a module-level pure function sitting
directly beside the frozensets it reads, keyed on the same four constants:

```python
PDF_MIME = "application/pdf"                                                        # :26
DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document" # :27
CSV_MIMES: frozenset[str] = frozenset({"text/csv", "application/csv"})              # :28
EXCEL_MIMES: frozenset[str] = frozenset({                                           # :29-32
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
})
```

**The two `return`s that make the marker worthless** (D-217-24's measured justification):
`:504` `return  # Unsupported mime type — nothing to extract` *(CORRECTION: RESEARCH said `:502`)*
and `:759` a bare `return` in the images branch.

---

### 5 · `frontend/src/pages/LibraryPage.tsx` (page, composition)

**Analog:** itself. The rename is a `git mv` + the 15 sites RESEARCH § *SC#1* enumerates.
**Do not re-derive that list.** What PATTERNS adds:

**Its import block today (`IngestionPage.tsx:1-28`)** — the thing the rename must leave intact, and
the surface the tab shell has to slot into without becoming a tenth branch (the ledger's seam):

```tsx
import { useState, useMemo, useEffect, useCallback, useRef } from "react"
import { Folder, PanelLeftClose, PanelLeftOpen, SlidersHorizontal, X } from "lucide-react"
import { DocumentUpload } from "@/components/ingestion/DocumentUpload"
import { DocumentList } from "@/components/ingestion/DocumentList"
import { DocumentDetailPanel } from "@/components/metadata/DocumentDetailPanel"
import { FolderBreadcrumb } from "@/components/ingestion/FolderBreadcrumb"
import { FolderDetail } from "@/components/ingestion/FolderDetail"
import { FolderTree } from "@/components/ingestion/FolderTree"
import { FilterBar } from "@/components/ingestion/FilterBar"
import { ViewsGroup } from "@/components/ingestion/ViewsGroup"
import { ReembedSearchPointer } from "@/components/settings/ReembedStatusCard"
import { useDocuments } from "@/hooks/useDocuments"
…
import type { ActiveView } from "@/App"
```

⛔ **`SIDEBAR_PIN_KEY = "documents.sidebar.pinnedExpanded"` (`:47`) must NOT be renamed** — it is
stored state; renaming silently resets every user's pin (RESEARCH § *Runtime State Inventory*).

**Tab-shell analog:** `frontend/src/pages/KnowledgeHealthPage.tsx` is the shipped `@/components/ui/tabs`
mount (4 triggers, pinned by sketch fence `A9`). Read its `<Tabs>/<TabsList>/<TabsTrigger>/<TabsContent>`
composition before writing the Library's — **it is one of the two surfaces D-217-20's primitive edit
lands on**, so its markup is simultaneously the analog and the regression target (G4-8).

**Column-shedding rule to preserve verbatim (`IngestionPage.tsx:449-450`):**

```tsx
(panelOpen || isMobile) &&
  "[&_table_th:nth-child(n+3):nth-child(-n+5)]:hidden [&_table_td:nth-child(n+3):nth-child(-n+5)]:hidden",
```

---

### 6 · `librarySelection` reducer + discriminated union (D-217-12)

⚠ **`useReducer` appears in ZERO production files in this tree** (measured 2026-08-29:
`grep -rln useReducer frontend/src` returns one *test* file). There is no reducer analog. **The
correct analog is the "pure leaf module + exhaustive suite" pattern**, whose best-shipped instance is:

**Analog:** `frontend/src/components/workflows/argumentModel.ts` (Phase 214-07, 313 L) — a strict
leaf with **zero imports**, exported discriminated types, and a suite that drives it exhaustively.

```ts
// argumentModel.ts:57-59 — module constants, fenced against their Python mirror
const SCALAR_TYPES: readonly string[] = ["string", "number", "integer", "boolean"]
const COMPOSITE_KEYS: readonly string[] = ["oneOf", "anyOf", "allOf", "not", "$ref"]

/** The three arms of D-214-01, in the order every group renders them. */
export type ArgumentSource = "fixed" | "ask" | "upstream"          // :60
```

**Copy from its docblock (`:1-48`) the three headings that make a leaf auditable:**
*"── A STRICT LEAF ──"* (zero imports, no I/O, pure function of its arguments), *"⚠ … IS A DERIVED
DISPLAY FLAG AND IS NEVER STORED"*, and the explicit statement of what the module **cannot** produce.
`librarySelection` needs the same three: no reachable state where tab and list disagree (D-217-12),
`filteredDocs`/`matchCount` are async results and stay outside the union (RESEARCH § *SC#5 blast
radius*), and the reducer performs no I/O.

**Sibling leaves in the same family, if a second reference helps:**
`frontend/src/components/workflows/declaredInputs.ts` (174 L, one minting site + three refusals) and
`frontend/src/components/workflows/connectionState.ts` (114 L).

---

### 7 · The five new detail-panel sections (component, lazy request-response)

**Analog:** `frontend/src/components/relationships/RelationshipsSection.tsx` — the section-owns-its-fetch
pattern. RESEARCH § *The lazy-fetch section pattern* explains **why** `defaultOpen={false}` is the whole
mechanism. Here is the **shape to copy**, read today.

**Import block (`:31-37`):**

```tsx
import { useCallback, useEffect, useState } from "react"
import { X, RefreshCw } from "lucide-react"
import { listRelationships, deleteRelationship } from "@/lib/api"     // ⭐ THE BARREL, never lib/api/*
import type { RelationshipRow, RelType } from "@/types"
import { cn } from "@/lib/utils"
```

**Props contract (`:48-55`) — the `onTotalChange` lift is what populates the `PanelSection` badge:**

```tsx
export interface RelationshipsSectionProps {
  docId: string
  filename?: string
  /** Lift the loaded total up so the parent PanelSection can show a count badge. */
  onTotalChange?: (total: number) => void
}
type LoadState = "loading" | "ready" | "error"                        // :57
```

**The keyed fetch (`:74-99`):**

```tsx
const load = useCallback(async (silent = false) => {
  if (silent) setRefreshing(true); else setState("loading")
  try {
    const res = await listRelationships(docId)
    setRows(res.documents); setState("ready"); onTotalChange?.(res.total)
  } catch { setState("error") }                     // honest error, distinct from empty (D-117-10)
  finally { if (silent) setRefreshing(false) }
}, [docId, onTotalChange])

useEffect(() => { setRemoveError(false); void load() }, [load])
```

**The four honest arms, verbatim structure (`:151`, `:160`, `:175`):**

```tsx
{state === "loading" && (
  <div role="status" aria-live="polite" className="flex flex-col gap-2 py-1">
    <span className="sr-only">Loading relationships</span>
    <div aria-hidden="true" className="h-7 w-full animate-pulse rounded-md bg-border/30" />
  </div>
)}
{state === "error" && (
  <div className="flex flex-col gap-2 py-1">
    <p role="alert" className="text-sm text-[hsl(0_80%_80%)]">Couldn&rsquo;t load relationships</p>
    <button type="button" onClick={() => void load()} className="self-start rounded-md text-xs text-panel-muted-foreground …">Try again</button>
  </div>
)}
{state === "ready" && rows.length === 0 && ( /* the worded EMPTY arm */ )}
```

⚠ **Copy the token discipline, not just the markup:** every meaningful string uses
`text-panel-muted-foreground[-dim]`, never the global muted (its docblock `:28-29` records the
3.59:1 measurement). Loading is `role="status" aria-live="polite"`; error is `role="alert"`.

**The mount site — `DocumentDetailPanel.tsx:265-274`, and the one prop that must change:**

```tsx
<PanelSection title="Relationships" count={relTotal ?? undefined}>   {/* :265 — NO defaultOpen ⇒ true */}
  <RelationshipsSection docId={doc.id} filename={doc.filename} onTotalChange={setRelTotal} />
</PanelSection>
```

**The mechanism, re-measured — `PanelSection.tsx:94`** *(CORRECTION: RESEARCH said `:93`)*:

```tsx
      {open && (
        <div id={bodyId} role="region" aria-labelledby={headId} className="pb-3">
          {children}
        </div>
      )}
```

and the prop default that makes it fire eagerly today — `PanelSection.tsx:46` `defaultOpen = true`,
with `PanelSectionProps` at `:23-30` = `{title, count?, warn?, defaultOpen?, children}` (**no
`onOpenChange`, no `onToggle`**). The count badge accepts a flat number or `{done,total}`
(`PanelSectionCount`, `:21`; `renderCount` `:32-40`).

---

### 8 · The `/tables` renderer inside the 430px track

**Analog:** `frontend/src/components/panel/CsvTablePreview.tsx` — RESEARCH § *"Tables as tables"*
rules **for** this pattern and **against** `IngestionPage`'s column shedding. The four reusable parts,
re-read today:

```tsx
const MAX_BYTES = 256_000     // :28  — size caps BEFORE building DOM (T-087-07 DoS guard)
const MAX_ROWS = 2000         // :29

export function CsvTablePreview({ content, onDownload }: CsvTablePreviewProps) {   // :123
  if (content.length > MAX_BYTES) return <Fallback message="File too large to preview" … />  // :125
  const rows = parseCsv(content)                                                              // :129
  if (!rows) return <Fallback message="No preview available · Download" … />                  // :131
  if (rows.length > MAX_ROWS) return <Fallback message="File too large to preview" … />       // :137
  return (
    <div className="overflow-x-auto">                                                         {/* :144 */}
      <table className="w-full border-collapse font-mono text-[13px]">                        {/* :145 */}
        …<th className="border-b border-border px-2.5 py-1.5 text-left font-medium text-foreground whitespace-nowrap">
        …<td className="border-b border-border/50 px-2.5 py-1.5 text-panel-muted-foreground whitespace-nowrap">{cell}</td>  {/* :167 */}
```

**Its security docblock (`:15-17`) is the load-bearing part to carry over verbatim in spirit** —
`document_tables.rows` is untrusted document content:

```
 * SECURITY (T-087-04): every cell renders via React text children ({cell}) —
 * React auto-escapes, so a cell containing `<img src=x onerror=…>` renders as
 * literal text. ZERO raw-HTML injection on file content.
```

**Its `Fallback` sub-component (`:99-121`)** is the empty-arm shape: a centered `<p
className="text-[13px] text-panel-muted-foreground">{message}</p>` plus an optional action button.

⚠ `CsvTablePreview` takes a **CSV string**, not `{headers, rows}` — RESEARCH's recommendation is to
extract the *rendering* into a shared presentational component and leave the parser where it is.

---

### 9 · The ingestion strip (component, derived render)

⚠ **No strip exists.** The closest thing is the **badge that already reads the same column**, and its
guard is the honesty rule the strip inherits.

**Analog:** `frontend/src/components/ingestion/DocumentStatusBadge.tsx:1-40`

```tsx
import { cn } from "@/lib/utils"
import { TERM_MAP, usePlainLabel, type TermKey } from "@/lib/termMap"

interface Props {
  status: "pending" | "processing" | "completed" | "failed"
  /** Phase 56 D-13: granular sub-status; only consulted while status='processing'. */
  ingestionStep?: string | null
}
const styles: Record<Props["status"], string> = {          // :10-15 — the ONE status palette
  pending: "bg-yellow-100 text-yellow-800", processing: "bg-blue-100 text-blue-800",
  completed: "bg-green-100 text-green-800", failed: "bg-red-100 text-red-800",
}
const termKey: TermKey =                                    // :27-32 ⭐ THE GUARD
  status === "processing"
    ? `ingest.${ingestionStep}` in TERM_MAP ? (`ingest.${ingestionStep}` as TermKey) : "status.processing"
    : (`status.${status}` as TermKey)
const label = usePlainLabel(termKey)                        // :33
```

**Three things the strip copies and must not re-invent:**
1. **the guard** — `ingestion_step` is consulted *only* while `status === "processing"` (Pitfall 3);
2. **the label source** — `usePlainLabel` over `TERM_MAP`, whose six `ingest.*` entries are already
   written (`termMap.ts:38,43,48,53,58,63` → *Reading the file · Reading tables · Reading images ·
   Splitting into sections · Making it searchable · Reading document details*, each with `helper`
   and `technical`). **Never a seventh vocabulary** (sketch fence `A5c`);
3. **the palette** — the `styles` map is the one status vocabulary.

**Its mount today** — `DocumentList.tsx:422`:
```tsx
<DocumentStatusBadge status={doc.status} ingestionStep={doc.ingestion_step} />
```

**The order constant** is fenced against the backend — see § *Shared Pattern D*.

---

### 10 · The dropzone + the ONE formats constant (SC#2 / D-217-17 / D-217-18)

**Analog:** `frontend/src/components/ingestion/DocumentUpload.tsx` (144 L) — **reused, not rebuilt**.

**Props (`:5-12`) — already carries the target folder and its ownership gate:**

```tsx
interface Props {
  onUpload: (file: File, folderId?: string | null) => Promise<{ isDuplicate: boolean }>
  uploading: boolean
  uploadingCount?: number
  folderId?: string | null
  folderName?: string | null
  disabled?: boolean
}
```

**The batch-result shape (`:14-18`, `:29-40`)** is the honest reporting the dropzone keeps:
`Promise.allSettled` → `{uploaded, duplicates, errors[]}` → *"N uploaded · N already up to date"*
(`:121-124`) plus per-error `<p className="text-xs text-destructive">`.

**The literal D-217-18 replaces — `DocumentUpload.tsx:138`** *(CORRECTION: RESEARCH said `:132`)*:

```
accept=".txt,.md,.pdf,.docx,.pptx,.xlsx,.csv,.epub,text/plain,text/markdown,text/csv,application/pdf,application/epub+zip,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
```

⛔ **Confirmed absent from all 144 lines:** `onUploadProgress`, `XMLHttpRequest`, any progress stream.
D-217-19 stands on measurement.

**Constant-module analog:** `argumentModel.ts:57-59` (module constants whose spelling is fenced
character-for-character against a Python mirror) — the same treatment the accept list gets against
`documents.py:91` `ALLOWED_MIME_TYPES`.

---

### 11 · Views tab · Indexing tab (composition — mount, do not rebuild)

**`ViewsGroup` (`components/ingestion/ViewsGroup.tsx`) — the props the Views tab must satisfy (`:35-48`):**

```tsx
export interface ViewsGroupProps {
  views: SavedView[]                                   // from listViews(), OWNED BY THE PAGE
  selectedViewId: string | null                        // mutually exclusive with a folder selection
  onSelectView: (view: SavedView) => void
  onEditView: (view: SavedView) => void
  onRenameView: (id: string, name: string) => Promise<void> | void
  onDeleted: (id: string) => void
}
```

⭐ **`views` and `selectedViewId` are already passed DOWN from the page** — so the Views tab and the
sidebar reading the *same* selection (SC#5) is a matter of handing both mounts the same reducer
output, not of building anything. Its docblock (`:27-32`) records that per-view counts are lazy +
cached (`resolveView(id, {count_only:true})`) — **do not add an eager count pass.**

**`ReembedStatusCard` (`components/settings/ReembedStatusCard.tsx`) — composed UNCHANGED (D-217-16/22):**

```tsx
export function ReembedStatusCard({ id }: { id?: string })      // :37 — the whole public surface
const RUNNING_POLL_MS = 4000                                    // :23
function pct(p: ReembedProgress): number                        // :25-28  ← the percentage bar
function remainingEta(p: ReembedProgress): string               // :31-35  ← the "~3 min"
```

⚠ `pct` and `remainingEta` are the two functions D-217-22 rules **in scope for this card and nowhere
else**. The card is not edited; the ruling is stated in the plan (its sibling export
`ReembedSearchPointer` is already imported by the page at `IngestionPage.tsx:11`).

---

### 12 · New client functions in `frontend/src/lib/api/documents.ts`

**Analog — the file's own first export (`:15-20`):**

```ts
import type { Document, Folder, WorkspaceFile } from "../../types"      // :13
import { API_BASE, getAuthHeaders, getAuthToken } from "./_core"        // :14

export async function listDocuments(): Promise<Document[]> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/documents`, { headers })
  if (!res.ok) throw new Error("Failed to list documents")
  return res.json() as Promise<Document[]>
}
```

**The barrel re-export is mandatory and its block already exists — `frontend/src/lib/api.ts:74-90`:**

```ts
// ── documents ─────────────────────────────────────────────────────────
export {
  listDocuments,
  uploadDocument,
  …
  toggleFolderOrgShared,
} from "./api/documents"
```

⚠ Every consumer imports from `@/lib/api` (see `RelationshipsSection.tsx:33`). RESEARCH records that
`196-08` measured **249 red tests** from one mis-handled export, and that `apiBarrel.test.ts` covers
**`connectors.ts` only** — see § *Test-file analogs* for the extension.

---

### 13 · `frontend/src/components/ui/tabs.tsx` (shared primitive — D-217-20/21)

**Analog: itself.** The two class strings to be edited, verbatim today:

```tsx
// TabsList — :15
"inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground"

// TabsTrigger — :30
"inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium
 ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2
 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50
 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm"
```

Exports at `:53`: `{ Tabs, TabsList, TabsTrigger, TabsContent }` — the file is 53 lines, a thin Radix
wrapper, with **no local variant prop** (D-217-20 rejects adding one).

**Token-pair analog for a new `--tab-active`:** the repo's shipped precedent is the `--panel-*`
family — a `:root` value + a `.dark` value in `frontend/src/index.css` (blocks start `:17` / `:104`)
mapped in `frontend/tailwind.config.js` beside `panel-muted-foreground` / `panel-status-done`.
RESEARCH § *D-217-20/21* carries the measured lightness table and the recommended values; **the
sketch's remedy uses `box-shadow: inset`, not `border`** (`drive.cjs` `A4c` asserts
`\.tabslist\.remedy[^}]*box-shadow:\s*inset`), so nothing reflows.

⚠ **Sketch fence `A3b` (`drive.cjs:121-123`) asserts the SHIPPED trigger contains
`data-[state=active]:bg-background`.** Editing this file fires it *by design* — `drive.cjs` is
updated in the same commit.

---

### 14 · `useDocuments.ts` (hook — D-217-10)

**Analog: itself.** The merge is unchanged by this phase (RESEARCH § *Does the Realtime merge need
changing?* → **no**). The site, re-measured — **`:47-62`**, with the spread at **`:57-58`**
*(CORRECTION: RESEARCH said `:56-58`)*:

```ts
if (payload.eventType === "UPDATE") {
  const newDoc = payload.new as Document
  // Realtime payload reflects ONLY the documents table — but table_count + image_count +
  // chunk_count are server-side aggregates from joined tables … They are NOT in payload.new.
  // Spread-merge so the prior fetch's aggregates aren't blown away mid-transition …
  setDocuments((prev) => prev.map((d) => (d.id === newDoc.id ? { ...d, ...newDoc } : d)))
  if (newDoc.status === "completed" || newDoc.status === "failed") {
    loadDocuments().catch(console.error)          // ⭐ the reconcile-by-fetch half (D-v2.5-03)
  }
} else if (payload.eventType === "INSERT") {
  const newDoc = payload.new as Document          // :63-68 — ⚠ NO merge on this arm
  setDocuments((prev) => (prev.some((d) => d.id === newDoc.id) ? prev : [newDoc, ...prev]))
}
```

⚠ The INSERT arm (`:63-68`) casts with no merge — RESEARCH's consequence: the two derived booleans
must be **optional on the frontend type** and the strip must tolerate `undefined`.

**The wire type to extend — `frontend/src/types/index.ts:499`** (inside `Document`, which begins
`:488`):

```ts
  /** Phase 56 D-10/D-11: granular sub-status while status='processing'. One of: 'extracting',
   *  'chunking', 'embedding', 'metadata'. Backend sets via Realtime UPDATE; frontend renders
   *  via DocumentStatusBadge. */
  ingestion_step?: string | null
```

⚠ That docblock **lists four steps and the pipeline writes six** — a plan touching this line should
correct the comment in the same edit.

---

### 15 · `nav-items.ts` and `ChatLayout.tsx` (label + branch)

```ts
// frontend/src/lib/nav-items.ts:37 — label only; `view: "documents"` is UNCHANGED
{ view: "documents", icon: FileText, label: "Documents" },
// siblings that STAY until Phase 218:
{ view: "library-health", icon: Activity, label: "Library Health" },        // :42
{ view: "governance", icon: ShieldCheck, label: "Governance", feature: "governance_health" },  // :43
```

```tsx
// frontend/src/components/layout/ChatLayout.tsx:757-758 — the only branch 217 touches
          {activeView === "documents" ? (
            <IngestionPage onNavigate={onNavigate} />
          ) : activeView === "skills" ? (            // :759 — the sibling arm's shape
```

⛔ **`ChatLayout.tsx:879` — do not touch:**

```tsx
          ) : (
            <KnowledgeHealthPage />
          )}
```

Sketch fence `A8` reads this exact shape from the live tree; Phase 218 owns replacing it.

---

## Shared Patterns

### A · Threadpool discipline — `aexec`, on every new query

**Source:** `backend/app/utils/db.py:47-58`
**Apply to:** all five new routes, every query, without exception.

```python
async def aexec(query):
    """Run a sync supabase-py query off the event loop. … accepts a query object
    (NOT a callable) and calls `.execute` on it inside the threadpool."""
    return await run_in_threadpool(query.execute)
```

The module docstring (`:1-22`) carries the usage form to copy verbatim. ⚠ **Warning sign:** any
`.execute()` not preceded by `await` inside an `async def`. Both nearest neighbours in
`documents.py` (`list_documents` `:711-769`, `list_document_versions` `:773-800`) violate this;
`documents.py` uses `run_in_threadpool` 55 times elsewhere, so **the neighbours are the outliers**.
`coerce_uid` (`utils/db.py:33-45`) is the companion for any `.or_()` filter that interpolates a
user id.

### B · Parent-check-then-read → 404, never an empty 200

**Source:** `backend/app/api/documents.py:783-791`
**Apply to:** all five new routes, ideally via one shared private helper.

```python
    doc = supabase.table("documents").select("filename, user_id, folder_id") \
        .eq("id", document_id).eq("user_id", current_user["id"]).maybe_single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Document not found")
```

`detail="Document not found"` is the shipped string — reuse it, do not invent a variant.

### C · The section state machine + panel token discipline

**Source:** `RelationshipsSection.tsx:57` (`type LoadState`), `:74-99` (keyed load), `:151/:160/:175`
(the three arms) · `PanelSection.tsx:94` (free lazy mount)
**Apply to:** all five new detail sections.

Four distinct renderings — `loading` (`role="status" aria-live="polite"`) · `ready & rows>0` ·
`ready & rows===0` (worded empty arm) · `error` (`role="alert"` + a *Try again* button). Copy on
`docId` in the `useCallback` deps. Lift the total via `onTotalChange`. Every string uses
`text-panel-muted-foreground[-dim]`, never global muted.

### D · The cross-language `?raw` source fence (frontend test reading backend truth)

**Source:** `frontend/src/components/workflows/argumentModel.test.ts:24-80`
**Apply to:** the stage-order fence over `documents.py`, the accept-list fence over
`documents.py:91`, the tab-token fence over `index.css`, the rename fences over `App.tsx` /
`ChatLayout.tsx`.

```ts
import { describe, it, expect } from "vitest"
// `?raw` over a backend `.py` is the shipped cross-language idiom in this directory
// (`ExternalActionSection.test.tsx:59`).
import argsPySource from "../../../../backend/app/services/connectors/args.py?raw"
import argumentModelSource from "./argumentModel.ts?raw"

const quoted = (blob: string): string[] =>
  [...blob.matchAll(/["']([^"']+)["']/g)].map((m) => m[1])
```

**Four rules this analog encodes, all of which the 217 fences need:**

1. **⚠ EVERY EXTRACTION CARRIES A NON-VACUITY CONTROL, ASSERTED BEFORE ANY CLAIM THAT RESTS ON IT.**
   *"A regex that matched nothing yields an empty set, and an empty set satisfies every absence
   assertion for free."*
2. **⚠ EVERY PATTERN TOLERATES CRLF.** *"Source files check out with Windows line endings on this
   box, and a terminator spelled `\n\n` silently never matches."* Use `[\s\S]` and `\r?\n`.
3. **Strip comments with the LINE-ANCHORED form** — `FileRow.sweep.test.ts:100-105`:
   ```ts
   function codeOf(src: string): string {
     return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
   }
   ```
   ⚠ The unanchored variant (`ChatLayout.launch.test.tsx:458`) eats from any `//` to end-of-line,
   including inside string literals — it would silently eat live code and turn every
   `not.toContain` into a pass.
4. **Guard the fence itself three ways** (`FileRow.sweep.test.ts:32-41`): a **length** assertion per
   `?raw` import, an **identity** symbol only that file contains, and a **stripper non-vacuity pair**.

**The sketch's Node-side equivalents, for the `drive.cjs` edits** — `drive.cjs:48-51`:

```js
function src(rel) {
  const p = path.join(REPO, rel)
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null
}
```

and the live-tree extraction the strip's order fence should mirror (`drive.cjs:152-158`):

```js
const steps = [...DOCS_PY.matchAll(/"ingestion_step":\s*"([a-z_]+)"/g)].map((m) => m[1])
const uniqueSteps = [...new Set(steps)]
ok("A5 · the backend writes SIX distinct ingestion steps", uniqueSteps.length === 6, …)
```

⚠ **`A5b` sorts before comparing, so it will NOT fire on a reorder.** The stage-order fence in
vitest must compare **ordered** arrays, or D-217-09's whole point is unguarded.

### E · Barrel re-export completeness

**Source:** `frontend/src/lib/__tests__/apiBarrel.test.ts` (34 L, `T`+`B` pinned at **3**)

```ts
import * as ApiBarrel from "../api"
import * as ConnectorsDomain from "../api/connectors"

it("re-exports all runtime symbols from lib/api/connectors.ts", () => {
  const connectorExports = Object.keys(ConnectorsDomain)
  expect(connectorExports.length).toBeGreaterThan(0)          // ← the non-vacuity control
  for (const exportName of connectorExports) {
    expect(ApiBarrel).toHaveProperty(exportName)
    expect((ApiBarrel as Record<string, unknown>)[exportName]).toBe(
      (ConnectorsDomain as Record<string, unknown>)[exportName])
  }
})
```

**Apply to:** `api/documents.ts` — add a second `import * as DocumentsDomain from "../api/documents"`
and a second loop. ⚠ **Editing this file moves a BASELINE pin from 3** — state the arithmetic.

### F · Backend test seam

**Source:** `backend/tests/conftest.py:116-136` + `backend/tests/test_knowledge_health.py`

```python
def _user_supabase_override():                                        # conftest.py:116-131
    """Phase 163 (TEN-02) test seam — mirror the get_supabase override onto the
    Wave-4 user-JWT client dep."""
    override = app.dependency_overrides.get(get_supabase)
    return override() if override is not None else _supabase

app.dependency_overrides[get_current_user] = lambda: mock_user_data          # :133
app.dependency_overrides[get_supabase] = lambda: _supabase                   # :134
app.dependency_overrides[get_user_supabase_client] = _user_supabase_override # :135
```

⭐ **Both new-route auth arms are mocked by the same seam** — a route on
`Depends(get_user_supabase_client)` and one on `Depends(get_supabase)` are both driven by overriding
`get_supabase`. Fixtures available: `client`, `auth_headers`, `mock_execute_result`, `mock_builder`
(`conftest.py:222-249`); `reset_mocks` is `autouse` (`:147`).

**The D-217-07 assertion shape — `test_knowledge_health.py:213-223`:**

```python
def test_rls_user_id_filter_applied(client, auth_headers, mock_execute_result, mock_builder):
    """All queries filter by user_id (eq called with user_id for RLS)."""
    mock_execute_result.data = []
    res = client.get("/knowledge-health/summary", headers=auth_headers)
    assert res.status_code == 200
    eq_calls = [str(c) for c in mock_builder.eq.call_args_list]
    user_id_calls = [c for c in eq_calls if mock_user_data["id"] in c]
    assert len(user_id_calls) >= 4, f"Expected >=4 user_id eq filters, got {len(user_id_calls)}"
```

Its data helpers (`:16-49`) — `_make_result`, `_doc`, `_audit_row` (which already builds
`{"metadata": {"document_ids": …, "query_text": …}, "created_at": …}`) — are directly reusable by
`test_217_document_detail_routes.py`.

### G · The two-knob count-gate entry (Pitfall 8)

**Source — the SEED-227 pair, the most recent instance, and it lands as one commit:**

```js
// scripts/vitest-count-gate.cjs:2805 — BASELINE, keyed by BARE FILENAME
  "DocumentDetailPanel.images.test.tsx": 3,

// scripts/vitest-count-gate.cjs:3996 — TARGETS, an explicit FILE path
  "src/components/metadata/DocumentDetailPanel.images.test.tsx",
```

The comment above the TARGETS entry (`:3979-3995`) is the model for the reasoning a 217 entry owes,
and it contains a fact this phase should read as a hand-off:

> *"`src/components/metadata` is covered by no directory entry, so the gate has never EXECUTED a
> suite there — including the shipped `DocumentDetailPanel.a11y.test.tsx`. … **Phase 218 owns the
> document space and can adopt the directory deliberately, with its own measured number.**"*

⚠ **217 arrives before 218 and adopts these suites file-by-file** — pin from the gate's own printed
`— N new` column, never book a number ahead. A BASELINE key naming a file that does not yet exist
makes the gate **ERROR (exit 2)**, not fail — hence "same commit that creates the file."
`bareName()` (`:4112-4114`) strips the path, so **every bare filename must be unique tree-wide**;
⚠ `DocumentList.test.tsx` exists at **two** paths (`src/components/ingestion/` and
`src/__tests__/components/`) — adopting both is a collision, and one of them must be renamed or
deliberately left out with the reason recorded.

---

## Test-file analogs (Wave 0)

| Wave-0 file | Analog to model it on | What to copy |
|---|---|---|
| `src/pages/__tests__/LibraryPage.test.tsx` | `src/__tests__/components/IngestionPage.test.tsx` (158 L) — **this IS the file, git-mv'd** | its `vi.hoisted` + `vi.mock("@/hooks/useDocuments")` / `useFolders` / `@/lib/supabase` block (`:14-35`) and the `TooltipProvider` wrapper (`:11`). ⚠ The destination dir `src/pages/__tests__/` already exists (6 suites) |
| `src/__tests__/library/renameFence.test.ts` | `FileRow.sweep.test.ts:32-105` + `StopControl.test.tsx:73-85` | `?raw` + length + identity + stripper non-vacuity; fence `App.tsx`'s `ActiveView` and `ChatLayout.tsx`'s trailing `<KnowledgeHealthPage />` |
| `src/components/ingestion/__tests__/acceptFormats.test.ts` | `argumentModel.test.ts:24-80` | cross-language `?raw` over `backend/app/api/documents.py`, extracting `ALLOWED_MIME_TYPES` with a CRLF-tolerant regex + a non-vacuity control |
| `src/components/ingestion/__tests__/IngestionStrip.test.tsx` | `argumentModel.test.ts` (fence half) + `DocumentStatusBadge.test.tsx` (render half) | the **ordered** comparison against `documents.py`'s six `"ingestion_step": "…"` writes (⚠ `drive.cjs`'s `A5b` sorts — do not copy that) |
| `src/components/metadata/__tests__/DetailSections.lazy.test.tsx` | `src/components/relationships/RelationshipsSection.test.tsx` + `…a11y.test.tsx` (both shipped, both `—` on the gate) | mock `@/lib/api` **by the barrel path**, assert **zero** fetch calls before the accordion button is clicked |
| `src/pages/__tests__/librarySelection.test.ts` | `frontend/src/components/workflows/argumentModel.test.ts` (pure-module suite) | exhaustive transitions over a pure reducer; no render, no mocks |
| `src/components/ui/__tests__/tabsContrast.test.ts` | `drive.cjs:129-149` (`lightness()` + `A4`/`A4b`) — port into vitest | read `index.css` via `?raw`, parse `--token: h s% l%`, assert L(active) > L(track) in **both** blocks, with a non-vacuity control on each parse |
| `backend/tests/test_217_document_detail_routes.py` | `backend/tests/test_knowledge_health.py` | `_make_result` / `_audit_row` helpers, the `mock_builder.eq.call_args_list` assertion, `client`/`auth_headers` fixtures |
| `backend/tests/test_217_document_response_fields.py` | same | ⭐ the load-bearing half of M-1: assert the **`response_model`** does not strip `ingestion_step` |

---

## G-5 hot-file dossier (D-217-01 — read here, not in the ledger)

The five sections of `docs/HOT-FILE-LEDGER.md` were read in full on 2026-08-29. Named seam +
binding invariants + gate side, per file, so a planner does not reopen the ledger.

### `frontend/src/components/ingestion/DocumentList.tsx` — `22 / 12 / 609` ⚠ FIRES
- **Named seam:** *"the row is the extraction. Twelve phases of per-row affordances (status, stage,
  marks, actions, selection) live in one file; a `DocumentRow` with the table owning only ordering
  and shedding is the cut."*
- **Binding invariant:** ⚠ **the seven-column order is load-bearing and enforced from another file** —
  `chevron · Filename · Type · Size · Chunks · Status · Actions` (`:349-355`), because
  `IngestionPage.tsx:449-450` sheds columns 3–5 **positionally**. *"Reordering these columns silently
  breaks a rule written in a file this one does not import."* Sketch fence `A1` reads the order from
  the live tree.
- ⭐ Ledger: it renders `table_count`/`image_count` as bare counts while the real content sits in
  `document_tables`/`document_images` — *"the largest single instance of the buried-capability
  finding."* That is SC#4's own justification.
- **Gate:** ⚠ **`—` in both knobs.** Two suites exist (`src/components/ingestion/DocumentList.test.tsx`,
  `src/__tests__/components/DocumentList.test.tsx`) and **the gate has never executed either**.

### `frontend/src/pages/IngestionPage.tsx` — `26 / 9 / 601` ⚠ FIRES
- **Named seam:** *"the sidebar, the filter bar and the grid are three independent concerns in one
  component. **With a tab shell arriving, extract the shell first and let each tab own its body —
  otherwise the tab bar becomes the tenth conditional branch.**"* (This is the sentence D-217-12 and
  the tab work must answer.)
- **Binding invariants:** it owns the push/split grid `minmax(0,1fr) 430px`, the 288px Folders+Views
  sidebar with its pinnable rail, and the column-shedding rule. ⭐ *"It is already named `Documents`
  everywhere the user can see"* — only the FILE NAME is stale.
- ⚠ **Same-commit ledger obligation:** the rename invalidates both the section heading and the
  CLAUDE.md anchor `#frontendsrcpagesingestionpagetsx`. Move both in the rename commit.
- **Gate:** ⚠ `—` in both. `src/__tests__/components/IngestionPage.test.tsx` (158 L) has never run.

### `frontend/src/components/metadata/DocumentDetailPanel.tsx` — `6 / 5 / 405` ⚠ FIRES
- **Binding invariant:** ⚠ **it is a CROSS-SURFACE shell, not a documents-only component.** It reuses
  `WorkspacePanel`'s sheet shape, which `ChatLayout` mounts — *"a redesign here is judged against the
  chat surface too."* `GovernancePage` also needs a FULL `Document` to open it.
- Its width is not its own: the **430px track is set by the host grid**; the mobile arm is an
  internal bottom-sheet, so the desktop track is only meaningful ≥768px.
- ⚠ The ledger records `BUS-026`'s `393` lines vs the re-derived `405` — *"the reason the recipe is
  run rather than the figure copied."*
- ⭐ The ledger already names what sketch 218 adds to it: a Retrieval section, a read-only Chunks
  list, tables rendered as tables, image descriptions — *"none of which needs schema."*
- **Gate:** partially. `DocumentDetailPanel.images.test.tsx` is `T`+`B`@**3**;
  `DocumentDetailPanel.a11y.test.tsx` is `—` in both.

### `frontend/src/hooks/useDocuments.ts` — `8 / 3 / 120` ⚠ FIRES (exactly at threshold)
- **Binding invariant:** ⚠ *"Realtime is a hint, never a source of truth (D-v2.5-03)… A design that
  assumes the socket delivered every transition will show a stale stage strip after a reconnect."*
  **That sentence names D-217-10's defect before this phase did.**
- `table_count` / `image_count` / `chunk_count` are **server-derived** — *"a client-side count is
  always a re-render of a server number, never an independent one."*
- **No seam proposed** (120 L). Honoured by construction: 217 adds no branch here.
- **Gate:** ⚠ `—` in both. `src/__tests__/hooks/useDocuments.test.ts` (201 L) has never run.

### `backend/app/services/retrieval_service.py` — `17 / 9 / 362` ⚠ FIRES
- **Binding invariant:** ⚠ *"IT COMPUTES A PER-HIT SIMILARITY AND THROWS IT AWAY."* `search_documents`
  is `-> tuple[list[dict], float]`; `tool_dispatcher.py` writes `{query_text, document_ids}` and
  **not the score**. So *times retrieved*, *last question* and *last found* are answerable today;
  **"average relevance" is not.**
- ⚠ **Sequencing constraint, not a defect:** it is the surface `BUG-260815-05` (Phase 210) touches —
  the retrieval path misreports embedding-provider failure. *"A Health tab built before that lands
  would show '0 searches' during an outage."*
- **217 does not modify this file.** Its row is in the blast radius because `/queries` reads what it
  writes. LIB-07 (per-hit recording) is **Phase 218**.
- **Gate:** n/a (backend).

**Two more files this phase touches that also fire G-5 and are NOT in D-217-01's five** — recorded
so they are not invisible:

| File | Triple (ledger, 2026-08-28) | Relevance |
|---|---|---|
| `frontend/src/pages/SettingsPage.tsx` | `38 / 21 / 1500` ⚠ FIRES | inherits the `ui/tabs` edit. ⚠ **State in the plan that this is a shared-primitive edit, not a Settings edit** — no Settings-local branch is touched (G4-8) |
| `frontend/src/pages/KnowledgeHealthPage.tsx` | `11 / 5 / 571` ⚠ FIRES | inherits the same edit **and** is `ChatLayout.tsx:879`'s positional fallback. ⭐ It is also the tab-shell analog (§5) |
| `frontend/src/lib/api/documents.ts` | ledger row is the **BARREL** (`lib/api.ts`), not this module | ⚠ RESEARCH's finding one level over: the 207 split created domain modules with **no rows of their own**; `api/knowledge.ts` and `api/threads.ts` got rows at 214, `api/documents.ts` still has none |

---

## Count-gate side, per file (D-217-01's second mandatory statement)

⚠ Derived 2026-08-29 from `scripts/vitest-count-gate.cjs` by reading the two knobs. `TARGETS` has
**one** directory entry (`src/components/workflows`); everything else is an explicit file path.
**Backend files sit outside this gate entirely.**

| File the phase touches | TARGETS | BASELINE | Verdict |
|---|---|---|---|
| `src/pages/IngestionPage.tsx` → `LibraryPage.tsx` | ❌ | ❌ | source files are never in either knob — its **suite** is what must be adopted |
| `src/__tests__/components/IngestionPage.test.tsx` → `src/pages/__tests__/LibraryPage.test.tsx` | ❌ | ❌ | **never executed**; adopt both knobs in the rename commit |
| `src/__tests__/hooks/useDocuments.test.ts` | ❌ | ❌ | **never executed** — the hook D-217-10 changes |
| `src/components/ingestion/DocumentList.test.tsx` | ❌ | ❌ | never executed. ⚠ bare-name collision with `src/__tests__/components/DocumentList.test.tsx` |
| `src/__tests__/components/DocumentStatusBadge.test.tsx` | ❌ | ❌ | never executed — the strip's guard analog |
| `src/components/ingestion/__tests__/DocumentStatusBadge.a11y.test.tsx` | ❌ | ❌ | never executed |
| `src/components/ingestion/ViewsGroup.test.tsx` | ❌ | ❌ | never executed — tab 2's component |
| `src/components/ingestion/FilterBar.test.tsx` | ❌ | ❌ | never executed |
| `src/components/panel/__tests__/CsvTablePreview.test.tsx` | ❌ | ❌ | never executed — the table-render analog |
| `src/components/metadata/DocumentDetailPanel.a11y.test.tsx` | ❌ | ❌ | never executed |
| `src/components/metadata/DocumentDetailPanel.images.test.tsx` | ✅ `:3996` | ✅ `:2805` = **3** | the **only** fully-guarded doc-space suite |
| `src/lib/__tests__/apiBarrel.test.ts` | ✅ `:3976` | ✅ `:2796` = **3** | guarded — but covers `connectors.ts` only; extending it **moves the pin** |
| `src/components/ui/tabs.tsx` | ❌ | ❌ | ⚠ the shared primitive has **no suite at all**; `tabsContrast.test.ts` is its first |
| every Wave-0 suite (9) | ❌ (new) | ❌ (new) | **both knobs, in the creating commit** |

Baseline to beat, re-derived 2026-08-28 in `217-RESEARCH.md` (**re-derive again, do not quote**):
`total 6438 · failed 0 · pinned total 5710 · 136/136`.

---

## No Analog Found

| File | Role | Data flow | Reason |
|---|---|---|---|
| the `librarySelection` **reducer** | store | state transform | ⚠ **`useReducer` appears in no production file in this tree** (measured 2026-08-29). The *module* analog is `argumentModel.ts` (pure leaf + exhaustive suite); the *reducer* itself has no precedent. Nearest state-container siblings are Zustand stores (`builderStore.ts`, 968 L), which are a different mechanism |
| the **six-stage strip** component | component | derived render | Nothing renders a multi-segment pipeline state in this tree. `DocumentStatusBadge` renders *one* step; `PhaseTimeline`/`RunSpine` render *run* steps from a different data model. The strip's honesty rules (D-217-19/23/24) come from CONTEXT, and its labels from `termMap`; only the *guard* is copied |
| a `TabsList`/`TabsTrigger` **test** | test | — | ⚠ `frontend/src/components/ui/` has **no suite for tabs**, so `tabsContrast.test.ts` has no in-directory sibling. Port `drive.cjs:129-149`'s `lightness()` instead |

---

## Metadata

**Analog search scope:** `backend/app/api/` · `backend/app/models/` · `backend/app/services/` ·
`backend/app/utils/` · `backend/tests/` · `frontend/src/pages/` · `frontend/src/components/{ingestion,metadata,panel,relationships,settings,ui,workflows,chat,files,layout}/` ·
`frontend/src/hooks/` · `frontend/src/lib/` · `scripts/` · `.planning/sketches/218-the-library-and-its-tabs/` ·
`docs/HOT-FILE-LEDGER.md`

**Files read in full or in targeted ranges this session (28):** `kb.py:390-482` · `models/kb.py:60-80` ·
`knowledge_health.py:1-80, 550-600` · `utils/db.py:1-70` · `models/document.py` (all 48) ·
`documents.py:85-95, 773-800` · `multimodal_service.py:20-40, 186-200, 488-506, 752-762` ·
`main.py` (router lines) · `conftest.py:100-185` · `test_knowledge_health.py:1-60, 213-223` ·
`PanelSection.tsx` (all 101) · `RelationshipsSection.tsx:1-175` · `DocumentDetailPanel.tsx:230-300` ·
`CsvTablePreview.tsx:1-40, 100-176` · `ui/tabs.tsx` (all 53) · `lib/api/documents.ts:1-60` ·
`lib/api.ts:70-95` · `apiBarrel.test.ts` (all 34) · `useDocuments.ts` (all 120) ·
`DocumentUpload.tsx:1-40, 120-144` · `DocumentList.tsx:345-360, 415-430` · `DocumentStatusBadge.tsx:1-40` ·
`termMap.ts:30-70` · `IngestionPage.tsx:1-50, 440-460` · `ViewsGroup.tsx:1-60` ·
`ReembedStatusCard.tsx:1-45` · `argumentModel.ts:1-60` + `argumentModel.test.ts:1-80` ·
`FileRow.sweep.test.ts:20-110` · `nav-items.ts:30-55` · `ChatLayout.tsx:750-765, 872-885` ·
`types/index.ts:480-505` · `vitest-count-gate.cjs:115-130, 2790-2812, 3970-4000, 4112-4114` ·
`drive.cjs:18-175` · `COPY.js:59-85` · `docs/HOT-FILE-LEDGER.md:6446-6520`

**Commands run:** `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` →
**193 passed · 0 failed · 193 assertions** (2026-08-29). The full count gate was **not** run here —
`217-VALIDATION.md` owns it.

**Pattern extraction date:** 2026-08-29
**Valid until:** the structural findings (analog identities, seams, invariants) are stable until a
commit touches those files. ⚠ **The line numbers are good for days, not weeks** — six of RESEARCH's
were already stale after one. Re-read before quoting.
