# Phase 137: Skill Evals Panel UI (PANEL-01) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-03
**Phase:** 137-skill-evals-panel-ui-panel-01
**Areas discussed:** Proposal-loop home in the Studio, Slim detail panel composition, "Unverified" chip on global skills, Case editor + run launch

---

## Proposal-loop home in the Studio

### Q1 — Where does the active propose→review→approve card live, and what treatment?

| Option | Description | Selected |
|--------|-------------|----------|
| Evals tab, lightly re-skinned (Recommended) | Card moves below run history; flow untouched; chrome aligned to Studio design (055 chips/tokens/honesty language); no behavior change = no G-2 risk | ✓ |
| Evals tab, moved verbatim | Zero re-skin, lowest effort; thin card would clash with the designed surface | |
| You decide | Claude picks treatment bounded by flow-unchanged + honesty locks | |

**User's choice:** Evals tab, lightly re-skinned.

### Q2 — Which 135-deferred proposal-flow ideas fold into 137? (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Post-run nudge (Recommended) | Inline "Propose an improvement?" affordance when a finished run has ≥1 failed measured case — pointer to existing machinery | ✓ |
| Edit-before-approve | Editable proposal diff — real unsketched behavior change; safer in Phase 139 | |
| Multi-candidate proposals | 2-3 candidate edits, user picks — largest scope; 135 suggested SI-02 (139) | |
| None — defer all three | Keep 137 purely consolidation/design | |

**User's choice:** Post-run nudge folded; "defer the remaining" (edit-before-approve + multi-candidate → Phase 139).

---

## Slim detail panel composition

### Q1 — What renders as the status surface in the slimmed 384px panel?

| Option | Description | Selected |
|--------|-------------|----------|
| Full lifecycle stepper (Recommended) | 054-B Cases→Eval→Gate→Published stepper in the panel status section (matches MANIFEST #45; proven to fit 384px); Studio header keeps the one-line condensation | ✓ |
| One-line gate strip + counts | Slimmest panel; stepper exclusively in the Studio | |
| Compact pip stepper | 4 nodes as a pip row without the narration box | |

**User's choice:** Full lifecycle stepper. (Resolves the MANIFEST #44 "ONE gate line" vs #45 "stepper in the detail panel's status section" seam in favor of #45.)

---

## "Unverified" chip on global skills

### Q1 — Fold the consumer-facing chip into 137, or defer?

| Option | Description | Selected |
|--------|-------------|----------|
| Defer with trigger (Recommended) | Keep 137 on the sketch contract; park with re-open trigger: first real multi-user global-skill consumption or SEED-099 scoping | ✓ |
| Fold into 137 | Amber "published unverified" chip on global SkillCards now — small wire but unsketched consumer-facing surface in a G-2 phase | |
| You decide | Fold only if the wire is a trivial additive field | |

**User's choice:** Defer with trigger.

---

## Case editor + run launch

### Q1 — How do test cases identify themselves in the Studio?

| Option | Description | Selected |
|--------|-------------|----------|
| Prompt-first, no schema change (Recommended) | Rows lead with prompt text, expected_behavior second line, uuid vanishes from UI; zero migration; closes BUG-260701-02's deferred label complaint | ✓ |
| Optional case names (adds migration) | Nullable label column on skill_test_cases; falls back to prompt-first | |
| You decide | Default prompt-first; label column only if the design wants it | |

**User's choice:** Prompt-first, no schema change.

### Q2 — Where does the run launch live in the Evals tab?

| Option | Description | Selected |
|--------|-------------|----------|
| Run bar above history (Recommended) | Compact bar (provider/model picker + Run) directly above the run-history list; live run = top expandable row; stepper messages deep-link to it | ✓ |
| Launch from the stepper | Run CTA inside the Eval stage message box; hidden when gate green | |
| Persistent header action | Run in the Studio header on every tab; detached from results | |

**User's choice:** Run bar above history.

---

## Claude's Discretion

- Deep-link/tab-param mechanics through `ActiveView` (no router) + the `skill-tuner` redirect.
- Evals-tab composition detail at Studio width (stepper top; cases/run-bar/history/proposal ordering).
- Version-list eval-binding read (one query vs client-side join) + verifying real `SkillVersion.source` enum values.
- Proposal-card re-skin specifics (bounded by D-08).
- Live-run navigate-away/return behavior (reuse existing re-attach machinery); stepper Eval node mid-run state.
- Component decomposition / handler lift-vs-rewrite.

## Deferred Ideas

- Consumer-facing "unverified" chip → SEED-099 / first multi-user consumption trigger.
- Edit-before-approve + multi-candidate proposals → Phase 139 (SI-02).
- Optional case name/label column → only if prompt-first proves insufficient.
- Chat → Studio links → declared OUT by the 057 contract.
- Backend run-reconciliation (BUG-260702-02) → SEED-100 (137 renders the honest interrupted display only).
- Reviewed todo `spike-nl-workflow-authoring` — NOT folded (same disposition as Phases 134/135/136).
