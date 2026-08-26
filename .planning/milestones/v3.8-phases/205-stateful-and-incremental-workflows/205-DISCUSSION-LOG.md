# Phase 205: Stateful & Incremental Workflows - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-24
**Phase:** 205-stateful-and-incremental-workflows
**Areas discussed:** Prior Run Resolution & Cold-Start Baseline, State Injection & Execution Context, Delta Structure & Deliverable Presentation, Authoring Controls & Workflow Studio

---

## Prior Run Resolution & Cold-Start Baseline

| Option | Description | Selected |
|--------|-------------|----------|
| Most recent completed run for same definition + user/org | Query most recent `completed` run for exact definition_id and owner; prior_run is None on cold-start (treats items as initial/new) | ✓ |
| Cross-version most recent completed run | Track state across all published versions sharing the same slug | |
| Explicit parent run linking | Require manual or input-specified parent run UUID | |

**User's choice:** Most recent completed run for the same published definition + user/org; prior_run is null on first run (treats all items as baseline/new).
**Notes:** Failed and cancelled runs are skipped to prevent corrupting state.

---

## State Injection & Execution Context

| Option | Description | Selected |
|--------|-------------|----------|
| Automatic template variable injection | Injected as `{{prior_run.output}}`, `{{prior_run.id}}`, `{{prior_run.created_at}}` with defensive jsonb deserialization | ✓ |
| Dedicated tool fetch | Tool `get_prior_run_output` invoked on demand by steps | |
| Global system prompt injection | Automatic context block prepended to system instructions without template vars | |

**User's choice:** Automatic template injection via `{{prior_run.output}}` and optional context block in phase prompts, with safe jsonb deserialization.
**Notes:** Anti-trap defenses ensure string scalars and dicts are parsed safely without asyncpg double-encoding issues.

---

## Delta Structure & Deliverable Presentation (STATE-02)

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown summary with status badges + structured payload | Standard badges (`[NEW]`, `[UPDATED]`, `[RESOLVED]`) in markdown + structured `deltas` JSON block in output | ✓ |
| Deterministic JSON diff engine | Backend computes structural diff table automatically | |
| Freeform LLM narrative | No standardized badge conventions | |

**User's choice:** Standardized Markdown summary with status badges (`[NEW]`, `[UPDATED]`, `[RESOLVED]`) plus structured `deltas` in output payload.
**Notes:** Delivers human-readable diff reports alongside machine-readable structured JSON.

---

## Authoring Controls & Workflow Studio

| Option | Description | Selected |
|--------|-------------|----------|
| Workflow-level toggle + variable chips | "Stateful / Living Register Mode" toggle on definition settings + `{{prior_run.output}}` chips in prompt editor | ✓ |
| Implicit (always available) | All workflows have prior run available without a toggle | |
| Phase-level toggle | Each phase individually configures prior run loading | |

**User's choice:** Workflow-Level toggle ("Stateful / Living Register Mode") in Settings + `{{prior_run.output}}` variable chips in the phase prompt editor.

---

## Claude's Discretion

- Index creation on `workflow_runs(definition_id, user_id, status, created_at DESC)`.
- Precise UI layout for the stateful toggle inside Workflow Studio settings sheet.

## Deferred Ideas

- Cross-version state tracking across different workflow slugs (candidate for future workflow chaining milestones).
