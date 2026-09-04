---
id: BUG-260904-04
title: FRONTEND_URL is a comma-separated LIST, so every OAuth redirect and every invite link is an unusable URL on cloud
reported: 2026-09-04
surface: Agentic-RAG
severity: blocking
status: closed
affected_areas: [connectors/oauth, deployment/cloud-parity, org/invites]
folded_into: null
verified_closed_by: "2026-09-04 — hotfixed to production; the live Location header was re-read and carries a single origin"
related_seeds: [SEED-185]
re_open_trigger: "A FIFTH site interpolating settings.frontend_url into a URL without primary_frontend_origin(). The guard covers the resolver, NOT its call sites — a new raw read is invisible to it."
---

# The redirect after every OAuth consent was not a URL

**Found by the operator**, at the v3.9 production push: *"why is it not connecting to Notion… it is
the redirect, it's not working."* Diagnosed by reading the live `Location` header rather than the
code.

## Measured on live production, 2026-09-04

```
$ curl -s -i https://api.superrag.cloud/connectors/mcp/oauth/callback
HTTP/1.1 307 Temporary Redirect
Location: https://superrag.cloud,https://agentic-rag-rho.vercel.app/app?connections=1&oauth_error=missing_code_or_state
```

Identical on `/connectors/oauth/callback`. The authority of that URL is `superrag.cloud,https:` —
**not a host** — so the browser cannot navigate it. **Notion, Google and Microsoft alike.**

## Root cause — two consumers of one setting disagreed

`FRONTEND_URL` is a comma-separated list *by design*: `DEPLOYMENT-WORKFLOW.md` §5 requires every
live origin to be listed, and `main.py:714` splits it for CORS
(`settings.frontend_url.split(",")`). Confirmed live — `superrag.cloud` and
`agentic-rag-rho.vercel.app` both get an `Access-Control-Allow-Origin`, `evil.example.com` does not.

**Four sites consumed the raw string with only `.rstrip("/")` and interpolated it into a URL:**

| site | what it built |
|---|---|
| `connectors.py:1274` | the MCP OAuth callback's 4 redirects |
| `connectors.py:1330` | the Phase-215 authorize error redirect |
| `connectors.py:1463` | the Phase-215 callback's 6 redirects |
| `services/email_provider.py:37` | ⚠ **the invite email link** — a broken link in an email nobody can resend |

## ⚠ Why it survived a successful Google connect

**The tokens are saved BEFORE the redirect.** The callback exchanges the code, calls
`save_oauth_tokens(...)`, and only then returns the `RedirectResponse`. So the connection genuinely
completes while the person sees a failure. `Google Workspace` read `OAuth connected · ✓ Ready` in the
UI on the very same install whose redirect was broken — **the UI and the browser disagreed, and the
UI was right.** That is why this was invisible to the operator's own successful connect and had to be
caught by reading the header.

## ⚠ Why no test could have caught it, and still cannot without this one

**Local `FRONTEND_URL` is a single origin, so the split is a no-op and the defect does not exist
there.** `225-VALIDATION.md` verified all eight redirect sites and was correct — on local.
**Only a multi-origin install reproduces it**, and no fixture in the repo used one.

Driven RED against the planted defect before being trusted: **5 of 8 cases failed.** The 3 that
PASSED are single-origin, trailing-slash and empty — *exactly the shapes every prior test used*.
That distribution IS the finding.

## Fix

`primary_frontend_origin()` in `config.py` — one home, first entry wins, whitespace tolerated.
All four sites call it. **CORS deliberately keeps the full list**; only redirects and links take one.

⚠ **The guard covers the RESOLVER, not its call sites.** A fifth site reading
`settings.frontend_url` raw would be invisible to it — hence the re-open trigger above.
