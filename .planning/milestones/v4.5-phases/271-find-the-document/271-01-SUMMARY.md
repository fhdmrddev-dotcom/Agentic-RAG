---
phase: 271-find-the-document
plan: 01
subsystem: backend / document search
tags: [find, search, postgrest, rls, relationships, versions, tdd]
requires:
  - document_view_resolver (Phase 113-115) — the shipped compiler + fragment walk
  - document_relationship_service (Phase 116/117) — _INVERSE_LABEL, _resolve_readable_latest, _subject_version_ids
  - Phase 270 file facts (source_created_at / source_modified_at / source_connection_id)
provides:
  - POST /document-search (user-JWT client) — the wire contract 271-03 types and 271-04 renders
  - document_search_service.search_documents (FastAPI-free; Phase 272's agent tool can reuse it)
  - document_view_resolver.apply_fragments / validate_and_compile (shared, extracted)
  - 271-BASELINES.md (frozen base gate SETS for every later 271 plan)
affects: [271-03, 271-04, 271-05, 272]
tech-stack:
  added: []
  patterns:
    - "count=exact + .order(id) + .range() walk, fail loud on a short read (SearchTruncatedError 503)"
    - "a fake PostgREST that EVALUATES recorded builder calls, so each applier is proven by content"
key-files:
  created:
    - .planning/phases/271-find-the-document/271-BASELINES.md
    - backend/app/models/document_search.py
    - backend/app/services/document_search_service.py
    - backend/app/api/document_search.py
    - backend/tests/unit/test_271_resolver_extraction.py
    - backend/tests/unit/test_271_search_core.py
    - backend/tests/unit/test_271_relationship_filter.py
    - backend/tests/unit/test_271_no_embedding.py
  modified:
    - backend/app/services/document_view_resolver.py
    - backend/app/main.py
decisions:
  - "Relationship verb semantics follow the plan's Pattern 3 table and phrase rule (<result> <verb> <P>): references+B = {p2}, referenced_by+B = {}; the plan's behaviour line saying the opposite was internally inconsistent"
  - "older_matches is computed even when the latest allow-list is empty (the sketch's worked example: latest 0 rows, hint 1, Show them = p1)"
  - "A folder whose ROOT is not caller-visible returns zero rows even if a descendant would be visible"
  - "Candidate pages are ordered by id so range windows cannot overlap or skip"
metrics:
  duration: "~1h45m"
  completed: 2026-10-03
  tasks: 3
  files: 10
---

# Phase 271 Plan 01: Document-search core and route Summary

`POST /document-search` now finds whole documents by structured fields (metadata through the
shipped compiler, name, folder subtree, who added it, the three file dates, relationship verbs in
both directions, version state) in a stated server order with an exact total and server paging,
on the user-JWT client, with no embedding, retrieval or RPC call anywhere on the path.

## What was built

**Task 1: baselines, then the extraction.** `271-BASELINES.md` was committed first (`259b79d4c`),
before any source edit: the backend failed SET (71, 0 collection errors), the vitest verdict
verbatim, the 70-error tsc SET, and the resolver integration guard. Then `_apply`'s body and the
validation block moved verbatim out of `resolve_filter` into module-level `apply_fragments(q,
fragments, subtree=None)` and `async validate_and_compile(caller, flt, supabase)`.
`resolve_filter` now calls both and its contract is unchanged (latest only, `created_at desc`,
D-113-5 drop).

**Task 2: model and core.** `DocumentSearchRequest` implements the wire contract exactly, with
`extra="forbid"` on all five models, closed Literals and UUID ids. `search_documents` does the
following:
- validates and compiles metadata through the shared functions (no fork; 0 matches for
  `q.contains("metadata"` in the service)
- resolves the folder: a visible subtree, or the folder alone, or `IS NULL` for "Not in a folder".
  An unreachable folder returns zero rows and issues no documents query.
- applies name (escaping `\`, `%`, `_`), added-by, the timestamptz day-boundary dates (relative
  windows come from the shipped `_relative_window`) and the version base
- reads candidates from the own leg and the global-folder leg as two queries (own leg only for
  `older`, P-03), with `count="exact"` plus a `.range()` walk, and raises `SearchTruncatedError`
  (503) on a short read
- computes `has_earlier` from one batched lineage read
- sorts in Python with nulls last in both directions and an id tiebreak, then slices the page
- hydrates the page with `select *`, `version_count`, `has_earlier` and `source_connection_name`
  (the documents.py:799-814 shape; a failed read leaves the names None)

**Task 3: relationships, route, fence.** `_relationship_allow_list` resolves the picked document
P with `_resolve_readable_latest(..., supabase=<route client>)`. If P is unreadable it returns the
zero-result shape and no edge query runs. It takes P's lineage from `_subject_version_ids`. An
outgoing verb filters `target_doc_id IN versions(P)` and returns the sources. An incoming verb
filters `source_doc_id IN versions(P)` and returns the targets. Latest follows each endpoint to its
lineage's latest row, excluding P's own. Older is row-exact. The allow-list is applied inside both
legs. `older_matches` is the same pipeline run with `version="older"` (count only), so "Show them"
returns exactly that many rows. The new `api/document_search.py` router maps `ResolveError` to
`HTTPException`. `main.py` gets one import plus one `include_router` line, placed after
`document_views.router`.

## TDD evidence

**Task 1 RED** (`146a5ac32`): 6 failed, all `AttributeError` / `ImportError`
(`module 'app.services.document_view_resolver' has no attribute 'apply_fragments'`;
`cannot import name 'apply_fragments'`; `... has no attribute 'validate_and_compile'`; the walk
assertion `the walk must live ONLY in apply_fragments`). **GREEN**: the six targeted suites
(`test_271_resolver_extraction`, `test_115_resolver_extraction`, `test_113_view_filter_compiler`,
`test_114_view_filter_compiler`, `test_115_handler_modes`, `test_115_whitelist_guard`) gave
**50 passed, 2 xfailed**. **Integration guard (:54322 reachable):** the five shipped resolver
integration suites gave **28 passed before and 28 passed after**.

**Task 2 RED** (`ca4797f76`, with the new modules absent): `21 failed, 32 errors`, all
`ModuleNotFoundError: No module named 'app.models.document_search'` (21) /
`'app.services.document_search_service'` (32). **GREEN** (`1dc5e4368`): 59 passed (core plus
extraction).

**Task 2 RED drive per applier.** Each applier was neutered one at a time (`return q` on its
first line) and the core suite re-run. Every applier turned at least one test red. The service
was then restored and md5-verified (`756d6bcd…`).

| Applier removed | Result | Tests that turned red |
|---|---|---|
| name | 1 failed | `test_name_is_escaped_once_per_leg` |
| folder | 3 failed | `test_folder_subtree_narrows_every_leg`, `test_folder_without_subfolders_is_the_folder_alone`, `test_not_in_a_folder_is_folder_id_null` |
| added_by | 3 failed | `test_added_by_me`, `test_added_by_connection`, `test_added_by_others` |
| dates | 4 failed | `test_added_before_is_strict_day`, `test_added_after_starts_the_next_day`, `test_added_between_keeps_the_whole_last_day`, `test_relative_dates_use_the_shipped_window` |
| version | 3 failed | `test_version_latest_is_the_default_on_both_legs`, `test_version_older_is_own_leg_only`, `test_version_has_earlier_is_by_lineage` |

**Task 3 RED** (`65387c0ed`, Task-2 service, route module absent): 26 failed. These were every
relationship content test (`ValueError: not enough values to unpack` because no edge query was
issued, or wrong id sets), the four route tests (`ImportError: cannot import name 'document_search'
from 'app.api'`), the identity test (`no attribute '_resolve_readable_latest'`), and the source
fence for the missing `api/document_search.py`. **GREEN** (`f2a216b22`): all four 271 suites gave
**137 passed**.

**Task 3 RED drive (D-05).** The edge query's `target_doc_id` and `source_doc_id` were swapped for
both verb families. That gave **16 failed / 11 passed**, including
`test_the_two_directions_return_different_sets_on_an_asymmetric_edge`,
`test_superseded_by_queries_the_source_side`, `test_references_both_directions` and all 8
`test_each_verb_selects_its_rel_type_and_side` cases. The service was restored and md5-verified.

## Gates

- **Full backend gate (end of Task 3):** `71 failed, 6230 passed, 1 skipped, 2 xfailed, 2 xpassed`.
  The failed SET is **identical** to 271-BASELINES.md (diffed node id by node id). Passed grew by
  138: 137 are the new 271 cases, and the remaining 1 was not attributed.
- Acceptance greps all hold:
  - 0 embedding/retrieval imports in the service
  - 0 `.rpc(`, 0 `HTTPException` and 0 `q.contains("metadata"` in the service
  - 6 `extra="forbid"` in the model
  - 1 `include_router(document_search.router)`
  - 3 `get_user_supabase_client` in the route
  - 0 `get_supabase()` in the route and in the service
  - both relationship-helper calls pass `supabase=`
- `git diff 20050816d -- document_relationship_service.py api/document_views.py api/documents.py
  models/document_view.py` is **empty**.
- `node scripts/check-hot-file-ledger.cjs .planning/phases/271-find-the-document` gave **ledger
  gate OK** (375 rows, 35 watched).
- No frontend file was touched, so vitest and tsc were not re-run after the edits. Their base SETS
  are frozen in 271-BASELINES.md for 271-03 and 271-04.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1: plan inconsistency] `referenced_by` / `references` expectations**
- **Found during:** Task 3, while writing the test.
- **Issue:** The behaviour list says `referenced_by + B → {p2}; references + B → {}`. That
  contradicts the plan's own Pattern 3 table (an outgoing verb matches sources whose target is in
  versions(P)), the `<result> <verb> <P>` phrase rule, and the plan's other two direction tests.
  The edge `p2 references B` means "p2 references B" and "B is referenced by p2".
- **Fix:** Implemented and tested per the table: `references + B = {p2}`,
  `referenced_by + B = {}`, `referenced_by + P = {B}`, `references + P = {}`.
- **Files:** `test_271_relationship_filter.py`, `document_search_service.py`.

**2. [Rule 2: correctness] Stable candidate paging**
- The range walk orders by `id`. Without an `ORDER BY`, Postgres page windows can overlap or skip
  rows. Rows are also deduped by id.

**3. [Rule 2: correctness] Bounded lineage reads**
- The has_earlier lineage read (`filename IN (...)`) is batched at 100 filenames per request, so a
  large candidate set cannot build an unbounded URL. It is still one read for any page or typical
  result set.

**4. Stricter folder reachability**
- A folder whose root is not caller-visible returns zero rows even when a descendant is visible.
  This is the conservative reading of "an unreachable folder returns ZERO rows".

**5. Test adjustments and placement**
- `test_the_allow_list_is_applied_inside_both_legs` filters to the latest pipeline's two legs,
  because the `older_matches` count issues its own own-leg query. It also asserts that query
  carries `in_("id", [C1])` and `eq("user_id", caller)`.
- The fake PostgREST lives in `test_271_search_core.py` and the other two suites import it (the
  `test_240` precedent), so no new helper file was added.
- The embedding fence patches two more sites than the plan lists:
  `embedding_service.embed_texts` and `app.api.documents.embed_chunks`.

**6. Model strictness beyond the contract text**
- `FindDate` also rejects a `value2` or `unit` where the op takes none.
- `within_next` / `older_than` require a real int. The string `"7"` and `bool` are rejected.

## Observations (not deviations)

- **Vitest base gate is RED** (73 failed in 8 files). The frontend tree was untouched and two
  sibling agents were running. 4 of the 8 files are SEED-171's named flaky suites. The failing
  files were captured from the persisted JSON before any re-run and are recorded in
  271-BASELINES.md §(b). **Provably inherited** (empty frontend diff), recorded as an observation.
- Line endings: the files written here are LF in the working copy, and git normalises them on
  commit (autocrlf). The committed diffs are minimal (`main.py` +2/-1).

## Known Stubs

None.

## Threat Flags

None. The new route is the planned surface (T-271-01..07). The plan's threat register covers the
user-JWT client, the two caller-scoped legs, the narrowing-only allow-lists, the no-oracle zero
shape, bound values, the limits, and own-only `older`, and each has a unit test.

## OWED

- **Live DB proofs of this plan's code:** the two-org fence on real PostgREST/GoTrue and seeded
  lineage/edge content tests. These belong to 271-05 by plan.

## Self-Check: PASSED

- FOUND: all 8 created files and both modified files.
- FOUND commits: `259b79d4c`, `146a5ac32`, `f85530cb8`, `ca4797f76`, `1dc5e4368`, `65387c0ed`,
  `f2a216b22`.
