# Phase 276: Public Docs, API Reference & Video Library - Research

**Researched:** 2026-10-04
**Domain:** Multi-entry Vite static docs site (React 19), Markdown content pipeline, build-time search, OpenAPI filtering + Scalar, FastAPI docs gating, Remotion `<Player>` embedding, coverage gate, branding pass
**Confidence:** MEDIUM-HIGH (repo facts measured; three build/deploy assumptions need a Wave-0 probe, listed in Open Questions)

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Carried forward (decided before this discussion — do not re-ask)**
- **D-01:** Shape is sketch 276 **winner B** (landing-native): big hero + search + video, bento guide
  grid, chapter strip; articles are a single centred column with a floating TOC pill. Third Vite entry
  `docs.html` → `src/docs/`, reusing the landing's `Navigation`, `LandingFooter` and Deep Midnight tokens.
- **D-02:** Information architecture = the 11-section tree in
  `.planning/research/docs-information-architecture.md`. Content source is Markdown under
  `docs/public/<section>/<slug>.md`, built into the docs entry.
- **D-03:** **DOCS-04 reverses a recorded decision, approved by the operator 2026-10-04.**
  `backend/app/main.py:765-768` says "`GET /docs` deliberately keeps returning 200 in BOTH flag states
  … App-wide `docs_url` gating has never been a convention". That stance is now reversed **for
  production only**: with the production flag set, unauthenticated `GET /docs`, `/redoc` and
  `/openapi.json` are refused; locally they still load. Replace the comment with the new rationale
  rather than deleting the history (strike-through + reason, the project's correction convention).
- **D-04:** Content is drafted from the NotebookLM notebook "Syrel — Knowledge & Videos"
  (`78d31d07-3e5a-4f6b-ab95-024b2fbbeef0`) and **fact-checked against `docs/history/`**. Only shipped,
  still-true behaviour. `v4.5` items carry "Not yet released". Word/PDF are **downloaded, not previewed
  in-app** (SEED-338). No "three deployment presets". Prose says **Syrel**; code identifiers stay as
  they are.
- **D-05:** Free tools only. Remotion is free for companies of up to 3 people — recheck before the
  company grows (record in the docs/video README).

**First pages, stubs and search**
- **D-06:** The first ~30 written pages target the **buyer + new user**: Get started (6), the core Use
  pages (chat, chat modes, library documents, ingestion, find, document detail), workflows
  overview / builder / publish, Experts (4), Security (6), and the changelog. The API section gets
  the **generated reference** plus the **authentication, streaming and errors** concept pages only.
  Everything else ships as a stub.
- **D-07:** A stub page shows **title + a 2-3 sentence summary of what the feature does** (from the
  coverage inventory), a **"Full guide coming"** badge, and **links to the nearest finished page**.
  Stubs are linked in navigation (not hidden). A stub counts as coverage for the gate (SC#2).
- **D-08:** The hero search box **works in this phase**: a build-time index over every page (written
  and stub), searched in the browser. No server, no AI search.
- **D-09:** Guide visuals = **15-s Remotion clips** where the IA marks `clip`, plus **a small number
  of real app screenshots** captured from the local app. Keep screenshots few (they go stale).

**Video slots, delivery and hosting**
- **D-10:** Slot mapping ("split by job"):
  | Slot | Style |
  |---|---|
  | Landing hero | **Music-driven promo** (`SyrelPromo`), no narration, plays **muted on scroll-into-view**, never on first paint |
  | Docs home | **Narrated Syrel overview** (`SyrelOverview`), click to play |
  | Guide pages | **15-s feature clips** (`Clip-*`) |
  | Section overview pages (IA `explainer` cells) | **NotebookLM explainers** |
  | Changelog | **Documentary chapters** ("Syrel: The Build Story") beside their milestones |
- **D-11:** Remotion-made videos reach the browser through the **live Remotion `<Player>`**, rendering
  from the same composition code, **lazy-loaded** only when the reader reaches the slot. Not
  pre-rendered MP4. (Both `frontend/` and `video/` are React 19 — measured.)
- **D-12:** NotebookLM MP4s (~35 MB each) live on **YouTube** (a Syrel channel). The page shows a
  **poster image** and loads the **`youtube-nocookie.com`** player **only on click** — no third-party
  request before the reader asks. ⚠ Uploading to YouTube is an **operator action**; until a video is
  uploaded, its slot shows nothing (no broken embed, no placeholder promise).
- **D-13:** New video work in 276 = **`BrandedEpisode`** (Remotion intro/outro wrapper for NotebookLM
  videos) and **`SyrelPromo`** (music-driven promo, original synthesized license-clean track). Embed
  what exists: overview, the 6 clips, the explainer, documentary ep. 1. **IA `clip` slots without a
  clip yet show nothing.** Documentary eps. 2-5 run **beside** the phase per
  `276-VIDEO-QUEUE.md` and **never block it** (NotebookLM rate limits are outside our control).

**Logo**
- **D-14:** 276 does the **full one-pass Iris logo insert**, in one commit: landing `Navigation` +
  `LandingFooter`, the **app header**, `frontend/public/favicon.svg`, the docs header, and `video/`'s
  `LogoPlaceholder`. Assets: `docs/brand/` (static lockup for nav bars, mark for favicon/small sizes).
  Wordmark is lowercase **syrel**; prose stays "Syrel".
- **D-15:** The **animated** logo appears in **video intros/outros only** (`BrandedEpisode`, the
  promo). Pages use the static lockup, so the landing hero has one moving thing (the promo).

**Developer section edges**
- **D-16:** The **operator (`/admin`) API reference is NOT public.** Public docs carry one page saying
  the operator API exists and returns 404 to non-operators; the per-endpoint reference lives in each
  deployment's own live API explorer, which is sign-in-gated after D-03. The build filter drops
  `/admin/*` from `openapi.public.json` (no `openapi.operator.json` is published).
- **D-17:** `/knowledge-health/*` is **documented as "UI-internal: may change"**, not retired — it is
  still called by `frontend/src/lib/api/knowledge.ts` (5 calls, measured), so retiring it would break
  the app.

**G-4 lived-experience scenarios (operator-chosen at scope time; Chrome drives all four at verification)**
- **G4-1 Phone 390 read-through:** from the landing nav, open `/docs` at 390 px: the menu drawer
  opens, a guide reads in one column, nothing is cut off, a video loads only when tapped.
- **G4-2 Landing stays fast:** landing first paint downloads **no** Remotion or API-reference code;
  the hero promo starts only when scrolled into view.
- **G4-3 Honesty spot-check:** the Find and artifacts pages show "Not yet released"; Word/PDF is
  described as download, not in-app preview; changelog v4.5 says not released.
- **G4-4 Deep link + refresh:** paste `/docs/use/chat` into the address bar and refresh: the docs page
  renders — never the app login (`app.html` fallthrough) and never a 404.

### Claude's Discretion
- **API renderer:** Scalar (`@scalar/api-reference-react`, MIT) recommended by research, reading the
  static pre-filtered JSON; fall back to Redoc static build if Scalar's bundle weight hurts. Either way
  it is lazy and never in the landing bundle.
- **Search library** (any free build-time index that works in the browser).
- **Routing mechanics** for `/docs/*` on Vercel (filesystem precedes rewrites — see memory
  `reference_vercel_filesystem_precedes_rewrites`) and in `vite.config.ts`'s dev middleware.
- **Coverage gate wiring:** CI plus a local hook, in the same shape as `check-claude-md-size.cjs`
  (local guard primary). The gate derives its scan set from code and refuses to pass over zero parsed
  items.
- **OpenAPI snapshot drift check** (CI, `check-deploy-drift.sh` spirit) so the snapshot cannot go
  stale silently.
- How DOCS-04 is implemented (FastAPI `docs_url`/`openapi_url` config vs a gate), as long as local
  stays open and the canvas-aware schema hook keeps working.
- Plan split, within G-8's 4-plan target.

### Deferred Ideas (OUT OF SCOPE)
- **The 12 missing guide clips** the IA marks `clip` (6 of 18 exist) — later video work; their slots show nothing until made.
- **Documentary eps. 2-5** — run beside the phase per `276-VIDEO-QUEUE.md`; embedded when they exist, never a 276 blocker.
- **Retiring `/knowledge-health/*`** — only after `frontend/src/lib/api/knowledge.ts` stops calling it.
- **Public operator API reference** — revisit if self-hosters ask to read it before installing.
- **AI search over the docs** ("ask the docs") — not in this phase; local search only.
- **Third-party API access** (keys, webhooks, rate limits) — SEED-013 / SEED-345, v4.6 Open Platform.
- **Light-background logo variant** — not made yet (`docs/brand/README.md`).
- Reviewed Todos (not folded): `spike-nl-workflow-authoring.md` — unrelated to public docs.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DOCS-01 | `/docs` on the landing domain in sketch-276-B look, desktop + phone | §Routing (dev middleware, `vercel.json`, nginx), §Pattern 1-3, §Pitfalls 1-4, §Landing bundle fence extension |
| DOCS-02 | Every inventory item has a page; a gate fails when a new page/tool/step/endpoint has none | §Coverage gate design (sources, keys, floors, planted-defect test, hook + CI) |
| DOCS-03 | "Syrel API" reference from OpenAPI, internal ops hidden, auth/orgs/streaming/errors concepts | §OpenAPI pipeline (snapshot export, drift test, public filter, Scalar config) |
| DOCS-04 | Prod: `/docs` `/redoc` `/openapi.json` need sign-in; local open | §DOCS-04 design (`docs_url=None` + request-time gated router), §Pitfall 7 (ENVIRONMENT unset on Coolify) |
| DOCS-05 | Changelog generated from `docs/history/`, unreleased labelled | §Changelog generation (header-line parse, `**Shipped:**` → released flag) |
| DOCS-06 | Remotion Player + clips + NotebookLM explainers; landing says Syrel | §Remotion Player embedding, §Landing promo, §Rename + logo pass |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

- **No LangChain/LangGraph**; Pydantic for structured LLM output (not relevant here, no LLM calls).
- **Backend unit baseline gate (MANDATORY):** `pytest tests/unit -q --continue-on-collection-errors` in `backend/` via venv; ceiling **71 failed, 3497 passed** — zero headroom. New backend tests must pass.
- **Frontend typecheck:** `npx tsc -p tsconfig.app.json --noEmit`, measured as a **set diff** (never `npx tsc --noEmit`, which checks zero files). **Measured today: 70 errors at base** (CLAUDE.md said 67 — it rotted; re-derive, do not quote).
- **Vitest count gate:** `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from repo root; contract = no per-file decrease + 0 failing. New suites need **both** knobs (TARGETS runs it, BASELINE guards it). `src/landing` is already a directory TARGET; **`src/docs` is not** — add it.
- **G-5 hot-file ledger:** `node scripts/check-hot-file-ledger.cjs 276` after PLAN.md files exist; disposition cell ≤ 200 chars; row in CLAUDE.md table + section in `docs/HOT-FILE-LEDGER.md` **same commit**. `backend/app/main.py` FIRES (84/61/952).
- **G-8:** 4 plans target; run targeted suites per task, full gates once per wave. Never cut verifier, TDD RED, security review.
- **Worktrees enabled:** bootstrap each worktree; it junctions ONLY `backend/venv` and `frontend/node_modules` (measured in `scripts/bootstrap-worktree.sh:105-106`). **`video/node_modules` is NOT junctioned** — see Pitfall 5. Never `rm -rf` a worktree.
- **Deployment-artifact parity (same commit):** any change to an env var's meaning, `docker-compose.prod.yml`, or bundled service updates `deploy/onebox.env.example`, `docs/OPERATOR.md`, compose, and passes `scripts/check-deploy-drift.sh`.
- **Never push to `master`/`production` without operator "deploy".** Cloud config (Coolify env, Vercel project settings) is a non-code half and must be listed.
- **Correction convention:** reversed decisions are struck through with the reason beside them (applies to the `main.py` comment and to stale figures).
- **Gates derive scan sets from code and refuse zero-item passes** (`check-hot-file-ledger.cjs` `MIN_SCAN_ROWS`, `check-landing-drift.cjs` exit 2 on empty extraction).
- **Provider-docs-first / Extension Contract:** not engaged (no provider or engine change). The closed core (7 step types, 1 emitter, `_TOOL_REGISTRY`) is only READ by the coverage gate.
- **Supabase MCP writes approval-gated** — this phase has no migration and needs none.
- **Docker is denied to the Bash tool** (settings deny rule) — onebox image build cannot be run by an agent; use `docker compose config` via `check-deploy-drift.sh` + operator.
- **Project skills:** `remotion-best-practices` (Player: `remotion-saas/player.md`), `motion-design`, `sketch-findings-agentic-rag` (icon convention, landing tokens).

## Summary

The phase is three independent build tracks that meet at the docs entry: (1) a **third Vite entry** (`frontend/docs.html` → `src/docs/`) that reuses the landing's `Navigation`, `LandingFooter` and `landing.css`, fed at build time by a Vite plugin that reads `docs/public/**/*.md` + `docs/history/v*.md` and emits a page manifest, per-page lazy bodies, a changelog model and a serialized **MiniSearch** index; (2) a **backend change** to `main.py` that turns off FastAPI's built-in doc routes and re-adds them as a request-time-gated router (open unless `ENVIRONMENT` is production), plus a deterministic OpenAPI snapshot export with a unit-level drift test; (3) **video + brand**: frontend imports compositions from `video/src` through a Vite alias and renders them in a lazily-imported `@remotion/player`, the landing hero lazy-mounts `SyrelPromo` muted on intersection, and the Iris logo replaces five placeholders.

Four measured findings change the plan from what CONTEXT assumed. **(a)** `BrandedEpisode`, `SyrelPromo`, `FeatureClip`/clips, the vertical cut and the `clip-*.wav` voice files **already exist but are UNCOMMITTED** (`git status`: `?? video/src/episodes/`, `?? video/src/promo/`, `?? video/src/clips/`, `?? video/public/vo/clip-*.wav`, `M video/src/Root.tsx`). Worktrees check out tracked files only, so this WIP must be committed before any wave starts. **(b)** `SyrelOverview` has **no audio** — the narrated composition is `SyrelEnergetic` (`vo/beat-1..7.wav`); D-10's "narrated overview" names the silent one. **(c)** The onebox frontend image builds with `context: ./frontend` (`docker-compose.prod.yml:24`) and Vercel builds with root directory `frontend/`; anything importing `../docs/public` or `../video/src` **breaks both builds** unless the compose context moves to the repo root and the Vercel "include files outside the root directory" setting is on. **(d)** `scripts/check-landing-drift.cjs` is **RED at base** (`BUILTIN_TOOL_COUNT` facts 29 vs `_TOOL_REGISTRY` 30 since 273's `show_artifact`), and its PostToolUse hook fires on every `src/landing` edit — every landing task in this phase will see it trip.

**Primary recommendation:** 4 plans in 2 waves — W1: `276-01` backend/OpenAPI (DOCS-04 + snapshot drift), `276-02` docs shell + pipeline + routing + public-spec filter; W2: `276-03` video + brand + landing (DOCS-06, D-14, G4-2), `276-04` content + coverage gate (DOCS-02, page content). Pre-flight before W1: commit the `video/` WIP. G-4 drives at `/gsd:verify-work`.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| `/docs/*` routing (deep link + refresh) | CDN / Static (Vercel rewrites, nginx `try_files`) | Browser (History-API router in `src/docs`) | Server must answer `docs.html` for any `/docs/*`; the client picks the page |
| Markdown → pages, manifest, changelog, search index | Build (Vite plugin, Node) | Browser (render + MiniSearch query) | D-08: build-time index, no server |
| Docs rendering (home, article, stub, changelog) | Browser / Client | — | Static SPA entry; no backend calls |
| Public API reference | Build (filter script → static JSON) | Browser (lazy Scalar) | Never calls a live backend (IA plan) |
| Live `/docs` `/redoc` `/openapi.json` gating | API / Backend (FastAPI) | — | Auth decision belongs to the API tier; uses existing `get_current_user` |
| OpenAPI snapshot freshness | Backend tests (pytest unit) | CI | Generated from code; drift caught in the mandatory gate |
| Coverage gate | Repo tooling (Node script + hook + CI) | — | Reads code + content, not runtime |
| Remotion Player clips / promo | Browser (lazy chunk) | CDN / Static (`/vo/*.wav` assets) | D-11 live Player; `staticFile()` resolves to `/` in the Player |
| YouTube explainers | Browser (click-to-load facade) | Third party (youtube-nocookie) | D-12: no request before click; poster self-hosted |
| Logo / favicon | CDN / Static (`public/`) | Browser components | Asset swap, no logic |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-markdown | ^10.1.0 (installed) | Render page Markdown | Already a frontend dep; raw HTML off by default (safe) [VERIFIED: frontend/package.json] |
| remark-gfm | ^4.0.1 (installed) | Tables/lists/task lists in pages | Already a dep [VERIFIED: frontend/package.json] |
| yaml | 2.9.1 (installed transitively; add as explicit dep) | Parse frontmatter at build time (Node) | Already in `node_modules`; make it explicit so a lockfile prune can't drop it [VERIFIED: frontend/node_modules] |
| minisearch | 7.2.0 | Build-time index → `JSON.stringify(ms)`, browser `MiniSearch.loadJSON(json, sameOptions)` | Zero deps, MIT, documented serialize/deserialize [CITED: lucaong.github.io/minisearch/classes/MiniSearch.MiniSearch.html] [ASSUMED package choice — see audit] |
| @remotion/player | 4.0.532 (exact) | Live Player for compositions | Depends on `remotion` **exactly 4.0.532** — must match `video/`'s pin [VERIFIED: npm view @remotion/player@4.0.532 dependencies] |
| remotion, @remotion/transitions, @remotion/media, @remotion/google-fonts | 4.0.532 (exact) | Imported by `video/src` compositions; must resolve from `frontend/node_modules` (dedupe) | Same-version rule across `@remotion/*` [VERIFIED: video/package.json + npm view] |
| mediabunny | 1.56.1 (exact, match video) | Transitive need of `@remotion/media` `<Audio>/<Video>` | Pinned in `video/package.json` [VERIFIED: video/package.json] |
| @scalar/api-reference-react | 0.9.77 | API reference renderer (lazy chunk) | MIT, peer React ^18 \|\| ^19 [VERIFIED: npm view peerDependencies] |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| fastapi.openapi.docs (`get_swagger_ui_html`, `get_redoc_html`, `get_swagger_ui_oauth2_redirect_html`) | FastAPI 0.115.6 (installed) | Re-create doc routes behind a gate | DOCS-04 [VERIFIED: venv `fastapi.__version__`; source of `FastAPI.setup`] |
| ffmpeg | 8.1.1 (on PATH) | Optional: re-encode `clip-*.wav` for web | Only if audio size matters [VERIFIED: `ffmpeg -version`] |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| MiniSearch | Pagefind | Pagefind indexes built **HTML**; this SPA has no per-page static HTML → would need prerender. Rejected |
| MiniSearch | FlexSearch 0.8 | Faster, but export/import is multi-key async; heavier API for a ~120-page corpus |
| MiniSearch | Fuse.js | No serializable inverted index; fuzzy scan over all docs at query time |
| Scalar | Redoc (`redoc` 2.5.4) | Needs `styled-components` + `mobx` + `core-js` peers in the bundle; or `@redocly/cli build-docs` static HTML that won't wear the Deep Midnight shell. Keep as fallback |
| Hand-written History router | react-router | One flat slug map; adding a router library to a 3-view entry is heavier than ~40 lines. The app itself has no router (memory `reference_app_has_no_router`) |
| Pre-rendered MP4 | Player | Locked by D-11 |

**Installation (one plan, one time — see Pitfall 6):**
```bash
cd frontend
npm install --save-exact @remotion/player@4.0.532 remotion@4.0.532 @remotion/transitions@4.0.532 @remotion/media@4.0.532 @remotion/google-fonts@4.0.532 mediabunny@1.56.1
npm install minisearch@7.2.0 @scalar/api-reference-react@0.9.77 yaml@2.9.1
```

**Version verification (run 2026-10-04):** `@remotion/player` 4.0.532 (2026-10-01), `remotion` 4.0.532, `@scalar/api-reference-react` 0.9.77 (2026-10-02), `@scalar/api-reference` 1.72.4, `minisearch` 7.2.0 (2025-09-16), `yaml` 2.9.1. `video/node_modules/remotion` = 4.0.532 (matches).

## Package Legitimacy Audit

slopcheck was **not run** in this session (not installed; the Package Legitimacy Gate requires install + run). All new packages are therefore tagged `[ASSUMED]` and the planner must gate the install task behind `checkpoint:human-verify`.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| @remotion/player | npm | years (v4.0.532) | not measured | github.com/remotion-dev/remotion | not run | [ASSUMED] — already present in `video/node_modules` as a studio dep |
| remotion / @remotion/transitions / @remotion/media / @remotion/google-fonts | npm | years | not measured | github.com/remotion-dev/remotion | not run | [ASSUMED] — already used by `video/` |
| mediabunny | npm | — | not measured | — | not run | [ASSUMED] — already pinned by `video/` |
| minisearch | npm | years (7.2.0) | not measured | github.com/lucaong/minisearch | not run | [ASSUMED] |
| @scalar/api-reference-react | npm | — (0.9.x) | not measured | github.com/scalar/scalar | not run | [ASSUMED] — pulls **Vue 3 + ~25 @scalar/* deps (47.9 MB unpacked for `@scalar/api-reference`)** |
| yaml | npm | years | not measured | github.com/eemeli/yaml | not run | [ASSUMED] — already in node_modules transitively |

**Packages removed due to slopcheck [SLOP] verdict:** none (not run)
**Packages flagged as suspicious [SUS]:** none (not run) — all gated by human-verify.
**postinstall scripts:** not checked (`npm view <pkg> scripts.postinstall` owed in the install task).

## Architecture Patterns

### System Architecture Diagram

```
                       ┌──────────────────── BUILD (vite build / vite dev) ─────────────────────┐
docs/public/**/*.md ──►│ docsContent plugin (Node)                                               │
docs/history/v*.md ───►│  ├─ scripts/lib/docs-content.cjs: parse frontmatter (yaml), validate    │
docs/public/api/       │  ├─ virtual:docs-manifest  (slug,title,section,status,release,video,…) │
 openapi.snapshot.json►│  ├─ per-page body chunks (lazy import per slug)                         │
   │                   │  ├─ changelog model (version, name, shipped|in-progress, one-liner,…)   │
   ▼                   │  └─ search-index.json (MiniSearch serialized, fetched lazily)           │
scripts/build-public-  └─────────────────────────────────────────────────────────────────────────┘
 openapi.cjs ─► docs/public/api/openapi.public.json (committed, --check in CI)

REQUEST  https://<apex>/docs/use/chat
   │ Vercel: redirects → FILESYSTEM (no file) → rewrites: /docs/(.*) → /docs.html
   │ dev:    appRoutingPlugin: /docs* (no dot) → /docs.html   (everything else non-root → /app.html)
   │ onebox: nginx location /docs { try_files $uri /docs.html; }
   ▼
docs.html → src/docs/main.tsx → DocsApp
   ├─ router(pathname) ─► Home | Article(slug) | Stub(slug) | Changelog[/vX.Y] | ApiReference | NotFound
   ├─ Navigation + LandingFooter (from src/landing) + landing.css + docs.css
   ├─ SearchBox ── on focus: fetch search-index.json → MiniSearch.loadJSON → results
   ├─ VideoSlot(id) ── registry lookup:
   │     remotion → IntersectionObserver → import('@remotion/player') + import('@video/…') → <Player>
   │     youtube  → self-hosted poster → click → <iframe youtube-nocookie.com/embed/ID>
   │     none     → render nothing
   └─ ApiReference ── import('@scalar/api-reference-react') → reads /docs-assets/openapi.public.json

LANDING  index.html → src/landing/main.tsx (NO remotion/scalar/docs in static graph)
   └─ HeroSection ── IntersectionObserver ── import('./HeroPromo') ── <Player SyrelPromo muted, AudioOn=false>

BACKEND  GET /docs | /redoc | /openapi.json
   └─ api_docs router ── require_api_docs_access: ENVIRONMENT∈{production,prod}? → bearer → get_current_user
                         └─ /openapi.json returns request.app.openapi()  (canvas-aware hook preserved)
```

### Recommended Project Structure
```
frontend/
├── docs.html                       # third entry (mirrors app.html shape)
├── devRouting.ts                   # pure rewrite fn used by vite.config + unit-tested
├── plugins/docsContent.ts          # Vite plugin: virtual:docs-manifest, page chunks, search index, changelog, asset copy
├── src/docs/
│   ├── main.tsx  DocsApp.tsx  router.ts
│   ├── docs.css                    # .prose, bento, TOC pill, drawer — Deep Midnight tokens from landing.css
│   ├── pages/  Home.tsx Article.tsx Stub.tsx Changelog.tsx ApiReference.tsx NotFound.tsx
│   ├── components/ SearchBox.tsx TocPill.tsx SectionDrawer.tsx ReleaseBadge.tsx Markdown.tsx
│   ├── video/  VideoSlot.tsx registry.ts RemotionSlot.tsx YouTubeFacade.tsx
│   └── __tests__/ (routing, fence, search, stub, changelog, coverage-gate planted defect)
scripts/
├── lib/docs-content.cjs            # ONE frontmatter/manifest/changelog parser (plugin + gate share it)
├── build-public-openapi.cjs        # snapshot → openapi.public.json (+ --check)
├── check-docs-coverage.cjs         # DOCS-02 gate (exit 0/1/2)
└── export-openapi.py               # deterministic snapshot export (backend venv)
backend/app/api/api_docs.py         # gated /docs /redoc /openapi.json router (new; row at creation)
docs/public/<section>/<slug>.md     # content (D-02)
docs/public/README.md               # frontmatter contract (synced with docs-content.cjs, same commit)
```

### Pattern 1: Docs routing in three places (dev, Vercel, onebox)
**What:** `/docs` and `/docs/<slug>` must reach `docs.html` everywhere the landing is served.
**Dev/preview** — extract today's rewrite into a pure function so it can be tested:
```ts
// frontend/devRouting.ts  (imported by vite.config.ts appRoutingPlugin)
export function rewriteDevUrl(rawUrl: string): string {
  const [pathname, ...q] = (rawUrl || "/").split("?")
  const search = q.length ? "?" + q.join("?") : ""
  const isInternal = pathname.includes(".") || /^\/(@|__|src|node_modules)/.test(pathname)
  if (pathname === "/" || isInternal) return rawUrl
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return "/docs.html" + search   // NEW — must precede the app.html rule
  return "/app.html" + search
}
```
**Vercel** (`frontend/vercel.json`) — append to `rewrites` **after** the host-scoped `app\.(.*)` rule (rewrites are ordered; the app host keeps its catch-all) and **without** `cleanUrls` (not set today):
```json
{ "source": "/docs", "destination": "/docs.html" },
{ "source": "/docs/(.*)", "destination": "/docs.html" }
```
Filesystem precedence (memory `reference_vercel_filesystem_precedes_rewrites`, Vercel docs) means static files under `/docs/…` (if any) win before the rewrite — keep docs assets under `/docs-assets/` to avoid any ambiguity. `middleware.ts` matcher is `'/'` only and is untouched.
**Onebox nginx** — add before `location /`:
```nginx
location = /docs { try_files /docs.html =404; }
location /docs/  { try_files $uri /docs.html; }
```
**Example source:** existing `appRoutingPlugin` in `frontend/vite.config.ts`; `vercel.json`.

### Pattern 2: Build-time content plugin (one parser, two consumers)
**What:** `scripts/lib/docs-content.cjs` exports `parsePage(text, relPath)`, `loadAllPages(root)`, `parseHistory(root)`, `buildSearchDocs(pages, changelog)`; the Vite plugin and `check-docs-coverage.cjs` both import it (memory: "one home per concern").
**Frontmatter contract (proposed, lives in `docs/public/README.md`):**
```yaml
---
title: Chatting with Syrel
slug: use/chat              # MUST equal path under docs/public without .md (gate enforces)
section: use
audience: user              # user | admin | operator | developer
status: written             # written | stub
release: shipped            # shipped | v4.5   (v4.5 → "Not yet released" badge, everywhere)
covers: [A5, A9, nav:chat]  # inventory IDs and/or code keys (see gate)
summary: >-                 # REQUIRED for stubs (2-3 sentences, D-07); used as search snippet
  …
nearest: use/chat-modes     # REQUIRED for stubs: a written page (gate checks it exists + is written)
video: clip:chat            # registry id or omitted
---
```
**Plugin shape:** `resolveId('virtual:docs-manifest')` → `load()` returns `export const pages = [...]; export const load = { "use/chat": () => import("/@docs-page/use/chat") }` (or `import.meta.glob('../docs/public/**/*.md', { query: '?raw', import: 'default' })` + the parsed manifest). Emit `search-index.json` with `this.emitFile({ type: 'asset' })` in `generateBundle`; serve it from a dev middleware. Register the same plugin in `vitest.config.ts` or keep tests on the pure `docs-content.cjs` functions.

### Pattern 3: Lazy Remotion Player (docs slots and landing hero)
**What:** Neither `@remotion/player` nor any `@video/*` module may be in a static import graph of `landing/main.tsx` or `docs/main.tsx`.
```tsx
// src/docs/video/RemotionSlot.tsx — mounted by VideoSlot only after intersection
import { lazy, Suspense, useCallback } from "react"
const PlayerLazy = lazy(() => import("@remotion/player").then(m => ({ default: m.Player })))
export function RemotionSlot({ entry }: { entry: RemotionEntry }) {
  const lazyComponent = useCallback(() => entry.load(), [entry])          // () => import("@video/clips/FeatureClip").then(m => ({ default: m.FeatureClip }))
  return (
    <Suspense fallback={<div className="vslot-poster" />}>
      <PlayerLazy lazyComponent={lazyComponent} inputProps={entry.inputProps}
        durationInFrames={entry.durationInFrames} compositionWidth={1920} compositionHeight={1080} fps={30}
        controls acknowledgeRemotionLicense style={{ width: "100%", aspectRatio: "16 / 9" }} />
    </Suspense>
  )
}
```
`lazyComponent` must be memoised with `useCallback` [CITED: remotion.dev/docs/player/player]. `durationInFrames` comes from the composition module's exported constants (`clipDuration(id)`, `OVERVIEW_DURATION`, `PROMO_DURATION`) — import those numbers lazily too, or store them in the registry as literals checked by a test against `video/src`.
**Landing hero (D-10, G4-2):** IntersectionObserver → `import("./HeroPromo")` → `<Player autoPlay loop initiallyMuted … />` wrapped in `<AudioOn.Provider value={false}>` (the context already exists in `video/src/energetic/kit.tsx:23`). Pause on leave; with `prefers-reduced-motion: reduce` do **not** autoplay — show a still + play button.

### Pattern 4: DOCS-04 — request-time gated doc routes
**What:** Construct FastAPI with the built-ins off, re-add the three routes via a new router whose dependency is a no-op unless production.
```python
# backend/app/main.py
app = FastAPI(title="Agentic RAG API", version="1.0.0", lifespan=lifespan,
              docs_url=None, redoc_url=None, openapi_url=None)   # 276 / DOCS-04 — re-added, gated, by api_docs.router
app.openapi = build_canvas_aware_openapi(app)                    # unchanged — FastAPI.openapi() ignores openapi_url
...
app.include_router(api_docs.router)

# backend/app/api/api_docs.py
_bearer_optional = HTTPBearer(auto_error=False)
def _docs_gated() -> bool:
    return (settings.environment or "").strip().lower() in ("production", "prod")
async def require_api_docs_access(creds = Depends(_bearer_optional), supabase = Depends(get_supabase)):
    if not _docs_gated():
        return None                                    # local / unset: open, byte-identical to today
    if creds is None:
        raise HTTPException(401, "Sign in to view the API reference.", headers={"WWW-Authenticate": "Bearer"})
    return await get_current_user(credentials=creds, supabase=supabase)   # 401 bad token · 503 auth unreachable · 403 banned
router = APIRouter(dependencies=[Depends(require_api_docs_access)], include_in_schema=False)
@router.get("/openapi.json") async def openapi_json(request: Request): return JSONResponse(request.app.openapi())
@router.get("/docs") ...  get_swagger_ui_html(openapi_url="/openapi.json", title=..., oauth2_redirect_url="/docs/oauth2-redirect")
@router.get("/docs/oauth2-redirect") ... get_swagger_ui_oauth2_redirect_html()
@router.get("/redoc") ... get_redoc_html(openapi_url="/openapi.json", title=...)
```
Why this shape: `FastAPI.setup()` only registers the built-ins when `openapi_url`/`docs_url` are truthy, and `FastAPI.openapi()` generates regardless of `openapi_url` [VERIFIED: venv source of `FastAPI.setup` / `FastAPI.openapi`] — so the export script and the canvas hook keep working. The decision is made **per request** from `settings.environment`, so tests can monkeypatch it without re-importing `main`. `CanvasGateMiddleware` keys on the **path** `/openapi.json` (`_SCHEMA_PATH`, `canvas_gate.py:136`), so its flag refresh still fires (`test_184 …test_schema_path_bounds_the_flag`). This is the documented FastAPI pattern of `docs_url=None` + own routes [CITED: fastapi.tiangolo.com/how-to/custom-docs-ui-assets/ — ASSUMED page title].
**Note:** the default `HTTPBearer()` in 0.115.6 returns **403 "Not authenticated"** for a missing header [VERIFIED: venv source]; the optional bearer + explicit 401 gives the honest code.

### Anti-Patterns to Avoid
- **Deciding the gate at import time** (`docs_url=None if prod else "/docs"`): untestable without re-import; the env read happens once; mirrors nothing in this codebase.
- **Eager `import { Player } from "@remotion/player"` anywhere under `src/landing`** — silently passes today's fence (it only forbids supabase + app paths) and ships Remotion on first paint.
- **Loading YouTube thumbnails from `i.ytimg.com`** — a third-party request before the reader asks (violates D-12). Posters are self-hosted.
- **Building the search index in the browser** over all page bodies — fetches ~120 pages to search; violates D-08's build-time intent.
- **Copying `video/public/vo/*.wav` into `frontend/public/`** — two homes, drift. Serve/copy from `video/public` in the plugin.
- **Wiring the coverage gate into `vite build`** — a backend tool addition would then break Vercel and onebox frontend deploys. Gate = hook + CI (CONTEXT discretion).
- **Inlining the brand SVGs twice on one page** — both files use `id="g"`/`id="h"` gradients; duplicates collide (Pitfall 9).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search | Custom inverted index | MiniSearch `toJSON`/`loadJSON` | Prefix + fuzzy + field boosts, serialization solved |
| Markdown parsing | Regex → HTML | react-markdown + remark-gfm | Safe by default (no raw HTML), GFM tables |
| YAML frontmatter | Line-splitting "key: value" | `yaml` package (Node side only) | Folded scalars, lists, quoting |
| API reference UI | Endpoint tables from JSON | Scalar (lazy) | Schemas, examples, tag groups |
| Swagger/ReDoc HTML | Own HTML shells | `fastapi.openapi.docs` helpers | Same output as the built-ins (byte-near-identical locally) |
| Video playback | `<video>` of pre-rendered MP4 | `@remotion/player` (D-11) | Locked |
| `$ref` pruning after path drops | Ad-hoc | Port the closure from `canvas_gate.py` (`_collect_refs` / `_closure`) into the filter script | Already-proven algorithm; keeps surviving siblings' refs |
| OpenAPI generation for the snapshot | Hand-maintained JSON | `FastAPI.openapi(app)` (class method, bypasses the canvas hook) | Deterministic; measured equal to today's snapshot |

**Key insight:** every hand-typed list in this phase rots (the IA already says "25 history files" — measured 27; CLAUDE.md said 67 TS errors — measured 70). Derive from code; validate small explicit lists (e.g. v4.5 operations) against the spec so a stale entry fails.

## Runtime State Inventory

> Not a rename-of-identifiers phase (code identifiers stay "Agentic RAG"), but the landing rename + logo pass + env-flag reinterpretation touch runtime state.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — no DB rows carry the product name or docs state (no migration in this phase). | None |
| Live service config | **Coolify backend env:** whether `ENVIRONMENT=production` is set is **unverified** (onebox example sets it at `deploy/onebox.env.example:159`; nothing in repo proves Coolify does). **Vercel project setting** "Include source files outside of the Root Directory in the Build Step" — unverified. | Operator verifies both before the prod promotion; add to parity checklist |
| OS-registered state | None — verified no scheduled tasks/services reference docs or brand. | None |
| Secrets/env vars | `ENVIRONMENT` changes **meaning** (was "deploy marker only", now also gates API docs). Name unchanged. | Code edit + comment update in `deploy/onebox.env.example:157-159` and `docs/OPERATOR.md:103` (same commit — parity rule) |
| Build artifacts | Browser caches of `favicon.svg` (aggressively cached by browsers); Vercel CDN cache of `index.html`. `video/out/*.mp4` stale renders (gitignored). | None required; note favicon may lag in operator's browser during G-4 |

## Coverage Gate Design (DOCS-02)

**File:** `scripts/check-docs-coverage.cjs` · exit `0` clear · `1` uncovered/invalid · `2` harness error (any source parses below its floor, any required file missing) — same contract as `check-landing-drift.cjs` / `check-hot-file-ledger.cjs`.

### Scan set — derived from code (regex extractors; each refuses its floor)
| Key prefix | Source (measured) | Parse strategy | Count today | Floor |
|---|---|---|---|---|
| `nav:<view>` | `frontend/src/lib/nav-items.ts` `NAV_ITEMS` | block `export const NAV_ITEMS…= [ … ]`, then `view:\s*"([^"]+)"` | 7 | 5 |
| `view:<member>` | `frontend/src/App.tsx:129` `export type ActiveView = "…" \| …` | one-line union, `"([^"]+)"` | 12 | 8 |
| `tool:<name>` | `backend/app/services/tool_dispatcher.py:4542` `_TOOL_REGISTRY: dict[str, Callable] = { … \n}` | reuse `check-landing-drift.cjs:153` regex | 30 | 25 |
| `step:<type>` | `backend/app/services/harness/phase_types.py:2928` `PHASE_TYPE_REGISTRY_ENTRIES: dict = { … }` | block then `"([a-z_]+)":` | 7 | 7 (closed core) |
| `check:<kind>` | `@register_validator("kind")` across `backend/app/services/harness/*.py` | `readdirSync` the dir, global regex | 10 | 8 |
| `router:<module>` | `backend/app/main.py` `app.include_router(<module>.<attr>…)` | `/app\.include_router\((\w+)\.(\w+)/g`; dedupe module (the `/api` sources alias + `router_evals`/`public_router`/`workflow_router` collapse to module) | 38 modules / 43 calls | 30 |
| `settings-tab:<slug>` | `frontend/src/pages/SettingsPage.tsx:1152-1167` `<TabsTrigger …>Label</TabsTrigger>` | reuse landing-drift §7c (map `{retrievalTabLabel}` → `search`) | 5 | 3 |
| `inventory:<ID>` | `.planning/research/docs-coverage-inventory.md` table rows `^\| ([A-I]\d+) \|` | line regex | 261 | 250 |
| (optional) `library-tab:`, `control-room-tab:`, `org-admin-tab:` | already extracted by `check-landing-drift.cjs` §7 | copy extractors | 5 / 5 / 8 | — |

Pages: `loadAllPages('docs/public')` via `scripts/lib/docs-content.cjs` (floor: ≥ 100 pages once content lands; ≥ 1 during W1 fixture testing via `--root`).

### Checks
1. **`[uncovered] <key>`** — every code key and every inventory ID appears in at least one page's `covers:` (stub counts, D-07). Explicit exclusion list in the script, each with a reason string: `I20` (internal hosted pipeline, "not public by decision").
2. **`[stale-cover] <slug>: <key>`** — a `covers:` entry matching no code key and no inventory ID (catches a removed tool still documented).
3. **`[bad-frontmatter]`** — missing required key; `slug` ≠ path; `status` ∉ {written, stub}; `release` ∉ {shipped, v4.5}; stub missing `summary`/`nearest`; `nearest` not a written page.
4. **`[release-mismatch]`** — inventory row status `v4.5` but covering page `release: shipped` (keeps G4-3 honest mechanically).
5. Prints `N code keys · M inventory IDs · P pages (W written / S stubs)` so a pass is auditable.

### Endpoint-level coverage (DOCS-02 "endpoint") — layered, not duplicated
- New endpoint → `test_276_openapi_snapshot_fresh.py` fails until `scripts/export-openapi.py` regenerates the snapshot → `build-public-openapi.cjs --check` fails until the public JSON is regenerated → the endpoint renders in the generated reference (covered) **or** is in the hidden set, which `api/internal-endpoints.md` must list (`covers: [H16, H17, H25, H40]` + `op:` keys optional). New router module → `router:` key uncovered → gate fails.

### Planted-defect test (drive it RED)
`frontend/src/docs/__tests__/docsCoverageGate.test.ts` with `// @vitest-environment node`: copy the 8 source files + a 3-page fixture tree into a temp dir; run `node scripts/check-docs-coverage.cjs --root <tmp>` via `child_process.spawnSync`:
- baseline fixture → exit 0;
- append `"planted_tool": _handle_x,` inside the copied `_TOOL_REGISTRY` → exit 1, stdout contains `[uncovered] tool:planted_tool`;
- append `app.include_router(planted.router)` → exit 1, `[uncovered] router:planted`;
- empty the copied registry block → exit 2 (floor);
- delete all fixture pages → exit 2.
Temp copies mean the real tree is never mutated (cleaner than the md5-restore precedent).

### Wiring (local primary, CI backstop)
- `.claude/hooks/docs-coverage-guard.js` — clone of `landing-drift-guard.js`: trigger basenames `tool_dispatcher.py`, `phase_types.py`, `validator_kinds.py`, `validators.py`, `main.py`, `nav-items.ts`, `App.tsx`, `SettingsPage.tsx`, `check-docs-coverage.cjs`, `docs-content.cjs`, or any path containing `docs/public/`; silent when clean.
- `.claude/settings.json` — one PostToolUse entry (FIRES row exists: `9/4/202`; `.claude/` is gate-exempt so record the touch in the ledger section manually).
- `.github/workflows/docs-coverage.yml` — clone of `landing-drift.yml` with the same path list + `docs/public/**`, `.planning/research/docs-coverage-inventory.md`.

## OpenAPI Pipeline (DOCS-03)

1. **Snapshot export** — `scripts/export-openapi.py` (run with `backend/venv`): `from fastapi import FastAPI; doc = FastAPI.openapi(app)` (class method → full, unfiltered, **independent of the live canvas flag and the DB**); drop `/__test__` paths if present; `json.dump(doc, f, indent=1)`. **Measured 2026-10-04:** this equals the committed `docs/public/api/openapi.snapshot.json` exactly (231 paths, 282 ops, 216 schemas, OpenAPI 3.1.0). The inventory's original command called the instance `app.openapi()` (canvas-aware hook) — on a cold settings read it fails CLOSED and would export a filtered doc. Do not reuse it.
2. **Drift test** — `backend/tests/unit/test_276_openapi_snapshot_fresh.py`: same generation + normalization, `assert doc == json.load(snapshot)`, failure message names the regen command. Rides the mandatory backend gate (local-primary), which is stronger than a CI-only check (backend CI "has never been green" — memory `reference_backend_tests_ci_has_never_been_green`).
3. **Public filter** — `scripts/build-public-openapi.cjs` (Node, no deps) writes `docs/public/api/openapi.public.json` (committed, reviewable):
   - `info.title = "Syrel API"`, `info.version` = milestone (e.g. `4.4`), `info.description` stating "no API keys, PATs or service accounts exist; a script authenticates as a signed-in user; planned: SEED-013";
   - drop: `/admin/*` (all 22 paths, D-16), `/setup/*`, `/public-config`, `/connectors/oauth/callback`, `/connectors/mcp/oauth/callback`, `/evals/*`, `/api/sources/*` alias, `/__test__/*`;
   - flag (`x-badges` / description prefix "UI-internal: may change"): `/workflows/grounding-bundle`, `/workflows/validate`, `/threads/{thread_id}/snapshot`, `/threads/expert-scope-preview`, `/library/index-summary`, `/knowledge-health/*` (D-17);
   - `x-badges: Not yet released` for an explicit `V45_OPERATIONS` list (`POST /document-search`, `POST /documents/{document_id}/download-url` — confirm exact templates against the snapshot); the script **fails** if a listed op is absent (stale list cannot pass silently);
   - add `x-tagGroups` (IA "Grouping" row), an `X-Org-Id` header parameter component;
   - prune orphan `components.schemas` via transitive `$ref` closure (port of `canvas_gate.py`);
   - `--check` mode: regenerate in memory, diff against the committed file, exit 1 on drift.
4. **Renderer** — Scalar, lazy at `/docs/api`, `configuration: { url: '/docs-assets/openapi.public.json', telemetry: false, agent: { disabled: true }, withDefaultFonts: false, hideClientButton: true, hideTestRequestButton: true, showDeveloperTools: 'never', forceDarkModeState: 'dark', hideDarkModeToggle: true, documentDownloadType: 'json', customCss: <Deep Midnight vars> }` [CITED: github.com/scalar/scalar/blob/main/documentation/configuration.md]. ⚠ Scalar's **AI agent is enabled by default on localhost** and telemetry defaults `true` — both must be explicitly off (privacy + "no AI search", D-08 deferred). Record the gzipped chunk size in the plan SUMMARY; if > ~1 MB gz, evaluate the Redoc fallback (CONTEXT discretion).

## DOCS-04 Details

- **Production flag:** `settings.environment` (`backend/app/config.py:1218`, env `ENVIRONMENT`), already used by the `ENABLE_TEST_FIXTURES`/`MOCK_LLM_MODE` refuse-to-start guards (`main.py:922,941`, via `os.getenv`). Values `production`/`prod` gate.
- **Fail mode is OPEN when unset** — local, CI and an unconfigured prod all read `""`. Mitigations: (1) log once at startup `API docs: GATED (ENVIRONMENT=production)` / `OPEN (ENVIRONMENT='')`; (2) parity-checklist line "Coolify backend has `ENVIRONMENT=production`"; (3) live check after deploy: `curl -s -o /dev/null -w '%{http_code}' https://<api-host>/docs` → `401`.
- **Browser reality:** a browser cannot send a bearer header on address-bar navigation, so in production `/docs` and `/redoc` are effectively reachable only by header-injecting clients; `curl -H "Authorization: Bearer $TOKEN" …/openapi.json` is the usable path. See Open Question 3.
- **Tests (`backend/tests/unit/test_276_api_docs_gate.py`, `client` fixture, imports inside test bodies per repo convention):** unset env → `/docs` `/redoc` `/openapi.json` 200 and `/docs/oauth2-redirect` 200; `monkeypatch.setattr(settings, "environment", "production")` → all three 401 without header, 401 with a bad token (stub `get_supabase`), 200 with a valid stubbed user; `/openapi.json` while gated+authed still returns the canvas-filtered doc when the flag is off (reuse `_cold_off` helper shape from `test_182`); `include_in_schema` false (the three paths absent from `FastAPI.openapi(app)["paths"]`).
- **Comment correction (D-03):** keep the 182 paragraph, strike the sentence (`~~…App-wide docs_url gating has never been a convention…~~`) and add "CORRECTED 2026-10-04 (Phase 276, D-03, operator-approved): production now refuses unauthenticated /docs, /redoc and /openapi.json; see api_docs.py."

## Remotion Player Embedding (DOCS-06)

- **Imports from `video/src`:** Vite alias `"@video": path.resolve(__dirname, "../video/src")` (and `tsconfig.app.json` `paths` `"@video/*": ["../video/src/*"]`).
- **One React, one Remotion:** `resolve.dedupe: ["react", "react-dom", "remotion", "@remotion/transitions", "@remotion/media", "@remotion/google-fonts", "@remotion/player", "mediabunny"]` — "force Vite to always resolve listed dependencies to the same copy (from project root)" [CITED: vite.dev/config/shared-options#resolve-dedupe]. Without it, files under `video/src` resolve `react` from `video/node_modules` (19.3.0) while frontend is 19.2.4 (measured) → two Reacts → hook errors; and `remotion` contexts split between Player and composition.
- **Dev file serving:** `server.fs.allow: [searchForWorkspaceRoot(process.cwd()), path.resolve(__dirname, "../video/src"), path.resolve(__dirname, "../docs")]` — there is no root `package.json`, so the default allow-list is `frontend/` only [CITED: vite.dev/config/server-options].
- **Types in a worktree:** `video/node_modules` is not junctioned; TS resolving `remotion` from `../video/src/*.tsx` walks `video/node_modules` → repo root → fails. Add `tsconfig.app.json` `paths` for `remotion`, `@remotion/*`, `mediabunny` → `./node_modules/…`. **Measured:** in the main tree (where `video/node_modules` exists) `FeatureClip.tsx`, `SyrelOverview.tsx`, `SyrelPromo.tsx` type-check with **0 errors** under frontend's strict config.
- **`staticFile()` in the Player uses `/` as prefix** [CITED: remotion.dev/docs/staticfile compatibility table] → `staticFile("vo/clip-chat.wav")` requests `/vo/clip-chat.wav` from the docs origin. The docs plugin must serve `video/public/vo/clip-*.wav` at `/vo/` in dev and copy them into `dist/vo/` at build (allow-list; ~0.3 MB each, 2.0 MB total, measured). `/vo/` is not under `/docs/`, so Vercel filesystem precedence serves it directly.
- **Audio gating:** `Sfx` and `Vo` honour `AudioOn` (`kit.tsx:23-49`); **`PromoBody`'s music `<Audio>` does NOT** (`SyrelPromo.tsx:318`) and `SyrelEnergetic` / vertical gate music only on `musicSrc`. For the muted landing hero, add an AudioOn check (or `musicSrc: null`) to `PromoBody` so the 5.9 MB `syrel-pulse.wav` and the remote SFX (`https://remotion.media/*.wav`) are never fetched.
- **Composition facts (measured):** `FeatureClip` needs `inputProps={{ id }}` and `durationInFrames={clipDuration(id)}`; `SyrelOverview` = `OVERVIEW_DURATION` frames, **no audio**; `SyrelPromo` = `PROMO_DURATION` (`MAP.trackFrames`); `SyrelPromo.tsx:4` imports `../../../frontend/src/landing/facts` (cross-tree, fine for bundling; keeps the promo's counters drift-guarded); `theme.ts` calls `@remotion/google-fonts` `loadFont()` at module top (fetches Inter/Manrope when the chunk loads — the landing already loads these from Google Fonts).
- **`BrandedEpisode`** uses `mediabunny` `Input/UrlSource(staticFile(src))` inside `calculateMetadata`; the Player does not run `calculateMetadata`. Per D-12 it is a **render-only** composition (wrap NotebookLM MP4 → render → operator uploads to YouTube); it does not need to run in the browser.
- **License:** pass `acknowledgeRemotionLicense`; record the ≤ 3-person rule in `video/README.md` (D-05).

## Changelog Generation (DOCS-05)

Each `docs/history/v*.md` (27 files, v1.0 → v4.5, measured — the IA's "25" is stale) has: line 1 `# vX.Y — Name`; line 3 `> **Shipped:** <YYYY-MM-DD …| in progress …> · **Phases:** … · …`; sections `## In one sentence`, `## What shipped`, `## How it works`, `## Status today`, `## Gaps and deferred work`, `## Video beats`, `## Sources`. `README.md` carries "The arc in five chapters" table (chapter → release range).
- `released = /^\d{4}-\d{2}-\d{2}/.test(shippedValue)`; otherwise label **"Not yet released"** (v4.5 reads `in progress (started 2026-09-29)`).
- Public output = version, name, date, one-sentence, "What shipped" bullets, chapter. **Exclude** "How it works" (file paths, migration numbers, bug IDs), "Video beats", "Sources", and the "(So far on the development branch …)" parenthetical handled by the badge.
- ⚠ Every history file says **"DRAFT — verify before publishing"**; "What shipped" can describe behaviour later reversed (README warns: global → org sharing in v3.4; Experts narrowing → additive in v4.4). The content plan must include a fact-check task that reads each "Status today" and records corrections (a small override map in `docs/public/changelog/` keyed by version, rather than editing the history source).
- Chapter strip and per-chapter documentary slot (D-10): registry entries only for uploaded YouTube IDs; today none exist → nothing renders.

## Rename + Logo One-Pass (DOCS-06, D-14)

**"Agentic RAG" in `frontend/src/landing/` (measured):** `CompareSection.tsx:42,95`, `LandingFooter.tsx:26`, `Navigation.tsx:62`, test `LandingPage.test.tsx:25` (`getAllByText(/Agentic RAG/i)` → `/Syrel/`). **Also user-visible on the landing but outside `src/landing`:** `frontend/index.html` `<title>Agentic RAG — AI Knowledge & Autonomous Workflows</title>` and `<meta name="description">`. SC#6 names `src/landing` only; the browser tab would still say Agentic RAG — include `index.html` (and set `docs.html` title "Syrel Docs").
**Guard:** `src/landing/__tests__/landingBrand.test.ts` — `readdirSync` all `.ts/.tsx/.css` under `src/landing` + `frontend/index.html`, assert zero `/Agentic RAG/` matches, refuse if the file count < 20.

**Logo insertion points (measured):**
| Site | Today | Swap to |
|---|---|---|
| `src/landing/components/Navigation.tsx:27-63` | gradient tile + layers SVG + "Agentic RAG" | static lockup (`/brand/syrel-lockup.svg` `<img alt="Syrel">`) |
| `src/landing/components/LandingFooter.tsx:26` | `© {year} Agentic RAG` | `© {year} Syrel` (+ optional mark) |
| `src/components/layout/NavPanel.tsx:256-258` | `gradient-primary` tile + lucide `Sparkles` | mark (`/brand/syrel-mark.svg`), asset swap only (FIRES 24/13/417) |
| `frontend/public/favicon.svg` | Vite default purple bolt | `syrel-mark-iris.svg` content |
| docs header | — | inherits Navigation (D-01 reuse) |
| `video/src/components/ui.tsx:149-172` `LogoPlaceholder` | dashed "Syrel logo" box | Iris mark/lockup as JSX (static in scenes; animated in `BrandedEpisode`/promo intros, D-15) |
| `src/components/auth/AuthCardShell.tsx:40-41` + `pages/AuthPage.tsx:16` title "Agentic RAG" | Sparkles tile, title | **Not in D-14's list** — see Open Question 4 |
**Assets (measured):** `docs/brand/syrel-lockup-iris.svg` (3.8 KB, wordmark already outlined as paths — no font dependency), `syrel-mark-iris.svg` (1.1 KB, 64×64), `syrel-logo-iris-animated.svg` (8.4 KB). Copy to `frontend/public/brand/` (served statically, referenced by `<img>`; keeps the landing CSS-class lint happy).

**Landing Navigation also needs (G4-1):** a `Docs` link, a mobile menu button + drawer (today `.nav-links .hide-m { display: none }` at ≤ 720 px hides every link — there is **no drawer**), and hash links made absolute (`/#features`) so they work from `/docs`. Every new class must exist in `landing.css` (`cssClasses.test.ts` fails on undefined classes).

## Common Pitfalls

### Pitfall 1: Builds that cannot see `../docs` or `../video`
**What goes wrong:** `vite build` fails on Vercel and in the onebox image when `src/docs` or the landing hero imports outside `frontend/`.
**Why:** onebox `docker-compose.prod.yml:24` uses `context: ./frontend`; the Dockerfile copies only that context. Vercel's root directory is `frontend/` and, without "Include source files outside of the Root Directory in the Build Step", `..` is not accessible [CITED: vercel.com/docs/monorepos/monorepo-faq].
**How to avoid:** change the frontend build to `context: .` + `dockerfile: frontend/Dockerfile`, COPY `frontend/`, `docs/public`, `docs/history`, `video/src`, `video/public/vo` explicitly, and add a `frontend/Dockerfile.dockerignore` (BuildKit per-Dockerfile ignore — [ASSUMED]) excluding `**/node_modules`, `backend/`, `video/public/notebooklm`, `video/out`, `.planning`. Update OPERATOR/compose/onebox in the same commit and run `bash scripts/check-deploy-drift.sh`. Operator verifies the Vercel setting.
**Warning signs:** `Could not resolve "../../../video/src/…"` in a CI/preview log.

### Pitfall 2: `/docs` falls through to `app.html` in dev
**What goes wrong:** today's `appRoutingPlugin` rewrites every non-root, dot-less path to `/app.html` — including `/docs/use/chat`.
**How to avoid:** the `/docs` rule must run **before** the app rule (Pattern 1); unit-test `rewriteDevUrl`.

### Pitfall 3: The landing fence cannot see Remotion
**What goes wrong:** `landingBundleFence.test.ts` crawls only relative and `@/` imports, treats `import()` like a static import, and forbids only `@supabase/supabase-js` + five app paths. An eager `@remotion/player` or `@video/*` import passes it.
**How to avoid:** add `landingFirstPaintFence.test.ts` — crawl **static imports only** (skip `import(`), follow `@video/` and `../video/` too, and forbid specifiers `remotion`, `@remotion/*`, `@scalar/*`, `minisearch`, `@video/*`, and any path under `src/docs`. Add a build check (`build.manifest: true` → walk `dist/.vite/manifest.json` from `index.html` through `imports` only, never `dynamicImports`, and assert none of those chunk files contain a Remotion signature string) [CITED: vite.dev/guide/backend-integration]. Live proof is G4-2 in Chrome (network panel on first paint).

### Pitfall 4: Docs entry pulls app code
**What goes wrong:** reusing a helper from `src/components` or `src/lib` drags `@supabase/supabase-js` and providers into the public docs bundle.
**How to avoid:** `docsBundleFence.test.ts` — copy the landing crawler (repo precedent: copy, don't share) rooted at `src/docs/main.tsx`, same forbidden list. Docs may import only `src/landing/**`, `src/docs/**`, `@video/**` (lazily) and packages.

### Pitfall 5: Worktrees lack the video WIP and `video/node_modules`
**What goes wrong:** `video/src/clips|promo|episodes|vertical`, `EAdmin.tsx`, `ELibrary.tsx`, `video/public/vo/clip-*.wav`, `video/public/music/`, `make_music.py` and the `Root.tsx`/`package.json` edits are **uncommitted** (git status at phase start). A worktree has none of it. And `bootstrap-worktree.sh` junctions only `backend/venv` + `frontend/node_modules`.
**How to avoid:** pre-flight commit of the video WIP (operator confirms it is the intended state; decide whether `syrel-pulse.wav` 5.9 MB is committed or regenerated by `make_music.py`). Frontend must resolve all `remotion*` packages from its own `node_modules` (install + dedupe + TS `paths`), never from `video/node_modules`.

### Pitfall 6: `npm install` in a worktree writes the operator's real `node_modules`
**What goes wrong:** `frontend/node_modules` is a junction; two plans installing concurrently corrupt it and fight over `package-lock.json`.
**How to avoid:** exactly one plan (276-02, task 1) owns `package.json`/`package-lock.json` and installs every new package; no other plan touches them.

### Pitfall 7: DOCS-04 silently off in production
**What goes wrong:** gate keys on `ENVIRONMENT`; if Coolify does not set it, prod stays open and every test is green.
**How to avoid:** startup log line, parity checklist item, post-deploy `curl` = 401 recorded as a UAT row.

### Pitfall 8: Landing drift guard is red at base
**What goes wrong:** `node scripts/check-landing-drift.cjs` exits 1 today (`BUILTIN_TOOL_COUNT` 29 vs registry 30, `show_artifact`). Its hook fires on every `src/landing` edit and the `landing-drift.yml` CI runs on `src/landing/**` pushes.
**How to avoid:** record as inherited (measured at base) and decide explicitly (Open Question 5). Do not "fix" it by excluding `show_artifact` in the guard.

### Pitfall 9: Duplicate SVG gradient ids
**What goes wrong:** both brand SVGs define `linearGradient id="g"` / `id="h"`; inlining lockup + mark (nav + footer + drawer) on one page makes later instances reference the first; a hidden first instance can blank the others.
**How to avoid:** use `<img src="/brand/…">` for static placements; if JSX is required (video), suffix ids with `useId()`.

### Pitfall 10: Remote requests before consent
**What goes wrong:** YouTube thumbnail, Scalar fonts/agent/telemetry, Remotion hosted SFX — all third-party fetches on page view.
**How to avoid:** self-hosted posters, Scalar options above, `AudioOn=false` / SFX off for web-muted playback.

### Pitfall 11: Content claims what is not shipped
**What goes wrong:** history drafts carry superseded claims; NotebookLM drafts embellish. Known traps: in-app Word/PDF preview (it is download), "three deployment presets", v4.5 as live, Experts that restrict.
**How to avoid:** frontmatter `release:` + gate `[release-mismatch]`; a fact-check log per written page citing the `docs/history` "Status today" line; G4-3 drive.

### Pitfall 12: onebox nginx already serves the landing for `/app`
**What goes wrong (discovered, pre-existing since Phase 226):** `frontend/nginx.conf` `location / { try_files $uri $uri/ /index.html; }` predates the landing/app split, so on a onebox `/app` returns the **landing**, not `app.html`.
**How to avoid:** out of scope for DOCS-0x, but the plan edits this file anyway for `/docs`; fold the one-line fix (`location /app { try_files $uri /app.html; }` + `/setup`, `/invite`) or plant a seed with a concrete trigger — do not leave it silent.

## Code Examples

### Search index: build (Node, in the plugin) and query (browser)
```ts
// build side (scripts/lib/docs-content.cjs → plugin generateBundle)
const MiniSearch = require("minisearch")
const OPTIONS = { fields: ["title", "summary", "headings", "body"], storeFields: ["title", "slug", "section", "status", "release", "summary"],
                  searchOptions: { boost: { title: 3, headings: 2 }, prefix: true, fuzzy: 0.2 } }
const ms = new MiniSearch(OPTIONS); ms.addAll(docs)          // docs = pages (written + stubs) + changelog entries
this.emitFile({ type: "asset", fileName: "docs-assets/search-index.json", source: JSON.stringify(ms) })
// browser side (SearchBox, on first focus)
const json = await (await fetch("/docs-assets/search-index.json")).text()
const index = MiniSearch.loadJSON(json, OPTIONS)              // same options — required by the API
```
Source: [CITED: lucaong.github.io/minisearch — loadJSON "should be given the same options originally used when serializing"]. Share `OPTIONS` from one module imported by both sides.

### YouTube facade (D-12)
```tsx
export function YouTubeFacade({ id, title, poster }: { id: string; title: string; poster: string }) {
  const [on, setOn] = useState(false)
  if (!on) return <button className="vslot" onClick={() => setOn(true)} aria-label={`Play: ${title}`}><img src={poster} alt="" loading="lazy" /></button>
  return <iframe src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0`} title={title}
    allow="autoplay; encrypted-media; picture-in-picture" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen loading="lazy" />
}
```

### Changelog header parse
```js
const head = /^# (v\d+\.\d+) — (.+)$/m.exec(text)
const shipped = /^> \*\*Shipped:\*\* ([^·]+)/m.exec(text)?.[1].trim() ?? ""
const released = /^\d{4}-\d{2}-\d{2}/.test(shipped)
const section = (name) => new RegExp(`^## ${name}\\n([\\s\\S]*?)(?=^## |\\Z)`, "m").exec(text)?.[1].trim()
// refuse (exit/throw) if fewer than 20 history files parse — derive from readdirSync, never a list
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `<Audio>` from `remotion` | `<Audio>`/`<Video>` from `@remotion/media` (mediabunny), falls back to `<Html5Audio>` in preview | Remotion 4.0.3xx+ | `video/` already uses `@remotion/media`; Player supports it [CITED: remotion.dev/docs/media/audio] |
| Vite 5 Rollup | Vite 8 (Rolldown) — `build.rollupOptions.input` still honoured (current config works) | Vite 8 | Keep `rollupOptions` for consistency; verify `resolve.dedupe` behaves under Rolldown in Wave 0 [ASSUMED] |
| FastAPI `HTTPBearer` 403 on missing header | 401 in later FastAPI releases | after 0.115.x | Installed 0.115.6 → 403; use optional bearer + explicit 401 |

**Deprecated/outdated in our own inputs:** IA "25 history files" (27 measured); IA API step (4) "move /admin into openapi.operator.json" (superseded by D-16 — drop entirely); CLAUDE.md "67 TS errors" (70 measured); CONTEXT "planner adds rows for `vite.config.ts`/`vercel.json` (the gate will flag `[no-row]`)" — **false**: the ledger gate WATCHES only `backend/app/` and `frontend/src/` and exempts `.json`, so neither is flagged (measured with `--files`). Rows are optional for them.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Vite 8/Rolldown honours `resolve.dedupe` for deep imports (`@remotion/transitions/slide`) | Remotion embedding | Two copies of remotion/React → Player crash; fallback: explicit `resolve.alias` per package to `frontend/node_modules` |
| A2 | Vercel project has (or can enable) "Include source files outside the Root Directory" | Pitfall 1 | Vercel build fails; fallback: move docs content/video imports under `frontend/` (conflicts D-02/D-11) |
| A3 | BuildKit honours `frontend/Dockerfile.dockerignore` when context is repo root | Pitfall 1 | Huge/secret-bearing build context; fallback: root `.dockerignore` (affects nothing else — backend context is `./backend`) |
| A4 | Coolify production sets `ENVIRONMENT=production` | DOCS-04 | Prod docs stay open; mitigated by log + curl UAT |
| A5 | Scalar's lazy chunk is acceptable (< ~1 MB gz) on Vite 8 | OpenAPI pipeline | Swap to Redoc fallback |
| A6 | `/docs/oauth2-redirect` is unused (no OAuth2 flow configured) but harmless to keep | DOCS-04 | None material |
| A7 | MiniSearch/Scalar/Remotion package names are legitimate (slopcheck not run) | Package audit | Supply-chain risk; human-verify checkpoint before install |
| A8 | `x-tagGroups` and `x-badges` render in Scalar | OpenAPI pipeline | Cosmetic; fall back to tag order + description prefix |
| A9 | FastAPI docs page "Custom Docs UI Static Assets" documents `docs_url=None` + own routes | Pattern 4 | None — behaviour verified from source anyway |

## Open Questions

1. **Narrated overview = which composition?**
   - Known: `SyrelOverview` has no audio (measured); `SyrelEnergetic` is narrated (`vo/beat-1..7.wav`, ~1.8 MB).
   - Recommendation: docs home plays `SyrelEnergetic` (matches "narrated" + "energetic" operator wish), or keep `SyrelOverview` silent and say so. Operator picks at plan review.
2. **Is the uncommitted `video/` WIP final?** Pre-flight commit needs operator confirmation, including whether the 5.9 MB `music/syrel-pulse.wav` goes into git (the landing hero is muted, so web never needs it).
3. **Usable live explorer in production?** Bearer-only gating makes `/docs` unreachable from a plain browser. Options: (a) accept — document "use `/openapi.json` with your token, or a local box"; (b) add a token paste page that embeds the spec after an authenticated fetch. Recommendation: (a) for 276; D-16's public page says so.
4. **AuthCardShell / AuthPage branding.** Login screen shows Sparkles + "Agentic RAG"; D-14 lists "app header" only. Recommendation: include the mark swap in the same commit (it is the first app screen a landing visitor sees after "Sign in"); keep the title text decision explicit.
5. **Landing drift red at base (29 vs 30).** Recommendation: set `BUILTIN_TOOL_COUNT = 30` only if 276's prod promotion rides with 273's (show_artifact ships in the same deploy); otherwise record as inherited and leave the guard red with a note. Do not edit the guard.
6. **Vercel setting + Coolify env** — operator verification (A2, A4) before the prod promotion.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node / npm | builds, gates | ✓ | (repo standard) | — |
| Vite / Vitest | docs entry, tests | ✓ | 8.0.0 / 4.1.0 | — |
| backend venv (FastAPI) | DOCS-04, export | ✓ | FastAPI 0.115.6, Starlette 0.41.3 | — |
| `video/node_modules` (remotion 4.0.532) | studio/render only | ✓ main tree / ✗ worktrees | 4.0.532 | frontend installs its own copies (dedupe) |
| ffmpeg | optional audio re-encode | ✓ | 8.1.1 | ship wav as-is |
| Docker | onebox image build check | ✗ to agents (deny rule) | — | `check-deploy-drift.sh` (`docker compose config` in CI) + operator build |
| Chrome MCP | G-4 drives at verification | ✓ (project standard) | — | operator drives |
| Vercel preview deploy | G4-4 on real Vercel routing | operator-gated | — | local `vite preview` + vercel.json routing-table test |
| slopcheck | package legitimacy | ✗ | — | human-verify checkpoint |

**Missing dependencies with no fallback:** none blocking.
**Missing with fallback:** Docker (CI parse + operator), Vercel preview (routing simulation test + operator).

## Validation Architecture

> `workflow.nyquist_validation` is `false` in `.planning/config.json`; included because the orchestrator asked for it. `tdd_mode: true` — each behaviour below gets a failing test first.

### Test Framework
| Property | Value |
|----------|-------|
| Frontend | Vitest 4.1.0, jsdom (node env per file where needed), `frontend/vitest.config.ts` |
| Backend | pytest via `backend/venv`, `backend/tests/unit/` (`client` fixture in `tests/conftest.py:223`) |
| Quick run | `cd frontend && npx vitest run src/docs src/landing` · `cd backend && venv/Scripts/python.exe -m pytest tests/unit/test_276_*.py -q` |
| Full suite | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) · `node scripts/check-backend-unit-baseline.cjs` · `npx tsc -p tsconfig.app.json --noEmit` set-diff vs **70** |
| Gates | `node scripts/check-docs-coverage.cjs` · `node scripts/build-public-openapi.cjs --check` · `node scripts/check-landing-drift.cjs` (red at base) · `node scripts/check-hot-file-ledger.cjs 276` · `bash scripts/check-deploy-drift.sh` |

### Phase Requirements → Test Map
| Req | Behavior | Type | Automated Command | File Exists? |
|-----|----------|------|-------------------|-------------|
| DOCS-01 | `/docs*` → docs.html in dev; others unchanged | unit | `npx vitest run src/docs/__tests__/devRouting.test.ts` | ❌ Wave 0 |
| DOCS-01 | vercel.json: landing host `/docs/use/chat` → docs.html, app host unchanged, `/app` unchanged | unit (routing-table simulation: redirects → filesystem → rewrites) | `npx vitest run src/docs/__tests__/vercelRouting.test.ts` | ❌ |
| DOCS-01 | router resolves slug / stub / changelog / 404 | unit | `npx vitest run src/docs/__tests__/router.test.ts` | ❌ |
| DOCS-01 | docs bundle imports no app code | fence | `npx vitest run src/docs/__tests__/docsBundleFence.test.ts` | ❌ |
| DOCS-01 | landing first paint has no remotion/scalar/docs | fence + build | `npx vitest run src/landing/__tests__/landingFirstPaintFence.test.ts` + manifest check | ❌ |
| DOCS-01 | stub renders summary + "Full guide coming" + nearest link; v4.5 badge text "Not yet released" (assert rendered CONTENT, not testids — memory `reference_presence_assertions_cannot_see_content_drift`) | component | `npx vitest run src/docs/__tests__/Stub.test.tsx` | ❌ |
| D-08 | index built from all pages; query returns stub and written pages | unit | `npx vitest run src/docs/__tests__/search.test.ts` | ❌ |
| DOCS-02 | gate green on tree; RED on planted tool/router; exit 2 on empty | integration (node) | `npx vitest run src/docs/__tests__/docsCoverageGate.test.ts` | ❌ |
| DOCS-03 | public spec: title "Syrel API", 0 `/admin` paths, hidden set absent, no orphan schemas, v4.5 badges present, `--check` clean | unit (node) | `npx vitest run src/docs/__tests__/publicOpenapi.test.ts` + `node scripts/build-public-openapi.cjs --check` | ❌ |
| DOCS-03 | snapshot == generated doc | backend unit | `pytest tests/unit/test_276_openapi_snapshot_fresh.py -q` | ❌ |
| DOCS-04 | env unset: 200 ×3; production: 401 no/bad token, 200 authed; canvas filter preserved; paths not in schema | backend unit | `pytest tests/unit/test_276_api_docs_gate.py -q` (+ existing `tests/test_182_canvas_gate.py`, `tests/test_184_uat02_staleness_bound.py` still green) | ❌ |
| DOCS-05 | 27 entries; v4.5 `released=false`; excluded sections absent; refuses < 20 files | unit | `npx vitest run src/docs/__tests__/changelog.test.ts` | ❌ |
| DOCS-06 | VideoSlot: nothing for unknown id; no Player import before intersection (mock IO); YouTube iframe only after click; poster src is same-origin | component | `npx vitest run src/docs/__tests__/VideoSlot.test.tsx` | ❌ |
| DOCS-06 | zero "Agentic RAG" in src/landing + index.html | fence | `npx vitest run src/landing/__tests__/landingBrand.test.ts` | ❌ |
| DOCS-06 | LandingPage brand assertion updated | component | `npx vitest run src/landing/__tests__/LandingPage.test.tsx` | ✅ (edit) |
| G4-1..4 | phone 390, first-paint network, honesty, deep link + refresh | manual (Chrome MCP) at `/gsd:verify-work` | — | owed rows in VERIFICATION |

### Sampling Rate
- **Per task commit:** the targeted files above.
- **Per wave merge:** vitest count gate (cap 2) + backend unit baseline + tsc set-diff + `build-public-openapi --check` + `vite build` (proves outside-root imports resolve).
- **Phase gate:** all gates + `check-docs-coverage.cjs` green on the merged tree + G-4 drives.

### Wave 0 Gaps
- [ ] `src/docs` added to vitest-count-gate **TARGETS** (directory) and new suites pinned in **BASELINE** at the close.
- [ ] `src/landing/__tests__/landingFirstPaintFence.test.ts`, `landingBrand.test.ts` (new; `src/landing` already a TARGET → BASELINE pins needed).
- [ ] Build probe in a bootstrapped worktree: `vite build` with `@video` alias + dedupe + fs.allow and one lazy Player import (A1) — before building on it.
- [ ] `backend/tests/unit/test_276_*.py` (two files).

## Security Domain

### Applicable ASVS Categories
| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (DOCS-04) | existing `get_current_user` (GoTrue validation, 503-on-unreachable, ban check) — no new auth code |
| V3 Session Management | no | — |
| V4 Access Control | yes | production-only gate on doc routes; public spec excludes `/admin`, setup, callbacks |
| V5 Input Validation | low | static content; react-markdown without `rehype-raw`; its default URL transform drops `javascript:` links |
| V6 Cryptography | no | — |
| V8 Data Protection / privacy | yes | no third-party request before consent (YouTube facade, Scalar telemetry/agent/fonts off, SFX off) |
| V14 Configuration | yes | `ENVIRONMENT` semantics change recorded in onebox example + OPERATOR; startup log of gate state |

### Known Threat Patterns for this stack
| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Anonymous schema map of the API in prod | Information disclosure | DOCS-04 gate; public spec filtered (D-16) |
| Public spec leaks internal ops / secrets | Information disclosure | filter + `--check`; snapshot already secret-scanned clean (inventory); add a test that greps the public JSON for `sk-`, `eyJ`, emails, `supabase.co` |
| XSS via Markdown | Tampering | no raw HTML; repo-authored content only |
| Clickjacking/tracking via embeds | Privacy | nocookie domain, click-to-load, `referrerPolicy`, no autoplay before click |
| Gate fails open on unset env | Elevation (misconfig) | log + parity checklist + curl UAT |
| Supply chain (new npm deps, Vue tree via Scalar) | Tampering | human-verify before install; exact pins for Remotion |

## Proposed Plan Split (G-8: 4 plans, 2 waves)

**Pre-flight (orchestrator/operator, before W1):** commit the `video/` WIP (Pitfall 5); confirm Open Questions 1, 2, 4, 5. Planner adds ledger rows at planning time for every `[no-row]` file (landing ×5–6, all new `src/docs/*` files, `backend/app/api/api_docs.py`) so no worktree edits the ledger concurrently; re-derive triples at close.

| Plan | Wave | Requirements | Owns (no other plan edits these) |
|---|---|---|---|
| **276-01 Backend: gated API docs + snapshot freshness** | 1 | DOCS-04, DOCS-03 (data source) | `backend/app/main.py`, `backend/app/api/api_docs.py` (new), `backend/tests/unit/test_276_api_docs_gate.py`, `backend/tests/unit/test_276_openapi_snapshot_fresh.py`, `scripts/export-openapi.py`, `docs/public/api/openapi.snapshot.json`, `deploy/onebox.env.example`, `docs/OPERATOR.md`, CLAUDE.md + `docs/HOT-FILE-LEDGER.md` main.py row/section |
| **276-02 Docs site shell, pipeline, routing, public spec** | 1 | DOCS-01, D-08, DOCS-05 (generator + page), DOCS-03 (filter + Scalar page) | `frontend/package.json` + lock (**all** new deps), `frontend/vite.config.ts`, `frontend/devRouting.ts`, `frontend/plugins/docsContent.ts`, `frontend/vitest.config.ts`, `frontend/tsconfig.app.json`, `frontend/docs.html`, `frontend/vercel.json`, `frontend/nginx.conf`, `frontend/Dockerfile`, `frontend/Dockerfile.dockerignore`, `docker-compose.prod.yml`, `scripts/lib/docs-content.cjs`, `scripts/build-public-openapi.cjs`, `docs/public/api/openapi.public.json`, `docs/public/README.md`, `frontend/src/docs/**` except `video/`, `scripts/vitest-count-gate.cjs` (TARGETS `src/docs`) |
| **276-03 Video, brand and landing** | 2 | DOCS-06, D-10..D-15, G4-1/G4-2 | `video/src/components/ui.tsx`, `video/src/promo/*`, `video/src/episodes/*`, `video/README.md`, `frontend/src/docs/video/**`, `frontend/src/landing/**` (Navigation drawer + Docs link + rename + logo, HeroSection lazy promo, new fences, LandingPage test), `frontend/index.html`, `frontend/public/favicon.svg`, `frontend/public/brand/*`, `frontend/src/components/layout/NavPanel.tsx` (+ AuthCardShell if Q4 = yes); landing-related BASELINE pins |
| **276-04 Content + coverage gate** | 2 | DOCS-02, content of DOCS-01/03/05 | `docs/public/**` (≈ 28 written + ≈ 92 stubs + changelog overrides), `frontend/public/docs-assets/shots/*` (few screenshots, posters), `scripts/check-docs-coverage.cjs`, `.claude/hooks/docs-coverage-guard.js`, `.claude/settings.json` (one entry), `.github/workflows/docs-coverage.yml`, `frontend/src/docs/__tests__/docsCoverageGate.test.ts`, fact-check log in the phase dir; docs-related BASELINE pins |

Dependencies: 276-03 needs 276-02's alias/dedupe/`VideoSlot` contract; 276-04 needs `scripts/lib/docs-content.cjs` + the frontmatter contract from 276-02. 276-03 and 276-04 are file-disjoint and run in parallel. The `scripts/vitest-count-gate.cjs` BASELINE edits by 276-03 and 276-04 touch different blocks — have one of them (276-04, last to close) do the final pin pass to avoid a merge conflict. Merged-tree gates + G4-1..4 Chrome drives + ledger triple re-derivation run at `/gsd:verify-work` (G-4 is a verification-time rule).

## Sources

### Primary (HIGH confidence — measured in repo this session)
- `frontend/vite.config.ts`, `frontend/vercel.json`, `frontend/middleware.ts`, `frontend/nginx.conf`, `frontend/Dockerfile`, `frontend/.dockerignore`, `docker-compose.prod.yml:20-36`
- `frontend/src/landing/**` (rename sites, fence, CSS lint, `facts.ts:155`), `scripts/check-landing-drift.cjs` (run: exit 1, 29 vs 30)
- `backend/app/main.py:752-960`, `backend/app/middleware/canvas_gate.py:136,356-395`, `backend/app/dependencies.py:21,300-380`, `backend/app/config.py:1215-1218`; FastAPI 0.115.6 source (`FastAPI.setup`, `FastAPI.openapi`, `HTTPBearer.__call__`)
- OpenAPI export comparison: `FastAPI.openapi(app)` == committed snapshot (231/282/216)
- `scripts/check-hot-file-ledger.cjs` (run with `--files`), `scripts/bootstrap-worktree.sh`, `scripts/vitest-count-gate.cjs` TARGETS
- `video/package.json`, `video/src/**` (Root, kit AudioOn, SyrelPromo audio, FeatureClip, ui LogoPlaceholder), `git status` of `video/`
- `docs/history/README.md` + `v*.md` headers (27 files), `docs/brand/*` (sizes, gradient ids)
- `npx tsc -p tsconfig.app.json --noEmit` → 70 errors at base; probe of video files under frontend strict config → 0 errors
- `npx vitest run src/landing` → 5 files / 24 tests passed at base
- npm registry (`npm view`): versions, peer deps, unpacked sizes

### Secondary (MEDIUM — official docs fetched this session)
- remotion.dev/docs/player/player (props, `lazyComponent` + `useCallback`, `initiallyMuted`, `acknowledgeRemotionLicense`)
- remotion.dev/docs/staticfile (Player uses `/` prefix), remotion.dev/docs/media/audio (Player support + Html5Audio fallback)
- vite.dev/config/shared-options#resolve-dedupe, vite.dev/config/server-options (fs.allow + `searchForWorkspaceRoot`), vite.dev/guide/backend-integration (manifest)
- lucaong.github.io/minisearch (toJSON / loadJSON same-options rule)
- github.com/scalar/scalar documentation/configuration.md (telemetry, agent, withDefaultFonts, hide* options)
- vercel.com/docs/monorepos/monorepo-faq (files outside root directory)
- memory `reference_vercel_filesystem_precedes_rewrites` (Vercel vercel.json docs quote)

### Tertiary (LOW — not verified this session)
- BuildKit per-Dockerfile `.dockerignore` (A3); Rolldown `resolve.dedupe` deep-import behaviour (A1); Scalar `x-tagGroups`/`x-badges` rendering (A8)

## Metadata

**Confidence breakdown:**
- Standard stack: MEDIUM — versions verified; package legitimacy not slopchecked; Scalar weight unmeasured.
- Architecture: HIGH — routing, FastAPI internals, fences, snapshot equality all measured.
- Pitfalls: HIGH — each traced to a file/line or a command run today.

**Research date:** 2026-10-04
**Valid until:** 2026-10-18 (Remotion and Scalar release weekly; re-check exact pins at install time)
