---
phase: 276-public-docs-api-reference-video-library
plan: 05
subsystem: docs-video-landing-gates
tags: [remotion, player, lazy-loading, landing, first-paint, coverage-gate, docs-02, count-gate, ledger]

requires:
  - phase: 276-02
    provides: "docs-content.cjs (extractCodeKeys, loadAllPages, validatePages), the docs Vite plugin serving /vo and /music"
  - phase: 276-03
    provides: "VideoSlot / videos.ts slot resolver, the docs bundle fence, the shared landing header"
  - phase: 276-04
    provides: "119 docs pages whose covers: the gate checks"
provides:
  - "RemotionSlot: click-to-load @remotion/player for home.overview (narrated SyrelEnergetic) and the six shipped clips"
  - "HeroPromo + PromoSlot: muted landing promo started only after load + a scroll + >= 50% visibility"
  - "scripts/check-landing-first-paint.cjs: imports-only walk of the built Vite manifest (exit 0/1/2, --self-test)"
  - "scripts/check-docs-coverage.cjs: DOCS-02 gate derived from code (exit 0/1/2), CI workflow, unregistered local hook"
  - "parseInventory / inventoryStatusKind moved into scripts/lib/docs-content.cjs (one home)"
  - "kit SfxOn gate; PromoBody renders no music when musicSrc is null; syrel-pulse.mp3 web copy; 8 posters"
affects: [276-06 (Iris avatar), verify-work G-4]

tech-stack:
  added: []
  patterns:
    - "Heavy optional code behind import() with a static poster as the Suspense fallback; the composition, kit and Player load in parallel after the click"
    - "Third-party media gated by React context at the composition boundary (SfxOn), so studio/render behaviour is unchanged"
    - "Two fences for one property: a static-import crawl of source and an imports-only walk of the built manifest"

key-files:
  created:
    - frontend/src/docs/video/RemotionSlot.tsx
    - frontend/src/landing/components/HeroPromo.tsx
    - frontend/src/landing/__tests__/HeroPromo.test.tsx
    - frontend/src/landing/__tests__/landingFirstPaintFence.test.ts
    - frontend/src/docs/__tests__/docsCoverageGate.test.ts
    - scripts/check-landing-first-paint.cjs
    - scripts/check-docs-coverage.cjs
    - .claude/hooks/docs-coverage-guard.js
    - .github/workflows/docs-coverage.yml
    - video/public/music/syrel-pulse.mp3
    - frontend/public/docs-assets/posters/*.jpg (8)
  modified:
    - frontend/src/docs/video/VideoSlot.tsx
    - frontend/src/docs/video/videos.ts
    - frontend/src/docs/__tests__/VideoSlot.test.tsx
    - frontend/src/docs/docs.css
    - frontend/src/landing/components/HeroSection.tsx
    - frontend/src/landing/landing.css
    - frontend/vite.config.ts
    - frontend/vitest.config.ts
    - video/src/energetic/kit.tsx
    - video/src/promo/SyrelPromo.tsx
    - video/README.md
    - scripts/lib/docs-content.cjs
    - scripts/lib/docs-content.d.cts
    - scripts/scaffold-docs-stubs.cjs
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md

key-decisions:
  - "home.overview is SyrelEnergetic (narrated, voice only, musicSrc null); SyrelOverview is not referenced (D-18)"
  - "RemotionSlot pre-resolves the composition and passes `component` to the Player (not `lazyComponent`), so a failed composition load reaches our error copy instead of the Player's internal boundary"
  - "The docs coverage hook is written but NOT registered: .claude/settings.json is operator configuration and every edit there is approval-gated (ledger invariant 4); CI is the only automatic run until the operator adds the entry"
  - "CLAUDE.md was not edited: its two firing rows touched by this phase (scripts/vitest-count-gate.cjs, .claude/settings.json) are listed below with measured triples for the operator"
  - "parseInventory moved into docs-content.cjs instead of a second copy in the gate; the scaffolder now calls it (output proven identical over 261 rows)"

requirements-completed: [DOCS-06, DOCS-02, DOCS-01]

duration: ~1h10m
completed: 2026-10-04
---

# Phase 276 Plan 05: Remotion videos, landing promo, coverage gate Summary

ffmpeg pre-flight (first line of `ffmpeg -version`): `ffmpeg version 8.1.1-full_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers`

**The docs home now plays the narrated Syrel overview, and six guides play their clips. Each is a Remotion Player that downloads nothing until the reader presses play and never contacts remotion.media. The landing hero gains a muted promo that loads only after the reader scrolls to it; two fences (source and build output) prove it stays out of first paint. A code-derived DOCS-02 gate fails on a planted tool or router, and the 20 new suites are pinned in the count gate.**

## Performance

- **Duration:** about 1 h 10 min (11:44 to 12:55, +04:00), including two full-gate runs of about 10 min each
- **Started:** 2026-10-04. The worktree was reset to base `67c285c89`, as expected.
- **Tasks:** 3 of 3, each RED then GREEN. Task 3 also has a close pass and one follow-up fix.
- **Commits:** 10 task commits (listed below), plus this SUMMARY

## Accomplishments

- **Docs videos (DOCS-06, D-11, D-18, UI-SPEC V2)**
  - `VideoSlot` renders the V1 poster for `kind: "remotion"`. Hover or focus may prefetch only `RemotionSlot`'s small chunk.
  - Clicking mounts `lazy(() => import("./RemotionSlot"))` inside Suspense, with a busy poster (pulsing ring, `aria-busy`) as the fallback.
  - `RemotionSlot` imports `@remotion/player`, the composition and kit's `SfxOn` in parallel, all through `import()`. It wraps the composition in `SfxOn.Provider value={false}` and mounts the Player with `controls`, `autoPlay`, `clickToPlay` and `acknowledgeRemotionLicense` at 1920×1080 / 30 fps, then moves focus to the player region.
  - A failed load returns the poster and shows the exact UI-SPEC alert plus a "Try loading the video again" button.
  - Each entry carries its transcript (the VO lines from `video/tools/make_vo.py`, verbatim).
- **Entries (`videos.ts`)**
  - `home.overview` is `SyrelEnergetic` with `musicSrc: null`: the voice plays, there is no music, and `SyrelOverview` is never referenced (D-18).
  - Six clips: `clip.chat`, `clip.library`, `clip.workflows`, `clip.connections`, `clip.experts` and `clip.admin`. Each is `FeatureClip` with `{ id }`.
  - The other IA clip keys have no entry, so they render nothing (D-13).
  - The literal durations (1199 and 457 frames) are pinned by a test to `ENERGETIC_DURATION` / `clipDuration(id)`. The Player always uses the module's live value.
- **video/ changes**
  - `kit.tsx` gains `SfxOn`. `Sfx` checks both contexts, then renders `SfxTrack`, so no hook order changes and studio/render defaults are unchanged.
  - `PromoBody` accepts `musicSrc: null` and then renders no `<Audio>`.
  - `public/music/syrel-pulse.mp3` is the committed web copy (128 kbps, 537,121 bytes). The WAV stays gitignored (`git check-ignore` still prints it).
  - `README.md` gains a "Web playback" section and the licence line (D-05).
- **Posters (8)**
  - Rendered with `remotion still` from the main checkout's `video/` straight into this worktree, at `--scale=0.6667`, JPEG quality 80. The main checkout was used read-only.
  - Clips use frame 240 (the product card, not a mid-transition title), the overview frame 165 (the Iris brand reveal), and the promo frame 985 (the final lockup).
  - Sizes: 22–54 KB each. All eight were inspected visually.
- **Landing promo (D-10, D-15, D-19, UI-SPEC V4, G4-2)**
  - `HeroSection` appends a static `PromoSlot` (figure "Syrel promo video", lazy poster). Its `IntersectionObserver` and scroll listener attach only after `window.load`.
  - `import("./HeroPromo")` happens only when the reader has scrolled since load AND the slot is ≥ 50% visible.
  - Under reduced motion it never starts by itself. It shows "Play the Syrel promo" instead.
  - `HeroPromo` plays with `initiallyMuted`, `loop`, `autoPlay` and no default controls, under `AudioOn` and `SfxOn` both false. `musicSrc` stays `null` until **Unmute**, then becomes `music/syrel-pulse.mp3`.
  - Pause/Play (with `aria-pressed`) and Unmute/Mute are always present. It pauses below 25% visibility or when the tab is hidden, and resumes only if the reader did not press Pause.
- **D-24 (hero part only):** the product mock's empty gradient rail tile and its inline-Sparkles assistant avatar are now the static `<img src="/brand/syrel-mark-iris.svg">`. MessageItem and RunCard are untouched; the animated avatar is 276-06.
- **First-paint fences**
  - `landingFirstPaintFence.test.ts`: a static-only crawl from `src/landing/main.tsx` that also follows `@video/`. It has a positive control proving that the crawl, started at HeroPromo, does see `@remotion/player`.
  - `scripts/check-landing-first-paint.cjs`: walks the built manifest from `index.html` through `imports` only, never `dynamicImports`, with exit codes 0/1/2 and `--self-test`. `vite.config.ts` gains `build.manifest: true`.
- **DOCS-02 gate**
  - `scripts/check-docs-coverage.cjs` takes code keys from `extractCodeKeys` (per-source floors throw, which maps to exit 2), checks the inventory (≥ 250) and pages (≥ 100) against floors, and reads pages through `loadAllPages` + `validatePages`.
  - Findings: `[uncovered]`, `[stale-cover]`, `[release-mismatch]`, `[stale-exclusion]`.
  - The only exclusion is I20, with its reason recorded.
  - `parseInventory` moved into `docs-content.cjs`, and the scaffolder now uses it.
  - CI backstop: `.github/workflows/docs-coverage.yml`. The local hook is written but not registered (see Deviations).

## Task Commits

1. **Task 1 — Remotion Player slots**
   - RED `9b8f57102`: 6 of 11 failed. The new Remotion arms could not find the poster button / "Read the transcript"; `kit.SfxOn` was `undefined`; `Cannot read properties of undefined (reading 'kind')` for `VIDEOS["home.overview"]`.
   - GREEN `8a8cf3e58`: 11/11.
2. **Task 2 — landing promo + first-paint fences**
   - RED `0b2dba566`: HeroPromo 3/3 failed (no figure "Syrel promo video"). The fence's positive control failed (`import("./HeroPromo")` absent). `check-landing-first-paint.cjs` did not exist (`MODULE_NOT_FOUND`).
   - GREEN `a0b935d21`: `src/landing` 9 files / 36 tests.
3. **Task 3 — coverage gate, hook, CI, close pass**
   - RED `cbb1871e6`: 7 of 8 arms failed with `Cannot find module …scripts\check-docs-coverage.cjs`. The 8th ("never mutates the real docs tree") passes vacuously while the script is absent.
   - GREEN `05d035fb2`: 8/8.
   - `856eca986` (fix): hook registration reverted; `.claude/settings.json` is byte-identical to base.
   - `b6857bc0e` (docs): ledger re-derivation.
   - `cf8a7910c` (fix): widened async waits after the wave gate went red.
   - `8d89a67a4` (chore): BASELINE pins.

## Verification (measured)

- **Targeted:** `npx vitest run src/docs src/landing --maxWorkers=2`: **25 files, 146 tests passed**.
- **Typecheck:** `npx tsc -p tsconfig.app.json --noEmit` gives **70 errors (base 70)**, none under `src/docs`, `src/landing` or `video/src`. `tsconfig.node.json` (which covers `vite.config.ts`) exits 0.
- **Build:** `npx vite build` exits 0.
  - `node scripts/check-landing-first-paint.cjs` prints `landing first paint OK — 14 first-paint files from index.html, none carries @remotion / acknowledgeRemotionLicense / remotion.media / scalar / minisearch`.
  - Non-vacuity on the real build: `acknowledgeRemotionLicense` does appear, in `esm-*.js`, `HeroPromo-*.js` and `RemotionSlot-*.js`, which are dynamic chunks only.
- **First-paint self-test:** `--self-test` passes 4/4 arms: clean → 0, planted reachable chunk → 1, missing manifest → 2, missing landing entry → 2. Against a missing dist it prints `[HARNESS ERROR] missing …manifest.json`, exit 2.
- **Coverage gate on the merged tree:** `node scripts/check-docs-coverage.cjs` prints `110 code keys · 261 inventory IDs · 119 pages (31 written / 88 stubs)` / `docs coverage OK …`, exit 0. No residual findings, so no page needed a covers edit.
- **Planted drive (SC#2):** a manual run against temp copies printed:
  - `--- tool: exit 1` / `[uncovered] tool:planted_tool`
  - `--- router: exit 1` / `[uncovered] router:planted`
  - The test also drives: emptied registry → 2, no pages → 2, `[stale-cover] use/chat: tool:removed_tool` → 1, `[release-mismatch] use/library/find: …` → 1, and real tree untouched.
- **Hook driven red and green:**
  - With `tool:removed_tool` planted in `docs/public/use/chat.md`, the hook emitted `hookSpecificOutput.additionalContext` containing `[stale-cover] use/chat: tool:removed_tool`, exit 0.
  - Restored with Edit: md5 `41ce6d50543b62fb3f65715d82c7e0b7` before and after, and `git status docs/` is clean.
  - Non-trigger path: silent, exit 0.
- **Inventory move proven identical:** the old scaffolder `parseInventory` and the lib version both give 261 rows (`identical: true`). `statusKind` is identical over 42 distinct status cells. `scaffold-docs-stubs.cjs --dry-run` prints `88 stub slugs · 88 already exist · 0 to write`.
- **Other gates:**
  - `node scripts/build-public-openapi.cjs --check`: OK.
  - `bash scripts/check-deploy-drift.sh`: PASS (1 WARN: docker denied locally, structural fallback).
  - `node scripts/check-hot-file-ledger.cjs 276`: `scan list: 448 rows · subject: 154 files · watched: 39` / `ledger gate OK`.
  - `node scripts/check-claude-md-size.cjs`: `CLAUDE.md 119503 chars … [OK]` / `claude-md size gate OK` (unchanged: CLAUDE.md was not edited).
- **D-22 (inherited, recorded, not fixed):** `node scripts/check-landing-drift.cjs` still reports exactly one finding: `BUILTIN_TOOL_COUNT … Source Code: 30 / facts.ts: 29`. `facts.ts` and the guard were not touched.
- **Task 1 acceptance greps:**
  - `^import .*(@remotion/player|@video/)` gives 0 in all four `src/docs/video/*` files.
  - `SyrelEnergetic` in videos.ts: 3. `SyrelOverview`: 0. `SfxOn` in kit.tsx: 3. `SfxOn.Provider` in RemotionSlot.tsx: 1.
  - The mp3 is 537,121 bytes (≤ 1,572,864). 8 posters. `up to 3 people` in README: 2.
- **Task 2 acceptance greps:** `^import .*(@remotion|@video)` in HeroSection.tsx: 0. `import("./HeroPromo")`: 1.
- **Task 3 acceptance greps:**
  - `docs-content.cjs` in the gate: 4, with no frontmatter regex of its own.
  - `"docsCoverageGate.test.ts"` and `"landingFirstPaintFence.test.ts"` in the count gate: 1 each.
  - `docs-coverage-guard.js` in `.claude/settings.json`: **0**, deliberately (see Deviations).

### Pin completeness (derived, output verbatim)

```
docs suites 16 + landing suites added in 276 4 = 20 basenames
ApiReference.test.tsx, Article.test.tsx, ChangelogPage.test.tsx, DocsApp.test.tsx, HeroPromo.test.tsx, Navigation.test.tsx, SearchBox.test.tsx, Stub.test.tsx, VideoSlot.test.tsx, changelog.test.ts, devRouting.test.ts, docsBundleFence.test.ts, docsContent.test.ts, docsCoverageGate.test.ts, docsVercelRouting.test.ts, landingBrand.test.ts, landingFirstPaintFence.test.ts, publicOpenapi.test.ts, router.test.ts, search.test.ts
pin completeness OK — all 20 are BASELINE keys
```

The check globs `frontend/src/docs/__tests__/*.test.ts(x)` plus `git diff --name-only --diff-filter=A 2f5677738^..HEAD -- frontend/src/landing/__tests__`, and asserts each basename is a key inside the `BASELINE = {…}` block. Before the pins were added it exited 1 and named all 20. The 20 pins total 122 cases. `LandingPage.test.tsx` stayed at 7, so its pin was not changed.

### Wave-3 full vitest gate (`GSD_VITEST_MAX_WORKERS=2`, worktree root, verdict verbatim)

**Run 1** (pre-pin, at `b6857bc0e`) went **red**:

```
  total                                      8874    9751    +877
  total 9751  ·  failed 2  ·  pinned total 8874
  FAIL  [failing-tests] 2 test(s) failed — the gate requires 0.
```

The failing filenames were taken from the gate's own persisted JSON report (`vitest-count-gate-58364-…json`) **before** any re-run:

- `src/pages/WorkflowBuilderPage.session.test.tsx`: "pane click — the pending value is in the definition and the DISMISSAL ITSELF issues no PATCH (WR-11)", `Error: STACK_TRACE_ERROR`. This is one of SEED-171's named flaky suites. It is **provably unmodified**: `git diff --numstat 67c285c89 HEAD` on it and on `WorkflowBuilderPage.tsx` is empty. Recorded as an observation, not a proof of innocence.
- `src/docs/__tests__/VideoSlot.test.tsx`: "home.overview … licensed, controlled Player", `Unable to find an element by: [data-testid="remotion-player"]`. **This one was this plan's defect** (a 1 s wait against a ~4 s import under load). Fixed in `cf8a7910c` (Deviation 7), not re-run away.

**Run 2** (post-fix, post-pin, at `8d89a67a4`), cap left at 2, verdict verbatim:

```
  total                                      8996    9751    +755
  total 9751  ·  failed 0  ·  pinned total 8996
count gate OK — 409/409 pinned files present, no per-file decrease, 0 failing.
```

Against 276-03's wave-2 reading (`9731 · 8874 · 389/389`), the total is `+20` and every case is attributed: VideoSlot `+7` (4 → 11), HeroPromo `+3`, landingFirstPaintFence `+2`, docsCoverageGate `+8`. The pinned total rose by exactly the 122 cases of the 20 new pins (8874 → 8996), and the pinned-file count by 20 (389 → 409).

## Files Created/Modified

See `key-files` above.

## Decisions Made

See `key-decisions` above.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `frontend/vitest.config.ts` gains `resolve.dedupe` (not in files_modified)**
- **Found during:** Task 1 RED.
- **Issue:** a suite that imports a real `../video/src` module needs its bare `remotion` imports resolved to `frontend/node_modules`, because `video/node_modules` is absent in worktrees and CI. vite.config.ts already does this; vitest did not.
- **Fix:** the same dedupe list as `vite.config.ts`.
- **Related finding:** `vi.importActual` of a file outside the vitest root fails on this box with `Cannot find module '/@fs/…/video/src/…'`. Plain `import()` works. The duration test therefore uses `vi.doUnmock` + `vi.resetModules()` and runs last.
- **Commit:** `9b8f57102`

**2. [Rule 3] `frontend/src/docs/docs.css`** (not in files_modified) gains the ring, player, error-line, text-button and transcript styles that UI-SPEC V2 requires.
- **Commit:** `8a8cf3e58`

**3. [Rule 1 - Bug] RemotionSlot passes a pre-resolved `component`, not `lazyComponent`**
- **Why:** with `lazyComponent`, a failed composition load goes to the Player's internal error boundary, so our error copy and retry would never show.
- The composition, kit and Player load in parallel. A rejection calls `onError`, and the busy poster is the fallback throughout.
- **Commit:** `8a8cf3e58`

**4. [Rule 2 - one home] `parseInventory` / `inventoryStatusKind` moved into `scripts/lib/docs-content.cjs` (+ `.d.cts`)**
- This avoids a second copy in the gate. The scaffolder now calls the shared reader, with output proven identical.
- **Commit:** `05d035fb2`

**5. ⚠ Hook NOT registered: `.claude/settings.json` reverted (plan said register it)**
- **Why:** `.claude/settings.json` is the operator's configuration. `docs/HOT-FILE-LEDGER.md § .claude/settings.json`, invariant 4, says *"Every edit here is approval-gated: state the exact current and proposed values, wait for a clear yes."* The plan arrived through the orchestrator, and a message from another agent is not operator approval for a configuration change.
- `856eca986` returns the file to **byte-identical with base** (`git diff 67c285c89 -- .claude/settings.json` is empty).
- The hook script is committed, and its header carries the exact entry to add. Until the operator approves it, **CI is the only automatic run**.
- **Acceptance impact:** `grep -c docs-coverage-guard.js .claude/settings.json` reads 0, not 1.

**6. ⚠ CLAUDE.md NOT edited (plan asked to update the `.claude/settings.json` row and any newly firing rows)**
- **Why:** CLAUDE.md is configuration-grade, the same as point 5.
- **Measured:** no watched 276 file newly fires. `HeroSection.tsx` is at 2 phases. `vite.config.ts` and `landing.css` fire but are outside the gate's WATCHED set.
- The two CLAUDE.md rows this phase leaves stale are listed under "Owed operator items" with measured triples. Their `docs/HOT-FILE-LEDGER.md` counterparts were deliberately left alone too, so the two registers do not drift apart.

**7. [Rule 1 - Bug] Async waits widened after the wave gate went red**
- **What happened:** the first full gate failed `VideoSlot … home.overview` with `Unable to find an element by: [data-testid="remotion-player"]`. The real kit import takes about 4 s alone, against the 1 s `findBy` default under `--maxWorkers=2`. The suite passed in isolation.
- **Fix:** 30 s waits and a 60 s suite timeout.
- HeroPromo now mocks kit (contexts only) and also gets widened waits.
- The docsCoverageGate suite gets a 60 s timeout (7 node spawns plus tree copies).
- **Commit:** `cf8a7910c`

**8. Extra files:** `scripts/lib/docs-content.d.cts`, `scripts/scaffold-docs-stubs.cjs` (point 4), `frontend/vitest.config.ts` (point 1), `frontend/src/docs/docs.css` (point 2).

**9. Pin set is 20, not the plan's 19:** the derived glob also includes `DocsApp.test.tsx` (276-03's smoke suite), which the plan's hand list missed. `docsVercelRouting.test.ts` is the renamed `vercelRouting`, so it is not an extra.

## Owed operator items (G-4 runs at verify-work)

**Start the stack for G-4:**
1. `powershell -ExecutionPolicy Bypass -File scripts/start-local-infra.ps1`
2. The operator starts the backend.
3. `cd frontend && npm run dev`
4. Open http://localhost:5173/, then /docs, /docs/use/chat, /docs/changelog and /docs/api/reference.

**G4-1:** on /docs at 390 px, no `@remotion/player` request appears until the poster is tapped.

**G4-2:** on landing load, the network panel shows no Remotion, Scalar or docs chunk. The `HeroPromo` chunk appears only after a scroll brings the promo ≥ 50% into view. Under reduced motion it never autoplays. No `/music/syrel-pulse.mp3` request appears until Unmute.

**Approval-gated config:**
- Register the docs coverage hook. The exact `hooks.PostToolUse` entry is in `.claude/hooks/docs-coverage-guard.js`'s header.
- Update the two stale CLAUDE.md rows (≤ 200 chars each), with the matching `docs/HOT-FILE-LEDGER.md` rows in the same commit:
  - `scripts/vitest-count-gate.cjs`: measured **`279 / 63 / 6361`**; the row reads `269 / 60 / 6281`. Proposed cell: "⚠ STALE (`269/60/6281`). **276-05** pinned 20 docs + landing suites (122 cases) in BASELINE; TARGETS already ran them (276-02)".
  - `.claude/settings.json`: measured **`13 / 6 / 204`** (CLAUDE.md reads `9 / 4 / 202`; its 276 touches net to zero). Proposed cell: "⚠ STALE (`9/4/202`). 276-05 added then reverted a hook entry (approval-gated); docs-coverage-guard awaits registration".
  - CLAUDE.md is at 119,503 chars, so 497 chars of headroom under the warn band: keep both cells the same length or shorter.

**Unchanged owed items:**
- Vercel: turn ON "Include source files outside of the Root Directory" (the docs and landing promo now import `../video/src`).
- Coolify: `ENVIRONMENT=production`.
- After deploy: `curl /docs` → 401.
- YouTube uploads: none yet.
- Documentary episodes 2-5 per `276-VIDEO-QUEUE.md`. These are never a blocker.
- The D-22 drift guard is red at base.

No push to master or production.

## Known Stubs

- Every YouTube entry in `videos.ts` keeps `youtubeId: null`. Nothing is uploaded yet, so those slots render nothing by contract (V0, D-12). `explainer.automate-workflows` stays null by D-25.
- No other stubs: the 7 Remotion entries are wired to real compositions.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: info-disclosure | frontend/vite.config.ts | `build.manifest: true` emits `dist/.vite/manifest.json`. Vercel and nginx will serve it, exposing the source-path → chunk map (no secrets; filenames only). If unwanted, delete it after the check in the build step, or add an nginx/Vercel deny for `/.vite/`. |
| threat_flag: third-party (pre-existing) | video/src/theme.ts | The compositions call `@remotion/google-fonts` at import time. In the browser this fetches Manrope/Inter from fonts.gstatic.com, the same origins the docs and landing HTML already preconnect to. No new third-party domain. remotion.media SFX are suppressed (T-276-20). |

T-276-20, T-276-21 and T-276-22 are mitigated as planned, and T-276-24 holds (the only exclusion is I20, with its reason). T-276-23 (accepted) did not come into play, because the hook is not registered.

## TDD Gate Compliance

- Task 1: `test` `9b8f57102` → `feat` `8a8cf3e58`
- Task 2: `test` `0b2dba566` → `feat` `a0b935d21`
- Task 3: `test` `cbb1871e6` → `feat` `05d035fb2`

Every RED run was seen failing before its implementation.

## Self-Check: PASSED

- All 10 key created files are present (checked with `ls`): RemotionSlot.tsx, HeroPromo.tsx, HeroPromo.test.tsx, landingFirstPaintFence.test.ts, docsCoverageGate.test.ts, check-landing-first-paint.cjs, check-docs-coverage.cjs, docs-coverage-guard.js, docs-coverage.yml, syrel-pulse.mp3. The 8 posters were counted by `ls … | wc -l`.
- All 10 task commits are in `git log 67c285c89..HEAD`: `9b8f57102`, `8a8cf3e58`, `0b2dba566`, `a0b935d21`, `cbb1871e6`, `05d035fb2`, `856eca986`, `b6857bc0e`, `cf8a7910c`, `8d89a67a4`.
- `git diff --name-only 67c285c89..HEAD -- .planning/STATE.md .planning/ROADMAP.md CLAUDE.md .claude/settings.json` is empty.
