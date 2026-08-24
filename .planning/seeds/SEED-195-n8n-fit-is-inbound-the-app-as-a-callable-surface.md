---
seed_id: SEED-195
title: n8n's real fit is INBOUND — n8n calls us, we do not call n8n — and the app has no inbound trigger surface at all, so the integration everyone pictures is the one that does not fit
created: 2026-08-23
planted_during: Operator note review, 2026-08-23 — "see also special cases for integrating n8n with RAG application"
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - SEED-014 — automations / routines. ⚠ THIS IS THE SAME FEATURE SEEN FROM OUTSIDE. A routine
    triggered by n8n and a routine triggered by a schedule need the same inbound surface. Do not
    plan them separately.
  - SEED-013 — external integrations (API / MCP). The outbound half, already answered.
  - SEED-177 — MCP connections, connect and BE connected. The "be connected" half of that seed is
    this seed; sequence them together.
  - docs/CONNECTOR-ARCHITECTURE.md — the recorded MCP-first verdict. This seed does NOT re-open
    it; it is about the opposite direction, which that document does not cover.
  - reference_n8n_mcp_server_tested (memory) — the n8n MCP server was TESTED — 34 tools, of which
    the entire execution surface is 2. It is an AUTHORING server.
  - ⚠ test_189_no_egress.py — fails on ANY MCP identifier in backend/app. The outbound direction
    is fenced today, deliberately.
trigger_when: >
  Re-open at the connections milestone (see project_connections_are_platform_assets — READ
  SEED-146 FIRST), or earlier if a user asks to trigger this app from something they already run.
  ⚠ Do NOT re-open this as "add an n8n connector" — that framing is the thing this seed exists to
  correct. The unit of work is an inbound trigger surface; n8n is one caller of it.
---

# The obvious integration is the wrong direction

## What was already measured

The n8n MCP server has been tested against this project. It exposes 34 tools and **the entire
execution surface is 2** — the rest is authoring: create a workflow, edit nodes, validate. It is
a tool for *building n8n workflows*, not a bus for *running* them. Wiring it in as an outbound
connector would give the agent the ability to author automations in someone else's product,
which is not what anyone means by "integrate n8n with the RAG application."

Meanwhile the outbound direction is fenced on purpose: the no-egress test fails on any MCP
identifier appearing in the backend, and live outbound egress is a STRETCH phase that has not
shipped.

## The fit that actually exists

n8n's value here is as a **caller**. The user already runs automations there — a file lands, a
form is submitted, a schedule fires, a ticket is created — and what they want is *"and then ask
my knowledge base about it, and put the answer somewhere."*

That is an **inbound** capability, and this app has none of it. There is no way for anything
outside the browser session to start a run, ask a question, or receive an answer. Every entry
point is a click by a logged-in human.

So the unit of work is not a connector. It is:

- an **authenticated inbound endpoint** that accepts a question or a workflow-run request and
  returns the answer (or a run id to poll);
- **scoped credentials** — a token bound to a user, and ideally to a folder scope and a tool
  subset, because an inbound caller is not a session and cannot be trusted with the whole
  toolbox;
- **a run that is legible afterwards.** An inbound run must appear in the run log like any other,
  or the first support question about it is unanswerable. Phase 200 built that log; this would be
  its second producer.

Given that, n8n needs nothing bespoke — it calls an HTTP endpoint, which is the one thing every
automation platform does. The same surface serves Zapier, Make, a cron job, a Slack bot, or a
customer's own backend. **Building "an n8n integration" would be building the general thing badly
and then naming it after one caller.**

## ⚠ Why this is gated rather than cheap

An inbound endpoint is an **authentication and blast-radius** feature wearing an integration
costume. Every capability reachable through it is reachable without a human in the loop —
including, eventually, the write-capable connectors already flagged in
project_connections_are_platform_assets (*"EVERY capability is a WRITE"*, and *"NEVER add an
outbound capability to the tool registry before the approval model exists"*).

An inbound trigger removes the human from exactly the loop that rule is protecting. So this
belongs **after** the approval model, in the connections milestone, sequenced with SEED-177's
"be connected" half — not folded into a workflow phase because someone mentioned n8n.
