---
status: partial
phase: 149-model-registry-discovery
source: [149-VERIFICATION.md, 149-VALIDATION.md]
started: 2026-07-12
updated: 2026-07-12
---

## Current Test

[awaiting human testing]

> Full step-by-step instructions for every row live in **`149-VALIDATION.md` → Manual-Only Verifications**.
> This file is the tracking surface (surfaces in `/gsd:progress` + `/gsd:audit-uat`); run it via `/gsd:verify-work 149`.
> **Prerequisite:** log in at `http://localhost:5173/` as an operator, open **Control Room → Model Registry** (now unlocked), keys for all 4 providers configured in Settings.

## Tests

### 1. Cross-provider · OpenAI — gpt-5.6 `native_tools` flip (no-restart proof, SC#1)
expected: toggling `native_tools` OFF in the tab makes the next tool-carrying chat route through the prompt-injected path (still works) within ~30s TTL, no backend restart; toggle back ON → native tools again.
result: [pending]

### 2. Cross-provider · Anthropic — capability edit affects next request
expected: a smaller `max_output_tokens` caps the very next answer; Reset clears to built-in DEF and the cap lifts.
result: [pending]

### 3. Cross-provider · Google — capability edit affects next request
expected: edited `gemini-*` capability honored on the next chat; picker shows the model per its `enabled` state.
result: [pending]

### 4. Cross-provider · OpenRouter — capability edit affects next request
expected: edited `llm_call_timeout_seconds` honored; disabling the model removes it from BOTH pickers on next fetch.
result: [pending]

### 5. Enable/disable coupling is REAL across the picker (two-layer pattern)
expected: disabling a model per provider flips its chip to `✕ hidden` and removes it from chat + Settings pickers; re-enable returns it; no disabled model is ever selectable.
result: [pending]

### 6. Multi-tool — 2+ tools in one prompt after a capability edit
expected: `search_documents` + `execute_code` both fire in one turn; edited capability honored; no tool dropped.
result: [pending]

### 7. Parallel-thread — Thread A streaming while Thread B hits a just-disabled model (D-149-10)
expected: Thread A completes uninterrupted; Thread B falls back to the org default with the honest inline `model_disabled_fallback` notice naming both models; no silent swap.
result: [pending]

### 8. Long-message — ≥50 prior messages / ≥5 KB prompt on an edited model
expected: long turn streams to completion honoring the edited capability; no truncation surprise beyond the configured limit; elapsed status never vanishes.
result: [pending]

### 9. Discovery propose-only (SC#3) — capabilities ✓ vs IDs-only amber "you set it"
expected: Google + OpenRouter = "capabilities ✓"; OpenAI/Anthropic/others = "IDs only"; every un-returned field is an amber "unknown — you set it" input; errored provider shows verbatim error (excluded-not-failed); no-key = "no key — skipped"; a NEW model's Enable-now is disabled until every capability is filled — never auto-enabled.
result: [pending]

### 10. Deprecated marker stays selectable (deprecated ≠ disabled, D-149-04)
expected: toggling `deprecated` ON shows the badge in BOTH Settings AND the chat composer picker (chat-badge wiring landed post-verification, commit `a31121ee`) yet the model stays selectable (`✓ in picker`); toggle OFF clears the badge.
result: [pending]

### 11. Lock-a-disabled-model refusal (no dead default, D-149-09 lock path)
expected: 🔓 lock is gated on a disabled row (courtesy tooltip); locking a model then disabling it is refused with an in-row 409 ("unlock it first" / "pick a new default first"); locking a disabled model via the seam is refused 409 ("enable it first").
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps

_None recorded yet — awaiting live UAT run. All 7 code-review findings (CR-01 discovery-diff blocker, WR-01..04, IN-01 chat-badge, IN-02 reason clobber) were fixed before this UAT (see `149-REVIEW.md` frontmatter `resolution`)._
