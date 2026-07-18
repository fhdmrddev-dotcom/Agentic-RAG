/**
 * Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §2, D-08) — EnvironmentDetectCard contract.
 *
 * Locks the light-detect rules:
 *   • four read-only tiles (in Docker / config found / DB reachable / Redis reachable);
 *   • a null detect (not yet probed) reads a neutral em-dash on every tile — NEVER red;
 *   • a `false` signal reads a NEUTRAL word ("No" / "Not yet"), never destructive/red
 *     (D-08: this step only orients — nothing has failed yet);
 *   • Continue emits onContinue.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { EnvironmentDetectCard } from "../EnvironmentDetectCard"
import type { DetectResult } from "@/lib/setupApi"

afterEach(() => cleanup())

describe("EnvironmentDetectCard (D-08) — read-only orienting tiles, never red", () => {
  it("null detect renders a neutral em-dash on every tile (no red)", () => {
    const { container } = render(<EnvironmentDetectCard detect={null} onContinue={vi.fn()} />)

    // Four tiles, each showing the neutral unknown em-dash.
    expect(screen.getByText("Running in Docker")).toBeInTheDocument()
    expect(screen.getAllByText("—")).toHaveLength(4)
    // A not-yet-probed environment is never an alarm.
    expect(container.querySelector(".bg-destructive")).toBeNull()
  })

  it("renders the honest plain words from the detect result — a `false` reads neutral, never red", () => {
    const detect: DetectResult = {
      in_docker: true,
      store_present: false,
      db_reachable: true,
      redis_reachable: false,
    }
    const { container } = render(<EnvironmentDetectCard detect={detect} onContinue={vi.fn()} />)

    expect(screen.getByText("Yes")).toBeInTheDocument() // in_docker true
    expect(screen.getByText("None yet")).toBeInTheDocument() // store_present false → neutral
    expect(screen.getByText("Reachable")).toBeInTheDocument() // db_reachable true
    expect(screen.getByText("Not yet")).toBeInTheDocument() // redis_reachable false → neutral
    // No red anywhere — a false detect signal is neutral (Pitfall 6 / D-08).
    expect(container.querySelector(".bg-destructive")).toBeNull()
  })

  it("carries an aria-live status region and the honest 'nothing changed yet' caption", () => {
    render(<EnvironmentDetectCard detect={null} onContinue={vi.fn()} />)
    expect(screen.getByText(/nothing is changed yet/i)).toBeInTheDocument()
    // The tiles announce as a live status region (a11y — not colour-alone).
    expect(screen.getByRole("status")).toBeInTheDocument()
  })

  it("Continue emits onContinue", async () => {
    const user = userEvent.setup()
    const onContinue = vi.fn()
    render(<EnvironmentDetectCard detect={null} onContinue={onContinue} />)

    await user.click(screen.getByRole("button", { name: /continue/i }))
    expect(onContinue).toHaveBeenCalledTimes(1)
  })
})
