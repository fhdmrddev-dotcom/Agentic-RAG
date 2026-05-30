# Plan 090-03 Summary — Live-DB Apply + Verification Gate

**Plan:** 090-03 (autonomous: false — human-run apply + verify gate)
**Status:** ✅ Complete
**Completed:** 2026-05-31

## What was done

The operator applied migrations 056–059 to the live local Supabase by hand (Supabase
Studio SQL editor, in order — never `db push`/`db reset`, per CLAUDE.md), then the
regenerated schema artifact and the full live-DB verification gate were confirmed.

### Task 1 — Apply migrations + regenerate full-schema.sql ✅
- All four migrations applied in order (056 → 057 → 058 → 059), each "Success".
- **Deviation (fixed):** 056's global-seed row FK'd `created_by` to the `018` skills
  seed-user (`00000000-…-0001`), which was **absent** in this DB's `auth.users` →
  `FK violation 23503` on first apply. Fix: made 056 self-sufficient by prepending the
  same idempotent `auth.users` seed INSERT that `018` uses (`ON CONFLICT (id) DO NOTHING`).
  Committed as `eaa9e779`. Re-apply of the edited 056 succeeded. Seed mechanism was
  "Claude's Discretion" per 090-CONTEXT, so this is in-scope.
- `bash scripts/regenerate-full-schema.sh` (no-reset live dump) run; `supabase/full-schema.sql`
  rebuilt (1971 → 2398 lines). Verified: 4 new tables present, `threads.active_workflow_run_id`
  present, `deep_mode_metadata` ABSENT, immutable-on-publish trigger present, `org_id` on all
  4 tables. No `--reset` (no data wipe). Committed as `3c0a4700`.

### Task 2 — verify_090.sql live-DB gate (SC#1/#2/#3/#4 + HARNESS-06) ✅
Authored a single-paste, auto-reporting companion `supabase/verify_090_run.sql` (zero
substitution; seeds its own data + a 2nd user; real RLS via `SET ROLE authenticated`;
prints a PASS/FAIL grid; `ROLLBACK`s). Operator ran it in Studio — **all 6 blocks PASS:**

| Block | Result | Covers |
|-------|--------|--------|
| A immutability | PASS — post-publish UPDATE raised 23514 | HARNESS-02 / SC#2 |
| B DELETE RESTRICT | PASS — DELETE of referenced def raised 23503 | HARNESS-02 / SC#2 |
| C UNIQUE(slug,version) | PASS — duplicate raised 23505 | HARNESS-02 |
| D cross-user RLS denial | PASS — user B sees 0 runs/0 phases/0 audit | SC#3 |
| E INSERT-only audit | PASS — owner reads own audit (1) but UPDATE affected 0 rows | HARNESS-06 |
| E audit policy set | PASS — only INSERT + SELECT policies (no UPDATE/DELETE) | HARNESS-06 |
| F presence/absence | PASS — 4 tables, active_workflow_run_id present, deep_mode_metadata absent, org_id nullable x4 | SC#1 / SC#4 |

## Success Criteria → result
- **SC#1** (4 tables + threads column applied; full-schema regenerated) — ✅ Block F + regen verified
- **SC#2 / HARNESS-02** (immutable-on-publish: trigger + DELETE RESTRICT + UNIQUE) — ✅ Blocks A/B/C live
- **SC#3** (cross-user RLS denial; harness_audit INSERT-only) — ✅ Blocks D/E live
- **SC#4** (no deep_mode_metadata; org_id nullable on all) — ✅ Block F
- **HARNESS-06** (INSERT-only audit) — ✅ Block E (policy set + mutation denied)

## Files
- `supabase/full-schema.sql` — regenerated (commit `3c0a4700`)
- `supabase/migrations/056_workflow_definitions.sql` — self-sufficient seed fix (commit `eaa9e779`)
- `supabase/verify_090_run.sql` — auto-reporting verification companion (commit, this plan)

## Key-files.created
- supabase/verify_090_run.sql

## Self-Check: PASSED
Phase gate met: full pytest GREEN (Plan 01 model test) AND all 6 live-DB blocks confirmed.

## Notes for downstream (Phase 091)
- 056 ships ONE minimal global seed (`research-summarize`) as the `model_validate()` fixture;
  the real 2–3 templates (HARNESS-07) are Phase 091's job.
- `harness_audit.event_type` CHECK enum is provisional — coordinate the final event-type set with
  the 091 engine; it's `text + CHECK` (not a PG ENUM) precisely so it's cheap to ALTER.
- `app/models/harness.py` PhaseConfig field shapes are provisional pending the 091 executors.
