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
manual_rows: 12
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
| M3 | The receipt arrives once, seal pulses once, implies nothing still-deciding | Req 5 | Temporal + perceptual | **UNBLOCKED 2026-08-02 — still UNPERFORMED and UNTICKED.** `187-VERIFICATION.md` held this row with its blocking reason recorded verbatim: *"NOTE: fix the CR-01 gap before running this, or the operator will be confirming a receipt that lies."* **CR-01 was closed by plan 187-16** (commits `77668751` RED, `5c613bf4` GREEN); the receipt no longer states a governance action the AI did not take, so the hold no longer applies. **Unblocking a row is not performing it.** To perform: watch arrival on a throttled connection on a REAL generated draft — the receipt enters ONCE as one batch, the seal pulses once, and nothing on the card reads as still-deciding. |
| M4 | The face tracks a skill bind/unbind without a save and without flicker | Req 1 | The async-map settle is only visible live (Pitfall 1) | Bind a skill to a step, then unbind, watching the face |
| M5 | The seeded describe text reads like something a person typed | Req 6 | Copy quality | Pick each of the 3 templates |
| M6 | **SC#6 live** — armed checkpoint cannot be preempted | Req 7 / SC#6 | Needs a live Redis rendezvous + a real browser answer | Run an armed phase carrying a `timing="pre"` `ask_user` validator. Answer the author's gate **Proceed**; confirm the armed checkpoint appears in the chat `PendingAskCard`. **Refuse** it. Confirm the step did NOT run and `harness_audit` has **zero** `validator_ask_user_approved` rows for it. |
| M7 | **SC#10 live row** — the env path reaches `resolve_authoring_model` | SC#10 | Requires a backend restart | Restart backend with `HARNESS_AUTHORING_MODEL` set; generate; confirm the model actually used |
| M8 | Flag-OFF Builder first screen is byte-identical to today | D-181-01 | No shipped test covers it | Turn `visual_workflow_canvas` OFF; open the Builder's first screen; confirm no template line |
| **M9** | **The receipt's two paragraphs read as ONE honest account** on a typical generated draft | Req 5 / VOCAB-02 (CR-01) | The automated half can prove *which steps each sentence counts*. It cannot say whether two sentences, read one after the other by a person, add up to one coherent account or to a contradiction. That judgement is the whole point of the surface. | Generate a REAL draft whose spine is `llm_agent → llm_emit` (the shape **both** curated starters produce — `StarterTemplatePicker.tsx:50-53`). Then confirm, reading the card as a person: (1) the *"…read your documents, so I set them to must prove it"* sentence counts **only** the steps that actually read documents — cross-check its number against the steps you can see retrieving; (2) the deliverable step is **still named** and **still explains its own seal**; (3) **no** sentence claims the AI applied a gate that the step's own `citation_policy` default applied; (4) the *"You can't turn that off"* line sits with the detected paragraph and nowhere else. Cross-check the receipt's counts against the ⛨ seals the canvas actually draws. |
| **M10** | **The zero-detected draft still arrives as one thing**, not a card with a hole in it | Req 5 / D-187-10 | The suite can assert one paragraph is absent. It cannot assert that what remains still *looks* whole — a component with a paragraph removed can be individually correct and compositionally broken, and only a person can see the difference. | Describe a workflow with **no retrieval at all** (nothing that reads documents). Confirm the receipt **still arrives**, with its heading and its closing line intact; the *"You can't turn that off"* sentence is **absent**; and whatever remains reads as ONE deliberate arrival rather than a truncated card. Watch the entrance, not just the final frame. |
| **M11** | **The card states no capability the step lacks — and still states the one it has** | Req 1 / VOCAB-01 (WR-02) | The negative half alone can pass by over-tightening. The **positive** half is what proves the gate did not, and the pair is only convincing when a person sees both cards at once — two green unit tests on separate halves never show the contrast. | Bind a folder on a step type that **cannot** search (e.g. a *Write it up* / `llm_single` step, or a human-input step): confirm the card **no longer** says *"Search {folder}"* and reads its plain type sentence instead, with no folder name and no raw id anywhere on it. Then bind the **same** folder on an **agent** step: confirm it **does** say *"Search {folder}"*. Read the two cards side by side on the same canvas. |
| **M12** | **The ＋ row promises the sentence the card that lands actually says** | Req 1 / VOCAB-01 (WR-03) | The drift was **semantic, not lexical** — both strings were imported identifiers, so every `?raw` source fence stayed green through the whole defect. A person reading two sentences one click apart is the only instrument that catches this class. | Open `＋` on the lane and **read every row aloud**. Click the **human-input** row. Confirm the card that lands says the **same sentence the row promised** (*"Wait for your approval"*), not a second wording. Repeat once with a different row (e.g. the deliverable step) as a control that nothing else moved. |

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
