# Phase 134: Eval Results, Honest Verdict + Ratings - Context

**Gathered:** 2026-07-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Turn the raw eval outputs Phase 133 persists into a **readable, honest result**: an
automated **per-provider pass/fail verdict** (EVAL-03), a genuinely readable **side-by-side
with-skill vs without-skill comparison** (EVAL-03), and **thumbs up/down ratings** on
individual answers that persist as a queryable human-preference signal the self-improvement
loop (Phase 135) can consume (EVAL-04).

Phase 133 already shipped the **runner** (pick provider/model → run each test case with-skill
vs without-skill → persist both raw answers + per-result `status`/`error`/tokens in
`eval_runs`/`eval_results`, migration 080) and a **thin `--skip-ui` surface**
(`SkillEvalSection.tsx`) that only stacks the two raw answers. 134 adds the **verdict +
comparison + ratings** layer on top of that data — directly closing the user's
*"no verdict / missing info"* complaint.

**Scope fence:** 134 is the **functional** read/rate surface. The **designed, role-gated,
plain-language Skill Evals panel** is **Phase 137** (PANEL-01, G-2 sketch-gated). The
**cross-provider baseline-arm hardening** is **SEED-100** (a dedicated future phase). 134
extends only the net-new eval files from 133 + reuses the existing judge read-only — it does
NOT touch the shared Deep/agent-loop/provider path (D-14 red line); Deep Mode stays
byte-identical (SC#10).
</domain>

<decisions>
## Implementation Decisions

### Verdict engine — what computes pass/fail
- **D-01:** The verdict is an **automated LLM judge**, NOT human-marked and NOT a heuristic.
  A test case's `expected_behavior` is **free text** (migration 079 — explicitly "NOT an
  assertion, D-06"), so only an LLM judge can grade it. **Reuse the judge we already shipped
  for workflow quality gates** — `backend/app/services/harness/validator_kinds.py`:
  `resolve_judge_model` (:58) + the forced-emission, schema-bound `JudgeVerdict` (:103) where
  `overall_passed` is a real boolean the model can't narrate/regex its way around
  (T-102-03-01). The eval judge grades an answer against the case's `expected_behavior`.
  This is the only mechanism that produces an automated "passed" that **Phase 136 (publish
  gate)** and **Phase 135 (auto-re-eval)** can consume.
- **D-02:** **Grade BOTH arms** (`with_skill` AND `without_skill`) against `expected_behavior`
  → a per-arm pass/fail. The skill's value reads honestly as **with = pass / without = fail**.
  Best signal for SI-01, cleanest A/B story. Cost = 2 judge calls per case. (Not with-only;
  not a single comparative better/worse judgment — those don't give the absolute "passed"
  the publish gate needs.)
- **D-03:** The judge runs on an **independent, fixed model** via `resolve_judge_model(settings)`
  (`settings.harness_judge_model` → else first of `claude-opus-4-8`/`gpt-5.5` with
  `forced_emission`) — **never the provider/model under test**, so a weak provider can't grade
  itself and the verdict is truncation-safe (forceable). Reuse `resolve_judge_model` verbatim.
- **D-04:** **Errored / empty arms are NEVER graded** — they carry an honest `not_measured`
  verdict state, never a fabricated pass/fail (EVAL-03 SC#1). The input is the existing
  per-result `status`/`error` (migration 080): `status != 'completed'` (or empty `output`) →
  verdict = `not_measured`. This is exactly what makes the two deferred cross-provider bugs
  (D-11) surface honestly instead of silently.

### Grading timing + storage
- **D-05:** Grade **inline during the run** — `eval_runner_service.run_eval_job` grades each
  arm right after that arm's completion lands, persists the verdict alongside the result, and
  streams a verdict event (additive on the existing `eval_*` SSE vocabulary) so the live
  readout shows pass/fail as cases finish. One integrated flow; the verdict is ready the moment
  the run completes. No separate post-run grading pass (re-grade = re-run; re-grade-without-rerun
  is not a stated need — deferred).
- **D-06:** **Verdict storage = additive columns** (migration 081), written by the SAME
  service-role task that writes the row (consistent with 080's service-role-write / append-only
  model — no client write): on **`eval_results`** add per-arm verdict fields (e.g.
  `verdict_passed bool|null`, `verdict_score int|null`, `verdict_reason text|null`,
  `verdict_state` ∈ `graded`/`not_measured`, `judge_model text`); on **`eval_runs`** add the
  rollup (`passed_count`, `measured_count`, optional `verdict_summary`). Planner finalizes exact
  column/enum names (consistent with 080 conventions).

### Verdict aggregation — the per-provider rollup
- **D-07:** A run is single-provider (133 D-01), so the **per-provider verdict = the run rollup**,
  reported **honestly as a count**: **"X / N with-skill cases passed"** (X = passed with-skill,
  N = *measured* cases) plus a simple boolean rollup for downstream gates. The **exact pass
  threshold** the publish gate enforces is **deferred to Phase 136** (GATE-01 owns it). 134 only
  reports the honest count + a default rollup (e.g. pass = every measured with-skill case passed
  AND ≥1 measured). Don't bake a contested threshold here.

### Ratings — EVAL-04
- **D-08:** Ratings = a **new `eval_ratings` table** (migration 081), FK `eval_result_id →
  eval_results.id` (the stable PK migration 080 reserved: *"Phase 134 ratings FK
  eval_results.id"*). Granularity = **one thumbs up/down per (user, individual answer)** — the
  `eval_results` row (case × variant × provider), **re-ratable** (toggle/clear), owner-scoped.
  Written via a **backend endpoint** on the eval router (`.eq("user_id")` gate, service-role
  write — 132/133 precedent), NOT a client-direct write. (Not per-case preference; not a column
  on the append-only `eval_results`.)
- **D-09:** The signal **SI-01 (Phase 135)** consumes: an `eval_results` row already ties to
  skill_version + test_case + variant + output + (D-06) the judge verdict, so a minimal rating
  row + a join gives 135 everything. Keep the row minimal — `(id, eval_result_id, user_id,
  rating, created_at, updated_at)`; 135 does the joins. The high-value cue is **human–judge
  disagreement** (thumbs-DOWN an answer the judge PASSED, or thumbs-UP one it failed).

### UI scope — 134 functional vs 137 designed
- **D-10:** 134 **extends the existing thin `SkillEvalSection.tsx` only** — add (a) the per-run
  verdict line ("X/N passed" + honest "errored / not measured"), (b) a real **side-by-side**
  with/without per case showing each arm's pass/fail + a one-line judge reason, (c) **thumbs
  up/down** on each answer. Stay **undesigned**: NO plain-language explainer, NO progressive
  disclosure, NO role-gating, NO new design-system chrome — those are explicitly **Phase 137**
  (PANEL-01, G-2 sketch) + SEED-100/SEED-099. **G-2 does NOT fire on 134** (honors the 133 D-07
  fence: the thin surface must not pre-empt or constrain the 137 design).

### Cross-provider baseline bugs — reported-bugs routing (mandatory cross-check)
- **D-11:** **BUG-260701-01** (assistant-prefill 400 on claude-sonnet-5 / Claude 4.6+5 family —
  major, shared agent loop) + **BUG-260630-01** (DeepSeek `reasoning_content` 400 — minor,
  gateway adapter) both break the WITHOUT-skill baseline arm on newer models. **DEFERRED to
  SEED-100** (the dedicated cross-provider eval-hardening phase): the fixes touch the **shared
  agent-loop/gateway path** (D-14 red line) and deserve their own focused full-roster SC#10 pass,
  not a bolt-on inside this net-new eval phase. 134 **surfaces them honestly** via D-04
  (`not_measured`) but does NOT fix them. Both reports re-routed to `status: deferred` with
  SEED-100 `re_open_trigger`s on 2026-07-01. (Bonus: real errored arms make 134's honest-error
  UAT concrete — see D-12.)

### Locked constraints (restated for downstream — not gray areas)
- **D-12:** **SC#10 applies** (134 touches provider routing + UI state). VALIDATION.md MUST carry
  the 4-axis rows — cross-provider (OpenAI/Anthropic/Google/OpenRouter representative) × multi-tool
  × parallel-thread × long-history — **authored in VALIDATION.md, not PLAN tasks**. The judge adds
  a second (independent-model) provider call per arm, so UAT must prove the verdict is honest
  across providers AND include an **intentional errored-arm row** (e.g. a sonnet-5 baseline)
  showing `not_measured`, never a fake score.
- **D-13:** **Net-new only / red line (D-14).** Extend `backend/app/api/evals.py` +
  `backend/app/services/eval_runner_service.py` + `backend/app/models/eval_run.py` (all net-new
  from 133) + `frontend/src/components/skills/SkillEvalSection.tsx`; reuse the judge **read-only**.
  Do NOT grow `threads.py`, do NOT edit the shared Deep/agent-loop/provider path. Deep Mode stays
  byte-identical.
- **D-14:** **Migration discipline.** Migration `081` (verdict columns on eval_runs/eval_results +
  the `eval_ratings` table) applied via the Supabase SQL editor or psycopg2 :54322 (NEVER
  `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit the
  migration + regenerated `full-schema.sql` together.

### Claude's Discretion
- Exact column/enum names for the verdict fields + `eval_ratings`, and the eval rubric prompt text
  (adapt `JUDGE_RUBRIC_CORE` to `expected_behavior` — keep the anti-injection discipline:
  `expected_behavior` woven as DATA, not as an instruction to the judge).
- Whether the eval judge reuses `_validate_llm_judge_rubric` directly or a thin eval-specific
  judge fn wrapping `resolve_judge_model` + the forced `JudgeVerdict` schema (the workflow judge
  is coupled to `field_map`/`business_requirement` shapes — a small eval wrapper is likely cleaner;
  reuse the model resolver + the schema-bound-verdict pattern either way).
- Whether the two arms' judge calls run sequentially or concurrently; exact shape/name of the
  verdict SSE event (additive, consistent with 133's `eval_*` events).
- The exact rollup boolean rule for the run verdict (within D-07's honest-count framing), pending
  Phase 136 owning the publish threshold.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring`** (todo.match-phase score 0.6) — NOT folded. Keyword-only match
  ("human / run / case"); it's about NL→workflow authoring, unrelated to eval results, and already
  satisfied (NL authoring shipped in Phase 103, per STATE.md deferred items).
</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement / scope contract
- `.planning/REQUIREMENTS.md` — **EVAL-03 / EVAL-04** (this phase), the **D-14 red line** (never
  fork the shared Deep/agent-loop/provider path), the **SC#10 mandate**, and the "no eval enforced
  on existing published skills / no full skills-tab redesign" exclusions.
- `.planning/ROADMAP.md` — **Phase 134** section (Goal + 4 Success Criteria + "UI hint: functional
  read/rate surfaces") and **Phase 136 (GATE-01)** + **Phase 137 (PANEL-01)** for the scope fence
  (134 ≠ the designed panel; the publish threshold lives in 136).

### Upstream eval foundation (FK targets, RLS model, runner contract — MUST honor)
- `.planning/phases/133-eval-runner-with-skill-vs-without-skill/133-CONTEXT.md` — the runner
  decisions 134 builds on: single-provider/run (D-01), provider-keyed results (D-02), target-only
  WITH vs empty WITHOUT (D-03/D-04), persist-per-case + reattach-on-reload (D-06), thin-surface
  fence (D-07), and the explicit deferral of *"per-provider verdict + side-by-side + ratings"* to
  THIS phase.
- `.planning/phases/132-skill-versioning-eval-test-case-persistence/132-CONTEXT.md` — owner-only
  RLS + the stable FK targets (skill_versions.id / skill_test_cases.id) the eval rows hang off.
- `supabase/migrations/080_eval_runs_and_results.sql` — the two tables 134 extends; note the
  table comment reserving *"Phase 134 ratings FK eval_results.id (keep PK stable)"* and the
  per-result `status`/`error` columns that drive the honest `not_measured` state.
- `supabase/migrations/079_skill_versions_and_test_cases.sql` — `skill_test_cases.expected_behavior`
  is **free text, NOT an assertion** (the judge's bar) + the owner-only RLS precedent.

### The judge to reuse (read-only)
- `backend/app/services/harness/validator_kinds.py` — `resolve_judge_model` (:58, reuse verbatim),
  `JudgeVerdict`/`JudgeCriterionVerdict` (:103/:88, forced-emission, schema-bound `overall_passed`),
  `JUDGE_RUBRIC_CORE` (:120, adapt to `expected_behavior`), `_validate_llm_judge_rubric` (:389),
  `_evaluate_judge_verdict` (:483).
- `backend/app/services/harness/publish_service.py` — `_judge_golden_output` (:638) = the
  publish-stage judge precedent (independent judge model + schema-bound verdict end-to-end).

### Backend eval surface to EXTEND (net-new from 133 — safe to grow)
- `backend/app/api/evals.py` — the owner-scoped router: `GET /skills/{id}/evals/runs/{run_id}`
  (add verdict to the durable readout) + add a **ratings endpoint**; `.eq("user_id")` is the sole
  runtime gate (service-role bypasses RLS), 404-not-403 on cross-user.
- `backend/app/services/eval_runner_service.py` — `run_eval_job` (the runner; inline grading
  attaches here per D-05).
- `backend/app/models/eval_run.py` — Pydantic contracts (`EvalRunResponse`/`EvalResultResponse`);
  add verdict + rating fields (FLAT single-typed — Gemini `type:[...]` array trap).

### Frontend surface to EXTEND (the thin, undesigned surface — D-10)
- `frontend/src/components/skills/SkillEvalSection.tsx` — already groups results by case +
  renders both arms; add the verdict line, real side-by-side + judge reason, and thumbs buttons.
  Keep it plain (no design-system chrome) per the 133 D-07 / Phase 137 fence.
- `frontend/src/lib/api.ts` + `frontend/src/types` — `getEvalRun`/`listEvalRuns`/`subscribeToRun`
  + the `EvalRun`/`EvalResult` types to extend with verdict + rating.

### Deferred-but-named (routing context)
- `.planning/seeds/SEED-100-skill-eval-production-clean-cross-provider-and-clarity.md` — the
  dedicated home for the two baseline bugs (cross-provider hardening) + the clarity/role-gate work
  (which is Phase 137's bar).
- `.planning/reported-bugs/BUG-260701-01-agent-loop-assistant-prefill-400-newer-models.md` /
  `.planning/reported-bugs/BUG-260630-01-deepseek-without-skill-reasoning-content-400.md` —
  re-routed to `deferred` (SEED-100) at this discuss; 134 surfaces, does not fix.

### Patterns / guardrails
- `CLAUDE.md` — migration apply-via-SQL-editor + regen-full-schema (no reset); `run_in_threadpool`
  around blocking supabase-py in async handlers (D-v2.5-01); no in-process run-state singletons
  under `WORKER_COUNT=2` (D-PRD-12); the SC#10 4-axis recipe.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The workflow LLM judge** (`validator_kinds.py`) — `resolve_judge_model` + the forced,
  schema-bound `JudgeVerdict` give an independent, truncation-safe, non-narratable pass/fail. The
  eval verdict is a thin adaptation (rubric grades against `expected_behavior`), not a from-scratch
  build.
- **Per-result `status`/`error`** (migration 080, already populated by 133's runner) — the input
  to the honest `not_measured` state; no new capture needed, just consume it.
- **The eval router + runner + stream** (`evals.py`, `eval_runner_service.py`, the companion
  `public.runs` row + `subscribeToRun`) — verdict events ride the existing `eval_*` SSE vocabulary;
  the durable readout already re-fetches from the DB, so verdict + ratings render for free once
  persisted.
- **`SkillEvalSection.tsx`** already groups by `test_case_id` and renders both variants — the
  side-by-side scaffold exists; 134 enriches it.

### Established Patterns
- **Owner-scoping:** app-code `.eq("user_id")` is the real gate (service-role bypasses RLS);
  owner-only RLS SELECT is defense-in-depth. The ratings write follows the same pattern (a backend
  endpoint, not a client write) even though it's the first *user-initiated* write in the eval domain.
- **Service-role-write / append-only tables:** `eval_runs`/`eval_results` have no client
  INSERT/UPDATE/DELETE policy → verdict columns are written by the same service-role task at row
  time (D-06); user ratings need their own table (D-08).
- **Single-typed Pydantic fields** (Gemini `type:[...]` trap) — all new model fields stay
  `str|None`/`int|None`/`bool|None`, never a multi-type union.

### Integration Points
- **Migration 081** — additive verdict columns on `eval_runs`/`eval_results` + new `eval_ratings`
  table (FK `eval_results.id`, owner-only RLS).
- **`eval_runner_service.run_eval_job`** — inline grade hook after each arm completes; rollup
  written at run finalize.
- **`evals.py`** — verdict surfaces through the existing `GET …/runs/{run_id}` readout; a new
  ratings endpoint (POST/PUT, `.eq(user_id)` gate).
- **`SkillEvalSection.tsx`** — verdict line + side-by-side + thumbs; reuses the existing stream
  client (no new stream code).

</code_context>

<specifics>
## Specific Ideas

- **Honesty is the headline.** EVAL-03 SC#1 is "never a fabricated score" — the errored/empty arm
  must read as `not_measured`, and the judge must be schema-bound (a narrated/truncated verdict
  can't fake a pass; reuse the T-102-03 discipline).
- **The verdict directly answers the user's complaint** — *"as a user I still do not know what
  that means"* drove this phase. 134 makes the verdict legible-enough (functional); the
  plain-language framing + progressive disclosure that fully closes that complaint is Phase 137 +
  SEED-100, by deliberate split.
- **Grade both arms** so the readout tells the *story* the user wants: "the skill moved the needle"
  (with=pass / without=fail), not just two opaque blobs.

</specifics>

<deferred>
## Deferred Ideas

- **Cross-provider baseline-arm hardening** — BUG-260701-01 (sonnet-5 assistant-prefill 400) +
  BUG-260630-01 (DeepSeek reasoning_content 400) → **SEED-100** (dedicated phase; shared-path /
  D-14, full-roster SC#10). 134 surfaces honestly, does not fix.
- **Designed, role-gated, plain-language Skill Evals panel** (explainer + progressive disclosure +
  who-sees-evals) → **Phase 137** (PANEL-01, G-2 sketch) + SEED-100 clarity half + SEED-099 role-gate.
- **The publish pass/fail threshold** (how many cases must pass to "pass") → **Phase 136**
  (GATE-01 owns it); 134 reports the honest X/N count + a default rollup.
- **Re-grade without re-running** (re-judge persisted outputs with a new rubric/judge model) —
  not a stated need; revisit only if lived UAT wants it.
- **Multi-provider verdict in one run** (compare providers side-by-side) — results are already
  provider-keyed (133 D-02); additive later, not 134.

</deferred>

---

*Phase: 134-eval-results-honest-verdict-ratings*
*Context gathered: 2026-07-01*
