---
seed_id: SEED-236
title: "\"Always allow\" grants ONE ACTION, and moving it to the app rung would not fix a chain of writes — D-221-06 caps an application allow at ask on every write"
created: 2026-09-01
planted_during: Phase 221 close — operator drove a two-write Google chain and was asked twice
status: planted
surface: Agentic-RAG
severity: medium
category: approval-model / permissions
priority: high
relates_to:
  - D-221-05 (the three-rung ladder — action then app:<key> then connection default)
  - D-221-06 (an application-level allow may NEVER arm a write; the cap tightens, never loosens)
  - SEED-146 (the full integration capability surface — the approval dimension)
  - SEED-235 (the second approval in a run) — a DIFFERENT defect on the same card, already fixed
trigger_when:
  - The operator or any user says approvals are asked too often
  - Anyone proposes making the chat card's "Always allow" write an `app:<key>` grant — read this FIRST, it does not do what it looks like it does
  - Any change to `resolve_effective_posture`, `grant_one_tool`, or the write cap
  - A workflow or chat chain calls three or more writes on one connection in one run
---

# SEED-236 — the button is honest and the expectation is reasonable, and they disagree

## What the operator saw (2026-09-01)

> *"when I click always allow in the thread, it should allow all the following asks for the
> same app, it is keep asking me"*

## What is actually happening — NOT a bug

The grants persist. Measured on the live working-org Google row after the operator used the
button:

```
tool_grants: {"draft_email":"allow", "search_email":"allow", "search_contacts":"allow"}
```

`POST /threads/{id}/tool-approval` with `decision: "always"` calls
`connector_service.grant_one_tool(tool_name=payload.tool_name, posture="allow")` — the
**action** rung, one tool. The card's own label says so: *"Always allow `draft_email` on this
connection"*. A different action on the same app therefore asks again, correctly.

## ⚠ THE TRAP: moving it to the app rung WOULD NOT FIX THE REPORTED CASE

The obvious fix is to write `app:gmail = allow`. **That helps reads only.** `resolve_effective_posture`
caps that rung on a write, deliberately:

> *"D-221-06 — on a WRITE this rung is CAPPED AT `ask`: an application-level `allow` may not
> arm a write, though an application-level `deny` still denies one. The cap tightens; it never
> loosens."*

The reported chain was `create_doc` → `append_to_doc` — **two writes**. An app-level allow would
have asked twice all the same. Google is 15 reads / 11 writes, so the cap bites across most of
the surface. **Anyone who "fixes" this by moving the rung will ship a change that does not
change what the operator complained about**, and will believe it did.

## The three real options, none of them taken

| | option | what it actually buys | cost |
|---|---|---|---|
| 1 | app-level "Always allow all *Gmail* actions" on the card | **reads only** — writes still ask | small; honest; partial |
| 2 | relax D-221-06 so an app allow arms writes | the thing that was asked for | ⚠ one click arms every current AND FUTURE write for that app |
| 3 | connection default → `allow` (knob already exists in Settings) | everything, immediately | blanket; no per-app granularity |

**Recommended shape if this is taken up:** option 1, plus a NARROW version of option 2 — an
app-level always-allow that arms reads immediately and offers writes as a *distinct, explicitly
worded* second step. A single control that silently arms eleven writes is precisely what the
standing rule forbids: *no outbound capability exists before its approval model does.*

⚠ **This was left UNIMPLEMENTED on purpose.** It is a change to the approval model, which is a
security boundary and the operator's decision, not an autonomous one.
