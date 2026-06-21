# Phase 119: Document Governance Health - Research

**Researched:** 2026-06-21
**Domain:** Read-only governance aggregation surface (FastAPI router + React top-level home) over shipped v3.0 DM tables under existing RLS
**Confidence:** HIGH (every reuse-target verified against live code; no external deps; no schema change)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from 119-CONTEXT.md `<decisions>`)

- **D-119-1: New TOP-LEVEL nav home "Governance"** — a new `ActiveView "governance"` member with its own nav icon, peer to **Library Health** (NOT a tab/section inside Documents, NOT cards bolted onto the retrieval dashboard). Name **distinct from "Library Health"**. Pick a **distinct non-reused lucide glyph** (Classification took `Wand2`; Library Health uses `Activity`) — candidates: `ShieldCheck`, `ClipboardCheck`. Glyph + h1/label wording are Claude's discretion.
- **D-119-2 (LOCKED, load-bearing — the Phase 118 lesson): the plan that adds the new `ActiveView` member MUST own its mount + nav IN-PHASE** — all three of: (a) extend `ActiveView` union in `frontend/src/App.tsx:9`; (b) add the `ChatLayout.tsx` render branch (additive BEFORE the trailing `KnowledgeHealthPage` else, exactly like `classification-rules` at `ChatLayout.tsx:294-301`); (c) add the `NAV_ITEMS` entry in `frontend/src/lib/nav-items.ts`. A plan-task checklist MUST enumerate all three or the surface is dead.
- **D-119-3: Broken/dangling relationship = an edge whose target resolves to NO readable latest version** (document fully deleted). A target that exists but is **masked "linked document (no access)"** is **NOT** a break — masking stays masking (preserves Phase 117 semantics; no cross-user existence leak). Anchors on `_resolve_readable_latest`.
- **D-119-4: Unclassified document = `metadata._classification.status == "suggested"`** (a pending classification suggestion neither accepted nor dismissed). NOT "folder_id is null".
- **D-119-5: Low-confidence metadata = a doc has ANY extracted field with `metadata._confidence[field] < 0.5`** — reuses `ConfidenceChip` `TIER.MED = 0.5` verbatim (hardcoded by 112's D-05). **No configurable threshold knob.** Doc-level "any field below"; query shape is Claude's discretion.
- **D-119-6: Every signal row LINKS/NAVIGATES to the document's detail panel** — NO inline actions. Broken-rel → Relationships section; unclassified → Classification section; low-confidence → Metadata section. Read-only / pure / **no new write path** (SC#3).
- **D-119-7: Counter header + 3 stacked `HealthPanel` cards** (broken / unclassified / low-confidence), each a paginated list with a positive empty state ("all clear"). NOT Library-Health-style Tabs; NOT a full charts/trends dashboard.
- **D-119-8: NO new G-2 sketch** — heavy reuse of the established `HealthPanel` visual is the acceptance bar.
- **D-119-9 (LOCKED landmine): carry the `initializedTabsRef` infinite-fetch guard** into every paginated card (`KnowledgeHealthPage.tsx:237-251`, BUG-260516-02, fixed 071.4). Use the `useRef<Set<key>>` initialized pattern, and clear it on Refresh.

### Claude's Discretion
- The "Governance" nav glyph and the exact h1/label wording (within "distinct from Library Health").
- The backend query shapes for each signal (a new `document_governance.py` router cloning `knowledge_health.py`'s `_fetch_*` + `_pagination_params` + paginated-route shape) — including **three routes vs one summary + three list routes**.
- Whether the DM capability flag (DMF-03, Phase 110) gates the Governance nav entry the same way as 113-118 (confirm during planning).
- The per-field low-confidence query mechanics (unnest vs jsonb scan).

### Deferred Ideas (OUT OF SCOPE)
- Inline triage tray (D-118-7, interactive accept/dismiss from the governance surface).
- Opt-in backfill sweep (D-118-2) — a write path.
- Full governance dashboard (charts / trends / gauge).
- Tabs layout (rejected for 3 stacked cards).
- Configurable low-confidence threshold knob.
- Additional governance signals (duplicates, stale-metadata, orphaned chunks).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DGOV-01 | User can see a light governance view surfacing document-structure health: broken/dangling relationships, unclassified documents, low-confidence metadata. | New `document_governance.py` router (3 signal `_fetch_*` over the DM tables) + a new `GovernancePage` reusing `HealthPanel`/`HealthEmptyState`/`PaginationControls`. Three signal definitions verified: broken (`_resolve_readable_latest` → None), unclassified (`metadata._classification.status == "suggested"`), low-conf (`metadata._confidence[field] < 0.5`). |
| DGOV-02 | Each governance signal links to the action that fixes it (open document, re-extract, classify). | Each row navigates to `DocumentDetailPanel` (verified: it ships Metadata + Relationships + Classification sections). Pattern: `IngestionPage` opens it via `setSelectedDocId(id)` → `selectedDoc` → `<DocumentDetailPanel doc=… />`. No new write endpoint. |
| UX-01 (cross-cutting) | Deep Midnight / Aether, mobile-responsive, WCAG 2.1 AA, reusing existing primitives. | `HealthPanel`/`HealthDocumentRow`/`HealthEmptyState`/`PaginationControls` + `ConfidenceChip` are all AA-compliant primitives already shipped; `DocumentDetailPanel` already renders a mobile bottom-sheet < 768px. |
</phase_requirements>

## Summary

Phase 119 is a **pure-consumer, read-only** surface: a new top-level "Governance" home backed by a new `backend/app/api/document_governance.py` router that aggregates three already-shipped DM signals under existing per-user RLS. There is **zero new write path, zero schema change, zero new dependency**. Every reuse target named in CONTEXT.md was verified against live code and the canonical refs **hold exactly** — the one nuance the planner must internalize is in how the broken-relationship signal calls `_resolve_readable_latest` and how the low-confidence signal cannot be expressed in PostgREST declaratively.

**Three signal mechanics (verified):**
1. **Broken relationships** — enumerate the caller's own edges (`document_relationships WHERE user_id = caller`), and for each edge classify the OTHER endpoint via `document_relationship_service._resolve_readable_latest(other_id, caller)`: a `None` return = broken (target fully deleted, no readable latest); a non-`None` return = resolvable (NOT broken); the **117 mask is NOT this resolver's concern** — masking happens in `get_related_documents`'s per-endpoint loop, and a masked-but-present target is one where the row STILL exists so it does NOT count as broken under D-119-3. Critical subtlety below.
2. **Unclassified** — `documents WHERE user_id = caller AND is_latest = True AND metadata->'_classification'->>'status' = 'suggested'` — this IS declaratively expressible in PostgREST (`.eq` on the deep jsonb path), so it can be a SQL-level paginated/counted query (unlike the other two).
3. **Low-confidence** — "ANY field's `_confidence < 0.5`" **cannot be expressed in PostgREST** (no `jsonb_each` predicate, no RPC exists). Must follow the `knowledge_health._fetch_most_retrieved` pattern: fetch the caller's latest docs (capped) and filter/paginate in Python. This is the single biggest implementation decision and is fully Claude's discretion per D-119-5.

**Primary recommendation:** Clone `knowledge_health.py`'s exact router shape into `document_governance.py` with **one `/summary` (counts) + three paginated `/broken-relationships`, `/unclassified`, `/low-confidence` list routes** — this matches the existing paginated-route precedent and lets the 3 stacked cards each fetch independently (each with its own `initializedTabsRef`-style guard). Build the `GovernancePage` directly on `HealthPanel` (not the Tabs page). Own the three-edit navigation triad in ONE plan. Do **NOT** gate the nav entry behind DMF-03 (113-118 deliberately did not; the flag exists but is unused at the UI surface — see DMF-03 verdict).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Broken-edge detection | API / Backend (`document_governance.py` + `document_relationship_service`) | Database (RLS + `_resolve_readable_latest`) | Leak-safe owner-scoped resolution is a backend concern; the resolver already encodes own-or-global + is_latest gating. |
| Unclassified count/list | API / Backend (PostgREST `.eq` on jsonb path) | Database | A deep-jsonb-path equality predicate is SQL-expressible; pushes filtering to Postgres. |
| Low-confidence count/list | API / Backend (in-Python scan, `knowledge_health` pattern) | Database (fetch latest docs) | "Any field < 0.5" is NOT a PostgREST predicate; Python scan over fetched rows mirrors `_fetch_most_retrieved`. |
| Owner scoping / leak-safety | API / Backend (`.eq("user_id", caller)` + `_uid()` coerce) | Database (RLS, but service-role bypasses it) | `get_supabase()` is service-role (RLS bypassed) → the app-code `.eq(user_id)` predicate is the SOLE gate (the 116/118 invariant). |
| Governance page render + 3 cards | Frontend (`GovernancePage` on `HealthPanel`) | — | Pure consumer UI; reuses shipped health primitives. |
| Navigation (reachability) | Frontend (App.tsx union + ChatLayout branch + nav-items) | — | The D-119-2 triad — one plan owns all three. |
| Fix-action link-out | Frontend (`DocumentDetailPanel` open by doc id) | — | Read-only navigation; the panel already owns all three fix sections. |

## Standard Stack

No new packages. Everything is in-repo and verified present.

### Core
| Component | Location | Purpose | Why Standard |
|-----------|----------|---------|--------------|
| FastAPI router clone | NEW `backend/app/api/document_governance.py` | 3 signal aggregation routes + `/summary` | Mirrors `knowledge_health.py` (`_fetch_*` + `_pagination_params` + `@router.get`) verbatim. `[VERIFIED: codebase]` |
| `_resolve_readable_latest` | `backend/app/services/document_relationship_service.py:162` | Classify each edge's far endpoint readable vs deleted | The 116/117 leak-safe resolver; returns a row or `None`. `[VERIFIED: codebase]` |
| `HealthPanel<T>` | `frontend/src/components/health/HealthPanel.tsx` | The card shell (title/icon/count/empty/show-more) for each of the 3 stacked cards | The D-119-7 card primitive — generic over `BaseDoc`. `[VERIFIED: codebase]` |
| `HealthEmptyState` | `frontend/src/components/health/HealthEmptyState.tsx` | Positive "all clear" empty state (`variant="positive"`) | HLTH-01/02/03 pattern. `[VERIFIED: codebase]` |
| `PaginationControls` | `frontend/src/components/health/PaginationControls.tsx` | offset/limit pager (`Showing N–M of T`) | Returns null when total===0. `[VERIFIED: codebase]` |
| `ConfidenceChip` + `TIER` | `frontend/src/components/metadata/ConfidenceChip.tsx:38` | The low-confidence row chip + the `0.5` cutoff source-of-truth | `TIER.MED = 0.5`; `tierFor` returns "low" when `score < 0.5`. `[VERIFIED: codebase]` |
| `DocumentDetailPanel` | `frontend/src/components/metadata/DocumentDetailPanel.tsx:131` | The single link-out target (Metadata + Relationships + Classification sections all present) | DGOV-02 fix surface; no new write endpoint. `[VERIFIED: codebase]` |

### Supporting (navigation triad — D-119-2)
| File | Edit | Verified anchor |
|------|------|-----------------|
| `frontend/src/App.tsx:9` | Add `"governance"` to the `ActiveView` union | Current union: `"chat" \| "documents" \| "skills" \| "settings" \| "library-health" \| "workflows" \| "classification-rules"` `[VERIFIED: codebase]` |
| `frontend/src/lib/nav-items.ts:24-35` | Add `{ view: "governance", icon: <DistinctGlyph>, label: "Governance" }` to `NAV_ITEMS`; import the glyph | Existing glyphs taken: `MessageSquare`/`Workflow`/`FileText`/`Wand2`/`Activity`/`Zap`/`Settings`. Use `ShieldCheck` or `ClipboardCheck`. `[VERIFIED: codebase]` |
| `frontend/src/components/layout/ChatLayout.tsx:294-301` | Add `: activeView === "governance" ? (<GovernancePage onNavigate={…} />)` branch BEFORE the trailing `: (<KnowledgeHealthPage />)` else | The `classification-rules` branch is the exact template. `[VERIFIED: codebase]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| 1 `/summary` + 3 list routes | 3 self-contained list routes (no summary) | Counter header needs totals; each paginated list already returns `total`, so the page could derive the 3 counts from the first page of each list and skip `/summary`. Cleaner (fewer routes); the counter header reads each card's `total`. **Recommended: skip `/summary`** — see Architecture Patterns. |
| `HealthPanel` (expand-in-place) | `KnowledgeHealthPage`'s Tabs + `PaginationControls` | D-119-7 explicitly rejects Tabs. `HealthPanel` caps at `BACKEND_LIMIT=10` with show-more; for a paginated card the planner must decide whether to drive `HealthPanel` (cap 10, no pager) OR a `HealthPanel`-styled card wrapping `PaginationControls` (full pagination). See Pitfall 4. |

**Installation:** None. No `npm install`, no `pip install`, no migration.

## Package Legitimacy Audit

> Not applicable — this phase installs **no external packages**. All components are in-repo (verified via Read/Glob against the live tree). No npm/PyPI/crates additions. The Package Legitimacy Gate is satisfied vacuously (nothing to audit).

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────── FRONTEND (no router; useState<ActiveView>) ──────────────────────────┐
│                                                                                                   │
│  NavPanel (NAV_ITEMS.map) ──click "Governance"──▶ App.setActiveView("governance")                │
│         │                                                  │                                       │
│         ▼                                                  ▼                                       │
│  nav-items.ts: { view:"governance", icon:ShieldCheck }   ChatLayout: activeView==="governance"   │
│                                                            ? <GovernancePage/>  (NEW branch)       │
│                                                            : ... KnowledgeHealthPage (else)        │
│                                                                       │                            │
│  GovernancePage (NEW, on HealthPanel):                                │                            │
│   ┌── counter header (3 totals) ───────────────────────────┐         │                            │
│   │  Card 1: Broken relationships  [initializedRef guard]   │── GET /document-governance/broken-relationships
│   │  Card 2: Unclassified docs     [initializedRef guard]   │── GET /document-governance/unclassified
│   │  Card 3: Low-confidence meta   [initializedRef guard]   │── GET /document-governance/low-confidence
│   └── each row: click ──▶ open DocumentDetailPanel(docId) at the relevant section ─┐               │
│                                                                                     ▼               │
│                                              DocumentDetailPanel: Metadata | Relationships | Classification
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │ (HTTP, JWT = caller)
                                          ▼
┌─────────────────────────── BACKEND (FastAPI, service-role supabase) ─────────────────────────────┐
│  document_governance.py (NEW router, cloned from knowledge_health.py)                              │
│   Depends(get_current_user) → caller = current_user["id"]   (SOLE owner gate via .eq(user_id))    │
│                                                                                                    │
│   _fetch_broken_relationships(sb, caller):                                                         │
│     edges = document_relationships WHERE user_id = caller            ◀── own-scoped               │
│     for edge: other = _resolve_readable_latest(far_endpoint, caller) ◀── None ⇒ BROKEN            │
│                                                  (non-None, incl. masked-present ⇒ NOT broken)     │
│   _fetch_unclassified(sb, caller):                                                                 │
│     documents WHERE user_id=caller AND is_latest=True                                              │
│       AND metadata->'_classification'->>'status' = 'suggested'   ◀── SQL-expressible (.eq on path)│
│   _fetch_low_confidence(sb, caller):                                                               │
│     docs = documents WHERE user_id=caller AND is_latest=True (capped); Python-scan                 │
│       any(v < 0.5 for v in metadata['_confidence'].values())     ◀── NOT a PostgREST predicate    │
└────────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼  documents / document_relationships (RLS; service-role bypasses → app .eq is the gate)
                                       Supabase Postgres :54322
```

### Recommended Project Structure
```
backend/app/api/
└── document_governance.py     # NEW — router cloned from knowledge_health.py
backend/app/main.py            # EDIT — import + app.include_router(document_governance.router)
frontend/src/pages/
└── GovernancePage.tsx         # NEW — counter header + 3 HealthPanel cards
frontend/src/lib/api.ts        # EDIT — 3 fetch helpers (getGovBroken/Unclassified/LowConfidence)
frontend/src/App.tsx           # EDIT (D-119-2a) — ActiveView union += "governance"
frontend/src/lib/nav-items.ts  # EDIT (D-119-2c) — NAV_ITEMS += Governance entry
frontend/src/components/layout/ChatLayout.tsx  # EDIT (D-119-2b) — governance render branch
```

### Pattern 1: Clone the `knowledge_health.py` router shape (router-clone target)
**What:** A prefixed `APIRouter`, module-level `_pagination_params(offset, limit)` dep, a `_fetch_*(supabase, user_id, offset, limit) -> {"items", "total", "offset", "limit"}` per signal, and thin `@router.get` handlers that pull `user_id = current_user["id"]`, call the fetch, and wrap exceptions in a `502 "…temporarily unavailable"`.
**When to use:** All three signal routes + (optionally) a `/summary`.
**Verified contract (from `knowledge_health.py`):**
```python
# Source: backend/app/api/knowledge_health.py:536-541, 560-575 (VERIFIED)
DEFAULT_LIMIT = 20
MAX_LIMIT = 100

def _pagination_params(
    offset: int = Query(0, ge=0),
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
) -> tuple[int, int]:
    return offset, limit

@router.get("/unclassified")
async def governance_unclassified(
    offset_limit: tuple[int, int] = Depends(_pagination_params),
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    user_id = current_user["id"]
    offset, limit = offset_limit
    try:
        return _fetch_unclassified(supabase, user_id, offset, limit)
    except Exception as exc:
        raise HTTPException(status_code=502, detail="Governance metrics temporarily unavailable") from exc
```
The paginated response shape is `{"items": [...], "total": N, "offset": O, "limit": L}` — matches the frontend `PaginatedResponse<T>` type that `PaginationControls` consumes. `[VERIFIED: codebase]`

### Pattern 2: Broken-relationship classification (D-119-3 — the load-bearing subtlety)
**What:** Enumerate the caller's OWN edges, then for each edge resolve the FAR endpoint; `None` from `_resolve_readable_latest` = broken.
**Verified semantics of `_resolve_readable_latest(doc_id, caller)`** (`document_relationship_service.py:162-266`):
- Returns the caller's LATEST accessible version row (own `is_latest=True` ∪ global-folder `is_latest=True`), **following an old-version id forward to its latest**.
- Returns **`None`** when: the id is unreadable/unknown OR the document was fully deleted (no `is_latest` row the caller can read). **This `None` is exactly the broken signal.** `[VERIFIED: codebase]`

**THE SUBTLETY the planner must get right (3 distinct cases):**
1. **Target fully deleted** → `_resolve_readable_latest` returns `None` → **BROKEN** (count it). Because `document_relationships.source_doc_id`/`target_doc_id` are `ON DELETE CASCADE` (migration 071:62-63), deleting the *document* normally deletes the *edge row* too — so a "broken edge" via cascade would simply not appear. **The real broken case is a SOFT-deleted / superseded-out document**: an edge stored against version id V; V is no longer `is_latest` and there is no readable latest in the lineage → resolver returns `None`. The planner should verify the exact deletion semantics live (does `deleteDocument` hard-delete the row, triggering CASCADE, or flip `is_latest`?). **OPEN QUESTION A1.**
2. **Target exists but the caller cannot read it (cross-user / private)** → for a governance card the caller only enumerates **their OWN edges** (`.eq("user_id", caller)`), and a user can only create an edge whose endpoints were both readable at create time (the 116 visible-both gate). So the masked-cross-user case (the 117 mask) does NOT normally arise on a user's own broken card. If it does (endpoint moved out of view post-creation), `_resolve_readable_latest` returns `None` → it would be counted as broken. Per D-119-3 a masked-but-present target is NOT a break — but **`_resolve_readable_latest` cannot distinguish "deleted" from "exists-but-now-unreadable"** (both → `None`). For a user's OWN edges this is acceptable (the far endpoint is genuinely no longer actionable by them); the cross-user existence-leak concern D-119-3 raises is structurally moot for own-scoped edges. **Document this in the plan.**
3. **Target resolvable** → non-`None` row → **NOT broken** (skip).

**Recommended fetch shape:**
```python
# document_governance.py (NEW) — broken-relationship signal
async def _fetch_broken_relationships(supabase, caller, offset, limit):
    edges = await aexec(
        supabase.table("document_relationships")
        .select("id, source_doc_id, target_doc_id, rel_type")
        .eq("user_id", _uid(caller))
    )
    broken = []
    for edge in (edges.data or []):
        # the FAR endpoint = both ends? An edge can be broken on EITHER end.
        for end_id in (edge["source_doc_id"], edge["target_doc_id"]):
            row = await _resolve_readable_latest(end_id, caller, supabase=supabase)
            if row is None:
                broken.append({"relationship_id": edge["id"], "rel_type": edge["rel_type"],
                               "broken_doc_id": end_id, "readable_doc_id": <the other end>})
                break
    total = len(broken)
    return {"items": broken[offset:offset+limit], "total": total, "offset": offset, "limit": limit}
```
Note this is **async** and must use `aexec`/`run_in_threadpool` (D-v2.5-01) — unlike `knowledge_health.py` which uses bare `.execute()` in sync `_fetch_*`. Because `_resolve_readable_latest` is `async`, the governance broken-edge fetch must be `async` and its route handler awaits it. The link-out row needs the READABLE end's doc id so the panel can open (the broken end can't be opened). `[ASSUMED — recommended design; A2]`

**Import `_uid` / `_resolve_readable_latest`:** Both are module-private (`_`-prefixed) in `document_relationship_service`. Plan should either (a) import them directly (Python allows it) or (b) add a thin public wrapper. The 116/117 precedent freely reuses `_resolve_readable_latest` across the service and tool layers, so direct import is consistent. `[VERIFIED: codebase]`

### Pattern 3: Unclassified signal (D-119-4 — SQL-expressible)
**Verified `_classification` object shape** (written by `classification_matcher.build_suggestion`, `classification_matcher.py:79-99`):
```json
{"rule_id": "...", "rule_name": "...", "condition_summary": "document_type = invoice",
 "suggested_folder_id": "...", "suggested_folder_name": "Invoices",
 "status": "suggested"}
```
Status enum verified across the three write sites:
- `"suggested"` — written on ingest (`documents.py:1908`, `build_suggestion`). `[VERIFIED]`
- `"accepted"` — `accept_classification` sets `{**sugg, "status": "accepted", "prior_folder_id": ...}` (`documents.py:1520`). `[VERIFIED]`
- `dismiss_classification` POPs `_classification` entirely (`documents.py:1579` `meta.pop("_classification", None)`) — so a dismissed doc has **NO `_classification` key at all**, not `status: "dismissed"`. `[VERIFIED]` This means the unclassified query naturally excludes dismissed docs (the key is gone).

**Recommended query (PostgREST deep jsonb path equality — works):**
```python
# Source pattern: PostgREST supports .eq on a deep jsonb ->> path
res = (supabase.table("documents")
       .select("id, filename, folder_id, metadata", count="exact")
       .eq("user_id", caller)
       .eq("is_latest", True)
       .eq("metadata->_classification->>status", "suggested")
       .range(offset, offset + limit - 1)
       .execute())
```
The deep-path `.eq("metadata->_classification->>status", "suggested")` is the supabase-py idiom (PostgREST `metadata->_classification->>status=eq.suggested`). The planner MUST verify this exact filter string lives against :54322 in a Wave-0 integration test (PostgREST jsonb-path quoting can be finicky — a `_`-leading key may need the arrow form `metadata->'_classification'->>'status'`; confirm the supabase-py builder rendering). `[ASSUMED — A3: verify the exact PostgREST path-filter syntax live]`

### Pattern 4: Low-confidence signal (D-119-5 — NOT PostgREST-expressible → Python scan)
**Verified:** No RPC for jsonb confidence scanning exists (grep of `supabase/migrations/*.sql` + `.rpc(` usage = none). PostgREST cannot express "ANY key in `metadata->'_confidence'` has value < 0.5". So this **must** follow the `knowledge_health._fetch_most_retrieved` in-Python pattern (fetch candidate rows, filter in Python). `[VERIFIED: codebase]`

**Verified store shape:** `metadata._confidence` is a flat `{field_key: float}` map (per `ConfidenceChip` props `documents.metadata._confidence[field]` and `DocumentDetailPanel.resolveFieldState`: `const score = metadata?._confidence?.[row.key]`). The cutoff is `TIER.MED = 0.5`, and `tierFor` classifies `score < 0.5` as "low". `[VERIFIED: codebase]`

**Recommended fetch shape (mirrors `_fetch_most_retrieved` cap+Python-filter):**
```python
def _fetch_low_confidence(supabase, caller, offset, limit):
    res = (supabase.table("documents")
           .select("id, filename, folder_id, metadata")
           .eq("user_id", caller).eq("is_latest", True)
           .limit(2000)  # cap, like knowledge_health's 1000 .in_() cap
           .execute())
    low = []
    for doc in res.data:
        conf = (doc.get("metadata") or {}).get("_confidence")
        if not isinstance(conf, dict):
            continue
        # pitfall: non-numeric / null values must be guarded
        lows = {k: v for k, v in conf.items()
                if isinstance(v, (int, float)) and not isinstance(v, bool) and v < 0.5}
        if lows:
            low.append({"document_id": doc["id"], "filename": doc.get("filename"),
                        "folder_id": doc.get("folder_id"),
                        "low_fields": lows,           # for the row chip(s)
                        "min_confidence": min(lows.values())})
    low.sort(key=lambda d: d["min_confidence"])
    total = len(low)
    return {"items": low[offset:offset+limit], "total": total, "offset": offset, "limit": limit}
```
The row can render the worst field's `ConfidenceChip` (honest raw score, never fabricated). **Pitfalls:** missing `_confidence` key (skip), non-numeric/`None`/`bool` values (guard with `isinstance(... (int,float)) and not isinstance(..., bool)`), and `0.0` is a legitimate low value (don't truthiness-test). `[ASSUMED — A4: recommended design]`

### Anti-Patterns to Avoid
- **Bolting cards onto `KnowledgeHealthPage`** — SC#1 + D-119-1 forbid it. Build a NEW `GovernancePage`.
- **Adding `status: "dismissed"` handling** — dismiss POPs the key; there is no `"dismissed"` status to filter against.
- **Expressing low-confidence in PostgREST** — impossible; Python-scan only.
- **Treating a 117-masked target as broken** — masking ≠ deletion (D-119-3). For own-scoped edges this is largely moot, but never surface a cross-user existence signal.
- **Forgetting D-v2.5-01** — the broken-edge fetch is async (`_resolve_readable_latest` is async + uses `aexec`); do NOT call bare `.execute()` inside an async handler for that signal. (The unclassified/low-conf sync `_fetch_*` can mirror `knowledge_health`'s bare `.execute()` only if the route stays sync — but `knowledge_health` routes are `async def` calling sync helpers, which technically blocks; prefer `run_in_threadpool` for the two sync fetches to honor CLAUDE.md.)
- **Optimistic UI** — governance is read-only; rows navigate, they do not mutate. The `HealthDocumentRow`'s built-in delete/reingest/move buttons are NOT wanted here (it embeds inline actions, contradicting D-119-6). Use a governance-specific row OR pass a row that links out. See Pitfall 5.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Leak-safe edge resolution | A new own/global/is_latest query | `_resolve_readable_latest` | Already encodes own∪global, is_latest gating, follow-to-latest, post-follow visibility re-check (CR-01) — re-deriving it re-opens leaks. |
| Card shell + empty state + show-more | Custom card | `HealthPanel` + `HealthEmptyState` | Shipped AA-compliant primitives; D-119-7/8 mandate reuse. |
| Pagination UI | Custom pager | `PaginationControls` | Returns null on empty; `Showing N–M of T`. |
| Confidence display + tier | Re-derive 0.5 cutoff | `ConfidenceChip` + `TIER.MED` | Single source of truth; D-119-5 forbids a second threshold. |
| Doc-detail link-out | A new panel | `DocumentDetailPanel` opened by doc id | Already ships Metadata + Relationships + Classification sections. |
| UUID coercion before a service-role predicate | bare `str(user_id)` | `_uid()` from the relationship service | The 116/118 hardening (a malformed value raises ValueError vs breaking the predicate). |
| Two-user live leak test harness | New harness | `test_117_route_leak.py` (asyncpg seed + service-role supabase + TestClient dep-override) | The exact, proven Validation Architecture template. |

**Key insight:** This phase's entire value is in *not* building anything new on the data side — it is a recomposition of shipped, security-reviewed primitives. The only net-new code is the aggregation router and the page; every signal definition reuses a verified shipped contract.

## Runtime State Inventory

> Not a rename/refactor/migration phase — this section is **N/A** for greenfield-additive consumer work. No stored data is re-keyed, no live service config changes, no OS-registered state, no secrets, no build artifacts. Verified: zero schema change (no migration), zero `npm install`/`pip install`. (Stated explicitly per the rename/refactor checklist: **None — verified, this is an additive read-only surface.**)

## Common Pitfalls

### Pitfall 1: Built-but-unreachable surface (THE Phase 118 lesson — D-119-2)
**What goes wrong:** A plan builds `GovernancePage` + the router but forgets one of the three nav edits → the page exists but no nav reaches it.
**Why it happens:** The three edits live in three files (App.tsx union, nav-items.ts, ChatLayout branch) — easy to split across plans/tasks and drop one.
**How to avoid:** ONE plan task must enumerate all three edits as an explicit checklist (118's code-review BLOCKER + verifier both caught this; fixed inline `6394d16e`). The plan-checker should verify a single plan owns all three.
**Warning signs:** Clicking the nav item navigates nowhere, or `KnowledgeHealthPage` renders (the trailing else catches an unhandled view).

### Pitfall 2: Infinite re-fetch loop on empty response (D-119-9 landmine, BUG-260516-02)
**What goes wrong:** A card with an empty API response + `items.length===0` guard + the response object in a `useEffect` dep array re-fires the fetch forever (each fetch yields a fresh object reference → effect re-runs → shakes the UI).
**Why it happens:** A legitimately-empty signal (zero broken edges) is the common steady state, so this fires constantly in healthy libraries.
**How to avoid:** Carry the `initializedTabsRef` pattern (`KnowledgeHealthPage.tsx:243-251`) — a `useRef<Set<key>>` that records which cards have already initialized; the fetch effect only fires for keys not yet in the set; clear the ref on Refresh (`KnowledgeHealthPage.tsx:389`). For 3 stacked cards (not tabs), the key is per-card-id (e.g. `"broken" | "unclassified" | "low-confidence"`).
**Warning signs:** Network tab shows repeated identical GETs; UI flicker on a card with no results.
```typescript
// Source: frontend/src/pages/KnowledgeHealthPage.tsx:243-251, 389 (VERIFIED)
const initializedRef = useRef<Set<CardKey>>(new Set())
useEffect(() => {
  for (const key of CARD_KEYS) {
    if (!initializedRef.current.has(key)) { initializedRef.current.add(key); fetchCard(key, 0) }
  }
}, [fetchCard])
// Refresh handler:
initializedRef.current.clear(); /* then re-trigger */
```

### Pitfall 3: Service-role client bypasses RLS — the app `.eq(user_id)` is the SOLE gate
**What goes wrong:** Omitting `.eq("user_id", caller)` on any governance query returns ALL users' docs/edges (RLS is bypassed by the service-role client `get_supabase()`).
**Why it happens:** RLS exists on these tables, lulling one into thinking the DB enforces scoping — but `get_supabase()` is service-role.
**How to avoid:** Every query carries `.eq("user_id", _uid(caller))`; `_resolve_readable_latest` already does for the broken signal. This is the 116/118 invariant (`document.py:1881` comment, `_uid` docstring). Test it two-user (see Validation Architecture).
**Warning signs:** A two-user test shows user A seeing user B's docs.

### Pitfall 4: `HealthPanel` caps at 10 with no pager — pagination needs a decision
**What goes wrong:** `HealthPanel` shows up to `maxVisible` (default 5), expands to all `documents` passed in, and notes "Showing top 10" when `length >= BACKEND_LIMIT=10` — it has **no `PaginationControls`**. If the planner passes a full paginated page into `HealthPanel`, the pager is lost.
**Why it happens:** `HealthPanel` was built for the summary view (top-N), not full pagination. D-119-7 says "paginated list".
**How to avoid:** Either (a) accept `HealthPanel`'s top-10 + "show more" semantics (simplest, matches the existing summary card) and surface the true total in the header count, OR (b) build the card as a `HealthPanel`-styled `Card` that renders rows + `PaginationControls` (like `KnowledgeHealthPage.renderTabContent`). **Recommend (a) for v1** — it is the lighter reuse D-119-7/8 favor; the `total` count is still honest. **OPEN QUESTION A5.**

### Pitfall 5: `HealthDocumentRow` embeds inline mutate actions (contradicts D-119-6)
**What goes wrong:** `HealthDocumentRow` ships delete/re-ingest/move buttons + dialogs. Reusing it verbatim would add inline actions, violating "read-only, link-out only" (D-119-6).
**Why it happens:** It's the natural row primitive `HealthPanel` defaults to.
**How to avoid:** Pass a governance-specific row renderer (or a thin row that on-click calls `onNavigate`/opens the detail panel) instead of the default `HealthDocumentRow`. `HealthPanel` takes `renderChip` but renders `HealthDocumentRow` internally — so the planner likely needs a small variant of `HealthPanel` OR a new lightweight `GovernanceRow` + a plain card. Confirm during planning. **OPEN QUESTION A6.**

### Pitfall 6: Opening the detail panel at a SPECIFIC section (DGOV-02)
**What goes wrong:** D-119-6 wants broken→Relationships, unclassified→Classification, low-conf→Metadata. But `DocumentDetailPanel` has NO prop to open a specific section — `PanelSection`s default-open independently (Metadata `defaultOpen`, the others closed).
**Why it happens:** The panel was built for the IngestionPage flow (open the whole panel; user scrolls).
**How to avoid:** v1 can open the panel (the doc-level link) and let the user use the section they need — DGOV-02 says "links to the action that fixes it (open document, …)"; opening the document IS the link. A deep-section-scroll prop is a NICE-TO-HAVE the planner may add (an optional `openSection?: "metadata"|"relationships"|"classification"` prop threaded to `PanelSection.defaultOpen`). **Recommend: open the panel by doc id (matches IngestionPage's `setSelectedDocId`); section-deep-link is optional polish.** The governance page is a top-level home, so it must own its OWN `DocumentDetailPanel` mount + `selectedDocId` state (it is not inside IngestionPage). **OPEN QUESTION A7.**

## Code Examples

### Opening the DocumentDetailPanel by doc id (the DGOV-02 link-out pattern)
```typescript
// Source: frontend/src/pages/IngestionPage.tsx:88, 136-138, 564-570 (VERIFIED)
const [selectedDocId, setSelectedDocId] = useState<string | null>(null)
const selectedDoc = useMemo(
  () => (selectedDocId === null ? null : documents.find((d) => d.id === selectedDocId) ?? null),
  [selectedDocId, documents],
)
// ... a row's onClick:
onSelect={setSelectedDocId}
// ... render:
{selectedDoc && (
  <DocumentDetailPanel doc={selectedDoc} onClose={() => setSelectedDocId(null)} onReconcile={loadDocuments} />
)}
```
**Note:** `DocumentDetailPanel` needs a full `Document` object (carries `.metadata`), not just an id. The governance page either (a) has the docs in state (the low-conf/unclassified fetches already return `metadata`) or (b) fetches the doc on click. The broken-relationship card's link must open the READABLE end (the broken end can't be opened). `[VERIFIED: codebase]`

### Router mount in main.py
```python
# Source: backend/app/main.py:405, 424-425 (VERIFIED — pattern to extend)
from app.api import ..., document_relationships, classification_rules, document_governance  # ADD
app.include_router(document_governance.router)  # Phase 119 DGOV-01/02 — read-only governance aggregation
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `knowledge_health.py` `/summary` (4 arrays) | DEPRECATED in favor of paginated per-metric routes | Phase 075.4 | Clone the **paginated** routes, not `/summary` — `knowledge_health_summary` is explicitly marked deprecated (`knowledge_health.py:674`). |
| Tabs health layout | 3 stacked `HealthPanel` cards | D-119-7 (this phase) | Don't copy `KnowledgeHealthPage`'s Tabs; use `HealthPanel`. |
| `HealthDocumentRow`'s old `ConfidenceChip` (similarity %) | The metadata `ConfidenceChip` (`TIER.MED=0.5`, honest tiers) | Phase 112 | Two `ConfidenceChip`s exist — use `@/components/metadata/ConfidenceChip` (the 112 one), NOT the local one in `KnowledgeHealthPage.tsx:43`. |

**Deprecated/outdated:** `GET /knowledge-health/summary` — use paginated endpoints. The local `ConfidenceChip` inside `KnowledgeHealthPage.tsx` is a *different* component (retrieval similarity), not the metadata one.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Document deletion semantics: a "broken edge" arises from a soft-deleted/superseded doc (no readable latest), not a hard-delete (which CASCADEs the edge away). | Pattern 2 | If deletes hard-delete the doc row, CASCADE removes the edge → broken card may always be empty in practice. The planner MUST verify `deleteDocument` semantics live (hard-delete vs is_latest flip) before sizing the broken-edge card. Low impact on correctness (empty is a valid state), high impact on whether the feature ever shows data. |
| A2 | Broken-edge fetch must be `async` (because `_resolve_readable_latest` is async) and link-out opens the READABLE end. | Pattern 2 | If wrong, the route blocks the event loop (D-v2.5-01 violation) or links to an unopenable doc. |
| A3 | The PostgREST deep-jsonb-path filter for unclassified is `.eq("metadata->_classification->>status", "suggested")` (or the quoted arrow form). | Pattern 3 | If the supabase-py builder renders the `_`-leading key path differently, the filter silently returns nothing. MUST verify live in a Wave-0 test. |
| A4 | `_confidence` is a flat `{field: float}` map and low = any value < 0.5; non-numeric/bool/missing guarded. | Pattern 4 | If a value is a string or nested, the scan errors or mis-counts. Guarded design mitigates. |
| A5 | v1 broken/unclassified/low-conf cards use `HealthPanel`'s top-10 + show-more rather than full `PaginationControls`. | Pitfall 4 | If full pagination is required, the card needs the `renderTabContent`-style composition instead. Operator/planner call. |
| A6 | A governance-specific row (link-out, no inline mutate) replaces the default `HealthDocumentRow`. | Pitfall 5 | If `HealthDocumentRow` is reused verbatim, inline actions violate D-119-6. |
| A7 | Section-deep-link into `DocumentDetailPanel` is optional; v1 opens the panel by doc id. | Pitfall 6 | If DGOV-02 is read as "must open the exact section", a new `openSection` prop is needed. |
| A8 | DMF-03 does NOT gate the Governance nav/page (matching 113-118). | DMF-03 verdict | If the operator wants gating, add it — but it would be inconsistent with every other DM surface (which are ungated). |

**If this table is empty:** it is not — these are the decisions the planner/discuss-phase should confirm. None block planning; all are sizing/correctness confirmations.

## Open Questions

1. **Broken-edge in practice (A1):** Does `deleteDocument` hard-delete (CASCADE removes the edge) or flip `is_latest`? Verify live before sizing.
   - What we know: FKs are `ON DELETE CASCADE` (migration 071:62-63); edges store creation-time version ids; `_resolve_readable_latest` follows to latest.
   - What's unclear: the exact delete path's effect on edge rows.
   - Recommendation: a Wave-0 integration test that seeds an edge, deletes/supersedes the target, and asserts the broken card surfaces it (or proves CASCADE removes it) — pins the real behavior.
2. **Unclassified PostgREST path syntax (A3):** Confirm `.eq("metadata->_classification->>status", "suggested")` renders the right PostgREST filter for a `_`-leading key.
   - Recommendation: Wave-0 integration test against :54322.
3. **Pagination granularity (A5) / row variant (A6) / section-deep-link (A7):** Reuse-depth decisions for the planner; all have a documented "lighter" default.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase local (:54322) | All integration tests + live verification | ✓ (per CLAUDE.md local dev) | local CLI | Unit tests with MagicMock builders (the `test_knowledge_health.py` pattern) |
| asyncpg | The two-user live leak harness (`test_117_route_leak.py` pattern) | ✓ (used by all 113-118 integration tests) | in `backend/tests/integration` | Skip-if-unreachable guard already in the harness |
| Python venv + FastAPI + supabase-py | The new router | ✓ (existing backend) | existing | — |
| Node + Vite + React + shadcn/ui | The new page | ✓ (existing frontend) | existing | — |

**Missing dependencies with no fallback:** None. **Missing with fallback:** None — this phase adds no new dependency.

## DMF-03 Capability-Flag Gating Verdict (Claude's Discretion — CONFIRMED)

**Verdict: do NOT gate the Governance nav entry or page behind DMF-03.** Match the 113-118 precedent.

**Evidence (verified):**
- The flag exists: `app_settings.document_management_enabled` (default `True`), read via `user_settings.document_management_enabled()` (`user_settings.py:605-616`, defensive default-on).
- But **111/112/113/116 explicitly chose NOT to gate** at the surface: `document_relationships.py:48` — *"Per the 111/112/113 precedent: NO `document_management_enabled` feature gate is added here — the gate lives at the UI surface (Phase 117)"*; `document_views.py:41` — *"NO `document_management_enabled` feature gate"*. `[VERIFIED: codebase]`
- And the UI surface does NOT gate either: `NavPanel.tsx:287` iterates `NAV_ITEMS` directly with no filter; `nav-items.ts` has no flag check; `ChatLayout` renders DM branches unconditionally. A frontend grep for `document_management_enabled`/`DMF-03` returns **zero** matches in `frontend/src`. `[VERIFIED: codebase]`

So in practice **the DMF-03 flag is currently dormant** — it is wired into settings as the future entitlement seam (SEED-080, v3.2) but no shipped DM phase consumes it at any surface. Adding gating to Governance alone would make it the lone gated DM surface — inconsistent and confusing. If the operator later wants the whole DM capability toggleable, that is a separate cross-cutting phase that retro-gates ALL surfaces uniformly (and is the v3.2 entitlement work, not 119). **Recommendation: leave Governance ungated, consistent with its siblings; note the dormant flag as a documented v3.2 seam.** `[VERIFIED: codebase]`

## Validation Architecture

> nyquist_validation is `true` in `.planning/config.json`. This section drives VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | pytest (backend, `backend/tests/`); Vitest (frontend, `*.test.tsx`) |
| Config file | `backend/pytest.ini` (assumed present — verify Wave 0); frontend uses Vitest config in `frontend/` |
| Quick run command | `cd backend && source venv/Scripts/activate && pytest tests/integration/test_119_*.py -x` |
| Full suite command | `cd backend && source venv/Scripts/activate && pytest -q` + `cd frontend && npm test` |

**Live-DB convention (verified, the 113-118 standard):** integration tests live in `backend/tests/integration/` and drive the REAL service-role supabase + a `TestClient` with `get_current_user`/`get_supabase` dependency overrides against local Postgres `:54322` (asyncpg seed/teardown). Template: `test_117_route_leak.py`. Unit tests with MagicMock builders live in `backend/tests/unit/` / `backend/tests/` (template: `test_knowledge_health.py`).

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DGOV-01 (broken) | A fully-deleted/superseded edge target surfaces in the broken list; a resolvable target does NOT | integration (live) | `pytest tests/integration/test_119_broken.py -x` | ❌ Wave 0 |
| DGOV-01 (broken, mask) | A masked-but-present target (117 semantics) is NOT reported as broken | integration (live) | `pytest tests/integration/test_119_broken.py::test_masked_not_broken -x` | ❌ Wave 0 |
| DGOV-01 (unclassified) | A doc with `_classification.status=="suggested"` surfaces; an accepted/dismissed doc does NOT | integration (live) | `pytest tests/integration/test_119_unclassified.py -x` | ❌ Wave 0 |
| DGOV-01 (low-conf) | A doc with any `_confidence[field] < 0.5` surfaces; a doc with all ≥ 0.5 does NOT; `0.0` counts; missing `_confidence` does not error | unit + integration | `pytest tests/unit/test_119_low_conf_scan.py -x && pytest tests/integration/test_119_low_conf.py -x` | ❌ Wave 0 |
| DGOV-01 (leak) | **Two-user**: A never sees B's broken/unclassified/low-conf docs (own-scoped, RLS-bypass-proof) | integration (live, two-user) | `pytest tests/integration/test_119_leak.py -x` | ❌ Wave 0 |
| DGOV-01 (empty) | Each signal returns `{"items":[], "total":0}` for a clean library → card shows positive empty state | unit (MagicMock) + frontend | `pytest tests/test_119_governance.py::test_empty_shapes -x` | ❌ Wave 0 |
| DGOV-02 | A signal row navigates to `DocumentDetailPanel` for the readable doc (no write endpoint hit) | frontend (Vitest) | `cd frontend && npm test GovernancePage` | ❌ Wave 0 |
| UX-01 | Page reachable from nav (D-119-2 triad wired); mobile-responsive; AA | frontend (Vitest) + manual Chrome MCP | `cd frontend && npm test GovernancePage` + manual | ❌ Wave 0 |
| D-119-9 | No infinite re-fetch on empty response; Refresh clears the init ref | frontend (Vitest) | `cd frontend && npm test GovernancePage::no-refetch-loop` | ❌ Wave 0 |

### Leak-safety properties to test (two-user, the 113-118 discipline)
- User A's broken/unclassified/low-conf lists NEVER include user B's documents (own-scoped `.eq(user_id)` is the sole gate; service-role bypasses RLS).
- A 117-masked target (B owns an edge to A's private doc) does NOT appear on B's broken card as a "break" — masking ≠ deletion (non-vacuity twin: A, who owns the doc, does not see it as broken either; the doc resolves).
- Non-vacuity guard: seed at least one TRUE positive per signal so an "all clear" pass cannot false-green (the "static would false-green" lesson, D-102/D-110-5). For broken: seed an edge whose target is superseded-out/deleted. For unclassified: seed a `suggested` doc. For low-conf: seed a doc with a `0.4` confidence field.

### Empty-state / positive-state assertions
- Clean library → each route returns `total: 0` and the card renders `HealthEmptyState variant="positive"` ("all clear" reads as good, per HLTH-01/02/03).
- The `initializedRef` guard ensures a single fetch per card even when `total:0` (no loop).

### Automatable vs manual
- **Automatable (backend pytest, live :54322):** all three signal definitions, two-user leak, empty/positive shapes, the unclassified PostgREST path, the low-conf Python scan edge cases (0.0, missing key, non-numeric).
- **Automatable (frontend Vitest):** nav reachability (the triad), link-out navigation, the no-refetch-loop guard, empty-state render.
- **Manual (Chrome MCP / human UAT):** mobile-responsive layout of 3 stacked cards (G-4 lived-experience), WCAG AA contrast (panel-scoped tokens), and the actual click-through from a governance row into the correct detail-panel section across viewport sizes.

### SC#10 4-axis UAT relevance
This phase is **read-only UI + a new REST router** — it does NOT touch streaming, the agent loop, provider routing, or shared UI streaming state, and it does NOT touch `threads.py` (G-5 clean). Therefore the mandatory cross-provider × multi-tool × parallel-thread × long-message matrix does **not** structurally apply (no provider path, no tool, no thread state). The relevant lived-experience UAT axes are instead: **(1) mobile-responsive** (3 stacked cards on a phone), **(2) WCAG AA** (the new page's tokens), **(3) link-out correctness** (each signal opens the right doc/section), and **(4) the empty→populated→empty transitions** (no refetch loop, honest counts). Author these as manual UAT rows in VALIDATION.md; the cross-provider 4-axis matrix is N/A and should be noted as such (with the reason) rather than padded.

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_119_broken.py` — broken-edge detection + masked-not-broken (DGOV-01)
- [ ] `backend/tests/integration/test_119_unclassified.py` — suggested surfaces, accepted/dismissed don't (DGOV-01)
- [ ] `backend/tests/integration/test_119_low_conf.py` — any-field-<0.5 surfaces (DGOV-01)
- [ ] `backend/tests/unit/test_119_low_conf_scan.py` — Python scan edge cases (0.0, missing, non-numeric)
- [ ] `backend/tests/integration/test_119_leak.py` — two-user own-scoping (clone `test_117_route_leak.py` harness)
- [ ] `backend/tests/test_119_governance.py` — empty-shape unit tests (MagicMock, `test_knowledge_health.py` pattern)
- [ ] `frontend/src/pages/__tests__/GovernancePage.test.tsx` — nav reachability, link-out, no-refetch-loop, empty state
- [ ] Framework install: none — pytest + Vitest already present.

## Security Domain

> `security_enforcement` not set to false → enabled. This phase is read-only aggregation, so the threat surface is narrow but real (cross-user leakage).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `Depends(get_current_user)` (JWT) — `caller = current_user["id"]`; identical to every shipped router. |
| V3 Session Management | no | No new session state; stateless reads. |
| V4 Access Control | **yes (primary)** | Every query `.eq("user_id", _uid(caller))`; `_resolve_readable_latest` for the broken signal; service-role client → app predicate is the SOLE gate. Two-user live test mandatory. |
| V5 Input Validation | yes | `_pagination_params` (`ge`/`le` Query bounds); doc ids go through `_resolve_readable_latest` (which `_uid`-coerces) or PostgREST bound params — no string interpolation into SQL. A malformed doc id must collapse to a calm response, not a 500 (the WR-01/T-117-02 lesson). |
| V6 Cryptography | no | No crypto; no secrets handled. |

### Known Threat Patterns for FastAPI + service-role Supabase + read-only aggregation
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user data leak (omit `.eq(user_id)` on a service-role query) | Information Disclosure | `.eq("user_id", _uid(caller))` on EVERY query; two-user live leak test (non-vacuous). |
| Existence oracle (masked-but-present target reported as "broken" leaks that a doc exists) | Information Disclosure | D-119-3: masked ≠ broken; own-scoped edges only; never surface cross-user existence. |
| Malformed-id → 500 (robustness + oracle) | DoS / Info Disclosure | Calm handling: `_resolve_readable_latest` returns None on miss; route wraps in 502/404 like `knowledge_health`/`document_relationships`. |
| Provenance forgery (fabricated confidence score on a row) | Tampering | Render the RAW `_confidence` value via `ConfidenceChip` — never a fabricated number (the 112/118 honesty contract). |
| Audit gap | Repudiation | N/A — reads are not audited (mirrors `resolve_view`/`get_relationships`, which write no audit row; `VALID_ACTION_TYPES` has no read action type). Confirm no write path is introduced. |

## Project Constraints (from CLAUDE.md)

- **Python venv** for the backend router work; no LangChain/LangGraph; raw SDK only (N/A — no LLM calls here).
- **RLS on all tables** — already satisfied; the governance reads are owner-scoped over existing-RLS tables; the app `.eq(user_id)` predicate is the sole gate under the service-role client.
- **`run_in_threadpool` for blocking I/O in async handlers (D-v2.5-01)** — the broken-edge fetch is async via `aexec`; the two sync `_fetch_*` (unclassified/low-conf) should be wrapped in `run_in_threadpool` when called from the async route (the `knowledge_health.py` precedent calls sync helpers from async routes — technically blocking; prefer threadpool to honor CLAUDE.md).
- **Numbered SQL migrations only if schema changes** — **NO migration needed** for this phase (verified: zero schema change).
- **Supabase Realtime is best-effort** — N/A (no realtime); a Refresh button reconciles via fetch (the `KnowledgeHealthPage` pattern).
- **Settings live in `user_settings`/`app_settings`** — N/A (no new setting); DMF-03 flag already exists and stays dormant.
- **No connectors / manual ingestion only** — N/A.
- **Reported-bugs cross-check (`/gsd:plan-phase` touchpoint):** verify any `folded_into: 119` report is covered. Per the discussion log, NO open `surface: Agentic-RAG` report overlaps this domain; BUG-260516-02 is closed (its `initializedTabsRef` fix is carried forward as D-119-9, not reopened).

## Sources

### Primary (HIGH confidence — verified against live code this session)
- `backend/app/api/knowledge_health.py` — router-clone target (`_fetch_*`, `_pagination_params`, paginated routes, response shape, `/summary` deprecation)
- `backend/app/services/document_relationship_service.py` — `_resolve_readable_latest` (162-266), `_uid`, `_NO_ACCESS_MASK`, `get_related_documents`
- `backend/app/api/documents.py` — classification write site (1871-1913), `accept_classification` (1520), `dismiss_classification` (1548-1589)
- `backend/app/services/classification_matcher.py` — `build_suggestion` (`_classification` object shape, status values)
- `frontend/src/components/metadata/ConfidenceChip.tsx` — `TIER = { HIGH: 0.75, MED: 0.5 }`, `tierFor` (low = `< 0.5`)
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` — Metadata + Relationships + Classification sections; `_confidence[field]` store shape
- `frontend/src/App.tsx:9`, `frontend/src/lib/nav-items.ts`, `frontend/src/components/layout/ChatLayout.tsx:294-301` — the navigation triad
- `frontend/src/components/health/{HealthPanel,HealthEmptyState,HealthDocumentRow,PaginationControls}.tsx` — the reuse kit
- `frontend/src/pages/KnowledgeHealthPage.tsx:237-251,389` — the `initializedTabsRef` guard
- `frontend/src/pages/IngestionPage.tsx:88,136-138,564-570` — the detail-panel open-by-id pattern
- `backend/app/models/user_settings.py:605-616` + `backend/app/api/document_relationships.py:48` + `document_views.py:41` — DMF-03 dormant-flag evidence
- `supabase/migrations/071_dm_foundations.sql:57-69,135-185` — `document_relationships` schema (no `is_latest` column; FKs CASCADE; user-scoped RLS)
- `backend/tests/integration/test_117_route_leak.py` — the two-user live leak harness template
- `.planning/ROADMAP.md` (Phase 119 §, lines 263-275) — Goal + 3 SC; `.planning/REQUIREMENTS.md` (DGOV-01/02)

### Secondary (MEDIUM)
- `.planning/config.json` — `nyquist_validation: true`, `use_worktrees: true`
- `.planning/phases/118-auto-classification/118-CONTEXT.md` (referenced via canonical_refs; not re-read this session — the 118 lesson is captured in CONTEXT D-119-2)

### Tertiary (LOW — none)
- No WebSearch/external sources used; this is an entirely in-repo consumer phase.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every component read in the live tree; no external deps.
- Architecture: HIGH — router-clone target and all reuse targets verified; the 3 signal mechanics confirmed against source.
- Pitfalls: HIGH — each pitfall is grounded in a verified code anchor (the 118 reachability lesson, the BUG-260516-02 fix, the service-role gate, `HealthPanel`'s cap, `HealthDocumentRow`'s inline actions).
- Open questions: the 8 assumptions (A1-A8) are sizing/correctness confirmations, not blockers — all have a documented lighter default.

**Research date:** 2026-06-21
**Valid until:** ~2026-07-21 (stable in-repo surface; re-verify only if 116/117/118 hot files change before planning)
