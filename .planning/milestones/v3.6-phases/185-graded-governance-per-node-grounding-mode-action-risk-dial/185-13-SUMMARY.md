---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 13
subsystem: backend/harness + db-schema
tags: [governance, audit-ledger, migration, bug-fix, structural-guard, action-risk, workflow-harness]

# Dependency graph
requires:
  - phase: 185-04
    provides: "the action-risk arming surface whose armed checkpoint this makes actually park"
  - phase: 185-05
    provides: "the action_risk_pending emit site at harness_engine.py:712-716 — introduced for honesty, never registered"
provides:
  - "supabase/migrations/114_harness_audit_action_risk_pending.sql — the CHECK extended to 23 literals (AUTHORED, applied by the operator in Task 3)"
  - "action_risk_pending registered in _AUDIT_EVENT_TYPES — the Python half of the two-layer fix"
  - "a derived (never hardcoded) kind count in write_audit's ValueError, so the message cannot go stale again"
  - "backend/tests/unit/test_audit_event_registration.py — G1 emitted-implies-registered + G2 Python-set == SQL-CHECK-set, both directions"
  - "an amended zero-migration contract carrying the date, the operator decision and the reason, with the superseded wording preserved"
affects: [188, workflow-run-surface, harness-audit-ledger, cloud-migration-parity]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "two-layer vocabulary registration: a Python allow-list and a Postgres CHECK pinned EQUAL by test, so neither can drift alone"
    - "derived counts over hardcoded ones in error messages (len(_AUDIT_EVENT_TYPES)) — the stale '22' is what made the original error misleading"
    - "positive controls that run THE SAME extractor as the real guard, over an inline broken fixture"
    - "non-vacuity floors on every source-scanning guard, so a regex that stops matching fails loudly instead of passing forever"
    - "contract amendment by strike-through: supersede in place with date + reason, never delete the original promise"

key-files:
  created:
    - supabase/migrations/114_harness_audit_action_risk_pending.sql
    - backend/tests/unit/test_audit_event_registration.py
  modified:
    - backend/app/db/workflows.py
    - backend/tests/unit/test_harness_audit_102.py
    - backend/tests/unit/test_harness_audit_emit.py
    - .planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/185-SPEC.md
    - .planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/185-VALIDATION.md
    - .planning/ROADMAP.md

key-decisions:
  - "Ship migration 114 and amend the zero-migration contract in the open (operator decision, 2026-07-31) rather than have the armed pause reuse an already-registered kind — the alternative works today but re-introduces exactly the dishonesty 185-05 existed to remove"
  - "The migration is AUTHORED here and APPLIED by the operator in Task 3 — the 070 precedent's own header protocol, verbatim"
  - "The emit site (harness_engine.py:712-716) is untouched: it was correct; the registration is what was missing"
  - "G1 stays one-directional on purpose — registered-but-never-emitted (run_started, dead since 059) is benign; emitted-but-unregistered kills runs"
  - "G2 is the load-bearing guard: it is the only check that keeps the two enforcement layers from drifting apart, and it would have caught the Phase-092 bug too"
  - "The hardcoded '22' in write_audit's ValueError is replaced by len(_AUDIT_EVENT_TYPES) — the stale number is what made the original failure message misleading"

requirements-completed: []  # GOVERN-03 stays Pending — the fix is UNPROVEN until Task 3.

# Metrics
duration: 34min
completed: 2026-07-31
---

# Phase 185 Plan 13: The armed checkpoint's audit kind, registered at both layers — Tasks 1–2 Summary

**`action_risk_pending` is now registered in the Python allow-list and authored into migration 114's CHECK, and a pair of structural guards pins the two layers equal so an emitted-but-unregistered audit kind is a red test instead of a dead run — the migration is authored ONLY; the live DB is untouched and Task 3 (operator) is where the armed run is proven to park.**

## Status: PAUSED AT A BLOCKING CHECKPOINT — 2 of 3 tasks

Task 3 is `checkpoint:human-verify` with `gate="blocking"`. It was **not** executed, not simulated, and not marked done. **GOVERN-03 remains `Pending`** — an armed checkpoint that no longer crashes is not the pass condition; an armed checkpoint that **parks** is, and only the operator can observe that.

## Performance

- **Duration:** ~34 min
- **Tasks:** 2 of 3 (Task 3 = blocking operator checkpoint)
- **Files:** 8 (2 created, 6 modified — 3 backend, 3 planning docs)

## Accomplishments

- **The two-layer registration gap is closed in code.** `action_risk_pending` was emitted at `harness_engine.py:712-716` and absent from BOTH gates that admit an audit kind. It is now in `_AUDIT_EVENT_TYPES` (22 → 23) and in migration 114's CHECK body (22 → 23). Registering only the Python half would have converted a `ValueError` into a Postgres `23514` mid-run — that trap is documented in the file and pinned by G2.
- **The emit site was left alone.** `harness_engine.py` shows **0 lines changed**. The honesty argument in its comment (`:697-711`) was right; only the vocabulary registration was missing.
- **The stale count is gone for good.** `write_audit`'s `ValueError` now derives the number from `len(_AUDIT_EVENT_TYPES)`. The original message said *"must be one of the 22 harness_audit kinds"* — a hardcoded 22 in an error whose entire cause was that 22 needed to become 23.
- **The failure class is now structurally unrepeatable.** Six tests in `test_audit_event_registration.py`: G1 (every `event_type=` literal in `backend/app/` is registered — **22 distinct scanned**, non-vacuity floor 20), G2 (the Python set equals the highest-numbered migration's CHECK set, **both directions**), a positive control for each over the same extractor, a regression pin on a real mis-parse, and a named test for the specific kind.
- **The contract was amended in the open, in the same commit as the migration that breaks it.** Six locations across three documents now carry the date, the operator decision and one identical reason sentence. Every superseded promise is struck through, never deleted.
- **The live database is byte-unchanged.** Verified by read-only `pg_get_constraintdef` before authoring, after authoring, and immediately before each commit.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Author migration 114 and amend the zero-migration contract in the open | `368a9028` | `supabase/migrations/114_harness_audit_action_risk_pending.sql` (new), `185-SPEC.md`, `185-VALIDATION.md`, `.planning/ROADMAP.md` |
| 2 | Register the kind, and make the whole class unrepeatable | `16cba8e0` | `backend/app/db/workflows.py`, `backend/tests/unit/test_audit_event_registration.py` (new), `test_harness_audit_102.py`, `test_harness_audit_emit.py` |
| 3 | Operator applies migration 114 and observes the armed run PARK | — | **NOT EXECUTED — blocking checkpoint** |

## PROOF: the live DB was NOT touched

The single most important assertion in this summary. Migration 114 is **authored, not applied**, per the 070 precedent's own header (*"This plan ONLY AUTHORS the file — it is NOT applied here"*).

No `supabase db push`, no `db reset`, no `regenerate-full-schema.sh`, and no write of any kind was issued against the database. The only DB access was a **read-only** `SELECT` on `pg_constraint` through a connection opened with `set_session(readonly=True)`, run from a scratchpad file outside the watched tree.

`pg_get_constraintdef` on `harness_audit`, taken immediately before writing this summary:

```
CONSTRAINT: harness_audit_event_type_check
DEFINITION: CHECK ((event_type = ANY (ARRAY['phase_started'::text, 'phase_completed'::text,
  'phase_transition'::text, 'gate_passed'::text, 'gate_failed'::text, 'tool_refused'::text,
  'run_started'::text, 'run_completed'::text, 'run_failed'::text, 'emit_forced'::text,
  'emit_recovered'::text, 'emit_validated'::text, 'emit_rejected'::text, 'emit_rendered'::text,
  'emit_integrity_failed'::text, 'emit_failed'::text, 'judge_verdict'::text,
  'publish_attempted'::text, 'publish_blocked'::text, 'publish_succeeded'::text,
  'policy_applied'::text, 'validator_ask_user_approved'::text])))
LITERAL COUNT: 22
HAS action_risk_pending: False
```

**22 literals. `action_risk_pending` absent.** Identical to the pre-work reading. After the operator applies 114 in Task 3 it must read **23** with `action_risk_pending` present.

Note the live constraint is currently **narrower than the Python allow-list**. That is the intended, temporary state between Task 2 and Task 3: `write_audit` will now pass its allow-list and hit a Postgres `23514` until the migration is applied. **Do not launch an armed workflow before completing Task 3.**

## Verification

| Check | Result |
|-------|--------|
| `ls supabase/migrations/114_*.sql` | `114_harness_audit_action_risk_pending.sql` |
| Filename matches `^[0-9]+_[a-z0-9_]+\.sql$` | ✅ 1 match (no letter suffix — CLAUDE.md: `114b` would be silently skipped) |
| Literals in 114's CHECK body | **23**, no duplicates, `action_risk_pending` present |
| 114's 22 pre-existing literals == the live 22 | ✅ exact set match |
| `grep -c "DROP CONSTRAINT harness_audit_event_type_check"` | **1** |
| `CREATE TABLE` / `POLICY` / `ROW LEVEL SECURITY` / `ADD COLUMN` / `CREATE INDEX` / `GRANT` as DDL | **0** — the 3 grep hits are prose in the header, a grouping comment, and the `'policy_applied'` literal |
| `ALTER TABLE` targets | 2 statements, both `public.harness_audit` (DROP then ADD of the same constraint — the 070 form). No second target. |
| `len(_AUDIT_EVENT_TYPES)` | **23**, `action_risk_pending` present |
| `pytest tests/unit/test_audit_event_registration.py -q` | **6 passed** |
| G1 distinct literals scanned | **22** (floor is 20) |
| `pytest tests/unit -q` | **62 failed, 1622 passed, 2 xfailed, 2 xpassed** vs baseline **62 failed, 1616 passed, 2 xfailed, 2 xpassed** — **no new failure**; +6 passed is exactly this plan's new file |
| `git diff --stat -- frontend/` | **0 files** |
| `git diff --stat -- backend/app/services/harness_engine.py` | **0 files** — the emit site is untouched |
| `git status supabase/migrations` | exactly one new file |
| Live `pg_get_constraintdef` | **22 literals** — unchanged |

## POSITIVE CONTROLS — observed RED

Both guards were falsified before being trusted. This project has been bitten by guards whose controls were never seen red, so each was broken deliberately and the failure output recorded.

### Control 1 — G1, by recreating the actual bug (Python literal removed)

Removed `"action_risk_pending"` from `_AUDIT_EVENT_TYPES`, leaving the emit site intact — the exact shape of BUG-260731-02:

```
E   AssertionError: BUG-260731-02 CLASS: these event_type kinds are EMITTED but NOT
    registered in _AUDIT_EVENT_TYPES. write_audit raises ValueError before the INSERT,
    which kills the live run at the moment it fires:
E       'action_risk_pending' at app\services\harness_engine.py
E     Fix BOTH layers: add the kind to _AUDIT_EVENT_TYPES *and* ship a migration
      extending harness_audit_event_type_check (see G2).
E   assert not {'action_risk_pending': ['app\\services\\harness_engine.py']}
tests\unit\test_audit_event_registration.py:150: AssertionError
...
4 failed, 2 passed
```

G1 named the offending kind **and the file it is emitted from**, unassisted. G2 went red simultaneously in the SQL-has-it/Python-lacks-it direction, as did the G2 control and the named-kind test. Registration restored; back to green.

### Control 2 — G2, in the BUG-260731-02 direction (SQL literal removed)

Restored the Python literal, then removed `'action_risk_pending'` from migration 114's CHECK body — Python registered, SQL not, which is the mid-run `23514` trap:

```
E   AssertionError: Registered in Python but ABSENT from
    114_harness_audit_action_risk_pending.sql's CHECK: ['action_risk_pending'].
    write_audit would pass its allow-list and then die on a Postgres 23514 MID-RUN.
    Ship a migration extending harness_audit_event_type_check.
E   assert not {'action_risk_pending'}
E   AssertionError: action_risk_pending missing from the SQL CHECK
...
3 failed, 3 passed
```

Migration restored and confirmed **byte-identical** to commit `368a9028` (`git diff --stat` = 0 lines).

### Control 3 — the G1 positive control and the non-vacuity floor are themselves not vacuous

Broke `_EVENT_TYPE_KWARG_RE` so it matched nothing:

```
E   AssertionError: NON-VACUITY FAILURE: scanned only 0 distinct event_type literals
    under C:\Vibe Apps\Agentic RAG\backend\app (expected >= 20). The extractor has
    stopped matching - fix it, do not lower the floor.
E   assert 0 >= 20
E    +  where 0 = len({})
...
>   assert literals == ["not_a_real_kind", "gate_passed"], literals
E   AssertionError: []
E   assert [] == ['not_a_real_...'gate_passed']
...
2 failed, 4 passed
```

A regex that silently stops matching now fails loudly instead of passing forever. Regex restored; 6 passed.

### Control 4 — the comment-blind mis-parse (found while authoring, pinned as a test)

The first parser read **9** literals out of a 23-literal CHECK and reported `HAS action_risk_pending: False` — a **false green in the drift-hiding direction**. Cause: the grouping comment `-- 069 (Phase 101.1) emit transitions:` contains a `)`, which terminated a `[^)]*` body match early. Fixed by stripping SQL line comments *before* the body match, and pinned by `test_g2_parser_survives_parenthesised_grouping_comments`, which asserts the naive parse still under-reports relative to the real one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 — Bug] Two pre-existing tests hardcoded `len(_AUDIT_EVENT_TYPES) == 22`**

- **Found during:** Task 2, full-suite run
- **Issue:** `tests/unit/test_harness_audit_102.py:61` and `tests/unit/test_harness_audit_emit.py:57` each pin the set size at 22. Registering the 23rd kind made both fail (`assert 23 == 22`), taking the suite to 64 failed vs the 62 baseline. Directly caused by this plan's change, so in scope.
- **Fix:** Both bumped to `== 23`, each with a comment naming migration 114 / BUG-260731-02 and pointing at the new drift guard. These are exactly the stale-hardcoded-count pattern that made the original error message misleading; they are retained (not deleted) because they are membership tests that also pin the count in lockstep — the same lockstep discipline 102 used.
- **Files modified:** `backend/tests/unit/test_harness_audit_102.py`, `backend/tests/unit/test_harness_audit_emit.py`
- **Commit:** `16cba8e0`
- **Result:** back to exactly 62 failed — no new failure.

**2. [Rule 2 — Missing critical functionality] The G2 parser had to strip SQL comments first**

- **Found during:** Task 1, verifying the migration's literal count
- **Issue:** The obvious body regex under-reported 23 literals as 9 because grouping comments contain parentheses. Left unfixed, G2 would have passed while comparing against a truncated set — a guard that hides the very drift it exists to catch.
- **Fix:** Comments stripped before the body match, documented at the function, and pinned by a dedicated regression test.
- **Commit:** `16cba8e0`

### Scope amendments (planned, not deviations)

The plan named three contract amendments; **six** locations actually asserted zero-migrations / head-113, and all six were amended for consistency:

| # | Document | Location |
|---|----------|----------|
| 1 | `185-SPEC.md` | Requirement 1 acceptance clause (`git diff -- supabase/migrations` is 0 lines) |
| 2 | `185-SPEC.md` | Out-of-scope bullet ("Any database migration. Live head stays at 113.") |
| 3 | `185-SPEC.md` | Constraints → "Zero migrations" — the canonical amendment, carrying the full reason |
| 4 | `185-SPEC.md` | Acceptance-criteria checkbox 2 |
| 5 | `185-VALIDATION.md` | Criterion-2 row + new fence **1b**; fence 1 marked superseded with its 2026-07-30 reading preserved; the `11-2` plan-mapping row annotated |
| 6 | `.planning/ROADMAP.md` | Phase-185 table row **and** the phase-detail Flags line |

Every one strikes the superseded wording rather than deleting it, and every one carries the same sentence: *the zero-migration promise was a scoping convenience; the honest-pause vocabulary is a correctness property, and the alternative knowingly ships the defect the phase existed to fix.*

## Requirement status

**GOVERN-03 stays `Pending`.** Deliberately not marked complete. The Python registration and the authored migration are necessary but not sufficient — the requirement is that an armed checkpoint **parks and asks a person**, and that is unobserved until the operator applies 114 and re-runs `sc10-armed-f77e72`. Not-crashing is not the pass condition.

No `requirements.mark-complete` and no `state.advance-plan` was called (both write false completion records in this project).

## Known Stubs

None. No placeholder values, no unwired components, no TODO markers introduced.

## Threat Flags

None. The trust boundary is unchanged: migration 114 widens a CHECK by one reviewed literal and touches no table, column, index, grant or policy. The INSERT-only RLS on `harness_audit` is untouched, so receipt immutability holds (T-185-13-01/02/04). T-185-13-03 (the brief ACCESS EXCLUSIVE lock during `DROP`+`ADD CONSTRAINT`) is recorded in the migration header and belongs to the standing cloud migration-parity window, where migs **099 → 114** land together.

## Next: Task 3 (blocking, operator)

1. Apply `supabase/migrations/114_harness_audit_action_risk_pending.sql` by pasting it into the Supabase SQL editor. **Never** `supabase db push` / `db reset`.
2. `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit `supabase/full-schema.sql` alongside.
3. Confirm `pg_get_constraintdef` on `harness_audit` now lists **23** literals including `action_risk_pending`.
4. Re-run the retained repro fixture `sc10-armed-f77e72` and confirm the run **PARKS** — `workflow_phases.emit` at its pre-gate, an `action_risk_pending` row in `harness_audit`, `workflow_runs.status` **not** `failed`.
5. Only then are **G-4 #3** ("arm it and walk away") and the **SC#10 parallel-thread** row runnable. Record both in `185-VALIDATION.md`'s existing tables.

## Self-Check: PASSED

- `supabase/migrations/114_harness_audit_action_risk_pending.sql` — FOUND
- `backend/tests/unit/test_audit_event_registration.py` — FOUND
- `.planning/phases/185-graded-governance-per-node-grounding-mode-action-risk-dial/185-13-SUMMARY.md` — FOUND
- Commit `368a9028` — FOUND
- Commit `16cba8e0` — FOUND
