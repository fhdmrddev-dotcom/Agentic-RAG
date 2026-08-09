---
seed_id: SEED-125
title: Skill load/read tools leak skill instructions + files cross-org via org-blind service-role skill resolution
status: closed
closed: 2026-07-22
closed_by: "Dedicated security quick-fix (2026-07-22): CR-01 code — 6 tool_dispatcher.py sites org-gated via one shared helper reusing folder_utils._resolve_caller_org_ids (is_system escape preserved, fail-closed), proven by 7 live two-org legs (org B refused cross-org load_skill + read_skill_file; is_system still cross-org). CR-02 storage — mig 112 applied local (org-gates the skill-files storage READ policy explicitly; the leak was already transitively org-gated via the skills-RLS join, so mig 112 is defense-in-depth + the false-comment fix). two-org regression test added. Mig 112 owed on cloud (099->112, next operator push)."
planted: 2026-07-21
phase_origin: "Phase 165 code review (165-REVIEW.md CR-01 + CR-02) — verified against the running code: the six .or_(is_org_shared.eq.true) skill-resolution sites run on the service-role BYPASSRLS producer client (ctx.supabase) with no org_id predicate"
folded_into: null
category: security / tenancy-isolation — the SKILLS-domain analog of SEED-124 (which closed the same class for FOLDERS in Phase 165). A service-role bypass of the membership org-scoping RLS enforces everywhere else, on the agent's skill load/read/execute tool surface.
related_seeds: [SEED-124, SEED-091]
related_decisions:
  - "D-165-01 semantic split — folders/skills `is_global` -> `is_org_shared` (a genuine user org-share toggle). The rename is value-preserving; it did NOT introduce this leak and did NOT close it."
  - "163 FIX-A / mig 109 — `skills.is_system = true` is the platform-universal allow-list (skill-creator built-ins are legitimately cross-org); the org-gated branch (owner OR `is_org_shared`) is what must be org-scoped. The service-role skill-resolution queries apply neither."
  - "SEED-124 (folders) was folded into 165 and CLOSED (org-scoped `folder_utils.py` + xfail->XPASS). SEED-125 is the same seam for skills, left open."
re_open_triggers:
  - "Any pen-test / security audit exercises the agent's `load_skill` / `read_skill_file` / `execute_code` (skill-file injection) / `save_skill` tools across two orgs and observes cross-org skill instructions, filenames, or file bytes."
  - "A user in org B calls `load_skill('<name>')` for a skill that is `is_org_shared=true` and owned in a disjoint org A, and receives its instructions (reproduces today with the personal-org backfill from mig 105)."
  - "Phase 166/167 (org-admin / invitations — orgs gain real multiple members) lands: the `is_org_shared` skill-share toggle becomes meaningful across members, sharply widening this leak's blast radius. MUST be closed at or before that point."
priority: high
suggested_phase: "Dedicated security /gsd:quick (mirrors the SEED-124 folder fix pattern, skills-scoped) OR fold into 166/167 before orgs gain members"
---

# SEED-125 — Skill load/read/execute tools leak skill instructions + files cross-org (service-role, org-blind)

## The gap (CR-01, verified against the code)

The agent's skill tools resolve skills on the **service-role BYPASSRLS** producer client (`ctx.supabase`) with a filter that has **no `org_id` predicate**:

```python
ctx.supabase.table("skills")
    .select(...)
    .or_(f"user_id.eq.{ctx.current_user['id']},is_org_shared.eq.true")   # <- no org gate
    .eq("name", skill_name).eq("is_enabled", True)
    .order("is_system", desc=True).order("is_org_shared", desc=True)
```

Six sites in `backend/app/services/tool_dispatcher.py` use this pattern:
- `_handle_load_skill` (`~L1149`) — loads instructions.
- `_handle_read_skill_file` (`~L1236`, `~L1364`) — reads skill file content by name.
- `_handle_execute_code` skill-file injection (`~L1519`, `~L1531`) — injects skill files into the sandbox.
- `_handle_save_skill` sibling-name lint (`~L1376`).

Because RLS does not apply to the service-role client, the `is_org_shared = true` branch matches **any org's** org-shared skill. Once any user marks a skill "Shared with org" (`is_org_shared=true`, a live toggle), a disjoint-org user's agent can `load_skill('<name>')` and read its full instructions, and `read_skill_file` / the `execute_code` injection can pull its bundled file bytes — cross-org.

This is **pre-existing** (the pattern predates v3.4 as `.or_(is_global.eq.true)`). Phase 165 renamed `is_global -> is_org_shared` value-preservingly across these six sites; the rename neither introduced nor closed the leak. SEED-124 closed the **folder** analog on the same producer seam; the **skills** analog was in no phase's plans.

## CR-02 — Storage skill-files read policy has the same un-org-gated branch (+ a false comment)

`supabase/migrations/111...sql` §3 and `scripts/full-schema-supplement.sql` set the `skill-files` storage read policy to:

```sql
WHERE sf.file_path = name AND (s.is_system = true OR s.is_org_shared = true)
```

The migration comment claims this "reconciles to the mig-109 skill_files table-RLS shape," but the mig-109 **table** policy org-gates its non-`is_system` branch, whereas this **storage** policy does not. Under a normal authenticated user's JWT (storage RLS applies), a user in org B can therefore read the storage bytes of any `is_org_shared` skill's files cross-org. Same class as CR-01, on the storage read path. (The Phase-165 supplement edit was value-preserving — it reproduced the pre-existing un-org-gated branch and only retired the `is_global` token; it did not create the gap, but the "reconciled" comment overstates the closure.)

## The fix (skills shape — NOT identical to the folder fix)

Skills differ from folders: skills have an `is_system` **platform-universal** branch (built-in skill-creator content is legitimately cross-org, mig-109 FIX-A), which folders do not. So the org-scoping must PRESERVE the `is_system` universal escape and org-gate only the shared/owner branch — mirroring the `match_skills` RLS predicate the migration already establishes for the table:

```
visible  iff  s.is_system = true
              OR ( s.org_id ∈ caller_org_ids
                   AND ( s.user_id = caller OR s.is_org_shared = true ) )
```

Concretely: resolve the caller's org set once (as `folder_utils._resolve_caller_org_ids` already does — reuse it), select `org_id`, and gate the six `tool_dispatcher.py` resolution sites plus the storage read policy on `org_id ∈ caller_org_ids` for the non-`is_system` branch. Belt-and-suspenders on the request path (user-JWT already RLS-scoped) and the load-bearing fix on the service-role producer path. Add a two-org regression test (the SEED-124 `test_v3_4_org_isolation.py` pattern) covering `load_skill` + `read_skill_file` + the storage read.

## Minor related item (WR-01, low, folder-domain)

`folder_utils.is_in_global_subtree` (touched in Phase 165 plan 02) walks the parent-chain with no in-flight cycle guard — a latent hang/crash if a future bug ever lets `parent_id` form a loop. Cheap hardening (a `visited` set); bundle into the same security /gsd:quick or leave as a standalone.
