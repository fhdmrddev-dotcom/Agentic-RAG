---
seed_id: SEED-200
title: "An MCP connection cannot be bound to ANY workflow step — ConnectionPicker reads capability-scoped, an MCP row has no capability, so McpToolPicker/mcp-discover-btn has no reachable mount and updateConnectorGrants has no UI caller at all. Phase 206's downstream half is built-but-unreachable."
created: 2026-08-25
planted_during: Phase 206.1 plan 03, Task 3 (the driven SC#1b round trip). Measured in a real browser and then confirmed over the wire with the org admin's own JWT.
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - Phase 206 (MCP Connector Client). It shipped the client, SSRF defense, discovery, per-tool
    grants, executor dispatch and audit — and this is the SECOND door it did not ship.
  - Phase 206.1 (this phase). It closed the FIRST missing door (Settings can now create an MCP
    connection). SC#1a is met; **SC#1b is blocked by this seed.**
  - `frontend/src/components/workflows/ConnectionPicker.tsx:271` — `listConnectorConnections(capability)`,
    always capability-scoped. ⚠ THE SINGLE LINE THIS SEED IS ABOUT.
  - `frontend/src/components/workflows/ExternalActionSection.tsx` — `EXTERNAL_ACTION_CAPABILITIES`,
    a CLOSED client mirror of `ExternalActionPhaseConfig.capability`. Three members, no MCP.
  - `frontend/src/components/workflows/McpToolPicker.tsx` — mounts only when `bound?.mcp_server_url`.
    **No reachable mount today.**
  - `frontend/src/lib/api.ts` — `updateConnectorGrants`, which has **no caller outside `api.ts`**.
  - `backend/app/models/harness.py:260` — `capability: Literal[...] | None`, whose own comment reads
    *"an MCP step names a `tool_name` and has no capability at all, which is a legitimate absence"*.
    **The backend is ready.**
  - SEED-146 / SEED-145 — connections as platform assets.
  - SEED-199 — the xyOps canvas grammar; a connector as a NODE rather than a form field.
trigger_when: >
  ALREADY TRUE. This blocks Phase 206.1's SC#1b right now, and it blocks any use of Phase 206's
  MCP feature by anyone at all: a person can create an MCP connection and then has nowhere to
  put it. Fire at the next milestone scope, or sooner if an operator asks why the MCP
  connection they created does nothing.
---

# SEED-200 — the second missing door: an MCP connection has nowhere to go

## What was measured, 2026-08-25

Phase 206.1 created an MCP connection **entirely through the UI** (no direct database write) and then
tried to bind it to an `external_action` step in the workflow builder. It could not.

| Layer | Reading | Source |
|---|---|---|
| `GET /connectors/connections` (unfiltered) | `200` · **3 rows, MCP row PRESENT** | wire, org-admin JWT |
| `GET …?capability=send_email` | `200` · 0 rows · MCP absent | wire |
| `GET …?capability=create_ticket` | `200` · 1 row · MCP absent | wire |
| `GET …?capability=post_message` | `200` · 1 row · MCP absent | wire |
| `POST /connectors/connections/{id}/discover` | **`200` · 3 tools** (`ask_question`, `read_wiki_contents`, `read_wiki_structure`) | wire |
| the builder's rail, external_action step | renders **`connection-picker-empty`** — *"No email connection yet — add one in Settings → Connections."* | real browser |

## The chain, at the source

1. `ExternalActionSection` offers exactly the three members of `EXTERNAL_ACTION_CAPABILITIES` — a
   closed client mirror of `ExternalActionPhaseConfig.capability`. **There is no MCP option.**
2. `ConnectionPicker` is therefore always handed a capability, and calls
   `listConnectorConnections(capability)` → `GET /connectors/connections?capability=…`.
3. An MCP row has `capability = null`. **It is filtered out of every read the picker ever performs.**
4. `McpToolPicker` mounts only when `bound?.mcp_server_url` is set, and `bound` can only ever be a
   capability row. ⇒ **`mcp-discover-btn` has no reachable mount in the shipped product.**
5. `updateConnectorGrants` exists in `api.ts` and is called by **nothing**. `McpToolPicker` *displays*
   a granted/denied badge; **no control flips a grant.**

## Why this is the Phase-118 shape, and why it was invisible

The backend supports the MCP step shape and says so in its own comment. Every backend test passes.
Every frontend test passes. `McpToolPicker.test.tsx` is **green and in the count gate** — it mounts the
component directly with a connection prop, which is a shape no production code path can produce.

**A component test that constructs its own props cannot see that nothing constructs them in
production.** That is the whole finding, and it is the same failure `ChatLayout.tsx`'s ledger row
records for its positional mount-switch fallback.

## What a fix looks like (NOT taken here — it is a NEW CAPABILITY, i.e. a phase)

- A fourth option on `ExternalActionSection` for the MCP shape, and a `ConnectionPicker` read that is
  **unfiltered** (or `?shape=mcp`) for it.
- A grant control with `updateConnectorGrants` behind it. ⚠ **This is a WRITE that widens what a
  workflow may do**, so it belongs with the approval model, not beside a dropdown — see SEED-146's
  standing rule: *never add an outbound capability before the approval model exists.*
- ⚠ **Do NOT "fix" this by giving MCP rows a fake capability.** `capability` is a CHECK-constrained
  closed set at mig 116, `"mcp"` is not a member, and the whole point of D-206.1-04 is that the wire
  distinguishes the two shapes by `mcp_server_url` rather than by a capability value.

## The guard this needs, whichever way it is fixed

⚠ **A REACHABILITY ASSERTION, not another component test.** The honest shape is an
`import.meta.glob` sweep proving `McpToolPicker` has at least one production importer whose props can
carry an MCP row — the `RunReceipt.tsx` zero-importer sweep, pointed the other way, with a positive
control.
