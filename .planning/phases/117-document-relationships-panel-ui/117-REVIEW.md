---
phase: 117-document-relationships-panel-ui
reviewed: 2026-06-21T00:00:00Z
depth: standard
files_reviewed: 18
files_reviewed_list:
  - backend/app/api/document_relationships.py
  - backend/app/services/document_relationship_service.py
  - backend/app/services/tool_dispatcher.py
  - backend/tests/integration/test_117_get_read.py
  - backend/tests/integration/test_117_route_leak.py
  - backend/tests/unit/test_117_no_fork.py
  - frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.tsx
  - frontend/src/components/relationships/CreateLinkDialog.test.tsx
  - frontend/src/components/relationships/CreateLinkDialog.tsx
  - frontend/src/components/relationships/relationshipLabels.ts
  - frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx
  - frontend/src/components/relationships/RelationshipsSection.test.tsx
  - frontend/src/components/relationships/RelationshipsSection.tsx
  - frontend/src/index.css
  - frontend/src/lib/api.ts
  - frontend/src/types/index.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 117: Code Review Report

**Reviewed:** 2026-06-21
**Depth:** standard
**Files Reviewed:** 18
**Status:** issues_found

## Summary

Phase 117 ships the document-relationships panel UI plus the net-new `GET /document-relationships`
read seam and the D-117-7 "share-don't-fork" extraction of the leak-safe traversal into
`document_relationship_service.get_related_documents`.

The core leak-safety invariant (D-117-8) is **sound**: the mask is constructed only inside the
shared service, the masked row carries `document_id=None` with no leaked id/filename/source_ref,
the per-endpoint readability re-check is caller-scoped (not edge-owner-scoped), and the frontend
types the masked id `string | null` so a leaked id is a compile error. The single read core is
genuinely shared by both callers (verified by `test_117_no_fork.py` source-grep) and the route is a
thin wrapper. a11y is well-handled (remove ✕ reachable on coarse pointers via `.rel-x-touch`,
hand-wired APG combobox, role=status/alert state distinction).

The defects found are correctness/robustness gaps, not leaks. The most important is that the GET
route does **not** wrap the subject resolve in a try/except, so a malformed (non-UUID) `document_id`
query param raises a DB error and surfaces as an unhandled **500** — breaking the documented
"uniform 404, no existence oracle" invariant and diverging from the agent-tool caller (which catches
everything). There are also a few state-handling and consistency warnings on the frontend.

## Warnings

### WR-01: GET route 500s (not uniform 404) on a malformed `document_id` — breaks the no-oracle invariant

**File:** `backend/app/api/document_relationships.py:102-110` (and the resolve path `backend/app/services/document_relationship_service.py:208-214`)
**Issue:** The route docstring (lines 92-96) promises a UNIFORM 404 for any "unreadable / unknown
subject" so the route is "no existence-probe oracle." But the route calls
`get_related_documents(...)` with **no** try/except. Inside, `_resolve_readable_latest` runs
`aexec(client.table("documents").select("*").eq("id", doc_id_or_filename)...)`. `aexec` does not
catch exceptions (`backend/app/utils/db.py:44`). `document_id` is an attacker-controllable URL query
param; the `documents.id` column is `uuid`, so a non-UUID value (`?document_id=not-a-uuid`) makes
PostgREST return `22P02 invalid input syntax for type uuid`, which supabase-py raises as `APIError`
→ propagates uncaught → FastAPI returns **500**.

This has two consequences:
1. **Robustness:** a trivial malformed input crashes the request instead of returning 404.
2. **Oracle leak (minor but real):** a malformed id (500) is distinguishable from a well-formed but
   unknown/unreadable id (404). The route's own test only probes well-formed-unknown and
   real-but-unreadable ids (`test_117_route_leak.py:451-487`) — the malformed path is untested, so
   this divergence shipped silently. The agent-tool caller does **not** have this gap (it wraps the
   whole call in `except Exception` → calm string, `tool_dispatcher.py:525-538`), so the two callers
   behave differently on the same bad input.

**Fix:** Wrap the resolve in the route (or, better, inside the shared fn so both callers stay
uniform) and map any failure to the same 404 the unknown-subject path uses:
```python
try:
    result = await document_relationship_service.get_related_documents(
        caller, document_id=document_id, supabase=supabase
    )
except Exception:  # malformed id / transient DB error → uniform 404 (no oracle, no 500)
    raise HTTPException(status_code=404, detail="Document not found")
if result is None:
    raise HTTPException(status_code=404, detail="Document not found")
return result
```
(The same exposure exists for `source_doc_id`/`target_doc_id` in the POST `_resolve_readable_latest`
calls at lines 140-145, which run before any try/except — lower risk since the panel always sends a
real id, but a malformed body value 500s there too.)

### WR-02: Masked-row remove fires a DELETE the server will 404, then a redundant re-fetch — but the row never disappears

**File:** `frontend/src/components/relationships/RelationshipsSection.tsx:97-107, 271-288`
**Issue:** A masked row (`document_id === null`, the other endpoint is unreadable) still renders a
remove ✕ guarded only on `relationship_id != null` (line 271). The backend always sends
`relationship_id` for masked rows, so the ✕ always shows. The intent (D-117-2) is "you own the edge
from either end." But `deleteRelationship` is own-scoped server-side (`.eq("user_id", caller)`), and
a masked row is, by construction, an edge whose *other* endpoint the caller can't read — which for
the two-user scenario in the leak test means the **edge itself belongs to the caller** (own-scoped
read), so the delete *does* succeed there. However, when the masked row arises because the caller's
own edge points at a target they once could read and now cannot, the delete succeeds and the
re-fetch removes it — fine. The actual bug is narrower: `handleRemove` (lines 97-107) swallows the
delete result and the error in a bare `try/finally` with no `catch`, so a **genuine** delete failure
(e.g. the 500 from WR-01 surfacing through a future masked-subject re-fetch, or a network error on
`deleteRelationship` that is not a 404) is silently ignored — the `await load(true)` in `finally`
re-fetches, and if that *also* fails it flips to the error state, but the user gets no signal that
the *remove* specifically failed. The row will simply reappear with no explanation.
**Fix:** Distinguish a failed delete from a failed re-fetch so the user isn't left confused:
```js
const handleRemove = useCallback(async (relationshipId: string) => {
  try {
    await deleteRelationship(relationshipId)
  } catch {
    // surface a transient "couldn't remove" beat; the re-fetch below shows server truth
    setRemoveError(relationshipId)
  } finally {
    await load(true)
  }
}, [load])
```
At minimum, document why a swallowed delete error is acceptable (the re-fetch is authoritative) — the
current code's silence on a non-404 delete failure is a quiet UX hole.

### WR-03: `createRelationship` URL/error contract collapses all 422 causes into one opaque message

**File:** `frontend/src/lib/api.ts:2187-2200`; consumed at `frontend/src/components/relationships/CreateLinkDialog.tsx:134-147`
**Issue:** The backend returns a deliberately uniform 422 for three distinct create failures
(unseeable endpoint / self-link / forged type — `document_relationships.py:146-162`). That uniformity
is correct server-side (no oracle). But `createRelationship` throws a fixed `new Error("Failed to
create link")` discarding the response body, and `handleConfirm` renders a fixed `"Action failed.
Please try again."` for *every* failure including ones that are not transient (a self-link or an
already-unreadable target will never succeed on retry). "Please try again" is misleading guidance for
a permanent rejection. This is not a security issue (the server is the gate), it's an honesty/UX
defect on the same axis the phase otherwise takes seriously (D-117-10 honest states).
**Fix:** Surface a non-retry-implying message for 422 (e.g. "That link can't be created"), reserving
"try again" for network/5xx. The candidate-exclusion already prevents the common duplicate case, so a
422 here is genuinely a "can't" not a "try again."

### WR-04: `aria-controls` references a listbox id that does not exist when the list is collapsed

**File:** `frontend/src/components/relationships/CreateLinkDialog.tsx:209, 227-261`
**Issue:** The combobox input always sets `aria-controls={listboxId}` (line 209), but the
`<ul role="listbox" id={listboxId}>` is conditionally rendered only when `listVisible` is true (line
227). When `listVisible` is false, `aria-controls` points at a non-existent element — an invalid
ARIA reference (WCAG ARIA 1.2 / APG combobox pattern expects `aria-controls` to reference an existing
element, and `aria-expanded` to reflect popup presence). Screen readers may announce a controlled
listbox that isn't in the tree. `aria-expanded={listVisible}` is wired correctly, so the severity is
limited, but the dangling reference is a real a11y inconsistency in an explicitly hand-wired APG
widget where the phase claims APG conformance.
**Fix:** Either keep the `<ul>` mounted (and hide it visually) when collapsed, or drop
`aria-controls` when `!listVisible`:
```jsx
aria-controls={listVisible ? listboxId : undefined}
```

## Info

### IN-01: `aria-activedescendant` can momentarily reference a stale/non-existent option id

**File:** `frontend/src/components/relationships/CreateLinkDialog.tsx:149, 108-110`
**Issue:** `activeOptionId` is derived from `activeIndex` directly (`${listboxId}-opt-${activeIndex}`).
When `filtered` shrinks (typing narrows the list) the clamp `useEffect` (lines 108-110) corrects
`activeIndex` on the *next* render, but for the render where `filtered.length` dropped below the old
`activeIndex`, `aria-activedescendant` points at an option id that no longer exists. Self-corrects
immediately; cosmetic for AT.
**Fix:** Clamp at read time: `const safeIndex = Math.min(activeIndex, filtered.length - 1)` and build
both `activeOptionId` and the option highlight from `safeIndex`.

### IN-02: `listRelationships` interpolates `documentId` into the URL without `encodeURIComponent`

**File:** `frontend/src/lib/api.ts:2172-2179`
**Issue:** `fetch(\`${API_BASE}/document-relationships?document_id=${documentId}\`)` interpolates the
id raw. Doc ids are UUIDs today so this is safe in practice, but it is inconsistent with defensive
URL construction and would break (or, combined with WR-01, 500) if any non-UUID/whitespace value ever
reached it.
**Fix:** Use `encodeURIComponent(documentId)` or a `URLSearchParams`/`URL` builder.

### IN-03: Masked-row React key fallback can collide

**File:** `frontend/src/components/relationships/RelationshipsSection.tsx:219`
**Issue:** The list key is `row.relationship_id ?? \`${row.direction}-${row.document_id}-${row.rel_type}\``.
For masked rows `document_id` is `null`, so two masked incoming rows of the same `rel_type` would
produce the identical fallback key `incoming-null-amends`. In practice the backend always sends
`relationship_id`, so the fallback is effectively dead — but if it ever triggers, two masked rows
collide and React mis-reconciles. Either rely on the always-present `relationship_id` (drop the
fallback and assert it) or include a stable index in the fallback.

### IN-04: `handleConfirm` calls both `onCreated()` and `onClose()`; parent also closes — redundant double-close

**File:** `frontend/src/components/relationships/CreateLinkDialog.tsx:139-141` with `RelationshipsSection.tsx:181-185`
**Issue:** On success the dialog calls `onCreated()` (parent sets `dialogOpen=false` + re-fetches)
then `onClose()` (parent sets `dialogOpen=false` again). Harmless (idempotent state set) but the
double-close is redundant and slightly obscures the control flow. Pick one ownership model: let the
parent close on `onCreated`, and don't also call `onClose()` from the success path.

### IN-05: Several backend write paths use a blocking, error-swallowing audit write on the response path

**File:** `backend/app/api/document_relationships.py:191-201, 229-234`
**Issue:** `write_audit_entry` is awaited in-band (not `BackgroundTasks`) and swallows errors. This is
explicitly acknowledged in-code (WR-03 comments) and matches the inherited `document_views.py`
pattern, so it is not a regression — flagged only for the record: a slow audit round-trip adds to
create/delete latency, and a swallowed audit failure means a "governance receipt" silently doesn't
exist while the API reports success. Out of v1 review scope (latency) but worth a backlog note if the
governance trail is load-bearing.

## Notes on test quality (evidence, not defects)

- The live two-user route leak proof (`test_117_route_leak.py`) and the get-shape proof
  (`test_117_get_read.py`) are **non-vacuous**: they include explicit non-vacuity guards (B genuinely
  resolves the global subject; A sees the real filename over the same subject), so the mask is proven
  access-driven, not a blanket null. Good.
- **Coverage gap (ties to WR-01):** no test drives the route with a *malformed* (non-UUID)
  `document_id`. `test_route_uniform_404_for_unreadable_or_unknown_subject` only covers well-formed
  ids. That gap is exactly why the 500-not-404 divergence shipped unnoticed. Recommend adding a
  malformed-id row asserting 404 (after the WR-01 fix).
- `test_117_no_fork.py` correctly scopes its grep to the two tokens that uniquely identify a forked
  read traversal (`_NO_ACCESS_MASK` + `.in_(`) and explicitly allows `_resolve_readable_latest` in the
  route (the legitimate shared-gate call). Sound guard.

---

_Reviewed: 2026-06-21_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
