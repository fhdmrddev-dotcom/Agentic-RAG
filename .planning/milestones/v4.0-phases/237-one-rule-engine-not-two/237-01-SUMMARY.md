---
phase: 237-one-rule-engine-not-two
plan: 01
subsystem: classification-rules-engine
tags: [classification, rules, watch, arrival, scope, sc1, sc3, rules-01]
status: complete
requires:
  - Phase 118 classification rules schema and matcher
  - Phase 233 preview service and arrival facts
provides:
  - migration 173_classification_rules_scope.sql adding rule_scope column
  - Scope discriminator ('watch' | 'classification') on RuleCreate, RuleUpdate, RuleResponse
  - WATCH_ALLOWED_FIELDS validation and HTTP 422 refusal for un-extracted metadata in watch rules
  - Arrival facts assembly in preview_service._suggest_destination
affects:
  - backend/app/models/classification_rule.py
  - backend/app/api/classification_rules.py
  - backend/app/services/classification_rule_service.py
  - backend/app/services/sources/preview_service.py
  - backend/app/services/ingest_enrich.py
key-files:
  created:
    - supabase/migrations/173_classification_rules_scope.sql
    - backend/tests/unit/services/sources/test_preview_rules_scope.py
  modified:
    - supabase/full-schema.sql
    - backend/app/models/classification_rule.py
    - backend/app/api/classification_rules.py
    - backend/app/services/classification_rule_service.py
    - backend/app/services/sources/preview_service.py
    - backend/app/services/ingest_enrich.py
    - backend/tests/unit/test_118_rule_validation.py
metrics:
  tasks_complete: 4 of 4
  completed: 2026-09-06
---

# Phase 237 Plan 01: Schema, Scope Discriminator & SC#3 Refusal — Summary

Wave 1 established the backend foundation for unifying the arrival watch and classification rule engines into a single system while preventing rules from validating against facts unavailable at evaluation time.

## Artifacts Delivered

1. **Migration 173 & Schema Regeneration**:
   - `supabase/migrations/173_classification_rules_scope.sql`: Added `rule_scope text not null default 'classification' check (rule_scope in ('watch', 'classification'))` to `classification_rules` and index on `(rule_scope, enabled)`.
   - Applied to local DB (:54322) and regenerated `supabase/full-schema.sql`.

2. **Models & API Validation**:
   - `backend/app/models/classification_rule.py`: Added `rule_scope: Literal["watch", "classification"] = "classification"` across `RuleCreate`, `RuleUpdate`, and `RuleResponse`.
   - `backend/app/api/classification_rules.py`: Defined `WATCH_ALLOWED_FIELDS = frozenset({"name", "path", "mime", "size", "source_system", "source_connection_id"})`. Added `validate_rule_scope_fields` raising HTTP 422 with clear explanatory error message if a watch-scope rule references any non-arrival field (e.g. `document_type`, `topics`, `summary`).

3. **Service Alignment (SC#3 Closure)**:
   - `backend/app/services/sources/preview_service.py`: Updated `_suggest_destination` to query `rule_scope="watch"`, assemble full arrival facts dictionary (`name`, `path`, `mime`, `size`, `source_system`, `source_connection_id`), and pass `WATCH_ALLOWED_FIELDS` as whitelist to `match_metadata`.
   - `backend/app/services/ingest_enrich.py`: Updated post-extraction evaluation to query rules and evaluate with whitelist expanded to include `WATCH_ALLOWED_FIELDS`.

## Verification
- `test_preview_rules_scope.py`: 5/5 tests passed verifying arrival facts matching, un-extracted field mismatch, and scope isolation.
- `test_118_rule_validation.py`: 18/18 tests passed including new 422 refusal tests for watch rules referencing un-extracted fields.
- `test_118_matcher.py`: 8/8 tests passed.
