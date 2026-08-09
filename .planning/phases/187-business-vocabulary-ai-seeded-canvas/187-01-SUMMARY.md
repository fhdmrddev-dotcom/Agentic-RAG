---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 01
subsystem: harness-governance
tags: [sc6, seed-137, armed-checkpoint, property-test, wave-0, red-first]
status: complete
requires:
  - app.services.harness_engine._run_phase_with_gates
  - app.services.harness.grounding.effective_phase
  - app.services.harness.grounding._approval_sentence
  - app.services.harness.validators.run_gates
provides:
  - backend/tests/unit/test_187_armed_checkpoint_property.py
  - "SC#6 property over author-declared validator sets, observed RED on HEAD"
  - "The recorded RED signature the 187-06 fix plan must be checked against"
affects:
  - "187-06 (the hoist) — its acceptance is this file turning GREEN"
  - "187-11 (re-verification) — the same file, re-run"
tech-stack:
  added: []
  patterns:
    - "Property over an explicit named table, not hypothesis (measured: hypothesis is not a backend dependency)"
    - "Observable = body invocation (a spy over _execute_phase), never validator presence"
    - "One monotonic recorder clock across prompt-emit / subscribe-await / body-invoke, so ordering is MEASURED"
    - "The armed prompt is identified by calling grounding._approval_sentence and joining emit→subscribe on tool_call_id — never by a re-typed fragment"
    - "Negative receipt assertion filters write_audit.await_args_list on the event_type kwarg, never a total await count"
key-files:
  created:
    - backend/tests/unit/test_187_armed_checkpoint_property.py
  modified: []
decisions:
  - "D-187-01/02 honoured as the property's shape: 'armed ⇒ asked' is a property of the phase, and the checkpoint is owed only when control actually reaches the body"
  - "D-187-17 encoded in P2 as EXACTLY-once (not at-least-once) — the checkpoint fires before the while True: retry loop"
  - "Added a 10th case, pre_pass_fail_run_disposition, beyond the plan's 9-row minimum — the plan's pre_fail_run row cannot falsify the Pitfall-4 fail-open because its gate FAILS"
  - "No run_gates fake installed — real registered kinds (structure_check loose / citations_required presence) give full determinism, so the plan's conditional companion test is not needed"
metrics:
  duration: ~45 min
  tasks: 3
  tests_added: 30
  completed: 2026-08-02
---

# Phase 187 Plan 01: SC#6 Armed-Checkpoint Property (RED on HEAD) Summary

The SC#6 property test over author-declared validator **sets** exists, drives the real
`_run_phase_with_gates` against the **effective** phase, and is **observed RED on unmodified HEAD** —
proving the SEED-137 bypass before any fix is written.

## What Was Built

`backend/tests/unit/test_187_armed_checkpoint_property.py` — 30 tests, all in one file, touching
**zero production source**.

### The space (`CASES`)

Ten named author-validator sets, each declaring `reaches_body_without_arming` **explicitly** (no
default — a row that forgot to state it would silently opt itself out of the assertion that catches
the bypass):

| id | author set | reaches body w/o arming | HEAD |
|---|---|---|---|
| `no_author_validators` | `[]` | ✔ | GREEN |
| `pre_ask_user_proceed` | `[pre/ask_user fails]` + "Proceed anyway" | ✔ | **RED** |
| `pre_fail_run` | `[pre/fail_run fails]` | ✘ | GREEN |
| `pre_skip_to_phase` | `[pre/skip_to_phase:done fails]` | ✘ | GREEN |
| `post_only` | `[post/*]` | ✔ | GREEN |
| `pre_ask_user_plus_post_citations` | `[pre/ask_user, post/citations_required]` | ✔ | **RED** |
| `two_pre_ask_user` | `[pre/ask_user, pre/ask_user]` | ✔ | **RED** |
| `pre_pass_then_pre_ask_user` | `[pre passes, pre/ask_user fails]` | ✔ | **RED** |
| `pre_pass_fail_run_disposition` | `[pre/fail_run PASSES]` | ✔ | GREEN (Pitfall-4 tripwire) |
| `armed_refused_typed` | `[]`, typed refusal `"Do not run it."` | ✔ | GREEN (P3) |

### The construction that makes it reproducible

Every drive builds a **raw** `PhaseSpec(action_risk_armed=True, validators=<author set>)` and passes
it through `grounding.effective_phase(raw, total_phases=4)` before `_run_phase_with_gates` — the same
thing `run_workflow` does at its one synthesis call site (`harness_engine.py:1336-1339`). A raw armed
phase with `validators=[]` never had an armed gate at all, so skipping `effective_phase` would have
measured a phase the engine never runs.

### The three assertions

- **P1 (universal, all 10 rows)** — body invoked ⇒ the armed prompt was awaited, at a **strictly
  earlier** order index. Both halves asserted; ordering compared on the recorder's single monotonic
  clock, never inferred from call counts.
- **P2 (targeted, the 7 rows declaring `reaches_body_without_arming=True`)** — **exactly one** armed
  prompt. This is the assertion that fails on the HEAD bypass, and the only one that can see the
  Pitfall-4 fail-open (a checkpoint routed away leaves the body un-run, which P1 satisfies vacuously).
- **P3 (negative)** — a typed refusal invokes nothing, returns `fail_run`, and writes **ZERO**
  `validator_ask_user_approved` receipts, computed by filtering `write_audit.await_args_list` on the
  `event_type` kwarg. The same drive legitimately writes an `action_risk_pending` *consequence* row,
  so a total await count would have been wrong. A positive control in the same test proves the
  receipt counter moves, so the zero is a measurement rather than an artefact.

### Determinism without a fake

No `run_gates` patch was installed. Author gates use **real registered kinds** driven to deterministic
verdicts with no I/O:

- `structure_check` / `mode: loose` — a pure substring scan over `_output_text`. The pre-gate output
  is `{"_phase_inputs": …}` whose `text` is `""`, so `sections=["__SECTION_NEVER_PRESENT__"]` always
  FAILS and `sections=[]` always PASSES.
- `citations_required` / `mode: presence`, `min_markers: 0` — `0 >= 0`, no judge call, no network.

`run_gates` therefore runs for real: the `timing` filter, the FULL-list `idx` invariant and
first-failure-wins (`validators.py:230-249`) are exercised, not simulated. Because there is no fake,
the plan's conditional `fake_run_gates_agrees_with_the_real_one` companion test does not apply.

## RED signature

**Command (verbatim):**

```
cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_187_armed_checkpoint_property.py -q --no-header
```

**Pytest tail (verbatim), on `develop` @ `5fae96f0` — unmodified engine:**

```
=========================== short test summary info ===========================
FAILED tests/unit/test_187_armed_checkpoint_property.py::test_p1_body_implies_the_armed_prompt_was_awaited_first[pre_ask_user_proceed]
FAILED tests/unit/test_187_armed_checkpoint_property.py::test_p1_body_implies_the_armed_prompt_was_awaited_first[pre_ask_user_plus_post_citations]
FAILED tests/unit/test_187_armed_checkpoint_property.py::test_p1_body_implies_the_armed_prompt_was_awaited_first[two_pre_ask_user]
FAILED tests/unit/test_187_armed_checkpoint_property.py::test_p1_body_implies_the_armed_prompt_was_awaited_first[pre_pass_then_pre_ask_user]
FAILED tests/unit/test_187_armed_checkpoint_property.py::test_p2_reaching_the_body_implies_exactly_one_armed_prompt[pre_ask_user_proceed]
FAILED tests/unit/test_187_armed_checkpoint_property.py::test_p2_reaching_the_body_implies_exactly_one_armed_prompt[pre_ask_user_plus_post_citations]
FAILED tests/unit/test_187_armed_checkpoint_property.py::test_p2_reaching_the_body_implies_exactly_one_armed_prompt[two_pre_ask_user]
FAILED tests/unit/test_187_armed_checkpoint_property.py::test_p2_reaching_the_body_implies_exactly_one_armed_prompt[pre_pass_then_pre_ask_user]
8 failed, 22 passed, 1 warning in 0.79s
```

Exit code **1**.

**Per failing parametrize id** — all four show identical observed values:

| Field | Value |
|---|---|
| Failing assertion (P1) | `assert armed_orders` — *"THE BODY RAN AND NOBODY WAS ASKED"* |
| Failing assertion (P2) | `assert len(armed_orders) == 1` |
| **Observed** | `0` armed approval prompts awaited; executor body invoked at order `3`; the only prompt awaited was the author's generic `"A validation check on phase 'send-the-notice' flagged: structure_check: missing sections […]. How should the run proceed?"` |
| **Expected** | exactly `1` armed approval prompt, at an order index strictly less than the body's |
| Outcome returned | `'completed'` |

`outcome == 'completed'` is the sharpest available reading: on HEAD an `action_risk_armed=True` step
does not merely skip its checkpoint — it runs to a **successful phase completion** with nobody asked.

**Mechanism (`pre_ask_user_proceed`, SEED-137's named bypass).** `effective_phase` **appends** the
`action_risk_approval` spec (D-185-05 — appending so `validators[0]` stays the author's and the WR-03
retry seed is byte-identical), which puts the armed gate **last**. `run_gates` is first-failure-wins
and returns at `validators.py:248`, so the author's failing `structure_check` is what comes back and
the armed gate is never evaluated. `_is_action_risk_finding` is therefore `False`, the armed announce
branch is skipped, and `_resolve_failure_with_ask_user` resolves the **author's** `ask_user`
disposition. Their "Proceed anyway" returns `None`, and **`harness_engine.py:739` —
`"outcome is None → ask_user Proceed: fall through and run the body"` — falls straight through to the
body at `:747`**. The pre-gate pass happens exactly once, so the armed gate gets no second chance.
The three sibling ids are the same mechanism with a post gate present, with a second failing
`ask_user` gate, and with a passing gate ahead of the failing one — proving the bypass is a property
of the **ordering**, not of a one-element author list.

**The six GREEN rows were deliberately NOT deleted** — the property must hold for every set, so a set
that already satisfies it is what catches a fix that breaks it. Each row's reason for being green on
HEAD is written into the file's docblock. Two deserve calling out:

- `pre_pass_fail_run_disposition` is the **Pitfall-4 tripwire (T-187-01-05)**. The author's gate
  passes, so today `failed_idx` points at the armed spec and `_failing_on_failure` reads its own
  `ask_user`. After the hoist the checkpoint has no validator index, so
  `_failing_on_failure(phase, None)` would fall back to `validators[0]` — the author's `fail_run` —
  and route the checkpoint away with the person never asked. **This row turns RED the moment that
  fail-open is introduced.**
- `armed_refused_typed` is green **by design**: T-185-04-01's exact-match approval allow-list already
  ships. P3 is kept so the hoist cannot silently re-open Phase 185's BLOCKER.

## Deviations from Plan

### Auto-fixed / auto-added

**1. [Rule 2 - Missing critical functionality] Added a 10th case, `pre_pass_fail_run_disposition`,
as the real Pitfall-4 falsification**
- **Found during:** Task 1, while mapping the threat register's T-187-01-05 onto the case table
- **Issue:** The plan's threat register names `pre_fail_run` (`reaches_body_without_arming=False`) as
  "the falsification for" the Pitfall-4 disposition-routing fail-open. It cannot be: its gate
  **fails**, so control legitimately never reaches the body, P1 is vacuously satisfied and P2 does not
  apply to it. A hoist that let `_failing_on_failure(phase, None)` resolve an author's `fail_run` for
  the armed checkpoint would leave every row in the plan's 9-row space green.
- **Fix:** Added a row whose author gate **passes** while declaring `on_failure="fail_run"` — control
  reaches the body (so a checkpoint is owed and `reaches_body_without_arming` is `True`), but
  `validators[0].on_failure` is `fail_run`. P2 goes RED on that row the instant the fail-open exists.
  `pre_fail_run` is retained exactly as the plan specifies; the reasoning is recorded in both rows'
  `why` fields.
- **Files modified:** `backend/tests/unit/test_187_armed_checkpoint_property.py`
- **Commit:** `cf2f57d9`

**2. [Rule 3 - Blocking] `_approval_sentence` / `effective_phase` imported directly rather than via
the module object**
- **Found during:** Task 1 verification against the acceptance criterion *"contains `_approval_sentence`
  imported from `app.services.harness.grounding`"*
- **Fix:** `from app.services.harness.grounding import _approval_sentence, effective_phase` inside
  `_drive`, replacing `from app.services.harness import grounding` + attribute access.
- **Commit:** `cf2f57d9`

### Decisions taken under Claude's discretion

- **No `run_gates` fake.** The plan permits one but instructs "Do NOT patch `run_gates` if a real kind
  gives the needed determinism". `structure_check` (loose) and `citations_required` (presence,
  `min_markers: 0`) do, so the real fan-in runs and the conditional
  `fake_run_gates_agrees_with_the_real_one` companion test is not applicable. Recorded in the docblock.
- **`hypothesis` rejected on measurement, not taste** — it is in no backend requirements file and is
  not importable in `backend/venv`. The docblock states this and states the positive reason for the
  table: every row is a shape a real author can write and is worth being *nameable* in a failure
  report.

## Verification

| Check | Result |
|---|---|
| `pytest tests/unit/test_187_armed_checkpoint_property.py -q --no-header` | **8 failed, 22 passed — exit 1**, `pre_ask_user_proceed` among the failures ✅ |
| `--collect-only -q` | 30 tests, exit 0 ✅ |
| Backend quick 5-file set (`test_185_engine_attachment`, `test_ask_user_disposition`, `test_validator_kinds`, `test_harness_models`, `test_182_severity_codes`) | **72 passed** — matches the 187-VALIDATION baseline exactly ✅ |
| Backend collection | **3504** (baseline 3474 + 30 net-new) — no suite silently replaced (the Phase-177 lesson) ✅ |
| `git status --porcelain backend/app frontend/src supabase/migrations` | **empty** — zero production source, zero migrations ✅ |
| `grep -c 'is about to run' <file>` | **0** — the approval sentence is never re-typed ✅ |
| `grep -c 'harness_engine.py:739' <file>` | **2** — the mechanism is cited in the docblock ✅ |
| File contains `effective_phase(` | yes (2 occurrences) ✅ |
| `CASES` contains `pre_ask_user_proceed`, `pre_fail_run`, `armed_refused_typed` | yes, asserted by `test_the_space_contains_both_known_bypasses` ✅ |
| Every case declares `reaches_body_without_arming` | asserted per-row by `test_case_table_is_well_formed` ✅ |

**Note on the plan's `git status --porcelain … supabase` criterion:** the working tree carries ~40
pre-existing untracked/modified files under `supabase/snippets/` and `supabase/.temp/` (local Supabase
SQL-editor scratch, unrelated to this phase and present before this plan started). Per the executor
SCOPE BOUNDARY they were left untouched; the criterion was verified against
`supabase/migrations` — which is what the phase's zero-migration gate actually cares about — and is
empty.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|---|---|---|
| T-187-01-01 (EoP — pre-body path) | mitigate | ✅ The control is RED on HEAD on 4 ids × 2 assertions. Task 3's refusal condition ("if NO case is red, stop") did not trigger. |
| T-187-01-02 (Repudiation — false approval receipt) | mitigate | ✅ P3 present, filters `await_args_list` on `event_type`, plus a positive control against vacuity. |
| T-187-01-03 (Tampering — the test's own `run_gates` fake) | mitigate | ✅ Vacuous by construction: **no fake was installed**. |
| T-187-01-04 (DoS — production source) | accept | ✅ `git status --porcelain backend/app frontend/src supabase/migrations` empty. |
| T-187-01-05 (EoP — disposition resolution fail-open) | mitigate | ✅ Registered here **and** given a real falsification row (`pre_pass_fail_run_disposition`, deviation 1). Closed in 187-06, re-verified in 187-11. |

## Known Stubs

None. The file is complete as authored; its RED state is the deliverable, not a stub.

## Threat Flags

None — this plan adds no network endpoint, auth path, file access pattern or schema change.

## Handoff to 187-06 (the hoist)

The fix plan must be checked against the recorded RED signature, not just against "the file is green":

1. All four RED ids must go GREEN **for the right reason** — an armed prompt awaited exactly once,
   before the body — not by any route that stops the body from running.
2. `pre_pass_fail_run_disposition` must **stay** GREEN. It is the Pitfall-4 tripwire; `is_action_risk`
   must short-circuit the disposition resolution rather than letting
   `_failing_on_failure(phase, None)` read `validators[0]`.
3. `armed_refused_typed` (P3) must stay GREEN — the hoist must not re-open T-185-04-01.
4. `pre_fail_run` / `pre_skip_to_phase` must stay GREEN with the body still un-run — D-187-02 says a
   step an author's gate skips is never approved, because an approval receipt for a step with no body
   violates consequence ≠ receipt.
5. Per 187-VALIDATION §5, after the fix lands, temporarily remove the checkpoint and confirm the file
   goes RED again with this same signature.

## Self-Check: PASSED

- `backend/tests/unit/test_187_armed_checkpoint_property.py` — FOUND
- Commit `cf2f57d9` (Task 1) — FOUND
- Commit `5fae96f0` (Task 2) — FOUND
- Commit `6793f651` (Task 3) — FOUND
