/**
 * Phase 296-07 Task 2 — the describe door, each row driven RED first.
 *
 *  - 291-WR-01  files are locked while the draft is being written, and the bind reads the
 *               snapshot `onDraft` took, never the live list
 *  - 291-IN-08  every bind failure is listed (one references sentence; the template keeps its own)
 *  - 291-WR-02  only references actually sent to the model are bound
 *  - 291-WR-06  (UI half) `Look it up` is shown but disabled, and says why
 *  - 291-IN-03  unplaced sentences from the template bind are shown
 *  - 291-IN-05  `covered_by: null` reads the shipped stays-blank words, with no dead switch
 *  - 291-S1-copy (b) the provider-failure refusal; (c) blank enum options never reach the hint
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { act, cleanup, render, renderHook, screen, waitFor, within } from "@testing-library/react"

import { useTemplateFirstDraft } from "../useTemplateFirstDraft"
import { bindFailureLines } from "../templateDraftBind"
import { createBuilderStore, type BuilderPhase } from "../builderStore"
import { DescribeTemplateRow, UnplacedSentencesNote } from "../DescribeTemplateRow"
import { DescribeReferencesSection } from "../DescribeReferencesSection"
import { DraftInputsFoldBody } from "../DraftInputsFold"
import * as templateFirstVocabulary from "../templateFirstVocabulary"
import * as declaredInputsVocabulary from "../declaredInputsVocabulary"
import { describeRefusal, refusalKey } from "../describeRefusalVocabulary"
import {
  generateWorkflow,
  readDescribeFile,
  uploadWorkflowReference,
  uploadWorkflowTemplate,
  type DescribeReadResult,
  type GenerateField,
} from "@/lib/api"

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

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    generateWorkflow: vi.fn(),
    readDescribeFile: vi.fn(),
    uploadWorkflowTemplate: vi.fn(),
    uploadWorkflowReference: vi.fn(),
  }
})

const mockedGenerate = vi.mocked(generateWorkflow)
const mockedRead = vi.mocked(readDescribeFile)
const mockedUpload = vi.mocked(uploadWorkflowTemplate)
const mockedUploadRef = vi.mocked(uploadWorkflowReference)

beforeEach(() => {
  mockedGenerate.mockReset()
  mockedRead.mockReset()
  mockedUpload.mockReset()
  mockedUploadRef.mockReset()
  vi.spyOn(console, "error").mockImplementation(() => {})
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

const fileNamed = (name: string) => new File(["bytes"], name, { type: "application/pdf" })

function referenceRead(filename: string): DescribeReadResult {
  return {
    role: "reference",
    arm: "reference",
    suggested_from: null,
    filename,
    fields: [],
    unplaced: [],
    text: `text of ${filename}`,
    cut_short: null,
    refused: null,
  }
}

function mountHook() {
  const store = createBuilderStore(null)
  const referencesBound: unknown[][] = []
  const initialProps: { builderPhase: BuilderPhase } = { builderPhase: "empty" }
  const view = renderHook(
    (props: { builderPhase: BuilderPhase }) =>
      useTemplateFirstDraft({
        store,
        builderPhase: props.builderPhase,
        onDraftStarted: () => {},
        onDrafted: () => {},
        onTemplateBound: () => {},
        onReferencesBound: (assets) => referencesBound.push(assets),
      }),
    { initialProps },
  )
  return { view, store, referencesBound }
}

const okDraft = () =>
  ({ ok: true, definition: { slug: "w", version: 1, phases: [] } }) as unknown as Awaited<
    ReturnType<typeof generateWorkflow>
  >

// ── 291-WR-01 ─────────────────────────────────────────────────────────────────────────────

describe("291-WR-01 — files cannot change while the draft is being written", () => {
  it("the vocabulary carries the hint", () => {
    expect((templateFirstVocabulary as Record<string, unknown>).FILES_LOCKED_WHILE_COMPOSING).toBe(
      "Files can't be changed while the draft is being written.",
    )
  })

  it("the hook says it is composing, and refuses a pick or a removal meanwhile", async () => {
    const { view, store } = mountHook()
    act(() => store.getState().setComposing())
    view.rerender({ builderPhase: "composing" })
    expect((view.result.current as unknown as { composing: boolean }).composing).toBe(true)
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("form.pdf"))
      view.result.current.onAddReferenceFiles([fileNamed("a.pdf")])
    })
    expect(view.result.current.templateFile).toBeNull()
    expect(view.result.current.references).toHaveLength(0)
  })

  it("both file sections render disabled", () => {
    render(
      <DescribeTemplateRow
        state={{ kind: "idle" }}
        onPickFile={() => {}}
        onClear={() => {}}
        {...({ disabled: true } as Record<string, unknown>)}
      />,
    )
    expect((screen.getByTestId("describe-template-input") as HTMLInputElement).disabled).toBe(true)
    render(
      <DescribeReferencesSection
        references={[{ file: fileNamed("a.pdf"), state: { kind: "read", result: referenceRead("a.pdf") } }]}
        notice={null}
        anyFileHeld
        anyReading={false}
        onAddFiles={() => {}}
        onRemove={() => {}}
        {...({ disabled: true } as Record<string, unknown>)}
      />,
    )
    expect((screen.getByTestId("describe-reference-input") as HTMLInputElement).disabled).toBe(true)
    const remove = within(screen.getByTestId("describe-reference-list")).getByRole("button")
    expect((remove as HTMLButtonElement).disabled).toBe(true)
  })

  it("the bind reads the snapshot onDraft took, not the live list", async () => {
    mockedRead.mockImplementation(async (file: File) => referenceRead(file.name))
    mockedGenerate.mockResolvedValue(okDraft())
    mockedUploadRef.mockImplementation(async (_id: string, file: File) => ({
      kind: "reference",
      asset_id: `assets/${file.name}`,
      filename: file.name,
      mime: "application/pdf",
    }))
    const { view, store } = mountHook()
    await act(async () => {
      view.result.current.setDescribe("summarise the renewals")
      view.result.current.onAddReferenceFiles([fileNamed("a.pdf")])
    })
    await waitFor(() => expect(view.result.current.anyReading).toBe(false))
    await act(async () => {
      await view.result.current.onDraft()
    })
    expect(store.getState().builderPhase).toBe("drafted")
    view.rerender({ builderPhase: "drafted" })
    // The live list changes AFTER the draft was written.
    await act(async () => {
      view.result.current.onAddReferenceFiles([fileNamed("b.pdf")])
    })
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    expect(mockedUploadRef.mock.calls.map((c) => (c[1] as File).name)).toEqual(["a.pdf"])
  })
})

// ── 291-WR-02 ─────────────────────────────────────────────────────────────────────────────

describe("291-WR-02 — only references sent to the model are bound", () => {
  it("a reference whose read never answered is not bound", async () => {
    mockedRead.mockImplementation(async (file: File) => {
      if (file.name === "b.pdf") throw new Error("network")
      return referenceRead(file.name)
    })
    mockedGenerate.mockResolvedValue(okDraft())
    mockedUploadRef.mockImplementation(async (_id: string, file: File) => ({
      kind: "reference",
      asset_id: `assets/${file.name}`,
      filename: file.name,
      mime: "application/pdf",
    }))
    const { view, referencesBound } = mountHook()
    await act(async () => {
      view.result.current.setDescribe("summarise the renewals")
      view.result.current.onAddReferenceFiles([fileNamed("a.pdf"), fileNamed("b.pdf")])
    })
    await waitFor(() => expect(view.result.current.anyReading).toBe(false))
    expect(view.result.current.references).toHaveLength(2)
    await act(async () => {
      await view.result.current.onDraft()
    })
    view.rerender({ builderPhase: "drafted" })
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    expect(mockedUploadRef.mock.calls.map((c) => (c[1] as File).name)).toEqual(["a.pdf"])
    expect(referencesBound.flat().map((a) => (a as { filename: string }).filename)).toEqual(["a.pdf"])
  })
})

// ── 291-IN-08 ─────────────────────────────────────────────────────────────────────────────

describe("291-IN-08 — every bind failure is listed", () => {
  it("two reference failures are both kept", async () => {
    mockedRead.mockImplementation(async (file: File) => referenceRead(file.name))
    mockedGenerate.mockResolvedValue(okDraft())
    mockedUploadRef.mockRejectedValue(new Error("storage down"))
    const { view } = mountHook()
    await act(async () => {
      view.result.current.setDescribe("summarise the renewals")
      view.result.current.onAddReferenceFiles([fileNamed("a.pdf"), fileNamed("b.docx")])
    })
    await waitFor(() => expect(view.result.current.anyReading).toBe(false))
    await act(async () => {
      await view.result.current.onDraft()
    })
    view.rerender({ builderPhase: "drafted" })
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    const failures = (view.result.current as unknown as { bindFailures: unknown }).bindFailures
    expect(failures).toEqual([
      { kind: "reference", filename: "a.pdf" },
      { kind: "reference", filename: "b.docx" },
    ])
  })

  it("the words: one references sentence, and the template keeps its own", () => {
    // The composition lives in the bind leaf (the vocabulary table holds strings and string
    // functions only, which its own suite fences); the words are the vocabulary's.
    const lines = bindFailureLines
    expect(
      lines([
        { kind: "reference", filename: "a.pdf" },
        { kind: "reference", filename: "b.docx" },
      ]),
    ).toEqual([
      "These files the draft was written from couldn't be attached to it: “a.pdf”, “b.docx”. The steps are saved and don't read these files when the workflow runs.",
    ])
    expect(lines([{ kind: "template", filename: "form.docx" }])).toEqual([
      templateFirstVocabulary.templateBindFailedMessage("form.docx"),
    ])
    expect(lines([])).toEqual([])
  })
})

// ── 291-IN-03 ─────────────────────────────────────────────────────────────────────────────

describe("291-IN-03 — sentences the template bind could not place are shown", () => {
  it("renders the count line and each sentence quoted on its own line", () => {
    render(<UnplacedSentencesNote sentences={["Sign here: ____"]} />)
    const note = screen.getByTestId("describe-form-unplaced-sentences")
    expect(note.textContent).toContain(
      "1 sentence(s) weren't found in the document, so no blank was made for them:",
    )
    expect(within(note).getByText("“Sign here: ____”")).toBeInTheDocument()
    expect(note.className).toContain("text-xs")
    expect(note.className).toContain("text-[hsl(var(--warning))]")
  })

  it("an empty list renders nothing", () => {
    const { container } = render(<UnplacedSentencesNote sentences={[]} />)
    expect(container.innerHTML).toBe("")
  })

  it("the hook keeps the bind's unplaced sentences and writes no extra key into assets[]", async () => {
    const bound: unknown[] = []
    mockedRead.mockResolvedValue({
      role: "form",
      arm: "template_fields",
      suggested_from: null,
      filename: "letter.docx",
      fields: [],
      unplaced: [],
      text: "body",
      cut_short: null,
      refused: null,
    } as DescribeReadResult)
    mockedUpload.mockResolvedValue({
      kind: "template",
      asset_id: "assets/letter.docx",
      filename: "letter.docx",
      mime: "application/docx",
      unplaced_sentences: ["Sign here: ____"],
    } as unknown as Awaited<ReturnType<typeof uploadWorkflowTemplate>>)
    const store = createBuilderStore(null)
    const view = renderHook(() =>
      useTemplateFirstDraft({
        store,
        builderPhase: "empty",
        onDraftStarted: () => {},
        onDrafted: () => {},
        onTemplateBound: (asset) => bound.push(asset),
        onReferencesBound: () => {},
      }),
    )
    await act(async () => {
      view.result.current.onPickTemplateFile(fileNamed("letter.docx"))
    })
    await waitFor(() => expect(view.result.current.templateRead.kind).toBe("read"))
    await act(async () => {
      await view.result.current.bindHeldTemplate("draft-1")
    })
    expect((view.result.current as unknown as { bindUnplaced: string[] }).bindUnplaced).toEqual([
      "Sign here: ____",
    ])
    expect(bound).toEqual([
      { kind: "template", asset_id: "assets/letter.docx", filename: "letter.docx", mime: "application/docx" },
    ])
  })
})

// ── 291-WR-06 / 291-IN-05 ─────────────────────────────────────────────────────────────────

function field(key: string, covered_by: "input" | "step" | null): GenerateField {
  return { key, label: key, type: "text", enum_options: [], covered_by } as unknown as GenerateField
}

function renderFold(fields: GenerateField[], inputs: { key: string; source?: string }[]) {
  return render(
    <DraftInputsFoldBody
      fields={fields}
      inputs={inputs}
      filename="form.pdf"
      bodyId="fold-body"
      open
      onToggle={() => {}}
      onSetSource={() => {}}
    />,
  )
}

describe("291-WR-06 (UI half) — Look it up is not wired, and says so", () => {
  it("the explanation no longer promises a look-up", () => {
    expect(declaredInputsVocabulary.INPUT_SOURCE_EXPLANATION).toBe(
      "Ask the person: it's a box on the form that starts this workflow. Looking answers up in your documents isn't available yet.",
    )
  })

  it("the Look it up segment is visible, disabled and described by the note", () => {
    renderFold([field("recipient", "input")], [{ key: "recipient", source: "user" }])
    const lookup = screen.getByLabelText("Look it up") as HTMLInputElement
    expect(lookup.disabled).toBe(true)
    const noteId = lookup.getAttribute("aria-describedby")
    expect(noteId).toBeTruthy()
    expect(document.getElementById(noteId!)?.textContent).toBe(
      "Not available yet: a workflow can't look answers up in your documents when it runs.",
    )
  })

  it("a row already set to kb_auto warns that it will be blank", () => {
    renderFold([field("recipient", "input")], [{ key: "recipient", source: "kb_auto" }])
    const warning = screen.getByText(
      "This answer was set to be looked up, which isn't available yet, so it will be blank when the workflow runs. Switch it to Ask the person.",
    )
    expect(warning.className).toContain("text-xs")
    expect(warning.className).toContain("text-[hsl(var(--warning))]")
  })
})

describe("291-IN-05 — covered_by: null reads as staying blank, with no switch", () => {
  it("no radiogroup for an uncovered field, and the shipped stays-blank words", () => {
    renderFold([field("notes", null)], [])
    const row = screen.getByTestId("draft-arrival-input-row")
    expect(within(row).queryByRole("radiogroup")).toBeNull()
    expect(row.textContent).toContain(templateFirstVocabulary.PLACE_STAYS_BLANK)
  })
})

// ── 291-S1-copy (b) and (c) ───────────────────────────────────────────────────────────────

describe("291-S1-copy — provider failure and blank enum options", () => {
  it("(b) a provider failure is named, and rewording is not the next step", () => {
    const words = describeRefusal(refusalKey("could_not_generate", "provider_error"))
    expect(words.sentence).toBe(
      "The drafting model's provider turned the request down, so no draft was written.",
    )
    expect(words.next).toBe(
      "Rewording won't help. Ask whoever runs this workspace to check the provider account, then try again.",
    )
  })

  it("(c) blank options never reach the hint", () => {
    expect(declaredInputsVocabulary.inputOptionsHint(["C", "S", "P", " "])).toBe("(one of: C, S, P)")
    expect(declaredInputsVocabulary.inputOptionsHint(["", "  "])).toBe("")
  })
})
