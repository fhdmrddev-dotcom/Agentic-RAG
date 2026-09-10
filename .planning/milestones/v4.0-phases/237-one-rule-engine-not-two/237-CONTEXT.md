# Phase 237: One Rule Engine, Not Two - Context

**Gathered:** 2026-09-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 237 delivers **RULES-01** and **RULES-02**. It closes the dual-engine / dual-callsite discrepancy by establishing one rule engine with a scope discriminator (`rule_scope`), making source facts first-class filterable fields across classification rules and saved views, enforcing build-time refusal for out-of-scope fields, and re-proving the VIS-06 security fence.

The phase strictly enforces:
- **One Rule Engine (RULES-01 / SC#1)**: One AST (`ViewFilter`), one matcher (`classification_matcher`), one unified authoring builder (`RuleBuilderPanel.tsx`) with a scope discriminator (`rule_scope`).
- **First-Class Source Facts (RULES-02 / SC#2)**: Where a document came from (`source_system`, `source_connection_id`, `path`, `ingest_visibility`) is an ordinary field that rules and saved views can filter on.
- **Build-Time Refusal (SC#3)**: A watch rule attempting to match fields that do not exist at arrival time (e.g. extracted metadata or custom fields) is refused at save/update with HTTP 422 and a clear explanatory reason.
- **Access Fence Preserved (SC#4)**: Rules still only suggest, never auto-move; the VIS-06 fence refusing private-connection documents from being moved to org-shared folders without explicit human `force=True` is re-proven under the widened engine.
- **Constraints**: ⛔ No second AST, no second matcher, no bypass of field whitelists, no automatic moving of files (retaining human-in-the-loop per SC#4).
</domain>

<decisions>
## Implementation Decisions

### Single Engine & Scope Discriminator
- **D-237-01:** Reuse `ViewFilter` and `classification_matcher.match_metadata` as the single AST and evaluator. Add `rule_scope text NOT NULL DEFAULT 'classification'` to `classification_rules` via migration 173 (`173_classification_rules_scope.sql`) with a check constraint `CHECK (rule_scope IN ('watch', 'classification'))`. Backfill all existing rules to `'classification'`. Update Pydantic models (`RuleCreate`, `RuleUpdate`, `RuleResponse`) with `rule_scope: Literal["watch", "classification"] = "classification"`.

### Scope-Differentiated Whitelists & Build-Time Refusal (SC#3)
- **D-237-02:** Separate the allowed field whitelist by `rule_scope`:
  - `WATCH_FIELDS`: Fields present at arrival/preview time (`name`, `path`, `mime`, `size`, `source_system`, `source_connection_id`).
  - `CLASSIFICATION_FIELDS`: Extracted metadata (`_METADATA_BUILTINS`) ∪ enabled custom fields ∪ source facts.
  - When saving or updating a rule with `rule_scope == "watch"`, any condition targeting an extracted or custom field is rejected at build time with HTTP 422 Unprocessable Entity and an explicit message explaining that extracted metadata is unavailable at arrival time.

### Arrival & Preview Service Alignment
- **D-237-03:** Fix live failure mode in `preview_service.py:475`:
  - `_suggest_destination` only evaluates rules where `rule.get("rule_scope") == "watch"`.
  - Assemble complete arrival facts in `preview_metadata`: `name`, `path`, `mime`, `size`, `source_system`, `source_connection_id`.
  - `match_metadata` is called with the watch whitelist, enabling watch rules to reliably match on incoming files.

### Source Facts in Saved Views & Whitelist Seam (SC#2)
- **D-237-04:** Expose source facts as first-class filterable fields in `_build_field_meta` for saved views and rules. In `document_view_resolver.py` and `view_filter_compiler.py`, ensure all condition fields are validated against the active whitelist so typed columns (`PROMOTED_TYPED_COLUMNS`) cannot bypass field-level validation.

### VIS-06 Fence Re-proven (SC#4)
- **D-237-05:** Re-prove the VIS-06 fence at `documents.py:1957-1985`. The widened engine produces suggestions only (`metadata._classification`). If `accept_classification` targets an org-shared folder from a private-connection document, it raises HTTP 403 `classification_refusal` unless `force=True` is provided.

### Unified Frontend Rule Builder & Views (SC#1)
- **D-237-06:** In `RuleBuilderPanel.tsx`, add a Scope segmented selector ("When files arrive" vs "After extraction"). Dynamically constrain `ConditionPopover` field offerings to the selected scope. In `ClassificationRulesPage.tsx`, render scope badges on rule cards with filtering by scope.

### Hot-File Ledger & Debt Tracking
- **D-237-07:** Update `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` for touched files crossing thresholds (`classification_matcher.py`, `classification_rule_service.py`, `document_views.py`, `classification_rules.py`, `RuleBuilderPanel.tsx`) in the same commit.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Standards & Baselines
- `.planning/237-one-rule-engine-not-two/BASELINE.md` — Measured baselines, failure modes, and gate counts.
- `.planning/ROADMAP.md` § Phase 237 — Scope, requirements (RULES-01, RULES-02), and success criteria.
- `.planning/REQUIREMENTS.md` § RULES-01, RULES-02 — Requirement definitions.
- `.planning/seeds/SEED-209-connector-ingestion-must-route-through-the-classification-splice.md` — Provenance as filterable fields.
- `.planning/seeds/SEED-252-metadata-driven-filing-many-rules-contribute-and-the-file-is-actually-moved.md` — Multi-rule & move context.

### Codebase Implementations
- `backend/app/services/classification_matcher.py` — In-Python AST evaluation engine.
- `backend/app/services/classification_rule_service.py` — Rule CRUD data-access service.
- `backend/app/api/classification_rules.py` — Classification rules HTTP API router.
- `backend/app/services/view_filter_compiler.py` — ViewFilter AST compiler and validators.
- `backend/app/services/document_view_resolver.py` — Field whitelist and saved view resolver.
- `backend/app/services/sources/preview_service.py` — Watch preview destination suggestion.
- `backend/app/services/ingest_enrich.py` — Post-extraction rule evaluation.
- `frontend/src/components/classification/RuleBuilderPanel.tsx` — Rule authoring panel.
- `frontend/src/components/classification/ClassificationRulesPage.tsx` — Rules management page.
</canonical_refs>
