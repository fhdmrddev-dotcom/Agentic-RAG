---
phase: 235-the-source-says-what-it-did
plan: 06
subsystem: api
tags: [fastapi, pydantic, asyncpg, connector-watches, health-verdict, debounce, pytest]

# Dependency graph
requires:
  - phase: 235-01
    provides: "connector_sync_runs + migration 172, and the two owner-predicated reads list_sync_runs / recent_runs_by_watch"
  - phase: 235-02
    provides: "failure_cause.py — Cause, HARD_CAUSES, SOFT_FAILURE_THRESHOLD, is_hard (hard/soft as DATA)"
provides:
  - "backend/app/services/sources/health_verdict.py — the pure stopped verdict: rows in, verdict out, no I/O"
  - "GET /sources/health — the ONE server-side stopped verdict + the LIVE reader probe + the declared poll interval"
  - "GET /sources/watches/{watch_id}/runs — the per-watch tick history, owner-predicated at both layers"
  - "SyncRunResponse / StoppedSourceResponse / SourceHealthResponse wire models"
affects: [235-07, 235-09, 235-10, 235-11, 235-12, source-attention-badge, library-health-tab]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Debounce applied in exactly one server-side place; clients derive nothing (D-235-05)"
    - "Consecutive failures DERIVED from stored history, never a counter column"
    - "Live process probe (app.state) over config flag for any 'is it running' claim (D-235-21)"
    - "Per-row try/except around list projection so one bad row cannot 500 a polled endpoint"

key-files:
  created:
    - backend/app/services/sources/health_verdict.py
    - backend/tests/unit/services/test_source_health_verdict.py
  modified:
    - backend/app/api/sources.py
    - backend/app/models/source.py

key-decisions:
  - "The verdict endpoint lives on api/sources.py, not knowledge_health.py — connector_watches has a working authenticated SELECT policy so it needs no service-role carve-out, and mounting it there would break that module's ONE-auditable-rationale docstring"
  - "reader_running reads getattr(request.app.state, 'watch_service', None) is not None — the config flag's NAME is deliberately absent from the whole module so the grep guard can fire"
  - "The health window is DERIVED (_HEALTH_RUN_WINDOW = max(5, SOFT_FAILURE_THRESHOLD + 1)) rather than typed as 5 — a window frozen at 5 would silently truncate the streak if the threshold ever moved"
  - "Connection names are resolved in a SECOND query, run only when at least one source actually stopped — zero extra work on a healthy instance, and a failed name lookup costs a sentence a noun, never the verdict"
  - "Route-level tests live in test_source_health_verdict.py so Phase 234's test_sources_watches_api.py stays byte-unchanged at 10"

patterns-established:
  - "SUCCESS_STATUS as an allow-list of one: an unrecognised run status counts as did-not-read, so a future status cannot silently reset a streak and re-hide a dead source"
  - "Non-vacuity assertions FIRST in a suite whose properties rest on imported constants"

requirements-completed: [LIB-10, SURF-03]

# Metrics
duration: 34min
completed: 2026-09-06
---

# Phase 235 Plan 06: The Stopped Verdict Summary

**One pure `verdict_for_runs` deriving hard-on-1 / soft-on-3 from stored run rows, exposed by `GET /sources/health` whose `reader_running` reads the live `app.state.watch_service` rather than the config flag that lies.**

## Performance

- **Duration:** ~34 min
- **Started:** 2026-09-06T07:33Z
- **Completed:** 2026-09-06T08:07Z
- **Tasks:** 2 (Task 1 TDD: RED → GREEN)
- **Files modified:** 4

## Accomplishments

- **The debounce rule now exists in exactly one place.** `verdict_for_runs` is a pure function over newest-first run rows; the badge, the Library Health row and the source card all read the endpoint that calls it, so they cannot disagree. The client derives nothing.
- **Hard-on-1 / soft-on-3 is pinned, and so is the case in between.** `test_two_soft_failures_is_not_stopped` is named literally — SC#4's *"does not fire for a single transient failure"* is the criterion most easily satisfied by accident and most easily lost.
- **`reader_running` is honest.** It reads `app.state.watch_service is not None`. `main.py:587-589` swallows a failed start, so the config flag can read `true` while nothing is running; V-19 pins that case by forcing the flag True and asserting the endpoint still answers False.
- **Zero rows is a different sentence from zero failures.** A watch created and never ticked reports `never_read` and never appears in `stopped`.

## Task Commits

1. **Task 1 (RED): the stopped verdict, failing** — `203cb2a79` (test)
2. **Task 1 (GREEN): the pure verdict leaf** — `41149fd81` (feat)
3. **Task 2: the two GET routes and their wire models** — `65caa1488` (feat)

No REFACTOR commit — the GREEN implementation needed no cleanup.

## Files Created/Modified

- `backend/app/services/sources/health_verdict.py` (created, 149 L) — `Verdict` (frozen dataclass) + `verdict_for_runs`. Imports only `failure_cause`; reaches no data-access, routing or driver layer, asserted over the live source.
- `backend/tests/unit/services/test_source_health_verdict.py` (created, 30 cases) — 18 pure-verdict cases (non-vacuity first) + 12 route-level cases.
- `backend/app/api/sources.py` (+175 L, append + imports + docstring only) — `list_watch_sync_runs`, `get_source_health`, `_HEALTH_RUN_WINDOW`.
- `backend/app/models/source.py` (+3 classes, APPENDED at the end) — `SyncRunResponse`, `StoppedSourceResponse`, `SourceHealthResponse`.

## Verification — recorded, not asserted

**Backend unit gate, verbatim tail:**

```
71 failed, 3863 passed, 2 xfailed, 2 xpassed, 42 warnings in 133.80s (0:02:13)
```

Against the plan's inherited baseline of **72 failed** (RESEARCH C-1) and CLAUDE.md's locked ceiling of **71**: this reads **71**, i.e. **at or below both — zero new failures**.

**Targeted suites:**

```
tests/unit/services/test_source_health_verdict.py  +  tests/unit/api/test_sources_watches_api.py
40 passed, 1 warning in 0.94s
```

**Phase 234's `test_sources_watches_api.py` before / after: 10 passed / 10 passed** — the file is byte-unchanged (`git diff --name-only 188b70d8b HEAD` lists four files and it is not among them).

**Acceptance greps:**

| Criterion | Result |
|---|---|
| `grep -cE "^(from\|import) .*(app\.db\|app\.api\|asyncpg\|supabase)" health_verdict.py` | **0** |
| `grep -c "= 3" health_verdict.py` | **0** (threshold imported, never re-declared) |
| `grep -n "watch_process_enabled" api/sources.py` | **empty** |
| `grep -c "app\.state\.watch_service" api/sources.py` | **1**, inside `get_source_health` |
| `@router.get` count | 2 → **4** (exactly +2) |
| `_enrich_watch_rows` (`:55-88`) / `trigger_watch_sync` (`:261-295`) touched? | **No** — diff hunks are `@@ -10,0` (docstring), the import block, and `@@ -356,0` (append) |

**Validation rows discharged:** V-05 (hard 1 / soft 3 / two-is-not-stopped), V-06 (zero rows ⇒ `neverRead`), V-13 backend half (no signal for healthy, none for one soft failure), V-19 (live reader over config flag).

## Decisions Made

1. **`_HEALTH_RUN_WINDOW` is derived, not typed.** `max(5, SOFT_FAILURE_THRESHOLD + 1)`. A literal `5` would keep working today and silently under-report stopped sources the day the threshold moves — the same "second place that decides the rule" defect D-235-05 exists to prevent, one level down.
2. **Connection names are a second, conditional query.** The verdict is computed first; names are fetched in ONE `= ANY($1)` query only for the watches that actually stopped, which is zero rows on a healthy instance. Its failure is caught separately and logged: a missing name costs a sentence a noun, never the verdict.
3. **Route tests went into `test_source_health_verdict.py`, not Phase 234's file.** The acceptance criterion asks for 234's file to be *"still passing at its prior count (10)"*; adding cases there would have moved the count for two reasons at once and made the before/after unreadable.
4. **`SUCCESS_STATUS` is an allow-list of one.** Anything that is not `"success"` counts toward the failure streak, including `paused` and any status a future release arm invents. A deny-list would let a new status silently reset a streak and re-hide a dead source.
5. **The config flag's NAME is absent from `api/sources.py` entirely** — including from the prose explaining why it must not be read. Its absence *is* the grep guard, and a mention in a comment reads to that grep exactly like a use. The forbidden name is spelled out in the test instead (`test_health_route_never_mentions_the_config_flag`).

## Deviations from Plan

None — plan executed exactly as written.

One in-flight correction worth naming, made and fixed inside Task 2 rather than shipped: the first draft of the `reader_running` comment named the config flag in prose, which tripped my own live-source guard AND would have broken the plan's `grep -n "watch_process_enabled"` acceptance criterion. Both the comment and the guard were adjusted so the name lives only in the test. The guard fired on a real defect before the commit — it is not an adopted-green fence.

## Issues Encountered

- **`Request.app.state` raises `AttributeError` for a key a lifespan never set.** A probe `FastAPI()` in a unit test has no `watch_service` attribute at all, and plain attribute access would 500 the endpoint every page polls. Resolved with `getattr(..., None)`, which is also the honest reading: an app that never started the reader is not running it. Documented inline.

## Known Stubs

None. Every field the endpoint returns is derived from live state or stored rows.

## Threat Flags

None — no new network endpoint, auth path, file access pattern or schema change beyond the two reads the plan's own threat register already covers (T-235-18 through T-235-21, all mitigated as specified).

## Honest caveats carried forward

- **`last_good_at` on `/sources/health` is "the newest success WITHIN the window"** (currently 5 rows). A source that has failed more times than the window is deep reports `None`, which reads the same as "never succeeded". The unbounded answer is `GET /sources/watches/{id}/runs`, which the card renders. Stated in the code at `_HEALTH_RUN_WINDOW` rather than left for a reader to discover.
- **`stopped_since` is populated whenever a failure streak exists, including when the verdict is NOT stopped** (per the plan's behaviour spec). The endpoint only projects stopped verdicts, so nothing renders it early; a future consumer reading `Verdict` directly should gate on `stopped`.

## Next Phase Readiness

- `frontend/src/lib/api/sources.ts`'s `SyncRun`, `StoppedSource` and `SourceHealth` interfaces are satisfied character-for-character (`reader_running`, `poll_interval_seconds`, `stopped[].watch_id`, `.cause`, `.hard`, `.stopped_since`, `.last_good_at`). Plan 04's `useSourceAttention` can consume this without deriving anything.
- Plan 07 owns `_enrich_watch_rows`, `trigger_watch_sync`, `WatchResponse` and `WatchSyncResponse` — all four are byte-unchanged here, and the new models were appended at the end of `models/source.py` so the two plans cannot collide on a line.
- ⚠ The reader-off instance statement (D-235-12) is now *available* at `reader_running: false` but nothing renders it yet — that is the Wave-4 surfaces' obligation.

## Self-Check: PASSED

- `backend/app/services/sources/health_verdict.py` — FOUND
- `backend/tests/unit/services/test_source_health_verdict.py` — FOUND
- `backend/app/models/source.py` — FOUND (modified)
- `backend/app/api/sources.py` — FOUND (modified)
- `203cb2a79` — FOUND
- `41149fd81` — FOUND
- `65caa1488` — FOUND
- STATE.md / ROADMAP.md / `scripts/vitest-count-gate.cjs` — NOT modified (`git diff --name-only 188b70d8b HEAD` lists exactly the four plan files)

---
*Phase: 235-the-source-says-what-it-did*
*Completed: 2026-09-06*
