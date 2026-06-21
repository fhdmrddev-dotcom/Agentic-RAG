# Phase 119: Document Governance Health - Pattern Map

**Mapped:** 2026-06-21
**Files analyzed:** 8 (3 new, 4 modified, 1 net-new test set)
**Analogs found:** 8 / 8 (every file has a direct live-verified analog — this is a pure-consumer reuse phase)

> This phase is a **recomposition of shipped, security-reviewed primitives**. The ONLY net-new
> code is the aggregation router (`document_governance.py`) and the page (`GovernancePage.tsx`).
> Every signal definition reuses a verified shipped contract. **No migration, no new package,
> no new write path.** Every excerpt below was read from live code this session.

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `backend/app/api/document_governance.py` | route (router) | request-response / CRUD-read aggregation | `backend/app/api/knowledge_health.py` | exact (clone shape; one async deviation) |
| `backend/app/main.py` (MODIFY) | config (router mount) | — | its own `knowledge_health`/`classification_rules` mounts | exact |
| `frontend/src/pages/GovernancePage.tsx` | component (page) | request-response (fetch per card) | `frontend/src/pages/KnowledgeHealthPage.tsx` | role-match (carry guard; reject Tabs) |
| `frontend/src/components/health/GovernanceRow.tsx` (NEW — see A6) | component (row) | event-driven (click → navigate) | `frontend/src/components/health/HealthDocumentRow.tsx` | role-match (STRIP inline actions) |
| `frontend/src/App.tsx` (MODIFY :9) | config (ActiveView union) | — | the `classification-rules` member added in Phase 118 | exact |
| `frontend/src/lib/nav-items.ts` (MODIFY) | config (NAV_ITEMS) | — | the `classification-rules` NAV_ITEMS entry | exact |
| `frontend/src/components/layout/ChatLayout.tsx` (MODIFY ~294) | component (render branch) | — | the `classification-rules` branch at `:294-299` | exact |
| `frontend/src/lib/api.ts` (MODIFY) | utility (fetch helpers) | request-response | existing `knowledge-health` fetch helpers | role-match |
| `backend/tests/integration/test_119_*.py` (NEW) | test (two-user leak) | — | `backend/tests/integration/test_117_route_leak.py` | exact harness template |

**REUSE VERBATIM (no new file, import as-is):**
`HealthPanel.tsx`, `HealthEmptyState.tsx`, `PaginationControls.tsx` (frontend health kit);
`ConfidenceChip.tsx` + `TIER` (metadata); `DocumentDetailPanel.tsx` (link-out target);
`_resolve_readable_latest`, `_uid` (relationship service).

---

## Pattern Assignments

### `backend/app/api/document_governance.py` (route, CRUD-read aggregation) — NEW

**Analog:** `backend/app/api/knowledge_health.py`

**Imports + router prefix pattern** (`knowledge_health.py:1-17`):
```python
from fastapi import APIRouter, Depends, HTTPException, Query
from supabase import Client
from app.dependencies import get_current_user, get_supabase

router = APIRouter(prefix="/knowledge-health", tags=["knowledge-health"])

TOP_N = 10
DEFAULT_LIMIT = 20
MAX_LIMIT = 100
```
For governance: `router = APIRouter(prefix="/document-governance", tags=["document-governance"])`.
Carry `DEFAULT_LIMIT = 20`, `MAX_LIMIT = 100` verbatim.

**`_pagination_params` dep — copy verbatim** (`knowledge_health.py:536-540`):
```python
def _pagination_params(
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> tuple[int, int]:
    return offset, limit
```

**Paginated route shape — clone per signal** (`knowledge_health.py:578-593`, the `never-retrieved` route):
```python
@router.get("/never-retrieved")
async def knowledge_health_never_retrieved(
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """Return paginated never-retrieved documents (SQL-level filter)."""
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        return _fetch_never_retrieved(supabase, user_id, offset, limit)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail="Health metrics temporarily unavailable",
        ) from exc
```
Governance routes: `/broken-relationships`, `/unclassified`, `/low-confidence`. Error string
"Governance metrics temporarily unavailable". **Skip `/summary`** — it is DEPRECATED in the analog
(`knowledge_health.py:668-674`, `"DEPRECATED — use paginated endpoints"`); the counter header
derives its 3 counts from each list's `total` field (RESEARCH Alternatives Considered).

**Response-shape contract — every `_fetch_*` returns** (`knowledge_health.py:142`):
```python
return {"items": items, "total": res.count or 0, "offset": offset, "limit": limit}
```
This is the `{items, total, offset, limit}` shape `PaginationControls` consumes. Match it exactly.

**Item-shape pattern — SQL-filterable signal (UNCLASSIFIED, D-119-4)** — mirror `_fetch_never_retrieved`
(`knowledge_health.py:120-142`), with a deep-jsonb-path `.eq` instead of `.not_.in_`:
```python
# _fetch_never_retrieved's SQL-level pattern (knowledge_health.py:120-142):
query = (
    supabase.table("documents")
    .select("id, filename, folder_id, created_at, file_size", count="exact")
    .eq("user_id", user_id)
    .eq("is_latest", True)
)
res = query.range(offset, offset + limit - 1).execute()
items = []
for doc in res.data:
    items.append({
        "document_id": doc["id"],
        "filename": doc.get("filename"),
        "folder_id": doc.get("folder_id"),
        ...
    })
return {"items": items, "total": res.count or 0, "offset": offset, "limit": limit}
```
For unclassified add `.eq("metadata->_classification->>status", "suggested")`. **A3 LIVE-VERIFY:**
the `_`-leading jsonb key path-filter rendering must be pinned in a Wave-0 integration test against
`:54322` (PostgREST quoting is finicky — try the arrow form `metadata->'_classification'->>'status'`
if the dotted form returns nothing).

**Item-shape pattern — Python-scan signal (LOW-CONFIDENCE, D-119-5)** — mirror the
fetch-then-Python-filter-then-paginate structure of `_fetch_low_confidence_documents`
(`knowledge_health.py:179-213`), which already does in-Python scoring + sort + page-slice + a
metadata re-fetch:
```python
# knowledge_health.py:179-213 — the cap+Python-filter+sort+slice+meta-fetch precedent:
low_conf_ids = [doc_id for doc_id, avg in avg_scores.items() if avg < LOW_CONF_THRESHOLD]
low_conf_ids.sort(key=lambda d: avg_scores[d])
total = len(low_conf_ids)
page_ids = low_conf_ids[offset:offset + limit]
meta_res = (supabase.table("documents")
    .select("id, filename, folder_id, created_at, file_size")
    .in_("id", page_ids).eq("user_id", user_id).eq("is_latest", True).execute())
```
Governance variant: fetch latest docs (cap ~1000-2000 like the `.in_()`-cap precedent at
`knowledge_health.py:115-118`), then in Python keep docs where
`any(isinstance(v,(int,float)) and not isinstance(v,bool) and v < 0.5 for v in metadata["_confidence"].values())`.
**Pitfalls (A4):** guard missing `_confidence` (skip), non-numeric/`None`/`bool` values, and `0.0`
is a LEGITIMATE low value (never truthiness-test). The `0.5` cutoff is `ConfidenceChip`'s
`TIER.MED` — do NOT introduce a second constant.

**THE async deviation (D-119-3 / A2) — broken-relationship signal is the ONE structural difference
from the analog.** `knowledge_health`'s `_fetch_*` are SYNC with bare `.execute()`. The broken-edge
fetch MUST be `async` because `_resolve_readable_latest` is async (uses `aexec`/`run_in_threadpool`).
Import the leak-safe resolver + UUID guard from the relationship service:
```python
# Both are module-private but freely reused across 116/117 (the "one core, no fork" precedent):
from app.services.document_relationship_service import _resolve_readable_latest, _uid
```
`_resolve_readable_latest(doc_id, caller, supabase=...)` returns the caller's LATEST accessible
version row OR `None` (`document_relationship_service.py:162-266`). **`None` is exactly the broken
signal** (target fully deleted / superseded-out with no readable latest). A masked-but-present
target is NOT this resolver's concern (masking lives in `get_related_documents`'s loop) — and for a
user's OWN edges the cross-user existence-leak concern D-119-3 raises is structurally moot. **CLAUDE.md
D-v2.5-01:** the two SYNC fetches (unclassified/low-conf) called from an async route should be wrapped
in `run_in_threadpool` (the analog calls sync helpers from async routes, which technically blocks —
prefer threadpool here to honor the rule).

**Owner-scoping (THE sole gate — Pitfall 3 / V4):** `get_supabase()` is the SERVICE-ROLE client
(RLS bypassed). EVERY query carries `.eq("user_id", _uid(caller))`. `_uid` (`document_relationship_service.py:75-87`)
coerces to a canonical UUID string (`str(UUID(str(user_id)))`) so a malformed value raises
`ValueError` instead of breaking out of the filter grammar.

---

### `backend/app/main.py` (config, router mount) — MODIFY

**Analog:** its own existing DM-router mounts.

**Import line** (`main.py:405` — add to the existing `from app.api import ...` line):
```python
from app.api import threads, runs, documents, ..., document_relationships, classification_rules  # add: document_governance
```

**Mount line** (`main.py:415, 424-425` — the include_router precedent):
```python
app.include_router(knowledge_health.router)                # :415
app.include_router(document_relationships.router)          # :424  Phase 116
app.include_router(classification_rules.router)            # :425  Phase 118
# ADD: app.include_router(document_governance.router)      # Phase 119 DGOV-01/02 — read-only governance aggregation
```

---

### `frontend/src/pages/GovernancePage.tsx` (component, page) — NEW

**Analog:** `frontend/src/pages/KnowledgeHealthPage.tsx` — clone its FETCH + GUARD shape, REJECT its
Tabs layout (D-119-7) and its retrieval-similarity `ConfidenceChip` (use the metadata one — see
State of the Art note below).

**THE LOAD-BEARING PATTERN — `initializedTabsRef` infinite-fetch guard (D-119-9, BUG-260516-02)**
(`KnowledgeHealthPage.tsx:243-251`):
```typescript
// BUG-260516-02: track which tabs we've already initialized via a ref so an
// empty API response doesn't trigger an infinite re-fetch loop. ... The ref
// doesn't trigger re-renders.
const initializedTabsRef = useRef<Set<TabKey>>(new Set())

useEffect(() => {
  const key = getTabKey(activeTab, subTab)
  if (!initializedTabsRef.current.has(key)) {
    initializedTabsRef.current.add(key)
    fetchTab(key, 0)
  }
}, [activeTab, subTab, fetchTab])
```
For 3 STACKED cards (not tabs) the key is per-card-id: `"broken" | "unclassified" | "low-confidence"`.
Iterate the card keys in the effect; only fetch keys not yet in the set. A legitimately-empty signal
(zero broken edges) is the common steady state, so this guard fires constantly in healthy libraries —
it is NOT optional.

**Refresh MUST clear the ref** (`KnowledgeHealthPage.tsx:385-390`):
```typescript
onClick={() => {
  // BUG-260516-02 follow-up: clearing the ref lets the active tab refetch on the next render.
  initializedTabsRef.current.clear()
  loadOverviewAndTrend(true)  // governance: re-trigger the 3 card fetches
}}
```

**Card composition (D-119-7 — counter header + 3 stacked `HealthPanel` cards).** `HealthPanel` is
generic over `BaseDoc` (`{document_id, filename, folder_id}`) and renders title/icon/count/empty/
show-more. See the A5/A6 PAGINATION + ROW decision in Shared Patterns below — `HealthPanel` caps at
top-10 with show-more and has NO `PaginationControls`, and it hardcodes `HealthDocumentRow` (inline
mutate actions). The page must resolve both.

**Link-out: this page OWNS its own `DocumentDetailPanel` mount + `selectedDocId` state** (it is a
top-level home, NOT inside IngestionPage). Pattern from `IngestionPage.tsx:88, 136-139, 564-570`:
```typescript
const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
const selectedDoc = useMemo(
  () => (selectedDocId === null ? null : documents.find((d) => d.id === selectedDocId) ?? null),
  [selectedDocId, documents],
)
// ... render:
{selectedDoc && (
  <DocumentDetailPanel doc={selectedDoc} onClose={() => setSelectedDocId(null)} onReconcile={loadDocuments} />
)}
```
**Note (A7 / Pitfall 6):** `DocumentDetailPanel` has NO `openSection` prop — its props are
`{doc, onClose, onReconcile}` (`DocumentDetailPanel.tsx:121-131`); sections default-open
independently (Metadata `defaultOpen`, Relationships + Classification closed). v1 opens the panel
by doc id; a section-deep-link prop is optional polish. `DocumentDetailPanel` needs a FULL `Document`
object (carries `.metadata`), not just an id — the low-conf/unclassified fetches already return
`metadata`; the broken card's link must open the READABLE end (the broken end can't be opened).

---

### `frontend/src/components/health/GovernanceRow.tsx` (component, row) — NEW (A6 / Pitfall 5)

**Analog:** `frontend/src/components/health/HealthDocumentRow.tsx` — clone the row LAYOUT, **STRIP
every inline mutate action.**

**What the analog has that violates D-119-6** (`HealthDocumentRow.tsx:12-15, 56-81, 90-158`): it
imports `deleteDocument, reingestDocument`, ships Delete/Re-ingest/Move buttons + a delete `Dialog`
+ a `MoveToFolderDialog`, and takes an `onRemove(id)` callback. Reusing it verbatim adds inline
write actions — forbidden by D-119-6 (read-only / link-out only).

**Keep ONLY the row chrome** (`HealthDocumentRow.tsx:85-89`):
```tsx
<div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20">
  <span className="shrink-0">{getFileIcon(doc.filename)}</span>
  <span className="text-sm font-medium truncate flex-1">{doc.filename}</span>
  {metricChip}
  {/* NO inline action buttons — the WHOLE row is a link-out: onClick={() => onOpen(readableDocId)} */}
</div>
```
The governance row's only interaction is navigate (open the detail panel). Because `HealthPanel`
renders `HealthDocumentRow` INTERNALLY (`HealthPanel.tsx:6, 70-75`), the planner must EITHER (a) add
a small `renderRow`/link-out variant of `HealthPanel`, OR (b) build a plain `Card` (shadcn, same
shell as `HealthPanel.tsx:53` `<Card className="ghost-border bg-card/50 shadow-sm">`) that maps rows
+ wires `PaginationControls` itself. **Confirm during planning (A5/A6).**

---

### Navigation triad — ALL THREE in ONE plan (D-119-2, the Phase 118 lesson)

**Analog:** the Phase 118 `classification-rules` wiring (verified intact across all three files).

**(a) `frontend/src/App.tsx:9` — extend the `ActiveView` union:**
```typescript
// CURRENT (verified):
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health" | "workflows" | "classification-rules"
// ADD: | "governance"
```

**(b) `frontend/src/lib/nav-items.ts:24-35` — add the NAV_ITEMS entry + import a DISTINCT glyph:**
```typescript
import { MessageSquare, FileText, Activity, Zap, Settings, Workflow, Wand2 } from "lucide-react"
// ADD a distinct glyph import: ShieldCheck OR ClipboardCheck (NOT Wand2=Classification, NOT Activity=Library Health)
export const NAV_ITEMS: readonly NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "workflows", icon: Workflow, label: "Workflows" },
  { view: "documents", icon: FileText, label: "Documents" },
  { view: "classification-rules", icon: Wand2, label: "Classification" },  // ← Phase 118 precedent
  { view: "library-health", icon: Activity, label: "Library Health" },
  // ADD: { view: "governance", icon: ShieldCheck, label: "Governance" },
  { view: "skills", icon: Zap, label: "Skills" },
  { view: "settings", icon: Settings, label: "Settings" },
]
```
Glyph + label are Claude's discretion within "distinct from Library Health" (D-119-1).

**(c) `frontend/src/components/layout/ChatLayout.tsx:294-299` — add the render branch BEFORE the
trailing `KnowledgeHealthPage` else** (the `classification-rules` branch is the exact template):
```tsx
) : activeView === "classification-rules" ? (
  // Phase 118 gap-closure (CLASS-01 reachability): ... additive BEFORE the trailing
  // KnowledgeHealthPage else. Self-fetches via listRules() — no props; three-homes, no router.
  <ClassificationRulesPage />
) : (
  <KnowledgeHealthPage />
)}
// ADD, BEFORE the final ` ) : (` :
//   ) : activeView === "governance" ? (
//     <GovernancePage />
//   ) : (
//     <KnowledgeHealthPage />
```
**THE 118 LESSON:** if any one of (a)/(b)/(c) is missing, the page is built-but-unreachable — clicking
the nav item renders `KnowledgeHealthPage` (the trailing else catches the unhandled view). ONE plan
task MUST enumerate all three as an explicit checklist; the plan-checker verifies a single plan owns
all three. (118 shipped its rules page unreachable; caught by code-review BLOCKER + verifier, fixed
inline `6394d16e`.)

---

### `frontend/src/lib/api.ts` (utility, fetch helpers) — MODIFY

**Analog:** the existing `knowledge-health` fetch helpers in the same file. Add 3 thin helpers
(`getGovBroken` / `getGovUnclassified` / `getGovLowConfidence`) returning the `{items, total, offset, limit}`
shape. Mirror the existing health-endpoint fetch helpers' auth/error handling verbatim.

---

### `backend/tests/integration/test_119_*.py` (test, two-user leak) — NEW

**Analog:** `backend/tests/integration/test_117_route_leak.py` — the proven two-user live-leak harness.

**Harness template** (`test_117_route_leak.py:42-80`): asyncpg pool against
`postgresql://postgres:postgres@127.0.0.1:54322/postgres` (`POSTGRES_DSN` env override),
`_pg_reachable` skip-guard, FK-safe seed/teardown, OWN-scoped per-user rows, imports inside test
bodies so collection never errors. Drive the REAL HTTP route via a FastAPI `TestClient` with
`get_current_user` overridden to inject A vs B and `get_supabase` overridden to the REAL service-role
client (`test_117_route_leak.py:9-17`).

**Non-vacuity discipline (D-102/D-110-5 "static would false-green", `test_117_route_leak.py:31-35`):**
seed at least one TRUE positive per signal so an "all clear" pass cannot false-green — broken: an edge
whose target is superseded-out/deleted; unclassified: a `status:"suggested"` doc; low-conf: a doc with
a `0.4` confidence field. Two-user assertion: A NEVER sees B's broken/unclassified/low-conf docs.
**Masked-not-broken twin (D-119-3):** a 117-masked target is NOT reported as broken (masking ≠
deletion); the non-vacuity twin is that A, who owns the doc, also does not see it as broken (it
resolves). Unit edge-cases (`test_knowledge_health.py` MagicMock pattern): `0.0` counts, missing
`_confidence` doesn't error, non-numeric guarded.

---

## Shared Patterns

### Leak-safe owner scoping (V4 — the SOLE gate)
**Source:** `backend/app/services/document_relationship_service.py:75-87` (`_uid`) + every `.eq("user_id", ...)` in `knowledge_health.py`.
**Apply to:** EVERY query in `document_governance.py`.
```python
def _uid(user_id) -> str:
    # get_supabase() is the SERVICE-ROLE client (RLS bypassed) — these app-level predicates are
    # the SOLE owner-scoping gate. UUID(...) makes a malformed value raise ValueError instead of
    # breaking out of the user_id.eq.<...> term.
    return str(UUID(str(user_id)))
```
Every governance query: `.eq("user_id", _uid(caller))`. The broken signal additionally goes through
`_resolve_readable_latest` (which already owner-scopes). RLS exists on these tables but the
service-role client bypasses it — the app predicate is everything (Pitfall 3).

### Leak-safe edge resolution (D-119-3, broken signal)
**Source:** `document_relationship_service.py:162-266` (`_resolve_readable_latest`).
**Apply to:** the broken-relationship fetch ONLY.
Returns the caller's latest accessible version (own `is_latest` ∪ global-folder `is_latest`,
follow-to-latest, with a CR-01 post-follow visibility re-check) OR `None`. `None` = broken.
DO NOT re-derive this query — it encodes the leak-safety hardening; re-rolling it re-opens leaks.

### Confidence threshold + honest display (D-119-5)
**Source:** `frontend/src/components/metadata/ConfidenceChip.tsx:38-44`.
**Apply to:** the low-confidence backend scan cutoff AND the row chip.
```typescript
export const TIER = { HIGH: 0.75, MED: 0.5 } as const
function tierFor(score: number): "high" | "med" | "low" {
  if (score >= TIER.HIGH) return "high"
  if (score >= TIER.MED) return "med"      // < 0.5 → "low"
  return "low"
}
```
The `0.5` cutoff is the single source of truth. The row renders the worst field's `<ConfidenceChip score={raw} />`
(honest RAW score, never fabricated — the 112/118 honesty contract). Use
`@/components/metadata/ConfidenceChip` (the 112 one), NOT the local retrieval-similarity
`ConfidenceChip` inside `KnowledgeHealthPage.tsx`.

### Positive empty state (HLTH-01/02/03)
**Source:** `frontend/src/components/health/HealthEmptyState.tsx` (`variant="positive"`).
**Apply to:** all 3 cards. A clean signal (`total:0`) renders an "all clear" emerald state, not an
error. `HealthPanel` already wires this (`HealthPanel.tsx:64-65`), and `PaginationControls` returns
`null` when `total===0` (`PaginationControls.tsx:17`).

### Paginated response shape
**Source:** `knowledge_health.py:142` (and every `_fetch_*`).
**Apply to:** every governance `_fetch_*` and every `api.ts` helper return type.
`{"items": [...], "total": N, "offset": O, "limit": L}` — matches the frontend `PaginatedResponse<T>`
that `PaginationControls` consumes.

---

## No Analog Found

None. Every file has a direct, live-verified analog. This is the defining property of a pure-consumer
phase — flagged so the planner does NOT reach for RESEARCH.md generic patterns where a concrete
in-repo analog exists.

---

## Open Reuse-Depth Decisions (carry into planning — RESEARCH A5/A6/A7)

These are NOT "no analog" — they are reuse-DEPTH calls the planner must make explicitly. Each has a
documented lighter default.

| # | Decision | Lighter default (recommended) | Heavier option |
|---|----------|-------------------------------|----------------|
| A5 | Pagination granularity per card | `HealthPanel` top-10 + show-more; surface true `total` in header (matches the summary-card intent, D-119-7/8 favor lighter reuse) | A `HealthPanel`-styled `Card` wrapping `PaginationControls` (full `renderTabContent`-style pagination) |
| A6 | Row variant (D-119-6 read-only) | New `GovernanceRow` (link-out only) OR a `renderRow` prop on a `HealthPanel` variant — `HealthDocumentRow`'s inline delete/reingest/move VIOLATE D-119-6 | — (reusing `HealthDocumentRow` verbatim is NOT an option) |
| A7 | Section-deep-link into `DocumentDetailPanel` | Open the panel by doc id (matches IngestionPage); user uses the section they need | Add an optional `openSection?: "metadata"\|"relationships"\|"classification"` prop threaded to `PanelSection.defaultOpen` |
| A1 | Broken-edge "does it ever populate?" | Verify `deleteDocument` semantics live (hard-delete CASCADEs the edge away vs `is_latest` flip leaves it) in a Wave-0 test before sizing the broken card | — |
| A3 | Unclassified PostgREST jsonb path | `.eq("metadata->_classification->>status", "suggested")` | quoted arrow form `metadata->'_classification'->>'status'` — pin live in Wave 0 |
| A8 | DMF-03 nav gating | Do NOT gate (matches 113-118 — flag is dormant at every DM surface) | Gate (inconsistent; defer to v3.2 entitlement work) |

---

## Metadata

**Analog search scope:** `backend/app/api/`, `backend/app/services/`, `backend/app/`,
`frontend/src/pages/`, `frontend/src/components/health/`, `frontend/src/components/metadata/`,
`frontend/src/components/layout/`, `frontend/src/lib/`, `backend/tests/integration/`.
**Files scanned (read this session):** 13 — `knowledge_health.py`, `document_relationship_service.py`,
`App.tsx`, `nav-items.ts`, `ChatLayout.tsx`, `HealthPanel.tsx`, `HealthEmptyState.tsx`,
`PaginationControls.tsx`, `HealthDocumentRow.tsx`, `KnowledgeHealthPage.tsx`, `ConfidenceChip.tsx`,
`IngestionPage.tsx`, `DocumentDetailPanel.tsx`, `main.py`, `test_117_route_leak.py`.
**Pattern extraction date:** 2026-06-21
**No new package · no migration · no new write path** (verified against RESEARCH §Standard Stack +
§Runtime State Inventory).
