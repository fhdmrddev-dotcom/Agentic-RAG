---
phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial
plan: 05
subsystem: api
tags: [python, harness, workflow-engine, governance, ask-user, audit-vocabulary, resume-sweep, react, typescript, vitest, pytest, zero-migration]

# Dependency graph
requires:
  - phase: 185-04
    provides: "the armed disposition inside `_resolve_failure_with_ask_user` (verbatim prompt, `timeout_seconds=None` on the emit AND the durable row, the `CancelledError` shutdown escape), plus the `# Phase 185 (L-7)` marker on `resume_pending_prompt`'s `float()` cast"
  - phase: 185-03
    provides: "the `action_risk:approval|<sentence>` structured finding the two new readings key on"
  - phase: 096-09
    provides: "`run_workflow`'s `is_app_shutting_down()` skip of `_expire_pending_ask_user` — the reason an orphaned prompt row survives a graceful deploy unexpired"
  - phase: 085-ask-user
    provides: "`resume_pending_prompt` / `_subscribe_and_block` and the `ask_user:{run_id}:{tool_call_id}` channel"
  - phase: 087-workspace-panel
    provides: "`PendingAskCard` — the shipped prompt surface the wait renders on (D-185-13: this phase adds no new run-time surface)"
provides:
  - "`_is_action_risk_finding` + `_ACTION_RISK_FINDING_PREFIX` — the ONE reading of 'this gate is about to wait', shared by the pre-gate announce block and the disposition"
  - "the `action_risk_pending` event vocabulary (audit `event_type` + producer-stream SSE), replacing `gate_failed` for an armed pause ONLY — Phase 188's run surface is the consumer"
  - "`_is_armed_action_risk(active_phase, definition)` — a second named resume predicate beside an untouched `_is_llm_human_input`"
  - "the boot sweep's step-2b armed branch: re-subscribe the SAME `tool_call_id` with `timeout_seconds=None` (L-7 fix (a))"
  - "`resume_pending_prompt` / `_emit_ask_user_prompt` accept `float | None`; the coercion is `None`-preserving"
  - "`PendingAsk.timeout_seconds: number | null` + `NO_DEADLINE_WAITING_LINE` — a null deadline renders as an open-ended wait, never as expired"
affects: [185-06, 185-07, 185-08, 186-run-time-twin, 188-run-surface, 189-external-actions]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "One predicate, two call sites: an armed pause is recognised by ONE function reading the finding prefix, so the ledger vocabulary and the disposition can never disagree about what is happening"
    - "A second named predicate beside the old one, never a widening of it: `_is_llm_human_input` stays byte-identical and `_is_armed_action_risk` answers a different question from a different source (the parsed definition, not the stored row)"
    - "Purely-additive insertion point: the sweep's new branch runs AFTER the existing definition load, so the shipped branch and the load above it show ZERO deleted lines in the diff"
    - "Total-over-null rather than arithmetic-on-null: a nullable countdown is guarded by ONE `hasDeadline` reading that makes the expiry transition unreachable, instead of coercing the null into a number"
    - "The honesty fence is a two-sided test: the waiting sentence is asserted PRESENT on the armed card and ABSENT on the unarmed one, so 'the surface never over-claims' is a test result"

key-files:
  created: []
  modified:
    - backend/app/services/harness_engine.py
    - backend/app/services/ask_user_service.py
    - backend/tests/unit/test_185_engine_attachment.py
    - frontend/src/types/index.ts
    - frontend/src/lib/api.ts
    - frontend/src/components/panel/PendingAskCard.tsx
    - frontend/src/components/panel/__tests__/PendingAskCard.test.tsx

key-decisions:
  - "L-7 fix (a) — re-subscribe the SAME tool_call_id — chosen over expire-and-re-ask, with the rationale written at the branch: re-asking with a new id IS G-4 scenario 3's named failure from the person's chair"
  - "The armed branch is inserted AFTER the existing `_load_run_definition` call rather than moving the load earlier, so the shipped step-2 branch is byte-identical and the whole sweep diff is additive"
  - "`_is_armed_action_risk` reads the parsed `WorkflowDefinition`, not `workflow_phases.config` — an armed step's stored config says `llm_agent` and its output is null, so the row cannot answer the question"
  - "The `action_risk_pending` audit row carries `{phase, timing}` and NOT the raw finding: the finding IS the person's prompt sentence and already reaches the browser on the durable `ask_user_prompt` row (T-185-05-04)"
  - "`NO_DEADLINE_WAITING_LINE` is a single exported const rendered ONLY when `timeout_seconds` is null, and it says nothing about who may answer (that is Phase 186)"
  - "The `float(timeout_seconds)` grep criterion is reported as a plan-internal contradiction rather than satisfied by an alias — see Deviations"

patterns-established:
  - "Pattern: waiting-is-not-failing — a gate whose disposition is a human pause must never announce a failure first; the ledger records the consequence, the receipt is a separate row"
  - "Pattern: prompt identity is the contract — a resume that preserves `tool_call_id` keeps the card the person is looking at and the channel the run is listening on the same object"

requirements-completed: [GOVERN-03]

# Metrics
duration: 40min
completed: 2026-07-29
---

# Phase 185 Plan 05: The Armed Wait Is Honest End To End — Summary

**An armed checkpoint now records and announces its pause as a pause instead of a `gate_failed`, survives a worker restart by re-subscribing the exact prompt the person is already looking at (with no deadline re-introduced), and renders on a card that reads a null deadline as an open-ended wait rather than counting it down to "No response within 0:00 — agent stopped" — and each of the three is fenced by a control test proving no other gate's, no other resume path's, and no deadline-bearing card's behaviour moved.**

## G-4 scenario 3, answered plainly

The success criterion is: *arm a step, launch, close the tab, restart the backend, come back much later.*

| Half of the scenario | Status after this plan |
|---|---|
| **The run has not advanced** | **True, and unit-proven.** The pre-gate subscribes with no timeout (185-04) and an unanswered armed gate returns `fail_run`, never `None` — and `None` on a pre-gate is literally "run the body". |
| **The prompt SURVIVED the restart** | **True, and unit-proven.** 185-04 raises `CancelledError` on the shutdown sentinel so the phase stays `active` and the durable row is not expired; `find_resumable_runs` therefore still sees the run. |
| **The prompt is REACHABLE after the restart** | **True, and unit-proven at the sweep level.** The new step-2b branch re-subscribes the SAME `tool_call_id` the durable row carries, so `/pending` serves exactly one card and the run is listening on its channel. |
| **It does not claim to have expired** | **True, and unit-proven at the component level.** With `timeout_seconds: null` the card renders pending after 100 000 s of fake-timer advance, shows no clock, and shows the waiting line. |
| **Nothing called the wait a failure** | **True, and unit-proven.** The armed pre-gate writes one `action_risk_pending` audit row and emits `action_risk_pending`; zero `gate_failed` in either channel. |

### What still needs LIVE operator UAT to prove

Every claim above is a unit-level claim. The following are **not** proven by this plan and belong to the phase's G-4 Chrome-MCP pass:

1. **The end-to-end restart itself** — the sweep was driven with `find_resumable_runs` / `claim_run` / `get_active_phase` / `_load_run_definition` all mocked. That an ARMED run genuinely reaches `find_resumable_runs` (status `active` + thread anchor + an `active` `workflow_phases` row) after a real `Ctrl-C`/redeploy is an integration fact no unit test asserts.
2. **`/pending` really serving the resumed card** to a reconnected browser, and the SSE re-emit landing in `StreamsProvider` with `timeout_seconds: null` intact through the real wire.
3. **The answer routing through the resumed subscription** — that a click on the resumed card publishes onto the channel the sweep re-subscribed, rather than into a dead one.
4. **The residual second ask** (see below) — how it actually feels to an operator.
5. **The visual** of the no-deadline card: the header row now has no clock on the right, and the waiting line sits beneath it. jsdom computes no paint.

### One residual, stated honestly

**An armed checkpoint answered *during* a resume is asked once more.** When the person answers the resumed prompt, `resume_pending_prompt` returns and the sweep proceeds to `_resume_run`, which re-runs the still-`active` phase from the top; the pre-gate fires again and mints a NEW `tool_call_id`.

This is strictly better than what shipped before — that path produced a fresh ask *anyway*, while leaving the old row un-expired on the graceful-shutdown path, so `/pending` served a DEAD card next to a live one. That is the failure G-4 scenario 3 names, and it is closed: there is now exactly one live prompt at a time and it is always the one the run is listening to. The residue is an extra ask, never an unreachable card, and it is fail-CLOSED throughout.

Closing it means `_resolve_failure_with_ask_user` must read the durable answer before minting a prompt (the short-circuit `_exec_llm_human_input` performs) — a DB read and a resume-identity contract at the disposition seam, i.e. an architectural change outside this plan's three tasks and outside SPEC Req 9's wording. **Recorded in `deferred-items.md` with a concrete re-open trigger** (the first live UAT where an operator is asked twice, or Phase 188).

## Performance

- **Duration:** ~40 min (first task commit 2026-07-29T20:42:00+04:00, last 2026-07-29T21:17:55+04:00, plus reads and the count-gate runs)
- **Tasks:** 3
- **Files modified:** 7 (0 created)

## Task Commits

1. **Task 1: An armed step that is waiting must not announce a failure** — `7a55b9da` (fix)
2. **Task 2: The resume sweep re-subscribes the armed prompt the person is looking at** — `a4010b46` (fix)
3. **Task 3: A prompt with no deadline renders as waiting, not as expired** — `fa2b56da` (fix)

## Accomplishments

- **The ledger no longer asserts something that did not happen.** `harness_engine.py`'s pre-gate failure block wrote a `gate_failed` audit row and emitted a `gate_failed` SSE *before* calling the disposition that pauses. For an armed checkpoint nothing failed — `action_risk_approval` "fails" by design precisely so the shipped `ask_user` disposition owns the wait. The block now branches on the finding: an armed pause writes `event_type="action_risk_pending"` with `{phase, timing}` and emits `action_risk_pending` with `phase` only. **Every other failing pre-gate is byte-identical**, and that is a test result, not an inspection — falsified RED by planting an always-true predicate, which turned the freshness control red immediately.
- **The raw finding is deliberately NOT on the second channel (T-185-05-04).** The finding IS the user-facing prompt sentence, and it already reaches the browser through the durable `ask_user_prompt` row and its emit. Duplicating it onto the audit metadata and a second SSE would add exposure for nothing. Asserted: `"action_risk:approval|" not in str(metadata)`, and the emit's kwargs are exactly `{"phase": ...}`.
- **L-7 closed with fix (a), and the reason is in the code.** The sweep's re-subscribe branch was gated on `_is_llm_human_input(active)`, which is False for an armed `llm_agent` — its stored `config.phase_type` is `llm_agent` (arming is a VALIDATOR, never a step) and its `output` is null (the phase never completed). So the run was re-driven and re-asked with a NEW `tool_call_id` while the OLD durable row was never expired on the graceful path. The new step-2b branch re-subscribes the SAME id, indefinitely. The rationale — *"re-asking with a new id IS 'the prompt survived but is unreachable' from the person's chair"* — is written at the branch, not left to be rediscovered.
- **The two resume predicates are independent, and the suite says so.** `_is_llm_human_input` is **byte-unchanged**: the entire `harness_engine.py` diff for Task 2 is three hunks with **zero deleted lines**. `test_the_two_resume_predicates_are_independent` drives the same armed-`llm_agent` row through both and asserts False / True respectively — so a future reader cannot conclude one was a widening of the other.
- **A restart cannot re-introduce a deadline.** `resume_pending_prompt` hard-cast `float(timeout_seconds)`; it now preserves `None` while coercing a real number exactly as it shipped, and the armed branch passes `None`. The `llm_human_input` control test asserts its resume still arrives with `300`.
- **The card was going to render every armed prompt as dead on arrival.** `PendingAskCard` seeded `remaining` from `timeout_seconds` and flipped to `expired` at 0 — with 185-04 now sending `null`, the shipped card would have shown *"No response within 0:00 — agent stopped"* the instant the prompt appeared: **G-4 scenario 3's named failure, shipped by the fix meant to prevent it.** The countdown is now TOTAL over the null case: one `hasDeadline` reading, an early return in the tick effect that makes the `expired` transition unreachable, no clock rendered, and no `formatClock` call on a null anywhere.
- **The honesty fence cuts both ways.** SPEC Req 9's third acceptance bullet forbids the surface claiming "the run waits" on an unarmed step. `NO_DEADLINE_WAITING_LINE` is one exported const, asserted character-identically **present** on the null-deadline card and **absent** (`queryByText → null`) on the `timeout_seconds: 300` card, whose countdown is asserted untouched in the same test.
- **Zero migrations, zero `phase_types.py`, zero Deep-path files** across all three commits.

## Falsification — all three tasks observed RED

Not claimed, run:

**Task 1** — `_is_action_risk_finding` planted to `return True`:

```
>       assert _audit_event_types(write_audit) == ["gate_failed"]
E       AssertionError: assert ['action_risk_pending'] == ['gate_failed']
FAILED tests/unit/test_185_engine_attachment.py::test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped
1 failed, 17 deselected
```

The test that went red is the **freshness control** — i.e. it genuinely detects a widening, which is the whole reason it exists.

**Task 2** — `_is_armed_action_risk` planted to `return False`:

```
E       AssertionError: assert False is True          # the independence assertion
E       AssertionError: assert 0 == 1                 # resume_pending_prompt was never called
2 failed, 20 deselected
```

**Task 3** — the `if (!hasDeadline) return` guard disabled:

```
FAIL  PendingAskCard (185-05) — a null deadline is a wait, never an expiry >
      stays pending forever with timeout_seconds: null …
FAIL  PendingAskCard (185-05) — a null deadline is a wait, never an expiry >
      renders the waiting line verbatim from the exported const …
Tests  2 failed | 25 passed (27)
```

All three plants were reverted and each suite re-verified green.

## Files Created/Modified

- `backend/app/services/harness_engine.py` — `_ACTION_RISK_FINDING_PREFIX` + `_is_action_risk_finding` beside `_is_abort_choice` (and `_resolve_failure_with_ask_user`'s inline `.startswith` swapped to it, so there is one reading); the branched pre-gate announce block with the "waiting is not failing" comment; `_is_armed_action_risk` beside an untouched `_is_llm_human_input`; the sweep's step-2b armed branch plus a step-2b bullet in `resume_stranded_workflows`' docstring. **Every Task-2 hunk is additive — zero deleted lines.**
- `backend/app/services/ask_user_service.py` — `resume_pending_prompt` and `_emit_ask_user_prompt` annotations widened to `float | None`, a docstring paragraph on each, and the `None`-preserving coercion replacing the bare hard cast (the `# Phase 185 (L-7)` marker 185-04 left is now the explanation of the change rather than a TODO).
- `backend/tests/unit/test_185_engine_attachment.py` — 7 new tests under two banners: 3 for the L-5 vocabulary (ledger half, SSE half, freshness byte-identity control) and 4 for L-7 (predicate independence including the unarmed/absent-slug/None-definition edges, the same-id + no-deadline re-subscribe, the no-durable-row fall-through, and the `llm_human_input` byte-identity control). **22 tests total in the file** (8 from 185-03 + 7 from 185-04 + 7 here).
- `frontend/src/types/index.ts` — `PendingAsk.timeout_seconds: number | null` with a doc comment naming Phase 185 / GOVERN-03 and what `null` means.
- `frontend/src/lib/api.ts` — the `ask_user_prompt` SSE parse stops casting the value to `number` (see Deviations).
- `frontend/src/components/panel/PendingAskCard.tsx` — the exported `NO_DEADLINE_WAITING_LINE` + its rationale docblock; the `hasDeadline` reading; the guarded countdown seed and tick effect; the clock rendered only when there IS a deadline; the waiting line rendered only when there is not; and the expired copy narrowed with a `typeof` check so `formatClock` is never called on a null.
- `frontend/src/components/panel/__tests__/PendingAskCard.test.tsx` — 4 new tests (never-expires under advanced fake timers, the verbatim waiting line, the unarmed absence control, and an axe pass for the new state). **27 tests, up from 23** — the two pre-existing expiry `it()` blocks are byte-identical; the file's only two deleted lines are the two `import` statements that gained `act` and `NO_DEADLINE_WAITING_LINE`.

## Decisions Made

- **The armed sweep branch was inserted AFTER the existing `_load_run_definition` call, not by moving the load earlier.** The branch needs the parsed definition; the sweep already loads it one step later. Moving the load up would have changed the ordering of the `definition is None → continue` skip relative to the shipped `llm_human_input` re-subscribe (WR-02's "skip THIS run only" behaviour). Inserting after it leaves both untouched and makes the whole sweep diff purely additive.
- **The armed branch is guarded by `not _is_llm_human_input(active)`.** A definition could in principle mark an `llm_human_input` slug as armed. The shipped branch must win — its disposition is explicitly out of scope (SPEC Req 9). The control test uses exactly that fixture (an armed definition for an `llm_human_input` active row) and asserts the original branch, with its original `300`, still fires.
- **`_is_armed_action_risk` returns False for a missing definition or a slug the definition no longer carries.** Both fall through to the ordinary re-drive, which re-attaches the pre-gate and re-asks — fail-closed either way. Asserted.
- **The waiting line renders BELOW the header row rather than inside the clock slot.** "In place of the countdown" is honoured (no clock renders at all without a deadline), but the header is a 10 px uppercase mono row with `tracking-wider`; a 78-character sentence in it would be unreadable. There is exactly ONE home for the sentence, which is what the test asserts against.
- **The expired-state fallback for a null deadline says "This prompt is no longer active", not "0:00".** That branch is unreachable today — a no-deadline card can only reach `expired` via the 404 path, which always supplies `expiredMessage` — but an unreachable branch that would print a lie is still a lie waiting to happen.

## Deviations from Plan

### Documented plan-internal contradiction (no code change forced)

**1. [Rule 3 - Blocking] Task 2's `float(timeout_seconds)` acceptance grep contradicts Task 2's own action text.**

- **Found during:** Task 2 verification.
- **The action says:** *"change `float(timeout_seconds)` … to pass `None` through unchanged while still coercing a real number (`None if timeout_seconds is None else float(timeout_seconds)`)"* — it spells the exact expression it wants.
- **The criterion says:** *"`grep -c "float(timeout_seconds)" backend/app/services/ask_user_service.py` returns 0; the coercion is the `None`-preserving form."*
- **The conflict:** the expression the action mandates *contains* the substring the criterion forbids. Both cannot hold literally. The only ways to score 0 are (a) drop the coercion entirely — the action explicitly says keep it — or (b) alias the parameter to a differently-named local purely to dodge a substring, which makes the grep meaningless while the code is identical (the 185-03 prose-trap lesson in reverse).
- **Resolution:** the action text and the criterion's own second clause are the binding intent. The shipped line is the plan's own expression. Proved with two greps instead:
  - `grep -c "None if timeout_seconds is None else float(timeout_seconds)"` → **1** (the `None`-preserving form is present)
  - `grep -c "tool_call_id, float(timeout_seconds)"` → **0** (the bare hard cast at the call site is gone — the thing the criterion was actually guarding)

### Auto-fixed issues

**1. [Rule 2 - Missing Critical] The `ask_user_prompt` SSE parse laundered `null` into `number`.**

- **Found during:** Task 3.
- **Issue:** `frontend/src/lib/api.ts:838` read `timeout_seconds: parsed.timeout_seconds as number`. With `PendingAsk.timeout_seconds` widened to `number | null`, that assignment still compiles — so the SSE path, which is the exact path an armed prompt arrives on, would keep asserting to every future reader that the value is a number when it can be `null`. Runtime is unaffected (the cast is erased), but the next person to write `timeout_seconds - x` against that field would have been told by the compiler that it was safe.
- **Fix:** cast to `number | null` with a one-line comment naming Phase 185.
- **Files modified:** `frontend/src/lib/api.ts` (2 lines).
- **Verification:** `npx tsc -b` reports zero errors naming `api.ts`; the panel suite is unchanged at +4 tests.
- **Committed in:** `fa2b56da` (Task 3 commit).
- **Note:** `api.ts` is not in the plan's `files_modified`. It is the one-line entry point for the value the plan exists to plumb, so leaving the type lie in place would have defeated Task 3's own contract.

### Small judgement calls inside the plan's own latitude

- 7 backend tests where the plan named 6. The extra is `test_an_armed_phase_with_no_durable_prompt_row_falls_through_unchanged` — the crash-before-the-insert edge the plan's action names in prose ("belt and braces") but does not list among its tests.
- 4 frontend tests where the plan named 3. The extra is the axe pass for the new no-deadline state, matching the file's existing per-state a11y discipline (Phase 088-01 shipped one for each of pending / answered / expired).
- `_emit_ask_user_prompt`'s annotation was widened alongside `resume_pending_prompt`'s. The plan named only the latter, but the former is the function the latter hands `None` to, and it serializes the value onto the wire — leaving it annotated `float` would have been the same type lie as the `api.ts` one, on the other side of the same hop.

---

**Total deviations:** 1 documented plan-internal contradiction (no code change forced) + 1 auto-fix (Rule 2, missing critical).
**Impact on plan:** No scope creep. The auto-fix is 2 lines on the data contract the plan's own Task 3 defines.

## Issues Encountered

**A one-off flake sent me chasing a phantom regression.** The first `npx vitest run src/components/panel` after Task 3 reported 3 failures: 2 in `PhaseTimeline.test.tsx` (axe) and 1 in `FilePreview.test.tsx`. Rather than assume, the four Task-3 files were backed up outside the tree, reverted to HEAD, and the panel directory re-run: **the same 2 `PhaseTimeline` failures appear WITHOUT this plan's changes**, and `FilePreview` passed on that run and on the two after it. Work restored; the post-restore run reports the identical 2 failures with 169 passed (+4). Both findings are recorded in `deferred-items.md` against SEED-056.

**The full `tests/unit` suite is still not green, and was not green before this phase** — ~62 pre-existing failures in unrelated files (`test_retrieval_service`, `test_sql_service`, `test_explorer_agent`, `test_multimodal_query`, one unmocked live-provider test), already logged in `deferred-items.md` by 185-02. The plan's `<verification>` line "`pytest tests/unit -q` — green" remains unachievable on this tree; the 281-passed scoped run is the honest substitute.

## Verification Evidence

| Check | Result |
|---|---|
| `pytest tests/unit/test_185_engine_attachment.py -q` | **22 passed** (8 from 185-03 + 7 from 185-04 + 7 new) |
| `pytest tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py -x -q` | **32 passed** |
| `pytest tests/unit -q -k "185 or ask_user or resume"` | **83 passed**, 1572 deselected |
| Scoped run `-k "harness or grounding or 185 or ask_user or validator or gate or workflow or publish or resume"` | **281 passed**, 1374 deselected |
| `grep -c "action_risk_pending" harness_engine.py` | **2** (the audit `event_type` and the emit name — ≥ 2 required) |
| `grep -c 'event_type="gate_failed"' harness_engine.py` — **before** (`git show HEAD:…`) / **after** | **3 / 3** — unchanged |
| `grep -c "_is_armed_action_risk" harness_engine.py` | **3** (definition, sweep condition, docstring reference — ≥ 3 required) |
| `git diff` deleted lines inside `_is_llm_human_input` | **0** — all three Task-2 hunks are `-N,0` (pure insertions) |
| `grep -c "None if timeout_seconds is None else float(timeout_seconds)"` / `grep -c "tool_call_id, float(timeout_seconds)"` | **1 / 0** — see Deviations for the criterion reconciliation |
| `grep -c "timeout_seconds: float \| None" ask_user_service.py` | **4** (both 185-04 functions + both widened here) |
| `grep -c "timeout_seconds: number \| null" types/index.ts` | **1** |
| `npx vitest run …/PendingAskCard.test.tsx` | **27 passed** (23 pre-existing + 4 new — count INCREASED, no case deleted) |
| Deleted lines in `PendingAskCard.test.tsx` | **2**, both `import` statements. **0 inside either pre-existing expiry `it()` block.** |
| `npx vitest run src/components/panel` — at HEAD vs after Task 3 | **2 failed / 165 passed** → **2 failed / 169 passed**; identical failures (`PhaseTimeline` axe ×2), pre-existing |
| `npx tsc -b` | **33 errors** (the ~33 baseline); **0** naming `PendingAskCard.tsx`, `types/index.ts` or `lib/api.ts` |
| `node scripts/vitest-count-gate.cjs` | **no `[count-decrease]`, no `[total-below-baseline]`, no `[missing-file]`.** Total **1574** (pinned 424, all deltas ≥ 0). Sole reason: `[failing-tests]`, which read **20 then 24 on an unchanged tree** — the documented SEED-056 churn. **PASSES the `185-VALIDATION.md` §"Count-gate posture" rule.** |
| Full-suite failing-file list (63 files) scanned for `PendingAsk` | **absent** — no new failing test in any file this plan touched |
| **`git diff --stat 7a55b9da~1..HEAD -- backend/app/services/harness/phase_types.py`** | **0 files** — `_exec_llm_human_input` still byte-identical (SPEC criterion 20) |
| `git diff --stat 7a55b9da~1..HEAD -- supabase/migrations` | **0 files** — live head stays 113 |
| D-14 Deep fence: `agent_loop.py`, `tool_dispatcher.py`, `openai_service.py`, `anthropic_service.py` | **0 files** |
| Post-commit deletion check on all 3 commits | **empty** — no file deleted |
| Falsification, Task 1 / Task 2 / Task 3 | **all observed RED**, outputs quoted above, all plants reverted byte-clean |

## Known Stubs

None. Every value introduced is a real routing decision, a real audit vocabulary, a real Redis subscribe or a real rendered sentence.

Three things are deliberately *absent* rather than stubbed, each for a stated reason:

- **No frontend handler for `action_risk_pending`.** An unhandled SSE event is inert, and the `ask_user_prompt` emit that follows immediately is what the person actually sees (D-185-13). The consumer is Phase 188's run surface, recorded in the emit's comment.
- **The `NO_DEADLINE_WAITING_LINE` says nothing about who may answer.** "Someone else approved it" is Phase 186; promising it here would be a second lie on a surface this plan exists to make honest.
- **The `expired` fallback for a null deadline is unreachable** (only the 404 path can get there, and it always supplies its own message) but is still written honestly rather than left to print `0:00`.

## Threat Flags

None. No new network endpoint, no new auth path, no file-access pattern, no schema change at a trust boundary. The plan's register is discharged as follows:

| Threat ID | Disposition | Delivered |
|---|---|---|
| T-185-05-01 (repudiation — the audit vocabulary) | mitigate | The armed pause writes `action_risk_pending`, never `gate_failed`; the approval receipt stays the separate `validator_ask_user_approved` row. Two tests, plus a control proving no other gate's vocabulary moved. |
| T-185-05-02 (DoS — orphaned prompt rows) | mitigate | The sweep re-subscribes the SAME `tool_call_id`, so the old-row-plus-new-row state L-7 describes cannot arise on the resume path. `claim_run`'s CAS still guarantees one resuming worker (untouched). **Residue:** answering during a resume produces one further ask — deferred, recorded, fail-closed. |
| T-185-05-03 (spoofing — the answered card) | accept | Answer authorization is untouched (the shipped IDOR-safe anchor-confirm on POST, 404 on a terminal run). |
| T-185-05-04 (information disclosure — the `action_risk_pending` payload) | mitigate | The emit carries `phase` only and the audit row `{phase, timing}`; asserted with `"action_risk:approval|" not in str(metadata)` and an exact-equality check on the emit kwargs. |

## User Setup Required

None — no external service configuration, no environment variable, no migration. Live migration head stays at **113**.

## Next Phase Readiness

- **185-06/07/08 are unaffected.** This plan touched no canvas, no `PhaseFormPanel`, no governance section, and no `phaseVocabulary` — the count gate's pinned files all report delta ≥ 0.
- **Phase 188 (run surface) inherits a named event to consume:** `action_risk_pending`, carrying `phase`. It is emitted on the producer stream and is currently unhandled by design. 188 should also expect the second-ask residue above to be visible on its surface.
- **Phase 186 (the run-time twin) owns the sentence this plan refused to write.** `NO_DEADLINE_WAITING_LINE` deliberately says nothing about who else may answer; when 186 lands, that const is the one place to extend.
- **The armed wait is now honest at every layer the unit suite can reach.** What remains is the live restart — the G-4 scenario-3 Chrome-MCP pass — and the five integration facts enumerated at the top of this summary. Do not read this plan as closing scenario 3; read it as making every layer of scenario 3 individually correct and leaving the seam between them to UAT.

## Self-Check: PASSED

- `backend/app/services/harness_engine.py` — FOUND
- `backend/app/services/ask_user_service.py` — FOUND
- `backend/tests/unit/test_185_engine_attachment.py` — FOUND
- `frontend/src/types/index.ts` — FOUND
- `frontend/src/lib/api.ts` — FOUND
- `frontend/src/components/panel/PendingAskCard.tsx` — FOUND
- `frontend/src/components/panel/__tests__/PendingAskCard.test.tsx` — FOUND
- Commit `7a55b9da` — FOUND
- Commit `a4010b46` — FOUND
- Commit `fa2b56da` — FOUND

---
*Phase: 185-graded-governance-per-node-grounding-mode-action-risk-dial*
*Completed: 2026-07-29*
