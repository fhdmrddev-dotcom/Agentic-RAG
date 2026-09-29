---
phase: 269-starter-expert-library
plan: redrive
subsystem: experts / retrieval scope
tags: [experts, starter-library, uat, query_documents, BUG-260929-01]
requires: ["464ec8354 (BUG-260929-01 fix: _inject_folder_scope parenthesises the whole WHERE)"]
provides: ["live re-drive evidence 08-12 for all five starter Experts", "security-compliance promoted into migration 198"]
affects: [supabase/migrations/198_starter_expert_library.sql, backend/app/experts/corpora/security-compliance/, 269-PROD-PARITY.md]
key-files:
  created:
    - .planning/phases/269-starter-expert-library/269-REDRIVE-QUESTIONS.md
    - .planning/phases/269-starter-expert-library/evidence/08..12-<slug>-{install,cited,refusal}.txt (15)
    - .planning/phases/269-starter-expert-library/evidence/redrive-00-users-org-tier.txt
    - .planning/phases/269-starter-expert-library/evidence/redrive-counterfactual-or-scope.txt
  modified:
    - supabase/migrations/198_starter_expert_library.sql
    - backend/app/experts/corpora/security-compliance/ (restored, 3 files)
    - backend/tests/unit/test_269_{bundle_sql_shape,starter_corpora,starter_evidence_gate}.py
    - docs/OPERATOR.md, 269-PROD-PARITY.md, 269-UAT-LOG.md, ROADMAP.md, REQUIREMENTS.md, STATE.md
    - .planning/reported-bugs/query-documents-ignores-restricted-expert-folder-scope.md (status closed)
decisions:
  - "security-compliance PROMOTED into 198 — install, cited and refusal all PASS after the fix, and its refusal is the one turn that discriminates the fix"
  - "198 edited after a LOCAL-only apply: acceptable only because nothing shared ever applied it; once deployed, changes go to a new migration"
  - "Deploy parity: the backend image must carry 464ec8354 before 198 reaches production"
independent_review: self
completed: 2026-09-29
---

# Phase 269 re-drive: live re-drive after BUG-260929-01, security-compliance promoted — Summary

**All five starter Experts re-driven live in a fresh enterprise-tier org after the `query_documents`
OR-precedence fix: 15/15 PASS. The security-compliance refusal re-emitted the exact query shape that had
leaked, and got `No results.` The held Expert was promoted into migration 198, so the library ships five.**

## What was done

1. Restored `backend/app/experts/corpora/security-compliance/` from `0ebaf5d06^`. Its blob hashes match
   269-01 (`e9712ad0a`) for all 3 files.
2. Applied `269-candidate-bundles.sql` to the LOCAL DB (`127.0.0.1:54322`). Read back 5 system rows.
3. Fixed the questions and verdict rules in `269-REDRIVE-QUESTIONS.md` and committed them BEFORE the first
   message (`dfa95c079`). The cited questions are the 269-03 ones. The five refusal questions are new:
   broad, and phrased to invite several OR-joined keywords. Sibling literals are unchanged.
4. Fresh signup `uat269b-admin-0a2e5c` (+ member) created org `21274586-64aa-42a8-81fe-7dedac7740fd`.
   With a NULL tier the org got `403` with the tier sentence. The named F-4 step (`UPDATE … 'enterprise'`,
   local) then made five slugs visible. All five were installed via `POST /experts/{id}/install`.
5. Drove one cited turn and one refusal turn per Expert, each attempted once. Every tool result was scanned
   for out-of-folder documents (id / filename / title).
6. Ran a read-only counterfactual: each model-written `query_documents` SQL went through the pre-fix
   (`464ec8354^`) and current `_inject_folder_scope`, on the same user-context path.

## Verdict table (org `21274586-…`, `deepseek-v4-flash` / `deepseek`, `text-embedding-3-small`)

| Expert | install | cited | refusal | OR-shaped `query_documents` in refusal | discriminates the fix? |
|---|---|---|---|---|---|
| financial-analyzer | PASS `08` | PASS `08` (`30.8%`, `$29.1`) | PASS `08` (`23 days` absent) | 1 | no |
| contract-reviewer | PASS `09` | PASS `09` (`$2.35M`, `75 days`) | PASS `09` (`94.7` absent) | 1 (+1 OR over folder names) | no |
| hr-policy-advisor | PASS `10` | PASS `10` (`18 weeks`, `23 days`) | PASS `10` (`2.35` absent) | 0 (no-WHERE `SELECT`, returned its own 2 docs) | no |
| **security-compliance** | PASS `11` | PASS `11` (`36 hours`, `14 of 16`) | **PASS `11`** (`124.5` absent) | 1: **the leaking shape** | **yes** |
| operations-analyst | PASS `12` | PASS `12` (`94.7%`, `38 days`) | PASS `12` (`18 weeks` absent) | 1 (the model scoped it itself) | no |

Every cited and refusal file reads `web_search_calls: 0` and `out_of_folder_documents_retrieved_by_any_tool: 0`.
No answer names an out-of-folder document. The gate's `evidence_problems` over all five slugs returned `[]`.

## Did the OR shape actually get exercised?

Yes. Four refusal turns emitted an OR-shaped `query_documents`. **Only one of them discriminates the fix**,
and that was measured, not assumed (`evidence/redrive-counterfactual-or-scope.txt`):

- **security-compliance, refusal, call 4:**
  `… WHERE d.filename ILIKE '%revenue%' OR d.filename ILIKE '%financial%' OR … OR d.metadata->>'title' ILIKE '%earnings%'`
  - Pre-fix injection: returns `acme_q3_2026_financial_report.md` (the Financial Analyzer's folder).
  - Current injection: `No results.`
  - Live, the turn got `No results.` and refused cleanly.
- financial-analyzer, contract-reviewer and operations-analyst also emitted OR queries. Those return no
  foreign document under **either** version, so their PASSes would have passed before the fix too. They
  are **not** claimed as proof of it. hr-policy-advisor emitted no OR query, which proves less again.

So the fix has one discriminating live proof: the same turn shape that failed in `06`.

## Decision: PROMOTE security-compliance

Install, cited and refusal all PASS, and its refusal is the discriminating turn. The candidate row `…2693`
was copied VERBATIM into `supabase/migrations/198_starter_expert_library.sql`, and 198 was re-applied
locally (5 system rows read back). `regenerate-full-schema.sh` (no `--reset`) produced zero content diff,
because 198 is data-only. `full-schema.sql` was left uncommitted; its standing ` M` is line endings only.

**Editing an applied migration.** 198 had been applied only to this developer's local DB. It was never
pushed or deployed, and production still lacks it (`269-PROD-PARITY.md` §D is owed). The edit adds one
idempotent upsert, so re-applying converges. The 198 header records that this becomes unacceptable once
198 reaches a shared environment.

## Deviations

1. **[Rule 3 - Blocking] Helper crash on a console print (financial-analyzer refusal).** The run completed
   and persisted, then the helper crashed on a `UnicodeEncodeError` (a `→` printed to a cp1252 console)
   before writing the file. The turn was **not** re-driven. A `reeval-refusal` step evaluated the persisted
   rows by the same checks: it asserts the stored user message equals the fixed question, and the audit
   window is the message time -1s through the run completion +5s. The file says so. stdout was then set to
   UTF-8 for the remaining drives.
2. **[Rule 1 - Bug] Gate test plant went vacuous with two evidence generations.**
   `test_evidence_check_rejects_a_missing_file` unlinked only the newest refusal, which left the older PASS
   behind. It now removes every attempt for that slug.
3. **Stricter than 269-03, stated before driving.** The all-tool scan now also matches titles and counts in
   cited turns. A refusal also fails if the answer names an out-of-folder document. The refusal regex was
   widened, and curly apostrophes are normalised.

## Observations (not defects fixed here)

- The security-compliance refusal says revenue "does not exist anywhere in your document library". It
  exists in a sibling folder outside the Expert's scope, so this is an overstatement of scope. The same
  answer does say a Finance folder may exist "outside this scope". Nothing leaked; the wording is loose.
- The fix parenthesises from the FIRST `WHERE`. Measured on the pure function: a subquery inside the outer
  WHERE is wrapped correctly. A CTE whose body holds the first `WHERE` produces invalid SQL, which errors
  (fails closed, no leak); pre-fix also broke on that shape. No turn wrote a CTE. This is recorded in the
  bug file.

## Tests (targeted only; the full baseline is the orchestrator's)

`test_269_bundle_sql_shape.py` (7), `test_269_no_expert_specific_code.py` (5), `test_269_starter_corpora.py`
(26), `test_269_starter_evidence_gate.py` (11), `test_sql_scope_or_precedence.py` (6): **55 passed**.
The gate was driven RED on the real evidence dir by moving `11-security-compliance-refusal.txt` aside. The
failure reads `06-security-compliance-refusal.txt: newest attempt is not a PASS`. The file was restored
md5-identical. `scripts/check-deploy-drift.sh`: `RESULT: PASS`.

## Commits

- `dfa95c079` docs(269-redrive): questions + verdict rules, committed before the first message
- `0d153fddb` docs(269-redrive): live re-drive evidence 08-12 + users/tier + counterfactual (17 files)
- `1ba800e12` feat(269-redrive): promote security-compliance into 198 (+ corpus, tests, registers, bug closed)

## Owed

- Production: nothing applied or pushed. `269-PROD-PARITY.md` now lists five Experts, and step C requires
  the image to carry `464ec8354`.
- The full backend baseline gate (71-failure ceiling) was not run here.

## Self-Check: PASSED

The 15 evidence files and 2 re-drive files exist. The corpus files exist. Commits `dfa95c079`, `0d153fddb`
and `1ba800e12` are present in `git log`. The local DB has 5 system `expert_bundles` rows.
