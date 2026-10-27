/**
 * Phase 296-07 Task 3 — governance, library and panel rows, each driven RED first.
 *
 *  - BUG-261021-05 (D-04 amended, option b): only `detected` claims a citations check. An
 *    escalated step carries no seal, no locked gate row and no attached-gate line; it says, in
 *    words, that nothing is checked when it runs
 *  - 288-F-4 / 291-S6-F7: the gauntlet hands the auto-answered notes up with the version, and
 *    renders a `phase: null` note without a step prefix (the library strip is in
 *    `WorkflowsPage.test.tsx`, which owns that page's scaffolding)
 *  - 291-S3-F2: a bound form's field rows read as labels, the raw name only in `title`
 *  - 291-S3-F3: Replace under a bound PDF accepts a PDF
 *  - 287-IN-02: an empty label never yields ` is required`
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { toCanvas } from "../canvasModel"
import { NodeCornerMarks } from "../NodeCornerMarks"
import { GovernanceSection } from "../GovernanceSection"
import * as definitionOps from "../definitionOps"
import { PublishGauntlet } from "../PublishGauntlet"
import { TemplateAttachSection } from "../TemplateAttachSection"
import { requiredFieldsMessage } from "../soulData"
import type { PhaseSpecJSON } from "../phaseVocabulary"
import { publishWorkflow, type PublishOutcome } from "@/lib/api"

import builderSource from "@/pages/WorkflowBuilderPage?raw"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, publishWorkflow: vi.fn() }
})

const { placeholders } = vi.hoisted(() => ({
  placeholders: { current: { kind: "fields", fields: ["topmostSubform[0].Page1[0].f1_01[0]"] } as unknown },
}))
vi.mock("@/hooks/useTemplatePlaceholders", () => ({
  useTemplatePlaceholders: () => placeholders.current,
}))

const mockedPublish = vi.mocked(publishWorkflow)

beforeEach(() => mockedPublish.mockReset())
afterEach(() => cleanup())

const KB = ["search_documents"]

// ── BUG-261021-05 (b) ─────────────────────────────────────────────────────────────────────

describe("BUG-261021-05 (D-04 amended b) — only `detected` claims a check", () => {
  const escalated: PhaseSpecJSON = {
    slug: "think",
    phase_index: 0,
    config: { phase_type: "llm_agent" },
    grounding_escalated: true,
  } as PhaseSpecJSON
  const detected: PhaseSpecJSON = {
    slug: "look",
    phase_index: 0,
    config: { phase_type: "llm_agent", available_tools: ["search_documents"] },
  } as PhaseSpecJSON

  const groundedOf = (p: PhaseSpecJSON) =>
    (toCanvas([p], { kbTools: KB }).nodes[0]?.data as { grounded?: boolean }).grounded

  it("an escalated step is not grounded on the canvas; a detected one still is", () => {
    expect(groundedOf(escalated)).toBe(false)
    expect(groundedOf(detected)).toBe(true)
    // `already-set` (a deliverable's own strict citation policy) is enforced by the engine too.
    const strictEmit = {
      slug: "brief",
      phase_index: 0,
      config: { phase_type: "llm_emit", citation_policy: "strict" },
    } as PhaseSpecJSON
    expect(groundedOf(strictEmit)).toBe(true)
  })

  it("so the corner seal does not render for it", () => {
    render(<NodeCornerMarks grounded={groundedOf(escalated)} />)
    expect(screen.queryByTestId("canvas-node-seal")).toBeNull()
    cleanup()
    render(<NodeCornerMarks grounded={groundedOf(detected)} />)
    expect(screen.getByTestId("canvas-node-seal")).toBeInTheDocument()
  })

  it("the panel shows no attached gate for escalated, and says nothing is checked", () => {
    const sentence = (definitionOps as Record<string, unknown>).GOVERNANCE_ESCALATED_UNCHECKED
    expect(sentence).toBe(
      "Marked to prove its sources, but this step can't search your documents, so nothing is checked when it runs.",
    )
    render(
      <GovernanceSection
        phaseType="llm_agent"
        availableTools={[]}
        kbTools={KB}
        groundingEscalated
        actionRiskArmed={false}
      />,
    )
    expect(screen.queryByTestId("governance-attached")).toBeNull()
    expect(screen.getByTestId("governance-escalated-no-check").textContent).toBe(sentence)
  })

  it("detected is unchanged: the attached gate still renders", () => {
    render(
      <GovernanceSection
        phaseType="llm_agent"
        availableTools={["search_documents"]}
        kbTools={KB}
        groundingEscalated={false}
        actionRiskArmed={false}
      />,
    )
    expect(screen.getByTestId("governance-attached")).toBeInTheDocument()
    expect(screen.queryByTestId("governance-escalated-no-check")).toBeNull()
  })

  it("the builder's gate rows claim `detected` only", () => {
    expect(builderSource).not.toContain('cause === "escalated"')
    const gates = builderSource.match(/function gatesFor\([\s\S]*?\n\}/)?.[0] ?? ""
    expect(gates.length).toBeGreaterThan(50)
    expect(gates).toContain('cause === "detected"')
  })
})

// ── 288-F-4 / 291-S6-F7 (the gauntlet half) ───────────────────────────────────────────────

describe("288-F-4 / 291-S6-F7 — the auto-answered notes travel with the success", () => {
  const STAND_IN = "The practice run had no example for Topic, so it used a stand-in answer for it."

  it("onPublished receives the version AND every note, verbatim; a phase:null note has no prefix", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: {
        published: true,
        version: 3,
        golden_run_id: "r1",
        blocked_stage: null,
        named_failures: [],
        auto_answered: [
          { phase: "approve", message: "A" },
          { phase: null, message: STAND_IN },
        ],
      },
    } satisfies PublishOutcome)
    const onPublished = vi.fn()
    render(<PublishGauntlet definitionId="def-1" onPublished={onPublished} />)
    const user = userEvent.setup()
    await user.click(screen.getByTestId("publish-trigger"))
    await user.type(await screen.findByLabelText(/golden_input/i), "a representative kickoff")
    await user.click(screen.getByRole("button", { name: /run the checks/i }))
    await waitFor(() => expect(onPublished).toHaveBeenCalledTimes(1))
    expect(onPublished).toHaveBeenCalledWith(3, ["A", STAND_IN])
    const block = await screen.findByTestId("auto-answered")
    const lines = within(block).getAllByText(/./).map((p) => p.textContent)
    expect(lines).toEqual(["A", STAND_IN])
  })
})

// ── 291-S3-F2 / 291-S3-F3 ─────────────────────────────────────────────────────────────────

describe("291-S3-F2 / F3 — a bound form reads as labels, and Replace takes a PDF", () => {
  const RAW = "topmostSubform[0].Page1[0].f1_01[0]"

  it("a raw AcroForm name shows the declared input's label; the raw name only in title", () => {
    render(
      <TemplateAttachSection
        definitionId="def-1"
        filename="w9.pdf"
        assetId="u/_library/def-1/w9.pdf"
        onAttached={() => {}}
        {...({ declaredInputs: [{ key: "legal_name", label: "Legal name", fills: [RAW] }] } as Record<string, unknown>)}
      />,
    )
    const list = screen.getByTestId("template-fields")
    const item = within(list).getByRole("listitem")
    expect(item.textContent).toBe("Legal name")
    expect(item.getAttribute("title")).toBe(RAW)
    expect(list.textContent).not.toContain(RAW)
  })

  it("Replace under a bound PDF accepts .pdf and says so", () => {
    render(
      <TemplateAttachSection
        definitionId="def-1"
        filename="w9.pdf"
        assetId="u/_library/def-1/w9.pdf"
        onAttached={() => {}}
      />,
    )
    expect(screen.getByTestId("template-input").getAttribute("accept")).toBe(".pdf,.docx,.pptx,.xlsx")
    expect(screen.getByTestId("template-types").textContent).toBe(
      "A fillable PDF, or Word, PowerPoint or Excel — .pdf, .docx, .pptx or .xlsx, up to 10 MB.",
    )
  })

  it("under a non-PDF template the accept list is unchanged", () => {
    placeholders.current = { kind: "fields", fields: ["client"] }
    render(
      <TemplateAttachSection
        definitionId="def-1"
        filename="letter.docx"
        assetId="u/_library/def-1/letter.docx"
        onAttached={() => {}}
      />,
    )
    expect(screen.getByTestId("template-input").getAttribute("accept")).toBe(".docx,.pptx,.xlsx")
  })
})

// ── 287-IN-02 ─────────────────────────────────────────────────────────────────────────────

describe("287-IN-02 — an empty label falls back to the key", () => {
  it("never ` is required`", () => {
    expect(requiredFieldsMessage([{ key: "recipient", label: "" } as never])).toBe("recipient is required")
    expect(requiredFieldsMessage([{ key: "recipient", label: "   " } as never])).toBe("recipient is required")
    expect(requiredFieldsMessage([{ key: "recipient", label: "Recipient" } as never])).toBe(
      "Recipient is required",
    )
  })
})
