---
phase: 276-public-docs-api-reference-video-library
part: A (backend, scripts/gates, hooks, CI workflows, deploy artifacts, routing, landing)
reviewed: 2026-10-05T04:25:35Z
depth: standard
diff_base: 2b756b1cd
files_reviewed: 52
files_reviewed_list:
  - .claude/hooks/docs-coverage-guard.js
  - .github/workflows/docs-coverage.yml
  - .github/workflows/public-openapi.yml
  - backend/app/api/api_docs.py
  - backend/app/api/connectors.py
  - backend/app/main.py
  - backend/app/models/document_search.py
  - backend/app/services/email_provider.py
  - backend/tests/unit/test_276_api_docs_gate.py
  - backend/tests/unit/test_276_invite_email_brand.py
  - backend/tests/unit/test_276_oauth_client_name.py
  - backend/tests/unit/test_276_openapi_snapshot_fresh.py
  - deploy/onebox.env.example
  - docker-compose.prod.yml
  - frontend/Dockerfile
  - frontend/Dockerfile.dockerignore
  - frontend/app.html
  - frontend/devRouting.ts
  - frontend/docs.html
  - frontend/index.html
  - frontend/nginx.conf
  - frontend/plugins/brandMeta.ts
  - frontend/plugins/docsContent.ts
  - frontend/src/__tests__/components/MessageItem.test.tsx
  - frontend/src/__tests__/components/RunCard.logo.test.tsx
  - frontend/src/__tests__/components/WorkingBadge.test.tsx
  - frontend/src/landing/__tests__/HeroPromo.test.tsx
  - frontend/src/landing/__tests__/LandingPage.test.tsx
  - frontend/src/landing/__tests__/Navigation.test.tsx
  - frontend/src/landing/__tests__/brandAssets.test.ts
  - frontend/src/landing/__tests__/landingBrand.test.ts
  - frontend/src/landing/__tests__/landingFirstPaintFence.test.ts
  - frontend/src/landing/components/CompareSection.tsx
  - frontend/src/landing/components/HeroPromo.tsx
  - frontend/src/landing/components/HeroSection.tsx
  - frontend/src/landing/components/LandingFooter.tsx
  - frontend/src/landing/components/MenuDrawer.tsx
  - frontend/src/landing/components/Navigation.tsx
  - frontend/src/landing/landing.css
  - frontend/vite.config.ts
  - frontend/vitest.config.ts
  - scripts/build-public-openapi.cjs
  - scripts/check-docs-coverage.cjs
  - scripts/check-landing-first-paint.cjs
  - scripts/export-openapi.py
  - scripts/generate-brand-rasters.cjs
  - scripts/lib/docs-content.cjs
  - scripts/lib/docs-content.d.cts
  - scripts/scaffold-docs-stubs.cjs
  - scripts/vitest-count-gate.cjs
  - frontend/vercel.json
  - frontend/public/site.webmanifest
findings:
  critical: 0
  warning: 7
  info: 12
  total: 19
status: issues_found
---

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

### WR-01: The DOCS-04 gate fails open for every ENVIRONMENT value except `production`/`prod`, and the OPEN boot line is INFO

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

### WR-02: The public OpenAPI spec publishes internal docstrings verbatim (threat IDs, bug IDs, RLS/service-role mechanics)

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

### WR-03: The landing first-paint guard's `minisearch` marker can never fire on built output

**File:** `scripts/check-landing-first-paint.cjs:42`
**Issue:** The marker check is a case-sensitive `text.includes("minisearch")`. Measured on the current `frontend/dist`: the MiniSearch chunk (`node_modules/minisearch/dist/es/index.js` → `assets/es-*.js`) contains `MiniSearch`, but **not** the string `minisearch`. If a shared-chunk hoist pulled MiniSearch into the landing's first paint, the gate would still print `landing first paint OK`. The self-test plants only `acknowledgeRemotionLicense`, so it never exercises this blind marker. A gate that cannot see what it names is vacuous for that item; this is the project's recurring "could it fire?" lesson.
**Fix:** Match case-insensitively, or use the identifiers that survive minification. Then add a self-test arm for each marker:
```js
const FORBIDDEN_MARKERS = ["@remotion", "acknowledgeRemotionLicense", "remotion.media", "@scalar", "MiniSearch"]
// and in selfTest: one planted chunk per marker, each expected → 1
```
Also note that `"scalar"` (lowercase) false-positives on any code that contains the word, for example the YAML and shiki language chunks. Use `"@scalar/"` to make it precise.

### WR-04: MenuDrawer focus trap: forward Tab from the toggle escapes to the header CTA and can never reach the sheet

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

### WR-05: The root-context frontend build has no fallback ignore. Without BuildKit's per-Dockerfile ignore, the entire repo (with secrets) becomes build context and `frontend/.env*` reaches `vite build`

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

### WR-06: `releasedVersion()` is a second, brittle parser of the "Shipped:" fact (line 3 only, silent skip)

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

### WR-07: The public spec promises a "signed-in API explorer" that cannot work in a browser in production

**File:** `scripts/build-public-openapi.cjs:51-52`, `backend/app/api/api_docs.py:95-101`
**Issue:** The public description says operator endpoints are documented by "each deployment's own signed-in API explorer". In production that explorer does not work in a browser:

- A browser navigating to `/docs` sends no `Authorization` header, so the page itself is a 401.
- Even when the HTML is fetched with a token, the Swagger UI it returns fetches `/openapi.json` without a bearer, gets a 401, and renders an error. Its Authorize button is never reached because the spec never loads.

D-20 accepted this limitation internally. The public, buyer-facing copy states the opposite, which conflicts with this project's honesty rule for public docs (D-04: "only shipped, still-true behaviour").
**Fix:** Reword the description to match reality, for example: *"…each deployment serves its full schema at `/openapi.json` to a signed-in caller (`Authorization: Bearer <token>`); the browser explorer is available on local installs."* Alternatively, make the Swagger page workable by passing `swagger_ui_parameters={"persistAuthorization": True}` with a request interceptor, but that is a larger change.

## Info

### IN-01: The `XOrgId` reusable parameter is defined but referenced by no operation

**File:** `scripts/build-public-openapi.cjs:276`
**Issue:** `components.parameters.XOrgId` is added, but the output contains zero `#/components/parameters/XOrgId` references and zero operations with an org header parameter. The reference renderer will not show the header on any endpoint, so it reads as dead data.
**Fix:** Add `{ $ref: "#/components/parameters/XOrgId" }` to `op.parameters` for every surviving operation that is not under `/health` or `/me`. Otherwise, drop it and rely on the description text.

### IN-02: The hidden set is a deny-list, so a new operator-only route under an existing tag ships publicly with no finding

**File:** `scripts/build-public-openapi.cjs:59-65`
**Issue:** Only a brand-new tag forces review, through `[ungrouped-tag]`. A new `require_operator` route added to `skills`, `org` or `settings` is published automatically at the next snapshot regeneration.
**Fix:** Add a `[new-path]` finding that fails when a path is not present in the previously committed `openapi.public.json` and is not acknowledged in an allow-list. Alternatively, emit a diff summary in `--check` mode.

### IN-03: Stale comments now contradict the code

**File:** `.claude/hooks/docs-coverage-guard.js:11-18`, `.github/workflows/docs-coverage.yml:8-11`, `scripts/check-docs-coverage.cjs:35-36`, `backend/app/middleware/canvas_gate.py:17,132-135`
**Issue:**
- The three docs-coverage files say the hook is not registered and that "until then this workflow is the only automatic run". `.claude/settings.json:130` does register it.
- `canvas_gate.py` still says `/openapi.json` is "anonymous and unconditional" and that "main.py passes no override". Both are false since this phase.
**Fix:** Correct the comments using the strike-through convention.

### IN-04: The docs gate resolves `get_supabase` even on the open (local) path

**File:** `backend/app/api/api_docs.py:66-69`
**Issue:** `supabase: Client = Depends(get_supabase)` runs `create_client(...)` before `_docs_gated()` is checked. On a box with no Supabase config, local `/docs` now fails with a 500 where it previously worked. The unit suite cannot see this because conftest overrides `get_supabase` globally.
**Fix:** Drop the dependency and resolve `get_supabase()` inside the gated branch, just before calling `get_current_user`.

### IN-05: The PromoSlot import-failure comment is false for the non-reduced-motion path

**File:** `frontend/src/landing/components/HeroSection.tsx:822`
**Issue:** The comment says "a later scroll or click may try again". However, `maybeStart()` has already called `detach()` before the import settles, so no scroll listener or IntersectionObserver remains. With no play button outside reduced motion, one failed chunk fetch leaves the poster for the rest of the page's life.
**Fix:** Either re-attach on failure, or correct the comment so it says that only the reduced-motion button retries.

### IN-06: The HeroPromo test's "needs window load" arm is vacuous, and the suite is order-dependent

**File:** `frontend/src/landing/__tests__/HeroPromo.test.tsx:111-126`
**Issue:** In jsdom, `document.readyState` is already `"complete"`, so `PromoSlot` attaches at mount and the dispatched `load` event proves nothing. The first test also relies on the shared module registry, which the file acknowledges. It breaks under `sequence.shuffle`.
**Fix:** Stub `document.readyState` to `"loading"` in that test, and call `vi.resetModules()` in `beforeEach` instead of relying on test order.

### IN-07: Coverage-gate floors: `MIN_STEP` equals the exact count, and the router regex matches comments

**File:** `scripts/lib/docs-content.cjs:649,723`
**Issue:** `MIN_STEP = 7` while exactly 7 step types exist. A legitimate removal of a step type therefore becomes a harness error (exit 2) instead of a `[stale-cover]` finding. Separately, the regex `app\.include_router\((\w+)\.(\w+)` also matches a commented-out `# app.include_router(x.router)`, which would yield a phantom code key. The `[stale-cover]` cross-check does mitigate partial extractor rot well.
**Fix:** Set the floors a margin below the real counts, for example `MIN_STEP = 5`. Strip `#` comments from `main.py` before matching.

### IN-08: `site.webmanifest`: cross-origin `start_url` on Vercel, and the combined `"any maskable"` purpose

**File:** `frontend/public/site.webmanifest:4,10-11`
**Issue:** The landing and docs pages on the apex host link this manifest. Its `start_url: "/app"` 308-redirects to `app.<domain>`, which is outside the manifest's origin and scope, so an installed app launches in the browser. The combined `"any maskable"` purpose is discouraged, because the same padded icon gets used for `any`.
**Fix:** Use `"start_url": "/"` for the apex, or serve a per-host manifest. Split the icon entries into `"purpose": "any"` and `"purpose": "maskable"`.

### IN-09: Routing divergence: on Vercel's `app.` host, `/docs/*` serves the app. Also, `/docs/OPERATOR.md` now lands in the docs SPA

**File:** `frontend/vercel.json:95-104`, `frontend/src/components/setup/PresetPickerStep.tsx:40`
**Issue:** The host-matched catch-all `/(.*)` → `/app.html` precedes the `/docs` rewrites. So `app.<domain>/docs/use/chat` renders the app, while nginx and `devRouting.ts` render the docs. This is G4-4 ("never the app") from the app host. Separately, the setup wizard's `OPERATOR_DOC = "/docs/OPERATOR.md"` is now claimed by the docs SPA and shows its unknown-page state. It was already broken before this phase (it fell through to the landing).
**Fix:** Add a host-matched redirect from `app.*/docs/(.*)` to the apex, or exclude `/docs` from the app-host catch-all (`"source": "/((?!docs).*)"`). Point `OPERATOR_DOC` at a real docs slug.

### IN-10: `V45_OPERATIONS` badges never self-expire

**File:** `scripts/build-public-openapi.cjs:82`
**Issue:** Once v4.5 ships, `releasedVersion()` will return `4.5` while both operations keep their "Not yet released" badge until someone edits the list.
**Fix:** Emit a finding when `releasedVersion >= 4.5` and `V45_OPERATIONS` is non-empty.

### IN-11: Two readers of ENVIRONMENT disagree

**File:** `backend/app/main.py:938,957` vs `backend/app/api/api_docs.py:63`
**Issue:** The test-fixture and mock-LLM refusals read `os.getenv("ENVIRONMENT")`. The docs gate reads `settings.environment`, which pydantic also fills from `backend/.env`. With `ENVIRONMENT=production` set only in `.env`, the docs gate engages but the production refusals do not.
**Fix:** Have all three call the single `_docs_gated`-style helper, ideally renamed to `is_production()` in `config.py`.

### IN-12: A docs frontmatter error or a missing `docs/history` now fails the whole frontend build, the app included

**File:** `frontend/plugins/docsContent.ts:153,180` (and `readContent` → `parseHistory`)
**Issue:** The docs entry is always a Rollup input. A bad `covers:` line, a missing `openapi.public.json`, or the Vercel "include files outside root" setting being off blocks the production **app** deploy. This is intended per D-23, but it couples app availability to docs content.
**Fix:** Keep the coupling, but make sure the docs-coverage CI also runs `vite build`, or a `docsContent` dry-run, on `docs/public/**` changes so the failure surfaces before a deploy branch.

---

_Reviewed: 2026-10-05T04:25:35Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
