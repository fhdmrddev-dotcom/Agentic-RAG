# Phase 137: Skill Evals Panel UI (PANEL-01) - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

The Skills UI gains the designed, consolidated eval experience — what the operator-locked
sketches (053–057) define as the **Skill Studio**: a focused full-surface (the 041-A
Tuner-style `ActiveView` switch) with **Evals · Triggering · Versions** tabs under a
persistent header, absorbing the shipped Trigger Tuner as the Triggering tab (a re-homing,
NOT a rebuild), while the skill detail panel slims down to form + status + "Open studio".
The Studio consolidates: test-case editor, eval run history + per-run detail (side-by-side
+ pass/fail), inline ratings, diff-viewable version history, the 136 publish-gate status
(as the 054-B lifecycle stepper), and the 135 proposal card.

**The G-2 acceptance bar is the operator-approved sketch set** (ROADMAP SC#4: "the panel
matches the operator-approved sketch"). The rest of the Skills tab is otherwise unchanged
— additive, no full Skills-tab redesign — except the deliberate detail-panel slim-down
that IS part of the approved sketch (the "messy UI" cure; the U11 panel-density finding
from 135 UAT routed here as design input).

Out of scope (declared in the sketches / this discussion): chat → Studio links (a skill
firing in chat), backend run-reconciliation (SEED-100), the consumer-facing "unverified"
chip (deferred, see below), edit-before-approve and multi-candidate proposals (Phase 139
territory).

</domain>

<decisions>
## Implementation Decisions

### Locked design contracts (sketches 053–057 — operator-approved 2026-07-03, commit `be4a7016`)
These are restated for downstream; the sketch READMEs + MANIFEST rows #44–47 are the
authoritative wording. **The 057 MAP (every button → destination) is the build contract.**

- **D-01 Shell (053-A + 057-A):** ONE focused full-surface Studio. Net-new `skill-studio`
  `ActiveView` value **with a tab param**; the old `skill-tuner` value **redirects** (no
  orphan Tuner surface). `‹ Skills` returns preserving the selected skill + panel state
  (041-A contract). Landing tab = **Evals**. Persistent header on every tab: skill name +
  vN + LIVE badge + a compact one-line gate strip.
- **D-02 Tuner absorption:** the shipped Trigger Tuner mounts **unmodified** inside the
  Triggering tab — `SkillTunerPage` internals untouched (041/042/043/045 winners intact).
- **D-03 Status = the 054-B lifecycle stepper** (Cases → Eval → Gate → Published): counts
  live ON their stage nodes; ONLY the current stage narrates itself in one message box;
  `passed_on_older_version` reads as "the passing eval is stale — it measured vN-1, the
  live skill is vN"; the ⚡ collision (gate met on an earlier passing run + newest run
  failed) renders as a met Gate node WITH the Eval node carrying the newest run's honest
  count; the Publish button mirrors the server gate (one source of truth); the
  force-publish override record ALWAYS renders (amber receipt, never softens). The header
  gate strip is a CONDENSATION of the same server `PublishGate` — never a second
  truth-teller.
- **D-04 Run history = 055-B expandable rows:** provider logo (048 `@lobehub/icons` map) +
  model + version binding + honest rollup per row; rows expand IN PLACE to per-case detail
  — side-by-side WITH/WITHOUT arms, judge verdict chip + score + reason, token counts,
  "your rating" thumbs labeled DISTINCT from the judge's verdict (two truths, never
  blended). Honest state set is load-bearing: `not_measured` = excluded-never-failed
  (rollup appends "· N not measured" when measured < case_count); `judge_error` = neither
  pass nor fail; interrupted run = banner + re-run affordance (never a silent failure);
  running run = live per-arm progress with NO mid-run verdicts (verdicts land at finalize).
- **D-05 Versions tab = 056-B table + compare picker:** scan-first table (version · origin
  chip · eval-on-this-version binding · date, LIVE badged) + explicit any-to-any Compare
  v[x] ↔ v[y] rendering ONE unified diff (**reuse the 135 `lineDiff` util**). Provenance
  chips derive from `SkillVersion.source` (verify real enum values at plan time). The
  force-promoted version's failed `PromotionGate` evidence stays visible un-softened; the
  promoted version carries its gate counts (the 135 proposal's terminal home). **"Restore"
  is deliberately ABSENT** (versions immutable, VER-01).
- **D-06 Nav contract (the 057 MAP):** the 044-A lint "Tune this →" RE-POINTS to
  Studio·Triggering (today it opens the standalone Tuner page); the 136 `PublishGateDialog`
  gains ONE net-new "Review evals →" link on the unmet branch → Studio·Evals (closes "gate
  only discoverable in the dialog"); tabs are deep-linkable (panel gate/status → Evals,
  lint → Triggering, version row → Versions).
- **D-07 Detail-panel slim-down:** `SkillEvalSection` + `SkillTestCasesSection` LEAVE the
  edit dialog; the panel keeps the edit form + a status section + "Open studio" + counts.

### Proposal-loop home (discussed 2026-07-03)
- **D-08:** The active 135 propose→review→approve card lives in the **Evals tab, below the
  run history, lightly re-skinned** — flow untouched (propose → diff → approve/reject →
  auto re-eval → promote/not-promote), chrome aligned to the Studio design (same chips /
  tokens / honesty language as the 055 run rows). All 135 honesty locks preserved:
  proposer rationale + evidence, `PromotionGate` counts, `override_forced` record,
  honest `interrupted — not promoted` state. Proposal STATE also composes into the 054-B
  status read (sketch 054's design question included it) — never a second truth-teller.
- **D-09 (folded):** **Post-run nudge** — when a finished run has ≥1 failed measured case,
  an inline "Propose an improvement?" affordance (on the run row / stepper current-stage
  message) jumps to the existing propose action. Behavior-minimal pointer to machinery
  that already exists (135 D-01 deferred this exact affordance to 137).

### Slim panel status composition (resolves the #44/#45 MANIFEST seam)
- **D-10:** The slimmed 384px detail panel's status section renders the **FULL 054-B
  lifecycle stepper** (054 proved it fits 384px) — it dissolves the "Publish ready 1/1 vs
  0/2 cases" contradiction in the place the operator first hit it. The one-line gate strip
  belongs to the Studio header only. Build the stepper as ONE shared component consumed by
  both surfaces (one truth-teller, two homes).

### Case editor + run launch
- **D-11:** Cases are **prompt-first, no schema change**: every case row (editor, run
  detail, stepper counts) leads with its prompt text (truncated one-line),
  `expected_behavior` as the quiet second line; the uuid disappears from the UI
  (detail/debug only). Closes the BUG-260701-02 deferred half ("opaque `Case <uuid8>`").
  NO new label column, NO migration.
- **D-12:** Run launch = a **compact run bar directly above the run-history list** in the
  Evals tab (provider/model picker + Run); the live run appears as the top expandable row
  (055-B running state). Stepper stage messages ("run an eval on the current version")
  deep-link/scroll to this bar. Picker selection stays preserved across skills (existing
  behavior).

### "Unverified" chip on global skills
- **D-13 (deferred):** The consumer-facing marker for skills published via force-override
  (136 D-02's deferred candidate) does NOT fold into 137 — unsketched consumer-facing
  surface, no real audience yet (effectively single-operator today). Re-open trigger:
  first real multi-user global-skill consumption, or when SEED-099 (role-gate /
  who-sees-evals) is scoped. The owner-visible override record ships in the stepper
  (D-03) regardless.

### Locked constraints (restated for downstream — not gray areas)
- **D-14 SC#10 applies** (UI state surfacing per-provider results + live run). The 4-axis
  UAT rows (cross-provider representative-4 × multi-tool × parallel-thread × long-message)
  are authored in **VALIDATION.md, NOT PLAN tasks**. G-4 lived-experience scenarios on the
  user-visible Studio (full state-matrix sweep: tab switches, panel collapse, mid-run
  navigation away/back, an interrupted run, both a gate-met and gate-unmet skill).
- **D-15 Additive / red line (D-14 project-wide):** frontend-heavy phase. Backend surface
  is read-only consumption of existing endpoints (`GET /skills/{id}/publish-gate`, eval
  runs/readout routes, versions, proposals, ratings PUT); the ONE candidate net-new read
  is the version-list eval-binding join (056 handover: one query or client-side join —
  planner picks). NO migration expected (D-11 avoided the schema change). NO
  `threads.py` / `agent_loop.py` / provider-gateway touch; Deep Mode byte-identical.
  Eval SSE / heartbeat / re-attach machinery (d0c0c10a) reused unchanged.
- **D-16 G-5 audit (mandatory at discuss):** none of 137's files are on the hot-file
  ledger (`SkillEvalSection`, `SkillTunerPage`, `SkillFormDialog`, `SkillCard`,
  `PublishGateDialog`, `App.tsx` nav are not ledger rows; `threads.py` /
  `anthropic_service.py` untouched). No G-5 fire.

### Claude's Discretion
- Deep-link/tab-param mechanics — the app has no router; how `skill-studio` + tab + skill
  id thread through `ActiveView`/App state (the `skill-tuner` mount branch at `App.tsx` is
  the precedent), and how the old `skill-tuner` value redirects.
- Evals-tab composition detail at Studio width (stepper top per #45; cases/run-bar/history/
  proposal ordering per 053-A's two-column intent, adjusted for Versions being its own tab).
- The version-list eval-binding read (one query vs client-side join over existing
  endpoints) + verifying the real `SkillVersion.source` enum values.
- Exact re-skin treatment of the proposal card (bounded by D-08).
- Live-run behavior on navigate-away/return: reuse existing `subscribeToRun` re-attach +
  durable re-fetch; whether the stepper's Eval node shows a "running" state mid-run.
- Component decomposition + which existing SkillEvalSection/SkillTestCasesSection handlers
  are lifted vs re-written ("lift state, re-skin render" per the 053 handover).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The G-2 acceptance bar (the design contract)
- `.planning/sketches/MANIFEST.md` — Running Design Decisions **#44, #45, #46, #47** (+
  #32/#33/#34/#35 Tuner winners that must survive absorption; #38 provider-logo map; #43
  PHASE_GLYPHS/icon convention)
- `.planning/sketches/053-eval-studio-shell/README.md` — shell winner A + Build Handover
- `.planning/sketches/054-one-truth-status/README.md` — stepper winner B + the four gate
  states + ⚡ collision acceptance test + honesty locks
- `.planning/sketches/055-run-history-and-detail/README.md` — expandable rows winner B +
  the five honest run states + honesty locks
- `.planning/sketches/056-version-history-and-diff/README.md` — table+compare winner B +
  provenance chips + no-restore lock
- `.planning/sketches/057-skill-studio-linkage/README.md` + its `index.html` **MAP tab** —
  the complete every-button→destination navigation contract (THE build reference)
- `./.claude/skills/sketch-findings-agentic-rag/SKILL.md` — validated design patterns /
  CSS / theme precedents for all Skills surfaces

### Requirement / scope contract
- `.planning/REQUIREMENTS.md` — **PANEL-01** + the "no full Skills-tab redesign" exclusion
- `.planning/ROADMAP.md` — Phase 137 entry (goal + 4 success criteria; SC#4 = sketch match)

### Prior-phase contracts (what the Studio consolidates)
- `.planning/phases/136-skill-publish-gate-gate-01/136-CONTEXT.md` — gate semantics
  (D-03/D-04 current-version binding), `GET /skills/{id}/publish-gate` payload, override
  record (D-01/D-02), PublishGateDialog seam
- `.planning/phases/135-self-improvement-loop-si-01/135-CONTEXT.md` — proposal lifecycle
  (D-05..D-10), `lineDiff`, honest `interrupted — not promoted` (D-14), re-eval as
  first-class eval_runs rows
- `.planning/phases/134-eval-results-honest-verdict-ratings/134-CONTEXT.md` — verdict
  columns + `not_measured` honesty (D-04), ratings model (D-08/D-09), rollup framing (D-07)
- `.planning/phases/133-eval-runner-with-skill-vs-without-skill/133-CONTEXT.md` — runner
  arms, single-provider runs, `eval_*` SSE vocabulary, run lifecycle
- `.planning/phases/132-skill-versioning-eval-test-case-persistence/132-CONTEXT.md` —
  skill_versions trigger + `source` enum, test-case substrate

### Bug routing (mandatory cross-check outcomes)
- `.planning/reported-bugs/BUG-260701-02-skill-eval-panel-stale-results-across-skills.md`
  — the deferred clarity half (`Case <uuid8>` labels) closes via D-11
- `.planning/reported-bugs/BUG-260702-02-in-flight-runs-orphaned-on-backend-restart-no-reconciliation.md`
  — NOT folded (reconciliation = SEED-100); 137 renders the honest interrupted display
  per D-04
- `.planning/seeds/SEED-100-skill-eval-production-clean-cross-provider-and-clarity.md` —
  the adjacent hardening home (137 delivers the "clarity" half's designed surface)

### Code seams (what 137 modifies vs reads)
- `frontend/src/App.tsx` — `ActiveView` union (:9) + the `skill-tuner` mount branch (the
  redirect + `skill-studio` precedent)
- `frontend/src/pages/SkillTunerPage.tsx` + `frontend/src/components/skills/tuner/*` —
  mount unmodified inside the Triggering tab
- `frontend/src/components/skills/SkillEvalSection.tsx` — run/SSE handlers + proposal card
  + gate-status line to lift/re-home
- `frontend/src/components/skills/SkillTestCasesSection.tsx` — case CRUD handlers to reuse
- `frontend/src/components/skills/SkillFormDialog.tsx` — the edit dialog the sections
  leave (:548 mount site)
- `frontend/src/components/skills/SkillCard.tsx` + `PublishGateDialog.tsx` — the unmet
  branch gains "Review evals →"
- `frontend/src/pages/SkillsPage.tsx` — "Open studio" entry + panel state preservation
- `frontend/src/lib/api.ts` + `frontend/src/lib/nav-items.ts` — eval/gate/version/proposal
  clients; nav stays unchanged (Studio is not a nav item)
- `backend/app/api/evals.py` / `backend/app/api/skills.py` — read-only consumption
  (extend only if the D-15 version-binding join needs a server-side read)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Every field is already served** (sketch handovers verified): `GET /skills/{id}/publish-gate`
  (met, state, passed/measured, passing_run_id, reason, last_override); EvalRunReadout
  (rollup counts, verdict_state/passed/score/reason, judge_model, tokens, rating);
  `GET /skills/{id}/versions` (source + version_number); SkillProposal (+ PromotionGate,
  override_forced); the thumbs PUT (IDOR-404 hardened). The stepper's "newest run vs gate
  run" reconciler is pure client-side labeling — **no new wire** for the status surface.
- **`SkillTunerPage` ActiveView pattern** — the shipped full-surface switch 137's Studio
  rides (no router needed).
- **Eval SSE + heartbeat + re-attach** (d0c0c10a) — the live run readout machinery, reused
  unchanged.
- **135 `lineDiff` util** — the version compare diff.
- **048 provider-logo map** (`@lobehub/icons`, installed) — run-row avatars.
- **`SkillTestCasesSection` CRUD + `SkillEvalSection` run/SSE/proposal handlers** — lift
  state, re-skin render (053 handover).

### Established Patterns
- One truth-teller: every status surface condenses the SAME server `PublishGate` — never
  recompute client-side variants (054 lock).
- Honest states over fabricated ones: `not_measured` excluded, `judge_error` neither,
  interrupted never silent, no mid-run verdicts (134/135 lessons).
- Focused full-surface for width-hungry skill work (041-A precedent); `‹ Back` preserves
  origin state.
- Owner-scoped reads, 404-never-403 on newer eval routes.

### Integration Points
- `App.tsx` `ActiveView` — add `skill-studio` (+ tab/skill params), redirect `skill-tuner`.
- `SkillFormDialog` / detail panel — sections move OUT; stepper + "Open studio" move IN.
- `PublishGateDialog` unmet branch — one new link.
- Lint "Tune this →" — retarget to Studio·Triggering.

</code_context>

<specifics>
## Specific Ideas

- **The stepper's acceptance test is the literal 136-UAT contradiction**: "Publish ready —
  eval passed 1/1" next to "0/2 with-skill cases passed" must read as two labeled,
  version-bound facts (054's ⚡ collision state), never a flat contradiction.
- **U11 (135 UAT panel-density finding)** is the "messy UI" driver — the slimmed panel at
  rest must be calm enough to close that complaint on its own (053 "What to Look For").
- The sketch `index.html` mockups are the visual bar; the 057 MAP tab is the button-level
  contract — build against them, not from memory.

</specifics>

<deferred>
## Deferred Ideas

- **Consumer-facing "unverified" chip on global SkillCards** (D-13) — re-open trigger:
  first real multi-user global-skill consumption, or SEED-099 (role-gate) scoping.
- **Edit-before-approve** (editable proposal diff) — Phase 139 / SI-02 territory (135
  D-10 deferral stands; unsketched behavior change).
- **Multi-candidate proposals** — Phase 139 / SI-02 (135 deferral stands).
- **Optional case name/label column** (migration) — only if lived usage of prompt-first
  labels proves insufficient for large benchmarks.
- **Chat → Studio links** (a skill firing in chat linking to its Studio) — declared OUT
  by the 057 contract; future chat-surface phase.
- **Backend run-reconciliation on restart** (BUG-260702-02) — SEED-100; 137 only renders
  the honest interrupted display + re-run affordance.

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring`** (todo.match-phase score 0.6) — NOT folded. Keyword-only
  match; unrelated to the Skill Studio and already satisfied (NL authoring shipped in
  Phase 103). Same disposition as recorded at Phases 134, 135, and 136.

</deferred>

---

*Phase: 137-skill-evals-panel-ui-panel-01*
*Context gathered: 2026-07-03*
