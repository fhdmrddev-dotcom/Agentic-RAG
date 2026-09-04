# Phase 210: Ground Truth — Operability & Failure Honesty - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 210-ground-truth-operability-and-failure-honesty
**Areas discussed:** live_connectors toggle UX & type union, Scheduler-off honesty & creation behavior, Default scheduled-run token budget & cancellation surfacing, RAG-09 embedding provider error propagation & health surfacing

---

## live_connectors toggle UX in Control Room & Type Union (CONN-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Restrict to On/Off (Everyone vs Off) | Clean On/Off toggle in Control Room, since execution engine requires audience == "everyone" for live sends | ✓ |
| Multi-Audience Selector | Support standard 4-way Audience selector (Everyone / Operators / Role / Off) with an explanatory note | |

**User's choice:** Restrict the `live_connectors` card to a clean On/Off (Everyone vs Off) toggle in Control Room, since the execution engine requires "everyone" for live sends.
**Notes:** Added `"live_connectors"` to `GovernedFeature` union in `_core.ts`, updating exhaustive `Record<GovernedFeature, ...>` maps across frontend and retiring `liveConnectorsOnFrom` interim reader in `connectionsCopy.ts`.

---

## Scheduler-Off Honesty & Creation Behavior (CONN-10 Part A)

| Option | Description | Selected |
|--------|-------------|----------|
| Non-blocking honest UI | Expose scheduler daemon status via API, show clear "Scheduler Daemon: Disabled" warning banner in modal & list, allow creation/viewing and manual trigger | ✓ |
| Strict refusal | Return 400 Bad Request on schedule creation if daemon is disabled | |

**User's choice:** Non-blocking honest UI: Expose scheduler status via API, show a clear "Scheduler Daemon: Disabled" warning banner in the Schedules modal & list, but allow creating/viewing and manual triggering.
**Notes:** Follows the established tri-state honesty discipline without blocking legitimate "configure now, enable at deploy" or manual trigger use cases.

---

## Default Scheduled-Run Token Budget Calibration & Cancellation Surfacing (CONN-10 Part B)

| Option | Description | Selected |
|--------|-------------|----------|
| 500,000 tokens & 1,800s duration | 10x current, calibrated for multi-step RAG workflows with headroom below 2M ceiling, 30 min duration limit | ✓ |
| 1,000,000 tokens & 3,600s duration | 20x current, maximum headroom for heavy multi-agent synthesis, 60 min duration limit | |
| 250,000 tokens & 900s duration | 5x current, conservative increase, 15 min duration limit | |

**User's choice:** 500,000 tokens (10x current, calibrated for multi-step RAG workflows with headroom below 2M ceiling) and 1,800s (30 min) duration limit.
**Notes:** Synchronize backend `models/schedule.py` and frontend `WorkflowScheduleModal.tsx`. Extract and surface structured circuit-breaker cancellation reasons in workflow run views instead of bare "cancelled".

---

## RAG-09 Embedding Provider Error Propagation & Health Surfacing (RAG-09)

| Option | Description | Selected |
|--------|-------------|----------|
| Comprehensive propagation & surfacing | Propagate structured provider error up through tool execution & harness so gates report explicit provider failure ({provider}: {reason}), and surface embedding health in Control Room / API vitals | ✓ |
| Gate-only update | Update validator_kinds and tool_dispatcher to report honest gate error copy without adding new health tiles | |

**User's choice:** Propagate structured provider error up through tool execution & harness, so gates report explicit provider failure with provider name & reason, and surface embedding health in Control Room / API vitals.
**Notes:** Solves `BUG-260815-05` by ensuring that vector search failures never collapse into "nothing was retrieved (0 sources)".

---

## Claude's Discretion

- Styling and exact warning badge palette for scheduler-disabled notices following Aether theme.
- Error taxonomy integration with `classify_provider_error` for embedding providers.

## Deferred Ideas

- Embedding fallback providers & re-indexing (SEED-048 / SEED-165).
- Fine-grained per-tool approval posture (Phase 213).
