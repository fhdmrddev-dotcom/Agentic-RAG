/**
 * Phase 193 (AUTH-03, piece 2 of 3) — the template door's proofs.
 *
 * ⚠ THIS FILE IS REGISTERED WITH `scripts/vitest-count-gate.cjs` IN THE COMMIT THAT CREATES
 * IT, the rule `ExternalActionSection.test.tsx:12` states verbatim and `ConnectionPicker.test.tsx`
 * followed. `src/components/workflows` is already a TARGETS **directory** entry, so this suite
 * RUNS the moment it exists; the BASELINE pin is what makes it GUARDED rather than merely
 * executed. An unpinned file is not lightly guarded — it is unguarded (188-12).
 *
 * ── WHY THE STORE BLOCK IS HERE AND NOT IN `builderStore.test.ts` ────────────────────────
 * `setTemplateAsset` is the receiving half of this control and belongs beside it, but that is
 * not the whole reason. `builderStore.test.ts` is pinned at 52 against an actual of 58 — a
 * pre-existing +6 drift ten consecutive plans have declined to absorb (the gate's own notes
 * say so) — so adding cases there would force this plan either to re-pin and silently swallow
 * somebody else's six, or to leave the file under-pinned. Neither is this plan's call to make.
 *
 * ── WHAT THIS SUITE EXISTS TO CATCH ──────────────────────────────────────────────────────
 *  - a status code shown at a person instead of a sentence they can act on;
 *  - a 404 relayed as the server's words, inventing a not-found/not-yours distinction the
 *    server deliberately refuses to make;
 *  - the control claiming a template is attached when the DEFINITION does not carry one
 *    (there is no local mirror, and this suite is what keeps it that way);
 *  - `setTemplateAsset` APPENDING a second `kind: "template"` entry, where `.find(…)` — the
 *    read both `nameContext` and the run engine's Branch 1 use — silently keeps the OLD one;
 *  - a definition-level write that does not arm `dirty`, which the leave guard cannot see.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"

// Keep the real `api.ts` module-load from constructing a client against a real URL — the
// `PendingAskCard.test.tsx` idiom, required because the partial mock below imports it for real.
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "user-1" }, access_token: "token" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

// PARTIAL mock, on purpose: only the network call is faked. `WorkflowTemplateUploadError`
// stays the REAL class so `templateErrorSentence`'s `instanceof` branch is exercised against
// the true class identity — a locally re-declared stand-in would let the real constructor's
// field assignment drift from the mapping that reads it (the 096-04 lesson).
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, uploadWorkflowTemplate: vi.fn() }
})
import { uploadWorkflowTemplate, WorkflowTemplateUploadError } from "@/lib/api"
import type { WorkflowTemplateAsset } from "@/lib/api"

import {
  TemplateAttachSection,
  TEMPLATE_ACCEPT,
  TEMPLATE_ATTACH_LABEL,
  TEMPLATE_NETWORK_ERROR,
  TEMPLATE_NONE_NOTE,
  TEMPLATE_NOT_FOUND_ERROR,
  TEMPLATE_REFUSED_FALLBACK,
  TEMPLATE_REPLACE_LABEL,
  TEMPLATE_UNSAVED_REFUSAL,
} from "./TemplateAttachSection"
import { createBuilderStore } from "./builderStore"

const uploadMock = vi.mocked(uploadWorkflowTemplate)

const DEF_ID = "9c8d7e66-1111-2222-3333-444455556666"
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

const ASSET: WorkflowTemplateAsset = {
  kind: "template",
  asset_id: `3f2b0a11/_library/${DEF_ID}/a1b2c3d4-Q3 Report _final_.docx`,
  filename: "Q3 Report _final_.docx",
  mime: DOCX_MIME,
}

function aFile(name = "Q3 Report (final).docx"): File {
  return new File(["PK"], name, { type: DOCX_MIME })
}

function pick(file: File = aFile()) {
  const input = screen.getByTestId("template-input") as HTMLInputElement
  fireEvent.change(input, { target: { files: [file] } })
}

beforeEach(() => {
  uploadMock.mockReset()
})

describe("193 AUTH-03 — the two readings the author must be able to tell apart", () => {
  it("says plainly that nothing is attached, and offers to attach", () => {
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />)

    expect(screen.getByTestId("rail-template")).toHaveAttribute("data-attached", "false")
    expect(screen.getByTestId("template-none")).toHaveTextContent(TEMPLATE_NONE_NOTE)
    expect(screen.getByText(TEMPLATE_ATTACH_LABEL)).toBeInTheDocument()
    expect(screen.queryByText(TEMPLATE_REPLACE_LABEL)).not.toBeInTheDocument()
  })

  it("shows the attached filename verbatim, and the label becomes a REPLACE", () => {
    render(
      <TemplateAttachSection definitionId={DEF_ID} filename="Q3 Report _final_.docx" onAttached={vi.fn()} />,
    )

    expect(screen.getByTestId("rail-template")).toHaveAttribute("data-attached", "true")
    expect(screen.getByTestId("template-filename")).toHaveTextContent("Q3 Report _final_.docx")
    expect(screen.getByText(TEMPLATE_REPLACE_LABEL)).toBeInTheDocument()
    // The "nothing attached" sentence must be GONE, not merely outranked — two sentences one
    // line apart making opposite claims about one stored field is the L-14 failure.
    expect(screen.queryByTestId("template-none")).not.toBeInTheDocument()
  })

  it("an empty-string filename reads as NOT attached (a name nobody can see is not a name)", () => {
    render(<TemplateAttachSection definitionId={DEF_ID} filename="" onAttached={vi.fn()} />)
    expect(screen.getByTestId("rail-template")).toHaveAttribute("data-attached", "false")
    expect(screen.getByText(TEMPLATE_ATTACH_LABEL)).toBeInTheDocument()
  })

  it("offers the picker with the three accepted extensions in its own filter", () => {
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />)
    expect(screen.getByTestId("template-input")).toHaveAttribute("accept", TEMPLATE_ACCEPT)
    expect(TEMPLATE_ACCEPT).toBe(".docx,.pptx,.xlsx")
  })
})

describe("193 AUTH-03 — an unsaved draft has nothing to attach to", () => {
  it("REMOVES the picker and says which press comes first", () => {
    render(<TemplateAttachSection definitionId={null} onAttached={vi.fn()} />)

    expect(screen.getByTestId("template-unsaved")).toHaveTextContent(TEMPLATE_UNSAVED_REFUSAL)
    // ABSENT, never `disabled`. A disabled control is still a control a later edit can
    // re-enable, and `toBeDisabled()` would pass on the very defect (the U-02 lesson).
    expect(screen.queryByTestId("template-input")).not.toBeInTheDocument()
  })

  it("names the button that unblocks it, so the sentence is actionable", () => {
    expect(TEMPLATE_UNSAVED_REFUSAL).toContain("Save draft")
  })
})

describe("193 AUTH-03 — the happy path completes the circuit", () => {
  it("POSTs the picked file against THIS definition and hands the descriptor up untouched", async () => {
    uploadMock.mockResolvedValue(ASSET)
    const onAttached = vi.fn()
    const file = aFile()
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={onAttached} />)

    pick(file)

    await waitFor(() => expect(onAttached).toHaveBeenCalledTimes(1))
    expect(uploadMock).toHaveBeenCalledWith(DEF_ID, file)
    // UNTOUCHED — the object is what `definition.assets[]` receives, and any client-side
    // re-shaping is a shape the `extra='forbid'` WorkflowDefinition would reject.
    expect(onAttached).toHaveBeenCalledWith(ASSET)
  })

  it("keeps NO local mirror: the surface still reads 'none' until the DEFINITION carries it", async () => {
    uploadMock.mockResolvedValue(ASSET)
    const onAttached = vi.fn()
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={onAttached} />)

    pick()
    await waitFor(() => expect(onAttached).toHaveBeenCalled())

    // The parent has not written yet, so the control must not claim an attachment.
    expect(screen.getByTestId("rail-template")).toHaveAttribute("data-attached", "false")
    expect(screen.queryByTestId("template-filename")).not.toBeInTheDocument()
  })

  it("shows the filename once the caller re-renders it with the written definition", async () => {
    uploadMock.mockResolvedValue(ASSET)
    const onAttached = vi.fn()
    const { rerender } = render(
      <TemplateAttachSection definitionId={DEF_ID} onAttached={onAttached} />,
    )
    pick()
    await waitFor(() => expect(onAttached).toHaveBeenCalled())

    rerender(
      <TemplateAttachSection definitionId={DEF_ID} filename={ASSET.filename} onAttached={onAttached} />,
    )
    expect(screen.getByTestId("template-filename")).toHaveTextContent(ASSET.filename)
  })

  it("does nothing at all when the picker is dismissed with no file", () => {
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />)
    fireEvent.change(screen.getByTestId("template-input"), { target: { files: [] } })
    expect(uploadMock).not.toHaveBeenCalled()
  })
})

describe("193 AUTH-03 — every failure says what was wrong, in words", () => {
  it("422 is relayed in the SERVER's own sentence, and nothing is handed up", async () => {
    const detail = "A workflow template must be a .docx, .pptx or .xlsx document (got .png)."
    uploadMock.mockRejectedValue(new WorkflowTemplateUploadError(422, detail))
    const onAttached = vi.fn()
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={onAttached} />)

    pick(aFile("logo.png"))

    await waitFor(() => expect(screen.getByTestId("template-error")).toHaveTextContent(detail))
    expect(onAttached).not.toHaveBeenCalled()
    // Still not attached — a failed upload that left the surface claiming success would be
    // the worst reading available.
    expect(screen.getByTestId("rail-template")).toHaveAttribute("data-attached", "false")
  })

  it("422 'too large' is relayed with its number, because the number is the actionable part", async () => {
    uploadMock.mockRejectedValue(
      new WorkflowTemplateUploadError(422, "File too large. Maximum size is 10 MB."),
    )
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />)
    pick()
    await waitFor(() =>
      expect(screen.getByTestId("template-error")).toHaveTextContent("Maximum size is 10 MB"),
    )
  })

  it("404 is worded HERE and names BOTH causes — the server refuses to distinguish them", async () => {
    uploadMock.mockRejectedValue(new WorkflowTemplateUploadError(404, "Workflow not found"))
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />)
    pick()

    await waitFor(() =>
      expect(screen.getByTestId("template-error")).toHaveTextContent(TEMPLATE_NOT_FOUND_ERROR),
    )
    expect(TEMPLATE_NOT_FOUND_ERROR).toMatch(/deleted/)
    expect(TEMPLATE_NOT_FOUND_ERROR).toMatch(/not be yours/)
    // The server's terse relay must NOT be what the author reads.
    expect(screen.getByTestId("template-error")).not.toHaveTextContent("Workflow not found")
  })

  it("502 relays the storage apology — a clean sentence by contract, never a traceback", async () => {
    const detail = "The template could not be stored. Please try again."
    uploadMock.mockRejectedValue(new WorkflowTemplateUploadError(502, detail))
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />)
    pick()
    await waitFor(() => expect(screen.getByTestId("template-error")).toHaveTextContent(detail))
  })

  it("a refusal with no readable body falls back to the sentence that names the accepted set", async () => {
    uploadMock.mockRejectedValue(new WorkflowTemplateUploadError(422, null))
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />)
    pick()
    await waitFor(() =>
      expect(screen.getByTestId("template-error")).toHaveTextContent(TEMPLATE_REFUSED_FALLBACK),
    )
    expect(TEMPLATE_REFUSED_FALLBACK).toMatch(/\.docx/)
  })

  it("a request that never arrived says RETRY, not 'pick another file'", async () => {
    uploadMock.mockRejectedValue(new WorkflowTemplateUploadError("network", null))
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />)
    pick()
    await waitFor(() =>
      expect(screen.getByTestId("template-error")).toHaveTextContent(TEMPLATE_NETWORK_ERROR),
    )
  })

  it("a thrown non-Error is still answered with a sentence, never a crash", async () => {
    uploadMock.mockRejectedValue("boom")
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />)
    pick()
    await waitFor(() =>
      expect(screen.getByTestId("template-error")).toHaveTextContent(TEMPLATE_NETWORK_ERROR),
    )
    // And the raw thrown value never reaches the surface.
    expect(screen.getByTestId("template-error")).not.toHaveTextContent("boom")
  })

  it("NO bare status code ever reaches the DOM", async () => {
    uploadMock.mockRejectedValue(new WorkflowTemplateUploadError(404, "Workflow not found"))
    const { container } = render(
      <TemplateAttachSection definitionId={DEF_ID} onAttached={vi.fn()} />,
    )
    pick()
    await waitFor(() => expect(screen.getByTestId("template-error")).toBeInTheDocument())

    // The whole rendered text, not just the error line — a code leaking through any sentence
    // on this surface is the thing the mapping exists to prevent.
    const text = container.textContent ?? ""
    for (const code of ["404", "422", "502", "500"]) expect(text).not.toContain(code)
  })

  it("a later success clears the earlier refusal", async () => {
    uploadMock.mockRejectedValueOnce(new WorkflowTemplateUploadError(422, "File is empty"))
    uploadMock.mockResolvedValueOnce(ASSET)
    const onAttached = vi.fn()
    render(<TemplateAttachSection definitionId={DEF_ID} onAttached={onAttached} />)

    pick()
    await waitFor(() => expect(screen.getByTestId("template-error")).toBeInTheDocument())

    pick(aFile("Q3 Report.docx"))
    await waitFor(() => expect(onAttached).toHaveBeenCalled())
    expect(screen.queryByTestId("template-error")).not.toBeInTheDocument()
  })
})

describe("193 AUTH-03 — the definition-level write (builderStore.setTemplateAsset)", () => {
  function drafted(assets?: unknown) {
    const store = createBuilderStore(null)
    store.getState().setDrafted({
      slug: "quarterly-report",
      business_requirement: "Produce the quarterly report",
      ...(assets === undefined ? {} : { assets }),
      phases: [],
    })
    return store
  }

  it("attaches the descriptor into assets[] and arms `dirty` in the same set", () => {
    const store = drafted()
    expect(store.getState().dirty).toBe(false)

    store.getState().setTemplateAsset(ASSET)

    expect(store.getState().meta.assets).toEqual([ASSET])
    // The leave guard reads `dirty`, and the phases-only subscription cannot see a meta write.
    expect(store.getState().dirty).toBe(true)
  })

  it("REPLACES the template rather than appending a second one", () => {
    const older = { ...ASSET, asset_id: "older", filename: "Old Report.docx" }
    const store = drafted([older])

    store.getState().setTemplateAsset(ASSET)

    const assets = store.getState().meta.assets as unknown[]
    expect(assets).toHaveLength(1)
    // `.find(a => a.kind === "template")` is the read on both sides of this circuit — an
    // appended second entry leaves it returning the OLD filename forever.
    expect(assets.find((a) => (a as { kind?: string }).kind === "template")).toEqual(ASSET)
  })

  it("preserves every asset that is NOT the template", () => {
    const reference = { kind: "reference", asset_id: "ref-1", filename: "Style guide.pdf", mime: "application/pdf" }
    const store = drafted([reference, { ...ASSET, asset_id: "older" }])

    store.getState().setTemplateAsset(ASSET)

    expect(store.getState().meta.assets).toEqual([reference, ASSET])
  })

  it("treats an absent or non-array assets field as empty rather than spreading it", () => {
    const absent = drafted()
    absent.getState().setTemplateAsset(ASSET)
    expect(absent.getState().meta.assets).toEqual([ASSET])

    const junk = drafted("not-an-array")
    junk.getState().setTemplateAsset(ASSET)
    expect(junk.getState().meta.assets).toEqual([ASSET])
  })

  it("is untracked — an undo restores STEPS, never the workflow's identity", () => {
    const store = drafted()
    store.getState().setTemplateAsset(ASSET)

    store.temporal.getState().undo()

    expect(store.getState().meta.assets).toEqual([ASSET])
  })

  it("refuses outside the drafted beat, where `meta` is deliberately empty", () => {
    const store = createBuilderStore(null)
    store.getState().setComposing()

    store.getState().setTemplateAsset(ASSET)

    expect(store.getState().meta.assets).toBeUndefined()
    expect(store.getState().dirty).toBe(false)
  })
})
