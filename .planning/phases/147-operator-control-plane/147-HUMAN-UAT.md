---
status: partial
phase: 147-operator-control-plane
source: [147-VERIFICATION.md]
started: 2026-07-11T00:00:00Z
updated: 2026-07-11T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Cross-provider active-runs + Kill (SC#10 axis 1)
expected: 4 concurrent runs (OpenAI/Anthropic/Google/OpenRouter, different users) each show the correct @lobehub provider mark, user, model, live-ticking elapsed and kind badge in the Control Plane. Killing each chat run: the victim sees exactly a self-cancel ("Response stopped"), no operator attribution in their chat (D-03); the ledger names the victim (D-02).
result: [pending]

### 2. Multi-tool run + mid-tool Kill (SC#10 axis 2)
expected: A run using 2+ tools in one prompt (e.g. search_documents + execute_code) appears once with an honest activity line; killing it mid-tool goes Cancelling… → Cancelled with no zombie left behind.
result: [pending]

### 3. Parallel-thread isolation during an operator Kill (SC#10 axis 3)
expected: Thread A (user 1) keeps streaming unaffected while the operator Kills a different user's run in Thread B; only B terminates; B's victim sees a self-cancel.
result: [pending]

### 4. Long-running / not-responding tags on a real card (SC#10 axis 4)
expected: A run left running past 8 minutes shows the long-running tag (client math); a genuinely stalled stream shows the not-responding tag (server-derived not_responding boolean).
result: [pending]

### 5. Capability kill-switch live enforcement, all four switches, each direction (SC#10 axis 5)
expected: Flipping web search / code sandbox / self-improve / workflows OFF stops that capability for a live chat within the ~30s TTL window: new runs never see the tool (hide), an in-flight call gets a plain "disabled by the administrator" refusal. Workflows OFF refuses a new Run button with plain copy while an in-flight workflow finishes. Flipping back ON recovers each capability. Exercise across providers.
result: [pending]

### 6. Maintenance mode live write-block + end-user banner (SC#10 axis 6)
expected: Flipping maintenance ON: an end user's write (send chat / upload) gets a 503 and the app-wide amber read-only banner appears; reads and self-cancel still work; PUT /admin/flags stays reachable throughout. Flipping OFF: writes recover and the banner clears.
result: [pending]

### 7. Zombie-heal honesty wording on a genuinely stuck run (SC#10 axis 7)
expected: Killing a run whose worker task has actually died (not just a normal live cancel) shows "recovered a stuck run" — never "killed" — in both the card and the audit ledger.
result: [pending]

### 8. Poll/visit ledger honesty over a real session (SC#10 axis 8)
expected: Opening the Control Plane, scrolling, leaving it open ~1 min, hiding the tab, and returning produces exactly ONE "Opened the Control Plane" ledger row (not one per poll); pinned vitals can visibly go amber/red mid-scroll on a poll; polling visibly pauses while the tab is hidden.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
