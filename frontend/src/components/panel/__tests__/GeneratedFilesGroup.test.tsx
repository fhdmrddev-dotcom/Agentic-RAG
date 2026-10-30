/**
 * Phase 302 plan 01 (FIX-01, UI-D1/UI-D2/UI-D4/UI-D5/UI-D7/UI-D8) — the panel's "Generated files"
 * group: a labelled role=group of download LINKS at panel density, outside the workspace listbox.
 * Each case asserts rendered words and roles, not testid presence.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, fireEvent, render, screen, within } from "@testing-library/react"
import { axe } from "vitest-axe"

const { FakeDownloadError, downloadSandboxOutput } = vi.hoisted(() => {
  class FakeDownloadError extends Error {
    readonly status: number | "network"
    constructor(status: number | "network", message: string) {
      super(message)
      this.status = status
      this.name = "DownloadError"
    }
  }
  return { FakeDownloadError, downloadSandboxOutput: vi.fn() }
})
vi.mock("@/lib/api", () => ({
  downloadSandboxOutput: (...a: unknown[]) => downloadSandboxOutput(...a),
  DownloadError: FakeDownloadError,
}))

// eslint-disable-next-line import/first
import { GeneratedFilesGroup } from "@/components/panel/GeneratedFilesGroup"
// eslint-disable-next-line import/first
import type { GeneratedFile } from "@/components/panel/generatedFiles"

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ""
const NOW = Date.parse("2026-10-27T10:10:00Z")

const TWO: GeneratedFile[] = [
  { filename: "c1.png", url: "/sandbox-outputs/u/e2/c1.png", size: 2048, producedAt: "2026-10-27T10:08:00Z" },
  { filename: "report.pdf", url: "/sandbox-outputs/u/e2/report.pdf", producedAt: "2026-10-27T10:08:00Z" },
]

describe("GeneratedFilesGroup (FIX-01 — the thread's generated files in the panel)", () => {
  beforeEach(() => {
    downloadSandboxOutput.mockReset()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it("renders nothing for an empty list (no label, no group)", () => {
    const { container } = render(<GeneratedFilesGroup files={[]} now={NOW} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByText("Generated files")).toBeNull()
    expect(screen.queryByRole("group")).toBeNull()
  })

  it("renders the label and a role=group named 'Generated files' with one link per file", () => {
    render(<GeneratedFilesGroup files={TWO} now={NOW} />)
    const label = screen.getByText("Generated files")
    expect(label.tagName).toBe("P")
    for (const cls of ["font-mono", "text-[10px]", "uppercase", "text-panel-muted-foreground"]) {
      expect(label.className).toContain(cls)
    }
    const group = screen.getByRole("group", { name: "Generated files" })
    const links = within(group).getAllByRole("link")
    expect(links).toHaveLength(2)
    expect(links[0]).toHaveTextContent("c1.png")
    expect(links[0]).toHaveTextContent("2.0 KB")
    expect(links[0]).toHaveTextContent("2 min ago")
    expect(links[0]).toHaveAttribute("href", `${API_BASE}/sandbox-outputs/u/e2/c1.png`)
    expect(links[0]).toHaveAttribute("download", "c1.png")
    expect(links[1]).toHaveTextContent("report.pdf")
    expect(links[1]).toHaveAttribute("download", "report.pdf")
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(screen.queryByRole("option")).toBeNull()
  })

  it("clicking a row downloads it once through the chat's function, aria-disabled while pending", async () => {
    let resolve!: () => void
    downloadSandboxOutput.mockImplementation(() => new Promise<void>((r) => { resolve = r }))
    render(<GeneratedFilesGroup files={TWO} now={NOW} />)
    const link = screen.getByRole("link", { name: /c1\.png/ })
    fireEvent.click(link)
    expect(downloadSandboxOutput).toHaveBeenCalledTimes(1)
    expect(downloadSandboxOutput).toHaveBeenCalledWith("/sandbox-outputs/u/e2/c1.png", "c1.png")
    expect(link).toHaveAttribute("aria-disabled", "true")
    fireEvent.click(link)
    expect(downloadSandboxOutput).toHaveBeenCalledTimes(1)
    await act(async () => { resolve() })
    expect(link).toHaveAttribute("aria-disabled", "false")
  })

  it("a failed download shows its words in THAT row only, and clears after 3 s", async () => {
    vi.useFakeTimers()
    downloadSandboxOutput.mockRejectedValue(new FakeDownloadError(404, "File not found."))
    render(<GeneratedFilesGroup files={TWO} now={NOW} />)
    const [first, second] = screen.getAllByRole("link")
    await act(async () => { fireEvent.click(first) })
    expect(first).toHaveTextContent("File not found.")
    expect(second).not.toHaveTextContent("File not found.")
    expect(first.className).toContain("border-red-500/40")
    act(() => { vi.advanceTimersByTime(3000) })
    expect(first).not.toHaveTextContent("File not found.")
  })

  it("a file with no url renders the dead arm inside a div, not a link, not focusable", () => {
    render(<GeneratedFilesGroup files={[{ filename: "lost.csv", producedAt: null }]} now={NOW} />)
    const group = screen.getByRole("group", { name: "Generated files" })
    expect(within(group).queryByRole("link")).toBeNull()
    const dead = within(group).getByText("Download unavailable")
    const row = within(group).getByText("lost.csv").closest("div[data-dead]") as HTMLElement | null
    expect(row).not.toBeNull()
    expect(row!.tagName).toBe("DIV")
    expect(row!.hasAttribute("tabindex")).toBe(false)
    expect(row).toContainElement(dead)
  })

  it("an absent instant reads 'time unknown'; the age uses the now it is given", () => {
    render(
      <GeneratedFilesGroup
        files={[
          { filename: "a.txt", url: "/sandbox-outputs/a.txt", producedAt: null },
          { filename: "b.txt", url: "/sandbox-outputs/b.txt", producedAt: "2026-10-27T09:10:00Z" },
        ]}
        now={NOW}
      />,
    )
    expect(screen.getByRole("link", { name: /a\.txt/ })).toHaveTextContent("time unknown")
    expect(screen.getByRole("link", { name: /b\.txt/ })).toHaveTextContent("1 hour ago")
  })

  it("has no axe violations", async () => {
    const { container } = render(<GeneratedFilesGroup files={TWO} now={NOW} />)
    expect(await axe(container)).toHaveNoViolations()
  })
})
