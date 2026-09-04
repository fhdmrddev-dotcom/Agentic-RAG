---
phase: 226-the-public-landing-page
plan: 01
subsystem: frontend
tags: [vite, mpa, routing, bundle-fence]

requires:
  - phase: 226-proposal
provides:
  - "Multi-page Vite build with index.html (landing) and app.html (SPA)"
  - "Dev & preview server middleware routing extensionless non-root paths to app.html"
  - "Vercel rewrite /(.*) -> /app.html with filesystem precedence serving / as index.html"
  - "App, SetupWizard, and AcceptInvitePage redirects pointing to /app"
  - "Transitive negative bundle import fence verifying zero leaks into landing"
  - "VITE_DEMO_URL and VITE_APP_URL documented in deploy/onebox.env.example and docs/OPERATOR.md"
affects: [226-02, 226-03, 226-04, 226-05]

tech-stack:
  added: []
  patterns: [transitive import graph static analysis, multi-page HTML separation]

key-files:
  created:
    - frontend/app.html
    - frontend/src/landing/main.tsx
    - frontend/src/landing/__tests__/landingBundleFence.test.ts
  modified:
    - frontend/vite.config.ts
    - frontend/index.html
    - frontend/vercel.json
    - frontend/src/App.tsx
    - frontend/src/pages/SetupWizard.tsx
    - frontend/src/pages/AcceptInvitePage.tsx
    - deploy/onebox.env.example
    - docs/OPERATOR.md

key-decisions:
  - "F-1: Inverted HTML entries so index.html is landing and app.html is SPA; Vercel filesystem precedence serves index.html at / without rewrite"
  - "F-1: Injected dev/preview middleware in vite.config.ts rewriting /app, /setup, /invite to app.html"
  - "F-3: Transitive import fence crawls complete dependency graph from main.tsx asserting zero auth/API leakage"

requirements-completed:
  - D-226-01
  - D-226-02
  - D-226-03
  - SC#1
  - SC#4

duration: 15min
completed: 2026-09-03
---

# Phase 226 Plan 01 Summary

**Multi-entry HTML architecture, routing isolation, dev middleware, and transitive negative import fence landed.**

## Performance
- **Tasks:** 3 completed
- **Test suites:** `src/landing/__tests__/landingBundleFence.test.ts` (2/2 passing)
- **Regressions checked:** `AcceptInvitePage.test.tsx` (6/6), `SetupWizard.test.tsx` (5/5)
- **OWED pin for vitest-count-gate.cjs:** `src/landing/__tests__/landingBundleFence.test.ts` (2 tests)

## Accomplishments
- Swapped entry points per preflight finding F-1: `frontend/index.html` mounts `/src/landing/main.tsx`, and `frontend/app.html` mounts the application SPA `/src/main.tsx`.
- Configured Vite rollup inputs for `landing` and `app` in `frontend/vite.config.ts`, and implemented dev/preview server middleware rewriting `/app`, `/setup`, `/invite` to `/app.html`.
- Updated `frontend/vercel.json` rewrite to `/(.*) -> /app.html`.
- Updated post-auth and post-setup redirects in `App.tsx`, `SetupWizard.tsx`, and `AcceptInvitePage.tsx` to `/app`.
- Documented `VITE_DEMO_URL` and `VITE_APP_URL` in `deploy/onebox.env.example` and `docs/OPERATOR.md`.
- Authored transitive import fence test `landingBundleFence.test.ts` crawling the entire landing module graph.
