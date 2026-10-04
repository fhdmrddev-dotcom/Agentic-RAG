// Phase 276-02 — the docs entry's root. It subscribes to popstate, resolves the route against the
// build-time manifest, and renders a minimal <main> per route kind. 276-03 replaces this body with
// the real page components (home, article, stub, section, changelog, API reference, not-found);
// the routing and the manifest contract it consumes stay as they are.
import { useEffect, useState } from "react"
import { changelog, pages, sections } from "virtual:docs-manifest"
import { resolveRoute } from "./router"
import type { Route } from "./types"

const manifest = { pages, sections, changelog }

function titleFor(route: Route): string {
  switch (route.kind) {
    case "home":
      return "Syrel Docs"
    case "article":
    case "stub":
      return pages.find((p) => p.slug === route.slug)?.title ?? "Syrel Docs"
    case "section":
      return sections.find((s) => s.id === route.sectionId)?.title ?? "Syrel Docs"
    case "changelog":
      return "Changelog"
    case "changelog-version": {
      const r = changelog.find((x) => x.version === route.version)
      return r ? `${r.version} — ${r.name}` : "Changelog"
    }
    case "api-reference":
      return "API reference"
    case "not-found":
      return "Page not found"
  }
}

export function DocsApp() {
  const [pathname, setPathname] = useState(() => window.location.pathname)

  useEffect(() => {
    const onPop = () => setPathname(window.location.pathname)
    window.addEventListener("popstate", onPop)
    return () => window.removeEventListener("popstate", onPop)
  }, [])

  const route = resolveRoute(pathname, manifest)
  const title = titleFor(route)
  const section = route.sectionId ? sections.find((s) => s.id === route.sectionId) : undefined

  useEffect(() => {
    document.title = route.kind === "home" ? "Syrel Docs" : `${title} · Syrel Docs`
  }, [route.kind, title])

  return (
    <main id="content" data-route={route.kind}>
      {section && <p>{section.title}</p>}
      <h1 tabIndex={-1}>{title}</h1>
    </main>
  )
}
