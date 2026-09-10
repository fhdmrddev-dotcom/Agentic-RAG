---
phase: 237-one-rule-engine-not-two
plan: 02
subsystem: view-filter-compiler-resolver
tags: [document-views, source-facts, filter-compiler, view-resolver, sc2, rules-02]
status: complete
requires:
  - Phase 113 & 114 view filter compiler
  - Phase 115 document view resolver
provides:
  - Source facts (source_system, source_connection_id, path, ingest_visibility, source_state) as first-class view filter fields
  - Promotion into PROMOTED_TYPED_COLUMNS
  - Whitelist validation on typed legs in document_view_resolver.py:197 closing SC#2 bypass seam
  - Nested JSON path mapping for source_system (metadata->source->>system) and file_path for path
affects:
  - backend/app/services/document_view_resolver.py
  - backend/app/services/view_filter_compiler.py
  - backend/app/services/view_operators_extra.py
key-files:
  created:
    - backend/tests/unit/test_document_views_source_fields.py
  modified:
    - backend/app/services/document_view_resolver.py
    - backend/app/services/view_filter_compiler.py
    - backend/app/services/view_operators_extra.py
metrics:
  tasks_complete: 3 of 3
  completed: 2026-09-06
---

# Phase 237 Plan 02: Source Facts in Compiler & Resolver — Summary

Wave 2 delivered first-class filtering support for arrival source facts in saved document views, closing the SC#2 whitelist bypass seam.

## Artifacts Delivered

1. **Resolver Whitelist Enforcement & Seam Closure**:
   - `backend/app/services/document_view_resolver.py`:
     - Added `_SOURCE_FACT_FIELDS = frozenset({"source_system", "source_connection_id", "path", "file_path", "ingest_visibility", "source_state"})` to `_build_field_meta` whitelist.
     - Closed the SC#2 whitelist bypass vulnerability at line 197: `frag.leg == "typed"` is now strictly verified against `PROMOTED_TYPED_COLUMNS.values()`, while `custom` and `containment` legs are verified against the field metadata whitelist. Unwhitelisted fields raise ValueError.
     - Updated PostgREST filter application: dispatches `col = frag.field` for promoted typed columns, `metadata->source->>system` for `source_system`, `file_path` for `path`/`file_path`, and handles `is.null` for `is_empty` operators on typed columns.

2. **AST Compiler & Operator Handling**:
   - `backend/app/services/view_filter_compiler.py`:
     - Promoted `source_connection_id`, `path`, `file_path`, `ingest_visibility`, and `source_state` into `PROMOTED_TYPED_COLUMNS`.
     - Added `source_system`, `ingest_visibility`, and `source_state` to `NORMALIZED_LOWER_FIELDS`.
   - `backend/app/services/view_operators_extra.py`:
     - Updated `_op_is_empty` to inspect `PROMOTED_TYPED_COLUMNS` and emit a typed leg with value `None` rather than generating containment filters on custom metadata.

## Verification
- `test_document_views_source_fields.py`: 8/8 tests passed verifying AST compilation, PostgREST query fragment generation, and whitelist enforcement across all source facts.
- `test_113_view_filter_compiler.py` & `test_114_view_filter_compiler.py`: 34 passed (1 intentional baseline xfail).
