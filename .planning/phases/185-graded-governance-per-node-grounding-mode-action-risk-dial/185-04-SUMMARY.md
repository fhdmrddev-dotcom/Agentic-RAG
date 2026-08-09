---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 04
subsystem: api
tags: [python, harness, workflow-engine, governance, ask-user, redis-pubsub, fail-closed, pytest, zero-migration, backend-only]

# Dependency graph
requires:
  - phase: 185-03
    provides: "the `action_risk:approval|<sentence>` structured finding, `grounding._approval_sentence`, and the synthesized `ValidatorSpec(kind='action_risk_approval', timing='pre', on_failure='ask_user', max_retries=0)` attached at the `spec_by_slug` seam"
  - phase: 185-02
    provides: "PhaseSpec.action_risk_armed"
  - phase: 102-quality-gates
    provides: "the `ask_user` on_failure disposition and `_resolve_failure_with_ask_user` (durable prompt row → emit → SUBSCRIBE-before-emit block → receipt → Proceed/Abort routing)"
  - phase: 085-ask-user
    provides: "`subscribe_for_response` / `_subscribe_and_block`, the `ask_user:{run_id}:{tool_call_id}` channel + `ask_user:channels:{run_id}` discovery index, and the cancel/shutdown sentinel sweeps"
  - phase: 096-09
    provides: "the `asyncio.CancelledError`-on-shutdown precedent in `_exec_llm_human_input` plus `run_workflow`'s `is_app_shutting_down()` skip of `_expire_pending_ask_user`"
provides:
  - "`subscribe_for_response(..., timeout_seconds=None)` — the indefinite wait, annotation widened on both it and `_subscribe_and_block`"
  - "the L-8 fix: `ask_user:channels:{run_id}`'s 3600s TTL re-armed from inside the poll loop, so a >1h wait stays Stoppable and drainable"
  - "`_ask_user_choices_from_finding('action_risk:approval|…')` → `['Approve and run this step', 'Do not run it']`"
  - "`_is_abort_choice` classifies `'Do not run it'` — the L-4 fail-open is closed, and the invariant is pinned by a guard test over every choice pair"
  - "the `is_action_risk` armed-gate branch of `_resolve_failure_with_ask_user`: verbatim generated prompt, `timeout_seconds=None` on the emit AND the durable row, `asyncio.CancelledError` on shutdown"
affects: [185-05, 185-07, 185-08, 188-run-surface, 189-external-actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Indefinite-wait-as-a-parameter, never as a sibling helper: `None` rides the ONE copy of the load-bearing SUBSCRIBE → SADD → block ordering instead of forking a `subscribe_forever`"
    - "Classify-the-pair invariant testing: instead of asserting one decline string routes correctly, drive EVERY finding prefix the parser branches on and assert exactly one option per pair is abort-like — a future pair cannot be added fail-open silently"
    - "Scoped behaviour change proved by an unchanged-path CONTROL test: the non-armed shutdown test asserting `fail_run` is what makes 'the fix did not widen' a test result rather than a claim"
    - "Byte-identity fenced against the function's own source (`inspect.getsource`) rather than against `git diff`, so the fence survives the commit that introduces it"

key-files:
  created:
    - backend/tests/unit/test_ask_user_indefinite_wait.py
  modified:
    - backend/app/services/ask_user_service.py
    - backend/app/services/harness_engine.py
    - backend/tests/unit/test_ask_user_disposition.py
    - backend/tests/unit/test_185_engine_attachment.py

key-decisions:
  - "The shutdown fix is guarded by `is_action_risk`, NOT applied to the whole function — the freshness twin is left destructive-on-deploy because SPEC Req 9 scopes the change to armed checkpoints and no D-185-NN authorises widening"
  - "Task 1's two new tests live in a NEW file `test_ask_user_indefinite_wait.py`, not in `test_ask_user_disposition.py` — the latter's count is then governed only by Task 2's explicit additions"
  - "`_ABORT_LIKE_CHOICES` writes the decline phrase as the SAME literal the choice list returns, lowered in place (`\"Do not run it\".lower()`), so a rename cannot drift the two apart"
  - "The armed prompt is asserted by CALLING `grounding._approval_sentence`, not by a hand-copied string — plan 185-05 can assert against the same value without drift"

requirements-completed: [GOVERN-03]

# Metrics
duration: 20min
completed: 2026-07-29
---

# Phase 185 Plan 04: The Armed Checkpoint Fails Closed — Summary

**An armed action-risk checkpoint now waits forever rather than expiring into a silent "yes", says the honest engine-generated sentence while it waits, routes "Do not run it" to a failed run instead of running the risky step with an approval receipt, and survives a deploy — and every one of those four changes is fenced to armed checkpoints alone by a single predicate, with an unchanged-path control test proving it did not widen.**

## THE EXACT SENTENCE PLAN 185-05 MUST ASSERT AGAINST

Built by **`_approval_sentence(phase, total_phases)`** in `backend/app/services/harness/grounding.py:850`
(private; reached through `effective_phase`, and carried to the pause inside the synthesized spec's
`config["prompt"]`, then across the wire after the `action_risk:approval|` prefix).

For `phase_index=1`, `name="Send the renewal notice"`, `total_phases=4` it is **172 characters**, one line,
ASCII double quotes around the label, single spaces (no newlines):

```
Step 2 of 4, "Send the renewal notice", is about to run. This step is marked as needing your approval first. The run is waiting here and will not continue until you answer.
```

Template:

```
Step {phase_index + 1} of {total_phases}, "{phase.name or phase.slug}", is about to run. This step is marked as needing your approval first. The run is waiting here and will not continue until you answer.
```

**This string is used VERBATIM as the prompt** — on the `ask_user_prompt` SSE (`prompt=`), on the durable
`messages` row (`content` AND `tool_calls[0].prompt`). It is never wrapped in the generic
*"A validation check on phase 'X' flagged: …"* sentence. `test_armed_prompt_is_the_generated_sentence_character_identically`
builds its expectation by **calling `_approval_sentence`**, so plan 185-05 can do the same and the two
assertions cannot drift.

The armed choice pair, verbatim: **`["Approve and run this step", "Do not run it"]`**.

## Performance

- **Duration:** ~20 min (first task commit 2026-07-29T19:49:58+04:00, last 2026-07-29T19:57:09+04:00, plus read/verify)
- **Tasks:** 3
- **Files modified:** 4 (+1 created)

## Task Commits

1. **Task 1: Indefinite `subscribe_for_response` + the L-8 TTL refresh** — `927c5615` (feat)
2. **Task 2: The decline choice must decline — the L-4 fail-open fix** — `98d8fb87` (fix)
3. **Task 3: The armed disposition — no timeout, verbatim prompt, shutdown survives** — `2210cc67` (feat)

## Accomplishments

- **Assumption A1 is no longer an assumption.** The whole fail-closed posture rests on
  `asyncio.wait_for(coro, timeout=None)` waiting rather than raising. It is documented stdlib behaviour and
  was untested in this repo, so it is now asserted directly — **with a positive control**: the same helper
  under `timeout=0.001` raises `asyncio.TimeoutError`, which is what makes the `None` assertion about `None`
  and not about `wait_for` being inert. If a future Python changes that semantic, this test goes red BEFORE
  an armed gate silently starts expiring into "yes".
- **The indefinite mode is a PARAMETER, not a second substrate.** No `subscribe_forever` was added
  (`test_no_parallel_subscribe_forever_helper_was_added` asserts the module has neither that name nor a
  `_subscribe_and_block_forever`), so the load-bearing SUBSCRIBE → SADD → block ordering (Pitfall 2) keeps
  exactly one copy. The annotation widening on both functions is a type-only change on the default path:
  `wait_for(coro, None)` already waited forever, no pre-185 caller passes `None`, and both live call sites
  hard-cast with `float()`.
- **L-8 closed, and the cost of getting it wrong is now visible in the code.** The
  `ask_user:channels:{run_id}` SET is the **discovery index** the Stop sweep (`publish_cancel_sentinel`) and
  the graceful-drain sweep (`broadcast_shutdown_sentinel_to_all`) read; its 3600s TTL is shorter than an
  indefinite wait routinely is, so an armed run past the hour mark would have become **un-Stoppable and
  un-drainable** — the wait itself survives (the SUBSCRIBE is independent), the run just becomes unreachable
  by both escape hatches. The poll loop now re-arms the same TTL every 5 minutes, best-effort, and
  `test_a_failing_ttl_refresh_never_breaks_the_wait` proves a rejected `EXPIRE` costs a user nothing.
- **The L-4 fail-open was real, and the falsification proves the test catches it** (quoted in full below).
  Before this plan, clicking *"Do not run it"* on an armed checkpoint fell through to the **Proceed** branch:
  the step would have run **and** a `validator_ask_user_approved` audit row would have recorded the person
  who declined as having authorised it. That is the exact "consequence ≠ receipt" inversion the audit-ledger
  vocabulary rule exists to prevent.
- **The invariant is pinned, not the instance.** `test_every_presented_choice_pair_is_classified` drives all
  three finding prefixes plus the generic fallback plus the empty finding, and asserts each returns a 2-item
  pair of which **exactly one** is abort-like. A future fourth choice pair cannot be added fail-open without
  going red — which is the durable fix, because the one-line `_is_abort_choice` addition is not.
- **One predicate owns every armed delta.** `is_action_risk` is read off the FINDING prefix (not off the
  phase) because the finding is what identifies *which* validator failed — an armed phase can carry authored
  gates too, and only the armed one gets this disposition. For everything else the predicate is `False` and
  each branch evaluates to exactly the expression that shipped.
- **`None`, never `0`, on both the wire and the durable row.** `PendingAskCard.tsx:184-197` counts a
  null/zero deadline down to *expired* and renders *"No response within 0:00 — agent stopped"*. Sending `0`
  would have rendered every armed prompt as dead the instant it appeared — G-4 scenario 3's named failure,
  shipped by the fix meant to prevent it. Asserted on the emit kwargs AND on the inserted row's
  `tool_calls[0]`, with an explicit `!= 0` alongside the `is None`.
- **A deploy no longer destroys a run parked on a person.** `{"kind": "shutdown"}` was computing
  `choice = ""` → `_is_abort_choice("")` → `fail_run`. Safe, but a routine restart killed the run. The armed
  gate now raises `asyncio.CancelledError` (the shipped 096-09 precedent, quoted in the comment) so the phase
  stays `active` and the durable prompt row survives for the boot-time resume sweep.

## The one scope decision, and how it is proved

**The shutdown fix is guarded by `is_action_risk`.** The freshness gate reaching the same line has the
identical destructive-on-deploy behaviour, and fixing it would have been one character cheaper than not
fixing it. It was not fixed, because:

- SPEC Req 9: *"A plain `llm_human_input` step (checkpoint unset) keeps its **current** timeout disposition
  unchanged."*
- SPEC §Out-of-scope / Interview row 2: *"**Armed checkpoints only.**"*
- No `D-185-NN` decision authorises widening it.

The asymmetry inside `_resolve_failure_with_ask_user` is therefore deliberate and is **stated in the comment
at the branch**, not left to be rediscovered. The freshness twin is already recorded as a deferred item in
`185-CONTEXT.md:446-452` with a re-open trigger (*"the first time a deploy is observed to fail a live run
parked on a freshness gate"*).

`test_shutdown_on_a_NON_armed_gate_still_fails_the_run` is the proof rather than the promise. Removing the
`is_action_risk and` guard turns it red immediately:

```
E           asyncio.exceptions.CancelledError: action-risk checkpoint interrupted by server shutdown — phase left active for the boot-time resume sweep (096-09 precedent)

app\services\harness_engine.py:1066: CancelledError
FAILED tests/unit/test_185_engine_attachment.py::test_shutdown_on_a_NON_armed_gate_still_fails_the_run
1 failed, 14 deselected
```

The guard was restored immediately and the file re-verified green.

## Falsification — the L-4 fail-open was observed RED

Required by the plan (Task 2, mandatory). `_ABORT_LIKE_CHOICES` was temporarily reverted to the shipped
four-value tuple `("abort", "cancel", "stop", "")` and `test_ask_user_disposition.py` re-run. **Three tests
went red**, and the two most important assertions are exactly the ones that assert PROCEED:

```
E           AssertionError: 'action_risk:approval|Step 2 of 4 is about to run.' presented
            ['Approve and run this step', 'Do not run it'], of which 0 classify as abort-like —
            exactly one must. An UNCLASSIFIED decline reads as PROCEED and runs the step with an
            'approved' receipt (L-4).
E           assert 0 == 1
E            +  where 0 = len([])

tests\unit\test_ask_user_disposition.py:342: AssertionError
```

```
>       assert outcome is not None, "a decline returned None — the body would RUN"
E       AssertionError: a decline returned None — the body would RUN
E       assert None is not None

tests\unit\test_ask_user_disposition.py:372: AssertionError
```

`outcome is None` on a **pre-gate** is literally the signal *"run the body"* — so the planted tree does not
merely mis-label the decline, it **runs the risky step**. The third failure was the choice-index (click-path)
twin. The plant was reverted and the tuple is byte-identical to the committed form; the suite is green at
14 passed.

## Files Created/Modified

- `backend/app/services/ask_user_service.py` — `timeout_seconds: float | None` on `_subscribe_and_block` and
  `subscribe_for_response` + a docstring paragraph on each (`None` = wait indefinitely; the type-only nature
  of the change; the *measured* cost — one suspended coroutine and one Redis pub/sub connection, a pure
  asyncio poll, so D-v2.5-01 is satisfied). A module-level `_CHANNELS_TTL_REFRESH_SECONDS = 300` and a
  TTL-refresh block inside `_wait()`'s loop with a comment stating that the WAIT is independent of the SET
  and the SET is only the discovery index. A `# Phase 185 (L-7)` marker on `resume_pending_prompt`'s
  `float()` cast (behaviour unchanged — plan 185-05 owns that path). The SUBSCRIBE → SADD → block **order is
  untouched**.
- `backend/app/services/harness_engine.py` — the `action_risk:approval|` branch in
  `_ask_user_choices_from_finding` (+ docstring bullet + the "every returned string must be classified"
  clause); `_ABORT_LIKE_CHOICES` with the decline phrase and a docstring stating the invariant, the fail-open
  shape and the three untouched shipped choices; and the four armed deltas in
  `_resolve_failure_with_ask_user` (predicate, verbatim prompt, `None` timeout + un-cast subscribe, guarded
  `CancelledError` shutdown branch, and a comment explaining why the `payload is None` → `fail_run` branch is
  kept).
- `backend/tests/unit/test_ask_user_indefinite_wait.py` — **NEW**, 6 tests: A1 with a positive control, `None`
  reaching the block site unmangled, the real primitive waiting and returning under a fully-faked Redis
  (ordering + cleanup asserted), the TTL re-arm, a failing refresh not breaking the rendezvous, and the
  no-`subscribe_forever` fence.
- `backend/tests/unit/test_ask_user_disposition.py` — an `_armed_phase()` fixture + `_ARMED_FINDING` constant
  beside the shipped helpers, and 6 new tests under a Phase-185 banner. **All 8 pre-existing cases are
  untouched** (see Deviations for the count reconciliation).
- `backend/tests/unit/test_185_engine_attachment.py` — 7 new tests under a plan-185-04 banner, with a
  docblock stating why these DO drive the disposition when the attachment tests above are pure.

## Decisions Made

- **Task 1's tests went into a new file rather than `test_ask_user_disposition.py`.** They are about the 085
  substrate (Redis pub/sub, `wait_for` semantics, the TTL), not about the disposition; putting them in the
  disposition file would also have made that file's test count answer to two different tasks. The plan's
  verify command is `-k "ask_user"`, which collects the new file by name.
- **The decline phrase is written as `"Do not run it".lower()` inside the tuple**, not as a pre-lowered
  string literal and not as a shared constant referenced twice. It keeps the *same literal* the choice list
  returns physically present at the classification site, so a rename that misses one place is visible on one
  screen — and it satisfies the acceptance grep (`"Do not run it"` appears 3× in the file: choice list,
  abort tuple, docstring).
- **Criterion 20 is pinned by `inspect.getsource`, not by `git diff`.** A test that shells out to git would
  stop meaning anything the moment this plan's own commit landed. The source fence asserts the shipped clamp
  (`settings.ask_user_max_timeout_seconds`), the shipped `float(timeout_seconds)` cast and the shipped
  `answer = ""` are all still present, that no armed vocabulary leaked in, and — Req 9's third bullet — that
  the unarmed copy never claims the run waits. The `git diff --stat` check is also reported below.
- **The armed test fixture runs the REAL synthesis** (`effective_phase` on an armed `_agent_phase` with
  `execute_code`, a non-KB tool, so only the armed gate attaches). The prompt under test is therefore the
  real generated sentence rather than a hand-copied twin, and `validators[0]` is unambiguously the armed
  pre-gate.

## Deviations from Plan

### Reconciliation, not a change

**1. [Rule 3 - Blocking] Task 3's "SAME test count as before this plan" criterion vs Task 2's explicit
instruction to add tests to the same file.**

- **Found during:** Task 3 verification.
- **Criterion:** *"`pytest tests/unit/test_ask_user_disposition.py -q` exits 0 with the SAME test count as
  before this plan (no pre-existing case edited)."*
- **Conflict:** Task 2's action says *"Add a unit test in `test_ask_user_disposition.py`"* and its own
  acceptance requires the invariant guard to live there. Both cannot hold literally.
- **Resolution:** the parenthetical is the binding intent — **no pre-existing case edited**. All 8 shipped
  cases are byte-identical and all 8 pass; the file is now at **14** (8 + Task 2's 6). Task 3 added **zero**
  tests to that file, so the count is unchanged across Task 3, which is what the criterion's position (in
  Task 3, next to the criterion-20 byte-identity check) is actually guarding.

### Auto-fixed issues

None. No Rule-1 bug, no Rule-2 missing critical functionality, no Rule-3 blocker, no package install, no
architectural question.

### Small judgement calls inside the plan's own latitude

- 6 tests in `test_ask_user_disposition.py` where the plan named 3 + the guard. The extras are the
  choice-pair regression fence (the three shipped branches asserted unchanged beside the new one) and the
  choice-**index** click path — a click arrives as `{response_text: "", choice_index: 1}`, and the typed and
  clicked declines routing identically is the thing a user actually does.
- 6 tests in the new `test_ask_user_indefinite_wait.py` where the plan named 2. The extras are the TTL
  refresh, the failing-refresh tolerance and the no-`subscribe_forever` fence — all three are Task 1
  acceptance criteria that would otherwise have been reported as greps.
- A module-level `_CHANNELS_TTL_REFRESH_SECONDS` constant. The plan's Task-1 acceptance enumerates the
  allowed diff regions and a module constant is technically a fifth region; it is the refresh block's own
  interval and the alternative was a bare `300` inside the loop. **Line 81's original
  `await redis.expire(channels_set_key, 3600)` is byte-identical** — the refresh re-arms the same literal
  TTL, with a comment saying so.

## Verification Evidence

| Check | Result |
|---|---|
| `pytest tests/unit -q -k "ask_user"` | **16 passed** (8 shipped disposition + 6 Task-2 + … see below) |
| `pytest tests/unit/test_ask_user_disposition.py -q` | **14 passed** (8 pre-existing, all untouched, + 6 new) |
| `pytest tests/unit/test_ask_user_indefinite_wait.py -q` (inside the `-k` run) | **6 passed** |
| `pytest tests/unit/test_185_engine_attachment.py -q` | **15 passed** (8 from plan 03 + 7 new) |
| Combined: `test_185_engine_attachment.py + test_ask_user_disposition.py` | **29 passed** |
| With `test_validator_kinds.py + test_185_detection.py` added | **86 passed** |
| Scoped run `-k "harness or grounding or 185 or ask_user or validator or gate or workflow or publish"` | **274 passed**, 1374 deselected |
| `grep -c "timeout_seconds: float \| None" ask_user_service.py` | **2** (both functions) |
| `grep -c "def subscribe_forever\|async def subscribe_forever" ask_user_service.py` | **0** |
| `grep -c 'action_risk:approval\|' harness_engine.py` | **3** (≥ 1 required) |
| `grep -c '"Do not run it"' harness_engine.py` | **3** (≥ 2 required — choice list, abort tuple, docstring) |
| `grep -c "is_action_risk" harness_engine.py` | **6** (≥ 4 required) |
| `grep -c "asyncio.CancelledError" harness_engine.py` | **2** (`:1051` the comment, `:1066` the raise — both inside `_resolve_failure_with_ask_user`) |
| **`git diff --stat -- backend/app/services/harness/phase_types.py`** | **0 files** — `_exec_llm_human_input` byte-identical (SPEC criterion 20) |
| `git diff --stat -- supabase/migrations` | **0 files** — live head stays 113 |
| `git diff --stat -- frontend/` | **0 files** — backend-only |
| D-14 Deep fence: `agent_loop.py`, `tool_dispatcher.py`, `openai_service.py`, `anthropic_service.py` | **0 files** |
| L-4 falsification | **observed RED** — 3 tests, output quoted above, plant reverted byte-clean |
| Scope falsification (remove the `is_action_risk` shutdown guard) | **observed RED** — the non-armed control, output quoted above, guard restored |
| Post-commit deletion check on all 3 commits (`git diff --diff-filter=D HEAD~1 HEAD`) | **empty** — no file deleted |
| Armed subscribe 4th arg | **`None`** (asserted on the mock) ; freshness control → **`float`** |
| `ask_user_prompt` emit + durable row `timeout_seconds` | **`None`** on both (with an explicit `!= 0`) |

## Issues Encountered

**The full `tests/unit` suite is still not green, and was not green before this phase.** The plan's
`<verification>` line "`pytest tests/unit -q` — green" remains unachievable on this tree, exactly as plans
185-02 and 185-03 recorded: ~62 pre-existing failures in unrelated files (`test_retrieval_service`,
`test_sql_service`, `test_explorer_agent`, `test_multimodal_query`, one unmocked live-provider test). They
are logged in this phase's `deferred-items.md` with a re-open trigger and were **not** touched (executor
scope boundary). The 274-passed scoped run is the honest substitute.

**Four untracked files exist under `backend/`** (`RUN-BACKEND.md`, two `scripts/115_*_results.json`,
`settings_override.json.migrated`). They are **pre-existing**, not produced by this plan, and were left
alone — staging or gitignoring another plan's artefacts is out of scope.

## Known Stubs

None. Every value this plan introduces is a real routing decision, a real Redis call or a real generated
string. The `None` timeout is not a placeholder — it *is* the disposition (SPEC Req 9's "no answer means the
run never proceeds"), and the `payload is None` → `fail_run` branch is deliberately kept as the fail-closed
reading of an unparseable answer.

**Two things this plan knowingly does NOT do**, both out of scope and both already carried elsewhere:

- **L-5** — the pre-gate still emits `gate_failed` before it can pause, so an armed step merely *waiting*
  announces a failure to the frontend. Named in 185-03's Next-Phase-Readiness as still open; not in this
  plan's five deltas.
- **L-7** — the boot-time resume sweep still will not `resume_pending_prompt` an armed pre-gate (it gates on
  `_is_llm_human_input`), so a restart re-asks with a fresh `tool_call_id` and orphans the old row. The
  `# Phase 185 (L-7)` marker is in place at `resume_pending_prompt`'s `float()` cast; **plan 185-05 owns
  that path.**

## Threat Flags

None. No new network endpoint, no new auth path, no file-access pattern, no schema change at a trust
boundary. The plan's register is discharged as follows:

| Threat ID | Disposition | Delivered |
|---|---|---|
| T-185-04-01 (elevation — an unrecognised decline reads as PROCEED) | mitigate | `_ABORT_LIKE_CHOICES` extended AND pinned by `test_every_presented_choice_pair_is_classified` over every prefix + the fallback. Falsification observed RED. |
| T-185-04-02 (DoS — the indefinite wait) | accept | Cost re-verified and written into the docstring: one suspended coroutine + one pub/sub connection, a pure asyncio poll — not a thread, not the loop. No watchdog kills it (`wall_clock` wraps `_execute_phase` only; the pre-gate is outside it). |
| T-185-04-03 (repudiation — the approval receipt) | accept | The shipped `validator_ask_user_approved` row is unchanged; `test_armed_approval_runs_the_body_and_writes_the_receipt` asserts it carries the chosen text, and both decline tests assert **zero** receipts. |
| T-185-04-04 (DoS — an un-Stoppable >1h wait) | mitigate | The channels-SET TTL is re-armed from inside the poll loop, best-effort, with a test for the refresh and a test that a failed refresh does not break the wait. |
| T-185-04-05 (tampering — who is allowed to answer) | accept | Untouched; the POST endpoint owns it. "Someone else approved it" is Phase 186. |

## User Setup Required

None — no external service configuration, no environment variable, no migration. Live migration head stays
at **113**.

## Next Phase Readiness

- **185-05 is unblocked and inherits three concrete obligations from this plan.** (1) `PendingAskCard` must
  render `timeout_seconds: null` as *no deadline* rather than counting it down to expired — the backend now
  sends `null` on both the SSE and the durable row, so an unfixed card would show every armed prompt as
  "No response within 0:00 — agent stopped" (L-15). (2) It owns the L-7 resume path: widening
  `resume_pending_prompt`'s `float(timeout_seconds)` cast (the marker comment is in place) and teaching the
  boot sweep to re-subscribe an armed pre-gate. (3) Its prompt assertion should call
  `grounding._approval_sentence` rather than hard-coding the 172-character sentence quoted above.
- **The choice pair is now a published contract.** Any surface rendering the armed prompt's options must
  expect exactly `["Approve and run this step", "Do not run it"]`, and any new pair added anywhere must
  extend `_ABORT_LIKE_CHOICES` in the same commit or the invariant guard fails.
- **L-5 is still open** — an armed step still emits `gate_failed` before it pauses. Whoever owns the run
  surface (188) or an earlier fix should expect the frontend to currently render a *waiting* armed step as a
  *failed* one.
- **The freshness gate is still destroyed by a graceful deploy.** Deliberate, scoped, recorded in
  `185-CONTEXT.md:446-452` with a re-open trigger, and fenced by a control test so nobody fixes it by
  accident without noticing they are widening the phase's authorised scope.

## Self-Check: PASSED

- `backend/app/services/ask_user_service.py` — FOUND
- `backend/app/services/harness_engine.py` — FOUND
- `backend/tests/unit/test_ask_user_indefinite_wait.py` — FOUND
- `backend/tests/unit/test_ask_user_disposition.py` — FOUND
- `backend/tests/unit/test_185_engine_attachment.py` — FOUND
- Commit `927c5615` — FOUND
- Commit `98d8fb87` — FOUND
- Commit `2210cc67` — FOUND

---
*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Completed: 2026-07-29*
