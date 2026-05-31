# Phase 092: Dual-Mode Wiring + Continue Button - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 092-dual-mode-wiring-continue-button
**Areas discussed:** Start & pick a workflow, General/Explorer during a run, Continue button (cap & placement), Cancel & lock feedback

---

## Start & pick a workflow

### Enter Harness Mode + choose a workflow

| Option | Description | Selected |
|--------|-------------|----------|
| Toggle + workflow picker | Deep/Harness toggle near agent-mode selector; choosing Harness reveals a dropdown of published workflows | ✓ (recommended) |
| Workflow picker only | One 'Run a workflow…' dropdown; selecting one IS entering Harness | |
| Slash command | `/workflow <name>` in the composer | |

**User's choice:** Asked Claude to recommend → Toggle + workflow picker (D-01).
**Notes:** Mirrors the existing General/Explorer selector pattern; keeps mode explicit.

### Kickoff input

| Option | Description | Selected |
|--------|-------------|----------|
| Next chat message = the input | Pick workflow, type prompt, send → that prompt is the workflow input | ✓ (recommended) |
| Dedicated inputs form | Selecting a workflow opens a typed-fields form + Start | |
| Auto-start, no input | Selecting immediately starts a self-contained workflow | |

**User's choice:** Asked Claude to recommend → Next chat message = the input (D-02).
**Notes:** Matches "mode takes effect on the NEXT run"; naturally persists `workflow_runs.inputs` + `model` (closes SEED-047). Auto-start rejected — seed templates need a topic.

---

## General/Explorer during a run

| Option | Description | Selected |
|--------|-------------|----------|
| Disable + tooltip | Visible but greyed/disabled with "Controlled by the active workflow"; re-enables when run ends | ✓ (recommended) |
| Hide until run completes | Remove the selector entirely while a workflow runs | |
| Leave visible & active | Keep interactive; changes queue for next Deep run | |

**User's choice:** Disable + tooltip (D-03).
**Notes:** Roadmap explicitly flagged this as the discuss-phase call. Disabling avoids layout jump and is honest that the setting still exists but is moot mid-run.

---

## Continue button (cap & placement)

### Continue cap

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 3 per run | Up to 3 Continues, each a fresh bounded budget; track `continues_used` | ✓ (recommended) |
| Unlimited | No ceiling | |
| 1 Continue only | A single Continue then stop | |

**User's choice:** Cap at 3 per run (D-06).
**Notes:** SEED-029 §4 recommendation; safety valve against runaway loops while covering legit long tasks.

### Continue UI placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in chat (075.4 system-message carrier) | Extend the iteration-cap system message into an actionable Continue card | ✓ (recommended) |
| In the workspace panel | Surface Continue in the right-side panel | |
| Both chat and panel | Show in both places | |

**User's choice:** Inline in chat (D-07).
**Notes:** Least new surface; SEED-029 §3 path; avoids coupling 092 to unbuilt Phase 094 panel. Keep additive vs Phase 095 chat-card unification.

---

## Cancel & lock feedback

### Cancel mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the existing Stop button | Same Stop control cancels; backend clears `active_workflow_run_id` in the terminal-status txn | ✓ (recommended) |
| Separate 'Exit workflow' button | Distinct workflow-specific cancel | |

**User's choice:** Reuse the existing Stop button (D-04).
**Notes:** One familiar control; backend clears the lock in the SAME transaction as terminal write (SC#2).

### Lock feedback on refused Deep switch

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled toggle + tooltip | Greyed toggle, "Workflow running — Cancel to switch back"; server refusal is the backstop | ✓ (recommended) |
| Active toggle + toast on refusal | Clickable; server refuses and shows a toast | |

**User's choice:** Disabled toggle + tooltip (D-05).
**Notes:** Consistent with D-03; client disable is courtesy, server-side refusal at run creation (SC#2) remains authoritative.

## Claude's Discretion

- Toggle/picker component shape + placement (follow agent-mode selector idiom).
- Continue API surface: reuse `POST .../resume` with a flag vs new `POST .../continue` (SEED-029 §2 prefers reuse) — planner decides vs the 091 resumability surface.
- New run-lifecycle status value(s) for cap-paused (reconcile vs Phase 066 enum + 091 statuses).
- Tooltip/stop-message copy.
- `GET /threads/{id}/workflow` response shape.

## Deferred Ideas

- Dedicated structured inputs form (only if a future workflow needs typed multi-field inputs).
- Continue in the panel timeline (Phase 094).
- Per-user/per-org Continue quota (v3.0+ multi-tenancy).
- Continue telemetry dashboard (later analytics).
- Restart-mid-workflow kill-and-resume verification (Phase 096 / EVAL-02).
</content>
