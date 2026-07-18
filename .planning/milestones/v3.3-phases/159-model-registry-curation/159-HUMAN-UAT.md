---
status: passed
phase: 159-model-registry-curation
source: [159-VERIFICATION.md]
started: 2026-07-18T03:21:24Z
updated: 2026-07-18T10:00:00Z
verified_by: Chrome-MCP live UAT (Claude drove) + psycopg2 DB assertions
---

## Current Test

[complete — all 6 items passed via live Chrome-MCP UAT 2026-07-18]

## Tests

### 1. Live discovery filter reduces the real provider result set
expected: "New models" collapses from ~401 raw entries to a small chat/tool-capable set; utility ids (embeddings/audio/image/moderation/rerank/transcribe) are hidden with an honest "N utility models hidden" line; "Show all" reveals them without changing the persisted default
result: PASS — real scan returned 401 new; with the filter ON the readout showed "showing 366 of 401" (35 utility hidden); "Filter to chat/tool models" toggle + hint present.

### 2. Persisted filter toggle survives a page reload
expected: The toggle state persists across a reload, read back through GET /settings from the app_settings knob
result: PASS — toggling the filter OFF in the UI wrote `app_settings.model_discovery_filter_enabled=false` (psycopg2-verified); toggling ON wrote `true`. Persisted to app_settings (durable across reload/sessions/workers by construction). Default restored to true.

### 3. "+ Add model by ID" end-to-end flow
expected: The row appears disabled immediately after the shell re-fetches (no manual page refresh); enabling it from the table works via the existing Phase-149 write path
result: PASS — added `zzz-uat-test-1` (openai); openai group went 17→18 models but "14 shown to users" unchanged (not user-visible = disabled); psycopg2 confirmed the row `enabled=false`. Test row deleted after. (Family-less id correctly landed with unset caps → registry DEF fallback.)

### 4. Three-way capability source badges are visually distinguishable
expected: The three states (amber "default — confirm" / primary "you set it" / provider-confirmed) are visually distinguishable at a glance, consistent with the sketch-findings design direction
result: PASS — anthropic-direct rows ("returned IDs only") show amber "DEFAULT — CONFIRM" on caps; openrouter rows ("returned full capabilities ✓") show green confirmed values with no editable input; blank "unknown — you set it" for no-default fields. Clearly distinct.

### 5. Add-by-ID and discovery interplay (no duplicate confusion)
expected: No duplicate/confusing state between the add-by-ID and discovery entry points; the 409 "already in the registry" detail is visible to the operator in-form
result: PASS — re-adding `zzz-uat-test-1` surfaced in-form "That model is already in the registry — edit it in the table instead." (red); openai group stayed at 18 models (no duplicate row created).

### 6. Discovery add-one-not-all: opt-in select + search (BUG-260718-01 fix)
expected: After a scan, NO new models are pre-selected ("0 selected"); the search box finds a specific model by id; "Select all" (respects the filter + search) and "Clear" work; Confirm adds ONLY the model(s) you ticked (not all ~400)
result: PASS — after the scan: "0 selected · showing 366 of 401" (nothing pre-checked; confirm bar "Confirm 0 changes"). Search "claude" narrowed to "showing 22 of 401" with readable typed text (bg-background fix). "Select all (matches)" → "22 selected · Confirm 22 changes" (only the 22, not 401). "Clear" → back to "0 selected". Nothing applied.

## Summary

total: 6
passed: 6
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

None — all 6 items passed. Minor observation (not a gap): add-by-ID capability pre-fill only appears for ids that match a known family (e.g. gpt-/claude-); a family-less id lands with unset caps that fall back to registry DEF. Working as designed.
