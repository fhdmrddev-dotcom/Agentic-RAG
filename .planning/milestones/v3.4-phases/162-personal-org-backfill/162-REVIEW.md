---
phase: 162-personal-org-backfill
reviewed: 2026-07-18T21:55:26Z
depth: standard
files_reviewed: 3
files_reviewed_list:
  - supabase/migrations/105_personal_org_backfill.sql
  - supabase/migrations/106_org_id_autofill_trigger.sql
  - scripts/full-schema-supplement.sql
findings:
  critical: 0
  warning: 5
  info: 3
  total: 8
status: issues_found
---

# Phase 162: Code Review Report

**Reviewed:** 2026-07-18T21:55:26Z
**Depth:** standard
**Files Reviewed:** 3
**Status:** issues_found

## Summary

Reviewed the Phase 162 (MIG-01) personal-org backfill migration pair plus the greenfield
bootstrap supplement. The core correctness properties hold up under scrutiny and I could
**not** find a BLOCKER:

- **35-table coverage is exact and consistent.** Every table 105 flips `org_id NOT NULL`
  (§C) has a matching 106 autofill trigger, and the resolution strategy matches per table
  (28+1 owner via `user_id`, 2 via `created_by`, 4 owner-less via parent FK). Cross-checked
  against mig 104's org_id sweep (13 pre-existing + 23 swept = 36, minus `operator_audit_log`
  = 35). No flipped table is left without an insert path. This is the property that would
  have been a BLOCKER if broken; it is sound.
- **Injection-safe SECDEF.** The dynamic parent resolver uses `format(... %I ...)` for
  identifiers and a parameterized `$1` for the value, with `search_path=''` and schema-
  qualified refs. All identifiers are migration-authored constants. No injection surface.
- **Parent-FK resolvers are safe against NULL FKs** — `todos.thread_id`,
  `workflow_runs.thread_id`, `workflow_phases.workflow_run_id`, and
  `workspace_file_versions.workspace_file_id` are all `NOT NULL` in the live schema, and
  parents always carry a non-NULL `org_id` post-105, so the child resolver always resolves.
- **`org_members` has `UNIQUE (org_id, user_id)`** (mig 104:96), so the `ON CONFLICT
  (org_id, user_id)` gates in §A and §D are valid.
- **handle_new_user is byte-in-sync** between mig 105 §D and the full-schema supplement §3.

The findings below are latent robustness / defense-in-depth / operational-safety issues that
matter primarily on the **cloud apply** (larger, messier data; live PostgREST; concurrent
writers) rather than the already-verified local apply. The strongest are WR-01 (an
un-REVOKEd arbitrary-SQL procedure, inconsistent with this very phase's 104/106 hygiene) and
WR-02 (table-wide, non-self-restoring trigger-disable windows during a live migration).

No `<structural_findings>` block was provided, so this report is narrative-only.

## Warnings

### WR-01: `_mig105_backfill` is an arbitrary-SQL procedure created in `public` with no `REVOKE EXECUTE ... FROM PUBLIC`

**File:** `supabase/migrations/105_personal_org_backfill.sql:127-143` (and drop at `:620`)
**Issue:** The scaffolding procedure takes `p_sql text` and runs `EXECUTE p_sql USING p_batch`
— an arbitrary-SQL execution primitive. It is created in `public` and, per PostgreSQL
defaults, `EXECUTE` is granted to `PUBLIC` on creation. Both sibling migrations in this exact
phase defensively lock their functions down — mig 104 does
`REVOKE EXECUTE ... FROM PUBLIC/anon/authenticated` on `create_org_with_default_dept`
(104:233-235) and mig 106 does `REVOKE EXECUTE ... FROM PUBLIC` on both trigger functions
(106:146-147) — so the codebase clearly does **not** rely on default-deny. This procedure
omits that step, leaving a transient arbitrary-SQL RPC surface in the exposed schema for the
duration of the apply. It is `SECURITY INVOKER`, so it is not a privilege escalation (callers
run as themselves, still bound by RLS/grants), and it is dropped at `:620` on the happy path —
but on a partial failure (e.g., a §C guard raising, see WR-03) the `DROP` at `:620` is never
reached and the un-REVOKEd primitive **persists**.
**Fix:** REVOKE immediately after creation and make teardown unconditional:
```sql
CREATE OR REPLACE PROCEDURE public._mig105_backfill(p_sql text, p_batch int DEFAULT 10000) ...;
REVOKE EXECUTE ON PROCEDURE public._mig105_backfill(text, int) FROM PUBLIC;
-- ... CALLs ...
DROP PROCEDURE IF EXISTS public._mig105_backfill(text, int);
```
Better still, create the scaffolding in a non-exposed schema (or as a `DO`-block-local
construct) so it is never in PostgREST's reachable surface at all.

### WR-02: DISABLE/ENABLE TRIGGER windows are table-wide and are not restored if the wrapped CALL fails

**File:** `supabase/migrations/105_personal_org_backfill.sql:267-273` (skill_versions) and `:308-314` (workflow_definitions)
**Issue:** Two immutability triggers are surgically disabled around a backfill CALL:
```sql
ALTER TABLE public.skill_versions DISABLE TRIGGER skill_versions_no_update;
CALL public._mig105_backfill($SQL$ ... UPDATE public.skill_versions ... $SQL$);
ALTER TABLE public.skill_versions ENABLE TRIGGER skill_versions_no_update;
```
Two problems:
1. **`ALTER TABLE ... DISABLE TRIGGER` is table-wide (all sessions), not session-local.** For
   the entire duration of the CALL — which spans *multiple* transactions because
   `_mig105_backfill` `COMMIT`s per batch (`:139`) — the immutability guard is off for the
   whole database. On a live cloud apply with the app running, a concurrent user UPDATE to
   `skill_versions` (or an edit to a published `workflow_definitions` row) would silently
   bypass the immutability invariant. The comment notes `session_replication_role='replica'`
   (which *would* be session-local) was ruled out because `postgres` is not superuser — so the
   broader table-wide disable is a conscious fallback, but its blast radius (all sessions,
   across several committed batches) is not called out.
2. **On a mid-CALL failure the `ENABLE` line is never reached**, leaving the immutability
   trigger DISABLED indefinitely. In the autocommit/SQL-editor apply model, an error stops the
   script; the already-committed `DISABLE` is not rolled back. The header claims re-paste
   restores it — true only if the operator re-runs the *whole* file and it succeeds past this
   point. An operator who patches forward instead leaves `skill_versions` mutable /
   published-workflow rows editable with no signal.
**Fix:** (a) Run these two windows inside a scheduled maintenance window / quiesced app, and
(b) add a post-apply assertion that both triggers are `ENABLED` again, e.g.:
```sql
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger
             WHERE tgname IN ('skill_versions_no_update','workflow_definitions_block_published')
               AND tgenabled = 'D') THEN
    RAISE EXCEPTION 'MIG105: an immutability trigger was left DISABLED';
  END IF;
END $$;
```
placed at the very end so a stranded-disabled state fails loudly.

### WR-03: Batch loop exit condition `EXIT WHEN v_rows = 0` can terminate before all resolvable rows are backfilled

**File:** `supabase/migrations/105_personal_org_backfill.sql:134-141`
**Issue:** The batch page-selector re-selects `... WHERE org_id IS NULL LIMIT $1` each
iteration, but a selected row is only *updated* if its owner joins to an `org_members` row (or
a parent with non-NULL `org_id`). The loop exits when a batch updates **0 rows**, conflating
"nothing left to backfill" with "nothing was updated *this* batch." If a table holds
unresolvable rows (NULL owner, an owner whose `auth.users` row was deleted / has no
membership, or a missing/NULL-org parent) and those rows fill an entire `LIMIT $1` window
ahead of still-resolvable rows in heap order, `ROW_COUNT` hits 0 and the loop exits while
resolvable NULLs remain. This did not bite locally (every user got exactly one membership in
§A, and the post-backfill census read 0), but the migration is bound for cloud where orphan /
NULL-owner rows are plausible — notably the `[Assumption A1]` global system field-defs called
out at `:489-491`. The §C zero-NULL guard is a genuine fail-safe backstop (it aborts the flip
loudly rather than shipping bad data), so this is not silent corruption — but the reusable
procedure's exit semantics are incorrect for its stated "backfill until done" purpose and can
produce a confusing mid-migration abort.
**Fix:** Track a monotonic cursor over the target PK so a batch never re-selects the same
un-updatable rows, and exit on "page returned fewer than `p_batch` rows" rather than "0 rows
updated." Alternatively, have the batch selector exclude structurally-unresolvable rows (e.g.,
`AND EXISTS (SELECT 1 FROM org_members pm WHERE pm.user_id = t.user_id)`) so the remaining set
genuinely drains to empty.

### WR-04: NOT-NULL flip (105) ships before the autofill safety net (106) — a window where all app inserts to 35 tables fail, with nothing enforcing the pairing

**File:** `supabase/migrations/105_personal_org_backfill.sql:398-610` vs `supabase/migrations/106_org_id_autofill_trigger.sql` (whole file)
**Issue:** 105 flips `org_id NOT NULL` on 35 tables; the app does not populate `org_id` until
Phase 163; 106 is what keeps inserts working in the interim. So between "105 applied" and "106
applied" every app-style insert (`INSERT INTO threads (user_id, title) ...`, messages,
documents, runs, todos, ...) fails with a not-null violation. These are two separate migration
files with no transactional coupling; the ordering is enforced only by filename numbering and
operator discipline. On the pending cloud apply (099 → ... → 105 → 106), if 106 fails to apply
after 105 succeeds — a typo, a table absent on cloud, a lock timeout — the application is
**down for all inserts** to core tables until 106 lands. 106 itself has no data dependency on
105 (it only needs `org_members` from 104 and the target tables), so the safer construction is
to create the autofill triggers *before* the NOT-NULL flip, eliminating the window entirely.
**Fix:** Merge the 106 trigger creation ahead of the 105 §C flips (create net → backfill →
flip), or, keeping two files, document a hard operator gate: "apply 105 and 106 as one
uninterrupted unit; verify a smoke insert succeeds before considering the deploy complete;"
and stage a rollback (`ALTER COLUMN org_id DROP NOT NULL` on the 35 tables) if 106 cannot be
applied immediately after 105.

### WR-05: `handle_new_user` swallow can silently create an org-less user who then cannot insert into any of the 35 tables

**File:** `supabase/migrations/105_personal_org_backfill.sql:100-110` (mirrored in `scripts/full-schema-supplement.sql:136-146`)
**Issue:** The forward signup trigger wraps personal-org provisioning in
`EXCEPTION WHEN OTHERS THEN RAISE WARNING ...` so an org-creation failure can never abort
signup (the D-03 intent, and correct on its own). But the downstream interaction is
under-appreciated: with 106's regime live, a user who signs up but whose org creation *failed*
has **no `org_members` row**, so `autofill_org_id_by_owner` (106:98-103) resolves no org →
`org_id` stays NULL → the `NOT NULL` constraint rejects **every** insert that user attempts
(threads, messages, documents, ...). The account is a silent zombie — usable only far enough
to fail on first write, discoverable only by scraping a `RAISE WARNING` out of the logs.
Because org creation is a couple of inserts through a SECDEF helper it is unlikely to fail, but
"unlikely" plus "silent" plus "bricks the account" is exactly the failure class worth
surfacing.
**Fix:** Keep the swallow (do not abort signup), but add a reconciliation path so a
transiently org-less user self-heals — e.g., a lightweight idempotent "ensure personal org"
call on login/first-write, or a periodic sweep mirroring §A's `NOT EXISTS (org_members)` gate.
At minimum, monitor/alert on the `handle_new_user: personal-org creation failed` warning so an
operator can repair the account before the user hits write failures.

## Info

### IN-01: `search_path` hygiene is inconsistent across the SECDEF functions in this phase

**File:** `supabase/migrations/105_personal_org_backfill.sql:87` and `scripts/full-schema-supplement.sql:125` vs `supabase/migrations/106_org_id_autofill_trigger.sql:78,115`
**Issue:** `handle_new_user` pins `SET search_path TO 'public'` (matching mig 104's helpers),
while 106's two functions pin the stricter `SET search_path = ''`. 106's header claims its
empty-search_path form "Matches the mig-104 SECDEF hygiene pattern," but mig 104 actually uses
`'public'` — so the comment is slightly inaccurate, and the phase ships two different
conventions. This is not exploitable here (every reference in `handle_new_user` is
schema-qualified and operator/type lookups resolve via the implicitly-first `pg_catalog`; a
fresh signup cannot create objects in `public` on Supabase), so the practical risk is nil.
**Fix:** Standardize on `SET search_path = ''` with fully-qualified references for all SECDEF
functions (the stronger form, already used by 106), and correct the 106 header comment.

### IN-02: `DROP PROCEDURE` lacks `IF EXISTS`, and teardown is not guaranteed on partial failure

**File:** `supabase/migrations/105_personal_org_backfill.sql:620`
**Issue:** `DROP PROCEDURE public._mig105_backfill(text, int);` is not `IF EXISTS`-guarded.
Within a full paste this is safe (§B always `CREATE OR REPLACE`s it first), but if execution
aborts earlier (a §C guard raising) the procedure is left behind — which compounds WR-01
(the un-REVOKEd arbitrary-SQL surface persists). Self-heals on the next successful full
re-paste.
**Fix:** Use `DROP PROCEDURE IF EXISTS public._mig105_backfill(text, int);` and pair it with
the REVOKE from WR-01.

### IN-03: 106 owner-resolver `LIMIT 1` with no `ORDER BY` is arbitrary once a user has >1 membership

**File:** `supabase/migrations/106_org_id_autofill_trigger.sql:98-101`
**Issue:** `SELECT om.org_id ... WHERE om.user_id = v_owner_id LIMIT 1` picks a
non-deterministic membership if a user ever belongs to multiple orgs. This is documented as
safe pre-167 (each user has exactly one membership at 162 time) and 163 is expected to
supersede the net before multi-org invitations land — so it is a correct transitional
assumption, not a current bug. It becomes a latent correctness hazard only if 163 slips past
167. Flagged so the dependency stays visible.
**Fix:** No change needed now. When retiring/superseding this net in 163, ensure explicit
org selection replaces the `LIMIT 1`, and consider a guard that fails closed if a resolver
ever sees `count(*) > 1` memberships while the net is still authoritative.

---

_Reviewed: 2026-07-18T21:55:26Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
