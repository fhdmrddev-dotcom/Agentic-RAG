---
id: BUG-260826-01
title: An external_action send_email step can never receive `to` / `subject` from any UI launch path
reported: 2026-08-26
surface: Agentic-RAG
severity: blocking
status: closed
affected_areas: [backend/connectors, backend/harness, frontend/workflows, frontend/chat]
folded_into: 214
verified_closed_by: 214.1 # ✅ operator-driven 2026-08-28 18:00 — run inputs carried {topic:"test", to:"fhdmrd@gmail.com"} from a library launch
related_seeds: [SEED-164]
re_open_trigger: null
reproduces_on:
  branch: production (also master / claude-new-session-hwm1mh)
  commit: 386b5a4
  date: 2026-08-26
---

# BUG-260826-01: A `send_email` step can never receive its arguments from any UI launch path

## What we observed

With `live_connectors` turned on and a verified Gmail SMTP connection bound, every run of a
workflow whose last step is an `external_action` / `send_email` fails at that step with:

```
SEND FAILED — nothing arrived.
the 'to' recipient must be a string, got NoneType
```

Reproduced three times on 2026-08-26 (runs `e2c0db68`, plus two earlier), each via a different
door: the Builder's **Test Run**, a **chat** launch, and the library **Run** control.

The adapter's argument resolution is:

| argument | source | result on every observed run |
|---|---|---|
| `body` | auto-filled from the previous phase's text — `_adapter_args` (`phase_types.py:2136`) | present |
| `to` | a run input keyed exactly `to` | **absent → `None`** |
| `subject` | a run input keyed exactly `subject` | **absent** (masked; `to` is validated first) |

`to` and `subject` can only come from `ctx.inputs`, and every UI launcher writes a fixed bag:

- chat / Test Run / library Run all funnel through `sendMessage`, which hardcodes
  `inputs={"kickoff_prompt": body.content, ...folder_id}` (`api/threads.py:917`).
- `kickoff_prompt` is then *explicitly excluded* from action inputs by name
  (`_NON_ACTION_RUN_INPUTS`, `phase_types.py:1851`), so it cannot be used as a smuggling route.
- The step's own panel exposes no argument fields; `ExternalActionPhaseConfig` deliberately
  carries none for the native capabilities.
- Declaring `WorkflowDefinition.inputs[]` does not help: `RunModal` renders declared input keys
  as a **hint line only** — *"never fake structured fields"* (`RunModal.tsx:552`).

Confirmed against the DB — the three most recent `workflow_runs` rows all carry
`{"kickoff_prompt": "..."}` and nothing else.

**The only path that can supply the arguments** is a scheduled run:
`WorkflowScheduleCreate.inputs` is a free-form `dict[str, Any]` (`models/schedule.py:151`) that
`scheduler_service.py:128` spreads into `workflow_runs.inputs`. That path is API-only — the
Schedule modal itself sends only `{kickoff_prompt}` (`WorkflowScheduleModal.tsx:195`) — and it
requires the workflow to be published.

## Why it matters

Blocking. `send_email` is a shipped, operator-gated capability with a working transport (the SMTP
adapter reached Gmail, authenticated, and was rejected only on credentials during testing — the
connector itself is sound). But **no route a user can take through the product will ever produce a
successful send.** The feature is reachable, configurable, billable in run time, and structurally
incapable of succeeding.

The failure is also expensive and late: it surfaces only after the upstream phases have run (2–3
minutes of real LLM spend in the observed runs), because argument validation happens inside the
adapter rather than before the run starts.

`create_ticket` and `post_message` share the identical resolution path and are presumed to have
the same defect — untested here.

## Hypothesized cause

**Hypothesis, not verified by a fix.** The gap looks structural rather than accidental: run inputs
were designed as a launch bag (`kickoff_prompt` + `folder_id`), and Phase 190 attached adapter
arguments to that bag without giving any launcher a way to author them. D-09 explicitly forbids a
templating/expression surface, so there is no derivation path either.

Notably **the natural home already exists in the data model**: `ExternalActionPhaseConfig.tool_args`
(`models/harness.py:319`) is a persisted, validated `dict[str, Any]`. The **MCP** branch reads it
(`phase_types.py:2506`); the **native adapter** branch does not — `_adapter_args` consults only the
run inputs plus the upstream text.

## Surface classification

`Agentic-RAG` — this app's own workflow/connector surface.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** a dedicated small phase; see the two shapes below
- **Plant as seed:** n/a (this is a defect, not a deferred idea)
- **External — note only:** no

Two candidate shapes, not mutually exclusive:

1. **Author-time (smallest).** Have `_adapter_args` merge `phase.config.tool_args` for native
   capabilities, mirroring the MCP branch. Roughly two lines in the executor; the field, its
   validation and its persistence already exist. Then give the step panel real `To` / `Subject`
   fields on top of it. Correct when the recipient is a fixed address.
2. **Launch-time.** Have `RunModal` render declared `inputs[]` as real fields and carry them into
   the launch bag. Correct when the recipient varies per run — which is what the observed step's
   own name ("Email the briefing to **the requester**") implies was intended.

Pair either with BUG-260826-02 so an unsatisfiable send step cannot publish.

## Workarounds (prompt-side, code-side, or UI-side)

Publish the workflow, then create a schedule carrying the arguments and trigger it manually:

```
POST /workflows/{workflow_id}/schedules
{"name":"…","interval_seconds":86400,"is_active":false,
 "inputs":{"kickoff_prompt":"…","to":"someone@example.com","subject":"…"}}

POST /schedules/{schedule_id}/trigger
```

`POST /schedules/{id}/trigger` runs it immediately without advancing the cadence, and does not
consult `is_active`. Console-only, per-schedule, and not something to hand to a colleague.
See BUG-260826-03 — the trigger 500s if the schedule's `org_id` is NULL.

Constraints on `to` (`smtp_adapter.py:126`): exactly one recipient, bare `local@domain`, no display
name, no commas, no control characters. Anything `parseaddr` has to normalise is refused.

## Reference / evidence links

- `backend/app/services/harness/phase_types.py:2118-2138` — `_adapter_args`
- `backend/app/services/harness/phase_types.py:1854-1900` — `_external_action_inputs`
- `backend/app/services/connectors/smtp_adapter.py:126-192, 293-310` — envelope validation + `INPUT_SCHEMA`
- `backend/app/api/threads.py:917` — the hardcoded launch bag
- `frontend/src/pages/WorkflowsPage.tsx:907` — Test Run reuses `onLaunch`
- `frontend/src/components/workflows/library/RunModal.tsx:552` — declared inputs render as a hint only
- `backend/app/models/harness.py:319` — the unused-on-native `tool_args`

## Phase 214 close (plan `214-15`, 2026-08-28) — why this stays `folded` and is NOT `closed`

**Both halves shipped, and they are in different plans.** The launcher forms are `214-09`
(library modal + schedule door) and `214-12` (chat, plus the one shared `LaunchInputFields`
renderer); **the wire** is `214-16`, whose integration suite
`backend/tests/integration/test_214_launch_inputs_wire.py` drives a REAL `POST` and reads
`workflow_runs.inputs` back out of Postgres. The argument leaf is `214-01`.

⛔ **`verified_closed_by` stays `null` because no operator has driven G4-3 on all three doors.**
A bug closed on a green gate rather than a drive is `T-214-15-05`, and it is the exact shape
Phase 212 shipped: green gates, then the operator found two more defects. **Two doors out of
three is still `folded`, with the un-driven door named.** Flip to `closed` with
`verified_closed_by: 214` only when G4-3 in `214-UAT.md` reads a driven verdict for library,
thread AND schedule.

⚠ **One measured hazard remains inside this bug's own subject matter and is NOT closed by it:**
an `upstream` argument source is INERT on native capability rows — `send_email`'s `subject`
sourced `upstream(draft)` is silently DROPPED and `body` falls back to the latest phase's text
(`SEED-217`). That threatens SC#2 and would be visible in exactly the G4-2/G4-3 drive above.
