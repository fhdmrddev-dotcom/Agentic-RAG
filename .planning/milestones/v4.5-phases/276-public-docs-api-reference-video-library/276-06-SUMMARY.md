---
phase: 276-public-docs-api-reference-video-library
plan: 06
subsystem: chat-avatar-brand-chrome
tags: [iris, avatar, animation, waapi, reduced-motion, chat, runcard, brand, light-theme, count-gate, ledger, docs-06]

requires:
  - phase: 276-01
    provides: "the static Iris mark at /brand/syrel-mark-iris.svg in NavPanel and AuthCardShell"
  - phase: 276-05
    provides: "the merged tree whose ledger triples 276-06 re-derives"
provides:
  - "irisState.ts: irisStateFor(message, capPaused) + hasPendingAsk, the one home of the avatar precedence"
  - "IrisAvatar.tsx: React.memo variant-D avatar (ref-owned data-motion, phase-locked playbackRate ramp, WAAPI coast-to-120deg settle, reduced-motion lit core)"
  - ".iris CSS block + irisOrbitTurn / irisWaveBump / irisGlowSoft; dead brandPulse duplicate removed; shimmer bar newly reduced-motion gated"
  - "MessageItem gutter avatar driven by irisStateFor; RunCard provider logo static; WorkingBadge glyph/pulse and the pre-token spinner/dots removed"
  - "ChatArea idle hero (64px), App boot splash (thinking, 56px), dark #0A0E18 chip on the nav-rail and sign-in marks"
affects: [276-07 (docs/brand README chip note), verify-work G-4]

tech-stack:
  added: []
  patterns:
    - "Pure state function + memoised presentational component, swapped into FIRING hot files with no new hook and no new store read"
    - "Attribute-driven CSS animation (data-motion / data-tone / data-lit) with the DOM attribute owned by a layout effect after mount, so React never overwrites it mid-settle"
    - "Seamless loop by construction: orbit period = 3 x wave period, negative evenly spaced per-petal delays, one playbackRate across ring/wave/glow"

key-files:
  created:
    - frontend/src/components/chat/irisState.ts
    - frontend/src/components/chat/IrisAvatar.tsx
    - frontend/src/components/chat/__tests__/irisState.test.ts
    - frontend/src/components/chat/__tests__/IrisAvatar.test.tsx
  modified:
    - frontend/src/index.css
    - frontend/src/components/chat/MessageItem.tsx
    - frontend/src/components/chat/RunCard.tsx
    - frontend/src/components/chat/WorkingBadge.tsx
    - frontend/src/__tests__/components/MessageItem.test.tsx
    - frontend/src/components/chat/RunCard.test.tsx
    - frontend/src/__tests__/components/RunCard.logo.test.tsx
    - frontend/src/__tests__/components/WorkingBadge.test.tsx
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/App.tsx
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/auth/AuthCardShell.tsx
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md

key-decisions:
  - "The cap-pause waiting state is read on the LAST assistant row only (isLastAssistant ? workflowLock?.capPaused : false); earlier rows of a paused thread stay idle"
  - "The empty-chat hero is idle (static) and the boot splash is thinking (moving): a moving hero would claim work that is not happening"
  - "Correction comments in RunCard/WorkingBadge name 'the brand-pulse class' rather than the literal class token, so the repo-wide `animate-brandPulse` grep lists only OrgBand and OperatorBand"

requirements-completed: [DOCS-06]

duration: "~25 min (this continuation; Task 1 + Task 2 RED by the previous executor on 2026-10-04)"
completed: 2026-10-05
---

# Phase 276 Plan 06: Animated Iris assistant avatar Summary

**The chat assistant avatar is now the Iris mark built as sketch 276-iris-avatar variant D "Orbit + wave". It is driven by one pure precedence function, runs a seamless phase-locked loop, coasts the ring to the next 120 degrees when it settles, and stays still under reduced motion. RunCard's provider logo no longer pulses, so a turn has one moving mark. The redundant spinners are gone, and the chrome marks sit on a dark chip so they stay legible in the light theme.**

## Performance

- **Duration:** Task 1 and Task 2 RED were done 2026-10-04 (14:06-14:15 +0400) by the previous executor. This continuation took about 25 minutes on 2026-10-05.
- **Tasks:** 3/3
- **Files:** 4 created, 15 modified

## Accomplishments

- **D-24 / D-27 avatar:** `irisStateFor` implements the README precedence (error > cancelled > waiting > idle-when-not-streaming > tool > thinking > streaming). It covers the cases where waiting beats tool, an undecided tool approval, and a cap-pause on the last row. `IrisAvatar` ports variant D. The ring turns 360 degrees in 4.8 s, which is 3 wave periods of 1.6 s. Per-petal delays are negative at `(i - 6) * 1.6s / 6`. Ring, wave and glow share one `playbackRate` (1 for thinking, 1.45 for tool, 0.8 for streaming), and a state change ramps the rate without restarting anything. On settle, the ring coasts forward to the next 120 degree stop.
- **One live avatar per turn:** RunCard lost its avatar pulse and its header spinner. The provider logo is static, and `Bot` stays as the unknown-provider fallback (2 `<Bot` mounts). The timer and the shimmer bar keep the header looking alive.
- **Redundant indicators removed:** the pre-first-token spinner and three dots, the ✦ glyph and pulse in WorkingBadge, and the RunCard header spinner. The activity words, timer, shimmer bar and streaming caret all stay.
- **CSS:** the dead Phase 068.5 `brandPulse` duplicate is removed. The one remaining definition (with `scale(0.82)`) still drives OrgBand and OperatorBand. The shimmer bar is now reduced-motion gated.
- **Chrome:** the empty-chat hero shows the static Iris (idle, 64px). The boot splash shows the moving Iris (thinking, 56px) inside `role="status" aria-label="Loading Syrel"`. The nav-rail and sign-in marks sit on the `#0A0E18` chip in both themes.

## Task Commits

1. **Task 1 RED:** `b6dfeb1fb` (test). Both suites failed on missing modules `../irisState` and `../IrisAvatar`.
2. **Task 1 GREEN:** `794fe8a35` (feat). Added irisState, IrisAvatar and the `.iris` CSS. Pins: irisState.test.ts 21, IrisAvatar.test.tsx 28.
3. **Task 2 RED:** `6c889c774` (test). Migrated the pulse/spinner pins: 13 tests failed against the unchanged components.
4. **Task 2 GREEN:** `be2b330fe` (feat). Mounted the avatar in MessageItem, made the RunCard logo static and removed the WorkingBadge glyph. MessageItem.test.tsx pin 24 → 26.
5. **Task 3:** `18891bd0f` (feat). Idle hero, thinking boot splash, dark chip on the rail and sign-in marks.

## Verification

- Task 2 targeted run (MessageItem, RunCard, RunCard.logo, WorkingBadge, `src/components/chat/__tests__`): **57 files / 715 tests passed**. Two files (ActiveRunsTray, ChatAreaBanner) hit a vitest "Failed to start forks worker / Timeout waiting for worker" error under box load. Re-run alone, they passed: **2 files / 14 tests**.
- Task 3 targeted run (`src/components/chat src/components/layout src/__tests__/components src/components/auth`): **114 files / 1291 tests passed**.
- Full count gate (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, from the worktree root), verdict line copied exactly:
  ```
  total 9802  ·  failed 0  ·  pinned total 9047
  count gate OK — 411/411 pinned files present, no per-file decrease, 0 failing.
  ```
  This plan's pins read pinned = actual on that run: RunCard.test.tsx 29, IrisAvatar.test.tsx 28, MessageItem.test.tsx 26, irisState.test.ts 21, RunCard.logo.test.tsx 6. The gate printed no red and no worker-start errors, so SEED-171 triage was not needed.
- **Typecheck:** `npx tsc -p tsconfig.app.json --noEmit` reports **70 errors**, the same count as base. The error set is identical before and after Task 3. None of the 70 points at any file this plan created or modified; all are pre-existing in ChatAreaMode.test, MessageInput.connectors.test, MessageSkeleton, NavPanel.test and others.
- **Acceptance greps (Task 2):**
  - `assistant-bot-icon` appears 1 time and `<IrisAvatar` 1 time in MessageItem.
  - MessageItem has 0 non-comment `animate-brandPulse|Sparkles|animate-dotBounce`.
  - `^function hasPendingAsk` appears 0 times.
  - MessageItem hook call sites: 6 → 6.
  - RunCard has 0 non-comment `animate-brandPulse|Loader2`, and `<Bot` appears 2 times.
  - WorkingBadge has 0 non-comment `✦|animate-brandPulse`.
  - The repo-wide `animate-brandPulse` grep lists only OrgBand.tsx and OperatorBand.tsx.
- **Acceptance greps (Task 3):**
  - ChatArea has `<IrisAvatar` 1 time and `Sparkles` 0 times.
  - App has `<IrisAvatar state="thinking"` 1 time and the old spin ring 0 times.
  - `bg-[#0A0E18]` appears once each in NavPanel and AuthCardShell, and `alt="Syrel"` is present in both.
  - Hook call sites are unchanged: App 9 → 9, ChatArea 36 → 36.
- **Gates:** `check-claude-md-size.cjs` passed (exit 0; CLAUDE.md is under the 120,000 warn band). `check-hot-file-ledger.cjs .planning/phases/276-…` passed (exit 0).
- **Ledger:** every triple was re-derived after its commit with the CLAUDE.md recipe:
  - MessageItem `79/37/1029`
  - RunCard `31/16/729`
  - WorkingBadge `3/2/50`
  - ChatArea `91/42/1171`
  - App `36/27/418`
  - NavPanel `26/14/420`
  - AuthCardShell `3/2/55`
  - irisState `1/1/44`
  - IrisAvatar `1/1/310`

  No 276-06 scan row still reads `0 / 0 / 0`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Correction comments contained the literal `animate-brandPulse` token**
- **Found during:** Task 2 acceptance check.
- **Issue:** the previous executor's correction comments in RunCard (`~~animate-brandPulse~~` in the header docblock) and WorkingBadge (the struck-through reuse line) spelled out the class name. The criterion "`grep -rn animate-brandPulse frontend/src --include=*.tsx | grep -v .test.` lists only OrgBand and OperatorBand" therefore failed. The plan also says correction comments must avoid the literal class tokens.
- **Fix:** both comments now name "the brand-pulse class/keyframe". The strike-through and the 276-06 reason are kept.
- **Files modified:** RunCard.tsx, WorkingBadge.tsx.
- **Commit:** `be2b330fe`.

**2. [Rule 3 - Blocking] Two targeted suites failed to start a worker**
- **Found during:** Task 2 targeted run.
- **Issue:** under parallel box load, ActiveRunsTray.test.tsx and ChatAreaBanner.test.tsx reported `Failed to start forks worker … Timeout waiting for worker to respond`. No assertion failed.
- **Fix:** re-ran the two files alone, and both passed (14 tests). Neither file was touched by this plan. This is a harness/load observation, not a defect.

Otherwise the plan was executed as written.

## Known Stubs

None.

## Threat Flags

None. The avatar renders only state already visible in the transcript. Gradient ids come from `useId`, sanitised to `[A-Za-z0-9_-]`. The SVG contains no user text and is `aria-hidden`.

## G-4 hand-off (verify-work drives these in Chrome; nothing is pushed)

**Start the stack:** run `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1`. The operator starts the backend. Then run `cd frontend && npm run dev` and open http://localhost:5173/app.

**How to see each avatar state live:**

| State | How to trigger it | What it looks like |
|---|---|---|
| idle (hero) | Open a new, empty chat | 64px static Iris on the dark chip above "How can I help you?" |
| thinking (boot splash) | Hard-reload the app (the splash shows while auth and the setup probe resolve) | 56px Iris turning and waving |
| thinking (gutter) | Send any prompt; watch the window before the first token | Gutter Iris moving at base rate; activity words, no spinner, no dots |
| tool | A prompt that calls a tool (scenario 1) | Faster motion (rate 1.45); RunCard provider logo static |
| streaming | The answer text arriving | Slower motion (rate 0.8) |
| idle (done) | Let the run complete | Ring coasts forward to the next 120 degrees and rests |
| waiting | A prompt that triggers `ask_user`, an undecided tool approval, or a cap-paused thread (last assistant row only) | Still amber Iris |
| error | A failed or timed-out run (for example, stop the backend mid-run) | Grey petals, red core |
| cancelled | Press Stop mid-run | Dim grey mark |

**Scenario 1, a tool-using turn.** Send "Search my documents for the latest invoice and add up the totals with code". There should be exactly ONE moving mark: the gutter Iris. The RunCard provider logo stays still, and the Iris coasts to rest when the run completes.

**Scenario 2, no visible loop stutter.** Watch one long turn for 15 s (three orbit turns). Then run this DevTools console check on the live avatar:
`[...document.querySelector('[data-testid=assistant-bot-icon] .iris').getAnimations({subtree:true})].map(a => [a.animationName, a.playbackRate, Math.round(a.currentTime % 1600)])`
Every animation should report the same `playbackRate`, and the orbit's `currentTime % 1600` should equal the wave's.

**Scenario 3, reduced motion.** In DevTools, open Rendering and emulate `prefers-reduced-motion: reduce`. A new turn should show a static mark with a lit core, and the shimmer bar should be still.

**Light-theme check.** Toggle the theme. The nav-rail mark, the sign-in card mark (sign out to see it) and the chat avatar all keep the dark `#0A0E18` chip and stay legible.

## Self-Check: PASSED

All four created source/test files and this SUMMARY exist, and all five commits (b6dfeb1fb, 794fe8a35, 6c889c774, be2b330fe, 18891bd0f) resolve on `worktree-agent-a48810aa9fc03b32a`. STATE.md and ROADMAP.md were not touched (orchestrator instruction).
