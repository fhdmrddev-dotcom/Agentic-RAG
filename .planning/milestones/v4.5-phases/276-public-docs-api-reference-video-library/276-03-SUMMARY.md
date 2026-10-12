---
phase: 276-public-docs-api-reference-video-library
plan: 03
subsystem: docs-ui
tags: [docs, react-markdown, minisearch, scalar, youtube-nocookie, menu-drawer, a11y, honesty-badges]

requires:
  - phase: 276-01
    provides: "docs/public/api/openapi.public.json; the Iris brand block in Navigation/LandingFooter"
  - phase: 276-02
    provides: "virtual:docs-manifest, router.resolveRoute/navigate, types.ts, searchOptions.ts, the docs.html entry, docs-assets/search-index.json"
provides:
  - "The docs component tree: Home, Article, Stub, SectionIndex, NotFound, Changelog, ChangelogVersion, ApiReference (lazy)"
  - "DocsDataProvider/useDocs — components read the manifest from context; docsManifest.ts is the ONE virtual-module importer"
  - "VideoSlot + videos.ts: the VideoEntry union (youtube | remotion) and the slot resolver 276-05 extends with RemotionSlot"
  - "Shared header: Navigation(current, searchSlot, drawerTop, drawerSections) + MenuDrawer (landing and docs)"
  - "Build-time search: SearchBox / SearchDialog over /docs-assets/search-index.json, fetched on first focus"
  - "docsBundleFence: the docs graph cannot reach app code; Scalar/Remotion/@video only via import()"
  - "docsContent plugin: a missing public spec fails the build"
affects: [276-04, 276-05]

tech-stack:
  added: []
  patterns:
    - "Manifest through React context + one virtual-module importer, so page components test with plain fixtures and DocsApp tests with vi.mock('../docsManifest')"
    - "Honesty copy in one module (pages/copy.ts) shared by pages, callouts and tests"
    - "Slot resolution as data (videos.ts) + one resolver; an absent or id-less slot renders null"
    - "Heavy optional deps (Scalar, MiniSearch) behind import(); the route page itself React.lazy"

key-files:
  created:
    - frontend/src/docs/docsData.tsx
    - frontend/src/docs/docsManifest.ts
    - frontend/src/docs/headingId.ts
    - frontend/src/docs/icons.tsx
    - frontend/src/docs/docs.css
    - frontend/src/docs/pages/{Home,Article,Stub,SectionIndex,NotFound,Changelog,ChangelogVersion,ApiReference}.tsx
    - frontend/src/docs/pages/copy.ts
    - frontend/src/docs/components/{Markdown,DocBadge,Callout,Breadcrumbs,Pager,TocPill,ChapterStrip,SearchBox,SearchDialog,DocsHeader}.tsx
    - frontend/src/docs/search/searchIndex.ts
    - frontend/src/docs/video/{VideoSlot,YouTubeFacade}.tsx
    - frontend/src/docs/video/videos.ts
    - frontend/src/landing/components/MenuDrawer.tsx
    - frontend/src/landing/__tests__/Navigation.test.tsx
    - frontend/src/docs/__tests__/{Stub,Article,VideoSlot,SearchBox,ChangelogPage,ApiReference,DocsApp}.test.tsx
    - frontend/src/docs/__tests__/docsBundleFence.test.ts
    - frontend/src/docs/__tests__/helpers/docsFixture.tsx
  modified:
    - frontend/src/docs/DocsApp.tsx
    - frontend/src/docs/main.tsx
    - frontend/src/docs/router.ts
    - frontend/src/landing/components/Navigation.tsx
    - frontend/src/landing/components/LandingFooter.tsx
    - frontend/src/landing/landing.css
    - frontend/plugins/docsContent.ts

key-decisions:
  - "Every Scalar config key in the plan exists in @scalar/types 0.9.77 under the planned name (none renamed); agent lives in the source config ({ disabled: true }); mcp: { disabled: true } added"
  - "Scalar's static chunk closure is ~1.09 MB gzipped (3.58 MB raw), above the ~1 MB line: Redoc fallback is RECORDED for the operator, not switched"
  - "The API page HEAD-checks openapi.public.json before mounting Scalar, so a missing spec (dev 404) shows the error state instead of an empty reference"
  - "The H2 '#' anchor sits beside the heading, not inside it, so a heading's accessible name stays its own text"
  - "v4.5 changelog summary is prefixed 'Planned, not shipped yet:' (the history one-liner is present tense); its version page heads the bullets 'What is planned' rather than 'What shipped'"
  - "Partial-unreleased callout copy (UI-SPEC gave none): 'Part of this page is not yet released. The parts covering {ids} belong to v4.5, which has not shipped. Everything else here is in Syrel today.'"

requirements-completed: [DOCS-01, DOCS-03, DOCS-05, DOCS-06]

duration: ~2h
completed: 2026-10-04
---

# Phase 276 Plan 03: Docs UI — shell, guides, search, changelog, API reference Summary

**The public /docs site in sketch-276 direction B: one shared landing/docs header with a phone menu drawer, home / guide / stub / section / not-found pages with honesty badges, build-time MiniSearch search, a filterable changelog that marks v4.5 unreleased, and a lazily loaded Scalar reference with telemetry, AI agent and test requests off.**

## Performance

- **Duration:** ~2 h
- **Started:** 2026-10-04 (worktree base `8d0d2a5b6`, reset from an off-base start as expected)
- **Tasks:** 3 (each RED → GREEN)
- **Files:** 46 changed (+3528 / −65)

## Accomplishments

- **Docs shell (DocsApp):** resolves the route to a page, intercepts same-origin `/docs` links (client navigation, modified clicks and downloads left alone), sets `document.title`, scrolls to top or the hash, focuses the page H1, "Skip to content" link, shared header + footer.
- **Pages:** Home (hero + search focal point + `home.overview` slot + bento + "Browse every section" with derived `{written} guides · {stubs} coming` + chapter strip), Article (crumbs, meta pills, unreleased / partial callouts, Markdown body, pager, TOC pill at ≥ 3 H2s), Stub (Full guide coming, unreleased badge + exact callout on v4.5, frontmatter video slot, Read next), SectionIndex (grouped by sections.json), NotFound (exact P8 copy + search), Changelog, ChangelogVersion, ApiReference.
- **Markdown safety (T-276-11):** no raw-HTML plugin, default `urlTransform`; Article.test proves `<script>`/inline HTML render as text and no `javascript:` href survives. H2 ids use `headingId()`, pinned to the build's copy by a parity test.
- **Video (D-12/D-13, T-276-12):** `VideoSlot` returns null for an unknown slot or a YouTube entry with no id (every YouTube entry is null today); the facade creates the `youtube-nocookie.com` iframe only on click, poster self-hosted. The `VideoEntry` union already carries the `remotion` kind for 276-05.
- **Header (D-01, G4-1):** Navigation gains Docs (`/docs`), absolute hash links, `current`, and three docs slots; ≤ 720 px shows a Menu button that opens MenuDrawer (modal dialog, scroll lock, focus trap across toggle + sheet, Esc / link / popstate / resize close, focus restore). Footer: Docs · Changelog · Security · GitHub · Sign in.
- **Search (D-08):** index + MiniSearch both load on the first focus (dynamic import), combobox per WAI-ARIA 1.2, ≥ 2 chars / 120 ms / max 8, stub and v4.5 rows badged, exact empty / loading / error copy, `/` shortcut (hero on home, dialog elsewhere).
- **API reference (DOCS-03, D-16, T-276-13):** route-level `React.lazy` page; Scalar via `import()` with `telemetry: false`, `agent: { disabled: true }`, `mcp: { disabled: true }`, `withDefaultFonts: false`, client + test-request buttons hidden, dark forced, Deep Midnight CSS variables; exact "No API keys today." callout; loading and error states with exact copy.
- **Fence (T-276-14):** `docsBundleFence.test.ts` crawls static + dynamic edges from `src/docs/main.tsx` (no app paths, no Supabase) and static-only edges (no `@scalar/*`, `@remotion/*`, `@video/*`, `remotion`, `mediabunny`), with non-vacuity controls.

## Task Commits

1. **Task 1 — shell, home, article, stub, section index, not-found, badges, video slot**
   - RED `0d5ca2fc7` — all three suites failed at import (`Failed to resolve import "../pages/Article"` / `"../pages/Stub"` / `"../video/VideoSlot"`).
   - GREEN `870943fdb` — 21/21 (with router.test). First GREEN run had 1 failure (heading name included "Link to this section"); fixed by moving the anchor beside the heading.
2. **Task 2 — shared header + drawer, footer, docs header, search**
   - RED `3a5306002` — Navigation 5/5 failing (no Docs link, no Menu), SearchBox failed at import (`../search/searchIndex`).
   - GREEN `06a1f16a5` — `src/landing` + SearchBox 36/36. One intermediate red: the landing facts fence flagged the number in a MenuDrawer comment ("the 11 section links"); reworded.
3. **Task 3 — changelog, lazy Scalar reference, bundle fence, plugin hardening**
   - RED `d42af7d85` — ChangelogPage / ApiReference failed at import; the fence failed its positive controls (ApiReference.tsx not in the graph).
   - GREEN `6e07d8332` — `src/docs` + `src/landing` 22 files / 126 tests.

## Verification (measured)

- `npx vitest run src/docs src/landing` → **22 files, 126 tests passed**.
- **Fence planted-defect drive:** adding `import "@scalar/api-reference-react"` + `import "@/lib/supabase"` to `headingId.ts` turned both crawl tests red (`… headingId.ts STATICALLY imports @scalar/api-reference-react (must be import())`); removed (file diff empty), 3/3 green again.
- **Plugin missing-spec drive:** with `docs/public/api/openapi.public.json` moved aside, `npx vite build` exited **1** with `RolldownError: [docs-content] docs/public/api/openapi.public.json is missing — run node scripts/build-public-openapi.cjs`; spec restored (`git status docs/` clean).
- `npx vite build` (merged tree, spec present) → **exit 0**; `dist/docs.html` (1.75 kB), `dist/docs-assets/search-index.json` (107 kB / 24.8 kB gz), `dist/docs-assets/openapi.public.json` (794 kB / 116 kB gz) all present. Only remaining docs warning: `no pages under docs/public yet` (276-04 writes them).
- **Chunk sizes (gzip, measured over each chunk's static import closure):** docs first paint **146 KB** across 10 chunks (incl. react-dom; the docs chunk itself 74 KB — react-markdown/remark-gfm + the embedded changelog); **Scalar ≈ 1,090 KB** across 12 chunks beyond the docs chunk (3.58 MB raw) — loaded only on `/docs/api/reference`. No first-paint docs chunk contains `supabase`, `scalar`, `remotion` or MiniSearch; MiniSearch is its own lazy chunk. The landing chunk imports no docs chunk.
- **Typecheck:** `npx tsc -p tsconfig.app.json --noEmit` → **70 errors (base 70)**, none under `src/docs`, `src/landing` or `plugins`; this plan edited no file outside those, so the error set is the base set. `npx tsc -p tsconfig.node.json --noEmit` exit 0.
- **Live dev probe** (`vite --port 5197`, stopped after): `/docs`, `/docs/nope`, `/docs/changelog/v4.5`, `/docs/api/reference` → 200 with `docs-root`; `HEAD /docs-assets/openapi.public.json` → 200; `/docs-assets/search-index.json` → 200; `DocsApp.tsx`, `docsManifest.ts`, `ApiReference.tsx`, `docs.css` all transform (200).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/276-…` → `ledger gate OK — every watched file has a row.`
- `node scripts/check-landing-drift.cjs` → red, `Source Code: 30` vs `facts.ts: 29` — **inherited (D-22)**, not edited.
- Acceptance greps: `Full guide coming` in DocBadge 1 · `Nothing on this page is in Syrel today.` in pages 1 (`pages/copy.ts`) · raw-HTML plugin 0 · YouTube thumbnail host / iframe_api 0 · `helpful` 0 · `href="/docs"` in Navigation 1 · relative hash links 0 / 0 · `src/docs` in landing 0 · `telemetry: false` 1 · `hideTestRequestButton: true` 1 · `^import .*@scalar` 0 · `openapi.public.json is missing — run node` 1.
- **Wave-2 full vitest gate** (`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`, worktree root, verdict verbatim):
  ```
    total                                      8874    9731    +857
    total 9731  ·  failed 0  ·  pinned total 8874
  count gate OK — 389/389 pinned files present, no per-file decrease, 0 failing.
  ```
  First run at `6e07d8332`, cap not adjusted, nothing red (no SEED-171 triage needed). This plan's suites read as unpinned `new`: Stub 5 · Article 5 · VideoSlot 4 · SearchBox 5 · ChangelogPage 7 · ApiReference 3 · DocsApp 3 · docsBundleFence 3 · Navigation 5 (BASELINE pinning is 276-05's close pass). Against 276-02's wave-1 reading (9678, taken on its own worktree before 276-01 merged) the total is `+53`: 40 are this plan's new cases; the other 13 arrive with the merged wave-1 tree and are not separately attributed here.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manifest via React context + `docsManifest.ts` (files not in the plan)**
- **Issue:** the vitest config does not load the docs plugin, so any component importing `virtual:docs-manifest` fails to transform in tests (`Failed to resolve import "virtual:docs-manifest"`, measured).
- **Fix:** `docsData.tsx` (provider + `useDocs`) and `docsManifest.ts` (the one virtual importer); pages take data from context; `DocsApp.test.tsx` mocks `../docsManifest`.
- **Commits:** `870943fdb`, `6e07d8332`

**2. [Rule 2 - Missing functionality] API page HEAD-checks the spec**
- **Issue:** the plan wants dev's 404 to show the error state, but Scalar fetching a missing URL renders an empty reference, not our error.
- **Fix:** `Promise.all([import(scalar), fetch(spec, { method: "HEAD" })])`; a non-OK response → the exact error copy. ApiReference.test covers it. Also a `RouteChunkBoundary` in DocsApp so a failed route-chunk load shows the same copy instead of blanking the page.
- **Commit:** `6e07d8332`

**3. [Rule 1 - Bug] H2 accessible name**
- **Issue:** a "#" link inside the H2 made every heading's accessible name start with "Link to this section".
- **Fix:** the anchor is a sibling of the H2 inside a wrapper.
- **Commit:** `870943fdb`

**4. [Rule 2] `router.navigate` marks its synthetic popstate (`NAVIGATE_STATE`)**
- So DocsApp scrolls to top / hash on a fresh navigation but leaves the browser's own scroll restoration alone on back/forward. router.test still passes.

**5. Extra files:** `components/Callout.tsx`, `pages/copy.ts`, `search/searchIndex.ts`, `__tests__/helpers/docsFixture.tsx`, `__tests__/DocsApp.test.tsx` (a supplementary smoke suite written after the GREEN code — not a TDD gate — covering G4-4 not-found-in-shell, title, intercepted client navigation and H1 focus).

**6. Honesty-copy grep target:** the plan's grep looks for the unreleased sentence under `src/docs/pages`; it lives once in `pages/copy.ts` and is rendered by `Callout.tsx`, so the copy has one home.

## Notes for downstream plans

- **276-05:** add `kind: "remotion"` entries to `VIDEOS` (`home.overview`, `clip.*`, `landing.promo`) and the lazy RemotionSlot branch in `VideoSlot.tsx` (marked there); the `RemotionModule` shape in `videos.ts` is a proposal — change it with its consumer. `Home` already shows "· has a 15-s clip" and the big-card poster as soon as `clip.*` resolves. Pin the new `src/docs` suites in the count gate's BASELINE (they are already in TARGETS).
- **276-04:** a page's `video:` key renders on a stub automatically; on a written page it renders after the meta row, or wherever the body has a bare `::video` paragraph (`::video{slot="…"}` overrides the key). Screenshots under `/docs-assets/shots/` render as 1280×800 figures with the alt text as caption; `> **Note:**` / `> **Warning:**` blockquotes become callouts.
- **Operator decision owed:** Scalar ≈ 1.09 MB gz on `/docs/api/reference` only — keep, or switch to the Redoc fallback (CONTEXT discretion). Not switched.

## Known Stubs

- `video/videos.ts`: every YouTube entry has `youtubeId: null` (nothing uploaded; `explainer.automate-workflows` stays null until the corrected cut — 276-VIDEO-QUEUE.md). Intentional: those slots render nothing by contract (V0). Remotion entries land in 276-05.
- `docs/public` has no pages in this worktree (276-04 writes them in parallel); the home bento skips cells whose page is missing and the section grid shows `0 guides · 0 coming` until then.

## Threat Flags

None beyond the plan's register. T-276-11/12/13/14 are mitigated as planned (tests + grep gates above). The API page's own request is a same-origin HEAD of a static file.

## TDD Gate Compliance

Task 1 `test` 0d5ca2fc7 → `feat` 870943fdb · Task 2 `test` 3a5306002 → `feat` 06a1f16a5 · Task 3 `test` d42af7d85 → `feat` 6e07d8332. Every RED run was seen failing before its implementation.

## Self-Check: PASSED

- Key created files present (`ls`): docsData.tsx, docsManifest.ts, pages/Stub.tsx, pages/ApiReference.tsx, pages/Changelog.tsx, video/VideoSlot.tsx, components/SearchBox.tsx, landing/components/MenuDrawer.tsx, __tests__/docsBundleFence.test.ts.
- All six commits are in `git log` on this branch: `0d5ca2fc7`, `870943fdb`, `3a5306002`, `06a1f16a5`, `d42af7d85`, `6e07d8332`.
- `git diff --name-only 8d0d2a5b6..HEAD -- .planning/STATE.md .planning/ROADMAP.md` is empty (the orchestrator owns them).
