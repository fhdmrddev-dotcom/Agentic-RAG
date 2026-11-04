# Phase 308: Told by Webhook - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-04
**Phase:** 308-told-by-webhook
**Areas discussed:** Event catalogue and recipients, In-app notice home, Member screen placement, Admin placement, Test event shape, Secret display
**Mode:** auto — the operator ran `/gsd:discuss-phase 308 continue autonomously end to end`. No AskUserQuestion was asked; Claude took the recommended option at every gray area (memory: `feedback_delegates_gsd_phase_end_to_end`).

---

## Event catalogue and recipients

| Option | Description | Selected |
|--------|-------------|----------|
| Run events to the run's owner only; documents fanned out to every org member who can see them, decided at drain time | Fan-out in the drainer, never in the trigger; the log can never list an invisible item | ✓ |
| Fan out everything to every endpoint in the org, skip invisible items at send | Skipped rows would leak item ids into a member's log | |
| Visibility computed inside the trigger | Re-implements RLS in plpgsql; a second visibility path | |

**Choice:** first row (D-01..D-04, D-26).
**Notes:** `cap_paused` counts as waiting (needs a person). Failed ingests are not an event in v1 (deferred).

## In-app notice home (auto-disable)

| Option | Description | Selected |
|--------|-------------|----------|
| New kind on 300/301 `notifications`, shown in "Waiting on you" | One home for "the app tells you something"; needs nullable `run_id` | ✓ |
| A banner only on the Webhooks tab | Owner never sees it unless they open Settings | |
| A new notices table | A second home for the same concern | |

**Choice:** first row (D-19), with a research check that every 300/301 reader tolerates a null `run_id`.

## Member screen placement

| Option | Description | Selected |
|--------|-------------|----------|
| New Settings tab "Webhooks" (one mount) | Room for the delivery log; matches the ROADMAP's "one mount" flag | ✓ |
| A section inside the API keys tab | Zero SettingsPage edits, but crowds the key screen | |

**Choice:** first row (D-28). BUG-260923-01 (tab crowding) noted, not folded.

## Admin placement

| Option | Description | Selected |
|--------|-------------|----------|
| Section inside `OrgApiKeysTab` | The 307 `OrgConnectedApps` precedent; no edit to the FIRING shell | ✓ |
| New org-admin tab | Touches `OrgAdminShell.tsx` (11 / 7, FIRING) | |

**Choice:** first row (D-30).

## Test event shape

| Option | Description | Selected |
|--------|-------------|----------|
| Synchronous, same signer and egress path, recorded in the log | Immediate verdict on screen | ✓ |
| Through the outbox, UI polls the log | Slower feedback; no extra safety | |

**Choice:** first row (D-29).

## Secret display

| Option | Description | Selected |
|--------|-------------|----------|
| Show once at create and roll | The 304 key pattern | ✓ |
| Reveal on demand | Possible (reversible cipher) but widens exposure | |

**Choice:** first row (D-12).

## Claude's Discretion

Poll intervals, batch size, lease length, table / column names, attempts as child table vs JSON, UI layout (sketch + UI-SPEC).

## Deferred Ideas

`document.failed` event; webhook kill switches (operator / org); org-owned endpoints; replay; ed25519; event filters; custom headers; batching; tunable retry schedule and overlap; reveal secret; disable email.
