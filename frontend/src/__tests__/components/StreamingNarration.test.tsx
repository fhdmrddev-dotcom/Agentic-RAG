import { describe, it, expect } from "vitest"
import { render, fireEvent } from "@testing-library/react"
import { StreamingNarration } from "@/components/chat/StreamingNarration"

describe("StreamingNarration — fold interim narration to a gist", () => {
  it("collapses to the latest line and expands to the full trail on click", () => {
    const content =
      "First I'll search the knowledge base.\nNext I'll generate the chart.\nNow I'll build the deck."
    const { container, getByTestId } = render(<StreamingNarration content={content} />)

    // Collapsed by default: the gist is the LAST line; the full body is hidden.
    const trigger = getByTestId("streaming-narration-trigger")
    expect(trigger.textContent).toContain("Now I'll build the deck.")
    expect(trigger.getAttribute("aria-expanded")).toBe("false")
    expect(container.querySelector("[data-testid='streaming-narration-body']")).toBeNull()

    // Click → the full narration (all lines) is revealed.
    fireEvent.click(trigger)
    expect(trigger.getAttribute("aria-expanded")).toBe("true")
    const body = getByTestId("streaming-narration-body")
    expect(body.textContent).toContain("First I'll search the knowledge base.")
    expect(body.textContent).toContain("Now I'll build the deck.")
  })

  it("strips markdown markers from the one-line gist preview", () => {
    const content = "## Step 1\n- **Now** I'll `render` the slides"
    const { getByTestId } = render(<StreamingNarration content={content} />)
    const trigger = getByTestId("streaming-narration-trigger")
    expect(trigger.textContent).toContain("Now I'll render the slides")
    expect(trigger.textContent).not.toContain("**")
    expect(trigger.textContent).not.toContain("`")
  })

  it("renders nothing for empty / whitespace-only content", () => {
    const { container } = render(<StreamingNarration content={"   \n  "} />)
    expect(container.firstChild).toBeNull()
  })
})
