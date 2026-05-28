---
status: partial
phase: 084-workspace-filesystem-backend
source: [084-VERIFICATION.md]
started: 2026-05-28
updated: 2026-05-28
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-provider agent UAT (OpenAI)
expected: Agent writes /test.md, lists, reads, writes v2, diffs v1->v2, and deletes -- all 6 tool calls succeed without 4xx/5xx
result: [pending]

### 2. Cross-provider agent UAT (Anthropic)
expected: Same 6-call sequence succeeds on Claude Sonnet/Opus
result: [pending]

### 3. Cross-provider agent UAT (Google)
expected: Same 6-call sequence succeeds on Gemini 2.5/3.x
result: [pending]

### 4. Cross-provider agent UAT (OpenRouter)
expected: Same 6-call sequence succeeds on an OpenRouter model (e.g. kimi 2.6 or free-tier)
result: [pending]

### 5. Multi-tool prompt
expected: A single prompt that invokes workspace_write + execute_code together completes both tools cleanly (e.g. "write a CSV with this data then run python to summarize it")
result: [pending]

### 6. Parallel-thread test
expected: Thread A doing workspace_write does not block Thread B from accepting and streaming a new prompt
result: [pending]

### 7. Long-message workspace_write
expected: With >= 50 prior messages OR >= 5KB user prompt, workspace_write still completes -- no provider rejects the schema or token budget
result: [pending]

### 8. REST API curl: list files
expected: GET /threads/{id}/workspace/files returns 200 with JSON array; 404 for other users' thread
result: [pending]

### 9. REST API curl: file content (inline)
expected: GET /threads/{id}/workspace/files/{file_id}/content for a < 256KB file returns `storage_type: "inline"` and `content` field with text
result: [pending]

### 10. REST API curl: file content (bucket)
expected: GET .../content for a > 256KB file returns `storage_type: "bucket"` and a `signed_url` (60s TTL)
result: [pending]

### 11. REST API curl: versions + diff
expected: GET .../versions returns array sorted newest-first; GET .../diff?from=1&to=2 returns structured delta with stats
result: [pending]

### 12. Hybrid storage threshold
expected: 100-byte file -> content_inline populated, content_storage_path null. 500KB file -> opposite
result: [pending]

### 13. Path validation hostile inputs
expected: Writes to /../etc/passwd, /foo//bar, paths > 500 chars, paths with newlines, '/' all rejected with PathValidationError
result: [pending]

### 14. Soft 100-file limit warning
expected: After 100 files in a thread, 101st workspace_write returns the warning string prefixed to the JSON summary
result: [pending]

## Summary

total: 14
passed: 0
issues: 0
pending: 14
skipped: 0
blocked: 0

## Gaps
