/**
 * Phase 295-06 (D-03 / D-39 / UI-SPEC A.3) — the folder chooser for "Search another folder".
 *
 * ⚠ THE LEAF CAN SHOW NOTHING THE SERVER DID NOT OFFER. Its rows come ONLY from the `folders`
 * prop (the prompt's `engine_pause.folders`, bounded server-side by the run's scope root). It
 * fetches nothing and imports no folder API — every shipped folder picker reads the user's WHOLE
 * folder list, which would widen access past D-03's bound (T-295-06-01).
 *
 * Every case asserts rendered words (label, placeholder, helper, folder names), never a testid.
 */
import { describe, it, expect, vi, beforeAll } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { AskFolderChoice } from "../AskFolderChoice"
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import leafSource from "../AskFolderChoice.tsx?raw"

beforeAll(() => {
  // Radix Select needs these in jsdom (the ChatArea.expertThread precedent).
  Element.prototype.scrollIntoView = vi.fn()
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
})

const FOLDERS = [
  { id: "f-contracts", name: "Contracts", depth: 0 },
  { id: "f-leases", name: "Leases", depth: 1 },
  { id: "f-blank", name: "", depth: 1 },
  { id: "f-hr", name: "HR", depth: 2 },
]

const HELPER = "The step runs once more, searching only this folder. The workflow itself is not changed."

describe("AskFolderChoice (295-06 / D-03)", () => {
  it("renders the visible label tied to the trigger, the placeholder and the helper line", () => {
    render(<AskFolderChoice id="ask-tc-1-folder" folders={FOLDERS} value={undefined} onChange={() => {}} />)
    const label = screen.getByText("Folder to search")
    expect(label.tagName).toBe("LABEL")
    expect(label).toHaveAttribute("for", "ask-tc-1-folder")
    const trigger = screen.getByLabelText("Folder to search")
    expect(trigger).toHaveAttribute("role", "combobox")
    expect(trigger).toHaveTextContent("Choose a folder…")
    expect(screen.getByText(HELPER)).toBeInTheDocument()
  })

  it("lists ONLY the server's folders, by name, in its order, and drops a nameless row", async () => {
    const user = userEvent.setup()
    render(<AskFolderChoice id="ask-tc-2-folder" folders={FOLDERS} value={undefined} onChange={() => {}} />)
    await user.click(screen.getByLabelText("Folder to search"))
    const options = await screen.findAllByRole("option")
    expect(options.map((o) => o.textContent)).toEqual(["Contracts", "Leases", "HR"])
    // Name only — never an id or a path.
    for (const o of options) {
      expect(o.textContent).not.toMatch(/f-|\//)
    }
  })

  it("indents each folder 16px per depth level", async () => {
    const user = userEvent.setup()
    render(<AskFolderChoice id="ask-tc-3-folder" folders={FOLDERS} value={undefined} onChange={() => {}} />)
    await user.click(screen.getByLabelText("Folder to search"))
    const byName = (n: string) => screen.getAllByRole("option").find((o) => o.textContent === n)!
    expect(byName("Contracts").style.paddingLeft).toBe("calc(2rem + 0px)")
    expect(byName("Leases").style.paddingLeft).toBe("calc(2rem + 16px)")
    expect(byName("HR").style.paddingLeft).toBe("calc(2rem + 32px)")
  })

  it("reports the chosen folder's id, and shows the chosen folder's name once chosen", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(
      <AskFolderChoice id="ask-tc-4-folder" folders={FOLDERS} value={undefined} onChange={onChange} />,
    )
    await user.click(screen.getByLabelText("Folder to search"))
    await user.click(await screen.findByRole("option", { name: "Leases" }))
    expect(onChange).toHaveBeenCalledWith("f-leases")

    rerender(<AskFolderChoice id="ask-tc-4-folder" folders={FOLDERS} value="f-leases" onChange={onChange} />)
    expect(screen.getByLabelText("Folder to search")).toHaveTextContent("Leases")
    expect(screen.getByLabelText("Folder to search")).not.toHaveTextContent("Choose a folder…")
  })
})

describe("AskFolderChoice.tsx — fetches nothing, says nothing it must not", () => {
  const src = leafSource as string
  const codeOnly = src
    .split("\n")
    .filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*"))
    .join("\n")

  it("the swept source is the real file", () => {
    expect(src).toContain("export function AskFolderChoice")
    expect(codeOnly.length).toBeGreaterThan(400)
  })

  it("imports no API module and no folder picker that reads the user's whole folder list", () => {
    expect(src).not.toMatch(/@\/lib\/api/)
    for (const name of ["MoveToFolderDialog", "DescribeKbPicker", "FolderTree", "SourceFolderPicker", "listFolders"]) {
      expect(src, name).not.toContain(name)
    }
    expect(codeOnly).not.toMatch(/\bfetch\(/)
  })

  it("never-say sweep over its code", () => {
    for (const token of [
      "citations_required",
      "citation markers",
      "0/",
      "validator",
      "field_map",
      "aborted by user",
      "Proceed anyway",
      "Abort",
      "Proven",
      "N/A",
    ]) {
      expect(codeOnly, token).not.toContain(token)
    }
  })
})
