---
phase: 269-starter-expert-library
verified: 2026-09-29T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01; the 269-REVIEW.md pass was fresh-context but same model family
status: passed
score: 4/4 must-haves verified (SC#1 qualified by D-269-P1)
gaps: []
inherited_or_deferred:
  - "Phase 267 is human_needed (operator G-4 sign-off); inherited dependency, not 269's to close"
  - "BUG-260929-01 (restricted-Expert query_documents ignores folder scope) open; security-compliance HELD because of it"
  - "269-REVIEW WR-04 + 7 info items deferred"
  - "G-4 states g4-00/03/04 and the original 5-card first-run not reproducible in this org; text evidence recorded in UAT-LOG"
---

# Phase 269: Starter Expert Library - Verification (re-run)

**Goal:** A new org does not open an empty product: the catalog offers a starter library of first-party Experts, each installable through the 266 path and proven to answer from its own corpus.

## Changes since last run
- Independent code review ran (269-REVIEW.md). CR-01, WR-01, WR-02, WR-03 fixed in the "fix(269): review CR-01 ..." commit. Re-checked in the files:
  - `docs/OPERATOR.md` lists `192_revoke_anon` (1 hit) and the `has_table_privilege('anon', ...)` check (line 254).
  - Evidence gate (`test_269_starter_evidence_gate.py`) reads the `out_of_folder_documents_retrieved_by_any_tool: 0` line and `STARTER_FIGURES`.
  - Migration 198 contains 0 occurrences of "strictly". The 198 statements still verbatim-match the candidate SQL (covered by the passing shape tests).
- G-4 screenshots now exist: g4-01, g4-02, g4-05, g4-06 (159-284 KB each) in evidence/. The former human_needed screenshot item is closed for these states. The other states are recorded as not reproducible.
- Previous human_needed items: the screenshots are closed; the independent review has run.

## Truths
| # | Truth | Status | Evidence |
|---|---|---|---|
| SC1 | Catalog visible with detail view (enterprise tier only, D-269-P1; NULL-tier gap = SEED-325) | VERIFIED (qualified) | Local DB read-back (asyncpg, read-only): 4 `expert_bundles` rows, `is_system` true, `org_id` NULL: contract-reviewer, financial-analyzer, hr-policy-advisor, operations-analyst. Screenshots g4-01 (catalog with 4) and g4-02 (detail). |
| SC2 | Same 266 install path, no Expert-specific code | VERIFIED | `test_269_no_expert_specific_code` passes; the diff touches data only. |
| SC3 | Each shipped Expert has a cited figure and a refusal | VERIFIED | Evidence gate passes. Screenshots g4-05 (cited) and g4-06 (refusal) for contract-reviewer. |
| SC4 | No Expert ships on mock evidence; unproven held back | VERIFIED | security-compliance held (refusal FAIL, BUG-260929-01); it is absent from the DB and from 198. Gate has plant tests for this. |

## Checks run
- pytest of the five files (evidence_gate, bundle_sql_shape, starter_corpora, no_expert_specific_code, 266_corpus_verbatim): 76 passed.
- Read-only asyncpg to 127.0.0.1:54322: 4 system rows present, as above. The Supabase MCP (production) was not used.

## Human items
None owned by 269. The inherited 267 sign-off and the deferred items are listed in the frontmatter.

## Observations
- Three of the four shipped restricted Experts share the open BUG-260929-01 exposure. The "strictly" promise was removed from the descriptions, so the copy no longer over-claims.
- Deploy-order dependency (backend image with corpora before 198) is documented in the migration, in 269-PROD-PARITY.md and in docs/OPERATOR.md.
