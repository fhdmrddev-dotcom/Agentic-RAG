---
status: partial
owed_decision: "2026-10-04 operator: close with test 1 owed"
phase: 273-agent-authored-artifacts
source: [273-VERIFICATION.md]
started: 2026-10-04T00:00:00Z
updated: 2026-10-04T00:00:00Z
---

## Current Test

Backend restarted 2026-10-04 02:26 (after last fix commit 7d808415a, 02:16). Tests 2-3 driven in Chrome by the orchestrator; test 1 OWED by decision.

## Tests

### 1. Live STRUCTURED-path (OpenRouter-style) holdback — post CR-02 / WR-06
expected: on a STRUCTURED-routed model, (a) a normal show_artifact emit renders a chart with no tool JSON in the streamed or saved answer; (b) a malformed / truncated show_artifact block never appears as raw JSON — one plain sentence replaces it, live == reload; (c) an ordinary non-tool ```json reply streams intact and is released at its closing fence.
result: owed — no fast STRUCTURED-routed model available (nemotron-nano-9b 600 s timeouts, never chose show_artifact); unit-proven only (test_273_structured_holdback.py, test_273_review_fixes.py). Re-open: next phase touching structured_text_holdback.py / agent_loop.py STRUCTURED path, or when a fast STRUCTURED model is configured.
note: no derived board row routes STRUCTURED (OpenRouter strategy=quality, all native_tools=true); nemotron-nano-9b via LM Studio was too slow (600 s timeouts) and never chose show_artifact. Needs either a faster STRUCTURED-capable model or an operator-approved temporary openrouter_tool_strategy change.

### 2. Rendering re-check — post WR-04 / WR-05
expected: a table/metric/tooltip with a small non-zero value (e.g. 0.0045) shows significant digits, not "0"; a stacked bar or area chart with mixed positive and negative values draws negatives below zero without overlap; both identical after reload.
result: pass — thread 'Profit by Month Stacked Bar Chart' (deepseek-v4-flash): table shows 0.0045 / 0.0123 / 0.25 (WR-04); stacked bar draws team_b -40 / team_a -30 / team_b -20 below zero with no overlap, tooltip Mar 80 / -20 / total 60 (WR-05); after page reload both artifacts identical (only diff a whitespace artefact of the capture regex), 0 notices. Screenshot evidence/g4/postfix-WR05-stacked-negatives.jpg.

### 3. Backend validation fixes live spot-check (optional) — CR-01, WR-01..03, WR-07
expected: a scatter chart with a text x column, or x also listed in y, is refused to the model (model retries) instead of "shown" while the UI shows the notice; the caption names the resolved document.
result: pass — thread 'Scatter chart model error rate comparison': first show_artifact(scatter, x=model) REFUSED to the model {status: refused, reason: "model isn't a number column"} (CR-01), model retried with a bar chart; 0 notices on page, no raw JSON.

## Summary

total: 3
passed: 2
issues: 0
pending: 0
owed: 1
skipped: 0
blocked: 0

## Gaps
