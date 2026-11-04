---
status: partial
phase: 307-sign-in-from-claude-ai-and-claude-desktop
source: [307-VERIFICATION.md]
started: 2026-11-04T04:00:00Z
updated: 2026-11-04T04:00:00Z
---

## Current Test

[awaiting human testing — run row 5 (G-4 row 1, Claude Code loopback) first]

## Tests

### 1. Real Claude.ai connect, refresh (≥ 1 h later) and revoke on cloud (D-39)
expected: In Claude.ai, go to Customize → Connectors → Add custom connector, enter the cloud MCP URL, then Connect. The Syrel consent page names the client and shows the `claude.ai` host. After Allow, the tools work. An hour or more later the tools still work, so the token refresh happened. Disconnect in Settings → API keys, and the next tool call is refused.
result: [pending — needs deploy + cloud mig 224]

### 2. Same for Claude Desktop on cloud
expected: Same flow as row 1, done from Claude Desktop.
result: [pending — needs deploy + cloud mig 224]

### 3. One-box connect
expected: `/.well-known/oauth-authorization-server/api` and `/.well-known/oauth-protected-resource/api/mcp` return JSON, not the app page. A connector sign-in completes, and `nginx -t` passes on the new blocks.
result: [pending — needs a one-box + Docker]

### 4. Cloud migration 224
expected: Migrations 220 → 221 → 222 → 223 → 224 are each pasted into cloud Supabase with its own operator approval. Then `get_advisors(security)` shows no new finding on `oauth_clients` / `oauth_tokens`.
result: [pending — operator-gated write]

### 5. G-4 row 1 — Claude Code signs in through a loopback redirect (local, Chrome)
expected: Run `claude mcp add --transport http syrel http://localhost:8000/mcp`, then `/mcp`. The browser opens `/app/connect/<id>`, which shows the loopback mark and "Claude Code" as a claim. After Allow, the browser returns to `http://localhost:<random port>/callback` and Claude Code lists the Syrel tools.
result: [pending]

### 6. G-4 row 2 — member disconnects (local, Chrome)
expected: Go to Settings → API keys → Connected apps → Disconnect. The sheet names the app and its host. After confirming, the card leaves the list only once the server answers, and the app's next `/mcp` call gets 401.
result: [pending]

### 7. G-4 row 3 — org admin "Disconnect all" (local, Chrome)
expected: Go to Org admin → API keys → Disconnect all. The sheet names how many apps and members are affected and says keys and other orgs are untouched. After confirming, the count matches what the server revoked. Both apps get 401, and a key in the same org still gets 200.
result: [pending]

### 8. Claude callback hosts on the redirect allowlist
expected: Control Room → Controls → "AI tool sign-in: return addresses" lists `claude.ai` and `claude.com`. Any other callback host named in Claude's docs at connect time is added.
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
