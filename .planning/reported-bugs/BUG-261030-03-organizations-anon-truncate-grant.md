---
id: BUG-261030-03
title: anon and authenticated hold table-level DELETE / TRUNCATE / TRIGGER / REFERENCES on public.organizations
reported: 2026-10-30
surface: Agentic-RAG
severity: major
status: folded
affected_areas: [database/rls, security/grants, org/organizations]
folded_into: "304"
verified_closed_by: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 0037c51aa
  date: 2026-10-30
---

# BUG-261030-03: anon holds TRUNCATE on organizations

## What we observed

Found by the Phase 304 researcher on local, then confirmed on PRODUCTION with a read-only query (Supabase MCP, 2026-10-30):

```sql
select has_table_privilege('anon', 'public.organizations', 'TRUNCATE');  -- true
```

Production grants on `public.organizations`:

| Privilege | anon | authenticated |
|---|---|---|
| SELECT | yes | yes |
| INSERT | no | no |
| UPDATE | no | no |
| DELETE | **yes** | **yes** |
| TRUNCATE | **yes** | **yes** |
| TRIGGER | **yes** | **yes** |
| REFERENCES | **yes** | **yes** |

Migration 194 revoked INSERT and UPDATE only.

## Why it matters

`TRUNCATE` is not subject to RLS. No known path reaches it: PostgREST does not expose TRUNCATE, DELETE through PostgREST is still RLS-filtered, and `query_user_documents` refuses non-SELECT statements. So this is a defense-in-depth gap, the same class as BUG-260911-01 (grants that every service-role gate cannot see). One new SQL surface that executes as `anon` or `authenticated` would make it a full org-table wipe.

## Hypothesized cause

Supabase's default `GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated`, narrowed by mig 194 for INSERT/UPDATE only.

## Fix (folded into Phase 304)

Phase 304's migration 221 already alters `public.organizations` (it adds `mcp_enabled`). It will also run `REVOKE DELETE, TRUNCATE, TRIGGER, REFERENCES ON public.organizations FROM anon, authenticated` (and from `PUBLIC`), with a live verify and an anon-role test. Re-check `get_advisors(security)` after the cloud paste.

## Surface classification

`Agentic-RAG`: this app's schema.
