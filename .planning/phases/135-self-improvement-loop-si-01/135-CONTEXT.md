# Phase 135: Self-Improvement Loop (SI-01) - Context

**Gathered:** 2026-07-02
**Status:** Ready for planning

<domain>
## Phase Boundary

The system closes the loop on skill quality: from eval results + Tuner signal it drafts an
instruction-body edit as a reviewable diff; the human approves or rejects; approval creates a
new immutable skill version that is automatically re-evaled, and the re-eval result gates
promotion to the live skill. The system NEVER auto-applies — human always in the loop
(REQUIREMENTS out-of-scope list is explicit). Instruction-body only: name/description edits are
SI-02 (Phase 139). Thin functional UI only — the designed Skill Evals panel is Phase 137
(PANEL-01, G-2 sketch); this phase must not pre-empt or constrain that design (133 D-07 /
134 D-10 fence).

</domain>

<decisions>
## Implementation Decisions

### Proposal trigger & evidence
- **D-01:** Proposals are drafted **on-demand only** — a "Propose improvement" action on the
  skill's eval readout (SkillEvalSection), enabled once the skill has at least one eval run with
  results. NO ambient/auto drafting: proposer-LLM spend is always user-initiated (the Trigger
  Tuner precedent). A post-run nudge affordance is deferred (137 candidate).
- **D-02:** The proposer consumes the **full evidence bundle**: failed + `not_measured` cases
  (prompt, `expected_behavior`, BOTH arms' outputs, judge verdict + `verdict_reason`), human
  ratings with **human–judge disagreement rows weighted as the top cue** (134 D-09 — the live
  U9 row, judge-PASS + human-DOWN, is the reference fixture), passing cases included as
  "don't break these" anchors, PLUS the **latest Tuner run signal as optional context when one
  exists** (fire/hold + axis scores tell the proposer whether triggering is the problem —
  instruction edits must not chase trigger issues). This matches SI-01's "eval results + Tuner
  signal" verbatim.
- **D-03:** The proposer model = **`resolve_skill_builder_model(settings)`**
  (`backend/app/services/skill_tuner_service.py:82` — the Tuner's authoring-model resolver).
  Structured output via the forced-emission pattern (Pydantic schema-bound), same discipline as
  the tuner/judge. Never the judge model, never hardwired.
- **D-04:** **One proposal at a time** — one button press drafts ONE instruction-body edit as a
  single reviewable diff. Re-pressing after a rejection produces a fresh attempt. No
  multi-candidate picker (deferred).

### Promotion semantics
- **D-05:** **Draft-version-first.** Approval creates the new immutable `skill_versions` row with
  **`source='self_improve'`** (the enum value 132 D-03-R1 explicitly reserved) WITHOUT touching
  the live `skills` row. The auto re-eval runs against that version snapshot (the 133 runner
  already evals a pinned version via `eval_runs.skill_version_id`). Pass → **promotion applies
  the version's instructions to the live skill**. Fail → live skill untouched; the version row
  remains as honest "not promoted" evidence with its re-eval run attached.
- **D-06:** **Failed re-eval is overridable, with evidence.** Default = not promoted; the user
  may explicitly force-promote, with the failed re-eval evidence rendered at the moment of
  override, and the override is recorded on the proposal (GATE-01's "blocks or warns with
  evidence" pattern; the U9 disagreement proves judges err — human is final authority).
- **D-07:** **Proposals persist in a new owner-scoped table** (migration next-in-sequence — 083;
  082 = `threads.is_eval` is the latest applied): proposed instructions + proposer
  rationale/evidence summary + status lifecycle
  (`proposed → rejected | approved → re_evaling → promoted | not_promoted | interrupted`) +
  FKs (skill, base skill_version, re-eval eval_run, user_id). The version row is created ONLY on
  approval — version history stays clean of unapproved drafts; rejections keep an audit trail.
  RLS owner-only defense-in-depth + app-code `.eq("user_id")` as the real gate; service-role
  writes via the backend router only (077/080/081 precedent); cross-user = 404 never 403.

### Diff review surface
- **D-08:** The review lives **inside SkillEvalSection** as a proposal card under the eval
  readout — one home for the whole loop (results → propose → review → re-eval → promote). No
  Skills-tab redesign (REQUIREMENTS exclusion); stays thin/undesigned (137 fence).
- **D-09:** **Unified line diff** (removed lines red / added lines green) — the compact
  "reviewable diff" idiom for long instruction bodies. Diff computation = a micro-dep (e.g.
  `diff`) or a small in-repo LCS util — planner picks, with the supply-chain audit if a dep is
  added (RESEARCH Package Legitimacy Audit).
- **D-10:** **Approve/reject only** in 135 — no edit-before-approve (deferred to the Phase 137
  sketch as a candidate). Rejection path = re-draft, or edit the skill manually via the normal
  edit path (which already versions via the 132 trigger). The proposal card shows the proposer's
  rationale + which evidence drove the edit (honest "why this change").

### Re-eval scope & gate rule
- **D-11:** The auto re-eval runs on the **same provider/model as the source eval run** —
  apples-to-apples measurement of the edit; single-provider-per-run holds (133 D-01). SC#10 is
  satisfied because any provider can be the source; UAT proves the loop per provider.
- **D-12:** The re-eval is a **full both-arms run reusing the 133 runner verbatim** — no
  single-arm fork (red line). It lands as a first-class `eval_runs` row, linked from the
  proposal via FK, that Phase 136's publish gate can consume directly.
- **D-13:** **Promotion pass rule = no regression + improvement, case-matched** against the
  source run (join on `test_case_id`, with-skill arm): every previously-passing measured case
  still passes AND ≥1 previously-failing measured case now passes. `not_measured` cases are
  excluded from the comparison honestly (never counted as pass OR fail). Honest counts always
  displayed alongside the verdict. Phase 136 owns the separate PUBLISH threshold (the 134 D-07
  rollup stays stored per-run untouched).

### Resilience + bug routing (mandatory reported-bugs cross-check)
- **D-14:** **BUG-260702-02** (in-flight runs orphaned on backend restart — major) **deferred to
  SEED-100** (full run-reconciliation). 135's obligation: an orphaned/interrupted re-eval MUST
  surface an honest **"interrupted — not promoted"** proposal state with a way to re-run the
  re-eval — never a proposal stuck "re-evaling…" forever. The `interrupted` lifecycle state in
  D-07 exists for exactly this.

### Locked constraints (restated for downstream — not gray areas)
- **D-15:** **SC#10 applies** (agent-loop consumption + provider routing + UI state). VALIDATION.md
  MUST carry the 4-axis rows (cross-provider representative-4 × multi-tool × parallel-thread ×
  long-message), authored in VALIDATION.md, NOT PLAN tasks — including the proposer + re-eval
  exercised on ≥2 providers and an honest interrupted/`not_measured` row. G-4 lived-experience
  scenarios on the proposal card (user-visible UI).
- **D-16:** **Net-new only / red line (D-14 project-wide).** Extend `backend/app/api/evals.py` (or
  a small sibling router — `skill_tuner.py` precedent), `backend/app/services/eval_runner_service.py`
  (consume, don't fork), `backend/app/models/eval_run.py`, `frontend/src/components/skills/SkillEvalSection.tsx`.
  Consume `agent_loop.py` / provider gateway / judge substrate READ-ONLY. Never grow `threads.py`.
  Deep Mode stays byte-identical.
- **D-17:** **Migration discipline.** Migration `083_*` applied via Supabase SQL editor or
  psycopg2 :54322 (never `db push`/`db reset`), then `bash scripts/regenerate-full-schema.sh`
  (no `--reset`), commit migration + regenerated `full-schema.sql` together.

### Claude's Discretion
- Exact proposals table/column/status-enum names; whether proposal routes live on the existing
  evals router or a small new router file.
- The proposer prompt shape + forced-emission schema — mirror the tuner/judge anti-injection
  discipline (skill instructions, eval outputs, and ratings woven as clearly-delimited DATA,
  never instructions to the proposer).
- Diff util choice (micro-dep vs in-repo LCS) per D-09.
- Concurrent-proposal policy (suggested: one OPEN proposal per skill at a time — a new draft
  supersedes or is blocked while one is `re_evaling`).
- SSE event vocabulary for proposal/re-eval progress — additive `eval_*`-style events; the
  re-eval should reuse the existing eval live readout + heartbeat machinery (d0c0c10a) unchanged.
- Promotion write mechanics: applying instructions to the live `skills` row fires the 132
  version trigger and creates a near-duplicate version row — planner decides the guard
  (accept the duplicate vs a trigger-safe marker), WITHOUT breaking 132's zero-app-code trigger.
- Whether the source-run comparison for D-13 handles a changed case set (cases added/deleted
  since the source run) by comparing only the intersection — recommended.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap
- `.planning/ROADMAP.md` — Phase 135 entry (goal, 4 success criteria, depends 132/133/134)
- `.planning/REQUIREMENTS.md` — SI-01 + the out-of-scope list (never auto-apply; no new eval runtime; no Skills-tab redesign)

### Prior-phase contracts (the substrate 135 composes)
- `.planning/phases/132-skill-versioning-eval-test-case-persistence/132-CONTEXT.md` — skill_versions trigger, `source` enum (`self_improve` reserved), append-only rules, RLS model
- `.planning/phases/133-eval-runner-with-skill-vs-without-skill/133-CONTEXT.md` — runner arms (target-only WITH / empty WITHOUT), single-provider runs, run lifecycle, SSE vocabulary
- `.planning/phases/134-eval-results-honest-verdict-ratings/134-CONTEXT.md` — judge verdict columns, `not_measured` honesty (D-04), ratings + disagreement cue (D-09), rollup (D-07)
- `.planning/phases/134-eval-results-honest-verdict-ratings/134-HUMAN-UAT.md` — U9: the live human–judge disagreement row (the SI-01 reference fixture); U8: honest `not_measured` under the real prefill 400

### Bug routing + hardening seeds
- `.planning/reported-bugs/BUG-260702-02-in-flight-runs-orphaned-on-backend-restart-no-reconciliation.md` — deferred to SEED-100; 135 owes the honest `interrupted` state (D-14)
- `.planning/seeds/SEED-100-skill-eval-production-clean-cross-provider-and-clarity.md` — the production-hardening phase that owns reconciliation + full-roster cross-provider + judge-model Settings knob

### Schema
- `supabase/migrations/079_skill_versions_and_test_cases.sql` (or the 079 pair as named) — version/test-case substrate
- `supabase/migrations/080_eval_runs_results.sql` — eval_runs/eval_results shape (as named in repo)
- `supabase/migrations/081_eval_verdict_and_ratings.sql` — verdict columns + eval_ratings
- `supabase/migrations/082_*.sql` — threads.is_eval (latest applied; next migration = 083)

### Code seams (read-only consumption vs extension points)
- `backend/app/services/skill_tuner_service.py` — `resolve_skill_builder_model` (:82), forced-emission helpers (`_emit_tool`, `_flatten_nullable`), tuner_runs signal shape, drive-without-fork precedent
- `backend/app/services/eval_runner_service.py` — `run_eval_job`, version-snapshot WITH arm, judge integration, heartbeat/seed events (extend, don't fork)
- `backend/app/api/evals.py` — owner-verify + 404 pattern, ratings PUT, readout routes (extension point)
- `backend/app/models/eval_run.py` — Pydantic shapes to extend
- `backend/app/services/harness/validator_kinds.py` — `resolve_judge_model` + schema-bound `JudgeVerdict` (read-only)
- `frontend/src/components/skills/SkillEvalSection.tsx` — the thin surface the proposal card extends
- `frontend/src/lib/api.ts` — eval SSE demux branch (additive-else-if pattern, :851-857)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **133 eval runner** (`eval_runner_service.run_eval_job`): already evals a pinned skill version
  both-arms with live SSE + persistence — the auto re-eval is "launch this with the draft
  version id", not new machinery.
- **Tuner authoring stack** (`skill_tuner_service.py`): model resolver, forced-emission tool
  helpers, owner-scoped sibling fetch — the proposer is structurally a sibling of
  `build_candidates`.
- **Judge substrate** (`validator_kinds.py` + 134's eval judge wrapper): verdicts for the
  re-eval come for free from the 134 grading path.
- **skill_versions trigger + `source` enum**: `self_improve` value already in the CHECK
  constraint — approval writes the version row directly (service-role INSERT is allowed;
  UPDATE-block only).
- **eval_ratings + verdict columns (081)**: the disagreement query (judge-pass × human-down)
  is a join away; U9 seeded a real row.
- **Eval SSE liveness fixes (d0c0c10a)**: seeded start event + 15s heartbeat + client re-attach —
  the re-eval readout inherits this for free by reusing the eval run surface.

### Established Patterns
- Service-role writes + app-code `.eq("user_id")` owner gate + owner-only RLS defense-in-depth;
  cross-user = 404 never 403 (132/133/134 threat-model precedent).
- Net-new router per feature (`skill_tuner.py`, `evals.py`) — never grow `threads.py` (G-5).
- Additive SSE event types on the shared vocabulary; frontend demux branches are additive
  `else if` with no `return`.
- Thin `--skip-ui` functional surfaces with the 137 design fence.
- Forced-emission schema-bound LLM outputs (no narratable/regexable verdicts or proposals).

### Integration Points
- SkillEvalSection eval readout → "Propose improvement" button + proposal card.
- Proposals table → FKs into skills / skill_versions / eval_runs.
- Approval handler → INSERT skill_versions (source='self_improve') → launch re-eval via the
  existing runner → gate check → promotion write to `skills`.

</code_context>

<specifics>
## Specific Ideas

- The **U9 disagreement row** (judge-PASS + human-DOWN, captured live during 134 UAT) is the
  concrete fixture the proposer's evidence query must return — it was explicitly parked for
  this phase.
- "Tuner signal" concretely = the Trigger Tuner's `tuner_runs` output (fire/hold classifications
  + axis scores), used as context so the proposer doesn't try to fix triggering problems with
  instruction edits.
- The whole loop should read as: results → propose → review diff → approve → re-eval →
  promoted/not-promoted, all in one place on the skill's eval surface.

</specifics>

<deferred>
## Deferred Ideas

- **Edit-before-approve** (editable proposal diff) → Phase 137 sketch candidate (D-10).
- **Multi-candidate proposals** (2–3 drafts, user picks) → future; revisit at 137 or SI-02 (139).
- **Post-run nudge** ("2 failed cases — propose an improvement?") → 137 candidate affordance.
- **Full-roster re-eval fan-out** (all native providers per approval) → SEED-100.
- **Run reconciliation on backend restart** (BUG-260702-02) → SEED-100; 135 only owes the honest
  `interrupted — not promoted` state (D-14).

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring`** (todo.match-phase score 0.6) — NOT folded. Keyword-only
  match; unrelated to the self-improvement loop and already satisfied (NL authoring shipped in
  Phase 103) — same disposition as recorded at Phase 134.

</deferred>

---

*Phase: 135-self-improvement-loop-si-01*
*Context gathered: 2026-07-02*
