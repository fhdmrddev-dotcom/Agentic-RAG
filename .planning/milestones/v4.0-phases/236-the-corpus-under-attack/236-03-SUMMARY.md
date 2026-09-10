---
phase: 236-the-corpus-under-attack
plan: 03
subsystem: dynamic-native-roster-and-live-uat
tags: [security, native-roster, sc10, dynamic-derivation, live-uat, trust-02, trust-03]
status: complete
requires:
  - Phase 236 Plan 01 (adversarial corpus & test suite)
  - Phase 236 Plan 02 (GA gate mutation runner & conftest fixture)
provides:
  - backend/tests/unit/security/test_native_roster_injection.py (SC#10 dynamic roster test suite)
  - scripts/uat-adversarial-sync.py (Live UAT adversarial sync & TRUST-03 driver)
  - .planning/phases/236-the-corpus-under-attack/236-ROSTER-REPORT.md (Dynamic 8-row native roster report)
  - .planning/phases/236-the-corpus-under-attack/236-VALIDATION.md (Full validation matrix & operator playbook)
affects:
  - backend/tests/unit/security/test_native_roster_injection.py
  - scripts/uat-adversarial-sync.py
  - .planning/phases/236-the-corpus-under-attack/236-ROSTER-REPORT.md
  - .planning/phases/236-the-corpus-under-attack/236-VALIDATION.md
metrics:
  tasks_complete: 2 of 2
  derived_providers_tested: 8
  native_roster_report_rows: 8 of 8 (100%)
  live_uat_steps: 6 of 6 passed
  completed: 2026-09-06
---

# Phase 236 Plan 03: Dynamic Provider Native Roster & Live UAT — Summary

Phase 236 Plan 03 (Wave 3) is complete and fully verified. It delivers the dynamic native provider roster testing suite (SC#10), the lived-experience adversarial sync UAT verification script (TRUST-03), and the comprehensive phase validation matrix and operator verification playbook.

## Artifacts Delivered

1. **`backend/tests/unit/security/test_native_roster_injection.py`**:
   - Dynamically derives all active providers from `app.config.MODEL_CAPABILITIES` (`_get_derived_providers`) without hardcoding provider names or fixed counts (M-3).
   - Evaluates prompt formatting, delimiter integrity, and tool call isolation under each provider's native capability flags (`native_tools`, `emit_tier`, `supports_assistant_prefill`).
   - Verifies that unconfigured providers cleanly return structured skip strings (`[SKIP - missing credentials: {provider}]`) and are never omitted.
   - Automatically renders `.planning/phases/236-the-corpus-under-attack/236-ROSTER-REPORT.md` on teardown.

2. **`.planning/phases/236-the-corpus-under-attack/236-ROSTER-REPORT.md`**:
   - Contains an explicit row for every derived provider: `anthropic` (7 models), `deepseek` (2 models), `google` (7 models), `minimax` (8 models), `moonshot` (3 models), `openai` (17 models), `openrouter` (9 models), and `zhipu` (8 models).
   - Records sample models, native tool capabilities, emit tiers, prefill support, credential statuses, and defense refusal verdicts.

3. **`scripts/uat-adversarial-sync.py`**:
   - Automated live UAT driver that plants `confidential_invoice_inject.txt` containing exfiltration instructions into a watched sync source.
   - Verifies document indexing with connection provenance (`source_connection_id`).
   - Simulates chat query attempting to summarize the document, retrieving untrusted content into context.
   - Drives dispatch of outbound mutating action (`google__send_email`).
   - Asserts that the TRUST-03 trifecta fence intercepts the call (`_is_write` with connection content in context), disarms execution, forces `posture = 'ask'`, and emits `tool_approval_required`.

4. **`.planning/phases/236-the-corpus-under-attack/236-VALIDATION.md`**:
   - Comprehensive validation matrix mapping SC#1, SC#2, SC#3, SC#10, TRUST-02, SEED-188, and live UAT.
   - Detailed specifications of all 8 monitored defense modules and their mutation catch tests.
   - Step-by-step verification playbook for the operator.

## Verification Results
- **Dynamic Native Roster Suite**: 4/4 tests PASS in 0.40s (`test_native_roster_injection.py`).
- **Security Unit Package**: 15/15 tests PASS in 0.34s (`tests/unit/security`).
- **GA Gate Mutation Driver**: 8/8 defense mutations caught loudly (`bash scripts/run-defense-mutations.sh`).
- **Live UAT Adversarial Sync**: 6/6 steps passed, exit code 0 (`scripts/uat-adversarial-sync.py`).
- **Hot-File Ledger Gate**: `node scripts/check-hot-file-ledger.cjs 236` PASS (216 rows, 2 watched).
- **CLAUDE.md Size Gate**: `node scripts/check-claude-md-size.cjs` PASS (80,950 chars, 69k headroom).
