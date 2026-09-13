---
id: BUG-260911-01
title: In PRODUCTION, `app_settings` and `user_settings` have RLS disabled and the `anon` role holds ALL table privileges — anyone with the publishable key can rewrite global app settings, and a destructive SECURITY DEFINER RPC is callable unauthenticated
reported: 2026-09-11
surface: Agentic-RAG
severity: blocking
status: open
affected_areas: [security/rls, backend/settings, supabase/migrations, production-parity]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-266]
re_open_trigger: null
reproduces_on:
  environment: CLOUD / production (Supabase project `esnfauggawekgbvkqkyf`)
  measured_at: 2026-09-11
  method: read-only SQL over the Supabase MCP (OAuth, read-only scopes)
---

# What is true, measured

Found while discharging Phase 242's SC#4 (verify cloud migrations). Every fact below was read from
production with **read-only** queries. **No write was attempted and no exploit was run** — the finding
rests on privilege inspection, which is sufficient and safe.

## 1. Two public tables have RLS disabled and grant everything to `anon`

```
table_name          rls_enabled   table_acl
app_settings        false         {postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres,
                                   authenticated=arwdDxtm/postgres, service_role=arwdDxtm/postgres}
user_settings       false         {postgres=arwdDxtm/postgres, anon=arwdDxtm/postgres,
                                   authenticated=arwdDxtm/postgres, service_role=arwdDxtm/postgres}
```

`arwd` = INSERT, SELECT, UPDATE, DELETE. The `anon` role is the one behind the **publishable key that
ships in the frontend bundle**. `public` is exposed to PostgREST, so these are reachable at
`/rest/v1/app_settings`.

Supabase's own linter flags this as **ERROR** `rls_disabled_in_public` (lint 0013), and it is the only
ERROR-level finding on the project.

⚠ This violates the standing CLAUDE.md rule: *"All tables need Row-Level Security — users only see
their own data."*

## 2. What is NOT exposed — and this is why it is not a credential incident

`app_settings` carries columns for every provider key — `openai_api_key`, `anthropic_api_key`,
`google_api_key`, `openrouter_api_key`, `deepseek_api_key`, `moonshot_api_key`, `minimax_api_key`,
`zhipu_api_key`, `tavily_api_key`, `ollama_api_key`, `embedding_api_key`, `rerank_api_key` — plus
**`supabase_management_token`**.

**All of them are NULL in production.** Checked as booleans only; no secret value was read or printed.
Production takes its credentials from environment variables, so **no key is currently sitting in a
table `anon` can read.**

`user_settings` holds **0 rows**. `app_settings` holds **1 row**.

## 3. What IS exposed — write access to global app settings

The row is empty of secrets but is not empty of consequence. `anon` can `UPDATE` and `DELETE` it, and
it contains, among others: `maintenance_mode`, `sandbox_enabled`, `workflows_enabled`,
`self_improve_enabled`, `feature_visibility`, `llm_provider`, `llm_model`, `llm_model_locked`,
`setup_complete`, `context_window_max_tokens`, `retrieval_top_k`, `hnsw_ef_search`.

An unauthenticated caller could put the install into maintenance mode, disable the sandbox, change the
model every user gets, rewrite the feature-visibility audience map, or delete the settings row. They
could also **write a value into a key column** — which the backend would then read as a configured
credential.

## 4. A destructive `SECURITY DEFINER` RPC is callable by `anon`

```
proname                     anon_can_execute   auth_can_execute
resize_embedding_column     true               true
match_document_chunks       true               true
keyword_search_chunks       true               true
current_user_org_ids        true               true
connection_doc_is_visible   true               true
```

`resize_embedding_column(new_dim integer)` performs DDL on the embedding column. Per
`project_local_embedding_switch_findings`, **changing dimensions deletes every vector in the corpus.**
It is reachable unauthenticated at `/rest/v1/rpc/resize_embedding_column`.

✅ **The retrieval RPCs are SAFE, and this was the highest-severity open question — now closed.**
`match_document_chunks`, `keyword_search_chunks` and `match_skills` are `anon`-executable but do **not**
trust their `match_user_id` argument. Each filters on the session identity, and the source says so in
its own comment:

```
dc.user_id = auth.uid()        --   owner (session-derived, NOT match_user_id)
```

`match_skills` likewise gates on `s.user_id = auth.uid() OR s.is_org_shared = true` inside the org
gate. Under `anon`, `auth.uid()` is NULL, so these return nothing. **There is no cross-tenant read
here** — the v3.4 one-way-RLS-door work holds.

## 5. Two more tables have RLS enabled with NO policies

`operator_audit_log` and `operator_users` — RLS on, zero policies, which denies all non-service-role
access. That is fail-closed and therefore **not** a vulnerability; noted so nobody "fixes" it into one.
The Control Room reaches them through the service role by design (Phase 146: app-layer isolation, no
RLS backstop).

# Why it matters

The blast radius is **configuration and availability** — not stored credentials, and not tenant data.
Both of those were checked rather than assumed: every secret column is NULL, and the retrieval RPCs
authorise on the session identity. **Nothing needs rotating today and no data is readable.** But an unauthenticated write path
to global settings and an unauthenticated destructive DDL RPC are both reachable from the public
internet right now.

# What has NOT been established

- ~~Whether the retrieval RPCs trust their `match_user_id` argument.~~ ✅ **ANSWERED 2026-09-11 —
  they do not.** See §4. Struck rather than deleted: this was the question that would have made the
  finding an incident, and it was checked rather than assumed.
- Whether local dev has the same shape. The verification ran against cloud only.
- When this drifted, and whether it was ever different. `SEED-266` already records that
  `full-schema.sql` carries no table ACLs and leaks `SET row_security = off` — that seed is the
  likeliest origin and should be read alongside this report.

# Suggested routing

**Fold into Phase 242.** It is already the "prove what actually shipped in production" phase, it now
owns the repaired verification script, and this was found by that phase's own work.

⚠ **The fix is a production change and needs explicit operator authorisation** — enabling RLS and
revoking `anon` privileges can break a working surface if any client path depends on them. Sequence:
(1) confirm no app path uses the anon key against these tables, (2) revoke `anon`, (3) enable RLS with
policies, (4) revoke `EXECUTE` on `resize_embedding_column` from `anon`/`authenticated`, (5) re-run the
advisors. Ship as a numbered migration, applied by pasting into the SQL editor per CLAUDE.md.

⭐ **Add the Supabase advisor check to the deploy parity checklist.** This was invisible to every gate
the project runs, and one read-only call surfaced it.

# Evidence

- `mcp__supabase__get_advisors(type: "security")` — `rls_disabled_in_public` ERROR ×2.
- `pg_class.relrowsecurity` + `pg_class.relacl` for the four tables above.
- `has_function_privilege('anon', oid, 'EXECUTE')` for the five functions above.
- Secret columns checked as `is not null` booleans only — no value read, printed or stored.
