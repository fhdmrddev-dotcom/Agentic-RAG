# 269-04 SUMMARY — operator lock, migration 198, evidence gate

**Requirements:** PACK-26, PACK-27 · **Status:** complete (local apply done; production apply is 269-05's parity note)

## What shipped
- Operator lock recorded verbatim in 269-UAT-LOG.md ("proceed", applied as acceptance of the presented recommendation): LOCK financial-analyzer, contract-reviewer, hr-policy-advisor, operations-analyst; HOLD security-compliance (refusal FAIL — `query_documents` returned a sibling-folder document). Library ships **four** Experts (D-269-09: ship fewer, never weaken).
- `supabase/migrations/198_starter_expert_library.sql`: 3 new org-portable rows (…2691, …2692, …2694) copied byte-verbatim from the candidate SQL + the Financial Analyzer copy fix (D-269-P2). No DDL, no grants, no org id (D-269-07).
- `backend/tests/unit/test_269_starter_evidence_gate.py`: seeded set derived from 198; newest install/cited/refusal evidence per slug must end `VERDICT: PASS` with `web_search_calls: 0`; corpus dirs == financial-analyzer + 198 INSERT slugs; every example_output figure appears in that Expert's own corpus.
- Held Expert's corpus directory deleted (`git rm`); its evidence files kept.

## Proof the gate can fail (commits 0ebaf5d06)
- RED before 198 existed: 8 failed, 1 passed.
- Plant 1: `evidence/05-hr-policy-advisor-refusal.txt` moved aside -> 2 failed, 7 passed; restored, md5 `e1bb08fb48fa00724710a50715e2f071` before and after.
- Plant 2: empty `corpora/planted-unseeded/` -> bijection check failed; removed.
- GREEN: 74 passed (evidence gate + shape + corpora + no-expert-specific-code + 266 verbatim), re-run after apply.

## Local apply (operator: "you do it")
198 applied via asyncpg to 127.0.0.1:54322; held candidate row deleted; read-back = 4 system Experts; `regenerate-full-schema.sql` (no reset) -> content-identical (line-ending noise only, left uncommitted).

## Open
- G-4 screenshots g4-* still owed (no Chrome tool in 269-03).
- `query_documents` folder-scope gap has no reported-bugs entry yet — affects all restricted Experts; planted in 269-05.
