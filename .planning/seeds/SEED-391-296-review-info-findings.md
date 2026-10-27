---
seed_id: SEED-391
title: Six minor 296 code-review info findings left for v4.8 (judge freshness, publish-note wording, Moonshot recursive $ref, 409 wording, two a11y names)
created: 2026-10-27
surface: Agentic-RAG
status: planted
partial: false
status_note:
trigger_when: The next phase whose files_modified names any listed file, or /gsd:new-milestone for v4.8.
trigger_paths: ["backend/app/services/harness/validator_kinds.py", "backend/app/services/harness/publish_service.py", "backend/app/services/provider_gateway/openai_compat.py", "frontend/src/components/chat/useStartWorkflowInThread.ts", "frontend/src/components/workflows/DescribeTemplateRow.tsx", "frontend/src/components/workflows/WorkflowCanvas.tsx"]
trigger_surfaces: ["workflow", "chat", "a11y"]
migration_note:
relates_to: ["296-REVIEW.md triage: BE-IN-01, BE-IN-03, BE-IN-04, FE-IN-01, FE-IN-04, FE-IN-06"]
folded_into: null
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
