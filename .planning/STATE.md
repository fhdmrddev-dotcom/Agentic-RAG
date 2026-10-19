---
gsd_state_version: 1.0
milestone: v4.7
milestone_name: Workflows You Can See and Start Anywhere
status: ready_to_plan
last_updated: "2026-10-19T17:39:54.026Z"
progress:
  total_phases: 15
  completed_phases: 3
  total_plans: 19
  completed_plans: 14
  percent: 20
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
**Current focus:** Phase 289 — the-run-page-and-its-evidence

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.

---

## Current Position

Phase: 289 (the-run-page-and-its-evidence) — EXECUTING
Plan: 1 of 5

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

- **Phase 287 — G-2 (sketch before plan for UX), 2026-10-19:** not run. The operator was away and asked for autonomous completion; both surfaces reuse shipped vocabulary (Run modal/ChatLaunchForm shell, Starters shelf card). The G-4 browser drive is the visual acceptance bar. No operator-approved mockup exists for the in-thread "Run a workflow" action.
- **Phase 287 — sketch 011 anti-pattern tension:** the in-thread start is an action button (no aria-pressed, no composer state), not a mode pill. Recorded as a deliberate departure; the operator may reverse it.
- **Phase 288 — G-2 (sketch before plan for UX), 2026-10-19:** not run. The operator was away and asked for autonomous completion. The decisions surface reuses sketch 174's vocabulary; the waiting-on line reuses the shipped `waiting` tone. The G-4 browser drive is the check. The operator may ask for a sketch of the waiting-on moment.
- **Phase 288 — G-8 plan count, 2026-10-19:** four plans (01 draft row, 02 gauntlet, 03 waiting-on, 04 live proof), inside the 3-5 target. The verifier, TDD RED drives, security review and migration discipline were not cut.
- **Phase 288 — drive tooling, 2026-10-19:** the live drives S1-S4 and the roster were run through headless Chromium (Playwright) and local DB reads, not the claude-in-chrome tools, which the executor did not have. Evidence: `288-VALIDATION.md`, `evidence/`.
- **Phase 288 — plan 04 notes:** SEED-183 flipped to `answered` (generate-and-dismiss arm owed, billing) and SEED-164 to `partially-answered`; SEED-137 cited as re-run green (`test_187_armed_checkpoint_property`, `test_185_engine_attachment`). The 286 OpenAPI/AST pins and the 276 OpenAPI snapshot were deliberately re-baselined for the two additive wire fields (reason in the test docstring). `test_182_validate`'s interactive-phase case was inherited red since 200.3 and is re-pointed.
- **Phase 288 — open defects found live (not fixed, no gap round):** F-1 Expired card offers no answer while the line says it will continue; F-2 the judge blocks a mock-answered pause workflow often; F-3 a paused run answered after its window strands `active`; F-4 the Builder closes the gauntlet on success so the `auto_answered` note is never seen. Details in `288-04-SUMMARY.md`.
