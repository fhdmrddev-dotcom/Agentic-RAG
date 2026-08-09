/**
 * Phase 187-14 Task 2 (VOCAB-03 / Req 6) — StarterTemplatePicker tests.
 *
 * ONE PROPERTY IS THE POINT OF THIS FILE: **choosing a template produces a SENTENCE and
 * nothing else.** It is proven twice, in two different kinds:
 *
 *   BEHAVIOURALLY — every create / update / publish / generate / delete / validate symbol
 *   on the API client is mocked and asserted at `toHaveBeenCalledTimes(0)` after a row is
 *   chosen. Enumerating them (rather than omitting them from the factory) is what turns
 *   "it did not fork" from an absence into an observation: a mock that is missing hands
 *   back `undefined` and the failure surfaces far from its cause.
 *
 *   AT THE SOURCE — a `?raw` fence asserts the module NAMES exactly one API symbol,
 *   `listStarterWorkflows`. That is the half that makes "the picker never forks" a
 *   property of the file rather than of the paths this suite happened to walk.
 *
 * FIXTURE PROVENANCE. The three rows below are the MEASURED live shapes recorded in
 * `187-RESEARCH.md` §"The template door": exactly three curated starters, each **2
 * phases** (`llm_agent` → `llm_emit`), each carrying **one template `.docx` asset**, and
 * **none carrying a phase `name`**. The identical spines are not a lazy fixture — they
 * are the measurement, and they are why the component's own docblock says the spine is
 * orientation while the NAME identifies the row. One fixture carries a null
 * `business_requirement` so the seed's documented fallback is exercised rather than
 * assumed.
 *
 * EXPECTED SENTENCES ARE NEVER TYPED. Every seed assertion calls the `definitionOps`
 * formatter in the test and compares against its return value, so a copy change moves
 * both sides at once and this file cannot drift into asserting a sentence the product no
 * longer says.
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll, vi, type MockInstance } from "vitest"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import starterTemplatePickerSource from "./StarterTemplatePicker?raw"
import { StarterTemplatePicker } from "./StarterTemplatePicker"
import {
  starterSeedSentence,
  STARTER_DOOR_EMPTY,
  STARTER_DOOR_HEADING,
  STARTER_DOOR_LINE,
  STARTER_DOOR_LOADING,
  STARTER_DOOR_NOTE,
  STARTER_DOOR_UNAVAILABLE,
} from "./definitionOps"

// ── The API surface, enumerated so "it never forked" is an OBSERVATION ─────────
//
// `listStarterWorkflows` is the one symbol the picker may call. The other six are the
// ways a workflow can come into existence or change; they exist in this mock ONLY so the
// no-second-forward-path assertion has something to read a zero off.

const api = vi.hoisted(() => ({
  listStarterWorkflows: vi.fn(),
  createWorkflowDraft: vi.fn(),
  updateWorkflowDraft: vi.fn(),
  deleteWorkflowDraft: vi.fn(),
  publishWorkflow: vi.fn(),
  generateWorkflow: vi.fn(),
  validateWorkflow: vi.fn(),
  listPublishedWorkflows: vi.fn(),
}))

vi.mock("@/lib/api", () => api)

/** Every way a workflow could be created, changed or promoted. All must stay at zero. */
const FORWARD_PATH_SYMBOLS = [
  "createWorkflowDraft",
  "updateWorkflowDraft",
  "deleteWorkflowDraft",
  "publishWorkflow",
  "generateWorkflow",
  "validateWorkflow",
  "listPublishedWorkflows",
] as const

const expectNoForwardPathTaken = () => {
  for (const name of FORWARD_PATH_SYMBOLS) {
    expect(api[name]).toHaveBeenCalledTimes(0)
  }
}

/** A belt to the mock's braces: nothing in this suite opens a real request either. */
let fetchSpy: MockInstance

beforeAll(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterAll(() => {
  fetchSpy.mockRestore()
})

// ── The measured fixture (187-RESEARCH §"The template door") ──────────────────

/** The 2-phase spine every curated starter shares. Measured, not invented. */
const starterPhases = () => [
  {
    slug: "retrieve",
    phase_index: 0,
    config: { phase_type: "llm_agent", available_tools: ["search_documents"] },
  },
  { slug: "emit", phase_index: 1, config: { phase_type: "llm_emit" } },
]

const COMPLIANCE = {
  id: "11111111-1111-4111-8111-111111111111",
  slug: "compliance-gap-report",
  name: "Compliance Gap Report",
  definition: {
    category: "starter",
    business_requirement: "Show where our policies fall short of the current regulations.",
    assets: [{ kind: "template", filename: "compliance-gap-report.docx" }],
    phases: starterPhases(),
  },
}

const RISK_REGISTER = {
  id: "22222222-2222-4222-8222-222222222222",
  slug: "risk-register",
  name: "Risk Register",
  definition: {
    category: "starter",
    business_requirement: "Track and report the risks on my active projects.",
    assets: [{ kind: "template", filename: "risk-register.docx" }],
    phases: starterPhases(),
  },
}

/** The fallback case: a curated row with NO declared requirement. Its name must seed the
 *  box rather than an empty string — a click that silently does nothing is worse than a
 *  rough sentence the user can edit. */
const WEEKLY_STATUS = {
  id: "33333333-3333-4333-8333-333333333333",
  slug: "weekly-status-report",
  name: "Weekly Status Report",
  definition: {
    category: "starter",
    business_requirement: null,
    assets: [{ kind: "template", filename: "weekly-status-report.docx" }],
    phases: starterPhases(),
  },
}

const THREE_STARTERS = [COMPLIANCE, RISK_REGISTER, WEEKLY_STATUS]

beforeEach(() => {
  vi.clearAllMocks()
  api.listStarterWorkflows.mockResolvedValue(THREE_STARTERS)
})

const renderPicker = (onChoose = vi.fn()) => ({
  onChoose,
  ...render(<StarterTemplatePicker onChoose={onChoose} />),
})

/** Open the door and wait for the rows to land. */
const openDoor = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByTestId("starter-door-trigger"))
  await screen.findByTestId(`starter-door-row-${COMPLIANCE.slug}`)
}

const menuItems = () => screen.queryAllByRole("menuitem")

// ── 1. At rest: ONE line, one interactive element, no panel ───────────────────

describe("StarterTemplatePicker — at rest it is one quiet line", () => {
  it("renders exactly ONE interactive element and no panel DOM", () => {
    const { container } = renderPicker()

    const interactive = container.querySelectorAll(
      "button, a[href], input, textarea, select, [role='menuitem'], [tabindex]",
    )
    expect(interactive).toHaveLength(1)
    expect(interactive[0]).toBe(screen.getByTestId("starter-door-trigger"))

    expect(screen.queryByTestId("starter-door-panel")).toBeNull()
    expect(menuItems()).toHaveLength(0)
  })

  it("carries the imported line, character-identical — it authors no sentence", () => {
    renderPicker()
    expect(screen.getByTestId("starter-door-trigger")).toHaveTextContent(STARTER_DOOR_LINE)
    expect(screen.getByTestId("starter-door-trigger").textContent).toBe(STARTER_DOOR_LINE)
  })

  it("fetches NOTHING on mount — the door is opened far less often than it is rendered", () => {
    renderPicker()
    expect(api.listStarterWorkflows).toHaveBeenCalledTimes(0)
  })

  it("announces itself as a closed menu trigger", () => {
    renderPicker()
    const trigger = screen.getByTestId("starter-door-trigger")
    expect(trigger).toHaveAttribute("aria-haspopup", "menu")
    expect(trigger).toHaveAttribute("aria-expanded", "false")
  })
})

// ── 2. Opening: one fetch, one row per starter ────────────────────────────────

describe("StarterTemplatePicker — opening the door", () => {
  it("fetches the starters ONCE and renders one row per starter", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    expect(api.listStarterWorkflows).toHaveBeenCalledTimes(1)
    expect(menuItems()).toHaveLength(THREE_STARTERS.length)
  })

  it("does not re-fetch on a second open — a successful list is fetched once", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByTestId("starter-door-panel")).toBeNull())

    await user.click(screen.getByTestId("starter-door-trigger"))
    await screen.findByTestId(`starter-door-row-${COMPLIANCE.slug}`)

    expect(api.listStarterWorkflows).toHaveBeenCalledTimes(1)
  })

  it("shows each starter's name and its plain-language sentence", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    for (const starter of THREE_STARTERS) {
      expect(screen.getByTestId(`starter-door-name-${starter.slug}`)).toHaveTextContent(
        starter.name,
      )
      // The sentence comes from the formatter, never from a hand-typed expectation.
      expect(screen.getByTestId(`starter-door-sentence-${starter.slug}`).textContent).toBe(
        starterSeedSentence(starter),
      )
    }
  })

  it("renders the panel's heading and its note from the copy home", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    expect(screen.getByTestId("starter-door-panel")).toHaveAccessibleName(STARTER_DOOR_HEADING)
    expect(screen.getByTestId("starter-door-note").textContent).toBe(STARTER_DOOR_NOTE)
    expect(screen.getByTestId("starter-door-panel")).toHaveTextContent(STARTER_DOOR_HEADING)
  })

  it("identifies each row by its phase SPINE, never by a category icon", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    for (const starter of THREE_STARTERS) {
      const spine = screen.getByTestId(`starter-door-spine-${starter.slug}`)
      // The shipped spine renders one dot per phase — both of them, in order.
      expect(spine.querySelectorAll("[data-phase-type]")).toHaveLength(2)
      expect(spine.querySelector("[data-phase-type='llm_agent']")).not.toBeNull()
      expect(spine.querySelector("[data-phase-type='llm_emit']")).not.toBeNull()
      // Decorative: the name and the sentence carry the meaning.
      expect(spine).toHaveAttribute("aria-hidden", "true")
    }
  })

  it("flips the trigger's aria-expanded when the panel is open", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)
    expect(screen.getByTestId("starter-door-trigger")).toHaveAttribute("aria-expanded", "true")
  })

  it("says so plainly while the list is in flight — never a wordless blank", async () => {
    let release: (rows: unknown) => void = () => {}
    api.listStarterWorkflows.mockReturnValue(
      new Promise((resolve) => {
        release = resolve
      }),
    )

    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByTestId("starter-door-trigger"))

    expect(screen.getByTestId("starter-door-status").textContent).toBe(STARTER_DOOR_LOADING)
    expect(menuItems()).toHaveLength(0)

    release(THREE_STARTERS)
    await screen.findByTestId(`starter-door-row-${COMPLIANCE.slug}`)
    expect(screen.queryByTestId("starter-door-status")).toBeNull()
  })
})

// ── 3. Choosing a row: a sentence, and NOTHING else ───────────────────────────

describe("StarterTemplatePicker — choosing a template seeds the box", () => {
  it("calls onChoose exactly once with the formatter's own sentence", async () => {
    const user = userEvent.setup()
    const { onChoose } = renderPicker()
    await openDoor(user)

    await user.click(screen.getByTestId(`starter-door-row-${RISK_REGISTER.slug}`))

    expect(onChoose).toHaveBeenCalledTimes(1)
    expect(onChoose).toHaveBeenCalledWith(starterSeedSentence(RISK_REGISTER))
  })

  it("seeds the NAME when a starter declares no requirement — never an empty string", async () => {
    const user = userEvent.setup()
    const { onChoose } = renderPicker()
    await openDoor(user)

    await user.click(screen.getByTestId(`starter-door-row-${WEEKLY_STATUS.slug}`))

    const seeded = onChoose.mock.calls[0][0] as string
    expect(seeded).toBe(starterSeedSentence(WEEKLY_STATUS))
    expect(seeded).toBe(WEEKLY_STATUS.name)
    expect(seeded.length).toBeGreaterThan(0)
  })

  it("seeds the right sentence for every row, one at a time", async () => {
    const user = userEvent.setup()
    for (const starter of THREE_STARTERS) {
      const view = renderPicker()
      await openDoor(user)
      await user.click(screen.getByTestId(`starter-door-row-${starter.slug}`))
      expect(view.onChoose).toHaveBeenCalledWith(starterSeedSentence(starter))
      view.unmount()
    }
  })

  it("closes the panel — the describe box is where you land, not a second surface", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    await user.click(screen.getByTestId(`starter-door-row-${COMPLIANCE.slug}`))

    await waitFor(() => expect(screen.queryByTestId("starter-door-panel")).toBeNull())
    expect(menuItems()).toHaveLength(0)
  })

  it("TAKES NO SECOND FORWARD PATH: every create/publish symbol stays at zero", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    await user.click(screen.getByTestId(`starter-door-row-${COMPLIANCE.slug}`))

    expectNoForwardPathTaken()
    // …and the one symbol it MAY call was called exactly once, so the zeros above are
    // not the zeros of a component that did nothing at all.
    expect(api.listStarterWorkflows).toHaveBeenCalledTimes(1)
  })

  it("the zero-calls assertion is a REAL control — it goes red on a planted call", () => {
    api.publishWorkflow("planted")
    expect(() => expectNoForwardPathTaken()).toThrow()
    api.publishWorkflow.mockClear()
    expect(() => expectNoForwardPathTaken()).not.toThrow()
  })
})

// ── 4. Dismissal ──────────────────────────────────────────────────────────────

describe("StarterTemplatePicker — dismissal", () => {
  it("Escape closes the panel", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByTestId("starter-door-panel")).toBeNull())
  })

  it("a press outside closes the panel", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    fireEvent.mouseDown(document.body)

    await waitFor(() => expect(screen.queryByTestId("starter-door-panel")).toBeNull())
  })

  it("a press INSIDE the panel does not close it", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    fireEvent.mouseDown(screen.getByTestId("starter-door-panel"))

    expect(screen.getByTestId("starter-door-panel")).toBeInTheDocument()
  })

  it("closes on an outside press even when propagation is stopped before window", async () => {
    // The CAPTURE-phase choice, made falsifiable. `StepTypePicker` measured this exact
    // failure live on the canvas plane; the describe screen has no d3-zoom today, so the
    // guard is what keeps the choice from being quietly downgraded to bubbling later.
    const user = userEvent.setup()
    render(
      <div>
        {/* Stands in for `.react-flow__pane`: swallows the press in the bubble phase.
            A native button rather than a div so the stand-in is not itself an a11y
            violation the linter has to be argued out of. */}
        <button
          type="button"
          data-testid="swallower"
          onMouseDown={(e) => e.stopPropagation()}
        />
        <StarterTemplatePicker onChoose={vi.fn()} />
      </div>,
    )
    await openDoor(user)

    fireEvent.mouseDown(screen.getByTestId("swallower"))

    await waitFor(() => expect(screen.queryByTestId("starter-door-panel")).toBeNull())
  })

  it("the trigger still TOGGLES cleanly under a capture-phase outside handler", async () => {
    // Capture fires before the trigger's own click handler, so containment is checked
    // against the ROOT (trigger + panel). If it were checked against the panel alone, a
    // press on the trigger would dismiss and the click would immediately reopen — the
    // door would never close by its own line.
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    await user.click(screen.getByTestId("starter-door-trigger"))

    await waitFor(() => expect(screen.queryByTestId("starter-door-panel")).toBeNull())
  })

  it("closed renders NOTHING of the panel — no hidden DOM, no stale focus trap", async () => {
    const user = userEvent.setup()
    const { container } = renderPicker()
    await openDoor(user)
    await user.keyboard("{Escape}")

    await waitFor(() => expect(screen.queryByTestId("starter-door-panel")).toBeNull())
    expect(container.querySelectorAll("[role='menu'], [role='menuitem']")).toHaveLength(0)
    expect(container.querySelectorAll("button")).toHaveLength(1)
  })
})

// ── 5. Honest failure: the sentence, and ZERO rows ────────────────────────────

describe("StarterTemplatePicker — a failed fetch invents nothing", () => {
  it("renders the imported failure sentence and no rows", async () => {
    api.listStarterWorkflows.mockRejectedValue(new Error("network is down"))

    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByTestId("starter-door-trigger"))

    const status = await screen.findByTestId("starter-door-status")
    expect(status.textContent).toBe(STARTER_DOOR_UNAVAILABLE)
    expect(menuItems()).toHaveLength(0)
  })

  it("does NOT fall back to a remembered list from an earlier successful open", async () => {
    // A successful open first, so there IS something a cache could have remembered.
    const first = renderPicker()
    const firstUser = userEvent.setup()
    await openDoor(firstUser)
    expect(screen.getByTestId(`starter-door-name-${COMPLIANCE.slug}`)).toBeInTheDocument()
    first.unmount()

    // Then a fresh mount whose request fails. Nothing may survive but the server's answer.
    api.listStarterWorkflows.mockRejectedValue(new Error("network is down"))
    renderPicker()
    const secondUser = userEvent.setup()
    await secondUser.click(screen.getByTestId("starter-door-trigger"))

    const status = await screen.findByTestId("starter-door-status")
    expect(status.textContent).toBe(STARTER_DOOR_UNAVAILABLE)
    expect(screen.getByTestId("starter-door-panel").textContent).not.toContain(COMPLIANCE.name)
    expect(menuItems()).toHaveLength(0)
  })

  it("keeps 'we could not look' and 'there are none' as DIFFERENT sentences", async () => {
    api.listStarterWorkflows.mockResolvedValue([])

    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByTestId("starter-door-trigger"))

    const status = await screen.findByTestId("starter-door-status")
    expect(status.textContent).toBe(STARTER_DOOR_EMPTY)
    expect(status.textContent).not.toBe(STARTER_DOOR_UNAVAILABLE)
    expect(menuItems()).toHaveLength(0)
  })

  it("a failure takes no forward path either", async () => {
    api.listStarterWorkflows.mockRejectedValue(new Error("network is down"))

    const user = userEvent.setup()
    renderPicker()
    await user.click(screen.getByTestId("starter-door-trigger"))
    await screen.findByTestId("starter-door-status")

    expectNoForwardPathTaken()
  })
})

// ── 6. Totality: a malformed row must not crash the door ──────────────────────

describe("StarterTemplatePicker — TOTALITY over server-shaped JSONB", () => {
  it("renders a starter with no definition at all without throwing", async () => {
    api.listStarterWorkflows.mockResolvedValue([
      { id: "a", slug: "bare", name: "Bare Starter" },
      { id: "b", slug: "nulled", name: "Nulled Starter", definition: null },
      { id: "c", slug: "phaseless", name: "Phaseless Starter", definition: { phases: null } },
    ])

    const user = userEvent.setup()
    const { onChoose } = renderPicker()
    await user.click(screen.getByTestId("starter-door-trigger"))
    await screen.findByTestId("starter-door-row-bare")

    expect(menuItems()).toHaveLength(3)

    await user.click(screen.getByTestId("starter-door-row-nulled"))
    expect(onChoose).toHaveBeenCalledWith("Nulled Starter")
  })
})

// ── 7. The ⌥ reveal, fail-closed outside a provider ───────────────────────────

describe("StarterTemplatePicker — the technical-names reveal", () => {
  it("renders plain language and no slug with no provider mounted", async () => {
    const user = userEvent.setup()
    renderPicker()
    await openDoor(user)

    const panel = screen.getByTestId("starter-door-panel")
    for (const starter of THREE_STARTERS) {
      expect(panel.textContent).not.toContain(starter.slug)
      expect(screen.queryByTestId(`starter-door-technical-${starter.slug}`)).toBeNull()
    }
    expect(screen.queryByRole("switch")).toBeNull()
    expect(screen.queryByRole("checkbox")).toBeNull()
  })
})

// ── 8. THE SOURCE FENCE (the shipped `?raw` house idiom) ──────────────────────

describe("StarterTemplatePicker — source purity: exactly one API symbol", () => {
  it("names `listStarterWorkflows` and imports from the API client exactly once", () => {
    expect(starterTemplatePickerSource).toMatch(/listStarterWorkflows/)
    const apiImports = starterTemplatePickerSource.match(/from\s+["']@\/lib\/api["']/g) ?? []
    expect(apiImports).toHaveLength(1)
  })

  it("NAMES no way a workflow could be created, changed or promoted", () => {
    // This is the fence that makes "the picker never forks" a SOURCE property. A
    // behaviour test only covers the paths this suite walked.
    for (const symbol of FORWARD_PATH_SYMBOLS) {
      expect(starterTemplatePickerSource).not.toMatch(new RegExp(symbol))
    }
    expect(starterTemplatePickerSource).not.toMatch(/useNavigate|navigate\(|setDrafted/)
  })

  it("adds no dependency and hand-rolls its panel", () => {
    expect(starterTemplatePickerSource).not.toMatch(/@radix-ui/)
    expect(starterTemplatePickerSource).not.toMatch(/popover/i)
  })

  it("holds no store reference — it writes through `onChoose` and nowhere else", () => {
    expect(starterTemplatePickerSource).not.toMatch(/builderStore|useBuilderStore|BuilderStoreProvider/)
    expect(starterTemplatePickerSource).toMatch(/onChoose/)
  })

  it("POSITIVE CONTROL — it DOES take its sentences from the one copy home", () => {
    expect(starterTemplatePickerSource).toMatch(
      /from\s+["']@\/components\/workflows\/definitionOps["']/,
    )
    expect(starterTemplatePickerSource).toMatch(/STARTER_DOOR_LINE/)
    expect(starterTemplatePickerSource).toMatch(/starterSeedSentence/)
  })

  it("declares no glyph map of its own and renders the shared spine", () => {
    expect(starterTemplatePickerSource).not.toMatch(/PHASE_GLYPHS/)
    expect(starterTemplatePickerSource).toMatch(/PhaseSpine/)
  })

  it("closed renders nothing, and no authored string reaches the DOM as HTML", () => {
    expect(starterTemplatePickerSource).toMatch(/if \(!open\) return null/)
    expect(starterTemplatePickerSource).not.toMatch(/dangerouslySetInnerHTML/)
  })

  it("uses the OPTIONAL technical-names accessor, never the throwing one", () => {
    expect(starterTemplatePickerSource).toMatch(/useTechnicalNamesOptional\(\)/)
    expect(starterTemplatePickerSource).not.toMatch(/useTechnicalNamesContext\(/)
  })

  it("scopes its request with an AbortController rather than leaving it unbounded", () => {
    expect(starterTemplatePickerSource).toMatch(/new AbortController\(\)/)
    expect(starterTemplatePickerSource).toMatch(/\.abort\(\)/)
  })

  it("those fences are REAL — each pattern matches its planted literal", () => {
    expect('import { createWorkflowDraft } from "@/lib/api"').toMatch(/createWorkflowDraft/)
    expect('await publishWorkflow(id)').toMatch(/publishWorkflow/)
    expect('const nav = useNavigate()').toMatch(/useNavigate|navigate\(|setDrafted/)
    expect('import * as P from "@radix-ui/react-popover"').toMatch(/@radix-ui/)
    expect('import { Popover } from "@/components/ui/popover"').toMatch(/popover/i)
    expect('const s = useBuilderStore()').toMatch(/builderStore|useBuilderStore|BuilderStoreProvider/)
    expect('const PHASE_GLYPHS = {}').toMatch(/PHASE_GLYPHS/)
    expect('<p dangerouslySetInnerHTML={{ __html: x }} />').toMatch(/dangerouslySetInnerHTML/)
    expect('const t = useTechnicalNamesContext()').toMatch(/useTechnicalNamesContext\(/)
    expect('import { x } from "@/lib/api"').toMatch(/from\s+["']@\/lib\/api["']/)
  })
})

// ── 9. The whole-suite network tripwire (must run LAST) ───────────────────────

describe("StarterTemplatePicker — zero real network calls across the entire suite", () => {
  it("the fetch spy recorded exactly 0 calls", () => {
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
