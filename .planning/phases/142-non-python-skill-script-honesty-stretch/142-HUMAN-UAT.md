---
status: partial
phase: 142-non-python-skill-script-honesty-stretch
source: [142-VERIFICATION.md]
started: 2026-07-08T03:45:00Z
updated: 2026-07-08T03:45:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-provider honest narration on a real runtime-gap failure
expected: For each of OpenAI, Anthropic, Google (Gemini), and OpenRouter — load a skill that drives a known-missing binary (soffice/markitdown) or a bundled `.js` step, and confirm: (a) the sandbox is touched at most once per gap token this run, (b) the model tells the user honestly that the step can't run here instead of narrating fake success or silently misrunning it as Python, (c) the model does not keep retrying after the pre-flight short-circuit fires.
result: [pending]

### 2. D-03 / BUG-260707-02 stock-skill loop-cap proof
expected: Re-import the UNMODIFIED stock Anthropic pptx skill (referencing soffice/markitdown, not the per-user hand-patched instructions), run a task that drives its office-conversion step, and confirm the agent does not repeat the 8-round retry loop — it stops at ≤1 real dead sandbox call per token and either uses the in-memory alternative or tells the user, generically (not because of the one-off user-level instruction rewrite).
result: [pending]

### 3. Multi-tool row: load_skill flag + execute_code reshape in one live turn
expected: One prompt that loads a skill bundling a non-Python script (surfacing the `load_skill` runtime_note) AND drives that skill's dead sandbox step (surfacing the `execute_code` runtime_gap reshape) in the same turn; confirm both signals reach the model and both are narrated honestly.
result: [pending]

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps
