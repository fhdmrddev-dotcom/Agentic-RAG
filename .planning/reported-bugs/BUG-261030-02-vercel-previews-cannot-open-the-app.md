---
id: BUG-261030-02
title: "*.vercel.app preview deployments cannot open the app — /app redirects to an app. host that does not exist"
reported: 2026-10-30
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [deploy/vercel, frontend/routing]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: cf5a463d4
  date: 2026-10-30
status_note: >
  2026-10-30 (302 REG-08, D-15b / D-29): filed formally. Known since Phase 297 (297-RESEARCH.md:172,
  297-04-PLAN.md:214: "Previews (*.vercel.app) are out of scope for LINK-08 (filed by REG-08 in Phase
  302)"). Open, with no fix in this phase (302-CONTEXT deferred idea): it wants its own phase. Not driven on
  a live preview — the cause below is read from the config.
---

# BUG-261030-02: `*.vercel.app` previews cannot open the app

## What we observed

On a Vercel preview deployment (a `*.vercel.app` host), opening `/app` (or `/app/...`, `/setup`, `/invite`,
`/admin`) does not reach the app. The first redirect in `frontend/vercel.json:5-14` matches any host that
does not start with `app.`:

```json
{ "source": "/app", "has": [{ "type": "host", "value": "(?<host>^(?!app\\.).*)" }],
  "destination": "https://app.:host/app", "permanent": true }
```

so a preview host such as `<project>-git-<branch>.vercel.app` is sent to
`https://app.<project>-git-<branch>.vercel.app/app`, a host nobody owns. The same rule shape repeats for
`/app/(.*)`, `/setup`, `/invite` and `/admin` (`vercel.json:16-92`).

## Why it matters

Previews are where a change is checked before it is promoted. Today a preview can show the landing page
and the docs, but not the product, so nobody can click through a change on its preview URL.

## Hypothesized cause

- **Primary (read from config):** the apex-to-`app.` redirect (SEED-242, LINK-08) has no exception for
  `*.vercel.app` hosts — the negative lookahead `(?!app\.)` is the only condition.
- **Secondary (hypothesis):** even past the redirect, a preview origin is not in the backend's
  `FRONTEND_URL` CORS list (`docs/DEPLOYMENT-LESSONS.md:76-80` — `FRONTEND_URL` is a comma-separated LIST
  of exact origins), so API calls from a preview origin would be refused.

## Surface classification

Agentic-RAG — this app's own deploy configuration.

## Suggested routing

- **Fold into in-flight phase:** n/a (302 deliberately does not fix it)
- **Defer to future phase / milestone:** its own small phase — a `vercel.app` host exception in the
  redirects (or rewrite previews straight to `/app.html`), plus a decision on preview CORS (a regex origin
  or a preview-only backend)
- **Plant as seed:** n/a
- **External — note only:** no

## Workarounds (prompt-side, code-side, or UI-side)

Check changes locally or on the production `app.` host after promotion; previews serve only the landing
page and the docs.

## Reference / evidence links

- `frontend/vercel.json:5-14` (and the five sibling redirects to line 92)
- `docs/DEPLOYMENT-LESSONS.md:76-80` (FRONTEND_URL is a list)
- `.planning/milestones/v4.8-phases/297-every-view-has-an-address/297-RESEARCH.md:172`, `297-04-PLAN.md:214`
