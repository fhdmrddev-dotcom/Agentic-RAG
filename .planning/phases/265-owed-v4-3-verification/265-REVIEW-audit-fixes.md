---
target: audit-fixes
reviewed_range: [c28853142, f34106d5a, ad093fd4a, c6e29b42e, e4ac67ff9, 124dc444b, 856c09ea0, cdf3a308a]
reviewer_inputs:
  - .planning/milestones/v4.3-MILESTONE-AUDIT.md
  - .planning/STATE.md (rows OV-v43-G5-01..05 only, via grep)
  - git show / git show --stat for the 8 commits above
  - backend/app/services/entitlement_service.py
  - backend/app/services/scheduler_service.py
  - backend/app/services/workflow_kickoff.py
  - backend/app/services/harness/publish_service.py (golden-run create_workflow_run site only)
  - backend/app/api/threads.py (send_message org stamp; rename_thread expert activation)
  - backend/app/dependencies.py (get_active_org_id, resolve_active_org_or_none, resolve_caller_role)
  - backend/app/services/pricing_service.py
  - backend/app/db/rates.py
  - backend/app/db/entitlements.py (grep only)
  - backend/app/services/tool_dispatcher.py (_document_folder_ids, _doc_out_of_scope, _fetch_owned_document_bytes)
  - backend/app/api/schedules.py
  - backend/app/api/workflows.py (route table + validate route)
  - backend/app/api/runs.py (grep of write routes)
  - backend/app/api/experts.py
  - backend/app/db/experts.py
  - backend/app/services/expert_service.py
  - backend/app/services/run_producer.py
  - backend/tests/unit/test_258_workflow_execution_entitlement.py
  - backend/tests/unit/test_198_node_vocabulary.py (diff)
  - backend/tests/unit/test_scheduler_string_guard.py (diff)
  - backend/tests/unit/test_257_single_token_conversion_home.py
  - backend/tests/unit/test_262_folder_scope_wall.py
  - backend/tests/unit/test_258_every_authoring_write_is_tier_gated.py
  - backend/tests/unit/test_103_nl_generate.py (diff)
  - backend/tests/unit/test_workflow_scheduler.py (diff)
  - backend/tests/unit/test_261_role_grants_reach_the_check.py
  - supabase/migrations/186_tier_capabilities.sql (grep)
  - supabase/migrations/192_revoke_anon_tier_capabilities.sql
  - supabase/full-schema.sql (diff)
  - scripts/full-schema-supplement.sql (diff)
  - scripts/vitest-count-gate.cjs (diff)
  - frontend/src/lib/api/_core.ts
  - frontend/src/lib/api/threads.ts
  - frontend/src/lib/api/workflows.ts
  - frontend/src/lib/api/schedules.ts
  - frontend/src/lib/api/__tests__/entitlementRefusal.test.ts
  - frontend/src/lib/api/__tests__/noFrontendTokenPricing.fence.test.ts
  - frontend/src/landing/facts.ts (diff)
  - frontend/src/landing/__tests__/facts.test.ts (diff)
  - frontend/src/components/org/OrgAdminShell.tsx (TABS)
  - frontend/src/components/org/OrgExpertsTab.tsx (diff)
  - frontend/src/components/experts/ExpertAuthoringStudio.tsx (diff)
  - frontend/src/components/experts/__tests__/OrgExpertsTab.test.tsx (diff)
independent_review: partial — fresh-context claude subagent (operator decision D-265-01)
findings_total: 13
confirmed: 11
plausible: 2
---

# Review — audit-fixes

Worktree `rev265-audit-fixes`, HEAD asserted `ca33dd9bb5ecc3e5babc2be92d761028f6b5f881`. Every plant was
reverted with `git checkout -- <path>` (or the scratch probe file deleted); `git status --porcelain` is clean.
DB access was local `127.0.0.1:54322`, read-only SELECTs only (one `EXPLAIN` inside a `READ ONLY`
transaction that was rolled back). No Supabase MCP call was made.

## Findings

| id | severity | file:line | claim | drive (command → observed) | status |
|---|---|---|---|---|---|
| R265-audit-fixes-01 | blocker | `public.organizations` grants + policy `organizations_update` (outside the 8 diffs; column from mig 104) | **Any org admin can raise their own tier, which gets around every gate these fixes add.** `authenticated` holds column UPDATE on `organizations.subscription_tier` and `add_ons`. The `organizations_update` policy admits anyone with `org:manage` on the org, and no trigger protects either column. A Standard org's admin can `PATCH /rest/v1/organizations?id=eq.<own org>` `{"subscription_tier":"enterprise"}` (or add an `add_ons` grant), and `check_entitlement` then admits them to workflows and Experts. The bug predates these commits, but c28853142 and 124dc444b rely on this column as the thing that decides access. | venv asyncpg, local: `has_column_privilege('authenticated','public.organizations','subscription_tier','UPDATE')` → `True`; same for `add_ons` → `True`; `pg_policies` → `organizations_update UPDATE ['authenticated'] qual current_user_has_permission(id,'org:manage')`; `pg_trigger` (non-internal) → `[]`; `SET LOCAL ROLE authenticated; EXPLAIN UPDATE public.organizations SET subscription_tier='enterprise' …` in a READ ONLY txn → `Update on organizations (cost=8.03..24.50 …)` (no permission error) | CONFIRMED |
| R265-audit-fixes-02 | major | `backend/app/services/expert_service.py:398-430`, `backend/app/db/experts.py:147-165`; UI `frontend/src/components/org/OrgExpertsTab.tsx` (cdf3a308a) | **The new Disable toggle (PACK-07) sets a flag that nothing enforces.** `is_enabled` is only a list filter (`enabled_only`). `get_expert_bundle_by_id` does not check it, and neither `get_expert_service` (the activation check in `PATCH /threads/{id}`) nor `resolve_expert_bundle` (the run-time check in `_resolve_thread_scoping`) does either. A disabled Expert can still be activated by id, and it keeps running in every thread where it is already active. The claim "an Expert can be disabled from the app" does not hold at run time. | stub drive: patch `experts_db.get_expert_bundle_by_id` → bundle `{is_enabled: False, visibility:'org'}`; `resolve_expert_bundle(...)` → `resolved for is_enabled=False bundle: True True`; `get_expert_service(...)` → `returned: True` | CONFIRMED |
| R265-audit-fixes-03 | minor | `backend/app/api/threads.py:734-738` (cdf3a308a; OV-v43-G5-05) | **The fix to the invite/activation door has no test.** The commit says list, detail, resolve and invite now resolve the org role. The new tests cover list, detail, resolve and the run producer, but not `rename_thread`. Putting back `current_user.get("role")` at this site leaves every Expert suite green. | plant: replace the `resolve_caller_role` lines in `threads.py` with `caller_role = current_user.get("role")` → `test_261_role_grants_reach_the_check.py` 4 passed, `test_262_expert_list_grants_api.py` 5 passed, `test_261_expert_authoring_scenarios.py` 8 passed, `test_260_expert_chat_scoping.py` 6 passed, `test_261_expert_runtime_scoping.py` 4 passed (reverted) | CONFIRMED |
| R265-audit-fixes-04 | minor | `backend/app/api/schedules.py:234-282` + `scheduler_service.py:131-145` (124dc444b) | **Run-now can still give the false "deleted, or no longer yours" reason.** The route dependency checks the caller's ACTIVE org, but `launch_scheduled_run` checks the SCHEDULE's org. When the two differ (a user in an Enterprise org A and a Standard org B, triggering a B schedule with `X-Org-Id=A`), the dependency lets the request through, the launch refuses and returns `None`, and the handler reports that the workflow was deleted. | stub drive (check_entitlement allows only org A; schedule org_id=B; `trigger_schedule` called directly): dependency → `admitted True`; handler → `launched=False … detail='the scheduled workflow could not be loaded (deleted, or no longer yours)'` | CONFIRMED |
| R265-audit-fixes-05 | minor | `frontend/src/lib/api/workflows.ts:378,963`, `frontend/src/lib/api/schedules.ts:112-127` (124dc444b) | **Five of the six newly gated doors still hide the plan in the UI.** Only chat send, draft create and publish read `entitlementRefusalMessage`. The other doors 124dc444b now tier-gates (draft PATCH, `/generate`, schedule create/patch/run-now; the template upload was not probed) still show a bare status code. TIER-03 ("refusals name the plan") is therefore met only on the three doors that were already gated before this audit. | scratch vitest probe (deleted afterwards), fetch mocked to a structured 403: `updateDraft=Failed to update workflow draft (status 403)`, `generate=Failed to generate workflow (status 403)`, `scheduleCreate=The request was refused (status 403)` | CONFIRMED |
| R265-audit-fixes-06 | minor | `frontend/src/lib/api/threads.ts:585` (124dc444b) | **The chat-send refusal message has no test**, although the commit counts chat send among the surfaces that now name the plan. `entitlementRefusal.test.ts` covers only the helper, draft create and publish. | plant: `entitlementRefusalMessage(body) ??` → `null ??` in `threads.ts` → `npx vitest run src/lib/api/__tests__/entitlementRefusal.test.ts` → `Tests 4 passed` (reverted) | CONFIRMED |
| R265-audit-fixes-07 | minor | `backend/app/services/workflow_kickoff.py:206-216` + `entitlement_service.py:43-58,110-129` (c28853142) | **A kickoff sent without `X-Org-Id` is refused with a false upgrade message.** `send_message` uses `resolve_active_org_or_none`, which returns `None` when the header is absent. That differs from `get_active_org_id`, which the authoring gates use and which falls back to the caller's only membership. `enforce_entitlement(None)` then answers "requires 'enterprise' tier (current tier: 'unassigned')" plus "Upgrade to Enterprise". An Enterprise single-org user whose client omitted the header is told to upgrade, and the frontend reader repeats that. | `resolve_active_org_or_none(SimpleNamespace(headers={}), {...})` → `None`; `enforce_entitlement(None, None, 'workflows')` → `EntitlementDeniedException 403 {'detail': "Capability 'workflows' requires 'enterprise' tier (current tier: 'unassigned')", …, 'upgrade_hint': 'Upgrade to Enterprise to use workflows.'}` | CONFIRMED |
| R265-audit-fixes-08 | minor | `backend/tests/unit/test_257_single_token_conversion_home.py` (`_SQL_CONVERSION`, f34106d5a); `frontend/src/lib/api/__tests__/noFrontendTokenPricing.fence.test.ts` (856c09ea0) | **Both text fences miss ordinary respellings of the same arithmetic.** The backend regex needs `_cost_per_million` immediately followed by `/ <digit>`, so adding a `::numeric` cast gets past it. The frontend regex misses `* 0.000001` and `/ 10 ** 6`. | backend plant appended to `db/rates.py`: `... rate.input_cost_per_million::numeric / 1000000.0 ...` → `pytest … -k "not postgres"` → `3 passed` (control plant without the cast → `1 failed`) (reverted). Frontend probe via exported `findConversions`: `b.ts` (`tokens * r * 0.000001`) → `0`, `c.ts` (`(tokens * r) / 10 ** 6`) → `0` | CONFIRMED |
| R265-audit-fixes-09 | info | `scripts/vitest-count-gate.cjs` (124dc444b vs 856c09ea0) | **Commit scope (§4.5).** 124dc444b says "both gate knobs", but it does not touch the gate script. Its `entitlementRefusal.test.ts` BASELINE and TARGETS entries landed in 856c09ea0, whose message covers only the pricing fence. So 124dc444b does less than its message says, and 856c09ea0 does more. | `git show --stat 124dc444b \| grep -c vitest-count-gate` → `0`; `git show 856c09ea0 -- scripts/vitest-count-gate.cjs \| grep -c entitlementRefusal` → `2` | CONFIRMED |
| R265-audit-fixes-10 | info | `frontend/src/components/experts/ExpertAuthoringStudio.tsx:1240-1242` (cdf3a308a) | The role picker now offers `org-admin` / `member` / `dept-admin` but not `super-admin`, which the CHECK constraint allows. No `dept-admin` row exists, and grants match roles exactly, so an `org-admin` is not covered by a `member` grant. The picker is closer to reality than before but still not the full role set. | local SELECT: `pg_get_constraintdef` → `CHECK (role = ANY (ARRAY['super-admin','org-admin','dept-admin','member']))`; `select role,count(*) from org_members` → `member 1, org-admin 28` | CONFIRMED |
| R265-audit-fixes-11 | info | `supabase/migrations/192_revoke_anon_tier_capabilities.sql` (e4ac67ff9) | Migration 192 revokes only `anon`. `authenticated` still holds INSERT, UPDATE, DELETE, TRUNCATE, TRIGGER and REFERENCES on `tier_capabilities`, apparently from Supabase default privileges (the same set appears on `expert_bundles` and `organizations`). The service-only write policy blocks DML, but TRUNCATE is not governed by RLS. PostgREST cannot issue TRUNCATE, so this is not reachable through the API. The "ACL parity" claim compares against a supplement that lists only SELECT for `authenticated`. | local: `role_table_grants` for `tier_capabilities`/`authenticated` → `['DELETE','INSERT','REFERENCES','SELECT','TRIGGER','TRUNCATE','UPDATE']`; `has_table_privilege('anon','public.tier_capabilities','SELECT')` → `False` (the fix itself holds) | CONFIRMED |
| R265-audit-fixes-12 | info | `backend/app/services/scheduler_service.py:136-145` (c28853142) | The scheduler calls `check_entitlement` directly rather than `enforce_entitlement`. So a DB blip gets the log line "is not entitled to workflows (Database error…)", and the scheduled firing is skipped as `launch_failed`, because the claim has already advanced `next_run_at`. The commit's claim "DB error → 503, not an upgrade" applies only to the chat path. | not driven (no DB-failure injection into the tick loop) | PLAUSIBLE |
| R265-audit-fixes-13 | info | `backend/tests/unit/test_258_every_authoring_write_is_tier_gated.py:40-55` (124dc444b) | The route fence only checks writes that carry `require_visible("workflow_authoring")`. A future authoring write added without that dependency is skipped rather than caught. Today the count floor (`>= 9`, exactly the current 9) catches a removal, but not a new route that lacks both dependencies. `POST /runs/{id}/continue` resumes workflow execution with no tier check, which seems intended for in-flight runs. | route table listed (all write routes + deps); gap not planted | PLAUSIBLE |

## What I checked and found sound

- **c28853142 (OV-01/02):** the kickoff gate sits inside the new-launch branch, before the definition resolve. The scheduler gate sits before the thread insert. Planting a removal of the kickoff call gave `3 failed`, and planting a disabled scheduler guard gave `2 failed`, so both tests can fail. A plain Deep send never calls the check. The publish golden run is the only other `create_workflow_run` site, and it sits behind the already-gated publish route. `test_258_single_entitlement_home`, `test_scheduler_string_guard` and `test_198_node_vocabulary` pass (17 passed).
- **f34106d5a:** the SQL spelling is generated from the Python constants, and all four `rates.py` sites interpolate it, including the f-string join at the 4th site. I checked parity myself with a read-only SELECT on 5 cases, including 1e12 tokens and sub-cent rates: all `OK`. A naive duplicate trips the fence.
- **ad093fd4a (OV-03):** the wall sits at the top of the one shared helper, and both callers (`:479`, `:637`) go through it. An unknown id falls through to the normal not-found path, and a root-level doc (`folder_id` NULL) counts as out of scope. Planting a disabled guard gave `2 failed`.
- **c6e29b42e:** `SURFACE_TABS.orgAdmin` matches `OrgAdminShell.tsx` `TABS` exactly, in order.
- **e4ac67ff9:** anon has no SELECT on the local DB, the policy roles are `authenticated, service_role`, and the migration is idempotent as written. No function touching tier or entitlement is anon-executable.
- **124dc444b (OV-04):** the route table shows every POST/PATCH authoring write in `workflows.py` and `schedules.py` carrying `_require_capability(workflows)`, with DELETE left open as documented. That is 4 extra dependencies in `workflows.py`, matching OV-04. Planting the removal of one schedule gate gave `1 failed` on that route.
- **856c09ea0:** the fence runs, finds 0 hits in the real tree, and its non-vacuity checks pass.
- **cdf3a308a (OV-05):** list, detail and resolve read `request.state.org_role` for the active org. The producer reads `org_members` in the run's org on the postgres pool with bound parameters, and fails closed to `[]`. Planting an inverted toggle payload gave `2 failed` in `OrgExpertsTab.test.tsx`. `PATCH /experts/{id}` is behind `require_expert_manage`.
- Each OV row's description matches the site count in its commit.

## Limits of this review

- This is PARTIAL independence per D-02: a fresh-context Claude subagent reviewing work built by the same Claude session family. It is not a §6.3 independent review.
- The harness auto-loaded CLAUDE.md (including its hot-file ledger verdict text) and the MEMORY.md index into my system prompt; I could not exclude them.
- R-01 and R-11 are about the grant state and privilege state of the **local** DB. I did not check production (no MCP, by the brief). R-01 is outside the 8 diffs; I report it because it defeats the gates they add.
- R-01 was driven up to the privilege check only (`has_column_privilege`, `EXPLAIN` in a read-only txn). A real PostgREST PATCH would be a write, which is forbidden, so the RLS `WITH CHECK` arm was read from `pg_policies`, not executed.
- R-02 was driven with a stubbed bundle row. I did not run a live chat against a disabled Expert.
- The parity test `test_sql_and_python_spellings_agree_in_postgres` opens a real connection, so I did not run it (`-k "not postgres"`). I checked parity myself with read-only SELECTs.
- The "RED n/m before" figures in the commit messages were not reproduced by checking out each parent. The plants above cover the same property.
