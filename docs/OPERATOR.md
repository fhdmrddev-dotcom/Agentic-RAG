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
- **`VITE_*`** (bottom of the file) — the browser-facing Supabase URL + anon key. For a real
  deploy these equal `SUPABASE_URL` / `SUPABASE_ANON_KEY`. **These are baked at build time** —
  if you change one later you must rebuild the frontend (`--build`); a plain `up` won't pick
  it up.

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

> Migrations currently run to 101. `full-schema.sql` is regenerated per migration commit, so
> it should already carry the schema through the latest — the seed-row gap above is separate
> from schema currency. Background: [`../supabase/SETUP.md`](../supabase/SETUP.md).

### Step 4 — Bring the stack up

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

This builds and starts three services (defined in
[`../docker-compose.prod.yml`](../docker-compose.prod.yml)):

- **`frontend`** — nginx serving the built Vite SPA and reverse-proxying `/api/` →
  `backend:8000` (SSE-safe). Published on **`:8080`**.
- **`backend`** — uvicorn (FastAPI): the agent loop / retrieval / tools. Reads your `./.env`.
- **`redis`** — the bundled ephemeral run-stream buffer (no persistence, 256 MB LRU, no host
  port).

Supabase is **not** a service here — the app talks to your external Supabase over the network.

### Step 5 — Open the app

Browse to **`http://localhost:8080`** (or your server's address / domain on port 8080). Log
in with an account whose email is in `OPERATOR_EMAILS` to reach `/admin`. That's a working
deployment.
