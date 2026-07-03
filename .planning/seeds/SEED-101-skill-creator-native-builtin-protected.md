---
seed_id: SEED-101
title: Skill Creator reborn — platform-native built-in skill (read-only, seeded, deploy-safe) + eval-engine harvest from Anthropic's skill-creator
status: promoted
planted: 2026-07-04
promoted_to: "Phase 137.2 (CREATE-01); eval-engine harvest items promoted to Phase 137.1 (EVAL-05 / SEED-100)"
phase_origin: "Operator, 2026-07-04: re-attached the Claude.ai skill-creator skill (manually recreated zip at screenshots/skill-creator.zip) and asked (a) did we ever implement a skill-creator — it should be read-only and undeletable; (b) full capability match vs what we built; (c) implement to a 'perfect skill feature' standard aligned with our app + RAG, complementing (never breaking) the shipped 132–137 Studio."
category: product — built-in skill authoring experience + skill-eval engine completeness
related_seeds:
  - SEED-100-skill-eval-production-clean-cross-provider-and-clarity (the paired engine-trust phase; harvest items land there)
  - SEED-096 (skill bundle-tree fidelity + runtime tooling — why verbatim-imported scripts are inert)
  - SEED-099 (feature visibility by role — who sees advanced eval surfaces)
related_memories: [project_skills_mime_known_gap, reference_js_skill_import_gap, feedback_iterate_leverage_existing, feedback_vibe_coder_communication]
priority: high
---

# SEED-101 — Skill Creator reborn: platform-native, built-in, protected

## The finding (2026-07-04 investigation)

1. **We DID ship a skill-creator** — migration `018_skill_creator_seed.sql` (Phase 12 /
   SKIL-08) seeds a global `skill-creator` owned by system user
   `00000000-0000-0000-0000-000000000001`. But it is a **thin 3-question interview**
   ("what task / what constraints / what output") that calls `save_skill` — nothing
   like the Claude.ai loop.
2. **The seeded row is GONE from the live DB** (system user survives; skill row
   `...0010` absent) **and was never deploy-safe**: `full-schema.sql` is a
   schema-only dump, so cloud/greenfield environments never get the seed at all.
   This is why the operator "did not see any skill creator."
3. **Protection exists but only for system-owned global skills**: update/delete
   endpoints are owner-scoped (`skills.py:330,359`) and the UI hides actions for
   non-owned global skills (`SkillCard.tsx:157`). There is NO `is_system` flag. The
   operator's manual copy (user-owned, 33KB instructions + only 3/18 files:
   agents/*.md) is fully editable/deletable — and its content is **runtime-inert**
   here (assumes subagents, `claude -p` CLI, browser viewers, filesystem workspaces).
   Adding the missing 14 files would NOT make it functional (SEED-096 class).

## Complete capability matrix — every file in skill-creator.zip

Source studied in full 2026-07-04: `screenshots/skill-creator.zip` (18 files).
Decision legend: **HAVE** (shipped, aligned) · **HARVEST** (adopt the idea into our
engine — Phase 137.1) · **ADAPT** (re-express platform-native in the reborn
skill-creator — Phase 137.2) · **SKIP** (runtime-inapplicable; record why).

### SKILL.md (459 lines — the orchestration prompt)

| Capability | Ours today | Decision |
|---|---|---|
| Capture intent from conversation ("turn this into a skill"), interview (edge cases, I/O formats, files, success criteria) | thin 3-question seed (gone) | **ADAPT** — core of the reborn instructions |
| Skill anatomy: SKILL.md + scripts/references/assets; progressive disclosure (metadata → body → resources); <500-line body; domain-variant organization | not encoded | **ADAPT** — translated to our model (description → instructions → skill_files read via read_skill_file; sandbox executes Python only) |
| "Pushy" description guidance (combat under-triggering) | partially in `skill_lint` trigger-verb check | **ADAPT** (skill-creator guidance) + **HARVEST** (builder-prompt tip in tuner) |
| Principle of Lack of Surprise (no malicious/misleading skills) | not encoded | **ADAPT** — one paragraph, aligns with import scan posture |
| Writing craft: imperative form, output-format templates, examples pattern, explain-the-why over MUSTs, generalize-don't-overfit | not encoded | **ADAPT** — verbatim-spirit harvest into reborn instructions |
| Draft 2–3 realistic test prompts, user confirms, save (evals.json) | `skill_test_cases` + CaseEditor (manual); tuner `auto_seed_cases` (trigger cases only) | **HAVE** (storage/UI) + **ADAPT** — reborn skill guides the agent to propose eval cases conversationally; decide at discuss-phase whether the agent gets an add_test_case tool or hands the user to the Studio |
| Spawn with-skill + baseline runs in parallel; iteration workspaces | eval runner (133): with/without arms per case, DB-persisted | **HAVE** — ours is a product engine, theirs is ad-hoc dirs |
| Draft assertions while runs execute; descriptive eval names | single `expected_behavior` per case + judge score/reason | **HAVE** (different shape — judge rubric vs assertion list); per-assertion granularity NOT adopted (keep the simpler honest verdict; revisit only if eval trust demands it) |
| Capture per-run timing/tokens | tokens per arm (`eval_results.input/output_tokens`); NO wall-clock per arm | **HARVEST** — add per-arm duration (137.1) |
| Grade → aggregate → analyst → human viewer loop | judge (134) + evidence channel (`dd694916`) + Studio RunHistory/RunCaseDetail | **HAVE** |
| Human feedback per output (freeform text + empty-means-fine) | thumbs up/down (EVAL-04) | **HAVE** (lighter); optional freeform note = nice-to-have, not scoped |
| Improve loop: generalize from feedback, keep prompt lean, explain why, bundle repeated helper scripts as scripts/ | proposals (SI-01, 135) + versions + auto-re-eval | **HAVE** (engine); the *craft guidance* itself → **ADAPT** into reborn instructions |
| Blind A/B comparison (optional path) | none (proposer compares via eval verdicts, not blinded) | **SKIP for now** — our judge + auto-re-eval covers the decision need; record as future idea only |
| Description optimization: 20 realistic trigger evals (near-miss negatives), user review UI, optimization loop, apply best | Trigger Tuner (123/123.1): auto-seed should/should-not cases incl. sibling near-misses, review UI, candidates scored, winner applied | **HAVE** — ours is N-provider (theirs single-model) |
| Communication calibration for non-technical users | house style (feedback_vibe_coder_communication) | **ADAPT** — bake into reborn instructions |
| Package + present `.skill` | `/skills/{id}/export` + `import_skill` round-trip | **HAVE** (MIME fidelity gap = SEED-096, unchanged) |
| Update-existing-skill: preserve name, snapshot before editing | immutable `skill_versions` (079) — strictly better | **HAVE** |
| Runtime adaptations section (Claude.ai/Cowork variants) | n/a | **SKIP** — reborn skill is written for exactly ONE runtime: ours |

### agents/grader.md (222 lines)

| Capability | Ours today | Decision |
|---|---|---|
| Per-assertion PASS/FAIL with cited evidence; substance-over-surface (right filename ≠ right content); burden of proof on the expectation; no partial credit | judge grades output+evidence vs expected_behavior with score/reason; honest not_measured | **HAVE** (rubric already names runtime receipts ground truth) |
| Claims extraction + verification (factual/process/quality; flag unverifiable) | evidence channel covers process claims (tool receipts) | **HAVE-partial** — adequate; no action |
| **Critique the evals themselves** (`eval_feedback`): flag assertions a wrong output would still pass, outcomes no assertion covers, unverifiable assertions — "keep the bar high" | nothing | **HARVEST (137.1)** — judge emits optional per-case `case_feedback` (weak/non-discriminating case warnings) surfaced in the Studio |
| Executor user-notes summary (uncertainties/workarounds) | run error field + honest statuses | HAVE-partial; no action |

### agents/comparator.md (201 lines) — blind A/B with task-adapted rubric

**SKIP for now** (see SKILL.md row). The task-adapted two-dimension rubric
(content: correctness/completeness/accuracy; structure: organization/formatting/
usability) is good prior art if judge quality ever needs deepening — noted here so
it isn't lost.

### agents/analyzer.md (273 lines)

| Capability | Ours today | Decision |
|---|---|---|
| Post-hoc win/loss analysis: instruction-following score, categorized prioritized improvement suggestions (instructions/tools/examples/error_handling/structure/references) | proposer (135) produces rationale + evidence + diff | **HAVE** (proposer is the actionable subset); category taxonomy → **ADAPT** as prior art if proposer output ever restructures |
| **Benchmark analyst notes**: per-assertion discrimination (always-passes-both = non-discriminating; always-fails-both = broken; passes-with/fails-without = skill value; fails-with/passes-without = skill hurts; high variance = flaky), cross-eval patterns, time/token tradeoffs, grounded freeform notes | rollup counts only ("N/M passed · K not measured") | **HARVEST (137.1)** — with matrix/N-run data, add analyst-style annotations to the run readout (pairs with SEED-100 asks #1/#4) |

### references/schemas.md (429 lines)

Data-shape prior art. Our DB already covers evals/grading/history equivalents
(`skill_test_cases`, `eval_runs`, `eval_results`, `skill_versions`,
`skill_proposals`). **benchmark.json's `run_summary`** (per-config mean ± stddev +
delta) is the shape to adopt when matrix runs land (137.1). No verbatim adoption.

### scripts/ (9 files)

| File | What it does | Ours | Decision |
|---|---|---|---|
| `run_eval.py` (309) | Trigger testing by REAL runtime observation: spawns `claude -p`, watches stream for Skill/Read tool_use on the candidate; workers, runs_per_query=3, threshold 0.5, precision/recall | Tuner `classify_fires` — forced TriggerDecision against the REAL `LOAD_SKILL_POLICY` (imported, not paraphrased), 3 repeats, N providers | **HAVE** (different method: classifier-fidelity vs behavioral; ours is cheaper + cross-provider; tradeoff documented here — no action) |
| `improve_description.py` (246) | Failure-driven LLM rewrite; anti-overfit prompt (generalize, no query laundry-lists, 100–200 words, 1024 hard cap + auto-shorten retry); history of prior attempts w/ scores; test scores blinded from improver | Tuner `build_candidates` — N candidates in ONE round, no failure-feedback iteration | **HARVEST (137.1, small)**: (a) 1024-char cap + auto-shorten in builder/lint; (b) optional iterate-N-rounds mode feeding train failures + attempt history back to the builder (blind to held-out) — only if cheap; the one-round N-candidate design already works |
| `run_loop.py` (327) | Full loop: stratified 60/40 train/test split, improve on train failures only, stop on all-train-pass or max 5, **pick winner by TEST score**, live HTML report | Tuner: same 60/40 held-out split, 3 repeats, winner by HELD-OUT — exact parity | **HAVE** |
| `aggregate_benchmark.py` (400) | mean/stddev/min/max per config for pass_rate/time/tokens + delta; arbitrary config names (with/without, new/old) | single-run rollup only | **HARVEST (137.1)** — the aggregation shape for matrix/N-run summaries |
| `generate_report.py` (325) | HTML report of optimization iterations | Tuner run UI in Studio | **HAVE** |
| `package_skill.py` (135) | Validate + zip `.skill` with exclusion rules | export endpoint | **HAVE** |
| `quick_validate.py` (145) | SKILL.md frontmatter validation: name kebab-case ≤64; description ≤1024, no angle brackets; frontmatter key whitelist; exactly one SKILL.md | `skill_lint` (name-echo, trigger-verb, generic, duplicate) — quality lint, no structural caps | **HARVEST (137.1 or 137.2, tiny)** — additive lint warnings: name kebab-case + description length cap (portability with Claude.ai skill format); never blocking (D-09 posture) |
| `utils.py` (46) | parse SKILL.md frontmatter | import_skill parser | **HAVE** |
| `LICENSE.txt` | — | — | n/a |

### eval-viewer/ + assets/ (3 files)

| File | What it does | Ours | Decision |
|---|---|---|---|
| `generate_review.py` (470) + `viewer.html` (1324) | Self-contained review server: Outputs tab (prompt, inline-rendered output files incl. images/office, previous-iteration output, collapsed formal grades, autosave feedback), Benchmark tab (stats + analyst notes), Submit All Reviews → feedback.json | Studio EvalsTab + RunCaseDetail (side-by-side arms, verdict badges, thumbs, progressive disclosure) — 137's designed panel | **HAVE** — our Studio IS this viewer, productized. "Previous Output (iteration N-1)" comparison = covered by run history rows + Versions compare |
| `assets/eval_review.html` (145) | Trigger-eval-set review/edit UI (toggle should-trigger, add/delete, export) | Tuner case list (should-fire/should-not editable) | **HAVE** |

## What the reborn skill-creator IS (Phase 137.2 scope — CREATE-01)

A **built-in, read-only, seeded** `skill-creator` skill whose instructions teach the
agent to run OUR loop end-to-end, in plain language, for any user who says "help me
create a skill":

1. **Interview** — capture intent from the conversation first (harvest: intent
   capture, edge-case/format/success-criteria questions, communication calibration).
2. **Research with RAG** — unlike Claude.ai's, ours can `search_documents` the
   user's knowledge base for domain context before drafting (our differentiator —
   "according to our application capabilities and RAG").
3. **Draft + save** — `save_skill` with craft guidance baked in (imperative form,
   explain-the-why, pushy-but-honest description, generalize-don't-overfit,
   progressive disclosure adapted to instructions + skill_files, Python-only
   scripts note per SEED-096 honesty).
4. **Test** — propose 2–3 realistic eval cases; route to the Studio (or tool, per
   discuss-phase) to persist them.
5. **Evaluate** — point the user at the eval run (with/without arms) and the
   verdict; explain what with/without means in plain language.
6. **Improve** — proposals loop (SI-01) + Trigger Tuner for the description.
7. **Publish** — the publish gate (GATE-01) is the finish line.

Delivery mechanics (137.2):
- **New seed migration** (idempotent, system-user-owned, `is_global=true`) with the
  rewritten instructions; supersedes/cleans the 018 row if present.
- **Read-only enforcement**: rely on existing owner-scoping + verify UI treatment;
  add a "Built-in" badge; decide at discuss-phase whether an explicit `is_system`
  column is warranted or system-ownership suffices (D-to-be).
- **Deploy story**: seed must reach cloud (parity checklist entry — data seeds are
  NOT in full-schema.sql; document in DEPLOYMENT-WORKFLOW parity list).
- **Operator's manual copy**: offer cleanup/rename once the built-in lands (operator
  decision; never auto-delete).

## Eval-engine harvest items (→ Phase 137.1 / SEED-100 scope)

1. Judge `case_feedback` — critique weak/non-discriminating test cases (grader.md Step 6).
2. Per-arm wall-clock duration on `eval_results` (+ tokens already there).
3. Matrix/N-run aggregation: per-config mean ± stddev + delta (benchmark.json shape) + analyst-style annotations (discrimination/flakiness/cost notes).
4. Description-builder polish: 1024-char cap + auto-shorten; optional failure-feedback iteration mode.
5. Additive lint: kebab-case name + description length (portability warnings, never blocking).

## Red lines (carry into both phases)

- Never break the shipped 132–137 Studio surfaces or the shared agent-loop/gateway
  path (D-14); everything here is additive.
- The reborn skill-creator instructs; it must never claim capabilities the runtime
  lacks (no subagents, no browser, Python-only sandbox — SEED-096 honesty).
- Built-in skill = one truth-teller: seeded content is versioned via migration, not
  hand-edited in the DB.
