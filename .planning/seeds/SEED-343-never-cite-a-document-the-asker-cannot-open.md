---
seed_id: SEED-343
title: Permission-aware citations — an answer must never cite or preview a document the asking user cannot open (v3.4 STRETCH Phase 171, never built)
created: 2026-10-04
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "BEFORE any department/role folder sharing or per-document cross-user sharing ships to a real tenant; OR any phase that makes the 'dept' ingest visibility live; OR any phase that lets a document be retrievable but not openable by the asker (e.g. SEED-210 source-ACL work); OR a security review asks how citations respect permissions."
trigger_paths: ["backend/app/services/retrieval_service.py", "backend/app/services/retrieval_scope.py", "backend/app/services/citation_markers.py", "frontend/src/components/chat/CitationPeek.tsx", "frontend/src/components/chat/CitationCard.tsx", "backend/app/api/folders.py"]
trigger_surfaces: ["retrieval", "chat", "auth"]
migration_note:
relates_to: [".planning/v3.4-STRETCH-CARRYFORWARD.md § 171 (PRAG-02)", "SEED-115", "SEED-210", "SEED-211", "docs/history/v3.4-multi-tenancy-and-org-access.md"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-343: never cite a document the asker cannot open

## The finding

v3.4 deferred STRETCH Phase 171 (PRAG-02): *an AI answer never cites or previews a document the asking
user cannot open.* The plan and its sequencing live only in `.planning/v3.4-STRETCH-CARRYFORWARD.md`,
and `CLAUDE.md` records that carry-forward files are swept by nothing. No seed held it until now.

Why it was deferred, and why that was correct: retrieval runs under the asking user's RLS context
(Phases 163/164), so today a citation can only point at a document the user can already open. The leak
is latent. It becomes reachable when a document can be **retrievable in the user's context but not
openable by them**.

Two things have moved towards that point since v3.4 (measured 2026-10-04):
- `IngestVisibility = Literal["private", "org", "dept"]` (`backend/app/models/connector.py:441`). `dept`
  is inert by decision today (`frontend/src/lib/api/org.ts:531`), but it exists.
- Synced documents marked `unauthorized_at_source` (revoked at the source) are still retrievable: search
  only excludes `source_disconnected` (`retrieval_scope.py:151`, mig `200`). That is a document the asker
  could not open at its source, still cited in-app. See SEED-210.

## Why it matters

A citation or preview of a restricted document leaks its title and a snippet even when the answer text is
careful. This is the finding that ends an enterprise security review, and it cannot be retrofitted cheaply
once sharing is live.

## When to surface

Before any department/role folder sharing, per-document sharing, or live `dept` visibility ships; or
whenever a document becomes retrievable but not openable. This must land in the same milestone as that
sharing feature, or earlier.

## Scope estimate

Medium, research-gated (from the carry-forward): a leak threat model plus a pgvector + RLS latency/recall
benchmark first, then a guard at answer-assembly time that filters citations and previews to the asker's
openable set. Do not fork the shared Deep path; cross-provider proof required (citations are shared-path).

## Breadcrumbs

- `.planning/v3.4-STRETCH-CARRYFORWARD.md` lines 28-36
- `docs/history/v3.4-multi-tenancy-and-org-access.md` (Gaps: "171 in particular must land before any finer-grained cross-user document sharing ships")
