# Phase 139: Self-Improve Proposer — Description-Only (STRETCH) - Context

**Gathered:** 2026-07-06
**Status:** Ready for planning

<domain>
## Phase Boundary

A bounded, human-in-the-loop proposer that drafts a change to a skill's **description**
(NOT its instruction body) as a reviewable diff → human approves or rejects → on approval a
new immutable skill version is created (the new description applied to the live skill). It is
the direct sibling of the shipped **SI-01 loop (Phase 135)**, but on the `description` field
and driven by the **Trigger Tuner's** cross-provider triggering signal instead of the eval
verdict. Never auto-applies. Instruction-body edits are explicitly out of scope (that is
SI-01 / Phase 135, shipped).

**Key framing (grounds every decision below):** the substrate is almost entirely already
built. The Trigger Tuner (Phase 123 / 123.1) already generates candidate descriptions, scores
each across every configured provider on a held-out should-fire/should-not benchmark, picks a
held-out winner, and today even applies it to the live skill via a one-click PATCH. SI-02 is
therefore **"wrap the Tuner's held-out winner in the SI-01 propose → review-diff → approve →
version lifecycle"** — not a new proposer and not a new runtime.

</domain>

<decisions>
## Implementation Decisions

### Proposer engine & trigger
- **D-01:** The **proposer IS a Trigger Tuner run** — reuse `build_candidates` +
  `classify_fires` + `_pick_winner` (`skill_tuner_service.py`). The held-out, per-provider
  **winning candidate description becomes the proposed diff**. NO new proposer LLM call, no
  `skill_description_proposer_service`. The proposal is a MEASURED winner, not an unmeasured
  guess — this is why it needs no post-approval gate (D-03).
- **D-02:** **Honest-by-construction.** When the current (baseline) description wins the
  held-out score, there is **nothing to propose** — the proposer never fabricates a diff.
  The Tuner already refuses to say "★ apply me" on the description you already run
  (`CandidateCard.tsx:50`); SI-02 inherits that honesty.
- **D-03 (carried from SI-01 D-01/D-04):** **On-demand only, one proposal at a time.**
  Triggered from a completed Tuner run where a candidate beats the baseline — user clicks
  "Propose this description." No ambient / auto drafting. Re-running the Tuner produces a
  fresh candidate.

### Promotion gate & lifecycle
- **D-04:** **The per-provider scoreboard is PRE-approval evidence — there is NO post-approval
  re-run gate.** The proposal card shows the Tuner's held-out per-provider scoreboard
  (proposed vs current, head-to-head). Approve → write the new description → new immutable
  version. This is deliberately lighter than SI-01 (which needed a post-approval re-eval
  because its proposer was an *unmeasured* instruction rewrite). Here the winner is already
  gated at draft time by held-out score. The Phase 139 success criteria do NOT require an
  auto-re-eval.
- **D-05:** **Approve / reject only** (carried from SI-01 D-10). No edit-before-approve.
  Reject → nothing changes; the user re-runs the Tuner for a fresh candidate, or edits the
  description manually (which already versions via the 132 trigger).
- **D-06:** **Never auto-applies — human always in the loop** (operator red line + SI-01
  D-05). The proposer never writes the live description without an explicit approval click.
- **D-07:** **Shorter lifecycle than SI-01** — no `re_evaling` / `interrupted` / `not_promoted`
  states are needed (there is no async re-eval). Description proposals move
  `proposed → rejected | approved → promoted`. Approval writes the version + applies to the
  live skill in one gated step (pass-by-construction — the scoreboard already gated it). The
  existing 7-value enum on `skill_proposals` already covers these states; description
  proposals simply never enter the re-eval states.

### Relationship to the Tuner's existing one-click apply
- **D-08:** **Replace the Tuner's one-click "apply winning description" PATCH with the
  proposal path.** The `CandidateCard` "apply me" affordance becomes **"Propose this
  description"** → reviewable diff + scoreboard → approve → version. ONE honest door; no
  one-click direct write to the live skill. Removes today's inconsistency where Tuner applies
  land as `source='manual'` versions with no proposal audit row. This modifies the shipped
  Tuner surface (123 / 123.1) **additively** — the Deep / agent-loop path is untouched.

### Surface (home)
- **D-09:** The description-proposal card lives on the **Skill Studio Triggering tab**
  (post-137), directly with the `ProviderScoreboard` — evidence + proposal in one place. It
  **reuses SI-01's unified-diff ProposalCard component**, reskinned to sit under the Tuner
  scoreboard. NOT the Evals tab (that would split the description proposal from its triggering
  evidence).
- **D-10:** **Unified line diff** (removed red / added green) for the description — same idiom
  as SI-01 D-09. The description is short, so the diff is small (likely a trivial inline
  render — no diff micro-dep needed; planner confirms).

### Persistence
- **D-11:** **Extend `skill_proposals` (mig 083)** — additive migration: add
  `proposed_description` (nullable), a `kind` / `proposal_type` discriminator
  (`'instruction' | 'description'`), and a `source_tuner_run_id` FK (→ `tuner_runs`); relax
  `proposed_instructions` to nullable (or gate its NOT-NULL by a `kind='instruction'` CHECK).
  ONE proposals table, ONE lifecycle enum, ONE audit trail; the UI filters by `kind`.
  `source_eval_run_id` stays NULL for description proposals (their driver is a tuner run, not
  an eval run). Rationale: SC#3 says reuse the SI-01 substrate; the shape is structurally the
  same proposal.

### Locked constraints (carried / restated — NOT gray areas)
- **D-12:** **SC#10 is satisfied natively** — the Tuner scoreboard IS the cross-provider
  measurement, so the proposer holds across providers by construction. VALIDATION.md still
  carries the 4-axis rows: proposer exercised on **≥2 providers**, an honest **"baseline wins
  → nothing to propose"** row, a **parallel-thread** isolation row, and a **long-history** row.
  G-4 lived-experience scenarios on the proposal card (user-visible UI).
- **D-13:** **Net-new / additive / red line (D-14 project-wide).** Extend `skill_tuner.py`
  (router — or a small sibling), `skill_tuner_service.py` (consume, don't fork), the frontend
  Triggering-tab components (`tuner/`), and SI-01's `ProposalCard`. Consume `agent_loop.py` /
  the provider gateway / `forced_emit` **READ-ONLY**. **Never grow `threads.py`.** Deep Mode
  stays byte-identical.
- **D-14:** **Migration discipline.** Next migration in sequence (087 is the latest applied —
  137.2 `is_system`; confirm the next number at plan time) applied via the Supabase SQL editor
  or psycopg2 :54322 (never `db push` / `db reset`), then `bash
  scripts/regenerate-full-schema.sh` (no `--reset`); commit the migration + regenerated
  `full-schema.sql` together.
- **D-15:** **Design reuse — no fresh sketch (operator-confirmed).** G-2 is satisfied by the
  existing design-locked surfaces (the Tuner `ProviderScoreboard`, SI-01's unified-diff
  `ProposalCard`, the 137 Studio Triggering tab — all documented in
  `sketch-findings-agentic-rag`). The acceptance bar is **visual consistency with those
  surfaces**, not a new mockup.

### Reported-bugs cross-check (mandatory touchpoint)
- **D-16:** The 8 open `surface: Agentic-RAG` reports were reviewed; **none overlap the SI-02
  description-proposer domain** (they are run-honesty / chat-composer / provider-routing /
  workflows-page). Nothing folded into this phase.

### Claude's Discretion
- Exact `skill_proposals` column + CHECK-constraint names; whether a partial CHECK enforces
  `proposed_description NOT NULL` when `kind='description'`.
- The approved version's **`source` attribution** — LEAN `self_improve` (consistent with SI-01,
  and this is a self-improve proposer); `tuner` is also defensible (the enum has it). Planner
  decides the write mechanic (explicit `source='self_improve'` version INSERT vs accepting the
  132 trigger's near-duplicate `manual` capture) **without breaking 132's zero-app-code
  trigger** — same discretion class as SI-01's promotion-write-mechanics item.
- Whether the proposal FKs to `tuner_runs` (confirm `tuner_runs` persists the winner +
  per-provider scores + candidate set — `skill_tuner.py:565` `winner_description` + `:619`
  `_persist_latest` strongly suggest yes) or the proposal snapshots the scoreboard inline.
- Diff util for the short description string (likely inline, no micro-dep).
- The "Propose this description" affordance wording + whether the proposal card renders inline
  under the scoreboard or as a small modal.
- Whether the propose/approve flow needs any SSE at all — likely NOT (no async re-eval; the
  Tuner run already streams, and propose/approve are synchronous create/approve calls).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements + roadmap
- `.planning/ROADMAP.md` — Phase 139 entry (goal, 3 success criteria, depends on 135)
- `.planning/REQUIREMENTS.md` — SI-02 (line 45): "description diff → human approves → new
  immutable version; no instruction-body edits (description only)"

### Prior-phase contracts (the substrate SI-02 composes)
- `.planning/phases/135-self-improvement-loop-si-01/135-CONTEXT.md` — the SI-01 loop this
  MIRRORS: on-demand (D-01), draft-version-first (D-05), the proposals table (D-07), the
  unified-diff review card + approve/reject-only (D-08/09/10), net-new/red-line (D-16),
  migration discipline (D-17)
- `.planning/phases/132-skill-versioning-eval-test-case-persistence/132-CONTEXT.md` —
  `skill_versions` trigger, the `source` enum (`self_improve` + `tuner` both reserved),
  append-only + owner-only RLS
- `.planning/phases/123-skill-triggering-quality/123-CONTEXT.md` + `123.1-*/123.1-CONTEXT.md`
  — the Trigger Tuner (TRIG-01) + the per-provider scoreboard design fidelity (the
  "cross-provider scoreboard" SI-02 reuses verbatim)
- `.planning/phases/137-skill-evals-panel-ui-panel-01/137-CONTEXT.md` — the Skill Studio
  (Evals · Triggering · Versions tabs; the Triggering tab is SI-02's home)

### Schema
- `supabase/migrations/079_skill_versions_and_test_cases.sql` — `skill_versions` snapshots
  `description` (`:50`) AND the capture trigger fires on `NEW.description IS DISTINCT FROM
  OLD.description` (`:115`) — **descriptions are already versioned**
- `supabase/migrations/083_skill_proposals.sql` — the proposals table SI-02 extends
  (`proposed_instructions NOT NULL`, `source_eval_run_id` FK, the 7-value lifecycle enum)
- `supabase/migrations/087_*.sql` — latest applied (137.2 `is_system`); the SI-02 migration is
  next-in-sequence (confirm the number at plan time)

### Code seams (REUSE / extend — never fork)
- `backend/app/services/skill_tuner_service.py` — `build_candidates`, `classify_fires`,
  `_pick_winner` (`:643`, held-out winner), `resolve_skill_builder_model` (`:84`),
  `auto_seed_cases`, `_score_provider_column` — **the proposer engine (REUSE)**
- `backend/app/api/skill_tuner.py` — `_run_tuner_job`, winner persistence (`:565`
  `winner_description`), `_persist_latest` (`:619`), `get_latest_tuner_run` /
  `get_tuner_results`, and the winning-description PATCH (the affordance SI-02 REPLACES,
  D-08) — the router extension point
- `backend/app/services/skill_proposer_service.py` — SI-01's proposer: `SkillProposal`
  schema, `assemble_evidence`, `forced_emit`, the anti-injection DATA discipline (T-135-03) —
  the lifecycle/pattern reference
- `backend/app/api/evals.py` — SI-01 propose / approve / reject routes + owner-verify 404
  pattern (the lifecycle SI-02's routes mirror)
- `frontend/src/components/skills/tuner/` — `CandidateCard.tsx` (the "apply me" affordance
  SI-02 replaces, `:50`), `ProviderScoreboard.tsx` (the evidence surface), `CaseEditor.tsx`,
  `LiveRunCard.tsx` — the Triggering-tab surfaces
- `frontend/src/components/skills/SkillEvalSection.tsx` — SI-01's unified-diff ProposalCard
  (the component reskinned into Triggering)
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — the design-locked surfaces (Trigger
  Tuner scoreboard, Studio Triggering tab, proposal card) — G-2 acceptance bar (D-15)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Trigger Tuner stack** (`skill_tuner_service.py` + `skill_tuner.py`): generates + scores
  candidate descriptions per-provider on a held-out benchmark, picks the held-out winner,
  persists the run — SI-02's proposer engine is literally "run the Tuner, take the winner,"
  no new machinery.
- **`ProviderScoreboard.tsx` + `CandidateCard.tsx`**: already render the per-provider
  scoreboard + candidate surface — SI-02 reuses them and swaps the "apply" affordance for
  "Propose."
- **SI-01 proposal lifecycle** (`skill_proposals` + `skill_proposer_service` + ProposalCard +
  `evals.py` propose/approve routes): the full propose → review → approve → version audit path
  — SI-02 extends the table with a `kind` discriminator and reuses the diff/approve UX.
- **`skill_versions` trigger + description snapshot** (079:50/:115): writing `skills.description`
  auto-captures an immutable version — "new version on approval" is nearly free.

### Established Patterns
- Forced-emission schema-bound candidates via `forced_emit` (the shared Phase 092.5 gateway) —
  no raw provider SDK, no agent loop, Deep byte-identical (D-13).
- Net-new / extend-a-router-not-`threads.py` (`skill_tuner.py` / `evals.py` precedent).
- Service-role write + `.eq("user_id")` owner gate + owner-only RLS defense; cross-user 404
  (132/133/134/135 threat-model precedent).
- Honest-by-construction: baseline-wins → nothing to propose (`CandidateCard.tsx:50` already
  refuses "apply me" on the current description).

### Integration Points
- A completed Tuner run (a candidate beats the baseline on held-out score) → "Propose this
  description" → `skill_proposals(kind='description')` row.
- Approval handler → write `skills.description` (fires the 132 trigger, or an explicit
  `source='self_improve'` version INSERT per D-11 discretion) → proposal `status='promoted'`.
- The Triggering tab renders the `ProviderScoreboard` (evidence) + the reskinned unified-diff
  ProposalCard.

</code_context>

<specifics>
## Specific Ideas

- The Tuner's honest **"baseline wins → no proposal"** behavior is the reference contract: the
  proposer must never fabricate a description change when the current one already scores best.
- The scoreboard shown on the proposal card = the SAME per-provider held-out scoreboard the
  Tuner already renders (`ProviderScoreboard`), proposed-vs-current head-to-head.
- The whole loop should read as: run Tuner → a candidate beats current on held-out score
  across providers → review the description diff + scoreboard → approve → new version applied —
  all in one place (the Triggering tab).

</specifics>

<deferred>
## Deferred Ideas

- **Post-approval Tuner re-run gate** (SI-01-parity rigor) → not needed here; the draft-time
  held-out score IS the gate (D-04). Revisit only if false-promotions are observed.
- **Multi-candidate proposal picker** (2–3 descriptions, user picks) → future; SI-01 also
  deferred this (135 deferred).
- **Edit-before-approve** (editable proposed description) → deferred (SI-01 D-10 parity);
  revisit if requested.
- **Ambient / auto proposal drafting** → out; on-demand only (D-03 / SI-01 D-01).
- **Instruction-body self-improve** → is SI-01 (Phase 135, shipped); explicitly out of scope
  for SI-02 (description only).

### Reviewed Todos (not folded)
- **`spike-nl-workflow-authoring`** (`todo.match-phase` score 0.2) — NOT folded. Keyword-only
  ("human") match, unrelated to SI-02, and already satisfied (NL authoring shipped in Phase
  103). Same disposition as recorded at Phases 134 / 135.

</deferred>

---

*Phase: 139-self-improve-proposer-description-only-stretch*
*Context gathered: 2026-07-06*
