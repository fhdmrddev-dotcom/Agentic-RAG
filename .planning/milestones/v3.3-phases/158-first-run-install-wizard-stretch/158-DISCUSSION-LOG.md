# Phase 158: First-Run Install Wizard (STRETCH) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 158-first-run-install-wizard-stretch
**Mode:** Autonomous — operator granted full discuss→plan→research→execute authority, unattended. Claude identified the gray areas and decided each with reasoning (no `AskUserQuestion` — operator away). This log records the alternatives weighed.
**Areas discussed:** Config persistence architecture · Setup gate & entry signal · Frontend routing · DB bootstrap automation · Operator bootstrap · Security (pre-auth surface) · Scope cut-lines · Folded drift-check

---

## Config persistence architecture (the core)

| Option | Description | Selected |
|--------|-------------|----------|
| DB-only (`app_settings`) | Write everything to the DB via `save_app_settings` | |
| File-only (`./.env`) | Wizard rewrites the root `./.env`, restart to apply | |
| Two-tier (setup-store file + DB) | Infra → mounted setup-store file; app-level → `app_settings` | ✓ |

**Choice:** Two-tier (D-01/D-02). **Rationale:** `docker-compose.prod.yml` injects `./.env` via `env_file:` — read once at container creation; the in-container wizard can't mutate its own env, and `./.env` isn't bind-mounted. The DB can't hold the DB's own connection string (chicken-and-egg). So infra vars (Supabase/Postgres/Redis/encryption key) need a mounted setup-store file the config layer overlays at boot; app-level vars (provider keys, operator, flags) reuse the Phase-150 encrypted `save_app_settings` seam. A new `setup_data` volume is added to the `backend` service.

## Setup gate & entry signal

| Option | Description | Selected |
|--------|-------------|----------|
| DB flag only | `setup_complete` in `app_settings`, read via the 30s cache | |
| File marker only | A local finalize marker file | |
| Dual marker (file first, DB second) | File = blip-proof gate authority; DB flag = auditable | ✓ |

**Choice:** Dual marker (D-04/D-05). **Rationale:** mirror `MaintenanceMiddleware` (pure-ASGI, fail-open cached flag), but a DB blip must NEVER bounce a live box's users into the wizard — so the blip-proof local file marker is the gate authority, with the DB flag for app-facing/auditable awareness. Gate is a literal no-op once finalized (byte-identical invariant).

## Frontend routing

| Option | Description | Selected |
|--------|-------------|----------|
| Add react-router | Real `/setup` route | |
| Pre-auth `App.tsx` branch + pathname check | Mirror the `AuthPage` branch; honor `/setup` via `window.location.pathname` + nginx SPA fallback | ✓ |

**Choice:** Pre-auth branch (D-06). **Rationale:** the app has no URL router (a `useState<ActiveView>` machine); adding react-router is a bigger change. A pre-auth branch on a public `GET /api/setup/status` probe mirrors the existing auth gate and honors the literal `/setup` path cheaply. Runtime public-config endpoint (D-07) added so login works with wizard-entered Supabase creds without a frontend rebuild (SHOULD; fallback = build-time `VITE_*` + a mismatch warning).

## DB bootstrap automation

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-run schema+seeds server-side | Execute `full-schema.sql` + seeds over `POSTGRES_DSN` | (SHOULD) |
| Detect + guide (copy the SQL) | Probe schema presence; if absent, show/copy the OPERATOR.md Step-3 sequence | ✓ (MVP) |

**Choice:** Detect + guide for MVP; auto-run is a research-gated SHOULD (D-10). **Rationale:** running a `pg_dump` artifact via asyncpg is risky (COPY / meta-commands); the safe MVP detects schema presence and guides, keeping destructive DDL out of the pre-auth surface unless research proves clean execution.

## Operator bootstrap

| Option | Description | Selected |
|--------|-------------|----------|
| Persist `OPERATOR_EMAILS`, seed on next boot | Operator signs up later, restart to seed | |
| Create the admin account directly | Service-role Auth admin API creates email+password → upsert `operator_users` | ✓ |

**Choice:** Create the account directly (D-11). **Rationale:** the wizard holds the freshly-bound service-role key; creating the auth user + upserting `operator_users` makes the operator an operator on their *first* login — no signup-then-restart gap. `OPERATOR_EMAILS` still persisted for future re-seeds.

## Security (pre-auth surface)

| Option | Description | Selected |
|--------|-------------|----------|
| Rely on the finalize lock only | Open until finalized | |
| First-boot setup token + lock + rate-limit | Token printed to backend logs, required on setup writes | ✓ |

**Choice:** Setup token + threat model (D-15). **Rationale:** `/setup` is pre-auth and writes secrets, runs SQL, mints the first operator — a hijack race is real. A first-boot token in the backend logs (Jupyter/n8n/Grafana idiom) binds setup to whoever has host/log access. A dedicated threat model is REQUIRED; `secure-phase` verifies.

---

## Claude's Discretion

- Setup-store file format (JSON vs dotenv) + `/data` mount path.
- Exact `/api/setup/*` endpoint shape + on-the-wire step ordering.
- Config-overlay placement (in `config.py` vs a thin wrapper).
- Wizard component decomposition; CI job placement for the drift-check.

## Deferred Ideas

- Live end-to-end operator UAT (structurally human — analog of 157's D-09 smoke).
- Server-side DB-bootstrap auto-runner (SHOULD, research-gated).
- Full react-router migration; managed/BYO/on-prem wizard variants beyond pre-fills.
- ClamAV upload scanning (REQUIREMENTS "Future"); multi-preset engine.
