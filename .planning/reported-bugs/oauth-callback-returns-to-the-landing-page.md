---
id: BUG-260903-01
title: Both OAuth callbacks redirect to `/`, which Phase 226 turned into the marketing page
reported: 2026-09-03
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [backend/connectors/oauth, backend/connectors/mcp-oauth, frontend/landing, frontend/navigation]
folded_into: "225"
verified_closed_by: null
related_seeds: [SEED-185]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: ae7aac884
  date: 2026-09-03
---

# BUG-260903-01: Both OAuth callbacks redirect to `/`, which Phase 226 turned into the marketing page

## What we observed

Found by code read during the Phase 225 pre-flight, not yet driven in a browser.

- `backend/app/api/connectors.py` `oauth_callback` (`:1432`, `:1435`, `:1503`, `:1510`) and
  `mcp_oauth_callback` (`:1277`, `:1281`, `:1291`, `:1305`) all redirect to
  `{frontend_url}/?connections=1&oauth_connected=1…` or `…&oauth_error=…`.
- Since Phase 226 merged (`4bb022c23`), `/` is the public landing (`index.html`) and the app is
  served at `/app` (Vite dev middleware locally; `vercel.json` in prod). `226-VERIFICATION.md`
  records *"a logged-in bookmark to `/` lands on marketing → by design (D-226-02)"*; the OAuth
  return leg was outside 226's scope and was not measured.
- **Expected:** after Google or MCP consent the person is back inside the app on the Connections
  view with the connection showing connected.
- **Actual (by construction):** the person lands on the marketing page with a *Sign in* link; the
  tokens were saved, but nothing on screen says so.

Second, pre-existing half: **nothing in the app reads the query string.** `grep -rn
"location.search\|URLSearchParams" frontend/src` (excluding tests and `landing/`) hits only API
parameter builders. `?connections=1`, `oauth_connected=1` and every `oauth_error=` value have
never been read by any component — the app navigates by `useState<ActiveView>` (`SEED-185`, no
router). So even at `/app` the redirect carries a result the shell does not act on.

## Why it matters

The whole Phase 215 / 222 flow ends here. A consent that succeeds silently and drops the person on
a marketing page reads as a failure, and the person will retry — minting a second token at the
vendor each time. Phase 225 SC#5 (*"the Google connection still works end to end, driven in a real
browser"*) cannot pass while this stands, which is why it is filed now rather than at 225's close.

## Routing

**2026-09-03, verified in a real browser:** the redirect half is CLOSED by 225 (`ec3d75a9d`) — the operator landed on `/app?connections=1&oauth_connected=1&id=…`. The query-string-reader half is still open: the app opened Chat, not Connections. Status stays `folded` until that half ships (SEED-185 or a `/gsd:fast`).

**Operator, 2026-09-03: folded into Phase 225.** Plan 02 takes BOTH callbacks' redirects
(`oauth_callback` and `mcp_oauth_callback`) to the app path. The query-string-reader half stays
with `SEED-185`.

### Original suggestion

- The `oauth_callback` half is inside Phase 225 plan 02's blast radius (`225-PREFLIGHT.md` B-1).
- The `mcp_oauth_callback` half is three lines in the same file, outside 225's `files_modified`.
- The "nobody reads the query string" half belongs with `SEED-185` (a router, or a one-time
  `location.search` read in `App.tsx` that sets `ActiveView` and shows the result). Not 225's.
