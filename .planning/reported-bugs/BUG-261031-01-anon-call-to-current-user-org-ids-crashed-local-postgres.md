---
id: BUG-261031-01
title: A role-anon call to current_user_org_ids() crashed the local Postgres backend into recovery mode (twice) instead of "permission denied"
reported: 2026-10-31
surface: Agentic-RAG
severity: major
status: deferred
affected_areas: [database/postgres, security/availability, database/rls]
folded_into: null
verified_closed_by: null
related_seeds: []
re_open_trigger: "The operator reproduces it on a disposable Postgres 17.6 (STATE Owed), OR any path is found that runs current_user_org_ids() as anon. Phase 305 (discuss 2026-10-31) assigns it a threat id and D-10: the MCP path never runs member-scoped SQL as anon."
reproduces_on:
  branch: develop
  commit: ce2343d2e
  date: 2026-10-31
---

# BUG-261031-01: anon call to current_user_org_ids() crashed local Postgres

## What we observed

Found by the Phase 304-01 executor on the shared local stack, Postgres 17.6. Full write-up: `.planning/phases/304-personal-mcp-keys-that-act-as-you/deferred-items.md` § F-1.

On a postgres-role asyncpg connection:

```sql
BEGIN; SET LOCAL ROLE anon; SELECT public.current_user_org_ids();
```

This did not return `permission denied for function` (anon holds no EXECUTE since mig 181). Twice:

- the connection dropped with `ConnectionDoesNotExistError`;
- new connections got `CannotConnectNowError: the database system is in recovery mode`, meaning a backend crash and cluster crash-recovery.

The cluster recovered in seconds with data intact. The statement just before, on the same connection, was `SET LOCAL ROLE anon; SELECT ... FROM api_keys`. It raised a normal `InsufficientPrivilegeError`.

## Not established

- Whether this predates migration 221. 221 changes only the function body, and EXECUTE is checked before the body runs, which points at the permission-denied path or an extension hook. That is reasoning, not a measurement.
- Whether it reproduces through PostgREST: `POST /rest/v1/rpc/current_user_org_ids` with the anon key.

## Production evidence (read-only, 2026-10-31)

- `has_function_privilege('anon', 'public.current_user_org_ids()', 'EXECUTE') = false`.
- `server_version = 17.6`, the same major and minor as local.
- Postgres logs for the last 24 h show no `terminated by signal`, `recovery mode` or `all server processes terminated` lines.

So there is no evidence it has fired in production. It has not been driven there, and it must not be driven against production.

## Why it matters

If the anon REST path reproduces it, an unauthenticated caller can crash-loop the production database. That is an availability hole that needs no account.

## Next step (operator)

1. Reproduce on a **disposable** Postgres 17.6 (not the shared local stack, never production), on the pre-221 body and then on 221.
2. Capture the server log for the crashing statement (`docker logs <db container>`).
3. Try the same call through a disposable PostgREST as `anon`.
4. If it reproduces on stock 17.6, check for an upstream fix or a Supabase extension (e.g. a hook on permission errors) as the cause.

## What Phase 304 did instead

The anon EXECUTE arm is pinned by catalog (`has_function_privilege`) in `test_304_acting_org_rls_live.py::test_privileges` and in `scripts/check-migration-221-live.py`. The role-level anon call is not made, and a comment there says why.

## Surface classification

`Agentic-RAG`: this app's database. It may turn out to be upstream (Postgres or Supabase image), in which case it is re-classified once reproduced.
