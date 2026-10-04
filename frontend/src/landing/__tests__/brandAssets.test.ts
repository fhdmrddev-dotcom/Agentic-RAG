/**
 * Phase 276-07 (D-27) — the raster brand set, the manifest and the head tags.
 *
 * What this fences:
 *   1. Every PNG in `scripts/generate-brand-rasters.cjs`'s exported RASTERS spec exists under
 *      frontend/public, starts with the PNG signature and has the IHDR width/height the spec
 *      promises. The list is READ from the script (one home): a raster added there is checked here
 *      without editing this file. The seven expected names are also listed, so a spec that shrank
 *      cannot pass by checking fewer files.
 *   2. site.webmanifest parses, names Syrel, uses the brand background, and every icon it lists
 *      exists with the size it claims.
 *   3. index.html, app.html and docs.html declare the PNG favicons, the apple-touch-icon, the
 *      manifest and theme-color; index.html and docs.html also carry the og:* / twitter:* set.
 *   4. SELF-HOSTED: no brand tag in the SOURCE html points at http(s). The og:image is made
 *      absolute only at build time, by `absolutizeBrandMeta`, from VITE_APP_URL's origin.
 *   5. The unreferenced Vite leftovers stay deleted.
 */
import { describe, it, expect, vi } from "vitest"
import { absolutizeBrandMeta } from "../../../plugins/brandMeta"

const nodeFs = await vi.importActual<any>("node:fs")
const nodePath = await vi.importActual<any>("node:path")
const nodeModule = await vi.importActual<any>("node:module")

const FRONTEND_DIR: string = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/landing/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`cannot locate frontend dir in: ${here}`)
  return here.slice(0, at)
})()
const PUBLIC_DIR = nodePath.join(FRONTEND_DIR, "public")
const SCRIPT = nodePath.resolve(FRONTEND_DIR, "..", "scripts", "generate-brand-rasters.cjs")

interface RasterSpec {
  out: string
  width: number
  height: number
}

function loadSpec(): RasterSpec[] {
  const req = nodeModule.createRequire(SCRIPT)
  return req(SCRIPT).RASTERS as RasterSpec[]
}

const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]

function pngInfo(file: string): { sig: boolean; width: number; height: number } {
  const buf: Uint8Array = nodeFs.readFileSync(file)
  const sig = PNG_SIG.every((b, i) => buf[i] === b)
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return { sig, width: dv.getUint32(16), height: dv.getUint32(20) }
}

const EXPECTED: Array<[string, number, number]> = [
  ["favicon-16.png", 16, 16],
  ["favicon-32.png", 32, 32],
  ["apple-touch-icon.png", 180, 180],
  ["icon-192.png", 192, 192],
  ["icon-512.png", 512, 512],
  ["brand/og-image.png", 1200, 630],
  ["brand/syrel-lockup-email.png", 480, 240],
]

function read(name: string): string {
  return nodeFs.readFileSync(nodePath.join(FRONTEND_DIR, name), "utf-8")
}

/** Every <link …> and <meta …> tag in an html head. */
function tags(html: string): string[] {
  return html.match(/<(?:link|meta)\b[^>]*>/g) ?? []
}

function attr(tag: string, name: string): string | undefined {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return m?.[1]
}

function find(html: string, pred: (t: string) => boolean): string | undefined {
  return tags(html).find(pred)
}

const metaProp = (html: string, prop: string) =>
  find(html, (t) => attr(t, "property") === prop || attr(t, "name") === prop)

describe("brand rasters (D-27)", () => {
  it("the script's RASTERS spec covers the seven expected files with the expected sizes", () => {
    const spec = loadSpec()
    const got = spec.map((s) => [s.out, s.width, s.height])
    for (const e of EXPECTED) expect(got).toContainEqual(e)
  })

  it("every spec entry exists, is a PNG, and has the IHDR dimensions the spec promises", () => {
    const spec = loadSpec()
    expect(spec.length).toBeGreaterThanOrEqual(7)
    for (const s of spec) {
      const file = nodePath.join(PUBLIC_DIR, s.out)
      expect(nodeFs.existsSync(file), `${s.out} missing`).toBe(true)
      const info = pngInfo(file)
      expect(info.sig, `${s.out} is not a PNG`).toBe(true)
      expect([info.width, info.height], s.out).toEqual([s.width, s.height])
    }
  })
})

describe("site.webmanifest (D-27)", () => {
  it("names Syrel, uses #06090F, is standalone, and every icon exists at its declared size", () => {
    const m = JSON.parse(nodeFs.readFileSync(nodePath.join(PUBLIC_DIR, "site.webmanifest"), "utf-8"))
    expect(m.name).toBe("Syrel")
    expect(m.theme_color).toBe("#06090F")
    expect(m.background_color).toBe("#06090F")
    expect(m.display).toBe("standalone")
    expect(m.icons.length).toBeGreaterThanOrEqual(2)
    const sizes = m.icons.map((i: any) => i.sizes)
    expect(sizes).toEqual(expect.arrayContaining(["192x192", "512x512"]))
    for (const icon of m.icons) {
      const file = nodePath.join(PUBLIC_DIR, icon.src.replace(/^\//, ""))
      expect(nodeFs.existsSync(file), `${icon.src} missing`).toBe(true)
      const info = pngInfo(file)
      expect(`${info.width}x${info.height}`).toBe(icon.sizes)
    }
  })
})

describe("head tags (D-27)", () => {
  for (const page of ["index.html", "app.html", "docs.html"]) {
    it(`${page} declares PNG favicons, apple-touch-icon, manifest and theme-color`, () => {
      const html = read(page)
      for (const size of ["16x16", "32x32"]) {
        const t = find(html, (x) => attr(x, "rel") === "icon" && attr(x, "sizes") === size)
        expect(t, `${page} icon ${size}`).toBeDefined()
        expect(attr(t!, "type")).toBe("image/png")
      }
      expect(attr(find(html, (x) => attr(x, "rel") === "apple-touch-icon")!, "href")).toBe(
        "/apple-touch-icon.png",
      )
      expect(attr(find(html, (x) => attr(x, "rel") === "manifest")!, "href")).toBe("/site.webmanifest")
      expect(attr(metaProp(html, "theme-color")!, "content")).toBe("#06090F")
    })
  }

  for (const page of ["index.html", "docs.html"]) {
    it(`${page} carries the og:* and twitter:card set`, () => {
      const html = read(page)
      const content = (p: string) => attr(metaProp(html, p) ?? "", "content")
      expect(content("og:title")).toBeTruthy()
      expect(content("og:description")).toBeTruthy()
      expect(content("og:image")).toBe("/brand/og-image.png")
      expect(content("og:image:width")).toBe("1200")
      expect(content("og:image:height")).toBe("630")
      expect(content("og:image:alt")).toBeTruthy()
      expect(content("og:site_name")).toBe("Syrel")
      expect(content("og:type")).toBe("website")
      expect(content("twitter:card")).toBe("summary_large_image")
    })
  }

  it("no brand tag in the source html points at a third-party host (self-hosted)", () => {
    const brand = (t: string) =>
      ["icon", "apple-touch-icon", "manifest"].includes(attr(t, "rel") ?? "") ||
      /^(og:|twitter:|theme-color)/.test(attr(t, "property") ?? attr(t, "name") ?? "")
    const offenders: string[] = []
    for (const page of ["index.html", "app.html", "docs.html"]) {
      for (const t of tags(read(page)).filter(brand)) {
        for (const a of ["href", "src", "content"]) {
          if (/^https?:\/\//.test(attr(t, a) ?? "")) offenders.push(`${page}: ${t}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe("absolutizeBrandMeta (build-time, from VITE_APP_URL)", () => {
  const html =
    '<meta property="og:image" content="/brand/og-image.png" />\n' +
    '<meta name="twitter:image" content="/brand/og-image.png" />\n' +
    '<meta property="og:title" content="/not-an-image" />'

  it("leaves html unchanged without an app url", () => {
    expect(absolutizeBrandMeta(html, undefined)).toBe(html)
    expect(absolutizeBrandMeta(html, "")).toBe(html)
  })

  it("rewrites og:image and twitter:image to the ORIGIN of an http(s) url, nothing else", () => {
    const out = absolutizeBrandMeta(html, "https://app.example.com/path")
    expect(out).toContain('<meta property="og:image" content="https://app.example.com/brand/og-image.png" />')
    expect(out).toContain('<meta name="twitter:image" content="https://app.example.com/brand/og-image.png" />')
    expect(out).toContain('<meta property="og:title" content="/not-an-image" />')
    expect(out).not.toContain("//brand")
  })

  it("ignores a non-http(s) value", () => {
    expect(absolutizeBrandMeta(html, "javascript:alert(1)")).toBe(html)
    expect(absolutizeBrandMeta(html, "app.example.com")).toBe(html)
  })
})

describe("Vite leftovers stay deleted", () => {
  it("public/icons.svg and src/assets/{hero.png,react.svg,vite.svg} do not exist", () => {
    for (const f of ["public/icons.svg", "src/assets/hero.png", "src/assets/react.svg", "src/assets/vite.svg"]) {
      expect(nodeFs.existsSync(nodePath.join(FRONTEND_DIR, f)), f).toBe(false)
    }
  })
})
