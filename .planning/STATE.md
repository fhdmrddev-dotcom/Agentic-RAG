---
gsd_state_version: 1.0
milestone: v4.4
milestone_name: Experts That Actually Work — 🚧 IN PROGRESS
status: executing
last_updated: "2026-09-28T14:28:00.379Z"
last_activity: 2026-09-28 -- Phase 268 execution started
progress:
  total_phases: 12
  completed_phases: 3
  total_plans: 19
  completed_plans: 15
  percent: 25
---

# Project State

> ⚠ **This file was RESET at the v4.3 close (2026-09-23)** — the sixth reset, same reason each time.
> **Nothing was deleted:** the full v4.3 file (1,286 lines) is archived verbatim at
> [`.planning/milestones/v4.3-STATE-at-close.md`](milestones/v4.3-STATE-at-close.md)
> (md5 `0aa7141e8740f576ff15750ca920fd2b`), including every per-phase position entry and all
> guardrail overrides recorded during the milestone.
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs or `milestone.complete`.** The v4.3
> close was done by hand for that reason (eight prior false-record occurrences, see the v4.2 archive).

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-23)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviours (skills) that persist and can be shared.
**Current focus:** Phase 268 — Expert Spend & Mid-Thread Scope
**265**, migrations at **194** (193 was already taken by `193_expert_seed_org_portable.sql`).

---

## Current Position

Milestone: v4.4 Experts That Actually Work
Phase: 268 (Expert Spend & Mid-Thread Scope) — EXECUTING
Plan: 1 of 4
Status: Executing Phase 268

- SC#1-SC#5 PASS
- SC#10 board 8/8 PASS
- G-4 ×3 PASS, driven in Chrome by the orchestrator
- after the code-review fixes, CR-01 and WR-03 were re-driven live and PASS

Code review (`267-REVIEW.md`): 2 critical + 9 warnings, all FIXED test-first. 6 info items deferred with reasons.

OWED, run these first:

1. The independent review by an agent that did NOT build 267 (AGENTS.md §6.3).
2. Operator sign-off on the G-4 Chrome rows (screenshots: `evidence/g4-*.png`).
3. F-4: the handoff 502 did not reproduce.
4. Ledger triples: re-derive them for the files the review fixes touched after the 267-05 register commit (ExpertSpotlightCard.tsx, useThreads.ts, ChatArea.tsx, InviteExpertDialog.tsx, api/threads.py, expert_service.py, agent_loop.py, among others).

G-2 honoured: sketch 267 Variant B "Will / won't ledger", picked by the operator (D-267-27). G-4 scenarios locked (D-267-28)
Operator rulings at research: D-267-29..35. The rulings are: a server union of the Expert's connections; the picker stores `service_id`; a fail-closed binding gate; skills add; the handoff inherits the folder; `org_id` is set explicitly; the biased narrowing on a no-folder thread is kept and stated
Baselines at `92b5476be`:

- backend unit: 71 failed / 5673 passed (ceiling, zero headroom)
- `tsc -p tsconfig.app.json`: 70 errors
- vitest gate: 8828 total · 3 failed (inherited) · 8075 pinned

Still owed from 266: UI-2 and UI-4 (not-installed, non-manager) live checks; `independent_review`; the prod parity checklist `266-PROD-PARITY.md`
Resume file: .planning/phases/268-expert-spend-mid-thread-scope/268-UI-SPEC.md
Last activity: 2026-09-28 -- Phase 268 execution started

---

## Carried into v4.4 scoping (routing decided at intake 2026-09-23)

| Item | Where |
|---|---|
| ⛔ `PACK-05` — Financial Analyzer's knowledge unreachable from any real org (tenancy decision) | `SEED-304` |
| ✅ ~~Production deploy checklist — migrations **183-192** via SQL editor; `subscription_tier` on BOTH prod orgs **before** the backend ships~~ — **DONE 2026-09-23**: migrations **182-193** (12, one more than first counted: 182 was also missing, 193 written for prod) applied to production via the Supabase MCP on the operator's per-batch approval; both prod orgs set `enterprise`; verified per migration; `get_advisors(security)` shows no v4.3 table; `read_only=true` restored. **Code DEPLOYED 2026-09-23 02:32** — `production` at `dea7f5539` (master `98aef21fb`); backend /health 200 and `/experts` 403 (new route, auth-gated); frontend bundle carries the v4.3 tier message. Operator smoke test PASSED 4/4 (login + chat stream · Experts catalog · code execution in a NEW chat · /admin/spend) | `milestones/v4.3-MILESTONE-AUDIT.md` |
| ~~Owed live UAT — 257 `/admin/spend` · 258 refusals as a standard-tier org · 261 G-4 authoring + grant drive · 263 post-WR-08 re-drive~~ **DRIVEN by Phase 265** (plus 256 rows 2-3). Record: `.planning/phases/265-owed-v4-3-verification/265-UAT-LOG.md`. Non-PASS rows (257 row 3, 258 b/c, 263 R-7) are triaged in `265-TRIAGE.md` | each phase's `VERIFICATION.md` `result:` lines |
| Independent review — 255, 256, 262, 264, and every audit fix commit `c28853142`..`cdf3a308a`: **PARTIALLY discharged by Phase 265** (fresh-context Claude subagents, D-265-01, recorded as `partial`, OV-265-02). A Gemini §6.3 review is still available per the deferred idea and would upgrade it. Findings are triaged in `265-TRIAGE.md`; operator rulings are in BUS-304 | `265-REVIEW-*.md` |
| Operator bus items still open: `BUS-246`, `BUS-248`, `BUS-263` (SEED-013 / OV-248-01), `BUS-280`, `BUS-283`, `BUS-303` (262 renumber) — `BUS-280`/`283` substantively resolved at close, see ROADMAP v4.3 archive | `.agent-bus/OPEN.md` |
| Two non-engineering commercial blockers (no legal entity; employment / IP position) | `SEED-294` |

---

## Guardrail records — Phase 267 (2026-09-26)

**No guardrail was overridden in 267.** Each row below records a rule that was honoured, or a decision that was made on purpose.

| Rule / item | Record | Evidence |
|---|---|---|
| G-2 (sketch before plan) | **HONOURED, not an override.** Sketch 267 was run before planning; the operator picked Variant B, "Will / won't ledger" (**D-267-22 / D-267-27**). It was the acceptance bar for the G-4 drive | `.planning/sketches/267-an-expert-adds-scope/` · `267-UAT-LOG.md` G4-2 |
| G-5 (refactor between feature waves) | **Honoured by construction, NO override (D-267-23).** Every firing-file change is a removal, an additive default-off field, a pure extraction or one early return. **Owed seams, named and not taken:** the `tool_dispatcher.py` registry/handler split; the `agent_loop.py` prompt-assembly extraction; the chat dispatch-side whitelist (SEED-303); a `dependencies.py` access-gate module. **Crossed the threshold in 267** (the next phase proposes a refactor first): `expert_authoring.py`, `ExpertAuthoringStudio.tsx`, `ExpertCard.tsx`, `ExpertDetailModal.tsx`, `expertCatalog.ts`, `useThreads.ts` | `docs/HOT-FILE-LEDGER.md` § Phase 267 CLOSE |
| G-8 (plan-count proportion) | **5 plans / 4 waves (D-267-25)** | `267-0{1..5}-PLAN.md` |
| D-267-31 | **Consciously retired**: `test_260_expert_chat_scoping.py` expected a PATCH with no validated org to SUCCEED (fail-open). It now expects a 403 with a reason, and the gate is fail-closed | `267-02-SUMMARY.md` |
| Open questions | OQ-1..OQ-5 were ruled as **D-267-29..D-267-33** (plus D-267-34 org_id explicit, D-267-35 the biased narrowing is kept and stated) | `267-CONTEXT.md` |
| UAT findings | **F-1** (`can_connect` read a cold settings cache) FIXED `13856a7e9`/`cdb173609`. **F-2** (an absent connection named by its slug) FIXED in the same commits. **F-3** = **SEED-314** (a two-org user's chat rows are stamped with the trigger org), measured again live, not a 267 regression. **F-4** (handoff 502 on `deepseek-v4-flash`, first SC#4 attempt; did not reproduce) OWED/observed. **F-5** (Financial Analyzer restricted) is BY DESIGN (mig 187). **O-1** (Dropped over-states a restricted → restricted swap) routed to SEED-303 | `267-UAT-LOG.md` § Resolutions |

**Owed from 267, and which to run first:**

1. **The independent review**, by an agent that did not build 267 (AGENTS.md). Run this first.
2. **Operator confirmation of the G-4 rows.** They were driven in Chrome by the orchestrator under an autonomous run, so there is no operator reply on record.
3. The member-view catalog check in Chrome (skipped; the API member case is SC#2).
4. F-4's cause, which needs the backend log.

**Routed to the operator:** the biased-no-folder narrowing finding (D-267-35). A biased Expert on a thread with no folder narrows retrieval from all documents to its own folders; the event card states this as "Dropped: All your documents". It is recorded in SEED-303 and was not fixed here.

**CLAUDE.md size:** 116,523 chars after 267's cells were shortened. This is under the 120,000 warn band, so no split is scheduled.

## Guardrail overrides — Phase 266 (2026-09-25)

| Id | Rule | Override | Evidence |
|---|---|---|---|
| OV-266-01 | G-2 (sketch before plan for UX) | **A DECISION, not a skip.** Decision **D-266-16**: there was no `/gsd:sketch`, by operator decision at discuss. The UI change is one Install control plus three states (Installing… / Ready / Install failed — retry) on the shipped `ExpertDetailModal` / `ExpertCard`, and a provenance note on an existing Library folder. All of it reuses the shipped vocabulary. ⚠ The live check then found the note INVISIBLE, because it existed only in a tooltip (UI-3). It was fixed in `c5b5fdaa9`/`2c2c09540` and re-checked by the operator ("shows now"). A sketch would have put that note on the page at rest. | `266-CONTEXT.md` D-266-16 · `266-04-SUMMARY.md` · `266-UAT-LOG.md` UI-3 |
| OV-266-02 | D-266-11 (`run_producer.py` byte-unchanged) | **Overridden by operator decision (2026-09-25) as a SECURITY fix.** Code review CR-01, confirmed by code trace: a restricted Expert with zero folders searched every org the user belongs to (empty scope = no folder filter). `run_producer.py` gained one guard + one exception class; the run is refused and the thread keeps its Expert. Rejected: resolver-returns-None (clears the Expert, misleading message, first-party only); defer to 267 (live on every org right after deploy). | `266-REVIEW.md` CR-01 · `73cb9726a` / `2c4102070` · HOT-FILE-LEDGER run_producer §266 |

## Guardrail overrides — Phase 265 (2026-09-24)

| Id | Rule | Override | Evidence |
|---|---|---|---|
| OV-265-01 | D-04 (fixes inside 265 are ≤1 file / ≤10 lines, no schema surface) | Operator ordered R265-audit-fixes-01, a **blocker** (org admin can self-upgrade `subscription_tier`), fixed now as migration 194. It was applied locally and pasted into prod by the operator. | `.planning/phases/265-owed-v4-3-verification/265-HOTFIX-194.md` · `8a01889de` (RED) · `9890ebd19` (fix) |
| OV-265-02 | Independent review (CLAUDE.md / AGENTS.md §6.3) | VERIFY-05 reviews of **255, 256, 262, 264** and the audit-fix commits **`c28853142`..`cdf3a308a`** were done by fresh-context Claude subagents, operator decision **D-265-01** (2026-09-23): recorded as **partial independence** (D-02), never `done`. The four VERIFICATION.md files now read `independent_review: partial — fresh-context claude subagent (operator decision D-265-01)`. (The plan text calls this row OV-265-01; that id was already taken by the 194 hotfix, so it lives here.) | `265-REVIEW-255.md` · `265-REVIEW-256.md` · `265-REVIEW-262.md` · `265-REVIEW-264.md` · `265-REVIEW-audit-fixes.md` · `265-01-SUMMARY.md` · triage `265-TRIAGE.md` |
| OV-265-03 | VERIFY-01 / SC#1 wording ("screenshot + the DB rows") | Operator accepted ("yes to all", phase close): 257 rows are evidenced by rendered page text, the in-page API capture and independent SQL, not screenshots, because the Chrome MCP tab stayed hidden and screenshots timed out. Only one partial crop exists (`evidence/257-row1-kpi-crop.png`). The DB half is complete for every row. | `265-UAT-LOG.md` § 257 · `265-VERIFICATION.md` |
| OV-265-04 | 265-05 must_have "every fix was made by the builder" | Operator accepted ("yes to all", phase close): R265-255-05 (`39eec609f`) and R265-255-09 (`210b70a42`) fix 255-01 code, which Gemini built, but Claude (the 265 builder) made the fixes. This was disclosed in the triage rows, and a fresh re-drive resolved both. It was not sent back to Gemini. | `265-TRIAGE.md` rows R265-255-05 / -09 · `265-REDRIVE.md` |

## Guardrail overrides — v4.3 close (2026-09-23)

The operator delegated closure ("do anything needed so we can close this milestone and start a new
one"). The audit's fixes touched **G-5-firing hot files without a refactor phase first**. Recorded
here per the orchestrator protocol, as **honoured by construction** — each change adds a guard at an
existing seam and no new branch structure:

| Id | File | Change | Commit |
|---|---|---|---|
| OV-v43-G5-01 | `backend/app/services/workflow_kickoff.py` | one `enforce_entitlement` call inside the existing new-launch branch | `c28853142` |
| OV-v43-G5-02 | `backend/app/services/scheduler_service.py` | one entitlement check before the thread insert | `c28853142` |
| OV-v43-G5-03 | `backend/app/services/tool_dispatcher.py` | one `_doc_out_of_scope` guard at the top of the shared byte helper | `ad093fd4a` |
| OV-v43-G5-04 | `backend/app/api/workflows.py` | one extra `Depends` on 4 authoring writes | `124dc444b` |
| OV-v43-G5-05 | `backend/app/api/threads.py`, `backend/app/services/run_producer.py` | the `caller_roles` source swapped (read → resolve) at one site each | `cdf3a308a` |

⚠ **Owed:** the hot-file ledger triples for these files (and `api/experts.py`, `api/schedules.py`,
`db/rates.py`, `pricing_service.py`) were not re-derived in the same commits — the same-commit sync
rule was not met. Re-derive at the next phase that touches any of them.

---

## Post-close deploys

| When | production | What | Verified |
|---|---|---|---|
| 2026-09-23 02:50 | `805360fef` | BUG-260923-02 pagination — Spend ledger, Library Health stale docs, Ingestion History, checked queries (frontend only) | new bundle live (unique string probe); backend /health 200. Operator browser check PASSED 3/3 |
