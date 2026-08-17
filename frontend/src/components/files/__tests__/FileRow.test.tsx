/**
 * Phase 195 Plan 03 Task 3 — the ONE shared file row.
 *
 * ⚠ EVERY COLOUR-ADJACENT ASSERTION IN THIS FILE IS ON A CLASS / TOKEN NAME,
 * NEVER ON A RESOLVED `rgb()`. jsdom renders the DARK theme, where
 * `--muted-foreground` and `--panel-muted-foreground` are IDENTICAL
 * (`index.css:105` / `:151`, both `220 16% 65%`); they diverge ONLY in light
 * (`:30` `220 9% 46%` vs `:59` `220 12% 40%`), which is where the panel token's
 * whole reason for existing lives (`PanelSection.tsx:85`: light
 * `--muted-foreground` measured 4.01:1, BELOW the 4.5:1 AA floor). A
 * resolved-colour fence would therefore pass green here while a light-theme AA
 * regression shipped. And for the same reason: a dark-theme visual diff showing
 * "no change" is NOT evidence this change was safe.
 *
 * What the blocks defend:
 *  · the three shipped densities render icon / name / size, and the size cell is
 *    ABSENT (not "0 B", not empty) when `sizeBytes` is omitted
 *  · `asChild` really MERGES onto the caller's element rather than nesting —
 *    the property that lets one markup be a BUTTON, a DIV[role=option] and an A
 *  · ref forwarding — the panel's roving-focus `Map` contract
 *  · the DEAD affordance is a `<span>` with ZERO `<button>`, which is the only
 *    reason `WorkflowRunPage.test.tsx:991`'s absence fence survives plan 06
 */
import { describe, it, expect } from "vitest"
import { createRef } from "react"
import { render } from "@testing-library/react"
import { FileRow } from "../FileRow"

const DENSITIES = ["chat", "panel", "run"] as const

describe("FileRow — the three shipped densities", () => {
  for (const density of DENSITIES) {
    it(`${density}: renders the icon, the name and the size`, () => {
      const { container, getByText } = render(
        <FileRow density={density} name="q3-report.pptx" sizeBytes={376} />,
      )
      expect(container.querySelector("svg")).toBeTruthy()
      expect(getByText("q3-report.pptx")).toBeTruthy()
      expect(getByText("376 B")).toBeTruthy()
    })

    it(`${density}: the size cell is ABSENT when sizeBytes is omitted`, () => {
      const { container } = render(<FileRow density={density} name="q3.pptx" />)
      expect(container.textContent).not.toContain(" B")
      expect(container.textContent).not.toContain("KB")
    })

    it(`${density}: sizeBytes={0} still renders "0 B" (omitted != zero)`, () => {
      const { getByText } = render(<FileRow density={density} name="empty.txt" sizeBytes={0} />)
      expect(getByText("0 B")).toBeTruthy()
    })
  }

  it("chat renders the .EXT ribbon; panel and run do NOT (the F10 density delta)", () => {
    // ⚠ CONTAINER-SCOPED, deliberately. `render()`'s own `queryByText` is bound
    // to `baseElement` (document.body), which is SHARED across renders in one
    // case — so the panel arm read the CHAT arm's ribbon and this case failed
    // first time for a reason that had nothing to do with the component. A
    // fence that measures the wrong tree is worse than no fence.
    const chat = render(<FileRow density="chat" name="deck.pptx" />)
    expect(chat.container.textContent).toContain(".PPTX")
    const panel = render(<FileRow density="panel" name="deck.pptx" />)
    expect(panel.container.textContent).not.toContain(".PPTX")
    const run = render(<FileRow density="run" name="deck.pptx" />)
    expect(run.container.textContent).not.toContain(".PPTX")
  })

  it("exactly ONE glyph element renders inside the icon wrapper", () => {
    const { container } = render(<FileRow density="run" name="deck.pptx" sizeBytes={10} />)
    const wrapper = container.querySelector("span")
    expect(wrapper?.querySelectorAll("svg")).toHaveLength(1)
  })

  it("the panel density carries the panel-scoped AA TOKEN CLASS (not a resolved colour)", () => {
    // ⚠ CLASS, not `rgb()` — see the file header. In jsdom's dark theme the two
    // tokens resolve identically, so only the class name can tell them apart.
    const { container } = render(<FileRow density="panel" name="a.txt" sizeBytes={10} />)
    expect(container.innerHTML).toContain("text-panel-muted-foreground")
  })

  it("the run density carries the PAGE token and never the panel-scoped one", () => {
    // `WorkflowRunPage.test.tsx:1428-1429` forbids `--panel-` in page source;
    // the run density must not smuggle a panel token in through this component.
    const { container } = render(<FileRow density="run" name="a.txt" sizeBytes={10} />)
    expect(container.innerHTML).toContain("text-muted-foreground")
    expect(container.innerHTML).not.toContain("text-panel-muted-foreground")
  })
})

describe("FileRow — metaSuffix, supersedes, errorText", () => {
  it("metaSuffix appends INSIDE the size cell", () => {
    const { getByText } = render(
      <FileRow density="panel" name="a.txt" sizeBytes={376} metaSuffix=" · v2" />,
    )
    expect(getByText("376 B · v2")).toBeTruthy()
  })

  it("metaSuffix is NOT rendered when there is no size cell to hold it", () => {
    const { container } = render(<FileRow density="panel" name="a.txt" metaSuffix=" · v2" />)
    expect(container.textContent).not.toContain("v2")
  })

  it("supersedes renders the 'Replaces: …' subline", () => {
    const { getByText } = render(
      <FileRow density="chat" name="v2.pptx" supersedes="v1.pptx" />,
    )
    expect(getByText(/Replaces:/)).toBeTruthy()
    expect(getByText(/v1\.pptx/)).toBeTruthy()
  })

  it("no supersedes → no 'Replaces:' text at all", () => {
    const { container } = render(<FileRow density="chat" name="v2.pptx" />)
    expect(container.textContent).not.toContain("Replaces:")
  })

  it("errorText renders in-row; null renders nothing", () => {
    const shown = render(<FileRow density="chat" name="a.txt" errorText="Download failed — try again." />)
    expect(shown.getByText("Download failed — try again.")).toBeTruthy()
    const hidden = render(<FileRow density="chat" name="a.txt" errorText={null} />)
    expect(hidden.container.textContent).not.toContain("Download failed")
  })
})

describe("FileRow — the trailing affordance", () => {
  it('trailing="download" renders a glyph and ZERO <button> elements', () => {
    const { container } = render(<FileRow density="run" name="a.txt" trailing="download" />)
    expect(container.querySelectorAll("svg").length).toBeGreaterThanOrEqual(2)
    expect(container.querySelectorAll("button")).toHaveLength(0)
  })

  it('trailing="spinner" renders the spinning glyph', () => {
    const { container } = render(<FileRow density="chat" name="a.txt" trailing="spinner" />)
    expect(container.querySelector(".animate-spin")).toBeTruthy()
  })

  it('trailing="none" renders neither a download glyph nor the dead affordance', () => {
    const { container } = render(<FileRow density="run" name="a.txt" trailing="none" />)
    expect(container.querySelector('[aria-disabled="true"]')).toBeNull()
    expect(container.textContent).not.toContain("Download unavailable")
  })

  it('⚠ trailing="dead" is a <span aria-disabled="true"> with ZERO <button> elements', () => {
    // This is the case that keeps `WorkflowRunPage.test.tsx:991` satisfiable
    // after plan 06 gives the id-less run row this affordance. A dead
    // affordance is a statement of fact, not a control.
    const { container } = render(<FileRow density="run" name="a.txt" trailing="dead" />)
    const affordance = container.querySelector('[aria-disabled="true"]')
    expect(affordance).toBeTruthy()
    expect(affordance?.tagName).toBe("SPAN")
    expect(container.querySelectorAll("button")).toHaveLength(0)
  })

  it('trailing="dead" carries the exact shipped title and copy', () => {
    const { container, getByText } = render(
      <FileRow density="chat" name="a.txt" trailing="dead" />,
    )
    expect(getByText("Download unavailable")).toBeTruthy()
    expect(container.querySelector('[aria-disabled="true"]')?.getAttribute("title")).toBe(
      "Download unavailable — this file has no link",
    )
  })

  it("the dead affordance stays a span even when the row root IS a button (asChild)", () => {
    const { container } = render(
      <FileRow asChild density="run" name="a.txt" trailing="dead">
        <button type="button" />
      </FileRow>,
    )
    // exactly the caller's own button, and none introduced by the affordance
    expect(container.querySelectorAll("button")).toHaveLength(1)
    expect(container.querySelector('[aria-disabled="true"]')?.tagName).toBe("SPAN")
  })
})

describe("FileRow — the chat dead SKIN is per-density (deadOverrides)", () => {
  it('density="chat" + trailing="dead" dims the icon wrapper AND the name', () => {
    const { container, getByText } = render(
      <FileRow density="chat" name="a.txt" trailing="dead" />,
    )
    expect(container.innerHTML).toContain("opacity-70")
    expect((getByText("a.txt") as HTMLElement).className).toContain("text-foreground/60")
  })

  it('⚠ density="run" + trailing="dead" does NOT dim — the run row gains the affordance and NOTHING else', () => {
    // The two-arm assertion that pins `deadOverrides`. This is the whole of the
    // delta plan 06 ships: an affordance, not a restyle.
    const { container, getByText } = render(
      <FileRow density="run" name="a.txt" trailing="dead" />,
    )
    expect(container.innerHTML).not.toContain("opacity-70")
    expect((getByText("a.txt") as HTMLElement).className).not.toContain("text-foreground/60")
  })

  it('density="panel" + trailing="dead" likewise does not dim', () => {
    const { container } = render(<FileRow density="panel" name="a.txt" trailing="dead" />)
    expect(container.innerHTML).not.toContain("opacity-70")
  })
})

describe("FileRow — asChild supplies the wrapper ELEMENT (three roots, one markup)", () => {
  it("an <a href download> child becomes the ROOT and keeps its own attributes", () => {
    const { container, getByText } = render(
      <FileRow asChild density="chat" name="q3.pptx" sizeBytes={376} trailing="download">
        <a href="/files/q3.pptx" download="q3.pptx" target="_blank" rel="noopener noreferrer" />
      </FileRow>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.tagName).toBe("A")
    expect(root.getAttribute("href")).toBe("/files/q3.pptx")
    expect(root.getAttribute("download")).toBe("q3.pptx")
    // the row's own children really merged INTO the anchor, not beside it
    expect(root.contains(getByText("q3.pptx"))).toBe(true)
  })

  it("a <button type=button> child becomes the ROOT", () => {
    const { container } = render(
      <FileRow asChild density="run" name="a.txt">
        <button type="button" />
      </FileRow>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.tagName).toBe("BUTTON")
    expect(root.getAttribute("type")).toBe("button")
  })

  it('a <div role="option" tabIndex={0}> child becomes the ROOT and keeps role + tabindex', () => {
    const { container } = render(
      <FileRow asChild density="panel" name="out/a.txt">
        <div role="option" aria-selected={true} tabIndex={0} />
      </FileRow>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.getAttribute("role")).toBe("option")
    expect(root.getAttribute("tabindex")).toBe("0")
    expect(root.getAttribute("aria-selected")).toBe("true")
  })

  it("WITHOUT asChild the root is a plain <div> (the default fallback)", () => {
    const { container } = render(<FileRow density="run" name="a.txt" />)
    expect((container.firstElementChild as HTMLElement).tagName).toBe("DIV")
  })

  it("⚠ asChild MERGES rather than NESTS — there is no wrapper div around the caller's element", () => {
    const { container } = render(
      <FileRow asChild density="run" name="a.txt">
        <button type="button" />
      </FileRow>,
    )
    // Without <Slottable>, the caller's element would render as a CHILD of the
    // row instead of becoming the row — so the root would be a DIV and the
    // button would be nested inside it.
    expect(container.children).toHaveLength(1)
    expect((container.firstElementChild as HTMLElement).tagName).toBe("BUTTON")
    expect(container.querySelector("button > button")).toBeNull()
  })
})

describe("FileRow — ref forwarding (the panel's roving-focus contract)", () => {
  it("a ref passed with asChild resolves to the CALLER's element", () => {
    // `FilesSection.tsx:109`/`:221-223` store row elements in a Map to drive
    // arrow-key focus; a row that swallowed the ref would break keyboard
    // navigation silently, and only for keyboard users.
    const ref = createRef<HTMLElement>()
    render(
      <FileRow asChild density="panel" name="a.txt" ref={ref}>
        <button type="button" />
      </FileRow>,
    )
    expect(ref.current?.tagName).toBe("BUTTON")
  })

  it("a ref passed WITHOUT asChild resolves to the fallback div", () => {
    const ref = createRef<HTMLElement>()
    render(<FileRow density="panel" name="a.txt" ref={ref} />)
    expect(ref.current?.tagName).toBe("DIV")
  })
})

describe("FileRow — className merge order (Radix JOINS, it does not twMerge)", () => {
  it("the caller's class AND the row's layout class are both present on the SAME element", () => {
    // Catches a future twMerge assumption: `mergeProps` does
    // `[slotProps, childProps].filter(Boolean).join(" ")`, so both survive and
    // the row must therefore own LAYOUT ONLY.
    const { container } = render(
      <FileRow asChild density="run" name="a.txt" className="rounded-md px-2 py-2 hover:bg-accent">
        <button type="button" className="w-full text-left" />
      </FileRow>,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.className).toContain("flex")       // the row's layout
    expect(root.className).toContain("items-center")
    expect(root.className).toContain("px-2")        // the caller's padding
    expect(root.className).toContain("w-full")      // the caller's own child class
  })

  it("the row contributes NO padding, border, background or width of its own", () => {
    // The property that lets all three shipped rows survive adoption unchanged.
    const { container } = render(<FileRow density="run" name="a.txt" />)
    const root = container.firstElementChild as HTMLElement
    expect(root.className).not.toMatch(/\bp[xy]?-\d/)
    expect(root.className).not.toMatch(/\bborder\b/)
    expect(root.className).not.toMatch(/\bbg-/)
    expect(root.className).not.toMatch(/\bw-full\b/)
  })
})

describe("FileRow — trailingSlot", () => {
  it("trailingSlot renders BEFORE the size cell in DOM order", () => {
    const { container, getByTestId, getByText } = render(
      <FileRow
        density="panel"
        name="a.txt"
        sizeBytes={376}
        trailingSlot={<span data-testid="badge">Template</span>}
      />,
    )
    const badge = getByTestId("badge")
    const size = getByText("376 B")
    // Node.DOCUMENT_POSITION_FOLLOWING === 4
    expect(badge.compareDocumentPosition(size) & 4).toBeTruthy()
    expect(container.textContent).toContain("Template")
  })

  it("no trailingSlot renders nothing extra", () => {
    const { container } = render(<FileRow density="panel" name="a.txt" sizeBytes={376} />)
    expect(container.textContent).not.toContain("Template")
  })
})

describe("FileRow — XSS (T-195-03-01): every string prop is a TEXT child", () => {
  it("a hostile name and supersedes render as LITERAL TEXT with no injected element", () => {
    const hostile = "<img src=x onerror=alert(1)>"
    const { container, getByText } = render(
      <FileRow density="chat" name={hostile} supersedes={hostile} />,
    )
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("script")).toBeNull()
    expect(getByText(hostile)).toBeTruthy()
  })

  it("a hostile metaSuffix and errorText likewise render as literal text", () => {
    const hostile = "<img src=x onerror=alert(1)>"
    const { container } = render(
      <FileRow density="panel" name="a.txt" sizeBytes={1} metaSuffix={hostile} errorText={hostile} />,
    )
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent).toContain(hostile)
  })
})
