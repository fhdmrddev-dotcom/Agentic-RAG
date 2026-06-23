---
status: partial
phase: 122-cross-provider-trust-honesty-parity
source: [122-VERIFICATION.md]
started: 2026-06-23T09:05:00Z
updated: 2026-06-23T09:05:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live Forced-Emit Scoreboard (MP-03 gate — D-122-06)
test: Run `backend/venv/Scripts/python.exe scripts/eval_cross_provider.py --forced-emit` against local Supabase with live native-7 API keys configured.
expected: Writes `.planning/eval/forced-emit-scoreboard-<date>.{json,md}`. All native-7 providers (OpenAI, Anthropic, Google, DeepSeek, Moonshot, Zhipu, MiniMax) show PASS or DOCUMENTED on all 4 axes (trigger / force / recovery / honest-fail). `EVAL_SUMMARY forced-emit` grep shows gated=true per provider. Attach the artifact to VALIDATION.md.
why_human: Live cross-provider API keys required; localhost-gated by design (D-122-06); secrets + cost + flakiness make this a manual operator gate, not CI.
result: [pending]

### 2. WR-01 Follow-Up — Recovery Axis Proof via winning_rung
test: After running the live `--forced-emit` scoreboard, inspect the `winning_rung` column in the HARD schema cells. For OpenAI force_strict providers, check whether any HARD cell shows `winning_rung=non_strict_force` or `winning_rung=coerce` (confirming the strict-schema trip-wire fired and a real descent happened).
expected: At least one HARD cell for a force_strict (or force-tier) provider shows `winning_rung` below the tier's declared top rung, proving the recovery rungs genuinely fired — not just top-rung wins on every call. This is the live evidence layer for the code-review WR-01 finding (the structure-only test's `recovery` axis is vacuous; the live `winning_rung` field is the real proof).
why_human: The structure-only test cannot verify this (WR-01: `recovery = won`); the `winning_rung` field in the live artifact is the only observable proof that the HARD schema actually triggered a descent.
result: [pending]

### 3. SC#10 Cross-Provider Live UAT (TDP-01 + Deep byte-identical gate)
test: For each native-7 provider, send a prompt that triggers `execute_code` (a forced emission). Observe the workspace panel label. Run all 7 VALIDATION.md UAT rows (UAT-1..7: 4 providers × multi-tool × parallel-thread × long-message).
expected: Panel shows a concrete description label on every provider (e.g. "Generating Q3 revenue chart"), never the bare `execute_code`. Multi-tool row (UAT-5): each tool shows its own label. Parallel-thread row (UAT-6): both threads recover-or-honest independently. Long-message row (UAT-7): recovery still works. Deep Mode turn after is byte-identical. Screenshot evidence required (G-4 lived-experience gate; Chrome MCP is the verification driver).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
