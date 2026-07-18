# Pitfalls Research

**Domain:** Org multi-tenancy + membership-based RLS rewrite + SSO retrofit onto an existing single-tenant, per-user RAG platform (Agentic RAG v3.4)
**Researched:** 2026-07-18
**Confidence:** HIGH on the codebase-specific traps (verified against live `supabase/full-schema.sql`, `backend/app/dependencies.py`, `backend/app/services/sql_service.py`, mig 096); HIGH on the SSO CVE class (verified external); MEDIUM on supabase-py per-request-JWT ergonomics (verified pattern, un-benchmarked here).

> **Phase routing note.** The v3.4 roadmap is not numbered yet (milestone is research-first; phases continue from 159, so ~160+). Pitfalls route to **phase ROLES** aligned to the stale PRD's §12 outline; the roadmapper assigns real numbers. The stale PRD's migration numbers (075–094) and phase numbers (088–100) are **obsolete** — live migration head is 103; org_id stubs already shipped in mig 095/096. Use the roles below, not the PRD's numbers.
>
> | Role tag | What it owns |
> |---|---|
> | **P0-ADR** | Tenancy-model ADR (ratify D-PRD-02 hybrid; does not re-litigate) |
> | **P1-SCHEMA** | orgs / departments / roles / role_permissions / org_members / dept_members / org_invitations / sso_configs + RLS-from-day-1 |
> | **P2-BACKFILL** | Personal-org backfill migration + `is_global`→`is_org_shared` rename + NOT-NULL flip |
> | **P3-RLS+CLIENT** | Membership RLS predicate rewrite on every user-facing table **+ the per-request user-JWT client swap, atomic in one branch** |
> | **P4-SECDEF** | SECURITY DEFINER retrieval audit (all 4 fns) + `query_user_documents` / regex removal |
> | **P5-SSO** | SAML + OIDC + JIT provisioning + invitation accept |
> | **P6-ORGUI** | Org-admin / dept-admin shells + `<OrgContext>` + org switcher |
> | **P7-INVITE-AUDIT** | Invitations + org-scoped audit view |
> | **P8-ISOLATION** | Two-org isolation test suite + full regression sweep |

---

## Critical Pitfalls

### Pitfall 1: The service-role singleton silently bypasses the new RLS — RLS is worthless until the client swap lands WITH the rewrite

**What goes wrong:**
The team writes beautiful membership-based RLS policies on all ~20 tables, ships them, and **nothing is actually enforced**, because every hot-path query still runs through the service-role Supabase singleton (`get_supabase()`, `backend/app/dependencies.py:21-25`). The service-role key bypasses RLS unconditionally — Supabase confirms: *"A Supabase client with the Authorization header set to the service role API key will ALWAYS bypass RLS."* The real tenant boundary today is the ~40+ hand-written `.eq("user_id", current_user["id"])` filters, not RLS. If the RLS predicates ship but the client is still service-role, you have written policies the database never evaluates. A route that forgets its `.eq` filter leaks **every org's data**, and the test suite (which seeds one org) stays green.

**Why it happens:**
The RLS rewrite naturally splits into "SQL migrations" (write policies) and "backend refactor" (swap the client). It's tempting to land the migrations first ("the policies are the hard part") and swap the client "in a follow-up." That ordering produces false safety: the policies exist, so isolation *looks* done, but the enforcement path is still bypassed. The stale PRD even lists this as RLS-REWRITE-03 as if it were *separate* from RLS-REWRITE-01 — it must not be sequenced separately.

**How to avoid:**
- **Ship the per-request user-JWT client swap in the SAME atomic branch as the predicate rewrite** (PRD Q-v3.2-08 says "atomic"; extend it — atomic includes the client swap, not just the SQL). A membership policy has zero value until the invoker is a user identity.
- Use the **verified supabase-py pattern**: do NOT construct a fresh `create_client()` per request (connection fanout — Pitfall 4/perf). Reuse one client and **override the `Authorization` header / call `postgrest.auth(jwt)` per request** with the caller's JWT, cached at process level via FastAPI DI.
- Keep the service-role client **only** for explicit cross-tenant ops (SSO JIT provisioning, operator/audit writes) behind a wrapper that **requires an explicit `org_id` argument** and refuses to construct without it.
- Leave the `.eq("user_id", ...)` filters in place as **belt-and-suspenders** — do NOT delete them in the same pass (Pitfall 8).

**Warning signs:**
Grep shows `get_supabase` still injected on any `/threads`, `/documents`, `/runs`, `/kb`, `/skills`, retrieval, or SQL-tool endpoint after the RLS branch; the isolation test seeds only one org; "RLS is done" claimed while `dependencies.py:21-25` is unchanged; an endpoint reads data correctly with a JWT whose `sub` ≠ row owner.

**Phase to address:** **P3-RLS+CLIENT** (atomic — this IS the phase; do not let it split into "policies now, client later").

---

### Pitfall 2: The SECURITY DEFINER retrieval surface is FOUR functions, not one — the stale PRD names only `match_document_chunks`

**What goes wrong:**
The plan rewrites `match_document_chunks` to add an org filter, declares the retrieval bypass closed, and ships. But hybrid search has **two legs** and skills have their own retrieval fn — all `SECURITY DEFINER`, all keyed on a **caller-supplied `match_user_id`**, all added at different times:

| Function | file:line | Body gate | `search_path` pinned? | In stale PRD? |
|---|---|---|---|---|
| `match_document_chunks` | full-schema.sql:163 | `WHERE dc.user_id = match_user_id` | **NO** | yes |
| `keyword_search_chunks` (BM25/tsquery leg of RRF) | full-schema.sql:136 | `WHERE dc.user_id = match_user_id` | **NO** | **NO** |
| `match_skills` (Phase 140, mig 073) | full-schema.sql:188 | `WHERE (s.user_id = match_user_id OR s.is_global = true)` | yes | **NO** |
| `folder_is_globally_visible` | full-schema.sql:97 | recursive `is_global` ancestor walk (no user check at all) | yes | yes (as `folder_is_org_shared`) |

Fix only `match_document_chunks` and **keyword search still returns cross-org chunks**, and **`match_skills` still leaks the skill catalog cross-org**. Because these run `SECURITY DEFINER`, RLS on `document_chunks`/`skills` does NOT save you — the function executes with owner privilege and the *only* gate is its inlined WHERE clause. `match_skills`'s own comment (full-schema.sql:212) says it verbatim: *"as a SECURITY DEFINER body it is the ONLY cross-user gate (T-140-01) — never widen it."*

**Why it happens:**
The PRD was authored 2026-05-10; `keyword_search_chunks` and `match_skills` postdate it (Phase 140 embeddings/skill-retrieval work). Anyone planning from the PRD inherits its blind spot. Retrieval "feels like one function" but is a fan-out.

**How to avoid:**
- Audit **every** `SECURITY DEFINER` function in `full-schema.sql`, not the PRD's list. The retrieval-relevant set is the four above; also present: `resize_embedding_column`, `handle_new_user`, and the skill/embedding triggers (`capture_skill_version`, `stale_skill_embedding*`) — triggers are lower-risk but review each for org-column handling.
- For each retrieval fn, add the org predicate **inside the body** (derive `org_id` from the membership of `match_user_id`, or add `org_id` to the chunk/skill row and filter it) AND, where feasible, flip to `SECURITY INVOKER` so table RLS becomes defense-in-depth — but only once the caller is a user-JWT client (Pitfall 1).
- **Pin `search_path`** on `match_document_chunks` and `keyword_search_chunks` in the same change (both lack it — a DEFINER function without a pinned `search_path` is a privilege-escalation vector via search-path hijack).
- Rewrite `match_skills`'s `is_global = true` clause to the org-shared / system-global model — this is exactly where a careless "widen" reopens cross-org skill sharing (an explicit anti-feature).

**Warning signs:**
A retrieval isolation test asserts only against vector search, never keyword or skills; `grep -c "SECURITY DEFINER" full-schema.sql` exceeds the number of functions the plan touches; `is_global` still appears in a DEFINER body after the `is_org_shared` migration.

**Phase to address:** **P4-SECDEF** (all four fns in one audit; coordinate the chunk-org-column dependency with P3).

---

### Pitfall 3: `query_user_documents` is ALREADY `SECURITY INVOKER` — the leak is the service-role CALLER + a regex string-rewriter, not the function

**What goes wrong:**
The stale PRD says "rewrite `query_user_documents` SECURITY DEFINER → INVOKER." **It is already INVOKER** (full-schema.sql:219 has no `SECURITY` clause = INVOKER default; mig 012 set it explicitly). Planning the wrong fix wastes a phase and misses the real problem: the text-to-SQL RPC is called through the **service-role client** (`sql_service.py:113`), so INVOKER buys nothing, and the *actual* tenant scoping is a **regex that rewrites the model's SQL string** (`_inject_user_id`, `sql_service.py:31-68`). That regex:
- injects `user_id = '{uuid}'` via **f-string interpolation** into arbitrary model-generated SQL;
- detects table aliases with a hand-maintained keyword skip-list (`sql_service.py:23-25`);
- injects the predicate by replacing only the **first** `\bwhere\b` (`re.sub(..., count=1)`) — a CTE, a subquery, or a second `WHERE` is left **unscoped**;
- has **zero org awareness** — it scopes `user_id` only.

A model that emits `SELECT ... FROM documents WHERE id IN (SELECT id FROM documents ...)` gets the outer query scoped and the inner subquery reading unscoped. Under multi-tenancy that is now a **cross-org** leak. (The code's own comments admit the setup: sql_service.py:34 "The service role client bypasses RLS, so we must scope manually.")

**Why it happens:**
The PRD's factual error ("it's DEFINER") sends planning down the wrong road, and regex-rewriting of LLM-generated SQL feels like a guard but is a fundamentally leaky abstraction.

**How to avoid:**
- Correct the record in the roadmap: the fix is **(a) call the RPC with the user-JWT client** (so the already-INVOKER function's RLS actually applies) and **(b) delete `_inject_user_id` / `_inject_folder_scope`** rather than extend them to org. Do NOT "add org_id to the regex" — that doubles the fragility.
- If a user-JWT path isn't viable for the tool-dispatch caller in one step, the interim guard must scope org **and** user inside the DB function body (parameterized), never in Python string rewriting.
- Add a regression test replaying subquery/CTE payloads that defeat first-`WHERE` injection, asserting zero cross-org rows.

**Warning signs:**
A plan task says "change `query_user_documents` to SECURITY INVOKER" (already there — smell of planning-from-stale-PRD); `_inject_user_id` gains an `org_id` parameter instead of being deleted; the text-to-SQL tool still receives a service-role `Client`.

**Phase to address:** **P4-SECDEF** (correct the PRD; delete the regex; move the caller to user-JWT).

---

### Pitfall 4: The dual data-access story — the asyncpg pool bypasses RLS entirely, no JWT swap can fix it

**What goes wrong:**
This codebase has **two** DB access mechanisms, and "per-request user-JWT client" only works for one:
1. **supabase-py / PostgREST** (`get_supabase`) — RLS-via-JWT works by swapping the `Authorization` header.
2. **raw asyncpg pool** (`get_pg_pool`, `dependencies.py:79-105`, added Phase 073) — connects as the **DSN's Postgres role** directly. `auth.uid()` is NULL on this path; **RLS policies keyed on `auth.uid()` never match, so they either block everything or (if the role owns the tables / has BYPASSRLS) bypass everything.** There is no "user-JWT client" for asyncpg — you must `SET LOCAL role authenticated` + `SET LOCAL request.jwt.claims = '{"sub":"<uuid>",...}'` inside each transaction for `auth.uid()` to resolve.

If the plan treats "swap to user-JWT client" as one uniform change, every query flowing through the asyncpg pool (the JSONB-heavy run/message/tool_call paths that `_init_pg_connection` exists for) silently keeps today's behavior — which for a privileged DSN role is **full bypass**, org isolation absent.

**Why it happens:**
The stale PRD predates Phase 073's asyncpg pool, so it models a single client. The two paths conflate easily because both "talk to Postgres."

**How to avoid:**
- Inventory which hot paths use supabase-py vs asyncpg (`get_pg_pool` callers). Decide per path: PostgREST paths get the JWT header swap; asyncpg paths get **`SET LOCAL` role + `request.jwt.claims` per transaction**, OR stay an explicit trusted service-role path with **mandatory in-query `org_id` + `user_id` predicates** (documented as such, guarded by CI).
- Verify the DSN role's privileges: if asyncpg connects as a table owner / superuser, RLS is bypassed regardless. A non-owner `authenticated`-like role is required for RLS to bind.
- Keep this compatible with **D-v2.5-01** (no blocking I/O in async handlers) and the `WORKER_COUNT=2` singleton discipline — the pool is a singleton bound to the event loop.

**Warning signs:**
A query through `get_pg_pool()` returns rows for a user whose JWT was never set on the connection; no `SET LOCAL request.jwt.claims` anywhere yet asyncpg paths "respect RLS"; isolation tests only exercise PostgREST endpoints.

**Phase to address:** **P3-RLS+CLIENT** (both mechanisms audited together; asyncpg path is a distinct sub-task).

---

### Pitfall 5: Recursive RLS on `org_members` — infinite recursion (42P17), and the SECURITY DEFINER helper that fixes it

**What goes wrong:**
The natural membership predicate is `org_id IN (SELECT org_id FROM org_members WHERE user_id = auth.uid())`. Put a policy of that shape **on `org_members` itself** and Postgres recurses: to check whether you may read an `org_members` row it must query `org_members`, which fires the same policy, which queries `org_members`… → `ERROR: infinite recursion detected in policy for relation "org_members"` (SQLSTATE 42P17). Every membership check across the app then fails closed — the whole product 500s on the first authenticated query.

**Why it happens:**
The same predicate is copy-pasted onto every table, including the membership table it depends on. It works on the leaf tables and blows up only on the self-referential one, so it can pass a quick smoke and fail under real evaluation.

**How to avoid:**
- Resolve a user's org set through a **`SECURITY DEFINER` helper function with a pinned `search_path`** — e.g. `auth_user_org_ids() RETURNS uuid[]` reading `org_members` with owner privilege (no policy recursion) — and reference that helper in every *other* table's policy instead of sub-selecting `org_members`.
- `org_members`'s own policy must be **non-recursive**: gate it directly on `user_id = auth.uid()` (you can always see your own membership rows), plus an org-admin branch that also goes through a DEFINER helper, never a self-select.
- This helper doubles as the **performance** fix (Pitfall 6) — resolve the org set once per statement instead of re-joining `org_members` per row.

**Warning signs:**
42P17 the moment the `org_members` policy is enabled; a policy body that references its own table; login / first authenticated query 500s after the membership migration.

**Phase to address:** **P1-SCHEMA** (ship the DEFINER helper + non-recursive `org_members` policy in the same migration as the table).

---

### Pitfall 6: Per-row membership-join RLS collapses retrieval perf — and mig 096 deliberately shipped NO `org_id` index

**What goes wrong:**
A membership-join predicate evaluated **per row** turns every large scan into a nested membership lookup. On `document_chunks` (the pgvector hot path) a retrieval touching 100k candidate chunks evaluates the org predicate 100k times. Two codebase facts make this worse than generic:
1. **mig 096 explicitly added NO index on `org_id`** ("Deliberately does NOT add idx_*_org_id indexes … follows the leaner harness_audit shape") — an org predicate hits a **sequential scan** until indexes are added.
2. **`document_chunks` has no `org_id` column at all** — mig 096 stubbed only documents / folders / threads / skills (the 4 owned roots); "child tables (messages, chunks, skill_files …) inherit org through their parent FK — NOT stubbed." Scoping chunks means either adding+backfilling+indexing `org_id` on `document_chunks`, or an extra `JOIN documents` per row on the hottest query.

Symptom: retrieval latency regresses (PRD flags ~20%; realistically worse with no index), the CONCUR-01 binding gate wobbles, p95 balloons under parallel runs.

**Why it happens:**
"Add `org_id` everywhere and filter on it" reads as trivial; the missing index, the missing column on child tables, and the pgvector interaction are invisible until measured.

**How to avoid:**
- Add `org_id` to the child/secondary tables the rewrite actually scopes (start: `document_chunks`, `document_images`, `document_tables`, `messages`, `skill_files`, `runs`, plus the memory/eval/tuner tables mig 096 "deferred to the v3.4 planner"). Backfill from the parent, then index.
- Add a **partial/composite index** aligned to the query: `document_chunks(org_id)` (or `(org_id, user_id)`) alongside the existing HNSW vector index so the org filter pre-narrows before the vector distance sort.
- Prefer resolving `org_id` from a **JWT custom claim or the per-statement DEFINER helper** (Pitfall 5) so RLS compares against a constant array, not a correlated sub-select per row.
- **Benchmark before merge** against CONCUR-01 (`test_058_concurrency.py`) — the gate proves the cross-tab GET stays <1s while a stream is in flight; the RLS join must not push it over.

**Warning signs:**
`EXPLAIN` shows a seq scan on `document_chunks` / a per-row `org_members` sub-plan; retrieval p95 climbs after the rewrite; the migration adds `org_id` columns but no `CREATE INDEX`.

**Phase to address:** **P3-RLS+CLIENT** (columns + indexes with the predicate); **P8-ISOLATION** (perf gate verification).

---

### Pitfall 7: Personal-org backfill — lock storms, `is_global`→`is_org_shared` data loss, non-idempotent re-runs, and the NOT-NULL flip ordering

**What goes wrong:**
The one-shot "every user gets a personal org, backfill `org_id` everywhere, then `SET NOT NULL`" migration is where a multi-tenancy launch most often corrupts or locks production:
- **Lock storms:** a single `UPDATE documents SET org_id = ... WHERE org_id IS NULL` over a large table takes a long write lock and stalls the app during deploy.
- **NOT-NULL flip ordering:** `ALTER TABLE … SET NOT NULL` before the backfill completes (or before a straggler row written mid-migration is scoped) fails the migration or blocks new writes.
- **`is_global` → `is_org_shared` mishandled = silent loss of sharing:** if the column is dropped/recreated instead of `RENAME`d, or the rename isn't value-preserving, every previously-global folder/skill silently becomes private (users "lose" shared docs) — or the seeded `skill-creator` (mig 018) loses cross-org visibility and every user's skill catalog breaks.
- **Non-idempotent re-runs:** re-running the migration (a normal recovery action) creates a *second* personal org per user or duplicate `org_members` rows.
- **Workflow constraint (CLAUDE.md):** migrations here are applied by **pasting into the Supabase SQL editor** (never `db push`/`db reset`) against a live dev DB holding real data — a destructive or non-idempotent backfill can't be casually re-run from clean.

**Why it happens:**
Backfills are written against a tiny dev dataset where locks and idempotency never bite, then meet a real table.

**How to avoid:**
- **Batch** the backfill (e.g. 10k rows per `UPDATE` in a loop, `WHERE org_id IS NULL`) to keep lock windows short; run in a low-traffic window.
- **Idempotent by construction:** `INSERT … ON CONFLICT (org_id, user_id) DO NOTHING` for memberships; gate personal-org creation on "user has no personal org yet"; every `UPDATE` filtered `WHERE org_id IS NULL`. Model it on the Phase 146 `OPERATOR_EMAILS` startup seed (idempotent, WORKER_COUNT=2-safe).
- **Order:** add nullable `org_id` → backfill in batches → verify zero NULLs → **then** `SET NOT NULL`. Never flip NOT-NULL first.
- **`is_global` → `is_org_shared` is a value-preserving `RENAME COLUMN`** (or add-new + copy + verify + drop-old), plus an explicit `is_system_global` allow-list migration that re-flags the seeded `skill-creator`. Add a fixture test asserting a pre-migration global folder/skill is still shared post-migration.
- **Stage on a copy of prod**, measure the window, and keep the personal-org auto-create hooked so **new** SSO/JIT users also get an org (coordinate with the `handle_new_user` DEFINER trigger, full-schema.sql:120 — today it only inserts a `profiles` row).
- Re-run **`scripts/regenerate-full-schema.sh`** after applying (CLAUDE.md).

**Warning signs:**
A bare `UPDATE … SET org_id` with no batching / no `WHERE org_id IS NULL`; `SET NOT NULL` before the backfill statements; `is_global` handled with `DROP`/`ADD COLUMN` instead of `RENAME`; re-running doubles `orgs`/`org_members` rows; new post-deploy users have no org.

**Phase to address:** **P2-BACKFILL** (owns the backfill, the rename, the NOT-NULL flip; ships the `handle_new_user` / JIT auto-org hook or hands it to P5-SSO).

---

### Pitfall 8: A route forgets the org predicate — belt-and-suspenders vs sole-defense inversion

**What goes wrong:**
Today the `.eq("user_id", ...)` filters are the **sole** boundary (service-role bypasses RLS). After P3, RLS becomes primary and the `.eq` filters become **belt-and-suspenders**. The trap is the transition window plus the temptation to "clean up now-redundant filters." If a developer deletes the `.eq` filters in the same pass that swaps the client — and one endpoint slips back to a service-role client (or the asyncpg path, Pitfall 4) — that endpoint has **neither** defense and leaks cross-org.

**Why it happens:**
The 40+ `.eq("user_id", ...)` callsites in `threads.py` alone (the ~1850-LOC `send_message` god function) look like dead weight once RLS exists; removing them feels like hygiene. But they're the fallback for exactly the case where the client swap regresses.

**How to avoid:**
- **Do not delete the `user_id` filters in the tenancy milestone.** Keep them — they cost nothing and are the second layer. (The stale PRD §6 agrees: "every existing filter is now belt-and-suspenders … NOT the primary boundary.") Route `delete_folder`/`move_document` defense-in-depth cleanup to a *later* code-quality pass.
- Add an **`org_id` predicate alongside** each `user_id` filter on write/INSERT paths (reads are covered by RLS; writes must set `org_id` from validated `X-Org-Id`).
- Add a **grep-based CI check / test** that fails if a hot-path router imports `get_supabase` (service-role) instead of the user-JWT dependency.

**Warning signs:**
A tenancy PR with large deletions of `.eq("user_id", ...)` lines; a new endpoint added during the milestone with neither an org filter nor a user-JWT client.

**Phase to address:** **P3-RLS+CLIENT** (keep filters, add org predicate, CI guard); cleanup deferred out of milestone.

---

### Pitfall 9: SSO — SAML XML-signature-wrapping / XXE, JIT duplicate-membership races, OIDC discovery SSRF, and the email/password fallback disabled by accident

**What goes wrong:**
- **SAML XSW (XML Signature Wrapping):** an attacker restructures the SAML response so the IdP's signature still validates but the SP reads a *different, unsigned* assertion — full auth bypass / impersonation. This is a **recurring, still-live class**: python3-saml `CVE-2017-11427` (DOM-traversal/canonicalization bypass, fixed 1.4.0+) and `CVE-2016-1000251` (signature wrapping pre-1.2.0); the class keeps reappearing (e.g. CVE-2025-47949 samlify, CVE-2026-47201 authentik). XXE via the SAML/metadata XML parser is the sibling risk.
- **JIT provisioning race:** two near-simultaneous first-logins for the same SSO user both find "no membership" and both `INSERT org_members` → duplicate-key error or duplicate membership (same for auto-creating the user/org).
- **OIDC discovery SSRF:** fetching an org-admin-supplied `.well-known/openid-configuration` / JWKS URL from the backend lets a malicious/misconfigured `sso_configs` row point the server at internal metadata endpoints (`169.254.169.254`, internal services).
- **Email/password fallback disabled by accident:** flipping an org to SSO in a way that disables password login *before* SSO is proven working locks the whole org out with no break-glass path.

**Why it happens:**
SAML is a 15-year-old XML-DSig format whose safety depends entirely on the library and its version; JIT races only appear under concurrency; discovery-doc fetching is an obvious SSRF sink disguised as a benign HTTP GET; and "SSO enforcement" toggles are one-way footguns.

**How to avoid:**
- **Pin `python3-saml` to a current patched release** and ensure `xmlsec1` is installed in the backend image; use a hardened / `defusedxml`-backed parser (never a raw `lxml.etree.fromstring` on IdP XML); validate that the assertion the SP consumes is the *signed* one (reference/schema hardening).
- **JIT provisioning must be idempotent:** `INSERT … ON CONFLICT (org_id, user_id) DO NOTHING`, and wrap user+membership creation in one transaction (or an advisory lock keyed on the email) so concurrent first-logins converge to one membership. Reuse Pitfall 7's idempotency discipline.
- **OIDC discovery SSRF guard:** allowlist/validate the discovery host, block link-local/private ranges, set `OIDC_CLIENT_DISCOVERY_TIMEOUT`, treat `sso_configs.idp_metadata` as untrusted input.
- **Keep email/password fallback ON for v3.4** (SSO *enforcement* is explicitly deferred per PRD §10/§11). Any future enforcement flip needs a preview/verify step + a break-glass operator override (the v3.3 Control Room is the natural home).
- SSO callbacks run in-request → keep the JIT DB work off the event loop (`run_in_threadpool`, D-v2.5-01).

**Warning signs:**
`python3-saml` unpinned or old; no `xmlsec1` in the image; raw `lxml` parse of IdP XML; JIT insert is a plain `INSERT` with no `ON CONFLICT` (duplicate-membership errors under load); the backend fetches an admin-supplied URL with no host validation; an org can reach "SSO required but not verified."

**Phase to address:** **P5-SSO** (library pinning + XSW/XXE hardening + idempotent JIT + SSRF guard + fallback preserved).

---

### Pitfall 10: Org-switch leaks — stale streams/Realtime across the switch, and localStorage `X-Org-Id` spoofing

**What goes wrong:**
- **Stale streams across an org switch:** a run started in Org A keeps streaming (Redis `run:{run_id}`) while the user switches to Org B; if the frontend doesn't abort subscriptions, Org A's tool-call/message events render inside Org B. Because **Supabase Realtime is best-effort only (D-v2.5-03)**, an org-filtered Realtime channel is NOT authoritative — a leaked event can still arrive. The canonical rule (D-v2.5-03) is *reconcile via fetch on (re)connect*; an org switch is a reconnect boundary and must **abort in-flight subscriptions + refetch**, never trust Realtime filtering.
- **`X-Org-Id` spoofing:** the active org persists in localStorage and rides on the `X-Org-Id` header. localStorage is client-controlled — a user can set `X-Org-Id` to an org they don't belong to. If the backend trusts the header without checking `org_members`, that's a direct cross-tenant read/write.

**Why it happens:**
The streams stack (StreamsProvider, per-thread buckets, LRU stream pool) was built for a single tenant where "all my threads are mine." Adding an org axis without an explicit teardown boundary lets old subscriptions survive. And headers *feel* server-controlled but aren't.

**How to avoid:**
- On org switch: `subscriptionsRef.forEach(c => c.abort())`, null the streaming-thread ref, clear per-thread stream buckets, then **refetch** the new org's threads/docs (reconcile-via-fetch, D-v2.5-03). Preserve the Phase 067.5 Branch D-3 `clearMessages`/`clearThreadBucket` guard — wrap `<OrgContext>` **outside** `<StreamsProvider>` so streams can read active org but the provider lift (G-5 `StreamsProvider.tsx`) is not regressed.
- **Server-side validate `X-Org-Id` against `org_members` on every request** (fail closed to the user's default/personal org, or 403). The header selects *which* of the caller's orgs is active; it can never grant membership. RLS is still the backstop, but the header must be validated before it's used to set `org_id` on writes.
- Bind the active org to a **JWT custom claim** where possible so it's server-attested, with the header as a hint validated against membership.

**Warning signs:**
After switching orgs, a previously-streaming run's events still paint the panel; the backend uses `X-Org-Id` to scope a query with no membership check; a Realtime channel filter is treated as the isolation boundary.

**Phase to address:** **P6-ORGUI** (switch teardown + `<OrgContext>` placement); **P3-RLS+CLIENT** (server-side `X-Org-Id` validation).

---

### Pitfall 11: Regressing the RED LINES — CONCUR-01, Deep-mode byte-identical (D-14), the G-5 hot files, and Redis `run:{run_id}` implicit org-scoping

**What goes wrong:**
The tenancy rewrite is the largest internals change in the project's history and it lands on the most protected surfaces:
- **CONCUR-01** (`test_058_concurrency.py`): membership-join RLS + per-request client construction must not push the cross-tab GET over 1s during streaming (the gate depends on `aexec`/`run_in_threadpool` keeping the event loop free — a synchronous per-request `create_client()` or an extra asyncpg `SET LOCAL` round-trip on the hot path can regress it).
- **Deep-mode byte-identical (D-14):** the shared agent/streaming path must stay byte-identical; org scoping enters at the service boundary (retrieval scope, client construction), never by forking the shared streaming path.
- **G-5 hot files:** `backend/app/api/threads.py` (already G-5-firing, extraction due) and `frontend/src/providers/StreamsProvider.tsx` must not regress. Threading `org_id` through the ~1850-LOC `send_message` and wrapping `<OrgContext>` around StreamsProvider are exactly the edits that trip G-5.
- **Redis `run:{run_id}` implicit org-scoping:** run buffers are keyed only by `run_id`, no org in the key. Isolation relies on RLS on the `runs` table gating who can resolve a `run_id`; if a run's `org_id` is unset/mis-set, or `stream_run`/`cancel_run` ownership SELECTs regress to a bypassing client, cross-org run enumeration/streaming opens.

**Why it happens:**
Cross-cutting changes touch protected files by necessity; the guardrails (G-5) fire precisely here; and Redis keys carry no tenant, so tenant safety is entirely inherited from the `runs`-row gate.

**How to avoid:**
- Run CONCUR-01 + the SC#10 4-axis cross-provider UAT (cross-provider × multi-tool × parallel-thread × long-message) on the rewrite branch **before merge**; the parallel-thread axis is where cross-org stream bleed surfaces.
- Keep org logic at the **service boundary** (retrieval scope resolution, client factory) — no `if org` branches inside the shared streaming loop (protects D-14).
- Honor **G-5**: if threading org through `threads.py` needs real surgery, propose the overdue extraction refactor *first* (G-5 fires on `threads.py`).
- Set `runs.org_id` at run creation from validated active-org; keep `stream_run`/`cancel_run` ownership SELECTs on the user-JWT client so the 404-not-403 invariant holds (RLS-blocked row → not visible → 404).

**Warning signs:**
CONCUR-01 flakes or exceeds 1s on the branch; any diff to the shared streaming consumer in `agent_loop` / provider gateway; `runs` rows with NULL `org_id`; a run streamable by a non-member; the G-5 ledger not consulted before editing `threads.py`.

**Phase to address:** **P3-RLS+CLIENT** (client + runs.org_id + CONCUR-01); **P8-ISOLATION** (full regression + SC#10); refactor-first per **G-5** before P3 touches `threads.py`.

---

### Pitfall 12: "It's isolated" claimed from a one-org test — the two-org fixture suite is the only proof

**What goes wrong:**
Every existing test seeds a single user/tenant, so it stays green even if isolation is completely broken — there is no second org for data to leak *into*. Shipping tenancy without a **two-org adversarial suite** leaves the highest-severity bug class (cross-org read/write) unverified. This is the difference between "looks done" and "is done."

**Why it happens:**
The existing suite's fixtures are single-user by construction; adding a second tenant is extra scaffolding that's easy to defer.

**How to avoid:**
Build `test_v3_4_org_isolation.py`: seed **User A ∈ Org X** and **User B ∈ Org Y**, and for **every** user-facing table assert A cannot `SELECT/UPDATE/DELETE` B's rows (and vice versa). Explicitly cover the four DEFINER retrieval fns — `match_document_chunks`, `keyword_search_chunks`, `match_skills` each return **0** cross-org rows; `query_user_documents` replayed with subquery/CTE payloads returns 0 cross-org rows. Add a member-vs-org-admin audit-log visibility case. Exercise **both** the PostgREST and asyncpg paths (Pitfall 4). Assert `X-Org-Id` spoofing (User A sends Org Y's id) is rejected.

**Warning signs:**
Isolation "verified" but the fixture seeds one org; no test names a second org/user; DEFINER retrieval fns absent from the isolation suite.

**Phase to address:** **P8-ISOLATION** (this suite is the milestone's exit gate).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Ship RLS policies now, swap the client "next phase" | Migrations land fast; isolation *looks* done | RLS inert; a forgotten `.eq` leaks all orgs; false confidence (Pitfall 1) | **Never** — client swap is atomic with the predicate rewrite |
| Extend `_inject_user_id` regex to also inject `org_id` | Reuses existing "guard"; no caller rewrite | Doubles a leaky string-rewriter; CTE/subquery bypass now leaks cross-org (Pitfall 3) | **Never** — move caller to user-JWT + delete the regex |
| Fix only `match_document_chunks`, treat retrieval as "done" | One function, quick | `keyword_search_chunks` + `match_skills` keep leaking cross-org (Pitfall 2) | **Never** — all 4 DEFINER retrieval fns or none |
| Keep asyncpg pool as a trusted service-role path with in-query predicates | No `SET LOCAL` complexity; preserves Phase 073 perf | RLS never binds on that path; a missed predicate = silent leak (Pitfall 4) | Only if **every** asyncpg query has mandatory `org_id`+`user_id` predicates AND a CI guard enforces it |
| Delete the now-"redundant" `user_id` filters during the rewrite | Cleaner diffs in `threads.py` | Removes the only fallback when a client swap regresses (Pitfall 8) | **Never in this milestone** — defer to a later code-quality pass |
| Ship `org_id` columns without indexes (mirroring mig 096's lean shape) | Smaller migration | Seq scans on `document_chunks`; retrieval p95 blows up; CONCUR-01 regresses (Pitfall 6) | Only for tiny/rarely-scanned tables; never on chunk/message/run tables |
| Trust Realtime's org filter as the isolation boundary | No teardown code on org switch | Best-effort Realtime (D-v2.5-03) leaks stale-org events; not authoritative (Pitfall 10) | **Never** — reconcile via fetch; abort subscriptions on switch |
| Auto-flag any seeded skill as `is_system_global` | `skill-creator` "just works" cross-org | A private skill seeded via SQL becomes a cross-org backdoor | **Never** — hardcoded allow-list in the migration only |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| supabase-py (PostgREST) | `create_client()` per request for the user JWT | Reuse one client; swap `Authorization` / `postgrest.auth(jwt)` per request; cache at process level via FastAPI DI (avoids connection fanout under `WORKER_COUNT=2`) |
| asyncpg pool (`get_pg_pool`) | Assume "user-JWT client" applies; expect RLS to bind | RLS ignores this path (DSN role, `auth.uid()` NULL). Use `SET LOCAL role authenticated` + `SET LOCAL request.jwt.claims` per txn, or mandatory in-query `org_id`+`user_id` predicates |
| Supabase Realtime | Filter channel by `org_id` and trust it | Best-effort only (D-v2.5-03); abort + refetch on org switch/reconnect |
| Redis run buffers | Assume `run:{run_id}` needs an org in the key | Key stays `run_id`-only; isolation inherited from `runs.org_id` RLS + ownership SELECT on the user-JWT client. Ensure `runs.org_id` is set at creation |
| `handle_new_user` trigger (auth.users→profiles, DEFINER) | Personal-org auto-create hooked only in the backfill; new SSO/JIT users get no org | Extend the new-user path (trigger or SSO callback) to create membership idempotently (`ON CONFLICT DO NOTHING`) |
| SAML IdP (python3-saml + xmlsec1) | Unpinned lib; raw XML parse; consume unsigned assertion | Pin patched `python3-saml`; `xmlsec1` in image; defusedxml; validate the signed assertion is the one read (XSW/XXE) |
| OIDC discovery fetch | Backend GETs admin-supplied discovery/JWKS URL unvalidated | Allowlist host, block link-local/private ranges, timeout — treat `sso_configs` as untrusted (SSRF) |
| Migration workflow (CLAUDE.md) | `supabase db push`/`db reset`; hand-edit `full-schema.sql`; letter-suffix filenames (`088b`) | Paste into Supabase SQL editor; `scripts/regenerate-full-schema.sh`; digits-only filenames; deploy-artifact same-commit parity |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Per-row `org_members` sub-select in every table's RLS | Retrieval/list p95 climbs; CONCUR-01 flakes | Resolve org set once via DEFINER helper / JWT claim; compare against a constant array | ~100s concurrent users × multi-org membership |
| No `org_id` index (mig 096 shipped none) | `EXPLAIN` shows seq scan on `document_chunks` | Partial/composite `org_id` index beside the vector index; org filter pre-narrows | ~100k+ chunks per retrieval |
| `document_chunks` scoped via per-row `JOIN documents` (no own `org_id`) | Extra join on the hottest vector path | Add+backfill+index `org_id` on `document_chunks` directly | Any real corpus under parallel runs |
| Per-request `create_client()` construction on the hot path | Connection fanout; event-loop stalls; CONCUR-01 >1s | Reuse client + header swap; keep `aexec`/`run_in_threadpool` (D-v2.5-01) | 50+ parallel runs |
| asyncpg `SET LOCAL` round-trips added to the hot path | Extra RTT per query erodes the CONCUR-01 margin | Batch within one txn; measure against the 1s gate before merge | Streaming + cross-tab GET concurrency |
| Backfill `UPDATE` unbatched over large tables | Deploy-time app stall / lock storm | 10k-row batches, `WHERE org_id IS NULL`, low-traffic window | A user/org with 100k+ documents |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Service-role client left on hot paths after RLS ships | RLS inert; a forgotten filter leaks **all** orgs | User-JWT client swap atomic with the predicate rewrite (Pitfall 1) |
| Fixing 1 of 4 DEFINER retrieval fns | Keyword search + skill catalog leak cross-org | Audit all `SECURITY DEFINER` fns in `full-schema.sql`; scope every retrieval fn (Pitfall 2) |
| `match_document_chunks` / `keyword_search_chunks` with no pinned `search_path` | Search-path hijack privilege escalation on a DEFINER fn | `SET search_path` on both in the same change |
| Regex SQL rewriting as the tenant guard | CTE/subquery bypass → cross-org SQL read (Pitfall 3) | Delete `_inject_user_id`; user-JWT + already-INVOKER `query_user_documents` |
| `X-Org-Id` header trusted without membership check | localStorage spoof → cross-tenant read/write | Validate header against `org_members` server-side; RLS backstop (Pitfall 10) |
| SAML assertion consumed without XSW/XXE hardening | Auth bypass / impersonation (CVE-2017-11427 class) | Patched `python3-saml` + xmlsec1 + defusedxml + signed-assertion validation |
| OIDC discovery URL fetched unvalidated | SSRF to internal metadata / services | Host allowlist + private-range block + timeout |
| Global-resource owner-UUID leak (SEED-091) survives the rewrite | Non-owner org members see the seeding owner's `auth.users.id` (+ `folder_scope`) on shared folders/skills/views | In each list/serialize path null owner fields on shared rows the caller doesn't own — apply uniformly to folders+skills+views |
| JIT provisioning non-idempotent | Duplicate memberships / unique-violation on concurrent first-login | `INSERT … ON CONFLICT DO NOTHING` + txn/advisory-lock (Pitfall 9) |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Backfill mishandles `is_global` | Users "lose" previously-shared docs/skills after deploy | Value-preserving `RENAME`; fixture test proving shared-stays-shared |
| Org switch doesn't tear down streams | Org A's run events paint inside Org B | Abort subscriptions + refetch on switch; `<OrgContext>` outside `<StreamsProvider>` |
| SSO enforcement flipped before SSO verified | Whole org locked out, no recovery | Keep email/password fallback (v3.4); preview + break-glass before any enforcement |
| No active-org affordance / identity anchor | User unsure which tenant they're acting in | Profile-menu identity anchor + org switcher (SEED-113) |
| New user lands with no org after signup | Empty app, confusing first-run | Idempotent personal-org creation on the new-user / JIT path |

## "Looks Done But Isn't" Checklist

- [ ] **RLS policies written:** Verify the **client swapped to user-JWT** on every hot path (`get_supabase` gone from `/threads`, `/documents`, `/runs`, `/kb`, `/skills`, retrieval, SQL tool) — policies are inert under service-role.
- [ ] **Retrieval isolation:** Verify **all four** DEFINER fns scoped (`match_document_chunks`, `keyword_search_chunks`, `match_skills`, `folder_is_globally_visible`) — not just vector search.
- [ ] **Text-to-SQL:** Verify `_inject_user_id` **deleted** and the RPC called with a user-JWT client — not "regex extended to org_id."
- [ ] **asyncpg path:** Verify RLS actually binds (or mandatory predicates + CI guard) — a "user-JWT client" does nothing for `get_pg_pool` queries.
- [ ] **Indexes:** Verify `org_id` **indexed** on `document_chunks`/`messages`/`runs` (mig 096 shipped none) — and that `document_chunks` even *has* an `org_id` column.
- [ ] **Backfill:** Verify **idempotent re-run** (no duplicate orgs/memberships), **batched**, NOT-NULL flipped **after** backfill, `is_global` `RENAME`d not dropped, `skill-creator` still cross-org visible.
- [ ] **`X-Org-Id`:** Verify the server **validates against `org_members`** — not trusted from localStorage.
- [ ] **`runs.org_id`:** Verify set at creation; `stream_run`/`cancel_run` ownership on user-JWT client (404-not-403 preserved).
- [ ] **SSO:** Verify `python3-saml` pinned + `xmlsec1` present + XSW/XXE hardened; JIT `ON CONFLICT`; OIDC discovery SSRF-guarded; email/password fallback **still works**.
- [ ] **Two-org proof:** Verify `test_v3_4_org_isolation.py` seeds **two** orgs and covers every table + all DEFINER fns + both DB paths + header spoof.
- [ ] **Red lines:** Verify CONCUR-01 <1s, Deep byte-identical (D-14), G-5 files unregressed, SC#10 4-axis UAT green on the branch.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| RLS shipped but client still service-role | HIGH | Emergency: confirm the `.eq("user_id")` filters weren't deleted (fallback intact); hot-fix the client dependency; audit access logs for cross-org reads during the window |
| One DEFINER retrieval fn missed | MEDIUM | Add org filter + `search_path` to the missed fn; re-run two-org retrieval assertions; check logs for cross-org citations |
| Backfill created duplicate orgs/memberships | MEDIUM | Dedup by `(org_id,user_id)` / oldest personal org per user; make the migration idempotent; re-run against a prod copy first |
| `is_global` sharing lost in backfill | HIGH | Restore from pre-migration snapshot; re-apply value-preserving `RENAME`; re-flag the `is_system_global` allow-list |
| `org_members` recursion (42P17) in prod | LOW-MEDIUM | Replace the self-selecting policy with a DEFINER-helper predicate; redeploy the single policy migration |
| CONCUR-01 regressed | MEDIUM | Add `org_id` indexes; move org resolution to a JWT claim/helper; revert per-request `create_client()` to header-swap; re-benchmark |
| Cross-org leak found post-ship | HIGH | Feature-flag/rollback the tenancy branch (atomic branch makes this cleaner); the two-org suite becomes the regression gate before re-ship |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase (role) | Verification |
|---------|-------------------------|--------------|
| 1 — Service-role bypasses RLS | **P3-RLS+CLIENT** (atomic w/ predicates) | No `get_supabase` on hot paths; two-org read blocked with a JWT whose sub ≠ owner |
| 2 — 4 DEFINER retrieval fns | **P4-SECDEF** | Two-org suite: each of the 4 fns returns 0 cross-org rows; `search_path` pinned |
| 3 — `query_user_documents` INVOKER-but-service-role + regex | **P4-SECDEF** | `_inject_user_id` deleted; subquery/CTE replay returns 0 cross-org rows |
| 4 — asyncpg bypasses RLS | **P3-RLS+CLIENT** | asyncpg path returns 0 rows for a user whose claims weren't set |
| 5 — `org_members` recursion | **P1-SCHEMA** | No 42P17; policy references DEFINER helper, not self |
| 6 — membership-join perf / no index | **P3-RLS+CLIENT** + **P8-ISOLATION** | `EXPLAIN` uses `org_id` index; CONCUR-01 <1s on branch |
| 7 — backfill lock/idempotency/NOT-NULL/`is_global` | **P2-BACKFILL** | Re-run idempotent; batched; shared-stays-shared fixture; new users get an org |
| 8 — forgotten org predicate / belt-and-suspenders | **P3-RLS+CLIENT** | Filters retained; CI guard fails on service-role import |
| 9 — SSO XSW/XXE/JIT/SSRF/fallback | **P5-SSO** | Patched lib + xmlsec1; JIT `ON CONFLICT`; SSRF guard; fallback UAT |
| 10 — org-switch streams / `X-Org-Id` spoof | **P6-ORGUI** + **P3-RLS+CLIENT** | Switch aborts+refetches; header validated vs `org_members` |
| 11 — RED LINES (CONCUR-01/D-14/G-5/Redis) | **P3-RLS+CLIENT** + **P8-ISOLATION** | CONCUR-01 + SC#10 4-axis green; `runs.org_id` set; G-5 consulted |
| 12 — one-org test false-green | **P8-ISOLATION** | `test_v3_4_org_isolation.py` seeds two orgs across every table + both DB paths |

## Sources

- **Live codebase (HIGH):** `supabase/full-schema.sql` (DEFINER fns at :97 `folder_is_globally_visible`, :136 `keyword_search_chunks`, :163 `match_document_chunks`, :188 `match_skills`, :219 `query_user_documents` INVOKER, :212 the "ONLY cross-user gate — never widen it" comment); `backend/app/dependencies.py` (:21-25 service-role singleton, :79-105 asyncpg pool); `backend/app/services/sql_service.py` (:31-68 `_inject_user_id` regex, :34/:92 "service role bypasses RLS" comments); `supabase/migrations/096_org_id_stub_sweep.sql` (4-root stub, no FK/index/backfill, "child tables … NOT stubbed"); `supabase/migrations/012_query_documents_fn.sql` (INVOKER since day 1); `backend/tests/integration/test_058_concurrency.py` (CONCUR-01 gate).
- **Planning intent (HIGH):** `.planning/PROJECT.md` (v3.4 scope, ratify-not-relitigate ADR, SEED-091 folds here); `.planning/PRDs/v3.3-multi-tenancy.md` (§3–§13 intent — **numbers stale**, mine for intent only: §6 belt-and-suspenders, §10 rejected enforcement/cross-org-sharing, §13 Q-v3.2-08 atomic); `.planning/seeds/SEED-004-org-multi-tenancy.md` (entry plan, RLS-shift, DEFINER audit); `.planning/seeds/SEED-091-global-resource-owner-identity-disclosure.md` (owner-UUID leak + minimal fix); `CLAUDE.md` (D-v2.5-01 threadpool, D-v2.5-03 Realtime best-effort, D-14 Deep byte-identical, G-5 hot files, WORKER_COUNT=2, migration-via-SQL-editor).
- **SSO CVE class (HIGH, external):** python3-saml CVE-2017-11427 (auth bypass via DOM-traversal/canonicalization, fixed 1.4.0+) and CVE-2016-1000251 (signature wrapping pre-1.2.0); recurring class — CVE-2025-47949 (samlify), CVE-2026-47201 (authentik XSW). [Snyk: CVE-2017-11427](https://security.snyk.io/vuln/SNYK-PYTHON-PYTHON3SAML-40775) · [PortSwigger — The Fragile Lock: SAML bypasses](https://portswigger.net/research/the-fragile-lock) · [SAML-Toolkits/python3-saml](https://github.com/SAML-Toolkits/python3-saml)
- **supabase-py per-request JWT (MEDIUM, external):** service-role key ALWAYS bypasses RLS; reuse one client + override Authorization per operation (do not create-client-per-request); cache clients at process level. [Supabase Discussion #33811 — FastAPI + Supabase](https://github.com/orgs/supabase/discussions/33811) · [Supabase Docs — service role & RLS](https://supabase.com/docs/guides/troubleshooting/why-is-my-service-role-key-client-getting-rls-errors-or-not-returning-data-7_1K9z) · [Supabase RLS best practices (multi-tenant)](https://makerkit.dev/blog/tutorials/supabase-rls-best-practices)

---
*Pitfalls research for: org multi-tenancy + RLS rewrite + SSO retrofit onto a single-tenant per-user RAG platform (Agentic RAG v3.4)*
*Researched: 2026-07-18*
