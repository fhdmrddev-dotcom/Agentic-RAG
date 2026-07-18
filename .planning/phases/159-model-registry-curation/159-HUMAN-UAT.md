---
status: partial
phase: 159-model-registry-curation
source: [159-VERIFICATION.md]
started: 2026-07-18T03:21:24Z
updated: 2026-07-18T03:21:24Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Live discovery filter reduces the real provider result set
expected: "New models" collapses from ~401 raw entries to a small chat/tool-capable set; utility ids (embeddings/audio/image/moderation/rerank/transcribe) are hidden with an honest "N utility models hidden" line; "Show all" reveals them without changing the persisted default
result: [pending]

### 2. Persisted filter toggle survives a page reload
expected: The toggle state persists across a reload (turn it OFF → reload → still OFF), read back through GET /settings from the app_settings knob
result: [pending]

### 3. "+ Add model by ID" end-to-end flow
expected: The row appears disabled immediately after the shell re-fetches (no manual page refresh); enabling it from the table works via the existing Phase-149 write path
result: [pending]

### 4. Three-way capability source badges are visually distinguishable
expected: The three states (amber "default — confirm" / primary "you set it" / provider-confirmed) are visually distinguishable at a glance, consistent with the sketch-findings design direction
result: [pending]

### 5. Add-by-ID and discovery interplay (no duplicate confusion)
expected: No duplicate/confusing state between the add-by-ID and discovery entry points; the 409 "already in the registry" detail is visible to the operator in-form
result: [pending]

## Summary

total: 5
passed: 0
issues: 0
pending: 5
skipped: 0
blocked: 0

## Gaps
