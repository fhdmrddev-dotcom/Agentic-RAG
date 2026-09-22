---
gsd_state_version: 1.0
milestone: none
milestone_name: none — v4.3 shipped 2026-09-23
status: between-milestones
last_updated: "2026-09-23T00:00:00.000Z"
last_activity: 2026-09-23 -- v4.3 What You Can Actually Sell CLOSED (git tag v4.3); re-audit tech_debt, 31/32
progress:
  total_phases: 0
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
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
**Current focus:** between milestones. Next: `/gsd:new-milestone` — phase numbering resumes at **265**,
migrations at **193**.

---

## Current Position

Milestone: none active (v4.3 shipped 2026-09-23, tag `v4.3`)
Phase: —
Status: Ready to scope the next milestone
Last activity: 2026-09-23 -- v4.3 audited, gaps closed, re-audited `tech_debt`, archived and tagged

---

## Carried into the next milestone's scoping

| Item | Where |
|---|---|
| ⛔ `PACK-05` — Financial Analyzer's knowledge unreachable from any real org (tenancy decision) | `SEED-304` |
| ✅ ~~Production deploy checklist — migrations **183-192** via SQL editor; `subscription_tier` on BOTH prod orgs **before** the backend ships~~ — **DONE 2026-09-23**: migrations **182-193** (12, one more than first counted: 182 was also missing, 193 written for prod) applied to production via the Supabase MCP on the operator's per-batch approval; both prod orgs set `enterprise`; verified per migration; `get_advisors(security)` shows no v4.3 table; `read_only=true` restored. **Code DEPLOYED 2026-09-23 02:32** — `production` at `dea7f5539` (master `98aef21fb`); backend /health 200 and `/experts` 403 (new route, auth-gated); frontend bundle carries the v4.3 tier message. Operator smoke test PASSED 4/4 (login + chat stream · Experts catalog · code execution in a NEW chat · /admin/spend) | `milestones/v4.3-MILESTONE-AUDIT.md` |
| Owed live UAT — 257 `/admin/spend` · 258 refusals as a standard-tier org · 261 G-4 authoring + grant drive · 263 post-WR-08 re-drive | each phase's `VERIFICATION.md` |
| Independent review owed — 255, 256, 262, 264, and every audit fix commit `c28853142`..`cdf3a308a` | — |
| Operator bus items still open: `BUS-246`, `BUS-248`, `BUS-263` (SEED-013 / OV-248-01), `BUS-280`, `BUS-283`, `BUS-303` (262 renumber) — `BUS-280`/`283` substantively resolved at close, see ROADMAP v4.3 archive | `.agent-bus/OPEN.md` |
| Two non-engineering commercial blockers (no legal entity; employment / IP position) | `SEED-294` |

---

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

