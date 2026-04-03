---
status: partial
phase: 14-code-execution-sandbox
source: [14-VERIFICATION.md]
started: 2026-04-03T00:00:00Z
updated: 2026-04-03T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. End-to-end SSE streaming of code output
expected: When the LLM calls execute_code, the frontend receives code_execution_start, code_stdout/code_stderr chunks in real time, and code_execution_complete events over the SSE stream

result: [pending]

### 2. Output file download links in completion event
expected: When code writes a file to /sandbox/output/, the code_execution_complete event includes output_files with signed Supabase Storage URLs that can be downloaded

result: [pending]

### 3. Thread-delete container cleanup
expected: Deleting a thread via the API closes and removes the Docker sandbox container for that thread (no orphaned containers)

result: [pending]

### 4. Lifespan shutdown container cleanup
expected: Stopping the FastAPI server calls sandbox_manager.close_all(), cleanly closing all open Docker containers

result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
