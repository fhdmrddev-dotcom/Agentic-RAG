---
seed_id: SEED-365
title: Citation checks have no per-user rate limit, and 294-REVIEW left six small info findings
created: 2026-10-20
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: Any phase touching the citation-check service or route, the rerank engines, or decision-engine spend; or before Jev / OpenAI Decisions is enabled for a paying org
trigger_paths: ["backend/app/services/citation_check_service.py", "backend/app/api/citation_checks.py", "backend/app/services/rerank_engines/**", "frontend/src/stores/citationCheckStore.ts", "frontend/src/components/chat/CitationCheckAction.tsx"]
trigger_surfaces: []
migration_note:
relates_to: ["294", "294-REVIEW.md WR-02", "294-REVIEW.md IN-01 IN-02 IN-03 IN-05 IN-06 IN-07 IN-08", "SEED-271"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-365: Citation checks have no per-user rate limit, and 294-REVIEW left six small info findings

## The finding

Phase 294's code review (`.planning/phases/294-decision-engine-rerank-and-citation-check/294-REVIEW.md`) raised these and the phase deferred them:

- **WR-02:** `POST /citation-checks/{message_id}` has no per-user rate limit or concurrency cap; the only dedupe is per message. Each check holds a shared threadpool worker for up to 30 s, so about 40 concurrent checks starve every blocking database call in that process. Re-checks can loop, billed to the org's keys. The cost lands only in `message_citation_checks.cost_usd`; no spend ledger sees it.
- **IN-01:** the Local engine's trace records the whole CrossEncoder object as an input on every search.
- **IN-02:** LangSmith shows unknown token counts as 0.
- **IN-03:** the fault server cannot answer `choice` questions, so it can never drive a successful citation check.
- **IN-05:** an unknown engine id shows as Cohere in Settings but as off in search.
- **IN-06:** the chat's availability value is global and never refreshes after a 409.
- **IN-07 / IN-08:** claim sentences keep a stray space before punctuation; "Checking N citations…" counts sources, not claims.

## Why it matters

WR-02 is a cost and availability risk once a hosted engine is enabled for real users; nobody pays for it while the engines stay off by default. The info items are cosmetic or observability-only.

## When to surface

Any phase whose `files_modified` matches `trigger_paths`, or before Jev or OpenAI Decisions is switched on for a paying org.

## Scope estimate

Small to Medium: a per-user in-flight cap plus a spend-ledger row is Medium (it touches the spend path); the info items are each a few lines.
