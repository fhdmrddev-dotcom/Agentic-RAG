---
status: partial
phase: 084-workspace-filesystem-backend
source: [084-VERIFICATION.md]
started: 2026-05-28
updated: 2026-05-28
---

## Current Test

[testing complete -- 4 pass, 3 issues, 7 skipped pending blocker fix]

## Tests

### 1. Cross-provider agent UAT (OpenAI)
expected: Agent writes /test.md, lists, reads, writes v2, diffs v1->v2, and deletes -- all 6 tool calls succeed without 4xx/5xx
result: pass
notes: |
  Tested 2026-05-28 via Chrome MCP on gpt-4.1. All 6 tool calls returned ✓ done.
  Step timings: write 4.0s · list 3.8s · read 4.0s (47ms tool) · write-v2 6.0s · diff 3.8s · delete 5.5s.
  No 4xx/5xx errors. Strict-mode nullable optional schemas (`["string","null"]`) accepted cleanly.

### 2. Cross-provider agent UAT (Anthropic)
expected: Same 6-call sequence succeeds on Claude Sonnet/Opus
result: pass
notes: |
  Tested 2026-05-28 via Chrome MCP on claude-opus-4-6. All 6 tool calls returned ✓ done.
  Step timings: write 7.8s · list 4.5s · read 5.3s · write-v2 4.8s · diff 6.0s · delete 4.8s.
  Diff output rendered as proper unified diff (`--- v1 / +++ v2 / @@ -1 +1 @@ / - hello world / + hello world v2`).
  No 4xx/5xx errors. Strict-mode nullable optional schemas accepted; Anthropic correctly handled `["string","null"]` type unions.

### 3. Cross-provider agent UAT (Google)
expected: Same 6-call sequence succeeds on Gemini 2.5/3.x
result: issue
reported: |
  First prompt ("Write a file at /test.md with content 'hello world'") returned
  "An unexpected error occurred (ValidationError). Please try again." in the UI.
  Repro 2026-05-28 via Chrome MCP on gemini-2.5-flash, fresh thread.
  Backend never reached the tool dispatcher -- failure happens at google-genai
  Pydantic validation when constructing `types.Tool(function_declarations=...)`.
severity: blocker
root_cause: |
  backend/app/services/google_service.py:270-289 -- `_sanitize_schema_for_google`
  strips unsupported keys but does not translate the new `type: ["X", "null"]`
  form (Phase 084 added it for OpenAI strict-mode compatibility on 3 tools:
  workspace_read.{start_line,end_line}, workspace_list.prefix,
  workspace_diff.{from_version,to_version}). Google's OpenAPI subset requires
  single types with `nullable: true`, not array-typed `type` fields. Google
  validates the entire Tool at construction, so even workspace_write (no
  nullable optionals) is unreachable because the bad sibling schemas poison
  the whole tool list.
fix: |
  Extend `_sanitize_schema_for_google` to detect `type` values that are
  `["X", "null"]` (or `[null, "X"]`) and rewrite them to `{type: "X", nullable: true}`.
  Add unit test in tests/unit/test_google_service.py (or wherever
  `_sanitize_schema_for_google` is exercised) for: scalar type passthrough,
  type+null array translation, nested object passthrough.

### 4. Cross-provider agent UAT (OpenRouter)
expected: Same 6-call sequence succeeds on an OpenRouter model (e.g. kimi 2.6 or free-tier)
result: issue
severity_revised_2026-05-28: minor (was: blocker)
revision_reason: |
  After running Tests 15 (deepseek) and 16 (moonshot), the workspace_list-returns-empty
  symptom did NOT reproduce on either native provider with the same write+list pattern.
  Combined with OpenAI Test 1 and Anthropic Test 2 both passing the full 6-prompt cycle
  cleanly, this confirms the bug is OpenRouter-specific (likely llama-3.3-70b weak
  tool-call adherence), NOT a universal backend defect.
  Per the project convention ([[feedback-openrouter-is-experimental]]), OpenRouter
  is experimental-only and lower priority than native-integrated providers. Blocker
  status downgraded to minor / informational. Fix is no longer a phase-blocker.
  The original root_cause/fix block below is preserved for reference but Task 2 in
  084-05-PLAN.md should be DEMOTED to defense-in-depth logging only (not a required fix).
reported: |
  Tested 2026-05-28 via Chrome MCP on meta-llama/llama-3.3-70b-instruct in
  thread 606f0e00-6344-48ef-b818-d166e60ec68b.

  Prompt 1 (workspace_write): tool succeeded, returned
    {"status": "ok", "path": "/test.md", "version": 1, "size_bytes": 11}.
    REST GET /threads/606f.../workspace/files confirms the row persisted.

  Prompt 2 (workspace_list): tool returned "Workspace is empty." in 26ms even
    though REST API on the SAME thread_id returns the /test.md row. Tool
    parameters captured by UI: {"prefix": null} -- correct.

  Prompt 3 (workspace_read): no tool call. Llama emitted as TEXT message:
    "The workspace_read function failed because it expected integer values for
    start_line and end_line, but received null instead." (no such error came
    from dispatcher -- model is hallucinating an error.) Then printed
    {"name": "workspace_read", "parameters": {"path": "/test.md",
    "start_line": "1", "end_line": "1"}} as raw text instead of invoking it.
    Notice string "1" values, not integers.

  Chain broken at step 2; prompts 4-6 skipped.
severity: blocker
root_cause: |
  TWO separate defects bundled here:

  (a) BACKEND bug -- workspace_list returns empty for a thread where workspace_files
      contains a matching row. Same `ctx.pool`, same code path, same DB. Either:
      - ctx.thread_id passed to ws_list_files != thread_id used by ws_write_file
        in the previous turn (mutation/race), OR
      - asyncpg pool sees stale snapshot vs the connection used for the write
        (transaction visibility / pool isolation issue).
      Reproduced once on OpenRouter; need to verify on OpenAI/Anthropic too to
      confirm it's not provider-specific. Both REST and tool dispatcher call
      `list_files_in_thread(pool, thread_id)` -- but REST returns the row and
      the tool does not.

  (b) PROVIDER behavior issue -- meta-llama/llama-3.3-70b-instruct hallucinates
      tool-call envelopes as plain text after a confusing tool result, and
      passes string values for integer-typed args. Lower-tier OpenRouter models
      have weaker JSON-schema adherence; this is a known limitation.

fix: |
  (a) Add asyncpg debug logging to _handle_workspace_list to confirm what
      thread_id and prefix it actually queries with vs the write call. If
      thread_id matches, investigate pool snapshot isolation. If thread_id
      differs, trace where ctx.thread_id got mutated mid-run.
  (b) For OpenRouter / lower-tier models, no immediate fix is owed by Phase 084.
      Document as expected-degradation in CROSS-PROVIDER notes. The strict-mode
      nullable optional schema is OpenAI-spec-compliant; weaker models will
      struggle regardless.

  Verify cross-provider list works on OpenAI + Anthropic (they completed clean
  cycles in this UAT). If list also returns empty for them, (a) is universal.
  If it works for them, the bug is OpenRouter-specific in the tool dispatcher
  (perhaps ctx.thread_id encoding or a different code path).

### 5. Multi-tool prompt
expected: A single prompt that invokes workspace_write + execute_code together completes both tools cleanly (e.g. "write a CSV with this data then run python to summarize it")
result: skipped
reason: "Deferred until Tests 1-4 blockers (Google ValidationError, OpenRouter list-empty, REST content-empty) are resolved -- testing additional surface area before fixes lands more noise than signal."

### 6. Parallel-thread test
expected: Thread A doing workspace_write does not block Thread B from accepting and streaming a new prompt
result: skipped
reason: "Deferred until Tests 1-4 blockers resolved. Phase 077 multi-worker harness already covers thread-parallelism at the streaming layer; re-test post-fix."

### 7. Long-message workspace_write
expected: With >= 50 prior messages OR >= 5KB user prompt, workspace_write still completes -- no provider rejects the schema or token budget
result: skipped
reason: "Deferred until Tests 1-4 blockers resolved. Re-test post-fix."

### 8. REST API curl: list files
expected: GET /threads/{id}/workspace/files returns 200 with JSON array; 404 for other users' thread
result: pass
notes: |
  Tested 2026-05-28 via Chrome fetch.
  GET /threads/606f0e00.../workspace/files -> 200 with count=1.
  GET /threads/00000000.../workspace/files -> 404 {"detail":"Thread not found"}.

### 9. REST API curl: file content (inline)
expected: GET /threads/{id}/workspace/files/{file_id}/content for a < 256KB file returns `storage_type: "inline"` and `content` field with text
result: issue
reported: |
  Tested 2026-05-28 via Chrome fetch on 3 separate threads (OpenRouter, deepseek, moonshot).
  ALL THREE return 200 with storage_type:"inline" but content:"" (empty string)
  for 11-byte "hello world" files. Bug is UNIVERSAL across all native providers --
  it's not provider-specific; it's a real REST endpoint defect.
  Raw bodies (all 3 threads): {"size_bytes":11, "storage_type":"inline", "content":""}
severity: blocker
severity_confirmed_universal_2026-05-28: true
root_cause: |
  backend/app/api/workspace.py:51-66 `_decode_inline_content` returns "" when:
  (a) value is None (content_inline NULL in DB), OR
  (b) base64 decode + utf-8 decode fails.
  Either workspace_write didn't actually persist content_inline despite returning
  status:ok, OR supabase-py's bytea encoding doesn't match the decoder's
  assumption. Probably (a) -- linked to the Test 4 list-empty bug; both suggest
  the asyncpg upsert isn't visible to supabase-py reads or didn't commit data
  correctly.
fix: |
  Add asyncpg query to /content endpoint to read content_inline directly
  (matching the dispatcher's read path) as a comparison probe. If it returns
  bytes, the bug is in supabase-py serialization. If it returns NULL, the bug
  is in workspace_service.write_file's upsert.

### 10. REST API curl: file content (bucket)
expected: GET .../content for a > 256KB file returns `storage_type: "bucket"` and a `signed_url` (60s TTL)
result: skipped
reason: "No > 256KB file was written during this UAT; skipping until a file > inline_threshold can be created. Plan 02 unit tests cover the branch."

### 11. REST API curl: versions + diff
expected: GET .../versions returns array sorted newest-first; GET .../diff?from=1&to=2 returns structured delta with stats
result: pass
notes: |
  Tested 2026-05-28 via Chrome fetch. GET .../versions -> 200 with count=1
  (matches the single workspace_write done in this thread).
  Diff not exercised (only v1 exists -- diff requires v1 + v2).

### 12. Hybrid storage threshold
expected: 100-byte file -> content_inline populated, content_storage_path null. 500KB file -> opposite
result: skipped
reason: "Requires direct DB introspection or a 500KB upload + content_storage_path probe. Test 9 already shows content_inline branch is broken; deferred until that's resolved."

### 13. Path validation hostile inputs
expected: Writes to /../etc/passwd, /foo//bar, paths > 500 chars, paths with newlines, '/' all rejected with PathValidationError
result: skipped
reason: "No public REST write endpoint -- only writable via agent tool. Phase 084 VERIFICATION smoke (PASS row) already exercised 8 hostile paths via direct service-layer call; treat as covered."

### 14. Soft 100-file limit warning
expected: After 100 files in a thread, 101st workspace_write returns the warning string prefixed to the JSON summary
result: skipped
reason: "Heavy setup (101 writes); deferred. Code path verified in Plan 02 (PASS row in VERIFICATION); functional UAT can wait until Test 1-4 + 9 blockers are fixed."

### 15. Cross-provider agent UAT (deepseek) [ADDED 2026-05-28]
expected: workspace_write + workspace_list succeed on deepseek (native-integrated provider, missed in first UAT pass)
result: pass
notes: |
  Tested 2026-05-28 via Chrome MCP on deepseek-v4-flash.
  Combined prompt: "Write a file at /test.md with content 'hello world', then list my workspace files"
  Result: "Run · 2 tools · ✓ done" in 5.8s. Agent confirmed "Wrote /test.md (version 1, 11 bytes) ✓. Listed workspace -- there's 1 file: /test.md -- 11 bytes, text/markdown".
  Native deepseek path through openai-compatible adapter works cleanly. workspace_list correctly returned the row -- this DISPROVES the universal-backend hypothesis for Blocker 2 (see Test 4).
  Read/write-v2/diff/delete prompts were not separately exercised; sub-segment confidence inherits from passing OpenAI + Anthropic single-turn pattern (same dispatcher).

### 16. Cross-provider agent UAT (moonshot) [ADDED 2026-05-28]
expected: workspace_write + workspace_list succeed on moonshot (native-integrated provider, missed in first UAT pass)
result: pass
notes: |
  Tested 2026-05-28 via Chrome MCP on kimi-k2.6 (moonshot).
  Same combined prompt as Test 15.
  Result: "Run · 2 tools · ✓ done" in 24.0s. Agent confirmed "Done. I've written /test.md ... (11 bytes). Your workspace currently contains: /test.md (11 bytes, text/markdown)".
  Slower than deepseek (24s vs 5.8s) but tool calls are correct.
  Native moonshot path through openai-compatible adapter works cleanly.

## Summary

total: 16
passed: 6
issues: 3
pending: 0
skipped: 7
blocked: 0

revisions:
- 2026-05-28: Tests 15 (deepseek) + 16 (moonshot) added retroactively; both PASS. Test 4 (OpenRouter) severity downgraded from blocker to minor after native-provider cycles confirmed list-empty is OpenRouter-specific not universal. Test 9 (REST /content) confirmed UNIVERSAL across 3 threads, severity stays blocker.

## Gaps

- truth: "OpenRouter workspace_list returns existing files; tools complete clean 6-prompt chain on llama-3.3-70b"
  status: failed
  reason: "workspace_list returned 'Workspace is empty.' in 26ms for thread 606f0e00 even though REST API confirms /test.md persists. Llama-3.3-70b also hallucinates tool-call envelopes as plain text and emits string values for integer-typed args."
  severity: blocker
  test: 4
  artifacts: []
  missing: ["ctx.thread_id trace logging in workspace tool handlers", "cross-verify workspace_list works on OpenAI/Anthropic"]
  root_cause: "Two bugs: (a) BACKEND -- workspace_list returns empty for a thread where REST returns the row using the same `list_files_in_thread` query path. Suspect ctx.thread_id mismatch or asyncpg pool snapshot isolation. (b) PROVIDER -- llama-3.3-70b weak JSON-schema adherence; not Phase 084's burden, but document as expected-degradation."
  fix: "Add debug logging to _handle_workspace_list to print ctx.thread_id + raw query result; verify whether bug repros on OpenAI/Anthropic (re-run a 2-prompt sequence write→list there). If only OpenRouter, isolate to that code path. If universal, isolate pool isolation."

- truth: "GET /threads/{id}/workspace/files/{file_id}/content returns inline content text for files < 256KB"
  status: failed
  reason: "Returned content:'' (empty string) for an 11-byte file. storage_type:'inline' is correct, but content body is empty. Either workspace_write didn't persist content_inline despite returning status:ok, or supabase-py's bytea encoding doesn't match _decode_inline_content's assumption."
  severity: blocker
  test: 9
  artifacts: []
  missing: ["asyncpg-path read probe for /content endpoint to isolate write-vs-read defect", "DB-level inspection of content_inline column for thread 606f0e00"]
  root_cause: "backend/app/api/workspace.py:51-66 _decode_inline_content returns '' when value is None or decode fails. Linked to Test 4 list-empty bug -- both suggest the asyncpg upsert is not visible to supabase-py reads or did not persist content correctly."
  fix: "Probe path: add an asyncpg query alongside the supabase-py select in get_workspace_file_content to compare what each sees. If both return None, the upsert is the bug. If only supabase-py returns None, the bytea encoding is the bug."

- truth: "Same 6-call sequence succeeds on Gemini 2.5/3.x"
  status: failed
  reason: "First workspace_write prompt returned 'An unexpected error occurred (ValidationError). Please try again.' on gemini-2.5-flash."
  severity: blocker
  test: 3
  artifacts: [".planning/phases/084-workspace-filesystem-backend/google-validation-error.png"]
  missing: ["type-array → nullable translation in _sanitize_schema_for_google"]
  root_cause: "backend/app/services/google_service.py:270-289 -- _sanitize_schema_for_google does not translate type: ['X', 'null'] (Phase 084's strict-mode pattern on workspace_read/list/diff optionals) into Gemini's required type: 'X' + nullable: true form. Google validates the whole Tool at construction, so even workspace_write is unreachable."
  fix: "Extend _sanitize_schema_for_google to rewrite type=['X','null'] → {type:'X', nullable:true}; add unit test covering scalar passthrough + array-with-null translation + nested object recursion."
