# Phase 237 — One Rule Engine, Not Two · VERIFICATION

- **Built by**: Gemini
- **Reviewed by**: Claude
- **Phase Directory**: `.planning/phases/237-one-rule-engine-not-two`
- **Verdict**: ✅ **PASS** (Ratified by Reviewer on BUS-182 / BUS-183)

---

## 1. Success Criteria Matrix

| Criterion | Description | Verdict | Evidence |
|---|---|---|---|
| **SC#1** | A person writes one rule that files incoming files by name, type, path or size at arrival, and another that files by extracted metadata after read — in the same builder, with the same controls (RULES-01). | ✅ **PASS** | Unified `RuleBuilderPanel.tsx` with scope switcher (`'watch'` vs `'classification'`) and arrival-field restriction in `ConditionPopover.tsx` (`WATCH_FIELDS`). Vitest count gate adopted all 3 suites (29/29 pass). |
| **SC#2** | A person builds a rule, and a saved View, using where it came from as ordinary fields (RULES-02). | ✅ **PASS** | Promoted source facts (`source_system`, `source_connection_id`, `source_path`, `source_state`, `ingest_visibility`) into first-class view filters in `view_filter_compiler.py`. Whitelist bypass seam in `document_view_resolver.py:197` closed. `test_document_views_source_fields.py` 8/8 pass. |
| **SC#3** | A watch rule matching an invalid arrival field is refused at build time with reason (RULES-01). | ✅ **PASS** | `WATCH_ALLOWED_FIELDS` in `classification_rules.py` admits exactly 13 fields, matching 1:1 with `_suggest_destination`'s metadata. Non-arrival fields (e.g. `document_type`, `source_state`, `ingest_visibility`) refused with HTTP 422. `test_preview_rules_scope.py` 8/8 pass, `test_118_rule_validation.py` 13/13 pass. |
| **SC#4** | Widened engine still only ever suggests; VIS-06 access fence preserved. | ✅ **PASS** | `documents.py` is byte-unchanged from baseline; `watch_service.py` contains zero references to rules or suggestions; `test_classification_visibility_fence.py` 6/6 pass; `test_ingest_enrich_shared.py` 30/30 pass. |

---

## 2. Operator Rulings (relayed on BUS-181)

1. **Migration Numbering (173)**:
   - Migration `173_classification_rules_scope.sql` applied to live database (`rule_scope` discriminator column and `classification_rules_scope_idx` verified in `information_schema`).
   - `ROADMAP.md:589` corrected from stale `162` to monotonic `173`.
2. **SEED-252 vs SC#4**:
   - Suggestion-only retained under VIS-06 fence (`accept_classification` remains the sole mover).
   - Automatic moving deferred to SEED-252 for its own dedicated phase.
3. **Watch Rules on Real Ingest Documents**:
   - `ingest_enrich.py` synthesizes arrival facts into `eval_facts` and evaluates rules across both scopes, writing the standard `_classification` suggestion (`status="suggested"`) onto real documents during ingest.
   - Reuses existing suggestion object and accept flow; zero auto-move; zero fence bypass.

---

## 3. Verification Gates Summary

- **Backend Unit Tests**:
  - Command: `backend\venv\Scripts\pytest.exe tests/unit -q --continue-on-collection-errors`
  - Result: `71 failed, 3971 passed, 2 xfailed, 2 xpassed`.
  - Failure set: **Byte-identical to reviewer's baseline set of 71** (+25 passing tests, zero new failures, 71 ceiling held).
  - **BUS-184 Resolution**: `test_email_ingestion.py::test_ingest_email_populates_metadata_and_attachments` intermittently saw `assert final_meta["document_type"] == "email"` fail when `enrich_for_ingest` called `extract_metadata_enriched` against live OpenAI credentials (from `backend/.env`), extracting non-deterministic `document_type` values (e.g. `'notification'`, `'agreement'`). Because `ingest_enrich.py:253` previously only set `"email"` if `document_type` was absent (`if not metadata_dict.get("document_type"):`), the LLM extraction suppressed the email MIME-type override. Fixed at `ingest_enrich.py:254` by making `metadata_dict["document_type"] = "email"` unconditional for email MIME types (`message/rfc822`, `application/vnd.ms-outlook`, `application/x-msg`), honoring the deterministic EML-01 contract. Verified ceiling holds at 71 failed / 3971 passed.
- **Vitest Count Gate**:
  - Command: `node scripts/vitest-count-gate.cjs`
  - Result: `total 7816 · failed 2 · pinned total 7020`.
  - Gate adopted all 3 classification suites (`RuleBuilderPanel.test.tsx` [8], `ClassificationSection.test.tsx` [13], `ClassificationRulesPage.test.tsx` [8]). Pinned total rose 6991 → 7020 (+29); total executed rose 7787 → 7816 (+29).
  - 2 failures (`WorkflowRunPage.test.tsx`, `WorkflowsPage.test.tsx`) are byte-unchanged pre-existing SEED-171 flakes.
- **Hot-File Ledger Gate**:
  - Command: `node scripts/check-hot-file-ledger.cjs 237`
  - Result: OK (224 rows, 10 watched).
- **CLAUDE.md Size Gate**:
  - Command: `node scripts/check-claude-md-size.cjs`
  - Result: OK (81,332 chars, headroom 68,668).
- **Full Schema Sync**:
  - `scripts/regenerate-full-schema.sh` executed cleanly against live DB.

---

## 4. Named Limitation (Recorded in SEED-253)

- `SourceFile.path` currently defaults to `/<filename>` because existing external source adapters (Google Drive, mock source) do not yet populate hierarchical folder paths on `SourceFile`.
- Production falls back to `/<filename>`, meaning folder-shaped path rules (e.g. `/Finance/Invoices/`) do not match until adapter path resolution is shipped.
- Real adapter path resolution is explicitly deferred to **SEED-253** (forcing function: Phase 238 Microsoft Graph adapter).
- Documented in code with explanatory comments on `SourceFile.path` (`base.py:43`), `preview_service.py:583`, and `ingest_enrich.py:537`.

---

## 5. What Was Not Done (Stated as a Decision)

⛔ **G-4 Manual UAT is OWED by decision**:
- Phase 237 shipped a modified rule-builder UI surface (scope switcher, restricted arrival fields) that has not yet been manually clicked by a human operator in a live browser.
- All programmatic contracts, AST matching, validation refusals, and UI rendering are pinned by unit and integration suites and guarded under the Vitest count gate.
- The owed manual verification will be conducted alongside connector integration flows in Phase 238.
