# Phase 158: First-Run Install Wizard (STRETCH) - Context

**Gathered:** 2026-07-17
**Status:** Ready for planning
**Mode:** Autonomous (operator granted full discuss→plan→research→execute authority, unattended — Phase 154 precedent). Gray areas decided by Claude with reasoning; no `AskUserQuestion` (operator away). Every "you decide" is locked below, not deferred to a human.

<domain>
## Phase Boundary

Deliver **DEPLOY-02 (STRETCH)**: a browser install wizard at `/setup` that walks a **non-developer operator** through first-run setup of a one-box deployment, replacing the hand-edit-`./.env` + paste-SQL steps of the `docs/OPERATOR.md` Home-B runbook. The wizard is **idempotent** and **locks out after finalize**.

**The wizard automates the OPERATOR.md Home-B manual flow** (`docs/OPERATOR.md` Steps 2–5 + the verification checklist), turning it into a guided browser flow. The three ROADMAP success criteria:

1. A browser flow at `/setup` walks **environment detect → preset pick → Supabase/Redis bind → bootstrap operator → provider keys → smoke test**.
2. The wizard is **idempotent** and **locks out after finalize**.
3. A **non-developer** can complete setup end-to-end **without hand-editing files**.

**Folded scope (operator decision 2026-07-17, recorded in STATE.md):** a **deployment-artifact drift-check** — `scripts/check-deploy-drift.sh` + a same-commit CLAUDE.md sync rule. The Phase 157 artifacts (`deploy/onebox.env.example`, `docker-compose.prod.yml`, `docs/OPERATOR.md`) are a **static snapshot** that drifts as future phases add env vars / migrations / services / sandbox tags. This deliverable keeps them honest. Mirrors the existing `scripts/pending-cloud-migrations.sh` + sandbox-tag + SANDBOX-PACKAGES sync patterns.

**Depends on:** Phase 157 (the wizard drives the 157 presets). Reuses the 157 `deploy/onebox.env.example` var surface as the exact field set the wizard collects.

**NOT SC#10-flagged:** this phase touches nothing in the chat streaming path / agent loop / provider routing / chat UI state, so the 4-axis cross-provider UAT mandate does NOT apply. **BUT** it adds a middleware + a lifespan branch + a config-load overlay — so the load-bearing regression invariant is **"an already-configured box is byte-identical; the setup gate is a literal no-op once finalized"** (the Deep-byte-identical analog, mirroring Phase 147's off-switch-safe `MaintenanceMiddleware`). That invariant, not a cross-provider matrix, is the verification bar.

</domain>

<decisions>
## Implementation Decisions

### Config persistence — the two-tier split (the core architecture)

- **D-01 — Two tiers, two homes.** The wizard writes config to **two** places, split by whether the value is needed to *reach the database*:
  - **Infra / bootstrap tier** (needed BEFORE the DB is reachable → cannot live in the DB): `SUPABASE_URL` + the four Supabase keys, `POSTGRES_DSN`, `REDIS_URL`, `SECRETS_ENCRYPTION_KEY`. → persisted to a **setup-store file** on a mounted volume (D-02).
  - **App-level tier** (only needed AFTER the DB is reachable): provider API keys, `OPERATOR_EMAILS`, model pins, retrieval knobs, the `setup_complete` flag. → persisted to **`app_settings`** (DB) via the existing Phase-150 encrypted `save_app_settings` seam (`backend/app/models/user_settings.py:277`) — provider keys auto-encrypt (`SECRET_COLUMNS`, `secret_cipher.py`).
  - **Why:** `docker-compose.prod.yml` injects `./.env` via `env_file:` — read **once** at container creation. A wizard running *inside* the backend container cannot mutate its own already-loaded env, and `./.env` is not bind-mounted, so the container can't write it. The DB can't hold the DB's own connection string (chicken-and-egg). A mounted setup-store file is the only honest way to satisfy SC#3 ("without hand-editing files") for the infra tier.

- **D-02 — Setup-store = a JSON file on a NEW persistent volume; config layer overlays env.** Add a named volume (e.g. `setup_data:/data`) to the `backend` service in `docker-compose.prod.yml`; the wizard writes `/data/setup.json` (0600). The `Settings` load path (`backend/app/config.py:742`) gains an **overlay**: real env var → else setup-store value → else default. This makes the box wizard-configurable without a rebuild. **The compose file changes** (adds the volume) → the drift-check (D-16) and OPERATOR.md must reflect it.
  - Applying infra config after finalize: the finalize endpoint **re-initializes the asyncpg pool + Redis client + Supabase client in-process** from the merged config (the pools are lazily created singletons — `dependencies.py:79/31/21`). **Restart-to-apply is the documented fallback** if in-process re-init proves unreliable (a `docker compose restart backend` is a command, not file-editing — SC#3 still holds). Research resolves which is safe.

- **D-03 — Boot must be setup-mode-tolerant.** On a fresh/unbound box the lifespan (`main.py:286`) must **degrade, not crash** when the DB/Redis are unreachable (pools are already lazy — verify no hard-crash path in the seed / cipher-sweep / reconciler startup steps; guard them to no-op in setup mode). `supabase_url` is a required Pydantic field (`config.py:745`) but the onebox preset always ships a placeholder, so the field is never literally absent — setup-mode triggers on the **finalize marker being unset** (D-05), not on config absence.

### The setup gate + entry signal

- **D-04 — `SetupMiddleware` mirrors `MaintenanceMiddleware` exactly.** A pure-ASGI middleware (NOT `BaseHTTPMiddleware` — never buffer SSE), registered alongside `MaintenanceMiddleware` at `main.py:559`, reading a cached flag. When setup is NOT finalized it gates all routes **except** an allowlist: `/setup`, `/api/setup/*`, `/health`, `/api/public-config`, and static assets. When finalized it is a **literal no-op** (the byte-identical invariant). Model file: `backend/app/middleware/maintenance.py`.

- **D-05 — Finalize marker: local file first (blip-proof), DB flag second (auditable).** The gate authority is a **local marker in the setup-store file** (`finalized: true`) — read cheaply, immune to a transient DB outage (a DB blip must NEVER bounce a live box's users into the wizard). The DB `setup_complete` boolean (new `app_settings` column, migration 102, read via a new `setup_complete()` helper beside `maintenance_mode()` at `user_settings.py:910`) is the auditable/app-facing signal. **Finalize writes BOTH.** Setup-needed = file marker absent/false.

### The browser flow

- **D-06 — No react-router; pre-auth branch + literal `/setup` path.** The frontend has no URL router (`App.tsx` is a `useState<ActiveView>` machine). Add a **pre-auth branch in `App.tsx`** (~line 161, mirroring the `AuthPage` branch): a public `GET /api/setup/status` probe at startup → if `needs_setup`, render `<SetupWizard/>` instead of AuthPage/ChatLayout. Honor the literal path `/setup` via a `window.location.pathname` check (nginx already SPA-falls-back any path to `index.html`) — so typing `/setup` works AND a fresh box auto-shows the wizard. Post-finalize, `/setup` renders an **"already configured"** lock-out state (SC#2). Adding real react-router is an allowed planner alternative if cleaner, but the pathname check is the lean path.

- **D-07 — Runtime public-config endpoint so login works without a frontend rebuild (SHOULD).** `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` are baked at **build** time; a wizard-entered Supabase URL won't reach the browser's Supabase client. Add `GET /api/public-config` → `{supabase_url, supabase_anon_key}` (public, from the bound infra tier); the frontend Supabase-client bootstrap (`frontend/src/lib/supabase.ts`) reads it at startup, **overlaying/falling back to** the baked `VITE_*`. The `/setup` page itself never talks to Supabase directly (it posts only to `/api/setup/*`), so it renders even with placeholder `VITE_*`. **Fallback if too invasive:** document "set `VITE_*` at build" and have the wizard **warn** if the browser's baked URL ≠ the entered URL. Research decides.

### The six wizard steps

- **D-08 — Env-detect is LIGHT.** Probe: is a setup-store already present? is any pre-set env reachable (DB / Redis)? are we in Docker? → informs **defaults + which steps to pre-fill**, not heavy auto-discovery. It orients the operator; it does not try to be clever.

- **D-09 — Preset pick: one-box is the default/primary.** The one-box preset is the only fully-built, smoke-tested 157 preset. Managed / on-prem are **selectable** but only **pre-fill different defaults + show the OPERATOR.md variant guidance** — not a full multi-preset engine. Don't over-build; one-box is the happy path.

- **D-10 — Supabase/Redis bind: collect + validate LIVE, server-side.** Reuse `backend/app/services/health_probe.py` (`probe_supabase`, `probe_redis`, `probe_dependencies`) — adapted to test the **submitted** values (throwaway connections), not just the configured ones. Detect DB **schema presence** (probe for a sentinel table, e.g. `app_settings` / `operator_users`). **If the schema is absent:** the MVP **guides** — show/copy the exact OPERATOR.md Step-3 sequence (`full-schema.sql` + the 9 ordered seed migrations + the `INSERT INTO app_settings (id) VALUES ('global')` row). A **server-side "run it for me"** (idempotent DDL runner over `POSTGRES_DSN`) is a **SHOULD**, research-gated on whether the `pg_dump` artifact executes cleanly via asyncpg.

- **D-11 — Bootstrap operator = create the first admin account directly.** Collect operator **email + password**; create the Supabase auth user via the **Auth admin API** (the wizard holds the freshly-bound service-role key) → upsert `operator_users` (reuse `seed_operators_from_env`'s `ON CONFLICT DO NOTHING` upsert, `operator_service.py:136`) → persist `OPERATOR_EMAILS` to the setup-store for future re-seeds. **Result: the operator can log in as operator immediately** — no signup gap, no restart. (Research confirms `supabase-py` service-role `auth.admin.create_user` availability.)

- **D-12 — Provider keys: one required, matching the onebox preset.** Collect the default LLM provider + its key (+ optional embedding key), persist via `save_app_settings` (auto-encrypted). Reuse the existing provider list / picker. Exactly one provider is required (OpenAI default); others optional/skippable. The key is validated in the smoke step (D-13).

- **D-13 — Smoke test = green-checklist, and IS the finalize gate.** Server-side, validate: (1) Supabase Auth reachable, (2) Postgres reachable + schema present, (3) Redis PING, (4) the chosen provider key works (a minimal models-list / 1-token round-trip), (5) operator row exists. Render as a green/blocked checklist (reuse `HealthSignals.tsx` / the `PublishGauntlet.tsx` per-stage pass/block pattern). Mirrors the OPERATOR.md "verification checklist." **All-green unlocks Finalize;** any red blocks it with a plain-language fix.

### Idempotency, lock-out, security

- **D-14 — Idempotent + hard lock-after-finalize.** Every step is safe to re-run (re-entry shows current state, no duplicate writes). After finalize the wizard **refuses all config writes** and shows "already configured." **Re-configuration is an `/admin` operator action** (existing Control Room / Settings surfaces), never the public pre-auth wizard.

- **D-15 — Security: DEDICATED THREAT MODEL REQUIRED (this is a pre-auth surface that writes secrets, runs SQL, and mints the first operator).** Decisions:
  - A **first-boot setup token** — generated on first boot when unfinalized, **printed to the backend stdout/logs** (operator reads it from `docker compose logs backend`), **required on every `/api/setup/*` write**. Defeats the hijack race (an attacker reaching `/setup` before the legitimate operator). Precedent: Jupyter / n8n / Grafana initial-admin tokens.
  - **Rate-limit** the token check; **never log secrets**; the finalize lock (D-05) is the boundary; be SSRF-aware on submitted URLs (the connection tests are the wizard's purpose, but they are token-gated so the submitter already has host/log access). `secure-phase` verifies every mitigation exists in code.

### Folded deliverable — deployment-artifact drift-check (operator decision 2026-07-17)

- **D-16 — `scripts/check-deploy-drift.sh` + a same-commit CLAUDE.md sync rule.** A bash script (style-mirroring `scripts/pending-cloud-migrations.sh`: `set -euo pipefail`, clear usage, non-zero exit on drift) that checks:
  1. **Preset keys** — every key the app reads is present in `deploy/onebox.env.example` (diff against `backend/.env.example` + the documented gap-vars `FRONTEND_URL`/`ENVIRONMENT`/`VITE_*`).
  2. **Seed-migration list** — the `docs/OPERATOR.md` Step-3 seed list matches what's actually under `supabase/migrations/` (catch a new seed-bearing migration not added to the runbook).
  3. **Sandbox tag consistency** — `SANDBOX_IMAGE` in the preset == the tag in `CLAUDE.md` == the `Dockerfile.sandbox` build intent.
  4. **`docker compose -f docker-compose.prod.yml config`** parses (and reflects the new `setup_data` volume from D-02).
  - Wire into CI (extend the existing `.github/workflows/frontend-tests.yml` or a new lightweight job) and reference as a GSD gate. Add a **CLAUDE.md rule**: any env-var / migration / service / sandbox-tag change updates the 157 artifacts **in the same commit**.

### Guardrails, scope cut-lines, failure criteria

- **D-17 — G-2 override (recorded to STATE.md); G-6 failure criteria; the byte-identical invariant.**
  - **G-2** (UI-heavy → sketch-first) **fires** (the wizard is a net-new UI surface). Override rationale: the operator is unattended and granted full authority; the wizard is a utilitarian stepper that **reuses shipped, operator-approved patterns** — `LifecycleStepper.tsx` (step rail), `HealthSignals.tsx` (green-checklist smoke), `PublishGauntlet.tsx` (per-stage pass/block gated flow), `ControlRoomPage.tsx` (full-page shell), the `MaintenanceBanner` (setup-state banner). No fresh sketch; the established patterns ARE the acceptance bar. **Record the override in STATE.md → Guardrail overrides** at commit.
  - **G-6** — **How we'd know this failed** (concrete, observable): (a) an already-configured box shows the wizard or 503s a normal route (gate not no-op); (b) finalize "succeeds" but a restart loses the config (persistence not durable); (c) a non-developer hits a raw stack trace / has to open a file / paste SQL with no guidance; (d) the wizard writes a provider key in plaintext with `SECRETS_ENCRYPTION_KEY` set (encryption seam bypassed); (e) `/setup` accepts writes after finalize (lock bypass); (f) an unauth caller without the token configures the box (token gate bypass). If these can't all be tested, scope isn't ready to finalize.

- **D-18 — Explicit MVP cut-lines (this phase is "the milestone's biggest single lift, first to cut" — scope tightly to the 3 SCs).**
  - **MUST (satisfies all 3 SCs):** setup-store + config overlay (D-01/D-02) · setup-mode-tolerant boot (D-03) · `SetupMiddleware` gate (D-04) · dual finalize marker (D-05) · pre-auth `/setup` branch + status probe (D-06) · the 6-step wizard UI reusing shipped primitives (D-08–D-13) · live connection validation (D-10) · operator bootstrap (D-11) · encrypted provider-key save (D-12) · green-checklist smoke = finalize gate (D-13) · idempotency + lock-out (D-14) · setup token + threat model (D-15) · the drift-check (D-16).
  - **SHOULD (include if clean):** runtime public-config endpoint (D-07) · server-side DB-bootstrap "run it for me" (D-10) · managed/on-prem preset pre-fills (D-09).
  - **DEFER (see Deferred Ideas):** full react-router migration · multi-preset engine beyond one-box · on-prem/BYO wizard variants · ClamAV upload scan · **the live end-to-end operator UAT** (structurally needs a human at a browser against a real/local Supabase — the analog of Phase 157's D-09 smoke; code-complete + verify-work + secure-phase are autonomous, the live run is operator-gated).

### Claude's Discretion
Setup-store file format (JSON vs dotenv) + exact `/data` mount path; the exact `/api/setup/*` endpoint shape + step ordering on the wire; whether the config overlay lives in `config.py` or a thin wrapper; the wizard component decomposition; CI job placement for the drift-check — planner/executor decide, honoring D-01..D-18.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 157 deliverables the wizard drives (the exact field set + the manual flow it replaces)
- `deploy/onebox.env.example` — the ~37-key one-box env surface; **the exact fields the wizard collects** (Supabase URL+4 keys, `POSTGRES_DSN`, `REDIS_URL`, `OPERATOR_EMAILS`, one provider key, `SECRETS_ENCRYPTION_KEY`, `VITE_*`).
- `docs/OPERATOR.md` — the Home-B manual runbook (Steps 2–5 + verification checklist) the wizard automates; the Step-3 DB-bootstrap sequence (schema + 9 seeds + global row) the drift-check tracks.
- `docker-compose.prod.yml` — the stack the wizard runs inside; `env_file: ./.env` (read once at create), no writable config volume today (D-02 adds one), the `backend` service the volume attaches to.
- `.planning/phases/157-deployment-presets-runbook-stretch/157-CONTEXT.md` — the 4-homes framing + D-01..D-10 deployment decisions the wizard inherits.

### Backend building blocks (reuse — exact seams, from codebase scout)
- `backend/app/middleware/maintenance.py` (class `MaintenanceMiddleware`:80) — the pure-ASGI gate pattern `SetupMiddleware` mirrors.
- `backend/app/config.py` (`class Settings(BaseSettings)`:742, `env_file=".env"`; `supabase_url`:745 required; `postgres_dsn`:916; `redis_url`:907; `secrets_encryption_key`:941; `operator_emails`:928) — the config layer the setup-store overlays.
- `backend/app/main.py` (lifespan:286; middleware registration:559/567; `/health`:577; router includes:604) — where the gate, the lifespan tolerance, and the `/api/setup` router wire in.
- `backend/app/services/operator_service.py` (`seed_operators_from_env`:136; `is_operator`:31; `write_operator_audit`:49) — operator bootstrap + audit.
- `backend/app/models/user_settings.py` (`save_app_settings`:277 [encrypt-on-write:339]; `maintenance_mode`:910; `_build_settings_from_row`:662) — the app-level settings write seam + where `setup_complete()` lives.
- `backend/app/security/secret_cipher.py` (`SECRET_COLUMNS`:47; `get_cipher`:67; `encrypt_secret`:84) — provider-key encryption (Phase 150).
- `backend/app/services/health_probe.py` (`probe_redis`:45; `probe_supabase`:58; `probe_dependencies`:107) — connection validators the wizard reuses.
- `backend/app/dependencies.py` (`require_operator`:247; `get_supabase`:21; `get_redis`:31; `get_pg_pool`:79) — auth gate + the lazy connection singletons the finalize step re-inits.
- `backend/app/api/admin.py` (`PUT /admin/flags`:507 — writes one flag via `save_app_settings`; router security line:128) — the closest analog to the setup-flag write + the operator-gated router pattern.

### Frontend building blocks (reuse)
- `frontend/src/App.tsx` (`ActiveView`:75; auth-gate branch ~161; `MaintenanceBanner`:23) — where the pre-auth `/setup` branch goes.
- `frontend/src/components/skills/studio/LifecycleStepper.tsx` (full/strip variants) — the wizard step rail.
- `frontend/src/components/workflows/PublishGauntlet.tsx` — the modal-over-backdrop per-stage pass/block gated-flow model (smoke/finalize).
- `frontend/src/components/admin/HealthSignals.tsx` + `ControlRoomPage.tsx` — green-checklist + full-page shell.
- `frontend/src/lib/api.ts` (`API_BASE`:13; `getAuthHeaders`:75; `updateSettings`:2298; `getMaintenanceStatus`:4315) — API-client pattern; `frontend/src/lib/supabase.ts` — the client the D-07 runtime-config shim touches.

### The drift-check's sibling pattern
- `scripts/pending-cloud-migrations.sh` — the style + git-diff structure `scripts/check-deploy-drift.sh` mirrors.
- `docs/SANDBOX-PACKAGES.md` + `CLAUDE.md` (sandbox-tag discipline; "## Deployment (cloud) — operator-gated"; "## Local dev infrastructure") — the existing same-commit sync patterns the CLAUDE.md rule joins.

### Requirements / roadmap / rules
- `.planning/ROADMAP.md` → "### Phase 158: First-Run Install Wizard (STRETCH)" — goal + the 3 Success Criteria.
- `.planning/REQUIREMENTS.md` → DEPLOY-02 (+ DEPLOY-01 for 157 context; "Future" → ClamAV deferred).
- `.planning/STATE.md` → the 157 execution note carrying the **fold-in decision** (drift-check + CLAUDE.md sync rule) + cloud-parity pending (migs 099/100/101 + `SECRETS_ENCRYPTION_KEY`).
- `CLAUDE.md` → "## Deployment (cloud) — operator-gated", "## Local dev infrastructure", the G-1..G-6 guardrails + hot-file ledger.
- Sketch skill: `Skill("sketch-findings-agentic-rag")` — load at UI-build time for the operator/Settings/stepper design language.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`MaintenanceMiddleware`** (`backend/app/middleware/maintenance.py:80`) — copy the pure-ASGI shape for `SetupMiddleware`; same fail-open cached-flag read, different allowlist + polarity.
- **`save_app_settings`** (`user_settings.py:277`) — write app-level config + provider keys (auto-encrypted). The wizard calls it server-side (it's unauthed, so it bypasses `PUT /settings`'s auth but reuses the same write seam).
- **`seed_operators_from_env` + `operator_users` upsert** (`operator_service.py:136`) — operator bootstrap logic to reuse after creating the auth user.
- **`health_probe.probe_*`** (`health_probe.py`) — connection validators, adapted to test submitted values.
- **`LifecycleStepper` / `HealthSignals` / `PublishGauntlet` / `ControlRoomPage`** — the wizard UI is ~90% composition of these shipped, operator-approved primitives (G-2 satisfied by reuse).
- **`MaintenanceBanner`** (`App.tsx:23`, reads public `/health`, polls 30s) — model for the setup-state probe/branch.
- **`scripts/pending-cloud-migrations.sh`** — the drift-check's structural sibling.

### Established Patterns
- **Cached-flag gate, fail-open** — `maintenance_mode()` read through the 30s-TTL settings cache (last-known-good on a blip). The setup gate reuses this, but the **file marker (D-05) is the blip-proof authority** because a DB blip must never re-trigger the wizard on a live box.
- **Encrypt-on-write at one seam** — provider secrets auto-encrypt inside `save_app_settings`; the wizard inherits it for free (needs `SECRETS_ENCRYPTION_KEY` set, else fail-open plaintext + boot warning).
- **Pre-auth SPA branch** — `App.tsx` renders `AuthPage` before `ChatLayout` when `!user`; the wizard adds a parallel `needs_setup` branch (no react-router).
- **Operator-gated router** — `admin.py` `dependencies=[Depends(require_operator)]`; the wizard's WRITE endpoints are instead **setup-token-gated** (pre-auth), and lock out after finalize.

### Integration Points
- **New migration 102** — a `setup_complete` boolean (+ any setup-metadata) column on `app_settings` (apply via Supabase SQL editor per CLAUDE.md; regen `full-schema.sql`).
- **`docker-compose.prod.yml`** — add the `setup_data` volume to `backend` (D-02) → drift-check + OPERATOR.md reflect it → cloud-parity note.
- **`main.py`** — register `SetupMiddleware`; make the lifespan setup-mode-tolerant; include the new `/api/setup` + `/api/public-config` routers.
- **`config.py`** — the setup-store overlay on the `Settings` load path.
- **`App.tsx`** — the pre-auth `/setup` branch + startup status probe.
- **Reported-bugs cross-check: 0 folded** — no open `surface: Agentic-RAG` report touches deployment / first-run / install / config (all 16 open are chat / streaming / provider / agent-loop / sandbox). Consistent with Phase 157.
- **Pending todos: 0 matched Phase 158.**

</code_context>

<specifics>
## Specific Ideas

- The wizard is the browser face of the OPERATOR.md "run-these-commands install" (157-CONTEXT specifics): `git clone` → `docker compose up` → **open the browser → the wizard does the rest** (instead of `cp onebox.env.example ./.env` + hand-fill + paste SQL).
- **First-boot setup token** in the backend logs (Jupyter/n8n/Grafana idiom) is the anti-hijack anchor — surfaced by `docker compose logs backend`.
- **Bootstrap-operator creates the login account directly** (via the service-role Auth admin API) so the operator is an operator on their *first* login — no "sign up, then restart to get seeded" gap.
- **Cloud parity still pending from prior phases** (migs 099/100/101 + `SECRETS_ENCRYPTION_KEY`) — the wizard is the local self-host path; it does not touch the managed superrag.cloud deploy (that stays operator-gated per CLAUDE.md).

</specifics>

<deferred>
## Deferred Ideas

- **Live end-to-end operator UAT** (a real human running the wizard in a browser against a real/local Supabase, finalizing, logging in) — code-complete + verify-work + secure-phase are done autonomously; the live run is **operator-gated** (analog of Phase 157's D-09 smoke). **Re-open:** operator runs the wizard from a fresh `docker compose up`. NOT thrown away — it's the SC#3 lived-experience proof.
- **Server-side DB-bootstrap "run it for me"** (executing `full-schema.sql` + seeds over `POSTGRES_DSN`) — MVP guides/copies the SQL; the auto-runner is a SHOULD gated on asyncpg-executes-pg_dump feasibility. **Re-open:** research confirms clean execution, or an operator asks for zero-SQL-paste setup.
- **Full react-router migration** — the pathname-check branch is the lean path; real routing is deferred. **Re-open:** a second net-new full-page route needs deep-linking.
- **Managed / BYO-cloud / on-prem wizard variants** (beyond pre-fills) — one-box is the built path; the others are pre-fill + link to OPERATOR.md variant sections. **Re-open:** a real buyer commits to a non-one-box home (mirrors 157's deferred full runbooks).
- **Malware scanning (ClamAV) on uploads** — already parked in REQUIREMENTS "Future" ("once DEPLOY-02 exists"); stays deferred.
- **Multi-preset engine + preset authoring** — out of scope; one-box + light pre-fills only.

### Reviewed Todos (not folded)
None — no pending todo matched Phase 158.

</deferred>

---

*Phase: 158-first-run-install-wizard-stretch*
*Context gathered: 2026-07-17*
