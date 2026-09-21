---
phase: 263-an-expert-can-be-given-its-capabilities
plan: 01
subsystem: experts / skills provenance
tags: [PACK-16, PACK-17, D-263-06, D-263-07, D-263-08, SEED-125, migration-191]

phase_base_commit: 48976e11e71a5986483546a5625e18064c3c474b

requires:
  - public.expert_bundles (Phase 259, migration 187)
  - public.skills + skills_autofill_org_id trigger (pre-existing)
  - app.utils.skill_visibility (Phase 182 — read, deliberately NOT extended)
provides:
  - public.skills.born_for_expert_bundle_id (migration 191)
  - expert_service.filter_visible_skill_names — the ONE Expert-side visibility helper
  - db.experts.stamp_skills_born_for_bundle — the D-263-08 save-path stamp
affects:
  - backend/app/services/expert_service.py
  - backend/app/db/experts.py
  - backend/app/api/experts.py  # NOT in files_modified — Rule 3 deviation, see below

tech-stack:
  added: []          # ⭐ this plan installs NOTHING; T-263-SC has no subject
  patterns:
    - "provenance marker as a THIRD disjunct inside an existing fence, never a fourth top-level branch"
    - "a save-time fence called with bundle_id=None must guard on `is not None`, or None == None admits everything"
    - "live-DB drive for anything a trigger owns — no mock can prove a trigger fires"

key-files:
  created:
    - supabase/migrations/191_skill_expert_provenance.sql
    - backend/tests/unit/test_263_expert_born_skill_resolution.py
    - backend/tests/integration/test_263_skill_org_stamp_live.py
  modified:
    - backend/app/services/expert_service.py
    - backend/app/db/experts.py
    - backend/app/api/experts.py
    - backend/tests/unit/test_seed125_skill_visibility_filter.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
  NOT_modified_but_owed:
    - supabase/full-schema.sql   # regeneration BLOCKED in a worktree — see Deferred Issues

decisions:
  - "The born-for arm stays in expert_service.py and is deliberately NOT added to app/utils/skill_visibility.py — that module feeds tool_dispatcher (5 sites) and harness/grounding.py, and widening it would widen the agent loop and workflow grounding. Expert-side wider, agent-side byte-unchanged."
  - "update_expert_service gained an OPTIONAL caller_user_id so the pre-263 four-argument call shape keeps working; api/experts.py passes it (Rule 3 deviation)."
  - "SEED-303 LEFT as-is — already correctly routed at discuss-phase (folded_into: 263, S9 only). The fold is not complete until 263-02/03/04 land."

metrics:
  duration: ~2h (including one operator checkpoint round trip)
  tasks: 3
  commits: 4
  completed: 2026-09-21
---

# Phase 263 Plan 01: Skill Provenance for Experts — Summary

A skill authored for an Expert now resolves through that Expert for every member of the org —
and through nothing else. Migration 191 adds the marker, `filter_visible_skill_names` reads it as a
third disjunct **inside** the existing org fence, and the save path stamps only the saver's own
unstamped rows in their own org. PACK-17 is driven on all three axes rather than asserted.

**Phase base commit: `48976e11e71a5986483546a5625e18064c3c474b`**
⚠ 263-03's D-263-11 closed-core comparison and 263-04's red-triage both mean **this** SHA and must
read it from here rather than re-deriving it — a re-derived base drifts once wave 1 has landed.

⚠ **The worktree did NOT arrive on that commit.** It arrived on
`5ff8c58466b21037edb2a842039c78617b6bcbb6` (the default branch) with a merge-base of
`658cb8547588ba16572dee766b7a4ee4af7aaf61`, and the `<worktree_branch_check>` `git reset --hard`
corrected it. **This is a recurring trap and is left on the record deliberately:** an executor that
skipped that assertion would have built on the wrong base and every diff in this document would be
against the wrong tree.

## Commits

| # | Hash | Type | What |
|---|---|---|---|
| 1 | `7526126d9` | chore | migration 191 — `skills.born_for_expert_bundle_id` |
| 2 | `fdc17319a` | test | **RED** — 11 cases, failing at collection |
| 3 | `be7f3a437` | feat | **GREEN** — the helper, the third arm, the stamp, the save wiring |
| 4 | `64d5b970b` | test | PACK-17 visibility + creation axes, ledger hygiene |

No file was deleted by any commit (`git diff --diff-filter=D` over the whole range is empty).

## Task 1 — migration 191

**Read-back, run by the orchestrator against the live local DB, quoted verbatim:**

```
information_schema.columns -> exactly one row: born_for_expert_bundle_id / uuid / YES
select count(*) from public.skills where born_for_expert_bundle_id is not null -> 0
select count(*) from public.skills -> 10 (unchanged, no data loss)
pg_indexes -> CREATE INDEX idx_skills_born_for_expert ON public.skills USING btree
              (born_for_expert_bundle_id) WHERE (born_for_expert_bundle_id IS NOT NULL)
pg_constraint.confdeltype -> 'n' (SET NULL) on the born_for_expert_bundle_id FK
col_description -> COMMENT present
```

⚠ **HOW IT WAS APPLIED, stated plainly so the record is not prettier than the event.** The plan says
*"paste it into the Supabase SQL editor"*. That is **not** what happened. The operator instructed the
orchestrator to apply it, and the orchestrator executed the committed migration file **verbatim**
(md5 `9d505616764568c70d7d565c35b4194c`, read from this worktree rather than retyped) through a
**direct asyncpg connection** to the local Postgres. **Not the SQL editor UI.** `supabase db push`
and `supabase db reset` were never run, at any point. All three statements are idempotent
(`ADD COLUMN IF NOT EXISTS` / `COMMENT` / `CREATE INDEX IF NOT EXISTS`).

### The `grep` that needed two drafts

`grep -icE "grant|revoke"` must return `0`. My first version returned **2** — and neither hit was an
ACL statement. The header comment said *"No GRANT/REVOKE"* and the backfill note said *"would grant
Experts skills…"*. **The criterion is a plain-text grep, so PROSE ABOUT ACLs trips it exactly as an
ACL statement would.** Reworded to *"No ACL statement"* / *"would widen Experts to"*; now `0`.
Worth keeping: a gate written as a text grep cannot distinguish a statement from a sentence
describing its absence.

| Criterion | Result |
|---|---|
| filename matches `^[0-9]+_[a-z0-9_]+\.sql$` | `191_skill_expert_provenance.sql` — no letter suffix |
| `grep -icE "grant\|revoke"` | **0** |
| `git diff --name-only -- scripts/full-schema-supplement.sql` | **empty** — 191 creates no ACL obligation |
| `node scripts/check-schema-acl-parity.cjs` | **exit 0** — 157 migrations scanned, mirrored 155/155, tail md5 `9a0e883ccc96b1a78527831279eec8a9` |
| `SELECT count(*) … WHERE born_for_expert_bundle_id IS NOT NULL` | **0** — no historical backfill |
| `grep -c "born_for_expert_bundle_id" supabase/full-schema.sql` | ⛔ **NOT MET — see Deferred Issues** |

## Task 2 — the third arm, the helper, the stamp

`tests/unit/test_263_expert_born_skill_resolution.py`: **11 passed**, 435 lines.
Targeted expert loop (9 files): **65 passed**.

### The RED drive proved the PLACEMENT, and found more than the plan predicted

Planting the arm as a **fourth top-level `elif`**, outside the org fence:

```
FAILED test_cross_org_row_with_matching_marker_is_still_stripped
FAILED test_disabled_born_for_skill_is_stripped
2 failed, 9 passed
```

The plan predicted **one** red case (the cross-org one, T-263-01). **Two fired.** The second —
`is_enabled` — shares the same inner parenthesis as `org_id`, so a top-level placement bypasses
*both* fences, not one. ⭐ That is a stronger result than the plan asked for: the placement is load
bearing for two independent invariants, and the second was undocumented until the plant fired.

`backend/app/services/expert_service.py` md5 **`730b5cde8ee83fd7bc8476f56b22231a`** before the plant
and **`730b5cde8ee83fd7bc8476f56b22231a`** after restoring — byte-identical.

### Acceptance criteria, measured

| Criterion | Target | Measured |
|---|---|---|
| 263 drive cases | ≥ 6 | **11** |
| `test_259_expert_member_isolation.py` | 6 passed, zero fixture edits | **6 passed**; `git diff --stat` on that file is **empty** |
| `grep -c born_for_expert_bundle_id` in `expert_service.py` | ≥ 2 | **4** |
| `grep -c "bundle_id is not None"` | ≥ 1 | **2** |
| `grep -cF 'org_id = $3'` in `db/experts.py` | ≥ 1 | **2** |
| `grep -cF 'user_id = $4'` in `db/experts.py` | ≥ 1 | **2** |
| `grep -c "born_for_expert_bundle_id IS NULL"` | ≥ 1 | **2** |
| `test_261_single_expert_authoring_gate.py` | passes | **passes** — no role literal entered either module |
| `test_259_closed_core_inventory.py` | 6 passed | **6 passed** — `expert_service.py` still AST-pure |

⚠ **ONE ACCEPTANCE CRITERION WAS WRONG AT THE BASE COMMIT AND IS RECORDED AS SUCH RATHER THAN
QUIETLY SATISFIED.** The plan asks that `grep -c "EXPERT_MEMBER_CROSS_ORG_STRIPPED"
backend/app/services/expert_service.py` return **exactly 1**. **It returned 4 before I touched the
file** (one docstring mention plus three `logger.warning` call sites — skills, folders, connections)
and returns **5** now (my helper's docstring adds a fourth mention). **The number of LOG CALL SITES
is unchanged at 3**, which is the property the criterion was reaching for: no second log verb was
introduced. Satisfying the criterion literally would have required deleting the folder and
connection warnings, which would be a regression. Recorded, not silently reinterpreted.

## Task 3 — PACK-17 on all three axes

### Visibility axis — and the pre-existing suite was blind to it

`test_seed125_skill_visibility_filter.py`: **4 cases at base → 7 now** (+3).

RED drive: planting the born-for arm into `skill_row_visible` as a branch above the org gate:

```
FAILED test_born_for_marker_does_not_widen_cross_org_visibility_row_encoding
FAILED test_born_for_marker_does_not_admit_another_users_private_same_org_skill
2 failed, 5 passed
```

⭐ **The finding is which cases did NOT fire.** All four pre-existing cases stayed green. **The suite
that exists specifically to guard SEED-125 could not see a widening of the very predicate it
guards** — because every one of its cases drives `build_skill_visibility_or` (the query encoding),
and the leak was planted in `skill_row_visible` (the row encoding). The module's own docstring says
the two encodings *"MUST agree"*; nothing executable was checking the second one at all.

`backend/app/utils/skill_visibility.py` md5 **`198c96206cf8f2622b102d8b9cd67953`** before and after
the plant — byte-identical; it is **not** modified by this plan.

### Creation axis — live local Postgres

`tests/integration/test_263_skill_org_stamp_live.py`: **2 passed, 0 skipped** (`-rs` shows no
skip report). Not a mock: no mock can prove a `BEFORE INSERT` trigger fires.

RED drive: supplying `org_id` in case 1 — exactly the defect the test guards against, i.e. `POST
/skills` putting `org_id` in its payload — produced
`assert UUID('45070c7e-…') == UUID('c1f18150-…')`. Restored; md5
**`59eae9b15fbfde40b89268bf03b86fd6`** before and after.

**`public.skills` row count: 10 before, 10 after.** Re-measured independently against the live DB
after the run: `skills rows: 10 · marked rows: 0 · leftover test rows: 0` — the `finally` cleanup
holds even on the RED run.

What the live drive also pins, deliberately: the trigger's **NO-OP arm**
(`IF NEW.org_id IS NOT NULL THEN RETURN NEW`) keeps a supplied value verbatim. That is not a bug —
it is the documented forward-compat arm, and it is **exactly why** `POST /skills` must never place
`org_id` in its insert payload, because a service-role connection bypasses the INSERT RLS policy
that would otherwise catch it.

### Ledger hygiene — three rows re-derived, two crossed the threshold here

| File | Row said | Re-derived | G-5 |
|---|---|---|---|
| `backend/app/services/expert_service.py` | `5 / 3 / 378` | **`6 / 4 / 507`** | fires (was "exactly at threshold") |
| `backend/app/db/experts.py` | `1 / 1 / 265` (CLAUDE.md) / `2 / 2 / 492` (detail file) | **`4 / 3 / 567`** | ⚠ **NOW FIRES** |
| `backend/app/api/experts.py` | `1 / 1 / 175` (CLAUDE.md) / `2 / 2 / 346` (detail file) | **`6 / 3 / 398`** | ⚠ **NOW FIRES** |

⚠ **Two files crossed the G-5 threshold in the very commit that records the crossing**, while both
rows read `young`. That is the case the at-creation precedent exists to catch: had either row been
absent, the crossing would have been invisible at any count.
⚠ **The two registers DISAGREED with each other before this plan touched them** — CLAUDE.md's table
and `docs/HOT-FILE-LEDGER.md`'s section carried *different* triples for the same two files
(`1/1/265` vs `2/2/492`; `1/1/175` vs `2/2/346`). The same-commit sync rule keeps them in step going
forward, but it does not detect a divergence that already exists.
⛔ **A stale cite corrected:** `expert_service.py`'s section said the marker was **"migration 190"**.
It is **191**; 190 is Phase 262's `model_capabilities_overrides` work. Second migration-number drift
this phase (D-263-13 corrected `087` → `089`) — the tell that a migration number in prose is a
citation nobody re-derives. Corrected beside the original, not over it.

| Gate | Result |
|---|---|
| `node scripts/check-claude-md-size.cjs` | **exit 0** — 112,041 chars, 74.7% of limit, headroom 37,959 |
| `node scripts/check-hot-file-ledger.cjs 263` | exit 1, `watched: 10` — **both `[no-row]` files belong to OTHER plans** (`263-02`'s `skill_body_authoring.py`, `263-04`'s `ProposedSkillCard.tsx`). Zero findings against this plan's surface. |
| `node scripts/check-seeds-register.cjs --phase 263` | **gate OK** — 310/310 parsed |

⚠ The size gate **fired once during authoring**: `[disposition-too-long] 203 chars (cap 200)` on
`expert_service.py`'s row. Shortened to 198. **The guard worked in the turn the prose was written**,
which is what the PostToolUse hook exists for.

## Backend baseline — SET DIFF, both directions

Measured in this worktree, at the base commit **before the first edit**, and again at HEAD.

| | base (`48976e11e`) | HEAD (`64d5b970b`) |
|---|---|---|
| failed | **71** | **71** |
| passed | 5263 | **5277** (+14) |
| xfailed / xpassed | 2 / 2 | 2 / 2 |
| collection errors | 0 | 0 |

```
comm -13 base head   ->   (empty)   # zero NEW failures
comm -23 base head   ->   (empty)   # zero disappeared
71 lines each, sets IDENTICAL
```

**+14 passing is fully accounted for**: 11 new cases in `test_263_expert_born_skill_resolution.py`
plus 3 new cases in `test_seed125_skill_visibility_filter.py`. No residual. (The 2 integration cases
live in `tests/integration/` and are outside the `tests/unit` gate.)

⚠ **The ceiling is 71 with ZERO headroom, and the passed count in CLAUDE.md has rotted.** That rule
quotes *"71 failed, 3497 passed"*; the measured figure here is **5263** at base. The `71` the gate
actually binds is unchanged — recorded beside the stale number, not over it.

⚠ **I WALKED STRAIGHT INTO THE TRAP THE PLAN WARNED ABOUT, AND IT IS WORTH THE PARAGRAPH.** My first
normalisation was `sed -E 's/ - .*$//'`. It produced **one apparently-new AND one apparently-
disappeared** failure — the same test,
`test_071_1_threadpool_sweep.py::test_no_unwrapped_sync_calls_in_route[async def upload_document(]`.
At HEAD, pytest had glued `C:\…\unraisableexception.py:33: RuntimeWarning: coroutine
'handle_query_tables' was never awaited` onto the end of the `FAILED` line **with no separator**, so
` - ` never matched. Truncating each line at the first `C:\` made both sets identical. ⛔ **The
` - `-stripping recipe in the plan is NOT sufficient by itself** — this warning attaches with zero
delimiter, and the artefact renders as a matched pair (one new, one gone) that looks like churn
rather than like a formatting difference.

## Deviations from Plan

### 1. [Rule 3 — Blocking] `backend/app/api/experts.py` edited, though absent from `files_modified`

- **Found during:** Task 2(h) — wiring the stamp into the update path.
- **Issue:** `update_expert_service(pool, bundle_id, caller_org_id, bundle_update)` had no
  `caller_user_id`, and `PATCH /{bundle_id}` never extracted one. The stamp's `user_id = $4`
  predicate is what stops another author's row being conscripted, so it cannot be omitted — the
  update-path half of D-263-08 was simply unreachable without touching the router.
- **Fix:** one **optional** kwarg on the service (so the pre-263 four-argument call shape keeps
  working — this is what kept `test_261_expert_authoring_scenarios.py`'s three positional call sites
  green without edits), plus the `current_user["id"]` extraction line that already appears verbatim
  at five other sites in that router. ⛔ No new endpoint, no new guard, no change to
  `require_capability`, no change to the 404 arm.
- **Commit:** `be7f3a437`
- ⚠ **Structural note worth more than the deviation itself:** because this file is absent from the
  plan's `files_modified`, **`check-hot-file-ledger.cjs` would not have demanded a row for it.** The
  gate audits the plan's *declared surface*, not the commit's *actual diff* — so a file edited as an
  unplanned deviation is invisible to G-5 unless its row is updated by hand, as it was here. And
  this file had just crossed the G-5 threshold.

### 2. [Deferred — Rule 3 escalated, not auto-fixed] `full-schema.sql` regeneration is IMPOSSIBLE from a worktree

- **Found during:** Task 1, resumption half.
- **Issue:** `bash scripts/regenerate-full-schema.sh` exits with
  `Error: Supabase is not running locally. Start it with 'supabase start'.` **The stack is running.**
  The script's guard is `supabase status`, and **the Supabase CLI derives the container name from the
  CWD basename** — in this worktree that is `agent-aba0a6793c1ec4383`, so it looks for
  `supabase_db_agent-aba0a6793c1ec4383`, which cannot exist. Proven by running
  `supabase status --workdir "C:/Vibe Apps/Agentic RAG"`, which succeeds and prints the live stack.
  There is no `supabase/config.toml` in this repo at all, so nothing pins the project ref.
- **Second, independent blocker:** the script's dump step is `docker exec … pg_dump`. **`docker` is
  denied to me**, and neither `pg_dump` nor `psql` is on the host PATH (`command -v` returns nothing
  for either). So even with the CLI guard satisfied, the dump could not run.
- **NOT auto-fixed, deliberately.** The only routes available were to edit a tracked script, to
  hand-write `full-schema.sql` (⛔ explicitly forbidden), or to `cd` out of the worktree
  (⛔ forbidden by the isolation contract). Escalating is the correct call.
- **Consequence:** `grep -c "born_for_expert_bundle_id" supabase/full-schema.sql` returns **0**, and
  that acceptance criterion is **NOT met**. `supabase/full-schema.sql` is untouched by this plan.
- **Owed action (one command, from the MAIN repo root, by the orchestrator or operator):**
  ```bash
  bash scripts/regenerate-full-schema.sh      # NO --reset
  grep -c "born_for_expert_bundle_id" supabase/full-schema.sql   # expect >= 1
  git diff --name-only -- scripts/full-schema-supplement.sql     # expect EMPTY
  ```
  ⚠ Watch for Phase 262 contamination: if `api_surface`, `max_tools`, `reasoning_first`,
  `reasoning_off`, `supports_parallel_tools` or `uses_max_completion_tokens` appear on
  `model_capabilities_overrides`, migration 190 was applied to the live DB mid-flight and the
  artifact would reference an uncommitted migration. **STOP and report** rather than committing it.

## Seeds routing

| Seed | Matched on | Routing |
|---|---|---|
| **SEED-303** | `expert_service.py`, `db/experts.py`, `api/experts.py`, `models/expert.py` | **LEAVE** — already correctly routed at discuss-phase (`folded_into: "263 (S9 only …)"`). S9 is what this plan begins to deliver; the fold is not complete until 263-02/03/04 land, so flipping status now would be premature. No frontmatter edit. |
| SEED-198 | `backend/app/**` | LEAVE — `partially-answered`, Expert-domain, same situation as 303. |
| SEED-266, SEED-290 | `supabase/full-schema.sql` | LEAVE — matched via the plan's declared surface, but **this plan did not modify that file** (see Deferred Issue 2). Re-fires with the owed regeneration. |
| SEED-280, SEED-287 | `scripts/vitest-count-gate.cjs` | LEAVE — frontend is untouched by this plan; these belong to another plan's surface. |
| SEED-284 | `docs/HOT-FILE-LEDGER.md` | LEAVE — coarse trigger path; the elapsed-formatter finding is unrelated to the rows edited here. |

## UAT rows

| # | Row | Status |
|---|---|---|
| U-01 | The column exists and every pre-existing skill is NULL | ✅ **CLOSED** — read-back quoted above; `10` rows, `0` marked. |
| U-02 | An Expert-born skill resolves for a SECOND org member | ⛔ **OWED to 263-04's UAT** — cannot be driven until 263-04 ships the create-on-approve flow. Recorded, not omitted. |

## Success criteria

| Criterion | Status |
|---|---|
| Migration 191 applied locally | ✅ (via direct DDL, not the SQL editor — see above) |
| `full-schema.sql` regenerated, no supplement change, ACL parity green | ⚠ **PARTIAL** — supplement unchanged ✅, ACL parity exit 0 ✅, **regeneration OWED** ⛔ |
| `resolve_expert_bundle` admits a born-for skill through its own bundle and no other | ✅ 3 cases |
| A cross-org skill with the maximally-privileged marker is stripped, counted, logged | ✅ 4 assertions |
| The save-time helper cannot admit a foreign row through `None == None` | ✅ its own case |
| The stamp cannot reach a foreign-org, other-author, or already-claimed row | ✅ SQL text + arg order asserted |
| The RED drive fired on the placement plant; file restored md5-identical | ✅ **two** cases fired, not one |
| The backend failing SET at HEAD is a subset of the SET at base | ✅ **identical**, 71 = 71 |

## Self-Check

- `supabase/migrations/191_skill_expert_provenance.sql` — FOUND
- `backend/tests/unit/test_263_expert_born_skill_resolution.py` — FOUND
- `backend/tests/integration/test_263_skill_org_stamp_live.py` — FOUND
- `7526126d9` / `fdc17319a` / `be7f3a437` / `64d5b970b` — all FOUND in `git log`
- `supabase/full-schema.sql` — **unchanged by this plan, by design and under protest** (Deferred Issue 2)

## Self-Check: PASSED

(with one acceptance criterion explicitly NOT met and escalated rather than worked around —
`grep -c "born_for_expert_bundle_id" supabase/full-schema.sql` returns 0 until the regeneration runs
from the main repo root.)
