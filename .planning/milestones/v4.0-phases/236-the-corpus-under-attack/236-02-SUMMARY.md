---
phase: 236-the-corpus-under-attack
plan: 02
subsystem: security-mutation-gate
tags: [security, ga-gate, mutation-testing, monkeypatch, sc2, hot-file-ledger]
status: complete
requires:
  - Phase 236 Plan 01 (adversarial corpus & test suite)
  - Operator Ruling on BUS-163 (pytest runtime monkeypatch fixture)
provides:
  - backend/app/services/embedding_service.py (hoisted METADATA_EXTRACTION_ANTI_INJECTION)
  - backend/app/services/skill_proposer_service.py (hoisted SKILL_PROPOSER_EVIDENCE_DELIMITER)
  - backend/tests/unit/security/conftest.py (pytest --disable-defense=<name> fixture)
  - scripts/run-defense-mutations.sh (SC#2 GA Gate mutation runner)
  - docs/HOT-FILE-LEDGER.md (G-5 rows & narrative sections for embedding_service & skill_proposer_service)
  - CLAUDE.md (G-5-FIRING row for embedding_service)
  - .planning/phases/236-the-corpus-under-attack/236-MUTATION-REPORT.md (8-row audit outcome)
affects:
  - backend/app/services/embedding_service.py
  - backend/app/services/skill_proposer_service.py
  - backend/tests/unit/security/conftest.py
  - scripts/run-defense-mutations.sh
  - docs/HOT-FILE-LEDGER.md
  - CLAUDE.md
metrics:
  tasks_complete: 2 of 2
  mutations_tested: 8
  mutations_caught: 8 of 8 (100%)
  completed: 2026-09-06
---

# Phase 236 Plan 02: GA Gate Defense Mutation Testing — Summary

The GA Gate mutation test harness (SC#2) has been implemented and verified per Operator Ruling on BUS-163. Disabling any of the 8 defense mechanisms turns the adversarial test suite RED and explicitly names the failure.

## Artifacts Delivered

1. **Hoisted Production Constants**:
   - `backend/app/services/embedding_service.py`: Hoisted `METADATA_EXTRACTION_ANTI_INJECTION` to a module-level constant without changing behavior or adding runtime flags.
   - `backend/app/services/skill_proposer_service.py`: Hoisted `SKILL_PROPOSER_EVIDENCE_DELIMITER` to a module-level constant.

2. **Hot-File Ledger & CLAUDE.md Sync**:
   - Updated `docs/HOT-FILE-LEDGER.md` with re-derived triples:
     - `embedding_service.py`: `9 / 5 / 354` (⚠ **FIRES** at 5 phases)
     - `skill_proposer_service.py`: `2 / 2 / 407` (no, 2 phases)
   - Updated `CLAUDE.md` G-5-FIRING table (now 111 of 216).
   - Validated: `check-hot-file-ledger.cjs` and `check-claude-md-size.cjs` (69,050 chars headroom) both pass.

3. **`backend/tests/unit/security/conftest.py`**:
   - Pytest CLI option `--disable-defense=<name>` supporting all 8 named defense modules.
   - Strict target existence assertion (`assert hasattr(mod, symbol)`) to prevent silent no-ops if symbols are renamed.
   - Runtime monkeypatching affecting both target module and test suite namespaces.

4. **`scripts/run-defense-mutations.sh`**:
   - Automated runner executing baseline check followed by all 8 individual defense mutations.
   - Verified: 8/8 mutations fail loudly and name the corresponding defense test.
   - Generates `.planning/phases/236-the-corpus-under-attack/236-MUTATION-REPORT.md`.

## Verification
- Baseline: 11/11 tests pass with all defenses active.
- Mutation Audit: 8/8 mutations caught loudly (100% detection rate).
- Tree remains completely clean before, during, and after runs.
