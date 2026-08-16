# 194-MEASUREMENTS.md — the duplicate-assistant-icon root cause

**Plan:** 194-01, Task 2 (`checkpoint:human-verify`, `gate="blocking"`)
**Date:** 2026-08-16
**Commit measured at:** `e1cd3b9b` (phase 194 execution checkpoint)
**DB:** `postgresql://postgres:postgres@127.0.0.1:54322/postgres` (local)

---

## VERDICT: ⏸ NOT MEASURED — DEFERRED with a trigger

**This task did not obtain the measurement it exists to obtain, and this file says so
rather than substituting a plausible one.** RESEARCH's A1 is an explicitly
MEDIUM-confidence hypothesis; the three mechanical verdicts the plan defines
(174-04 race / BUG-260609-03 class / does-not-reproduce) are separated **only** by a
live store dump taken while a harness run is streaming. That dump was not obtained.

⚠ **The word "probably" appears nowhere in this file, and neither does a verdict.**
A mechanism confirmed in the database is **not** an observed symptom. See § *What was
established* — it is real evidence, and it is explicitly not the verdict Task 2 owes.

### Why it was not obtained

Not a judgement that the measurement was unnecessary. Two independent blockers:

1. **No browser was reachable from the session.** The Claude-in-Chrome extension was
   not connected. Measured, not assumed:
   - `mcp__claude-in-chrome__list_connected_browsers` → `[]` (no paired browser at all)
   - `mcp__claude-in-chrome__tabs_context_mcp` → *"Browser extension is not connected"*
   The orchestrator therefore could not drive the app itself. It did start and then
   stop a redundant Vite instance on 5174 after discovering the operator's dev server
   was already serving 5173 on IPv6 only (which is why an IPv4 probe of 127.0.0.1:5173
   reported the port closed).
2. **Two operator-supplied samples were both non-qualifying**, for two different
   reasons — see § *Samples taken*.

---

## Samples taken

### Sample 1 and Sample 2 — the SAME thread and run, taken twice

```json
{
  "threadId": "9f8bf7a9-e3aa-4794-a37b-2b612868fbb4",
  "assistantRows": [
    {
      "id": "9ce135f6-ec94-4e62-8284-6ad391b9f400",
      "isTemp": false,
      "runId": "611b16d0-42dd-4cd9-81f9-fc1a9c03bb9d",
      "runStatus": "completed"
    }
  ]
}
```

Sample 2 was taken with a self-checking variant of the snippet and returned
`❌ NOT STREAMING`. It carried byte-identical `threadId`, `id` and `runId`, so it is
the same observation, not a second one.

⚠ **Recorded per T-194-01-01: row `id` / `runId` / `runStatus` ONLY.** No message
content, no auth header and no provider key entered this artifact.

### Why the sample does not answer the question — TWO disqualifying facts, both measured

**(a) It is not a workflow run at all.** Measured against the live DB:

```sql
SELECT id, status, definition_id, created_at FROM workflow_runs
WHERE thread_id = '9f8bf7a9-e3aa-4794-a37b-2b612868fbb4';
-- (no rows)
```

The thread has **no `workflow_runs` row**. It was an ordinary (Deep) chat run. The
duplicate-icon symptom under investigation is specific to **harness** runs, which is
the entire premise of RESEARCH's A1.

**(b) It was already finished.** `runStatus: "completed"`, and the run started
`2026-08-15 21:33:26Z` with its message persisted `21:40:56Z` — the previous evening.
The symptom is a **streaming-time** condition (a cached `temp-` row and a persisted DB
row rendering concurrently). After completion the temp row is reconciled away, so a
post-completion snapshot structurally cannot observe the window in which the symptom
lives. **One row in this sample is therefore not evidence of non-reproduction.**

---

## What WAS established (real evidence — and explicitly NOT the verdict)

### 1. The BUG-260609-03 precondition is live at HEAD, for harness runs

```sql
SELECT (r.message_id IS NULL), count(*) FROM runs r
WHERE r.thread_id IN (SELECT thread_id FROM workflow_runs) GROUP BY 1;
-- (False, 20) | (True, 587)
```

**587 of 607** `runs` rows on threads owning a `workflow_run` carry
`message_id = NULL` — 96.7%, and all 25 most recent (2026-08-15, 14:01–18:30Z).
So a harness run does leave `runs.message_id` NULL, meaning `dbRunIds` cannot hold the
run_id and the runId-keyed identity the chat surface would need does not exist.

### 2. The operator's sample is a clean CONTROL for that finding

The same probe run against the sampled Deep run:

```
run_id   611b16d0-42dd-4cd9-81f9-fc1a9c03bb9d
status   completed
message_id  9ce135f6-ec94-4e62-8284-6ad391b9f400   (NOT NULL)
points_at_rendered_row  True
```

An **ordinary chat run sets `message_id`, and it points exactly at the row that
rendered**, while harness runs leave it NULL in 587 of 607 cases. That contrast is the
mechanism RESEARCH hypothesised, now observed from both sides on live data. **It came
from a sample that failed its own acceptance criteria** — worth recording, because the
non-qualifying sample was not worthless.

⚠ **Why this still is not the verdict.** It observes the **database**, not the store.
It cannot distinguish a 174-04 mount/first-SSE race (two `temp-` rows) from the
BUG-260609-03 class (one `temp-` + one persisted) from non-reproduction (exactly one
row), because all three are consistent with a NULL `message_id`. Only the live store
dump separates them.

---

## The prior-art correction (recorded BESIDE the report's original pointer)

`.planning/reported-bugs/chat-stuck-on-starting-workflow-with-duplicate-icon.md` names
`toolcallpanel-dedup-duplicates-tool-card.md` / BUG-260521-01 as its prior art.

⚠ **That is the WRONG prior art** — measured by RESEARCH: it is a transient tool-card
duplicate. Different symptom, different surface, different lifetime.

**The correct prior art**, recorded beside the report's original rather than over it:

| Pointer | What it is |
|---|---|
| `dedupMessages.ts:20-26` | the runId-dedup exemption for harness rows |
| `StreamsProvider.tsx:2490-2500` | BUG-260609-03 — harness leaves `runs.message_id` NULL |
| `dedupMessages.ts:31-45` | BUG-260610-01 — the 174-04 narrow collapse |

The report's original pointer is left in place; this table is the correction.

---

## Routing decision

**DEFERRED**, under G-3's sizing rule: a fix cannot be sized without knowing which of
the three mechanisms is live, and the two candidates have materially different fixes
(a mount/first-SSE ordering fix vs. persisting `message_id` for harness runs). Guessing
between them would mean shipping a fix for a mechanism nobody observed.

**⚠ This is a DECISION, not a claim that the measurement ran.**

### Re-open trigger

> **Re-open when a harness run can be observed mid-stream** — i.e. when the
> Claude-in-Chrome extension is connected (so the app can be driven without operator
> hand-holding), or when the operator next has a workflow run streaming and can paste
> the store dump. The snippet is in `194-01-DEVIATION.md`.
>
> ⚠ **The plan's own console expression does not work as written** — it says
> `useStreamsStore.getState()` as though it were a global; it is not exposed on
> `window` and throws. The dev-server form is
> `const { useStreamsStore } = await import('/src/stores/streamsStore.ts');`.
>
> The sample must satisfy BOTH conditions the samples above failed: the thread must
> have a `workflow_runs` row, and at least one assistant row must read
> `runStatus: "streaming"`.

This does **not** discharge the report's existing trigger — *"Re-open if 194 closes only
the banner-advance half"* — which plan 194-07 addresses separately. Both stand.

### Consumers of this file

- **194-05** — routes `BUG-260815-04`'s duplicate-icon half. Verdict is DEFERRED, so it
  stays deferred with the trigger above.
- **194-07** — closes the banner-advance half only. Its own note already provides for
  this: *"If that verdict was 'defer', it stays deferred with its trigger."*

---

## Provenance

Task 2's checkpoint was not satisfied by an operator paste of a qualifying dump. This
file was written by the orchestrator, from two operator-supplied non-qualifying samples
plus its own read-only DB measurements, with the operator's decision to stop chasing it
recorded rather than inferred. Task 3 (`194-UAT.md`) was executed BEFORE this task under
a recorded deviation — see `194-01-DEVIATION.md` — because it has zero dependency on
this file.
