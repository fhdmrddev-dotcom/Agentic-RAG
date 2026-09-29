---
seed_id: SEED-328
title: Phase 267 independent-review warnings WR-01..WR-08, info IN-01..IN-05 and the deferred CR-03(b) org guard on send — accepted and deferred
created: 2026-09-29
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: "any phase whose files_modified names run_producer.py, threads.py send/handoff paths, ChatArea.tsx, StreamsProvider.tsx, expert_scope.py or the Expert catalog; OR the operator extracts one shared org-equality helper for PATCH, handoff and preview"
trigger_paths: ["backend/app/services/run_producer.py", "backend/app/api/threads.py", "backend/app/services/expert_scope.py", "backend/app/api/experts.py", "frontend/src/components/chat/ChatArea.tsx", "frontend/src/providers/StreamsProvider.tsx", "frontend/src/components/experts/catalog/**"]
trigger_surfaces: []
migration_note:
relates_to: ["267", "267-REVIEW-INDEPENDENT.md", "267-FIX-CR02-CR03-SUMMARY.md", "SEED-303", "SEED-327"]
folded_into: null
renumbered_from: null
renumbered_because: null
---

# SEED-328: Phase 267 independent-review items accepted and deferred

## The finding

The independent review of 267 (`267-REVIEW-INDEPENDENT.md`) found 3 Critical, 8 Warning, 5 Info. CR-02 and CR-03 (a)(c)(d) were fixed and live-driven (commits `a95a19881`, `0cbf5d282`, drive `04ef22692`); CR-01 is SEED-327. Deferred here, explicitly accepted, full text in the review file:

- **CR-03(b)** — 409 before any run when `threads.org_id != active org` on an Expert thread. Not done because it adds a new send-path branch (268's "0 new send-path branches"); the route is ONE shared org-equality helper for PATCH / handoff / preview (also IN-01), then a one-line call. Effect today: a two-org user with the wrong org active has the Expert cleared at send — now stated in the transcript and on the chip.
- **WR-01** handoff while a run is streaming · **WR-02** no concurrency guard on the Expert-change write (two quick swaps can record "A → C") · **WR-03** restricted narrowing never stated in two states · **WR-04** "Won't use · 4" contradicted by history and the handoff summary · **WR-05** handoff summary (untrusted text) becomes a user message · **WR-06** chat Expert hydration never clears on failure · **WR-07** catalog Start Chat error always says "Check your connection" · **WR-08** folder-scope prompt names only the Expert's first folder.
- **IN-01..IN-05**, plus observations from the CR-02/03 live drive: the default `GET /experts` hides disabled Experts from managers (only `?for_management=true&enabled_only=false` shows them); the refused message stays unanswered in history and the next plain run answers it too; the swap card's "DROPPED" line over-states a restricted → restricted swap (SEED-303).

## Why it matters

None is a data leak. WR-05 and WR-04 are the trust-relevant ones; the rest are correctness and honesty of copy.

## When to surface

The trigger conditions above.

## Scope estimate

Medium as a batch; each item is small. Extract the org-equality helper first — it unlocks CR-03(b) and IN-01 together.
