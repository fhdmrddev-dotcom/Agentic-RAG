# Phase 165: `is_global` Retirement Cleanup - Context

**Gathered:** 2026-07-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Phase 165 retires the legacy single-tenant `is_global` visibility flag and closes the last folded cross-org leak. Two intertwined deliverables:

1. **The rename (MIG-02):** value-preservingly `RENAME` `is_global` to its correct post-org name — a **semantic split**: `is_org_shared` where the flag is a genuine user org-share toggle (folders, skills), `is_system_global` where the flag is only ever platform-seed content (workflow_definitions, document_views, classification_rules, metadata_field_definitions). Propagate the rename through SQL columns, RLS policies (incl. the mig-109 platform branches), the `folder_is_globally_visible` → `folder_is_org_shared` DEFINER function, the Storage `skill-files` bucket policy, backend code, the API wire contract, the frontend, and UI copy ("Global" → "Shared with org"). The seeded `skill-creator` stays cross-org visible via the **unchanged** write-locked `skills.is_system` marker; the 15 seeded starter/harness/eval workflows stay cross-org visible by construction (their column is renamed `is_system_global`, still write-locked).

2. **The folded security fix (SC#4 / [[SEED-124]] — CR-01 + WR-01, MUST close here):** org-scope the `folder_utils.py` visibility helpers so the agent's **service-role** KB browse/read tools (`ls` / `tree` / `read_document` / `fetch_document_file`) can no longer enumerate or read documents in another org's `is_org_shared` folders. Verified by flipping the `xfail(strict=True)` marker `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` in `test_v3_4_org_isolation.py` to XPASS, then removing it.

**In scope:** MIG-02 rename (6 tables + policies + DEFINER fn + storage policy + trigger + code + wire + UI copy); the `folder_utils.py` org-scoping (CR-01); descendant owner-nulling (WR-01); the xfail-marker flip + exit-gate re-green.

**Out of scope (later phases — do NOT touch):**
- `<OrgContext>` provider / org switcher / `X-Org-Id` active-org narrowing → Phase 166.
- Making views / classification-rules / metadata-fields **user-org-shareable** → future capability (see Deferred Ideas), NOT this phase. This phase locks them as platform-seed-only (`is_system_global`).
- Deleting the ~253 `.eq("user_id")` belt-and-suspenders filters → later hardening pass (163-D-14).
- Permission-aware citations → STRETCH Phase 171 (PRAG-02).

</domain>

<decisions>
## Implementation Decisions

### The rename split (D1 — the load-bearing decision)

- **D-165-01 — Semantic-split, pure value-preserving `RENAME` (never drop+add).** The post-org name follows what the flag *actually means* per table:
  - `folders.is_global` → **`is_org_shared`** (genuine user org-share toggle; live: 1 row).
  - `skills.is_global` → **`is_org_shared`** (genuine gated user org-share toggle; live: 1 row).
  - `workflow_definitions.is_global` → **`is_system_global`** (platform-universal only — users are write-locked out; live: **15 seeded** rows).
  - `document_views.is_global` → **`is_system_global`** (platform-seed only, write-locked; live: 0 rows).
  - `classification_rules.is_global` → **`is_system_global`** (platform-seed only, write-locked; live: 0 rows).
  - `metadata_field_definitions.is_global` → **`is_system_global`** (platform-seed only, write-locked; live: 0 rows).
  - **Why the split, not uniform `is_org_shared`:** on the four write-locked tables the mig-108/109 INSERT/UPDATE write checks hard-set `is_global=false` for authenticated writers, so `is_global=true` there is *only ever* seed/service-role platform content that mig 109 makes cross-org-universal. Uniform `is_org_shared` (org-scoped) would regress the 15 seeded workflows to the seed org (the exact mig-109 Test-7 bug). The split keeps them universal **by construction** with zero data movement.
  - **Operator-ratified deviation:** 160-ADR §2 says "`is_global` → `is_org_shared` everywhere." Operator ratified the split at discuss-time (2026-07-20) — it honors the ADR's *spirit* (each flag gets its correct post-org name) while closing the gap the ADR's model missed (it assumed the skill-creator was the only cross-org row; it predates mig-109's 15 universal workflows).

- **D-165-02 — `skills.is_system` keeps its physical column name (NOT renamed to `is_system_global`).** ADR §1 says "reuse `is_system` under the name `is_system_global`." Operator ratified keeping the physical column `is_system` because it is load-bearing in hot, security-sensitive wiring — the `load_skill` name-collision tie-break (`tool_dispatcher.py`, SEED-102), the mig-109 badge-spoof WITH-CHECK, and skill-creator seeding (mig 087). A rename there is pure risk for zero behavior change. **`is_system` IS the skills allow-list** (document this at the code + RLS seams). Net effect: `is_system_global` appears as a **column name only on the four write-locked tables**; skills' universal marker stays `is_system`.

- **D-165-03 — RLS + mig-109 branches follow the new names.** Re-CREATE the affected SELECT policies keying the universal branch on the renamed column: `is_system_global=true` (workflow_definitions / document_views / classification_rules / metadata_field_definitions), `is_system=true` (skills — unchanged), and the org-gated branch on `is_org_shared` (folders/skills). Preserve the mig-109 platform-out-of-the-org-gate shape verbatim; only the column names change. Keep the badge-spoof/write-lock WITH-CHECKs (`is_system=false` on skills; the four tables' `is_system_global` stays write-locked to migration/service-role by keeping their authenticated-writer write check forcing it false).

### folder_utils.py cross-org security fix (D2 — SC#4 / SEED-124)

- **D-165-04 — Org-aware helpers on the service-role path (the load-bearing fix).** The browse/read tools run in the producer on `ctx.supabase = get_supabase()` (service-role **BYPASSRLS**), so RLS cannot scope them — the fix must live in the helpers:
  - `fetch_all_folders` selects `org_id` in its field list.
  - Resolve the **caller's** org set once per call (`SELECT org_id FROM org_members WHERE user_id = <caller>`), threaded from the tool's `user_id`.
  - `is_in_global_subtree` / `fetch_visible_folders` / `get_globally_visible_folder_ids` treat a folder as org-shared-visible **iff** its `org_id ∈ caller_org_ids` (folders have no `is_system`/platform-universal branch — that's skills-only per SEED-124). Load-bearing on the service-role producer path; belt-and-suspenders on the already-RLS-scoped request path.
  - Fail-closed: caller with no resolvable org set → empty → 0 shared folders visible (over-restrict, never over-share) — mirrors 164's fail-closed org derivation.

- **D-165-05 — WR-01: null the seeder's `user_id` on any non-owned visible folder.** In the folders list/serialize path, null `user_id` for **any** folder the caller sees but does not own — whether the folder is `is_org_shared` itself **or** a non-shared descendant visible via a shared ancestor. This broadens `_null_foreign_global_owner`'s current "row is `is_global`/`is_system`" rule (which misses subtree descendants). Same serialize-time projection ("RLS gates rows, not columns").

### Wire / frontend boundary (D3)

- **D-165-06 — Full end-to-end rename; land as ONE operator-applied migration + ONE commit.** DB columns + API response fields + frontend props all follow the DB: `isOrgShared` on folder/skill toggle props; `isSystemGlobal` display-only on workflows/views. Rename the `folder_is_globally_visible` DEFINER fn → `folder_is_org_shared` (its caller = the documents RLS policy; update in the same migration). Because DB + backend + frontend ship together in one operator-applied migration + commit (local dev), there is no partial-deploy window where old code reads a renamed column.

### UI copy + pre-166 honesty (D4)

- **D-165-07 — Keep the org-share toggle functional; relabel "Global" → "Shared with org" on the folder + skill toggles.** No special-casing of solo orgs — forward-correct for when orgs gain members (166/167). Honest today (it *is* shared with your org, which currently happens to be just you). **No silent un-share by construction:** the rename is value-preserving, and mig 108/109 already org-scoped user `is_global` folders/skills back in Phase 163 — so 165's rename is *cosmetic on visibility* for those rows.

### Claude's Discretion (planner / researcher)
- Migration packaging (one migration file vs a small reviewable bundle) — the 165 surface is moderate; one migration is expected but the planner may split if clearer.
- Exact frontend prop/badge treatment for the display-only `is_system_global` surfaces (workflows/views seeded badges) vs the functional `is_org_shared` toggles (folders/skills).
- Whether the Storage `skill-files` bucket policy's universal branch keys on `is_system` (skill-creator files) and/or the renamed `is_org_shared` — confirm against the mig-109 `skill_files` table-RLS shape (it has both an `is_system` universal branch and an `is_global` org-gated branch; the storage policy currently only checks `s.is_global = true` — planner reconciles).
- Whether the exit-gate + other tests reference the live `is_global` column names literally (update to the split names) or assert via behavior — audit at plan time.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase scope & requirements
- `.planning/ROADMAP.md` — Phase 165 detail (active v3.4 section): Goal + 4 Success Criteria (SC#4 is the folded SEED-124 fix). **The SC list is the acceptance bar.**
- `.planning/REQUIREMENTS.md` — MIG-02 (the value-preserving RENAME + `is_system_global` allow-list).
- `.planning/seeds/SEED-124-browse-tool-service-role-cross-org-folder-leak.md` — CR-01 (the service-role browse-tool leak) + WR-01 (descendant owner disclosure) + the exact recommended fix. Folded via SC#4.

### Naming locks (binding, do NOT re-derive)
- `.planning/phases/160-tenancy-model-adr/160-ADR.md` §2 (Binding Naming Locks) — `skills.is_system → is_system_global` reuse (§1) + `is_global → is_org_shared` value-preserving rename (§2). **165 ratifies two operator-approved deviations** (D-165-01 split; D-165-02 keep `is_system` column name) — record them, do not silently re-litigate.
- `.planning/phases/163-.../163-CONTEXT.md` — 163-D-05 (163/164 wrote against LIVE `is_global`/`is_system`; 165 is the atomic rename), 163-D-14 (keep `.eq("user_id")` filters). 162-D-05 (global/system rows live in the owner's personal org — no synthetic system org).
- `.planning/phases/164-.../164-CONTEXT.md` — 164 kept live names + flagged `folder_is_globally_visible` "renamed in 165"; D-164-05 owner-nulling precedent (`_null_foreign_global_owner`) that WR-01 extends.

### DB objects the migration rewrites (current definitions)
- `supabase/migrations/109_platform_universal_rls_fix.sql` — the 7 SELECT policies whose universal branch keys on `is_global`/`is_system` today (workflow_definitions/document_views/classification_rules/metadata + skills/skill_files/tuner_runs), and the 2 skills write-check hardenings. **The single most important file to mirror-with-renamed-columns.**
- `supabase/migrations/108_rls_membership_rewrite.sql` — the base membership SELECT/INSERT/UPDATE policies + the `is_global=false` write-locks on the four tables (the reason those tables' `is_global` is platform-only).
- `supabase/migrations/019_global_folder_subtree_visibility.sql` — current `folder_is_globally_visible` DEFINER fn (→ rename `folder_is_org_shared`).
- `supabase/migrations/014_folders.sql` / `017_skills.sql` / `056_workflow_definitions.sql` / `071_dm_foundations.sql` — the `is_global` column definitions being renamed.
- `supabase/full-schema.sql` — the live storage `skill-files` bucket policy (`s.is_global = true` branch, ~line 5720) + the re-embed trigger referencing `is_global` (~line 548); regenerate no-reset after applying the migration.

### Code the phase edits
- `backend/app/utils/folder_utils.py` — the 4 helpers to org-scope (D-165-04) + `_null_foreign_global_owner` broaden (D-165-05).
- `backend/app/api/kb.py` + `backend/app/services/tool_dispatcher.py:223-255` — the browse/read tool dispatch that consumes the helpers (thread `user_id` → caller-org resolution).
- `is_global` occurrences (rename): backend `app/api/{folders,skills,documents,document_views,classification_rules,metadata_fields,workflows,kb,skill_tuner}.py`, `app/models/{folder,skill,document_view,classification_rule,metadata_field,kb}.py`, `app/services/{agent_loop,tool_dispatcher,openai_service,classification_matcher,classification_rule_service,document_view_service,document_relationship_service,embedding_service,metadata_field_service,publish_gate_service,skill_tuner_service,workflow_authoring,workflow_kickoff}.py`, `app/services/harness/skill_snapshot.py`, `app/db/workflows.py`, `app/main.py`.
- Frontend (rename props + copy): `frontend/src/components/ingestion/{FolderCreateInput,FolderDetail,FolderNode,FolderTree,ViewsGroup}.tsx`, `frontend/src/components/skills/{SkillCard,SkillFormDialog}.tsx` (+ their `.test.tsx`), `tuner/CaseEditor.tsx`.

### Test substrate
- `backend/tests/integration/test_v3_4_org_isolation.py` — the milestone exit gate; contains `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` (`xfail(strict=True)`) to flip → XPASS → remove. Keep the suite green (22 passed / 1 xfailed → 23 passed once flipped+removed).
- `backend/tests/integration/test_163_factories.py` — two-user/two-org fixtures the browse-leak test drives.

### Project rules (binding)
- `CLAUDE.md` — migrations via SQL editor only (never `db push`/`db reset`); `scripts/regenerate-full-schema.sh` no-reset after apply, commit migration + full-schema together; deploy-artifact same-commit rule (this migration = schema-only rename, seeds no reference data / no env var → no `docs/OPERATOR.md` / `check-deploy-drift.sh` change expected, like migs 108/109). Deep Mode byte-identical (D-14).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`current_user_org_ids()` (mig 104)** — the membership resolver used by every org-gated RLS branch; the folder-visibility helpers can resolve the caller's org set with the same `org_members`-off-`user_id` query it wraps (D-165-04).
- **`_null_foreign_global_owner` (`folder_utils.py`, D-164-05)** — the serialize-time owner-nulling helper; WR-01 broadens its predicate rather than adding a new mechanism.
- **mig 109's platform-out-of-the-org-gate policy shape** — copy-with-renamed-columns; the RLS logic doesn't change, only `is_global`→`is_system_global` / (skills) stays `is_system`.
- **The `xfail(strict)` known-open marker** — already installed in the exit gate; flipping to XPASS is the built-in acceptance signal.

### Established Patterns
- **Value-preserving DDL RENAME** — `ALTER TABLE ... RENAME COLUMN` keeps the data + defaults + NOT NULL; the RLS/policy/function/storage edits are `DROP POLICY … CREATE` / `CREATE OR REPLACE` re-paste-safe DDL (Postgres has no create-or-replace for policies). One `BEGIN…COMMIT` atomic apply.
- **Fail-closed org derivation** — absent identity → 0 rows; inherited from 163/164.
- **Belt-and-suspenders** — request path already RLS-scoped (user-JWT); the helper fix is the load-bearing layer on the service-role producer path + a redundant guard on the request path.

### Integration Points
- **The service-role browse path is the one seam RLS never covered** — retrieval RPCs were swapped to the user-JWT client in 164, but `ls`/`tree`/`read_document` stayed on `get_supabase()` (BYPASSRLS). This phase closes that specific gap in the helpers (no client swap — the subtree-descendant-visibility algorithm needs to see non-shared descendants that a user-JWT RLS read would hide).
- **DB ⇄ wire ⇄ frontend rename must land together** (one migration + one commit) — no partial-deploy window (D-165-06).

</code_context>

<specifics>
## Specific Ideas

- **The phrase to keep honest:** SC#4 is only closed when `test_browse_tools_cross_org_leak_KNOWN_OPEN_seed124` flips xfail→XPASS **and** is removed (leaving the assertion as a normal passing test). Don't declare the leak closed on code inspection alone — the two-org drive is the arbiter.
- **Live stakes snapshot (2026-07-20, local DB):** folders `is_global`=1/9, skills `is_global`=1/7 + `is_system`=1/7, workflow_definitions `is_global`=**15**/69, document_views/classification_rules/metadata `is_global`=0. The 15 workflows are the regression risk the split protects.
- **Two ADR deviations are operator-ratified** (D-165-01 split, D-165-02 keep `is_system`) — the planner cites this CONTEXT, not the ADR literal, for these two points.

</specifics>

<deferred>
## Deferred Ideas

- **User-org-shareable views / classification-rules / metadata-fields** — D-165-01 locks these four write-locked tables as platform-seed-only (`is_system_global`). If the product later wants users to *org-share* views/rules/metadata (the way folders/skills work), that's a **new capability**: add a separate `is_org_shared` column to those tables + unlock the write path + UI toggle. Re-open trigger: a product decision (likely alongside 166/167 when orgs gain members) that users should org-share saved views. (Note: v3.0 VIEW-05 shipped "leak-safe global sharing" for views, but mig 108 write-locked it to false — this deferred item is the path to reviving it org-scoped.)
- **Deleting the ~253 `.eq("user_id")` belt-and-suspenders filters** — later hardening pass, not this milestone (163-D-14).
- **`<OrgContext>` / org switcher / `X-Org-Id` narrowing** — Phase 166.

### Reviewed Todos (not folded)
None — no pending-todo matches for phase 165.

</deferred>

---

*Phase: 165-is-global-retirement-cleanup*
*Context gathered: 2026-07-20*
