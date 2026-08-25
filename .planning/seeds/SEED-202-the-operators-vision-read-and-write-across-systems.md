---
seed_id: SEED-202
title: "The operator's own picture of what a workflow should be — pull from the knowledge base, READ from Slack, blend, analyse, then deliver to email / Slack / any MCP. ⚠ It exposes a gap nobody has named: external_action is WRITE-ONLY, and half this vision is READS."
created: 2026-08-25
planted_during: conversation with the operator, 2026-08-25, immediately after Phase 209 was registered
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - .planning/CONNECTIONS-MILESTONE-CANDIDATE.md — this is the clearest requirement statement that milestone has
  - Phase 209 (registered) — makes a step LEGIBLE; this seed is about what a step can DO
  - SEED-146 (integration capability surface) · SEED-199 (xyops canvas grammar)
  - screenshots/ — the three reference designs the operator supplied
trigger_when: >
  Before the Connections & Open Platform milestone is SCOPED. This is the requirement it should be
  scoped against, and the competitor research it asks for has not been done.
---

# SEED-202 — the operator's picture, in their own words

> *"I still do not have a vision how this should look like and how this should function, but at
> least I can imagine that when I describe to the AI — for example, only example, we should
> generalize this — I will describe to the AI: pull the latest risk register report, for example,
> from knowledge base; then go to Slack and read whatever other information, and add that up to what
> we saw in the knowledge base; and then analyse and do the report. Then, for example, another
> action will be to generate a report, then send it to an email or send it to Slack or any external
> MCP. This is how I see it, but it is not still mature in my head how it should look like. That's
> why you should leverage others' experience on how they do it and how it should fit in our
> application."*

⚠ **Recorded VERBATIM and deliberately.** The operator said twice that the picture is not finished.
Paraphrasing it into a tidy spec would throw away the one thing that makes it useful — that it is a
description of an *outcome*, not of a feature set, and the design has to be argued back from it.

## ⭐ THE FINDING NOBODY HAS NAMED: half of this is a READ, and we only do WRITES

Broken into steps, the example is:

| # | Step | What it needs | Do we have it? |
|---|---|---|---|
| 1 | pull the latest risk register **from the knowledge base** | KB retrieval | ✅ shipped |
| 2 | **go to Slack and READ** other information | **an inbound read from an external system** | ⛔ **NOTHING** |
| 3 | add it to what the KB gave us | blend two sources in one run | ✅ (accumulated outputs) |
| 4 | analyse and write the report | LLM step | ✅ shipped |
| 5 | send it to email / Slack / **any external MCP** | outbound action | ✅ shipped |

**Step 2 is the gap, and it is not a small one.** `external_action` is write-only by construction:
its whole vocabulary is *"reaches outside"*, *"changes something outside"*, *"stops and asks you
first"*, and its three capabilities are `send_email` / `create_ticket` / `post_message` — three
verbs that all push. There is **no shape at all** for *read from Slack*, *read from Drive*, *read
this Jira board*.

⚠ **And MCP already broke this assumption without anyone noticing.** `read_wiki_structure` — the
tool driven live on 2026-08-25 — **is a read**. It went through the "changes something outside"
path, stopped for an approval it did not need, and the canvas told the operator it changes something
outside. Phase 209 fixes the *label*. **This seed is about the fact that the label was only wrong
because the model underneath has one direction.**

## The second half: the AI builds it from a description

The operator describes the outcome and **the AI assembles the steps**. That path exists — the
*"Draft it for me"* door — but it can only assemble from the vocabulary it has. A describe-to-build
flow cannot produce *"read from Slack"* while no such step exists. **The authoring surface and the
step vocabulary have to grow together, or the describe box will keep writing workflows the engine
cannot express.**

## ⚠ WHAT IS OWED BEFORE THIS IS SCOPED — and it has NOT been done

The operator's instruction was explicit: *"leverage others' experience on how they do it and how it
should fit in our application."* **No competitor research exists for this.** The three screenshots
are reference *designs*, not a study. What is owed, before the milestone is scoped:

1. **How the leaders model a read.** n8n, Zapier, Make, Windmill, Activepieces, Gumloop —
   do they split *triggers* / *reads* / *writes*, and where does the approval gate sit when a step
   only reads? ⚠ Note the recorded finding that **n8n's MCP server is an AUTHORING server** — its
   whole execution surface is two tools — so it is a reference for *shape*, not for *mechanism*.
2. **How they present a catalog** of hundreds of services without a "capability" taxonomy.
3. **How the describe-to-build flow stays honest** when the catalog is large — what does the AI
   offer when it does not know a service?
4. **What OAuth costs**, since none exists in this product today and a famous-service catalog
   cannot be reached without it.

⚠ **Provider-docs-first applies**: read each product's own documentation rather than a blog
comparison, and cross-check against what our engine can actually express.

## What this seed does NOT decide

Nothing about implementation. It records the requirement, names the one structural gap it exposes
(read vs. write), and states that the research the operator asked for is **owed and undone**. A
milestone scoped without that research would be scoped from three screenshots and one example.
