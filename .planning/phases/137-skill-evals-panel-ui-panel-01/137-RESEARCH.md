# Phase 137: Skill Evals Panel UI (PANEL-01) - Research

**Researched:** 2026-07-03
**Domain:** React SPA consolidation UI (Skill Studio) over a fully-shipped eval/versioning/gate backend
**Confidence:** HIGH (the entire consumed surface is in-repo and verified by direct read; zero external dependency)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions (verbatim from 137-CONTEXT.md `<decisions>`)

**Locked design contracts (sketches 053–057 — operator-approved 2026-07-03, commit `be4a7016`):**

- **D-01 Shell (053-A + 057-A):** ONE focused full-surface Studio. Net-new `skill-studio` `ActiveView` value **with a tab param**; the old `skill-tuner` value **redirects** (no orphan Tuner surface). `‹ Skills` returns preserving the selected skill + panel state (041-A contract). Landing tab = **Evals**. Persistent header on every tab: skill name + vN + LIVE badge + a compact one-line gate strip.
- **D-02 Tuner absorption:** the shipped Trigger Tuner mounts **unmodified** inside the Triggering tab — `SkillTunerPage` internals untouched (041/042/043/045 winners intact).
- **D-03 Status = the 054-B lifecycle stepper** (Cases → Eval → Gate → Published): counts live ON their stage nodes; ONLY the current stage narrates itself in one message box; `passed_on_older_version` reads as "the passing eval is stale — it measured vN-1, the live skill is vN"; the ⚡ collision (gate met on an earlier passing run + newest run failed) renders as a met Gate node WITH the Eval node carrying the newest run's honest count; the Publish button mirrors the server gate (one source of truth); the force-publish override record ALWAYS renders (amber receipt, never softens). The header gate strip is a CONDENSATION of the same server `PublishGate` — never a second truth-teller.
- **D-04 Run history = 055-B expandable rows:** provider logo (048 `@lobehub/icons` map) + model + version binding + honest rollup per row; rows expand IN PLACE to per-case detail — side-by-side WITH/WITHOUT arms, judge verdict chip + score + reason, token counts, "your rating" thumbs labeled DISTINCT from the judge's verdict. Honest state set is load-bearing: `not_measured` = excluded-never-failed (rollup appends "· N not measured" when measured < case_count); `judge_error` = neither pass nor fail; interrupted run = banner + re-run affordance; running run = live per-arm progress with NO mid-run verdicts.
- **D-05 Versions tab = 056-B table + compare picker:** scan-first table (version · origin chip · eval-on-this-version binding · date, LIVE badged) + explicit any-to-any Compare v[x] ↔ v[y] rendering ONE unified diff (**reuse the 135 `lineDiff` util**). Provenance chips derive from `SkillVersion.source` (verify real enum values at plan time). The force-promoted version's failed `PromotionGate` evidence stays visible un-softened. **"Restore" is deliberately ABSENT** (versions immutable, VER-01).
- **D-06 Nav contract (the 057 MAP):** the 044-A lint "Tune this →" RE-POINTS to Studio·Triggering; the 136 `PublishGateDialog` gains ONE net-new "Review evals →" link on the unmet branch → Studio·Evals; tabs are deep-linkable (panel gate/status → Evals, lint → Triggering, version row → Versions).
- **D-07 Detail-panel slim-down:** `SkillEvalSection` + `SkillTestCasesSection` LEAVE the edit dialog; the panel keeps the edit form + a status section + "Open studio" + counts.

**Proposal-loop home:**
- **D-08:** The active 135 propose→review→approve card lives in the **Evals tab, below the run history, lightly re-skinned** — flow untouched, chrome aligned to the Studio design. All 135 honesty locks preserved (proposer rationale + evidence, `PromotionGate` counts, `override_forced` record, honest `interrupted — not promoted`). Proposal STATE also composes into the 054-B status read — never a second truth-teller.
- **D-09 (folded):** **Post-run nudge** — when a finished run has ≥1 failed measured case, an inline "Propose an improvement?" affordance (on the run row / stepper current-stage message) jumps to the existing propose action. Behavior-minimal pointer to existing machinery.

**Slim panel status composition:**
- **D-10:** The slimmed 384px detail panel's status section renders the **FULL 054-B lifecycle stepper** — it dissolves the "Publish ready 1/1 vs 0/2 cases" contradiction where the operator first hit it. The one-line gate strip belongs to the Studio header only. Build the stepper as ONE shared component consumed by both surfaces (one truth-teller, two homes).

**Case editor + run launch:**
- **D-11:** Cases are **prompt-first, no schema change**: every case row (editor, run detail, stepper counts) leads with its prompt text (truncated one-line), `expected_behavior` as the quiet second line; the uuid disappears from the UI (detail/debug only). Closes BUG-260701-02 deferred half. NO new label column, NO migration.
- **D-12:** Run launch = a **compact run bar directly above the run-history list** in the Evals tab (provider/model picker + Run); the live run appears as the top expandable row (055-B running state). Picker selection stays preserved across skills.

**Deferred:**
- **D-13 (deferred):** The consumer-facing "unverified" chip for force-override-published skills does NOT fold into 137. Re-open trigger: first real multi-user global-skill consumption, or SEED-099 scoping. The owner-visible override record ships in the stepper (D-03) regardless.

**Locked constraints (restated):**
- **D-14 SC#10 applies** (UI state axis). The 4-axis UAT rows (cross-provider representative-4 × multi-tool × parallel-thread × long-message) are authored in **VALIDATION.md, NOT PLAN tasks**. G-4 lived-experience scenarios on the Studio (full state-matrix sweep).
- **D-15 Additive / red line:** frontend-heavy phase. Backend surface is read-only consumption of existing endpoints. The ONE candidate net-new read is the version-list eval-binding join (one query or client-side join — planner picks). NO migration. NO `threads.py` / `agent_loop.py` / provider-gateway touch; Deep Mode byte-identical. Eval SSE / heartbeat / re-attach machinery reused unchanged.
- **D-16 G-5 audit:** none of 137's files are on the hot-file ledger. No G-5 fire.

### Claude's Discretion (verbatim from CONTEXT.md)
- Deep-link/tab-param mechanics — how `skill-studio` + tab + skill id thread through `ActiveView`/App state (the `skill-tuner` mount branch is the precedent), and how the old `skill-tuner` value redirects.
- Evals-tab composition detail at Studio width (stepper top per #45; cases/run-bar/history/proposal ordering per 053-A's two-column intent, adjusted for Versions being its own tab).
- The version-list eval-binding read (one query vs client-side join over existing endpoints) + verifying the real `SkillVersion.source` enum values.
- Exact re-skin treatment of the proposal card (bounded by D-08).
- Live-run behavior on navigate-away/return: reuse existing `subscribeToRun` re-attach + durable re-fetch; whether the stepper's Eval node shows a "running" state mid-run.
- Component decomposition + which existing SkillEvalSection/SkillTestCasesSection handlers are lifted vs re-written ("lift state, re-skin render").

### Deferred Ideas (OUT OF SCOPE — verbatim from CONTEXT.md)
- Consumer-facing "unverified" chip on global SkillCards (D-13) — re-open trigger above.
- Edit-before-approve (editable proposal diff) — Phase 139 / SI-02 territory.
- Multi-candidate proposals — Phase 139 / SI-02.
- Optional case name/label column (migration) — only if prompt-first labels prove insufficient for large benchmarks.
- Chat → Studio links (a skill firing in chat) — declared OUT by the 057 contract; future chat-surface phase.
- Backend run-reconciliation on restart (BUG-260702-02) — SEED-100; 137 only renders the honest interrupted display + re-run affordance.
- `spike-nl-workflow-authoring` todo — NOT folded (already satisfied by Phase 103).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PANEL-01 | The Skills UI has a Skill Evals panel that surfaces: test case editor (add/edit/delete cases), eval run history list, run detail view (per-case side-by-side outputs + pass/fail), inline rating controls, and version history (diff-viewable). (G-2 sketch-gated; additive — no full Skills-tab redesign.) | Every named subsurface maps to an already-served endpoint + an already-typed client fn + a working handler in the current thin UI. See `## Standard Stack`, `## Architecture Patterns`, and the Component Responsibilities table. The G-2 bar = sketches 053–057 (winners locked). The "no redesign" exclusion = additive Studio + deliberate detail-panel slim-down (D-07) only. |

**Requirement → success-criteria mapping (from ROADMAP Phase 137):**
1. Studio surfaces test-case editor (add/edit/delete) + run history list + per-run detail (side-by-side + pass/fail). → covered by `SkillTestCasesSection` CRUD + `listEvalRuns`/`getEvalRun` (055-B rows).
2. Inline rating controls (thumbs) on eval outputs in context (EVAL-04). → `rateEvalResult` PUT + existing `handleRate` (already IDOR-hardened server-side).
3. Diff-viewable version history to compare instruction versions (VER-01). → `listSkillVersions` + `lineDiff` (056-B table + compare picker).
4. Existing Skills tab otherwise unchanged; matches operator-approved sketch (G-2 bar). → additive `skill-studio` ActiveView + slim-down; sketches 053–057 are the acceptance bar.
</phase_requirements>

## Summary

Phase 137 is a **pure frontend consolidation phase**. Every capability PANEL-01 requires is already implemented and shipping today in a deliberately-undesigned form (the 924-line `SkillEvalSection.tsx` + the 217-line `SkillTestCasesSection.tsx`, both stacked inside the skill edit dialog in a ~384px panel — the operator's "messy UI" complaint). The backend is complete and secured (Phases 132–136): every endpoint the Studio consumes is served, every response is owner-scoped, and **the full TypeScript client (`api.ts`) + type mirrors (`types/index.ts`) already exist** for all of it. There is **no migration, no new backend route** (with one optional, additive-only exception — the version→eval-binding join, which can be done client-side over two existing endpoints).

The work is: (1) build the `skill-studio` `ActiveView` surface exactly mirroring the shipped `skill-tuner` precedent (App.tsx state + a ChatLayout mount branch, no router), (2) **lift the existing state/handlers and re-skin the render** into the operator-approved sketch structure (053-A shell · 054-B stepper · 055-B expandable rows · 056-B version table + compare · 057-A header + 3 tabs), (3) absorb `SkillTunerPage` unmodified as the Triggering tab, (4) slim the detail panel by moving the eval/test-case sections out and adding a shared stepper + "Open studio", and (5) wire the 057 navigation MAP (lint "Tune this →" re-point, PublishGateDialog "Review evals →").

**Primary recommendation:** Treat `SkillEvalSection.tsx` as the machinery source of truth — its `subscribeToRun` re-attach self-heal, `loadReadout` durable fetch, skill-switch guards (`currentSkillRef`), proposal lifecycle handlers, and gate hydration are all correct and battle-tested (survived 133/134/135/136 live UAT). Decompose it into presentational components under a Studio shell; do NOT rewrite the run/SSE/reconcile logic. Verify the `SkillVersion.source` enum before writing the provenance-chip mapping (it is **not** what sketch 056 assumed — see the "Version provenance" pitfall).

## Architectural Responsibility Map

This is a client-side SPA (React + Vite, **no router** — navigation is `useState<ActiveView>`). No SSR tier. The backend owns all persistence, gate computation, and honest-verdict math; the client renders server truth and never recomputes it.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Studio shell + tab routing + skill-tuner redirect | Browser/Client (React `useState<ActiveView>`, App.tsx) | — | No router in this app; the `skill-tuner` branch is the exact precedent (D-01). |
| Test-case CRUD (add/edit/delete) | API/Backend (`skill_test_cases.py`) | Client (render + optimistic-free refetch) | Owner-scoping is the sole runtime gate (service-role client bypasses RLS). |
| Eval run launch + live per-arm progress | API/Backend (`evals.py` + `eval_runner_service` + eval_* SSE) | Client (`subscribeToRun` re-attach) | No new eval runtime (D-15); client only subscribes. |
| Run history list + per-case detail render | Client (renders durable `getEvalRun` readout) | API/Backend (durable DB readout) | Readout survives Redis TTL; client is pure presentation. |
| Inline ratings (thumbs) | API/Backend (`PUT …/rating`, IDOR-404 hardened) | Client (toggle → refetch) | Rating is a server write; client never stores a separate truth. |
| Version history + diff | Client (`lineDiff` is client-side) | API/Backend (`GET …/versions`) | Diff is pure client compute over two served instruction bodies. |
| Publish gate status / stepper / header strip | API/Backend (`publish_gate_service` computes `met`) | Client (renders, NEVER recomputes — D-07/054 lock) | One truth-teller: every status surface condenses the SAME server `PublishGate`. |
| Self-improve proposal loop | API/Backend (`evals.py` proposal routes) | Client (render + refetch-not-optimistic) | Human-in-the-loop; all state is the reconciled DB row. |

## Standard Stack

**No external packages are installed in this phase.** Every library the Studio needs is already a project dependency and already imported by the surfaces being consolidated. This is a code-composition phase, not a dependency phase.

### Core (all already installed + in use)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react | (project pin) | Studio shell + tab state + all components | Project stack; `ActiveView` state pattern is the app-wide nav convention `[VERIFIED: App.tsx, ChatLayout.tsx]` |
| vite + vitest | (project pin) | Build + component test runner (`vitest run`) | Project test script is `"test": "vitest run"` `[VERIFIED: frontend/package.json]` |
| tailwind + shadcn/ui | (project pin) | Aether Deep Midnight design system primitives | Project design system; sketch theme is a direct port of `index.css :.dark` `[CITED: sketch-findings-agentic-rag SKILL.md]` |
| lucide-react | (project pin) | Icons (Play, ThumbsUp/Down, Sparkles, Loader2, …) | Already imported by `SkillEvalSection.tsx` `[VERIFIED: import block lines 20-30]` |
| @lobehub/icons | (project pin) | Provider/model logos on run rows (048 map, D-04) | Installed; single-source icon convention (Phase 127/128) `[VERIFIED: providerLogo.tsx exists, `providerLogo(provider)` exported]` |

### Supporting (in-repo utilities — reuse, do not rebuild)
| Utility | Location | Purpose | When to Use |
|---------|----------|---------|-------------|
| `lineDiff` | `frontend/src/lib/lineDiff.ts` | Unified line diff (add/remove/context rows) | Version compare (056-B) AND the proposal card diff (D-05/D-08). Already used in `SkillEvalSection`. `[VERIFIED]` |
| `providerLogo(provider)` | `frontend/src/lib/providerLogo.tsx` | Returns `ProviderMark \| null` | Run-row avatars (D-04). `[VERIFIED: line 89]` |
| `subscribeToRun` | `frontend/src/lib/api.ts` | Existing chat-run SSE client carrying eval_* events | Live run progress + re-attach (Pattern 3 — NO new stream code). `[VERIFIED]` |
| `useResizablePanel` | `frontend/src/hooks/useResizablePanel.ts` | Resizable side-rail width persistence | The slimmed detail panel already uses it (`skills-detail-panel-width`). `[VERIFIED: SkillsPage.tsx:36]` |
| `useSkills` | `frontend/src/hooks/useSkills.ts` | Skill list + `updateSkill` (PATCH /skills/{id}) | Studio header skill identity + the Tuner's author-confirm write. `[VERIFIED: SkillTunerPage.tsx:90]` |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Client-side version→eval join | Net-new server endpoint returning versions-with-bindings | Server route is one extra file + tests + owner-scoping; client join is zero backend change and both source endpoints already exist. **Recommend client-side join** (keeps D-15 additive, no migration). Only go server-side if a version list grows past hundreds of rows (not a current concern — single-operator). |
| Reusing `SkillEvalSection` handlers | Rewriting run/SSE logic fresh | Rewriting re-introduces the exact bugs already fixed (BUG-260702-03 re-attach race, BUG-260701-02 skill-switch stale state, the d0c0c10a heartbeat/terminal fixes). **Lift, don't rewrite.** |

**Installation:** None. `npm install` runs zero new packages for this phase.

## Package Legitimacy Audit

**N/A — this phase installs no external packages.** All dependencies (`react`, `vitest`, `tailwind`, `shadcn/ui`, `lucide-react`, `@lobehub/icons`) are pre-existing project dependencies already imported by the surfaces being consolidated. slopcheck/registry verification is not applicable because the phase adds no `package.json` entries.

*If a plan unexpectedly proposes a new package (it should not), gate it behind a `checkpoint:human-verify` task and run the Package Legitimacy Gate before install.*

## Architecture Patterns

### System Architecture Diagram

```
                            SKILLS SURFACE (React SPA, no router)
                            ================================================

  [Skills nav item] ──► SkillsPage (3-pane: list · resize · detail panel)
                              │
                              ├─ SkillCard ──► "Share globally" ──► PublishGateDialog
                              │                                        │ (unmet branch)
                              │                                        └─► "Review evals →" ─┐
                              │                                                              │
                              └─ Detail panel (SLIMMED, D-07):                               │
                                    edit form                                                │
                                    + Status section = <LifecycleStepper> (054-B, SHARED) ───┼─(deep-link)─┐
                                    + "Open studio" ──────────────────────────────┐          │             │
                                    + counts                                       │          │             │
                                                                                   ▼          ▼             ▼
   App.tsx  setActiveView("skill-studio", {skillId, tab})  ◄──────────  handleOpenStudio(skillId, tab)
        │
        ▼
   ChatLayout: activeView === "skill-studio" branch  (mirrors the skill-tuner branch)
        │
        ▼
   ┌──────────────────────────  SKILL STUDIO (focused full-surface, 041-A)  ─────────────────────────┐
   │  Persistent header (057-A):  ‹ Skills   |  skill name · vN · LIVE badge · one-line gate strip     │
   │  ─────────────────────────────────────────────────────────────────────────────────────────────  │
   │  [ Evals ]   [ Triggering ]   [ Versions ]      ◄── tab param, deep-linkable                      │
   │                                                                                                   │
   │  EVALS tab (landing):                    TRIGGERING tab:            VERSIONS tab:                  │
   │   <LifecycleStepper> (SHARED, top)        <SkillTunerPage>           <VersionTable> (056-B)        │
   │   <RunBar> picker+Run (D-12) ──►API POST   MOUNTED UNMODIFIED         rows: v# · origin chip ·     │
   │   <RunHistory> 055-B expandable rows       (D-02, internals            eval-binding · date · LIVE  │
   │     row ──►GET runs, expand──►GET run/{id}   untouched)               <ComparePicker> v[x]↔v[y]    │
   │       side-by-side WITH/WITHOUT arms                                    └─►lineDiff(one unified)   │
   │       judge chip+score+reason, tokens                                                              │
   │       thumbs (your rating) ──►PUT rating                                                           │
   │   <ProposalCard> (D-08, re-skinned) ──►POST/approve/reject/rerun/force-promote                     │
   └───────────────────────────────────────────────────────────────────────────────────────────────┘
                                          │
                                          ▼
                            eval_* SSE via subscribeToRun (Pattern 3, re-attach self-heal)
                            durable readout via getEvalRun (survives Redis TTL)
```

### Recommended Component Structure

```
frontend/src/
├── App.tsx                              # ADD "skill-studio" to ActiveView; add studioSkillId+studioTab state
│                                        #   + handleOpenStudio; redirect legacy "skill-tuner" → studio?tab=triggering
├── components/layout/ChatLayout.tsx     # ADD skill-studio mount branch (mirror the skill-tuner branch :316-324)
├── pages/
│   └── SkillStudioPage.tsx              # NET-NEW: header + tab chrome + 3 tab bodies
├── components/skills/
│   ├── studio/
│   │   ├── LifecycleStepper.tsx         # NET-NEW SHARED (054-B, D-03/D-10): consumed by Studio header
│   │   │                                #   condensation AND the slim detail panel status section
│   │   ├── EvalsTab.tsx                 # lifts SkillEvalSection run/SSE/proposal STATE, re-skins render
│   │   ├── RunBar.tsx                   # provider/model picker + Run (D-12)
│   │   ├── RunHistory.tsx               # 055-B expandable rows (provider logo + rollup)
│   │   ├── RunCaseDetail.tsx            # side-by-side arms + judge block + labeled thumbs
│   │   ├── ProposalCard.tsx             # D-08 re-skin of the existing proposal render
│   │   ├── VersionsTab.tsx              # 056-B table + compare picker
│   │   └── TriggeringTab.tsx            # thin wrapper mounting <SkillTunerPage> unmodified (D-02)
│   ├── SkillEvalSection.tsx             # SOURCE of lifted logic (see Don't Hand-Roll)
│   ├── SkillTestCasesSection.tsx        # SOURCE of CRUD handlers; moves OUT of the edit dialog (D-07)
│   ├── SkillFormDialog.tsx              # REMOVE the two section mounts (:535-550); ADD stepper + "Open studio"
│   └── PublishGateDialog.tsx            # ADD "Review evals →" on the unmet branch (D-06)
└── pages/SkillTunerPage.tsx             # UNCHANGED (absorbed by reference, not edited)
```

### Pattern 1: ActiveView focused full-surface (no router) — the D-01 shell
**What:** App holds a selected-skill id + a target-view; a handler sets both, then flips `activeView`. ChatLayout renders a dedicated branch. `‹ Back` calls `onNavigate("skills")`.
**When to use:** The Studio shell + the legacy `skill-tuner` redirect.
**Example (the shipped precedent this phase clones):**
```tsx
// Source: frontend/src/App.tsx (lines 9, 21-25) — VERIFIED
export type ActiveView = "chat" | "documents" | "skills" | "settings" | "library-health"
  | "workflows" | "classification-rules" | "governance" | "skill-tuner"
//   ADD: | "skill-studio"

const [tunerSkillId, setTunerSkillId] = useState<string | null>(null)
const handleTuneSkill = (skillId: string) => {
  setTunerSkillId(skillId)
  setActiveView("skill-tuner")
}
// Studio analog: add studioSkillId + studioTab state + handleOpenStudio(skillId, tab).
// Legacy redirect: keep handleTuneSkill but route it to setActiveView("skill-studio")
// with tab="triggering" (no orphan Tuner surface — D-01).
```
```tsx
// Source: frontend/src/components/layout/ChatLayout.tsx (:316-324) — VERIFIED
) : activeView === "skill-tuner" ? (
  <SkillTunerPage skillId={tunerSkillId} onBack={() => onNavigate("skills")} />
) : (
  <KnowledgeHealthPage />
)
// ADD an analogous `activeView === "skill-studio"` branch BEFORE the trailing else,
// rendering <SkillStudioPage skillId={studioSkillId} tab={studioTab}
//   onTabChange={...} onBack={() => onNavigate("skills")} />
```

### Pattern 2: Lift state, re-skin render (053 build handover)
**What:** Move the working stateful logic out of the thin component into a Studio-level hook/component, then render it with the sketch-approved chrome. The logic is correct; only the markup changes.
**When to use:** `SkillEvalSection` → `EvalsTab` (+ RunBar/RunHistory/RunCaseDetail/ProposalCard); `SkillTestCasesSection` → the case editor inside the Evals tab.
**Why:** The run/SSE/reconcile logic encodes four phases of hard-won live-UAT fixes. See `## Don't Hand-Roll`.

### Pattern 3: Existing-stream reuse (no bespoke EventSource)
**What:** Eval runs write a companion `public.runs` row, so the existing `subscribeToRun` chat-run stream client carries `eval_*` events (`onEvalCaseStarted`/`onEvalCaseDone`/`onEvalVerdict`/`onEvalComplete`/`onTerminal`) with zero new stream code. The **durable** readout always comes from `getEvalRun` (the DB), so it survives the Redis buffer TTL + reload.
**When to use:** All live-run rendering in the Evals tab. It is already wired in `SkillEvalSection.attach()` — lift it verbatim.
**Example:**
```tsx
// Source: frontend/src/components/skills/SkillEvalSection.tsx (:209-279) — VERIFIED
void subscribeToRun(rid, "0", {
  onEvalCaseStarted: ({ testCaseId, variant }) => setLive(...),   // "running"
  onEvalCaseDone:    ({ testCaseId, variant, status }) => setLive(...),
  onEvalVerdict:     ({ testCaseId, variant, verdictState, verdictPassed }) => setLive(...),
  onEvalComplete:    () => void loadReadout(rid),                 // DB is authoritative
  onTerminal:        async (kind, err) => { /* BUG-260702-03 bounded re-attach self-heal */ },
}, ctrl.signal)
```

### Pattern 4: Refetch-not-optimistic + skill-switch guard
**What:** Every mutation (rating, propose, approve, reject, force-promote, gate) calls the owner-gated endpoint THEN re-fetches from the DB. A `currentSkillRef` captures the active skill; any in-flight fetch bails before `setState` if the skill changed. This is the fix for BUG-260701-02 (the "same eval appeared under every skill" stale-state bug).
**When to use:** All Studio state that crosses a skill boundary — carry the `currentSkillRef` guard into every lifted handler.

### Anti-Patterns to Avoid
- **Recomputing `met` client-side.** The client renders `PublishGate` fields only; it never derives publish-readiness (D-07 / 054 one-truth lock). The stepper + header strip + Publish button all condense the SAME server gate.
- **Mid-run verdicts.** Verdicts land only at finalize (`onEvalComplete`/durable readout). A running row shows live per-arm progress, never a pass/fail (D-04, the 134/135 honesty lesson).
- **Fabricating a pass/fail for `not_measured`/`judge_error`.** These are distinct honest states — excluded-never-failed and neither-pass-nor-fail. Never color them as fail (D-04).
- **Editing `SkillTunerPage` internals.** The Triggering tab mounts it unmodified. Touching it re-opens the 041/042/043/045 winners (D-02) and risks the tuner's own live-run machinery.
- **Optimistic proposal/rating state.** The card can't show "promoted" unless the server reconciled it (T-135-04).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Live eval run streaming | A bespoke `EventSource` for eval events | `subscribeToRun` (Pattern 3) | Eval events ride the companion runs row; a fresh stream misses the heartbeat/terminal/re-attach contract shipped in d0c0c10a. |
| Transient stream-drop recovery | Painting an "error" end-state on drop | The lifted `onTerminal` bounded re-attach self-heal (`reattachRef`, ≤20, probes `getEvalRun`) | BUG-260702-03 — the eval job keeps computing server-side; a drop is not a failure. |
| Skill-switch stale state | Ad-hoc effect cleanup | The `currentSkillRef` + per-fetch `requestedSkill` guard | BUG-260701-02 — the exact bug that made one skill's eval appear under every skill. |
| Durable readout after Redis TTL | Caching stream events client-side | `getEvalRun` (reads eval_runs ⋈ eval_results from Postgres) | SC#3 — the readout must survive the buffer TTL + reload. |
| Instruction diff | A custom diff algorithm | `lineDiff` (already used for the proposal card) | Same util powers version compare (056) and the proposal diff (135) — one renderer, two homes. |
| Provider logos | Per-surface icon art | `providerLogo(provider)` (048 map) | Single-source icon convention (Phase 127/128); sketch Kimi/GLM/MiniMax placeholders are NOT shipped art. |
| Publish-readiness math | Client-side pass-count thresholding | `getPublishGate` fields (`met`/`state`/`passed`/`measured`/`last_override`) | The server (`publish_gate_service`) owns the real threshold + current-version binding (D-03/D-04); the client is one truth-teller. |
| Proposal lifecycle orchestration | Rewriting approve→re-eval→promote flow | The lifted `handleApprove`/`handleReject`/`handleRerun`/`handleForcePromote` | Each reconciles the DB row + re-attaches the companion re-eval run; proven live in Phase 135 U1-U11. |

**Key insight:** `SkillEvalSection.tsx` is not throwaway scaffolding — it is the correct, live-UAT-hardened engine wearing plain clothes. The phase's risk is *re-implementing* its logic while re-skinning; the discipline is to lift the state + handlers into Studio-level components and only rewrite the JSX.

## Runtime State Inventory

This is an **additive UI phase**, not a rename/refactor/migration. There is no stored-data rename, no OS-registered state, no secret/env change, no build-artifact rename. The one migration-like consideration:

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no schema change (D-11/D-15 explicitly avoid it). Test-case `name` column already exists (mig 079); D-11 is a display-only decision. | None |
| Live service config | None | None |
| OS-registered state | None | None |
| Secrets/env vars | None | None |
| Client nav-state "migration" | The legacy `"skill-tuner"` `ActiveView` value must **redirect** to `"skill-studio"` (tab=triggering) so no orphan Tuner surface remains (D-01). This is a code-level union change, not runtime state — but any deep-link/entry that set `"skill-tuner"` (the `handleTuneSkill` path + the SkillsPage "Tune triggers" action + the lint "Tune this →") must be re-pointed. | Re-point `handleTuneSkill`, the SkillsPage entry action, and the lint handoff to the Studio (D-06). No persisted state carries `"skill-tuner"` (it lives only in React `useState`, never serialized). Verified: `grep` shows `skill-tuner` only in App.tsx, ChatLayout.tsx, and the ActiveView union — no localStorage/URL persistence. |

**Nothing found in the four data/OS/secret/artifact categories — verified by direct read of the phase's file set + the `skill-tuner` grep.**

## Common Pitfalls

### Pitfall 1: Version provenance chip assumes an enum that doesn't exist
**What goes wrong:** Sketch 056 says provenance chips distinguish "created / manual edit / proposal-promoted / **forced-override**". The real `SkillVersion.source` DB CHECK enum is **`manual` / `import` / `tuner` / `self_improve` / `backfill`** — there is **no `forced` value**. A force-promoted version still has `source = 'self_improve'`; the "forced" fact lives on the **proposal row** (`SkillProposal.override_forced = true`), not the version.
**Why it happens:** The sketch build-handover explicitly flagged "verify the real enum values at plan time" — this is that verification landing.
**How to avoid:** Map the five real `source` values to chips (`manual`→hand-edited, `import`→imported, `tuner`→tuner-promoted, `self_improve`→proposal-promoted, `backfill`→original/migrated). To render the un-softened **force-promoted** evidence (D-05), **join the version to its proposal**: `listProposals(skillId)` returns rows with `new_skill_version_id` + `override_forced` + `gate` (PromotionGate). Match `proposal.new_skill_version_id === version.id`. This is a client-side join over two existing endpoints (no server change).
**Warning signs:** A plan task that reads `version.source === "forced"` — that branch is dead code.
**Source:** `[VERIFIED: backend/app/models/skill_version.py:8-11 docstring + DB CHECK; backend/app/models/eval_run.py SkillProposalResponse.override_forced]`

### Pitfall 2: Version→eval binding is not on the versions endpoint
**What goes wrong:** `GET /skills/{id}/versions` returns `SkillVersionResponse` only (id, version_number, name, description, instructions, source, created_at) — **no eval rollup**. The 056 table's "eval-on-this-version" column has no direct field.
**Why it happens:** The binding lives on the eval side: every `EvalRun` carries `skill_version_id`.
**How to avoid:** Client-side join — `listSkillVersions(skillId)` × `listEvalRuns(skillId)`, group runs by `skill_version_id`, surface each version's latest run rollup (`passed_count`/`measured_count`) or "never evaled". Both endpoints already exist and are already in `api.ts`. This is the D-15 "one candidate net-new read" and the recommendation is the client join (zero backend change).
**Warning signs:** A plan proposing a new `/versions-with-evals` endpoint + migration — unnecessary for current scale.
**Source:** `[VERIFIED: skill_test_cases.py:163 versions route returns SkillVersionResponse; eval_run.py EvalRun.skill_version_id]`

### Pitfall 3: The ⚡ collision is the acceptance test, not an edge case
**What goes wrong:** Rendering "Publish ready — eval passed 1/1" next to "0/2 with-skill cases passed" as a flat contradiction (the literal 136-UAT complaint). The gate is CURRENT-VERSION-bound (`passing_run_id` on an older version); the "0/2" is the NEWEST run.
**Why it happens:** Two different truth-tellers with no hierarchy.
**How to avoid:** The 054-B stepper is the fix — a met Gate node (bound to its passing run/version) WITH an Eval node carrying the newest run's honest count, each labeled with its `run · version` binding. `passed_on_older_version` state must read "the passing eval is stale — it measured vN-1, the live skill is vN." Build the stepper as ONE shared component (D-10) so the slim panel and the Studio header condense the identical `PublishGate`.
**Warning signs:** Two adjacent unlabeled numbers derived from different runs.
**Source:** `[VERIFIED: 054-one-truth-status/README.md; PublishGate.state literal union in skill.py:57]`

### Pitfall 4: Frontend test rot — author fresh, don't lean on rotted siblings
**What goes wrong:** ~14–17 frontend vitest tests are pre-existing ROT (fail at baseline AND HEAD — SEED-056). Copying a rotted test's setup propagates the rot.
**How to avoid:** Follow the Phase 136 pattern (`SkillEvalSection.test.tsx` header explicitly notes "Authored fresh — not leaning on a rotted sibling"): fully mock `@/lib/api`, render the component, assert server-driven renders. Keep new tests self-contained.
**Warning signs:** A new test importing a helper from a known-rotted spec.
**Source:** `[VERIFIED: SkillEvalSection.test.tsx:14-15; MEMORY project_frontend_vitest_rot]`

### Pitfall 5: PublishGateDialog navigation needs a callback thread
**What goes wrong:** The "Review evals →" link (D-06) must navigate from inside `PublishGateDialog` to the Studio·Evals tab, but the dialog is mounted deep (`SkillCard` :269, invoked from `SkillsPage`). A hard-coded navigation won't reach App's `setActiveView`.
**How to avoid:** Thread an `onReviewEvals(skillId)` (or reuse the `handleOpenStudio` navigator) callback: App → ChatLayout → SkillsPage → SkillCard → PublishGateDialog, exactly as `onTuneSkill` is threaded today (App.handleTuneSkill → ChatLayout → SkillsPage → SkillCard). The precedent prop-drill already exists.
**Warning signs:** A dialog trying to import App state directly.
**Source:** `[VERIFIED: SkillCard.tsx:269 PublishGateDialog mount; App.tsx onTuneSkill drill precedent]`

## Code Examples

### Backend endpoint inventory (all VERIFIED by direct read — every subsurface is served)
```
# Test cases (skill_test_cases.py)  [VERIFIED]
GET    /skills/{skill_id}/test-cases        → list[TestCaseResponse]   (owner-scoped, order_index ASC)
POST   /skills/{skill_id}/test-cases        → TestCaseResponse 201     (skill must be owned)
PATCH  /test-cases/{case_id}                → TestCaseResponse         (partial; 404 non-owned)
DELETE /test-cases/{case_id}                → 204
GET    /skills/{skill_id}/versions          → list[SkillVersionResponse] (version_number DESC, READ-ONLY)

# Eval runs + ratings (evals.py)  [VERIFIED]
POST   /skills/{skill_id}/evals/runs                    → 202 {run_id, skill_version_id, provider, model, case_count}
GET    /skills/{skill_id}/evals/runs/{run_id}           → {eval_run, eval_results[]}  (durable; ratings merged per-caller)
GET    /skills/{skill_id}/evals/runs                    → list[EvalRun]  (newest-first, owner-verified)
PUT    /skills/{skill_id}/evals/results/{result_id}/rating  → thumbs up/down/clear (IDOR-404 hardened)

# Publish gate (skills.py)  [VERIFIED]
GET    /skills/{skill_id}/publish-gate      → PublishGate {met, state, measured, passed, passing_run_id, reason, last_override}

# Self-improve proposals (evals.py)  [VERIFIED]
POST   /skills/{skill_id}/proposals                        → SkillProposalResponse
GET    /skills/{skill_id}/proposals                        → list[SkillProposalResponse]
GET    /skills/{skill_id}/proposals/{proposal_id}          → SkillProposalResponse
POST   /skills/{skill_id}/proposals/{proposal_id}/approve  → {re_eval_run_id, ...}
POST   /skills/{skill_id}/proposals/{proposal_id}/reject   → SkillProposalResponse
POST   /skills/{skill_id}/proposals/{proposal_id}/rerun    → {re_eval_run_id, ...}
POST   /skills/{skill_id}/proposals/{proposal_id}/force-promote → SkillProposalResponse
```

### Frontend client — every function already exists (no net-new api.ts, except the optional join)
```ts
// Source: frontend/src/lib/api.ts — ALL VERIFIED (line numbers)
getPublishGate(skillId)                              // :1616
listTestCases(skillId) / createTestCase / updateTestCase / deleteTestCase   // :1632-1668
listSkillVersions(skillId): Promise<SkillVersion[]>  // :1670  (no eval binding — join client-side)
startEvalRun(skillId,{provider,model}) / getEvalRun(skillId,runId) / listEvalRuns(skillId)  // :1689-1739
rateEvalResult(skillId, resultId, "up"|"down"|null)  // :1740
proposeImprovement / listProposals / getProposal / approveProposal / rerunProposalReeval
  / rejectProposal / forcePromoteProposal            // :1796-1896
```

### The real `SkillVersion.source` enum (provenance-chip source of truth)
```
"manual"       → hand-created or hand-edited version
"import"       → created via skill import (ZIP)
"tuner"        → promoted from a Trigger Tuner winner (042-A author-confirm)
"self_improve" → promoted from an approved 135 proposal (force-promoted rows ALSO carry this;
                 the "forced" fact is on SkillProposal.override_forced, NOT here — see Pitfall 1)
"backfill"     → original/migration backfill row
```
`[VERIFIED: backend/app/models/skill_version.py:8-11 + DB CHECK, migration 079]`

## State of the Art

| Old Approach (thin, 133/134/135/136) | Current Approach (137 Studio) | Impact |
|--------------------------------------|-------------------------------|--------|
| Eval UI stacked inside the skill edit dialog (~384px) | Focused full-surface Studio (041-A `ActiveView` switch) | Side-by-side WITH/WITHOUT gets real width; the "messy UI" complaint closes. |
| Gate status only inside PublishGateDialog + a plain panel line | 054-B lifecycle stepper (shared) + header gate strip + PublishGateDialog "Review evals →" | The gate becomes discoverable + the 1/1-vs-0/2 contradiction resolves. |
| `Case <uuid8>` opaque labels | Prompt-first case rows (D-11) | Closes BUG-260701-02 clarity half; no migration. |
| Trigger Tuner = standalone `skill-tuner` surface | Tuner = Triggering tab of the unified Studio (absorbed unmodified) | One skill-work home; no orphan surface. |
| Version history = plain read list (in SkillTestCasesSection) | 056-B table + any-to-any compare picker + diff | VER-01 diff-viewable requirement satisfied. |

**Deprecated/outdated after this phase:**
- The `SkillEvalSection` + `SkillTestCasesSection` mounts inside `SkillFormDialog` (:535-550) — moved out (D-07). The components' *logic* is lifted, not deleted.
- The `skill-tuner` `ActiveView` value as a user-reachable destination — redirected to the Studio (D-01).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Client-side version→eval-binding join is preferred over a net-new endpoint | Standard Stack / Pitfall 2 | LOW — both endpoints exist; if the planner prefers a server route it's still additive (no migration). Explicitly left to Claude's Discretion in CONTEXT. |
| A2 | No new package is needed for the compare-picker or table | Standard Stack | LOW — shadcn/ui primitives + `lineDiff` cover it; verified against the existing proposal-diff render. |
| A3 | The `handleOpenStudio` navigator can be prop-drilled exactly like `onTuneSkill` | Pitfall 5 | LOW — the drill path is verified to exist today for the Tuner. |

**Note:** All backend endpoint shapes, enum values, and client-fn signatures in this document are `[VERIFIED]` by direct file read, not assumed. The Assumptions Log is short because this is an in-repo consolidation, not an ecosystem-discovery phase.

## Open Questions

1. **Does the stepper's Eval node show a "running" sub-state mid-run?**
   - What we know: the live run streams per-arm progress; verdicts land at finalize (D-04). CONTEXT lists this under Claude's Discretion.
   - What's unclear: whether the stepper node itself animates during a run or only the run-history top row does.
   - Recommendation: Keep the stepper calm (it is a *status* read, one truth-teller); let the live per-arm progress live in the 055-B running row (D-12). Confirm against the 054/055 `index.html` mockups at plan time.

2. **Evals-tab vertical ordering at Studio width (stepper / run-bar / history / proposal).**
   - What we know: #45 puts the stepper top; 053-A intended a two-column layout, but Versions became its own tab (057-A), freeing the Evals tab.
   - Recommendation: stepper → run-bar (D-12, directly above history) → run-history (with the proposal card below it, D-08). Build against the 053-A + 057-A `index.html`, not from memory.

## Environment Availability

The Studio has **no external dependency** beyond the running app itself (frontend dev server + the already-running FastAPI backend + local Supabase/Redis, all standard project infra). No new CLI tool, service, or runtime is introduced.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node/Vite dev server | Building + running the Studio | ✓ (project standard) | project pin | — |
| FastAPI backend (local) | Serving the eval/gate/version/proposal endpoints | ✓ (all endpoints shipped 132–136) | — | — |
| Supabase local + Redis | Durable readout + eval SSE buffer | ✓ (project standard infra) | — | — |
| @lobehub/icons | Run-row provider logos | ✓ installed | project pin | lucide fallback glyph |

**Missing dependencies:** None. **Skip note:** external-dependency probing is N/A — this is a code-only phase over existing infra.

## Validation Architecture

*(nyquist_validation = true in `.planning/config.json` — section required.)*

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest + @testing-library/react (frontend); pytest (backend — not primary here) |
| Config file | `frontend/vitest.config.ts` `[VERIFIED]` |
| Quick run command | `cd frontend && npx vitest run <path/to/spec>` |
| Full suite command | `cd frontend && npm run test` (`vitest run`) `[VERIFIED: package.json]` |

### Phase Requirements → Test Map
| Req | Behavior | Test Type | Automated Command | File Exists? |
|-----|----------|-----------|-------------------|-------------|
| PANEL-01 (shell) | `skill-studio` ActiveView mounts + `‹ Skills` returns + landing tab = Evals + legacy `skill-tuner` redirects | unit (component) | `npx vitest run src/pages/SkillStudioPage.test.tsx` | ❌ Wave 0 |
| PANEL-01 (tabs) | Evals/Triggering/Versions tab switch + deep-link tab param | unit | `npx vitest run src/pages/SkillStudioPage.test.tsx` | ❌ Wave 0 |
| PANEL-01 (stepper, D-03/D-10) | Stepper renders 4 states + ⚡ collision as two labeled facts (NOT a contradiction); shared by panel + header; never recomputes `met` | unit | `npx vitest run src/components/skills/studio/LifecycleStepper.test.tsx` | ❌ Wave 0 |
| PANEL-01 (run history, D-04) | 055-B rows: rollup "N not measured", not_measured/judge_error not colored fail, interrupted banner+re-run, no mid-run verdict | unit | `npx vitest run src/components/skills/studio/RunHistory.test.tsx` | ❌ Wave 0 |
| PANEL-01 (ratings, EVAL-04) | Thumbs toggle → PUT → refetch; "your rating" distinct from judge verdict | unit | `npx vitest run src/components/skills/studio/RunCaseDetail.test.tsx` | ❌ Wave 0 |
| PANEL-01 (versions, VER-01) | 056-B table + compare picker renders one unified `lineDiff`; provenance chip maps the 5 real `source` values; no "Restore" | unit | `npx vitest run src/components/skills/studio/VersionsTab.test.tsx` | ❌ Wave 0 |
| PANEL-01 (proposal, D-08) | Re-skinned card preserves diff + rationale + evidence + gate counts + override_forced + interrupted state | unit | `npx vitest run src/components/skills/studio/ProposalCard.test.tsx` | ❌ Wave 0 |
| PANEL-01 (slim-down, D-07) | SkillFormDialog no longer mounts the two sections; renders stepper + "Open studio" | unit | `npx vitest run src/components/skills/SkillFormDialog.test.tsx` (extend) | ✅ (extend) |
| PANEL-01 (nav, D-06) | PublishGateDialog unmet branch shows "Review evals →" wired to the studio navigator | unit | `npx vitest run src/components/skills/PublishGateDialog.test.tsx` (extend) | ✅ (extend) |

### Sampling Rate
- **Per task commit:** `npx vitest run <the touched spec>` (< 30s).
- **Per wave merge:** `cd frontend && npm run test` (full vitest — expect the ~14–17 known-rotted tests to remain red; assert no NEW failures beyond that baseline per SEED-056).
- **Phase gate:** Full vitest green (modulo the documented rot baseline) before `/gsd:verify-work`; then the SC#10 + G-4 live UAT below.

### Wave 0 Gaps
- [ ] `src/pages/SkillStudioPage.test.tsx` — shell mount, tab switch, back, legacy redirect (PANEL-01 shell/tabs)
- [ ] `src/components/skills/studio/LifecycleStepper.test.tsx` — 4 gate states + ⚡ collision + shared-render (D-03/D-10)
- [ ] `src/components/skills/studio/RunHistory.test.tsx` — 055-B honest state set (D-04)
- [ ] `src/components/skills/studio/RunCaseDetail.test.tsx` — side-by-side arms + ratings (EVAL-04)
- [ ] `src/components/skills/studio/VersionsTab.test.tsx` — table + compare + provenance mapping (VER-01/D-05)
- [ ] `src/components/skills/studio/ProposalCard.test.tsx` — re-skinned honesty locks (D-08)
- [ ] Extend `SkillFormDialog.test.tsx` (sections gone, stepper + Open studio present — D-07)
- [ ] Extend `PublishGateDialog.test.tsx` ("Review evals →" on unmet — D-06)
- [ ] Framework install: none — vitest already configured.
- [ ] **Author all fresh** (SEED-056 rot) — mock `@/lib/api`, do not import from rotted siblings (Pitfall 4).

### SC#10 + G-4 — authored in VALIDATION.md, NOT PLAN tasks (D-14)
The 4-axis live UAT (cross-provider representative-4 × multi-tool × parallel-thread × long-message) + the G-4 lived-experience state-matrix sweep (tab switches, panel collapse, mid-run navigate-away/back, an interrupted run, both a gate-met and a gate-unmet skill) are UAT rows under VALIDATION.md, driven via Chrome MCP + psycopg2 (:54322) cross-check per the project UAT recipe. Component vitest covers the wire/render truths; the live UAT covers the felt experience the wire format can't (the documented lived-experience UAT-gap pattern).

## Security Domain

*(`security_enforcement` absent in config → treated as enabled. This phase is read-only UI consumption; all enforcement is server-side and already shipped + secured in Phases 132–136.)*

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V1 Architecture | yes | The client renders server truth; owner-scoping is the server's sole runtime gate (service-role bypasses RLS — every route filters `.eq("user_id")`). The Studio adds no new trust boundary. |
| V4 Access Control | yes (server-side, unchanged) | Every consumed route is owner-scoped + 404-never-403 on cross-user (T-132/133/134/135). The client must not assume a resource is visible; render the server's response verbatim. |
| V5 Input Validation | yes | Test-case CRUD + rating writes are validated server-side (rating `CHECK IN ('up','down')`, forged body ids ignored). The client sends only path + minimal body. |
| V7 Error Handling / Honesty | yes | The one-truth lock: never recompute `met`, never fabricate a verdict, always render `override_forced`/`last_override` un-softened (D-03/D-04). Honesty is the security-adjacent invariant here. |
| V6 Cryptography | no | No crypto surface in this phase. |

### Known Threat Patterns for a read-only consolidation UI
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client recomputes publish-readiness → a client could "publish" a skill the server would block | Elevation of Privilege | Never recompute `met`; the server remains the gate + records overrides (D-07). Force-publish only echoes `override=true`; the server re-verifies + records (already shipped 136). |
| Stale/leaked cross-skill state showing another skill's eval | Information Disclosure | Carry the `currentSkillRef` skill-switch guard into every lifted handler (BUG-260701-02 fix). |
| Rendering a masked/no-access resource as an error or leaking an id | Information Disclosure | Render server responses verbatim; 404-never-403 is already enforced server-side; the client shows honest empty/absent states. |
| Optimistic proposal/rating state implying an unconfirmed server action | Tampering | Refetch-not-optimistic (T-135-04) — the card can't show "promoted" unless the server reconciled it. |

**No net-new server write path is introduced.** The only writes the Studio triggers (test-case CRUD, rating PUT, proposal actions, force-publish) are all existing, owner-gated, and independently secured. The frontend security posture reduces to: honor the one-truth lock, keep the skill-switch guard, render server truth verbatim.

## Sources

### Primary (HIGH confidence — direct in-repo read)
- `backend/app/api/evals.py`, `skills.py`, `skill_test_cases.py` — endpoint inventory (paths/methods/response models)
- `backend/app/models/skill.py` (PublishGate), `skill_version.py` (source enum), `eval_run.py` (EvalRun/EvalResult/SkillProposal/PromotionGate), `skill_test_case.py`
- `frontend/src/components/skills/SkillEvalSection.tsx` (924 lines — the machinery to lift), `SkillTestCasesSection.tsx`, `PublishGateDialog.tsx`, `SkillCard.tsx`
- `frontend/src/pages/SkillsPage.tsx`, `SkillTunerPage.tsx` (ActiveView precedent), `App.tsx`, `components/layout/ChatLayout.tsx`
- `frontend/src/lib/api.ts` (client fns), `types/index.ts` (wire mirrors), `lib/lineDiff.ts`, `lib/providerLogo.tsx`, `lib/nav-items.ts`
- `.planning/sketches/053..057/README.md` + `MANIFEST.md` (Running Design Decisions 44–47) — the G-2 acceptance bar
- `.claude/skills/sketch-findings-agentic-rag/SKILL.md` — validated design patterns / theme / CSS precedents
- `.planning/phases/137-.../137-CONTEXT.md` — locked decisions D-01..D-16
- `.planning/REQUIREMENTS.md` (PANEL-01 + exclusions), `.planning/config.json` (nyquist_validation, workflow flags)

### Secondary (MEDIUM confidence)
- `.planning/STATE.md` — phase history + the BUG-260701-02 / BUG-260702-03 / d0c0c10a fix provenance; SEED-056 frontend vitest rot

### Tertiary (LOW confidence)
- None — no WebSearch was needed; the entire consumed surface is in-repo and verified.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero external packages; every reused utility verified present.
- Architecture: HIGH — the ActiveView shell, the lift-state pattern, and Pattern 3 stream reuse are all shipped precedents read directly.
- Backend surface: HIGH — every endpoint, response model, and enum verified by file read.
- Pitfalls: HIGH — the `source` enum mismatch, the version→eval join, and the ⚡ collision are all grounded in verified code + the sketch acceptance tests.

**Research date:** 2026-07-03
**Valid until:** ~2026-08-03 (30 days — stable, in-repo; the only invalidator is a schema/endpoint change in a parallel phase, none in flight for the eval surface).
