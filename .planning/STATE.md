---
gsd_state_version: 1.0
milestone: none
milestone_name: v4.8 Every Page Has a Link — CLOSED 2026-10-30
status: milestone_complete
last_updated: "2026-10-30T15:30:00.000Z"
last_activity: 2026-10-30 -- v4.8 closed by hand (archive, tag v4.8 local)
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

> ⚠ **This file was RESET at the v4.8 close (2026-10-30)** — the eleventh reset, same reason each time.
> **Nothing was deleted:** the full pre-close file is archived verbatim at
> [`.planning/milestones/v4.8-STATE-at-close.md`](milestones/v4.8-STATE-at-close.md)
> (every phase's position notes and all 297-302 guardrail overrides live there).
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs or `milestone.complete`.**

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-30)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviours (skills) that persist and can be shared.
**Current focus:** between milestones — v4.8 fully live (2026-10-30); next `/gsd:new-milestone` (v4.9)

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.

---

## Current Position

Milestone: none (v4.8 closed 2026-10-30)
Status: milestone_complete — v4.8 fully live at `ed17bc660`; next: `/gsd:new-milestone`
Last activity: 2026-10-30 -- v4.8 closed by hand

Phases resume at **303**; migrations at **220**. Open Platform (`SEED-013`) was moved to v4.9 at v4.8 intake.

### Previous milestone (v4.8)

**v4.8 Every Page Has a Link COMPLETED 2026-10-30 by hand:** archives in `.planning/milestones/v4.8-*`
(ROADMAP, REQUIREMENTS, MILESTONE-AUDIT, STATE-at-close), tag `v4.8` (local, not pushed), 28/28
requirements, audit `tech_debt`, integration 21/21 after two close fixes (`41198157b`: W-1 ex-member
email, W-2 opt-out link tab), flows 4/4, no blockers. 301-SECURITY.md written at close (23/23).
Closed core 7 phase types / 1 emitter / 30 tools. Phase folders 297-302 still in `.planning/phases/`.

---

## Production

Live at `ed17bc660` (master `4bc4a872f`), 2026-10-30: ALL of v4.8 (297-302) + the 298 chip fix
`5f0eb2660` + the audit fix `41198157b`. Cloud migrations 210-219 applied; 219 applied first with operator
approval (`migration_219_verify = PASS`, AR-301-R1 discharged), `get_advisors(security)` 0 ERROR, `notifications`
grants unchanged (authenticated SELECT only). Live checks: frontend bundle calls `/notifications`; backend
`/notifications` → 401 `WWW-Authenticate: Bearer`, `/openapi.json` → 401 (gated). Brief 502 during the Coolify
swap (~1 min). **No mail provider in cloud (Resend deferred)** — deliveries record `suppressed`, invites → Copy
link. Branch `develop`. Tags `v4.7` and `v4.8` pushed 2026-10-30.

## Owed (operator)

- Logged-in production smoke of the 301 list (open it once on app.superrag.cloud; expect the empty state).
- Mail provider (Resend deferred 2026-10-29) → 300 G4-8 and the real-provider half of G4-1; BUG-260828-05/06 stay folded until G4-8.
  When revived: Coolify `EMAIL_PROVIDER` / `RESEND_API_KEY` / `ENVIRONMENT=production`; Resend sender + SPF/DKIM/DMARC.
- 299 G4-4b email-link leg (cloud); G4-4c SSO ⛔ (D-41).
- Moonshot account reinstatement (429) → re-run its roster rows; BUG-261024-01 stays `folded`.
- Local dev data: paused approval run `66db79bc` (org 22f9c615) — **do not approve** (it emails fhdmrd.dev@gmail.com); delete or cancel it when convenient.
- Optional: restore Supabase MCP `read_only=true`.
- 294-ENV: remove the two dev-only lines from `backend/.env`.
- Rerank / citation check stay OFF in cloud until SEED-365's remaining half lands.
- Carried from v4.6: Coolify rebuild confirmation + logged-in production smoke; 282 G4-4 / G4-6 / A1; 281 G-4 rows A, C, D.

## Debt carried from the v4.8 audit

- 302 has no SECURITY.md (no new route or table); run `/gsd:secure-phase 302` if wanted.
- 298 WR-08 (Builder "lives in <org>" hint relative to the viewer) and deferred-items #1 (ChatArea folder scope on org switch).
- 299 open decisions: Expert fork refusal matched by wording; CR-01 fallback (active org vs 404).
- 300 review IN-05/06 (Send-from edit between a timed-out Resend attempt and its retry).
- W-3: `deploy/onebox.env.example` should say `FRONTEND_URL` also sets the origin of emailed links.
- 301 informational: the 60 s poll re-renders the shell (equality check before `setVerdict`).
- Unverified: whether `appRouteParity.test.ts` can turn CI red given the standing `sourceComposition` red.

## Deferred items at close (36, from `gsd-sdk query audit-open`)

- 31 pre-v4.8 quick tasks with no SUMMARY (2026-03 to 2026-10-16).
- 4 dormant seeds: SEED-041, SEED-043, SEED-046, SEED-127.
- 1 UAT file: 300-HUMAN-UAT.md (`complete-by-decision`, 0 open scenarios).

## Guardrail overrides

The 297-302 overrides are in `milestones/v4.8-STATE-at-close.md`.
