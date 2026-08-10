---
phase: 192-workflow-library-ia
plan: 02
subsystem: workflow-library-api
tags: [backend, api, wire-type, disclosure-fence, D-04, LIB-01, LIB-02]
requires:
  - "workflow_definitions.created_by (existing column)"
  - "workflow_definitions.is_system_global (existing column)"
provides:
  - "PublishedWorkflow.is_mine — computed server-side, both feeds"
  - "PublishedWorkflow.is_system_global — row property, both feeds"
  - "frontend PublishedWorkflow wire type carrying both as optional"
  - "the negative fence proving no raw created_by reaches the wire"
affects:
  - "GET /workflows/published"
  - "GET /workflows/starters"
  - "frontend/src/lib/api.ts consumers (22 references, 3 production)"
tech-stack:
  added: []
  patterns:
    - "additive + defaulted Pydantic field (the Phase-103 `definition` precedent)"
    - "binding-rule docblock (the `DraftCreateResponse.token` precedent)"
    - "DB-free handler test via monkeypatched db-layer feeds"
key-files:
  created:
    - backend/tests/unit/test_published_workflow_ownership.py
  modified:
    - backend/app/db/workflows.py
    - backend/app/api/workflows.py
    - frontend/src/lib/api.ts
decisions:
  - "Ship two computed booleans, never a raw created_by UUID — mig-116 / CR-01 applied prospectively"
  - "One shared _caller_uuid() helper so /published and /starters cannot silently diverge"
  - "Both frontend fields optional, with the degraded-state fallback written into the contract"
metrics:
  duration: ~35 min
  completed: 2026-08-10
  tasks: 3
  commits: 3
---

# Phase 192 Plan 02: Ownership on the Library Feeds Summary

`GET /workflows/published` and `GET /workflows/starters` now return `is_mine` and
`is_system_global` on every row — two additive, defaulted booleans computed server-side from
the authenticated caller — so the library's *Yours* and *Starters* chips can filter
client-side with honest simultaneous counts instead of a `?scope=mine` round-trip, and the
raw `created_by` UUID is fenced off the wire by a test that was observed RED.

## What shipped

**Task 1 — the projection** (`52c504fc`). All three SQL strings in `backend/app/db/workflows.py`
(both `owned_only` branches of `list_published_workflows`, plus `list_starter_workflows`) now
select `created_by, is_system_global` alongside the existing four columns. **The projection
widened; the boundary did not** — the diff touches no line containing `WHERE`, `ORDER BY`,
`params.append` or `owned_only`, verified mechanically. Each changed SELECT carries a comment
naming Phase 192 / D-04 and stating that the two columns exist for server-side computation
only.

**Task 2 — the computation and the fence** (`d0a948f1`). `PublishedWorkflow` gains
`is_mine: bool = False` and `is_system_global: bool = False`, both defaulted per the Phase-103
`definition` precedent, with a docblock in the `DraftCreateResponse.token` shape stating the
binding rule: the value is computed server-side and a raw `created_by` is deliberately not
projected, because `list_published_workflows` runs on a service-role pool that bypasses RLS,
so the predicate is the only boundary and `is_mine` cannot widen when a later phase widens it.
Both handlers compute the fields identically through one shared `_caller_uuid()` helper.

**Task 3 — the wire type** (`efa0b59e`). `frontend/src/lib/api.ts` carries `is_mine?: boolean`
and `is_system_global?: boolean`, optional by contract with the degraded-state rule written
into the doc comment: read `undefined` as "unknown" and fall back to
`provenance !== "starter"` — never treat it as `false`, which would silently render an empty
*Yours* chip on a stale deploy.

## The negative fence — observed RED, then restored md5-identical

The disclosure guard (T-192-01) was not trusted until it failed against a real defect. A
`created_by: UUID | None = None` field was planted on `PublishedWorkflow` **and populated in
the `/published` handler** — the realistic mistake, not just the field declaration — and
**four assertions went RED**:

| Test | Fired on |
|---|---|
| `test_published_workflow_field_set_excludes_created_by` | the exact field set |
| `test_no_serialized_value_equals_another_users_raw_uuid[python]` | another user's UUID in the payload |
| `test_no_serialized_value_equals_another_users_raw_uuid[json]` | same, JSON mode |
| `test_starters_response_also_carries_no_raw_creator_uuid` | the second endpoint's exit |

The file was then restored from a pre-plant snapshot.

**`md5sum backend/app/api/workflows.py`: `e5fad6ccefc717ce41ce20a468f94b32` before the plant,
`e5fad6ccefc717ce41ce20a468f94b32` after the restore — identical.**

Note the fourth row is the useful surprise: `/starters` tripped even though only `/published`
was populated, because a declared-but-null field still appears in `model_dump()`. One model,
two handlers, two exits — the fence covers both.

## Test counts — stated, not chased

`backend/tests/unit` carries known pre-existing rot (SEED-056-adjacent; CLAUDE.md records
62 failed as the standing figure). Both numbers, so neither can later read as a regression:

| | failed | passed | xfailed | xpassed |
|---|---|---|---|---|
| Before this plan | **62** | 1990 | 2 | 2 |
| After this plan | **62** | 2007 | 2 | 2 |

Failure count unmoved at 62; passing rose by exactly 17 — the new suite. Not one of the 62 is
touched by this plan, and none was chased.

Other gates: `tests/unit/test_published_workflow_ownership.py` **17 passed / 0 failed** ·
`tsc -p tsconfig.app.json --noEmit` **33 errors, the measured baseline, unmoved** ·
`eslint src/lib/api.ts` **0** · `api.workflows.test.ts` **24 passed / 0 failed** (run with
`GSD_VITEST_MAX_WORKERS=4` and `--maxWorkers=4`, as the parallel-execution rule requires).

## Deployment parity — confirmed, not assumed

- **No migration.** `created_by` and `is_system_global` are existing columns on
  `workflow_definitions`, already used in every `WHERE` in `db/workflows.py`. Nothing was
  created, altered or seeded. `git status --porcelain supabase/migrations/` is empty.
- **No env var.** Nothing was added to `backend/.env.example` or read from the environment.
- **`scripts/check-deploy-drift.sh` is therefore not triggered** — its documented scope is env
  vars the app reads, seed-bearing migrations, bundled services and the sandbox image tag, and
  none of the four applies. The deploy-artifact same-commit rule is not engaged.
- **The code-deploy parity rule still applies**: the backend must ship with the frontend, or
  the chips see `is_mine: undefined`. Because both fields are defaulted server-side and
  optional client-side, a frontend-ahead deploy degrades to the feed-derived fallback rather
  than crashing.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] The route fence asserted paths that do not exist**

- **Found during:** Task 2, first run of the new suite.
- **Issue:** The RUN CARVE-OUT fence looked up routes at `/published` and `/starters`. The
  router is declared `APIRouter(prefix="/workflows", ...)` (`workflows.py:89`), so
  `APIRoute.path` is `/workflows/published`. The lookup returned `[]` and the test failed on
  its own "route not found" guard — which is exactly why that guard was written before the
  assertion rather than after.
- **Fix:** parametrized on the prefixed paths. The fence now genuinely asserts
  `route.dependencies == []` on both carve-out routes.
- **Files modified:** `backend/tests/unit/test_published_workflow_ownership.py`
- **Commit:** `d0a948f1`

**2. [Rule 1 — Bug] A degradation claim that was false for `/published`**

- **Found during:** Task 2, same run.
- **Issue:** I wrote a test asserting that a malformed caller id degrades to `is_mine=False`
  on `/published`. It failed — and the failure was correct. `/published` has a **pre-existing**
  `UUID(user_id) if isinstance(user_id, str)` coercion (`workflows.py:252`, shipped long
  before this phase) that raises `ValueError` before `_caller_uuid` is ever reached. The claim
  was true of the helper and of `/starters`, and false of `/published`.
- **Fix:** split into a direct unit test of `_caller_uuid` and a `/starters` test where the
  degradation is genuinely reachable, with the measurement recorded in the test docstring so a
  later reader cannot conclude that 192 introduced a 500 path — or that it removed one. The
  pre-existing behaviour was **not** changed; that is outside this plan's scope.
- **Files modified:** `backend/tests/unit/test_published_workflow_ownership.py`
- **Commit:** `d0a948f1`

**3. [Rule 3 — Blocking] The plan's vitest path does not exist**

- **Found during:** Task 3.
- **Issue:** Task 3's acceptance criteria name `src/lib/__tests__/api.workflows.test.ts`. That
  directory exists but contains no such file; the suite lives at `src/lib/api.workflows.test.ts`.
  The plan anticipated this ("path confirmed by `ls` first; if it differs, run the api
  workflows suite at its real path and record it").
- **Fix:** ran it at the real path. Recorded here and in the commit message.
- **Commit:** `efa0b59e`

### Worktree base correction (not a code deviation)

The worktree was checked out at `fda79214` (a `master` merge commit), not the expected base
`17c30d4f`. `git merge-base` disagreed, so the startup check reset the worktree to
`17c30d4f` as its protocol requires. All three commits sit directly on that base.

## Requirements

`LIB-01` and `LIB-02` are listed in this plan's frontmatter, and **neither becomes
user-observable here** — this plan ships the data they need, not the surface. They were
deliberately **not** marked complete: no `state.*`, `requirements.mark-complete` or
`roadmap.update-plan-progress` verb was called, and `STATE.md` / `ROADMAP.md` are untouched.

## Threat Model Status

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-192-01 | mitigate | **Mitigated and proved.** `is_mine` ships; no raw `created_by` reaches the wire; the fence was observed RED against a real populated field. |
| T-192-02 | accept | **Held.** The diff touches no `WHERE`, `ORDER BY`, `params.append` or `owned_only` line. |
| T-192-03 | mitigate | **Mitigated and pinned.** Neither route declares `dependencies=[...]`, now asserted mechanically on `APIRoute.dependencies` rather than by prose. |
| T-192-SC | accept | **Held.** Zero packages installed. |

No new security-relevant surface was introduced beyond the register — no new endpoint, no new
auth path, no schema change, no file access.

## Known Stubs

None. Both fields are wired end-to-end from the SQL projection through both handlers to the
TypeScript type. Nothing is hardcoded — notably `/starters` computes `is_mine` rather than
hard-coding `False`, which under today's mig-094 seeding always yields `False` anyway but
would otherwise ship an unstated invariant.

## What the next plan inherits

- `PublishedWorkflow` rows on both feeds carry `is_mine` and `is_system_global`.
- The client contract for `undefined`: fall back to `provenance !== "starter"`, never to
  `false`. Written in the `api.ts` doc comment.
- RESEARCH recommends the merge assign `provenance` from **feed origin** and use `is_mine` as
  a cross-check — an integration task asserting `is_mine === (provenance !== "starter")` over
  the merged list is still owed by the joining plan.
- `?scope=mine` is untouched and must stay: D-16's dedupe-free property depends on it.

## Self-Check: PASSED

- `backend/app/db/workflows.py` — FOUND (3 widened SELECTs, 0 narrow)
- `backend/app/api/workflows.py` — FOUND (`is_mine` ×9; `created_by=` constructs 0)
- `backend/tests/unit/test_published_workflow_ownership.py` — FOUND (17 tests, 0 failures)
- `frontend/src/lib/api.ts` — FOUND (`is_mine?: boolean` ×1, `is_system_global?: boolean` ×1)
- Commit `52c504fc` — FOUND
- Commit `d0a948f1` — FOUND
- Commit `efa0b59e` — FOUND
- `git status --porcelain supabase/migrations/` — empty
- `STATE.md` / `ROADMAP.md` — unmodified
