---
phase: 298-lists-follow-the-active-org
plan: 03
subsystem: org-scope / move
tags: [backend, migration, org-scope, audit, cross-org-write, security]
requires:
  - 298-01 (org_items router with the router-level 401, the two-org live fixture shape)
  - 298-02 (foreign_folder_refusal.bound_folder_ids for every D-34 binding arm)
provides:
  - supabase/migrations/217_org_item_move_audit.sql (audit CHECK + 'org.item.move')
  - backend/app/services/org_move.py (preview_move, execute_move, MoveRefused, MovePreview, MoveCounts)
  - GET /org-items/move-preview, POST /org-items/move
  - SEED-393, SEED-394, SEED-395
affects:
  - audit_log_action_type_check (local DB; cloud paste owed, see Deploy notes)
  - VALID_ACTION_TYPES (boot guard now requires 217 in the database)
tech-stack:
  added: []
  patterns:
    - "one pool transaction: membership both orgs, FOR UPDATE, every refusal re-run, UPDATEs, audit INSERT"
    - "preview and execute share one _prepare, so the confirm can never check less than the preview"
key-files:
  created:
    - supabase/migrations/217_org_item_move_audit.sql
    - backend/app/services/org_move.py
    - backend/tests/unit/test_298_migration_217_shape.py
    - backend/tests/unit/test_298_org_move_unit.py
    - backend/tests/integration/test_298_org_move_live.py
    - .planning/seeds/SEED-393-thread-and-run-org-moves.md
    - .planning/seeds/SEED-394-published-workflow-org-move.md
    - .planning/seeds/SEED-395-run-start-folder-override-other-org.md
  modified:
    - supabase/full-schema.sql
    - backend/app/services/audit_service.py
    - backend/app/api/org_items.py
    - backend/tests/unit/test_298_org_items_routes.py
    - backend/tests/unit/test_293_migration_215.py
    - backend/tests/integration/test_110_audit_drift_guard.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
key-decisions:
  - "Hold refusals call retention_held_folders / retention_held_documents on the transaction connection, and a PT409 backstop maps to the move's own sentence through is_hold_refusal; map_hold_refusal was not used because its sentence says 'Nothing was deleted.'"
  - "The confirm's documents count is the LATEST version of each document (what the Library lists); earlier versions are counted separately"
  - "Two refusals were added beyond the D-33 list because a clean-looking move would otherwise corrupt data: a same-name family already in the target org (two is_latest rows in one family), and documents shared with the org through a connection (ingest_visibility org/dept)"
  - "A retention policy refuses when it is on any subtree folder OR is an include-subfolders policy on an ancestor; class policies do not refuse"
  - "An Expert bundle whose knowledge_folder_ids names a subtree folder refuses like an Expert install"
requirements-completed: [ORG-06]
duration: ~40 min
completed: 2026-10-28
---

# Phase 298 Plan 03: The audited per-item org move Summary

An owner can now move one of their own items to another organization they belong to: a Library
folder with its whole subtree, a Root document with its versions, or a draft workflow. Each move is
one transaction on the pool, with its audit row written inside it. Every case that is not clean is
refused with a sentence that names the item, the cause and the way out, and nothing changes.
Migration 217 adds the audit action type and nothing else.

## Performance

- Started: 2026-10-28T07:25Z · Completed: 2026-10-28T08:05Z (~40 min, including one backend
  baseline run of 8.3 min and the live move suite of ~1.5 min per run)
- Tasks: 3/3 (TDD: a RED commit before each GREEN)
- Files: 8 created, 10 modified

## Task Commits

| Task | Gate | Commit | Message |
|---|---|---|---|
| 1 | RED | `aa0e26ed8` | test(298-03): migration 217 shape + D-298-04 audit-set fence re-pin |
| 1 | GREEN | `6120c7541` | feat(298-03): migration 217 — audit action type for the org move (D-20, D-31) |
| 2 | RED | `711ae399b` | test(298-03): org move contract — clean kinds + every refusal class |
| 2 | GREEN | `913c9c0fb` | feat(298-03): org_move — one-transaction audited move of a folder, a Root document or a draft (D-19, D-33, D-35) |
| 3 | RED | `e16b5a3ce` | test(298-03): move routes contract + the anon-key live check |
| 3 | GREEN | `d6be56795` | feat(298-03): move preview + move routes, seeds for the deferred moves (D-19, D-21, D-22, D-31) |

## What was built

- **Migration `217_org_item_move_audit.sql`** (the number was free: the highest on disk was 216).
  - It re-states `audit_log_action_type_check` with the 39 live literals plus `'org.item.move'`.
    The live CHECK was read first; it matched migration 215 exactly.
  - It contains no data write (D-18), no function or trigger (D-31) and no GRANT/REVOKE. The shape
    test asserts all three over comment-stripped SQL, with quoted literals removed so
    `'connector.grant'` does not read as a GRANT.
  - Applied to the **local** DB only, through the venv asyncpg in one transaction (the SQL-editor
    equivalent). `full-schema.sql` was regenerated without `--reset`. Its diff is exactly the one
    CHECK line.
  - `VALID_ACTION_TYPES` gained the same literal in the same commit.
- **`org_move.py`**
  - `preview_move` is read-only on a pooled connection. It returns the item name, both org names,
    the counts (`subfolders`, `documents` = latest versions, `earlier_versions`, `past_runs`) and
    every refusal sentence, ordered by `REFUSAL_ORDER`.
  - `execute_move` runs inside one `con.transaction()`:
    1. target membership, then source membership (`org_members`; the source org is read from the row);
    2. the rows are collected `FOR UPDATE` (the folder root is locked first, then the subtree is
       re-read under its own locks);
    3. every refusal is run again;
    4. `org_id` is updated on folders, documents, the five document child tables and both-ends
       relationships;
    5. one `INSERT INTO public.audit_log` (source org, metadata `{kind, item_id, from_org, to_org, counts}`).
  - A racing `UniqueViolationError` and a `PT409` hold backstop map to worded 409s.
- **Routes** (`org_items.py`): `GET /org-items/move-preview?kind=&id=&to=` and `POST /org-items/move`
  (`MoveRequest`, extra fields forbidden).
  - The kind and both UUIDs are validated before the service is called.
  - A `MoveRefused` becomes `HTTPException(status, detail=<sentence>)`, with the sentence as a plain string.
  - Both routes inherit the router's 401.
- **OpenAPI**: the snapshot and public spec were regenerated. The two routes sit under the
  `org-items` tag, which is flagged UI-internal. `build-public-openapi --check OK`.
- **Seeds** (ids allocated as max+1 at write time; the max was 392):
  - SEED-393: thread and run moves.
  - SEED-394: moving a published workflow (the trigger amendment shape is recorded).
  - SEED-395: a run-start `folder_id` override can name the owner's folder in another org.

### The refusal classes (all driven live)

| Kind | Classes |
|---|---|
| **Folder** | org-shared subfolder · legal hold on the folder · legal hold on an **ancestor** · watched by a connection · retention policy on a subtree folder · pending retention decision · retention history (receipt) · archived document · subfolder not owned · document not owned · bound chats · a workflow binding a subtree folder (five arms: project, phase `folder_scope`, kb_auto input, output folder, double-encoded definition) · Expert install · classification rule · saved view · recall check · a document still processing · a version family crossing the subtree · a relationship with one end staying · same content in the target · same name in the target · documents shared through a connection · several blockers stated together |
| **Root document** | a version inside a folder · legal hold · same content in the target |
| **Draft** | published · system-global · live run · schedule · API key listing it · bound folder outside the target |
| **Membership and input** | target not a member (403, the same answer for an org that does not exist) · source org the caller left (403) · missing and not-yours (the same 404 sentence for all three kinds) · same org (422) · bad id or kind (422) |
| **TOCTOU** | a hold placed after a clean preview is caught inside the transaction |

## Verification (gate lines verbatim)

- **Backend baseline** (committed tree, under the local-DB lock): `[GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).` Summary: `69 failed, 10319 passed, 1 skipped, 2 xfailed, 2 xpassed, 51 warnings in 500.76s (0:08:20)`. The failure count is unchanged from 298-02 (69), and 54 more tests pass.
- **Vitest count gate:** not run. This plan changed no frontend file (`git diff --stat 6e879658e HEAD -- frontend` is empty), so there are 0 per-file deltas by construction.
- **tsc set-diff:** not run, for the same reason. No `.ts`/`.tsx` file changed, so the set is identical to base (53).
- **Ledger gates:**
  - `node scripts/check-hot-file-ledger.cjs .planning/phases/298-lists-follow-the-active-org` → `ledger gate OK — every watched file has a row.` (94 subject files, 50 watched).
  - `--files org_move.py org_items.py audit_service.py` → `ledger gate OK — every watched file has a row.`
- **CLAUDE.md size gate:** `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- **Seeds register:** `seeds register gate OK — 402/402 parsed, 0 duplicate ids, 402/402 carry all 5 required keys.`
- **OpenAPI:** `build-public-openapi --check OK — docs/public/api/openapi.public.json is current (225/267 paths, 310 schemas, version 4.5).` `grep -c '"/org-items/move' openapi.snapshot.json` = 2.
- **Live integration** (real local Postgres + GoTrue, under the lock), with `-rs`:
  - `test_298_org_move_live.py`: **51 passed, 0 skipped**. That is 50 move tests plus the anon-key route test.
  - `test_110_audit_drift_guard.py`: 2 passed, 0 skipped.
  - `test_298_two_org_lists_live.py` (298-01, re-run): passed.
  - The combined targeted run read `138 passed in 130.17s`.
- **Pitfall 8 counterfactual:** I disabled the collision check and the workflow-binding check in `org_move.py`, and `7 failed` (2 collision + 5 binding arms). I then restored the file and confirmed it md5-identical (`0bf9a1dc…`).
- **Local boot:** `uvicorn app.main:app --port 8765` logged `Application startup complete.` and `GET /health` answered 200. The lifespan's `assert_action_types_synced` (main.py:391) passed against the pasted 217. The process was stopped and port 8765 is free.
- **Targeted unit tests:**
  - `test_298_org_move_unit.py` 33 passed. `test_298_org_items_routes.py` 34 passed. `test_298_migration_217_shape.py` 5 passed. `test_276_openapi_snapshot_fresh.py` 2 passed.
  - The hold_guard suites, `test_165_folder_utils_org_scope` and `test_298_foreign_binding` together read `157 passed`.
- **Acceptance greps:**
  - `write_audit_entry` appears 0 times in the code (once in the docstring, which says it is never used).
  - `INSERT INTO public.audit_log` appears exactly once.
  - `con.transaction()`, `FOR UPDATE` and `org_members` are all present.
  - `org_move.preview_move(` and `org_move.execute_move(` both appear in `org_items.py`.
- The local-DB lock file is absent.

## Deploy notes (operator)

In this order. A backend carrying `'org.item.move'` **will not boot** against a database without
217 (`assert_action_types_synced` in the lifespan hard-fails).

1. Paste `supabase/migrations/217_org_item_move_audit.sql` into the **cloud** Supabase SQL editor.
   This is an operator action. Any Supabase-MCP write needs explicit per-action operator approval;
   no executor did it.
2. Run `get_advisors(security)` (a read) and record 0 new ERROR. 217 adds no function and no
   grant, so none is expected.
3. Only then deploy the backend.

The same three lines belong in the phase STATE "Owed (operator)" list at phase close.

## Deviations from Plan

**1. [Rule 1 - Correctness] Hold refusal wording.**
- The plan said to wrap the UPDATEs in `hold_guard.map_hold_refusal(kind="folder")`. That helper's
  sentences are the delete door's ("This folder is on legal hold. Nothing was deleted."), which is
  the wrong thing to tell someone who is moving a folder.
- The move instead calls the same SQL predicates (`retention_held_folders` / `retention_held_documents`)
  on the transaction connection. It maps a racing `PT409` through `hold_guard.is_hold_refusal` to
  its own sentence. The predicate is not restated. (`913c9c0fb`)

**2. [Rule 2 - Correctness] Two refusals beyond the D-33 list.**
- *A same-name document already in the target org.* Without it the two version families would merge
  in the target and carry two `is_latest` rows.
- *Documents shared with the org through a connection* (`ingest_visibility` org/dept). This is the
  same reasoning as the org-shared folder.
- Both are worded and driven live. (`913c9c0fb`)

**3. [Rule 2] Two retention and Expert arms the plan's table did not name.**
- A legal hold or an include-subfolders retention policy on an **ancestor** of the moved root also
  refuses. Detaching the root would otherwise silently drop it from that coverage.
- `expert_bundles.knowledge_folder_ids` refuses like `expert_installs.folder_id`. The column was
  found by an information_schema scan. (`913c9c0fb`)

**4. Counts: `documents` = latest versions, `earlier_versions` = the rest** (the plan's behaviour line
said "all rows"). This matches what the Library lists and the UI-D18 count sentence. The audit
metadata carries the same counts. (`913c9c0fb`)

**5. Live run statuses are `active` / `paused` / `cap_paused`** (the plan said "running / paused").
The live CHECK has no `running` status; I measured it.

**6. [Rule 3 - Blocking] Two existing fences were amended deliberately, with the reason in each test body:**
- **D-298-04** `test_110_audit_drift_guard.py::test_valid_action_types_is_exactly_the_expected_set`.
  It was already RED at base: it pinned 34 types, but 293 had added the five `api_key.*` types
  without updating it. It is now 40, naming the 293 types and `org.item.move`. (`aa0e26ed8`)
- **D-298-05** `test_293_migration_215.py::test_audit_check_never_falls_behind_the_frozenset`.
  Migration 215 cannot name a type that a later migration added. Only `org.item.move` (217) is
  excused, and the 217 shape test holds the frozenset against 217. (`6120c7541`)

**7. [Rule 1 - own test bug] Fixed during GREEN:**
- The shape test's `\bGRANT\b` matched the `'connector.grant'` literal. Quoted literals are now
  stripped first. (`6120c7541`)
- An `await` inside a generator expression in the live suite became an async generator. It is now
  computed first. (`913c9c0fb`)

**8. TDD order note:** for Task 2, I wrote the implementation draft before the tests. I moved it
out of the tree before the RED run, so the RED commit (`711ae399b`) was observed failing (collection
error, module absent). The Pitfall-8 counterfactual above is the specific RED for the collision and
binding classes.

**9. The live anon test lives in `test_298_org_move_live.py`.** Task 3's file list did not name it.
It points `get_supabase` at the local stack, because the unit conftest's placeholder URL would
otherwise read as an unreachable auth service (503), not a 401.

## TDD Gate Compliance

RED then GREEN for each task: `aa0e26ed8` → `6120c7541`, `711ae399b` → `913c9c0fb`, `e16b5a3ce` → `d6be56795`.

## Known Stubs

None.

## Threat Flags

None beyond the plan's register. T-298-15..24 are mitigated as planned:
- **T-298-15** (both-org membership in the transaction), **T-298-16** (owner predicate and the
  not-owned refusals), **T-298-17** (FOR UPDATE + re-run; the TOCTOU test), **T-298-18** (one
  transaction; the information_schema post-condition), **T-298-19** (INSERT in the transaction;
  exactly one row asserted), **T-298-20** (draft-only; the published refusal), **T-298-21** (the
  same 404 / 403; org names only for member orgs).
- **T-298-22:** no function was added, which the shape test proves.
- **T-298-23:** deploy order written above; the local boot was proven.

## Notes for later plans

- **298-04 / 298-05 (the move control):** the preview answers 200 with `refusals` even when the move
  is blocked. Show the sheet's "Refused" state from that list, and the 403/404/422 sentences
  verbatim from `detail`. `counts.documents` is latest versions, so "This folder, 2 subfolders and
  14 documents move to …" reads it as is.
- A draft and the folder it binds cannot be moved as a pair in either order: the folder is refused
  while the draft binds it, and the draft is refused while its folder is outside the target. The
  way out the sentences name is: point the draft at a folder in the target org, move the draft,
  then move the (now unbound) folder. This is intended (D-33/D-34: neither move may manufacture an
  ORG-05 refusal).
- STATE.md and ROADMAP.md are untouched (the orchestrator owns them).

## Self-Check: PASSED

- All 8 created files exist on disk.
- Commits `aa0e26ed8`, `6120c7541`, `711ae399b`, `913c9c0fb`, `e16b5a3ce` and `d6be56795` are in `git log`.
- The local-DB lock file is absent.
- No cloud write was made.
