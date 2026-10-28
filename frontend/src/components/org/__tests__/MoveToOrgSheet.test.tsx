/**
 * Phase 298-05 (ORG-06 / D-21 / D-33 / UI-D16..UI-D19) — the "Move to <Org>?" sheet.
 *
 * A victim-naming bottom sheet that is NOT red: it reads the server's preview BEFORE any Move
 * button exists, names what moves from the server's counts, shows every refusal in the server's
 * own words (one amber box, only Close), keeps itself open with Try again on a failure, cannot be
 * dismissed while moving, and records the move (`noteMoved`) once, on the 200 — never earlier.
 *
 * Asserted by the RENDERED WORDS (the words are the deliverable), plus the one store effect.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const client = vi.hoisted(() => ({
  getMovePreview: vi.fn(),
  moveOrgItem: vi.fn(),
  getElsewhereCounts: vi.fn(),
}))
vi.mock("@/lib/api/orgItems", () => client)

import { MoveToOrgSheet } from "../MoveToOrgSheet"
import { ApiRefusal } from "@/lib/api/refusal"
import { useOrgItemsStore } from "@/lib/elsewhereCounts"
import type { MovePreview } from "@/lib/api/orgItems"

const ACME = { org_id: "B", name: "Acme Legal", role: "member" }
const BETA = { org_id: "C", name: "Beta Co", role: "member" }
const ZETA = { org_id: "D", name: "Zeta Group", role: "member" }

function preview(over: Partial<MovePreview> = {}, counts: Partial<MovePreview["counts"]> = {}): MovePreview {
  return {
    kind: "folder",
    item_id: "f1",
    item_name: "Q3 Contracts",
    from_org: { id: "A", name: "Personal" },
    to_org: { id: "B", name: "Acme Legal" },
    counts: { subfolders: 2, documents: 14, earlier_versions: 0, past_runs: 0, ...counts },
    refusals: [],
    ...over,
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

type SheetProps = React.ComponentProps<typeof MoveToOrgSheet>
function renderSheet(over: Partial<SheetProps> = {}) {
  const onOpenChange = vi.fn()
  const props: SheetProps = {
    kind: "folder",
    itemId: "f1",
    itemName: "Q3 Contracts",
    targets: [ACME],
    open: true,
    onOpenChange,
    ...over,
  }
  const utils = render(<MoveToOrgSheet {...props} />)
  return { ...utils, onOpenChange, props }
}

const moveButton = () => screen.queryByRole("button", { name: "Move to Acme Legal" })

beforeEach(() => {
  client.getMovePreview.mockReset()
  client.moveOrgItem.mockReset()
})

describe("MoveToOrgSheet — the preview comes first (UI-D16)", () => {
  it("checking: says so, shows NO count and NO Move button; Keep it here is focused", async () => {
    client.getMovePreview.mockReturnValue(new Promise(() => {}))
    renderSheet()
    expect(screen.getByText("Move to Acme Legal?")).toBeInTheDocument()
    expect(screen.getByRole("status")).toHaveTextContent("Checking what this will move…")
    expect(moveButton()).toBeNull()
    expect(screen.queryByText(/document/)).toBeNull()
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep it here" })).toHaveFocus())
    expect(client.getMovePreview).toHaveBeenCalledWith("folder", "f1", "B")
  })

  it("clean: names the item, says what moves and what changes, then offers the move", async () => {
    client.getMovePreview.mockResolvedValue(preview())
    renderSheet()
    expect(await screen.findByText("This folder, 2 subfolders and 14 documents move to Acme Legal.")).toBeInTheDocument()
    expect(screen.getByText("Move to Acme Legal?")).toBeInTheDocument()
    expect(screen.getByText("Moves to Acme Legal")).toBeInTheDocument()
    expect(screen.getByText("Q3 Contracts")).toBeInTheDocument()
    expect(screen.getByText("What changes")).toBeInTheDocument()
    expect(
      screen.getByText("It leaves Personal. Switch to Acme Legal to find it there. You can move it back the same way."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Keep it here" })).toBeInTheDocument()
    expect(moveButton()?.className).toContain("bg-primary")
    expect(screen.getByText("✎ Recorded with your name in the audit log.")).toBeInTheDocument()
  })

  it.each([
    ["folder", "Q3 Contracts", { subfolders: 0, documents: 14 }, "This folder and 14 documents move to Acme Legal."],
    ["folder", "Q3 Contracts", { subfolders: 2, documents: 0 }, "This folder and 2 subfolders move to Acme Legal."],
    ["folder", "Q3 Contracts", { subfolders: 0, documents: 0 }, "This folder moves to Acme Legal."],
    ["folder", "Q3 Contracts", { subfolders: 1, documents: 1 }, "This folder, 1 subfolder and 1 document move to Acme Legal."],
    ["document", "MSA.pdf", { subfolders: 0, documents: 1, earlier_versions: 2 }, "“MSA.pdf” and its 2 earlier versions move to Acme Legal."],
    ["document", "MSA.pdf", { subfolders: 0, documents: 1, earlier_versions: 1 }, "“MSA.pdf” and its 1 earlier version move to Acme Legal."],
    ["document", "MSA.pdf", { subfolders: 0, documents: 1, earlier_versions: 0 }, "“MSA.pdf” moves to Acme Legal."],
    ["draft", "Contract review", { subfolders: 0, documents: 0, past_runs: 0 }, "This draft moves to Acme Legal."],
  ] as const)("%s %s %j reads %s", async (kind, name, counts, words) => {
    client.getMovePreview.mockResolvedValue(preview({ kind, item_name: name }, counts))
    renderSheet({ kind, itemName: name })
    expect(await screen.findByText(words)).toBeInTheDocument()
    expect(screen.queryByText(/earlier runs? stay/)).toBeNull()
  })

  it("a draft with past runs says they stay where they ran (plural and singular)", async () => {
    client.getMovePreview.mockResolvedValue(preview({ kind: "draft", item_name: "Contract review" }, { past_runs: 3 }))
    const { unmount } = renderSheet({ kind: "draft", itemName: "Contract review" })
    expect(await screen.findByText("Its 3 earlier runs stay in Personal.")).toBeInTheDocument()
    unmount()
    client.getMovePreview.mockResolvedValue(preview({ kind: "draft", item_name: "Contract review" }, { past_runs: 1 }))
    renderSheet({ kind: "draft", itemName: "Contract review" })
    expect(await screen.findByText("Its 1 earlier run stays in Personal.")).toBeInTheDocument()
  })
})

describe("MoveToOrgSheet — refusals are the server's words (D-33)", () => {
  it("a refused preview lists EVERY reason verbatim in one amber alert, with only Close", async () => {
    const reasons = [
      "“Q3 Contracts” is shared with everyone in Personal. Make it private first, then move it.",
      "2 chats in Personal use “Q3 Contracts”. Moving it would cut them off from it.",
    ]
    client.getMovePreview.mockResolvedValue(preview({ refusals: reasons }))
    renderSheet()
    expect(await screen.findByText("This can't move to Acme Legal yet")).toBeInTheDocument()
    const alert = screen.getByRole("alert")
    for (const r of reasons) expect(within(alert).getByText(r)).toBeInTheDocument()
    expect(alert.className).toContain("border-warning/30")
    expect(alert.className).toContain("bg-warning/10")
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Keep it here" })).toBeNull()
    expect(moveButton()).toBeNull()
    expect(screen.queryByText("What changes")).toBeNull()
    expect(screen.queryByText(/move to Acme Legal\./)).toBeNull()
  })

  it("a 403 from the preview (not a member) is the refused state with that sentence", async () => {
    client.getMovePreview.mockRejectedValue(new ApiRefusal(403, "", "You're not a member of Acme Legal."))
    renderSheet()
    expect(await screen.findByText("You're not a member of Acme Legal.")).toBeInTheDocument()
    expect(screen.getByText("This can't move to Acme Legal yet")).toBeInTheDocument()
    expect(moveButton()).toBeNull()
  })

  it("server text renders as TEXT, never as markup", async () => {
    client.getMovePreview.mockResolvedValue(preview({ refusals: ["<b>bold</b> & co"] }))
    renderSheet()
    expect(await screen.findByText("<b>bold</b> & co")).toBeInTheDocument()
    expect(document.querySelector("b")).toBeNull()
  })

  it("a failed preview (network / 5xx) says so with Try again, and offers no Move", async () => {
    client.getMovePreview.mockRejectedValueOnce(new TypeError("Failed to fetch"))
    renderSheet()
    expect(await screen.findByText("Couldn't check what this would move.")).toBeInTheDocument()
    expect(screen.getByRole("alert")).toHaveTextContent("Couldn't check what this would move.")
    expect(moveButton()).toBeNull()
    client.getMovePreview.mockRejectedValueOnce(new ApiRefusal(503, "", "Couldn't check what this would move."))
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await waitFor(() => expect(client.getMovePreview).toHaveBeenCalledTimes(2))
    expect(await screen.findByRole("button", { name: "Try again" })).toBeInTheDocument()
    expect(moveButton()).toBeNull()
    client.getMovePreview.mockResolvedValueOnce(preview())
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("button", { name: "Move to Acme Legal" })).toBeInTheDocument()
  })
})

describe("MoveToOrgSheet — the move itself (UI-D17 / UI-D19)", () => {
  it("Moving… cannot be dismissed; Moved records the move ONCE, on the 200", async () => {
    client.getMovePreview.mockResolvedValue(preview())
    const moving = deferred<MovePreview>()
    client.moveOrgItem.mockReturnValue(moving.promise)
    const { onOpenChange } = renderSheet({ holdsSelection: true })
    fireEvent.click(await screen.findByRole("button", { name: "Move to Acme Legal" }))
    expect(client.moveOrgItem).toHaveBeenCalledWith("folder", "f1", "B")
    expect(screen.getByRole("status")).toHaveTextContent("Moving…")
    expect(moveButton()).toBeNull()
    fireEvent.keyDown(document.activeElement ?? document.body, { key: "Escape" })
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }))
    expect(onOpenChange).not.toHaveBeenCalledWith(false)
    // Nothing is recorded (and nothing leaves a list) before the server answers.
    expect(useOrgItemsStore.getState().version).toBe(0)
    await act(async () => moving.resolve(preview()))
    expect(screen.getByRole("status")).toHaveTextContent("Moved to Acme Legal · recorded")
    expect(useOrgItemsStore.getState().version).toBe(1)
    expect(useOrgItemsStore.getState().lastMoved).toEqual({ kind: "folder", id: "f1", holdsSelection: true, seq: 1 })
  })

  it("after Moved, closing the sheet calls onMovedClose (the caller may now drop its view)", async () => {
    client.getMovePreview.mockResolvedValue(preview({ kind: "document", item_name: "MSA.pdf" }, { earlier_versions: 0 }))
    client.moveOrgItem.mockResolvedValue(preview({ kind: "document" }))
    const onMovedClose = vi.fn()
    const { onOpenChange } = renderSheet({ kind: "document", itemName: "MSA.pdf", onMovedClose })
    fireEvent.click(await screen.findByRole("button", { name: "Move to Acme Legal" }))
    expect(await screen.findByText("Moved to Acme Legal · recorded")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: "Close" }))
    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(onMovedClose).toHaveBeenCalledTimes(1)
  })

  it("a 409 at confirm (a new blocker) is the refused state with the server sentence; nothing recorded", async () => {
    client.getMovePreview.mockResolvedValue(preview())
    client.moveOrgItem.mockRejectedValue(
      new ApiRefusal(409, "", "“Q3 Contracts” is under a legal hold, so it stays in Personal until the hold is released."),
    )
    renderSheet()
    fireEvent.click(await screen.findByRole("button", { name: "Move to Acme Legal" }))
    expect(
      await screen.findByText("“Q3 Contracts” is under a legal hold, so it stays in Personal until the hold is released."),
    ).toBeInTheDocument()
    expect(screen.getByText("This can't move to Acme Legal yet")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument()
    expect(moveButton()).toBeNull()
    expect(useOrgItemsStore.getState().version).toBe(0)
  })

  it("a 403 at confirm (membership lost) is refused with the server sentence", async () => {
    client.getMovePreview.mockResolvedValue(preview())
    client.moveOrgItem.mockRejectedValue(new ApiRefusal(403, "", "You're no longer a member of Acme Legal."))
    renderSheet()
    fireEvent.click(await screen.findByRole("button", { name: "Move to Acme Legal" }))
    expect(await screen.findByText("You're no longer a member of Acme Legal.")).toBeInTheDocument()
    expect(moveButton()).toBeNull()
  })

  it("a network / 5xx failure at confirm keeps the sheet open: 'Nothing was changed.' + Try again", async () => {
    client.getMovePreview.mockResolvedValue(preview())
    client.moveOrgItem.mockRejectedValueOnce(new ApiRefusal(500, "", "Couldn't move it. Nothing was changed."))
    const { onOpenChange } = renderSheet()
    fireEvent.click(await screen.findByRole("button", { name: "Move to Acme Legal" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't move it. Nothing was changed.")
    expect(screen.getByRole("button", { name: "Keep it here" })).toBeInTheDocument()
    expect(onOpenChange).not.toHaveBeenCalled()
    client.moveOrgItem.mockResolvedValueOnce(preview())
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByText("Moved to Acme Legal · recorded")).toBeInTheDocument()
    expect(client.moveOrgItem).toHaveBeenCalledTimes(2)
  })
})

describe("MoveToOrgSheet — 4+ orgs pick a target first", () => {
  it("opens on a radio list; Continue is disabled until one is picked; the preview is for that org", async () => {
    client.getMovePreview.mockReturnValue(new Promise(() => {}))
    renderSheet({ targets: [ACME, BETA, ZETA] })
    expect(screen.getByText("Move to another organization?")).toBeInTheDocument()
    const group = screen.getByRole("radiogroup")
    expect(within(group).getAllByRole("radio").map((r) => r.getAttribute("aria-label") ?? r.closest("label")?.textContent)).toEqual([
      "Acme Legal",
      "Beta Co",
      "Zeta Group",
    ])
    const go = screen.getByRole("button", { name: "Continue" })
    expect(go).toBeDisabled()
    expect(client.getMovePreview).not.toHaveBeenCalled()
    await userEvent.setup().click(within(group).getByLabelText("Beta Co"))
    expect(go).toBeEnabled()
    fireEvent.click(go)
    expect(client.getMovePreview).toHaveBeenCalledWith("folder", "f1", "C")
    expect(await screen.findByText("Move to Beta Co?")).toBeInTheDocument()
  })
})

describe("MoveToOrgSheet — a move is not destructive (UI-D2)", () => {
  it("no state paints red", async () => {
    const seen: string[] = []
    const snap = () => seen.push(document.body.innerHTML)
    // checking
    client.getMovePreview.mockReturnValueOnce(new Promise(() => {}))
    const a = renderSheet()
    snap()
    a.unmount()
    // preview failed
    client.getMovePreview.mockRejectedValueOnce(new TypeError("offline"))
    const b = renderSheet()
    await screen.findByText("Couldn't check what this would move.")
    snap()
    b.unmount()
    // refused
    client.getMovePreview.mockResolvedValueOnce(preview({ refusals: ["“Q3 Contracts” is already in Acme Legal."] }))
    const c = renderSheet()
    await screen.findByText("“Q3 Contracts” is already in Acme Legal.")
    snap()
    c.unmount()
    // clean → failed at confirm → moved
    client.getMovePreview.mockResolvedValueOnce(preview())
    client.moveOrgItem.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(preview())
    renderSheet()
    fireEvent.click(await screen.findByRole("button", { name: "Move to Acme Legal" }))
    snap()
    await screen.findByText("Couldn't move it. Nothing was changed.")
    snap()
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await screen.findByText("Moved to Acme Legal · recorded")
    snap()
    for (const html of seen) {
      expect(html).not.toMatch(/text-destructive|bg-destructive|border-destructive/)
    }
    expect(seen).toHaveLength(6)
  })
})
