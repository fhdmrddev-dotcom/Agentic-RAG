---
status: partial
phase: 135-self-improvement-loop-si-01
source: [135-VERIFICATION.md, 135-VALIDATION.md]
started: 2026-07-02T15:40:00Z
updated: 2026-07-02T15:40:00Z
---

## Current Test

[awaiting human testing]

## Tests

> SC#10 4-axis live UAT (D-15, MANDATORY) — authored in 135-VALIDATION.md, persisted here after
> re-verification (status human_needed, 4/5 code truths verified). Drive via Chrome MCP or
> operator-clicks (Chrome-MCP-hangs fallback). U9 and U10 exercise the CR-01/CR-02/CR-03 fixes
> live — these were code+test verified in the 2026-07-02 re-verification; live confirmation is
> the remaining gate.

### 1. U1 — Cross-provider: OpenAI (full loop #1) [SI-01 SC#1–3]
expected: Source eval run on a gpt-5.x model → "Propose improvement" → review diff → approve → auto re-eval → gate. Proposal is a real unified diff with rationale + cited evidence; re-eval runs on the SAME gpt-5.x model (D-11); verdict gates promotion with honest case-matched counts.
result: [pending]

### 2. U2 — Cross-provider: Anthropic (full loop #2) [SI-01 SC#1–3, SC#4]
expected: Same full loop with a claude source run. Proposer (builder model) and re-eval both route correctly; no shared-path fork; promotion applies instructions to live skill only on pass.
result: [pending]

### 3. U3 — Cross-provider: Google [SI-01 SC#4]
expected: Propose from a gemini-3.x source run. Proposer schema survives (no Gemini `type:[...]` trap — flat single-typed fields); diff renders; re-eval routes to Google.
result: [pending]

### 4. U4 — Cross-provider: OpenRouter [SI-01 SC#4]
expected: Propose from an OpenRouter-representative source run. Loop holds (OpenRouter experimental — native-safe assertion only).
result: [pending]

### 5. U5 — Multi-tool [SI-01 SC#3]
expected: Re-eval a skill whose test case exercises 2+ tools (`search_documents` + `execute_code`). Draft-version instructions actually loaded in the WITH arm (Pitfall #1 seam proven live); multi-tool answer graded; gate compares case-matched.
result: [pending]

### 6. U6 — Parallel-thread [SI-01 SC#3]
expected: Re-eval streaming on skill A while a chat thread B streams. No cross-talk; proposal/re-eval events only on the eval run buffer; chat unaffected; both readouts correct.
result: [pending]

### 7. U7 — Long-message [SI-01 SC#1]
expected: Propose on a skill with a long instruction body (≥5 KB) and a fat evidence bundle (many cases + ratings). Proposer emission completes without truncation (16K-token forced-emit precedent); diff renders the long body legibly.
result: [pending]

### 8. U8 — Honest rejection + not_measured (D-13) [SI-01 SC#2–3]
expected: Reject a proposal (nothing changes); then approve one whose re-eval includes a `not_measured` case. Reject = pure audit (no version, live skill untouched); `not_measured` excluded from gate counts on BOTH sides, honest counts displayed alongside the verdict.
result: [pending]

### 9. U9 — Interrupted re-eval (D-14 mandatory) [SI-01 SC#3]
expected: Restart the backend (or kill the run) mid-re-eval. Proposal surfaces honest "interrupted — not promoted" (NEVER stuck "re-evaling…"); re-run affordance works; live skill untouched. Exercises the CR-02 cross-worker fix live at WORKER_COUNT=2.
result: [pending]

### 10. U10 — Failed-gate + override (D-06) [SI-01 SC#3]
expected: An approved version whose re-eval FAILS the gate; then force-promote. Default = not-promoted with the failing evidence rendered; explicit force-promote works (no 422 — CR-01 fix live), records the override on the proposal.
result: [pending]

### 11. U11 — G-4 lived experience: proposal card [SI-01 SC#1–2]
expected: Watch the full card lifecycle end-to-end: propose (pending) → diff render → approve → live re-eval readout → terminal state; collapse/expand; both themes. Card states honest at every step; diff readable (red removed / green added); rationale + evidence shown; re-eval reuses the live eval readout + heartbeat (no frozen state).
result: [pending]

## Summary

total: 11
passed: 0
issues: 0
pending: 11
skipped: 0
blocked: 0

## Gaps
