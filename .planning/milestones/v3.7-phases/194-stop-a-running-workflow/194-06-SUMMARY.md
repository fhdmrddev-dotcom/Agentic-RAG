---
phase: 194-stop-a-running-workflow
plan: 06
subsystem: backend-data-access
tags: [workflow-phases, cancel, RUN-01, G-5, fences]
requires: ["194-01", "194-02"]
provides:
  - "backend/app/db/workflows.py::cancel_phase — the SIXTH phase-keyed workflow_phases status writer (engine arm)"
  - "backend/app/db/workflows.py::cancel_active_phases — the RUN-KEYED set-predicate sibling (engineless zombie / no-producer arm)"
  - "the corrected finish_run docstring (completed / failed / cancelled) + the named cross-worker interleave"
affects: ["194-09", "194-10"]
tech-stack:
  added: []
  patterns: ["set-predicate UPDATE", "$N binds only", "correct-beside-not-over", "AST-scoped source fences"]
key-files:
  created:
    - backend/tests/test_workflow_phase_cancel.py
  modified:
    - backend/app/db/workflows.py
decisions:
  - "Two writers, not one — structural: the engine arm holds phase_id, the zombie arm has no engine and must FIND the row"
  - "cancel_active_phases is a SET-PREDICATE, never a read-then-update-by-id: correct for 0, 1 or N"
  - "finish_run's original first line is quoted VERBATIM as superseded, never deleted"
  - "G-5 on backend/app/db/workflows.py honoured BY CONSTRUCTION — no override requested, none recorded"
metrics:
  tasks: 2
  commits: 3
  duration: ~50m
  completed: 2026-08-16
---

# Phase 194 Plan 06: The two `cancelled` phase writers Summary

SC#3's data-access half — `cancel_phase` (PHASE-KEYED, engine arm) and `cancel_active_phases`
(RUN-KEYED set-predicate, engineless arm) are now the only two ways to write `cancelled` onto a
`workflow_phases` row, and `finish_run`'s docstring no longer claims it is narrower than it is.

**No caller was wired** (a plan non-goal) — plans 194-09 and 194-10 call them.

---

## Base assertion — the wrong-base streak continued and is now 5 out of 5 today

```
git rev-parse --abbrev-ref HEAD  → worktree-agent-a526c830f44104422        (namespace OK)
git merge-base HEAD bdef9781     → 3781a3fe4690a9619e619f4cc412bd37a7dafc52   ✗ WRONG BASE
git reset --hard bdef9781        → HEAD is now at bdef9781 chore: merge executor worktree (194-04)
git rev-parse HEAD               → bdef9781986e6834a617bb5fdca9dec9d29a1c19   ✓ BASE OK
```

The worktree forked from `3781a3fe` — the same wrong base every worktree in this phase has forked
from. The dispatch brief predicted it ("expect it") and it happened. `bootstrap-worktree.sh` ran as
the first action and reported `BOOTSTRAP OK` (both junctions attached, both env files copied).

---

## What was built

### Task 1 — `cancel_phase` + `cancel_active_phases` (TDD: RED `3c862fc1` → GREEN `660b3c3c`)

| Writer | Key | SQL | Serves |
|---|---|---|---|
| `cancel_phase(pool, phase_id)` | PHASE-KEYED | `UPDATE workflow_phases SET status='cancelled', updated_at=now() WHERE id = $1` | the **engine** cancel arm, which holds `phase_id` in the same loop iteration |
| `cancel_active_phases(pool, workflow_run_id)` | RUN-KEYED | `UPDATE workflow_phases SET status='cancelled', updated_at=now() WHERE workflow_run_id = $1 AND status = 'active'` | the **zombie / no-producer** arm — no engine, no loop, no `phase_id` |

Both docstrings carry the four sections the plan required: **WHAT THIS STATUS MEANS** (with D-04's
offered-and-rejected `failed`/`skipped`), **⚠ THE COLUMN STORES THE SLUG (D-17)**, **⚠ COMPLETED
PHASES ARE UNTOUCHED (D-07/D-13)** — naming the `AND status = 'active'` clause as *the mechanism,
not a convention* — and the key style with the **42703** bare-`run_id` trap. Each also states
**which arm it serves and why there are two**, because a docstring that does not say so invites the
next reader to collapse them, and **that no ownership check happens here** (T-194-06-03: the pool
bypasses RLS, ownership is the caller's, the same division `_cancel_run_internals` keeps).

### Task 2 — `finish_run`'s docstring, corrected BESIDE (`d69cd6ce`)

The old first line said `completed` / `failed`. It was **narrower than the function**, and it is
quoted verbatim under a `⚠ CORRECTED (Phase 194)` marker rather than deleted. Named in the
correction, each measured at this base rather than inherited:

| Fact | Measured |
|---|---|
| F2 caller passing `"cancelled"` since v2.8 | `backend/app/services/run_producer.py:262` |
| `delete_workflow_cascade` passing `"cancelled"` | `backend/app/api/workflows.py:1518` |
| The CHECK that has admitted it from the start | `supabase/migrations/057_workflow_runs.sql:19`, re-asserted `063_dual_mode_continue.sql:55-57` |

It also records the **cross-worker interleave RESEARCH named rather than guarded** — benign by
**value-identity, not by exclusion** (same value, row-level locking serialises, idempotent anchor
clear) — plus the prohibition that *is* the whole guard: **the two writes must never disagree.**
Both grep-able sentences are on **ONE line each** (193.2-08: a rule written WRAPPED failed its own
literal `grep -q` and read as *"already fixed"*).

---

## G-5 — `backend/app/db/workflows.py` (17 phases, the second-hottest backend file)

**FIRES on the count. HONOURED BY CONSTRUCTION. No override was requested and none is recorded.**

**The measured test, which is a test rather than an argument:** the file already owns **FIVE**
`workflow_phases` status writers (`mark_phase_active`, `complete_phase`, `fail_phase`, `skip_phase`,
`record_phase_not_sent`). This plan adds a **sixth and its run-keyed sibling**. *A sixth writer of a
status the file already writes five of is not a second concern.*

The evidence, not the assertion:

```
git diff --numstat (Task 1 only)   → 100 insertions / 0 DELETIONS
git diff -U0 hunk headers          → @@ -1292,0 +1293,100 @@   (ONE hunk)
hunk context line                  → async def record_phase_not_sent(...)
```

**ONE hunk, ZERO deletions, landing immediately after the fifth writer and before the
`# ── workflow_runs writes` divider** — i.e. inside the `workflow_phases writes` block the file
already has. Zero deletions is what proves no shipped writer moved: a modification would have
produced a deleted line. The plan's **STOP condition was not triggered** — the measurement agrees
with the plan's.

**Line classification of the 100 added lines** (blank / docstring / code, docstring located by
triple-quote state): **total 100 · blank 18 · docstring 72 · CODE 10.** Prose is **72 %** of the
growth, consistent with this project's five prior cuts (188.2, 192, 192.1, 193, 193.1 all measured
prose-dominant). The 10 code lines are exactly: 2 × `async def`, 2 × `await pool.execute(`, 2 × SQL
string, 2 × bind arg, 2 × closing `)`.

### Re-derived ledger figures — the row's inherited triple has MOVED

`CLAUDE.md`'s row ends *"It inherits `32 / 17 / 1447`."* **Confirmed exactly at my base** (`bdef9781`:
32 commits / 17 phases / 1447 L), then moved by this plan's own two commits on the file:

```
git log --oneline -- backend/app/db/workflows.py | wc -l   → 34    (was 32)
wc -l backend/app/db/workflows.py                          → 1582  (was 1447)
git log --format=%s -- <file> | sed …| sort -u             → 18 buckets, ZERO quick-task
```

> **⇒ `34 commits / 18 phases / 1582 L`.** Phase list gains `194`. Still **zero quick-task buckets**
> on this file — the recipe returns exactly 18 and all eighteen are real phases, unlike
> `WorkflowBuilderPage.tsx` / `api/workflows.py` / `publish_service.py`, whose recipes return
> `260809` / `260814` / `quick` alongside the phases. **The next phase adding a genuinely SECOND
> concern here still owes a refactor recommendation FIRST, and it inherits `34 / 18 / 1582`.** The
> natural seam is unchanged and re-stated rather than inherited: the three list feeds versus the
> single-definition read, and the publish-flip versus the run CRUD.

⚠ **This SUMMARY does not edit the `CLAUDE.md` row** — that file is not in this plan's
`files_modified`, and Phase 194's ledger deliverable (D-02) covers `RunCard.tsx` and
`WorkspacePanel.tsx`. The figures are published here so the close-out plan inherits a measurement
instead of re-deriving one. ⚠ **And per this table's own habit: these three numbers go stale on the
next commit that touches the file, which can be the same afternoon.**

---

## Fences — every one driven RED against a REAL production-source plant

Eight plants were applied to **production source** (P8 to the test harness, labelled as such), the
suite run, the plant reverted, and the file **md5-verified byte-identical** each time
(`e760fc671c4c6d13d3c23dd9c931b21f` on all seven source reverts).

| # | Plant (real, in production source) | RED cases | Verdict |
|---|---|---|---|
| P1 | run-keyed write becomes phase-keyed (`WHERE id = $1`) | `…is_keyed_on_workflow_run_id`, `…only_reaches_rows_that_are_active`, `…lives_on_one_source_line` | 3 failed / 11 passed |
| P2 | `AND status = 'active'` **dropped** (a bulk terminalize) | `…only_reaches_rows_that_are_active`, `…lives_on_one_source_line` | 2 failed / 12 passed |
| P3 | predicate **split across two source lines** | `…lives_on_one_source_line` **only** | 1 failed / 13 passed |
| P4 | **f-string** reaches the SQL | `…no_fstring_percent_format_or_dot_format…`, +2 | 3 failed / 11 passed |
| P5 | slug misspelled `'canceled'` (one `l`) | `…byte_identical_to_migration_119s_vocabulary`, +3 | 4 failed / 10 passed |
| P6 | `cancel_phase` writes `'skipped'` | `…any_other_phase_status_slug`, `…five_shipped_writers…` | 2 failed / 12 passed |
| P7 | bare `run_id` column (Postgres 42703) | `…names_a_bare_run_id_column`, +2 | 3 failed / 11 passed |
| P8 | **HARNESS CONTROL** — `_TARGETS` typo in the test | the guard + all four `_TARGETS`-scoped sweeps | 5 failed / 9 passed |

### The multi-clause requirement is satisfied and PROVED, not claimed

The run-keyed predicate has **two clauses** and they red **independently**: P1 (key) reds
`…is_keyed_on_workflow_run_id`, which P2 leaves **green**; P2 (status filter) reds
`…only_reaches_rows_that_are_active`, which is the D-07 completed-untouched guard. 194-03 shipped
four REQUIRED plants that **all red on the same clause**, which would have left a second clause
inert and indistinguishable from live. Splitting them was deliberate and P1 vs P2 measures it.

**P3 is the sharpest result: it reds exactly ONE case and nothing else** — the one-line-predicate
property is real, non-redundant, and invisible to every AST-scoped case in the file (Python joins
adjacent string literals at parse time, so a wrapped predicate is byte-identical to the AST).

### ⚠ A fence of mine was measured VACUOUS before it shipped, and it is recorded rather than smoothed

`test_the_run_keyed_predicate_lives_on_one_source_line`, **as first written**, was a bare file-wide
search for `WHERE workflow_run_id = $1 AND status = 'active'`. It **PASSED on the RED run** — on a
tree where neither writer existed — because **`get_active_phase` (shipped long before Phase 194)
already carries the byte-identical predicate on one line as a READ.** A fence a nine-phase-old
`SELECT` satisfies is not a fence. It is now scoped to require the **same line** to carry
`UPDATE workflow_phases SET status='cancelled'`, and P3 proves the scoped form fires.

That is the whole reason the RED run was read case-by-case rather than by its count: the first RED
reading was **13 failed / 1 passed**, and the 1 was this. After the fix it was **14 failed / 0
passed**. *A count comparison could not have seen it.*

### ⚠ A CORRECTION to my own test docstring, recorded BESIDE the original (P8)

The blindness-guard case's docstring claimed the `_TARGETS`-scoped sweeps *"would pass over the
empty set and read as green"* without it. **P8 measured that FALSE:** with `_TARGETS` misspelled,
**five cases go RED** — the guard plus all four scoped sweeps — because `_function_nodes()[name]`
raises `KeyError` on a lookup miss rather than iterating an empty set. The sweeps fail **loudly** on
their own blindness. The original paragraph is kept verbatim (it is why the case was written) under
a `⚠ CORRECTED (Phase 194 Plan 06, on measurement)` marker stating that the guard is
**defence-in-depth and a readable scope statement, NOT the thing preventing a vacuous pass**.
Crediting a fence with a rule it cannot see is precisely the 193.1 defect this project has now hit
twice; this is the third instance and it is caught before shipping rather than after.

### The slug fence is genuinely two-way, and derives BOTH sides

`test_the_written_slug_is_byte_identical_to_migration_119s_vocabulary` compares **greps of the two
files, never eyes**: the writers' slugs come from scanning every
`UPDATE workflow_phases SET status='…'` in the module; the constraint's from scanning
`'…'::text` literals **below `BEGIN;`** (the header prose quotes literals too and is excluded on
purpose). It asserts `constraint_literals == written | {"pending"}` — so a **misspelled slug** (P5)
fails it, and so would a **re-typed `ARRAY[…]` that silently drops a shipped literal** (mig 119
header rule 4 — the failure mode that would orphan every existing row using it).

⚠ **And the honest limit, stated because 194-02 flagged the analogous trap about its own green:
this fence asserts SOURCE agreement only. It cannot and does not claim migration 119 has been
APPLIED to any database.** Migration 119 is authored, not applied; the live gate is
`test_migration_119.py`, whose 3 skips below are correct and expected.

---

## Verification — every figure compared to `194-BASELINE.md`, never to RESEARCH or PATTERNS

| Gate | Baseline | Measured now | Verdict |
|---|---|---|---|
| (c) cancel-path pytest (the 4 baseline files) | **12 passed** | **12 passed** | ✅ unmoved |
| new suite `test_workflow_phase_cancel.py` | — | **14 passed** | ✅ (RED 14/0 → GREEN 14/0) |
| the 4 files + mig-119 gate + the new suite | — | **26 passed, 3 skipped** | ✅ (12 + 14; the 3 skips are mig 119 unapplied) |
| (d) backend unit rot | **62 failed / 2242 passed**, compared **BY NAME** | **62 failed / 2242 passed** | ✅ **0 NEW, 0 DISAPPEARED** |
| diff scope | only `files_modified` | `backend/app/db/workflows.py` + `backend/tests/test_workflow_phase_cancel.py` | ✅ |
| no caller wired | hits in `db/workflows.py` only | 3 hits, all in `db/workflows.py` (2 defs + 1 docstring cross-reference) | ✅ |

**The (d) comparison was done BY NAME and the mechanics are worth recording**, because the naive
version produced a false alarm. `pytest -q`'s `FAILED` lines carry a **truncated failure suffix**
(`… - ImportE...`), and one line had a `RuntimeWarning` glued directly onto the node id by output
interleaving. Compared raw, that reported **8 phantom "regressions" and 8 phantom "disappearances"**
— the same names on both sides. Re-compared on the bare `tests/unit/…::…` node id extracted by
regex: **62 names on each side, set-identical.** *A by-name comparison is only as good as its
parser, and this one had to be corrected before it was believed.*

⚠ **Frontend gates (a) and (b) were NOT run and that is a decision, not an omission.** This plan
touches **zero** frontend files (`git diff --numstat bdef9781 HEAD` names two backend paths), so the
count gate and `tsc` cannot move. Running them would have burned a vitest slot the phase's parallel
budget reserves for plans that can actually move them.

⚠ **No migration was applied to any database.** No `supabase db push`, no `db reset`, no SQL-editor
paste, no edit to `full-schema.sql`. `ls supabase/migrations/ | wc -l` is untouched by this plan.

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] The one-line-predicate fence was vacuous as written**
- **Found during:** Task 1, reading the RED run case-by-case (13 failed / **1 passed**)
- **Issue:** the fence searched the whole module for the predicate; `get_active_phase`'s shipped
  READ carries it byte-identically on one line, so the fence passed on a tree with neither writer.
- **Fix:** scoped to require the same source line to carry `UPDATE workflow_phases SET status='cancelled'`.
- **File:** `backend/tests/test_workflow_phase_cancel.py`
- **Commit:** `3c862fc1` (fixed before the RED gate was committed — the committed RED is 14/0)

**2. [Rule 2 — Honesty/correctness] The blindness-guard docstring overstated what it defends**
- **Found during:** Task 1, plant P8
- **Issue:** it claimed the scoped sweeps would pass vacuously without it; measured, they `KeyError`.
- **Fix:** correction recorded BESIDE the original under a `⚠ CORRECTED` marker; original kept verbatim.
- **File:** `backend/tests/test_workflow_phase_cancel.py`
- **Commit:** `660b3c3c`

**3. [Rule 3 — Tooling] The plant prober left a plant in production source when it crashed**
- **Found during:** Task 1, first prober run (`FileNotFoundError` on a relative interpreter path)
- **Issue:** the exception propagated before the revert, leaving P1 applied to
  `backend/app/db/workflows.py`. Caught immediately by an md5 + `git diff --numstat` check.
- **Fix:** source restored and md5-verified back to `e760fc67…`; the prober's revert moved into a
  `finally:` block and the interpreter switched to `sys.executable`. The prober was a throwaway at
  the repo root and was **deleted** before any commit — `git status` is clean and it appears in no
  commit.

### Not a deviation, but recorded

⚠ **`grep -c "WHERE workflow_run_id = $1 AND status = 'active'" backend/app/db/workflows.py`
returns 2, not 1.** The acceptance criterion asks for ≥ 1 and is satisfied — but the second hit is
`get_active_phase`'s **READ**, which has carried the identical predicate for phases. **The bare grep
is therefore not a discriminating needle**, which is exactly why the shipped fence requires the
`cancelled` UPDATE on the same line. Recorded so a later reader does not mistake the 2 for a
duplicate write.

⚠ **Line endings, stated because an md5 moved.** P8 wrote to the test file through Python, whose
`write_text` translates `\n` → CRLF on Windows, so the file's md5 changed (`3c9ef9be…` →
`237c68b2…`) while `git diff` reported **nothing**: `core.autocrlf=true`, the committed blob is LF,
and the working copy is now in git's own canonical checked-out form. Verified explicitly —
`bytes equal: False`, `LF-normalized equal: True`. No content moved.

---

## Threat model — dispositions honoured

| Threat ID | Disposition | How |
|---|---|---|
| T-194-06-01 (Tampering, `cancel_active_phases`) | mitigated | `$N` binds only; an AST walk over both function bodies (docstring stripped) rejects `JoinedStr`, `%`-`BinOp` and `.format` — driven RED by P4 |
| T-194-06-02 (Tampering, completed rows) | mitigated | `AND status = 'active'` is the mechanism; driven RED by P2 **independently of the key clause**. The call-site fence (V-18) is plan 194-09's |
| T-194-06-03 (EoP, cross-run writes) | mitigated | Both writers are keyed and take no user-supplied filter; both docstrings state they perform **no ownership check** and name the caller as the enforcer, the shape `_cancel_run_internals` already uses |
| T-194-06-04 (Repudiation) | mitigated | `updated_at=now()` written with the status in both, matching all five shipped writers |
| T-194-06-SC (pip installs) | n/a | **No package added.** No `requirements.txt` change; the suite imports only stdlib + pytest + the app module |

**No `GroundingBundle.degraded` surface is touched** — neither writer imports, reads or writes
anything in `harness/grounding.py`, so the red line about `degraded` feeding `/validate` and the
publish gauntlet is untouched by construction.

---

## Known Stubs

None. Both writers are complete; **no caller is wired, which is the plan's explicit non-goal**, not
a stub — plans 194-09 (engine arm) and 194-10 (zombie arm) call them.

## Threat Flags

None. This plan opens no network endpoint, no auth path, no file access and no schema change.

---

## Files

| File | Change |
|---|---|
| `backend/app/db/workflows.py` | +136 / −1 (the sixth writer + its run-keyed sibling + the `finish_run` docstring correction; the single deletion is the old docstring first line) |
| `backend/tests/test_workflow_phase_cancel.py` | new, 360 lines, 14 cases |

## Commits

- `3c862fc1` — `test(194-06): add failing writer-level cover for the two cancelled phase writers`
- `660b3c3c` — `feat(194-06): add cancel_phase and cancel_active_phases, the only two writers of 'cancelled'`
- `d69cd6ce` — `docs(194-06): correct finish_run's docstring BESIDE, not over`

## TDD Gate Compliance

RED (`test(…)` `3c862fc1`, 14 failed / 0 passed) → GREEN (`feat(…)` `660b3c3c`, 14 passed) → no
REFACTOR commit was owed. Both gates present and in order. The RED was read **case-by-case, not by
count** — which is the only reason the vacuous fence was caught.

## STATE / ROADMAP / REQUIREMENTS

**Untouched by design.** No `gsd-sdk query state.*`, no `roadmap.update-plan-progress`, no
`requirements.mark-complete` was invoked. `git diff --numstat bdef9781 HEAD` names exactly two
files, neither under `.planning/` (this SUMMARY excepted). Nothing auto-flipped a REQ-ID or a
roadmap checkbox, so nothing needed reverting.

## Self-Check: PASSED

- `backend/app/db/workflows.py` — FOUND
- `backend/tests/test_workflow_phase_cancel.py` — FOUND
- `3c862fc1` / `660b3c3c` / `d69cd6ce` — all FOUND in `git log`
- working tree clean (`git status --short` empty before this SUMMARY)
