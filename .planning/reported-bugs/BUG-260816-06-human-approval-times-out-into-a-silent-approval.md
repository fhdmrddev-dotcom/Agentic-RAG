---
id: BUG-260816-06
title: An unanswered `llm_human_input` step times out into a SILENT APPROVAL — the phase records `completed` with `answer: ""` and the run proceeds as if the human confirmed
reported: 2026-08-16
surface: Agentic-RAG
severity: major
status: open
affected_areas: [harness/phase-types, human-in-the-loop, run-honesty, governance]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-167, SEED-164]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 25104616
  date: 2026-08-16
---

# BUG-260816-06: A human approval that nobody answers becomes an approval

## What we observed

> "I ran rounds over the same workflow. The first one I was going to expand the [draft] … Consider that I
> answered even though I did not see the confirmation that I answered and then it was just keep running and
> then it finished after all. But the second attempt actually I was able to read everything then I approved
> and it continued normally."
> — operator, 2026-08-16, during Phase 194.1 UAT (workflow `doc_qa_scoped_098uat`, phase `confirm`)

The operator's reading was right and the cause is not a mis-click. **Measured directly in Postgres**, last five
runs of that workflow — the `confirm` phase's recorded output, and the interval from the previous phase
finishing to `confirm` being written:

| run | confirm `answer` | wait before it completed | status recorded |
|---|---|---|---|
| `57b0b648` | `"Looks go…"` (real) | **24 s** — the operator answered | `completed` |
| `ffc7155d` | **`""`** | **5 m 00 s** | `completed` |
| `b48cd039` | **`""`** | **5 m 00 s** | `completed` |
| `882e33dc` | **`""`** | **5 m 01 s** | `completed` |
| `2ad460f0` | **`""`** | **5 m 00 s** | `completed` |

**Four of the last five runs of this workflow completed their human-approval step with an empty answer, each
at exactly the 5-minute mark.** `timeout_seconds` is unset on the phase, so `HumanInputConfig`'s default
applies — `backend/app/models/harness.py:135`, `timeout_seconds: int = 300`. The measurement and the constant
agree exactly.

## The mechanism — `backend/app/services/harness/phase_types.py:818-856`

```
payload = await subscribe_for_response(redis, run_id, tool_call_id, float(timeout_seconds))
...
answer = ""
if payload and payload.get("kind") == "response":
    answer = (payload.get("response_text") or "").strip()
    ...
return {"text": prompt, "answer": answer, "tool_call_id": tool_call_id}
```

`subscribe_for_response` returns `None` on timeout. `answer` is initialised to `""` and only assigned inside
the `kind == "response"` branch. **So the timeout path falls straight through to a normal return.** The phase
completes successfully, `answer: ""` is handed to the next phase as the human's response, and the run finishes.

⚠ **Nothing anywhere distinguishes "the human approved" from "nobody was there."** Both are
`status: completed`. There is no timeout marker, no receipt, no distinct status, and no user-visible notice —
which is exactly why the operator saw no confirmation: *there was nothing to confirm.*

## ⚠ The strongest evidence this is a defect, not a design choice

**This same file already handles the identical situation correctly, twice, on the two paths either side of it:**

| path | unanswered behaviour | where |
|---|---|---|
| validator `ask_user` gate | *"unanswered (subscribe returns None, the 085 expiry) → **honest `fail_run`**"* | `harness_engine.py:_resolve_failure_with_ask_user` |
| **armed action-risk checkpoint** | *"the **indefinite wait**"* — it never times out | `harness_engine.py:1108+` |
| **author's `llm_human_input`** | **completes with an empty answer** | `phase_types.py:818-856` |

Two neighbouring mechanisms chose *fail honestly* and *wait forever*. This one chose *proceed silently*, and
it is the only one of the three whose entire purpose is to obtain a person's decision.

The same function even defends against a silently-empty answer in two OTHER cases — the shutdown sentinel
(*"we must NOT complete with an empty answer — that would advance/finish the workflow and lose the pending
question"*) and the choice-click case (BUG-260607-01, *"so the workflow never advances on a silently-empty
answer when the user actually chose"*). **The timeout is the one route to an empty answer that was not
defended.**

## Why it matters

1. **The record is false.** `workflow_phases.status = 'completed'` with `answer: ""` asserts a human input
   phase completed. Nobody input anything. Any later audit, receipt or eval reading that row is misled.
2. **The empty answer is fed forward as content.** The next phase receives `""` as the human's correction and
   proceeds — `finalize` produced its output on all four timed-out runs.
3. **It is the same failure family as Phase 194's SC#2**, which was called FAILED for *silently complete*.
   Here a human gate silently completes; there a stop silently completes. Both convert "did not happen" into
   "happened fine".
4. **Five minutes is short for a human decision.** The operator hit it simply by reading the draft before
   answering — the first attempt was spent trying to expand the output to read it properly.

## Blast radius — bounded, and stated precisely so it is not over- or under-read

⚠ **The armed `external_action` path is NOT affected** — it waits indefinitely, so an unattended timeout
**cannot** auto-approve an outbound send (the published Slack/Weekly-Status workflows are safe on this axis).
Verified in `harness_engine.py`'s armed-checkpoint docblock. This is the difference between *major* and
*blocking*.

⚠ **It becomes BLOCKING the moment a human step gates a destructive or outbound action.** `SEED-167` (the
living risk register) proposes exactly that — *"delete or close the open risks that were closed"* — and its
open question #4 already asks who approves a deletion. A 5-minute silent auto-approve on a destructive write
is the failure this bug would become.

## Hypothesized fix shape — NOT prescribed

The two correct answers already exist in this codebase; the question is which one `llm_human_input` should
adopt, and that is a product decision rather than a code one:

- **fail honestly on timeout** (the validator-gate precedent) — safe, but turns an unattended run into a
  failed run;
- **wait indefinitely** (the armed-checkpoint precedent) — matches "a human step means a human" but parks runs
  forever;
- **complete with an explicit `timed_out` marker** — proceeds, but the record stops lying and the UI can say so.

⚠ Whatever is chosen, **the phase must stop recording an unanswered prompt as a plain `completed`.** That part
is not a preference.

## Surface classification

`Agentic-RAG` — our code, our harness. Routing candidate at the four GSD touchpoints.

## Fit against the current milestone (v3.7)

**NODE-02, phase 198** is the natural home — it already owes the establishing work of *"what `llm_human_input`
does and does not cover"*, and this is the sharpest available answer to that question. ⚠ **NODE-02 cannot be
considered delivered while an unanswered human step reads as an approval.**

⚠ **Deliberately NOT folded into Phase 194.1.** 194.1 is stop-visibility; this is backend harness semantics on
a path 194.1 never touched (`git diff` on `phase_types.py` for the whole phase is empty). Folding it would be
the G-7 anti-pattern — a closure round taking on new territory.
