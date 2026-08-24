/**
 * Phase 206.1-01 (item 3 · CONN-02 · SC#3 · D-206.1-08 / -09 / -10 / -11 / -23,
 * UI-SPEC § Surface 3) — the per-service mark map's direct guard.
 *
 * ── WHY THIS SUITE EXISTS AT ALL, given the import is already a fence ──
 * Measured this phase (RESEARCH §OQ#2b): under `unplugin-icons` with a LOCAL collection an
 * absent slug is a TRANSFORM-TIME HARD ERROR and the suite loads ZERO tests. So *"the slug
 * resolves"* needs no assertion here — this file LOADING AT ALL is that assertion, and it
 * is simultaneously the non-vacuity control for the devDependency itself: drop the
 * `package.json` entry and this suite dies with ``Icon `logos/slack-icon` not found``.
 *
 * What the import fence structurally CANNOT catch is the residual half, and that is what
 * every case below is for:
 *
 *   1. RESOLVED-BUT-EMPTY — the slug exists, the component renders, and its body is blank.
 *      This is icon-convention §3's measured trap (`fluent-emoji:direct-hit`, Phase 127).
 *   2. RESOLVED-BUT-WRONG — a copy-paste maps two shapes to one import, so an MCP row wears
 *      Slack's mark. That is the ROADMAP's own named failure, and it is asserted on the
 *      RENDERED BODY rather than on component identity, per SC#3's wording.
 *   3. RESOLVED-BUT-INVISIBLE — the ink contract (AR-02). A black mark on a
 *      `--card: 220 30% 7%` surface resolves, renders 1060 characters, passes every other
 *      case in this file, and shows the person NOTHING.
 *   4. THE LOOKUP ITSELF — `capability` is server data, so a prototype key must resolve the
 *      NAMED NEUTRAL and never the `Object` function (WR-04, the eighth live sink at 200-04).
 *
 * ⚠ Every negative block below carries a POSITIVE CONTROL in the same describe. Without one,
 * a resolver that answered *neutral* to literally every input would satisfy the whole file
 * while looking perfectly safe (`runFacts.test.ts:207-212`'s stated reason).
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"

import { connectionMark, CONNECTION_MARK_KEYS, ConnectionMarkGlyph } from "../connectionMark"
// The module's SOURCE via Vite's `?raw` loader — the house idiom for a fence the rendered
// DOM cannot express (`ConnectionsTab.test.tsx:47`, `ConnectionFormPanel.test.tsx:48`).
import markSource from "../connectionMark?raw"

afterEach(() => {
  cleanup()
})

// ── Helpers ──────────────────────────────────────────────────────────────────────────

type Shape = Parameters<typeof connectionMark>[0]

/** The rendered BODY of a resolved mark. SC#3 is worded against the body, not the component
 *  identity: two keys pointing at one import are a DIFFERENT defect from two keys pointing
 *  at two imports that happen to draw the same thing, and only the body can tell them apart. */
function bodyOf(shape: Shape): string {
  const { Mark } = connectionMark(shape)
  const { container } = render(<Mark />)
  const svg = container.querySelector("svg")
  expect(svg).not.toBeNull()
  return svg!.innerHTML
}

function glyphClass(shape: Shape, size: "row" | "chip"): string {
  const { container } = render(<ConnectionMarkGlyph shape={shape ?? {}} size={size} />)
  const svg = container.querySelector("svg")
  expect(svg).not.toBeNull()
  return svg!.getAttribute("class") ?? ""
}

const SLACK = { capability: "post_message" }
const JIRA = { capability: "create_ticket" }
const SMTP = { capability: "send_email" }
const MCP = { mcp_server_url: "https://mcp.deepwiki.com/mcp" }
const UNMAPPED = { capability: "not_a_capability" }

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · Resolution — each shape reaches its OWN entry
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("resolution — a vendor shows its own mark", () => {
  it("post_message resolves the Slack entry", () => {
    expect(connectionMark(SLACK).key).toBe("post_message")
  })

  it("create_ticket resolves the Jira entry", () => {
    expect(connectionMark(JIRA).key).toBe("create_ticket")
  })

  it("send_email resolves the SMTP entry — a vendorless protocol, drawn in our own ink", () => {
    // ⚠ `@iconify-json/logos` carries NO smtp / email / envelope mark at all (measured: all
    // three return zero). Its only mail-shaped names are VENDORS — google-gmail, mailchimp,
    // mailgun, mailjet — and rendering one of those for a Fastmail SMTP connection is the
    // ROADMAP's named *approximated* failure.
    expect(connectionMark(SMTP).key).toBe("send_email")
    expect(connectionMark(SMTP).ink).toBe("stroke")
  })

  it("an mcp_server_url resolves the MCP entry", () => {
    expect(connectionMark(MCP).key).toBe("mcp")
  })

  it("exports the CAPABILITY keys and NOT the map (phaseGlyph.tsx:96's shape)", () => {
    expect([...CONNECTION_MARK_KEYS].sort()).toEqual([
      "create_ticket",
      "post_message",
      "send_email",
    ])
    // ⚠ `mcp` is deliberately NOT a key of the capability map. If it were, a server-supplied
    // `capability: "mcp"` would resolve MCP's mark on a row that has no server URL — a spoof
    // this shape makes structurally impossible rather than merely unlikely.
    expect(CONNECTION_MARK_KEYS).not.toContain("mcp")
    expect(CONNECTION_MARK_KEYS).not.toContain("unknown")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · The MCP arm is its OWN condition (D-206.1-11)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("D-206.1-11 — MCP identifies itself, it does not fall off the end of a ladder", () => {
  it("a URL with a NULL capability resolves MCP", () => {
    expect(connectionMark({ capability: null, mcp_server_url: "https://x/mcp" }).key).toBe("mcp")
  })

  it("⚠ a URL BESIDE a real capability still resolves MCP — the URL wins", () => {
    // MCP is a SHAPE, not a capability, so its arm is first. A row carrying both is not a
    // Slack row with a note; it is an MCP row whose capability column is noise.
    expect(
      connectionMark({ capability: "post_message", mcp_server_url: "https://x/mcp" }).key,
    ).toBe("mcp")
  })

  it("⚠ a NULL capability ALONE does NOT resolve MCP — it resolves the named neutral", () => {
    // This is the exact defect `destinationFactsOf` shipped and `147f3c57` repaired: an
    // ABSENCE read as a default, so every capability-less row claimed a fact it did not have.
    expect(connectionMark({ capability: null }).key).toBe("unknown")
    expect(connectionMark({ capability: null }).key).not.toBe("mcp")
  })

  it("an EMPTY-STRING url is not a url — it resolves the named neutral", () => {
    expect(connectionMark({ capability: null, mcp_server_url: "" }).key).toBe("unknown")
  })

  it("the MCP mark is neither Slack's nor Jira's — asserted on the RENDERED BODY", () => {
    const mcp = bodyOf(MCP)
    expect(mcp.length).toBeGreaterThan(0)
    expect(mcp).not.toBe(bodyOf(SLACK))
    expect(mcp).not.toBe(bodyOf(JIRA))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · Resolved-but-EMPTY and resolved-but-IDENTICAL — the import fence's residual half
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("every mark renders a non-empty, distinct body", () => {
  const ALL = [
    ["slack", SLACK],
    ["jira", JIRA],
    ["smtp", SMTP],
    ["mcp", MCP],
    ["neutral", UNMAPPED],
  ] as const

  it.each(ALL)("%s renders an <svg> with a non-empty body", (_label, shape) => {
    expect(bodyOf(shape).length).toBeGreaterThan(0)
  })

  it("all five bodies are PAIRWISE DISTINCT", () => {
    // A copy-paste that maps two shapes to one import passes every case above and fails here.
    const bodies = ALL.map(([, shape]) => bodyOf(shape))
    expect(new Set(bodies).size).toBe(ALL.length)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · The NAMED neutral — never nothing, never another service's mark (D-206.1-10)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the fallback is a NAMED neutral and it is not blank", () => {
  it.each([
    ["an unmapped capability", { capability: "not_a_capability" }],
    ["an empty string", { capability: "" }],
    ["whitespace", { capability: "   " }],
    ["an absent capability", {}],
    ["undefined input", undefined],
    ["null input", null],
  ])("%s resolves the named neutral", (_label, shape) => {
    const entry = connectionMark(shape as Shape)
    expect(entry.key).toBe("unknown")
    expect(typeof entry.Mark).toBe("function")
  })

  it("⚠ BOTH halves — it is the neutral AND it is not blank, and not Slack's or Jira's", () => {
    // A `null` return would push this half out to the call site, where SC#3(e) cannot be
    // asserted on the module at all. That is why the miss arm copies
    // `phaseStatusMeta.ts:207-210`'s NAMED default rather than `phaseGlyph.tsx`'s `null`.
    const neutral = bodyOf(UNMAPPED)
    expect(neutral.length).toBeGreaterThan(0)
    expect(neutral).not.toBe(bodyOf(SLACK))
    expect(neutral).not.toBe(bodyOf(JIRA))
    expect(neutral).not.toBe(bodyOf(MCP))
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · The prototype-key guard (WR-04) — with its positive control
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("WR-04 — an INHERITED key never becomes a mark", () => {
  it.each(["constructor", "toString", "__proto__", "hasOwnProperty", "valueOf"])(
    "%p resolves the named neutral, and its Mark is a component",
    (capability) => {
      // Measured in this repository four separate times, most recently the EIGHTH live sink
      // at 200-04: a coalesced bracket read hands back the `Object` FUNCTION for an inherited
      // key — never nullish, so the fallback never fires — and React refuses a function as a
      // child, rendering NOTHING AT ALL rather than a wrong icon.
      const entry = connectionMark({ capability })
      expect(entry.key).toBe("unknown")
      expect(typeof entry.Mark).toBe("function")
      expect(entry.Mark).not.toBe(Object)
    },
  )

  it("POSITIVE CONTROL — the four mapped shapes DO resolve their own entries", () => {
    // Without this, a resolver answering `unknown` to every input would satisfy every
    // negative case in this file.
    expect(connectionMark(SLACK).key).toBe("post_message")
    expect(connectionMark(JIRA).key).toBe("create_ticket")
    expect(connectionMark(SMTP).key).toBe("send_email")
    expect(connectionMark(MCP).key).toBe("mcp")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · The three-ink contract (AR-02) — the RESOLVED-BUT-INVISIBLE guard
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("AR-02 — three inks, one per icon-body mechanic", () => {
  it("every glyph carries the row size tokens", () => {
    for (const shape of [SLACK, JIRA, SMTP, MCP, UNMAPPED]) {
      const cls = glyphClass(shape, "row")
      expect(cls).toContain("h-4")
      expect(cls).toContain("w-4")
      expect(cls).toContain("flex-none")
    }
  })

  it("⚠ the MCP glyph carries the fill utility AND a colour — it is BLACK without them", () => {
    // Measured 2026-08-25 against the installed `@iconify-json/logos@1.2.13`: the
    // `model-context-protocol-icon` body has ONE drawable element, ZERO of which carry a
    // fill, and contains no `currentColor`. It therefore inherits the SVG default
    // `fill: black`, and on Deep Midnight (`--card: 220 30% 7%`) it is effectively INVISIBLE.
    // The slug resolves, the body is 1060 characters, every other case in this file is
    // green, and the person sees nothing. This case is the only thing that can see that.
    const cls = glyphClass(MCP, "row")
    expect(cls).toContain("fill-current")
    expect(cls).toContain("text-muted-foreground")
    expect(connectionMark(MCP).ink).toBe("fill")
  })

  it("the SELF-coloured brand marks carry NO colour utility and NO fill utility", () => {
    // Slack's 4 drawable elements all carry their own fill, Jira's 3 likewise, so a colour
    // utility would be inert — and a fill utility would flatten four brand colours into one.
    for (const shape of [SLACK, JIRA]) {
      const cls = glyphClass(shape, "row")
      expect(cls).not.toMatch(/\bfill-/)
      expect(cls).not.toMatch(/\btext-/)
      expect(connectionMark(shape).ink).toBe("self")
    }
  })

  it("⚠ the lucide glyphs carry a colour utility and NEVER a fill utility", () => {
    // `lucide-react` sets `fill="none" stroke="currentColor"` as PRESENTATION ATTRIBUTES on
    // the root <svg>, and a CSS rule on that same element BEATS a presentation attribute —
    // so a fill utility here would fill the outline into a solid blob.
    for (const shape of [SMTP, UNMAPPED]) {
      const cls = glyphClass(shape, "row")
      expect(cls).toContain("text-muted-foreground")
      expect(cls).not.toMatch(/\bfill-/)
      expect(connectionMark(shape).ink).toBe("stroke")
    }
  })

  it("at chip size the SIZE tokens change and the INK tokens do not", () => {
    for (const shape of [SLACK, JIRA, SMTP, MCP, UNMAPPED]) {
      const row = glyphClass(shape, "row")
      const chip = glyphClass(shape, "chip")
      expect(chip).toContain("h-3")
      expect(chip).toContain("w-3")
      expect(chip).not.toContain("h-4")
      // the ink half is byte-identical between the two sizes
      const inkOf = (c: string) =>
        c
          .split(/\s+/)
          .filter((t) => t.startsWith("fill-") || t.startsWith("text-"))
          .sort()
          .join(" ")
      expect(inkOf(chip)).toBe(inkOf(row))
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · Source fences — the shapes the rendered DOM cannot express
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("source fences over the module's own text", () => {
  /** ⚠ Comment lines are STRIPPED before the forbidden-spelling count. This module's own
   *  prose NAMES the forbidden form, and a bare count over raw source reads its own docblock
   *  and goes red — the 187-24 trap, with six recorded firings in this repo. */
  const codeOnly = markSource
    .split("\n")
    .filter((line) => !/^\s*[/*]/.test(line))
    .join("\n")

  it("the guard is the inline hasOwnProperty spelling, and the coalesced read is absent", () => {
    expect(markSource).toContain("Object.prototype.hasOwnProperty.call")
    expect(codeOnly).not.toMatch(/\]\s*\?\?/)
  })

  it("POSITIVE CONTROL — the stripped source is not empty and still contains real code", () => {
    // Without this, a strip that ate the whole file would make the fence above vacuous.
    expect(codeOnly.length).toBeGreaterThan(200)
    expect(codeOnly).toContain("export function connectionMark")
    expect(codeOnly).toContain("Object.prototype.hasOwnProperty.call")
  })

  it("⚠ the two WORDMARK slugs are never imported, and the absent jira slug is never tried", () => {
    // `logos:slack` is 512x130 and `logos:model-context-protocol` is 512x69. In an h-4 w-4
    // box `preserveAspectRatio="xMidYMid meet"` letterboxes them to a ~4px unreadable strip:
    // `-icon` is the difference between a mark and a smear. And there is no `logos:jira-icon`
    // at all — the square Jira mark is plain `logos:jira`.
    expect(markSource).not.toContain('~icons/logos/slack"')
    expect(markSource).not.toContain('~icons/logos/model-context-protocol"')
    expect(markSource).not.toContain("logos/jira-icon")
  })

  it("exactly THREE brand imports and ONE lucide import — one home, not per-component", () => {
    expect((markSource.match(/~icons\/logos\//g) ?? []).length).toBe(3)
    expect((markSource.match(/from "lucide-react"/g) ?? []).length).toBe(1)
  })

  it("no class that compiles to NOTHING — the bg-warning defect", () => {
    // `--muted-foreground-dim` has no Tailwind key outside `components/panel/*`, so the
    // utility would emit no CSS and ship looking intentional (Phase 192.2's measured find).
    expect(markSource).not.toContain("text-muted-foreground-dim")
  })
})
