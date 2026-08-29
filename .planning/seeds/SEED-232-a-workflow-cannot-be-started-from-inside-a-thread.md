---
id: SEED-232
title: A workflow cannot be started from inside a thread — the launch form was built for it and nothing calls it
status: planted
planted: 2026-08-29
planted_by: Claude, measuring SC#2's third door while closing Phase 214.1's verification
surface: Agentic-RAG
severity: medium
category: unreachable surface
priority: medium
scope: >
  `ChatLaunchForm` was built by plan `214-12` so a workflow launched from a thread could collect
  its declared inputs. `ChatLayout.doRun` — the only thing that mounts it — has exactly ONE
  caller, `WorkflowsPage`. So nothing in the chat surface can start a workflow, and the form is
  reached only by the builder's Test Run. The mechanism is complete and correct; the entry point
  does not exist.
affected_areas:
  - frontend/src/components/layout/ChatLayout.tsx
  - frontend/src/components/layout/ChatLaunchForm.tsx
  - frontend/src/components/chat/MessageInput.tsx
relates_to:
  - SEED-218 (`onOpenSettings` unwired on WorkflowsPage — the same shape, one surface over)
  - SEED-219 (stepIdentityVocabulary's six PAUSE sentences consumed by nothing — same shape again)
  - BUG-260828-02 (publish refused an argument nothing could declare — the authoring twin)
re_open_trigger: >
  The next phase touching the chat composer, `ChatLayout`'s launch path, or any roadmap
  criterion that names launching a workflow from a thread. Also: an operator asking how to run
  a workflow without leaving chat.
---

# SEED-232 — the form exists, the door does not

## Measured 2026-08-29

`grep -rn "onLaunch" frontend/src --include=*.tsx` returns **one wiring**:

```
ChatLayout.tsx:781    <WorkflowsPage … onLaunch={doRun} … />
```

`doRun` is the launcher, and `ChatLaunchForm` renders only when `doRun` sets a pending ask. The
code's own comment names the three callers it serves:

> · the library Run modal (`WorkflowsPage.tsx:1351`)
> · the builder's Test Run (`WorkflowsPage.tsx:909`)
> · the chat launch, which is this branch

⭐ **The third bullet is reached by the SECOND.** `ChatLaunchForm` is named for the chat *layout*
it is mounted in, not for a chat entry point — the branch fires whenever a caller supplied no
collected values, and the only such caller is Test Run. **Nothing on the chat surface starts a
workflow.**

## What plan 214-12 believed, verbatim

> *"chat has no launch form at all today … Without this, a `send_email` step launched from a
> thread still receives nothing, and SC#2 is two-thirds true."*

So the plan read SC#2's *"a thread"* as **starting a workflow while standing in chat**, and built
the form for exactly that. ⚠ **It built the collection point and not the way in** — the same
half-delivery `BUG-260828-02` records one layer up, where publish refused an argument nothing
could declare.

## ⚠ WHY THIS IS NOT AN SC#2 FAILURE, AND WHY THAT IS NOT AN EXCUSE

`ChatLayout.doRun` is `createThread + sendMessage(workflow_definition_id)`. **Every workflow run
creates a thread and runs into it**, which the Workflows page states on its own face — *"author,
publish, and Run into a thread."* On that reading all three of SC#2's named paths carry declared
inputs, and Phase 214.1's verification records SC#2 as MET with the assumption stated.

**That does not make this a non-finding.** A person in a thread who wants to run a workflow has
to leave, find it in the library, and come back — and a form built for the other answer is
sitting unreachable in the tree. Whether SC#2's wording covers it is a paperwork question; the
capability gap is real either way.

## What closing it would take

Small, and the risky halves are already built:

1. **An entry point in the chat surface** — a workflow picker in the composer, or a slash
   command. This is the only new thing.
2. It calls the existing `doRun` with **no collected values**, which already opens
   `ChatLaunchForm` and already routes the result into `create_workflow_run.inputs`.
3. Nothing on the backend changes: `postMessage`'s `inputs` option shipped in plan `214-16`.

⚠ **AND THE REJECTED ALTERNATIVE STAYS REJECTED.** `D-214-04` refused letting the agent fill a
launch argument from the conversation, because *"an LLM choosing a recipient address is a new
trust surface and is not reproducible between runs."* A chat entry point must still ASK — it may
not become the door through which that decision is quietly reversed.

## The pattern this is the third instance of

| seed | shipped surface | reached by |
|---|---|---|
| `SEED-218` | `WorkflowsPage`'s `onOpenSettings` | nothing |
| `SEED-219` | `stepIdentityVocabulary`'s six PAUSE sentences | nothing |
| **`SEED-232`** | `ChatLaunchForm` | only the door it was not built for |

⚠ **Three is a pattern, not a coincidence.** Each was built, tested, gated green and shipped
without anything asking *can a person get here?* A reachability check belongs in the phase
close, not in a seed written afterwards by whoever happens to grep for callers.
