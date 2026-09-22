---
phase: 262-an-expert-you-can-discover
plan: 01
task: 3
measured_on: 2026-09-22
measured_at_commit: 986f92898
database: LOCAL Supabase Postgres (127.0.0.1:54322)
verdict: ALLOWED
remedy_required: false
---

# 262 · The tier precondition, measured

**Why this file exists.** `supabase/migrations/186_tier_capabilities.sql:72` is the **only** row
granting the `experts` capability, and it grants it to `enterprise` alone.
`backend/app/db/entitlements.py:154-157` (`resolve_org_entitlement`) fails **CLOSED** on a NULL
tier — *"Organization has no subscription tier assigned (fail-closed)"*, TIER-05 / D-258-06, with a
fallback to a default tier explicitly rejected. Memory from Phase 258 records that **2 of 2
production orgs had a NULL tier**. If the local UAT org were in that state, the Expert catalog
would HTTP 403 wholesale and the G-4 drive would read as a **build defect** rather than as a
**correct refusal**. That is the one condition that can make a correct build look broken, so it is
measured before anyone drives it.

## How it was measured

⛔ **LOCAL database only.** `backend/venv/Scripts/python.exe` + `asyncpg` against
`127.0.0.1:54322` (the Supabase CLI's local Postgres; the credential is the well-known local dev
default and is deliberately not reproduced here — T-262-01).

⛔ **NOT the Supabase MCP.** That connection points at **PRODUCTION**, and this is a question about
the developer's local box.

⛔ **READ-ONLY.** Three `SELECT`s and two aggregates. **No write statement was executed against any
database by this task.** `git diff --stat` for task 3 shows this planning file only.

⚠ A naive `source venv/Scripts/activate` under Git Bash does **not** activate this venv; the
interpreter was invoked by path.

## The queries, and their raw output

### Q1 — the UAT org

```sql
SELECT o.id::text           AS id,
       o.name               AS name,
       o.slug               AS slug,
       o.subscription_tier  AS subscription_tier,
       o.add_ons::text      AS add_ons,
       (SELECT count(*) FROM public.org_members m WHERE m.org_id = o.id) AS member_count
FROM public.organizations o
ORDER BY o.created_at;
```

⚠ **The table is `public.org_members`, not `public.organization_members`** — the first attempt read
`UndefinedTableError: relation "public.organization_members" does not exist`. Recorded because the
name is easy to assume wrong.

The row for the org the phase's G-4 UAT uses, **verbatim**:

```
{"id": "22f9c615-0eec-440a-8804-ed4784d6f57f", "name": "fhdmrd@gmail.com's Organization", "slug": null, "subscription_tier": "enterprise", "add_ons": "{}", "member_count": "2"}
```

### Q2 — who grants `experts`

```sql
SELECT tier, capability, enabled
FROM public.tier_capabilities
WHERE capability = 'experts'
ORDER BY tier;
```

```
{"tier": "enterprise", "capability": "experts", "enabled": "True"}
```

**Exactly one row, for `enterprise`** — the migration's single grant, confirmed live.

### Q3 — the two members of the UAT org

```sql
SELECT o.id::text AS org_id, u.email, m.role
FROM public.organizations o
JOIN public.org_members m ON m.org_id = o.id
JOIN auth.users u ON u.id = m.user_id
ORDER BY o.created_at, u.email;
```

```
{"org_id": "22f9c615-0eec-440a-8804-ed4784d6f57f", "email": "fhdmrd.dev@gmail.com", "role": "member"}
{"org_id": "22f9c615-0eec-440a-8804-ed4784d6f57f", "email": "fhdmrd@gmail.com", "role": "org-admin"}
```

⭐ The author (`org-admin`) **and** a real non-author (`member`) both exist in this org. The G-4
non-author drive has a live subject; it does not need a fixture.

### Q4 — the tier distribution across the whole local box

```sql
SELECT coalesce(subscription_tier, '<NULL>') AS tier, count(*) AS orgs
FROM public.organizations
GROUP BY 1
ORDER BY 2 DESC;
```

```
{"tier": "enterprise", "orgs": "33"}
```

## VERDICT

> **VERDICT: `experts` is ALLOWED for org `22f9c615-0eec-440a-8804-ed4784d6f57f`.**

`subscription_tier = "enterprise"` · `add_ons = {}` (so no add-on override is in play — the grant
comes from the base tier, the ordinary path) · `tier_capabilities('enterprise', 'experts')` is
`enabled = true`. `resolve_org_entitlement` returns `(True, "enterprise", None, None)` on this data.

**No remedy SQL is required, and none was written or executed.**

## ⚠ Two findings the measurement produced that the plan did not ask for

**1. The REFUSAL path is not drivable on this box at all.** Every one of the **33** local orgs reads
`enterprise` — there is no `standard`, no `pro` and no NULL-tier org anywhere in the local database.
So a green G-4 drive here proves the **allowed** path and says *nothing* about the graceful-refusal
path (the 403 + upgrade-guidance arm, TIER-03). Driving that arm needs a deliberate tier change on a
throwaway org, which is an **OPERATOR** action and dev data, and is out of this plan's scope.

**2. Local and production are opposites, and production is the failing one.** Local: 33/33
`enterprise`. Production (Phase 258, from memory): **2 of 2 orgs NULL**, which `entitlements.py`
fails CLOSED on. ⛔ **A locally-green Expert catalog therefore predicts a wholesale 403 in
production** until the cloud orgs are given a tier. That is a **deploy-parity** item for the next
production push — the same class as the `app_settings` RLS gap that every local gate was blind to —
and it is named here rather than discovered at the push.

⛔ **If the operator later needs a tier set on a cloud org, that is an OPERATOR action pasted into
the cloud Supabase SQL editor after explicit per-action approval (CLAUDE.md § Supabase MCP — writes
are approval-gated). This agent has not written that statement, because writing it here would make
it one copy-paste away from being run against production without the approval it requires.**
