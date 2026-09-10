---
seed_id: SEED-257
title: MCP file sources cannot be driven locally at all — stdio is unsupported and egress refuses loopback and http, so every MCP source phase's UAT needs a public HTTPS server it does not have
created: 2026-09-08
planted_during: Phase 239 close — measured while planning the SC#2 second-server proof, which turned out to be unrunnable on this machine
status: planted
priority: high
surface: Agentic-RAG
relates_to:
  - Phase 239 (SRC-04) — the phase whose SC#2 this blocks; built 2026-09-08, NOT closed
  - Phase 232 — the source contract; SC#2 is the measurement of whether it was real
  - SEED-177 — the MCP-connections seed; its outbound half is what this constrains
  - SEED-256 — the SAME SHAPE one family over: a criterion blocked on an ENVIRONMENT, not on code
  - `backend/app/security/egress.py` — the refusal, and it is deliberate
  - `backend/app/services/mcp_client.py` — HTTP/SSE only, no stdio
trigger_when: >
  ANY of, and the first two are near-certain: (a) a phase or UAT row needs to drive an MCP source
  end-to-end and has no public HTTPS MCP file server to point at — this fires the moment Phase 239's
  SC#2 is attempted; (b) a NEW MCP source family is scoped (Phase 240 mail, or any later SRC
  requirement) and inherits the same wall; (c) anyone proposes a localhost or `http://` carve-out in
  `egress.py` — read the refusal comment FIRST, it names itself as the production hole; (d) the
  reference MCP servers the ecosystem ships move to a remote/HTTPS transport by default, which would
  dissolve this without any work on our side.
---

# SEED-257 — the MCP source that cannot be tested on this machine

## What was measured, 2026-09-08

Phase 239 shipped `McpSourceAdapter` and proved "adding a source adds rows, not code" **in test**.
Its SC#2 closes only on **a real second MCP file server**. While planning that row, two facts met:

1. **`mcp_client.py` speaks JSON-RPC over HTTP/SSE only.** There is no stdio transport.
2. **`egress.py` refuses `http://` and loopback with NO carve-out**, and says so in a comment that
   is worth quoting because it is a decision, not an oversight:

   > `http:// is refused with NO exception, including for localhost. The developer-convenience`
   > `carve-out is the production hole; there is deliberately no branch for it here.`

**Together those make the obvious test impossible.** The ecosystem's reference file server,
`@modelcontextprotocol/server-filesystem`, is **stdio** — unreachable by transport. Bridging it to
HTTP locally (`mcp-proxy`, `supergateway`) puts it on **loopback**, which `validate_mcp_destination`
refuses by design. So there is no combination of local tooling that drives an MCP source end to end.

⚠ **Neither fact is a defect, and this seed is not a request to change either.** The egress refusal
is the single most load-bearing security property on this surface — Phase 190's review found real
credential exposure, and the loopback/RFC1918/metadata block is what stops an untrusted server URL
becoming SSRF. **A carve-out is the wrong fix and the comment above predicted someone would reach
for it.**

## Why this is worth a seed rather than a line in one phase's owed list

**It is not Phase 239's problem, it is every MCP source phase's problem.** 239 is simply the first
to hit it. Phase 240 (mail), any later `SRC-` requirement, and any future MCP family inherit the
identical wall, and each will rediscover it at UAT time — the most expensive moment to find it.

⚠ **The failure mode this guards against is specific:** a criterion that cannot be driven quietly
becomes a criterion that is *assumed*. Phase 239's SC#2 is currently satisfied by a fixture asserting
the invoked tool name, and the `ls`/`cat` vocabulary existing nowhere as code. **That is strong
evidence and it is not the criterion.** Left unnamed, "proven in test" drifts into "proven".

## The options, none of them chosen here

Recorded so the next person does not re-derive them, and deliberately **not** ranked — this is a
decision for the operator, and one of them is a security change that must never be made casually.

| # | Option | The cost, stated honestly |
|---|---|---|
| 1 | **Find a public HTTPS MCP server with a file surface** and use it as the second server | Zero code. Needs one to exist, be trustworthy enough to point credentials at, and expose a *different* tool vocabulary — which is the part that makes it a real SC#2 test rather than a repeat |
| 2 | **Host a small MCP file server ourselves** on a public HTTPS endpoint | Real infra, a certificate, and a thing to keep alive; but it is OURS, so the tool vocabulary can be chosen to differ deliberately |
| 3 | **A test-only egress allowance**, gated so it cannot exist in a deployed build | ⛔ This is the option the `egress.py` comment names as the production hole. If it is ever taken it needs its own threat model and a fence proving the allowance is absent from a production build — not a config flag |
| 4 | **Accept the in-test proof and close SC#2 on it**, explicitly | Cheapest, and legitimate *if said out loud*. It must be recorded as a criterion closed on weaker evidence than it asks for, never as a pass |

## How we would know this seed was answered badly

- A `localhost` or `http://` branch appears in `egress.py` and no threat model appears with it.
- Phase 239's SC#2 is marked met with no second server named anywhere.
- Phase 240 or a later `SRC-` phase re-derives this same wall from scratch, which means this seed
  was never read — the failure this register exists to prevent.
