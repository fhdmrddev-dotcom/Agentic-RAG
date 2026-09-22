---
phase: 258-a-tier-becomes-enforceable
verified: 2026-09-23
verification_mode: independent
verifier: Claude (gsd-verifier) — did not build this phase
head_verified: c6e29b42e (develop)
status: human_needed   # was gaps_found at independent verification; see the addendum at the end
score: 4/5 success criteria verified (SC#3 partial) · requirements 4/5 satisfied (TIER-03 partial)
overrides_applied: 0
gaps:
  - truth: "SC#3 — A refusal names the tier that would allow the action (TIER-03)"
    status: partial
    reason: >
      The F-2 fix (c28853142) added an entitlement refusal to launch_scheduled_run that returns None
      without saying why. The manual trigger door POST /schedules/{id}/trigger (api/schedules.py:267-271)
      maps every None to "the scheduled workflow could not be loaded (deleted, or no longer yours)".
      So an unentitled org that presses "Run now" gets HTTP 200 launched=false with a FALSE reason and
      no tier named. That is the support ticket TIER-03 exists to prevent, and it is on a door this
      verification was asked to check.
    artifacts:
      - path: "backend/app/services/scheduler_service.py"
        issue: "lines 131-145: entitlement denial collapses to `return None`, indistinguishable from 'definition missing'"
      - path: "backend/app/api/schedules.py"
        issue: "lines 267-271: None always reported as 'could not be loaded (deleted, or no longer yours)'"
    missing:
      - "On the manual trigger route, call enforce_entitlement(pool, launch_row org_id, 'workflows') before launch_scheduled_run, so the caller gets the structured 403 naming required_tier (<=10 lines, no schema/API-shape change — G-3 /gsd:fast size)"
      - "A test that drives POST /schedules/{id}/trigger for an unentitled org and asserts detail.required_tier"
  - truth: "Phase goal — 'a refusal is something a buyer can act on rather than a support ticket' — on the workflow surfaces"
    status: partial
    reason: >
      The backend 403 carries required_tier/upgrade_hint as a dict `detail`, but every workflow client
      throws it away: sending a workflow kickoff shows "Failed to send message" (frontend/src/lib/api/threads.ts:584-586
      keeps detail only if it is a string); creating a draft shows "Failed to create workflow draft (status 403)"
      (lib/api/workflows.ts:279); publishing shows "Failed to publish workflow (status 403)" (lib/api/workflows.ts:1003).
      Only lib/api/experts.ts:164 reads upgrade_hint. The ROADMAP marked this phase "UI hint: no", so this may be
      accepted as out of scope, but no decision in the phase record says so.
    artifacts:
      - path: "frontend/src/lib/api/threads.ts"
        issue: "structured entitlement detail replaced by generic 'Failed to send message'"
      - path: "frontend/src/lib/api/workflows.ts"
        issue: "createWorkflowDraft / publishWorkflow discard the body on 403"
    missing:
      - "Either read detail.upgrade_hint / detail.detail on 403 in the three workflow clients (mirroring lib/api/experts.ts:155-175), or record an operator decision that UI surfacing of workflow refusals is deferred"
  - truth: "SC#1 — every gated capability calls the one check (TIER-01): the side doors of the `workflows` capability"
    status: partial
    reason: >
      The launch doors are now gated (see SC#1 evidence), and the capability-level reading of SC#1 holds. But these
      `workflows` routes carry only require_visible("workflow_authoring") and no require_capability("workflows"):
      POST /workflows/generate (api/workflows.py:1868 — LLM-powered, spends tokens for an unentitled org),
      PATCH /workflows/{id} (:1486), POST /workflows/template/placeholders (:1982), POST /workflows/{id}/template (:2099),
      and schedule create/patch (api/schedules.py:88, :173 — a Standard org can create a schedule that will never fire).
      The 258 review named /generate and the template routes as ungated; the F-2 fix closed execution only.
    artifacts:
      - path: "backend/app/api/workflows.py"
        issue: "generate / update_draft / template routes lack the entitlement dependency"
      - path: "backend/app/api/schedules.py"
        issue: "schedule create / patch lack the entitlement dependency"
    missing:
      - "Add Depends(require_capability('workflows')) beside the existing require_visible on each route (one line per route), OR record an operator decision that SC#1 is satisfied at the capability level and the side doors are accepted"
deferred:
  - truth: "Capabilities in the seeded map other than workflows/experts (skills, code_execution, custom_models, connectors, audit_export) are not wired to any gate"
    addressed_in: "accepted deviation — D-258-09"
    evidence: >
      258-DISCUSSION-LOG.md 'First Live Gated Consumer (Proof Slice)': "User's choice: Workflows API (POST /workflows and
      POST /workflow-runs) — D-258-09 locked"; 258-CONTEXT.md In Scope: "Consumer Wiring (Proof Slice)". The operator chose a
      one-capability proof slice; experts was added by Phase 259 (PACK-06).
  - truth: "Migration 186 applied to production, both production orgs given a tier, and 186's GRANT SELECT ... TO anon revoked by a follow-up migration"
    addressed_in: "v4.3 milestone-close batch (operator decision 2026-09-19)"
    evidence: >
      258-REVIEW.md F-5: "Operator decision 2026-09-19: production migrations are applied as a batch at milestone close";
      ROADMAP.md milestone checklist row 2 (BUS-283). Deploy parity, not code — but it is SECURITY- and availability-bearing:
      shipping this backend before tiers are set refuses workflow authoring AND now execution for both production orgs.
human_verification:
  - test: "In the running app, with an org set to subscription_tier='standard' (rolled back afterwards), try to (a) run a published workflow from chat, (b) create a workflow draft, (c) press Run now on a schedule"
    expected: "Each is refused and the person is told which tier would allow it"
    why_human: "Only a lived run shows what the buyer actually reads; code inspection shows (a)/(b) render generic errors and (c) renders a false reason, so this row is expected to FAIL until gaps 1-2 are closed"
---

# Phase 258: A Tier Becomes Enforceable — Verification Report

**Phase Goal:** What an org has paid for decides what it can do, from **one** place, and a refusal names the tier that would allow it — so re-packaging is a row change and a refusal is something a buyer can act on rather than a support ticket.
**Verified:** 2026-09-23, independent, against develop HEAD `c6e29b42e`
**Status:** gaps_found
**Re-verification:** No — first VERIFICATION.md for this phase (the phase closed on 258-REVIEW.md PASS; the v4.3 audit recorded "no VERIFICATION.md").

## Headline

**F-2 is genuinely closed.** Workflow execution is now gated at both launch doors, and I proved the new tests
are not vacuous by running them against the pre-fix code: **5 failed, 2 passed** there, **7 passed** at HEAD.
The core machinery (one home, data-driven map, fail-closed, AST fence) also holds on the **real SQL**,
checked inside a rolled-back transaction against the local database.

**What stops a clean pass:** the F-2 fix added a refusal that **does not name the tier**. Pressing "Run now" on a
schedule for an unentitled org answers *"could not be loaded (deleted, or no longer yours)"*, which is false.
Two smaller issues ride with it: the frontend drops the tier name on all three workflow surfaces, and five
authoring side-doors of the `workflows` capability are still ungated. Each fix is one to ten lines.

## Goal Achievement — Success Criteria

| # | Success criterion | Status | Evidence |
|---|---|---|---|
| 1 | One entitlement check, one home, reads `subscription_tier` + `add_ons`; every gated capability calls it; nothing else reads those columns (TIER-01) | ✓ VERIFIED (warning: side doors, gap 3) | The only reader is `backend/app/db/entitlements.py:135-146` (`SELECT subscription_tier, add_ons FROM public.organizations`), reached only through `services/entitlement_service.py:83` `check_entitlement` / `:110` `enforce_entitlement` / `:132` `require_capability`. `grep -rn "subscription_tier\|add_ons" backend/app` outside those two files returns **nothing**. Callers: `api/workflows.py:1301` (publish), `:1401` (create_draft), `services/workflow_kickoff.py:212-216` (chat kickoff — **execution, new**), `services/scheduler_service.py:135-145` (scheduled launch — **execution, new**), `api/experts.py:44` (router-level), `api/threads.py:724-725` (expert invite). Golden runs start inside publish (`publish_service.py:1598`), which is gated. **Execution now gated: the audit's TIER-01 blocker is closed.** Ungated side doors are gap 3. |
| 2 | Tier contents are data: moving a capability between tiers is a row change, no code edit, no deploy (TIER-02) | ✓ VERIFIED | `supabase/migrations/186_tier_capabilities.sql` holds `tier_capabilities(tier, capability, enabled)`; lookups at `entitlements.py:30-36, 51-58, 72-82` contain no tier branches. **Driven live**, rolled-back tx on local Postgres: insert `('standard','workflows')` → standard org **allowed**; then move workflows to `pro` only → standard org refused with **required_tier `pro`**. Both tables md5-identical afterwards. Limit (from review F-7, not a defect against the wording): a **fourth tier slug** still needs a `TIER_ORDER` edit (`entitlements.py:12-16`). |
| 3 | A refusal names the tier that would allow it — no bare 403 anywhere (TIER-03) | ⚠ PARTIAL (gap 1, gap 2) | Backend 403s are structured: `EntitlementDeniedException` (`entitlement_service.py:38-60`) → `error: entitlement_required`, `required_tier`, `current_tier`, `upgrade_hint`; driven live: standard → `required_tier=enterprise`, `"Upgrade to Enterprise to use workflows."`. DB failure → 503, not 403 (`:63-80`, `:125-127`). **But** the manual schedule trigger refuses with a false, tier-less reason (`scheduler_service.py:137-145` → `api/schedules.py:267-271`), and the frontend drops the tier on chat-send, draft-create and publish (`lib/api/threads.ts:584-586`, `lib/api/workflows.ts:279`, `:1003`). |
| 4 | A second ad-hoc tier check anywhere in the backend makes a guard fail, driven RED against a plant (TIER-04) | ✓ VERIFIED | `tests/unit/test_258_single_entitlement_home.py` walks all of `backend/app` over 4 AST node types, banning both columns (`FORBIDDEN_COLUMNS = ("subscription_tier", "add_ons")`) plus 10 function-name patterns. **Driven by me without touching the tree:** ran the real fence function against a scratch copy with a planted `org['add_ons']` read → **RED**; a planted `SELECT subscription_tier FROM organizations` → **RED**; real tree → **GREEN**. ⚠ Warning: the in-file non-vacuity test (`:118-160`) **re-implements** the detection logic instead of calling the fence, so it cannot notice if the fence drifts. The external drive above covers that for now. |
| 5 | An unreadable tier is refused, that arm is driven, and the contrast with `load_run_budget`'s fail-open is written down (TIER-05) | ✓ VERIFIED | `entitlements.py:152-156`: NULL/blank tier → refused (`"Organization has no subscription tier assigned (fail-closed)"`); `:141-142` unknown org refused; `:167-169` DB exception refused; `enforce_entitlement` refuses `org_id=None` (`entitlement_service.py:120-123`). **Driven live**: NULL tier → `allowed=False, required_tier=enterprise`; random org → `allowed=False, "Organization not found"`. Unit-driven: `test_resolve_org_entitlement_refused_on_null_tier`, `..._on_empty_whitespace_tier`, `test_fail_closed_on_unassigned_tier` (HTTP level), `test_no_resolvable_org_fails_closed`. Contrast recorded as a decision: `258-CONTEXT.md` D-258-06 *"Architectural Contrast: load_run_budget ... deliberately fails open ... entitlement gates revenue ... failing open would allow unauthorized usage"*, and `entitlement_service.py:9`. Deliberate exception pinned: an add-on grants even on a NULL tier (`test_resolve_org_entitlement_null_tier_with_addon_override`, D-258-08). |

**Score:** 4/5 success criteria verified; SC#3 partial.

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| TIER-01 | 258-01, 258-02, 258-03 (+ fix c28853142) | ONE reusable entitlement check, one home, reading `subscription_tier` + `add_ons` | ✓ SATISFIED (warning: gap 3) | SC#1 row. Execution gated at `workflow_kickoff.py:212-216` and `scheduler_service.py:135-145`; pre-fix run of the new tests: 5 failed / 2 passed. |
| TIER-02 | 258-01, 258-03 | Capability map as data, re-packaging is a row change | ✓ SATISFIED | SC#2 row; live rolled-back row change moved the verdict both ways. |
| TIER-03 | 258-02, 258-03 | A refusal names the tier that would allow it; never a bare 403 | ⚠ PARTIAL | SC#3 row; gap 1 (schedule trigger false reason), gap 2 (frontend drops the tier). |
| TIER-04 | 258-02 (+ review fix a9bf8ef07) | Guard fails on a second ad-hoc tier check | ✓ SATISFIED | SC#4 row; the fence went RED on two independent plants, including the `add_ons` column the review found unguarded (F-3). |
| TIER-05 | 258-01, 258-02, 258-03 (+ review fix a9bf8ef07) | Fails closed on an unreadable tier, arm driven, contrast recorded | ✓ SATISFIED | SC#5 row; review F-1 (NULL tier fell back to `standard`) confirmed fixed in code at `entitlements.py:145, 152-156`, and driven live. |

No orphaned requirements: REQUIREMENTS.md maps exactly TIER-01..05 to Phase 258.

## Review Findings — Confirmed in Code, Not Taken From the Review

| Finding | Claimed | Confirmed at HEAD |
|---|---|---|
| F-1 NULL tier fail-open | fixed a9bf8ef07 | ✓ `entitlements.py:145` `... or None`, `:154-156` refuses; live NULL-tier drive refused |
| F-2 execution ungated | fixed c28853142 | ✓ both launch doors gated; tests RED on pre-fix code. ⚠ introduced gap 1 |
| F-3 fence missed `add_ons` | fixed a9bf8ef07 | ✓ `FORBIDDEN_COLUMNS` includes it; planted `add_ons` read went RED |
| F-4 DB outage → 403 "upgrade" | fixed a9bf8ef07 | ✓ `EntitlementUnavailableException` 503; `test_entitlement_db_error_is_503_not_upgrade` passes. Residual (review): the 403/503 split still sniffs `"database error"` prose, `entitlement_service.py:125` ↔ `entitlements.py:169` |
| F-5 mig 186 not in prod | operator: milestone-close batch | deferred, see frontmatter |
| F-7 `TIER_ORDER` dead | fixed | ✓ used at `entitlements.py:82` |

## Key Link Verification

| From | To | Via | Status |
|---|---|---|---|
| `POST /threads/{id}/messages` | `enforce_entitlement(..., "workflows")` | `threads.py:944-946` stamps validated `X-Org-Id` into `current_user["org_id"]` → `preflight_workflow_kickoff` → `workflow_kickoff.py:212-216`, before the definition resolve | WIRED |
| scheduler tick / manual trigger | `check_entitlement(..., "workflows")` | `scheduler_service.py:135-145`, before the thread insert | WIRED (refusal reason lost at the trigger route — gap 1) |
| `POST /workflows`, `/{id}/publish` | `require_capability("workflows")` | `workflows.py:1301, 1401` | WIRED |
| `check_entitlement` | `public.tier_capabilities` + `public.organizations` | `db/entitlements.py` | WIRED — real SQL driven live |
| 403 detail | the person | frontend clients | NOT WIRED for workflows (gap 2); WIRED for experts (`lib/api/experts.ts:164`) |

## Commands Run and Literal Results

From `backend/`:

```
venv/Scripts/python.exe -m pytest tests/unit/test_258_entitlement_service.py tests/unit/test_258_single_entitlement_home.py \
  tests/unit/test_258_tier_capabilities_db.py tests/unit/test_258_workflow_entitlement_gate.py \
  tests/unit/test_258_workflow_execution_entitlement.py tests/unit/test_259_expert_entitlement_gate.py \
  tests/unit/test_scheduler_string_guard.py tests/unit/test_198_node_vocabulary.py -q -p no:cacheprovider
→ 60 passed, 1 warning in 2.48s
```

Is the F-2 test real? Same test file, run with the **pre-fix** `workflow_kickoff.py` and `scheduler_service.py`
(`git show c28853142^:...`) loaded in memory. Nothing on disk changed:

```
→ 5 failed, 2 passed, 1 warning in 0.63s
  FAILED ...::test_standard_org_cannot_run_a_workflow_and_nothing_is_resolved
  FAILED ...::test_no_resolvable_org_fails_closed
  FAILED ...::test_entitlement_db_error_is_503_not_upgrade
  FAILED ...::test_unentitled_schedule_is_not_launched_and_writes_nothing[<org>-ent0]
  FAILED ...::test_unentitled_schedule_is_not_launched_and_writes_nothing[None-ent1]
```
(The 2 that pass pre-fix are the correct controls: entitled org passes, plain Deep send never consults the check.)

TIER-04 fence, run against a scratch copy of `app/` with a planted module (scratchpad only):

```
REAL TREE: fence GREEN
PLANTED: fence RED -> services\planted.py:2 directly reads dictionary key 'add_ons': 'org['add_ons']'
PLANTED2: fence RED -> services\planted.py:2 contains SQL query referencing 'subscription_tier'
```

Live, local Postgres `127.0.0.1:54322`. Read-only first, then one **rolled-back** transaction:

```
rows: 16
workflows tiers: ['enterprise']
enterprise {} -> True enterprise None None            (x5 local orgs)

A standard      -> False standard enterprise Upgrade to Enterprise to use workflows.
B NULL tier     -> False None enterprise Organization has no subscription tier assigned (fail-closed)
C add_on list   -> True Granted via add_on override
D row change    -> True standard
E moved to pro  -> False standard pro
F unknown org   -> False None Organization not found
orgs md5 identical: True | tier_capabilities md5 identical: True
```

Full suites were not run, as instructed. No inherited failure showed up in the targeted set, so no base-commit comparison was needed.

## Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| `backend/app/api/schedules.py` | 267-271 | Different failures fold into one misleading message | 🛑 Blocker (SC#3) | Entitlement refusal reported as "deleted, or no longer yours" |
| `backend/app/services/entitlement_service.py` | 125 | 403/503 chosen by matching prose in the reason string | ⚠ Warning | Pinned by a test, but the failure would not explain the consequence (review F-4 residual) |
| `backend/app/services/entitlement_service.py` | 46-52 | `required_tier or "enterprise"` hardcoded fallback in the message | ℹ Info | For no-org / unknown-org refusals, the text says "enterprise" even if the capability is repackaged to a lower tier; the payload field is `None` |
| `backend/tests/unit/test_258_single_entitlement_home.py` | 118-160 | Non-vacuity test copies the detector instead of calling it | ⚠ Warning | Fence drift would not turn this test red |
| `supabase/migrations/186_tier_capabilities.sql` | GRANT / policy | `SELECT ... TO anon` on the pricing matrix | ⚠ Warning | Deferred (F-5) to a follow-up revoke migration |

No TBD/FIXME/XXX markers in the phase's source files.

## Human Verification Required

### 1. Refusal legibility, lived

**Test:** Set a local org to `standard` (then restore it). Try three things: run a published workflow from chat, create a workflow draft, press Run now on a schedule.
**Expected:** Each one is refused, and the message names the tier that would allow it.
**Why human:** Only a real run shows what the buyer reads. From the code, this is expected to **fail** today on all three (gaps 1-2).

## Gaps Summary

All three gaps have one root cause: **the gate now refuses correctly, but the refusal does not always reach
the person as something they can act on, and a few doors skip the gate.**

1. **Schedule "Run now" gives a false, tier-less reason.** This came from today's F-2 fix. It is the only direct
   SC#3 failure. Fix: one `enforce_entitlement` call on the trigger route (G-3 size).
2. **The frontend drops the tier name on workflow surfaces.** The backend is correct; the clients keep only
   string `detail`s. The phase was marked "UI hint: no", so the operator may accept this. If so, it needs a
   recorded decision.
3. **Five `workflows` side doors are ungated** (`/generate`, PATCH draft, the two template routes, schedule
   create/patch). SC#1 holds at the capability level. Fix: one `Depends` line per route, or accept it by decision.

These are not structural. Items 1 and 3 together are under ~15 lines. Under G-3/G-7, this is `/gsd:fast` work
or an explicit accept. It is not another gap-closure round. **No other ROADMAP success criterion is unmet.**

---

_Verified: 2026-09-23_
_Verifier: Claude (gsd-verifier), independent_

---

## Addendum 2026-09-23 — gaps closed after this verification (v4.3 milestone close)

⚠ **These closures were made by the milestone-close orchestrator, not by this verifier.** Each was
driven RED-first and re-driven green with targeted suites; none has had an independent review
cycle. The verification above is left unedited, because it is what found them.

| Gap | Closed by | Proof |
|---|---|---|
| SC#3/TIER-03 — schedule run-now answered a tier refusal with "deleted, or no longer yours" | `124dc444b` | the trigger route now carries `require_capability("workflows")` → structured 403 before launch |
| TIER-03 — frontend dropped the named tier on chat send, draft create, publish | `124dc444b` | one reader `entitlementRefusalMessage` in `lib/api/_core.ts`; `entitlementRefusal.test.ts` 4/4, RED 2/4 without the fix |
| SC#1/TIER-01 — six ungated authoring write doors | `124dc444b` | `test_258_every_authoring_write_is_tier_gated.py` walks the real routers: 10 pass, RED 7/10 without the fix. GET/DELETE deliberately exempt |
| Anon SELECT on the pricing map (mig 186) | `e4ac67ff9` | migration 192, applied locally, ACL parity 157/157 |

**Still owed (human):** drive the three refusals with a standard-tier org. Production still needs
migrations 186/192 and a tier on both orgs before the backend ships.
