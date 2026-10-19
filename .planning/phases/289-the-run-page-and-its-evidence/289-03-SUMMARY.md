---
phase: 289-the-run-page-and-its-evidence
plan: 03
subsystem: workflow-runs / evidence read
tags: [VIS-03, SEED-348, evidence, org-scope, rls, tdd]
requires:
  - "289-02: confidence_for_wire / resolve_kb_label / KB_LABEL_DEFAULT (phase_confidence.py)"
provides:
  - "GET /workflow-runs/{workflow_run_id}/evidence -> RunEvidenceRead (the plan 04 wire, field names verbatim from the plan's interfaces block)"
  - "app/services/run_evidence.py: pure composers (definition, definition_changed, phase log, verdicts, sources, deliverable, started_by)"
affects: [289-04 (renders this payload), 289-05 (I1 key-set fixture, ledger rows, S4 live second-user drive)]
tech-stack:
  added: []
  patterns:
    - "pool read with the org predicate written into the one access query (library-feed posture), RLS untouched"
    - "non-owner masking + KB label on ONE viewer RLS connection, fail closed"
key-files:
  created:
    - backend/app/services/run_evidence.py
    - backend/app/api/workflow_run_evidence.py
    - backend/tests/unit/test_289_run_evidence.py
  modified:
    - backend/app/main.py
    - backend/app/middleware/canvas_gate.py
    - backend/tests/test_182_canvas_gate.py
    - docs/public/api/openapi.snapshot.json
    - docs/public/api/openapi.public.json
decisions:
  - "run.started_at/completed_at = earliest step start / latest step end, else the run row's created_at/updated_at"
  - "workflow_name comes from the snapshot's name, else the live definition row (the evidence page is the record of what ran)"
  - "A phase name falls back to its slug on this wire (name is a required str in the contract)"
  - "verdict `checked` lists the validator kinds of the gate's own timing (pre vs post), from the snapshot"
  - "an llm_human_input step is `answered` iff its stored answer is a non-blank string"
metrics:
  duration: "~70 min"
  completed: 2026-10-19
  tasks: 2
  files: 6
requirements: [VIS-03]
---

# Phase 289 Plan 03: The Org-Scoped Evidence Read Summary

**One-liner:** `GET /workflow-runs/{id}/evidence` composes a finished run's definition (from its
snapshot), phase log, verdicts and cited sources for the owner OR any member of the run's org,
through ONE pool query that carries id + terminal status + owner-or-member, answers every miss with
the owner read's exact `{"detail": "Run not found"}`, and gives a colleague a minimised record whose
sources and KB label are resolved on the colleague's OWN RLS connection (fail closed).

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 RED | `d6f774fbd` | test(289-03): pin the evidence composers |
| 1 GREEN | `d587e0076` | feat(289-03): evidence composers |
| 2 RED | `f521a37c2` | test(289-03): pin evidence access and 404 parity |
| 2 GREEN | `7210bdb65` | feat(289-03): org-scoped evidence read |
| 2 fix | `14b568d61` | fix(289-03): regenerate the OpenAPI snapshot for the evidence read |

## RED / GREEN record

- **Task 1 RED:** collection error, `ImportError: cannot import name 'run_evidence' from 'app.services'`
  (the module did not exist). **GREEN:** 20 passed.
- **Task 2 RED:** run against base `main.py` / `canvas_gate.py` with the route module absent:
  **12 failed, 20 passed**. Eleven route cases failed on
  `ModuleNotFoundError: No module named 'app.api.workflow_run_evidence'`, and the gated-path case
  failed on `assert '/workflow-runs/{workflow_run_id}/evidence' in frozenset({...5 members...})`.
  The 20 composer cases passed, as they should. **GREEN:** 32 passed.
- **Plan verify list** (`tests/unit/test_289_run_evidence.py tests/test_182_canvas_gate.py
  tests/test_revert_byte_identical.py tests/test_188_workflow_run_read.py`): **58 passed, 0 failed**
  (run with the run-claiming sweeps neutralised, see "Shared-DB safety").

What the suite pins (all against a recording fake pool, no database):
- the string-scalar and dict snapshot decode to the same phases and version; snapshot `None` gives
  `recorded: false` with the fallback and its version; `{}` stays `recorded: true` (`is None` rule)
- `definition_changed`: a newer same-slug version (`current_version` = the highest); an unedited
  draft whose stored JSON lacks the snapshot's defaults is NOT changed (normalised equality); an
  edited draft IS changed; an unvalidatable shape falls back to the version rule
- R-04 for both viewers, including that a colleague's JSON text contains neither the question nor
  the answer; R-03 `judge_verdict` dropped and the gate's error string never shipped; R-01 masking
  and fail-closed masking (empty readable set); R-02 `file_id` owner-only
- the route: owner full record; colleague record with no owner email, no thread id, no file id,
  the hidden document masked to `cited_by: [1]`, and no `FROM workspace_files` on the pool
- W3a cases (i) hidden folder: the RLS connection answers `None` while the pool would answer
  `"Owner's Private Folder"`. The result is `kb_label == "the knowledge base"` on the payload and on
  every confidence, the private name is absent from the JSON text, and the pool shows no
  `FROM folders`. Case (ii): the RLS context raises, which gives the default words and every
  source masked. Case (iii): the RLS connection answers a name, and that name is used. The owner
  case confirms the label comes from the pool and equals `confidence_for_wire(stored, label)`
- the accepted risk T-289-31: a colleague receives the non-human step's `output_text` (asserted
  present)
- five misses (other org, nonexistent, active and paused for a colleague, active for the owner,
  D-06) are each a 404 with `detail == "Run not found"` after exactly ONE recorded pool call, and
  that statement carries `wr.id = $1`, `wr.status IN ('completed', 'failed', 'cancelled')`,
  `wr.user_id = $2` and `org_members`; three of them compared tuple-equal
  `(status, detail, headers)`; no RLS connection opened on any miss

## Acceptance greps

| Check | Result |
|---|---|
| `grep -c "def _coerce_definition" run_evidence.py` | 0 |
| `grep -cE "fetch\|execute\(\|get_pg_pool\|await " run_evidence.py` | 0 |
| `grep -c '"passage"\|"similarity"' run_evidence.py` | 0 |
| `grep -c "require_visible\|get_current_user" workflow_run_evidence.py` | 0 |
| `grep -c "org_members" workflow_run_evidence.py` | 1 (inside `_ACCESS_SQL`, the same string as the terminal-status literal) |
| `grep -c 'detail="Run not found"' workflow_run_evidence.py` | 1 |
| `grep -c "403\|HTTP_403" workflow_run_evidence.py` | 0 |
| `grep -c "workflow_run_evidence.router" main.py` | 1 |
| `grep -c "/workflow-runs/{workflow_run_id}/evidence" canvas_gate.py` | 1 |
| `git diff --numstat fcaa0a853 -- backend/app/api/workflow_runs.py` | empty (not edited) |
| write statements (`insert into` / `update … set` / `delete from`) in either module | 0 |
| `node scripts/check-hot-file-ledger.cjs .planning/phases/289-…` | `ledger gate OK` (587 rows, 22 watched) |

## Shared-DB safety (the wave-1 hazard)

The four suites in the plan's verify list use the `client` fixture, which enters the real app
lifespan against the shared local DB. A read-only probe before running them
(`find_resumable_runs`) found **2 resumable runs** that the boot sweep would claim and re-drive:
`51924c91-…`, a run that "stops for approval before sending", and `a77ed2c0-…`. The suites were
therefore run under the local-DB lock, with a process-local pytest plugin
(`-p no_run_sweeps`, kept in the session scratchpad, not in the tree) that replaces
`resume_stranded_workflows` and `reconcile_orphaned_runs` with no-ops. Neither is under test in
these suites. No run was claimed. The lock was released after each block of runs.

A run with an unreachable `POSTGRES_DSN` was tried first, to see whether the suites could run with
no database at all. They cannot: 25 errors, because the lifespan needs Postgres.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, inherited] `test_182`'s exact-set OpenAPI fence was red at base**
- **Found during:** Task 2 GREEN (running the plan's verify list)
- **Issue:** `test_openapi_tracks_the_flag_in_both_directions_in_one_process` asserts that
  `on − off` paths equal `_CANVAS_PATHS` exactly. SEED-190 (`/workflow-runs`) and 200.2
  (`…/phases/{phase_slug}/citations`) joined `CANVAS_GATED_PATHS` without joining that tuple.
  **Proven red at base `fcaa0a853`** by running it with base `main.py`, `canvas_gate.py` and
  `test_182` and no evidence module: `1 failed, 7 passed`, with
  `Extra items in the left set: '/workflow-runs', '…/citations'`.
- **Fix:** `_CANVAS_PATHS` now names the evidence path plus the two inherited members.
  `_CANVAS_SCHEMAS` now names the schemas the real filter removes, measured off
  `canvas_filtered_openapi`: the four inherited `WorkflowRunListItem`, `WorkflowRunListRead`,
  `WorkflowRunCitationRead` and `WorkflowRunWaitingOn`, plus the twelve `RunEvidence*` models. The
  file still never names the gate module (its own fence passes).
- **Files modified:** `backend/tests/test_182_canvas_gate.py` (in `files_modified`)
- **Commit:** `7210bdb65`

**2. [Rule 1 - test fixture] `"similarity"` substring matched `avg_similarity`**
- **Found during:** Task 2 GREEN
- **Issue:** the colleague case asserted `"similarity" not in text`, but the step-level confidence
  legitimately carries `avg_similarity`. That value is the aggregate shipped since plan 02, not a
  citation's score.
- **Fix:** the test now asserts the quoted keys `'"similarity"'` and `'"passage"'` are absent.
- **Commit:** `7210bdb65`

**3. `step_identity` not imported into `run_evidence.py`**
- The plan listed it among the imports, but none of the four sections needs a step's
  tool/connection identity, so importing it would only leave an unused import. Nothing was
  re-derived in its place.

**4. `main.py` import line**
- One `include_router` line was added as planned. The router module was also added to the existing
  long `from app.api import …` line (`workflow_runs, workflow_run_evidence,`), because the include
  cannot run without it. Net diff: `+2 -1`.

**5. [Rule 3 - Blocking] The public OpenAPI snapshot fence**
- **Found during:** the backend unit suite
- **Issue:** `test_276_openapi_snapshot_fresh` requires `docs/public/api/openapi.snapshot.json` to
  match the code. A new route makes the snapshot stale, and it was already stale at base
  (289-02's field).
- **Fix:** regenerated both `openapi.snapshot.json` and `openapi.public.json` with the two
  commands the test names. The evidence path and its `RunEvidence*` schemas are now published
  (the public file is what the live docs read, and it is gated in production per 276).
- **Files modified:** `docs/public/api/openapi.snapshot.json`, `docs/public/api/openapi.public.json`
  (neither is in `files_modified`)
- **Commit:** `14b568d61`

### Out of scope, recorded (not fixed)

- The wave-1 cross-worktree hazard is still structural. Any `client` test enters the lifespan and
  can claim a live run. This plan worked around it locally; it did not fix it. That is plan 05's
  seed, as 289-01 recorded.

## Known Stubs

None. Every field is produced from recorded data. `definition_changed.current_version` is `null`
when the only change is an edited draft (no newer version exists). That is a fact, not a stub.

## Threat Flags

None beyond the plan's register. The new endpoint and its pool read at the org boundary are
T-289-12..19/30/31, all implemented as dispositioned: the single access query, 404 parity, no
forbidden status, owner-only email, thread and file id, R-01 and W3a through the viewer's RLS, GET
only, and every jsonb read through `phase_output_object` / `_coerce_definition`.

## G-5 record

Triples re-derived from git after this plan's commits. Plan 05 writes the ledger rows.

| File | commits / phases / lines (after) | lines before → after | note |
|---|---|---|---|
| `backend/app/main.py` | 91 / 66 / 978 (ledger `90 / 65 / 977`) | 977 → 978 (+2 −1: one import token, one `include_router`) | honoured by construction |
| `backend/app/middleware/canvas_gate.py` | 9 / 6 / 396 (ledger `8 / 5 / 391`) | 391 → 396 (+5: one member + its 4-line comment) | honoured by construction |
| `backend/app/api/workflow_run_evidence.py` | new (2 commits / 1 phase) | 0 → 358 | young (created 289-03) |
| `backend/app/services/run_evidence.py` | new (2 commits / 1 phase) | 0 → 468 | young (created 289-03) |
| `backend/app/api/workflow_runs.py` | untouched by this plan | 1293 → 1293 | D-16 |

## Backend unit suite

I ran the suite once at this plan's HEAD (before the snapshot fix), under the lock, with
`-p no_run_sweeps`:
**82 failed, 7854 passed, 1 skipped, 2 xfailed, 2 xpassed (0 collection errors)**.

⚠ **The CLAUDE.md ceiling of 71 is already exceeded at base, so this run cannot be read against
it.** To separate inherited failures from new ones, I re-ran the 82 failing node ids against base
app code. Base `main.py`, `canvas_gate.py` and the OpenAPI snapshot were put back, and both new
modules were removed. Result: **79 failed, 3 passed.** Each failing id was then classified (the
set was compared, not the counts):

- **79 + 1 inherited.** They are red with this plan's code absent. One more,
  `test_retrieval_service.py::TestEnrichWithFilenamesPhase28::…_defaults_version_number_to_1`,
  first looked like a set difference only because a warning line was glued onto its id. It fails
  at base too (`coroutine has no len()`). Examples: `test_256_finish_run_unchanged` (289-01's
  `api/runs.py` `finish_run` call), `test_190_connector_source_fence` (a `phase_types.py` line
  shift from 289-02), `test_200_1_phase_output_shape::test_this_plan_wrote_no_migration`, and
  the `test_retrieval_service` / `test_sql_service` / `test_multimodal_query` families.
- **1 caused by this plan, now fixed.** `test_276_openapi_snapshot_fresh` named
  `/workflow-runs/{workflow_run_id}/evidence` as an added path. It was also red at base, because
  the base snapshot lacks 289-02's `confidence` field (0 occurrences). I regenerated it with the
  test's own instructions (`scripts/export-openapi.py`, then `scripts/build-public-openapi.cjs`).
  The test is now green: `2 passed`. Commit `14b568d61`.
- **3 order-dependent, not caused here.** These are
  `test_cross_worker_cancellation.py::test_a_late_producer_finalize_may_not_write_failed_over_a_cancel`,
  `::test_the_registry_read_only_ever_turns_failed_into_cancelled` and
  `test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments`. They failed in
  the full run but **pass at HEAD when run in isolation**, and they pass at base too. None of them
  imports the evidence modules.

Expected full-suite figure after `14b568d61`: 81 failed. That is 82 minus the fixed snapshot
fence, and it still includes the 3 order-dependent tests. Every failure left in the set is
inherited. I did not re-run the full suite after the fix. Plan 05 owns the full gate.

## TDD Gate Compliance

Plan type `tdd`. Task 1: `test(289-03)` `d6f774fbd` → `feat(289-03)` `d587e0076`. Task 2:
`test(289-03)` `f521a37c2` → `feat(289-03)` `7210bdb65`. Each RED failed for the intended reason
(the module or route was absent) before its GREEN commit. No refactor commit was needed.

## Self-Check: PASSED

- FOUND: `backend/app/services/run_evidence.py`, `backend/app/api/workflow_run_evidence.py`,
  `backend/tests/unit/test_289_run_evidence.py`, this SUMMARY.
- FOUND commits (`git log --oneline fcaa0a853..HEAD`): `d6f774fbd`, `d587e0076`, `f521a37c2`,
  `7210bdb65`, `14b568d61`.
- `git diff --name-only fcaa0a853 HEAD` names neither `.planning/STATE.md` nor `.planning/ROADMAP.md`,
  and not `backend/app/api/workflow_runs.py`.
