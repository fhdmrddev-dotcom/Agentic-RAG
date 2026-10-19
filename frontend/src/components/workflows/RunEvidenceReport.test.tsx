/**
 * Phase 289-04 Task 2 (D-02 / D-03 / D-05 / D-10 / D-14a) — the finished run's printable
 * evidence report, pinned BY CONTENT.
 *
 * ⚠ D-03 is the reason this suite exists in this shape: "the export matches what the page
 * shows" is asserted as set equality of STRINGS between the DOM of each section and the one
 * view-model (`sectionStrings(toEvidenceView(payload))`), and as deep equality between the
 * JSON the download writes and the payload the page was rendered from. A testid only locates a
 * section; it never stands in for its content (presence assertions cannot see content drift).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import type { RunEvidence } from "@/lib/api/runEvidence"
import { sectionStrings, toEvidenceView } from "./evidenceView"
import {
  OWNER_EMAIL,
  RUN_ID,
  changedPayload,
  colleaguePayload,
  failedPayload,
  ownerPayload,
  predatesPayload,
} from "./evidenceFixtures.testutil"

const getRunEvidence = vi.fn()
vi.mock("@/lib/api/runEvidence", () => ({
  getRunEvidence: (...a: unknown[]) => getRunEvidence(...a),
}))

const downloadWorkspaceFile = vi.fn(
  (_threadId: string, _fileId: string, _filename: string): Promise<void> => Promise.resolve(),
)
vi.mock("@/lib/api/documents", () => ({
  downloadWorkspaceFile: (...a: unknown[]) => downloadWorkspaceFile(...(a as [string, string, string])),
}))

import { RunEvidenceReport } from "./RunEvidenceReport"

class FakeApiError extends Error {
  readonly status: number
  constructor(status: number) {
    super(`status ${status}`)
    this.status = status
  }
}

function renderReport(payload: RunEvidence | Error, props: { onOpenThread?: (id: string) => void } = {}) {
  if (payload instanceof Error) getRunEvidence.mockRejectedValue(payload)
  else getRunEvidence.mockResolvedValue(payload)
  const onBack = vi.fn()
  const utils = render(
    <RunEvidenceReport runId={RUN_ID} onBack={onBack} onOpenThread={"onOpenThread" in props ? props.onOpenThread : vi.fn()} />,
  )
  return { ...utils, onBack }
}

async function ready() {
  await screen.findByTestId("run-evidence-report")
}

function section(n: 1 | 2 | 3 | 4): HTMLElement {
  const el = document.querySelector(`[data-evidence-section="${n}"]`)
  if (!(el instanceof HTMLElement)) throw new Error(`section ${n} not rendered`)
  return el
}

function rows(n: 1 | 2 | 3 | 4): HTMLElement[] {
  return Array.from(section(n).querySelectorAll<HTMLElement>("[data-evidence-row]"))
}

function buttonNames(): string[] {
  return screen
    .getAllByRole("button")
    .map((b) => (b.textContent ?? "").replace(/[⤓⎙]/g, "").trim())
    .sort()
}

beforeEach(() => {
  window.history.replaceState(null, "", "/app")
})

afterEach(() => {
  cleanup()
  getRunEvidence.mockReset()
  downloadWorkspaceFile.mockClear()
  vi.restoreAllMocks()
})

describe("RunEvidenceReport: the states that are not a report", () => {
  it("shows the loading line while the read is in flight", () => {
    getRunEvidence.mockReturnValue(new Promise(() => {}))
    render(<RunEvidenceReport runId={RUN_ID} onBack={vi.fn()} />)
    expect(screen.getByText("Opening the run record…")).toBeTruthy()
  })

  it("a 404 shows one 'isn't available' screen and nothing about the run", async () => {
    const { onBack, container } = renderReport(new FakeApiError(404))
    await screen.findByText("This run isn't available")
    expect(
      screen.getByText(
        "It may not exist, or it belongs to an organisation you're not in. Nothing about it is shown here.",
      ),
    ).toBeTruthy()
    expect(buttonNames()).toEqual(["‹ Back to Workflows"])
    expect(container.textContent).not.toContain("Vendor-risk")
    fireEvent.click(screen.getByRole("button", { name: "‹ Back to Workflows" }))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  it("any other failure is a worded retry, not the 404 words", async () => {
    renderReport(new FakeApiError(500))
    await screen.findByText("We couldn't load this run's record.")
    expect(screen.queryByText("This run isn't available")).toBeNull()
    getRunEvidence.mockResolvedValue(ownerPayload())
    fireEvent.click(screen.getByRole("button", { name: "Try again" }))
    await ready()
    expect(getRunEvidence).toHaveBeenCalledTimes(2)
  })

  it("fetches the run it was given, with an abort signal", async () => {
    renderReport(ownerPayload())
    await ready()
    expect(getRunEvidence).toHaveBeenCalledWith(RUN_ID, expect.any(AbortSignal))
  })
})

describe("RunEvidenceReport: the owner's report (D-14a)", () => {
  it("carries the title, the read-only mark, the export buttons and the owner links", async () => {
    renderReport(ownerPayload())
    await ready()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Vendor-risk portfolio review")
    expect(screen.getByText("Read-only record")).toBeTruthy()
    expect(buttonNames()).toEqual(
      ["Download JSON", "Download the deliverable", "Open the chat thread", "Print / save as PDF"].sort(),
    )
    const sub = screen.getByTestId("evidence-sub").textContent ?? ""
    expect(sub).toContain("Completed in 3m 58s")
    expect(sub).toContain("Dana Whitfield (you)")
    expect(sub).toContain(OWNER_EMAIL)
    expect(sub).toContain("Northwind Procurement")
  })

  it("renders the facts strip from the view-model", async () => {
    renderReport(ownerPayload())
    await ready()
    const facts = screen.getByTestId("evidence-facts")
    const cells = Array.from(facts.querySelectorAll("[data-evidence-fact]")).map((c) => [
      c.querySelector("[data-fact-label]")?.textContent,
      c.querySelector("[data-fact-value]")?.textContent,
    ])
    expect(cells).toEqual(toEvidenceView(ownerPayload()).facts.map((f) => [f.label, f.value]))
  })

  it("opens the chat thread and downloads the deliverable for the owner", async () => {
    const onOpenThread = vi.fn()
    renderReport(ownerPayload(), { onOpenThread })
    await ready()
    fireEvent.click(screen.getByRole("button", { name: "Open the chat thread" }))
    expect(onOpenThread).toHaveBeenCalledWith("thread-9")
    fireEvent.click(screen.getByRole("button", { name: "Download the deliverable" }))
    expect(downloadWorkspaceFile).toHaveBeenCalledWith("thread-9", "file-1", "committee_brief.docx")
  })

  it("offers no thread link when the page has none to give", async () => {
    renderReport(ownerPayload(), { onOpenThread: undefined })
    await ready()
    expect(screen.queryByRole("button", { name: "Open the chat thread" })).toBeNull()
  })
})

describe("RunEvidenceReport: a colleague's report (D-05, R-01, R-02, R-04)", () => {
  it("offers exactly the two export buttons and nothing writable", async () => {
    renderReport(colleaguePayload())
    await ready()
    expect(buttonNames()).toEqual(["Download JSON", "Print / save as PDF"])
  })

  it("shows the owner's display name only, never (you) or an email", async () => {
    const { container } = renderReport(colleaguePayload())
    await ready()
    const text = container.textContent ?? ""
    expect(text).toContain("Dana Whitfield")
    expect(text).not.toContain("(you)")
    expect(text).not.toContain(OWNER_EMAIL)
    expect(text).not.toMatch(/@northwind/)
  })

  it("R-04: the human-input step says only that it waited and was answered", async () => {
    renderReport(colleaguePayload())
    await ready()
    const confirm = rows(2)[2]
    expect(confirm.textContent).toContain("Waited for an answer · answered")
    expect(confirm.textContent).not.toContain("Escalate both")
  })

  it("R-01: a masked source reads as a document you cannot see, with its cited-by", async () => {
    renderReport(colleaguePayload())
    await ready()
    const masked = rows(4)[1]
    expect(masked.textContent).toContain("A document you don't have access to")
    expect(masked.textContent).toContain("cited by step 4")
    expect(masked.textContent).not.toContain("Procurement Policy")
  })

  it("R-02: the deliverable fact names the file and offers no download", async () => {
    renderReport(colleaguePayload())
    await ready()
    expect(screen.getByTestId("evidence-facts").textContent).toContain("◆ committee_brief.docx")
    expect(screen.queryByRole("button", { name: "Download the deliverable" })).toBeNull()
  })
})

describe("RunEvidenceReport: D-03, the page and its export are one source", () => {
  it.each([
    ["owner", ownerPayload],
    ["colleague", colleaguePayload],
    ["failed", failedPayload],
    ["changed", changedPayload],
  ] as const)("every section's DOM carries exactly the view-model's rows and strings (%s)", async (_l, make) => {
    const payload = make()
    renderReport(payload)
    await ready()
    const view = toEvidenceView(payload)
    const strings = sectionStrings(view)
    for (const n of [1, 2, 3, 4] as const) {
      const text = section(n).textContent ?? ""
      for (const s of strings[n]) expect(text, `section ${n} lacks ${JSON.stringify(s)}`).toContain(s)
    }
    // No row the view-model lacks: the row counts match, and row i carries view row i.
    expect(rows(1)).toHaveLength(view.definition.steps.length)
    view.definition.steps.forEach((s, i) => expect(rows(1)[i].textContent).toContain(s.title))
    expect(rows(2)).toHaveLength(view.steps.length)
    view.steps.forEach((r, i) => {
      const t = rows(2)[i].textContent ?? ""
      for (const s of [r.title, r.typeLine, r.statusWord, r.time, r.output, r.count, ...(r.humanInput ?? [])]) {
        if (s) expect(t).toContain(s)
      }
    })
    expect(rows(3)).toHaveLength(view.verdicts.length)
    view.verdicts.forEach((r, i) => {
      const t = rows(3)[i].textContent ?? ""
      for (const s of [r.sentence, r.meta, r.resultWord]) expect(t).toContain(s)
    })
    expect(rows(4)).toHaveLength(view.sources.length)
    view.sources.forEach((r, i) => {
      const t = rows(4)[i].textContent ?? ""
      for (const s of [r.title, r.where, r.citedBy]) if (s) expect(t).toContain(s)
    })
  })

  it("Download JSON writes the fetched payload, unchanged, as application/json", async () => {
    const payload = ownerPayload()
    renderReport(payload)
    await ready()
    let blob: Blob | null = null
    const create = vi.fn((b: Blob) => {
      blob = b
      return "blob:evidence"
    })
    Object.defineProperty(URL, "createObjectURL", { value: create, configurable: true, writable: true })
    Object.defineProperty(URL, "revokeObjectURL", { value: vi.fn(), configurable: true, writable: true })
    let downloadName = ""
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      downloadName = this.download
    })
    fireEvent.click(screen.getByRole("button", { name: /Download JSON/ }))
    expect(create).toHaveBeenCalledTimes(1)
    expect(blob).not.toBeNull()
    const b = blob as unknown as Blob
    expect(b.type).toBe("application/json")
    expect(downloadName).toBe(`run-evidence-${RUN_ID.slice(0, 8)}.json`)
    const exported = JSON.parse(await b.text()) as RunEvidence
    expect(exported.definition).toEqual(payload.definition)
    expect(exported.phase_log).toEqual(payload.phase_log)
    expect(exported.verdicts).toEqual(payload.verdicts)
    expect(exported.sources).toEqual(payload.sources)
    // And the export reads, section by section, as the same strings the page shows.
    expect(sectionStrings(toEvidenceView(exported))).toEqual(sectionStrings(toEvidenceView(payload)))
  })

  it("Print calls the browser's print on the page itself", async () => {
    renderReport(ownerPayload())
    await ready()
    const print = vi.fn()
    vi.stubGlobal("print", print)
    window.print = print
    fireEvent.click(screen.getByRole("button", { name: /Print \/ save as PDF/ }))
    expect(print).toHaveBeenCalledTimes(1)
    vi.unstubAllGlobals()
  })

  it("marks the one print root", async () => {
    renderReport(ownerPayload())
    await ready()
    expect(document.querySelectorAll("[data-print-root]")).toHaveLength(1)
  })
})

describe("RunEvidenceReport: the step log's evidence line (D-10 / SC#4 receipt arm)", () => {
  it("a KB step shows the evidence line and a non-KB step shows none", async () => {
    renderReport(ownerPayload())
    await ready()
    const lines = screen.getAllByTestId("step-evidence-line")
    expect(lines).toHaveLength(1)
    expect(within(rows(2)[1]).getByTestId("step-evidence-line").textContent).toContain(
      "Answered from Procurement KB · 9 passages",
    )
    expect(within(rows(2)[1]).getByTestId("step-evidence-line").textContent).toContain("Medium · 0.47")
    for (const i of [0, 2, 3]) expect(within(rows(2)[i]).queryByTestId("step-evidence-line")).toBeNull()
  })
})

describe("RunEvidenceReport: the version banners (D-04)", () => {
  it("shows the changed banner only when the definition changed, naming both versions", async () => {
    renderReport(changedPayload())
    await ready()
    const banner = screen.getByTestId("evidence-changed")
    expect(banner.textContent).toContain("This workflow has changed since this run.")
    expect(banner.textContent).toContain("The page shows version 7, exactly as it ran. The current version is 9.")
    cleanup()
    renderReport(ownerPayload())
    await ready()
    expect(screen.queryByTestId("evidence-changed")).toBeNull()
  })

  it("says a run with no recorded snapshot predates version recording", async () => {
    renderReport(predatesPayload())
    await ready()
    expect(screen.getByTestId("evidence-predates").textContent).toContain("predates version recording")
  })
})

describe("RunEvidenceReport: the shareable address (SC#3)", () => {
  it("writes ?run=<id> while shown and clears it on unmount", async () => {
    const { unmount } = renderReport(ownerPayload())
    await ready()
    expect(new URLSearchParams(window.location.search).get("run")).toBe(RUN_ID)
    unmount()
    expect(new URLSearchParams(window.location.search).get("run")).toBeNull()
  })
})

describe("RunEvidenceReport: hostile strings are text (T-289-20)", () => {
  it("renders a hostile workflow name, filename and output as text, never as elements", async () => {
    const hostile = '<img src=x onerror="alert(1)">'
    const p = ownerPayload()
    p.run.workflow_name = hostile
    p.sources[0].filename = hostile
    p.phase_log[0].output_text = hostile
    const { container } = renderReport(p)
    await ready()
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(hostile)
    expect(rows(4)[0].textContent).toContain(hostile)
    await act(async () => {})
  })
})

describe("RunEvidenceReport: an aborted read never lands", () => {
  it("does not update after unmount", async () => {
    let resolve: (p: RunEvidence) => void = () => {}
    getRunEvidence.mockReturnValue(new Promise<RunEvidence>((r) => (resolve = r)))
    const { unmount } = render(<RunEvidenceReport runId={RUN_ID} onBack={vi.fn()} />)
    const signal = getRunEvidence.mock.calls[0][1] as AbortSignal
    unmount()
    expect(signal.aborted).toBe(true)
    await act(async () => resolve(ownerPayload()))
    await waitFor(() => expect(screen.queryByTestId("run-evidence-report")).toBeNull())
  })
})
