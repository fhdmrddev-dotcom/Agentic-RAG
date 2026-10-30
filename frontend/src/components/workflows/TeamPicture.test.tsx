/**
 * Phase 290-03 (VIS-01, D-06 .. D-16, SC#2-4) — the team picture's DOM proofs.
 *
 * The derivation's truth is pinned by `teamModel.test.ts`. This suite asserts only what the
 * RENDER can get wrong: that every drawn line is a `deriveTeam(...).lines` item (and nothing
 * else), that absence is said once in words, that author text stays text, that nothing in
 * the picture is interactive, and that the ⌥ reveal swaps what it should. Expected words are
 * imported from `teamVocabulary.ts` and compared by exact text, never by testid presence alone.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

import { stripComments } from "@/lib/stripComments.testutil"
import type { PhaseSpecJSON } from "@/components/workflows/phaseVocabulary"
import { GOVERNANCE_SEAL_LABEL } from "@/components/workflows/definitionOps"
import { deriveTeam } from "./teamModel"
import {
  FAIL_LEAD,
  JUMP_LINE_LABEL,
  LEDGER_HEADING,
  LEDGER_NO_LINKS,
  ORCHESTRATOR_SUB,
  ORCHESTRATOR_SUB_ONE,
  TEAM_CAPTION,
  TEAM_EMPTY_BODY,
  TEAM_EMPTY_HEADING,
  TEAM_NO_GATES,
  TEAM_NO_JUDGE,
  TEAM_ONE_STEP,
  TEAM_SWITCH_LABEL,
  TEAM_SWITCH_STEPS,
  TEAM_SWITCH_TEAM,
  ledgerSeats,
  orchestratorTitle,
  seatsLabel,
  teamFigureLabel,
} from "./teamVocabulary"
import {
  branching,
  emptyDraft,
  literatureReview,
  planExecuteVerify,
  singlePhase,
} from "./__fixtures__/canvasFixtures"
import {
  batchTwenty,
  groundedThreeStep,
  productionTwoStep,
  vendorRiskReview,
} from "./__fixtures__/teamFixtures"
import { TeamPicture, TeamViewSwitch } from "./TeamPicture"
import teamPictureSource from "./TeamPicture?raw"

const NAME = "Vendor review"

function renderPicture(
  phases: PhaseSpecJSON[],
  opts: { kbTools?: string[]; showTechnical?: boolean } = {},
) {
  return render(
    <TeamPicture
      phases={phases}
      kbTools={opts.kbTools ?? []}
      nameContext={{}}
      showTechnical={opts.showTechnical ?? false}
      workflowName={NAME}
    />,
  )
}

const figure = () => screen.getByRole("figure", { name: teamFigureLabel(NAME) })
const lineEls = (root: ParentNode) => Array.from(root.querySelectorAll("[data-line-kind]"))
const pairs = (root: ParentNode) =>
  lineEls(root)
    .map((el) => `${el.getAttribute("data-line-kind")}|${el.getAttribute("data-line-source")}`)
    .sort()
const modelPairs = (phases: PhaseSpecJSON[], kbTools: string[] = []) =>
  deriveTeam(phases, kbTools).lines.map((l) => `${l.kind}|${l.source}`).sort()
const textOf = (el: Element) => (el.textContent ?? "").trim()

describe("TeamPicture — production-shaped 2-step (no gate)", () => {
  it("names the figure, the orchestrator and two steps", () => {
    renderPicture(productionTwoStep)
    const fig = figure()
    const orch = within(fig).getByTestId("team-orchestrator")
    expect(orch.textContent).toContain(orchestratorTitle(2))
    expect(orch.textContent).toContain(ORCHESTRATOR_SUB)
    expect(fig.querySelectorAll("li[data-testid='team-step']")).toHaveLength(2)
  })

  it("says 'nothing checks this work' exactly once and draws no gate card", () => {
    renderPicture(productionTwoStep)
    expect(screen.getAllByText(TEAM_NO_GATES)).toHaveLength(1)
    expect(screen.queryAllByTestId("team-gate")).toHaveLength(0)
  })

  it("draws exactly the model's lines: two handoffs, no jump", () => {
    const { container } = renderPicture(productionTwoStep)
    expect(pairs(container)).toEqual(modelPairs(productionTwoStep))
    expect(lineEls(container).map((el) => el.getAttribute("data-line-kind"))).toEqual([
      "handoff",
      "handoff",
    ])
    expect(container.querySelector("[data-line-kind='jump']")).toBeNull()
    expect(container.textContent).not.toContain(JUMP_LINE_LABEL)
  })

  it("carries the caption that says steps never pass work to each other", () => {
    renderPicture(productionTwoStep)
    expect(textOf(screen.getByTestId("team-caption"))).toBe(TEAM_CAPTION)
  })
})

describe("TeamPicture — plan_execute_verify (checks, no judge)", () => {
  it("says 'checked by rule' once, with a worded check card and no jump", () => {
    const { container } = renderPicture(planExecuteVerify)
    expect(screen.getAllByText(TEAM_NO_JUDGE)).toHaveLength(1)
    expect(screen.queryByText(TEAM_NO_GATES)).toBeNull()
    const gates = screen.getAllByTestId("team-gate")
    expect(gates).toHaveLength(1)
    expect(textOf(within(gates[0]).getByTestId("team-gate-eyebrow"))).toBe("Check · step 3")
    expect(textOf(within(gates[0]).getByTestId("team-gate-failure"))).toBe(
      "If it fails: redo the step (up to 2 times), then stop the run",
    )
    expect(container.querySelector("[data-line-kind='jump']")).toBeNull()
    expect(pairs(container)).toEqual(modelPairs(planExecuteVerify))
  })
})

describe("TeamPicture — branching (the one resolvable jump)", () => {
  it("draws exactly one jump, sourced from the model, labelled once", () => {
    const { container } = renderPicture(branching)
    const jumps = container.querySelectorAll("[data-line-kind='jump']")
    expect(jumps).toHaveLength(1)
    const modelJump = deriveTeam(branching).lines.filter((l) => l.kind === "jump")
    expect(modelJump).toHaveLength(1)
    expect(jumps[0].getAttribute("data-line-source")).toBe(modelJump[0].source)
    expect(screen.getAllByText(JUMP_LINE_LABEL)).toHaveLength(1)
  })

  it("says the jump in words on the owning check", () => {
    renderPicture(branching)
    const failure = textOf(screen.getByTestId("team-gate-failure"))
    expect(failure.startsWith(FAIL_LEAD)).toBe(true)
    expect(failure).toContain("⤳ jump to step 4")
  })
})

describe("TeamPicture — the 7-step stress shape", () => {
  it("lists the seven steps in run order", () => {
    renderPicture(vendorRiskReview)
    const steps = within(figure()).getAllByTestId("team-step")
    expect(steps).toHaveLength(7)
    expect(steps.map((s) => s.getAttribute("data-step-number"))).toEqual([
      "1", "2", "3", "4", "5", "6", "7",
    ])
    const model = deriveTeam(vendorRiskReview)
    steps.forEach((s, i) => {
      expect(textOf(within(s).getByTestId("team-step-title"))).toBe(model.steps[i].title)
    })
  })

  it("draws the judge with its eyebrow and its criteria in curly quotes, and no absence line", () => {
    renderPicture(vendorRiskReview)
    const judges = screen
      .getAllByTestId("team-gate")
      .filter((g) => g.getAttribute("data-gate-kind") === "judge")
    expect(judges).toHaveLength(1)
    expect(textOf(within(judges[0]).getByTestId("team-gate-eyebrow"))).toBe("Judge · step 3")
    expect(textOf(within(judges[0]).getByTestId("team-gate-criteria"))).toBe(
      "“Every vendor risk names its evidence”",
    )
    expect(screen.queryByTestId("team-absence")).toBeNull()
    expect(screen.queryByText(TEAM_NO_GATES)).toBeNull()
    expect(screen.queryByText(TEAM_NO_JUDGE)).toBeNull()
  })

  it("every rendered (kind, source) pair is a lines[] item, and the counts match", () => {
    const { container } = renderPicture(vendorRiskReview)
    const model = deriveTeam(vendorRiskReview)
    expect(lineEls(container)).toHaveLength(model.lines.length)
    expect(pairs(container)).toEqual(modelPairs(vendorRiskReview))
    for (const el of lineEls(container)) {
      expect(el.tagName.toLowerCase()).toBe("path")
      expect(el.getAttribute("data-testid")).toBe("team-line")
    }
  })
})

describe("TeamPicture — one step and zero steps (D-12)", () => {
  it("a 1-step workflow shows the orchestrator, one step, one handoff and the words", () => {
    const { container } = renderPicture(singlePhase)
    const fig = figure()
    expect(screen.getAllByText(TEAM_ONE_STEP)).toHaveLength(1)
    expect(within(fig).getAllByTestId("team-step")).toHaveLength(1)
    expect(within(fig).getByTestId("team-orchestrator").textContent).toContain(
      ORCHESTRATOR_SUB_ONE,
    )
    expect(container.querySelectorAll("[data-line-kind='handoff']")).toHaveLength(1)
    expect(lineEls(container)).toHaveLength(1)
    expect(screen.queryAllByTestId("team-gate")).toHaveLength(0)
    expect(screen.queryAllByTestId("team-seat-dot")).toHaveLength(0)
  })

  it("0 steps shows the empty state, no orchestrator and no lines", () => {
    const { container } = renderPicture(emptyDraft)
    expect(textOf(screen.getByText(TEAM_EMPTY_HEADING))).toBe(TEAM_EMPTY_HEADING)
    expect(textOf(screen.getByText(TEAM_EMPTY_BODY))).toBe(TEAM_EMPTY_BODY)
    expect(screen.queryByTestId("team-orchestrator")).toBeNull()
    expect(lineEls(container)).toHaveLength(0)
    expect(container.querySelector("path")).toBeNull()
  })
})

describe("TeamPicture — batch seats (D-14)", () => {
  it("literature_review draws 5 seat dots and 'up to 5 at once'", () => {
    renderPicture(literatureReview)
    expect(screen.getAllByTestId("team-seat-dot")).toHaveLength(5)
    expect(screen.getAllByText(seatsLabel(5))).toHaveLength(1)
  })

  it("twenty seats draw 8 dots and still say twenty", () => {
    renderPicture(batchTwenty)
    expect(screen.getAllByTestId("team-seat-dot")).toHaveLength(8)
    expect(screen.getAllByText(seatsLabel(20))).toHaveLength(1)
  })
})

describe("TeamPicture — derived citations check (D-17, D-18)", () => {
  it("a grounded step carries a 'Must prove it' check that asks you once redos run out", () => {
    renderPicture(groundedThreeStep, { kbTools: ["search_documents"] })
    const gates = screen.getAllByTestId("team-gate")
    expect(gates).toHaveLength(1)
    expect(gates[0].getAttribute("data-gate-kind")).toBe("check")
    expect(textOf(within(gates[0]).getByTestId("team-gate-words"))).toBe(GOVERNANCE_SEAL_LABEL)
    expect(textOf(within(gates[0]).getByTestId("team-gate-failure"))).toBe(
      "If it fails: redo the step (up to 2 times), then ask you",
    )
    expect(screen.queryByText(TEAM_NO_GATES)).toBeNull()
    expect(screen.getAllByText(TEAM_NO_JUDGE)).toHaveLength(1)
  })
})

describe("TeamPicture — ⌥ Technical names (D-15, D-16)", () => {
  it("swaps role rows and gate words, hides the criteria and shows the ledger", () => {
    const { container } = renderPicture(vendorRiskReview, { showTechnical: true })
    const model = deriveTeam(vendorRiskReview)
    const roles = screen.getAllByTestId("team-step-role").map(textOf)
    expect(roles).toEqual(model.steps.map((s) => s.technical))
    const words = screen.getAllByTestId("team-gate-words").map(textOf)
    expect(words).toEqual(model.gates.map((g) => g.kind || g.words))
    expect(screen.queryByTestId("team-gate-criteria")).toBeNull()

    const ledger = screen.getByTestId("team-ledger")
    expect(textOf(within(ledger).getByTestId("team-ledger-heading"))).toBe(LEDGER_HEADING)
    const rows = within(ledger).getAllByTestId("team-ledger-row")
    expect(rows).toHaveLength(model.lines.length)
    rows.forEach((row, i) => {
      expect(textOf(within(row).getByTestId("team-ledger-source"))).toBe(model.lines[i].source)
    })
    const seatRows = within(ledger).getAllByTestId("team-ledger-seat")
    const batch = model.steps.filter((s) => s.seats !== null)
    expect(seatRows).toHaveLength(batch.length)
    expect(textOf(within(seatRows[0]).getByTestId("team-ledger-seat-words"))).toBe(
      ledgerSeats(batch[0].number, batch[0].seats ?? 0),
    )
    expect(textOf(within(seatRows[0]).getByTestId("team-ledger-source"))).toBe(
      batch[0].seatSource,
    )
    const last = ledger.lastElementChild
    expect(last && textOf(last)).toBe(LEDGER_NO_LINKS)
    // The ledger's stroke samples are not drawn lines: the line set is unchanged.
    expect(pairs(container)).toEqual(modelPairs(vendorRiskReview))
  })

  it("with ⌥ off: role rows are the plain words and no ledger renders", () => {
    renderPicture(vendorRiskReview)
    const model = deriveTeam(vendorRiskReview)
    expect(screen.getAllByTestId("team-step-role").map(textOf)).toEqual(
      model.steps.map((s) => s.role),
    )
    expect(screen.queryByTestId("team-ledger")).toBeNull()
    expect(screen.queryByText(LEDGER_HEADING)).toBeNull()
  })
})

describe("TeamPicture — hostile author text stays text (T-290-10)", () => {
  const hostile: PhaseSpecJSON[] = [
    {
      slug: "x",
      phase_index: 0,
      name: "<img src=x onerror=alert(1)>",
      config: { phase_type: "llm_single" },
      validators: [{ kind: "llm_judge_rubric", config: { criteria: "<b>x</b>" } }],
    } as unknown as PhaseSpecJSON,
  ]

  it("renders the name and criteria literally, creating no img and no b element", () => {
    renderPicture(hostile)
    const fig = figure()
    expect(textOf(within(fig).getByTestId("team-step-title"))).toBe(
      "<img src=x onerror=alert(1)>",
    )
    expect(textOf(within(fig).getByTestId("team-gate-criteria"))).toBe("“<b>x</b>”")
    expect(fig.querySelector("img")).toBeNull()
    expect(fig.querySelector("b")).toBeNull()
  })

  it("under ⌥ the ledger also keeps the text literal", () => {
    renderPicture(hostile, { showTechnical: true })
    const ledger = screen.getByTestId("team-ledger")
    expect(ledger.querySelector("img")).toBeNull()
    expect(ledger.querySelector("b")).toBeNull()
  })
})

describe("TeamPicture — nothing is interactive (D-06)", () => {
  it.each([
    ["vendorRiskReview", vendorRiskReview],
    ["branching", branching],
    ["singlePhase", singlePhase],
  ] as const)("%s: no button, link, input or tab stop in the figure", (_name, phases) => {
    renderPicture(phases, { showTechnical: true })
    const fig = figure()
    expect(fig.querySelectorAll("button, a, input, select, textarea, [tabindex]")).toHaveLength(0)
    const ledger = screen.getByTestId("team-ledger")
    expect(ledger.querySelectorAll("button, a, input, [tabindex]")).toHaveLength(0)
  })

  it("gate cards carry no glyph (icon convention §4)", () => {
    renderPicture(vendorRiskReview)
    const gates = screen.getAllByTestId("team-gate")
    expect(gates.length).toBeGreaterThan(0)
    for (const g of gates) {
      expect(g.querySelector("svg, img")).toBeNull()
    }
    // Positive control: step nodes DO carry their glyph, so the query can find an svg.
    const steps = screen.getAllByTestId("team-step")
    expect(steps[0].querySelector("svg")).not.toBeNull()
  })
})

// ── line geometry (290 WR-03, WR-04) ──────────────────────────────────────────────────────

/** A planted layout: 128px columns with a 16px gap, gates indented 16px and stacked 8px apart. */
function plantedRect(el: Element): DOMRect {
  const id = (el as HTMLElement).dataset?.teamNode ?? ""
  let r = { left: 0, top: 0, right: 0, bottom: 0 }
  const step = /^step-(\d+)$/.exec(id)
  const gate = /^gate-(\d+)-(\w+)$/.exec(id)
  if (id === "orchestrator") r = { left: 200, top: 0, right: 500, bottom: 60 }
  else if (step) {
    const left = Number(step[1]) * 144
    r = { left, top: 120, right: left + 128, bottom: 200 }
  } else if (gate) {
    const left = Number(gate[1]) * 144
    const siblings = Array.from(document.querySelectorAll(`[data-team-node^="gate-${gate[1]}-"]`))
    const top = 232 + siblings.indexOf(el) * 60
    r = { left: left + 16, top, right: left + 128, bottom: top + 52 }
  }
  const { left, top, right, bottom } = r
  return { x: left, y: top, left, top, right, bottom, width: right - left, height: bottom - top, toJSON: () => r }
}

type Seg = { x1: number; y1: number; x2: number; y2: number }

/** Every straight run of an `M … H … V …` path. */
function segments(d: string): Seg[] {
  const out: Seg[] = []
  let x = 0
  let y = 0
  for (const [, cmd, args] of d.matchAll(/([MHV])\s*([^MHV]*)/g)) {
    const nums = args.trim().split(/\s+/).map(Number)
    if (cmd === "M") [x, y] = nums
    else {
      const next = cmd === "H" ? { x: nums[0], y } : { x, y: nums[0] }
      out.push({ x1: x, y1: y, x2: next.x, y2: next.y })
      ;({ x, y } = next)
    }
  }
  return out
}

/** Whether a straight run passes through the strict inside of a box (its edges do not count). */
const crosses = (s: Seg, b: DOMRect) =>
  Math.max(s.x1, s.x2) > b.left &&
  Math.min(s.x1, s.x2) < b.right &&
  Math.max(s.y1, s.y2) > b.top &&
  Math.min(s.y1, s.y2) < b.bottom

/** Whether two runs lie on the same line and share a stretch of positive length. */
const shareInk = (a: Seg, b: Seg) => {
  if (a.y1 === a.y2 && b.y1 === b.y2 && a.y1 === b.y1) {
    return Math.min(Math.max(a.x1, a.x2), Math.max(b.x1, b.x2)) > Math.max(Math.min(a.x1, a.x2), Math.min(b.x1, b.x2))
  }
  if (a.x1 === a.x2 && b.x1 === b.x2 && a.x1 === b.x1) {
    return Math.min(Math.max(a.y1, a.y2), Math.max(b.y1, b.y2)) > Math.max(Math.min(a.y1, a.y2), Math.min(b.y1, b.y2))
  }
  return false
}

/** Four steps; step 1 has three gates, two of them jumps whose column ranges overlap. */
const crowded: PhaseSpecJSON[] = [
  {
    slug: "a",
    phase_index: 0,
    config: { phase_type: "llm_agent" },
    validators: [
      { kind: "regex_match", on_failure: "skip_to_phase:d" },
      { kind: "llm_judge_rubric", config: { criteria: "Is it right" } },
      { kind: "structure_check", on_failure: "skip_to_phase:c" },
    ],
  },
  {
    slug: "b",
    phase_index: 1,
    config: { phase_type: "llm_single" },
    validators: [{ kind: "regex_match", on_failure: "skip_to_phase:c" }],
  },
  { slug: "c", phase_index: 2, config: { phase_type: "llm_single" } },
  { slug: "d", phase_index: 3, config: { phase_type: "external_action" } },
]

describe("TeamPicture — lines never imply a link the definition lacks (WR-03, WR-04)", () => {
  const drawn = (phases: PhaseSpecJSON[]) => {
    const spy = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function (this: Element) {
      return plantedRect(this)
    })
    try {
      const { container } = renderPicture(phases)
      const nodes = Array.from(container.querySelectorAll("[data-team-node]")).map(plantedRect)
      const lines = Array.from(container.querySelectorAll<SVGPathElement>("[data-line-kind]")).map((el) => ({
        kind: el.getAttribute("data-line-kind"),
        segs: segments(el.getAttribute("d") ?? ""),
      }))
      return { nodes, lines }
    } finally {
      spy.mockRestore()
    }
  }

  it("POSITIVE CONTROL — the detectors fire on the old straight-up and shared-lane shapes", () => {
    const upper = plantedRect({ dataset: { teamNode: "" } } as unknown as Element)
    expect(upper.width).toBe(0)
    // The pre-fix gate line: straight up through the gate card above it.
    const card = { left: 16, top: 232, right: 128, bottom: 284 } as DOMRect
    expect(crosses({ x1: 72, y1: 292, x2: 72, y2: 200 }, card)).toBe(true)
    // A run along a card's edge is not inside it.
    expect(crosses({ x1: 16, y1: 300, x2: 16, y2: 200 }, card)).toBe(false)
    // The pre-fix jumps: every horizontal run on one y.
    expect(shareInk({ x1: 64, y1: 380, x2: 496, y2: 380 }, { x1: 208, y1: 380, x2: 352, y2: 380 })).toBe(true)
    expect(shareInk({ x1: 64, y1: 380, x2: 496, y2: 380 }, { x1: 208, y1: 402, x2: 352, y2: 402 })).toBe(false)
  })

  it.each([
    ["crowded", crowded],
    ["vendorRiskReview", vendorRiskReview],
    ["branching", branching],
  ] as const)("%s: no line passes through the inside of any card", (_name, phases) => {
    const { nodes, lines } = drawn(phases as PhaseSpecJSON[])
    expect(lines.length).toBeGreaterThan(0)
    expect(lines.every((l) => l.segs.length > 0)).toBe(true)
    for (const { kind, segs } of lines) {
      for (const s of segs) {
        for (const b of nodes) expect(crosses(s, b), `${kind} ${JSON.stringify(s)}`).toBe(false)
      }
    }
  })

  it("crowded: no two jumps share a stretch of line, and each label has its own lane", () => {
    const { lines } = drawn(crowded)
    const jumps = lines.filter((l) => l.kind === "jump")
    expect(jumps).toHaveLength(3)
    for (let i = 0; i < jumps.length; i += 1) {
      for (let j = i + 1; j < jumps.length; j += 1) {
        // The last run INTO a shared target step may meet at that step; every other run is apart.
        const a = jumps[i].segs.slice(0, -1)
        const b = jumps[j].segs.slice(0, -1)
        for (const s of a) for (const t of b) expect(shareInk(s, t), `jump ${i} vs ${j}`).toBe(false)
      }
    }
    const lanes = jumps.map((l) => l.segs[2].y1)
    expect(new Set(lanes).size).toBe(3)
  })

  it("crowded: a step's gates each have their own rail", () => {
    const { lines } = drawn(crowded)
    const checks = lines.filter((l) => l.kind === "check" || l.kind === "judge")
    for (let i = 0; i < checks.length; i += 1) {
      for (let j = i + 1; j < checks.length; j += 1) {
        for (const s of checks[i].segs) for (const t of checks[j].segs) expect(shareInk(s, t)).toBe(false)
      }
    }
  })
})

describe("TeamPicture — accessibility", () => {
  it("has no axe violations on the 7-step stress shape", async () => {
    const { container } = renderPicture(vendorRiskReview, { showTechnical: true })
    expect(await axe(container)).toHaveNoViolations()
  })

  it("has no axe violations on a single step", async () => {
    const { container } = renderPicture(singlePhase)
    expect(await axe(container)).toHaveNoViolations()
  })
})

describe("TeamViewSwitch", () => {
  it("is a tablist with two worded tabs, the current one selected", () => {
    render(<TeamViewSwitch view="steps" onChange={() => {}} />)
    const list = screen.getByRole("tablist", { name: TEAM_SWITCH_LABEL })
    const tabs = within(list).getAllByRole("tab")
    expect(tabs.map(textOf)).toEqual([TEAM_SWITCH_STEPS, TEAM_SWITCH_TEAM])
    expect(tabs[0].getAttribute("data-testid")).toBe("canvas-view-steps")
    expect(tabs[1].getAttribute("data-testid")).toBe("canvas-view-team")
    expect(tabs[0].getAttribute("aria-selected")).toBe("true")
    expect(tabs[1].getAttribute("aria-selected")).toBe("false")
    expect(list.querySelector("svg, img")).toBeNull()
  })

  it("calls onChange with the clicked view", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<TeamViewSwitch view="team" onChange={onChange} />)
    expect(screen.getByTestId("canvas-view-team").getAttribute("aria-selected")).toBe("true")
    await user.click(screen.getByRole("tab", { name: TEAM_SWITCH_STEPS }))
    expect(onChange).toHaveBeenCalledWith("steps")
    await user.click(screen.getByRole("tab", { name: TEAM_SWITCH_TEAM }))
    expect(onChange).toHaveBeenLastCalledWith("team")
  })
})

describe("TeamPicture — source fence (?raw, code only)", () => {
  const code = stripComments(teamPictureSource)
  const NEEDLES: [string, RegExp][] = [
    ["dangerouslySetInnerHTML", /dangerouslySetInnerHTML/],
    ["innerHTML", /innerHTML/],
    ["@xyflow import", /from\s+["']@xyflow\//],
    ["@/lib/api import", /from\s+["']@\/lib\/api(?:\/|["'])/],
  ]

  it("positive control: the source is the real module", () => {
    expect(code).toContain("deriveTeam(")
    expect(code).toContain("export function TeamPicture")
  })

  it.each(NEEDLES)("positive control: the %s needle fires on a planted line", (_n, re) => {
    const planted = [
      'import { x } from "@xyflow/react"',
      'import { y } from "@/lib/api"',
      "el.innerHTML = s",
      "<div dangerouslySetInnerHTML={{ __html: s }} />",
    ].join("\n")
    expect(re.test(planted)).toBe(true)
  })

  it.each(NEEDLES)("TeamPicture.tsx contains no %s", (_n, re) => {
    expect(re.test(code)).toBe(false)
  })
})

describe("TeamPicture — 302-02 (FE-IN-06 / D-11): the scroll region and the figure are named apart", () => {
  it.each([
    ["populated", undefined],
    ["empty", "empty"],
  ] as const)("%s: region 'Team view, scrollable', figure 'Team picture for {name}'", (_n, arm) => {
    if (arm === "empty") renderPicture(emptyDraft)
    else renderPicture(productionTwoStep)
    const region = screen.getByRole("region", { name: "Team view, scrollable" })
    expect(region).toBeInTheDocument()
    const figs = screen.getAllByRole("figure", { name: teamFigureLabel(NAME) })
    expect(figs).toHaveLength(1)
    expect(region.getAttribute("aria-label")).not.toBe(figs[0].getAttribute("aria-label"))
  })
})
