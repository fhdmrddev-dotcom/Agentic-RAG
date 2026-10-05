---
phase: 268-expert-spend-mid-thread-scope
plan: 01
subsystem: metering / run lifecycle
tags: [METER-08, SEED-314, SEED-297, runs, attribution, org-stamp, migration-197]
requires:
  - "Phase 264 ThreadScoping.born_for_bundle_id (access-checked Expert id)"
  - "Phase 256 D-256-06 token semantics (NULL = never measured)"
provides:
  - "runs.expert_id (no FK) + runs.expert_attributed (default false, never backfilled)"
  - "insert_run(org_id, expert_id) with an in-SQL sub-agent parent copy"
  - "insert_assistant_message(org_id); register_run_start forwards org_id/expert_id"
  - "send_message resolve-once (Option A): the row's Expert and the run's scope are one object"
  - "explicit active-org stamps on thread, user/assistant/system/cap-carrier messages"
  - "Deep Continue accumulates tokens across segments"
  - "AST disposition fence over every insert_run( call site"
affects:
  - "268-02 (spend roll-up reads expert_id / expert_attributed / org_id)"
  - "268-04 (live proof, registers)"
tech-stack:
  added: []
  patterns:
    - "INSERT ... SELECT ... FROM (SELECT 1) one LEFT JOIN parent — copy-from-parent inside the one writer"
    - "resolve once, carry the object (and the error) to the detached producer"
key-files:
  created:
    - supabase/migrations/197_runs_expert_attribution.sql
    - backend/tests/unit/test_268_insert_run_stamp.py
    - backend/tests/unit/test_268_insert_run_sites.py
    - backend/tests/unit/test_268_send_path_stamp.py
    - backend/tests/unit/test_268_continuation_tokens.py
    - backend/tests/integration/test_268_two_org_rows.py
    - .planning/phases/268-expert-spend-mid-thread-scope/268-BASELINES.md
  modified:
    - backend/app/db/runs.py
    - backend/app/services/run_lifecycle.py
    - backend/app/api/threads.py
    - backend/app/services/run_producer.py
    - backend/app/services/agent_loop.py
    - supabase/full-schema.sql
    - backend/tests/unit/test_085_todos_service.py
    - backend/tests/unit/test_256_finish_run_unchanged.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "expert_id read via getattr(_scoping, 'born_for_bundle_id', None) in send_message — no ternary branch added to the send path"
  - "Continue prior-token read is best-effort: a failed read logs a warning and leaves base behaviour; it never fails the continuation"
  - "ExpertScopeUnavailable is not imported into threads.py (the carried exception object is enough; an unused import was avoided)"
metrics:
  duration: "~2h"
  completed: 2026-09-28
  tasks: 4
  commits: 8
---

# Phase 268 Plan 01: Expert + org attribution at the one run INSERT — Summary

**Every `runs` row born from 268 on carries `expert_attributed = true` (set in SQL), the access-checked Expert
for its turn, and the validated active org; sub-agents copy all three from their parent inside the same
`INSERT … SELECT`; every message a two-org user's turn writes lands in the active org; and a Deep Continue
now sums its segments' tokens instead of erasing the paused one.**

PHASE_BASE: `220c82dde25345ab776133748f0275ed16c59e06`.

## What was built

| Task | Commit(s) | What |
|---|---|---|
| 1 (0) | `564989c11` | `268-BASELINES.md` frozen BEFORE any source edit (backend failed SET, vitest verdict, tsc set, Wave-0 DB reads) |
| 1 | `277fa2093` test → `afce028e3` feat | migration 197; `insert_run` / `insert_assistant_message` / `register_run_start`; disposition fence; db/runs.py ledger section + CLAUDE.md row in the same commit as the first `db/runs.py` edit |
| 2 | `caf586242` test → `ca09b6b49` feat | send-path resolve-once, `run_producer(scoping=, scoping_error=)`, org stamps (thread, user msg, agent_loop ×3 + 1 kwarg), Continue accumulation |
| 3 | `62721aea2` | migration 197 applied to the LIVE LOCAL DB (Claude, direct asyncpg execution) + `full-schema.sql` regenerated without `--reset` |
| 4 | `283e1efe6` test, `c0c5e656a` test | real-PG two-org integration fence; two pre-existing fences re-pinned (see Deviations) |

## RED outputs (quoted, captured at base before any implementation)

Task 1 (`test_268_insert_run_stamp.py`, `test_268_insert_run_sites.py`):
```
E       TypeError: insert_run() got an unexpected keyword argument 'org_id'
E       TypeError: insert_assistant_message() got an unexpected keyword argument 'org_id'
E       TypeError: register_run_start() got an unexpected keyword argument 'org_id'
E       AssertionError: services/run_lifecycle.py:1 is STAMP but passes ['model', 'parent_run_id', 'provider', 'run_id', 'spawned_by_worker', 'status', 'thread_id', 'user_id']
```
Task 2 (`test_268_send_path_stamp.py`, `test_268_continuation_tokens.py`):
```
E       assert 0 == 1            (resolve.await_count — send_message never resolved the Expert)
E       KeyError: 'scoping'      /  KeyError: 'expert_id'  /  KeyError: 'org_id'
E       TypeError: run_producer() got an unexpected keyword argument 'scoping'
E       TypeError: run_producer() got an unexpected keyword argument 'scoping_error'
E       assert (30, 10) == (130, 50)     ← base finalized ONLY the continuation's 30 / 10 (paused 100 / 40 erased)
E       assert (30, None) == (30, 0)
E       AttributeError: module 'app.services.run_producer' has no attribute '_accumulate_segment_tokens'
```
Whole RED run: `21 failed, 7 passed`. The 7 that passed at base are guards whose base behaviour IS the
contract (the call-site SET, the alias site, the two in-memory plants, "no header → no org key" on
create_thread, "producer still resolves when not handed scoping", "NULL+NULL stays NULL") — not new
behaviour, so they are not a fail-fast violation.

GREEN: all 4 files + `test_264_born_for_carrier.py`, `test_chat_active_org.py`, `test_267_expert_changed_event.py`,
`test_260_expert_chat_scoping.py`, `test_256_producer_shells.py`, `test_256_producer_shell_site3.py`,
`test_075_4_iteration_cap_drop.py`, `tests/test_continue.py` → **139 passed**.

## Plant outputs

**Disposition fence** — a real fourth `await insert_run(` appended to `backend/app/api/evals.py`:
```
E       AssertionError: the `insert_run(` call-site SET changed.
E           appeared (needs a disposition): ['api/evals.py:4']
E           vanished: []
```
reverted with `git checkout -- app/api/evals.py`; `git diff --quiet HEAD -- backend/app/api/evals.py` held.
The fence also carries two in-memory plant tests (plain and function-local-aliased) that stay in the suite.

**Two-org integration** — `register_run_start`'s forward planted as `org_id=None`:
```
E       AssertionError: run landed in 1bda8f5b-…, expected B (trigger's A = 1bda8f5b-…)
1 failed, 4 passed
```
reverted; `git diff --quiet HEAD -- backend/app/services/run_lifecycle.py` held.

## Task 3 — migration 197 on the live local DB (verify queries, quoted)

Applied by **Claude, direct SQL execution** of the migration file through the backend venv's asyncpg against
`127.0.0.1:54322` (never `supabase db push` / `db reset`). Re-applied once more to prove idempotency (no error).

```
columns: [('expert_attributed', 'NO', 'false', 'boolean'), ('expert_id', 'YES', None, 'uuid')]
policies: [('runs_select_own', b'r')]          ← exactly one policy, polcmd 'r' = SELECT, no new policy
rls: [(True,)]                                  ← relrowsecurity true
fk_on_expert_id: [(0,)]                         ← no foreign key (D-268-04)
pre-268 rows attributed: [(False, 1634)]        ← every existing row reads "Not recorded", no backfill
```

`bash scripts/regenerate-full-schema.sh` (no `--reset`) ran successfully. ⚠ It needed
`SUPABASE_PROJECT_ID=Agentic_RAG` in the environment: the Supabase CLI derives the project id from the
directory name when there is no `config.toml`, so from a worktree it looked for
`supabase_db_agent-a1a2050631b962bff` and reported "Supabase is not running locally". With the override it
dumped `supabase_db_Agentic_RAG`. `git diff --stat supabase/full-schema.sql` → **+16 lines, 0 deletions**: the
two columns and their two `COMMENT ON COLUMN` blocks, **no unrelated drift**. `grep -c expert_attributed
supabase/full-schema.sql` → 4.

## agent_loop hunk review — 4 org stamps + 1 kwarg, 0 new branches

```
+    org_id: str | None = None,                                        ← persist_cap_paused kwarg (+ docstring)
+                **({"org_id": org_id} if org_id else {}),            ← stamp 1: cap-paused carrier
+                org_id=current_user.get("org_id"),                   ← stamp 2: insert_assistant_message
+                        **({"org_id": current_user["org_id"]} if current_user.get("org_id") else {}),  ← stamp 3: system warnings
+                    org_id=current_user.get("org_id"),  # …          ← stamp 4: the one persist_cap_paused call
```
No `if`/`else` block added (the two conditionals are dict-merge expressions); no identifier containing
`expert` (the 264/260 AST fence `test_agent_loop_closed_core_invariant_still_green_after_the_carrier` is green).

## Acceptance checks

- `grep -c "REFERENCES" 197_…sql` → 0 · `grep -c "expert_attributed boolean NOT NULL DEFAULT false"` → 1 · no `UPDATE public.runs`.
- `grep -n "LEFT JOIN public.runs p" backend/app/db/runs.py` → 1; `git diff 220c82dde -- backend/app/db/runs.py`
  has no hunk inside `finalize_run` (hunks at the docblock, `insert_run`, `insert_assistant_message` only).
- `grep -c "_resolve_thread_scoping(" backend/app/api/threads.py` → 1, inside `if _kickoff_definition is None:`.
- `scoping_error` raise sits inside the Deep branch of the producer's existing middle `try` (`run_producer.py:720-721`).
- `test_264_born_for_carrier.py` unchanged and green — still exactly 2 `born_for_bundle_id=` keywords in `run_producer.py`.
- `node scripts/check-claude-md-size.cjs` → exit 0 (117,630 chars — ⚠ inside 2.4k of the 120k WARN band).
- `node scripts/check-hot-file-ledger.cjs 268` → `ledger gate OK — every watched file has a row.`
- `git diff 220c82dde -- backend/app/services/retrieval_service.py` → empty (D-268-14: G-5 not fired, SEED-224 stays owed).
- `test_db_runs.py`'s three inherited reds: **all three still red, same names** (`test_insert_run_passes_args_positionally`,
  `test_insert_assistant_message_sql_shape`, `test_insert_assistant_message_optional_fields_none`) — no 4th.

## Backend gate (full, end of Task 4)

```
71 failed, 5867 passed, 1 skipped, 2 xfailed, 2 xpassed, 46 warnings in 288.21s (0:04:48)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```
Failed SET diffed against `268-BASELINES.md`: **NEW = [] · GONE = []** — identical. (The first full run read 73:
the two extras are the two re-pinned fences below, both classified as caused by this plan and fixed.)

Integration: `pytest tests/integration/test_268_two_org_rows.py -rs` → **5 passed**, 0 skipped.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Two existing fences went red because they pinned a position this plan legitimately moved**
- **Found during:** Task 4 full backend gate (73 failed).
- `tests/unit/test_085_todos_service.py::test_insert_run_accepts_parent_run_id_kwarg` read `args[-1]` as "the 8th
  bound value"; `insert_run` now binds `org_id`/`expert_id` after it. Re-addressed as `args[8]` (the property its
  own comment states).
- `tests/unit/test_256_finish_run_unchanged.py::test_the_finish_run_call_site_set_is_unchanged`: the
  `run_lifecycle.py` `finish_run` call moved 521 → 529 (+8 lines of kwargs/docstring above it). Its per-file COUNT
  check stayed green; re-derived with grep and re-pinned beside the old value, as the fence's own procedure asks.
- **Commit:** `c0c5e656a`.

**2. [Rule 3 - Blocking] Disposition fence could not parse a BOM file**
- `services/email_extraction_service.py` starts with U+FEFF; `ast.parse` rejected it. The fence reads with
  `utf-8-sig`. Fixed before the RED commit.

**3. [Rule 3 - Blocking] `regenerate-full-schema.sh` could not find the stack from a worktree**
- Ran with `SUPABASE_PROJECT_ID=Agentic_RAG` (see Task 3). Script unmodified.

**4. [Correction of the executor's own claim] The `::uuid`/`::text` casts in `insert_run`'s select list**
- First written into the ledger as load-bearing ("Postgres resolves an untyped select-list param as text");
  MEASURED on a temp table before commit and found FALSE (`INSERT … SELECT $1, $2` into uuid/text columns → OK).
  The ledger now says the casts are belt-and-braces, so nobody treats them as preventing an error.

**5. [Transcription fix] `268-BASELINES.md` failed-SET entry**
- One id had a stderr warning glued to it (`…test_returns_avg_similarity_as_second_valueC:\Vibe`); corrected to the
  real node id in the SUMMARY commit. The SET is unchanged (71 ids).

### Plan-shape notes
- `ExpertScopeUnavailable` was not late-imported into `threads.py` as the plan text suggested — the carried
  exception object is all the send path needs, and the import would have been unused.
- `expert_id=getattr(_scoping, "born_for_bundle_id", None)` instead of the plan's ternary — same value, no branch.

## Baselines (inherited reds, not this plan's)

- **Vitest gate RED AT BASE** (`failed 2`, `src/components/library/__tests__/sketchComposition.test.tsx` — a
  `STACK_TRACE_ERROR` then "Found multiple elements with the role tab"). Measured before any edit; this plan touches
  no frontend file. Not re-run for a green.
- tsc app config: 70 errors at base (set in `268-BASELINES.md`); no frontend change here.

## Wave-0 measurements (for 268-02)

150 placeholder (`model='unknown'`) roots; **99 tokened sub-agent rows under them** (D-268-21's double-count risk is
real on this DB); 0 sub-agent org mismatches; 2 continued runs; 1634 runs total.

## Known edge cases (recorded, per D-268-22 / D-268-23)

- A two-org user sending in a thread from org A with active org B writes the new turn's rows in B while older rows
  stay in A (the split transcript) — accepted by D-268-22.
- The Continue prior-token read is best-effort; if it fails, a warning is logged and the continuation's totals
  replace the paused segment's (the pre-268 behaviour). Not silent: `continuation %s: prior token read failed`.
- A run paused under Expert X and continued after a swap to Y keeps `expert_id = X` (the row is not re-stamped) —
  D-268-23's rule.

## Owed / not done here

- `graphify update .` was NOT run in the worktree: `graphify-out/` is dirty in the main tree and a worktree regen
  would produce a merge conflict. Owed to the orchestrator after merge.
- Production: migration 197 must be applied to cloud Supabase before a backend on this code deploys (every chat
  send now inserts the two columns). D-268-18: add it to the deploy checklist with `get_advisors(security)`.

## Threat Flags

None — no new endpoint, auth path or trust-boundary surface; every threat-register `mitigate` row (T-268-01..05,
T-268-08) is implemented and tested as described above.

## Self-Check: PASSED

- Files: 197 migration, 5 test files, 268-BASELINES.md, full-schema.sql all present.
- Commits: 564989c11, 277fa2093, afce028e3, caf586242, ca09b6b49, 62721aea2, 283e1efe6, c0c5e656a all in `git log`.
