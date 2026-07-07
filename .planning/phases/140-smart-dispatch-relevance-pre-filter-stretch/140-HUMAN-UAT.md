---
status: partial
phase: 140-smart-dispatch-relevance-pre-filter-stretch
source: [140-VERIFICATION.md, 140-VALIDATION.md]
started: 2026-07-07T19:10:00Z
updated: 2026-07-07T19:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. U1–U4 — cross-provider (OpenAI, Anthropic, Google, OpenRouter)
expected: With an over-budget catalog (lower `skill_catalog_max_tokens`, or enable enough skills to exceed it) and a prompt that clearly matches one planted should-fire skill — one representative model per provider — the planted skill is in the injected menu (or reachable via `load_skill`), `load_skill` fires correctly, and the honest `_CATALOG_TRIM_MARKER` is present when skills were cut. Behavior is provider-agnostic (the pre-filter shapes the prompt before dispatch).
result: [pending]

### 2. U5 — multi-tool
expected: One over-budget-catalog prompt that triggers the planted should-fire skill AND a second tool (e.g. `load_skill` + `search_documents`) in the same turn — both tools fire correctly in one turn; the skill still reaches the model despite the trim.
result: [pending]

### 3. U6 — parallel-thread
expected: Thread A streaming with an over-budget catalog while Thread B accepts a new prompt concurrently — Thread A's pinned/recent set does not bleed into Thread B; each thread's catalog reflects only its own turn/history.
result: [pending]

### 4. U7 — long-message
expected: ≥50 prior messages OR a ≥5 KB user prompt, with an over-budget catalog — trimming + pinned-keep still correct; no regression interacting with `trim_messages_to_fit` (context_window budget).
result: [pending]

### 5. Self-heal spot-check (Blocker-1, optional)
expected: Plant a brand-new should-fire skill with no vector yet, trigger an over-budget turn — turn 1 it is fail-open-injected (marker present, not silently dropped); turn 2, after the background `kick_skill_backfill` completes, it ranks by genuine similarity (vector now populated). No crash on either turn.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
