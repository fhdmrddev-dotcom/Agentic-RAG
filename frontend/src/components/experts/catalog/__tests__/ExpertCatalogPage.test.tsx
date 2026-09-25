/**
 * Phase 262 plan 03 — PACK-11's honesty criterion, driven at the surface a person actually uses.
 *
 * ⛔ EVERY FIXTURE IS `visibility: "granted"`, AND THAT IS NOT DECORATION. RESEARCH §6 traced the
 * predicate: the grant check bites for `'granted'` ALONE — a bundle at `'org'` or `'public'` is
 * visible to every org member no matter what grants exist. A fixture set to `'org'` that expected
 * a vanish would be asserting something the data does not say, and would pass while proving
 * nothing. The same trap will sink the G-4 UAT row if the operator authors the wrong visibility.
 *
 * ⛔ THE VANISH IS ASSERTED OVER RENDERED TEXT, never over the absence of a `data-testid`. The
 * criterion is what a person sees, and this repository's recorded finding is that presence
 * assertions cannot see content drift.
 *
 * ⛔ AND THE POSITIVE CONTROL IS LOAD-BEARING: without case (1), the vanish would pass against a
 * page that renders nothing at all.
 */

import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { ExpertCatalogPage } from "../ExpertCatalogPage"
import * as api from "@/lib/api"
import type { ExpertBundle } from "@/types"
import { within, act, fireEvent } from "@testing-library/react"
import { afterEach } from "vitest"
import * as expertsApi from "@/lib/api/experts"
import { INSTALL_COPY } from "../expertCatalog"
import { INSTALL_POLL_MS } from "../ExpertCatalogPage"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<any>("@/lib/api")
  return {
    ...actual,
    listExperts: vi.fn(),
  }
})

// Phase 266-04: the install call is imported from the domain module, not the barrel (the barrel
// is deliberately not widened). Same importActual shape as the block above.
vi.mock("@/lib/api/experts", async () => {
  const actual = await vi.importActual<any>("@/lib/api/experts")
  return {
    ...actual,
    installExpert: vi.fn(),
  }
})

function bundle(over: Partial<ExpertBundle> & { name: string; slug: string }): ExpertBundle {
  return {
    id: over.slug,
    description: "",
    scope_mode: "biased",
    member_skills: [],
    required_connections: [],
    knowledge_folder_ids: [],
    prompt_suggestions: [],
    // ⛔ granted — the ONLY visibility the grant predicate filters on (RESEARCH §6).
    visibility: "granted",
    is_system: false,
    is_enabled: true,
    ...over,
  }
}

const A = bundle({
  name: "Contract Reviewer",
  slug: "contract-reviewer",
  description: "Reads master services agreements",
  category: "Legal",
})
const B = bundle({
  name: "Margin Watcher",
  slug: "margin-watcher",
  description: "Tracks unit economics",
  category: "Finance",
  member_skills: ["ratio_tool"],
})
/** The sketch's own honesty demo: "Jane does not hold the HR grant → the card vanishes." */
const C = bundle({
  name: "Executive Compensation Advisor",
  slug: "executive-compensation-advisor",
  description: "Board-level pay benchmarking",
  category: "HR",
})

const FORBIDDEN = ["locked", "unlock", "upgrade", "not available to you", "request access"]

function cardCount(container: HTMLElement): number {
  return container.querySelectorAll('[data-testid^="expert-card-"]').length
}

function renderCatalog() {
  return render(
    <ExpertCatalogPage folders={[]} onStartChat={vi.fn()} onInspect={vi.fn()} />,
  )
}

describe("ExpertCatalogPage · PACK-11 honesty", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("(1) THE POSITIVE CONTROL — when the server DOES return the granted Expert, its card renders", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B, C])
    const { container } = renderCatalog()
    expect(await screen.findByText("Executive Compensation Advisor")).toBeInTheDocument()
    expect(cardCount(container)).toBe(3)
  })

  it("(2) THE VANISH — an Expert the caller holds no grant for does not appear at all", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    const { container } = renderCatalog()
    expect(await screen.findByText("Contract Reviewer")).toBeInTheDocument()
    expect(screen.getByText("Margin Watcher")).toBeInTheDocument()
    // Not the name, not the slug, not a placeholder row.
    expect(screen.queryByText("Executive Compensation Advisor")).toBeNull()
    expect(container.textContent).not.toContain("executive-compensation-advisor")
    expect(cardCount(container)).toBe(2)
  })

  it("(3) NO CONSOLATION PRIZE — the vanished Expert leaves no grey-out, no badge and no upsell", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A, B])
    const { container } = renderCatalog()
    await screen.findByText("Contract Reviewer")
    const text = (container.textContent ?? "").toLowerCase()
    for (const word of FORBIDDEN) {
      expect(text).not.toContain(word)
    }
    expect(container.querySelectorAll("button:disabled")).toHaveLength(0)
  })

  it("(4) THE REFUSAL — the server's own sentence renders beside ZERO cards", async () => {
    const sentence = "Upgrade to Enterprise to use experts."
    vi.mocked(api.listExperts).mockRejectedValue(new Error(sentence))
    const { container } = renderCatalog()
    expect(await screen.findByText(sentence)).toBeInTheDocument()
    expect(cardCount(container)).toBe(0)
  })

  it("(5) SEARCH narrows the grid, driven through the real control", async () => {
    const user = userEvent.setup()
    vi.mocked(api.listExperts).mockResolvedValue([A, B, C])
    const { container } = renderCatalog()
    await screen.findByText("Contract Reviewer")

    await user.type(screen.getByLabelText("Search experts"), "margin")
    await waitFor(() => expect(cardCount(container)).toBe(1))
    expect(screen.getByText("Margin Watcher")).toBeInTheDocument()
    expect(screen.queryByText("Contract Reviewer")).toBeNull()

    await user.clear(screen.getByLabelText("Search experts"))
    await waitFor(() => expect(cardCount(container)).toBe(3))
  })

  it("(6) CATEGORY pills are DERIVED from the rows and narrow the grid", async () => {
    const user = userEvent.setup()
    vi.mocked(api.listExperts).mockResolvedValue([A, B, C])
    const { container } = renderCatalog()
    await screen.findByText("Contract Reviewer")

    // One pill per category PRESENT, plus the All control — and nothing the rows never carried.
    expect(screen.getByRole("button", { name: "All" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Finance" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Legal" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "HR" })).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Platform & Dev" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "Legal" }))
    await waitFor(() => expect(cardCount(container)).toBe(1))
    expect(screen.getByText("Contract Reviewer")).toBeInTheDocument()
  })

  it("(7) an empty-but-successful load renders an honest line and ZERO cards — and no pills", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([])
    const { container } = renderCatalog()
    expect(await screen.findByText("No Experts are available to you yet.")).toBeInTheDocument()
    expect(cardCount(container)).toBe(0)
    expect(screen.queryByRole("button", { name: "All" })).toBeNull()
  })

  it("(8) the read is the grant-aware one: called ONCE, with no arguments", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A])
    renderCatalog()
    await screen.findByText("Contract Reviewer")
    expect(api.listExperts).toHaveBeenCalledTimes(1)
    // ⛔ No argument is passed, so the management arm cannot be reached from this surface.
    expect(vi.mocked(api.listExperts).mock.calls[0]).toEqual([])
  })
})

// 262-UAT 3.6: a failed start used to close the modal and say nothing (console.error only).
describe("ExpertCatalogPage — a failed start is VISIBLE (262-UAT 3.6)", () => {
  it("shows an error on the catalog when onStartChat rejects", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A])
    const onStartChat = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
    render(<ExpertCatalogPage folders={[]} onStartChat={onStartChat} onInspect={vi.fn()} />)

    await userEvent.click(await screen.findByRole("button", { name: /start chat/i }))

    expect(onStartChat).toHaveBeenCalledTimes(1)
    expect(await screen.findByRole("alert")).toHaveTextContent(/couldn.t start a chat with Contract Reviewer/i)
    // The grid is still there — the error does not replace the catalog.
    expect(screen.getByText("Contract Reviewer")).toBeInTheDocument()
  })
})

// ── Phase 267-03 (SEED-309 R265-262-04 · D-267-24) — Start Chat is in-flight guarded ─────────
//
// ⛔ DRIVEN RED ON BASE FIRST: the 265 review measured `{ calls: 2, disabled: false }` for a double
// click on a page whose start was pending. Every start creates its own thread, so a second click
// is a second thread. `fireEvent` (not userEvent) so both clicks land before the promise settles.

function deferred() {
  let resolve!: () => void
  let reject!: (e: unknown) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("ExpertCatalogPage — Start Chat in flight (267-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("(14) CARD: a double click starts ONE chat; 'Starting…' is disabled and aria-busy until it settles", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A])
    const d = deferred()
    const onStartChat = vi.fn(() => d.promise)
    render(<ExpertCatalogPage folders={[]} onStartChat={onStartChat} />)
    const btn = await screen.findByRole("button", { name: /start chat/i })

    fireEvent.click(btn)
    fireEvent.click(screen.getAllByRole("button").find((b) => /start/i.test(b.textContent ?? ""))!)

    expect(onStartChat).toHaveBeenCalledTimes(1)
    const busy = screen.getByRole("button", { name: /starting/i }) as HTMLButtonElement
    expect(busy.textContent).toContain("Starting…")
    expect(busy.disabled).toBe(true)
    expect(busy.getAttribute("aria-busy")).toBe("true")

    await act(async () => {
      d.resolve()
      await d.promise
    })
    const again = await screen.findByRole("button", { name: /start chat/i })
    expect((again as HTMLButtonElement).disabled).toBe(false)
  })

  it("(15) CARD: a rejected start re-enables the button and the shipped error path shows its message", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([A])
    const d = deferred()
    const onStartChat = vi.fn(() => d.promise)
    render(<ExpertCatalogPage folders={[]} onStartChat={onStartChat} />)
    fireEvent.click(await screen.findByRole("button", { name: /start chat/i }))
    expect(screen.getByRole("button", { name: /starting/i })).toBeTruthy()

    await act(async () => {
      d.reject(new TypeError("Failed to fetch"))
      await d.promise.catch(() => {})
    })
    expect(await screen.findByRole("alert")).toHaveTextContent(
      /couldn.t start a chat with Contract Reviewer/i,
    )
    expect(
      (screen.getByRole("button", { name: /start chat/i }) as HTMLButtonElement).disabled,
    ).toBe(false)
  })

  it("(16) MODAL: a double click on Start Scoped Chat starts ONE chat, shows 'Starting…', then closes", async () => {
    const user = userEvent.setup()
    vi.mocked(api.listExperts).mockResolvedValue([A])
    const d = deferred()
    const onStartChat = vi.fn(() => d.promise)
    const { container } = render(<ExpertCatalogPage folders={[]} onStartChat={onStartChat} />)
    await screen.findByText("Contract Reviewer")
    await user.click(within(cardOf(container, "contract-reviewer")).getByRole("button", { name: "Details" }))
    const dialog = await screen.findByRole("dialog")
    const start = within(dialog).getByRole("button", { name: /start scoped chat with expert/i })

    fireEvent.click(start)
    fireEvent.click(within(screen.getByRole("dialog")).getAllByRole("button").find((b) => /start/i.test(b.textContent ?? ""))!)

    expect(onStartChat).toHaveBeenCalledTimes(1)
    const busy = within(screen.getByRole("dialog")).getByRole("button", { name: /starting/i })
    expect((busy as HTMLButtonElement).disabled).toBe(true)
    expect(busy.getAttribute("aria-busy")).toBe("true")

    await act(async () => {
      d.resolve()
      await d.promise
    })
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})

// ── Phase 267-03 (PACK-22 · D-267-08) — the Connections door ─────────────────────────────────

describe("ExpertCatalogPage — a missing connection opens Connections (267-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const coach = bundle({
    name: "Sales Pipeline Coach",
    slug: "sales-pipeline-coach",
    required_connections: ["hubspot"],
    connection_state: [{ slug: "hubspot", name: "HubSpot", connected: false }],
    can_connect: true,
  })

  it("(17) the card's Connect calls onOpenConnections once and never starts a chat", async () => {
    vi.mocked(api.listExperts).mockResolvedValue([coach])
    const onStartChat = vi.fn()
    const onOpenConnections = vi.fn()
    render(
      <ExpertCatalogPage
        folders={[]}
        onStartChat={onStartChat}
        onOpenConnections={onOpenConnections}
      />,
    )
    const connect = await screen.findByRole("button", { name: /connect hubspot →/i })
    expect(screen.getByText("Requires HubSpot — not connected")).toBeVisible()
    expect(screen.queryByRole("button", { name: /start chat/i })).toBeNull()
    fireEvent.click(connect)
    expect(onOpenConnections).toHaveBeenCalledTimes(1)
    expect(onStartChat).not.toHaveBeenCalled()
  })

  it("(18) the modal's Connect closes the modal, then opens Connections", async () => {
    const user = userEvent.setup()
    vi.mocked(api.listExperts).mockResolvedValue([coach])
    const onOpenConnections = vi.fn()
    const { container } = render(
      <ExpertCatalogPage folders={[]} onStartChat={vi.fn()} onOpenConnections={onOpenConnections} />,
    )
    await screen.findByText("Sales Pipeline Coach")
    await user.click(within(cardOf(container, "sales-pipeline-coach")).getByRole("button", { name: "Details" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: /connect hubspot →/i }))
    expect(onOpenConnections).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull())
  })
})

// ── Phase 266-04 (D-266-01 / D-266-03 · D-v2.5-03) — install from the catalog, reconciled by FETCH ──

type InstallStateName = "not_installed" | "installing" | "ready" | "failed"

function fa(state: InstallStateName, can_install = true): ExpertBundle {
  return bundle({
    name: "Financial Analyzer",
    slug: "financial-analyzer",
    description: "Reads quarterly filings",
    category: "Finance",
    is_system: true,
    knowledge_folder_ids: state === "ready" ? ["f-installed"] : [],
    install: {
      state,
      folder_id: state === "ready" ? "f-installed" : null,
      cause: null,
      cause_source: null,
      can_install,
      updated_at: "2026-09-24T00:00:00Z",
    },
  })
}

function cardOf(container: HTMLElement, slug: string): HTMLElement {
  const el = container.querySelector(`[data-testid="expert-card-${slug}"]`)
  if (!el) throw new Error(`no card for ${slug}`)
  return el as HTMLElement
}

beforeEach(() => {
  // The four Radix jsdom shims — the detail modal is a Radix dialog.
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
})

describe("ExpertCatalogPage — install (266-04)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("(9) the CARD swaps its primary control: Install for a manager, a status line for a non-manager — never a dead button", async () => {
    const other = { ...fa("not_installed", false), id: "fa-2", slug: "fa-viewer", name: "Viewer Copy" }
    vi.mocked(api.listExperts).mockResolvedValue([fa("not_installed"), other])
    const { container } = renderCatalog()
    await screen.findByText("Viewer Copy")

    const manager = within(cardOf(container, "financial-analyzer"))
    expect(manager.getByRole("button", { name: INSTALL_COPY.installAction })).toBeInTheDocument()
    expect(manager.queryByRole("button", { name: /start chat/i })).toBeNull()
    expect(manager.getAllByRole("button")).toHaveLength(2) // Details + Install — one variant, two controls

    const viewer = within(cardOf(container, "fa-viewer"))
    expect(viewer.queryByRole("button", { name: /install/i })).toBeNull()
    expect(viewer.queryByRole("button", { name: /start chat/i })).toBeNull()
    expect(cardOf(container, "fa-viewer").textContent).toContain(INSTALL_COPY.cardNeedsAdmin)
    expect(container.querySelectorAll("button:disabled")).toHaveLength(0)
  })

  it("(10) Install calls installExpert ONCE with the id, then re-reads the list and the modal shows the fresh row", async () => {
    const user = userEvent.setup()
    vi.mocked(api.listExperts)
      .mockResolvedValueOnce([fa("not_installed")])
      .mockResolvedValue([fa("installing")])
    vi.mocked(expertsApi.installExpert).mockResolvedValue({
      expert_bundle_id: "financial-analyzer",
      corpus_version: "sha256:abc",
      install: fa("installing").install!,
    })
    const { container } = renderCatalog()
    await screen.findByText("Financial Analyzer")

    await user.click(within(cardOf(container, "financial-analyzer")).getByRole("button", { name: "Details" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: INSTALL_COPY.installAction }))

    expect(expertsApi.installExpert).toHaveBeenCalledTimes(1)
    expect(expertsApi.installExpert).toHaveBeenCalledWith("financial-analyzer")
    await waitFor(() => expect(api.listExperts).toHaveBeenCalledTimes(2))
    await waitFor(() =>
      expect(within(screen.getByRole("dialog")).getByText(INSTALL_COPY.installing)).toBeInTheDocument(),
    )
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: /install/i })).toBeNull()
  })

  it("(11) while a row is INSTALLING the page polls by fetch, and stops once nothing is installing", async () => {
    vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] })
    vi.mocked(api.listExperts)
      .mockResolvedValueOnce([fa("installing")])
      .mockResolvedValueOnce([fa("ready")])
      // Anything after that would be a poll that was never cleared — it keeps returning
      // `installing`, so a leaked interval shows up as a rising call count.
      .mockResolvedValue([fa("installing")])
    const { container } = renderCatalog()
    await screen.findByText("Financial Analyzer")
    expect(api.listExperts).toHaveBeenCalledTimes(1)

    await act(async () => {
      vi.advanceTimersByTime(INSTALL_POLL_MS)
    })
    await waitFor(() => expect(api.listExperts).toHaveBeenCalledTimes(2))
    // The ready row brings Start Chat back to the card.
    await waitFor(() =>
      expect(
        within(cardOf(container, "financial-analyzer")).getByRole("button", { name: /start chat/i }),
      ).toBeInTheDocument(),
    )

    await act(async () => {
      vi.advanceTimersByTime(INSTALL_POLL_MS * 3)
    })
    expect(api.listExperts).toHaveBeenCalledTimes(2)
  })

  it("(12) a 409 from installExpert renders its sentence in the modal", async () => {
    const user = userEvent.setup()
    const sentence = "This Expert is already being installed in this organisation."
    vi.mocked(api.listExperts).mockResolvedValue([fa("not_installed")])
    vi.mocked(expertsApi.installExpert).mockRejectedValue(new Error(sentence))
    const { container } = renderCatalog()
    await screen.findByText("Financial Analyzer")

    await user.click(within(cardOf(container, "financial-analyzer")).getByRole("button", { name: "Details" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: INSTALL_COPY.installAction }))

    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText(sentence)).toBeInTheDocument())
    expect(screen.queryAllByRole("button").filter((b) => (b as HTMLButtonElement).disabled)).toHaveLength(0)
  })

  it("(13) IN-02 — an install that STARTED is never reported as failed because the re-read after it failed", async () => {
    const user = userEvent.setup()
    const readError = "Failed to list experts"
    vi.mocked(api.listExperts)
      .mockResolvedValueOnce([fa("not_installed")])
      .mockRejectedValueOnce(new Error(readError))
      .mockResolvedValue([fa("installing")])
    vi.mocked(expertsApi.installExpert).mockResolvedValue({
      expert_bundle_id: "financial-analyzer",
      corpus_version: "sha256:abc",
      install: fa("installing").install!,
    })
    const { container } = renderCatalog()
    await screen.findByText("Financial Analyzer")

    await user.click(within(cardOf(container, "financial-analyzer")).getByRole("button", { name: "Details" }))
    const dialog = await screen.findByRole("dialog")
    await user.click(within(dialog).getByRole("button", { name: INSTALL_COPY.installAction }))

    await waitFor(() => expect(api.listExperts).toHaveBeenCalledTimes(2))
    // The 202's own state stands; the failed re-read is left to the poll to reconcile.
    await waitFor(() =>
      expect(within(screen.getByRole("dialog")).getByText(INSTALL_COPY.installing)).toBeInTheDocument(),
    )
    expect(screen.queryByText(readError)).toBeNull()
  })
})
