/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * PHASE 217-06 (D-217-20 / D-217-21) — THE TAB-BAR INVERSION, MEASURED FROM THE TOKENS.
 *
 * `components/ui/tabs.tsx` is a SHARED primitive with three mounts — `SettingsPage.tsx`,
 * `KnowledgeHealthPage.tsx` and the Library — and `src/components/ui/` had **no test suite
 * at all** before this file. So the property "the selected tab is lighter than the strip it
 * sits in" was carried by nothing executable in either theme.
 *
 * What shipped until this phase: the active trigger painted `--background` and the track
 * painted `--muted`. Light: 97% over 94% → +3, LIGHTER, correct. Deep Midnight: 4% over
 * 11% → −7, DARKER. The bar INVERTED between themes and the only other cue was `shadow-sm`,
 * a 5%-opacity shadow that is invisible at 4% lightness.
 *
 * ── ⚠ WHY THIS SUITE DOES NOT PORT `drive.cjs`'s `lightness()` VERBATIM ────────────────
 *
 * Sketch 218's `drive.cjs:129-134` locates a theme block with `css.indexOf(blockStart)` and
 * then regex-searches FORWARD for the token. That is positionally fragile in a way this
 * plan hit on its first run, and the finding is recorded here rather than in a commit note:
 *
 *   · the FIRST literal `.dark` in `index.css` is at **line 37**, inside a Phase-192.2 PROSE
 *     COMMENT ("promoted OUT OF `.dark`-only"), ~80 lines above the real `.dark {` selector;
 *   · so "the dark block" actually begins at line 37, in the MIDDLE of `:root`;
 *   · `--muted` and `--background` survive that only BY ACCIDENT — both are declared at
 *     lines 29 and 19, i.e. ABOVE line 37, so the forward search still lands on the dark
 *     declaration. `A4`/`A4b` are therefore correct today, and are left untouched.
 *   · `--tab-active` is declared at line 110, BELOW line 37 — so the same parser reads the
 *     LIGHT value (100) as the dark one. Measured, not theorised: it returned `100` for the
 *     dark block before this parser was written.
 *
 * A `100 > 11` comparison PASSES. It is finite, so a bare "is it a number?" non-vacuity
 * check passes too. **The wrong-block read is invisible to every guard except one that
 * proves the two blocks are actually different**, which is why `background` — a token whose
 * two values differ by 93 points — is asserted as the BLOCK-SELECTION CONTROL below.
 *
 * So the technique is ported; the block finder is not. This suite strips CSS comments
 * first, then brace-matches the real `:root { … }` and `.dark { … }` bodies.
 *
 * ── CRLF ──────────────────────────────────────────────────────────────────────────────
 * Source files check out with Windows line endings on this box. Every pattern uses
 * `[\s\S]` / `\r?\n` rather than `.` or a bare `\n`, because a terminator spelled `\n\n`
 * silently never matches and yields an empty result that passes vacuously.
 * ══════════════════════════════════════════════════════════════════════════════════════
 */
import { describe, expect, it, vi } from "vitest"

import tabsSource from "@/components/ui/tabs.tsx?raw"

/**
 * ⚠ `index.css` IS NOT READ THROUGH `?raw`, AND THE DEPARTURE IS FORCED BY MEASUREMENT.
 *
 * `library/gutterTokens.fences.test.ts:85-124` records the same finding and the same remedy;
 * it was RE-MEASURED here rather than inherited. Under vitest 4.1.0 `test.css` defaults to
 * `false`, so every CSS module — query string and all — is replaced with the empty string:
 * `import css from "@/index.css?raw"` resolves, `length` **0**, nothing throws and nothing
 * warns. This suite hit it on its first run: nine cases red, the first reading
 * `expected 0 to be greater than 8000`. Had the non-vacuity block not existed, the parses
 * below would all have returned `null` and an inverted assertion would have read green over
 * an empty string — the exact failure mode this subtree keeps recording.
 *
 * So the read goes through `vi.importActual("node:fs")`: a RUNTIME specifier, so no static
 * `node:*` import exists for `tsc` to reject under `types: ["vite/client"]`. The path is
 * derived from `import.meta.url` BY STRING SURGERY, never `new URL(…, import.meta.url)` —
 * Vite statically rewrites the latter into an asset reference and `fileURLToPath` then throws
 * before a single case runs.
 */
const nodeFs = await vi.importActual<{ readFileSync(path: string, encoding: string): string }>(
  "node:fs",
)

/** `file:///…/frontend/src/components/ui/__tests__/<this file>` → `…/frontend/src/`. */
const SRC_ROOT = (() => {
  const here = decodeURIComponent(import.meta.url).replace(/^file:\/\/\/?/, "")
  const marker = "/src/components/ui/__tests__/"
  const at = here.indexOf(marker)
  if (at === -1) throw new Error(`fence cannot locate its own subtree in: ${here}`)
  return `${here.slice(0, at)}/src/`
})()

const cssSource = nodeFs.readFileSync(`${SRC_ROOT}index.css`, "utf8")

// ── PARSING ───────────────────────────────────────────────────────────────────────────

/** Strip `/* … *\/` blocks. Prose about a token must never be mistaken for the token. */
function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, " ")
}

const CSS_CODE = stripComments(cssSource)

/**
 * The BODY of a top-level rule, found by brace matching from the selector's own `{`.
 * Comments are already gone, so a `{` inside prose cannot unbalance the count.
 * Returns `null` when the selector is absent — never `""`, which would pass vacuously.
 */
function blockBody(css: string, selector: string): string | null {
  const head = new RegExp(`(^|[\\s}])${selector}\\s*\\{`, "m").exec(css)
  if (head === null) return null
  const open = css.indexOf("{", head.index)
  let depth = 0
  for (let i = open; i < css.length; i += 1) {
    if (css[i] === "{") depth += 1
    else if (css[i] === "}") {
      depth -= 1
      if (depth === 0) return css.slice(open + 1, i)
    }
  }
  return null
}

/** `--token: <h> <s>% <l>%` → the three HSL channels, or `null` if the token is absent. */
function hslOf(body: string | null, token: string): [number, number, number] | null {
  if (body === null) return null
  const m = new RegExp(`--${token}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`).exec(body)
  return m === null ? null : [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3])]
}

/** The L channel only — the quantity D-217-21 is about. `null` when the token is absent. */
function lightness(body: string | null, token: string): number | null {
  const hsl = hslOf(body, token)
  return hsl === null ? null : hsl[2]
}

// ── WCAG ──────────────────────────────────────────────────────────────────────────────

function hslToRgb([h, s, l]: [number, number, number]): [number, number, number] {
  const sat = s / 100
  const lig = l / 100
  const k = (n: number) => (n + h / 30) % 12
  const a = sat * Math.min(lig, 1 - lig)
  const f = (n: number) => lig - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)]
}

function relativeLuminance(rgb: [number, number, number]): number {
  const [r, g, b] = rgb.map((v) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2.1 contrast ratio between two HSL triples. 1 = identical, 21 = black on white. */
function contrastRatio(
  a: [number, number, number],
  b: [number, number, number],
): number {
  const la = relativeLuminance(hslToRgb(a))
  const lb = relativeLuminance(hslToRgb(b))
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

const ROOT = blockBody(CSS_CODE, ":root")
const DARK = blockBody(CSS_CODE, "\\.dark")

/** The one number this file is about. WCAG 2.1 AA 1.4.3, normal text. */
const AA_NORMAL_TEXT = 4.5

describe("index.css — the sources this suite is bound to are really loaded", () => {
  it("the stylesheet is non-trivial and is the RIGHT stylesheet", () => {
    // Length + identity. A non-empty read of the WRONG file is the same bug as an empty one.
    expect(cssSource.length).toBeGreaterThan(8000)
    expect(cssSource).toContain("Aether Intelligence")
    expect(cssSource).toContain("--tab-active")
  })

  it("the comment stripper actually strips — a prose token vanishes from the code", () => {
    // `WCAG` appears ONLY inside `/* … */` blocks in index.css. If `stripComments` ever
    // returned its input unchanged, every parse below would read prose as declarations.
    expect(cssSource).toContain("WCAG")
    expect(CSS_CODE).not.toContain("WCAG")
    expect(CSS_CODE.length).toBeGreaterThan(2000)
  })

  it("both theme blocks resolve to a real body, not null and not an empty string", () => {
    expect(ROOT).not.toBeNull()
    expect(DARK).not.toBeNull()
    expect((ROOT as string).length).toBeGreaterThan(500)
    expect((DARK as string).length).toBeGreaterThan(500)
  })

  it("⭐ BLOCK-SELECTION CONTROL — the two bodies are genuinely different blocks", () => {
    // THE guard the `indexOf` parser lacks. `--background` is 97% in :root and 4% in .dark;
    // a finder that returned the SAME body twice, or that started .dark inside :root (which
    // is exactly what `css.indexOf(".dark")` does here — the first literal `.dark` is in a
    // comment at line 37), reads 97 for both and this case reds.
    const lightBackground = lightness(ROOT, "background")
    const darkBackground = lightness(DARK, "background")
    expect(typeof lightBackground).toBe("number")
    expect(typeof darkBackground).toBe("number")
    expect(lightBackground).toBe(97)
    expect(darkBackground).toBe(4)
    expect(lightBackground).not.toBe(darkBackground)
  })
})

describe("D-217-21 — the active tab is LIGHTER than its track, in BOTH themes", () => {
  it("light: L(--tab-active) is a number, L(--muted) is a number, and active > track", () => {
    const active = lightness(ROOT, "tab-active")
    const track = lightness(ROOT, "muted")
    // NON-VACUITY, paired with the claim that rests on it: a regex that matched nothing
    // yields `null`, and `null > 94` is `false` in JS but `null` compared the other way is
    // not — no comparison against a non-number is allowed to decide this.
    expect(Number.isFinite(active as number)).toBe(true)
    expect(Number.isFinite(track as number)).toBe(true)
    expect(active as number).toBeGreaterThan(track as number)
  })

  it("⭐ dark: the same SIGN — this is the arm that shipped inverted", () => {
    const active = lightness(DARK, "tab-active")
    const track = lightness(DARK, "muted")
    expect(Number.isFinite(active as number)).toBe(true)
    expect(Number.isFinite(track as number)).toBe(true)
    expect(active as number).toBeGreaterThan(track as number)
  })

  it("the shipped inversion is still TRUE of --background — the finding is not deleted", () => {
    // Sketch 218's fences A4 / A4b measure --muted against --background and MUST stay true.
    // Re-pointing them at the new token would delete the recorded finding rather than fix
    // the bug, so this suite asserts the old pair is UNCHANGED alongside the new one.
    const lightBg = lightness(ROOT, "background")
    const lightTrack = lightness(ROOT, "muted")
    const darkBg = lightness(DARK, "background")
    const darkTrack = lightness(DARK, "muted")
    for (const v of [lightBg, lightTrack, darkBg, darkTrack]) {
      expect(Number.isFinite(v as number)).toBe(true)
    }
    expect(lightBg as number).toBeGreaterThan(lightTrack as number)
    expect(darkBg as number).toBeLessThan(darkTrack as number)
  })
})

describe("A6 — --foreground over --tab-active, computed rather than assumed", () => {
  it("the ratio function is not vacuous — identical colours are 1, black on white is 21", () => {
    expect(contrastRatio([0, 0, 0], [0, 0, 0])).toBeCloseTo(1, 5)
    expect(contrastRatio([0, 0, 0], [0, 0, 100])).toBeCloseTo(21, 1)
  })

  it("light: the active tab's label clears the AA normal-text floor", () => {
    const fg = hslOf(ROOT, "foreground")
    const bg = hslOf(ROOT, "tab-active")
    expect(fg).not.toBeNull()
    expect(bg).not.toBeNull()
    const ratio = contrastRatio(fg as [number, number, number], bg as [number, number, number])
    expect(Number.isFinite(ratio)).toBe(true)
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
  })

  it("dark: the active tab's label clears the AA normal-text floor", () => {
    const fg = hslOf(DARK, "foreground")
    const bg = hslOf(DARK, "tab-active")
    expect(fg).not.toBeNull()
    expect(bg).not.toBeNull()
    const ratio = contrastRatio(fg as [number, number, number], bg as [number, number, number])
    expect(Number.isFinite(ratio)).toBe(true)
    expect(ratio).toBeGreaterThanOrEqual(AA_NORMAL_TEXT)
  })
})

describe("tabs.tsx — the primitive reads the new token and carries a second cue", () => {
  it("the component source is non-trivial and is the RIGHT file", () => {
    expect(tabsSource.length).toBeGreaterThan(1200)
    expect(tabsSource).toContain("TabsPrimitive.Trigger")
    expect(tabsSource).toContain("export { Tabs, TabsList, TabsTrigger, TabsContent }")
  })

  it("the active trigger paints the new token, and the replaced class is GONE", () => {
    expect(tabsSource).toContain("data-[state=active]:bg-tab-active")
    // The class D-217-21 makes false BY DESIGN. Sketch fence A3b records the same rename.
    expect(tabsSource).not.toContain("data-[state=active]:bg-background")
  })

  it("⭐ colour never carries alone — an INSET ring, and never a border", () => {
    expect(tabsSource).toContain("data-[state=active]:ring-1")
    expect(tabsSource).toContain("data-[state=active]:ring-inset")
    expect(tabsSource).toContain("data-[state=active]:ring-border")
    // A real border changes the box size: the row would reflow on every selection change.
    expect(/data-\[state=active\]:border/.test(tabsSource)).toBe(false)
    // shadow-sm is KEPT — it still helps in the light theme, and Tailwind composes it with
    // the ring through separate --tw-shadow / --tw-ring-shadow slots.
    expect(tabsSource).toContain("data-[state=active]:shadow-sm")
  })

  it("the track still paints --muted, so the pair this suite measures is the real one", () => {
    expect(/rounded-md bg-muted p-1/.test(tabsSource)).toBe(true)
  })
})
