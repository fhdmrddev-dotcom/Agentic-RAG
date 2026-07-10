# Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards - Research

**Researched:** 2026-06-27
**Domain:** Frontend visual re-skin (React + Vite + Tailwind) of two already-shipped Workflow Studio surfaces, under the Phase-124 soul, with a cross-cutting icon-integration concern (3D phase glyphs + provider engine chips)
**Confidence:** HIGH (every claim grounded in the actual source files, the operator-approved sketch contract, and verified package/icon checks; the only MEDIUM/LOW items are the two net-new wire fields, flagged explicitly)

## Summary

Phase 127 (WUX-03, STRETCH) is a **pure-frontend, presentation-only re-skin** of two shipped surfaces — the publish gauntlet (`PublishGauntlet.tsx`, winner 020-B) and the live phase spine (`PhaseCard.tsx` / `PhaseTimeline.tsx`, winner 008-D/022-A). There is **no CONTEXT.md**: the design is already locked by an operator-approved G-2 sketch (winners **051-A** + **052-A**, approved 2026-06-27) and fully captured in the `sketch-findings-agentic-rag` skill. The skill's decisions are LOCKED inputs, not suggestions. This research translates that contract into exact code seams, the icon-integration mechanism, the honesty/a11y contracts to preserve verbatim, the G-5 harness-safety caution, and a validation architecture.

Both surfaces sit UNDER the Phase-124 `WorkflowSoul` (which STAYS, byte-behavior-unchanged). The gauntlet's `GauntletSpine` (8 wrapping boxes today) becomes a compact horizontal energy-spine with a 3D icon per stage; its resolved state leads with a plain-worded verdict and demotes the verbatim 5-field `PublishVerdict` grid behind a `<details>` "Show raw verdict". The live spine's `PhaseCard` goes "calm at rest, comprehensive on the active step": idle = one dim still line (no `oneLiner`, no animation — SC#2); active = bloom (glow + left bar + node + energy comet + running-ONLY activity line + AI-engine chip); done = folded essence; failed = the closed-taxonomy reason (unchanged). The cross-cutting icon work upgrades the shared `PHASE_GLYPHS` map (flat → 3D) in one additive swap and reuses Phase-128's `providerLogo()` seam for the engine chips.

**The single highest-risk technical decision is the 3D-icon delivery mechanism.** The sketches use the `iconify-icon` web component loaded from a CDN at runtime (`code.iconify.design/...`) — fine for a throwaway mockup, **unacceptable for production** (network-dependent, renders empty offline, and `iconify-icon` is NOT currently a frontend dependency). Verified recommendation: **`unplugin-icons` + `@iconify-json/fluent-emoji` (build-time SVG codegen)** so every 3D glyph is bundled, no production icon can render empty, and there is zero runtime network dependency. This also structurally enforces the icon-convention's "verify-or-bundle" rule (the empty `fluent-emoji:direct-hit` → `bullseye` trap is impossible when the slug is resolved at build time).

**Primary recommendation:** Re-skin presentation only inside the three target files (plus the additive `PHASE_GLYPHS` swap in `soulData.ts`); preserve every honesty/a11y contract verbatim; deliver 3D glyphs via `unplugin-icons` (build-time bundle, not CDN); reuse `providerLogo()` for engine chips; re-run the full G-5 replay/component test set green to prove visual-only.

## User Constraints (from the operator-approved sketch — there is no CONTEXT.md)

> Per the objective and CLAUDE.md project-skills rule, the `sketch-findings-agentic-rag` skill IS the design contract for this phase. Treat its decisions as LOCKED, identical authority to CONTEXT.md `## Decisions`.

### Locked Decisions (winners 051-A + 052-A, operator 2026-06-27)

**Gauntlet (051-A) — locked:**
- The 8 server-fixed stages render as a **compact horizontal energy-spine** (one node + one 3D icon per stage), NOT eight wrapping boxes. Passed stages glow green w/ a check badge; the golden run pulses amber with an **energy comet flowing into it**; a blocked stage turns red. `blocked_stage` (server truth) still drives the highlight — visual only.
- The resolved state **leads with a plain-worded verdict** (`🎉 Published — v1 is live` / `⚖️ Blocked by the grader because…` / `⛔ Blocked early — structure`).
- The raw 5-field `PublishVerdict` grid is **demoted behind a `<details>` "Show raw verdict"** — the verbatim render + the `▦ rendered verbatim` provenance cap stay INSIDE the disclosure.
- The golden-run wait is the **hero** (glowing panel, animated aura, live elapsed clock, engine chips).
- Sits UNDER `<WorkflowSoul scale="pub">` (Phase 124 — unchanged).

**Live step-flow (052-A) — locked:**
- "**Calm at rest, comprehensive on the active step**." Idle steps = one dim still line (title + faint "Locked") — NO type-lecture / `oneLiner`, NO placeholder, NO animation (SC#2).
- Active step **blooms**: amber wash + left bar + glowing node + **vertical energy comet flowing in** + the **running-ONLY activity line** + the **AI-engine chip**.
- Done folds to a one-line essence (✓ + title, "expand ▸"); failed renders the closed-taxonomy reason + where-line (failed-as-failed, never empty).
- Sits UNDER `<WorkflowSoul scale="run">` (Phase 124 — unchanged).
- ⚠ G-5: `PhaseCard`/`PhaseTimeline` are shared with the live harness run — re-run replay tests; visual only, not a behavior rewrite.

**Icon convention (cross-cutting, RDD 43) — locked:**
- Provider/model icons = ONE source `@lobehub/icons` via Phase-128 `providerLogo.tsx` — reuse, don't re-map.
- Phase-type icons = ONE source `PHASE_GLYPHS` (soulData.ts); 127 upgrades flat → 3D in ONE additive swap that propagates to soul card/run/pub + 127 gauntlet stages + step cards.
- Decorative/status icons: VERIFY each slug resolves or bundle the SVG (the empty `fluent-emoji:direct-hit` → `bullseye` trap).
- **Energized intensity is the operator-loved default**; a calm anchor is kept as an in-build toggle (the build can dial exact glow/motion).

### Claude's Discretion (build-tunable)
- Exact glow/motion intensity (energized default; calm-mode override available).
- The concrete 3D-icon delivery mechanism (this research recommends `unplugin-icons`; see § Icon Integration).
- The exact worded-verdict copy strings (lead-with-words; the sketch shows examples).
- Whether the engine chip's per-phase provider is wired net-new now or rendered honestly-absent until a wire field exists (see Open Questions Q1).

### Deferred Ideas (OUT OF SCOPE)
- Live per-phase backend progress streaming for the publish golden run (`PublishingNotice` comment: "Live per-phase progress needs backend streaming → OUT OF SCOPE").
- The golden-run-view route (`RunLink` is a disabled "coming soon" button — D-103-A, deferred to a later phase). 127 does NOT make it navigable.
- Any backend/schema/migration change. This phase is frontend-only.
- Threading soul state into PhaseCard internals (G-5 red line — forbidden, not deferred).

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| WUX-03 (STRETCH) | "The publish gauntlet renders as a pip-strip + worded verdict with raw-on-demand, and idle PhaseCards stay quiet." | SC#1 → § 051 gauntlet re-skin seams (GauntletSpine → energy-spine; VerdictFields → behind `<details>`; worded verdict leads). SC#2 → § 052 living step-flow seams (idle quiet/still; active-only bloom). Both → § Icon Integration + § G-5 Harness Safety + § Validation Architecture. |

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Gauntlet energy-spine rendering | Browser / Client (React presentation) | — | Pure re-skin of `GauntletSpine`; `blocked_stage` is server truth already on the wire — no new tier work. |
| Worded verdict + raw-on-demand disclosure | Browser / Client | — | New presentation layer over the EXISTING verbatim `PublishVerdict`; the verdict is computed server-side (publish gauntlet), never re-derived. |
| Live step-flow density (idle/active/done/failed) | Browser / Client | — | Re-skin of `PhaseCard` presentation; the status model + failure taxonomy already exist and DO NOT change. |
| 3D phase-type glyphs | Browser / Client (build-time bundle) | Build tooling (Vite plugin) | `unplugin-icons` resolves SVGs at build time → bundled assets, no runtime/API tier. |
| Provider engine chips | Browser / Client | — | Reuses Phase-128 `providerLogo()` (`@lobehub/icons`, pure SVG, no network). The provider value is already-resolved server truth (`runs.provider` / `sub_agent_model`). |
| Per-phase engine provider (the chip's data) | API / Backend (IF wired net-new) | Browser / Client | The `phase_started` wire event carries NO model/provider today (see Open Questions Q1) — surfacing it per-phase is the one place a net-new wire field could be needed; otherwise render honestly-absent. |

## Standard Stack

This phase adds NO new app libraries beyond the icon-delivery tooling. The frontend stack is fixed by CLAUDE.md (React + Vite + Tailwind + shadcn/ui, Aether Deep Midnight). The one net-new dependency decision is the 3D-icon mechanism.

### Core (already installed — reuse, do not re-add)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@lobehub/icons` | ^5.10.0 `[VERIFIED: frontend/package.json:16]` | Provider/model brand SVG marks for engine chips | Already the single-source provider-logo lib (Phase 128); the icon convention mandates it. Pure SVG via deep `components/{Color,Mono}` subpaths (antd-free). |
| `react` + `vite` + `tailwindcss` | (project) | Component + build + styling | Project stack (CLAUDE.md). |
| `vitest` `^4.1.0` + `vitest-axe` `^0.1.0` `[VERIFIED: frontend/package.json]` | Test runner + a11y assertions | The existing G-5 replay/component tests run on this; `vitest run` is the full-suite command. |

### Supporting (net-new — for the 3D phase glyphs; build-time, NOT runtime)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `unplugin-icons` | 23.0.1 `[VERIFIED: npm view + slopcheck OK (npm)]` | Vite plugin that compiles Iconify icon slugs to **bundled** React SVG components at build time | The recommended 3D-glyph mechanism — no runtime API, no empty-icon trap, tree-shaken. Import e.g. `import Shield from '~icons/fluent-emoji/shield'`. |
| `@iconify-json/fluent-emoji` | 1.2.7 `[VERIFIED: npm view + slopcheck OK (npm)]` | The offline icon-data package `unplugin-icons` reads to resolve `fluent-emoji:*` slugs at build time | Install alongside `unplugin-icons`; provides the 3D Fluent-Emoji set locally (no network). |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `unplugin-icons` (build-time bundle) | `iconify-icon` web component via CDN `<script src="code.iconify.design/...">` (what the SKETCH uses) | **REJECTED for production.** Fetches icon data from the Iconify API at runtime → renders empty offline / on a network blip; adds a runtime `<script>`; `iconify-icon` is not a current frontend dep. The sketch's own README says "internet on for the 3D icons; emoji fallbacks render offline" — a mockup affordance, explicitly not shipped art. `[CITED: iconify.design/docs/iconify-icon]` |
| `unplugin-icons` | `@iconify/react` (`<Icon icon="fluent-emoji:shield" />`) | Also fetches from the Iconify API at runtime by default (client-only, post-mount render, hydration-delay) → same offline/empty risk. Verified-installable (`@iconify/react@6.0.2`) but not offline-safe without a self-hosted API or `@iconify/json` + manual bundling. `[CITED: iconify.design/docs/icon-components/react]` |
| `unplugin-icons` | Hand-bundle a handful of SVGs as static assets in `src/assets/` | Viable for a SMALL fixed set (the gauntlet has 8 stages + ~3 verdict glyphs; the spine has 6 phase types). Zero new build dep, fully offline. Downside: manual curation + a fallback map; no tree-shaking ergonomics. **Acceptable fallback** if the team prefers not to add a Vite plugin (see Open Questions Q2). |

**Installation (if `unplugin-icons` path chosen):**
```bash
# in frontend/
npm install -D unplugin-icons @iconify-json/fluent-emoji
```
Then register in `vite.config.ts` (`Icons({ compiler: 'jsx', jsx: 'react' })`) and a TS shim for `~icons/*` (the plugin docs provide `types/unplugin-icons.d.ts`). Each glyph is then a normal bundled React component.

**Version verification:** `unplugin-icons@23.0.1`, `@iconify-json/fluent-emoji@1.2.7`, `@iconify/react@6.0.2` all confirmed present on the **npm** registry via `npm view` 2026-06-27. NONE are currently in `frontend/package.json`.

## Package Legitimacy Audit

> The candidate packages were checked on the CORRECT ecosystem (npm). Note the cross-ecosystem trap below — slopcheck defaults to PyPI and falsely flagged all three as SLOP until `--ecosystem npm` was applied. These are npm packages.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@lobehub/icons` | npm | mature (already installed) | high (in use) | github.com/lobehub/lobe-icons | (already a dep) | Approved — reuse, do not re-add |
| `unplugin-icons` | npm | mature (v23) | very high (popular Vite/Iconify plugin) | github.com/unplugin/unplugin-icons | **[OK] (npm)** | Approved |
| `@iconify/react` | npm | mature (v6) | very high | github.com/iconify/iconify | **[OK] (npm)** | Approved (alternative path only) |
| `@iconify-json/fluent-emoji` | npm | current (v1.2.7) | high (icon-data pkg) | (generated from github.com/iconify/icon-sets) | **[OK] (npm)** — note: "no source repo linked" (expected for a generated `@iconify-json` data pkg) | Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none (the initial PyPI-ecosystem SLOP verdict was a false positive from the documented ~9% cross-ecosystem confusion vector; re-running with `--ecosystem npm` returned all `[OK]`).
**Packages flagged as suspicious [SUS]:** none. `@iconify-json/fluent-emoji`'s "no source repo linked" note is benign — `@iconify-json/*` packages are auto-generated from the upstream `@iconify/json` mono-repo (the verified source); the data is the same set the Iconify API serves (confirmed: the `bullseye` SVG body was fetched directly).

## Architecture Patterns

### System Architecture Diagram

```
                    ┌─────────────────────────────────────────────────────┐
                    │  soulData.ts  ──  PHASE_GLYPHS (flat → 3D, 1 swap)    │
                    │  (single source; propagates to ALL consumers)        │
                    └───────┬───────────────────────┬─────────────────────┘
                            │                        │
        ┌───────────────────▼──────────┐   ┌─────────▼──────────────────────┐
        │  PUBLISH SURFACE             │   │  RUN SURFACE                    │
        │  PublishGauntlet.tsx (modal) │   │  WorkspacePanel.tsx             │
        │                              │   │                                 │
        │  <WorkflowSoul scale="pub">  │   │  PanelSection "This workflow"   │
        │   (Phase 124 — UNCHANGED)    │   │   └ RunSoul → <WorkflowSoul      │
        │  ─────── 127 re-skins ─────  │   │        scale="run"> (124, UNCH) │
        │  GauntletSpine ──► energy-   │   │  PanelSection "Workflow"        │
        │    spine (8 nodes + 3D icon, │   │   └ PhaseTimeline (G-5) ◄─ 127  │
        │    blocked_stage drives tone)│   │        └ <ol> of PhaseCard (G-5)│
        │  Worded verdict (NEW, leads) │   │             ◄── 127 re-skins    │
        │  VerdictFields ──► behind    │   │   idle=quiet · active=bloom +   │
        │    <details> "Show raw"      │   │   energy comet + activity line +│
        │  CriterionRow/LintRow/etc    │   │   ENGINE CHIP · done=fold       │
        │    (REUSE — stay first-class)│   │   failed=taxonomy (UNCHANGED)   │
        └──────────┬───────────────────┘   └──────────┬──────────────────────┘
                   │                                   │
                   └─────────────┬─────────────────────┘
                                 ▼
                   providerLogo(provider)  [Phase 128 — REUSE]
                   @lobehub/icons brand mark (pure SVG) for engine chips
                   provider source: runs.provider / sub_agent_model (server truth)

   Wire/data (unchanged by 127):
     publish:  POST /workflows/{id}/publish → PublishOutcome (4 kinds) → PublishVerdict (5 fields, verbatim)
     run:      SSE phase_started/completed/… → StreamsProvider demux → phasesByThread → Phase[] → PhaseCard
```

A reader traces the primary use case (publish → read verdict; run → watch live steps) by following the arrows: data enters from the existing server endpoints/SSE (unchanged), flows through the existing state (unchanged), and only the **presentation leaf** (GauntletSpine / VerdictFields / PhaseCard) is re-skinned. `PHASE_GLYPHS` and `providerLogo()` are the two shared icon seams both surfaces draw from.

### Component Responsibilities (file → role)

| File | Role in 127 | Change type |
|------|-------------|-------------|
| `frontend/src/components/workflows/PublishGauntlet.tsx` | Host of the gauntlet re-skin: `GauntletSpine` → energy-spine; NEW worded-verdict block; `VerdictFields` demoted behind `<details>`; `PublishingNotice` → golden-run hero + engine chips | Re-skin (presentation only; honesty contracts unchanged) |
| `frontend/src/components/panel/PhaseCard.tsx` ⚠G-5 | Host of the living step-flow re-skin: idle quiet / active bloom + activity line + engine chip / done fold; status atoms + failure taxonomy + APG accordion unchanged | Re-skin (presentation only) |
| `frontend/src/components/panel/PhaseTimeline.tsx` ⚠G-5 | Structurally unchanged (`<ol>` of `PhaseCard`); the energy-connector spine is presentational | Minimal/presentational |
| `frontend/src/components/workflows/soulData.ts` | `PHASE_GLYPHS` flat → 3D (one additive map swap) — propagates to soul card/run/pub + 127 stages + step cards | Additive map swap |
| `frontend/src/lib/providerLogo.tsx` | The engine-chip logo seam — REUSE (do not re-map) | No change (consumer-side import) |
| `frontend/src/components/workflows/WorkflowSoul.tsx` / `PhaseSpine.tsx` | Phase-124 soul — STAYS; 127 rides under it | No change (and PhaseSpine auto-inherits the 3D `PHASE_GLYPHS`) |
| `vite.config.ts` (+ a TS shim) | Register `unplugin-icons` (IF that path chosen) | Build config add |

### Pattern 1: Energy-spine driven by server-truth `blocked_stage` (gauntlet)
**What:** Replace the wrapping-box ladder with a horizontal spine of 8 nodes (one 3D icon each). The visual tone (passed-green / running-amber-with-comet / blocked-red) is a VISUAL derivation of the existing `blockedIndex` logic — the PASS/BLOCK truth still comes from the server verdict.
**When to use:** The resolved + in-flight gauntlet render.
**Example (current logic to preserve, re-skinned):**
```tsx
// Source: PublishGauntlet.tsx:275-301 (GauntletSpine) — the blockedIndex derivation STAYS;
// only the per-stage markup changes from a <div className="rounded border …"> box to an
// energy-node (.estage/.enode) with a bundled 3D <Icon/>. blocked_stage is server truth.
const blockedIndex = blockedStage ? STAGES.findIndex((s) => s.codes.includes(blockedStage)) : -1
const isPassed = blockedIndex === -1 ? !running : i < blockedIndex
// tone: isBlocked → red ; isPassed → green+check ; running && i === 5 → amber + comet
```
The CSS energy patterns (comet, aura, flow keyframes) are in `references/workflow-energized-reskin.md` and `sources/051-gauntlet-pip-strip/index.html:52-119`.

### Pattern 2: Worded verdict leads; verbatim grid behind `<details>` (gauntlet)
**What:** A NEW plain-language verdict headline becomes the resolved-state hero; the existing `VerdictFields` 5-field grid + the `▦ rendered verbatim` cap move INSIDE a `<details><summary>Show raw verdict…</summary>`. The judge per-criterion rows (`CriterionRow`) stay FIRST-CLASS (not inside the disclosure) on a block.
**When to use:** Any resolved outcome render.
**Example:**
```tsx
// Source: PublishGauntlet.tsx:204-220 (VerdictFields) — render UNCHANGED, just relocated
// into a <details>. The honesty cap ("rendered verbatim from the server — not re-derived")
// MUST stay inside. Lead with a worded headline derived from verdict.published / blocked_stage.
<details data-testid="raw-verdict"><summary>Show raw verdict — the 5 server fields, verbatim</summary>
  <VerdictFields verdict={verdict} />
</details>
```

### Pattern 3: Density-by-status — quiet idle, bloomed active (live step-flow)
**What:** Branch the `PhaseCard` body presentation on status. `pending` → one dim still line (NO `meta.oneLiner`, NO progressbar pulse, NO animation). `running` → bloom (amber wash + left bar + glowing node + vertical energy comet + the running-only activity line + the engine chip). `done` → folded essence (✓ + title + "expand ▸"). `failed` → the existing `classifyFailure` block (unchanged).
**When to use:** Every phase row.
**Critical:** The `oneLiner` type-lecture (`PhaseCard.tsx:357`, `<p>{meta.oneLiner}</p>`) is rendered for ALL open phases today; SC#2 requires it GONE from idle (the sketch drops it entirely from idle/done — it belongs only on the active step's activity line, which is a different, running-only string).

### Anti-Patterns to Avoid
- **Leading the resolved gauntlet with the raw 5-field grid** (debugger output to a business user) — lead with words, keep the grid on-demand. (sketch 051 "What to Avoid")
- **Animation or type-education on idle/done steps** — kills the SC#2 quiet-at-rest read and the 3-second scan. Motion ONLY on the active step. (sketch 052 "What to Avoid")
- **Threading soul state into `PhaseCard` internals** — G-5 red line; the soul is an additive SIBLING header (already mounted as a separate `PanelSection` in `WorkspacePanel.tsx:264-277`). Do not give `PhaseCard`/`PhaseTimeline` a soul prop. (`references/workflow-energized-reskin.md`)
- **CDN-at-runtime icons** (`iconify-icon` web component / `@iconify/react` default) in production — renders empty offline; bundle instead.
- **Re-mapping the provider→logo map per component** — reuse `providerLogo()`. (icon-convention)
- **Shipping an unverified icon slug** — renders empty (the `direct-hit` trap). Build-time resolution (`unplugin-icons`) makes this impossible; manual SVGs need a fallback map.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Provider/model logos | A per-surface SVG map or hand-drawn marks | `providerLogo(provider)` from `frontend/src/lib/providerLogo.tsx` | Phase-128 already solved this with the antd-free deep-subpath `@lobehub/icons` import; the icon convention mandates byte-identical marks across surfaces. The sketch's hand-built Kimi/GLM/MiniMax marks are explicitly NOT shipped art. |
| Phase-type glyph map | A second glyph map in PhaseCard/gauntlet | The shared `PHASE_GLYPHS` in `soulData.ts` | One additive swap propagates to all soul surfaces + 127 surfaces at once — prevents 3D cards under a flat-glyph soul header. `soulData` was extracted verbatim specifically to forbid this drift. |
| 3D icon loading | A runtime CDN `<script>` or per-icon fetch | `unplugin-icons` (build-time SVG codegen) or bundled static SVGs | Runtime fetch = empty icons offline + the exact `direct-hit` empty trap; build-time = bundled, tree-shaken, verifiable. |
| The publish verdict | Any client recomputation of `published`/`blocked_stage` | Render `PublishVerdict` verbatim (it already does) | The verdict is the server-side gauntlet's output (golden run + judge). Re-deriving it is the load-bearing G-6 silent-pass violation the contract forbids. |
| Failure copy | A free-text error render | The existing `classifyFailure` closed taxonomy in `PhaseCard.tsx:173-234` | Closed taxonomy + `reason_unknown` fallback = the never-empty, XSS-safe render. Unchanged by 127. |
| Modal/focus/Escape shell | A new dialog | The existing `PublishGauntlet` modal (RunModal-shared shell) | Already z-[9000], aria-modal, focus-trap, Escape, in-flight close-block. 127 re-skins content INSIDE it, not the shell. |

**Key insight:** Almost everything 127 needs already exists as a shared, tested seam. The phase is overwhelmingly about *presentation density + energy CSS + the icon swap* — the data, state, verdict logic, failure taxonomy, a11y scaffolding, and modal shell are all done and must not be reinvented or behaviorally touched.

## Common Pitfalls

### Pitfall 1: Shipping the sketch's runtime-CDN icon mechanism
**What goes wrong:** Copying `<iconify-icon icon="fluent-emoji:shield">` + the `code.iconify.design` `<script>` from the mockup into production. Icons render empty offline / on a CDN blip, and add a runtime network dependency the app otherwise doesn't have.
**Why it happens:** The sketch HTML uses exactly this (it's a zero-build mockup); it's the most literal translation.
**How to avoid:** Use `unplugin-icons` (build-time bundle) or static SVGs. Confirm no `iconify-icon` / `code.iconify.design` references survive into `frontend/src`.
**Warning signs:** A `<script src="...iconify...">` in `index.html`; `iconify-icon` JSX; icons that flash empty then fill.

### Pitfall 2: The empty-slug trap (`direct-hit` → `bullseye`)
**What goes wrong:** A `fluent-emoji` slug that doesn't exist in the set renders EMPTY. Found live in the sketch: `fluent-emoji:direct-hit` (the 🎯 Goal stage) does not exist; fixed to `fluent-emoji:bullseye`.
**Why it happens:** Slug names are guessed from the emoji, not verified against the set.
**How to avoid:** Build-time resolution (`unplugin-icons` fails the build on a missing slug) OR verify each slug against the Iconify API before use. **Verified 2026-06-27** (via `api.iconify.design/fluent-emoji.json?icons=…`):
- PRESENT: `bullseye`, `shield`, `rocket`, `balance-scale`, `magnifying-glass-tilted-left`, `raised-hand`, `locked`, `party-popper`, `gear`, `memo`, `robot`, `busts-in-silhouette`, `package`, `check-mark-button`, `counterclockwise-arrows-button`.
- MISSING (do NOT use): `direct-hit` (use `bullseye`), `no-entry-sign` (use a verified alternative or bundle the SVG).
**Warning signs:** A blank square where an icon should be; an icon present in some sets but not `fluent-emoji`.

### Pitfall 3: Removing the `oneLiner` everywhere instead of just idle
**What goes wrong:** SC#2 says idle steps drop the type-lecture; over-zealously deleting `PHASE_TYPE_LABEL.oneLiner` could remove honest context the active/expanded step may still want — or, conversely, leaving it on idle fails SC#2.
**Why it happens:** The `oneLiner` is currently rendered unconditionally for any open phase (`PhaseCard.tsx:357`).
**How to avoid:** Branch on status. Idle: no `oneLiner`, no activity line. Active: the running-ONLY activity line (a different string — "Searching the Procurement KB…", from real wire where available). Done/expanded: the sketch folds to a one-line essence, not the type lecture.
**Warning signs:** Idle rows still showing "A fixed server function ran — no AI." style text.

### Pitfall 4: Fabricating the engine chip / activity line on idle or done
**What goes wrong:** Showing "running on DeepSeek" or "14 agents scoring…" on a phase that isn't running, or before the provider is known — a fabricated count / false honesty.
**Why it happens:** The chip + activity line are visually appealing; easy to render them everywhere.
**How to avoid:** Activity line + engine chip are **running-phase only** (sketch 052 a11y contract: "LINE 3 running-phase only — no fabricated counts on idle/done"). The provider value must be real server truth (`runs.provider` / `sub_agent_model`) — if absent for that phase, render the chip honestly-absent, never a guessed provider (see Open Questions Q1).
**Warning signs:** A provider logo on a `pending`/`done` card; a "N agents" count with no live source.

### Pitfall 5: Breaking a G-5 honesty/a11y test while "just re-skinning"
**What goes wrong:** A density change accidentally removes a `data-testid`, a `role`, a status WORD, or the verbatim cap — a source-grep guard or an axe assertion fails.
**Why it happens:** The tests assert on specific markup (`data-testid="gauntlet-spine"`, `verdict-*`, `role="alert"`, the `<s>publish anyway</s>` strike, the 8 stage labels, status WORDS like "Failed"/"Complete").
**How to avoid:** Treat the existing test files as the contract; keep every asserted hook. Re-run the full set (§ G-5 Harness Safety). The `PublishGauntlet.test.tsx` source-grep guards (`typeof entry === "string"`, `"criterion" in`, `golden_run_id != null`, the `<s>` strike) will catch a softened honesty contract.
**Warning signs:** Any of the listed `data-testid`s or roles disappearing from the DOM.

## Runtime State Inventory

> 127 is a presentation-only re-skin, not a rename/refactor/migration. This section is included for completeness because the icon-mechanism choice touches build config.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — verified by grep (no DB/datastore touched; no migration; CLAUDE.md "frontend-only"). | none |
| Live service config | None — no external service config; the publish/run wires are unchanged. | none |
| OS-registered state | None. | none |
| Secrets/env vars | None. (No new provider keys; engine chips reuse already-resolved `runs.provider`.) | none |
| Build artifacts / installed packages | IF `unplugin-icons` path chosen: `frontend/package.json` gains 2 devDeps; `vite.config.ts` gains the plugin; a `~icons/*` TS shim is added; `node_modules` + the build output change. Static-SVG path: assets added under `src/assets/`, no build-config change. | `npm install` after the package add; commit `vite.config.ts` + shim. |

**Nothing found in the first four categories:** confirmed — this is a pure-frontend visual change with no runtime-state surface.

## Code Examples

### Reuse the provider engine chip (both surfaces)
```tsx
// Source: frontend/src/lib/providerLogo.tsx:89-92 + RunCard.tsx:256 usage.
// providerLogo returns an @lobehub/icons React component (pure SVG, size prop) or null.
import { providerLogo } from "@/lib/providerLogo"
const EngineMark = providerLogo(provider /* runs.provider / sub_agent_model — server truth */)
// Render: EngineMark ? <EngineMark size={18} /> : <Bot … />  (the existing null → Bot fallback)
```

### The shared 3D glyph swap (one map; propagates everywhere)
```ts
// Source: frontend/src/components/workflows/soulData.ts:22-29 — the ONLY edit needed to
// upgrade ALL soul surfaces + 127 stages/cards. With unplugin-icons, map each type to a
// bundled 3D component instead of a unicode string (or keep strings + a render-time lookup
// to a bundled-component map, to preserve the existing Record<string,string> consumers).
// Verified fluent-emoji slugs per type: programmatic→gear, llm_single→memo, llm_agent→robot,
// llm_batch_agents→busts-in-silhouette (or a verified chain glyph), llm_human_input→raised-hand,
// llm_emit→package (all PRESENT in the set per the 2026-06-27 API check).
export const PHASE_GLYPHS: Record<string, string> = { /* flat today → 3D set */ }
```
Note: `PhaseSpine.tsx:59` and `PhaseCard.tsx` both read this map; a swap must keep the `?? "•"`/`?? UNKNOWN_PHASE_META` fallbacks so an unknown type never renders empty.

### Honest verbatim verdict, relocated not removed
```tsx
// Source: PublishGauntlet.tsx:512-527 — VerdictFields + RunLink + named_failures render.
// 127 wraps VerdictFields in <details>; CriterionRow/LintRow/etc (named_failures) stay
// OUTSIDE the disclosure (first-class on a block). RunLink + HardWall stay as-is.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Gauntlet = 8 wrapping boxes + a default raw grid leading the resolved state | Energy-spine + worded-verdict-leads + raw-on-demand | This phase (127) | The publish moment reads in ~3s for a business user; honesty preserved on demand. |
| Live phase rows = type label + explainer on EVERY row, slug-first, flat glyphs ("chatty at rest") | Quiet idle / bloomed active / folded done, 3D glyphs | This phase (127) | SC#2 quiet-at-rest; the 022-A target the shipped 094 card never reached. |
| Iconify icons via runtime CDN web component | Build-time bundled SVGs (`unplugin-icons`) | This phase (production hardening of the sketch) | No empty-icon trap, no runtime network dep. |
| Per-surface / hand-drawn provider marks | Single-source `@lobehub/icons` via `providerLogo()` | Phase 128 (reused here) | Byte-identical provider marks across chat / run / publish (the icon convention). |

**Deprecated/outdated:**
- The sketch's `iconify-icon` CDN `<script>` and hand-built provider SVGs: mockup-only, NOT for the build (both sketch READMEs flag this explicitly).
- `fluent-emoji:direct-hit`, `fluent-emoji:no-entry-sign`: do not exist in the set — use verified alternatives.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The engine chip's per-phase provider can be sourced from `runs.provider` (run-level) and/or `sub_agent_model` (agent phases via `TaskRunIndexItem`), and where no per-phase provider exists the chip renders honestly-absent. The `phase_started` SSE event carries NO model/provider field today (verified: `StreamsProvider.tsx:878-884` maps only slug/index/type/status; `Phase` type has no provider field). | Icon Integration / Open Questions Q1 | If a per-phase provider IS required visually and no honest source exists, a net-new wire field (backend) would be needed — which would break the "frontend-only" scope. Mitigation: render the chip from real run-level/sub-agent data only, or omit it where unknown (still satisfies SC#2's "alive active" with the activity line). |
| A2 | `phase.name` (the human title the sketch shows on the active card) is NET-NEW wire (a Phase-103 authoring output), same as sketch 022 — NOT currently on the `Phase` type (verified: `types/index.ts:652-667` has slug/phaseIndex/phaseType/status/attempt/error/subAgents/pendingAsk/emitSubStep/emitFailure — no `name`). | 052 seams | If `phase.name` is treated as present, the title renders blank. Fallback (locked by the sketch + soulData precedent): fall back to `phase.slug` (mono, demoted), exactly as `PhaseSpine.tsx:61` does (`p.name?.trim() || p.slug`). 127 can render the slug honestly and flag the human-title as NET-NEW in-surface, deferring the wire to whenever 103 authoring emits it. |
| A3 | The `unplugin-icons` build-time path is acceptable for this Vite project (no SSR constraint that would block it). The app is a client SPA (Vite + React, no Next.js SSR found). | Standard Stack | Low risk. If the team prefers no new Vite plugin, the static-SVG fallback (A-tier alternative) is available with the same offline guarantee. |

## Open Questions

1. **Engine-chip per-phase provider source (the one place a wire field could be needed).**
   - What we know: `runs.provider` (run-level, server truth) and `sub_agent_model` / `TaskRunIndexItem.provider` (for batch/agent sub-runs) ARE real and already in the store. `phase_started` carries no per-phase provider.
   - What's unclear: whether the operator wants a DISTINCT engine per phase (e.g., "this phase runs on DeepSeek, the next on Claude") or one run-level engine. The sketch shows a per-step chip on the active step.
   - Recommendation: Wire the chip from the BEST honest source available per phase — `sub_agent_model`/`TaskRunIndexItem.provider` for agent/batch phases (real), falling back to the run-level `runs.provider`; render honestly-absent if neither is known. This keeps 127 frontend-only. If a true per-phase provider is required and unavailable, raise it as a net-new wire decision BEFORE planning (it would change scope). Decide at plan time.

2. **3D-icon mechanism: `unplugin-icons` (Vite plugin) vs bundled static SVGs.**
   - What we know: Both give the required offline/no-empty guarantee. `unplugin-icons@23.0.1` + `@iconify-json/fluent-emoji@1.2.7` are verified-installable and slopcheck-OK on npm. The icon set is small (8 stages + ~3 verdict glyphs + 6 phase types ≈ ~17 distinct icons).
   - What's unclear: team preference for adding a build plugin vs hand-curating ~17 SVGs.
   - Recommendation: `unplugin-icons` (ergonomic, tree-shaken, build-fails-on-missing-slug = structural verify-or-bundle). Fallback: static SVGs in `src/assets/` with a typed glyph→component map + `?? fallback`. Either satisfies the convention. Decide at plan time.

3. **Calm-vs-energized default + motion budget.**
   - What we know: Operator's loved default is ENERGIZED; a calm anchor is kept as a toggle; "the build can dial the exact glow/motion."
   - Recommendation: Ship energized as the default per the operator; expose the calm toggle (the sketch's `body.calm` overrides give the exact reduced-motion set). Also respect `prefers-reduced-motion` for the comet/aura/shimmer animations (a11y best practice; the active-only motion makes this cheap). Confirm exact intensity against the operator-approved sketch at UAT (the acceptance bar).

## Environment Availability

> The phase has external dependencies only in the build/test toolchain (no services).

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node + npm (frontend build) | Installing `unplugin-icons`/icon-data; running `vitest` | ✓ (project) | (project) | — |
| `@lobehub/icons` | Engine chips | ✓ installed | ^5.10.0 | — (already a dep) |
| `unplugin-icons` | 3D glyphs (recommended path) | ✓ on npm (not yet installed) | 23.0.1 | static SVGs (no install) |
| `@iconify-json/fluent-emoji` | 3D glyph data (offline) | ✓ on npm (not yet installed) | 1.2.7 | static SVGs |
| Iconify API (`api.iconify.design`) | One-time slug verification at plan/build time only | ✓ reachable (used to verify slugs 2026-06-27) | — | bundled SVGs make runtime independence absolute |
| `vitest` + `vitest-axe` | Re-running the G-5 + component test suite | ✓ installed | ^4.1.0 / ^0.1.0 | — |

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** `unplugin-icons` + `@iconify-json/fluent-emoji` (fallback: hand-bundled static SVGs, zero new deps).

## Validation Architecture

> `workflow.nyquist_validation` is not explicitly false in `.planning/config.json` (the init returned no such key) → this section is INCLUDED.

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest `^4.1.0` + Testing Library + `vitest-axe` `^0.1.0` (jsdom) |
| Config file | `frontend/vitest.config.*` / `vite.config.*` (existing; the `?raw` source-grep loader is already in use by `PublishGauntlet.test.tsx`) |
| Quick run command | `cd frontend && npx vitest run <path-to-test-file>` (single file) |
| Full suite command | `cd frontend && npm test` (= `vitest run`) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| WUX-03 (SC#1) | Gauntlet renders energy-spine; worded verdict leads; raw 5-field grid is behind a disclosure (and still verbatim + capped inside) | component | `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` | ✅ (extend with raw-on-demand + spine-shape assertions) |
| WUX-03 (SC#1) | 4 distinct HTTP outcomes; judge hard-wall (no enabled override, `<s>` strike); run-link gated on `golden_run_id`; criteria first-class on block; named_failures key-detection | component + source-grep | `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` | ✅ (existing — must stay green unchanged) |
| WUX-03 (SC#2) | Idle PhaseCard is quiet (no `oneLiner`, no activity line, no animation); only the active step blooms + carries the running-only activity line + engine chip | component | `npx vitest run src/components/panel/PhaseCard.test.tsx` | ✅ (extend with idle-quiet + active-bloom assertions) |
| WUX-03 (G-5 a11y) | PhaseTimeline axe-clean in all 5 states; APG accordion; `role=alert` failure; indeterminate `progressbar`; status = glyph+word+colour | a11y (axe) | `npx vitest run src/components/panel/__tests__/PhaseTimeline.test.tsx` | ✅ (existing — must stay green) |
| WUX-03 (G-5 honesty) | Failed-as-failed taxonomy + `reason_unknown` sentinel survive the re-skin | component | `npx vitest run src/components/panel/__tests__/FailReason.test.tsx` `src/components/panel/PhaseCard.test.tsx` | ✅ (existing — must stay green) |
| WUX-03 (icon) | Every gauntlet stage / phase-type glyph resolves to a non-empty bundled icon (no `direct-hit` trap) | unit (build-time) | build fails on missing slug (`unplugin-icons`) OR a slug-presence test | ❌ Wave 0 (add a glyph-presence assertion if the static-SVG path is chosen) |

### Sampling Rate
- **Per task commit:** the single relevant test file (`npx vitest run <file>`), < 30 s.
- **Per wave merge:** `cd frontend && npm test` (full Vitest suite — proves the G-5 visual-only invariant across all panel/workflow tests).
- **Phase gate:** Full Vitest suite green + the live UAT scenarios below pass before `/gsd:verify-work`.

### Wave 0 Gaps
- [ ] Extend `PublishGauntlet.test.tsx` — assert the worded verdict leads, the raw grid is inside a `<details>` (`raw-verdict` testid), and the verbatim cap remains inside the disclosure. (All EXISTING honesty assertions must continue to pass unchanged.)
- [ ] Extend `PhaseCard.test.tsx` — assert an idle (`pending`) card renders NO activity line / NO `oneLiner` / NO pulse animation, and a `running` card renders the activity line + engine chip; a `done` card folds.
- [ ] (If static-SVG icon path) add a glyph-presence test (every `PHASE_GLYPHS` entry + every gauntlet stage maps to a defined component). If `unplugin-icons` path, the build itself is the gate.
- [ ] Framework install: none — Vitest + vitest-axe already present.

### Manual UAT scenarios (authored in VALIDATION.md, NOT PLAN tasks)
Per CLAUDE.md G-4 (lived-experience gate) + the UAT scoreboard recipe. The operator-approved sketch is the acceptance bar (SC#2).
- **SC#2 density read:** at "Start (all idle)" the not-yet-run steps read quiet/still (no spinner, no placeholder, no type-lecture); when "Running", the ONE live step is unmistakable (glow + energy flowing in + activity line + engine chip) and the eye lands there instantly; done steps settle calmly.
- **Gauntlet resolved states:** walk Resting → Golden-run (hero, live clock, engine chips) → Published (worded "🎉 Published — v1 is live") → Judge block (worded "⚖️ Blocked by the grader…", per-criterion rows first-class, raw grid one click away) → Early block (worded "⛔ Blocked early — structure", `golden_run_id` null → no-run note).
- **All 4 HTTP outcomes** render distinctly (200-with-block / 400 / 404 / 409) — the worded layer must not collapse them.
- **Cross-provider engine-chip logo check (SC#10 axis):** each provider in the native-7 + OpenRouter roster (OpenAI · Anthropic · Google · DeepSeek · Moonshot/Kimi · Zhipu/GLM · MiniMax · OpenRouter) renders the CORRECT single-source `@lobehub/icons` mark on the engine chip — none falls back to a generic/empty mark for a mapped provider (the `providerLogo` map keys are `zhipu`/`moonshot`, not `glm`/`kimi` — verify the resolved `runs.provider` value matches). `lmstudio`/`unknown` correctly fall to the `Bot` dot.
- **UAT scoreboard 4-axis (because PhaseCard/PhaseTimeline are the live-run cards):** cross-provider (above) × multi-tool (a workflow whose active phase runs ≥2 tools) × parallel-thread (Thread A workflow running while Thread B accepts a prompt — confirm the energized active-card density doesn't leak across threads; the panel is `phasesByThread`-scoped) × long-message (a long run / many phases — confirm idle stays quiet at scale).

## Security Domain

> `security_enforcement` is not explicitly false in config (init returned no such key) → included. 127 is presentation-only with no new wire, so the surface is narrow.

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | No auth surface touched. |
| V3 Session Management | no | No session surface. |
| V4 Access Control | no | No new endpoints; the publish/run reads are unchanged + RLS-scoped already. |
| V5 Input Validation / Output Encoding | **yes** | Every agent/LLM/user-authored string (phase slug, `phase.name`, verdict fields, named_failures, judge evidence) MUST render as a plain React text child (auto-escaped) — NEVER `dangerouslySetInnerHTML`. This is the existing rule (`PhaseCard.tsx:28` XSS note, `PublishGauntlet` verbatim render, `WorkflowSoul.tsx:22-24`); 127 must preserve it through the re-skin. SVG icons are imported React components, never interpolated HTML. |
| V6 Cryptography | no | None. |

### Known Threat Patterns for this stack (React presentation re-skin)
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| XSS via agent-supplied strings rendered as HTML | Tampering / Elevation | Plain text children only; no `dangerouslySetInnerHTML` (existing, must persist — `PhaseCard.test.tsx:132-140` already grep-guards this). |
| Icon supply-chain (a malicious icon package) | Tampering | Use verified packages only (`@lobehub/icons` already vetted Phase 128; `unplugin-icons`/`@iconify-json/fluent-emoji` slopcheck-OK on npm); icons compiled to SVG at build time, no runtime fetch. |
| Provenance softening (re-deriving the verdict / hiding the verbatim cap) | Repudiation | The verbatim `PublishVerdict` + `▦ rendered verbatim` cap stay (inside the disclosure); judge hard-wall (no override) stays — these are honesty contracts, grep-guarded by `PublishGauntlet.test.tsx`. |

## G-5 Harness Safety (load-bearing)

`PhaseCard.tsx` and `PhaseTimeline.tsx` are **G-5 hot files shared with the live harness run surface** (ROADMAP: "`PhaseTimeline.tsx`/`PhaseCard.tsx` — shared with the live harness — re-run replay tests in 124/127"; touched 094 / 101.1 / 124). The re-skin MUST be visual-only.

**The red line:** the soul is an additive SIBLING header — already mounted as a SEPARATE `PanelSection` from the timeline (`WorkspacePanel.tsx:264-277`; `RunSoul` never consumes `usePhases`, never imports PhaseCard/PhaseTimeline internals, never adds a prop to either — enforced by the Phase-124 doc-comment at `WorkspacePanel.tsx:85-101`). Do NOT thread soul state into PhaseCard. Do NOT change the status/data model (the `Phase` shape, the `STATUS_META` literals, `classifyFailure`, the demux in StreamsProvider) — change only its presentation.

**The existing tests that exercise these components and MUST be re-run green to prove visual-only:**

| Test file | What it locks (must stay green) |
|-----------|-------------------------------|
| `frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx` | axe ZERO violations in all 5 states (running/failed/done/askuser-paused/gatefail-retry), 1-phase + N-phase; the `role=status` announcer present at load; APG accordion `aria-expanded` flips; `aria-busy` true while running / cleared on terminal. **Drives the REAL wire→Phase[]→render pipeline via `replayFixture`** (harness replay — the G-5 proof). |
| `frontend/src/components/panel/__tests__/FailReason.test.tsx` | RC-4 failed-as-failed: `fxRunFailed` renders FAILED + the gate-failed reason in `role=alert`; `fxRunFailedReasonUnknown` renders the `reason_unknown` sentinel, never an empty red card. (Also replay-driven.) |
| `frontend/src/components/panel/PhaseCard.test.tsx` | All 6 emit sub-steps render on the rail; all 5 emit-failure states render distinct reasons in `role=alert`; failed-as-failed even before status flips; failure suppresses the sub-step node; XSS (no `dangerouslySetInnerHTML`); a plain non-emit phase shows no sub-step/no failure + reads "Complete". |
| `frontend/src/components/panel/__tests__/PhaseReconcile.test.tsx` | The reconcile-floor skeleton / forward-only counter behavior (replay path). |
| `frontend/src/providers/__tests__/phaseHooks.test.tsx` | `usePhases`/`useTasks` selector contracts feeding the timeline. |
| `frontend/src/components/workflows/PublishGauntlet.test.tsx` | The full publish honesty contract (verbatim verdict, 4 HTTP outcomes, judge hard-wall + `<s>` strike, run-link gating, named_failures key-detection, the soul block, the modal shell + in-flight close-block) + source-grep guards. |
| `frontend/src/components/workflows/PhaseSpine.test.tsx` | The soul glyph-spine (auto-inherits the `PHASE_GLYPHS` 3D swap — verify it still asserts on the data-attrs, not the literal flat glyph). |

**Command:** `cd frontend && npm test` (full `vitest run`). A green full suite + axe-clean PhaseTimeline = the structural proof the re-skin is visual-only. Lived-experience UAT (above) is the behavioral proof per G-4.

## Cross-Provider Surface (SC#10)

The gauntlet golden-run hero engine chips AND the live-step engine chip show provider logos across the **full native-7 + OpenRouter** roster (`feedback_cross_provider_full_native_roster`, icon-convention §1): OpenAI · Anthropic · Google · DeepSeek · Moonshot/Kimi · Zhipu/GLM · MiniMax · OpenRouter.

What must be checked:
- The engine chip resolves via `providerLogo(provider)` using the **already-resolved `runs.provider` value** (the `MARKS` map in `providerLogo.tsx:68-79` is keyed by the EXACT `runs.provider` strings — GLM is `zhipu`, Kimi is `moonshot`, OpenRouter is NOT unwrapped to the routed model). A mismatch (e.g., passing "glm"/"kimi") returns `null` → an unintended `Bot` fallback. Verify the provider string threaded into the chip is the resolved `runs.provider`/`sub_agent_model`-derived value, not a display label.
- All 8 mapped providers render their correct single-source `@lobehub/icons` mark; `lmstudio`/`ollama` have marks too; only `unknown`/undefined correctly fall to the brand-pulse `Bot`.
- Nothing for a MAPPED provider falls back to a generic/empty mark (the icon-convention's "different marks for the same concept" / empty-mark failure).

This reuses Phase-128's seam entirely — no new provider mapping. The cross-provider check is a UAT verification, not new code.

## Sources

### Primary (HIGH confidence)
- The actual source files (read in full this session): `PublishGauntlet.tsx`, `PhaseCard.tsx`, `PhaseTimeline.tsx`, `soulData.ts`, `WorkflowSoul.tsx`, `PhaseSpine.tsx`, `providerLogo.tsx`, `types/index.ts` (Phase shape), `StreamsProvider.tsx` (phase demux), `WorkspacePanel.tsx` (soul/timeline mount), and the test files (`PublishGauntlet.test.tsx`, `PhaseCard.test.tsx`, `__tests__/PhaseTimeline.test.tsx`, `__tests__/FailReason.test.tsx`).
- The operator-approved design contract: `sketch-findings-agentic-rag/SKILL.md`, `references/workflow-energized-reskin.md`, `references/icon-convention.md`, `sources/051-gauntlet-pip-strip/{README.md,index.html}`, `sources/052-living-step-flow/{README.md,index.html}`.
- Project rules + state: `CLAUDE.md` (stack, icon convention, G-5 ledger, UAT recipe), `.planning/STATE.md`, `.planning/REQUIREMENTS.md` (WUX-03).
- Verified package/icon facts: `npm view` (unplugin-icons 23.0.1, @iconify-json/fluent-emoji 1.2.7, @iconify/react 6.0.2); `slopcheck install --ecosystem npm` (all `[OK]`); `api.iconify.design/fluent-emoji.json` slug-presence check (PRESENT/MISSING lists).

### Secondary (MEDIUM confidence)
- Iconify docs on icon-component runtime behavior (the CDN/API-fetch trade-off): https://iconify.design/docs/iconify-icon/ , https://iconify.design/docs/icon-components/react/ (cross-verified with the sketch READMEs' own "internet on for icons" caveat).

### Tertiary (LOW confidence)
- None relied upon. (The two net-new wire items A1/A2 are flagged ASSUMED with verified-absence evidence and a locked fallback, not presented as fact.)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — every reuse is a read-confirmed existing seam; the one net-new dep is verified on npm + slopcheck-OK + icon slugs API-verified.
- Architecture / seams: HIGH — exact symbols, line regions, and the G-5 sibling-separation are read from the actual files.
- Pitfalls: HIGH — derived from the live-found traps (the `direct-hit` empty-icon trap, the CDN mechanism, the unconditional `oneLiner`) and the existing test guards.
- Net-new wire (engine provider per phase, `phase.name`): MEDIUM — verified-absent today; locked honest fallbacks exist; the only items that could touch scope, flagged for a plan-time decision.

**Research date:** 2026-06-27
**Valid until:** ~2026-07-27 (stable; the only fast-moving element is the icon-package versions — re-confirm `npm view` at install time).
