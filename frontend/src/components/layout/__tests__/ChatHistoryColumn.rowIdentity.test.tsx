/**
 * Phase 244 plan 01 Task 3 — `BUG-260816-03` (b) and (c): the thread row spends its width on
 * the THREAD, not on the folder.
 *
 * ⛔ SUB-DEFECT (a) IS NOT TAKEN HERE, AND THE REASONS ARE STRUCTURAL RATHER THAN A DIFFICULTY
 * JUDGEMENT. (a) is *"one hardcoded icon for every thread type"* — a workflow run and a chat
 * render identically. It is deferred because:
 *   1. `Thread` (`frontend/src/types/index.ts:7-14`) carries **no** kind/workflow discriminator,
 *      so no row can branch until `GET /threads` grows a field. That is a FEED change, present
 *      in no source artifact for this phase.
 *   2. The report itself routes (a) to `/gsd:sketch` — *"G-2 FIRES, HARD"* — and **D-244-18 rules
 *      that G-2 fires on exactly one surface in Phase 244** (sketch 236, the composer). A second
 *      sketch here would contradict a locked decision.
 * **Re-open trigger: the next phase that adds a thread-kind field to `GET /threads`, or the next
 * chat-list sketch.** The report stays `status: folded` — NOT `closed`.
 *
 * ⭐ C-7: THE REPORT IS PARTLY ALREADY BUILT, and this suite was written against the markup
 * rather than against the report. The row already renders a lead icon, a truncating title with a
 * full-title `title=` attribute and `HighlightTitle`, and a mode-switched meta chip. **What was
 * missing was a BOUND on the chip and the ABSENCE of the empty-state chip** — not the chip.
 *
 * ⚠ These assert RENDERED CONTENT and CLASS CONTRACTS, never block presence. A presence
 * assertion cannot see content drift (the Phase 235 finding: a green `data-testid` fence
 * coexisted with the shipped defect).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, cleanup } from "@testing-library/react"
import type { Thread, Folder } from "@/types"

const { streamingIds, stopThread } = vi.hoisted(() => ({
  streamingIds: new Set<string>(),
  stopThread: vi.fn(),
}))

vi.mock("@/providers/StreamsProvider", () => ({
  useStreamingThreadIds: () => streamingIds,
  useStreamActions: () => ({ stopThread }),
  getActiveRunStartMs: () => null,
}))

import { ChatHistoryColumn } from "../ChatHistoryColumn"

const NOW = Date.now()
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString()
const HOUR = 3_600_000

/** The report's own worst measured case: 134 px of chip against 85 px of title (17.5 %). */
const LONG_FOLDER_NAME = "Project Meridian — Risks"

/** And the report's own truncated title, so the fixture is the defect rather than a stand-in. */
const LONG_TITLE = "Quarterly Business Review — Northwind Logistics, Q3 variance and remediation plan"

const folders: Folder[] = [
  { id: "f-mer", user_id: "u", name: LONG_FOLDER_NAME, parent_id: null, is_org_shared: false, created_at: iso(0), updated_at: iso(0) },
]

const scoped: Thread = {
  id: "t-scoped",
  user_id: "u",
  title: LONG_TITLE,
  folder_id: "f-mer",
  created_at: iso(HOUR),
  updated_at: iso(HOUR),
}

const unfiled: Thread = {
  id: "t-unfiled",
  user_id: "u",
  title: "Old prototype brainstorm",
  folder_id: null,
  created_at: iso(2 * HOUR),
  updated_at: iso(2 * HOUR),
}

type ColProps = React.ComponentProps<typeof ChatHistoryColumn>

function renderColumn(threads: Thread[]) {
  const props: ColProps = {
    threads,
    selectedThread: null,
    onSelectThread: vi.fn(),
    onNewThread: vi.fn(),
    onDeleteThread: vi.fn().mockResolvedValue(undefined),
    onRenameThread: vi.fn().mockResolvedValue(undefined),
    folders,
  }
  return render(<ChatHistoryColumn {...props} />)
}

/** The meta chip is the element whose own text is the folder name. */
const folderChip = () => screen.getByText(LONG_FOLDER_NAME).closest("span")!

/** The title span carries the `title=` attribute; `HighlightTitle` renders inside it. */
const titleSpan = () => document.querySelector(`span[title="${LONG_TITLE}"]`) as HTMLElement

beforeEach(() => {
  streamingIds.clear()
  stopThread.mockClear()
})
afterEach(() => cleanup())

describe("BUG-260816-03 (c) · the title wins when space is short", () => {
  /**
   * The report's mechanism, quoted: *"The chip is `shrink-0`; the title is
   * `truncate flex-1 min-w-0`. The chip therefore wins unconditionally, and a folder name is
   * arbitrary, user-authored and unbounded."* ⚠ jsdom does no layout, so this pins the CLASS
   * CONTRACT that produces the bound — the pixels were measured in the report and are re-driven
   * as a G-4 row, never here.
   */
  it("the folder chip is BOUNDED — it carries a max-w-* cap and truncates", () => {
    renderColumn([scoped])
    const chip = folderChip()
    expect(chip.className, `the folder chip is unbounded: ${chip.className}`).toMatch(/\bmax-w-\[?[\w.%]+\]?/)
    expect(chip.className).toContain("truncate")
  })

  it("the full folder name is still reachable — the cap hides it, it does not delete it", () => {
    renderColumn([scoped])
    expect(folderChip()).toHaveAttribute("title", LONG_FOLDER_NAME)
  })

  it("the title keeps its flexible, shrinking budget and is never shrink-0", () => {
    renderColumn([scoped])
    const title = titleSpan()
    expect(title, "the title span was not found by its title= attribute").not.toBeNull()
    expect(title.className).toContain("truncate")
    expect(title.className).toContain("flex-1")
    expect(title.className).toContain("min-w-0")
    expect(title.className).not.toContain("shrink-0")
  })
})

describe("BUG-260816-03 (b) · an unscoped row renders NO chip", () => {
  /**
   * Measured in the report: **471 of 524 rows read "Unfiled"** — 90 %, on a word that
   * distinguishes nothing. The shipped project rule is `empty ⇒ render nothing`
   * (`ActiveConnectorChips.tsx:24`, `AttentionPopover.tsx:75`, `PendingAskCard.tsx:733` all
   * return `null` on empty), so this is an APPLICATION of an established pattern, not a new
   * design decision.
   *
   * ⚠ `folderLabel` itself is UNCHANGED — it is shared with `groupByFolder`, which still needs
   * the "Unfiled" group label in FOLDER mode. The absence decision belongs to this row, not to
   * the vocabulary leaf.
   */
  it("a thread with folder_id === null renders no chip at all in DATE mode", () => {
    renderColumn([unfiled])
    expect(screen.queryByText(/Unfiled/i)).toBeNull()
  })

  /**
   * ⛔ The negative alone would pass on a component that rendered nothing, so the positive is
   * load-bearing: a scoped row must STILL carry its chip, its folder name and its folder icon.
   */
  it("a thread WITH a folder still renders the chip, the folder name and the folder icon", () => {
    const { container } = renderColumn([scoped])
    const chip = folderChip()
    expect(chip).toHaveTextContent(LONG_FOLDER_NAME)
    expect(chip.querySelector("svg.lucide-folder")).not.toBeNull()
    // Non-vacuity: the row itself rendered.
    expect(container.querySelectorAll("button").length).toBeGreaterThan(0)
  })

  /**
   * FOLDER mode is untouched: there the trailing chip is the DATE BUCKET, and the "Unfiled"
   * GROUP HEADER is `groupByFolder`'s, not the row's. Pinned so the (b) change cannot be
   * mistaken for a vocabulary change.
   */
  it("FOLDER mode still groups an unscoped thread under an 'Unfiled' HEADER", () => {
    renderColumn([scoped, unfiled])
    fireEvent.click(screen.getByRole("button", { name: "folder" }))
    expect(screen.getByText("Unfiled")).toBeInTheDocument()
    // …and it is a header, not a row chip: the row now shows its date bucket instead.
    expect(screen.getAllByText("Today").length).toBeGreaterThan(0)
  })
})

describe("BUG-260816-03 · the shipped tooltip workaround must not regress", () => {
  /**
   * The report lists *"hover a row — the full title is in the `title` attribute"* as the live
   * workaround. Truncating the chip must not cost the title its full text.
   */
  it("the row still carries the complete title in its title= attribute", () => {
    renderColumn([scoped])
    expect(titleSpan()).toHaveAttribute("title", LONG_TITLE)
  })
})
