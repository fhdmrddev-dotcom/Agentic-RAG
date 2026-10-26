---
id: BUG-261021-04
title: In the tab that followed a run to its end after an answer, the run's final answer never appears in the chat column until the thread is reopened
reported: 2026-10-21
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [frontend/streaming, frontend/chat, workflow/runs]
folded_into: "296"
verified_closed_by: null
related_seeds: [SEED-367]
re_open_trigger: "CLOSE when 296-HUMAN-UAT G-4 scenario 3 reads PASS with evidence (set status closed, verified_closed_by \"296\", re_open_trigger null). A FAIL routes back to its owning 296 plan under G-7."
fixed_by_commit: "296-04: RED e93dbecbb, GREEN fd59d0f19 (one guarded actions.reconcile(threadId) in subscribeProducerStream's onTerminal)"
reproduces_on:
  branch: develop
  commit: ff6501b92
  date: 2026-10-21
---

# BUG-261021-04: a followed run's final answer is missing from the chat column

## What we observed

Post-close agent drive of Phase 295 (`295-VALIDATION.md` → "Post-close agent drive", D-uat-01). Run `6b4afbc0`, workflow `295-07 S6 approve then wrap`:

1. In a new chat thread, "Run a workflow" started the run. Its approval card arrived in the Workspace panel.
2. Yes was sent in the panel. The panel followed the run and read `wrap — Complete` within 3 s (the 295-10 follow).
3. The chat column still showed only the user line `Run 295-07 S6 approve then wrap`. No answer appeared.
4. The DB held the assistant message (`origin harness`): `The person answered "Yes" to the approval question. …`.
5. A thread switch and back showed the answer, with `● Medium confidence` and `References · 12 sources`.

## Why it matters

The workflow says `produces: answer in chat`. The person answers, sees Complete, and gets no answer. They have to know to reopen the thread.

## Hypothesized cause

Hypothesis, not verified: the follow path's `onTerminal` in `StreamsProvider.tsx` re-reads the phase spine (`refreshPhaseSpineAfterStop`) but not the thread's messages, and the harness writes the final answer as a persisted message, not as stream deltas this subscription renders. Same path as BUG-261021-03's missing Unsourced mark.

## Surface classification

Agentic-RAG.

## Suggested routing

- **Fold into in-flight phase:** no. Phase 295 reached the G-7 gap-round cap.
- **Defer to future phase / milestone:** the next phase touching `StreamsProvider.tsx`. A message re-read on the followed run's terminal event may close this and BUG-261021-03 together. That is a G-3 fast fix only if the cause is confirmed first.
- **Plant as seed:** no
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Switch to another thread and back, or open the run page.
