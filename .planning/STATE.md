---
gsd_state_version: 1.0
milestone: v4.3
milestone_name: What You Can Actually Sell
status: ready_for_review
last_updated: "2026-09-19T22:45:00.000Z"
last_activity: 2026-09-19 -- Phase 258 execution complete across all 3 plans; gates OK
progress:
  total_phases: 13
  completed_phases: 3
  total_plans: 12
  completed_plans: 12
  percent: 100
---

# Project State

> ⚠ **This file was RESET at the v4.2 close (2026-09-18)** — the fifth reset, same reason each time.
> The previous file had reached **1,022 lines**. **Nothing was deleted:** the full v4.2 file is
> archived verbatim at [`.planning/milestones/v4.2-STATE-at-close.md`](milestones/v4.2-STATE-at-close.md)
> (md5 `6efe33f00c0117c4d484eb67bba4e32c`), including every per-phase position entry, both guardrail
> overrides in full, the Roadmap Evolution log, the Accumulated Context section and the Phase 244
> owed-verification block. Earlier resets: `v3.6` · `v3.8` · `v3.9` · `v4.0-STATE-at-close.md`.
>
> ⚠ **Hand-edit this file. Do NOT call the `state.*` SDK verbs.** Seven occurrences are recorded in
> the v4.0 and v4.2 archives; **the eighth was `milestone.complete` at this very close** — see the
> frontmatter comment. It reported success in JSON while deleting the narrative it claimed to update.

---

## Project Reference

See: `.planning/PROJECT.md` (updated 2026-09-18)

**Core value:** The agent acts as an AI colleague — it knows your knowledge base, can run code, and
can be taught new behaviours (skills) that persist and can be shared.
**Current focus:** Phase 258 (A Tier Becomes Enforceable) -- Execution complete, ready for reviewer inspection.

---

## Current Position

Phase: 258 (a-tier-becomes-enforceable)
Plan: 3 of 3 (execution complete across all 3 plans)
Status: ready_for_review
Last activity: 2026-09-19 -- Phase 258 execution complete across all 3 plans (entitlement_service.py, Migration 186, AST fence RED-driven, workflows.py gated); gates OK

### ⭐ PHASE 258 CONTEXT GATHERED — 2026-09-19
- **Operator Decision #1**: Resolved as Ascending Capability Bundles (`standard` -> `pro` -> `enterprise`), with `organizations.add_ons` for modular overrides (`D-258-01`).
- **TIER-02 Data Storage**: Migration 186 creates `tier_capabilities` table (`D-258-02`, `D-258-07`).
- **TIER-01 Single Home**: Dedicated `backend/app/services/entitlement_service.py` (`D-258-03`).
- **TIER-04 Guard**: AST single-home fence `test_258_single_entitlement_home.py` driven RED against planted check (`D-258-04`).
- **TIER-03 Refusal**: Structured HTTP 403 naming required tier and upgrade hint (`D-258-05`).
- **TIER-05 Fail-Closed**: Strict fail-closed on unreadable tier/DB blips, recorded in contrast to `load_run_budget` (`D-258-06`).
- **Proof Slice**: `POST /workflows` and `POST /workflow-runs` wired with `require_capability('workflows')` (`D-258-09`).
- **Folded Seeds**: `SEED-080` (folded), `SEED-083` (folded).

### ⭐ PHASE 257 CLOSE — 2026-09-19. Read the four verdicts, not the word "closed".

| SC | verdict | evidence |
|---|---|---|
| **#1** every model has an effective-dated rate | ⚠ **PARTIAL** | Effective dating WORKS and is driven (CR-01: one June run read $0.0108 in the ledger and $0.1076 on its own page; now identical, and all 1183 org runs agree SQL↔Python with 0 mismatches). Coverage: the real roster is `MODEL_CAPABILITIES` (61, code) ∪ `model_capabilities_overrides` (51, DB) = **82**. Mig 184 closed the code half; mig 185 prices the 6 first-party DB-only ids. **14 stay unrated BY DECISION** — 7 OpenRouter (a router has no single honest rate), 7 self-hosted (no API fee). |
| **#2** unrated never reads as $0.00 | ✅ **HOLDS** | CR-02 stopped `COALESCE(tokens,0)` pricing 343 unmeasured runs at `$0.0000`. CR-06 made the summary and ledger count the same way (851/332 on both). The gauge's three segments sum to exactly 100 (was 101 on 34 combinations). CR-07: a failed load answers "Unavailable", not zero. |
| **#3** exactly one token→USD conversion | ⛔ **NOT MET** | F-13: the expression is written verbatim **4× in `rates.py`'s SQL plus 1× in Python**, and the METER-02 fence allowlists `rates.py` wholesale so none fire. One-home vs two-plus-a-parity-bridge is an **architecture decision → operator**. |
| **#4** spend per run and per org | ✅ **HOLDS** | Producers wired on `workflow_runs.py` and `threads.py` in three-place lockstep (declared, selected, populated), snake→camel mapped, mounts reachable. Driven end-to-end. |

**Gates at close:** backend `71 failed / 5100 passed` (ceiling 71, zero headroom) ·
vitest `8464 · failed 0 · pinned 7723 · 293/293` · `tsc -p tsconfig.app.json` 65 = base.

⛔ **OWED TO THE OPERATOR, blocking nothing else:**
- **Apply migration 185** by pasting it into the Supabase SQL editor (never `db push`), then
  `bash scripts/regenerate-full-schema.sh`. Verified idempotent in a rolled-back transaction
  (53 → 59 → 59 rows); the live DB is unchanged.
- **SC#3 / F-13** — the conversion-site architecture decision.
- **SEED-302** — void and end-date a rate from the product. ⚠ It also records a bug that
  exists today: `rates.py:267` emits `effective_to: None` as a hardcoded literal with no
  column behind it.
- **The third roster.** Nothing checks **runs → rate**, only roster → rate. Two models appear
  in real runs and in neither roster (`deepseek-v4-pro-qwen3.5-9b-mtp`,
  `DeepSeek-V4-Flash-Vision-Exp`). Same class as the `claude-haiku-4-5` alias mismatch.

⚠ **Process note, recorded because it is the phase's most reusable finding.** The operator
directed direct fixes twice rather than handbacks, which silently converted the REVIEWER into
the BUILDER. An independent pass then found **14 of 17 findings were against claude's own
fixes**, not gemini's build. The separation was restored on BUS-278/279, and gemini's review
of claude's CR-06 fix immediately found a real defect (the 101% gauge). **Reciprocal review
paid for itself the first time it was actually run.**

### ⭐ PHASE 257 CLOSE — 2026-09-19, 4/4 SC
- **METER-01**: Migration 183 implemented `model_rates` table with effective-dated append-only pricing, compound index `idx_model_rates_lookup`, and org RLS. Unrated models strictly display as `▲ Unrated` with hover tooltip naming the model, never `$0.00`.
- **METER-02**: Exactly one token→USD conversion function in one home (`backend/app/services/pricing_service.py` -> `compute_token_cost_usd`), returning `CostResult(cost_usd, is_rated)`. AST single-home fence `test_257_single_token_conversion_home.py` verifies no other AST file contains token-to-USD conversion functions. Python-SQL parity verified across 25 permutations in `test_257_rates_db.py`.
- **METER-07**: Operator spend cockpit mounted at `/admin/spend` (`AdminSpendPage.tsx`), featuring pure SVG 14-day attributable spend chart with unrated volume overlay, model share donut ring, "What This View Cannot See" honesty disclosure card (`BlindSpotsCard.tsx`), and append-only reprice modal (`RepriceModal.tsx`). Run-level affordances mounted in `WorkflowRunPage.tsx` and `RunCard.tsx` via `RunCostBadge.tsx`.
- **G-4 Lived-Experience UAT**: Automated in `backend/tests/uat_257_scenarios.py` and passed 3/3 against live local Supabase Postgres on port 54322:
  1. *The Free Lie*: Unrated run with `qwen-2.5-72b` has `cost_usd=None` (never `$0.00`) and is excluded from org spend totals with honesty footnote.
  2. *Historical Rewrite*: Fast-forward repricing at T1 preserves T0 run cost immutable at `$0.7500`.
  3. *Blind Spot Amnesia*: Incomplete token coverage (`['agent', 'single']`) is counted in `incomplete_coverage_count` and surfaced under partial coverage filters.

### ⭐ PHASE 256 CLOSE — 2026-09-19, 4/4 SC (was 2/4)

**What round 1 closed, both re-verified against SOURCE by a different instrument than the review used.**
SC#1 / METER-03: `harness_engine._flush_run_usage()` is the ONE home of the durable write, called by
`_enforce_budget` **and** once unconditionally at `:2320` — statement-level in the `while` body, after
the phase `Try` (`:2108-2282`) and **above every outcome arm** (`pause_run` `:2369`, `fail_run` `:2386`,
`skip_to` `:2414`). The verifier AST-walked `run_workflow` rather than reading the comment that claims
the placement, and enumerated every `Return`/`Continue`/`Break` in the loop body: only two precede the
flush and both sit at the loop TOP, above `_enforce_budget("phase_boundary")`. ⭐ **Falsifiable, which
is the point:** delete `:2320` and the pause arm returns at `:2383`, **297 lines above** the only other
persist. SC#4 / METER-06 per **D-256-18 Option A**: both in-run judge shots COUNTED —
`validator_kinds.py:629` above its failure arm at `:631`, `publish_service.py:458` onto `golden_run_id`
above `_safe_audit` and above the `_block` return, so a **blocked** publish records its money. The
4-leg marker became TRUE rather than lowered. ⛔ **NO MIGRATION** — mig 182's `COMMENT ON COLUMN`
delegates the legs to `TOKEN_COVERAGE_LEGS` verbatim (`full-schema.sql:2783`), so growing what
`"emit"` covers cannot falsify it.

⭐ **THE ROUND'S REAL FINDING IS A RED DRIVE, NOT A FEATURE — and it is this phase's own currency.**
Review finding WR-01: CR-02's publish half was guarded by **TEXT fences only** (`grep publish_workflow`
in the new module returned NOTHING). Dropping the `usage_box=` kwarg at `publish_service.py:431` would
have silently un-shipped the judge counting. Driven: under that plant, **22 tests stayed green —
INCLUDING BOTH TEXT FENCES — and only the two new behavioural cases fired.** *Presence assertions
cannot see content drift*, paid for again. Closed test-only at `c908161f4`; `persist_run_usage` left
REAL with an `AsyncMock` pool as recorder, so what is pinned is the statement the DB would receive,
arguments and all.

⭐ **UAT ROW 1 IS CLOSED LIVE — PASS, 2026-09-19, on a genuinely paused run.** Workflow *Knowledge Base
Library Structure Summary* (`4ddadece`) driven through the real app; it completed two phases and PAUSED on
its stage-3 external-action human gate, the UI reading *"NEEDS YOU — No deadline — the run is waiting for
your answer and will not continue on its own"*. **That is exactly the arm CR-01 found unreachable.** Run
`a77ed2c0-0b0f-42db-86a3-51e12513e394` reads **`input_tokens=135142` · `output_tokens=10317` ·
`token_coverage=[agent, single, batch, emit]`**. ⭐ **Before this phase that row would have read
`NULL/NULL/NULL` PERMANENTLY** — the pause arm returns at `:2383`, **297 lines above** the only other
persist — and the pre-run baseline makes it unambiguous: **0 of 283** existing rows carried
`input_tokens` or `token_coverage`, newest `09-12`.

⚠ **THE PROCESS-BOUNDARY HALF WAS PROVEN BY A STRONGER METHOD THAN THE ROW ASKED FOR, AND THE
SUBSTITUTION IS STATED RATHER THAN HIDDEN** (operator decision, 2026-09-19). The value was read by a
**separate OS process** making a direct `asyncpg` connection to Postgres on 54322 — bypassing uvicorn's
memory **and** the app's API layer. A restart-then-read-via-API could have been served from a cache; this
could not. ⛔ **The literal `kill uvicorn` was OFFERED AND DECLINED** as low marginal information; the
backend was **NOT** restarted by that session, and nobody should later read this as proving process death.

⭐ **AND THE PART NO TEST COULD REACH WAS PROVEN SEPARATELY, against the real local Postgres.** The REAL
`persist_run_usage` called three times on a scratch row — `(1200,340)`, `(55,7)`, `(0,0)` — read back on a
**brand-new connection** as `1255 / 347 / [agent, single, batch, emit]`. So the **ADD** semantics hold
across calls, the falsy third call was correctly a **NO-OP** rather than a `0` write (D-256-06), and the
**Python-list-to-`text[]` binding that had never run live WORKS**. Scratch row deleted, 283 → 283, CLEAN.

⚠ **ONE UAT ROW REMAINS OWED, and closing the phase with it owed is a stated DECISION.** One publish
gauntlet to the QUAL-01 judge against a **real provider** (no `forced_emit` patch), comparing the
provider's reported usage to the persisted delta. Every judge case patches `forced_emit`, so **the wiring
is proven and the number's FIDELITY is not** — and CLAUDE.md's cross-provider rule says conventions do not
transfer 1:1 between providers.

⚠ **A REAL PAUSED RUN IS LIVE IN THE OPERATOR'S LOCAL DB** — `a77ed2c0` sits at its email-approval gate
with **no deadline**, left deliberately unanswered as the evidence for this row. Answering or killing it
is the operator's call; it is not orphaned state to sweep.

⚠ **FOUR REVIEW FINDINGS DEFERRED TO PHASE 257 UNDER G-7 — not fixed, not waived.** All four live in
code written this round, and a round 2 of pure round-1 cleanup is the runaway G-7 exists to stop.
Phase 257 is the phase that READS the `token_coverage` marker, so it is the one with the motive to make
these fences load-bearing. **WR-02** the `forced_emit` disposition fence is FILE-scoped while its
docstring claims SITE scope, so a second uncounted site in an already-listed file passes green.
**WR-03** `_SHELL_FUNCTIONS` is hardcoded — a NEW shell in those three files gets zero coverage with no
signal, and `assert shells` fires only when EVERY named shell in a file vanishes (coverage fell to
34% / 13% / 26% of file lines). **WR-04** the judge validator's tokens now bind `max_tokens_per_run` —
a shipped safety control tightened, named in no register and pinned by no test. **IN-01** a one-sided
delta writes NULL→0 (*"measured as zero"*, contra D-256-06) while `persist_run_usage`'s own docstring
claims it never does. ⛔ These are not the builder's to waive; if gemini judges any blocking, it goes to
the operator.

⚠ **A HOLE THAT WAS HUNTED AND MEASURED FALSE, recorded so nobody re-opens it from the docstring.**
`phase_types._run_usage_box`'s docstring says a publish golden run reaches its executors with a ctx that
has **no box** — if true, the validator judge shot during a golden run would be dropped while the row
still carried a 4-leg marker, i.e. **CR-02 reopened**. Measured: `_drive_golden_run` drives
`run_workflow` (`publish_service.py:1681`) and `run_workflow` sets `ctx.run_usage_box = {}`
**unconditionally** (`harness_engine.py:1884`). ⭐ **The docstring is STALE; the behaviour is correct.**

⚠ **ONE SHIPPED FENCE WAS NARROWED, and it is the judgement gemini is asked to ratify or overturn.**
`test_256_producer_shells.py::test_no_shell_started_writing_the_workflow_grain` went FILE scope → AST
SHELL-FUNCTION scope, because `publish_service.py` hosts BOTH a segment shell (`_drive_golden_run`) and
the `workflow_runs`-grain owner (the QUAL-01 stage holding `golden_run_id`) — so the file-scoped form
**forbade the write D-256-18 mandates**. The builder-run review RATIFIED it, having enumerated every
`insert_run` / `finalize_run` / `create_workflow_run` caller in all three subject files and confirmed
`_wake` (`api/runs.py:656-707`) and `_harness_continuation` (`:1295-1379`) — both METER-05 finalize
sites — are nested inside the two named shells and fully covered. ⛔ **That review does not discharge
the call**: it was run by the builder (AGENTS.md §6.3).

**Gates on the merged tree, re-run by the orchestrator rather than inherited.** Backend unit
**71 failed / 5064 passed / 2 xfailed / 2 xpassed / 0 collection errors**, failing **SET** `diff` exit 0
against the committed baseline in both directions (5064 = the locked 5062 + WR-01's two cases; ⛔ the
ceiling is the **failed** count, 71, and a growing passed count is the suite working).
`test_200_human_gate_pause.py` **1 failed / 16 passed** — the one red proven **INHERITED by measurement,
not by comparison to a number**: `_AUDIT_EVENT_TYPES` measures **26** at HEAD, **26** at the round-1 base
`a9cc2fbc4` and **26** at `9cba267e8`, having grown at `16cba8e05` in **Phase 185**. ⚠ `BUS-272` told
gemini it read 25; **that was wrong and `BUS-273` corrects it.** Both pause-arm source-slicing fences
PASS. `check-hot-file-ledger` OK (`watched: 10`, non-vacuous) · `check-claude-md-size` OK (108,342
chars, 72.2%) · `check-seeds-register` OK (308/308) · `check-gap-closure-rounds 256` **G-7 clear, 1
round of 2** · `check-deploy-drift` PASS · **zero `supabase/` changes**, so no migration and no cloud
parity owed · frontend untouched, so the vitest count gate is correctly N/A.

⚠ **A `backend/tests/` SWEEP STALLED AND WAS KILLED, recorded rather than quietly dropped.**
`pytest tests/ --ignore=tests/unit --ignore=tests/integration` sat at **5% for 25 minutes** with no
output growth — something there waits on an external resource. The required fence file runs alone in
**0.54s**. ⛔ Do not read the broad sweep's silence as a pass; run the named file.

### PRIOR CONTEXT — round 1 planning (2026-09-19)

### ⭐ GAP-CLOSURE ROUND 1 — planned 2026-09-19, and the REVIEWER agreed the gaps were real

Verification closed at **2/4 SC** (`gaps_found`). ⭐ **Gemini answered `BUS-271` with `VERDICT: REVISE`
and re-measured BOTH gaps independently at `a0bfb43f6`** — same three unwired returns, same
unconditional 4-leg stamp, and it named the `idx_workflow_runs_org_coverage_incomplete` consequence
on its own. It agreed SC#2 / SC#3 are verified and left ROUTING to the operator, who ruled
`D-256-17` / `D-256-18` (commit `146596399`). ⛔ **This is the independent review 256 owed** — the
builder's own 2/4 was NOT the evidence.

**ONE plan, `256-05` (G-8): `gap_closure_round: 1` of the 2 G-7 allows · `autonomous: true` · 3 tasks.**
G-7 clear · ledger gate `watched: 10` (non-vacuous) · seeds 308/308 · plan-checker **PASSED** having
re-measured every claim against source rather than reading the plan's prose.

**Three shapes decided, each with its reason in source:**
1. **ONE flush site, not three, and NOT `try/finally`.** `_flush_run_usage()` keeps the persist at one
   home; the extra call sits at `:2246` — above the outcome dispatch, so all four arms *and any fifth
   arm nobody has written* flow through it. ⛔ `try/finally` REJECTED: a `finally` also runs on
   `asyncio.CancelledError` and would change which exception leaves the engine on a user Stop.
2. ⭐ **NO NEW MIGRATION, measured not assumed.** Mig 182's `COMMENT ON COLUMN` delegates the legs to
   `db.workflows.TOKEN_COVERAGE_LEGS` **verbatim** (1 hit in the migration, 1 in `full-schema.sql`), so
   counting the judge spend makes the comment TRUE. ⛔ The tuple stays FOUR — a 5th `"judge"` leg is
   the REJECTED Option B by another name.
3. **The two judge sites are NOT symmetric.** `validator_kinds.py:592` has a live `ctx`;
   `publish_service.py:1779` has none — `_drive_golden_run`'s `finally` closed and finalized the box
   before the judge shot runs — so it takes a caller-supplied `usage_box` persisted at `:424` against
   `golden_run_id`, above the `_block` return, covering all **3** billed shots.

⚠ **Two line-number drifts found, recorded not fixed silently:** `256-VERIFICATION.md` says
`run_reconciler.py:236`, measured **`:245`** (CONTEXT was right); gemini cited the box reset at
`:1884` where the source comment reads `:1844`. ⚠ **A fence the brief missed:**
`backend/tests/test_200_human_gate_pause.py:302` slices the pause arm's source — and lives under
`backend/tests/`, **invisible to the `pytest tests/unit` baseline**, so 256-05 runs it explicitly.
⚠ **Three ledger rows re-derived STALE:** `harness_engine.py` **57/21/3215** · `phase_types.py`
**54/27/2954** (untouched — observation only) · `db/workflows.py` **50/26/2677**.
(2 non-blocking warnings). Requirements 4/4 (METER-03 → 01 · METER-04 → 01,02 · METER-05 → 01,03 ·
METER-06 → 02,04); all 16 `D-256-NN` cited literally (verified by my own grep — see the gate warning
below). RESEARCH.md + PATTERNS.md written. ⛔ `256-01` is **`autonomous: false`**: execution PAUSES
for the operator to paste `182_workflow_runs_token_totals.sql` into the local Supabase SQL editor,
and it is the phase's ONLY DB mutator — never run it beside another.

⛔ **FOUR MEASURED CORRECTIONS TO THE LOCKED DECISIONS. Each is recorded beside its original, never
over it, because being wrong in a register is the finding.**

1. ⛔ **D-256-04's WRITE POINT IS UNREACHABLE AS SPECIFIED, and this is the correction that changes
   the build.** `harness_engine.py:1873` is `if not breaker.armed: return`, sitting **ABOVE** the
   `:1875` absorb point the decision chose; `circuit_breaker.py:129` defines `armed` as *"is either
   ceiling configured?"*, so an **interactive** harness run is disarmed and returns early. As
   written, **METER-03 / SC#1 would have persisted NOTHING for nearly every harness run.** Verified
   independently in source by the orchestrator, not inherited: `check_limits` guards both arms on
   `is not None`, so a disarmed breaker returns `(False, None)` unconditionally and the reorder is
   **provably behaviour-preserving**. It ships in the SAME plan as the writer (`256-01`, O-2), and
   the headline test drives a **DISARMED** run — a scheduled-run-only fixture would pass over the
   defect, which is this project's recorded *"green fence beside the shipped defect"* shape.

2. ⭐ **Q3's LANDMINE DOES NOT EXIST — and that makes a fence weaker, not the phase easier.**
   Measured over seven search strategies: **nothing in the backend aggregates `runs.input_tokens` /
   `output_tokens` at all**, in SQL or Python. So filling the five producer shells cannot double-count
   anything and **imposes no plan ordering** (O-1). ⛔ But D-256-02's narrowing fence therefore has an
   **EMPTY SUBJECT SET** and is green from birth, so its vacuity control is **mandatory, not
   advisable**: authored in wave 1, RED-driven entirely against a planted violation, plant removal
   proven by md5 — ⛔ never by timing (Phase 255's planted `eval()` sat live).

3. ⛔ **D-256-05's "7 call sites across 4 files" is WRONG, and RESEARCH.md repeated it.** Re-derived:
   `grep -rn "await finish_run(" backend/app/` → **5 call sites across 3 files**
   (`api/workflows.py:1802`, `harness_engine.py:2257`/`:2298`/`:2580`, `run_lifecycle.py:521`). The
   decision it supports — leave `finish_run` **byte-unchanged** — is unaffected; the fence now asserts
   the **re-derived SET** rather than an inherited count.

4. ⛔ **D-256-13 is wrong in two directions, measured by RUNNING the gate rather than reading the
   table.** `node scripts/check-hot-file-ledger.cjs 256` → **exit 1**, `watched: 9` (non-vacuous),
   exactly TWO `[no-row]`: `circuit_breaker.py` (1/1/331, owed by `256-01`) and `forced_emit.py`
   (8/5/578, **FIRES**, owed by `256-04` per O-6). ⚠ **`scheduler_service.py` ALREADY HAS a row** —
   D-256-13 says it needs one added. ⚠ And a **FOURTH** firing no-row file exists that no register
   names: **`task_service.py` at 19/10/958** — invisible to its own guardrail at ten phases, the
   `config.py` failure repeating.

⚠ **A FIFTH FINDING, ABOUT THIS WORKFLOW'S OWN GATE — IT PASSED VACUOUSLY.**
`gsd-sdk query check.decision-coverage-plan` returned `passed: true · skipped: true · total: 0 ·
"No trackable decisions in CONTEXT.md."` over a CONTEXT.md carrying **sixteen** of them. The gate
matches a literal `D-NN` id; **this project's convention is `D-256-NN`, which it cannot see.** So
step 13a proved nothing, and the coverage claim above rests on a hand-run grep (16/16 cited, 0
missing) — never on that green. ⛔ Do not quote this gate as evidence on any phase.

⚠ **THREE `NO IN-REPO ANALOG` GAPS — answered with a stated property, never assumed away.**
(a) **Nothing in this repo proves a DB value survives a PROCESS RESTART** — which is SC#1 verbatim.
`256-01` T4 builds the combination that does not exist (`test_239`'s real `subprocess.Popen` child,
but with the child's pool **REAL**, not the stub `test_239` itself discloses), and must state in both
the module docstring and the SUMMARY what it does **not** prove (a `kill -9` mid-phase) — plus that
`tests/integration/` is invisible to the 71-name baseline and cannot be the only proof.
(b) **No precedent for an array op in an index predicate** — `[ASSUMED]` became paste-and-verify with
a named weaker fallback. (c) **No precedent for a three-state `text[]`**; the schema's only array
column is the exact two-state collapse D-256-07 must avoid, so all three states are pinned by test.

⚠ **A stale SOURCE comment that METER-06 makes FALSE, which no register named:**
`harness_engine.py:1837-1842` reads *"`llm_emit` PHASES ARE NOT COUNTED, AND THAT IS NAMED RATHER
THAN HIDDEN … a different file and a different plan."* **This is that plan.** `256-04` corrects it in
the same commit as the drain arms; `256-01` is explicitly forbidden from touching it and asserts the
string survives to wave 2.

✅ **The seeds sweep's discuss-time `0 matched` is CONFIRMED AN ARTEFACT** (the gate said so itself).
Re-run with plans on disk: **`10 matched`** over 303/303 parsed, 0 duplicate ids, gate OK. Only two
are genuine overlaps (`SEED-266` full-schema ACLs, `SEED-291` the Extension Contract) — both LEAVE,
neither folded. ⛔ **Routing must be written back into each seed's own frontmatter**, not only into
`256-02`'s table: `status:` IS the index, and body prose is invisible to the scan.
Unswept, ⛔ never summed: **134** carry no `trigger_when` · **114** carry prose a sweep cannot match.

**Five discretionary decisions taken so Phase 257 cannot guess:** coverage marker is `text[]` written
from ONE `TOKEN_COVERAGE_LEGS` in `db/workflows.py` · ⭐ a run where no leg reported usage reads
`input_tokens IS NULL · output_tokens IS NULL · token_coverage IS NULL`, and **257 must read that
triple as "no instrumented leg reported usage" — never `$0.00`, never "unrated"** · Fence 1 is a real
`ast.parse` conjunction fence (SQL is assembled across concatenated literals here, so a line matcher
cannot see `SUM(` and a missing `WHERE` four lines apart) · **R-1 → REGISTER, not fix** · the eval
**WITHOUT arm IS counted** (billed for both) and the **judge shot is NOT** — decided, not forgotten.

✅ **D-256-14 DISCHARGED (05122eb45)** — both baselines captured as SETS, not counts.
Backend: 71 names at `256-BASELINE-backend-failing-set.txt` (= the zero-headroom ceiling).
Frontend: `256-BASELINE-frontend.md`. ⚠ **THE FRONTEND GATE IS NON-DETERMINISTIC AT BASE** —
two runs on a byte-identical tree, cap 2 on both, read `failed 3 · VIOLATED` and `failed 0 · OK`;
every other count agreed exactly (8414 / 7674 / 289). ⛔ Do NOT quote `failed 0` as "green at base",
and ⛔ do NOT reach for the worker cap on a red run. Run A's set, recovered from the gate's own
persisted JSON: `WorkflowBuilderPage.canvas.test.tsx` (a SEED-171 suite) + `sketchComposition.test.tsx`
×2 — ⚠ a **SIXTH** flaky suite, failing its OWN positive controls (the mount died, `196-05` signature).
⚠ Count-gate figures rotted a 7th time: CLAUDE.md's 2026-09-07 row reads `7816 / 7020 / 241/241`.

⛔ **BUS-264 — claude BUILDS 256, gemini REVIEWS.** No source work until gemini confirms its own
baselines are captured (AGENTS.md 6.1). Docs/plan work is safe meanwhile.

---

## 🚧 v4.3 STARTED — 2026-09-18 · *What You Can Actually Sell*

**Goal:** turn a product that works into a product that can be packaged, priced and shipped to a
client — **without touching the trust boundary**.

**Four features, in this order, and the order is load-bearing:**

1. **The extension contract** (`SEED-291`) — *a plugin is DATA, an EXTERNAL PROCESS, or SANDBOXED
   CODE, never engine code.* Written FIRST and cheaply, as binding law **plus a mechanical guard**.
   ⭐ **This is the milestone's first DECISION, not one of its requirements.** All three mechanisms
   already ship (skills/definitions/templates · `mcp_client` · `sandbox_service`); what is missing is
   the written rule, so the first plausible exception wins an argument it should lose.

2. **Cost is attributable** (`SEED-073` + `SEED-074`).
3. **A tier is enforceable** (`SEED-080` + `SEED-083`).
4. **A pack is a thing** (`SEED-198` Experts — the SKU).

### ⭐ The scope was MEASURED before it was written, and one claim was corrected mid-measurement

| Piece | State at milestone start (2026-09-18) |
|---|---|
| Chat token capture | ✅ counted and persisted to `runs.input_tokens` / `output_tokens` |
| Harness token capture | ⚠ **in-memory only** — `CircuitBreaker` (`harness_engine.py:1818`) trips a live ceiling, but nothing is persisted |
| `workflow_runs` token columns | ⛔ **zero** — migration 057 has none and no later `ALTER` adds any |
| `llm_emit` / `forced_emit` phases | ⛔ **uncounted**, already named at `harness_engine.py:1833` |
| Token → USD | ⛔ **nothing** — 0 files match `cost_usd`, `token_to_usd`, `spend_ledger`, `spend_cap` |
| Tier columns | ✅ `organizations.subscription_tier` + `add_ons jsonb` since **migration 104** |
| Entitlement check | ⛔ **none** — those columns have sat unread for a milestone |

⚠ **`max_tokens_per_run` was about to be recorded as a cap that cannot bind. It CAN.**
`harness_engine.py:1818` wires a real token source into the breaker, and the code's own comment says
so. **The gap is PERSISTENCE and USD, not counting.** ⛔ The lesson is the one this project keeps
paying for: *measure the claim against the tree before it gates a scope.*

### ⛔ Carried OPEN as an operator decision — deliberately NOT resolved here

**`PRDs/SEQUENCE.md`'s next unbuilt slot is Open Platform** (REST API + MCP + service accounts,
`SEED-013`). It is the **external-process arm of `SEED-291`'s own contract**, so it sequences
*inside or immediately after* this milestone rather than against it — **but it is not in scope
unless the operator puts it there.** Surfaced at intake; not resolved silently.

### ⛔ Two operator blockers gate every commercial route, and neither is engineering

Per `SEED-294`: **(1) no legal entity exists** — no accelerator, sponsor or client contract is
reachable without one; **(2) the employment / IP position is unsettled** — ownership, permission to
commercialise and customer overlap need **written** certainty from a lawyer before anyone is
approached. ⚠ **Neither blocks a single requirement in this milestone; both block approaching
anyone**, and they get harder to unwind as the work compounds.

### Declined at intake, triggers intact

- **`SEED-292` assurance export** — ~106 KB of eval machinery and no artifact a buyer can file.
  Offered at intake and declined for this milestone. Small build, strongest procurement asset.

- **`SEED-293` competitive re-crawl** — the record is 40 days stale and **missed Airia**, which
  markets our exact claim. ⛔ **Nothing in this milestone may write "nobody else does this"** until
  it is re-run.

### Seeds register at intake

`node scripts/check-seeds-register.cjs` → **gate OK**, `301/301 parsed`, `0 duplicate ids`,
301/301 carry all 5 required keys. ⛔ **The two unswept figures, reported separately and never
summed:** **134 carry no `trigger_when` at all** · **114 carry prose the sweep cannot match.**

## ✅ v4.2 CLOSED — 2026-09-18, git tag `v4.2`

**8 phases** (247-254) · **31 plans** · **237 commits** · **559 files** (+79,321 / −4,197) ·
**migration 181** · 2026-09-13 → 2026-09-18.
**25 / 26 requirements satisfied** · integration **19/19** · flows **3/3**.
Audit: [`milestones/v4.2-MILESTONE-AUDIT.md`](milestones/v4.2-MILESTONE-AUDIT.md) — the superseded
2026-09-16 reading is preserved beside it, byte-identical, at `v4.2-MILESTONE-AUDIT-260916.md`.

⚠⚠ **THE MILESTONE'S FINDING, and the reason it needed eight phases for five phases of scope:**
247-251 all closed with **passing** verifications, every gate green, the backend at its locked
baseline — and one cross-phase read then found **four blockers and nine warnings**, every one a
**seam between two individually-correct things**. 252 closed them; 253 closed 252's own review;
254 was the review phase. ⭐ **The pattern repeated at every depth** — 253's gap-closure round was
itself reviewed and produced two more blockers, both the same vacuity class that phase existed to kill.

⭐ **The close re-audited rather than trusting its own audit.** The on-disk verdict read `gaps_found`
over a tree 124 commits and three phases old. Re-driving it moved four blockers to zero. **An audit
is a claim about a tree, and it goes stale the moment the tree moves.**

---

## ⛔ Carried past the close — decisions, not oversights

### `DEBT-06` — the one unsatisfied requirement

**8 of 14 rows unmet:** `239` `owed` · `241` key ABSENT · `242` bare `False` (in no register's
vocabulary) · `244` frontmatter **UNPARSEABLE YAML** · `245` **no verification file anywhere** ·
`251` · `252` · `253` `owed`.
**6 accounted:** `238` `complete` · `240` `complete` · `243` `refused` · `246` `done` · `249`
`refused` · `250` `refused`.
⛔ Re-derived with `yaml.safe_load` over each `*-VERIFICATION.md`, **never from a hand-typed list**.
⛔ **Never sum the two figures.**

**No plan can close it.** `done` needs Gemini answering `BUS-249` / `BUS-256` / `BUS-257` — which
cannot be driven from a Claude session. `refused` needs an **operator ruling**: `REG-03` forbids
Claude answering or closing a bus item, and `AGENTS.md` §6.3 forbids a builder ruling on its own work.
Three refusal drafts are written and pending at `25{1,2,3}-REVIEW-REFUSAL.md`; the deadline in the
bus items is **2026-09-24**.
⛔ **A refusal is not a pass.** `verification_mode` stays `self-verified` and the accepted risk is
that a builder read its own work — six closes running.
**Re-open trigger:** Gemini answering any of the three bus items, at any time, before or after the
deadline. The verdict artifact is then `<phase>-REVIEW-IND.md` and the draft is void.

### Four register repairs, each one line (`F-1`..`F-4` in the audit)

- **`F-1`** — `254-VERIFICATION.md`'s **own** frontmatter is unparseable YAML (a bare `: ` inside the
  unquoted `score:` value). ⭐ **That is the exact defect Phase 254 reported against Phase 244, in the
  same week, and no gate caught either.** Fix is one pair of quotes.

- **`F-2`** — `.planning/reported-bugs/` carries **two live duplicate-id clusters**: `BUG-260528-01`
  is the `id:` of **three** files, `BUG-260906-01` of **two**. `check-seeds-register.cjs` sweeps
  `.planning/seeds/` only; **no gate sweeps reported-bugs at all.** This is `REG-01`'s defect class
  one register over.

- **`F-3`** — `BUG-260915-01` reads `verified_closed_by: null` while its fix is live in
  `TodosSection.tsx`. Fix and register out of sync by one field.

- **`F-4`** — `253-VERIFICATION.md` still reads `status: gaps_found` over a gap that **is** closed
  (`SEED-290` exists with a re-open trigger per finding).

### Undriven, not passing

- ~~**Migration 181 is NOT in cloud.**~~ ✅ **DISCHARGED 2026-09-18 at the v4.2 production push** —
  the original is struck through rather than deleted. Applied by the operator and **verified by a
  live read, not by a status field**: all 15 SECURITY DEFINER functions `anon=false`, the 7 RLS
  helpers/RPCs keeping `authenticated` exactly as the migration's Group design intends. Advisor
  `anon_security_definer_function_executable` **13 → 0**, `authenticated_…` 13 → 7 (by design),
  **0 ERROR**. `CRED-04` discharged.
  ⚠ **AND ITS "ONE OPERATION" RULE WAS MEASURED NOT TO BIND, which is why the SQL shipped first.**
  The rule read *"its code half and its SQL half must reach cloud in ONE operation."* Measured before
  acting: 181 **grants back** `authenticated` + `service_role` on everything that needs it, the 6
  trigger functions are privilege-checked at `CREATE TRIGGER` time not execution time, and the
  frontend makes **zero direct `.rpc()` calls** — every DB hit goes through the backend. **There is no
  code half.** The phrasing was inherited from the mig-118 precedent, where it was true.
  ⛔ The lesson is not *"the rule was wrong"* — it is that a security-bearing claim is worth
  **re-measuring against the tree** before it gates a push, exactly like an audit.

- `MODEL-04` end-to-end in chat — needs a live self-hosted endpoint.
- Phase 248's **G-4 scenario S2** (live `McpAuthDoor` BYO-OAuth) — needs a browser and a third-party
  account. It is **B-3's own scenario**.

- The `schema-acl-parity` CI job has never executed against this code.

### Two live criticals, triaged and unfixed (`251-REVIEW.md`)

- **CR-01** — the seeds gate's `--self-test` passes **8/8** and **none of the eight arms** exercises
  the missing-key check its main verdict line asserts. *A guard with no RED arm for itself.*

- **CR-02** — the `status:` enum's *change-all-three-or-none* rule has **zero executable enforcement**.

---

## Guardrail overrides

⚠ **Both v4.2 overrides are preserved in full at
[`.planning/milestones/v4.2-STATE-at-close.md`](milestones/v4.2-STATE-at-close.md) →
*Guardrail overrides*.** The two **indexed markers** are carried forward verbatim below, because a
gate reads them from this file by regex and ⛔ **an absent marker reads as an absent decision.**

OV-248-01-status: live   # flip to `retired-<YYYY-MM-DD>` when 248 closes or an independent reviewer takes it. ⛔ do not delete it — an absent marker reads as an absent decision.

⚠ **`OV-248-01` IS CONTRADICTED BY ITS OWN PHASE'S VERDICT, AND THE MARKER IS LEFT `live` RATHER
THAN FLIPPED BY ME.** The override records the operator instruction *"you will handle next phase end
to end yourself"*, and states that 248 would therefore close `self-verified`. **Measured 2026-09-18:
`248-VERIFICATION.md` reads `verification_mode: peer-reviewed` (builder gemini / reviewer claude)** —
so the override's own re-open trigger (*"if an independent reviewer becomes available before 248
closes, this override lapses and the review is taken"*) appears to have **fired and been honoured**.
⛔ Flipping a governance marker on my own reading is the thing this project's registers exist to
prevent. **Operator decision:** retire it (`retired-2026-09-18`) or record why it stays live.

OV-SOLO-01-status: retired-2026-09-13   # RE-ARMED — Gemini returned 2026-09-13, the trigger's first arm. Flip back to `live` ONLY with a dated entry naming why. ⛔ do not delete it — an absent marker reads as an absent decision.

---

## Deferred Items

Items acknowledged and deferred at the v4.2 milestone close on **2026-09-18**, per the pre-close open
artifact audit (`gsd-sdk query audit-open`). ⚠ **28 of the 29 quick tasks read `missing`** — the
directory exists with no status file, so these are stale shells from as far back as 2026-03, not live
work. They are listed rather than summarised because a count is not a set.

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
| todo | spike-nl-workflow-authoring.md | — |
| seed | 003-deployment-flexibility-install-ux | dormant |
| seed | 004-org-multi-tenancy | dormant |
| seed | 041-conversation-compaction | dormant |
| seed | 043-sandbox-package-management | dormant |
| seed | 046-library-health-dashboard-enrichment | dormant |
| seed | 127-reasoning-first-forced-emission-gap | dormant |
| uat_gap | 248-G4-UAT.md | unknown |
| uat_gap | 249-UAT.md | unknown |
| uat_gap | 250-UAT.md | unknown |
| uat_gap | 254-HUMAN-UAT.md | passed |
| verification_gap | 253-VERIFICATION.md | gaps_found |

**Total: 41**

---

## Roadmap Evolution

- **2026-09-16** — `.planning/v4.2-MILESTONE-AUDIT.md` closed `gaps_found` (4 blockers, 9 warnings,
  integration 16/22, flows 1/3) and **added Phase 252** to close them.

- **2026-09-16** — Phase **253** added from 252's own code review (`CR-01/02/03/08`).
- **2026-09-17** — Phase **254** added by operator instruction: the independent review of 249-253.
- **2026-09-18** — the audit was **re-driven** before the close and moved to 25/26 · 19/19 · 3/3,
  with the 2026-09-16 reading preserved rather than overwritten.

⚠ **`gsd-sdk query phase.add` wrote its ROADMAP entry into the WRONG SECTION twice in two days**
(Phase 252 on 2026-09-16, Phase 254 on 2026-09-17) — a `### Phase NNN:` block at the wrong heading
level, appended after an archived milestone's `<details>` block, touching none of the live registers.
Both were reverted from a pre-call backup and hand-edited. **Back up before calling an SDK write verb,
and verify what it did on disk rather than trusting its JSON.**

---

## Operator Next Steps

1. ~~**Start the next milestone**~~ ✅ **DONE 2026-09-18 — v4.3 *What You Can Actually Sell* is open and roadmapped: 6 phases (255-260), 21/21 requirements mapped, migrations 182-185.** Next: `/gsd:discuss-phase 255`. ⛔ **255's discuss is where operator decisions #2 (Open Platform sequencing) and #6 (`OV-248-01` retire-or-record) must be put to the operator** — a third silent deferral of #2 needs a written reason, not silence.
2. **Rule on `OV-248-01`** (above) — retire the marker or record why it stays live.
3. **Rule on `DEBT-06`'s three open rows** — adopt the drafted refusals for 251 / 252 / 253, or leave
   them open for Gemini until **2026-09-24**. `BUS-246` and `BUS-248` are also open `to:operator`.

4. ~~**Promote migration 181 to cloud**~~ ✅ **DONE 2026-09-18 — v4.2 IS LIVE.**
   `master 84e3b020f → 5ff8c5846` · `production eebc4c42f → 65f7e8f30`, both merged `--no-ff`, each
   promotion's tree proven **byte-identical to `develop`** before pushing. Migration 181 applied and
   verified first (see *Undriven, not passing* above). `get_advisors(security)` in the same
   operation: **0 ERROR**.
   **Driven live after the push:** `/health` 200 `{"status":"ok","redis":"ok","maintenance":false}` ·
   `superrag.cloud/app` **308 → `app.superrag.cloud/app`** ·
   `Access-Control-Allow-Origin: https://app.superrag.cloud` · operator confirmed **sandbox code
   execution in a NEW chat** and **login → chat stream → doc ingest**.
   ⭐ **BOTH TEST GATES WENT RED AND NEITHER BLOCKED, because each was proven INHERITED by running at
   the base commit `eebc4c42f` — never by comparing against a number written in a register.**
   Backend read `72` vs the `71` ceiling and **that was a flake**: re-run on the same tree read `71`,
   and head-vs-base is **71 / 71 with identical failing sets** (4900 vs 4712 passed). Vitest read
   `failed 3`: `sketchComposition.test.tsx` fails **3 at base and 2 at head** — same
   `Found multiple elements with the role "tab" and name "Documents"`, already live — and
   `WorkflowBuilderPage.canvas.test.tsx` is one of `SEED-171`'s five flaky suites, **provably
   unmodified**. All implicated files are byte-unchanged `production..develop`.
   ⛔ **The first backend run was piped through `tail -25`, which kept the count and threw away 60 of
   the 72 names.** It had to be re-run with full capture. *A count is not a set* — the same finding
   this project has already paid for once.
   ⚠ **The `71` ceiling is STALE against suite growth** — set at `3497 passed`, now `4900` (+40%) —
   and was **left untouched**, per the standing rule that it needs explicit operator authorisation.
   ⛔ **No agent here can watch either build.** The Vercel MCP is bound to a different account (only
   project `fhdautomation/rag-app`, last deploy 2026-02) and there is no Coolify MCP. Build logs are
   **operator-eyeball only** — never record a build as green from this session.

5. **Set `VITE_DEMO_URL` in Vercel** when a demo booking link exists — deliberately skipped at this
   push. ⛔ It and `VITE_APP_URL` fall back **silently** (`#start`, `/app`), so a wrong value never
   errors, and `VITE_*` is baked at **build** time — setting it later needs a redeploy.
