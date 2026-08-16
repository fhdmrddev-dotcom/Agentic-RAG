---
phase: 194-stop-a-running-workflow
plan: 11
subsystem: backend-runs-api
tags: [cancel, dual-id, forward-resolution, authorization, RUN-01, SC#1, fences]
requires: ["194-01", "194-09"]
provides:
  - "DELETE /runs/{id} accepts a workflow_runs.id as well as a producer runs.run_id — the THIRD route on the /runs prefix to carry the shipped dual-id fallback"
  - "the FORWARD resolution neither shipped fallback needs: a LEFT JOIN to the live producer row, so a workflow_runs.id can never reach the RUN_TASKS-keyed shared writer"
  - "the no-live-producer arm, wired to plan 194-09's exported cancel_workflow_run_internals — one composition, two callers"
  - "eleven cases (V-01, V-01b, V-02, V-02b, V-03 + six pins) behind SIX independently-driven production-source plants"
affects: ["194-12", "194-13"]
tech-stack:
  added: []
  patterns: ["dual-id fallback (owner-scoped + anchor-confirmed, 404 never 403)", "BRANCH never replace (D-08)", "forward resolution via LEFT JOIN", "late-import at the call site", "one-composition-two-callers", "filter-INTERPRETING test doubles", "one isolating case per authorization clause"]
key-files:
  created: []
  modified:
    - backend/app/api/runs.py
    - backend/tests/test_062_cancel_run.py
decisions:
  - "run_id is REBOUND to the producer id inside the fallback, so the shared writer's call site stays byte-unchanged and the Deep path is identical by construction"
  - "the synthesized row carries the PRODUCER's status, never the ask_user fallback's None — this route READS row['status'] as Step 2's terminal check"
  - "THREE plants, not the two F-10 specified: PATTERNS S1 names three clauses and the realistic cross-user world cannot isolate any of them"
  - "the supabase double INTERPRETS .eq() filters rather than recording them — a recording double would have left all three plants green"
  - "no second cancel route, no second writer, no relaxation of run_id: UUID"
metrics:
  tasks: 2
  commits: 2
  duration: ~70m
  completed: 2026-08-16
---

# Phase 194 Plan 11: the DELETE dual-id fallback Summary

`DELETE /runs/{id}` now accepts **either id shape** and resolves **forward** to the live producer —
so a Stop wired to `WorkflowLock.runId` can no longer 404 silently, and a `workflow_runs.id` can no
longer reach a writer that would 204 while the producer keeps running. **The silent success is
closed at both ends: the client-visible one and the server-side one.**

---

## Base assertion — the wrong-base streak continued and is now 7 out of 7 in this phase

```
bash scripts/bootstrap-worktree.sh <wt>   → BOOTSTRAP OK (both junctions, both env files)
git rev-parse --abbrev-ref HEAD           → worktree-agent-a49d56b48b706c951   (namespace OK)
git merge-base HEAD e62d140a              → 3781a3fe4690a9619e619f4cc412bd37a7dafc52   ✗ WRONG BASE
git reset --hard e62d140a                 → HEAD is now at e62d140a chore: merge executor worktree (194-08)
git rev-parse HEAD                        → e62d140ace1b2eb970b8d62e2e3dacd1ce0d9cc0   ✓ BASE OK
```

Same wrong base (`3781a3fe`) every worktree in this phase has forked from. The dispatch brief
predicted it; it happened. Bootstrap ran as the **first** action, before the HEAD assertion.

---

## The finding, and where it is now recorded

`WorkflowLock.runId` carries **two id types**. Its own JSDoc asserts only one. `DELETE /runs/{id}`
accepted only the *other* one, and the client's `cancelRun` **swallows 404** — so a Stop resolved
through the anchor id **silently succeeded while doing nothing**.

⚠ **Phase 188 measured this and recorded it ONLY at `WorkspacePanel.tsx:161-165`**, where the next
phase could not see it. This plan therefore writes the finding **twice, in the two places a reader
of the cancel path will actually be standing**: the route's own header comment in
`backend/app/api/runs.py` (which already documented four arms), and the Phase-194 banner in
`backend/tests/test_062_cancel_run.py`. *A measurement that lives in one file's comment is invisible
to the next phase.*

---

## What was built

### Task 1 — the fallback with FORWARD resolution (TDD: RED `cf919164` → GREEN `903ae2cf`)

Inserted **strictly below** the Step-1 `runs` SELECT and **above** its 404, mirroring
`continue_run:722-756` clause for clause — the closer of the two shipped analogs, because it too
needs a *forward* value out of the `workflow_runs` row.

| Arm | Behaviour |
|---|---|
| producer `runs.run_id` | Step 1 hits; **not one line of the fallback executes**; 204 |
| `workflow_runs.id`, live producer | `run_id` rebound to the producer id → shared writer, unchanged call site → 204 |
| `workflow_runs.id`, no producer | `publish_cancel_sentinel` + **194-09's exported composition**; shared writer NOT called → 204 |
| not yours / not the anchor / doesn't exist | **404**, body-identical |

**Three properties that are decisions rather than details:**

1. **`run_id` is REBOUND to the producer id**, so `_cancel_run_internals(run_id=run_id, …)` stays
   **byte-unchanged** — which is what keeps the Deep path identical by construction rather than by
   care. Leaving the path's `workflow_runs.id` bound would miss `RUN_TASKS`, take the zombie arm,
   update **zero** `runs` rows and still 204. The value is coerced to `UUID` so a registry keyed by
   UUID objects cannot miss on a string that merely prints the same.
2. **The synthesized `status` is the PRODUCER's, never `None`.** `ask_user_response` synthesizes
   `status: None` and never reads it; **this route READS `row["status"]`** as Step 2's terminal
   check, so copying that shape would silently reclassify every already-terminal producer as
   cancellable.
3. **The no-producer arm calls the exported composition, not a re-composed pair.** One mechanism
   (D-08/D-10) — `cancel_workflow_run_internals` already coerces the id and carries D-062-13
   best-effort discipline internally.

**168 insertions / 0 DELETIONS.** Zero deletions is what proves no shipped line moved; `git diff -U0`
reports both hunks as pure insertions (`-1144,0` and `-1178,0`).

### Task 2 — eleven cases (`cf919164`, committed RED-first)

V-01 (argument value + inequality with the id sent), V-01b (the exported composition, keyed on the
workflow id, with the shared writer proven *not* called), the forward-SQL bind/scope fence, one
isolating case per authorization clause, the realistic cross-user world, the 404 body-parity case,
the Deep-path regression pin, the `run_id: UUID` pin and the module-wide no-403 pin.

---

## Fences — SIX RED observations, each against a REAL production-source plant

Every plant was applied to production source, the suite run, the plant reverted with
`git checkout --`, and the file **md5-verified byte-identical** afterwards
(`5c52c4915b19713f71e1ff9491e44e95` on all six).

| # | Plant (real, in `backend/app/api/runs.py`) | Cases that RED | md5 after revert |
|---|---|---|---|
| a | `.eq("user_id", …)` deleted from the `workflow_runs` select | `test_v02_cross_user_workflow_run_id_is_404_not_403` **only** (1 failed / 21 passed) | `5c52c491…` ✓ |
| b | `.eq("user_id", …)` deleted from the `threads` anchor read | `test_v02b_thread_owned_by_another_user_is_404` **only** (1/21) | `5c52c491…` ✓ |
| c | the anchor-confirm `if` → `if True:` | `…v02b…` **+** `test_v03_non_anchor_workflow_run_id_is_404` (2/20) | `5c52c491…` ✓ |
| d | the `run_id` rebind to the producer id **deleted** | `test_v01_workflow_run_id_cancels_through_the_producer_id` **only** (1/21) | `5c52c491…` ✓ |
| e | the no-producer arm re-pointed at `_cancel_run_internals` | `test_v01b_no_live_producer_calls_the_exported_workflow_composition` **only** (1/21) | `5c52c491…` ✓ |
| f | `AND r.status = 'streaming'` deleted from the LEFT JOIN | `test_v01_forward_resolution_sql_binds_and_scopes_the_live_producer` **only** (1/21) | `5c52c491…` ✓ |

### ⚠ THREE PLANTS SHIP WHERE F-10 SPECIFIED TWO, AND THE REASON IS A MEASUREMENT

F-10 asked for two plants: (a) the `workflow_runs` owner filter, (b) the anchor-confirm `if`.
**PATTERNS § S1 names THREE clauses**, and the third — `.eq("user_id", …)` on the `threads` read —
would have shipped with **no plant of its own**. One extra case and one extra plant closed it.

**And the isolation is not cosmetic — it was forced by a measured containment.** On the
**realistic** cross-user world (the workflow run **and** its thread both owned by the victim),
clauses (a) and (b) *each block the request on their own*. A single "cross-user → 404" case
therefore **cannot red under either plant**, and that is not a prediction: plant (a) was driven and
`test_v02_realistic_cross_user_world_is_also_404` **stayed GREEN** while only the isolating case
failed. Had the realistic case been the only one, plant (a) would have reported no failure and the
clause would have shipped **inert and indistinguishable from live** — the 194-03 failure exactly.

⚠ **The honest cost of the isolation is stated in the fences themselves rather than hidden:** the
worlds in the (a) and (b) cases are only reachable if a *different* invariant has already broken (a
thread anchored to a workflow run its own owner did not start). That is precisely what defence in
depth is for — *a clause whose only test is a world where a sibling clause also holds has never
actually been tested.* The realistic world is driven too, in its own case, **labelled as covering
both** rather than as evidence for either.

### ⚠ Plant (c)'s RED set STRICTLY CONTAINS plant (b)'s, and it is recorded rather than smoothed

Plant (b) reds `{V-02b}`. Plant (c) reds `{V-02b, V-03}` — because with the guard gone, a `threads`
read that returned **no row** (V-02b's world) no longer stops anything, and the request falls
through to the forward resolution. So clause (c) is a *second* defence for V-02b's world, while
V-03 is the case only (c) defends. The property fence discipline requires still holds — **each
clause, deleted, produces a failure, and each plant's failure signature is distinct** — and V-02b
is the unique detector for plant (b). Stating the containment matters: a later reader who plants
(c) and sees two failures should find a recorded expectation, not a surprise.

### ⚠ The test double INTERPRETS its filters, and that is load-bearing rather than tidy

`_FilteringBuilder` evaluates `.eq()` against seeded rows instead of recording the calls. **A
recording double would have left all three authorization plants GREEN** — it keeps returning its
seeded row no matter which filter vanished. 194-09 hit the same shape from the other side: under its
F-2 plant a seeded double kept answering, so only the recorded call ORDER moved. Here the missing
filter must change the **answer**, which is the only thing that makes a plant able to red at all.
The reasoning is written into the double's own docstring so it is not later "simplified" back.

### ⚠ V-01's RED proves the value-assertion is the load-bearing one

Under plant (d) the call **count stayed at 1** and only the argument-value assertion failed. A case
that checked "the writer was called" would have passed under the exact bug this plan exists to fix.

### ⚠ The empty-sweep control is satisfied, and it was checked rather than assumed

`test_v01_forward_resolution_sql_binds_and_scopes_the_live_producer` asserts
`len(pool.fetched) == 1` **before** touching the SQL, so it cannot pass vacuously on a tree where no
forward resolution runs at all. Confirmed on the RED run: it is one of the three cases that failed
pre-change.

### ⚠ Reading the RED run case-by-case, not by count

Task 1's RED was **3 failed / 19 passed**. The other eight new cases passing pre-change is
**correct**: the five authorization/parity cases assert 404s that were trivially true before the
fallback existed (their RED evidence is plants a/b/c, which is F-10's whole design), the Deep-path
case is a regression pin, and the `UUID`/no-403 pins assert properties that must never have moved.
194-06 caught a genuinely vacuous fence exactly this way.

⚠ **One case red for the WRONG reason on the first RED run and was fixed rather than accepted:**
`test_the_run_id_path_param_is_still_uuid_typed` failed with `NameError: name 'UUID' is not
defined` — my own missing import, not a property. A RED that is a test bug is not evidence, and it
was corrected before the RED commit (see Deviations).

---

## Verification — every figure compared to `194-BASELINE.md`, never to RESEARCH or PATTERNS

| Gate | Baseline / expected | Measured now | Verdict |
|---|---|---|---|
| (c) cancel-path pytest (the 4 baseline files) | **12 passed** at `743965a1`; 35 at my base's shape | **35 passed, 0 failed** | ✅ never lowered |
| the 6 cancel-path + phase suites | **38 passed / 3 skipped** at my base | **49 passed / 3 skipped** | ✅ +11 new; the 3 skips are mig 119 unapplied, unmoved |
| (d) backend unit rot, **BY NAME** | **62 failed / 2242 passed** | **62 failed / 2242 passed** | ✅ **0 NEW, 0 DISAPPEARED — set-identical** |
| `grep -c "HTTP_403" backend/app/api/runs.py` | unchanged | **0** | ✅ |
| `grep -c "_cancel_run_internals(" backend/app/api/runs.py` | exactly 1 | **1** | ✅ |
| `git diff --numstat e62d140a HEAD -- backend/app/services/ backend/app/api/workflows.py backend/app/db/` | empty | **empty** | ✅ |
| diff scope | only `files_modified` | the 2 declared files | ✅ |
| deletions in production source | — | **0** | ✅ no shipped line moved |

The **(d) comparison parses `194-BASELINE.md` § (d)'s published 62 names directly** — never a
re-run, because a baseline recaptured after this plan's own edits is not a base. The comparator cuts
at pytest's truncating `" - "` suffix (194-06's trap) **and** at the drive-letter pattern of an
interleaved Windows path (194-09's second spelling of it) before matching. Both parsed sets are 62.

⚠ **Frontend gates (a) and (b) were NOT run, and that is a decision.** This plan touches **zero**
frontend files, so the count gate and `tsc` cannot move; running them would burn a vitest slot the
phase's parallel budget reserves for plans that can move them.

⚠ **No migration was applied to any database.** No `supabase db push`, no `db reset`, no SQL-editor
paste, no edit to `full-schema.sql`. **No test in this plan seeds any table** — supabase is the
in-file `_FilteringSupabase`, the pool is `_FetchPool`, Redis is a fake, and both cancel writers are
patched at their own modules. That is what keeps it parallel-safe under CLAUDE.md rule 4 with plan
194-10 active in a sibling worktree (no file overlap: it touches `harness_engine.py` and
`test_harness_engine.py`).

---

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] `UUID` was not imported in the test module**

- **Found during:** Task 2's first RED run.
- **Issue:** `test_the_run_id_path_param_is_still_uuid_typed` failed with `NameError: name 'UUID' is
  not defined` — a fourth failure that looked like a RED but was my own missing import. **A RED that
  is a test bug is not evidence for anything.**
- **Fix:** `from uuid import UUID, uuid4`. Re-run gave the clean **3 failed / 19 passed** that was
  committed as the RED gate.
- **Files:** `backend/tests/test_062_cancel_run.py` · **Commit:** `cf919164`

**2. [Rule 2 — Correctness] A THIRD authorization plant, where F-10 specified two**

- **Found during:** Task 2, designing the fixtures.
- **Issue:** PATTERNS § S1 names **three** clauses; F-10 names **two** plants. The `threads` owner
  filter would have shipped with no plant of its own, and — measured, not reasoned — a single
  realistic cross-user case reds under **neither** (a) nor (b), because each blocks it alone.
- **Fix:** three isolating cases, one per clause, each moving exactly ONE input; plus the realistic
  world in its own case, labelled as covering both. Six plants driven in total.
- **Why this is the right resolution rather than scope creep:** it is the phase's own fence lesson
  #1. Without it, plant (a) would have reported no failure and clause (a) would have been
  indistinguishable from a deleted one.
- **Commit:** `cf919164`

### Not a deviation, but recorded

⚠ **The plan asked to "let the existing `_cancel_run_internals` call run **unchanged**".** That is
satisfied **literally** — the call site is byte-untouched — but only because `run_id` itself is
rebound above it. Passing `row["run_id"]` instead would have been the obvious reading and is
**wrong**: supabase returns that column as a **string**, `RUN_TASKS` is keyed by **UUID objects**,
and the Deep path would have started missing the registry and silently taking the zombie arm. The
plan's instruction was right; the mechanism it implies was not, and both are recorded.

⚠ **Plant (c) reds two cases, not one** — see the containment note above.

---

## Hot-file ledger measurement for `backend/app/api/runs.py` (handed to plan 194-13)

⚠ **`backend/app/api/runs.py` is NOT a row in `CLAUDE.md`'s ledger, and it is not even MENTIONED
there — `grep -o "api/runs.py" CLAUDE.md | wc -l` → **0**.** Sixteen phases have touched it. *A hot
file missing from the table is permanently invisible to its own guardrail* — the identical failure
`WorkflowsPage.tsx` suffered for ten phases, `WorkflowDoorSwitch.tsx` for six and
`WorkflowBuilderPage.tsx` for ten.

```
git log --oneline -- backend/app/api/runs.py | wc -l                        → 33
git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
                             | sed -E 's/-.*//' | sort -u                   → 16 buckets:
   062 066 067 075 085 092 093 098 120 145 147 152 162.5 163 189 194
wc -l <file>                                                                → 1376
git show e62d140a:<file> | wc -l                                            → 1208
grep -o "api/runs.py" CLAUDE.md | wc -l                                     → 0
```

> **⇒ `33 commits / 16 phases / 1376 L` (1208 at this plan's base).** **ZERO quick-task buckets** —
> the standard recipe returns exactly sixteen and **all sixteen are real phases**, unlike
> `WorkflowBuilderPage.tsx` / `api/workflows.py` / `publish_service.py`, whose recipes return
> `260809` / `260814` / `quick` alongside the phases. *That is a measurement, not an omission: a
> reader who finds no subtraction paragraph here should be able to tell "checked, none exist" from
> "nobody checked".*
>
> **G-5 FIRES HARD — 16 phases against a threshold of 3, the second-hottest API module in the tree
> after `api/workflows.py`'s 17. Honoured BY CONSTRUCTION, not waived: no override was taken and
> `.planning/STATE.md` records none for this plan.** The measured test rather than an argument: the
> route gains **a SECOND ID SHAPE on a door it already owns**, not a second concern — no new route
> (D-08 forbids one, and a second route would need its own ownership gate, its own `RUN_TASKS`
> resolution and its own audit verb), no forked writer, no relaxed path typing, **168 insertions /
> 0 deletions**, and `grep -c "_cancel_run_internals("` still returns **1**.
>
> The natural seam, named rather than implied: the SSE stream/replay surface
> (`replay_tail_consumer`, `stream_run`) versus the three lifecycle verbs on the same prefix
> (`continue_run`, `submit_ask_user_response`, `cancel_run`) — **all three of which now carry the
> same dual-id fallback, which is itself the strongest available argument that they belong in one
> module together.** **The next phase adding a genuinely SECOND concern here owes a refactor
> recommendation FIRST, and it inherits `33 / 16 / 1376`.** ⚠ These three numbers go stale on the
> next commit that touches the file, which can be the same afternoon.

⚠ **This SUMMARY does not edit the `CLAUDE.md` row** — that file is not in this plan's
`files_modified`, and Phase 194's ledger deliverable (D-02) is plan 194-13's. This row is handed
forward so 194-13 inherits a measurement instead of re-deriving one.

---

## Threat model — dispositions honoured

| Threat ID | Disposition | How |
|---|---|---|
| T-194-11-01 (EoP, the `workflow_runs` fallback select) | **mitigated** | Three clauses, **three separate plants**, three isolating cases. On a service-role read path these are the only boundary. Each clause was **watched to fail** with the others in place. |
| T-194-11-02 (Info disclosure, 404 vs 403) | mitigated | One collapsed 404 on every miss; `grep -c "HTTP_403"` over the whole module is **0** and is itself a fence. Body parity between *not yours* and *doesn't exist* is asserted on `res.json()`, not only on the status. |
| T-194-11-03 (Spoofing of success, the forward resolution) | mitigated | A `workflow_runs.id` never reaches the shared writer — asserted on the **argument value** and on its **inequality** with the id sent, and driven RED by plant (d) with the call count unmoved at 1. The no-producer arm is pinned to the exported composition by plant (e). |
| T-194-11-04 (Tampering, the forward SQL) | mitigated | `$1` bind only; the fence additionally asserts the id **does not appear in the SQL text**, so an f-string would red even if a `$1` were left elsewhere in the statement. |
| T-194-11-05 (Input validation, `run_id`) | mitigated | `run_id: UUID` **not relaxed** — asserted on the live signature via `inspect.signature` **and** on the wire (`/runs/not-a-uuid` → 422). Both id spaces are bare uuid columns, which is why no widening was needed; this is where the q5r cross-tenant near-miss lived. |
| T-194-11-06 (DoS, a legitimate Stop) | mitigated | The sentinel publish has its own `try/except` + `logger.exception`; the exported composition never raises by contract. Every arm returns 204. |
| T-194-11-07 (Info disclosure, stack traces) | mitigated | No new exception surface reaches the client; the one new `logger.exception` carries run ids only — no run content, prompt or provider payload. |
| T-194-11-SC (pip installs) | n/a | **No package added.** No `requirements.txt` change; the new tests import only stdlib + pytest + app modules. |

---

## Known Stubs

None. Both forward arms are complete and both are driven by a case. The frontend half — making the
client stop swallowing the 404 it can now no longer receive — is plan 194-03/194-08's shipped work
and this plan's explicit non-goal, not a stub.

## Threat Flags

None. This plan opens no new endpoint, adds no auth path, no file access and no schema change. It
**widens an existing route's accepted input space**, which is why the three authorization clauses
are fenced individually rather than collectively.

---

## Files

| File | Change |
|---|---|
| `backend/app/api/runs.py` | **+168 / −0** (the header comment's new section, the fallback, the forward resolution and the two forward arms; the Step-1 SELECT, the shared-writer call site and every other route byte-untouched) |
| `backend/tests/test_062_cancel_run.py` | **+555 / −1** (eleven cases + the filter-interpreting supabase double, the fetch pool and the cancel-surface Redis fake; the single deleted line is the `from uuid import uuid4` import widened to `UUID, uuid4`) |

## Commits

- `cf919164` — `test(194-11): add failing cover for the DELETE dual-id fallback`
- `903ae2cf` — `feat(194-11): accept either id shape on DELETE /runs/{id}, resolving FORWARD`

## TDD Gate Compliance

RED (`test(…)` `cf919164`, **3 failed / 19 passed** — read case-by-case; the eight green cases are
authorization fences whose RED evidence is plants a/b/c, plus three regression pins) → GREEN
(`feat(…)` `903ae2cf`, 24 passed across both cancel suites) → no REFACTOR commit was owed. Both
gates present and in order.

⚠ **The implementation was written first, then reverted to the shipped tree (`036cd1f4…`) so the
tests could be observed genuinely RED, then re-applied by patch and md5-verified identical
(`5c52c491…`).** The RED is therefore a real observation against real shipped source, not a
reconstruction — and it is stated here rather than implied by commit order.

## STATE / ROADMAP / REQUIREMENTS

**Untouched by design.** No `gsd-sdk query state.*`, no `roadmap.update-plan-progress`, no
`requirements.mark-complete` was invoked. `git diff --numstat e62d140a HEAD` names exactly two files,
both under `backend/` (this SUMMARY excepted). Nothing auto-flipped a REQ-ID or a roadmap checkbox,
so nothing needed reverting.

## Self-Check: PASSED

- `backend/app/api/runs.py` — FOUND
- `backend/tests/test_062_cancel_run.py` — FOUND
- `cf919164` / `903ae2cf` — both FOUND in `git log`
- working tree clean (`git status --short` empty before this SUMMARY); `runs.py` md5-identical to
  its pre-plant state after all six plants (`5c52c4915b19713f71e1ff9491e44e95`)
