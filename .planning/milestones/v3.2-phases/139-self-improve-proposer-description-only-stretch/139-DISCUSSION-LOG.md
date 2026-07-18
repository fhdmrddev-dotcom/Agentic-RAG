# Phase 139: Self-Improve Proposer — Description-Only (STRETCH) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-06
**Phase:** 139-self-improve-proposer-description-only-stretch
**Areas discussed:** Proposer engine, Promotion gate, Vs quick-apply, Home + storage, Sketch (G-2)

---

## Proposer engine

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse the Tuner (Recommended) | The "proposer" IS a Trigger Tuner run: generates + scores candidates across providers; its held-out winner becomes the proposed diff. No new LLM. Measured winner, honest-by-construction, cheapest. | ✓ |
| New proposer LLM (SI-01 twin) | A separate description-proposer service over Tuner-miss evidence, emitting one proposed description via forced-emission. More parallel to SI-01 but unmeasured until a re-run. | |
| Hybrid: Tuner scores, LLM refines | Tuner generates + scores; a proposer LLM picks/rewrites the winner into a polished proposal. Best-of-both narrative, most moving parts. | |

**User's choice:** Reuse the Tuner (Recommended)
**Notes:** Makes SI-02 "wrap the Tuner's held-out winner in the SI-01 propose→review→approve→version lifecycle." The Tuner is honest by construction — if the current description wins, there is nothing to propose.

---

## Promotion gate

| Option | Description | Selected |
|--------|-------------|----------|
| Scoreboard = pre-approval evidence (Recommended) | The per-provider held-out scoreboard (proposed vs current) is shown BEFORE approval; approve → write version. No post-approval re-run. Lighter than SI-01; the winner is already gated at draft time. | ✓ |
| Auto re-run Tuner gate (SI-01 parity) | After approval, auto-re-run the Tuner and require no-regression + improvement before it applies. Fully parallel to SI-01 but heavier (redundant re-measure + interrupted-run handling). | |

**User's choice:** Scoreboard = pre-approval evidence (Recommended)
**Notes:** Because the engine is the Tuner (a measured winner at draft time), a post-approval re-run would mostly re-measure the same thing. Keeps SI-02 genuinely lighter than SI-01; no re_evaling/interrupted states.

---

## Vs quick-apply

| Option | Description | Selected |
|--------|-------------|----------|
| Replace it with the proposal path (Recommended) | The Tuner's "apply winning description" button becomes "Propose this description" → reviewable diff + scoreboard → approve → version. One honest human-in-the-loop door; no one-click direct write. | ✓ |
| Keep both — add proposal alongside quick-apply | The one-click apply stays; SI-02 adds the reviewable-diff proposal as a second option. More flexible but two doors to the same live-skill write, one un-audited. | |

**User's choice:** Replace it with the proposal path (Recommended)
**Notes:** Matches the never-auto-apply red line; gives description changes the same audit row + attribution as SI-01, and removes today's inconsistency where Tuner applies land as `source='manual'` with no proposal record. Modifies the shipped Tuner CandidateCard surface additively; Deep path untouched.

---

## Home

| Option | Description | Selected |
|--------|-------------|----------|
| Skill Studio Triggering tab (Recommended) | The proposal card lives where the Tuner + ProviderScoreboard already are. Evidence + proposal in one place. Reuse SI-01's unified-diff ProposalCard. | ✓ |
| Evals tab (SI-01's ProposalCard home) | Maximum component reuse but splits the description proposal from its triggering evidence (the scoreboard lives in Triggering), so the user hops tabs. | |

**User's choice:** Skill Studio Triggering tab (Recommended)

---

## Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Extend skill_proposals + kind discriminator (Recommended) | Add proposed_description (nullable) + kind ('instruction'\|'description') + source_tuner_run_id FK; relax proposed_instructions. One table, one lifecycle, one audit trail; UI filters by kind. | ✓ |
| New sibling table skill_description_proposals | Clean "one home per concern" separation, no touching 083's constraints, but duplicates lifecycle enum + RLS + router for structurally the same proposal. | |

**User's choice:** Extend skill_proposals + kind discriminator (Recommended)

---

## Sketch (G-2)

| Option | Description | Selected |
|--------|-------------|----------|
| Plan directly — reuse existing design (Recommended) | No fresh /gsd:sketch. The diff card + scoreboard + Triggering tab are already designed and shipped; SI-02 composes them. Acceptance bar = visual consistency with those surfaces. | ✓ |
| Sketch the Triggering-tab proposal card first | Run /gsd:sketch to lock how the proposal card + head-to-head scoreboard compose. Slower; operator-approved mockup becomes the acceptance bar (full G-2). | |

**User's choice:** Plan directly — reuse existing design (Recommended)
**Notes:** All surfaces are design-locked in `sketch-findings-agentic-rag` (Tuner ProviderScoreboard, SI-01 unified-diff ProposalCard, 137 Studio Triggering tab). G-2 satisfied without a new mockup.

---

## Claude's Discretion

- Exact `skill_proposals` column + CHECK-constraint names; partial-CHECK to require `proposed_description` when `kind='description'`.
- Approved version's `source` attribution — lean `self_improve` (SI-01 consistency) vs `tuner`; the write mechanic must not break the 132 zero-app-code trigger.
- Whether to FK to `tuner_runs` (confirm it persists winner + per-provider scores) or snapshot the scoreboard inline.
- Diff util for the short description (likely inline, no micro-dep).
- "Propose this description" affordance wording; inline card vs modal.
- Whether the propose/approve flow needs any SSE (likely not — no async re-eval).

## Deferred Ideas

- Post-approval Tuner re-run gate (SI-01-parity rigor) — revisit only if false-promotions observed.
- Multi-candidate proposal picker (2–3 descriptions, user picks) — future.
- Edit-before-approve (editable proposed description) — deferred (SI-01 D-10 parity).
- Ambient / auto proposal drafting — out; on-demand only.
- Instruction-body self-improve — is SI-01 (Phase 135, shipped); out of scope for SI-02.
