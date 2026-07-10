---
phase: 127
slug: gauntlet-pip-strip-quiet-idle-cards
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 127 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Phase 127 is a **presentation-only re-skin** of three shipped files (`PublishGauntlet.tsx`,
> `PhaseCard.tsx`, `PhaseTimeline.tsx`) + one additive `PHASE_GLYPHS` swap (`soulData.ts`).
> The bar: every NEW visual contract is proven, and every EXISTING honesty/a11y test stays
> green unchanged (the structural proof the re-skin is visual-only — G-5). Source: 127-RESEARCH.md
> §Validation Architecture / §G-5 Harness Safety.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest `^4.1.0` + Testing Library + `vitest-axe` `^0.1.0` (jsdom) |
| **Config file** | `frontend/vitest.config.*` / `frontend/vite.config.*` (existing; the `?raw` source-grep loader is already used by `PublishGauntlet.test.tsx`) |
| **Quick run command** | `cd frontend && npx vitest run <path-to-test-file>` (single file) |
| **Full suite command** | `cd frontend && npm test` (= `vitest run`) |
| **Estimated runtime** | single file < 30 s · full suite varies (full `vitest run`) |

---

## Sampling Rate

- **After every task commit:** Run the single relevant test file — `cd frontend && npx vitest run <file>` (< 30 s)
- **After every plan wave:** Run `cd frontend && npm test` (full suite — proves the G-5 visual-only invariant across all panel/workflow tests)
- **Before `/gsd:verify-work`:** Full Vitest suite green **AND** the manual UAT scenarios below pass
- **Max feedback latency:** 30 seconds (single file)

---

## Per-Task Verification Map

> Task IDs are assigned at plan time (`{127}-{plan}-{task}`). Until then, this maps WUX-03's
> success criteria to the test files that prove them. The planner/executor fills the Task ID +
> Status columns. **Every "must stay green" row is an existing test — it is the G-5 proof.**

| Task ID | Wave | Requirement | Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|-------------|----------|-----------|-------------------|-------------|--------|
| TBD | 1 | WUX-03 / SC#1 | Gauntlet renders energy-spine; worded verdict leads; raw 5-field grid is behind a `<details>` disclosure (still verbatim + `▦` capped inside) | component | `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` | ✅ extend | ⬜ pending |
| TBD | 1 | WUX-03 / SC#1 (honesty) | 4 distinct HTTP outcomes (200-block/400/404/409); judge hard-wall (no enabled override, `<s>` strike); run-link gated on `golden_run_id`; criteria first-class on block; named_failures key-detection | component + source-grep | `npx vitest run src/components/workflows/PublishGauntlet.test.tsx` | ✅ must stay green | ⬜ pending |
| TBD | 1 | WUX-03 / SC#2 | Idle PhaseCard is quiet (no `oneLiner`, no activity line, no animation); only the active step blooms + carries the running-only activity line + engine chip; done folds | component | `npx vitest run src/components/panel/PhaseCard.test.tsx` | ✅ extend | ⬜ pending |
| TBD | 1 | WUX-03 / G-5 a11y | PhaseTimeline axe-clean in all 5 states; APG accordion; `role=alert` failure; indeterminate `progressbar`; status = glyph+word+colour | a11y (axe) + replay | `npx vitest run src/components/panel/__tests__/PhaseTimeline.test.tsx` | ✅ must stay green | ⬜ pending |
| TBD | 1 | WUX-03 / G-5 honesty | Failed-as-failed taxonomy + `reason_unknown` sentinel survive the re-skin | component + replay | `npx vitest run src/components/panel/__tests__/FailReason.test.tsx` | ✅ must stay green | ⬜ pending |
| TBD | 1 | WUX-03 / icon | The soul glyph-spine still asserts on data-attrs (not the literal flat glyph) after the 3D `PHASE_GLYPHS` swap | component | `npx vitest run src/components/workflows/PhaseSpine.test.tsx` | ✅ verify | ⬜ pending |
| TBD | 0 | WUX-03 / icon | Every gauntlet stage + `PHASE_GLYPHS` entry resolves to a non-empty bundled icon (no `direct-hit` empty-slug trap) | unit / build-gate | build fails on missing slug (`unplugin-icons`) OR a glyph-presence test | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] Extend `frontend/src/components/workflows/PublishGauntlet.test.tsx` — assert the worded verdict leads, the raw 5-field grid is inside a `<details>` (`raw-verdict` testid), and the verbatim `▦` cap remains **inside** the disclosure. (All EXISTING honesty assertions must continue to pass unchanged.)
- [ ] Extend `frontend/src/components/panel/PhaseCard.test.tsx` — assert an idle (`pending`) card renders NO activity line / NO `oneLiner` / NO pulse animation; a `running` card renders the activity line + engine chip; a `done` card folds to essence.
- [ ] Icon-presence gate — if the static-SVG path is chosen, add a test that every `PHASE_GLYPHS` entry + every gauntlet stage maps to a defined icon component; if the `unplugin-icons` path is chosen, the build itself is the gate (document which).
- [ ] Framework install: **none** — Vitest + vitest-axe already present.

---

## Manual-Only Verifications

> Per CLAUDE.md G-4 (lived-experience gate) + the UAT scoreboard recipe. The operator-approved
> sketch is the acceptance bar (SC#2). These are authored here, NOT as PLAN tasks.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| SC#2 density read | WUX-03 / SC#2 | "Feels quiet at rest / alive where it's happening" is a perceptual judgment | At "all idle", not-yet-run steps read quiet/still (no spinner, no placeholder, no type-lecture). When "Running", the ONE live step is unmistakable (glow + energy flowing in + activity line + engine chip) and the eye lands there instantly; done steps settle calmly. |
| Gauntlet resolved states | WUX-03 / SC#1 | Multi-state visual walkthrough vs the sketch | Walk Resting → Golden-run (hero, live clock, engine chips) → Published ("🎉 Published — v1 is live") → Judge block ("⚖️ Blocked by the grader…", per-criterion rows first-class, raw grid one click away) → Early block ("⛔ Blocked early — structure", `golden_run_id` null → no-run note). |
| All 4 HTTP outcomes render distinctly | WUX-03 / SC#1 | Requires driving real 200-block/400/404/409 responses | The worded layer must NOT collapse them — each reads as its own outcome. |
| Cross-provider engine-chip logo (SC#10 axis) | WUX-03 / SC#10 | Live per-provider render check | Each provider in the native-7 + OpenRouter roster (OpenAI · Anthropic · Google · DeepSeek · Moonshot/Kimi · Zhipu/GLM · MiniMax · OpenRouter) renders the CORRECT single-source `@lobehub/icons` mark — none falls back to a generic/empty mark for a mapped provider. NB: the `providerLogo` map keys are `zhipu`/`moonshot` (not `glm`/`kimi`) — verify the resolved `runs.provider` value is threaded, not a display label. `lmstudio`/`unknown` correctly fall to the `Bot` dot. |
| UAT scoreboard 4-axis (live-run cards) | WUX-03 / SC#10 | PhaseCard/PhaseTimeline ARE the live-run cards | cross-provider (above) × multi-tool (active phase runs ≥2 tools) × parallel-thread (Thread A workflow running while Thread B accepts a prompt — energized active-card density must not leak across threads; panel is `phasesByThread`-scoped) × long-message (long run / many phases — idle stays quiet at scale). |

---

## Validation Sign-Off

- [ ] All tasks have an automated verify or a Wave 0 dependency
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (icon-presence gate + the two test extensions)
- [ ] Every EXISTING G-5 honesty/a11y test re-run green unchanged (`cd frontend && npm test`)
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] Manual UAT scenarios passed (sketch is the acceptance bar)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
