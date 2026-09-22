/**
 * Phase 262 plan 04 (PACK-12) — the criterion proven the way the ROADMAP demands it be proven.
 *
 * ⛔ EVERY CLAIM IS ASSERTED OVER RENDERED TEXT. Not one query in this file reaches for a test
 * hook — and the two query identifiers the acceptance grep proves absent are named in
 * `262-04-SUMMARY.md` rather than here, because spelling them in this comment would satisfy the
 * very grep that proves them unused (the trap plans 02 and 03 each recorded, one wave apart).
 * D-262-05 is explicit, the ROADMAP criterion is verbatim *"the rendered content is asserted,
 * never the presence of a block"*, and this repository's own recorded finding is that presence
 * assertions cannot see content drift. `262-RECORD.md` sharpens it: here the content was never
 * rendered at all, so a presence assertion would have passed over the defect for two whole
 * phases while `example_output` reached nobody.
 *
 * ⛔ THE UNRESOLVABLE-FOLDER CASE IS THE ONE THAT COSTS SOMETHING, so it was driven FIRST against
 * a modal that rendered only the names it could resolve — the convenient implementation, and the
 * one a reviewer would have called correct. Its RED is quoted in `262-04-SUMMARY.md`. A modal that
 * silently shortens the list of an Expert's knowledge would be wrong on the ONE system Expert every
 * tenant has (migration 188 seeds its folder into a single org), and nothing on screen would say so.
 *
 * ⚠ THE ALL-ABSENT CASE CARRIES A `not.toContain("undefined")` ARM over the whole rendered text.
 * The literal string reaching the DOM is the specific way an optional field fails in this codebase,
 * and all four presentation columns are optional on `ExpertBundle`.
 */

import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ExpertDetailModal, HONEST, UNNAMEABLE_FOLDER } from "../ExpertDetailModal"
import type { ExpertBundle, Folder } from "@/types"

function bundle(over: Partial<ExpertBundle> & { name: string; slug: string }): ExpertBundle {
  return {
    id: over.slug,
    description: "Reads filings and answers in numbers",
    scope_mode: "biased",
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: [],
    prompt_suggestions: [],
    visibility: "granted",
    is_system: false,
    is_enabled: true,
    ...over,
  }
}

function folder(id: string, name: string): Folder {
  // Only `id` and `name` are read; the rest satisfies the shipped row shape.
  return { id, name } as Folder
}

// ── the distinctive strings every content claim is made against ──────────────────────────
const WHEN_TO_USE =
  "Summon me when a quarterly filing disagrees with the earnings call and someone has to say which one is wrong."
const SAMPLE_OUTPUT = [
  "| Metric | Q2 | Q3 | Delta |",
  "| Gross margin | 61.4% | 58.9% | -2.5pp |",
  "Footnote: the delta is driven by a one-off inventory writedown.",
].join("\n")
const KNOWN_FOLDER_NAME = "SEC 10-K Filings 2025"

const FULL = bundle({
  name: "Filing Reconciler",
  slug: "filing-reconciler",
  category: "Finance & Accounting",
  when_to_use: WHEN_TO_USE,
  example_output: SAMPLE_OUTPUT,
  knowledge_folder_ids: ["known-id", "invisible-id"],
  member_skills: ["ratio_calculator"],
  required_connections: ["Edgar MCP"],
  prompt_suggestions: [
    { title: "Reconcile Q3", prompt: "Compare the Q3 10-Q against the Q3 earnings call transcript." },
    { title: "Margin bridge", prompt: "Build a gross-margin bridge from Q2 to Q3 and name each driver." },
  ],
})

const VISIBLE_FOLDERS = [folder("known-id", KNOWN_FOLDER_NAME)]

function mount(expert: ExpertBundle, folders: Folder[] = VISIBLE_FOLDERS) {
  const onStartChat = vi.fn()
  const onOpenChange = vi.fn()
  render(
    <ExpertDetailModal
      expert={expert}
      folders={folders}
      open
      onOpenChange={onOpenChange}
      onStartChat={onStartChat}
    />,
  )
  return { onStartChat, onOpenChange }
}

/** Radix renders through a portal, so the rendered text lives on the document, not the container. */
const rendered = () => document.body.textContent ?? ""

beforeEach(() => {
  // The four Radix jsdom shims (`ForkNameDialog.test.tsx:100-103`).
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("ExpertDetailModal — PACK-12's content, asserted as content", () => {
  it("(1) when_to_use renders VERBATIM — the sentence the author wrote, not a summary of it", () => {
    mount(FULL)
    expect(screen.getByText(WHEN_TO_USE)).toBeTruthy()
    // And the honest stand-in is NOT shown when the author did write one.
    expect(screen.queryByText(HONEST.whenToUse)).toBeNull()
  })

  it("(2) example_output is ABSENT before the disclosure and PRESENT after it", async () => {
    const user = userEvent.setup()
    mount(FULL)

    // ⛔ The absence is the load-bearing half: the native HTML disclosure element keeps its
    // content in the DOM while closed, which would let this very assertion pass against text
    // nobody can see. React state is what makes "hidden" mean "not rendered".
    expect(rendered()).not.toContain(SAMPLE_OUTPUT)
    expect(rendered()).not.toContain("one-off inventory writedown")

    await user.click(screen.getByRole("button", { name: /show sample deliverable/i }))

    // ⛔ The EXACT multi-line string the author wrote, read off the document rather than through
    // a whitespace-collapsing text matcher — a normalizer would let a reflowed sample pass.
    expect(rendered()).toContain(SAMPLE_OUTPUT)
    expect(rendered()).toContain("one-off inventory writedown")
  })

  it("(3) THE RED — a folder the caller cannot see is NAMED as such, never dropped, never blank", () => {
    mount(FULL)

    // The one it can name.
    expect(screen.getByText(KNOWN_FOLDER_NAME)).toBeTruthy()
    // The one it cannot — and the wording is the deliverable, so the literal is pinned here.
    expect(UNNAMEABLE_FOLDER).toBe("a knowledge folder you cannot see")
    expect(screen.getByText(UNNAMEABLE_FOLDER)).toBeTruthy()

    // BOTH bound folders are accounted for: the list did not silently shorten, and it did not
    // collapse into the "binds none" sentence either. "Unknown" is not "none".
    expect(screen.queryByText(HONEST.noFolders)).toBeNull()
    expect(rendered()).not.toContain("invisible-id")
  })

  it("(4) bound skills and required connections render by NAME — never as a count", () => {
    mount(FULL)
    expect(screen.getByText("ratio_calculator")).toBeTruthy()
    expect(screen.getByText("Edgar MCP")).toBeTruthy()
    // The admin tab's envelope line is the anti-pattern this requirement replaces.
    expect(rendered()).not.toMatch(/\b1 skills?\b/)
    expect(rendered()).not.toMatch(/\b1 conns?\b/)
  })

  it("(5) every example prompt renders its title AND the prompt it would run", () => {
    mount(FULL)
    for (const p of FULL.prompt_suggestions) {
      expect(screen.getByText(p.title)).toBeTruthy()
      expect(screen.getByText(p.prompt)).toBeTruthy()
    }
  })

  it("(6) when when_to_use and example_output are BOTH absent, each section says so — and the DOM never reads 'undefined'", () => {
    const bare = bundle({ name: "Bare Expert", slug: "bare-expert" })
    mount(bare)

    expect(screen.getByText(HONEST.whenToUse)).toBeTruthy()
    expect(screen.getByText(HONEST.exampleOutput)).toBeTruthy()
    // No disclosure exists for a sample that does not exist — a control that cannot act is the
    // dead affordance D-262-02 refuses a whole requirement over.
    expect(screen.queryByRole("button", { name: /sample deliverable/i })).toBeNull()

    // ⛔ THE ARM THAT CATCHES HOW AN OPTIONAL FIELD ACTUALLY FAILS HERE.
    expect(rendered()).not.toContain("undefined")
  })

  it("(7) the footer's primary control hands the expert off exactly once, and the view closes", async () => {
    const user = userEvent.setup()
    const { onStartChat, onOpenChange } = mount(FULL)

    await user.click(screen.getByRole("button", { name: /start scoped chat with expert/i }))

    expect(onStartChat).toHaveBeenCalledTimes(1)
    expect(onStartChat).toHaveBeenCalledWith(FULL)
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("(8) the footer carries TWO controls — the deferred third is not rendered in any form", () => {
    mount(FULL)
    // Named in `262-04-SUMMARY.md`, not spelled here: the acceptance grep that proves the source
    // free of it would be satisfied by a comment quoting it. Asserted by its verb and by the
    // absence of any control that cannot act.
    expect(rendered().toLowerCase()).not.toContain("customise")
    expect(screen.queryAllByRole("button").filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(0)
  })
})
