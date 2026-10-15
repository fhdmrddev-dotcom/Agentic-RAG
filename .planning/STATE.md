---
gsd_state_version: 1.0
milestone: v4.6
milestone_name: Pay It Down
status: executing
last_updated: "2026-10-15T19:51:21.591Z"
last_activity: 2026-10-15 -- Phase 283 planning complete
progress:
  total_phases: 15
  completed_phases: 6
  total_plans: 25
  completed_plans: 22
  percent: 40
---

# Project State

> ⚠ **This file was RESET at the v4.5 close (2026-10-12)** — the eighth reset, same reason each time.
> **Nothing was deleted:** the full pre-close file (315 lines) is archived verbatim at
> [`.planning/milestones/v4.5-STATE-at-close.md`](milestones/v4.5-STATE-at-close.md), including every
> per-phase position entry, the v4.5 guardrail overrides (OV-271-01, OV-273-01..05) and the post-close
> deploy table.
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs or `milestone.complete`.** The v4.5
> close was done by hand for that reason (eight prior false-record occurrences, see the v4.2 archive).

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-10-12)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviours (skills) that persist and can be shared.
**Current focus:** Phase 283 — every member reaches their own settings

---

## Solo running (operator, 2026-09-29)

Gemini is OUT and the agent bus is RETIRED. Claude builds and reviews everything; no independent
reviewer exists, so a phase closes `verification_mode: self-verified`, never `reviewed`.

---

## Milestone close (2026-10-12)

**v4.5 Find It, Show It COMPLETED by hand** (not `milestone.complete`): archives in
`.planning/milestones/v4.5-*` (ROADMAP, REQUIREMENTS, MILESTONE-AUDIT, STATE-at-close, phases/),
tag `v4.5` (local, not pushed), 25/25 requirements, audit `tech_debt`, no blockers. Integration 8/8
seams, flows 3/3. Closed core 7 phase types / 1 emitter / **30 tools** (+`show_artifact`, recorded).

---

## Current Position

**Post-282 bug fixes (2026-10-15), all closed on live re-drives, not pushed:** BUG-261015-03 `ee0f4beaf` (ask_user 300 s floor + null-guidance schema text; 7/7 rows paused past 100 s and answered), -04 `5358a243a` (credit 400 / 402 → billing copy; Anthropic row live), -05 `bdf18576e` (run linked to its reply at save time + live-copy-wins reload merge; Spark 1 bubble through a forced mid-window reload; cloud row not driven), -06 `b77aade1e` (NEW, major: the shutdown sentinel was Redis-wide, so the unit suite / another worker interrupted live pauses; now per-process). 278 pins changed deliberately: `_handle_ask_user` RETIRED from the pure-move fence; schema digests re-captured (only the ask_user description changed, proven). Backend gate: failing set == base (71) after the pin re-capture. `spark-x2.5-4b` enabled by the operator.

**Phase 282 CLOSED (2026-10-15).** Review `3268b6228`: 1 critical / 5 warnings / 4 info; fixed `817cc2b3b`..`d78f3c93b` test-first (CR-01 retries now key on the routing provider; WR-02/04/05 fixed; WR-01 partial — an in-flight cloud open keeps running; WR-03 timeout label deferred; IN-01..04 left). Verification `64a0a2c06`: **passed 5/5**, `self-verified`. Backend baseline after fixes 71 failed / 7546 passed / 0 errors, failing SET == base `d1ba70553`. Owed by decision: G4-4 (max 356 s), G4-6, A1, Add-form click-through, SC#10 rows 2/8 once credit exists; operator to enable `spark-x2.5-4b`. Open bugs from the phase: BUG-261015-03 (major), -04, -05. Hot-file ledger triples for the 6 review-fix files not re-derived (presence gate green). **Not pushed.** Next: `/gsd:discuss-phase 283`.

**Phase 282 executed 4/4 + operator sign-off `approved` (2026-10-15).** 282-03: SC#10 board 6 PASS / 2 ⛔ billing / 0 FAIL; G4-1/2/3/5 PASS on DOM state; BUG-260918-01 + BUG-261015-02 closed; BUG-261015-03 (ask_user required timeout → models pick ~60 s, major) + BUG-261015-04 (Anthropic credit 400 shown as model-parameter error, minor) filed, open. 282-04 (`f173d3a4a`, `8fb2bb684`, operator-requested): self-hosted models default to 900 s; Timeout on Add model by ID; live-verified; backend 71 = base set; ModelRegistryTab pin 37. **Owed by decision:** G4-4 (> 600 s; measured max 356 s), G4-6 (needs approved write), A1 LangSmith nesting, fixed Add-form click-through; operator to enable `spark-x2.5-4b` (added rows start disabled). Not pushed. Next: `/gsd:code-review 282` → gsd-verifier.

**Phase 282 wave 1 (2026-10-15):** 282-01 (FIX-06) + 282-02 (FIX-07) executed in parallel worktrees, merged `fdcfde57d`, worktrees torn down (venv/node_modules intact). 01: backend gate 71 failed / 7508 passed / 0 errors, failing SET == base; loop stall 2.970 s → 0.065 s. 02: count gate 1 failing — `WorkflowBuilderPage.canvas.test.tsx` STACK_TRACE_ERROR timeout, file untouched by the phase, same failure in 280-04, green alone (inherited-vs-new to settle at 282-03 Task 1 by re-running at base). Merged-tree tsc set == base (58). Next: 282-03.

**Phase 282 planned (2026-10-15, autonomous):** 3 plans / 2 waves (01 FIX-06 + 02 FIX-07 parallel → 03 board + G-4, non-autonomous). Research amendments D-19..D-26: ceiling **1800** (run watchdog 2400 s; prod max stored 1200), shared open+drain deadline + off-loop open (BUG-261015-02 measured 3.8 s loop stall), retries local/Google 0 · cloud 2. UI-SPEC approved (rev 1). Checker PASSED 0 blockers / 3 warnings (W2, W3 fixed in plan; W1 accepted). Ledger rows added for 5 files. 37 path-matched seeds reviewed, none folded.

**Phase 282 (2026-10-15):** discuss done AUTONOMOUSLY (operator: "take best decisions") — `.planning/phases/282-the-slow-run-and-the-paused-run/282-CONTEXT.md` (D-01..D-18). G-2 sketch `282-one-answer-input` written + Chrome-driven; winner A (input follows the open panel) — **operator confirmation OWED at G-4**. Folded BUG-260916-01, BUG-260918-01, SEED-172 #2/#3, new BUG-261015-02 (conditional). SEED-289 → deferred. No migration expected. Next: `/gsd:plan-phase 282`.

**Phase 281 executed 4/4 plans (2026-10-15) — G-4 sign-off (281-04 Task 4) PENDING.** Rows in `.planning/phases/281-a-refusal-names-its-cause/281-LIVE-EVIDENCE.md`, driven at `33886624f`: **A ⛔ OWED** (model passed: golden run `e4b3625a…` completed, emit passed on its first call, and publish was refused by the JUDGE, so there was no emit cause to read; the draft had to be KB-bound to publish, then restored to unbound) · **B ✅ PASS** (no "coming soon"; link opened the judged run, 3 ids equal; failed-step-reason sub-check not exercisable) · **C ⛔ OWED** (drafting model returned `could_not_generate` twice, so `connection_not_allowed` never rendered; the SEED-218 `Connect Linear` click ✅ landed on Connections) · **D ⛔ OWED** (archive write not approved; folder docs all 2026-06-08 vs `max_age_days 2`, so no decisive arrangement without a fresh upload). Flips: BUG-260815-06 → closed (row B); SEED-218 → answered (residual: DOOR_REFUSAL still says "in Settings"); BUG-260730-02 and SEED-221 unchanged, with dated notes. Guardrail overrides: OV-281-01 only (below). **Owed rows, run first: A** (a live emit refusal also unlocks B's sub-check and the D-32 chat half), then C (needs a healthy drafting model), then D (needs operator approval + one fresh upload).

**Phase 281 planned (2026-10-14):** 4 plans / 3 waves (01+02 → 03 → 04 non-autonomous G-4 drives A-D). Research corrected 4 CONTEXT premises → amendments D-24..D-32 (operator). SEED-218 folded; SEED-350/339 deferred. Checker PASSED (iteration 2, 0 blockers). Ledger rows added for emit_cause.py, freshness.py, describeRefusalVocabulary.ts, runVocabulary.ts. Next: `/gsd:execute-phase 281`.

**Phase 281 (2026-10-14):** discuss done — `.planning/phases/281-a-refusal-names-its-cause/281-CONTEXT.md` (D-01..D-23). G-2 sketch skip RECORDED (D-21). Folded: BUG-260730-02, BUG-260815-06 (#4), SEED-221. Left open: BUG-260828-05. G-4 scenarios A-D operator-named. No migration expected. Next: `/gsd:plan-phase 281` (re-run the seeds sweep there).

**Phase 280 (2026-10-14):** discuss done — `.planning/phases/280-in-once-out-clean/280-CONTEXT.md`. No migration expected. 4 bugs folded (BUG-261005-01, BUG-260910-04, BUG-261012-01, BUG-261012-02). Owed to operator: upload the generated `Team Docs` folder to OneDrive before the live re-drive (D-14). Next: `/gsd:plan-phase 280`.

Milestone: **v4.6 Pay It Down** (started 2026-10-12)
Phase: 282 (the-slow-run-and-the-paused-run) — planned 3/3, executing
Next: `/gsd:discuss-phase 282` (G-2 sketch first for FIX-07). Deploy of 277-281 + BUG-261014-06 stays operator-gated.
Plan: Not started
Status: Ready to execute
Last activity: 2026-10-15 -- Phase 283 planning complete
Gates at close (HEAD `aef68af4a` + 279-04 docs): backend unit **71 failed, 7277 passed, 0 collection errors**, failing SET == `279-base-failed.txt`; root-level `backend/tests/*.py` (45 files, test_096 skipped, test_harness_gates hangs at BOTH revs) **46 failed / 503 passed at `a5a94ba67` and at HEAD, sets equal**; frontend typecheck 66 errors / 40 groups, set == base; vitest count gate **OK** (10210 total, 0 failing, no per-file decrease); ledger gate + CLAUDE.md size gate exit 0.

**279-03 (2026-10-13):** "Won't use" → "Won't search" (29 hits / 13 files measured, not 30), swap-card
"Won't be searched:" prefix (D-16), WR-03 no-folder + spotlight statements, IN-01 dialog field, D-15
send-409 narrowed to the `Thread is workflow-locked` prefix, WR-06 chip clear, WR-01 client hide, WR-07
server reason + `listExperts(true, false)`. Typecheck set == base.

**279-04 (2026-10-13):** G-4 rows 1a/1b/2a/2a-DB/2b/3/4 and the two-org row 5 driven in Chrome (operator
approved; row 5 sent by the operator, sentence reported verbatim). WR-05 recorded fixed on Chrome + DB
evidence (row `5a547220…`) as a TRUST-03 mitigation, not enforcement. D-18 local parity read:
`null_org_expert_threads = 0` (of 60). Guardrail overrides: **none** (OV-279-01 not required). Three
files crossed G-5 in the phase (`ExpertSpotlightCard.tsx`, `expertEventCopy.ts`, `ScopeLedger.tsx`) —
next phase on any of them: extraction FIRST.

**279-01 (2026-10-13):** `expert_scope.py` split into pure (143 lines, no `app.` import) /
`expert_scope_statement.py` / `expert_scope_events.py`, AST-identical to `a5a94ba67`, no shim, 0 fixture
bytes changed; checker CLEAR in both modes; root-level set equal (35/35); backend gate 71 failed, SET ==
`279-base-failed.txt`. Measured surprise: model docstrings are OpenAPI descriptions, so the move commit
also regenerated `docs/public/api/openapi.{snapshot,public}.json`. 279-02 owns: `RETIRED` entries
(D-07, WR-08) and removing the 8 strict-xfail markers in `test_279_org_helper.py`.

**279-02 (2026-10-13):** SEED-328 backend items fixed, each RED-first: `_require_thread_org` (1 def + 4
door calls, send refuses before any write, no active org fails closed — D-18), WR-01 handoff-while-
streaming 409, WR-02 conditional Expert UPDATE → `ExpertChangeConflict` 409, IN-05 clear stated in the
thread's org (`_caller_role_in_org`, honoured by construction — **OV-279-01 NOT required**), WR-05
quoted-background handoff (mitigation, not enforcement), IN-03 per-emitter directive (SEED-327 NOT
fixed), GET /experts manager view, D-07 r→r exclusion (+ phase279 fixture), WR-08 multi-folder scope
note (single-folder byte-identical). Gate 71 failed, SET == base. ⚠ Deviations: 2 mock rows in
`test_267_scope_preview.py` (279-03's file — non-overlapping hunks, confirm the merge) and the
`test_264_born_for_carrier.py` arity pin 5 → 6. ⚠ Owed to 279-03/04: the send-door 409 hits
StreamsProvider's workflow-lock arm (Pitfall 1); provider-doc check for IN-03 not fetched (no tool).

### Quick Tasks Completed

| # | Description | Date | Commit | Directory |
|---|-------------|------|--------|-----------|
| 261012-x1l | fix 277-REVIEW WR-01 (size hook leads with STOP/WARNING when ledger findings exist) + WR-08 (uniform `· ⛔` marker on 66 moved FIRING cells + legend) | 2026-10-12 | 30d659415 | [261012-x1l-fix-review-warnings-wr-01-and-wr-08-from](./quick/261012-x1l-fix-review-warnings-wr-01-and-wr-08-from/) |
| fast 2026-10-13 | landing drift: `facts.ts` BUILTIN_TOOL_COUNT 29 → 30 (+ `Artifacts` group for `show_artifact`); landing vitest 53/53 | 2026-10-13 | 6ba316b6a | — |
| fast 2026-10-14 | BUG-261014-06: Library read 0 documents at 286 (`414 URI too long`) — `list_documents` count reads batched at 100 ids. **Stopgap, develop only**: the operator held the prod hotfix ("a sustainable solution not a batch"); Phase 284 replaces it | 2026-10-14 | e422066ca | — |

### Roadmap Evolution

- Phase 284 added 2026-10-14: **Library at Scale** (FIX-11) — server-paged list, server-side counts, no growing id lists; from BUG-261014-06 + BUG-261014-07 (every document list silently capped at 1,000 rows).

### Owed to the operator (carried from v4.5)

| # | Item | Notes |
|---|---|---|
| 1 | ~~Deploy 275~~ **DONE 2026-10-12** | prod `784647e2d` (master `8764137fe`, tag `v4.5` pushed). Migrations 204 → 205 → 206 applied via MCP, one approved write each, every VERIFY row PASS (205 first attempt failed with an MCP transport error before reaching the DB; retried). Backend live 18:32 (`/retention/summary` 404→403), `/docs` 401, frontend bundle carries the retention UI. Advisors 0 ERROR (+3 expected: `retention_sweeps` no-policy INFO; `document_is_retrievable`, `storage_object_backs_document` callable by authenticated — the policies need it). `source_state` all NULL (178 docs, all retrievable). 0 deletes during the 206→backend window. Coolify confirmed by the operator 2026-10-12: `RETENTION_SWEEP_ENABLED=false`, `ENVIRONMENT=production` |
| 2 | 275 hands-on UAT | `.planning/milestones/v4.5-phases/275-retention-legal-hold/275-UAT.md` — 18 rows, pending |
| 3 | 273 live STRUCTURED-path drive (run first of the re-checks) + WR-04/05 visual | `273-HUMAN-UAT.md` |
| 4 | 271 G-4 sign-off (G4-1..G4-6) + P-01 / P-03 decisions | `271-UAT.md` |
| 5 | 272 live re-drive of the review fixes | `272-HUMAN-UAT.md` |
| 6 | Logged-in production smoke test of v4.5 (270-274 + 276 live since 2026-10-05) | also owed from v4.4 |

### Owed from Phase 279 (2026-10-13)

| # | Item | Notes |
|---|---|---|
| 1 | ✅ DONE 2026-10-14 — cloud D-18 read: `null_org_expert_threads = 0` (Supabase MCP, read-only SELECT). Nothing to accept or backfill. ~~279 deploy: run D-18 NULL-org Expert-thread SELECT on cloud (read-only) before promoting~~ | `SELECT count(*) AS null_org_expert_threads FROM public.threads WHERE active_expert_id IS NOT NULL AND org_id IS NULL` — local `0`. `> 0` means those threads become refused-at-send after deploy: accept (D-18 fail-closed) or propose an approval-gated backfill. `279-SEED-328-RECORD.md` § "D-18 cloud parity" |
| 2 | 4-axis UAT rows — owed by decision (D-17 + operator `ready`, 2026-10-13) | 8 cross-provider rows + multi-tool + parallel-thread + long-message, all ⛔ in `279-VALIDATION.md`. **First to run if re-opened: parallel-thread** (WR-01's handoff gate is per-thread) |
| 3 | 267-FIX live note #5 — CR-03(c) snapshot-reconcile chip-clear, never browser-driven | UAT-LOG row 3 drove the `getExpert`-failure arm via a client-injected failure, not this arm |
| 4 | IN-03 provider-docs-first check | Anthropic tool_choice auto + Gemini function-calling mode AUTO docs; only those two receive the coerce rung's system text. SEED-327 untouched |
| 5 | Phase-review leftovers (owed, non-blocking) | `279-REVIEW.md` IN-01..IN-06 (stale `workflow-lock-error-banner` testid on every send 409; folder-arm 409 wording; vacuous `--exclude-prefix ""` CLEAR; WR-06 alert outlives a later load; transient org-check failure shows the org sentence; WR-08 note `ls` default) + WR-02 NULL-org continuation residual (operator ruling 2026-10-14) + catalog subtitle no longer literally true for managers + `ExpertDetailModal` copy unpinned + `test_264_born_for_carrier.py` changed outside 279-02's list. The two 409 test titles: ✅ fixed by WR-06 `16e355582`. List: `279-VALIDATION.md` § Still owed |
| 6 | `graphify update .` after the close | run at 279-04 close; `graphify-out/` is never committed |

### Guardrail overrides (v4.6)

- **279:** none written. OV-279-01 (threads.py IN-05) was pre-written in the plan and NOT required —
  279-02-SUMMARY row D route proof: event=None rides `if event is not None:` then the existing
  `elif update_data:` arm (test `test_IN05_a_non_member_clear_writes_no_event_through_the_plain_update_arm`).
  Every touched FIRING file is recorded honoured by construction in `279-SEED-328-RECORD.md` § G-5.

- **OV-281-01 (G-5, `harness_engine.py`):** 281-01's plan capped the engine at "≤ 4 new conditional
  nodes"; measured AST delta is If 106→107, IfExp 34→38 = **5**. The 5th lives inside the new
  `_attempt_identity` helper the plan itself asked for; no new branching kind. Recorded by the
  orchestrator 2026-10-14 as a call-out, still honoured by construction (281-01-SUMMARY).

### Carry into the next milestone's scoping (✅ consumed by v4.6 intake 2026-10-12 — kept as the record)

- Integration W-1 (`harness/freshness.py` counts archived docs), W-2 (artifact rows outlive retention
  disposition — needs a recorded decision), W-3 (filter vocabulary restated twice), W-5 / BUG-261012-01.

- Open bugs: BUG-261004-02, BUG-261005-01, BUG-261012-01, BUG-261012-02.
- SEED-354 (hold private documents), SEED-334 (272 SC#4 providers), SEED-224 (`retrieval_service.py`
  extraction), OV-273-02 (`tool_dispatcher.py` registry split), `expert_scope.py` extraction first.

- ~~CLAUDE.md past the 120k warn band — split scheduled.~~ **DONE in 277** (89,171 chars).

---

## Deferred Items

Items acknowledged and deferred at v4.5 milestone close on 2026-10-12 (47; acknowledged at close — the
operator asked to close the milestone):

| Category | Item | Status |
|----------|------|--------|
| quick_task | the same 29 historical quick-task dirs deferred at the v4.4 close (260322-26g … 260906-5qd; full list in `milestones/v4.5-STATE-at-close.md` → Deferred Items) | missing / unknown |
| todo | spike-nl-workflow-authoring.md | open |
| seed | SEED-041-conversation-compaction | dormant |
| seed | SEED-043-sandbox-package-management | dormant |
| seed | SEED-046-library-health-dashboard-enrichment | dormant |
| seed | SEED-127-reasoning-first-forced-emission-gap | dormant |
| uat | 270 270-UAT-LOG.md | unknown |
| uat | 271 271-UAT-LOG.md | unknown |
| uat | 271 271-UAT.md | partial |
| uat | 272 272-HUMAN-UAT.md | partial (1 open scenario) |
| uat | 272 272-UAT-LOG.md | unknown |
| uat | 273 273-HUMAN-UAT.md | partial |
| uat | 273 273-UAT-LOG.md | unknown |
| uat | 274 274-UAT-LOG.md | unknown |
| uat | 275 275-UAT.md | pending |
| uat | 276 276-UAT-LOG.md | unknown |
| verification | 271 271-VERIFICATION.md | human_needed |
| verification | 272 272-VERIFICATION.md | human_needed |
| verification | 273 273-VERIFICATION.md | human_needed |
