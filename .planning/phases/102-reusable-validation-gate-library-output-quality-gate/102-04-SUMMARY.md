---
phase: 102-reusable-validation-gate-library-output-quality-gate
plan: 04
subsystem: harness
tags: [harness, engine, validators, timing, ask_user, citation_policy, GATE-01, QUAL-01, SEED-082]

# Dependency graph
requires:
  - phase: 102-reusable-validation-gate-library-output-quality-gate
    provides: "Plan 01 the ValidatorSpec.timing field + on_failure ask_user value + LlmEmitPhaseConfig.citation_policy enum + the 6 receipt kinds (validator_ask_user_approved, policy_applied) in _AUDIT_EVENT_TYPES; Plan 02 migration 070 LIVE on :54322 (those CHECK kinds accepted); Plan 03 run_gates(..., timing=...) keyword filter + the 5 registered validator kinds + freshness's parseable freshness:<check>|<payload> structured finding"
  - phase: 085-ask-user-cross-worker
    provides: "ask_user_service.subscribe_for_response (the SUBSCRIBE-before-emit block primitive) + the durable-prompt-row + expiry-honest-fail substrate the D-11 disposition reuses VERBATIM"
  - phase: 101.1-guaranteed-emission-layer
    provides: "_exec_llm_emit's state-(b) citation rejection (the disposition citation_policy branches), the WR-02-persisted legacy_map (the field-map flag/partial/draft re-render off), the deterministic render driver (entry.post_processor), _emit_audit / _surface_failure_message / _emit_phase_substep helpers"
provides:
  - "harness_engine._parse_on_failure recognizes ask_user as the 4th disposition (D-11); unknown values still fail-safe to fail_run"
  - "_run_phase_with_gates D-10 timing:pre pre-gate pass (runs BEFORE the executor body; a pre failure routes without running the body unless ask_user Proceed); the post-gate call becomes timing='post'"
  - "_resolve_failure_with_ask_user async helper — the INLINE 085 ask_user pause (sync _route_on_failure cannot await): Proceed writes a validator_ask_user_approved receipt + continues, Abort/unanswered -> honest fail_run; reused by BOTH the pre-gate exit and the exhausted post-gate exit"
  - "harness/emit_policy.apply_citation_policy(field_map, gate, policy) — flag marks [unverified]+coverage summary, partial blanks+gap list, draft labels DRAFT; strict REFUSED (the inline honest-fail path); pure, no I/O"
  - "_exec_llm_emit citation_policy post-verdict disposition (D-01): strict byte-identical, non-strict re-renders the WR-02 legacy_map via the deterministic driver + a policy_applied receipt; NO new emit shot, never a silent pass-off (SEED-082 red line)"
affects: [102-05 publish service (the judge gate reuses the timing/ask_user/policy seams), 103 NL builder (surfaces the citation_policy family as one plain-language question), 105 budget preflights (reuse the timing:pre seam)]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PURE-SYNC mapper + ASYNC pause split: _route_on_failure stays pure (cannot await the user); the ask_user pause resolves INLINE in _resolve_failure_with_ask_user where redis/pool/ctx are in scope (RESEARCH Pattern 3 / A4) — _route_on_failure fails-safe to fail_run if it ever sees ask_user"
    - "ONE async helper, TWO exits: the pre-gate exit (is_pre=True, None=run-the-body) and the exhausted post-gate exit (is_pre=False, Proceed returns completed with the produced output) share _resolve_failure_with_ask_user — a non-ask_user disposition delegates to _route_on_failure (byte-identical)"
    - "post-verdict policy disposition (the verdict is UNCHANGED; the policy gates only what happens AFTER): strict is the inline honest-fail (never touches emit_policy), non-strict re-renders the SAME persisted field-map (NO new forced_emit shot, never model-written code)"
    - "policy delivery is VISIBLE at every layer (T-102-04-03 never-silent): marks/blanks IN the rendered doc (the driver) + the coverage summary surfaced as a message + carried into the deliverable's chat text + a policy_applied governance receipt"

key-files:
  created:
    - "backend/app/services/harness/emit_policy.py"
  modified:
    - "backend/app/services/harness_engine.py"
    - "backend/app/services/harness/phase_types.py"
    - "backend/tests/unit/test_ask_user_disposition.py"
    - "backend/tests/unit/test_pre_post_timing.py"
    - "backend/tests/unit/test_citation_policy.py"

key-decisions:
  - "ask_user is resolved by a NEW async helper (_resolve_failure_with_ask_user), NOT by extending _route_on_failure — the sync mapper cannot await; _route_on_failure fails-safe to fail_run on an ask_user disposition so a pause-unreachable path (no redis/ctx) never hangs"
  - "the exhausted POST-gate exit routes through the same helper (not _route_on_failure) so a post validator's ask_user Proceed can deliver the produced output as completed; the WALL-CLOCK timeout exit stays _route_on_failure (a hung phase has no ask_user choice)"
  - "emit_policy.apply_citation_policy RAISES on 'strict' — strict is the inline honest-fail path; refusing it structurally guarantees a refactor can never accidentally deliver an uncited map under the default policy (T-102-04-04)"
  - "the non-strict path SKIPS the emit_validated receipt (the gate did NOT validate) and writes policy_applied instead — the audit story is honest about what happened"
  - "draft injects the DRAFT label into the surfaced message + the deliverable chat text (RESEARCH Open Q3 v1 — a DRAFT header line, not a watermark image); the marks/blanks for flag/partial render IN the doc via the driver off the modified legacy_map"

patterns-established:
  - "structured-finding -> ask_user choices: _ask_user_choices_from_finding parses the Plan-03 freshness:staleness|... / freshness:version_ambiguity|... error-message prefix into the choice set (Proceed/Abort vs Use-newest/Use-as-is/Abort) — the contract Plan 03 encoded, Plan 04 consumes"
  - "leaf-name matching across shapes: emit_policy matches uncited leaves by field-name (the suffix after the last dot of check_coverage's '{location}.{field}') so it works on the legacy envelope (scalar.k / risks0.risk_id) AND the bare-key flat test shape"

requirements-completed: []  # GATE-01 + QUAL-01 are MULTI-PLAN — they mark complete at phase verification (the 099/WFSKILL-01 convention), NOT at this engine-seams plan

# Metrics
duration: ~12min
completed: 2026-06-12
---

# Phase 102 Plan 04: The Engine Seams — timing:pre + ask_user + citation_policy Summary

**The two GATE-01 engine seams (D-10 `timing:pre` pre-gate pass + D-11 `ask_user` 4th `on_failure` disposition reusing the 085 SUBSCRIBE-before-emit pause) and the D-01 `citation_policy` post-verdict disposition land as thin additive seams on shipped mechanics: a `pre` validator runs BEFORE the phase body; any validator can pause for a human Proceed/Abort choice (Proceed writes a `validator_ask_user_approved` receipt + continues, Abort/unanswered fail honestly); `citation_policy` `strict` (the default) stays byte-identical while `flag`/`partial`/`draft` mark/blank/label the WR-02-persisted field-map and deliver via the deterministic driver — NO new emit shot, never a silent pass-off.**

## Performance
- **Duration:** ~12 min
- **Started:** 2026-06-12T07:16:10Z
- **Completed:** 2026-06-12T07:28:00Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

### Task 1 — `timing:pre` seam + `ask_user` 4th disposition (`harness_engine.py`)
- **D-11 `_parse_on_failure`:** recognizes `ask_user` as the 4th disposition (`_OnFailure("ask_user", None)`) BEFORE the fail-safe; `fail_run`/`retry`/`skip_to_phase:<slug>` unchanged; unknown values still fail-safe to `fail_run` (T-091-18 preserved). `_route_on_failure` (the pure-sync mapper) treats `ask_user` as `fail_run` (it cannot await) — the pause is resolved by the new async helper, never the sync path.
- **D-10 `timing:pre` pre-gate pass:** a `pre = await run_gates(phase, {"_phase_inputs": accumulated_outputs}, ctx, timing="pre")` runs BEFORE the `while True:` executor loop (after the `validators` setup). On a pre failure it audits + emits `gate_failed` (with `timing="pre"`) then routes through `_resolve_failure_with_ask_user(..., is_pre=True)`: a returned `PhaseOutcome` (fail_run/skip_to_phase/aborted) returns immediately (body never runs); a `None` return (ask_user Proceed) falls through to the body. The existing post-gate call became `run_gates(..., timing="post")`. A phase with NO pre validators gets a passing GateResult immediately → byte-identical (proven by `test_no_pre_validators_runs_body_byte_identical`).
- **`_resolve_failure_with_ask_user` (the inline async pause, RESEARCH Pattern 3 / A4):** when the failing validator's disposition is NOT `ask_user`, delegates to `_route_on_failure` (byte-identical). When it IS `ask_user`, copies the `_exec_llm_human_input` ordering VERBATIM — derives the choices from the validator's structured finding (`_ask_user_choices_from_finding` parses the Plan-03 `freshness:staleness|...`/`freshness:version_ambiguity|...` prefix), inserts the durable prompt row (`messages` insert, `kind="ask_user_prompt"`, `run_id=str(run_id)`, best-effort), emits `ask_user_prompt` on the producer stream, then blocks on `subscribe_for_response(redis, run_id, tool_call_id, float(timeout))`. `None` (the 085 expiry) → `PhaseOutcome("fail_run", … unanswered)`; an Abort-like choice → `PhaseOutcome("fail_run", … aborted by user)`; a Proceed/use-version choice → `write_audit(event_type="validator_ask_user_approved", …)` then `None` (pre → run the body) or `PhaseOutcome("completed", produced_output, …)` (post → deliver the produced output). No live redis/run_id (a minimal/unit ctx) → fail-safe to `_route_on_failure`, never a hung run.
- **Wiring:** the exhausted POST-gate exit routes through the helper (`is_pre=False`, `produced_output=output`) so a post validator's ask_user Proceed delivers the produced output as `completed`; the WALL-CLOCK timeout exit stays `_route_on_failure` (a hung phase has no choice). All of `redis`/`pool`/`ctx`/`run_id`/`_audit_user_id`/`stream_run_id` are already in `_run_phase_with_gates` scope.

### Task 2 — `citation_policy` post-verdict disposition in `_exec_llm_emit` (D-01)
- **`emit_policy.py` (NEW, pure):** `apply_citation_policy(field_map, gate, policy)` — `flag` appends `[unverified]` to each uncited value + a coverage summary; `partial` BLANKS each uncited value (null-over-invent) + a gap list; `draft` delivers as-is + a DRAFT label. `strict` RAISES (it is the inline honest-fail path — never routed here, so a refactor cannot accidentally deliver an uncited map under the default). Matches uncited leaves by FIELD-NAME (the suffix after the last dot of `check_coverage`'s `"{location}.{field}"`) so it works on BOTH the legacy generic envelope (`scalar.k`/`risks0.risk_id`) and the bare-key flat test shape; mutates a deep copy.
- **`_exec_llm_emit` branch:** reads `citation_policy = getattr(phase.config, "citation_policy", "strict")` near the top. The verdict computation (`check_coverage`) + the gate-passed `break` are UNCHANGED — the policy gates ONLY the state-(b) disposition. `strict` (default): the VERBATIM existing lines (`_emit_phase_substep(failure="citation_gate_rejected")` + `_surface_failure_message` + `return _emit_failure_output("citation_gate_rejected", …, field_map=legacy_map)`) — byte-identical. Non-strict: `apply_citation_policy(legacy_map, gate, policy)` → replace `legacy_map` with the modified map → write a `policy_applied` receipt (carrying `citation_policy`/`policy_summary`/`gap_list`) → surface the summary visibly → `break` into the SAME render path (the deterministic driver re-renders the SAME map). The render-success return carries the policy summary into the deliverable's chat text; `emit_validated` is SKIPPED for the policy path (it didn't validate — `policy_applied` is the honest record).
- **Red lines held:** `grep -c "forced_emit(" phase_types.py` is unchanged at **1** (no new emit shot — the non-strict path re-renders, never re-emits); no provider/gateway/threads file touched; Deep untouched (`_exec_llm_emit` is harness-only).

## Task Commits

Each task was committed atomically:

1. **Task 1: timing:pre seam + ask_user 4th disposition (harness_engine.py)** — `1033c3e6` (feat)
2. **Task 2: citation_policy post-verdict disposition in _exec_llm_emit (D-01)** — `1d1fd7ac` (feat)

**Plan metadata:** (final docs commit) — SUMMARY + STATE + ROADMAP

_TDD note: per the project's Wave-0 un-mark-on-landing convention (098/099/101.1), the RED deliverable (the xfail-marked test stubs) shipped in Plan 01; this plan's GREEN un-marks fold into each task's feat commit. The thin Plan-01 stubs were STRENGTHENED to real behavior tests (mocking `subscribe_for_response` + `write_audit` + `_execute_phase` + `run_gates` per `feedback_mock_completeness`) — `test_ask_user_disposition.py` (4 → 6: parsed, proceed+receipt, post-gate completed, abort, unanswered-expiry, non-ask_user delegate), `test_pre_post_timing.py` (2 → 4: + the engine-side pre-gate-routes-before-body + no-pre-byte-identical), `test_citation_policy.py` (4 → 5: strict-refused, flag-marks-flat, flag-marks-legacy, partial-blanks, draft-labels)._

## Files Created/Modified
- `backend/app/services/harness/emit_policy.py` *(NEW)* — `apply_citation_policy` (flag/partial/draft transforms over the field-map; strict refused; pure, no I/O)
- `backend/app/services/harness_engine.py` — `_parse_on_failure` ask_user (D-11); `_run_phase_with_gates` pre-gate pass (D-10) + post `timing="post"`; `_resolve_failure_with_ask_user` + `_ask_user_choices_from_finding` + `_is_abort_choice`; the exhausted post-exit routed through the helper
- `backend/app/services/harness/phase_types.py` — `_exec_llm_emit` reads `citation_policy`; the state-(b) disposition branches strict (byte-identical) vs flag/partial/draft (re-render + `policy_applied` + visible summary); `emit_validated` skipped + the deliverable text carries the policy summary on the non-strict path
- `backend/tests/unit/test_ask_user_disposition.py` — un-marked + strengthened (6 tests)
- `backend/tests/unit/test_pre_post_timing.py` — un-marked + strengthened (4 tests)
- `backend/tests/unit/test_citation_policy.py` — un-marked + strengthened (5 tests)

## Decisions Made
- **ask_user is a NEW async helper, not an extension of `_route_on_failure`** — the sync mapper cannot await the user (RESEARCH Pattern 3 / A4 anti-pattern); `_route_on_failure` fails-safe to fail_run on an ask_user disposition so a pause-unreachable path (no redis/ctx) never hangs.
- **The exhausted POST exit routes through the helper, not the sync mapper** — so a post validator's ask_user Proceed can deliver the produced output as `completed`. The wall-clock timeout exit stays `_route_on_failure` (a hung phase has no ask_user choice).
- **`apply_citation_policy` RAISES on `strict`** — strict is the inline honest-fail path; refusing it structurally guarantees the default can never accidentally deliver an uncited map (T-102-04-04).
- **The non-strict path skips `emit_validated`** (the gate did NOT validate) and writes `policy_applied` instead — the audit story is honest about what actually happened.

## Deviations from Plan

None — plan executed exactly as written. Both seams landed surgically on the two named files; the strict path + the default-post path + Deep mode all stayed byte-identical; the ask_user pause reused the 085 ordering verbatim; the citation_policy non-strict path re-renders the persisted map with no new emit shot. The Plan-01 thin test stubs were strengthened to real behavior tests (the un-mark-on-landing convention explicitly invites this — the stubs pinned the contract, this plan satisfies the behavior).

## Authentication Gates
None — no auth-gated step in this plan (pure offline engine + unit work; the live ask_user pause + the live policy render are exercised by phase verification's UAT, not here).

## SEED-056 Net-New-Failure Proof
- **Plan-04 target suite:** `test_ask_user_disposition.py` (6) + `test_pre_post_timing.py` (4) + `test_citation_policy.py` (5) = **15 passed / 0 failed**.
- **Adjacent regression slice** (`-k "harness or bounded_retry or route or reachability or run_gates or phase_dispatch or gate"`): **55 passed** — the post-gate routing change (now via the async helper) is byte-clean for every non-ask_user phase; `test_llm_emit_executor.py` = **30 passed** (the strict citation path byte-identical).
- **Wider slice** (`-k "harness or emit or template or validator or freshness or gate or bounded or reachability or route or forced or gateway or phase or citation or ask_user or audit or policy or retrieval"`): the failures are `test_075_4_final_output_files_payload`×2 + `test_phase56_iteration_start` + `test_retrieval_service`×7 — ALL **PRE-EXISTING ROT proven by base-checkout**: with `harness_engine.py` + `phase_types.py` checked out to the wave base `014abd24`, the same set fails IDENTICALLY; they grep `threads.py`/`task_service.py` source or test the retrieval service and import NONE of this plan's changed modules (grep-confirmed). Source restored clean to HEAD; the 15 Plan-04 tests re-confirmed GREEN after restore. **Net-new failures introduced by this plan = 0.**

## Threat Surface
All changes fall inside the plan's `<threat_model>` (T-102-04-01..05):
- **T-102-04-01 (DoS — paused-run stranding):** mitigated — the pause reuses `ask_user_service` VERBATIM (SUBSCRIBE-before-emit, durable prompt row stamped `run_id`, `subscribe_for_response` returns `None` on expiry → honest `fail_run`, never hung). No live redis/run_id → fail-safe to `_route_on_failure`.
- **T-102-04-02 (Repudiation — Proceed-on-stale-data with no trail):** mitigated — a Proceed writes a `validator_ask_user_approved` receipt (INSERT-only, run-owner `_audit_user_id` bound) carrying the phase/validator/choice/finding; an Abort/unanswered writes NO approval receipt (asserted by `test_ask_user_abort_fails_run`).
- **T-102-04-03 (Spoofing — silent pass-off of unverified data):** mitigated — every non-strict mode marks (`flag` `[unverified]` + summary), blanks (`partial` null + gap list), or labels (`draft` DRAFT); the marks/blanks render IN the doc via the deterministic driver (never the model) AND the summary is surfaced + carried into the deliverable text; tests assert each mode's mark/blank/label is present.
- **T-102-04-04 (Tampering — strict drifting from byte-identical):** mitigated — the `strict` branch is the verbatim existing state-(b) lines; `apply_citation_policy` REFUSES `strict`; `grep -c "forced_emit("` unchanged at 1 (no new emit shot).
- **T-102-04-05 (EoP — pre-gate widening retrieval scope):** accepted as designed — the pre-gate runs the SAME closed-registry validators over `{"_phase_inputs": accumulated_outputs}` + ctx; freshness queries only the bound `folder_scope` (Plan 03). No scope-widening surface added.

No new network endpoint, auth path, or trust-boundary surface introduced — both seams extend in-process engine/executor mechanics. **No threat flags.**

## Known Stubs
None. Both seams are complete behavior contracts. `emit_policy.apply_citation_policy` is a fully-implemented pure transform; the `_resolve_failure_with_ask_user` pause is the real 085 substrate. The live ask_user pause + the live policy render are exercised by phase verification's UAT (the documented "the live UAT is the gate" posture) — not stubs, just behavior whose live acceptance is the cross-provider verify-work sweep, consistent with the multi-plan phase design.

## Next Phase Readiness
- **Plan 05 (publish service / QUAL-01) unblocked:** the `timing`/`ask_user`/`policy` seams are live; the publish judge gate (`llm_judge_rubric`) reuses the same gate loop + disposition machinery; a judge run-time failure can route via the same one-policy-family vocabulary (D-02).
- **103 (NL builder) substrate ready:** the `citation_policy` family (strict|flag|partial|draft) is consumed engine-side — 103's builder surfaces it as one plain-language "compliance-grade or working-grade?" question with no further engine work.
- **105 (budget preflights) substrate ready:** the generic `timing:pre` pre-gate pass is the seam budget caps reuse — no new engine machinery.

## Self-Check: PASSED

- `backend/app/services/harness/emit_policy.py` — FOUND.
- `backend/app/services/harness_engine.py` — `timing="pre"`/`timing="post"` (3), `subscribe_for_response` (3), `validator_ask_user_approved` (3) all present.
- `backend/app/services/harness/phase_types.py` — `citation_policy` (7), `apply_citation_policy`/`policy_applied` (9), `forced_emit(` unchanged at 1.
- Commit `1033c3e6` (Task 1) — FOUND in git history.
- Commit `1d1fd7ac` (Task 2) — FOUND in git history.
- All 15 Plan-04 tests GREEN; net-new failures = 0 (base-checkout proven against `014abd24`).
- `_parse_on_failure`: `ask_user`→ask_user, `bogus`→fail_run, `fail_run`→fail_run, `skip_to_phase:x`→skip_to_phase — verified live.

---
*Phase: 102-reusable-validation-gate-library-output-quality-gate*
*Completed: 2026-06-12*
