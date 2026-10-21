/**
 * Phase 290-01 (VIS-01 / D-06) — THE CHARACTERIZATION PIN FOR THE CANVAS HEADER.
 *
 * Written and committed against the UNCHANGED canvas, BEFORE 290-03 gives the header its
 * `Steps | Team` switch. 290-03 must leave this file and its `.snap` byte-unchanged (empty
 * numstat): with NO team prop the header must render exactly as it does today. If a line
 * here has to change for 290-03 to pass, the change altered the shipped header and the
 * SOURCE is wrong, not this pin.
 *
 * What it pins: `section.firstElementChild.outerHTML` (the header div, shared by both the
 * empty and the non-empty branch), for a non-empty definition × editable on/off × the
 * ⌥ Technical-names provider on/off, and for the empty draft × editable on/off without the
 * provider. Nothing is normalised.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render } from "@testing-library/react"

// FILE-LOCAL, never setupTests.ts — the helper mutates HTMLElement.prototype. Call it
// before the first render.
import { mockReactFlow } from "@/test-utils/mockReactFlow"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"
import { WorkflowCanvas } from "../WorkflowCanvas"
import { emptyDraft, researchSummarize } from "../__fixtures__/canvasFixtures"
import type { PhaseSpecJSON } from "../phaseVocabulary"

mockReactFlow()

beforeEach(() => {
  // The ⌥ reveal persists to localStorage; a leaked value would change the toggle's state.
  window.localStorage.clear()
})

function headerHtml(phases: PhaseSpecJSON[], editable: boolean, provider: boolean): string {
  const ui = (
    <div style={{ width: 1200, height: 800 }}>
      <WorkflowCanvas
        phases={phases}
        selectedSlug={null}
        onSelectNode={vi.fn()}
        onClearSelection={vi.fn()}
        editable={editable}
      />
    </div>
  )
  const { container, unmount } = render(
    provider ? <TechnicalNamesProvider>{ui}</TechnicalNamesProvider> : ui,
  )
  const section = container.querySelector("section")
  expect(section, "the canvas renders its section").not.toBeNull()
  const header = section!.firstElementChild
  expect(header, "the section has a header").not.toBeNull()
  const html = header!.outerHTML
  unmount()
  return html
}

describe("WorkflowCanvas header — pinned before 290-03 (no team prop)", () => {
  for (const editable of [false, true]) {
    for (const provider of [false, true]) {
      it(`researchSummarize · editable=${editable} · technicalNames=${provider}`, () => {
        expect(headerHtml(researchSummarize, editable, provider)).toMatchSnapshot()
      })
    }
  }

  for (const editable of [false, true]) {
    it(`emptyDraft · editable=${editable} · technicalNames=false`, () => {
      expect(headerHtml(emptyDraft, editable, false)).toMatchSnapshot()
    })
  }
})
