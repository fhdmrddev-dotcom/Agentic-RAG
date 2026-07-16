---
status: partial
phase: 155-accessibility-sweep-wcag-aa
source: [155-VERIFICATION.md]
started: 2026-07-16
updated: 2026-07-16
---

## Current Test

[awaiting human/live-browser verification — the manual keyboard-AA half + live contrast/button-name scan]

## Tests

### 1. Deep Midnight look preserved after the full muted-token sweep (D-07 full-app)
expected: The app-wide opacity-modifier sweep (155-07, 27 files) still reads "quiet muted" on Chat, Documents, Skills Studio, Settings, Control Room — not washed out. D-07's mid-execution eyeball only covered 2-3 representative pages before the full sweep landed.
result: [pending]

### 2. Live color-contrast scan (D-03): 0 failing contrast nodes on SEED-092 pages
expected: Chrome DevTools / Lighthouse contrast audit reports zero failing nodes on Chat, Documents, Control Room, Settings (dark theme; spot-check light).
result: [pending]

### 3. Live button-name scan (D-03): 0 failing button-name nodes app-wide
expected: A live DOM-rendered axe/Lighthouse button-name audit reports zero failing nodes on the SEED-092 pages.
result: [pending]

### 4. Keyboard scenario 1 — Launch a workflow run (D-09.1)
expected: Run modal → Tab through file-upload proxy button → keyboard folder scope → launch, all keyboard-only. No keyboard trap on the file input; visible focus indicator throughout; logical focus order.
result: [pending]

### 5. Keyboard scenario 2 — Navigate a cited answer (D-09.2)
expected: Tab to citation marker → open peek → pin → Esc (focus returns to marker) → open source document. No trap; Esc restores focus to the marker; all 3 D-10 invariants hold.
result: [pending]

### 6. Keyboard scenario 3 — Operate the Control Room (D-09.3)
expected: Reach /admin → switch tabs → flip a kill-switch through its arm-to-confirm guard → read the audit receipt, keyboard-only. Destructive-action guard fully keyboard-operable end-to-end; all 3 D-10 invariants hold.
result: [pending]

### 7. Keyboard scenario 4 — Settings + nav traversal (D-09.4)
expected: Collapse/expand nav → reach every nav destination → flip the 154 "Show technical names" toggle, keyboard-only. All destinations reachable; toggle operable; all 3 D-10 invariants hold.
result: [pending]

### 8. Accessible names on every interactive control (D-11), via live DevTools a11y tree
expected: Every interactive control across net-new surfaces has a non-empty accessible name.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
