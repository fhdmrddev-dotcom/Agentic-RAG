---
phase: 276-public-docs-api-reference-video-library
plan: 02
subsystem: docs
tags: [vite, multi-entry, routing, vercel, nginx, docker, minisearch, frontmatter, changelog, remotion]

requires:
  - phase: 276 pre-wave (orchestrator)
    provides: "8 exact-pinned packages installed in the main checkout and committed as 887dc0fdd"
provides:
  - "A third Vite entry (docs.html → src/docs/main.tsx) reachable at /docs and /docs/* in vite dev, on Vercel and on a onebox"
  - "The onebox frontend image builds from the repo root so ../docs, ../scripts/lib and ../video resolve"
  - "scripts/lib/docs-content.cjs: the ONE dependency-free parser (frontmatter subset, pages, IA validation, changelog, search docs, code-key extractors)"
  - "frontend/plugins/docsContent.ts: virtual:docs-manifest, per-page body chunks, docs-assets/search-index.json, public-spec copy, allow-listed vo/music copy"
  - "router.ts resolveRoute/navigate; types.ts; virtual-docs.d.ts; a minimal DocsApp for 276-03 to replace"
  - "docs/public/sections.json (the 11-section IA tree, 119 slugs) and docs/public/README.md (the frontmatter contract)"
affects: [276-03, 276-04, 276-05]

tech-stack:
  added: ["@remotion/player 4.0.532", "remotion 4.0.532", "@remotion/transitions 4.0.532", "@remotion/media 4.0.532", "@remotion/google-fonts 4.0.532", "mediabunny 1.56.1", "minisearch 7.2.0", "@scalar/api-reference-react 0.9.77 (all installed pre-wave by the orchestrator, 887dc0fdd)"]
  patterns:
    - "Routing decision as a pure, unit-tested function (devRouting.ts) applied by a thin Vite plugin"
    - "Vercel precedence simulated in a test over the REAL vercel.json (redirects → filesystem → rewrites)"
    - "Node-only content parser shared by a Vite plugin and a CI gate, typed for TS through a sibling .d.cts"
    - "Test I/O injection (extractCodeKeys(root, { readFile })) instead of temp copies, so frontend tests need no node types"

key-files:
  created:
    - frontend/devRouting.ts
    - frontend/docs.html
    - frontend/Dockerfile.dockerignore
    - frontend/plugins/docsContent.ts
    - scripts/lib/docs-content.cjs
    - scripts/lib/docs-content.d.cts
    - frontend/src/docs/main.tsx
    - frontend/src/docs/DocsApp.tsx
    - frontend/src/docs/router.ts
    - frontend/src/docs/types.ts
    - frontend/src/docs/virtual-docs.d.ts
    - frontend/src/docs/search/searchOptions.ts
    - docs/public/sections.json
    - docs/public/README.md
    - frontend/src/docs/__tests__/{devRouting,docsVercelRouting,docsContent,changelog,search,router}.test.ts
    - frontend/src/docs/__tests__/fixtures/ (public/ 3 pages + sections.json, history/ 2 files, overrides/ 2 files)
  modified:
    - frontend/vite.config.ts
    - frontend/tsconfig.app.json
    - frontend/vitest.config.ts
    - frontend/vercel.json
    - frontend/nginx.conf
    - frontend/Dockerfile
    - docker-compose.prod.yml
    - scripts/vitest-count-gate.cjs

key-decisions:
  - "The dev /docs rule runs BEFORE the dotted-path check, not only before the app.html rule: /docs/changelog/v4.5 contains a dot and would otherwise 404 in dev"
  - "Pitfall 12 FOLDED (not seeded): onebox nginx now serves app.html for /app, /app/*, /setup, /invite, /admin/spend"
  - "Chapter titles come from docs/history/README.md, which differs from the UI-SPEC copy table (e.g. 'A document chat that can be trusted' vs 'A document chat you can trust') — README wins, per the plan"
  - "/docs/api resolves to the api/overview page via an explicit one-entry SECTION_LANDING_PAGE map; other sections keep their section index"
  - "covers: accepts exactly the 7 interface prefixes; any other prefix (e.g. op:) is [bad-frontmatter] until added to docs-content.cjs + README + the gate in one commit"

patterns-established:
  - "frontend tests read repo files via ?raw or through docs-content.cjs, never node:fs — tsconfig.app.json has no node types, and the base error set must not grow"

requirements-completed: [DOCS-01, DOCS-05, DOCS-02]

duration: ~35min
completed: 2026-10-04
---

# Phase 276 Plan 02: Docs entry plumbing and content pipeline Summary

**A third Vite entry served at /docs in dev, on Vercel and on a onebox (root build context), fed by one dependency-free parser that builds the manifest, per-page chunks, a 27-release changelog with v4.5 marked unreleased, and a MiniSearch index.**

## Performance

- **Duration:** ~35 min (first commit 09:51, last task commit ~10:12, +04:00)
- **Started:** 2026-10-04T05:46:30Z (worktree base 2b756b1cd)
- **Completed:** 2026-10-04
- **Tasks:** 3 (Task 1 by the orchestrator, pre-wave; Tasks 2-3 here)
- **Files modified:** 8 modified, 30 created (incl. 9 fixture files)

## Accomplishments

- `/docs` reaches `docs.html` in all three serving paths, each proven: dev middleware (unit test + live `curl`), Vercel (precedence simulated over the real `vercel.json`), onebox nginx (location blocks, plus the Pitfall 12 fix).
- The onebox frontend image now builds from the repo root with explicit COPYs and a per-Dockerfile ignore; `check-deploy-drift.sh` passes.
- `scripts/lib/docs-content.cjs` is the single home of the frontmatter contract, the changelog generator and the seven code-key extractors (each with a floor that throws naming its file).
- The Vite plugin builds the manifest, lazy page chunks and `docs-assets/search-index.json`, copies the VO by allow-list, and prints the exact named warning for the missing public spec.

## Task Commits

1. **Task 1: package legitimacy gate + exact-pinned install** — `887dc0fdd` (chore, **completed by the orchestrator pre-wave** in the main checkout). Operator answered "Approve all 8" after an `npm view` audit. Pins verified `4.0.532 4.0.532 7.2.0 0.9.77`; the commit touches exactly `frontend/package.json` + `frontend/package-lock.json`.

   | Package | Version | Repository | postinstall |
   |---|---|---|---|
   | @remotion/player | 4.0.532 | remotion-dev/remotion | none |
   | remotion | 4.0.532 | remotion-dev/remotion | none |
   | @remotion/transitions | 4.0.532 | remotion-dev/remotion | none |
   | @remotion/media | 4.0.532 | remotion-dev/remotion | none |
   | @remotion/google-fonts | 4.0.532 | remotion-dev/remotion | none |
   | mediabunny | 1.56.1 | Vanilagy/mediabunny | none |
   | minisearch | 7.2.0 | lucaong/minisearch | none |
   | @scalar/api-reference-react | 0.9.77 | scalar/scalar | none |

   This executor never touched dependencies: `git diff --name-only 2b756b1cd..HEAD -- frontend/package.json frontend/package-lock.json` prints nothing. All 8 resolve through the `frontend/node_modules` junction (versions read from each package.json).

2. **Task 2: third entry, dev/prod routing, onebox build context**
   - RED `c9421179d` (test) — devRouting failed with *Cannot find module '../../../devRouting'*; vercelRouting failed 2 of 8 (`/docs` → 404, the docs rules absent).
   - GREEN `eb43e0b75` (feat) — 15/15.
3. **Task 3: one parser, content plugin, route resolver, IA data, contract**
   - RED `9fac30865` (test) — all four suites failed at import (no `docs-content.cjs`, `router.ts`, `searchOptions.ts`).
   - GREEN `4a3b33371` (feat) — 34/34.
4. **Post-gate fix** — `37aee303b` (fix): docs Vercel suite renamed to a unique basename (Deviation 5).

## Verification (measured)

- `npx vitest run src/docs` → **6 files, 49 tests passed** (8 of them are the Vercel suite, later renamed). The existing `src/__tests__/routing/vercelRouting.test.ts` (Phase 228) still passes against the edited `vercel.json` (23/23 with the two new suites).
- App typecheck `npx tsc -p tsconfig.app.json --noEmit`: **70 errors at base, 70 after**, and the sorted set diff (`LC_ALL=C comm`) is **empty in both directions**. `npx tsc -p tsconfig.node.json --noEmit` (vite.config.ts + devRouting.ts + plugins/docsContent.ts) is clean.
- `video/src` typechecks through the new `tsconfig.app.json` paths with **0 errors** (scratch config extending tsconfig.app.json over `video/src/index.ts`; `--listFiles` showed 208 video/remotion files loaded, so the probe was not vacuous).
- `node -e "…parseHistory('docs/history')…"` → `27 v4.5 false`.
- `grep -nE "require\(['\"][a-z@]" scripts/lib/docs-content.cjs` → only `fs` and `path`.
- `node -e "…sections.json…"` → `11` (119 slugs in total).
- `extractCodeKeys('.')` → nav 7 · view 12 · tool 30 · step 7 · check 10 · router 38 · settings-tab 5 (exactly RESEARCH's measured counts).
- `npx vite build` → **exit 0**, and the output contains, verbatim:
  `[docs-content] WARNING: docs/public/api/openapi.public.json is missing — /docs/api/reference will show its error state. Run node scripts/build-public-openapi.cjs`
  plus `[docs-content] WARNING: no pages under docs/public yet (119 sections.json slugs have no file) — content lands in 276-04; the coverage gate enforces it.` `dist/docs.html`, `dist/docs-assets/search-index.json` (107 KB, 24.8 KB gz) and 13 `dist/vo/*.wav` were emitted. The docs chunk imports only shared React chunks (no supabase).
- Live dev server (`npx vite --port 5199`, stopped after): `/docs/use/chat` → docs-root **1**; `/docs/changelog/v4.5` → docs-root **1**; `/app` → docs-root **0**; `/docs-assets/search-index.json` → 200 application/json; `/vo/clip-chat.wav` → 200 audio/wav; `/vo/..%2F..%2Fpackage.json` → **404** (traversal guard); `/docs-assets/openapi.public.json` → 404 (file not merged yet).
- `bash scripts/check-deploy-drift.sh` → `RESULT: PASS — the one-box deploy artifacts are in sync.` (1 WARN: docker compose denied locally, structural fallback used, as expected).
- `node scripts/check-hot-file-ledger.cjs .planning/phases/276-public-docs-api-reference-video-library` → `scan list: 442 rows · subject: 154 files · watched: 39` / `ledger gate OK — every watched file has a row.`
- Acceptance greps: `rewriteDevUrl` in vite.config.ts 2 · `docs.html` in vite.config.ts 2 · `"/docs/(.*)"` in vercel.json 1 · `docs.html` in nginx.conf 3 · `app.html` in nginx.conf 6 · `context: .` 1 · `dockerfile: frontend/Dockerfile` 1 · `"src/docs"` in the count gate 1. `git diff` of nginx.conf removes no line inside `location /api/`.
- Full vitest gate (wave 1), `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the worktree root, at `4a3b33371`, verdict lines verbatim:
  ```
    total                                      8874    9678    +804
    total 9678  ·  failed 0  ·  pinned total 8874
  count gate OK — 389/389 pinned files present, no per-file decrease, 0 failing.
  ```
  New docs suites read: devRouting 7 · docsContent 14 · changelog 8 · router 7 · search 5. ⚠ That run also printed `vercelRouting.test.ts 8 → 16 (+8)` — the gate keys BASELINE by **basename**, so the new docs suite was being summed into the pinned Phase 228 suite of the same name. Fixed after the run by renaming it `docsVercelRouting.test.ts` (`37aee303b`, see Deviation 5). The full gate was **not** re-run after the rename; the targeted run `npx vitest run src/docs src/__tests__/routing` reads **7 files, 57 tests passed**. Expected effect on the next full run: `vercelRouting.test.ts` back to `8 · 8 · 0`, `docsVercelRouting.test.ts — 8 new`, grand total unchanged.

## Files Created/Modified

- `frontend/devRouting.ts` — `rewriteDevUrl`: root/internals pass, `/docs*` → `docs.html`, other dotted paths pass, everything else → `app.html`.
- `frontend/vite.config.ts` — third input `docs`, `@video` alias, `resolve.dedupe` for react/remotion/mediabunny, `server.fs.allow` limited to named dirs, registers `docsContent`.
- `frontend/tsconfig.app.json` / `frontend/vitest.config.ts` — `@video/*` path + mappings so video/src resolves against `frontend/node_modules`.
- `frontend/docs.html` — index.html's head (fonts trio) without the theme script or Tailwind body classes; `#docs-root`.
- `frontend/vercel.json` — `/docs` and `/docs/(.*)` rewrites after the app-host catch-all.
- `frontend/nginx.conf` — `/docs` locations; Pitfall 12 fold for app paths.
- `frontend/Dockerfile`, `frontend/Dockerfile.dockerignore`, `docker-compose.prod.yml` — repo-root build context.
- `scripts/vitest-count-gate.cjs` — `"src/docs"` in TARGETS (BASELINE pins are 276-05's close pass).
- `scripts/lib/docs-content.cjs` + `.d.cts` — the shared parser and its types.
- `frontend/plugins/docsContent.ts` — the Vite plugin.
- `frontend/src/docs/{main.tsx,DocsApp.tsx,router.ts,types.ts,virtual-docs.d.ts,search/searchOptions.ts}`.
- `docs/public/sections.json`, `docs/public/README.md`.

## Decisions Made

See `key-decisions` above. Two worth stating plainly:

- **Pitfall 12 is folded, not seeded.** The plan asked to fold it; onebox `/app`, `/app/*`, `/setup`, `/invite` and `/admin/spend` now serve `app.html` (they served the landing since Phase 226). The `/api/` block is byte-unchanged.
- **The chapter titles are README's.** `parseChapters` returns `1 A document chat that can be trusted · 2 An agent that keeps working · 3 Workflows anyone can author · 4 Organisations and connections · 5 A product you can sell`. UI-SPEC's copy table words chapter 1 as "A document chat you can trust". 276-03 should render the manifest's titles rather than the copy table.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `/docs/changelog/v4.5` would 404 in vite dev**
- **Found during:** Task 2 (my own GREEN run — a RED-suite case failed against the first implementation)
- **Issue:** RESEARCH Pattern 1 places the `/docs` rule after the "has a dot → pass through" check. Changelog version routes contain a dot, so the dev server would have treated them as missing files.
- **Fix:** the `/docs` rule now runs after the root/internal check and before the dotted-path check. Safe because no real file ever lives under `/docs/` (assets are under `/docs-assets/`). Added a `/docs.html` pass-through case.
- **Files modified:** `frontend/devRouting.ts`, `frontend/src/docs/__tests__/devRouting.test.ts`
- **Commit:** `eb43e0b75`

**2. [Rule 3 - Blocking] frontend tests cannot use node:fs without growing the base typecheck error set**
- **Found during:** Task 2
- **Issue:** `tsconfig.app.json` carries only `vite/client` types; the first vercelRouting draft (copying the Phase 228 suite's `node:fs` + `__dirname`) added 3 errors to the 70-error base set.
- **Fix:** `vercel.json` is read with `?raw`; the Task 3 suites reach the filesystem only through `docs-content.cjs` (`findRepoRoot`, `readRepoFile`, and an injectable `{ readFile }` for the planted-defect case instead of a temp copy). Fixture directories (`fixtures/history`, `fixtures/overrides`) replace temp dirs.
- **Files modified:** test files; `scripts/lib/docs-content.cjs` exports `findRepoRoot`, `readRepoFile`, `listHistoryFiles`, `parseChapters`, `readSections`
- **Commits:** `eb43e0b75`, `4a3b33371`

**3. [Rule 3 - Blocking] `scripts/lib/docs-content.d.cts` added (not in files_modified)**
- **Issue:** a TS import of a plain `.cjs` has no types (TS7016 under strict), for both the plugin and the tests.
- **Fix:** a sibling `.d.cts` declaring every export; header says to keep it in step with the `.cjs` in the same commit.
- **Commit:** `4a3b33371`

**4. [Rule 2 - Missing functionality] `readSections` validates sections.json shape**
- Every section must carry id/title/purpose/slugs and every group slug must be one of its section's slugs; the plugin fails loudly on a malformed IA file rather than rendering a broken tree.

**5. [Rule 1 - Bug] `vercelRouting.test.ts` renamed to `docsVercelRouting.test.ts`**
- **Found during:** the wave-1 full gate run (Task 3 verification)
- **Issue:** the plan's file name collides with the pinned `src/__tests__/routing/vercelRouting.test.ts` (Phase 228). `vitest-count-gate.cjs` keys BASELINE by basename, so it reported `8 → 16` for one merged entry — neither suite was guarded on its own, and a later BASELINE pin of "16" could not tell which suite lost cases.
- **Fix:** `git mv` to `frontend/src/docs/__tests__/docsVercelRouting.test.ts`, with a header note saying why. 276-03/05 should refer to it by the new name (PATTERNS calls it `vercelRouting`).
- **Commit:** `37aee303b`

## Notes for downstream plans

- **276-03:** the download link in UI-SPEC P6 says `/docs/openapi.public.json`; the asset is emitted at **`/docs-assets/openapi.public.json`** (a `/docs/…` URL would be routed to `docs.html` in dev and on nginx). Use the manifest's chapter titles (README wording). The manifest embeds the full changelog (all shipped bullets) in the docs entry's first-paint chunk (docs chunk 81 KB raw today); if that matters for the first-paint budget, move `changelog` behind a lazy virtual module. The plugin's missing-spec branch is the `console.warn` in `generateBundle` — turn it into `this.error` on the merged tree. Heading ids come from `headingId()` in `docs-content.cjs`; the Markdown renderer must produce the same ids (or use `page.headings` by order).
- **276-04:** `docs/public/<section>/<slug>.md` + the README contract; `validatePages` reports `[missing-page]` for all 119 slugs today. `covers:` rejects prefixes other than the seven listed.
- **276-05:** consume `extractCodeKeys(repoRoot, io?)`, `loadAllPages(root)`, `validatePages`, `formatFinding`. Pin `src/docs` suites in BASELINE (TARGETS already has it).
- **Ledger:** `scripts/vitest-count-gate.cjs` (a FIRING row) gained one TARGETS line here; its CLAUDE.md row / `docs/HOT-FILE-LEDGER.md` section were NOT edited in this worktree to avoid a parallel-merge conflict with 276-01 — the phase close pass should re-derive the triple. The ledger gate passed.

## Threat Flags

None beyond the plan's register. T-276-07 (dev middleware) is mitigated as planned: the allow-list `^[a-z0-9-]+\.(wav|mp3)$` plus a per-directory extension check guards every path join, and a live traversal probe returned 404. T-276-08: the root build context is narrowed by `frontend/Dockerfile.dockerignore` and explicit COPY lines (assumption A3 — BuildKit per-Dockerfile ignore — is recorded in the Dockerfile header; unverified locally because Docker is denied here).

## User Setup Required

Vercel: turn ON "Include source files outside of the Root Directory in the Build Step" (Project → Settings → Build and Deployment → Root Directory) before the next deploy — the docs entry imports `../docs`, `../scripts/lib` and (from 276-03) `../video/src`.

## Known Stubs

- `frontend/src/docs/DocsApp.tsx` renders only the section name and an H1 per route kind. Intentional: 276-03 replaces the body with the real page components; the routing and manifest contract stay.
- `docs/public/` has no pages yet (0 of 119). Intentional: content lands in 276-04; the coverage gate (276-05) enforces it.

## Self-Check: PASSED

- All 14 created source/data files listed under key-files exist (checked with `ls`).
- Commits exist: `887dc0fdd` (pre-wave), `c9421179d`, `eb43e0b75`, `9fac30865`, `4a3b33371`, `37aee303b`.
- STATE.md and ROADMAP.md were not modified (the orchestrator owns them).
