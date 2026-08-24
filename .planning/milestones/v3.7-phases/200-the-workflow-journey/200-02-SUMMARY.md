---
phase: 200
plan: 02
subsystem: backend-wire
tags: [migration, workflow-phases, timings, step-counts, transports, des-02]
status: COMPLETE
completed_tasks: 4
total_tasks: 4
requires:
  - "200-01 (the acceptance checklist and this phase's re-derived baselines)"
provides:
  - "supabase/migrations/121_workflow_phases_timings.sql — two nullable timestamptz columns, applied to the live local DB"
  - "workflow_phases.started_at / completed_at written at all SEVEN status-write sites"
  - "the executor-DECLARED per-step count (`_measure`) across the SEVEN phase types — three declare, four stay silent"
  - "all FOUR transports widened: two SSE frames + GET /threads/{id}/workflow + GET /workflow-runs/{id}"
  - "declared_phase_measure — the ONE home for the read side (models/thread.py)"
  - "backend/app/api/workflow_runs.py's hot-file-ledger row + section (D-16)"
affects:
  - "200-07 (the run surface renders the per-step duration and the count this plan puts on the wire)"
  - "200-04 / 200-05 (the step panel and the spine read the same widened wire)"
  - "any future workflow_phases migration — SEED-143 is declined here with a named trigger"
tech-stack:
  added: []
  patterns:
    - "no-backfill migration whose absence-of-backfill is asserted as a NEGATIVE control"
    - "a declared measure riding an existing jsonb column — no column, no migration"
    - "0-vs-null kept structurally distinct end to end, from executor to TypeScript type"
    - "a test double that PROJECTS like PostgREST, so a forgotten .select() goes red"
key-files:
  created:
    - supabase/migrations/121_workflow_phases_timings.sql
    - backend/tests/test_migration_121.py
    - backend/tests/test_200_phase_counts.py
  modified:
    - supabase/full-schema.sql
    - backend/app/db/workflows.py
    - backend/app/services/harness/phase_types.py
    - backend/app/services/harness_engine.py
    - backend/app/api/workflow_runs.py
    - backend/app/api/threads.py
    - backend/app/models/thread.py
    - backend/tests/test_188_workflow_run_read.py
    - backend/tests/test_workflow_phase_cancel.py
    - frontend/src/lib/api.ts
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
decisions:
  - "SEED-143 (a CHECK constraining workflow_phases.slug) DECLINED in migration 121, re-open trigger recorded in the migration header: the next phase that opens a workflow_phases migration for another reason"
  - "THREE phase types declare a count, FOUR stay silent — per 200-CHECKLIST.md §5.1, which is authoritative over the plan's own inconsistent 4/3 prose"
  - "declared_phase_measure is sited in models/thread.py — the one module both wire models already import; phase_types.py (the write side) pulls provider services in at import time and is unreachable from the API layer"
  - "mark_phase_active / complete_phase now RETURNING their timestamp, so SSE frames carry the value the row carries rather than a Python-side now()"
  - "test_workflow_phase_cancel.py's forbidden-slug backstop narrowed from a bare substring to the QUOTED form — a status slug is always a SQL string literal, and `completed_at` is a column"
metrics:
  duration: ~3h20m (including the blocking operator checkpoint)
  tasks: 4
  commits: 5
  files_created: 3
  source_files_modified: 9
  completed: 2026-08-19
---

# Phase 200 Plan 02: The Measurable Wire Summary

**A per-step duration and a per-step count are on the wire for the first time — written at all
seven phase-status sites, declared by three of seven phase types, and carried by all four
transports so the run page and the chat panel cannot disagree.**

## Base SHA

⚠ **The worktree forked from the WRONG base and the assertion caught it — the SECOND consecutive
wave in which this fired.**

| | SHA |
|---|---|
| worktree's actual fork point | `3781a3fe4690a9619e619f4cc412bd37a7dafc52` |
| **dispatched base (reset to)** | **`ca3cc0862210b66b4cb2b111917a3946fbd37b4c`** |

The plan's `<execution_context>` cites `fe40ce1c` as the planning SHA; per the dispatch that is a
known stale pointer. `bash scripts/bootstrap-worktree.sh` ran second → `BOOTSTRAP OK`.

## Commits

| # | Hash | What |
|---|---|---|
| 1 | `a5d59def` | migration 121 + its live-DB gate |
| 2 | `7bbc7ae6` | the checkpoint-halt record (superseded by this document) |
| 3 | `8cd58619` | `full-schema.sql` regenerated after the operator applied 121 |
| 4 | `b41bf638` | seven write sites + the declared per-step count |
| 5 | `42050e9d` | all four transports + the D-16 ledger row **and** section |

## Task 1 — migration 121 and its live-DB gate

Two nullable `timestamptz` columns on `public.workflow_phases`, `BEGIN`/`COMMIT`-wrapped,
`ADD COLUMN IF NOT EXISTS`, each with a `COMMENT ON COLUMN`.

**Why they were owed, re-measured rather than inherited:** `create_workflow_run` batch-INSERTs
every phase row of a run in ONE transaction (`db/workflows.py:334`), so `created_at` is the moment
the RUN was created — identical across all of a run's phases. And all seven status writers
overwrite `updated_at=now()` on every transition. **A per-step duration was genuinely underivable.**

The header records eight things with their reasons, the load-bearing ones being: **NO BACKFILL**
(D-06) and why (`updated_at` is roughly right for a phase whose last transition was terminal and
silently WRONG for one retried/resumed/cancelled — **and nothing on the row would say which**); **no
column default**, because a `default now()` backfills at ALTER time and *a backfill by accident is
still a backfill*; **both nullable**, which is itself part of the proof; **no RLS work is owed**,
because `058:38-77`'s four policies share one predicate and **not one names a column list**; and
**SEED-143 DECLINED** with a named re-open trigger.

`backend/tests/test_migration_121.py` — four cases, every write inside a **rolled-back** transaction,
the applied-check reading `information_schema.columns` and **never probing with an INSERT**.

⚠ **The no-backfill negative control has TWO arms because either alone is weaker than it looks.**
Arm (a) INSERTs a row naming neither column and asserts both come back NULL — that catches a default
or a helpful trigger. Arm (b) reads the operator's **real pre-existing rows** read-only and asserts
zero carry either timestamp — **that catches a one-shot `UPDATE ... SET started_at = updated_at` in
the migration body, which arm (a) could not see at all.**

## Task 2 — the blocking operator gate ✅ discharged

**The gate halted as designed; it was not simulated, skipped or self-approved.** The orchestrator
returned with the operator's authorisation and the applied result.

⚠ **HOW IT WAS APPLIED, STATED PLAINLY RATHER THAN IMPLIED: not via the Studio SQL editor.** The
file's **entire contents were executed verbatim over a direct psycopg2 connection** to the same live
local Postgres (`127.0.0.1:54322`) with autocommit on, so the file's own `BEGIN`/`COMMIT` governed
the transaction. Same database, same statements, same semantics. ⚠ **`supabase db push` and
`supabase db reset` were NOT used** — CLAUDE.md forbids both and they are what would have destroyed
the operator's dev data.

**Measured, not asserted:**

| | |
|---|---|
| pre-state | 9 columns, neither new column present, **570 existing rows** |
| post-state | both `timestamp with time zone`, `is_nullable=YES`, **`column_default=None`** |
| no-backfill | **570 rows · 0 with `started_at` · 0 with `completed_at`** |
| data preserved | `workflow_runs` still 228 rows |
| RLS | still exactly 4 policies on `workflow_phases` |

Both `column_default=None` readings matter as much as the existence check: they are the proof that
no `default now()` crept in and backfilled 570 rows at ALTER time.

**RED→GREEN OBSERVED, and re-confirmed independently in this worktree rather than taken on trust:**
`tests/test_migration_121.py` → **4 skipped** before, **4 passed** after. ⚠ Which skip fired was the
useful detail throughout: SKIP-1 (`:54322` unreachable) never fired, so the DB was up the whole time.

`full-schema.sql` regenerated with **no `--reset`**, diff `16 insertions / 0 deletions` — the two
column declarations and their two `COMMENT ON` statements. Both emit with **no `DEFAULT` and no
`NOT NULL`**, so the no-backfill property is visible in the deploy artifact itself.
`check-deploy-drift.sh` → **PASS, exit 0** (two pre-existing WARNs, neither about 121).

⚠ **A WORKTREE LIMITATION WORTH NOT REDISCOVERING, recorded because it will bite the next
migration-bearing plan:** `bash scripts/regenerate-full-schema.sh` **fails from inside a worktree**.
`supabase status` cannot see the linked project there — `.supabase/` is gitignored, so it does not
exist in a worktree — and the script exits with *"Supabase is not running locally"* **even though it
is**. The artifact was regenerated from the main working tree and copied in, with the main tree
reverted so the file has exactly one home: this plan's commit.

## Task 3 — seven write sites and the declared count

### A — the seven timestamp write sites

All seven line numbers were re-derived and were **exact** at this base.

| # | Function | line | writes |
|---|---|---|---|
| 1 | `mark_phase_active` | 1441 | `started_at` — **the only site** |
| 2 | `complete_phase` | 1483 | `completed_at` |
| 3 | `fail_phase` | 1505 | `completed_at` |
| 4 | `skip_phase` | 1517 | ⚠ **NEITHER — deliberate** |
| 5 | `record_phase_not_sent` | 1548 | `completed_at` |
| 6 | `cancel_phase` | 1597 | `completed_at` |
| 7 | **`cancel_active_phases`** | **1649** | `completed_at` |

**Site 7 is the one CONTEXT's six-item enumeration omits** — the run-keyed arm Phase 194 built for a
Stop landing with no producer running. Its `AND status = 'active'` predicate means it only ever
moves rows that already carry a `started_at`, and it stays on ONE source line (193.2-08's lesson).
The predicate was **not** widened; it is the only thing between that statement and a bulk terminalize.

⚠ **`skip_phase` writes neither, and its docstring now says why**: a skipped phase never ran, so both
columns stay NULL and the row reads *never ran* — structurally distinct from *time not recorded*.

⚠ **A HAZARD FOUND BY READING, WHICH DICTATED THE EDIT'S SHAPE.** Seven existing tests match these
statements by **substring prefix** (`test_096_ci_workflow_regression.py:253,255`;
`test_harness_engine.py:455,814,2027,2237`; `test_harness_gates.py:383`). The new column assignment
is therefore **appended after `updated_at=now()`**, never inserted between `SET` and the status
literal. The batch INSERT at `:334` learns neither column — `started_at` is precisely the thing
`created_at` cannot be.

`mark_phase_active` and `complete_phase` now return their timestamp via `RETURNING` + `fetchval`, so
the SSE frames carry **what the row carries**. ⚠ `RETURNING` **composes with** `complete_phase`'s
`IS DISTINCT FROM 'cancelled'` fence rather than weakening it: when the fence refuses the write, no
row returns, so the value is `None` and no completion time is announced for a step that was never
completed. The guard and the return value agree by construction.

### B — the declared count, across SEVEN phase types

**SEVEN, not eight** — `PHASE_TYPE_REGISTRY_ENTRIES` has seven keys and `llm_judge_rubric` is a
`ValidatorSpec.kind` (checklist X-2), pinned by a case so the claim cannot drift back.

| type | declares | noun |
|---|---|---|
| `llm_agent` | `len(source_refs)` | **`sources`** |
| `llm_batch_agents` | `len(sub_run_ids)` | **`agents`** |
| `llm_emit` | `len(field_map)` | **`fields`** |
| `programmatic` · `llm_single` · `llm_human_input` · `external_action` | — | **no key at all** |

The declaration rides in the existing `output` jsonb as `_measure` — no column, no migration.
Each noun is spelled at **exactly one** executor site, swept by a case.

⚠ **`programmatic` abstains on purpose and that is the abstention most likely to be "fixed" later**:
`split_topic` returns a real 2-element list, so a structural "count whichever key is a list" would
emit `{"count": 2}` and pass everything else in the file. The test says so in its docstring.
⚠ **`_exec_llm_emit` has exactly ONE success return** (measured — every other exit routes through
`_emit_failure_output` / `_emit_unexpected_failure`), so `fields` has exactly one home.

### `backend/tests/test_200_phase_counts.py` — 11 cases, all seven types driven for real

⚠ **BOTH CRITICAL FENCES WERE PLANTED, NOT READ.** This repo's repeated finding is that fences are
caught inert by planting and never by reading:

| Plant | Result |
|---|---|
| suppress falsy counts in `_measure` | **2 RED** — both zero cases, exactly the right ones |
| change a noun (`sources`→`srcs`) | **3 RED** — incl. the one-home sweep |

Both reverted; 11 passed after.

## Task 4 — all four transports, the blind fake, and the D-16 row

| # | Transport | Site |
|---|---|---|
| 1 | SSE `phase_started` | `harness_engine.py:1626` → `started_at` |
| 2 | SSE `phase_completed` | `harness_engine.py:2005` → `completed_at` + `step_count`/`step_noun` |
| 3 | `GET /threads/{id}/workflow` | raw SQL + `WorkflowPhaseState` |
| 4 | `GET /workflow-runs/{id}` | `.select()` + `WorkflowRunPhaseRead` + serializer |

**Transport 3 is the one CONTEXT does not name**, and it is a SECOND, INDEPENDENT wire model for the
SAME rows feeding the chat panel. Widening only `WorkflowRunPhaseRead` would have shipped **a run
page with durations and a chat panel without them**.

**Fetch stays authoritative** (D-v2.5-03) — a terminal run has no stream, so the panel's reconcile
floor cannot depend on a frame. What the frames buy is the anchor *at the instant a step starts*, so
a live tick needs no polling. Both stay WRITE-before-EMIT.

⚠ **THE THREE-PLACE LOCKSTEP.** The route declares `response_model=WorkflowRunRead`, which **drops
undeclared keys silently** — 192.2 measured exactly that on `api/workflows.py`. Only one of the three
places (the `.select()` string) is invisible to every type checker, which is what the new
`test_a_forgotten_projection_is_now_detectable` covers.

⚠ **`output` IS SELECTED BUT IS NEVER A WIRE FIELD.** It carries prompts, citations and field maps.
The serializer extracts only `_measure.count` / `_measure.noun`; no model declares `output`; a
sentinel string planted in every phase's output is searched for in the response **bytes**. This
resolves RESEARCH's open question **A7** with no second migration. A `.select("*")` was rejected in a
comment at the site — it would also "work" and would weaken the read.

**V4 access control is unchanged**: the new columns join a query already scoped by
`.eq("workflow_run_id", run["id"])` where `run` came from the ownership select. No second query, no
new dependency, no changed 404 body. Tests 1, 2 and 6 re-ran unchanged.

### ⚠ The blind test fake — and the counterfactual was DRIVEN, not assumed

`_FakeQuery.select` read `def select(self, *_columns, **_kwargs): return self` — **a no-op that
discarded its column list**, the opposite of PostgREST. It now records the columns and `execute()`
projects to them.

**The measurement that proves it mattered**, run in three steps rather than argued:

| Step | Result |
|---|---|
| narrow the handler's `.select()` to drop the timestamps, new fake | **2 RED** |
| same narrowed handler, **old no-op fake restored** | ⚠ **PASSED GREEN** |
| both reverted | 12 passed |

**A test that would still pass if you deleted the handler's `.select()` line is not testing the
projection** — and that was the shipped state.

### D-15 — proven by grep over the REAL diff, never by quoting the decision

```
git diff -U0 -- frontend/src/lib/api.ts | grep -E '^\+' \
  | grep -E '^\+\s*export\s+(const|function|class|let|var|enum)\b'
⇒ EMPTY
```

`api.ts` is **`+49 / −4`**, and **zero added lines contain the word `export` at all** — strictly
stronger than the required "no new runtime exports". **The 197 decline HOLDS and its re-open trigger
did not fire**; `196-08`'s mock-factory failure mode measurably cannot fire. The
`claimed_at is the ONLY honest elapsed anchor` docblock went stale **in this commit** and is
corrected **in it**, with the original preserved rather than deleted: it stays true of
`workflow_runs`, but `claimed_at` is null on **100% of completed runs** (149 rows, 0 with it), so the
honest span is now `min(started_at) → max(completed_at)` over the phase rows.

### D-16 — the ledger row and section, in the same commit

`git show --stat 42050e9d` carries `api/workflow_runs.py`, `CLAUDE.md` and
`docs/HOT-FILE-LEDGER.md` together.

Re-derived **forward** rather than born stale: **`4 commits / 4 phases / 330 L`** (buckets `188`,
`189`, `194.1`, `200`; no quick tasks to subtract). Wave 1's `3 / 3 / 260` was correct when measured
and stale the moment this plan touched the file. **G-5 FIRES; honoured by construction, no override
requested** — four optional fields on one existing model, three columns on one existing projection,
one loop in one existing serializer. **No next seam is proposed, and that is a verdict**: 330 lines
for one route, two thirds of it reasoning. The next phase adding a genuinely second concern owes a
refactor recommendation first.

⚠ Wave 1 found **four** files owing rows. This plan paid **one** and deliberately did not absorb
`FlowEdge.tsx` (→ `200-06`), `PhaseTimeline.tsx` or `phaseStatusMeta.ts` (→ `200-07`).

`node scripts/check-claude-md-size.cjs` → **84,619 chars · 56.4% of limit · exit 0**.

### One home for the read side

`declared_phase_measure` lives in `backend/app/models/thread.py`, imported by both wire models and
the engine. `isinstance(count, int)` rather than truthiness, with `bool` excluded explicitly (it is
an `int` subclass, so `{"count": true}` would serialize as `1`). Smoke-measured:
`{"count": 0}` → `(0, "sources")`, `{}` → `(None, None)`, `{"count": True}` → `(None, None)`.

## Deviations from Plan

**1. [Rule 3 — Blocking] The worktree forked from the wrong base.**
`git merge-base HEAD ca3cc086` returned `3781a3fe`. Reset and verified. Second consecutive wave.

**2. [Rule 3 — Blocking] Three SQL keywords lowercased in the migration's PROSE.**
The criteria are `grep -c 'DEFAULT'` → 0 and `grep -c 'NOT NULL'` → 0, but the header explains *why*
there is neither — so the explanation failed the fence it exists to justify. The prose now writes
`default` / `not null`. The SQL contains neither clause; the fence measures the SQL.

**3. [Rule 3 — Blocking] The phase-status CHECK is named only descriptively.**
The criterion demands **zero** occurrences of `workflow_phases_status_check` while the action text
asks the header to record that the constraint is untouched. The header states the fact, lists its
seven literals, and records **why the identifier is unspelled** — *a denial reads identically to a
use under a grep* (the 189-09 lesson, which `record_phase_not_sent`'s own docstring already applies).

**4. [Rule 1 — Bug] `test_workflow_phase_cancel.py`'s forbidden-slug backstop false-positived.**
It substring-matched `'completed'`, which the new **column** `completed_at` contains, so it fired on
`cancel_phase` for writing a column name while its only status literal was still `'cancelled'`.
Narrowed to the **quoted** form — a status slug is always a SQL string literal — with the original
quoted in the docstring. ⚠ **The narrowed fence was PLANTED before being kept**: with
`status='completed'` spliced into `cancel_phase`, it still goes RED. The precise first assertion (the
`status\s*=\s*'...'` regex) was untouched and remains the primary control.

**5. [Rule 2 — Missing guard] `phase_completed_at` bound before the branch.**
The completion frame sits in the `else` of a **second** `if/elif/else` whose conditions mirror the
write chain's. They agree today, but they are two chains — a later edit to either would make this an
`UnboundLocalError` at emit time on a path that used to work. Initialised to `None` first, which is
also the honest value on the two arms that skip `complete_phase`.

**6. [Deviation — plan-internal inconsistency resolved toward the CHECKLIST] THREE declaring types,
not four.** The plan's Task-3 prose says *"four asserting the declaring types"* and *"three asserting
no `_measure` key"*, and binding constraint 5 repeats *"three of the seven types must emit no key"*.
**Its own type table says the opposite** (3 declare / 4 silent), and `200-CHECKLIST.md` §5.1 — wave
1's acceptance bar, which I may not edit — is explicit: three nouns, and *"the remaining **four**
phase types declare NOTHING"*. **The CHECKLIST governs**, so the implementation is 3 declaring / 4
silent. The stricter reading is satisfied either way: **four** types are asserted to emit no key,
which exceeds the required three.

## Threat Flags

None. No new endpoint, no new auth path, no new file access. The one schema change at a trust
boundary is `workflow_phases`, and the migration header records the measured reason no RLS work is
owed (four policies, one predicate, no column list) — re-confirmed post-apply: **still exactly 4
policies**. The one new exposure question — the `output` jsonb — is dispositioned in
`<threat_model>` T-200-02-02 and enforced by `response_model`'s drop behaviour plus a sentinel-byte
test.

## Baselines — all re-measured, none inherited

| Gate | §6 baseline | Measured now | Verdict |
|---|---|---|---|
| backend `tests/unit` | 62 failed / 2350 passed | **62 failed / 2350 passed** | unmoved |
| wire slice (6 files) | 1 failed / 121 passed | **1 failed / 127 passed** | +6 = this plan's new cases |
| `tsc -p tsconfig.app.json` | 33 errors / 19 files | **33 / 19** | unmoved; none of this plan's files in the 19 |
| count gate | `4970 · failed 0 · 4543 · 96/96` | **`4970 · failed 0 · 4543 · 96/96`** | identical, first run at cap 2 |
| `check-claude-md-size.cjs` | — | 84,619 chars · exit 0 | clear |

⚠ **`test_thread_workflow_endpoint.py::test_thread_workflow_state_shape` IS STILL RED, AND ITS STATE
DID NOT CHANGE.** It was RED **before** this phase (§6.3), it is **in** the blast radius (it asserts
the very `ThreadWorkflowState` shape this plan widened), and it was **not touched**. The failure is
byte-identical: `assert body["locked"] is True` → `assert False is True`. It was not fixed silently
and it must not read as a regression.

The count gate never redded, so SEED-171's triage procedure was never entered — recorded as an
observation, **not** as proof of innocence.

## Self-Check

- `supabase/migrations/121_workflow_phases_timings.sql` — FOUND
- `backend/tests/test_migration_121.py` — FOUND
- `backend/tests/test_200_phase_counts.py` — FOUND
- commits `a5d59def` · `7bbc7ae6` · `8cd58619` · `b41bf638` · `42050e9d` — FOUND

## Self-Check: PASSED
