---
seed_id: SEED-304
title: PACK-05 — the Financial Analyzer's knowledge is unreachable from any real org
created: 2026-09-23
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next milestone's scoping (/gsd:new-milestone) — PACK-05 is an unmet v4.3 requirement carried forward by decision; also any phase touching expert knowledge scoping, folder sharing, or org provisioning.
trigger_paths: ["supabase/migrations/188_expert_chat_scoping.sql", "backend/app/utils/folder_utils.py", "backend/app/services/run_producer.py", "backend/app/services/expert_service.py", "backend/tests/unit/test_260_financial_analyzer_conversation.py"]
trigger_surfaces: []
migration_note:
relates_to: ["Phase 260", "PACK-05", ".planning/v4.3-MILESTONE-AUDIT.md", ".planning/phases/260-the-expert-you-can-actually-use/260-VERIFICATION.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-304: PACK-05 — the Financial Analyzer's knowledge is unreachable from any real org

## The finding

Independent verification of Phase 260 (2026-09-23), confirmed against the local DB by the audit:

- Migration 188 seeded the Financial Analyzer's folder `…0260`, document `…0261`
  (`acme_q3_2026_financial_report.md`) and its chunks into org `430bffc6-…`,
  **"seed@system.local's Organization"**, whose only member is `seed@system.local`. On production
  the same hardcoded UUID names no real org at all.
- The document reads `status='failed'` and **0 of 2 chunks carry an embedding**.
- Folder sharing is org-scoped by design (`get_globally_visible_folder_ids` → the caller's org
  set, D-165-04), so no caller in any other org can retrieve it.
- Every recorded Financial Analyzer conversation in the local DB ends with the agent saying there
  is no 10-K. `test_260_financial_analyzer_conversation.py` mocks `search_documents` and asserts
  answers the test itself hardcodes — it proves dispatcher wiring, not PACK-05.

The Expert is selectable, scopes the thread and shows its prompts (PACK-02/03 hold). It has never
answered FROM ITS DOCUMENTS for a real user, which is PACK-05's whole claim.

## Why it matters

PACK-05 is the proof that a single Expert is worth anything ("if it is not valuable with ONE Expert,
a directory of twelve will not save it"). Today the flagship first-party Expert answers "I have no
documents" to every customer. Anyone demoing it sees that.

## When to surface

At the next `/gsd:new-milestone`, as a candidate requirement carried from v4.3. Also fire on any
phase whose `files_modified` touches the trigger paths.

## The decision it needs (operator)

A **tenancy** choice, which is why it was not fixed inside the milestone close (G-7: a closure round
may not introduce a capability):

1. **System knowledge readable across orgs** — a first-party, read-only corpus that an `is_system`
   Expert may retrieve regardless of the caller's org. New cross-tenant read path; needs its own
   RLS + fence.
2. **Per-org provisioning** — when an org becomes entitled to Experts (or installs one), copy the
   Expert's sample corpus into that org and embed it there. No cross-tenant path; costs storage and
   an ingest per org.

Either way: re-ingest so the document reaches a terminal success status with real embeddings, then
record ONE live conversation as a real user in a real org that cites the report
(`$124.5M` / `+18.2%`), plus one refused out-of-scope question.

## Scope estimate

Medium. Option 2 is mostly reuse (ingest pipeline + a provisioning hook); option 1 is smaller in
code but larger in security review.
