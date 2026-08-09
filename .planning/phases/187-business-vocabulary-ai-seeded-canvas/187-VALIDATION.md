---
phase: 187
slug: business-vocabulary-ai-seeded-canvas
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
gates_measured: 2026-08-02
phase_base: 35261e96
gap_closure_round: 2026-08-02
gap_closure_plans: [187-16, 187-17, 187-18, 187-19]
gap_closure_base: ee5fff3b
gap_closure_gates_measured: 2026-08-02
gap_closure_round_3: 2026-08-03
gap_closure_3_plans: [187-20, 187-21]
gap_closure_3_base: f632f9b6
gap_closure_3_gates_measured: 2026-08-03
gap_closure_round_4: 2026-08-04
gap_closure_4_plans: [187-22, 187-23, 187-24, 187-25]
gap_closure_4_base: 7a1b427e
gap_closure_4_gates_measured: 2026-08-04
gap_closure_round_5: 2026-08-04
gap_closure_5_plans: [187-26, 187-27, 187-28, 187-29]
gap_closure_5_base: 15339441
gap_closure_5_gates_measured: 2026-08-04
manual_rows: 17
manual_rows_performed: 0
---

# Phase 187 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `187-RESEARCH.md` §"Validation Architecture" (measured on `develop` @ `132b9b26`,
> 2026-08-02). **Do not re-type figures from memory — every number below was measured.**

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework (backend)** | `pytest` 9.0.2 |
| **Framework (frontend)** | `vitest` 4.1.0 + Testing Library + jsdom |
| **Config file (backend)** | `backend/pytest.ini` (collection verified: **3474** tests) |
| **Config file (frontend)** | `frontend/vite.config.*` (vitest section) |
| **Quick run command (backend)** | `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py tests/unit/test_validator_kinds.py tests/unit/test_harness_models.py tests/unit/test_182_severity_codes.py -q --no-header` |
| **Quick run command (frontend)** | `cd frontend && npx vitest run src/components/workflows/phaseVocabulary.test.ts src/components/workflows/canvasModel.test.ts src/components/workflows/canvasModel.purity.test.ts src/components/workflows/canvasModel.roundtrip.test.ts src/components/workflows/canvasModel.fixtures.test.ts src/components/workflows/PhaseSpineGraph.test.tsx src/components/workflows/PhaseSpine.test.tsx src/components/workflows/PhaseNodeCard.test.tsx` |
| **Full suite (backend)** | `cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q` |
| **Full suite (frontend)** | `npx vitest run` — ⚠ **FLAKY; NOT A GATE** (see baseline) |
| **Estimated runtime** | backend quick ~1 s · frontend quick ~25 s · backend full ~6 min |

### 🔬 Measured baseline (`develop` @ `132b9b26`, 2026-08-02)

| Set | Result |
|---|---|
| Backend collection | **3474 tests collected** |
| Backend armed/vocabulary 5-file set | **72 passed, 0 failed** |
| Frontend 8-file vocabulary/canvas set (isolated) | **863 passed, 0 failed** |
| Frontend 5-file consumer set (isolated) — `WorkflowCanvas`, `PublishGauntlet`, `WorkflowBuilderPage.canvas`, `ProblemsTray`, `definitionOps` | **381 passed, 0 failed** |
| Frontend FULL suite | 3617 tests — run A: 3575 passed / **42 failed** (9 files); run B: 3568 passed / **49 failed** (11 files) — ⚠ **FLAKY at one commit** |

⚠ **`PublishGauntlet.test.tsx` (22 fails) and `WorkflowCanvas.test.tsx` (2 fails) are 100% GREEN in
isolation** — suite-interference flake, the 186-15 pattern. This **REFUTES** the project-memory claim
of "~14–17 pre-existing frontend vitest failures". Do not attribute either number to this phase.

---

## Sampling Rate

- **After every task commit:** the relevant quick-run set for the files touched (backend 5-file set,
  frontend 8-file vocabulary set, or the 5-file consumer set).
- **After every plan wave:** backend `pytest tests/ -q` (collection ≥ **3474** + the wave's net-new)
  **AND** both frontend isolated named sets with **non-decreasing counts**.
- **Before `/gsd:verify-work`:** backend full suite green; frontend **isolated named sets** green with
  counts ≥ baseline (863 + 381 + net-new); `npx tsc -b` clean (⚠ `tsc -b` ≠ `--noEmit`);
  `vite build` exit 0.
- **Max feedback latency:** ~30 s (quick sets).

### Gate rules specific to this phase

1. **Never gate on the full frontend suite.** Gate on the two isolated named sets.
2. **Guard test COUNT, not just failures** — a "net-new" file can silently REPLACE a suite
   (the Phase-177 lesson).
3. **Structural gates:** `git diff --stat -- supabase/migrations` must be **empty** (this phase ships
   ZERO migrations) and `git diff --stat -- frontend/src/pages/WorkflowBuilderPage.tsx` must stay
   within the **D-187-14 cap** (two gated mount lines; render-body insertions in single digits).

---

## The gap-closure round — 2026-08-02

`187-VERIFICATION.md` (2026-08-02T03:25:40Z) closed the phase at **`gaps_found`, 9/11 must-haves**,
with one BLOCKER and seven Warnings. The operator folded four findings into a gap-closure round of
four plans:

| Plan | Finding it closes | Severity as recorded | Wave |
|---|---|---|---|
| **187-16** | **CR-01** (the receipt claims a governance action the AI did not take) + **CR-02** (the suite's `llm_emit` fixtures use a `citation_policy` the backend `Literal` cannot produce, so the suite cannot see CR-01) | 🛑 Blocker ×2 — the *only* reason the phase did not pass | 5 |
| **187-17** | **WR-02** (`derivedFace` tier 3 renders `Search {folder}` on step types that cannot search) | ⚠️ Warning, operator-folded | 5 |
| **187-18** | **WR-03** (the ＋ picker row promises *"Check with you"*; the card that lands says *"Wait for your approval"*) | ⚠️ Warning, operator-folded | 5 |
| **187-19** | this record — the closure round's own rows, the M3 unblock, and the measured gates | — | 6 |

**Scope discipline, stated rather than implied.** The round is scoped to CR-01 / CR-02 / WR-02 /
WR-03 **only**. WR-01, WR-04, WR-05, WR-06, WR-07 and IN-01…IN-05 are unchanged, still recorded in
`187-REVIEW.md`, and carried forward as findings — none was silently absorbed into this round and
none was silently dropped.

**Base commit for every gate below: `ee5fff3b`** (`docs(187): record gap-closure planning — 4 plans,
ready to execute`) — the tip immediately before `77668751`, the round's first commit. This is a
*different* base from the phase's own `35261e96`; both are stated so no figure in this file is
ambiguous about which range it measures.

**Two forks were resolved against the reviewer's own suggested minimum, and both are recorded here
because they change what a reader should expect the shipped code to do:**

- **CR-01 — the receipt keeps ALL THREE causes and splits the LEAD**, rather than taking the
  reviewer's minimal `if (cause !== "detected") continue`. Filtering the list would have left the
  typical draft's deliverable wearing an unexplained ⛨ seal — trading a false sentence for exactly
  the SC#3 hole the receipt exists to close (187-16, verified live: `canvasModel.isGrounded` is
  `groundingCauseOf(...) !== null`, so the card seals for all three causes).
- **WR-02 — `llm_emit` is EXCLUDED from the gated set, against its own field docblock.**
  `LlmEmitPhaseConfig.folder_scope` claims to be *"load-bearing in the executor plan"*; re-read at
  live HEAD, `_exec_llm_emit` (`phase_types.py:1151-1601`) contains **zero functional reads** of
  `folder_scope` / `folder_subtree_ids` / `ToolContext` / `_build_phase_tool_context`. The plan-era
  claim is refuted by the shipped executor, and the refutation is recorded in-source so it cannot be
  re-inherited (187-17). The reviewer's parenthetical *"`llm_emit` should be added to that predicate
  only if the emit executor really does bound-scope retrieval"* is therefore answered **no**.

---

## Per-Task Verification Map

> Filled per-task at plan time. Every task must land in this table with an automated command or an
> explicit Wave-0 dependency.

> **Filled at the close of the phase (plan 187-15 Task 3, 2026-08-02).** Every row's command was
> re-run at that commit; none is transcribed from a plan's own SUMMARY.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 187-01-T1 | 01 | 1 | VOCAB-02 | T-187-01-01 | The armed-phase harness quantifies over author validator SETS, not one example | property harness | `pytest tests/unit/test_187_armed_checkpoint_property.py --collect-only -q` | ✅ | ✅ green |
| 187-01-T2 | 01 | 1 | VOCAB-02 | T-187-01-02 | A refusal writes **ZERO** `validator_ask_user_approved` receipts (the 185 BLOCKER was a FALSE receipt) | property | `pytest tests/unit/test_187_armed_checkpoint_property.py -q` | ✅ | ✅ green |
| 187-01-T3 | 01 | 1 | VOCAB-02 | T-187-01-03 | The property was observed **RED on HEAD before any fix**, signature recorded | falsification | same | ✅ | ✅ green |
| 187-02-T1 | 02 | 1 | VOCAB-01 | T-187-02-01 | `name_seeded_by_ai` is additive-optional; a pre-187 row loads with it absent, no `ValidationError` | unit | `pytest tests/unit/test_harness_models.py tests/unit/test_185_engine_attachment.py -q` | ✅ | ✅ green |
| 187-02-T2 | 02 | 1 | VOCAB-02 | T-187-02-02 | Every phase of a generated definition carries a non-empty `name`; provider budget 1/2, never 3 | unit + integration | `pytest tests/unit/test_187_authoring_step_names.py tests/unit/test_103_nl_generate.py -q` | ✅ | ✅ green |
| 187-03-T1 | 03 | 1 | VOCAB-02 | T-187-03-01 | An unbound KB-reading phase mints ONE `incomplete` verdict, keyed per node | unit | `pytest tests/unit/test_182_validate.py -q` | ✅ | ✅ green |
| 187-03-T2 | 03 | 1 | VOCAB-02 | T-187-03-02 | The new code is REGISTERED — `_severity` returns `incomplete`, not fail-loud `error` | unit | `pytest tests/unit/test_182_severity_codes.py tests/unit/test_182_validate.py -q` | ✅ | ✅ green |
| 187-03-T3 | 03 | 1 | VOCAB-02 | — | `BUG-260731-03`'s frontmatter routed at the plan-phase touchpoint | structural | `grep -E "^(status\|folded_into\|verified_closed_by):" .planning/reported-bugs/BUG-260731-03-*.md` | ✅ | ✅ green |
| 187-04-T1 | 04 | 1 | VOCAB-01 | T-187-04-01 | `derivedFace` is TOTAL and PURE; precedence is skill → template(`llm_emit`) → folder → human-input | unit | `vitest run …/phaseVocabulary.test.ts` | ✅ | ✅ green |
| 187-04-T2 | 04 | 1 | VOCAB-01 | T-187-04-02 | `nodeTitle` never fabricates and never emits a slug; an omitted ctx renders byte-identically | unit + source guard | `vitest run …/phaseVocabulary.test.ts …/PhaseSpineGraph.test.tsx …/PhaseSpine.test.tsx` | ✅ | ✅ green |
| 187-05-T1 | 05 | 1 | VOCAB-03 | T-187-05-01 | The flag-off describe screen settles deterministically and its CTA region is addressable | render harness | `vitest run …/WorkflowBuilderPage.describe.test.tsx` | ✅ | ✅ green |
| 187-05-T2 | 05 | 1 | VOCAB-03 | T-187-05-02/03 | D-181-01 as an EQUALITY: the operator-like map yields the identical byte literal; the page is unmodified | byte pin + positive control | same | ✅ | ✅ green |
| 187-06-T1 | 06 | 2 | VOCAB-02 | T-187-06-01 | `is_action_risk` is an explicit parameter — the Pitfall-4 `[pre/fail_run]` fail-open is closed | unit | `pytest tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py -q` | ✅ | ✅ green |
| 187-06-T2 | 06 | 2 | VOCAB-02 | T-187-06-02 | The armed checkpoint is asked BEFORE the body, for arbitrary author validator sets | unit + property | `pytest tests/unit/test_pre_post_timing.py tests/unit/test_harness_models.py -q` | ✅ | ✅ green |
| 187-06-T3 | 06 | 2 | VOCAB-02 | T-187-06-03 | `effective_phase` no longer appends the armed `ValidatorSpec` — one source, not two | unit | `pytest tests/unit/test_185_engine_attachment.py -q -k "weak_author_spec or ungoverned"` | ✅ | ✅ green |
| 187-07-T1 | 07 | 2 | SC#10 | T-187-07-01 | The roster is DERIVED from `MODEL_CAPABILITIES` by grouping on `provider`, never re-typed | integration (guarded) | `pytest tests/integration/test_187_authoring_roster.py -q --collect-only` | ✅ | ✅ green |
| 187-07-T2 | 07 | 2 | SC#10 | T-187-07-02 | 8/8 rows executed live; blocked rows recorded ⛔ with a reason, never omitted | live integration | recorded below, §"SC#10 roster" | ✅ | ✅ green |
| 187-08-T1 | 08 | 2 | VOCAB-01 | T-187-08-01/02 | `toCanvas` stays PURE; an omitted `nameContext` hands the SAME frozen reference and renders byte-identically | unit + snapshot + source guard | `vitest run …/canvasModel.test.ts …/canvasModel.purity.test.ts …/canvasModel.fixtures.test.ts` | ✅ | ✅ green |
| 187-08-T2 | 08 | 2 | VOCAB-01 | T-187-08-03/05 | The card and the tray row for one step can never disagree; `WorkflowCanvas.tsx` capped at 7/2 | render + diff cap | `vitest run …/WorkflowCanvas.test.tsx …/ProblemsTray.test.tsx` | ✅ | ✅ green |
| 187-09-T1 | 09 | 2 | VOCAB-01 (Req 4) | T-187-09-01/05 | Reveal ON ⇒ card TITLE == reveal-OFF title; the whole slug reaches the DOM; `PhaseNodeCard` untouched | render | `vitest run …/PhaseNode.test.tsx …/PhaseNodeCard.test.tsx` | ✅ | ✅ green |
| 187-09-T2 | 09 | 2 | VOCAB-01 (Req 4) | T-187-09-02/04 | Canvas and spine render the same title in BOTH toggle states; one app-wide reveal source | render + source guard | `vitest run …/PhaseSpineGraph.test.tsx …/PhaseSpine.test.tsx` | ✅ | ✅ green |
| 187-10-T1 | 10 | 2 | VOCAB-01 (Req 3) | T-187-10-01 | An identity-bearing config edit clears a **seeded** name and leaves a **hand-typed** one | unit | `vitest run …/definitionOps.test.ts …/phaseVocabulary.test.ts` | ✅ | ✅ green |
| 187-10-T2 | 10 | 2 | VOCAB-02/03 | T-187-10-02 | Every Req-5/6 sentence has ONE home; overclaim word class and unshipped glyphs are fenced | unit (copy guards) | `vitest run …/definitionOps.test.ts` | ✅ | ✅ green |
| 187-11-T1 | 11 | 3 | VOCAB-02 | T-187-11-01 | The eight armed disposition tests assert the ORDER, not the presence, of the checkpoint | unit | `pytest tests/unit/test_ask_user_disposition.py -q` | ✅ | ✅ green |
| 187-11-T2 | 11 | 3 | VOCAB-02 | T-187-11-02 | A NON-armed freshness `ask_user` gate behaves byte-identically (the asymmetry net) | unit | `pytest tests/unit/test_185_engine_attachment.py -q` | ✅ | ✅ green |
| 187-11-T3 | 11 | 3 | VOCAB-02 / SC#6 | T-187-11-03 | The falsification is OBSERVED: removing the checkpoint reds the property for the right reason | falsification | `pytest tests/unit/test_187_armed_checkpoint_property.py -q` | ✅ | ✅ green |
| 187-12-T1 | 12 | 3 | VOCAB-01 | T-187-12-01 | The corpus fixtures carry the fields the derived tier reads; the projection is unmoved | unit + snapshot | `vitest run …/canvasModel.fixtures.test.ts …/canvasModel.roundtrip.test.ts` | ✅ | ✅ green |
| 187-12-T2 | 12 | 3 | SC#5 c1/c2 | T-187-12-02 | Zero reveal-OFF titles carry a slug or a raw `phase_type` token; no two steps share a face | pure function | `vitest run …/phaseVocabulary.corpus.test.ts` | ✅ | ✅ green |
| 187-13-T1 | 13 | 3 | VOCAB-02 (Req 5) | T-187-13-01/02 | The receipt RENDERS; `groundingCauseOf` DECIDES — no second grounding derivation, no KB tool id in the file | render | `vitest run …/SeedReceipt.test.tsx` | ✅ | ✅ green |
| 187-13-T2 | 13 | 3 | VOCAB-02 (Req 5) | T-187-13-03/06 | NO node-by-node staging (a source property, never a timing test); `open === false` renders nothing | source guard | same | ✅ | ✅ green |
| 187-14-T1 | 14 | 3 | VOCAB-03 (Req 6) | T-187-14-01/04 | The door reads ONE api symbol; a failed fetch invents no row and is kept apart from "there are none" | render | `vitest run …/StarterTemplatePicker.test.tsx` | ✅ | ✅ green |
| 187-14-T2 | 14 | 3 | VOCAB-03 (Req 6) | T-187-14-02/05 | NO second forward path — seven create/publish/generate symbols each at zero, proved behaviourally AND at the source | behaviour + source guard | same | ✅ | ✅ green |
| **187-15-T1** | **15** | **4** | VOCAB-01 | T-187-15-01/07 | Both graph views resolve the face from ONE memoised context; flag-off the spine prop is genuinely ABSENT; both announcements name a step the way its card does | render + prop recorder + source guard | `vitest run …/WorkflowBuilderPage.canvas.test.tsx` | ✅ | ✅ green |
| **187-15-T2** | **15** | **4** | VOCAB-02, VOCAB-03 | T-187-15-01/02/04 | The receipt and the door mount behind the canvas flag in one line each; the flag-off describe screen is byte-identical | render + byte pin + source guard | `vitest run …/WorkflowBuilderPage.canvas.test.tsx …/WorkflowBuilderPage.describe.test.tsx` | ✅ | ✅ green |
| **187-15-T3** | **15** | **4** | all | T-187-15-03/05/06 | Every phase gate measured with raw output; no false completion record written | structural | `git diff --numstat`, `git status --porcelain` (see §Phase gates) | ✅ | ✅ green |
| **187-16-T1** | **16** | **5** | VOCAB-02 (Req 5) | T-187-16-05 | **CR-02 closed** — every `citation_policy` literal in the suite is a member of the backend `Literal["strict","flag","partial","draft"]` (`harness.py:155`), and the shipped default `strict` is exercised; the falsification was **observed RED before any component edit** (12 failed / 34 passed, signature in the SUMMARY) | falsification + fixture-representability guard | `cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx` | ✅ | ✅ green |
| **187-16-T2** | **16** | **5** | VOCAB-02 (Req 5) | T-187-16-01/03/04/06 | **CR-01 closed** — the *"…read your documents, so I set them to must prove it"* lead counts ONLY `cause === "detected"` steps; a sibling passive sentence covers `already-set` + `escalated`; **every sealed step is still listed** so no ⛨ arrives unexplained; a word-class fence with a positive control asserts no first-person application claim over a non-detected draft | unit + render + word-class fence | `cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx src/components/workflows/definitionOps.test.ts` | ✅ | ✅ green — 274 passed, 0 failed |
| **187-17-T1** | **17** | **5** | VOCAB-01 (Req 1) | T-187-17-01/02 | The folder tier is exercised across the **whole phase-type space**, with the expectation DERIVED from the shipped `GROUNDING_DIAL_TYPES` rather than re-typed, plus non-vacuity assertions on both halves of the partition; observed **RED before any resolver edit** (13 failed / 122 passed — four of six types over-claimed) | falsification + type-space sweep | `cd frontend && npx vitest run src/components/workflows/phaseVocabulary.test.ts src/components/workflows/phaseVocabulary.corpus.test.ts` | ✅ | ✅ green |
| **187-17-T2** | **17** | **5** | VOCAB-01 (Req 1) | T-187-17-01/03/04/05 | **WR-02 closed** — a step type that cannot perform bound-scope retrieval never renders `Search {folder}`; the gated-out path falls THROUGH to the plain type sentence, never to a folder name or a raw id; `materialConfigKey` was repaired to mirror both gated tiers rather than SC#5 check 2 being loosened | unit + corpus + source fence + snapshot | `cd frontend && npx vitest run src/components/workflows/phaseVocabulary.test.ts src/components/workflows/phaseVocabulary.corpus.test.ts src/components/workflows/canvasModel.test.ts src/components/workflows/canvasModel.purity.test.ts src/components/workflows/canvasModel.fixtures.test.ts` | ✅ | ✅ green — 1043 passed, 0 failed (9-file set) |
| **187-18-T1** | **18** | **5** | VOCAB-01 (Req 1) | T-187-18-01/02 | The row's expectation becomes `nodeTitle(minimalPhaseFor(type, …))` — the picker is measured against the **resolver the card asks**, not against the sentence map; observed **RED before any picker edit** (4 failed / 39 passed) with the whole-frame diff showing **exactly one of six rows moving** | falsification + whole-frame equality | `cd frontend && npx vitest run src/components/workflows/StepTypePicker.test.tsx` | ✅ | ✅ green |
| **187-18-T2** | **18** | **5** | VOCAB-01 (Req 1) | T-187-18-01/03 | **WR-03 closed** — the ＋ row is a PREVIEW of the card it creates; source fence proves zero `PHASE_TYPE_SENTENCES` reads in the picker (identifier assembled from parts) with positive controls for `nodeTitle` + `minimalPhaseFor`; the stale docblock naming the deleted map read was rewritten in the same commit | unit + source fence | `cd frontend && npx vitest run src/components/workflows/StepTypePicker.test.tsx src/components/workflows/WorkflowCanvas.test.tsx` | ✅ | ✅ green — 78 passed, 0 failed |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

> **The six closure rows above were re-run at the closure commit** as part of plan 187-19 Task 2 —
> see §"Phase gates — gap-closure round". Their Status cells are taken from each plan's own recorded
> SUMMARY result and cross-checked against that re-run; where the two ever disagreed, both are
> recorded in §"Phase gates — gap-closure round" and the re-run is the measurement.

### Requirement → proof map (from RESEARCH.md — bind tasks to these rows)

| Req | Behavior | Type | Command | Exists? |
|---|---|---|---|---|
| **Req 1** | `nodeTitle` resolves 3 tiers; derived tier pure & unstored | unit | `vitest run …/phaseVocabulary.test.ts` | ✅ extend |
| Req 1 | Omitting the name context renders **byte-identically** | unit + snapshot | `vitest run …/canvasModel.fixtures.test.ts …/canvasModel.purity.test.ts` | ✅ |
| Req 1 | Re-binding a skill changes the face with **no write** | property | `vitest run …/definitionOps.test.ts` | ✅ extend |
| Req 1 | Totality: unknown type / absent config / malformed `available_tools` never throw | unit | `phaseVocabulary.test.ts` | ✅ extend |
| Req 1 | `?raw` guards still see **exactly one** vocabulary copy | source guard | `vitest run …/PhaseSpineGraph.test.tsx …/PhaseSpine.test.tsx` | ✅ |
| **Req 2** | Every phase of a generated definition carries a non-empty `name` | integration (real `forced_emit`) | `pytest tests/unit/test_187_authoring_step_names.py -q` | ❌ **W0** |
| Req 2 | Emitted definition `model_validate()`s + passes grounding fidelity | integration | same | ❌ W0 |
| Req 2 | Provider-call budget: 1 / 2 / never 3 | unit (mocked, count calls) | same | ❌ W0 |
| **Req 3** | Identity-bearing config edit clears a **seeded** name; leaves a **hand-typed** one | unit | `vitest run …/definitionOps.test.ts` | ✅ extend |
| Req 3 | A pre-187 row loads with the marker absent, no `ValidationError` | unit | `pytest tests/unit/test_harness_models.py -q` | ✅ extend |
| Req 3 | **Zero** migration files added | structural | `git diff --name-only -- supabase/migrations \| wc -l` == 0 | ❌ **W0** |
| **Req 4** | Reveal ON ⇒ card **title** == reveal-OFF title | render | `vitest run …/PhaseNodeCard.test.tsx` + a `PhaseNode` render test | ✅ extend |
| Req 4 | Full slug present in the DOM, no ellipsis, subtitle has no `truncate` | render | same | ✅ extend |
| Req 4 | `technicalLine` still **not** passed (Phase 188's slot) | render | assert `[data-testid=…technical-line]` absent | ✅ extend |
| Req 4 | Canvas & spine render the same **title** in both toggle states | render | `PhaseSpineGraph.test.tsx` + canvas render | ✅ extend |
| **Req 5** | Grounded steps ⇒ receipt names exactly those, with reasons | render | `vitest run …/SeedReceipt.test.tsx` | ❌ **W0** |
| Req 5 | Zero grounded ⇒ no grounded-step list, receipt still appears (D-187-10) | render | same | ❌ W0 |
| Req 5 | Dismisses; does not reappear on the same draft | interaction | same | ❌ W0 |
| Req 5 | **No** node-by-node staging animation | source guard | same | ❌ W0 |
| **Req 6** | Template fills the textarea, user stays on the describe screen, CTA enabled | interaction | `vitest run …/StarterTemplatePicker.test.tsx` | ❌ **W0** |
| Req 6 | No first-screen path places a definition on the canvas without generation | unit | `WorkflowBuilderPage.test.tsx` (assert `setDrafted` never called) | ✅ extend |
| Req 6 | **Flag-OFF describe screen is unchanged** (D-181-01) | source pin | copy `WorkflowBuilderPage.header.test.tsx:302-322` | ❌ **W0 — no pin exists** |
| **Req 7 / SC#6** | **`armed(phase) ⇒ checkpoint asked before body`, over arbitrary author validator sets** | **property** | `pytest tests/unit/test_187_armed_checkpoint_property.py -q` | ❌ **W0** |
| Req 7 | A refusal does not run the body and writes **ZERO** approval receipts | unit | same | ❌ W0 |
| Req 7 | `test_185_engine_attachment.py:153-165` stays green | regression | `pytest tests/unit/test_185_engine_attachment.py -q` | ✅ |
| Req 7 | A **non-armed** freshness `ask_user` gate behaves byte-identically | asymmetry net | `test_185_engine_attachment.py:683` + `test_ask_user_disposition.py:599` | ✅ |
| **D-187-11** | Unbound + KB-reading phase ⇒ one `incomplete` verdict, keyed per node | unit | extend the `/validate` suite | ✅ extend |
| D-187-11 | The new code is **registered** — `_severity` returns `incomplete`, not fail-loud `error` | unit | `pytest tests/unit/test_182_severity_codes.py -q` | ✅ |
| **SC#10** | 8 roster rows each emit a valid `WorkflowDefinition` with non-empty `name` on every phase | integration (real, serial) | `pytest tests/unit/test_187_authoring_step_names.py -q -k roster` | ❌ W0 |
| **SC#5 c1** | Zero reveal-OFF **titles** contain a slug or raw `phase_type` token, across the corpus | pure-function | `vitest run …/phaseVocabulary.corpus.test.ts` | ❌ **W0** |
| **SC#5 c2** | No two steps in one workflow render identical faces (⚠ **narrow first — see Open Q1**) | pure-function | same | ❌ W0 |

---

## 🚨 The SC#6 property test — how to make it count

Per SPEC acceptance + the Phase-185 lesson (*"observe falsification RED first"*, *"verify the
PROPERTY not the PATCH"*), this test is meaningful **only if all five hold**:

1. **Written and observed RED on HEAD, before any fix**, with the RED signature recorded (which
   assertion, what value). A property test first run *after* the fix proves nothing.
2. **It quantifies over author-declared validator SETS**, not one hand-picked example. Minimum space:
   `[]` · `[pre/ask_user]` · `[pre/fail_run]` · `[pre/skip_to_phase:X]` · `[post/*]` ·
   `[pre/ask_user, post/citations_required]` · multi-pre permutations. The known bypass is
   `[pre/ask_user]` + Proceed; the **Pitfall-4 bypass is `[pre/fail_run]`** (disposition resolution
   routing the checkpoint away). Both MUST be in the space.
3. **The observable is "was the body invoked"** — a spy over `_execute_phase`, plus
   `subscribe_for_response` having been awaited **before** it. Not "was a validator present".
4. **It asserts the negative:** on a refusal, `write_audit` is awaited **ZERO** times with
   `event_type="validator_ask_user_approved"`. Phase 185's BLOCKER was a **false approval receipt**,
   not a missing prompt. The space must include a **typed** "no".
5. **The falsification is observed, not assumed:** after the fix, temporarily remove the checkpoint
   and confirm the test goes red again **for the right reason**.

---

## Phase gates — measured

> Measured at the close of plan 187-15, **2026-08-02**, against the phase base `35261e96`
> (the 187-14 doc commit). Raw output, not transcription.

### (a1) The render-body sub-gate — D-187-14 as it is literally stated

`D=$(git diff -U0 35261e96 -- frontend/src/pages/WorkflowBuilderPage.tsx)`, added lines only, comment
lines filtered with `grep -vE '^\+[ \t]*(//|\*|\{/\*)'`.

⚠ **`[[:space:]]` does not work inside a bracket expression on this machine's `grep`/`awk` builds.**
The plan's four commands are otherwise run verbatim, with `[ \t]` substituted for `[[:space:]]`.
Recorded here rather than left as an undocumented edit.

| # | Property | Expected | **Measured** |
|---|---|---|---|
| 1 | exactly 2 new component mounts (`SeedReceipt`, `StarterTemplatePicker`) | 2 | **2** |
| 2 | no OTHER new JSX element | 0 | **0** |
| 3 | new props on existing JSX elements | 2 | **3 raw · 2 re-anchored** ⚠ see below |
| 4 | no new component or helper function | 0 | **0** |

**Count 3 is recorded honestly rather than reported green.** The verbatim command
`grep -cE '^\+[ \t]*(nameContext=|\{\.\.\.\(canvasEnabled)'` returns **3**. The three matches are:

```
+          nameContext={nameContext}                       ← <WorkflowCanvas>   (EXISTING element)
+        {...(canvasEnabled ? { nameContext } : {})}       ← <PhaseSpineGraph>  (EXISTING element)
+        nameContext={nameContext}                         ← <SeedReceipt>      (a NEW mount)
```

The third is a prop on one of the two NEW mounts count 1 already accounts for — the grep cannot tell
a prop on a new element from a prop on an existing one. It is passed for a **correctness** reason
(187-13's hand-off: without it the receipt and the card it points at name one step two different
ways), so the fix was to measure the property, not to drop the prop. Re-anchored by excluding the
new mounts' own attribute blocks:

```bash
echo "$D" | awk '/^\+[ \t]*<(SeedReceipt|StarterTemplatePicker)/{skip=1} \
                 skip&&/^\+[ \t]*\/>/{skip=0;next} !skip{print}' \
          | grep -cE '^\+[ \t]*(nameContext=|\{\.\.\.\(canvasEnabled)'
# → 2
```

**The property D-187-14 names holds exactly: exactly two new props reach an EXISTING JSX element.**

### (a2) The total-diff gate — derived, not chosen

```
$ git diff --numstat 35261e96 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx
46      5       frontend/src/pages/WorkflowBuilderPage.tsx
```

**Gate: ≤ 46 insertions / ≤ 5 deletions. Measured 46 / 5 — at the cap, not over it.**

| # | Component | Ins (budget) | **Ins (measured)** | Del (budget) | **Del (measured)** |
|---|---|---|---|---|---|
| 1 | imports — `type NameContext`, `SeedReceipt`, `StarterTemplatePicker` | 3 | **3** | 0 | **0** |
| 2 | the `nameContext` `useMemo` (5 code + 7 comment) | 14 | **12** | 0 | **0** |
| 3 | the two graph-view passes (canvas prop, spine spread-conditional, 1 comment each) | 4 | **4** | 0 | **0** |
| 4 | the two announcement sites + both `useCallback` dependency arrays + 1 comment | 5 | **5** | 4 | **4** |
| 5 | the receipt's `useState` + its D-187-09 comment | 5 | **4** | 0 | **0** |
| 6 | `setShowReceipt(true)` in `onDraft`'s success branch + its `autoDraft` comment | 3 | **3** | 0 | **0** |
| 7 | the `SeedReceipt` mount — 7 element lines + 4 comment | 9 | **11** | 0 | **0** |
| 8 | the `StarterTemplatePicker` mount — 1 gated line + 2 comment | 3 | **3** | 0 | **0** |
| **9** | **the graph column's row template** — see the deviation note below | *(unbudgeted)* | **1** | *(unbudgeted)* | **1** |
| | **TOTAL** | **46** | **46** | **4 + 1 allowance** | **5** |

**The arithmetic the plan asks to be shown:** the derived non-Open-Q6 portion is **41**, component 4
(the two announcement sites, RESEARCH Open Q6) adds **5** insertions and **4** deletions, and
**41 + 5 = 46**. The gate is arithmetic, not a renegotiation.

**Two rows moved against their budget, and both are named rather than absorbed.**

- **Row 7 ran 2 over (9 → 11)** because its comment had to carry a second fact the plan did not
  anticipate — see row 9. Rows 2 and 5 came in **3 under** between them, so the total did not move;
  the reallocation is recorded here instead of being hidden inside a green total.
- **Row 9 is net-new and unbudgeted.** The plan's 8-row table has no row for it because the defect it
  fixes was not visible at plan time: a **dismissed receipt renders no DOM node at all**
  (`open === false` returns `null`), so a third grid row alone would have left CSS auto-placement
  dropping the graph into the second `auto` row and collapsing it to content height. jsdom performs no
  layout, so **every suite would have stayed green through the regression**. The column therefore
  declares three rows *and* pins its last child (always the graph) to the `minmax(0,1fr)` row. Its one
  deletion consumes the plan's single named allowance, which went unused for its stated purpose
  (Prettier re-wrapped nothing in component 4). Guarded at the source in
  `WorkflowBuilderPage.canvas.test.tsx`, since no render test can see it.

### (a3) The named gap — `definitionOps.canRemovePhase`

`definitionOps.ts:282` (`const lead = \`"${nodeTitle(referrers[0])}"\``) is **deliberately not
threaded**. Widening that pure module's signature is a separate decision, and its refusal sentence is
a shape predicate rather than a node face.

**The consequence, stated rather than buried:** after this phase the `Added` and `Removed` notices
resolve the derived face while the `refusal` notice in the *same* notice surface does not — so a user
can be told *"Run the Invoice Checker"* on one notice and the generic type sentence on the next.

**Re-open trigger: Phase 188's `WorkflowCanvas.tsx` extraction**, which reopens these seams anyway
(CLAUDE.md hot-file ledger; plan 187-08's own G-5 note).

It is **asserted**, not merely written down — `WorkflowBuilderPage.canvas.test.tsx` carries
*"THE DEFERRAL, ASSERTED — a refusal still names its referrer with the undecorated title"*, which
reds if the gap is closed silently. Verified unmoved:

```
$ git status --porcelain frontend/src/components/workflows/definitionOps.ts   # (empty)
$ grep -c "nodeTitle(referrers" frontend/src/components/workflows/definitionOps.ts
1
```

The canvas / spine / announcement / tray sites — the ones a user meets on the happy path — are all
closed. `ProblemsTray` was closed in plan 187-08 at **zero** cost to this gate, because the tray is
mounted inside `WorkflowCanvas.tsx`, not by this page.

### (b) The zero-migration gate

```
$ git diff --stat 35261e96 HEAD -- supabase/migrations     # (empty — 0 lines)
$ git status --porcelain supabase/migrations               # (empty — 0 lines)
```

**This phase adds ZERO migration files.** Confirmed a second way: `git diff --name-only 35261e96 HEAD`
lists exactly three files, all under `frontend/src/pages/`.

### (c) The isolated frontend sets

Run isolated, never as part of the full frontend suite (measured 42–49 failures, flaky at one commit).

| Set | Baseline | **Measured 2026-08-02** | Failed |
|---|---|---|---|
| the 8-file vocabulary/canvas set | 863 | **980** | **0** |
| the 5-file consumer set (`WorkflowCanvas`, `PublishGauntlet`, `WorkflowBuilderPage.canvas`, `ProblemsTray`, `definitionOps`) | 381 | **443** | **0** |
| the five `WorkflowBuilderPage` suites (canvas · describe · header · page · session) | — | **194** | **0** |
| the phase's other net-new suites (`phaseVocabulary.corpus`, `SeedReceipt`, `StarterTemplatePicker`, `PhaseNode`) | — | **128** | **0** |

⚠ **`PublishGauntlet.test.tsx` passes 46/46 inside the 5-file set** and is the file the wider sweep
reports as flaky. Counts are guarded, not just failures (the Phase-177 lesson): both named sets are
**above** their baselines by this phase's net-new, and no shipped file's count dropped.

### (d) The backend suite

```
$ cd backend && ./venv/Scripts/python.exe -m pytest tests/ -q
211 failed, 3289 passed, 19 skipped, 5 xfailed, 9 xpassed, 264 warnings, 1 error in 367.60s
```

**Collection = 3533 ≥ 3474** ✅.

⚠ **The plan's "0 failed" bar is not met, and it is not this phase's to meet.** The failures are
**pre-existing rot**, and that is measured rather than argued:

- `pytest tests/unit -q` → **62 failed / 1693 passed** — *exactly* the baseline measured on the tree
  immediately before this plan was dispatched (retrieval_service 15, sql_service 12, explorer_agent 6,
  multimodal_query 5, 111_1_reembed 4, sandbox_service 3, lifespan 3, db_runs 3, module7_tools 2,
  extraction_service 2, 9 singles). Unchanged, to the test.
- The remaining ~149 are `tests/integration`, which need live services this environment does not run
  headlessly (plus one collection error in `test_077_cross_cancel.py`).
- **This phase committed zero backend files:** `git diff --name-only 35261e96 HEAD -- backend/` is
  empty. Every 187-owned backend suite is green:

```
$ pytest tests/unit/test_187_armed_checkpoint_property.py tests/unit/test_187_authoring_step_names.py \
         tests/unit/test_182_validate.py tests/unit/test_182_severity_codes.py \
         tests/unit/test_185_engine_attachment.py tests/unit/test_ask_user_disposition.py \
         tests/unit/test_harness_models.py tests/unit/test_pre_post_timing.py \
         tests/unit/test_103_nl_generate.py -q
131 passed, 1 warning in 1.16s

$ pytest tests/integration/test_187_authoring_roster.py -q --collect-only
10 tests collected
```

### (e) Build gates

```
$ cd frontend && npx tsc -b ; echo $?
33 error TS lines · 0 in src/components/workflows/ or src/pages/WorkflowBuilderPage* · exit 2
$ npx vite build > /dev/null 2>&1 ; echo $?
0
```

⚠ **`tsc -b` has never exited 0 on this repo** — 33 pre-existing errors at HEAD (`SettingsPage`, the
`__tests__` tree, `MessageSkeleton`, `SkillFormDialog`, `lib/api.test.ts`), logged by plan 187-04 as
`D-ITEM-01` in `deferred-items.md`. Measured identically **before and after** this plan's edits, so
the delta is provably **zero** and the criterion is read as *no NEW error, none in the touched files*.
`vite build` exits **0**. ⚠ `tsc -b` ≠ `--noEmit` (the v3.3 lesson) — the buildinfo path is the one run.

### (f) No false completion record

```
$ git status --porcelain .planning/REQUIREMENTS.md .planning/STATE.md .planning/ROADMAP.md   # (empty)
```

Neither `requirements.mark-complete`, `state.advance-plan` nor `roadmap.update-plan-progress` was
called from this executor — all three write false records in this project.

---

## Phase gates — gap-closure round, measured 2026-08-02

> Base: **`ee5fff3b`**. Every figure below came from a command run at the closure commit, with the
> raw output pasted. Nothing here is transcribed from a plan's own SUMMARY; where a plan's SUMMARY
> states the same figure, that is recorded as an **agreement between two independent measurements**,
> not as the source of the number.

### (h) The base is source-identical to the phase close — so "before" is derived, not assumed

The three fix plans' pre-fix state cannot be re-run without checking out the base on this shared
working tree. It does not need to be: the closure base differs from the phase-close commit
`9602bd13` **only in `.planning/` documents**, so every source measurement recorded in §(c) and §(e)
above carries to the closure base by identity.

```
$ git diff --name-only 9602bd13 ee5fff3b
.planning/ROADMAP.md
.planning/STATE.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-16-PLAN.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-17-PLAN.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-18-PLAN.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-19-PLAN.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-REVIEW.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-VERIFICATION.md
```

**Zero source files.** The `980` / `443` / `33` figures in §(c) and §(e) are therefore the closure
round's *before* values as a matter of derivation.

### (i) The zero-migration gate

```
$ git diff --stat ee5fff3b HEAD -- supabase/migrations
                                            ← (empty — 0 lines, exit 0)
$ git status --porcelain supabase/migrations
                                            ← (empty — 0 lines)
```

**Both empty.** Truth #11 (*"Zero migrations added by this phase"*) survives the closure round. This
round shipped four frontend source files and no schema change of any kind.

### (j) The D-187-14 mount cap, re-measured — this round spends none of the budget

```
$ git diff --numstat ee5fff3b HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx
                                            ← (empty — the file is UNTOUCHED by this round)
```

Pasted verbatim: the command produces **no output at all**. The phase shipped this file at the cap
(46 ins / 5 del, §a2); the closure round adds **0 insertions and 0 deletions**, so the cap is
neither renegotiated nor consumed. All four fixes landed in `components/workflows/`, not at the
mount.

### (k) The isolated named sets — count guarded, not just failures

⚠ Run **isolated**, never as part of the full frontend suite (measured 42–49 failures, flaky at one
commit). The Phase-177 lesson is applied: the **COUNT** is the gate, not only the failure number.

| Set | 187-15 value (= the closure base, by §h) | **Measured now** | Δ | Failed |
|---|---|---|---|---|
| the 8-file vocabulary/canvas set | 980 | **998** | **+18** | **0** |
| the 5-file consumer set (`WorkflowCanvas`, `PublishGauntlet`, `WorkflowBuilderPage.canvas`, `ProblemsTray`, `definitionOps`) | 443 | **447** | **+4** | **0** |

```
$ npx vitest run …/phaseVocabulary.test.ts …/canvasModel.test.ts …/canvasModel.purity.test.ts \
      …/canvasModel.roundtrip.test.ts …/canvasModel.fixtures.test.ts …/PhaseSpineGraph.test.tsx \
      …/PhaseSpine.test.tsx …/PhaseNodeCard.test.tsx
 Test Files  8 passed (8)
      Tests  998 passed (998)

$ npx vitest run …/WorkflowCanvas.test.tsx …/PublishGauntlet.test.tsx \
      src/pages/WorkflowBuilderPage.canvas.test.tsx …/ProblemsTray.test.tsx …/definitionOps.test.ts
 Test Files  5 passed (5)
      Tests  447 passed (447)
```

**"No shipped file's count may drop" is proved structurally, not inferred from a total.** Of the 13
files across both sets, only three are touched by this round at all:

```
$ git diff --name-only ee5fff3b HEAD -- <the 13 files of both named sets>
frontend/src/components/workflows/definitionOps.test.ts
frontend/src/components/workflows/phaseVocabulary.test.ts
frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
```

The other **ten are byte-identical to the base**, so their counts cannot have moved. And the two
set deltas are exactly the two touched files' own growth (+18 in set A is `phaseVocabulary.test.ts`;
+4 in set B is `definitionOps.test.ts`), which leaves no room for a compensating drop elsewhere.
`WorkflowBuilderPage.canvas.test.tsx` was modified but **added no case** — confirming 187-17's claim
that no other row of that suite moved:

```
$ git show ee5fff3b:…/WorkflowBuilderPage.canvas.test.tsx | grep -cE '^[[:space:]]*(it|test)(\.each\(|\.skip)?\('
110
$ git show HEAD:…/WorkflowBuilderPage.canvas.test.tsx      | grep -cE '^[[:space:]]*(it|test)(\.each\(|\.skip)?\('
110
```

### (l) The closure round's own five suites — before and after

The plan's `<verify>` command, run now:

```
$ cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx \
      src/components/workflows/definitionOps.test.ts \
      src/components/workflows/phaseVocabulary.test.ts \
      src/components/workflows/phaseVocabulary.corpus.test.ts \
      src/components/workflows/StepTypePicker.test.tsx
 Test Files  5 passed (5)
      Tests  452 passed (452)
```

Then each file run **individually**, so the per-file "after" is a measurement and not a share of a
total:

| Suite | **After (run now)** | Declared case literals, base → HEAD | Δ | **Before, derived** | 187-16/17/18 SUMMARY | Agree? |
|---|---|---|---|---|---|---|
| `SeedReceipt.test.tsx` | **47 passed** | 33 → 47 | **+14** | 33 | 33 → 47 | ✅ |
| `definitionOps.test.ts` | **227 passed** | 113 → 117 | **+4** | 223 | 223 → 227 | ✅ |
| `phaseVocabulary.test.ts` | **90 passed** | 60 → 78 | **+18** | 72 | — (reported as a pair) | ✅ |
| `phaseVocabulary.corpus.test.ts` | **45 passed** | 14 → 17 | **+3** | 42 | — (reported as a pair) | ✅ |
| *the pair, as 187-17 reports it* | **135** | — | **+21** | 114 | 114 → 135 | ✅ |
| `StepTypePicker.test.tsx` | **43 passed** | 29 → 36 | **+7** | 36 | 36 → 43 | ✅ |
| **all five together** | **452 passed, 0 failed** | — | **+42** | 410 | — | — |

**How the "before" column is a measurement.** The Δ column is measured now by counting declared test
literals in the base blob and the HEAD blob (`git show <rev>:<path> | grep -cE …`) — a command run
at this commit, over the real base content, not a transcription. Every one of those five deltas
matches the run-count delta the corresponding SUMMARY reports, so "before" = "after − Δ" is derived
rather than inherited. ⚠ The absolute literal counts do **not** equal run counts (`it.each`
expands one literal into several cases), which is why only the **deltas** are used as the
instrument; the absolute before-values are derived from the measured after-values.

**Disagreements found: none.** Every figure the three SUMMARYs record was reproduced independently
here. Had any differed, both would appear above with this re-run marked as the measurement.

### (m) `tsc -b` — no NEW error, none in the touched files

```
$ cd frontend && npx tsc -b ; echo $?
2
$ grep -c 'error TS' <output>                                → 33
$ grep -c 'src/components/workflows/' <output>               → 0
$ grep -c 'src/pages/WorkflowBuilderPage' <output>           → 0
```

| | Before (= §e, and the base by §h) | **After (measured now)** |
|---|---|---|
| total `error TS` lines | 33 | **33** — zero delta |
| errors in `src/components/workflows/` | 0 | **0** |
| errors in `src/pages/WorkflowBuilderPage*` | 0 | **0** |

⚠ **`tsc -b` has never exited 0 on this repo** (`D-ITEM-01`) — the criterion is *no NEW error, none
in the touched files*, not a clean exit. ⚠ `tsc -b` ≠ `--noEmit` (the v3.3 lesson); the buildinfo
path is the one run. A stronger statement than "0 in `components/workflows/`" also holds: the 33
errors live in **19 files** (`useMessages.test.ts` 5, `ChatAreaMode.test.tsx` 4, `FilePreview.test.tsx` 3,
`FilesSection.test.tsx` 3, `OrgProvider.test.tsx` 2, `SettingsPage.tsx` 2, `SkillFormDialog.tsx` 2,
and 12 singles), and **not one of them is among the four source files this round modified.**

### (n) `vite build`

```
$ cd frontend && npx vite build ; echo $?
✓ built in 7.24s
0
```

**Exit 0.**

### (o) No false completion record

```
$ git status --porcelain .planning/REQUIREMENTS.md .planning/STATE.md .planning/ROADMAP.md
                                            ← (empty — 0 lines)
```

Neither `requirements.mark-complete`, `state.advance-plan` nor `roadmap.update-plan-progress` was
called from any executor in this round — all three write false records in this project.

**Stated rather than left to be discovered:** `git diff --name-only ee5fff3b HEAD` *does* list
`.planning/STATE.md` and `.planning/ROADMAP.md`. Those are the **orchestrator's** own tracking write
(commit `ce68aacd`, `docs(phase-187): update tracking after gap-closure wave 1`), which is whose job
it is. No executor wrote them, none is dirty now, and `REQUIREMENTS.md` was not touched at all —
its VOCAB-01/02/03 rows still read Pending, which is correct until re-verification says otherwise.

### What this round proved — and what it did NOT

**Proved.** The four findings it was scoped to (CR-01, CR-02, WR-02, WR-03) are closed by code, each
behind a falsification observed RED before its fix. No migration, no mount-cap spend, no new `tsc`
error, a clean `vite build`, both named sets up by exactly the cases added, and no shipped test count
anywhere in either set reduced.

**Not proved.**

- **Nothing on the manual board.** All **twelve** rows — M1–M8 and the four new M9–M12 — remain
  **UNPERFORMED**. They are the operator's. M3 is now *unblocked*, which is not the same as done.
- **The three ❌ SC#10 rows are untouched.** OpenRouter's non-deterministic name drop, OpenAI's
  `gpt-5.6-sol` endpoint refusal and MiniMax's non-emission are provider-side; no frontend fix in
  this round could move them and none tried.
- **Seven findings remain open.** WR-01, WR-04, WR-05, WR-06, WR-07 and IN-01…IN-05 were out of
  scope by the operator's own routing and are unchanged in `187-REVIEW.md`.
- **The wider-glob flake is still there.** `PublishGauntlet.test.tsx` / `WorkflowCanvas.test.tsx`
  axe cases fail non-deterministically under whole-glob parallel load and pass in isolation
  (`D-ITEM-02`). Both files are inside the named sets above and green there. Not this round's, not
  chased.
- **The backend was not re-run and did not need to be** — this round committed **zero** backend
  files. §(d)'s pre-existing-rot record stands unchanged.

---

## The gap-closure round 3 — 2026-08-03

`187-VERIFICATION.md`'s **re-verification** (commit `fb3b3f42`) re-scored the phase at
**`gaps_found`, 10/11 must-haves**. Round 2's blocker (CR-01 + CR-02) was confirmed closed, but
truth **#5 (VOCAB-02 Req 5)** failed again for a *narrower and different* reason: the sentence
round 2's own fix introduced — `seedReceiptCarriedLead` — shipped with **zero test assertions**
anywhere in the repo (**CR-03**, a Blocker) and **misattributed the `escalated` cause** to *"by its
own settings"*, contradicting `seedReceiptStepReason("escalated")` two lines below it on the same
card (**WR-09**, a Warning that is the substantive half of the failed truth).

| Plan | Finding it closes | Severity as recorded | Wave |
|---|---|---|---|
| **187-20** | **CR-03** (the carried paragraph is unguarded — it could be deleted, show the wrong count, or drift from its formatter with all 452 tests green) + **WR-09** (the carried sentence is false of one of the two causes it counts) | 🛑 Blocker (CR-03) + ⚠️ Warning (WR-09) — together the *only* reason truth #5 still failed | 7 |
| **187-21** | this record — round 3's own rows, the probes, the re-measured gates, the M3/M9 repairs and the new M13 | — | 8 |

**Scope discipline, stated rather than implied.** Round 3 is scoped to **CR-03 and WR-09 only**.

- **WR-08 was NOT closed by this round.** It was one of round 2's four scoped items — the `＋`
  picker's preview still cannot see a template asset, because `StepTypePickerProps`
  (`StepTypePicker.tsx:90-101`) carries **no `nameContext` field at all**. The operator's decision
  was to **roll WR-08 into Phase 188**, not to absorb it here. It is named so no reader can infer
  it was quietly swept in, and the fence is **measured** below (§(ac)), not promised. M12's
  round-2 warning about it therefore still stands and is still owed.
- **WR-01, WR-04, WR-05, WR-06, WR-07 and IN-01…IN-05 remain carried forward**, unchanged in
  `187-REVIEW.md`, none silently absorbed and none silently dropped.

**Base commit for every gate in this section: `f632f9b6`** (`docs(187): plan gap-closure round 3 —
CR-03 blocker + WR-09`) — the tip immediately before `debced07`, round 3's first commit:

```
$ git log --oneline -5
43b8c6dd docs(187-20): complete the CR-03 + WR-09 gap-closure plan
7593fe8b test(187-20): a standing testid-coverage guard, proved by four falsification probes
51a60299 fix(187-20): the carried sentence attributes no cause — WR-09 by deletion
debced07 test(187-20): observe the carried paragraph RED — CR-03 coverage gap + WR-09 cause fence
f632f9b6 docs(187): plan gap-closure round 3 — CR-03 blocker + WR-09
```

This base is **different from both** `35261e96` (the phase base, §"Phase gates — measured") **and**
`ee5fff3b` (round 2's base, §"Phase gates — gap-closure round"). All three are stated so that no
figure anywhere in this file is ambiguous about which range it measures.

### (p) Per-task verification rows — 187-20

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| **187-20-T1** | **20** | **7** | VOCAB-02 (Req 5) | T-187-20-01/02 | The WR-09 cause fence is **observed RED against the shipped sentence** before any source edit — 3 failed / 54 passed (57), signature transcribed verbatim in §(q) preamble | falsification | `cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx` | ✅ | ✅ green (after T2) — **RED first at `debced07`, by design** |
| **187-20-T2** | **20** | **7** | VOCAB-02 (Req 5) | T-187-20-01/03/04 | **WR-09 closed by DELETION** — the `" by its own settings"` clause is gone, so the one sentence counting `already-set` **and** `escalated` claims only what both causes genuinely share; the cause is stated per row by the one function actually handed it. **CR-03 closed** — presence, COUNT (derived from `SEALED_SLUGS.length - DETECTED_SLUGS.length`, never a hand-typed `1`), character-identity against `seedReceiptCarriedLead`, and both zero cases | unit + render + copy lock | `cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx src/components/workflows/definitionOps.test.ts` | ✅ | ✅ green — 288 passed (60 + 228), 0 failed |
| **187-20-T3** | **20** | **7** | VOCAB-02 (Req 5) | T-187-20-05 | A **standing** testid-coverage guard: the suite reads its own source via `./SeedReceipt.test?raw` and asserts every static `data-testid` the component renders is queried by this suite, with the needle **assembled per-id at runtime** so the guard's own source cannot satisfy it; non-vacuity asserted; `seed-receipt-carried` named explicitly. Proved by five falsification probes, §(q) | falsification ×5 + source-fence guard | `cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx` | ✅ | ✅ green — 60 passed, 0 failed |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### (q) PROBE — the five falsification probes, and why they are what makes round 3 different

⚠ **The probe count on file is FIVE, not the three this plan's `key_links` says nor the four its
task action says.** 187-20 added **PROBE C2** during execution (its deviation `D-20-C`) because
PROBE C could not answer the question the plan was asking. The measured set is recorded, not the
planned one: **A · B · C · C2 · D**. No probe is compressed away to match a plan's wording.

**Why this section exists at all.** Round 2's own recorded lesson was *"green over an
unrepresentable fixture is not coverage"* — and round 2's fix then shipped protected by **no
fixture at all** (that is CR-03, verbatim). A guard that has never been seen to fail is
indistinguishable from a guard that cannot fail. **A probe observed RED is the only evidence a
guard bites.** Every probe below was reverted with `git diff --quiet -- frontend/` **exit 0**, so
none of them is in the shipped tree.

**The Task-1 RED, transcribed** (the WR-09 cause fence, run against the *shipped* sentence at
`debced07`):

```
 FAIL  src/components/workflows/SeedReceipt.test.tsx > SeedReceipt — the carried paragraph > attributes the seal to NO CAUSE on the mixed draft
AssertionError: expected '1 step was already set to must prove …' not to contain 'by its own settings'

Expected: "by its own settings"
Received: "1 step was already set to must prove it by its own settings."

 FAIL  ... > nor on the already-set-only draft
 FAIL  ... > nor on the escalated-only draft, whose row says the opposite

 Test Files  1 failed (1)
      Tests  3 failed | 54 passed (57)
EXIT=1
```

#### PROBE A — delete the carried paragraph from `SeedReceipt.tsx`

```
     × renders it, character for character, over the CARRIED count
     × renders ALONE on the typical non-KB draft — no detected paragraph above it
     × renders on the draft whose only seal the AUTHOR escalated by hand
     × attributes the seal to NO CAUSE on the mixed draft
     × nor on the already-set-only draft
     × nor on the escalated-only draft, whose row says the opposite
     × the one-way lock never travels with it (D-185-07)
     × renders each sentence identically to its definitionOps export
TestingLibraryElementError: Unable to find an element by: [data-testid="seed-receipt-carried"]   (×8)
 Test Files  1 failed (1)
EXIT=1
```

Reverted: `git checkout -- frontend/src/components/workflows/SeedReceipt.tsx` →
`git diff --quiet -- frontend/` **exit 0**.

#### PROBE B — corrupt the count (`carriedCount = rows.length`)

This is the substitution CR-03 named explicitly — the pre-round suite could not see it at all.

```
     × marks the CARRIED count too — the seals this generation did NOT apply
     × the carried count reads 0 on a draft the AI grounded entirely by itself
     × renders it, character for character, over the CARRIED count
     × is ABSENT — no node at all — when every seal is one the AI detected
     × renders each sentence identically to its definitionOps export

AssertionError: expected '3 steps were already set to must prov…' to be '1 step was already set to must prove …' // Object.is equality
Expected: "1 step was already set to must prove it."
Received: "3 steps were already set to must prove it."
AssertionError: expected <p …(2)></p> to be null

 Test Files  1 failed (1)
      Tests  5 failed | 54 passed (59)
EXIT=1
```

Reverted: `git diff --quiet -- frontend/` **exit 0**; `SeedReceipt.tsx:213` back to
`const carriedCount = rows.length - detectedCount`.

#### PROBE C — drift the formatter text (`already set` → `already configured` in `definitionOps.ts`, no test touched)

```
     × the carried lead names the count and the SHIPPED governance words
     × ZERO carried steps yields NO carried paragraph — the same shape as its sibling
 FAIL  src/components/workflows/definitionOps.test.ts > definitionOps — the seed-receipt copy is a lock (sketch 150-B) > the carried lead names the count and the SHIPPED governance words
 FAIL  src/components/workflows/definitionOps.test.ts > ... > ZERO carried steps yields NO carried paragraph — the same shape as its sibling
 Test Files  1 failed | 4 passed (5)
      Tests  2 failed | 463 passed (465)
EXIT=1
```

`SeedReceipt.test.tsx` **stayed GREEN** — and 187-20's plan had prescribed, as an acceptance
criterion, that a green component suite here means *"the identity assertion is not doing its job
and must be repaired"*. **That prescription was REFUTED with evidence, not quietly skipped**
(187-20 deviation `D-20-A`, recorded on both sides here because it changes what a reader should
expect the shipped tests to do):

- The component assertion is `textContent === seedReceiptCarriedLead(n)`. PROBE C mutates the
  formatter — i.e. **both sides of that equation at once**. No assertion of the form
  `rendered === export` can detect a change that moves `rendered` and `export` together. That is
  arithmetic, not a weak assertion.
- The guard that *does* see PROBE C is the **exact-string unit lock** in `definitionOps.test.ts` —
  which fired, on both of its cases.
- Applying the prescribed repair would have required `SeedReceipt.test.tsx` to hold a **hand-typed
  literal of the copy**, which (a) contradicts that file's own docblock — *"never against a
  hand-typed copy, because a hand-typed copy drifts in exactly the same silence the copy module
  exists to break (T-187-13-05)"* — and (b) puts the copy lock in **two homes**, against this
  project's one-home-per-concern rule and the reason `definitionOps.ts` exists.
- **PROBE C2 was added instead**, and it is the probe that actually answers the question.

Reverted: `git diff --quiet -- frontend/` **exit 0**.

#### PROBE C2 — drift the COMPONENT away from the export (the probe the plan did not have)

`{carriedLead}` → `{carriedLead.replace("already set", "already configured")}` in `SeedReceipt.tsx`.

```
     × renders it, character for character, over the CARRIED count
     × renders ALONE on the typical non-KB draft — no detected paragraph above it
     × renders on the draft whose only seal the AUTHOR escalated by hand
     × renders each sentence identically to its definitionOps export
Expected: "1 step was already set to must prove it."
Received: "1 step was already configured to must prove it."   (×4)
 Test Files  1 failed (1)
      Tests  4 failed | 55 passed (59)
EXIT=1
```

**The identity assertion is doing its job** — it is the guard for component↔formatter
*disagreement*, which is exactly what C2 induces and exactly what C cannot. The pair is the
generalisable lesson: *a probe that mutates the SUBJECT and a probe that mutates the LINK ask
different questions; an identity assertion can only ever see the second.* Reverted:
`git diff --quiet -- frontend/` **exit 0**.

#### PROBE D — remove every carried query from the test file (does the guard guard itself?)

```
     × every STATIC testid the component renders is queried by this suite (187-20)
AssertionError: expected '/**\n * Phase 187-13 Task 2 — Req 5\'…' to contain 'ByTestId("seed-receipt-carried")'
 Test Files  1 failed (1)
      Tests  1 failed | 49 passed (50)
EXIT=1
```

**Exactly one failure, and it is the guard.** The removed cases vanish rather than fail, so nothing
else masks the signal. Reverted: `git diff --quiet -- frontend/` **exit 0**.

### (r) Which of the new assertions were GREEN on arrival — stated plainly, not implied

Round 3 was **not** a whole-block red-to-green cycle, and saying so would overstate it. Of the ten
cases 187-20 Task 1 added to the carried-paragraph block:

- **RED on arrival — 3.** The three cause-honesty fence cases. These are the WR-09 falsifier, and
  their signature is transcribed at the head of §(q).
- **GREEN on arrival — 7.** Presence/identity, alone-on-the-non-KB-draft, the escalated draft, both
  zero cases, the positive control and the one-way-lock case. They guard behaviour that was
  **already correct**; the paragraph simply had nothing asserting it — which is precisely what
  CR-03 was.

**What proves the always-green seven bite is the probes, not a red.** PROBE A deletes the
paragraph (8 red), PROBE B corrupts the count (5 red) and PROBE C2 drifts the component off the
export (4 red). Without §(q) this block would be seven assertions that have never been observed to
fail — the same shape as the defect it closes.

### (s) COVERAGE — the testid sweep, BEFORE and AFTER, both re-derived at this commit

The sweep is a per-id join: every **static** `data-testid` literal in `SeedReceipt.tsx` against the
number of `ByTestId("<that id>")` queries in `SeedReceipt.test.tsx`.

```bash
ids=$(grep -oE 'data-testid="[^"{]+"' src/components/workflows/SeedReceipt.tsx \
      | sed 's/data-testid="//; s/"$//' | sort -u)
for id in $ids; do grep -c "ByTestId(\"$id\")" src/components/workflows/SeedReceipt.test.tsx; done
```

**BEFORE — run against the base blobs** (`git show f632f9b6:<path>`), so this is a measurement made
now over the real base content, not a transcription of 187-20's table:

```
BASE f632f9b6 — static data-testid in SeedReceipt.tsx -> ByTestId("id") in SeedReceipt.test.tsx
------------------------------------------------------------------------------
  ok      15  seed-receipt
MISSING    0  seed-receipt-carried
  ok       2  seed-receipt-close
  ok       3  seed-receipt-dismiss
  ok       9  seed-receipt-grounded-list
  ok       2  seed-receipt-grounding
  ok       4  seed-receipt-heading
  ok       6  seed-receipt-lead
  ok       4  seed-receipt-one-way
  ok       3  seed-receipt-step-face
  ok       1  seed-receipt-step-reason
  ok       1  seed-receipt-step-seal
------------------------------------------------------------------------------
static ids: 12   uncovered: 1
SWEEP_EXIT=1
```

**It reproduces 187-20's BEFORE table cell for cell** — an agreement between two independent
measurements, not a copied number. CR-03 itself reproduces the same way:

```
$ git show f632f9b6:frontend/src/components/workflows/SeedReceipt.tsx | grep -n "seed-receipt-carried"
276:          data-testid="seed-receipt-carried"
$ git show f632f9b6:frontend/src/components/workflows/SeedReceipt.test.tsx | grep -n "seed-receipt-carried"
(no hits — the CR-03 gap, reproduced)
$ git grep -n "seed-receipt-carried" f632f9b6 -- 'frontend/src'
f632f9b6:frontend/src/components/workflows/SeedReceipt.tsx:276:          data-testid="seed-receipt-carried"
```

**Exactly one hit in the whole of `frontend/src`, and it is the component's own attribute.**

**AFTER — the same sweep, run now at the round-3 tip:**

```
static data-testid in SeedReceipt.tsx -> ByTestId("id") count in SeedReceipt.test.tsx
------------------------------------------------------------------------------
  ok      18  seed-receipt
  ok      11  seed-receipt-carried
  ok       2  seed-receipt-close
  ok       3  seed-receipt-dismiss
  ok       9  seed-receipt-grounded-list
  ok       3  seed-receipt-grounding
  ok       4  seed-receipt-heading
  ok       6  seed-receipt-lead
  ok       5  seed-receipt-one-way
  ok       3  seed-receipt-step-face
  ok       1  seed-receipt-step-reason
  ok       1  seed-receipt-step-seal
------------------------------------------------------------------------------
static ids: 12   uncovered: 0
SWEEP_EXIT=0
```

`seed-receipt-carried` moved **0 → 11 queries**; `static ids` is unchanged at **12** and
`uncovered` is **0**. The dynamic `data-testid={`seed-receipt-step-${row.slug}`}` is a template
literal, correctly excluded from a *static* extraction; its rows are covered by the per-slug queries
in section 1 (`-emit`, `-contracts`, `-policy_check`, `-judgement`, `-archive`).

**One disagreement with 187-20's SUMMARY, recorded on both sides — the re-run is the measurement.**
That SUMMARY prints `grep -c "seed-receipt-carried" …/SeedReceipt.test.tsx` → **12** under its
*Final gates* heading. Measured now it is **14**, and the cause is a commit-attribution slip rather
than a wrong number:

```
$ for r in 51a60299 7593fe8b HEAD; do git show $r:frontend/src/components/workflows/SeedReceipt.test.tsx | grep -c "seed-receipt-carried"; done
12
14
14
```

**12 is the value at `51a60299` (Task 2), not at the Task-3 tip where the block is presented** — the
guard added at `7593fe8b` contributes the two extra lines. Nothing about the closure changes; the
figure is corrected here so a later reader re-running the command does not think the tree moved.

### (t) GATES — the five named suites, count-guarded

⚠ Run **isolated**, never as part of the full frontend suite (measured 42–49 failures, flaky at one
commit). The Phase-177 lesson applies: the **COUNT** is the gate, not only the failure number.

```
$ cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx \
      src/components/workflows/StepTypePicker.test.tsx \
      src/components/workflows/phaseVocabulary.test.ts \
      src/components/workflows/phaseVocabulary.corpus.test.ts \
      src/components/workflows/definitionOps.test.ts
 Test Files  5 passed (5)
      Tests  466 passed (466)
EXIT=0
```

**Files 5 · passed 466 · failed 0.** Against round 2's `452` for this same five-file set (§(l)),
**the total ROSE by exactly +14** — strictly greater, so no suite was replaced rather than extended.

**The 452 baseline is re-derived here, not inherited.** Declared case literals counted in the base
blob and the HEAD blob (`git show <rev>:<path> | grep -cE '^[ \t]*(it|test)(\.each\(|\.skip)?\('`):

| Suite | literals `f632f9b6` → `HEAD` | Δ | **Run count now** |
|---|---|---|---|
| `SeedReceipt.test.tsx` | 47 → 60 | **+13** | **60 passed** (`npx vitest run …/SeedReceipt.test.tsx`) |
| `definitionOps.test.ts` | 117 → 118 | **+1** | **228 passed** (`npx vitest run …/definitionOps.test.ts`) |
| `phaseVocabulary.test.ts` | 78 → 78 | **0** | — untouched by this round |
| `phaseVocabulary.corpus.test.ts` | 17 → 17 | **0** | — untouched by this round |
| `StepTypePicker.test.tsx` | 36 → 36 | **0** | — untouched by this round (and see §(ac)) |
| **total Δ** | — | **+14** | **466** |

`466 − 14 = 452`, which is round 2's recorded figure for the identical command — so "before" is
**derived from a measurement taken now**, not transcribed. ⚠ Absolute literal counts do not equal
run counts (`it.each` expands one literal into several cases), which is why only the **deltas** are
used as the instrument. Three of the five files are byte-identical to the base, so their counts
cannot have moved and there is no room for a compensating drop.

### (u) The count gate — and an honest correction to 187-20's own reading of it

```
$ node scripts/vitest-count-gate.cjs
  SeedReceipt.test.tsx                          —      60     new
  definitionOps.test.ts                         —     228     new
  total                                       415    2089   +1674
  total 2089  ·  failed 0  ·  pinned total 415
count gate OK — 16/16 pinned files present, no per-file decrease, 0 failing.
GATE_EXIT=0
```

**Exit 0 at the round-3 tip.** 187-20's SUMMARY records the same gate, on the same tree, exiting
**1** with a single `[failing-tests]` reason (two `PublishGauntlet.test.tsx` cases). Both are
recorded, and the divergence is itself the evidence:

- **The failure is PRE-EXISTING and non-deterministic — proved, not assumed.** 187-20 copied its
  four edited files aside, restored them to `debced07~1` (the pre-plan state) with `git checkout`,
  re-ran the gate — **total 2075, failed 1, the same two `PublishGauntlet.test.tsx` cases** — then
  restored from the copies (no `git stash`, no `git clean`; both are forbidden here). The file
  passes **green in isolation**, the failure count varies run to run (2 → 1 → **0** counting this
  re-run), and it imports nothing from `definitionOps` or `SeedReceipt`. Logged as
  `D-ITEM-187-20-01` in `deferred-items.md`, alongside the older `D-ITEM-02`.
- **This round did not cause it and this round did not fix it.** A third sample landing at 0 is a
  property of the flake, not a repair. The gate is **not** presented as clean by this round; it is
  presented as *pre-existing-flaky, sampled three times, currently 0*.
- In no sample did the gate report `[count-decrease]`, `[missing-file]` or `[total-below-baseline]`
  — the reasons that would indicate real coverage loss.

**The pin file was not edited by this round:**

```
$ git status --porcelain scripts/vitest-count-gate.cjs      ← (empty)
$ git diff --name-only f632f9b6 HEAD -- scripts/            ← (empty)
```

### (v) `tsc -b` — no NEW error, none in the touched files

```
$ cd frontend && npx tsc -b ; echo $?
2
$ grep -c 'error TS' <output>                        → 33
$ grep -c 'src/components/workflows/' <output>       → 0
$ grep -c 'src/pages/WorkflowBuilderPage' <output>   → 0
```

| | Before (187-20's re-measured pre-change baseline at `f632f9b6`) | **After (measured now)** |
|---|---|---|
| total `error TS` lines | 33 | **33** — zero delta |
| errors in `src/components/workflows/` | 0 | **0** |
| errors in `src/pages/WorkflowBuilderPage*` | 0 | **0** |

⚠ **`tsc -b` has never exited 0 on this repo** (`D-ITEM-01`) — the criterion is *no NEW error, none
in the touched files*, not a clean exit. ⚠ **`tsc -b` ≠ `tsc --noEmit`** (the v3.3 lesson); the
buildinfo path is the one run.

### (w) `vite build`

```
$ cd frontend && npx vite build ; echo $?
✓ built in 4.69s
0
```

**Exit 0.**

### (x) The zero-migration gate — re-measured for this round

```
$ git diff --stat 35261e96 HEAD -- supabase/migrations     ← (empty — 0 lines)
$ git diff --stat f632f9b6 HEAD -- supabase/migrations     ← (empty — 0 lines)
$ git status --porcelain supabase/migrations               ← (empty — 0 lines)
```

**All three empty.** Measured from the **phase** base *and* the **round-3** base, so truth #11
(*"Zero migrations added by this phase, including the closure rounds"*) survives round 3 on its own
evidence rather than on round 2's.

### (y) The D-187-14 mount cap — re-measured for this round, unmoved

```
$ git diff --numstat f632f9b6 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx
                                            ← (empty — the file is UNTOUCHED by this round)
```

Pasted verbatim: the command produces **no output at all**. The phase shipped this file at its cap
(46 ins / 5 del, §(a2)); round 2 spent **0** of it (§(j)); round 3 spends **0** of it as well. The
cap is neither renegotiated nor consumed. Both of this round's source-bearing commits landed inside
`components/workflows/`, not at the mount.

### (z) The backend fence

```
$ git diff --name-only f632f9b6 HEAD -- backend/           ← (empty)
```

**Zero backend files.** §(d)'s pre-existing-rot record stands unchanged and the backend suite was
neither re-run nor needed.

### (aa) The full file list for the round — measured, not asserted

```
$ git diff --name-only f632f9b6 HEAD
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-20-SUMMARY.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md
frontend/src/components/workflows/SeedReceipt.test.tsx
frontend/src/components/workflows/SeedReceipt.tsx
frontend/src/components/workflows/definitionOps.test.ts
frontend/src/components/workflows/definitionOps.ts
```

**Four source files, both planning documents, nothing else.** (This list is measured *before*
187-21's own doc commits, which add this file and `187-21-SUMMARY.md`.)

### (ab) No false completion record

```
$ git status --porcelain .planning/REQUIREMENTS.md .planning/ROADMAP.md   ← (empty — 0 lines)
```

Neither `requirements.mark-complete`, `state.advance-plan` nor `roadmap.update-plan-progress` was
called from any executor in this round — all three write false records in this project.

⚠ **Stated rather than left to be discovered:** `git status --porcelain .planning/STATE.md` is
**not** empty during this round — `git diff --stat -- .planning/STATE.md` reports
`1 file changed, 5 insertions(+), 5 deletions(-)`. That is the **orchestrator's** own tracking
write, which is whose job it is; no executor in this round read, wrote or committed `STATE.md`, and
`REQUIREMENTS.md` was not touched at all — its VOCAB-01/02/03 rows still read Pending, which is
correct until re-verification says otherwise.

### (ac) The WR-08 out-of-scope fence — measured, not promised

```
$ git diff --stat f632f9b6 HEAD -- frontend/src/components/workflows/StepTypePicker.tsx \
                                    frontend/src/components/workflows/StepTypePicker.test.tsx
                                            ← (empty — 0 lines)
```

**Both files untouched.** WR-08 is not closed, not partially closed and not absorbed — it is the
operator's decision to roll into **Phase 188**, and the diff proves the round respected that fence
rather than merely claiming to. `StepTypePicker.test.tsx`'s literal count is unchanged at 36 (§(t)),
so nothing moved there by accident either.

### (ad) D-187-10 and D-187-08 — the two decisions this round could have quietly broken

Both are recorded with measured evidence rather than asserted, because a fix that adds a paragraph
and a fix that adds a derivation are exactly how each of these decisions dies.

**D-187-10 — the zero-carried arrival is WHOLE, not an empty paragraph.** The carried formatter
returns the **empty string** at zero, which is the one conditional shape both paragraphs share, so
the component renders **no node at all** rather than an empty `<p>`:

```
$ grep -n 'queryByTestId("seed-receipt-carried")' frontend/src/components/workflows/SeedReceipt.test.tsx
530:    expect(screen.queryByTestId("seed-receipt-carried")).toBeNull()
538:    expect(screen.queryByTestId("seed-receipt-carried")).toBeNull()
```

`SeedReceipt.test.tsx:525-541` — two cases, *"is ABSENT — no node at all — when every seal is one
the AI detected"* and *"is ABSENT on a draft where nothing is sealed at all"* — each pairing the
`toBeNull()` with `expect(seedReceiptCarriedLead(0)).toBe("")`, so the absence is proved at the
formatter **and** in the DOM. The receipt itself still arrives: section 2 of the same file
(`:593`, *"ZERO GROUNDED STEPS — the receipt still arrives (D-187-10)"*) asserts
`seed-receipt` is in the document with its **heading** and its **closing line** intact. The
manual counterpart is **M10**, unchanged and still owed; the new **M13** covers the mirror case.

**D-187-08 — no second grounding derivation was added.** `groundingCauseOf` remains the ONE home:

```
$ grep -rn 'export function groundingCauseOf' frontend/src/
frontend/src/components/workflows/phaseVocabulary.ts:343:export function groundingCauseOf(

$ grep -c 'groundingCauseOf' frontend/src/components/workflows/SeedReceipt.tsx        → 5   (calls, no definition)
$ grep -cE 'search_documents|list_documents|read_document' frontend/src/components/workflows/SeedReceipt.tsx  → 0
$ grep -c 'D-187-08' frontend/src/components/workflows/SeedReceipt.tsx                → 4
```

**Exactly one definition site in the whole of `frontend/src`, and it is not in the receipt.** The
component still only renders what it is handed — zero KB tool ids appear in it — and
`seedReceiptStepReason` classifies nothing: it `switch`es on the cause it is given
(`definitionOps.ts:660-676`). Round 3 changed the *carried lead's wording* and added *assertions*;
it added no decision-making anywhere.

### What round 3 proved — and what it did NOT

**Proved.** CR-03 and WR-09 are closed by code. The carried paragraph now has the same rigor its
sibling already had — presence, a count derived from fixture constants rather than a hand-typed
literal, character-identity against its `definitionOps` export, and both zero cases — plus a
**standing** coverage guard that fails if any future static testid goes unqueried. Five probes were
observed RED and cleanly reverted, so no guard in this block is one that has never been seen to
fail. Zero migrations, zero mount-cap spend, zero backend files, zero `tsc` delta, `vite build`
exit 0, and the five-suite total up +14 with nothing dropped.

**Not proved.**

- **Nothing on the manual board.** All **thirteen** rows (M1–M13) remain **UNPERFORMED**. They are
  the operator's. M3 is now *unblocked and repaired*, which is not the same as done.
- **WR-08 is still open** and is Phase 188's, by the operator's routing (§(ac)). M12's warning about
  it still stands and is still owed.
- **Seven findings remain open** — WR-01, WR-04, WR-05, WR-06, WR-07 and IN-01…IN-05, unchanged in
  `187-REVIEW.md`.
- **The three ❌ SC#10 rows are untouched.** OpenRouter's non-deterministic name drop, OpenAI's
  `gpt-5.6-sol` endpoint refusal and MiniMax's non-emission are provider-side; no frontend change in
  this round could move them and none tried.
- **The `PublishGauntlet.test.tsx` parallel-run flake is still there** (`D-ITEM-187-20-01`,
  `D-ITEM-02`). This round's gate sample happened to land at 0 failing; that is a sample, not a fix.
- **`SeedReceipt.test.tsx` is still blind to a formatter-internal word swap that moves the component
  and the export together** (PROBE C). That is deliberate — the copy lock lives in exactly one home,
  `definitionOps.test.ts`, which *did* go red on PROBE C. Recorded so a future reader does not
  rediscover it as a defect.

---

## The gap-closure round 4 — 2026-08-04

`187-VERIFICATION.md`'s round-3 re-verification re-scored the phase at **`gaps_found`, 10/11
must-haves**, with truth **#5 (VOCAB-02 / SPEC Req 5)** failing for a *third* time and for a third
distinct reason. Rounds 2 and 3 had both fixed the class by editing **what the copy SAYS**. CR-04 is
the same failure one layer down: a **data-flow** defect. Every sentence on the seed receipt is
past-tense and first-person (*"Here's what I built"*, *"so I set them to must prove it"*), but its
data source was a **live store selector** — so a post-arrival edit in the sibling inspector, on the
same screen, made the card claim the author's own act as the AI's.

| Plan | Findings it closes | Severity as recorded | Wave |
|---|---|---|---|
| **187-22** | **CR-04** — the receipt renders a live selector rather than a snapshot of the generation, across **three** input paths (KB-tool edit, added step, grounding dial) | 🛑 Blocker | 9 |
| **187-23** | **WR-11** (the escalated row says *"you turned this on by hand"* — an actor claim its input, a bare boolean, cannot support) + **WR-15** (a 4th `GroundingCause` renders a seal with a dangling em-dash and no reason) | ⚠️ Warning ×2 | 10 |
| **187-24** | **WR-12** (the WR-09 fence is a deny-list of two literal clauses, blind to any other wording) + **WR-13** (the testid sweep measures mentions, not coverage) + **WR-14** (a second KB-tool membership derivation, one line from the first) | ⚠️ Warning ×3 | 11 |
| **187-25** | **WR-16** (the suites carrying this entire estate are unpinned in the count gate — every guard above is deletable with the gate green) + this record | ⚠️ Warning | 12 |

**Scope discipline, stated rather than implied.** Round 4 is scoped to **CR-04 and WR-11…WR-16
only**.

- **IN-11, IN-12, IN-13 and IN-14 were SHOWN to the operator and left OUT of this round by
  decision.** They are named here so no reader can infer any of them was absorbed.
- **WR-08 remains routed to Phase 188**, unchanged from round 3's §(ac). It was not closed, not
  partially closed and not absorbed by this round either.
- **WR-01, WR-04, WR-05, WR-06, WR-07 and IN-01…IN-05 remain carried forward**, unchanged in
  `187-REVIEW.md`, none silently absorbed and none silently dropped.

**Base commit for every gate in this section: `7a1b427e`** (`docs(187): record round-4 gap-closure
planning (25 plans, 12 waves)`) — the tip immediately before `fbf07b49`, round 4's first commit:

```
$ git rev-parse --short fbf07b49~1
7a1b427e
```

This base is **different from all three** earlier bases: `35261e96` (the phase base,
§"Phase gates — measured"), `ee5fff3b` (round 2) and `f632f9b6` (round 3). All four are stated so
that no figure anywhere in this file is ambiguous about which range it measures.

### (ae) Per-task verification rows — 187-22, 187-23, 187-24

> Every command below is the plan's own `<verify>` command. Results are **transcribed** from the
> three SUMMARYs, each measured at the commit named in its row — this task does not re-derive figures
> those plans already measured. The **gates** in §(ah) *are* re-measured at the round-4 tip.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Measured at | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| **187-22-T1** | **22** | **9** | VOCAB-02 (Req 5) | T-187-R4-01/02 | **CR-04 observed RED before any fix** — three post-arrival edits each move the card. Exactly the 3 new cases failed; **all 113 pre-existing cases still passed**. Every failure is a text/count mismatch against the captured arrival baseline, never a selector or timeout error. Path 1's observed text contains *"so I set"* — the authorship claim, printed over the author's own edit | falsification (page-level) | `cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx` | `fbf07b49` | ✅ green (after T2) — **RED first, by design**: 3 failed / 113 passed (116) |
| **187-22-T2** | **22** | **9** | VOCAB-02 (Req 5) | T-187-R4-02/03/04 | **CR-04 closed in the CALLER** — `receiptPhases`, an arrival snapshot captured beside the single `setDrafted` transition, replaces the live selector at the `<SeedReceipt>` mount. One mechanism closes all three input paths at once. The immutability precondition (T-187-R4-04) was **verified at live source** across all seven store ops before the fix was written — every one spreads or maps, none mutates — so the alias needs no defensive copy | unit + render | `cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx src/components/workflows/SeedReceipt.test.tsx src/components/workflows/definitionOps.test.ts` | `ef4e59e7` | ✅ green — 404 passed, 0 failed |
| **187-22-T3** | **22** | **9** | VOCAB-02 (Req 5) | T-187-R4-02/05 | **Standing fences** — the leaf is a *replaceable* pure projection (4 `rerender(`-based cases, up from **0**) plus a `builderSource` pin proving the mount is handed the snapshot and the snapshot is taken beside `setDrafted`. Needles assembled from parts so a grep of the guard cannot satisfy the guard | source fence + rerender fences | `cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx src/pages/WorkflowBuilderPage.canvas.test.tsx` | `4b0fe96e` | ✅ green — 180 passed (117 + 63), 0 failed |
| **187-23-T1** | **23** | **10** | VOCAB-02 (Req 5) | T-187-R4-06/08/09 | **WR-11 closed** — `it was set to must prove it by hand`, composed from `GOVERNANCE_SEAL_LABEL` rather than hand-typed, names **no actor**. **WR-15 closed** — `case null:` became its own arm and `default:` binds the residual to `never`, so a 4th `GroundingCause` is a **typecheck error at the formatter** rather than a seal with a dangling em-dash. The Phase-185 lesson applied literally: a deny-list cannot be made fail-closed by extension | unit (expected RED) | `cd frontend && npx vitest run src/components/workflows/definitionOps.test.ts src/components/workflows/SeedReceipt.test.tsx` | `f59af16a` | ✅ green (after T2) — **exactly ONE case RED first**, the character-identity pin; signature in §(af) |
| **187-23-T2** | **23** | **10** | VOCAB-02 (Req 5) | T-187-R4-06/08 | The no-second-person **PROPERTY** (`/\b(you\|your\|yours\|yourself)\b/i`) with **two positive controls** — one a sentence the module genuinely still produces — and **three negative controls** (`youthful`, `young`, `beyond`) proving word-boundary anchoring; the WR-15 pin in **two halves** (runtime totality + `?raw` source, because the runtime half cannot see a compile-time guard); and the DOM no-empty-reason invariant over all three sealed fixtures plus the consequence (no row ends at the em-dash) | property + source fence + DOM invariant | same | `7b1356c3` | ✅ green — 297 passed (231 + 66), 0 failed |
| **187-24-T1** | **24** | **11** | VOCAB-01/02 | T-187-R4-10/13 | **WR-14 closed** — the `available_tools ∩ kbTools` membership test is **extracted to one body** (`firstKbTool`) read by BOTH `groundingCause` and the new `intersectingKbToolOf`, so agreement is by construction rather than by coincidence. Pinned by an **agreement biconditional** over a 12-phase table (a step is `detected` **iff** it carries a dial **and** the resolver names a tool) carrying a **case-differing** tool id so the property has an input that can fail | unit + agreement property + source fence | `cd frontend && npx vitest run src/components/workflows/phaseVocabulary.test.ts src/components/workflows/SeedReceipt.test.tsx` | `c4972bde` | ✅ green — `phaseVocabulary` 90→**96**, `SeedReceipt` 66→**68** |
| **187-24-T2** | **24** | **11** | VOCAB-02 (Req 5) | T-187-R4-11 | **WR-12 closed** — the fence is now a **word-class PROPERTY** over causal connectives with four negative controls; the two historical wordings stay **beneath** it as regression pins, no longer as the fence. It carries a **positive control over its own needles inside the same `it`** (built by welding the deleted clause back on, never hand-typed), because a control in a sibling case can be deleted and leave the absences standing alone — which is how the fence shipped in the first place. Net-new: the property over the whole representable count domain (0–30, negative, fractional, `NaN`, `Infinity`, `MAX_SAFE_INTEGER`) | property + positive control | `cd frontend && npx vitest run src/components/workflows/definitionOps.test.ts` | `576a0e31` | ✅ green — 231→**232** |
| **187-24-T3** | **24** | **11** | VOCAB-02 (Req 5) | T-187-R4-12 | **WR-13 closed** — the sweep measures COVERAGE, not mentions: extraction widened to all three static spellings, comments stripped from `testSource` before the substring check, and the sibling `data-*` state-attribute class swept in its **own `it`** (a guard folded into its sibling can be deleted without the count moving — the Phase-177 shape). `it("those fences are real")` gained the planted literals it never had, including a **NON-FIRING control** over the dynamic row testid | coverage sweep + planted-literal controls | `cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx` | `17c6e338` | ✅ green — 67→**68** |
| **187-25-T1** | **25** | **12** | VOCAB-02 | T-187-R4-14/15/16 | **WR-16 closed** — `definitionOps.test.ts` (232) and `SeedReceipt.test.tsx` (68) are pinned in `BASELINE`, both numbers **read from the gate's own `actual` column** over two agreeing runs, each observed catching a deletion. The gate's hard-coded `16/16` success line is now derived. The stale docblock instruction is repaired in the same commit | pin + deletion probes ×2 | `node scripts/vitest-count-gate.cjs` | `4541a936` | ✅ green — exit 0, both at delta **0**, `18/18` |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### (af) PROBE — every falsification round 4 performed

**Why this section exists.** Round 3's own lesson was that *green over an unrepresentable fixture is
not coverage* — and round 3's CR-01 fix then shipped **its own new sentence with zero assertions**
(that is CR-03, verbatim). Round 4 inherited the same temptation twice over: WR-12 and WR-13 are both
findings that a **guard shipped without the control its own file mandates**. A guard that has never
been seen to fail is indistinguishable from a guard that cannot fail. **A probe observed RED is the
only evidence a guard bites.**

⚠ **The measured probe count for 187-24 is EIGHT, not the nine both its own SUMMARY and this
plan's task action state.** The decomposition *"two agreement/source, one WR-12 wording, five WR-13
sweep probes, and the sibling-attribute probe"* counts the sibling-attribute probe twice — it **is**
probe 5 of the five sweep probes (`data-row-tally`), not a ninth. The measured set is recorded, not
the planned one, exactly as round 3's §(q) did when its own probe count was misstated. Round-4 total:
**14 probes**, plus two expected task-level REDs.

| # | Plan | Mutation applied | Observed RED (verbatim) | Revert evidence |
|---|---|---|---|---|
| **RED-1** | 187-22 T1 | *(none — the SHIPPED code, before any fix)* | `× CR-04 path 1 — switching a KB tool ON afterwards does not make the card claim it` · `× path 2 — a step the AUTHOR adds is not counted by the card's heading` · `× path 3 — flipping the grounding dial ON afterwards does not join the carried count`. Path 1 received: `"…3 steps✕1 step reads your documents, so I set it to must prove it…"` — **the authorship claim, printed over the author's own edit**. `Tests 3 failed \| 113 passed (116)` | n/a — this is the defect, fixed at `ef4e59e7` |
| **P-1** | 187-22 T3 | cache the first `phases` inside the leaf: `const [frozen] = useState(phases)` / `phases = frozen` — **the tempting WRONG fix** the review's own proposed test would have forced | `× PURE PROJECTION — handed a new snapshot, every sentence and all three counts describe THAT one` · `× A NEW SNAPSHOT REPLACES THE OLD ONE — this leaf holds no cache of its first props` · `× holds NO cache of its first props — the CR-04 wrong fix, fenced at the source`. `Tests 3 failed \| 60 passed (63)` | `git checkout -- SeedReceipt.tsx` → `git diff --stat` **no diff**; `grep -nE "useState\|useRef"` → **no cache hooks** |
| **P-2** | 187-22 T3 | revert the mount prop to the live selector: `phases={receiptPhases}` → `phases={phases}`, at the `<SeedReceipt>` mount only | the new `builderSource` **SOURCE FENCE** *and* all three Task-1 cases: `Tests 4 failed \| 113 passed (117)` | `git checkout -- WorkflowBuilderPage.tsx` → **no diff**; `grep -n "phases={receiptPhases}"` → `1644:` |
| **RED-2** | 187-23 T1 | *(none — the shipped `escalated` sentence, before the fix)* | `× the reason formatter CLASSIFIES nothing — it renders the cause it is handed`. `AssertionError: expected 'it was set to must prove it by hand' to be 'you turned this on by hand'`. `Tests 1 failed \| 290 passed (291)` — **exactly one case**, the character-identity pin, which is the proof the sentence had exactly one home | n/a — this is the copy change, at `f59af16a` |
| **P-3** | 187-23 T2 | revert the sentence to the second-person wording | **BOTH** required cases: `× the reason formatter CLASSIFIES nothing` · `× the escalated reason NAMES NO ACTOR — a property, with a positive control (WR-11)`. `AssertionError: expected 'you turned this on by hand' not to match /\b(you\|your\|yours\|yourself)\b/i`. `Tests 2 failed \| 295 passed (297)` — the **property** would have caught *any* second-person rewording, not only this one | `git checkout --` → **no diff**; `grep -n 'it was set to ${words} by hand'` → `710:` |
| **P-4** | 187-23 T2 | replace the `never` guard with a bare `default: return ""` | `× guards seedReceiptStepReason with a never binding, not a bare default (WR-15)`. `Tests 1 failed \| 296 passed (297)` — **exactly the source half failed and the runtime half stayed green**, which is the empirical proof that the runtime half alone cannot see a compile-time guard | `git checkout --` → **no diff**; `grep -n "_never"` → `717,718,886,887` |
| **P-5** | 187-23 T2 | make `seedReceiptStepReason` return `""` for `escalated` | `× no rendered reason is empty or blank, across every sealed fixture` · `× no row's text ends at the em-dash — the consequence, in what a reader sees` · `× POSITIVE CONTROL — the formatter really can return the empty string`. `AssertionError: expected '⛨Must prove itWeigh the supplier opti…' not to match /—\s*$/`. `Tests 3 failed \| 63 passed (66)` — the failure message **is the defect in the words a reader would see** | `git checkout --` → **no diff**; `git status --porcelain -- frontend/` shows only the two Task-2 test files |
| **P-6** | 187-24 T1 | plant the drift: give `intersectingKbToolOf` its own **case-folding** loop instead of calling `firstKbTool`, leaving `groundingCause` alone | `× AGREES WITH THE CLASSIFIER, over a table — the property, not two copies of it`. `AssertionError: phase l names Search_Documents but is not detected: expected null to be 'detected'`. `Tests 1 failed \| 95 passed (96)` — the table carries a **case-differing** id precisely so the biconditional has a falsifiable input | `python plant_a.py unplant` → `git diff \| grep -c "folded"` **0**; suite **96 passed** |
| **P-7** | 187-24 T1 | re-declare a local `localIntersectingKbTool` in `SeedReceipt.tsx`, in the exact shape that was deleted | `× declares NO membership predicate of its own — one rule, one home (187-24/WR-14)`. `AssertionError: expected […(2)] to have a length of 1 but got 2`. `Tests 1 failed \| 66 passed (67)` — the assertion that bit is the **PROPERTY**, not the deny-list of membership calls beneath it | `grep -c "localIntersectingKbTool"` → **0**; `git diff --stat` → `15 insertions(+), 22 deletions(-)` — **the task's own delta, checked against what it SHOULD be rather than against zero** |
| **P-8** | 187-24 T2 | a **differently-worded** cause clause: `… must prove it because of its citation policy.` | `× the carried sentence ATTRIBUTES NO CAUSE — it counts two of them (187-20/WR-09)` · `× …and it attributes none over EVERY representable count`. `expected '1 step was already set to must prove …' not to match /\b(because\|since\|due to\|owing to\|tha…/i`. `Tests 4 failed \| 228 passed (232)`. **The historical-needle loop ran FIRST in the same iteration and PASSED** — the empirical proof of WR-12: the deny-list is blind to this wording and only the property sees it | `python plant_b.py unplant` → `git diff --stat -- definitionOps.ts` **empty**; suite **232 passed** |
| **P-9** | 187-24 T3 | a brand-new `data-testid="seed-receipt-brandnew"` nothing queries | `AssertionError: data-testid="seed-receipt-brandnew" is rendered but never queried` — **old sweep also failed** (its one working direction) | `git diff --stat -- SeedReceipt.tsx` **empty**; suite **68 passed** |
| **P-10** | 187-24 T3 | `data-testid={"seed-receipt-brace"}` — the brace-wrapped double-quote spelling | `AssertionError: data-testid="seed-receipt-brace" is rendered but never queried` — **old sweep PASSED: invisible** | as above |
| **P-11** | 187-24 T3 | `data-testid={'seed-receipt-sneaky'}` — the brace-wrapped single-quote spelling | `AssertionError: data-testid="seed-receipt-sneaky" is rendered but never queried` — **old sweep PASSED: invisible** | as above |
| **P-12** | 187-24 T3 | a new id whose only query is the **commented-out** `// screen.getByTestId("seed-receipt-ghost")` | `AssertionError: data-testid="seed-receipt-ghost" is rendered but never queried` — **old sweep PASSED: a mention satisfied it** | as above |
| **P-13** | 187-24 T3 | a new **sibling state attribute** `data-row-tally={rows.length}` nothing queries | `AssertionError: data-row-tally is rendered but never queried: expected ' \r\nimport { describe, it, expect, v…' to contain '"data-row-tally"'` — **old sweep PASSED: the whole class was unswept.** The expected string beginning with comment-stripped source is visible proof both repairs are live in the same assertion | as above |
| **P-14** | 187-25 T1 | delete one `it(` block from **`SeedReceipt.test.tsx`** (`renders every authored string as a text child`) | `SeedReceipt.test.tsx  68  67  -1` · `RESULT: COUNT GATE VIOLATED (1 reason(s))` · `FAIL [count-decrease] SeedReceipt.test.tsx — pinned 68, ran 67 (-1). A test was deleted or skipped away.` — with **`failed 0`**, so the count decrease is the *only* signal, which is the entire point: a failures-only differential cannot see a deleted test | restored byte-for-byte from a sidecar copy (**not** `git checkout --`, which would have wiped the uncommitted task edits — the 187-24 lesson); `grep -c` for the block → **1**; `git diff -U0` non-comment changed lines → **0** |
| **P-15** | 187-25 T1 | delete one `it(` block from **`definitionOps.test.ts`** (`is pure — the same drag resolves identically every time`) | `definitionOps.test.ts  232  231  -1` · `FAIL [count-decrease] definitionOps.test.ts — pinned 232, ran 231 (-1). A test was deleted or skipped away.` — again with `failed 0` | sidecar restore; `grep -c` → **1**; `git diff --stat -- definitionOps.test.ts` → **empty** (the file is byte-identical to HEAD; this plan only probed it) |

**Two probes are worth naming for what they refuted, not merely for going red.**

- **P-1 is the probe that matters most in round 4.** It is the *tempting wrong fix* — caching inside
  the leaf — which the review's own proposed component-level test would have **forced**. `SeedReceipt`
  recomputes every row, count and sentence from its `phases` prop on every render, so the review's
  proposed test would still have failed after the review's own proposed fix and could only be made
  green by adding a cache. **A review's suggested fix and its suggested test contradicted each other**;
  the verified `planner_note` was confirmed against live source before Task 1, and P-1 now makes the
  wrong fix red three cases instead of green.
- **P-8 proves WR-12 as an executable claim rather than an argument.** The old deny-list loop and the
  new property ran in the *same iteration*; the deny-list passed and the property failed. That is the
  finding, measured.

### (ag) COVERAGE — what the three widened guards now measure

Round 4 widened three guards from *mentions* to *properties*. Each widening is recorded with the
measurement that justified it, because two of the three were adopted only after a proposed artifact
was **rejected**.

| Guard | Was | Is | The measurement that decided it |
|---|---|---|---|
| the WR-09 cause fence | two literal clauses (`" by its own settings"`, `" by their own settings"`) | a **word class** — `because \| since \| due to \| owing to \| thanks to \| on account of \| as a result \| therefore \| thus \| hence \| consequently \| by`, `\b`-anchored, with 4 negative controls (`bystander`, `sincerely`, `thusly`, `a byte of it`) | re-derived at HEAD: `grep -rn "by its own settings\|by their own settings" src/` → **2 hits, BOTH PROSE** (a test comment and a docblock). Every needle in the shipped fence matched **nothing the product can emit** |
| the testid sweep | one static spelling, comments included, `data-testid` only | all **three** static spellings; `withoutComments()` applied to `testSource` first; the sibling `data-*` state-attribute class swept in its **own `it`** | all 5 probes (P-9…P-13) run against **both** sweeps: the old one caught **1 of 5**; the new one catches **5 of 5** |
| the KB-tool membership rule | two derivations one line apart, agreeing by coincidence | **one body** (`firstKbTool`) read by both consumers | `grep -nE "kbTools\.(includes\|indexOf)\|includes\(tool\)" SeedReceipt.tsx` → **nothing**; `grep -c "export function intersectingKbToolOf" phaseVocabulary.ts` → **1**; `grep -n "intersectingKbToolOf" SeedReceipt.tsx` → imported (`:138`) and called (`:218`), **never redeclared** |

⚠ **A review's suggested regex is a CLAIM, not an artifact — and this round measured two of them
false.** WR-13's proposed extraction regex admits backticks and, against this component, extracts
`seed-receipt-step-${row.slug}` — the **template** row testid — as though it were a static id, then
demands a query for that literal string: **a guard red on correct code.** It was narrowed to exclude
`$`, `{` and `}`, and the sweep now asserts *explicitly* that no extracted id contains `${`.
Separately, **two needles were tried and REJECTED for firing on correct code** and the reasons written
into the guard rather than deleted quietly: `/function\s+\w+\s*\([^)]*kbTools/` fired on the
component's own destructured props, and `"for (const "` fired on its own row derivation.

### (ah) GATES — re-measured at the round-4 tip, not carried forward

Every figure below came from a command run **at this commit**, with raw output pasted.

**(ah-1) The five-suite named set — count-guarded**

⚠ Run **isolated**, never as part of the full frontend suite. The Phase-177 lesson applies: the
**COUNT** is the gate, not only the failure number.

```
$ cd frontend && npx vitest run src/components/workflows/SeedReceipt.test.tsx \
      src/components/workflows/StepTypePicker.test.tsx \
      src/components/workflows/phaseVocabulary.test.ts \
      src/components/workflows/phaseVocabulary.corpus.test.ts \
      src/components/workflows/definitionOps.test.ts
 Test Files  5 passed (5)
      Tests  484 passed (484)
EXIT=0
```

**Files 5 · passed 484 · failed 0. Against round 3's `466` for this identical command (§(t)), the
total ROSE by exactly +18** — strictly greater, so no suite was replaced rather than extended.

**The 466 is re-derived here, not inherited.** Declared case literals counted in the round-4 base
blob and the HEAD blob:

```bash
for f in SeedReceipt.test.tsx StepTypePicker.test.tsx phaseVocabulary.test.ts \
         phaseVocabulary.corpus.test.ts definitionOps.test.ts; do
  git show 7a1b427e:frontend/src/components/workflows/$f | grep -cE '^[ \t]*(it|test)(\.each\(|\.skip)?\('
  git show HEAD:frontend/src/components/workflows/$f      | grep -cE '^[ \t]*(it|test)(\.each\(|\.skip)?\('
done
```

| Suite | literals `7a1b427e` → `HEAD` | Δ | Which plans moved it |
|---|---|---|---|
| `SeedReceipt.test.tsx` | 60 → 68 | **+8** | 187-22 (+3), 187-23 (+3), 187-24 (+2) |
| `definitionOps.test.ts` | 118 → 122 | **+4** | 187-23 (+3), 187-24 (+1) |
| `phaseVocabulary.test.ts` | 78 → 84 | **+6** | 187-24 (+6) |
| `StepTypePicker.test.tsx` | 36 → 36 | **0** | — untouched by this round |
| `phaseVocabulary.corpus.test.ts` | 17 → 17 | **0** | — untouched by this round |
| **total Δ** | — | **+18** | |

`484 − 18 = 466`, which is round 3's recorded figure for the identical command — so "before" is
**derived from a measurement taken now**, and it independently reproduces round 3's number. ⚠ Absolute
literal counts do not equal run counts (`it.each` expands one literal into several cases), which is
why only the **deltas** are used as the instrument. Two of the five files are byte-identical to the
base, so their counts cannot have moved and there is no room for a compensating drop.

Also re-measured: `WorkflowBuilderPage.canvas.test.tsx`, which 187-22 moved **113 → 117**, reports
**117** in every count-gate sample below.

**(ah-2) The count gate — and the two new pins**

```
$ node scripts/vitest-count-gate.cjs
  file                                     pinned  actual   delta
  -------------------------------------------------------------
  definitionOps.test.ts                       232     232       0    ← NEW PIN (187-25)
  canvasModel.fixtures.test.ts                100     100       0
  canvasModel.purity.test.ts                   69     143     +74
  SeedReceipt.test.tsx                         68      68       0    ← NEW PIN (187-25)
  phaseVocabulary.test.ts                      33      96     +63
  WorkflowCanvas.test.tsx                      31      35      +4
  canvasModel.test.ts                          26      49     +23
  PublishGauntlet.test.tsx                     24      46     +22
  WorkflowBuilderPage.canvas.test.tsx          22     117     +95
  PhaseFormPanel.test.tsx                      19      19       0
  WorkflowBuilderPage.test.tsx                 15      15       0
  PhaseSpineGraph.test.tsx                     14      20      +6
  soulData.test.ts                             14      14       0
  WorkflowDoorSwitch.test.tsx                  13      13       0
  PhaseSpine.test.tsx                          11      11       0
  deriveTier.test.ts                            9       9       0
  WorkflowSoul.test.tsx                         8       8       0
  revertByteIdentical.test.tsx                  7       7       0
  … 20 unpinned files reported `new` …
  -------------------------------------------------------------
  total                                       715    2111   +1396
  total 2111  ·  failed 0  ·  pinned total 715
count gate OK — 18/18 pinned files present, no per-file decrease, 0 failing.
GATE_EXIT=0
```

**Exit 0. Every previously-pinned file reports delta ≥ 0 — not one decreased.** Pinned total
**415 → 715** (+232 +68). The success line's count is now **derived from the map** rather than the
hard-coded `16/16` it printed before, so it cannot announce a false figure on a green gate.

**Both pin numbers were read from this table's own `actual` column**, over two runs that agreed at
232 / 68, and neither was hand-counted — `definitionOps.test.ts` declares **122** `it(` literals and
runs **232** cases because of `it.each`, so a hand count would have pinned a fiction by ~110. The
deletion probes that prove the pins bite are **P-14** and **P-15** in §(af).

⚠ **A red gate was sampled, diagnosed, and NOT pinned around.** Sample 1 of four reported
`failed 1`. The plan anticipated the known `PublishGauntlet.test.tsx` flake (`D-ITEM-187-20-01`).
**It was a different file:**

```
FILE:     WorkflowBuilderPage.canvas.test.tsx
FULLNAME: WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)
          > POSITIVE CONTROL — with the flag ON the very same read finds the key
MSG:      AssertionError: expected 0 to be greater than 0
```

| Sample | Command | `failed` | `WorkflowBuilderPage.canvas` | `PublishGauntlet` |
|---|---|---|---|---|
| 1 (pre-pin) | `node scripts/vitest-count-gate.cjs` | **1** | 117 | 46 |
| 2 (pre-pin) | same | 0 | 117 | 46 |
| 3 (post-pin) | same | 0 | 117 | 46 |
| 4 (final, shipped tree) | same | 0 | 117 | 46 |
| isolation | `npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx` | 0 | **117 passed, exit 0** | — |

Green alone, green in three of four whole-glob samples, and its **per-file count is 117 in every
sample** — never a `[count-decrease]`. Same *class* as `D-ITEM-187-20-01` / `D-ITEM-02`, different
*file*, so it is logged separately as **`D-ITEM-187-25-01`** rather than folded in. **No pin was
lowered for it.** A pin is lowered only alongside a deliberate, plan-authorised deletion — never to
quiet a red gate — and lowering it would have been meaningless anyway, since the flake is a
`[failing-tests]` reason and not a count reason. `D-ITEM-187-20-01`'s own file did **not** flake this
round: `PublishGauntlet.test.tsx` reported 46 passing in all four samples.

**(ah-3) The zero-migration gate**

```
$ git diff --stat 35261e96 HEAD -- supabase/migrations     ← (empty — 0 lines)
$ git diff --stat 7a1b427e HEAD -- supabase/migrations     ← (empty — 0 lines)
$ git status --porcelain supabase/migrations               ← (empty — 0 lines)
```

**All three empty.** Measured from the **phase** base *and* the **round-4** base, so truth #11
(*"Zero migrations added by this phase, including the closure rounds"*) survives round 4 on its own
evidence rather than on round 3's.

**(ah-4) The backend-untouched gate**

```
$ git diff --name-only 7a1b427e HEAD -- backend/           ← (empty)
```

**Zero backend files.** §(d)'s pre-existing-rot record stands unchanged and the backend suite was
neither re-run nor needed.

**(ah-5) The D-187-14 mount cap — this round SPENDS the budget, for the first time since the phase**

```
$ git diff --numstat 7a1b427e HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx
8	1	frontend/src/pages/WorkflowBuilderPage.tsx
```

**8 insertions / 1 deletion, against the ≤ 15 insertion budget this round set. Under, not at.**
Rounds 2 and 3 each spent **0** (§(j), §(y)); round 4 is the first closure round to touch the mount
at all, because CR-04 is a **caller** defect and the caller is this file. The whole delta on a
1851-line hot file is: a `receiptPhases` state declaration + a 3-line comment; one
`setReceiptPhases(def.phases)` inside `onDraft`'s success branch + a 2-line comment; and **one
identifier** in the JSX (`phases={phases}` → `phases={receiptPhases}`). **The render body gains no
new line** — the only render-body change is a 1-insertion/1-deletion identifier swap at the same
position. The reasoning lives in the component's prop contract, not in the page. G-1 is honoured by
construction.

**(ah-6) `tsc --noEmit` against the `D-ITEM-01` baseline**

```
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json ; echo $?
2
$ grep -c 'error TS'                            → 33
$ grep -c 'src/components/workflows/'           → 0
$ grep -c 'src/pages/WorkflowBuilderPage'       → 0
```

| | Before (`D-ITEM-01`, and re-measured by 187-22/23/24 at each task) | **After (measured now)** |
|---|---|---|
| total `error TS` lines | 33 | **33** — zero delta |
| errors in `src/components/workflows/` | 0 | **0** |
| errors in `src/pages/WorkflowBuilderPage*` | 0 | **0** |

187-23 and 187-24 additionally measured their outputs **byte-identical** to their own pre-task
baselines at every task, so across the whole round not one error moved, changed shape or changed file.

⚠ **`D-ITEM-187-23-02` re-confirmed by measurement at the round-4 tip: the bare form is VACUOUS.**

```
$ cd frontend && npx tsc --noEmit ; echo $?
0        ← ZERO output, ZERO error lines
```

The root `frontend/tsconfig.json` is a **solution file** with `files: []`, so the bare command
type-checks **zero files**. It cannot reproduce the 33-error baseline and — the part that matters —
**it cannot detect a new error either.** Any criterion spelled `npx tsc --noEmit` must be read as
`-p tsconfig.app.json`. ⚠ Separately, `tsc -b` ≠ `tsc --noEmit` (the v3.3 lesson) — two distinct
traps in the same area.

**(ah-7) No false completion record**

```
$ git status --porcelain .planning/REQUIREMENTS.md .planning/ROADMAP.md   ← (empty — 0 lines)
$ grep -rn "gsd-sdk\|sdk query" .planning/phases/187-.../187-2[2345]-*.md ← (no hits, exit 1)
```

Neither `requirements.mark-complete`, `state.advance-plan` nor `roadmap.update-plan-progress` was
called by **any** executor in round 4 — all three write false records in this project. Every textual
occurrence of those three verb names across the round's four plans and four summaries is
**prohibition prose**, never an invocation; the second grep confirms there is no SDK call site of any
kind in those eight documents. `REQUIREMENTS.md` was not touched at all — its VOCAB-01/02/03 rows
still read Pending, which is correct until re-verification says otherwise. ⚠ Stated rather than left
to be discovered: `.planning/STATE.md` **does** appear in the round's file list (§(ai)); those are the
**orchestrator's** own tracking commits (`5e0db585`, `83524870`, `925373b9`), which is whose job it is.

**(ah-8) The full file list for the round — measured, not asserted**

```
$ git diff --name-only 7a1b427e HEAD
.planning/STATE.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-22-SUMMARY.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-23-SUMMARY.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/187-24-SUMMARY.md
.planning/phases/187-business-vocabulary-ai-seeded-canvas/deferred-items.md
frontend/src/components/workflows/SeedReceipt.test.tsx
frontend/src/components/workflows/SeedReceipt.tsx
frontend/src/components/workflows/definitionOps.test.ts
frontend/src/components/workflows/definitionOps.ts
frontend/src/components/workflows/phaseVocabulary.test.ts
frontend/src/components/workflows/phaseVocabulary.ts
frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
frontend/src/pages/WorkflowBuilderPage.tsx
scripts/vitest-count-gate.cjs
```

**Eight source files, one script, five planning documents, nothing else.** (Measured *before* 187-25's
own doc commits, which add this file and `187-25-SUMMARY.md`.) `StepTypePicker.tsx` /
`.test.tsx` do **not** appear — the WR-08 fence of §(ac) holds through round 4 as well.

### (ai) Deferred items opened by this round

| Id | Opened by | What | Re-open trigger |
|---|---|---|---|
| `D-ITEM-187-23-01` | 187-23 | `GROUNDING_WHY_ESCALATED` (`definitionOps.ts:475`) carries the same second-person claim — *"Because you turned this on by hand."* — on the grounding dial's why-line in `PhaseFormPanel`. The case is genuinely weaker (the line renders beside the dial the author is operating), and the plan's action said *"change nothing else in this file"* | the next plan touching `PhaseFormPanel`'s grounding why-line |
| `D-ITEM-187-24-01` | 187-24 | `groundingCauseOf` reads `phase.config` unguarded, against its own module's totality contract; `intersectingKbToolOf` deliberately **mirrors** it rather than diverging | the next plan that may change a shipped `phaseVocabulary` export's behaviour |
| `D-ITEM-187-25-01` | 187-25 | a **second** parallel-execution flake, in `WorkflowBuilderPage.canvas.test.tsx` (the 184-11 rails positive control) — not `PublishGauntlet`. Green in isolation at 117; no pin moved for it | Phase 188's `WorkflowCanvas.tsx` extraction |

### What round 4 proved — and what it did NOT

**Proved.** CR-04 is closed **in the caller**, by a snapshot — the one fix shape that closes all three
input paths at once, where the two prior rounds had each edited what the copy *says*. WR-11 through
WR-16 are closed by code. Fourteen probes were observed RED and every one was cleanly reverted, so no
guard added in this round is one that has never been seen to fail. Two guards that shipped in round 3
without the controls their own files mandate now have them, and each was observed failing on a defect
it previously passed. The two suites carrying the whole Req-5 governance-honesty estate are pinned,
from numbers the gate printed, each observed catching a deletion. Zero migrations, zero backend files,
zero `tsc` delta, the five-suite total up +18 with nothing dropped, and the mount cap spent at 8 of 15.

**Not proved.**

- **Nothing on the manual board.** All **fourteen** rows (M1–M14) remain **UNPERFORMED**. They are
  the operator's. M14 is net-new and unperformed like the rest; repairing a note is not performing it.
- **IN-11…IN-14 were shown and left out by decision**, and **WR-08 is still Phase 188's**. Neither
  was absorbed here.
- **WR-01, WR-04, WR-05, WR-06, WR-07 and IN-01…IN-05 remain open**, unchanged in `187-REVIEW.md`.
- **The three ❌ SC#10 rows are untouched.** OpenRouter's non-deterministic name drop, OpenAI's
  `gpt-5.6-sol` endpoint refusal and MiniMax's non-emission are provider-side; no frontend change in
  this round could move them and none tried.
- **The parallel-run flake class is still there, and it GREW a file** (`D-ITEM-187-25-01`). Three of
  four gate samples landed at 0 failing; that is a sample, not a fix.
- **`groundingCauseOf`'s unguarded `config` read is still there** (`D-ITEM-187-24-01`), deliberately
  mirrored rather than diverged from, and **`GROUNDING_WHY_ESCALATED` still says "you"** on the panel
  surface (`D-ITEM-187-23-01`). Both are logged, neither is swept in.
- **The backend was not re-run and did not need to be** — this round committed **zero** backend files.

---

## The gap-closure round 5 — 2026-08-04

Round 5 is **not** a re-verification round. It closes three defects the **operator observed in a live
session** on 2026-08-04, and they are one causal chain rather than three findings:

| Plan | Finding it closes | Severity as recorded | Wave |
|---|---|---|---|
| **187-26** | **GAP A — the root cause.** The loose *"Describe & run"* door has no knowledge-base control at all, so a fast-path workflow is **born unbound**; `unbound_retrieval` then fires on any retrieval step and Publish is disabled out of the gate for a reason the author was never asked about | 🛑 root cause of the chain | 13 |
| **187-27** | **GAP B — the never-ran fail-open.** Opening an existing draft issues **zero** `/validate` calls, yet the tray renders *"Nothing to fix — the static checks pass · checked by the server"* and Publish stays **ENABLED** — verbatim the fail-open the page's own docblock forbids (D-184-14). The shipped rule covered `degraded` and not **never-ran** | 🛑 fail-open | 14 |
| **187-28** | **GAP C — a stale doc claim.** `workflows.py` claims the three route-assigned codes are *"canvas-only"* and that Phase 187 *"is not scoped to change what publishes"*. Measured false of the **author's** Publish control. The behaviour is correct and stays (the operator's disposition); only the claim moved | ⚠️ doc-only, WR-14 class | 15 |
| **187-29** | **WR-16 applied to round 5** — the three suites carrying this round's honesty estate were unpinned, so every guard round 5 adds was deletable with the gate green — plus this record | ⚠️ Warning | 16 |

**Scope discipline, stated rather than implied.** Round 5 is scoped to **GAP A, GAP B, GAP C and the
round's own pins/record only**.

- **`BUG-260731-03` is NOT closed by this round.** Its `re_open_trigger` needs both halves verified
  **live**, and round 5 performs no manual row. 187-28 read the report at the CLAUDE.md touchpoint and
  left its frontmatter **byte-unchanged** (`status: folded`, `verified_closed_by: null`).
- **WR-08 remains routed to Phase 188**, unchanged from rounds 3 and 4 (§(ac), §(ah-8)). It was not
  closed, not partially closed and not absorbed here either.
- **WR-01, WR-04, WR-05, WR-06, WR-07, IN-01…IN-05 and IN-11…IN-14 remain carried forward**, unchanged
  in `187-REVIEW.md`, none silently absorbed and none silently dropped.
- **`D-ITEM-187-23-01` and `D-ITEM-187-24-01` are untouched.** Round 5 changed no grounding-dial copy
  and no `phaseVocabulary` export.

**Base commit for every gate in this section: `15339441`** (`test(187): record the root-cause
finding — no KB picker before the AI drafts`) — the tip immediately before `f5a28e7e`, round 5's
first commit, verified rather than asserted:

```
$ git rev-parse --short f5a28e7e~1
15339441
$ git log --oneline -1 15339441
15339441 test(187): record the root-cause finding — no KB picker before the AI drafts
```

This base is **different from all four** earlier bases: `35261e96` (the phase base), `ee5fff3b`
(round 2), `f632f9b6` (round 3) and `7a1b427e` (round 4). All five are stated so that no figure
anywhere in this file is ambiguous about which range it measures.

### (aj) Per-task verification rows — 187-26, 187-27, 187-28, 187-29

> Rows for 187-26/27/28 are **transcribed** from the three SUMMARYs, each measured at the commit named
> in its row. The **gates** in §(al) *are* re-measured at the round-5 tip, and where a re-run disagrees
> with a SUMMARY both are recorded with the re-run marked as the measurement (round 3 §(q)'s
> precedent). Rows for 187-29 were measured by this task.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Measured at | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| **187-26-T1** | **26** | **13** | VOCAB-03 (Req 6) | T-187-R5-01/02/03/05 | `DescribeKbPicker` is a leaf that reads **one** api symbol and invents nothing: a folder row with no usable id is DROPPED (an unpickable option is a dead control) while a NAMELESS folder still renders, labelled by its own id, never a borrowed or fabricated name. *"There are none"* and *"we could not ask"* are held in **distinct** state, observable through a hidden state marker. **RED observed before the component existed** — `Failed to resolve import "./DescribeKbPicker?raw"`, `Tests no tests` | falsification + render + source fence | `cd frontend && npx vitest run src/components/workflows/DescribeKbPicker.test.tsx` | `f5a28e7e` | ✅ green — 30 passed, 0 failed |
| **187-26-T2** | **26** | **13** | VOCAB-03 / VOCAB-02 | T-187-R5-04 | **GAP A closed** — the door mounts the picker and the chosen id reaches `generateWorkflow`'s `project_folder_id` **on the request the client actually sends**, not on a prop being present. Choosing NOTHING sends **no key at all** (absent, not `undefined`, not `""`), and the CTA stays enabled by **text alone** so the fast path is unchanged. RED first: 7 failed / 14 passed, `Unable to find an element by: [data-testid="project-folder-picker"]` — the operator's own DOM probe reproduced mechanically | falsification + request-shape fence | `cd frontend && npx vitest run src/components/workflows/DescribeKbPicker.test.tsx src/components/workflows/WorkflowDoorSwitch.test.tsx src/pages/WorkflowBuilderPage.describe.test.tsx` | `74aff9f9` | ✅ green — 70 passed, 0 failed |
| **187-26-T3** | **26** | **13** | VOCAB-03 | T-187-R5-01…05 | Three falsification probes (P-16/17/18) applied to real source, each observed RED, each revert **proved by sha256** rather than assumed. P-17 is the informative one — it severs the WIRE only, so 19 cases still pass and the failure isolates the round trip rather than restating "the picker is on screen" | falsification ×3 | `node scripts/vitest-count-gate.cjs` | `1b2e81d5` | ✅ green — measurement only, no source change survives |
| **187-27-T1** | **27** | **14** | VOCAB-02 | T-187-R5-07/10 | Not-yet-checked becomes a state a **surface** can be in: `TrayCheckCause` is widened in the CONSUMER-facing module so the type never admits a member its emitter cannot produce (the WR-14 drift class), `DEGRADED_SENTENCE` is **total** over it (asserted by iterating the record's own keys plus a compile-time exhaustiveness object), and the third sentence is DISTINCT from both shipped ones and from the clean line. RED first: 5 failed / 54 passed, and **the defect's exact current rendering is the positive control inside the first case** | falsification + totality + word-class property | `cd frontend && npx vitest run src/components/workflows/verdictModel.test.ts src/components/workflows/ProblemsTray.test.tsx` | `a3aa3f4d` | ✅ green — 59 passed, 0 failed |
| **187-27-T2** | **27** | **14** | VOCAB-02 | T-187-R5-06/08/09 | **GAP B closed, both halves together** — a flag-ON drafted definition **with steps** issues a check on OPEN, and while the answer is outstanding `blockedReason` returns the never-ran sentence so Publish is **disabled and names why**; an `ok:true` answer RELEASES it, so the fail-closed state is one a person can escape. `canvasEnabled &&` keeps the flag-OFF surface at **zero** requests (D-181-01). RED first: `expected 0 to be greater than or equal to 1` and `Received element is not disabled` — the operator's finding reproduced mechanically | falsification + fail-closed window + flag-off pin | `cd frontend && npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx` | `a25a2df2` | ✅ green — 124 passed, 0 failed |
| **187-27-T3** | **27** | **14** | VOCAB-02 | T-187-R5-06…10 | Four probes (P-19…P-22) each applied and measured **in ONE tool call**, each revert sha256-proved. **The first P-19 and P-20 runs measured NOTHING** and were caught by the plan's own instruction — see §(ak)'s harness-hazard note, which is this round's most transferable finding | falsification ×4 | `node scripts/vitest-count-gate.cjs` | `a25a2df2` | ✅ green — measurement only |
| **187-28-T1** | **28** | **15** | VOCAB-02 (D-187-11) | T-187-R5-11/14 | **GAP C closed at the claim** — the comment states what the code does and names the two files that measure each half; the self-contradicting inventory count (`2` in one line, *"three codes"* nineteen lines below) is corrected to `3`. The old sentence is **paraphrased and its commit named** (`a68132db`), never requoted — a verbatim quote framed as *"this used to say"* would satisfy the source pin and silently disarm it | comment-only diff, proved mechanically | `git diff -U0 -- backend/app/api/workflows.py \| grep -vE '^[+-]#' \| wc -l` → **0** | `67b8025d` | ✅ green |
| **187-28-T2** | **28** | **15** | VOCAB-02 (D-187-11) | T-187-R5-11/12/13 | **Both halves of the corrected sentence become properties.** SERVER half quantified over the whole `_ROUTE_ASSIGNED_CODES` set in **two** forms — the published constant and the real `grounding_verdicts` collector DRIVEN with all three grounding rules firing, because a constant and its emit sites are two things that can drift apart. CLIENT half pinned verbatim: an `incomplete`-ONLY `ok:false` hands the server's sentence to `publish-trigger.disabled`, with two controls (mixed severities, `ok:true`) proving it is not vacuous. The source grep is ranked **BENEATH** the property **in source** and says so | property ×3 + regression pin + controls | `pytest tests/unit/test_187_route_assigned_reach.py -q` **and** `npx vitest run src/pages/WorkflowBuilderPage.canvas.test.tsx` | `f82fd061` | ✅ green — backend 7 passed; client 128 passed |
| **187-28-T3** | **28** | **15** | VOCAB-02 | T-187-R5-11…14 | Eight probe mutations (P-23…P-27, §(ak)) each applied **and measured in one tool call**, each revert `sha256sum -c`-proved. Gate 4's red was **attributed by measurement, not by assertion** — the canvas suite was rolled back to `67b8025d` and the identical two `PublishGauntlet` cases still failed at 187-27's exact total | falsification ×8 + non-attribution measurement | `node scripts/vitest-count-gate.cjs` | `929f5af5` | ⚠️ `[failing-tests]` only — `D-ITEM-187-20-01`, non-attribution measured, no pin lowered |
| **187-29-T1** | **29** | **16** | VOCAB-02, VOCAB-03 | T-187-R5-15/16/17 | **WR-16 applied to round 5** — `DescribeKbPicker.test.tsx` (30), `ProblemsTray.test.tsx` (30) and `verdictModel.test.ts` (29) are pinned in `BASELINE`, **all three numbers read from the gate's own `actual` column** over two agreeing pre-pin runs, never hand-counted. `BASELINE_TOTAL` stays computed and the success line stays derived: it moved **18/18 → 21/21** on its own. **No existing pin was lowered by a single test.** Each pin then observed catching a genuinely deleted `it(` block (P-28/P-29/P-30) | pin + deletion probes ×3 | `node scripts/vitest-count-gate.cjs` | `51c44f37` | ✅ green — exit 0, all three at delta **0**, `21/21`, pinned total **804** |
| **187-29-T2** | **29** | **16** | VOCAB-02, VOCAB-03 | T-187-R5-18/19 | **The round is on the record and the board grows by three.** Every figure below carries the command that produced it and every "before" is DERIVED at this commit from the base blob rather than transcribed; where a re-run disagrees with a SUMMARY or a plan, **both** are recorded and the re-run is the measurement. G-4 honoured: **M15, M16, M17 net-new; nothing ticked, softened, re-scoped or dropped** | structural + record | `node scripts/vitest-count-gate.cjs && git status --porcelain .planning/REQUIREMENTS.md .planning/ROADMAP.md` | this commit | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

### (ak) PROBE — every falsification round 5 performed, and a correction to the probe ledger

**Why this section exists.** Round 4's lesson was that *a guard that has never been seen to fail is
indistinguishable from a guard that cannot fail*. Round 5 inherited a sharper version of it: two of
its own probes **reported green while measuring nothing**, and only the plan's own instruction caught
them. A probe observed RED is the only evidence a guard bites — and a probe must be *observed*, not
merely *run*.

⚠ **THE PROBE LEDGER IS CORRECTED, AND THIS PLAN'S OWN TASK TABLE IS ONE OF THE THINGS CORRECTED.**
`187-29-PLAN.md` §C.1 says *"Every falsification probe **P-16…P-25**… **Ten probes**"*, and its Task-1
table names this plan's three deletion probes **P-23 / P-24 / P-25**. Measured against what the round
actually ran, both are wrong, and in a way that would have produced a silently ambiguous record:

| Plan | Probe identifiers it actually spent | Distinct mutations applied |
|---|---|---|
| 187-26 | P-16, P-17, P-18 | 3 |
| 187-27 | P-19, P-20, P-21, P-22 | 4 |
| 187-28 | P-23, P-24, **P-25a, P-25b, P-25c, P-25d**, P-26, P-27 | **8** |
| 187-29 | **P-28, P-29, P-30** *(renumbered — see below)* | 3 |
| **round total** | **P-16 … P-30** | **18** |

- **`P-23`, `P-24` and `P-25` were already spent by 187-28.** Re-using them for this plan's deletion
  probes would have put two different mutations behind one identifier in the same round's record.
  **This plan's three probes are therefore numbered `P-28`, `P-29`, `P-30`.** The renumbering is
  recorded rather than applied silently, because a reader following the plan's table would otherwise
  look for the wrong rows.
- **The plan's "ten probes" is refuted by measurement.** The measured range is **P-16…P-30**;
  18 mutations were applied.
- ⚠ **187-28's own SUMMARY heading says *"seven probes"* and its table lists EIGHT rows.** Neither
  reading yields seven: counting `P-25a`–`P-25d` as **one** probe site gives **five** identifiers
  (P-23, P-24, P-25, P-26, P-27); counting each applied mutation gives **eight**. Both figures are
  recorded here so the discrepancy is a documented correction rather than a number a later reader
  quietly picks one of. This is the same class of correction round 3 §(q) and round 4 §(af) each made
  to their own rounds' probe counts — **the correction is the pattern, not the exception.**

#### The probes, with their observed RED

Rows for P-16…P-27 are transcribed from the three SUMMARYs (the raw output is theirs). Rows P-28…P-30
were **run by this task** and their output is pasted from this commit.

| # | Plan | Mutation applied | Observed RED | Revert evidence |
|---|---|---|---|---|
| **RED-1** | 187-26 T1 | *(none — the suite, before the component existed)* | `Failed to resolve import "./DescribeKbPicker?raw" … Does the file exist?` · `Test Files 1 failed (1)` · `Tests no tests` | n/a — this is the RED-before-green, green at **30 passed** |
| **RED-2** | 187-26 T2 | *(none — the SHIPPED door, before the mount)* | `× renders a KB picker ON THE DESCRIBE DOOR — the control the operator probed for and did not find` (+6 more) · `TestingLibraryElementError: Unable to find an element by: [data-testid="project-folder-picker"]` · `Tests 7 failed \| 14 passed (21)` | n/a — this is the defect; green at **70 passed** |
| **P-16** | 187-26 T3 | deleted the `<DescribeKbPicker>` mount from the describe door | 7 failed / 14 passed — `Unable to find an element by: [data-testid="project-folder-picker"]` | sha256 `e47b0eaa…d3b08` restored; `git diff --numstat` empty against the committed task-2 state |
| **P-17** | 187-26 T3 | severed the WIRE only — dropped `initialProjectFolderId` from the govern-door mount | **2 failed / 19 passed** — precisely the round-trip case (`expected "vi.fn()" to be called with arguments: [ ObjectContaining{…} ]`) and its source fence. **The picker still rendered and 19 cases still passed**, which is what makes the fence a statement about the REQUEST rather than about the mount | sha256 `e47b0eaa…d3b08` restored |
| **P-18** | 187-26 T3 | planted a fabricated fallback row in the failure branch | 2 failed / 28 passed — `expected <select …(3)>…(2)</select> to be null` | sha256 `d9f54844…07114` restored |
| **RED-3** | 187-27 T1 | *(none — the shipped modules)* | `× DEGRADED_SENTENCE is TOTAL over the widened union` · `AssertionError: expected [ 'unreachable', 'unreadable' ] to deeply equal [ …(1) ]` · `Tests 5 failed \| 54 passed (59)`. **The defect's exact rendering is the positive control inside the first case**: with the cause `null`, the tray renders *"Nothing to fix — the static checks pass"* + *"checked by the server"* + the *"Nothing outstanding"* paragraph — what the page handed the tray for every opened draft | n/a — green at **59 passed** |
| **RED-4** | 187-27 T2 | *(none — the shipped page)* | `× VALIDATE-ON-OPEN … AssertionError: expected 0 to be greater than or equal to 1` · `× THE FAIL-CLOSED WINDOW … Received element is not disabled: <button … data-testid="publish-trigger" />` · `Tests 4 failed \| 3 passed (7)` — **the publish trigger is not disabled on a draft nobody has checked** | n/a — green at **124 passed** |
| **P-19** | 187-27 T3 | reverted the enabled widening to bare `hasEdited` | `expected 0 to be greater than or equal to 1` — the validate-on-open case | sha256 `db0aa868…eeb36` restored |
| **P-20** | 187-27 T3 | deleted `canvasEnabled &&` from the enabled expression | `expected "vi.fn()" to be called +0 times, but got 1 times` — the D-181-01 flag-OFF pin | sha256 `db0aa868…eeb36` restored |
| **P-21** | 187-27 T3 | deleted the `blockedReason` never-ran branch | `Received element is not disabled` — the fail-closed publish-window case | sha256 `db0aa868…eeb36` restored |
| **P-22** | 187-27 T3 | forced the canvas session's `degraded` back to the store-only translation | `expected 'false' to be 'not-run'` — the original defect reproduced on demand | sha256 `db0aa868…eeb36` restored |
| **P-23** | 187-28 T3 | added `unbound_retrieval` to `grounding.GROUNDING_VERDICT_CODES` | `Extra items in the left set: 'unbound_retrieval'` — PROPERTY 1 **and** PROPERTY 2's control, i.e. the constant/emit-site drift | `grounding.py: OK` (`sha256sum -c`) |
| **P-24** | 187-28 T3 | made `grounding_verdicts` actually emit a route-assigned code | `` `grounding_verdicts` EMITTED a route-assigned code: ['unbound_retrieval'] `` — PROPERTY 2 only; **PROPERTY 1 stayed green**, which is the isolation that matters | `grounding.py: OK` |
| **P-25a** | 187-28 T3 | restored the `canvas-only` phrasing | `test_the_stale_claim_phrases_are_gone_from_the_module` | `workflows.py: OK` |
| **P-25b** | 187-28 T3 | restored the *"not scoped to change what publishes"* phrasing | same case, other needle | `workflows.py: OK` |
| **P-25c** | 187-28 T3 | restored the stale inventory digit `2` | `test_the_inventory_comment_states_the_real_set_size` — the count pinned by comparison to `len()`, never by fixing the digit | `workflows.py: OK` |
| **P-25d** | 187-28 T3 | renamed `SERVER publish GATE` so the two surfaces stop being named | `test_the_corrected_comment_names_both_halves_and_points_at_its_evidence` | `workflows.py: OK` |
| **P-26** | 187-28 T3 | removed `\| _ROUTE_ASSIGNED_CODES` from `_KNOWN_CODES` | `assert 'business_requirement' in frozenset({...})` — PROPERTY 3 | `workflows.py: OK` |
| **P-27** | 187-28 T3 | **deleted `?? validation.verdicts[0]`** from `blockedReason` — the exact "fix" someone would reach for after reading the OLD comment | `Expected: "phase 'research' reads your documents, but this workflow is not bound to a knowledge base — it would search everything"` / `Received: "Not checked yet."` · `Tests 1 failed \| 3 passed \| 124 skipped (128)`. **Exactly one case red — the incomplete-only one**; both controls stayed green | `WorkflowBuilderPage.tsx: OK` |
| **P-28** | **187-29 T1** | deleted one genuine `it(` block from **`DescribeKbPicker.test.tsx`** — lines 447-449, `it("the fetch spy recorded exactly 0 calls", …)` | `DescribeKbPicker.test.tsx  30  29  -1` · `RESULT: COUNT GATE VIOLATED (2 reason(s))` · `FAIL [count-decrease] DescribeKbPicker.test.tsx — pinned 30, ran 29 (-1). A test was deleted or skipped away.` ⚠ **`failed 1` on this sample, and it is NOT the deleted block** — see the note below | sidecar restore; `sha256sum -c` → `frontend/src/components/workflows/DescribeKbPicker.test.tsx: OK`; `git diff --numstat -- <file>` **empty** |
| **P-29** | **187-29 T1** | deleted one genuine `it(` block from **`ProblemsTray.test.tsx`** — lines 516-528, `it("held-stale findings still render under \`not-run\`…", …)` | `ProblemsTray.test.tsx  30  29  -1` · `total 2167 · failed 0` · `RESULT: COUNT GATE VIOLATED (1 reason(s))` · `FAIL [count-decrease] ProblemsTray.test.tsx — pinned 30, ran 29 (-1). A test was deleted or skipped away.` — **`failed 0`, ONE reason: the count decrease is the ONLY signal**, which is the entire reason this gate exists | sidecar restore; `sha256sum -c` → `OK`; `git diff --numstat` **empty** |
| **P-30** | **187-29 T1** | deleted one genuine `it(` block from **`verdictModel.test.ts`** — lines 377-393, `it("the CONTROLS — the class speaks about WORDS, and it provably fires", …)` | `verdictModel.test.ts  29  28  -1` · `total 2167 · failed 0` · `RESULT: COUNT GATE VIOLATED (1 reason(s))` · `FAIL [count-decrease] verdictModel.test.ts — pinned 29, ran 28 (-1). A test was deleted or skipped away.` — again **`failed 0`** | sidecar restore; `sha256sum -c` → `OK`; `git diff --numstat` **empty** |

⚠ **`it.skip` is not a valid deletion probe and was not used.** The gate counts
`assertionResults.length`, which **includes** skipped cases, so a skip leaves the count unmoved and
proves nothing. All three blocks above were genuinely removed, by a helper that lives **outside** the
watched tree (the project's no-scratch-in-a-watched-tree rule) and prints the exact line range it cut.

⚠ **`git checkout --` was NOT used to revert any probe** (the 187-24 lesson: it restores to HEAD and
would wipe an uncommitted task edit). Each probe used a sidecar copy that reverses exactly what it
applied, and each restore was proved by `sha256sum -c` **and** an empty `git diff --numstat`, rather
than assumed.

#### P-28's coincident failure, attributed rather than waved past

P-28's sample reported `failed 1` alongside its `[count-decrease]`. The plan's own stop-and-report
rule applies, so the failing FULLNAME was extracted from the gate's own JSON report rather than
guessed:

```
FILE:     WorkflowBuilderPage.canvas.test.tsx
FULLNAME: WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)
          > POSITIVE CONTROL — with the flag ON the very same read finds the key
MSG:      AssertionError: expected 0 to be greater than 0
```

That is **`D-ITEM-187-25-01` verbatim** — same file, same fullname, same message. Its per-file count
in that same sample was **128**, identical to every other sample in this round, so it is a
`[failing-tests]` reason and never a count reason. It is a **different file** from the one P-28
probed, and P-29 and P-30 — run minutes later against the same tree — both reported `failed 0`.
**No pin was lowered for it**, and it is recorded as a recurrence under the existing deferred item
rather than as a new one.

#### The harness hazard this round establishes as a standing rule

187-27's first attempts at **P-19 and P-20 both reported GREEN, and both were false readings**: the
working-tree edit did not survive between the tool call that applied it and the tool call that ran
`vitest`, so the suite ran against **unprobed source**. The diagnosis was made by instrumenting the
assertion to print its inputs, not by assuming.

> **The rule, for every future probe in this project: apply the probe and run the measurement in ONE
> tool call.** A probe applied in one call and measured in the next is not a falsification; it is a
> green light with nothing behind it.

Both went red immediately once re-run that way. 187-28 drove all eight of its probes that way from the
start, and P-28/P-29/P-30 above were each a single tool call that copied the sidecar, cut the block,
ran the gate, restored and verified the restore.

### (al) GATES — re-measured at the round-5 tip, not carried forward

Every figure below came from a command run **at this commit**, with raw output pasted.

**(al-1) The round-5 named set — count-guarded**

⚠ Run **isolated**, never as part of the full frontend suite (measured 42–49 failures, flaky at one
commit). The Phase-177 lesson applies: the **COUNT** is the gate, not only the failure number.

```
$ cd frontend && npx vitest run \
      src/components/workflows/DescribeKbPicker.test.tsx \
      src/components/workflows/WorkflowDoorSwitch.test.tsx \
      src/components/workflows/verdictModel.test.ts \
      src/components/workflows/ProblemsTray.test.tsx \
      src/components/workflows/WorkflowCanvas.test.tsx \
      src/pages/WorkflowBuilderPage.describe.test.tsx \
      src/pages/WorkflowBuilderPage.canvas.test.tsx
 Test Files  7 passed (7)
      Tests  292 passed (292)
EXIT=0
```

**Files 7 · passed 292 · failed 0.** The seven per-file counts the gate reports at this commit
(30 + 21 + 29 + 30 + 35 + 19 + 128) sum to **292** exactly, so the set total and the gate's per-file
table are two independent readings that agree.

**The "before" is DERIVED at this commit, never inherited.** Declared case literals counted in the
round-5 base blob and the HEAD blob:

```bash
for f in <the seven paths>; do
  git show 15339441:$f | grep -cE '^[ \t]*(it|test)(\.each\(|\.skip)?\('
  git show HEAD:$f     | grep -cE '^[ \t]*(it|test)(\.each\(|\.skip)?\('
done
```

| Suite | literals `15339441` → `HEAD` | Δ | Which plan moved it | ran at HEAD |
|---|---|---|---|---|
| `DescribeKbPicker.test.tsx` | **0 → 30** | **+30** | 187-26 (net-new file) | **30** |
| `WorkflowDoorSwitch.test.tsx` | 13 → 21 | **+8** | 187-26 | **21** |
| `verdictModel.test.ts` | 25 → 29 | **+4** | 187-27 | **29** |
| `ProblemsTray.test.tsx` | 26 → 30 | **+4** | 187-27 | **30** |
| `WorkflowCanvas.test.tsx` | 35 → 35 | **0** | 187-27 touched the source only, added no case | **35** |
| `WorkflowBuilderPage.describe.test.tsx` | 12 → 15 | **+3** | 187-26 | **19** |
| `WorkflowBuilderPage.canvas.test.tsx` | 114 → 125 | **+11** | 187-27 (+7), 187-28 (+4) | **128** |
| **total Δ** | — | **+60** | | **292** |

**Every delta is non-negative — no suite was replaced rather than extended.** ⚠ Absolute literal
counts do **not** equal run counts (`it.each` expands one literal into several cases —
`WorkflowBuilderPage.describe.test.tsx` declares 15 and runs 19, and the canvas suite declares 125 and
runs 128), which is why only the **deltas** are used as the instrument.

**(al-2) The count gate — and the three new pins**

Sampled **twice before** the pin edit and once after, all at this commit's source:

```
$ node scripts/vitest-count-gate.cjs          # pre-pin, samples 1 and 2 — IDENTICAL
  definitionOps.test.ts                       232     232       0
  canvasModel.fixtures.test.ts                100     100       0
  canvasModel.purity.test.ts                   69     143     +74
  SeedReceipt.test.tsx                         68      68       0
  phaseVocabulary.test.ts                      33      96     +63
  WorkflowCanvas.test.tsx                      31      35      +4
  canvasModel.test.ts                          26      49     +23
  PublishGauntlet.test.tsx                     24      46     +22
  WorkflowBuilderPage.canvas.test.tsx          22     128    +106
  PhaseFormPanel.test.tsx                      19      19       0
  WorkflowBuilderPage.test.tsx                 15      15       0
  PhaseSpineGraph.test.tsx                     14      20      +6
  soulData.test.ts                             14      14       0
  WorkflowDoorSwitch.test.tsx                  13      21      +8
  PhaseSpine.test.tsx                          11      11       0
  deriveTier.test.ts                            9       9       0
  WorkflowSoul.test.tsx                         8       8       0
  revertByteIdentical.test.tsx                  7       7       0
  … 20 unpinned files reported `new`, among them:
  DescribeKbPicker.test.tsx                     —      30     new
  ProblemsTray.test.tsx                         —      30     new
  verdictModel.test.ts                          —      29     new
  total                                       715    2168   +1453
  total 2168  ·  failed 0  ·  pinned total 715
count gate OK — 18/18 pinned files present, no per-file decrease, 0 failing.
GATE_EXIT=0
```

```
$ node scripts/vitest-count-gate.cjs          # post-pin
  …
  DescribeKbPicker.test.tsx                    30      30       0    ← NEW PIN (187-29)
  ProblemsTray.test.tsx                        30      30       0    ← NEW PIN (187-29)
  verdictModel.test.ts                         29      29       0    ← NEW PIN (187-29)
  …
  total                                       804    2168   +1364
  total 2168  ·  failed 0  ·  pinned total 804
count gate OK — 21/21 pinned files present, no per-file decrease, 0 failing.
GATE_EXIT=0
```

**Exit 0. Every previously-pinned file reports delta ≥ 0 — not one decreased, and not one was lowered
by a single test.** Pinned total **715 → 804** (+30 +30 +29). The success line moved **18/18 → 21/21**
on its own, because 187-25 made that count **derived from the map**; `BASELINE_TOTAL` is likewise still
a `reduce` over the map, so neither can print a false figure on a green gate.

**All three pin numbers were read from the gate's own `actual` column**, over **two agreeing pre-pin
samples**, and none was hand-counted. The prohibition is not fastidiousness: `definitionOps.test.ts`
declares ~122 `it(` literals and runs **232** cases, so a hand count would have pinned a fiction by
~110 — **and a pin below the real count can never fire.** The deletion probes that prove these three
pins bite are **P-28, P-29 and P-30** in §(ak).

**This is an EXTENSION, not a lowering, and the script's header now says so in those terms.** An
extension has no deletion behind it and needs none; only a **LOWERING** requires a deliberate,
plan-authorised deletion riding in the same commit (185-08's precedent). Nothing was removed by this
plan and no existing pin moved.

⚠ **`PublishGauntlet.test.tsx` did NOT flake in either pre-pin sample or the post-pin sample** — 46
passing, `failed 0`, three times. 187-28 recorded it red on both of its samples. Both readings are
recorded; see §(ap) for what that pattern means and why "fix it" now outranks "prove it a fourth
time".

**(al-3) The zero-migration gate — proved three ways**

```
$ git diff --stat 35261e96 HEAD -- supabase/migrations     ← (empty — 0 lines)
$ git diff --stat 15339441 HEAD -- supabase/migrations     ← (empty — 0 lines)
$ git status --porcelain supabase/migrations               ← (empty — 0 lines)
```

**All three empty.** Measured from the **phase** base *and* the **round-5** base, so truth #11
(*"Zero migrations added by this phase, including the closure rounds"*) survives round 5 on its own
evidence rather than on round 4's.

**(al-4) The backend half — and a correction to this plan's own expectation**

⚠ **The plan's §C.7 says the backend diff shows *"exactly the one comment-only file plus round 5's
test file"*. Measured, it is THREE files, not two:**

```
$ git diff --name-only 15339441 HEAD -- backend/
backend/app/api/workflows.py
backend/tests/unit/test_182_severity_codes.py
backend/tests/unit/test_187_route_assigned_reach.py
```

The third is `test_182_severity_codes.py`, added by **187-28 Deviation 1**: that file's own D-187-11
comment carried the *same* stale `canvas-only` claim, in the file the corrected comment cites as the
existing membership guard. Leaving it would have shipped the defect the plan exists to close, one file
over. **Both** edited files are comment-only, and that is proved rather than asserted:

```
$ git diff -U0 15339441 HEAD -- backend/app/api/workflows.py \
    | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-]#' | wc -l
0
$ git diff -U0 15339441 HEAD -- backend/tests/unit/test_182_severity_codes.py \
    | grep -E '^[+-]' | grep -vE '^(\+\+\+|---)' | grep -vE '^[+-][ \t]*#' | wc -l
0
```

**Zero added-or-removed non-comment lines in either.** The unit tree, at this commit:

```
$ cd backend && ./venv/Scripts/python.exe -m pytest tests/unit -q --no-header
62 failed, 1700 passed, 2 xfailed, 2 xpassed, 32 warnings in 17.77s
```

**Collection 1766. Failures unchanged at 62 — the pre-existing-rot figure §(d) records and 187-28
re-derived at the base tree (62 / 1693 / 2 / 2 = 1759).** The +7 is **derived here, not inherited**:

```
$ pytest tests/unit/test_187_route_assigned_reach.py -q --no-header
7 passed
```

`1766 − 7 = 1759`, which is 187-28's independently-measured base collection exactly. **Zero new
failures; collection did not fall.** The round's named backend set:

```
$ pytest tests/unit/test_187_route_assigned_reach.py tests/unit/test_182_severity_codes.py \
         tests/unit/test_182_validate.py tests/unit/test_harness_models.py \
         tests/unit/test_185_engine_attachment.py -q --no-header
71 passed
```

**(al-5) The D-187-14 mount cap — spent to the round's cap, with the third deletion a NAMED spend**

```
$ git diff --numstat 15339441 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx
15	3	frontend/src/pages/WorkflowBuilderPage.tsx
```

**15 insertions / 3 deletions, against the round budget of ≤ 15 / ≤ 3. At the cap, not over it.** The
arithmetic the plan asks to be shown: **187-26 spent 6 / 1** (its own `--numstat`, recorded in its
SUMMARY) **plus 187-27's 9 / 2 = 15 / 3**. 187-28 spent **zero** — it touches the page's *test* file
only. 187-27's first draft of its fourth edit measured **16** insertions; the ternary was collapsed
onto one line rather than the budget renegotiated.

⚠ **The third deletion is one over the ≤ 2 the phase had held, and it is recorded as a NAMED SPEND,
never as a renegotiated budget.** It was claimed **in advance and by name** in `187-27-PLAN.md`, under
the §(a2) "single named allowance" precedent this file already established for the phase's own
unbudgeted row 9. A budget that is quietly re-priced after the fact is not a budget.

**The stronger property D-187-14 literally constrains is the RENDER BODY, and it is unchanged.**
Measured with §(a1)'s added-lines-only method (`[ \t]`, not `[[:space:]]` — the latter does not work
inside a bracket expression on this machine's grep):

```
$ D=$(git diff 15339441 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx)
$ echo "$D" | grep -cE '^\+[ \t]*<[A-Z]'                             # new JSX elements
0
$ echo "$D" | grep -cE '^\+[ \t]*(function|const [A-Za-z]+ = \()'    # new declarations
0
$ echo "$D" | grep -cE '^\+[ \t]*[a-zA-Z][a-zA-Z0-9]*=\{'            # new props on JSX elements
0
```

**Zero new JSX elements, zero new props on any JSX element, zero new declarations.** And the three
deletions, pasted verbatim, are each a hook argument, a `useState` initializer and a `useMemo` object
field — **not one of them is in the render body**:

```diff
-    typeof initial?.definition.project_folder_id === "string" ? initial.definition.project_folder_id : "",
-  const validation = useLiveValidation(definition as WorkflowDefinitionJSON | null, hasEdited)
-      degraded: storeDegraded === null ? null : storeDegraded.kind === "422" ? "unreadable" : "unreachable",
```

G-1 is honoured by construction on this 1851-line hot file: both new surfaces (`DescribeKbPicker`, the
`isCheckOutstanding` rule) live in their **own** files. The page gained mounts and a branch — not a
feature.

**(al-6) `tsc --noEmit -p tsconfig.app.json` against the `D-ITEM-01` baseline**

```
$ cd frontend && npx tsc --noEmit -p tsconfig.app.json ; echo $?
2
$ grep -c 'error TS'                            → 33
$ wc -l                                          → 61   (several errors emit indented continuations)
$ grep -c 'src/components/workflows/'           → 0
$ grep -c 'src/pages/WorkflowBuilderPage'       → 0
$ grep -c 'scripts/'                            → 0
```

| | Before (`D-ITEM-01`, re-derived by 187-26/27/28 at every task) | **After (measured now)** |
|---|---|---|
| total `error TS` lines | 33 | **33** — zero delta |
| raw output lines | 61 | **61** |
| errors in `src/components/workflows/` | 0 | **0** |
| errors in `src/pages/WorkflowBuilderPage*` | 0 | **0** |

⚠ **`D-ITEM-187-23-02` re-confirmed by measurement at the round-5 tip: the bare form is VACUOUS.**

```
$ cd frontend && npx tsc --noEmit ; echo $?
0        ← ZERO output, ZERO error lines
```

The root `frontend/tsconfig.json` is a **solution file** with `files: []`, so the bare command
type-checks **zero files**. It cannot reproduce the 33-error baseline and — the part that matters —
**it cannot detect a new error either.** Any criterion spelled `npx tsc --noEmit` must be read as
`-p tsconfig.app.json`. ⚠ Separately, `tsc -b` ≠ `tsc --noEmit` (the v3.3 lesson) — two distinct traps
in the same area.

**(al-7) `vite build`**

```
$ cd frontend && npx vite build ; echo $?
✓ built in 4.44s
0
```

**Exit 0.**

**(al-8) No false completion record**

```
$ git status --porcelain .planning/REQUIREMENTS.md .planning/STATE.md .planning/ROADMAP.md
                                            ← (empty — 0 lines, measured before this plan's own writes)
```

Neither `requirements.mark-complete`, `state.advance-plan` nor `roadmap.update-plan-progress` was
called by **any** executor in round 5 — all three write false records in this project. Each of
187-26, 187-27 and 187-28 states this explicitly in its own SUMMARY's *"State writes"* section, naming
the ROADMAP edits it made **by hand** and confirming each is individually true.

⚠ **Stated plainly rather than left to be discovered:** `.planning/STATE.md` and `.planning/ROADMAP.md`
**do** appear in the round's file list (§(al-9)). Those are the **orchestrator's** tracking writes,
which is whose job it is, plus the per-plan hand edits each executor documents. **`REQUIREMENTS.md` was
not touched at all** — its VOCAB-01/02/03 rows still read Pending, which is correct until
re-verification says otherwise, and several of their truths are gated on manual rows that have not
been run.

⚠ **One `STATE.md` write in this range was a REPAIR, not a routine update, and it is named because it
is the exact class this guard exists for.** 187-26 found `STATE.md` already dirty before it started,
with an SDK/orchestrator write that had **regressed** `last_activity` from the true round-4 statement
back to *"Phase 187 execution started"*, rewound `last_updated`, and rewritten a line inside a block
explicitly marked *"(Historical, superseded…)"* — changing 185's `Plan: 1 of 25` to `1 of 29`. 187-26
repaired all three rather than committing a laundered regression. Recorded here so the repair is
auditable rather than invisible.

**(al-9) The round's full file list — measured, not asserted**

```
$ git diff --name-only 15339441 HEAD
.planning/ROADMAP.md
.planning/STATE.md
.planning/phases/187-…/187-26-PLAN.md
.planning/phases/187-…/187-26-SUMMARY.md
.planning/phases/187-…/187-27-PLAN.md
.planning/phases/187-…/187-27-SUMMARY.md
.planning/phases/187-…/187-28-PLAN.md
.planning/phases/187-…/187-28-SUMMARY.md
.planning/phases/187-…/187-29-PLAN.md
.planning/phases/187-…/deferred-items.md
backend/app/api/workflows.py
backend/tests/unit/test_182_severity_codes.py
backend/tests/unit/test_187_route_assigned_reach.py
frontend/src/components/workflows/DescribeKbPicker.test.tsx
frontend/src/components/workflows/DescribeKbPicker.tsx
frontend/src/components/workflows/ProblemsTray.test.tsx
frontend/src/components/workflows/ProblemsTray.tsx
frontend/src/components/workflows/WorkflowCanvas.tsx
frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx
frontend/src/components/workflows/WorkflowDoorSwitch.tsx
frontend/src/components/workflows/verdictModel.test.ts
frontend/src/components/workflows/verdictModel.ts
frontend/src/pages/WorkflowBuilderPage.canvas.test.tsx
frontend/src/pages/WorkflowBuilderPage.describe.test.tsx
frontend/src/pages/WorkflowBuilderPage.tsx
scripts/vitest-count-gate.cjs
```

**Thirteen frontend/backend source files, one script, ten planning documents, nothing else.**
(Measured *before* 187-29's own doc commit, which adds this file and `187-29-SUMMARY.md`.)
`StarterTemplatePicker.tsx` / `.test.tsx` do **not** appear — the WR-08 fence of §(ac) holds through
round 5 as well. Neither `SeedReceipt.tsx` nor `definitionOps.ts` appears either: round 5 touched no
part of the Req-5 receipt estate rounds 2–4 built.

### (am) An artifact contract this round did NOT meet literally — the `unchecked` → `not-run` rename

`187-27-PLAN.md`'s `must_haves` require the literal string **`unchecked`** in three files
(`contains: "unchecked"`) and a key-link `pattern: "unchecked"`. **Those criteria do not hold
literally, and this is recorded as a deviation from the planned artifact contract rather than as a
satisfied one.**

The word is on the **shipped graded-governance never-say list**
(`references/graded-governance.md` §VOCABULARY, binding — *"Free to think"*, never *"Ungoverned"* /
*"unchecked"*, because *"Judgement is not a gap"*), and
`frontend/src/components/workflows/governanceVocabulary.test.ts` builds its `BANNED_WORDS` from
assembled fragments (`tok("Unch","ecked")`, ~line 138) and sweeps **every string literal** in the
workflows tree and the Builder page with the TypeScript parser. Both the literal type member and the
page's discriminant tripped it:

```
expected [ './verdictModel.ts', …(1) ] to deeply equal []
```

The member shipped as **`not-run`**, and `verdictModel.ts` carries a **DO NOT "TIDY" THIS SPELLING**
paragraph naming the fence so the next reader does not rename it back and red the gate.

**Why the rename beat the exemption, stated as a choice:** the alternative was adding an exemption to
a shipped governance fence to fit a spelling — weakening a guard whose bluntness is deliberate. It does
not care whether a literal is user copy or a machine discriminant, precisely because the way banned
copy actually arrives is somebody lifting a nearby machine token into a sentence.

**What holds and what does not, stated separately:**

- ❌ the literal token `unchecked` in `verdictModel.ts` / `ProblemsTray.test.tsx` /
  `WorkflowBuilderPage.canvas.test.tsx` — **does not hold**
- ✅ the criteria's **intent** — a named third member reaching all three files, and a page→tray link
  carrying it — **holds under the token `not-run`**
- ✅ the user-facing sentence, *"Not checked yet."*, is unaffected either way

### (an) THE SEEDED-ROWS CAVEAT — binding on every row in this round, verbatim in effect

**Operator, 2026-08-04:** the **73 local drafts / 68 published rows** in `workflow_definitions` are
**test data of unknown vintage**, and some predate the v3.6 canvas work entirely.

> **Every round-5 row must ALSO be performed against a FRESHLY GENERATED draft. An assertion made only
> against a legacy row is not evidence about what the CURRENT authoring path produces, and a shape
> found in an old row is not a regression until the row's write date is checked.**

This is a **rule binding M15, M16 and M17 below**, and it is not a footnote about tidiness. It is a
statement about what a measurement means:

- **M15** asks whether a draft is **born bound**. A legacy row's `project_folder_id` was written by
  whatever path existed on its write date, so reading it says nothing about the path 187-26 built.
- **M16** asks what a draft says **in its first second**. Opening a seeded row exercises the same
  validate-on-open code, but the *content* of the answer depends on the row's shape — so a seeded row
  can accidentally return `ok:true` and hide the very window the row is testing.
- **M17** asks whether the fast path is **still one click**. It is only measurable on a generation
  that actually happens.

The three round-5 SUMMARYs each record this caveat as owed on their own row. It is restated here as
the single binding statement, so no future reader has to reassemble it from three places.

### (ao) STALE-ROW SWEEP — no shipped row was made stale by round 5, and that is measured

Round 4 amended three notes because two of them named **strings the product no longer emits**. The
same sweep was run for round 5, and its result is the opposite — which is recorded **with the
evidence**, because round 4's own plan asserted two stale rows that turned out not to exist.

Round 5's user-visible changes are exactly two: a knowledge-base picker on the loose describe door
(187-26), and the problems tray + publish trigger telling the truth about a check that has not run
(187-27). 187-28 changes nothing a user sees. So the sweep needed to answer one question: **does any
shipped row M1–M14 assert the tray's resting wording, or the publish trigger's availability?**

```bash
$ sed -n '<the Manual-Only table>p' 187-VALIDATION.md \
    | grep -oE "checks pass|checked by the server|Nothing to fix|Nothing outstanding|Publish|publish"
      1 publish
```

**Exactly one hit, and it is not about the publish control.** It is inside **M13**'s check (5), quoting
the receipt card's own closing sentence — *"Everything else is yours to change. Nothing is saved or
published yet."* — a string round 5 did not touch (`SeedReceipt.tsx` and `definitionOps.ts` do not
appear in §(al-9)'s file list at all).

**Conclusion, stated rather than assumed: no shipped row is stale, none needed striking through, and
none was struck through.** Nothing was ticked, softened, re-scoped or dropped.

**One row gains a clarifying NOTE without any change to its expectation — M8.** See §(ap) for the
finding behind it: `WorkflowDoorSwitch` reads no feature flag (its own docblock, line 82: *"This shell
does NOT read the canvas flag at all"*), so the picker 187-26 mounts at line 257 renders on the loose
door **regardless** of `visual_workflow_canvas`. M8's subject is the **Builder's** first screen, which
is a different surface and is byte-identical on the flag-off path — so the row's expectation is
**unchanged and still owed**. The note exists only so an operator running M8 does not meet the door's
picker on the way there and conclude D-181-01 has broken.

### (ap) Deferred items opened or extended by this round

| Id | Status | What | Re-open trigger |
|---|---|---|---|
| `D-ITEM-187-20-01` | **EXTENDED — third and fourth measurement** | The `PublishGauntlet.test.tsx` parallel flake. **187-28 measured it red on both its samples and proved non-attribution** by rolling `WorkflowBuilderPage.canvas.test.tsx` back to `67b8025d` and reproducing `failed 2` with the identical two case names at 187-27's exact total. **The orchestrator then re-ran the file ISOLATED at HEAD after 187-28: 46/46 passed, 25.6 s.** And **this plan's five gate samples at HEAD all reported `PublishGauntlet` at 46 with `failed 0`.** Two separate plans have each now spent a measurement proving non-attribution, and a third party has measured it green in isolation | unchanged (whichever phase next touches `PublishGauntlet.tsx`, or a dedicated flake-hunt). **Standing recommendation, on the evidence: FIX IT rather than prove it a fourth time.** No pin was lowered, and none may be lowered to make this gate green |
| `D-ITEM-187-25-01` | **EXTENDED — recurrence** | The second parallel flake, `WorkflowBuilderPage.canvas.test.tsx`'s 184-11 rails positive control. It **recurred once in this round**, on the P-28 probe sample, with the identical FULLNAME and `AssertionError: expected 0 to be greater than 0`. Its per-file count was **128** in that sample, as in every other — a `[failing-tests]` reason, never a count reason | unchanged — Phase 188's `WorkflowCanvas.tsx` extraction |
| `D-ITEM-187-29-01` | **NEW** | `WorkflowDoorSwitch` reads **no** feature flag, and 187-26's `DescribeKbPicker` mount is unconditional — so a flag-OFF user meets the new picker on the loose *"Describe & run"* door. Not a D-181-01 violation as that decision is literally scoped (its subject is the **Builder** page, which 187-26 leaves byte-identical when the prop is absent), and the door's flag-blindness **predates** round 5. But it is a new control on a screen a flag-off user reaches, and nothing in the phase measures that | the next plan that touches `WorkflowDoorSwitch`, or any plan that must be able to revert the v3.6 surfaces from the flag alone — decide then whether the door joins D-181-01's fence or is deliberately outside it, and **write the decision down either way** |

### What round 5 proved — and what it did NOT

**Proved.** GAP A is closed at the **root** — the loose door can bind a knowledge base **before** the
AI generates, proved on the request the client actually sends rather than on a prop being present, and
the fast path is unchanged (the CTA is still enabled by text alone and one click still hands off).
GAP B is closed **in both halves at once**, because either alone is a new defect: a draft opened into
the canvas now issues a check, and until it answers Publish is disabled with an honest sentence
instead of claiming *"the static checks pass · checked by the server"* over a check nobody made.
GAP C's stale claim is corrected **and both halves of the corrected sentence carry a behavioural
fence**, with the source grep ranked beneath the property in source. Eighteen probe mutations were
observed RED and every revert was sha256-proved. The three suites carrying this round's honesty estate
are pinned from numbers the gate printed, each observed catching a deletion. Zero migrations three
ways, zero non-comment backend lines, zero `tsc` delta, `vite build` exit 0, the named set up +60 with
nothing dropped, and the mount cap spent to 15/3 with the render body unchanged.

**Not proved.**

- **Nothing on the manual board.** All **seventeen** rows (M1–M17) remain **UNPERFORMED**. They are the
  operator's. M15, M16 and M17 are net-new and unperformed like the rest; **authoring a row is not
  performing it.**
- **`BUG-260731-03` still cannot close.** Its trigger needs both halves observed **live**, and round 5
  performed no manual row. 187-26 materially advanced the *control* half (the third creation path now
  offers the choice) and 187-28 pinned the *verdict* half at the wire and state-machine level — but
  the verdict has still never been observed in a browser, and the report's frontmatter is byte-unchanged.
- **The `unchecked` artifact criteria do not hold literally** — §(am). Their intent holds under
  `not-run`.
- **`WR-08` is still Phase 188's**, and **`D-ITEM-187-23-01` / `D-ITEM-187-24-01` are still open** —
  round 5 touched neither the grounding-dial copy nor any `phaseVocabulary` export.
- **`WR-01`, `WR-04`…`WR-07`, `IN-01`…`IN-05` and `IN-11`…`IN-14` remain open**, unchanged in
  `187-REVIEW.md`.
- **The three ❌ SC#10 rows are untouched.** OpenRouter's non-deterministic name drop, OpenAI's
  `gpt-5.6-sol` endpoint refusal and MiniMax's non-emission are provider-side; nothing in round 5 could
  move them and nothing tried.
- **The parallel-run flake class is still there** and now has three entries' worth of measurement
  behind it (§(ap)). Five samples at this commit landed at `PublishGauntlet` 46 / `failed 0`; that is a
  sample, not a fix.
- **187-27's shipped *"the FIRST edit starts the loop"* case is now weaker but still true** — with
  validate-on-open the mount already schedules one, so the case no longer isolates the edit as the
  cause. Left in place and recorded by 187-27 as a **known** weakening rather than a discovered one;
  the edit-driven loop stays falsified by P-19 and by D-185-19's rewritten positive control.

---

## Wave 0 Requirements

- [x] `backend/tests/unit/test_187_armed_checkpoint_property.py` — SC#6 property, **observed RED first**
      (plan 187-01; falsification re-observed in 187-11 Task 3)
- [x] `backend/tests/unit/test_187_authoring_step_names.py` — Req 2 + the 8-row SC#10 roster
      (roster derived from `MODEL_CAPABILITIES` by grouping on `provider`, **never re-typed**;
      187-07 measured that `settings` is a plain parameter, so the rows are independent and the SPEC's
      serial/global-mutation assumption is superseded — recorded under §"SPEC refutations" below)
- [x] `frontend/src/components/workflows/SeedReceipt.tsx` + `.test.tsx` — Req 5 (plan 187-13, 33 tests)
- [x] `frontend/src/components/workflows/StarterTemplatePicker.tsx` + `.test.tsx` — Req 6
      (plan 187-14, 40 tests)
- [x] `frontend/src/components/workflows/phaseVocabulary.corpus.test.ts` — SC#5 checks 1 & 2 over the
      named corpus as a **pure-function** assertion (plan 187-12)
- [x] A **flag-OFF describe-screen pin** (D-181-01) — `WorkflowBuilderPage.describe.test.tsx`
      (plan 187-05, captured against the UNMODIFIED page in wave 1; still green, literal unedited)
- [x] A structural **zero-migration** gate for the phase — measured above, §(b)
- [x] Framework install: **none needed** — confirmed, `frontend/package.json` untouched

---

## Manual-Only Verifications

**G-4 lived-experience gate — wire format + screenshot are insufficient.**

| # | Behavior | Requirement | Why Manual | Test Instructions |
|---|----------|-------------|------------|-------------------|
| M1 | Every node face says what *that* step does | Req 1 / SC#5 | "Reads distinctly to a business user" is a judgement | Generate a real 5-step workflow; read every face aloud |
| M2 | The plain title survives the ⌥ reveal; layout does not jump | Req 4 | Height/jump is perceptual | Toggle ⌥ Technical-names ON/OFF ×3 on **both** views |
| M3 | The receipt arrives once, seal pulses once, implies nothing still-deciding | Req 5 | Temporal + perceptual | **UNBLOCKED 2026-08-02, further REPAIRED 2026-08-03 — still UNPERFORMED and UNTICKED.** *History kept, not overwritten:* `187-VERIFICATION.md` originally held this row with its blocking reason recorded verbatim — *"NOTE: fix the CR-01 gap before running this, or the operator will be confirming a receipt that lies."* **CR-01 was closed by plan 187-16** (commits `77668751` RED, `5c613bf4` GREEN); the receipt no longer states a governance action the AI did not take, so the hold no longer applies. Round 2's re-verification then attached a **second** warning to this row, telling the operator to also read the carried sentence against the per-step reasons because an escalated draft showed an internally-contradictory card (CR-03 / WR-09). **That second warning is STALE as of plan 187-20** (`debced07` RED → `51a60299` GREEN → `7593fe8b` guard): the carried sentence now attributes **no cause at all** — it reads *"1 step was already set to must prove it."* — so there is no contradiction left to look for and no reason to go hunting for one. **What the operator should now see:** the receipt arrives as ONE batch; the carried paragraph states the count and the seal and says nothing about *what* applied it; each row beneath names its own cause. **Unblocking a row is not performing it, and neither is repairing it.** To perform: watch arrival on a throttled connection on a REAL generated draft — the receipt enters ONCE as one batch, the seal pulses once, and nothing on the card reads as still-deciding. ⚠ `187-VERIFICATION.md`'s own `human_verification` entry for M3 still carries the stale CR-03/WR-09 wording; that file belongs to the verifier and is amended at re-verification, not by this plan — named here so the two are not silently in conflict. **AMENDED 2026-08-04 by plan 187-22 (CR-04) — still UNPERFORMED and UNTICKED.** This row's last clause — *"nothing on the card reads as still-deciding"* — got a second, sharper meaning that did not exist when it was written. Before 187-22 the card was wired to a **live** store selector, so it kept re-computing forever: it was not merely *reading* as still-deciding, it genuinely **was** still tracking, and an edit made ten seconds after arrival would silently rewrite its sentences. After 187-22 the card renders an **arrival snapshot** and stops. **What the operator should now see:** once the receipt has arrived, it is finished — a frozen account of the generation, not a live readout. The dedicated head-on read of that property is the new **M14**; this row keeps its original scope (the *arrival*: once, one batch, one pulse) and simply no longer has a moving target underneath it. |
| M4 | The face tracks a skill bind/unbind without a save and without flicker | Req 1 | The async-map settle is only visible live (Pitfall 1) | Bind a skill to a step, then unbind, watching the face |
| M5 | The seeded describe text reads like something a person typed | Req 6 | Copy quality | Pick each of the 3 templates |
| M6 | **SC#6 live** — armed checkpoint cannot be preempted | Req 7 / SC#6 | Needs a live Redis rendezvous + a real browser answer | Run an armed phase carrying a `timing="pre"` `ask_user` validator. Answer the author's gate **Proceed**; confirm the armed checkpoint appears in the chat `PendingAskCard`. **Refuse** it. Confirm the step did NOT run and `harness_audit` has **zero** `validator_ask_user_approved` rows for it. |
| M7 | **SC#10 live row** — the env path reaches `resolve_authoring_model` | SC#10 | Requires a backend restart | Restart backend with `HARNESS_AUTHORING_MODEL` set; generate; confirm the model actually used |
| M8 | Flag-OFF Builder first screen is byte-identical to today | D-181-01 | No shipped test covers it | Turn `visual_workflow_canvas` OFF; open the Builder's first screen; confirm no template line. **CLARIFIED 2026-08-04 by plan 187-29 — the expectation above is UNCHANGED, and the row is still owed.** Round 5 touched `WorkflowBuilderPage.tsx` (15 ins / 3 del, §(al-5)) and **none of it is on the flag-OFF path**: a `useState` initializer, a hook argument, a `useMemo` field, one import, one flag-gated branch and comments — 0 new JSX elements, 0 new props, 0 new declarations, and the flag-off byte-identity guards (`revertByteIdentical.test.tsx`, `WorkflowBuilderPage.header.test.tsx`) are green in every gate sample. **What you WILL newly see, on a different screen, so it does not surprise you into a false failure:** the loose *"Describe & run"* **door** now offers a knowledge-base picker **regardless of the flag** — `WorkflowDoorSwitch` reads no feature flag at all (its own docblock: *"This shell does NOT read the canvas flag at all"*) and 187-26's mount is unconditional. That door is **upstream of** and **distinct from** the Builder's first screen, which is this row's subject; the shell's flag-blindness predates round 5. It is logged as **`D-ITEM-187-29-01`** rather than swept in — deciding whether the door belongs inside D-181-01's fence is a decision, and it has not been made. If you see the picker on the **Builder's** own first screen with the flag OFF, that IS a failure of this row; on the door, it is the known item. |
| **M9** | **The receipt's two paragraphs read as ONE honest account** on a typical generated draft | Req 5 / VOCAB-02 (CR-01) | The automated half can prove *which steps each sentence counts*. It cannot say whether two sentences, read one after the other by a person, add up to one coherent account or to a contradiction. That judgement is the whole point of the surface. | Generate a REAL draft whose spine is `llm_agent → llm_emit` (the shape **both** curated starters produce — `StarterTemplatePicker.tsx:50-53`). Then confirm, reading the card as a person: (1) the *"…read your documents, so I set them to must prove it"* sentence counts **only** the steps that actually read documents — cross-check its number against the steps you can see retrieving; (2) the deliverable step is **still named** and **still explains its own seal**; (3) **no** sentence claims the AI applied a gate that the step's own `citation_policy` default applied; (4) the *"You can't turn that off"* line sits with the detected paragraph and nowhere else; **(5) — NEW after plan 187-20, and the fact that changed:** the *second* paragraph (the one counting steps that were **already** sealed) now attributes **no cause at all** — it reads *"N steps were already set to must prove it."* — so you are confirming that the paragraph and the rows **AGREE**, not checking the card for a contradiction. The paragraph says only that those steps already wore the seal; each row beneath names its own cause (*"it already has to cite its sources"* for a policy default, ~~*"you turned this on by hand"*~~ **→ see the 187-23 repair below** for one the author escalated). If that paragraph ever names a cause again, WR-09 has returned. Cross-check the receipt's counts against the ⛨ seals the canvas actually draws. **AMENDED 2026-08-04 — still UNPERFORMED and UNTICKED. Two repairs, both because the round changed what the operator will actually see:** **(a) plan 187-23 (WR-11) changed the escalated row's sentence.** The struck wording above told you to expect *"you turned this on by hand"* — **a string the product no longer emits**, so this check would have failed for the wrong reason. The escalated row now reads ***"it was set to must prove it by hand"***. The reason is not cosmetic and is worth knowing while you read the card: the formatter is handed a `GroundingCause`, never an actor — `grounding_escalated` is a bare boolean recording *authored rather than derived*, and it does not record **who**. A sentence must not claim more than its input knows. Confirm the row names the **act** and not a **person**. **(b) plan 187-22 (CR-04) means checks (1)–(5) are now read against a FROZEN card.** Read them as a description of the generation that produced the draft, not of the draft's current state — and do not edit anything mid-read expecting the counts to follow. Whether the freeze itself reads as honest is **M14**, not this row. Nothing else in this row changed; all five original checks stand. |
| **M10** | **The zero-detected draft still arrives as one thing**, not a card with a hole in it | Req 5 / D-187-10 | The suite can assert one paragraph is absent. It cannot assert that what remains still *looks* whole — a component with a paragraph removed can be individually correct and compositionally broken, and only a person can see the difference. | Describe a workflow with **no retrieval at all** (nothing that reads documents). Confirm the receipt **still arrives**, with its heading and its closing line intact; the *"You can't turn that off"* sentence is **absent**; and whatever remains reads as ONE deliberate arrival rather than a truncated card. Watch the entrance, not just the final frame. |
| **M11** | **The card states no capability the step lacks — and still states the one it has** | Req 1 / VOCAB-01 (WR-02) | The negative half alone can pass by over-tightening. The **positive** half is what proves the gate did not, and the pair is only convincing when a person sees both cards at once — two green unit tests on separate halves never show the contrast. | Bind a folder on a step type that **cannot** search (e.g. a *Write it up* / `llm_single` step, or a human-input step): confirm the card **no longer** says *"Search {folder}"* and reads its plain type sentence instead, with no folder name and no raw id anywhere on it. Then bind the **same** folder on an **agent** step: confirm it **does** say *"Search {folder}"*. Read the two cards side by side on the same canvas. |
| **M12** | **The ＋ row promises the sentence the card that lands actually says** | Req 1 / VOCAB-01 (WR-03) | The drift was **semantic, not lexical** — both strings were imported identifiers, so every `?raw` source fence stayed green through the whole defect. A person reading two sentences one click apart is the only instrument that catches this class. | Open `＋` on the lane and **read every row aloud**. Click the **human-input** row. Confirm the card that lands says the **same sentence the row promised** (*"Wait for your approval"*), not a second wording. Repeat once with a different row (e.g. the deliverable step) as a control that nothing else moved. |

| **M13** | **The escalated-only draft's card agrees with itself** — its paragraph and its own rows say the same thing about who applied the seal | Req 5 / VOCAB-02 (WR-09) | Whether one card's paragraph and its own rows, **two lines apart**, read as agreeing or as contradicting is a judgement only a person makes. The suite can prove which words are present and which are absent; it cannot prove that they add up. This is the exact case WR-09 broke, and no other shipped row tests it head-on — M9 reads the typical mixed draft, M10 reads the zero-detected one, and neither isolates the cause whose sentence was false. | Reach a draft whose **only** sealed step is one **you escalated by hand**, and where **no** step reads documents: generate (or open) a draft with no retrieval at all, then turn the grounding dial to *must prove it* on **one** step yourself. Read the card top to bottom and confirm, as a person: (1) the paragraph states the **count** and the **seal** — *"1 step was already set to must prove it."* — and says **nothing** about what applied it; (2) the row below it names the **act**: **AMENDED 2026-08-04 by plan 187-23 (WR-11)** — this check used to read *"names **your own act**: 'you turned this on by hand'"*. **That is a string the product no longer emits**, and left unrepaired this row would have failed for the wrong reason. The escalated row now reads ***"it was set to must prove it by hand"***. **The change is the point of the check, not a detail of it:** the formatter is handed a `GroundingCause` and is **never** handed an actor — `grounding_escalated` is a bare boolean recording *authored rather than derived*, not *who* — so a sentence naming **you** claimed more than its input knew. Confirm the row names the **act** (*by hand*) and **no person**, and that it still tells you the step is held to *must prove it*. If a second-person pronoun ever returns to this row, WR-11 has returned; (3) the two do **not** contradict each other — this is the whole row; (4) the *"You can't turn that off"* line is **ABSENT**, because that is the **detected** lock (D-185-07) and nothing here was detected; (5) the card still closes with *"Everything else is yours to change. Nothing is saved or published yet."* — the arrival reads whole, not truncated. **Why this row was EXTENDED rather than duplicated:** 187-23's sentence change lands on exactly the draft M13 already isolates — the escalated-only card — and M13 is the only shipped row that reads that card head-on. A second row would have put two operators on the same card reading two halves of one sentence. So the new wording was folded into check (2) and **no row was added for 187-23**. The one row round 4 does add (M14) is for a **different** property on a **different** class of draft. |

| **M14** | **The receipt is a RECEIPT, not a readout** — with the card still open, an edit that would have changed one of its sentences moves the CANVAS and leaves the CARD exactly where it was | Req 5 / VOCAB-02 (CR-04) | The automated half proves the card is handed a snapshot and never re-reads the store — that is arithmetic, and §(af) P-1/P-2 prove it bites. **What it cannot answer is the only question that matters here:** a card that *deliberately stops tracking* looks, to a person who does not know it is a snapshot, **exactly like a stale bug**. Whether it reads as honest history or as a component that forgot to update is a judgement only a person makes, and getting it wrong is worse than the defect — an operator who learns to distrust the card stops reading the one surface whose job is attributing safety. Sketch **150-B**'s *"here is what I built"* framing is the acceptance bar: every sentence on this card is **past-tense and first-person**, so a card that kept updating would be narrating the author's own edits in the AI's voice. That framing — not "is it current?" — is what you are judging against. | Generate a REAL draft and leave the receipt **OPEN**. Then make one real edit in the inspector beside it — any of the three paths CR-04 travelled: (a) switch a **KB tool ON** for a step that had none; (b) **add a step** to the spine; (c) flip the **grounding dial** to *must prove it* on a step. Now confirm, as a person: (1) the **CANVAS updates** — the new step appears, the ⛨ seal is drawn, the tool is bound. The canvas is the **ledger** of current governance and it must stay live; (2) the **CARD does not move at all** — its heading count, its *"…read your documents, so I set them to must prove it"* sentence, its carried count and its listed rows are all **identical** to the moment it arrived. In particular it must **NOT** start claiming *"so I set…"* over the seal **you** just applied; (3) read the two side by side and answer the actual question: does the frozen card read as *"here is what I built"* — an honest account of a moment that has passed — or does it read as **broken**? If it reads as broken, say so: the fix would be a framing or affordance change, not a re-tensing of the copy, and the finding belongs in the next round. (4) Dismiss and re-generate; confirm the fresh card describes the **new** generation, not the old snapshot — a receipt that freezes forever is the opposite failure and would be just as wrong. |

| **M15** | **You can say what the workflow is ABOUT before the AI drafts it** — and the draft that arrives is bound to what you said | Req 6 / VOCAB-03 (GAP A) | The automated half proves the chosen id reaches `generateWorkflow`'s `project_folder_id` **on the request the client sends** — that is arithmetic, and §(ak) P-16/P-17 prove it bites. What it cannot answer is whether the control is *findable and unmissable at the moment it matters*: the whole defect was that the fast path never **asked**, and a picker that is technically present but reads as decoration reproduces the defect with a green suite. Only a person can say whether they were genuinely offered the choice. | ⚠ **Bound by the seeded-rows caveat, §(an): perform this against a FRESHLY GENERATED draft. A legacy `workflow_definitions` row's `project_folder_id` was written by whatever path existed on its write date and says nothing about the path 187-26 built.** On the loose **"Describe & run"** door: (1) pick a knowledge base, (2) type a requirement, (3) click **Draft the workflow**. Then confirm, as a person: **(a)** the generated draft is BOUND to what you picked — check the header chip **AND** the stored `project_folder_id` on the row, not just the chip, because a chip can render from local state that never reached the server; **(b)** on the canvas, the retrieval steps carry **no** unbound verdict; **(c)** **Publish is not blocked for a reason you were never asked about** — this is the whole point of the row, and the sentence to look for is the one naming an unbound knowledge base; **(d)** the picker was where you would look for it before you started typing, not somewhere you found only because this row told you where. If (d) fails the row still FAILS: an unfindable control and no control are the same control. |
| **M16** | **A draft you just opened does not claim it passed a check nobody ran** — and the FIRST SECOND is the test | Req 5 / VOCAB-02 (GAP B) | The jsdom cases prove the state machine: the union is total, the tray suppresses all three clean affordances for the never-ran cause, and `blockedReason` returns the honest sentence while the answer is outstanding. **None of that can see a flash.** A card that renders the old all-clear for 200 ms and then corrects itself passes every assertion in the suite and is exactly the lie the operator caught — they measured `validateCallsMade: 0` with the tray showing *"the static checks pass"* and Publish **enabled**. Whether the first painted frame is honest is a perceptual judgement, and it is the only thing this row is for. | ⚠ **Bound by the seeded-rows caveat, §(an). Perform it BOTH ways: once on an existing draft AND once on a FRESHLY generated one** — a seeded row can accidentally return `ok:true` and hide the very window this row exists to test. Open a draft into the canvas and **read the bottom strip in the first second, before touching anything**. Confirm: **(1)** it does **NOT** say *"Nothing to fix — the static checks pass"*; **(2)** it does **NOT** say *"checked by the server"*; **(3)** it says *"Not checked yet."* or is honestly silent — never an all-clear; **(4)** **Publish is unavailable and names why** for that window, and then behaves according to the answer that lands — blocked if the server says `ok:false`, **released** if it says `ok:true`. Check (4)'s second half explicitly: a fail-closed state a person cannot escape would be a new defect, not a fix. **Watch the FIRST SECOND, not the settled state — that is the test.** Throttle the connection if you need to widen the window; if you cannot see the window at all, say so, because "too fast to see" and "correct" are different findings. |
| **M17** | **The fast path is still fast** — ignore the picker entirely and nothing costs you anything | Req 6 / VOCAB-03 (GAP A, the non-regression half) | The suite asserts the CTA is enabled by **text alone** and that choosing nothing sends **no `project_folder_id` key at all** (absent, not `undefined`, not `""`). That is the wire. It cannot measure *friction*: an extra beat of hesitation, a control that draws the eye and makes a person feel they ought to answer it, or a layout shift that moves the CTA after the folder list resolves. The sketch-approved fast path's only promise is speed, and speed is perceptual. | ⚠ **Bound by the seeded-rows caveat, §(an) — this row is only measurable on a generation that actually happens, so it must be a FRESH draft.** On the same **"Describe & run"** door, **ignore the knowledge-base picker entirely**. Type and click once. Confirm: **(1)** it still drafts — **no extra question, no extra screen, no extra click**; **(2)** the CTA was enabled the moment you had typed text, with nothing chosen; **(3)** nothing about the picker read as required — no asterisk, no "please select", no disabled CTA while the folder list was still loading; **(4)** the CTA did not MOVE under your cursor as the folder list resolved. **If the picker ever stands between you and a draft, this row FAILS regardless of anything else round 5 shipped** — GAP A was closed by adding an option, and an option that behaves like a step has re-broken the thing it was meant to protect. |

**Roster rule:** blocked rows are recorded **⛔ with the reason and blocking id — never omitted.**
Measured: all 8 provider keys are configured locally ⇒ **zero ⛔ rows expected**.

**Status at the close of the phase (2026-08-02): all eight rows remain UNPERFORMED and UNTICKED.**
They are the operator's, deliberately — G-4 says wire format plus a screenshot are insufficient for
every one of them. Nothing in plan 187-15 ticked, softened or re-scoped a row. Two are worth flagging
to whoever runs them:

- **M4** (the async-map settle) is the live half of the Pitfall-1 decision plan 187-15 Task 1 took
  deliberately: derived faces MISS on first paint and settle when the mount fetch resolves. The
  automated half asserts the floor (never an id-shaped face, never a placeholder); whether the settle
  *reads* as a flicker is exactly what a render test cannot say.
- **M8** (flag-OFF Builder first screen) now has an automated companion — the wave-1 byte pin, still
  green with its literal unedited — but the pin covers the CTA flex column only. The manual row is
  still the one that looks at the whole screen.

**Status after the gap-closure round (2026-08-02): twelve rows, all UNPERFORMED and UNTICKED.**
The closure round added **M9–M12** — one row per user-visible change the three fix plans made, which
is what G-4 requires of a round that touched live UI — and **unblocked M3** without performing it.

Nothing was ticked, softened, re-scoped or dropped by this round. In particular:

- **M5** (the three starter templates' seeded describe copy, VOCAB-03) is **unchanged and still
  owed**. No plan in this round touched `StarterTemplatePicker`'s copy.
- **M8** (the flag-OFF first screen, D-181-01) is **unchanged and still owed**. Re-measured for this
  round: `git diff --numstat ee5fff3b HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx` is **empty**
  (§gap-closure gates), so the flag-OFF screen this row inspects is byte-identical to the one the
  phase shipped — which makes the row *cheaper* to run, not less owed.
- **M1, M2, M4, M6, M7** are untouched by this round and remain exactly as the phase left them.

**M9–M12 are the operator's, like M1–M8.** None of the four can be discharged by a render test:
three are judgements about whether prose or composition reads honestly to a person, and the fourth
(M11) is a contrast that only exists when two cards are on screen together.

**Status after gap-closure round 3 (2026-08-03): THIRTEEN rows, all UNPERFORMED and UNTICKED.**
(The two paragraphs above are dated 2026-08-02 and are *that* round's record, left as written; the
board's **current** total is thirteen. `manual_rows: 13` / `manual_rows_performed: 0` in this file's
frontmatter is the present-tense figure.)

Round 3 **amended two notes and added one row. It ticked nothing, softened nothing, re-scoped
nothing and dropped nothing.** Precisely:

- **M3's note was REPAIRED, not performed.** Round 2's warning — read the carried sentence against
  the per-step reasons, because an escalated draft shows an internally-contradictory card — stopped
  being true when plan 187-20 landed, and a stale warning is worse than no warning: it trains an
  operator to distrust a surface that is now correct. The note now says what the operator should
  **see**, and it **keeps** the row's history (blocked on CR-01 → unblocked by 187-16 → repaired by
  187-20), because a row whose history is deleted cannot be audited. M3 is still **UNPERFORMED**.
- **M9's note GAINED a fifth check** — the carried paragraph now attributes no cause, so the
  operator confirms the paragraph and the rows **agree** instead of hunting for a contradiction. All
  four of its original checks survive verbatim; nothing was replaced. M9 is still **UNPERFORMED**.
- **M13 is net-new** — the escalated-only draft, head-on. It is the case WR-09 actually broke and
  the one no shipped row tested directly. **UNPERFORMED**, like every other row.
- **M5** (the three starter templates' seeded describe copy, VOCAB-03) is **unchanged and still
  owed** — no plan in this round touched `StarterTemplatePicker` (§(aa): the round's whole file list
  is four files under `components/workflows/` plus two planning documents).
- **M8** (the flag-OFF Builder first screen, D-181-01) is **unchanged and still owed** — re-measured
  for this round, `git diff --numstat f632f9b6 HEAD -- frontend/src/pages/WorkflowBuilderPage.tsx`
  is **empty** (§(y)), so the screen this row inspects is byte-identical to the one the phase
  shipped. Cheaper to run, not less owed.
- **M12's round-2 note about WR-08 STANDS.** WR-08 was **not** closed by this round — the operator
  routed it to **Phase 188** — and the fence is measured empty in §(ac). An operator running M12
  still needs that warning, and should still specifically try the deliverable / `llm_emit` row on a
  template-bearing draft, not just the human-input control.
- **M1, M2, M4, M6, M7, M10, M11** are untouched by this round and remain exactly as they were.

**Status after gap-closure round 4 (2026-08-04): FOURTEEN rows, all UNPERFORMED and UNTICKED.**
(The paragraphs above are dated 2026-08-02 and 2026-08-03 and are *those* rounds' records, left as
written; the board's **current** total is fourteen. `manual_rows: 14` / `manual_rows_performed: 0` in
this file's frontmatter is the present-tense figure.)

**All fourteen rows remain the operator's and remain unperformed at the close of this round.**
Round 4 **amended three notes and added one row. It ticked nothing, softened nothing, re-scoped
nothing and dropped nothing.** The count of manual rows only grows. Precisely:

- **M3's note was AMENDED, not performed.** Its closing clause (*"nothing on the card reads as
  still-deciding"*) acquired a sharper second meaning after 187-22: the card was previously wired to
  a live selector, so it was not merely *reading* as still-deciding — it genuinely **was** still
  tracking. The note now says what the operator should **see** and keeps the row's whole history
  (blocked on CR-01 → unblocked by 187-16 → repaired by 187-20 → amended by 187-22), because a row
  whose history is deleted cannot be audited. M3's own scope (the *arrival*) is unchanged. Still
  **UNPERFORMED**.
- **M9's check (5) carried a STALE STRING and was repaired.** It told the operator to expect the
  escalated row to read *"you turned this on by hand"* — **a sentence 187-23 removed**. Left alone,
  M9 would have failed for the wrong reason and taught an operator to distrust a correct surface. The
  old wording is **struck through, not deleted** (a silently vanishing expectation reads as one that
  was never true), the shipped sentence is named, and a second note records that checks (1)–(5) are
  now read against a frozen card. All five original checks survive. Still **UNPERFORMED**.
- **M13's check (2) carried the SAME stale string and was repaired the same way — and M13 was
  EXTENDED rather than duplicated.** The plan permitted a second row for 187-23's sentence change
  *only if* no shipped row covered it head-on. M13 **is** that row: it is the only one that isolates
  the escalated-only card, which is precisely where the changed sentence renders. A second row would
  have put two operators on one card reading two halves of one sentence. **The choice is stated
  because it is a choice:** extended, not duplicated. Still **UNPERFORMED**.
- **M14 is net-new, and is the round's ONE added row** — the CR-04 property head-on, on a class of
  draft no other row reads: the card left **open** while the author edits beside it. It exists
  because a component that deliberately stops tracking is visually indistinguishable from one that
  forgot to, and only a person can tell those apart. **UNPERFORMED**, like every other row.
- **No row was ticked.** Amending a note is not performing it; neither is closing the defect the note
  describes.
- **M5** (the three starter templates' seeded describe copy, VOCAB-03) is **unchanged and still
  owed** — no plan in this round touched `StarterTemplatePicker` (§(ah-8): the file does not appear
  in the round's diff at all).
- **M8** (the flag-OFF Builder first screen, D-181-01) is **unchanged and still owed**, and this is
  the first closure round where that needs re-checking rather than asserting: round 4 **did** touch
  `WorkflowBuilderPage.tsx` (8 ins / 1 del, §(ah-5)), where rounds 2 and 3 touched it not at all. The
  delta is a `useState` declaration, one setter inside `onDraft`'s success branch, and one identifier
  swap **inside the canvas-flag-gated receipt mount** — nothing on the flag-OFF path, and the
  flag-OFF byte-identity guards (`revertByteIdentical.test.tsx`, `WorkflowBuilderPage.header.test.tsx`)
  ran **34 passed** through 187-22. Cheaper to run, not less owed.
- **M12's round-2 note about WR-08 STANDS.** WR-08 was **not** closed by this round either — the
  operator's routing to **Phase 188** is unchanged, and §(ah-8) shows `StepTypePicker.tsx` /
  `.test.tsx` absent from the round's file list entirely.
- **M1, M2, M4, M6, M7, M10, M11** are untouched by this round and remain exactly as they were.

**Status after gap-closure round 5 (2026-08-04): SEVENTEEN rows, all UNPERFORMED and UNTICKED.**
(The paragraphs above are dated 2026-08-02, 2026-08-03 and 2026-08-04 and are *those* rounds' records,
left as written; the board's **current** total is seventeen. `manual_rows: 17` /
`manual_rows_performed: 0` in this file's frontmatter is the present-tense figure.)

**All seventeen rows remain the operator's and remain unperformed at the close of this round.**
Round 5 **added three rows and amended one note. It ticked nothing, softened nothing, re-scoped
nothing and dropped nothing.** The count of manual rows only grows. Precisely:

- **M15, M16 and M17 are net-new — one row per user-visible change round 5 made**, which is what G-4
  requires of a round that touched live UI. They are authored **here in VALIDATION.md and never
  inside a PLAN task**. None can be discharged by a render test: M15 is a judgement about whether a
  person was genuinely *offered* a choice, M16 is about a **single painted frame** that no jsdom
  assertion can see, and M17 is about *friction*, which has no wire representation at all.
- **All three are bound by the operator's seeded-rows caveat (§(an))** — each must ALSO be performed
  against a **freshly generated** draft, because an assertion made only against a legacy
  `workflow_definitions` row is not evidence about what the current authoring path produces.
- **NO SHIPPED ROW WAS MADE STALE BY THIS ROUND, and that is measured rather than assumed** —
  §(ao) runs the sweep and finds exactly one `publish` hit on the whole board, inside M13's quotation
  of the receipt card's own closing line, which round 5 did not touch. Round 4 had to strike through
  two stale strings; round 5 had none to strike, and the grep that establishes it is recorded because
  round 4's *plan* asserted two stale rows that did not exist.
- **M8's note GAINED one clarifying sentence; its expectation is UNCHANGED and still owed.** Round 5
  touched `WorkflowBuilderPage.tsx` (15 ins / 3 del, §(al-5)), all of it a `useState` initializer, a
  hook argument, a `useMemo` field, one import, one gated branch and one comment — **nothing on the
  flag-OFF path**, and the flag-off byte-identity guards (`revertByteIdentical.test.tsx` 7,
  `WorkflowBuilderPage.header.test.tsx` 27) are green in every gate sample. **Separately**, the loose
  *"Describe & run"* **door** now shows a knowledge-base picker regardless of the flag, because
  `WorkflowDoorSwitch` reads no flag at all (its own docblock) and the mount is unconditional. That is
  a **different surface** from the one M8 inspects, it predates round 5 as a property of that shell,
  and it is logged as **`D-ITEM-187-29-01`** rather than swept in. The note exists so an operator
  running M8 does not meet the door's picker on the way and conclude D-181-01 has broken.
- **No row was ticked.** Authoring a row is not performing it; neither is amending a note, and neither
  is closing the defect a note describes.
- **M5** (the three starter templates' seeded describe copy, VOCAB-03) is **unchanged and still owed**
  — `StarterTemplatePicker.tsx` / `.test.tsx` do not appear in §(al-9)'s file list at all. Note for
  whoever runs it: M5's subject is the **Builder's** describe screen and its template line; the new
  knowledge-base picker lives on the **door**, upstream of it. Two screens, two controls.
- **M12's note about WR-08 STANDS.** WR-08 was **not** closed by this round either — the operator's
  routing to **Phase 188** is unchanged, and §(al-9) shows `StepTypePicker.tsx` / `.test.tsx` absent
  from the round's file list entirely.
- **M9, M10, M13 and M14** are untouched by this round — round 5 touched no part of the Req-5 receipt
  estate (`SeedReceipt.tsx` and `definitionOps.ts` are both absent from §(al-9)), so every expectation
  rounds 2–4 wrote for those rows still describes the shipped surface exactly.
- **M1, M2, M3, M4, M6, M7, M11** are untouched by this round and remain exactly as they were.

---

## SC#10 roster — recorded 2026-08-02

**How it was measured.** `backend/tests/integration/test_187_authoring_roster.py` (plan 187-07),
run live against the local Supabase with `RUN_187_AUTHORING_ROSTER=1`. Each row drives ONE real
`generate_workflow_definition` call with its own `SimpleNamespace(harness_authoring_model=<id>)`
stub — `settings` is a **parameter** of the service (`workflow_authoring.py:221-231`), so there is
**zero global mutation**, zero contamination between rows, and no serialisation requirement. The
operator's environment was not altered by any row. Full run: 8/8 rows executed, 718 s wall clock.

**The roster is DERIVED, never re-typed.** `MODEL_CAPABILITIES` is imported, grouped on `provider`,
and one representative is picked per group by the largest version tuple parsed out of the id (ties
break on `llm_call_timeout_seconds` → `max_output_tokens` → id). Verified 2026-08-02: the heuristic
needs **no override map** — it picks the newest flagship in all eight groups. Two always-on guards
(`test_roster_is_derived_from_the_live_registry`, `test_every_roster_row_is_registry_backed`) run in
the DEFAULT suite and fail if the group count drops below 8, if `deepseek`/`moonshot` disappear, or
if any representative stops resolving `capability_source="registry"`.

| Provider | Model id (derived) | `native_tools` | `emit_tier` | `forced_emission` | Key configured | Verdict | Evidence |
|---|---|---|---|---|---|---|---|
| anthropic | `claude-sonnet-5` | True | force | True | ✔ | ✅ | 4 phases, **every one named**, all 4 stamped `name_seeded_by_ai` — e.g. "Check the flagged churn-risk list with the accounts lead before finalizing" |
| deepseek | `deepseek-v4-pro` | True | force | True | ✔ | ✅ | 5 phases, every one named ("Find upcoming renewals" … "Write the renewal-risk briefing") |
| google | `gemini-3.5-flash` | True | force | True | ✔ | ✅ | 3 phases, every one named ("Identify Renewals & Churn Risks", "Approve Flagged Risks", "Generate Plain Text Email Briefing") |
| minimax | `MiniMax-M3` | True | force | True | ✔ | ❌ | **Never emits.** Sample 1: no emission inside a 240 s ceiling. Sample 2 at the registry's own 600 s ceiling: 4 × HTTP 200 from `api.minimax.io` across 2 attempts, **no tool call in any of them** → `could_not_generate` / `model_failed_to_emit`. Not a name failure — an emission failure. |
| moonshot | `kimi-k2.6` | True | **coerce** | **None** | ✔ | ✅ | **The predicted-risky row PASSED.** 5 phases, every one named. See "the moonshot prediction" below. |
| openai | `gpt-5.6-sol` | True | force_strict | True | ✔ | ❌ | **HTTP 400 from the provider, twice** (once per attempt), then a descend-rung 200 that emitted nothing → `could_not_generate` / `model_failed_to_emit`. Verbatim provider message, captured directly: `Function tools with reasoning_effort are not supported for gpt-5.6-sol in /v1/chat/completions. To use function tools, use /v1/responses or set reasoning_effort to 'none'.` Not a name failure — an endpoint/registry defect (see below). |
| openrouter | `z-ai/glm-5.2` | **False** | force | True | ✔ | ❌ | **NON-DETERMINISTIC name drop — the finding this roster exists to catch.** Sample 1: a fully valid `WorkflowDefinition` in which **5 of 5 phases carried no `name`** (`find_renewals`, `summarize_account_changes`, `flag_churn_risks`, `review_flagged_list`, `write_briefing`). Sample 2, identical prompt: 5 of 5 **named**. The instruction is not reliably honoured on the non-native tool path. |
| zhipu | `glm-5.2` | True | force | True | ✔ | ✅ | 5 phases, every one named ("Identify Upcoming Renewals" … "Write Plain-Text Briefing") |

**Derived group count: 8** (openai 17 models · anthropic 7 · google 7 · deepseek 2 · moonshot 3 ·
minimax 8 · zhipu 8 · openrouter 9 = **61 models**). **Zero ⛔ rows** — all eight provider keys are
configured in this environment, so no row was blocked and none was omitted.

### SPEC refutations, re-measured 2026-08-02

The 187-SPEC's `MODEL_CAPABILITIES` figures came from a crude parse. Re-derived at execution time:

1. **DeepSeek IS present.** The registry carries `deepseek-v4-flash` and `deepseek-v4-pro`, both
   `emit_tier: force`. The SPEC's "DeepSeek absent" claim is refuted, and the roster's shape test now
   asserts the `deepseek` group key exists so the claim cannot be re-inherited.
2. **Five models declare no `forced_emission`, not the SPEC's figure** — all three moonshot natives
   (`kimi-k2.6`, `kimi-k2.5`, `moonshot-v1-8k`) plus the two OpenRouter moonshot rows, every one of
   them `emit_tier: coerce`. `moonshot` is the second group key the shape test pins.
3. **Superseded assumption (recorded so it is not re-inherited):** the SPEC concluded the rows must
   drive an app setting and therefore run serially with global mutation. Measured, `settings` is a
   plain parameter — the rows are independent and mutate nothing.

### What the ❌ rows mean (and what they do NOT)

Three rows are red; **only one of them is about names.**

- **openrouter — a real VOCAB-02 finding.** The per-step `name` instruction added in 187-02 survived
  every *native* provider's emission path but was dropped wholesale on one of two OpenRouter samples.
  OpenRouter rows are `native_tools: False` — the non-native tool path — which is exactly where a
  prompt-level instruction is weakest. Because it reproduces only intermittently, an assertion is the
  right instrument and it was **not weakened**. Mitigating context: Req 1's derived node-face ladder
  is precisely the graceful degradation for this — a phase with no `name` falls through to the
  config-derived face rather than rendering blank — so the product degrades, it does not break.
- **openai — an endpoint/registry defect, adjacent to `BUG-260731-01`, NOT a name failure.**
  `MODEL_CAPABILITIES` marks `gpt-5.6-sol` `forced_emission: True` / `emit_tier: force_strict`, but
  the provider now refuses function tools for reasoning-first models on `/v1/chat/completions`
  outright. The registry therefore over-claims for the whole `gpt-5.6-*` family. **Supplementary
  diagnostic run the same day** (not a roster row — the roster stays derived): the same describe
  prompt through `gpt-5.5`, which is one of the two ids `resolve_authoring_model`'s *fallback* branch
  picks, produced **5 phases, every one named and every one stamped**. So OpenAI's real answer to
  SC#10 is ✅; the ❌ belongs to the model id, not the instruction.
- **minimax — an emission failure.** Four HTTP 200s and no tool call. Nothing was measured about
  names because nothing was emitted. Incidental confirmation of 187-02's budget contract: exactly
  **two** `nl_generation_attempt` events, never a third, even on the all-fail path.

### The moonshot prediction — recorded either way

`resolve_authoring_model`'s branch 1 returns `settings.harness_authoring_model` **without checking
`forced_emission` / `emit_tier`**; only the fallback branch validates. So an explicitly-set moonshot
model hands an unforceable (`emit_tier: coerce`, `forced_emission: None`) model to
`forced_emit(schema_model=WorkflowDefinition)`. The plan predicted this row would fail. **It passed** —
5 phases, all named. The unvalidated branch remains a real property of the knob (an operator can point
`HARNESS_AUTHORING_MODEL` at anything and the resolver will not object), but it did not bite here, and
no row was `xfail`-ed to hide either outcome.

### What this roster does NOT prove

It proves the per-step `name` instruction survives each provider's **emission path**, driven through
the service function. It does **not** prove that the `HARNESS_AUTHORING_MODEL` **env path** reaches
`resolve_authoring_model` in a running backend — that knob is env-only (no Settings UI, no
`app_settings` row, no sync) and needs a restart to observe. That remains manual row **M7** in the
Manual-Only table above, unchanged.

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or a Wave 0 dependency — 33 rows, every one with a command
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references above — all 8 items delivered
- [x] No watch-mode flags
- [x] Feedback latency < 30 s (quick sets) — 8-file set 8.9 s, backend 187 set 1.2 s
- [x] SC#6 property test observed **RED before the fix** (187-01 Task 3), and falsified **RED after**
      the fix is temporarily removed (187-11 Task 3)
- [x] Backend collection **3533** ≥ 3474 + net-new; frontend isolated sets **980** ≥ 863 and
      **443** ≥ 381
- [x] `git diff --stat -- supabase/migrations` empty
- [x] `nyquist_compliant: true` set in frontmatter

⚠ **What `nyquist_compliant: true` does and does not claim.** It claims every requirement row in the
requirement→proof map has an instrument that was actually RUN and whose result is recorded here. It
does **not** claim every instrument came back green, and three recorded results are red on purpose:

| Row | Result | Why it is recorded rather than fixed or hidden |
|---|---|---|
| SC#10 · openrouter | ❌ | A real VOCAB-02 finding — the per-step `name` instruction is dropped non-deterministically on the non-native tool path. The assertion was **not weakened**. Req 1's derived ladder is the graceful degradation: an unnamed phase falls to its config-derived face, so the product degrades rather than breaks. |
| SC#10 · openai (`gpt-5.6-sol`) | ❌ | An endpoint/registry defect adjacent to `BUG-260731-01`, **not** a name failure — the provider refuses function tools for reasoning-first models on `/v1/chat/completions`. The same prompt through `gpt-5.5` produced 5 phases, all named and all stamped. |
| SC#10 · minimax | ❌ | An emission failure — 4 × HTTP 200, no tool call. Nothing was measured about names because nothing was emitted. |

Two further limits are named rather than implied: the **backend full suite's 211 failures are
pre-existing rot** measured identical to the pre-dispatch baseline (§d), and **`tsc -b` has never
exited 0 here** (§e, `D-ITEM-01`).

**Approval (recorded at the close of the phase, 2026-08-02, left verbatim):** ready for
`/gsd:verify-work` — the eight Manual-Only G-4 rows are the operator's and remain unperformed.

### Gap-closure round sign-off — 2026-08-02

Added, not substituted. Everything above stands as written at the close of the phase; the lines below
are this round's own.

- [x] The four closure findings each have per-task rows with a non-empty automated command taken from
      the plan's own `<verify>` block — **six rows** (`187-16-T1/T2`, `187-17-T1/T2`, `187-18-T1/T2`)
- [x] All three fix plans observed their falsification **RED before the fix**, with the signature
      recorded verbatim in each SUMMARY (12/34 · 13/122 · 4/39) — the Phase-185 *"observe
      falsification RED first"* lesson honoured three times
- [x] **M3 unblocked** — its blocking reason quoted, the plan that closed CR-01 named, the row left
      UNPERFORMED and UNTICKED
- [x] **G-4 honoured for the round** — one lived-experience row per user-visible change (M9–M12),
      authored here in VALIDATION.md and **never inside a PLAN task**
- [x] **No shipped row dropped, softened or re-scoped** — M1, M2, M4, M5, M6, M7, M8 unchanged; the
      three deliberately-red SC#10 rows and their reasons unchanged
- [x] `nyquist_compliant`'s stated meaning unchanged — it claims every requirement row has an
      instrument that was **RUN and recorded**, never that every instrument came back green
- [x] **Every closure-round gate measured with raw output at the closure commit** —
      §"Phase gates — gap-closure round" (h)–(o): zero migrations, the D-187-14 mount cap **unmoved**
      (empty `--numstat`), both named sets **998 ≥ 980** and **447 ≥ 443** with 0 failed and no
      shipped file's count dropped, the five closure suites **452 passed / 0 failed**, `tsc -b`
      **33 → 33** with 0 in the touched files, `vite build` **exit 0**
- [x] **No false completion record** — `git status --porcelain` over `REQUIREMENTS.md` / `STATE.md` /
      `ROADMAP.md` empty; the one `STATE`/`ROADMAP` commit in the range is the orchestrator's own
      (`ce68aacd`), named in §(o) rather than left for a reader to trip over

**What this round does NOT claim.** It closed one BLOCKER and two operator-folded Warnings. It did
**not** touch WR-01, WR-04, WR-05, WR-06, WR-07 or IN-01…IN-05, which remain open findings in
`187-REVIEW.md`. It did **not** perform any manual row: all **twelve** (M1–M12) remain the
operator's and remain unperformed. And it did not re-run the SC#10 live roster — those three ❌ rows
are unchanged, provider-side findings that no frontend fix could move.

### Gap-closure round 4 sign-off — 2026-08-04

Added, not substituted. Everything above stands as written; the lines below are round 4's own.

- [x] **Per-task rows for every task in 187-22, 187-23 and 187-24** — nine rows (`187-22-T1/T2/T3`,
      `187-23-T1/T2`, `187-24-T1/T2/T3`, plus `187-25-T1`), each with the plan's own `<verify>`
      command, its measured result, and the commit it was measured at — §(ae)
- [x] **Every figure in the round-4 section carries the command that produced it.** A figure without
      a command does not appear
- [x] **Every falsification the round performed is transcribed with its observed RED and its revert
      evidence** — §(af), **14 probes plus 2 expected task-level REDs**, none summarised as "passed".
      ⚠ The measured 187-24 probe count is **EIGHT**, not the nine its own SUMMARY and this plan's
      task action state — the sibling-attribute probe **is** probe 5 of the five sweep probes. The
      measured set is recorded, not the planned one (the same correction round 3's §(q) made)
- [x] **All five gates RE-MEASURED at the round-4 tip with raw output, never carried forward** —
      the five-suite set **484 ≥ 466 (+18)** with 0 failed; the count gate **exit 0**, both new pins
      at delta 0, `18/18`, every previously-pinned file delta ≥ 0; zero migrations from **both** the
      phase base and the round-4 base; **zero** backend files; the D-187-14 mount cap **8 / 15**;
      `tsc --noEmit -p tsconfig.app.json` **33 → 33** with 0 in the touched files — §(ah)
- [x] **The `D-187-14` cap is spent, and stated as spent.** Rounds 2 and 3 spent 0; round 4 spends
      **8 insertions of 15**, because CR-04 is a caller defect and the caller is that file. The
      render body gains **no new line** — one identifier swap
- [x] **A red gate was diagnosed, not pinned around.** Sample 1 of 4 reported `failed 1`, in
      `WorkflowBuilderPage.canvas.test.tsx` — **not** the anticipated `PublishGauntlet` flake. Green
      in isolation (117), count identical in all four samples, logged as `D-ITEM-187-25-01`, and
      **no pin was lowered for it**
- [x] **Both new pin numbers were read from the gate's own `actual` column**, over two agreeing runs,
      and **each was observed catching a deletion** (P-14, P-15) — a pin never seen biting is a
      gesture
- [x] **G-4 honoured for round 4** — the user-visible changes (a receipt that no longer re-narrates
      the author's own edits; a row that no longer names an actor) have lived-experience rows
      authored **here in VALIDATION.md and never inside a PLAN task**: M14 net-new, M13 extended
- [x] **The manual board only grew and never softened** — 13 → **14** rows, three notes amended, two
      of them repairing a **stale string the product no longer emits**, struck through rather than
      deleted. **No row ticked, re-scoped or dropped; `manual_rows_performed: 0`**
- [x] **No false completion record** — `git status --porcelain` over `REQUIREMENTS.md` / `ROADMAP.md`
      empty; zero SDK call sites in the round's eight plan/summary documents; the `STATE.md` commits
      in range are the orchestrator's own (`5e0db585`, `83524870`, `925373b9`), named in §(ah-7)
- [x] `nyquist_compliant`'s stated meaning unchanged — it claims every requirement row has an
      instrument that was **RUN and recorded**, never that every instrument came back green

**What round 4 does NOT claim.** It closed one BLOCKER (CR-04) and six Warnings (WR-11…WR-16). It
did **not** touch WR-01, WR-04…WR-07 or IN-01…IN-05; **IN-11…IN-14 were shown to the operator and
left out by decision**; **WR-08 remains Phase 188's**. It performed **no** manual row — all fourteen
remain the operator's. It did not re-run the SC#10 live roster. And it did not fix the parallel-run
flake class, which **grew a file** this round (`D-ITEM-187-25-01`).

### Gap-closure round 5 sign-off — 2026-08-04

Added, not substituted. Everything above stands as written; the lines below are round 5's own.

- [x] **Per-task rows for every task in 187-26, 187-27, 187-28 and 187-29** — eleven rows
      (`187-26-T1/T2/T3`, `187-27-T1/T2/T3`, `187-28-T1/T2/T3`, `187-29-T1/T2`), each with the plan's
      own `<verify>` command, its measured result, and the commit it was measured at — §(aj)
- [x] **Every figure in the round-5 section carries the command that produced it, and every "before"
      is DERIVED at this commit** from the base blob or a re-run — §(al-1)'s literal deltas,
      §(al-4)'s `1766 − 7 = 1759`, §(al-5)'s `6/1 + 9/2 = 15/3`. A figure without a command does not
      appear
- [x] **Every falsification the round performed is transcribed with its observed RED and its revert
      evidence** — §(ak), **18 mutations across P-16…P-30, plus 4 expected task-level REDs**, none
      summarised as "passed". ⚠ **The probe ledger is CORRECTED in three places**: this plan's own
      "ten probes / P-16…P-25" is refuted (the measured range is P-16…P-30); this plan's three probes
      are **renumbered P-28/P-29/P-30** because 187-28 had already spent P-23/P-24/P-25; and 187-28's
      own *"seven probes"* heading matches neither reading of its eight-row table (five identifiers or
      eight mutations — both recorded). The measured set is recorded, not the planned one, exactly as
      round 3 §(q) and round 4 §(af) each did for their own rounds
- [x] **All gates RE-MEASURED at the round-5 tip with raw output, never carried forward** — the
      seven-suite named set **292 passed / 0 failed** with every per-file delta ≥ 0; the count gate
      **exit 0**, all three new pins at delta 0, **21/21**, pinned total **804**, every
      previously-pinned file delta ≥ 0 and none lowered; zero migrations from **both** the phase base
      and the round-5 base and in the working tree; the backend unit tree **62 / 1700 / 2 / 2** with
      failures unchanged and collection up exactly the new file's 7; `tsc --noEmit -p tsconfig.app.json`
      **33 → 33** with 0 in the touched files; `vite build` **exit 0** — §(al)
- [x] **All three new pin numbers were read from the gate's own `actual` column**, over **two agreeing
      pre-pin samples**, never hand-counted — and **each was observed catching a genuinely deleted
      `it(` block** (P-28, P-29, P-30). **A pin never seen biting is a gesture.** `it.skip` was
      explicitly rejected as a probe: the gate counts `assertionResults.length`, which includes skipped
      cases
- [x] **The pin move is an EXTENSION and is stated as one.** 715 → 804 with **no deletion behind it
      and none needed** — only a LOWERING requires a plan-authorised deletion in the same commit
      (185-08's precedent). The script's header history block now records all three events in those
      terms. `BASELINE_TOTAL` stays a `reduce` and the success line stays derived: **18/18 → 21/21
      moved on its own**
- [x] **A red gate sample was diagnosed, not pinned around.** P-28's sample reported `failed 1`; the
      FULLNAME was extracted from the gate's own JSON report and is `D-ITEM-187-25-01` verbatim — a
      different file from the probed one, per-file count **128** as in every sample, and P-29/P-30
      reported `failed 0` minutes later. **No pin was lowered, and none may be lowered to quiet a red
      gate**
- [x] **The `D-187-14` cap is spent to the round's ceiling and the third deletion is a NAMED SPEND** —
      15 ins / 3 del, one over the ≤ 2 the phase had held, **claimed in advance and by name in
      `187-27-PLAN.md`** under the §(a2) single-named-allowance precedent, never renegotiated after the
      fact. The **stronger** property is proved: **0 new JSX elements, 0 new props on any JSX element,
      0 new declarations**, and all three deletions are a hook argument, a `useState` initializer and a
      `useMemo` field — **not one in the render body**
- [x] **An artifact contract that does NOT hold literally is recorded as a deviation, not as a pass** —
      §(am): 187-27's `contains: "unchecked"` / `pattern: "unchecked"` fail because that word is on the
      shipped graded-governance never-say list and `governanceVocabulary.test.ts` sweeps every string
      literal in the tree for it. The member shipped as **`not-run`**; the criteria's **intent** holds,
      their **letter** does not, and both halves are stated separately
- [x] **G-4 honoured for round 5** — the two user-visible changes (a door that asks what the work is
      about before the AI drafts; a tray and a publish trigger that stop claiming a check nobody ran)
      have lived-experience rows authored **here in VALIDATION.md and never inside a PLAN task**:
      **M15, M16 and M17 net-new**, plus M17 as the explicit non-regression row for the fast path
- [x] **The manual board only grew and never softened** — 14 → **17** rows. **No shipped row was made
      stale, and that is MEASURED** (§(ao)), not assumed — the sweep's one hit is M13's quotation of a
      string round 5 did not touch. One note (M8) gained a clarification with **no change to its
      expectation**. **No row ticked, softened, re-scoped or dropped; `manual_rows_performed: 0`**
- [x] **The operator's seeded-rows caveat is on the record as a BINDING RULE** (§(an)), not a
      footnote: the 73 drafts / 68 published rows are test data of unknown vintage, so **every** new
      row must ALSO be performed against a freshly generated draft — with the reason spelled out
      per-row, because an assertion made only against a legacy row is not evidence about what the
      current authoring path produces
- [x] **No false completion record** — `git status --porcelain` over `REQUIREMENTS.md` / `STATE.md` /
      `ROADMAP.md` empty at measurement time; `requirements.mark-complete`, `state.advance-plan` and
      `roadmap.update-plan-progress` were called by **no** executor in round 5, each SUMMARY says so by
      name, and every ROADMAP edit in the round was made by hand and is individually true. **`VOCAB-02`
      and `VOCAB-03` are deliberately NOT marked** — several of their truths are gated on manual rows
      that have not been run. §(al-8) additionally names the one `STATE.md` **repair** 187-26 had to
      make to an SDK write that had regressed a true record
- [x] **`187-UAT.md` is byte-untouched** — it is the operator's session record and the UAT workflow
      owns it
- [x] `nyquist_compliant`'s stated meaning unchanged — it claims every requirement row has an
      instrument that was **RUN and recorded**, never that every instrument came back green

**What round 5 does NOT claim.** It closed GAP A, GAP B and GAP C, and pinned its own estate. It did
**not** touch WR-01, WR-04…WR-08 or IN-01…IN-05/IN-11…IN-14; **WR-08 remains Phase 188's**;
`D-ITEM-187-23-01` and `D-ITEM-187-24-01` remain open. It performed **no** manual row — all seventeen
remain the operator's, and **`BUG-260731-03` therefore still cannot close**, because its trigger needs
both halves observed **live**. It did not re-run the SC#10 live roster. It did not fix the parallel-run
flake class, which now carries three entries and four independent non-attribution measurements — the
standing recommendation is to **fix it rather than prove it a fourth time**. And it did not verify any
requirement complete: that is the orchestrator's call, after verification, once behaviour is genuinely
observable.
