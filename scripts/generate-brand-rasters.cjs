#!/usr/bin/env node
/**
 * Phase 276-07 (D-27) — rasterise the Syrel brand SVGs into the PNG set browsers, home screens,
 * link previews and mail clients need.
 *
 * Free tool, no install: it drives the Chromium that Playwright already downloaded for the e2e
 * suite (`playwright-core` is in frontend/node_modules via the `@playwright/test` dev dependency).
 * Measured on the build box (276-07 planning): rsvg-convert, resvg, ImageMagick, Inkscape and
 * cairosvg are absent and ffmpeg has no SVG decoder, so a browser is the one renderer available.
 * ⛔ Never `npm install` anything for this.
 *
 * Sources (one home each): frontend/public/brand/syrel-mark-iris.svg (64×64 mark) and
 * frontend/public/brand/syrel-lockup-iris.svg (mark + wordmark; the wordmark is a path, so no font
 * is needed). Background token #06090F (docs/brand/README.md).
 *
 * `RASTERS` below is the spec. frontend/src/landing/__tests__/brandAssets.test.ts reads it, so a
 * raster added here is fenced there without editing the test.
 *
 * Usage:
 *   node scripts/generate-brand-rasters.cjs            # render every RASTERS entry
 *   node scripts/generate-brand-rasters.cjs --check    # verify outputs exist with spec dimensions
 *
 * Exit codes:
 *   0 — OK: rendered (or, with --check, every output exists with the PNG signature and its size).
 *   1 — Check failed: an output is missing, is not a PNG, or has the wrong IHDR width/height.
 *   2 — Harness error: playwright-core cannot be resolved, no browser launches (bundled Chromium,
 *       then channel "chrome", then channel "msedge" are all tried and named), or a source SVG
 *       is missing.
 */

const fs = require("fs")
const path = require("path")
const { createRequire } = require("module")

const REPO_ROOT = path.resolve(__dirname, "..")
const PUBLIC_DIR = path.join(REPO_ROOT, "frontend", "public")
const BRAND_DIR = path.join(PUBLIC_DIR, "brand")
const BG = "#06090F"

/**
 * One entry per output, path relative to frontend/public.
 * kind:
 *   "mark-rounded"  — the mark centred at `scale` on a BG rounded square (radius `radius`, as a
 *                     fraction of the side), transparent corners. Favicons.
 *   "mark-bleed"    — the mark centred at `scale` on a full-bleed BG square. The platform rounds
 *                     or masks it (iOS, Android maskable: keep the mark inside the 80% safe zone).
 *   "lockup-og"     — BG with a soft #6467F2 radial glow at 10%, lockup centred at `lockupWidth`.
 *   "lockup-card"   — a BG rounded rectangle (radius `radius` px, transparent corners), lockup
 *                     centred at `lockupWidth`. The email header image.
 */
const RASTERS = [
  { out: "favicon-16.png", width: 16, height: 16, kind: "mark-rounded", scale: 0.8, radius: 0.22 },
  { out: "favicon-32.png", width: 32, height: 32, kind: "mark-rounded", scale: 0.8, radius: 0.22 },
  { out: "apple-touch-icon.png", width: 180, height: 180, kind: "mark-bleed", scale: 0.7 },
  { out: "icon-192.png", width: 192, height: 192, kind: "mark-bleed", scale: 0.62 },
  { out: "icon-512.png", width: 512, height: 512, kind: "mark-bleed", scale: 0.62 },
  { out: "brand/og-image.png", width: 1200, height: 630, kind: "lockup-og", lockupWidth: 560 },
  { out: "brand/syrel-lockup-email.png", width: 480, height: 240, kind: "lockup-card", lockupWidth: 400, radius: 24 },
]

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function readPngSize(file) {
  const buf = fs.readFileSync(file)
  if (buf.length < 24 || !buf.subarray(0, 8).equals(PNG_SIG)) return null
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) }
}

function check() {
  const bad = []
  for (const r of RASTERS) {
    const file = path.join(PUBLIC_DIR, r.out)
    if (!fs.existsSync(file)) {
      bad.push(`${r.out}: missing`)
      continue
    }
    const size = readPngSize(file)
    if (!size) bad.push(`${r.out}: not a PNG`)
    else if (size.width !== r.width || size.height !== r.height) {
      bad.push(`${r.out}: ${size.width}x${size.height}, spec ${r.width}x${r.height}`)
    }
  }
  if (bad.length) {
    console.error("brand rasters check FAILED:\n  " + bad.join("\n  "))
    return 1
  }
  console.log(`brand rasters check OK — ${RASTERS.length} PNGs present with spec dimensions.`)
  return 0
}

/** Strip the root <svg>'s own width/height so CSS sizes it; keep the viewBox. */
function sizable(svgText) {
  return svgText.replace(/<svg\b[^>]*>/, (tag) => tag.replace(/\s(width|height)="[^"]*"/g, ""))
}

function pageFor(r, markSvg, lockupSvg) {
  const W = r.width
  const H = r.height
  let stage = ""
  let art = ""
  if (r.kind === "mark-rounded" || r.kind === "mark-bleed") {
    const side = Math.round(W * r.scale * 1000) / 1000
    const radius = r.kind === "mark-rounded" ? `${r.radius * 100}%` : "0"
    stage = `background:${BG};border-radius:${radius};`
    art = `<div class="art" style="width:${side}px;height:${side}px">${sizable(markSvg)}</div>`
  } else {
    // lockup viewBox is "40 0 210 100" → aspect 2.1
    const w = r.lockupWidth
    const h = Math.round((w / 2.1) * 1000) / 1000
    if (r.kind === "lockup-og") {
      stage = `background:radial-gradient(ellipse at center, rgba(100,103,242,0.10) 0%, rgba(100,103,242,0) 60%), ${BG};`
    } else {
      stage = `background:${BG};border-radius:${r.radius}px;`
    }
    art = `<div class="art" style="width:${w}px;height:${h}px">${sizable(lockupSvg)}</div>`
  }
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;padding:0;background:transparent;}
.stage{width:${W}px;height:${H}px;display:flex;align-items:center;justify-content:center;overflow:hidden;${stage}}
.art svg{display:block;width:100%;height:100%;}
</style></head><body><div class="stage">${art}</div></body></html>`
}

async function launch(chromium) {
  const attempts = [
    ["bundled Chromium", {}],
    ['channel "chrome"', { channel: "chrome" }],
    ['channel "msedge"', { channel: "msedge" }],
  ]
  const failures = []
  for (const [label, opts] of attempts) {
    try {
      return await chromium.launch({ headless: true, ...opts })
    } catch (err) {
      failures.push(`${label}: ${String(err && err.message ? err.message : err).split("\n")[0]}`)
    }
  }
  throw new Error("no browser launched:\n  " + failures.join("\n  "))
}

async function render() {
  let chromium
  try {
    chromium = createRequire(path.join(REPO_ROOT, "frontend", "package.json"))("playwright-core").chromium
  } catch (err) {
    console.error("harness error: cannot resolve playwright-core from frontend/ — " + err.message)
    return 2
  }
  const markPath = path.join(BRAND_DIR, "syrel-mark-iris.svg")
  const lockupPath = path.join(BRAND_DIR, "syrel-lockup-iris.svg")
  for (const p of [markPath, lockupPath]) {
    if (!fs.existsSync(p)) {
      console.error(`harness error: source SVG missing: ${path.relative(REPO_ROOT, p)}`)
      return 2
    }
  }
  const markSvg = fs.readFileSync(markPath, "utf8")
  const lockupSvg = fs.readFileSync(lockupPath, "utf8")

  let browser
  try {
    browser = await launch(chromium)
  } catch (err) {
    console.error("harness error: " + err.message)
    return 2
  }
  try {
    for (const r of RASTERS) {
      const page = await browser.newPage({ viewport: { width: r.width, height: r.height }, deviceScaleFactor: 1 })
      await page.setContent(pageFor(r, markSvg, lockupSvg), { waitUntil: "load" })
      const out = path.join(PUBLIC_DIR, r.out)
      fs.mkdirSync(path.dirname(out), { recursive: true })
      await page.screenshot({
        path: out,
        type: "png",
        omitBackground: true,
        clip: { x: 0, y: 0, width: r.width, height: r.height },
      })
      await page.close()
      console.log(`  wrote ${path.relative(REPO_ROOT, out)} (${r.width}x${r.height}, ${fs.statSync(out).size} B)`)
    }
  } finally {
    await browser.close()
  }
  return check()
}

module.exports = { RASTERS, readPngSize }

if (require.main === module) {
  const run = process.argv.includes("--check") ? Promise.resolve(check()) : render()
  run.then(
    (code) => process.exit(code),
    (err) => {
      console.error("harness error: " + (err && err.stack ? err.stack : err))
      process.exit(2)
    },
  )
}
