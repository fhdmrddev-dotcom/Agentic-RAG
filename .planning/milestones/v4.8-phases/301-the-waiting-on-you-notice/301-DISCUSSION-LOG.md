# Phase 301: The Waiting-on-You Notice - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-29
**Phase:** 301-the-waiting-on-you-notice
**Mode:** `--auto` (operator: "continue autonomously end to end"); recommended option selected each time.
**Areas discussed:** Badge placement, The list, Registry second tenant, Freshness, Exclusions, Guardrails

---

## Badge placement

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated rail control near the top | Always present, count when > 0, every view | ✓ |
| Mark on the identity/avatar footer | Fewer rail slots; hidden behind a menu | |
| Mark on the Workflows rail item | Reuses a slot; a schedule owner may never open Workflows | |
| Second count on the Library badge | Mixes two meanings; breaks the Library tab mark | |

**Choice:** [auto] dedicated rail control (D-01..D-03). Rail density bug left open (D-04).

## The list

| Option | Description | Selected |
|--------|-------------|----------|
| Popover on the DropdownMenu primitive, flat, waited-longest-first, org on every row | Same primitive as AttentionPopover/ProfileMenu | ✓ |
| Grouped by org | Heavier; org already on each row | |
| Full page | A new view for a short list | |

**Mark-read:** [auto] none — a notice leaves only when the wait ends (D-09). Deferred.

## Registry second tenant

| Option | Description | Selected |
|--------|-------------|----------|
| Second `ATTENTION_PRODUCERS` tenant, re-baseline pins to 2, per-condition `mark` partition | ROADMAP-mandated; one read in ChatLayout | ✓ |
| A separate hook and surface outside the registry | The "second surface beside this one" the registry exists to prevent | |

## Freshness

| Option | Description | Selected |
|--------|-------------|----------|
| Realtime on `notifications` (mig 219) as a hint + refetch on event/reconnect/focus/org-switch + 60 s poll | D-v2.5-03 | ✓ |
| Poll only | Fails SC#1 "without reloading" latency | |
| Realtime payload patches local state | Realtime as truth — a named failure | |

## Exclusions

**Choice:** [auto] chat `ask_user` excluded by the 218 trigger, pinned by a DB test (D-19); schedule/key runs
included via owner (D-20).

## Guardrails

**Choice:** [auto] G-2 sketch self-picked, recorded override, operator at G-4 (D-21); G-5 honoured by
construction (D-22); G-8 three plans (D-23); G-4 scenarios set at scope time (D-24); four-axis (D-25).

## Claude's Discretion

Words, icon, poll interval within 30-120 s, helper module names, optional count-only mode.

## Deferred Ideas

Mark-read/dismiss/snooze; push/desktop notifications; owner-facing email-failure line; rail IA
reorganisation (BUG-260923-01); hoisting attention readers into a provider.
