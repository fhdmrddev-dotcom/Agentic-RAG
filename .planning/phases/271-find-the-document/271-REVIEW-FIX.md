---
phase: 271-find-the-document
fixed: 2026-10-03
base: a007288b0
source: 271-REVIEW.md (CR-01, CR-02, WR-01, WR-04) + 271-VERIFICATION.md (F-2)
independent_review: self
fixed_findings: [CR-01, CR-02, F-2, WR-01, WR-04]
deferred_findings: [WR-02, WR-03, WR-05, F-1, F-4, IN-01, IN-02, IN-03, IN-04, IN-05, IN-06, IN-07, IN-08]
status: all_fixed_gates_green
---

# Phase 271: Review Fix Report

A bounded fast-fix pass on the main working tree (`develop`), fresh context. **No new capability was added.** Each fix was driven RED first by a test that reproduced the defect on the shipped code, then fixed, then GREEN. One commit per fix (test and fix together, RED recorded in the commit body).

## Fixed

| Finding | Commit | RED observed | Fix | Tests |
|---|---|---|---|---|
| **CR-01** Views tab shows Find's chips over an unfiltered list | `f5b9f43de` | After ＋ Document type = Contract in Find, the Views tab listed `browse-only.pdf` (the Root list) under the Contract chip | **Option chosen: re-resolve on entering Views**, through the existing `resolveFilterIntoList` — no fork. A ref marks the list stale when Find changes the shared filter; entering Views resolves it (by id if the parked saved view's filter is unchanged, else ad hoc) and any resolve clears the mark. Find itself still never calls the browse resolver (its catch-to-unfiltered arm stays Views-only), and entering Views with nothing changed costs no request. | `LibraryPage.find271.test.tsx` +2. Views-tab DOM snapshot pins (`FilterBar.find271.test.tsx`, 3 cases) green. |
| **CR-02** Find's delete drops the promise | `4ffc43c01` | The dialog closed at once on a failing delete; vitest reported an unhandled rejection `Error: boom` | `onDelete` is `async`, awaits `deleteDoc`, then `retry()`. `DocumentList`'s `onDelete` type is `void \| Promise<void>`. Find's `onRefresh` catches a failed reload. | `LibraryPage.find271.test.tsx` +2 (failure keeps dialog + "Delete failed. Please try again." and does not re-ask; success closes only after the delete, then re-asks) |
| **F-2** older-version rows: Re-ingest silently no-ops; Move/Delete offered | `3357e07b4` | An `is_latest: false` row rendered Re-ingest and Move | Backend read first (`backend/app/api/documents.py`). **Re-ingest** filters `.eq("is_latest", True)` (`:1291`) → 404, which the list only `console.error`s: hidden. **Move** has no latest gate and moves ONE row out of its lineage's folder (`:1908-1950`) — the old version leaves its siblings, and "Delete all versions" (scoped by folder) would then miss it: hidden. Both replaced by the words *"Older version: re-ingest and move work on the latest"* (in the Actions cell, not a tooltip). **Delete works correctly on an older row and is left**: the version delete removes exactly that row and promotes only when the deleted row is latest (`:1864-1890`). | `DocumentRow.find271.test.tsx` +2 |
| **WR-01** Ask double press opens two chats; failure is silent | `aa12e207b` | One click + click + Enter produced three handoffs | `LibraryPage` keeps an in-flight ref (the 267-03 `startScopedChat` shape); the Ask card's button is disabled while pending; a `false` or rejected create sets `failed`, and the card shows *"Couldn't open a new chat. Try again."* (`role="alert"`). A retry after a failure is a new request. `ChatLayout.handleAskInChat` already returns `askInChat`'s promise and `useThreads.newThread` throws on failure, so `false` reaches the page. | `LibraryPage.find271.test.tsx` +1, `AskHandoffCard.test.tsx` +2 |
| **WR-04** filename `in`-lists with `"` or `\` | `a791fc115` | `version_count` 1 instead of 2; `version="has_earlier"` and the relationship filter returned `[]` | `_pg_in_list` quotes every member and escapes `\` then `"`; the lineage read and the relationship heads read use `.filter("filename", "in", …)`. Ids stay on `.in_()`. | new `backend/tests/unit/test_271_filename_in_quoting.py` (12 cases); the shared fake gains `.filter("in")` and `parse_pgrst_in_list` |

### WR-04: the review's failure mode was measured, and it was wrong

The review predicted a 500. Probed against the **local** PostgREST (`postgrest/14.10`, anon key, read-only GETs) using a uuid column, whose cast error echoes the value the server parsed:

| Sent | Server parsed |
|---|---|
| `id=in.("Q3 "final", draft.pdf")` (postgrest-py today) | `"Q3 "final"` (quotes and all), status **400 only because the column is a uuid** — on `filename` the same request is a **200 []** |
| `("a\"b")` | `a"b` |
| `("a\\b")` | `a\b` |
| `("a\b")` | `ab` |
| `(a\b)` | `a\b` |

So the defect is a **silent wrong answer**, which is worse than the predicted error: the document's version tag reads 1, it disappears from "Has earlier versions", and the relationship filter cannot follow an older endpoint with such a name to its latest row. After the fix, the real postgrest-py builder with `_pg_in_list` sent `Q3 "final", draft (v2):x\y.pdf` and the server parsed exactly that string. The test fake now applies this measured grammar, and `WirePostgrest` runs every `.in_` through postgrest-py's real `sanitize_param`, so a quoting defect changes the asserted answer.

## Deferred

All recorded with re-open triggers in `271-REVIEW.md` → `## Deferred from review`: WR-02, WR-03, WR-05, F-1, F-4, IN-01…IN-08. **Seed-worthy:** WR-02 (server-side `is_latest` gate on classification accept/dismiss; read-only panel sections for older rows) and WR-03 ("exact total or fail loud" on the three relationship reads and the folder reads). WR-05 needs a decision first. A new observation from F-2 goes with WR-02: on an older row with `version_number > 1` the delete dialog says "promote vN-1 as current", which is false for an older row. The action is correct; only the wording is wrong.

## Gates

Every figure below was measured on the merged tree after the fixes, and each verdict line is quoted as printed.

| Gate | Result |
|---|---|
| Targeted frontend suites (cap 2) | `LibraryPage.find271` 18/18 · `DocumentRow.find271` 19/19 · `AskHandoffCard` 7/7 · `FindQuickAdd` 18/18 · `FilterBar.find271` (with the 3 Views-tab DOM snapshot pins) · `LibraryPage.test` · `DocumentList` ×2 · `DocumentRow.download270` · `askInChat`. All green. |
| Targeted backend | `pytest tests/unit/test_271_*.py -q` → **153 passed** (141 before + 12 new) |
| `npx tsc -p tsconfig.app.json --noEmit` | **70 errors, the same set as at base `a007288b0`** (the diff with line and column numbers stripped is empty) |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (run once, from the repo root) | `total 9429 · failed 0 · pinned total 8674` · **`count gate OK — 374/374 pinned files present, no per-file decrease, 0 failing.`** exit 0. The known reds at base (WorkflowsPage ×2, PublishGauntlet ×2) and the LibraryPage/sketchComposition first-case flakes were all green on this run. That is one sample and proves nothing about their flakiness. |
| Count-gate BASELINE | `FindQuickAdd.test.tsx` **re-pinned 12 → 18** (it already ran 18). Raised: `LibraryPage.find271` 13 → 18, `DocumentRow.find271` 17 → 19, `AskHandoffCard` 5 → 7. No new frontend suite was created, so TARGETS is unchanged. ⚠ The gate lists five suites as unpinned `new` (`PromptVariableChips` 3, `RunHero` 18, `automationFacts` 11, `nodeEffectBanner` 8, `toolReadOnlyMap` 7). None belongs to this pass, and they were left unpinned. |
| `node scripts/check-backend-unit-baseline.cjs` | **`71 failed, 6246 passed, 1 skipped, 2 xfailed, 2 xpassed`**, 0 errors: **`[GATE PASSED]`** at the 71 ceiling. None of the 71 is a `test_271_*` or document-search test. |
| Live (local PostgREST 14.10, read-only) | WR-04 encoding round-trips exactly. See the table above. |

Not run: the Chrome/G-4 live drive of the four frontend fixes. They are proven through the page-level suites only.

## Files

- `frontend/src/pages/LibraryPage.tsx` — CR-01, CR-02, WR-01 (G-5 hot file; additive: 1 ref + 1 effect, 1 awaited callback, 1 ref + 1 state)
- `frontend/src/components/ingestion/DocumentList.tsx` — CR-02 prop type
- `frontend/src/components/ingestion/DocumentRow.tsx` — F-2
- `frontend/src/components/library/find/AskHandoffCard.tsx` — WR-01
- `backend/app/services/document_search_service.py` — WR-04
- tests: `LibraryPage.find271.test.tsx`, `DocumentRow.find271.test.tsx`, `AskHandoffCard.test.tsx`, `backend/tests/unit/test_271_search_core.py`, `backend/tests/unit/test_271_filename_in_quoting.py`
- `scripts/vitest-count-gate.cjs` — BASELINE re-pins (no new frontend suite, so TARGETS is unchanged)

⚠ The hot-file ledger triples for `LibraryPage.tsx`, `DocumentRow.tsx`, `DocumentList.tsx` and `document_search_service.py` were not re-derived in this pass (no PLAN.md, so the ledger gate did not run). `graphify update .` was not run, because `graphify-out/` already had uncommitted changes from someone else.
