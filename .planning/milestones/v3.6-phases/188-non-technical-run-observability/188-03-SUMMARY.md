---
phase: 188-non-technical-run-observability
plan: 03
subsystem: backend-api
tags: [workflow-runs, canvas-gate, idor, openapi, read-only]
requires:
  - "workflow_runs / workflow_definitions / workflow_phases (shipped tables, zero migrations)"
  - "dependencies.require_canvas + canvas_caller (Phase 181/182, WR-08 hand-off)"
  - "dependencies.get_user_supabase_client (Phase 163 user-JWT client)"
  - "middleware/canvas_gate.CANVAS_GATED_PATHS (Phase 182 D-182-R2-02)"
provides:
  - "GET /workflow-runs/{workflow_run_id} — the one net-new read that gives a run an address"
  - "WorkflowRunRead / WorkflowRunPhaseRead response models"
  - "the run + the definition VERSION THAT RAN + the durable phase spine in one round trip"
affects:
  - "backend/app/main.py (one import + one include_router)"
  - "backend/app/middleware/canvas_gate.py (one frozenset member + a corrected comment)"
  - "backend/tests/test_182_canvas_gate.py (exact-set fence literals)"
  - "backend/tests/test_revert_byte_identical.py (the mandatory 404-when-off probe)"
tech-stack:
  added: []
  patterns:
    - "owner-scoped SELECT with id AND user_id on ONE query -> 404 (runs.py:700-750 idiom)"
    - "require_canvas ALONE, caller consumed via canvas_caller (WR-08), user-JWT client"
    - "slug -> phase_type derived from the definition JSON (threads.py:1204-1226), never a column"
key-files:
  created:
    - backend/app/api/workflow_runs.py
    - backend/tests/test_188_workflow_run_read.py
  modified:
    - backend/app/main.py
    - backend/app/middleware/canvas_gate.py
    - backend/tests/test_182_canvas_gate.py
    - backend/tests/test_revert_byte_identical.py
decisions:
  - "D-188-15 honoured: the path is /workflow-runs/{id}, NOT /runs/{id} — /runs/{run_id} already means the producer runs row"
  - "D-188-14 honoured: the definition is joined on definition_id (the version that RAN), never resolved by slug"
  - "D-188-16 honoured: require_canvas ALONE; the 403-raising visibility gate is never stacked"
  - "Deliberate deviation from the workflows.py analog: user-JWT client, not service-role (CLAUDE.md RLS rule)"
  - "The acceptance criterion `grep -c CANVAS_GATED_PATHS == 0` was FALSE AT BASELINE; replaced with a working source fence"
metrics:
  duration: ~45 min
  tasks: 3
  commits: 3
  files_created: 2
  files_modified: 4
  migrations: 0
  completed: 2026-08-05
---

# Phase 188 Plan 03: Give a Workflow Run an Address — Summary

`GET /workflow-runs/{workflow_run_id}` — one ownership-gated, canvas-gated read returning the run,
the definition version that actually executed, and the durable phase spine in a single round trip,
with both shipped gate fences updated in the same commits and every security guard falsified before
it was committed.

## What Shipped

| Task | Commit | What |
|---|---|---|
| 1 | `078c1711` | `backend/app/api/workflow_runs.py` + `main.py` registration |
| 2 | `7dedc9d0` | `CANVAS_GATED_PATHS` member + corrected comment + both shipped fences |
| 3 | `bd544fb7` | `backend/tests/test_188_workflow_run_read.py` — 6 tests |

**Zero migrations.** `git diff --name-only HEAD -- supabase/migrations/` is empty; the route is a
pure read over shipped tables.

## The Security Posture (the primary deliverable)

The IDOR shape is *"guess a run uuid, read someone else's workflow definition + phase spine"*. Four
controls, all mechanically fenced:

| Control | Implementation | Fenced by |
|---|---|---|
| Ownership | `.eq("id", …)` **and** `.eq("user_id", …)` on the SAME select, `.maybe_single()`, 404 on miss | tests 1 + 2 |
| Indistinguishability | one query, one 404 — no second lookup that could be timed or worded apart | test 2 (same status **and** body) |
| RLS as the belt | read through `get_user_supabase_client` (user-JWT), **not** service-role | code + `grep -c 'Depends(get_supabase)' == 0` |
| Non-discoverability | `Depends(require_canvas())` **alone** (request half) + the path template in `CANVAS_GATED_PATHS` (OpenAPI half) | test 6, `test_revert_byte_identical`, `test_182_canvas_gate` |

**Two 404 bodies, deliberately different.** The handler's ownership miss returns
`{"detail": "Run not found"}` — that caller is past the gate and has already learned the route
exists. The gate's returns `{"detail": "Not Found"}`, byte-identical to an unbuilt path. Test 6
asserts the gate body **and** asserts it is *not* the handler's, so a gate that silently stopped
running would be caught rather than papered over.

## The Observed OpenAPI Set Difference (measured, not predicted)

RESEARCH A5 flagged that which models move is a measurement, because `canvas_filtered_openapi`
subtracts `kept_refs` — anything a surviving path still references is never removed. Measured at
`7dedc9d0`:

```
PATHS moved:   ['/workflow-runs/{workflow_run_id}', '/workflows/grounding-bundle', '/workflows/validate']
SCHEMAS moved: ['GroundingBundleResponse', 'PaletteFolder', 'PaletteSkill', 'ValidateResponse',
                'Verdict', 'WorkflowRunPhaseRead', 'WorkflowRunRead']
reverse paths: []
```

**Which models moved:** exactly the two net-new ones, `WorkflowRunRead` and `WorkflowRunPhaseRead`.

**Which did NOT, and why:**

| Model | Moved? | Reason (measured) |
|---|---|---|
| `WorkflowDefinition` | **no** | It is `POST /workflows/validate`'s request body, but three NON-canvas paths still reference it — `/workflows`, `/workflows/{definition_id}`, `/workflows/generate`. `kept_refs` retains it. This is A5's open question, now closed by measurement. |
| `HTTPValidationError` | no | App-wide error model, referenced by every surviving path. |
| `PublishVerdict` | no | The existing non-canvas control schema; still present in the off document. |

## Deviations from Plan

### Auto-fixed / adjusted

**1. [Rule 2 — Vacuous fence replaced] `grep -c 'CANVAS_GATED_PATHS' == 0` was false at baseline**

- **Found during:** Task 2 acceptance checks
- **Issue:** The criterion asserts the literal returns 0. At `HEAD` (before any 188 edit) it returned
  **2** — both occurrences are prose comments *explaining why the constant must not be imported*. The
  criterion could therefore never have passed, and more importantly it never fenced the real
  invariant, which is that the test must not **import** the constant (a test importing the thing it
  checks passes even against an emptied constant).
- **Fix:** Left the explanatory prose (it is the reason the convention exists) and added
  `test_this_file_never_imports_the_module_it_checks` — a source fence asserting the file never names
  the gate module at all. The needle is assembled from parts (the 187-24 lesson) so the file's own
  source cannot satisfy the grep run over it, with a positive control proving the needle matches the
  shape it forbids.
- **Files modified:** `backend/tests/test_182_canvas_gate.py`
- **Commit:** `7dedc9d0`

**2. [Rule 1 — Contradictory criteria reconciled] `require_visible` / `get_current_user` grep counts**

- **Found during:** Task 1 acceptance checks
- **Issue:** The plan asks for the two deliberate deviations to be *"stated in comments"* AND for
  `grep -c 'require_visible'` and `grep -c 'get_current_user'` to return **0**. Both cannot hold if
  the comments spell the symbols — my first draft returned 2 and 1 respectively, entirely from
  docblock prose.
- **Fix:** The comments now describe both symbols by role ("the 403-raising visibility gate", "the
  shared current-user resolver") and cite `D-182-05` / `WR-08`, where `dependencies.py` names them in
  full. An explicit ⚠ note in the module docblock records *why* they are left unspelled, so the next
  reader does not "helpfully" restore them and silently break the fence. Both greps now return 0 as a
  measurement of the dependency list rather than of the prose.
- **Files modified:** `backend/app/api/workflow_runs.py`
- **Commit:** `078c1711`

**3. [Rule 3 — Probe loop split] `_CANVAS_PATHS` can no longer be iterated as request URLs**

- **Found during:** Task 2
- **Issue:** `test_malformed_body_is_byte_identical_to_an_unbuilt_path` POSTs to every member of
  `_CANVAS_PATHS`. A path **template** is not a URL — `POST /workflow-runs/{workflow_run_id}` would
  405/422 rather than exercise anything meaningful.
- **Fix:** Added `_CANVAS_LITERAL_PATHS` (the two `/workflows` members) for the request-path probes;
  `_CANVAS_PATHS` remains the full set for the OpenAPI-document assertions, which is where the
  template belongs. The asymmetry is documented at both declaration sites.
- **Files modified:** `backend/tests/test_182_canvas_gate.py`
- **Commit:** `7dedc9d0`

### Comment correction (required by the plan)

`canvas_gate.py`'s trailing parenthetical *"(Router prefix is `/workflows`, hence the absolute
form.)"* became false the moment a second prefix joined the frozenset. It now states that the members
are absolute FastAPI path templates **spanning routers**, names both prefixes, and documents the
half-asymmetry a templated member creates: `_is_canvas_path` matches request paths exactly, so a
template is load-bearing for the OpenAPI filter **only** — its request-side 404 comes from
`Depends(require_canvas())`. This is the `PhaseNode.tsx:184-186` house rule applied.

## Falsification — every security guard observed RED before commit

Guards that pass on first write are not evidence. Each was broken deliberately, the failure observed,
then restored via `git checkout -- <that one file>`:

| Mutation | Result |
|---|---|
| Remove `.eq("user_id", current_user["id"])` | tests 1 + 2 **RED** — `assert 200 == 404`; the foreign run's thread id, definition and phase spine returned to a non-owner. This is threat T-188-IDOR reproduced on demand. |
| Remove `.order("phase_index")` | test 4 **RED** — phases returned 2/0/1 (the shuffled seed order) |
| Resolve the definition to v7 instead of `definition_id` | test 5 **RED** — `AssertionError: resolved the current published version, not the one that ran; assert 7 == 3` |

A first mutation attempt (joining by slug with `.order("version")`) did **not** turn test 5 red — the
ascending sort happened to return v3 anyway. That was a bad mutation, not a weak test; it is recorded
here because "the mutation passed" is exactly the moment one is tempted to conclude the test is
vacuous and delete it.

## Test Results

| Suite | Baseline | After |
|---|---|---|
| `test_182_canvas_gate.py` | 7 passed | **8 passed** (+ the import fence) |
| `test_revert_byte_identical.py` | 5 passed | **6 passed** (+ the run-read 404-when-off probe) |
| `test_188_workflow_run_read.py` | — | **6 passed** (net-new) |
| **All three together** | 12 | **20 passed** |

Regression baselines — **unchanged, no attribution to this plan**:

| Suite | Plan-01 baseline | Observed |
|---|---|---|
| `test_thread_workflow_endpoint.py` | 1 red | 1 red (`test_thread_workflow_state_shape`) |
| `test_181_flip_on.py` | 1 red | 1 red (`test_canvas_ping_200_after_flip_on`) |
| `test_182_grounding_bundle.py` | 2 red | 2 red |

Other verification:

- `git diff --name-only HEAD -- supabase/migrations/` → empty
- `bash scripts/check-deploy-drift.sh` → `RESULT: PASS`, exit 0
- Route mounts at exactly `['/workflow-runs/{workflow_run_id}']`

## Known Degrade Path (not a stub, documented for the consumer)

If the `workflow_definitions` row cannot be read, the response degrades to
`workflow_name=""`, `workflow_slug=""`, `workflow_version=0`, `definition=null` rather than 404ing.

**Reachability, measured:** `workflow_runs_definition_id_fkey` is `NOT NULL … ON DELETE RESTRICT`, so
the row cannot be absent or deleted out from under a run. The remaining theoretical path is RLS
hiding the definition from a caller whose own run references it — which requires the run and its
definition to sit in different orgs. *(That last step is reasoned from the v3.4 org-scoped membership
RLS, not measured this session — flagged rather than asserted.)*

Deliberately **not** 404'd: the run exists and belongs to the caller, so refusing it would be less
honest than returning it with an empty definition. The Plan 04/05 consumer should treat an empty
`workflow_name` as "definition unavailable" rather than rendering the empty string.

## Notes for the Next Plan

- The wire contract is `WorkflowRunRead`: `id`, `thread_id`, `definition_id`, `workflow_name`,
  `workflow_slug`, `workflow_version`, `status`, `created_at`, `claimed_at`, `updated_at`,
  `definition`, `phases[]`.
- **There is no `started_at` and no `completed_at`** on `workflow_runs` (PATTERNS measured this; the
  route surfaces `created_at` / `claimed_at` / `updated_at` instead). A duration display must be
  derived from those or deferred.
- `phases[].status` is the **DB-native** vocabulary (`pending | active | completed | failed |
  skipped`) — deliberately untranslated here. The `phaseState.ts` module from Plan 01 owns the
  mapping to the render union; this route must not grow a second one.
- `run.thread_id` is in the payload precisely so the deliverable list needs **no new file endpoint** —
  the existing thread-scoped workspace-files read is reachable from it.
- ⚠ A future **POST** on this router inherits D-182-R2-01 verbatim: FastAPI decodes the body before
  dependencies run, and `CanvasGateMiddleware` **cannot** close that for a templated path because it
  matches request paths exactly. `test_188_workflow_run_read.py` test 3 records this boundary.

## Threat Flags

None. Every surface this plan introduces is already in the plan's `<threat_model>`
(T-188-IDOR, T-188-ROUTE-DISCLOSE, T-188-OPENAPI, T-188-STALE-FLAG, T-188-BLOCKING-IO, T-188-SC);
no new endpoint, auth path, file access pattern or schema change beyond the registered ones.

## Self-Check: PASSED

Files verified present:

- `FOUND: backend/app/api/workflow_runs.py`
- `FOUND: backend/tests/test_188_workflow_run_read.py`
- `FOUND: .planning/phases/188-non-technical-run-observability/188-03-SUMMARY.md`

Commits verified in `git log`:

- `FOUND: 078c1711` — feat(188-03): add ownership-gated GET /workflow-runs/{workflow_run_id}
- `FOUND: 7dedc9d0` — feat(188-03): gate the run read on the OpenAPI half + update both shipped fences
- `FOUND: bd544fb7` — test(188-03): fence the run read's IDOR, flag-off and version-that-ran posture
