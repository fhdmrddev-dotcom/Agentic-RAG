---
phase: 127-gauntlet-pip-strip-quiet-idle-cards
verified: 2026-06-27T00:00:00Z
status: human_needed
score: 11/11 code truths verified
overrides_applied: 0
human_verification:
  - test: "SC#2 density perceptual read — idle quiet, active unmistakable, done calm"
    expected: "At 'all-idle', not-yet-run steps read quiet/still (no spinner, no placeholder, no type-lecture). When Running, the ONE live step is unmistakable (amber glow + amber left bar + activity-line pulse + engine chip) and the eye lands there instantly. Done steps settle calmly without motion."
    why_human: "Perceptual 'feels quiet / feels alive' judgment against the sketch-approved 052-A mockup (SC#2 acceptance bar); cannot be asserted by grep or vitest."
  - test: "Gauntlet resolved-states visual walkthrough"
    expected: "Walk: Resting → Golden-run hero (amber glow, live mm/ss clock) → Published ('🎉 Published — v{n} is live') → Judge block ('⚖️ Blocked by the grader…', per-criterion rows first-class, raw grid one click away) → Early block ('⛔ Blocked early — {stage}', golden_run_id null → no-run note instead of dead link)."
    why_human: "Requires driving real or mocked multi-state gauntlet transitions in a running browser; visual fidelity of the energy-spine nodes and worded copy against sketch 051-A."
  - test: "All 4 HTTP outcomes render distinctly"
    expected: "200-block / 400-business_requirement / 404-not_found / 409-already_published each produce visually distinct resolved states; the worded layer does NOT collapse them."
    why_human: "Requires live backend calls or carefully mocked responses exercising all four branches; outcome correctness is tested in vitest but visual distinctness is a perceptual check."
  - test: "Cross-provider engine-chip logo check (SC#10 axis)"
    expected: "Each provider in the native-7 + OpenRouter roster (OpenAI · Anthropic · Google · DeepSeek · Moonshot/Kimi · Zhipu/GLM · MiniMax · OpenRouter) renders the correct single-source @lobehub/icons mark in the running PhaseCard activity line. lmstudio/unknown correctly render no chip (honestly-absent). Provider key used is the resolved runs.provider value (e.g. 'zhipu', 'moonshot'), not a display label."
    why_human: "Requires a live workflow run per provider to exercise the real SSE→phase.subAgents[0].provider path; cannot be fully driven by static test fixtures."
  - test: "4-axis UAT scoreboard (live-run cards, SC#10)"
    expected: "Cross-provider (above) × multi-tool (active phase runs ≥2 tools — activity line + density correct) × parallel-thread (Thread A workflow running while Thread B accepts a prompt — energized active-card density must not leak across threads; panel is phasesByThread-scoped) × long-message (long run / many phases — idle cards stay quiet at scale)."
    why_human: "Requires live parallel-thread + long-run exercising; phasesByThread scoping is existing behavior but density correctness under load is perceptual."
---

# Phase 127: Gauntlet Pip-Strip + Quiet Idle Cards — Verification Report

**Phase Goal:** The publish gauntlet reads at a glance as a pip-strip + worded verdict with raw detail on demand, and idle PhaseCards stay visually quiet instead of competing for attention.
**Verified:** 2026-06-27
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Phase-type glyphs render as 3D fluent-emoji icons from one shared source (PHASE_GLYPHS swap); no production glyph renders empty | VERIFIED | `soulData.ts` PHASE_GLYPHS has 6 slug-string values; `phaseGlyph.tsx` PHASE_GLYPH_MARKS maps all 6 to bundled imports; `phaseGlyph.test.tsx` asserts every key → non-null component |
| 2 | 3D icons bundled at build time (no runtime CDN); missing slug fails the build or glyph-presence test catches it | VERIFIED | `vite.config.ts` + `vitest.config.ts` both register `Icons({ compiler:"jsx", jsx:"react" })`; `unplugin-icons.d.ts` shim present; phaseGlyph.test.tsx is the structural backstop |
| 3 | Unknown phase type renders non-empty unicode fallback (the "•" / UNKNOWN_PHASE_META discipline survives) | VERIFIED | `phaseGlyph()` returns `null` for unmapped keys; PhaseSpine.tsx renders `PHASE_GLYPHS[type] ?? "•"`; PhaseCard.tsx renders `meta.glyph` ("•") when Glyph is null |
| 4 | The 8 gauntlet stages render as a compact horizontal energy-spine (not wrapping boxes); passed=green+✓, golden-run=amber aura+comet, blocked=red; `verdict.blocked_stage` (server truth) drives the tone | VERIFIED | `GauntletSpine` function in PublishGauntlet.tsx: `blockedIndex`/`isPassed`/`running && i===5` derivation byte-unchanged (visual tone only); all 8 stage labels + 3D icons via `~icons/fluent-emoji/*`; `data-testid="gauntlet-spine"` retained |
| 5 | Resolved gauntlet leads with a plain-worded verdict (`verdict-headline`); verbatim 5-field grid demoted behind `<details data-testid="raw-verdict">`; `▦ rendered verbatim` provenance cap stays inside the disclosure | VERIFIED | `wordedHeadline` derived from `verdict.published`/`blocked_stage` (server truth, never re-derived); `<details data-testid="raw-verdict">` wraps `<VerdictFields/>` (unchanged) at line 622; `▦` cap is last child of VerdictFields at line 233 |
| 6 | All existing gauntlet honesty contracts preserved verbatim: verbatim verdict; judge hard wall (`<s>publish anyway</s>`, no enabled override); 4 distinct HTTP outcomes (200/400/404/409); run-link gated on `golden_run_id != null`; per-criterion judge rows first-class on block; named_failures KEY-DETECTION | VERIFIED | `VerdictFields` unchanged inside `<details>`; `HardWall` with `<s>publish anyway</s>` at line 282; `httpStatusForKind()` covers all 4 kinds; `RunLink` gated on `goldenRunId != null` (lines 640-641); `named_failures.map(renderFailure)` at line 635 is OUTSIDE `<details>`; `renderFailure()` key-detection logic unchanged (lines 187-197) |
| 7 | Golden-run wait is the hero (glowing amber panel + live elapsed clock); engine chips via `providerLogo()`, honestly-absent when provider unknown — never fabricated | VERIFIED | `PublishingNotice`: `gauntlet-hero-glow` class; `data-testid="publish-elapsed"` + mm/ss clock unchanged; `const EngineMark = providerLogo(provider)`; chip guarded by `{provider && (...)}` — omitted entirely when no honest provider (T-127-06); no `Bot` rendered on the publish surface |
| 8 | Idle (pending) PhaseCard is quiet: no `oneLiner` type-lecture, no running activity line, no pulse/animation | VERIFIED | `isActive = isRunning \|\| retrying` (line 264); `oneLiner` is `{isActive && (...)}` (line 389); `data-activity-line` div is `{isRunning && (...)}` (line 399); pending branch → `opacity-60` only, no motion class; phaseCard.test.tsx idle-quiet test (line 171) asserts no oneLiner, no activity-line, no `animate-*` class |
| 9 | Active (running) PhaseCard blooms (amber wash + left bar + glow); has running-ONLY activity line + honest AI-engine chip from real `subAgents[0].provider`; no Bot fabrication | VERIFIED | Running branch: `border-l-[3px] border-l-[hsl(var(--panel-status-active))] bg-gradient-to-r from-[hsl(...)] shadow-[0_0_24px...]`; `data-activity-line` div with `motion-safe:animate-pulse` dot; `EngineMark = provider ? providerLogo(provider) : null`; `{EngineMark && <EngineMark size={16}/>}` — no Bot fallback on live card; test confirms SVG present with real provider, absent with `subAgents:[]` |
| 10 | Done PhaseCard folds to one-line essence; failed renders closed-taxonomy reason unchanged | VERIFIED | Done branch → `border-border/50 bg-card/30` (no bloom, no motion); `oneLiner` suppressed (not `isActive`); failed branch: `classifyFailure()` + `role="alert"` block unchanged (lines 175-236, 446); test confirms done=no-oneLiner/no-activity-line, Complete status |
| 11 | ICON CONVENTION held: shared 3D PHASE_GLYPHS via phaseGlyph(); no iconify CDN / dangerouslySetInnerHTML; soul prop red-line NOT threaded into PhaseCard/PhaseTimeline | VERIFIED | 0 matches for `iconify-icon` or `code.iconify.design` in src/; 0 `dangerouslySetInnerHTML` in PublishGauntlet.tsx; `PhaseCardProps` has only `{phase: Phase, position: number}` — no soul prop; PhaseTimeline passes no soul prop to PhaseCard |

**Score:** 11/11 code truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `frontend/src/lib/phaseGlyph.tsx` | 3D phase-type resolver mirroring providerLogo.tsx | VERIFIED | Exports `phaseGlyph()` + `PhaseMark` type; 6 `~icons/fluent-emoji/*` imports; `PHASE_GLYPH_MARKS` Record; null for unknown/undefined |
| `frontend/vite.config.ts` | unplugin-icons registered | VERIFIED | `Icons({ compiler:"jsx", jsx:"react" })` in plugins array alongside `react()` and the `@` alias |
| `frontend/vitest.config.ts` | unplugin-icons registered for test env | VERIFIED | Same Icons plugin registration (deviation from plan, correctly auto-fixed so `~icons/*` resolves in tests) |
| `frontend/src/types/unplugin-icons.d.ts` | `~icons/*` ambient TS shim | VERIFIED | Declares `ComponentType<SVGProps<SVGSVGElement> & { size?: number \| string }>` |
| `frontend/src/components/workflows/soulData.ts` | PHASE_GLYPHS with 3D slug strings | VERIFIED | 6 keys → verified fluent-emoji slug strings; comment excludes `direct-hit`/`no-entry-sign` |
| `frontend/src/lib/phaseGlyph.test.tsx` | Presence gate test | VERIFIED | Iterates all PHASE_GLYPHS keys → asserts non-null; unmapped/undefined → null |
| `frontend/src/components/workflows/PhaseSpine.test.tsx` | Migrated to data-attribute assertions | VERIFIED | Literal-glyph `getByText("🤖")` removed; assertions now use `data-phase-type` attribute hooks |
| `frontend/src/components/workflows/PublishGauntlet.tsx` | Energized re-skin with honesty contracts intact | VERIFIED | GauntletSpine, PublishingNotice hero, verdict-headline, `<details data-testid="raw-verdict">`, all honesty contracts present |
| `frontend/src/components/workflows/PublishGauntlet.test.tsx` | Extended with 5 new assertions | VERIFIED | Phase 127-02 describe block at line 432: worded-leads, grid-in-details (all 5 verdict-* rows), cap-in-details, criteria-first-class, success-worded |
| `frontend/src/components/panel/PhaseCard.tsx` | Density-by-status re-skin | VERIFIED | phaseGlyph + providerLogo imports; isActive/Glyph/EngineMark computed; cn() branches for pending/running/done; data-activity-line; all G-5 a11y scaffolding unchanged |
| `frontend/src/components/panel/PhaseTimeline.tsx` | Decorative energy-connector spine | VERIFIED | `aria-hidden` + `pointer-events-none` decorative rail; `motion-safe:animate-pulse` gated comet; `<ol>/<li>/<PhaseCard>` structure, aria-label, aria-busy unchanged |
| `frontend/src/components/panel/PhaseCard.test.tsx` | Extended with density assertions | VERIFIED | 127-03 describe block at line 170: idle-quiet, active-bloom, engine-chip-present/absent, done-fold, 3D-glyph/unicode-fallback |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|----|--------|---------|
| `PhaseSpine.tsx` | `soulData.ts (PHASE_GLYPHS)` | import + `PHASE_GLYPHS[type] ?? "•"` fallback | WIRED | Line 19: `import { PHASE_GLYPHS … } from "@/components/workflows/soulData"`; line 88: `PHASE_GLYPHS[type] ?? "•"` |
| `PhaseSpine.tsx` | `phaseGlyph.tsx` | `phaseGlyph(type)` → Glyph component | WIRED | Line 20: `import { phaseGlyph } from "@/lib/phaseGlyph"`; line 60: `const Glyph = phaseGlyph(type)` |
| `phaseGlyph.tsx` | `~icons/fluent-emoji/*` (bundled SVGs) | build-time import of 6 verified slugs | WIRED | Lines 28-33: 6 `import X from "~icons/fluent-emoji/<slug>"` statements; unplugin-icons resolves at build/test time |
| `GauntletSpine` | `verdict.blocked_stage` (server truth) | `blockedIndex = STAGES.findIndex(s => s.codes.includes(blockedStage))` | WIRED | Lines 309-311: visual derivation only; pass/block truth stays server-side |
| `PublishingNotice` | `providerLogo.tsx` | `const EngineMark = providerLogo(provider)` | WIRED | Line 390: import + resolution; chip guard `{provider && (...)}` at line 408 |
| `PublishGauntlet.tsx (STAGES)` | `~icons/fluent-emoji/*` | 8 direct bundled imports (Shield/CheckMarkButton/Bullseye/…) | WIRED | Lines 59-66: each stage has verified slug; `Icon = stage.Icon` rendered in GauntletSpine |
| `PhaseCard.tsx` | `phaseGlyph.tsx` | `const Glyph = phaseGlyph(phase.phaseType)` | WIRED | Line 31 import; line 267 resolution; line 343 render with `?? meta.glyph` fallback |
| `PhaseCard.tsx (running branch)` | `providerLogo.tsx` | `const EngineMark = provider ? providerLogo(provider) : null` | WIRED | Lines 32, 273; chip render at line 408: `{EngineMark && <EngineMark size={16}/>}` |
| `PhaseTimeline.tsx` | `PhaseCard.tsx` | `<PhaseCard phase={phase} position={i}/>` | WIRED | Line 214: structure unchanged from pre-127 baseline |

---

### Data-Flow Trace (Level 4)

Not applicable — Phase 127 is a pure presentation-only re-skin. No new data sources introduced. Existing data model (`Phase`, `PhaseVerdict`, `PublishVerdict`) unchanged. The engine chip data flows from the existing `phase.subAgents[0].provider` SSE path (always `[]` today for most phases — chip is honestly-absent, not HOLLOW).

---

### Behavioral Spot-Checks

Step 7b: SKIPPED — per context note, `npm test` / `vitest` cannot be run from the main checkout (incomplete `node_modules`). Both executors ran full targeted suites green in isolated worktrees (127-02: 24/24, 127-03: 34/34) and `tsc -b` showed zero type errors in phase-127 production files. Code-reading verification substitutes for runtime spot-checks per the task context.

---

### Probe Execution

Step 7c: No probes declared or conventional probe scripts exist for this phase. Phase 127 is UI-only. SKIPPED.

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| WUX-03 (STRETCH) | 127-01, 127-02, 127-03 | Gauntlet pip-strip + quiet idle cards | SATISFIED | SC#1 (energy-spine + worded verdict + raw-on-demand) and SC#2 (idle quiet / active bloom) both verified by code; human perceptual check of SC#2 remains operator-owned |

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `frontend/src/components/workflows/PublishGauntlet.tsx` lines 246, 254, 257 | "coming soon" text in `RunLink` component | INFO | Pre-existing deferred affordance (D-103-A, Phase 103). The run-view link was disabled before Phase 127 and is explicitly documented with a formal decision reference. Not a Phase 127 artifact; not a stub introduced here. |

No TBD / FIXME / XXX markers found in any Phase-127-modified file.
No `dangerouslySetInnerHTML` in any Phase-127-modified file.
No `iconify-icon` / CDN icon reference anywhere under `frontend/src/`.
No `direct-hit` or `no-entry-sign` slugs imported (only mentioned in exclusion comments).
No soul prop threaded into PhaseCard or PhaseTimeline (G-5 red line preserved).
No fabricated provider/engine brand in any code path.

---

### Human Verification Required

These are the operator-owned manual UAT items from `127-VALIDATION.md`. They are expected and do not indicate a code gap.

#### 1. SC#2 Density Perceptual Read

**Test:** Open a workflow run in the panel. Navigate to a state where some phases are pending, one is running, and some are done.
**Expected:** Pending steps read quiet/still — no spinner, no type-lecture, no placeholder; a single running step is unmistakable (amber glow + left bar + activity-line pulse dot + "Working" label + engine chip if provider is wired); done steps settle calmly without motion.
**Why human:** "Feels quiet at rest / alive where it's happening" is a perceptual judgment against the sketch-approved 052-A mockup (SC#2 acceptance bar). Cannot be asserted by grep or vitest.

#### 2. Gauntlet Resolved-States Visual Walkthrough

**Test:** Run the publish gauntlet to exercise each outcome: resting form, golden-run in-flight, published success, judge block, early block.
**Expected:** Resting = compact "Publish…" trigger. In-flight = amber hero glow around the Rocket node, live elapsed mm/ss clock. Published = "🎉 Published — v{n} is live" headline leads; raw grid one click away under "Show raw verdict". Judge block = "⚖️ Blocked by the grader…" headline; per-criterion rows first-class above the disclosure; `<s>publish anyway</s>` hard wall visible. Early block = "⛔ Blocked early — {stage}" headline; `golden_run_id null` → honest "no-run note", not a dead link.
**Why human:** Multi-state visual walkthrough against sketch 051-A. Energy-spine node tones, comet animation, and copy fidelity cannot be verified by grep.

#### 3. All 4 HTTP Outcomes Render Distinctly

**Test:** Exercise 200-block, 400-business_requirement, 404-not_found, 409-already_published responses.
**Expected:** Each produces a visually distinct resolved state; the worded layer does not collapse them.
**Why human:** Requires live backend calls or mocked responses; visual distinctness is a perceptual check beyond what vitest covers.

#### 4. Cross-Provider Engine-Chip Logo Check (SC#10)

**Test:** Run a workflow on each provider in the native-7 + OpenRouter roster. Observe the running PhaseCard's activity line.
**Expected:** Each provider renders its correct single-source `@lobehub/icons` mark. lmstudio/unknown render no chip (honestly-absent). Provider key used is the resolved `runs.provider` value (`zhipu`/`moonshot`, not `glm`/`kimi`).
**Why human:** Requires a live workflow run per provider to exercise the real SSE → `phase.subAgents[0].provider` path.

#### 5. 4-Axis UAT Scoreboard (SC#10)

**Test:** Execute scenarios across cross-provider × multi-tool × parallel-thread × long-message axes.
**Expected:** Cross-provider (above) × multi-tool (active phase running ≥2 tools — density correct) × parallel-thread (Thread A running workflow, Thread B new prompt — energized card density must not leak across threads; panel is `phasesByThread`-scoped) × long-message (many phases — idle cards stay quiet at scale).
**Why human:** Live parallel-thread and long-run exercising; `phasesByThread` scoping is existing behavior but density correctness at scale is perceptual.

---

### Gaps Summary

No code gaps. All 11 observable code truths are verified. All required artifacts exist, are substantive, and are wired. No dead stubs, no honesty contracts softened, no unresolved debt markers.

The 5 human verification items are all expected operator-owned UAT items per the plan's explicit `MANUAL-ONLY` designation in `127-VALIDATION.md`. They represent live-browser / perceptual / cross-provider checks that the plan correctly deferred to the operator.

---

_Verified: 2026-06-27_
_Verifier: Claude (gsd-verifier)_
