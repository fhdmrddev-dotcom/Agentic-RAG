---
phase: 265-owed-v4-3-verification
plan: 05
created: 2026-09-24
inputs: [265-REVIEW-255.md, 265-REVIEW-256.md, 265-REVIEW-262.md, 265-REVIEW-264.md, 265-REVIEW-audit-fixes.md, 265-UAT-LOG.md, "256/257/258/261/263 VERIFICATION.md result: lines", "263-UAT.md § Re-drive post-WR-08", BUG-260923-02, BUG-260921-02]
checker: 265-triage-check.py
seeds_planted: [SEED-305, SEED-306, SEED-307, SEED-308, SEED-309, SEED-310, SEED-311]
operator_bus: BUS-304
---

# 265 Triage — one written verdict per finding and per non-PASS UAT row

**Rule D-04 (quoted from 265-CONTEXT.md):** a finding is `fix` only when it is CONFIRMED and the change is **≤ 1 file / ≤ 10 lines, with no schema and no API surface**. Anything larger, or any missing capability, is `defer`, routed to a named seed or a named later v4.4 phase (266–269). `accept` must state why the behaviour is acceptable. A PLAUSIBLE finding is never `fix` without a fresh drive. Every PLAUSIBLE row below is `defer` or `accept`, and says so.

**Fixes in this table are CANDIDATES for Task 2.** The builder (the orchestrator, not a reviewer) applies them, and a fresh reviewer then re-drives each one. Only two rows are already done: `R265-audit-fixes-01`, the operator-authorised hotfix OV-265-01, and `UAT-265-CATALOG-SCROLL`.

The routes are seeds SEED-305 to SEED-311, all planted in this plan, plus phases 266 (Expert knowledge in a real org), 267 (an Expert adds scope), and 268 (Expert spend and mid-thread scope). Operator rulings are gathered in **BUS-304**.

## Table

| id | source | severity | status | verdict | size (files/lines, schema/API?) | route | rationale |
|---|---|---|---|---|---|---|---|
| R265-255-01 | 265-REVIEW-255.md | major | CONFIRMED | defer | guard rewrite (regex → AST), >10 lines, 2+ files; no schema/API | SEED-305 | EXT-02 is not met for dynamic forms. Fixing it means redesigning the guard, which is not a G-3 change. |
| R265-255-02 | 265-REVIEW-255.md | major | CONFIRMED | defer | 2 files (cjs + pytest); no schema/API | SEED-305 | Comment stripping is shared by both guards, and the fix belongs with the AST rewrite. |
| R265-255-03 | 265-REVIEW-255.md | major | CONFIRMED | defer | 2 files (cjs + pytest path lists); no schema/API | SEED-305 | The scan lists must agree across two files, so it exceeds the 1-file limit. It goes with the guard rework. |
| R265-255-04 | 265-REVIEW-255.md | major | CONFIRMED | defer | new test design, >10 lines; no schema/API | SEED-305 | Registry-closure tests need a source-level check, and that is a capability, not a patch. |
| R265-255-05 | 265-REVIEW-255.md | major | CONFIRMED | fix | 1 file (`.claude/hooks/extension-contract-guard.js:60-63`), ≤ 10 lines; no schema/API | Task 2 candidate | Emit `hookSpecificOutput.additionalContext` JSON and exit 0, following the `hot-file-ledger-guard.js` shape, so the editing agent is told. ⚠ This code was built in 255-01, which is Gemini-built work, so the fix is not builder-fixes-own-work. |
| R265-255-06 | 265-REVIEW-255.md | major | CONFIRMED | defer | 1 file but a full rewrite (29 schema errors) >10 lines; no schema/API | SEED-305 | The example must be rewritten against the real `WorkflowDefinition`. |
| R265-255-07 | 265-REVIEW-255.md | minor | CONFIRMED | defer | docs >10 lines | SEED-305 | The MCP example's dev URL and UI steps need rewriting against `validate_mcp_destination` and the real UI. |
| R265-255-08 | 265-REVIEW-255.md | minor | CONFIRMED | defer | doc or import-path change; the import path is API behaviour | SEED-305 | Either the doc stops promising `trigger_phrases`/`parameters`, or import starts keeping them. That is a product decision. |
| R265-255-09 | 265-REVIEW-255.md | minor | CONFIRMED | fix | 1 file (`docs/EXTENSION-CONTRACT.md:117-119`), ≤ 6 lines; no schema/API | Task 2 candidate | Change "AST and pattern scanner" to "line-based pattern scanner" and remove the pre-commit claim. Docs only. |
| R265-255-10 | 265-REVIEW-255.md | minor | PLAUSIBLE | defer | needs a Docker drive first; runtime config | SEED-305 | This is PLAUSIBLE, not driven. The sandbox network and CPU claim must be driven with Docker before anything changes. |
| R265-255-11 | 265-REVIEW-255.md | info | PLAUSIBLE | defer | docs; needs a live MCP drive | SEED-305 | This is PLAUSIBLE. The legacy SSE transport mismatch must be driven against a live server. |
| R265-256-01 | 265-REVIEW-256.md | major | CONFIRMED | defer | migration (schema) | SEED-306 + BUS-304 | Owner-writable metering columns need a revoke migration, which is schema, so it is outside D-04. The operator must rule on a 194-style hotfix or the seed. |
| R265-256-02 | 265-REVIEW-256.md | minor | CONFIRMED | defer | fence redesign (cross-statement), >10 lines | SEED-307 | The fence would need dataflow across statements to see Python-side sums. |
| R265-256-03 | 265-REVIEW-256.md | minor | CONFIRMED | defer | hot file (`harness_engine.py`, G-5); behaviour-neutral cleanup | SEED-307 | The code is redundant but idempotent, and nothing is mis-counted. Clean it up with the next metering touch. |
| R265-256-04 | 265-REVIEW-256.md | minor | CONFIRMED | defer | 2 files (`db/workflows.py`, `circuit_breaker.py`) | SEED-307 | NULL vs 0 semantics span two files. The `addressed_in: Phase 257` record is false, and this seed now carries it. |
| R265-256-05 | 265-REVIEW-256.md | minor | CONFIRMED | defer | control-flow change in the eval runner, with a test | SEED-307 | Errored arms need their partial usage captured, and that change is more than a guarded one-liner. |
| R265-256-06 | 265-REVIEW-256.md | minor | CONFIRMED | defer | finalize-site change + fence | SEED-307 | Zombie-sweep NULL tokens need a design choice about what a swept run spent. |
| R265-256-07 | 265-REVIEW-256.md | info | CONFIRMED | fix | 1 file (`backend/app/services/harness_engine.py:2300-2306`), comment-only ≤ 4 lines; no schema/API | Task 2 candidate | Correct the comment's stated order: the `:2320` flush writes, and `phase_completed` is the no-op. This is not behavioural. |
| R265-256-08 | 265-REVIEW-256.md | info | PLAUSIBLE | defer | spend-view query | SEED-307 | This is PLAUSIBLE and consistent with D-256 grain. Decide it when 268 reworks the spend view. |
| R265-262-01 | 265-REVIEW-262.md | major | CONFIRMED | defer | runtime capability read across several callers, >1 file | SEED-308 | Registry fields are saved but not read. The fix is an async-aware read in every caller. |
| R265-262-02 | 265-REVIEW-262.md | major | CONFIRMED | defer | ~3,000 unverified lines; process | SEED-308 + BUS-304 | Three unplanned commits are tagged (262). The operator must rule on a renumber or a retro-verification. |
| R265-262-03 | 265-REVIEW-262.md | minor | CONFIRMED | defer | new integration test >10 lines | SEED-309 | The missing wiring guard is a new test, not a patch. |
| R265-262-04 | 265-REVIEW-262.md | minor | CONFIRMED | defer | 3 files (card, modal, page) | SEED-309 | An in-flight guard spans three components, so it exceeds the 1-file limit. |
| R265-262-05 | 265-REVIEW-262.md | minor | CONFIRMED | fix | 1 file (`frontend/src/components/experts/catalog/startScopedChat.ts:73`), ≤ 6 lines; no schema/API | Task 2 candidate | Put `refreshThreads()` under the same discard-then-rethrow as the PATCH, so a failed refresh cannot leave an orphan scoped thread that a retry duplicates. RED: a `startScopedChat.test.ts` case with a rejecting `refreshThreads`. |
| R265-262-06 | 265-REVIEW-262.md | minor | CONFIRMED | defer | test redesign | SEED-309 | The test's role half cannot fail. Making it fail needs a non-member role fixture. |
| R265-262-07 | 265-REVIEW-262.md | minor | CONFIRMED | fix | 1 file (`backend/app/api/experts.py` ~:429-436), ≤ 3 lines; no schema, no route/param/shape change | Task 2 candidate | On the non-management arm, force `enabled_only=True` so a member cannot list disabled Experts (PACK-11). RED: a member request with `enabled_only=false` returns a disabled row. The code is 261's, and the builder fixes it. |
| R265-262-08 | 265-REVIEW-262.md | info | CONFIRMED | fix | 1 file (`262-VERIFICATION.md` body), ≤ 6 lines; planning doc | Task 2 candidate | Align the body `Status:` with the frontmatter, and correct the nav-items quote (`GraduationCap` at :111). This is not behavioural. |
| R265-262-09 | 265-REVIEW-262.md | minor | PLAUSIBLE | defer | copy + scope semantics | phase 267 | This is PLAUSIBLE. What "Biased" means on a folderless thread is exactly 267's PACK-25 "say so before it happens". |
| R265-264-01 | 265-REVIEW-264.md | major | CONFIRMED | fix | 1 file (`backend/tests/unit/test_264_born_for_carrier.py:147,160`), ≤ 6 lines; test-only; no schema/API | Task 2 candidate | Assert that each `born_for_bundle_id` keyword's value is not `ast.Constant(None)`. RED: plant `born_for_bundle_id=None` at one build site, and the fence must now fail. |
| R265-264-02 | 265-REVIEW-264.md | major | CONFIRMED | defer | query + dual-encoding fences, 2+ files | SEED-310 | The load path is wider than the resolve path, and the right rule is tied to the R-7 ruling. |
| R265-264-03 | 265-REVIEW-264.md | minor | CONFIRMED | defer | ordering or uniqueness decision | SEED-310 | A same-name tie needs a tie-break rule or a constraint (schema). |
| R265-264-04 | 265-REVIEW-264.md | minor | PLAUSIBLE | defer | needs duplicate rows in a real DB to drive | SEED-310 | This is PLAUSIBLE, and it has the same root as -03. |
| R265-264-05 | 265-REVIEW-264.md | info | CONFIRMED | defer | new behavioural test | SEED-310 | A guard is missing but nothing is live. Add it with the born-for rework. |
| R265-264-06 | 265-REVIEW-264.md | info | CONFIRMED | accept | — | none | The Python side is the stricter one (fail-closed), and every caller passes `str(UUID)`. The docstring overstates identity, but it cannot admit a wrong row. |
| R265-264-07 | 265-REVIEW-264.md | info | CONFIRMED | fix | 1 file (`264-VERIFICATION.md` body), ≤ 6 lines; planning doc | Task 2 candidate | Align the body `Status:` with the frontmatter, and update the VALIDATION reference to `status: driven`. This is not behavioural. |
| R265-audit-fixes-01 | 265-REVIEW-audit-fixes.md | blocker | CONFIRMED | fix | migration 194 (schema). **Exceeds D-04, operator override OV-265-01** | 265-HOTFIX-194.md | DONE: RED `8a01889de`, fix `9890ebd19`. Applied locally, pasted into PRODUCTION by the operator, and verified read-only on prod. |
| R265-audit-fixes-02 | 265-REVIEW-audit-fixes.md | major | CONFIRMED | defer | activation + resolve checks, product semantics | phase 267 + BUS-304 | What a disabled Expert does on threads already using it is 267's PACK-23 transcript-event question. The operator rules on the semantics. |
| R265-audit-fixes-03 | 265-REVIEW-audit-fixes.md | minor | CONFIRMED | defer | new test >10 lines | SEED-309 | The guard is missing for the `rename_thread` org-role fix. |
| R265-audit-fixes-04 | 265-REVIEW-audit-fixes.md | minor | CONFIRMED | defer | org-resolution change across route and service, 2 files | SEED-311 | A cross-org run-now gets a false reason. |
| R265-audit-fixes-05 | 265-REVIEW-audit-fixes.md | minor | CONFIRMED | fix | 2 single-file fixes, each ≤ 1 file / ≤ 5 lines; no schema/API | via UAT-265-258-b + UAT-265-258-c | The five doors are draft PATCH and `/generate` in `workflows.ts`, and schedule create/patch/run-now in `schedules.ts`. They are split into two D-04-sized fixes, one per file (rows below). The template upload was not probed. |
| R265-audit-fixes-06 | 265-REVIEW-audit-fixes.md | minor | CONFIRMED | defer | new test with mocks >10 lines | SEED-309 | The chat-send refusal message has no test. |
| R265-audit-fixes-07 | 265-REVIEW-audit-fixes.md | minor | CONFIRMED | defer | org-resolution change | SEED-311 | A header-less kickoff gets a false upgrade message. |
| R265-audit-fixes-08 | 265-REVIEW-audit-fixes.md | minor | CONFIRMED | accept | — | none | The text fences are tripwires against a naive duplicate. The real guard is the Postgres parity test plus the single conversion home. A fence that caught every respelling would need an evaluator, and that costs more than it protects. |
| R265-audit-fixes-09 | 265-REVIEW-audit-fixes.md | info | CONFIRMED | accept | — | none | The mismatch is in commit-message scope, in history that will not be rewritten. The combined effect of 124dc444b and 856c09ea0 is correct. |
| R265-audit-fixes-10 | 265-REVIEW-audit-fixes.md | info | CONFIRMED | defer | picker + role vocabulary decision | SEED-309 | Adding `super-admin` is a role-vocabulary decision, not a defect in the shipped rows. |
| R265-audit-fixes-11 | 265-REVIEW-audit-fixes.md | info | CONFIRMED | defer | migration (schema) | SEED-306 + BUS-304 | `authenticated` keeps TRUNCATE on `tier_capabilities`. This is schema, the same class as 194. |
| R265-audit-fixes-12 | 265-REVIEW-audit-fixes.md | info | PLAUSIBLE | defer | error-path change | SEED-311 | This is PLAUSIBLE. Drive a DB blip before changing the scheduler's gate call. |
| R265-audit-fixes-13 | 265-REVIEW-audit-fixes.md | info | PLAUSIBLE | defer | fence redesign | SEED-309 | This is PLAUSIBLE. The count floor still catches a removal. |
| UAT-265-257-1-OBS | 265-UAT-LOG.md § 257 row 1 | minor | FAIL (observation) | defer | shared rounding helper across KPI + gauge, >1 site | phase 268 | 50% vs 49% for the same ratio. 268 reworks `/admin/spend`, so give the page one rounding home there. |
| UAT-265-257-2-OBS | 265-UAT-LOG.md § 257 row 2 | minor | FAIL (observation) | fix | 1 file (`frontend/src/lib/api/admin.ts:944`), 1 line; no schema/API | Task 2 candidate | Add `signal: AbortSignal.timeout(10_000)` to the `getSetupStatus` fetch. Its existing `catch` then falls through instead of spinning forever. Scope note: later page fetches against a hung backend may still hang, and those go to SEED-309 if they are observed. |
| UAT-265-257-3 | 257-VERIFICATION.md result / 265-UAT-LOG.md | major | FAIL | defer | driven by -NOCARD | phase 268 | The row fails only through `-NOCARD`. Rated, unrated and no-asterisk all PASS. |
| UAT-265-257-3-NOCARD | 265-UAT-LOG.md § 257 row 3 | major | FAIL | defer | new mount in `MessageItem.tsx` (G-5 hot file) + badge outside RunCard; capability | phase 268 | 25% of chat runs (tool-less) never show cost. A new cost home on tool-less replies is a capability, and 268 is the "spend visible where the person looks" phase. |
| UAT-265-257-3-UNMEASURED | 265-UAT-LOG.md § 257 row 3 | — | BLOCKED (⛔ not observable) | accept | — | none | No data exists: 0 rated no-token runs with a tool-using reply. The same state renders on the ledger (257 row 1 PASS). **Unblocking condition:** the first rated-but-unmeasured chat run with a reply, then re-open this row. |
| UAT-265-258-a | 258-VERIFICATION.md result / 265-UAT-LOG.md | — | PASS (on the aggregate FAIL line) | accept | — | none | PASS. It appears only because the 258 row's aggregate result line is FAIL. |
| UAT-265-258-b | 265-UAT-LOG.md § 258 | minor | FAIL | fix | 1 file (`frontend/src/lib/api/workflows.ts:963` and `:378`), ≤ 4 lines; no schema/API | Task 2 candidate | Wrap both throws in `entitlementRefusalMessage(await res.json().catch(() => null)) ?? <existing text>`, the pattern already at `:281`. RED: the `entitlementRefusal.test.ts` case for `/generate` 403. |
| UAT-265-258-c | 265-UAT-LOG.md § 258 | minor | FAIL | fix | 1 file (`frontend/src/lib/api/schedules.ts` `readScheduleFailure` ~:113), ≤ 4 lines incl. import; no schema/API | Task 2 candidate | Return `entitlementRefusalMessage(body)` first when non-null. This covers schedule create, patch and run-now. RED: the run-now 403 case. |
| UAT-265-258-VIS | 265-UAT-LOG.md § 258 | — | PASS (no door hidden) | accept | — | none | This is a record line saying no `-HIDDEN` rows exist, because every gated door is shown to the standard tier. It was tagged by this plan's second net. |
| UAT-265-261-3-ACCESS | 265-UAT-LOG.md § 261 row 3 | major | FAIL (observation) | defer | API validation + grant-carries-folder-access capability | phase 266 | The Expert and thread accept folders the author cannot read, and a grant carries no folder access. Whether Expert knowledge exists inside the org is 266's goal (PACK-18..20). |
| UAT-265-256-3 | 265-UAT-LOG.md § 256 row 3 | — | BLOCKED → PASS | accept | — | none | The first pass was ⛔ BLOCKED (LangSmith MCP not connected). It was unblocked (`b7f510447`) and re-driven to PASS: 506/250 exact. |
| UAT-265-256-3-OBS | 265-UAT-LOG.md § 256 row 3 | info | FAIL (observation) | defer | trace-name plumbing, site unknown | SEED-307 | LangSmith labels an OpenAI judge call "ChatDeepseek". The metadata carries the true model, so it is audit friction only. |
| UAT-265-263-R7 | 263-UAT.md re-drive / 265-UAT-LOG.md | major | FAIL | defer | visibility rule + studio copy, product semantics | SEED-310 + BUS-304 | A colleague silently loses the author's private member skills. Widen the load, or refuse or warn at save: the operator rules. |
| UAT-265-263-R9-OBS | 263-UAT.md re-drive | minor | FAIL (observation) | defer | runtime capability read | SEED-308 | This is the same class as R265-262-01: DB-registry ids resolve `inferred` with no `emit_tier`. |
| UAT-265-263-R9-deepseek | 263-UAT.md re-drive R-9 board | info | FAIL → PASS on retry | accept | — | none | The first attempt returned an honest `None`, not a fabricated body. The retry was valid (7522 chars), and 8/8 providers emitted. **Re-open trigger:** a second `None` from `deepseek-v4-pro` on this path. |
| UAT-265-D09 | BUG-260923-02 (tagged by the second net) / 265-UAT-LOG.md § D-09 | — | PASS (bug closed) | accept | — | none | The spend-ledger truncation was re-checked live and PASS. BUG-260923-02 reads `status: closed`. |
| UAT-265-CATALOG-SCROLL | operator report during 265 UAT | minor | CONFIRMED | fix | 1 file, done | commit `2acd8d656` | DONE. The Expert catalog page owns its scroll inside the overflow-hidden main. |

## Counts

- **fix: 14.** Two are done: `R265-audit-fixes-01` and `UAT-265-CATALOG-SCROLL`. `R265-audit-fixes-05` is delivered by the `258-b` and `258-c` fixes. That leaves **11 candidate fixes** for Task 2: 255-05, 255-09, 256-07, 262-05, 262-07, 262-08, 264-01, 264-07, 257-2-OBS, 258-b and 258-c.
- **accept: 9**
- **defer: 42.** These route to SEED-305..311 and to phases 266, 267 and 268.
- **Total: 65 rows.** They cover 48 review ids and 17 UAT ids.

## Operator rulings (BUS-304)

1. R265-256-01 and R265-audit-fixes-11: revoke client write on the `workflow_runs` token columns and on `tier_capabilities` now, as a 194-style hotfix, or defer to SEED-306?
2. R265-262-02: renumber the unplanned `(262)`-tagged commits 16b4d41d5, 45adc0e3c and 5e91fc649, or retro-verify them (SEED-308)?
3. R265-audit-fixes-02: what should a DISABLED Expert do on threads already using it? The options are to block runs, drop the scope, or warn. The row is routed to 267.
4. UAT-265-263-R7: should a granted colleague load the author's PRIVATE member skills, or must save refuse or warn (SEED-310)?

## G-7

One fix batch is contemplated: the Task 2 candidates, applied as a single batch. `node scripts/check-gap-closure-rounds.cjs 265` is owed only if a second batch is contemplated.

## Set check

Command: `backend/venv/Scripts/python .planning/phases/265-owed-v4-3-verification/265-triage-check.py` (repo root). Full output (Task 1 run):

```
A (review ids) — 48:
  R265-255-01
  R265-255-02
  R265-255-03
  R265-255-04
  R265-255-05
  R265-255-06
  R265-255-07
  R265-255-08
  R265-255-09
  R265-255-10
  R265-255-11
  R265-256-01
  R265-256-02
  R265-256-03
  R265-256-04
  R265-256-05
  R265-256-06
  R265-256-07
  R265-256-08
  R265-262-01
  R265-262-02
  R265-262-03
  R265-262-04
  R265-262-05
  R265-262-06
  R265-262-07
  R265-262-08
  R265-262-09
  R265-264-01
  R265-264-02
  R265-264-03
  R265-264-04
  R265-264-05
  R265-264-06
  R265-264-07
  R265-audit-fixes-01
  R265-audit-fixes-02
  R265-audit-fixes-03
  R265-audit-fixes-04
  R265-audit-fixes-05
  R265-audit-fixes-06
  R265-audit-fixes-07
  R265-audit-fixes-08
  R265-audit-fixes-09
  R265-audit-fixes-10
  R265-audit-fixes-11
  R265-audit-fixes-12
  R265-audit-fixes-13
B (non-PASS UAT ids) — 16:
  UAT-265-256-3
  UAT-265-256-3-OBS
  UAT-265-257-1-OBS
  UAT-265-257-2-OBS
  UAT-265-257-3
  UAT-265-257-3-NOCARD
  UAT-265-257-3-UNMEASURED
  UAT-265-258-VIS
  UAT-265-258-a
  UAT-265-258-b
  UAT-265-258-c
  UAT-265-261-3-ACCESS
  UAT-265-263-R7
  UAT-265-263-R9-OBS
  UAT-265-263-R9-deepseek
  UAT-265-D09
C (triage ids) — 65
A - C: []
B - C: []
C - (A|B) (extra triage rows, allowed): ['UAT-265-CATALOG-SCROLL']
triage-check OK
```
