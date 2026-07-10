# Workflow Studio Energized Re-skin (Phase 127 / WUX-03)

A density + energy re-skin of two ALREADY-SHIPPED workflow surfaces — the publish
gauntlet (`PublishGauntlet.tsx`, winner 020-B) and the live phase spine
(`PhaseCard.tsx` / `PhaseTimeline.tsx`, winner 008-D / 022-A). Both ride UNDER the
Phase-124 soul (which stays); 127 only re-skins what sits below it. Operator
direction (2026-06-27): make it **visually engaging / alive** — imported 3D icons,
an energy language, the live moment "building," and *which AI engine* is on each
step — while keeping the quiet-at-rest promise and every honesty/a11y contract.

Winners: **051-A** (Recipe-literal) and **052-A** (Density-by-status). Energized
intensity is the operator-loved default; a calm anchor is kept as an in-sketch
toggle (and the build can dial exact glow/motion).

## Design Decisions

### Sketch 051 — Gauntlet: pip/energy-spine + worded verdict + raw-on-demand
- The 8 server-fixed stages render as a **compact horizontal energy-spine** (one
  node per stage with a 3D icon), NOT eight wrapping boxes. Passed stages glow
  green with a check badge; the golden run pulses amber with an **energy comet
  flowing into it**; a blocked stage turns red.
- The resolved state **leads with a plain-worded verdict** — `🎉 Published — v1 is
  live` / `⚖️ Blocked by the grader because…` / `⛔ Blocked early — structure` — and
  **demotes the raw 5-field `PublishVerdict` grid behind a `<details>` "Show raw
  verdict."** The verbatim render + the `▦ rendered verbatim` provenance cap stay
  INSIDE the disclosure (honesty preserved, just not leading).
- The golden-run wait is the **hero**: a glowing panel with an animated aura, a
  live elapsed clock, and **engine chips** (e.g. running on DeepSeek → graded by an
  independent Claude — the cross-provider story, Asian natives featured).
- Sits UNDER the shipped Phase-124 `<WorkflowSoul scale="pub">` block (the sketch
  renders it, tagged "soul · shipped Phase 124", so the composition reads true).

### Sketch 052 — Living step-flow: quiet idle, alive active
- "**Calm at rest, comprehensive on the active step**" (the 022-A target the shipped
  094 card never reached). **Idle steps** = one dim, still line (title + faint
  "Locked") — NO type-lecture / `oneLiner`, NO placeholder, NO animation (SC#2).
- The **active step blooms**: amber wash + left bar + a glowing node + a **vertical
  energy comet flowing down into it** + the **running-ONLY activity line** (`Searching
  the Procurement KB…`) + the **AI-engine chip** (which provider runs this step).
- **Done** steps fold to a one-line essence (✓ + title, "expand ▸"); **failed**
  renders the closed-taxonomy reason + where-line (failed-as-failed, never empty).
- Sits UNDER the shipped Phase-124 `<WorkflowSoul scale="run">` header
  (`WorkspacePanel`). ⚠ G-5 hot files shared with the live harness run — re-run
  harness replay tests; the re-skin is visual, not a behavior rewrite.

### Honesty + a11y contracts (preserved — must NOT soften in build)
- 051: verbatim verdict (never re-derived) · judge = HARD WALL, no override
  (struck-through "publish anyway") · 4 DISTINCT HTTP outcomes (200-with-block /
  400 / 404 / 409) · run-link gates on `golden_run_id != null` · the judge
  per-criterion `{criterion, score, evidence}` rows stay FIRST-CLASS on a block
  (only the 5-field debug grid is demoted to on-demand).
- 052: status = glyph + word + colour (never colour-alone, WCAG 1.4.1) · LINE 3
  activity is RUNNING-phase only (no fabricated counts on idle/done) · gate chip
  ONLY when a real `PhaseSpec.validator` exists · APG accordion / `role=alert`
  failure / indeterminate `progressbar` carry forward · `phase.name` human title is
  flagged NET-NEW (a Phase-103 authoring output, same as sketch 022).

### Icons
See `icon-convention.md`. 3D phase-type icons via the shared `PHASE_GLYPHS` upgrade;
provider/model marks via `@lobehub/icons` (the sketches use real Iconify `logos:`
where available + flagged placeholders). VERIFY every 3D slug exists or bundle SVGs
(the 051 Goal stage hit the empty `fluent-emoji:direct-hit` → `bullseye`).

## CSS Patterns

```css
/* energy connector with a traveling comet (051 horizontal spine / 052 vertical rail) */
.econn.flowing::after { content:""; position:absolute; inset:0;
  background:linear-gradient(90deg, transparent, var(--neon-cyan), transparent);
  background-size:220% 100%; animation:flow 1.15s linear infinite; }
@keyframes flow { from { background-position:200% 0 } to { background-position:-120% 0 } }
.econn .comet { position:absolute; top:50%; width:8px; height:8px; margin-top:-4px;
  border-radius:50%; background:var(--neon-cyan); box-shadow:0 0 10px 2px var(--neon-cyan);
  animation:cometRun 1.15s linear infinite; }

/* the live node aura (golden run / active step) */
.enode.run::before { content:""; position:absolute; inset:-5px; border-radius:19px;
  border:2px solid var(--color-warning); animation:auraPulse 1.5s var(--ease-out) infinite; }
@keyframes auraPulse { 0% { transform:scale(.92); opacity:.8 } 100% { transform:scale(1.5); opacity:0 } }

/* quiet idle vs bloomed active (052 — the SC#2 density contract) */
.vrow.pending .pcard { opacity:.6; }                 /* quiet, still, no motion */
.vrow.run .pcard { background:linear-gradient(100deg, hsl(38 92% 60% / .12), transparent 80%);
  border-color:hsl(38 92% 60% / .4); border-left:3px solid var(--color-warning);
  box-shadow:0 0 30px hsl(38 92% 60% / .1); }       /* bloom only where it's happening */

/* energized headline; calm-mode override gives the operator a quieter anchor */
.grad-text { background:var(--grad-energy); -webkit-background-clip:text; background-clip:text; color:transparent; }
body.calm .grad-text { background:none; color:var(--color-primary); -webkit-text-fill-color:var(--color-primary); }

/* raw-on-demand disclosure (051 — verbatim verdict preserved, not leading) */
.rawbox > summary::before { content:"▸"; color:var(--color-accent-violet); transition:transform var(--dur-fast); }
.rawbox[open] > summary::before { transform:rotate(90deg); }

/* engine chip — real logo on a clean backing vs flagged placeholder */
.engine-mark.real { background:#fff; box-shadow:none; }   /* real @lobehub/Iconify logo */
.engine-mark.mock { /* hand-built placeholder — NOT shipped art */ }
```

## HTML Structures

```html
<!-- 051: the energized stage spine (icon per stage; state drives the tone) -->
<div class="espine">
  <div class="estage done"><div class="enode done"><iconify-icon icon="fluent-emoji:shield"></iconify-icon><span class="badge">✓</span></div><div class="lab">Owner</div></div>
  <div class="econn passed"></div>
  <div class="estage run"><div class="enode run"><iconify-icon icon="fluent-emoji:rocket"></iconify-icon></div><div class="lab">Golden run</div></div>
  <!-- … remaining stages … -->
</div>

<!-- 051: worded verdict first; raw grid behind a disclosure -->
<div class="wverdict bad">
  <div class="wv-top"><div class="wv-ic"><iconify-icon icon="fluent-emoji:balance-scale"></iconify-icon></div>
    <div><div class="wv-head">Blocked by the independent grader</div>
      <div class="wv-line">The run finished — but the grader wouldn’t pass the result. Hard wall: no “publish anyway.”</div></div></div>
  <!-- per-criterion {criterion, evidence, score} rows stay first-class here -->
  <details class="rawbox"><summary>Show raw verdict — the 5 server fields, verbatim</summary> … </details>
</div>

<!-- 052: a live step row — quiet idle vs bloomed active with the engine chip -->
<li class="vrow run">
  <div class="vrail"><span class="seg top flow"><span class="vcomet"></span></span><span class="vnode"><iconify-icon icon="fluent-emoji:busts-in-silhouette"></iconify-icon></span></div>
  <div class="pcard">
    <div class="pc-l1"><span class="pc-title">Score each vendor on risk</span><span class="nn">NET-NEW</span><span class="statuspill sp-run">● Running</span></div>
    <div class="pc-l2"><span>Phase 3 of 6 · Parallel agents</span> · <span class="pc-slug">score_vendors</span></div>
    <div class="pc-l3"><span class="actdot"></span><span class="build-sheen"><b>14 agents</b> scoring vendors in parallel</span><!-- engine chip --></div>
  </div>
</li>
```

## What to Avoid

- Leading the resolved gauntlet with the raw 5-field grid (debugger output to a
  business user) — lead with words, keep the grid on-demand.
- Softening any 051 honesty contract (verbatim / judge hard-wall / 4 HTTP outcomes /
  run-link gating / criteria-first-on-block).
- Animation or type-education on idle/done steps (kills the SC#2 quiet-at-rest read
  and the 3-second scan). Motion belongs ONLY on the active step.
- Threading soul state into `PhaseCard` internals (G-5 red line — the soul is an
  additive sibling header; 127 touches only the card density below it).
- Hand-drawn / per-surface provider marks, or an icon slug that renders empty (see
  `icon-convention.md`).

## Origin

Synthesized from sketches **051-gauntlet-pip-strip** (winner A) and
**052-living-step-flow** (winner A), operator-approved 2026-06-27. Source files in
`sources/051-gauntlet-pip-strip/` and `sources/052-living-step-flow/`. Re-skins the
shipped 020-B gauntlet + 008-D/022-A live spine; sits under the Phase-124 soul
(`WorkflowSoul`). Cross-links: [icon-convention.md](icon-convention.md),
[publish-gauntlet.md](publish-gauntlet.md), [workflow-run-surface.md](workflow-run-surface.md),
[harness-phase-timeline.md](harness-phase-timeline.md). Future Settings home for the
icon convention: SEED-095.
