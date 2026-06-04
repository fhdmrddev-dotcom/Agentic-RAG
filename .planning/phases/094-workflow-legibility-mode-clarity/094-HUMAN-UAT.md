---
status: partial
phase: 094-workflow-legibility-mode-clarity
source: [094-VERIFICATION.md]
started: 2026-06-05T00:25:00Z
updated: 2026-06-05T00:25:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. SC#10 axis-1 — Cross-provider parity
Run a Harness workflow on OpenAI, Anthropic, Google, OpenRouter (one model each).
expected: The phase timeline, mode badge, and a failed-run reason render IDENTICALLY across all four providers — no provider-specific rendering. Honest signals are provider-agnostic by construction.
result: [pending]

### 2. SC#10 axis-2 — Multi-tool
Run a workflow whose `llm_agent`/`llm_batch_agents` phase uses `search_documents` + `execute_code`.
expected: Per-subtopic summaries render in BatchResultList (mounted under the timeline); NO per-phase tool/search count chips appear (D-03 suppress-don't-fake).
result: [pending]

### 3. SC#5 / SC#10 axis-3 — Parallel-thread isolation (LIVE)
Thread A streams a Harness run while Thread B accepts a new prompt.
expected: Thread A's timeline is not corrupted; Thread B's composer is unlocked (no global isStreaming lockout). The Phase i/N counter and phasesByThread stay owner-scoped (WR-02 fix — no high-water bleed across threads).
result: [pending]

### 4. SC#10 axis-4 — Long-message
Run a workflow in a thread with ≥50 prior messages OR a ≥5KB kickoff prompt.
expected: The timeline + draft preview render correctly without layout/perf degradation.
result: [pending]

### 5. SC#4 — Both-themes REAL contrast (Chrome MCP / Lighthouse)
Render the timeline in dark + light.
expected: Status/title text ≥4.5:1; `--accent-violet` graphic ≥3:1 (dark 4.35:1 / light 8.52:1); the "Attempt N" retrying pill text ≥4.5:1 (dark 9.83:1 via `--accent-violet-text`, light 8.52:1). vitest-axe already GREEN — this verifies real rendered contrast.
result: [pending]

### 6. SC#1 / PANEL-08 — Auto-open on entering Harness Mode
Launch a workflow.
expected: The workspace panel auto-opens to the phase timeline (reconciled via `GET /threads/{id}/workflow` on mount). The timeline shows current/locked/completed glyphs, gate pass/fail (retrying "Attempt N" purple), and the transition log.
result: [pending]

### 7. SC#5 — UI-state matrix
Timeline across collapse states, both themes, multiple threads, mobile.
expected: The timeline renders correctly collapsed/expanded, in dark + light, across thread switches (no Phase i/N high-water-mark bleed — WR-02 fix), and at mobile widths.
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
