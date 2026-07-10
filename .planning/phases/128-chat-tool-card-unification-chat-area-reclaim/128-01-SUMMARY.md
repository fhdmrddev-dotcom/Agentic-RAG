---
phase: 128-chat-tool-card-unification-chat-area-reclaim
plan: 01
subsystem: ui
tags: [npm, dependency, lobehub-icons, provider-logos, supply-chain, frontend]

# Dependency graph
requires:
  - phase: 128 (discuss + research)
    provides: "D-08 locked logo package choice (@lobehub/icons) + the antd-avoidance directive (Pitfall 3)"
provides:
  - "@lobehub/icons@^5.10.0 installed in the frontend (the only net-new dependency in Phase 128)"
  - "Locked, antd-free resolution committed in frontend/package-lock.json"
  - "Downstream plans (Plan 03 providerLogo.tsx, Plan 04 RunCard/ToolCallPanel) can import the .Color/.Mono provider marks"
affects: [128-02, 128-03, 128-04, "providerLogo.tsx", "RunCard", "ToolCallPanel", "Wave 4 live native-7+OR scoreboard"]

# Tech tracking
tech-stack:
  added: ["@lobehub/icons@^5.10.0 (MIT, official lobehub org, tree-shakeable provider brand marks)"]
  patterns: ["Install brand-mark packages with --legacy-peer-deps to avoid materializing heavy optional UI peers (antd / @lobehub/ui) when only the pure-SVG .Color/.Mono sub-components are consumed"]

key-files:
  created: []
  modified:
    - frontend/package.json
    - frontend/package-lock.json

key-decisions:
  - "Installed @lobehub/icons@^5.10.0 with the caret range (not pinned-exact, not *), lockfile committed (D-08)"
  - "Reinstalled with --legacy-peer-deps so the optional @lobehub/ui ^5.0.0 and antd ^6.1.1 peers are NOT auto-installed — the lockfile gains zero node_modules/antd or node_modules/@lobehub/ui install entries (threat T-128-01 / Pitfall 3)"
  - "Supply-chain checkpoint (Task 1) recorded as operator-approved: npmjs verified v5.10.0, MIT, exact name @lobehub/icons"

patterns-established:
  - "antd-free icon install: prefer .Color/.Mono (pure SVG, zero deps) over .Avatar (drags antd); when npm 7+ auto-installs the unmet UI peers, re-run the install with --legacy-peer-deps so the optional peers stay unmet-but-benign per research § Peer-dependency note"

requirements-completed: [CTC-01]

# Metrics
duration: ~6min
completed: 2026-06-27
---

# Phase 128 Plan 01: Install @lobehub/icons (antd-free) Summary

**Added the D-08-locked `@lobehub/icons@^5.10.0` provider-brand-mark package to the frontend, installed `--legacy-peer-deps` so the optional `@lobehub/ui`/`antd` peers never land in the lockfile — only the pure-SVG `.Color`/`.Mono` marks are reachable.**

## Performance

- **Duration:** ~6 min
- **Completed:** 2026-06-27
- **Tasks:** 2 (Task 1 supply-chain checkpoint — pre-approved by operator; Task 2 install + verify)
- **Files modified:** 2

## Accomplishments
- `@lobehub/icons@^5.10.0` is present in `frontend/package.json` dependencies (caret range, alphabetically placed at the top of the block).
- `frontend/package-lock.json` resolves it (`node_modules/@lobehub/icons@5.10.0` + its own nested `lucide-react@0.469.0` + its declared runtime dep `antd-style`).
- The lockfile contains **zero** `node_modules/antd` or `node_modules/@lobehub/ui` install entries, and those directories are physically absent from `node_modules` — the `.Avatar` antd dependency tree never materialized (threat T-128-01 mitigated, Pitfall 3 avoided).
- Both manifest files committed atomically. The install landed in the MAIN working tree's `node_modules` so downstream plans (128-03/128-04) and the Wave 4 live UAT can resolve the import.

## Task Commits

1. **Task 1: Supply-chain gate — verify @lobehub/icons before install** — operator-approved before this agent ran (no commit; blocking `checkpoint:human-verify`, recorded resolved). Operator reviewed https://www.npmjs.com/package/@lobehub/icons and confirmed v5.10.0, MIT, exact name `@lobehub/icons`.
2. **Task 2: Install @lobehub/icons@^5.10.0 + verify the lockfile stays antd-free** — `c26c6703` (chore)

_Note: STATE.md and ROADMAP.md were intentionally NOT modified by this executor — the orchestrator owns those writes (balloon-bug mitigation). No final docs commit was made for that reason; the orchestrator updates project state centrally after this agent returns._

## Files Created/Modified
- `frontend/package.json` — added `"@lobehub/icons": "^5.10.0"` to `dependencies`.
- `frontend/package-lock.json` — locked, antd-free resolution for `@lobehub/icons` and its real runtime deps.

## Decisions Made
- **Caret range, lockfile committed (D-08):** `^5.10.0`, not pinned-exact, not `*`.
- **`--legacy-peer-deps` on (re)install:** see Deviations below — necessary to keep the lockfile antd-free under npm 11's default peer auto-install behavior. The unmet `@lobehub/ui`/`antd` peers are benign for our import surface (research § Peer-dependency note); the consuming code (Plans 03/04) imports only `.Color`/`.Mono`, never `.Avatar`, so no antd code is ever reachable.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Re-ran the install with `--legacy-peer-deps` to keep the lockfile antd-free**
- **Found during:** Task 2 (Install @lobehub/icons)
- **Issue:** The verbatim research command `npm install @lobehub/icons@^5.10.0` under npm 11.4.0 auto-installed the package's optional `peerDependencies` (`@lobehub/ui ^5.0.0` and `antd ^6.1.1`) — npm 7+ has `legacy-peer-deps=false` by default, so it materialized 409 packages including `node_modules/antd` and `node_modules/@lobehub/ui`. The plan's automated verify (and threat T-128-01 / `must_haves` truth #2) explicitly fails when those install entries appear in the lockfile.
- **Fix:** Restored the two manifests to their clean baseline (`git checkout -- frontend/package.json frontend/package-lock.json`, scoped to those two files — no blanket reset), then re-ran `cd frontend && npm install @lobehub/icons@^5.10.0 --legacy-peer-deps`. npm removed 344 packages (the auto-installed peer tree), leaving only `@lobehub/icons` + its declared runtime deps (`antd-style`, `es-toolkit`, `polished`, nested `lucide-react`). This is the SAME operator-approved package and version — no substitution, no different package name (so the Rule 3 package-install exclusion does not apply; this is an install-flag correction, not a swap).
- **Files modified:** `frontend/package.json`, `frontend/package-lock.json`
- **Verification:** Plan's verbatim automated verify passes — `dep ok: ^5.10.0`; `lockfile has @lobehub/icons`; `OK: no antd / @lobehub/ui installed`. Independently confirmed: `node_modules/@lobehub/ui` and `node_modules/antd` physically absent; the lockfile diff adds only `node_modules/@lobehub/icons`, its nested `lucide-react`, and `node_modules/antd-style` (a real runtime dependency of the package, distinct from the forbidden `antd`/`@lobehub/ui` peers).
- **Committed in:** `c26c6703` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** The fix was required to satisfy the plan's own antd-free acceptance criteria and threat T-128-01 under the installed npm version. Same package/version as locked in D-08; no scope creep, no extra dependencies beyond `@lobehub/icons` and its own declared runtime deps.

## Issues Encountered
- None beyond the deviation above. The `antd-style` package that remains in the lockfile is `@lobehub/icons`'s own declared `dependency` (`"antd-style": "^4.1.0"`) — it is NOT the heavyweight `antd ^6.1.1` peer nor `@lobehub/ui ^5.0.0`, and is only reachable via `.Avatar`, which the consuming code never imports.

## User Setup Required
None — no external service configuration required. `@lobehub/icons` is a normal npm dependency now resolved in the main tree's `node_modules`.

## Next Phase Readiness
- The logo package is installed and antd-free. Plan 03 (`frontend/src/lib/providerLogo.tsx`) can now import the `.Color`/`.Mono` marks for `openai · anthropic · google · deepseek · moonshot · zhipu · minimax · openrouter · ollama`, with the locked `Bot`-dot fallback for `lmstudio`/openai-compat/unknown (D-08).
- No blockers. STATE.md / ROADMAP.md updates are deferred to the orchestrator.

## Self-Check: PASSED

- FOUND: `frontend/package.json` lists `@lobehub/icons@^5.10.0`
- FOUND: `frontend/package-lock.json` resolves `@lobehub/icons` (antd-free)
- FOUND: commit `c26c6703` (`git log` / `git show`)
- CONFIRMED: STATE.md and ROADMAP.md NOT modified by this executor

---
*Phase: 128-chat-tool-card-unification-chat-area-reclaim*
*Completed: 2026-06-27*
