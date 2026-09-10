/**
 * Vercel Routing Middleware — the app subdomain's ROOT serves the application (SEED-242 / DEBT-04).
 *
 * ⛔ WHY THIS FILE EXISTS, AND WHY `vercel.json` COULD NOT DO IT.
 * Vercel resolves in this order: redirects → FILESYSTEM → rewrites. The build emits BOTH entries
 * (`vite.config.ts` rollupOptions.input): `index.html` = the marketing landing, `app.html` = the SPA.
 * A request for `/` therefore matches `index.html` ON DISK and is answered before any rewrite is
 * consulted — so the host-scoped rewrite in `vercel.json` (`app.* → /app.html`) can never fire for
 * the bare root, no matter how it is written.
 *
 * ⚠ MEASURED, not reasoned about (2026-09-10, against live production):
 *     superrag.cloud/        → 1908 bytes, <title>Agentic RAG — AI Knowledge & Autonomous Workflows>
 *     app.superrag.cloud/    → 1908 bytes, THE SAME LANDING PAGE          ← the defect
 *     app.superrag.cloud/app → 1819 bytes, <title>Agentic RAG>            ← the SPA
 *   The control that isolates the cause: production's `vercel.json` at the time carried exactly one
 *   rewrite, `/(.*) → /app.html`, unconditional across every host — and `/` STILL returned
 *   `index.html`. Same rule, two outcomes; the only difference is that `/` matches a file and `/app`
 *   does not. Filesystem precedence, demonstrated rather than looked up.
 *
 * ⭐ Middleware is the ONLY layer that outranks the filesystem, because it runs before the request
 *   is processed at all. That is the whole reason for the dependency and the cold-start cost.
 *
 * ⚠ THE MATCHER IS THE BLAST RADIUS, and it is deliberately one path. `matcher: '/'` means this
 *   code never runs for assets, `/app`, `/setup`, `/invite`, or anything else — so every route that
 *   works today is byte-identical tomorrow, and the compute bill is one invocation per root hit.
 *
 * ⚠ A REWRITE, NEVER A REDIRECT. The URL must stay `https://app.<domain>/`: `App.tsx` has no router
 *   and branches on literal `window.location.pathname` checks (`=== "/setup"` at :272, `=== "/invite"`
 *   at :289). `/` matches neither, so the app boots its normal path — which is exactly what is wanted.
 *   A redirect to `/app` would work too but would put a path back in the address bar, which is the
 *   thing this change exists to remove.
 *
 * Hosts other than `app.*` — the apex, `www`, and every `*.vercel.app` preview — fall through to
 * `next()` and keep serving the landing page from disk, unchanged.
 */
import { next, rewrite } from "@vercel/functions"

export const config = {
  // ⚠ Only the bare root. See the blast-radius note above before widening this.
  matcher: "/",
}

export default function middleware(request: Request) {
  const { hostname } = new URL(request.url)

  // `app.` prefix rather than an exact hostname: the same build serves the production subdomain and
  // any future `app.<other-domain>`, and no environment variable is readable here at request time.
  if (hostname.startsWith("app.")) {
    return rewrite(new URL("/app.html", request.url))
  }

  return next()
}
