---
phase: 261-an-expert-you-can-author
verified: 2026-09-23
verification_mode: independent
status: human_needed   # was gaps_found at independent verification; see the addendum at the end
score: 3/5 success criteria verified (SC#1 and SC#5 partial)
base_commit: f3a1fe66f
phase_end_commit: ea24ddce3
head_verified: c6e29b42e
overrides_applied: 0
gaps:
  - truth: "SC#1 / PACK-07 — an org-admin creates, edits, DISABLES and deletes an Expert from a surface in the app"
    status: partial
    reason: "Create, edit and delete exist in the app. Disable does not exist anywhere in the UI. The create payload hard-codes `is_enabled: true`, the update payload never sends `is_enabled`, and OrgExpertsTab has only Edit and Delete buttons. The only way to disable an Expert is an API client or SQL, which is what the criterion rules out."
    artifacts:
      - path: "frontend/src/components/experts/ExpertAuthoringStudio.tsx"
        issue: ":468 create payload `is_enabled: true`; :431-449 update payload has no `is_enabled`; the file has no enable/disable control"
      - path: "frontend/src/components/org/OrgExpertsTab.tsx"
        issue: "row actions are Edit (:265) and Delete (:275) only, with no enable/disable toggle"
    missing:
      - "An enable/disable control that sends `is_enabled` through the existing PATCH /experts/{id}"
      - "A vitest that asserts the PATCH body carries is_enabled=false"
  - truth: "SC#5 / PACK-10 — an Expert can be restricted to named users OR ROLES, and a user outside that set can neither see nor invite it"
    status: partial
    reason: "Named-user grants work and the see/invite refusal is wired on every surface. Role grants never match in production. Every call site builds `caller_roles` from `current_user.get('role')`, and `get_current_user` (app/dependencies.py:300-380) returns only `{id, email}`. The org role is written to `request.state.org_role`, not to the user dict. So `caller_roles` is always `[]`, and a user who holds a granted role is refused (fail-closed, not a leak). The studio still offers role grants and badges them 'Role-Gated'. Three of the five roles it offers (hr, finance, legal) do not exist in the role CHECK vocabulary (super-admin/org-admin/dept-admin/member). Every test that passes injects a `role` key into current_user, a shape the real dependency never produces. This is the §A2 failure mode again: fixtures that model a row production cannot produce."
    artifacts:
      - path: "backend/app/api/experts.py"
        issue: ":404, :443, :474 `caller_role = current_user.get('role')`, always None"
      - path: "backend/app/api/threads.py"
        issue: ":732 same pattern on the invite (PATCH active_expert_id) path"
      - path: "backend/app/services/run_producer.py"
        issue: ":420 same pattern; threads.py:946 adds org_id to current_user but never role"
      - path: "frontend/src/components/experts/ExpertAuthoringStudio.tsx"
        issue: ":1240-1244 offers roles hr/finance/legal that no org_members row can hold"
      - path: "backend/tests/unit/test_261_expert_authoring_scenarios.py"
        issue: "passes current_user={'id':..., 'role':'member'}, an identity shape get_current_user never returns, and never drives a role grant end to end"
    missing:
      - "Resolve the caller's org role from request.state.org_role (or org_members) and pass it as caller_roles on all five surfaces"
      - "A test that drives a role grant using the real get_current_user identity shape ({id, email} only)"
      - "The role picker lists only real roles (super-admin/org-admin/dept-admin/member), or role grants are removed from the UI until they work"
deferred: []
accepted_deviations:
  - item: "D-v4.3-01 union composition and D-v4.3-02 additive tool floor are excluded from the review and verified live by the operator"
    recorded_in: ".planning/PROJECT.md D-v4.3-03 (operator ruling 2026-09-20); 261-REVIEW.md header 'EXCLUDED by decision'"
    note: "This is not a phase success criterion. The structural fences pass (test_261_expert_runtime_scoping.py). The live check is still owed and is listed under human_verification."
human_verification:
  - test: "G-4 lived-experience UAT for authoring: as an org-admin, open Org Admin > Experts, draft an Expert from an uploaded PDF, edit the draft, save, then edit and delete it"
    expected: "Nothing is saved until Save is clicked. The uploaded PDF appears nowhere in the Library. The saved Expert appears in the list and the delete removes it."
    why_human: "No 261-UAT.md exists. The G-4 scenarios were never run for this phase."
  - test: "Named-user grant, driven live: set an Expert to visibility 'granted' with one named user; sign in as a different member of the same org"
    expected: "The Expert is absent from the list, and GET /experts/{id} and PATCH /threads/{id} active_expert_id both return 404"
    why_human: "Automated coverage mocks check_expert_grant_access in the scenario suite. The live predicate is only exercised in test_261_expert_grants_db.py."
  - test: "D-v4.3-03 operator arms: invite an Expert into a folder-scoped thread"
    expected: "Both the thread folder and the Expert's folders are readable (union), and the Expert can still write a file (tool floor)"
    why_human: "The operator ruling reserves this for the operator, live"
---

# Phase 261: An Expert You Can Author — Verification Report

**Phase goal:** An org-admin authors an Expert inside the app. They name it, choose its skills, connections and knowledge, brainstorm the draft with AI from uploaded files, and decide which users may use it. Authoring is a surface over the CRUD that already ships. It is not a second engine.
**Verified:** 2026-09-23 · **Mode:** independent. I did not build this phase. I did not edit any source or test, and I committed nothing.
**Base:** `f3a1fe66f` · **Phase end:** `ea24ddce3` · **HEAD checked:** `c6e29b42e` (develop)
**Status:** gaps_found. SC#1 and SC#5 are partial. Neither gap has an operator acceptance on record.

## Success Criteria

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | Create / edit / **disable** / delete from an in-app surface, using the existing `/experts` endpoints (PACK-07) | ✗ PARTIAL | The surface exists: `OrgAdminShell.tsx:89,398` mounts the `OrgExpertsTab`. `lib/api/experts.ts:200,223,234` call the existing `POST/PATCH/DELETE /experts`. There is one router, `api/experts.py`. **Disable is missing:** the studio hard-codes `is_enabled: true` (`ExpertAuthoringStudio.tsx:468`), the update payload (`:431-449`) never carries `is_enabled`, and `OrgExpertsTab.tsx` has only Edit (`:265`) and Delete (`:275`). |
| 2 | Who may author is DATA (`role_permissions`); a second hardcoded role check fails a fence driven RED (PACK-08) | ✓ VERIFIED (2 warnings) | `require_expert_manage` → `_has_org_permission(..., "experts:manage")` (`api/experts.py:111-126`). Every mutation and grant route depends on it (`:133,196,325,496,531,555,571,594`). Mig 189 seeds `experts:manage` for super-admin and org-admin. The fence `test_261_single_expert_authoring_gate.py` passes. It was driven RED against a planted role check by the independent review (261-REVIEW.md "What I verified GOOD"). I did not re-plant it, because this verification makes no source edits. See warnings W-1 and W-2. |
| 3 | AI drafting yields a DRAFT row a human saves, never auto-publishes; closed-core inventory unchanged from the phase base (7/1/29/10) (PACK-09) | ✓ VERIFIED | `POST /experts/draft` returns `ExpertDraftOutput` and has no insert (`api/experts.py:191-314`). `services/expert_authoring.py` contains no INSERT, storage or documents write. I AST-counted `_TOOL_REGISTRY` 29 → 29 → 29 and `EXPERT_CORE_TOOLS` 10 → 10 → 10 at base, phase end and HEAD. `git diff --stat f3a1fe66f ea24ddce3` over `emitters.py` and `phase_types.py` is **empty**. `tool_dispatcher.py` gains only the `EXPERT_DELIVERABLE_TOOLS` frozenset, which registers nothing. The live fence `test_261_closed_core_inventory.py` asserts 7/1/29/10 and passes. |
| 4 | Brainstorm files draft the Expert and are NOT ingested; where they go is stated in the UI and driven, including retention/deletion (PACK-09) | ✓ VERIFIED (1 warning; live UAT owed) | Files are read with a bounded in-memory read (`f.read(5 MB)`, `:217-218`). PDF goes through pypdf, DOCX through python-docx, anything else is decoded as UTF-8. Text is capped at 30k characters, then `del data`. Nothing is persisted, so retention is nil by construction. The UI statement is at `ExpertAuthoringStudio.tsx:597-601`. The no-ingestion path is exercised by `test_expert_draft_non_ingestion_guarantee`, which compares live `documents`/`document_chunks` counts before and after. See warning W-3. |
| 5 | Restrict to named users **or roles**; an outsider can neither see nor invite, driven against a readable row with an absent grant (PACK-10) | ✗ PARTIAL | **Named users work.** `check_expert_grant_access` (`db/experts.py:309`) is called by `get_expert_service` / `get_expert_by_slug_service` / `resolve_expert_bundle` (`expert_service.py:129,152,421`). Those serve GET `/experts/{id}` and `/resolve`, the invite (`threads.py:735`) and the runtime (`run_producer.py:423`, fail-closed). The list uses `list_expert_bundles_for_caller`. **Roles do not work** (see the gap below). I proved it with a probe: calling `get_expert` with the exact identity shape `get_current_user` returns printed `caller_roles passed to grant check: []`. |

**Score:** 3/5

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PACK-07 | 261-01, 261-04 | Create/edit/disable/delete an Expert from an in-app surface via the existing endpoints | ✗ PARTIAL | Create, edit and delete are wired to the existing router. Disable has no UI (SC#1). |
| PACK-08 | 261-01, 261-05 | Who may author is `role_permissions` data; single-home fence | ✓ SATISFIED | `require_expert_manage` plus mig 189 seed, and the fence is green. W-1 and W-2 are warnings. |
| PACK-09 | 261-02, 261-04 | Draft row a human saves; no ingestion; closed core unchanged | ✓ SATISFIED | SC#3 and SC#4 above. §B floors and the single serialiser are verified below. |
| PACK-10 | 261-01, 261-04, review F-1 fix `880dea1f5` | Named users or roles; an outsider cannot see or invite | ✗ PARTIAL | User grants are enforced on all five surfaces. Role grants are dead because `caller_roles` is always `[]`. |

No orphaned requirements. REQUIREMENTS.md:134-141 maps exactly PACK-07..10 to Phase 261.

## Review follow-through (not trusted, re-checked in code)

| Item | Claimed | Found in code |
|---|---|---|
| F-1 invite gate | fixed | ✓ Five production call paths reach `check_expert_grant_access`, and none are test-only. **But** the role arm on all five is unreachable (gap above). |
| F-2 PDF/DOCX decode | fixed | ✓ `api/experts.py:222-243`. The residual (a failed extraction is only a `logger.warning`) still stands and is not blocking. |
| F-3 unbounded read | fixed | ✓ `f.read(MAX_FILE_BYTES)` runs before the slice (`:217-218`). |
| §A2 fixture regression | repaired at `4c2428063` | ✓ `test_259_expert_member_isolation.py` passes in the run below. |
| **§B (a)** schema floors | unreviewed | ✓ `ExpertDraftOutput` fields are required, with no defaults (`expert_authoring.py:61-78`): description ≥400, example_output ≥120, when_to_use 40-240, prompt_suggestions exactly 3. `DraftPromptSuggestion` is separate from the read model, so old rows stay readable. The fallback path is covered by `test_261_draft_contract_and_jsonb.py`, which is green. |
| **§B (b)** single jsonb serialiser | unreviewed | ✓ `_suggestions_to_jsonb` (`db/experts.py:13-44`) is the only encoder, used at both `::jsonb` binds (`:95/117` insert, `:386-387` update). A string input is parsed, not re-dumped. The only raw `json.dumps` calls in the module are inside that function. No other writer of `prompt_suggestions` exists in `app/`. |

## Commands run (literal result lines)

```
backend> venv/Scripts/python.exe -m pytest tests/unit/test_261_closed_core_inventory.py tests/unit/test_261_draft_contract_and_jsonb.py tests/unit/test_261_expert_authoring.py tests/unit/test_261_expert_authoring_scenarios.py tests/unit/test_261_expert_grants_db.py tests/unit/test_261_expert_runtime_scoping.py tests/unit/test_261_single_expert_authoring_gate.py tests/unit/test_259_expert_member_isolation.py tests/unit/test_259_closed_core_inventory.py -q
75 passed, 1 warning in 26.47s

frontend> GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx src/components/experts/__tests__/OrgExpertsTab.test.tsx src/components/org/OrgAdminShell.test.tsx --maxWorkers=2
Test Files  3 passed (3)
Tests  37 passed (37)

AST count (scratch script, git show <rev>:backend/app/services/tool_dispatcher.py)
== f3a1fe66f  tools 29  core 10
== ea24ddce3  tools 29  core 10
== HEAD       tools 29  core 10

git diff --stat f3a1fe66f ea24ddce3 -- backend/app/services/harness/emitters.py backend/app/services/harness/phase_types.py backend/app/services/tool_dispatcher.py
 backend/app/services/tool_dispatcher.py | 13 +++++++++++++      (emitters.py, phase_types.py: no change)

role probe (scratch; get_expert called with {"id","email"} = get_current_user's real return shape)
result: HTTPException 404
caller_roles passed to grant check: []
```

No failures were observed, so no inherited-versus-new check at the base commit was needed. I did not run the full suites, per the task.

## Warnings (not blockers)

- **W-1 · The UI entry point does not follow the data (PACK-08).** The Experts tab lives inside `OrgAdminShell`, which renders only when `canManage` is true. `canManage` is the `org:manage` probe (`useOrgPermissionsProbe.ts:9`), not `experts:manage`. If a role is granted `experts:manage` by a row change, the API opens but the in-app surface stays hidden. That role can only author with an API client unless it also gets `org:manage` or a code change is made.
- **W-2 · The RLS layer does not enforce `experts:manage`.** `expert_bundles_write_policy` (mig 187, full-schema.sql:7299) allows INSERT/UPDATE/DELETE for any org member. `expert_grants_write_policy` (mig 189) allows grant writes for any org member on any bundle they can read. Both tables are granted to `authenticated`. A member with the public anon key and their own JWT can author or edit org-visible Experts through PostgREST and bypass the API gate. This comes from Phase 259. It is recorded here because PACK-08's claim holds at the API only.
- **W-3 · The UI copy is inaccurate.** The badge says files are "analyzed ephemerally **in a sandbox**". They are parsed in the API process's memory, not in a sandbox.
- **W-4 · `POST /threads` accepts `active_expert_id` with no grant check** (`threads.py:672-673`). The runtime refuses fail-closed (`run_producer.py:430-441`), so no scoped turn can run. Still, the thread row briefly records an Expert the caller may not invite.
- **W-5 · Named-user grants take a raw user UUID typed by hand** (`ExpertAuthoringStudio.tsx:1258-1262`). There is no member picker, so "named users" means a UUID.

## Gaps Summary

Two criteria are partial, and both are cases where the tests agree with the defect:

1. **SC#1:** "disables" has no UI control at all. It is small and self-contained: one toggle that sends `is_enabled` through the existing PATCH.
2. **SC#5:** role grants are unreachable. Every caller reads `current_user.get("role")`, but the auth dependency never puts a role on that dict. It fails closed, so there is no leak. But the studio sells "Role-Gated" access, including three roles that do not exist, and it silently grants nobody. The scenario suite passed because its fixtures inject a `role` key the real dependency never produces. This is the §A2 lesson again, one layer up.

No later v4.3 phase (262-264) takes either item, so neither is deferred. G-7 note: 261 has run one closure round (F-1/F-2/F-3), so a fast-fix round is allowed. Each item is roughly ≤2 files.

---
_Verified: 2026-09-23 · Verifier: Claude (gsd-verifier, independent)_

---

## Addendum 2026-09-23 — gaps closed after this verification (v4.3 milestone close)

⚠ **These closures were made by the milestone-close orchestrator, not by this verifier.** Each was
driven RED-first and re-driven green with targeted suites; none has had an independent review
cycle. The verification above is left unedited, because it is what found them.

| Gap | Closed by | Proof |
|---|---|---|
| SC#1/PACK-07 — no Disable in the app | `cdf3a308a` | Enable/Disable toggle in Org Admin → Experts via the existing `PATCH /experts/{id}`; `OrgExpertsTab.test.tsx` 8/8, RED 3/8 without the fix |
| SC#5/PACK-10 — role grants could never match | `cdf3a308a` | list/detail/resolve/invite resolve the org role via `resolve_caller_role`; the producer reads `org_members`; `test_261_role_grants_reach_the_check.py` 4/4 with the REAL `{id, email}` identity, RED 4/4 before; picker now offers only real roles |

**Still owed (human):** the G-4 authoring UAT and the named-user/role grant live drive listed under
`human_verification` — no `261-UAT.md` exists.
