---
sketch: 307
name: consent-page
question: "How does the Syrel consent page name the client and its redirect host, and let the member pick org, tools and folders, so a self-registered app can't pass for Claude?"
winner: "A — one card (self-picked under the operator's autonomous mandate, 2026-11-03; operator approval owed at the real Claude.ai connect, 307-CONTEXT D-39/D-41)"
tags: [phase-307, oauth-04, oauth-05, consent, sign-in, g2-sketch-gate]
phase: 307
requirements: [OAUTH-04, OAUTH-05]
extends: [299-sign-in-return-and-boot, 304 key screen (McpKeyFields, KeyFoldersField)]
---

# Sketch 307: The Consent Page

## Design Question
A member arrives from Claude.ai, Claude Desktop or Claude Code. The page must say who is asking (name as
a claim, redirect host as the fact), who is signing in, and let the member pick the org, what the app can do
(the 304 presets) and which documents (the 304 folder narrowing), then Allow or Deny.

## How to View
Serve `.planning/sketches` (`python -m http.server`) and open `307-consent-page/index.html`.

## Variants
- **A: One card** — top to bottom: who is asking · you · org · what it can do · which documents · the one sentence you are agreeing to · Deny / Allow.
- **B: Two steps** — step 1 "Who is asking?" (identity), step 2 the choices.
- **C: Split** — left: who + a live can/can't list; right: the choices.

## Moments
Claude.ai (CIMD, verified host) · registered client (DCR, "calls itself", name not checked) · Claude Code
(loopback, "this computer") · one org switched off (listed, disabled, the 304 sentence) · after Allow ·
after Deny · redirect not allowed (Syrel error page, never redirected) · request expired (single use, 10 min).

## Fixed in every variant
- The redirect host is shown on every client, always; the name is verified only for CIMD.
- Signing-in account + "Not you?".
- Narrowing = the 304 presets (Read only pre-selected) and folders (`[]` refused with a sentence).
- An org with MCP off is shown disabled with its reason, never hidden.
- Bad redirect and expired request are Syrel pages; nothing redirects.

## Winner
**A.** It reads in one pass, fits the narrow sign-in window Claude opens, and ends on the plain sentence
the member is agreeing to (C's can/can't list folded in as that sentence). B adds a click and invites
clicking through the identity step without reading it; C's two columns break in a narrow window.
