import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup, fireEvent } from "@testing-library/react"
import { IngestionBatchLane } from "../IngestionBatchLane"

afterEach(() => {
  cleanup()
})

describe("IngestionBatchLane (Sketch 227 Variant B)", () => {
  it("renders 34 batch lane bars", () => {
    render(<IngestionBatchLane totalFiles={340} completedFiles={218} />)
    const lane = screen.getByTestId("batch-lane-bars")
    expect(lane.children.length).toBe(34)
  })

  it("displays real countable file counts and legend without ETA or percentages (D-217-19)", () => {
    render(<IngestionBatchLane totalFiles={340} completedFiles={218} />)
    
    // Discrete countable files
    const fileCount = screen.getByTestId("lane-file-count")
    expect(fileCount).toHaveTextContent("218 of 340 files")
    expect(screen.getByText(/each bar ≈ 10 files/)).toBeInTheDocument()

    // ⛔ Strict D-217-19 check: No percentage and no time ETA
    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.queryByText(/\b(eta|min left|sec left|remaining time)\b/i)).toBeNull()
  })

  it("renders working state pill when active, and paused pill when held", () => {
    const { rerender } = render(<IngestionBatchLane totalFiles={340} completedFiles={218} isPaused={false} />)
    expect(screen.getByTestId("lane-status-pill")).toHaveTextContent("● Working")

    rerender(<IngestionBatchLane totalFiles={340} completedFiles={218} isPaused={true} />)
    expect(screen.getByTestId("lane-status-pill")).toHaveTextContent("⏸ Paused")
  })

  it("supports the calm / energized motion toggle", () => {
    render(<IngestionBatchLane totalFiles={340} completedFiles={218} />)
    const root = screen.getByTestId("ingestion-batch-lane")
    expect(root.style.getPropertyValue("--energy")).toBe("1")

    const calmBtn = screen.getByRole("button", { name: "Calm" })
    fireEvent.click(calmBtn)
    expect(root.style.getPropertyValue("--energy")).toBe("0")

    const energizedBtn = screen.getByRole("button", { name: "Energized" })
    fireEvent.click(energizedBtn)
    expect(root.style.getPropertyValue("--energy")).toBe("1")
  })
})
