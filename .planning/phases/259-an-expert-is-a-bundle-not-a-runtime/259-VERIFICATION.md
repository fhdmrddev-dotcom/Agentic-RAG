---
phase: 259-an-expert-is-a-bundle-not-a-runtime
verified: 2026-09-23
verification_mode: independent
verifier: Claude (gsd-verifier) — did not build this phase (builder: gemini; reviewer: claude, 259-REVIEW.md)
head_verified: e4ac67ff9 (develop)
phase_base: e8db54cc9^ (parent of the first 259 source commit)
status: passed
score: 3/3 success criteria verified; 3/3 requirements satisfied
overrides_applied: 0
gaps: []
deferred:
  - truth: "Install vs author (ROADMAP decision #5) — would it change the bundle row?"
    addressed_in: "Accepted operator decision D-259-06 (not a gap)"
    evidence: "259-REVIEW.md §'Operator decision surfaced at review': 'D-259-06 — install vs author. Answered 2026-09-20: read-only reference. ... no schema change is owed'"
  - truth: "Consumers of the resolved bundle (thread scoping) — effective_folder_ids / effective_skills are not consumed by anything in 259"
    addressed_in: "Phase 260 (PACK-02)"
    evidence: "ROADMAP Phase 260 SC#1: 'Selecting an Expert in a chat thread scopes that thread — the skills, connections and knowledge the agent works from match the bundle'"
---

# Phase 259: An Expert Is a Bundle, Not a Runtime — Verification Report

**Phase Goal:** An Expert exists as **data** — name, description, member skills, required connections, knowledge scope, prompt suggestions, visibility — tier-gated and safe under RLS, with **no execution path of its own**.
**Verified:** 2026-09-23, against current `develop` HEAD `e4ac67ff9` (i.e. after Phases 260-264 also touched these files)
**Status:** passed
**Re-verification:** No — initial independent verification (no prior VERIFICATION.md existed)

Nothing below is taken from SUMMARY.md or REVIEW.md without being re-measured. Review fixes F-1 / F-2 / F-3 were each checked in code.

## Success Criteria

| # | Success criterion (ROADMAP) | Status | Evidence |
|---|---|---|---|
| 1 | An Expert can be created, read and listed as a **row** carrying name, description, member skills, required connections, knowledge scope, prompt suggestions and visibility — and **nothing executes it**: executor / emitter / dispatcher inventory measurably unchanged from the phase's base commit (PACK-01) | VERIFIED | `supabase/migrations/187_expert_bundles.sql:6-24` defines every named column (`member_skills`, `required_connections`, `knowledge_folder_ids`, `prompt_suggestions`, `visibility`, …); live local DB has the table, RLS on, both policies, and the Financial Analyzer seed row (`slug=financial-analyzer, is_system=True, org_id=None`). CRUD in `backend/app/db/experts.py` (`get_expert_bundle_by_id` :147, by-slug :168, list/create/update/delete) exposed by `backend/app/api/experts.py` (`POST ""` :129, `GET ""` :386, `GET /{id}` :430, `PATCH` :491, `DELETE` :527). **Inventory measured independently by importing the registries at both commits:** base `e8db54cc9^` → `phase_types 7 emitters 1 tools 29`; HEAD → `phase_types 7 emitters 1 tools 29`. No `if … expert` branch in `agent_loop.py` (grep empty); no expert runtime/loop module in `app/services` (only `expert_service.py`, `expert_authoring.py`). F-2 fix confirmed: `test_259_closed_core_inventory.py:20,30,40` count-pin all three registries (`== 7`, `== 1`, `== 29`), not substring checks. |
| 2 | A user from another org cannot read the bundle **and** cannot reach any member of a bundle they can read — member check evaluated on its own merits, not skipped because the bundle passed, proven against a clean bundle row with a leaking member (PACK-04) | VERIFIED | Bundle layer: RLS read policy `187_expert_bundles.sql:62-77` (org membership + visibility); service layer `db/experts.py:158-163` (`is_system = true OR org_id = $2`). **Live, rolled-back probe:** an `org`-visibility bundle in org 22f9c615… — member sees `1`, outsider (authenticated, no membership) sees `0`, `left behind: 0`. Member layer: `resolve_expert_bundle` (`services/expert_service.py:394-551`) evaluates skills (:440-465 via `filter_visible_skill_names` → `skill_row_visible`), folders (:467-500) and connections (:502-533) independently **after** the bundle passed, stripping with `EXPERT_MEMBER_CROSS_ORG_STRIPPED`. F-1 fix confirmed in code at :486-489 — folder admitted only if system-shared or (`org_id == caller_org_id` AND (`user_id == caller` OR `is_org_shared`)). Clean-row/leaking-member proof: `test_resolve_strips_foreign_skill_seed_125` (bundle row in caller's org, member skill from org B). **Counterfactual driven in-memory (no source edited):** planting "trust every member skill" and "trust every folder" each turned the corresponding real test RED (both `pytest.raises(AssertionError)` satisfied). |
| 3 | An Expert is unavailable to an org whose tier does not include it, and the refusal comes from the **Phase 258 entitlement check** — not a second check (PACK-06) | VERIFIED | `backend/app/api/experts.py:41-44` — router-level `dependencies=[Depends(require_capability("experts"))]`, imported from `app.services.entitlement_service` (:18), which is the 258 `require_capability` (`entitlement_service.py:132-148` → `enforce_entitlement`). Live `tier_capabilities` has `experts` enabled only for `enterprise`. No `tier`/`subscription_tier` reference anywhere in `api/experts.py`, `services/expert_service.py`, `db/experts.py` (grep: only the import and one comment). TIER-04 single-home fence `test_258_single_entitlement_home.py` green; `test_259_expert_entitlement_gate.py` asserts the structured 403 (`error=entitlement_required, required_tier=enterprise`) and that every route carries the router dependency. |

**Score:** 3/3

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| PACK-01 | 259-01, 259-03 | An Expert is a bundle row (name, description, member skills, required connections, visibility…) and nothing executes it | SATISFIED | Migration 187 row shape + CRUD API; registries 7/1/29 identical at base and HEAD (measured by import at both commits); count-pinned fence green |
| PACK-04 | 259-02 | RLS applies to the bundle AND to every member; member check not skipped because the bundle passed | SATISFIED | RLS policy + live cross-org probe (outsider sees 0); independent 3-arm member resolution in `expert_service.py:394-551`; SEED-125 test + folder test proven non-vacuous by in-memory plants |
| PACK-06 | 259-03 | An Expert is gated by TIER-01 | SATISFIED | Router-level `require_capability("experts")` from the 258 entitlement home; `experts` capability enterprise-only in `tier_capabilities`; TIER-04 fence green |

No orphaned requirements: REQUIREMENTS.md maps exactly PACK-01, PACK-04, PACK-06 to Phase 259, all claimed by plans. (Bookkeeping note: REQUIREMENTS.md still shows these as `[ ]` / `Pending` at lines 108/113/119 and 258-260 — a register update owed at milestone close, not a code gap.)

## Commands Run (literal result lines)

```
# backend/, targeted suites + TIER-04 fence
backend/venv/Scripts/python.exe -m pytest tests/unit/test_259_closed_core_inventory.py tests/unit/test_259_expert_bundles_db.py tests/unit/test_259_expert_entitlement_gate.py tests/unit/test_259_expert_member_isolation.py tests/unit/test_258_single_entitlement_home.py -q -p no:cacheprovider
32 passed, 1 warning in 1.74s
   (warning = RequestsDependencyWarning, pre-existing; test_live_postgres_seed_bundle did NOT skip — local DB reachable)

# inventory at the phase base (git archive of e8db54cc9^ backend/app into scratchpad, imported with dummy env)
phase_types 7 emitters 1 tools 29
# inventory at HEAD
phase_types 7 emitters 1 tools 29

# in-memory counterfactual plants (scratchpad test, monkeypatch only)
2 passed in 0.53s      (each = the real 259 isolation test FAILED under the planted bypass)

# live local DB, read-only
rls True
policies ['expert_bundles_read_policy', 'expert_bundles_write_policy']
seed {'slug': 'financial-analyzer', 'is_system': True, 'org_id': None, 'visibility': 'public'}
tier [<Record tier='enterprise' enabled=True>]
anon visible rows 0

# live cross-org RLS probe (single transaction, always rolled back)
member sees probe bundle: 1
outsider sees probe bundle: 0
left behind: 0
```

No frontend files belong to this phase (UI hint: no), so no vitest run was required. Full suites deliberately not run.

## Review-Fix Confirmation

| Finding | Claimed fix | Confirmed in code |
|---|---|---|
| F-1 folder arm admitted another user's private folder | owner-or-shared rule | yes — `expert_service.py:486-489`; `test_resolve_strips_unshared_same_org_foreign_user_folder` green |
| F-2 fence could not see non-"expert"-named growth | count pins on all 3 registries | yes — `test_259_closed_core_inventory.py:20,30,40` |
| F-3 `0/0/0` ledger rows | re-measured triples | not re-audited here (bookkeeping; no bearing on any SC) |
| post-close `4c2428063` | 5 fixtures given NOT NULL `visibility`/`created_by` | yes — e.g. `test_259_expert_member_isolation.py` bundle_row carries `"visibility": "org"`, `"created_by"` |

## Anti-Patterns / Observations

| File | Finding | Severity | Impact |
|---|---|---|---|
| live local DB, `public.expert_bundles` | `anon` holds `INSERT, SELECT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER`, although migration 187 grants only to `authenticated, service_role`. These come from Supabase default privileges in `public` — `public.documents` shows the identical anon set. RLS neutralises SELECT/INSERT/UPDATE/DELETE (no policy targets `anon`; measured `anon visible rows 0`), but **TRUNCATE is not subject to RLS**. | INFO (project-wide, not a 259 defect) | 259-REVIEW's "Migration 187 carries NO `anon` grant" is true of the file and not of the database. Belongs to the BUG-260911-01 class (`get_advisors(security)` in the deploy parity checklist); does not affect SC#2, which is about authenticated cross-org users. |
| 259 source files | no TBD / FIXME / XXX / TODO markers | — | — |

## Human Verification Required

None. The phase is backend data plus API only, the ROADMAP sets UI hint `no`, and no live UAT rows are owed by this phase's record. Consuming the bundle in chat is Phase 260's job.

## Gaps Summary

No gaps. All three success criteria hold against current HEAD, not only at the phase's close: the closed-core inventory is 7/1/29 at both the base commit and HEAD; cross-org isolation holds at the RLS layer (live probe) and at the member layer (independent per-arm checks, proven non-vacuous by planted bypasses); and the tier refusal comes from the single Phase 258 `require_capability` home. One accepted operator decision (D-259-06) is recorded under `deferred`. The only open item is informational: default-privilege `anon` grants on `expert_bundles`, which are project-wide.

---

_Verified: 2026-09-23_
_Verifier: Claude (gsd-verifier), independent_
