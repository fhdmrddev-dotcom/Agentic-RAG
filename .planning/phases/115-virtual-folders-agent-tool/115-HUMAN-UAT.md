---
status: partial
phase: 115-virtual-folders-agent-tool
source: [115-VERIFICATION.md, 115-VALIDATION.md]
started: 2026-06-20
updated: 2026-06-20
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-provider tool emission (SC#1 + SC#3 — the native-7 scoreboard)
For EACH of OpenAI, Anthropic, Google/Gemini, DeepSeek, Moonshot/Kimi, Z.ai-GLM, MiniMax (+ OpenRouter backstop), in a Deep-mode chat with a seeded folder of typed docs:
1. ask "what saved views and filterable fields do I have?" → expect a CATALOG result
2. ask "open my Invoices view" → expect a saved-view resolve with the TRUE total + a truncation note when capped
3. ask "how many contracts expire within 90 days?" → expect an inline-filter resolve
expected: Model emits a `query_documents_by_view` tool call each time and fills the polymorphic `view`-XOR-`filter` arg correctly (catalog / saved-view / inline-filter respectively). **Gemini MUST NOT return a 400** (the anyOf/oneOf-free schema proof — a 400 here = schema regression). **MiniMax** = the `minimax-m3-invalid-tool-args-400` watch point — PASS or document as a known provider limitation (NOT this phase's fix, per D-115-13).
result: [pending]

### 2. Multi-tool prompt (SC#3 — two retrieval lanes coexist)
Send in one chat turn: "list all my contracts, then find the indemnity clause in them."
expected: Model calls `query_documents_by_view` for the exhaustive "list all" step AND `search_documents` for the semantic passage step. Must NOT use `search_documents` for the list step (the tool-description routing contrast should route correctly — D-115-5).
result: [pending]

### 3. Parallel-thread isolation (SC#3 — no cross-thread bleed)
Start a view-tool answer in Thread A (e.g. "open my Invoices view"); while it streams, send a new prompt in Thread B.
expected: No cross-thread bleed in the tool result rows or `source_refs`; each thread's answer is scoped to its own run.
result: [pending]

### 4. Long-message robustness (SC#3 — long-context tool emission)
In a thread with ≥ 50 prior messages (or paste a ≥ 5 KB prompt) ending in "...now open my Invoices view".
expected: Tool still fires and the polymorphic arg still fills correctly (no truncation-induced mis-fill under long context). TRUE total and truncation note appear as designed.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
