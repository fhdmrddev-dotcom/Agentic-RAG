# 268 Production Parity Checklist — Expert spend + mid-thread scope

**Status: CHECKLIST ONLY. NOTHING HAS BEEN APPLIED TO PRODUCTION BY THIS PHASE.** Plan 268-04 made no Supabase
MCP call of any kind, read or write, and pushed nothing to `master` or `production`. Every production WRITE
below needs **explicit per-action operator approval**: state exactly what will run, wait for a clear yes, then
run it. Approval for one write is never approval for the next (CLAUDE.md, "Supabase MCP — reads are free,
WRITES ARE APPROVAL-GATED"; D-268-18).

**Order matters: migration 197 goes in BEFORE the backend deploy.** A backend on 268 code writes
`runs.expert_id` / `runs.expert_attributed` on EVERY chat send (`db/runs.py insert_run`), and every
`/admin/spend` query reads both columns (`db/rates.py _per_root_cte`). Against a database without them, every
chat send and every spend query fails. There is no feature flag in front of either path.

⚠ **Earlier phases are also local-only.** Phases 266 and 267 closed without a production push, so production
may also be missing migrations 195 and 196 (266-PROD-PARITY.md). 197 does not depend on them (it touches only
`public.runs`), but the backend deploy in step D ships 266/267 code too. Run `scripts/pending-cloud-migrations.sh`
and apply every pending migration in number order, 195 → 196 → 197, each on its own approval, before step D.

---

## A. MCP READS first (free, no approval needed)

Record the output beside each query before doing anything else.

1. **Do the columns already exist?** (They should not.)
   ```sql
   SELECT column_name, is_nullable, column_default, data_type
   FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'runs'
     AND column_name IN ('expert_id', 'expert_attributed');
   ```
2. **How many rows will read "Not recorded (before 268)"?** (All of them, by design: no backfill, D-268-06.)
   ```sql
   SELECT count(*) FROM public.runs;
   ```
3. **Which migrations are pending?** `bash scripts/pending-cloud-migrations.sh` (it compares
   `supabase/migrations/` with the cloud history).

## B. Apply migration 197 — ONLY on explicit per-action operator approval, and BEFORE the backend deploy

- File: `supabase/migrations/197_runs_expert_attribution.sql`. Wrapped in `BEGIN/COMMIT`, idempotent
  (`ADD COLUMN IF NOT EXISTS`), no `DO` block, safe to paste twice. `ADD COLUMN … DEFAULT false NOT NULL` is
  metadata-only on PG ≥ 11, so it does not rewrite `runs`.
- Route: Supabase MCP `apply_migration`, or the operator pastes it into the cloud SQL editor. **Never
  `supabase db push` / `db reset`.**
- What it does: adds `runs.expert_id uuid` (NULLABLE, **no foreign key** — D-268-04: a deleted Expert's runs
  must read "Deleted Expert", never "No Expert") and `runs.expert_attributed boolean NOT NULL DEFAULT false`,
  plus two `COMMENT ON COLUMN`. No index, no policy, no GRANT, no `UPDATE`.

## C. Verify (268-01 Task 3's four queries, now against production)

| Query | Expected |
|---|---|
| `SELECT column_name, is_nullable, column_default, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='runs' AND column_name IN ('expert_id','expert_attributed') ORDER BY 1` | `('expert_attributed','NO','false','boolean')`, `('expert_id','YES',NULL,'uuid')` |
| `SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'public.runs'::regclass` | exactly the pre-existing `runs_select_own` / `r` — no new policy |
| `SELECT relrowsecurity FROM pg_class WHERE oid = 'public.runs'::regclass` | `true` |
| `SELECT count(*) FROM pg_constraint WHERE conrelid='public.runs'::regclass AND contype='f' AND conkey @> ARRAY[(SELECT attnum FROM pg_attribute WHERE attrelid='public.runs'::regclass AND attname='expert_id')]` | `0` (no FK on `expert_id`) |
| `SELECT expert_attributed, count(*) FROM public.runs GROUP BY 1` | one row: `false`, = step A.2's count |

## D. Security advisors — `get_advisors(security)` (a READ, no approval needed)

Run the Supabase MCP `get_advisors` with type `security` after step B and compare with the last recorded run.
268 adds no table, function, policy or grant, so **no new finding is expected**; any new one is a stop. This is
the deploy-parity item BUG-260911-01 added (RLS disabled on two settings tables stayed green through every
service-role gate).

## E. Backend + frontend deploy — operator "deploy" instruction only

- Backend (Coolify) and frontend (Vercel) both build from `production`. Promote surgically per
  `docs/DEPLOYMENT-WORKFLOW.md`; never push to `master`/`production` without the operator's explicit "deploy".
- **No env var was added or changed by 268, and no seed-bearing migration was added** (197 inserts no rows), so
  `deploy/onebox.env.example`, `docs/OPERATOR.md` Step 3 and `docker-compose.prod.yml` need no change, and the
  sandbox image tag is unchanged. `scripts/check-deploy-drift.sh` has nothing new to register.

## F. Post-deploy probe (the "new backend is up" signal)

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://<backend-host>/threads/00000000-0000-0000-0000-000000000000/scope-effect
```
Unauthenticated → **401 or 403** means the 268 route is served. **404** means the old backend is still running
(the route did not exist before 268-03).

Then, signed in as an operator: open `/admin/spend` → the Spend by Expert card renders with a `No Expert` line
and a `Not recorded (before 268)` line holding every pre-deploy run; the reconciliation footer reads ✓.

## G. What this checklist deliberately does not do

- It applies nothing. It records the order, the verification and the gate.
- It does not backfill `expert_id` (D-268-06 — the thread's current Expert is no evidence of the Expert at
  the time).
- ⚠ Expect `/admin/spend` org totals to RISE after the deploy for orgs whose runs spawned sub-agents: 268 counts
  sub-agent tokens and spend that 257 excluded (D-268-09). This is disclosed on the Blind Spots card ("Sub-agent
  tokens now counted"); it is not a pricing change.
