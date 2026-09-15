---
seed_id: SEED-266
title: full-schema.sql carries no table ACLs and leaks `SET row_security = off` — benign for a Supabase paste, a live trap for a plain-Postgres bootstrap or any program that applies it
created: 2026-09-10
planted_during: Phase 241 (QUEUE-06), plan 241-04 — found by RUNNING the artifact, not by reading it
status: planted
priority: medium
surface: Agentic-RAG
severity: major            # Not currently reachable on the documented deploy path. It becomes a security-shaped defect the moment a non-Supabase target exists.
folded_into: null
relates_to:
  - `supabase/full-schema.sql` — the single-file bootstrap artifact. NEVER hand-edited; regenerated
    by `scripts/regenerate-full-schema.sh`.
  - `scripts/regenerate-full-schema.sh` — the generator. `pg_dump --schema-only --no-privileges`.
  - `docs/OPERATOR.md` Step 3 — the greenfield bootstrap, which today targets a SUPABASE project.
  - `scripts/build-recall-bench.py` — the first program in this repo to apply the artifact to a
    PLAIN Postgres database and then keep working on the same connection. It hit both halves.
trigger_when: >
  ANY of these becomes true:
  (1) a deployment target that is NOT a Supabase project is supported — a self-hosted or "onebox"
      Postgres, a plain RDS/Cloud SQL instance, or any greenfield DB created with CREATE DATABASE;
  (2) any program, script, CI job or migration runner applies full-schema.sql and then issues
      further statements on the SAME connection;
  (3) `scripts/regenerate-full-schema.sh` is changed, or the `--no-privileges` flag is revisited;
  (4) a phase touches the bootstrap path in docs/OPERATOR.md Step 3.
trigger_paths:
  - "**/full-schema.sql"
  - "docs/OPERATOR.md"
  - "scripts/regenerate-full-schema.sh"
---

# What was measured

Phase 241 built a throwaway `recall_bench` database from `supabase/full-schema.sql` on a plain
local Postgres — the first time in this repo the artifact was applied anywhere other than a
Supabase project. **Two defects surfaced immediately, and neither is visible by reading the file.**

## 1. The artifact carries NO table ACLs at all

`scripts/regenerate-full-schema.sh` runs `pg_dump` with **`--no-privileges`**, so no `GRANT`
statements are emitted. The grants the running system depends on do not live in the dump — they
come from **default privileges**, which are stored in `pg_default_acl` and are **per-database**.
A newly created database has an empty `pg_default_acl`.

Measured on the 100k bench: the artifact applied **green**, all three retrieval RPCs were present
and the HNSW index was correct — and the very first read as `authenticated` failed with

```
42501 permission denied for table documents
```

`public.documents.relacl` was **NULL** in the bench where the real local database reads
`{postgres=arwdDxtm/postgres,anon=…,authenticated=…,service_role=…}`.

⭐ **The failure mode is the dangerous part: the bootstrap reports SUCCESS.** Tables, RLS policies,
functions, indexes and triggers all arrive. Nothing warns. The database is simply unreadable by
the roles the application connects as, and that is only discovered at first query.

## 2. `full-schema.sql:33` is `SET row_security = off;` and it SURVIVES the apply

`pg_dump` emits it so the dump can restore rows regardless of policy. It is a **session** GUC, not
a transaction-local one. **Every later statement issued on the connection that applied the artifact
therefore runs with RLS DISABLED.**

For the documented one-paste Supabase flow this is harmless — the SQL-editor session ends. For any
**program** that applies the artifact and keeps the connection (a bootstrap script, a CI seeding
job, a future automated installer) it means the seeding work that follows silently bypasses every
row-level security policy in the product. That is a security-shaped failure wearing the costume of
a successful bootstrap.

# Why this is NOT being fixed now

⛔ **Deliberate, and stated as a decision rather than an oversight.** On the ONLY bootstrap path
this project documents today — `docs/OPERATOR.md` Step 3, a brand-new **Supabase** project — a real
Supabase project already carries the default privileges, so the paste inherits correct ACLs, and
the paste session ends so the `row_security` leak cannot reach anything. **Nothing is broken for
any user today, and changing the generator to prove a defect nobody can reach would be a change
with no measurable subject.**

Phase 241 fixed both **inside the bench builder** rather than in the artifact:
- it reads the real database's own `pg_default_acl` and installs those defaults BEFORE the apply
  (read back, never invented), plus a build-time guard that reads all four harness tables *as*
  `authenticated`, driven RED against the genuinely ungranted bench before the fix;
- it restores `row_security` explicitly after the apply rather than working around it.

# What a future phase should do when the trigger fires

1. **Decide where the grants belong.** Either drop `--no-privileges` from
   `scripts/regenerate-full-schema.sh` (making the artifact self-sufficient and larger), or add an
   explicit grants section to `scripts/full-schema-supplement.sql`, which already exists precisely
   to carry what the dump misses. ⚠ The supplement is the likelier right home — it is already the
   documented place for cross-schema items the dump cannot express.
2. **Neutralise the session GUC** — append `SET row_security = on;` (or `RESET row_security;`) at
   the END of the artifact, so a program that applies it cannot inherit the disabled state.
3. ⛔ **Drive it RED first.** Create a plain Postgres database, apply the artifact, and assert a
   read as `authenticated` FAILS before the fix and SUCCEEDS after — and that `SHOW row_security`
   reads `on` on the applying connection. `scripts/build-recall-bench.py` already contains a
   working harness for exactly this and should be read before anything is written.
4. **Do not hand-edit `full-schema.sql`.** CLAUDE.md forbids it; the change belongs in the
   generator or the supplement, and the artifact is regenerated.

# The transferable lesson

⭐ **Both defects were found by RUNNING the artifact, never by reading it** — and the artifact had
been regenerated and pasted many times without either surfacing, because every one of those times
was into a Supabase project that happened to supply the missing half. **A bootstrap artifact is
only proven against the environment it has actually been applied to**, and this one had a
silent dependency on its target that nobody had written down.

Related: [[SEED-076]] (the phase that occasioned this), and `docs/DEPLOYMENT-LESSONS.md` **A6** —
the same shape of finding, where a schema-only dump silently omitted seed rows and features ran on
defaults.
