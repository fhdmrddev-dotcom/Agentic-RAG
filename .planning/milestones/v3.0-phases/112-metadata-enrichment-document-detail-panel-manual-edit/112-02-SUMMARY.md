---
phase: 112-metadata-enrichment-document-detail-panel-manual-edit
plan: 02
subsystem: api
tags: [fastapi, supabase, jsonb, metadata, reextract, merge-guard, pytest, asyncpg]

# Dependency graph
requires:
  - phase: 112-metadata-enrichment-document-detail-panel-manual-edit
    plan: 01
    provides: "PATCH /documents/{id}/metadata server-stamps metadata._source[field]='user'; test_112_reextract_merge.py xfail contract"
  - phase: 111-metadata-enrichment-extraction-backend
    provides: "ingest_document enriched/legacy metadata branch; attach_confidence nested-key shape; metadata_dict=None degrade layers"
provides:
  - "Re-extract precedence merge guard at the single ingest_document metadata-write site (META-05 edit-protection half)"
  - "_source='user' fields preserved (value + marker, no _confidence) across ALL three re-extract entry points (/upload, /reingest, /reextract)"
  - "Degrade safety: metadata_dict=None promoted to {} so a degrade never wipes a human edit"
  - "Live :54322 merge proof (test_112_reextract_merge.py un-xfailed, drives the REAL ingest_document)"
affects: [112-04-document-detail-panel]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Re-extract precedence merge at the SINGLE write site (Pitfall 1): the guard reads the PRIOR doc's metadata._source map (no request-scoped body in ingest_document's scope), so all 3 re-extract entry points inherit it"
    - "Degrade-promote (Pitfall 2): metadata_dict = metadata_dict or {} BEFORE the user-field loop so a None degrade with prior user fields yields {user fields + _source}, never None"
    - "Honest-provenance merge: a preserved user field drops its fresh _confidence (a human override has no model score) and a human-cleared field stays cleared (else: pop branch)"
    - "Live-DB merge test that drives the REAL ingest_document with hermetic extract/embed monkeypatches (no LLM/embedding network) so the guard is genuinely exercised, not a hand-written post-guard stand-in"

key-files:
  created: []
  modified:
    - "backend/app/api/documents.py"
    - "backend/tests/integration/test_112_reextract_merge.py"

key-decisions:
  - "Guard placed immediately after the document_type/language normalize block and before the chunk-embedding header build, so a preserved human-corrected title also flows into the chunk-embedding context header (the embedding reflects the human correction)"
  - "Used getattr(prior, 'data', None) on the prior SELECT (carries the 112-01 lesson: supabase-py .maybe_single().execute() returns None on a no-row miss, so prior.data would AttributeError)"
  - "Rewrote the Wave-1 stand-in test (which hand-wrote the post-guard expectation via a manual UPDATE) into a real merge proof driving ingest_document — base-checkout confirms it FAILS without the guard (load-bearing, not false-green)"

requirements-completed: [META-05]

# Metrics
duration: ~25min
completed: 2026-06-18
---

# Phase 112 Plan 02: Re-Extract Precedence Merge Guard Summary

**The re-extract precedence merge guard at the single `ingest_document` metadata-write site — a human correction (`metadata._source[field]='user'`) is preserved (value + marker, no `_confidence`) across ALL three re-extract entry points (/upload, /reingest, /reextract), a degrade never wipes an edit, and a cleared field stays cleared — proven live against :54322 by driving the REAL `ingest_document`.**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-18 (Task 1)
- **Completed:** 2026-06-18
- **Tasks:** 1 (tdd="true")
- **Files modified:** 2 (1 production + 1 test)

## Accomplishments
- Inserted the Phase 112 D-03 (META-05) merge guard between the metadata normalize block and the final `documents` UPDATE in `ingest_document` — the SINGLE metadata-write site that ALL three re-extract paths funnel through.
- The guard reads the PRIOR doc's `metadata._source` map (NOT a request-scoped `body` field — there is no `body` in `ingest_document`'s scope, so Pitfall 1 is structurally self-enforced), restores `_source='user'` fields, drops their fresh `_confidence`, and keeps human-cleared fields cleared.
- Degrade safety (Pitfall 2): `metadata_dict = metadata_dict or {}` BEFORE the user-field loop so an enriched-extraction degrade (`metadata_dict=None`) with prior user fields yields `{user fields + _source}`, never `None`.
- Rewrote `test_112_reextract_merge.py` from the Wave-1 xfail stand-in (which hand-wrote the post-guard expectation via a manual `UPDATE`) into a genuine merge proof that drives the REAL `ingest_document` with hermetic extract/embed boundary monkeypatches — added a third case (cleared-stays-cleared).
- **6/6 target tests pass live against :54322** (3 merge proofs + 3 `@>` flat-filter proofs). Net-new full-slice failures = **0** (SEED-056 base-checkout proven).

## Task Commits

1. **Task 1: Insert the re-extract precedence merge guard + un-xfail the live merge test** - `58ada73c` (feat)

_Note: this plan's single task was `tdd="true"`. The RED phase was the Wave-1 xfail stand-in already on disk (`21d96953`); this commit is the GREEN phase (the production guard) plus the test made-real (it now drives `ingest_document` and is base-checkout-proven to fail without the guard). Combined into one commit because the test is only meaningful as a proof of the guard it exercises._

## Files Modified
- `backend/app/api/documents.py` — added the merge guard in `ingest_document` (between the `document_type`/`language` normalize block at ~:1572 and the final `documents` UPDATE at ~:1696). Purely additive above the existing UPDATE; the normalize block and the UPDATE columns are untouched; the guard is a no-op on a first upload (prior `_source` is `{}`).
- `backend/tests/integration/test_112_reextract_merge.py` — removed the 2 `xfail` marks; rewrote both tests to drive the REAL `ingest_document` against `:54322` with hermetic `load_app_settings`/`extract_metadata`/`chunk_text`/`embed_chunks` monkeypatches; added `test_reextract_keeps_cleared_field_cleared` (the cleared-field branch). Reuses the 112-01 service-role-client pattern (`_supabase_or_skip`) + the 111 live-DB asyncpg harness.

## Decisions Made
- **Guard placement: after the normalize block, before the chunk-embedding header build.** A preserved human-corrected `title` therefore also flows into the chunk-embedding context header — correct, since the embedding should reflect the human correction (not the discarded model value).
- **`getattr(prior, "data", None)` on the prior SELECT** — carries the 112-01 live-discovered lesson that supabase-py `.maybe_single().execute()` returns `None` (not an object with `.data=None`) on a no-row miss; a bare `prior.data` would `AttributeError`.
- **Test made-real over hand-written stand-in.** The Wave-1 test asserted the post-guard expectation via a manual `UPDATE` (the guard was never exercised). The rewrite drives the actual function; base-checkout proves the tests FAIL without the guard (load-bearing, no false-green).

## Deviations from Plan
None — plan executed exactly as written. The merge guard matches the RESEARCH "Re-Extract Merge Contract" pseudocode verbatim against the real code (the only mechanical adjustments: `getattr(prior, "data", None)` per the 112-01 None-miss lesson, and `if isinstance(metadata_dict.get("_confidence"), dict):` guarding the `_confidence` pop so it is safe when no `_confidence` exists). The plan's line reference (~:1570) had shifted to ~:1572/~:1696 since RESEARCH (Wave-1 + 111.1 additions above it) — same SINGLE write site, correct placement confirmed by grep.

## Test Results — honest green/unrun ledger

**All runs below executed against a LIVE local Supabase Postgres on :54322 (confirmed reachable at execution start via asyncpg + a service-role REST probe) — no false greens.**

| File | Result | Notes |
|------|--------|-------|
| `test_112_reextract_merge.py` (live) | **GREEN (3/3)** | AC7 — preserve field A + refresh field B + NO `_confidence` on the user field; degrade (extract→None) does NOT wipe; human-cleared field stays cleared. Drives the REAL `ingest_document`. |
| `test_112_flat_filter_with_source.py` (live) | **GREEN (3/3)** | AC8 / D-111-9 — flat `@>` containment still matches with BOTH `_confidence` AND `_source` present (document_type + title) + a non-matching negative control. |

**Combined target run:** `pytest test_112_reextract_merge.py test_112_flat_filter_with_source.py -x` → **6 passed, 0 failed**.

**Net-new full-slice failures: 0** (SEED-056 base-checkout proof). The `-k "112 or document or ingest"` slice is **28 failed / 97 passed** at HEAD (with the guard) vs **31 failed / 94 passed** at base (guard stashed). The delta is the +3 merge tests the guard turns green (they FAIL at base — proving they genuinely exercise the guard, not a false-green). The 28 failures are pre-existing rot in `test_sql_service.py` (text-to-SQL `query_documents`) + `test_retrieval_service.py` — IDENTICAL at base and HEAD, import none of this plan's changed code, and were documented as the baseline in the 112-01 SUMMARY. NOT fixed (out of scope per the scope boundary), logged here.

## Threat Model Compliance
All 4 STRIDE threats in the plan's `<threat_model>` are mitigated and verified:
- **T-112-02-01** (re-extract destroying a human edit) — merge guard at the single write site preserves `_source='user'` across all 3 entry points; reads the prior `_source` map; verified by `test_reextract_preserves_user_field_and_refreshes_extracted` driving the real re-extract.
- **T-112-02-02** (degrade wiping edits) — `metadata_dict = metadata_dict or {}` before the loop; verified by `test_reextract_degrade_does_not_wipe_user_edits`.
- **T-112-02-03** (fabricated confidence on a human override) — the guard pops the preserved field from `metadata_dict["_confidence"]`; verified by asserting `"title" not in meta["_confidence"]`.
- **T-112-02-04** (`@>` containment break) — `_source`/`_confidence` stay nested sub-keys; verified by `test_112_flat_filter_with_source.py`.

## Issues Encountered
None blocking. The Wave-1 stand-in test had to be rewritten to actually drive `ingest_document` (otherwise the merge guard would never be exercised and the green would be false). The rewrite is base-checkout-proven load-bearing.

## User Setup Required
None — no external service configuration. (Live tests require local Supabase `:54322` + service-role creds in `backend/.env`, both already present on this dev tree.)

## Next Phase Readiness
- **Plan 04 (document detail panel):** the full META-05 edit→protect loop is now live — the PATCH route (Plan 01) writes `_source='user'` + drops `_confidence`, and re-extraction (Plan 02) preserves it. The panel's `ConfidenceChip` can render a `_source='user'` field as neutral "Edited" (no fabricated score), confident the merge guard keeps it neutral across re-extracts.
- No blockers.

## Self-Check: PASSED

- `backend/app/api/documents.py` present and contains the merge guard (`prior_meta` + `_source` + `metadata_dict = metadata_dict or {}` + `_confidence` pop, all confirmed by AST grep inside `ingest_document`).
- `backend/tests/integration/test_112_reextract_merge.py` present; 2 xfails removed; 3 live merge tests pass.
- `112-02-SUMMARY.md` present.
- Task commit present in git history: `58ada73c` (feat).
- No accidental file deletions in the commit (`git diff --diff-filter=D HEAD~1 HEAD` empty).

---
*Phase: 112-metadata-enrichment-document-detail-panel-manual-edit*
*Completed: 2026-06-18*
