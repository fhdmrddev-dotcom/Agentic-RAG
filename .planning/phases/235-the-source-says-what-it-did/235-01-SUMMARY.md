---
phase: 235-the-source-says-what-it-did
plan: 01
subsystem: connector-watch-history
tags: [migration, dal, asyncpg, rls, retention, surf-02]
status: paused-at-checkpoint
requires:
  - connector_watches (migration 168)
  - public.autofill_org_id_by_owner (migration 106)
  - public.current_user_org_ids
provides:
  - connector_sync_runs table (migration 172)
  - db.watches.release_watch writes one bounded run row per release
  - db.watches.list_sync_runs (owner-predicated per-watch history)
  - db.watches.recent_runs_by_watch (one windowed multi-watch read)
  - settings.watch_run_history_retention
affects:
  - backend/app/db/watches.py
  - backend/app/config.py
tech-stack:
  added: []
  patterns:
    - "RLS Shape A (tenant membership AND owner), four policies, predicate verbatim from 168"
    - "insert + prune as ONE statement via a CTE, retain bound as a parameter"
    - "swallow-and-log best-effort writer (release_watch's existing policy, inherited by the insert)"
    - "owner predicate in SQL for every pool read (the pool path is not RLS-gated)"
key-files:
  created:
    - supabase/migrations/172_connector_sync_runs.sql
  modified:
    - backend/app/db/watches.py
    - backend/app/config.py
    - backend/.env.example
    - deploy/onebox.env.example
    - backend/tests/unit/db/test_watches_db.py
decisions:
  - "D-235-20 confirmed: the migration is 172, not ROADMAP's stale 161 — supabase/migrations/ ends at 171_reserved.sql"
  - "The run-row write lives INSIDE release_watch, not at the four call sites (RESEARCH C-3's one-home seam)"
  - "No consecutive-failure counter column — the count is DERIVED from the run rows (RESEARCH 13.2)"
  - "GREATEST(retain - 1, 0) in the prune, because the CTE and the DELETE share one snapshot"
  - "watch_run_history_retention lives in config.py, not app_settings — a daemon bound, not a governed policy (SEED-250 re-open)"
metrics:
  duration: ~12 min (to the checkpoint)
  tasks_complete: 2 of 3
  completed: 2026-09-06
---

# Phase 235 Plan 01: The Counts Dict Gets A Home — Summary

`connector_sync_runs` exists as migration 172, and `release_watch` now writes exactly one bounded,
owner-attributed row into it on every release of a watch — with the two reads the history and the
health verdict will consume.

**⏸ PAUSED AT THE TASK 3 CHECKPOINT.** The migration is written and committed but has **not** been
applied to the live local database, and `supabase/full-schema.sql` has **not** been regenerated.

---

## What Was Built

### Task 1 — `supabase/migrations/172_connector_sync_runs.sql` (commit `a1229adcd`)

One table, two indexes, four RLS policies, one trigger, the 168 grant block, and a correction to
migration 168's own COMMENT.

- **Six flat integer count columns, not a `jsonb` blob.** A `jsonb` string-scalar column has silently
  killed a per-step count in this repository before (`workflow_phases.output`, Phase 200). Named
  integers cannot suffer that, index cleanly, and let the health verdict be a plain SQL aggregate.
- **`listing_complete boolean NOT NULL DEFAULT false`, and it is the load-bearing column.**
  `watch_service.py:415-420` *suppresses* missing-state transitions when the source listing did not
  finish, so such a tick records `count_missing = 0` **by design rather than by observation**.
  Rendering that 0 as "nothing was deleted" would be the Onyx #1161 lie one layer up. The column's
  COMMENT states that reason in full rather than pointing at it.
- **No CHECK on `status` or `failure_cause`.** An unanticipated value written by a background loop
  must never become a 500 — the same reasoning that left `connector_watches.last_status` free text.
- **Append-only: no `updated_at` column and no mutation trigger.** A run row that can be edited
  after the fact is not a record of what happened. This is a stated deviation from 168, not an omission.
- **`idx_connector_sync_runs_watch_time` on `(watch_id, started_at DESC)`** serves both the history
  read and the consecutive-failure derivation. One index, two consumers.
- **168's `last_status` COMMENT corrected in the same migration.** It documented `partial` and
  `skipped_still_running` (written by nothing — `record_skipped_still_running` is called from no
  production path) and omitted `paused` (written by `watch_service.py:143`). Corrected to the
  measured set, with the two phantom values explicitly marked as written by nothing, and with
  `pending` named as read-time synthesis that is never stored.

### Task 2 — the writer, the two reads, and the knob (commits `ed3229348` RED → `0525f1cf6` GREEN)

- **`release_watch` gained seven optional keyword-only parameters** and now issues the UPDATE it
  always did **plus** one `connector_sync_runs` row, inside the same `try`. Its first four parameters
  keep their names and order, so all four existing call sites compile unchanged.
- **The write lives here rather than at the call sites on purpose.** `watch_service.py` releases a
  watch from four places, one of which (`tick():115`) is outside `sync_watch` entirely. Writing the
  row at each site means a fifth arm added later silently stops recording history; writing it here
  means all four get a row **by construction**.
- **The insert inherits the swallow-and-log policy**, which is the point (T-235-05). Losing a
  history row must never turn a successful sync into a failed one.
- **Insert + prune are ONE statement.** `retain` is bound as `$15`, never interpolated (T-235-04).
- **`list_sync_runs` and `recent_runs_by_watch` carry the owner predicate in the SQL itself**
  (T-235-01) — the asyncpg pool path is **not** RLS-gated, so a guessed `watch_id` must return zero
  rows rather than another tenant's history. `get_watch_items` above them deliberately has no owner
  predicate because its route checks first; the difference is now documented at the section head.
- **No consecutive-failure counter column was added.** The count is derived from the leading run
  rows, served by the same index. A counter would require four sites to increment and reset it, and
  could drift undetectably from the history the user is looking at.

---

## ⭐ The measured surprise worth keeping

**`GREATEST($15::int - 1, 0)`, not `LIMIT $15`.** The prune's sub-SELECT and the insert CTE share one
snapshot, so **the row just inserted is invisible to the prune** and cannot be deleted by it. Keeping
`retain` of the pre-existing rows would therefore leave `retain + 1` rows, and the bound would drift
upward by one row on **every single tick** — a bound that silently isn't one. Keeping `retain - 1`
leaves exactly `retain` including the new row. `GREATEST(…, 0)` makes `retain = 1` mean "only the
newest" rather than a negative LIMIT.

⚠ **This is reasoned, not measured against a live database** — the unit tests mock the pool, so they
prove the statement carries the prune and binds the parameter, nothing more. It is called out here
so the operator's G-4 rows can check it against real rows once the migration is applied.

---

## Deviations from Plan

### `[Rule 1 - Bug]` Task 1's `grep -c "current_user_org_ids"` acceptance criterion is arithmetically wrong

- **Found during:** Task 1 verification.
- **Issue:** the criterion states the count returns **4** ("one per policy"). Measured on migration
  168 — the file the plan mandates copying character-for-character — `grep -c` returns **5**, because
  `grep -c` counts matching **lines** and the UPDATE policy carries the predicate **twice** (`USING`
  *and* `WITH CHECK`). 4 policies, 5 predicate lines.
- **Fix:** the verbatim-copy constraint wins (it is security-bearing and named in the plan's own
  critical constraints). Migration 172 measures **5**, identical in shape to 168. The criterion is
  recorded here as wrong rather than the migration being bent to satisfy it.
- **Commit:** `a1229adcd`.

### `[Rule 1 - Bug]` My own RED test bound the retention parameter at the wrong index

- **Found during:** Task 2 GREEN run — 2 of the 8 new cases failed with `IndexError`.
- **Issue:** the test asserted `call_args[0][15 + 1]`. `args[0]` is the SQL string, so `$n` is
  `args[n]`; retain is `$15` → `args[15]`.
- **Fix:** corrected to `args[15]` with a comment naming the indexing rule. This was an arithmetic
  slip in the test, not a change to the contract the RED commit pinned — the asserted *values* are
  untouched.
- **Commit:** `0525f1cf6`.

### `[Rule 2 - Missing critical]` My own docstring broke the `run_in_threadpool` guard-grep

- **Found during:** Task 2 acceptance checks — `grep -c "run_in_threadpool" backend/app/db/watches.py`
  returned **1**, not 0.
- **Issue:** the token appeared in a docstring stating that the wrapper **does not** apply to this
  file. Honest prose, but it makes an absence-guard read a false positive **forever**, for every
  future auditor.
- **Fix:** reworded to convey the same fact without the literal token, and added a parenthetical
  saying the token is kept out of the file *on purpose* so nobody re-adds it. Count now **0**.
- **Commit:** `0525f1cf6`.

### `[Rule 3 - Blocking]` An existing passing test asserted on "whatever was called last"

- **Found during:** Task 2 design.
- **Issue:** `test_release_and_skip_still_running` asserted the lease UPDATE via
  `con.execute.call_args[0][0]` — the **last** call. `release_watch` now issues two statements, so
  that assertion would silently have started asserting against the run-row insert.
- **Fix:** repinned by **position** (`call_args_list[0]`), with a comment naming why. The assertion's
  subject is unchanged; only its addressing is.
- **Commit:** `ed3229348`.

### Deviation of record: `full-schema.sql` will not share the migration's commit

The plan asks for the regenerated `supabase/full-schema.sql` to land **in the same commit** as the
migration. It cannot: regeneration requires the migration to be live in the local database, which is
the Task 3 human checkpoint. The migration is committed alone (`a1229adcd`) and the regenerated
artifact will follow in its own commit on resume.

---

## Verification

**Backend unit gate — the verbatim tail line:**

```
72 failed, 3793 passed, 2 xfailed, 2 xpassed, 43 warnings in 98.17s (0:01:38)
```

- **72 failed is the inherited baseline, unchanged.** RESEARCH C-1 measured `72 failed, 3785 passed`
  on this phase's merge base, and Phase 234's verification measured 72 on **its** merge base too.
  **No new failure.** CLAUDE.md's ceiling of 71 is stale and the one-over is pre-existing; it was
  not "fixed" here, per the plan's explicit instruction.
- **Passed rose 3785 → 3793 (+8)** — exactly the eight cases this plan added.
- **0 collection errors** (no collection-error line in the summary).

**Targeted suite — `tests/unit/db/test_watches_db.py`:**

| | count |
|---|---|
| before this plan | **6 passed** |
| after this plan | **14 passed, 0 failed** |

**Neighbouring suites (the four `release_watch` call sites and the sources API):**
`tests/unit/services/test_watch_service.py` + `tests/unit/api/test_sources_watches_api.py` →
**16 passed, 0 failed.**

**`bash scripts/check-deploy-drift.sh`** → `RESULT: PASS`, **exit 0**. Two WARNs, both pre-existing
and unrelated (the OPERATOR.md seed-list review backlog, and `docker compose` being unavailable in
this shell — CI runs the authoritative parse).

**Acceptance criteria:**

| Criterion | Result |
|---|---|
| `grep -c "run_in_threadpool" backend/app/db/watches.py` = 0 | ✅ **0** |
| `INSERT INTO connector_sync_runs` inside `release_watch`'s `try` | ✅ `watches.py:333` |
| owner predicate inside `list_sync_runs` | ✅ `watches.py:427` (and `:472` for the windowed read) |
| `watch_service.py` byte-unchanged | ✅ `git diff --numstat` names it **not at all** |
| `bash scripts/check-deploy-drift.sh` exits 0 | ✅ |
| `grep -c "current_user_org_ids"` in migration 172 | ⚠ **5**, not the criterion's 4 — see Deviations |
| no `CHECK (` on `status` / `failure_cause` | ✅ (the two `CHECK (` hits are the RLS `WITH CHECK` clauses) |
| no `updated_at` column, no mutation trigger | ✅ |
| `last_status` COMMENT appears once, contains `paused` | ✅ |

**Frontend:** untouched by this plan. The vitest gate was **deliberately not run**, stated here
rather than skipped silently.

---

## Known Stubs

None. Nothing in this plan renders to a user; the surfaces that consume these reads are Plans 02-06.

⚠ **One honest limit, not a stub:** every new test is a **shape assertion** over a `MagicMock` pool.
They prove the SQL carries the prune, the owner predicate and a bound parameter — they prove nothing
about what Postgres does with any of it. The live behaviour is owed to the applied migration and the
phase's G-4 rows.

---

## Threat Flags

None. This plan adds no network endpoint, no auth path and no file access. The one new trust surface
is `connector_sync_runs` itself, which was in the plan's threat register and carries RLS Shape A plus
in-SQL owner predicates on both pool reads.

⚠ **Research assumption A1 remains unverified and is carried forward, not closed:** which database
role the asyncpg pool connects as, versus migration 172's grants. The 168 grant block was kept
verbatim rather than narrowed precisely because `release_watch` swallows its exceptions, so a
silently-failing INSERT would be invisible. The follow-up — narrow `authenticated` to `SELECT` once
the pool role is measured — is recorded in the migration's own header, where whoever narrows it will
be reading.

---

## ⏸ Checkpoint — what remains

**Task 3 (`checkpoint:human-action`) is not done.** Outstanding:

1. Paste `supabase/migrations/172_connector_sync_runs.sql` into the Supabase SQL editor
   (http://localhost:54323 → SQL Editor). ⛔ **Not** `supabase db push` / `db reset` — both wipe dev data.
2. Confirm: `select count(*) from connector_sync_runs;` → `0` ·
   `select relrowsecurity from pg_class where relname = 'connector_sync_runs';` → `t` ·
   `select count(*) from pg_policies where tablename = 'connector_sync_runs';` → `4`.
3. Then `bash scripts/regenerate-full-schema.sh` — ⛔ **without** `--reset` — and commit the
   regenerated `supabase/full-schema.sql`.

Until step 1 lands, `release_watch`'s INSERT targets a table that does not exist — and **it will
swallow that failure silently by design**, so the absence of an error is not evidence the write
worked. The first honest check is `select count(*) from connector_sync_runs` returning a non-zero
number after a real tick.

---

## Self-Check: PASSED

All six named files exist on disk. All three commits (`a1229adcd`, `ed3229348`, `0525f1cf6`) resolve
in `git log`. The working tree carries no new untracked files from this plan — the five untracked
entries present are pre-existing and predate this execution.
