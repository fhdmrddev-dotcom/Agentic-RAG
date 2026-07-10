---
phase: 122-cross-provider-trust-honesty-parity
plan: 02
subsystem: provider-gateway / forced-emit substrate
tags: [MP-01, forced-emit, recovery-ladder, emit_tier, cross-provider, strict-400, honest-fail, tdd]

requires:
  - phase: 122-01
    provides: "emit_tier Literal[force_strict|force|coerce] on every MODEL_CAPABILITIES row + default-SAFE coerce on registry miss (get_model_capability(...).get('emit_tier','coerce'))"
  - phase: 101.1
    provides: "the forced_emit substrate (sealed shot, narration recovery, truncation guard, honest-fail floor, cross-provider key injection)"
provides:
  - "the ordered rung-loop recovery ladder INSIDE forced_emit — a strict-400 recovers via non_strict_force OR coerce instead of degrading to a silent None (BUG-260615-01 healed for all 4 consumers)"
  - "emit_rung telemetry on the success dict (winning rung name) + identifier-only logger.info; the ladder NEVER mutates the registry (D-122-03)"
  - "_RUNGS_BY_TIER tier-scoped mapping (force_strict→[strict_force,non_strict_force,coerce], force→[non_strict_force,coerce], coerce→[coerce]) — a coerce-tier model never runs the strict rung"
  - "non-vacuous HARD-schema descent + tier-scoping + emit_tier-default regression tests"
affects:
  - "scripts/eval_cross_provider.py (Plan 122-03 --forced-emit scoreboard reads winning_rung emitted by this ladder)"
  - "phase_types.py llm_emit / publish_service+validator_kinds judge / workflow_authoring NL-gen / embedding_service metadata extraction (all inherit the ladder unchanged)"

tech-stack:
  added: []
  patterns:
    - "ordered rung-loop recovery: chain already-known-good emission MODES (strict-force → non-strict-force → coerce → honest-fail) rather than short-circuit on the first failure"
    - "tier-scoped rung lists keyed by emit_tier (the registry tier names the LADDER'S TOP RUNG, not a single mode)"
    - "re-drive the gateway per rung (open_stream) — recovery lives at the adapter boundary, the shared _normalize path is NEVER forked (D-14)"
    - "pure runtime recovery: log the winning rung identifier-only, never write the registry (no auto-demotion, D-122-03)"

key-files:
  created: []
  modified:
    - "backend/app/services/forced_emit.py"
    - "backend/tests/unit/test_forced_emit.py"
    - "backend/tests/unit/test_103_forced_emit_strict.py"

key-decisions:
  - "The strict override is honored by DEMOTING the strict_force rung to non_strict_force when the caller passes strict=False (skip the strict rung — it would be a redundant non-strict duplicate); strict=True forces effective_strict on the first forced rung; strict=None honors each rung's declared strict (byte-identical for emit/judge)"
  - "The honest-fail floor returns forced=False + emit_rung=None and carries the LAST rung's failure reason (truncated→model_failed_to_emit, all-raised→provider_error) — mirrors the pre-122 shape, never silent, never fabricated"
  - "Updated the existing _patch_gateway / _patch_strict_capable mocks to resolve on emit_tier (the ladder reads emit_tier, not the deprecated-unread forced_emission/strict_json_schema bools)"

patterns-established:
  - "Recovery ladder: an ordered list of (rung_name, forced, strict_schema) tuples looped until one yields a validated emission; continue on provider_error/truncation/no-emit; honest _failure floor after the last rung"
  - "Non-vacuous descent test: sequence open_stream per-call (raise, raise, succeed) so the WINNING rung is the one the ladder actually reached (defeats the Phase-102/104 static-false-green trap)"

requirements-completed: [MP-01]

duration: ~13min
completed: 2026-06-23
---

# Phase 122 Plan 02: Force→Coerce Recovery Ladder in forced_emit (MP-01) Summary

**Chained `forced_emit`'s existing forcing modes into an ordered, tier-scoped recovery ladder (strict_force → non_strict_force → coerce → honest-fail) so a strict-400 recovers via a lower rung instead of degrading to a silent `None` (BUG-260615-01) — all four emit consumers heal for free, with `emit_rung` telemetry and zero registry mutation.**

## Performance

- **Duration:** ~13 min
- **Started:** 2026-06-23T04:04Z (approx)
- **Completed:** 2026-06-23T04:17Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 3

## Accomplishments

- **The ladder is live in `forced_emit` itself** — refactored the 2-rung `if forced: … else: …` shape into a loop over `_RUNGS_BY_TIER[emit_tier]`. A provider raise (strict 400) / truncation / no-emit on a rung now `continue`s to the NEXT rung; only after the last rung does the honest `_failure()` floor return. Because the ladder lives in the shared substrate (D-122-01), all 4 consumers (workflow `llm_emit`/`render_template`, the Phase-102 judge, Phase-103 NL authoring, Phase-111 metadata extraction) recover unchanged — the live default-config metadata-extraction silent-fail folds as a side effect.
- **Tier resolution moved to `emit_tier`** (MP-02 substrate from Plan 01): `emit_tier = cap.get("emit_tier", "coerce")` with a boundary guard that coerces any unknown value to the safe `coerce` floor. The deprecated-unread `forced_emission`/`strict_json_schema` bools are no longer read by the ladder.
- **`emit_rung` telemetry** added to the success dict (the winning rung name) + an identifier-only `logger.info` (rung + tier + provider, T-073-04). The honest-fail floor carries `emit_rung=None`. The ladder NEVER writes the registry (D-122-03 — runtime auto-demotion rejected).
- **The Phase-103 strict override is preserved** through the loop: `strict=None` → each rung's declared strict (byte-identical); `strict=False` → demote the `strict_force` rung (skip it) so the authoring shot avoids the OpenAI/DeepSeek strict 400; `strict=True` → force strict ON on the first forced rung.
- **The 111.1 cross-provider key/base_url injection block (`:251-291`) is untouched** (Pitfall 5 — diff-verified, no `+/-` line touches the `ollama`/`lmstudio` branch or the cloud key-inject path).
- **Non-vacuous descent test** reproduces the Pitfall-2 HARD-schema chain (strict-400 → non-strict-400 → coerce-success) and asserts `emit_rung=="coerce"` with a real emission — the recovery rung is genuinely exercised, not a happy-path masquerade.

## Task Commits

Each task was committed atomically (both TDD — implementation + test):

1. **Task 1: Refactor forced_emit into the ordered rung-loop ladder** — `48396c3b` (feat)
2. **Task 2: Rung-descent + tier-scoping + emit_tier-default tests** — `20358d89` (test)

**Plan metadata:** _(this commit)_ `docs(122-02): complete force-coerce recovery ladder plan`

_Note: Task 1 folded the `emit_rung` RED assertion + fixture migration into the single feat commit (the ladder implementation and its happy/coerce/provider-error assertions are one atomic unit); Task 2 is the dedicated descent/tier-scoping/default test commit._

## Files Created/Modified

- `backend/app/services/forced_emit.py` — Added `_RUNGS_BY_TIER` (tier-scoped rung mapping), `_build_request` (parameterized FORCE/COERCE request assembly extracted from the old if/else), `_extract_or_recover` (the per-rung validate + D-06 narration recovery, reused verbatim); refactored the `forced_emit` body into the rung loop; added `emit_rung` to the success dict + `_failure` floor; updated the docstring to describe the ladder.
- `backend/tests/unit/test_forced_emit.py` — Migrated the `_patch_gateway` mock to resolve on `emit_tier="force_strict"`; added `emit_rung` assertions on the happy/coerce/provider-error paths; added 4 Task-2 tests (`_sequence_gateway` per-rung driver + `_patch_tier` helper): strict→coerce descent (non-vacuous), strict→non-strict recovery, coerce tier-scoping, registry-miss default.
- `backend/tests/unit/test_103_forced_emit_strict.py` — Added `emit_tier` to `_patch_strict_capable` (`force_strict`) and `test_strict_true_overrides` (`force`) mocks so the strict override asserts against the ladder's rung resolution.

## How It Was Verified

- **Task 1 verify:** `pytest test_forced_emit.py test_103_forced_emit_strict.py -x` → **17/17 pass** (all existing substrate + 103 strict-override tests stay green; the `emit_rung` assertions added).
- **Task 2 verify:** `pytest test_forced_emit.py -k "ladder or tier_scoped or emit_tier_default" -x` → **4/4 pass** (the VALIDATION.md selectors).
- **Consumer happy-path (all 4 forced_emit consumers, no net-new failures):** `pytest test_llm_emit_executor.py test_validator_kinds.py test_103_nl_generate.py test_embedding_service.py` → **56/56 pass** (the metadata-extraction path that BUG-260615-01 healed verified byte-identical on the happy path).
- **Forcing/gateway/registry/seam regression set:** `pytest test_forced_emit.py test_103_forced_emit_strict.py test_gateway_forcing.py test_config_registry.py test_provider_gateway_seam.py` → **53/53 pass** (was 49 in the 122-01 baseline; +4 new ladder tests, ZERO regression).
- **Source assertions:** `_RUNGS_BY_TIER` keyed by emit_tier with the three tiers' rung lists in §Interfaces order; the success dict contains `emit_rung`; the `except` on the sealed call `continue`s (descends) rather than `return _failure`; a registry-miss model resolves `emit_tier="coerce"` → rung list `[coerce]` only.
- **Pitfall 5:** `git diff backend/app/services/forced_emit.py | grep` for the injection-block tokens → **INJECTION BLOCK UNTOUCHED** (no `+/-` line touches the 111.1 `ollama`/`lmstudio` seam).

## Decisions Made

- **strict override folds into rung selection:** rather than thread `strict` into a single `if forced` branch, the loop applies `effective_strict = rung_strict if strict is None else bool(strict)` and SKIPS the `strict_force` rung when `strict is False` (a strict_force rung with strict off would duplicate non_strict_force). This preserves the exact Phase-103 byte-identity (`strict=None` → cap-derived) while making the authoring shot's `strict=False` start on a non-strict forced rung.
- **The honest-fail floor reports the LAST rung's failure reason** (`provider_error` if every rung raised, `model_failed_to_emit` for a truncated/no-emit final rung) and `truncated` reflects the last rung — preserving the existing test contract (`test_forced_emit_truncation_rejected` expects `failure=="model_failed_to_emit"`, `test_forced_emit_open_stream_raise_provider_error` expects `"provider_error"`).
- **Existing-test fixture migration is in-scope, not a deviation:** the ladder reads `emit_tier`, so the existing `_patch_gateway`/`_patch_strict_capable` mocks (which had no `emit_tier`) would have resolved to `coerce` and broken the force happy-path assertions. Updating those mocks to carry `emit_tier` is part of preserving the existing tests green (Task 1's acceptance criterion).

## Deviations from Plan

None - plan executed exactly as written.

The plan structured Task 1 as `tdd="true"` with the existing-test suite as its gate and Task 2 as the dedicated descent-test commit. The `emit_rung` RED assertions and the fixture `emit_tier` migration were folded into the Task-1 feat commit because the ladder implementation and its immediate happy/coerce/provider-error assertions form one atomic unit; the descent/tier-scoping/default tests are the separate Task-2 commit per the plan.

## Issues Encountered

None. The descent-test sequencing (`_sequence_gateway` driving `open_stream` per-call with raise/return) cleanly reproduces the strict-400 → non-strict-400 → coerce-success chain; the test would fail against the pre-122 2-rung code (which short-circuits to `provider_error` on the first raise), confirming non-vacuousness.

## Known Stubs

None. No placeholder values, no hardcoded-empty data, no unwired paths. `emit_rung` is populated on every success path and explicitly `None` on the honest-fail floor; the ladder is fully wired into the existing extract/recover/truncation machinery.

## Threat Flags

None. The plan's threat register (T-122-02-01 Spoofing / T-122-02-02 Tampering / T-122-02-03+04 Information Disclosure) is fully mitigated in code: every rung validates against the Pydantic `schema_model` via `_extract_or_recover`; the rung-4 floor returns `_failure(emitted=None)`; the ladder logs identifier-only and never writes the registry; the `:251-291` key-injection seam is reused unchanged. No NEW security surface (no new endpoint, auth path, file access, or schema change) was introduced.

## Next Phase Readiness

- **Plan 122-03 (MP-03 scoreboard)** can now read the `emit_rung` the ladder emits per provider — the `--forced-emit` matrix scores which rung each provider needed (trigger/force/recovery/honest-fail axes).
- The ladder is the runtime; the registry `emit_tier` is the declared truth. The MP-03 scoreboard is the ONLY thing that may promote/demote a tier (operator grep ritual, D-122-06) — the ladder never does.

## Self-Check: PASSED

- Files verified on disk: `forced_emit.py`, `test_forced_emit.py`, `test_103_forced_emit_strict.py`, `122-02-SUMMARY.md` — all FOUND.
- Commits verified in git log: `48396c3b` (feat — ladder), `20358d89` (test — descent/tier-scoping/default) — all FOUND.

---
*Phase: 122-cross-provider-trust-honesty-parity*
*Completed: 2026-06-23*
