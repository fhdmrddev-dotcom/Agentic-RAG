# Phase 164: SECDEF Audit + Cross-Org Isolation Test Suite - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning
**Discussion mode:** `--auto` (operator ran unattended — "discuss it, decide the best option, then proceed to planning then execution"). Every gray area was auto-resolved to the safest roadmap-aligned option, each locked by Claude's best judgment against three live code/DB scouts, the v3.4 research base, and the Phase 163 hand-off. **Operator review of this CONTEXT.md is the intended checkpoint before planning.**

<domain>
## Phase Boundary

Phase 164 is the milestone's **verifiable isolation gate** — the phase that proves the RLS/user-JWT machinery landed in Phase 163 actually stops cross-org leakage, and closes the last three bypass classes the crux deliberately deferred to here:

1. **SECDEF audit (TEN-03):** the four `SECURITY DEFINER` retrieval/sharing functions — `match_document_chunks`, `keyword_search_chunks`, `match_skills`, and `folder_is_globally_visible` (→ `folder_is_org_shared` in name intent; **renamed in 165, keep the live name `folder_is_globally_visible` in 164**) — each gain an **explicit in-body org predicate** + a **pinned `search_path`**. The fragile `_inject_user_id` regex (`sql_service.py`) **and** `_inject_user_id_for_grep` (`kb.py`) are **DELETED** (not extended to `org_id`); the text-to-SQL / grep path relies on RLS via the per-request user-JWT client instead.
2. **Cross-org isolation suite (TEN-05):** `test_v3_4_org_isolation.py` — the two-org adversarial exit gate. Extends the Phase 163 fixtures/harness (`test_163_factories.py`).
3. **Permission-aware retrieval (PRAG-01):** hybrid search returns only rows the asking user may access — org- **and** folder-ACL-isolated.
4. **SEED-091 close (TEN-06):** global/org-shared resources (folders / skills / views) null the seeding owner's `user_id` (+ scope UUIDs) for non-owner readers in every list/serialize path.

**In scope:** TEN-03, TEN-05, TEN-06, PRAG-01 — one new migration (next free slot **110**), the retrieval-RPC client swap the crux deferred, the two deletion sites, the three serialize-path fixes, and the exit-gate test suite.

**Out of scope (belongs to later phases — do NOT touch):**
- `is_global` → `is_org_shared` / `is_system` → `is_system_global` **RENAME** → Phase 165 (MIG-02). **164 writes against the LIVE column names `is_global` / `is_system`** (163-D-05 handoff binds this).
- `<OrgContext>` provider + org switcher + the single-active-org `X-Org-Id` narrowing UI → Phase 166. 164 enforces org-**membership** isolation via `current_user_org_ids()`; it only *asserts* that a spoofed `X-Org-Id` cannot widen access.
- Deleting the ~253 `.eq("user_id")` belt-and-suspenders filters → later hardening pass, NOT this milestone (163-D-14).
- Permission-aware *citations* (an answer never citing a doc the user can't open) → STRETCH Phase 171 (PRAG-02). 164 does the retrieval-set isolation (PRAG-01) that 171 builds on.
</domain>

<decisions>
## Implementation Decisions

### SECDEF audit — how the org predicate is derived (the headline decision)

- **D-164-01 — Derive org IN-BODY via `current_user_org_ids()`; do NOT add an explicit `match_org_id` parameter.**
  - **Why this works even inside a `SECURITY DEFINER` function:** `current_user_org_ids()` is itself `SECURITY DEFINER STABLE` and resolves org membership off `auth.uid()` — which reads the `request.jwt.claims` GUC, **not** the executing role. Phase 163 installed that GUC on the per-request user-JWT connection (`SET LOCAL request.jwt.claims` + `SET LOCAL ROLE authenticated`). So the DEFINER body can filter `dc.org_id = ANY (SELECT public.current_user_org_ids())` and it reflects the **caller's** memberships, not the function owner's. (Live-verified defn: `SELECT org_id FROM public.org_members WHERE user_id = auth.uid()`.)
  - **The load-bearing coupling:** this is correct **only if the RPC is invoked on the user-JWT connection.** → see D-164-02.
  - **Rejected — explicit `match_org_id` param:** redundant (membership is already server-derivable), *spoofable by an app-layer bug* (a wrong value passed = silent cross-org read), and inconsistent with the mig-108 RLS model that every base-table policy already uses. The existing `match_user_id` param stays for backward-compat/index shape, but org is **never** a caller-supplied argument.
  - **The predicate keys on LIVE names:** `org_id = ANY(current_user_org_ids())` AND the existing owner/global branch preserved verbatim (`is_global` / `is_system`, not the 165 renames).

- **D-164-02 — Route the three retrieval RPCs through the per-request user-JWT client (the crux deferred these to 164).**
  - `retrieval_service.py:65` (`match_document_chunks`), `:87` (`keyword_search_chunks`), and the `match_skills` call in the skill-catalog/embedding path currently receive a passed-in `supabase` client + explicit `match_user_id`. 163-07 explicitly left "retrieval RPCs to Phase 164." 164 threads the **user-JWT** client to these call sites so `auth.uid()` / `current_user_org_ids()` resolve inside the DEFINER bodies.
  - **Fail-closed property:** if a retrieval RPC is ever accidentally called on a service-role / owner connection, `auth.uid()` is NULL → `current_user_org_ids()` returns empty → **0 rows** (safe: over-restrict, never over-share). The isolation suite asserts this.

- **D-164-03 — Keep all four functions `SECURITY DEFINER`; the "audit" is a recorded per-function justification, not a blanket flip to INVOKER.**
  - Per ROADMAP SC#1 / TEN-03 verbatim: **in-body org predicate + pinned `search_path`**, functions stay DEFINER. The migration records, per function, *why* DEFINER is retained (pgvector index access on the hot path / avoids per-row RLS re-check under the CONCUR-01 <1s gate / stable planning) and that the **in-body predicate is now the isolation guard** + the **pinned `search_path` closes the DEFINER search-path-hijack class** (CVE-class: an attacker-controlled `search_path` shadowing a called object).
  - **`search_path` pin value:** `SET search_path = pg_catalog, public` (or `= ''` with fully-qualified refs) — decide the exact form at plan/research time; the requirement is that it is *pinned and minimal*, and every object reference in the body is schema-qualified (`public.document_chunks`, `public.org_members`).
  - **Rejected — convert the four to `SECURITY INVOKER`:** bigger behavioral change, real pgvector index-scan perf risk under CONCUR-01, and the roadmap already locked DEFINER+predicate. (Contrast: `query_user_documents` is *already* INVOKER — see D-164-04 — so it correctly relies on RLS with no conversion needed.)

- **D-164-04 — Delete `_inject_user_id` + `_inject_user_id_for_grep`; rely on RLS via the user-JWT client for the text-to-SQL / grep path.**
  - Live-verified: `query_user_documents(sql_query text)` is `LANGUAGE plpgsql` with **no SECURITY clause → SECURITY INVOKER**. It `EXECUTE`s the arbitrary text-to-SQL under the **caller's** role. So once its callers (`sql_service.py:106`, `kb.py:263`) run on the **user-JWT client**, RLS on every base table auto-scopes the arbitrary query — the regex injection becomes dead weight. **Deleting the regex is only safe under this condition; the isolation suite must prove text-to-SQL and grep cannot cross orgs.** Verify `query_user_documents`'s callers use the user-JWT client (swap if not); do NOT make it DEFINER.

### TEN-06 / SEED-091 — owner-identity nulling

- **D-164-05 — Null `user_id` (+ scope UUIDs) for non-owner readers on global rows, uniformly across folders + skills + views, in every list/serialize path.**
  - Apply SEED-091's documented minimal fix at each list/serialize path: `if row.is_global and str(row.user_id) != caller: row.user_id = None` (+ `folder_scope = None` for views). Uniform across the three surfaces so the serialization contract can't diverge.
  - **Model change:** `FolderResponse.user_id` is a **required `UUID`** → loosen to `UUID | None`. `ViewResponse.user_id` (`document_view.py:87`) is already `str | None`. `SkillResponse.user_id` (`skill.py`) loosen to `UUID | None`. **Verify the frontend tolerates a null owner** (owner-gated affordances already branch on ownership, so a null non-owned owner is inert) — this is a UI-contract check, flag it for the plan.
  - **Scope note:** the practically cross-org-visible surface *today* is `is_system` platform content (the seeded skill-creator, whose owner = the seeding admin) — 163's FIX-A kept user `is_global` folders/skills/views org-scoped until members arrive (166/167). Nulling on `is_global AND not-owner` fully covers both the system-global leak now and the org-shared case later, so no org-awareness branch is needed in 164.

### TEN-05 / PRAG-01 — the exit-gate suite

- **D-164-06 — `test_v3_4_org_isolation.py` is an exhaustive, data-driven matrix, extending the Phase 163 fixtures.**
  - Reuse `test_163_factories.py` two-user/two-org fixtures + the shared RLS harness. **Matrix (exhaustive, not sampled — it is the milestone exit gate):**
    - **every** user-facing table (drive from a table registry / `information_schema`, ~38 tables) → asserts 0 cross-org rows for user B reading org A's data;
    - **both** DB access paths (asyncpg `SET LOCAL` + supabase-py JWT-header) — mirrors `test_163_leak_asyncpg.py` / `test_163_leak_supabase.py`;
    - **all four** DEFINER functions → 0 cross-org rows;
    - **`X-Org-Id` header-spoof rejection:** a caller setting `X-Org-Id` to a non-member org gets 0 rows (org derives from membership via `current_user_org_ids()`, never from the header — the header is only *narrowing* within real memberships, landing fully in 166);
    - **PRAG-01 live retrieval isolation:** a two-user hybrid-search test proving user B's retrieval never returns user A's chunks — org- AND folder-ACL-scoped (`document_chunks` RLS mirrors the full folder-visibility predicate authored in 163).
  - **The suite must red-then-green:** author at least one assertion that would FAIL against the pre-164 DB (functions still user-only-scoped), so the gate proves it tests something real.

- **D-164-07 — `document_chunks` RLS extends (does not replace) the 163/mig-108 baseline for PRAG-01.**
  - Mig 108 shipped `document_chunks` SELECT as owner-only (`user_id` + `org_id`). PRAG-01 needs it to **mirror the full folder-visibility predicate** (so folder-ACL / shared-folder reads work through retrieval, not just owner reads). Author this as an additive predicate widening in migration 110, keyed on live `is_global` / folder-subtree visibility — and re-benchmark CONCUR-01 <1s (the perf gate stays green; 163 measured 0.41s).

### Migration & process

- **D-164-08 — One new migration, slot 110, applied via the Supabase SQL editor — never `db push` / `db reset`.**
  - Migration `110_secdef_org_scope_audit.sql`: re-CREATE the 4 DEFINER functions (org predicate + pinned `search_path`, schema-qualified bodies) + the `document_chunks` PRAG-01 predicate widening. Apply live by paste, then `bash scripts/regenerate-full-schema.sh` (no reset), commit both in the same commit. `_inject_user_id` deletions + serialize-path fixes + the client-swap + the test suite are code (backend), separate from the SQL.
  - **Cloud parity owed** (do NOT apply to cloud now — operator-gated at next production push): migrations **099–110** + `SECRETS_ENCRYPTION_KEY`, in order.

### Claude's Discretion
- Exact `search_path` pin form (`pg_catalog, public` vs `''`+fully-qualified) — research/plan-time, constrained by D-164-03.
- Test-file organization (one parametrized module vs a small cluster mirroring the `test_163_rls_*` split) — planner's call; must remain a single named exit gate `test_v3_4_org_isolation.py` that the milestone re-runs after 166/167/168.
- Whether the `match_skills` client-swap rides the same helper as the document RPCs or its own seam — planner's call.

### Folded Todos
- **SEED-091** (`.planning/seeds/SEED-091-*.md`) — folded via **TEN-06 / D-164-05**. Its re-open trigger ("any milestone that adds real multi-tenant / org isolation reaches spec") fires exactly here; this is "the cheapest moment to decide it," as the seed states.
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 164 detail (active v3.4 section): Goal, 4 Success Criteria, dependency on 163. **The SC list is the acceptance bar.**
- `.planning/REQUIREMENTS.md` §Tenancy — TEN-03, TEN-05, TEN-06 (lines 27/29/30) + §Permission-Aware Retrieval PRAG-01 (line 34).
- `.planning/seeds/SEED-091-global-resource-owner-identity-disclosure.md` — the owner-identity leak, its minimal fix, and the three affected surfaces (folders/skills/views). Folded via TEN-06.
- `.planning/research/SUMMARY.md` — v3.4 research base (pgvector + RLS; **research flag** on this phase — the planner should spawn `gsd-phase-researcher` for the pgvector-under-RLS perf question + the DEFINER-`current_user_org_ids()`-under-`SET LOCAL` confirmation).

### Prior-phase hand-off (decisions this phase inherits — do NOT re-litigate)
- `.planning/phases/163-rls-rewrite-per-request-user-jwt-client-swap-the-atomic-crux/163-CONTEXT.md` — 163-D-05 (write predicates against LIVE `is_global`/`is_system`; renames are 165), 163-D-08 (live two-user leak test is the arbiter), 163-D-14 (keep `.eq("user_id")` belt-and-suspenders). Explicitly hands the 4 DEFINER fns + `_inject_user_id` deletion + `test_v3_4_org_isolation.py` to 164.
- `.planning/phases/163-.../163-VERIFICATION.md` + FIX-A notes (mig 109) — the `is_system` platform-universal precedent that D-164-05's scope note relies on.

### DB objects the migration rewrites (current definitions)
- `supabase/migrations/073_embedding_provider_and_chunk_tags.sql` — current `match_document_chunks` (user-only `WHERE dc.user_id = match_user_id`, no org predicate, no pinned search_path).
- `supabase/migrations/020_keyword_search_folder_scope.sql` + `025_document_versioning.sql` — current `keyword_search_chunks`.
- `supabase/migrations/091_skill_embeddings.sql` — current `match_skills`.
- `supabase/migrations/019_global_folder_subtree_visibility.sql` — current `folder_is_globally_visible`.
- `supabase/migrations/107_ten04_chunk_embedding_org_id.sql` — the `org_id` column + index on `document_chunks`/`skill_embeddings` the in-body predicate filters on.
- `supabase/migrations/108_rls_membership_rewrite.sql` — the `document_chunks` owner-only SELECT baseline that D-164-07 widens for PRAG-01.
- `supabase/migrations/109_platform_universal_rls_fix.sql` — FIX-A platform-universal (`is_system`) handling; the scope-note precedent for D-164-05.
- `supabase/full-schema.sql` — regenerate (no-reset) after applying migration 110.

### Code the phase edits
- `backend/app/services/sql_service.py:31,106` — `_inject_user_id` (DELETE) + `query_user_documents` caller (ensure user-JWT client).
- `backend/app/api/kb.py:233,263` — `_inject_user_id_for_grep` (DELETE) + its `query_user_documents` RPC caller.
- `backend/app/services/retrieval_service.py:65,87` — `match_document_chunks` / `keyword_search_chunks` callers (thread the user-JWT client — D-164-02).
- `backend/app/services/skill_catalog_filter.py` / `skill_embedding_service.py` / `agent_loop.py:1262` — the `match_skills` retrieval path (user-JWT client).
- `backend/app/services/document_view_service.py:82-101` — view list/serialize (SEED-091).
- `backend/app/utils/folder_utils.py:8,50` — folder list/serialize (SEED-091).
- the global-skills list/serialize path (`skill_tuner_service.py:491` catalog query is owner-scoped; the *serialize* path is where the null-on-non-owner applies) — planner to locate the skills list serializer.
- `backend/app/models/folder.py:23` (`user_id: UUID` → `UUID | None`), `backend/app/models/document_view.py:87` (already `str | None`), `backend/app/models/skill.py:22,44` (→ `UUID | None`).

### Test substrate (extend, don't rebuild)
- `backend/tests/integration/test_163_factories.py` — two-user/two-org fixtures + shared RLS harness.
- `backend/tests/integration/test_163_leak_asyncpg.py` + `test_163_leak_supabase.py` — both-path leak-test patterns the new suite mirrors.
- `backend/tests/integration/test_163_rls_platform_universal.py` — the `is_system`/global-branch assertion pattern.

### Project rules (binding)
- `CLAUDE.md` — migrations via SQL editor only (never `db push`/`db reset`); regenerate `full-schema.sql` no-reset after apply; SC#10 cross-provider mandate; deploy-artifact same-commit rule (migration 110 → check `scripts/check-deploy-drift.sh` / onebox env if it reads a new var — none expected here).
</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`current_user_org_ids()` (mig 104)** — the membership resolver. Already `SECURITY DEFINER STABLE`, reads `auth.uid()`. The single primitive the 4 DEFINER bodies compose with. No new helper needed.
- **Phase 163 user-JWT client factories** (`get_user_supabase` / `get_user_pg_connection`) + `SET LOCAL ROLE authenticated` machinery — already installed; 164 extends their *reach* to the retrieval RPCs, it does not build new plumbing.
- **`test_163_factories.py` + the `test_163_rls_*` / `test_163_leak_*` suite** — the isolation-test scaffolding is done; `test_v3_4_org_isolation.py` is a matrix over it.
- **SEED-091's exact fix snippet** — copy-adaptable to all three serialize paths.

### Established Patterns
- **Additive DEFINER re-CREATE, live column names** — every prior mig (073/091/108/109) re-CREATEs functions with `CREATE OR REPLACE`; 164 follows suit, keying predicates on live `is_global`/`is_system` (163-D-05).
- **Fail-closed org derivation** — over-restrict (0 rows) when identity is absent; never over-share. The whole phase inherits this from 163.
- **Belt-and-suspenders retained** — the ~253 `.eq("user_id")` filters + the new in-body predicate + base-table RLS are three layers; 164 adds the DEFINER-body layer, deletes only the *fragile regex* (which RLS now subsumes).

### Integration Points
- **The DEFINER-body ↔ connection-identity coupling** is the one cross-cutting seam: org-scoping the functions (SQL) is inert unless the retrieval RPCs run on the user-JWT connection (Python). Both halves must land together (mirrors the 163 "atomic crux" shape at a smaller scale). The isolation suite is what proves they landed together.
- **CONCUR-01 <1s perf gate** — the `document_chunks` PRAG-01 predicate widening + org_id-indexed in-body filter must be re-benchmarked before merge (163 baseline 0.41s).
</code_context>

<specifics>
## Specific Ideas

- **Autonomy directive (operator, 2026-07-20):** run 164 end-to-end — discuss → plan → execute — using DB tooling and Chrome as needed; **apply any needed migration directly (SQL editor / psycopg2), but never `db reset` / `db push`** (per CLAUDE.md). This CONTEXT is the pre-plan checkpoint.
- **The phrase to keep honest:** "zero cross-org leakage" is not a claim until `test_v3_4_org_isolation.py` is red-against-pre-164 then green-against-164. Author the red case deliberately (D-164-06).
- **Naming:** 164 uses LIVE names `is_global` / `is_system` / `folder_is_globally_visible`; the `is_org_shared` / `is_system_global` / `folder_is_org_shared` renames are Phase 165's job. Do not pre-rename.
</specifics>

<deferred>
## Deferred Ideas

- **Deleting the ~253 `.eq("user_id")` filters** — later hardening pass, not this milestone (163-D-14 belt-and-suspenders).
- **Permission-aware *citations*** (an answer never citing/previewing a doc the user can't open) — STRETCH Phase 171 (PRAG-02); 164 delivers the retrieval-set isolation (PRAG-01) it depends on.
- **The single-active-org `X-Org-Id` narrowing UI + `<OrgContext>` switcher** — Phase 166. 164 only asserts spoofed `X-Org-Id` cannot widen access.
- **`is_global`→`is_org_shared` rename + `is_system_global` allow-list** — Phase 165 (MIG-02).
- **Chat-surface reported-bug backlog** (BUG-260708-01/-02, 260714-01, 260718-02/-03/-04, etc.) — the roadmap keeps these OUT of v3.4; they belong to the separate post-v3.3 chat-polish phase. Cross-checked at this discuss touchpoint: **no open `surface: Agentic-RAG` bug overlaps 164's security-isolation domain; SEED-091 is the only fold.**

### Reviewed Todos (not folded)
None — no pending-todo matches for phase 164.
</deferred>

---

*Phase: 164-secdef-audit-cross-org-isolation-test-suite*
*Context gathered: 2026-07-20*
