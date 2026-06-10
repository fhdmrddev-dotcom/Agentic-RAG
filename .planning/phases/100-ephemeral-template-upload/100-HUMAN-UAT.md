---
status: complete
phase: 100-ephemeral-template-upload
source: [100-VERIFICATION.md]
started: 2026-06-10T12:40:00Z
updated: 2026-06-10T15:05:00Z
mode: claude-driven-live-uat (operator delegated "do it all"; Chrome DevTools MCP drove the real UI at localhost:5173, DB cross-checks via psycopg2 :54322)
---

## Current Test

[all complete]

## Tests

### 1. Upload visible and readable
expected: Upload a real .docx via the workspace panel's Files section → "Template" badge + live expiry countdown appear on the file card; agent `workspace_read` of that file returns the clean binary stub.
result: PASS — uploaded `uat-files/meridian-status-template.docx` via the panel button; row `/726b1cef-meridian-status-template.docx` appeared instantly (no refresh) with TEMPLATE badge + "expires in 23h" countdown (screenshot: `screenshots/uat100-test1-template-badge.png`). DB: `kind='template_input'`, `expires_at` = now+24h, OOXML mime, bytes inline in version row. Agent (deepseek-v4-flash, Deep) `workspace_read` returned the clean binary stub: exact mime + 36,892 bytes + "binary file" note — no gibberish, no error.

### 2. Never-in-search proof
expected: Template containing `ZZ-TMPL-MARKER-100` never appears in KB search.
result: PASS — agent `search_documents` for the marker: "no chunks at all". DB: 0 `documents` rows, 0 `document_chunks` rows contain the marker; the only place the file existed was `workspace_files` (1 row).

### 3. Expiry end-to-end
expected: TTL fires → panel vanishes → agent read fails "template expired" → row + bytes physically gone after sweep.
result: PASS — forced `expires_at` to past: owner LIST returned `[]`, content route 404'd (gated before URL mint); agent re-read returned `{"error": "template expired"}` (honest D-10 error, distinct from not-found — agent itself contrasted it with its earlier successful read); panel row VANISHED on reconcile after reload; the backend's own in-process lifespan sweep (production path) GC'd the row + version rows (inline bytes) before a manual sweep could — manual `sweep_expired` then found 0 remaining. 3 agent files untouched. Zero template objects in Storage.

### 4. Bad-file rejection
expected: Renamed .exe→.docx and a real PDF rejected with clean panel error, nothing persisted.
result: PASS — fake-exe.docx → inline alert "File is not a valid Office document (not a ZIP/OOXML container)"; PDF-renamed-.docx → same container rejection; honest real-report.pdf → "Unsupported type .pdf. Allowed: .docx, .pptx, .xlsx". File list unchanged, nothing in chat, 0 rows/0 versions persisted.

### 5. Run-straddles-expiry
expected: Run-pin extends expires_at at kickoff; multi-phase workflow completes.
result: PASS — set template to T+3min, kicked off published `doc_qa_scoped_098uat` (4-phase, deepseek) via `workflow_definition_id` on the message POST: `expires_at` jumped to T+3h10m at kickoff (GREATEST extend-only; run-cap+600s margin). Workflow run `c1c83466` reached `status: completed`; template survived the entire run.

### 6. Cross-user isolation
expected: Second user gets 404 on all list/content/download attempts.
result: PASS — created user B (`uat100-userb@example.com`); all 4 GET routes (list/content/versions/diff) AND the upload POST against user A's thread returned 404 "Thread not found".

### 7. No-template regression
expected: Agent files (NULL kind/expires_at) and templateless threads byte-identical to pre-Phase-100.
result: PASS — old thread (`/sorting_benchmark_analysis.md`) rendered with no badge/countdown; 3 pre-existing agent files untouched through every test incl. the sweep; pre-existing workspace API unit tests 10/10 green.

## Summary

total: 7
passed: 7
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

One defect FOUND AND FIXED during this UAT (not an open gap):
- **Upload affordance unreachable on fresh threads** — WorkspacePanel's `hasActivity` short-circuit rendered PanelEmpty INSTEAD of the Files section, so the D-01 upload button was structurally unreachable exactly where a template-fill flow starts (the operator's "I do not have any changes in the UI yet" report). Fixed live: extracted `TemplateUpload.tsx` out of FilesSection and rendered it inside the calm empty state when a thread is open (panel-shell D3 honored — one centered state, no headers). Commit `fix(100): make template-upload affordance reachable on no-activity threads`; +2 WorkspacePanel reachability tests; verified live (fresh thread shows the button; home view without a thread does not).

Notes:
- Test fixtures kept: `uat-files/` (valid + 3 bad files), user B auth account, the UAT thread. The uploaded template itself was swept (by design).
- Observed (per locked D-02, not a defect): the countdown caption refreshes on natural panel re-renders, so it can read stale between renders (e.g. showed "expires in 23h" after the run-pin extended it to ~3h until the next re-render).
