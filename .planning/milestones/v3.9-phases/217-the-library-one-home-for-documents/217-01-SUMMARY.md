---
phase: 217-the-library-one-home-for-documents
plan: 01
subsystem: api
tags: [fastapi, pydantic, response-model, computed-field, mime, ingestion, documents]

# Dependency graph
requires:
  - phase: 071
    provides: "the `extractor` lineage column on `documents`, populated on every new ingest"
  - phase: 112
    provides: "`DocumentResponse` + the `extra=\"allow\"` metadata round-trip the new fields sit beside"
provides:
  - "`GET /documents` (and the other nine DocumentResponse routes) serialize `ingestion_step` and `extractor`"
  - "`tables_stage_applies` / `images_stage_applies` computed on every DocumentResponse from `mime_type`"
  - "`tables_stage_applies()` / `images_stage_applies()` pure predicates in `multimodal_service.py`"
  - "`DocumentChunkRow` / `DocumentTableRow` / `DocumentImageRow` / `DocumentContentResponse` for plan 02's routes"
  - "The upload 422 detail derived from `ALLOWED_MIME_TYPES` instead of a four-item prose list"
affects: [217-02, 217-03, 217-05, 217-07, the Library ingestion strip, useDocuments Realtime reconcile]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "pydantic `@computed_field` on a response model, so a derived fact populates on EVERY route rather than the one route somebody remembered"
    - "deferred (function-body) import to cross an established module cycle without restructuring it"

key-files:
  created:
    - backend/tests/test_217_document_response_fields.py
  modified:
    - backend/app/models/document.py
    - backend/app/services/multimodal_service.py
    - backend/app/api/documents.py

key-decisions:
  - "Deferred import chosen over the `mime_sets.py` fallback — the cycle is real and the deferred import resolves it with zero moved code"
  - "The two applicability booleans are computed_fields, NOT stored fields — RESEARCH proposed `bool = False` defaults, which would have been False-by-omission on every route that did not set them"
  - "`ingestion_step` ships with D-217-23's residue warning IN THE MODEL, because the honest read is the PAIR (status, ingestion_step) and a client reading it alone on a completed row will be wrong"
  - "The negative fence is written over the WIRE SHAPE (response keys), not over the source file — a grep of the model cannot see a field added by a subclass or a route"

patterns-established:
  - "Population over declaration: the load-bearing assertion reads `res.json()` off a real route body; a `model_fields` check is kept and explicitly labelled NOT coverage"
  - "A RED control is DRIVEN, not asserted — the two fields were actually removed and 5 of 9 cases went red before being restored"

requirements-completed: [LIB-03, LIB-04]

# Metrics
duration: 34min
completed: 2026-08-29
---

# Phase 217 Plan 01: DocumentResponse scalar facts + server-derived stage applicability Summary

**`ingestion_step` and `extractor` now leave Postgres on all ten `DocumentResponse` routes, and the two conditional-stage applicability booleans are computed from `mime_type` against `multimodal_service`'s own frozensets — one list, not two.**

## Performance

- **Duration:** ~34 min
- **Tasks:** 3
- **Files modified:** 4 (3 modified, 1 created)

## Accomplishments

- **The D-217-10 fix landed and is proven on the wire.** `list_documents` already did `select("*")`, so both columns were in the dict the whole time — FastAPI's `response_model` was the only thing stripping them. A file already mid-ingest when the Library opens now shows its stage on a cold load, with no dependence on the next Realtime transition (the D-v2.5-03 failure mode).
- **Applicability is derived once, server-side, from the pipeline's own constants.** `tables_stage_applies` / `images_stage_applies` read `PDF_MIME` / `DOCX_MIME` / `CSV_MIMES` / `EXCEL_MIMES` directly, so the strip can honestly strike out a stage the pipeline would never have run (D-217-24) without a second copy of the mime lists in the frontend.
- **Nine test cases, and the RED control was actually driven** rather than described.

## Task Commits

1. **Task 1: Two stage-applicability predicates, beside the frozensets they read** — `0c2d3402b` (feat)
2. **Task 2: DocumentResponse gains four fields; four new row models land beside it** — `376cce895` (feat)
3. **Task 3: A backend suite that proves POPULATION, not declaration** — `f024f9852` (test)

## Files Created/Modified

- `backend/app/services/multimodal_service.py` — +30 lines, **additions only, zero deletions** (`git diff -U0 | grep -c "^-[^-]"` = 0). Two public predicates immediately after `_mime_to_extractor`, keyed on the same four constants. Nothing inside `extract_and_store_tables` / `extract_and_store_images` changed.
- `backend/app/models/document.py` — `extractor` + `ingestion_step` (both defaulted), the two `@computed_field` properties, and four new row models for plan 02.
- `backend/app/api/documents.py` — **exactly one string literal**; the upload 422 detail. `ALLOWED_MIME_TYPES` membership untouched (plan 07 fences it from the frontend).
- `backend/tests/test_217_document_response_fields.py` — 303 lines, 9 cases.

## Decisions Made

### Import strategy — DEFERRED IMPORT, not the `mime_sets.py` fallback

The plan named a fallback (move the four constants into a new leaf module imported by both). **It was not needed.** The cycle is real and was confirmed by reading it rather than assumed: `app.models.document` → `app.services.multimodal_service` → `app.services.embedding_service` → `app.models.document`. A function-body import inside each property resolves it at first call, after both modules are loaded.

Verified in both directions, because a deferred import can pass one and fail the other:

| Entry point | Result |
|---|---|
| `import app.api.documents` then construct + `model_dump()` | OK |
| `import app.main` | `main OK` |
| **cold `import app.models.document` FIRST**, no service imported | `cold-import computed: True True` |

The fallback was declined because moving the constants would have relocated code four other call sites in `multimodal_service.py` read inline, for no benefit the deferred import does not already give. **The cost is that the cycle still exists** — this plan routes around it and does not repay it.

### The two booleans are COMPUTED, not stored — a deliberate divergence from RESEARCH

`217-RESEARCH.md` § *The model change* proposed all four as plain defaulted fields:

```python
    tables_stage_applies: bool = False    # recommended, see SC#3
    images_stage_applies: bool = False
```

**That shape is False-by-omission**, and the plan's own must_have forbids it (*"never left False by omission"*). Ten routes return `DocumentResponse`; a stored field is correct only on the routes that remember to set it, and the DB has no such columns to fill them from. `@computed_field` off `mime_type` — which was **already on the model**, and is what makes this derivable from the response object at all — populates all ten by construction. Recorded here because RESEARCH is not wrong so much as superseded, and the next reader will find the older wording.

Consequence worth carrying to plan 05/07: `tables_stage_applies` / `images_stage_applies` are **not** in `DocumentResponse.model_fields`, they are in `model_computed_fields`. Anything asserting over `model_fields` will not see them.

### `ingestion_step`'s residue warning lives in the model, not only in a decision doc

D-217-23 is recorded as a comment on the field itself. The completion update (`documents.py:2266-2273`) writes `status`, `chunk_count`, `metadata`, `full_markdown`, `extractor` — **and does not null `ingestion_step`** (read, not assumed). So on a `completed` row the field reads e.g. `"metadata"` by residue. `text_sanitize.py:9` diagnoses BUG-260825-01 precisely by reading the PAIR `status=failed / ingestion_step=embedding`, which is the only honest read. A client consulting the field alone on a completed row will render a stage that is not happening.

## Verification

| Check | Result |
|---|---|
| `pytest tests/test_217_document_response_fields.py -q` | **9 passed** |
| `python -c "import app.main"` | `main OK` — no circular import introduced |
| `pytest tests/integration/test_documents.py -q` | **36 passed** (the ten routes' own suite) |
| Negative fence `grep "thumbnail\|image_data\|b64" backend/app/models/document.py` | no match (exit 1) |
| `grep -c "^def tables_stage_applies\|^def images_stage_applies"` | exactly 2 |

### Backend baseline — before and after, re-derived, not quoted

| | `pytest tests/unit -q` |
|---|---|
| **Before any change** (at base `9a3808697`) | `68 failed, 3110 passed, 2 xfailed, 2 xpassed` in 108s |
| **After all three tasks** | `68 failed, 3110 passed, 2 xfailed, 2 xpassed` in 284s |

**Identical.** The 68 are the recorded rot set; nothing was added to or removed from it. (The runtime difference is a cold-vs-warm worktree, not a signal.)

### ⚠ The RED control was DRIVEN, not described

The plan asked for a comment naming the control. The control was also **executed**: `extractor` and `ingestion_step` were physically removed from `DocumentResponse`, the suite re-run, and the file restored from a backup with a byte-identical `git diff --stat` (empty).

```
FAILED test_list_documents_serializes_ingestion_step_and_extractor
FAILED test_list_documents_serializes_nulls_without_500
FAILED test_move_route_still_answers_and_body_validates
FAILED test_metadata_route_still_answers_and_body_validates
FAILED test_declaration_only_the_four_fields_exist_and_default
5 failed, 4 passed
```

**The four survivors are the finding, not a gap.** They are the applicability cases and the row-model import case — they passed under the revert *because the computed fields were untouched by it*. That is the correct behaviour and it proves the two halves of this plan are independently guarded: a regression in the scalar half cannot hide behind the derived half, and vice-versa. A control that turned everything red would have proven less.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] Worktree forked from the wrong base**

- **Found during:** startup, before Task 1
- **Issue:** `git merge-base HEAD 9a3808697` returned `f7cfa4a53`, not `9a3808697`. HEAD was `386b5a4d6` — *"Merge develop into master — ship v3.8"* — i.e. the worktree was created off `master`, not the dispatched `develop` tip.
- **Fix:** `git reset --hard 9a3808697fc58a14abc2249945ec091166503799` per the branch-check protocol. Confirmed HEAD is on `worktree-agent-a0188f44950e88677` (in-namespace, not a protected ref) before any commit.
- **Verification:** `git log --oneline -1` → `9a3808697 docs(217): rule the eight-section detail panel (D-217-25)`
- **Note:** this is the standing worktree hazard already recorded in memory (*"Worktrees fork from the WRONG base — assert the dispatched base SHA"*). Recorded rather than silently corrected because it recurred.

**2. [Rule 1 — Bug] The negative fence and my own comment collided**

- **Found during:** Task 2
- **Issue:** The acceptance criterion is `grep "thumbnail\|image_data\|b64" backend/app/models/document.py` returns **nothing**. My `DocumentImageRow` comment explained the constraint using exactly those three words, so a correct comment would have failed the check that exists to catch the thing it warns about.
- **Fix:** Reworded to state the measured column list verbatim (`id, document_id, user_id, page, image_index, description, created_at, bbox, org_id`) and the rule (*"no field promising a picture may ever be added"*) without using the fenced tokens. **The fence itself was not weakened.**
- **Verification:** grep exits 1; the wire-shape fence in the test file (`test_no_field_promises_image_bytes`) additionally checks the SERIALIZED keys, which is the surface that actually matters and which a source grep cannot see.

**3. [Rule 3 — Blocking] Commit-msg hook capped the body at 12 lines**

- **Found during:** Task 2 commit
- **Issue:** `commit-msg REFUSED — 13 content lines, cap is 12.`
- **Fix:** Condensed the message; the displaced reasoning is in this SUMMARY, which is where the hook says it belongs.

---

**Total deviations:** 3 auto-fixed (2 blocking, 1 bug)
**Impact on plan:** No scope creep. Nothing was added beyond the plan's three tasks; two of the three deviations are environment/tooling, one is a self-inflicted collision between a comment and a fence.

## Issues Encountered

**The `text/csv` asymmetry is load-bearing and easy to get wrong.** `tables_stage_applies("text/csv")` is `True` while `images_stage_applies("text/csv")` is `False` — the images extractor's set is PDF + DOCX only. A single shared predicate would have been quietly wrong for every spreadsheet in the library. `test_applicability_booleans_agree_with_the_service_predicates` drives five mimes through both the wire and the predicates so the two can never drift into separate lists.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, no new auth path, no schema change, no file access, and no package installed (`T-217-SC` is inapplicable by measurement — no `requirements.txt`, npm or sandbox-tag change). `list_documents`'s ownership filter is byte-unchanged: the two new columns belong to rows the caller already received (T-217-01), and both computed properties are pure set membership on a string with no `await` and no I/O (T-217-02).

## Next Phase Readiness

**Ready for plan 02.** The four row models it needs are exported from `app.models.document` and import cleanly; `DocumentQueryRow` was deliberately left out (it belongs in `document_queries.py` at plan 03, so the service-role carve-out keeps one auditable rationale).

**Carry-forward for the frontend plans (05 / 07):**

1. ⚠ **M-1 STAYS OWED.** This plan is the backend half only. The manual row — a real page load against a real mid-ingest document — has not been run and cannot be run from here.
2. **The two booleans must be OPTIONAL on the frontend type.** RESEARCH § *Does the Realtime merge need changing?* measured that `useDocuments.ts`'s INSERT arm casts `payload.new as Document` with **no merge**, so a document uploaded in another tab arrives without them. The strip must render an unknown-applicability conditional stage as **pending**, never **skipped**.
3. **`skipped` needs BOTH halves.** These predicates answer only *"would the legacy per-mime extractor look here"*. The `extracted_doc` fast path (`multimodal_service.py:479`) can supply tables or images for ANY mime when Docling pre-extracted them, so a `False` can sit beside a non-zero count. D-217-24's rule — `skipped` iff `not applies_to_mime and count == 0` — is stated in both docstrings, and **the count half is the caller's job**.

---
*Phase: 217-the-library-one-home-for-documents*
*Plan: 01*
*Completed: 2026-08-29*

## Self-Check: PASSED

All five files present on disk; all four commits resolve in `git log`; working tree clean.
