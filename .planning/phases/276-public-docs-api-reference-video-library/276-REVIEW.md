---
phase: 276-public-docs-api-reference-video-library
reviewed: 2026-10-05
depth: standard
diff_base: 2b756b1cd
status: fixed
fix_status: all_fixed (2 critical + 12 warning + A-IN-03; A-IN-11 folded into A-WR-01); other info accepted
files_reviewed: 138
split: "Part A (52 files: backend, gates, hooks, CI, deploy, routing, landing) + Part B (86 files: docs UI, chat Iris avatar, renamed components, video). Sources: 276-REVIEW-A.md, 276-REVIEW-B.md."
findings:
  critical: 2
  warning: 12
  info: 22
  total: 36
---

# Phase 276 — Code Review (combined)

IDs are prefixed by part: `A-` (backend/infra/landing) and `B-` (docs UI/avatar/video). Full per-part reports with file lists: `276-REVIEW-A.md`, `276-REVIEW-B.md`.

# Part A

# Phase 276 (Part A): Code Review Report

**Reviewed:** 2026-10-05T04:25:35Z
**Depth:** standard
**Files Reviewed:** 52
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

Scope: the Part A half of Phase 276. That covers the DOCS-04 production gate, the public OpenAPI filter, the docs coverage gate and its hook, routing in dev, Vercel and nginx, the invite email, `brandMeta`, the landing hero promo, the menu drawer, the first-paint guard, deploy artifacts, and the raster script.

The core security property holds. I traced `api_docs.py` → `get_current_user`. Unauthenticated `/docs`, `/redoc`, `/openapi.json` and `/docs/oauth2-redirect` get a 401 with `WWW-Authenticate: Bearer` when `ENVIRONMENT` is `production` or `prod`. A bad token gets 401, an unreachable GoTrue gets 503, and a banned user gets 403. The canvas-aware hook still filters, because the route returns `request.app.openapi()`. No other code reads `app.openapi_url`. These paths are clean:

- **Invite email.** Every interpolated value is escaped, and the logo origin comes from `primary_frontend_origin()`.
- **`brandMeta`.** It accepts http(s) URLs only and uses only their origin.
- **Dev media middleware.** An allow-listed regex is checked before any `path.join`, so there is no traversal.
- **nginx.** It normalises `..` before location matching.
- **`/admin`.** All 22 `/admin/*` paths are dropped from the public spec, measured against the committed snapshot (231 → 189 paths).

No BLOCKER-class defect was found. Seven WARNINGs. The most material ones:

1. **The first-paint guard cannot detect MiniSearch.** Measured on the current `dist/`: the MiniSearch chunk does not contain the lowercase marker.
2. **The menu drawer's focus trap is broken for forward Tab from the toggle.**
3. **The public API reference publishes internal implementation notes.** 99 of 207 operation descriptions carry threat-model IDs, bug IDs, or RLS/service-role mechanics.
4. **The docs gate fails open on any value other than `production`/`prod`.** This includes unset and `staging`, and the boot line that would reveal it logs at INFO.

## Warnings

### A-WR-01: The DOCS-04 gate fails open for every ENVIRONMENT value except `production`/`prod`, and the OPEN boot line is INFO

**File:** `backend/app/api/api_docs.py:61-63`, `backend/app/main.py:322-325`
**Issue:** `_docs_gated()` is an allow-list of *gated* values. `""`, `staging`, `prd`, `live` and `production-eu` all serve the full live API map anonymously. That map includes every `/admin/*` route shape and every request/response schema.

D-20 accepted fail-open for the *unset* case only because a boot log would reveal it. That line is `logger.info`, the same level as every other boot line, so nothing makes it stand out. The `master` branch is described as staging; any public staging backend with `ENVIRONMENT=staging` is open by construction. CLAUDE.md also notes that cloud config drifts from local and calls that drift "the #1 gotcha".
**Fix:** Invert the predicate so that only explicitly local values open the explorer, and make the open case loud when a value is set:
```python
_OPEN_ENVIRONMENTS = ("", "local", "dev", "development", "test")

def _docs_gated() -> bool:
    return (settings.environment or "").strip().lower() not in _OPEN_ENVIRONMENTS
```
If unset must stay open (D-20), at least gate every non-empty value other than local/dev/test. Also emit `logger.warning("API docs: OPEN ...")` whenever the explorer is open and `FRONTEND_URL` is not localhost.

### A-WR-02: The public OpenAPI spec publishes internal docstrings verbatim (threat IDs, bug IDs, RLS/service-role mechanics)

**File:** `scripts/build-public-openapi.cjs:226-244`
**Issue:** The filter keeps each operation's `description`, which FastAPI fills from the route docstring. Measured on the committed `docs/public/api/openapi.public.json`:

- 207 descriptions, 98,763 characters in total.
- 99 of them contain internal markers: `T-071-04-01`, `D-071-10`, ten `BUG-2609xx-xx` ids, and 29 `RLS ...` mechanics passages.
- One example: `/documents/{id}/reextract` says *"Owner-only RLS check (eq user_id) — 404 (NOT 403) on miss to avoid leaking existence (T-071-04-01 information-disclosure mitigation)"*.
- Another: the download-url op describes when "the service role signs the `file_path`".

Schema descriptions carry 87 more markers. This is the world-readable docs site aimed at buyers (D-06). It now carries the internal threat register and a description of how each authorization check is implemented. That is low-grade information disclosure and clearly not public-reference quality.
**Fix:** Do not ship docstrings. Keep only `summary`, plus a short curated description where one exists:
```js
for (const method of METHODS) {
  const op = item[method]; if (!op) continue
  delete op.description            // docstrings are engineering notes, not public reference
  // then add back only the NOTE_INTERNAL / NOTE_UNRELEASED prefixes
}
```
Apply the same scrub to `description` fields inside `components.schemas`, or keep only the first sentence. Add a `[internal-marker]` finding that fails the build when `/\b(T|D)-\d{3}|BUG-\d{6}|SEED-\d+|service[_ ]role/` matches anywhere in the output.

### A-WR-03: The landing first-paint guard's `minisearch` marker can never fire on built output

**File:** `scripts/check-landing-first-paint.cjs:42`
**Issue:** The marker check is a case-sensitive `text.includes("minisearch")`. Measured on the current `frontend/dist`: the MiniSearch chunk (`node_modules/minisearch/dist/es/index.js` → `assets/es-*.js`) contains `MiniSearch`, but **not** the string `minisearch`. If a shared-chunk hoist pulled MiniSearch into the landing's first paint, the gate would still print `landing first paint OK`. The self-test plants only `acknowledgeRemotionLicense`, so it never exercises this blind marker. A gate that cannot see what it names is vacuous for that item; this is the project's recurring "could it fire?" lesson.
**Fix:** Match case-insensitively, or use the identifiers that survive minification. Then add a self-test arm for each marker:
```js
const FORBIDDEN_MARKERS = ["@remotion", "acknowledgeRemotionLicense", "remotion.media", "@scalar", "MiniSearch"]
// and in selfTest: one planted chunk per marker, each expected → 1
```
Also note that `"scalar"` (lowercase) false-positives on any code that contains the word, for example the YAML and shiki language chunks. Use `"@scalar/"` to make it precise.

### A-WR-04: MenuDrawer focus trap: forward Tab from the toggle escapes to the header CTA and can never reach the sheet

**File:** `frontend/src/landing/components/MenuDrawer.tsx:56-73`
**Issue:** The trap only intervenes at the first and last item, or when focus is already outside. At ≤720px the DOM order is: toggle → header "Book a demo" (visible, since it has no `hide-m`) → the drawer sheet. Two failures follow:

- **Tab from the toggle.** The toggle is `first`, not `last`, so the browser's default moves focus to the header "Book a demo". That element is outside `items`. The next Tab sees `!inside` and jumps back to the toggle. Forward Tab therefore loops toggle ↔ header CTA, and the drawer's links are unreachable going forward.
- **Shift+Tab from the initially focused sheet.** `tabIndex=-1` on the sheet counts as inside but is not `first`, so focus escapes to the header CTA.

`Navigation.test.tsx` tests Escape and link-close but has no Tab-cycle case, so the "focus trapped" claim in the header comment is untested.
**Fix:** Manage every Tab press explicitly over the item list:
```ts
if (e.key !== "Tab") return
e.preventDefault()
const i = items.indexOf(document.activeElement as HTMLElement)
const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length
items[next].focus()
```
Add a test: open the drawer, focus the toggle, press Tab, and expect focus inside the dialog.

### A-WR-05: The root-context frontend build has no fallback ignore. Without BuildKit's per-Dockerfile ignore, the entire repo (with secrets) becomes build context and `frontend/.env*` reaches `vite build`

**File:** `docker-compose.prod.yml:27-28`, `frontend/Dockerfile:52`, `frontend/Dockerfile.dockerignore`
**Issue:** Moving the context to `.` makes `frontend/Dockerfile.dockerignore` the only exclusion mechanism, and that relies on assumption A3 (BuildKit). The repo has no root `.dockerignore`. With the legacy builder (`DOCKER_BUILDKIT=0`), older engines, or builders that do not implement per-Dockerfile ignore files, two things happen:

1. The full repo is sent as context: the root `.env` (onebox secrets, including the service-role key), `backend/.env`, `backend/venv` (1.7 GB) and `.git`.
2. `COPY frontend/ ./` copies any `frontend/.env`, `.env.local` or `.env.production` into the build stage. Vite's env loading then inlines their `VITE_*` values into the shipped bundle, except where an `ARG`/`ENV` of the same name pre-exists.

The final image only takes `dist`, so the root `.env` does not land in the image. The bundle-inlining path, however, is a real leak of developer config into production.
**Fix:** Add a minimal repo-root `.dockerignore` as a fallback. The backend build uses `./backend` as its context, so a root ignore file does not affect it:
```
**/.env
**/.env.*
!**/.env.example
backend/
.git
**/node_modules
.planning/
```
Alternatively, delete `frontend/.env*` explicitly in the Dockerfile before `vite build` (`RUN rm -f .env .env.*`).

### A-WR-06: `releasedVersion()` is a second, brittle parser of the "Shipped:" fact (line 3 only, silent skip)

**File:** `scripts/build-public-openapi.cjs:148-175`
**Issue:** `docs-content.cjs` claims to be "the ONE home" for history parsing (`parseHistory`, using a multiline regex anywhere in the file). `build-public-openapi.cjs` re-parses the same fact by reading only `split(/\r?\n/)[2]`. Any history file whose `> **Shipped:**` line is not exactly the third line is silently skipped. For example, a heading that wraps or a blank line inserted above it is counted neither as parsed nor as a failure. If that file is the newest release, `info.version` silently regresses to an older version, while the changelog built by `parseHistory` shows the newer one. The floor of 20 does not catch a single skipped file.
**Fix:** Derive the version from the shared library:
```js
const { parseHistory } = require("./lib/docs-content.cjs")
function releasedVersion(historyDir) {
  const released = parseHistory(historyDir).filter((r) => r.released)   // newest first
  if (!released.length) throw new HarnessError("no released version found in docs/history")
  return released[0].version.slice(1)
}
```

### A-WR-07: The public spec promises a "signed-in API explorer" that cannot work in a browser in production

**File:** `scripts/build-public-openapi.cjs:51-52`, `backend/app/api/api_docs.py:95-101`
**Issue:** The public description says operator endpoints are documented by "each deployment's own signed-in API explorer". In production that explorer does not work in a browser:

- A browser navigating to `/docs` sends no `Authorization` header, so the page itself is a 401.
- Even when the HTML is fetched with a token, the Swagger UI it returns fetches `/openapi.json` without a bearer, gets a 401, and renders an error. Its Authorize button is never reached because the spec never loads.

D-20 accepted this limitation internally. The public, buyer-facing copy states the opposite, which conflicts with this project's honesty rule for public docs (D-04: "only shipped, still-true behaviour").
**Fix:** Reword the description to match reality, for example: *"…each deployment serves its full schema at `/openapi.json` to a signed-in caller (`Authorization: Bearer <token>`); the browser explorer is available on local installs."* Alternatively, make the Swagger page workable by passing `swagger_ui_parameters={"persistAuthorization": True}` with a request interceptor, but that is a larger change.

## Info

### A-IN-01: The `XOrgId` reusable parameter is defined but referenced by no operation

**File:** `scripts/build-public-openapi.cjs:276`
**Issue:** `components.parameters.XOrgId` is added, but the output contains zero `#/components/parameters/XOrgId` references and zero operations with an org header parameter. The reference renderer will not show the header on any endpoint, so it reads as dead data.
**Fix:** Add `{ $ref: "#/components/parameters/XOrgId" }` to `op.parameters` for every surviving operation that is not under `/health` or `/me`. Otherwise, drop it and rely on the description text.

### A-IN-02: The hidden set is a deny-list, so a new operator-only route under an existing tag ships publicly with no finding

**File:** `scripts/build-public-openapi.cjs:59-65`
**Issue:** Only a brand-new tag forces review, through `[ungrouped-tag]`. A new `require_operator` route added to `skills`, `org` or `settings` is published automatically at the next snapshot regeneration.
**Fix:** Add a `[new-path]` finding that fails when a path is not present in the previously committed `openapi.public.json` and is not acknowledged in an allow-list. Alternatively, emit a diff summary in `--check` mode.

### A-IN-03: Stale comments now contradict the code

**File:** `.claude/hooks/docs-coverage-guard.js:11-18`, `.github/workflows/docs-coverage.yml:8-11`, `scripts/check-docs-coverage.cjs:35-36`, `backend/app/middleware/canvas_gate.py:17,132-135`
**Issue:**
- The three docs-coverage files say the hook is not registered and that "until then this workflow is the only automatic run". `.claude/settings.json:130` does register it.
- `canvas_gate.py` still says `/openapi.json` is "anonymous and unconditional" and that "main.py passes no override". Both are false since this phase.
**Fix:** Correct the comments using the strike-through convention.

### A-IN-04: The docs gate resolves `get_supabase` even on the open (local) path

**File:** `backend/app/api/api_docs.py:66-69`
**Issue:** `supabase: Client = Depends(get_supabase)` runs `create_client(...)` before `_docs_gated()` is checked. On a box with no Supabase config, local `/docs` now fails with a 500 where it previously worked. The unit suite cannot see this because conftest overrides `get_supabase` globally.
**Fix:** Drop the dependency and resolve `get_supabase()` inside the gated branch, just before calling `get_current_user`.

### A-IN-05: The PromoSlot import-failure comment is false for the non-reduced-motion path

**File:** `frontend/src/landing/components/HeroSection.tsx:822`
**Issue:** The comment says "a later scroll or click may try again". However, `maybeStart()` has already called `detach()` before the import settles, so no scroll listener or IntersectionObserver remains. With no play button outside reduced motion, one failed chunk fetch leaves the poster for the rest of the page's life.
**Fix:** Either re-attach on failure, or correct the comment so it says that only the reduced-motion button retries.

### A-IN-06: The HeroPromo test's "needs window load" arm is vacuous, and the suite is order-dependent

**File:** `frontend/src/landing/__tests__/HeroPromo.test.tsx:111-126`
**Issue:** In jsdom, `document.readyState` is already `"complete"`, so `PromoSlot` attaches at mount and the dispatched `load` event proves nothing. The first test also relies on the shared module registry, which the file acknowledges. It breaks under `sequence.shuffle`.
**Fix:** Stub `document.readyState` to `"loading"` in that test, and call `vi.resetModules()` in `beforeEach` instead of relying on test order.

### A-IN-07: Coverage-gate floors: `MIN_STEP` equals the exact count, and the router regex matches comments

**File:** `scripts/lib/docs-content.cjs:649,723`
**Issue:** `MIN_STEP = 7` while exactly 7 step types exist. A legitimate removal of a step type therefore becomes a harness error (exit 2) instead of a `[stale-cover]` finding. Separately, the regex `app\.include_router\((\w+)\.(\w+)` also matches a commented-out `# app.include_router(x.router)`, which would yield a phantom code key. The `[stale-cover]` cross-check does mitigate partial extractor rot well.
**Fix:** Set the floors a margin below the real counts, for example `MIN_STEP = 5`. Strip `#` comments from `main.py` before matching.

### A-IN-08: `site.webmanifest`: cross-origin `start_url` on Vercel, and the combined `"any maskable"` purpose

**File:** `frontend/public/site.webmanifest:4,10-11`
**Issue:** The landing and docs pages on the apex host link this manifest. Its `start_url: "/app"` 308-redirects to `app.<domain>`, which is outside the manifest's origin and scope, so an installed app launches in the browser. The combined `"any maskable"` purpose is discouraged, because the same padded icon gets used for `any`.
**Fix:** Use `"start_url": "/"` for the apex, or serve a per-host manifest. Split the icon entries into `"purpose": "any"` and `"purpose": "maskable"`.

### A-IN-09: Routing divergence: on Vercel's `app.` host, `/docs/*` serves the app. Also, `/docs/OPERATOR.md` now lands in the docs SPA

**File:** `frontend/vercel.json:95-104`, `frontend/src/components/setup/PresetPickerStep.tsx:40`
**Issue:** The host-matched catch-all `/(.*)` → `/app.html` precedes the `/docs` rewrites. So `app.<domain>/docs/use/chat` renders the app, while nginx and `devRouting.ts` render the docs. This is G4-4 ("never the app") from the app host. Separately, the setup wizard's `OPERATOR_DOC = "/docs/OPERATOR.md"` is now claimed by the docs SPA and shows its unknown-page state. It was already broken before this phase (it fell through to the landing).
**Fix:** Add a host-matched redirect from `app.*/docs/(.*)` to the apex, or exclude `/docs` from the app-host catch-all (`"source": "/((?!docs).*)"`). Point `OPERATOR_DOC` at a real docs slug.

### A-IN-10: `V45_OPERATIONS` badges never self-expire

**File:** `scripts/build-public-openapi.cjs:82`
**Issue:** Once v4.5 ships, `releasedVersion()` will return `4.5` while both operations keep their "Not yet released" badge until someone edits the list.
**Fix:** Emit a finding when `releasedVersion >= 4.5` and `V45_OPERATIONS` is non-empty.

### A-IN-11: Two readers of ENVIRONMENT disagree

**File:** `backend/app/main.py:938,957` vs `backend/app/api/api_docs.py:63`
**Issue:** The test-fixture and mock-LLM refusals read `os.getenv("ENVIRONMENT")`. The docs gate reads `settings.environment`, which pydantic also fills from `backend/.env`. With `ENVIRONMENT=production` set only in `.env`, the docs gate engages but the production refusals do not.
**Fix:** Have all three call the single `_docs_gated`-style helper, ideally renamed to `is_production()` in `config.py`.

### A-IN-12: A docs frontmatter error or a missing `docs/history` now fails the whole frontend build, the app included

**File:** `frontend/plugins/docsContent.ts:153,180` (and `readContent` → `parseHistory`)
**Issue:** The docs entry is always a Rollup input. A bad `covers:` line, a missing `openapi.public.json`, or the Vercel "include files outside root" setting being off blocks the production **app** deploy. This is intended per D-23, but it couples app availability to docs content.
**Fix:** Keep the coupling, but make sure the docs-coverage CI also runs `vite build`, or a `docsContent` dry-run, on `docs/public/**` changes so the failure surfaces before a deploy branch.

---

_Reviewed: 2026-10-05T04:25:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


# Part B

# Phase 276 (Part B): Code Review Report

**Reviewed:** 2026-10-05
**Depth:** standard
**Files Reviewed:** 86
**Status:** issues_found

## Summary

This part covers the public docs SPA (`frontend/src/docs`), the chat Iris avatar (`irisState`, `IrisAvatar`, and its mounts in MessageItem, RunCard, WorkingBadge, ChatArea and App), the brand-rename touches, and `video/`.

**What holds up:**
- **Markdown trust model.** `react-markdown` + `remark-gfm` runs with no raw-HTML plugin, and the default `urlTransform` drops `javascript:` links.
- **Lazy loading.** Scalar, MiniSearch, the Remotion Player and the compositions all arrive behind `import()`. The YouTube facade makes no request before the click. Scalar runs with `telemetry: false`, `agent.disabled`, `mcp.disabled` and `withDefaultFonts: false`. Every one of those keys was checked against the installed `@scalar/types` schema.
- **Single-pass decode.** `decodeEntities` decodes in one pass; `&amp;lt;` becomes `&lt;`, not `<`.
- **MessageItem.** It gained no new hook and no new store read.
- **IrisAvatar effects.** Cleanup is complete: rAF, timers and WAAPI animations are all cancelled on unmount.
- **Gradient ids.** Each instance's ids are unique and sanitised.
- **Gates.** The in-scope vitest suites pass (21 files, 253 tests). `tsc -p tsconfig.app.json` shows no errors in any reviewed source file.

**Blockers:**
1. **The Scalar API reference ships unstyled.** Its stylesheet is never imported, and the `dist/` built today contains none of its 312 KB of rules.
2. **Section deep links never scroll.** This covers every `#heading` link, whether on first load or on cross-page navigation, because the article body loads asynchronously after the scroll effect has already run.

**Warnings:**
- The avatar can sit amber ("waiting on you") on finished rows.
- The ring settle visibly snaps in roughly 10% of settles.
- In-page hash navigation steals focus to the H1. This includes Scalar's own hash routing.
- A malformed `#%` hash crashes the docs to a blank page.
- Web playback of the compositions requests `fonts.gstatic.com`, which contradicts T-276-20 and the video README's "same-origin" claim.

## Critical Issues

### B-CR-01: The Scalar API reference renders with no stylesheet

**File:** `frontend/src/docs/pages/ApiReference.tsx:18-19`

**Issue:** `@scalar/api-reference-react` does not inject its CSS. Its entry, `dist/index.js`, only calls `createApiReference`. The ESM `@scalar/api-reference` dist contains no `.css` import and no style injection. The 312,199-byte `@scalar/api-reference-react/dist/style.css`, which holds 1,258 `scalar-app` rules, must be imported by the host. No file in `frontend/src` imports it.

This was confirmed against the build. `frontend/dist/assets` (built 2026-10-05) holds only `app-*.css`, `docs-*.css` and `landing-*.css`. No CSS or JS asset contains a `.scalar-app{` rule, although the JS chunks do reference the `scalar-app` class. `DEEP_MIDNIGHT_CSS` (`customCss`) only sets variables and cannot stand in for the layout CSS.

The result is that `/docs/api/reference`, the DOCS-03 deliverable, mounts an unstyled Vue tree: a raw sidebar list, unstyled code blocks, and no layout.

The ApiReference tests mock `load` and never render real Scalar, so nothing could catch this.

**Fix:** Load the stylesheet with the module, behind the same dynamic import, so it stays out of first paint. The stylesheet contains only `data:` URLs, so this adds no third-party request.
```ts
const defaultLoad = (): Promise<ScalarModule> =>
  Promise.all([
    import("@scalar/api-reference-react"),
    import("@scalar/api-reference-react/style.css"),
  ]).then(([m]) => m as unknown as ScalarModule)
```
Then add a Chrome check of `/docs/api/reference` on a production build (`vite build && vite preview`). jsdom cannot see this defect.

### B-CR-02: Section deep links never land, on first load or across pages

**File:** `frontend/src/docs/DocsApp.tsx:120-136` (together with `frontend/src/docs/pages/Article.tsx:23-32`)

**Issue:** The scroll-to-hash logic runs in an effect keyed on `[routeKey, loc.hash]`. That effect commits in the same render that mounts `<Article>`. `Article` fetches its body through `data.loadPage(slug)`, which is a dynamic `import()` per page (`plugins/docsContent.ts:98`), so the body arrives in a later render.

When the effect runs, the `<h2 id=…>` does not exist yet, so `document.getElementById(...)` returns `null`:
- **First load** (`/docs/use/chat#stopping-a-run`): the hash is silently ignored. The browser's native fragment scroll has already given up, because parsing finished before React rendered.
- **Fresh client navigation to `/docs/x#y`** (a cross-page Markdown link, or any `navigate()` with a hash): `target` is `null`, so the code runs `window.scrollTo(0, 0)`. The reader lands at the top.

The effect never re-runs when the body arrives. As a result:
- Every "Link to this section" (`#`) anchor that `Markdown.tsx:61` renders produces a URL that does not work when shared.
- Every TOC hash someone copies is broken the same way.

No test covers hash scrolling: a grep for `scrollIntoView` and `hash` across `src/docs/__tests__` finds nothing.

**Fix:** Move the pending-hash scroll to the moment content exists. For example, let `Article` report readiness and scroll once:
```tsx
// DocsApp: keep a pending target instead of resolving it immediately
const pendingHash = useRef<string | null>(null)
// in the nav effect: pendingHash.current = loc.hash ? safeDecode(loc.hash.slice(1)) : null; try scroll; if found, clear
// pass to Article: onBodyRendered={() => { const id = pendingHash.current; if (!id) return;
//   const el = document.getElementById(id); if (el) { el.scrollIntoView(); pendingHash.current = null } }}
// Article: useEffect(() => { if (md !== null) onBodyRendered?.() }, [md])
```
Then add a test that renders `DocsApp` at `/docs/<slug>#<h2-id>` with a deferred `loadPage` and asserts that `scrollIntoView` is called on that H2 after the body resolves.

## Warnings

### B-WR-01: The avatar can show amber "waiting on you" on finished rows

**File:** `frontend/src/components/chat/irisState.ts:39`; related: `frontend/src/components/chat/ChatArea.tsx:766-773`, `frontend/src/providers/StreamsProvider.tsx:3167-3177`

**Issue:** The waiting check runs before the `runStatus !== "streaming"` → idle check. Any terminal row that still carries a pause signal is therefore amber for as long as it is on screen. The test table pins `"completed + ask_user interrupted → waiting"` as intended behaviour. The old `PausedRunCue` was deliberately gated on `isMessageStreaming` (MessageItem.tsx:583). The avatar drops that gate, and the inputs it trusts are not reliable after the run ends:

- **`interrupted` does not only mean a pending question.** StreamsProvider writes `status: "interrupted"` onto every running or preparing tool when the user presses Stop (`:3175`). If that run's terminal frame resolves as `done` or `reader_done` (both map to `runStatus: "completed"`), its `ask_user` row stays "interrupted" and the avatar claims the user has the next move on a run they stopped.
- **`toolApproval.decision` is not reliably written.**
  - The only writer is ChatArea's docked card, which mutates the object in place (`pendingApproval.decision = decision`, `:769`). Message identity does not change, so the `React.memo` row keeps rendering amber until an unrelated SSE event replaces the object.
  - The inline `ChatToolApprovalCard` (MessageItem.tsx:567) records its decision in local state only.
  - A server-side approval timeout writes nothing.
  - In all three cases `!m.toolApproval.decision` stays true. That leaves the row amber after completion, or amber over a run that is visibly executing tools (waiting outranks tool).

Each of these is a false claim about who has the next move, which is exactly what `pending-question.md` D2 forbids.

**Fix:**
- Gate the ask and approval arms on a live run, and keep only the cap pause as a terminal-row waiting signal (cap-pause is out-of-band by design):
  ```ts
  const live = m.runStatus === "streaming"
  if ((live && (hasPendingAsk(m.tool_calls) || (m.toolApproval && !m.toolApproval.decision))) || capPaused) return "waiting"
  ```
- Separately, replace ChatArea's in-place mutation with a store update that produces a new message object.
- Update the `completed + ask_user interrupted` table row to expect `idle`.

### B-WR-02: The ring settle snaps to a near-stop when the next 120° stop is close

**File:** `frontend/src/components/chat/IrisAvatar.tsx:161-173`

**Issue:**
- `dur` is floored at 450 ms.
- `y1 = Math.min(1, 0.3 * v * dur / remaining)` is clamped to 1.

When `remaining` is small, the clamp binds. The bezier's starting speed is then `(y1 / 0.3) · remaining / dur`, which is far below the live speed `v`.

**Example:** at the tool rate, `v = 360/4800 × 1.45 ≈ 0.109 °/ms`, and the ring stops 1° short of a stop.
- Needed duration: about 18 ms. It is floored to 450 ms.
- `y1` is clamped to 1, so the starting speed is about 0.0074 °/ms, a 15× instant deceleration, followed by a 1° creep over 450 ms.

**How often:** the clamp binds whenever `remaining < 0.3 · v · 450`. That is about 10° of every 120° at the thinking rate (≈8% of settles) and about 15° at the tool rate (≈12%).

This breaks the sketch's acceptance bar ("the starting slope matches the current spin speed" and "the settle never snaps"). The jsdom tests stub `getAnimations` to `undefined`, so this path never runs under test.

**Fix:** Skip to the following stop when the near one cannot be reached smoothly. Then the clamp never binds and `y1` stays below 1 with no overshoot:
```ts
let target = Math.ceil((ang + 0.001) / 120) * 120
const minCoast = (v * 450) / 3.3 // degrees needed to decelerate within the 450 ms floor at slope ≤ 1
if (target - ang < minCoast) target += 120
```

### B-WR-03: Any in-page hash navigation moves focus to the H1, including Scalar's routing

**File:** `frontend/src/docs/DocsApp.tsx:104-111, 122-136`

**Issue:** `interceptDocsLink` correctly leaves same-page hash links to the browser (`:95`). But a fragment navigation fires `popstate` (state `null`, so `fresh = false`), which calls `setLoc` with the new hash. The effect keyed on `loc.hash` then runs its non-first, non-fresh branch, which calls `h1.focus({ preventScroll: true })`.

Concretely:
- Activating the `#` anchor beside an H2: the browser focuses that H2 (`tabIndex={-1}`), and the effect immediately moves focus to the page H1.
- Any `[text](#section)` link in a page behaves the same way.
- On `/docs/api/reference`, Scalar's own hash routing (`#tag/...`) does the same, if Scalar changes the hash in a way that fires `popstate`. Its sidebar clicks have not been checked live, so this case is not confirmed.

The view stays put (`preventScroll`), but sequential focus restarts at the top of the page. For keyboard and screen-reader users, the next Tab press is no longer where they navigated to. This is a WCAG 2.4.3 focus-order defect.

**Fix:** Move focus to the H1 only when the route changed. Track the previous `routeKey` and skip the focus call on a hash-only change, leaving fragment focus to the browser:
```ts
const prevKey = useRef(routeKey)
// …
const routeChanged = prevKey.current !== routeKey
prevKey.current = routeKey
if (routeChanged) document.querySelector<HTMLElement>("#content h1")?.focus({ preventScroll: true })
```

### B-WR-04: A malformed percent sequence in the hash blanks the docs

**File:** `frontend/src/docs/DocsApp.tsx:125, 129`

**Issue:** `decodeURIComponent(loc.hash.slice(1))` throws `URIError` on input such as `#%E0%A4%A` or `#100%`. The throw happens inside a `useEffect`. There is no error boundary above `DocsApp` (the only boundary, `RouteChunkBoundary`, wraps the API route alone), so React unmounts the whole root and the public docs show a white page. Anyone can trigger this with a crafted link.

**Fix:**
```ts
function safeDecode(s: string): string { try { return decodeURIComponent(s) } catch { return s } }
```
Use it at both sites, and consider a top-level error boundary in `docs/main.tsx`.

### B-WR-05: Web playback of the compositions requests Google Fonts, despite the "never a third party" claim

**Files:** `video/src/theme.ts:2-7`; claims at `frontend/src/docs/video/RemotionSlot.tsx:9-12` and in the video/README "Web playback" section (`each one exists so a reader's browser stays same-origin`)

**Issue:**
- **Font requests.** `theme.ts` calls `@remotion/google-fonts` `loadFont()` at module top for both Manrope and Inter. Every composition module imports it: kit, FeatureClip, ui. `node_modules/@remotion/google-fonts/dist/esm/Inter.mjs` builds `FontFace`s from `https://fonts.gstatic.com/s/inter/...`.
- **What triggers them.** The same requests fire:
  - after the docs click;
  - on the landing hero, after a scroll with no click at all. That is the `SyrelPromo` path, which T-276-20 lists among the mitigated surfaces.
- **The claim.** The 276-05 must-have reads *"Web playback never requests a third-party URL"*. The SfxOn change gated `remotion.media` for exactly this reason, and Google is the same class of third-party host.
- **Mitigating factor.** RESEARCH:499 notes that the landing already loads these fonts from Google, so this is not a new host for that page. The written guarantee is still false, and the README presents it as the reason for the web rules.

**Fix:** Either gate the font loader the way SFX is gated, or drop the claim:
- **Gate it** by having `theme.ts` export family names only, with `loadFont` behind a Studio/render-only path. The web player inherits Inter and Manrope from the host page's `@font-face`, which docs.html and index.html already load.
- **Drop the claim** by correcting RemotionSlot's header, the README sentence and the T-276-20 row to say that Google Fonts is requested.

## Info

### B-IN-01: The boot-splash live region has no text to announce

**File:** `frontend/src/App.tsx:302-306`

**Issue:** `role="status"` with `aria-label="Loading Syrel"` wraps only an `aria-hidden` avatar. A live region announces its content, not its label, so most screen readers say nothing.

**Fix:** Add `<span className="sr-only">Loading Syrel…</span>` inside the region.

### B-IN-02: The avatar's motion logic has no test coverage

**File:** `frontend/src/components/chat/__tests__/IrisAvatar.test.tsx:154-164`

**Issue:** jsdom has no `getAnimations` or `CSSAnimation`, so `ramp()`, `settle()`, the playbackRate phase lock and the 120° coast never execute. B-WR-02 sits entirely in that untested code.

**Fix:** Add a unit test with a fake `getAnimations` that returns stub `CSSAnimation`-like objects, and assert the ramped rates and the settle keyframes and easing. Alternatively, record a manual Chrome seam check in VERIFICATION.

### B-IN-03: Re-entering work during a fade leaves the wave out of phase with the orbit

**File:** `frontend/src/components/chat/IrisAvatar.tsx:206-208` and `index.css` (`:is([data-motion="work"],[data-motion="fade"]) .wv`)

**Issue:** The `.wv` CSS animations survive the `fade` → `work` switch with their old `currentTime`, while `.spin` and `.glow` restart at 0. The "orbit-minus-wave = 0" phase lock from the sketch no longer holds. There is no visible seam, because the 360° wrap is offset-independent. The sketch accepts this edge.

**Fix:** None required. If the phase lock matters, reset `currentTime` on the `.wv` animations at spin-up.

### B-IN-04: `hasVideoDirective` matches `::video` inside fenced code

**File:** `frontend/src/docs/components/Markdown.tsx:40-42`

**Issue:** A page whose code block shows `::video` would suppress the default `VideoSlot` while the Markdown renders the line as code, so the video disappears.

**Fix:** Skip lines inside ``` or ~~~ fences, as `extractHeadings` in `docs-content.cjs` does.

### B-IN-05: Heading-id parity is only guaranteed for plain-text H2s

**File:** `frontend/src/docs/components/Markdown.tsx:53` versus `scripts/lib/docs-content.cjs:192-193`

**Issue:** The build hashes the raw Markdown source, link URLs and entities included. The browser hashes rendered text. So an H2 such as `## See [Chat](/docs/use/chat)` would get two different ids, and the TOC and search anchors would break. No H2 does this today (grep found none). Duplicate H2 texts also produce duplicate ids.

**Fix:** Have the build lint for links or entities in H2s, or derive ids from the same parsed text on both sides.

### B-IN-06: `decodeEntities` at display time can produce identical-looking category pills

**File:** `frontend/src/components/experts/catalog/expertCatalog.ts:80-84`; `ExpertCatalogPage.tsx:264`

**Issue:** Raw `R&amp;D` and `R&D` are two pills that both display as "R&D". The decode treats the symptom of category strings that were stored HTML-escaped.

**Fix:** Normalise the category on write or seed, or dedupe pills on the decoded value.

### B-IN-07: The auth card announces "Syrel" twice

**File:** `frontend/src/components/auth/AuthCardShell.tsx:40-44`

**Issue:** `alt="Syrel"` on the mark sits directly above the `CardTitle` "Syrel" on AuthPage.

**Fix:** Use `alt=""` there, as SetupWizard does, because the heading already names it.

### B-IN-08: The hero search's `/` hint is read aloud

**File:** `frontend/src/docs/components/SearchBox.tsx:139`

**Issue:** `<kbd className="d-kbd">/</kbd>` has no `aria-hidden`. The trigger button's copy of the hint does.

**Fix:** Add `aria-hidden="true"`.

### B-IN-09: An exhausted cap pause still reads as "waiting on you"

**File:** `frontend/src/components/chat/MessageItem.tsx:464`

**Issue:** When `continuesRemaining <= 0`, the Continue card shows a stop message with no action, but `capPaused` still makes the avatar amber.

**Fix:** Pass `capPaused && continuesRemaining > 0`, or give the exhausted state a dim or idle tone.

### B-IN-10: Navigating between two URLs that share a `routeKey` neither scrolls nor moves focus

**File:** `frontend/src/docs/DocsApp.tsx:114`

**Issue:** `/docs/api` and `/docs/api/overview` resolve to the same slug, and two unknown paths both produce `not-found::`. When navigating from one to the other, the effect does not re-run, so the page neither scrolls to top nor focuses the H1.

**Fix:** Include `loc.pathname` in the key used by the navigation effect.

---

_Reviewed: 2026-10-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_


# Fix results (gsd-code-fixer, 2026-10-05)

| ID | Commit | Fix |
|---|---|---|
| A-WR-01 (+A-IN-11) | c4d5225fd | Docs gate is fail-closed: open only when ENVIRONMENT is unset/local/development/dev/test; staging and unknown values return 401; the boot WARNING fires when open outside local; main.py reads `settings.environment`; deploy docs synced |
| A-WR-02 | 4beefabff | Public spec descriptions keep summary + first paragraph; internal-reference sentences are scrubbed (0/757 match); test pins the patterns |
| A-WR-03 | a22b7d75c | First-paint markers are case-insensitive (driven RED) |
| A-WR-04 | 7336d385c | MenuDrawer traps Tab/Shift+Tab |
| A-WR-05 | 3b8f4307e | Root `.dockerignore` |
| A-WR-06 | 666dfcab5 | `releasedVersion()` uses `parseHistory` and throws on an unparseable file |
| A-WR-07 | 9745ab0fa | Spec copy: live explorer = bearer/scripts; browsers → `/docs/api/reference` |
| A-IN-03 | e3a263401 | Stale "hook not registered" comments corrected |
| B-CR-01 | b72eefdb7 | Scalar `style.css` lazy-loaded with Scalar; fence extended |
| B-CR-02 | 835f6eb78 | Hash scroll fires after the Article body renders (`onBodyReady`) |
| B-WR-01 | 9edd74c65 | Amber "waiting" only while streaming; the cap-pause is the only waiting state on a finished row |
| B-WR-02 | 1bbbdfdde | Settle coasts to the following 120° stop (`irisMotion.ts`, tested at 3 spin rates) |
| B-WR-03 | 43d0f8cd2 | Only a route change focuses H1; Markdown components memoised (stopped H2/video remounts) |
| B-WR-04 | 98e6a31a6 | `safeDecode` + `DocsRootBoundary` |
| B-WR-05 | 575bcbc4b | Web playback skips `@remotion/google-fonts` (`__VIDEO_WEB_PLAYBACK__`); no `fonts.gstatic.com` in any chunk |

Remaining Info items: accepted as-is (recorded in the per-part reports). Owed: a Chrome check of `/docs/api/reference` styling on a production preview (verify-work).
