---
phase: 128-chat-tool-card-unification-chat-area-reclaim
plan: 03
subsystem: ui
tags: [react, lobehub-icons, chat, tool-card, partial-json, tdd, vitest]

# Dependency graph
requires:
  - phase: 128-01
    provides: "@lobehub/icons@5.10.0 installed on the main tree (antd-free via .npmrc legacy-peer-deps)"
provides:
  - "frontend/src/lib/providerLogo.tsx — the D-05 shared chat-tool-card helper, exporting providerLogo(provider) (CTC-01) + preparingDescription(tc) (TDP-02) in ONE module"
  - "providerLogo(provider): @lobehub/icons mark | null — keyed by the EXACT runs.provider strings; GLM under zhipu, Kimi under moonshot; openrouter NOT unwrapped; lmstudio/unknown/undefined → null (Bot fallback)"
  - "preparingDescription(tc): string | null — surfaces a tool's description DURING preparing from the partial-JSON tc.argsCodeText; never throws"
  - "Wave-0 unit tests: providerLogo.test.tsx (4) + preparingDescription.test.ts (6), all green"
  - "Load-bearing import recipe for Plan 04: deep COMPONENT subpaths (es/<Brand>/components/{Color,Mono}) — NOT the barrel, NOT the brand index — to stay antd-free"
affects: [128-04, RunCard, ToolCallPanel, chat-tool-card]

# Tech tracking
tech-stack:
  added: []  # @lobehub/icons was installed in Plan 01; this plan only consumes it
  patterns:
    - "Provider-logo map mirrors fileIcon.tsx (Record<string,_> keyed off a resolved string + ?? null total lookup)"
    - "preparingDescription mirrors the seamCardPayloadFor never-throw render-path parse (every JSON.parse in try/catch → null)"
    - "@lobehub/icons consumed via deep .Color/.Mono COMPONENT subpaths to bypass the antd-dragging features barrel AND the eager-Avatar brand index"

key-files:
  created:
    - frontend/src/lib/providerLogo.tsx
    - frontend/src/__tests__/lib/providerLogo.test.tsx
    - frontend/src/__tests__/lib/preparingDescription.test.ts
  modified: []

key-decisions:
  - "Imported the leaf .Color/.Mono component files (es/<Brand>/components/...) instead of the brand barrel/index — both antd-reachable paths crash at module-eval under Vite (@lobehub/ui is an unmet peer). This is the import recipe Plan 04 MUST reuse in RunCard/ToolCallPanel."
  - "Map uses .Color for google/deepseek/zhipu/minimax (gradient marks ship a Color); .Mono for openai/anthropic/moonshot/openrouter/ollama (no Color variant)."

patterns-established:
  - "Deep-component @lobehub/icons import (antd-free): import X from '@lobehub/icons/es/<Brand>/components/{Color,Mono}'"
  - "TDP-02 partial-JSON description extraction: parsed-args → full JSON.parse → targeted regex + JSON-unescape, all guarded"

requirements-completed: [CTC-01, TDP-02, CTC-02]

# Metrics
duration: 8min
completed: 2026-06-27
---

# Phase 128 Plan 03: D-05 Shared providerLogo Helper Summary

**One module `providerLogo.tsx` exporting `providerLogo()` (the runs.provider → @lobehub/icons mark map, GLM=zhipu / Kimi=moonshot / OpenRouter-not-unwrapped, antd-free via deep component imports) and `preparingDescription()` (partial-JSON `argsCodeText` description extraction, never-throws), both TDD with green Wave-0 unit tests.**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-27T06:39:44Z
- **Completed:** 2026-06-27T06:47:27Z
- **Tasks:** 2 (both TDD)
- **Files modified:** 3 created (276 insertions, 0 deletions)

## Accomplishments
- **CTC-01** — `providerLogo(provider)`: a total map over the exact `runs.provider` strings, returning the correct `@lobehub/icons` brand mark or `null` for unmapped providers (so the caller renders its existing `Bot` fallback). Honors all locked map contracts: GLM keyed `zhipu`, Kimi keyed `moonshot`, `openrouter` → the OpenRouter mark (not unwrapped, D-08), `lmstudio`/`unknown`/`undefined` deliberately absent.
- **TDP-02** — `preparingDescription(tc)`: surfaces a tool's `description` DURING the `preparing` window by reading the partial-JSON `tc.argsCodeText` (the parsed `tc.args` is `{}` until `tool_start`). Prefers parsed args → full `JSON.parse` → targeted regex; returns honest `null` when nothing is on the wire; never throws in the render path.
- **D-05** — both helpers live in ONE module, so Plan 04 imports `providerLogo` + `preparingDescription` into RunCard + ToolCallPanel with zero duplication (the G-5 micro-extraction).
- **Wave-0 tests** — `providerLogo.test.tsx` (4) + `preparingDescription.test.ts` (6), all green (10/10).

## Task Commits

Each task was committed atomically via the TDD RED→GREEN cycle:

1. **Task 1: providerLogo() map (CTC-01)**
   - RED:  `f814b416` `test(128-03): add failing test for providerLogo() map (CTC-01)`
   - GREEN: `ea5f9af2` `feat(128-03): implement providerLogo() shared map (CTC-01, D-05)`
2. **Task 2: preparingDescription() partial-JSON parse (TDP-02)**
   - RED:  `d5d7fd4f` `test(128-03): add failing test for preparingDescription() (TDP-02)`
   - GREEN: `0aeb2316` `feat(128-03): add preparingDescription() to shared helper (TDP-02, D-05)`

No REFACTOR commits — both implementations were clean on first GREEN (they mirror the documented `fileIcon.tsx` / `seamCardPayloadFor` shapes directly).

## Files Created/Modified
- `frontend/src/lib/providerLogo.tsx` — the D-05 shared helper: `providerLogo()` map + `preparingDescription()` parse, with a JSDoc security/import header.
- `frontend/src/__tests__/lib/providerLogo.test.tsx` — 4 tests: mapped-provider non-null, lmstudio/unknown/undefined null, openrouter-not-unwrapped, no-glm/kimi-key.
- `frontend/src/__tests__/lib/preparingDescription.test.ts` — 6 tests: parsed-args preference, truncated-partial extraction, full-parse, two honest-null cases, never-throws-on-garbage.

## Decisions Made
- **Deep-component imports for `@lobehub/icons` (the antd-avoidance recipe).** The research/plan said "import only `.Color`/`.Mono`, never `.Avatar`", but importing through the top-level `@lobehub/icons` barrel — and even through each brand index (`es/<Brand>`) — still drags `antd`/`@lobehub/ui` at module-eval (an UNMET peer → import-time crash under Vite). The fix is to import the leaf component files directly: `@lobehub/icons/es/<Brand>/components/Color` (or `Mono`). **Plan 04 MUST reuse this exact import form in RunCard/ToolCallPanel** — `import { OpenAI } from "@lobehub/icons"` will crash the build.
- **`.Color` vs `.Mono` per brand:** `.Color` for `google`/`deepseek`/`zhipu`/`minimax` (these ship a gradient Color mark); `.Mono` (the brand default) for `openai`/`anthropic`/`moonshot`/`openrouter`/`ollama` (no `.Color` variant exists).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `@lobehub/icons` barrel + brand-index imports crash at module-eval (antd peer)**
- **Found during:** Task 1 (providerLogo GREEN phase)
- **Issue:** The plan/research import shape `import { OpenAI, Anthropic, … } from "@lobehub/icons"` (top-level barrel) fails to load under Vite/vitest: the barrel does `export * from "./features"`, which transitively loads `features/IconAvatar` → `@lobehub/ui` → `antd-style`. `@lobehub/ui` is an unmet peer, so the import throws at eval time (`Failed to resolve import "@lobehub/ui"`). The first fix attempt (deep brand-index imports, `@lobehub/icons/es/<Brand>`) ALSO crashed, because each brand `index.js` does `import Avatar from "./components/Avatar"` at line 1 (eager), and that `Avatar` reaches the same `IconAvatar`/`@lobehub/ui`.
- **Fix:** Import the leaf `.Color`/`.Mono` COMPONENT files directly (`@lobehub/icons/es/<Brand>/components/{Color,Mono}`), which bypass both the features barrel and the brand index's eager `Avatar`. Verified the full transitive graph of those leaf files is antd-free (only `react`, the local `useFillId`/`style`, and `jsx-runtime`).
- **Files modified:** `frontend/src/lib/providerLogo.tsx` (import lines + map values)
- **Verification:** `providerLogo.test.tsx` 4/4 green after the fix; acceptance greps confirm no `.Avatar` import and no `import *`; `frontend/package.json` + lockfile unchanged (no antd added).
- **Committed in:** `ea5f9af2` (Task 1 GREEN commit)
- **Honors:** Still satisfies the plan's hard rule "use ONLY `.Color`/`.Mono`, never `.Avatar`, never `import *`" — it's the SAME marks, reached via a more specific subpath. This is the load-bearing correction for Plan 04.

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking import).
**Impact on plan:** Necessary for the module to load at all. No scope creep — same marks, same map, same exports. Surfaces a recipe Plan 04 depends on.

## Issues Encountered
- The antd-drag manifested at two import layers (barrel, then brand index) before the leaf-component path resolved it — 2 auto-fix attempts, well under the 3-attempt limit. Root cause confirmed by tracing `es/<Brand>/index.js:1` (eager Avatar) and `es/features/IconAvatar/index.js` (`import { Center } from '@lobehub/ui'`).

## Threat Flags
None — no new security surface beyond the plan's `<threat_model>`. The two mitigations it names are honored: `preparingDescription` wraps every `JSON.parse` in try/catch → null (T-128-03-01, DoS); the returned `description` is a plain string for downstream React text rendering and the regex unescape uses `JSON.parse('"…"')` (string decode only, no eval) (T-128-03-02, XSS). The `.Color`/`.Mono`-only import surface stays antd-free (T-128-03-SC, supply chain) — and the deep-component import makes that guarantee stronger than the planned barrel import.

## Known Stubs
None — both functions are fully wired to their inputs (`message.provider`, `tc.args`/`tc.argsCodeText`). They are not yet CONSUMED by RunCard/ToolCallPanel (that is Plan 04 by design — D-05 builds the shared helper first); this is a planned cross-plan seam, not a stub.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- **Plan 04 is unblocked:** it can `import { providerLogo, preparingDescription } from "@/lib/providerLogo"` into RunCard (`:280-288` avatar swap) and ToolCallPanel (`:819-833` preparing branch + `:940-945` title read).
- **CRITICAL hand-off for Plan 04:** if Plan 04 adds any further `@lobehub/icons` mark, it MUST use the deep-component import form (`@lobehub/icons/es/<Brand>/components/{Color,Mono}`). The top-level barrel and the brand-index subpath both crash the build via the antd peer.
- The D-06 live native-7+OR scoreboard (whether each provider emits `description` early in the partial JSON) is a Plan 04 / VALIDATION concern — the extraction path is correct regardless; the scoreboard measures the per-provider WIN.

## Self-Check: PASSED
- Files: `providerLogo.tsx`, `providerLogo.test.tsx`, `preparingDescription.test.ts`, `128-03-SUMMARY.md` — all present on disk.
- Commits: `f814b416`, `ea5f9af2`, `d5d7fd4f`, `0aeb2316` — all present in git log.
- Tests: 2 files, 10/10 green (`vitest run` on both new test files).

---
*Phase: 128-chat-tool-card-unification-chat-area-reclaim*
*Completed: 2026-06-27*
