# Supabase Setup Guide

End-to-end setup for connecting this app to either a **local** Supabase instance (Docker via Supabase CLI) or a **cloud** Supabase project. Switching between them is just env vars — no code changes.

> **Heads-up:** the canonical migration location is `supabase/migrations/` at the repo root. The folder at `backend/supabase/migrations.archive/` is dead — see its README.

---

## Table of Contents

1. [Architecture overview](#architecture-overview)
2. [Local development setup](#local-development-setup)
3. [Connecting a new cloud Supabase project](#connecting-a-new-cloud-supabase-project)
4. [Switching between local and cloud](#switching-between-local-and-cloud)
5. [Adding a new migration](#adding-a-new-migration)
6. [Storage buckets and auth triggers caveat](#storage-buckets-and-auth-triggers-caveat)
7. [Troubleshooting](#troubleshooting)

---

## Architecture overview

```
┌──────────────────────────────────────────────────────────────────────┐
│ Your app (FastAPI backend + React frontend)                          │
│                                                                      │
│ Reads: backend/.env  →  SUPABASE_URL + auth keys + REDIS_URL + ...   │
└─────────────────────────────────┬────────────────────────────────────┘
                                  │
              ┌───────────────────┴───────────────────┐
              │                                       │
              ▼                                       ▼
┌──────────────────────────┐            ┌──────────────────────────┐
│ Local Supabase (default) │            │ Cloud Supabase (alt)     │
│                          │            │                          │
│ Managed by Supabase CLI: │            │ Project at supabase.com: │
│   supabase start         │            │   project ref + URL      │
│ Runs in Docker:          │            │ Postgres + Auth +        │
│   Postgres on :54322     │            │   Storage + Realtime     │
│   API on :54321          │            │   all hosted             │
│   Studio on :54323       │            │                          │
└──────────────────────────┘            └──────────────────────────┘
```

**Key idea:** the app talks to whatever URL is in `SUPABASE_URL`. It doesn't care if that's `127.0.0.1:54321` or `xyz.supabase.co`.

---

## Local development setup

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop) installed and running
- [Supabase CLI](https://supabase.com/docs/guides/cli/getting-started) installed (`supabase --version` should print a version)

### Steps

1. **Start Supabase locally** (one-time per machine):
   ```powershell
   cd "C:\Vibe Apps\Agentic RAG"
   supabase start
   ```
   First run pulls Docker images (~2 GB) and may take 5–10 minutes. Subsequent starts are seconds. The output prints connection details — keep them handy.

2. **Apply migrations** (already done if `supabase start` succeeded — Supabase CLI auto-applies migrations from `supabase/migrations/` on start):
   ```powershell
   supabase db reset --no-seed   # only if you need a clean slate
   ```
   Reset wipes data and reapplies all 32+ migrations in order. Use it after pulling new migrations or when local DB drifts.

3. **Configure `backend/.env`** with the local connection details. Open `backend/.env.example` for the full template. Local defaults look like:
   ```env
   SUPABASE_URL=http://127.0.0.1:54321
   SUPABASE_ANON_KEY=<from `supabase status` output>
   SUPABASE_SERVICE_ROLE_KEY=<from `supabase status` output>
   DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
   ```
   The local anon/service keys are deterministic across all Supabase CLI installs — they're signed by the CLI's default JWT secret. Safe for local dev only.

4. **Start Redis** (for v2.5 run-backed streaming):
   ```powershell
   docker compose -f docker-compose.dev.yml up -d
   ```

5. **Start the backend**:
   ```powershell
   cd backend
   .\venv\Scripts\Activate.ps1
   uvicorn app.main:app --reload --port 8000
   ```

6. **Start the frontend**:
   ```powershell
   cd frontend
   npm run dev
   ```

7. **Open the app**: http://localhost:5173/

### Useful local URLs

| URL | What |
|---|---|
| http://127.0.0.1:54321 | Supabase API (your `SUPABASE_URL`) |
| http://127.0.0.1:54323 | Supabase Studio (DB browser, SQL editor, table view) |
| http://127.0.0.1:54324 | Mailpit (catches emails for password reset, magic links, etc.) |
| http://localhost:5173 | App frontend |
| http://localhost:8000/docs | FastAPI Swagger |
| http://localhost:5540 | Redis Insight (if started with `--profile insight`) |

---

## Connecting a new cloud Supabase project

You have two paths. Pick based on tooling preference.

### Path 1 — `supabase db push` (recommended for production)

Uses the canonical migration files. Tracks applied state in the cloud DB. Future migrations apply incrementally with the same command.

1. **Create the cloud project** at https://supabase.com/dashboard/projects → **New project**. Note the **Project Ref** (in the URL: `https://supabase.com/dashboard/project/<ref>`).

2. **Log in to the CLI** and link this repo to the cloud project:
   ```powershell
   cd "C:\Vibe Apps\Agentic RAG"
   supabase login                          # browser flow, one-time
   supabase link --project-ref <ref>       # links the repo
   ```

3. **Push all migrations**:
   ```powershell
   supabase db push
   ```
   Applies every file in `supabase/migrations/` in numeric order against the cloud DB. Records each in `supabase_migrations.schema_migrations` so re-runs are no-ops.

4. **Get the cloud connection details** from the dashboard:
   - **Project URL**: dashboard → Project Settings → Data API → Project URL
   - **Anon key**: same page → Project API keys → `anon` `public`
   - **Service role key**: same page → Project API keys → `service_role` `secret` (treat like a password)
   - **DB password**: dashboard → Project Settings → Database → Connection string

5. **Update `backend/.env`** with cloud values:
   ```env
   SUPABASE_URL=https://<ref>.supabase.co
   SUPABASE_ANON_KEY=<anon key>
   SUPABASE_SERVICE_ROLE_KEY=<service role key>
   DATABASE_URL=postgresql://postgres.<ref>:<db-password>@aws-0-<region>.pooler.supabase.com:5432/postgres
   ```
   Keep all other env vars (`OPENAI_API_KEY`, `REDIS_URL`, etc.) the same.

6. **Restart the backend**. The app now talks to cloud Supabase.

### Path 2 — Paste `supabase/full-schema.sql` into the SQL Editor

For when you want to set up schema without the CLI. As of the self-contained-artifact
update, this is now a **true single paste** — no manual storage/auth/realtime follow-up.

1. **Create the cloud project** as in Path 1.

2. **Open the SQL Editor**: dashboard → SQL Editor → **New query**.

3. **Paste the entire contents of `supabase/full-schema.sql`** and click **Run**.
   - It enables `pgvector`, creates every `public` table + RLS, the four storage
     buckets (`documents`, `sandbox-outputs`, `skill-files`, `workspace-files`) and
     their policies, the `on_auth_user_created` signup trigger, and the realtime
     publication memberships — all in one shot.
   - Supabase will warn *"creates tables without enabling RLS"* — click **"Run without
     RLS"**. That just means "run my SQL as written"; the file enables RLS itself (30+
     `ENABLE ROW LEVEL SECURITY` + 87 policies). Do **not** pick "Run and enable RLS"
     (it would wrongly lock down the intentionally-shared global folders/skills tables).

4. **Get connection details and update `backend/.env`** as in Path 1 step 4–6.

> **How Path 2 is now self-contained:** `full-schema.sql` is generated by `pg_dump
> --schema=public` (which alone misses cross-schema bits and emits pg_dump-17 `\restrict`
> meta-commands + a `CREATE SCHEMA public` that collides with Supabase's). The generator
> `scripts/regenerate-full-schema.sh` now post-processes the dump (strips the meta-commands,
> makes the schema idempotent, injects `CREATE EXTENSION vector`) and appends
> `scripts/full-schema-supplement.sql` (storage buckets/policies, auth trigger, realtime).
> **If you add a migration that creates a new storage bucket, an `auth.users` trigger, or a
> realtime table, mirror it (idempotently) into `scripts/full-schema-supplement.sql`** so the
> bootstrap stays complete.

---

## Switching between local and cloud

The app reads `backend/.env` at startup. To swap:

1. Stop the backend (`Ctrl+C`)
2. Edit `backend/.env`:
   - For local: `SUPABASE_URL=http://127.0.0.1:54321` + local anon/service keys
   - For cloud: `SUPABASE_URL=https://<ref>.supabase.co` + cloud anon/service keys
3. Restart: `uvicorn app.main:app --reload --port 8000`

**Tip:** keep two files like `backend/.env.local` and `backend/.env.cloud` and copy the right one over `backend/.env` when switching. They're all gitignored.

The frontend reads `frontend/.env.local` for `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (separately from backend) — update both when switching.

---

## Adding a new migration

The schema-change discipline:

1. **Create the migration file** in `supabase/migrations/` with the next sequential number:
   ```
   supabase/migrations/035_my_new_change.sql
   ```
   Filename pattern: `<digits>_<snake_case_name>.sql`. The Supabase CLI is strict — letters in the prefix (`007b`, `008b`) get silently skipped. Use sequential integers.

2. **Test locally** by resetting the local DB and confirming the migration applies cleanly:
   ```powershell
   supabase db reset --no-seed
   ```
   If reset fails on your migration, fix it before continuing. Migrations must be idempotent against fresh installs.

3. **Regenerate `full-schema.sql`** to keep the bootstrap artifact current:
   ```powershell
   & "C:\Program Files\Git\bin\bash.exe" scripts/regenerate-full-schema.sh
   ```

4. **Commit both the migration and the regenerated schema** in the same commit:
   ```powershell
   git add supabase/migrations/035_my_new_change.sql supabase/full-schema.sql
   git commit -m "feat(<phase>): add <description> migration"
   ```

5. **Push to cloud Supabase** (if applicable):
   ```powershell
   supabase db push
   ```

---

## Cross-schema bits (storage / auth / realtime) — now bundled

`supabase/full-schema.sql` is generated via `pg_dump --schema=public`, which on its own covers **everything in the `public` schema** (tables, functions, indexes, RLS) but **cannot** capture objects in other schemas or global objects:

| Cross-schema bit | Defined in | Now handled by |
|---|---|---|
| `on_auth_user_created` trigger on `auth.users` | migration `001_initial_schema.sql` | `scripts/full-schema-supplement.sql` |
| Storage buckets `documents`, `sandbox-outputs`, `skill-files`, `workspace-files` | migrations `017`, `029`, `054` | `scripts/full-schema-supplement.sql` |
| Storage RLS policies on `storage.objects` | migrations `017`, `029`, `054` | `scripts/full-schema-supplement.sql` |
| Realtime publication (`documents`, `folders`, `messages`) | migrations `002`, `014`, `032` | `scripts/full-schema-supplement.sql` |
| `pgvector` extension (`public.vector`) | migration `001_initial_schema.sql` | injected by the regen script's post-processing |

**Resolved:** `regenerate-full-schema.sh` now post-processes the dump and appends `full-schema-supplement.sql`, so `full-schema.sql` is a true single-paste bootstrap for a fresh project (both Path 1 and Path 2 now produce a complete DB). The supplement is **idempotent** — you can also paste just `scripts/full-schema-supplement.sql` into an already-provisioned project to back-fill a bucket/trigger/realtime table added after that project was created.

**Maintenance rule:** when a new migration adds a storage bucket, an `auth.users` trigger, or a realtime table, mirror it idempotently into `scripts/full-schema-supplement.sql` (it won't be picked up automatically — the dump can't see cross-schema objects).

---

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `supabase start` hangs or fails | Docker Desktop not running, or port conflict | Open Docker Desktop; `docker ps` to find conflicting containers |
| `supabase db reset` skips migrations with "file name must match pattern" | Migration filename has letters in prefix (e.g. `007b_...`) | Rename to next available integer (e.g. `035_...`) |
| `supabase db dump` times out with "Failed to create login role" | CLI version v2.78–v2.80 bug | Use `bash scripts/regenerate-full-schema.sh` (uses pg_dump via docker exec, sidesteps the issue) |
| App returns 401 from Supabase calls | Wrong/expired keys in `backend/.env` | Re-copy from `supabase status` (local) or dashboard (cloud); restart backend |
| Document upload fails with "bucket not found" | Used Path 2, didn't create buckets manually | Storage UI → New bucket → `documents`; rerun `029_storage_buckets.sql` for policies |
| New user signup succeeds but profile is missing | Used Path 2, didn't apply auth trigger manually | Paste the `CREATE TRIGGER on_auth_user_created` block from `001_initial_schema.sql` |
| Realtime not updating chat | Migration `032_phase56_realtime.sql` didn't run, or replica identity wrong | Re-run `032_phase56_realtime.sql` from SQL Editor |
| `supabase db push` errors on a migration | Migration assumes data that prod doesn't have, or syntax difference | Read the error, fix the migration, regenerate full-schema, commit, retry |

---

## Reference

- Supabase CLI docs: https://supabase.com/docs/guides/cli
- pg_dump options: https://www.postgresql.org/docs/current/app-pgdump.html
- Migration source of truth: `supabase/migrations/`
- Bootstrap artifact: `supabase/full-schema.sql` (generated)
- Regen script: `scripts/regenerate-full-schema.sh`
- Env template: `backend/.env.example`
- Legacy folder (DO NOT USE): `backend/supabase/migrations.archive/`
