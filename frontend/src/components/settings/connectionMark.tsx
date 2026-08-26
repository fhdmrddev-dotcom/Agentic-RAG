/**
 * Phase 206.1-01 (item 3 · CONN-02 · SC#3 · D-206.1-08 / -09 / -10 / -11 / -23,
 * UI-SPEC § Surface 3) — the ONE service-to-mark map for Settings → Connections.
 *
 * ── THE RULE, IN ONE SENTENCE ──
 * A vendor shows its OWN mark; a vendorless shape is drawn in the interface's own ink.
 *
 * That is the operator's icon convention (`references/icon-convention.md` §1, Running
 * Design Decision 43, 2026-06-27) — one source, byte-identical everywhere — and the
 * ROADMAP's SC#3 makes it binding for this surface. Two arms of one sentence, deliberately,
 * rather than a rule plus two exceptions: `send_email` is SMTP, a protocol with no vendor,
 * and the unmapped fallback has no vendor by definition. Both take the neutral mark for the
 * SAME reason, which is why neither is written as a special case.
 *
 * ⚠ WHY THIS IS A `.tsx` AND NOT PART OF `connectionsCopy.ts` — this module exports
 * COMPONENTS, and a module exporting both components and constants trips
 * `react-refresh/only-export-components`. Plan 190-12 MEASURED that cost (`eslint
 * src/components/workflows/` went 5 → 10 on exactly that rule); `connectionsCopy.ts:11-18`
 * records it. The strings stay there; the marks live here.
 *
 * ── ⚠ SLUG VERIFICATION — AGAINST THE INSTALLED PACKAGE, NOT AGAINST ANY DOCUMENT ──
 * icon-convention §3's measured trap: `fluent-emoji:direct-hit` shipped BLANK in Phase 127.
 * Measured 2026-08-25 against `@iconify-json/logos@1.2.13` (2110 icons, prefix `logos`;
 * the collection carries 9 aliases, all typo-redirects for unrelated names, and NONE of the
 * three slugs below is one of them):
 *
 *   `logos:slack-icon`                  PRESENT · 256x256 · body 1159 · 4 of 4 fills
 *   `logos:jira`                        PRESENT · 256x256 · body  924 · 3 of 3 fills
 *   `logos:model-context-protocol-icon` PRESENT · 256x285 · body 1060 · 0 fills, no currentColor
 *
 * For the record, the near-misses that must NEVER be tried:
 *   · `logos:slack` — a WORDMARK, 512x130. In an h-4 w-4 box `preserveAspectRatio` defaults
 *     to `xMidYMid meet`, which letterboxes it to a ~4px-tall unreadable strip.
 *   · `logos:model-context-protocol` — likewise a WORDMARK, 512x69 (7.4:1).
 *   · `logos:jira-icon` — DOES NOT EXIST. The square Jira mark is plain `logos:jira`.
 * `-icon` is not a style preference here; it is the difference between a mark and a smear.
 *
 * ⚠ AND `logos` CARRIES NO SMTP MARK AT ALL — `smtp`, `email` and `envelope` each return
 * ZERO. Its only mail-shaped names are VENDORS: `google-gmail`, `mailchimp`, `mailgun`,
 * `mailjet`. Borrowing Gmail's mark for a Fastmail SMTP connection is the ROADMAP's own
 * named *"a logo is approximated"* failure, and structurally it is the `destinationFactsOf`
 * defect in a different column — a positional resemblance standing in for a fact the row
 * does not have. SMTP therefore gets the neutral mark, and that is a FINDING, not a gap.
 *
 * ── ⚠ CORRECTION BESIDE THE ORIGINAL — `icon-convention.md` §3's MECHANISM ──
 * §3 records that a missing slug *"rendered EMPTY"*. Its FACT is still true and still worth
 * obeying. Its MECHANISM does not apply on THIS loading path, measured this phase: under
 * `unplugin-icons` with a LOCAL collection, an absent slug is a TRANSFORM-TIME HARD ERROR
 * and the suite loads ZERO tests — identically for a slug from an UNINSTALLED collection.
 * The empty-render failure belongs to the RUNTIME Iconify API path (`<Icon icon="..."/>`
 * fetching from api.iconify.design), which this repo does not use here.
 *
 * So *"verify the slug resolves"* needs no build assertion on this surface: THE IMPORT IS
 * THE FENCE. What still needs a test is *resolved-but-EMPTY* — plus a class §3 did not
 * anticipate and this module met head-on: *resolved-but-INVISIBLE*. See the ink contract.
 *
 * ── THE INK CONTRACT (AR-02) — THREE INKS, ONE PER ICON-BODY MECHANIC ──
 * Each ink exists because of a MEASURED property of the body it is applied to, not because
 * of taste:
 *
 *   `self`   — nothing but size. Slack's 4 drawable elements each carry their OWN fill and
 *              Jira's 3 likewise, so a colour utility would be inert, and a fill utility
 *              would flatten four brand colours into one.
 *   `fill`   — MCP ONLY. ⚠ Its body has ONE drawable element, ZERO of which carry a fill,
 *              and it contains no `currentColor`. It therefore inherits the SVG default
 *              `fill: black`, and on Deep Midnight (`--card: 220 30% 7%`) it is effectively
 *              INVISIBLE. The slug resolves, the body is 1060 characters, every test is
 *              green, and the person sees NOTHING. That is icon-convention §3's trap in a
 *              new form, and the build-error fence structurally cannot catch it.
 *   `stroke` — the lucide glyphs, and ⚠ NEVER a fill utility. `lucide-react` sets
 *              `fill="none" stroke="currentColor"` as PRESENTATION ATTRIBUTES on the root
 *              <svg>, and a CSS rule on that same element BEATS a presentation attribute —
 *              so a fill utility here would fill the outline into a solid blob.
 *
 * ⚠ THE DIMMED VARIANT OF THE MUTED-FOREGROUND TOKEN IS NEVER USED HERE. That CSS variable
 * has no Tailwind key outside `components/panel/*`, so the utility would compile to NOTHING
 * and ship looking intentional — the `bg-warning` defect Phase 192.2 measured. Its exact
 * spelling is deliberately NOT written anywhere in this file: the suite greps this source
 * for it and expects ZERO, so a docblock quoting the needle would turn its own guard red.
 * That is the 187-24 trap, and it FIRED on this very file — the first draft of this
 * paragraph named the class and the fence went red on the comment that forbade it.
 */
import type { ComponentType, SVGProps } from "react"
import { Mail, Plug } from "lucide-react"

// Build-time bundled imports — `unplugin-icons` resolves each slug to a React SVG component
// at transform time, in the vite build AND in vitest (both configs wire the plugin). A
// missing slug is a hard error here, which is the whole of the verify-or-bundle discipline.
import SlackIcon from "~icons/logos/slack-icon"
import JiraIcon from "~icons/logos/jira"
import McpIcon from "~icons/logos/model-context-protocol-icon"

import { cn } from "@/lib/utils"

/**
 * An `unplugin-icons` bundled SVG component, or a `lucide-react` glyph.
 *
 * ⚠ This is a LOCAL alias of `lib/phaseGlyph.tsx:66`'s `PhaseMark`, deliberately declared
 * here rather than imported. The two shapes are identical, but this module mixes bundled
 * Iconify components with lucide's `ForwardRefExoticComponent`, and if those ever diverge
 * the widening belongs HERE — `lib/phaseGlyph.tsx` is a `lib/` leaf with other consumers
 * and must not be widened to accommodate a `components/settings/` need.
 */
export type ConnectionMark = ComponentType<SVGProps<SVGSVGElement> & { size?: number | string }>

/** Which of the three ink mechanics a mark's body needs. See the header. */
export type ConnectionMarkInk = "self" | "fill" | "stroke"

/**
 * The input this module resolves against — deliberately STRUCTURAL rather than
 * `ConnectorConnection`.
 *
 * A whole `ConnectorConnection` satisfies it, and so does a filter chip's bare
 * `{ capability }`, without this module importing from `@/lib/api`. ⚠ That import is also
 * forbidden by D-206.1-02: Phase 207 owns `api.ts` and Phase 206 already paid its ledger
 * trigger, so this surface reads those types and never edits or widens them.
 */
export interface ConnectionMarkShape {
  service_id?: string | null
  capability?: string | null
  mcp_server_url?: string | null
  tool_name?: string | null
}

/** A resolved mark: which entry answered, what to render, and how to ink it. */
export interface ConnectionMarkEntry {
  key: string
  Mark: ConnectionMark
  ink: ConnectionMarkInk
}

// ── The map. MODULE-PRIVATE, and that is load-bearing ────────────────────────────────
const MARKS: Record<string, ConnectionMarkEntry> = {
  send_email: { key: "send_email", Mark: Mail, ink: "stroke" },
  create_ticket: { key: "create_ticket", Mark: JiraIcon, ink: "self" },
  post_message: { key: "post_message", Mark: SlackIcon, ink: "self" },
}

/** MCP's own real mark. Reached by its OWN condition, never by a capability key. */
const MCP_MARK: ConnectionMarkEntry = { key: "mcp", Mark: McpIcon, ink: "fill" }

/** The NAMED neutral — never nothing, and never another service's mark (D-206.1-10). */
const NEUTRAL_MARK: ConnectionMarkEntry = { key: "unknown", Mark: Plug, ink: "stroke" }

/** Known service identity marks. */
const SERVICE_MARKS: Record<string, ConnectionMarkEntry> = {
  slack: { key: "slack", Mark: SlackIcon, ink: "self" },
  jira: { key: "jira", Mark: JiraIcon, ink: "self" },
  smtp: { key: "smtp", Mark: Mail, ink: "stroke" },
  mcp: MCP_MARK,
  custom_mcp: MCP_MARK,
}

/**
 * The CAPABILITY keys this map covers. The keys only — never the map itself.
 */
export const CONNECTION_MARK_KEYS: readonly string[] = Object.keys(MARKS)

/**
 * Resolve a connection's mark. TOTAL over any input — it always returns an entry and NEVER null.
 */
export function connectionMark(shape: ConnectionMarkShape | null | undefined): ConnectionMarkEntry {
  const serviceId = shape?.service_id
  if (typeof serviceId === "string" && serviceId.trim().length > 0) {
    const key = serviceId.trim().toLowerCase()
    if (Object.prototype.hasOwnProperty.call(SERVICE_MARKS, key)) {
      return SERVICE_MARKS[key]
    }
    // If unknown service_id has an mcp_server_url or tool_name, resolve MCP mark
    if (shape?.mcp_server_url || shape?.tool_name) {
      return MCP_MARK
    }
  }

  const url = shape?.mcp_server_url
  if (typeof url === "string" && url.trim().length > 0) return MCP_MARK

  const tool = shape?.tool_name
  if (typeof tool === "string" && tool.trim().length > 0) return MCP_MARK

  const capability = shape?.capability
  if (typeof capability === "string" && Object.prototype.hasOwnProperty.call(MARKS, capability)) {
    return MARKS[capability]
  }

  return NEUTRAL_MARK
}

/** Size tokens. The ONLY thing the consuming call sites differ by. */
const SIZE_CLASS: Record<"row" | "chip" | "canvas", string> = {
  row: "h-4 w-4 flex-none",
  chip: "h-3 w-3 flex-none",
  canvas: "h-8 w-8 flex-none",
}

/** Ink tokens, one per body mechanic. `self` adds nothing — see the header for why. */
const INK_CLASS: Record<ConnectionMarkInk, string> = {
  self: "",
  fill: "fill-current text-muted-foreground",
  stroke: "text-muted-foreground",
}

/**
 * The ONE render path. Parameterised by size and never branched on.
 *
 * `aria-hidden` because a mark is never the accessible name of anything here: the row's name
 * is its own text, and the chip's label is its own text.
 */
export function ConnectionMarkGlyph({
  shape,
  size,
}: {
  shape: ConnectionMarkShape
  size: "row" | "chip" | "canvas"
}) {
  const { Mark, ink } = connectionMark(shape)
  return <Mark aria-hidden="true" className={cn(SIZE_CLASS[size], INK_CLASS[ink])} />
}
