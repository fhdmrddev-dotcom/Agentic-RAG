---
seed_id: SEED-266
title: full-schema.sql carries no table ACLs and leaks `SET row_security = off` — benign for a Supabase paste, a live trap for a plain-Postgres bootstrap or any program that applies it
created: 2026-09-10
planted_during: Phase 241 (QUEUE-06), plan 241-04 — found by RUNNING the artifact, not by reading it
status: partially-answered
partial: true
status_note: |
  ── 2026-09-16 · ROUTED at `/gsd:discuss-phase 252` (REG-02 sweep). Status moved
  `planted` -> `partially-answered`, `partial: true`, because exactly ONE of this seed's two
  measured defects is answered and the other is untouched.

  ⭐ ANSWERED — the missing-ACL half, for FUNCTIONS only. Phase 252 Plan 01 (SC#1, `CRED-03`/
  `CRED-04`) adds section 6 to `scripts/full-schema-supplement.sql`, mirroring migration 181's
  31 REVOKEs and 17 GRANTs over 13 SECURITY DEFINER functions into the bootstrap artifact, and
  ships `scripts/check-schema-acl-parity.cjs` — a gate that FAILS when a migration grants or
  revokes EXECUTE on a function the supplement does not mirror, driven RED against a planted
  omission and against the counterfactual.

  ⛔ STILL OPEN, and deliberately so:
  (a) TABLE and COLUMN privileges. §6 covers function EXECUTE only. §5's mig-118 column grant is
      still the sole table-level mirror, and it is still maintained by hand — this seed's arm 1 in
      its original width.
  (b) `SET row_security = off`. Byte-unchanged by 252; the leak this seed measured on a plain
      Postgres connection is exactly as it was.
  (c) `--no-privileges` itself (arm 3). NOT revisited, and the reason is recorded in
      `252-01-PLAN.md`: dropping it would make a dump carry the local dev box's entire ACL state,
      including roles that exist nowhere else — a larger and less reviewable artifact than the 31
      lines actually owed.

  ⚠ The trigger fired on `**/full-schema.sql` and this phase DID edit that file — by the one
  sanctioned exception to *never hand-edit full-schema.sql*: `regenerate-full-schema.sh` cannot
  run (Docker is denied in this environment), 181 changes no schema object, and the supplement was
  MEASURED to be the artifact's byte-identical 259-line tail, so applying the identical edit to both
  reproduces what the script would emit. The equivalence `diff` is the plan's required proof.

  ⛔ Arms (1), (2) and (4) — a non-Supabase deployment target, a program continuing on the same
  connection, and `docs/OPERATOR.md` Step 3 — are UNCHANGED and remain the live re-open trigger.
  `BUG-260911-01` still lists this seed in `related_seeds`.

  ── 2026-09-16 · ROUTED again at `/gsd:discuss-phase 253` (REG-02 sweep, run by hand — see below).
  Status STAYS `partially-answered`; `folded_into` stays `null`, because only one more arm moves.

  ⭐ ARM (a) — TABLE and COLUMN privileges — IS FOLDED INTO PHASE 253. It is that phase's SC#1
  + SC#2 verbatim. 253 mirrors ALL SEVEN ACL-bearing tables into the supplement and into
  `full-schema.sql`'s tail in the same commit, and extends `scripts/check-schema-acl-parity.cjs`
  to compare table/column tuples so the §6 header's "table OR function" claim becomes true.
  ⚠ MEASURED at 253's scoping, and WIDER than `252-REVIEW.md` CR-01 states: only 7 tables carry
  table/column ACLs across every migration (25 statements), and SIX of the seven — `connector_tokens`,
  `connector_watches`, `connector_watch_items`, `connector_sync_runs`, `user_settings`, `app_settings`
  — are mirrored in NEITHER artifact. The last two are the exact tables `BUG-260911-01` found in
  production with RLS disabled and `anon` holding all privileges.

  ⛔ ARMS (b) and (c) ARE UNTOUCHED AND STAY OPEN. `SET row_security = off` is byte-unchanged by
  253, and `--no-privileges` is not revisited — the reason recorded in `252-01-PLAN.md` still holds.
  Splitting them into a new seed id was considered at 253's discuss and REJECTED: two legible arms
  do not warrant a second register entry.

  ⚠ AND THIS SEED'S OWN TRIGGER ARM (1) NOW HAS A NEW INSTANCE, recorded rather than silently
  absorbed: Phase 253 ships `scripts/check-greenfield-privileges.py`, which builds a greenfield DB
  with `CREATE DATABASE` on a plain connection and applies the artifact to it. That is arm (1)'s
  wording exactly — but it is a TEST harness, not a supported deployment target, so arm (1) stays
  live for its original meaning. The harness is, however, the first thing in this repo that would
  MEASURE arm (b)'s `SET row_security = off` leak on demand.
folded_into: null
priority: medium
surface: Agentic-RAG
severity: major            # Not currently reachable on the documented deploy path. It becomes a security-shaped defect the moment a non-Supabase target exists.
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
