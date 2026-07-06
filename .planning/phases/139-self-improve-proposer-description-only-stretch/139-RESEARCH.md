# Phase 139: Self-Improve Proposer — Description-Only (STRETCH) - Research

**Researched:** 2026-07-06
**Domain:** Skill self-improvement lifecycle (wrap the Trigger Tuner's held-out winner in the SI-01 propose → review-diff → approve → immutable-version lifecycle; description field only)
**Confidence:** HIGH (all seams read on disk; no new external surface)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim)

**Proposer engine & trigger**
- **D-01:** The **proposer IS a Trigger Tuner run** — reuse `build_candidates` + `classify_fires` + `_pick_winner` (`skill_tuner_service.py`). The held-out, per-provider **winning candidate description becomes the proposed diff**. NO new proposer LLM call, no `skill_description_proposer_service`. The proposal is a MEASURED winner, not an unmeasured guess — this is why it needs no post-approval gate (D-03).
- **D-02:** **Honest-by-construction.** When the current (baseline) description wins the held-out score, there is **nothing to propose** — the proposer never fabricates a diff. The Tuner already refuses to say "★ apply me" on the description you already run (`CandidateCard.tsx:50`); SI-02 inherits that honesty.
- **D-03 (carried from SI-01 D-01/D-04):** **On-demand only, one proposal at a time.** Triggered from a completed Tuner run where a candidate beats the baseline — user clicks "Propose this description." No ambient / auto drafting. Re-running the Tuner produces a fresh candidate.

**Promotion gate & lifecycle**
- **D-04:** **The per-provider scoreboard is PRE-approval evidence — there is NO post-approval re-run gate.** The proposal card shows the Tuner's held-out per-provider scoreboard (proposed vs current, head-to-head). Approve → write the new description → new immutable version. Lighter than SI-01 (which needed a post-approval re-eval because its proposer was an *unmeasured* instruction rewrite). Here the winner is already gated at draft time by held-out score. The Phase 139 success criteria do NOT require an auto-re-eval.
- **D-05:** **Approve / reject only** (carried from SI-01 D-10). No edit-before-approve. Reject → nothing changes; the user re-runs the Tuner for a fresh candidate, or edits the description manually (which already versions via the 132 trigger).
- **D-06:** **Never auto-applies — human always in the loop** (operator red line + SI-01 D-05). The proposer never writes the live description without an explicit approval click.
- **D-07:** **Shorter lifecycle than SI-01** — no `re_evaling` / `interrupted` / `not_promoted` states are needed (there is no async re-eval). Description proposals move `proposed → rejected | approved → promoted`. Approval writes the version + applies to the live skill in one gated step (pass-by-construction). The existing 7-value enum on `skill_proposals` already covers these states; description proposals simply never enter the re-eval states.

**Relationship to the Tuner's existing one-click apply**
- **D-08:** **Replace the Tuner's one-click "apply winning description" PATCH with the proposal path.** The `CandidateCard` "apply me" affordance becomes **"Propose this description"** → reviewable diff + scoreboard → approve → version. ONE honest door; no one-click direct write to the live skill. Removes today's inconsistency where Tuner applies land as `source='manual'` versions with no proposal audit row. Modifies the shipped Tuner surface (123/123.1) **additively** — the Deep / agent-loop path is untouched.

**Surface (home)**
- **D-09:** The description-proposal card lives on the **Skill Studio Triggering tab** (post-137), directly with the `ProviderScoreboard` — evidence + proposal in one place. It **reuses SI-01's unified-diff ProposalCard component**, reskinned to sit under the Tuner scoreboard. NOT the Evals tab.
- **D-10:** **Unified line diff** (removed red / added green) for the description — same idiom as SI-01 D-09. The description is short, so the diff is small (likely trivial inline render — no diff micro-dep; planner confirms).

**Persistence**
- **D-11:** **Extend `skill_proposals` (mig 083)** — additive migration: add `proposed_description` (nullable), a `kind` / `proposal_type` discriminator (`'instruction' | 'description'`), and a `source_tuner_run_id` FK (→ `tuner_runs`); relax `proposed_instructions` to nullable (or gate its NOT-NULL by a `kind='instruction'` CHECK). ONE proposals table, ONE lifecycle enum, ONE audit trail; the UI filters by `kind`. `source_eval_run_id` stays NULL for description proposals.

**Locked constraints (carried / restated)**
- **D-12:** **SC#10 is satisfied natively** — the Tuner scoreboard IS the cross-provider measurement. VALIDATION.md still carries the 4-axis rows: proposer exercised on **≥2 providers**, an honest **"baseline wins → nothing to propose"** row, a **parallel-thread** isolation row, and a **long-history** row. G-4 lived-experience scenarios on the proposal card.
- **D-13:** **Net-new / additive / red line.** Extend `skill_tuner.py` (router — or a small sibling), `skill_tuner_service.py` (consume, don't fork), the frontend Triggering-tab components (`tuner/`), and SI-01's `ProposalCard`. Consume `agent_loop.py` / the provider gateway / `forced_emit` **READ-ONLY**. **Never grow `threads.py`.** Deep Mode stays byte-identical.
- **D-14:** **Migration discipline.** Next migration in sequence applied via the Supabase SQL editor or psycopg2 :54322 (never `db push` / `db reset`), then `bash scripts/regenerate-full-schema.sh` (no `--reset`); commit the migration + regenerated `full-schema.sql` together. *(NOTE: CONTEXT.md D-14 says "087 is the latest applied" — this is STALE; see the migration-number finding below. The correct next number is 090.)*
- **D-15:** **Design reuse — no fresh sketch (operator-confirmed).** G-2 is satisfied by the existing design-locked surfaces (the Tuner `ProviderScoreboard`, SI-01's unified-diff `ProposalCard`, the 137 Studio Triggering tab — all in `sketch-findings-agentic-rag`). Acceptance bar = **visual consistency**, not a new mockup.
- **D-16:** The 8 open `surface: Agentic-RAG` reports were reviewed; **none overlap the SI-02 domain.** Nothing folded into this phase.

### Claude's Discretion (verbatim)
- Exact `skill_proposals` column + CHECK-constraint names; whether a partial CHECK enforces `proposed_description NOT NULL` when `kind='description'`.
- The approved version's **`source` attribution** — LEAN `self_improve` (consistent with SI-01); `tuner` is also defensible (the enum has it). Planner decides the write mechanic (explicit `source='self_improve'` version INSERT vs accepting the 132 trigger's near-duplicate `manual` capture) **without breaking 132's zero-app-code trigger**.
- Whether the proposal FKs to `tuner_runs` (confirm `tuner_runs` persists the winner + per-provider scores + candidate set) or the proposal snapshots the scoreboard inline.
- Diff util for the short description string (likely inline, no micro-dep).
- The "Propose this description" affordance wording + whether the proposal card renders inline under the scoreboard or as a small modal.
- Whether the propose/approve flow needs any SSE at all — likely NOT (propose/approve are synchronous; the Tuner run already streams).

### Deferred Ideas (OUT OF SCOPE)
- **Post-approval Tuner re-run gate** → not needed; the draft-time held-out score IS the gate (D-04).
- **Multi-candidate proposal picker** (2–3 descriptions, user picks) → future.
- **Edit-before-approve** (editable proposed description) → deferred (SI-01 D-10 parity).
- **Ambient / auto proposal drafting** → out; on-demand only.
- **Instruction-body self-improve** → is SI-01 (Phase 135, shipped); explicitly out of scope for SI-02 (description only).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| **SI-02** | A description-only self-improve proposer drafts a description diff → human approves → a new immutable version is created. No instruction-body edits (description only). Depends on SI-01 eval substrate. | Proposer engine = the shipped Trigger Tuner (`_run_tuner_job` → `pick_winner` → `scoreboard.winner_description`, `skill_tuner.py:560-566`). Lifecycle = mirror the SI-01 `skill_proposals` routes (`evals.py:695/991/1459`). Version-on-approval = the 079/132 `capture_skill_version` trigger fires on `NEW.description IS DISTINCT FROM OLD.description` (`079:113-116`, snapshots `description` at `079:50`). Cross-provider (SC#10) = the Tuner `ProviderScoreboard` (native, D-12). Diff render = the local `lib/lineDiff.ts` (no micro-dep). Home = `studio/TriggeringTab.tsx` → `SkillTunerPage`. |
</phase_requirements>

## Summary

SI-02 is a **composition phase, not a build phase.** Every moving part already exists and is
verified on disk: the Trigger Tuner (Phase 123/123.1) generates candidate descriptions, scores
each across every configured provider on a held-out benchmark, and picks a per-provider held-out
winner (`skill_tuner_service.pick_winner`); the SI-01 loop (Phase 135) supplies the
propose → review-diff → approve → immutable-version lifecycle on the `skill_proposals` table; the
079/132 trigger already auto-captures an immutable `skill_versions` row whenever `skills.description`
changes; and the frontend already has a render-only unified-diff proposal card
(`studio/ProposalCard.tsx`), a per-provider `ProviderScoreboard`, and a local `lineDiff` util. SI-02
wires these together: **run Tuner → a candidate beats the baseline on held-out score across providers
→ "Propose this description" → review the diff + scoreboard → approve → new description written +
new immutable version.**

The two seams that carry the phase's real risk (and this research resolves) are: **(1) where the
Tuner's winner-evidence lives** — the winner description, the candidate set, and the per-provider
held-out cells are ALL inside the `tuner_runs.scoreboard` jsonb blob, and that row is a
`UNIQUE(skill_id)` **latest-wins upsert**, so a bare FK to `tuner_runs` would let a subsequent Tuner
re-run silently mutate a pending proposal's displayed evidence; and **(2) the version-write mechanic
on approval** — writing `skills.description` unavoidably fires the 079/132 trigger (which hardcodes
`source='manual'`), so an explicit `source='self_improve'` INSERT on top would produce a near-duplicate
version.

**Primary recommendation:** Extend `skill_proposals` (migration **090**) with `proposed_description`,
a `kind` discriminator, a `scoreboard_snapshot jsonb`, and an optional `source_tuner_run_id` FK; on
propose, **snapshot the winner description + the proposed-vs-current scoreboard INLINE** into the
proposal (the FK is provenance only, never the evidence source); on approve, **write
`skills.description` and let the 079/132 trigger capture the version (`source='manual'`)** — one
version, zero app-code, no trigger change — linking `new_skill_version_id` by reading the just-created
`MAX(version_number)` row. Add a `kind='description'` branch/sibling to `ProposalCard`, replace
`SkillTunerPage.handleConfirmWinner`'s one-click `PATCH /skills` with a "Propose this description"
call, and add three synchronous routes (propose / approve / reject) — **no new SSE** (the Tuner run
already streams; propose/approve are synchronous).

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Generate + score candidate descriptions (per-provider, held-out) | API / Backend (`skill_tuner.py` + `skill_tuner_service.py`, REUSE unchanged) | Provider gateway (`forced_emit`, read-only) | Already the Tuner's job (D-01); SI-02 consumes its winner, forks nothing. |
| Persist the proposal (draft, evidence snapshot, lifecycle) | Database (`skill_proposals` mig 090) | API / Backend (service-role writer) | ONE proposals table, owner-scoped RLS + app-code gate (083 precedent). |
| Propose / approve / reject routes | API / Backend (`evals.py` or a small sibling on the `/skills` router) | — | Mirror SI-01's propose/reject/approve (`evals.py`); synchronous, no SSE. |
| Immutable version-on-approval | Database (079/132 `capture_skill_version` trigger) | API / Backend (`skills.description` UPDATE) | Zero-app-code trigger already snapshots description changes (D-14 red line). |
| Cross-provider measurement (SC#10) | API / Backend (Tuner scoreboard) | — | The scoreboard IS the cross-provider signal (D-12) — no provider forks. |
| Review UI (diff + scoreboard + approve/reject) | Frontend Studio Triggering tab (`ProposalCard` variant + `ProviderScoreboard`) | Browser (React state) | Design-locked surfaces (D-09/D-15); render-only card, handlers injected. |
| Live Tuner run progress | Frontend (existing tuner SSE) | API / Backend (`replay_tail_consumer`) | Already shipped; SI-02 adds nothing to the streaming path. |

## Standard Stack

**No new packages.** Every dependency is already in the repo and in production use. SI-02 is a
composition over existing modules.

### Core (all existing — REUSE)
| Module | Purpose | Why Standard |
|--------|---------|--------------|
| `backend/app/services/skill_tuner_service.py` | `build_candidates`, `classify_fires`, `pick_winner`, `build_cell`, `configured_targets`, `auto_seed_cases`, `resolve_skill_builder_model` — the proposer engine | The Tuner IS the proposer (D-01); measured winner, no new LLM call. [VERIFIED: read on disk] |
| `backend/app/api/skill_tuner.py` | `_run_tuner_job` → `pick_winner` → `scoreboard{winner_description}` (`:560-566`), `_persist_latest` upsert into `tuner_runs` (`:619`), `get_latest_tuner_run` (`:817`), `get_tuner_results` (`:876`) | The run that produces the winner + the durable scoreboard SI-02 snapshots. [VERIFIED: read on disk] |
| `backend/app/api/evals.py` | SI-01 `POST /skills/{id}/proposals` (`:695`), `/reject` (`:991`), `/approve` (`:1459`); `_proposal_response` (`:671`); owner-verify/404 + `_OPEN_PROPOSAL_STATUSES` guards (`:604`) | The lifecycle SI-02's description routes mirror. [VERIFIED: read on disk] |
| `backend/app/services/skill_proposer_service.py` | SI-01's `forced_emit` + anti-injection DATA discipline | Pattern reference only — SI-02 does NOT call a proposer LLM (winner comes from the Tuner). [CITED: 135-CONTEXT] |
| `skill_proposals` table (mig 083) | The single owner-scoped proposal table SI-02 extends | ONE table, ONE lifecycle enum, ONE audit trail (D-11). [VERIFIED: read on disk] |
| `capture_skill_version` trigger (mig 079/132) | Auto-captures an immutable `skill_versions` row on any `skills` content change | "New version on approval" is nearly free + zero-app-code (D-14). [VERIFIED: read on disk] |
| `frontend/src/lib/lineDiff.ts` | `lineDiff(base, next): DiffRow[]` unified line diff | Already used by `SkillEvalSection`, `studio/ProposalCard`, `VersionsTab` — no diff micro-dep. [VERIFIED: read on disk] |
| `frontend/src/components/skills/studio/ProposalCard.tsx` | Render-only, handlers-injected SI-01 diff/approve/reject card | Reskinnable for `kind='description'` (D-09). [VERIFIED: read on disk] |
| `frontend/src/components/skills/tuner/{ProviderScoreboard,CandidateCard,LiveRunCard}.tsx` | Per-provider scoreboard + candidate surface | The evidence surface + the affordance SI-02 replaces (D-08). [VERIFIED: read on disk] |

### Supporting (existing, referenced)
| Module | Purpose | When to Use |
|--------|---------|-------------|
| `backend/app/api/skills.py:384` `update_skill` (`PATCH /skills/{id}`) | Writes `skills.description` (fires the version trigger; re-lints) | The current one-click apply path (D-08 replaces its Tuner caller, not the route). |
| `frontend/src/lib/api.ts` (`proposeImprovement`/`approveProposal`/`rejectProposal` `:1874-1955`; `startTunerRun`/`getTunerResults`/`getTunerLatest` `:3194+`) | Existing wire functions | Add a description-proposal sibling that mirrors the shape. |
| `frontend/src/pages/SkillTunerPage.tsx` `handleConfirmWinner` (`:461-466`) | `updateSkill(skillId,{description})` — the one-click apply | The exact call D-08 replaces with "Propose this description." |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Snapshot scoreboard inline on the proposal | Bare FK `source_tuner_run_id → tuner_runs.id` | REJECTED as sole evidence source: `tuner_runs` is `UNIQUE(skill_id)` latest-wins — a re-run mutates the FK'd row's `scoreboard` out from under a pending proposal (see Pitfall 1). FK kept only as optional provenance. |
| Accept the trigger's `source='manual'` version | Explicit `source='self_improve'` INSERT + `skills` UPDATE | REJECTED as default: the UPDATE also fires the trigger → a near-duplicate `manual` version. Getting clean `self_improve` attribution needs trigger modification (GUC) — see Pitfall 2 + Discretion resolution. |
| A `kind` branch on `ProposalCard` / a thin sibling card | A brand-new proposal card | REJECTED: `ProposalCard` is already render-only with injected handlers; a variant reuses the diff + honesty locks (D-09). |
| Synchronous propose/approve (no SSE) | An SSE stream for approve | REJECTED: SI-02 has no async re-eval (D-07); approve is one synchronous transaction. The Tuner run already streams. |

**Installation:** None. `pip` / `npm` unchanged.

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** All modules are first-party and already in the
repository (verified by reading each file this session). The only "diff" dependency is the
first-party `frontend/src/lib/lineDiff.ts`. No `npm install` / `pip install` step appears in any
recommended plan task. Slopcheck / registry verification is therefore not applicable.

## Architecture Patterns

### System Architecture Diagram

```
                         ┌─────────────────────────────────────────────────────┐
  Skill Studio           │  Studio Triggering tab  (studio/TriggeringTab.tsx    │
  (frontend)             │   → SkillTunerPage embedded)                         │
                         └───────────────┬─────────────────────────────────────┘
                                         │ 1. "Run tuner"  (EXISTING, unchanged)
                                         ▼
   POST /skills/{id}/tuner/runs ──► _run_tuner_job (bounded, SSE progress)
                                         │  build_candidates → classify_fires
                                         │  → pick_winner (held-out, per-provider)
                                         ▼
                     scoreboard = { candidates[], winner_index, winner_description }
                                         │
                         ┌───────────────┴───────────────┐
                         ▼                                ▼
        Redis tuner_result:{run_id}          tuner_runs (UNIQUE(skill_id),
        (ephemeral, TTL 600s)                 latest-wins upsert — MUTABLE)
                         │
                         ▼   2. winner beats baseline & is_baseline=false
        ProviderScoreboard + Candidatecard  →  "Propose this description"  (D-08 replaces
                         │                       the old one-click PATCH /skills apply)
                         ▼
   POST /skills/{id}/proposals  (kind='description')   ── SYNCHRONOUS, no SSE ──►
                         │  snapshot: proposed_description = winner_description
                         │            scoreboard_snapshot  = proposed-vs-current cells (IMMUTABLE)
                         │            base_skill_version_id = current MAX(version_number)
                         ▼
        skill_proposals row  status='proposed'  (owner-scoped, service-role write)
                         │
              ┌──────────┴───────────┐
              ▼ 3a. reject            ▼ 3b. approve  (human-in-loop, D-06)
   status='rejected'          UPDATE skills.description = proposed_description
   (pure audit flip)                   │  (fires 079/132 trigger)
   nothing else changes                ▼
                            skill_versions INSERT  (source='manual', immutable)  ← trigger
                                        │
                                        ▼  link new_skill_version_id = MAX version, status='promoted'
                            skill_proposals row  status='promoted'
```

### Recommended Project Structure (files touched — all additive)
```
supabase/migrations/
└── 090_skill_proposals_description_kind.sql   # NEW — extend skill_proposals

backend/app/
├── models/eval_run.py                         # EXTEND SkillProposalResponse (+ description fields)
├── api/evals.py                               # ADD 3 routes (or a small sibling module)
│                                              #   POST .../proposals            (kind='description')
│                                              #   POST .../proposals/{id}/approve  (desc lifecycle)
│                                              #   POST .../proposals/{id}/reject   (reuse existing)
└── api/skill_tuner.py                         # (optional) helper to fetch a run's winner+scoreboard

frontend/src/
├── types/index.ts                             # EXTEND SkillProposal (+ proposed_description, kind,
│                                              #   base_description, scoreboard_snapshot, source_tuner_run_id)
├── lib/api.ts                                 # ADD proposeDescription() wire fn (+ approve/reject reuse)
├── components/skills/studio/ProposalCard.tsx  # ADD kind='description' branch (diff + scoreboard, approve/reject only)
│   (or a thin DescriptionProposalCard sibling reusing lineDiff + ProviderScoreboard)
├── pages/SkillTunerPage.tsx                   # REPLACE handleConfirmWinner → "Propose this description"
└── components/skills/tuner/CandidateCard.tsx  # RE-LABEL "Use"/"★" affordance → "Propose this description"
```

### Pattern 1: Snapshot-not-FK for mutable upstream evidence
**What:** When the upstream row is a latest-wins singleton (`tuner_runs` is `UNIQUE(skill_id)`, upserted
`on_conflict="skill_id"`), a proposal that references it must **copy** the evidence it displays, not
FK to it. FK the run only for provenance/audit; render from the snapshot.
**When to use:** Any proposal/audit row whose displayed evidence comes from a mutable/overwritten source.
**Example (persistence shape):**
```sql
-- migration 090 (illustrative — exact names are Claude's discretion, D-11)
ALTER TABLE public.skill_proposals
  ADD COLUMN kind text NOT NULL DEFAULT 'instruction'
      CHECK (kind IN ('instruction','description')),
  ADD COLUMN proposed_description text,                    -- winner_description snapshot
  ADD COLUMN scoreboard_snapshot  jsonb,                   -- proposed-vs-current per-provider cells (IMMUTABLE)
  ADD COLUMN source_tuner_run_id  uuid
      REFERENCES public.tuner_runs(id) ON DELETE SET NULL, -- provenance ONLY, not the evidence source
  ALTER COLUMN proposed_instructions DROP NOT NULL;

-- kind-gated integrity (partial CHECK — recommended, matches 079/083 strong-invariant style):
ALTER TABLE public.skill_proposals
  ADD CONSTRAINT skill_proposals_kind_fields CHECK (
    (kind = 'instruction' AND proposed_instructions IS NOT NULL AND proposed_description IS NULL)
    OR
    (kind = 'description' AND proposed_description IS NOT NULL AND proposed_instructions IS NULL)
  );
```

### Pattern 2: Mirror the SI-01 route contract, drop the async arm
**What:** SI-02's routes are structurally SI-01's, minus the re-eval machinery.
**When to use:** The propose/approve/reject handlers.
**Example (approve — description variant, synchronous):**
```python
# 1. owner-verify skill (404 cross-user) + read the 'proposed' description proposal (id AND user_id AND skill_id)
# 2. state guard: status == 'proposed' else 409  (mirror evals.py:1506)
# 3. UPDATE skills SET description = proposed_description WHERE id AND user_id   (fires 079/132 trigger)
# 4. read the just-created version:  SELECT ... ORDER BY version_number DESC LIMIT 1  (new_skill_version_id)
# 5. UPDATE skill_proposals SET new_skill_version_id=..., status='promoted'
#    (NO draft version INSERT, NO re-eval launch, NO re_evaling state — D-07)
```
SI-01's approve (`evals.py:1459`) INSERTs a `source='self_improve'` DRAFT version **without touching
the live skill** and then launches an async re-eval. SI-02 does the opposite: it **writes the live
skill** and lets the trigger capture the version, with **no draft, no re-eval, no `re_evaling`/
`interrupted`/`not_promoted` states.**

### Anti-Patterns to Avoid
- **FK-only to `tuner_runs` for the displayed scoreboard:** the latest-wins upsert mutates it (Pitfall 1).
- **Explicit `source='self_improve'` INSERT + `skills` UPDATE:** double-captures a version (Pitfall 2).
- **A second proposals table or a second lifecycle enum:** D-11 is ONE table, ONE enum, `kind`-filtered.
- **Adding SSE to propose/approve:** there is no async work (D-07); it would be dead plumbing.
- **Touching `agent_loop.py` / `threads.py` / provider services:** red line (D-13) — consume read-only, Deep byte-identical.
- **Fabricating a diff when the baseline wins:** honest-by-construction (D-02) — `CandidateCard.tsx:52` `isActionableWinner = isWinner && !candidate.is_baseline` is the reference contract; SI-02 must gate "Propose" on the same condition.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Candidate generation + per-provider held-out scoring | A new `skill_description_proposer_service` | The shipped Tuner (`_run_tuner_job` → `pick_winner`) | The winner is a MEASURED result; a new LLM call would be an unmeasured guess (D-01). |
| Immutable version-on-approval | An app-side version-writer | The 079/132 `capture_skill_version` trigger | Zero-app-code, covers all write paths, already ships (D-14). |
| Unified line diff | A `diff`/`jsdiff` npm dep | `frontend/src/lib/lineDiff.ts` | Already exists + used in 3 surfaces; the description string is short. |
| Proposal review card (diff + approve/reject + honesty locks) | A new card | `studio/ProposalCard.tsx` variant | Render-only, handlers injected, honesty locks preserved (D-09). |
| Owner-scoped 404-not-403 gate | New auth logic | `_verify_owned_skill` / `_fetch_owned_or_global_skill` pattern | 132/133/134/135 threat-model precedent. |
| Cross-provider measurement (SC#10) | Provider-specific proposer forks | The Tuner `ProviderScoreboard` | It IS the cross-provider signal; forks break the shared gateway (D-12). |

**Key insight:** SI-02's entire value is that nothing here is new machinery — it is the **honest
front door** (propose → review → approve → audited version) bolted onto the Tuner winner that today
lands as an unaudited `source='manual'` one-click write. The risk is entirely in *plumbing the
existing pieces correctly*, not in building anything.

## Runtime State Inventory

> SI-02 is net-new/additive, but it MODIFIES a shipped surface (the Tuner one-click apply, D-08) and
> composes over mutable persisted state. This inventory covers the state that behaves surprisingly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data (mutable upstream)** | `tuner_runs` is `UNIQUE(skill_id)` latest-wins — one row per skill; a Tuner re-run UPSERTs (`on_conflict="skill_id"`, `skill_tuner.py:619`), keeping the row `id` stable but **overwriting `scoreboard` + `run_id`**. The winner_description + candidate set + per-provider cells all live inside `scoreboard` jsonb (no dedicated columns — `077_tuner_runs.sql`). | Snapshot the winner + scoreboard INLINE on the proposal at propose-time (do NOT read it live via FK). |
| **Existing behavior being replaced** | Today's "apply winning description" is NOT a tuner PATCH — it is `SkillTunerPage.handleConfirmWinner` → `useSkills().updateSkill` → `PATCH /skills/{id}` (`skills.py:384`), which fires the 079/132 trigger and lands a `source='manual'` version **with no proposal audit row**. `CandidateCard` calls it via `onConfirm`. | Replace the `onConfirm` target with "Propose this description" → `POST .../proposals`. Route/PATCH itself stays (manual edits still use it). |
| **Version trigger (fires on any description write)** | `capture_skill_version` (079:101) fires `AFTER INSERT OR UPDATE ON skills` whenever `NEW.description IS DISTINCT FROM OLD.description` (079:113-116), always writing `source='manual'` (079:132). `skill_versions` is append-only (BEFORE UPDATE block, 079:151-166) — you can NOT retro-edit a version's `source`. | Approval's `skills.description` write auto-versions; read back `MAX(version_number)` for `new_skill_version_id`. Do not attempt to re-label the version. |
| **Lifecycle enum (already sufficient)** | `skill_proposals.status` CHECK is a 7-value enum: `proposed/rejected/approved/re_evaling/promoted/not_promoted/interrupted` (083:55). SI-02 uses only `proposed/rejected/(approved)/promoted`. | NO enum migration. Description proposals simply never enter the re-eval states (D-07). |
| **Concurrency guard** | SI-01's `_OPEN_PROPOSAL_STATUSES=('proposed','approved','re_evaling')` / `_INFLIGHT=('approved','re_evaling')` (`evals.py:604`) enforce one-open-proposal-per-skill. | Scope the description guard by `kind='description'`. Since SI-02 approve is synchronous (no in-flight async state), the open set for description is effectively just `('proposed',)` — supersede a lingering `proposed` description draft; no `_INFLIGHT` block needed. |
| **Secrets/env vars** | None — no new secrets, no new env vars. Provider keys already resolved via `app_settings`/`UserEffectiveSettings` (the Tuner already uses them). | None. |
| **Build artifacts** | None — no package build, no Docker image change. | None. |

**The canonical question — after every file is updated, what runtime state still carries surprising
behavior?** The `tuner_runs` latest-wins mutation (evidence must be snapshotted) and the
description-write trigger (versioning is automatic + `source='manual'`). Both are resolved above.

## Common Pitfalls

### Pitfall 1: FK to `tuner_runs` shows the WRONG scoreboard after a re-run
**What goes wrong:** A proposal FKs `source_tuner_run_id → tuner_runs.id` and the card renders the
scoreboard by reading that row live. The user proposes from run A, then re-runs the Tuner (run B)
before approving. `tuner_runs` is `UNIQUE(skill_id)` and `_persist_latest` upserts
`on_conflict="skill_id"` (`skill_tuner.py:619`), so the row's `id` stays the same but its
`scoreboard` is now run B's. The pending proposal now displays run B's evidence for a description
drafted from run A — a silent honesty violation (the scoreboard that "gated" the proposal is gone).
**Why it happens:** The winner + scores + candidates live *inside* the overwritten `scoreboard` jsonb,
and the latest-wins design intentionally keeps only one row per skill.
**How to avoid:** Snapshot `proposed_description` + `scoreboard_snapshot` (the proposed-vs-current cells)
INLINE on the `skill_proposals` row at propose-time. Render from the snapshot. Keep the FK only as
provenance (nullable, `ON DELETE SET NULL`).
**Warning signs:** The proposal card's scoreboard changes after re-running the Tuner; a promoted
proposal's evidence doesn't match the description it promoted.

### Pitfall 2: Double-captured version on approval
**What goes wrong:** To get `source='self_improve'` attribution, approval does an explicit
`skill_versions` INSERT (like SI-01) AND updates `skills.description`. The `skills` UPDATE fires the
079/132 trigger, which writes a SECOND version (`source='manual'`) — two near-duplicate rows for one
approval.
**Why it happens:** The trigger fires on ANY `skills.description` change; it cannot be told "a version
already exists for this."
**How to avoid:** Pick ONE version-write path. Recommended: **let the trigger do it** (write only
`skills.description`; read back `MAX(version_number)` for `new_skill_version_id`). Do NOT also INSERT.
(See "Discretion resolution: version-write mechanic" below for the `self_improve`-attribution option.)
**Warning signs:** `skill_versions` gains 2 rows per approval; `version_number` jumps by 2.

### Pitfall 3: base_skill_version_id has no source eval run
**What goes wrong:** `skill_proposals.base_skill_version_id` is `NOT NULL` (083:46) and SI-01 resolves
it from the source eval run's `skill_version_id`. SI-02 has no eval run (`source_eval_run_id` stays
NULL, D-11), so the base is unresolved.
**Why it happens:** The base for a description diff is the CURRENT live description's version, not an
eval run's version.
**How to avoid:** Resolve `base_skill_version_id = the skill's latest `skill_versions` row`
(`ORDER BY version_number DESC LIMIT 1`, owner-scoped). Because every description save versions
(079 trigger), the current live description always corresponds to the latest version. Keep the column
`NOT NULL` — it is always resolvable.
**Warning signs:** A NULL/violating insert; the diff base doesn't match the live description.

### Pitfall 4: Proposing when the baseline won (dishonest diff)
**What goes wrong:** "Propose this description" is offered even when the held-out winner IS the current
description (`is_baseline=true`) — producing a no-op or fabricated diff.
**Why it happens:** Not gating the affordance on the same condition the Tuner already uses.
**How to avoid:** Gate "Propose" on `winner && !winner.is_baseline` (mirror
`CandidateCard.tsx:52` `isActionableWinner`). When the baseline wins, show "nothing to propose —
you're already running the best description" (D-02).
**Warning signs:** A proposal whose `proposed_description == base description`; an empty diff.

### Pitfall 5: `run_in_threadpool` omitted on supabase-py calls
**What goes wrong:** A bare blocking `supabase-py` call inside an async route freezes the event loop
(project rule D-v2.5-01).
**How to avoid:** Wrap every supabase-py read/write in `run_in_threadpool`, exactly as `evals.py` and
`skill_tuner.py` already do throughout.
**Warning signs:** Latency spikes / stalls under concurrent load (the parallel-thread UAT row).

## Code Examples

### Reading a Tuner run's winner + scoreboard to snapshot (propose-time)
```python
# The winner + per-provider cells + candidate set all live in scoreboard jsonb — read them from
# the DURABLE tuner_runs row (survives Redis flush) OR the ephemeral Redis stash, and SNAPSHOT.
# Source: backend/app/api/skill_tuner.py:560-566 (scoreboard shape), :817-873 (get_latest_tuner_run)
scoreboard = tuner_run_row["scoreboard"]        # { candidates[], winner_index, winner_description }
winner_index = scoreboard.get("winner_index")
winner_desc  = scoreboard.get("winner_description")
# Honest-by-construction gate (D-02): only propose an ACTIONABLE winner (a real rewrite).
winner = next((c for c in scoreboard["candidates"] if c["index"] == winner_index), None)
if winner is None or winner.get("is_baseline"):
    raise HTTPException(400, "Nothing to propose — the current description already wins")
proposed_description = winner_desc
scoreboard_snapshot  = {                         # IMMUTABLE proposed-vs-current evidence
    "winner": winner,
    "baseline": next((c for c in scoreboard["candidates"] if c.get("is_baseline")), None),
    "run_id": tuner_run_row["run_id"],
}
```

### Approval: write the live description, let the trigger version it
```python
# Source pattern: skills.py:404-410 (skills UPDATE) + 079_skill_versions... trigger.
def _apply_description():
    return (supabase.table("skills")
            .update({"description": proposed_description})
            .eq("id", skill_id).eq("user_id", user_id).execute())
res = await run_in_threadpool(_apply_description)          # fires capture_skill_version → source='manual'
if not res.data:
    raise HTTPException(404, "Skill not found")

def _latest_version():
    return (supabase.table("skill_versions").select("id, version_number")
            .eq("skill_id", skill_id).eq("user_id", user_id)
            .order("version_number", desc=True).limit(1).execute())
new_version = (list((await run_in_threadpool(_latest_version)).data or []) or [{}])[0]

def _promote():
    return (supabase.table("skill_proposals")
            .update({"new_skill_version_id": new_version.get("id"), "status": "promoted"})
            .eq("id", str(proposal_id)).eq("user_id", user_id).execute())
await run_in_threadpool(_promote)
```

### Frontend diff (reuse the local util — no micro-dep)
```tsx
// Source: frontend/src/lib/lineDiff.ts + studio/ProposalCard.tsx:31,688
import { lineDiff } from "@/lib/lineDiff"
lineDiff(proposal.base_description, proposal.proposed_description).map((row, i) => (
  <span key={i} className={row.type === "add" ? "…emerald…" : row.type === "remove" ? "…destructive…" : "…"}>
    {row.type === "add" ? "+ " : row.type === "remove" ? "- " : "  "}{row.text || " "}
  </span>
))
```

## Discretion Resolutions (evidence-backed recommendations for the planner)

**1. FK vs. snapshot (`tuner_runs`):** **SNAPSHOT INLINE.** Evidence: `077_tuner_runs.sql` has NO
`winner_description`/`candidates` columns — they're inside `scoreboard` jsonb; `CONSTRAINT
tuner_runs_skill_unique UNIQUE (skill_id)` + `_persist_latest` `.upsert(..., on_conflict="skill_id")`
(`skill_tuner.py:619`) make the row latest-wins/mutable. Store `proposed_description` +
`scoreboard_snapshot jsonb` on the proposal; keep `source_tuner_run_id` FK (`ON DELETE SET NULL`) as
provenance only.

**2. Version-write mechanic:** **Accept the 079/132 trigger's `source='manual'` capture** (write only
`skills.description`; link `new_skill_version_id` from `MAX(version_number)`). One version, zero
app-code, no trigger change, no duplicate — and symmetric with how the Tuner's current apply already
versions. The self-improve provenance lives in the promoted `skill_proposals` row
(`kind='description'`, `source_tuner_run_id`), which is the real audit anchor. *If the operator insists
on `source='self_improve'` (or `'tuner'`) attribution on the version row itself,* the only clean
single-version path is to parameterize the 132 trigger via a transaction-local GUC (e.g.
`COALESCE(current_setting('app.skill_version_source', true), 'manual')` + `SET LOCAL` before the
UPDATE, run through asyncpg in one txn). That is backward-compatible (unset → `'manual'`, existing
paths unchanged) but modifies the shipped trigger and adds a transaction — heavier, and arguably in
tension with D-13's "consume 132." Recommend deferring GUC unless attribution is explicitly required.

**3. CHECK constraint:** **Use the kind-gated partial CHECK** (Pattern 1 example) — matches the
079/083 strong-invariant style and makes a `kind='description'` proposal that forgot
`proposed_description` a DB error, not a silent NULL. `proposed_instructions` → `DROP NOT NULL`.

**4. Migration number:** **090** (see finding below).

**5. SSE:** **None.** Propose/approve/reject are synchronous; the Tuner run already streams (D-07).

**6. Diff util:** **`lib/lineDiff.ts`** — no micro-dep.

**7. Card home / affordance:** Render the proposal card **inline under the `ProviderScoreboard`** in
`SkillTunerPage`'s winner area (where `handleConfirmWinner` lives today), reusing a `ProposalCard`
`kind='description'` variant. Affordance wording: **"Propose this description"** (replacing "Use"/"★").

## State of the Art

| Old Approach (shipped today) | SI-02 Approach | Impact |
|--------------|------------------|--------|
| Tuner winner applied via one-click `PATCH /skills` → `source='manual'` version, no audit row (`SkillTunerPage.handleConfirmWinner`) | "Propose this description" → `skill_proposals` audit row → human approve → version | Every description change from the Tuner now has a reviewable diff + a durable audit trail (D-08). |
| Description edits version silently via the 079 trigger | Same trigger, now driven by an approved proposal | Versioning unchanged; provenance added at the proposal layer. |

**Deprecated/outdated in the plan inputs:**
- CONTEXT.md D-11/D-14 "087 is the latest applied … 088 is next": **STALE.** Migrations **088**
  (`skill_creator_eval_step_sequencing`) and **089** (`skill_creator_file_attach_honesty`) have since
  landed. See finding.

## Critical Finding: Migration Number

`ls supabase/migrations/` (this session, 2026-07-06) shows the highest-numbered file is
**`089_skill_creator_file_attach_honesty.sql`**. Migrations 088 and 089 landed after CONTEXT.md was
written. **The SI-02 migration is `090_*.sql`** (e.g. `090_skill_proposals_description_kind.sql`) —
NOT 088. [VERIFIED: `ls supabase/migrations/` on disk]

Migration discipline (project rule, MANDATORY): author `090_*.sql`, apply to the LIVE local DB via the
Supabase SQL editor or psycopg2 on `127.0.0.1:54322` (**never** `supabase db push` / `db reset`), then
`bash scripts/regenerate-full-schema.sh` (no `--reset` — verified present, executable), and commit the
migration + regenerated `supabase/full-schema.sql` together. **Verification depends on the migration
being applied to the live DB** (the route behavior + CHECK constraints come from the live schema, not
config) — make "apply migration 090 to live DB" an explicit, human-gated plan task before any route
test runs. [VERIFIED: CLAUDE.md migration discipline; scripts/regenerate-full-schema.sh present]

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `.upsert(payload, on_conflict="skill_id")` on `tuner_runs` preserves the existing row `id` (only `scoreboard`/`run_id`/etc. change) across a re-run. | Pitfall 1 | LOW — even if the id changed, the snapshot recommendation is unaffected (snapshot is the fix either way). PostgreSQL `ON CONFLICT DO UPDATE` semantics support this; payload omits `id`. [ASSUMED — PostgreSQL upsert semantics, not re-verified live] |
| A2 | The 079 trigger's `source='manual'` on a description-approval is acceptable provenance (the proposal row is the real audit anchor). | Discretion #2 | MEDIUM — operator may want `source='self_improve'`/`'tuner'` on the version. Surfaced as an explicit discretion with a GUC fallback. [ASSUMED — needs operator confirmation at plan/discuss time] |
| A3 | Description proposals need only a `('proposed',)` open-guard (no async in-flight state). | Runtime State Inventory | LOW — approve is synchronous (D-07); no `approved`/`re_evaling` gap exists for description. [VERIFIED by D-07 + synchronous approve design] |
| A4 | `base_skill_version_id` = the skill's latest `skill_versions` row is the correct diff base. | Pitfall 3 | LOW — every description save versions (079 trigger), so latest == current live description. [VERIFIED: 079 trigger fires on description change] |

## Open Questions

1. **Version `source` attribution (`manual` vs `self_improve`/`tuner`).**
   - What we know: Writing `skills.description` fires the trigger → `source='manual'`; the enum reserves
     `self_improve` + `tuner`; a clean non-`manual` attribution needs a GUC-parameterized trigger.
   - What's unclear: Whether the operator wants the version row to *self-identify* as a self-improve
     promotion, or is content with the proposal row carrying that provenance.
   - Recommendation: Ship with `manual` (Discretion #2 primary); raise the GUC option at discuss-phase
     if attribution matters. Low-risk to defer.

2. **`ProposalCard` variant vs. thin sibling card.**
   - What we know: `studio/ProposalCard.tsx` is render-only with injected handlers and uses `lineDiff`.
   - What's unclear: Whether overloading it with a `kind='description'` branch (drop gate/rerun/
     re_evaling, add `ProviderScoreboard`) is cleaner than a small `DescriptionProposalCard` sibling.
   - Recommendation: Planner's call; a thin sibling reusing `lineDiff` + `ProviderScoreboard` keeps the
     SI-01 card's honesty locks untouched. Either satisfies D-09.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase local (Postgres :54322) | Migration 090 apply + route tests | ✓ (dev default) | 15.x | None — required to apply/verify the migration |
| Redis (docker-compose.dev.yml) | Tuner run buffer (existing path) | ✓ (dev default) | 7.x | None — Tuner already depends on it (no new use) |
| ≥2 configured LLM providers (OpenAI/Anthropic/Google/OpenRouter) | Cross-provider scoreboard (SC#10, D-12) | ✓ via `app_settings`/Settings UI | — | For UAT, ≥2 provider keys must be configured (the Tuner already requires this) |
| `scripts/regenerate-full-schema.sh` | Post-migration schema regen | ✓ | — | None — mandated by migration discipline |

**Missing dependencies with no fallback:** None for implementation. **For UAT** (D-12), at least 2
provider keys must be configured in Settings so the scoreboard has ≥2 columns — this is the SAME
prerequisite the shipped Tuner already has, not new.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework (backend) | pytest 9.0.2 (`backend/pytest.ini`), asyncio tests |
| Framework (frontend) | vitest (existing; note pre-existing rot per SEED-056 — new tests must pass at HEAD) |
| Backend test dir | `backend/tests/` (`unit/`, `integration/`) |
| Existing sibling tests | `tests/test_skill_proposals.py`, `tests/test_skill_proposals_router.py`, `tests/integration/test_skill_tuner_routes.py`, `tests/unit/test_skill_tuner_service.py` |
| Quick run command | `cd backend && ./venv/Scripts/python -m pytest tests/test_skill_proposals_router.py -x -q` |
| Full backend suite | `cd backend && ./venv/Scripts/python -m pytest -q` |
| Frontend | `cd frontend && npm run test -- --run src/components/skills/studio/ProposalCard.test.tsx` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| SI-02 | Propose a description draft (kind='description') from a Tuner winner; NEVER auto-publish, NEVER edit the live description | integration | `pytest tests/integration/test_140_description_proposals.py::test_propose_creates_draft_no_live_write -x` | ❌ Wave 0 (mirror `test_skill_proposals_router.py::test_propose_owner_can_draft`) |
| SI-02 | Baseline wins → 400 "nothing to propose" (honest-by-construction, D-02) | integration | `pytest .../test_140_description_proposals.py::test_baseline_winner_refuses_propose -x` | ❌ Wave 0 |
| SI-02 | Approve → `skills.description` written + new immutable version + status='promoted' | integration | `pytest .../test_140_description_proposals.py::test_approve_writes_desc_and_version -x` | ❌ Wave 0 |
| SI-02 | Reject → nothing changes (pure audit flip, `new_skill_version_id` NULL) | integration | `pytest .../test_140_description_proposals.py::test_reject_is_pure_audit -x` (mirror `test_reject_is_pure_audit_via_route`) | ❌ Wave 0 |
| SI-02 | Cross-user 404-not-403 on propose/approve/reject | integration | `pytest .../test_140_description_proposals.py::test_cross_user_404 -x` (mirror `test_cross_user_404`) | ❌ Wave 0 |
| SI-02 | Migration 090: kind-gated CHECK rejects a `kind='description'` row with NULL `proposed_description` | unit/DB | `pytest tests/test_140_migration_090.py::test_kind_check_constraint -x` | ❌ Wave 0 (requires migration applied to live DB) |
| SI-02 | Frontend: baseline-winner card shows "nothing to propose", rewrite-winner shows "Propose this description" | frontend unit | `npm run test -- --run …ProposalCard…` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pytest tests/integration/test_140_description_proposals.py -x -q`
- **Per wave merge:** `cd backend && pytest -q` + `cd frontend && npm run test -- --run`
- **Phase gate:** Full backend suite green + the 4-axis UAT (below) before `/gsd:verify-work`.

### 4-Axis UAT Bandwidth (D-12 / SC#10 — authored in VALIDATION.md, driven live via Chrome MCP + psycopg2)
Each row is an observable pass/fail (what the DB / UI shows), not a subjective check:

- **Cross-provider (≥2 providers):** Configure ≥2 provider keys. Run the Tuner on a skill; a candidate
  beats the baseline on the held-out per-provider scoreboard on **both** providers. Propose → approve.
  **PASS:** `skill_proposals.scoreboard_snapshot` contains ≥2 provider cells; the promoted
  `skills.description` == `proposed_description`; a new `skill_versions` row exists. **FAIL:** snapshot
  has <2 columns, or a provider-specific fork appears in the diff.
- **Honest-by-construction ("baseline wins → nothing to propose"):** Run the Tuner on a skill whose
  current description already wins the held-out score (`winner.is_baseline=true`). **PASS:** the UI
  shows "you're already running the best description" and NO "Propose" affordance; `POST .../proposals`
  (if forced) returns 400; zero `skill_proposals` rows created. **FAIL:** a proposal with
  `proposed_description == base description`, or an empty diff, is created. (Reference:
  `CandidateCard.tsx:52` `isActionableWinner`.)
- **Parallel-thread isolation:** Propose+approve on skill A while an unrelated Tuner run streams on
  skill B (or a chat thread streams). **PASS:** skill A's proposal/version/description are correct and
  unaffected; skill B's run completes normally; no cross-skill `scoreboard_snapshot` bleed; no event
  loop stall (all supabase-py calls threadpool-wrapped). **FAIL:** either operation blocks/corrupts the
  other.
- **Long-history:** Propose+approve on a skill with many prior `skill_versions` + prior
  `skill_proposals`. **PASS:** `base_skill_version_id` resolves to the true latest version;
  `new_skill_version_id = MAX(version_number)+1`; the card renders without perf regression; history
  ordering intact. **FAIL:** wrong base version, version-number collision (23505), or a slow render.

### G-4 Lived-Experience Scenarios (proposal card — user-visible UI)
- Approve a proposal → the live skill description visibly updates AND a new version appears in the
  Versions tab (one version, not two — Pitfall 2 guard).
- Reject a proposal → the card dismisses, the live description is unchanged, no version added.
- Re-run the Tuner after proposing (before approving) → the PENDING proposal's scoreboard does NOT
  change (snapshot immutability — Pitfall 1 guard).

### Wave 0 Gaps
- [ ] `backend/tests/integration/test_140_description_proposals.py` — propose/approve/reject/404 (mirror `test_skill_proposals_router.py`)
- [ ] `backend/tests/test_140_migration_090.py` — kind-gated CHECK + nullable `proposed_instructions` (requires migration applied to live DB)
- [ ] `frontend/src/components/skills/studio/*.test.tsx` — description-proposal card (baseline-wins vs rewrite-winner branches)
- [ ] Shared fixtures: reuse existing `conftest` skill/user fixtures + the tuner-scoreboard fixture from `test_skill_tuner_service.py`

*(Framework already installed — no install step. Note the phase number in test filenames should track
the actual phase folder `139`; examples above use `140` only illustratively — planner: use `139`.)*

## Security Domain

`security_enforcement` is absent in `.planning/config.json` → **enabled** (section required).

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (inherited) | `get_current_user` dependency on every route (existing) |
| V3 Session Management | no | No new session surface |
| V4 Access Control | **yes (primary)** | Owner-scoped `_verify_owned_skill` / `.eq("user_id")` on EVERY read/write; 404-not-403 on cross-user (T-135-01 precedent). `get_supabase()` is service-role (RLS bypassed) → the app-code owner filter is the SOLE runtime gate; owner-only RLS SELECT is defense-in-depth (083 precedent). |
| V5 Input Validation | yes | Pydantic bodies (`kind` restricted; `source_tuner_run_id`/`proposal_id` typed UUID → malformed → 404 not error-leak). Diff/description render as React text nodes (no raw-HTML sink — T-137-05). |
| V6 Cryptography | no | No crypto surface |

### Known Threat Patterns for {FastAPI service-role + RLS + owner-scope}
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| IDOR — approve/reject another user's proposal | Elevation of Privilege | Verify proposal on `id` AND `user_id` AND `skill_id` BEFORE any write; 404 not 403 (mirror `evals.py:1008-1025`). |
| Cross-user existence leak | Information Disclosure | 404 (never 403) on any owner miss; malformed UUID → 404, never leak the error shape (`skill_tuner.py:196-202`). |
| Forged `user_id`/`skill_id` in body | Spoofing | `user_id` from the auth token, `skill_id` from the path — NEVER the request body (T-135-02). |
| `source_tuner_run_id` pointing at another user's tuner run | Tampering/Disclosure | On propose, verify the referenced `tuner_runs` row is owner-or-global-skill-scoped (`_fetch_owned_or_global_skill` pattern) before snapshotting; the snapshot then decouples from the FK. |
| Prompt-injection via a malicious description into the model catalog | Tampering | The winner is a MEASURED Tuner candidate rendered as DATA in the catalog line (`- **{name}**: {desc}`), same surface the Tuner + `agent_loop` already use — no new injection vector; render as text (no HTML sink). |
| Event-loop DoS via blocking supabase-py | Denial of Service | `run_in_threadpool` on every supabase-py call (D-v2.5-01). |

## Sources

### Primary (HIGH confidence — read on disk this session)
- `supabase/migrations/083_skill_proposals.sql` — table shape, 7-value status enum, RLS, `proposed_instructions NOT NULL`, `source_eval_run_id`
- `supabase/migrations/079_skill_versions_and_test_cases.sql` — `skill_versions` (`description` at :50), `capture_skill_version` trigger (fires on `NEW.description IS DISTINCT FROM OLD.description` :113-116; `source='manual'` :132), append-only block (:151-166), `source` enum (`manual/import/tuner/self_improve/backfill`)
- `supabase/migrations/077_tuner_runs.sql` — `UNIQUE(skill_id)` latest-wins, `scoreboard jsonb` (holds winner_description + candidates + cells), no dedicated winner column
- `backend/app/api/skill_tuner.py` — `_run_tuner_job` (:371), scoreboard construction (:560-566), `_persist_latest` upsert `on_conflict="skill_id"` (:619), `get_latest_tuner_run` (:817), `get_tuner_results` (:876); confirms NO dedicated apply-PATCH here
- `backend/app/api/evals.py` — SI-01 propose (:695), reject (:991), approve (:1459), `_proposal_response` (:671), open/inflight guards (:604-605), owner-verify/404 pattern
- `backend/app/api/skills.py:384` — `update_skill` `PATCH /skills/{id}` (the description-write path that fires the trigger)
- `backend/app/models/eval_run.py` — `ProposeBody` (:109), `SkillProposalResponse` (:152), `PromotionGate` (:128)
- `frontend/src/pages/SkillTunerPage.tsx` — `handleConfirmWinner` (:461-466) = `updateSkill({description})`; `CandidateCard onConfirm` (:790)
- `frontend/src/components/skills/tuner/CandidateCard.tsx` — `isActionableWinner = isWinner && !candidate.is_baseline` (:52); the "Use"/"★" affordance SI-02 replaces
- `frontend/src/components/skills/studio/{TriggeringTab,ProposalCard}.tsx` — Triggering tab mounts `SkillTunerPage(embedded)`; render-only proposal card using `lineDiff`
- `frontend/src/lib/lineDiff.ts` + `frontend/src/lib/api.ts` (:1874-1973 proposals, :3161-3209 tuner) — local diff util + wire functions
- `ls supabase/migrations/` — **089 is the highest number → 090 is next** (CONTEXT.md's 087/088 is stale)
- `.planning/config.json` — `nyquist_validation: true`; `security_enforcement` absent (enabled)

### Secondary (MEDIUM confidence)
- `.planning/phases/139-.../139-CONTEXT.md` — locked decisions D-01..D-16
- `.planning/REQUIREMENTS.md:45` — SI-02 requirement text
- `CLAUDE.md` — migration discipline, no-LangChain, Pydantic structured outputs, RLS, provider-docs-first, G-1..G-6 guardrails
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` (referenced, D-15) — design-locked Tuner scoreboard / SI-01 proposal card / Studio Triggering tab

### Tertiary (LOW confidence)
- PostgreSQL `ON CONFLICT DO UPDATE` id-preservation semantics (A1) — training knowledge, not re-verified live; does not affect the recommendation.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every module read on disk; no new packages.
- Architecture / seams: HIGH — the FK-vs-snapshot and version-write decisions are grounded in the exact `tuner_runs` UNIQUE constraint + upsert call and the 079 trigger body.
- Migration number: HIGH — `ls` confirms 089 is latest; 090 is next.
- Version-attribution discretion: MEDIUM — the `manual` recommendation is safe; the `self_improve` alternative needs operator sign-off.
- Pitfalls / validation: HIGH — pitfalls derive from verified constraints; test map mirrors existing sibling tests.

**Research date:** 2026-07-06
**Valid until:** 2026-08-05 (stable internal surface; re-confirm the migration number if other phases land migrations first)
