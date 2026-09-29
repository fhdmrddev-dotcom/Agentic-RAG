---
gsd_state_version: 1.0
milestone: v4.5
milestone_name: Find It, Show It
status: planning
last_updated: "2026-09-29T19:00:00.000Z"
last_activity: 2026-09-29 -- Milestone v4.5 started
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
**Current focus:** Milestone v4.5 Find It, Show It — defining requirements (phases resume at 270, migrations at 199)
**265**, migrations at **194** (193 was already taken by `193_expert_seed_org_portable.sql`).

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.
Phase 268's `BUS-305` review request was closed with the bus. ⚠ The `OV-SOLO-01-status` marker is
deliberately NOT set: it is global, and `live` retro-flags 12 phases (238-253, 265) that Gemini
genuinely reviewed.

---

## Milestone close (2026-09-29)

**v4.4 Experts That Actually Work COMPLETED by hand** (not `milestone.complete`): archives in `.planning/milestones/v4.4-*`, tag `v4.4`, 17/17 requirements, audit `tech_debt`. Full pre-close STATE: `milestones/v4.4-STATE-at-close.md`. ✅ LIVE 2026-09-29 — production `82babd8d0` (master `86d9559bb`, tag `v4.4` pushed); migrations 195/196/197 applied via MCP BEFORE the backend, 198 AFTER it; advisors: no ERROR findings. Owed: operator smoke test (install contract-reviewer in an enterprise org, sandbox code-run in a new chat, embedding key in Coolify env).

---

## Current Position (v4.5)

Phase: Not started (defining requirements)
Plan: -
Status: Defining requirements
Last activity: 2026-09-29 - Milestone v4.5 Find It, Show It started (hand-edited; `state.milestone-switch` NOT called, backup taken)

**The v4.4 block below is the v4.4 close history, kept verbatim.**


Milestone: v4.4 Experts That Actually Work
Phase: 269 (starter-expert-library) — CLOSED (5 of 5 plans; verification passed)
Plan: 5 of 5
Status: Phase 269 closed — verification `passed`; nothing deployed; ~~next: operator decides deploy / next v4.4 work (BUG-260929-01 fix is the gate for un-holding security-compliance)~~ BUG-260929-01 fixed (`464ec8354`) and CLOSED on a 15/15-PASS live re-drive; security-compliance PROMOTED into 198 (five Experts, local only); next: operator decides deploy (the image must carry `464ec8354` — `269-PROD-PARITY.md` §C) / next v4.4 work

- **2026-09-29, Phase 269 re-drive (after BUG-260929-01 fix `464ec8354`).** ⚠ Corrects the entry below: the library ships **FIVE** Experts. All five re-driven in a fresh enterprise-tier org (`uat269b`, evidence `08`-`12`, questions committed before driving): **15/15 PASS**; the security-compliance refusal re-emitted the exact leaking OR shape and got `No results.` (a read-only pre-fix/current counterfactual shows it is the ONLY discriminating turn of the five). security-compliance promoted VERBATIM into 198 (edited after a LOCAL-only apply — never deployed), corpus restored byte-identical, tests updated, bug `closed`. `.planning/phases/269-starter-expert-library/269-REDRIVE-SUMMARY.md`.
- **2026-09-29, Phase 269 executed.** The starter library ships ~~**FOUR**~~ (corrected above: **FIVE**) Experts via migration **198** (applied LOCALLY only): financial-analyzer (187 + the D-269-P2 copy fix), contract-reviewer, hr-policy-advisor, operations-analyst. **security-compliance HELD** (D-269-09) — its live refusal turn FAILED: `query_documents` returned a sibling-folder document → **BUG-260929-01** (open, folded into no phase). Greenfield runbook (`docs/OPERATOR.md` Step-3) now lists 186/187/189/198; the drift WARN that listing silenced is preserved in **SEED-326**; NULL-tier signup gap → **SEED-325**; SEED-244 answered. Production: `269-PROD-PARITY.md`, nothing applied.
- **Operator rulings 2026-09-29:** **D-269-P1** — tiers stay operator-assigned; no `handle_new_user` / tier / capability change; SC#1 qualified to *"an org on the enterprise tier sees the starter library"* (F-4 → SEED-325). **D-269-P2** — the Financial Analyzer's `example_output` and third prompt suggestion advertised figures its own corpus contradicts (24.3% / $412M, a quarter-over-quarter comparison); replaced with corpus figures (30.8%, +380 bps, $29.1M, ~42%) and a year-over-year prompt, shipped in 198.

- **2026-09-29 close:** Gemini's independent review checked by Claude — 0 blocking (CR-01/WR-01 refuted, WR-02 info). SC#1-continued PASS live on a seeded pause (line delta = run delta, +139,903 / +297). **D-2 FIXED** `a2274e435` (Continue's count was dropped by RLS). D-1 → **SEED-323**, D-3 → **SEED-324**. UI-review top 3 fixed `dda093f6f`.

- 268-01..03 shipped; 268-04 Task 1 (real-PG spend reconciliation, `6fd38f39a`) and Task 3 (live UAT,
  `da142f6dd`) done; Task 5's closeout (parity checklist, seeds, registers, gates) done ahead of the G-4 reply.

- Live (dev org `22f9c615-…`): SC#1 reconcile / filter / sub-agent, SC#2, SC#3 event / reload / retrieval,
  SC#4 biased / restricted / authz, MT-1, PT-1, LM-1 PASS. SC#10 fixed recipe: **1 PASS / 7 ⛔** — turn 2 answered
  from history without searching (**F-1 → SEED-319**, an operator design decision); the fresh-search variant
  retrieves only the new subtree on 8 / 8. SC#1-continued OWED-manual. Record: `268-UAT-LOG.md`.

- **2026-09-29, D-268-26 (SEED-319 "tell the model") BUILT and re-driven:** fix `1ec11a842` (RED `29e64548d`); SC#10
  run 2 = **6 PASS / 2 ⛔** (openai, google re-retrieve with grep on the NEW path: a pass-bar gap, answers correct);
  dropped-folder citations **6/8 → 0/8**; G4-2 API follow-up PASS. Backend 71 = base set. SEED-319 answered.

- ~~Still owed from 267: its independent review and the operator's G-4 sign-off (see the 267 block below).~~ **CLOSED 2026-09-29:** both landed — the independent review (`267-REVIEW-INDEPENDENT.md`; CR-02/CR-03 fixed and live-driven, CR-01 → SEED-327, the rest → SEED-328) and the operator's G-4 reply ("all pass", verbatim in `267-UAT-LOG.md`); `267-VERIFICATION.md` is `passed`.

- **2026-09-29, G-4 ×3 PASS** (driven in Chrome by the orchestrator, light + dark; operator "approved") — `268-UAT-LOG.md`.
- **2026-09-29, code review** 3 iterations → `all_fixed` (CR-01 second-Continue replay for two-org users + 7 warnings; D-268-27/28 operator rulings; SEED-322 planted; IN-01/02 accepted). Verifier re-ran gates: backend 71 = base, vitest 9102 / 0 failed.

Resume file: .planning/phases/269-starter-expert-library/269-05-SUMMARY.md
Last activity: 2026-09-29 -- Phase 269 closed

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

## Guardrail dispositions — Phase 269 (2026-09-29)

**No guardrail was overridden in 269.**

| Rule / item | Record | Evidence |
|---|---|---|
| G-2 (sketch before plan) | **Acceptance bar = the operator's reply at 269-04 Task 1, verbatim: `proceed`** — applied as acceptance of the orchestrator's presented recommendation *"G-2 accepted; LOCK financial-analyzer, contract-reviewer, hr-policy-advisor, operations-analyst; HOLD security-compliance"*. The live-rendered first-run catalog (API-level, `evidence/01`, `evidence/02`) is the bar; no component changed (D-269-06) | `269-UAT-LOG.md` § Operator lock |
| G-4 (lived-experience UAT) | **Rows driven live through the real API** in a fresh enterprise-tier org: first-run catalog, member reason state, 5 installs via the 266 path, cited + sibling refusal per Expert (15 rows: 14 PASS, 1 FAIL → held). ✅ **CORRECTED 2026-09-29: screenshots g4-01/02/05/06 captured** (Chrome DevTools, isolated context); g4-00/03/04 + the original 5-card first-run are NOT reproducible in that org, text evidence in `evidence/00-02` (original owed-note struck by this correction, not silently dropped) | `269-UAT-LOG.md`, `evidence/00-07` |
| G-5 (refactor between feature waves) | **Not fired — `watched: 0`.** A data-only phase: corpora, a data migration, tests, docs; no source file with a ledger row modified. Stated so it is not read as a skipped audit | `check-hot-file-ledger.cjs` at 269-05 |
| G-8 (plan-count proportion) | **5 plans / 4 waves.** Wave 1 split in two because 12 corpus files + their fences exceed one plan's budget; waves 2-4 are sequential by operator checkpoints (live drive → lock → close) | `269-0{1..5}-PLAN.md` |
| SC#10 cross-provider | **Does not fire** — no streaming / agent-loop / provider-routing / UI-state change; PACK-27 asks for one live conversation per Expert (all on `deepseek-v4-flash` / `deepseek`, the configured default) | `269-UAT-LOG.md` § SC#10 |
| 267 dependency | ~~**267 is `human_needed`** (independent review + operator G-4 sign-off owed).~~ **CORRECTED 2026-09-29: 267 is now `passed`** (see `267-VERIFICATION.md`). 269 inherits 267's additive-scope behaviour (D-267-01) as an **INHERITED DEPENDENCY** and does **not** claim 267 verified | `267-VERIFICATION.md` |
| independent_review | **`self`** — Gemini is out; run `/gsd:code-review 269` next (fresh-context subagent) | CLAUDE.md § Claude is the only agent |

**Owed from 269, and which to run first:**

1. `/gsd:code-review 269` + the verifier.
2. G-4 screenshots `g4-00` … `g4-06` (operator or a Chrome-equipped session).
3. **BUG-260929-01** — `query_documents` restricted-scope gap; affects every restricted Expert; security-compliance can ship only after a fix + a PASS refusal re-drive.
4. Production: `269-PROD-PARITY.md` — backend with corpora LIVE **before** 198; every write on explicit per-action approval.

## Guardrail records — Phase 268 (2026-09-28)

**No guardrail was overridden in 268.**

| Rule / item | Record | Evidence |
|---|---|---|
| G-2 (sketch before plan) | **HONOURED, not an override (D-268-01).** Sketch 268 ran before discuss; the operator picked **Chat A · Save & say · Spend A**. It is the acceptance bar for the G-4 drive | `.planning/sketches/268-expert-spend-and-mid-thread-scope/` |
| D-268-02 (dependency risk) | 268 reuses 267's transcript-event plumbing (`TRANSCRIPT_EVENT_KINDS`, the history skip, the event card) while **267 still owes its independent review and the operator's G-4 sign-off**. **Unchanged by 268:** the plumbing was extended additively (`scope_changed` joins the allowlist; 267's fixtures stay byte-equal), and 268-01 only added org stamps in `agent_loop.py`. The risk stands until 267's review lands | `268-03-SUMMARY.md` § D-268-02 |
| G-5 (refactor between feature waves) | **Honoured by construction on every firing file, NO override.** Each change is additive kwargs/fields, one arm, one writer, one route, or a shape that already existed. **G-5 not fired: `retrieval_service.py` unmodified; SEED-224 extraction stays owed** (D-268-03 → D-268-14; `git diff 220c82dde -- backend/app/services/retrieval_service.py` empty). **Crossed the threshold in 268:** `frontend/src/pages/admin/AdminSpendPage.tsx` (`9 / 3 / 974`) — the next phase that edits it proposes an extraction first | `docs/HOT-FILE-LEDGER.md` § Phase 268 CLOSE |
| G-8 (plan-count proportion) | **4 plans / 3 waves (D-268-15).** The sub-agent roll-up SQL was moved from plan 1 to plan 2 so it lives beside the breakdown in `db/rates.py` (one author for one CTE) | `268-0{1..4}-PLAN.md` |
| D-268-09 | **Org spend totals rise because sub-agent tokens are now counted.** 257 priced root runs only; 268 prices every sub-agent at its own rate and rolls it into its root and that root's Expert. Disclosed on the Blind Spots card ("Sub-agent tokens now counted"); not a pricing change | `268-02-SUMMARY.md` |
| UAT findings | **F-1** (a same-prompt follow-up after a scope change is answered from history; 6 / 8 providers cite the dropped folder, one under a false location) → **SEED-319**, routed to the operator, not fixed. ~~**Q9** (Continue's user-JWT UPDATE matching 0 rows) **refuted by data**, no seed.~~ ⚠ **CORRECTED 2026-09-29 — Q9 was TRUE**: measured live, the API said `continues_used 1` and the row read `0` (`runs` is SELECT-only under RLS). Fixed as **D-2** `a2274e435`. Fixture substitution: Financial Analyzer is Restricted, so SC#4-biased used UAT-265 Billing SOP Advisor | `268-UAT-LOG.md` |

**Owed from 268, and which to run first:**

1. ~~The operator's G-4 Chrome pass~~ **PASS ×3, both themes, operator "approved" 2026-09-29** (`268-UAT-LOG.md`).
2. ~~**The independent review**~~ **Done 2026-09-29** — Gemini, checked by Claude, 0 blocking (`268-REVIEW.md`).
3. ~~**SC#1-continued** live~~ **PASS 2026-09-29** on a seeded pause, after the D-2 fix (`268-UAT-LOG.md`).
4. ~~The operator's ruling on **SEED-319** (F-1).~~ Ruled 2026-09-29 (D-268-26) and BUILT (`1ec11a842`); SC#10 re-drive 6/8.
5. **Still owed —** Production: `268-PROD-PARITY.md` — migration 197 BEFORE the backend deploy; every write on explicit per-action approval.

**CLAUDE.md size:** 117,178 chars after 268's cells — under the 120,000 warn band; no split scheduled (headroom
2,822 to the band).

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

---

## Deferred Items

Items acknowledged and deferred at v4.4 milestone close on 2026-09-29 (42; operator chose [A] Acknowledge all):

| Category | Item | Status |
|----------|------|--------|
| quick_task | 260322-26g-improve-tool-call-display-for-ls-tree-gr | missing |
| quick_task | 260328-v6n-investigate-and-plan-fixes-for-duplicate | missing |
| quick_task | 260328-wqj-fix-folder-scoped-chat-returning-results | missing |
| quick_task | 260328-x6n-fix-bug-folder-not-created-when-pressing | missing |
| quick_task | 260404-vel-fix-streaming-cursor-bug-and-add-meaning | missing |
| quick_task | 260405-rgy-fix-folder-public-visibility-files-and-s | missing |
| quick_task | 260405-s1e-hide-toggle-global-from-non-owners-and-b | missing |
| quick_task | 260405-stg-add-chat-references-cascade-deletions-an | missing |
| quick_task | 260407-vqw-review-and-fix-context-window-management | missing |
| quick_task | 260411-wj5-fix-skill-file-upload-bug-files-not-save | missing |
| quick_task | 260412-dqu-fix-four-issues-in-backend-app-api-skill | missing |
| quick_task | 260412-jnc-import-skill-return-202-backgroundtask-f | missing |
| quick_task | 260522-gdg-google-15-iter-loop-diagnostic | missing |
| quick_task | 260529-0sc-fix-phase-086-wr-04-persist-panel-todo-t | missing |
| quick_task | 260529-1wb-fix-bug-260529-01-write-todos-crashes-on | missing |
| quick_task | 260530-wjp-infer-native-tools-for-deepseek-moonshot | missing |
| quick_task | 260530-wvt-fix-title-gen-stuck-on-new-chat-strip-th | missing |
| quick_task | 260531-00x-add-reportlab-to-sandbox-image-pdf-writi | missing |
| quick_task | 260611-irx-worker-log-rotation-pid | missing |
| quick_task | 260630-226-chat-tool-card-live-state-de-duplication | missing |
| quick_task | 260705-hz1-fix-seed-102-reverse-the-name-collision- | missing |
| quick_task | 260705-nfu-fix-a-silent-data-loss-bug-in-skill-zip- | missing |
| quick_task | 260731-3y4-armed-approval-allow-list | missing |
| quick_task | 260807-x9p-bound-steptypepicker-height-to-measured- | missing |
| quick_task | 260808-148-steptypepicker-keyboard-navigation-rovin | missing |
| quick_task | 260809-klo-fix-bug-260809-02-add-a-business-require | missing |
| quick_task | 260814-q5r-show-a-template-s-placeholders-when-it-i | missing |
| quick_task | 260830-lib-address-4-library-uat-observations | unknown |
| quick_task | 260906-5qd-fix-bug-260906-01 | missing |
| todo | spike-nl-workflow-authoring.md | open |
| seed | SEED-003-deployment-flexibility-install-ux | dormant |
| seed | SEED-004-org-multi-tenancy | dormant |
| seed | SEED-041-conversation-compaction | dormant |
| seed | SEED-043-sandbox-package-management | dormant |
| seed | SEED-046-library-health-dashboard-enrichment | dormant |
| seed | SEED-127-reasoning-first-forced-emission-gap | dormant |
| uat | 265 265-UAT-LOG.md | unknown |
| uat | 266 266-UAT-LOG.md | unknown |
| uat | 267 267-UAT-LOG.md | unknown |
| uat | 268 268-HUMAN-UAT.md | partial |
| uat | 268 268-UAT-LOG.md | unknown |
| uat | 269 269-UAT-LOG.md | unknown |
