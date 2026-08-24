---
phase: 194-stop-a-running-workflow
plan: 10
subsystem: backend-harness-engine
tags: [cancel, workflow-phases, RUN-01, SC#3, V-16, fences]
requires: ["194-01", "194-06"]
provides:
  - "backend/app/services/harness_engine.py — the in-flight phase terminalize inside the shielded cancel/escape cleanup, PHASE-KEYED on the phase_id bound in the same loop iteration, before the re-raise"
  - "validation row V-16"
  - "six RED-driven fences over the arm's keying, vocabulary and shape"
affects: ["194-12", "194-13"]
tech-stack:
  added: []
  patterns:
    - "shielded best-effort cleanup with its own try/except + logger.exception"
    - "AST-scoped source fences (never a bare grep — a grep matches the docblock)"
    - "value-scoped negative fences (never the module source)"
    - "per-clause plants — one plant per clause, because `assert` short-circuits"
    - "save-and-restore of a leaked process global, never a hard reset"
key-files:
  created: []
  modified:
    - backend/app/services/harness_engine.py
    - backend/tests/test_harness_engine.py
decisions:
  - "The new write sits INSIDE the shipped 096-09 `if not is_app_shutting_down():` scope — a phase left `active` on a run the boot sweep will RESUME is correct, because that phase really is still pending work. Stated in the comment with its reasoning, and fenced by a plant that hoists it out."
  - "PHASE-KEYED `cancel_phase(pool, phase_id)`, never the run-keyed sibling — the engine arm is the only home that can distinguish the phase the user interrupted from a row that happens to be `active`."
  - "`cancel_workflow_run_internals` is deliberately NOT called here; the dispatch brief's seam rule targets the no-producer arm (194-11). Calling a run-keyed composition on this arm would defeat home A and violate the plan's non-goals."
metrics:
  tasks: 2
  commits: 3
  duration: ~70m
  completed: 2026-08-16
---

# Phase 194 Plan 10: the engine cancel arm's interrupted-phase terminalize Summary

When a live producer is Stopped mid-phase, the phase **the user actually interrupted** now reads
`cancelled` — identified **without a query**, because `phase_id` is already bound in the same loop
iteration. One shielded write, inside the shipped cleanup, before the re-raise.

---

## Base assertion — the wrong-base streak continued and is now 7 out of 7 in this phase

```
git rev-parse --abbrev-ref HEAD              → worktree-agent-aaf095efcec5e2549   (namespace OK)
git rev-parse HEAD                           → fda792141b0129de7b15dd40ddc1082e76f95a2a
git merge-base HEAD e62d140a                 → 3781a3fe4690a9619e619f4cc412bd37a7dafc52   ✗ WRONG BASE
git reset --hard e62d140a                    → HEAD is now at e62d140a chore: merge executor worktree (194-08)
git rev-parse HEAD                           → e62d140ace1b2eb970b8d62e2e3dacd1ce0d9cc0   ✓ BASE OK
```

Same wrong base (`3781a3fe`) every worktree in this phase has forked from — the dispatch brief
predicted it, and it happened again. `bootstrap-worktree.sh` ran as the **first** action and
reported `BOOTSTRAP OK` (both junctions attached, both env files copied).

⚠ **The plan's `<context>` names `d2a3b51b` as the base; the dispatched base is `e62d140a`.** The
dispatch brief is authoritative — 194-02, -03, -04, -06, -08 and -09 have merged since — and
`d2a3b51b` is an ancestor of `e62d140a`, so the plan's assertion is *satisfied, not violated*. The
newer commit is named beside the older one rather than the older being silently reused.

---

## ⚠ AN APPARENT CONFLICT BETWEEN THE DISPATCH BRIEF AND THE PLAN — RESOLVED BY READING, NOT BY CHOOSING

The brief says, in bold: *"USE THE SEAM PLAN 194-09 SHIPPED FOR YOU … call
`cancel_workflow_run_internals`. Do NOT re-compose `finish_run` + `cancel_active_phases`."* The
plan's `<non_goals>` say the opposite-sounding thing: *"Do NOT call `finish_run` here"*, *"Do NOT
terminalize in bulk"*, and its `key_links` require `cancel_phase(pool, phase_id`.

**They do not actually conflict, and the resolution is structural rather than a preference.** The
194-09 seam is the **run-keyed** composition for the **engineless** arm — the zombie / no-producer
path, which has no engine, no loop and no `phase_id` at all. That arm is **plan 194-11's**
(`api/runs.py`), not this one. This plan is RESEARCH § G-C's **home A**, whose entire reason to
exist is that it knows *which* phase the user interrupted **without a query**; calling a run-keyed
composition here would mark whatever happens to be `active` and would additionally issue a second
`workflow_runs` write on an arm the producer's F2 block already terminalizes.

**The brief's actual prohibition is honoured in full: nothing in this plan re-composes `finish_run`
+ `cancel_active_phases`.** `grep -c "finish_run\|cancel_active_phases"` inside the added lines is
**0**. What the plan asked for was built, and the reasoning is recorded here rather than left for a
reviewer to reconstruct.

---

## What was built

### Task 1 — the terminalize (TDD: RED `af8cc441` → GREEN `db9caf7e`)

**42 insertions / 0 deletions** in `harness_engine.py`, in exactly two hunks
(`git diff -U0 | grep "^@@"`):

| Hunk | What |
|---|---|
| `@@ -53,0 +54 @@` | `cancel_phase,` joins the existing `from app.db.workflows import (…)` block, in alphabetical position |
| `@@ -1643,0 +1645,41 @@` | the new statement + its recorded reasoning, inside the cancel arm, **before** the trailing `raise` |

```python
                try:
                    await asyncio.shield(cancel_phase(pool, phase_id))
                except BaseException:  # noqa: BLE001 — second cancel mid-cleanup
                    logger.exception(
                        "interrupted-phase terminalize failed on cancel/escape "
                        "for run %s phase %s",
                        run_id, phase_id,
                    )
            raise
```

**The three mechanisms the plan required, each a mechanism rather than a convention:**

1. **`asyncio.shield` + its own `try/except` + `logger.exception`** — cancellation is already in
   flight; an unshielded await would be cancelled **before** it wrote. Same discipline as the
   shipped `_expire_pending_ask_user` call it sits beside.
2. **The `raise` stays LAST** — asserted behaviourally (three cases) *and* structurally (the AST
   fence reads the handler's final statement), and driven RED by two independent plants.
3. **The 096-09 gate is neither moved, duplicated nor removed** — `grep -c "is_app_shutting_down"`
   is **4 before and 4 after**.

### ⚠ THE GRACEFUL-SHUTDOWN DECISION, STATED RATHER THAN INHERITED (the plan required an explicit call)

**The new write is INSIDE the `if not is_app_shutting_down():` scope**, and the reason is written
into the comment beside it: on a graceful shutdown the run stays resumable and the boot sweep
re-claims it, so a phase row left `active` is **correct** — that phase really is still pending work,
and terminalizing it would strand a resumable run with a dead step. A user Stop / crash / timeout
(flag `False`) terminalizes exactly as SC#3 requires.

⚠ **The plan warned that RESEARCH's no-gate answer for Step 3b does NOT transfer here, and my
reading of the code AGREES with the plan** — so there was nothing to stop and report. The two arms
differ in the way that matters: Step 3b runs when the producer task is already **gone** (no resume
is coming), while this arm runs *because* the producer is being cancelled, including by the graceful
shutdown that is about to hand the run to the boot sweep.

### Task 2 — the fences (`c99a7003`)

Three fences added on top of Task 1's five behavioural cases:

| Fence | Scope | What it holds |
|---|---|---|
| **F-5** | recorded SQL + binds | (a) no cancel write carries `workflow_run_id` or binds the run_id; (b) the completed and pending rows' ids appear in **no** recorded write at all, while the interrupted one does |
| **F-6** | the composed **VALUE** | the write carries migration 119's slug and never `failed`/`skipped`, with the expected slug **derived** as 119's literals **minus** 115's (scoped below `BEGIN;`) |
| **F-S** | the AST | the call is inside `asyncio.shield`, inside its **own** `try/except` that `logger.exception`s, in the `except BaseException` arm, whose **last** statement is a bare `raise` |

---

## Fences — SIX RED observations, every one against a REAL production-source plant

Every plant was applied to `harness_engine.py` (production source), the suite run, and the plant
reverted **inside a `finally:`** — the 194-06 lesson, where a prober crashed before its revert and
left a plant behind. The file was md5-verified after every single run.

**md5 of `backend/app/services/harness_engine.py` before every plant and after every revert:
`9a3edbb94245cdf38485b9f1cbea5055` — identical on all six.**

| # | Plant (real, in production source) | Cases that RED | Clause proved |
|---|---|---|---|
| **P1** | the RUN-KEYED terminalize — `cancel_active_phases(pool, run_id)` swapped in, import and all ("unify the two writers") | 5 failed / 53 passed: the V-16 case, the cleanup-failure case, the AST call-site case, **F-5** and **F-S** | F-5 clause **(a)** — `'workflow_run_id' is contained here: … WHERE workflow_run_id = $1 AND status = 'active'` |
| **P2** | the write UNSHIELDED **and** `raise` → `return` | 4 failed / 54 passed: propagation, shutdown, cleanup-failure, **F-S** | F-S **shield** clause — *"the phase terminalize is NOT wrapped in asyncio.shield"* |
| **P5** | ONLY `raise` → `return` (the shield left intact) | 4 failed / 54 passed — same four | F-S **raise-last** clause — *"Last statement is Return."* |
| **P3** | `fail_phase(pool, phase_id, "stopped")` instead of the cancel write — the vocabulary D-04 rejected | 7 failed / 51 passed, incl. **F-6** | F-6 **value** clause — `SQL="UPDATE workflow_phases SET status='failed', …"` |
| **P4** | the write HOISTED OUT of the `if not is_app_shutting_down():` scope | **1** failed / 57 passed — the graceful-shutdown case **alone** | the 096-09 scope clause |
| **P6** | the write keyed on `ordered[0]["id"]` (a COMPLETED row) instead of the loop's `phase_id` | 2 failed / 56 deselected: V-16 and **F-5** | F-5 clause **(b)** — *"the COMPLETED phase row was named in a write"* |

### ⚠ WHY SIX PLANTS WHERE THE PLAN REQUIRED TWO — and it is not thoroughness for its own sake

`assert` **short-circuits**, so a pytest run proves only that the FIRST failing clause fires (the
193.2 lesson, re-learned here). The plan's two plants would have left **four clauses unproved and
indistinguishable from inert**:

- **P2 reds F-S on the SHIELD clause and never reaches the raise-last clause** → **P5** isolates it.
- **P1 reds F-5 clause (a) and leaves clause (b) GREEN** → **P6** isolates it. This matters because
  the two are different defects: a run-keyed write is a bulk terminalize; a read-then-update on a
  queried id would leave (a) green and red (b).
- **F-6 has no plant at all in the plan** (the vocabulary fence would have shipped with no RED
  observation) → **P3**.
- **The shutdown case was correctly GREEN on the TDD RED run** and would otherwise have shipped with
  nothing proving it can fail → **P4**, which reds it **alone**.

This is the phase's own lesson #1 applied: *194-03's four REQUIRED plants all red on the SAME
clause, which would have shipped a second clause inert.*

### ⚠ A CASE THAT WAS CORRECTLY GREEN ON THE RED RUN — read case-by-case, never by count

Task 1's RED was **4 failed / 1 passed**. The passing one,
`test_a_graceful_shutdown_leaves_the_prompt_and_the_phase_row_resumable`, asserts the **ABSENCE** of
a cancel write, which was trivially true before the write existed. That is correct behaviour for a
regression pin, not a vacuous fence — and rather than leave a later reader to work that out, **the
fact is written into the case's own docstring**, together with the note that it was driven RED
afterwards by P4. (194-09 recorded the identical shape; 194-06 caught a genuinely vacuous fence this
same way.)

### ⚠ EVERY SOURCE FENCE IS AST-PARSED, BECAUSE A BARE `grep` MATCHES MY OWN DOCBLOCK

That trap has now tripped 194-02 (twice), 194-03, 194-06 and 194-09 — the last of them in production
source. My arm's comment legitimately names `cancel_active_phases`, `fail_phase`, `skip_phase`,
`cancelled`, `failed` and `skipped` in prose, and the module names the two writers in **code** three
lines below the arm. So:

- the call-site fences count real `ast.Call` nodes, never text;
- **F-6 is scoped over the composed VALUE**, never the module source — and the scope is **checked
  in-fence rather than assumed**: the case asserts `fail_phase` and `skip_phase` are **still present
  in the source** while the composed values contain neither, so if that premise ever disappears the
  fence fails loudly instead of quietly becoming a tautology (the 194-09 F-6 pattern).

### Anti-vacuity controls, because a fence that cannot see anything passes green

- The AST call-counter is shown to **find** a call known to exist (`fail_phase`) and to **return 0**
  for a name that does not, before its 1/0 verdict on `cancel_phase` is believed.
- The shield-shape detector is shown to find the **shipped** `asyncio.shield(_expire_pending_ask_user(…))`
  with the identical walk — a detector that could not see the shipped call would prove nothing about
  the new one.
- Both source sweeps assert the files read are non-empty (>10 KB) — the 194-03 empty-sweep lesson.
- The cleanup-failure case asserts the failing write was **ATTEMPTED** (a pool that silently dropped
  it would make the case vacuous), and F-5 asserts the interrupted row **was** named, so clause (b)
  cannot pass by nothing happening at all.

### ⚠ THE `_APP_SHUTTING_DOWN` CROSS-TEST LEAK IS HONOURED, NOT EXPLOITED

194-09 measured that the shared `client` fixture (`with TestClient(app)`) runs the lifespan shutdown
on teardown and leaves the process-global `True` **for the rest of the pytest process**. My driver
therefore sets the flag explicitly for **every** case — including the non-shutdown ones, which would
otherwise have silently taken the graceful-shutdown branch and asserted nothing — and **restores the
PRIOR value** rather than hard-resetting to `False`. A fence that repaired global state other suites
run in would be changing the thing it measures. The reasoning is in the driver's docstring.

---

## Verification — every figure compared to `194-BASELINE.md`, never to RESEARCH or PATTERNS

| Gate | Baseline / expected | Measured now | Verdict |
|---|---|---|---|
| `pytest tests/test_harness_engine.py` | 55 passed at my base | **58 passed** (+3 fences; +5 cases total, 55 → 58 after the two commits) | ✅ every shipped case green, **no assertion edited** |
| the 6 cancel-path + phase suites (brief's figure) | **38 passed / 3 skipped** | **38** (96 total − 58 engine) **/ 3 skipped** | ✅ unmoved; the 3 skips are migration 119 unapplied |
| (d) backend unit rot, **BY NAME** | **62 failed / 2242 passed** | **62 failed / 2242 passed** | ✅ **0 NEW, 0 DISAPPEARED — set-identical** |
| `grep -c "is_app_shutting_down" harness_engine.py` | 4 (pre-change) | **4** | ✅ neither duplicated nor removed |
| `grep -c "cancel_phase(pool, phase_id" harness_engine.py` | — | **1** | ✅ exactly one |
| `git diff -U0` hunk positions | none in the `fail_run` or any other outcome arm | hunks at **`+54`** and **`+1645`** only (the `fail_run` arm starts at old `:1646`) | ✅ |
| `git diff --numstat` on `run_producer.py` / `run_lifecycle.py` / `api/runs.py` / `db/workflows.py` | empty | **empty** | ✅ |
| deletions in production source | — | **0** | ✅ no shipped line moved |
| plan-wide diff | only `files_modified` | `harness_engine.py` **+42/−0**, `test_harness_engine.py` **+552/−0** | ✅ two declared files |

**The (d) comparison parses `194-BASELINE.md` § (d)'s published 62 names directly** — never a
re-run, which would be circular. ⚠ **The comparator's parser was written defensively against BOTH
spellings of this phase's own trap**: 194-06's truncated ` - ImportE…` suffixes, and 194-09's
interleaved Windows path glued onto a node id. It cuts at ` - `, at a drive-letter pattern and at
whitespace, and it reports the parsed COUNTS on both sides (62 / 62) so a silently-empty parse
cannot read as agreement.

⚠ **Frontend gates (a) and (b) were NOT run, and that is a decision.** This plan touches **zero**
frontend files (`git diff --numstat e62d140a HEAD` names two backend paths), so the count gate and
`tsc` cannot move; running them would burn a vitest slot the phase's parallel budget reserves for
plans that can move them, and `CLAUDE.md` records that the cap-2 gate goes non-deterministic with
concurrent agents.

⚠ **No migration was applied to any database.** No `supabase db push`, no `db reset`, no SQL-editor
paste, no edit to `full-schema.sql`. **No test in this plan seeds or mutates any table** — the pool
is the conftest recorder (or a proxy over it) in every case, and the two migration files are read as
**text**. That is what keeps it parallel-safe under CLAUDE.md rule 4 with a sibling agent active.

---

## Deviations from Plan

### Auto-fixed / auto-added

**1. [Rule 2 — Missing critical fence coverage] Four more plants than the plan required**

- **Found during:** Task 2, reading each RED run case-by-case instead of by count.
- **Issue:** the plan's two plants leave four clauses with **no** RED observation — `assert`
  short-circuits, so P2 could only ever prove F-S's first clause, and P1 could only ever prove F-5's
  first clause. F-6 had no plant at all, and the shutdown case had none either.
- **Fix:** P3 (vocabulary), P4 (gate escape), P5 (raise-last isolated), P6 (clause (b) isolated).
  Every one reds a clause no other plant reaches.
- **Why this is the right resolution:** this project has shipped five inert fences in 193.2, four in
  193.1, three in 192.1 and five in 190 — **all caught by planting, none by reading**. A fence with
  no RED observation is a claim.
- **Files:** none (plants are transient, reverted md5-identical) — the extra fences live in
  `backend/tests/test_harness_engine.py`.
- **Commit:** `c99a7003`

**2. [Rule 2 — Correctness] The non-shutdown cases set the leaked global explicitly**

- **Found during:** Task 1, applying 194-09's measured `_APP_SHUTTING_DOWN` leak.
- **Issue:** a case that *assumed* the flag was `False` would take the graceful-shutdown branch in
  any process where a `client` fixture had already torn down, and would then assert nothing.
- **Fix:** the driver sets the flag for every case and **restores the prior value**.
- **Commit:** `af8cc441`

### Not a deviation, but recorded

⚠ **The plan's `<verification>` asks whether the `is_app_shutting_down` count is unchanged; it is
(4 → 4) — but note the needle is NOT discriminating in this file the way 194-09 made it in
`run_lifecycle.py`.** `harness_engine.py` legitimately names the identifier in code **and** in two
docblocks, so the count is a *stability* check, not an absence check. Stated so a later reader does
not over-read it.

---

## Hot-file ledger measurement for `backend/app/services/harness_engine.py` (handed to plan 194-13)

`harness_engine.py` is **not** a row in `CLAUDE.md`'s ledger. Derived here so 194-13 inherits a
measurement rather than re-deriving one — *a hot file missing from the table is permanently
invisible to its own guardrail*, which is how `WorkflowsPage.tsx` escaped G-5 for ten phases,
`WorkflowDoorSwitch.tsx` for six and `WorkflowBuilderPage.tsx` for ten.

```
git log --oneline -- backend/app/services/harness_engine.py | wc -l                  → 45
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E 's/-.*//' | sort -u
    → 091 092 093 094 096 098 099 101.1 102 120 152 163 185 187 189 194 quick   (17 buckets)
wc -l <file>                                                                         → 2536
git show e62d140a:<file> | wc -l                                                     → 2494
```

> **⇒ `45 commits / 16 phases / 2536 L` (2494 at this plan's base `e62d140a`).**
>
> ⚠ **THE NON-PHASE BUCKET IS NAMED RATHER THAN MERELY SUBTRACTED: `quick` IS NOT A PHASE.** It
> comes from `fix(quick-260731-3y4): allow-list the armed approval path — close T-185-04-01`, a
> QUICK TASK. **The raw recipe prints 17 buckets; the PHASE count is 16. Both are recorded, the
> loser beside the winner** — because the next reader will run the same command and see the 17.
> (`WorkflowBuilderPage.tsx`, `api/workflows.py`, `publish_service.py` and `builderStore.ts` all
> document the identical trap about their own recipes.)
>
> **G-5 FIRES HARD — 16 phases against a threshold of 3, making this the FOURTH-hottest backend file
> measured in this repository, after `phase_types.py` (14 phases / 35 commits at the 190 reading),
> `db/workflows.py` (17) and `api/workflows.py` (17) — and it was ABSENT FROM THE LEDGER.**
>
> **Honoured BY CONSTRUCTION in this plan, on a measured test rather than an argument: the file
> gains NO second concern.** It already owns the cancel/escape arm and already performs a
> phase-terminalize-then-run composition **three lines below** (`fail_phase` → `finish_run`, the
> `fail_run` arm). This plan adds **one statement of the shape the arm's neighbour already uses**,
> at **42 insertions / 0 DELETIONS** — and zero deletions is what proves no shipped arm moved.
>
> **The natural seam, named rather than implied:** `run_workflow`'s ~500-line phase loop versus
> `_run_phase_with_gates`' retry/gate machinery versus the armed-checkpoint block versus the
> boot-time resume sweep (`resume_stranded_workflows`) — four concerns in one module. **The next
> phase adding a genuinely SECOND concern here owes a refactor recommendation FIRST, and it
> inherits `45 / 16 / 2536`.** ⚠ These three numbers go stale on the next commit that touches the
> file, which can be the same afternoon.

⚠ **This SUMMARY does not edit the `CLAUDE.md` row** — that file is not in this plan's
`files_modified`, and Phase 194's ledger deliverable (D-02) is plan 194-13's.

---

## Threat model — dispositions honoured

| Threat ID | Disposition | How |
|---|---|---|
| T-194-10-01 (Tampering, completed phase rows) | **mitigated** | The write is PHASE-KEYED on the `phase_id` bound in this loop iteration — it cannot reach a completed row by construction. Fenced by F-5 in **two independently-driven clauses**: P1 (run-keyed plant) reds (a); P6 (wrong-row plant) reds (b). |
| T-194-10-02 (Repudiation, restart-resumability) | **mitigated** | `grep -c "is_app_shutting_down"` is 4 before and after; the placement relative to the gate is a **stated** decision with its reasoning in the comment, and P4 proves the graceful-shutdown fence can fire. |
| T-194-10-03 (DoS, the cancellation itself) | **mitigated** | `asyncio.shield` + its own `try/except` + `logger.exception`; the `raise` stays last. Driven RED by P2 (shield) and P5 (raise-last) independently, plus a behavioural case in which the write itself raises. |
| T-194-10-04 (Tampering, a paused approval) | **mitigated** | `_expire_pending_ask_user` is byte-untouched — still shielded, still gated, still first. `git diff` shows **0 deletions**, so no line of it moved. |
| T-194-10-05 (Info disclosure, error paths) | **mitigated** | `logger.exception` with the run id and phase id **only** — no phase `output`, no prompt, no provider payload. |
| T-194-10-SC (pip installs) | **n/a** | **No package added.** No `requirements.txt` change; the new tests import only stdlib (`ast`, `asyncio`, `pathlib`, `re`) + pytest + app modules. |

**No `GroundingBundle.degraded` surface is touched** — nothing here imports, reads or writes
anything in `harness/grounding.py`, so the red line about `degraded` feeding `/validate` and the
publish gauntlet is untouched by construction.

---

## Known Stubs

None. The arm is complete on the live-producer path. The **engineless** arm is plan 194-11's
(`api/runs.py` + the 194-09 seam) and is this plan's explicit non-goal, not a stub.

⚠ **One honest limit, stated rather than discovered later:** the write cannot land in a real database
until **migration 119 is applied** — it is authored but NOT applied, so the live six-literal
`workflow_phases_status_check` would refuse `cancelled` with SQLSTATE 23514. Every test here drives a
mocked pool, so nothing in this plan is evidence that the constraint accepts the value; the three
skipped `test_migration_119.py` cases are, and they green-skip until applied. **That skip must never
be quoted later as though it ran.**

## Threat Flags

None. This plan opens no network endpoint, adds no auth path, no file access and no schema change.

---

## Files

| File | Change |
|---|---|
| `backend/app/services/harness_engine.py` | **+42 / −0** (one import name; one shielded, self-guarded statement + its recorded reasoning inside the shipped cancel arm) |
| `backend/tests/test_harness_engine.py` | **+552 / −0** (5 behavioural cases + 3 fences + the drive helper, the failing-write pool proxy and the migration-literal deriver) |

**Zero deletions across the whole plan** — no shipped assertion and no shipped line was edited.

## Commits

- `af8cc441` — `test(194-10): add failing cover for the engine cancel arm's phase terminalize`
- `db9caf7e` — `feat(194-10): terminalize the interrupted phase on the engine cancel arm`
- `c99a7003` — `test(194-10): fence the cancel arm — phase-keying, vocabulary and shape`

## TDD Gate Compliance

RED (`test(…)` `af8cc441`, **4 failed / 1 passed** — read case-by-case; the 5th is the shutdown
regression pin, correctly green before the change and driven RED later by P4) → GREEN (`feat(…)`
`db9caf7e`, 5 passed) → no REFACTOR commit was owed. Both gates present and in order. Task 2 is a
pure-fence task whose RED evidence is the six production-source plants above rather than a
failing-first commit — each fence was observed to FAIL against a real defect and then to pass on the
restored tree.

## STATE / ROADMAP / REQUIREMENTS

**Untouched by design.** No `gsd-sdk query state.*`, no `roadmap.update-plan-progress`, no
`requirements.mark-complete` was invoked. `git diff --numstat e62d140a HEAD` names exactly two files,
both under `backend/` (this SUMMARY excepted). Nothing auto-flipped a REQ-ID or a roadmap checkbox,
so nothing needed reverting.

## Self-Check: PASSED

- `backend/app/services/harness_engine.py` — FOUND
- `backend/tests/test_harness_engine.py` — FOUND
- `af8cc441` / `db9caf7e` / `c99a7003` — all FOUND in `git log`
- working tree clean before this SUMMARY (`git status --short` empty), and
  `harness_engine.py` md5 `9a3edbb94245cdf38485b9f1cbea5055` — identical to its pre-plant state after
  all six plants
