# Phase 117: Document Relationships — Panel UI - Research

**Researched:** 2026-06-20
**Domain:** REST read-seam extraction (Python/FastAPI) + React panel UI (typeahead combobox, accordion section) on an established Deep Midnight design system
**Confidence:** HIGH (all claims grounded in this repo's source read this session; zero net-new external packages)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **D-117-1 (Create is outgoing-only):** The create form always authors an OUTGOING edge from the open document — `A [rel_type] → X`. User picks a target X + one of the 4 types (`supersedes`/`amends`/`references`/`attached_to`), always read from A's perspective. To author "X supersedes A" the user opens X's panel.
- **D-117-2 (Remove works on either direction):** Any link LISTED in A's panel — outgoing OR incoming — has a remove control. Both edges are the same user's own rows (table is user-scoped, migration 071), so `DELETE /document-relationships/{id}` removes either. **Deliberate asymmetry — lock it against "fix to symmetry" reviews.**
- **D-117-3 (Searchable typeahead, not a plain Select):** Keep `MoveToFolderDialog`'s dialog + confirm shell + error line, but REPLACE its plain `Select` with a filterable typeahead/combobox (a KB holds thousands of docs; a scroll-only Select dies past ~30–40).
- **D-117-4 (Candidate list hides self + already-linked-with-chosen-rel_type):** Per-type exclusion — switching the rel_type changes the candidate set. Idempotent-create (D-116-6) is the safety net; the UI exclusion is for clarity.
- **D-117-5 (Grouped by direction):** Two labeled subgroups — **Outgoing** (`A → X`) then **Incoming** (`Y → A`) — each row = related filename + rel-type chip.
- **D-117-6 (Incoming rows use inverse labels):** Outgoing chips show `rel_type` verbatim ("Supersedes"); incoming chips use the inverse label ("Superseded by") drawn from the SAME vocabulary the backend defines — `tool_dispatcher._INVERSE_LABEL` (`supersedes→superseded_by`, `amends→amended_by`, `references→referenced_by`, `attached_to→has_attachment`). Single source of truth — frontend MIRRORS, never invents.
- **D-117-7 (Net-new REST read endpoint — share, do NOT fork the leak-safe read):** Add a net-new authenticated `GET` endpoint for the panel AND extract the read traversal into the shared `document_relationship_service` so the agent tool AND the new REST route call ONE source of truth (the Phase 115 `resolve_filter`→`document_view_resolver.py` precedent). Never duplicate the leak-safe read into the route. `threads.py` untouched (G-5). Route shape + response model + extraction mechanism = researcher/planner discretion within this policy.
- **D-117-8 (Leak-safe masking reaffirmed — verify LIVE):** A link whose target the caller can't see renders as "linked document (no access)" with `document_id: null` — never the title/id/metadata. Per-viewer readability re-check is the SOLE access gate. **Verify the two-user leak LIVE in secure-phase**, not via the RLS label (D-102/D-110-5 "static would false-green").
- **D-117-9 (Re-fetch on mutation, not optimistic):** After a successful create/remove, re-fetch the relationships list and re-render. The fidelity audit additionally KILLED any "Undo" affordance (it implies optimistic reversibility the backend doesn't provide).
- **D-117-10 (Honest state set — 112 precedent):** empty → "No relationships yet" + create affordance; loading → skeleton/quiet; error → honest "couldn't load relationships" (never silent-empty reading as "no links"); no-access → "linked document (no access)". Create dialog has its own error line + disabled-until-valid confirm.
- **D-117-11 (No `document_management_enabled` UI gate):** The flag exists in `app_settings` (default True) but is UI-enforced nowhere; 112/113/114/116 all shipped ungated. 117 does NOT introduce one.

### Claude's / Researcher's Discretion
- Route shape + response model + extraction mechanism for the read seam (D-117-7) — **recommended below with evidence.**
- Data source for the typeahead candidates + WHERE the self/already-linked exclusion is computed (client vs server) — pick least-complex correct.
- Exact copy for empty/error states, skeleton design, chip styling, section count/warn badge, create dialog mobile behavior — subject to the locked G-2 sketch.
- Whether inverse-label display strings are formatted (snake_case → "Superseded by") in the frontend or pre-formatted by the read endpoint (D-117-6) — **recommended below.**

### Deferred Ideas (OUT OF SCOPE)
- Direction toggle in the create form (author "X supersedes A" from A's panel) — rejected for v1.
- Relationship graph visualization — explicitly out of v3.0 Tier A scope.
- Agent-driven create/remove of relationships — agent stays read-only (`get_related_documents`); humans curate via this panel.
- Versions accordion section in the detail panel — separate later work.
- DM feature-flag UI gating of all DM surfaces — a cross-cutting gating phase if product wants it, not here.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| REL-02 | User can see a document's relationships in a panel on its detail view. | The net-new `GET` read seam (D-117-7, §Standard Stack + §Architecture) surfaces outgoing+incoming compact rows; the `Relationships` `PanelSection` added to the Phase 112 `DocumentDetailPanel` shell renders them grouped-by-direction with inverse labels (§Architecture Pattern 2/3); the typeahead create dialog + DELETE handle create/remove (§Architecture Pattern 4); re-fetch reconcile + honest states close the live-reflection + masking criteria (§Pitfalls, §Validation Architecture). |
| UX-01 (cross-cutting) | Deep Midnight / Aether design system, mobile-responsive, WCAG 2.1 AA. | Panel-scoped AA tokens, `useIsMobile` bottom-sheet, combobox a11y roles (net-new), `vitest-axe` automated check (§Validation Architecture, §Security Domain V5). |
| UX-02 (cross-cutting G-2) | Relationship panel sketched + operator-approved before plan. | SATISFIED — sketches 034 (chip-led grouped section) + 035 (type-first typeahead picker), both winner A, operator-approved 2026-06-20, audit-hardened `wf_1ec2afac-687`. See `references/document-relationships-panel.md`. |
</phase_requirements>

## Summary

Phase 117 is a **frontend feature phase carrying one net-new backend read seam**. The hard architectural decision (the route shape, response model, extraction mechanism for D-117-7) is fully constrained by an existing, exact precedent: Phase 115 lifted `document_views`'s leak-safe `resolve_filter` core out of the route module into a FastAPI-free shared module (`document_view_resolver.py`) so the agent tool and the REST route call one implementation. Phase 117 does the **same move on the relationship read**: extract the leak-safe outgoing+incoming traversal (currently living only inside `tool_dispatcher._handle_get_related_documents`, lines 492-649) into `document_relationship_service.py`, then call it from BOTH a new `GET` route AND the (unchanged-behavior) agent handler.

The frontend is almost entirely reuse: the `DocumentDetailPanel` shell (Phase 112) reserves the `Relationships` slot, `PanelSection` is the accordion + count-badge primitive, `MoveToFolderDialog` is the dialog/confirm/error-line shell for the create flow, and the api.ts/types.ts client patterns (`updateDocumentMetadata`, the `document-views` client family) are the templates for the 3 new client functions. The single genuinely net-new frontend element is the **typeahead combobox** that replaces the plain `Select` — there is no `cmdk`/Command primitive in the repo, so it must be built from a styled input + listbox with the APG combobox roles wired by hand (the sketch's a11y contract calls this out explicitly).

Honesty and leak-safety are load-bearing and already proven at the agent-tool boundary; the risk this phase must guard is **forking the leak-safe read into the new route** (re-opening the SC#2 leak) and **the new combobox losing the a11y roles shadcn `Select` gave for free**. Both are eliminated by construction: extract-don't-fork, and wire `role="combobox"`/`listbox`/`option` net-new.

**Primary recommendation:** Extract the relationship read traversal into `document_relationship_service.get_related_documents(...)` (FastAPI-free, raising nothing — returns a plain dict), refactor `_handle_get_related_documents` to call it (byte-identical agent behavior), add `GET /document-relationships?document_id={id}` to the existing router calling the same function, compute the typeahead candidate exclusion **client-side over a `listDocuments()` fetch** (least-complex correct: per-type exclusion is trivially a client filter, idempotency is the backstop), pre-format inverse labels **in the frontend** from a mirrored map (the backend returns the raw `rel_type` + `direction` + the backend's own `label`; the frontend's display map mirrors `_INVERSE_LABEL` 1:1), and build the typeahead as an input+listbox inside the reused `Dialog`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Leak-safe relationship read (outgoing+incoming traversal, per-viewer mask) | API / Backend (`document_relationship_service`) | — | The SOLE access gate is a per-caller readability re-check (D-117-8); must never run client-side. One implementation shared by the route + the agent tool. |
| GET read endpoint (auth, threadpool-wrapped) | API / Backend (`document_relationships.py` router) | — | Thin wrapper: auth dependency + call the shared service fn + return JSON. No business logic, no fork. |
| Create / remove writes (visible-both gate, idempotent, audit) | API / Backend (Phase 116, already shipped) | — | The POST/DELETE already exist and are leak-safe; 117 only consumes them. |
| Relationships section render (grouped-by-direction, chips, masked rows) | Browser / Client (`DocumentDetailPanel` + new section) | — | Pure presentation of the GET payload; no data transformation that affects access. |
| Inverse-label display strings (snake_case → "Superseded by") | Browser / Client | API / Backend (vocabulary owner) | Backend OWNS the vocabulary (`_INVERSE_LABEL`); client mirrors it 1:1 for display casing. Single source of truth = backend map. |
| Typeahead candidate filtering + self/already-linked exclusion (D-117-4) | Browser / Client | — | Clarity-not-correctness (idempotency is the correctness net); a client filter over the existing `listDocuments()` fetch is the least-complex correct option. |
| Re-fetch reconcile after mutation (D-117-9) | Browser / Client (`onReconcile` / local re-fetch) | — | Mirrors the 112 metadata-edit reconcile posture; Realtime is best-effort (D-v2.5-03). |

## Standard Stack

This phase adds **zero new packages**. Everything is in-repo or already a dependency. The "stack" is the set of existing modules and primitives to reuse.

### Core (backend — Python/FastAPI)
| Module / symbol | Location | Purpose | Why standard |
|---------|----------|---------|--------------|
| `document_relationship_service.py` | `backend/app/services/` | The extraction target — add the shared `get_related_documents(...)` read fn here. | Already holds `_resolve_readable_latest`, `_subject_version_ids`, `_uid`, `create_relationship`, `delete_relationship`. The 115 precedent puts the shared read core in the service module, not the route. |
| `tool_dispatcher._handle_get_related_documents` | `backend/app/services/tool_dispatcher.py:492-649` | The canonical leak-safe traversal to LIFT into the service (then call back from here). | This is the only existing implementation; CR-01/CR-02 hardened it live. Extract its lines 561-649 verbatim. |
| `_INVERSE_LABEL` / `_NO_ACCESS_MASK` | `tool_dispatcher.py:478` / `:489` | The inverse-label vocabulary (D-117-6) + the mask string (D-117-8). | Move these into the shared service module (or import them) so both callers + the frontend's mirror reference one source. |
| `document_relationships.py` router | `backend/app/api/document_relationships.py` | The existing POST/DELETE router; ADD the `GET` route here (mounted in main.py:424). | The 113/114 precedent mounts the read route alongside CRUD in the same router. |
| `aexec` | `backend/app/utils/db.py` | `run_in_threadpool` wrapper for every sync supabase-py call in the async GET route (D-v2.5-01). | Already used by every query in `document_relationship_service.py` — no bare `.execute()` anywhere in that module. |
| `write_audit_entry` | `backend/app/services/audit_service.py` | **DO NOT call from the GET route.** | Confirmed: `VALID_ACTION_TYPES` has only `relationship.create` / `relationship.delete` (audit_service.py:22) — no `relationship.read` enum exists. The agent handler writes no read audit (tool_dispatcher.py:518-520); the GET route follows the same no-read-audit policy AND mirrors the `resolve_view` route, which writes no audit on read. [VERIFIED: codebase grep]

### Core (frontend — React/TS)
| Module / symbol | Location | Purpose | Why standard |
|---------|----------|---------|--------------|
| `DocumentDetailPanel.tsx` | `frontend/src/components/metadata/` | The shared shell; add a `Relationships` `PanelSection` alongside the existing Metadata section. | Phase 112 reserved this slot explicitly (the file's own docstring lines 5-9). Reuse `useIsMobile`, panel-scoped AA tokens, close/focus handling. |
| `PanelSection.tsx` | `frontend/src/components/panel/` | APG accordion (`<button aria-expanded aria-controls>` + `role=region` body) + count/warn badge for the section header. | Already used by the Metadata section; the count badge supports a flat number (D-117 §discretion: optional count/warn badge). |
| `MoveToFolderDialog.tsx` | `frontend/src/components/health/` | The Dialog + confirm + error-line + `loading` shell for the create flow; swap `Select`→typeahead. | SC#2 names this pattern; D-117-3 keeps the shell, swaps the control. |
| `@/components/ui/dialog` | shadcn | Focus-trap + restore come FREE — keep the typeahead INSIDE the Dialog. | Sketch a11y contract: reusing the shadcn Dialog preserves focus-trap+restore the bespoke combobox doesn't provide. |
| `@/lib/api.ts` patterns | `frontend/src/lib/api.ts` | Template for the 3 new client fns (read/create/delete). Closest analogs: `updateDocumentMetadata` (PATCH shape, line 1997), the `document-views` client family (createView/deleteView/resolveView, lines 2038-2112). | Established `getAuthHeaders()` + `fetch` + `res.ok` throw pattern; the `deleteView` 404-tolerant pattern (line 2096) fits the relationship DELETE. |
| `frontend/src/types/index.ts` | — | Add `RelationshipRow` / relationship response types here (the `MetadataFieldDef`/`SavedView` analogs, lines 216/288). | Mirrors the backend response shape; the project's single types module. |
| `vitest-axe` (`axe`) | already a devDependency | Automated WCAG AA assertion (the 112 `DocumentDetailPanel.a11y.test.tsx` pattern). | The frontend Wave-0 home for the AA + honest-states automatable core. |

### Supporting
| Item | Location | When to use |
|---------|----------|-------------|
| `useDocuments().loadDocuments` | `frontend/src/hooks/useDocuments.ts` | The reconcile hook IngestionPage passes as `onReconcile`. For the relationships re-fetch (D-117-9), the section needs its OWN re-fetch of the GET endpoint (not `loadDocuments`, which refreshes the documents list). See §Open Questions Q1. |
| `listDocuments()` | `api.ts:1201` | The typeahead candidate source (D-117-4) — `GET /documents` returns the caller's visible docs; filter self + already-linked client-side. |
| `getFileIcon` | `frontend/src/lib/fileIcons.ts` | Per-row file icon (the DocumentDetailPanel header uses it; relationship rows may reuse for parity). |
| `IngestionPage.tsx` integration | `frontend/src/pages/IngestionPage.tsx:518-523` | Where `<DocumentDetailPanel doc={selectedDoc} onReconcile={loadDocuments} />` mounts — the section ships inside the panel, so no IngestionPage change is required beyond what the panel already gets. |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `GET /document-relationships?document_id={id}` (query param) | `GET /documents/{id}/relationships` (nested under documents router) | Nested-under-documents reads more RESTfully but would touch `documents.py` (a different router) and split relationship endpoints across two files. Query-param on the EXISTING `document_relationships` router keeps all relationship endpoints co-located (the 116 POST/DELETE precedent) and `threads.py`/`documents.py` untouched. **Recommend query-param on the existing router.** |
| Client-side candidate exclusion (over `listDocuments()`) | A server param (`?exclude_linked_with=references`) on the GET/list endpoint | A server param is "more correct" but adds query complexity for a clarity-only feature (idempotency is the real correctness net, D-117-4). The candidate set is the caller's own visible docs — already fetched. **Recommend client-side filter.** |
| Frontend mirrors `_INVERSE_LABEL` display casing | Backend pre-formats the display string ("Superseded by") in the GET payload | Pre-formatting in the backend couples display copy to the API (the sketch may refine casing — D-117-6 note). The backend already returns `direction` + `label` (raw snake_case); the frontend owns DISPLAY casing. **Recommend: backend returns raw `rel_type`+`direction`+`label`; frontend has a tiny display-label map that mirrors `_INVERSE_LABEL` 1:1.** This keeps the vocabulary single-sourced (backend) while letting the sketch tune casing without an API change. |
| Bespoke typeahead (input+listbox) | Add `cmdk` (shadcn Command) dependency | `cmdk` gives APG combobox for free but is a NEW dependency requiring slopcheck + an install gate, and the sketch already specifies the exact roles to wire. For a single picker the bespoke input+listbox (inside the reused Dialog) is lighter and avoids a dependency. **Recommend bespoke** unless the planner prefers the dependency — flag for discuss if so. |

**Installation:** None. No new packages in either ecosystem.

**Version verification:** N/A — no new packages. Existing deps confirmed present: `vitest-axe@^0.1.0`, `@testing-library/react@^16.3.2`, shadcn `dialog`/`select` already in `frontend/src/components/ui`. [VERIFIED: package.json + ui dir read this session]

## Package Legitimacy Audit

> Not applicable — Phase 117 installs **zero external packages** in any ecosystem. All work uses in-repo modules and already-present dependencies. No slopcheck run required.

| Package | Registry | Disposition |
|---------|----------|-------------|
| (none) | — | No new packages — audit vacuously clean. |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────┐
  USER opens a doc       │  IngestionPage  (selectedDocId → selectedDoc)│
  in Documents page  ───▶│  renders <DocumentDetailPanel doc=… />       │
                         └───────────────────┬─────────────────────────┘
                                             │
              ┌──────────────────────────────┴───────────────────────────────┐
              │  DocumentDetailPanel (Phase 112 shell)                          │
              │   ├─ PanelSection "Metadata"      (existing — unchanged)        │
              │   └─ PanelSection "Relationships" (NET-NEW this phase) ◀────┐    │
              └──────────────────────────────┬─────────────────────────────┘    │
                                             │                                  │
                     on mount / after mutation: re-fetch (D-117-9)              │
                                             │                                  │
                              GET /document-relationships?document_id={id}      │
                                             │                                  │
   ┌─────────────────────────────────────────▼──────────────────────────────┐  │
   │  document_relationships.py router  —  NEW thin GET wrapper                │  │
   │   auth (get_current_user) → call shared svc fn → return JSON              │  │
   │   (NO audit write — no relationship.read enum; mirrors resolve_view)      │  │
   └─────────────────────────────────────────┬──────────────────────────────┘  │
                                             │  ALSO called by:                  │
   ┌─────────────────────────────────────────▼──────────────────────────────┐  │
   │  document_relationship_service.get_related_documents(...)  — EXTRACTED   │  │
   │   (FastAPI-free, raises nothing, returns plain dict)                     │  │
   │    1. _resolve_readable_latest(subject)         → caller-readable latest │  │
   │    2. _subject_version_ids(subject)             → full (uid,filename) set│  │
   │    3. outgoing/incoming edge queries (.in_ over version set, aexec)      │  │
   │    4. per-edge OTHER-endpoint readability re-check → mask unseeable       │  │
   │       (_NO_ACCESS_MASK, document_id:null) — THE SOLE access gate         │  │
   └─────────────────────────────────────────┬──────────────────────────────┘  │
                                             │  same fn called in-process by:    │
   ┌─────────────────────────────────────────▼──────────────────────────────┐  │
   │  tool_dispatcher._handle_get_related_documents (agent tool, REL-04)      │  │
   │   refactored to call the shared fn → wraps result as a calm ToolResult   │  │
   │   (BYTE-IDENTICAL agent behavior — same masked rows, same source_refs)   │  │
   └──────────────────────────────────────────────────────────────────────────┘ │
                                                                                  │
   CREATE flow (typeahead dialog)                                                 │
   ───────────────────────────────                                                │
   "+ Add link" (section foot) → CreateLinkDialog (MoveToFolderDialog shell)      │
     rel-type segmented chips ▸ typeahead over listDocuments() (excl. self +      │
     already-linked-with-chosen-type) ▸ confirm                                   │
       → POST /document-relationships {source=openDoc, target=picked, rel_type}   │
       → on 201: re-fetch (D-117-9) ────────────────────────────────────────────┘
   REMOVE flow (either direction)
   ───────────────────────────────
   row ✕ → DELETE /document-relationships/{id} → on 204: re-fetch (D-117-9)
```

### Recommended Project Structure
```
backend/app/
├── services/
│   ├── document_relationship_service.py   # + get_related_documents(...) [EXTRACT TARGET]
│   │                                       #   move/import _INVERSE_LABEL + _NO_ACCESS_MASK here
│   └── tool_dispatcher.py                  # _handle_get_related_documents → call shared fn (behavior preserved)
└── api/
    └── document_relationships.py           # + GET route (thin wrapper, no audit)

frontend/src/
├── components/
│   ├── metadata/
│   │   └── DocumentDetailPanel.tsx         # + <PanelSection "Relationships"> (new section)
│   └── relationships/                      # NEW dir (or under metadata/)
│       ├── RelationshipsSection.tsx        # grouped-by-direction rows + create/remove + states
│       └── CreateLinkDialog.tsx            # MoveToFolderDialog shell, Select→typeahead combobox
├── lib/
│   ├── api.ts                              # + listRelationships / createRelationship / deleteRelationship
│   └── relationshipLabels.ts (optional)    # mirror of _INVERSE_LABEL display casing (D-117-6)
└── types/index.ts                          # + RelationshipRow / RelatedDocumentsResponse types
```

### Pattern 1: Extract-don't-fork the leak-safe read (the D-117-7 core — the 115 precedent)
**What:** Lift `_handle_get_related_documents`'s lines 561-649 (the edge queries + per-endpoint masking) into a new FastAPI-free `document_relationship_service.get_related_documents(caller, *, document_id, filename, supabase)` that returns a plain dict (`{subject, total, documents: [...], source_refs: [...]}`). The agent handler then becomes a thin wrapper: call the shared fn, JSON-dump it into a `ToolResult`. The new GET route calls the same fn and returns the dict directly.
**When to use:** The single most important task in this phase. The leak-safe traversal must have exactly ONE implementation.
**Example (the precedent — `document_view_resolver.py`, the shape to follow):**
```python
# Source: backend/app/services/document_view_resolver.py:153-176 (Phase 115 extraction)
# The route raised HTTPException; the extracted core raises a plain ResolveError (or, for
# relationships, returns calmly — there is no validation-failure raise to begin with).
async def resolve_filter(*, caller: str, flt, folder_scope, count_only, supabase):
    """The SHARED, leak-safe resolve core ... used by BOTH the route module's
    resolve_view / resolve_adhoc endpoints AND the Phase 115 agent tool handler.
    ... Returns the plain-dict, no-response_model shape so rows round-trip the exact
    metadata blob (the 112 CR-01 lesson)."""
    ...
```
**Relationship-specific note:** Unlike `resolve_filter` (which raises `ResolveError` on a bad filter), `get_related_documents` has **no validation-failure path** — a missing/unreadable subject is a calm "not found" return (tool_dispatcher.py:553-559). So the extracted fn can simply RETURN a status dict; the agent handler maps it to its calm `ToolResult` strings, and the route maps `subject is None` → a 404 (or returns an empty-with-flag payload — planner discretion). Keep the agent handler's calm-string contract intact (no raises into the agent loop — the 115 WR-01/WR-03 lesson).

### Pattern 2: Add a `PanelSection` to the existing shell (Phase 112 reservation)
**What:** Render a second `<PanelSection title="Relationships" count={total} ...>` inside `DocumentDetailPanel`'s sections container (after the Metadata section, line 213-230). The section owns its own fetch state for the GET endpoint.
**When to use:** The whole relationship UI is ONE accordion section — never a new surface (the sketch §"What to Avoid").
**Example (the existing Metadata section — the slot to mirror):**
```tsx
// Source: frontend/src/components/metadata/DocumentDetailPanel.tsx:212-231
<div className="min-h-0 flex-1 overflow-y-auto">
  <PanelSection title="Metadata" warn={lowPlusEmpty > 0} count={lowPlusEmpty} defaultOpen>
    {/* field rows */}
  </PanelSection>
  {/* NEW: <PanelSection title="Relationships" count={total}> ... </PanelSection> */}
</div>
```

### Pattern 3: Grouped-by-direction rows with mirrored inverse labels (D-117-5/6)
**What:** Two labeled subgroups inside the section — Outgoing then Incoming. The GET payload already carries `direction` ("outgoing"|"incoming") and the backend's `label` per row. The frontend's display-label map mirrors `_INVERSE_LABEL` for casing.
**Backend vocabulary (the single source of truth — mirror, never invent):**
```python
# Source: backend/app/services/tool_dispatcher.py:478-489
_INVERSE_LABEL = {
    "supersedes": "superseded_by", "amends": "amended_by",
    "references": "referenced_by", "attached_to": "has_attachment",
}
_NO_ACCESS_MASK = "linked document (no access)"
```
**Frontend display mirror (casing only — the vocabulary stays backend-owned):**
```ts
// outgoing chip = rel_type verbatim title-cased; incoming = inverse label spaced+cased.
// MUST stay 1:1 with _INVERSE_LABEL keys (D-117-6).
const OUTGOING_LABEL = { supersedes: "Supersedes", amends: "Amends",
                         references: "References", attached_to: "Attached to" }
const INCOMING_LABEL = { supersedes: "Superseded by", amends: "Amended by",
                         references: "Referenced by", attached_to: "Has attachment" }
```

### Pattern 4: Create dialog = MoveToFolderDialog shell, Select→typeahead combobox (D-117-3)
**What:** Keep the `Dialog` + `loading` confirm + error-line shell; replace the `Select` with a rel-type segmented chip row (type-first) + a filterable input + a listbox of candidates. Confirm disabled until a target is chosen.
**When to use:** The create flow only (remove is a per-row ✕, no dialog).
**Example (the shell to keep — MoveToFolderDialog):**
```tsx
// Source: frontend/src/components/health/MoveToFolderDialog.tsx:59-94
<Dialog open={open} onOpenChange={(v) => { if (!v) onClose() }}>
  <DialogContent>
    <DialogHeader><DialogTitle>...</DialogTitle></DialogHeader>
    <div className="py-2 space-y-3">
      {/* Select goes here → replaced by rel-type chips + typeahead listbox */}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
    <DialogFooter>
      <Button variant="outline" onClick={onClose} disabled={loading}>Cancel</Button>
      <Button onClick={handleConfirm} disabled={!target || loading}>
        {loading ? "Linking..." : "Add link"}
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
**Combobox a11y (net-new — the Select gave these for FREE; the bespoke input must wire them):** `role="combobox"` + `aria-expanded`/`aria-controls`/`aria-activedescendant` on the input; `role="listbox"` on the list; `role="option"` + unique id per candidate; highlighted row = `aria-activedescendant`. Keep the input INSIDE the shadcn `Dialog` so focus-trap + restore come free. [CITED: references/document-relationships-panel.md §A11y contract]

### Pattern 5: Re-fetch reconcile after mutation (D-117-9, the 112 posture)
**What:** After a successful POST (201) or DELETE (204), re-fetch the relationships GET for the open document and re-render. NO optimistic splice, NO Undo. The honest beat is a brief `↻ updating` (`role="status"`) then the fresh list.
**Why:** Only the server can compute follow-to-latest resolution, inverse labels, and no-access masking correctly — an optimistic row would mis-render before the reconcile corrects it (a dishonest flicker on a trust-load-bearing surface). Mirrors `DocumentDetailPanel.handleCommit` (line 172-188): success → reconcile; error → honest inverse.

### Anti-Patterns to Avoid
- **Forking the leak-safe read into the GET route** — re-opens the SC#2 leak the secure-phase two-user test exists to catch (the 101/104 false-green class, the 115 fork-warning). Extract, then call from both.
- **A new surface for relationships** — it is ONE `PanelSection` in the existing panel.
- **Inventing inverse labels or the "no access" wording** — mirror the backend maps verbatim (D-117-6/8).
- **Symmetric create** ("X supersedes this" from this panel) — create is outgoing-only; remove is either-direction. Lock the asymmetry.
- **Optimistic splice / an "Undo" affordance** — mutation is re-fetch; Undo lies about reversibility (the fidelity audit killed it, D-117-9).
- **Leaking id/title on a masked row, or rendering it as an error/empty** — the masked row is a real-but-unreadable link.
- **A plain `Select` for the picker** (dies past ~30 docs) or an inline-in-accordion create form (rejected sketch foil C — deviates from D-117-3).
- **Hover-only remove ✕** — unreachable on touch/keyboard (WCAG 2.4.7 fail); the audit's #1 fix. Wire `:focus-visible` + `@media (pointer:coarse)` always-on.
- **Writing a `relationship.read` audit row** — no such enum exists; the read is a pure traversal (matches the agent tool + the resolve route).
- **Touching `threads.py`** — G-5 extension contract; this phase never touches the shared SSE/agent-loop path.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Leak-safe outgoing+incoming traversal | A second copy of the edge queries + masking in the route | EXTRACT `tool_dispatcher.py:561-649` into `document_relationship_service.get_related_documents` and call from both | A fork is the one thing that quietly re-opens the cross-user leak (the 115 D-115-6 rationale, verbatim applicable). |
| Follow-to-latest over re-uploads | A new version-lineage lookup | `document_relationship_service._subject_version_ids` (already CR-02-hardened) | The full `(user_id, filename)` version-id set is already computed; the edge queries already use `.in_()` over it. |
| Per-viewer readability re-check | A new "can this caller see X" check | `document_relationship_service._resolve_readable_latest` (CR-01-hardened: is_latest-gate + post-follow folder re-check) | The SOLE access gate; a parallel implementation drifts and leaks. |
| Accordion + count badge + a11y | A new collapsible | `PanelSection` (`<button aria-expanded aria-controls>` + `role=region`) | APG-correct already; the Metadata section uses it. |
| Dialog focus-trap + restore | Manual focus management on the bespoke combobox | The shadcn `Dialog` (keep the input inside it) | Focus-trap+restore come free; the bespoke combobox only needs the listbox roles. |
| Mobile bottom-sheet | A new responsive layout | `useIsMobile` + the `Sheet`/`SheetContent side="bottom"` shape (DocumentDetailPanel:236-246) | The panel + dialog mobile shape is solved. |
| Auth + threadpool wrapping in the GET route | Bare supabase calls | `Depends(get_current_user)` + `aexec` for every query | D-v2.5-01: no blocking I/O in async handlers; the service module already has zero bare `.execute()`. |
| Client API fetch boilerplate | A new fetch wrapper | `getAuthHeaders()` + `fetch` + `res.ok` throw (the api.ts convention) | `updateDocumentMetadata` / `deleteView` are exact templates. |

**Key insight:** This phase is ~90% reuse. The genuinely net-new code is: (1) the extracted shared read fn (a mechanical lift of existing, tested lines), (2) the thin GET route, (3) the typeahead combobox roles, (4) the section render. Everything else has a shipped, hardened precedent in this repo.

## Runtime State Inventory

> This is a feature phase (net-new GET endpoint + frontend), NOT a rename/refactor/migration. The one "refactor" aspect — extracting the agent handler's read logic into the service — carries no runtime state risk because it preserves behavior byte-for-byte and touches no stored data. Included for completeness because D-117-7 moves code.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — the GET read is a pure traversal; no new tables, no migration (the `document_relationships` table + RLS shipped in migration 071, idempotency index in 075). | None. |
| Live service config | None — no external service config references relationship reads. | None. |
| OS-registered state | None. | None. |
| Secrets/env vars | None — the GET route uses the existing JWT auth + service-role supabase client. | None. |
| Build artifacts | None — no package rename, no egg-info. The extraction is an in-module code move; if `_INVERSE_LABEL`/`_NO_ACCESS_MASK` move modules, update the agent handler's import (a code edit, not an artifact). | Update import sites if constants move; verified only `tool_dispatcher.py` references them today. |

**Behavior-preservation contract for the extraction:** The agent tool's output (masked rows, `source_refs`, `direction`/`label` fields, calm-string contract) MUST stay byte-identical. The 116 test suite is the regression backstop — re-run `test_116_tool_leak.py`, `test_116_tool_read.py`, `test_116_handler.py`, `test_116_version_stable.py` after the extraction; all must stay green (35/35 live on :54322 per STATE.md).

## Common Pitfalls

### Pitfall 1: Forking the leak-safe read (re-opening SC#2)
**What goes wrong:** Implementing the edge queries + masking fresh in the GET route "because it's simpler than refactoring," producing two implementations that drift.
**Why it happens:** The agent handler's logic is tangled with `ToolResult`/`source_refs` packaging; it's tempting to copy the access-gating parts and skip the rest.
**How to avoid:** Extract ONCE into the service (the 115 move), call from both. The `get_related_documents` fn returns a plain dict; the agent handler does the `ToolResult` packaging, the route does the JSON return.
**Warning signs:** Any `_resolve_readable_latest` call, any `.in_(version_ids)` edge query, or the literal `"linked document (no access)"` appearing in `document_relationships.py` (the route). It must appear ONLY in the service.

### Pitfall 2: The new combobox loses APG roles the Select gave for free
**What goes wrong:** Swapping shadcn `Select` for a bare `<input>` + `<div>` list drops `role=combobox/listbox/option` + the activedescendant wiring → keyboard + screen-reader users can't operate the picker → WCAG fail, blocking UX-01.
**Why it happens:** The `Select` was accessible by default; the swap silently removes that.
**How to avoid:** Wire the roles net-new (Pattern 4). Keep the input inside the shadcn `Dialog` for focus-trap+restore. Assert the roles in the `vitest-axe` test.
**Warning signs:** `vitest-axe` violations on the dialog; arrow keys don't move a highlight; no `aria-activedescendant` updates.

### Pitfall 3: Hover-only remove ✕ (unreachable on touch/keyboard)
**What goes wrong:** Revealing the remove control only on `:hover` → invisible on the `<768px` bottom-sheet (no hover) and unreachable by keyboard → the destructive either-direction remove (incl. masked rows) is unusable.
**Why it happens:** Hover-reveal looks clean in a desktop mockup.
**How to avoid:** `.rel-row:hover .rel-x, .rel-row:focus-within .rel-x, .rel-x:focus-visible { opacity:1 }` PLUS `@media (pointer:coarse){ .rel-x{opacity:1} }`. The audit's #1 pre-lock fix. [CITED: references/document-relationships-panel.md §A11y]
**Warning signs:** Remove button has 0 opacity at rest with no focus/coarse-pointer override; can't tab to it.

### Pitfall 4: Optimistic render mis-states masking / direction / inverse-label
**What goes wrong:** Optimistically splicing a created link into the list before re-fetch → the optimistic row guesses the inverse label / can't compute masking / mis-shows direction → a wrong row flickers on a trust surface.
**Why it happens:** Optimistic feels snappier.
**How to avoid:** Re-fetch, don't splice (D-117-9). Brief `↻ updating` (`role=status`) then the server's truth. NO Undo.
**Warning signs:** A new row appears with a client-guessed label; an "Undo" button.

### Pitfall 5: Re-fetch scope confusion (documents list vs relationships list)
**What goes wrong:** Calling IngestionPage's `onReconcile` (=`loadDocuments`, which refreshes the DOCUMENTS array) and expecting the relationships to refresh — they won't; the relationships come from the separate GET endpoint.
**Why it happens:** The 112 metadata edit reconciles via `loadDocuments` because metadata lives ON the document row; relationships do NOT.
**How to avoid:** The `RelationshipsSection` owns its own re-fetch of `listRelationships(docId)` triggered after each mutation. `onReconcile` is irrelevant to relationships (metadata edits don't change relationships). See §Open Questions Q1.
**Warning signs:** Create succeeds (201) but the list doesn't update until panel reopen.

### Pitfall 6: Self / already-linked candidate leaks into the typeahead
**What goes wrong:** The picker shows the open doc itself (a self-link → uniform 422) or a doc already linked with the chosen type (idempotent no-op → "why did nothing happen?").
**Why it happens:** Forgetting the per-type exclusion (D-117-4) — and the exclusion must RE-COMPUTE when the rel-type chip changes.
**How to avoid:** Filter `listDocuments()` client-side: drop `doc.id === openDocId` always; drop any candidate already in the current outgoing edges WITH the currently-selected rel_type. Re-derive on rel-type change. Show the honest "N already … — hidden so every pick is actionable" note.
**Warning signs:** The open doc appears in its own picker; a previously-linked doc re-appears for the same type.

## Code Examples

### The GET route (recommended shape — thin wrapper, no audit)
```python
# Source pattern: backend/app/api/document_views.py:202-260 (resolve_view — readability + no audit on read)
# NEW in backend/app/api/document_relationships.py
@router.get("")  # GET /document-relationships?document_id={id}
async def get_relationships(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    supabase: Client = Depends(get_supabase),
):
    """List a document's outgoing + incoming typed links for the panel (REL-02).

    Calls the SHARED leak-safe read core (D-117-7) — the SAME fn the agent tool uses,
    so masking/follow-to-latest never forks. NO audit (no relationship.read enum;
    mirrors resolve_view, which writes no audit on read). 404 if the subject is
    unreadable/unknown (no existence leak — uniform with the rest of the surface).
    """
    result = await document_relationship_service.get_related_documents(
        current_user["id"], document_id=document_id, supabase=supabase
    )
    if result is None:  # subject unreadable/unknown
        raise HTTPException(status_code=404, detail="Document not found")
    return result  # plain dict: {subject, total, documents:[...], source_refs:[...]}
```

### The agent handler after extraction (behavior preserved)
```python
# backend/app/services/tool_dispatcher.py — _handle_get_related_documents becomes a thin wrapper
# (keep the calm-string contract for no-subject / not-found; the 115 WR-01/WR-03 lesson).
result = await document_relationship_service.get_related_documents(
    caller, document_id=doc_id, filename=filename, supabase=ctx.supabase
)
# ... map result-or-None to the existing calm ToolResult JSON strings + source_refs.
```

### The 3 client fns (api.ts — the document-views family is the template)
```ts
// Source pattern: frontend/src/lib/api.ts:1997 (PATCH) + :2090 (deleteView 404-tolerant)
export async function listRelationships(documentId: string): Promise<RelatedDocumentsResponse> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships?document_id=${documentId}`, { headers })
  if (!res.ok) throw new Error("Failed to load relationships")
  return res.json() as Promise<RelatedDocumentsResponse>
}
export async function createRelationship(
  source_doc_id: string, target_doc_id: string, rel_type: RelType,
): Promise<Relationship> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships`, {
    method: "POST", headers,
    body: JSON.stringify({ source_doc_id, target_doc_id, rel_type }),
  })
  if (!res.ok) throw new Error("Failed to create link")  // 422 = unseeable/self/forged
  return res.json() as Promise<Relationship>
}
export async function deleteRelationship(id: string): Promise<void> {
  const headers = await getAuthHeaders()
  const res = await fetch(`${API_BASE}/document-relationships/${id}`, { method: "DELETE", headers })
  if (!res.ok && res.status !== 404) throw new Error("Failed to remove link")  // 404-tolerant
}
```

### The relationship response types (types/index.ts — the SavedView analog)
```ts
// Mirrors the GET payload from document_relationship_service.get_related_documents.
export type RelType = "supersedes" | "amends" | "references" | "attached_to"
export interface RelationshipRow {
  /** null when the OTHER endpoint is masked (D-117-8 — never leaks id/title). */
  document_id: string | null
  filename: string               // real filename OR "linked document (no access)"
  rel_type: RelType
  direction: "outgoing" | "incoming"
  label: string                  // backend's raw label (rel_type | inverse) — display map mirrors casing
  /** the relationship row id, for the remove ✕ (DELETE /{id}). */
  relationship_id?: string
}
export interface RelatedDocumentsResponse {
  subject: { document_id: string; filename: string }
  total: number
  documents: RelationshipRow[]
}
```
**IMPORTANT (planner must verify):** The agent handler's current compact rows (tool_dispatcher.py:612-626) do NOT include the relationship `id` — they expose `document_id`/`filename`/`rel_type`/`direction`/`label` only. The PANEL needs the `relationship_id` to power the remove ✕ (DELETE takes the row id). The extracted `get_related_documents` fn must additionally carry `edge["id"]` through to each row (the edge queries already `select("id, ...")` at tool_dispatcher.py:575/581 — the `id` is fetched but dropped in `_append_edge`). Carrying it through is additive and does not change the agent tool's behavior (the agent doesn't use it but an extra field is harmless — verify against `test_116_tool_read.py` assertions to ensure no strict-shape test breaks; if one does, gate the `id` behind the route's response shaping). This is the one substantive shape change the extraction introduces. [VERIFIED: tool_dispatcher.py:575,581,612-626 read this session]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Leak-safe logic duplicated per consumer | Extract the core into a FastAPI-free service module; route + tool both call it | Phase 115 (`document_view_resolver.py`) | The established pattern this phase follows for D-117-7. |
| Ad-hoc keystroke writes via createView→resolve→deleteView | A stateless resolve endpoint with NO audit write | Phase 114 CR-01 | Confirms: read/resolve endpoints write no audit — the GET route follows suit. |
| `Object.keys(metadata)` raw iteration | Render a known field set; preserve `extra="allow"` blobs | Phase 112 CR-01 | For relationships: trust the server's row shape; don't strip fields with a tight response_model on the read (return a plain dict). |

**Deprecated/outdated:** None relevant. The relationship backend is days old (Phase 116, 2026-06-20) and current.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `GET /document-relationships?document_id={id}` (query param on the existing router) is the best route shape. | Standard Stack / Code Examples | LOW — the planner may prefer `GET /documents/{id}/relationships`; both satisfy D-117-7. Recommendation, not a lock. |
| A2 | Client-side candidate exclusion over `listDocuments()` is least-complex correct. | Architectural Map / Pitfall 6 | LOW — idempotency is the correctness net (D-117-4 explicitly); a server param is the alternative if the docs list is very large. |
| A3 | Frontend owns inverse-label DISPLAY casing (backend returns raw `label`); a tiny mirror map handles "Superseded by". | Architecture Pattern 3 | LOW — D-117-6 explicitly leaves this to discretion + notes the sketch may refine casing. Backend stays the vocabulary source. |
| A4 | A bespoke input+listbox typeahead (no `cmdk` dependency) is preferred. | Alternatives Considered | MEDIUM — if the planner/operator wants the `cmdk` dependency for robustness, that adds a package-legitimacy gate. Flag at plan time. |
| A5 | The relationships section owns its OWN re-fetch (not IngestionPage's `loadDocuments`). | Pitfall 5 / Open Q1 | LOW — relationships are not on the document row; `loadDocuments` can't refresh them. Verified by reading useDocuments + IngestionPage. |
| A6 | Carrying the edge `id` through to each row does not break the 116 tool tests. | Code Examples (IMPORTANT note) | MEDIUM — must be verified against `test_116_tool_read.py` strict-shape assertions during execution; if a test asserts exact keys, shape the `id` only into the route payload. |

**Note:** Assumptions A1–A6 are all explicitly within the CONTEXT.md "discretion" surface or are additive. No assumed compliance/security/retention claims.

## Open Questions

1. **Where does the relationships re-fetch live — the section's own state, or lifted to IngestionPage?**
   - What we know: The 112 metadata reconcile uses IngestionPage's `loadDocuments` because metadata is on the doc row. Relationships are a separate GET.
   - What's unclear: Whether to keep all fetch state local to `RelationshipsSection` (simplest) or lift it for testability.
   - Recommendation: Keep fetch + re-fetch state LOCAL to `RelationshipsSection`, keyed on `doc.id` (re-fetch on mount + after each mutation). This isolates the new code from the panel shell and matches the section-owns-its-data posture. The panel passes only `doc.id` (+ optionally `doc.filename` for the subject header).

2. **Does the GET return masked rows for the SUBJECT being unreadable, or 404?**
   - What we know: The agent handler returns a calm "not found" when the SUBJECT is unreadable (tool_dispatcher.py:553-559). The panel only opens for a doc the user can already see (it's in their own documents list), so an unreadable subject is essentially impossible from the panel.
   - What's unclear: The exact route response for the (near-impossible) unreadable-subject case.
   - Recommendation: 404 on unreadable/unknown subject (uniform with the rest of the leak-safe surface, no existence leak). The panel never hits this in practice; the error state (D-117-10) covers any transport failure.

3. **Should the response_model be a typed Pydantic model or a plain dict?**
   - What we know: The 112 CR-01 lesson (response_model with `extra="ignore"` silently strips fields) led 113/114/115 to return plain dicts on read paths.
   - What's unclear: Whether a typed `RelatedDocumentsResponse` Pydantic model is safe here (the rows are a fixed, small shape, not an open metadata blob).
   - Recommendation: A plain dict is safest and matches the resolve-route precedent; the relationship row shape is small and fixed, so a Pydantic model is also acceptable IF it declares every field (incl. the nullable masked `document_id`). Plain dict avoids the class of bug entirely — recommend plain dict.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Local Supabase (Postgres :54322) | Live two-user leak test, create/remove/re-fetch live tests | ✓ (per STATE.md — 116 ran 35/35 live on :54322) | local CLI stack | — |
| `document_relationships` table + RLS + idempotency index | The GET read, create/remove | ✓ (migrations 071 + 075 applied live, STATE.md 116-04) | — | — |
| Python venv + pytest + asyncpg | Backend integration tests | ✓ (116 suite runs) | pytest.ini present | — |
| Node + vitest + vitest-axe | Frontend unit + a11y tests | ✓ | vitest@^4.1.0, vitest-axe@^0.1.0 | — |
| Chrome MCP (for G-4 lived-experience UAT) | Manual two-user + a11y + mobile UAT | ✓ (used in 100/112 UAT) | — | manual browser if MCP down |

**Missing dependencies with no fallback:** None.
**Missing dependencies with fallback:** None — all infrastructure for both automated and live UAT is present.

## Validation Architecture

> nyquist_validation is enabled (`.planning/config.json` workflow.nyquist_validation: true). This section scaffolds VALIDATION.md.

### Test Framework
| Property | Value |
|----------|-------|
| Backend framework | pytest + pytest-asyncio + asyncpg (live :54322); config `backend/pytest.ini` |
| Frontend framework | vitest@^4.1.0 + @testing-library/react@^16.3.2 + vitest-axe@^0.1.0; config `frontend/vitest.config.ts` |
| Backend quick run | `cd backend && venv/Scripts/python -m pytest tests/integration/test_117_*.py tests/unit/test_117_*.py -x` |
| Backend regression (116 preservation) | `cd backend && venv/Scripts/python -m pytest tests/ -k "116 or 117"` |
| Frontend quick run | `cd frontend && npm run test -- RelationshipsSection CreateLinkDialog` |
| Full backend suite | `cd backend && venv/Scripts/python -m pytest tests/` |
| Full frontend suite | `cd frontend && npm run test` |

### Phase Requirements → Test Map
| Req / SC | Behavior | Test Type | Automated Command | File Exists? |
|----------|----------|-----------|-------------------|--------------|
| SC#1 / D-117-8 | Two-user leak: masked target shows "linked document (no access)", never id/title, via the ROUTE (not just the tool) — LIVE | integration (live) | `pytest tests/integration/test_117_route_leak.py -x` | ❌ Wave 0 |
| SC#1 (regression) | The extraction preserves the agent tool's masking byte-identically | integration (live) | `pytest tests/integration/test_116_tool_leak.py tests/integration/test_116_tool_read.py -x` | ✅ (116 — must stay green) |
| SC#1 | GET returns outgoing + incoming rows with `direction`+`label`+`relationship_id` over the subject's full version set (follow-to-latest) | integration (live) | `pytest tests/integration/test_117_get_read.py -x` | ❌ Wave 0 |
| SC#1 | Shared `get_related_documents` is called by BOTH route + agent handler (no fork) — grep guard | unit | `pytest tests/unit/test_117_no_fork.py -x` (asserts the mask string + edge query appear only in the service, not the route) | ❌ Wave 0 |
| SC#2 | Create via POST (visible-both gate) → 201 → re-fetch reflects the new link live | integration (live) | `pytest tests/integration/test_117_get_read.py::test_created_link_appears -x` | ❌ Wave 0 |
| SC#2 | Remove via DELETE (either direction) → 204 → re-fetch reflects removal live | integration (live) | (same file) | ❌ Wave 0 |
| SC#2 | RelationshipsSection re-fetches after create/remove (not optimistic; no Undo) | frontend unit | `npm run test -- RelationshipsSection` | ❌ Wave 0 |
| SC#2 | Typeahead excludes self + already-linked-with-chosen-type; re-derives on rel-type change | frontend unit | `npm run test -- CreateLinkDialog` | ❌ Wave 0 |
| SC#3 | No aXe AA violations on the section (populated/empty/loading/error/masked states) | frontend a11y | `npm run test -- RelationshipsSection.a11y` | ❌ Wave 0 |
| SC#3 | Combobox roles wired (combobox/listbox/option + activedescendant); remove ✕ keyboard+coarse-pointer reachable | frontend a11y | (same a11y file) | ❌ Wave 0 |
| SC#3 / D-117-10 | Honest-states matrix: empty ≠ error ≠ loading; masked row is not an error/empty | frontend unit | `npm run test -- RelationshipsSection` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the relevant `test_117_*` file(s) for the task, `-x`.
- **Per wave merge:** full `test_117_*` set + the 116 regression set (`-k "116 or 117"`) + `npm run test` for touched frontend files.
- **Phase gate:** full backend suite + full frontend suite green before `/gsd:verify-work`. The LIVE two-user route leak test + create/remove/re-fetch live tests must be confirmed non-vacuous (run against :54322, not mocked) — the D-102/D-110-5 "static would false-green" discipline (reaffirmed by 113/115/116).

### Honest-states matrix (D-117-10 — each is a distinct render, assert all four)
| State | Render | Assertion |
|-------|--------|-----------|
| populated | grouped Outgoing/Incoming rows + chips | rows present, correct direction labels |
| empty | "No relationships yet" + inline `+ Add link` | NOT an error; the create affordance is present |
| loading | skeleton / quiet `↻` (no layout jump) | `role="status"`; no error text |
| error | "couldn't load relationships" `role="alert"` | distinct from empty — never a silent empty reading as "no links" |
| no-access (masked) | "linked document (no access)", `document_id:null` | never id/title; still carries a remove ✕; not an error/empty |

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_117_route_leak.py` — the LIVE two-user route leak proof (clone `test_116_tool_leak.py`'s asyncpg harness; drive the ROUTE/shared fn, not just the tool) — covers SC#1/D-117-8.
- [ ] `backend/tests/integration/test_117_get_read.py` — GET returns outgoing+incoming over the version set + follow-to-latest + create-appears/remove-reflects live — covers SC#1/SC#2.
- [ ] `backend/tests/unit/test_117_no_fork.py` — grep-guard that the mask string + edge query live ONLY in the service, not the route (the D-117-7 share-don't-fork invariant) — clone the 113/116 source-grep guard pattern.
- [ ] `frontend/src/components/relationships/RelationshipsSection.test.tsx` — grouped render, honest-states matrix, re-fetch-after-mutation (no optimistic, no Undo).
- [ ] `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx` — `vitest-axe` no AA violations across all states; combobox roles; remove reachability (clone `DocumentDetailPanel.a11y.test.tsx`).
- [ ] `frontend/src/components/relationships/CreateLinkDialog.test.tsx` — per-type candidate exclusion + re-derive on rel-type change + disabled-until-target confirm + error line.
- [ ] Framework install: none — pytest + vitest + vitest-axe all present.
- [ ] **Regression backstop:** confirm the 116 tool suite stays green after the extraction (`test_116_tool_leak`, `test_116_tool_read`, `test_116_handler`, `test_116_version_stable`).

### G-4 lived-experience UAT (NOT SC#10 4-axis — this phase touches no streaming/agent-loop/provider-routing, same reasoning as Phase 112 D-08)
Operator-driven, Chrome MCP + DB-verified:
1. Open a doc with both outgoing + incoming links → see grouped sections, correct chips/inverse labels, a masked "no access" row (seed a two-user scenario so one target is unreadable).
2. Create a link via the typeahead (type-first chips → filter → confirm) → list re-fetches, the new outgoing row appears; switching rel-type changes the candidate set; self is never offered.
3. Remove an incoming link → DELETE → re-fetch reflects the removal; remove a masked row's ✕ (you own the edge) → reflects.
4. Mobile (<768px) bottom-sheet: section + create dialog usable; remove ✕ visible (coarse-pointer always-on).
5. Two-user LIVE leak proof: User B viewing a shared subject sees the masked row for a target only A can read — verified in the browser AND in the DB (not via the RLS label).

## Security Domain

> `security_enforcement` is not set to `false` in `.planning/config.json` → enabled (absent = enabled). This is a REST + React surface — no auth/session/crypto net-new (all inherited).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | inherited | `Depends(get_current_user)` on the GET route (JWT) — same as every other route. No net-new auth. |
| V3 Session Management | no | Stateless JWT per request; nothing new. |
| V4 Access Control | **yes (THE category)** | Per-viewer readability re-check in `_resolve_readable_latest` is the SOLE access gate (D-117-8). The GET route MUST scope from the CALLER, never the subject/edge owner. Own-scoped edge queries (`.eq("user_id", _uid(caller))`). Verify LIVE two-user (the D-102/D-110-5 rule). |
| V5 Input Validation | yes | `document_id` query param → `_resolve_readable_latest` does EXACT own-or-global match (no partial ilike, the probe-surface anti-pattern) → unknown/unseeable id → 404 (no existence leak). `_uid()` UUID-coerces any value interpolated into a PostgREST `.eq()` predicate (service-role client bypasses RLS, so app predicates are the gate). Frontend is NOT a trust boundary (client exclusion is clarity-only). |
| V6 Cryptography | no | No crypto. |

### Known Threat Patterns for {FastAPI + React + service-role supabase}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Cross-user relationship/document leak via the new GET (the SC#2 invariant) | Information Disclosure | Per-viewer readability re-check (shared `_resolve_readable_latest`); mask unseeable as "no access" with `document_id:null`; caller-scoped edge queries. **Verify LIVE two-user, never via RLS label.** |
| Forking the leak-safe read into the route (drift re-opens the leak) | Information Disclosure | Extract-don't-fork (D-117-7); the `test_117_no_fork.py` grep guard + the live route leak test. |
| Existence-probe oracle via the GET (404 vs 200 distinguishing private docs) | Information Disclosure | Uniform 404 on unreadable/unknown subject (EXACT match resolver; no partial ilike — the documented probe-surface anti-pattern, D-116-3). |
| Service-role client bypasses RLS → a malformed `user_id` predicate scoping leak | Tampering / Elevation | `_uid()` UUID-coercion (already in the service) on every owner-scoping predicate; the GET route reuses the service, never builds its own query. |
| SSTI / SQL injection via filter value | Tampering | N/A — the GET takes only a `document_id` (no filter AST); no string interpolation into SQL. |
| DoS via blocking I/O in the async route | Denial of Service | `aexec`/run_in_threadpool around every supabase call (D-v2.5-01); the service module has zero bare `.execute()`. |
| XSS via a relationship filename in the rendered row | Tampering (client) | React escapes by default; filenames render as text, never `dangerouslySetInnerHTML`. |

**Secure-phase note:** The mandatory deliverable is the LIVE two-user ROUTE leak test (mirroring `test_116_tool_leak.py` but driving the new GET / shared fn). The 116 tool-leak test proves the TOOL boundary; 117 must additionally prove the ROUTE boundary, because the route is the net-new caller of the shared core. The RLS label and the caller-scope code comment are NOT proof.

## Sources

### Primary (HIGH confidence — read this session)
- `backend/app/services/tool_dispatcher.py:470-649` — `_INVERSE_LABEL`, `_NO_ACCESS_MASK`, `_handle_get_related_documents` (the extraction source).
- `backend/app/services/document_relationship_service.py` (full) — `_resolve_readable_latest`, `_subject_version_ids`, `_uid`, `create_relationship`, `delete_relationship`.
- `backend/app/api/document_relationships.py` (full) — the POST/DELETE router (where the GET lands).
- `backend/app/services/document_view_resolver.py` (full) — the Phase 115 extraction precedent (the exact shape for D-117-7).
- `backend/app/api/document_views.py` (full) — the resolve route (no-audit-on-read + readability-gate precedent).
- `backend/app/services/audit_service.py:13-24` — `VALID_ACTION_TYPES` (confirms no `relationship.read` enum).
- `backend/app/models/document_relationship.py` (full) — the `RelationshipCreate`/`RelationshipResponse` shapes + the directionality contract.
- `backend/tests/integration/test_116_tool_leak.py` (full) — the live two-user leak harness to clone for the route leak test.
- `frontend/src/components/metadata/DocumentDetailPanel.tsx` (full) — the shell + section slot + reconcile + a11y posture.
- `frontend/src/components/panel/PanelSection.tsx` (full) — the accordion + count/warn badge.
- `frontend/src/components/health/MoveToFolderDialog.tsx` (full) — the dialog/confirm/error shell.
- `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx:1-50` — the vitest-axe a11y test pattern.
- `frontend/src/lib/api.ts:1201,1997,2008-2112` — listDocuments + updateDocumentMetadata + document-views client family.
- `frontend/src/hooks/useDocuments.ts` (full) + `frontend/src/pages/IngestionPage.tsx:518-523` — the reconcile/onReconcile wiring.
- `frontend/src/types/index.ts:216,288,307-328` — MetadataFieldDef/SavedView/Document type analogs.
- `.claude/skills/sketch-findings-agentic-rag/references/document-relationships-panel.md` (full) — the LOCKED G-2 sketch (034+035 winner A, audit-hardened).
- `.planning/phases/117-document-relationships-panel-ui/117-CONTEXT.md` — the 11 D-117 decisions.
- `.planning/config.json` — nyquist_validation: true, commit_docs: true, use_worktrees: true.

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` (lines 1-104) — Phase 116 execution record (35/35 live on :54322, migrations 071+075 applied, threads.py byte-untouched).

### Tertiary (LOW confidence)
- None — all claims grounded in primary source read this session.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new packages; every reuse target read in source this session.
- Architecture (D-117-7 extraction): HIGH — the Phase 115 `document_view_resolver.py` precedent is exact and read in full.
- Pitfalls: HIGH — drawn from the audit-hardened sketch + the 112/113/115/116 lessons in source/STATE.
- Security: HIGH — the leak-safe primitives are already CR-01/CR-02 hardened and live-proven; the only net-new is proving the ROUTE boundary (a known, scoped task).
- The one MEDIUM spot: A4 (cmdk vs bespoke typeahead) and A6 (carrying edge `id` through without breaking 116 strict-shape tests) — both flagged for plan-time verification.

**Research date:** 2026-06-20
**Valid until:** 2026-07-20 (stable — in-repo modules, no fast-moving external deps; the relationship backend is days-old and current)
