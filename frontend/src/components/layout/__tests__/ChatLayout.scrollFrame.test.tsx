/**
 * Phase 244 plan 01 (SHELL-01 / BUG-260828-08) — THE FOUR-LINK `min-h-0` CHAIN.
 *
 * ── THE MECHANISM, stated rather than implied ────────────────────────────────────────────
 *
 * A flex item's `min-height` defaults to **`auto`**, which means "at least as tall as my
 * content". `flex-1` (`flex: 1 1 0%`) therefore does NOT bound a flex child: the child grows
 * to its content and pushes the frame open. The only thing that makes `flex-1` a real bound
 * is `min-h-0` on every link of the chain from the fixed-height root down to the scroller.
 *
 * Measured at this phase's base, the chat chain was broken at FOUR links (F-5 named two):
 *
 *   | # | site                    | class list                                        | min-h-0 |
 *   |---|-------------------------|---------------------------------------------------|---------|
 *   | 1 | ChatLayout.tsx  (root)  | `flex h-screen bg-background`                     | n/a     |
 *   | 2 | ChatLayout.tsx  (grid)  | `grid min-w-0 flex-1 overflow-hidden …`           | ⛔      |
 *   | 3 | ChatLayout.tsx  <main>  | `min-w-0 overflow-hidden`                         | ⛔      |
 *   | 4 | ChatArea.tsx    (col)   | `flex flex-col h-full bg-background`              | ⛔      |
 *   | 5 | MessageList.tsx (area)  | `<ScrollArea className="flex-1">`                 | ⛔      |
 *
 * ── THE ANALOG — shipped, working, and copied rather than invented ───────────────────────
 *
 * `frontend/src/components/metadata/DocumentDetailPanel.tsx:257` and `:300`:
 *
 *     <div className="flex h-full min-h-0 flex-col">
 *       …fixed header…
 *       <div className="min-h-0 flex-1 overflow-y-auto">
 *
 * `frontend/src/components/panel/WorkspacePanel.tsx:622` is the same rule at a shell root.
 *
 * ── WHY THE PRIMITIVE CANNOT SAVE IT ─────────────────────────────────────────────────────
 *
 * `ui/scroll-area.tsx:12-14,31`: the Root is `relative overflow-hidden` and the Viewport is
 * `h-full w-full`. The Root's height comes from `flex-1` on an item whose `min-height` is
 * `auto`, so the Root grows to content and the Viewport's `h-full` resolves to that *grown*
 * height — nothing scrolls internally, the page root scrolls instead. ⭐ The sibling call
 * site proves the mechanism: `tool-bodies/ReadDocumentBody.tsx:53` uses
 * `<ScrollArea className="max-h-64">` — an explicit bound — and scrolls correctly.
 *
 * ── ⛔ WHAT THIS SUITE DOES *NOT* PROVE ──────────────────────────────────────────────────
 *
 * **A fence alone is a presence assertion and does NOT satisfy SHELL-01 — D-244-19's measured
 * bound lives in 244-VALIDATION.md.** jsdom does no layout, so nothing here can observe the
 * rail moving or the dead space under the composer. What this pins is that the four classes
 * cannot be deleted silently, and that a THIRD `<ScrollArea` call site cannot arrive unbounded.
 * The pixels are driven in a real browser at `/gsd:verify-work`.
 */

import { describe, it, expect } from "vitest"

import chatLayoutSource from "@/components/layout/ChatLayout.tsx?raw"
import chatAreaSource from "@/components/chat/ChatArea.tsx?raw"
import messageListSource from "@/components/chat/MessageList.tsx?raw"

/** The house normaliser — CRLF checkouts must not change what a fence sees. */
const lf = (s: string) => s.replace(/\r\n/g, "\n")

const CHAT_LAYOUT = lf(chatLayoutSource)
const CHAT_AREA = lf(chatAreaSource)
const MESSAGE_LIST = lf(messageListSource)

/**
 * Strip `//` line comments and block comments so a comment MENTIONING `<ScrollArea` can
 * neither satisfy nor break a count. ⚠ Deliberately crude (it does not parse strings) —
 * it is applied only to the call-site sweep below, never to a class-list assertion.
 */
const stripComments = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "")

/** Every `<ScrollArea …>` OPENING tag — not `<ScrollAreaPrimitive.*`, not `</ScrollArea>`. */
const scrollAreaOpenings = (src: string): string[] =>
  Array.from(stripComments(src).matchAll(/<ScrollArea(?![A-Za-z])([^>]*)>/g)).map((m) => m[1])

describe("SHELL-01 · the chat frame is bounded — the four-link min-h-0 chain", () => {
  it("link 2: ChatLayout's grid track carries min-h-0 alongside flex-1", () => {
    // The grid track div — the one whose class list carries `grid min-w-0 flex-1 overflow-hidden`.
    const track = CHAT_LAYOUT.match(/className="(grid min-w-0[^"]*)"/)
    expect(track, "the grid-track className was not found — did the class list change?").not.toBeNull()
    expect(track![1]).toContain("flex-1")
    expect(track![1]).toContain("min-h-0")
  })

  it("link 3: ChatLayout's <main> cell carries min-h-0", () => {
    const main = CHAT_LAYOUT.match(/<main className="([^"]*)"/)
    expect(main, "<main className=…> was not found in ChatLayout").not.toBeNull()
    expect(main![1]).toContain("min-w-0")
    expect(main![1]).toContain("min-h-0")
    expect(main![1]).toContain("overflow-hidden")
  })

  it("link 4: ChatArea's chat-column root carries min-h-0 alongside flex flex-col h-full", () => {
    // The root of the thread branch: `flex flex-col h-full bg-background`.
    const root = CHAT_AREA.match(/className="(flex flex-col h-full[^"]*)"/)
    expect(root, "the ChatArea column root className was not found").not.toBeNull()
    expect(root![1]).toContain("h-full")
    expect(root![1]).toContain("min-h-0")
  })

  it("link 5: MessageList's <ScrollArea> is BOUNDED — min-h-0 alongside flex-1", () => {
    const openings = scrollAreaOpenings(MESSAGE_LIST)
    expect(openings).toHaveLength(1)
    expect(openings[0]).toContain("flex-1")
    expect(openings[0]).toContain("min-h-0")
  })

  /**
   * ⭐ THE ANTI-REGRESSION THIS FENCE EXISTS FOR. The four assertions above pin today's two
   * files; this one pins the RULE — a new `<ScrollArea>` anywhere in `src/` must carry a
   * bound. An unbounded third call site re-opens BUG-260828-08 somewhere else entirely.
   *
   * Inventory pinned BY FILE, not merely by total (the `ChatLayout.badge.test.tsx:296` idiom),
   * so a swap of one call site for another cannot pass on an unchanged count.
   */
  it("every <ScrollArea> call site in src/ is bounded, and there are exactly two", () => {
    const RAW = import.meta.glob("/src/**/*.{ts,tsx}", {
      query: "?raw",
      import: "default",
      eager: true,
    }) as Record<string, string>

    const isTest = (p: string) => /\.test\.(ts|tsx)$/.test(p) || p.includes("/__tests__/")
    const sites: { file: string; attrs: string }[] = []
    for (const [path, source] of Object.entries(RAW)) {
      if (isTest(path)) continue
      // The primitive's own module DEFINES the component; it is not a call site.
      if (path.endsWith("/src/components/ui/scroll-area.tsx")) continue
      for (const attrs of scrollAreaOpenings(lf(source))) sites.push({ file: path, attrs })
    }

    // ⚠ Non-vacuity: the glob must actually have loaded product source.
    expect(Object.keys(RAW).length).toBeGreaterThan(100)

    expect(sites.map((s) => s.file).sort()).toEqual([
      "/src/components/chat/MessageList.tsx",
      "/src/components/chat/tool-bodies/ReadDocumentBody.tsx",
    ])

    for (const site of sites) {
      const bounded = /\bmin-h-0\b/.test(site.attrs) || /\bmax-h-/.test(site.attrs) || /\bh-/.test(site.attrs)
      expect(bounded, `${site.file} mounts an UNBOUNDED <ScrollArea>: ${site.attrs.trim()}`).toBe(true)
    }
  })
})
