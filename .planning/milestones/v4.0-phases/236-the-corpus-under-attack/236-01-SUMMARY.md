---
phase: 236-the-corpus-under-attack
plan: 01
subsystem: security-corpus
tags: [security, owasp-llm01, prompt-injection, adversarial-testing, sc1, sc3]
status: complete
requires:
  - TRUST-02 / TRUST-03 trifecta fence (tool_dispatcher.py)
  - Untrusted tool envelope (chat_tools.py)
  - Service tools regex validation (service_tools.py)
  - Embedding metadata instruction boundary (embedding_service.py)
  - Eval runner judge rubric & length clamp (eval_runner_service.py)
  - Harness grounding valid_ids filter (phase_types.py)
  - Harness citations validation (validator_kinds.py)
  - Skill proposer evidence isolation (skill_proposer_service.py)
provides:
  - backend/tests/unit/security/adversarial_corpus.py (13 typed AdversarialPayload instances)
  - backend/tests/unit/security/test_adversarial_corpus.py (11 unit tests evaluating defenses)
  - .planning/phases/236-the-corpus-under-attack/236-ATTACK-REPORT.md (human-legible attack audit)
affects:
  - backend/tests/unit/security/
key-files:
  created:
    - backend/tests/unit/security/__init__.py
    - backend/tests/unit/security/adversarial_corpus.py
    - backend/tests/unit/security/test_adversarial_corpus.py
    - .planning/phases/236-the-corpus-under-attack/236-ATTACK-REPORT.md
metrics:
  tasks_complete: 2 of 2
  payloads_tested: 13
  refusal_rate: 13/13 (100%)
  completed: 2026-09-06
---

# Phase 236 Plan 01: The Corpus Under Attack — Summary

The adversarial corpus for indirect prompt injection and corpus manipulation attacks has been implemented and verified. All 13 attack payloads mapped across 7 OWASP LLM01 threat categories fail safely against the 8 defense modules.

## Artifacts Delivered

1. **`backend/tests/unit/security/adversarial_corpus.py`**:
   - 13 typed `AdversarialPayload` dataclass instances covering indirect injection, delimiter confusion, parameter manipulation, metadata boundary breaking, judge subversion, resource exhaustion, citation spoofing, hallucination, skill poison, markdown exfiltration, and unmapped polyglots.
   - Structured refusal and trial recorder (`_record_result`) with markdown rendering function `render_attack_report()`.

2. **`backend/tests/unit/security/test_adversarial_corpus.py`**:
   - 11 unit tests covering all 8 defense modules:
     - `tool_dispatcher.py`: TRUST-03 trifecta fence refusing email hijack (`LLM01-INDIRECT-01`) and mutating drive operations (`LLM01-INDIRECT-02`).
     - `chat_tools.py`: Content isolation XML envelope (`LLM01-DELIM-01`) and markdown image exfiltration containment (`LLM01-EXFIL-01`).
     - `service_tools.py`: `_ISSUE_KEY` regex validation refusing path traversal (`LLM01-PARAM-01`) and SQL commands (`LLM01-PARAM-02`).
     - `embedding_service.py`: Metadata extraction data-not-instruction boundary clause (`LLM01-META-01`).
     - `eval_runner_service.py`: Judge rubric data-not-command clause (`LLM01-JUDGE-01`) and evidence block clamp at 4000 chars (`LLM01-JUDGE-02`).
     - `phase_types.py`: Server-side grounding derivation excluding injected tags from `valid_ids` (`LLM01-GROUND-01`).
     - `validator_kinds.py`: Rejection of unretrieved / invented citations (`LLM01-VALID-01`).
     - `skill_proposer_service.py`: Eval evidence containment in explicit DATA isolation block (`LLM01-SKILL-01`).
     - Unmapped discovery test for base64 polyglot payload (`LLM01-UNMAPPED-01`).
   - Pytest session teardown generating the attack report on every run.

3. **`.planning/phases/236-the-corpus-under-attack/236-ATTACK-REPORT.md`**:
   - Human-legible attack matrix satisfying SC#3, documenting payload IDs, categories, target modules, expected defenses, trial status, refusal status, and verdicts.

## Verification
- `test_adversarial_corpus.py`: 11/11 passed in 0.65s.
- Attack report successfully generated and verified with 13/13 refusal rate.
