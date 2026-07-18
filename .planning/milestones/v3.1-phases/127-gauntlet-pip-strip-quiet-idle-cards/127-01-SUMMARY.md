---
phase: 127-gauntlet-pip-strip-quiet-idle-cards
plan: "01"
subsystem: frontend/icons
tags: [wux-03, icon-convention, phase-glyphs, unplugin-icons, tdd]
dependency_graph:
  requires: [a84c4cab]
  provides: [phaseGlyph resolver, PHASE_GLYPHS 3D vocabulary, unplugin-icons build pipeline]
  affects: [soulData.ts, PhaseSpine.tsx, vite.config.ts, vitest.config.ts]
tech_stack:
  added: [unplugin-icons@^23.0.1, "@iconify-json/fluent-emoji@^1.2.7", "@svgr/core", "@svgr/plugin-jsx"]
  patterns: [build-time SVG bundling, keyed-resolver pattern (mirrors providerLogo.tsx), TDD RED/GREEN]
key_files:
  created:
    - frontend/src/lib/phaseGlyph.tsx
    - frontend/src/lib/phaseGlyph.test.tsx
    - frontend/src/types/unplugin-icons.d.ts
  modified:
    - frontend/vite.config.ts
    - frontend/vitest.config.ts
    - frontend/src/components/workflows/soulData.ts
    - frontend/src/components/workflows/PhaseSpine.tsx
    - frontend/src/components/workflows/PhaseSpine.test.tsx
    - frontend/package.json
    - frontend/package-lock.json
decisions:
  - "PHASE_GLYPHS stays Record<string,string> but values are now fluent-emoji slug strings (not unicode); phaseGlyph() is the render-time resolver; the slug string serves as the text fallback label for unknown types"
  - "unplugin-icons registered in BOTH vite.config.ts and vitest.config.ts so ~icons/* resolves in both build and test environments"
  - "PhaseMark type uses ComponentType<SVGProps<SVGSVGElement> & {size?: number|string}> to match the ~icons/* shim (not a narrow {size?: number} as initially drafted)"
  - "phaseGlyph.test.tsx presence check uses typeof==='function'||typeof==='object' because unplugin-icons wraps components in React.memo (typeof='object', not 'function')"
metrics:
  duration: "~25 min"
  completed: "2026-06-27"
  tasks_completed: 4
  files_changed: 11
---

# Phase 127 Plan 01: Icon Foundation — 3D Glyph Pipeline Summary

Build-time 3D icon mechanism installed (unplugin-icons + @iconify-json/fluent-emoji), PHASE_GLYPHS upgraded from flat unicode to verified fluent-emoji slug strings, phaseGlyph() resolver created mirroring providerLogo.tsx, PhaseSpine wired to 3D glyphs with unicode fallback, and the glyph-presence test guard added.

## Tasks Completed

| # | Name | Commit | Files |
|---|------|--------|-------|
| 1 | Install devDeps (operator-approved, handled by orchestrator) | a84c4cab | package.json, package-lock.json |
| 2 | Vite+vitest registration + TS shim + phaseGlyph() | fbd5ab2b | vite.config.ts, vitest.config.ts, unplugin-icons.d.ts, phaseGlyph.tsx |
| 3 TDD RED | Failing test for 3D SVG glyph rendering | 1431775b | PhaseSpine.test.tsx |
| 3 TDD GREEN | PHASE_GLYPHS upgrade + PhaseSpine wiring + test migration | b3bedfbf | soulData.ts, PhaseSpine.tsx, PhaseSpine.test.tsx, package.json |
| 4 | Glyph-presence test (Wave-0 icon gate) | 9c40295b | phaseGlyph.test.tsx |

## Verification

- `cd frontend && npx vitest run src/components/workflows/PhaseSpine.test.tsx src/lib/phaseGlyph.test.tsx`: **13/13 PASS**
- No `iconify-icon` web component, no `code.iconify.design` reference anywhere under frontend/src
- Only verified fluent-emoji slugs used (direct-hit/no-entry-sign excluded)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts also needs Icons plugin**
- **Found during:** Task 2
- **Issue:** vitest.config.ts is independent of vite.config.ts; the Icons plugin registered only in vite.config.ts would not be picked up by vitest, causing `~icons/*` import failures in tests
- **Fix:** Added `Icons({ compiler: "jsx", jsx: "react" })` to vitest.config.ts plugins array
- **Files modified:** frontend/vitest.config.ts
- **Commit:** fbd5ab2b

**2. [Rule 1 - Bug] PhaseMark type too narrow for ~icons/* shim**
- **Found during:** Task 2 TS check
- **Issue:** `PhaseMark = ComponentType<{size?: number}>` caused TS2322 errors when assigning `~icons/*` imports (typed as `ComponentType<SVGProps<SVGSVGElement> & {size?: number|string}>`)
- **Fix:** Changed PhaseMark to match the shim type exactly: `ComponentType<SVGProps<SVGSVGElement> & {size?: number|string}>`; exported as part of the public API
- **Files modified:** frontend/src/lib/phaseGlyph.tsx
- **Commit:** fbd5ab2b

**3. [Rule 3 - Blocking] @svgr/core + @svgr/plugin-jsx peer deps missing**
- **Found during:** Task 3 test run
- **Issue:** unplugin-icons (compiler:'jsx') requires `@svgr/core >=7.0.0` and `@svgr/plugin-jsx` as declared peer deps; they were not installed with the initial npm install
- **Fix:** `npm install -D @svgr/core @svgr/plugin-jsx` — these are declared peer deps of the already-approved `unplugin-icons`, from the established @svgr namespace (react-svgr.com)
- **Files modified:** frontend/package.json, package-lock.json
- **Commit:** b3bedfbf

**4. [Rule 1 - Bug] phaseGlyph.test.tsx: typeof check failed for memo-wrapped components**
- **Found during:** Task 4 test run
- **Issue:** unplugin-icons wraps components in React.memo, making `typeof result === 'function'` false (returns 'object'); the presence test assertion was too strict
- **Fix:** Broadened check to `typeof === 'function' || (typeof === 'object' && result !== null)` with explanatory comment
- **Files modified:** frontend/src/lib/phaseGlyph.test.tsx
- **Commit:** 9c40295b

**5. [Rule 3 - Task ordering] PhaseSpine.test.tsx literal-glyph migration done in Task 3 not Task 4**
- **Found during:** Task 3 GREEN
- **Issue:** Task 3's verification (`npx vitest run PhaseSpine.test.tsx`) cannot pass if the existing literal-glyph assertions (`getByText("🤖")`) remain after the 3D swap. The plan put this migration in Task 4, but Task 3's verify gate requires it.
- **Fix:** Migrated the literal-glyph test to data-attribute assertions as part of Task 3 GREEN. Task 4 retained only the creation of phaseGlyph.test.tsx.
- **Files modified:** frontend/src/components/workflows/PhaseSpine.test.tsx
- **Commit:** b3bedfbf

## Known Stubs

None — this plan is infrastructure only (no UI rendering stubs).

## Threat Flags

None — this plan touches only build config and frontend lib files. No new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

- frontend/src/lib/phaseGlyph.tsx: EXISTS ✓
- frontend/src/lib/phaseGlyph.test.tsx: EXISTS ✓
- frontend/src/types/unplugin-icons.d.ts: EXISTS ✓
- Commits fbd5ab2b, 1431775b, b3bedfbf, 9c40295b: all in git log ✓
- 13/13 tests pass ✓
