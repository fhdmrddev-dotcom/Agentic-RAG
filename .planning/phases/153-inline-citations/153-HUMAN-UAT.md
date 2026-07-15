---
status: partial
phase: 153-inline-citations
source: [153-VERIFICATION.md, 153-VALIDATION.md]
started: 2026-07-15
updated: 2026-07-15
---

## Current Test

[Claude-driven live SC#10 4-axis UAT in progress — Chrome MCP + psycopg2]

## Tests

### 1. Cross-provider markers + graceful degradation
expected: One representative model each for OpenAI, Anthropic, Google, OpenRouter — a retrieval-grounded answer shows inline superscript `[n]` markers on native providers; a model that emits no valid markers degrades to footer-only (never worse than today's sources list, D-06/D-07). OpenRouter axis may be blocked by external BUG-260714-02 (operator-accept precedent).
result: [pending]

### 2. Multi-tool (chunk + full-doc)
expected: One prompt exercising `search_documents` + `fetch_document_file`/full-doc in one answer — both chunk and full-doc citations produce markers/rows; the full-doc peek shows "Full document" + Open (no snippet/score, D-10).
result: [pending]

### 3. Parallel-thread isolation
expected: Thread A streaming (calm, unmarked body) while Thread B accepts a new prompt — markers attach on A's settle without bleeding into B.
result: [pending]

### 4. Long-message settle reconcile
expected: ≥50 prior messages OR ≥5KB prompt — the settle reconcile still swaps live→normalized content; no marker flash/drift.
result: [pending]

### 5. General-knowledge non-regression
expected: A no-retrieval turn renders nothing extra (no footer, no markers, no ⓘ banner) — byte-identical to today (D-14).
result: [pending]

### 6. Set-membership integrity (DB corroboration)
expected: Via psycopg2 :54322 — the persisted assistant message `content` contains no `[n]` whose index exceeds the run's `source_refs`/`citations` count (D-01/D-02).
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
