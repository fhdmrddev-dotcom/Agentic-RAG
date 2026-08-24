---
phase: 187-business-vocabulary-ai-seeded-canvas
plan: 06
subsystem: harness-governance
tags: [sc6, seed-137, armed-checkpoint, hoist, fail-open-closed, wave-2, d-187-01]
status: complete
requires:
  - app.services.harness_engine._run_phase_with_gates
  - app.services.harness_engine._resolve_failure_with_ask_user
  - app.services.harness.grounding._approval_sentence
  - app.services.harness.grounding.effective_phase
  - backend/tests/unit/test_187_armed_checkpoint_property.py
provides:
  - "the hoisted pre-body armed action-risk checkpoint keyed on phase.action_risk_armed"
  - "is_action_risk as an explicit keyword parameter of _resolve_failure_with_ask_user"
  - "the Pitfall-4 disposition fail-open closed STRUCTURALLY (_failing_on_failure unreachable when armed)"
  - "effective_phase reduced to its citations_required append"
  - "total_phases threaded from run_workflow into _run_phase_with_gates"
affects:
  - "187-11 (re-verification) — owns the one-keyword drive fix + the shipped-test census re-shape"
  - "188 (RUNVIZ-03) — the run surface for action_risk_pending"
tech-stack:
  added: []
  patterns:
    - "A governance guarantee is a PROPERTY of the phase, never a position in an author-controlled list"
    - "Short-circuit rather than compute-and-override — a skipped read cannot be re-introduced by a future edit"
    - "The armed treatment is a per-CALL parameter, never a phase read inside a shared helper"
    - "One author for a user-facing sentence: the engine imports the composer, never re-types it"
key-files:
  created: []
  modified:
    - backend/app/services/harness_engine.py
    - backend/app/services/harness/grounding.py
decisions:
  - "D-187-01 honoured as fix shape C — the checkpoint sits outside phase.validators entirely"
  - "D-187-02 placement: AFTER the pre-gate pass (a skipped step earns no approval receipt)"
  - "D-187-17 placement: BEFORE while True: (one prompt per phase execution, not per retry)"
  - "D-187-03 partially REFUTED and reconciled in a code comment: TWO phase-level armed readings survive, not one"
  - "D-187-18 shipped and MEASURED live: validator: null on a hoisted checkpoint's receipt, key present"
  - "D-187-12 stays deferred — publish_service.py untouched"
  - "Task 1's 'counts unchanged' acceptance criterion is REFUTED by construction (see Deviations 1)"
metrics:
  duration: ~55 min
  tasks: 3
  tests_added: 0
  completed: 2026-08-02
---

# Phase 187 Plan 06: The Hoisted Armed Action-Risk Checkpoint Summary

"Armed ⇒ the person is asked before the body runs" is now a **property of the phase**, enforced by an
explicit engine checkpoint outside `phase.validators`, with the Pitfall-4 disposition fail-open closed
by construction — the SC#6 property test passes **30/30** when its drive supplies the new
`total_phases` keyword.

## What Was Built

### Task 1 — `is_action_risk` becomes a parameter; the fail-open closes (`3253ee21`)

- `_resolve_failure_with_ask_user` gained keyword-only `is_action_risk: bool = False`. The internal
  `is_action_risk = _is_action_risk_finding(error_message)` read is gone. RESEARCH Pitfall 3: this
  helper serves **both** the armed checkpoint and the author's own `ask_user` gates on the same phase,
  so a phase read here would hand an unrelated freshness gate the indefinite wait, the shutdown
  `CancelledError` escape, the armed choice pair and the exact-match allow-list.
- **The Pitfall-4 fail-open is closed STRUCTURALLY.** `_failing_on_failure` is now reachable only
  inside `if not is_action_risk:`. It is **skipped entirely**, never computed-and-overridden, so there
  is no expression a future edit can quietly re-enable. Without this, an armed checkpoint
  (`failed_idx is None`) would resolve the disposition from the phase's **own** validators, and an
  author's `fail_run` would route it to `_route_on_failure` — the person never asked. Same class as
  the Phase-185 BLOCKER T-185-04-01.
- The `redis is None` / `run_id is None` fail-safe was left byte-identical — it fails **closed**.
- **D-187-18** documented at the receipt write: `metadata["validator"]` is `None` for a hoisted
  checkpoint, the key stays **present** (one row shape per `event_type` beats two), pre-187 rows keep
  their ints.
- Both existing call sites preserved behaviour with `is_action_risk=_is_action_risk_finding(<their
  finding>)`.

### Task 2 — the hoist (`f4a3d539`)

The checkpoint block starts at **`harness_engine.py:754`** (`if getattr(phase, "action_risk_armed",
False):`) and the retry loop's `while True:` is at **`:805`** — the checkpoint is unambiguously
**before** the loop (D-187-17) and after the pre-gate block (D-187-02).

It: reads the phase boolean; calls `grounding._approval_sentence(phase, total_phases)` **directly**
(never re-authored — `grep -c "is about to run" harness_engine.py` → **0**); writes
`action_risk_pending` + emits `action_risk_pending` with the shipped metadata shape; calls
`_resolve_failure_with_ask_user(..., _ACTION_RISK_FINDING_PREFIX + sentence, 0, None, is_pre=True,
is_action_risk=True)`; returns any non-`None` outcome so the body never runs, and falls through only
on approval.

- `total_phases: int | None = None` added to `_run_phase_with_gates`; the **one** production call site
  in `run_workflow` passes the same `_total = len(definition.phases)` that `effective_phase` already
  receives. The `phase.phase_index + 1` fallback is commented as reachable only from a direct unit
  call that omitted the keyword. **This fallback has a measured consequence — see Deviations 2.**
- `_is_action_risk_finding` **deleted**; `grep -c` → **0** across `backend/app` and `backend/tests`
  source. The pre-gate branch at the old `:706` collapsed to the plain `gate_failed` path, because
  after the hoist no member of `phase.validators` is ever the armed one.
- `_ACTION_RISK_FINDING_PREFIX` **kept** — it is now a wire format (DELTA 1 splits the prompt back out
  on `"|"`), not a predicate.
- **D-187-03's "exactly ONE reading" is reconciled honestly in a comment at the hoist site**, per
  CONTEXT's correction: there are exactly **TWO** phase-level armed readings — this checkpoint (run
  time) and `_is_armed_action_risk` (`:2261`, the boot-time resume sweep, pinned by
  `test_the_two_resume_predicates_are_independent`) — deliberately independent. What D-187-03 actually
  deleted is the **third** reading, the string-prefix sniff over an error message. No uniqueness the
  code cannot deliver is claimed.
- The WR-03 retry seed (`validators[0].max_retries`) is untouched — the measured ground on which fix
  shape A was rejected.

### Task 3 — `effective_phase` stops appending the armed spec (`b1239e10`)

- The `action_risk_approval` `ValidatorSpec` synthesis is removed.
  `grep -c 'kind="action_risk_approval"' grounding.py` → **0**.
- **`citations_required` is UNCHANGED and CONFIRMED (not assumed) safe.** `git diff -U0` shows **zero**
  changed lines inside the append block; it is `timing="post"`, filtered out of the `timing="pre"` pass
  at `validators.py:231`, so a pre gate preempting it is not representable.
  `grep -c 'kind="citations_required"'` → **1**.
- `_approval_sentence` survives (`grep -c` → **3**) and its docblock records that the caller moved, not
  the composer.
- Docblocks rewritten: the module note now says ONE gate is synthesized here and points at the engine;
  `effective_phase`'s docblock keeps every surviving rule verbatim in substance (never persisted, never
  a `model_validator`, append-never-prepend, identity return, D-185-05 both-specs-run) and adds the
  D-187-01 pointer so a reader is not left wondering where arming went.
- `total_phases` is retained on `effective_phase`'s signature (now unused by its body) because the
  engine seam and the shipped 187-01 property drive both pass it.
- `git status --porcelain backend/app/services/harness/publish_service.py` → **empty**. D-187-12 stays
  deferred.

## The decisive measurement — the property is GREEN

The 187-01 property test predates Task 2's `total_phases` keyword, so its `_drive`
(`test_187_armed_checkpoint_property.py:522-526`) calls `_run_phase_with_gates` without it and the
checkpoint's sentence falls back to `"Step 2 of 2"` instead of the `"Step 2 of 4"` the test composes
from `_approval_sentence(raw, 4)`. The sentences then fail to join, so the recorder sees **0 armed
prompts** even though one was awaited.

Supplying the keyword the way `run_workflow` does — via a throwaway pytest plugin in the scratchpad,
**zero tree edits**:

```
cd backend && PYTHONPATH=<scratchpad> ./venv/Scripts/python.exe -m pytest \
  tests/unit/test_187_armed_checkpoint_property.py -q --no-header -p p187_total_phases_probe
→ 30 passed
```

**All 30 green.** Specifically, against 187-01's handoff list:

| 187-01 handoff requirement | Result |
|---|---|
| The 4 RED ids flip **for the right reason** (a prompt awaited exactly once, strictly before the body) | ✅ P1 + P2 both green on all four |
| `pre_pass_fail_run_disposition` **stays** GREEN (the Pitfall-4 tripwire) | ✅ green |
| `armed_refused_typed` (P3) stays GREEN — T-185-04-01 not re-opened | ✅ green |
| `pre_fail_run` / `pre_skip_to_phase` stay GREEN with the body **un-run** | ✅ green |

A second scratchpad probe drove the real `_run_phase_with_gates` on a real armed phase and printed the
ledger, discharging the L-5 vocabulary guarantee whose shipped test now measures the old mechanism:

| Row | Audit event types | Metadata | Body | Armed prompts |
|---|---|---|---|---|
| approved | `['action_risk_pending', 'validator_ask_user_approved']` | `{'phase':…, 'timing':'pre'}` then `{'phase':…, **'validator': None**, 'choice':'Approve and run this step', 'finding':…}` | ran | 1 |
| typed refusal | `['action_risk_pending']` | `{'phase':…, 'timing':'pre'}` | **never ran** | 1 |

Zero `gate_failed` on either — waiting is still not failing. **D-187-18's `validator: null` is
observed live, not asserted.** The refusal returns `fail_run` with reason *"… — not approved: the
answer did not match the approval option"*, i.e. the allow-list still bites.

## Verification

| Check | Result |
|---|---|
| `pytest test_pre_post_timing test_harness_models test_validator_kinds test_182_severity_codes -q` | **41 passed** — baseline 4+15+13+9 = 41, unchanged ✅ |
| `pytest test_185_engine_attachment -k "weak_author_spec or no_model_validator or freshness_pre_gate or shutdown_on_a_NON_armed"` | **4 passed** ✅ |
| `pytest test_185_engine_attachment -k "weak_author_spec or ungoverned_phase or never_mutates or no_model_validator or detected_step"` | **6 passed** ✅ |
| `test_a_deliberately_weak_author_spec_cannot_loosen_the_gate` (`:153-165`) | **GREEN, as-is, unmodified** — the ROADMAP threat-model item is discharged without re-shaping ✅ |
| `test_grounding_declares_no_model_validator_in_CODE` | green ✅ |
| `test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped` | green — T-187-06-03's asymmetry net ✅ |
| SC#6 property with `total_phases` supplied | **30 passed** ✅ |
| `grep -c "_is_action_risk_finding" harness_engine.py` | **0** ✅ |
| `grep -c "_ACTION_RISK_FINDING_PREFIX" harness_engine.py` | **3** (≥ 1) ✅ |
| `grep -c "_approval_sentence" harness_engine.py` / `"is about to run"` | **6** / **0** ✅ |
| checkpoint line vs `while True:` | **754 < 805** ✅ |
| `grep -n "total_phases"` | keyword at `:648`, production value at `:1498` ✅ |
| `git diff -U0 harness_engine.py \| grep -c '^[-+].*_ACTION_RISK_APPROVE_CHOICE'` | **0** — allow-list untouched ✅ |
| `grep -c "event_type=" harness_engine.py` vs HEAD | **14 / 14** — no new audit event type ✅ |
| `git diff --stat -- supabase/migrations` | **empty** ✅ |
| `git status --porcelain …/publish_service.py` | **empty** ✅ |
| Backend collection | **3523** (187-01 recorded 3504; +19 from sibling Wave-1/2 plans) — no suite silently replaced ✅ |

### The exact RED set at this wave boundary

Recorded per the plan's `<verification>` instruction. **Every one is an armed test that measures the
mechanism D-187-01 replaced.** Plan 187-11 owns re-shaping them.

`test_185_engine_attachment.py` (8):
`test_arming_adds_no_phase_and_moves_no_phase_index`,
`test_armed_gate_subscribes_with_no_timeout_at_all`,
`test_criterion_19_unanswered_armed_gate_does_not_advance_the_run`,
`test_armed_prompt_is_the_generated_sentence_character_identically`,
`test_armed_prompt_and_row_carry_a_null_deadline_never_zero`,
`test_shutdown_mid_wait_leaves_an_armed_run_resumable`,
`test_an_armed_pre_gate_records_a_pause_not_a_failure`,
`test_an_armed_pre_gate_never_announces_gate_failed_to_the_frontend`

`test_ask_user_disposition.py` (1): `test_armed_typed_refusal_is_never_approval`

`test_187_armed_checkpoint_property.py` (15 on the tree as shipped, **0 with the keyword supplied**):
P1 × 7 + P2 × 8.

Two causes, both understood:
1. **Direct calls into `_resolve_failure_with_ask_user`** that manufacture an armed finding string but
   pass no `is_action_risk=True` (6 of the 9 shipped). Unavoidable under the plan's own mandated
   `is_action_risk: bool = False` signature.
2. **Drives of the old validator-shaped mechanism** — `_drive_failing_pre_gate` patches `run_gates` to
   return an armed finding, which no gate in `phase.validators` can now be (the remaining 3).

**The plan's `<verification>` predicted this wave boundary** ("…are RED. Plan 187-11 re-shapes them and
turns the property green"), though it named `test_ask_user_disposition.py`'s "8 armed tests" — measured,
that file contributes **1** and `test_185_engine_attachment.py` contributes **8**.

## What 187-11 owes, precisely

1. **One keyword.** `test_187_armed_checkpoint_property.py:522-526` — add `total_phases=TOTAL_PHASES,`
   to the `_run_phase_with_gates(...)` call in `_drive`. That alone takes the property from 15 red to
   **30 green** (measured, above).
2. **Re-shape the 9 shipped armed tests** — the 6 direct-helper calls need `is_action_risk=True`; the 3
   `_drive_failing_pre_gate` armed rows need to drive `action_risk_armed=True` instead of a
   manufactured finding.
3. **187-VALIDATION §5's falsification re-run** — temporarily remove the checkpoint block
   (`harness_engine.py:754-803`) and confirm the property returns to 187-01's RED signature.

## Deviations from Plan

### 1. [Rule 1 — measurement] Task 1's "counts unchanged" acceptance criterion is REFUTED by construction

- **Found during:** Task 1 verification.
- **Issue:** The criterion says the three-file set "passes with counts unchanged from HEAD — this task
  changes no behaviour." That cannot hold under the plan's own mandated signature. Five shipped tests
  call `_resolve_failure_with_ask_user` **directly** with a manufactured armed finding and no kwarg;
  with `is_action_risk: bool = False` they necessarily receive the non-armed treatment. Measured
  81 → 76 passing on the six-file set at the Task-1 commit.
- **Why the plan is still right:** the *engine's* production paths ARE byte-identical after Task 1 —
  both call sites pass `_is_action_risk_finding(<their finding>)`, and the SC#6 property test's
  RED signature was **unchanged** at that commit (8 failed / 22 passed, same 8 ids). Only direct-call
  unit tests moved.
- **Considered and rejected:** an `is_action_risk: bool | None = None` sentinel falling back to the
  finding sniff. It would have kept Task 1 literally green, but Task 2 deletes the sniff, so the same
  five tests go red one commit later — **identical end state, extra churn, and a signature the plan
  did not specify.**
- **Fix:** none applied. Recorded here as the honest measurement.
- **Files modified:** none beyond the task.

### 2. [Rule 2 — missing critical evidence] The `total_phases` fallback makes the property test unable to join its sentence

- **Found during:** Task 2 verification.
- **Issue:** The plan mandates `phase.phase_index + 1` as the fallback when `total_phases` is omitted.
  187-01's `_drive` omits it (it predates the keyword), so the checkpoint composes `"Step 2 of 2"`
  while the test expects `_approval_sentence(raw, 4)` = `"Step 2 of 4"`. The join fails and the
  recorder reports **0 armed prompts** — the property looks like an 8 → 15 **regression** when the
  hoist in fact works perfectly.
- **Fix:** measured it out of doubt rather than guessing. A throwaway pytest plugin in the scratchpad
  injects `total_phases=4` into the drive, exactly as `run_workflow` does → **30 passed**. A second
  scratch probe printed the live audit ledger (table above). **Zero files in the working tree were
  touched by either probe.**
- **Deliberately NOT fixed here:** the one-keyword change lives in
  `backend/tests/unit/test_187_armed_checkpoint_property.py`, which is not in this plan's
  `files_modified` and which the orchestrator assigned to 187-11 ("owns turning the property fully
  green and re-shaping the shipped test census"). Handed off above with the exact line.
- **Files modified:** none.

### 3. [Rule 2 — honesty] `_is_action_risk_finding` removed from prose, not just from code

- **Found during:** Task 2 acceptance check (`grep -c` returned 2, both in explanatory comments).
- **Fix:** the two comments now describe the deleted sniff without spelling the identifier, so the
  mechanical criterion (`0`) and the reader's need for the story are both satisfied.
- **Files modified:** `backend/app/services/harness_engine.py`. **Commit:** `f4a3d539`.

### Claims refuted or corrected for the record

- **D-187-03's "T-185-03-03's accepted doubled gate row disappears" is REFUTED** (as CONTEXT already
  flagged). That row is the **`citations_required`** doubling (`185-03-PLAN.md:364`), which this phase
  leaves exactly in place. **Do not carry the claim forward.**
- **D-187-03's "exactly ONE reading of armed must survive" is REFUTED and reconciled.** Two survive
  (this checkpoint + `_is_armed_action_risk`); the comment at the hoist site says so.
- **A hand-declared `action_risk_approval` ValidatorSpec is now an ordinary author gate.** After the
  hoist nothing in the engine treats that `kind` specially — it announces `gate_failed` and routes on
  the author's own disposition. The Literal is **kept** (187-02's additive-only policy) and research
  measured **0 stored rows** naming it, so nothing in the live DB is affected. Stated here so it is not
  discovered later.

## Threat Model Coverage

| Threat ID | Disposition | Status |
|---|---|---|
| T-187-06-01 (EoP — pre-body path) | mitigate | ✅ The checkpoint reads `phase.action_risk_armed` and sits outside `phase.validators`. Proved by the property at 30/30. |
| T-187-06-02 (EoP — disposition fail-open) | mitigate | ✅ `_failing_on_failure` appears only under `if not is_action_risk:` — verified as source structure AND by `pre_pass_fail_run_disposition` staying green. |
| T-187-06-03 (EoP — armed treatment leaking to an author's gate) | mitigate | ✅ `is_action_risk` is per-CALL. `test_a_freshness_pre_gate_still_fails_exactly_as_it_shipped` green. |
| T-187-06-04 (Repudiation — typed refusal read as consent) | mitigate | ✅ Allow-list untouched (`git diff` grep → 0); probe shows a typed refusal → `fail_run`, body un-run, zero receipts. |
| T-187-06-05 (Repudiation — false approval receipt) | mitigate | ✅ Receipt still writes only after the allow-list; D-187-18 changes only the `validator` value. |
| T-187-06-06 (Repudiation — approving a step that never runs) | mitigate | ✅ D-187-02 placement; `pre_fail_run` / `pre_skip_to_phase` green with the body un-run. |
| T-187-06-07 (DoS — `harness_audit` event_type CHECK) | mitigate | ✅ `grep -c "event_type="` **14 → 14**; only `action_risk_pending` + `validator_ask_user_approved` used. |
| T-187-06-08 (Tampering — the WR-03 retry seed) | mitigate | ✅ `validators[0]` untouched; `test_185_engine_attachment.py:153-165` green unmodified. |
| T-187-06-09 (EoP — armed phase in a synchronous golden run) | accept | ✅ Unchanged. `publish_service.py` clean; D-187-12 deferred with its trigger. |

## Known Stubs

None. No hardcoded empties, no placeholder text, no unwired data path. The `total_phases=None`
fallback is a documented degradation for direct unit callers, not a stub — the one production call
site always passes the real total.

## Threat Flags

None — no new network endpoint, auth path, file access pattern or schema change. Zero migrations.

## Self-Check: PASSED

- `backend/app/services/harness_engine.py` — FOUND
- `backend/app/services/harness/grounding.py` — FOUND
- `.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-06-SUMMARY.md` — FOUND
- Commit `3253ee21` (Task 1) — FOUND
- Commit `f4a3d539` (Task 2) — FOUND
- Commit `b1239e10` (Task 3) — FOUND
