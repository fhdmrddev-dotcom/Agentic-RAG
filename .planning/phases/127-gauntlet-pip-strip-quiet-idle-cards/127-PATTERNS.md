# Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards - Pattern Map

**Mapped:** 2026-06-27
**Files analyzed:** 4 source + 1 build-config + 4 test analogs
**Analogs found:** 4 / 4 (3 are in-place re-skins → the file IS its own analog; 1 net-new helper mirrors a sibling)

> This is a **presentation-only re-skin** of already-shipped React files plus one additive icon swap. For three of the four files the closest analog **is the file itself** (re-skin in place — keep every honesty/a11y hook, change only markup/CSS). The one genuinely net-new seam (a phase-glyph→3D-component helper, IF the `unplugin-icons` path is chosen) mirrors the established **`providerLogo.tsx`** keyed-map pattern. RESEARCH.md already carries the architecture map; this file pins each touch to a concrete code excerpt + the test contract the planner must preserve or migrate.

## File Classification

| File to touch | Role | Data Flow | Closest Analog | Match Quality |
|---------------|------|-----------|----------------|---------------|
| `frontend/src/components/workflows/PublishGauntlet.tsx` | component (modal client) | request-response (publish verdict render) | **itself** (in-place re-skin) | exact — re-skin |
| `frontend/src/components/panel/PhaseCard.tsx` ⚠G-5 | component (row) | event-driven (SSE phase status) | **itself** (in-place re-skin) | exact — re-skin |
| `frontend/src/components/panel/PhaseTimeline.tsx` ⚠G-5 | component (list container) | event-driven (SSE phase stream) | **itself** (in-place re-skin) | exact — re-skin |
| `frontend/src/components/workflows/soulData.ts` | utility (shared glyph map) | transform (type→glyph lookup) | **itself** (additive map swap) | exact — additive |
| `frontend/src/lib/<phaseGlyph>.tsx` (NET-NEW, IF `unplugin-icons`) | utility (icon-mapping seam) | transform (key→SVG component) | `frontend/src/lib/providerLogo.tsx` | exact (sibling pattern to copy) |
| `frontend/vite.config.ts` (IF `unplugin-icons`) | config (build) | n/a | (plugin registration — see RESEARCH §Installation) | n/a |
| `frontend/src/lib/providerLogo.tsx` | utility (engine-chip logo seam) | transform | — REUSE, no change (consumer import only) | n/a |

---

## Pattern Assignments

### `frontend/src/components/workflows/PublishGauntlet.tsx` (component, request-response) — IN-PLACE RE-SKIN

**Analog: the file itself.** Re-skin three named sub-components; do NOT touch the publish logic, the `PublishOutcome` switch, or the honesty contracts. The blocked-stage→tone derivation and the verbatim render must survive verbatim.

**SUB-COMPONENT 1 — `GauntletSpine` (lines 274-301) → energy-spine.** The `blockedIndex` derivation STAYS; only the per-stage `<div className="rounded border …">` box becomes an energy node (`.estage`/`.enode` + bundled 3D `<Icon/>`). Keep `data-testid="gauntlet-spine"` and the 8 stage `label` strings (both are asserted — see test analog).

```tsx
// PublishGauntlet.tsx:274-301 — the load-bearing derivation to PRESERVE (re-skin the markup only):
function GauntletSpine({ blockedStage, running }: { blockedStage: string | null; running: boolean }) {
  const blockedIndex = blockedStage
    ? STAGES.findIndex((s) => s.codes.includes(blockedStage))   // server truth — NEVER recompute
    : -1
  return (
    <div data-testid="gauntlet-spine" className="flex flex-wrap items-stretch gap-2 py-3">  // keep the testid
      {STAGES.map((stage, i) => {
        const isBlocked = blockedIndex === i
        const isPassed = blockedIndex === -1 ? !running : i < blockedIndex
        const tone = isBlocked ? "…destructive…" : isPassed ? "…success…" : running && i === 5 ? "…amber…" : "…border…"
        return ( <div key={stage.label} className={`rounded border … ${tone}`}> … </div> )  // box → energy node + 3D icon
      })}
    </div>
  )
}
```
CSS comes from `references/workflow-energized-reskin.md` (`.econn.flowing`, `@keyframes flow`, `.enode.run::before`, `@keyframes auraPulse`). The 8 `STAGES` (lines 69-78) get one verified `fluent-emoji` slug each (Goal/golden-run uses `rocket`/`bullseye`, NOT `direct-hit` — the empty trap).

**SUB-COMPONENT 2 — worded verdict + `<details>` demotion (lines 487-532).** A NEW plain-worded headline leads the resolved block; `VerdictFields` (the verbatim 5-field grid, lines 203-220) moves INSIDE a `<details data-testid="raw-verdict">`. **Critical:** the `▦ rendered verbatim from the server — not re-derived` cap (lines 212-217) stays INSIDE the disclosure. The per-criterion `CriterionRow`/`LintRow`/`PhaseRow`/`SummaryLine` (lines 104-158) + `named_failures` map (lines 516-523) stay FIRST-CLASS (outside the disclosure). `RunLink` + `HardWall` unchanged.

```tsx
// PublishGauntlet.tsx:204-220 — render UNCHANGED, just relocated into <details>; the cap stays inside.
function VerdictFields({ verdict }: { verdict: PublishVerdict }) {
  return (
    <div className="mt-4 overflow-hidden rounded border border-border">
      <VerdictRow name="published" value={verdict.published} />        // each row keeps data-testid={`verdict-${name}`}
      … version / golden_run_id / blocked_stage / named_failures …
      <div className="… text-[9px] text-muted-foreground">
        <span className="text-accent-violet" aria-hidden>▦</span>
        rendered verbatim from the server — not re-derived in the client.   // MUST stay (provenance cap)
      </div>
    </div>
  )
}
```
Worded headline strings derive from `verdict.published` / `verdict.blocked_stage` (server truth — the sketch shows `🎉 Published — v1 is live` / `⚖️ Blocked by the grader…` / `⛔ Blocked early — structure`). `.rawbox > summary::before` disclosure CSS is in the design contract.

**SUB-COMPONENT 3 — `PublishingNotice` (lines 309-332) → golden-run hero + engine chips.** Keep `data-testid="publish-elapsed"` (asserted). Add the glowing-panel aura + engine chips via `providerLogo()` (see Shared Pattern A). Live clock logic (lines 310-312) is unchanged.

**Honesty hooks that MUST survive (grep-guarded — see test analog):** `data-testid`s `gauntlet-spine`, `verdict-*`, `publish-success`/`publish-block`, `http-outcome`, `run-link`/`no-run-note`, `publish-modal*`; the `<s className="opacity-60">publish anyway</s>` strike (line 261); `golden_run_id != null` gate (line 227); the source-grep tokens `typeof entry === "string"`, `"criterion" in`, `"code" in`, `publishWorkflow`.

**Test analog:** `frontend/src/components/workflows/PublishGauntlet.test.tsx` (existing — must stay green; extend per Wave-0).
- Mirror the `openModal()` / `doPublish()` helpers (lines 48-63) for any new test.
- New assertions mirror existing ones: assert the worded headline leads, the raw grid is inside `<details data-testid="raw-verdict">`, and the `▦ rendered verbatim` cap is INSIDE the disclosure. The existing 8-stage-label test (lines 274-291) and source-grep guards (lines 330-349) must continue to pass unchanged.

---

### `frontend/src/components/panel/PhaseCard.tsx` ⚠G-5 (component, event-driven) — IN-PLACE RE-SKIN

**Analog: the file itself.** Branch the body presentation on `phase.status`. Do NOT touch `classifyFailure` (lines 173-234), `STATUS_META` (lines 65-77), `SUBSTEP_META` (lines 93-107), the APG accordion scaffolding (lines 296-356), or the `Phase` data model. **G-5 red line:** add NO soul prop; the soul stays a sibling header.

**The density branch.** Today the `oneLiner` type-lecture renders for ALL open phases (line 357) — SC#2 requires it GONE from idle. Branch: `pending` → one dim still line (no `oneLiner`, no progressbar pulse, no animation); `running` → bloom (amber wash + left bar + glowing node + energy comet + running-only activity line + engine chip); `done` → folded essence; `failed` → the existing `classifyFailure` alert block (unchanged).

```tsx
// PhaseCard.tsx:347-357 — the panel body. Line 357's unconditional oneLiner is the SC#2 target:
<div id={panelId} role="region" aria-labelledby={headId} hidden={!open}
     aria-busy={isRunning || undefined} className="flex flex-col gap-2 px-3 pb-3">
  <p className="text-[12px] leading-relaxed text-panel-muted-foreground">{meta.oneLiner}</p>  // ← remove from idle/done; keep ONLY where status warrants
```
The bloom-vs-quiet CSS contract is in `references/workflow-energized-reskin.md` (`.vrow.pending .pcard { opacity:.6 }`, `.vrow.run .pcard { …amber wash + border-left + box-shadow… }`). The existing root-`cn()` status branch (lines 282-294) already tints by `isRunning`/`isFailed`/`retrying` — extend that, do not replace it.

**Activity line + engine chip are RUNNING-ONLY (Pitfall 4).** Never on `pending`/`done`. The engine chip uses `providerLogo()` (Shared Pattern A). The phase has NO `provider` field (`types/index.ts:652-667`) → the honest per-phase source is `phase.subAgents[].provider` (`TaskRunIndexItem.provider`, `types/index.ts:598`) for agent/batch phases, else run-level, else render honestly-absent (research A1 / Open Q1 — decide at plan time; do NOT fabricate).

**The glyph.** `PhaseCard` reads its OWN `PHASE_TYPE_LABEL[].glyph` (lines 41-48), NOT the shared `PHASE_GLYPHS`. To pick up the 3D set, either swap these glyphs to the bundled 3D components or import from `soulData`. Keep the `UNKNOWN_PHASE_META` `glyph: "•"` fallback (line 48) so an unknown type never renders empty. The `aria-hidden="true"` on the glyph (line 313) stays — the label carries the meaning (non-color-only / a11y).

**Test analog:** `frontend/src/components/panel/PhaseCard.test.tsx` (existing — must stay green; extend per Wave-0).
- Mirror `fillPhase(overrides)` (lines 23-33) to craft a `Phase`.
- The contracts to keep green: status reads "Failed"/"Complete" (lines 91-92, 160), the `role="alert"` failure block (lines 94-96), failed-as-failed before status flips (lines 112-118), failure suppresses the sub-step (lines 120-130), XSS no-`dangerouslySetInnerHTML` (lines 132-140), and a plain non-emit phase reads "Complete" with no sub-step (lines 143-161).
- NEW assertions: a `pending` card renders NO activity line / NO `oneLiner` / NO pulse animation; a `running` card renders the activity line + engine chip; a `done` card folds.

---

### `frontend/src/components/panel/PhaseTimeline.tsx` ⚠G-5 (component, event-driven) — IN-PLACE RE-SKIN (minimal)

**Analog: the file itself.** Structurally unchanged — it stays an `<ol>` of `<PhaseCard>` (lines 195-201). The energy-connector spine is presentational only. Do NOT touch the forward-only counter (lines 115-127), the reconcile frame fetch (lines 87-106), the `role="status"` announcer (lines 172-174), or `aria-busy` (line 195). **G-5 red line:** no soul prop threaded in.

```tsx
// PhaseTimeline.tsx:193-201 — the structure to PRESERVE (energy connector is presentation only):
<ol aria-label="Phases" aria-busy={isBusy || undefined} className="flex flex-col gap-1.5">
  {phases.map((phase, i) => (
    <li key={`${phase.phaseIndex}-${phase.slug}`}>
      <PhaseCard phase={phase} position={i} />   // unchanged contract — only PhaseCard's internals re-skin
    </li>
  ))}
</ol>
```
The vertical comet/rail CSS (`.econn.flowing`, `.vcomet`, `.seg.top.flow`) lives in `references/workflow-energized-reskin.md`. Respect `prefers-reduced-motion` for the comet/aura (research Open Q3).

**Test analog:** `frontend/src/components/panel/__tests__/PhaseTimeline.test.tsx` (existing — the G-5 PROOF; must stay green, do not weaken). This is **replay-driven** (the real wire→`Phase[]`→render pipeline via `replayFixture`, lines 86-90). It asserts axe ZERO violations in all 5 states (lines 92-128), the `role="status"` announcer at load (lines 130-134), APG `aria-expanded` flips (lines 136-158), and `aria-busy` true-while-running/cleared-on-terminal (lines 160-176). A green run here = the structural visual-only proof.

---

### `frontend/src/components/workflows/soulData.ts` (utility, transform) — ADDITIVE MAP SWAP

**Analog: the file itself.** ONE edit: upgrade `PHASE_GLYPHS` (lines 22-29) from flat unicode to the 3D set. This single map propagates to the soul card/run/pub + the 127 gauntlet stages + step cards (per the icon convention — `soulData` was extracted verbatim to FORBID a second glyph map). Do not touch the other exports.

```ts
// soulData.ts:22-29 — the ONE map to swap (flat → 3D):
export const PHASE_GLYPHS: Record<string, string> = {
  programmatic: "⚙",      // → fluent-emoji:gear
  llm_single: "✎",        // → fluent-emoji:memo
  llm_agent: "🤖",         // → fluent-emoji:robot
  llm_batch_agents: "⛓",  // → fluent-emoji:busts-in-silhouette (verified PRESENT)
  llm_human_input: "☺",   // → fluent-emoji:raised-hand
  llm_emit: "◆",          // → fluent-emoji:package
}
```
All 6 target slugs are verified PRESENT (RESEARCH §Pitfall 2). **Keep the `?? "•"` / `?? UNKNOWN_PHASE_META` fallbacks** at the call sites (`PhaseSpine.tsx:59` reads `PHASE_GLYPHS[type] ?? "•"`) so an unknown type never renders empty. If switching to bundled components (not strings), preserve the existing `Record<string, string>` consumer contract OR migrate consumers in the same change (research §Code Examples).

> ⚠ **CONTRACT CONFLICT the planner MUST resolve.** `PhaseSpine.test.tsx:38-44` asserts on the **literal flat glyphs** (`🤖`/`✎`/`◆`/`⚙` via `getByText`). The 3D swap WILL break these `getByText` calls. The fix (precedented): migrate those assertions to the data-attribute hooks the spine already emits — `data-phase-type` / `data-slug` on `spine-dot-*` (`PhaseSpine.tsx:73-77`) — instead of the literal glyph. The same file's G-5 source-grep (lines 89-95: spine never imports PhaseTimeline/PhaseCard, never re-declares `PHASE_GLYPHS`) must continue to pass.

**Test analog:** `frontend/src/components/workflows/soulData.test.ts` (existing) + `PhaseSpine.test.tsx` (existing — fix the literal-glyph assertions). `PhaseSpine.tsx` itself needs NO code change — it auto-inherits the swap.

---

### `frontend/src/lib/<phaseGlyph>.tsx` (utility, transform) — NET-NEW, MIRROR `providerLogo.tsx`

**This is the ONE place the analog is a SIBLING, not the file itself.** IF the `unplugin-icons` path is chosen and a phase-glyph→bundled-component helper is wanted, mirror the exact shape of `frontend/src/lib/providerLogo.tsx`: a keyed `Record<string, ComponentType<{size?:number}>>` of build-bundled SVG imports + a total resolver with a `null`/fallback. (If the swap stays inside `soulData.ts` as strings + a render-time lookup, no new file is needed — decide at plan time, research Open Q2.)

```tsx
// frontend/src/lib/providerLogo.tsx:52-92 — the keyed-map + total-resolver pattern to MIRROR:
type ProviderMark = ComponentType<{ size?: number }>
const MARKS: Record<string, ProviderMark> = {
  openai: OpenAI, anthropic: Anthropic, google: GeminiColor, /* … bundled SVG imports … */
}
export function providerLogo(provider: string | undefined): ProviderMark | null {
  return provider ? (MARKS[provider] ?? null) : null   // total over any key; caller renders a fallback on null
}
```
Bundled imports follow the deep-subpath discipline (`providerLogo.tsx:37-50`); for `unplugin-icons` that is `import Gear from '~icons/fluent-emoji/gear'` (build-time, offline-safe — NOT the CDN `iconify-icon` the sketch uses; RESEARCH §Pitfall 1). The build fails on a missing slug = structural verify-or-bundle.

**Test analog:** if a static-SVG path is chosen, add a glyph-presence unit test (every `PHASE_GLYPHS` key + every gauntlet stage maps to a defined component). With `unplugin-icons` the build itself is the gate (Wave-0).

---

## Shared Patterns

### Pattern A — Engine-chip logo (`providerLogo()`), used by BOTH surfaces
**Source:** `frontend/src/lib/providerLogo.tsx` (REUSE — do NOT re-map). **Canonical consumer:** `frontend/src/components/chat/RunCard.tsx:256, 304-314`.
**Apply to:** the gauntlet golden-run hero (`PublishGauntlet.tsx` `PublishingNotice`) + the running-only engine chip on `PhaseCard.tsx`.
```tsx
// RunCard.tsx:256 + 304-314 — the resolve-then-render-or-Bot-fallback pattern, copied verbatim:
import { providerLogo } from "@/lib/providerLogo"
import { Bot } from "lucide-react"
const EngineMark = providerLogo(provider)        // provider = runs.provider / TaskRunIndexItem.provider (server truth)
…
{EngineMark ? <EngineMark size={18} /> : <Bot className="w-4 h-4 text-white" />}
```
**Cross-provider note (SC#10):** the `MARKS` keys are the resolved `runs.provider` strings — GLM is `zhipu`, Kimi is `moonshot`, OpenRouter is NOT unwrapped (`providerLogo.tsx:56-79`). Thread the resolved provider value, not a display label, or a mapped provider falls to `Bot`. `lmstudio`/`unknown` correctly fall to `Bot`.

### Pattern B — Phase-type glyph (single shared `PHASE_GLYPHS` map)
**Source:** `frontend/src/components/workflows/soulData.ts:22-29` (the ONE map). **Apply to:** every soul surface + the 127 gauntlet stages + step cards via the single additive swap. Note `PhaseCard.tsx` currently holds a SECOND glyph copy (`PHASE_TYPE_LABEL`, lines 41-48) — the planner decides whether to converge it onto `PHASE_GLYPHS` or swap its glyphs to 3D in place (icon-convention §2 prefers ONE source).

### Pattern C — XSS-safe text rendering (preserve through the re-skin)
**Source:** `PhaseCard.tsx:25-27` (XSS note) + `PublishGauntlet.tsx` verbatim render. **Apply to:** every agent/LLM/user-authored string (phase slug, `phase.name`, verdict fields, named_failures, judge evidence) — plain React text child (auto-escaped), NEVER `dangerouslySetInnerHTML`. SVG icons are imported React components, never interpolated HTML. Grep-guarded by `PhaseCard.test.tsx:132-140`.

---

## No Analog Found

None. Every surface 127 touches has an exact analog (the file itself for the three re-skins + the additive map) or a precise sibling pattern (`providerLogo.tsx` for the optional glyph helper). RESEARCH §"Don't Hand-Roll" confirms: the data, state, verdict logic, failure taxonomy, a11y scaffolding, and modal shell are all done and must not be reinvented.

---

## Metadata

**Analog search scope:** `frontend/src/components/workflows/`, `frontend/src/components/panel/` (+ `__tests__/`), `frontend/src/lib/`, `frontend/src/components/chat/`, `frontend/src/types/`, `frontend/vite.config.ts`.
**Files scanned (read in full):** `PublishGauntlet.tsx`, `PhaseCard.tsx`, `PhaseTimeline.tsx`, `PhaseSpine.tsx`, `soulData.ts`, `providerLogo.tsx`, and the four test analogs; targeted greps on `RunCard.tsx`, `WorkflowSoul.tsx`, `types/index.ts`.
**Key cross-file facts confirmed:** `Phase` type has NO `provider`/`name` (types/index.ts:652-667) → engine chip honest source is `TaskRunIndexItem.provider` (line 598); `RunCard.tsx:256/304-314` is the canonical `providerLogo()` consumer; `PhaseSpine.test.tsx:38-44` asserts literal flat glyphs (will break on the 3D swap — migrate to data-attrs).
**Pattern extraction date:** 2026-06-27
