---
status: partial
phase: 051-context-window-management
source: [051-VERIFICATION.md]
started: 2026-04-24T04:42:19Z
updated: 2026-04-24T04:42:19Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Model info inline card visual rendering
expected: All 11 known models (gpt-4o, gpt-4o-mini, gpt-4.1, gpt-4.1-mini, gpt-4.1-nano, claude-sonnet-4-6, claude-opus-4-6, claude-haiku-4-5-20251001, gemini-2.5-pro, gemini-2.5-flash, gemini-2.5-flash-lite) show two subtitle rows in the model selector dropdown — first row: "Xk ctx · Y out · bestFor", second row: "Cost tier: Low ($) / Mid ($$) / High ($$$)". Unknown/unlisted models show no subtitle rows.
result: [pending]

### 2. Context & Sub-Agent settings save round-trip
expected: In Settings → AI Model tab, Context & Sub-Agent SectionCard — the two sliders (context window limit, sub-agent output tokens) and the sub-agent model dropdown save their values when "Save AI Model" is clicked, and the saved values reload correctly on page refresh. Dropdown shows "Auto (cheapest)" as default, and active provider models as remaining options.
result: [pending]

### 3. Sub-agent generation task end-to-end
expected: When a chat message triggers a sub-agent generation task, the system escalates to the orchestrator model with a 32768 token ceiling. Confirmed via a live LLM call (requires running backend with valid API key).
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
