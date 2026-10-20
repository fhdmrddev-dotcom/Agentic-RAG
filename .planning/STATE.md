---
gsd_state_version: 1.0
milestone: v4.7
milestone_name: Workflows You Can See and Start Anywhere
status: ready_to_plan
last_updated: "2026-10-19T23:43:24.700Z"
progress:
  total_phases: 16
  completed_phases: 4
  total_plans: 24
  completed_plans: 20
  percent: 25
---

# Project State

> ⚠ **This file was RESET at the v4.6 close (2026-10-18)** — the ninth reset, same reason each time.
> **Nothing was deleted:** the full pre-close file is archived verbatim at
> [`.planning/milestones/v4.6-STATE-at-close.md`](milestones/v4.6-STATE-at-close.md).
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs or `milestone.complete`.**

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-18)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviours (skills) that persist and can be shared.
**Current focus:** Phase 294 — decision-engine-rerank-and-citation-check

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.

---

## Current Position

Phase: 294 (decision-engine-rerank-and-citation-check) — EXECUTED, human_needed (2026-10-20)
Plan: 5 of 5 — all plans executed (2026-10-20). 294-05 Task 4 driven in pass 2 (partial live: Jev rerank, citation check end to end, reload, Cohere reason line, order probe); G4 sign-off and the operator-gated rows remain owed (294-VALIDATION.md "Drive pass 2"). Verifier: human_needed, 6/6 success criteria met in code (294-VERIFICATION.md). Closed as a DECISION with owed live rows (294-HUMAN-UAT.md); run test 1 (G-4 sign-off) first. Not pushed; migration 211 is applied LOCALLY only (cloud paste + get_advisors owed before any deploy).

### Roadmap Evolution

- Phase 294 added (2026-10-20, operator): Decision Engine: Rerank and Citation Check (DEC-01..03). It is outside the workflow theme, independent of 290-293, and can run any time after 289. Intake research: `phases/294-decision-engine-rerank-and-citation-check/294-INTAKE-RESEARCH.md`. `gsd-sdk query phase.add` wrote the entry under the v3.0 section; it was moved by hand into v4.7.
- Phase 294 context gathered (2026-10-20): `phases/294-decision-engine-rerank-and-citation-check/294-CONTEXT.md` (D-01..D-24). DEC-01 amended: Jev via OpenRouter only. Next for 294: `/gsd:sketch` (D-20, G-2) before `/gsd:plan-phase 294`. Phase 290 is still the current position.
- Phase 295 added (2026-10-20, operator): Runs That Don't Dead-End (RUN-01..04). It came from a measurement during sketch 290: 35 of 36 workflow gate failures in 60 days are `citations_required`, and no failure came from a missing branch or loop (`SEED-295` stays parked). Bugs `BUG-261020-07`..`12` are folded. `gsd-sdk query phase.add` wrote the entry under the v3.0 section again; it was moved by hand into v4.7. Sketch 290 winner: A org chart (`46c23fe00`).
- Phase 295 context gathered (2026-10-20, `--auto`): `phases/295-runs-that-don-t-dead-end/295-CONTEXT.md` (D-01..D-35). Folded BUG-261020-01, BUG-261015-01, SEED-360 F-2. Key finding: the engine-owned ask (citations gate + armed approval) is an in-process wait that fails on timeout, so RUN-01 and BUG-12 share one durable-pause fix. Next: `/gsd:plan-phase 295`.

---

## Milestone close (2026-10-18)

**v4.6 Pay It Down COMPLETED by hand:** archives in `.planning/milestones/v4.6-*` (ROADMAP, REQUIREMENTS,
MILESTONE-AUDIT, STATE-at-close, phases/), tag `v4.6` (local, not pushed), 24/24 requirements, audit
`tech_debt`, no blockers, integration 9/9. Closed core 7 phase types / 1 emitter / **30 tools**.

## Production

Live at `4e767a3a2` (2026-10-16): phases 280-285, migrations 207-209 in cloud. Branch `develop`.

## Owed (operator)

- Confirm the Coolify rebuild from outside; run a logged-in production smoke test.
- 282: G4-4, G4-6 (needs an approved write), A1 LangSmith nesting, Add-form click-through.
- 281: G-4 rows A, C, D.
- Pre-close artifact audit: 39 open entries, almost all pre-v4.6 (`gsd-sdk query audit-open`).
- v4.6 public changelog line for the `GET /documents` envelope breaking change (R-06).
- Open bugs not named in v4.6 requirements: see `.planning/reported-bugs/` (`status: open`).

## Guardrail overrides

- **Phase 295 — G-2 (sketch before plan for UX), 2026-10-20:** not run. The operator asked for autonomous end-to-end completion. The found-nothing pause reuses `PendingAskCard`'s live-answer layout, and the unsourced mark reuses the 289 evidence-line vocabulary (295-CONTEXT D-30). The G-4 browser drive is the check. The operator may ask for a sketch of the pause card.
- **Phase 295 — auto-fold rule overridden, 2026-10-20:** the todo `spike-nl-workflow-authoring` matched at score 0.6 (≥ 0.4 auto-folds), on keywords only. It was not folded on the scope guardrail, because it is NL authoring and already routed to Phase 152 (295-CONTEXT `<deferred>`).
- **Phase 289 — G-5 audited reading of 'one touch' (D-16), 2026-10-19, written before any source edit:** two hot files get two touches each, and each touch is the smallest shape D-16 names. `frontend/src/pages/WorkflowRunPage.tsx`: plan 01 adds one attribute (`paused`) at the existing PendingAskCard mount; plan 04 adds one early return after every hook mounting RunEvidenceReport; useState and useEffect counts unchanged (measured before and after in 289-01 and 289-04 SUMMARYs). `backend/app/api/workflow_runs.py`: plan 02 adds one declared wire field (`confidence`, produced in lockstep); plan 05 changes the compose_waiting_on paused sentence ONLY if S5 is driven green. Recorded as an audited reading of D-16's 'at most one mount, prop, field or helper', not silently applied; plan 05 confirms it with the measured counts; the operator may overrule. (Written by the execute-phase orchestrator instead of plan 01 Task 1 step 0, because worktree executors may not write STATE.md; this also orders it before plan 02's parallel edits.) **CONFIRMED by 289-05, measured (not a second entry):** `WorkflowRunPage.tsx`: 289-01 `useState(` 1 → 1, `useState[(<]` 4 → 4, `useEffect(` 4 → 4 (one attribute, 1580 → 1581); 289-04 `useState(` 1 → 1, `useState<` 3 → 3, `useEffect(` 4 → 4 (one import + one early return, 1581 → 1594). `workflow_runs.py`: 289-02's `confidence` field landed in lockstep; the second touch HAPPENED: S5 was driven PASS live, so the paused sentence was restored at `dd863ca5a` (+2 lines). Both readings held.
- **Phase 289 — G-8 plan count, 2026-10-19:** five plans, against D-18's and research's four. The fifth exists because the evidence read (backend, plan 03) and the report (frontend, plan 04, an 87-case terminal-test migration, not the 45 researched) could not share one context budget; plan 04 ran four tasks (plan-check W2). The verifier, TDD RED drives, security review and migration discipline were not cut; no migration was needed.
- **Phase 289 — drive tooling, 2026-10-19:** S1-S5 and the roster were driven through headless Chromium (Playwright) and local DB reads, not the claude-in-chrome tools, which the 289-05 executor did not have (same deviation as 288). Evidence: `289-VALIDATION.md`, `evidence/`.
- **Phase 289 — named gaps, recorded not fixed (no gap round):** the chat panel's `PendingAskStack` cannot see a paused run (SEED-361; trigger: next phase naming `StreamsProvider.tsx` or `streamsStore.ts`); a resumed segment runs on the owner's default model, measured on every roster row (SEED-362); the run-level final-message confidence uses default buckets (F3, `harness_engine._finalize_run_grounding`); SEED-360 F-2 and F-4 stay deferred; a TestClient lifespan can claim a live run in the shared DB, reproduced three times this phase (SEED-363); org default names embed the founder's email (SEED-364, observation from S4). Report follow-ups F-A..F-E (289-04) open. Anthropic roster row BLOCKED (billing, re-tested).
- **Phase 289 — backend unit gate over the 71 ceiling, inherited:** final HEAD `217e90d33` 78 failed / 7862 passed; the phase base `dcf6ba649` 78 failed / 7779 passed; the two 78-id failing SETS are identical (two HEAD-only fence reds were this phase's own and were re-pinned with reasons). The ceiling was not raised. Detail: `289-05-SUMMARY.md`.
- **Phase 289 — D-214-06 escape-hatch fence, audited reading:** the report's "Download JSON" (D-14a) is exempted EXACTLY (file + constant + value) in `argumentVocabulary.test.ts`, with a scope case; a second JSON label still fails (driven red). The operator may reverse it by renaming the label instead.
- **Phase 287 — G-2 (sketch before plan for UX), 2026-10-19:** not run. The operator was away and asked for autonomous completion; both surfaces reuse shipped vocabulary (Run modal/ChatLaunchForm shell, Starters shelf card). The G-4 browser drive is the visual acceptance bar. No operator-approved mockup exists for the in-thread "Run a workflow" action.
- **Phase 287 — sketch 011 anti-pattern tension:** the in-thread start is an action button (no aria-pressed, no composer state), not a mode pill. Recorded as a deliberate departure; the operator may reverse it.
- **Phase 288 — G-2 (sketch before plan for UX), 2026-10-19:** not run. The operator was away and asked for autonomous completion. The decisions surface reuses sketch 174's vocabulary; the waiting-on line reuses the shipped `waiting` tone. The G-4 browser drive is the check. The operator may ask for a sketch of the waiting-on moment.
- **Phase 288 — G-8 plan count, 2026-10-19:** four plans (01 draft row, 02 gauntlet, 03 waiting-on, 04 live proof), inside the 3-5 target. The verifier, TDD RED drives, security review and migration discipline were not cut.
- **Phase 288 — drive tooling, 2026-10-19:** the live drives S1-S4 and the roster were run through headless Chromium (Playwright) and local DB reads, not the claude-in-chrome tools, which the executor did not have. Evidence: `288-VALIDATION.md`, `evidence/`.
- **Phase 288 — plan 04 notes:** SEED-183 flipped to `answered` (generate-and-dismiss arm owed, billing) and SEED-164 to `partially-answered`; SEED-137 cited as re-run green (`test_187_armed_checkpoint_property`, `test_185_engine_attachment`). The 286 OpenAPI/AST pins and the 276 OpenAPI snapshot were deliberately re-baselined for the two additive wire fields (reason in the test docstring). `test_182_validate`'s interactive-phase case was inherited red since 200.3 and is re-pointed.
- **Phase 288 — open defects found live (not fixed, no gap round):** F-1 Expired card offers no answer while the line says it will continue; F-2 the judge blocks a mock-answered pause workflow often; F-3 a paused run answered after its window strands `active`; F-4 the Builder closes the gauntlet on success so the `auto_answered` note is never seen. Details in `288-04-SUMMARY.md`.
