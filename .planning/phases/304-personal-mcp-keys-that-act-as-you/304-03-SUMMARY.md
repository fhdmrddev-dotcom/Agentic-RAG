---
phase: 304-personal-mcp-keys-that-act-as-you
plan: 03
subsystem: security / retrieval (narrowed MCP reads)
tags: [rls, parity, mcp-keys, integration, headline]
requires:
  - "304-01: acting_member_connection / acting_as, list_acting_folders, migrations 220/221 applied locally"
  - "304-02: resolve_mcp_principal, KeyRefused, compose_key_scope / EXTERNAL_SQL, mint_key(kind), create_api_key(kind=...)"
provides:
  - "acting_member_reads: list_folders, list_documents, read_document, search, list_views, view_documents, related_documents, list_workflows, ToolNotGranted, READ_TOOL"
  - "tests/integration/phase304_fixtures.py: the shared two-org non-owner world + real key minting/resolution"
  - "D-15 gate 3 record: evidence/parity-gate3.txt"
affects: [305, 306, 307]
tech-stack:
  added: []
  patterns:
    - "per-call KeyScope composed from the acting connection's folders; () returns before any SQL"
    - "connector-fed exclusion as a post-filter on the acting connection, never a retrieval allow-list"
    - "app retrieval services reused inside acting_as so their RPC connections carry the GUC"
key-files:
  created:
    - backend/tests/integration/phase304_fixtures.py
    - backend/tests/integration/test_304_two_org_parity_live.py
    - backend/tests/integration/test_304_narrowed_key_live.py
    - .planning/phases/304-personal-mcp-keys-that-act-as-you/evidence/parity-gate3.txt
  modified:
    - backend/app/services/acting_member_reads.py
    - backend/tests/unit/test_304_acting_reads_fence.py
decisions:
  - "Search's connector-fed post-filter KEEPS rows whose document is visible on the acting connection AND not connector-fed (fail-closed), rather than dropping rows found to be connector-fed"
  - "A view's own folder scope mirrors the app (D-113-5: an unreachable view folder narrows nothing); the key's scope is never relaxed that way and an empty intersection matches nothing"
  - "read_document / related_documents take the LATEST version only: a superseded id is the same not-found (the app follows an old relationships subject forward; the key does not). Endpoints are still followed to their latest version"
  - "The fence forbids passing document_ids (the `document_ids =` kwarg), not the bare name: view_documents reads ScopeResult.document_ids"
metrics:
  duration: "~1h 35m"
  completed: 2026-10-30
  tasks: 3
  files: 6
---

# Phase 304 Plan 03: Narrowed MCP reads + the two-org parity headline Summary

`acting_member_reads.py` now has every read 305's tools will wrap. Each read runs on the acting-member RLS connection, so RLS plus the acting-org GUC is the only visibility rule. On top of that sits the key's own scope (folder subtrees, connector-fed exclusion, tool subset), composed fresh on each call. The headline test passes live with 0 skips: U is a non-owner member of two orgs, and a key in X returns exactly what the app returns for U with X active, including a co-member's shared folder and document, and nothing from Y. Every way access can end is refused on the very next resolution.

**Start state:** the worktree came up on `4bc4a872f` (master). Its merge-base differed from the plan base, so I reset it to `dadc7008ab3528c54c55c88abe6c289c6ade2cd1` before any work.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `7e0dab365` | test(304-03): add failing two-org parity suite for folders, documents, read and workflows (RED) |
| 2 | `b1041743e` | feat(304-03): narrowed folders, list, read and workflows reads on the acting connection (GREEN) |
| 3 | `21490660a` | test(304-03): add failing search, views, relationships parity + narrowed-key suite + fence (RED) |
| 4 | `c1eab2496` | feat(304-03): narrowed search, views and relationships reads (GREEN) |
| 5 | `382ec3f7f` | test(304-03): negative arms at the live resolver — next resolution refused, switch back restores |
| 6 | (this commit) | docs(304-03): SUMMARY + gate-3 evidence |

## What was built

- **The shared fixture (`phase304_fixtures.py`).**
  - U has role `member` in both X and Y, and the fixture asserts it.
  - Co-members V_X and V_Y each own an org-shared folder with a document. V_X also owns a private folder, which U must never reach.
  - U's data: in X, a folder F and its subfolder F2, a superseded and a latest version of one document, a connector-fed document in F, and a Root document; in Y, a folder and a Root document.
  - Chunks carry a per-org token and embedding axis. Each chunk has a strict rank on both search arms, so two separate searches cannot order ties differently.
  - Also seeded: three views in X and one in Y, four relationships in X (including one to a Y document and one to V_X's private document), and published and draft workflows.
  - Keys go through `mint_key` + `create_api_key` and are resolved with `resolve_mcp_principal`.
- **The reads.** Each calls `_require(principal, read)` first. A key that lacks the read's catalogue tool gets `ToolNotGranted` (KEY-03).
  - `list_folders`: the acting folders, cut to the key's subtrees.
  - `list_documents`: `GET /documents`'s columns over `library_documents`, with the same order and page contract and an exact total.
  - `read_document`: one not-found for unreadable, foreign, out-of-scope, superseded and malformed ids.
  - `search`: `retrieval_service.search_documents` inside `acting_as` with the key's `folder_ids`, then the connector-fed post-filter. Settings come from `load_user_settings`, the same loader the app's search path uses.
  - `list_views` and `view_documents`: views are read on the acting connection. `view_documents` resolves through `resolve_document_scope` (step 2 decides on the GUC-narrowed connection) and pages the decided ids.
  - `related_documents`: own edges over the subject's whole version lineage. Each endpoint is followed to its latest version and masked unless it is readable through the key. `_NO_ACCESS_MASK` and `_INVERSE_LABEL` are imported, not copied.
  - `list_workflows`: the app's `list_published_workflows`, given the acting connection.

## Verification

- **D-15 gate 3** (`evidence/parity-gate3.txt`), both live suites plus the fence with `-rs`: **`50 passed, 67 warnings in 100.97s` — 0 skipped, exit 0.**
- **Backend baseline (D-43), verbatim:**
  ```
  Summary:        70 failed, 10887 passed, 1 skipped, 2 xfailed, 2 xpassed, 60 warnings in 567.57s (0:09:27)
  [GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).
  ```
  None of the 70 failures is in a `test_304_*` file. The count is the same 70 that 304-01 and 304-02 measured. The only production file this plan changed is imported by no pre-existing unit test, so **none of the 70 is this plan's.**
- **Acceptance greps:**
  - `org_members` (non-comment) = **0**.
  - `document_ids=` = **0**.
  - `from app.services.document_relationship_service import` = **1**.
  - The literal mask string = **0**.
  - The narrowed suite has one arm per read path: 5 of 5.
- **Determinism:** the full set was run twice back to back, 42/42 both times (before the negative arms were added).
- **Counterfactual for the negative arms** (a scratch pytest plugin, not committed): with liveness admitting everything and `digest_key` ignoring the kind, **7 of 8 arms fail**. `mcp_key_at_inbound` still passes because the `kind`-column refusal holds (D-06 has two refusals).
- **Cleanup:** a read-only count after the runs found 0 leftover orgs, folders, documents, workflows, keys, users, connections and views. `app_settings.mcp_enabled` is back to `true`. The local-DB lock was released.

## TDD Gate Compliance

- Task 1: RED `7e0dab365` (7 failed on missing reads; the non-vacuity and resolver arms passed) → GREEN `b1041743e`.
- Task 2: RED `21490660a` (15 failed on missing reads and the fence finding 0 sanctioned calls) → GREEN `c1eab2496`. Four narrowed arms were already green at RED (list, read, later subfolder, shared folder) because they exercise only the Task 1 reads.
- Task 3: test-only, because the production code is 304-02's. The arms passed first time. Red-ness was proven by the counterfactual above. No production defect was found.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug, test] Search hit identity**
- **Found during:** Task 2 GREEN.
- **Issue:** enriched search rows carry no chunk id (`KeyError: 'id'`).
- **Fix:** the parity arm compares the ordered list of `(document_id, chunk_index, content)` instead.
- **Commit:** `c1eab2496`.

**2. [Rule 2 - Security] Fail-closed search post-filter**
- **Issue:** the plan says to drop rows whose document is connector-fed.
- **Fix:** the implementation instead keeps only rows whose document is visible on the acting connection and not connector-fed. A row whose document the acting connection cannot see can therefore never slip through the exclusion.
- **Effect on parity:** none, since every returned row is visible.

**3. [Plan wording] Fence narrowed from `document_ids` to `document_ids =`**
- **Issue:** `view_documents` legitimately reads `ScopeResult.document_ids`.
- **Fix:** the fence now forbids passing the kwarg, not the bare name. The plan's acceptance grep (`document_ids=` = 0) holds.

**4. [Interpretation] "Soft-deleted X id"**
- **Issue:** `documents` has no soft-delete column.
- **Fix:** the not-found arm uses a superseded version (`is_latest = false`), plus a random id, a malformed id, an unreadable co-member id and Y's ids.

**5. [Test design] Strict chunk ranks**
- **Issue:** equal-similarity chunks could be ordered differently by two separate searches, which would make the ordered parity flaky.
- **Fix:** each fixture chunk gets a distinct vector tilt and token count.

## Known divergences (recorded for 305, not defects in this plan's scope)

- **Superseded subject:** `related_documents` with a superseded subject id returns not-found. The app's relationships route follows it forward to the latest version. Endpoints are still followed forward.
- **Archived documents:** `read_document` does not exclude archived documents; the plan did not ask for it. `list_documents` does exclude them, as the app's list does.
- **Connection-visible documents:** RLS on `documents` admits org-visible connector documents of other members, which the Library view excludes. They reach `read_document` and search only with `include_external`.

## Known Stubs

None.

## Threat Flags

None. T-304-20..27 are each mitigated and pinned by a live arm or a fence test. There is no new endpoint and no schema change.

## Self-Check: PASSED

- All 6 key files exist in the worktree.
- Commits `7e0dab365`, `b1041743e`, `21490660a`, `c1eab2496` and `382ec3f7f` are present in `git log`.
- STATE.md and ROADMAP.md are not modified.
- No edits were made to `threads.py`, `agent_loop.py`, `dispatcher.py`, `lib/api.ts` or any reused retrieval, document or workflow service.
