---
gsd_state_version: 1.0
milestone: v4.9
milestone_name: Use It From Your Own Tools
status: ready_to_plan
last_updated: 2026-11-03T13:59:23.092Z
last_activity: 2026-10-31 -- Phase 306 execution started
progress:
  total_phases: 14
  completed_phases: 2
  total_plans: 15
  completed_plans: 15
  percent: 14
stopped_at: Phase 306 complete (5/5) — ready to discuss Phase 307
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
**Current focus:** Phase 307 — sign in from claude.ai and claude desktop

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.

---

## Current Position

Milestone: v4.9 Use It From Your Own Tools
Phase: 307
Plan: Not started
Status: Ready to plan
Last activity: 2026-11-03

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
- **305 before the 304+305 deploy:** paste mig **222** after 220 and 221 (per-action approval each), then `get_advisors(security)`; Coolify `BACKEND_PUBLIC_URL` = the https public address (else `/mcp` refuses to mount); Coolify stop grace > 5 s (20 s recommended, sse-starlette 3.0.3); SEED-397 / AR-01 (per-address limit sees the proxy) — **ACCEPTED by the operator 2026-10-31**; re-open before a paying org uses MCP.
- **306 closed by decision 2026-11-03 — 5 live UAT rows OWED** (`306-HUMAN-UAT.md`): run **row 5 first** (narrowed key: cap pause → in-app Continue → `get_answer` reads `answered_in_app`), then the 8-row roster (`scripts/uat-306-ask-roster.py`), the burst + Redis-down drill (`scripts/burst-306-outside-starts.py`, re-measure D-35 defaults), G-4 (MCP mark, waiting-on link), real-client wait budget. Before deploy: cloud mig **223** after 220→221→222 (per-action approval), `get_advisors(security)`, `/gsd:secure-phase 306`. Carried: 306-REVIEW WR-01..06 (top: WR-05 spend-by-key over-counts in-app follow-ups) + persist ask folder scope on the thread.
- **305 client rows (D-43):** Cursor; one `claude` CLI search against the deployed cloud `/mcp`; the one-box; Claude Desktop via the `mcp-remote` bridge.
- **Local leftovers (305):** MCP test key `g4-305-claude-code` (org 22f9c615, expires 7 Nov); chats "Stream works confirmation reply" and "ACME MSA payment terms search".
- ~~**304 D-41 — confirm before 304+305 deploy**~~ **CONFIRMED by the operator 2026-10-31** ("accept … D-41"): MCP keys need no tier capability.

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

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261101-4y9 | fix 306 CR-01 and CR-02 with a test each | 2026-11-01 | c2b3225b0 | [261101-4y9-fix-306-cr-01-and-cr-02-with-a-test-each](./quick/261101-4y9-fix-306-cr-01-and-cr-02-with-a-test-each/) |

## Guardrail overrides

The 297-302 overrides are in `milestones/v4.8-STATE-at-close.md`.

- **304 / G-2 (2026-10-30):** the key screen is UI and G-2 asks for an operator-approved sketch before discuss. The operator ran discuss with "continue autonomously end to end", so no sketch was approved. Mitigation: the key screen extends the shipped Phase 293 API keys tab (an approved design); the acceptance bar is the 304 UI-SPEC plus Claude-driven G-4 rows. Re-open: the operator asks to see a sketch.
- **305 / G-2 (2026-10-31):** UI hint (org redaction card, possibly a spend view); no operator-approved sketch because the operator ran discuss with "continue autonomously end to end". Mitigation: both extend shipped, approved surfaces (`OrgMcpSwitchCard`, the spend breakdown); acceptance bar is the 305 UI-SPEC plus Claude-driven G-4 rows. Re-open: the operator asks to see a sketch.
- **306 / G-2 (2026-10-31):** UI hint (the 293 origin mark for MCP asks, Settings number controls); no operator-approved sketch because the operator said "continue" in auto mode. Mitigation: both are shipped surfaces extended by vocabulary only; acceptance bar is G-4 rows (D-22). Re-open: the operator asks to see a sketch.
- **305 / G-4 (2026-10-31):** rows 1-3 driven by Claude, not the operator, with three recorded substitutions (G4-1 non-member arm = a foreign-org document under one login; G4-2 band pulse not observed; chat-stream console read began after the stream). Closed with SC#1's client rows OWED — a decision, not a claim (CLAUDE.md G-7 detail).
- **304 / G-5 (2026-10-30):** honoured by construction, not overridden — one edit each on `dependencies.py`, `audit_service.py`, `user_settings.py`, `settings.py`; no new mount on `SettingsPage.tsx` or tab on `OrgAdminShell.tsx` (CONTEXT D-01/D-02); `api_key_auth.py` extracted before editing.
