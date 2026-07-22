# Phase 163: RLS Rewrite + Per-Request User-JWT Client Swap — THE ATOMIC CRUX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-19
**Phase:** 163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux
**Mode:** `--auto` (unattended — operator instructed Claude to select every option autonomously and comprehensively). No `AskUserQuestion` prompts were shown; each gray area was auto-selected against the research base, the 160/161/162 handoffs, and three live read-only code scouts (`dependencies.py` Front-B seams, `threads.py` structure, live RLS/SECDEF/pgvector schema). This log records the alternatives that were on the table and why each was chosen.
**Areas discussed (auto-selected — all):** threads.py Wave-0 extraction (promote-vs-bundle), asyncpg SET LOCAL mechanism, supabase-py user-JWT client, JWT verification strategy, service-role retention split, RLS predicate rewrite (shape/bundling/flip-order), TEN-04 pgvector org_id/index/benchmark, live two-user leak-test gate, SC#10 + Deep byte-identical, nullable-org_id/Redis, org-context source (membership vs active-org), 4-tier deployment contract.

---

## threads.py Wave-0 extraction — promote to own phase vs bundle as a wave

| Option | Description | Selected |
|--------|-------------|----------|
| Bundle as Wave 0 of 163 | Keep 160–168 numbering; extract inside the crux phase as its first wave | |
| Promote to a dedicated refactor phase | Extraction becomes its own phase; crux shifts to 163.1, STRETCH 169–173 renumber | ✓ (provisional lean) |
| Defer the structural call to plan-time | Lock the hard safety gate now; final promote-vs-wave commit at `/gsd:plan-phase 163` | ✓ (binding) |

**Choice:** Lock the **hard gate** (extraction proves Deep byte-identical + tests green BEFORE any `org_id` touches `send_message`) as non-negotiable now; **provisionally lean PROMOTE**; final structural commit reserved for plan-time.
**Notes:** Scout measured `threads.py` at **2,444 LOC** (roadmap said ~1,850). Key de-risking finding: the Deep byte-identical red line was **already extracted in Phase 089** to `agent_loop.py` — so Wave 0 is a producer-shell + finalize-ordering refactor (~1,100–1,400 LOC / 4 modules), not a streaming-path rewrite. Scout recommended a standalone phase (invariant-dense `_shielded_finalize` + `spawn_continuation_run` unification deserves isolated testing). The roadmap **explicitly reserves** the promote-vs-wave call (and its renumbering ripple) for `/gsd:plan-phase 163` where size is measurable — honored. STATE.md logs the operator's roadmap-time lean (bundle-now / decide-at-plan-time); the new measured evidence is recorded for the plan-checker.

## Front B — asyncpg per-request RLS mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| `SET LOCAL request.jwt.claims` + `SET LOCAL ROLE authenticated` per transaction, existing pool | Research-recommended; role switch is load-bearing | ✓ |
| Second pool / pgbouncer tenancy layer | New infra for per-request role | (rejected — research "what NOT to use") |
| Claims-only, no role switch | Set claims but keep `postgres`/BYPASSRLS role | (rejected — silent no-op) |

**Choice:** `SET LOCAL ROLE authenticated` + claims, on the existing `get_pg_pool` (no new pool), via a `get_user_pg_connection(request)` context-manager.
**Notes:** The DSN role is `postgres`/BYPASSRLS — **the role switch, not the claims, turns RLS on**. Scout surfaced the load-bearing gotcha: the existing prototype (`test_110_dm_schema.py:302-314`) sets the legacy `request.jwt.claim.sub` GUC but `auth.uid()` reads JSON `request.jwt.claims` — the live leak test settles which to set (or set both). The 100 connectionless `pool.*` calls must convert to explicit `acquire()`+`transaction()`.

## Front B — supabase-py per-request user-JWT client

| Option | Description | Selected |
|--------|-------------|----------|
| `get_user_supabase(request)` factory (JWT-header / `postgrest.auth`) | Per-request client bound to the caller's JWT | ✓ |
| Keep the service-role singleton everywhere | Status quo | (rejected — the leak) |

**Choice:** Per-request user-JWT client, central swap at the router `Depends` seam (`get_supabase` is router-dominant, 517 hits/98 files).
**Notes:** Ergonomics MEDIUM-confidence (research) → benchmarked with TEN-04. `run_in_threadpool` discipline (D-v2.5-01) preserved.

## Front B — JWT verification strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Local JWKS/ES256 via PyJWT `PyJWKClient` | Drops the per-request GoTrue round-trip; yields the claims dict for SET LOCAL | ✓ |
| Keep `supabase.auth.get_user(token)` GoTrue round-trip | Status quo (`dependencies.py:136`) | (rejected — latency + no claims dict) |

**Choice:** Local JWKS verify (PyJWT, promoted to explicit pin), GoTrue fallback on JWKS fetch failure.
**Notes:** Two wins — removes a per-request network hop (helps CONCUR-01) and produces the claims dict the asyncpg `SET LOCAL` needs. 0–1 new hard dep (PyJWT already transitive).

## Service-role retention split

| Option | Description | Selected |
|--------|-------------|----------|
| `get_service_role_supabase(org_id)` — refuses without explicit org; 4 async writers + cross-tenant ops only | Hardened, org-aware filters widen | ✓ |
| Swap everything to user-JWT | No service-role anywhere | (rejected — agent/eval/harness/re-embed have no `auth.uid()`) |

**Choice:** Hardened wrapper for agent_loop / eval_runner / harness_engine / reembed + SSO-JIT/org-admin; those keep service-role but widen `.eq("user_id")` → org-aware; the 262 filters stay as belt-and-suspenders.
**Notes:** Scout confirmed the 4 writers run without `auth.uid()` (BYPASSRLS regardless) → they need org-aware WHERE filters, not `request.jwt.claims`.

## Front A — RLS predicate rewrite (shape / bundling / flip order)

| Option | Description | Selected |
|--------|-------------|----------|
| Membership template + preserve global branches, ~6 clusters, flip client LAST | `org_id = ANY(current_user_org_ids()) AND (...)`; predicates inert until swap | ✓ |
| Flip client per-cluster | Swap as each bundle lands | (rejected — half-swapped window) |
| Rewrite against forward names `is_org_shared`/`is_system_global` | Use 165's target names now | (rejected — 162-D-05 binds live names) |

**Choice:** Copy the org-table template, preserve `is_global`/`folder_is_globally_visible()` OR-branches, use **live column names**, ~6 reviewable bundles (documents/chat/skills/DM/workflow-eval/identity-audit), **author all bundles first (inert under BYPASSRLS) then flip the swap last** with the leak test as go/no-go.
**Notes:** Scout: zero policies read `org_id` today; 135 policies / 48 RLS tables / 14 SECDEF fns (drifted from research's 110/103-head → re-verify). Quoted policy names on the 6 user tables → exact `DROP POLICY "..."`.

## TEN-04 — pgvector hot-path org_id + index + benchmark

| Option | Description | Selected |
|--------|-------------|----------|
| Denormalize org_id on both tables + backfill + benchmark-driven index; RLS reads org_id directly | Filter on denormalized column, gate on CONCUR-01 | ✓ |
| RLS joins `document_chunks` → `documents` for org | No new column | (rejected — per-row join over pgvector seq-scan breaks <1s) |

**Choice:** Add + backfill `org_id` on `document_chunks` + `skill_embeddings` (both had none — deferred here by mig 104:442-443); index shape (composite/partial/pre-filter) **decided by benchmark**; RLS filters the denormalized column; **CONCUR-01 <1s GREEN before merge**.
**Notes:** `document_chunks` = HNSW(m=16) + GIN, no user_id btree; `skill_embeddings` = btree(user_id), no ANN. Highest-risk item in the phase.

## The research-phase gate — live two-user leak test

| Option | Description | Selected |
|--------|-------------|----------|
| Mandatory live two-user leak test (both DB paths), `--research-phase` | Do not ship on docs alone | ✓ |
| Ship on documentation + unit tests | Trust the SET LOCAL docs | (rejected — MEDIUM-confidence semantics) |

**Choice:** `/gsd:plan-phase 163 --research-phase`; live 2-user × 2-org test proving B can't read A across supabase-py + asyncpg; arbiter of the D-02 GUC-variant question. Operator-run (backend + real second user).
**Notes:** Distinct from 164's full `test_v3_4_org_isolation.py` exit suite; 163's is the focused crux-enablement proof.

## SC#10 + Deep byte-identical / nullable-org_id + Redis / org-context source / 4-tier contract

| Area | Auto-decision | Selected |
|--------|-------------|----------|
| SC#10 + red line | Org context rides the REQUEST seam only, never the provider/gateway path; SC#10 4-axis UAT + leak test are the bars | ✓ |
| Nullable-org_id + Redis | RLS predicates handle `org_id IS NULL` explicitly (162-D-11); `runs.org_id` at creation; Redis org-scoped via the runs row | ✓ |
| Org-context source | Enforce via `auth.uid()` → `current_user_org_ids()` (membership set); **defer** JWT-membership hook + `X-Org-Id` active-org to 166 — shrinks the crux blast radius (every existing user has one org post-162) | ✓ |
| 4-tier deployment contract | Nothing 163 ships makes any tier harder; the swap works identically isolated (one org) and co-tenant; pure env-var, no fork (ADR D-v3.4-01 SC#4 / D-14) | ✓ |

**Notes:** The membership-vs-active-org call (D-12) is a deliberate blast-radius shrinker — `current_user_org_ids()` already reads `org_members` live, needing only the standard `sub` claim; the JWT-membership optimization can be pulled forward only if the D-07 benchmark shows the per-query join threatens CONCUR-01.

## Claude's Discretion

- Exact extraction module names/boundaries; exact TEN-04 index names/shapes (benchmark-driven); per-cluster bundle membership; procedure/constraint names.
- Final GUC-variant choice (`request.jwt.claims` vs also-`request.jwt.claim.sub`) — pending the live leak test; both-forms acceptable default.
- Migration slot(s) — verify at plan time (161→104, 162→105+106 → likely 107+).

## Deferred Ideas

- 4 SECDEF fns org-scoping + `_inject_user_id` deletion + two-org exit suite + SEED-091 → **Phase 164**.
- `is_global`/`is_system` RENAME → **Phase 165** (163 uses live names).
- `<OrgContext>` + org switcher + `X-Org-Id` + JWT-membership hook → **Phase 166**.
- Deleting the `.eq("user_id")` filters → later hardening pass (not this milestone).
- Permission-aware citations (pgvector+RLS benchmark) → **STRETCH 171**.
- Promote-vs-wave structural commit for Wave 0 → **`/gsd:plan-phase 163`**.
- `spike-nl-workflow-authoring.md` todo — reviewed, NOT folded (keyword false-positive; [[SEED-123]] post-v3.4 track), matching 160/161/162.
- Reported-bugs: no open `surface: Agentic-RAG` bug folds into 163 (independently re-checked; chat-surface backlog stays OUT per ROADMAP guardrail; SEED-091 → 164).
