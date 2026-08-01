---
status: partial
phase: 186-concurrency-autosave
source: [186-VERIFICATION.md]
started: 2026-08-01T21:20:00Z
updated: 2026-08-01T21:20:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Two tabs — same draft open in A and B; edit in A (let it autosave), then edit in B
expected: B shows the honest banner, stops writing, offers Reload (default) then Overwrite. A's content intact.
result: [pending]

### 2. Stale tab — leave B open, edit + save in A, return to B minutes later and type
expected: Same honest outcome. No silent overwrite, no retry storm.
result: [pending]

### 3. Publish race — start a publish in A, edit in B mid-gauntlet
expected: Publish refuses with the worded `draft_changed` verdict; the golden-run receipt still browsable; the spine shows a block, not 8 green pips.
result: [pending]

### 4. Publish hold, both halves of the flag — start a publish in A, then edit in A; repeat once with `visual_workflow_canvas` ON and once OFF
expected: Flag ON: "Publishing — changes will save when it finishes", edit flushes on resolution. Flag OFF: the manual sentence is on screen while the gauntlet runs and is GONE from the header once it ends, without ever having written anything. (Live observation point for WR-19/WR-20 residual honesty gaps.)
result: [pending]

### 5. Conflict-exit failure — reach the conflict banner (test 1), then go offline and press Reload
expected: The banner stays on screen with BOTH exits present and pressable, plus the extra line "We couldn't reach the server to reload...". Restoring the network and pressing Reload again succeeds and clears the banner.
result: [pending]

### 6. KB re-bind, three paths — bind/re-bind from NL-generated, forked starter, and Tweak fork
expected: The chip is a picker in all three; unbound reads the invitation sentence with no severity/code/tray row; binding persists through autosave and survives reload.
result: [pending]

### 7. Force a 422 mid-edit (invalid shape) and observe the save state
expected: "Not saved — ..."; the draft stays dirty; the leave guard fires on navigate-away.
result: [pending]

### 8. Chosen save then publish, flag OFF — with `visual_workflow_canvas` off, edit, press Save draft, then within that round trip open Publish and click the inner Publish button
expected: Both the outer trigger and the inner Publish button are disabled and show "Saving your last change — Publish will be ready in a moment" while the PATCH is outstanding. No golden run spent. Both controls re-enable the instant the save lands. (Live confirmation of CR-03's fix.)
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
