---
phase: 271-find-the-document
verified: 2026-10-03T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 - NEVER "reviewed". No independent reviewer exists.
status: human_needed
score: 5/5 roadmap success criteria verified (code + live proofs); operator sign-off owed
overrides_applied: 0
human_verification:
  - test: "Operator sign-off on G-4 rows G4-1..G4-6 (driven in Playwright Chromium by the executor, not Chrome MCP)"
    expected: "Operator recognises each flow as working"
    why_human: "G-4 lived-experience gate; operator sign-off owed by design"
  - test: "P-01 default sort (added_desc) and P-03 (Older versions = caller's own rows only)"
    expected: "Operator accepts both product decisions"
    why_human: "Product decisions flagged for operator review"
---

# Phase 271: Find the Document - Verification

**Goal:** Find a document by what it is, in a document search beside RAG that returns documents; classification rules live in the Library.
**Re-verification:** No.

## Checks run by the verifier
- `pytest tests/unit/test_271_*.py`: 141 passed.
- `tsc -p tsconfig.app.json --noEmit`: 70 errors, equal to the base of 70. The UAT log's set diff shows only line shifts of base errors.
- `vitest run src/components/library/find src/hooks/useDocumentFind`: 7 files, 93 passed.
- Code reads:
  - `document_search_service.py` has no embedding or retrieval import, and `test_271_no_embedding.py` pins that.
  - `api/document_search.py` is mounted at `main.py:880`.
  - `LibraryPage.tsx` wires `useDocumentFind`, `DocumentsFindBody` and `askInChat`, and holds one Filing rules mount.
  - `ActiveView` has no `classification` member and `nav-items.ts` has no live entry for it (only a comment).
- I did not re-read the live test files. The two-org fence, relationship, folder and version-state evidence rests on the passing unit tests and the UAT log.

## Success criteria
| SC | Status | Evidence |
|---|---|---|
| 1 type+owner+date+custom field, one row per document | VERIFIED | `test_271_search_live.py` (the combined request returns exactly the one target of five rows); G4-1 |
| 2 distinct mode, no embedding call, stated sort, no merge | VERIFIED | no-embedding test and source fence; the Ask/Find switch; the sort is a named field sort |
| 3 folder subtree, relationships in both directions, version states | VERIFIED | live tests (verb pairs, subtree on/off, Latest/Older/has_earlier, restore route); the RED plant was driven and restored |
| 4 Classification out of the rail, Filing rules in the Library, rules still apply | VERIFIED | G4-3; `test_118_ingest_*` 4 passed; reachability fence |
| 5 two-org RLS fence | VERIFIED | `test_271_two_org_fence.py` (5 cases) through the anon key plus a GoTrue JWT; the widened-app-leg case failed under the service-role client, so it is not vacuous |

## Findings routed, not fixed
- **F-1** (raw field keys in Find chips, duplicate Document type/Date offers). It violates UI-SPEC S6 copy but no ROADMAP success criterion. No "how we'd know this failed" clause fires: filters take effect and no filter is ignored. WARNING (polish), routed to `/gsd:quick`.
- **F-2** (Re-ingest on an older-version row silently no-ops; Move/Delete offered). Not a ROADMAP success criterion. It is a real silent-failure UX defect that Find newly exposes, and it is not a failure of the goal. WARNING. Recommend `/gsd:fast` (hide or disable Re-ingest when `is_latest === false`) before deploy. Move and Delete were not driven, so their behaviour is unverified.
- **F-4** is inherited from `ConditionPopover` and is out of scope.

## Gates
- Backend unit suite: 71 failed, identical to the baseline set, so the ceiling holds with zero headroom.
- Vitest count gate is RED (`failed 4`: `WorkflowsPage` 2 and `PublishGauntlet` 2). The log claims both are unmodified (0 diff lines) and red at the base (11 and 14 failures there), and that the run 1 LibraryPage-family timeouts were fixed (3 of 3 green).
- I did not re-run the full gate, as instructed. I did not independently diff the failing suites against the base. I accept the claim as probable but unverified. The phase's own Find suites pass.

## Anti-patterns
No debt markers were examined in depth. Nothing blocking was found in the checks above.

## Status rationale
There are no failed truths. Status is `human_needed` because the G-4 operator sign-offs and P-01/P-03 are owed by design. The red count gate is an inherited-by-claim WARNING, not a blocker for this phase's goal. F-2 is worth a fast fix before deploy.
