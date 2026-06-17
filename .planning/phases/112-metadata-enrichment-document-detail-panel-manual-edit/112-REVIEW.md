---
phase: 112-metadata-enrichment-document-detail-panel-manual-edit
reviewed: 2026-06-18T00:00:00Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - backend/app/api/documents.py
  - backend/tests/integration/test_112_custom_field_patch.py
  - backend/tests/integration/test_112_flat_filter_with_source.py
  - backend/tests/integration/test_112_patch_audit.py
  - backend/tests/integration/test_112_patch_rls.py
  - backend/tests/integration/test_112_reextract_merge.py
  - backend/tests/unit/test_112_patch_metadata.py
  - frontend/src/components/ingestion/DocumentList.tsx
  - frontend/src/components/metadata/ConfidenceChip.test.tsx
  - frontend/src/components/metadata/ConfidenceChip.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx
  - frontend/src/components/metadata/DocumentDetailPanel.tsx
  - frontend/src/components/metadata/InlineEdit.test.tsx
  - frontend/src/components/metadata/InlineEdit.tsx
  - frontend/src/lib/api.ts
  - frontend/src/pages/IngestionPage.tsx
  - frontend/src/types/index.ts
findings:
  critical: 1
  warning: 4
  info: 5
  total: 10
status: resolved
resolution: "CR-01 + IN-05 + WR-04 + WR-02 + IN-01 + IN-02 fixed & verified 2026-06-18 (commits 7dfbd9b1, b82b3589, 2de3c1fd, 79a8f325, 8865a2b6). CR-01 premise confirmed: IN-05 regression test fails pre-fix / passes post-fix. Advisory carry-forwards (NOT fixed): WR-03 (PATCH custom-field value type-check), IN-03 (resize double-eval, cosmetic), IN-04 (pre-existing reingest console.error)."
---

# Phase 112: Code Review Report

**Reviewed:** 2026-06-18T00:00:00Z
**Depth:** standard
**Files Reviewed:** 17
**Status:** issues_found

## Summary

Phase 112 ships three things: an audited `PATCH /documents/{id}/metadata` endpoint, a re-extract precedence merge guard at the single `ingest_document` write site, and a frontend document detail panel with honest inline metadata editing. The four stated risk areas were the review focus.

The good news on the security/authorization axis: the PATCH endpoint's authorization posture is **correct and well-defended**. Owner scoping is enforced on both the SELECT and the UPDATE with `.eq("user_id", ...)`, the non-owner path returns 404 (not 403, no existence leak), the `field` allow-list rejects leading-underscore provenance-forgery attempts and unknown fields, provenance is server-stamped (`_source='user'`) so the client can never assert it, stale `_confidence` is dropped on a human override, and there is **no SQL/PostgREST injection vector** in the new code (supabase-py parametrizes the `metadata` jsonb write; the `field` is allow-list-validated against a fixed built-in set plus the fail-closed `read_enabled_field_defs`). The merge guard is correctly placed at the single write site so all three re-extract entry points inherit it, handles the degrade-to-None and cleared-field cases, and the live integration tests genuinely drive the real code path. The frontend honesty contract (neutral "Edited"/"Extracted" chips, never-color-alone, receipt-only-on-200, role=alert inverse) is faithfully implemented.

The bad news is one **Critical** correctness defect: the response/list serialization model (`DocumentResponse.metadata: DocumentMetadata | None`) silently strips `_source`, `_confidence`, and all custom field keys from every HTTP response. The whole panel is designed around those keys, and the panel's own reconcile (`loadDocuments()` after each save) re-fetches through the stripping path — so the "Edited" chip and confidence chips will disappear after a successful edit + reconcile. The test suite does not catch this because the backend tests call the route function directly (bypassing FastAPI response serialization) and assert on the raw `result.data[0]` dict.

## Critical Issues

### CR-01: `DocumentResponse` response model strips `_source` / `_confidence` / custom fields from every HTTP response — the panel's honesty data never reaches the client through the standard paths

**File:** `backend/app/models/document.py:8-16` and `backend/app/models/document.py:36`; consumed at `backend/app/api/documents.py:535` (`GET /documents`) and `backend/app/api/documents.py:1356` (`PATCH /documents/{id}/metadata`)

**Issue:**
`DocumentResponse.metadata` is typed `DocumentMetadata | None`, and `DocumentMetadata` (document.py:8-16) declares only the 7 built-in fields with Pydantic's default `extra="ignore"`. When FastAPI serializes any handler decorated with `response_model=DocumentResponse` / `response_model=list[DocumentResponse]`, it coerces `metadata` through `DocumentMetadata` and **drops** every key not in the 7 built-ins — that includes the nested `_source`, the nested `_confidence`, and every custom `field_key`.

The entire Phase 112 panel is built on exactly those keys:
- `DocumentDetailPanel.resolveFieldState` reads `metadata._confidence?.[key]` and `metadata._source?.[key]` (DocumentDetailPanel.tsx:106-108).
- `ConfidenceChip` renders the neutral "Edited" chip ONLY when `source === "user"` (ConfidenceChip.tsx:70) — which arrives via `_source`.
- `buildFieldRows` renders enabled custom defs as rows whose values come from `metadata[customKey]`.

The panel's data comes from the `documents` array in `useDocuments`, populated by `loadDocuments()` → `listDocuments()` → `GET /documents` (useDocuments.ts:20-23) — i.e. through the stripping `response_model=list[DocumentResponse]` path. Worse, `DocumentDetailPanel.handleCommit` calls `onReconcile?.()` (= `loadDocuments`) after every successful save (DocumentDetailPanel.tsx:181), so immediately after a user edits Title and sees "Saved · audit logged", the reconcile re-fetches a `metadata` blob with `_source` stripped — and the "Edited" chip the user just earned **vanishes**. Confidence chips degrade to neutral "Extracted" for the same reason.

There is a confounding second data path: Supabase Realtime `payload.new` (useDocuments.ts:48-58) carries the RAW row JSON *with* the nested keys, so a freshly-Realtime-updated row may briefly show the correct chips — which makes this defect intermittent and easy to miss in a quick manual pass, but it is deterministic on any list re-fetch.

This also affects Phase 111's `_confidence` display contract, but Phase 112 is the first UI to render these keys, so it surfaces here.

**Why the tests don't catch it:** every backend test calls `await update_document_metadata(...)` as a plain Python function (e.g. test_112_patch_audit.py:181, test_112_custom_field_patch.py:185) and asserts on `result["metadata"]["_source"]["title"]` / `result["metadata"][field_key]`. That returns the raw `result.data[0]` dict and never exercises FastAPI's `response_model` serialization, so the strip is invisible to the suite. The a11y frontend test mocks `updateDocumentMetadata` + injects a hand-built `doc` with `_source`/`_confidence` already present, so it also never exercises the real wire shape.

**Fix:**
Allow extra keys to pass through the metadata model so the nested provenance/confidence objects and custom fields survive serialization. Minimal, additive change:

```python
# backend/app/models/document.py
from pydantic import BaseModel, ConfigDict

class DocumentMetadata(BaseModel):
    # Phase 112: _source / _confidence (nested) + user custom field_keys must
    # survive response serialization — the document detail panel renders them.
    model_config = ConfigDict(extra="allow")

    title: str | None = None
    author: str | None = None
    date: str | None = None
    document_type: str | None = None
    topics: list[str] | None = None
    language: str | None = None
    summary: str | None = None
```

Then add a wire-level regression test that goes through `TestClient` (or asserts `DocumentResponse(**row).model_dump()` preserves `_source`, `_confidence`, and a custom key) so the strip can never silently return. Confirm `GET /documents` and the PATCH 200 body both round-trip `_source`/`_confidence`/custom keys end-to-end.

## Warnings

### WR-01: PATCH return value is `result.data[0]` (raw dict) but tests assert the panel reconciles on it — confirm the panel does not consume the PATCH response shape

**File:** `backend/app/api/documents.py:1442`; `frontend/src/components/metadata/DocumentDetailPanel.tsx:176-181`

**Issue:** The route returns `result.data[0]` (the raw updated row). The panel does NOT use the returned `Document` to update state — it ignores the resolved value of `updateDocumentMetadata` and instead calls `onReconcile?.()` to re-fetch. That is the intended design, but it means the *only* surface that ever sees the correct (non-stripped) `_source` is the PATCH return value, which the frontend discards. Combined with CR-01, the panel has no path to the honest data. Once CR-01 is fixed at the model level this is moot; if instead a narrower fix is chosen (e.g. returning a raw dict from PATCH only), note that the panel still won't benefit because it discards the PATCH body and re-fetches the list. The fix must target the shared list path, not just the PATCH return.

**Fix:** Resolve via CR-01 (model-level `extra="allow"`), which fixes both the list and PATCH paths. Do not "fix" only the PATCH return — the panel reconciles via the list endpoint.

### WR-02: `meta = doc.data.get("metadata") or {}` mutates the SELECT result object in place; harmless today but fragile

**File:** `backend/app/api/documents.py:1411-1421`

**Issue:** `meta` is the dict returned from the owner SELECT's `.data["metadata"]`. The route then mutates it directly (`meta[field] = value`, `meta.setdefault("_source", {})[field] = "user"`, `meta["_confidence"].pop(...)`) and writes it back. This works because `doc.data` is discarded after, but mutating a fetched response object in place is a latent footgun: if a future refactor reads `doc.data["metadata"]` again after the mutation (e.g. for an audit diff or an optimistic-vs-actual comparison), it would see the post-mutation state, not the prior value. The merge guard in `ingest_document` (documents.py:1592-1611) has the same shape and is also currently safe.

**Fix:** Defensive copy at the top of the merge so the prior blob stays pristine:
```python
meta = dict(doc.data.get("metadata") or {})
# also copy the nested objects if they will be mutated:
if isinstance(meta.get("_confidence"), dict):
    meta["_confidence"] = dict(meta["_confidence"])
```

### WR-03: InlineEdit enum/boolean Select commits on `onValueChange` but selecting the SAME value re-opens display mode with no commit — and the dirty guard compares against `original` which may be stale for cleared fields

**File:** `frontend/src/components/metadata/InlineEdit.tsx:197-227`

**Issue:** Two edge cases in the Select branch:
1. The boolean/enum control opens with `defaultOpen` and `value={draft || undefined}`. For an empty field, `draft` starts as `""` → `original` is `""`. If the user picks the value that stringifies to the current `original`, `if (v !== original)` is false and no commit fires — correct. But there is no visible affordance telling the user "nothing changed"; the control simply closes. Minor UX, not a bug.
2. For a `boolean` field whose stored value is `false`, `toEditString(false, "boolean")` returns `"false"`, so `original = "false"`. Re-selecting "false" correctly no-ops. But a stored `false` value is considered NON-empty by `isEmptyValue` (returns false for non-string non-array non-null), so the field renders as editable with value "false" — fine. No correctness bug, but the boolean round-trip (`fromEditString("false") → false`, merge guard treats `false` as a real value) should be verified against the backend allow-list, since `boolean` is only valid for custom fields and the PATCH route does not type-check the value against the custom def's `field_type`.

**Fix:** Low priority. If stricter typing is desired, have the PATCH route validate `value`'s shape against the custom field def's `field_type` (string/date/number/boolean/enum) rather than accepting any JSON. Today the route accepts any `value` for any allow-listed field (documents.py:86, 1412-1416), so a `boolean` custom field could be PATCHed with a string. This is contained (it only pollutes that user's own metadata blob and cannot break `@>` filters since custom keys aren't flat filter dimensions), hence Warning not Critical.

### WR-04: `summary` Textarea commits on blur, but the blur fires when the Save receipt/animation steals focus or when clicking another field — risk of an unintended commit of a partial edit

**File:** `frontend/src/components/metadata/InlineEdit.tsx:231-252`

**Issue:** The summary control commits `onBlur` (line 236). The guard is `cancelledRef` (set only by Esc) plus the dirty check (`draft === original`). If the user is mid-edit in the summary Textarea and clicks any other field row or the close button, blur fires and commits the in-progress draft. For a long summary this means an accidental click commits a half-typed summary and writes an audit row + stamps `_source='user'` (destroying the extracted value + its confidence). The single-line Input branch (line 258) has the same blur-commit. The component docstring claims "a guarded blur-commit only fires when ... focus didn't move to an in-control affordance" (InlineEdit.tsx:8-9), but there is no such focus-target guard in the code — the only guard is `cancelledRef` (Esc) and the dirty check.

**Fix:** Either drop blur-commit for `summary` (require explicit Cmd/Ctrl+Enter, with Esc to cancel — the docstring already documents Cmd/Ctrl+Enter as the commit path), or add the focus-target guard the docstring describes (check `e.relatedTarget` on blur and skip commit when focus moves outside the field without an explicit Enter). At minimum, align the docstring with the actual behavior so the next maintainer isn't misled.

## Info

### IN-01: `_METADATA_BUILTINS` is duplicated across three sources of truth

**File:** `backend/app/api/documents.py:1353`

**Issue:** The 7 built-in keys are hardcoded as a module-level set with a comment that they "mirror models/metadata_field.py:17 / embedding_service DocumentMetadata" and the frontend `BUILTIN_FIELDS` (DocumentDetailPanel.tsx:65-73). Three independent literal lists must stay in lockstep; a future built-in addition that updates only one drifts silently.

**Fix:** Derive the backend set from `DocumentMetadata.model_fields.keys()` (single source of truth) rather than a separate literal:
```python
_METADATA_BUILTINS = set(DocumentMetadata.model_fields)
```

### IN-02: Magic number `LOW_TIER = 0.5` in the panel duplicates `TIER.MED = 0.5` in ConfidenceChip

**File:** `frontend/src/components/metadata/DocumentDetailPanel.tsx:80`; `frontend/src/components/metadata/ConfidenceChip.tsx:36`

**Issue:** The panel hardcodes `LOW_TIER = 0.5` to count low-confidence fields for the warn badge, with a comment acknowledging it "mirrors ConfidenceChip's hardcoded TIER." If the chip's `TIER.MED` is ever re-tuned (the comment says "re-verify against the live confidence distribution at UAT"), the panel's warn count silently diverges from the chip rendering.

**Fix:** Export `TIER` from ConfidenceChip and import it in the panel so both read one constant.

### IN-03: `useIsMobile` resize listener has no debounce and `onResize()` runs synchronously on mount AND in the effect — minor double-evaluation

**File:** `frontend/src/components/metadata/DocumentDetailPanel.tsx:41-52`

**Issue:** The initial state already computes `window.innerWidth < MOBILE_BREAKPOINT` lazily, then the effect calls `onResize()` again immediately on mount (line 47). Harmless (idempotent setState), and the comment notes it follows the WorkspacePanel convention, but the immediate `onResize()` is redundant with the lazy initializer.

**Fix:** Drop the immediate `onResize()` call in the effect, or remove the lazy initializer — keep one. Cosmetic.

### IN-04: `console.error("Reingest failed:", e)` left in DocumentList — debug artifact on a user-facing failure with no user feedback

**File:** `frontend/src/components/ingestion/DocumentList.tsx:201`

**Issue:** `handleReingest` swallows the error to `console.error` with no UI signal (unlike `handleDelete`/`handleRestore`, which surface a visible error string). A failed re-ingest is silent to the user. Pre-existing (not introduced by 112's diff hunk), noted for completeness since the file is in scope.

**Fix:** Surface a toast/inline error on reingest failure, consistent with the delete/restore error affordances in the same file.

### IN-05: Backend integration tests assert on the raw route return, never the serialized wire shape — coverage gap that masked CR-01

**File:** `backend/tests/integration/test_112_patch_audit.py:181-199`; `backend/tests/integration/test_112_custom_field_patch.py:185-203`; `backend/tests/integration/test_112_patch_rls.py:201-207`

**Issue:** All "round-trip" assertions read `result["metadata"]["_source"]` / `result["metadata"][field_key]` from the direct function return, and the persistence assertions read the row via raw asyncpg (`SELECT metadata FROM documents`). Neither exercises FastAPI's `response_model` serialization, which is exactly where CR-01 strips the data. The tests are otherwise excellent (they drive the real route against live :54322 and verify audit-row counts, RLS-404, no-mutation-on-reject), but the missing wire-level assertion is what let CR-01 ship green.

**Fix:** Add one `TestClient`-based test (or a direct `DocumentResponse(**row).model_dump()` assertion) proving `_source`, `_confidence`, and a custom key survive the response model. This is the regression test for CR-01.

---

_Reviewed: 2026-06-18T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
