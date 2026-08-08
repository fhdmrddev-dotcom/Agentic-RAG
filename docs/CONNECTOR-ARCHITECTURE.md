# Connector architecture — the own-framework-vs-Open-Platform verdict

Canonical, human-readable home of the decision about **how this app reaches other systems**:
whether we build our own connector framework and catalog, or adopt an existing substrate and
sequence breadth with the Open Platform milestone. **This is a RECORD of a decision already made**,
not an argument for it — the reasoning was reached by the 2026-07-24 competitor crawl and by
SEED-013 / SEED-014, all of which are on file and named below. The register entry `D-v3.6-01` in
[`.planning/prd-reset/DECISIONS.md`](../.planning/prd-reset/DECISIONS.md) points here; this doc is
where the full text lives.

> Why this doc exists: the verdict was reached on **2026-07-24** and then lived only inside a
> research crawl and two dormant seeds. Seeds are a *backlog* with re-open triggers — a decision
> buried in one reads as still-pending, and the next person to ask "so are we building connectors
> or not?" would have re-litigated it. That is the alternative Phase 189's decision D-10 rejected,
> and it is the reason this file exists: `docs/` holds the long-lived architecture docs this repo
> actually maintains, and it survives milestone archiving. Requirement **CONN-01** asks that the
> milestone *record* this decision durably; this doc plus `D-v3.6-01` is that record.

## The verdict

**MCP-first, first-party-thin, broad catalog sequenced with Open Platform (SEED-013/014).**

Each clause, spelled out:

- **MCP-first** — when this app does reach outside, it builds against the **Model Context Protocol**
  as the connector substrate rather than hand-rolling a bespoke connector framework with its own
  node type, credential shape and per-vendor adapter layer. The corollary is that *being callable
  via MCP* (this app as an MCP **server**, per SEED-013's second consumer mode) is a first-class
  story, not an afterthought.
- **First-party-thin** — we ship a deliberately **small** first-party set, not a catalog. The
  intended slice is Phase 190's **email out / ticket create / message post** trio, which is exactly
  the closed three-capability set Phase 189 puts on the canvas (`send_email`, `create_ticket`,
  `post_message`). Thin is a *choice*, not a staging post on the way to breadth: nothing is built
  in 189 that Phase 190 cannot later make real.
- **Broad catalog sequenced with Open Platform** — breadth (a large connector directory, inbound
  webhooks, a public API, service accounts) **defers to the Open Platform milestone** described by
  SEED-013 and its sibling SEED-014. It is explicitly **not** forked into v3.6. Competing on
  connector *count* against an incumbent with a multi-year head start is the losing move; being
  *called by* the automation tools users already run, over MCP, is the winning one.

**No arbitrary-code / third-party-package connector node, ever.** An "install a community node"
affordance on a business canvas is a supply-chain surface, and it is out of scope by construction
rather than by omission.

## What this decision is based on

Three sources, all in this repository. **They were read; they are not being re-read, re-crawled or
re-scored here** — Phase 189's decision D-11 records the verdict rather than re-validating it.

- **`.planning/research/deep-dive/GLEAN.md`** (crawled 2026-07-24) — the market leader's own
  extension path is MCP plus OpenAPI, alongside a 275+ connector catalog it took years to build.
  Its own conclusion for us: do not hand-build a catalog; sequence breadth with Open Platform.
- **`.planning/research/deep-dive/BEAM.md`** (crawled 2026-07-24) — MCP used in **both** directions,
  consumed as a connector substrate and exposed as a server, which is the same shape this verdict
  adopts.
- **`.planning/research/deep-dive/N8N.md`** (crawled 2026-07-24) — the open-source node-canvas
  reference, with both an MCP client tool and an MCP server trigger. Its community-node model is
  also the direct argument for *first-party-thin plus no arbitrary-code node*, and its published
  CVE class is why Phase 190's outbound guard (CONN-03) must be unconditional rather than attached
  to credential validation.
- **`.planning/seeds/SEED-013-external-integrations-api-mcp.md`** — the three consumer modes (REST
  API; **MCP, where WE are the server and Claude Desktop / Cursor / Cline are the clients**;
  webhooks) and the Open Platform sequencing this verdict defers breadth to.
- **`.planning/seeds/SEED-014-automations-routines.md`** — the automations sibling, binding on
  shape: *"do not plan automations as a separate primitive — plan them as a runtime mode for
  skills"*. Its `relates_to` names SEED-013 explicitly, which is why the two seeds are sequenced
  together rather than separately.

⚠ **SEED-031 is the LLM-provider seed, NOT connectors.** It is named here only so the next reader
does not cite it: the connector track is SEED-013 and SEED-014, and citing SEED-031 for connector
decisions is a category error that would otherwise be inherited.

**Status of the substrate in this codebase, measured 2026-08-07:** there is **zero MCP code in
`backend/app`** (`grep -rni "\bmcp\b" backend/app --include=*.py` → 0 hits). The MCP servers
configured in `.mcp.json` are *consumed by Claude Code*, not served by this app — SEED-013 recorded
the same fact at v2.5 close and it has held continuously since. **"MCP-backed" on this page is a
chosen direction, not existing infrastructure.** Nothing in this doc should be read as describing a
client that exists or is being built by Phase 189.

## What it does NOT decide

This is the substrate-and-sequencing decision only. The following are Phase 190 / CONN-02 / CONN-03
work and are deliberately absent here:

- **The credential model** — org scoping, encryption-at-rest reuse, and server-side resolution by
  reference (never in the definition JSONB, never in the client).
- **The egress guard** — the unconditional SSRF / allow-list check on every outbound fetch,
  *regardless of credential state*.
- **Who may extend the capability set, and how** — not raised, and it belongs with the connector
  credential and org-scoping work.
- **The pinned MCP specification version and its deprecation cycle** — Phase 190 pins it regardless
  of this doc.

**Phase 189 ships no live outbound egress at all.** Its external-action node records what it *would*
have done and sends nothing. **And Phase 190 is STRETCH and gated** — so there is a real, accepted
path in which this decision stands recorded and the first live connector never ships in this
milestone. That is stated rather than smoothed over: the record is the deliverable, and it is
independent of whether the connector arrives.

## The re-open trigger

**Dated 2026-08-07.** This verdict is durable, not permanent. It is re-opened only by one of the
following, each with the observable that tells a future reader whether it has fired. Re-opening
means amending this doc and adding a **superseding** `D-vX.Y-NN` entry to
`.planning/prd-reset/DECISIONS.md` — never editing the verdict in place without a trace.

1. **MCP specification churn breaks the client contract we would build against.**
   *Observable:* an upstream MCP spec revision whose own changelog marks the tool-invocation or
   transport surface as backward-incompatible, landing before or after Phase 190 pins a version —
   i.e. the pinned version can no longer be carried forward without re-authoring the client seam.
2. **A real connector need that no MCP server covers.**
   *Observable:* a named operator or customer request for an integration for which no maintained
   MCP server exists at the time of the request, forcing a first-party integration **outside** the
   thin set (`send_email`, `create_ticket`, `post_message`). One such request re-opens
   *first-party-thin*; it does not by itself re-open *MCP-first*.
3. **Open Platform slips past the point where breadth is commercially needed.**
   *Observable:* connector breadth blocks a real deal or a real user while the Open Platform
   milestone (SEED-013 / SEED-014) still has no phase number on `.planning/ROADMAP.md` — that is,
   breadth becomes urgent before the milestone that owns it is scheduled.

If none of the three has fired, this verdict stands and does not need re-argued.

## Where the governed node model lives

Phase 189 (requirement CONN-01) ships the **vocabulary and governance wiring** for an
external-action step, with no network call anywhere in it:

- A 7th workflow phase type, `external_action`, on the canvas.
- Its chosen capability is an entry in the phase's existing `available_tools` whitelist, so it rides
  the tool guard that already exists — zero new governance concept.
- Its approval checkpoint is armed structurally and cannot be turned off by the author.
- On approval the step **records the intended action and the run continues**; the phase reads
  *"Not sent — recorded"*, never *complete*.

Phase 190 (CONN-02 / CONN-03, STRETCH) swaps that no-op for a real MCP-backed call behind an
unchanged seam. Until then, the honest summary is: **the direction is recorded, the rails are built,
and nothing sends.**

## Recorded direction 2026-08-08 — connectors are TWO-WAY; this verdict only ever described the outbound half

**This is an addition, not an amendment.** The verdict above stands in full: MCP-first,
first-party-thin, broad catalog sequenced with Open Platform. Nothing in it is retracted here.

What is added is a direction the operator gave immediately after the Phase 190 context lock, which
this page had no clause for either way:

> "it should be a two way communication… we need the ability to read write to pull something from
> Jira from email from Slack from anything. And also to send."

Everything this doc and Phase 190 describe is **outbound** — `send_email`, `create_ticket`,
`post_message` are three writes. There is no read anywhere on the connector track, and knowledge-base
ingestion is manual-upload-only by a standing rule. The operator's direction is that the app must also
**pull** from external systems inside a workflow, and that a connected drive should **auto-ingest**
into the knowledge base.

**Where it lands:** the Open Platform milestone (SEED-013 / SEED-014), as an input to its scope rather
than a follow-on. SEED-013's `## Update 2026-08-08` records it as a fourth consumer mode — *us as MCP
client* — alongside the three inbound modes it already lists. The full analysis is
[`SEED-142`](../.planning/seeds/SEED-142-two-way-connectors-read-pull-auto-ingest.md).

**What it changes about Phase 190: nothing.** 190 stays outbound-only, three capabilities, static
tokens, no OAuth, no scheduler — it is gated on `threats_open: 0` and it *builds the prerequisites*
two-way needs (the org-scoped credential store, the egress guard, the `ConnectorAdapter` seam).
Read adapters register through that same seam later. The protocol is already MCP-shaped, so it
accommodates a read return value without being widened today.

**Which re-open trigger this is, precisely:** none of the three above has fired. Trigger 2 ("a real
connector need that no MCP server covers") is *not* what happened — the ask is for a direction the
verdict never scoped, not for a connector outside the thin set. Recording it here keeps the next
reader from mistaking silence-on-reads for a decision that reads are out.
