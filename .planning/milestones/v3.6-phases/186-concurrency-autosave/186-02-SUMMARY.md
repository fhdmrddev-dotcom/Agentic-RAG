---
phase: 186-concurrency-autosave
plan: 02
subsystem: api
tags: [asyncpg, postgres, optimistic-concurrency, publish-gauntlet, sentinels, governance-receipts]

# Dependency graph
requires:
  - phase: 186-01
    provides: "`CONCURRENCY_TOKEN_SQL`, the `token` key on `get_definition`'s return, and the text-space comparison discipline"
  - phase: 102-workflow-quality-gate
    provides: "the publish gauntlet, the WR-03 `-1` sentinel, `_block`'s add-only receipt"
provides:
  - "`publish_definition(pool, id, *, token=None)` — a token-guarded flip with a two-sentinel refusal contract (`-1` already-published / `-2` draft-moved)"
  - "The stage-0 token carried through the whole gauntlet to the stage-5 flip"
  - "A new honest `blocked_stage`: `draft_changed`, returned as HTTP 200 + structured verdict with the golden run preserved"
affects: [186-05 PublishGauntlet stage rendering, 186-06 useDraftPersistence, 187 validation envelope]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Two sentinels rather than one whenever the caller words them differently and files a different receipt (the T-185-04-01 false-receipt rule applied to return values)"
    - "An OPTIONAL guard keyword whose absent case is byte-identical to the pre-guard statement, so shipped positional callers stay correct with zero edits"
    - "`row.get(...)` rather than a subscript at any seam that shipped tests patch with hand-built dicts"

key-files:
  created:
    - backend/tests/unit/test_186_publish_race.py
  modified:
    - backend/app/db/workflows.py
    - backend/app/services/harness/publish_service.py
    - backend/app/api/workflows.py

key-decisions:
  - "`token` is an OPTIONAL keyword on `publish_definition`, and the compatibility is stated in the docstring as a decision — `token=None` runs the byte-identical pre-186 statement and `-2` is unreachable, which is what keeps `test_103_tweak_fork.py`'s positional two-argument calls green with zero edits."
  - "Two statements, not one with a conditional conjunct — the guarded query exists only when a token was supplied, mirroring 186-01's rejection of an `OR $N IS NULL` escape hatch."
  - "The disambiguating probe carries no owner clause, and the docstring says why (stage 0 already owner-checked; the function is unreachable from any un-owner-checked path; the probe returns a bare `1`, never a row's contents) — T-186-02-02, accepted."
  - "No route branch for `draft_changed`. The publish route's own docstring already specifies that an unrecognised `blocked_stage` falls through to 200 + the structured verdict; the only `api/workflows.py` change is that docstring."
  - "`draft_changed` is deliberately NOT folded into the `already_published` 409 — that would tell an author somebody else published their workflow (false) and would hide the true cause, their own newer edit."

patterns-established:
  - "Name what a collapsed sentinel would LIE ABOUT, at the return site and again at the branch that consumes it — the WR-03 comment's shape, extended"
  - "Assert a preserved audit trail as an ORDERED LIST, not a membership check: `in` cannot tell a preserved row from a rewritten one"

requirements-completed: [CONCUR-02]

# Metrics
duration: 13min
completed: 2026-08-01
---

# Phase 186 Plan 02: Publish Race Guard Summary

**The stage-0 concurrency token is now carried through the minutes-long gauntlet and guards the stage-5 flip, so a draft edited mid-publish is refused with an honest `draft_changed` verdict instead of shipping a definition that never passed — and the golden run it did pass stays on the record, untouched.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-07-31T21:46Z (UTC; local date 2026-08-01)
- **Completed:** 2026-07-31T21:59Z
- **Tasks:** 3
- **Files modified:** 4 (1 created, 3 modified) — 477 insertions / 14 deletions

## Accomplishments

- **"We published what we validated" is now structural, not cooperative.** The guard is a WHERE conjunct, not a client-side hold — a mid-gauntlet edit cannot be raced past it.
- **The two sentinels are provably distinguishable.** F5b publishes for real with a current token, then re-flips and asserts `-1` — including with a deliberately wrong token, so "published" wins over "moved" unambiguously.
- **The refusal is proven on the ROW, not just the return value.** F5 re-reads `status` after the `-2` and asserts it is still `draft`; a sentinel-only assertion would pass against a guard that returned `-2` *after* flipping.
- **The golden-run record survives by construction, and it is asserted as an ordered list.** `["publish_attempted", "judge_verdict", "publish_blocked"]` — two earlier receipts in place, one appended after them, and no `publish_succeeded`.
- **Five shipped test files that mock `get_definition` with token-less dicts pass with zero edits**, because the stage-0 capture is `row.get("token")` and a missing token degrades to today's unguarded flip.
- **The zero-migration promise held for the publish half too.** `git diff --name-only -- supabase/migrations` = 0 files; head stays `114_harness_audit_action_risk_pending.sql`.

## Task Commits

1. **Task 1: Wave 0 — the publish-race falsification suite (RED first)** — `7fa42425` (test)
2. **Task 2: `publish_definition` — two sentinels, never one** — `b4288727` (feat)
3. **Task 3: Carry the token through the gauntlet and refuse on drift** — `7fb4eeb3` (feat)

## Files Created/Modified

- `backend/tests/unit/test_186_publish_race.py` — **created.** F5/F5b/F5c/F6. Module-level psycopg2 skip-guard, imports inside test bodies, `os.getpid()`-suffixed slugs. F5/F5b/F5c drive `publish_definition` directly against the live local DB; F6 drives `publish_workflow` through the shipped `test_publish_service.py` mocking idiom (golden-run and judge BOUNDARIES mocked, pipeline real).
- `backend/app/db/workflows.py` — `publish_definition` gains `*, token: str | None = None`; two statements (unguarded / token-guarded); the owner-free disambiguating probe; a rewritten docstring carrying all three parts of the sentinel pattern plus the collapsed-sentinel lie and the Pitfall-9 transaction constraint.
- `backend/app/services/harness/publish_service.py` — `stage0_token = row.get("token")` at stage 0 with the reason recorded; the token threaded to the stage-5 flip with Pitfall 9 restated at the call site; the `version == -2` branch immediately after the WR-03 `-1` branch.
- `backend/app/api/workflows.py` — **one docstring edit**, exactly what that docstring asks for. No route branch was added.

## RED evidence (required by the plan's output spec)

Observed with the local DB up, at **runtime**, never as a collection error. `--collect-only -q` exited 0 reporting exactly 4 tests.

| Guard | Test | RED output |
|---|---|---|
| F5 | `test_a_draft_that_moved_is_refused_at_the_flip` | `TypeError: publish_definition() got an unexpected keyword argument 'token'` |
| F5b | `test_the_two_sentinels_are_distinguishable` | `TypeError: publish_definition() got an unexpected keyword argument 'token'` |
| F5c | `test_an_absent_token_keeps_todays_unguarded_flip` | **PASSED — deliberately.** See below. |
| F6 | `test_the_golden_run_receipt_survives_a_draft_changed_refusal` | `assert True is False` (on `result["published"] is False`) |

`3 failed, 1 passed, 1 warning in 0.76s` at Task 1 → `4 passed` after Task 3.

**On F5c passing at RED.** It is a **compatibility control**, not a falsification guard, and the plan defines it as such: it asserts that a token-free positional call keeps *today's* behaviour byte-identical, which is precisely what keeps `test_103_tweak_fork.py:89,101` green without edits. A control that failed before the change would be asserting the wrong thing. Its RED-equivalent is the inverse: it fails the moment someone makes `token` required — which is the drift it exists to catch, and which would otherwise surface in a Phase-103 test whose subject is something else entirely. Recorded here rather than glossed, because "the whole file RED" was the plan's wording and one test honestly did not go red.

**F6's RED is the defect itself, reproduced.** With the flip mocked to `-2` and no `-2` branch in the service, the sentinel fell straight through the `version == -1` check into the success path: `publish_workflow` returned `{published: True, version: -2}` **and wrote a false `publish_succeeded` governance row**. That is the same class of failure WR-03 was created to close, one sentinel later.

## Counts (required by the plan's output spec)

| Measure | Before | After |
|---|---|---|
| Backend collected count | 3461 (post-186-01) | **3465** (+4; +8 across the phase vs. the 3457 baseline) |
| Backend failing tests (full suite) | 211 | **211** — unchanged |
| Backend passing tests (full suite) | — | 3228 (`211 failed, 3228 passed, 11 skipped, 5 xfailed, 9 xpassed, 1 error in 367s`) |
| Shipped test files edited | — | **0** |
| Migration files changed | — | 0 |
| Frontend files changed | — | 0 |

**On the 211 failures:** identical to the count 186-01 proved pre-existing (SEED-049 / SEED-056 class) by running the full suite twice against a restored pre-186 baseline. This plan touches no file implicated in them. Per the standing rule from 186-01's post-mortem, **no `git checkout <ref> -- <path>` baseline comparison was run** — the count comparison against 186-01's measured 211 is the evidence, and every task was committed before any full-suite measurement.

## The `named_failures` sentence (required by the plan's output spec)

186-05 renders a client sentence for this same code and **must not contradict it**:

> **the draft changed while it was being checked — re-publish to check the new version**

It is a business-plain sentence, not a code: it names what happened (the draft changed), when (while it was being checked), and what to do next (re-publish). The word "token" appears nowhere in it.

## Decisions Made

- **Two statements rather than one with a conditional conjunct.** The token conjunct exists only when a token was supplied. This mirrors 186-01's rejection of an `OR $N IS NULL` escape hatch: a guard that can be OR'd away is one refactor from being permanently disabled while still *reading* as guarded.
- **The optional keyword is documented as a compatibility DECISION, at the signature.** Nothing about the shipped positional callers was silently relied upon.
- **Pitfall 9 is restated at the stage-5 call site, not only on the constant.** `now()` is transaction time; wrapping the flip in a transaction with any other UPDATE would render identical tokens and disable the guard with no test going red. The next reader of `publish_service` meets that constraint where they could break it.
- **F6 asserts the audit trail as an ordered list, not a membership check.** "The golden-run record survived" is a claim about what is *still there*; `in` cannot distinguish a preserved row from a rewritten one.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] F6's expected audit trail was wrong about the shipped receipt sequence**

- **Found during:** Task 3 (after the `-2` branch landed)
- **Issue:** F6 asserted the surviving trail was `["judge_verdict", "publish_blocked"]`. The real trail is `["publish_attempted", "judge_verdict", "publish_blocked"]` — `publish_attempted` is written at stage 3.5 (`publish_service.py:299-303`), *outside* the mocked `_drive_golden_run`, so mocking the golden-run boundary does not suppress it.
- **Fix:** Corrected the expected list and re-indexed the metadata assertion to `audit_events[-1]`. The assertion was wrong about the trail; the trail was not wrong about itself. The corrected form is a **stronger** F6 — it now proves *two* earlier receipts survive in place, not one.
- **Verification:** F6 green; the plan's "count increased and names `publish_blocked`" criterion is satisfied more completely than before.
- **Committed in:** `7fb4eeb3` (Task 3 commit), with the correction named in the commit message rather than folded in silently.

**2. [Rule 3 - Blocking] Two acceptance-criteria greps were diluted by prose, exactly as in 186-01**

- **Found during:** Task 3 (verification)
- **Issue:** `grep -c 'row\["token"\]'` read **1** instead of 0 — the single hit was my own comment saying *never* use that form. Likewise `grep -c "draft_changed" backend/app/api/workflows.py` read **3** instead of 1, because the docstring named the code on three separate lines. Both criteria are meant to guard **code**, and both were measuring **prose about the code** — the identical failure mode 186-01 hit with `"draft not found"`.
- **Fix:** Reworded the comment to "never a SUBSCRIPT" and condensed the docstring so the literal appears once. Both greps now measure what they were written to measure: `row["token"]` → 0, `row.get("token")` → 1, `draft_changed` in `api/workflows.py` → 1 (line 810, inside the `publish_workflow` docstring), `blocked == "draft_changed"` → 0 (no route branch).
- **Verification:** All Task-3 acceptance greps pass; `json.loads` count unchanged at 2 (the SEED-138 defensive decode is intact).
- **Committed in:** `7fb4eeb3` (Task 3 commit)

**3. [Rule 3 - Blocking] The plan's Task 2 `<verify>` block is not satisfiable at Task 2**

- **Found during:** Task 2
- **Issue:** Task 2's verify command includes `test_186_publish_race.py`, whose F6 drives `publish_service` — the file Task 3 changes. Between the two commits F6 necessarily fails. Task 2's own *acceptance criteria* only require F5/F5b/F5c plus the two shipped suites, which all passed.
- **Fix:** Committed Task 2 with the expected intermediate failure named explicitly in the commit message rather than pulling service work forward into the SQL layer's commit. Same shape as 186-01's deviation 2 — this is a recurring artefact of per-layer task boundaries, not a new problem.
- **Verification:** `1 failed, 5 passed` at Task 2 (the failure being F6 alone); `96 passed` at Task 3.

**4. [Plan correction] One `<read_first>` / verify path in the plan does not exist**

- **Issue:** The plan and VALIDATION.md reference `backend/tests/unit/test_workflows_routes.py` as a pattern source. There is no such file under `tests/unit/`. The idiom it describes (direct route call + patched `get_pg_pool`) is real and shipped — it is what `test_186_concurrent_patch.py` and `test_publish_service.py:499-517` use — so the pattern was copied from those instead.
- **Impact:** None on behaviour. Recorded so a later plan does not lose time looking for it.

---

**Total deviations:** 3 auto-fixed (1 test bug, 2 blocking/plan-internal) + 1 plan-path correction
**Impact on plan:** None changes scope. No migration, no frontend file, no route branch, no shipped test edited.

## Issues Encountered

- Nothing beyond the deviations above. The live local stack was up throughout, so all four tests ran for real rather than skipping.
- The `supabase/snippets/*.sql` and `supabase/.temp/` churn visible in `git status` is pre-existing local Supabase Studio artefact noise, unrelated to this plan and deliberately left unstaged.

## Known Stubs

None. Every surface is wired end to end: the token is rendered by SQL, returned by `get_definition`, captured at stage 0, threaded through the gauntlet, compared in a WHERE clause, disambiguated by a probe, routed to a named block, written into a governance receipt, and asserted on the row by a live-DB test.

## Threat Flags

None. Every security-relevant surface is already registered in the plan's `<threat_model>`:

| Threat | Where it is enforced | Where it is asserted |
|---|---|---|
| T-186-02-01 sentinels collapsed → false receipt | two return values, two branches, two `named_failures` | F5b (`-1` ≠ `-2`, including with a wrong token); F6 (`publish_succeeded` absent) |
| T-186-02-02 owner-free probe | accepted; stage 0 owner-checked, probe returns a bare `1` | documented at the probe; `get_definition`'s owner scope unchanged |
| T-186-02-03 `not_found` existence leak | unchanged — no route branch added | `test_publish_service.py::test_route_not_found_maps_to_404` green, unedited |
| T-186-02-04 publishing an unchecked definition | the stage-5 WHERE conjunct (structural, not cooperative) | F5 asserts the ROW is still `draft` |
| T-186-02-05 golden-run trail | `_block` only ADDS | F6's ordered-list assertion |
| T-186-02-SC package installs | none performed | — |

## User Setup Required

None — no environment variables, no migrations, no cloud parity step. `scripts/check-deploy-drift.sh` is unaffected.

## Next Phase Readiness

- **186-05 (PublishGauntlet) is unblocked and now has its concrete case.** The wire contract is HTTP **200** with `{published: false, blocked_stage: "draft_changed", named_failures: [...], golden_run_id: <uuid>}`. The client sentence 186-05 renders must not contradict the server's, quoted verbatim above.
- **The fail-open defect 186-05 exists to fix is live and reachable today.** `PublishGauntlet.tsx:329-338` computes `blockedIndex` with `findIndex` → `-1` for any unrecognised stage, and `isPassed = blockedIndex === -1 ? !running : ...` then paints **all eight nodes green** while `wordedHeadline` prints the raw token. `draft_changed` is the first stage that actually triggers it in production. Both `-1` reads must be fixed, not just the first.
- **186-06 (autosave) is what makes this guard load-bearing.** Until autosave ships, a mid-gauntlet edit is rare; after it, it is routine.
- **No blockers.** 211 pre-existing suite failures unchanged and out of scope.

## Self-Check: PASSED

All 4 claimed files exist on disk (1 created, 3 modified); all 3 claimed commit hashes (`7fa42425`, `b4288727`, `7fb4eeb3`) resolve in `git log`.

---
*Phase: 186-concurrency-autosave*
*Completed: 2026-08-01*
