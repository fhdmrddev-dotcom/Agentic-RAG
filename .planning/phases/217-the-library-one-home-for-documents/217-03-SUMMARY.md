---
phase: 217-the-library-one-home-for-documents
plan: 03
subsystem: backend-api
tags: [library, retrieval-analytics, audit-log, service-role, LIB-04]
requires:
  - "audit_log `search.query` rows written by tool_dispatcher.py:796-801 and :958-965"
  - "backend/app/api/knowledge_health.py — WINDOW_DAYS + _window_cutoff + the classified exception's shipped three-part form"
  - "backend/app/utils/db.py — aexec"
provides:
  - "GET /documents/{document_id}/queries — the caller's own searches that returned this document, within 30 days"
  - "DocumentQueryRow {query_text, asked_at, via} — module-local, deliberately NOT in models/document.py"
  - "backend/app/api/document_queries.py — the second module in the repo carrying the CLASSIFIED service-role rationale"
affects:
  - "backend/app/main.py — one import token + one include_router line"
  - "the /documents prefix — now served by TWO routers (documents.router first, document_queries.router after)"
tech-stack:
  added: []
  patterns:
    - "PostgREST jsonb containment (.contains) as a NARROWING filter, with the shipped knowledge_health fetch-then-filter Python guard kept beside it"
    - "the classified service-role carve-out declared ONCE in a module docstring, restated per-route as a trailing inline comment"
key-files:
  created:
    - backend/app/api/document_queries.py
    - backend/tests/test_217_document_queries.py
  modified:
    - backend/app/main.py
decisions: [D-217-06, D-217-07]
metrics:
  duration: "~35 min"
  completed: "2026-08-29"
  tasks: 2
  commits: 2
  files_created: 2
  files_modified: 1
---

# Phase 217 Plan 03: The questions that found it — Summary

`GET /documents/{id}/queries` ships in its own uniformly-service-role module, deriving the fifth of
SC#4's six buried facts from the `audit_log` `search.query` rows the retrieval path already writes —
zero schema, zero new writer, and one auditable rationale for the RLS carve-out instead of a
service-role branch inside the otherwise user-JWT `documents.py`.

## Which filter arm shipped, and why

**The primary arm shipped: `.contains("metadata", {"document_ids": [document_id]})` PLUS the Python
guard.** The plan named the fetch-then-filter fallback as the escape hatch if containment
misbehaved. It did not misbehave — **assumption A1 was measured against the live local DB rather
than reasoned about**, at both layers:

**(1) SQL layer** — `psycopg2` on `127.0.0.1:54322`:
```
'{"document_ids":["a","b"],"query_text":"x"}'::jsonb @> '{"document_ids":["a"]}'::jsonb  →  True
select count(*) from audit_log where action_type='search.query'                          →  3077
```

**(2) PostgREST layer** — the real `supabase-py` service-role client, running the exact chain the
route runs, against a real user id and a real document id taken from the newest audit rows:

| arm | rows |
|---|---|
| every `search.query` row for that user in the 30-day window (paginated) | 910 |
| Python guard only | **48** |
| `.contains` | **48** |
| rows the guard found that `.contains` missed | **[]** |
| cross-user rows for the same document (negative control) | **0** |

`.contains` is therefore both **sound** (every row it returns really carries the id) and **complete**
(it misses none the guard finds), at the layer that ships.

⚠ **The FIRST probe run printed `MISMATCH — use fallback arm` (48 vs 44), and that verdict was
WRONG.** It is recorded here rather than quietly dropped because the failure mode is reusable:
**PostgREST caps an unpaginated `select` at 1000 rows**, so the probe's un-narrowed base arm was
truncated and the Python-guard count was computed over a partial set. Round 2 paginated the base
arm with `.range()` and the two arms agreed exactly. *A probe that is not itself bounded-correct
manufactures a defect in the thing it is probing.*

**The Python guard was kept anyway**, exactly as the plan asked — it is what makes T-217-11 hold if
containment ever changes behaviour, and one of its cases (`metadata: null`, `metadata: {}`) is
asserted in the suite.

## Tasks

| Task | Name | Commit | Files |
|---|---|---|---|
| 1 | A dedicated, uniformly service-role module for `GET /documents/{id}/queries` | `32453fee5` | `backend/app/api/document_queries.py` |
| 2 | Register the router and prove the gate with the shipped assertion shape | `321d9c6d2` | `backend/app/main.py`, `backend/tests/test_217_document_queries.py` |

## The security gate (T-217-10 / T-217-11), and how it was proven

RLS is bypassed by construction on this route, so `.eq("user_id", current_user["id"])` is the sole
gate. It is asserted three ways, none of which is "read the code and believe it":

1. **From the mock's own call log** — `mock_builder.eq.call_args_list[0].args == ["user_id",
   mock_user_data["id"]]`. Positional, so it pins that user_id is the **FIRST** filter, not merely
   present.
2. **A source fence** over `document_queries.py` for seven request-shaped reads (`user_id: str =`,
   `= Query(`, `= Body(`, `= Header(`, `= request.`, `= payload`, `= body`) — **with a non-vacuity
   control** that asserts all seven patterns fire against a synthetic hostile handler. A fence that
   has never been seen to fire is not a fence.
3. **Driven RED against a planted defect.** `user_id` was demoted below `action_type` in the query
   chain; **exactly one case failed** (`test_user_id_filter_is_applied_in_the_sql`) and the other
   eight stayed green — so the assertion is specific, not incidental. The module was restored and
   `git status` confirms it is identical to the committed blob.

## Verification

| Check | Result |
|---|---|
| `pytest tests/test_217_document_queries.py -q` | **9 passed** |
| `python -c "import app.main"` | imports |
| `grep -c "document_queries" app/main.py` | **2** (import + include_router) |
| `grep "\.execute()" app/api/document_queries.py` | none — every query is `await aexec(` |
| `grep -c "SERVICE-ROLE (classified)" app/api/document_queries.py` | 1 |
| `DocumentQueryRow` in `models/document.py` | absent, as required |
| `WINDOW_DAYS` | imported from `knowledge_health`, never redeclared |

**The `tests/unit` baseline was MEASURED, not inherited.** `main.py` was reverted to HEAD, the full
suite run, then the change re-applied and the suite run again:

| | tests/unit |
|---|---|
| at HEAD (without this plan's `main.py` change) | **68 failed / 3110 passed** / 2 xfailed / 2 xpassed |
| with this plan's change | **68 failed / 3110 passed** / 2 xfailed / 2 xpassed |

Identical — this plan adds zero failures. ⚠ **CLAUDE.md's recorded backend baseline of
`62 failed / 1986 passed` is STALE** (it is quoted under the worktree-parallelism rules). The suite
has grown to **3110 passing**; the figure is recorded beside the old one rather than over it, and
the 68 failures are pre-existing rot in 21 files this plan does not touch — the largest clusters
being `test_retrieval_service.py` (15) and `test_sql_service.py` (12). The only failing file with a
path to `main.py`, `test_lifespan.py` (3), fails with `TypeError: object MagicMock can't be used in
'await' expression` — a mock-shape defect, unrelated to router registration, and present at HEAD.

## Deviations from Plan

### Auto-fixed / additions

**1. [Rule 2 — missing critical functionality] `MAX_ROWS = 100` bound on the read**
- **Found during:** Task 1
- **Issue:** T-217-13 names the DoS surface (`audit_log.metadata` has no GIN index) and the plan
  bounds it by the 30-day window and the user scope — but nothing bounded the ROW COUNT. The live
  probe measured **910** `search.query` rows for one user inside that window; a heavily-retrieved
  document could return hundreds of rows to a detail panel.
- **Fix:** `.order("created_at", desc=True).limit(MAX_ROWS)` — newest questions first, capped at
  100, with the constant commented against T-217-13.
- **Files modified:** `backend/app/api/document_queries.py`
- **Commit:** `32453fee5`

**2. [not a deviation — recorded so it is not mistaken for one] `_window_cutoff` imported alongside `WINDOW_DAYS`**
- The plan mandated importing `WINDOW_DAYS` rather than redeclaring `30`. The shipped cutoff helper
  is imported with it (a leading-underscore cross-module import) so the cutoff SEMANTICS cannot
  drift either — a second copy of `now - timedelta(days=N)` is the same class of drift fence A6e
  exists to prevent. Called out because a reviewer will notice the private import.

**3. [test-infrastructure] `mock_builder.contains.return_value` wired in this suite**
- `backend/tests/conftest.py`'s shared builder predates jsonb containment and does not configure
  `.contains`, so it would return a fresh auto-child `MagicMock` and silently break the chain —
  every case would then pass for the wrong reason. A module-scoped autouse fixture wires it.
  **`conftest.py` was NOT edited** (it is outside this plan's `files_modified` and is shared with
  the sibling agent's plan).

## Seams and observations for the phase

⚠ **`217-VALIDATION.md:95` names the wrong file for this plan's own gate assertion.** The row
*"`/queries` scopes by `user_id` in the SQL, never from the request"* points its evidence at
`tests/test_217_document_detail_routes.py` (the sibling plan's file, "same file" as row `:94`).
This plan's `<files>` mandates `backend/tests/test_217_document_queries.py`, and that is where the
assertion lives. **The row is satisfied — by a different filename than it names.** Not edited here:
VALIDATION.md is outside this plan's `files_modified`, and the sibling agent owns the adjacent
rows. The phase close should reconcile the two.

⚠ **`backend/app/api/knowledge_health.py` is now imported by a second API module.** Its
`FIRES / ⚠ absent at 5 phases` hot-file row is unchanged by this plan (the file is not modified),
but `WINDOW_DAYS`, `_window_cutoff` and its docstring form now have an external consumer, so a
future refactor of that module has one more caller than its row implies.

**No new outbound surface, no migration, no RLS policy, no package install** (T-217-SC clear).

## Threat Flags

None. Every surface this plan introduces is in the plan's own `<threat_model>`; the one addition
(`MAX_ROWS`) mitigates T-217-13 rather than opening anything.

## Known Stubs

None. The route is wired end-to-end to real `audit_log` data — proven against 3077 live
`search.query` rows, 48 of which reference the probed document.

## Self-Check: PASSED

- `backend/app/api/document_queries.py` — FOUND
- `backend/tests/test_217_document_queries.py` — FOUND
- `backend/app/main.py` — FOUND (2 `document_queries` references)
- commit `32453fee5` — FOUND
- commit `321d9c6d2` — FOUND
