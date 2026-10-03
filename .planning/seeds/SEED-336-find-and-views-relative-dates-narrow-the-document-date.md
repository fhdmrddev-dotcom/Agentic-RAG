---
seed_id: SEED-336
title: In Find and saved Views, a relative-date condition on a custom date field silently narrows the DOCUMENT date instead of that field
created: 2026-10-03
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "The next phase that touches view_filter_compiler.py / view_operators_extra.py / document_search_service.py or the Phase 114 filter builder; or a user reports a saved View returning documents outside a 'within the next N days' window on a contract/renewal date field."
trigger_paths: ["backend/app/services/view_filter_compiler.py", "backend/app/services/view_operators_extra.py", "backend/app/services/document_search_service.py", "backend/app/services/document_view_resolver.py"]
trigger_surfaces: ["library"]
migration_note:
relates_to: ["SEED-153", "272-REVIEW.md CR-02", "272-REVIEW-FIX.md (CR-02 fixed on the chat tool path only)", "Phase 271 Find", "Phase 114 virtual folders / saved Views"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-336: relative dates in Find / Views aim at the wrong column

## What is wrong

`within_next` / `older_than` always compile against `date_typed`, the document's OWN date
(`view_operators_extra.py:143` `_op_within_next`, and the `older_than` sibling), whatever field the
condition names. So a saved View "contract_end within the next 30 days" returns documents whose
**document date** falls in the next 30 days. The renewal list is built from the wrong fact,
silently, with no error.

This is the same compiler hole as Phase 272 review finding **CR-02**. 272 fixed it **only on the
chat tool path** (`search_documents` refuses relative ops on any field except `date` / `added` /
`source_created` / `source_modified`; commit `327861ae1`). Find (Phase 271) and saved Views
(Phase 114) share the compiler and were left alone on purpose.

## Why it was not fixed in 272

Decided by the operator on 2026-10-03 ("Plant a seed") after the 272 review. Find and Views are
Phase 271's surface, not FIND-07. Either fix changes what EXISTING saved views return:
- **compile onto the field's own column** (correct results, but different ones), or
- **reject the op on custom fields** (existing saved views start returning 422).

Either way it needs its own decision and its own lived UAT.

## What a fix must prove

A saved View and a Find query using `<custom date field> within_next 30 days` return exactly the
documents whose **custom field** falls in the window. A document whose document date is inside the
window but whose custom field is outside it is **absent**. And existing saved views either keep
working or say why they no longer do.
