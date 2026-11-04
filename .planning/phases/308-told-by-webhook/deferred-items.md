# Phase 308 — deferred items

| # | Item | Found by | Routed to | Why not here |
|---|------|----------|-----------|--------------|
| 1 | Public docs still say webhooks don't exist: `docs/public/README.md` ("Not available today"), `docs/public/api/concepts/webhooks.md`, `api/roadmap-open-platform.md`, `get-started/overview.md`, `security/egress-controls.md`, `api/concepts/authentication.md` | 308-04 executor | **Phase 309** (REG-10: "public docs … webhook signature verification") | 308 ships a stub page only (D-49); the content is 309's by roadmap. Must be fixed before 308 deploys to production. |
| 2 | ~~A never-sent test delivery recorded `not_retried`~~ | 308-04 executor | fixed by the orchestrator, `b7f681a37` (RED `c171b5c5d`) | — |
