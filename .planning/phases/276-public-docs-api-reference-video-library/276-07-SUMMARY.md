---
phase: 276-public-docs-api-reference-video-library
plan: 07
subsystem: brand-logo-pass-and-build-story
tags: [brand, syrel, favicon, webmanifest, og-image, email, oauth-dcr, docs, changelog, build-story, count-gate, ledger]

requires:
  - phase: 276-01
    provides: "the Iris SVGs (syrel-mark-iris.svg, syrel-lockup-iris.svg), favicon.svg, landingBrand fence"
  - phase: 276-03
    provides: "docs router/types/DocsApp, Changelog + Home pages, VideoSlot/videos.ts with changelog.chapter-1..5 (youtubeId null)"
  - phase: 276-05
    provides: "the Phase 276 BASELINE block, build.manifest + check-landing-first-paint.cjs, docs coverage gate"
provides:
  - "App-wide Syrel strings ('Added to Syrel'), widened brand fence over src/components + src/pages (>= 300 files, planted case)"
  - "MCP OAuth DCR client_name 'Syrel' for NEW registrations only (stored custom_client_id skips registration)"
  - "SetupWizard header Iris mark on the dark #0A0E18 chip; Experts category chip decodes &amp; (display only)"
  - "BUG-261004-02 (Settings unreachable for ordinary users) recorded open"
  - "scripts/generate-brand-rasters.cjs + 7 PNGs; site.webmanifest; PNG icon / manifest / theme-color / og / twitter head tags"
  - "frontend/plugins/brandMeta.ts: og:image / twitter:image absolutised from VITE_APP_URL's origin at build"
  - "Branded Resend invite (escaped hosted lockup PNG, 'on Syrel')"
  - "/docs/changelog/build-story — 'Syrel: The Build Story' (D-26), chapter summaries in the parser, story:build-story search doc"
affects: [276 verify-work G-4, deploy (VITE_APP_URL), operator Supabase email templates, YouTube uploads]

tech-stack:
  added: []
  patterns:
    - "Rasterise SVG brand assets with the already-downloaded Playwright Chromium (no install), spec exported from the script and read by the fence (one home)"
    - "Source html keeps brand tags same-origin; a pure transformIndexHtml helper absolutises only og:image/twitter:image from an http(s) origin"
    - "Honesty fence on rendered text: no 'documentar' while every chapter slot is empty"

key-files:
  created:
    - scripts/generate-brand-rasters.cjs
    - frontend/plugins/brandMeta.ts
    - frontend/public/site.webmanifest
    - frontend/public/favicon-16.png
    - frontend/public/favicon-32.png
    - frontend/public/apple-touch-icon.png
    - frontend/public/icon-192.png
    - frontend/public/icon-512.png
    - frontend/public/brand/og-image.png
    - frontend/public/brand/syrel-lockup-email.png
    - frontend/src/landing/__tests__/brandAssets.test.ts
    - frontend/src/docs/pages/BuildStory.tsx
    - frontend/src/docs/__tests__/BuildStory.test.tsx
    - backend/tests/unit/test_276_oauth_client_name.py
    - backend/tests/unit/test_276_invite_email_brand.py
    - .planning/reported-bugs/BUG-261004-02-settings-unreachable-for-ordinary-users.md
  modified:
    - frontend/index.html
    - frontend/app.html
    - frontend/docs.html
    - frontend/vite.config.ts
    - backend/app/services/email_provider.py
    - backend/app/api/connectors.py
    - backend/app/models/document_search.py
    - frontend/src/components/metadata/DocumentFileFacts.tsx
    - frontend/src/pages/findState.ts
    - frontend/src/components/library/find/StructurePopovers.tsx
    - frontend/src/pages/SetupWizard.tsx
    - frontend/src/components/experts/catalog/{expertCatalog.ts,ExpertCard.tsx,ExpertCatalogPage.tsx,ExpertDetailModal.tsx}
    - frontend/src/landing/__tests__/landingBrand.test.ts
    - scripts/lib/docs-content.cjs
    - scripts/lib/docs-content.d.cts
    - docs/public/README.md
    - frontend/src/docs/{types.ts,router.ts,DocsApp.tsx,docs.css}
    - frontend/src/docs/pages/{Home.tsx,Changelog.tsx}
    - docs/brand/README.md
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
  deleted:
    - frontend/public/icons.svg
    - frontend/src/assets/hero.png
    - frontend/src/assets/react.svg
    - frontend/src/assets/vite.svg

key-decisions:
  - "Rasters come from Playwright's bundled Chromium via createRequire from frontend/package.json; the RASTERS spec is exported and the fence reads it"
  - "og:image stays relative in source html; brandMeta absolutises from VITE_APP_URL's origin only when it is http(s), so no new env var and no deploy-artifact change"
  - "The invite logo URL is html-escaped like every other interpolated value, even though FRONTEND_URL is operator config"
  - "Build Story episode wording lives only inside the slotExists() block; the rendered page is fenced against 'documentar' and 'watch' while all slots are empty"
  - "The Build Story search doc is derived from the chapters the releases carry, so buildSearchDocs keeps its signature"

requirements-completed: [DOCS-06, DOCS-01, DOCS-02]

duration: ~2 sessions (stopped and resumed in the same worktree)
completed: 2026-10-05
---

# Phase 276 Plan 07: App-wide Logo Pass and "Syrel: The Build Story" Summary

**Syrel's name and Iris mark now appear across the app outside chat: in "Added to Syrel" labels, the SetupWizard header, vendor OAuth consent screens (new registrations only), PNG favicons, home-screen icons, a web manifest, link-preview images and the invite email. All of these files are generated by a committed script and served from our own origin. The docs also have a new page, `/docs/changelog/build-story`, that lists the five chapters with their summaries and releases. It shows no video until an episode's YouTube id exists.**

## Performance

- **Completed:** 2026-10-05
- **Tasks:** 3/3 (one executor was stopped partway through Task 2; a second one finished the plan in the same worktree, `worktree-agent-a46e333ce043d08d9`)
- **Base:** `9b7dd251d`

## Task Commits

| Task | Gate | Commit | What |
|---|---|---|---|
| 1 | RED | `d2bdbc724` | failing app-wide brand fence, decodeEntities, DCR client_name tests |
| 1 | GREEN | `8aefee1ae` | "Added to Syrel" ×3 (6 tests updated in place), `client_name="Syrel"`, SetupWizard mark, Experts chip decode, BUG-261004-02, ledger + CLAUDE.md rows, pins expertCatalog 53 / landingBrand 4 |
| 2 | RED | `ab5cda298` | failing brandAssets.test.ts (13 cases) + test_276_invite_email_brand.py (3 cases) |
| 2 | GREEN | `61f8a975f` | raster script + 7 PNGs, manifest, head tags, brandMeta plugin, branded invite, Vite leftovers deleted, email_provider ledger row |
| 3 | RED | `a1f2cb5ad` | failing BuildStory.test.tsx + router/search/changelog/DocsApp/ChangelogPage arms (7 failing cases, 1 suite failing to import) |
| 3 | GREEN | `9f5a4bba4` | parser summary, route, page, links, search doc, docs/public/README, brand README, pins, ledger |

TDD gate sequence holds for all three tasks: a `test(...)` commit precedes each `feat(...)` commit.

## Raster set (Task 2)

`node scripts/generate-brand-rasters.cjs --check` → `brand rasters check OK — 7 PNGs present with spec dimensions.` I opened each PNG and checked it by eye. Every one shows the six-petal Iris on #06090F, and the two lockups also show the "syrel" wordmark.

| File | Dimensions | Size |
|---|---|---|
| `frontend/public/favicon-16.png` | 16×16 | 613 B |
| `frontend/public/favicon-32.png` | 32×32 | 1,388 B |
| `frontend/public/apple-touch-icon.png` | 180×180 | 8,312 B |
| `frontend/public/icon-192.png` | 192×192 | 7,875 B |
| `frontend/public/icon-512.png` | 512×512 | 29,463 B |
| `frontend/public/brand/og-image.png` | 1200×630 | 130,707 B (limit 300 KB) |
| `frontend/public/brand/syrel-lockup-email.png` | 480×240 | 14,394 B |

Every file is under 150 KB, and the OG image is under 300 KB.

## Vite leftovers: proof they were unreferenced (Task 2)

```
$ git grep -n -e "icons.svg" -e "hero.png" -e "react.svg" -e "vite.svg" -- frontend ':!frontend/node_modules' ':!frontend/package-lock.json'
frontend/src/landing/__tests__/brandAssets.test.ts:200:  it("public/icons.svg and src/assets/{hero.png,react.svg,vite.svg} do not exist", () => {
frontend/src/landing/__tests__/brandAssets.test.ts:201:    for (const f of ["public/icons.svg", "src/assets/hero.png", "src/assets/react.svg", "src/assets/vite.svg"]) {
```

The only hits are in the fence that asserts the files are deleted. A repo-wide grep for `assets/hero.png`, `assets/react.svg`, `assets/vite.svg`, `public/icons.svg` and `"/icons.svg` (excluding `.planning` and `graphify-out`) printed nothing. The four files were then removed with `git rm`, and `frontend/src/assets/` no longer exists.

## Build and head-tag verification (Task 2)

- `npx vite build` → exit 0. With `VITE_APP_URL` unset, `dist/index.html` keeps `og:image` at `/brand/og-image.png`. With `VITE_APP_URL=https://app.example.com/x`, `dist/index.html` and `dist/docs.html` carry `https://app.example.com/brand/og-image.png` for both `og:image` and `twitter:image`. Only the origin is used, and no double slash appears.
- `node scripts/check-landing-first-paint.cjs` → `landing first paint OK — 14 first-paint files from index.html, none carries @remotion / acknowledgeRemotionLicense / remotion.media / scalar / minisearch`.
- `git grep -nE 'og:image|twitter:image|apple-touch-icon|site.webmanifest' -- frontend/index.html frontend/app.html frontend/docs.html | grep -c "https\?://"` → 0 (also fenced by brandAssets.test.ts).
- `bash scripts/check-deploy-drift.sh` → `RESULT: PASS — the one-box deploy artifacts are in sync.` No new env var was added: `VITE_APP_URL` already existed.
- Invite email: `grep -c "syrel-lockup-email.png" backend/app/services/email_provider.py` → 1; `grep -c "html.escape"` → 3; `test_276_invite_email_brand.py` → 3 passed.

## Build Story (Task 3)

- `parseChapters` now returns `{ n, title, range, summary }`. `summary` is the README arc table's third column, and a row without one throws an error naming the README. `docs-content.d.cts`, `types.ts` and `docs/public/README.md` "## Changelog" were updated in the same commit, following the same-commit sync rule.
- `resolveRoute("/docs/changelog/build-story")` → `{ kind: "build-story", sectionId: "changelog" }`. That branch sits above `rest.startsWith("changelog/")`. `v4.4` still resolves to its version page, and `nope` is still not-found.
- `BuildStory.tsx` shows a hero (eyebrow "Changelog", h1 "Syrel: The Build Story", sub "The five chapters of how Syrel was built, release by release."). Below it are five `<section aria-label="Chapter N: …">` blocks in ascending order. Each one has its summary, its range, its releases oldest first (v4.5 badged "Not yet released"), a "See these releases in the changelog" link to `?chapter=N`, and `<VideoSlot slot={`changelog.chapter-${n}`}>` inside the `slotExists()` block. `grep -ci "watch" BuildStory.tsx` → 0.
- Links: Home "Read Syrel: The Build Story" sits under the ChapterStrip. Changelog hero has "Syrel: The Build Story, chapter by chapter".
- Search: one doc `story:build-story` (url `/docs/changelog/build-story`), built from the chapters the releases carry.
- D-25: nothing embeds `explainer.automate-workflows`, which still has `youtubeId: null`. The only docs mention of the gauntlet's stage count is `automate/workflows/publish.md:55`, which already says ten.

### Pin completeness (derived)

```
checked 22 suites; missing BASELINE keys: none
```
The check globbed `frontend/src/docs/__tests__/*.test.ts(x)` and the five landing suites Phase 276 added. A second walk over every suite under `frontend/src/landing` printed `pinned` for all 10.

## Gates

- **Full vitest gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, first run, no re-run):
  ```
    total 9782  ·  failed 0  ·  pinned total 9027
  count gate OK — 411/411 pinned files present, no per-file decrease, 0 failing.
  ```
  This plan's rows from the same run: expertCatalog 53, brandAssets 13, changelog 8, ChangelogPage 8, router 8, BuildStory 7, search 6, DocsApp 5, landingBrand 4. Each one equals its pin.
- **Backend baseline:** **RED on the single full run, for an environmental reason I could trace; NOT attributable to this plan.**
  `node scripts/check-backend-unit-baseline.cjs` (run once, concurrently with the vitest gate) printed:
  ```
  80 failed, 6637 passed, 47 skipped, 2 xfailed, 2 xpassed, 46 warnings, 92 errors in 1315.93s (0:21:55)
  [GATE FAILED] Failed test count (80) exceeds baseline ceiling (71).
  [GATE FAILED] Collection or execution errors detected: 92. Must be 0.
  ```
  The log shows local Postgres was unreachable for part of the run: `Settings migration failed … [WinError 1225] The remote computer refused the network connection` ×91 and `the database system is starting up` ×1 (a container restart mid-run, which this plan did not cause). I captured the failing set BEFORE any re-run: 37 test files (80 FAILED + 92 ERROR ids). None of them references a backend file this plan changed (`grep -lE "email_provider|document_search|api\.connectors|register_client"` over the 37 printed nothing), and the plan's own backend changes are one literal in `connectors.py`, a comment in `document_search.py` and the invite body in `email_provider.py`. With the DB back up (54322/54321/6379 accepting TCP), re-running ONLY those 37 files gave **`71 failed, 451 passed` with 0 errors**. Every other file had already passed in the full run, so the suite projects to **71 failed, 0 errors, which is exactly the ceiling**. The plan's two backend tests: `5 passed`. ⚠ This is a projection from the full run plus a targeted re-run, not a second green full run. Re-run `node scripts/check-backend-unit-baseline.cjs` on a quiet box with Supabase up before closing the phase.
- **tsc:** `npx tsc -p tsconfig.app.json --noEmit` reports 66 errors (base 70). None is in a file this plan touched, and after Task 3 the error set is identical to the set measured after Task 2, so the set diff is empty. `npx tsc -p tsconfig.node.json --noEmit` → exit 0 (this covers vite.config.ts and plugins/brandMeta.ts).
- `node scripts/check-docs-coverage.cjs` → `docs coverage OK — every code key and inventory ID has a page (excluded by decision: I20).` (110 code keys · 261 inventory IDs · 119 pages).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/276-…` → `ledger gate OK`. `node scripts/check-claude-md-size.cjs` → `claude-md size gate OK`.
- `node scripts/check-landing-drift.cjs` → only the inherited 29-vs-30 `BUILTIN_TOOL_COUNT` finding (D-22).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] The plan's grep criterion `grep -c "syrel-lockup-email.png" email_provider.py` = 1 conflicted with naming the file in the module docblock.**
- **Found during:** Task 2
- **Fix:** The docblock now says "the email lockup under `/brand/`". The filename appears once, in the code.
- **Commit:** `61f8a975f`

**2. [Rule 1 - Bug] search.test.ts asserted the index holds exactly pages + changelog + sections documents.**
- **Found during:** Task 3 RED
- **Fix:** The Build Story doc makes that count +1, so the assertion was updated in place with a comment saying why.
- **Commit:** `a1f2cb5ad`

**3. [Scope note] vite.config.ts became `defineConfig(({ mode }) => { … })` so it can call `loadEnv`.** The config had no `loadEnv` before this plan. The object body was not re-indented, to keep the diff at 12 lines. `tsc -p tsconfig.node.json` is clean.

There were no other deviations. The BUG-261004-02 report was written during Task 1 (`8aefee1ae`), so Task 3 did not need to add it.

## Known Stubs

- `frontend/src/docs/video/videos.ts`: `changelog.chapter-1..5` keep `youtubeId: null`. This is intentional (D-12): the Build Story renders no frame for them and promises no video. They are filled when the operator uploads the episodes (see the owed list below).

## Threat Flags

None. Each new surface is covered by the plan's threat register: T-276-40 (escaped org, link and logo URL), T-276-41 (static same-origin logo, no token), T-276-42 (test arm B), T-276-43 (no http(s) in source brand tags; chapter slots stay click-to-load), T-276-44 (single-pass decode map), T-276-45 (`new URL().origin` only for http/https).

## Operator-owed (not done by this plan)

1. **Supabase auth email templates.** In the Dashboard, go to Authentication → Email Templates (confirm sign-up, magic link, reset password, invite). Set the logo to `https://<app host>/brand/syrel-lockup-email.png` and the product name to Syrel, on both local Studio and cloud. Our code only sends the org invite; Supabase sends every other auth email.
2. **YouTube uploads of the five Build Story episodes.** Wrap each one in `BrandedEpisode` first (D-26, D-12). Then fill `youtubeId` and `poster` for `changelog.chapter-1..5` in `frontend/src/docs/video/videos.ts`. Until then the Build Story and changelog pages show no video, which is correct. Posters for the first two episodes already exist at `~/Downloads/gemini-notebook/Syrel/posters/build-story-ep1-poster.png` and `~/Downloads/gemini-notebook/Syrel/posters/build-story-ep2-poster.png`. Copy them into a self-hosted path under `frontend/public/` and set `poster` to that path, never to a YouTube thumbnail URL.
3. **`VITE_APP_URL` in Vercel (and the onebox env).** Set it to the production app origin (`https://app.<domain>`, per `docs/OPERATOR.md`). `og:image` and `twitter:image` only become absolute at build time where it is set. While it is unset, link previews carry a relative image path and most crawlers show no image. It is a build-time variable, so the frontend must be redeployed after setting it.

## G-4 hand-off (this plan)

- Open `/docs/changelog/build-story` at desktop width and at 390 px. Check that five chapters show in order with summaries and releases, there are no empty video frames, every release link and "See these releases in the changelog" link works, and a deep-link refresh renders the docs page rather than the app (G4-4).
- Check that `/docs` (under "How Syrel got here") and `/docs/changelog` (hero) both show the Build Story link.
- In a browser tab, check that the Iris favicon shows on `/`, `/app` and `/docs`, that the SetupWizard header shows the mark on the dark chip, and that an Experts category with `&` reads "&".
- No push to master or production was made.

## Self-Check: PASSED

- All 16 created files exist (`[ -f ]`), including the 7 PNGs, the script, the plugin, the manifest, BuildStory.tsx and its suite, both backend tests and BUG-261004-02.
- The 4 Vite leftovers are gone (`[ ! -e ]`).
- All 6 plan commits exist: `d2bdbc724`, `8aefee1ae`, `ab5cda298`, `61f8a975f`, `a1f2cb5ad`, `9f5a4bba4`.
- `git diff --name-only 9b7dd251d HEAD` touches no STATE.md, ROADMAP.md, `components/chat/**`, ChatArea.tsx, App.tsx, NavPanel.tsx, AuthCardShell.tsx or index.css. The grep's only hit was `frontend/src/docs/DocsApp.tsx`, a substring match on this plan's own file.
- Nothing was written to the main checkout. No push to master or production was made.
- Open item, recorded rather than hidden: the backend baseline needs one quiet full re-run with Supabase up (see Gates).
