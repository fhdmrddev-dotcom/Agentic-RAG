---
status: partial
phase: 134-eval-results-honest-verdict-ratings
source: [134-VERIFICATION.md, 134-VALIDATION.md]
started: "2026-07-02"
updated: "2026-07-02"
---

## Current Test

[PAUSED at Test 1 — user prioritized fixing BUG-260702-01 (evals pollute the chat
sidebar) as its own phase first, so the remaining UAT runs don't add more clutter.
Resume U1–U9 clean after that fix ships.]

## Tests

### 1. U1 — Cross-provider: OpenAI (EVAL-03)
expected: Eval a skill with a gpt-5.x model; cases complete. With/without arms graded; judge (`claude-opus-4-8`) verdict renders; verdict line reads "X/N passed".
result: [pending]

### 2. U2 — Cross-provider: Anthropic (EVAL-03)
expected: Eval with claude-opus/sonnet (provider-under-test == judge provider). Judge still independent-model-resolved; verdict honest; no self-judge shortcut.
result: [pending]

### 3. U3 — Cross-provider: Google (EVAL-03)
expected: Eval with gemini-3.x. Single-typed verdict fields survive (no Gemini `type:[...]` trap); verdict renders.
result: [pending]

### 4. U4 — Cross-provider: OpenRouter (EVAL-03)
expected: Eval with an OpenRouter representative. Verdict honest; OpenRouter treated as experimental (native-safe).
result: [pending]

### 5. U5 — Multi-tool (EVAL-03)
expected: A case whose prompt exercises 2+ tools (`search_documents` + `execute_code`) with-skill. The multi-tool answer is graded; verdict reflects the actual deliverable.
result: [pending]

### 6. U6 — Parallel-thread (EVAL-03)
expected: Eval run streaming on skill A while chat thread B streams. No cross-talk; `eval_*`/verdict events only on the eval run buffer; both readouts correct.
result: [pending]

### 7. U7 — Long-history (EVAL-03)
expected: A case with a ≥5 KB prompt (or long accumulated eval-thread context). Grading completes; no truncation of the verdict (forced-emit truncation-safe).
result: [pending]

### 8. U8 — Errored-arm honesty (EVAL-03 SC#1 / D-04 / D-11) — MOST LOAD-BEARING
expected: A without-skill baseline on claude-sonnet-5 hits the known BUG-260701-01 (assistant-prefill 400); that arm renders "not measured" (never a fabricated score); the with-skill arm, if it completes, still grades; rollup counts only measured cases.
result: [pending]

### 9. U9 — Ratings persistence (EVAL-04)
expected: Thumbs up/down an answer, reload the run, re-rate (toggle/clear). Rating persists across reload; re-rating updates; a thumbs-DOWN on a judge-PASSED answer is captured (human↔judge disagreement signal for SI-01).
result: [pending]

## Summary

total: 9
passed: 0
issues: 0
pending: 9
skipped: 0
blocked: 0

## Gaps

<!-- Cross-cutting observations surfaced during UAT (not a single-U-test failure) -->
- observation: "Eval runs create real, visible chat threads that pollute the sidebar (34 = 10% of threads; 17 empty / 17 populated). Eval should run silently, DB-only."
  status: logged
  routed_to: "BUG-260702-01 (major) → SEED-100 / small dedicated phase (touches threads.py G-5 hot file + a migration)"
  severity: major
  during_test: 1
- observation: "Judge model (claude-opus-4-8 default) is settings-backed (harness_judge_model) but has NO Settings UI; single-provider/local-model orgs need it configurable."
  status: logged
  routed_to: "enhancement → SEED-100 / admin-panel plan (project_admin_panel_plan)"
  severity: minor
  during_test: 1
