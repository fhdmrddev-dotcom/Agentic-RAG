# Phase 276: Public Docs, API Reference & Video Library - Context

**Gathered:** 2026-10-04
**Status:** Ready for planning (G-2 already satisfied by sketch 276, winner B)

<domain>
## Phase Boundary

A buyer, a user and a developer can each learn **everything Syrel does** from one public place,
`/docs` on the landing domain. It looks like the landing page, **says only what has shipped**, and has
a gate so it **cannot quietly fall behind the product**.

Delivers DOCS-01..06: the docs site (third Vite entry, sketch 276 B), ~30 written pages plus tracked
stubs for every other inventory item, a coverage gate, a "Syrel API" reference from a filtered OpenAPI
snapshot, sign-in-gated live `/docs` `/redoc` `/openapi.json` in production, a generated changelog,
Syrel videos on the docs and landing, the landing rename to Syrel, and the Iris logo pass.

⛔ Out of scope by roadmap: third-party API keys, webhooks, rate limits (SEED-013 → v4.6 Open
Platform; SEED-345). Any doc page that touches them says "not available today" and links the plan.

**Plans: target 4 (G-8).**

</domain>

<decisions>
## Implementation Decisions

### Carried forward (decided before this discussion — do not re-ask)
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

### First pages, stubs and search
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

### Video slots, delivery and hosting
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

### Logo
- **D-14:** 276 does the **full one-pass Iris logo insert**, in one commit: landing `Navigation` +
  `LandingFooter`, the **app header**, `frontend/public/favicon.svg`, the docs header, and `video/`'s
  `LogoPlaceholder`. Assets: `docs/brand/` (static lockup for nav bars, mark for favicon/small sizes).
  Wordmark is lowercase **syrel**; prose stays "Syrel".
- **D-15:** The **animated** logo appears in **video intros/outros only** (`BrandedEpisode`, the
  promo). Pages use the static lockup, so the landing hero has one moving thing (the promo).

### Developer section edges
- **D-16:** The **operator (`/admin`) API reference is NOT public.** Public docs carry one page saying
  the operator API exists and returns 404 to non-operators; the per-endpoint reference lives in each
  deployment's own live API explorer, which is sign-in-gated after D-03. The build filter drops
  `/admin/*` from `openapi.public.json` (no `openapi.operator.json` is published).
- **D-17:** `/knowledge-health/*` is **documented as "UI-internal: may change"**, not retired — it is
  still called by `frontend/src/lib/api/knowledge.ts` (5 calls, measured), so retiring it would break
  the app.

### G-4 lived-experience scenarios (operator-chosen at scope time; Chrome drives all four at verification)
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

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Scope and requirements
- `.planning/ROADMAP.md` §"Phase 276" — goal, 6 success criteria, failure modes, flags, video styles, logo note
- `.planning/REQUIREMENTS.md` — DOCS-01..06

### Docs content and structure
- `.planning/research/docs-coverage-inventory.md` — the 261-item closed list the coverage gate checks; each section names the source file its list is derived from
- `.planning/research/docs-information-architecture.md` — the page tree, audiences, video column, and the API reference plan (filter steps, hidden / flagged / gated sets, tag groups)
- `docs/history/README.md` + `docs/history/v*.md` — the fact-check source and the changelog source (v1.0 → v4.5; v4.5 is not released)
- `docs/public/api/openapi.snapshot.json` — the OpenAPI snapshot the public reference is filtered from

### Design
- `.planning/sketches/276-public-docs/README.md` + `index.html` — sketch 276, winner B (home, guide article, changelog; desktop + phone 390)
- `docs/brand/README.md` — Iris logo assets, tokens, and the "where it goes" list for the one-pass insert

### Video
- `.planning/phases/276-public-docs-api-reference-video-library/276-VIDEO-QUEUE.md` — NotebookLM status, documentary eps. 2-5 exact create calls, rate-limit facts
- `video/README.md` — Remotion project (compositions, render commands)
- `video/src/Root.tsx` — existing compositions: `SyrelOverview`, `SyrelEnergetic`, `Clip-Chat|Library|Workflows|Connections|Experts|Admin`

### Code being changed
- `backend/app/main.py:752-768` — `FastAPI(...)` construction and the comment D-03 reverses
- `frontend/vite.config.ts` — `rollupOptions.input` (landing + app) and the dev middleware that routes to `app.html`
- `frontend/vercel.json` — redirects/rewrites (app subdomain catch-all; `/app` rewrites)
- `frontend/src/landing/__tests__/landingBundleFence.test.ts` — the landing bundle fence that must still hold
- `docs/HOT-FILE-LEDGER.md` — G-5 rows (see code_context)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/landing/components/Navigation.tsx` (120 L), `LandingFooter.tsx` (49 L): reused by the docs entry; also where the rename + logo land.
- `frontend/src/landing/landing.css` + tokens: the docs look comes from here (Deep Midnight).
- `video/src/` compositions + `video/src/clips/FeatureClip.tsx` + `clipTimings.ts`: the Player renders these directly; voice audio is in `video/public/vo/*.wav` (3.3 MB; consider compressing for web).
- `video/src/components/ui.tsx` `LogoPlaceholder`: one component every video uses — the video half of the logo pass.

### Established Patterns
- **Multi-entry Vite**: `index.html` (landing) + `app.html` (app) in `rollupOptions.input`; a third `docs.html` follows the same shape.
- **Landing bundle fence** (`landingBundleFence.test.ts`) crawls landing imports and forbids app packages — the docs entry must not leak into it, and the landing must not import Remotion/Scalar eagerly.
- **Gates derive their scan set from code** (`check-seeds-register.cjs`, `check-hot-file-ledger.cjs`): never a hand-typed list; refuse to pass over zero parsed items.
- **Correction convention**: a reversed decision is struck through with the reason beside it, never silently deleted (applies to the `main.py` comment).

### Integration Points
- `vercel.json`: `/docs` and `/docs/*` must resolve to the docs entry on the landing host and must not fall into the `app.<host>` catch-all or `app.html`.
- `backend/app/main.py`: production gating of `/docs`, `/redoc`, `/openapi.json`; the canvas-aware `app.openapi` hook must keep working.
- `frontend/src/landing/__tests__/LandingPage.test.tsx:25` asserts `/Agentic RAG/` — changes with the rename.
- "Agentic RAG" remains in `src/landing/` at `CompareSection.tsx:42,95`, `LandingFooter.tsx:26`, `Navigation.tsx:62` (measured).

### G-5 audit (at discuss)
- `backend/app/main.py` — **FIRES** (84 commits / 61 phases / 952 L). Honoured by construction: the DOCS-04 change is one production-only gate + a comment correction; no new route, no new branch elsewhere. Ledger row updated in the same commit.
- App header for the logo (likely `frontend/src/components/layout/NavPanel.tsx`, FIRES 24/13/417): an **asset swap only**, no logic. Ledger row updated in the same commit.
- `frontend/src/landing/*`, `frontend/vite.config.ts` (4 commits), `frontend/vercel.json` (4 commits): low heat; **no ledger rows today** — the planner adds them (the gate will flag `[no-row]`).

</code_context>

<specifics>
## Specific Ideas

- Sketch 276's video slot plays `video/out/syrel-overview.mp4` locally; on the real site it is the lazy Remotion Player (D-11).
- API reference must say plainly: **no API keys, PATs or service accounts exist; a script authenticates as a signed-in user; the planned answer is SEED-013.**
- Public spec title is **"Syrel API"**, set by the build filter — `FastAPI(title="Agentic RAG API")` in code stays unchanged.
- The landing hero promo is muted and starts on scroll-into-view; the operator wants energetic, attention-grabbing video, not only calm narration.

</specifics>

<deferred>
## Deferred Ideas

- **The 12 missing guide clips** the IA marks `clip` (6 of 18 exist) — later video work; their slots show nothing until made.
- **Documentary eps. 2-5** — run beside the phase per `276-VIDEO-QUEUE.md`; embedded when they exist, never a 276 blocker.
- **Retiring `/knowledge-health/*`** — only after `frontend/src/lib/api/knowledge.ts` stops calling it.
- **Public operator API reference** — revisit if self-hosters ask to read it before installing.
- **AI search over the docs** ("ask the docs") — not in this phase; local search only.
- **Third-party API access** (keys, webhooks, rate limits) — SEED-013 / SEED-345, v4.6 Open Platform.
- **Light-background logo variant** — not made yet (`docs/brand/README.md`).

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md` (NL→workflow authoring spike) — matched on generic keywords only; unrelated to public docs.

</deferred>

---

*Phase: 276-public-docs-api-reference-video-library*
*Context gathered: 2026-10-04*
