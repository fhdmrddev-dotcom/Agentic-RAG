---
phase: 187
slug: business-vocabulary-ai-seeded-canvas
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-08-02
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| _TBD at plan time_ | — | — | — | — | — | — | — | — | ⬜ pending |

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

## Wave 0 Requirements

- [ ] `backend/tests/unit/test_187_armed_checkpoint_property.py` — SC#6 property, **observed RED first**
- [ ] `backend/tests/unit/test_187_authoring_step_names.py` — Req 2 + the 8-row SC#10 roster (serial;
      roster derived from `MODEL_CAPABILITIES` by grouping on `provider`, **never re-typed**)
- [ ] `frontend/src/components/workflows/SeedReceipt.tsx` + `.test.tsx` — Req 5
- [ ] `frontend/src/components/workflows/StarterTemplatePicker.tsx` + `.test.tsx` — Req 6
- [ ] `frontend/src/components/workflows/phaseVocabulary.corpus.test.ts` — SC#5 checks 1 & 2 over the
      named corpus (3 starters + `four_seed_defs()` + PM pack) as a **pure-function** assertion
- [ ] A **flag-OFF describe-screen pin** (D-181-01) — none exists today; copy the header-pin pattern
      at `WorkflowBuilderPage.header.test.tsx:302-322`
- [ ] A structural **zero-migration** gate for the phase
- [ ] Framework install: **none needed**

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

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references above
- [ ] No watch-mode flags
- [ ] Feedback latency < 30 s (quick sets)
- [ ] SC#6 property test observed **RED before the fix**, and falsified **RED after** the fix is
      temporarily removed
- [ ] Backend collection ≥ 3474 + net-new; frontend isolated sets ≥ 863 + 381 + net-new
- [ ] `git diff --stat -- supabase/migrations` empty
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
