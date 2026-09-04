---
seed_id: SEED-239
title: "ONE malformed `config` on ONE connection makes EVERY connection in the org unreadable — `list_connections` validates inside a list comprehension, so a single bad key answers API 503 for the whole page"
created: 2026-09-01
planted_during: Phase 222 crypto half — after I caused exactly this on a live database by writing an OAuth-shaped key into an MCP row's config
status: planted
surface: Agentic-RAG
severity: high
category: connectors / resilience / blast-radius
priority: high
relates_to:
  - Phase 222 (222-CRYPTO-SUMMARY.md §4) — the incident that exposed it, and the `McpConfig` widening that fixed the SYMPTOM but not this
  - reference_connector_connections_column_grant_trap (memory) — the same OUTCOME (503 + "Could not load connections") from a different cause, which is precisely why this one was hard to place
  - migration 150 — the rule this obeys (`config` holds ids, never secrets)
trigger_when:
  - ANY migration adds, renames or moves a key inside `connector_connections.config`
  - Any new member is added to the `ConnectorConfig` union, or any config model's `extra='forbid'` is reconsidered
  - Anyone reports "Could not load connections" while individual connections are demonstrably fine
  - Any other list endpoint is found validating rows inside a comprehension
---

# SEED-239 — a per-row defect with a per-org blast radius

## What happens

`connector_service.list_connections` ends at `:956`:

```python
return [_to_response(row) for row in rows]
```

`_to_response` (`:407`) runs Pydantic validation on each row's `config` against the
`ConnectorConfig` union. **Every member of that union is `extra='forbid'`.** So a row carrying
one key no member declares matches nothing, `_to_response` raises, and the comprehension —
which has no per-row boundary — takes the entire list down with it.

**Measured, on the live local database, 2026-09-01:** writing `custom_client_id` (an
OAuth-row-shaped key) into an **MCP** row's config made **all nine** connections unreadable.
The API answered **503** and the page rendered:

> *"Could not load connections. Nothing is wrong with them — this page could not read them."*

⭐ **That copy was exactly true, and that is what made it hard to place.** Eight rows were
perfect; one key on a ninth stopped the projection.

⚠ **AND IT MIMICS A DIFFERENT DEFECT EXACTLY.** The 503 and that sentence are also the
signature of the Phase 212 column-grant trap. My first diagnosis was that one, and it was
wrong — columns and grants measured fine and the select worked as `authenticated`. Only calling
`list_connections` directly gave the real answer. **Acting on the first hypothesis would have
meant rewriting grants that were not broken.**

## Why widening `McpConfig` did not close this

Phase 222 widened `McpConfig` to declare `custom_client_id`, which fixed *that* key. It changed
nothing about the mechanism: **the next migration that touches `config` reproduces this in
full**, and so does any hand-written row, any partially-applied migration, and any row written
by a newer version of the app and read by an older one.

⚠ **Cloud parity makes it likelier, not less.** A migration applied locally and not in cloud
(or the reverse) is precisely the state in which one environment writes a key the other's models
do not declare.

## The shape of a fix — deliberately not taken here

It was not Phase 222's to take, and it is a decision about what a list endpoint OWES rather than
a bug fix:

- **Validate per row, and let a bad row be a bad row.** A row that fails should degrade to an
  honest single-row error state — the page still lists the other eight — rather than deleting
  the page.
- ⚠ **Whatever it degrades to must not read as "this connection is fine".** A silently skipped
  row is worse than a 503: the operator sees a shorter list and no reason, which is the
  invisible-failure shape this project has repeatedly paid for.
- **The other six `_to_response` call sites are single-row and are NOT affected** (`:928`,
  `:978`, `:1080`, `:1097`, `:1228`, `:1393`) — there, raising is correct. **Only `:956` turns a
  row's problem into the org's problem.**
