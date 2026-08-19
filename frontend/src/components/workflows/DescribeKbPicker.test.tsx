/**
 * Phase 187-26 Task 1 (VOCAB-02 / VOCAB-03 · GAP A) — DescribeKbPicker tests.
 *
 * WRITTEN AND OBSERVED RED BEFORE THE COMPONENT EXISTED. Round 4's whole subject was
 * guards that never bit, so every fence below carries a POSITIVE CONTROL that proves the
 * needle can match. A fence nobody has watched fail is a gesture.
 *
 * THE PROPERTY THIS FILE IS ABOUT: the loose door's picker offers a knowledge base and
 * NEVER manufactures one. There are exactly two ways to have zero rows — "there are none"
 * and "we could not ask" — and they are held in DISTINCT component state (the
 * StarterTemplatePicker rule). Two assertions that both check for absence would pass
 * even if the states had been merged, so the distinction is read off the component's own
 * rendered state attribute instead.
 *
 * WHY THE STATE ATTRIBUTE IS NOT A CONTRADICTION OF "RENDERS NOTHING". The marker is
 * `hidden` + `aria-hidden`: no select, no option, no placeholder row, no visible line and
 * nothing in the accessibility tree. It is a probe, not a surface. "Renders nothing" is
 * asserted separately and strictly (zero `<select>`, zero `<option>`, zero copy).
 *
 * COPY IS IMPORTED, NEVER RE-TYPED. The three strings are exported by the component and
 * imported here, so a copy change moves the surface and the assertion in one edit. They
 * live in the component rather than in `definitionOps` because this plan's file set is
 * two files and widening it to a shared copy home is a change this plan did not price
 * (recorded in the SUMMARY).
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi, type MockInstance } from "vitest"
import { render, screen, waitFor, fireEvent } from "@testing-library/react"

import describeKbPickerSource from "./DescribeKbPicker?raw"
import {
  DescribeKbPicker,
  DESCRIBE_KB_CHOOSE,
  DESCRIBE_KB_EMPTY,
  DESCRIBE_KB_LABEL,
  DESCRIBE_KB_NONE,
  DESCRIBE_KB_NOTE,
  DESCRIBE_KB_UNAVAILABLE,
  DESCRIBE_KB_UPLOAD,
} from "./DescribeKbPicker"

// ── The api seam. ONE symbol may be called; the rest exist so "it called nothing else"
//    is an OBSERVATION rather than an absence (the StarterTemplatePicker discipline). ──

const api = vi.hoisted(() => ({
  listFolders: vi.fn(),
  createFolder: vi.fn(),
  listSkills: vi.fn(),
  generateWorkflow: vi.fn(),
  createWorkflowDraft: vi.fn(),
  updateWorkflowDraft: vi.fn(),
  publishWorkflow: vi.fn(),
  validateWorkflow: vi.fn(),
}))

vi.mock("@/lib/api", () => api)

/** Everything the picker may NOT reach. All must stay at zero. */
const FORBIDDEN_SYMBOLS = [
  "createFolder",
  "listSkills",
  "generateWorkflow",
  "createWorkflowDraft",
  "updateWorkflowDraft",
  "publishWorkflow",
  "validateWorkflow",
] as const

const expectNothingElseCalled = () => {
  for (const name of FORBIDDEN_SYMBOLS) expect(api[name]).toHaveBeenCalledTimes(0)
}

/** A belt to the mock's braces: nothing in this suite opens a real request. */
let fetchSpy: MockInstance
beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})
afterAll(() => {
  fetchSpy.mockRestore()
})

// ── Fixtures, shaped like the live `Folder` row (`types/index.ts:470`). ────────

const folder = (id: string, name: string) => ({
  id,
  user_id: "u-1",
  name,
  parent_id: null,
  is_org_shared: false,
  created_at: "2026-08-04T00:00:00Z",
  updated_at: "2026-08-04T00:00:00Z",
})

const POLICIES = folder("f-policies", "Policies")
const CONTRACTS = folder("f-contracts", "Contracts")
const TWO_FOLDERS = [POLICIES, CONTRACTS]

beforeEach(() => {
  vi.clearAllMocks()
  api.listFolders.mockResolvedValue(TWO_FOLDERS)
})

const renderPicker = (props: Partial<{ value: string; onChange: (id: string) => void }> = {}) => {
  const onChange = props.onChange ?? vi.fn()
  const utils = render(<DescribeKbPicker value={props.value ?? ""} onChange={onChange} />)
  return { onChange, ...utils }
}

const picker = () => screen.queryByTestId("project-folder-picker")
const stateOf = () => screen.getByTestId("describe-kb-state").getAttribute("data-state")

/**
 * ══════════════════════════════════════════════════════════════════════════════════════
 * ⚠ SKETCH 200 (`doors.html`) — THE SELECT IS DISCLOSED, NOT ALWAYS-ON, AND THE CHOSEN
 *   STATE IS A ROW RATHER THAN A SELECT. THAT IS WHY THIS HELPER EXISTS.
 * ══════════════════════════════════════════════════════════════════════════════════════
 *
 * The sheet draws THREE arms where the shipped control drew one always-open `select`:
 * nothing chosen (a dashed add control), one chosen (a row naming it, with a remove
 * control), and no folders at all. So a case that wants the `select` must now OPEN it, and
 * a case about the chosen state must read the ROW instead.
 *
 * ⚠ NOT ONE ASSERTION BELOW WAS WEAKENED TO ABSORB THAT. Every case still asserts the same
 * PROPERTY it always did — the option order, the id-not-name write, the totality of the
 * label fallback, the surrender of a dangling id — and only the ROUTE to the control moved.
 * Where a property genuinely could not survive the new shape (the chosen state no longer
 * has a `select` to read a `value` off), the assertion was rewritten to read the same fact
 * off the row, never deleted.
 */
async function openChooser(): Promise<HTMLSelectElement> {
  const already = picker()
  if (already) return already as HTMLSelectElement
  fireEvent.click(await screen.findByTestId("describe-kb-choose"))
  return (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
}

/** The sheet's arm 2 — what a chosen knowledge base looks like now. */
const chosenRow = () => screen.queryByTestId("describe-kb-chosen")

// ── 1. The happy path: one select, "none" first, value reflects the prop ──────

describe("DescribeKbPicker — it offers the knowledge bases the server returned", () => {
  it("renders the select under the SHIPPED test id once folders resolve", async () => {
    renderPicker()
    // The dashed add control is the resting arm; the select is one press away.
    expect(await screen.findByTestId("describe-kb-choose")).toHaveTextContent(DESCRIBE_KB_CHOOSE)
    const select = await openChooser()
    expect(select.tagName).toBe("SELECT")
    expect(stateOf()).toBe("ready")
    expect(api.listFolders).toHaveBeenCalledTimes(1)
    expectNothingElseCalled()
  })

  it("puts the 'no knowledge base' option FIRST, then one option per folder", async () => {
    renderPicker()
    const select = await openChooser()
    const options = Array.from(select.querySelectorAll("option"))
    expect(options).toHaveLength(TWO_FOLDERS.length + 1)
    expect(options[0].value).toBe("")
    expect(options[0].textContent).toBe(DESCRIBE_KB_NONE)
    expect(options[1].value).toBe(POLICIES.id)
    expect(options[1].textContent).toBe(POLICIES.name)
    expect(options[2].value).toBe(CONTRACTS.id)
    expect(options[2].textContent).toBe(CONTRACTS.name)
  })

  it("reflects the value PROP — the parent owns the choice, not this component", async () => {
    // SAME PROPERTY, READ OFF THE SHEET'S ARM 2. The chosen state is now a row naming the
    // folder rather than a `select` holding it, so the fact is read from what a person sees
    // instead of from a DOM property. It is still the PROP that decides it — this component
    // holds no copy — which is what the case is about.
    renderPicker({ value: CONTRACTS.id })
    const row = await screen.findByTestId("describe-kb-chosen")
    expect(row).toHaveTextContent(CONTRACTS.name)
    // …and the OTHER folder is not named, so this is the prop's answer and not a list.
    expect(row).not.toHaveTextContent(POLICIES.name)
    expect(picker()).toBeNull()
  })

  it("carries the label and the quiet note, character-identical to the exports", async () => {
    renderPicker()
    const select = await openChooser()
    expect(select).toHaveAccessibleName(DESCRIBE_KB_LABEL)
    expect(screen.getByTestId("describe-kb-note").textContent).toBe(DESCRIBE_KB_NOTE)
  })
})

// ── 2. Choosing: an ID, or the empty string. Never undefined, never a name ────

describe("DescribeKbPicker — choosing writes an id and nothing else", () => {
  it("choosing a folder calls onChange with that folder's ID", async () => {
    const { onChange } = renderPicker()
    const select = await openChooser()

    fireEvent.change(select, { target: { value: CONTRACTS.id } })

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith(CONTRACTS.id)
    // Never a NAME — the wire field is an id and a name would be silently unbindable.
    expect(onChange).not.toHaveBeenCalledWith(CONTRACTS.name)
  })

  it("choosing the 'none' option calls onChange with '' — never undefined", async () => {
    // Declared locally (rather than read off `renderPicker`'s union-typed return) so the
    // `.mock` read below is a typed observation rather than a cast.
    const onChange = vi.fn()
    renderPicker({ value: POLICIES.id, onChange })
    // SAME PROPERTY, NEW ROUTE. With one chosen, the sheet's arm 2 offers a REMOVE control
    // rather than a `none` option — and it must write exactly what the option wrote.
    fireEvent.click(await screen.findByTestId("describe-kb-clear"))

    expect(onChange).toHaveBeenCalledTimes(1)
    const arg = onChange.mock.calls[0][0]
    expect(arg).toBe("")
    expect(arg).not.toBeUndefined()
    expect(typeof arg).toBe("string")
  })

  it("calls onChange ZERO times on its own — mounting is not a choice", async () => {
    const { onChange } = renderPicker()
    await openChooser()
    expect(onChange).toHaveBeenCalledTimes(0)
  })
})

// ── 3. TOTALITY: a nameless folder names ITSELF, never a blank ────────────────

describe("DescribeKbPicker — TOTALITY over server-shaped rows", () => {
  it("a folder with an empty or missing name renders its ID rather than a blank row", async () => {
    api.listFolders.mockResolvedValue([
      { ...folder("f-blank", ""), name: "" },
      { ...folder("f-missing", "x"), name: undefined },
      { ...folder("f-spaces", "   ") },
    ])
    renderPicker()
    const select = await openChooser()
    const options = Array.from(select.querySelectorAll("option")).slice(1)

    expect(options.map((o) => o.value)).toEqual(["f-blank", "f-missing", "f-spaces"])
    for (const option of options) {
      expect(option.textContent).toBe(option.value)
      expect((option.textContent ?? "").trim().length).toBeGreaterThan(0)
    }
  })

  it("a row with no usable id is dropped rather than rendered as an unpickable blank", async () => {
    api.listFolders.mockResolvedValue([{ ...folder("", "Nameless"), id: "" }, POLICIES])
    renderPicker()
    const select = await openChooser()
    const options = Array.from(select.querySelectorAll("option")).slice(1)
    expect(options).toHaveLength(1)
    expect(options[0].value).toBe(POLICIES.id)
  })
})

// ── 4. The two zero-row causes: NOTHING rendered, and held APART ──────────────

describe("DescribeKbPicker — zero rows invents nothing, twice over", () => {
  /**
   * ⚠ THE TITLES AND THE FINAL ASSERTION OF THE NEXT TWO CASES MOVED, AND THE ORIGINALS ARE
   * KEPT HERE RATHER THAN OVERWRITTEN, because what changed is a DECISION and not a detail.
   *
   *   was: "ZERO FOLDERS renders no picker, no option and no copy at all"
   *        …ending `expect(container.textContent).toBe("")`
   *   was: "A FAILED FETCH renders no picker and specifically NO <option> at all"
   *        …ending `expect(container.textContent).toBe("")`
   *
   * Sketch 200's third arm is *"You have no folders yet"* — a state the shipped control could
   * not express, because BOTH zero-row causes rendered the empty string. The operator has named
   * the sketch as the absolute reference, so the surface now speaks in each case.
   *
   * ⚠ WHAT IS UNCHANGED, AND IT IS THE PART THAT MATTERED: NOTHING IS INVENTED. There is still
   * no `select`, still no `option`, still no fabricated folder — asserted below exactly as
   * before. `T-187-R5-03` is untouched. What is retired is only the *silence*, which was never
   * a requirement in its own right; it was the consequence of having nowhere to put the fact.
   */
  it("ZERO FOLDERS says so, and still invents no option and no folder", async () => {
    api.listFolders.mockResolvedValue([])
    const { container } = renderPicker()

    await waitFor(() => expect(stateOf()).toBe("none"))
    expect(picker()).toBeNull()
    expect(container.querySelectorAll("select")).toHaveLength(0)
    expect(container.querySelectorAll("option")).toHaveLength(0)
    expect(screen.queryByTestId("describe-kb-note")).toBeNull()
    // The sheet's arm 3, and it names no count and no folder.
    expect(screen.getByTestId("describe-kb-empty")).toHaveTextContent(DESCRIBE_KB_EMPTY)
    expect(container.textContent).not.toContain(POLICIES.name)
    // ⚠ AND NO WAY OUT IS OFFERED WITHOUT A DESTINATION. The sheet draws an upload control
    // unconditionally; with no handler supplied there is nowhere for it to go, so it does not
    // render at all rather than render inert.
    expect(screen.queryByTestId("describe-kb-upload")).toBeNull()
  })

  it("ZERO FOLDERS offers the way out ONLY when a caller supplies a destination", async () => {
    const onUploadDocuments = vi.fn()
    api.listFolders.mockResolvedValue([])
    render(
      <DescribeKbPicker value="" onChange={vi.fn()} onUploadDocuments={onUploadDocuments} />,
    )

    await waitFor(() => expect(stateOf()).toBe("none"))
    const upload = screen.getByTestId("describe-kb-upload")
    expect(upload).toHaveTextContent(DESCRIBE_KB_UPLOAD)
    fireEvent.click(upload)
    expect(onUploadDocuments).toHaveBeenCalledTimes(1)
  })

  it("A FAILED FETCH says something DIFFERENT, and still emits NO <option> at all", async () => {
    api.listFolders.mockRejectedValue(new Error("network is down"))
    const { container } = renderPicker()

    await waitFor(() => expect(stateOf()).toBe("unavailable"))
    expect(picker()).toBeNull()
    expect(container.querySelectorAll("option")).toHaveLength(0)
    expect(screen.getByTestId("describe-kb-unavailable")).toHaveTextContent(
      DESCRIBE_KB_UNAVAILABLE,
    )
    // ⚠ AND IT MAY NOT BORROW ARM 3'S CLAIM. A failed read knows nothing about how many
    // folders exist, so the count-bearing sentence must be absent here specifically.
    expect(container.textContent).not.toContain(DESCRIBE_KB_EMPTY)
    expect(screen.queryByTestId("describe-kb-empty")).toBeNull()
  })

  it("the two causes are DISTINCT STATES, not one merged emptiness", async () => {
    // Read off the component's OWN state, so merging the two branches reds here. Two
    // absence assertions would both still pass with the states collapsed into one.
    api.listFolders.mockResolvedValue([])
    const empty = render(<DescribeKbPicker value="" onChange={vi.fn()} />)
    await waitFor(() =>
      expect(empty.getByTestId("describe-kb-state").getAttribute("data-state")).toBe("none"),
    )
    const emptyState = empty.getByTestId("describe-kb-state").getAttribute("data-state")
    empty.unmount()

    api.listFolders.mockRejectedValue(new Error("network is down"))
    const failed = render(<DescribeKbPicker value="" onChange={vi.fn()} />)
    await waitFor(() =>
      expect(failed.getByTestId("describe-kb-state").getAttribute("data-state")).toBe("unavailable"),
    )
    const failedState = failed.getByTestId("describe-kb-state").getAttribute("data-state")

    expect(emptyState).not.toBe(failedState)
  })

  it("POSITIVE CONTROL — the distinctness assertion reds when the states are merged", () => {
    // The guard above only means something if it can fail. Both branches reporting the
    // same word is exactly the merge it is there to catch.
    expect(() => expect("empty").not.toBe("empty")).toThrow()
    expect(() => expect("none").not.toBe("unavailable")).not.toThrow()
  })

  it("does NOT fall back to a remembered list from an earlier successful mount", async () => {
    const first = render(<DescribeKbPicker value="" onChange={vi.fn()} />)
    await waitFor(() => expect(first.getByTestId("describe-kb-choose")).toBeInTheDocument())
    first.unmount()

    api.listFolders.mockRejectedValue(new Error("network is down"))
    const { container } = renderPicker()
    await waitFor(() => expect(stateOf()).toBe("unavailable"))
    expect(container.textContent).not.toContain(POLICIES.name)
    expect(container.querySelectorAll("option")).toHaveLength(0)
  })

  it("says nothing at all while the list is in flight — no skeleton, no placeholder row", async () => {
    let release: (rows: unknown) => void = () => {}
    api.listFolders.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    const { container } = renderPicker()

    expect(stateOf()).toBe("loading")
    expect(picker()).toBeNull()
    expect(container.textContent).toBe("")

    release(TWO_FOLDERS)
    await screen.findByTestId("describe-kb-choose")
    expect(stateOf()).toBe("ready")
  })
})

// ── 5. THE NEVER-BLOCKS PROPERTY, at this component's own level ───────────────

describe("DescribeKbPicker — it is a control, never a gate", () => {
  it("renders no `required`, no `disabled` and no invalid marking anywhere", async () => {
    const { container } = renderPicker()
    await openChooser()

    expect(container.querySelectorAll("[required]")).toHaveLength(0)
    expect(container.querySelectorAll("[disabled]")).toHaveLength(0)
    expect(container.querySelectorAll("[aria-invalid]")).toHaveLength(0)
    expect(container.querySelectorAll("[aria-required]")).toHaveLength(0)
  })

  it("renders exactly ONE interactive element — it adds no second control to the door", async () => {
    const { container } = renderPicker()
    await screen.findByTestId("describe-kb-choose")

    // ⚠ STILL EXACTLY ONE, AND THAT IS THE POINT OF READING IT AT REST. The sheet's arm 1
    // replaces the always-open `select` with a dashed add control — one control either way,
    // so the door gains no second thing to tab through. Asserted in BOTH arms below rather
    // than in the one that happens to be showing.
    const interactive = container.querySelectorAll(
      "button, a[href], input, textarea, select, [role='menuitem'], [tabindex]",
    )
    expect(interactive).toHaveLength(1)
    expect(interactive[0]).toBe(screen.getByTestId("describe-kb-choose"))

    // …and once the chooser is open it is the select, still alone.
    await openChooser()
    const opened = container.querySelectorAll(
      "button, a[href], input, textarea, select, [role='menuitem'], [tabindex]",
    )
    expect(opened).toHaveLength(1)
    expect(opened[0]).toBe(screen.getByTestId("project-folder-picker"))
  })

  it("an unmount mid-flight lands no state and throws nothing (the `cancelled` idiom)", async () => {
    let release: (rows: unknown) => void = () => {}
    api.listFolders.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )
    const view = renderPicker()
    view.unmount()
    release(TWO_FOLDERS)
    await Promise.resolve()
    expect(picker()).toBeNull()
  })
})

// ── 6. THE WORD-CLASS FENCE over the quiet line ───────────────────────────────

/** Severity / verdict words. The server owns every verdict (D-182-06 / D-186-16); this
 *  line states a CONFIGURATION FACT. `\b` on both sides so it is a claim about the WORD,
 *  not about the letters. */
const SEVERITY_WORDS = /\b(problem|error|invalid|blocked|failed|warning|required)\b/i

describe("DescribeKbPicker — the quiet line is an invitation, never a verdict", () => {
  it("carries no severity or verdict word", () => {
    expect(DESCRIBE_KB_NOTE).not.toMatch(SEVERITY_WORDS)
    expect(DESCRIBE_KB_LABEL).not.toMatch(SEVERITY_WORDS)
    expect(DESCRIBE_KB_NONE).not.toMatch(SEVERITY_WORDS)
  })

  it("claims nothing about publishing succeeding or failing", () => {
    expect(DESCRIBE_KB_NOTE).not.toMatch(/\bpublish(ing|ed)?\b/i)
    expect(DESCRIBE_KB_NOTE).not.toMatch(/\bgate|verdict|refus/i)
  })

  it("NEGATIVE CONTROLS — the fence is about the word, not the letters", () => {
    // Each of these CONTAINS a class stem and must NOT match, which is the whole point
    // of the `\b`. `blockchain` is the plan's own near-miss control.
    expect("errorless").not.toMatch(SEVERITY_WORDS)
    expect("invalidate").not.toMatch(SEVERITY_WORDS)
    expect("blockchain").not.toMatch(SEVERITY_WORDS)
    expect("warningly").not.toMatch(SEVERITY_WORDS)
  })

  it("POSITIVE CONTROL — welding a severity word onto the SHIPPED string reds it", () => {
    // Built from the shipped constant, so this proves the fence bites on the real
    // sentence rather than on a hand-typed stand-in.
    expect(`${DESCRIBE_KB_NOTE} A knowledge base is required.`).toMatch(SEVERITY_WORDS)
    expect(`${DESCRIBE_KB_NOTE} Publishing is blocked.`).toMatch(SEVERITY_WORDS)
    expect(`This is an error. ${DESCRIBE_KB_NOTE}`).toMatch(SEVERITY_WORDS)
  })

  it("the rendered line IS that constant — the fence guards what ships", async () => {
    renderPicker()
    await screen.findByTestId("describe-kb-choose")
    const rendered = screen.getByTestId("describe-kb-note").textContent ?? ""
    expect(rendered).toBe(DESCRIBE_KB_NOTE)
    expect(rendered).not.toMatch(SEVERITY_WORDS)
  })
})

// ── 7. THE SOURCE FENCE: exactly one api symbol, and no route name ────────────
//
// Needles are ASSEMBLED FROM PARTS so this file's own source cannot satisfy a grep run
// over it (the 187-24 lesson), and every one carries a positive control below.

const API_SYMBOL = ["list", "Folders"].join("")
const API_MODULE_RE = new RegExp(`from\\s+["']@/lib/api["']`)
const ROUTE_LITERAL = ["/", "folders"].join("")
const FETCH_CALL = ["fetch", "("].join("")
const API_BASE_TOKEN = ["API", "_BASE"].join("")

describe("DescribeKbPicker — source purity: one api symbol, zero routes", () => {
  it("imports from the api client EXACTLY ONCE and names EXACTLY ONE symbol from it", () => {
    const imports = describeKbPickerSource.match(/from\s+["']@\/lib\/api["']/g) ?? []
    expect(imports).toHaveLength(1)
    expect(describeKbPickerSource).toMatch(API_MODULE_RE)
    expect(describeKbPickerSource).toMatch(new RegExp(API_SYMBOL))
    for (const symbol of FORBIDDEN_SYMBOLS) {
      expect(describeKbPickerSource).not.toMatch(new RegExp(symbol))
    }
  })

  it("names NO route, opens NO request of its own", () => {
    expect(describeKbPickerSource).not.toContain(ROUTE_LITERAL)
    expect(describeKbPickerSource).not.toContain(FETCH_CALL)
    expect(describeKbPickerSource).not.toContain(API_BASE_TOKEN)
  })

  it("holds NO store, NO provider and NO navigation — it writes through onChange alone", () => {
    expect(describeKbPickerSource).not.toMatch(/builderStore|useBuilderStore|BuilderStoreProvider/)
    expect(describeKbPickerSource).not.toMatch(/useNavigate|navigate\(|setDrafted/)
    expect(describeKbPickerSource).not.toMatch(/setProjectFolder\(/)
    expect(describeKbPickerSource).toMatch(/onChange/)
  })

  it("renders no authored string as HTML and declares no second folder source", () => {
    expect(describeKbPickerSource).not.toMatch(/dangerouslySetInnerHTML/)
    expect(describeKbPickerSource).not.toMatch(/listStarterWorkflows|listPublishedWorkflows/)
  })

  it("POSITIVE CONTROLS — every needle above matches a planted literal", () => {
    expect(`import { ${API_SYMBOL} } from "@/lib/api"`).toMatch(API_MODULE_RE)
    expect(`await ${API_SYMBOL}()`).toMatch(new RegExp(API_SYMBOL))
    expect(`await createFolder("x")`).toMatch(/createFolder/)
    expect(`const res = await ${FETCH_CALL}\`\${${API_BASE_TOKEN}}${ROUTE_LITERAL}\`)`).toContain(
      ROUTE_LITERAL,
    )
    expect(`const res = await ${FETCH_CALL}"/x")`).toContain(FETCH_CALL)
    expect(`${API_BASE_TOKEN} + "/x"`).toContain(API_BASE_TOKEN)
    expect(`const s = useBuilderStore()`).toMatch(/builderStore|useBuilderStore|BuilderStoreProvider/)
    expect(`const nav = useNavigate()`).toMatch(/useNavigate|navigate\(|setDrafted/)
    expect(`store.getState().setProjectFolder(id)`).toMatch(/setProjectFolder\(/)
    expect(`<p dangerouslySetInnerHTML={{ __html: x }} />`).toMatch(/dangerouslySetInnerHTML/)
    expect(`await listStarterWorkflows()`).toMatch(/listStarterWorkflows|listPublishedWorkflows/)
  })

  it("POSITIVE CONTROL — the one-import count reds on a planted SECOND api import", () => {
    const planted = `${describeKbPickerSource}\nimport { createFolder } from "@/lib/api"\n`
    expect((planted.match(/from\s+["']@\/lib\/api["']/g) ?? []).length).toBe(2)
  })
})

// ── 7b. CR-R5-01: what is SENT is always something the author can SEE ─────────

describe("DescribeKbPicker — an unofferable choice is surrendered, never sent invisibly", () => {
  const DANGLING = "f-deleted-or-scoped-away"

  it("MECHANISM — a dangling id matches NO option, so <select> would render a blank row", async () => {
    // This is the defect's shape, asserted directly rather than described in a comment:
    // an id with no matching <option> gives selectedIndex -1. Everything below exists so
    // that state can never be reached with the id still live in the parent.
    // Read off the OFFERED arm (nothing chosen), which is where the option list lives now.
    renderPicker()
    const select = await openChooser()
    const offered = Array.from(select.querySelectorAll("option")).map((o) => o.value)
    expect(offered).not.toContain(DANGLING)
    expect(offered).toContain(CONTRACTS.id)
  })

  it("a held id the server does NOT offer is handed back as '' once the request settles", async () => {
    const { onChange } = renderPicker({ value: DANGLING })
    await waitFor(() => expect(stateOf()).toBe("ready"))
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(""))
  })

  it("ANTI-CASE — a held id the server DOES offer is left completely alone", async () => {
    const { onChange } = renderPicker({ value: POLICIES.id })
    expect(await screen.findByTestId("describe-kb-chosen")).toHaveTextContent(POLICIES.name)
    await waitFor(() => expect(stateOf()).toBe("ready"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("'we could not ask' surrenders it too — nothing renders, so nothing may be sent", async () => {
    api.listFolders.mockRejectedValue(new Error("network"))
    const { onChange } = renderPicker({ value: DANGLING })
    await waitFor(() => expect(stateOf()).toBe("unavailable"))
    expect(picker()).toBeNull()
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(""))
  })

  it("'there are none' surrenders it too", async () => {
    api.listFolders.mockResolvedValue([])
    const { onChange } = renderPicker({ value: DANGLING })
    await waitFor(() => expect(stateOf()).toBe("none"))
    expect(picker()).toBeNull()
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(""))
  })

  it("NOT-ASKED-YET IS NOT NOT-OFFERED — nothing is surrendered while the request is in flight", async () => {
    api.listFolders.mockReturnValue(new Promise(() => {}))
    const { onChange } = renderPicker({ value: DANGLING })
    await waitFor(() => expect(stateOf()).toBe("loading"))
    expect(onChange).not.toHaveBeenCalled()
  })

  it("an empty value is never churned back to the parent in ANY settled state", async () => {
    for (const [label, arrange] of [
      ["ready", () => api.listFolders.mockResolvedValue(TWO_FOLDERS)],
      ["none", () => api.listFolders.mockResolvedValue([])],
      ["unavailable", () => api.listFolders.mockRejectedValue(new Error("network"))],
    ] as const) {
      vi.clearAllMocks()
      arrange()
      const { onChange, unmount } = renderPicker({ value: "" })
      await waitFor(() => expect(stateOf()).toBe(label))
      expect(onChange).not.toHaveBeenCalled()
      unmount()
    }
  })
})

// ══════════════════════════════════════════════════════════════════════════════════════
// Phase 199-08 Task 3 (DES-01 · sheet `c9-doors-describe` §4) — THE KNOWLEDGE PICKER'S
// THREE READINGS, AND THE ONE THE SHEET ASKS FOR THAT THIS COMPONENT MAY NOT GIVE.
//
// APPENDED, never interleaved, and BEFORE the whole-suite network tripwire so that section
// still runs last. Not one assertion above this line moves, and NO byte of
// `DescribeKbPicker.tsx` is modified by this plan.
//
// ⚠ THE SHEET'S THIRD READING IS **REFUSED**, ON THREE INDEPENDENT GROUNDS, and this block
// pins the shipped behaviour so the refusal is a recorded decision rather than an omission:
//
//   1. **A RECORDED RULING ALREADY GOVERNS IT.** Phase 187 (D-187-14 / SC#4) settled that
//      the fast door gains a MOUNT and not a SURFACE: with nothing to offer this control
//      renders nothing at all, and ignoring it gives today's behaviour exactly. Where the
//      sheet and a shipped locked decision disagree, the shipped one wins.
//   2. **THE RESTING DOM IS PINNED BYTE FOR BYTE.** The zero-folder arm is inside all six
//      `WorkflowDoorSwitch.baseline.test.tsx` captures. A visible row here reds a
//      characterization pin, and re-baselining one to make a red go green is forbidden.
//   3. **THE SHEET'S CHIP CARRIES AN ACTION, NOT A SENTENCE.** Its third state ends in an
//      upload control — a navigation capability, which is outside a presentation phase.
//
// ⚠ AND THE HONEST COST IS PINNED TOO: "there are none" and "we could not ask" are held
// apart ONLY by a machine-readable marker. To a MACHINE they are two states; to a PERSON
// they are one silence. That is the gap, and it is asserted rather than described.
// ══════════════════════════════════════════════════════════════════════════════════════
//
// ══════════════════════════════════════════════════════════════════════════════════════
// ⚠⚠ THE REFUSAL ABOVE IS RETIRED — SKETCH 200, 2026-08-20. THE ORIGINAL WORDING IS KEPT
//    VERBATIM RATHER THAN DELETED, BECAUSE A REFUSAL THAT VANISHES READS AS AN OVERSIGHT.
// ══════════════════════════════════════════════════════════════════════════════════════
//
// **THE OPERATOR HAS NAMED THE SKETCH AS THE ABSOLUTE REFERENCE**, and sketch 200's
// `doors.html` draws the knowledge picker in THREE arms — nothing chosen, one chosen, and no
// folders at all. So the third reading is BUILT. Each of the three grounds above is answered
// on its own terms rather than waved past:
//
//   1. **THE 187 RULING IS NARROWER THAN IT WAS READ AS BEING.** D-187-14's property is that
//      an author who IGNORES this control gets today's behaviour exactly, and that still
//      holds: the picker touches no enablement rule, holds no `required`/`disabled`, and the
//      door's CTA is unchanged. What 187 never ruled was that a zero-folder author must be
//      told NOTHING — that was a consequence of having nowhere to put the fact, not a
//      decision to withhold it.
//   2. **THE BASELINE CAPTURES ARE RE-BASELINED, DECLARED, AND FOR A NAMED REASON.** See the
//      re-capture note in `WorkflowDoorSwitch.baseline.test.tsx`. Ground 2 was correct that
//      this reds a characterization pin; what it could not know is that the operator would
//      overrule the pin. The rule it cites — *never re-baseline to make a red go green* —
//      still stands and is not what happened: the pin moved because a DECLARED change moved
//      it, and the diff is stated rather than absorbed.
//   3. **THE UPLOAD CONTROL RENDERS ONLY WHERE A DESTINATION EXISTS.** Ground 3 was right
//      that a navigation capability is not this component's to invent — the app has no url
//      router (`SEED-185`). So the control is a PROP (`onUploadDocuments`), absent by
//      default, and the sentence stands alone without it. The capability is not smuggled in;
//      the seam for it is.
//
// ⚠ AND THE THIRD REFUSAL BELOW STANDS ENTIRELY UNCHANGED: **the sheet's document count is
// STILL not rendered**, because `Folder` still carries no count and no amount of operator
// authority makes a number exist on a wire that does not send one. That case is left exactly
// as `199-08` wrote it, and it is the difference between porting a design and inventing data.
// ══════════════════════════════════════════════════════════════════════════════════════

/**
 * What a PERSON reads, with every `class` attribute out of the picture: the words, which row
 * is selected, and how many controls there are. Deliberately not an HTML comparison — a
 * `<select>`'s chosen row lives in a DOM property and never reaches the serialised markup, so
 * an innerHTML diff would report readings 1 and 2 as identical when they plainly are not.
 */
function classFreeReading() {
  const select = picker() as HTMLSelectElement | null
  return {
    text: (document.body.textContent ?? "").replace(/\s+/g, " ").trim(),
    chosen: select ? (select.selectedOptions[0]?.textContent ?? null) : null,
    controls: document.body.querySelectorAll("select, button, input, a[href], textarea").length,
  }
}

describe("199-08 — sheet c9 §4: the three readings are distinct WITHOUT any class", () => {
  it("READING 1 (none chosen) · READING 2 (one chosen) · READING 3 (none available) are pairwise distinct", async () => {
    const readings: Record<string, ReturnType<typeof classFreeReading>> = {}

    api.listFolders.mockResolvedValue(TWO_FOLDERS)
    const first = render(<DescribeKbPicker value="" onChange={vi.fn()} />)
    await screen.findByTestId("describe-kb-choose")
    readings.noneChosen = classFreeReading()
    first.unmount()

    api.listFolders.mockResolvedValue(TWO_FOLDERS)
    const second = render(<DescribeKbPicker value={CONTRACTS.id} onChange={vi.fn()} />)
    await screen.findByTestId("describe-kb-chosen")
    readings.oneChosen = classFreeReading()
    second.unmount()

    api.listFolders.mockResolvedValue([])
    const third = render(<DescribeKbPicker value="" onChange={vi.fn()} />)
    await waitFor(() => expect(stateOf()).toBe("none"))
    readings.noneAvailable = classFreeReading()
    third.unmount()

    // ⚠ NON-VACUITY FIRST, AND IT IS STRONGER THAN IT WAS. Sketch 200 gives each arm its own
    // WORDS, so every reading is now distinguishable by text alone — where the shipped
    // control needed `chosen` (a DOM property that never reaches the markup) to tell arms 1
    // and 2 apart, and had nothing at all for arm 3.
    expect(readings.noneChosen.controls).toBe(1)
    expect(readings.noneChosen.text).toContain(DESCRIBE_KB_CHOOSE)
    expect(readings.oneChosen.text).toContain(CONTRACTS.name)
    expect(readings.noneAvailable.text).toContain(DESCRIBE_KB_EMPTY)
    // …and arm 3 still offers no control, because none was supplied a destination.
    expect(readings.noneAvailable.controls).toBe(0)

    // …and PAIRWISE DISTINCT, serialised so a failure names which pair collapsed.
    const keys = Object.keys(readings)
    const collisions: string[] = []
    for (let i = 0; i < keys.length; i++) {
      for (let j = i + 1; j < keys.length; j++) {
        if (JSON.stringify(readings[keys[i]]) === JSON.stringify(readings[keys[j]])) {
          collisions.push(`${keys[i]} === ${keys[j]}`)
        }
      }
    }
    expect(collisions).toEqual([])
  })

  it("⚠ THE GAP: the FOURTH state is distinct to a MACHINE and identical to a PERSON", async () => {
    api.listFolders.mockResolvedValue([])
    const none = render(<DescribeKbPicker value="" onChange={vi.fn()} />)
    await waitFor(() => expect(stateOf()).toBe("none"))
    const noneReading = classFreeReading()
    none.unmount()

    api.listFolders.mockRejectedValue(new Error("offline"))
    const unavailable = render(<DescribeKbPicker value="" onChange={vi.fn()} />)
    await waitFor(() => expect(stateOf()).toBe("unavailable"))
    const unavailableReading = classFreeReading()

    // TO A MACHINE — two states, which is the shipped Phase 187 property and stays true.
    expect(stateOf()).toBe("unavailable")

    /**
     * ⚠ THE GAP IS CLOSED, AND THIS ASSERTION IS FLIPPED EXACTLY AS `199-08` DEMANDED IT
     * WOULD HAVE TO BE. Its own words: *"Recorded as a MEASUREMENT, so a later plan that
     * closes this gap has to flip this assertion rather than discover the problem again."*
     * This is that plan. The two originals are kept verbatim so the flip is legible:
     *
     *     expect(unavailableReading).toEqual(noneReading)
     *     expect(noneReading.text).toBe("")
     *
     * TO A PERSON — two sentences now, and they are not each other's.
     */
    expect(unavailableReading).not.toEqual(noneReading)
    expect(noneReading.text).toContain(DESCRIBE_KB_EMPTY)
    expect(unavailableReading.text).toContain(DESCRIBE_KB_UNAVAILABLE)
    // ⚠ AND NEITHER MAY BORROW THE OTHER'S CLAIM — the whole reason the two states are held
    // apart. A single shared sentence would satisfy "not equal" above via the controls count
    // alone, so both directions are asserted.
    expect(unavailableReading.text).not.toContain(DESCRIBE_KB_EMPTY)
    expect(noneReading.text).not.toContain(DESCRIBE_KB_UNAVAILABLE)
    unavailable.unmount()
  })

  it("⚠ CANNOT-EXPRESS: the sheet's chosen chip states a DOCUMENT COUNT the wire never carries", async () => {
    api.listFolders.mockResolvedValue(TWO_FOLDERS)
    render(<DescribeKbPicker value={CONTRACTS.id} onChange={vi.fn()} />)
    // ⚠ THIS CASE IS UNCHANGED IN SUBSTANCE AND STANDS AFTER THE PORT. Only the handle moved,
    // because the chosen state is now the sheet's row rather than a `select`. The refusal it
    // records is the one the sketch CANNOT overrule: no operator instruction makes a number
    // exist on a wire that does not send one.
    await screen.findByTestId("describe-kb-chosen")

    // The live `Folder` row is id / user_id / name / parent_id / is_org_shared / timestamps.
    // There is no count on it, so the sheet's `1,284 docs` could only be fabricated — and a
    // fabricated precision beside a real name is the defect this project refuses everywhere.
    for (const key of Object.keys(CONTRACTS)) {
      expect(/count|docs|documents|size/i.test(key), `${key} looks like a count`).toBe(false)
    }
    // …and nothing on screen states one either.
    expect(/\b\d[\d,]*\s*(docs|documents|files)\b/i.test(document.body.textContent ?? "")).toBe(
      false,
    )
  })

  it("the component still reaches exactly ONE api symbol — the port added no network", () => {
    // ⚠ THE TITLE AND FIRST ASSERTION MOVED. `199-08` asserted it had modified no byte of the
    // component (`expect(describeKbPickerSource).not.toContain("199-08")`), which was true of
    // THAT plan and is a claim only that plan could make. Sketch 200's port DOES modify the
    // component, so the vacated half is dropped and the half that guards a real property —
    // one api symbol, nothing else called — is kept and still runs.
    expect(describeKbPickerSource.length).toBeGreaterThan(1000)
    // …and no network symbol was added: still exactly the one shipped api import.
    expect(describeKbPickerSource.match(/from "@\/lib\/api"/g) ?? []).toHaveLength(1)
    expectNothingElseCalled()
  })
})

// ── 8. The whole-suite network tripwire (must run LAST) ───────────────────────

describe("DescribeKbPicker — zero real network calls across the entire suite", () => {
  it("the fetch spy recorded exactly 0 calls", () => {
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
