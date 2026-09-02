---
id: BUG-260902-03
title: A connector armed in a thread is stored NOWHERE — it lives in a module-scoped JS Map, so a reload disarms it silently and no record of the turn's connectors exists at all
reported: 2026-09-02
surface: Agentic-RAG
severity: major
status: open
affected_areas: [frontend/chat, backend/threads, connectors, persistence]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-240]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 1b0fa592b
  date: 2026-09-02
---

# BUG-260902-03: "on stays on for the conversation" is true only until you refresh

**Operator, 2026-09-02:** *"if we enabled one tool, when a response is received the tool is
disabled again — it should be enabled all the time in this thread unless the user deactivated
it."*

**The operator is right about the requirement, and the code AGREES with them in writing.**
`MessageInput.tsx:81`:

> *"…had already said 'yes, use Google here' would have to say it again on the next turn. **Off
> now means off — and on stays on for the conversation you said it in.**"*

## What we observed — driven, both halves

**1 · Within one page session it WORKS.** New chat → composer `+` → enabled **Google Workspace**
(flyout read `1 enabled`) → sent *"Say only the word: ready"* → reply arrived → the composer still
showed **`USING: Google Workspace ✕`**. ⭐ **A response does NOT disarm it.**

**2 · A RELOAD disarms it, silently.** Same thread reopened after `F5`: the messages are intact,
and the `USING:` row is **gone entirely**. Nothing was clicked off.

## ⚠ A prediction I made from reading the code, and the drive REFUTED it

I first predicted the loss happened at thread creation: `draftKey = threadId ?? "__new__"`, and
the effect at `:164` saves under the **old** key then loads `activeConnectorsByThread.get(newKey)
?? []` — with **no migration** from `"__new__"` to the new thread id, so arming a connector in a
new chat should be dropped on the first send.

**That is not what happens**, because *"New chat"* creates the thread row **eagerly**, before the
first message. So `draftKey` never makes the `"__new__" → id` transition on the normal path and
the hole is unreachable. **Recorded because a plausible mechanism read off the source was wrong,
and only driving it showed that.** ⚠ It may still be reachable on a path that composes into a
genuinely uncreated thread — not investigated.

## ⛔ The actual finding: the arming is stored in NO durable place at all

Measured against the live database:

| candidate home | result |
|---|---|
| a `thread ↔ connection` table | **does not exist** |
| a column on `threads` | **none** — `id, user_id, title, created_at, updated_at, folder_id, active_workflow_run_id, is_eval, org_id` |
| a column on `messages` | **none** — `active_connector_ids` is on the Pydantic **request** model (`models/message.py:75`) and is **never persisted** |
| the client | `const activeConnectorsByThread = new Map<string, string[]>()` — **module scope** (`MessageInput.tsx:84`) |

⚠ **So there is not even an audit record of which connectors were armed for a completed turn.**
`active_connector_ids` arrives on the request, is used for that turn, and is discarded. A run that
called a connector cannot be traced back to *"the person had it armed"* from the messages table.

⚠ **And the consequences go past a refresh:** the arming does not survive a second tab, a second
device, or a browser restart — and it is invisible to the backend, so nothing server-side can ever
answer *"which services is this conversation using?"*.

## Why it matters

The whole point of Phase 216 was that a person adds a service to a thread **once**. A silent
disarm on reload turns that into *"once per page load, and you will not be told"* — and the
failure is invisible until a turn that needed the connector quietly does not use it. That is the
same shape as `BUG-260902-02` on the same surface: **the product does the wrong thing without
saying so.**

## For whoever fixes it

The fix is a persistence decision, not a patch:

- ⭐ **The cheap correct-shaped option**: persist `active_connector_ids` on the message row, and
  seed the composer from the **last** message of the thread on mount. It reuses a field that
  already exists on the wire, and it gives the audit record for free.
- ⚠ **`localStorage` would fix the refresh and none of the rest** — not a second device, not the
  backend's ability to answer the question. Recorded so it is chosen deliberately rather than
  because it is the smallest diff.
- ⚠ **Whatever is chosen, "off" must stay off.** The comment at `:81` is explicit that an
  explicit disarm is a decision, and a restore-from-history that re-arms what somebody switched
  off would be worse than the current bug.
