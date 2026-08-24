---
phase: 194-stop-a-running-workflow
plan: 01
kind: deviation-note
recorded_at: 743965a1
recorded_on: 2026-08-16
authorised_by: orchestrator
task_2_status: OPEN
task_3_status: complete
---

# Plan 194-01 — Deviation Note: Task 3 was executed BEFORE Task 2

> **This file exists so that a later reader finds a DECISION where they would otherwise infer a
> skip.** Plan 194-01's tasks are numbered 1 → 2 → 3. They were executed **1 → 3**, and **Task 2 is
> still OPEN**.

---

## What happened, in order

| Task | Name | Status | Commit |
|---|---|---|---|
| 1 | Re-derive the four gate baselines and the six G-5 figures | ✅ complete | `263cff6f` |
| 2 | MEASURE the duplicate-assistant-icon root cause (RESEARCH A1) | ⛔ **OPEN — awaiting the operator's console dump** | — |
| 3 | Author `194-UAT.md` — the 8-row roster DERIVED, plus the axes and the G-4 rows | ✅ complete | `261ba077` |

## ⚠ WHY TASK 2 IS OPEN — THE REASON IS AVAILABILITY, NOT JUDGEMENT

**Task 2 was NOT skipped because the measurement was judged unnecessary. It was not performed
because nobody in the executing session could drive a browser: the Claude-in-Chrome extension was
not connected.** The operator will supply the console dump separately.

That distinction is the entire point of this note. `194-01-PLAN.md` marks Task 2
`<task type="checkpoint:human-verify" gate="blocking">` precisely because RESEARCH's **A1** is a
**MEDIUM-confidence hypothesis** and the plan's own `must_haves.truths` requires:

> *"The duplicate-assistant-icon symptom has a MEASURED verdict (174-04 race vs BUG-260609-03 class)
> or a recorded deferral with a trigger — never an assumption."*

**No verdict has been written and `194-MEASUREMENTS.md` has NOT been created.** Inventing one would
be exactly the false record this plan exists to prevent.

## Why Task 3 was unblocked and executed anyway (orchestrator-authorised)

**Task 3 has ZERO dependency on Task 2's output.** Its inputs are `MODEL_CAPABILITIES`,
`CLAUDE.md` § *UAT scoreboard recipe* and `194-RESEARCH.md` § *UAT scoreboard — SC#10 fires*. Task 2
touches none of them; it reads the chat store during a live run and writes a routing verdict about a
cosmetic duplicate-icon symptom. Blocking a 13-plan phase on that was judged the wrong trade by the
orchestrator, who authorised this deviation explicitly.

The execution order therefore **does not** weaken Task 3: `194-UAT.md` would be byte-identical had
Task 2 run first.

---

## ⚠ ORCHESTRATOR-MEASURED PARTIAL EVIDENCE FOR TASK 2 — **MECHANISM-ONLY. THIS IS NOT A VERDICT.**

Measured by the **orchestrator** at HEAD `743965a1` against the **live local DB**
(`127.0.0.1:54322`, `psycopg2`):

```sql
select (r.message_id is null), count(*)
from runs r
where r.thread_id in (select thread_id from workflow_runs)
group by 1;
```

```
[(False, 20), (True, 587)]
```

- On threads that have a `workflow_runs` row, **`runs.message_id` is NULL for 587 of 607 rows
  (96.7 %)**; it is set for only **20**.
- **All of the latest 25** (2026-08-15, 14:01–18:30 UTC) are **NULL**.

### What this DOES establish

**The `BUG-260609-03` PRECONDITION is live at HEAD.** A harness run leaves `runs.message_id` NULL
(`harness_engine.py:353-357`), so the fetched answer comes back with `runId=undefined`, **`dbRunIds`
cannot hold the run_id**, and the runId-keyed identity the chat surface would need does not exist.
That is a real, current, measured mechanism — not a hypothesis.

### ⚠ WHAT THIS DOES **NOT** ESTABLISH — stated in these terms on purpose

**It does not distinguish the three mechanical verdicts, because it observes the DATABASE, not the
STORE.** It cannot tell:

- a **174-04 mount/first-SSE race** (TWO `temp-` rows with `runStatus:"streaming"`), from
- the **BUG-260609-03 class** (ONE `temp-` row and ONE persisted row), from
- **non-reproduction** (exactly ONE assistant row).

**Only the live store dump can.** `194-01-PLAN.md` Task 2 step 4 makes the verdict *mechanical, not
judgemental* — it is decided by counting rows in
`useStreamsStore.getState().bucketsBySurface.get("chat").get("<threadId>")`, and nothing in the
database answers that question.

> **A CONFIRMED MECHANISM IS NOT AN OBSERVED SYMPTOM.** This section may be cited as evidence that
> the precondition holds. It may **NEVER** be cited as the verdict Task 2 owes, and it may not be
> used to shortcut the checkpoint.

---

## Task 2 remains OPEN — its resume signal is UNCHANGED

Verbatim from `194-01-PLAN.md`:

> **Resume signal:** Paste the assistant-row dump, or type "does not reproduce" with the commit you
> tested at.

### The operator's steps, unchanged

1. Start the local stack (`powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1`)
   and the backend + frontend dev servers. Open `http://localhost:5173`.
2. Launch a real workflow (harness) run from the Workflows page and let it reach **at least phase 2**.
3. While it is streaming, dump the chat bucket for that thread in the browser console:

```js
(useStreamsStore.getState().bucketsBySurface.get("chat").get("<threadId>") || [])
  .filter(m => m.role === "assistant")
  .map(m => ({ id: m.id, isTemp: String(m.id).startsWith("temp-"), runId: m.runId, runStatus: m.runStatus }))
```

4. The verdict is mechanical:
   - **TWO `temp-` rows** with `runStatus:"streaming"` ⇒ the **174-04 mount/first-SSE race**
     (`dedupMessages.ts:31-45`).
   - **ONE `temp-` row and ONE persisted row** ⇒ the **BUG-260609-03 class**.
   - **Exactly ONE assistant row** ⇒ it does **not** reproduce at HEAD — record that as the
     measurement and say so.
5. Paste the dump back into the checkpoint.

⚠ **Threat T-194-01-01 binds the paste:** record row `id` / `runId` / `runStatus` **ONLY**. No
message `content`, no auth header and no provider key may enter `194-MEASUREMENTS.md`.

### What is still owed when Task 2 resumes

- `194-MEASUREMENTS.md`, containing the **verbatim** row dump, ONE of the three mechanical verdicts
  with the evidence that selected it, and an explicit routing decision — **fast-fix under G-3 /
  deferred-with-a-written-trigger / does-not-reproduce**. ⚠ The word *"probably"* may appear nowhere
  in the verdict.
- The prior-art correction recorded **beside** the report's original pointer, never over it: the
  report names `toolcallpanel-dedup-duplicates-tool-card.md` (`BUG-260521-01`), which RESEARCH
  measured to be the **wrong** prior art — a transient (~10-15 s) duplicate **tool card**: different
  symptom, different surface, different lifetime. The correct prior art is `dedupMessages.ts:20-26`,
  `StreamsProvider.tsx:2490-2500` (BUG-260609-03) and `dedupMessages.ts:31-45` (BUG-260610-01).
- ⚠ Until then, `.planning/reported-bugs/chat-stuck-on-starting-workflow-with-duplicate-icon.md`
  keeps its existing `re_open_trigger` — *"Re-open if 194 closes only the banner-advance half."*
  **Nothing in this note discharges it.**

---

## Consequences for plan 194-01's completion state

- **`194-01-SUMMARY.md` was deliberately NOT written.** The plan is not complete; a SUMMARY claiming
  otherwise would be a false record of exactly the kind this plan exists to prevent.
- The plan's `must_haves.artifacts` list three files. **Two exist** (`194-BASELINE.md`,
  `194-UAT.md`); **`194-MEASUREMENTS.md` does not** and its absence is this checkpoint, not an
  oversight.
- `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were **not touched** by this plan. No `gsd-sdk
  state.*`, `roadmap.update-plan-progress` or `requirements.mark-complete` verb was invoked.
