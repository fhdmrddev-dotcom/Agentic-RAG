/**
 * Phase 200 — THE STEP-PANEL PORT, GUARDED.
 *
 * ⚠ WHY A NEW FILE RATHER THAN MORE CASES IN `PhaseFormPanel.test.tsx`. That suite's own
 * verdicts are what let this rework be necessary: it reported `13/14` atoms GREEN on a screen
 * the operator then said was not what was designed. Its cases are not wrong — every one of
 * them still passes here, untouched — they were derived from `200-CHECKLIST.md`, which was
 * itself derived from a change-log instead of from the screens, so most of what the sheet
 * draws was never in the acceptance bar at all. This file's atoms come from ONE place: the
 * markup of `.planning/sketches/200-journey-interactive/screens/step-panel.html`.
 *
 * ⚠ AND IT ASSERTS THE ABSENCES AS STRICTLY AS THE PRESENCES. The port's riskiest move is not
 * a missing card, it is an INVENTED one — a per-folder lock badge, an `Add a source` button
 * that writes nothing, a checklist row that calls a correct state missing. Each of those is a
 * negative case below, and each carries a positive control so that "nothing is there" cannot
 * be a selector typo reading as a clean surface (`199-03`'s planted-`<a href>` lesson: a
 * source regex cannot see a control composed from a variable and a button scan cannot see a
 * link, so the control scan here is a ROLE SET over the rendered DOM).
 */
import { describe, it, expect, vi } from "vitest"
import { fireEvent, render, screen, within } from "@testing-library/react"

import { PhaseFormPanel, type PhaseFormRails } from "./PhaseFormPanel"
import {
  STEP_CARD_DELIVERS_TITLE,
  STEP_CARD_MODEL_TITLE,
  STEP_CARD_NO_SOURCE_ADD,
  STEP_CARD_OUTSIDE_TITLE,
  STEP_CARD_REACH_TITLE,
  STEP_CARD_WHAT_IT_DOES_TITLE,
} from "./stepCardSectionContext"
import { stepGaps, stillMissingHeading, STEP_ANCHOR_WHAT_IT_DOES } from "./stepReadinessContext"
import { TOOL_PHRASES, toolName } from "./toolNames"
import { TEMPLATE_SECTION_HEADING } from "./TemplateAttachSection"
import type { PhaseSpecJSON } from "./phaseVocabulary"

const noop = () => {}

function phaseOf(config: Record<string, unknown>): PhaseSpecJSON {
  return {
    slug: "p",
    phase_index: 0,
    name: "A phase",
    config: config as PhaseSpecJSON["config"],
  }
}

/** Every id the server can offer, in the server's own `sorted()` order — the real 28. */
const ALL_TOOL_IDS = Object.keys(TOOL_PHRASES).sort()

function railsOf(over: Partial<PhaseFormRails> = {}): PhaseFormRails {
  return { order: { index: 1, total: 3 }, toolOptions: [], gates: [], ...over }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1. THE SHEET'S CARDS — the operator's verdict, made mechanical.
//
// "the sheet composes SEVEN titled cards ending in a readiness checklist; what shipped keeps
// three section HEADINGS and renders the rest as a dense form." So the claim under test is a
// COUNT and an ORDER, not the existence of any one card.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("200 port — the sheet's titled cards", () => {
  it("EVERY step type opens on a titled `What it does` card, not a bare textarea", () => {
    // The sheet's FIRST group, and the one the shipped panel had no title for at all.
    for (const phase_type of [
      "programmatic",
      "llm_single",
      "llm_agent",
      "llm_batch_agents",
      "llm_human_input",
      "llm_emit",
    ]) {
      const { unmount } = render(
        <PhaseFormPanel
          phase={phaseOf({ phase_type, prompt: "x", fn: "f" })}
          open
          onChange={noop}
          onPersist={noop}
          onClose={noop}
        />,
      )
      const card = screen.getByTestId("card-what-it-does")
      expect(card, phase_type).toHaveTextContent(STEP_CARD_WHAT_IT_DOES_TITLE)
      // The anchor is load-bearing: the closing checklist's jump rows aim at it by id.
      expect(card.getAttribute("id"), phase_type).toBe(STEP_ANCHOR_WHAT_IT_DOES)
      unmount()
    }
  })

  it("`external_action` is the ONE type with no instructions card — it has no prompt", () => {
    // A positive control on the loop above: if `card-what-it-does` rendered unconditionally
    // the loop would pass for the wrong reason, and this is what tells the two apart.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "external_action", capability: "send_email" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(screen.queryByTestId("card-what-it-does")).not.toBeInTheDocument()
    expect(screen.getByTestId("card-outside")).toHaveTextContent(STEP_CARD_OUTSIDE_TITLE)
  })

  it("the deliverable reads as SIX titled cards, in the sheet's order", () => {
    // ⚠ ORDER, not just presence. The sheet's reading is a sequence — what it does, which
    // model, what it can reach, what it produces, the file it fills in, how strictly it is
    // held — and a panel with the right cards in the wrong order is still a dense form.
    const { container } = render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_emit", prompt: "x", emitter: "render_template" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        rails={railsOf()}
        template={{ definitionId: "d", onAttached: noop }}
        modelPicker={{ models: [], runDefaultModel: null, noAnswer: "unavailable" }}
      />,
    )
    const headings = Array.from(container.querySelectorAll("h3")).map((h) =>
      (h.textContent ?? "").trim(),
    )
    expect(headings).toEqual([
      // ⚠ THE ORDER RAIL LEADS, and it is not one of the sheet's seven. It is a
      // CANVAS-04 rail the sheet does not draw at all, kept because it states a rule
      // (`phase_index` IS the order and rewiring is not representable) that nothing else on
      // this panel says. Nothing in the reference may be dropped is the rule; nothing outside
      // it may be kept is not.
      "Order is locked",
      STEP_CARD_WHAT_IT_DOES_TITLE,
      STEP_CARD_MODEL_TITLE,
      STEP_CARD_REACH_TITLE,
      STEP_CARD_DELIVERS_TITLE,
      TEMPLATE_SECTION_HEADING,
      "How strictly this step is held",
      "Checks that run on this step",
    ])
  })

  it("the card shape is the sheet's: an OUTSIDE label over an INSET panel", () => {
    // The single largest miss in the first pass, and the reason the result read as "three
    // headings and a form". The sheet nests two elements; the shipped shell was one strip.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    const card = screen.getByTestId("card-reach")
    const heading = within(card).getByRole("heading", { level: 3 })
    // The label is OUTSIDE the panel it names — a direct child of the section, small caps.
    expect(heading.parentElement).toBe(card)
    expect(heading.className).toContain("uppercase")
    // …and the body is a bordered panel DARKER than the aside, which is what reads as a card.
    const body = card.querySelector(".bg-background")
    expect(body).toBeTruthy()
    expect(body?.className).toContain("border")
  })

  it("the tools live INSIDE the reach card, under the sheet's own divider", () => {
    // The sheet composes folders and tools as ONE card in two halves. The shipped panel had
    // the tool list floating between two unrelated number fields, which is why the card
    // titled *what it can reach* read as though it were only about folders.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x", folder_scope: ["f-1"] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        folderNames={{ "f-1": "Contracts" }}
        rails={railsOf({ toolOptions: ["search_documents"] })}
      />,
    )
    const card = screen.getByTestId("card-reach")
    expect(within(card).getByTestId("folder-scope-display")).toHaveTextContent("Contracts")
    expect(within(card).getByTestId("tools-rail")).toBeInTheDocument()
    expect(card.querySelector("hr")).toBeTruthy()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2. THE TOOL WALL — grouped, never truncated.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("200 port — the tool set reads at the sheet's size, and drops nothing", () => {
  function renderAgent(tools: string[], options: string[] = ALL_TOOL_IDS) {
    return render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x", available_tools: tools })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        rails={railsOf({ toolOptions: options })}
      />,
    )
  }

  it("NON-VACUITY — the server really does offer 28 ids, which is the problem being solved", () => {
    expect(ALL_TOOL_IDS.length).toBe(28)
  })

  it("the FIRST reading is the sheet's twelve, not the registry's twenty-eight", () => {
    renderAgent(["read_document", "search_documents"])
    expect(screen.getAllByTestId("tool-option")).toHaveLength(12)
  })

  it("NOTHING IS DROPPED — the reveal opens onto the full 28 and names how many", () => {
    renderAgent(["read_document", "search_documents"])
    const reveal = screen.getByTestId("tools-reveal")
    expect(reveal).toHaveTextContent("Show 16 more")
    fireEvent.click(reveal)
    const shown = screen.getAllByTestId("tool-option").map((el) => el.getAttribute("data-tool"))
    expect(shown).toEqual(ALL_TOOL_IDS)
    // …and it folds back, so the reveal is a reading and not a one-way door.
    expect(screen.getByTestId("tools-reveal")).toHaveTextContent("Show fewer")
  })

  it("⚠ EVERY CHOSEN TOOL IS PINNED OPEN, past the sheet's budget — a decision is never folded", () => {
    // SEED-184 rule 3. Twenty chosen tools means twenty visible chips at the FIRST reading,
    // because what a step can do is the decision the card exists to state.
    const chosen = ALL_TOOL_IDS.slice(0, 20)
    renderAgent(chosen)
    const shown = screen.getAllByTestId("tool-option").map((el) => el.getAttribute("data-tool"))
    for (const id of chosen) expect(shown, id).toContain(id)
    expect(shown.length).toBeGreaterThanOrEqual(20)
  })

  it("⚠ AN UNREGISTERED TOOL IS PINNED OPEN TOO — a finding is never folded", () => {
    // The definition names it, the registry does not offer it, the server answers
    // `unregistered_tool` for it. Folding it would put a finding somewhere the author cannot
    // act on while quietly editing their stored value out of sight.
    renderAgent(["web_scrape"])
    const stray = screen.getByTestId("tools-rail").querySelector('[data-tool="web_scrape"]')
    expect(stray).toBeTruthy()
    expect(stray?.className).toContain("line-through")
    expect(stray?.getAttribute("data-unregistered")).toBe("true")
  })

  it("NO REVEAL when the whole set already fits — never a control that opens onto nothing", () => {
    renderAgent([], ALL_TOOL_IDS.slice(0, 5))
    expect(screen.getAllByTestId("tool-option")).toHaveLength(5)
    expect(screen.queryByTestId("tools-reveal")).not.toBeInTheDocument()
  })

  it("a folded-away chip still commits through the ONE comma seam once revealed", () => {
    const onChange = vi.fn()
    const onPersist = vi.fn()
    const last = ALL_TOOL_IDS[ALL_TOOL_IDS.length - 1]
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x", available_tools: [] })}
        open
        onChange={onChange}
        onPersist={onPersist}
        onClose={noop}
        rails={railsOf({ toolOptions: ALL_TOOL_IDS })}
      />,
    )
    expect(screen.queryByTitle(last)).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId("tools-reveal"))
    fireEvent.click(screen.getByTitle(last))
    expect(onChange).toHaveBeenCalledWith({ available_tools: [last] })
    expect(onPersist).toHaveBeenCalledTimes(1)
  })

  it("every visible chip reads as a PHRASE — no schema token reaches a business user", () => {
    renderAgent(["search_documents"])
    for (const el of screen.getAllByTestId("tool-option")) {
      const id = el.getAttribute("data-tool") ?? ""
      expect((el.textContent ?? "").trim(), id).toBe(toolName(id))
      expect((el.textContent ?? "").trim(), id).not.toBe(id)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3. THE CLOSING CHECKLIST — and the two rows the sketch draws that are REFUSED.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("200 port — what this step is still missing", () => {
  const BASE = {
    phaseType: "llm_agent",
    prompt: "do the thing",
    fn: "",
    outsideSentence: undefined,
  }

  it("a blank prompt is a gap, on every type whose executor reads one", () => {
    for (const phaseType of [
      "llm_single",
      "llm_agent",
      "llm_batch_agents",
      "llm_human_input",
      "llm_emit",
    ]) {
      const gaps = stepGaps({ ...BASE, phaseType, prompt: "   " })
      expect(gaps.map((g) => g.id), phaseType).toContain("prompt")
    }
  })

  it("⚠ REFUSED — a BLANK MODEL is not a gap, because blank means *use the run's model*", () => {
    // The sketch's own first row is `Choose a model`. It is placeholder content, and shipping
    // it would nag every author about a documented default that 239 of 257 real phases hold.
    // There is no model input at all, which is the mechanical form of that refusal.
    const gaps = stepGaps({ ...BASE, phaseType: "llm_agent", prompt: "x" })
    expect(gaps).toEqual([])
  })

  it("⚠ REFUSED — an EMPTY folder scope is not a gap either, and it could not be fixed here", () => {
    // The sketch's second row is `Connect a knowledge source`. A step that reads nothing is a
    // legitimate step, and this panel cannot write `folder_scope` anyway — a checklist row
    // for a thing the surface refuses to let you fix is a dead end wearing a chevron.
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_agent", prompt: "x", folder_scope: [] })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(screen.queryByTestId("step-readiness")).not.toBeInTheDocument()
  })

  it("⚠ NOTHING AT ZERO — never `0 things still missing`, never an all-set", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "programmatic", fn: "summarise" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(screen.queryByTestId("step-readiness")).not.toBeInTheDocument()
  })

  it("the card counts, pluralises, and every row is a REAL control", () => {
    render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_emit", prompt: "", emitter: "render_template" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        template={{ definitionId: "d", onAttached: noop }}
      />,
    )
    const card = screen.getByTestId("step-readiness")
    expect(card).toHaveTextContent(stillMissingHeading(2))
    const rows = within(card).getAllByTestId("step-readiness-row")
    expect(rows.map((r) => r.getAttribute("data-gap"))).toEqual(["prompt", "template"])
    // ⚠ `199-03`'s lesson, taken constructively: the ROW is the control and the chevron is
    // decoration on it. A `<div>` with a chevron would be a control that looks pressable and
    // is not — and a button scan alone would never have noticed.
    for (const row of rows) {
      expect(row.tagName).toBe("BUTTON")
      expect(row.getAttribute("type")).toBe("button")
      expect((row.textContent ?? "").trim().length).toBeGreaterThan(5)
    }
  })

  it("singular reads `1 thing`, plural reads `N things`", () => {
    expect(stillMissingHeading(1)).toBe("1 thing still missing")
    expect(stillMissingHeading(2)).toBe("2 things still missing")
  })

  it("an UNWIRED caller is owed no template row — absence is not emptiness", () => {
    // Every other mount of this panel passes no `template` prop, and a checklist row those
    // surfaces have no attach control to satisfy would be permanently unanswerable.
    expect(
      stepGaps({ ...BASE, phaseType: "llm_emit", prompt: "x" }).map((g) => g.id),
    ).toEqual([])
    expect(
      stepGaps({ ...BASE, phaseType: "llm_emit", prompt: "x", template: {} }).map((g) => g.id),
    ).toEqual(["template"])
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4. WHAT THE SHEET DRAWS THAT IS NOT ON THE WIRE.
// ═══════════════════════════════════════════════════════════════════════════════════════

/** Every way a control could arrive — the role SET, not `button` alone (`199-03`). */
const CONTROL_SELECTOR = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  'input[type="submit"]',
  'input[type="button"]',
].join(", ")

describe("200 port — the sheet's un-backed atoms render nothing, or a statement", () => {
  function renderReach() {
    return render(
      <PhaseFormPanel
        phase={phaseOf({
          phase_type: "llm_agent",
          prompt: "x",
          folder_scope: ["f-1", "f-2"],
        })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        folderNames={{ "f-1": "Contracts", "f-2": "Compliance" }}
      />,
    )
  }

  it("the folders render as the sheet's ROWS, by NAME, with the id reachable and never shown", () => {
    renderReach()
    const scope = screen.getByTestId("folder-scope-display")
    expect(scope).toHaveTextContent("Contracts")
    expect(scope).toHaveTextContent("Compliance")
    expect(scope.querySelector('[title="f-1"]')).toBeTruthy()
    expect(scope.textContent).not.toContain("f-1")
  })

  it("⚠ NO LOCK STATE IS INVENTED — `folder_scope` is a bare string[] and carries no lock bit", () => {
    // The sheet draws `Locked — only the person who locked it can release it` and a `Lock`
    // button per folder. There is no lock field, no holder, no wire channel of any kind, so
    // a badge here would be a fabricated fact on a governance surface. Nothing renders.
    const { container } = renderReach()
    const scope = screen.getByTestId("folder-scope-display")
    expect(scope.textContent ?? "").not.toMatch(/lock/i)
    expect(within(scope).queryAllByRole("button")).toHaveLength(0)
    // POSITIVE CONTROL — the needle really can fire, so its silence above means something.
    const planted = document.createElement("div")
    planted.textContent = "Locked — only the person who locked it can release it"
    container.appendChild(planted)
    expect(container.textContent ?? "").toMatch(/lock/i)
  })

  it("⚠ `Add a source` IS A STATEMENT, NOT A CONTROL — this panel has no write seam for it", () => {
    renderReach()
    const line = screen.getByTestId("no-source-add")
    expect(line).toHaveTextContent(STEP_CARD_NO_SOURCE_ADD)
    // The whole point: it is not pressable, on ANY of the seven ways a control can arrive.
    expect(line.matches(CONTROL_SELECTOR)).toBe(false)
    expect(line.querySelectorAll(CONTROL_SELECTOR)).toHaveLength(0)
    // …and it is a REFUSAL, so it is on screen at rest rather than behind the guidance switch.
    expect(screen.queryAllByTestId("field-help")).toHaveLength(0)
  })

  it("⚠ NO CONSEQUENCE FIGURE — the sheet's `Will overwrite 1,200 records` is not computed", () => {
    // No row count exists anywhere in this product. Inventing one is the highest-consequence
    // defect available on this card, so the absence is asserted rather than assumed.
    const { container } = render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "external_action", capability: "send_email" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
      />,
    )
    expect(container.textContent ?? "").not.toMatch(/\d[\d,]*\s+records?/i)
    expect(container.textContent ?? "").not.toMatch(/overwrite/i)
  })

  it("⚠ NO LIGATURE NAME reaches a text node, anywhere in the ported surface", () => {
    // The sheet draws every mark as a Material Symbols LIGATURE — `folder`, `lock`, `shield`,
    // `chevron_right`, `check_circle`. The product's icon authority is `icon-convention.md`,
    // so none of them may render as visible text. Whole-node matching for the ones that are
    // ordinary English, substring for the ones that never occur in prose.
    const { container } = render(
      <PhaseFormPanel
        phase={phaseOf({ phase_type: "llm_emit", prompt: "", emitter: "render_template" })}
        open
        onChange={noop}
        onPersist={noop}
        onClose={noop}
        rails={railsOf({ toolOptions: ALL_TOOL_IDS })}
        template={{ definitionId: "d", onAttached: noop }}
      />,
    )
    const walker = container.ownerDocument.createTreeWalker(container, NodeFilter.SHOW_TEXT)
    const nodes: string[] = []
    for (let n = walker.nextNode(); n !== null; n = walker.nextNode()) {
      const t = (n.textContent ?? "").trim()
      if (t !== "") nodes.push(t)
    }
    const all = nodes.join(" ")
    for (const lig of ["chevron_right", "check_circle", "priority_high", "account_tree"]) {
      expect(all, lig).not.toContain(lig)
    }
    for (const lig of ["folder", "lock", "shield", "description", "add", "info", "error"]) {
      expect(nodes, lig).not.toContain(lig)
    }
    // POSITIVE CONTROL — both halves of the predicate really can fire.
    expect([...nodes, "folder"]).toContain("folder")
    expect([all, "chevron_right"].join(" ")).toContain("chevron_right")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// ⚠ ADDED, NEVER RE-BASELINED — every case above this banner is untouched by 206.2.
//
// 206.2-03 (RESEARCH Open Question 4) — ONE SHIPPED LIE STOPS BEING TOLD.
//
// `stepGaps` pushes its `capability` row whenever an `external_action` step's
// `outsideSentence` is `undefined`. That sentence is a lookup into the CLOSED capability
// table, so it is `undefined` for every MCP-shaped step FOREVER, however completely the step
// is configured — a *still missing* row that could never be satisfied, on a card whose whole
// premise is that a row is something you can go and fix.
//
// ⚠ THE ROW IS SUPPRESSED, NEVER REPLACED. A step with NEITHER a capability nor a tool still
// needs the shipped sentence, and it is true for it. Case (a) below is the non-vacuity
// control for exactly that half: a careless suppression could delete the row outright and
// every "no row appears" assertion would stay green.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("stepGaps — the MCP shape's permanently-unsatisfiable row (206.2)", () => {
  const OUTSIDE: Parameters<typeof stepGaps>[0] = {
    phaseType: "external_action",
    prompt: "",
    fn: "",
    outsideSentence: undefined,
  }

  it("(a) NON-VACUITY — neither a capability nor a tool STILL yields the row", () => {
    // The half a careless suppression would silently delete. Without this case, "no row
    // appears" below could be satisfied by a `stepGaps` that never pushes the row at all.
    expect(stepGaps(OUTSIDE).map((g) => g.id)).toEqual(["capability"])
    expect(stepGaps({ ...OUTSIDE, toolName: "" }).map((g) => g.id)).toEqual(["capability"])
    expect(stepGaps({ ...OUTSIDE, toolName: undefined }).map((g) => g.id)).toEqual(["capability"])
  })

  it("(b) a step that names an MCP tool is owed no capability row", () => {
    expect(stepGaps({ ...OUTSIDE, toolName: "ask_question" }).map((g) => g.id)).toEqual([])
  })

  it("(c) a WHITESPACE-ONLY tool name behaves as absent — a blank is not an answer", () => {
    // The executor refuses a blank `tool_name` by name ("there is nothing to grant and
    // nothing to invoke"), so a step carrying one has answered neither question and is owed
    // the row exactly as an unconfigured step is.
    expect(stepGaps({ ...OUTSIDE, toolName: "   " }).map((g) => g.id)).toEqual(["capability"])
  })

  // ⚠ NOT the shipped `BASE`, and the reason is scope rather than preference: that literal
  // is declared INSIDE its own `describe`, so it cannot be spread from here without moving
  // it — and moving a shipped declaration is exactly the edit this banner forbids. This is
  // its field-for-field twin, kept beside it deliberately.
  const OTHER_ARMS: Parameters<typeof stepGaps>[0] = {
    phaseType: "llm_agent",
    prompt: "do the thing",
    fn: "",
    outsideSentence: undefined,
  }

  it("(d) the other arms are untouched by the new field", () => {
    expect(
      stepGaps({ ...OTHER_ARMS, phaseType: "llm_agent", prompt: "  ", toolName: "ask_question" })
        .map((g) => g.id),
    ).toEqual(["prompt"])
    expect(
      stepGaps({ ...OTHER_ARMS, phaseType: "programmatic", fn: "", toolName: "ask_question" })
        .map((g) => g.id),
    ).toEqual(["fn"])
    expect(
      stepGaps({
        ...OTHER_ARMS,
        phaseType: "llm_emit",
        prompt: "x",
        template: {},
        toolName: "ask_question",
      }).map((g) => g.id),
    ).toEqual(["template"])
  })
})
