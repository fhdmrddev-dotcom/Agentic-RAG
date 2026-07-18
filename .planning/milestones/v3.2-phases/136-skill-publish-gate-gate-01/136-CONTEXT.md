# Phase 136: Skill Publish Gate (GATE-01) - Context

**Gathered:** 2026-07-03
**Status:** Ready for planning

<domain>
## Phase Boundary

A skill can only be published (made global / shareable) after at least one eval has run and
passed **on the skill's current instructions**; the publish flow surfaces this gate with a
clear status and blocks — with an explicit, recorded, evidence-shown override — when unmet.
Future publish actions only: skills that are already global stay global untouched (SC#3);
the gate fires on every future toggle-to-global action, including re-share after unshare.

"Publish" concretely = flipping `skills.is_global` to true. Today that happens through
`PATCH /skills/{id}/toggle-global` (`backend/app/api/skills.py:406`, the "Share globally"
menu item on `SkillCard.tsx`) and, as an ungated side door, through `POST /skills` trusting
`body.is_global` — this phase closes that side door.

**Scope fence:** thin functional UI only (confirm dialog + a small status line in the
existing `SkillEvalSection`). The designed Skill Evals panel is Phase 137 (PANEL-01, G-2
sketch-gated) — 136 must not pre-empt or constrain that design (the 133 D-07 / 134 D-10 /
135 D-08 fence). **G-2 does NOT fire on 136** — same reasoning as recorded for 134
("UI hint" but deliberately undesigned; 137 owns the design).

</domain>

<decisions>
## Implementation Decisions

### Gate strictness — block + recorded override
- **D-01:** **Block by default, explicit override allowed.** Publishing with the gate unmet
  is blocked; the owner may explicitly force-publish, with the unmet-gate evidence rendered
  at the moment of override, and the override recorded (what the gate state was + when).
  Exactly mirrors 135 D-06's force-promote pattern (`override_forced=true` recorded) — which
  itself cited GATE-01's "blocks or warns with evidence" language. Never warn-only, never
  silent.
- **D-02:** **Override visibility = owner only.** The override record is queryable and the
  owner sees an honest "published without passing eval" status on the skill's eval surface
  (SkillEvalSection). No consumer-facing marker in 136 — an "unverified" chip on global
  SkillCards is DEFERRED to the Phase 137 sketch as a design candidate.

### What "passed" means — the authoritative threshold (owed by 134 D-07)
- **D-03:** **Gate-satisfying run = ≥1 measured case AND every measured with-skill case
  passed** (`measured_count >= 1 AND passed_count == measured_count`). This adopts the
  non-authoritative default rollup from migration 081 (`verdict_summary`) as the
  authoritative publish rule — the eval readout and the gate can never disagree.
  `not_measured` cases stay honestly excluded (never count for or against — 134 D-04).
  Interrupted / non-completed runs never satisfy the gate. No percentage knob, no setting —
  add configurability only if lived usage demands it.
- **D-04:** **Current version only.** The passing run must be tied to the skill's CURRENT
  instructions: every instruction edit already snapshots an immutable version (132 trigger)
  and every eval run pins `eval_runs.skill_version_id`, so "edit after a pass" honestly
  resets the gate to unmet until a re-eval passes. 135's approve→auto-re-eval flow makes
  re-satisfying cheap; its re-eval runs are first-class `eval_runs` rows the gate consumes
  directly (135 D-12).
  - **Planner nuance:** 135's promotion applies the evaled draft's instructions to the live
    `skills` row, which fires the 132 version trigger and creates a near-duplicate version
    row. The gate check MUST treat that promoted state as "current version passed" —
    compare by instruction-content equality or by the promotion linkage, NOT by naive
    latest-version-id equality against the run's `skill_version_id`.

### Publish-flow UX (thin, 137-fenced)
- **D-05:** **Confirm dialog always** on "Share globally": gate met → satisfied status
  ("Eval passed X/N on current version") + Publish button; gate unmet → honest status
  (never evaled / latest run failed / passed on an older version) + a pointer to run an
  eval on the skill's eval section + the explicit force-publish affordance (evidence shown
  at that moment, per D-01). One home for status + evidence + override — the 135
  proposal-card idiom. Satisfies SC#2's "the publish flow shows the gate satisfied".
- **D-06:** **A small gate-status line also lives in `SkillEvalSection`** — publish
  readiness at a glance plus the owner-visible override record (D-02). Keep both surfaces
  plain/undesigned (no new design-system chrome) — Phase 137 owns the designed experience.

### Gate coverage — every road to is_global=true
- **D-07:** **Server-side enforcement is the gate.** The toggle endpoint refuses the
  private→global flip when the gate is unmet unless the request explicitly carries the
  override (structured error response carrying the gate status so the client dialog can
  render evidence). The client dialog is UX, not the gate. Global→private (unshare) is
  never gated.
- **D-08:** **Close the born-global side door:** `POST /skills` hard-sets
  `is_global=false` server-side, ignoring any client-supplied value (classification-rules
  precedent T-118-02-01 — never trust the body for share flags). The gated toggle becomes
  the ONLY path to global. The frontend never sends `is_global: true` on create, so nothing
  legitimate breaks. Import (`is_global=False` hardcoded) and the agent's `save_skill`
  tool (never touches `is_global`) are already safe — verify with tests, don't change.
- **D-09:** **Gate every share action.** Unshare→re-share runs the same gate check as a
  first publish — "publish" means the toggle-to-global action, every time. Already-global
  skills are untouched until the owner unshares (this is what satisfies SC#3
  future-publish-only). No was-ever-published grandfathering state.

### Locked constraints (restated for downstream — not gray areas)
- **D-10:** **Net-new / additive only; red line (project D-14).** The gate logic reads
  `eval_runs` / `skill_versions` / `skills` and modifies only the skills router
  (`backend/app/api/skills.py` toggle + create) + thin frontend (SkillCard dialog,
  SkillEvalSection status line, `api.ts`). NO agent-loop / provider-gateway / `threads.py`
  touch. Deep Mode byte-identical. Phase 136 is NOT SC#10-flagged in the v3.2 roadmap
  (no streaming/provider surface) — standard G-4 lived UAT on the user-visible dialog
  applies instead.
- **D-11:** **Migration discipline** (if a migration is needed for the override record —
  e.g. columns on `skills` or a small publish-audit table; next in sequence = 084): apply
  via Supabase SQL editor or psycopg2 :54322 (never `db push`/`db reset`), then
  `bash scripts/regenerate-full-schema.sh` (no `--reset`), commit migration + regenerated
  `full-schema.sql` together.

### Claude's Discretion
- Where the override record lives: columns on `skills` (e.g. `published_with_override_at`
  + gate-state snapshot) vs a small audit row — planner picks the smallest honest shape,
  consistent with the append-only/service-role precedents.
- Exact structured-error shape from the gated toggle (e.g. 409 + gate payload) and the
  dialog copy; the gate-status compute (inline query vs small service helper) and whether
  it's exposed as a tiny `GET` (gate-status) endpoint for the dialog.
- How "current version" equality is implemented (content hash vs promotion linkage vs
  latest-version resolution) per the D-04 planner nuance.
- Dialog component reuse (existing confirm-dialog primitives in the design system) — keep
  it plain per the 137 fence.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirement / scope contract
- `.planning/REQUIREMENTS.md` — **GATE-01** ("blocks (or warns with evidence)") + the
  out-of-scope exclusions (no retroactive gating of published skills; no Skills-tab redesign)
- `.planning/ROADMAP.md` — Phase 136 entry (goal + 3 success criteria, depends on 134;
  "UI hint: publish-flow gate; future-publish-only")

### Prior-phase contracts (what the gate consumes)
- `.planning/phases/134-eval-results-honest-verdict-ratings/134-CONTEXT.md` — **D-07: the
  publish threshold was explicitly deferred to THIS phase**; D-04 `not_measured` honesty;
  D-02 with-skill-only rollup denominator
- `.planning/phases/135-self-improvement-loop-si-01/135-CONTEXT.md` — D-06 force-promote
  override-with-evidence pattern (the idiom D-01 mirrors); D-12 re-eval runs land as
  first-class `eval_runs` rows the gate consumes; D-13 promotion vs publish threshold split
- `.planning/phases/132-skill-versioning-eval-test-case-persistence/132-CONTEXT.md` —
  version-snapshot trigger semantics (every instruction edit creates an immutable version;
  basis of D-04 current-version binding)

### Schema (the gate's inputs; next migration = 084)
- `supabase/migrations/080_eval_runs_and_results.sql` — `eval_runs.skill_id` +
  `skill_version_id` FKs (traceability the gate joins on) + per-run `status`
- `supabase/migrations/081_eval_verdict_and_ratings.sql` — `passed_count` /
  `measured_count` / `verdict_summary`; the comment stating the default rollup is
  NON-AUTHORITATIVE and "Phase 136 owns the real threshold" (D-03 makes it authoritative)
- `supabase/migrations/079_skill_versions_and_test_cases.sql` — `skill_versions` shape
- `supabase/migrations/083_*.sql` — skill_proposals (135; promotion linkage relevant to
  the D-04 near-duplicate-version nuance)

### Code seams (what 136 modifies vs reads)
- `backend/app/api/skills.py` — `toggle_global` (:406, the endpoint the gate wraps),
  `create_skill` (:155/:181, the born-global side door D-08 closes), owner-only 403
  pattern
- `backend/app/models/skill.py` — `SkillCreate.is_global` (D-08 removes trust in it)
- `frontend/src/components/skills/SkillCard.tsx` — "Share globally"/"Unshare" menu item
  (:226) that opens the D-05 dialog
- `frontend/src/components/skills/SkillEvalSection.tsx` — the thin eval surface the D-06
  gate-status line extends (do not redesign — 137 fence)
- `backend/app/services/skill_version_service.py` (or wherever the 132 trigger's companion
  helpers live) + `backend/app/api/evals.py` — read-only consumption patterns for
  version/run lookups

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`eval_runs` rollup columns (081):** `passed_count`/`measured_count` are already
  populated at run finalize — the gate is a query + comparison, no new grading machinery.
- **`toggle_global` endpoint:** already owner-only with a clean 403; the gate check slots
  in before the UPDATE, on the private→global direction only.
- **135's force-promote idiom:** evidence-at-override + recorded override — reuse the
  interaction pattern (and its copy tone) for the publish dialog.
- **Classification-rules hard-set precedent** (`classification_rule_service.py:79`,
  T-118-02-01): the exact pattern for D-08's create-path hard-set.
- **SkillEvalSection readout:** already fetches runs/verdicts — the gate-status line and
  override record render from data it substantially already loads.

### Established Patterns
- Server is the gate; client dialogs are UX (D-07). Owner-scoping via app-code
  `.eq("user_id")` with service-role clients; cross-user = 404-never-403 on newer eval
  routes (skills router historically uses 403 — keep endpoint-local consistency).
- Honest states over fabricated ones: `not_measured` excluded, interrupted never green
  (134 D-04, 135 D-14).
- Thin `--skip-ui` functional surfaces with the 137 design fence (133/134/135 precedent).

### Integration Points
- `PATCH /skills/{id}/toggle-global` — gate check + override param + structured refusal.
- `POST /skills` — `is_global` hard-set false.
- `SkillCard.tsx` share action → confirm dialog (gate status both ways).
- `SkillEvalSection.tsx` → gate-status line + owner-visible override record.
- Possible migration 084 for the override record (planner decides shape).

</code_context>

<specifics>
## Specific Ideas

- The gate should read as the *same honesty language* the eval surface already speaks:
  "X/N measured cases passed on the current version" — never a bare green checkmark with
  no numbers.
- The unmet-gate dialog should tell the user exactly how to satisfy it (run an eval on the
  current version from the skill's eval section), not just refuse.
- migration 081's own comment ("Phase 136 owns the real threshold") is the contract this
  phase fulfills — D-03 intentionally matches the default rollup so nothing displayed
  anywhere has to change meaning.

</specifics>

<deferred>
## Deferred Ideas

- **Consumer-facing "unverified" badge** on global skills published via override → Phase
  137 sketch candidate (D-02).
- **Configurable pass threshold** (percentage / per-skill / Settings knob) → only if lived
  usage demands it; D-03 fixes all-measured-pass for now.
- **Stale-pass warning state** (gate satisfied by an older version's pass with a warning)
  → rejected in favor of hard current-version binding (D-04); revisit only if re-eval
  friction proves real.
- **Retroactive gating / sweep of already-published skills** → explicitly out of scope
  (SC#3); a future governance phase could surface "published, never evaled" skills in a
  health view (Phase 119 governance-health idiom).

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring`** (todo.match-phase score 0.6) — NOT folded. Keyword-only
  match; unrelated to the publish gate and already satisfied (NL authoring shipped in
  Phase 103). Same disposition as recorded at Phases 134 and 135.

</deferred>

---

*Phase: 136-skill-publish-gate-gate-01*
*Context gathered: 2026-07-03*
