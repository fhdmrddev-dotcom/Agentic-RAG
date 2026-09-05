---
description: Arm the autonomous reciprocal-review pairing for a phase (builder/reviewer roles + bus watchers)
argument-hint: <phase> <claude|gemini>   e.g. "231 claude" — the named agent BUILDS
---

Arm the reciprocal-review pairing for phase **$ARGUMENTS**.

Do these in order:

1. Run `bash scripts/arm-pair.sh $ARGUMENTS` and read its output.
   - If it exits non-zero (bad usage), show the usage line and stop.
   - It prints the role assignment, each side's watcher command, both briefing
     lines, and posts the assignment to the reviewer on the bus.

2. **If Claude is the REVIEWER on this phase**, arm your own mailbox watcher via
   the **Monitor** tool, `persistent: true`:
   `bash scripts/agent-bus-watch.sh claude 30`
   First check whether such a monitor is already running — do not start a second one.

3. **If Claude is the BUILDER on this phase**, do NOT start building yet.
   `AGENTS.md` §6.1: the reviewer must capture baselines BEFORE the builder
   touches anything, or the baseline measures the change against itself. Say
   plainly that source work is blocked until Gemini confirms baselines, and note
   that docs-only work (discuss, plan, threat model) is safe meanwhile.

4. Reply to the operator with, in this order:
   - one line naming builder and reviewer;
   - **the REVIEWER briefing block, verbatim and in a fenced code block**, clearly
     labelled as the thing to paste to the other agent — this is the only manual
     step in the whole flow, so make it impossible to miss;
   - what you are doing next, and anything you are blocked on.

Keep the reply short. The operator wants the paste block and the next action, not
a recap of the protocol.
