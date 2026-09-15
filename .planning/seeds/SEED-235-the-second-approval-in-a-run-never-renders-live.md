---
seed_id: SEED-235
title: "The SECOND approval pause in one chat run never renders live — the run parks in runs:active forever, with no error and no assistant message, and a page reload is the only way to see it"
created: 2026-09-01
planted_during: Phase 221 — driving a two-write Google chain through chat with real approvals
status: closed
surface: Agentic-RAG
severity: high
category: chat / approval-model / realtime-reconcile
priority: high
relates_to:
  - D-v2.5-03 — "Realtime is a best-effort hint, NOT a source of truth; always reconcile via fetch on (re)connect". This is that rule being broken on the highest-stakes surface in the product.
  - project_chat_run_lifecycle_findings (memory) — "the iteration-cap Continue ALREADY EXISTS and did not render (live-SSE gate, no fetch reconcile)". Same mechanism, different control.
  - BUS-040 / the open dead-run investigation (thread c04c8245, run 6c2fe7ae, 2026-08-31 21:51) — "a chat run cancelled ITSELF 20 seconds into an ask_user pause, with error = NULL and an empty assistant message"
  - SEED-281 (nobody is told an approval is waiting)
trigger_when:
  - ANY work on the chat approval card, PendingAskCard, or the run event stream
  - The dead-run investigation is reopened — read this first, it is a reproduction
  - A run is reported "stuck", "dead", "cancelled itself", or "did nothing"
  - Anyone adds a second pausing tool call to a single run
---

# SEED-235 — the run was never dead; nobody could see the question

> ✅ **CLOSED 2026-09-01, same day, fixed and proven live.** Root cause was NOT the SSE
> transport: the event arrived. `ChatToolApprovalCard` held its decision in untagged local
> state, and the message carries a SINGLE `toolApproval` slot — so the second
> `tool_approval_required` replaced the first on the SAME mounted component and React kept
> the first decision. The card rendered the new question as already answered and
> `handleDecision` early-returned on the stale value. **Every piece of that state is now
> tagged with the `callId` it belongs to.** Three tests driven RED against the shipped
> defect, plus a COUNTERWEIGHT proving a settled card does not flicker back into a question
> — that overcorrection was driven RED too and fails eight tests. **Live proof: one chat
> turn, two approvals, NO RELOAD, both writes committed** — the Doc
> `AGENTIC-RAG UAT 221 seed235` reads `second approval rendered`.
>
> ⚠ **THE DIAGNOSIS IN THIS SEED'S BODY BELOW IS KEPT AS WRITTEN AND IS PARTLY WRONG.** It
> blamed a missing fetch reconcile (D-v2.5-03). That was the natural reading — a reload
> fixed it — but the reload worked because it produced a FRESH MOUNT, not because it
> re-fetched. The evidence was equally consistent with both, and only reading the component
> separated them. Recorded rather than overwritten, because "a reload fixes it" pointing at
> the wrong layer is the trap worth remembering.

## Reproduced end to end, 2026-09-01

One chat turn, Google connector enabled, prompt: *"create a Google Doc titled X"*. The model
chained two writes, so the run needed **two** approvals.

| # | what happened | what the person saw |
|---|---|---|
| 1 | `create_doc` → `tool_approval_required` | card renders, three buttons. Approved. **Works.** |
| 2 | run resumes, creates the Doc, calls `append_to_doc` → `tool_approval_required` | **card shows `append_to_doc · Approved` with NO CONTROLS.** The first decision's word, on the second question. |
| 3 | run parks | no error, no assistant message, nothing further in the log after `POST /tool-approval 200` |
| 4 | **page reload** | card renders correctly — `Reject` / `Approve once` / `Always allow` |
| 5 | approve | `Run · 3 steps · ✓ done`, both writes land |

## The backend is RIGHT; the client is the defect

The run's Redis buffer ends exactly where it should:

```
tool_preparing          google__append_to_doc
tool_start              google__append_to_doc  {content, document_id}
tool_approval_required  {call_id: call_00_ufOj0..., service: google, tool_name: append_to_d…}
```

…and `runs:active` still held the run id. **The server asked the question and waited.** The
live SSE path simply never rendered the second `tool_approval_required`, and there is no fetch
reconcile to catch it — so the question existed and nobody could answer it.

## Why this is very probably the open dead-run investigation

The recorded symptom is *"a chat run cancelled itself 20 seconds into an ask_user pause, with
`error = NULL` and an empty assistant message."* Every part of that is what this produces:

- **`error = NULL`** — nothing failed; the run is waiting, correctly.
- **empty assistant message** — the turn never completes, so nothing is persisted.
- **"cancelled itself"** — from the user's seat a run that shows no question and never moves is
  indistinguishable from one that died. Whatever eventually reaps it writes no cause.

⚠ **The DB was exhausted as a source for exactly this reason** — the evidence is in the Redis
buffer and the absence of a rendered card, neither of which is a row.

## What to fix

**Reconcile the pause on (re)connect, and on every stream event that arrives after one.** The
rule already exists — D-v2.5-03 — and this surface does not follow it. A pause is the one piece
of run state where a missed render is not cosmetic: it stops the run permanently.

Secondary, and cheap: the card rendering `Approved` while a DIFFERENT call awaits a decision is
a **wrong word**, not just a missing control. The word belongs to the decision, not to the card.

## What is NOT wrong

- The approval model itself works: the payload preview is honest (`title: …`), *"Nothing has
  been sent yet"* is true, and both writes landed only after a person pressed a button.
- Chaining works — three steps, two approvals, both writes committed to the operator's real
  Google account.
