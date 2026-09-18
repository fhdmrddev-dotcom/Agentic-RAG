---
seed_id: SEED-237
title: "The other integrations: Microsoft 365 OAuth completes and yields ZERO tools, and the MCP door still authenticates with a token you paste — the PKCE machinery exists and the MCP client never calls it"
created: 2026-09-01
planted_during: Phase 221 close — the operator asked \"what about other OAuth integrations? we need OAuth and MCP where applicable\"
status: shipped
folded_into: 222
surface: Agentic-RAG
severity: high
category: connectors / oauth / mcp / breadth
priority: high
relates_to:
  - SEED-177 (connect and be connected) — records the CORRECTION that MCP standardizes authorization; this seed is the measurement that it is still not implemented here
  - SEED-146 (the full integration capability surface) — the umbrella
  - SEED-013 (Open Platform) — the inbound twin
  - docs/CONNECTOR-ARCHITECTURE.md (D-v3.6-01) — MCP-first, first-party-thin
trigger_when:
  - Anyone scopes "more integrations", "more connectors", or a connector breadth milestone
  - Anyone estimates a new vendor as "an OAuth integration" — read the cost anchors below first
  - A user asks for OneDrive, SharePoint or Outlook
  - Anyone proposes adding a fourth entry to `oauth_service.py`'s provider registry
trigger_paths:
  - "**/oauth_service.py"
---

# SEED-237 — two doors, and one of them has no handle

## Measured 2026-09-01

**The OAuth door has exactly three vendors**, hardcoded in `oauth_service.py`
(`auth_url` / `token_url` / scopes per vendor):

| vendor | state |
|---|---|
| **Google** | ✅ 26 tools, 15 reads / 11 writes, six applications — Phase 221 |
| **Microsoft** | ⚠ **OAuth completes and yields ZERO tools.** The connection is real, `status: active`, and no tool specs were ever written. The row reads `◌ Not checked` rather than `✓ Ready` only because Phase 221 fixed that lie. |
| **GitHub** | defined and UNUSED — the live GitHub connection runs over **MCP**, not this |

**The MCP door authenticates with a token the operator pastes.** `mcp_client._build_auth_headers`
formats a stored secret as Bearer or Basic and does nothing else. GitHub's 44 tools exist
because somebody minted a PAT by hand.

## ⚠ THE PIECE THAT CHANGES EVERY ESTIMATE BELOW IT

The MCP specification requires **OAuth 2.1 + PKCE** and **RFC 9728 Protected Resource Metadata**
discovery — a compliant client implements it ONCE and every compliant server becomes a click.
That is why Claude.ai's connector flow is *"paste a URL, log in, done"*.

**We have the PKCE machinery already** — `oauth_service.py` does S256, signed state, refresh —
**and the MCP client never calls it.** The two halves are both built and have never been
introduced. Joining them is the single highest-leverage connector change available, and it is
not an integration: it is the thing that makes integrations cheap.

## The cost anchors, measured rather than guessed

| door | evidence |
|---|---|
| **OAuth** — we write every tool | Google: **26 tools** = 786 lines of spec + 1,719 lines of adapter ≈ **96 lines per tool** |
| **MCP** — the server writes them | GitHub: **44 tools** for **zero** lines of tool code. The whole client is **435 lines**, written once, serving every server |

⚠ **Do not estimate a new vendor as "an OAuth integration" by default.** For any vendor shipping
a compliant remote MCP server that framing is wrong by more than an order of magnitude —
SEED-177 records that correction and it is still being made.

## The sequence that follows from this

1. **Discover what is already configured.** Notion is pointed at `mcp.notion.com/mcp` and has
   **never been checked**; the Jira credential check is **failing**. Hours, no code, and it
   changes the sizing of everything below.
2. **Give the MCP door a real front step** — RFC 9728 discovery + registration, reusing the
   PKCE that exists. One phase. Unblocks every row after it, permanently.
3. **Open the catalog** — Atlassian (the widest single jump: their server carries ~40 tools
   against our 5), Linear, ClickUp, Sentry, Figma. Curation, not engineering. **If the fifth
   costs more than the second, the seam is wrong and that is the finding.**
4. **Finish Microsoft 365 through the OAuth door** — the one candidate that genuinely needs
   hand-written tools, ≈ 1,400–2,400 lines. Mirror the Google six-app shape.
5. **Reads into retrieval** — cite Jira / Slack / Drive / email *alongside* the knowledge base.
   Needs no approval model, and it is the only step that lands on the differentiator rather
   than beside it.

**Every app should offer BOTH doors.** OAuth cannot list tools (every OAuth tool is code we
write); MCP servers advertise their own.

## The two things that will bite

- **Google's consent screen is in Testing mode.** Refresh tokens die every 7 days and only
  listed test users can connect. Publishing needs Google verification plus an annual paid CASA
  assessment, because `gmail.readonly` and `drive.readonly` are RESTRICTED scopes. That is a
  real B2B line item and it does not get cheaper later.
- **The tool registry is CLOSED BY DESIGN** — an unknown key raises, deliberately, as a safety
  property. Connections need tools registered *dynamically*, scoped to whichever connections an
  org has enabled. That is a change to how tools RESOLVE, not a feature on top, and it is the
  piece most likely to be discovered late and expensively.
