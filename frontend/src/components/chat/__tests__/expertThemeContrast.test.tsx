/**
 * Phase 267 UI review, top fix #1 (BLOCKER) — the phase's semantic colours must read on BOTH themes.
 *
 * The sketch was judged on Deep Midnight only, so every Phase 267 tone was a dark-card step
 * (`text-violet-200`, `text-emerald-300`, `text-rose-300`) with zero `dark:` variants. The app also
 * ships a light `:root` theme with a user toggle, and on it those steps measured ~1.3:1, ~1.5:1 and
 * ~1.9:1 against the light surfaces — the swap/removal header, the only thing that tells the two
 * apart, could barely be seen in the operator's own G-4 screenshots.
 *
 * The fix follows the prevailing repo pattern (`text-amber-700 dark:text-amber-300`,
 * `SourceToolsCard.tsx`; `text-emerald-600 dark:text-emerald-400`, `McpAuthDoor.tsx`): a light-safe
 * step paired with the original dark step, so the dark look is unchanged.
 *
 * Two layers:
 *   (A) RENDERED — the elements the review named carry BOTH a light-safe class and the dark class.
 *   (B) CLASS FENCE over the six phase files — no light-on-dark text step (50-400) of the four
 *       semantic hues may appear without a `dark:` prefix, and every `dark:text-<hue>-N` line must
 *       carry a bare `text-<hue>-(600|700|800|900)` companion. A comment that names a bare dark step
 *       fails this fence too — that is the safe direction for a fence.
 */
import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import expertChangedRaw from "../../../../../backend/tests/fixtures/phase267/expert_changed.json?raw"
// @ts-ignore — Vite `?raw` import.
import eventCardSrc from "../ExpertEventCard.tsx?raw"
// @ts-ignore — Vite `?raw` import.
import inviteSrc from "../InviteExpertDialog.tsx?raw"
// @ts-ignore — Vite `?raw` import.
import handoffSrc from "../HandoffCard.tsx?raw"
// @ts-ignore — Vite `?raw` import.
import ledgerSrc from "../../experts/ScopeLedger.tsx?raw"
// @ts-ignore — Vite `?raw` import.
import cardSrc from "../../experts/catalog/ExpertCard.tsx?raw"
// @ts-ignore — Vite `?raw` import.
import modalSrc from "../../experts/catalog/ExpertDetailModal.tsx?raw"
// @ts-ignore — Vite `?raw` import. Phase 268-02: the three new /admin/spend leaves (UI-SPEC §4.3).
import pillsSrc from "../../admin/spend/ExpertFilterPills.tsx?raw"
// @ts-ignore — Vite `?raw` import.
import spendCardSrc from "../../admin/spend/ExpertSpendCard.tsx?raw"
// @ts-ignore — Vite `?raw` import.
import disclosuresSrc from "../../admin/spend/AttributionDisclosures.tsx?raw"
import type { ExpertChangedEvent } from "@/lib/api/threads"
import { ExpertEventCard } from "../ExpertEventCard"
import { ScopeLedger } from "../../experts/ScopeLedger"
import { ExpertSpendCard, LedgerExpertCell } from "../../admin/spend/ExpertSpendCard"

const changed = JSON.parse(expertChangedRaw as string) as ExpertChangedEvent

/** The class list must carry the light-safe step AND the original dark step. */
function expectBothThemes(el: Element, light: string, dark: string) {
  const cls = el.getAttribute("class") ?? ""
  expect(cls.split(/\s+/), `light-safe "${light}" missing from "${cls}"`).toContain(light)
  expect(cls.split(/\s+/), `dark "${dark}" missing from "${cls}"`).toContain(dark)
}

describe("(A) rendered — the review's named elements carry a light-safe step beside the dark one", () => {
  it("(1) the expert_changed header is violet-700 on light, violet-200 on dark", () => {
    render(<ExpertEventCard event={changed} />)
    const card = screen.getByTestId("expert-event-card")
    const header = within(card).getByText("Financial Analyzer → HR Advisor")
    expectBothThemes(header, "text-violet-700", "dark:text-violet-200")
    const glyph = card.querySelector("svg")
    expect(glyph).not.toBeNull()
    expectBothThemes(glyph!, "text-violet-700", "dark:text-violet-300")
  })

  it("(2) Now values are emerald-700 / emerald-300; Dropped values are rose-700 / rose-300", () => {
    render(<ExpertEventCard event={changed} />)
    const now = within(screen.getByTestId("expert-event-now")).getByText("HR Policies")
    expectBothThemes(now, "text-emerald-700", "dark:text-emerald-300")
    const dropped = within(screen.getByTestId("expert-event-dropped")).getByText(
      "Financial Reports & Filings",
    )
    expectBothThemes(dropped, "text-rose-700", "dark:text-rose-300")
  })

  it("(3) the ledger's column borders carry a light step that does not vanish on white", () => {
    render(
      <ScopeLedger
        columns={[
          { tone: "yes", heading: "Will use", items: [{ label: "HR Policies" }] },
          { tone: "no", heading: "Won't use · 4", items: [{ label: "ACME_MSA_2026.pdf" }] },
        ]}
      />,
    )
    expectBothThemes(screen.getByTestId("scope-ledger-col-yes"), "border-emerald-600/40", "dark:border-emerald-500/25")
    expectBothThemes(screen.getByTestId("scope-ledger-col-no"), "border-rose-600/40", "dark:border-rose-500/25")
  })

  // ── Phase 268-02 (UI-SPEC §4.3): the /admin/spend leaves, rendered on both themes. ──────
  const spendLine = (key: string, spendUsd: number, runCount: number) => ({
    key,
    expertId: key === "none" ? null : key,
    name: key === "none" ? null : "HR Advisor",
    deleted: false,
    scopeMode: null,
    runCount,
    inputTokens: 10,
    outputTokens: 5,
    spendUsd,
    unratedCount: 0,
  })
  const spendLines = [spendLine("11111111-1111-4111-8111-111111111111", 1, 2), spendLine("none", 0.5, 1)]

  it("(7) the recon footer's OK state is emerald-700 on light, emerald-300 on dark", () => {
    render(
      <ExpertSpendCard
        state="ready"
        lines={spendLines}
        windowTotalUsd={1.5}
        windowRunCount={3}
        windowLabel="Last 30D"
        selected={null}
        selectedLabel={null}
        onSelect={() => {}}
      />,
    )
    expectBothThemes(screen.getByTestId("expert-spend-recon"), "text-emerald-700", "dark:text-emerald-300")
  })

  it("(8) the recon footer's FAILED state is rose-700 on light, rose-300 on dark", () => {
    render(
      <ExpertSpendCard
        state="ready"
        lines={spendLines}
        windowTotalUsd={1.5001}
        windowRunCount={3}
        windowLabel="Last 30D"
        selected={null}
        selectedLabel={null}
        onSelect={() => {}}
      />,
    )
    expectBothThemes(screen.getByTestId("expert-spend-recon"), "text-rose-700", "dark:text-rose-300")
  })

  it("(9) the ledger's Expert pill is violet-700 on light, violet-200 on dark", () => {
    render(
      <LedgerExpertCell
        run={{ expertId: "x", expertName: "HR Advisor", expertDeleted: false, expertAttributed: true }}
      />,
    )
    expectBothThemes(screen.getByTestId("ledger-expert-cell"), "text-violet-700", "dark:text-violet-200")
  })
})

const FILES: Record<string, string> = {
  "ExpertEventCard.tsx": eventCardSrc as string,
  "InviteExpertDialog.tsx": inviteSrc as string,
  "HandoffCard.tsx": handoffSrc as string,
  "ScopeLedger.tsx": ledgerSrc as string,
  "ExpertCard.tsx": cardSrc as string,
  "ExpertDetailModal.tsx": modalSrc as string,
  // Phase 268-02. The copy module stays OUT: it is < 1000 chars of class-free strings.
  "ExpertFilterPills.tsx": pillsSrc as string,
  "ExpertSpendCard.tsx": spendCardSrc as string,
  "AttributionDisclosures.tsx": disclosuresSrc as string,
}

// Phase 268-02: indigo joins — it is the scope / filter accent, and light `--primary` indigo
// measured 4.47:1 on white, below 4.5:1 (UI-SPEC §4.2).
const HUES = "violet|emerald|rose|amber|indigo"
/** Measured at 268-02 GREEN: 28 pairs in 267's six files + 10 in 268-02's three leaves. A drop
 * below it means a leaf left FILES or lost its pairs. */
const PAIR_FLOOR = 38
/** A text step on one of the four semantic hues, with its optional variant prefix captured. */
const TOKEN = new RegExp(`(^|[\\s"'\`(])((?:[a-z-]+:)*)text-(${HUES})-(\\d{2,3})(?![\\d])`, "g")

describe("(B) class fence — no dark-only text step on the phase files (267's six + 268-02's three)", () => {
  it("(4) every source is non-trivial (the fence cannot pass over an empty import)", () => {
    for (const [name, src] of Object.entries(FILES)) {
      expect(src.length, name).toBeGreaterThan(1000)
    }
  })

  it("(5) a light-on-dark step (50-400) appears only behind `dark:`", () => {
    const offenders: string[] = []
    for (const [name, src] of Object.entries(FILES)) {
      src.split(/\r?\n/).forEach((line, i) => {
        for (const m of line.matchAll(TOKEN)) {
          const variants = m[2]
          const step = Number(m[4])
          if (step <= 400 && !variants.includes("dark:")) {
            offenders.push(`${name}:${i + 1} text-${m[3]}-${step}`)
          }
        }
      })
    }
    expect(offenders).toEqual([])
  })

  it("(6) every `dark:text-<hue>-N` line carries a bare light-safe companion (600-900) of the same hue", () => {
    const orphans: string[] = []
    let pairs = 0
    for (const [name, src] of Object.entries(FILES)) {
      src.split(/\r?\n/).forEach((line, i) => {
        for (const m of line.matchAll(TOKEN)) {
          if (!m[2].includes("dark:")) continue
          pairs += 1
          const companion = new RegExp(`(^|[\\s"'\`(])text-${m[3]}-(600|700|800|900)(?![\\d])`)
          if (!companion.test(line)) orphans.push(`${name}:${i + 1} dark:text-${m[3]}-${m[4]}`)
        }
      })
    }
    expect(orphans).toEqual([])
    // Non-vacuity: the fence has pairs to check (the review named eight sites; 268-02 raised
    // the floor to the pair count measured with its three leaves in FILES).
    expect(pairs).toBeGreaterThanOrEqual(PAIR_FLOOR)
  })
})
