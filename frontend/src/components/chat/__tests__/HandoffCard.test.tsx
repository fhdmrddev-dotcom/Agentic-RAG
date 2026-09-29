/**
 * Phase 267 plan 04 (PACK-24 · D-267-15 / UI-SPEC §5.8) — the new thread's first message renders
 * as a handoff card, from the marker the backend wrote. Every word visible at rest.
 */
import { describe, expect, it } from "vitest"
import { render, screen, within } from "@testing-library/react"
// @ts-ignore — Vite `?raw` import, typed by vite/client at build time only.
import handoffMarkerRaw from "../../../../../backend/tests/fixtures/phase267/handoff_marker.json?raw"
import type { HandoffMarker } from "@/lib/api/threads"
import { HandoffCard } from "../HandoffCard"

const marker = JSON.parse(handoffMarkerRaw as string) as HandoffMarker

describe("HandoffCard", () => {
  it("(1) header names the source thread in curly quotes; one list item per summary line", () => {
    render(<HandoffCard marker={marker} />)
    const card = screen.getByTestId("handoff-card")
    const header = within(card).getByText("Handed off from “Q3 board prep”")
    expect(header).toBeVisible()
    const items = within(card).getAllByRole("listitem")
    expect(items.map((li) => li.textContent)).toEqual(marker.summary)
    for (const li of items) expect(li).toBeVisible()
  })

  it("(2) a long source title is truncated at 60 characters", () => {
    render(<HandoffCard marker={{ ...marker, source_title: "B".repeat(80) }} />)
    expect(screen.getByText(`Handed off from “${"B".repeat(60)}…”`)).toBeVisible()
  })

  it("(3) a legacy single-string summary renders one paragraph, no list", () => {
    render(<HandoffCard marker={{ ...marker, summary: "Just one line." as unknown as string[] }} />)
    const card = screen.getByTestId("handoff-card")
    expect(within(card).getByText("Just one line.").tagName).toBe("P")
    expect(within(card).queryByRole("list")).toBeNull()
  })
})
