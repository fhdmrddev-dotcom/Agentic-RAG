---
gsd_state_version: 1.0
milestone: v4.4
milestone_name: Experts That Actually Work — 🚧 IN PROGRESS
status: executing
last_updated: "2026-09-24T18:27:46.022Z"
last_activity: 2026-09-24 -- Phase 266 planning complete
progress:
  total_phases: 12
  completed_phases: 1
  total_plans: 10
  completed_plans: 5
  percent: 8
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
**Current focus:** Phase 266 — next (265 complete 2026-09-24)
**265**, migrations at **194** (193 was already taken by `193_expert_seed_org_portable.sql`).

---

## Current Position

Milestone: v4.4 Experts That Actually Work
Phase: 265 (owed-v4-3-verification) — COMPLETE
Plan: 5 of 5
Status: Ready to execute
G-2 for 266 skipped BY OPERATOR DECISION at discuss (D-266-16) — install button + 3 states on shipped ExpertDetailModal/ExpertCard
Resume file: .planning/phases/266-expert-knowledge-in-a-real-org/266-CONTEXT.md
Last activity: 2026-09-24 -- Phase 266 planning complete

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
