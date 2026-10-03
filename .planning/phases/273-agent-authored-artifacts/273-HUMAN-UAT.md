---
status: partial
phase: 273-agent-authored-artifacts
source: [273-VERIFICATION.md]
started: 2026-10-04T00:00:00Z
updated: 2026-10-04T00:00:00Z
---

## Current Test

[awaiting human testing — backend must be RESTARTED first: the review fix pass (CR-01, CR-02, WR-01..07) landed after the 00:17 restart, and uvicorn runs without --reload]

## Tests

### 1. Live STRUCTURED-path (OpenRouter-style) holdback — post CR-02 / WR-06
expected: on a STRUCTURED-routed model, (a) a normal show_artifact emit renders a chart with no tool JSON in the streamed or saved answer; (b) a malformed / truncated show_artifact block never appears as raw JSON — one plain sentence replaces it, live == reload; (c) an ordinary non-tool ```json reply streams intact and is released at its closing fence.
result: [pending]
note: no derived board row routes STRUCTURED (OpenRouter strategy=quality, all native_tools=true); nemotron-nano-9b via LM Studio was too slow (600 s timeouts) and never chose show_artifact. Needs either a faster STRUCTURED-capable model or an operator-approved temporary openrouter_tool_strategy change.

### 2. Rendering re-check — post WR-04 / WR-05
expected: a table/metric/tooltip with a small non-zero value (e.g. 0.0045) shows significant digits, not "0"; a stacked bar or area chart with mixed positive and negative values draws negatives below zero without overlap; both identical after reload.
result: [pending]

### 3. Backend validation fixes live spot-check (optional) — CR-01, WR-01..03, WR-07
expected: a scatter chart with a text x column, or x also listed in y, is refused to the model (model retries) instead of "shown" while the UI shows the notice; the caption names the resolved document.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
