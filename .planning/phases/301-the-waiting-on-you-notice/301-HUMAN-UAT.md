---
status: partial
phase: 301-the-waiting-on-you-notice
source: [301-VERIFICATION.md, 301-VALIDATION.md]
started: 2026-10-30T22:45:00Z
updated: 2026-10-30T23:30:00Z
---

## Current Test

2 — G4-4 stopped-source + keyboard arm (SC#4 operator approval received 2026-10-30).

## Tests

### 1. SC#4 — built control matches sketch 301 winner A
Open `.planning/sketches/301-waiting-on-you/index.html` (serve `.planning/sketches`) beside the app at `/app`:
collapsed + expanded rail, the open list with rows in two orgs, the empty line, the phone drawer row.
Two documented departures from the sketch: the rail icon stays neutral (only the count pill is amber, UI-D3);
"· scheduled" / "· started by an API key" are shown (D-28 restored them).
result: PASS — operator replied "approved" in chat, 2026-10-30 (sketch winner A accepted with both departures).

### 2. G4-4 — stopped source beside waiting runs, and the D-26 keyboard path
With a stopped watched source present: Library badge counts only the source; the waiting count is separate;
the Library popover's "Open Library health" is reached with arrow keys + Enter (BUG-261029-01).
result: owed (no stopped source on the local box; unit-proven)

### 3. G4-3 arm 3 — real network drop
DevTools offline on one tab, answer a run in another, go back online: the count corrects on reconnect.
result: owed (manual realtime disconnect leaves channels closed, so it cannot stand in)

### 4. Live "needs your approval" row
Needs a published workflow with an ARMED action-risk checkpoint owned by the dev account; run it and the row
should read "needs your approval".
Tried 2026-10-30: Doc Q&A's "Wait for your approval" step is a human-input QUESTION (notice `kind = question`,
correct per D-04 — approval is only an action-risk checkpoint); "295-07 S7 armed email" is published but owned by
another user, so it refuses ("Workflow not found", 299 D-33). No `kind = approval` notice has ever been written
locally. Cheapest path: author + publish a one-step send_email (posture ask) workflow on the dev account.
result: owed (DB/unit-proven, D-34)

### 5. Moonshot cross-provider row
result: blocked — BUG-261024-01 (Moonshot balance)

### 6. One clean vitest count-gate run at HEAD
`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` on a quiet machine → `count gate OK`.
result: PASS 2026-10-30 — quiet-machine run at HEAD 4274b7367: "count gate OK — 577/577 pinned files present,
no per-file decrease, 0 failing." (The 3 earlier loaded runs each had one red in a different provably-unmodified
suite while other agents were running; base ran clean.)

## Summary

Driven and passed 2026-10-30: G4-1, G4-2, G4-3 arms 1-2, G4-4 phone arm, G4-5, cross-provider 7/8, MT-1,
PT-1, LM-1 (evidence in 301-VALIDATION.md).

## Gaps

None in code (VERIFICATION SC#1-3 verified).
