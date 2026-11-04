# Phase 307: Sign In From Claude.ai and Claude Desktop - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-11-03
**Phase:** 307-sign-in-from-claude-ai-and-claude-desktop
**Mode:** auto — operator: "continue by yourself, do not ask me end to end". Every area auto-selected; the recommended option taken each time.
**Areas discussed:** Grant storage, Issuer location, Redirect matching, Consent narrowing, Refresh reuse, Connected-apps home, Key-screen copy, G-2 handling

---

## Where the grant lives

| Option | Description | Selected |
|--------|-------------|----------|
| An `api_keys` row (`kind='mcp'` + `oauth_client_id`) | Liveness, KeyScope, limits, audit `api_key_id`, spend FK work by construction | ✓ |
| A separate `mcp_grants` table | Cleaner naming; every downstream path (limits, audit, spend FK, liveness input) must learn a second id | |

**Choice:** [auto] `api_keys` row (recommended — "an OAuth grant is a key minted through a consent screen"; `mcp_usage.api_key_id` FK makes the alternative a second spend dialect).

## Issuer and endpoint location

| Option | Description | Selected |
|--------|-------------|----------|
| Backend origin under `mcp_public_base()` | Same base as `/mcp`; Vercel untouched; one-box needs one nginx location | ✓ |
| Frontend origin | `.well-known` on Vercel and nginx both fight the SPA | |

**Choice:** [auto] Backend origin.

## Redirect matching

| Option | Description | Selected |
|--------|-------------|----------|
| Exact match + loopback any-port + operator host allowlist (seeded claude.ai/claude.com) | Closes open redirect and phishing registrations; Claude Code works on any port | ✓ |
| Exact match only, any host DCR registers | Any site can register a client and phish a consent | |
| Prefix/wildcard matching | Open-redirect class | |

**Choice:** [auto] Exact + loopback + allowlist.

## Consent narrowing

| Option | Description | Selected |
|--------|-------------|----------|
| Picked on the consent page (org, folders, 304 tool presets) | Same model as keys; reuses KeyFoldersField/McpKeyFields | ✓ |
| Mapped from OAuth scope strings | Clients choose scopes, not members; step-up is deferred | |

**Choice:** [auto] Consent page.

## Refresh reuse

| Option | Description | Selected |
|--------|-------------|----------|
| Refuse and revoke the grant (family), audited | RFC 9700 recommendation; research checks Claude double-refresh | ✓ |
| Refuse only | Stolen-token race goes unnoticed | |
| Grace window | Only if research measures Claude racing; recorded as a new D-NN | |

**Choice:** [auto] Refuse + revoke family.

## Connected-apps home

| Option | Description | Selected |
|--------|-------------|----------|
| Leaf section mounted once in Settings → API keys tab; admin revoke-all in OrgApiKeysTab | No SettingsPage edit, no new OrgAdminShell tab (304 D-01/D-02 precedent) | ✓ |
| New Settings tab | Edits SettingsPage.tsx ⛔ | |

**Choice:** [auto] Existing tabs.

## Claude.ai / Desktop key-screen snippet

| Option | Description | Selected |
|--------|-------------|----------|
| Replace the `mcp-remote` bridge with "add a custom connector, then sign in" | The bridge was labelled "until sign-in ships" | ✓ |
| Keep both | Two ways, one of them a workaround | |

**Choice:** [auto] Replace.

## G-2 (sketch before plan)

| Option | Description | Selected |
|--------|-------------|----------|
| Sketch + UI-SPEC next, Claude self-approves, override recorded in STATE.md | Honours the guardrail's order; operator look folded into owed Claude.ai UAT | ✓ |
| Skip sketch, plan directly | Silent guardrail skip — not allowed | |

**Choice:** [auto] Sketch next; auto-advance to plan-phase NOT taken (it would skip G-2).

## Claude's Discretion

Module/table names, token prefixes, consent route path, Redis-vs-Postgres for pending requests and codes, CIMD cache TTL and unused-client expiry within bounds, where the redirect-allowlist control sits.

## Deferred Ideas

Scope step-up; custom URI-scheme redirects; client logos; Connectors Directory (SEED-294); Supabase OAuth; Expert-scoped grants.
