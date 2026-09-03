---
seed_id: SEED-242
title: "Production serves the product at app.<domain> and the landing at the root — one door, redirect the path"
created: 2026-09-03
planted_during: Phase 225 close, operator question *"why the app now is on /app and how it's going to be on cloud?"* → *"it should be app.yourdomain.com … take it as a note when we push production and guide me when this happens to set it up"*
status: planted
surface: Agentic-RAG
severity: medium
category: deployment / routing / cloud-parity
priority: high
relates_to:
  - frontend/vercel.json                       # today: one rule, everything → app.html
  - frontend/vite.config.ts                    # two entries: index.html (landing) + app.html (app); dev middleware routes /app
  - frontend/src/landing/components/Navigation.tsx   # Sign in reads VITE_APP_URL, falls back to /app
  - backend/app/api/connectors.py              # both OAuth callbacks return to {FRONTEND_URL}/app (Phase 225)
  - deploy/onebox.env.example                  # VITE_APP_URL, FRONTEND_URL — same-commit parity
  - docs/OPERATOR.md
  - docs/DEPLOYMENT-WORKFLOW.md
trigger_when: >
  The next production push (any promotion to `production` after 2026-09-03). This is deploy
  configuration, not application code, and it cannot be verified without a Vercel preview — so it
  is done AT the push, with the reviewer guiding the operator step by step, never silently on develop.
---

## What the operator decided

The product lives at **`app.<domain>`**; the marketing landing lives at the root. This is the
dominant B2B SaaS shape (app.slack.com, app.asana.com, app.hubspot.com, app.clickup.com). The root
domain's `/app` path **redirects** to the subdomain rather than serving as a second door — one place
the product lives. The domain is read from the connected Vercel project at the time; not typed here.

## Why it is a seed and not a task

Phase 226 made the landing `index.html` and moved the app to `app.html` because Vercel gives the
filesystem precedence over rewrites (226 pre-flight F-1). Locally that yields `localhost:5173/` →
landing and `/app` → product, and that stays. The subdomain split is pure cloud configuration
across four systems (Vercel, Coolify, Supabase Auth, backend CORS) and only a preview deploy can
prove it. Doing it early on develop would sit unverified for weeks.

## The steps, in order (guide the operator through each)

1. **`frontend/vercel.json`** — host-scoped rewrites. On `app.<domain>`: `/(.*)` → `/app.html`.
   On the root domain: `/` serves the landing from the filesystem; `/app` and `/app/(.*)` →
   **308 redirect** to `https://app.<domain>/$1`; `/setup`, `/invite` → redirect to the subdomain too.
   One Vercel project with both domains attached; one build.
2. **Vercel env (landing build):** `VITE_APP_URL=https://app.<domain>` so *Sign in* and the CTA
   footer leave the marketing origin. `VITE_DEMO_URL` per BUS-071 if not yet set.
3. **Coolify backend env:** `FRONTEND_URL=https://app.<domain>` — a bare origin; the Phase 225
   callbacks append `/app` themselves. Google / Microsoft console redirect URIs point at the BACKEND
   (`BACKEND_PUBLIC_URL/connectors/oauth/callback`) and do not change.
4. **Cloud Supabase Auth:** add `https://app.<domain>` to *Site URL* and the redirect allowlist, or
   invite / password-reset emails land on the marketing page.
5. **Backend CORS:** add the subdomain to the allowed origins.
6. **Same-commit parity (Phase 158 / D-16):** `deploy/onebox.env.example` and `docs/OPERATOR.md`
   for items 2–3; `scripts/check-deploy-drift.sh` must pass in the commit that changes `vercel.json`.
7. **Verify on the Vercel PREVIEW before promoting:** root → landing (200, `index.html`);
   root `/app` → 308 to the subdomain; subdomain `/` → app (`id="root"`); an OAuth connect returns to
   `https://app.<domain>/app?connections=1&oauth_connected=1` and opens Connections.

## Re-open trigger

Fires on the next production push. If it is skipped there, the product ships at `<domain>/app`,
which works but is not what the operator asked for — say so at the push rather than after it.
