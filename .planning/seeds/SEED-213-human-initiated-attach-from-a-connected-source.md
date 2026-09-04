---
id: SEED-213
title: Human-initiated attach from a connected source (interaction mode C) — the one connector scenario that dodges every hard problem, and it is named nowhere
status: planted
planted: 2026-08-26
planted_by: Claude, 2026-08-26, from the interaction-mode taxonomy derived during the connector-scenarios brainstorm
surface: Agentic-RAG
severity: info
category: product / connector surface — the cheap win
priority: medium
scope: Small — a picker plus a fetch; no sync engine, no approval model, no OAuth beyond read scope
affected_areas: [connectors, chat, composer, documents, ingestion, frontend/chat]
related_seeds: [SEED-142, SEED-209, SEED-210, SEED-145, SEED-146]
re_open_trigger: >
  Re-open when ANY of these is true: (1) the Connections milestone is scoped — this is the smallest
  shippable slice of it and should be sequenced first deliberately rather than skipped; (2) a user
  asks to attach a Drive/OneDrive file to a chat and the only answer is "download it and upload it";
  (3) any OAuth read scope for a storage provider is obtained for another reason — the picker is then
  nearly free; (4) a sync connector is proposed WITHOUT this existing, since a picker is how a user
  learns what a connection is before trusting it with a background sync.
---

# SEED-213 — the connector scenario that needs none of the hard parts

## The mode

From the interaction-mode taxonomy (folded into `.planning/CONNECTIONS-MILESTONE-CANDIDATE.md`), the
seven modes are: **A** agent pulls in chat · **B** agent writes in chat · **C** human attaches from a
connected source · **D** continuous background sync · **E** event-triggered ingest · **F** scheduled
outbound · **G** us as MCP server.

**Mode C is the only one with no recorded home.** A, B, D, F and G all have seeds or milestone scope.
C — *"add a file from Drive"* in the composer or the documents page — appears nowhere.

## Why it is worth naming separately

It is the only connector scenario that is **an upload with a different source**. Compare what each
mode requires:

| Requirement | C (attach) | A/B (agent in chat) | D (sync) | E (event ingest) |
|---|---|---|---|---|
| OAuth read scope | yes | yes | yes | yes |
| Per-tool approval model (§6) | **no** | **yes** | no | no |
| Prompt-injection provenance | **no** | **yes** | yes | yes |
| Delta detection / cursors | **no** | no | **yes** | webhook |
| Scheduler | **no** | no | **yes** | **yes** |
| Source-ACL model (SEED-210) | **no** — the human picking it can already read it | partly | **yes** | **yes** |
| Lifecycle propagation (SEED-210) | **no** — it is a point-in-time copy | n/a | **yes** | **yes** |

**Six of the seven hard problems do not apply**, and the reason is structural rather than lucky: a
person who picks a file has already proven they can read it, and a one-shot copy has no ongoing
relationship with the source to keep consistent. That is exactly the property the standing
manual-upload rule relied on (SEED-210), so mode C preserves the security assumption the sync modes
break.

## What it is

A picker — the pattern every comparable product ships — reachable from the composer and from the
documents page:

- Browse or search the connected drive, pick one or more files.
- Fetch, then enter through **the same ingest splice as an upload** (SEED-209's binding rule — it
  applies here too, and this is the cheapest place to establish it).
- Record provenance as metadata (`source_system`, `external_id`, path, source author) so the
  classification rules can route it and so a later sync connector can recognise the same file rather
  than duplicating it.

That last point is the sleeper benefit: **mode C is where the source-identity key (SEED-209 §2) gets
built and proven** on a low-risk path, before a sync engine depends on it.

## Why to sequence it first

1. **It is what users ask for first.** "Attach from Drive" is a familiar affordance; a background sync
   is a trust decision.
2. **It makes the connection legible.** A freshly connected provider is otherwise a capability with no
   visible way in — the same problem the milestone candidate's §6b prompt-suggestion chips address for
   chat. A picker is the equivalent for storage.
3. **It de-risks the OAuth work** by exercising the token, refresh and scope handling on a path where a
   failure is a visible error to one person, not a silent gap in a corpus.
4. **It builds three things the sync modes need** — the OAuth connection, the provenance fields and
   the identity key — with none of the machinery that makes those modes expensive.

## What it is NOT

- **Not a sync.** A file attached this way is a copy taken at a moment. If the source changes, this
  copy does not — and **the UI must say so**, or users will assume it is live. That sentence is the
  whole honesty requirement for this feature, and it is the kind of over-claim this project's own
  vocabulary discipline exists to prevent.
- **Not an agent capability.** The model does not choose to fetch; a person does. If it later becomes
  a tool the model may call, that is mode A and it inherits mode A's approval and provenance
  requirements — a distinction worth keeping sharp, because "let the agent use the picker" is the
  natural-sounding request that silently crosses it.
