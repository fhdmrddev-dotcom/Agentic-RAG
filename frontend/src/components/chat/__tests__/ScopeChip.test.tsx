/**
 * Phase 268 plan 03 (CHAT-08 · D-268-12c / UI-SPEC §5.2) — the composer's scope chip, S1-S5.
 *
 * ⛔ CONTENT, NOT PRESENCE: the label, the `· not searched` suffix and the accessible name are
 * asserted as rendered words. ⛔ AT REST: the suffix is visible with no hover and no click — a
 * `title` never counts as the copy (266 UI-3).
 * ⛔ The chip never CLAIMS `not searched` without the server's payload (S5).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
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
  { id: "f-deep", name: "Signed and countersigned originals", parent_id: "f-q3" },
] as unknown as Folder[]

const line = (over: Partial<ScopeEffect["next"]> = {}): ScopeEffect["next"] => ({
  folders: [],
  thread_folder: null,
  all_documents: false,
  connections: [],
  ...over,
})
const acme = { id: "f-acme", name: "Client ACME", doc_count: 4, path: "Client ACME" }
const HR = { id: "e-hr", name: "HR Advisor", scope_mode: "restricted" as const }

const NORMAL: ScopeEffect = { held: false, expert: null, next: line({ thread_folder: acme }), stops: line(), saved: null }
const HELD: ScopeEffect = {
  held: true,
  expert: HR,
  next: line({ folders: [{ id: "f-hr", name: "HR Policies", doc_count: null }] }),
  stops: line(),
  saved: acme,
}

const HIDING = ["sr-only", "hidden", "invisible", "opacity-0"]
function expectVisibleAtRest(el: HTMLElement) {
  expect(el).toBeVisible()
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    for (const cls of HIDING) expect(n.classList.contains(cls), `<${n.tagName}> carries ${cls}`).toBe(false)
  }
}

function chip(props: Partial<Parameters<typeof ScopeChip>[0]> = {}) {
  return render(
    <ScopeChip
      threadId="t-1"
      folderId="f-acme"
      folders={FOLDERS}
      effect={NORMAL}
      streaming={false}
      onApply={vi.fn().mockResolvedValue(undefined)}
      {...props}
    />,
  )
}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
})

beforeEach(() => {
  vi.clearAllMocks()
  h.getScopeEffect.mockResolvedValue(NORMAL)
})

describe("ScopeChip — S1 normal", () => {
  it("(1) a real button: Folder glyph, the /path label, a chevron, indigo on both themes", () => {
    chip()
    const btn = screen.getByTestId("scope-chip")
    expect(btn.tagName).toBe("BUTTON")
    expect(btn).toHaveAttribute("type", "button")
    expectVisibleAtRest(within(btn).getByText("/Client ACME"))
    expect(btn).toHaveAccessibleName("Search scope: /Client ACME. Change folder")
    const cls = btn.className.split(/\s+/)
    for (const c of ["text-indigo-700", "dark:text-indigo-200", "border-indigo-600/40", "dark:border-indigo-500/40"]) {
      expect(cls).toContain(c)
    }
    expect(btn.querySelector(".lucide-folder")).not.toBeNull()
    expect(btn.querySelector(".lucide-chevron-down")).not.toBeNull()
    expect(within(btn).queryByText("· not searched")).toBeNull()
  })

  it("(2) no folder reads 'All your documents'", () => {
    chip({ folderId: null })
    expectVisibleAtRest(within(screen.getByTestId("scope-chip")).getByText("All your documents"))
  })

  it("(3) a path past 32 characters shows …/{last}; the accessible name keeps the full path", () => {
    chip({ folderId: "f-deep" })
    const btn = screen.getByTestId("scope-chip")
    expectVisibleAtRest(within(btn).getByText("…/Signed and countersigned originals"))
    expect(btn).toHaveAccessibleName(
      "Search scope: /Client ACME/Q3 Contracts/Signed and countersigned originals. Change folder",
    )
  })
})

describe("ScopeChip — S2 held (Save & say)", () => {
  it("(4) dashed and quiet, the label un-struck, `· not searched` VISIBLE at rest in amber on both themes", () => {
    chip({ effect: HELD })
    const btn = screen.getByTestId("scope-chip")
    const cls = btn.className.split(/\s+/)
    expect(cls).toContain("border-dashed")
    expect(cls).toContain("text-muted-foreground")
    expect(cls).not.toContain("text-indigo-700")
    const label = within(btn).getByText("/Client ACME")
    expect(label.className).not.toContain("line-through")
    const suffix = within(btn).getByText("· not searched")
    expectVisibleAtRest(suffix)
    expect(suffix.className.split(/\s+/)).toEqual(expect.arrayContaining(["text-amber-700", "dark:text-amber-300"]))
    expect(btn).toHaveAccessibleName(
      "Search scope: /Client ACME, not searched while HR Advisor is active. Change folder",
    )
  })
})

describe("ScopeChip — S4 / S5", () => {
  it("(5) S4: a folder the caller cannot see reads the shipped phrase with EyeOff", () => {
    chip({ folderId: "f-gone" })
    const btn = screen.getByTestId("scope-chip")
    expectVisibleAtRest(within(btn).getByText("a knowledge folder you cannot see"))
    expect(btn.querySelector(".lucide-eye-off")).not.toBeNull()
    expect(btn.querySelector(".lucide-folder")).toBeNull()
  })

  it("(6) S5: the payload has not loaded — S1 styling and NO `not searched` claim", () => {
    chip({ effect: null })
    const btn = screen.getByTestId("scope-chip")
    expect(btn.className.split(/\s+/)).toContain("text-indigo-700")
    expect(within(btn).queryByText("· not searched")).toBeNull()
    expect(btn).toHaveAccessibleName("Search scope: /Client ACME. Change folder")
  })
})

describe("ScopeChip — S3 in flight", () => {
  it("(7) while Apply is pending the chevron becomes a spinner and the chip is aria-busy", async () => {
    h.getScopeEffect.mockImplementation(async (_tid: string, draft?: { folderId: string | null }) =>
      draft ? { ...NORMAL, next: line({ thread_folder: { ...acme, id: "f-q3", name: "Q3 Contracts", path: "Client ACME/Q3 Contracts" } }), stops: line({ thread_folder: acme }) } : NORMAL,
    )
    let resolve!: () => void
    const onApply = vi.fn(() => new Promise<void>((r) => (resolve = r)))
    const user = userEvent.setup()
    chip({ onApply })
    await user.click(screen.getByTestId("scope-chip"))
    await user.click(await screen.findByTestId("scope-picker-node-f-q3"))
    await waitFor(() => expect(screen.getByTestId("scope-picker-apply")).not.toHaveAttribute("data-disabled"))
    await user.click(screen.getByTestId("scope-picker-apply"))
    const btn = screen.getByTestId("scope-chip")
    await waitFor(() => expect(btn).toHaveAttribute("aria-busy", "true"))
    expect(btn.querySelector(".lucide-loader-circle, .lucide-loader2")).not.toBeNull()
    resolve()
    await waitFor(() => expect(btn).not.toHaveAttribute("aria-busy"))
  })
})
