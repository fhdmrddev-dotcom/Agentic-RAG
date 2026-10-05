---
phase: 269-starter-expert-library
plan: 01
subsystem: experts / corpora (repo data)
tags: [experts, corpora, starter-library, tdd, data-only]
requires: [Phase 266 corpus loader (expert_corpus.load_corpus), financial-analyzer corpus]
provides:
  - 4 new starter corpora at backend/app/experts/corpora/{contract-reviewer,hr-policy-advisor,security-compliance,operations-analyst}/
  - backend/tests/unit/test_269_starter_corpora.py (corpus contract over the DERIVED slug set)
affects: [269-02 candidate bundles SQL (slugs + folder_names must match), 269-03 live drive (cited figures + refusal literals)]
tech-stack:
  added: []
  patterns: [derived-set fence with collapse guard + bijection, figure-in-exactly-one-corpus, sibling refusal literal]
key-files:
  created:
    - backend/tests/unit/test_269_starter_corpora.py
    - backend/app/experts/corpora/contract-reviewer/manifest.json
    - backend/app/experts/corpora/contract-reviewer/acme_msa_kestrel_freight_2026.md
    - backend/app/experts/corpora/contract-reviewer/acme_contract_renewal_schedule_2026.md
    - backend/app/experts/corpora/hr-policy-advisor/manifest.json
    - backend/app/experts/corpora/hr-policy-advisor/acme_employee_handbook_2026.md
    - backend/app/experts/corpora/hr-policy-advisor/acme_learning_and_expense_policy_2026.md
    - backend/app/experts/corpora/security-compliance/manifest.json
    - backend/app/experts/corpora/security-compliance/acme_incident_response_policy_2026.md
    - backend/app/experts/corpora/security-compliance/acme_control_test_results_q3_2026.md
    - backend/app/experts/corpora/operations-analyst/manifest.json
    - backend/app/experts/corpora/operations-analyst/acme_supplier_scorecard_q3_2026.md
    - backend/app/experts/corpora/operations-analyst/acme_fulfilment_and_inventory_q3_2026.md
  modified: []
decisions:
  - "Starter Contract literals authored exactly as the plan table fixes them. The four domains are still PROPOSED; they are locked only after the 269-03 live drive (D-269-09)"
  - "Test committed AFTER the corpora so every committed tree is green (zero-headroom baseline). RED is evidenced below, not committed"
  - "New corpora avoid every decimal figure that appears in the Financial Analyzer report (checked mechanically, zero reuse)"
metrics:
  duration: ~25 min
  completed: 2026-09-29
  tasks: 2
  files: 13
---

# Phase 269 Plan 01: Starter Expert Corpora Summary

This plan adds four synthetic, clearly labelled ACME Corporation corpora: Contract Reviewer, HR Policy Advisor, Security & Compliance and Operations Analyst. They are repo data only, loaded through the unchanged Phase 266 loader. A RED-first contract test checks that each cited figure lives in exactly one corpus, and that each out-of-scope refusal is answered only by a sibling corpus.

## What was built

| Slug | folder_name | Cited figures (exactly one corpus) | Refusal literal it must NOT hold (sibling) |
|---|---|---|---|
| contract-reviewer | Contracts & Agreements | `$2.35M`, `75 days` | `94.7%` (operations-analyst) |
| hr-policy-advisor | HR Policies & Handbook | `23 days`, `18 weeks`, `$1,850` | `$2.35M` (contract-reviewer) |
| security-compliance | Security & Compliance Policies | `36 hours`, `14 of 16` | `$124.5` (financial-analyzer) |
| operations-analyst | Operations & Supply Chain | `94.7%`, `38 days`, `41%` | `18 weeks` (hr-policy-advisor) |
| financial-analyzer (unchanged) | Financial Reports & Filings | `$124.5`, `+18.2%`, `30.8%`, `$29.1` | `23 days` (hr-policy-advisor) |

The Operations corpus names exactly three Tier-1 Southeast Asia suppliers: Halvorsen Optics Pte. Ltd. (Singapore), Tanjong Packaging Sdn. Bhd. (Malaysia) and Binh Minh Microsystems JSC (Vietnam). That matches the Financial Analyzer's Item 1A. The scorecard's per-supplier lead times are 35, 42 and 37 days, which average to 38. The spend shares are 41, 33 and 26 percent, which sum to 100.

## RED run (before any new corpus existed; test not committed in this state)

```
E       assert 1 >= 5
E       AssertionError: corpora on disk ['financial-analyzer'] != figure map ['contract-reviewer', 'financial-analyzer', 'hr-policy-advisor', 'operations-analyst', 'security-compliance']
E               AssertionError: b'$2.35M' expected only in contract-reviewer, found in []
E           AssertionError: b'23 days' missing from sibling hr-policy-advisor
FAILED test_derived_slug_set_has_not_collapsed
FAILED test_figure_map_is_a_bijection_with_the_corpus_directories
FAILED test_each_cited_figure_lives_in_exactly_one_corpus_and_it_is_its_own
FAILED test_each_refusal_answer_is_in_the_sibling_and_absent_from_the_asker
4 failed, 2 passed, 4 skipped
```

After Task 1, still RED, but only on the Task 2 corpora (`b'36 hours' expected only in security-compliance, found in []`, `b'94.7%' missing from sibling operations-analyst`): 4 failed, 12 passed.

## GREEN

`pytest tests/unit/test_269_starter_corpora.py tests/unit/test_266_corpus_verbatim.py -q`: **58 passed, 0 failed**.

## Acceptance checks (measured)

- `grep -rl <literal> backend/app/experts/corpora | wc -l` returned **1** for each of `$2.35M`, `75 days`, `23 days`, `18 weeks`, `$1,850`, `36 hours`, `14 of 16`, `94.7%`, `38 days` and `41%`.
- `ls backend/app/experts/corpora` lists exactly contract-reviewer, financial-analyzer, hr-policy-advisor, operations-analyst and security-compliance.
- `find backend/app/experts -name '*.py' | wc -l` returned **0**.
- All 8 new `.md` files begin with `> SAMPLE DATA:`. The single `# ACME Corporati...` first line is the pinned Financial Analyzer file.
- `git diff --stat 0300bf942 HEAD` shows 13 files, all under `backend/app/experts/corpora/` plus the one test file. No service, API, DB or frontend code was touched (D-269-08). The Financial Analyzer directory is byte-unchanged, and test_266 passes.
- FA-number reuse check: every `\d+\.\d+` token in the Financial Analyzer report was compared against every new file. There were **0 overlaps**.

## Corpus byte sizes and sha256 (LF-normalised, as the loader hashes them)

| File | Bytes | sha256 |
|---|---|---|
| contract-reviewer/acme_msa_kestrel_freight_2026.md | 2979 | b1989b70e53895f609d00c41fd5ca0fc77539462f358f8f47e58a9418879a238 |
| contract-reviewer/acme_contract_renewal_schedule_2026.md | 2703 | 7523fa82e3b0ff20a1a1fdab1b775102d701d4e96f4bb6894603a3291b39be1f |
| hr-policy-advisor/acme_employee_handbook_2026.md | 2629 | 6e64a3e71a4fa83df3d36a06d44913a73555199a99c4821de9f265342745754f |
| hr-policy-advisor/acme_learning_and_expense_policy_2026.md | 2363 | 2b5fc8791cdf2b89d1a94c9fd07747a55cb2550534b6c3bd0bd11a67e7f0734e |
| security-compliance/acme_incident_response_policy_2026.md | 2914 | 8a497196f1ab9e426cdeefd12c7d7faa52ad3af02f9563db71611c730f7fbdea |
| security-compliance/acme_control_test_results_q3_2026.md | 2617 | 01a1b9a20ac5be9a85f4be260a55dfb86ab8f1c041c6708ca94791ea775b3f34 |
| operations-analyst/acme_supplier_scorecard_q3_2026.md | 2489 | 225a9ef56526ba3bf0a47a351a294188a839fc2c3f020ce7a9dbbfabb65a8ec6 |
| operations-analyst/acme_fulfilment_and_inventory_q3_2026.md | 2067 | 45c550b72ee00b8e9cfce54a208dc6d99c4a2caf2bd5aedcb3deff876adcbb53 |

## Commits

| Task | Commit | Message |
|---|---|---|
| 1 | d022495e8 | feat(269-01): add Contract Reviewer and HR Policy Advisor starter corpora |
| 2 | e9712ad0a | feat(269-01): add Security & Compliance and Operations Analyst starter corpora |
| 1+2 | dd2a200c8 | test(269-01): pin the starter corpora contract over the derived slug set |

## Deviations from Plan

**1. [Rule 1 - Bug] Removed a Financial Analyzer figure reused in the renewal schedule.** The first draft of `acme_contract_renewal_schedule_2026.md` had `$6.7M revenue`, and the Financial Analyzer report uses `$6.7` for D&A and capex. The plan forbids reusing any FA number, so it was changed to `$6.4M` before the first commit.

**2. [Process] Commit order.** The plan tags the test as TDD RED-first but says a red test must never be committed. So the corpora were committed first, as two feat commits, and the test followed as one test commit. Every committed tree is green, and the RED run is recorded above.

Otherwise the plan was executed as written.

## Threat model dispositions

- **T-269-01:** mitigated. Every corpus loads through the unchanged `load_corpus`, and every filename matches FILENAME_RE.
- **T-269-02:** accepted. All content is invented and every new file is labelled on line 1.
- **T-269-03:** mitigated. `test_new_corpus_carries_no_instruction_like_text` passes on all 8 files.
- **T-269-04:** mitigated. sha256 uniqueness across all corpora is asserted and passes.

## Known Stubs

None.

## Self-Check: PASSED

All 13 created files exist on disk, and the commits d022495e8, e9712ad0a and dd2a200c8 are present in `git log`.
