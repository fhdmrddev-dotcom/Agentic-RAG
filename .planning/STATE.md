---
gsd_state_version: 1.0
milestone: v4.8
milestone_name: Every Page Has a Link
status: human_needed
last_updated: 2026-10-27T21:45:44.691Z
last_activity: 2026-10-28 -- Phase 298 executed; verification human_needed (G-4 owed)
progress:
  total_phases: 13
  completed_phases: 0
  total_plans: 4
  completed_plans: 4
  percent: 0
stopped_at: Phase 298 executed 5/5 + review fixes; 4/4 SC verified in code; G-4 rows owed (two-org account); LIVE 2026-10-28 (prod b813d2711)
---

# Project State

> ⚠ **This file was RESET at the v4.7 close (2026-10-27)** — the tenth reset, same reason each time.
> **Nothing was deleted:** the full pre-close file is archived verbatim at
> [`.planning/milestones/v4.7-STATE-at-close.md`](milestones/v4.7-STATE-at-close.md)
> (every phase's position notes and all 286-296 guardrail overrides live there).
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs or `milestone.complete`.**

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-27)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviours (skills) that persist and can be shared.
**Current focus:** Phase 299 — links to the thing itself (context gathered 2026-10-28, auto mode; next: plan-phase)

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.

---

## Current Position

Phase: 298
Plan: 5 of 5
Status: Executed — human_needed (verification 4/4 SC in code; security 34/34 closed; G-4 rows owed)
Last activity: 2026-10-28 — 298 executed: 5 plans, review (1 BL + 9 WR) → 9 fixed + WR-08 deferred to 299; 297+298 LIVE 2026-10-28 (prod b813d2711)

Owed for 298 (in order): run `298-HUMAN-UAT.md` rows as the two-org dev account (G4-1 first); acknowledge residuals
AR-298-R1 (WR-06 `LIMIT 1`) and AR-298-R2 (WR-05 bind race) in `298-SECURITY.md`; then flip SEED-389/317 → shipped,
SEED-313 → answered. Mig 217 APPLIED in cloud 2026-10-28 (CHECK 40 types, advisor: no new finding); 297+298 deployed 2026-10-28: master 879c96555, production b813d2711; Vercel + Coolify verified (new /org-items/* routes 401, /docs 401, health ok).

Scope set at intake: per-view URLs (SEED-185/015/178), run-waiting notifications in-app + email
(SEED-281), lists follow the active org — decided per-org (SEED-389), v4.7 close-out
(BUG-261027-01..05, SEED-391). Open Platform (SEED-013) moved to v4.9.

### Previous milestone (v4.7)

**v4.7 Workflows You Can See and Start Anywhere COMPLETED 2026-10-27 by hand:**
archives in `.planning/milestones/v4.7-*` (ROADMAP, REQUIREMENTS, MILESTONE-AUDIT + the 2026-10-26
reading as `-261026`, STATE-at-close, and `v4.7-phases/` with all 12 phase folders), tag `v4.7` (local, not pushed), 21/21 requirements, audit
`tech_debt` with a 296 addendum, no blockers. Closed core 7 phase types / 1 emitter / **30 tools**.
Phases resume at **297**; migrations at **217**.

Carried into v4.8 intake (2026-10-27): the seeds sweep (incl. SEED-384..391)
and the open bugs (BUG-261027-01..05, minor; 04 and 05 found by the close integration check). Open Platform (`SEED-013`) was named as v4.8 at v4.7 intake.

---

## Production

Live at `3ec36f998` (master `f152c2c4e`), 2026-10-27: all of v4.7 (286-296). Cloud migrations 210-216
applied; `get_advisors(security)` 0 ERROR. Branch `develop`.

## Owed (operator)

- OpenRouter credit top-up (402) → re-run the 292.1 / 291 / 287 OpenRouter roster rows
  (`scripts/run-2921-board.py --run --providers openrouter`, `scripts/run-296-board.py --first-step --providers openrouter`);
  flip BUG-261024-03 on PASS.

- Moonshot account reinstatement (429 suspended) → re-run its rows; BUG-261024-01 stays `folded` until then.
- 294-ENV: remove the two dev-only lines from `backend/.env` (`DECISION_ENGINE_FAULT_BASE_URL` and its `ENVIRONMENT` partner).
- 298: G-4 rows G4-1..7 + A-1 (`298-HUMAN-UAT.md`, sign in as `fhdmrd.dev@gmail.com`); mig 217 already in cloud (2026-10-28).
- Optional: restore Supabase MCP `read_only=true` (the write-needing deploy is done).
- Push tag `v4.7` when wanted (local only).
- Carried from v4.6: Coolify rebuild confirmation + logged-in production smoke; 282 G4-4 / G4-6 / A1; 281 G-4 rows A, C, D.
- Rerank / citation check stay OFF in cloud until SEED-365's remaining half (concurrency cap, spend ledger) lands.

## Deferred items at close (43, from `gsd-sdk query audit-open`)

- v4.7 `human_needed` verifications, each with its reason in the audit: 287 (Anthropic/OpenRouter rows), 289 (Anthropic row, billing),
  292.1 (OpenRouter row, 402), 294 (UAT 9/9 passed live; file not re-stamped). UAT files 287-UAT, 292-UAT-LOG, 292.1-HUMAN-UAT (1 pending: OpenRouter), 292.1-UAT-LOG.

- 31 pre-v4.7 quick tasks with no SUMMARY (2026-03 to 2026-10-16).
- 4 dormant seeds: SEED-041, SEED-043, SEED-046, SEED-127.

## Guardrail overrides

- **298 G-2 (2026-10-28):** the "N more in <org> · Switch" line, the out-of-org picker marker and the move confirm are new UI. Under the operator's autonomous mandate ("continue autonomously end to end") the sketch/UI-SPEC is self-approved in planning; the operator sees it at G-4 (298 D-23).

- **299 G-2 (2026-10-28):** UI-SPEC self-approved under the autonomous mandate (checker 6/6 after one spacing revision). Four details depart from the operator-picked sketch winners and are shown to the operator at G-4: UI-D12 the trigger says "Link" not "Share" (a link grants no access); UI-D14 the "✓ Link copied" receipt sits inside the link surface, not at the bottom (no toast system, rule 062-A); UI-D16 the sign-in return line sits after the whole form (keeps `SignInForm`/`SignUpForm` unedited); UI-D10 the after-switch line is shortened until G-4 row 2 proves reattach.

The 286-296 overrides are in `milestones/v4.7-STATE-at-close.md`.
