---
phase: 256-every-token-is-counted-and-kept
verified: 2026-09-19T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists.
status: gaps_found
score: 2/4 success criteria verified
overrides_applied: 0
gaps:
  - truth: "SC#1 / METER-03 — A harness run's token total is persisted and durable: re-reading the run after the process restarts returns the same totals the in-memory ceiling saw during the run."
    status: failed
    reason: >
      Durability holds only at the two persist call sites inside run_workflow's loop
      (harness_engine.py:2036 phase_boundary, :2605 phase_completed). Three ordinary,
      non-exceptional control-flow returns sit between a phase's execution and the next
      persist and reach neither: pause_run (:2308, a first-class human-gate pause),
      fail_run (:2336, reached after gate retries are exhausted — i.e. after the MOST
      expensive phase), and a dangling skip_to_phase target (:2377). Each returns from
      run_workflow without calling persist_run_usage/absorb_usage_box for the phase that
      just ran. The next segment starts with ctx.run_usage_box = {} (:1884) and a fresh
      CircuitBreaker at 0 (circuit_breaker.py:117), and nothing reads workflow_runs back
      to re-seed it, so the loss is permanent. D-256-03 forbids summing workflow_runs
      against the runs producer shell to recover it. Concrete: a two-phase workflow whose
      phase 1 calls ask_user burns tokens, the gate elapses, the person answers later, the
      re-drive re-runs phase 1 — workflow_runs.input_tokens records only one of the two
      segments. This is CR-01 in 256-REVIEW.md, re-derived directly against the merged
      tree rather than trusted from the review.
    artifacts:
      - path: "backend/app/services/harness_engine.py"
        issue: "returns at :2308 (pause_run), :2336 (fail_run), :2377 (dangling skip target) do not call persist_run_usage before returning; only :2036 and :2605 do"
    missing:
      - "A persist (absorb_usage_box + persist_run_usage) before each of the three non-linear returns, or a try/finally wrapping the phase loop so every exit flushes the current segment's delta (idempotent by the delta's own watermark derivation, per the review's suggested fix)"
      - "A test that pauses a run on a human gate (or drives fail_run) and asserts workflow_runs.input_tokens is non-NULL and reflects the phase that ran immediately before the pause/fail"
  - truth: "SC#4 / METER-06 — the llm_emit/forced_emit blind spot is either counted or registered, and WHICH of the two is true is discoverable from the run's own totals, not from someone's memory."
    status: failed
    reason: >
      The counting work itself is real and verified: forced_emit._drain's two usage arms,
      the ladder accumulator (including failed rungs), and _exec_llm_emit's recording line
      all exist and are exercised by 123 passing phase-256 unit tests. But
      persist_run_usage (db/workflows.py:2120) writes token_coverage =
      list(TOKEN_COVERAGE_LEGS) — the complete four-leg tuple — UNCONDITIONALLY on every
      persisted delta, regardless of what actually got counted. Two in-run callers of
      forced_emit discard its returned token totals entirely: validator_kinds.py:592 (the
      registered `llm_judge_rubric` validator, a real provider call with ctx in scope) and
      publish_service.py:1779 (the publish-gauntlet judge, up to 3 billed shots per
      publish). Neither call site invokes _record_run_usage or any equivalent, confirmed
      by reading both functions end to end — the `result` dict's token fields are never
      read. So a run with real, uncounted judge/validator spend is marked
      token_coverage = {agent,single,batch,emit}, the same marker an honestly complete
      run gets, and migration 182's partial index (idx_workflow_runs_org_coverage_incomplete,
      predicate token_coverage @> ARRAY['agent','single','batch','emit']) excludes that
      run from the one access path Phase 257's METER-07 "what it cannot see" view is built
      to read. SEED-300 does not cover either instance (its trigger_paths name neither
      validator_kinds.py nor publish_service.py). This is CR-02 in 256-REVIEW.md,
      re-derived directly.
    artifacts:
      - path: "backend/app/db/workflows.py"
        issue: "persist_run_usage writes the full TOKEN_COVERAGE_LEGS tuple unconditionally at :2120, with no awareness of the validator/judge legs that were actually dropped"
      - path: "backend/app/services/harness/validator_kinds.py"
        issue: "line 592 calls forced_emit and reads only result['emitted']/result['failure']; the token fields on the same dict are never consumed"
      - path: "backend/app/services/harness/publish_service.py"
        issue: "line 1779 (inside a 3-attempt retry loop) calls forced_emit and reads only result['emitted']/result['failure']; token fields discarded on every attempt"
    missing:
      - "Either wire validator_kinds.py:592 and publish_service.py:1779 into _record_run_usage (mirroring phase_types.py:1586, ~2 lines each per the review's Option A), or narrow TOKEN_COVERAGE_LEGS to name the judge leg honestly and extend the migration 182 predicate so judge-bearing runs fall into the incomplete index (Option B) — and state which was chosen in the column's own comment"
      - "A register entry (or SEED-300 amendment) naming this specific hole with a concrete trigger, if Option A is deferred rather than taken"
deferred: []
human_verification: []
---

# Phase 256: Every Token Is Counted And Kept — Verification Report

**Phase Goal:** No run loses its token count. A harness run, a run that spawned sub-agents, and a
chat run that paused for `ask_user` or was continued all finish with real, persisted totals — and
any remaining hole is named in a register rather than left silent.
**Verified:** 2026-09-19
**Status:** gaps_found
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths (ROADMAP Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | METER-03 — a harness/workflow run's token totals are persisted and durable across a process restart | ✗ FAILED | `harness_engine.py:2308/:2336/:2377` return from `run_workflow` without reaching `persist_run_usage` (called only at `:2036`/`:2605`); the just-executed phase's spend is unrecoverable. See CR-01, re-derived. |
| 2 | METER-04 — sub-agent tokens roll up into the producer run and appear in exactly one place | ✓ VERIFIED | `phase_types.py:766-781 _record_run_usage` sums a completed sub-agent's totals into the parent's `ctx.run_usage_box`, not into the sub-agent's own persisted row. `test_256_token_sum_narrowing.py`'s Fence 1 (AST-walk over `backend/app/**/*.py`) fails on any `runs`-table token aggregation lacking `parent_run_id IS NULL`; grep confirms no un-narrowed aggregation exists anywhere in `backend/app` today, so the fence guards the future correctly. |
| 3 | METER-05 — a chat run paused for `ask_user` and answered, or continued, finishes with real (not `input_tokens=None`) totals | ✓ VERIFIED | `grep -rn "input_tokens=None" backend/app` now returns only `run_lifecycle.py:369` (a function default parameter, not a call site) and `run_reconciler.py:236` (a deliberately registered, structurally unrecoverable hole — `SEED-299`, a stranded chat run whose in-memory box died with the process, not the ask_user/continuation paths SC#3 names). Both `api/runs.py:677` and `:1331` — the two sites SC#3 names verbatim — now pass `input_tokens=_in_tok` sourced from the live usage box. |
| 4 | METER-06 — `llm_emit`/`forced_emit` spend is counted or registered, and which is true is discoverable from the run's own totals, not memory | ✗ FAILED | The counting mechanism (`forced_emit._drain` arms, ladder accumulator, `_exec_llm_emit` recording) is real and tested. But `persist_run_usage` writes the complete 4-leg `token_coverage` marker unconditionally on every persist, while two in-run `forced_emit` callers (`validator_kinds.py:592`, `publish_service.py:1779`) discard their returned token totals with no register entry covering either. A run with real uncounted judge spend reads as fully covered — the exact failure SC#4 forbids, produced by the mechanism meant to prevent it. See CR-02, re-derived. |

**Score:** 2/4 success criteria verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/182_workflow_runs_token_totals.sql` | 3 nullable columns + coverage marker + partial index | ✓ VERIFIED | Applied to local DB (orchestrator: `verify.schema-drift 256` → `drift_detected: false`); `full-schema.sql` regenerated and carries the columns + index. |
| `backend/app/db/workflows.py::persist_run_usage` + `TOKEN_COVERAGE_LEGS` | one-home ADD writer | ✓ VERIFIED (mechanics) / ✗ over-claims coverage | `COALESCE(col,0) + $n` confirmed at `:2116-2126`; zero-delta short-circuit confirmed; but `token_coverage = $4` is unconditional — see gap 2 above. |
| `backend/app/services/circuit_breaker.py::absorb_usage_box` | returns clamped delta | ✓ VERIFIED | `max(0, …)` on both, one caller in `backend/app`, tuple-unpacked. |
| `backend/app/api/runs.py`, `publish_service.py`, `scheduler_service.py`, `harness_engine.py` (site 3), `eval_runner_service.py` | 5 producer shells write real totals instead of `input_tokens=None` | ✓ VERIFIED | All 5 confirmed writing `input_tokens=_in_tok` / equivalent; 123 phase-256 unit tests pass live (`pytest tests/unit/test_256_*.py -q` → `123 passed`). |
| `backend/app/services/forced_emit.py` | drain arms + ladder accumulator counting failed rungs | ✓ VERIFIED | Code present, hot-file ledger row added (D-256-13), tests pass. |
| `docs/HOT-FILE-LEDGER.md` / `CLAUDE.md` scan list | rows for the 9 files this phase touches/reads | ✓ VERIFIED | Orchestrator: `check-hot-file-ledger.cjs 256` → exit 0, `watched: 9` (non-vacuous). |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `harness_engine.py::_enforce_budget` (`:2036`, `:2605`) | `db/workflows.py::persist_run_usage` | `await persist_run_usage(...)` above the `armed` guard | ✓ WIRED for the two loop-boundary call sites | Confirmed by reading the reorder and the docstring's own arithmetic proof; unaffected by CR-01. |
| `harness_engine.py::run_workflow`'s `pause_run`/`fail_run`/dangling-skip returns (`:2308`/`:2336`/`:2377`) | `db/workflows.py::persist_run_usage` | — | ✗ NOT WIRED | No persist call reachable from any of the three returns — this is CR-01. |
| `validator_kinds.py:592`, `publish_service.py:1779` (`forced_emit` callers) | `phase_types.py::_record_run_usage` | — | ✗ NOT WIRED | Neither call site reads the token fields on `forced_emit`'s return dict — this is CR-02. |
| `phase_types.py:1586` (`_exec_llm_emit`) | `phase_types.py::_record_run_usage` | `_record_run_usage(ctx, ...)` | ✓ WIRED | The one `forced_emit` call site (of ten in `backend/app`) that does consume the returned totals. |

### Requirements Coverage

| Requirement | Source Plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| METER-03 | 256-01 | Workflow/harness run persists token totals, durable across restart | ✗ BLOCKED (partial) | Persists correctly at the two loop-boundary sites; fails to persist the final phase's spend on `pause_run`/`fail_run`/dangling-skip exits (CR-01) |
| METER-04 | 256-01, 256-02 | Sub-agent usage rolls up, counted exactly once | ✓ SATISFIED | `_record_run_usage` rollup + Fence 1 narrowing guard, both verified against code |
| METER-05 | 256-01, 256-03 | ask_user pause / continuation finalize with real totals | ✓ SATISFIED | Both named sites (`api/runs.py:677`, `:1331`) plus 3 more producer shells write real totals; verified live |
| METER-06 | 256-04 (+256-02 register half) | `llm_emit`/`forced_emit` counted or registered, discoverably | ✗ BLOCKED (partial) | Counting is real for the one wired call site; two other in-run callers' spend is neither counted nor registered, and the coverage marker falsely claims complete coverage over them (CR-02) |

All four requirement IDs declared in plan frontmatter are accounted for; none orphaned against `.planning/REQUIREMENTS.md`.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| — | — | No `TBD`/`FIXME`/`XXX` found in any of the 9 files this phase modified (checked directly, not from SUMMARY) | — | none |
| `.planning/seeds/SEED-300-...md` | frontmatter | `status: planted` even though its hole #2 (eval WITHOUT-arm token loss) was fixed by plan 256-03 (`eval_runner_service.py:971`, `usage_acc=usage_acc`) | ⚠ Warning | Register-rot risk (WR-04 in 256-REVIEW.md) — will be re-proposed at the next `/gsd:new-milestone` seeds sweep describing a hole that no longer exists in that specific respect. Does not block the phase goal; flagged for cleanup. |
| `harness_engine.py:1928-1934` (docstring) | — | `persist_run_usage` write has no `try`/retry; an UPDATE failure both loses the delta and propagates to fail an otherwise-healthy run (WR-01) | ⚠ Warning | Does not fail an SC directly (no failure was reproduced — this is a latent risk under a DB blip), but compounds CR-01's loss surface. Not scored as a blocker here since it requires an infra fault to trigger, unlike CR-01/CR-02 which reproduce on ordinary control flow. |
| `db/workflows.py:2120` | — | `token_coverage` is SET (not intersected) on every write, so a run resumed across a deploy that ships a new leg is retro-claimed as covering segments it never measured (WR-03) | ℹ Info | Real but narrower than CR-02 (requires a mid-run deploy); not scored as a phase-goal blocker. |

### Human Verification Required

None. Both blocking findings are reproducible by direct code read (file:line) and are not matters of
visual/UX judgment.

### Gaps Summary

Two of the four ROADMAP success criteria are met cleanly and are re-derived, not merely trusted:
METER-04 (sub-agent rollup, exactly-once) and METER-05 (ask_user pause / continuation finalize with
real totals) both hold under direct code inspection and a live run of the phase's 123 unit tests.

The other two fail for reasons the code review already found and this verification independently
re-derived against the merged tree rather than trusting the review or the SUMMARYs:

- **METER-03 (SC#1)** persists totals correctly only at the two ordinary loop-boundary sites. Three
  normal, first-class exits — a human-gate pause, a run that fails after exhausting gate retries, and
  a dangling skip target — return from `run_workflow` without ever persisting the phase that just ran,
  and that loss is permanent and unrecoverable by any legitimate read (`D-256-03` forbids summing
  across tables to recover it). A human-gate pause is not an edge case in this product; it is the
  exact mechanism METER-05 exists to serve on the chat side, and its harness-side counterpart loses
  money silently.
- **METER-06 (SC#4)** correctly counts the one `forced_emit` call site wired to `_record_run_usage`,
  but two other in-run callers (an in-run judge validator and the publish-gauntlet judge, up to 3
  billed shots) have their token totals dropped on the floor with no register entry, while the
  coverage marker unconditionally claims complete 4-leg coverage regardless. This is the specific
  failure mode SC#4's own wording — "discoverable from the run's own totals, not from someone's
  memory" — exists to prevent, and it is reproduced by the very column built to prevent it.

Both defects are narrow (a handful of lines each, per the review's suggested fixes) and neither
requires new architecture — but both are reachable on ordinary, currently-shipped paths, not edge
cases requiring fault injection, so neither can be waved through as an Info-level finding. Per the
verification brief's explicit instruction, neither is softened because the phase is otherwise strong,
and the phase is not inflated into a full failure because of them — METER-04 and METER-05 stand as
genuinely met.

**Consequence for Phase 257 (already flagged in ROADMAP's own Phase 256 Flags and CR-02):** Migration
182's partial index excludes any run marked fully-covered from `idx_workflow_runs_org_coverage_incomplete`
— which is the exact access path Phase 257's METER-07 "what it cannot see" view reads. Shipping 257
against the current marker means its blind-spot view will under-report, silently, for every
judge/validator-bearing run.

---

_Verified: 2026-09-19_
_Verifier: Claude (gsd-verifier)_
