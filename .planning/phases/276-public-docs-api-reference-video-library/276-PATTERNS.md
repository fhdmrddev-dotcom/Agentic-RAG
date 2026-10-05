# Phase 276: Public Docs, API Reference & Video Library - Pattern Map

**Mapped:** 2026-10-04
**Files analyzed:** 46 new/modified (grouped by plan per RESEARCH §Proposed Plan Split)
**Analogs found:** 40 / 46 (6 have no in-repo analog; see the last table)

All paths are repo-relative. Line numbers were read on 2026-10-04 at `683f0536e`.

---

## File Classification

### 276-01 Backend: gated API docs + snapshot freshness

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `backend/app/api/api_docs.py` (new) | route module | request-response (auth-gated) | `backend/app/api/features.py` (tiny router) + `dependencies.py:416` `_admin_bearer_scheme` | role-match |
| `backend/app/main.py` (FIRES 84/61/952) | config/app wiring | — | itself: `:752`, `:860-903`, `:921-934` | exact |
| `backend/tests/unit/test_276_api_docs_gate.py` (new) | test | request-response | `backend/tests/unit/test_182_canvas_auth.py`, `test_270_download_url.py` | exact |
| `backend/tests/unit/test_276_openapi_snapshot_fresh.py` (new) | test | transform (compare) | `test_270_download_url.py:258-262` (source fence reads a file via `Path(__file__).parents[2]`) | role-match |
| `scripts/export-openapi.py` (new) | utility script | file-I/O | `scripts/measure-recall.py:22-38` (backend on `sys.path`) | role-match |
| `docs/public/api/openapi.snapshot.json` (regenerated) | data artifact | — | exists today (231 paths) | exact |
| `deploy/onebox.env.example`, `docs/OPERATOR.md` | config docs | — | `onebox.env.example:157-159`, `OPERATOR.md:103-106` | exact |
| CLAUDE.md row + `docs/HOT-FILE-LEDGER.md` section for `main.py` | ledger | — | `HOT-FILE-LEDGER.md:5161` section; CLAUDE.md `main.py` row | exact |

### 276-02 Docs shell, pipeline, routing, public spec

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `frontend/docs.html` (new) | entry HTML | — | `frontend/index.html` (landing entry) | exact |
| `frontend/vite.config.ts` | config | request-response (dev middleware) | itself `:6-34` `appRoutingPlugin`, `:48-55` input | exact |
| `frontend/devRouting.ts` (new) | utility | transform (pure fn) | extract of `vite.config.ts:7-23` | exact |
| `frontend/plugins/docsContent.ts` (new) | build plugin | file-I/O / transform | `vite.config.ts:25-33` plugin shape (only plugin in repo) | partial |
| `frontend/vitest.config.ts` | config | — | itself `:17-21` alias block | exact |
| `frontend/tsconfig.app.json` | config | — | itself `:27-30` `paths` | exact |
| `frontend/vercel.json` | config (CDN routing) | request-response | itself `:94-113` rewrites | exact |
| `frontend/nginx.conf` | config | request-response | itself `:13-15` | exact |
| `frontend/Dockerfile` + new `frontend/Dockerfile.dockerignore` | build | — | `frontend/Dockerfile:40-48`, `frontend/.dockerignore` | exact |
| `docker-compose.prod.yml` | deploy | — | itself `:22-32` frontend build block | exact |
| `scripts/lib/docs-content.cjs` (new) | utility (shared parser) | transform | `check-seeds-register.cjs:233-286` (frontmatter + `readRegister(dir)` parameterised) | role-match |
| `scripts/build-public-openapi.cjs` (new) | utility script (`--check`) | transform / file-I/O | `check-landing-drift.cjs` (exit contract) + `canvas_gate.py:262-296` (ref closure to port) | role-match |
| `docs/public/api/openapi.public.json` (new, committed) | data artifact | — | `openapi.snapshot.json` | exact |
| `docs/public/README.md` (new) | contract doc | — | `.planning/seeds/TEMPLATE.md` (frontmatter contract synced with its gate) | role-match |
| `frontend/src/docs/main.tsx` | entry component | — | `frontend/src/landing/main.tsx` | exact |
| `frontend/src/docs/DocsApp.tsx`, `router.ts`, `pages/*`, `components/*` | component | request-response (client) | `frontend/src/landing/LandingPage.tsx` + `components/*` | role-match |
| `frontend/src/docs/docs.css` | stylesheet | — | `frontend/src/landing/landing.css` (imports it) | exact |
| `frontend/src/docs/__tests__/devRouting.test.ts`, `vercelRouting.test.ts`, `router.test.ts`, `search.test.ts`, `changelog.test.ts`, `publicOpenapi.test.ts`, `Stub.test.tsx` | test | — | `src/landing/__tests__/facts.test.ts`, `LandingPage.test.tsx` | role-match |
| `frontend/src/docs/__tests__/docsBundleFence.test.ts` | test (fence) | — | `src/landing/__tests__/landingBundleFence.test.ts` (copy, re-root) | exact |
| `scripts/vitest-count-gate.cjs` | config (gate knobs) | — | itself `:4508-4511` TARGETS, `:418-423` BASELINE | exact |

### 276-03 Video, brand and landing

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `frontend/src/docs/video/VideoSlot.tsx`, `RemotionSlot.tsx`, `YouTubeFacade.tsx`, `registry.ts` | component | event-driven (lazy load) | none in repo (no `lazy(`/`import(` in `src/landing`); RESEARCH Pattern 3 + Code Examples | none |
| `frontend/src/landing/components/HeroSection.tsx` (+ new `HeroPromo.tsx`) | component | event-driven (IO) | itself `:10-36` effect + reduced-motion guard | exact |
| `frontend/src/landing/components/Navigation.tsx` | component | — | itself (brand `:26-63`, links `:65-116`) | exact |
| `frontend/src/landing/components/LandingFooter.tsx` | component | — | itself `:14-46` | exact |
| `frontend/src/landing/components/CompareSection.tsx` | component (copy) | — | `:42,95` string swap | exact |
| `frontend/src/landing/__tests__/landingFirstPaintFence.test.ts` (new) | test (fence) | — | `landingBundleFence.test.ts` | exact |
| `frontend/src/landing/__tests__/landingBrand.test.ts` (new) | test (fence) | — | `cssClasses.test.ts:1-33` (readdir + importActual fs) | role-match |
| `frontend/src/landing/__tests__/LandingPage.test.tsx` | test | — | itself `:25` | exact |
| `frontend/index.html` | entry HTML | — | itself `:7-8` | exact |
| `frontend/public/favicon.svg`, `frontend/public/brand/*` | static asset | — | `docs/brand/syrel-*-iris.svg` (copy) | exact |
| `frontend/src/components/layout/NavPanel.tsx` (FIRES 24/13/417) | component | — | itself `:256-258` | exact |
| `frontend/src/components/auth/AuthCardShell.tsx`, `pages/AuthPage.tsx` (D-21) | component | — | `AuthCardShell.tsx:39-43`, `AuthPage.tsx:16` | exact |
| `video/src/components/ui.tsx` `LogoPlaceholder` | component (video) | — | itself `:148-172` | exact |
| `video/src/promo/SyrelPromo.tsx` `PromoBody` | component (video) | — | `video/src/energetic/kit.tsx:24-50` (`AudioOn` gate) | exact |
| `video/README.md` | doc | — | — | — |

### 276-04 Content + coverage gate

| New/Modified File | Role | Data Flow | Closest Analog | Match |
|---|---|---|---|---|
| `scripts/check-docs-coverage.cjs` (new) | gate script | batch / transform | `scripts/check-landing-drift.cjs` (extractors) + `check-hot-file-ledger.cjs:44-47` (floor) | exact |
| `.claude/hooks/docs-coverage-guard.js` (new) | hook | event-driven | `.claude/hooks/landing-drift-guard.js` | exact |
| `.claude/settings.json` (one entry; FIRES 9/4/202, gate-exempt) | config | — | itself `:117-123` | exact |
| `.github/workflows/docs-coverage.yml` (new) | CI | — | `.github/workflows/landing-drift.yml` | exact |
| `frontend/src/docs/__tests__/docsCoverageGate.test.ts` (new) | test (planted defect) | — | `check-seeds-register.cjs:692-740` `--self-test` (temp-root fixtures + containment guard) | role-match |
| `docs/public/**/*.md` (~28 written + ~92 stubs) | content | — | `docs/history/v*.md` (fact source, not shape) | none (new format) |
| `docs/public/changelog/*` override map | content/data | — | none | none |

---

## Pattern Assignments

### `backend/app/api/api_docs.py` (route module, auth-gated request-response)

**Analog:** `backend/app/api/features.py` (module docstring + tiny router) and `backend/app/dependencies.py:410-416` (optional bearer).

**Module header + imports** (`features.py:1-37`): long docstring stating WHY + the boundary, then:
```python
from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from app.config import settings
from app.dependencies import get_current_user, resolve_caller_role
...
router = APIRouter(tags=["features"])
```
For 276: import `get_supabase` and `get_current_user` from `app.dependencies`; `HTTPBearer` from `fastapi.security`; `get_swagger_ui_html`, `get_redoc_html`, `get_swagger_ui_oauth2_redirect_html` from `fastapi.openapi.docs`.

**Optional-bearer precedent** (`dependencies.py:410-416`) — copy the reasoning comment shape:
```python
# ... The shared ``bearer_scheme`` (auto_error=True) raises 403 on an
# ABSENT Authorization header ... auto_error=False
# hands us ``None`` for absent credentials ...
_admin_bearer_scheme = HTTPBearer(auto_error=False)
```

**get_current_user signature to call explicitly** (`dependencies.py:300-303`):
```python
async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    supabase: Client = Depends(get_supabase),
) -> dict:
```
Call it as `await get_current_user(credentials=creds, supabase=supabase)` (keeps its 401 / 503 / ban behaviour; no new auth code).

**Production check** — mirror the existing env idiom but read `settings.environment` at REQUEST time (`config.py:1215-1218` field; `main.py:922` idiom):
```python
if os.getenv("ENVIRONMENT", "").lower() in ("production", "prod"):
```
Router shape per RESEARCH Pattern 4: `APIRouter(dependencies=[Depends(require_api_docs_access)], include_in_schema=False)`; `/openapi.json` returns `JSONResponse(request.app.openapi())` so `build_canvas_aware_openapi` keeps working; `CanvasGateMiddleware` keys on the path `/openapi.json` (`canvas_gate.py:136`), unchanged.

---

### `backend/app/main.py` (FIRES — one gate + comment correction)

**FastAPI construction** (`main.py:752`):
```python
app = FastAPI(title="Agentic RAG API", version="1.0.0", lifespan=lifespan)
```
→ add `docs_url=None, redoc_url=None, openapi_url=None`. Title stays (public title is set by the filter script).

**Comment to correct, not delete** (`main.py:765-768`):
```python
#   * `GET /docs` deliberately keeps returning 200 in BOTH flag states. It is a static Swagger UI
#     shell carrying no route information of its own — it renders whatever the filtered document
#     says. App-wide `docs_url` gating has never been a convention in this codebase and is not
#     introduced here.
app.openapi = build_canvas_aware_openapi(app)
```
Strike-through + `CORRECTED 2026-10-04 (Phase 276, D-03 ...)` beside it; `app.openapi = ...` line unchanged.

**Router import + include** (`main.py:860` one-line import, then `:880` one-line include with a trailing phase comment):
```python
from app.api import threads, runs, ..., sources, experts  # noqa: E402
...
app.include_router(document_search.router)  # Phase 271 FIND-01/02/03 — document search beside RAG, ...
```
Append `api_docs` to the import list; add `app.include_router(api_docs.router)  # Phase 276 DOCS-04 — ...` after `experts` (`:903`). Note: the coverage gate's `router:` extractor parses these lines (`/app\.include_router\((\w+)\.(\w+)/g`), so `api_docs` becomes a key that a page must cover (internal-endpoints / operator page).

**Startup log line** — copy the loud-warning idiom (`main.py:930-933`):
```python
    logger.warning(
        "ENABLE_TEST_FIXTURES=1 — /__test__/inject-failed-run endpoint is "
        "MOUNTED. This MUST NOT happen in production (Phase 063 T-063-05-01)."
    )
```
→ one `logger.info("API docs: GATED (ENVIRONMENT=%s)" | "OPEN (...)")` in lifespan or at module level.

**Ledger section format** (`docs/HOT-FILE-LEDGER.md:5161-5165`):
```markdown
### `backend/app/main.py` — Phase 230, honoured by construction

**Measured 2026-09-05: `79 commits / 45 phases / 876 L`** (supersedes `74 / 54 / 835`).

**Purely additive:** ...
```
CLAUDE.md row cell ≤ 200 chars (current row: `⚠ STALE (83/60/951). **271-01**: ONE import + ONE include_router(...)`); same commit.

---

### `backend/tests/unit/test_276_api_docs_gate.py` (test)

**Analog:** `backend/tests/unit/test_182_canvas_auth.py` (docstring explains falsifiability; imports inside test bodies; `client` fixture) and `test_270_download_url.py:1-27` (module-level imports variant + two distinct doubles).

**Conventions to copy:**
- conftest installs a blanket `app.dependency_overrides[get_current_user] = lambda: mock_user_data` (`tests/conftest.py:133,166`) and restores it per test (autouse `reset_mocks`, `:147`). The gate test must **pop that override** to see the real 401 path (the `test_182_canvas_auth.py:20-26` docstring explains exactly this trap).
- `client` fixture: `tests/conftest.py:222-226`.
- Stub GoTrue via an `app.dependency_overrides[get_supabase]` fake (`test_270_download_url.py:19` imports `get_supabase`).
- Flip prod with `monkeypatch.setattr(settings, "environment", "production")` (per-request read makes this work without re-import).
- Also assert the 3 paths are absent from `FastAPI.openapi(app)["paths"]`; keep `tests/test_182_canvas_gate.py` + `tests/test_184_uat02_staleness_bound.py` green.

### `backend/tests/unit/test_276_openapi_snapshot_fresh.py` (test)

**Analog:** `test_270_download_url.py:27` repo-path idiom:
```python
DOCUMENTS_PY = Path(__file__).resolve().parents[2] / "app" / "api" / "documents.py"
```
→ `SNAPSHOT = Path(__file__).resolve().parents[3] / "docs" / "public" / "api" / "openapi.snapshot.json"`; generate with `FastAPI.openapi(app)` (class method, bypasses the canvas hook); failure message names `backend/venv/Scripts/python scripts/export-openapi.py`.

### `scripts/export-openapi.py` (utility script)

**Analog:** `scripts/measure-recall.py:2-38`:
```python
"""Phase 241 Plan 01 — ... Run it with the backend virtualenv, from the repository root::

    backend/venv/Scripts/python scripts/measure-recall.py \\
"""
from __future__ import annotations
...
_BACKEND_ROOT = _REPO_ROOT / "backend"
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from app.services.recall_eval import (  # noqa: E402  (path setup must precede the import)
```
Share the generate+normalize function with the drift test (one home) — e.g. the test imports it, or both call a tiny helper.

### `deploy/onebox.env.example` + `docs/OPERATOR.md` (meaning of `ENVIRONMENT` changes)

Current text to correct (`onebox.env.example:157-159`):
```
# ENVIRONMENT — deploy marker only. As of Phase 146 it NO LONGER gates /admin
# (OPERATOR_EMAILS + the operator_users table do). Set for cleanliness.
ENVIRONMENT=production
```
and `OPERATOR.md:103-106` ("`ENVIRONMENT` is only a deploy marker"). Name unchanged → `check-deploy-drift.sh` check 1 is unaffected; still run it.

---

### `frontend/docs.html` (entry HTML)

**Analog:** `frontend/index.html:1-27`. Copy head (charset, favicon, viewport, the identical Google Fonts `<link>` trio). **Drop** the localStorage theme `<script>` (`:14-21`) and the Tailwind body classes (`:23`) per UI-SPEC. Mount point pattern:
```html
    <div id="landing-root"></div>
    <script type="module" src="/src/landing/main.tsx"></script>
```
→ `<div id="docs-root" class="docs-root">` + `/src/docs/main.tsx`; `<title>Syrel Docs</title>`, `lang="en"`.

### `frontend/src/docs/main.tsx`

**Analog:** `frontend/src/landing/main.tsx:1-12` (verbatim shape):
```tsx
const rootElement = document.getElementById("landing-root")
if (rootElement) {
  ReactDOM.createRoot(rootElement).render(
    <React.StrictMode>
      <LandingPage />
    </React.StrictMode>,
  )
}
```
No `AuthProvider`/`StreamsProvider`/`OrgProvider`/`useAuth` — the fence asserts this (`landingBundleFence.test.ts:131-137`).

### `frontend/vite.config.ts` + `frontend/devRouting.ts`

**Current rewrite to extract** (`vite.config.ts:7-23`):
```ts
  const rewrite = (req: any, _res: any, next: () => void) => {
    const rawUrl = req.url || "/"
    const pathname = rawUrl.split("?")[0]
    if (
      pathname !== "/" &&
      !pathname.includes(".") &&
      !pathname.startsWith("/@") &&
      !pathname.startsWith("/__") &&
      !pathname.startsWith("/src") &&
      !pathname.startsWith("/node_modules")
    ) {
      const search = rawUrl.includes("?") ? "?" + rawUrl.split("?").slice(1).join("?") : ""
      req.url = "/app.html" + search
    }
    next()
  }
```
Move the decision into `rewriteDevUrl()` (RESEARCH Pattern 1), `/docs` rule BEFORE the `app.html` rule; keep `configureServer` + `configurePreviewServer` registration (`:25-33`).

**Multi-entry input** (`:48-55`) — add `docs: path.resolve(__dirname, "docs.html")`:
```ts
  build: {
    rollupOptions: {
      input: {
        landing: path.resolve(__dirname, "index.html"),
        app: path.resolve(__dirname, "app.html"),
      },
```
**Alias block** (`:43-47`) — add `"@video"`, plus `resolve.dedupe` and `server.fs.allow` per RESEARCH §Remotion Player Embedding. Mirror the alias in `vitest.config.ts:17-21` and `tsconfig.app.json:27-30` (`"@video/*"` + `remotion`/`@remotion/*`/`mediabunny` → `./node_modules/...`).

### `frontend/plugins/docsContent.ts` (Vite plugin)

**Analog (shape only):** `vite.config.ts:25-33` — the repo's only plugin:
```ts
  return {
    name: "app-routing-middleware",
    configureServer(server) { server.middlewares.use(rewrite) },
    configurePreviewServer(server) { server.middlewares.use(rewrite) },
  }
```
Add `resolveId`/`load` for `virtual:docs-manifest`, `generateBundle` → `this.emitFile` for `docs-assets/search-index.json`, and a dev middleware serving `/docs-assets/*` + `/vo/*` (from `video/public/vo`). All parsing delegated to `scripts/lib/docs-content.cjs`.

### `frontend/vercel.json`

**Analog:** itself `:94-113`. Append after the host-scoped `app\.(.*)` rule (order matters; filesystem precedes rewrites):
```json
    {
      "source": "/(.*)",
      "has": [ { "type": "host", "value": "app\\.(.*)" } ],
      "destination": "/app.html"
    },
    { "source": "/app", "destination": "/app.html" },
    { "source": "/app/(.*)", "destination": "/app.html" }
```
Redirects block (`:4-93`) untouched. `vercelRouting.test.ts` should simulate redirects → filesystem → rewrites against the parsed JSON.

### `frontend/nginx.conf`

**Analog:** itself `:13-15`:
```nginx
    location / {
        try_files $uri $uri/ /index.html;       # SPA client-side routing fallback
    }
```
Add `location = /docs` / `location /docs/` blocks before it (RESEARCH Pattern 1); decide on Pitfall 12 (`/app` → `/app.html`) explicitly — fold or seed.

### `frontend/Dockerfile` + `docker-compose.prod.yml` (context moves to repo root, D-23)

`docker-compose.prod.yml:22-32`:
```yaml
  frontend:
    build:
      context: ./frontend
      args:
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        ...
```
→ `context: .` + `dockerfile: frontend/Dockerfile`. `Dockerfile:40-48` today does `COPY package.json package-lock.json ./` then `COPY . .` then `RUN npx vite build`, and `:53` `COPY nginx.conf ...` — every COPY path gains a `frontend/` prefix, plus explicit COPYs of `docs/public`, `docs/history`, `video/src`, `video/public/vo`. Keep the header-comment style (why each line exists). Run `bash scripts/check-deploy-drift.sh` (its compose check `:217-240` falls back to a structural grep when Docker is denied — expected WARN locally).

### `scripts/lib/docs-content.cjs` (shared parser — one home)

**Analog:** `scripts/check-seeds-register.cjs:239-286` — the directory is a PARAMETER so tests can point the same code at a temp fixture:
```js
/**
 * Read the register from `dir` — a PARAMETER, never a module constant, so `--self-test` can point
 * exactly this code at a temp fixture directory rather than at a second implementation of it.
 */
function readRegister(dir) {
  let names;
  try {
    names = fs.readdirSync(dir);
  } catch (e) {
    return { dir, registerSize: 0, entries: [], skipped: new Map(), readError: String(e && e.message) };
  }
  ...
      // ⛔ EVERY early exit increments a counter. ... two
      //    uncounted `continue`s, and that is exactly how it printed `subject: 0 files · gate OK`.
      skip('unreadable', f);
```
Copy: `loadAllPages(root)` takes `root`; every skipped file is counted; never writes. Frontmatter via the `yaml` package (Node side only), not the line-splitter `readKey` the seeds gate hand-rolls.

### `scripts/build-public-openapi.cjs` (filter + `--check`)

**Exit contract analog:** `check-landing-drift.cjs:8-12, 31-43, 283-294`:
```js
 * Exit codes:
 *   0 — Clean ...
 *   1 — Drift ...
 *   2 — Harness error: a required source file could not be read or parsed.
...
function readFileOrDie(relPath) {
  const absPath = path.join(ROOT, relPath)
  if (!fs.existsSync(absPath)) {
    console.error(`[HARNESS ERROR] Missing required source file: ${relPath}`)
    process.exit(2)
  }
```
**Ref-closure to port** (`backend/app/middleware/canvas_gate.py:262-296`):
```python
def _collect_refs(node: Any, into: set[str]) -> None:
    if isinstance(node, dict):
        ref = node.get("$ref")
        if isinstance(ref, str) and ref.startswith(_REF_PREFIX):
            into.add(ref[len(_REF_PREFIX) :])
        for value in node.values():
            _collect_refs(value, into)
    elif isinstance(node, list):
        for item in node:
            _collect_refs(item, into)

def _closure(seed: Iterable[str], definitions: dict) -> set[str]:
    found: set[str] = set(seed)
    pending = list(found)
    while pending:
        name = pending.pop()
        definition = definitions.get(name)
        if definition is None:
            continue
        nested: set[str] = set()
        _collect_refs(definition, nested)
        for new in nested - found:
            found.add(new)
            pending.append(new)
    return found
```
Keep = closure of refs from surviving paths; drop every other schema. `V45_OPERATIONS` list must fail (exit 1) when a listed op is absent.

### `frontend/src/docs/docs.css`

**Analog:** `frontend/src/landing/landing.css` (809 L). `@import "../landing/landing.css"`, then `d-`-prefixed classes scoped under `.docs-root`, with the pinned overrides table in UI-SPEC §Typography. Note `cssClasses.test.ts:16-20` reads only `landing.css`, `scenes/scenes.css`, `index.css` — it lints `src/landing` usage; a docs class used inside `src/landing` (e.g. the shared drawer's `d-btn-block`) must be defined in a stylesheet that lint reads, or the drawer's own stylesheet added to that list.

### Docs components / pages (`frontend/src/docs/**`)

**Analog:** `frontend/src/landing/components/*` — plain function components, inline `style={{...}}` with Deep Midnight HSL literals, `className="wrap"`, no Tailwind/shadcn/lucide. Example idiom (`Navigation.tsx:1-3,17-25`):
```tsx
export function Navigation() {
  const appUrl = (import.meta.env.VITE_APP_URL as string | undefined) || "/app"
  const demoUrl = (import.meta.env.VITE_DEMO_URL as string | undefined) || "#start"
  ...
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
```
Imports allowed: `src/landing/**`, `src/docs/**`, packages, `@video/**` (lazy only). No `@/lib`, `@/components`, `@/providers`, `@/hooks/useAuth` (fence-enforced). Markdown via `react-markdown` + `remark-gfm` (already deps), no `rehype-raw`.

### `frontend/src/docs/__tests__/docsBundleFence.test.ts` + `src/landing/__tests__/landingFirstPaintFence.test.ts`

**Analog:** `frontend/src/landing/__tests__/landingBundleFence.test.ts` (copy, don't share — repo precedent).

Bootstrapping (`:1-20`) — node fs through `vi.importActual`, `SRC_DIR` from `import.meta.url`:
```ts
const nodeFs = await vi.importActual<{ readFileSync(...): string; existsSync(...): boolean; statSync(...): { isFile(): boolean } }>("node:fs")
...
const SRC_DIR = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/landing/__tests__/"
  ...
```
Forbidden lists (`:22-32`) and crawler (`:62-92`). The crawler's regex treats `import("…")` as static:
```ts
  const importRegex = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]|import\(['"]([^'"]+)['"]\)/g
```
and `resolveModulePath` (`:34-60`) skips anything not `.`/`@/`. For the **first-paint** fence: drop the `import\(` alternative, follow `@video/` + `../video/`, and add forbidden specifiers `remotion`, `@remotion/*`, `@scalar/*`, `minisearch`, `@video/*`, `src/docs`. For the **docs** fence: re-root at `src/docs/main.tsx`, marker `/src/docs/__tests__/`, keep the app-path forbidden list. Keep the provider assertion block (`:131-137`).

### Docs unit tests (`router`, `search`, `changelog`, `publicOpenapi`, `Stub`, `devRouting`, `vercelRouting`)

**Analog:** `src/landing/__tests__/LandingPage.test.tsx:1-40` (RTL render + `matchMedia` stub at `:5-18`) for component tests; node-only logic tests import the pure modules (`devRouting.ts`, `docs-content.cjs`). Assert rendered **words** (e.g. "Not yet released", "Full guide coming"), never `data-testid` presence (CLAUDE.md G-8 finding).

### `scripts/vitest-count-gate.cjs` (both knobs)

TARGETS (`:4508-4511`):
```js
const TARGETS = [
  // Phase 226 (merge commit) — the public landing page: fence, facts, CSS-class lint, scenes, page.
  "src/landing",
  "src/components/workflows",
```
→ add `"src/docs"` with a one-line phase comment (276-02).
BASELINE (`:418-423`):
```js
  // Phase 226 — src/landing (pinned at the merge commit; ...)
  "landingBundleFence.test.ts": 2,
  "facts.test.ts": 5,
  "cssClasses.test.ts": 1,
  "scenes.test.tsx": 9,
  "LandingPage.test.tsx": 7,
```
→ add a `// Phase 276 — src/docs + new landing fences` block with counts read from the gate's own printed column. One plan (276-04, last to close) does the final pin pass.

---

### `frontend/src/landing/components/Navigation.tsx` (rename + logo + Docs + drawer)

**Brand block to replace** (`:26-63`): gradient tile `div` + inline layers SVG + `<span className="hl">Agentic RAG</span>` → `<a href="/" aria-label="Syrel home"><img src="/brand/syrel-lockup-iris.svg" height={28} alt="" /></a>` (use `<img>`, never inline — duplicate `id="g"` gradients, Pitfall 9).
**Link idiom** (`:66-72`), repeated per link:
```tsx
          <a
            className="hide-m"
            href="#features"
            style={{ fontSize: 14, color: "hsl(220 16% 65%)", padding: "0 8px" }}
          >
```
→ hrefs become `/#features` etc.; add `Docs` (`/docs`); `current?: "docs"` prop sets `aria-current="page"`. `.hide-m` hides all links ≤ 720 px today with no drawer — the Menu button + drawer are new. Every new class must exist in `landing.css` (`cssClasses.test.ts`).

### `frontend/src/landing/components/LandingFooter.tsx`

`:20` `fontSize: 13` → 14 (UI-SPEC); `:26` `<span>© {currentYear} Agentic RAG</span>` → mark `<img>` + `© {year} Syrel`; link list `:27-45` gains Docs + Changelog, hash links → `/#security`.

### `frontend/src/landing/components/HeroSection.tsx` (+ `HeroPromo.tsx`)

**Effect + reduced-motion idiom to copy** (`:10-36`):
```tsx
  useEffect(() => {
    const stage = stageRef.current
    ...
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    if (mediaQuery.matches) return
    ...
    stage.addEventListener("mousemove", handleMouseMove)
    return () => {
      stage.removeEventListener("mousemove", handleMouseMove)
```
Section layout: `<section ...>` at `:41`, stage `.wrap` blocks at `:43`/`:117`, facts strip `.wrap` at `:754`, `</section>` at `:818`. Promo slot = last element inside the section (UI-SPEC P9). IntersectionObserver attached after `load` + first scroll → `import("./HeroPromo")` (the only dynamic import; first-paint fence must still pass).

### `video/src/promo/SyrelPromo.tsx` `PromoBody` (muted web playback)

**Gate to copy** (`video/src/energetic/kit.tsx:24-35`):
```tsx
export const AudioOn = createContext(true);

export const Sfx: React.FC<{ at: number; src: string; volume?: number }> = ({ at, src, volume = 0.4 }) => {
  const { fps } = useVideoConfig();
  const audioOn = useContext(AudioOn);
  if (!SFX_ENABLED || !audioOn) return null;
```
**Ungated today** (`SyrelPromo.tsx:319,327`):
```tsx
export const PromoBody: React.FC<{ musicSrc?: string }> = ({ musicSrc = MUSIC.src }) => {
  ...
      <Audio src={staticFile(musicSrc)} volume={1} />
```
→ wrap in the same `useContext(AudioOn)` check (or accept `musicSrc: null`, as `SyrelEnergetic` does via `defaultProps={{ musicSrc: null }}` at `Root.tsx:56-61`). D-19: web copy `syrel-pulse.mp3` ≤ 1.5 MB.

**Composition facts for the registry** (`Root.tsx`, `clips/FeatureClip.tsx:35,92`): `FeatureClip` needs `inputProps={{ id }}` + `durationInFrames={clipDuration(id)}`; `SyrelPromo` = `PROMO_DURATION` (`SyrelPromo.tsx:352`); docs-home slot = `SyrelEnergetic` / `ENERGETIC_DURATION` (D-18, overrides UI-SPEC's `SyrelOverview`). `BrandedEpisode` is render-only (not in the browser).

### `video/src/components/ui.tsx` `LogoPlaceholder` (`:148-172`)

Dashed box with the text "Syrel / logo" → Iris mark/lockup JSX; suffix gradient ids with `useId()` (Pitfall 9). Keep the `size` prop signature (`React.FC<{ size?: number }>`) so every call site is untouched.

### `frontend/src/components/layout/NavPanel.tsx` (FIRES — asset swap only)

`:256-258`:
```tsx
        <div className="flex items-center justify-center w-8 h-8 rounded-lg gradient-primary shadow-sm shadow-primary/20 shrink-0">
          <Sparkles className="w-4 h-4 text-white" />
        </div>
```
→ `<img src="/brand/syrel-mark-iris.svg" ...>`; drop the `Sparkles` import only if now unused. Ledger row + section, same commit.

### `frontend/src/components/auth/AuthCardShell.tsx` + `pages/AuthPage.tsx` (D-21)

`AuthCardShell.tsx:39-43` (same `gradient-primary` + `Sparkles` tile, 14×14) → mark `<img>`; `AuthPage.tsx:16` `title="Agentic RAG"` → `"Syrel"`. Check `check-hot-file-ledger.cjs --files` for both (likely `[no-row]` → add rows at planning time).

### `frontend/src/landing/__tests__/landingBrand.test.ts` + `LandingPage.test.tsx`

**Analog:** `cssClasses.test.ts:1-33` — `vi.importActual("node:fs")`, landing dir from `import.meta.url`, readdir + regex. Assert zero `/Agentic RAG/` across `src/landing/**/*.{ts,tsx,css}` + `frontend/index.html`, refuse if file count < 20. `LandingPage.test.tsx:25` `getAllByText(/Agentic RAG/i)` → `/Syrel/i`; `:38-40` expects first Sign in href `/app` (unchanged).

### `frontend/index.html`

`:7-8` description + `<title>Agentic RAG — AI Knowledge &amp; Autonomous Workflows</title>` → `Syrel — ...` (UI-SPEC P9).

---

### `scripts/check-docs-coverage.cjs` (DOCS-02 gate)

**Analog:** `scripts/check-landing-drift.cjs` — header + exit codes (`:2-12`), `findRepoRoot` (`:18-27`; add a `--root` override so the planted-defect test can point at a temp copy), `readFileOrDie` (`:31-43`), block-then-key extractors, grouped report (`:283-294`).

Extractors to reuse verbatim:
```js
// tool:<name>  (check-landing-drift.cjs:153-157)
const registryBlockMatch = toolDispatcherPy.match(/_TOOL_REGISTRY:\s*dict\[str,\s*Callable\]\s*=\s*\{([\s\S]*?)\n\}/)
const extractedToolKeys = registryBlockMatch
  ? Array.from(registryBlockMatch[1].matchAll(/"([^"]+)":/g)).map((m) => m[1])
  : []

// settings-tab:<slug>  (check-landing-drift.cjs:238-249) — <TabsList>…<TabsTrigger>…</TabsTrigger>,
// mapping `retrievalTabLabel` → a stable slug.
```
**Refuse-empty idiom** (`check-landing-drift.cjs:219-222`) — apply per source with a floor:
```js
if (libraryTabsMatches.length === 0) {
  console.error("❌ LANDING DRIFT GUARD BROKEN: could not read TAB_LABELS from LibraryPage.tsx — re-point this extractor rather than trusting its empty result.")
  process.exit(2)
}
```
**Named floor constant** (`check-hot-file-ledger.cjs:44-47`):
```js
/** Non-vacuity floor: ... A parse that yields fewer
 *  than this has bound to the wrong table, and a gate passing over nothing is worse than absent. */
const MIN_SCAN_ROWS = 150;
```
→ one `MIN_*` per source per RESEARCH §Coverage Gate Design table (nav 5, view 8, tool 25, step 7, check 8, router 30, settings-tab 3, inventory 250, pages ≥ 100 at close). Page/frontmatter parsing comes from `scripts/lib/docs-content.cjs` (do not re-implement). Print the `N code keys · M inventory IDs · P pages (W/S)` line so a pass is auditable.

### `.claude/hooks/docs-coverage-guard.js`

**Analog:** `.claude/hooks/landing-drift-guard.js` (79 L) — clone whole. Core (`:15-47, 56-75`):
```js
process.stdin.on('end', () => {
  let filePath = '';
  try { filePath = JSON.parse(raw).tool_input?.file_path || ''; } catch {}
  const TRACKED_TRIGGERS = [ 'facts.ts', 'config.py', 'tool_dispatcher.py', ... 'check-landing-drift.cjs' ];
  if (filePath) {
    const base = path.basename(filePath);
    const touchesTracked = TRACKED_TRIGGERS.includes(base) || filePath.includes('src/landing');
    if (!touchesTracked) process.exit(0);
  }
  ...
  const res = spawnSync(process.execPath, [scriptPath], { cwd: repoRoot, encoding: 'utf8' });
  if (res.status !== 0) {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PostToolUse', additionalContext: [...].join('\n'), exit_code: res.status } }));
    process.exit(0);
  }
```
Triggers per RESEARCH §Wiring (`tool_dispatcher.py`, `phase_types.py`, `validator_kinds.py`, `validators.py`, `main.py`, `nav-items.ts`, `App.tsx`, `SettingsPage.tsx`, `check-docs-coverage.cjs`, `docs-content.cjs`, any path containing `docs/public/`). ⚠ normalise `\` → `/` before `includes('docs/public/')` (Windows paths); the landing guard's `includes('src/landing')` has the same latent issue.

### `.claude/settings.json` (one entry)

**Analog:** `:117-123`:
```json
        "hooks": [
          {
            "type": "command",
            "command": "\"C:/Program Files/nodejs/node.exe\" \"$CLAUDE_PROJECT_DIR\"/.claude/hooks/landing-drift-guard.js",
            "timeout": 5
          }
        ]
```
Same `matcher: "Write|Edit"` block shape. `.claude/` is gate-exempt → record the touch in the ledger section manually.

### `.github/workflows/docs-coverage.yml`

**Analog:** `.github/workflows/landing-drift.yml` (56 L) — header comment naming the local hook as primary (`:1-8`), identical `push.branches` list (`:14`), duplicated `paths` under `push` and `pull_request`, single job:
```yaml
jobs:
  check-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check landing facts against application code
        run: node scripts/check-landing-drift.cjs
```
Paths = the hook's trigger set + `docs/public/**`, `.planning/research/docs-coverage-inventory.md`, the workflow file itself. A second step (or a sibling workflow) runs `node scripts/build-public-openapi.cjs --check` on `docs/public/api/**` + the script.

### `frontend/src/docs/__tests__/docsCoverageGate.test.ts` (planted-defect drive)

**Closest analog:** `scripts/check-seeds-register.cjs:692-740` `--self-test` — temp root via `fs.mkdtempSync(path.join(os.tmpdir(), ...))`, a containment guard before every write, numbered arms each asserting an exit code:
```js
  const writeFixture = (dir, file, body) => {
    const target = path.resolve(dir, file);
    if (target !== rootTmp && !target.startsWith(rootTmp + path.sep)) {
      harness(`refusing to write ${target} — it is outside the self-test temp root ${rootTmp}`);
    }
```
No frontend vitest test spawns a script today (grep: zero `spawnSync` under `frontend/src`) — this is the first. Use `// @vitest-environment node` + `child_process.spawnSync(process.execPath, [script, "--root", tmp])`; arms per RESEARCH §Planted-defect test (baseline 0 · planted tool 1 · planted router 1 · emptied registry 2 · no pages 2). Assert stdout content (`[uncovered] tool:planted_tool`), not just exit codes.

---

## Shared Patterns

### Gate exit contract (0 clear · 1 finding · 2 harness error)
**Source:** `scripts/check-landing-drift.cjs:8-12`, `check-hot-file-ledger.cjs:31`
**Apply to:** `check-docs-coverage.cjs`, `build-public-openapi.cjs` (`--check`), `docs-content.cjs` consumers.
Every extractor refuses an empty/below-floor parse with exit 2 and a message naming the file to re-point (`check-landing-drift.cjs:219-222`). Scan sets come from `readdirSync`/code, never a hand-typed list.

### Local hook primary, CI backstop
**Source:** `.claude/hooks/landing-drift-guard.js` + `.github/workflows/landing-drift.yml` (+ `.claude/settings.json:117-123`)
**Apply to:** docs coverage gate; OpenAPI public-spec `--check`. Hook is silent when clean, emits `hookSpecificOutput.additionalContext` when red, always `exit(0)`.

### Bundle fences (copy the crawler, don't share it)
**Source:** `frontend/src/landing/__tests__/landingBundleFence.test.ts`
**Apply to:** `docsBundleFence.test.ts`, `landingFirstPaintFence.test.ts`. Static-import-only crawl for first-paint; dynamic imports are the allowed path for Remotion/Scalar/search index.

### Landing look (plain CSS + inline styles, no Tailwind/shadcn/icon package)
**Source:** `frontend/src/landing/components/Navigation.tsx`, `landing.css`, `cssClasses.test.ts`
**Apply to:** all `src/docs/**` components and every landing edit. New classes must be defined in a stylesheet the CSS lint reads.

### Backend unit-test conventions
**Source:** `tests/conftest.py:133,147-166,222-226`; `test_182_canvas_auth.py` docstring; `test_270_download_url.py:1-27`
**Apply to:** both `test_276_*.py`. Blanket `get_current_user` override must be popped to exercise real auth; `get_supabase` stubbed via `dependency_overrides`; env flipped with `monkeypatch.setattr(settings, ...)`. Mandatory baseline gate: 71 failed ceiling, zero headroom.

### Correction convention (strike-through + reason, never delete)
**Source:** `backend/app/main.py:765-768` target; CLAUDE.md passim (`~~…~~` + `CORRECTED <date> (Phase N, D-NN)`)
**Apply to:** `main.py` comment, `onebox.env.example:157-158`, `OPERATOR.md:103-106`, stale ledger figures.

### Same-commit sync rules
- Ledger: CLAUDE.md row (cell ≤ 200 chars) + `docs/HOT-FILE-LEDGER.md` section (format at `:5161-5165`) for `main.py`, `NavPanel.tsx`, and any `[no-row]` file (`node scripts/check-hot-file-ledger.cjs 276`). Ledger WATCHES only `backend/app/` + `frontend/src/` and exempts `.json`/`docs/`, so `vite.config.ts`/`vercel.json` are not flagged.
- Deploy parity: compose context + Dockerfile + `onebox.env.example` + `OPERATOR.md` together; `bash scripts/check-deploy-drift.sh`.
- Frontmatter contract: `docs/public/README.md` ↔ `scripts/lib/docs-content.cjs` ↔ `check-docs-coverage.cjs`.
- Vitest gate: TARGETS (runs) + BASELINE (guards) for every new suite.

### Fact derivation (one home, derived from code)
**Source:** `frontend/src/landing/facts.ts` + `check-landing-drift.cjs`; `video/src/promo/SyrelPromo.tsx:4` imports `frontend/src/landing/facts` cross-tree
**Apply to:** docs registry durations (import constants or test literals against `video/src`), changelog (parse `docs/history/v*.md`, refuse < 20 files), MiniSearch `OPTIONS` shared by build + browser.
⚠ `check-landing-drift.cjs` is RED at base (29 vs 30, D-22): every `src/landing` edit trips its hook — record as inherited, do not edit the guard.

---

## No Analog Found

| File | Role | Data Flow | Reason / use instead |
|---|---|---|---|
| `frontend/src/docs/video/RemotionSlot.tsx` | component | event-driven lazy | No `@remotion/player` or `React.lazy` anywhere in `frontend/src` — RESEARCH Pattern 3 |
| `frontend/src/docs/video/YouTubeFacade.tsx` | component | click-to-load | No embeds in repo — RESEARCH §Code Examples (YouTube facade) |
| `frontend/src/docs/components/SearchBox.tsx` (+ MiniSearch index) | component | lazy fetch + query | No client search exists — RESEARCH §Code Examples (search index) |
| `frontend/src/docs/pages/ApiReference.tsx` (Scalar) | component | lazy fetch | No API-reference renderer — RESEARCH §OpenAPI Pipeline step 4 (telemetry/agent OFF) |
| `frontend/src/docs/router.ts` | utility | client History API | App has no router (memory `reference_app_has_no_router`) — hand-written ~40 lines |
| `docs/public/**/*.md` + changelog override map | content | — | New format; frontmatter contract in RESEARCH Pattern 2; fact source `docs/history/v*.md` |

## Metadata

**Analog search scope:** `scripts/`, `.claude/hooks/`, `.claude/settings.json`, `.github/workflows/`, `frontend/` (config, `src/landing`, `src/components/layout`, `src/components/auth`, `src/pages`), `backend/app/{main.py,dependencies.py,config.py,api/,middleware/canvas_gate.py}`, `backend/tests/{conftest.py,unit/}`, `video/src/`, `deploy/`, `docs/{OPERATOR.md,HOT-FILE-LEDGER.md}`, `docker-compose.prod.yml`
**Files scanned:** ~45 read or grepped
**Pattern extraction date:** 2026-10-04
