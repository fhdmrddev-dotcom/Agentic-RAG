---
seed_id: SEED-391
title: Six minor 296 code-review info findings left for v4.8 (judge freshness, publish-note wording, Moonshot recursive $ref, 409 wording, two a11y names)
created: 2026-10-27
surface: Agentic-RAG
status: answered
partial: false
status_note: >
  Answered by Phase 302 (302-02): six findings fixed, each RED-first — see the table below.
  Previous status line, verbatim: `status: folded` (folded_into "302" at 302 discuss); the previous
  status_note was empty. trigger_paths corrected 2026-10-30 (302 REG-08, RESEARCH F9): the FE-IN-06 entry
  named frontend/src/components/workflows/WorkflowCanvas.tsx, but the Team region and figure live in
  TeamPicture.tsx / teamVocabulary.ts, so those replace it; schema_moonshot.py (BE-IN-04) and
  StreamsProvider.tsx (FE-IN-01's lock code) are added.
trigger_when: The next phase whose files_modified names any listed file, or /gsd:new-milestone for v4.8.
trigger_paths: ["backend/app/services/harness/validator_kinds.py", "backend/app/services/harness/publish_service.py", "backend/app/services/provider_gateway/openai_compat.py", "backend/app/services/provider_gateway/schema_moonshot.py", "frontend/src/components/chat/useStartWorkflowInThread.ts", "frontend/src/providers/StreamsProvider.tsx", "frontend/src/components/workflows/DescribeTemplateRow.tsx", "frontend/src/components/workflows/TeamPicture.tsx", "frontend/src/components/workflows/teamVocabulary.ts"]
trigger_surfaces: ["workflow", "chat", "a11y"]
migration_note:
relates_to: ["296-REVIEW.md triage: BE-IN-01, BE-IN-03, BE-IN-04, FE-IN-01, FE-IN-04, FE-IN-06"]
folded_into: "302"
renumbered_from: null
renumbered_because: null
---

# SEED-391: Six minor 296 review info findings

Each is a one-line item; full text and file:line in `.planning/phases/296-close-v4-7-debt/296-REVIEW.md` (IDs prefixed BE-/FE-).

- **BE-IN-01** — the judge's "recorded by design" note reads `live_connectors` without the executor's freshness check, so it can contradict the executor within the cache TTL.
- **BE-IN-03** — the publish note says the practice run had no example for Look-it-up / file inputs, which are never asked for.
- **BE-IN-04** — on a Moonshot endpoint one recursive `$ref` in any tool schema raises a bare `ValueError` and fails the whole request.
- **FE-IN-01** — every 409 on an in-thread start reads "already running" (false for the Expert org-mismatch 409; drops the paused-workflow guidance).
- **FE-IN-04** — disabled Word-blank ticks do not say why (a11y).
- **FE-IN-06** — the Team view's scroll region and figure share one accessible name (a11y).

## Answered 2026-10-30 — Phase 302 (302-02), per-finding disposition

Copied from `.planning/milestones/v4.8-phases/302-close-out-and-a-true-register/302-02-SUMMARY.md`. All six were real at the
302 base `cf5a463d4`; none was accepted.

| Finding | RED commit | Fix commit | Disposition |
|---|---|---|---|
| BE-IN-01 (judge vs executor liveness) | 968d0b84d | a1e542833 (+ 1afa59462 import line, 93441397c test_196 control) | fixed — one shared `live_connectors_fully_on()` predicate, same freshness read |
| BE-IN-03 (stand-in for unasked inputs) | 968d0b84d | a1e542833 | fixed — no example answer invented for an input the practice run never asks for |
| BE-IN-04 (Moonshot recursive $ref) | 968d0b84d | a1e542833 | fixed — bounded unroll (typed leaf, depth 8); unit-tested only, the live Moonshot row is still blocked (account suspended) |
| FE-IN-01 (every 409 read as "locked") | f9d06ab3c | 49a3a00c1 | fixed — the lock told by a code, paused by its prefix, anything else by the server sentence |
| FE-IN-04 (disabled tick, no reason) | a0f831efa | 09d642707 | fixed |
| FE-IN-06 (region and figure same name) | a0f831efa | 09d642707 (+ 09960aa0d 296 pin) | fixed |

Live re-drive of FE-IN-01's wording is 302 G4-3 (`302-VALIDATION.md`), owed.
