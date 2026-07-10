# Phase 137.1 — Deferred / Out-of-Scope Items

Out-of-scope discoveries logged during plan execution (per the executor SCOPE
BOUNDARY rule). These are NOT fixed by the plan that found them — they belong to a
sibling plan or a follow-up.

| # | Found during | Item | Owner / disposition |
|---|---|---|---|
| 1 | Plan 05 (2026-07-04) | `backend/tests/test_eval_runner.py::test_judge_provider_independent` fails: `JudgeVerdict(...)` is constructed WITHOUT the required `case_feedback` field (added to the schema by EVAL-05d at `validator_kinds.py:120`). Pre-existing at Plan 05's base commit (`git show HEAD~4:.../validator_kinds.py` already carries `case_feedback`); Plan 05 never touches `validator_kinds.py` or `test_eval_runner.py`. | **EVAL-05d plan / case_feedback work.** The test's inline `JudgeVerdict(...)` needs `case_feedback="..."` added (one-line fix). Out of scope for Plan 05 (judge-model knob + kebab lint + Tuner cap). |
