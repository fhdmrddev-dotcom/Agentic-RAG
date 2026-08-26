---
seed_id: SEED-202
title: "The operator's own picture of what a workflow should be — pull from the knowledge base, READ from Slack, blend, analyse, then deliver to email / Slack / any MCP. ⚠ It exposes a gap nobody has named: external_action is WRITE-ONLY, and half this vision is READS."
created: 2026-08-25
planted_during: conversation with the operator, 2026-08-25, immediately after Phase 209 was registered
status: planted
diagnosis_status: PARTLY REFUTED 2026-08-25 by .planning/research/connections-competitor-study.md — the REQUIREMENT stands; two of this seed's supporting claims do not. Read the correction before scoping anything from it.
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


---

## ⚠ CORRECTED 2026-08-25 BY THE COMPETITOR STUDY — TWO CLAIMS ABOVE ARE WRONG

The operator's requirement is untouched. **Two things I asserted to support it are refuted**, and
both are kept above rather than rewritten, because the way they were wrong is the useful part.

**1. ⛔ *"`external_action` is WRITE-ONLY"* — REFUTED at source.**
`phase_types.py:2542` returns `{"text": tool_result.get("text", "")}` into `accumulated_outputs`.
**Step 2 of the operator's example — go and READ, then blend it with the KB — is EXECUTABLE AT HEAD**
against any MCP server exposing a Slack read tool. What is missing is not the data path. It is
(a) a way to *declare* a step's direction and (b) a first-party path that does not require the user
to know what an MCP server is. **That is a much smaller and much cheaper gap than this seed claimed.**

**2. ⚠ *"It stopped for an approval it did not need"* — HALF WRONG, and the half that is wrong
matters.** MCP specifies `readOnlyHint` default **`false`** and `destructiveHint` default **`true`**:
an unannotated tool is *specified* to be treated as destructive. **Our gate defaulted correctly.**
The real defect is narrower and more actionable — **we never read the hint.**
⚠ `mcp_client.py:293-296` sanitizes every discovered tool down to `name` / `description` /
`inputSchema`, **discarding `annotations`, `title` and `outputSchema`** — which are, in order, the
direction answer, the catalog label and the output-shape answer. **All three arrive from every
compliant server today and we throw them away.** Verified at source.

**3. Also refuted — the industry does NOT split read from write.** Zapier and Make separate
*searches* from actions for a **data-flow** reason (0..N results, pairs with create-if-not-found),
not a safety one; n8n and Activepieces do not split at all. **The read/write axis is an MCP
invention, not an automation-industry convention** — which *strengthens* the MCP-first verdict
rather than testing it.

**4. And a sequencing correction for the milestone:** six of the operator's eight named services are
reachable at today's credential shape. Only **Google** and **Microsoft Graph** require OAuth. A
"Google + Microsoft first" tier would front-load 100% of the OAuth cost before a single read ships.

**The one open question the whole direction rests on**, and nobody has answered it: **do the official
Atlassian / GitHub MCP servers actually set `readOnlyHint`?** That is one live call.


---

## ⚠ THE OPEN QUESTION IS ANSWERED — LIVE, 2026-08-25 — AND `readOnlyHint` CANNOT CARRY THE DESIGN

The study closed with one question it called the thing *"the whole direction design rests on"*:
**do real MCP servers actually set `readOnlyHint`?** A raw `tools/list` was driven against three.

| Server | Result | `annotations` | `title` | `outputSchema` |
|---|---|---|---|---|
| **DeepWiki** (`mcp.deepwiki.com/mcp`) | HTTP 200 · 3 tools | ⛔ **ABSENT on all 3** | ⛔ ABSENT on all 3 | ✅ **PRESENT on all 3** |
| **Atlassian** (`mcp.atlassian.com/v1/sse`) | **401 `invalid_token`** | not reachable | — | — |
| **GitHub** (`api.githubcopilot.com/mcp/`) | non-JSON (gated) | not reachable | — | — |

### ⭐ The finding

**`read_wiki_structure` — a tool whose NAME BEGINS WITH "read" — ships no `readOnlyHint` at all.**
Under MCP's own defaults (`readOnlyHint: false`, `destructiveHint: true`) it is therefore
*specified* to be treated as destructive, which means **our approval gate is behaving exactly as the
spec instructs.** That half of the earlier correction is confirmed again, from the wire.

**But the consequence for the design is the opposite of what was hoped:**

1. ⛔ **`readOnlyHint` CANNOT be the primary direction signal.** It is OPTIONAL in the spec and it is
   **absent in the wild on the one server we can actually reach.** A design that reads direction
   from the annotation has **no signal at all** against DeepWiki. It can be an OPTIMISATION when
   present — never the mechanism.
2. ✅ **The `outputSchema` half of the sanitizer finding is STRENGTHENED.** It is present on **every**
   tool here, and `mcp_client.py:293-296` discards it. That is the Q1 output-shape answer arriving
   from a real server today and being thrown away — and unlike `annotations`, it is actually there.
3. ⚠ **Two of the three servers are unreachable without OAuth — MEASURED, not predicted.** This is
   Q4 landing in practice, and it supports the study's sequencing correction: **start with the six
   services that work on static credentials**, not with the two that cannot be reached at all.

### What is still open, stated honestly

Atlassian and GitHub remain **untested** — not because the question changed, but because we cannot
authenticate to them. ⚠ **Do not record their behaviour as unknown-but-probably-fine.** If either
turns out to annotate, that is an argument for reading the hint *opportunistically*; it is not an
argument for building the direction model on it, because DeepWiki has already proved the signal can
be missing. **A mechanism that works only on servers that opt in is not a mechanism.**
