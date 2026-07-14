---
status: partial
phase: 151-agent-file-tools
source: [151-VERIFICATION.md, 151-VALIDATION.md]
started: 2026-07-14
updated: 2026-07-14
---

## Current Test

[awaiting human testing — live SC#10 4-axis cross-provider UAT + live cross-user refusal]

## Tests

### 1. Cross-provider tool-call execution
expected: Fire `fetch_document_file` AND `attach_skill_file` on one representative model each from OpenAI, Anthropic, Google, and OpenRouter — both tools construct and execute successfully on all 4 providers; no schema-translation error, no silently dropped tool call.
result: [pending]

### 2. Multi-tool chain in one turn
expected: Single prompt `fetch_document_file` → `execute_code` (open the real `.docx` with python-docx) → `attach_skill_file(source="sandbox_output")` — the agent fetches real original bytes, operates on them for real in the sandbox, and attaches the genuinely generated artifact (not a text reconstruction).
result: [pending]

### 3. Parallel-thread isolation
expected: Start a `fetch_document_file` in Thread A while Thread B accepts a new prompt — no cross-thread file/session bleed; sandbox sessions stay cached per `thread_id`.
result: [pending]

### 4. Long-message / weak-model argument fidelity
expected: `attach_skill_file(source="inline")` with a large payload after ≥50 prior messages, on a weak model (MiniMax/DeepSeek/GLM) — inline content arrives intact or is honestly refused at the 5 MB cap; no silent argument mangling/truncation.
result: [pending]

### 5. Cross-user live refusal (SC#4)
expected: With a second real account's document/skill id, `fetch_document_file` and `attach_skill_file` both refuse live (honest "not found or access denied" / "no skill named … that you own") against a genuine second Supabase user row, end-to-end through the live service-role client — not just in mocked unit tests.
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
