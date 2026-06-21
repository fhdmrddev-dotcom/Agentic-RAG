---
status: partial
phase: 116-document-relationships-backend-agent-tool
source: [116-VERIFICATION.md]
started: 2026-06-20T13:39:58Z
updated: 2026-06-20T13:39:58Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-provider Deep-mode get_related_documents (4 providers)
expected: Invoke the agent in Deep mode across at least 4 providers (OpenAI, Anthropic, Google, one OpenRouter model) with a seeded pair of linked documents; ask it to find relationships of the subject document. Model calls `get_related_documents`, receives compact rows with direction and label, seeable endpoints cited as source_refs, unseeable endpoints masked as "linked document (no access)".
result: [pending]

### 2. relationship.create audit row lands live (:54322)
expected: With two linked documents, after calling `POST /document-relationships`, exactly one `audit_log` row appears with `action_type='relationship.create'` and `relationship_id` / `source_doc_id` / `target_doc_id` / `rel_type` in metadata. (Structurally confirmed in code + `test_116_audit_live.py`; this is the live operator-eyeball confirm of DMF-01.)
result: [pending]

### 3. Idempotency index live on local DB
expected: `SELECT indexname FROM pg_indexes WHERE indexname = 'document_relationships_idempotency_idx'` returns exactly one row. (Migration 075 operator-apply step from Plan 04.)
result: pass — orchestrator confirmed live on :54322 via psycopg2 during execute-phase 116-05 (index `document_relationships_idempotency_idx` present on `document_relationships`). Operator may re-confirm if desired.

### 4. SC#10 4-axis live UAT
expected: Invoke `get_related_documents` across all 4 required bandwidth axes — (1) cross-provider: OpenAI, Anthropic, Google, OpenRouter; (2) multi-tool: one prompt combining `get_related_documents` + `search_documents` or `execute_code`; (3) parallel-thread: Thread A streaming while Thread B accepts a `get_related_documents` prompt; (4) long-message: ≥ 50 prior messages OR ≥ 5 KB user prompt. Tool invoked and result rendered correctly in all 4 axes; no cross-provider regressions.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
