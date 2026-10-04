// frontend/plugins/docsContent.ts — Phase 276 (DOCS-01 / DOCS-05 / D-08).
//
// The docs entry's build-time content plugin. It owns NO parsing: every rule lives in
// scripts/lib/docs-content.cjs (one home — 276-05's coverage gate reads the same code).
//
//   virtual:docs-manifest      sections · pages (metadata only) · changelog · chapters · loadPage()
//   virtual:docs-page/<slug>   one lazy chunk per page: `export default "<markdown body>"`
//   docs-assets/search-index.json     MiniSearch toJSON over every page, section and release
//   docs-assets/openapi.public.json   copy of docs/public/api/openapi.public.json (276-01 writes it)
//   vo/<name>.wav · music/<name>.mp3  copied from video/public by an allow-list, never recursively
//
// In dev the same URLs are served by a middleware with the same allow-list (T-276-07), and edits
// under docs/public or docs/history reload the page.
import fs from "node:fs"
import path from "node:path"
import { createRequire } from "node:module"
import MiniSearch from "minisearch"
import type { Plugin, ViteDevServer } from "vite"
import { SEARCH_OPTIONS } from "../src/docs/search/searchOptions"

type DocsContentLib = typeof import("../../scripts/lib/docs-content.cjs")
type ParsedPage = ReturnType<DocsContentLib["loadAllPages"]>["pages"][number]

export interface DocsContentOptions {
  /** frontend/ — every default below is resolved from it. */
  frontendDir: string
  root?: string
  historyDir?: string
  overrides?: string
  videoPublic?: string
  publicSpec?: string
  sectionsFile?: string
  libPath?: string
}

const MANIFEST_ID = "virtual:docs-manifest"
const PAGE_PREFIX = "virtual:docs-page/"
const RESOLVED_MANIFEST = "\0" + MANIFEST_ID
const RESOLVED_PAGE_PREFIX = "\0" + PAGE_PREFIX

/** The ONLY file names the asset copy and the dev middleware will ever serve from video/public. */
export const MEDIA_NAME = /^[a-z0-9-]+\.(wav|mp3)$/
const MEDIA_DIRS = { vo: "wav", music: "mp3" } as const

export const MISSING_PUBLIC_SPEC_WARNING =
  "[docs-content] WARNING: docs/public/api/openapi.public.json is missing — /docs/api/reference will show its error state. Run node scripts/build-public-openapi.cjs"

const SEARCH_INDEX_FILE = "docs-assets/search-index.json"
const PUBLIC_SPEC_FILE = "docs-assets/openapi.public.json"

interface Content {
  pages: ParsedPage[]
  sections: ReturnType<DocsContentLib["readSections"]>
  changelog: ReturnType<DocsContentLib["parseHistory"]>
  chapters: ReturnType<DocsContentLib["parseChapters"]>
  fatal: string[]
  warnings: string[]
}

export function docsContent(options: DocsContentOptions): Plugin {
  const fe = options.frontendDir
  const root = options.root ?? path.resolve(fe, "../docs/public")
  const historyDir = options.historyDir ?? path.resolve(fe, "../docs/history")
  const overrides = options.overrides ?? path.resolve(fe, "../docs/public/changelog/overrides.json")
  const videoPublic = options.videoPublic ?? path.resolve(fe, "../video/public")
  const publicSpec = options.publicSpec ?? path.resolve(fe, "../docs/public/api/openapi.public.json")
  const sectionsFile = options.sectionsFile ?? path.join(root, "sections.json")
  const libPath = options.libPath ?? path.resolve(fe, "../scripts/lib/docs-content.cjs")

  // The parser is CommonJS with no npm deps (so the gate runs under bare `node`); load it as such.
  const lib = createRequire(import.meta.url)(libPath) as DocsContentLib

  let cache: Content | null = null
  let warnedEmpty = false

  function readContent(): Content {
    if (cache) return cache
    const loaded = lib.loadAllPages(root)
    const sections = lib.readSections(sectionsFile)
    const changelog = lib.parseHistory(historyDir, overrides)
    const chapters = lib.parseChapters(historyDir)
    const all = [...loaded.findings, ...lib.validatePages(loaded.pages, sections)]
    const fatal = all.filter((f) => f.code === "bad-frontmatter").map(lib.formatFinding)
    const warnings = all.filter((f) => f.code !== "bad-frontmatter").map(lib.formatFinding)
    if (loaded.readError) fatal.push(`[docs-content] ${loaded.readError}`)
    cache = { pages: loaded.pages, sections, changelog, chapters, fatal, warnings }
    return cache
  }

  function pageMeta(p: ParsedPage) {
    const { file: _file, body: _body, ...meta } = p
    return meta
  }

  function manifestModule(c: Content): string {
    const loaders = c.pages
      .map((p) => `  ${JSON.stringify(p.slug)}: () => import(${JSON.stringify(PAGE_PREFIX + p.slug)})`)
      .join(",\n")
    return [
      `export const sections = ${JSON.stringify(c.sections)};`,
      `export const pages = ${JSON.stringify(c.pages.map(pageMeta))};`,
      `export const changelog = ${JSON.stringify(c.changelog)};`,
      `export const chapters = ${JSON.stringify(c.chapters)};`,
      `const loaders = {\n${loaders}\n};`,
      `export function loadPage(slug) {`,
      `  const load = loaders[slug];`,
      `  if (!load) return Promise.reject(new Error("Unknown docs page: " + slug));`,
      `  return load().then((m) => m.default);`,
      `}`,
    ].join("\n")
  }

  function searchIndexJson(c: Content): string {
    const ms = new MiniSearch(SEARCH_OPTIONS)
    ms.addAll(lib.buildSearchDocs(c.pages, c.changelog, c.sections))
    return JSON.stringify(ms)
  }

  function mediaFiles(): { dir: keyof typeof MEDIA_DIRS; name: string; abs: string }[] {
    const out: { dir: keyof typeof MEDIA_DIRS; name: string; abs: string }[] = []
    for (const dir of Object.keys(MEDIA_DIRS) as (keyof typeof MEDIA_DIRS)[]) {
      const absDir = path.join(videoPublic, dir)
      if (!fs.existsSync(absDir)) continue
      for (const name of fs.readdirSync(absDir)) {
        if (MEDIA_NAME.test(name) && name.endsWith("." + MEDIA_DIRS[dir])) out.push({ dir, name, abs: path.join(absDir, name) })
      }
    }
    return out
  }

  function invalidate(server: ViteDevServer) {
    cache = null
    const graph = server.moduleGraph
    for (const mod of graph.idToModuleMap.values()) {
      if (mod.id && (mod.id === RESOLVED_MANIFEST || mod.id.startsWith(RESOLVED_PAGE_PREFIX))) graph.invalidateModule(mod)
    }
    server.ws.send({ type: "full-reload" })
  }

  return {
    name: "docs-content",

    resolveId(id) {
      if (id === MANIFEST_ID) return RESOLVED_MANIFEST
      if (id.startsWith(PAGE_PREFIX)) return "\0" + id
      return null
    },

    load(id) {
      if (id !== RESOLVED_MANIFEST && !id.startsWith(RESOLVED_PAGE_PREFIX)) return null
      const c = readContent()
      if (c.fatal.length) this.error(`docs/public has invalid frontmatter:\n  ${c.fatal.join("\n  ")}`)
      for (const p of c.pages) this.addWatchFile(path.join(root, p.file))
      if (id === RESOLVED_MANIFEST) {
        if (c.pages.length === 0 && !warnedEmpty) {
          warnedEmpty = true
          console.warn(
            `[docs-content] WARNING: no pages under docs/public yet (${c.warnings.length} sections.json slugs have no file) — content lands in 276-04; the coverage gate enforces it.`,
          )
        }
        return manifestModule(c)
      }
      const slug = id.slice(RESOLVED_PAGE_PREFIX.length)
      const page = c.pages.find((p) => p.slug === slug)
      if (!page) this.error(`Unknown docs page: ${slug}`)
      return `export default ${JSON.stringify(page!.body)};`
    },

    buildStart() {
      cache = null
    },

    generateBundle() {
      const c = readContent()
      this.emitFile({ type: "asset", fileName: SEARCH_INDEX_FILE, source: searchIndexJson(c) })
      if (fs.existsSync(publicSpec)) {
        this.emitFile({ type: "asset", fileName: PUBLIC_SPEC_FILE, source: fs.readFileSync(publicSpec, "utf8") })
      } else {
        console.warn(MISSING_PUBLIC_SPEC_WARNING)
      }
      for (const m of mediaFiles()) {
        this.emitFile({ type: "asset", fileName: `${m.dir}/${m.name}`, source: fs.readFileSync(m.abs) })
      }
    },

    configureServer(server) {
      server.watcher.add([root, historyDir])
      const isContent = (file: string) => {
        const f = path.resolve(file)
        return f.startsWith(path.resolve(root) + path.sep) || f.startsWith(path.resolve(historyDir) + path.sep)
      }
      server.watcher.on("all", (_event, file) => {
        if (isContent(file)) invalidate(server)
      })

      server.middlewares.use((req, res, next) => {
        const pathname = (req.url || "/").split("?")[0]
        const send = (status: number, type: string, body: string | Buffer) => {
          res.statusCode = status
          res.setHeader("Content-Type", type)
          res.end(body)
        }
        if (pathname === "/" + SEARCH_INDEX_FILE) {
          try {
            return send(200, "application/json", searchIndexJson(readContent()))
          } catch (e) {
            return send(500, "text/plain", String(e instanceof Error ? e.message : e))
          }
        }
        if (pathname === "/" + PUBLIC_SPEC_FILE) {
          if (!fs.existsSync(publicSpec)) return send(404, "text/plain", MISSING_PUBLIC_SPEC_WARNING)
          return send(200, "application/json", fs.readFileSync(publicSpec))
        }
        const m = /^\/(vo|music)\/(.*)$/.exec(pathname)
        if (m) {
          const dir = m[1] as keyof typeof MEDIA_DIRS
          let name: string
          try {
            name = decodeURIComponent(m[2])
          } catch {
            return send(400, "text/plain", "Bad request")
          }
          // Path-traversal guard: only an allow-listed bare file name is ever joined to a path.
          if (!MEDIA_NAME.test(name) || !name.endsWith("." + MEDIA_DIRS[dir])) return send(404, "text/plain", "Not found")
          const abs = path.join(videoPublic, dir, name)
          if (!fs.existsSync(abs)) return send(404, "text/plain", "Not found")
          return send(200, dir === "vo" ? "audio/wav" : "audio/mpeg", fs.readFileSync(abs))
        }
        next()
      })
    },
  }
}
