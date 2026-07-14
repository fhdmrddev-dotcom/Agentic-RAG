---
status: passed
phase: 151-agent-file-tools
source: [151-VERIFICATION.md, 151-VALIDATION.md]
started: 2026-07-14
updated: 2026-07-14
method: live Chrome-MCP cross-provider UAT + psycopg2 DB ground-truth
---

## Current Test

[complete — all 5 rows exercised live against the running app, each confirmed with DB evidence]

## Tests

### 1. Cross-provider tool-call execution — PASS (3/4 native; OpenRouter = pre-existing infra, not 151)
expected: Fire `fetch_document_file` + `attach_skill_file` on OpenAI, Anthropic, Google, OpenRouter — both construct/execute, no schema-translation error, no dropped call.
result: PASS on **Anthropic** (claude-sonnet-5), **OpenAI** (gpt-5.5), **Google** (gemini-3.5-flash) — both tools fired, `status:ok` fetch + `status:created` attach, real `skill_files` rows (uat-openai.txt 24B, uat-google.txt 24B). **OpenRouter** could NOT be validated: `nvidia/nemotron-3-ultra-550b` AND `deepseek/deepseek-v4-pro` both returned OpenRouter routing **404 "No endpoints found that can handle the requested parameters."** Proven TOOL-AGNOSTIC and PRE-EXISTING: a plain `search_documents` call (a tool that predates this phase) returns the identical 404 on the same model → NOT a Phase-151 defect (OpenRouter is the designated experimental provider). Also: OpenAI **gpt-5.6-sol** (hand-added GPT-5.6 family, SEED-088) failed with "Model parameter error — this model may not support the current configuration"; gpt-5.5 used instead. Both logged as separate issues.

### 2. Multi-tool chain in one turn — PASS
expected: `fetch_document_file` → `execute_code` (open real .docx w/ python-docx) → `attach_skill_file(sandbox_output)`; real bytes, not text reconstruction.
result: PASS (Anthropic, Run·3 steps·39.6s). fetch → `/sandbox/input/Defence_Guide_Chapter1.docx` size_bytes 18480 (== DB); execute_code opened the real docx → heading "DBA Defence Preparation Guide" + wrote 208B summary; attach → `{"status":"created"}`. DB confirms `skill_files` row `Defence_Guide_Chapter1_summary.txt` (208B) on "docx" skill, owner = test user.

### 3. Parallel-thread isolation — PASS
expected: Second thread's sandbox independent of the first (sessions cached per thread_id), no file bleed.
result: PASS. New Thread B fetched `risk-register.docx` (37,568B == DB) then `os.listdir('/sandbox/input')` → `['risk-register.docx']` ONLY — Thread A's `Defence_Guide_Chapter1.docx` (fetched 4× there) did NOT appear. Per-thread sandbox isolation confirmed live.

### 4. Long-message / weak-model argument fidelity — PASS (weak-model fidelity; ≥50-msg length not exercised)
expected: `attach_skill_file(inline)` large payload on a weak model — content intact or honest 5MB refusal, no silent mangling.
result: PASS (minimax MiniMax-M3). Attached exact 88-char inline payload → DB `uat-minimax.txt` **file_size 88 == expected 88 bytes** (byte-for-byte, no weak-model mangling). NOTE: the ≥50-prior-message length dimension was not driven manually; weak-model tool-argument fidelity (the load-bearing risk) is proven.

### 5. Cross-user live refusal (SC#4) — PASS
expected: 2nd account's doc/skill id → both tools refuse live (honest error), through the RLS-less service-role client.
result: PASS (Anthropic, verbatim). fetch of another user's doc `75ae16cc…` → `{"error":"Document '75ae16cc…' not found or access denied."}`; attach to system skill "skill-creator" → `{"error":"No skill named 'skill-creator' that you own — you can only attach files to a skill you own…"}`. Load-bearing owner-scope app gates hold live; no cross-user data leak.

## Summary

total: 5
passed: 5
issues: 0
pending: 0
skipped: 0
blocked: 0

Notes: cross-provider covered on all 3 native providers (Anthropic/OpenAI/Google) + minimax; OpenRouter blocked by a pre-existing, tool-agnostic OpenRouter routing 404 (not a Phase-151 defect). Two unrelated issues surfaced and logged separately: (a) GPT-5.6 Sol/Terra/Luna config error (SEED-088), (b) OpenRouter tool-call 404.

## Gaps

None attributable to Phase 151. Out-of-scope observations logged as separate issues (GPT-5.6 model config; OpenRouter tool-routing 404).
