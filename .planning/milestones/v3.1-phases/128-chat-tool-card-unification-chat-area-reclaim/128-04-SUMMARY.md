---
phase: 128-chat-tool-card-unification-chat-area-reclaim
plan: 04
subsystem: ui
tags: [react, vitest, lobehub-icons, tool-card, streaming, cross-provider, providerLogo]

# Dependency graph
requires:
  - phase: 128-03
    provides: "the shared providerLogo.tsx helper (providerLogo + preparingDescription)"
  - phase: 128-01
    provides: "the @lobehub/icons install (antd-free deep-leaf import path)"
provides:
  - "CTC-01: RunCard tool-card header avatar renders the per-provider @lobehub mark (Bot fallback for unmapped) with the brandPulse ring preserved while streaming"
  - "TDP-02: ToolCallPanel surfaces the tool description DURING the preparing window (parsed from partial-JSON argsCodeText) with the honest quiet fallback"
  - "CTC-02: the unified cross-provider tool card — both consumers de-duped through the ONE shared helper; logo + status/elapsed/step/file uniform across providers"
  - "RunCard.logo.test.tsx — structural coverage of the avatar swap + brandPulse gating"
  - "chore: @testing-library/dom peer installed — un-rots the whole component test suite (was unloadable at baseline)"
affects: [128-05, 128-06, RunCard, ToolCallPanel, cross-provider-scoreboard]

# Tech tracking
tech-stack:
  added: ["@testing-library/dom@10.4.1 (devDependency — the missing required peer of @testing-library/react@16)"]
  patterns:
    - "Pure-presentation provider resolution at the render seam over the already-resolved message.provider (no backend/SSE fork — red line D-14)"
    - "Shared-helper consumption: RunCard + ToolCallPanel import the ONE providerLogo.tsx; neither imports @lobehub/icons directly (the barrel/brand-index crashes the Vite build via the unmet @lobehub/ui peer)"
    - "Honest additive description: render preparingDescription(tc) only when non-null; never fabricate (D-06)"

key-files:
  created:
    - "frontend/src/__tests__/components/RunCard.logo.test.tsx"
  modified:
    - "frontend/src/components/chat/RunCard.tsx"
    - "frontend/src/components/chat/ToolCallPanel.tsx"
    - "frontend/package.json + frontend/package-lock.json (peer dep)"

key-decisions:
  - "D-01: the tool-card header avatar shows the REAL per-provider mark on the existing gradient-primary backing; animate-brandPulse STAYS while streaming — only the inner glyph changes"
  - "D-01/TDP-02: a tool's description surfaces during the preparing window via preparingDescription(tc), reading partial-JSON tc.argsCodeText (NOT tc.args, which is {} during preparing)"
  - "D-06: the description is additive/honest — null keeps the quiet 'Preparing/Generating {tool}…' copy; never fabricate; the Google-atomic 'Waiting for model…' block is preserved"
  - "D-08: unmapped providers (lmstudio/unknown/undefined) degrade to the Bot fallback — never a wrong brand"
  - "D-04: closes the TDP-02 description-window slice of BUG-260607-02 only; the timer-reseed (BUG-260610-01) stays OPEN (it lives in the Phase 127 harness strip, not the Deep RunStatusStrip)"

patterns-established:
  - "Provider-at-the-boundary: the logo map is a pure frontend function keyed off the resolved provider string (mirrors fileIcon.tsx / toolKey.ts) — no shared-path fork"
  - "Never-mutate tc.args: the description is parsed read-only from tc.argsCodeText; StreamsProvider owns tc.args"

requirements-completed: [CTC-01, CTC-02, TDP-02]

# Metrics
duration: 7min
completed: 2026-06-27
---

# Phase 128 Plan 04: Unified Cross-Provider Tool Card (CTC-01 + TDP-02) Summary

**The RunCard tool-card header now renders the real per-provider @lobehub mark on the brand-pulse avatar, and ToolCallPanel surfaces the tool's description during the preparing window — both wired through the ONE Plan 03 shared helper, with honest Bot / quiet-copy fallbacks and zero shared-path fork.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-06-27T06:53:51Z
- **Completed:** 2026-06-27T07:00:31Z
- **Tasks:** 2 (Task 1 TDD: RED→GREEN; Task 2 auto)
- **Files modified:** 3 source/test (+ 1 dependency pair)

## Accomplishments
- **CTC-01** — `RunCard.tsx` imports the shared `providerLogo`; the tool-card header avatar (`:283-287`) resolves `HeaderMark = providerLogo(message.provider)` and renders `<HeaderMark size={18}/>` on the existing `gradient-primary` backing, or the `<Bot>` fallback when unmapped. The `isStreamingNow && animate-brandPulse` ring and the backing are byte-preserved (D-01).
- **TDP-02** — `ToolCallPanel.tsx` imports the shared `preparingDescription`; it now appends the parsed description after `Preparing {tool}…` during the preparing window (TARGET A) AND routes the `ToolArgsLivePanel` title through the helper instead of the empty `tc.args?.description` read (TARGET B). Null keeps the quiet copy — never fabricate (D-06). Closes the D-04 description-window slice.
- **CTC-02** — both consumers de-dup through the ONE `providerLogo.tsx`; the rest of the card (RunStatusStrip + unifiedStepCount + fileCount) was already provider-agnostic, so the card reads byte-identically across providers — only the logo + description differ.
- **Tests** — new `RunCard.logo.test.tsx` (6 tests) proves mapped→mark / unmapped→Bot / brandPulse-while-streaming-absent-on-terminal; the existing `ToolCallPanel.test.tsx` suite still passes (12/12); Plan 03 helper tests still pass (10/10). Production `vite build` succeeds — the antd-reachable @lobehub paths were correctly avoided.

## Task Commits

Each task was committed atomically:

1. **Test-infra prerequisite (blocking, Rule 3)** - `d1c912ce` (chore) — install the `@testing-library/dom` peer
2. **Task 1 RED: failing RunCard logo test** - `6e8d4180` (test)
3. **Task 1 GREEN: RunCard avatar logo swap (CTC-01)** - `36fa50af` (feat)
4. **Task 2: ToolCallPanel preparing-window description (TDP-02)** - `64725ed3` (feat)

_No REFACTOR commit needed — both implementations were minimal._

## Files Created/Modified
- `frontend/src/components/chat/RunCard.tsx` — import providerLogo; `HeaderMark` resolved + rendered on the avatar with the Bot fallback; `data-testid="run-card-avatar"` added (additive); brandPulse + gradient-primary preserved; the second Bot (collapsed row, `:370`) and the MessageItem assistant avatar untouched.
- `frontend/src/components/chat/ToolCallPanel.tsx` — import preparingDescription; TARGET A appends the description in the preparing branch; TARGET B routes the ToolArgsLivePanel title through the helper; Google-atomic "Waiting for model…" block preserved; `tc.args` never mutated.
- `frontend/src/__tests__/components/RunCard.logo.test.tsx` — NEW; 6 structural tests (mapped/unmapped/brandPulse).
- `frontend/package.json` + `frontend/package-lock.json` — `@testing-library/dom@10.4.1` devDependency (the missing RTL peer).

## Decisions Made
- Followed the plan exactly for both tasks. The provider→mark map, the partial-JSON parse, and the honest fallbacks all live in the Plan 03 helper — this plan only wired the two consumers.
- Chose to compute `HeaderMark` / `prepDesc` into a `const` at each site (rather than double-calling the helper) for clarity; behavior identical.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Installed the missing `@testing-library/dom` peer dependency**
- **Found during:** Task 1 (the RunCard logo test could not load)
- **Issue:** `@testing-library/react@16.3.2` declares `@testing-library/dom@^10.0.0` as a **peerDependency** (it was a direct dependency in RTL v14, moved to peer in v16). The peer was never added to `package.json` and was absent from `node_modules`, so **every component test in the repo failed to load at baseline** with `Cannot find module '@testing-library/dom'` (confirmed: `MessageItem.test.tsx` fails identically at HEAD). Task 1's acceptance gate (`vitest run RunCard.logo.test.tsx` exits 0) was therefore impossible without it.
- **Fix:** `npm install --save-dev --save-exact "@testing-library/dom@^10.0.0"` — the EXACT version range RTL itself requests in its own `peerDependencies`. Resolved to `10.4.1`.
- **Package-legitimacy note (executor exclusion guard):** the package-manager-install exclusion exists to stop hallucinated/slopsquatted names. This is neither — `@testing-library/dom` is named verbatim in the already-installed, already-trusted `@testing-library/react`'s `peerDependencies` map with the exact `^10.0.0` range; it is a first-party `@testing-library` org package and the documented required peer. The name + version came from the dependency graph, not from guessing. Lockfile diff confirmed only the legitimate RTL-dom tree was added (`@testing-library/dom`, `@types/aria-query`, `ansi-regex`, `lz-string`, `pretty-format`, `ansi-styles`, `react-is`) — **no `antd`, no `@lobehub` additions** (the critical-guard family was checked).
- **Files modified:** `frontend/package.json`, `frontend/package-lock.json`
- **Verification:** the previously-unloadable `RunCard.logo.test.tsx` and `ToolCallPanel.test.tsx` both load and pass; production `vite build` succeeds.
- **Committed in:** `d1c912ce` (separate `chore` commit — it repairs repo-wide pre-existing rot, not a single task's surface)

---

**Total deviations:** 1 auto-fixed (1 blocking, Rule 3).
**Impact on plan:** The dependency fix was a prerequisite to running ANY component test (the plan's Task 1 gate). It also un-rots the entire component test suite as a side benefit. No scope creep — no source behavior changed by the install.

## Issues Encountered
- **Repo-wide pre-existing `tsc -b` rot (OUT OF SCOPE — not fixed):** a full `npx tsc -b --noEmit` surfaces many pre-existing type errors in unrelated files (e.g. `MessageSkeleton.tsx` `Cannot find namespace 'JSX'`, `NavPanel.tsx` unused `Button`, and numerous `__tests__/**` fixtures with stale signatures). These fail at baseline, are unrelated to this plan, and per the scope-boundary rule were NOT touched. Confirmed **zero** tsc errors in the three files this plan modified (`RunCard.tsx`, `ToolCallPanel.tsx`, `RunCard.logo.test.tsx`) and in `providerLogo`.
- A stray `nul` file and a large dirty/untracked GSD-framework + supabase-snippets tree exist at the repo root — all pre-existing, none from this plan; left untouched.

## Known Stubs
None — both consumers are fully wired to live data (`message.provider` and `tc.argsCodeText` are real stream-resolved values). The description is honestly additive (null → quiet fallback), which is the intended D-06 behavior, not a stub.

## User Setup Required
None — no external service configuration required. (The added `@testing-library/dom` is a dev-only test peer; `npm install` in `frontend/` picks it up automatically.)

## Next Phase Readiness
- The unified card (CTC-02) is structurally complete. The **LIVE cross-provider proof** (per-provider description presence + uniform card across the native-7 + OpenRouter) is **Plan 05 (D-06)** — this plan's automated tests are structural; the per-provider WIN is measured live there.
- Plan 06 (CTC-03 StickyTimerBar delete) remains gated on the Plan 05 live scoreboard proving CTC-02 holds (D-07) — do not delete before that proof.
- Critical guard holding: `grep 'from "@lobehub/icons"'` returns NOTHING in both `RunCard.tsx` and `ToolCallPanel.tsx`; the production build is green.

## Self-Check: PASSED

- FOUND: `frontend/src/__tests__/components/RunCard.logo.test.tsx`
- FOUND: `.planning/phases/128-chat-tool-card-unification-chat-area-reclaim/128-04-SUMMARY.md`
- FOUND commits: `d1c912ce` (chore peer), `6e8d4180` (test RED), `36fa50af` (feat CTC-01), `64725ed3` (feat TDP-02)
- Critical guard: no direct `@lobehub/icons` import in RunCard.tsx or ToolCallPanel.tsx; production `vite build` green.

---
*Phase: 128-chat-tool-card-unification-chat-area-reclaim*
*Completed: 2026-06-27*
