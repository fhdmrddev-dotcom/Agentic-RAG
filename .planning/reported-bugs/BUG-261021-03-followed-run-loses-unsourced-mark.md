---
id: BUG-261021-03
title: In the tab that followed a "Continue without sources" run to its end, the step loses its Unsourced mark until the thread is reopened
reported: 2026-10-21
surface: Agentic-RAG
severity: minor
status: deferred
affected_areas: [frontend/streaming, frontend/panel, workflow/runs]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: "The next phase whose files_modified names frontend/src/providers/StreamsProvider.tsx or frontend/src/components/panel/PhaseCard.tsx; or any report of a missing Unsourced mark."
reproduces_on:
  branch: develop
  commit: 9f11f3b21
  date: 2026-10-21
---

# BUG-261021-03: a followed run loses its Unsourced mark in the open tab

## What we observed

The Phase 295 gap round 2 live check (D-r2-02, `295-VALIDATION.md` → "Gap round 2 live check (2026-10-21)"). Runs `b5540647` and `5b1477d6`:

1. In a chat thread with the Workspace panel open, a knowledge-base step found nothing.
2. The person answered "Continue without sources", and the tab followed the run to Complete (fix 295-10).
3. The step read plain "Complete", without its "Unsourced · continued by" mark.
4. The run read on the wire carries the mark, and reopening the thread shows it.

## Why it matters

The mark is how a reader knows an output has no sources. It is missing only in the tab that watched the run finish, and only until a reopen, so the risk is a person trusting an unsourced output in that moment.

## Hypothesized cause

Hypothesis, not verified: the end-of-run path in `StreamsProvider.tsx` writes the phase state from the stream's terminal event and does not carry the `unsourced` field that the reconcile read carries.

## Surface classification

Agentic-RAG.

## Suggested routing

- **Fold into in-flight phase:** no. Phase 295 reached the G-7 gap-round cap.
- **Defer to future phase / milestone:** the next phase touching `StreamsProvider.tsx` or `PhaseCard.tsx`. Probably ≤ 10 lines once the cause is isolated.
- **Plant as seed:** no
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Reopen the thread, or check the run page, which shows the mark.
