---
seed_id: SEED-246
title: "Grow the service catalog deliberately — every service we can reach, OAuth families prioritised, and the legacy shapes kept rather than quietly retired"
created: 2026-09-04
planted_during: v3.9 production push, operator direction — *"for the connectors just to make sure that we looked in the seed… we should later expand the list and integrate whatever we can and especially prioritising the ones with OAuth connection and also the old connection methods"*
status: planted
surface: Agentic-RAG
severity: medium
category: connectors / catalog / product-breadth
priority: high
relates_to:
  - SEED-146 (the integration-capability umbrella) — this seed IS its named-but-unowned **catalog dimension**
  - SEED-144 (provider-shaped connections + OAuth) — the SHAPE dimension; largely ANSWERED by v3.9, see below
  - SEED-013 (External Integrations — public API, MCP server, webhooks) — the INBOUND twin; do not conflate
  - SEED-142 (connected-drive auto-ingest) — a READ consumer of whatever this catalog holds
  - SEED-215 (official service logos) — every row added here owes a mark, or it draws the generic MCP plug
  - SEED-237 / SEED-238 / SEED-239 — open connector defects; **breadth on a broken base multiplies the blast radius**
trigger_when:
  - Scoping any milestone whose name contains "connectors", "integrations", "catalog" or "breadth"
  - A customer, partner or demo asks *"which apps do you integrate with?"* — the answer's LENGTH is this seed
  - A second service in the same OAuth family is wanted (e.g. Outlook after Microsoft 365) — the family is already paid for, so the marginal row is nearly free
  - Anyone proposes ADDING a service by writing per-service code — that is the signal the shape is wrong, not that the service is hard
  - Anyone proposes DELETING the legacy capability rows (`jira`, `smtp`) — see the standing rule below
---

# SEED-246: grow the catalog on purpose, not by accident

## Where it stands today — measured at the v3.9 close, not estimated

`frontend/src/components/settings/servicesCatalog.ts` holds **13 entries**, in **three shapes**:

| shape | rows | what adding one costs |
|---|---|---|
| `shape: "mcp"` | slack, github, notion, figma, linear, sentry, intercom, miro, **`custom_mcp`** | a few strings — a name, a mark, a default host |
| `shape: "oauth"` | google (`oauthProvider: "google"`), microsoft (`"microsoft"`) | **code, per AUTH FAMILY** — see the trap below |
| legacy capability (**no `shape` field**) | **jira, smtp** | not added any more; kept working by `CONN-05` |

⭐ **`custom_mcp` is why the menu is already unbounded.** A person pastes any MCP URL and gets its
tools with **zero engineering on our side** — proven in v3.9 against four real servers, and proven
hardest by **Notion: 41 tools for zero lines of tool code**, via RFC 7591 dynamic registration with no
developer console. So "expand the list" is not about *reach*. It is about **curation** — which
services get a mark, a one-line purpose and a Popular slot, so a person finds them the way they find
an app instead of having to know a URL.

## The operator's direction, and the one place it needs a caveat

The direction is: **expand the list, integrate whatever we can, prioritise OAuth, and keep the old
connection methods.** Three of those four are straightforwardly right. The OAuth priority carries a
trap worth naming before a milestone is scoped around it.

⚠ **OAuth is the MOST expensive shape per service, and the cost is per AUTH FAMILY rather than per
product.** `oauthProvider` is a **closed union** — `"google" | "microsoft" | "github"`
(`servicesCatalog.ts:30`). A fourth family means code, not a row. But *within* a family the marginal
cost collapses: v3.9 put **six Google applications under one token with 11/11 live writes**, so Gmail,
Calendar, Drive, Docs, Sheets and Slides cost one family between them.

**So the honest reading of "prioritise OAuth" is: prioritise OAuth FAMILIES, then harvest every
application inside each one.** Ranked by what the family unlocks, not by how well-known one app is:

1. **Google** ✅ already paid for — harvest anything still unexposed inside it
2. **Microsoft** ✅ already paid for — Outlook, Teams, OneDrive, SharePoint are marginal rows, not projects
3. **The next family** — chosen by what customers actually ask for, priced as *one* engineering unit

⚠ **And prefer the MCP door wherever the vendor offers one.** If a service ships an official MCP
server, an `mcp` row reaches it for a few strings and inherits per-tool grants for free. Reaching for
OAuth when MCP would do is paying the expensive price for the cheaper outcome.

## The standing rule this seed exists to protect

⛔ **The legacy capability rows must NOT be deleted.** `jira` and `smtp` carry no `shape` field and are
the last survivors of the three-verb model. `CONN-05` states it exactly: they keep working **as one
shape among many** and organise no surface. Measured at `phase_types.py:2311-2322` — **they are the
only external path that works with NO MCP server at all**, which is precisely what an air-gapped or
locked-down install has.

The operator's *"and also the old connection methods"* is this rule, and it should be read as
**extend them where they are the only thing that works**, not merely tolerate them. SMTP in
particular has no MCP equivalent for an install that cannot reach the public internet.

## What a phase built on this should actually do

1. **Inventory the reachable set** — vendors with an official MCP server, then vendors inside the two
   paid-for OAuth families. Cheapest first; the list writes itself from cost order.
2. **Curate rather than accumulate.** A row earns its place with a mark (`SEED-215` — a row with no
   mark draws the generic plug and looks broken), a one-line purpose, and a reason a person would
   pick it. 13 good rows beat 60 unmarked ones.
3. **Fix the shape before the breadth.** If a service needs per-service code, that is a defect in the
   connection model — v3.9's whole thesis is *"adding a service adds rows, not code"*. Widen
   `oauthProvider` from a closed union to data before adding the fourth family.
4. ⚠ **Land the open connector defects first.** `SEED-237` (Microsoft connects and yields nothing),
   `SEED-238` (MCP tokens never refresh, and the shipped engine would post Notion's token to Google)
   and `SEED-239` (one malformed config row makes every connection in the org unreadable) are all
   open. **Breadth multiplies every one of them.** `SEED-238` in particular is a cross-service
   credential leak whose severity scales directly with the number of connected services.

## ⚠ Answer SEED-144 when this is picked up

`SEED-144` still reads `status: planted`, and most of its `trigger_when` list has **already fired and
been answered by v3.9** — provider-shaped connections, OAuth instead of pasted tokens, one account
with many capabilities, refresh handling. It should be re-read and largely closed at the same time,
or it will keep being re-proposed forever. Its live remainder is credential rotation.
