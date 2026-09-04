---
seed_id: SEED-207
title: "The three fixed actions (send_email / create_ticket / post_message) must stop being the ORGANIZING AXIS — every connection should present its own available tools instead. ⚠ But they must NOT be deleted: they are the only external path that works with no MCP server."
created: 2026-08-26
status: answered
answered_by: "Phase 211"
answered_on: "2026-08-27"
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-205 — the connection journey; this is the LEGACY half that journey must absorb
  - SEED-204 — the three paths in (OAuth / MCP / plain API)
  - Phase 209 — kills the FILTER chips (item 3). It does NOT unify the two models.
  - Phase 206 / 206.1 / 206.2 — the MCP model: discovered_tools + per-tool grants
  - supabase/migrations/116 + 126 — the CHECK constraints that encode both shapes
  - .planning/research/connections-competitor-study.md §Q2 — "we promoted an attribute to be the browse axis"
trigger_when: >
  When the Connections & Open Platform milestone is scoped. This is a PREREQUISITE for SEED-205's
  journey: as long as two models coexist, every downstream surface (node face, mark, filter, chat
  mention, catalog entry) must branch, and each new surface pays the branch again.
---

# SEED-207 — the three verbs are an attribute, not the axis

## Recorded verbatim, 2026-08-26

> *"Previously we designed like three actions — send a message, or create a ticket, or whatever.
> This is the old way. It is still appearing in the node side and it is still appearing in the
> connection. I hope that we will address this later, to populate actually each connection's
> available tools rather than this old thing that we changed."*

## The diagnosis is already written, in our own research

`.planning/research/connections-competitor-study.md` §Q2, having surveyed seven products:

> ⭐ *"The closest thing anyone has to our `capability` is Make's module SUBTYPE — and it is an
> ATTRIBUTE OF A MODULE INSIDE AN APP, never the axis you browse by. That is our bug stated
> precisely: **we promoted an attribute to be the browse axis.**"*

## ⚠ BUT DO NOT DELETE THEM — MEASURED, AND IT INVERTS THE OBVIOUS FIX

`phase_types.py:2311-2322` shows **two shapes reach the executor and each is closed by a different
set**:

```python
if mcp_tool_name:            # MCP step — closure is the PER-TOOL GRANT
    ...
elif capability not in EXTERNAL_ACTION_CAPABILITIES:   # native step — closed set of three
    raise KeyError(...)
```

**The three are not merely legacy UI. They are a genuinely separate execution path — the only one
that reaches an external system with NO MCP server involved.** SMTP email in particular has no
guaranteed MCP server. Deleting the three would therefore REMOVE working capability and force every
user through a protocol they may have no server for. That is a regression, not a cleanup.

⚠ Also recorded there, because it is the trap this area already sprang once: `capability` once
carried the default `"send_email"`, so **every MCP step arrived claiming to be an email step and
passed a closed-set check it was never meant to take**, for the length of a whole phase. *"A default
is not a way through a gate."* Any unification must not re-introduce a default that lets one shape
wear another's clothes.

## ⭐ THE SHAPE OF THE ANSWER — one model, no capability lost

Do not retire the execution path. Retire its **privileged position in the UI**:

> **Present a native connection as a connection with exactly ONE available tool.**

A `send_email` connection exposes a one-item tool list (`send_email`, with its own description and
input schema) exactly the way an MCP connection exposes its discovered list. Then every downstream
surface has **one** model to render:

| Surface | Today | After |
|---|---|---|
| Connection row | capability chip, one of three | service + its tool list |
| Node face | branch: capability sentence vs `tool_name` | one resolver, always "service · tool" |
| Mark | 3 capability arms + an MCP arm | one service→mark lookup |
| Filter | 3 verb chips | search + STATE (Phase 209 item 3) |
| Chat mention | impossible | uniform: mention a service, grant its tools |
| Per-tool consent | MCP only | **every connection**, including the three |

⭐ **The consent win is the real prize:** `tool_grants` currently governs MCP connections only. Under
one model the three natives become grantable too — a `send_email` connection whose one tool can be
switched off, with the same missing-key-denies rule and the same `tool_refused` audit row.

## What Phase 209 does and does NOT do here

- ✅ **Item 3 removes the verb chips** — the browse-axis half of this seed, and the visible half.
- ⛔ **It does not unify the two models.** After 209 a capability step and an MCP step are still
  different shapes in the schema, in `phase_types.py`, in `connectionMark.tsx`'s map, and in the
  connection-creation form. **Every new surface still pays the branch.**

## The schema half, measured

Migration 116 pinned `CHECK (capability IN ('send_email','create_ticket','post_message'))`;
migration 126 made `capability` nullable and added `CHECK (capability IS NOT NULL OR
mcp_server_url IS NOT NULL)`. So the table encodes exactly two shapes and **refuses a third** — an
OAuth or plain-API connection has neither column (`SEED-205` amendment). Unifying the model and
admitting `SEED-204`'s paths 1 and 3 are **the same migration**, and should be planned as one.
