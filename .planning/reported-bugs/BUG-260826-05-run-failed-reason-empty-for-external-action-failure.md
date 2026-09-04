---
id: BUG-260826-05
title: A failed external_action phase shows "Failure reason not captured by the backend" in the panel while chat shows the real reason
reported: 2026-08-26
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/panel, backend/harness, streaming]
folded_into: 214
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: production
  commit: 386b5a4
  date: 2026-08-26
---

# BUG-260826-05: The panel reports no failure reason for a send step that has one

## What we observed

On a run whose `email-briefing` phase failed, two surfaces disagreed at the same moment:

- **Chat** rendered the full, correct body: `SEND FAILED — nothing arrived.` … `the 'to' recipient
  must be a string, got NoneType` … plus the D-18 sentence.
- **The workspace panel** rendered the unknown-reason sentinel:

  > Failure reason not captured by the backend — surfaced explicitly so the run is never shown as
  > an empty success.
  > `phase: email-briefing · error field was empty`

So the reason existed and was displayed one pane away, while the panel declared it missing.

## Why it matters

Minor in blast radius, but it undercuts the panel's stated discipline. The sentinel exists to keep
a failed run from reading as an empty success — an honesty mechanism. Firing it when the reason
*is* known trains readers to distrust it, and on a debugging surface that is the wrong direction to
be wrong in. It also cost time in this session: the panel implied the backend had lost the error,
when the backend had it.

## Hypothesized cause

**Hypothesis — not verified.** The sentinel is driven by the SSE `run_failed` event carrying
`reason: ""` (`PhaseCard.tsx:253`; the pinned case in `__tests__/FailReason.test.tsx:103` is
`fxRunFailedReasonUnknown (run_failed{reason:""})`), i.e. it reads the streamed event rather than
the persisted phase row.

Meanwhile the executor returns `{"text": …, "failure": …}` and the engine's `failure`-key branch
calls `fail_phase(pool, phase_id, str(_emit_failure), output=durable_output)`
(`harness_engine.py:2190, 2239`) — a branch whose comments describe it as general ("THE THIRD
BRANCH, same mechanism, one over" for `external_action`). So the phase row plausibly *does* carry
the reason while the emitted `run_failed` event does not.

Worth confirming directly before fixing: read `workflow_phases.error` for the failed phase of run
`e2c0db68-dc94-4864-b7bd-afd0e163f69b` and compare against the `run_failed` frame. If the column is
populated, the defect is in what the event carries (or in the panel preferring the event over the
row).

## Surface classification

`Agentic-RAG`.

## Suggested routing

- **Fold into in-flight phase:** n/a
- **Defer to future phase / milestone:** small; fold into whichever phase next touches the harness
  failure path or the panel's phase cards
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Read the failure text in the chat transcript, or query `workflow_phases` directly, when the panel
shows the unknown-reason sentinel.

## Reference / evidence links

- `frontend/src/components/panel/PhaseCard.tsx:253` — the sentinel copy
- `frontend/src/components/panel/__tests__/FailReason.test.tsx:103` — the pinned `run_failed{reason:""}` case
- `backend/app/services/harness_engine.py:2178-2245` — the `failure`-key branch and `fail_phase` write
- Observed on run `e2c0db68-dc94-4864-b7bd-afd0e163f69b`, phase `email-briefing`, 2026-08-26

## Phase 214 close (plan `214-15`, 2026-08-28) — why this stays `folded` and is NOT `closed`

The wire half is `214-02` (`backend/app/api/workflow_runs.py`, `backend/app/api/threads.py`)
and the render half is `214-11`: `PhaseCard`'s `reason_unknown` sentinel now fires only when
the DB-backed reason AND the wire reason are BOTH empty, with whitespace counted as empty.

⛔ **`verified_closed_by` stays `null` pending G4-5**, and that check has a specific shape the
tests cannot reproduce: it must be driven against a **RELOADED** run, not only a live one,
because the defect is on the reconcile path (D-v2.5-03 — Realtime is a hint, the fetch is the
truth). A green suite on the live path says nothing about the reload.
