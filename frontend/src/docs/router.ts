// Phase 276 — the docs entry's client-side router. There is no URL router library in this repo
// (and the docs bundle must stay small), so routing is a pure resolver over the manifest plus a
// History API helper. Unknown paths resolve to "not-found" INSIDE the docs shell (G4-4).
import type { Route, RouteManifest } from "./types"

/** Sections whose bare URL lands on a page rather than the section index (UI-SPEC P6). */
const SECTION_LANDING_PAGE: Record<string, string> = {
  api: "api/overview",
}

export function resolveRoute(pathname: string, manifest: RouteManifest): Route {
  let p = pathname.split(/[?#]/)[0]
  if (p.length > 1) p = p.replace(/\/+$/, "")

  if (p === "/docs") return { kind: "home" }
  if (!p.startsWith("/docs/")) return { kind: "not-found" }
  const rest = p.slice("/docs/".length)

  if (rest === "changelog") return { kind: "changelog", sectionId: "changelog" }
  if (rest.startsWith("changelog/")) {
    const version = rest.slice("changelog/".length)
    return manifest.changelog.some((r) => r.version === version)
      ? { kind: "changelog-version", version, sectionId: "changelog" }
      : { kind: "not-found" }
  }

  if (rest === "api/reference") return { kind: "api-reference", sectionId: "api" }

  const page = manifest.pages.find((pg) => pg.slug === rest)
  if (page) return { kind: page.status === "written" ? "article" : "stub", slug: page.slug, sectionId: page.section }

  const section = manifest.sections.find((s) => s.id === rest)
  if (section) {
    const landing = SECTION_LANDING_PAGE[section.id]
    const landingPage = landing ? manifest.pages.find((pg) => pg.slug === landing) : undefined
    if (landingPage) {
      return { kind: landingPage.status === "written" ? "article" : "stub", slug: landingPage.slug, sectionId: section.id }
    }
    return { kind: "section", sectionId: section.id }
  }

  return { kind: "not-found" }
}

/** Client-side navigation: push the URL, then let the app re-resolve via its popstate listener. */
export function navigate(to: string): void {
  window.history.pushState(null, "", to)
  window.dispatchEvent(new PopStateEvent("popstate"))
}
