---
seed_id: SEED-204
title: "THREE paths to any external application — authenticate (OAuth), or MCP, or a plain API — and 'no OAuth exists today' is a GAP TO FILL, never a boundary. Plus: the capability belongs in CHAT, not only on the canvas, organised the way Claude.ai organises Connectors and Plugins."
created: 2026-08-25
planted_during: conversation with the operator, 2026-08-25, at the close of v3.8 — immediately after being told the orientation map read as though OAuth were a limitation
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - SEED-202 — the operator's vision (pull from KB, READ from Slack, blend, analyse, deliver). THIS seed is the MECHANISM half of that one's REQUIREMENT half.
  - SEED-199 — the xyOps canvas grammar; connectors as glyph NODES
  - SEED-146 / SEED-145 — connections as platform assets, usable from chat
  - SEED-142 — connected-drive auto-ingest, the third consumer of one connection
  - SEED-186 / 187 / 188 — the community skill/plugin ecosystem
  - .planning/CONNECTIONS-MILESTONE-CANDIDATE.md — the milestone this scopes into
  - .planning/research/connections-competitor-study.md — the four owed questions, answered
  - screenshots/ — Claude.ai Connectors + the Claude.ai Plugins directory, the IA reference
trigger_when: >
  Before the Connections & Open Platform milestone is SCOPED. Read this together with SEED-202:
  that one is WHAT a workflow should be able to do, this one is HOW we reach anything at all,
  and WHERE the capability has to live.
---

# SEED-204 — three paths in, and the correction that prompted it

## The operator's words, verbatim

> *"…for the connectors and for the other capabilities like plugins and everything — I am just
> imagining how it should be organized similar to Claude.ai, which I shared in the screenshot folder
> of this project. And also… when we are planning to use those tools in the thread or the chat area,
> where I can add to the chat the capability to connect externally to other applications. And when
> you said OAuth does not exist — that does not mean that we will not do it. We should be able to
> connect to any external application simply by just either authenticating, or if not, maybe they
> have MCP or API."*

⚠ **Recorded verbatim, deliberately** — the same rule `SEED-202` was recorded under. The value is
that it states an *ambition* and a *fallback ladder*, not a feature list.

---

## ⚠ THE CORRECTION THAT CAUSED THIS SEED

`.planning/ORIENTATION-260825-connections-and-canvas.md` said, in bold:

> *"There is NO OAuth in this product. None."*

**Every word of that is factually true and the framing was wrong.** It reads as a boundary — as
though OAuth were a thing we had decided against — when it is simply **work not yet done**. The
operator corrected it directly: *"that does not mean that we will not do it."*

⚠ **The distinction is load-bearing for sequencing.** A limitation gets designed AROUND; a gap gets
FILLED. The competitor study's advice — *start with the six services that work on static credentials,
because a Google-and-Microsoft-first tier front-loads 100% of the OAuth cost* — is still correct **as
an ordering**, and it must never be read as *"we do not do OAuth"*. It says *do OAuth second*, not
*do not do OAuth*.

---

## ⭐ THE THREE PATHS — and the third one is NOT captured anywhere today

The operator's ladder, made explicit:

| # | Path | What it means | State of the record |
|---|---|---|---|
| 1 | **Authenticate** — OAuth | The service has a real OAuth app; we hold refresh tokens and expiry | ✅ captured (`CONNECTIONS-MILESTONE-CANDIDATE.md` §1, §3) — **not built** |
| 2 | **MCP** | The service publishes an MCP server; we consume it | ✅ **BUILT AND DRIVEN LIVE** (Phase 206 / 206.1 / 206.2 / 206.3) |
| 3 | **A plain API** | The service has neither an OAuth app we support nor an MCP server — but it has an HTTP API and a key | ⛔ **NOT CAPTURED ANYWHERE** |

⚠ **Path 3 is the gap this seed exists to record.** A grep of the connections milestone candidate for
a generic/custom API path returns **nothing**: its only "REST API" line (§7) is about *this app
exposing* an inbound API, which is the opposite direction. So today the written plan says: if a
service has no OAuth app we have built and no MCP server, **it is unreachable** — and that
contradicts *"connect to any external application."*

**What path 3 has to answer, at minimum:**
- Who describes the endpoint, the auth header and the response shape — a person, or the model?
- How does it stay inside the **approval model** (every capability is a WRITE until proven otherwise)?
- How does it avoid becoming a second `execute_code` — an arbitrary-egress hole wearing a connector's
  clothes? ⚠ **The D-06 egress guard and `validate_destination` are the existing fence and must bind
  path 3 exactly as they bind path 2.**
- Does it reuse the MCP tool-grant model (per-tool allow/deny), or does it need its own?

⚠ **Do NOT design path 3 as "let the agent call any URL."** That is the shape the whole 189/190
governance line exists to prevent, and it would retire the egress fence rather than satisfy it.

---

## The second half: WHERE the capability lives

> *"when we are planning to use those tools in the thread or the chat area, where I can add to the
> chat the capability to connect externally to other applications"*

**Connections must be usable from CHAT, not only from the workflow canvas.** This IS already captured
(`CONNECTIONS-MILESTONE-CANDIDATE.md` §5, and `SEED-145` / `SEED-146`), and it is worth restating
because it is the part that **does not come for free**:

⚠ **Phase 189/190's outbound governance lives on the workflow canvas and DOES NOT TRANSFER TO CHAT.**
The canvas has an authoring step, a governance dial, an approval checkpoint and a publish gauntlet.
Chat has a model deciding, mid-sentence, to call something. **The approval model is therefore a HARD
PREREQUISITE for the chat surface, not a feature of it** — and the standing rule stands:

> **NEVER add an outbound capability to `_TOOL_REGISTRY` before the approval model exists.**

**What "add to the chat" should mean concretely** — to be designed, not assumed here: something like
the composer's existing attach affordance, but for *connections* rather than files, so a person can
say "use my Slack for this thread" and the agent gains exactly that reach, visibly, for that thread.

---

## The third half: HOW IT IS ORGANISED — the Claude.ai shape

> *"how it should be organized similar to Claude.ai, which I shared in the screenshot folder"*

`screenshots/` holds the reference IA and it is already named in the milestone doc (§6c), from two
screens:

- **Claude.ai Connectors** — a connection is a row with the service's **own real logo**, a one-line
  purpose, and a state. ⚠ Our `connectionMark.tsx` already implements the logo half; the icon
  convention forbids hand-drawing a trademark.
- **Claude.ai Plugins directory** — `search` + `Filter by` + `Sort by`, then **icon + name + one-line
  purpose** per entry. **That is the catalog shape for breadth**, and it is how hundreds of services
  are presented without a "capability" taxonomy — which matters, because our three-verb taxonomy
  (`send_email` / `create_ticket` / `post_message`) is exactly what Phase 209 is fixing.

⚠ **"Plugins" is a SECOND catalog, not the same one as Connectors**, and the distinction should be
kept: a *connector* is a way to reach a service; a *plugin/skill* is a packaged capability. We
already have the skill half — `SEED-186` records that community skill repos are **one predicate away**
(`_find_skill_entries` matches depth-2 only, so every public skill repo 400s). **A "Plugins directory"
in the Claude.ai sense is the skill catalog plus that predicate fix**, and it should be sequenced
beside the connector catalog rather than invented separately.

---

## What this seed does NOT decide

Nothing about implementation, ordering inside the milestone, or which of the three paths ships first.
It records: **(a)** the fallback ladder as the operator stated it, **(b)** that path 3 is absent from
every planning document, **(c)** that the "no OAuth" framing was a gap and not a verdict, and
**(d)** that chat and the Claude.ai-style catalog IA are part of the same ask rather than follow-ups.
