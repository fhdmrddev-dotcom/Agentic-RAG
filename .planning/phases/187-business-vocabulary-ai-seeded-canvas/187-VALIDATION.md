---
phase: 187
slug: business-vocabulary-ai-seeded-canvas
status: complete
nyquist_compliant: true
wave_0_complete: true
created: 2026-08-02
gates_measured: 2026-08-02
phase_base: 35261e96
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

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

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
| M3 | The receipt arrives once, seal pulses once, implies nothing still-deciding | Req 5 | Temporal + perceptual | Watch arrival on a throttled connection |
| M4 | The face tracks a skill bind/unbind without a save and without flicker | Req 1 | The async-map settle is only visible live (Pitfall 1) | Bind a skill to a step, then unbind, watching the face |
| M5 | The seeded describe text reads like something a person typed | Req 6 | Copy quality | Pick each of the 3 templates |
| M6 | **SC#6 live** — armed checkpoint cannot be preempted | Req 7 / SC#6 | Needs a live Redis rendezvous + a real browser answer | Run an armed phase carrying a `timing="pre"` `ask_user` validator. Answer the author's gate **Proceed**; confirm the armed checkpoint appears in the chat `PendingAskCard`. **Refuse** it. Confirm the step did NOT run and `harness_audit` has **zero** `validator_ask_user_approved` rows for it. |
| M7 | **SC#10 live row** — the env path reaches `resolve_authoring_model` | SC#10 | Requires a backend restart | Restart backend with `HARNESS_AUTHORING_MODEL` set; generate; confirm the model actually used |
| M8 | Flag-OFF Builder first screen is byte-identical to today | D-181-01 | No shipped test covers it | Turn `visual_workflow_canvas` OFF; open the Builder's first screen; confirm no template line |

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

**Approval:** ready for `/gsd:verify-work` — the eight Manual-Only G-4 rows are the operator's and
remain unperformed.
