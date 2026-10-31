---
gsd_state_version: 1.0
milestone: v4.9
milestone_name: Use It From Your Own Tools
status: executing
last_updated: "2026-10-31T05:00:00.000Z"
last_activity: 2026-10-31 -- Phase 305 planned (4 plans)
progress:
  total_phases: 7
  completed_phases: 1
  total_plans: 6
  completed_plans: 6
  percent: 14
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
**Current focus:** v4.9 Use It From Your Own Tools — MCP server, personal keys + OAuth, outbound webhooks, SEED-081/079 guardrails on the new paths, BUG-261022-01

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.

---

## Current Position

Milestone: v4.9 Use It From Your Own Tools
Phase: 304 — Personal MCP Keys That Act as You — **COMPLETE 2026-10-31, self-verified `passed` 5/5** (KEY-01..06). 303 not started. 305 PLANNED 2026-10-31: 4 plans / 4 serial waves (every plan writes the local DB), D-01..D-58, research + UI-SPEC (approved) + patterns; plan check 1 docs blocker fixed, 3 size warnings accepted (G-8). Operator approved the `mcp` 2.3 / `httpx2` / `sse-starlette` 3.0.3 install (305-01 Task 1). **305 EXECUTING: 2 of 4 plans merged** — 305-01 (`4d4d013f2`): /mcp edge, mig 222 local only, SDK bump; 305-02 (`1c20943a8`): three read tools, identical refusal (9 cases), `/app/library/<uuid>` address; baseline 70 ≤ 71 both waves. Next: 305-03.
Plan: 6 of 6 merged + review-fix merge `bb6ebc2f0` (WR-01..04 test-first; D-46 `retrievable` on every MCP read, D-47 narrowed key lists only in-scope views).
Status: 304 closed by hand (not `phase.complete`). SECURITY 47/47 closed · REVIEW 0 BL / 4 WR fixed / 9 IN left as recorded · G-4 rows 1-3 PASS in Chrome (DOM + DB; screenshots time out on the hidden tab) · post-merge backend 532 / frontend 433 green · baseline 70 ≤ 71 (one run read 75: 5 flaky extras in test_272_knowledge_health ×4 + test_email_ingestion, shown unrelated). **Not deployed — 304 deploys WITH 305 (D-30).**
Last activity: 2026-10-31 — 304 verified and closed (`304-VERIFICATION.md`)

Phases start at **303**; migrations at **220**. Seeds taken in at intake: SEED-013, SEED-177, SEED-195, SEED-081, SEED-079; bug BUG-261022-01.

### Previous milestone (v4.8)

**v4.8 Every Page Has a Link COMPLETED 2026-10-30 by hand:** archives in `.planning/milestones/v4.8-*`
(ROADMAP, REQUIREMENTS, MILESTONE-AUDIT, STATE-at-close), tag `v4.8` (local, not pushed), 28/28
requirements, audit `tech_debt`, integration 21/21 after two close fixes (`41198157b`: W-1 ex-member
email, W-2 opt-out link tab), flows 4/4, no blockers. 301-SECURITY.md written at close (23/23).
Closed core 7 phase types / 1 emitter / 30 tools. Phase folders 297-302 archived to `.planning/milestones/v4.8-phases/` (2026-10-30).

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

- **BUG-261031-01 — reproduce on a disposable Postgres:** a role-`anon` call to `current_user_org_ids()` crashed the local Postgres into recovery mode twice (should be "permission denied"). Production: anon has no EXECUTE, same PG 17.6, no crash lines in 24 h of logs. If the anon REST path reproduces it, it is an unauthenticated DB crash. Never drive it against production.
- **304 cloud paste — before 304+305 deploy:** paste migrations 220 then 221 into cloud Supabase (per-action approval each), then `get_advisors(security)`. 221 also closes BUG-261030-03 (anon/authenticated DELETE/TRUNCATE/TRIGGER/REFERENCES on `organizations`) in production.
- **304 D-41 — confirm before 304+305 deploy:** MCP keys need no tier capability (any member can mint; the org and deployment switches are the controls). Tier gates are a pricing one-way door (TIER-02); flipping it is one condition.

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

- **304 / G-2 (2026-10-30):** the key screen is UI and G-2 asks for an operator-approved sketch before discuss. The operator ran discuss with "continue autonomously end to end", so no sketch was approved. Mitigation: the key screen extends the shipped Phase 293 API keys tab (an approved design); the acceptance bar is the 304 UI-SPEC plus Claude-driven G-4 rows. Re-open: the operator asks to see a sketch.
- **305 / G-2 (2026-10-31):** UI hint (org redaction card, possibly a spend view); no operator-approved sketch because the operator ran discuss with "continue autonomously end to end". Mitigation: both extend shipped, approved surfaces (`OrgMcpSwitchCard`, the spend breakdown); acceptance bar is the 305 UI-SPEC plus Claude-driven G-4 rows. Re-open: the operator asks to see a sketch.
- **304 / G-5 (2026-10-30):** honoured by construction, not overridden — one edit each on `dependencies.py`, `audit_service.py`, `user_settings.py`, `settings.py`; no new mount on `SettingsPage.tsx` or tab on `OrgAdminShell.tsx` (CONTEXT D-01/D-02); `api_key_auth.py` extracted before editing.
