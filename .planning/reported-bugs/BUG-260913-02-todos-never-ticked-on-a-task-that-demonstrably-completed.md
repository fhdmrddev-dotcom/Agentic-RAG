---
id: BUG-260913-02
title: The task completes perfectly but the Todo list never ticks — the panel asserts unfinished work on a job the user watched finish
reported: 2026-09-13
surface: Agentic-RAG
severity: minor
status: folded
affected_areas: [frontend/panel, backend/agent-loop, backend/todos, run-honesty, cross-provider]
folded_into: 250
verified_closed_by: null
related_seeds: [SEED-094]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 66019b628
  date: 2026-09-13
---

# BUG-260913-02: the work is done, the list says it is not

## What we observed

Operator report, 2026-09-13, unprompted lived friction:

> "sometimes the task is completed perfectly but the To Do List is not updated so it looks like
> it's unfinished job even though the job is finished but the to dos is not up to date and ticked
> as completed"

The deliverable is correct and the run terminates normally. The Workspace **Todos** section still
shows items that are not `completed`, so the surface reads as an abandoned or half-done job.

⚠ **ONE MEASUREMENT DISTINGUISHES TWO DIFFERENT DEFECTS AND IT HAS NOT BEEN TAKEN YET** — see
*Open question* below. Do not plan against this report until it is answered.

## Why it matters

The Workspace panel is the run-honesty surface: its whole job is to let a person tell, at a glance,
what the agent did and whether it finished. An item stuck at `pending` / `in_progress` after a run
that visibly delivered inverts that — the panel is now the least trustworthy thing on screen, and
the user has to re-read the transcript to find out whether their own task is done.

Scored **minor** on the same grounds as its 2026-06-26 ancestor: the underlying data is not lost
and the deliverable is correct. ⚠ **The severity is about data, not about trust.** This is the
second time the same surface has produced the same complaint fifteen months apart, and the first
fix made the state legible without making it accurate.

## What is already shipped — measured at HEAD, not read from a record

The 2026-06-26 finding still holds and was re-verified for this report:

- **The todo lifecycle is 100% model-driven.** The only thing that advances or completes a todo is
  the model calling `write_todos` again → `_handle_write_todos` → `replace_todos` (full-state
  replace) → `todo_updated` SSE. The system-prompt instruction to re-call it as each step finishes
  is **advisory**. A model that simply never emits the completion call leaves the list as it was.
- **A run-end reconciler DOES exist** and is live — `reconcile_open_todos_on_run_end`
  (`backend/app/services/todos_service.py:117`), called from
  `backend/app/services/run_producer.py:146`.
- ⛔ **It deliberately never ticks anything.** Its honesty guardrail (D-01) leaves `status`
  untouched and appends a plain-text suffix to `content` instead:
  `" (run ended — not completed)"` (`_RUN_ENDED_MARKER`, em-dash U+2014). Design intent: never
  silently claim success on a run that was cancelled, errored, or abandoned.
- **Its gate is narrow**: it runs only when `terminal_status == "completed"` **and**
  `result_sink["cap_disposition"] != "cap_paused"` (`run_producer.py:145`). A cap-paused run is
  excluded on purpose (the D-05 trap).

⭐ **So the shipped behaviour and the operator's expectation diverge by design, not by accident.**
Phase 138 fixed *"the panel looks permanently stuck"*. It did not, and was not meant to, fix
*"the panel says not-completed about work that was completed."* Those are different requirements
and only the first one has ever been built.

## Open question — the one measurement that routes this

**Does the stuck item carry the text `(run ended — not completed)`?**

| Marker present | Meaning | Route |
|---|---|---|
| **YES** | The reconciler fired correctly. The complaint is with the **honesty guardrail's wording and its blindness to completion** — it tells a person their finished work is unfinished. This is a **product decision**, not a defect: what should a terminal run say about an item the model never closed? |
| **NO** | The reconciler did **not** fire. Either the run did not reach `terminal_status == "completed"`, or it was `cap_paused`, or the call raised and was swallowed by the `except BaseException` at `run_producer.py:155`. That is a **defect with a real root cause to find**, and the swallowed-exception path logs at `RUN-01b reconciler failed for run %s`. |

⛔ **Until this is answered, the two arms lead to opposite fixes** — one is a copy/UX decision, the
other is a backend bug hunt. Answer it by opening a reproducing thread's Todos section and reading
the item text, or by `SELECT content, status FROM todos WHERE thread_id = '<id>'`.

## Hypothesized cause

**Hypothesis, not finding.** Primary: run-to-run and **model-to-model** variance in whether the
model emits the closing `write_todos` at all. This is the same mechanism adversarially verified in
`BUG-260626-03` — some runs emit it, some never do — and it is a cross-provider surface, so a
provider whose tool-emission tier is weaker (`emit_tier: coerce`) is the likeliest to drop it.
⚠ **Unverified here.** No LangSmith trace or `todos` row has been read for the operator's actual
thread; the operator did not name one.

Secondary, worth ruling out rather than assuming: the marker fired and the operator read the
appended text as *"the system thinks my job failed"* rather than as *"the model never closed this
item"* — which would make the copy itself the defect.

## Relationship to prior reports — do not conflate

- **`BUG-260626-03`** (`status: deferred`) — *"todos left stuck at 0/N, in_progress"*. Its
  `re_open_trigger` reads verbatim: *"a user reports todos stuck '0/N, task 1 in progress' after a
  run that finished and delivered."* ⭐ **That trigger has now fired** — but the code it was
  deferred against has since changed, so this is filed fresh rather than as a re-open.
- **`SEED-094`** (`status: closed`, closed 2026-07-06 by Phase 138) — its RUN-01b half claims the
  finalizer *"landed in 138-02 … re-verified live in 138-05."* ⭐ **That claim is TRUE and the
  symptom is back anyway.** The seed closed the requirement it was written for; it did not close
  the complaint. A closed seed is not evidence that a surface is well.
- **`BUG-260718-03`** — the `write_todos` card rendering redundantly in the chat area. Same
  feature, different surface, unrelated cause.

## Surface classification

`Agentic-RAG` — the agent loop plus the workspace panel. Routing candidate at
`/gsd:discuss-phase` and `/gsd:new-milestone`.

## Suggested routing

- **Fold into in-flight phase:** n/a — no phase is in flight (v4.1 closed 2026-09-13).
- **Defer to future phase / milestone:** a run-honesty / chat-surface phase in the next milestone,
  **once the open question above is answered.** If the marker is absent it is a `/gsd:fast`-sized
  backend hunt; if present it is a scoping decision for the operator and must not be quietly
  resolved by an implementer.
- **Plant as seed:** n/a — `SEED-094` already covers the mechanism and is closed; re-opening a
  closed seed to hold a new complaint would hide the fact that its own requirement was met.
- **External — note only:** no

## Candidate fixes, none chosen

1. **Do nothing to `status`; improve the words.** Replace *"(run ended — not completed)"* with
   language that does not adjudicate the work — e.g. *"(not marked complete by the agent)"* — so
   the sentence is about the agent's bookkeeping, which is what the system actually knows, rather
   than about the user's job. Smallest change, keeps D-01 intact.
2. **Make the model close the list.** Strengthen the completion call from advisory prompt text to
   something enforced at the loop's terminal step for models that support it. ⚠ Cross-provider
   risk: `emit_tier: coerce` providers are exactly the ones that will still drop it, so this
   narrows the bug without closing it.
3. ⛔ **Auto-complete open todos on a clean run end.** **Rejected on the same ground as 2026-06-26:**
   it fabricates success, and a clean terminal status is not proof the listed work happened.
   Recorded here so it is not re-proposed as though it were new.

## Workarounds

- Prompt-side: ask the agent to mark each todo complete as it finishes. It helps per-run and is not
  reliable across providers.
- The data is honest either way — the transcript and the deliverable are the source of truth, not
  the panel.

## Reference / evidence links

- `backend/app/services/todos_service.py:117` — `reconcile_open_todos_on_run_end`, and
  `:113` — `_RUN_ENDED_MARKER`.
- `backend/app/services/run_producer.py:145-156` — the `completed AND NOT cap_paused` gate and the
  `except BaseException` that swallows a reconciler failure.
- `.planning/reported-bugs/BUG-260626-03-todos-stuck-no-run-end-finalizer.md` — the ancestor, with
  the adversarial root-cause workflow `wf_cf429301-479`.
- `.planning/seeds/SEED-094-run-end-honesty-baseline-emit-leak-and-todo-finalizer.md` — closed by
  Phase 138.

---

## ✅ FOLDED INTO PHASE 250 — `HONEST-04` (2026-09-15). The open question is ANSWERED.

**The measurement this report blocked on was taken before anything was planned** (full evidence:
`.planning/phases/250-run-honesty-the-residue/250-MEASUREMENT.md`):

| | |
|---|---|
| open todos (`pending` + `in_progress`) | **78** across **26** threads |
| carrying `(run ended — not completed)` | **25** |
| NOT carrying it | **53** — of which **49** predate the reconciler and **4** were gated out |
| newest MARKED row | **2026-09-13 14:31:05** — this report's own date |

⭐ **MARKER PRESENT → the YES row of this report's own table → the copy/UX arm.** The
reconciler fired correctly and told a person that work they had watched finish was *"not
completed"*.

⭐ **AND THE DICHOTOMY WAS FALSE.** Both arms are true, of different rows: the newest items carry
the marker (copy decision — `HONEST-04`), while every post-138 unmarked row sits behind a run
that ended `timed_out` or `cancelled` and was excluded by the gate (backend defect —
`HONEST-03`). One measurement answered two requirements.

**What shipped — this report's candidate fix #1, taken further.** Rather than rewording the
stored string, the marker is **stripped out of the label entirely** and the honesty moves to the
STATUS slot: the row reads **`NOT TICKED`** with the sentence *"The run ended before the agent
marked this complete."* as its `title`. ⭐ `NOT TICKED` is the operator's own vocabulary —
*"the to dos is not up to date and ticked as completed"* — and it is a statement about the
**agent's bookkeeping**, which is what the system actually knows, not about whether the person's
job got done.

⛔ **The marker STRING is byte-unchanged**, deliberately: rewording it would break the
reconciler's no-stack guard against the 25 rows already carrying the old text and would force the
backfill this phase rejected. A `?raw` lockstep fence now binds the frontend copy to
`todos_service.py`, because a one-character drift makes the strip a silent no-op — and then the
row shows the raw parenthetical AND the badge, which no other gate in this repo can see.

⛔ **Candidate fix #3 (auto-complete on a clean run end) remains REJECTED**, for the third time
on record. Nothing was auto-completed; `status` is untouched and a fence asserts it.

⚠ **Candidate fix #2 (make the model close the list) was NOT built.** The model still drives
the lifecycle, and a provider with a weaker emission tier will still drop the closing
`write_todos`. This phase makes that outcome honest; it does not make it rare. `SEED-118` /
`SEED-127` hold the capability half.
