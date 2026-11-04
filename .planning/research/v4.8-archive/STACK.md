# Stack Research — v4.8 "Every Page Has a Link"

**Domain:** Adding URL routing, an app-owned mailer and run-waiting notifications to a shipped React + Vite SPA with a FastAPI backend (Agentic RAG / "Syrel")
**Researched:** 2026-10-27
**Confidence:** HIGH for versions, bundle cost and hosting behaviour (measured). MEDIUM for the router choice, which is a judgement between two good options. LOW for SMTP egress from the Hostinger VPS (not measured; we avoid depending on it).

> Scope: only what the three new capabilities need. RAG, SSE, the harness, connectors, the scheduler, org RLS and Auth are validated and are not re-researched here.

---

## TL;DR — what changes in the stack

| Decision | Recommendation | New dependency? |
|---|---|---|
| Client router | **`react-router@^8.5.0`, data mode (`createBrowserRouter` + `RouterProvider` from `react-router/dom`), used as a router only, with no loaders or actions** | **Yes, one** (frontend) |
| React | Bump `react` and `react-dom` from `^19.2.4` to **`^19.2.9`** (React Router 8 requires `>=19.2.7`) | Version bump |
| CI Node | Bump `frontend-tests.yml` from `node-version: "20"` to **`"22"`** (React Router 8 declares `engines.node >=22.22.0`; Node 20 is past end of life) | No |
| SPA fallback | **No rewrite changes if every new route lives under `/app/…`.** Both hosts already serve `app.html` there (measured on production). Add a parity test instead. | No |
| Mailer transport (cloud) | **Resend REST API called with `httpx`**, which is already a dependency. This replaces the lazy `import resend` in `backend/app/services/email_provider.py`; that package was never installed in any built image. | **No** |
| Mailer transport (one-box / any SMTP) | **stdlib `smtplib`** run off the event loop (`asyncio.to_thread` or `run_in_threadpool`), added as `EMAIL_PROVIDER=smtp` | **No** |
| Email templates | **Jinja2 3.1.6** (already declared) with `select_autoescape(["html"])` and an HTML part plus a plain-text part | No |
| In-app notification store | **A Postgres table with RLS, an outbox drained with `FOR UPDATE SKIP LOCKED`, Realtime as a hint, and TanStack Query fetching the real answer.** No notification library or SaaS. | No |

Net: **one new frontend package, zero new Python packages.**

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|---|---|---|---|
| `react-router` | **8.5.0** (2026-10-19; v8.0.0 shipped 2026-06-17) | URL ↔ view and entity routing, Back/Forward, link clicks, navigation blocking | Most proven SPA router. Declarative and data modes run against the same route table, so we can adopt it without restructuring the app. Data mode adds `useBlocker`, which we need now that Back/Forward can leave a dirty Builder, connection form, round-limits or model-registry editor. It is headless, so all data stays in TanStack Query. |
| `react` / `react-dom` | **19.2.9** (patch on the installed 19.2 line, 2026-10-14) | Peer requirement of React Router 8 (`>=19.2.7`) | Patch-only bump that stays on 19.2.x. **19.3.x is deliberately not adopted here**: it is a minor-line change with its own surface (including `<ViewTransition>`), and nothing in this milestone needs it. Every pinned peer accepts 19.2.9 (checked: remotion and @remotion/* `>=16.8`, @xyflow/react `>=17`, @scalar `^18 \|\| ^19`, @lobehub/icons `^19`). |
| Resend REST API via `httpx` | API `POST https://api.resend.com/emails`; `httpx>=0.28.0` already declared | App-owned transactional email in cloud | **Port 443, so the open question of whether the Hostinger VPS allows outbound SMTP never arises.** `Idempotency-Key` (24 h window, at most 256 chars) prevents a double send across the two uvicorn workers. Async-native. The `test_189_no_egress` sentinel already intercepts `httpx.AsyncClient.send`. Free tier: 3,000/month and 100/day; Pro is $20/month for 50k. |
| stdlib `smtplib` | Python stdlib | `EMAIL_PROVIDER=smtp` for the self-hosted one-box and any operator-supplied relay | No dependency. It is the library `security/egress.py` already binds, `test_189_no_egress` already patches `smtplib.SMTP.__init__`, and `test_190_smtp_header_injection` gives a CRLF-refusal precedent to copy. Every major provider (Resend, Postmark, SES, Mailgun, Workspace relay, Postfix) speaks SMTP, so one-box operators can use whatever they have. |
| Jinja2 | **3.1.6** (already in `requirements.txt`) | HTML and text email bodies | Already a direct dependency (`docxtpl` uses it). Turning autoescape on replaces the hand `html.escape` calls in `ResendProvider`, which is the WR-02 class of bug fixed once for all templates. |
| Postgres + Supabase Realtime + TanStack Query | existing (`@tanstack/react-query ^5.90.21`, `@supabase/supabase-js ^2.99.2`) | In-app notice of a waiting run, plus the email outbox | Already the pattern (`useDocuments`/`useFolders` use `postgres_changes` as an invalidation hint). It satisfies D-v2.5-03 (Realtime is a hint; reconcile by fetch) and SEED-281's rule that the server derives the verdict. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---|---|---|---|
| (none new) | | Route parameter validation | Validate with a **project-owned pure resolver** (`parseAppLocation(pathname, search) → AppRoute` discriminated union), extending the strict-UUID discipline already in `frontend/src/lib/runDeepLink.ts` and the `resolveRoute` shape in `frontend/src/docs/router.ts`. Do **not** add zod or valibot just for route params. |
| `aiosmtplib` | 5.1.3 (2026-09-08, zero deps) | asyncio-native SMTP | **Only if** SMTP must ever be sent from inside a hot async path. Not recommended now: (1) the outbox worker can use `to_thread` cheaply at notification volume; (2) aiosmtplib bypasses `smtplib.SMTP.__init__`, so `test_189`'s egress sentinel would not see it, and whether its `socket.socket.connect` floor catches an asyncio connect depends on the event loop. That last point is **unverified**. |
| `resend` (PyPI) | 2.50.0 (2026-10-16) | Official Resend SDK | **Not recommended.** The sync path pulls in `requests`; async needs the `[async]` extra. The SDK covers one POST that `httpx` already makes. Note the current state: `email_provider.py` lazy-imports it, it is **absent from `requirements.txt`**, and it is **not installed in the local venv** (`ModuleNotFoundError`, measured). So `EMAIL_PROVIDER=resend` cannot work in any built image today; `org.py` catches the error and only logs it. |

### Development Tools

| Tool | Purpose | Notes |
|---|---|---|
| Mailpit (bundled with local `supabase start`) | Catch local SMTP mail | Point `EMAIL_PROVIDER=smtp` at the local Mailpit SMTP port to drive the SMTP path without a real provider. **Verify the published port** with `docker ps` on the `supabase_inbucket_*` container; no `config.toml` was found in the repo. It falls inside the reserved 54320-54335 block. |
| `frontend/src/lib/activeViewReachability.ts` | Executable inventory of views | Extend it with a **fourth leg** (each `ActiveView` member maps to a route path) so a view without a URL fails CI the way a view without a render branch does today. |
| `scripts/check-landing-first-paint.cjs` | Proves landing first paint carries no app code | Re-run after adding the router. It must be imported only from the `app.html` entry chain, never from `index.html` (landing) or `docs.html`. |

---

## Installation

```bash
# frontend/ — one new package plus a patch bump of React (legacy-peer-deps=true is already set in .npmrc)
npm install react-router@^8.5.0 react@^19.2.9 react-dom@^19.2.9

# backend/ — nothing to install. httpx, jinja2 and smtplib (stdlib) are already present.
```

```yaml
# .github/workflows/frontend-tests.yml — both jobs (lines 36 and 68)
node-version: "22"   # was "20"; react-router@8 declares engines.node >=22.22.0
```

`frontend/Dockerfile` already builds on `node:22-alpine` (a floating tag, so it resolves to the current 22.x). **Vercel's project Node version was not checked**: confirm it is 22.x or 24.x in project settings. npm only warns on `engines` (no `engine-strict`), so a mismatch would not fail the build. It would only mean running outside React Router's support window.

---

## (a) Router choice: the evidence

### Measured bundle cost

I built a minimal app with esbuild (minified, React external, `NODE_ENV=production`, router + params + search + navigate + Link) against React 19.3.1 in the scratchpad:

| Router | min | **min+gzip** | Notes |
|---|---|---|---|
| wouter 3.13.0 | 6.4 KB | **3.1 KB** | |
| react-router 8.5.0, declarative (`BrowserRouter`) | 42.3 KB | **15.1 KB** | no `useBlocker` |
| @tanstack/react-router 1.170.46 | 78.5 KB | **28.3 KB** | |
| react-router 8.5.0, data mode (`createBrowserRouter`) | 100.6 KB | **33.4 KB** | `useBlocker`, `ScrollRestoration`, `useNavigation` |

(Bundlephobia's whole-package figures, 63.7 KB gz for react-router and 31 KB for TanStack, overstate the tree-shaken cost; use the table above.) All of these load **only in the `app.html` chunk**. The landing page and docs are unaffected.

### Why React Router 8 in data mode

1. **Incremental adoption fits this code.** Navigation today is one `useState<ActiveView>` in `App.tsx`, with about 13 call sites going through `handleNavigate` and the setters passed down to `ChatLayout`. The lowest-risk migration keeps those signatures. `activeView` becomes **derived** from `useLocation()` via the pure resolver, and `setActiveView(v)` becomes `navigate(pathFor(v))`. React Router does this with one layout route whose `Component` is the existing shell. No component below `ChatLayout` has to change.
2. **`useBlocker` is the reason to choose data mode over declarative.** Back/Forward is a new exit from views with unsaved state (`BuilderSaveRegion`, `ConnectionFormPanel`, `AgentRoundLimits`, `ModelRegistryTab`, `InlineEdit` all carry dirty state). In React Router, `useBlocker` exists **only** in data mode (confirmed in the official "Picking a mode" docs). The extra 18 KB gz buys that guard without changing library later.
3. **Use it as a router, not a data layer.** No `loader`/`action`/`Form`. Data stays in TanStack Query and the SSE providers. Mixing two data layers is the expensive mistake.
4. **Typed params come from our resolver, not the library.** The values arrive in shared links and are attacker-controlled. The project already treats them that way (`runDeepLink.ts` accepts a strict UUID or `null`). One resolver, unit-tested as a pure function, is stronger and more auditable here than library-level typing.

### Why not TanStack Router (a close second)

Its strengths are real: first-class typed params, `validateSearch`, it pairs with the TanStack Query we already use, and it is smaller than RR data mode (28 vs 33 KB gz). It loses on **adoption cost in G-5 hot files**. Its type safety is earned by making the route tree the architecture: a registered router type, `from`-scoped hooks, and in practice the file-based codegen plugin that emits `routeTree.gen.ts`. That restructures `App.tsx` (28 phases) and `ChatLayout.tsx` (33 phases) far more than a derived `activeView` does, and adds a generated file to a repo with hot-file and size gates. **Choose it instead if** the team decides to make routes the primary architecture (per-route code splitting, route-level data preloading) rather than an address bar for the existing shell.

### Why not wouter

At 3 KB it is the lightest, and its hooks work **without** a provider, which would spare many existing tests. But it has **no navigation blocker**, no navigation-type signal for scroll restoration, and a much smaller maintainer base. The blocker gap alone disqualifies it for a product with dirty editors.

### Why not keep hand-rolling (the `docs/router.ts` pattern)

That pattern is fine for read-only docs. For the app it would mean reimplementing correct `<a>` click semantics (modifier keys, middle-click, `target`), history listening via `useSyncExternalStore`, blocking on POP navigations, and scroll restoration. Each is a known bug farm.

### React Router 8 facts that bind the plan (from the official CHANGELOG)

- **ESM-only**; minimums **React 19.2.7+**, **Node 22.22.0+**. **Vite 7+** applies only to `@react-router/dev` (framework mode, which we do not use). We are on Vite 8 regardless.
- **`react-router-dom` is removed.** Import from `react-router`, and import `RouterProvider` from **`react-router/dom`**. Training data and most web examples still say `react-router-dom`, and that import fails under v8.
- Middleware is always on in data mode; harmless with no loaders.
- 8.5 deprecates the RR view-transition APIs in favour of React 19.3's `<ViewTransition>`. Do not adopt either.
- Yearly major cadence: **v9 is expected around May 2027** (when Node 22 reaches end of life). Budget an upgrade then.

### Integration rules (the ones that prevent a rewrite)

- **Keep router hooks at the shell boundary** (`App`/`ChatLayout`) and keep passing navigator callbacks down as props, as today. `useNavigate()` outside a router **throws**. Pushing hooks into leaf components would force a router wrapper into a large share of existing vitest suites and collide with the per-file count gate.
- **`/setup` and `/invite` keep their current pre-router short-circuits** (`App.tsx:320`/`:337`) so the finalized-lockout and invite flows stay byte-for-byte (SEED-185 note 3).
- **Legacy URLs keep working:** `/app?run=<uuid>` (Phase 289, already shared in production) becomes `<Navigate replace>` to the canonical run path. `/app?connections=1&…` is built server-side by the OAuth callbacks (eight redirect sites via `primary_frontend_origin()`). Keep reading it, or change those sites in the same phase. `/admin/spend` is the same.
- **`app.<domain>/`** is rewritten to `app.html` by `frontend/middleware.ts` *without* changing the URL (SEED-242 wanted no path in the bar). So the route table needs `/` **and** `/app` both mapped to home. **Do not** add a redirect from `/` to `/app`.

---

## (b) SPA fallback on Vercel and nginx

**Measured against production on 2026-10-27:**

| Request | Result |
|---|---|
| `https://app.superrag.cloud/app/runs/<uuid>` | **200**, `<title>Syrel</title>` (app.html) |
| `https://app.superrag.cloud/app/a.b` (a dot in the path) | **200**, app.html |
| `https://superrag.cloud/app/runs/x` | **308** → `https://app.superrag.cloud/app/runs/x` |
| `https://superrag.cloud/app?run=abc` | **308** → `https://app.superrag.cloud/app?run=abc` (query preserved) |
| `https://agentic-rag-rho.vercel.app/app` | **308** → `https://app.agentic-rag-rho.vercel.app/app` → **DNS failure (curl 000)** |

**Conclusions:**

1. **Put every new route under `/app/…` and Vercel needs no change.** The `app.*` host-scoped catch-all `/(.*) → /app.html` already covers it, and the apex redirects preserve path and query.
2. **nginx (one-box) needs no change either.** `location /app/ { try_files $uri /app.html; }` already serves every `/app/*` deep link. `app.html` references assets by absolute `/assets/…` (Vite `base` is the default `/`), so nested paths load correctly.
3. ⚠ **Do not create top-level app routes outside `/app/`** (for example `/threads/:id`). On the one-box, `location /` falls back to **`index.html`, the landing page**, so such a link would silently open marketing. Adding one would need matching edits in `vercel.json` redirects and rewrites, `frontend/nginx.conf` and `frontend/devRouting.ts` (the three files `devRouting.ts` says must agree). Keeping one prefix avoids that.
4. ⚠ **No dots in route path segments.** Production serves dotted paths, but `devRouting.ts` passes any dotted path through as a file, so it **404s in dev only**. UUIDs and slugs are fine; put filenames or versions in the search string.
5. ⚠ **Pre-existing, out of scope but relevant:** the apex redirect's host regex matches `*.vercel.app`, so **preview and `vercel.app` deployments cannot open the app at all** (they redirect to a non-existent `app.<preview>.vercel.app`). Deep links make that host more visible; record it, do not silently fix it inside the router phase.
6. **Add a parity test, not a rule change:** enumerate the route table's top-level prefixes and assert that each one is covered by `devRouting.ts`, `vercel.json` and `nginx.conf`. This is the same three-file agreement as the existing `devRouting.test.ts`, driven from the router's own table.

---

## (c) App-owned transactional email

**A mailer seam already exists, and it is broken in every built image.** `backend/app/services/email_provider.py` (Phase 167) has an `EmailProvider` protocol switched by `EMAIL_PROVIDER = none | resend`, with `RESEND_API_KEY` and `INVITE_FROM_EMAIL` already in `onebox.env.example`, `docker-compose.prod.yml`, `docs/OPERATOR.md` and `check-deploy-drift.sh`. The `resend` provider lazy-imports a package that is in no requirements file and no image, so it raises, and `org.py` swallows the error into a log line. (SEED-281's "no app-owned mailer exists" was therefore half-true: there is a seam, but no working sender.)

**Recommendation: extend that seam rather than build a second one.**

| Provider value | Transport | For | Secrets (env only) | Infra (env) |
|---|---|---|---|---|
| `none` (default, unchanged) | log the link | offline and dev | none | none |
| `resend` | **`httpx.AsyncClient` → `POST https://api.resend.com/emails`**, `Authorization: Bearer`, `Idempotency-Key: <outbox row id>` | Vercel/Coolify cloud | `RESEND_API_KEY` (existing) | none |
| `smtp` (new) | stdlib `smtplib` (`SMTP_SSL` on 465 or `starttls` on 587) via `to_thread` | one-box, any relay | `SMTP_PASSWORD` | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_SECURITY` (`ssl\|starttls`) |

- **Generalize the protocol** from `send_invite(...)` to `send(message: OutboundEmail)`. Re-express invites on it so both kinds of mail share one transport and one escaping boundary.
- **Non-secret knobs go to `app_settings` and the Settings UI** (CLAUDE.md rule, plus the operator's "everything in the UI except secrets"): notifications on or off, sender display name and from-address (env `INVITE_FROM_EMAIL` stays as a seed or fallback), and the N-2 "about to expire" lead time. Per-user opt-out goes in `user_settings`. SMTP host and port are infra; they also belong in the one-box first-run setup overlay (`INFRA_KEYS`).
- **Links in mail** are built with the existing `primary_frontend_origin()` + `/app/runs/<id>` (never the raw comma-separated `FRONTEND_URL`, per BUG-260904-04). On cloud, if the primary origin is the apex, the link takes one 308 hop to `app.` and still lands correctly (measured above).
- **The mailer is not a connector.** Put it beside `email_provider.py`, never under `services/connectors/`. The connector source fences ban `smtplib.`, `httpx.` and `.sendmail(` there, and egress pinning exists for *user-configured* hosts, whereas these hosts are operator env.
- **Deployment-artifact parity (same commit):** the new `SMTP_*` vars plus any changed meaning of `EMAIL_PROVIDER` must update `deploy/onebox.env.example`, `docs/OPERATOR.md` (which today tells operators to `pip install resend` into the container, a step that dies with the container), `docker-compose.prod.yml` and `scripts/check-deploy-drift.sh`.

### Provider comparison (cost and ecosystem, for the cloud sender)

| Option | Python story | Price (verified 2026-10-27) | Verdict |
|---|---|---|---|
| **Resend (REST via httpx)** | No SDK needed; official SDK 2.50.0 exists | Free 3k/month, 100/day; Pro $20/month for 50k | **Recommended.** It is already the configured provider name, has idempotency keys, uses port 443, and the free tier covers approval notices. |
| Postmark | **No official Python SDK**; community `postmarker` was last released 2022-01 | Free 100/month; $15/month for 10k, then $1.80 per 1k | Strong deliverability, but costs more and has a stale client. Reachable later through `smtp` with no code change. |
| AWS SES | `boto3` 1.43.x (heavy, sync), IAM setup, sandbox exit request | about $0.10 per 1k (training data, not re-verified) | Cheapest at volume, highest setup cost. Overkill for N-1..N-4. Reachable through `smtp` if ever wanted. |
| Plain SMTP only | stdlib | provider-dependent | Shipped as the one-box path. As the *cloud* path it depends on outbound SMTP ports from the Hostinger VPS: Hostinger says port 25 is open and caps at 5 mails/minute, and **465/587 are unverified**. Resend's alternative ports 2465/2587 are a fallback if needed. |

---

## (d) In-app notification store: build on what exists

**Use Postgres + RLS + the existing Realtime-as-hint + TanStack Query. Add no library.**

- **Read side:** a server-computed answer to "is anything waiting on me", registered as the second `ATTENTION_PRODUCERS` tenant in `frontend/src/components/layout/attentionConditions.ts` (the seam SEED-281 names; re-baseline `NavPanel.badge.test.tsx`'s literal `length === 1` in the same commit). The verdict comes from the server (D-235-05), derived from the existing pending-ask rows, **not** from a client scan.
- **Write and delivery side:** a migration (from 217) adds an outbox or notification table with RLS on `user_id` and `org_id`, plus a unique key on `(kind, subject_id, recipient)` so one waiting run produces exactly one email. Drain it in **every** uvicorn worker with `FOR UPDATE SKIP LOCKED` and a lease column. This is the `scheduler_service.py` and `watch_service.py` pattern: no leader election, which matters because a dead leader means silently no email.
- **Realtime:** if the table joins the `supabase_realtime` publication, treat each event only as `queryClient.invalidateQueries(...)`, then fetch (D-v2.5-03). The anon-role blind spot (BUG-260911-01) applies: write an RLS test that queries **as `anon` and as a second user**, not only through the service role.

---

## Alternatives Considered

| Recommended | Alternative | When to Use the Alternative |
|---|---|---|
| React Router 8 data mode | React Router 8 declarative (15 KB gz) | If the team accepts no Back/Forward guard on dirty editors. The swap is mechanical later (same route objects). |
| React Router 8 data mode | TanStack Router 1.170 | If routes become the primary architecture (route-level code splitting and preloading tied to TanStack Query), not just an address bar for the existing shell. |
| Resend over httpx | Resend Python SDK 2.50 | If we later need SDK-only features (batch, templates, webhook verification helpers) and accept `requests` plus a new pin. |
| stdlib smtplib (threaded) | aiosmtplib 5.1.3 | If SMTP is ever sent from an async request path at volume. Extend the egress sentinel first. |
| Postgres outbox + Realtime hint | Novu / Knock / MagicBell / Courier | Never for this product shape. See below. |

## What NOT to Use

| Avoid | Why | Use Instead |
|---|---|---|
| `react-router-dom` | **Removed in React Router v8**; imports fail. Most examples online still use it. | `react-router`, and `react-router/dom` for `RouterProvider` |
| React Router framework mode / `@react-router/dev` | Takes over the Vite build and entry points, and conflicts with the three-entry (`index.html`/`app.html`/`docs.html`) `rollupOptions.input` build and `middleware.ts` | Data mode inside the existing `app.html` entry |
| RR `loader`/`action`/`<Form>` | A second data layer beside TanStack Query and the SSE providers | Router for addressing only |
| Hash routing (`/#/…`) | Avoids rewrites, but breaks the existing `?run=` and OAuth `?connections=1` contracts, cannot be read server-side for email link building, and looks wrong in a B2B product | History routing under `/app/` (rewrites already exist) |
| Routes outside `/app/` | The one-box falls back to the **landing** `index.html` | `/app/<view>/<id>` |
| Novu (self-hosted) | Single-VM minimum is **4 vCPU / 8 GB + MongoDB + Redis with AOF + object storage** (official docs). Our VPS is KVM 1 (1 vCPU / 4 GB). | Postgres table + outbox |
| Knock / MagicBell / Courier (SaaS) | Third-party data processor for org data, a second source of truth, and no one-box story | Same |
| Web Push / service worker | VAPID keys, a service-worker lifecycle and permission prompts. Not needed for N-1 (email already reaches someone outside the app). | Defer; record in SEED-281's register if wanted |
| `premailer` | Last release 2021 | Hand-inline the few styles in one Jinja template |
| Putting the decision (approve/deny) inside the email | SEED-281 rule 2: it needs its own auth story and becomes a second source of truth | Email says "go and look" with a link to `/app/runs/<id>` |
| Using a user's SMTP connector as the sender | Belongs to the user (D-235-02) | `EMAIL_PROVIDER` app-owned sender |

## Stack Patterns by Variant

**Vercel + Coolify cloud:**
- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY` in Coolify env; from-address on a Resend-verified domain (SPF/DKIM DNS at Hostinger is an operator step).
- Deep links: `https://app.superrag.cloud/app/...`; no `vercel.json` change.

**Self-hosted one-box (nginx):**
- `EMAIL_PROVIDER=smtp` + `SMTP_*`, or `none` for link-only (still the default).
- Deep links: `http(s)://<host>/app/...`; no `nginx.conf` change.

**Local dev:**
- `EMAIL_PROVIDER=none`, or `smtp` pointed at local Mailpit.
- Vite `appRoutingPlugin` already rewrites non-dotted `/app/*` to `app.html`.

## Version Compatibility

| Package A | Compatible With | Notes |
|---|---|---|
| react-router@8.5.0 | react / react-dom `>=19.2.7` | Installed is 19.2.4, so the **bump is required**. `npm install` honours `^19.2.4` but lock files pin 19.2.4. |
| react-router@8.5.0 | Node `>=22.22.0` (engines) | CI `frontend-tests.yml` is on Node 20, so bump it. Docker is `node:22-alpine`. Vercel: verify. |
| react-router@8.5.0 | Vite 8.0 (installed) | The Vite 7+ floor applies only to `@react-router/dev`, which we do not use. |
| react@19.2.9 | remotion 4.0.532, @xyflow/react 12.11.2, @scalar/api-reference-react 0.9.77, @lobehub/icons 5.10.0 | All peer ranges accept it (checked via `npm view`). |
| httpx>=0.28 | Resend REST API | Already pinned; egress residual fence (`test_190_residual_fence`) triggers on any httpx bump; that is unrelated to this, but do not bump httpx in the same phase. |
| jinja2 3.1.6 | docxtpl 0.20.x | Already co-installed. |

## Sources

- React Router CHANGELOG (raw, `remix-run/react-router` main): v8.0.0 (2026-06-17) baseline, ESM-only, removed `react-router-dom`; v8.5.0 (2026-10-19). **HIGH**
- https://reactrouter.com/start/modes: declarative vs data mode API availability (`useBlocker`, `ScrollRestoration` are data-mode only). **HIGH**
- npm registry (`npm view`): react-router 8.5.0, @tanstack/react-router 1.170.46 (2026-10-22), wouter 3.13.0, react 19.2.9 / 19.3.1, peer ranges. **HIGH**
- Local esbuild measurement of tree-shaken bundles (scratchpad `rbench/`). **HIGH**, for the shapes measured
- Production probes with `curl` against `superrag.cloud`, `app.superrag.cloud`, `agentic-rag-rho.vercel.app` (2026-10-27). **HIGH**
- PyPI JSON: resend 2.50.0, aiosmtplib 5.1.3, boto3 1.43.119, postmarker 1.0 (2022), premailer 3.10.0 (2021), jinja2 3.1.6. **HIGH**
- https://resend.com/docs/api-reference/emails/send-email (endpoint, `Idempotency-Key` 24 h); https://resend.com/docs/send-with-smtp (ports 465/2465 SMTPS, 25/587/2587 STARTTLS); https://resend.com/pricing. **HIGH**
- https://postmarkapp.com/pricing. **HIGH**
- https://docs.novu.co/community/self-hosting-novu/overview (self-host infrastructure). **HIGH**
- https://www.hostinger.com/support/7854530-is-smtp-port-25-blocked-on-vps/ (port 25 open, 5/minute cap; nothing published on 465/587). **MEDIUM** (465/587 unverified)
- Repo: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/vercel.json`, `frontend/middleware.ts`, `frontend/devRouting.ts`, `frontend/nginx.conf`, `frontend/Dockerfile`, `frontend/src/App.tsx`, `frontend/src/lib/runDeepLink.ts`, `frontend/src/docs/router.ts`, `frontend/src/components/layout/attentionConditions.ts`, `backend/requirements.txt`, `backend/app/services/email_provider.py`, `backend/app/api/org.py`, `backend/app/config.py` (`primary_frontend_origin`), `backend/app/security/egress.py`, `backend/tests/unit/test_189_no_egress.py`, `test_190_residual_fence.py`, `deploy/onebox.env.example`, `backend/.env.example`, `.github/workflows/frontend-tests.yml`, `docs/DEPLOYMENT-PIPELINE.md`.

---
*Stack research for: v4.8 Every Page Has a Link*
*Researched: 2026-10-27*
