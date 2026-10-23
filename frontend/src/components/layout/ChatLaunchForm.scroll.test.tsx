/**
 * 291 UAT S6 (2026-10-24) — the launch dialogs scroll their questions and keep Run in view.
 *
 * Live, the IRS W-9 workflow asked 23 questions: the Test Run dialog was 1561px tall in a 639px
 * window, its panel did not scroll, and Run could not be reached. jsdom has no layout, so this
 * suite pins the STRUCTURE that makes it reachable (a height-capped flex panel whose body is the
 * only scroll container, with Run outside that body). The live re-check is the proof.
 */
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import runModalSource from "@/components/workflows/library/RunModal?raw"

import { ChatLaunchForm } from "./ChatLaunchForm"

afterEach(cleanup)

const FIELDS = Array.from({ length: 23 }, (_, i) => ({ key: `field_${i}`, label: `Question ${i + 1}` }))

describe("ChatLaunchForm with a long form", () => {
  it("caps the panel at the window and scrolls only the questions; Run stays outside the scroll", () => {
    render(<ChatLaunchForm workflowName="Vendor W-9" fields={FIELDS} onConfirm={vi.fn()} onCancel={vi.fn()} />)
    const body = screen.getByTestId("chat-launch-body")
    expect(body.className).toContain("overflow-y-auto")
    expect(body.className).toContain("min-h-0")
    const panel = body.parentElement as HTMLElement
    expect(panel.className).toContain("max-h-[calc(100dvh-3rem)]")
    expect(panel.className).toContain("flex-col")
    const run = screen.getByTestId("chat-launch-confirm")
    expect(body.contains(run)).toBe(false)
    expect(screen.getAllByRole("textbox")).toHaveLength(23)
  })
})

describe("RunModal (library Run) — the same structure", () => {
  it("caps the panel and makes the body the scroll container", () => {
    expect(runModalSource).toContain(
      'className="flex max-h-[calc(100dvh-3rem)] w-[min(560px,92%)] flex-col overflow-hidden',
    )
    expect(runModalSource).toMatch(/data-testid="run-modal-body" className="[^"]*min-h-0[^"]*overflow-y-auto/)
  })
})
