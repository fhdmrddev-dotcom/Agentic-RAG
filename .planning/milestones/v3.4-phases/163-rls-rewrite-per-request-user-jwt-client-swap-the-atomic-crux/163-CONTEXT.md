# Phase 163: RLS Rewrite + Per-Request User-JWT Client Swap — THE ATOMIC CRUX - Context

**Gathered:** 2026-07-19
**Status:** Ready for planning
**Discussion mode:** `--auto` (operator ran unattended — every gray area auto-selected, each decision locked by Claude's best judgment against the research base, prior-phase handoffs, and three live code scouts; operator review of this CONTEXT.md is the intended checkpoint before `/gsd:plan-phase`).

<domain>
## Phase Boundary

The milestone's **single load-bearing security transition**: make RLS *actually enforced* instead of decorative, by landing membership-based RLS predicates **and** the per-request user-JWT DB context **together** across both data-access paths — so a second user in a second org provably cannot read the first user's rows. Today RLS is inert: `get_supabase()` is a **service_role (BYPASSRLS)** singleton and the asyncpg pool connects as the **`postgres` superuser (BYPASSRLS)**; the *only* real isolation today is **262 hand-written `.eq("user_id")` filters across 35 files**. Rewriting policies without swapping the client changes nothing — hence "atomic crux."

**Requirements:** TEN-01 (rewrite every RLS predicate on the ~38 user-facing tables to membership-based), TEN-02 (per-request user-JWT client on BOTH paths — supabase-py JWT-header swap + asyncpg `SET LOCAL request.jwt.claims` + the mandatory `SET LOCAL ROLE authenticated`), TEN-04 (`org_id` denormalize + index on `document_chunks`/`skill_embeddings`, benchmarked against the CONCUR-01 <1s gate).

**In scope:**
- **Wave 0 — `threads.py` extraction (HARD-GATED prerequisite).** Extract the inline producer shell out of the 2,444-LOC `threads.py` **before** any `org_id` touches `send_message`. Verified Deep-byte-identical + full test suite green is a HARD GATE (D-01).
- **Front A — RLS predicate rewrite** on the ~38 existing user-facing tables (`auth.uid() = user_id` → `org_id = ANY(current_user_org_ids()) AND (owner OR shared OR dept-scoped OR system-global)`), preserving today's global OR-branches, shipped in ~6 reviewable per-cluster bundles (D-06).
- **Front B — the client swap on both paths** (D-02/D-03/D-04): a `get_user_supabase(request)` factory (JWT-header/`postgrest.auth`) + a `get_user_pg_connection(request)` asyncpg context-manager (`SET LOCAL ROLE authenticated` + claims), with local JWKS/PyJWT verification feeding the claims dict.
- **Retained service-role, hardened** (D-05): `get_service_role_supabase(org_id)` that **refuses to construct without an explicit org**, kept only for the four fully-async writers (agent loop, eval runner, harness engine, re-embed) + legitimate cross-tenant ops; their `.eq("user_id")` filters widen to org-aware. The 262 `.eq("user_id")` filters are **KEPT** as belt-and-suspenders (D-14) — not deleted this milestone.
- **TEN-04** (D-07): denormalize + backfill `org_id` onto `document_chunks` + `skill_embeddings` (162 explicitly excluded them), add the composite/partial index alongside the vector index, **benchmark against CONCUR-01 <1s before merge**.
- **The research-phase gate** (D-08): a **live two-user leak test** proving cross-org isolation on both DB paths — do NOT ship on documentation alone.

**Out of scope (explicitly):**
- **The 4 SECURITY DEFINER retrieval/sharing functions' org-scoping + `_inject_user_id` deletion + the two-org `test_v3_4_org_isolation.py` exit suite** → **Phase 164** (TEN-03/05/06). 163 only *pins `search_path`* on `match_document_chunks`/`keyword_search_chunks` if it touches them for `document_chunks` RLS, and ships `document_chunks` `org_id`/RLS so 164's INVOKER-caller rewrite has its substrate.
- **`is_global` → `is_org_shared` / `is_system` → `is_system_global` RENAME** → **Phase 165** (MIG-02). **163 writes predicates against the LIVE column names `is_global` / `is_system`** (162-D-05 handoff binds this) — the roadmap's `is_org_shared`/`is_system_global` in SC#1 is forward-naming shorthand.
- **`<OrgContext>` provider + org switcher + `X-Org-Id` active-org header + the custom-access-token JWT-membership hook** → **Phase 166** (D-12). 163 enforces org-**membership** isolation via `current_user_org_ids()` (reads `org_members` live off `auth.uid()`); the single-active-org narrowing is 166's org-switcher.
- **Invitations / SSO JIT** → 167 / 168. **Per-user preference layer / entitlement footholds** → 167 / STRETCH 170.
- **Deleting the `.eq("user_id")` filters** → a later hardening pass, NOT this milestone (D-14 belt-and-suspenders).

</domain>

<decisions>
## Implementation Decisions

### `threads.py` Wave-0 extraction — the G-5/G-1 prerequisite
- **D-01 — Extract FIRST, hard-gated; provisionally PROMOTE to a dedicated phase (final structural call at plan-time).**
  - **Locked, non-negotiable safety property:** the extraction lands, proves Deep-Mode **byte-identical**, and the full test suite is green **BEFORE the first `org_id` predicate or client-swap touches the producer path.** No `org_id` in `send_message` until the seam is clean. This holds under either structure below.
  - **Scope (measured by scout):** `threads.py` is **2,444 LOC** (not the roadmap's ~1,850). Extract the inline **`agent_runner` producer shell + `_shielded_finalize` (lines 1410–2003, ~595 LOC)** and **unify it with the near-duplicate `spawn_continuation_run` (2279–2444, ~166 LOC)** into a shared `run_producer.py` — else the two finalize orderings keep drifting. Plus `workflow_kickoff.py` (kickoff preflight + harness ctx/scope, ~295 LOC), `thread_title.py` (title subsystem, ~150 LOC, lowest-risk), `run_model_resolution.py` (model/provider seam, ~200 LOC). ≈ **1,100–1,400 LOC across 4 new modules.**
  - **De-risked (key finding):** the Deep-Mode byte-identical **red line was already extracted in Phase 089** into `agent_loop.py::run_agent_loop`; in `send_message` it is a single call (lines 1697–1704). Wave 0 does **not** threaten the Deep guarantee. The surviving byte-identical surface is the **`_shielded_finalize` finalize-ordering invariants** (finalize-before-sentinel, sentinel-before-EXPIRE, ZREM atomicity, `asyncio.shield`ed persist) — dense enough to deserve isolated testing.
  - **Provisional recommendation: PROMOTE to a dedicated refactor phase** (scout's call + invariant density), rather than an in-phase wave. **Final promote-vs-wave commit is made at `/gsd:plan-phase 163`** — the roadmap explicitly reserves this decision for plan-time (it owns the renumbering-ripple tradeoff: a dedicated phase shifts the crux to 163.1 and renumbers STRETCH 169–173). Either structure MUST preserve the hard gate above.

### Front B — the asyncpg per-request RLS context (the load-bearing fix)
- **D-02 — On the existing pool (no new pool), per request: `async with pool.acquire() as con: async with con.transaction(): SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = <claims-json>`.**
  - **The `SET LOCAL ROLE authenticated` is the load-bearing piece** — the pool's DSN role is `postgres`/BYPASSRLS, so the claims alone do nothing until the role switches to a non-BYPASSRLS role. This is the single most-cited trap in the research.
  - **Named research-spike deliverable — the GUC-variant question:** the existing prototype (`tests/integration/test_110_dm_schema.py:302-314`) sets the *legacy* per-claim GUC `request.jwt.claim.sub`, but Supabase `auth.uid()` reads the **JSON** `request.jwt.claims`. **Set the variant the rewritten policies' `auth.uid()` actually reads (the JSON `request.jwt.claims`); set both forms if the live leak test shows either is needed.** Do NOT trust docs — the live two-user test (D-08) is the arbiter (STACK.md flags this MEDIUM-confidence).
  - **The 100 connectionless `pool.*(...)` calls across 21 files must become explicit `acquire()`+`transaction()`** to carry `SET LOCAL` — a real sub-scope. Prioritize the request-path callers; the four async-writer callers stay service-role (D-05).
  - Single seam: a `get_user_pg_connection(request)` async context-manager in `dependencies.py`.

### Front B — the supabase-py per-request user-JWT client
- **D-03 — A `get_user_supabase(request)` factory bound to the caller's JWT** (header override / `postgrest.auth(jwt)`), replacing the service-role singleton on request-scoped hot paths. Central swap at the router `Depends` seam (`get_supabase` is router-dominant — 517 hits/98 files, mostly `Depends`-injected then passed into services). supabase-py calls still block → keep the existing `run_in_threadpool` discipline (D-v2.5-01). Per-request client-construction cost is benchmarked with D-07.

### Front B — JWT verification strategy
- **D-04 — Local JWKS/ES256 verification via PyJWT (`PyJWKClient`), promoted to an explicit pin.** Today `get_current_user` (`dependencies.py:130-151`) does a per-request `supabase.auth.get_user(token)` **GoTrue network round-trip**. Local JWKS verify (a) drops that round-trip (helps CONCUR-01) and (b) yields the **claims dict the asyncpg `SET LOCAL` needs**. Keep GoTrue as a fallback if JWKS fetch fails. Research-recommended; 0–1 new hard dep (PyJWT already transitive via `gotrue`).

### Service-role retention split
- **D-05 — `get_service_role_supabase(org_id)` refuses to construct without an explicit org; retained ONLY for:** the four fully-async writers with no `auth.uid()` — **agent loop** (`agent_loop.py`, via `db/runs.py` `pool.execute`), **eval runner** (`eval_runner_service.py`, injected `supabase`), **harness engine** (`harness_engine.py:1480-1481` `_service_supabase`), **re-embed** (`reembed_service.py` + `skill_embedding_service.skill_reembed_job`) — plus legitimate cross-tenant ops (SSO JIT 168, org-admin cross-member reads 166). Those four **keep service-role but widen their `.eq("user_id")` filters to org-aware** (add an `org_id` predicate). All other request-scoped handlers move to the user-JWT clients (D-02/D-03). The 262 `.eq("user_id")` filters stay everywhere as belt-and-suspenders (D-14).

### Front A — RLS predicate rewrite: shape, bundling, atomic flip order
- **D-06 — Transform + bundle + flip-last.**
  - **Shape:** `auth.uid() = user_id` → `org_id = ANY(current_user_org_ids()) AND (user_id = auth.uid() OR is_global OR is_system OR <dept-scope where applicable>)`, **preserving today's global OR-branches** (`is_global` on `skills`/`document_views`; `folder_is_globally_visible(...)` on `documents`/`folders`). Writes gate via `current_user_has_permission(org_id, key)` where a permission applies. Use the **proven template already live on the 8 org tables** (`org_id = ANY(current_user_org_ids())`) — this is the same pattern, not a new invention.
  - **Live column names:** write against `is_global` / `is_system` (162-D-05 binds; 165 renames atomically).
  - **Quoted policy names:** the 6 user tables use human-quoted policy names (e.g. `"Users can view own or global-folder documents"`) vs terse org-table names — `DROP POLICY "..."` must use the exact quoted names. Enumerate at plan time.
  - **Bundling:** ~6 reviewable per-cluster migration bundles — documents / chat / skills / DM / workflow-eval / identity-audit. **RE-VERIFY the exact table set + counts at plan time** — live is now **135 policies / 48 RLS-enabled tables / 14 SECDEF fns** (drifted up from the research's 110/103-head snapshot; 162 added migs 105+106). "38 user-facing tables" = 48 RLS tables minus the 8 already-correct org tables (161-D-09) minus operator/system tables — confirm the precise membership.
  - **Atomic flip order (the crux's operational meaning):** author ALL RLS bundles FIRST — they are **inert under the current BYPASSRLS connections**, so shippable incrementally with zero behavior change — THEN flip the client swap (D-02/D-03) LAST, with the live two-user leak test (D-08) as the go/no-go. There must be **no window where the client is swapped but predicates are incomplete.**

### TEN-04 — pgvector hot-path org_id + index + benchmark
- **D-07 — Denormalize `org_id` onto `document_chunks` + `skill_embeddings`, backfill, index, benchmark before merge.**
  - Both tables have **NO `org_id` today** (explicitly deferred here by `migrations/104_...:442-443`); 162 excluded them. Add the column, **backfill** it (resolve via the parent `documents`/`skills` FK → owner's org), and set NOT-NULL after zero-NULL (mirror 162's self-guarded pattern).
  - **RLS on `document_chunks` filters on the denormalized `org_id` directly** — never a per-row join to `documents` (the single largest perf threat). `document_chunks` today: HNSW `(m=16, ef_construction=64)` + GIN(search_vector), **no user_id/org_id btree**. `skill_embeddings`: btree(user_id), no ANN index (~empty, tens–hundreds rows).
  - **Index shape is benchmark-driven** (composite `(org_id, …)` btree vs partial index vs a pre-filter alongside HNSW) — decided by measuring, not guessed.
  - **Perf gate:** the benchmark runs against **CONCUR-01 <1s cross-tab-GET-during-streaming** (`tests/integration/test_058_concurrency.py`) and must be **GREEN before merge**. This is the highest-risk item in the phase.

### The research-phase gate — live two-user leak test
- **D-08 — Mandatory live two-user leak test; `/gsd:plan-phase 163 --research-phase`.** Two users in two different orgs, run against the live local DB before merge: user B provably **cannot** read user A's rows across **both** DB paths (supabase-py + asyncpg), and claims/role spoofing is rejected. This is the crux's go/no-go and the **arbiter of the D-02 GUC-variant question**. Distinct from 164's full `test_v3_4_org_isolation.py` two-org exit suite (every table × all 4 SECDEF fns × header-spoof) — 163's is the focused crux-enablement proof. Per `feedback_user_starts_backend` + `browser-uat-user-driven`, the operator runs the live test.

### SC#10 + Deep byte-identical (red line)
- **D-09 — Org context rides the REQUEST seam only** (dependency-injected DB session context), **never the provider/gateway path** — so no shared-path fork and Deep stays byte-identical on the native-7. After D-01's extraction proves byte-identical, the `org_id` threading must preserve it too. Verification bars: the **SC#10 4-axis UAT** (cross-provider × multi-tool × parallel-thread × long-message) + the D-08 live leak test — both operator-run.

### Nullable-org_id rows + Redis
- **D-10 — RLS predicates handle NULL `org_id` explicitly.** Per 162-D-11, genuinely org-agnostic audit/operator rows stay nullable; their 163 policies must handle `org_id IS NULL` explicitly (operator/system rows are reached via the operator path, not the membership predicate). `runs.org_id` is set at creation; **Redis `run:{run_id}` inherits org-scoping via the `runs` row** (the DB row is the gate — no RLS on Redis).

### Org-context source — the crux blast-radius shrinker
- **D-12 — 163 enforces via `auth.uid()` → `current_user_org_ids()` (reads `org_members` live); it does NOT require the custom-access-token JWT-membership hook or the `X-Org-Id` active-org header (both deferred to 166).** For every existing user, post-162 membership is exactly **one personal org**, so membership-set isolation is byte-identical to today's per-user behavior. Baking the membership set into the JWT (avoids the per-query `org_members` join) and the single-active-org `X-Org-Id` narrowing are **166 org-switcher optimizations** — pulling them in now bloats the crux for no v3.4-at-163 behavior change and shrinks the crux blast radius (the 161-D-08 principle). **Escape valve:** if the per-query join inside `current_user_org_ids()` itself threatens CONCUR-01, the JWT-membership optimization can be pulled forward — decided by the D-07 benchmark, not assumed.

### 4-tier deployment-flexibility contract (ADR per-phase enforcement)
- **D-11 — Nothing 163 ships makes any deployment tier harder** (ADR D-v3.4-01 SC#4, binding on 161–173). The user-JWT swap works identically in an **isolated single-org deploy** (one org, one membership) and **co-tenant** (many orgs) — pure env-var, no hardcoded URLs/keys/roles, local setup never breaks. Red line D-14: no new runtime; the swap is a request-seam pattern, not a fork. Verification confirms tier-parity.

### Claude's Discretion
- Exact new module names/boundaries for the Wave-0 extraction (`run_producer.py` / `workflow_kickoff.py` / `thread_title.py` / `run_model_resolution.py` are the scout's natural seams — executor may refine).
- Exact index names/shapes for TEN-04 (benchmark-driven), the precise per-cluster bundle membership, procedure/constraint names.
- The final GUC-variant choice (`request.jwt.claims` vs also-`request.jwt.claim.sub`) — **pending the D-08 live test**; both-forms is an acceptable belt-and-suspenders default.
- Migration slot(s): next free numbered slot — **verify at plan time** (161 used 104; 162 consumed 105 **and** 106 → likely **107+**). Apply via Supabase SQL editor, regenerate `full-schema.sql`, same-commit (CLAUDE.md); deployment-artifact parity (D-16) if any bundle becomes seed-bearing.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirement + roadmap
- `.planning/REQUIREMENTS.md` — **TEN-01, TEN-02, TEN-04** verbatim (this phase's requirements) + the **Out-of-Scope table** (no cross-org sharing; the only legitimate cross-org visibility is the seeded `skill-creator` `is_system` allow-list) + **TEN-03/05/06 / PRAG-01** (Phase 164 — the SECDEF-audit boundary 163 must NOT cross).
- `.planning/ROADMAP.md` — **Phase 163 detail (SC#1–5 verbatim, lines 121–131)** + the **"Guardrails, gates & sequencing (v3.4)" block (lines 261–276)**: the atomic-crux LOCK, the G-5/G-1 extraction-first rule, the data-dependency order, the SC#10 mandate, the perf gate, the research-phase flag, and the red line.

### The binding ADR + prior-phase handoffs (these bind 163)
- `.planning/phases/160-tenancy-model-adr/160-ADR.md` — **D-v3.4-01**: the `is_system_global` / `is_org_shared` naming locks (relevant to D-06's live-name rule), the slot-104+ renumbering, and the **4-tier deployment-flexibility contract with its per-phase enforcement clause** (binds D-11).
- `.planning/phases/161-org-dept-role-schema/161-CONTEXT.md` — **D-08/D-09** (the 8 new org tables are correct-from-birth and **EXCLUDED from 163's 38-table rewrite scope**); **D-10** (`org_members` locked non-recursive self-rows-only policy — do NOT touch); the `current_user_org_ids()` + `current_user_has_permission()` helpers 163's predicates call; **D-02/D-03** (the seeded permission catalog + OPEN-STRING keys).
- `.planning/phases/162-personal-org-backfill/162-CONTEXT.md` — **D-05 (BINDING on the 163 planner):** 163 writes predicates against the CURRENT column names `is_global`/`is_system`; the rename is 165's atomic job. **D-09** (`org_id` = home org, sharing flag = reach; global/system rows land in the owner's personal org — no synthetic system org). **D-10/D-11** (the backfilled table set + the nullable org-agnostic audit rows → informs D-07 backfill + D-10 NULL-handling).
- `.planning/prd-reset/DECISIONS.md` — **D-PRD-02** (co-tenant posture), **D-14** (red line: Deep byte-identical, provider differences at the gateway/adapter boundary, no new runtime; KEEP the `.eq("user_id")` filters), **D-16** (deployment-artifact same-commit parity).

### Research base (re-authored against live schema head 103 — highest-signal; RE-VERIFY counts, drifted to head 106)
- `.planning/research/SUMMARY.md` — the **two-front atomic-war framing**; **Pitfalls 1–6** (service-role/asyncpg bypass, 4-of-4 SECDEF, `query_user_documents`-is-already-INVOKER, `42P17`, `document_chunks` index, backfill); the **`SET LOCAL`/`SET ROLE` MEDIUM-confidence gate** (Gaps §); the **Research Flags** (163 = live two-user leak test; do not ship on docs alone).
- `.planning/research/ARCHITECTURE.md` — the **38-user-facing-table map**, the two DB-access paths, the **two perf cliffs** (mig 096 stubs un-indexed; `document_chunks` has no `org_id`), the `get_user_supabase` + asyncpg `SET LOCAL` component design.
- `.planning/research/STACK.md` — **no new pool** (reuse `get_pg_pool`); **PyJWT local JWKS** verify (D-04); the explicit flag that one source's `set_config` third-arg claim is **likely lossy** (D-02 GUC-variant); 0–2 new hard deps.
- `.planning/research/PITFALLS.md` — the codebase-specific traps + Recommended-pattern / anti-pattern / failure-signature rows (Pitfall 1 service-role bypass; Pitfall 5 `document_chunks` index → CONCUR-01).

### Live code seams (RE-VERIFY at plan time — these are the swap/rewrite targets)
- `backend/app/dependencies.py` — the service-role singleton **`get_supabase()` (:21–25)**, the asyncpg **`get_pg_pool()` (:79–105, `postgres`/BYPASSRLS DSN)**, and **`get_current_user()` (:130–151, the GoTrue round-trip D-04 replaces)**. The single seam Front B hangs off (`get_user_supabase` + `get_user_pg_connection` are net-new here).
- `backend/app/api/threads.py` — **2,444 LOC**; **`send_message` (1018–2045)**, the inline **`agent_runner` producer (1410–2003)** + **`_shielded_finalize` (~1770–1985)**, **`spawn_continuation_run` (2279–2444, unify)**, the 9 `get_supabase` handlers + ~30 `.eq("user_id")` sites + the `get_pg_pool` raw-SQL sites (Wave-0 + `org_id`-threading targets).
- `backend/app/services/agent_loop.py` — **`run_agent_loop`** (Phase 089): the Deep byte-identical red line **already lives here**, NOT in `threads.py`. Uses `get_pg_pool` (:75); a D-05 service-role writer.
- `backend/app/services/{eval_runner_service,harness_engine,reembed_service,skill_embedding_service}.py` + `backend/app/db/runs.py` — the four fully-async service-role writers (D-05 — keep service-role, widen filters).
- `supabase/full-schema.sql` — the **6 user-table policies** (`documents` L4838/4570/4696/4437; `folders` L4747…; `skills` L4761…; `document_views` L4740…; `threads` L4936…; `messages` L4922…), the **4 SECDEF fns** (`match_document_chunks` L310 **unpinned**, `keyword_search_chunks` L283 **unpinned**, `match_skills` L335, `folder_is_globally_visible` L224), **`document_chunks` (L759–770, no org_id, HNSW L2572)**, **`skill_embeddings` (L1458–1466, no org_id)**, **`current_user_org_ids()` (L212–217)** + **`current_user_has_permission()` (L193)**.
- `supabase/migrations/104_org_dept_role_schema.sql` — the org-table RLS **template predicate** to copy, the `autofill_org_id_by_owner/from_parent` INSERT triggers (org_id is auto-populated), and **`:442-443`** (document_chunks/skill_embeddings deferred to 163 = TEN-04) + `:445` (mig-096 stubs un-indexed).
- `tests/integration/test_110_dm_schema.py:302-314` — the **existing asyncpg-`SET LOCAL` prototype** (`_select_count_as_user`): `SET LOCAL ROLE authenticated` + `set_config('request.jwt.claim.sub', …, true)` — the reference to productionize, and the source of the **D-02 GUC-variant flag** (legacy `request.jwt.claim.sub` vs JSON `request.jwt.claims`).
- `tests/integration/test_058_concurrency.py` — the **CONCUR-01 <1s** binding gate D-07 benchmarks against.

### Project conventions
- `CLAUDE.md` — numbered-migration rules (`<digits>_name.sql`; apply via **SQL editor**, never `db push`/`db reset`; regenerate `full-schema.sql`; deployment-artifact same-commit parity); **D-v2.5-01** (`run_in_threadpool` for blocking supabase-py in async — the user-JWT supabase-py client still blocks); **WORKER_COUNT=2** singleton considerations; the **SC#10 UAT recipe** (4-axis mandate); the **G-5 hot-file ledger** (`threads.py` firing) + the logged **Phase-163 G-5 override**; cloud-parity standing rule (migs 099–106 + `SECRETS_ENCRYPTION_KEY` owed at next prod push; 163's migs join the pending set).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`current_user_org_ids()` + `current_user_has_permission(org_id, key)`** (mig 104, SECDEF/STABLE/pinned) — the **ready-made org predicate template**, already the workhorse of the 8 org tables' RLS. 163's 38-table rewrite copies `org_id = ANY(current_user_org_ids())`; no new helper needed.
- **The `autofill_org_id_by_owner` / `autofill_org_id_from_parent` INSERT triggers** (mig 104) — `org_id` is **already auto-populated on INSERT** for the 6 stubbed user tables, so the new RLS predicates can trust `org_id` is set (WITH CHECK stays consistent).
- **The asyncpg `SET LOCAL` prototype** (`test_110_dm_schema.py:302-314`) — the exact `acquire()`→`transaction()`→`SET LOCAL ROLE authenticated` pattern to productionize into `get_user_pg_connection` (with the D-02 GUC-variant fix).
- **`agent_loop.py::run_agent_loop`** (Phase 089) — the Deep byte-identical path is already a service module; the Wave-0 extraction does NOT touch it.
- **`run_lifecycle.py`** (`register_run_start` / `finalize_run_terminal`, already extracted) — the producer-shell extraction reuses these; unifying `agent_runner` + `spawn_continuation_run` reconciles their finalize ordering.
- **SEC-01 `enc:v1:` MultiFernet + DB>env `_val` chain** — not directly used here, but the `get_service_role_supabase(org_id)` wrapper mirrors the "refuse-without-explicit-scope" hardening posture.

### Established Patterns
- **RLS-on-every-table + the recursion-safe SECDEF helper** (CLAUDE.md / 161) — the 38-table rewrite is the same predicate shape as the 8 org tables; `org_members`'s locked non-recursive policy (161-D-10) stays untouched.
- **Numbered migrations via SQL editor → regenerate `full-schema.sql` → same-commit**; re-paste-safe idempotency idioms (mig 104/105 style); self-guarded NOT-NULL flip (162 pattern) for the TEN-04 `org_id` backfill.
- **Belt-and-suspenders `.eq("user_id")` filters KEPT** (D-14) — RLS becomes the primary gate, the filters remain a secondary net this milestone.
- **`run_in_threadpool` for blocking supabase-py** (D-v2.5-01) — preserved through the client swap.

### Integration Points
- **Front B seam:** `dependencies.py` gains `get_user_supabase(request)` + `get_user_pg_connection(request)`; routers swap their `Depends(get_supabase)` (517 hits, router-dominant → central); the 100 connectionless `pool.*` calls convert to `acquire()`+`transaction()`.
- **The four async writers** widen `.eq("user_id")` → org-aware via `get_service_role_supabase(org_id)`.
- **TEN-04:** net-new `org_id` column + index on `document_chunks`/`skill_embeddings` + backfill.
- **Downstream this phase decides for:** 164 (needs `document_chunks` `org_id`/RLS live for the INVOKER-caller rewrite + `search_path` pins); 165 (renames `is_global`/`is_system` — 163 uses live names); 166 (`<OrgContext>` + `X-Org-Id` active-org narrowing builds on 163's membership isolation, D-12).

</code_context>

<specifics>
## Specific Ideas

- **"Atomic" is operational, not rhetorical:** author all RLS bundles first (inert under BYPASSRLS), flip the client swap LAST, gate on the live two-user leak test. Never "policies now, client later," never a half-swapped window.
- **The `SET LOCAL ROLE authenticated` — not the claims — is what turns RLS on.** The `postgres`/service-role connection is BYPASSRLS; a claims-only swap is a silent no-op that passes single-tenant tests.
- **Trust the live test over the docs.** The `request.jwt.claims` (JSON) vs `request.jwt.claim.sub` (legacy) GUC choice is explicitly unresolved by documentation — the two-user leak test settles it; set both if in doubt.
- **RLS on `document_chunks` reads the denormalized `org_id`, never a join to `documents`** — a per-row membership join over the pgvector seq-scan is the one thing that breaks CONCUR-01.
- **Membership-set, not active-org, for 163.** Every existing user has exactly one org post-162, so membership isolation == today's behavior; the org switcher is 166.

</specifics>

<deferred>
## Deferred Ideas

- **4 SECDEF functions org-scoping + `_inject_user_id` deletion + `test_v3_4_org_isolation.py` two-org exit suite + SEED-091 owner-UUID nulling** → **Phase 164** (TEN-03/05/06, PRAG-01). 163 only ships the `document_chunks` `org_id`/RLS substrate + pins `search_path` on the two chunk-search fns if it touches them.
- **`is_global` → `is_org_shared` / `is_system` → `is_system_global` value-preserving RENAME** → **Phase 165** (MIG-02). 163 uses the live names (162-D-05).
- **`<OrgContext>` + org switcher + `X-Org-Id` active-org header + custom-access-token JWT-membership hook** → **Phase 166** (D-12). 163 enforces membership-set isolation only.
- **Deleting the 262 `.eq("user_id")` filters** → a later hardening pass (NOT this milestone — D-14 belt-and-suspenders).
- **Permission-aware citations (pgvector+RLS latency/recall benchmark)** → **STRETCH 171** (research-gated; depends on 164 folder-ACL landing).
- **The promote-vs-wave structural commit for the Wave-0 extraction** → **`/gsd:plan-phase 163`** (D-01 — roadmap reserves the renumbering-ripple call for plan-time).

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring.md`** (`todo.match-phase` keyword false-positive — same as 160/161/162 reviewed-and-deferred) — **reviewed, NOT folded.** Concerns NL→visual/no-code workflow authoring ([[SEED-123]], the deferred post-v3.4 UX/no-code track); zero relationship to an RLS/auth/DB-access security phase.

### Reported-bugs cross-check (MANDATORY touchpoint — result)
- **No open `surface: Agentic-RAG` reported-bug folds into Phase 163.** Independently re-checked (163's domain — auth/RLS/DB-access/`send_message`/agent-loop — is broader than the pure-schema 161/162): the **19 open Agentic-RAG reports** are all chat-surface / streaming / provider / workflow-honesty / document-status issues; a keyword sweep for `leak|RLS|auth|cross-user|isolation|permission|tenant` found **zero** genuine cross-user/isolation/auth defects (the two hits were false positives — a pptx/soffice sandbox issue + a stream-connection-saturation bug). Per the ROADMAP guardrail + CLAUDE.md filter rule, the chat-surface backlog stays OUT of v3.4 (its own post-v3.3 chat-polish phase); the one genuine isolation seed **SEED-091 folds into Phase 164** (TEN-06), not here.

</deferred>

---

*Phase: 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux*
*Context gathered: 2026-07-19*
