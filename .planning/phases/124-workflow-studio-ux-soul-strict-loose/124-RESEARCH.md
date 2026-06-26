# Phase 124: Workflow Studio UX — Soul + Strict↔Loose - Research

**Researched:** 2026-06-27
**Domain:** Pure-frontend React re-skin of existing Workflow Studio surfaces (Aether Deep Midnight theme)
**Confidence:** HIGH (every claim verified against live source; no external packages; design contract is two operator-approved sketches)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01 (launch seam):** The two-door fork (Describe & run / Author & govern) lives at the **Studio/authoring ENTRY only** — reached via "Build a workflow" (New) and via "Author & govern" on an existing draft. The **library card's Run** stays the one-click **launch-into-thread** exactly as Phase 121 shipped it; the fork never wraps or replaces it.
- **D-02 (pure-frontend):** `business_requirement` already exists on `WorkflowDefinition` (`backend/app/models/harness.py:240`). `deriveTier`/`TIERS` already exist (`frontend/src/components/workflows/deriveTier.ts`). 124 surfaces these hidden fields — **no migration, no new authoring field, no backend touch.**
- **D-03 (honest empty-states):** A **draft** purpose (`business_requirement` may be null pre-publish) renders **"draft · purpose not declared yet."** The **output line** reads the terminal `llm_emit` deliverable when present (e.g. "Status Report · .docx"), else an honest **"produces: answer in chat"**. The atom is always rendered.
- **D-04 (soul = 5 atoms, purpose-led):** `business_requirement` (HERO at every size) · needs (kickoff `inputs`) · **glyph-dot `PhaseSpine`** (⚙✎🤖⛓☺◆ type glyphs ONLY — type ribbons + phase-index numbers STRIPPED; phase names are quiet labels/`title=`) · ONE tier chip from `deriveTier()` (glyph + WORD, never colour-alone) · output/deliverable line. The **SAME shared, scale-keyed atoms** feed library card → run header → publish summary.
- **D-05 (two doors):** Two big door cards side by side: **"Describe & run"** (loose — describe box + soul preview + one CTA; descends from 018-A) vs **"Author & govern"** (strict — the full Builder). Keyed off `deriveTier`: the govern-door advanced controls (`citation_policy` · gate chips · per-phase `folder_scope` · per-phase model) **recompute the tier live**, and `llm_judge_rubric` is **LOCKED always-on**. A persistent **"‹ both doors"** returns; the describe door carries a visible **"switch to Author & govern ›"** strip. Shares the 046 soul header across Authoring + Running (toolbar context toggle).
- **D-06 (publish scope):** On the **publish summary**, 124 **prepends the soul block ONLY.** The gauntlet **ladder rendering** is **WUX-03 → Phase 127 STRETCH**, untouched here.
- **D-07 (G-5 RED LINE):** The soul header on the run surface is an **ADDITIVE SIBLING** of `panel/PhaseTimeline.tsx` / `panel/PhaseCard.tsx`. Do **NOT** thread soul atoms into PhaseCard internals.
- **D-08 (Deep byte-identical):** Deep Mode stays byte-identical; no shared-path fork (this is FE-only chrome).

### Claude's Discretion
- Exact net-new component file names + placement; CSS token choices within the locked Aether Deep Midnight theme; precise copy strings — all **subject to matching sketches 046-A / 047-A** (the acceptance bar).

### Deferred Ideas (OUT OF SCOPE)
- **WUX-03** — publish gauntlet as pip-strip + worded verdict + quiet idle cards → **Phase 127 STRETCH**. 124 stays soul-block-only on that surface (D-06).
- **BUG-260610-01** (timer reseed + duplicated empty avatar on nav during a workflow run; `minor`) — **left OPEN, not folded.** `re_open_trigger`: re-check if the 124 run-header re-skin touches the run strip.
- **BUG-260609-04** (phase card shows placeholder slug `phase-0`; `minor`) — **left OPEN, not folded.** `re_open_trigger`: re-check if the 124 run-header / soul-spine re-skin touches phase-card slug rendering.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WUX-01 | A user sees the "soul" of a workflow at a glance in three sizes (library card / run header / publish summary): purpose (`business_requirement`), what it needs, a glyph-dot phase spine, one tier chip, output line. (G-2 sketch-gated.) | All 3 host surfaces located + their in-scope data documented (Standard Stack §, Architecture §). The 5 soul atoms map to real verified fields: `business_requirement` [VERIFIED: harness.py:240], `inputs`/`input_keys` [VERIFIED: harness.py:204-211, WorkflowsPage.tsx:132-139], `deriveTier()` [VERIFIED: deriveTier.ts], the `PHASE_GLYPHS` map [VERIFIED: WorkflowsPage.tsx:44-51 + PhaseSpineGraph.tsx:24-31], the `llm_emit` deliverable [VERIFIED: harness.py:123-154]. |
| WUX-02 | Authoring and running expose a strict↔loose disclosure keyed off `deriveTier` — two doors ("Describe & run" vs "Author & govern") — nothing removed, advanced demoted one click, accuracy + control preserved. (G-2 sketch-gated.) | The authoring ENTRY (D-01 fork home) located: `WorkflowsPage` "Build a workflow" card + Open/Tweak → `WorkflowBuilderPage`. The govern door IS the existing Builder (read-only `PhaseSpineGraph` + 400px `PhaseFormPanel` carrying `citation_policy`/gates/scope/model). `deriveTier()` live recompute already proven in the Builder dial. Judge-always-on already encoded in `TIERS.*.judgeAlwaysOn` + `PublishGauntlet` hard wall. |
</phase_requirements>

## Summary

Phase 124 is a **pure-frontend, additive re-skin** of four existing, shipped Workflow Studio surfaces. There is **no backend work, no schema, no migration, no external package**. The acceptance bar is two operator-approved sketches (046-A purpose-led soul, 047-A explicit-fork two doors). Every datum the soul atoms read **already exists** in the live code and is surfaced today only partially (the tier chip + phase chain on the library card) or not at all (`business_requirement` — shown nowhere in the product). The planner's job is to compose net-new shared presentation components that read those real fields and render identically across three sizes, then fork the authoring entry into two doors — **without re-deriving the tier, forking the gate logic, or touching the G-5 run-surface timeline internals.**

The single highest-leverage finding: **the "govern door" is not new UI — it IS the existing `WorkflowBuilderPage`** (read-only vertical `PhaseSpineGraph` + the 400px push `PhaseFormPanel` that already owns `citation_policy`, gate chips, per-phase `folder_scope`, and per-phase model). The two-door shell is a thin wrapper choosing between (a) a describe box (descended from the Builder's existing "empty"-state describe screen, `WorkflowBuilderPage.tsx:271-352`) and (b) the existing Builder drafted view. The soul header is a net-new shared component (`WorkflowSoul`) that mounts in five places (card, draft card, run-surface panel section, publish modal, both doors) and reads one definition shape.

The second highest-leverage finding: **`deriveTier()` is a pure, client-side, single-source-of-truth derivation that must never be duplicated.** `WorkflowsPage.tsx` already wraps it in `tierForDefinition(def)` (lines 106-128) — that wrapper (strictest-emit-policy selection + validator-kind union) is the canonical "from a definition JSONB → a Tier" function and **must be extracted/shared**, not re-implemented in each soul-size context, or the card/run/publish tiers can drift.

**Primary recommendation:** Build one `WorkflowSoul` family (scale-keyed: `card` | `run` | `pub`) + one horizontal glyph-dot `PhaseSpine` + one `WorkflowDoorSwitch` shell wrapping the existing Builder. Extract `tierForDefinition` and the `PHASE_GLYPHS` map into a shared module so the three sizes + two doors all consume one tier and one glyph set. Mount the run-surface soul as a **new `<PanelSection>` sibling** above the existing `title="Workflow"` section in `WorkspacePanel.tsx` (line 187) — never inside `PhaseTimeline`/`PhaseCard`. Gate the build on visual diff against 046-A/047-A and on a `deriveTier`-consistency invariant test.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Workflow soul rendering (5 atoms, 3 sizes) | Browser / Client (React presentation) | — | Pure presentation over data already in scope; no fetch, no derivation beyond `deriveTier` (itself client-side pure). [VERIFIED: deriveTier.ts header — "imports NOTHING from the API client"] |
| Tier derivation (`deriveTier` / `tierForDefinition`) | Browser / Client (pure function) | — | Already pure + client-side; mirror of backend enums but computed, never fetched. [VERIFIED: deriveTier.ts:1-22] |
| Two-door disclosure shell | Browser / Client (React state, intra-view) | — | The Studio is router-less intra-view state (`"library" \| "builder"`); the fork is more local state, no route, no API. [VERIFIED: WorkflowsPage.tsx:209, ChatLayout.tsx:296-302] |
| Workflow launch (Run → thread) | Frontend Server boundary (existing kickoff) | API | PRESERVED BYTE-IDENTICAL (D-01). `doRun` = `createThread` → `postMessage(workflowDefinitionId)` → `create_workflow_run` server-side. 124 does NOT touch this. [VERIFIED: ChatLayout.tsx:91-100] |
| `business_requirement` source of truth | Database / Storage (JSONB) | — | Read-only for 124; the field is on `WorkflowDefinition` JSONB, surfaced as a hero atom. No write path added. [VERIFIED: harness.py:240] |
| Run-surface live timeline (PhaseTimeline/PhaseCard) | Browser / Client (live stream) | — | OUT OF SCOPE internals (G-5). Soul header is a SIBLING. [VERIFIED: WorkspacePanel.tsx:187-191] |

## Standard Stack

This phase adds **zero new dependencies.** It composes the existing React 19 + Tailwind + shadcn/Radix stack already in `frontend/`. The relevant existing modules:

### Core (reuse seams — already in the repo)
| Module | Path | Purpose | Reuse mode for 124 |
|--------|------|---------|--------------------|
| `deriveTier` / `TIERS` | `frontend/src/components/workflows/deriveTier.ts` | The single-source-of-truth tier derivation (pure, client-side). `deriveTier(citationPolicy, validatorKinds: Set<ValidatorKind>) → Tier`. `TIERS.{STRICT,MIDDLE,LOOSE}` carry `{id, glyph, label, description, judgeAlwaysOn:true}`. | **REUSE VERBATIM.** Never duplicate. [VERIFIED] |
| `tierForDefinition(def)` | `frontend/src/pages/WorkflowsPage.tsx:106-128` | The "from a definition JSONB → Tier" wrapper: strictest `citation_policy` across emit phases (via `POLICY_ORDER` / `stricterPolicy`) + validator-kind union, then `deriveTier`. | **EXTRACT + SHARE.** This is the canonical def→tier function; the soul tier chip in all 3 sizes must call this one function. [VERIFIED] |
| `PHASE_GLYPHS` map | `WorkflowsPage.tsx:44-51` AND `PhaseSpineGraph.tsx:24-31` (duplicated by value) | `{programmatic:"⚙", llm_single:"✎", llm_agent:"🤖", llm_batch_agents:"⛓", llm_human_input:"☺", llm_emit:"◆"}` | **EXTRACT + SHARE.** Currently duplicated by value across 3 files (`WorkflowsPage`, `PhaseSpineGraph`, `PhaseCard` uses a label variant). Centralize for the glyph-dot spine. [VERIFIED] |
| `entryInputKeys(def)` | `WorkflowsPage.tsx:132-139` | The needs atom source: `input_keys[]` → `inputs[].key` → fallback `["kickoff_prompt"]`. | **EXTRACT + SHARE** as the "needs" atom data fn. [VERIFIED] |
| `WorkflowBuilderPage` | `frontend/src/pages/WorkflowBuilderPage.tsx` | The describe-first authoring surface + the drafted editing view (read-only `PhaseSpineGraph` + 400px `PhaseFormPanel`). | **REUSE as the "Author & govern" door content.** The describe box (lines 271-352) is the lineage for the "Describe & run" door. [VERIFIED] |
| `PhaseSpineGraph` | `frontend/src/components/workflows/PhaseSpineGraph.tsx` | Read-only VERTICAL phase-spine graph (govern door). | **REUSE** as-is inside the govern door (already mounted by Builder). The net-new HORIZONTAL glyph-dot spine is separate. [VERIFIED] |
| `PhaseFormPanel` | `frontend/src/components/workflows/PhaseFormPanel.tsx` | The 400px right-side form panel; the ONLY place `citation_policy` (line 688), gate config, `folder_scope`, and per-phase `model` are edited. `llm_emit` is the only type with `citation_policy`. | **REUSE** as the govern-door advanced controls. The tier recompute already happens here on change → `deriveTier`. [VERIFIED] |
| `PublishGauntlet` | `frontend/src/components/workflows/PublishGauntlet.tsx` | The publish-summary surface (compact trigger + modal with the 8-stage spine + verdict). | **PREPEND soul block only** (D-06). The 8-stage ladder/verdict stay byte-unchanged. [VERIFIED] |
| `WorkspacePanel` | `frontend/src/components/panel/WorkspacePanel.tsx` | Hosts the run-surface `<PanelSection title="Workflow">` → `PhaseTimeline`. | **ADD a new sibling `<PanelSection>`** for the run soul header above line 187. Do NOT edit `PhaseTimeline`/`PhaseCard`. [VERIFIED] |

### Supporting (data shapes the atoms read — all verified)
| Field | Source | Shape | Atom |
|-------|--------|-------|------|
| `business_requirement` | `WorkflowDefinition` JSONB | `str \| None` (None on drafts) | Purpose HERO (D-03 empty-state when null) [VERIFIED: harness.py:240] |
| `inputs` | `WorkflowDefinition.inputs` | `list[InputFieldSpec] \| None`; each `{key, label, type, required, source, enum_options, folder_scope}` | Needs atom (via `entryInputKeys`) [VERIFIED: harness.py:204-234] |
| `phases[].config.phase_type` | `PhaseSpec.config` | one of 6 literals (⚙✎🤖⛓☺◆) | Glyph-dot spine [VERIFIED: harness.py:51-167] |
| `phases[].config.citation_policy` | `LlmEmitPhaseConfig` only | `"strict"\|"flag"\|"partial"\|"draft"` (default `"strict"`) | Tier chip input (via `tierForDefinition`) [VERIFIED: harness.py:153] |
| `phases[].validators[].kind` | `ValidatorSpec.kind` | incl. `citations_required`, `output_file_valid`, `structure_check`, `freshness`, `llm_judge_rubric` | Tier chip input (validator-kind union) [VERIFIED: harness.py:178-182] |
| terminal `llm_emit` `emitter` | `LlmEmitPhaseConfig.emitter` | `str` (default `"render_template"`; EMITTER_REGISTRY key) | Output/deliverable atom — present = file deliverable; absent = "produces: answer in chat" (D-03) [VERIFIED: harness.py:141] |

**Note on the output atom (D-03):** the deliverable line should read the terminal `llm_emit` phase. A workflow WITH a terminal `llm_emit` produces a file (the emitter/registry produces a typed artifact such as a `.docx`); a workflow with NO `llm_emit` phase produces a chat answer → honest "produces: answer in chat". The sketch's example "Status Report · .docx" is a friendly label; the **verified mechanism** is "does a terminal `llm_emit` phase exist." The exact human-facing deliverable name (e.g. "Status Report") is NOT a guaranteed field — see Assumptions Log A1.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Extracting `tierForDefinition` to a shared module | Re-call `deriveTier` inline in each soul size | REJECTED — re-implementing the strictest-emit-policy selection per site is exactly the drift this phase's invariant forbids. One shared fn or the card/run/publish tiers can disagree. |
| A new `<PanelSection>` sibling for the run soul header | A wrapper around `PhaseTimeline` | REJECTED — D-07 G-5 red line. The existing `<PanelSection>` mounting idiom (WorkspacePanel.tsx:163-205) is the safe additive seam. |
| Reusing the Builder describe screen for the "Describe & run" door | A brand-new describe component | The Builder's "empty"-state describe box (WorkflowBuilderPage.tsx:271-352) is the 018-A lineage; reuse its shape/copy but the door wrapper is net-new. |

**Installation:** None. `npm install` adds nothing.

## Package Legitimacy Audit

> Not applicable — this phase installs **zero external packages**. It is a pure composition of existing in-repo React components and existing dependencies (React 19, Tailwind, Radix/shadcn — all already in `frontend/package.json` and unchanged). No npm/PyPI/crates touch. slopcheck not run (no packages to check).

## Architecture Patterns

### System Architecture Diagram

```
                         ONE SHARED DEFINITION SHAPE (DefShape — read-only)
                                          │
        ┌─────────────────────────────────┼─────────────────────────────────┐
        │                                 │                                 │
   reads fields:                   reads fields:                     reads fields:
   business_requirement            (same)                            (same)
   inputs/input_keys
   phases[].config.phase_type
   phases[].config.citation_policy + validators[].kind
   terminal llm_emit.emitter
        │                                 │                                 │
        ▼                                 ▼                                 ▼
  ┌───────────────┐   ┌──────────────────────────────┐   ┌──────────────────────────┐
  │ tierForDef()  │   │  PHASE_GLYPHS map (⚙✎🤖⛓☺◆)  │   │  entryInputKeys()         │
  │  → deriveTier │   │  → glyph-dot PhaseSpine       │   │  → needs atom             │
  │  → Tier chip  │   │     (horizontal, net-new)     │   │                          │
  └───────┬───────┘   └───────────────┬──────────────┘   └─────────────┬────────────┘
          └──────────────┬────────────┴──────────────────────────────────┘
                         ▼
              ┌─────────────────────────┐
              │  WorkflowSoul (net-new)  │  scale = "card" | "run" | "pub"
              │  5 atoms, scale-keyed    │  (purpose HERO at every size — 046-A)
              └────────────┬────────────┘
                           │ mounted in 5 host contexts:
       ┌───────────┬───────┴──────┬──────────────────┬──────────────────┐
       ▼           ▼              ▼                  ▼                  ▼
  WorkflowsPage  WorkflowsPage  WorkspacePanel    PublishGauntlet    WorkflowDoorSwitch
  PublishedCard  DraftCard      NEW <PanelSection> modal (PREPEND     (both doors share
  (scale=card)   (scale=card)   sibling of        soul block, D-06)  the run/auth header)
                                "Workflow" section
                                (scale=run, G-5
                                additive sibling)

        ── WUX-02 two-door fork (authoring ENTRY only — D-01) ──
   "Build a workflow" / "Author & govern"  →  WorkflowDoorSwitch (net-new shell)
                                              ├─ Door A "Describe & run"  → describe box (018-A lineage) + soul preview
                                              └─ Door B "Author & govern" → EXISTING WorkflowBuilderPage
                                                                            (read-only PhaseSpineGraph + 400px PhaseFormPanel:
                                                                             citation_policy / gate chips / folder_scope / model
                                                                             → deriveTier LIVE recompute; llm_judge_rubric LOCKED)

   PRESERVED BYTE-IDENTICAL (D-01): library card Run → doRun → createThread → postMessage(workflowDefinitionId) → run-into-thread
```

### Component Responsibilities

| Component | New/Reuse | File (proposed) | Responsibility |
|-----------|-----------|-----------------|----------------|
| `WorkflowSoul` | NET-NEW | `frontend/src/components/workflows/WorkflowSoul.tsx` | The scale-keyed 5-atom soul (purpose HERO, needs, spine, tier chip, output). One component, `scale` prop. |
| `PhaseSpine` (horizontal glyph-dot) | NET-NEW | `frontend/src/components/workflows/PhaseSpine.tsx` | Horizontal glyph-dot row; type ribbons + indices STRIPPED; names via `title=` at card size, visible at run/pub. ◆ emit node tinted. |
| `workflowSoulData` helpers | EXTRACT | `frontend/src/components/workflows/soulData.ts` (or co-located) | `tierForDefinition`, `PHASE_GLYPHS`, `entryInputKeys`, terminal-emit deliverable resolver. Shared by all sizes. |
| `WorkflowDoorSwitch` | NET-NEW | `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` | The two-door shell: door cards, "‹ both doors", "switch to Author & govern ›" strip, context toggle. Wraps the describe box + the existing Builder. |
| run-surface soul `<PanelSection>` | NET-NEW mount | edit `WorkspacePanel.tsx` (additive section only) | A new `<PanelSection>` above the `title="Workflow"` section that renders `<WorkflowSoul scale="run">`. SIBLING of PhaseTimeline. |
| publish soul block | NET-NEW mount | edit `PublishGauntlet.tsx` (prepend only, D-06) | Prepend `<WorkflowSoul scale="pub">` above the existing gauntlet content. Ladder untouched. |

### Pattern 1: Scale-keyed shared atom (one renderer, three sizes)
**What:** Each identity-carrying atom (tier chip, glyph-dot spine, needs, output) is rendered by ONE function with a `scale: "card" | "run" | "pub"` prop. The size tunes layout/typography; the data + derivation are identical.
**When to use:** Every soul atom. This is the SC#1+SC#2 consistency guarantee made structural (046-A README "rendered by one function each and scale-keyed").
**Example (the existing tier-chip pattern to generalize):**
```tsx
// Source: WorkflowsPage.tsx:184-198 (existing TierBadge — restyle to scale-keyed chip)
function TierBadge({ def }: { def: DefShape | null | undefined }) {
  const tier = tierForDefinition(def)   // ← the ONE shared derivation
  return (
    <span data-testid="tier-badge" data-tier={tier.id} title={tier.description}
      className="inline-flex items-center gap-1 rounded-full border ...">
      <span aria-hidden="true">{tier.glyph}</span>{tier.label}   {/* glyph + WORD, never colour-alone */}
    </span>
  )
}
```

### Pattern 2: Additive sibling, never internal thread (G-5)
**What:** The run-surface soul header mounts as a NEW `<PanelSection>` in `WorkspacePanel`, beside the existing live-timeline section. It reads the definition (via `getThreadWorkflow`/existing run frame), NOT `PhaseCard` internals.
**When to use:** The run-header soul (scale="run"). This is the literal D-07 red line.
**Example (the existing sibling-section idiom to copy):**
```tsx
// Source: WorkspacePanel.tsx:184-191 — add a NEW <PanelSection> ABOVE this, do NOT edit PhaseTimeline
{showTimeline && (
  <PanelSection title="Workflow" count={phases.length || undefined}>
    <PhaseTimeline threadId={threadId} />   {/* ← UNCHANGED. Soul header is a separate section. */}
  </PanelSection>
)}
```

### Pattern 3: The govern door IS the existing Builder
**What:** "Author & govern" does not build new advanced controls. It mounts the existing `WorkflowBuilderPage` (drafted view) whose `PhaseFormPanel` already owns `citation_policy`, gate config, `folder_scope`, and per-phase `model`, and whose change handlers already drive `deriveTier` live.
**When to use:** Door B. The fork is presentation over an existing surface (047-A README: "everything governance-bearing is REUSE — the doors must never re-derive the tier or fork the gate logic").

### Anti-Patterns to Avoid
- **Re-deriving the tier per surface:** Each soul size calling `deriveTier` with its own ad-hoc policy/gate extraction → drift. Use the ONE extracted `tierForDefinition`.
- **Duplicating `PHASE_GLYPHS` a 4th time:** It is already copied by value in 3 files. The horizontal spine must consume a single shared export.
- **Threading soul props into `PhaseCard`/`PhaseTimeline`:** D-07 G-5 violation. Compose as a sibling.
- **Wrapping the library-card Run in the door fork:** D-01 violation. Run stays one-click launch-into-thread.
- **Touching the gauntlet ladder/verdict rendering:** D-06 — soul block PREPEND only; ladder is WUX-03/Phase 127.
- **Colour-alone tier signalling:** every tier/status atom is glyph + WORD (WCAG 1.4.1).
- **Inventing fields:** no "Status Report" name, no "level 1/2/3", no "compliance-mode". Tier vocab = real enum (STRICT 🔒 / MIDDLE ◐ / LOOSE ○) only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tier from a definition | A per-surface policy/gate scan | `tierForDefinition` (extract from WorkflowsPage.tsx:106-128) | Strictest-emit-policy selection (`POLICY_ORDER`/`stricterPolicy`) + validator-kind union is subtle; re-implementing it 3× guarantees drift. [VERIFIED] |
| Glyph for a phase type | A new glyph dict | Shared `PHASE_GLYPHS` export | Already exists in 3 places; a 4th copy can desync the ◆ emit node. [VERIFIED] |
| The needs list | Parsing `inputs`/`input_keys` ad hoc | `entryInputKeys` (extract from WorkflowsPage.tsx:132-139) | Handles the `input_keys` → `inputs[].key` → `["kickoff_prompt"]` fallback chain. [VERIFIED] |
| The govern-door advanced controls | New citation/gate/scope/model editors | The existing `PhaseFormPanel` via the Builder | These editors + their live `deriveTier` recompute already exist and are the ONLY write path. [VERIFIED] |
| The judge-always-on lock | A new "judge required" flag | `TIERS.*.judgeAlwaysOn` + the gauntlet hard wall | The invariant is already encoded; render it non-removable, don't re-model it. [VERIFIED: deriveTier.ts:49, PublishGauntlet.tsx HardWall] |
| The launch path | A bespoke run route | `doRun` (ChatLayout.tsx:91-100) — preserved | D-01 byte-identical; `createThread`→`postMessage(workflowDefinitionId)`→`create_workflow_run`. [VERIFIED] |
| The publish modal shell / focus trap | A new modal | The existing `PublishGauntlet` modal (shares RunModal's z-9000/Escape/focus contract) | Soul block prepends inside it. [VERIFIED] |

**Key insight:** In this phase, ~90% of "governance-bearing" logic already exists and is correct. The net-new surface is **presentation composition** (the soul atoms + the door shell) over verified data. The single discipline that matters is **one tier derivation, one glyph map** shared across every render site.

## Runtime State Inventory

> This is a pure-frontend presentation re-skin — NOT a rename/refactor/migration. No stored data keys, service config, OS-registered state, secrets, or build artifacts change. Included for completeness because the orchestrator flagged G-5 hot files; all categories verified empty.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified. `business_requirement`, `inputs`, `phases`, `citation_policy`, validator kinds are all READ-ONLY for 124; no new column, no JSONB write, no migration (D-02). | None |
| Live service config | None — no n8n/Datadog/external service touch; this is FE chrome only. | None |
| OS-registered state | None — no Task Scheduler/pm2/systemd touch. | None |
| Secrets/env vars | None — no new env var, no SOPS key, no `.env` change. | None |
| Build artifacts | None — no new package install, no egg-info/compiled artifact. The `frontend/` build is the only artifact and it recompiles from source on `npm run build`. | None — standard `vite build` |

**Nothing found in every category:** verified by reading the data sources (harness.py read-only), the launch path (unchanged), and confirming zero new dependencies in `frontend/package.json`.

## Common Pitfalls

### Pitfall 1: Tier drift across the three sizes
**What goes wrong:** The library card shows STRICT, the run header shows MIDDLE for the same workflow.
**Why it happens:** Each surface re-extracts `citation_policy`/validator kinds with slightly different logic instead of calling the one shared derivation.
**How to avoid:** Extract `tierForDefinition` to a shared module; every soul size imports it. Add an invariant test that asserts card/run/pub render the SAME `data-tier` for a fixture.
**Warning signs:** Two surfaces compute the tier inline; a copy-pasted `POLICY_ORDER` / validator scan.

### Pitfall 2: G-5 red-line creep (editing PhaseTimeline/PhaseCard internals)
**What goes wrong:** Soul atoms get threaded into `PhaseCard` props "because it's convenient," re-running the replay/reconcile risk and reopening BUG-260609-04 / BUG-260610-01.
**Why it happens:** The run-header soul visually sits near the live timeline.
**How to avoid:** Mount as a NEW `<PanelSection>` sibling in `WorkspacePanel.tsx` (the established idiom). Keep a source-grep test like `PhaseSpineGraph.test.tsx:153-158` ("the SOURCE never imports PhaseTimeline or PhaseCard"). Diff `PhaseTimeline.tsx` + `PhaseCard.tsx` to prove zero internal changes.
**Warning signs:** Any diff line inside `panel/PhaseTimeline.tsx` or `panel/PhaseCard.tsx`; a new prop on `PhaseCardProps`.

### Pitfall 3: Re-opening the two OPEN bugs via the run strip
**What goes wrong:** The run-header re-skin touches the run strip's timer or the phase-card slug render, making BUG-260610-01 (timer reseed + duplicate avatar) or BUG-260609-04 (`phase-0` placeholder slug) in-scope unexpectedly.
**Why it happens:** Both bugs live in the run-surface streaming/reconcile path (`StreamsProvider.tsx` reconcile, the run strip timer). The soul header sits adjacent.
**How to avoid:** The soul header reads the DEFINITION (purpose/tier/spine), NOT the live `usePhases`/run-strip timer. It must not render an elapsed timer or a per-phase slug. If a task ends up touching the run strip timer or `PhaseCard` slug, **flip the bug `re_open_trigger`** — both reports explicitly say "re-check if the 124 run-header re-skin touches the run strip / phase-card slug rendering."
**Warning signs:** The soul header consuming `usePhases(threadId)` for live phase state; any edit to the run-strip elapsed-timer; any edit to `phase.slug` rendering.

### Pitfall 4: Dishonest empty-states (D-03)
**What goes wrong:** A draft soul shows a blank purpose, or a no-deliverable workflow shows a fake output.
**Why it happens:** `business_requirement` is `None` on drafts; not every workflow has a terminal `llm_emit`.
**How to avoid:** Render "draft · purpose not declared yet" when `business_requirement` is null; render "produces: answer in chat" when there is no terminal `llm_emit`. The atom is ALWAYS rendered (never hidden). [VERIFIED: harness.py:240 null-on-draft; harness.py:123-154 emit optionality]
**Warning signs:** Conditional that hides the purpose/output atom; a hardcoded deliverable name.

### Pitfall 5: Sketch-fidelity drift
**What goes wrong:** The build diverges from 046-A/047-A (the acceptance bar) — different atom order, type ribbons left on the spine, colour-alone tiers.
**Why it happens:** "Claude's discretion" on copy/tokens is misread as discretion on layout/behavior.
**How to avoid:** Discretion is ONLY file names, CSS token choices, and copy strings — **subject to matching the sketches.** Layout (purpose HERO), spine (ribbons + indices STRIPPED), tier (glyph+WORD), and the explicit-fork door behavior are LOCKED. Visual-diff each size + both doors against the sketch HTML.
**Warning signs:** A spine showing "server"/"agent" ribbons or phase-index numbers; a tier chip without a WORD.

## Code Examples

### Resolving the soul tier from a definition (the ONE shared derivation)
```tsx
// Source: WorkflowsPage.tsx:106-128 (EXTRACT this verbatim to a shared module; do not re-implement)
function tierForDefinition(def: DefShape | null | undefined) {
  const phases = def?.phases ?? []
  let citationPolicy: CitationPolicy = "draft"
  let sawEmit = false
  for (const p of phases) {
    if (p.config?.phase_type === "llm_emit") {
      const cp = p.config?.citation_policy
      if (cp === "strict" || cp === "flag" || cp === "partial" || cp === "draft") {
        citationPolicy = sawEmit ? stricterPolicy(citationPolicy, cp) : cp
        sawEmit = true
      }
    }
  }
  const kinds = new Set<ValidatorKind>()
  for (const p of phases)
    for (const v of p.validators ?? [])
      if (v.kind && ALL_VALIDATOR_KINDS.has(v.kind)) kinds.add(v.kind as ValidatorKind)
  return deriveTier(citationPolicy, kinds)   // ← deriveTier.ts:102, pure + client-side
}
```

### The glyph-dot phase spine source mapping (strip ribbons + indices)
```tsx
// Source: PHASE_GLYPHS — WorkflowsPage.tsx:44-51 / PhaseSpineGraph.tsx:24-31 (extract to one export)
const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "⚙", llm_single: "✎", llm_agent: "🤖",
  llm_batch_agents: "⛓", llm_human_input: "☺", llm_emit: "◆",
}
// Net-new horizontal spine: glyph dots only; NO type label, NO phase_index number;
// phase name in title= at card scale, visible at run/pub scale; ◆ llm_emit node tinted.
```

### The preserved launch path (D-01 — do NOT change)
```tsx
// Source: ChatLayout.tsx:91-100 — the library-card Run path stays byte-identical
const doRun = useCallback(async (def: PublishedWorkflow, kickoff: string) => {
  const thread = await createThread(def.name)
  await postMessage(thread.id, kickoff, { workflowDefinitionId: def.id })  // → create_workflow_run server-side
  await loadThreads(); selectThread(thread); onNavigate("chat")
}, [loadThreads, selectThread, onNavigate])
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Library-card `PhaseChain` with type ribbons + truncated names (WorkflowsPage.tsx:155-182) | Net-new horizontal glyph-dot `PhaseSpine` (ribbons + indices stripped) | Phase 124 | The card spine is replaced/restyled; the old `PhaseChain` becomes the donor for the glyph map but its ribbon/label render is dropped per 046-A. |
| `business_requirement` shown NOWHERE in the product | Purpose HERO atom at every size | Phase 124 | First surfacing of the field; the planner must wire the read (it's already on the definition JSONB). |
| Authoring entry = "Build a workflow" → straight into the describe screen | Two-door fork (Describe & run / Author & govern) at the Studio entry | Phase 124 | The describe screen becomes Door A; the existing Builder drafted view becomes Door B. |

**Deprecated/outdated:** none — all reuse seams are current (Phase 103/094/101 era, actively maintained).

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The human-facing **deliverable NAME** in the output atom (e.g. "Status Report") is a friendly label derived from the workflow name/emitter, NOT a guaranteed dedicated field. The VERIFIED mechanism is "terminal `llm_emit` present → file deliverable; absent → answer in chat." The file extension (`.docx`) comes from the emitter/template, which is run-time bound (`assets`/`template_asset_service`, Phase 101), not always statically declared on the definition. | Standard Stack (output atom), Pitfall 4 | LOW-MEDIUM — if the planner expects a static "deliverable name + extension" field on the definition, it may not exist for all workflows. Mitigation: render the honest mechanism (file vs chat) and use the workflow name + emitter/asset kind for the label; confirm exact label string against 046-A and operator at plan/UAT. [ASSUMED] |
| A2 | The run-surface soul header reads the workflow DEFINITION via the existing run-frame fetch (`getThreadWorkflow` already used by PhaseTimeline for `definition_name`) — i.e. the definition is reachable on the run surface without a new endpoint. `getThreadWorkflow` returns `definition_name` but the FULL definition (for spine/tier/purpose) may need confirmation that the run frame carries `phases`/`business_requirement`, or a small read. | Architecture Pattern 2, Environment Availability | MEDIUM — if the run-frame payload does not include the full definition, the planner needs to source it (e.g. fetch the published definition by id, or extend the existing read — staying additive, no shared-path fork). Verify the `ThreadWorkflowState` shape during planning. [ASSUMED] |

**If this table were empty:** it is not — A1 (deliverable label) and A2 (run-frame definition availability) need confirmation at plan/discuss time. Both are presentation-data sourcing questions, not governance risks.

## Open Questions

1. **Does the run-frame (`ThreadWorkflowState` / `getThreadWorkflow`) carry the full definition the soul header needs (phases for the spine, `business_requirement`, inputs)?**
   - What we know: `getThreadWorkflow` returns `definition_name`, `run_status`, `mode`, `current_phase_index`, `total_phases` (PhaseTimeline.tsx:34-38 `RunFrame` pick). The live `usePhases` slice carries phase status but those are run-state phases, not the authored definition's full config (and reading them would risk the G-5 line + the `phase-0` slug bug).
   - What's unclear: whether the full authored definition (with `business_requirement`, `inputs`, `phases[].config`) is in scope on the run surface or needs a small additive read.
   - Recommendation: During planning, read the full `ThreadWorkflowState` type. If the definition isn't present, source it additively (fetch the published definition by id) — never by reading `PhaseCard`/live-phase internals. Keep it a sibling-only read.

2. **Exact deliverable-label copy for the output atom.**
   - What we know: mechanism is verified (terminal `llm_emit` → file; else chat).
   - What's unclear: the precise label string for a file deliverable (workflow name? emitter label? template filename?).
   - Recommendation: Match 046-A's rendered example; confirm the label source with the operator at UAT. The honest fallback ("produces: answer in chat") is locked.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + frontend toolchain (vite/vitest) | The whole phase (build + tests) | ✓ | vitest `test`/`test:watch` scripts present; `vite.config.ts` + `vitest.config.ts` present | — |
| Existing in-repo components (deriveTier, Builder, PhaseFormPanel, PublishGauntlet, WorkspacePanel) | All soul + door work | ✓ | current (Phase 103/094/101 era) | — |
| Sketch HTML (046-A, 047-A) | The acceptance bar (visual diff) | ✓ | `.planning/sketches/046-*/index.html`, `047-*/index.html` | — |
| Backend / DB / migrations | NOTHING (D-02 pure-FE) | n/a | — | — (no backend touch) |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** none. Everything required is in-repo.

## Validation Architecture

> nyquist_validation is enabled (not disabled in config). This is a pure-FE visual/interaction re-skin whose acceptance bar is two operator-approved sketches — so validation is a mix of component-render assertions (automatable), structural invariants (automatable), and sketch-match + lived-experience UAT (manual/Chrome MCP).

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (+ @testing-library/react, vitest-axe) — already the repo standard for workflow components |
| Config file | `frontend/vitest.config.ts` (+ `vite.config.ts`) |
| Quick run command | `cd frontend && npx vitest run src/components/workflows` |
| Full suite command | `cd frontend && npm test` (`vitest run`) |

Existing sibling tests prove the patterns: `PhaseSpineGraph.test.tsx` (incl. the G-5 source-grep assertion lines 153-158), `PhaseFormPanel.test.tsx`, `PublishGauntlet.test.tsx`, `panel/__tests__/PhaseTimeline.test.tsx`, `panel/__tests__/WorkspacePanel.test.tsx`.

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WUX-01 | Soul renders all 5 atoms at `scale="card"` (purpose hero, needs, glyph-dot spine, tier chip, output) | unit/render | `npx vitest run src/components/workflows/WorkflowSoul.test.tsx` | ❌ Wave 0 |
| WUX-01 | **Tier-consistency invariant:** card / run / pub render the SAME `data-tier` for one fixture | unit/invariant | `npx vitest run src/components/workflows/WorkflowSoul.test.tsx -t "tier consistency"` | ❌ Wave 0 |
| WUX-01 | Glyph-dot spine strips type ribbons + phase-index numbers (no "server"/"agent" text, no index digits) | unit/render | `npx vitest run src/components/workflows/PhaseSpine.test.tsx` | ❌ Wave 0 |
| WUX-01 | Tier chip is glyph + WORD (never colour-alone) at every scale | unit/a11y | `npx vitest run src/components/workflows/WorkflowSoul.test.tsx -t "glyph + word"` | ❌ Wave 0 |
| WUX-01 | D-03 honest empty-states: null `business_requirement` → "draft · purpose not declared yet"; no terminal `llm_emit` → "produces: answer in chat" | unit/render | `npx vitest run src/components/workflows/WorkflowSoul.test.tsx -t "empty state"` | ❌ Wave 0 |
| WUX-01 | **G-5 additive-sibling proof:** the run soul source never imports `PhaseTimeline`/`PhaseCard`; both hot files have ZERO internal diff | unit/source-grep + git diff | `npx vitest run src/components/workflows/WorkflowSoul.test.tsx -t "G-5"` + `git diff --stat -- frontend/src/components/panel/PhaseTimeline.tsx frontend/src/components/panel/PhaseCard.tsx` (must be empty) | ❌ Wave 0 (grep test) |
| WUX-02 | Two doors render side by side; "‹ both doors" returns; "switch to Author & govern ›" strip present in describe door | unit/render | `npx vitest run src/components/workflows/WorkflowDoorSwitch.test.tsx` | ❌ Wave 0 |
| WUX-02 | `deriveTier` live recompute: flip `citation_policy` strict→draft → tier STRICT→MIDDLE; toggle floor gates off → MIDDLE→LOOSE (reuses the existing Builder dial path) | unit/interaction | `npx vitest run src/components/workflows/WorkflowDoorSwitch.test.tsx -t "live recompute"` | ❌ Wave 0 |
| WUX-02 | Judge (`llm_judge_rubric`) renders LOCKED/non-removable in every tier | unit/render | `npx vitest run src/components/workflows/WorkflowDoorSwitch.test.tsx -t "judge locked"` | ❌ Wave 0 |
| WUX-02 | D-01 preservation: library-card Run path (`doRun`) is NOT wrapped by the fork — Run still launches into a thread | integration/render | `npx vitest run src/pages/__tests__/WorkflowsPage*.test.tsx -t "run launches"` | ❌ Wave 0 (assert on existing path) |
| WUX-01 (publish) | Publish modal PREPENDS the soul block; the 8-stage gauntlet ladder/verdict render UNCHANGED (D-06) | unit/render | `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` | ✅ (extend existing) |

### Sampling Rate
- **Per task commit:** `cd frontend && npx vitest run src/components/workflows` (the soul/door/publish unit + invariant tests).
- **Per wave merge:** `cd frontend && npm test` (full vitest suite) — confirms no regression in `panel/` (PhaseTimeline/PhaseCard/WorkspacePanel), workflows, pages.
- **Phase gate:** full vitest suite green + `git diff` of the two G-5 hot files empty + **manual sketch-match UAT** (Chrome MCP / operator) of all 3 soul sizes + both doors against 046-A/047-A before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] `frontend/src/components/workflows/WorkflowSoul.test.tsx` — 5-atom render, tier-consistency invariant, empty-states, glyph+word, G-5 source-grep — covers WUX-01.
- [ ] `frontend/src/components/workflows/PhaseSpine.test.tsx` — glyph-dot, ribbons/indices stripped, ◆ emit tint — covers WUX-01 (spine).
- [ ] `frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx` — two doors, returns, live recompute, judge-locked — covers WUX-02.
- [ ] Extend `PublishGauntlet.test.tsx` — soul block prepended, ladder unchanged (D-06).
- [ ] Extend `WorkflowsPage` / `WorkspacePanel` tests — Run-not-wrapped (D-01), soul `<PanelSection>` sibling mounts (D-07).
- [ ] G-5 backstop: a `git diff --stat` check (or a CI step) asserting `panel/PhaseTimeline.tsx` + `panel/PhaseCard.tsx` are unmodified.
- Framework install: none — vitest + testing-library already present.

### Sketch-Match Verification (the SC#4 acceptance bar — manual/Chrome MCP)
Wire-format + render assertions are insufficient per G-4. Required manual/Chrome MCP checks:
- **046-A all 3 sizes:** open library card / run header / publish summary; confirm purpose HERO, glyph-dot spine (no ribbons/indices), one tier chip (glyph+WORD), needs, output — and that switching workflow changes tier/spine/needs/output in lockstep across all three.
- **047-A both doors, both contexts:** Describe & run vs Author & govern side by side; "‹ both doors" returns; "switch to Author & govern ›" strip; in the govern door flip `citation_policy` + gates and watch the chip recompute STRICT→MIDDLE→LOOSE; confirm `llm_judge_rubric` LOCKED; toggle Authoring↔Running context.
- **Both themes** (Deep Midnight; confirm Deep Mode chrome byte-identical — D-08).
- **Mobile/375 width** (046-A toolbar tests 375) — soul still legible.

## Security Domain

> `security_enforcement` default-enabled. This phase is FE-only presentation chrome over READ-ONLY data with NO new input, NO new write path, NO new endpoint, NO auth surface. The ASVS surface is minimal but the relevant control is real.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched; the run/launch path is unchanged (D-01) and already RLS-scoped server-side. |
| V3 Session Management | no | No session change. |
| V4 Access Control | no | No new data exposure: every field rendered (`business_requirement`, `inputs`, `phases`) is already owner-scoped and already returned by the existing `listPublishedWorkflows`/`getThreadWorkflow` reads. 124 surfaces fields the user already owns; no cross-user read. |
| V5 Input Validation | yes (rendering) | **XSS on user-authored strings.** `business_requirement`, phase names, input keys, deliverable labels are user-authored. Render as **plain React text children** (auto-escaped) — never `dangerouslySetInnerHTML`. This mirrors the existing PhaseCard XSS rule (PhaseCard.tsx:26-28 / T-094-03-01). |
| V6 Cryptography | no | None. |

### Known Threat Patterns for {React FE re-skin over user-authored workflow strings}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via `business_requirement` / phase name / deliverable label rendered as HTML | Tampering / Elevation | Plain React text children only; never raw-HTML props. (Existing repo discipline — PhaseCard.tsx, PhaseSpineGraph.tsx render all agent strings as escaped children.) |
| Tier misrepresentation (a soul shows LOOSE while the gate set is STRICT) — an honesty/trust defect | Repudiation / Information disclosure | ONE shared `tierForDefinition` derivation; the consistency invariant test; the chip is always derived (`deriveTier`), never a stored label. [VERIFIED: deriveTier.ts:1-22] |
| Dishonest empty-state (blank purpose reads as "no governance") | Repudiation | D-03 honest empty-states, always-rendered atom. |

## Sources

### Primary (HIGH confidence) — live source, this session
- `frontend/src/components/workflows/deriveTier.ts` — `deriveTier`/`TIERS`, judge-always-on, pure client-side derivation.
- `frontend/src/pages/WorkflowsPage.tsx` — library card, `tierForDefinition` (106-128), `PHASE_GLYPHS` (44-51), `entryInputKeys` (132-139), `PhaseChain`/`TierBadge`, Run path.
- `frontend/src/pages/WorkflowBuilderPage.tsx` — the describe-first authoring entry (271-352) + the drafted Builder (read-only spine + 400px form panel).
- `frontend/src/components/workflows/PhaseSpineGraph.tsx` — read-only vertical spine (govern door) + the G-5 source-grep test precedent.
- `frontend/src/components/workflows/PhaseFormPanel.tsx` — `citation_policy` (688), gate/scope/model advanced controls (the govern-door internals).
- `frontend/src/components/workflows/PublishGauntlet.tsx` — the publish-summary surface (soul block prepends; ladder = WUX-03).
- `frontend/src/components/panel/WorkspacePanel.tsx` (163-205) + `panel/PhaseTimeline.tsx` + `panel/PhaseCard.tsx` — the run-surface host + the G-5 hot files (additive-sibling seam at line 187).
- `frontend/src/components/layout/ChatLayout.tsx` (91-100, 296-302) — `doRun` (preserved launch) + the Workflows IA mount.
- `backend/app/models/harness.py` — `WorkflowDefinition` (221-240), `business_requirement` (240), `inputs`/`InputFieldSpec` (204-234), `LlmEmitPhaseConfig`/`citation_policy`/`emitter` (123-154), `ValidatorSpec.kind` (170-182).
- `.planning/sketches/046-workflow-soul-object/README.md` + `047-strict-loose-two-doors/README.md` + `MANIFEST.md` (Running Design Decisions 36/37, Phase 124 session block) — the locked design contract + reuse-vs-net-new tables.
- `.planning/phases/124-.../124-CONTEXT.md`, `.planning/REQUIREMENTS.md` (§WUX-01/02), `.planning/STATE.md`, the two reported-bug files (BUG-260610-01, BUG-260609-04).

### Secondary (MEDIUM confidence)
- Frontend test inventory (`PhaseSpineGraph.test.tsx` G-5 grep precedent; `vitest.config.ts`; `package.json` test scripts) — establishes the Validation Architecture framework.

### Tertiary (LOW confidence)
- None. Every claim is verified against live source; no WebSearch/training-only claims in this research.

## Metadata

**Confidence breakdown:**
- Standard stack / reuse seams: **HIGH** — every component, signature, and field read directly from live source this session.
- Architecture (soul composition, two-door = Builder, G-5 sibling seam): **HIGH** — the mounting idioms (`<PanelSection>`, intra-view fork, `doRun`) are all verified in place.
- Pitfalls / landmines (tier drift, G-5, the two open bugs, empty-states): **HIGH** — sourced from the bug reports' own `re_open_trigger` text and the live derivation/mount code.
- Data-sourcing assumptions (deliverable label A1, run-frame definition availability A2): **MEDIUM** — mechanism verified; the exact label string + run-frame payload shape need a quick plan-time confirmation.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable — pure-FE, no fast-moving external deps; only risk is concurrent edits to the named workflow/panel components).
