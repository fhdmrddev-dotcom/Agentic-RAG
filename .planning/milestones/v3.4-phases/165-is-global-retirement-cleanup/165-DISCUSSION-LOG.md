# Phase 165: `is_global` Retirement Cleanup - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-20
**Phase:** 165-is-global-retirement-cleanup
**Areas discussed:** System-global vs org-shared split, folder_utils.py cross-org fix (SC#4), Rename cutover & API/frontend boundary, "Shared with org" copy + pre-166 honesty

---

## System-global vs org-shared split (the four write-locked tables)

| Option | Description | Selected |
|--------|-------------|----------|
| Rename their is_global → is_system_global | Semantic-split, pure value-preserving RENAME: folders+skills → is_org_shared (user toggles); the 4 write-locked tables → is_system_global (never meant "org-shared"). 15 seeded workflows stay universal by construction, zero data movement. Minor ADR §2 deviation. | ✓ |
| is_org_shared everywhere + separate is_system_global marker | ADR-§2-literal: rename all 6 → is_org_shared, then add is_system_global marker on the 4 tables + migrate the 15 rows. Add-column + data-move; keeps a future user-org-share path open. | |
| Let me explain what I want | Describe a different target model. | |

**User's choice:** Rename their is_global → is_system_global (Recommended).
**Notes:** Evidence-driven — workflow_definitions has 15 seeded `is_global=true` rows (users write-locked out); uniform is_org_shared would regress them to the seed org (the mig-109 Test-7 bug class). Operator-ratified deviation from 160-ADR §2's literal "is_org_shared everywhere" — honors the ADR spirit while closing a gap the ADR's model missed.

---

## skills.is_system column-name treatment

| Option | Description | Selected |
|--------|-------------|----------|
| Keep column name is_system | Don't rename the physical skills.is_system column (load-bearing in badge-spoof WITH-CHECK, load_skill tie-break, tool_dispatcher). Document that is_system IS the skills allow-list. Minor ADR §1 deviation. | ✓ |
| Rename skills.is_system → is_system_global | ADR-§1-literal: rename the physical column across skills RLS, skill_files/tuner_runs EXISTS, load_skill, badge-spoof, tool_dispatcher, models. Uniform naming, wide churn on hot security wiring for zero behavior change. | |

**User's choice:** Keep column name is_system (Recommended).
**Notes:** Operator-ratified deviation from ADR §1 literal name. `is_system_global` therefore appears as a column name ONLY on the four write-locked tables; skills' universal marker stays `is_system`.

---

## folder_utils.py cross-org fix (SC#4 / SEED-124)

| Option | Description | Selected |
|--------|-------------|----------|
| Org-aware helpers on service-role path | SEED-124 design: fetch_all_folders selects org_id; resolve caller org set once; gate subtree-visibility on org_id ∈ caller_org_ids. Load-bearing on the BYPASSRLS producer path; belt-and-suspenders on the request path. Surgical, preserves the subtree algorithm. | ✓ |
| Swap browse tools to user-JWT client + rely on RLS | Consistency with 164's retrieval-RPC swap; but subtree-descendant visibility (non-shared child of a shared folder) risks being hidden by the folders SELECT policy — bigger change on a security fix. | |
| Let me explain what I want | Describe a different approach. | |

**User's choice:** Org-aware helpers on the service-role path (Recommended).
**Notes:** The browse tools run on `get_supabase()` (BYPASSRLS) in the producer, so RLS can't reach them — explicit org-scoping in the helpers is the only load-bearing fix short of a bigger client swap.

---

## WR-01 (owner-UUID disclosure on shared-subtree descendants)

| Option | Description | Selected |
|--------|-------------|----------|
| Null owner on any non-owned visible folder | Null user_id for any folder the caller sees but doesn't own — is_org_shared row OR descendant-via-shared-ancestor. Simplest; covers the descendant case; matches the existing serialize-time projection. | ✓ |
| Null owner only on shared-subtree descendants | Narrower — extend the existing rule to specifically cover descendants via is_in_global_subtree. More precise to WR-01's wording but more logic; subsumed by the broader rule. | |

**User's choice:** Null owner on any non-owned visible folder (Recommended).

---

## Rename cutover & API/frontend boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Full end-to-end rename | DB + API fields + frontend props + folder_is_globally_visible → folder_is_org_shared. Lands as one operator-applied migration + one commit (local dev = no partial-deploy window). | ✓ |
| Keep is_global on the wire, rename DB/internal only | Least frontend churn via Pydantic alias, but leaves a permanent DB-vs-API naming mismatch that half-defeats the retirement goal. | |

**User's choice:** Full end-to-end rename (Recommended).

---

## "Shared with org" copy + pre-166 honesty

| Option | Description | Selected |
|--------|-------------|----------|
| Keep toggle functional, label "Shared with org" | Relabel Global→"Shared with org" on folder + skill toggles; keep fully functional. Forward-correct for 166/167; honest today; value-preserving rename = no silent un-share. | ✓ |
| Soften / disable until orgs have members | Gray out/hide with "available when your org has members". More honest-feeling but adds conditional UI depending on org-membership state (not built) — throwaway work undone in 166/167. | |
| Let me refine the wording | Different label / add a tooltip. | |

**User's choice:** Keep toggle functional, label "Shared with org" (Recommended).
**Notes:** mig 108/109 already org-scoped user is_global folders/skills in Phase 163, so 165's rename is cosmetic on visibility for those rows — "no silent un-share" (SC#2) holds by construction.

---

## Claude's Discretion

- Migration packaging (one file vs reviewable bundle).
- Frontend prop/badge treatment for display-only is_system_global surfaces vs functional is_org_shared toggles.
- Storage `skill-files` bucket policy universal branch (is_system vs renamed is_org_shared) — reconcile against mig-109 skill_files table RLS.
- Whether tests reference live `is_global` column names literally (update) or assert via behavior.

## Deferred Ideas

- User-org-shareable views / classification-rules / metadata-fields — a new capability (separate is_org_shared column + write path + UI), likely alongside 166/167; the path to reviving v3.0 VIEW-05 org-scoped.
- Deleting the ~253 `.eq("user_id")` belt-and-suspenders filters — later hardening pass (163-D-14).
- `<OrgContext>` / org switcher / `X-Org-Id` narrowing — Phase 166.
