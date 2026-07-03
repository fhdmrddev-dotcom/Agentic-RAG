---
phase: 136-skill-publish-gate-gate-01
verified: 2026-07-03T09:00:00Z
status: passed
human_verified: 2026-07-03 — all 4 G-4 lived-UAT items passed live (Chrome MCP session + DB evidence; see 136-HUMAN-UAT.md)
score: 16/16 must-haves verified
overrides_applied: 0
human_verification:
  - test: "G-4 lived UAT — publish dialog UNMET path (share a never-evaled skill)"
    expected: "In the live app, on a private never-evaled skill click \"Share globally\" -> the dialog shows the honest unmet status + a pointer to run an eval + a Force-publish action; Force-publish -> the skill goes global"
    why_human: "User-visible dialog UX; lived-experience bar per G-4 guardrail — deferred from checkpoint:human-verify to end-of-phase (136-VALIDATION.md Manual-Only)"
  - test: "G-4 lived UAT — publish dialog MET path (run a passing eval, then share)"
    expected: "Run an eval that passes on the skill's current instructions -> click \"Share globally\" -> the dialog shows \"Eval passed X/N on the current version\" + Publish -> skill goes global"
    why_human: "Requires a real passing eval run + live dialog interaction"
  - test: "G-4 lived UAT — unshare never gated + re-share re-gates"
    expected: "Unshare a global skill (no dialog, immediate) -> re-share while the current version is unmet -> the gate blocks again (no grandfathering)"
    why_human: "Lived toggle-both-ways behavior; sequencing across two actions"
  - test: "G-4 lived UAT — SkillEvalSection gate-status line + override record"
    expected: "Open the skill's eval section -> the publish-readiness line reflects the current gate state; after a force-publish, the \"published without a passing eval\" override record shows"
    why_human: "Rendered inside the large eval surface; visual/lived; also exercises the WR-05 staleness caveat found in code review"
---

# Phase 136: Skill Publish Gate (GATE-01) Verification Report

**Phase Goal:** A skill can be published (global/shareable) only after >=1 eval has run and passed; the publish flow surfaces the gate with a clear status. Future-publish-only (no retroactive gating of already-global skills). UI hint: publish-flow gate status.
**Verified:** 2026-07-03T09:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Attempting to publish a skill with no passing eval surfaces the unmet gate with a clear status and blocks (or warns with evidence) (ROADMAP SC#1) | VERIFIED | `PATCH /skills/{id}/toggle-global` returns structured `409 {"error":"publish_gate_unmet","gate":...}` when unmet+no override (`backend/app/api/skills.py:450-458`); `test_toggle_global_blocked_when_no_passing_eval` passes live |
| 2 | After >=1 eval has run and passed, the same skill can be published and the flow shows the gate satisfied (ROADMAP SC#2) | VERIFIED | `test_toggle_global_allowed_after_passing_eval` passes (200 + `is_global=true`); `PublishGateDialog.tsx` met-branch renders "Eval passed X/N on the current version" + Publish action (test-verified) |
| 3 | The gate applies only to future publish actions — already-global skills are not retroactively gated (ROADMAP SC#3) | VERIFIED | Migration 084 contains zero `UPDATE ... skills` / `is_global` statements (grep confirms); D-08 only hard-sets `is_global=false` on NEW creates/imports; existing global rows untouched |
| 4 | `compute_publish_gate` returns `met` only when a completed `eval_runs` row has `measured_count>=1 AND passed_count==measured_count` (D-03) | VERIFIED | `_passes_d03()` in `publish_gate_service.py:53-62`; `test_gate_met_after_passing_eval_current_version` + `test_gate_unmet_when_no_passing_eval` pass |
| 5 | Interrupted/cancelled/non-completed runs never satisfy the gate (D-03) | VERIFIED | `.eq("status","completed")` filter in the read (`publish_gate_service.py:97`); `test_interrupted_run_does_not_satisfy` passes (adversarial non-completed row carrying passing counts still excluded) |
| 6 | Gate binds by instruction-content equality (edit resets gate; 135-promotion near-dup still reads passed) (D-04) | VERIFIED | `_on_current_version()` compares pinned `skill_versions.instructions == current_instructions` (`publish_gate_service.py:145-147`); `test_edit_after_pass_resets_gate` + `test_promoted_near_dup_version_counts_as_current` both pass |
| 7 | `skill_publish_overrides` is an append-only, owner-only-SELECT-RLS table live in the local DB (D-02, D-11) | VERIFIED | Live psycopg2 check: `to_regclass('public.skill_publish_overrides')` non-null, `relrowsecurity=True`, exactly one policy (`SELECT`, owner-only), zero write policies. `supabase/full-schema.sql` regenerated with the table |
| 8 | `PublishGate` carries `last_override` for an honest "published without passing eval" status (D-02) | VERIFIED | `PublishGate.last_override` field (`backend/app/models/skill.py`); `compute_publish_gate` reads `order("created_at",desc=True).limit(1)`; covered inside `test_gate_met_after_passing_eval_current_version` (two override rows seeded, newest returned) |
| 9 | Gate compute is additive/owner-scoped, no agent-loop/threads.py touch (D-10) | VERIFIED | `git log` for all 136 commits shows only `skills.py`, `publish_gate_service.py`, `models/skill.py`, migration 084, and frontend skill files — zero touches to `agent_loop.py`/`threads.py` |
| 10 | Owner cannot flip private->global without an explicit override when gate unmet (D-07/D-01) | VERIFIED | `toggle_global` gates the `new_value is True` branch only (`skills.py:450`); `test_toggle_global_blocked_when_no_passing_eval` |
| 11 | Force-publish applies the UPDATE AND writes an owner-visible `skill_publish_overrides` row (gate snapshot + version + when) (D-01/D-02) | VERIFIED | `skills.py:459-497`; `test_force_publish_records_override` asserts exactly one row with `gate_snapshot` + `skill_version_id` == seeded latest version |
| 12 | `POST /skills` hard-sets `is_global=false`, ignoring client value (D-08) | VERIFIED | `skills.py:185` literal `"is_global": False` (not `body.is_global`); `test_create_skill_ignores_body_is_global` passes; import path (`skills.py:255`) also hard-codes `False` |
| 13 | Global->private unshare is never gated; re-share re-runs the gate fresh (D-07/D-09) | VERIFIED | Gate call is inside `if new_value is True` only (`skills.py:450`); `test_unshare_never_gated_reshare_regated` passes |
| 14 | `GET /skills/{id}/publish-gate` returns server-computed `PublishGate`, ignoring client input (D-05/D-07) | VERIFIED | `skills.py:511-540`; owner-verified then delegates to `compute_publish_gate`; no client-supplied gate data accepted |
| 15 | "Share globally" opens a confirm dialog rendering server gate status (met satisfied vs honest unmet + Force-publish) (D-05) | VERIFIED | `PublishGateDialog.tsx` renders both branches from `getPublishGate`; `SkillCard.tsx:225-233` branches Globe-click on `skill.is_global` (share->dialog, unshare->direct); 2 component tests pass. **Caveat:** code review WR-01 found a stale-client-state edge case that can bypass the dialog on the unshare direction under a race — flagged as anti-pattern below, not a primary-path failure |
| 16 | `SkillEvalSection` shows a plain gate-status line (met X/N vs honest unmet) + owner-visible override record (D-06/D-02) | VERIFIED | `SkillEvalSection.tsx:543-567` renders `publishGate.met`/`unmetGateLine`/`last_override`; hydrated inside `useEffect [skillId]` (`:374-380`); 3 component tests pass. **Caveat:** code review WR-05 found the line does not re-fetch after in-session actions that change the gate (eval completes, promotion, force-publish) — stale until skill switch/reload; flagged below |

**Score:** 16/16 truths verified (0 failed)

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `supabase/migrations/084_skill_publish_overrides.sql` | Append-only override audit table + owner-only SELECT RLS | VERIFIED | 76 lines; table + indexes + RLS policy present; applied live (confirmed via psycopg2) |
| `supabase/full-schema.sql` | Regenerated bootstrap artifact including 084 | VERIFIED | grep confirms `CREATE TABLE public.skill_publish_overrides`, FKs, indexes, RLS policy comment |
| `backend/app/services/publish_gate_service.py` | `compute_publish_gate(supabase, skill_id, user_id)` read-model | VERIFIED | 209 lines; substantive D-03/D-04 logic, 4 owner-scoped threadpool reads, honest state precedence |
| `backend/app/models/skill.py` | `PublishGate` + `TogglePublishBody` Pydantic models | VERIFIED | Both classes present with documented fields; `SkillCreate.is_global` retained per plan |
| `backend/tests/test_publish_gate.py` | Gate-compute + enforcement unit tests | VERIFIED | 503 lines, 11/11 tests pass (0 skipped) — ran directly, not just SUMMARY claim |
| `backend/app/api/skills.py` | Gated `toggle_global` + closed create side door + GET publish-gate | VERIFIED | All three edits present and match plan spec exactly (read + reviewed) |
| `frontend/src/types/index.ts` | `PublishGate` TS interface | VERIFIED | Exact 7-field mirror of backend model (`:654-662`) |
| `frontend/src/lib/api.ts` | `getPublishGate` + `toggleSkillGlobal(id, override?)` with 409 parsing | VERIFIED | `PublishGateError` typed carrier, 409 branch, `getPublishGate` GET client all present and correct |
| `frontend/src/hooks/useSkills.ts` | `toggleGlobal(id, override?)` passthrough | VERIFIED | Signature widened, passes through to `apiToggleSkillGlobal`, updates local state on success |
| `frontend/src/components/skills/PublishGateDialog.tsx` | Thin confirm dialog | VERIFIED | 161 lines; only `@/components/ui/alert-dialog` primitives imported (137 fence held); both met/unmet branches implemented |
| `frontend/src/components/skills/PublishGateDialog.test.tsx` | Component tests | VERIFIED | 2 tests, both pass (met 3/3 + Publish; never_evaled + Force publish) |
| `frontend/src/components/skills/SkillCard.tsx` | Share/unshare intercept | VERIFIED | Globe onClick branches on `skill.is_global`; `PublishGateDialog` mounted with correct `onConfirm` wiring |
| `frontend/src/components/skills/SkillEvalSection.tsx` | Gate-status line + override record | VERIFIED | `publishGate` state hydrated in `useEffect [skillId]`, rendered near top of section, server-fields only |
| `frontend/src/components/skills/SkillEvalSection.test.tsx` | Component tests | VERIFIED | 3 tests, all pass (met/unmet/override-record) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|-----|-----|--------|---------|
| `skills.py toggle_global` | `publish_gate_service.compute_publish_gate` | gate recompute before private->global UPDATE | WIRED | `skills.py:451` calls `await compute_publish_gate(...)` inside `new_value is True` branch only |
| `skills.py toggle_global` override branch | `skill_publish_overrides` | service-role INSERT wrapped in `run_in_threadpool` | WIRED | `skills.py:480-497`, `run_in_threadpool(_insert_override)` confirmed |
| `SkillCard.tsx` | `PublishGateDialog` | Globe click branches on `skill.is_global` | WIRED | `SkillCard.tsx:225-233` (branch) + `:269-276` (mount + onConfirm) |
| `PublishGateDialog.tsx` | `/skills/{id}/publish-gate` | `getPublishGate` on open | WIRED | `useEffect [open, skillId]` calls `getPublishGate(skillId)` (`PublishGateDialog.tsx:52-72`) |
| `SkillEvalSection.tsx` | `/skills/{id}/publish-gate` | `getPublishGate` on mount `useEffect [skillId]` | WIRED | `SkillEvalSection.tsx:374-380`, inside the existing init block, skill-switch guarded |
| `SkillsPage.tsx` | `useSkills().toggleGlobal` -> `SkillCard.onToggleGlobal` | prop passthrough | WIRED | `SkillsPage.tsx:23,149` — `toggleGlobal` destructured from `useSkills()` and passed as `onToggleGlobal` |
| `SkillFormDialog.tsx` | `SkillEvalSection` | existing mount point | WIRED | `SkillEvalSection` is consumed by `SkillFormDialog.tsx` (pre-existing surface), not orphaned |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|---------------------|--------|
| `PublishGateDialog.tsx` | `gate` (PublishGate) | `getPublishGate(skillId)` -> `GET /skills/{id}/publish-gate` -> `compute_publish_gate` -> live `eval_runs`/`skill_versions`/`skills` reads | Yes | FLOWING — verified live-DB reads (not static return); 11 backend tests exercise real query predicates |
| `SkillEvalSection.tsx` | `publishGate` (PublishGate) | same `getPublishGate` chain, hydrated on mount | Yes | FLOWING |
| `skills.py toggle_global` 409 body | `gate.model_dump()` | `compute_publish_gate` (same live chain) | Yes | FLOWING — server never trusts a client-supplied gate value (T-136-03 mitigated, confirmed by code review) |

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| Backend publish-gate test module runs green (not a SUMMARY claim — executed directly by the verifier) | `cd backend && venv/Scripts/python -m pytest tests/test_publish_gate.py -v` | 11 passed, 0 skipped, 0 failed | PASS |
| Skills/eval blast-radius regression sweep | `pytest tests/test_publish_gate.py tests/test_evals_router.py tests/test_skill_proposals_router.py tests/test_skill_proposals.py tests/integration/test_skills.py tests/integration/test_skills_lint.py tests/integration/test_skills_import_export.py -q` | 58 passed | PASS |
| Live DB table + RLS check | `psycopg2` direct query against `127.0.0.1:54322` | table exists, RLS enabled, 1 SELECT policy, 0 write policies | PASS |
| Frontend component tests (PublishGateDialog + SkillEvalSection) | `cd frontend && npm run test -- PublishGateDialog SkillEvalSection --run` | 2 test files, 5 tests passed | PASS |
| Frontend type-check | `cd frontend && npx tsc --noEmit -p tsconfig.json` | Clean, no errors | PASS |
| Migration 084 does not retroactively touch existing rows (SC#3) | `grep -in "UPDATE.*skills\|is_global" 084_skill_publish_overrides.sql` | No matches | PASS |
| No debt markers in phase-touched files | `grep -nE "TBD\|FIXME\|XXX\|TODO\|HACK\|PLACEHOLDER"` across all 9 touched source files | No matches | PASS |
| Hot-file guard: no `agent_loop.py`/`threads.py` touch across all 136 commits | `git log --oneline -- backend/app/services/agent_loop.py backend/app/api/threads.py` (cross-checked against phase commit hashes) | No 136-tagged commits present | PASS |

### Probe Execution

Step 7c SKIPPED — this phase is not a migration/tooling phase with `scripts/*/tests/probe-*.sh` conventions; no probe scripts declared in PLAN/SUMMARY/VALIDATION and none found under `scripts/`.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|--------------|--------|----------|
| GATE-01 | 136-01, 136-02, 136-03, 136-04 (all four) | A skill can only be published after >=1 eval has run and passed; the publish flow surfaces this gate with a clear status; future-publish-only | SATISFIED | All 16 observable truths above are VERIFIED with direct code/test/DB evidence, not SUMMARY narration. Note: `.planning/REQUIREMENTS.md:30,77` still shows the checkbox unchecked / status "Pending" — this is bookkeeping typically flipped at `/gsd:complete-milestone`, not a phase-verification gap (the sibling requirement EVAL-02/Phase 133, already shipped per project memory, shows the same "Pending" pattern) |

No orphaned requirements found — GATE-01 is the only requirement ID mapped to Phase 136 in REQUIREMENTS.md, and it appears in all four plans' `requirements:` frontmatter.

### Anti-Patterns Found

Sourced from the phase's own adversarial code review (136-REVIEW.md, 0 Critical / 5 Warning / 8 Info) and independently spot-checked by the verifier against the current code — all findings confirmed still present at HEAD.

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `backend/app/api/skills.py` | 410-508 (+ `SkillCard.tsx:225-233`) | WR-01: Flip-based toggle carries no target direction — a stale client (second tab/race/rapid double-click, no button-disable) can invert share/unshare intent | Warning | Server-side gate enforcement itself is never bypassed (becoming global always re-runs `compute_publish_gate`), but the confirm-dialog-always UX guarantee can be silently skipped in a race. Does not fail the primary observable truths (single-session flow tested and correct) |
| `backend/app/api/skills.py` | 428-435, 500-507 | WR-02: Step-1 owner fetch and Step-4 UPDATE in `toggle_global` run as blocking Supabase calls directly on the event loop, not `run_in_threadpool` — violates project rule D-v2.5-01 for this NEW hot path | Warning | Performance/scalability under `WORKER_COUNT=2` concurrency; does not affect functional correctness |
| `backend/app/api/skills.py` | 497-508 | WR-03: Override audit row inserted before the `is_global` UPDATE — a failed/zero-row UPDATE can strand a false "published without a passing eval" record and crash with an unhandled `IndexError` -> 500 | Warning | Narrow race (concurrent skill deletion or transient DB error); when it fires, produces an unhandled 500 and a stale audit trail |
| `backend/app/services/publish_gate_service.py` | 84-85 (callers `skills.py:451,540`) | WR-04: `compute_publish_gate`'s `LookupError` backstop is uncaught at both call sites, surfacing as an unhandled 500 instead of 403 | Warning | Only fires on a narrow race (skill deleted between owner-check and gate compute) |
| `frontend/src/components/skills/SkillEvalSection.tsx` | 155, 374-380, 543-567 | WR-05: `publishGate` is hydrated once on mount (`[skillId]` effect) and never re-fetched after in-session actions that change the server gate (eval completes, promotion, force-publish from SkillCard) | Warning | The gate-status line can contradict fresher on-screen evidence (e.g. a just-passed eval) until skill switch or page reload — a real UX honesty gap, though the base truth ("line renders server-computed status") holds on fresh mount |
| `backend/app/models/skill.py` | 57-58 | IN-01: `PublishGate.state` typed as unconstrained `str`, not a `Literal` union — a typo'd state passes validation silently and the frontend's `UNMET_COPY` lookup has no fallback | Info | Low likelihood (server-controlled enum), cosmetic if it fires |
| `backend/app/models/skill.py` | 11 | IN-02: `SkillCreate.is_global` field survives as a dead, silently-discarded input | Info | Documented D-08 intentional-ignore contract; misleading API surface only |
| `frontend/src/components/skills/SkillCard.tsx` | 225-233 | IN-03: Globe button click doesn't `stopPropagation`, so it also selects the card underneath | Info | Pre-existing pattern shared with other card actions |
| `supabase/migrations/084_skill_publish_overrides.sql` | 44-45 | IN-04: `gate_state` has no CHECK constraint; doc comment's snapshot key names (`measured`/`passed`) don't match the code's actual keys (`measured_count`/`passed_count`) | Info | Documentation drift + missing defense-in-depth constraint on an append-only audit column |
| `frontend/src/lib/api.ts` | 1612-1615 | IN-05: doc comment claims "404 cross-user" but the endpoint returns 403 | Info | Comment-only drift |
| `frontend/src/components/skills/SkillEvalSection.test.tsx` | 27-33 | IN-06: `vi.mock` factory covers only 5 of 14 `@/lib/api` exports the component imports | Info | Test-suite completeness gap, not a production defect |
| `frontend/src/components/skills/PublishGateDialog.tsx` | 107, 130-157 | IN-07: gate-load failure has no retry affordance beyond Cancel | Info | Minor UX polish item |
| `frontend/src/components/skills/SkillEvalSection.tsx` | 118-128 | IN-08: unmet-gate copy doesn't distinguish "never published" from "published, but current version hasn't re-passed" | Info | Copy-clarity gap on an already-global skill whose instructions were edited |

None of the above are BLOCKER-severity: the code reviewer found 0 Critical findings, and the verifier's independent re-check confirms the core enforcement invariant (server recomputes the gate from `eval_runs` on every private->global transition; no client-side gate math anywhere) holds under all paths traced. WR-01 and WR-05 are the two most user-visible items and are worth a small follow-up fix, but neither invalidates a phase must-have as literally stated.

### Human Verification Required

The phase's own `136-VALIDATION.md` (Manual-Only Verifications section, G-4 guardrail) explicitly defers 4 lived-UAT checks to end-of-phase rather than checkpoint:human-verify. Per the harvest instruction (`workflow.human_verify_mode = end-of-phase`), these are surfaced here rather than re-derived:

### 1. Publish dialog — UNMET path

**Test:** On a private, never-evaled skill, click "Share globally" in the live app.
**Expected:** The dialog shows the honest unmet status (e.g. "This skill has never been evaled...") + a pointer to run an eval + a "Force publish anyway" action; clicking Force-publish successfully makes the skill global.
**Why human:** User-visible dialog UX; G-4 lived-experience bar (structural test only proves the component renders the right text given a mocked response — not that the real end-to-end interaction feels right).

### 2. Publish dialog — MET path

**Test:** Run a passing eval on a skill's current instructions, then click "Share globally".
**Expected:** The dialog shows "Eval passed X/N on the current version." and a "Publish" action that succeeds.
**Why human:** Requires a real eval run through the live agent/provider path plus the live dialog interaction.

### 3. Unshare never gated + re-share re-gates

**Test:** Unshare an already-global skill (expect immediate, no dialog), then re-share it while its current version's gate is unmet.
**Expected:** Unshare completes with no dialog; the re-share attempt is blocked again by the gate (no grandfathering from having been global before).
**Why human:** Multi-step lived sequence across two toggle actions.

### 4. SkillEvalSection gate-status line + override record

**Test:** Open a skill's eval section; observe the publish-readiness line. Force-publish the skill, then re-open the eval section.
**Expected:** The line reflects the current gate state; after a force-publish, a "Published without a passing eval on <date>" record is visible.
**Why human:** Rendered inside the large, visually dense eval surface — also the surface where code review flagged WR-05 (staleness); a human check should specifically confirm whether the line updates on the SAME visit after a force-publish action (per WR-05, it may not refresh until a skill switch/reload — worth confirming live whether this reads as acceptable or needs the WR-05 fix pulled forward).

## Gaps Summary

No BLOCKER gaps found. All 16 observable truths derived from the ROADMAP success criteria and the four plans' `must_haves` are VERIFIED against actual running code, live database state, and passing automated tests executed directly by the verifier (not taken from SUMMARY.md claims). Every artifact exists, is substantive (no stubs/placeholders), and is wired end-to-end (SkillsPage -> useSkills -> api.ts -> skills.py -> publish_gate_service.py -> live eval_runs/skill_versions/skills tables, and back for the dialog/status-line render). The migration is live on the local DB with correct RLS. No `agent_loop.py`/`threads.py` touch (D-10 hot-file guard held). SC#3 (no retroactive gating) is structurally guaranteed — no migration or code path writes `is_global` for existing rows.

The phase's own adversarial code review (0 Critical / 5 Warning / 8 Info) surfaced real robustness gaps — most notably WR-01 (a stale-client race can silently invert share/unshare intent, bypassing the confirm-dialog-always UX in that edge case) and WR-05 (the SkillEvalSection gate-status line doesn't refresh after in-session gate-changing actions) — which are legitimate follow-up work but do not falsify the phase's stated success criteria under normal, non-racing usage, and were not rated Critical by the reviewer.

Status is `human_needed` rather than `passed` solely because 4 G-4 lived-UAT checks were deliberately deferred to end-of-phase per the project's `human_verify_mode` convention (documented in 136-VALIDATION.md) and have not yet been executed by a human in the live app. No code changes are required before that human pass; the automated evidence is comprehensive and green throughout.

---

*Verified: 2026-07-03T09:00:00Z*
*Verifier: Claude (gsd-verifier)*
