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
