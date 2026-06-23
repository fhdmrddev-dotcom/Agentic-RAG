---
phase: 122-cross-provider-trust-honesty-parity
reviewed: 2026-06-23T00:00:00Z
depth: standard
files_reviewed: 13
files_reviewed_list:
  - backend/app/config.py
  - backend/app/services/agent_loop.py
  - backend/app/services/forced_emit.py
  - backend/app/services/openai_service.py
  - scripts/eval_cross_provider.py
  - frontend/src/lib/workspacePanel.ts
  - backend/tests/unit/test_config_registry.py
  - backend/tests/unit/test_gateway_forcing.py
  - backend/tests/unit/test_forced_emit.py
  - backend/tests/unit/test_103_forced_emit_strict.py
  - backend/tests/unit/test_eval_forced_emit.py
  - backend/tests/unit/test_system_prompt.py
  - frontend/src/lib/workspacePanel.test.ts
findings:
  critical: 0
  warning: 4
  info: 5
  total: 9
status: issues_found
---

# Phase 122: Code Review Report

**Reviewed:** 2026-06-23
**Depth:** standard
**Files Reviewed:** 13
**Status:** issues_found

## Summary

Phase 122 introduces the explicit `emit_tier` enum as the single source of truth for cross-provider forced emission, replaces the implicit two-bool guess (`forced_emission` + `strict_json_schema`), removes the `provider == "openai"` name gate plus the inert function-level `strict` flag in `openai_service.py`, adds a 4-rung recovery ladder (`force_strict → force → coerce → honest-fail`) in `forced_emit.py`, and adds a `--forced-emit` eval scoreboard. The frontend change is a single export-visibility tweak on `humanize`; the `agent_loop.py` change is a one-bullet system-prompt nudge.

**The load-bearing correctness checks pass.** I verified:

- **Registry is not mutated at runtime.** The ladder reads `cap.get("emit_tier", "coerce")` and logs the winning rung only — no write path back into `MODEL_CAPABILITIES` (forced_emit.py:485-490). The registry-miss default is `coerce` (default-SAFE).
- **The strict json_schema response_format is still requested correctly via tier.** `forced_emit._build_request` → `GatewayRequest.strict_schema` → `openai_compat` (`strict_response_format=request.strict_schema`) → `create_adaptive_streaming_chat`. The `force_strict` first rung carries `rung_strict=True`, so OpenAI's token-level guarantee is preserved (proven non-vacuously by `test_openai_force_strict_preserved` and `test_no_provider_gate`).
- **No provider-specific behavior leaked into the shared path (D-14).** The removed gate lived inside the adapter's own request construction (`create_adaptive_streaming_chat`, never reached on the auto path). `test_no_provider_branch_in_shared_path` guards the consumer.
- **The honest-fail floor is genuinely honest.** Every tier's rung list always includes at least one real attempt (`strict=False` only skips `strict_force`, never the `non_strict_force`/`coerce` rungs), so the `_failure(...)` floor (`emitted=None`, non-None `failure`, `emit_rung=None`) is reached only after real attempts — never a fabricated empty-but-success result. The rung-descent control flow is exercised non-vacuously by the sequenced-gateway tests (`test_ladder_descent_strict_to_coerce`, `test_ladder_descent_non_strict_recovery`).
- **Registry tier counts match the locked migration** (14 force_strict / 36 force / 5 coerce = 55), verified against the live source.

No BLOCKER-class defects found. The findings below are quality/robustness issues, the most important being a structurally weak `recovery` eval axis (WR-01) that cannot prove what its column claims, and a couple of stale docstrings that misstate the new control flow.

## Warnings

### WR-01: `recovery` eval axis is structurally incapable of failing on a true-recovery test — the column is near-meaningless

**File:** `scripts/eval_cross_provider.py:1449-1455` (scorer); `backend/tests/unit/test_eval_forced_emit.py:97-104` (the test that masks it)

**Issue:** The `recovery` axis is computed as `axes["recovery"] = "PASS" if won else "FAIL"` — i.e. it is exactly `won`. It carries NO information about whether a descent actually fired. A top-rung win and a genuine lower-rung recovery both score `recovery=PASS`; the only thing that scores `FAIL` is "nothing won at all", which is already what `trigger`/`honest_fail` capture. The docstring even concedes "a top-rung win is N/A here — represented as PASS", which means the column never proves recovery occurred.

`test_axis_scoring_recovery_pass_on_lower_rung` advertises that it validates "recovered via coerce", but its assertion `axes["recovery"] == "PASS"` would pass identically if the result were a top-rung win — the test cannot fail for the reason it claims to test (the vacuous-test pattern this project has a documented history of). The scoreboard reader will believe a green `recovery` column proves the ladder's recovery rungs work cross-provider, when it proves nothing beyond "something emitted".

The actual recovery information IS available in the result dict — use `emit_rung` vs the tier's top rung. Score it like `force`'s inverse:

```python
# recovery: PASS only when a real descent won (winning rung is BELOW the top rung),
# or when the top rung won and no descent was NEEDED. FAIL when nothing won.
if not won:
    axes["recovery"] = "FAIL"
elif emit_rung == top_rung:
    axes["recovery"] = "PASS"            # no recovery needed
else:
    # winning rung is strictly below the top rung -> a real descent won
    axes["recovery"] = "PASS"
```

That is still the same PASS/FAIL surface, but to make the column *mean* something, add a distinct `recovered: bool` (or a `"N/A"` verdict for top-rung wins) so a green `recovery` is distinguishable from "never recovered because it never had to". At minimum, change the test to assert the distinguishing signal (e.g. `cell["winning_rung"] != top_rung`) so it actually exercises the descent path, not just `won`.

### WR-02: `forced_emit` docstring misstates the strict-default mechanism (now tier-driven, not `strict_json_schema`-driven)

**File:** `backend/app/services/forced_emit.py:364-370`

**Issue:** The `strict` parameter docstring says: *"`None` (the default) preserves the registry-derived `cap.get("strict_json_schema")` behavior BYTE-IDENTICALLY for every existing caller."* This is stale — the code no longer reads `strict_json_schema` at all. With `strict=None`, `effective_strict = rung_strict` (the per-rung declared strict from `_RUNGS_BY_TIER`), and the tier is resolved from `emit_tier`. The deprecation note at config.py:183-189 explicitly forbids re-reading `strict_json_schema` ("that re-introduces the DeepSeek strict guess"), yet this docstring still points a future maintainer at exactly that removed field as the source of truth. The behavior is functionally equivalent for OpenAI `force_strict` rows, but the documented *mechanism* is wrong and actively misleading given the D-122-04 anti-pattern warning. Update the docstring to describe the tier/rung-derived `effective_strict` resolution.

**Fix:** Rewrite lines 364-370 to: `strict=None` honors the winning rung's declared `rung_strict` (force_strict's first rung is strict; force/coerce rungs are not), preserving OpenAI force_strict byte-identically; an explicit `False` demotes the strict_force rung; `True` is reserved.

### WR-03: `test_axis_scoring_force_pass_for_coerce_tier` does not assert `force=PASS` is non-trivial — a coerce tier can never NOT win on its top rung in this test

**File:** `backend/tests/unit/test_eval_forced_emit.py:106-111`

**Issue:** This test feeds `_won_on_top_rung("coerce")` with tier `"coerce"` and asserts `force=PASS`. For a coerce tier the top rung IS `coerce`, so `emit_rung == top_rung` is trivially satisfied by the fixture itself — the fixture hard-codes `emit_rung="coerce"` and the tier's top rung is `coerce`, so `force` can only be PASS. The test cannot distinguish a correct scorer from one that returns PASS unconditionally for coerce tiers. It does not exercise the `won and emit_rung == top_rung` branch in a way that could catch a regression where, say, the top-rung lookup returned the wrong rung name. Add a negative companion (e.g. a coerce-tier result whose `emit_rung` is something other than `coerce`, or a `force` tier whose winning rung is `coerce`, asserting `force=FAIL`) so the top-rung comparison is genuinely tested — `test_axis_scoring_recovery_pass_on_lower_rung` partially does this for `force_strict`, but the coerce-tier branch has no negative case.

**Fix:** Add `assert ecp.score_forced_emit_axes(_won_on_lower_rung("coerce"), "coerce")["force"] == "PASS"` is wrong (coerce top rung is coerce); instead add a case proving FAIL is reachable, e.g. assert a `force`-tier result winning on `coerce` scores `force == "FAIL"` (already covered) AND that a malformed `emit_rung` for a coerce tier scores `force == "FAIL"`.

### WR-04: Eval `--forced-emit` HARD-schema trip-wire relies on provider-side strict rejection that is never asserted offline — live recovery may be silently never-exercised

**File:** `scripts/eval_cross_provider.py:1308-1385`, `1449-1455`

**Issue:** The entire non-vacuousness of the live `recovery` axis depends on the HARD tool schema (`additionalProperties: True` + optional fields not all in `required`) actually causing OpenAI's strict rung to 400, forcing a descent. If a provider's strict rung silently *accepts* the schema (or the strict rung is never attempted because of a tier/registry drift), the ladder wins on the top rung and `recovery=PASS` (per WR-01) — the operator sees green and concludes recovery works, when the descent was never triggered. Because `recovery` is `==won` (WR-01), there is no offline or online signal that the trip-wire actually tripped. Combined with WR-01, a regression that breaks the lower rungs would still show an all-green forced-emit scoreboard as long as the top rung happens to win. The structure-only test (`test_eval_forced_emit.py`) injects a synthetic `_won_on_lower_rung`, so it never validates that the real HARD schema produces a descent against any provider. Recommend recording the actual `winning_rung` distribution in the scoreboard summary and gating on "at least one HARD cell descended below its top rung" so a silently-non-tripping trip-wire is caught.

**Fix:** Fold WR-01's `recovered` signal into the artifact and add a summary assertion/print that flags when no HARD cell ever recovered (i.e. the trip-wire never fired), so an operator can tell "recovery proven" from "recovery never needed".

## Info

### IN-01: `forced_emit.forced_emit` resolves `cap` twice and ignores the `cap or {}` guard for tier read

**File:** `backend/app/services/forced_emit.py:372-376`

**Issue:** `cap = get_model_capability(model) or {}` then `emit_tier = cap.get("emit_tier", "coerce")`. `get_model_capability` never returns a falsy value (it always returns a populated dict — registry hit or inferred defaults), so the `or {}` is dead defensive code. Harmless, but it signals uncertainty about the contract. Leave it or drop it; no behavior change either way.

### IN-02: `_failure(...)` floor reports `forced=False` unconditionally even when the last attempted rung forced a named tool

**File:** `backend/app/services/forced_emit.py:507-513`

**Issue:** When every rung fails, the floor returns `forced=False` (the comment says this "mirrors the pre-122 shape"). For a `force_strict`/`force` tier that genuinely attempted forced shots before failing, `forced=False` slightly under-reports what was tried. This is telemetry-only (the failure dict's `forced` field is informational), and the pre-122 contract is intentionally preserved, so it is not a defect — noted only because a future consumer reading `forced` on a failure result could misread it as "forcing was never attempted".

### IN-03: `test_emit_tier_counts_match_locked_migration` docstring contains a visibly garbled arithmetic aside

**File:** `backend/tests/unit/test_config_registry.py:97-101`

**Issue:** The docstring includes "`14 + 2 + 34 = 50 forced; the 2 deepseek-force + 34 other-force = 36 force, plus 5 coerce`" with a stray "no —" self-correction mid-sentence. The assertions themselves are correct (14/36/5/55, verified against source), but the prose is confusing and reads like an unfinished edit. Tidy the docstring to just state the locked split.

### IN-04: `_drive_forced_emit_cell` swallows `load_app_settings_async`/`override_provider` failures into `user_settings=None` without surfacing it on the cell

**File:** `scripts/eval_cross_provider.py:1542-1546`

**Issue:** If settings loading raises, the cell silently proceeds with `user_settings=None`. `forced_emit` then relies entirely on its own cross-provider key injection block, which requires `hasattr(user_settings, "model_copy")` — `None` fails that guard, so a cross-provider shot would fall through to whatever `settings.llm_*` legacy creds resolve, likely producing a `provider_error` that the operator cannot distinguish from a real provider failure. Consider recording a `note`/`outcome` marker when settings load fails so the scoreboard does not conflate "settings unavailable" with "provider rejected the shot".

### IN-05: `inferLabel` Python-`.capitalize()` emulation lower-cases the rest of a comment label, mangling acronyms

**File:** `frontend/src/lib/workspacePanel.ts:117-119` (pre-existing; surfaced by the new Phase 122 test)

**Issue:** `text.charAt(0).toUpperCase() + text.slice(1).toLowerCase()` turns a comment like `# Generate PDF report` into `Generate pdf report` and `# Build CSV` into `Build csv`. The Phase 122 test (`workspacePanel.test.ts`) pins this exact behavior (`"# build the chart"` → `"Build the chart"`), so it is intentional and now regression-locked, but it degrades acronym-heavy labels the SC#10 UAT watches. Not introduced by this phase (only the test is new), but worth noting since TDP-01 explicitly "verifies the label floor" — the floor lowercases acronyms. Consider preserving original casing beyond the first character if the UAT surfaces mangled labels.

---

_Reviewed: 2026-06-23_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
