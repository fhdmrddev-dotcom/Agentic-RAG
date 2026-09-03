# OPERATOR.md — Stand up Agentic RAG from zero

**Day-0 runbook.** This is the single front-door doc for standing up a working
production deployment of Agentic RAG from nothing. Follow it top-to-bottom for the
canonical one-box path; jump to the variant sections for the managed /
bring-your-own-cloud / on-prem homes.

> **This supersedes the old bare-VPS guide.** The previous host-nginx + systemd + venv
> + WinSCP guide at
> [`../.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md`](../.planning/research/recovered/RECOVERED_VPS_Deployment_Guide.md)
> is kept only as historical reference — **do not follow it for a new deploy.**
> Everything below is containerized: one `docker compose up`.

---

## The 4 homes (one codebase, four places it can run)

Where each piece runs is **configuration, not a code change** — the app switches between
local, cloud, and on-prem by changing env vars only. There are four "homes":

| Home | What it is | Status in this runbook |
|---|---|---|
| **A — Managed / SaaS** | You host it for customers (vendor infra) — this is `superrag.cloud` today. | Documented as a variant → cross-links the live pipeline. |
| **B — One-box self-host** | The customer's single server: `git clone` + `docker compose up`. | **Canonical happy path — fully walked below.** |
| **C — Bring-your-own-cloud** | The customer's own AWS/Azure/GCP + their ops team. | Short variant-delta section. |
| **D — On-prem / air-gapped** | Sealed inside the building; AI models on the customer's own GPUs (Ollama/LM Studio), self-hosted Supabase, no internet. | Short variant-delta section; full sealed runbook deferred. |

Scale — worker count, DB size, Redis memory — is a **dial you turn inside a home**, not a
separate product. A bigger deployment is the same compose file with `WORKER_COUNT` raised
and bigger hardware.

## Related docs (single-sourced — linked, never duplicated)

This runbook is the "stand up from zero" path. It **bakes in** the fixes from the lessons
log so you never re-hit them, but it does **not** duplicate the architecture map or the
day-2 promotion process — those live in their own docs:

- **[`./DEPLOYMENT-PIPELINE.md`](./DEPLOYMENT-PIPELINE.md)** — the managed (home A)
  architecture + accounts map: what runs where (Vercel + Coolify + Supabase + Upstash),
  costs, `superrag.cloud`. Read this for the managed variant.
- **[`./DEPLOYMENT-WORKFLOW.md`](./DEPLOYMENT-WORKFLOW.md)** — day-2 operations: the
  `develop → master → production` branch-promotion flow and the local↔cloud parity
  checklist. Read this once your box is live and you're shipping updates.
- **[`./DEPLOYMENT-LESSONS.md`](./DEPLOYMENT-LESSONS.md)** — the running log of real failure
  modes (A1–A7 initial-deploy, B1–B5 post-deploy). Every fix baked into this runbook traces
  back to an entry here; read it for the full symptom → root cause → fix story.

## Prerequisites

- **Docker Engine + Compose v2** (`docker compose`, not the old `docker-compose`) on the
  host. This is the deployment target — the whole product runs as containers.
- **A Supabase project** (cloud — the free tier is fine to start; Pro ~$25/mo for no-sleep +
  backups). Supabase is **always external** — it is never bundled into the compose. You need
  its URL + the anon / service-role / publishable / secret keys, and the Session-pooler
  Postgres DSN.
- **At least one LLM provider API key** (OpenAI by default; Anthropic / Google / OpenRouter
  also supported — or point at local models for home D).
- The repo cloned on the host.

---

## Home B — the one-box happy path (canonical)

One server, one `docker compose up`, a browsable working app (the DB is the only external
piece). This is the "run-these-commands" install.

> **Browser install wizard (Phase 158 — DEPLOY-02).** The manual Steps 2–5 below can also be
> driven from a browser: clone the repo (Step 1), bring the stack up (Step 4), then open
> **`http://localhost:8080/setup`**. A first-run wizard walks the same flow — environment
> detect → Supabase/Redis bind → operator bootstrap → provider key → smoke test — **without
> hand-editing `./.env`**. It is idempotent and **locks out after finalize**. It requires a
> one-time **setup token** printed to the backend logs — read it with:
> ```bash
> docker compose -f docker-compose.prod.yml logs backend | grep -i "setup token"
> ```
> The wizard is **additive**: this manual runbook stays the canonical fallback (and the source
> of truth the deploy drift-check tracks — `scripts/check-deploy-drift.sh`).

### Step 1 — Clone the repo

```bash
git clone <your-repo-url> agentic-rag
cd agentic-rag
```

### Step 2 — Create and fill your `.env`

The one-box preset is a filled-in template. Copy it to the repo-root `./.env` (gitignored —
your real secrets live only there, never in the committed template):

```bash
cp deploy/onebox.env.example ./.env
```

Then edit `./.env` and fill in:

- **Supabase** — `SUPABASE_URL` + the four keys (`SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) from the
  Supabase dashboard (Settings → API), and `POSTGRES_DSN` (see the Session-pooler note under
  **Configuration** below — get this one right or the backend can't reach the DB).
- **One provider key** — e.g. `OPENAI_API_KEY`.
- **`OPERATOR_EMAILS`** — your own email, so you're bootstrapped as the operator on first
  boot. This is what unlocks `/admin` — **not** `ENVIRONMENT` (as of Phase 146, `ENVIRONMENT`
  is only a deploy marker; the operator gate is `OPERATOR_EMAILS` + the `operator_users`
  table).
- **`SECRETS_ENCRYPTION_KEY`** — generate a Fernet key so provider keys are encrypted at rest:
  ```bash
  python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
  ```
  Paste the output as the value. (Leaving it blank boots with a loud plaintext warning; a
  malformed key refuses to boot — see **Security** below.)
- **SSO (SAML 2.0) — optional (Phase 168)** — only if org-admins will register a SAML IdP.
  Leave `SUPABASE_SELF_HOSTED=false` (the Cloud default) and set `SUPABASE_PROJECT_REF` (Supabase
  Dashboard → Project Settings → General → Reference ID — config, not a secret). The Cloud
  Management/PAT token (`sbp_…`) is **not** an env var — seed it once into
  `app_settings.supabase_management_token` (Step 3 below), where `SECRETS_ENCRYPTION_KEY` encrypts
  it at rest. On **self-hosted** GoTrue set `SUPABASE_SELF_HOSTED=true` — it authenticates with
  `SUPABASE_SERVICE_ROLE_KEY`, so no management token is needed.
- **Scheduled workflow runs — optional (Phase 204, SCHED-01)** — `SCHEDULER_PROCESS_ENABLED`
  ships **`false`**. Set it to `true` only when you want published workflows to run on a cron
  or interval **with nobody watching**. It is safe at any `WORKER_COUNT`: every worker polls,
  and a due schedule still fires exactly once, because the claim is a database transaction
  (`FOR UPDATE SKIP LOCKED` plus the `next_run_at` advance inside it) rather than an
  in-process lock. `SCHEDULER_POLL_INTERVAL_SECONDS` (default `60`) is the tick;
  `SCHEDULER_MAX_CLAIMS_PER_TICK` (default `10`) is backpressure — it stops a box that was
  offline over a weekend from launching every overdue schedule at once. Each schedule carries
  its own per-run token and duration ceilings, set in the app when the schedule is created.
- **`VITE_*`** (bottom of the file) — the browser-facing Supabase URL + anon key. For a real
  deploy these equal `SUPABASE_URL` / `SUPABASE_ANON_KEY`. **These are baked at build time** —
  if you change one later you must rebuild the frontend (`--build`); a plain `up` won't pick
  it up.
- **`VITE_DEMO_URL` & `VITE_APP_URL`** (Phase 226) — public landing page CTA destinations.
  `VITE_DEMO_URL` points to your demo scheduling link (e.g. Google Calendar appointment page);
  if empty, the "Book a demo" CTA defaults to `#start`. `VITE_APP_URL` is the base URL of the
  application SPA (e.g. `https://app.example.com`); if empty, "Sign in" targets `/app`.

The full annotated variable surface is
[`../deploy/onebox.env.example`](../deploy/onebox.env.example) (layered on
[`../backend/.env.example`](../backend/.env.example)).

### Step 3 — Bootstrap a fresh database (do this once)

A brand-new Supabase project has an empty schema.
[`../supabase/full-schema.sql`](../supabase/full-schema.sql) is a `pg_dump --schema-only`
artifact — it creates all the tables, RLS, storage buckets, and the auth trigger, **but it
does not carry seed rows.** A fresh DB needs the schema **plus** the seed migrations the dump
misses, or features silently run on defaults (this is lessons-log **A6**). In the Supabase
SQL editor, in order:

1. **Paste [`../supabase/full-schema.sql`](../supabase/full-schema.sql)** and run it (choose
   **"Run without RLS"** — the file enables RLS itself). One shot: tables + RLS + the 4
   storage buckets + the `on_auth_user_created` trigger + realtime + pgvector.

2. **Apply the 9 seed migrations** the schema-only dump skips, from `supabase/migrations/`,
   by exact filename:

   | Order | File | Carries |
   |---|---|---|
   | 1 | `010_app_settings.sql` | app_settings substrate |
   | 2 | `018_skill_creator_seed.sql` | (superseded by 087) |
   | 3 | `053_settings_unification.sql` | settings unification seed |
   | 4 | `056_workflow_definitions.sql` | workflow definitions seed |
   | 5 | `061_harness_seed_templates.sql` | harness templates |
   | 6 | `066_eval_coverage_seed.sql` | eval coverage seed |
   | 7 | `087_skill_creator_reborn.sql` | skill-creator seed row — **apply FIRST of the trio** |
   | 8 | `088_skill_creator_eval_step_sequencing.sql` | UPDATEs 087's row — **apply SECOND** |
   | 9 | `089_skill_creator_file_attach_honesty.sql` | UPDATEs 087's row — **apply THIRD** |

   **Order matters only within the trio `087 → 088 → 089`** (088 and 089 both UPDATE the row
   087 creates). All nine are idempotent — safe to re-run.

3. **Insert the global settings row** (the exact A6 fix — without it, Settings shows a fake
   "Saved" but persists nothing, because `save_app_settings` does an `UPDATE ... WHERE
   id='global'` that matches 0 rows):

   ```sql
   INSERT INTO app_settings (id) VALUES ('global') ON CONFLICT DO NOTHING;
   ```

4. **Verify the skill-creator seed** landed:

   ```sql
   SELECT count(*) FROM public.skills
    WHERE id='00000000-0000-0000-0000-000000000010' AND is_system=true;   -- expect 1
   ```

   If this returns 0, re-apply `087 → 088 → 089` in order.

5. **(Optional — Cloud SAML SSO, Phase 168)** Skip unless org-admins will register SAML IdPs on
   **Cloud** Supabase. Seed the Management/PAT token (`sbp_…`, from Supabase Dashboard → Account →
   Access Tokens — the `service_role` key does **not** work against the Management API) into
   `app_settings`:

   ```sql
   UPDATE app_settings SET supabase_management_token = '<sbp_...>' WHERE id = 'global';
   ```

   With `SECRETS_ENCRYPTION_KEY` set, the next backend boot's idempotent sweep encrypts this column
   at rest (`enc:v1:` envelope) — the token is decrypted only at call time and never logged. Also
   set `SUPABASE_PROJECT_REF` in `./.env` (see Step 2). On **self-hosted** GoTrue
   (`SUPABASE_SELF_HOSTED=true`) skip this entirely — the `service_role` key is used instead.

6. **Know what is already switched on — the feature-visibility cold defaults.** ⚠ There is
   **nothing to paste here**; this table exists so a fresh operator can see what a brand-new box
   shows before they touch anything. Feature visibility is an **audience enum**, never a boolean,
   and the authoritative cold default lives in code (`_GOVERNED_FEATURES` in
   `backend/app/models/user_settings.py`) — **not** in a seed row. An unseeded
   `app_settings.feature_visibility` key falls through to it, so a fresh DB needs no insert for
   any of these. The JSONB gains a key only when an operator flips it in `/admin` (an atomic
   per-key merge, so flipping one never clobbers another).

   | Governed feature | Cold default | What that means on a fresh box |
   |---|---|---|
   | `workflow_authoring` | `everyone` | Every signed-in user can author workflows. |
   | `governance_health` | `everyone` | The governance-health page is visible to everyone. |
   | `visual_workflow_canvas` | `everyone` | The visual workflow canvas + step surfaces render for everyone. ⚠ Changed 2026-08-28 (Phase 214) — it was `off` from Phase 181 through v3.7. To hide it, flip it to `off` in `/admin`. |
   | `live_connectors` | `off` | ⚠ **Outbound sending is DISABLED.** An external-action step records what it *would* send and reads "Not sent — recorded". Flip this to `everyone` only when you intend real mail/messages to leave the box. |
   | `skill_studio` | `operators` | Visible only to accounts listed in `OPERATOR_EMAILS`. |
   | `model_management` | `operators` | Visible only to accounts listed in `OPERATOR_EMAILS`. |

   ⚠ **This table is enforced by a unit test, not by the drift script.**
   `scripts/check-deploy-drift.sh` reads env-var keys, migration filenames, the sandbox tag and the
   compose file — it has never looked at `feature_visibility` and cannot tell you this table has
   gone stale. `backend/tests/unit/test_214_flag_cold_default.py` is what fails when a governed
   feature is added or a default changes without this table following in the same commit.

> Migrations currently run to **124** (⚠ this line read `102` until 2026-08-24 and had been
> stale for twenty-two migrations — re-derive it with `ls supabase/migrations | tail -1` rather
> than trusting it). The newest, migration **124** (Phase 204, SCHED-01), creates the
> `workflow_schedules` table with owner-scoped RLS — **schema, not a seed**, so like 102 it is
> deliberately absent from the table above and needs no separate paste on a fresh box:
> `full-schema.sql` already carries it. ⚠ Its FILENAME is deliberately not spelled here:
> `scripts/check-deploy-drift.sh` greps this WHOLE document for `NNN_name.sql`, not just the
> Step-3 table, so any prose mention is counted as a listed seed — which both inflates the
> reported seed count and raises the ceiling that suppresses its own seed-bearing warning.
> `full-schema.sql` is regenerated per migration commit, so it should already carry the schema
> through the latest — the seed-row gap above is separate from schema currency. Background:
> [`../supabase/SETUP.md`](../supabase/SETUP.md). **Cloud-parity pending:** migrations 099–102
> + `SECRETS_ENCRYPTION_KEY` still need applying to the cloud Supabase at the next promotion
> (see the deploy-parity checklist in [`./DEPLOYMENT-WORKFLOW.md`](./DEPLOYMENT-WORKFLOW.md);
> `scripts/pending-cloud-migrations.sh` prints the exact set).

### Step 4 — Bring the stack up

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds and starts three services (defined in
[`../docker-compose.prod.yml`](../docker-compose.prod.yml)):

- **`frontend`** — nginx serving the built Vite SPA and reverse-proxying `/api/` →
  `backend:8000` (SSE-safe). Published on **`:8080`**.
- **`backend`** — uvicorn (FastAPI): the agent loop / retrieval / tools. Reads your `./.env`.
  Carries a persistent **`setup_data`** volume (mounted at `/data`) — the first-run install
  wizard's setup-store (`/data/setup.json`, `0600`: infra config + the finalize marker + the
  setup token). It survives `up -d --build` recreates and restarts, so a wizard-configured box
  keeps its config.
- **`redis`** — the bundled ephemeral run-stream buffer (no persistence, 256 MB LRU, no host
  port).

Supabase is **not** a service here — the app talks to your external Supabase over the network.

### Step 5 — Open the app

Browse to **`http://localhost:8080`** (or your server's address / domain on port 8080). Log
in with an account whose email is in `OPERATOR_EMAILS` to reach `/admin`. That's a working
deployment.

---

## Configuration — the gotchas this runbook bakes in

These are the settings a first deploy most often gets wrong. Each traces to a lessons-log
entry; get them right in your `./.env` and you skip the whole class of failure.

### Postgres DSN — use the Session pooler on `:5432` (A4)

`POSTGRES_DSN` must point at Supabase's **Session pooler** (IPv4), which looks like:

```
postgresql://postgres.<project-ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres
```

Do **not** use:

- the **direct** `db.<ref>.supabase.co` host — it's **IPv6-only**, and the container usually
  can't reach it;
- the **`:6543` transaction pooler** — it breaks asyncpg's prepared statements.

(If auth fails repeatedly, Supavisor trips an `ECIRCUITBREAKER` — wait ~3 minutes before
retrying.)

### Redis — `rediss://` TLS when managed (A5)

The one-box compose bundles Redis, so `REDIS_URL=redis://redis:6379` (plain, over the compose
network). But if you point at a **managed** Redis (e.g. Upstash), it requires TLS — use
**`rediss://`** (two s's). A plain `redis://` to a managed host fails with "Streaming
infrastructure unavailable." Details: [`../REDIS-SETUP.md`](../REDIS-SETUP.md).

### `FRONTEND_URL` — comma-split, list every origin (B1)

CORS allows exactly the origins in `FRONTEND_URL`. It is **comma-split multi-origin** — list
**every** browser origin that will hit the API, or preflight `OPTIONS` requests return `400`
and the app can't talk to itself:

```
FRONTEND_URL=https://app.example.com,https://www.example.com
```

For the local one-box that's `http://localhost:8080` (the published nginx port).

### Pin known-good models per environment (B3)

A model that works on your laptop can **404 on a cloud key** — provider accounts differ in
which models they can serve. Pin the model IDs you know your key serves (e.g.
`OPENAI_MODELS=...`) rather than relying on a default that may not exist for this account. A
stale default silently degraded metadata extraction to NULL in production once.

### Invitation email — optional; the default just logs the link (Phase 167)

Org-admins invite teammates by a secure link. Delivery is env-switched and **off by default** —
no email account needed to run:

- **`EMAIL_PROVIDER=none`** (default) — the app **logs the invite link** (visible in
  `docker compose logs backend`) and the org-admin copies + shares it. Works fully offline.
- **`EMAIL_PROVIDER=resend`** — sends real email. Opt-in: `pip install resend` into the backend
  venv (it is **not** a default requirement), then set `RESEND_API_KEY` (secret — env only) and
  `INVITE_FROM_EMAIL` (your verified from-address).

The invite-link base reuses `FRONTEND_URL` (above) — there is **no** separate base-URL var.

## Security

The instructions above **are** the security posture of a self-hosted box. Three things matter
most.

### Encrypt secrets at rest — `SECRETS_ENCRYPTION_KEY` (SEC-01)

Provider/secret keys stored in `app_settings` are encrypted with a Fernet key (Phase 150).
Generate and set it:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Behavior:

- **Blank** (default) — fail-open: secrets stay **plaintext** with a loud startup warning.
- **Valid key** — encrypted at rest (an idempotent boot sweep encrypts existing rows).
- **Malformed key** — the backend **refuses to start** (fail-closed, on purpose).

For the managed home, set `SECRETS_ENCRYPTION_KEY` per-environment in Coolify — never commit a
real key.

### The sandbox mounts the Docker socket — SINGLE-TENANT BOXES ONLY (B2)

> **⚠️ LOUD WARNING: a mounted `/var/run/docker.sock` grants the backend container root on the
> host.** The `execute_code` sandbox spawns sibling containers via the host Docker daemon,
> which requires this mount (`docker-compose.prod.yml` includes it). **This is safe only on a
> single-tenant box** — one customer/org per host. **Never** run this compose as-is on a
> shared / multi-tenant machine; a mounted socket = a host-takeover surface. If you must run
> multi-tenant, set `SANDBOX_ENABLED=false` (you lose code execution) or isolate each tenant on
> its own host.

For the sandbox to actually work you also need the image built **on the host** (it is not
pulled at runtime):

```bash
docker build -f backend/Dockerfile.sandbox -t agentic-rag-sandbox:101.1 backend/
```

…and — on a Coolify / managed host whose Docker cleanup prunes unreferenced images — **pin
it** so a routine deploy doesn't sweep it (this bit us twice):

```bash
docker create --name sandbox-image-keeper agentic-rag-sandbox:101.1
```

The keeper is a never-started container that references the image so image-prune spares it.
Every time the `SANDBOX_IMAGE` tag bumps: rebuild on the host, `docker rm
sandbox-image-keeper`, recreate the keeper on the new tag. **The durable fix** is to push the
image to a private registry (GHCR) so the host can re-pull instead of host-building. (Full
recipe: [`./DEPLOYMENT-LESSONS.md`](./DEPLOYMENT-LESSONS.md) B2.)

### Don't expose Redis

The bundled `redis` publishes **no** host port — the backend reaches it only over the compose
network. Never publish `6379` to the public internet without `--requirepass`.

---

## Home A — managed SaaS (variant)

This is the vendor-hosted path (`superrag.cloud` today): frontend on **Vercel**, backend +
sandbox on a **Hostinger VPS running Coolify**, DB on **Supabase cloud**, Redis on
**Upstash**. It's document-only here — the full accounts + architecture map lives in
**[`./DEPLOYMENT-PIPELINE.md`](./DEPLOYMENT-PIPELINE.md)** (read that; don't re-derive it).

The one managed-specific gotcha to bake in — the Coolify backend service (lessons-log **A3**):

- **Base Directory** `/backend`, **Dockerfile** `/Dockerfile` (don't double it to
  `backend/backend`).
- **Ports Exposes** `8000` (the app's port — not Coolify's default 3000).
- **Domain** `https://` (an `http://` domain creates only an HTTP router → 503 on https).

Day-2 promotion (`develop → master → production`) and the cloud-parity checklist are in
**[`./DEPLOYMENT-WORKFLOW.md`](./DEPLOYMENT-WORKFLOW.md)** — not repeated here.

## Homes C & D — variant deltas (short)

The one-box compose (home B) is the engine; homes C and D are the **same app, different env
vars**. These are delta notes, not full runbooks.

### Home C — bring-your-own-cloud

The customer runs on their own AWS/Azure/GCP. Deltas from home B: point `SUPABASE_URL` /
`POSTGRES_DSN` / `REDIS_URL` at their managed equivalents (managed Redis → `rediss://` TLS,
A5), set `FRONTEND_URL` to their origin(s), and run the same compose (or split the services
across their orchestrator). Full bring-your-own-cloud reference manifests
(Kubernetes/Terraform) are **deferred** until a customer commits to their own cloud.

### Home D — on-prem / local-GPU

Sealed inside the building, AI models on the customer's own GPUs. **This needs zero new app
code** — the app already supports local models (Ollama / LM Studio) and multi-provider
embeddings. Deltas from home B (all in `./.env`):

```
LLM_PROVIDER=ollama
OLLAMA_BASE_URL=http://<gpu-host>:11434          # or LMSTUDIO_BASE_URL=http://<gpu-host>:1234/v1
EMBEDDING_BASE_URL=http://<gpu-host>:<port>/...  # local embedding endpoint
SUPABASE_URL=<self-hosted-supabase-url>          # on-prem Supabase
```

Pick an embedding model whose output dimension matches `EMBEDDING_DIMENSIONS` (e.g. nomic =
768, MiniLM = 384). The **full sealed air-gapped runbook** — self-hosted Supabase Docker stack
+ end-to-end local-GPU wiring + no-internet install — is **deferred** until a real on-prem /
air-gapped buyer exists to validate it. This section is the pointer; nothing is thrown away.

---

## Verification checklist (run on a real box)

After `docker compose -f docker-compose.prod.yml up -d --build`, confirm:

- [ ] **`/health` returns 200** — `curl http://localhost:8000/health` (direct) →
  `{"status":"ok", ...}`. Through nginx: `curl http://localhost:8080/api/health` (also proves
  the `/api/` prefix strip). `redis` should read `"ok"`.
- [ ] **Frontend loads** — open `http://localhost:8080`; the SPA renders (not a blank page or
  a Supabase-URL console error — that would mean a `VITE_*` build-arg was wrong; rebuild with
  `--build`).
- [ ] **Login works** — sign in; a user in `OPERATOR_EMAILS` reaches `/admin`.
- [ ] **One chat turn completes** — send a plain chat / retrieval prompt (no code execution
  needed, so this passes even before you host-build the sandbox image) and watch the SSE stream
  finish.

If all four pass, the deployment is live. For ongoing updates, switch to
**[`./DEPLOYMENT-WORKFLOW.md`](./DEPLOYMENT-WORKFLOW.md)**.
