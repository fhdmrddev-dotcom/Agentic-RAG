---
status: partial
phase: 098-project-binding-server-side-kb-scope-governance
source: [098-VERIFICATION.md, 098-VALIDATION.md]
started: 2026-06-09
updated: 2026-06-09
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-provider in-run scope containment (SC#10 — cross-provider axis)
expected: A workflow bound to a project folder retrieves ONLY from that folder's subtree on every native provider — exercise OpenAI, Anthropic, Google, and OpenRouter (one representative model each). The model cannot widen scope via a prompt hint. Verify retrieved citations all fall inside the bound subtree on all four.
result: [pending]

### 2. Multi-tool scope holds (SC#10 — multi-tool axis)
expected: A single agent turn that calls `search_documents` + `execute_code` keeps the search results clipped to the bound project subtree (the execute_code tool does not provide a side channel to read out-of-scope docs).
result: [pending]

### 3. Parallel-thread scope isolation (SC#10 — parallel-thread axis)
expected: Thread A runs a bound workflow (scoped) while Thread B runs an unbound Deep chat (whole-KB). A's retrieval stays inside its project subtree and B's whole-KB Deep retrieval is unchanged — no scope bleed between threads while both stream concurrently.
result: [pending]

### 4. Long-message scope persistence (SC#10 — long-message axis)
expected: With ≥50 prior messages OR a ≥5 KB user prompt, the bound scope still resolves server-side at run start and retrieval stays clipped — scope is not lost on large contexts. Includes the restart paths: resume after a crash and Continue both stay scoped (the GOV-01 gap that previously fell back to whole-KB).
result: [pending]

### 5. scope_violation observability (SC#4)
expected: When a retrieved row would fall outside the bound scope, it is clipped AND a `scope_violation` event is observable in the run log/timeline. Confirm the event surfaces (run buffer / UI) and the Deep/unscoped path emits NO such event (byte-identical Deep behavior, D-05/D-06).
result: [pending]

### 6. D-13 act/export whitelist refusal UX
expected: A read-only phase refuses an act/export (write) tool with a clear refusal message and the run continues gracefully — the per-phase whitelist is preserved in the live UI.
result: [pending]

## Summary

total: 6
passed: 0
issues: 0
pending: 6
skipped: 0
blocked: 0

## Gaps
