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
 *
 * ── ⚠ PHASE 244 PLAN 09 (gap G-5) — THE SIXTH LINK, AND WHY THERE HAD TO BE ONE ─────────
 *
 * The five links above are ALL in the MESSAGE column. The shell has a SIBLING column — the
 * desktop nav rail (`NavPanel.tsx`) — and 244-01 gave it neither treatment. Driven in Chrome
 * on 2026-09-12, that omission is measurable: below a viewport height of ~540px the PAGE ROOT
 * overflows (h=436 → `#root` scrollHeight 540 vs clientHeight 436, **+104px**; h=516 → +24px),
 * and the whole page scrolls. `rootScrollHeight` is PINNED at 540 at every viewport, and panel
 * state makes no difference at all — which is itself diagnostic: the overflowing element is
 * neither in the panel nor in the transcript.
 *
 * The rail's `mt-auto` footer block (`NavPanel.tsx`, the org/operator shields + ProfileMenu,
 * 128px tall) measures bottom = 540px, past the rail's own box, and every ancestor up to
 * `<html>` reads `overflow-y: visible` — so the excess escapes to the page scrollbar.
 *
 * ⛔ THE FIX IS NOT A `min-height` ANYWHERE. That makes the page scroll deliberately, which IS
 * the bug. The rail root gets `overflow-y-auto` so it scrolls its OWN content.
 *
 * ⛔ AND THIS CASE CANNOT VERIFY THAT. jsdom performs NO LAYOUT, so link 6 pins only that the
 * token cannot be deleted silently and proves NOTHING about whether the page overflows. The
 * pixels live in `.planning/phases/244-the-chat-shell-and-the-composer/244-09-UAT-ROW.md`,
 * driven in a real browser at `/gsd:verify-work`.
 */

import { describe, it, expect } from "vitest"

import chatLayoutSource from "@/components/layout/ChatLayout.tsx?raw"
import chatAreaSource from "@/components/chat/ChatArea.tsx?raw"
import messageListSource from "@/components/chat/MessageList.tsx?raw"
import navPanelSource from "@/components/layout/NavPanel.tsx?raw"

/** The house normaliser — CRLF checkouts must not change what a fence sees. */
const lf = (s: string) => s.replace(/\r\n/g, "\n")

const CHAT_LAYOUT = lf(chatLayoutSource)
const CHAT_AREA = lf(chatAreaSource)
const MESSAGE_LIST = lf(messageListSource)
const NAV_PANEL = lf(navPanelSource)

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

  /**
   * ⚠ MEASURED DURING THE GREEN PASS, recorded rather than quietly absorbed: `ChatArea.tsx`
   * has **TWO** roots carrying `flex flex-col h-full bg-background` — the WELCOME branch
   * (`if (!thread)`) and the thread branch. The plan named only the second. A `.match()`
   * assertion found the first and stayed RED, which is the fence doing its job. Both carry
   * the link-4 obligation, so this asserts EVERY such root, not the first one.
   */
  it("link 4: EVERY ChatArea column root carries min-h-0 alongside flex flex-col h-full", () => {
    const roots = Array.from(CHAT_AREA.matchAll(/className="(flex flex-col h-full[^"]*)"/g)).map(
      (m) => m[1],
    )
    expect(roots.length, "no ChatArea column root className was found").toBeGreaterThanOrEqual(2)
    for (const cls of roots) {
      expect(cls).toContain("h-full")
      expect(cls, `a ChatArea column root is unbounded: ${cls}`).toContain("min-h-0")
    }
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

  /**
   * ⭐ LINK 6 (Phase 244 plan 09, gap G-5) — THE SIBLING COLUMN.
   *
   * Links 2-5 bound the MESSAGE column. This one bounds the NAV RAIL, the column measured to
   * be the actual source of the page-root overflow below ~540px (see the header block).
   *
   * ⛔ `overflow-y-auto` IS THE FIX; `min-h-0` IS DEFENSIVE. The rail's box is ALREADY bounded
   * at the viewport (`h-full` inside `div.flex.h-screen`, measured `height = viewport`), so the
   * excess escapes purely because the computed overflow is `visible`. `min-h-0` is carried for
   * symmetry with the five sites 244-01 established, and because the automatic-minimum-size
   * rule is direction-dependent — it costs nothing and removes a future question. Naming which
   * token does the work matters here: a comment that claims more than it can is how this
   * project's hot-file ledger rows go wrong.
   *
   * ⛔ jsdom PERFORMS NO LAYOUT. This asserts the tokens are PRESENT. It cannot observe the
   * page overflowing, the rail scrolling, or the dead space under the composer — the pixels are
   * `244-09-UAT-ROW.md`, driven in a real browser.
   */
  it("link 6: NavPanel's rail root is BOUNDED and scrolls its own content", () => {
    // The rail root — the only class list in the file opening `hidden md:flex flex-col`.
    const rail = NAV_PANEL.match(/"(hidden md:flex flex-col[^"]*)"/)
    expect(
      rail,
      "the NavPanel rail-root className was not found — did the class list change? " +
        "Link 6 must be re-pointed rather than left silently matching nothing.",
    ).not.toBeNull()
    expect(rail![1]).toContain("h-full")
    expect(rail![1], `the rail root is unbounded: ${rail![1]}`).toContain("min-h-0")
    expect(
      rail![1],
      `the rail root cannot scroll its own content and will push the document: ${rail![1]}`,
    ).toContain("overflow-y-auto")
  })
})
