/**
 * Phase 268 plan 03 (CHAT-08 · D-268-12c / UI-SPEC §5.3, §8.4) — the picker states the effect of a
 * draft BEFORE Apply, from the server's payload, and never re-derives the Expert rule.
 *
 *   P1 loading · P2 a change · P2′ nothing changes · P3 held (Save & say) · P4 preview failed,
 *   latest-wins, Apply / Cancel as MENU ITEMS (Radix traps Tab), the refusal kept in the menu, and a
 *   `?raw` fence: no `scope_mode` token in ScopeChip.tsx / ScopePicker.tsx (comments stripped).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
// @ts-ignore — Vite `?raw` import.
import chipSrc from "../ScopeChip.tsx?raw"
// @ts-ignore — Vite `?raw` import.
import pickerSrc from "../ScopePicker.tsx?raw"
import { stripComments } from "@/lib/stripComments.testutil"
import type { Folder } from "@/types"
import type { ScopeEffect } from "@/lib/api/threads"

const h = vi.hoisted(() => ({ getScopeEffect: vi.fn() }))

vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, getScopeEffect: h.getScopeEffect }
})

import { ScopeChip } from "../ScopeChip"

const FOLDERS = [
  { id: "f-acme", name: "Client ACME", parent_id: null },
  { id: "f-q3", name: "Q3 Contracts", parent_id: "f-acme" },
  { id: "f-hr", name: "HR Policies", parent_id: null },
] as unknown as Folder[]

const line = (over: Partial<ScopeEffect["next"]> = {}): ScopeEffect["next"] => ({
  folders: [],
  thread_folder: null,
  all_documents: false,
  connections: [],
  ...over,
})
const acme = { id: "f-acme", name: "Client ACME", doc_count: 4, path: "Client ACME" }
const q3 = { id: "f-q3", name: "Q3 Contracts", doc_count: 2, path: "Client ACME/Q3 Contracts" }
const hr = { id: "f-hr", name: "HR Policies", doc_count: 1, path: "HR Policies" }
const FA = { id: "e-fa", name: "Financial Analyzer", scope_mode: "biased" as const }
const HR = { id: "e-hr", name: "HR Advisor", scope_mode: "restricted" as const }

const AT_REST: ScopeEffect = { held: false, expert: null, next: line({ thread_folder: acme }), stops: line(), saved: null }
const TO_Q3: ScopeEffect = { held: false, expert: null, next: line({ thread_folder: q3 }), stops: line({ thread_folder: acme }), saved: null }
const TO_HR: ScopeEffect = { held: false, expert: null, next: line({ thread_folder: hr }), stops: line({ thread_folder: acme }), saved: null }
const BIASED_TO_Q3: ScopeEffect = {
  held: false,
  expert: FA,
  next: line({ folders: [{ id: "f-fin", name: "Financial Reports", doc_count: null }], thread_folder: q3 }),
  stops: line({ thread_folder: acme }),
  saved: null,
}
const HELD_TO_Q3: ScopeEffect = {
  held: true,
  expert: HR,
  next: line({ folders: [{ id: "f-hrp", name: "HR Policies", doc_count: null }] }),
  stops: line(),
  saved: q3,
}

function mount(props: Partial<Parameters<typeof ScopeChip>[0]> = {}) {
  const onApply = props.onApply ?? vi.fn().mockResolvedValue(undefined)
  render(
    <ScopeChip
      threadId="t-1"
      folderId="f-acme"
      folders={FOLDERS}
      effect={AT_REST}
      streaming={false}
      {...props}
      onApply={onApply}
    />,
  )
  return onApply
}

async function open(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByTestId("scope-chip"))
  return screen.findByTestId("scope-picker")
}

function applyItem() {
  return screen.getByTestId("scope-picker-apply")
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
})

beforeEach(() => {
  vi.clearAllMocks()
  h.getScopeEffect.mockImplementation(async (_tid: string, draft?: { folderId: string | null }) => {
    if (!draft) return AT_REST
    if (draft.folderId === "f-q3") return TO_Q3
    if (draft.folderId === "f-hr") return TO_HR
    return AT_REST
  })
})

describe("the picker's frame", () => {
  it("(1) title, idle sub-line, the tree nested by parent and the `current` marker on the saved folder", async () => {
    const user = userEvent.setup()
    const picker = await open(user)
    expect(within(picker).getByText("Search in")).toBeVisible()
    expect(within(picker).getByText("Applies from your next message. Earlier answers keep their sources.")).toBeVisible()
    const all = within(picker).getByTestId("scope-picker-node-all")
    expect(all.textContent).toContain("All your documents")
    const saved = within(picker).getByTestId("scope-picker-node-f-acme")
    expect(saved.textContent).toContain("Client ACME")
    expect(within(saved).getByText("current")).toBeVisible()
    const child = within(picker).getByTestId("scope-picker-node-f-q3")
    // nested one level deeper than its parent (paddingLeft 8 + 16·depth)
    expect(parseInt(child.style.paddingLeft, 10)).toBeGreaterThan(parseInt(saved.style.paddingLeft, 10))
    expect(within(picker).queryByText(/docs$/)).toBeNull() // no per-node counts (§9-D4)
  })

  it("(2) while this thread streams the sub-line says the answer in progress keeps its scope", async () => {
    const user = userEvent.setup()
    mount({ streaming: true })
    const picker = await open(user)
    expect(
      within(picker).getByText("The answer in progress keeps its scope. This applies from your next message."),
    ).toBeVisible()
  })
})

describe("P1-P4", () => {
  it("(3) P2′ on open: draft = saved → the at-rest effect, 'Nothing changes', Apply disabled", async () => {
    const user = userEvent.setup()
    mount()
    const picker = await open(user)
    await waitFor(() => expect(within(picker).getByText("Nothing changes")).toBeVisible())
    expect(h.getScopeEffect).toHaveBeenCalledWith("t-1")
    const ledger = within(picker).getByTestId("scope-picker-ledger")
    expect(within(ledger).getByText("Next message searches")).toBeVisible()
    expect(within(ledger).getByText("/Client ACME (4)")).toBeVisible()
    expect(applyItem()).toHaveAttribute("data-disabled")
  })

  it("(4) P1: a pending preview shows the loading row (role status) and Apply stays disabled", async () => {
    h.getScopeEffect.mockImplementation(() => new Promise(() => {}))
    const user = userEvent.setup()
    mount()
    const picker = await open(user)
    const status = within(picker).getByRole("status")
    expect(status.textContent).toContain("Checking what your next message will search…")
    expect(applyItem()).toHaveAttribute("data-disabled")
  })

  it("(5) P2: picking a folder previews THAT draft — Next / Stops from the payload, Apply enabled", async () => {
    const user = userEvent.setup()
    mount()
    const picker = await open(user)
    await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
    expect(h.getScopeEffect).toHaveBeenLastCalledWith("t-1", { folderId: "f-q3" })
    const ledger = await within(picker).findByTestId("scope-picker-ledger")
    await waitFor(() => expect(within(ledger).getByText("/Client ACME/Q3 Contracts (2)")).toBeVisible())
    expect(within(ledger).getByText("Stops searching")).toBeVisible()
    expect(within(ledger).getByText("/Client ACME (4)")).toBeVisible()
    expect(within(ledger).getByText("Chat attachments")).toBeVisible()
    expect(applyItem()).not.toHaveAttribute("data-disabled")
    // the draft carries the Check, and stays open (onSelect prevented)
    expect(within(picker).getByTestId("scope-picker-node-f-q3").querySelector(".lucide-check")).not.toBeNull()
  })

  it("(6) P2 under a Biased Expert: its folder is tagged `Expert` and the Biased explain box is shown", async () => {
    h.getScopeEffect.mockImplementation(async (_t: string, d?: { folderId: string | null }) =>
      d ? BIASED_TO_Q3 : { ...AT_REST, expert: FA },
    )
    const user = userEvent.setup()
    mount()
    const picker = await open(user)
    await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
    await waitFor(() => expect(within(picker).getByText("Financial Reports")).toBeVisible())
    const row = within(picker).getByText("Financial Reports").closest("li") as HTMLElement
    expect(within(row).getByText("Expert")).toBeVisible()
    expect(
      within(picker).getByText("Financial Analyzer is Biased, so it adds its own folder to whatever you pick here."),
    ).toBeVisible()
  })

  it("(7) P3 held: Saved / Searching and the held box — Apply ENABLED (nothing is blocked)", async () => {
    h.getScopeEffect.mockImplementation(async (_t: string, d?: { folderId: string | null }) =>
      d ? HELD_TO_Q3 : { ...AT_REST, held: true, expert: HR, saved: acme, next: HELD_TO_Q3.next },
    )
    const user = userEvent.setup()
    mount()
    const picker = await open(user)
    await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
    const ledger = await within(picker).findByTestId("scope-picker-ledger")
    await waitFor(() => expect(within(ledger).getByText("Saved")).toBeVisible())
    expect(within(ledger).getByText("Searching")).toBeVisible()
    expect(within(ledger).getByText("/Client ACME/Q3 Contracts")).toBeVisible()
    expect(within(ledger).getByText("HR Policies")).toBeVisible()
    expect(within(picker).getByText("No effect while HR Advisor is active.")).toBeVisible()
    expect(
      within(picker).getByText(
        /Restricted reads HR Policies only\. \/Client ACME\/Q3 Contracts is saved and is searched once HR Advisor leaves\./,
      ),
    ).toBeVisible()
    expect(applyItem()).not.toHaveAttribute("data-disabled")
  })

  it("(8) P4: a failed preview is an alert with Try again, Apply disabled; Try again re-requests the draft", async () => {
    h.getScopeEffect.mockImplementation(async (_t: string, d?: { folderId: string | null }) => {
      if (d) throw new Error("boom")
      return AT_REST
    })
    const user = userEvent.setup()
    mount()
    const picker = await open(user)
    await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
    const err = await within(picker).findByTestId("scope-picker-error")
    expect(err).toHaveAttribute("role", "alert")
    expect(err.textContent).toContain("Couldn't check what your next message will search.")
    expect(applyItem()).toHaveAttribute("data-disabled")
    const calls = h.getScopeEffect.mock.calls.length
    h.getScopeEffect.mockImplementation(async () => TO_Q3)
    await user.click(within(picker).getByRole("menuitem", { name: "Try again" }))
    await waitFor(() => expect(h.getScopeEffect.mock.calls.length).toBe(calls + 1))
    expect(h.getScopeEffect).toHaveBeenLastCalledWith("t-1", { folderId: "f-q3" })
    await waitFor(() => expect(applyItem()).not.toHaveAttribute("data-disabled"))
  })

  it("(9) latest wins: a slow answer for an earlier draft never overwrites the later one", async () => {
    const pending: Record<string, (e: ScopeEffect) => void> = {}
    h.getScopeEffect.mockImplementation((_t: string, d?: { folderId: string | null }) =>
      d ? new Promise<ScopeEffect>((r) => (pending[d.folderId ?? "all"] = r)) : Promise.resolve(AT_REST),
    )
    const user = userEvent.setup()
    mount()
    const picker = await open(user)
    await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
    await user.click(within(picker).getByTestId("scope-picker-node-f-hr"))
    pending["f-hr"](TO_HR)
    await waitFor(() => expect(within(picker).getByText("/HR Policies (1)")).toBeVisible())
    pending["f-q3"](TO_Q3)
    await new Promise((r) => setTimeout(r, 20))
    expect(within(picker).queryByText("/Client ACME/Q3 Contracts (2)")).toBeNull()
    expect(within(picker).getByText("/HR Policies (1)")).toBeVisible()
  })
})

describe("Apply / Cancel — menu items, the one PATCH home decides", () => {
  it("(10) Apply and Cancel are menu items; tree nodes are radio items; End reaches Apply by keyboard", async () => {
    const user = userEvent.setup()
    mount()
    const picker = await open(user)
    expect(within(picker).getAllByRole("menuitemradio").length).toBe(4)
    expect(within(picker).getByRole("menuitem", { name: "Cancel" })).toBeInTheDocument()
    expect(within(picker).getByRole("menuitem", { name: "Apply" })).toBeInTheDocument()
    await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
    await waitFor(() => expect(applyItem()).not.toHaveAttribute("data-disabled"))
    await user.keyboard("{End}")
    expect(document.activeElement).toBe(applyItem())
  })

  it("(11) Apply sends the draft to the one PATCH home, shows Applying…, then closes", async () => {
    let resolve!: () => void
    const onApply = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const user = userEvent.setup()
    mount({ onApply })
    const picker = await open(user)
    await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
    await waitFor(() => expect(applyItem()).not.toHaveAttribute("data-disabled"))
    await user.click(applyItem())
    expect(onApply).toHaveBeenCalledWith("f-q3")
    await waitFor(() => expect(applyItem().textContent).toContain("Applying…"))
    expect(applyItem()).toHaveAttribute("aria-busy", "true")
    resolve()
    await waitFor(() => expect(screen.queryByTestId("scope-picker")).toBeNull())
  })

  it("(12) All your documents applies null", async () => {
    const onApply = mount()
    const user = userEvent.setup()
    const picker = await open(user)
    await user.click(within(picker).getByTestId("scope-picker-node-all"))
    await waitFor(() => expect(applyItem()).not.toHaveAttribute("data-disabled"))
    await user.click(applyItem())
    expect(onApply).toHaveBeenCalledWith(null)
  })

  it("(13) a refusal keeps the menu open with the server's reason and what is still searched", async () => {
    const onApply = vi.fn().mockRejectedValue(new Error("Folder not found"))
    const user = userEvent.setup()
    mount({ onApply })
    const picker = await open(user)
    await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
    await waitFor(() => expect(applyItem()).not.toHaveAttribute("data-disabled"))
    await user.click(applyItem())
    const refusal = await screen.findByTestId("scope-refusal")
    expect(refusal).toHaveAttribute("role", "alert")
    expect(refusal.textContent).toBe(
      "Couldn't change the folder. Folder not found This chat still searches /Client ACME.",
    )
    expect(screen.getByTestId("scope-picker")).toBeInTheDocument()
    expect(applyItem()).not.toHaveAttribute("data-disabled")
  })

  it("(14) Cancel discards the draft and sends nothing", async () => {
    const onApply = mount()
    const user = userEvent.setup()
    const picker = await open(user)
    await user.click(within(picker).getByTestId("scope-picker-node-f-q3"))
    await user.click(within(picker).getByRole("menuitem", { name: "Cancel" }))
    await waitFor(() => expect(screen.queryByTestId("scope-picker")).toBeNull())
    expect(onApply).not.toHaveBeenCalled()
  })
})

describe("the one-payload fence (D-268-12c)", () => {
  it("(15) neither leaf contains a `scope_mode` token (comments stripped)", () => {
    for (const [name, src] of [["ScopeChip.tsx", chipSrc], ["ScopePicker.tsx", pickerSrc]] as const) {
      expect((src as string).length, name).toBeGreaterThan(1000)
      expect(stripComments(src as string), name).not.toMatch(/scope_mode/)
    }
  })
})
