// Phase 276-03 — the docs entry's root (replaces 276-02's interim body; routing + manifest contract
// unchanged). It resolves the route against virtual:docs-manifest, renders the page component,
// intercepts same-origin /docs links for client navigation, and on each navigation sets the title,
// scrolls (top or hash), and moves focus to the page H1.
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react"
import { changelog, chapters, loadPage, pages, sections } from "virtual:docs-manifest"
import { LandingFooter } from "../landing/components/LandingFooter"
import { DocsHeader, HERO_SEARCH_ID } from "./components/DocsHeader"
import { SearchBox } from "./components/SearchBox"
import { DocsDataProvider, type DocsData } from "./docsData"
import { Article } from "./pages/Article"
import { Home } from "./pages/Home"
import { NotFound } from "./pages/NotFound"
import { SectionIndex } from "./pages/SectionIndex"
import { Stub } from "./pages/Stub"
import { navigate, resolveRoute } from "./router"
import type { Route } from "./types"

const DATA: DocsData = { sections, pages, changelog, chapters, loadPage }

export function titleFor(route: Route, data: DocsData): string {
  switch (route.kind) {
    case "home":
      return "Syrel Docs"
    case "article":
    case "stub":
      return `${data.pages.find((p) => p.slug === route.slug)?.title ?? "Docs"} · Syrel Docs`
    case "section":
      return `${data.sections.find((s) => s.id === route.sectionId)?.title ?? "Docs"} · Syrel Docs`
    case "changelog":
      return "Changelog · Syrel Docs"
    case "changelog-version": {
      const r = data.changelog.find((x) => x.version === route.version)
      return `${r ? `${r.version} — ${r.name}` : "Changelog"} · Syrel Docs`
    }
    case "api-reference":
      return "Syrel API · Syrel Docs"
    case "not-found":
      return "Page not found · Syrel Docs"
  }
}

function readLocation() {
  return { pathname: window.location.pathname, search: window.location.search, hash: window.location.hash }
}

function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
}

/** Intercept a click on a same-origin /docs link (not /docs-assets, not a modified click). */
function interceptDocsLink(e: MouseEvent<HTMLDivElement>) {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
  const a = (e.target as HTMLElement).closest("a")
  if (!a || !a.getAttribute("href") || (a.target && a.target !== "_self") || a.hasAttribute("download")) return
  const url = new URL(a.href, window.location.href)
  if (url.origin !== window.location.origin) return
  if (!(url.pathname === "/docs" || url.pathname.startsWith("/docs/"))) return
  // A same-page hash link is the browser's job (the default jump keeps working).
  if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return
  e.preventDefault()
  navigate(url.pathname + url.search + url.hash)
}

export function DocsApp() {
  const [loc, setLoc] = useState(readLocation)
  const fresh = useRef(false)

  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      fresh.current = !!(e.state && (e.state as { docsNavigate?: boolean }).docsNavigate)
      setLoc(readLocation())
    }
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const route = useMemo(() => resolveRoute(loc.pathname, DATA), [loc.pathname])
  const routeKey = `${route.kind}:${route.slug ?? route.sectionId ?? ""}:${route.version ?? ""}`

  useEffect(() => {
    document.title = titleFor(route, DATA)
  }, [route])

  // On navigation: scroll (top or hash target) and move focus to the H1.
  const first = useRef(true)
  useEffect(() => {
    if (first.current) {
      first.current = false
      if (loc.hash) document.getElementById(decodeURIComponent(loc.hash.slice(1)))?.scrollIntoView()
      return
    }
    if (fresh.current) {
      const target = loc.hash ? document.getElementById(decodeURIComponent(loc.hash.slice(1))) : null
      if (target) target.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth" })
      else window.scrollTo(0, 0)
      fresh.current = false
    }
    const h1 = document.querySelector<HTMLElement>("#content h1")
    h1?.focus({ preventScroll: true })
  }, [routeKey, loc.hash])

  let body
  switch (route.kind) {
    case "home":
      body = <Home search={<SearchBox variant="hero" inputId={HERO_SEARCH_ID} />} />
      break
    case "article":
      body = <Article key={route.slug} slug={route.slug!} />
      break
    case "stub":
      body = <Stub key={route.slug} slug={route.slug!} />
      break
    case "section":
      body = <SectionIndex sectionId={route.sectionId!} />
      break
    case "changelog":
    case "changelog-version":
    case "api-reference":
      body = (
        <article className="d-article">
          <h1 tabIndex={-1} className="d-h1">
            {titleFor(route, DATA).replace(" · Syrel Docs", "")}
          </h1>
        </article>
      )
      break
    default:
      body = <NotFound search={<SearchBox variant="drawer" />} />
  }

  return (
    <DocsDataProvider value={DATA}>
      <div className="docs-root" onClick={interceptDocsLink}>
        <a className="d-skip" href="#content">
          Skip to content
        </a>
        <DocsHeader isHome={route.kind === "home"} />
        <main id="content" data-route={route.kind}>
          {body}
        </main>
        <LandingFooter />
      </div>
    </DocsDataProvider>
  )
}
