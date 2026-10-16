---
phase: 280-in-once-out-clean
plan: 03
subsystem: backend (ingest minter / documents / folders / org scope)
tags: [dedup, versioning, race, minter, cr-01, org-scope, live-db]
requires:
  - 280-01 app.utils.db.maybe_row (the minter's folder check reads through it)
provides:
  - "mint_document_row: folder-agnostic in-flight dedup leg, insert-then-retire (neq id + lt version), 23505 -> winner for raise and link"
  - "mint_document_row folder check: folder.org_id must match the minting org; org_id=None re-homes to the folder's org after a membership check (identical 404 otherwise)"
  - "DocumentResponse.already_in_library (optional); /upload duplicate answers 200 with it set"
  - "live harness: test_280_same_bytes_live (gather race, 7 caller parameter sets) and test_280_cr01_two_org_live (seeded two-org GoTrue user)"
affects:
  - "all 7 minter callers: /upload, watch new + modified, source import, workspace promote, expert install, email attachments"
  - "POST /documents/upload response (additive optional field)"
  - "expert_install: an in-flight copy in another folder now raises ExpertInstallConflict (as a completed one already did)"
tech-stack:
  added: []
  patterns: [in-memory supabase fake that enforces documents_dedup_idx and stamps the trigger org, through-the-real-caller pins, live asyncio.gather race with separate user clients]
key-files:
  created:
    - backend/tests/unit/test_280_minter_sequence.py
    - backend/tests/integration/test_280_same_bytes_live.py
    - backend/tests/integration/test_280_cr01_two_org_live.py
    - .planning/reported-bugs/BUG-261014-01-upload-files-a-document-into-another-orgs-folder.md
  modified:
    - backend/app/services/ingest_splice.py
    - backend/app/api/documents.py
    - backend/app/models/document.py
    - backend/tests/unit/test_266_mint_org_scope.py
    - backend/tests/unit/test_ingest_splice.py
    - backend/tests/unit/test_document_versioning.py
    - backend/tests/unit/test_274_promote_preview_parity.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
decisions:
  - "CR-01 REPRODUCES live, so it was filed as BUG-261014-01 (commit 86ab344e8) before any minter fix commit (D-05)"
  - "on_conflict no longer changes the 23505 outcome: both modes return the winner, so the parameter is kept only so no caller changes"
  - "A folder row with no org_id gets the identical 404 (folders.org_id is NOT NULL, so this only fires on a malformed fake or row)"
  - "The membership read uses the client the minter was given; org_members_self_select (user_id = auth.uid()) lets a user-JWT client read its own rows, so no service client is needed"
  - "The user-JWT non-member CR-01 case was already a 404 at HEAD (the folders SELECT policy hides other orgs' folders); it is kept as a pin, and a service-role variant (RED at HEAD) carries the real defect for that arm"
metrics:
  duration: "~42 min"
  completed: 2026-10-14
  tasks: 3
  commits: 7
---

# Phase 280 Plan 03: Same-bytes minter (FIX-02) and CR-01 Summary

The shared minter now returns an in-flight same-bytes copy instead of retiring it or answering 409.
It retires only after a successful insert, scoped so two concurrent new versions cannot retire each
other. It resolves a 23505 to the winning row for every caller. A folder now files a document only
into its own org. CR-01 reproduced live and was filed as BUG-261014-01 before the fix.

## What changed

**New query sequence in `mint_document_row`:**

| Step | Query |
|---|---|
| 1 | Folder check: `select("id, user_id, org_id")` through `maybe_row`. Missing folder → 404 "Folder not found". Another owner → the existing 403. The new org rule follows (step 1b). |
| 1b (CR-01) | If `org_id` is passed and differs from `folder.org_id` → the identical 404. If `org_id` is None → `org_members` select (`user_id`, `org_id = folder.org_id`, `limit 1`). No row → the identical 404. A row → `org_id = folder.org_id` for the rest of the call. |
| 2 | Hash |
| 3a | Completed dedup (unchanged; `test_266` pins it) |
| 3b (new) | In-flight leg: `user`, `content_hash`, `neq status failed`, `eq is_latest true` (+ `org` when known), any folder, `order created_at desc limit 1`. A hit returns `is_duplicate=True` and writes nothing. |
| 4 | Version **read** only (`has_prior_version`, `next_version`) |
| 5 | INSERT. A `23505` re-queries `(user, hash, neq failed, folder eq / is null, org when known)` for **both** `raise` and `link` and returns the winner as a duplicate. 409 only when the re-query finds nothing. |
| 6b (moved) | Retire, only after a successful insert and only when a prior version existed: `update is_latest=false` on (user, filename, org = `org_id or doc.org_id`, folder when `version_scope="folder"`) `.neq("id", new_id).lt("version_number", next_version)`. A failure is logged with the new document id, and the minted row is still returned. |

`/upload`'s existing `if mint_result.is_duplicate:` branch returns `{**doc, "already_in_library": True}`.
`DocumentResponse` gains `already_in_library: bool | None = None`, without which FastAPI's
`response_model` would strip the key. `ast.If` count, measured against `a3d9406bc`:
`upload_document` 7 → 7, `delete_document` 8 → 8. The 275 D-32 fence stays green.

**D-24 accepted residual (T-280-18):** two truly concurrent inserts into **different** folders both pass
every pre-check and both insert, and the one that completes second fails at completion on
`documents_completed_hash_unique_idx`. Closing this needs a DB constraint, which means a migration,
so it is out of scope. This is recorded in a code comment in the minter.

**D-24 side effect (stated):** `expert_install` now raises `ExpertInstallConflict` for an
**in-flight** same-bytes copy in another folder, as it already did for a completed one. A
through-the-real-caller test pins this.

**Seeds awareness (not folded; plan 04 routes them):** this fixes only the **folder** arm of SEED-313.
A `/upload` with no folder still lands in the trigger's `LIMIT 1` org. SEED-318 is unchanged: a
same-named `/upload` in the same org still retires an Expert install copy.

## RED evidence, then GREEN

**Task 1, live, at `a3d9406bc` (commit `c07829457`): 18 failed, 6 passed, 0 skipped.**

- `test_same_bytes_while_pending_returns_the_inflight_copy` failed with
  `HTTPException 409: File already exists in this folder` (the APIError 23505 was on `documents_dedup_idx`).
- `test_same_bytes_into_another_folder_while_pending_is_the_same_copy` failed with
  `assert False is True`: the second mint inserted a new row and retired the first.
- `test_two_concurrent_same_bytes_mints_leave_exactly_one_copy[0..4]`: all 5 rounds failed, each with
  `a concurrent same-bytes mint raised: [HTTPException(409)]`.
- `test_every_caller_gets_the_inflight_copy`:
  - `[upload]` and `[source_import]` failed with 409;
  - `[watch_new]`, `[watch_modified]`, `[workspace_promote]`, `[expert_install]` and
    `[email_attachment]` failed with `the in-flight copy was retired`.
- CR-01 cases:
  - `test_upload_into_a_folder_of_the_other_org_files_it_in_that_org` failed with
    `the document landed in org 46fd0dae… while its folder is in org 822306c0… (the trigger's LIMIT 1 pick is 46fd0dae…)`;
  - `test_non_member_folder_refuses_like_a_missing_folder_service_role` failed with `DID NOT RAISE` (it minted);
  - both `test_explicit_org_that_differs_from_the_folders_org_refuses` cases (`import_shape_user_jwt`
    and `watch_shape_service_role`) failed with `DID NOT RAISE`.
- Passed at HEAD, kept as pins:
  - the new-version case;
  - the 3 concurrent-v2 rounds;
  - the CR-01 positive control;
  - the user-JWT non-member case. This one was already 404 because the `folders` SELECT RLS requires
    `org_id IN current_user_org_ids()`. The plan expected it RED; it was not, see Deviations.

**Task 2, stubbed, at `a3d9406bc` (commit `4e925982e`): 14 failed, 6 passed.** The failures include:

- both through-the-real-caller pins:
  - watch fails on `the watch path did not reach the minter's in-flight leg`;
  - expert install fails on `DID NOT RAISE ExpertInstallConflict`;
- the `/upload` `already_in_library` pin, which hit a `KeyError`;
- the retire-before-insert pin: `['select','select','update','insert']`.

After GREEN (`89d41fd79`), all 20 pass, and `test_280_same_bytes_live` is 18/18 live.

**Task 3, stubbed (commit `5828bfad5`): 3 failed, 1 passed (the 403 pin).** After `8f83c307e`, the live
run of both files is **24 passed, 0 skipped** (cr01 6/6, same_bytes 18/18).

**Cleanup, verified by SQL after every live run:** `auth.users` with email `phase-271-p280%` = 0,
organizations `phase-271-280-%` = 0, folders `280-%` = 0, documents `280-%` = 0. Each fixture also
asserts its own per-user residue (`documents` + `folders` + `auth.users` + `storage.objects`) is 0 in
`finally`.

## Backend gate (D-21)

`node scripts/check-backend-unit-baseline.cjs` (lock held) reported **71 failed, 7370 passed, 0 errors:
GATE PASSED.** The failing set, normalised, was diffed with `comm -3` against
`base_failed_2dd80abbe.norm.txt` (72):

- the only difference is `test_230_ingestion_jobs_db.py::test_live_reclaim_stale_ingestion_claims_exhausted_fails_document`.
  It is in the base set and passed this run; plan 01 recorded it as the DB-state flake;
- **no new failing test.**

The first gate run read 72. One of those was a NEW failure, `test_276_openapi_snapshot_fresh`, caused by
the new `DocumentResponse` field. It was fixed by regenerating the snapshot (`eef1146e4`), and the
re-run is the figure above. Logs: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/final_gate_280-03b.log`
(and `final_gate_280-03.log` for the first run).

Other checks:

- `node scripts/check-hot-file-ledger.cjs 280`: ledger gate OK.
- `git diff a3d9406bc -- backend/app/services/ingest_splice.py`: all 4 hunks fall inside
  `mint_document_row` (lines 127-465). The queue step list is untouched (D-19).
- `grep '"Folder not found"'`: 4 sites in the minter, all with the same literal. No detail string
  mentions an org.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `test_274_promote_preview_parity`'s fake had no `lt`, so the retire silently never ran**
- **Found during:** Task 3 (caller-suite run)
- **Issue:** the retire now sits in a try/except that logs and keeps the row. Against a fake without
  `lt`, the retire raised `AttributeError` and was swallowed, so the parity cases stayed green while
  the retire never executed.
- **Fix:**
  - added `lt` to that fake;
  - gave its folders an `org_id` (D-26 needs it);
  - added an assertion that the same-folder new-version case actually retires v1.
- **Verification:** a log-capture sweep (`-o log_cli=true`) over the caller suites finds **0**
  "retiring earlier versions … failed" warnings outside the deliberate test.
- **Commit:** `8f83c307e`

**2. [Rule 3 - Blocking] `test_document_versioning.py` re-pinned (not in files_modified)**
- **Found during:** Task 2
- **Issue:** its MagicMock `execute.side_effect` lists encoded the old call order (no in-flight select,
  update before insert), so three tests raised `StopIteration`.
- **Fix:** inserted the in-flight result and moved the update after the insert, with the reason
  written in the test.
- **Commit:** `89d41fd79`

**3. [Rule 3 - Blocking] OpenAPI snapshot regenerated (not in files_modified)**
- **Found during:** the Task 3 gate
- **Issue:** `test_276_openapi_snapshot_fresh` went red on `DocumentResponse.already_in_library`.
- **Fix:** ran `scripts/export-openapi.py` and `scripts/build-public-openapi.cjs`. The diff is that
  one optional field in each file.
- **Commit:** `eef1146e4`

**4. [Plan fact correction] The CR-01 non-member case is not RED through the user JWT**
- The `folders` SELECT policy already hides a folder in an org the caller is not in, so `/upload`
  answered the 404 at HEAD.
- The defect for that arm is real only for a client that bypasses RLS. A service-role variant
  (`..._service_role`) was added and was RED at HEAD.
- Both cases now assert the byte-identical 404.

**5. `test_266_mint_org_scope.py` re-pins (planned; detail)**
- `_BASE_SEQUENCE` was re-pinned with a "Phase 280 … BUG-261005-01" comment.
- `_all_sites_db` now injects the concurrent winner at insert time. The in-flight leg correctly
  returns a copy that is present up front.
- Site (c), the retire, is reached by a second, successful mint, because the retire now runs only
  after a successful insert.
- New pins: `inflight_site`, and `test_upload_path_retires_only_after_a_successful_insert`.
- `_FolderTable` returns `org_id`.
- No pin was deleted.

## TDD Gate Compliance

- **RED:** `c07829457` (live), `4e925982e` (stub), `5828bfad5` (CR-01 stub).
- **GREEN:** `89d41fd79` and `8f83c307e`.
- **D-05 order:** the bug report commit `86ab344e8` precedes both fix commits.

## Known Stubs

None.

## Not done

`graphify update .` was not run inside the agent worktree. Updating the graph is left to the
orchestrator after merge.

## Self-Check: PASSED

- FOUND: backend/tests/unit/test_280_minter_sequence.py
- FOUND: backend/tests/integration/test_280_same_bytes_live.py
- FOUND: backend/tests/integration/test_280_cr01_two_org_live.py
- FOUND: .planning/reported-bugs/BUG-261014-01-upload-files-a-document-into-another-orgs-folder.md
- FOUND commits: c07829457, 86ab344e8, 4e925982e, 89d41fd79, 5828bfad5, 8f83c307e, eef1146e4
