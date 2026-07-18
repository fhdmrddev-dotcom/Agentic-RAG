# Plan 157-05 — SUMMARY (D-09 one-box compose smoke)

**Plan:** 157-05 (Wave 4 — the operator-gated `docker-compose.prod.yml` one-box smoke, SC#3). `autonomous: false`.
**Completed:** 2026-07-17 — **via the Phase 158 live UAT** (same compose stack).

## What happened

157-05's smoke was deferred at 157 execution time. It was then performed on 2026-07-17 as part of the **Phase 158 first-run-wizard live UAT**, which stands up the identical `docker compose -f docker-compose.prod.yml up --build` one-box stack pointed at the operator's local Supabase — i.e. 157-05's exact test.

**Result: PASS.** The operator brought the full one-box stack up (frontend nginx `:8080` + backend uvicorn + bundled redis), `/health` returned 200 (direct + through the nginx `/api/` proxy), the SPA served, login worked, and a working app was reached. SC#3 (a preset produces a working deployment, smoke-verified) is satisfied.

## Fixes surfaced by finally running the deferred smoke

The smoke had never actually exercised the Phase-157 build artifacts, so it flushed two real build bugs (both fixed on `develop`):
1. **`frontend/Dockerfile` — `npm ci` → `npm install`** (`7...`): the committed `package-lock.json` drifted from `package.json` (a transitive range bump, e.g. `@shikijs/*` 4.1.0 vs 4.3.1); a dev machine with existing `node_modules` doesn't notice, but alpine's fresh `npm ci` hard-fails. `npm install` reconciles it. (+ an npm@11.4.0 pin.)
2. Confirms the compose file, nginx reverse-proxy, `host.docker.internal` DB reachability, and bundled-redis healthcheck all work end-to-end.

## Note
This closes 157-05 → **Phase 157 fully complete (5/5)**. The `docs/OPERATOR.md` home-B path is now smoke-proven. To restore `npm ci` reproducibility in the frontend image later, regenerate the lockfile cleanly (`rm package-lock.json node_modules && npm install`, commit) — logged as a low-priority follow-up.
