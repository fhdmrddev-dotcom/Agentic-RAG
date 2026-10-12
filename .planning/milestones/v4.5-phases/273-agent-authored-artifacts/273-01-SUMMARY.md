---
phase: 273-agent-authored-artifacts
plan: 01
subsystem: database
tags: [pydantic, asyncpg, postgres, rls, migration, artifacts]

requires:
  - phase: 272-close-means-wrong
    provides: the frozen 71-failure backend SET and the by-reference ToolContext accumulator shape (empty_filter_fields_in_run)
provides:
  - "backend/app/models/artifact.py — the closed show_artifact vocabulary (ShowArtifactArgs union, caps, refusal catalogue, result contract, history-placeholder prefixes, stored-spec models)"
  - "backend/app/db/artifacts.py — insert_artifact (advisory-locked label, RETURNING row as the wire dict), get_artifact_by_ref, list_thread_labels"
  - "supabase/migrations/202_message_artifacts.sql — public.message_artifacts, applied to the live LOCAL DB"
  - "backend/tests/unit/fixtures/artifact_record_v1.json — the frozen wire contract (chart, table, metric, by-reference chart)"
  - "ToolContext.turn_tool_calls (Pattern 5)"
  - "273-BASELINES.md — PHASE_BASE gate SET + migration 202 apply evidence"
affects: [273-02, 273-03, 273-04, 273-06, deploy-parity]

tech-stack:
  added: []
  patterns:
    - "Validators raise PydanticCustomError('artifact_refusal', ctx={reason, detail}) so a worded refusal survives the discriminated union and maps 1:1 to the tool result"
    - "People-facing reason built only from catalogue templates + counts + _SAFE_NAME names (≤40 shown); model-facing detail kept separate; no 'error' key"
    - "Trigger-enforced immutability with a positive-form FK-upkeep exemption (to_jsonb(NEW) - 'run_id' - 'parent_id')"

key-files:
  created:
    - backend/app/models/artifact.py
    - backend/app/db/artifacts.py
    - supabase/migrations/202_message_artifacts.sql
    - backend/tests/unit/fixtures/artifact_record_v1.json
    - backend/tests/unit/test_273_artifact_models.py
    - backend/tests/unit/test_273_migration_202_shape.py
    - backend/tests/unit/test_273_db_artifacts.py
    - .planning/phases/273-agent-authored-artifacts/273-BASELINES.md
  modified:
    - backend/app/services/tool_dispatcher.py
    - scripts/full-schema-supplement.sql

key-decisions:
  - "service_role is REVOKE ALL'd before its SELECT/INSERT/DELETE grant — Supabase default privileges otherwise leave it UPDATE (found by the live VERIFY)"
  - "Labels are numbered MAX(ordinal)+1 per component per thread (not count(*)+1) under the advisory lock; UNIQUE (thread_id, label) is the belt"
  - "Dataset byte cap is measured against MAX_SPEC_BYTES minus a 4 KiB reserve (title + encoding + slots) with jsonb-style separators, so a model-accepted spec can never trip the DB CHECK"
  - "Refusal reasons are people-safe paraphrases; spec keys (from_artifact, transform) appear only in the model-facing detail"
  - "ART-01..05 are NOT marked complete by this plan — it lays contracts only; the tool, loop and UI land in 273-02/03/04"

patterns-established:
  - "validate_dataset(component, columns, rows, chart, metric) over plain lists — the one check both first emission and 273-03's post-transform path run"
  - "Every message_artifacts pool read binds thread_id AND user_id; a ref that is neither ^a_[0-9a-z]{10}$ nor a label returns None with no query"

requirements-completed: []
requirements-contributed: [ART-01, ART-02, ART-03, ART-04, ART-05]

duration: ~75min
completed: 2026-10-03
---

# Phase 273 Plan 01: Artifact contracts and store Summary

**A closed Pydantic vocabulary for `show_artifact` (three components, four chart kinds, caps that refuse and never truncate), a `message_artifacts` table whose visibility is the `messages` SELECT predicate verbatim with no client write path and trigger-enforced immutability, thread+user-bound asyncpg helpers, and a frozen wire fixture — migration 202 applied to the live local DB and proven against anon, a second user, and both FK-upkeep paths.**

## Performance

- **Duration:** ~75 min (including two 9-minute backend gate runs)
- **Started:** 2026-10-03
- **Completed:** 2026-10-03
- **Tasks:** 3 of 3 executed; Task 3's last step (full-schema regeneration) is owed to the operator — see CHECKPOINT below
- **Files:** 8 created, 2 modified

## PHASE_BASE

`f764734979c25696544b2408232f4fbdc779ae5f`. The worktree started on `master` (`86d9559bb`) and was
reset to it per the branch check. Backend gate at base: `71 failed, 6474 passed` — the failed SET is
identical to 272-BASELINES.md's (diffed, not eyeballed). Full SET in `273-BASELINES.md` §(a).

## Accomplishments

- **models/artifact.py** — exports `ShowArtifactArgs`, `ChartArgs` / `TableArgs` / `MetricArgs`,
  `ARTIFACT_COMPONENTS == ("chart","table","metric")` and `CHART_KINDS == ("line","bar","area","scatter")`
  (both via `get_args`), `MAX_ROWS`, `MAX_COLUMNS`, `MAX_SERIES`, `MAX_SPEC_BYTES`, `MAX_CELL_CHARS`,
  `KIND_ALIASES`, `validate_args`, `validate_dataset`, `ArtifactRefusal`, `refusal_payload`,
  `RESULT_ID_KEY`, `REFUSED_STATUS`, `RESULT_KEY_ORDER`, `artifact_id_from_result`, `is_refusal_result`,
  `ROWS_PLACEHOLDER_STORED`, `ROWS_PLACEHOLDER_NOT_STORED`, `ARTIFACT_ID_RE`, `ARTIFACT_LABEL_RE`,
  `ARTIFACT_RECORD_KEYS`, `StoredArtifactSpec` (+ `StoredChartEnc` with server-only `slots`).
  Imports pydantic + stdlib only (a subprocess test proves `tool_dispatcher` is not imported).
- **db/artifacts.py** — `insert_artifact` (one transaction: `pg_advisory_xact_lock(hashtextextended(thread, 273))`
  → next ordinal → `INSERT … RETURNING *`; PK collision retried once; returns the JSON-safe row),
  `get_artifact_by_ref`, `list_thread_labels`, `new_artifact_id`. `$N` placeholders only, no modifying statement.
- **Migration 202** — table, 4 indexes, COMMENT on every column, org autofill trigger, immutability
  trigger + function (EXECUTE revoked from PUBLIC/anon/authenticated), RLS, PUBLIC-first revokes,
  SELECT-only `authenticated`, `SELECT, INSERT, DELETE` for `service_role`, one SELECT policy, VERIFY block.
- **Supplement** — the table ACL block after 195's and the trigger-function block at the end of §6b;
  `check-schema-acl-parity.cjs` tuples: `mirrored: 203/203`.
- **ToolContext.turn_tool_calls: list[dict] | None = None** directly after `empty_filter_fields_in_run`;
  `git diff --stat` on tool_dispatcher.py shows that one 6-line hunk.

## The refusal catalogue as implemented (`_R`, people-facing short forms)

| key | reason |
|---|---|
| unknown_component | `something other than a chart, table or metric` |
| kind_alias | `"{alias}" is not a chart kind` (alias ∈ pie, donut, radar, heatmap, histogram, treemap, funnel, gauge) |
| kind_unknown | `a chart kind we can't draw` |
| too_many_rows | `{n:,} rows (max 500); aggregate first` |
| no_rows / no_columns | `no rows to show` / `it has no columns` |
| too_many_columns | `{n} columns (max 20)` |
| too_large | `{kib} KiB of data (max 256 KiB); aggregate first` |
| too_many_series | `{n} series (max {cap})` |
| ragged_row | `row {i} has {got} values for {n} columns` |
| duplicate_column | `two columns share a name` |
| not_a_number / not_text / cell_too_long | `a value in {column} isn't a bare number` / `… isn't text` / `… is over 200 characters` |
| missing_column_named / missing_column | `{column} isn't one of its columns` / `it names a column it doesn't have` |
| series_not_number | `{column} isn't a number column` |
| metric_one_row | `a metric needs exactly one row` |
| placeholder_stored / placeholder_not_stored | `rows were a reference to a shown artifact, not data` / `rows were a placeholder from a refused call, not data` |
| both_reference_and_rows | `it sent new rows and a reference at once` (detail: `pass from_artifact OR rows, not both…`) |
| transform_without_reference | `it asked to change an artifact without naming one` |
| top_n_without_sort | `a top-N needs a sort order` |
| bad_filter | `a filter we can't apply` |
| title_too_long | `the title is over 120 characters` |
| fallback | `its settings weren't valid` |

`{column}` is named only when it matches `^[\w .-]{1,64}$`, shown truncated at 40.

## Task Commits

1. **Task 1 RED** — `b6a896f65` test(273-01): failing tests for the closed vocabulary
2. **Task 1 GREEN** — `742fd1677` feat(273-01): vocabulary + wire fixture + 273-BASELINES.md
3. **Task 2 RED** — `2255d51b1` test(273-01): failing tests for migration 202 shape and db helpers
4. **Task 2 GREEN** — `bb30e184f` feat(273-01): migration 202, supplement, db/artifacts.py, ToolContext field
5. **Task 3** — `db7ccf481` fix(273-01): service_role revoke + local apply evidence

## Migration 202 — who applied it, and the evidence

**Applied by Claude** to the live LOCAL DB (`127.0.0.1:54322`, probed open), via asyncpg from a
scratchpad script (the direct-SQL equivalent of the SQL editor), **twice** (idempotent). Never
`db push` / `db reset`. Verbatim rows are in `273-BASELINES.md` §Migration 202; in short:

- **VERIFY: 12/12 PASS** (RLS on, one SELECT policy, anon no SELECT, authenticated SELECT-only,
  service_role no UPDATE, both triggers present, exemption in the function body, anon cannot exec it).
- **RLS:** anon → `permission denied`; user A → 1 row; user B → 0 rows (fixture and A's whole
  thread); user A UPDATE / DELETE / INSERT → `permission denied`; `UPDATE spec` as postgres → raises.
- **FK upkeep:** thread delete over root+child with `run_id` set → SUCCEEDED, 0 rows left; direct
  `runs` delete → SUCCEEDED, `run_id` NULL on both, spec/label/caption unchanged; `SET spec`,
  `SET run_id = gen_random_uuid()`, NULL→value `SET run_id` (to a run that EXISTS), `SET label`,
  NULL→value `SET parent_id` → all raise; `SET parent_id = NULL` by hand → allowed (the accepted width).
- **db/artifacts.py driven live:** five concurrent inserts → `chart 1..3`, `table 1..2`, no
  duplicates; org stamped by the trigger when omitted; returned keys == `ARTIFACT_RECORD_KEYS`;
  `Chart 2` resolves by label; another user resolves nothing in the same thread.

All proof rows were inserted in transactions that were rolled back, or in a scratch thread that was
then deleted. `message_artifacts` holds 0 rows afterwards.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] service_role kept UPDATE on message_artifacts**
- **Found during:** Task 3 (the first live VERIFY: `*** FAIL *** service_role cannot UPDATE`)
- **Issue:** Supabase's default privileges grant `service_role` ALL on every new public table. The
  migration's `GRANT SELECT, INSERT, DELETE … TO service_role` adds and removes nothing, so D-08's
  "no UPDATE to any role" was false while every statement — and the shape test — read correctly.
  A TEXT shape test cannot see a default privilege; only the live probe could.
- **Fix:** `REVOKE ALL ON TABLE public.message_artifacts FROM service_role;` before the grant, mirrored
  in the supplement, pinned by `test_service_role_default_all_is_revoked_before_its_grant`; re-applied twice.
  The new test was driven RED against the pre-fix migration text (`git show bb30e184f:…`):
  `RED on pre-fix text: REVOKE ALL ON TABLE public.message_artifacts FROM service_role`.
- **Files:** `supabase/migrations/202_message_artifacts.sql`, `scripts/full-schema-supplement.sql`, `test_273_migration_202_shape.py`
- **Commit:** `db7ccf481`

**2. [Rule 1 - Bug, own test] function grants tripped the table-grant parser**
- The shape test's grant filter matched `GRANT EXECUTE ON FUNCTION public.message_artifacts_immutable()`;
  narrowed to `ON TABLE public.message_artifacts`. Committed in `bb30e184f`.

**3. [Rule 2 - Missing critical] trigger-function EXECUTE revoked and mirrored**
- The plan named `REVOKE EXECUTE … FROM PUBLIC` only. anon/authenticated were revoked too (the
  migration-181 Group A shape — anon inherits from PUBLIC and Supabase grants it directly), and the
  four lines were mirrored in supplement §6b because `check-schema-acl-parity.cjs` fails on an
  unmirrored function ACL.

**4. [Discretion] small choices, recorded so they are not mistaken for the plan**
- Label ordinal is `MAX(split_part(label,' ',2)::int)+1`, not `count(*)+1` — equal today (rows are only
  removed by cascades), robust if that ever changes.
- `get_artifact_by_ref` lower-cases and strips the ref, so `Chart 2` and an upper-cased id resolve.
- `ChartEnc.kind` and `component` are lower-cased before validation (`Bar` validates).
- A string column accepts a JSON number and stores it as text (`2024` → `"2024"`); a bool cell is
  refused in any column (pydantic would otherwise lax-coerce `true` to `1.0`).

## CHECKPOINT — owed to the operator: regenerate `supabase/full-schema.sql`

`bash scripts/regenerate-full-schema.sh` (no `--reset`) could not run from this agent: it needs
`docker exec … pg_dump`, and Docker is permission-denied for agents here (no local `pg_dump`/`psql`).
In the worktree its `supabase status` pre-check also fails, because there is no
`supabase/config.toml` and the CLI derives the project id from the directory name. **Run it from the
MAIN checkout AFTER this branch merges** — the supplement lines it appends are on this branch, so a
regeneration before the merge appends the OLD supplement. Then expect
`grep -c message_artifacts supabase/full-schema.sql` ≥ 5 and
`node scripts/check-schema-acl-parity.cjs` to stop reporting the artifact-tail divergence.
No unrelated full-schema drift can be named, because no dump was taken.

## OWED — production

Migration 202 to production **BEFORE** the backend that writes `message_artifacts` deploys, then
`get_advisors(security)`. Production is untouched. A deploy-parity item, not this phase.

## Verification

- `pytest tests/unit/test_273_artifact_models.py test_273_migration_202_shape.py test_273_db_artifacts.py test_tool_dispatcher.py` → **144 passed**
- Suites that inspect `ToolContext` fields (272 ×4, 264, harness whitelist, 099) → **149 passed**
- `node scripts/check-hot-file-ledger.cjs .planning/phases/273-agent-authored-artifacts` → `ledger gate OK`
- Backend unit gate at plan head (`db7ccf481`), verbatim:
  `71 failed, 6585 passed, 1 skipped, 2 xfailed, 2 xpassed, 45 warnings in 354.34s (0:05:54)` /
  `[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).` — the failed SET is
  **identical** to PHASE_BASE's (diffed); passed `6474 → 6585` = `+111`, exactly this plan's three new
  test files (65 + 19 + 27).

## Known Stubs

None. `turn_tool_calls` is `None` on every caller until 273-04 wires it — by design (the caption then
reads "values provided by the agent"), documented on the field.

## Notes

- `graphify update .` was NOT run in the worktree: `graphify-out/` is tracked and already modified in
  the main checkout, so updating it here would manufacture a merge conflict. Run it after the wave merges.

## TDD Gate Compliance

RED `b6a896f65` → GREEN `742fd1677` (Task 1); RED `2255d51b1` → GREEN `bb30e184f` (Task 2). Both RED
runs failed at collection on the missing modules.

## Self-Check: PASSED

All 8 created files present; commits `b6a896f65`, `742fd1677`, `2255d51b1`, `bb30e184f`, `db7ccf481`
present in `git log`. STATE.md / ROADMAP.md not touched.
