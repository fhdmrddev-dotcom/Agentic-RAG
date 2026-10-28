/**
 * Phase 299-04 (D-20 / D-21 / D-39 / UI-D12..UI-D15) — the link surface.
 *
 * Asserted by the RENDERED WORDS, because the words are the deliverable: the trigger says "Link"
 * (never "Share" — a link grants nothing), the surface shows the rebuilt address, ONE "Copy link"
 * item and the who-can-open line, and the receipt is inside the surface (no toast). A refused copy
 * selects the address and names the shortcut, and never shows the success word.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

const clip = vi.hoisted(() => ({
  copyText: vi.fn(),
  selectAllIn: vi.fn(),
  copyShortcutWord: vi.fn(() => "Press Ctrl+C to copy"),
}))
vi.mock("@/lib/clipboard", () => clip)

const org = vi.hoisted(() => ({
  value: null as null | { activeOrgId: string | null; orgs: { org_id: string; name: string; role: string }[] },
}))
vi.mock("@/providers/OrgProvider", () => ({ useOrgOptional: () => org.value }))

import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ShareLinkMenu, ShareLinkMenuSub } from "../ShareLinkMenu"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import source from "../ShareLinkMenu.tsx?raw"

const RUN = "c41d8e2a-0000-4000-8000-00000000a063"

beforeEach(() => {
  clip.copyText.mockReset()
  clip.selectAllIn.mockReset()
  clip.copyShortcutWord.mockReset()
  clip.copyShortcutWord.mockReturnValue("Press Ctrl+C to copy")
  org.value = {
    activeOrgId: "A",
    orgs: [
      { org_id: "A", name: "Personal", role: "owner" },
      { org_id: "B", name: "Northwind", role: "member" },
    ],
  }
})
afterEach(() => {
  vi.useRealTimers()
})

async function openRunMenu(audience: "only_you" | "org_members" = "org_members", orgId: string | null = "B") {
  const user = userEvent.setup()
  render(<ShareLinkMenu route={{ view: "workflow-run", runId: RUN }} kind="run" audience={audience} orgId={orgId} />)
  const trigger = screen.getByRole("button", { name: "Link to this workflow run" })
  await user.click(trigger)
  const menu = await screen.findByRole("menu")
  return { user, trigger, menu }
}

describe("ShareLinkMenu — the trigger", () => {
  it("is a ghost button with the word Link, the Link2 icon hidden, and the kind's aria-label", () => {
    render(<ShareLinkMenu route={{ view: "workflow-run", runId: RUN }} kind="run" audience="only_you" orgId={null} />)
    const trigger = screen.getByRole("button", { name: "Link to this workflow run" })
    expect(trigger).toHaveTextContent("Link")
    expect(trigger).not.toHaveTextContent("Share")
    expect(trigger.querySelector("svg")).toHaveAttribute("aria-hidden", "true")
  })

  it("is icon-only below md (h-11 w-11, the word hidden md:inline) and shows the word at md+", () => {
    render(<ShareLinkMenu route={{ view: "chat", threadId: "t1" }} kind="thread" audience="only_you" orgId={null} />)
    const trigger = screen.getByRole("button", { name: "Link to this chat" })
    expect(trigger.className).toContain("h-11")
    expect(trigger.className).toContain("w-11")
    expect(trigger.className).toContain("md:h-9")
    expect(trigger.className).toContain("md:w-auto")
    const word = within(trigger).getByText("Link")
    expect(word.className).toContain("hidden")
    expect(word.className).toContain("md:inline")
  })

  it("names each kind in the aria-label", () => {
    render(
      <>
        <ShareLinkMenu route={{ view: "workflows", definitionId: "d1" }} kind="workflow" audience="only_you" orgId={null} />
        <ShareLinkMenu route={{ view: "experts", bundleId: "e1" }} kind="expert" audience="only_you" orgId={null} />
      </>,
    )
    expect(screen.getByRole("button", { name: "Link to this workflow" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Link to this Expert" })).toBeInTheDocument()
  })
})

describe("ShareLinkMenu — the surface", () => {
  it("shows the label, the host + path address, one Copy link item and the audience line", async () => {
    const { menu } = await openRunMenu()
    expect(within(menu).getByText("Link to this workflow run")).toBeInTheDocument()
    const code = menu.querySelector("code")
    expect(code).not.toBeNull()
    expect(code!.textContent).toBe(`${window.location.host}/app/runs/${RUN}`)
    expect(menu.querySelector("input")).toBeNull()
    const items = within(menu).getAllByRole("menuitem")
    expect(items).toHaveLength(1)
    expect(items[0]).toHaveTextContent("Copy link")
    expect(menu).toHaveTextContent("Opens for members of Northwind.")
    // the org name is the foreground word
    expect(within(menu).getByText("Northwind").className).toContain("text-foreground")
  })

  it("the item is described by the address and the audience line", async () => {
    const { menu } = await openRunMenu()
    const item = within(menu).getByRole("menuitem")
    const ids = (item.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean)
    expect(ids).toHaveLength(2)
    const texts = ids.map((id) => document.getElementById(id)?.textContent)
    expect(texts[0]).toBe(`${window.location.host}/app/runs/${RUN}`)
    expect(texts[1]).toBe("Opens for members of Northwind.")
  })

  it("an unknown org id resolves no name, so members-of falls back to the owner-only line", async () => {
    const { menu } = await openRunMenu("org_members", "ZZZ")
    expect(menu).toHaveTextContent("Opens only for you, on any device you're signed in on.")
    expect(menu).not.toHaveTextContent("members of")
  })

  it("no org context at all still renders the owner-only line", async () => {
    org.value = null
    const { menu } = await openRunMenu("only_you", null)
    expect(menu).toHaveTextContent("Opens only for you, on any device you're signed in on.")
  })
})

describe("ShareLinkMenu — Copy link and the one receipt", () => {
  it("copies origin + path exactly once (no query, no hash), stays open, and says ✓ Link copied for 2 s", async () => {
    clip.copyText.mockResolvedValue("copied")
    const { menu } = await openRunMenu()
    const item = within(menu).getByRole("menuitem")
    vi.useFakeTimers({ shouldAdvanceTime: true })
    await act(async () => {
      fireEvent.click(item)
    })
    await act(async () => {})
    expect(clip.copyText).toHaveBeenCalledTimes(1)
    const copied = clip.copyText.mock.calls[0][0] as string
    expect(copied).toBe(`${window.location.origin}/app/runs/${RUN}`)
    expect(copied).not.toContain("?")
    expect(copied).not.toContain("#")
    // still open, receipt inside the surface
    expect(screen.getByRole("menu")).toBeInTheDocument()
    expect(within(screen.getByRole("menu")).getByRole("menuitem")).toHaveTextContent("✓ Link copied")
    expect(screen.getByRole("status")).toHaveTextContent("Link copied")
    await act(async () => {
      vi.advanceTimersByTime(2100)
    })
    expect(within(screen.getByRole("menu")).getByRole("menuitem")).toHaveTextContent("Copy link")
    expect(within(screen.getByRole("menu")).getByRole("menuitem")).not.toHaveTextContent("✓")
  })

  it("a refused copy selects the address and names the shortcut, never the success word", async () => {
    clip.copyText.mockResolvedValue("refused")
    const { menu } = await openRunMenu()
    const item = within(menu).getByRole("menuitem")
    await act(async () => {
      fireEvent.click(item)
    })
    await act(async () => {})
    expect(clip.selectAllIn).toHaveBeenCalledTimes(1)
    expect(clip.selectAllIn.mock.calls[0][0]).toBe(menu.querySelector("code"))
    expect(within(screen.getByRole("menu")).getByRole("menuitem")).toHaveTextContent("Press Ctrl+C to copy")
    expect(document.body.textContent).not.toContain("Link copied")
  })

  it("no toast is rendered anywhere, and the source mounts no toast and no popover", async () => {
    clip.copyText.mockResolvedValue("copied")
    const { menu } = await openRunMenu()
    await act(async () => {
      fireEvent.click(within(menu).getByRole("menuitem"))
    })
    expect(document.querySelector("[data-sonner-toaster], [role='alert'], [data-toast]")).toBeNull()
    // comments stripped: the docblock may NAME the rule ("there is no toast system")
    const src = (source as string).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
    expect(src).not.toMatch(/toast/i)
    expect(src).not.toContain("@radix-ui/react-popover")
    expect(src).not.toContain("<input")
    expect(src).not.toContain("dangerouslySetInnerHTML")
  })
})

describe("ShareLinkMenuSub — the card ⋯ menu form", () => {
  it("renders a sub trigger 'Link to this workflow' whose content has the same body", async () => {
    const user = userEvent.setup()
    render(
      <DropdownMenu>
        <DropdownMenuTrigger>Options</DropdownMenuTrigger>
        <DropdownMenuContent>
          <ShareLinkMenuSub route={{ view: "workflows", definitionId: "D1" }} kind="workflow" audience="everyone" orgId={null} />
        </DropdownMenuContent>
      </DropdownMenu>,
    )
    await user.click(screen.getByRole("button", { name: "Options" }))
    const menu = await screen.findByRole("menu")
    const sub = within(menu).getByRole("menuitem", { name: /Link to this workflow/ })
    expect(sub).toHaveAttribute("aria-haspopup", "menu")
    await user.click(sub)
    const menus = await screen.findAllByRole("menu")
    const subMenu = menus[menus.length - 1]
    expect(subMenu.querySelector("code")!.textContent).toBe(`${window.location.host}/app/workflows/d1`)
    expect(within(subMenu).getAllByRole("menuitem")).toHaveLength(1)
    expect(subMenu).toHaveTextContent("Opens for anyone signed in to Syrel.")
  })
})
