---
status: partial
phase: 100-ephemeral-template-upload
source: [100-VERIFICATION.md]
started: 2026-06-10T12:40:00Z
updated: 2026-06-10T12:40:00Z
---

## Current Test

[awaiting human testing]

## Tests

All 7 rows are the operator-defined G-4 lived-experience scenarios from 100-CONTEXT.md. They require the live dev app at http://localhost:5173/ (user starts backend uvicorn in a visible terminal first).

### 1. Upload visible and readable
expected: Upload a real .docx via the workspace panel's Files section → "Template" badge + live expiry countdown appear on the file card; agent `workspace_read` of that file returns the clean binary stub (not raw bytes).
result: [pending]

### 2. Never-in-search proof
expected: Upload a template containing the marker text `ZZ-TMPL-MARKER-100` → KB search (any provider) for that marker NEVER returns it — not in `search_documents` results, not in citations.
result: [pending]

### 3. Expiry end-to-end
expected: After TTL fires (shrink `app_settings.template_ttl_hours` or set `expires_at` directly for the test): panel card vanishes (no manual refresh), agent read fails with "template expired", and after the sweep runs the DB row AND Storage bytes are physically gone.
result: [pending]

### 4. Bad-file rejection
expected: A renamed .exe→.docx and a real PDF are both rejected at upload with a clean inline panel error (nothing in chat); nothing persisted to workspace_files or Storage.
result: [pending]

### 5. Run-straddles-expiry
expected: Kick off a multi-phase workflow with a template close to expiry → run-pin extends `expires_at` at kickoff (extend-only, GREATEST) → workflow completes without "template expired" mid-run.
result: [pending]

### 6. Cross-user isolation
expected: A second user's session gets 404 on all list/content/download attempts against the first user's thread templates (RLS + ownership checks).
result: [pending]

### 7. No-template regression
expected: Agent-written workspace files (NULL kind/expires_at) and templateless workflows render and behave byte-identically to pre-Phase-100 (no badge, no countdown, no behavior change).
result: [pending]

## Summary

total: 7
passed: 0
issues: 0
pending: 7
skipped: 0
blocked: 0

## Gaps
