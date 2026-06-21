---
phase: 117-document-relationships-panel-ui
plan: 03
subsystem: ui
tags: [frontend, typescript, types, api-client, document-relationships, REL-02, interface-first]

# Dependency graph
requires:
  - phase: 117-01
    provides: "document_relationship_service.get_related_documents — the shared leak-safe GET read payload shape ({subject, total, documents[], source_refs}; rows carry direction/label/relationship_id + nullable document_id for masked rows)"
  - phase: 117-02
    provides: "GET /document-relationships?document_id= route (thin wrapper, uniform 404, plain dict — no response_model) the listRelationships client fn binds to"
  - phase: 116
    provides: "POST /document-relationships (RelationshipResponse) + DELETE /{id} (own-scoped, 404 on miss) the create/delete client fns bind to; RelationshipCreate.rel_type Literal the RelType union mirrors"
provides:
  - "RelType / RelationshipRow / RelatedDocumentsResponse / Relationship TS types in types/index.ts mirroring the backend payloads (masked-row nullable document_id encoded — D-117-8 type-level leak guard)"
  - "listRelationships / createRelationship / deleteRelationship client fns in api.ts (read / create / 404-tolerant delete) — the typed seam Plan 04 components consume"
affects: [117-04, document-relationships-panel, RelationshipsSection, CreateLinkDialog]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Interface-first foundation: types + client fns defined before the components implement against them (no scavenger hunt for Plan 04)"
    - "Type-level leak guard — RelationshipRow.document_id is `string | null` so the masked row's null cannot be accidentally rendered as a leaked id (D-117-8 encoded in the type)"
    - "Client fns mirror the document-views family conventions (getAuthHeaders + fetch + throw-on-non-ok; the 404-tolerant DELETE from deleteView)"

key-files:
  created: []
  modified:
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts

key-decisions:
  - "relationship_id typed OPTIONAL (`relationship_id?: string`) per the plan spec, even though get_related_documents ALWAYS sets it on every row — a superset-safe contract (consumer null-checks; a row without it simply has no remove affordance). Documented, not a drift."
  - "RelationshipRow dropped from the api.ts type import (unused by the 3 fns; noUnusedLocals + verbatimModuleSyntax would error) — the type is still exported from types/index.ts for Plan 04's components."

patterns-established:
  - "Type-level masked-row leak guard: nullable document_id (D-117-8) — the UI cannot render a leaked id without a type error"
  - "DM client-fn family grouping: relationship fns placed adjacent to the document-views fns, same fetch-wrapper conventions"

requirements-completed: [REL-02]

# Metrics
duration: 8min
completed: 2026-06-20
---

# Phase 117 Plan 03: Frontend Relationship Types + API Client Seam (REL-02) Summary

**The interface-first frontend seam for the Relationships panel: 4 TS types mirroring the backend GET/POST payloads exactly (masked-row nullable `document_id` encoded as a type-level leak guard) + the 3 client fns (`listRelationships` / `createRelationship` / `deleteRelationship`) the Plan 04 components implement against — `tsc` clean, zero new deps.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-20T19:13:30Z
- **Completed:** 2026-06-20T19:21:37Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- **Typed contracts mirroring the backend payloads EXACTLY** (`types/index.ts`): `RelType`
  (the closed `"supersedes" | "amends" | "references" | "attached_to"` union, mirroring
  `RelationshipCreate.rel_type` Literal), `RelationshipRow` (the compact GET row — `document_id`
  **`string | null`** for the masked "no access" endpoint, plus `filename` / `rel_type` /
  `direction` / `label` / optional `relationship_id`, mirroring `get_related_documents`'s
  `documents[]`), `RelatedDocumentsResponse` (`subject` + `total` + `documents[]` — the plain
  GET dict), and `Relationship` (the POST 201 body, mirroring `RelationshipResponse`).
- **The nullable `document_id` is the type-level leak guard (D-117-8):** the backend never
  sends an id/title for a masked row; typing it `string | null` makes a leaked-id render a
  type error, so the Plan-04 UI cannot accidentally surface it. The actual access gate stays
  server-side (the per-viewer readability re-check in the shared service, Plan 01).
- **Three client fns mirroring the `document-views` family conventions** (`api.ts`):
  `listRelationships(documentId)` → `GET /document-relationships?document_id=` →
  `RelatedDocumentsResponse` (throws on non-ok, so the section renders its honest error state);
  `createRelationship(source_doc_id, target_doc_id, rel_type)` → `POST` with the EXACT body
  `{ source_doc_id, target_doc_id, rel_type }` → `Relationship` (throws on non-ok; 422 =
  unseeable endpoint / self-link / forged type, uniform server-side); `deleteRelationship(id)`
  → `DELETE /{id}`, **404-tolerant** (`if (!res.ok && res.status !== 404) throw` — the
  `deleteView` pattern; an own-scoped 404 is a no-op, not an error).

## Task Commits

Each task was committed atomically:

1. **Task 1: Add relationship types to types/index.ts** - `3f3078bb` (feat)
2. **Task 2: Add the 3 client fns to api.ts (list / create / delete)** - `4fc2ea14` (feat)

**Plan metadata:** _(this docs commit)_

_Note: both tasks were `tdd="true"`; for a pure types + client-fn surface the `tsc --noEmit`
compile IS the RED→GREEN gate (the plan's `<verify><automated>` for both tasks). No runtime
behavior test is added in this plan — the a11y/behavior tests belong to the Plan-04 components
that consume this seam (per 117-PATTERNS.md)._

## Files Created/Modified

- `frontend/src/types/index.ts` - Added `RelType` / `RelationshipRow` /
  `RelatedDocumentsResponse` / `Relationship` (Phase 117 DM-types block, placed after
  `SavedView` — the closest mirror-the-backend-model analog). +68 lines, no existing type
  touched.
- `frontend/src/lib/api.ts` - Added `listRelationships` / `createRelationship` /
  `deleteRelationship` (Phase 117 block, adjacent to the `document-views` family) + imported
  `RelType` / `RelatedDocumentsResponse` / `Relationship` from `../types`. +68 / -1 (the
  type-import line replaced).

## Decisions Made

- **`relationship_id` typed OPTIONAL despite the backend always sending it.** The plan spec
  declares `relationship_id?: string`; the shared `get_related_documents` traversal actually
  sets `relationship_id` on EVERY row (it is unconditional in the service — masked AND real
  rows both carry the edge `id`). I followed the plan's optional typing on purpose: it is a
  superset-safe contract (the Plan-04 consumer null-checks before wiring the remove ✕, so a
  row that ever lacked it simply has no remove affordance), and it cannot mis-type any real
  payload. Documented here so it is not mistaken for a backend/frontend drift.
- **`RelationshipRow` was NOT imported into `api.ts`.** The plan's Task-2 `<action>` lists it
  among the types to import, but none of the 3 client fns reference `RelationshipRow` directly
  (they use `RelatedDocumentsResponse`, `RelType`, `Relationship`). Under the frontend tsconfig
  (`noUnusedLocals: true` + `verbatimModuleSyntax: true`) an unused type import is a `tsc`
  error, so importing it would have broken the build. It remains exported from `types/index.ts`
  for the Plan-04 components. (See Deviations — Rule 3.)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Omitted the unused `RelationshipRow` import from `api.ts`**
- **Found during:** Task 2 (adding the 3 client fns).
- **Issue:** The plan's Task-2 `<action>` says to import `RelType / RelationshipRow /
  RelatedDocumentsResponse / Relationship` from the types module. But the 3 client fns never
  reference `RelationshipRow`, and the frontend tsconfig has `noUnusedLocals: true` +
  `verbatimModuleSyntax: true` — an unused type import is a hard `tsc --noEmit` error, which
  would have failed both tasks' verification gate.
- **Fix:** Imported only the three types the fns actually use (`RelType`,
  `RelatedDocumentsResponse`, `Relationship`). `RelationshipRow` stays exported from
  `types/index.ts` (Task 1) for the Plan-04 components that render the rows.
- **Files modified:** `frontend/src/lib/api.ts`
- **Verification:** `cd frontend && npx tsc --noEmit` → EXIT 0 (clean).
- **Committed in:** `4fc2ea14` (Task 2 commit).

---

**Total deviations:** 1 auto-fixed (1 blocking).
**Impact on plan:** The single auto-fix was required for the `tsc` gate to pass (the plan's own
verification). No behavior change, no scope creep — the type is still exported for its real
consumer (Plan 04). The types themselves match the plan's specified shapes verbatim.

## Threat-Model Adherence

All three plan-register threats are satisfied by construction:
- **T-117-03-01 (Info Disclosure / masked-row id leak in the type contract):** `RelationshipRow.document_id`
  is `string | null`; the masked row carries `null` (the backend never sends an id). A leaked-id
  render is a type error. The actual gate is server-side (Plan 01/02, the per-viewer readability
  re-check) — verified LIVE in secure-phase, not via this type (D-102 "static would false-green").
- **T-117-03-02 (Spoofing / unauthenticated client call):** accept. All 3 client fns use
  `getAuthHeaders()` (the app-wide convention); auth is enforced server-side by
  `Depends(get_current_user)`. The client is not a trust boundary.
- **T-117-03-SC (Tampering / package installs):** accept — vacuously clean. Zero new deps
  (reuses the existing `getAuthHeaders` / `fetch` / `API_BASE` already in `api.ts`).

## Issues Encountered

None. The two changed source files (`api.ts`, `types/index.ts`) are not test files; the full
vitest suite's 17 pre-existing failures (7 streaming/chat/provider/model-info test files,
NONE relationship-related) reproduce identically at the base. See Verification.

## Verification

- **`cd frontend && npx tsc --noEmit` clean (EXIT 0)** on the final committed state — the types
  and client fns compile; `document_id` is `string | null`.
- **Task 1 acceptance:** `grep -c "RelatedDocumentsResponse\|RelationshipRow\|export type RelType"
  types/index.ts` = 4 (≥ 3); `grep -n "document_id: string | null"` matches (line 330).
- **Task 2 acceptance:** `grep -c "export async function (listRelationships|createRelationship|deleteRelationship)"`
  = 3; `grep -c "status !== 404"` increased by exactly 1 (2 → 3: the pre-existing line 1053 +
  `deleteView` line 2096 + the new `deleteRelationship` line 2212); `grep -c "source_doc_id"` = 3
  (all in `createRelationship`); `grep -c "document-relationships?document_id="` = 3 (the
  `listRelationships` GET binding + the two doc-comment mentions).
- **Net-new test failures = 0 (base-checkout proven):** the only changed files are `api.ts` +
  `types/index.ts` (both non-test). The full vitest suite at HEAD ran **17 failed / 806 passed /
  823 total across 7 failed files**; the same suite at the BASE versions of those 2 files
  (`510c3b49` checked out for just those files) ran the **identical** 17 failed / 806 passed /
  823 total / 7 failed files. `diff` of the failing-file lists is EMPTY. All 7 failing files are
  pre-existing streaming/chat/provider/model-info tests (`streamsProvider*`, `MessageItem`,
  `useMessages`, `StreamsProvider.dedup`, `Plan04.frontend` [= Phase 075.1 Plan 04, NOT 117],
  `model-info`) — none touch relationship types or the api client. My committed files were then
  restored (no working-tree drift; `git diff HEAD` empty for both).
- **No new package, no new migration, no backend change.** `threads.py` untouched (G-5 — this
  plan is frontend-only).

## Known Stubs

None — this plan ships a complete, compiling, type-safe seam. The types mirror the live backend
payloads (the masked-row `document_id: null` is the load-bearing detail); the 3 client fns bind
to the live routes (GET Plan 02 + POST/DELETE Phase 116). Plan 04 wires these into the
`RelationshipsSection` + `CreateLinkDialog` components.

## Next Phase Readiness

- **Plan 04 (the panel UI) is unblocked:** `RelType` / `RelationshipRow` /
  `RelatedDocumentsResponse` / `Relationship` and `listRelationships` / `createRelationship` /
  `deleteRelationship` are all exported and typed. Plan 04 imports `RelationshipRow` (already
  exported) for the row render, calls `listRelationships(doc.id)` on mount + re-fetches after
  each mutation (D-117-9), `createRelationship(...)` from the `CreateLinkDialog`, and
  `deleteRelationship(...)` from the remove ✕.
- **No blockers.** The optional `relationship_id` is the one detail Plan 04 must null-check
  before wiring the remove control (every live row carries it, but the type is permissive).

## Self-Check: PASSED

- Files verified present: `frontend/src/types/index.ts`, `frontend/src/lib/api.ts`,
  `117-03-SUMMARY.md`.
- Commits verified in git log: `3f3078bb` (feat — types), `4fc2ea14` (feat — client fns).

---
*Phase: 117-document-relationships-panel-ui*
*Completed: 2026-06-20*
