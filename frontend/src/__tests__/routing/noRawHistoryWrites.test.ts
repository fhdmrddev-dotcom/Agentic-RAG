/**
 * D-297-15 (Phase 297-02, D-33 / T-297-11) — THE ROUTER IS THE ONLY HISTORY WRITER.
 *
 * The data router seeds an entry index into every History entry it writes and reads it back on
 * Back/Forward to know how far the user moved. A raw push/replace written beside it erases that
 * index: the next Back lands on the right URL with the wrong view, and a leave guard cannot revert
 * a move whose distance it cannot compute (RESEARCH Pitfall 2). A hash assignment is the same
 * write by another name. So no product file may do any of the three.
 *
 * ⛔ SCOPE. Every non-test `.ts` / `.tsx` under `src/`, minus `src/docs/` — the docs site is a
 * separate entry (`docs.html`) with its own small router and never shares a History with the app.
 *
 * ⛔ IT READS COMMENT-STRIPPED CODE. Prose explaining why a write was removed must not keep the
 * fence red, and prose must not be able to satisfy it either (the 187-24 lesson). The stripper and
 * the needles are proven against a planted fixture first: a fence nobody has seen fire is not one.
 */
import { describe, expect, it } from "vitest"

const RAW = import.meta.glob("../../**/*.{ts,tsx}", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>

/** `src/`-relative path for a glob key, resolved against THIS file's directory (the
 *  `ChatLayout.badge.test.tsx` lesson: Vite emits keys of different depths from one pattern). */
const HERE = "src/__tests__/routing"
function rel(key: string): string {
  const out = HERE.split("/")
  for (const seg of key.replace(/\\/g, "/").split("/")) {
    if (seg === "..") out.pop()
    else if (seg !== "." && seg !== "") out.push(seg)
  }
  return out.join("/").replace(/^src\//, "")
}

function isProductFile(path: string): boolean {
  if (/\.test\.tsx?$/.test(path)) return false
  if (/\.testutil\.tsx?$/.test(path)) return false
  if (path.includes("__tests__/")) return false
  if (path.startsWith("docs/")) return false
  return true
}

/** The line-anchored stripper (`renameFence.test.ts`): the `^\s*` keeps `https://` in code alive. */
const codeOf = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")

const NEEDLES: Array<[string, RegExp]> = [
  ["history.pushState(", /history\s*\.\s*pushState\s*\(/],
  ["history.replaceState(", /history\s*\.\s*replaceState\s*\(/],
  ["location.hash =", /location\s*\.\s*hash\s*=(?!=)/],
]

function hits(code: string): string[] {
  return NEEDLES.filter(([, re]) => re.test(code)).map(([name]) => name)
}

/** 297-REVIEW WR-01: the one write that ADDS the router's `idx` (see the last case below). */
const SANCTIONED = {
  path: "hooks/useAppNavigation.ts",
  text: "window.history.replaceState({ ...kept, idx: lastIdx.current + 1 }, \"\")",
}
const withoutSanctioned = (src: string) => codeOf(src).split(SANCTIONED.text).join("")

const PRODUCT = Object.entries(RAW)
  .map(([key, src]) => [rel(key), src] as const)
  .filter(([path]) => isProductFile(path))

describe("no raw History writes beside the router (D-33)", () => {
  it("the sweep is not vacuous: it found the product tree", () => {
    expect(PRODUCT.length).toBeGreaterThan(200)
    const paths = PRODUCT.map(([p]) => p)
    expect(paths).toContain("hooks/useAppNavigation.ts")
    expect(paths).toContain("main.tsx")
    expect(paths.some((p) => p.startsWith("docs/"))).toBe(false)
  })

  it("a planted write of each kind IS caught, and the same text inside a comment is not", () => {
    const planted = [
      "window.history.pushState(null, '', '/x')",
      "window.history.replaceState(window.history.state, '', url)",
      'window.location.hash = "#chat"',
    ]
    for (const line of planted) expect(hits(codeOf(`const a = 1\n${line}\n`))).toHaveLength(1)
    expect(hits(codeOf(`// window.history.pushState(null, "", "/x")\n/* location.hash = "#x" */\n`))).toEqual([])
    // A comparison is a read, not a write.
    expect(hits(codeOf(`if (window.location.hash === "#x") {}\n`))).toEqual([])
  })

  it("zero raw History writes in comment-stripped product code outside src/docs/", () => {
    const offenders = PRODUCT.flatMap(([path, src]) =>
      hits(codeOf(path === SANCTIONED.path ? withoutSanctioned(src) : src)).map((h) => `${path}: ${h}`),
    )
    expect(offenders).toEqual([])
  })

  // ⚠ 297-REVIEW WR-01 (2026-10-28) — ONE SANCTIONED WRITE, and it ADDS the router's index rather
  // than erasing it. supabase-js's implicit-flow callback clears `#access_token=…` with a raw hash
  // write (outside our code, so this fence cannot see it), leaving an entry with no `idx`; a Back
  // onto it is unblockable. `useAppNavigation` stamps that entry, in place at the same URL, just
  // before the router writes from it. The exemption is by EXACT TEXT in that ONE file and counted:
  // a second write there, a write of any other shape, or the same text anywhere else stays red.
  it("the one sanctioned write: useAppNavigation stamps a missing idx, exactly once, nowhere else", () => {
    const src = PRODUCT.find(([path]) => path === SANCTIONED.path)?.[1] ?? ""
    const code = codeOf(src)
    expect(code.split(SANCTIONED.text).length - 1).toBe(1)
    expect(hits(codeOf(withoutSanctioned(src)))).toEqual([])
    // Non-vacuity: without the exemption the sweep WOULD flag this file.
    expect(hits(code)).toEqual(["history.replaceState("])
    const elsewhere = PRODUCT.filter(([path, s]) => path !== SANCTIONED.path && codeOf(s).includes(SANCTIONED.text))
    expect(elsewhere.map(([path]) => path)).toEqual([])
  })
})
