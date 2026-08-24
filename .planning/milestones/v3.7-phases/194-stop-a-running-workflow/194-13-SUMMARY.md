---
phase: 194-stop-a-running-workflow
plan: 13
subsystem: data-heal + ledger
tags: [heal, receipt, RUN-01, SC#2, SC#3, V-20, g-5, hot-file-ledger, D-12, D-17]
requires: ["194-06", "194-09", "194-10", "194-11", "194-12"]
provides:
  - "194-HEAL-RECEIPT.md — a committed before/after receipt for five healed rows and two cleared thread anchors, naming the instrument PER ROW"
  - "the two historically stuck workflow_runs rows terminalized through the composition this phase built"
  - "the two orphan workflow_phases rows terminalized by id-scoped one-off writes"
  - "four NEW CLAUDE.md hot-file ledger rows + one re-derived cell, so Phase 195 inherits measurements instead of a re-derivation it does not know it owes"
affects: ["195", "194-05", "194-07"]
tech-stack:
  added: []
  patterns:
    - "verify a never-raising writer by RE-READING the row, never by absence of an exception"
    - "id-scoped writes with a rowcount==1 assertion inside a transaction that rolls back otherwise"
    - "prove 'no other row moved' by ENUMERATION over updated_at, never by histogram arithmetic"
    - "record the prediction BEFORE the write so the after column is compared, not fitted"
    - "correct-beside-not-over"
key-files:
  created:
    - .planning/phases/194-stop-a-running-workflow/194-HEAL-RECEIPT.md
  modified:
    - CLAUDE.md
decisions:
  - "The HTTP route was NOT driven — no legitimate token for the owning user was obtainable, and forging/minting/bypassing one was refused. The exported composition was used instead and the instrument is named PER ROW."
  - "FIVE rows moved, not the plan's four — healing A2 through the shipped path also terminalizes its interrupted phase, which is SC#3 working rather than a scope violation."
  - "No distinguishing marker was written for the healed golden run: workflow_runs HAS NO error column, and a second migration for a one-off is what D-17 forbids. The committed receipt is the audit note."
  - "RunCard.tsx gets NO ledger row — measured, Phase 194 never touched it, and this plan's non-goals forbid a row for an untouched file."
metrics:
  tasks: 3
  commits: 3
  duration: ~70m
  completed: 2026-08-16
---

# Phase 194 Plan 13: the data heal + the ledger debt Summary

Five rows that had been lying about being live since **2026-06-14**, **2026-08-01** and
**2026-07-18** are now terminal, with a committed before/after receipt naming the instrument **per
row** — and every hot file this phase touched is a `CLAUDE.md` ledger row measured at this commit.

**The two run rows were healed through the composition this phase built**, so the receipt evidences
SC#2's server-side half on real data rather than an operator's SQL. **A fifth row moved as a
consequence, and that is SC#3 working.**

---

## What was done

| Task | Commit | What |
|---|---|---|
| 1 | `8aeefbb8` | BEFORE column: five queries verbatim, the per-row table D-12 requires, the 3-vs-2 resolution, and the route's arm measured read-only |
| 2 | `72e81c1e` | The heal: 2 run rows + 2 orphan phase rows + 1 consequence row + 2 anchors, with the AFTER column and a per-row BEFORE→AFTER table |
| 3 | `dc4871a7` | Four NEW ledger rows, one re-derived cell, the declined-override verification, and the receipt's `## Ledger` section |

---

## ⚠ THE INSTRUMENT IS NAMED PER ROW, BECAUSE THE ALTERNATIVE IS THE FALSE CLAIM D-12 EXISTS TO PREVENT

**The HTTP route `DELETE /runs/{workflow_run_id}` was NOT driven.** The two run rows were healed by
calling `run_lifecycle.cancel_workflow_run_internals(*, pool, workflow_run_id)` **directly**, once
per id.

**Why, measured rather than asserted.** The backend was up (`GET /health → 200`) and the route's
authentication guard was verified **live and left intact**:

```
DELETE /runs/fde3bbe3-…  (no Authorization)  ->  403  {"detail":"Not authenticated"}
```

The route requires a Supabase user JWT for the owning user `d8a54002-…`, and no legitimate token for
that user was obtainable in this session. ⛔ **No authentication was forged, minted, impersonated or
bypassed; no dependency was overridden; no guard was relaxed, weakened or deleted to make a call
succeed.** Reading `backend/.env` for the project's sanctioned `EVAL_TEST_*` sign-in credentials was
**denied by the permission system**, and that denial was honoured rather than worked around.

**What this evidences, and what it does NOT.** `cancel_workflow_run_internals` **is** the shared
writer this phase built (`194-09`) and **is exactly what the route's no-live-producer arm calls** —
one composition, two callers (D-08/D-10). So the heal evidences **the composition**, and with it
SC#2's server-side half and SC#3's phase terminalize, **on real data for the first time in this
phase**. It does **not** evidence the HTTP layer above it: the dual-id fallback's three
authorization clauses, the forward resolution, `publish_cancel_sentinel` and the `204` were **not
exercised**. Their RED-driven evidence is `194-11`'s six production-source plants. ⚠ **The two
`204` responses the plan's acceptance criteria ask for DO NOT EXIST and are not claimed.**

**The one thing measured about the route rather than assumed:** its forward-resolution SQL
(`api/runs.py:1264-1270`) was executed **verbatim, read-only**, against both ids and returned
`producer_id IS NULL` for both — so **the arm that would have run IS the arm whose writer was
called.** The three authorization clauses were likewise read against the live data and all three
admit both rows for the owning user. The instrument differs from the route; the write does not.

---

## ⚠ FIVE ROWS MOVED, NOT THE PLAN'S FOUR — AND THE FIFTH IS THE BEST EVIDENCE IN THIS PLAN

`194-MIGRATION-RECEIPT.md` carried forward an unresolved discrepancy: `workflow_phases` held
**THREE** `active` rows against `194-CONTEXT.md` D-17's **TWO**. It was measured rather than assumed
away.

**Verdict: D-17 is correct AND `194-12`'s three is correct — they count different things.** The two
orphans are `961c290d` and `9e6acf54`, both `confirm`, both under runs already terminally `failed`.
The third, `0e0cf57c` (`summarize`), sits under `4b0feda7` — **one of the two stuck runs being
healed**. It is not a third orphan; it is **that run's interrupted phase**.

⇒ **The plan's acceptance criterion *"the histograms show exactly four rows moved"* is wrong as
written, and correct behaviour fails it.** Healing `4b0feda7` through the shipped composition must
also terminalize `0e0cf57c`, because `cancel_workflow_run_internals` calls `cancel_active_phases` on
the run it just finished. **That is SC#3 working on live data — the strongest evidence this phase
has for it — not a scope violation.** The corrected expectation (five rows + two anchors) was
**written down BEFORE the write**, so the after column was compared to it rather than fitted to it.

| row | table | BEFORE | AFTER | instrument |
|---|---|---|---|---|
| A1 `fde3bbe3` | `workflow_runs` | `active` | `cancelled` | the exported composition |
| A2 `4b0feda7` ⚠ `is_golden_run` | `workflow_runs` | `active` | `cancelled` | the exported composition |
| C1 `0e0cf57c` | `workflow_phases` | `active` | `cancelled` | **none of its own** — a consequence of A2 |
| B1 `961c290d` | `workflow_phases` | `active` | `cancelled` | one id-scoped `UPDATE`, `rowcount = 1` |
| B2 `9e6acf54` | `workflow_phases` | `active` | `cancelled` | one id-scoped `UPDATE`, `rowcount = 1` |
| `4bf89cbc` | `threads` | anchor set | `NULL` | `finish_run`'s own transaction |
| `e52a19f7` | `threads` | anchor set | `NULL` | `finish_run`'s own transaction |

**Zero divergence from the prediction.** `workflow_runs` `active` 0 / `cancelled` 2 ·
`workflow_phases` `active` 0 / `cancelled` 3, total still 496 · threads holding an anchor 0 · the
`runs` histogram **byte-identical**.

---

## Three properties observed on REAL data for the first time, worth more than the heal itself

1. ⚠ **`AND status = 'active'` held in BOTH directions, on rows nobody constructed.** A2's
   `research` phase was **`completed` and stayed `completed`**; A1's two phases were **`pending` and
   stayed `pending`**. That clause is the only thing between `cancel_active_phases` and a bulk
   terminalize (D-07); `194-09`'s F-5 drove it RED against a widened-predicate plant, and here it was
   watched holding against live rows whose outputs are already durable.
2. ⚠ **`finish_run`'s status write and its anchor clear landed in ONE transaction, PROVED rather
   than quoted from the docstring:** the thread row's `updated_at` is **byte-identical** to its run
   row's — `05:59:33.756251+00` for the A1 pair, `05:59:33.777865+00` for the A2 pair. Two separate
   transactions could not produce identical microseconds.
3. ⚠ **A never-raising writer was verified by RE-READING, never by a clean return.**
   `cancel_workflow_run_internals` swallows by contract (D-062-13), so a clean return proves nothing.
   Every row was re-read, and a `WARNING`/`ERROR` log handler was attached for the whole drive:
   **0 records captured.**

**"No other row moved" was proved by ENUMERATION, not arithmetic.** Histograms can only prove a
*net*; a row that moved without changing status is invisible to them. Every `workflow_runs`,
`workflow_phases` and `threads` row with `updated_at` inside the window was listed: **2 + 3 + 2**,
every id one of the seven above, and **0** `runs` rows touched.

---

## Deviations from Plan

### Auto-fixed / auto-corrected

**1. [Rule 1 — Bug in the plan's stated mechanism] Group B's `terminal_noop` reason is FALSE**

- **Found during:** Task 2, before writing the two orphan rows.
- **Issue:** the plan states, twice and in its acceptance criteria, that `DELETE /runs/{id}` cannot
  reach the orphans because *"their parent runs are already terminally `failed`, so it takes Step 2
  `terminal_noop`"*. Driven read-only against both parent-run ids, that is **not the mechanism**:
  there is **no `runs` row at either id at all**, so Step 1 misses and the `194-11` fallback engages;
  clauses (a) and (b) both PASS; **clause (c) fails — both parent threads hold a NULL anchor** — and
  the request returns **404**. It never reaches Step 2, so it never reaches `terminal_noop`.
- **Fix:** the plan's *conclusion* (a one-off write is the only instrument) is correct and stands; its
  stated mechanism is recorded **beside** the measured one, never over it. The receipt carries the
  clause-by-clause trace.
- **Why this matters rather than being pedantry:** the next reader would go looking for a
  `terminal_noop` that never executes.

**2. [Rule 2 — Missing critical reasoning] A THIRD, stronger reason the path must not be used**

- **Found during:** Task 2, reading `cancel_workflow_run_internals` before choosing an instrument.
- **Issue:** neither the plan nor RESEARCH names the decisive reason. The composition calls
  `finish_run(pool, wf_id, "cancelled")` **unconditionally on the run row**. Driven against
  `5aa42b6b` or `e0d1f740` it would overwrite a **truthful `failed`** with `cancelled` — destroying
  two accurate terminal records in order to repair two phase rows. **The run rows are not lying; only
  their phase rows are.**
- **Fix:** recorded in the receipt's Method section. A phase-scoped write is the only instrument that
  repairs the lie without manufacturing a new one.

**3. [Rule 2 — Correctness] `RunCard.tsx` gets NO ledger row, against Task 3(a)'s instruction**

- **Found during:** Task 3, deriving the triples.
- **Issue:** Task 3(a) names `RunCard.tsx` as one of *"the three ledger cells this phase touched"*.
  **Measured, Phase 194 has not touched it:** `git log --oneline 743965a1..HEAD -- <file>` is
  **EMPTY** and its line count is unmoved at 550. This plan's own non-goals say ⛔ *"Do not add a
  ledger row for a file this phase did not touch."*
- **Fix:** no row written; its triple **`20 / 8 / 550`** is recorded in the receipt's `## Ledger`
  section, with the owners **named**: plan `194-07` is the one that will touch it, and plan `194-05`
  is the one whose `files_modified` includes `CLAUDE.md` with the explicit must-have that it become a
  row. Both were still pending.
- **Why this is the right resolution rather than a gap:** an untouched file cannot honestly carry a
  "Phase 194 honoured G-5 by construction" verdict, and inventing one would be exactly the class of
  unearned claim this phase exists to remove.

**4. [Rule 1 — Bug] Task 3(a)'s premise that two ledger cells already exist**

- **Issue:** Task 3(a) says to *"RE-DERIVE the three ledger cells this phase touched … including the
  two rows plan `194-05` added"*. `194-05` has not run, so those rows do not exist; only
  `db/workflows.py` was a cell.
- **Fix:** `db/workflows.py` re-derived; `WorkspacePanel.tsx` **added** (this phase did touch it);
  and the row itself carries a one-line instruction that **whoever lands `194-05` must UPDATE it,
  never add a second row for the same file**, so the coming conflict is visible rather than silent.

### Not a deviation, but recorded

⚠ **A RESEARCH figure corrected on measurement.** `194-RESEARCH.md` says A2's thread *"carries
**five** `runs` rows, all `failed` with `error='resume re-drive failed'`"*. Measured: **79** rows —
**77 `failed` and 2 `completed`** — with **two** distinct failure spellings, not one. RESEARCH's
narrative is correct and **understated by more than an order of magnitude**. Recorded beside.

⚠ **`194-CONTEXT.md` D-01's claim that `RunCard.tsx` and `WorkspacePanel.tsx` *"occur only inside
other rows' prose"* is FALSE** — `grep -o` returned **0** for both; neither appeared in `CLAUDE.md`
at all. *"Present but only in prose"* and *"absent entirely"* are different diagnoses with different
fixes. ⚠ The prose-only state D-01 described **is** real for a different file, which is why the
distinction is kept: `harness_engine.py` occurs **exactly once**, inside the `publish_service.py`
row's prose — where a row-scanning audit cannot see it either.

---

## The golden run — healed, never re-anchored, and NO marker was written

`4b0feda7` carries `is_golden_run = True`. Cancelling it is honest: it is abandoned and
**permanently unresumable** since Phase 190's A4 gate excluded `is_golden_run = true` from
`find_resumable_runs`.

⛔ **No distinguishing marker was written, and the reason is measured rather than preferred.** The
plan permits an `error`/audit note and forbids a new status literal. **Measured: `workflow_runs` has
no `error` column** — its columns are `id, thread_id, definition_id, status, current_phase_id,
org_id, created_at, updated_at, claimed_at, inputs, model, continues_used, user_id, is_golden_run`.
The note has nowhere to live without a schema change, and **a second migration for a one-off is
exactly what D-17 forbids.** ⛔ No new status literal was invented; the row reads the shipped
`cancelled`.

⇒ **A future reader distinguishes it by `is_golden_run = True` plus THIS COMMITTED RECEIPT**, which
is the whole reason the receipt is committed. It is stated in the receipt on one line so it survives
a `grep` (the 193.2-08 lesson).

⚠ **It was CANCELLED, never RE-ANCHORED** (`T-194-13-02`). Its thread's `active_workflow_run_id` is
`NULL` and nothing here writes it back.

⚠ **`BUG-260815-07`'s "permanent delete blocker" justification is NOT claimed** — it was measured
FALSE (the cascade already terminalizes them; neither definition is `is_system_global`). The four
honest reasons are recorded in the receipt instead. ⛔ Its non-reproducible delete-failure half is
**not closed**.

---

## The ledger — four rows ADDED, one cell RE-DERIVED

| File | commits | phases | L at `743965a1` → now | 194 diff | G-5 | outcome |
|---|---|---|---|---|---|---|
| `backend/app/db/workflows.py` | 34 | **18** | 1447 → **1582** | +136 / −1 | FIRES | cell **re-derived** (was `32 / 17 / 1447`) |
| `frontend/src/components/panel/WorkspacePanel.tsx` | 14 | **9** | 493 → **580** | +88 / −1 | FIRES | **ROW ADDED** |
| `backend/app/services/run_lifecycle.py` | 4 | **3** | 299 → **437** | +138 / −0 | FIRES (at threshold) | **ROW ADDED** |
| `backend/app/api/runs.py` | 33 | **16** | 1208 → **1376** | +168 / −0 | FIRES HARD | **ROW ADDED** |
| `backend/app/services/harness_engine.py` | 45 | **16** (raw 17) | 2494 → **2536** | +42 / −0 | FIRES HARD | **ROW ADDED** |
| `frontend/src/components/chat/RunCard.tsx` | 20 | **8** (raw 9) | 550 → **550** | **none** | fires | ⛔ **no row — untouched by 194** |

Non-phase buckets are **named, never silently subtracted**: `harness_engine.py`'s 17th is `quick`
(`fix(quick-260731-3y4)`); `RunCard.tsx`'s 9th is `streaming`, an untagged 075.x fix/revert pair. The
other four have **zero** — checked, so a reader can tell *"none exist"* from *"nobody checked"*.

**Each new row carries the seven elements:** the `ABSENT FROM THIS TABLE UNTIL PHASE 194` sentence,
the re-derive commands, the G-5 verdict, the **measured** honoured-by-construction reason, the
binding invariants, the named next seam, and `It inherits N / M / L`.

⚠ **`git diff -U0 CLAUDE.md` reports exactly ONE deleted line — the `db/workflows.py` row rewritten
in place.** No other pre-existing row was edited, which is the acceptance criterion measured rather
than claimed.

### The declined G-5 override — VERIFIED, not assumed

D-01 says an override was **offered and declined**, the fourth consecutive phase (193, 193.1, 193.2,
194) — *if* STATE.md records none. **It was checked before the sentence was written.**
`.planning/STATE.md` carries phase-level override records for `193`, `193.1` and `193.2` (each
recording NONE) plus the v3.6 close; there is **no Phase-194 override record of any kind**, and
STATE.md's own Phase-194 entry says so in its own words. ⇒ the sentence is written in all five cells
and it is true.

### ⚠ These figures WILL go stale, and the commit that stales them is already known

Plans **`194-05`** and **`194-07`** have not run — both blocked on an operator measurement that has
not arrived. `194-05` touches `CLAUDE.md` and `streamsStore.ts`; `194-07` touches `RunCard.tsx`,
`MessageItem.tsx`, `toolMeta.ts` and two test files. This is the ledger's own documented
self-staling — the `WorkflowsPage.tsx` cell has gone stale four consecutive times and once within a
single day — with the difference that **the next commit is already identified by plan number**, so
it is stated rather than left to be discovered.

---

## Verification — every figure compared to `194-BASELINE.md`

| Gate | Baseline (`743965a1`) | Measured now | Verdict |
|---|---|---|---|
| (d) backend `tests/unit`, **BY NAME** | **62 failed / 2242 passed** | **62 / 2242 / 2 xfailed / 2 xpassed** | ✅ **0 NEW, 0 DISAPPEARED — set-identical** (both parsed sets 62) |
| (c) cancel-path pytest (4 files) | **12 passed / 0 failed** | **35 passed / 0 failed** | ✅ never lowered; the +23 is 194's own plans |
| mig-119 + phase-cancel + harness-engine suites | 3 skipped pre-apply | **75 passed / 0 failed / 0 skipped** | ✅ |
| (b) `tsc -p tsconfig.app.json` | **33** | **33** | ✅ unmoved across the whole phase |
| (a) frontend count gate | `count gate OK` · 3918 · failed 0 · 75/75 | **`count gate OK` · 3954 · failed 0 · 75/75** | ✅ (a growing total is the gate working) |

⚠ **THE COUNT GATE'S FIRST RUN FAILED, AND BOTH READINGS ARE PUBLISHED RATHER THAN ONLY THE GREEN
ONE.** Run 1 reported `COUNT GATE VIOLATED (3 reasons)` — `total 3759 < pinned 3868` plus two
`[missing-file]` failures: **`WorkflowBuilderPage.canvas.test.tsx`** (pinned 128) and
**`WorkflowsPage.test.tsx`** (pinned 52), each reported as *"did NOT run"*, with **`failed 0`**.

**The failing filenames were captured BEFORE anything was re-run** — that is CLAUDE.md's own
`193.2-03` rule, and `193.2-02` recorded itself breaking it and then being unable to prove its cases
innocent. Both suites were then run **standalone**: `2 passed / 195 tests passed`, in 49 s for the
two of them — they are among the heaviest files in the tree. Run 2 of the full gate: **`count gate
OK` · 75/75 · 3954 · failed 0.**

⇒ **A flake in the full-suite run, not a breakage** — the two heaviest suites were dropped, not
failed (`failed 0` on the violating run is the tell: a real breakage produces failures, a dropped
worker produces absences). ⚠ **This plan touched ZERO frontend source files** (`git diff --numstat`
across all three commits names only `CLAUDE.md` and two `.planning/` files), so it cannot be this
plan's regression under any reading. It is another instance of the non-determinism CLAUDE.md
documents about this gate at cap 2, and the note there — *"cap 2 held `failed 0` on the first run
here, but it is NOT deterministic"* — now has a second spelling: **the non-determinism can present
as MISSING FILES rather than as failures.** Recorded so the next reader finds a measurement.

---

## Threat model — dispositions honoured

| Threat ID | Disposition | How |
|---|---|---|
| T-194-13-01 (Tampering, live user data) | **mitigated** | Five rows written **individually by id**; the only predicate that ran is `cancel_active_phases`' own shipped `AND status='active'` inside a `WHERE workflow_run_id = $1` already narrowed to one named run. Group B's two `UPDATE`s each asserted `rowcount = 1` inside a transaction that would otherwise roll back. **"No other row moved" proved by enumeration over `updated_at`, not by histogram arithmetic.** |
| T-194-13-02 (EoP, a resumed golden run) | **mitigated** | The row was **cancelled, never re-anchored**; its thread anchor is `NULL` and nothing writes it back. Phase 190's A4 gate excludes it regardless. No arm here can return it to a resumable state. |
| T-194-13-03 (Repudiation, the repair) | **mitigated** | Row ids, `thread_id`, `created_at`, `updated_at`, status before and after, the instrument **per row**, and the reason per group are all committed. The BEFORE capture ran on a `set_session(readonly=True)` connection, so it **could not** have written anything. |
| T-194-13-04 (EoP, the two DELETE calls) | ⚠ **N/A — the calls were not made** | The route was **not driven**; the guard was verified live (403) and **left intact**. ⛔ No authentication was forged, minted, impersonated or bypassed and no guard was weakened. The instrument used performs **no ownership check by design** (T-194-09-01) — its ownership is the caller's, and here the caller is an operator-authorized, id-enumerated repair, not a user request. |
| T-194-13-05 (Info disclosure, the receipt) | **mitigated** | Row ids, thread ids, one user id, statuses, timestamps, workflow slugs/names and phase slugs only. **No prompt, no phase `output`, no provider payload, no auth header, no token.** |
| T-194-13-SC (pip/npm installs) | **n/a** | **No package added.** No `requirements.txt` or `package.json` change. |

---

## Scope

⛔ **Local dev only** (`postgresql://postgres:postgres@127.0.0.1:54322/postgres`). ⛔ No cloud write.
⛔ No migration applied, authored or edited — `ls supabase/migrations/*.sql | wc -l` is **113** before
and after. ⛔ `supabase/full-schema.sql` untouched. ⛔ No schema change: every write is a row `UPDATE`
inside the seven-literal vocabulary migration 119 already applied. ⛔ No `supabase db push` /
`db reset`. ⛔ No `git clean`, no `git stash`, no `git reset`, no worktree created or torn down.
⛔ The pre-existing uncommitted `.claude/`, `supabase/snippets/` and `supabase/.temp/` modifications
were **not staged, committed, reverted or cleaned** — every commit staged files by explicit path.

## STATE / ROADMAP / REQUIREMENTS

**Untouched by design.** No `gsd-sdk query state.*`, no `roadmap.update-plan-progress`, no
`requirements.mark-complete` was invoked — those seven verbs write false records and corrupted
STATE.md five times in Phase 190 alone. `git diff --numstat 8aeefbb8~1 HEAD` names exactly two
files: `CLAUDE.md` and `194-HEAL-RECEIPT.md` (this SUMMARY excepted). Nothing auto-flipped a REQ-ID
or a roadmap checkbox, so nothing needed reverting.

## Known Stubs

None. The heal is complete: zero `workflow_runs` in `('active','paused','cap_paused')`, zero
`workflow_phases` `active`, zero threads holding an anchor.

⚠ **Two honest limits, stated rather than discovered later.** (1) **The HTTP route was not driven**
— the `204`s the plan's criteria ask for do not exist and the receipt says so; if a later phase wants
end-to-end evidence of the dual-id fallback on live data, it needs an operator-driven UAT row, and
`194-11`'s six plants are the evidence that stands today. (2) **`RunCard.tsx` still has no ledger
row** — owed by `194-05`, with its measured triple `20 / 8 / 550` carried in the receipt so the
measurement is not lost.

## Threat Flags

None. This plan opens no network endpoint, adds no auth path, no file access and no schema change.

---

## Files

| File | Change |
|---|---|
| `.planning/phases/194-stop-a-running-workflow/194-HEAL-RECEIPT.md` | **created**, **+681 / −0** across three commits, measured with `git diff --numstat 8aeefbb8~1 HEAD` (BEFORE · Method · AFTER · per-row table · enumeration proof · Caveats · Ledger) |
| `CLAUDE.md` | **+5 / −1** — four new hot-file ledger rows; the single deleted line is the `db/workflows.py` row rewritten in place |

## Commits

- `8aeefbb8` — `docs(194-13): capture the BEFORE column of the data heal receipt`
- `72e81c1e` — `docs(194-13): heal the five stuck rows + two anchors, with the AFTER receipt`
- `dc4871a7` — `docs(194-13): close the ledger debt — four new hot-file rows + one re-derived cell`

## TDD Gate Compliance

**Not applicable and stated rather than silently skipped.** This plan's frontmatter carries no
`type: tdd` and no task carries `tdd="true"`; it writes **no production source at all** — its two
files are a planning artifact and a project-rules document. The RED/GREEN gate has nothing to bind
to. The phase's TDD evidence lives in plans `194-06`, `194-09`, `194-10` and `194-11`, each with its
own `test(…)` → `feat(…)` pair. What stands in for a fence here is the **enumeration proof** that no
row outside the five moved, and the **prediction recorded before the write** so the after column
could be compared rather than fitted.

## Self-Check: PASSED

- `.planning/phases/194-stop-a-running-workflow/194-HEAL-RECEIPT.md` — FOUND
- `CLAUDE.md` — FOUND, `grep -c "It inherits"` → **11**, `ABSENT FROM THIS TABLE UNTIL PHASE 194` → **4 occurrences**
- `8aeefbb8` / `72e81c1e` / `dc4871a7` — all FOUND in `git log`
- live DB re-verified after all writes: `workflow_runs` active **0**, `workflow_phases` active **0**,
  threads holding an anchor **0**, `workflow_phases` total **496** (unchanged), `runs` histogram
  byte-identical to BEFORE
- `ls supabase/migrations/*.sql | wc -l` → **113**, unchanged; `supabase/full-schema.sql` not in any
  commit of this plan
