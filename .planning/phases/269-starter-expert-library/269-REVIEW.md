---
phase: 269-starter-expert-library
reviewed: 2026-09-29T00:00:00Z
depth: standard
files_reviewed: 15
files_reviewed_list:
  - supabase/migrations/198_starter_expert_library.sql
  - backend/tests/unit/test_269_starter_evidence_gate.py
  - backend/tests/unit/test_269_bundle_sql_shape.py
  - backend/tests/unit/test_269_no_expert_specific_code.py
  - backend/tests/unit/test_269_starter_corpora.py
  - docs/OPERATOR.md
  - backend/app/experts/corpora/contract-reviewer/acme_contract_renewal_schedule_2026.md
  - backend/app/experts/corpora/contract-reviewer/acme_msa_kestrel_freight_2026.md
  - backend/app/experts/corpora/contract-reviewer/manifest.json
  - backend/app/experts/corpora/hr-policy-advisor/acme_employee_handbook_2026.md
  - backend/app/experts/corpora/hr-policy-advisor/acme_learning_and_expense_policy_2026.md
  - backend/app/experts/corpora/hr-policy-advisor/manifest.json
  - backend/app/experts/corpora/operations-analyst/acme_fulfilment_and_inventory_q3_2026.md
  - backend/app/experts/corpora/operations-analyst/acme_supplier_scorecard_q3_2026.md
  - backend/app/experts/corpora/operations-analyst/manifest.json
findings:
  critical: 1
  warning: 4
  info: 7
  total: 12
status: issues_found
independent_review: self
---

# Phase 269: Code Review Report

**Reviewed:** 2026-09-29
**Depth:** standard
**Files Reviewed:** 15
**Status:** issues_found

## Summary

This was a fresh-context adversarial review of migration 198, the four 269 fences, the three new corpora with their manifests, and the OPERATOR.md Step-3 change. All four test files pass (`42 passed`, run in `backend/` with the venv).

**What checked out, measured rather than assumed:**
- Migration 198 is org-portable. Every row has `org_id NULL` and the sentinel author, and the only UUIDs in the file are the declared ids.
- 198 contains no DDL and no grants, and it is idempotent. The upsert targets the existing `idx_expert_bundles_system_slug` partial unique index.
- Apostrophes are doubled correctly. No literal contains `;` or `--`.
- Every 198 statement is byte-identical to a statement in `269-candidate-bundles.sql` after whitespace normalisation. The candidate file has not changed since `c1254886a` (269-02), which is before the 269-03 drive.
- All three manifests satisfy the 266 loader contract: `folder_name` plus text-mime `files`, LF on disk (`git ls-files --eol`), and filenames matching `FILENAME_RE`.
- Every cited figure appears in its own corpus and in no other corpus, including `42%` and `380 bps` in the Financial Analyzer corpus.
- Every file opens with the SAMPLE DATA line. No text in any corpus is addressed to a model.
- Nothing that ships (198, the corpora, the backend app) still references `security-compliance`. The remaining references are in the staging artifact, the shape test and the evidence gate, and they are deliberate.

**Key concerns:**
1. **Blocker:** the new OPERATOR.md Step-3 row for migration 186 re-grants `anon` read on `tier_capabilities` on every greenfield box. Migration 192 withdrew that grant, and the runbook never re-applies 192.
2. **Evidence gate trusts a hand-written line:** it accepts any `VERDICT: PASS` line and never reads the measurements that produced it. The measurement that caught the security-compliance leak is not checked at all.
3. **Starter copy promises "strictly" while every restricted Expert shares the open BUG-260929-01 exposure:** two of the PASS refusal turns called `query_documents`. The copy claims "Answers strictly from its installed ACME sample documents".

## Critical Issues

### CR-01: OPERATOR.md Step 3 re-applies migration 186 after `full-schema.sql`, which restores `anon` read on the pricing map that migration 192 revoked

**File:** `docs/OPERATOR.md:205` (the new row 10), together with `supabase/migrations/186_tier_capabilities.sql:30,34-39`
**Issue:** Step 1 loads `full-schema.sql`. Its supplement already carries 186's grant and then 192's `REVOKE ALL ... FROM anon` / `FROM PUBLIC` (`full-schema.sql:8626-8630`), and its policy reads `TO authenticated, service_role` (`:7843`). Step 2 then tells the operator to paste **the whole of** `186_tier_capabilities.sql`, which runs:
```sql
GRANT SELECT ON TABLE public.tier_capabilities TO anon, authenticated, service_role;
DROP POLICY IF EXISTS "tier_capabilities_read_all" ON public.tier_capabilities;
CREATE POLICY "tier_capabilities_read_all" ON public.tier_capabilities
    FOR SELECT TO anon, authenticated, service_role USING (true);
```
Migration 192 appears nowhere in OPERATOR.md (`grep -n 192 docs/OPERATOR.md` finds nothing). So every box bootstrapped from this runbook ends up with the tier-to-capability map readable by unauthenticated callers. Migration 192 exists precisely to undo that ("Exposing the pricing map to anonymous callers was never a requirement"). This is the `anon` exposure class CLAUDE.md records as having fired three times already (BUG-260911-01, migration 156, migration 177). The gates stay green here too, because nothing in the suite makes a request as `anon`.
**Fix:** Add migration 192 to the table immediately after 186, and state the ordering:
```markdown
| 10 | `186_tier_capabilities.sql` | `tier_capabilities` rows — **apply FIRST of the tier pair** |
| 11 | `192_revoke_anon_tier_capabilities.sql` | withdraws 186's `anon` grant + policy — **apply SECOND, always after 186** |
```
Renumber the later rows and change the count from 13 to 14. Also add a check to Step 4:
```sql
SELECT has_table_privilege('anon', 'public.tier_capabilities', 'SELECT');  -- expect false
```
Alternatively, list a data-only extract of 186 (its `INSERT ... ON CONFLICT` block only) instead of the whole file. The same "whole-file paste over a newer schema" hazard applies to any future seed migration that carries grants.

## Warnings

### WR-01: The evidence gate checks for a `VERDICT: PASS` line, not the measurements behind it. It would have accepted the security-compliance leak.

**File:** `backend/tests/unit/test_269_starter_evidence_gate.py:135-157`
**Issue:** `evidence_problems` checks four things: the `slug:` header, that `org_id:` is shaped like a UUID, that there is exactly one line starting `VERDICT:` and it reads `VERDICT: PASS`, the presence of `web_search_calls: 0`, and at least one `figure:` line. It never reads the lines that actually establish the verdict:
- `out_of_folder_documents_retrieved_by_any_tool: 0`: the measurement that turned `06-security-compliance-refusal.txt` into a FAIL.
- `sibling_literal_present: false`.
- Whether the `figure:` values are the Starter Contract figures for that slug. Any `figure: x` line passes.

The verdict lines are hand-edited. `03-financial-analyzer-cited.txt:45` records a helper FAIL that was manually superseded to PASS. `06-security-compliance-refusal.txt:48` records a helper PASS that was manually superseded to FAIL. The original helper measured only `search.query`, and for security-compliance it emitted `VERDICT: PASS`. A re-drive file produced by that helper, without the supplementary scan, would satisfy this gate while `query_documents` leaked a sibling-folder document. The gate currently verifies that someone typed PASS, not that nothing out of scope was retrieved (SC#4 / T-269-09).
**Fix:** Assert the measured lines as well as the verdict, and give each check a non-vacuity plant, following the existing `ev_copy` pattern:
```python
if kind in ("cited", "refusal") and not any(
    ln.strip() == "out_of_folder_documents_retrieved_by_any_tool: 0" for ln in lines):
    problems.append(f"{f.name}: no 'out_of_folder_documents_retrieved_by_any_tool: 0' line")
if kind == "refusal" and "sibling_literal_present: false" not in lines:
    problems.append(f"{f.name}: sibling literal not measured absent")
if kind == "cited":
    figs = {ln[len("figure: "):] for ln in lines if ln.startswith("figure: ")}
    expected = STARTER_CONTRACT[slug]  # import EXPECTED_FIGURES / MAY_CITE rather than retyping
    if not figs >= expected: problems.append(f"{f.name}: figures {figs} != contract {expected}")
```

### WR-02: Copy claims "Answers strictly from its installed ACME sample documents" for three restricted Experts that share the open BUG-260929-01 exposure

**File:** `supabase/migrations/198_starter_expert_library.sql:70,135,200` (the three descriptions) and the header at `:23-26`
**Issue:** The header presents security-compliance as the Expert that failed. BUG-260929-01, however, is a platform property: `query_documents` ignores a restricted Expert's folder scope. It applies equally to all four shipped restricted Experts. The evidence shows the exposure was live in the PASS turns too:
- `04-contract-reviewer-refusal.txt`: tools `['search_documents', 'grep', 'grep', 'query_documents']`.
- `07-operations-analyst-refusal.txt`: tools `['search_documents', 'grep', 'query_documents']`.

Those turns passed because the SQL the model happened to write did not match a sibling document, not because anything prevented it. The hold/ship split therefore comes from one stochastic sample per Expert, not from a property that differs between them. The shipped description then makes a user-facing scope promise ("strictly ... or says it cannot find the answer") that the platform cannot currently keep. The task scoped BUG-260929-01 out "unless 269 code claims it is safe", and these three strings make exactly that claim.
**Fix:** Pick one of these:
- (a) Soften the three descriptions until BUG-260929-01 ships, for example "Answers from its installed ACME sample documents, citing the clause". An UPDATE in a follow-up migration keeps 198 verbatim to the candidate.
- (b) Record in 198's header and in the UAT log that the three shipped Experts carry the same exposure and passed on one sample each.
- (c) Block PACK-26 on the bug fix and a re-drive.

At minimum, the header's framing should not imply the other three are proven scope-safe.

### WR-03: "All thirteen are idempotent — safe to re-run" plus a slug-only verify query means a lone re-run of 187 or 189 silently restores the uncitable Financial Analyzer copy

**File:** `docs/OPERATOR.md:212`, `:243-248`
**Issue:** 187's upsert re-sets `prompt_suggestions` to the "Compare Quarterly Revenue / quarter-over-quarter" suggestion (`187_expert_bundles.sql:149-150,161`). 189's UPDATE re-sets `example_output` to `24.3% (+180 bps YoY) / $412M` (`189:100`). Each file is idempotent on its own, but the trio does not commute. Re-running 187 or 189 alone after 198, which the "safe to re-run" sentence invites, brings back exactly the copy D-269-P2 removed because the corpus contradicts it. The Step-4 verification cannot catch this, because `SELECT slug FROM expert_bundles WHERE is_system` still returns the same four slugs.
**Fix:** Say "safe to re-run **only as the whole trio, in order**", and make the verification check content as well as presence:
```sql
SELECT slug, example_output LIKE 'EBITDA Margin: 30.8%%' AS fa_copy_current
FROM public.expert_bundles WHERE is_system ORDER BY slug;
-- expect 4 rows; financial-analyzer fa_copy_current = true
```

### WR-04: The "no Expert-specific code" fence cannot see a branch keyed on the Expert's name or folder name, which is the vector already retired once (262-02)

**File:** `backend/tests/unit/test_269_no_expert_specific_code.py:263-294`, `:338-353`
**Issue:** `derived_needles()` derives slugs and bundle ids only. The CLAUDE.md ledger records that `ExpertSpotlightCard.tsx` had "FOUR demo-Expert hardcodes retired", with the note "no fallback here may inspect `slug` or `name` — that match IS the retired artefact". A new `if (expert.name === "Contract Reviewer")` in `frontend/src/`, or `if corpus.folder_name == "Contracts & Agreements"` in `backend/app/`, passes all four fence tests. The docstring's claim that "no Expert-specific install code" is a mechanical property therefore covers only two of the four identifiers an Expert carries.
**Fix:** Add `eval_text(row["name"])` from every seed INSERT, and every manifest `folder_name` from `CORPORA_ROOT/*/manifest.json`, to the needle set. Scan for those needles as quoted literals, the same way slugs are scanned. Also:
- Add a plant for a name-keyed branch to the RED drive.
- Measure the current hits first. `ExpertAuthoringStudio.tsx:717` `placeholder="E.g. Financial Analyzer"` is the only production hit, and it is the same M-15 placeholder case already allowlisted for the slug.

## Info

### IN-01: The needle-set collapse floor of 5 now depends on the HELD security-compliance row in a planning artifact

**File:** `backend/tests/unit/test_269_no_expert_specific_code.py:373-374`
**Issue:** The shipped corpora plus 198 give only 4 slugs. `len(slugs) >= 5` holds only because `269-candidate-bundles.sql` still carries the held `security-compliance` row. Removing that row as a reasonable clean-up would fail this test with a misleading "collapsed" message. The same held row keeps `MAY_CITE["security-compliance"]` and `STARTER_IDS` alive in `test_269_bundle_sql_shape.py:42-63`. `SHIPPED_CORPORA_FLOOR` was moved from 5 to 4 in the corpora test, but this floor was not.
**Fix:** Derive the floor from what ships (corpus dirs ∪ 198 slugs, at least 4), or document that the staging row must never be removed.

### IN-02: HR example_output cites a section name that does not exist in the corpus

**File:** `supabase/migrations/198_starter_expert_library.sql:160`
**Issue:** It reads `(Employee Handbook, Leave & Time Off)`, but the heading in `acme_employee_handbook_2026.md:9` is `## Leave and Time Off`. The operations row at `:225` credits `38 days` to "(Supplier Scorecard)", but the figure sits in the `## Summary` table (`acme_supplier_scorecard_q3_2026.md:19`). The copy advertises "names the policy section it came from", so the example should use the real section name.
**Fix:** Change the text to "Leave and Time Off". This needs a candidate-first edit, because the verbatim gate pins 198 to the candidate.

### IN-03: The renewal schedule contradicts its own scope statement

**File:** `backend/app/experts/corpora/contract-reviewer/acme_contract_renewal_schedule_2026.md:5,11`
**Issue:** Line 5 says the schedule lists agreements renewing or expiring in 2026 and the first half of 2027. Line 11 lists Kestrel with a renewal date of `2029-02-01`. The "Upcoming Renewals" prompt suggestion invites the model to reason over this table, so the inconsistency can surface in a demo answer.
**Fix:** Drop the Kestrel row, or widen the scope sentence.

### IN-04: The CR check in `test_every_corpus_loads_as_lf_text` runs on already-normalised bytes

**File:** `backend/tests/unit/test_269_starter_corpora.py:112`
**Issue:** `load_corpus` returns `normalise_bytes(raw)` (CRLF → LF), so `b"\r" not in f.raw` can only detect a lone CR. It cannot detect the CRLF case the docstring ("LF only") implies. The files are LF today (verified with `git ls-files --eol`, and `.gitattributes` pins `eol=lf`), so nothing is broken.
**Fix:** Read `(CORPORA_ROOT / slug / f.filename).read_bytes()` directly for this assertion.

### IN-05: The evidence gate's figure check drops units and matches substrings

**File:** `backend/tests/unit/test_269_starter_evidence_gate.py:57-63,205`
**Issue:**
- `$2.35M` is checked as `$2.35`, so a copy reading `$2.35B` would pass.
- `94.7%` would also match inside `194.7%`.

For 198 this is compensated by `test_269_bundle_sql_shape._check_example_output`, which requires the exact `MAY_CITE` phrases. The gate's own docstring claim (M-10) is weaker than it reads.
**Fix:** Match on token boundaries and keep the unit when the corpus states it inline.

### IN-06: `ICON_KEYS` is a hand-typed copy of the frontend's closed icon map

**File:** `backend/tests/unit/test_269_bundle_sql_shape.py:52-55`
**Issue:** The set matches `EXPERT_ICON_MAP` in `frontend/src/components/experts/expertIcon.tsx:48-59` today. If a key is removed there, this fence keeps passing while the card silently renders Sparkles.
**Fix:** Parse the keys out of `expertIcon.tsx` (the `?raw` approach), or pin the two sets as equal.

### IN-07: Two smaller test-precision and residue issues

**Files:** `backend/tests/unit/test_269_no_expert_specific_code.py:356-358`; `supabase/migrations/198_starter_expert_library.sql:38-40`
**Issue:**
- `_is_allowlisted` allowlists the whole line that contains the placeholder, so a second slug on the same line would also be allowlisted.
- 198's header says it is "safe over the candidate rows already applied locally". That is true, but 198 does not remove a pasted candidate `…2693` row. The local clean-up was a manual `DELETE` (269-UAT-LOG.md:196). Any other box where the candidate was pasted keeps a Start-Chat-with-no-Install card, which is the M-12 trap.
**Fix:**
- Allowlist on `(rel, needle, text)` rather than on `(rel, text)`.
- Record in 198's header that a box which pasted the candidate needs the same `DELETE`.

---

_Reviewed: 2026-09-29_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
