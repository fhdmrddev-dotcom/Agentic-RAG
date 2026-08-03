/**
 * Phase 184-08 Task 3 (VALID-03 · R8 · R9 · D-184-14) — ProblemsTray tests.
 *
 * A plain `render()` with no provider and no canvas-graph shim, because the tray sits
 * OUTSIDE the graph plane — it is a leaf that takes grouped verdicts and calls back.
 * `user-event` is safe here for the same reason (inside the plane it reaches d3-zoom
 * and d3-drag dereferences a null `event.view`; nothing in this file mounts the plane).
 *
 * What is proved, in the plan's order:
 *  R9  — a mid-build draft renders with ZERO destructive-token elements, scanned
 *        against the single exported literal, with a positive control.
 *  R8  — a finding belonging to no step has a home; a finding whose identifier this
 *        client has never seen renders with its server message verbatim.
 *  VALID-03 — the rows change when ONLY the server response changes.
 *  D-184-14 — the two degraded sentences differ by cause, neither reads as clean, and
 *        held-stale findings stay visible rather than being replaced by silence.
 *  Plus: rows jump, the tray never opens itself, and nothing here touches the network.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { ProblemsTray } from "./ProblemsTray"
import { VERDICT_DESTRUCTIVE_TOKEN } from "./nodePresentation"
import { DEGRADED_SENTENCE, groupVerdicts } from "./verdictModel"
import type { PhaseSpecJSON } from "./phaseVocabulary"
// Phase 187-08 additions land as SEPARATE import statements so this file's whole diff
// is added lines only. `toCanvas` is imported for ONE reason: the card↔row agreement
// below compares the tray against the canvas projection itself, not against a literal.
import { nodeTitle } from "./phaseVocabulary"
import { toCanvas } from "./canvasModel"
// Phase 187-27, its own line so this file's diff stays added-lines-only: the clean line,
// IMPORTED so the 187-27 positive control asserts character-identity against the page's
// own constant rather than against a second copy of it.
import { NOTHING_OUTSTANDING } from "./verdictModel"
import type { Verdict } from "@/lib/api"

const PHASES: PhaseSpecJSON[] = [
  { slug: "gather", phase_index: 0, name: "Gather the inputs", config: { phase_type: "programmatic" } },
  { slug: "draft", phase_index: 1, name: "Draft the section", config: { phase_type: "llm_single" } },
  { slug: "emit", phase_index: 2, name: "Write the deliverable", config: { phase_type: "llm_emit" } },
]

function verdict(over: Partial<Verdict> = {}): Verdict {
  return {
    code: "no_terminal",
    phase: "draft",
    message: "the workflow has no terminal phase",
    severity: "error",
    ...over,
  }
}

/** Three "not finished yet" findings and nothing broken — sketch 139's "Mid-build". */
const MID_BUILD: Verdict[] = [
  verdict({ code: "input_unsatisfied", phase: "gather", severity: "incomplete", message: "a" }),
  verdict({ code: "input_unsatisfied", phase: "draft", severity: "incomplete", message: "b" }),
  verdict({ code: "input_unsatisfied", phase: "emit", severity: "incomplete", message: "c" }),
]

function renderTray(
  over: Partial<React.ComponentProps<typeof ProblemsTray>> = {},
  verdicts: readonly Verdict[] = MID_BUILD,
) {
  const onToggle = vi.fn()
  const onJumpToStep = vi.fn()
  const result = render(
    <ProblemsTray
      groups={groupVerdicts(verdicts)}
      phases={PHASES}
      degraded={null}
      checking={false}
      open={false}
      onToggle={onToggle}
      onJumpToStep={onJumpToStep}
      {...over}
    />,
  )
  return { ...result, onToggle, onJumpToStep }
}

/** Count the destructive token in the emitted HTML. One literal, no colour heuristic. */
function destructiveOccurrences(html: string): number {
  return html.split(VERDICT_DESTRUCTIVE_TOKEN).length - 1
}

let fetchSpy: ReturnType<typeof vi.spyOn>

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch")
})

afterEach(() => {
  fetchSpy.mockRestore()
})

describe("ProblemsTray — R9: mid-build must not read as failure", () => {
  it("states the two severities in separate words BEFORE it is opened", () => {
    renderTray({ open: false }, [
      verdict({ phase: "gather", severity: "error" }),
      verdict({ phase: "draft", severity: "incomplete" }),
      verdict({ phase: "emit", severity: "incomplete" }),
    ])
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe(
      "1 problem · 2 things to finish",
    )
    // Closed: the summary is all there is.
    expect(screen.queryByTestId("problems-tray-list")).toBeNull()
  })

  it("3 incomplete / 0 error emits the destructive token ZERO times, closed", () => {
    const { container } = renderTray({ open: false })
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe("3 things to finish")
    expect(screen.getByTestId("problems-tray-counts").textContent).not.toMatch(/problem/i)
    expect(destructiveOccurrences(container.innerHTML)).toBe(0)
  })

  it("…and ZERO times OPEN, where the row marks actually render", () => {
    const { container } = renderTray({ open: true })
    expect(container.querySelectorAll('[data-severity="incomplete"]')).toHaveLength(3)
    expect(destructiveOccurrences(container.innerHTML)).toBe(0)
  })

  it("the POSITIVE CONTROL: one error verdict puts the token back", () => {
    const { container } = renderTray({ open: true }, [
      ...MID_BUILD,
      verdict({ phase: "draft", severity: "error" }),
    ])
    expect(destructiveOccurrences(container.innerHTML)).toBeGreaterThanOrEqual(1)
  })
})

describe("ProblemsTray — R8: a verdict with phase:null has a home (why 139-A beat 139-B)", () => {
  it("renders a visible workflow-wide row when opened, and counts it in the summary", () => {
    renderTray({ open: true }, [
      verdict({
        code: "business_requirement",
        phase: null,
        severity: "incomplete",
        message: "the workflow still needs a one-line description",
      }),
    ])
    const section = screen.getByTestId("problems-tray-workflow-wide")
    expect(section).toBeInTheDocument()
    expect(
      within(section).getByText("the workflow still needs a one-line description"),
    ).toBeInTheDocument()
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe("1 thing to finish")
  })

  it("the workflow-wide section exists even when it is the ONLY content", () => {
    renderTray({ open: true }, [verdict({ phase: null, severity: "error" })])
    expect(screen.getByTestId("problems-tray-workflow-wide")).toBeInTheDocument()
    // No phase-keyed rows at all — the section is not a footer on something else.
    expect(screen.queryByTestId("problems-tray-row-draft-0")).toBeNull()
  })

  it("a workflow-wide row offers no jump, because there is no step to jump to", () => {
    const { container } = renderTray({ open: true }, [verdict({ phase: null })])
    const section = screen.getByTestId("problems-tray-workflow-wide")
    expect(within(section).queryByRole("button")).toBeNull()
    // The summary toggle is the tray's only control in this state.
    expect(container.querySelectorAll("button")).toHaveLength(1)
  })
})

describe("ProblemsTray — R8: an identifier this client has never seen still renders", () => {
  it("renders the row with the server's message VERBATIM", () => {
    const message = "the 'grounding budget' for this step exceeds what the folder can serve"
    renderTray({ open: true }, [
      verdict({ code: "some_future_code", phase: "draft", severity: "error", message }),
    ])
    const row = screen.getByTestId("problems-tray-row-draft-0")
    expect(row).toBeInTheDocument()
    expect(within(row).getByTestId("problems-tray-message").textContent).toBe(message)
    expect(row.getAttribute("data-severity")).toBe("error")
  })

  it("an unknown SEVERITY renders too, and wears the hard mark rather than the soft one", () => {
    const odd = { ...verdict({ phase: "draft" }), severity: "catastrophe" } as unknown as Verdict
    const { container } = renderTray({ open: true }, [odd])
    const row = screen.getByTestId("problems-tray-row-draft-0")
    expect(row.getAttribute("data-severity")).toBe("catastrophe")
    // Fail-closed: it spends the destructive token, exactly as a problem does.
    expect(destructiveOccurrences(container.innerHTML)).toBeGreaterThanOrEqual(1)
  })

  it("names the step in plain language and keeps the identifier off the surface", () => {
    renderTray({ open: true }, [verdict({ phase: "draft", code: "orphan_phase" })])
    const row = screen.getByTestId("problems-tray-row-draft-0")
    expect(row.textContent).toContain("Draft the section")
    // No ⌥ provider in this render ⇒ the fail-closed accessor reads plain language.
    expect(row.textContent).not.toContain("orphan_phase")
  })

  it("a slug that matches no phase still renders, naming itself honestly", () => {
    renderTray({ open: true }, [verdict({ phase: "a-step-that-was-deleted" })])
    const row = screen.getByTestId("problems-tray-row-a-step-that-was-deleted-0")
    expect(row.textContent).toContain("a-step-that-was-deleted")
  })
})

describe("ProblemsTray — VALID-03: it changes when only the server response changes", () => {
  it("identical phases and identical props, different groups ⇒ different rows", () => {
    const shared = { open: true, phases: PHASES } as const

    const a = renderTray({ ...shared }, [
      verdict({ phase: "draft", severity: "incomplete", message: "still needs an output file" }),
    ])
    const beforeHtml = a.container.innerHTML
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe("1 thing to finish")
    expect(screen.getByTestId("problems-tray-row-draft-0").getAttribute("data-severity")).toBe(
      "incomplete",
    )
    a.unmount()

    const b = renderTray({ ...shared }, [
      verdict({ phase: "draft", severity: "error", message: "still needs an output file" }),
      verdict({ phase: "emit", severity: "incomplete", message: "no deliverable yet" }),
    ])
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe(
      "1 problem · 1 thing to finish",
    )
    expect(screen.getByTestId("problems-tray-row-draft-0").getAttribute("data-severity")).toBe(
      "error",
    )
    expect(b.container.innerHTML).not.toBe(beforeHtml)
  })
})

describe("ProblemsTray — rows jump to the step they belong to", () => {
  it("activating a phase-keyed row calls onJumpToStep with that slug", async () => {
    const user = userEvent.setup()
    const { onJumpToStep } = renderTray({ open: true }, [
      verdict({ phase: "emit", severity: "error" }),
    ])
    await user.click(screen.getByTestId("problems-tray-row-emit-0"))
    expect(onJumpToStep).toHaveBeenCalledTimes(1)
    expect(onJumpToStep).toHaveBeenCalledWith("emit")
  })

  it("activating the summary asks the CALLER to toggle — the tray never toggles itself", async () => {
    const user = userEvent.setup()
    const { onToggle } = renderTray({ open: false })
    await user.click(screen.getByTestId("problems-tray-summary"))
    expect(onToggle).toHaveBeenCalledTimes(1)
    // Still closed: `open` is the caller's state, and nothing here wrote it.
    expect(screen.queryByTestId("problems-tray-list")).toBeNull()
  })
})

/** Anything that would let a person read "the check did not run" as "you are fine". */
const CLEAN_AFFORDANCE = /nothing to fix|nothing outstanding|✓|all good|looks good|\bclean\b|checked by the server/i

describe("ProblemsTray — D-184-14: a degraded check never reads as clean", () => {
  it("unreadable and unreachable render DIFFERENT sentences", () => {
    const a = renderTray({ open: true, degraded: "unreadable" }, [])
    const unreadable = screen.getByTestId("problems-tray-degraded").textContent
    a.unmount()

    renderTray({ open: true, degraded: "unreachable" }, [])
    const unreachable = screen.getByTestId("problems-tray-degraded").textContent

    expect(unreadable).toBe(DEGRADED_SENTENCE.unreadable)
    expect(unreachable).toBe(DEGRADED_SENTENCE.unreachable)
    expect(unreadable).not.toBe(unreachable)
    // The shape sentence must not tell a person to try again; the reachability one may.
    expect(unreadable).toMatch(/shape/i)
  })

  it("neither degraded state renders a clean / ok / passing affordance", () => {
    for (const cause of ["unreadable", "unreachable"] as const) {
      const { container, unmount } = renderTray({ open: true, degraded: cause }, [])
      expect(container.textContent ?? "").not.toMatch(CLEAN_AFFORDANCE)
      // The clean COUNTS line is suppressed too — with nothing held over it would read
      // "Nothing to fix", which is the exact lie this state must not tell.
      expect(screen.queryByTestId("problems-tray-counts")).toBeNull()
      unmount()
    }
  })

  it("the control: the SAME regex fires on the healthy empty state", () => {
    // Without this, the two assertions above would pass on a typo'd pattern.
    const { container } = renderTray({ open: true, degraded: null }, [])
    expect(container.textContent ?? "").toMatch(CLEAN_AFFORDANCE)
  })

  it("held-stale verdicts stay VISIBLE while degraded, alongside the degraded sentence", () => {
    renderTray({ open: true, degraded: "unreachable" }, [
      verdict({ phase: "draft", severity: "error", message: "a real finding from before" }),
    ])
    expect(screen.getByTestId("problems-tray-degraded")).toBeInTheDocument()
    expect(screen.getByTestId("problems-tray-row-draft-0")).toBeInTheDocument()
    expect(screen.getByTestId("problems-tray-message").textContent).toBe(
      "a real finding from before",
    )
    // Counts are shown again here — they are still true, and hiding them would be a
    // second, quieter way of replacing findings with silence.
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe("1 problem")
  })
})

describe("ProblemsTray — a check in flight DIMS, it does not clear", () => {
  it("keeps every row while checking, marked stale", () => {
    renderTray({ open: true, checking: true })
    const list = screen.getByTestId("problems-tray-list")
    expect(list.getAttribute("data-stale")).toBe("true")
    expect(list.className).toContain("opacity-60")
    expect(list.querySelectorAll("[data-severity]")).toHaveLength(3)
    expect(screen.getByTestId("problems-tray-beat").textContent).toBe("checking…")
  })

  it("shows the beat rather than the resting attribution, and only one of them", () => {
    const idle = renderTray({ open: true, checking: false })
    expect(screen.getByTestId("problems-tray-beat").textContent).toBe("checked by the server")
    idle.unmount()

    renderTray({ open: true, checking: true, degraded: "unreachable" })
    expect(screen.getByTestId("problems-tray-beat").textContent).toBe("checking…")
  })
})

describe("ProblemsTray — it never opens itself on a new problem", () => {
  it("a re-render that introduces an error while closed leaves the tray closed", () => {
    const onToggle = vi.fn()
    const props = {
      phases: PHASES,
      degraded: null,
      checking: false,
      open: false,
      onToggle,
      onJumpToStep: vi.fn(),
    }
    const { rerender } = render(<ProblemsTray groups={groupVerdicts(MID_BUILD)} {...props} />)
    expect(screen.queryByTestId("problems-tray-list")).toBeNull()

    rerender(
      <ProblemsTray
        groups={groupVerdicts([...MID_BUILD, verdict({ phase: "draft", severity: "error" })])}
        {...props}
      />,
    )

    // The summary updated; the tray did not spring open, and nobody was asked to open it.
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe(
      "1 problem · 3 things to finish",
    )
    expect(screen.queryByTestId("problems-tray-list")).toBeNull()
    expect(onToggle).not.toHaveBeenCalled()
  })
})

describe("ProblemsTray — it is a leaf: no network, no store, no canvas provider", () => {
  it("issues ZERO requests across every state this suite renders", () => {
    for (const open of [false, true]) {
      for (const degraded of [null, "unreadable", "unreachable"] as const) {
        const { unmount } = renderTray({ open, degraded, checking: true })
        unmount()
      }
    }
    expect(fetchSpy).toHaveBeenCalledTimes(0)
  })

  it("renders with no provider at all — the ⌥ accessor fails closed to plain language", () => {
    // No TechnicalNamesProvider is mounted anywhere in this file. A throwing accessor
    // would take the whole tray down; the shipped optional one returns null.
    expect(() => renderTray({ open: true })).not.toThrow()
    expect(screen.getByTestId("problems-tray")).toBeInTheDocument()
  })
})

// ── Phase 187-08 (VOCAB-01 / D-187-05) — the tray agrees with the card ──────────
//
// RESEARCH Open Q6, the tray half. A row points AT a node, so the two naming one step
// differently — *"Run the pricing policy check"* on the card beside *"Work out how to
// do it"* in the tray — is a disagreement in front of the author about which step a
// finding belongs to. The prevention is structural: one `nodeTitle`, one context object,
// handed to both by the same parent.
//
// Both assertions compare against the FUNCTIONS, never against a re-typed literal. A
// literal would keep passing after the derivation changed, which is the drift this pair
// exists to catch.

const SKILL_ID = "3f2b8c40-1111-4a2b-9c3d-000000000001"

/** Unnamed AND skill-bound — the only shape where the derived tier decides the face.
 *  Every phase in `PHASES` above carries a stored `name`, which wins outright. */
const BOUND: PhaseSpecJSON = {
  slug: "check",
  phase_index: 0,
  config: { phase_type: "llm_agent", skill_ref: SKILL_ID },
}

const NAME_CTX = { skillNames: { [SKILL_ID]: "pricing policy check" } }

const BOUND_FINDING = [
  verdict({ phase: "check", severity: "incomplete", message: "still needs an input" }),
]

describe("ProblemsTray — 187-08: a row and the card name one step the same way", () => {
  it("renders exactly what the canvas projects for that phase", () => {
    renderTray({ open: true, phases: [BOUND], nameContext: NAME_CTX }, BOUND_FINDING)
    const row = screen.getByTestId("problems-tray-row-check-0")

    expect(row.textContent).toContain(nodeTitle(BOUND, NAME_CTX))
    // …and the canvas card's own value, so the two SURFACES are compared, not two
    // calls of one function.
    const card = toCanvas([BOUND], { nameContext: NAME_CTX }).nodes[0]
    expect(row.textContent).toContain(card.data.title)
    expect(card.data.title).toBe("Run the pricing policy check")
  })

  it("omitting the prop renders what HEAD rendered — the type sentence, never the id", () => {
    const supplied = renderTray(
      { open: true, phases: [BOUND], nameContext: undefined },
      BOUND_FINDING,
    )
    const suppliedText = supplied.container.textContent
    supplied.unmount()

    const omitted = renderTray({ open: true, phases: [BOUND] }, BOUND_FINDING)
    expect(omitted.container.textContent).toBe(suppliedText)

    const row = screen.getByTestId("problems-tray-row-check-0")
    expect(row.textContent).toContain(nodeTitle(BOUND))
    // Never fabricate: an unresolved id must not reach the row, and neither must a name
    // this render was never given.
    expect(row.textContent).not.toContain(SKILL_ID)
    expect(row.textContent).not.toContain("pricing policy check")
  })

  it("leaves the ⌥ reveal line alone — the technical form is still the slug", () => {
    // No TechnicalNamesProvider is mounted in this file, so the reveal is off and the
    // mono line is absent. What this pins is the SOURCE contract the plan caps: exactly
    // one `technicalTitle(phase)` call, taking one argument.
    renderTray({ open: true, phases: [BOUND], nameContext: NAME_CTX }, BOUND_FINDING)
    const row = screen.getByTestId("problems-tray-row-check-0")
    expect(row.textContent).not.toContain("AI agent step · check")
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-27 (GAP B · VOCAB-02) — THE ALL-CLEAR MAY NOT RENDER BEFORE AN ANSWER
//
// APPENDED; nothing above this line was edited.
//
// The measured defect: a canvas opened on an existing draft issued ZERO
// `POST /workflows/validate` calls, and this tray said *"Nothing to fix — the static
// checks pass"* next to *"checked by the server"* — a sentence about a check nobody had
// made. THE COMPONENT WAS NEVER THE LIAR. All three of its all-clear affordances already
// branch on the cause being non-null; the page simply had no value to hand it, because
// "nobody has asked yet" was not yet a member of the cause union.
//
// So the fence below is a fence on the COMPOSED behaviour of the component under the new
// value, and it is written with its positive control INSIDE the same case: three
// absences are satisfied by a component that renders nothing at all, and a fence that
// cannot tell those two apart is the vacuous shape 187-24 named.
// ══════════════════════════════════════════════════════════════════════════════════

describe("ProblemsTray — 187-27: a check that never RAN says so, and claims nothing", () => {
  it("counts, beat and empty paragraph are ABSENT for `not-run` — and the CONTROL proves all three DO render for `null`", () => {
    // THE NEVER-RAN STATE, exactly as a freshly-opened draft sits in it: no verdicts,
    // nothing in flight, and no request has been issued yet.
    const never = renderTray({ open: true, degraded: "not-run", checking: false }, [])

    expect(screen.queryByTestId("problems-tray-counts")).toBeNull()
    expect(screen.queryByTestId("problems-tray-beat")).toBeNull()
    expect(screen.queryByTestId("problems-tray-empty")).toBeNull()
    // What it says INSTEAD — compared to the export, so a rewording moves both together.
    expect(screen.getByTestId("problems-tray-degraded").textContent).toBe(
      DEGRADED_SENTENCE["not-run"],
    )
    expect(screen.getByTestId("problems-tray").getAttribute("data-degraded")).toBe("not-run")
    // Nothing anywhere in the rendered tray reads as clean, passing or server-attributed.
    expect(never.container.textContent ?? "").not.toMatch(CLEAN_AFFORDANCE)
    never.unmount()

    // THE POSITIVE CONTROL, in the same case on purpose. Identical inputs, cause `null`:
    // all three render, and the tray says the very sentences the never-ran state must
    // not. This is also the DEFECT reproduced — it is what the page handed the tray for
    // every opened draft before this plan.
    const control = renderTray({ open: true, degraded: null, checking: false }, [])
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe(NOTHING_OUTSTANDING)
    expect(screen.getByTestId("problems-tray-beat").textContent).toBe("checked by the server")
    expect(screen.getByTestId("problems-tray-empty")).toBeInTheDocument()
    expect(control.container.textContent ?? "").toMatch(CLEAN_AFFORDANCE)
  })

  it("a check now IN FLIGHT beats, and STILL never shows the resting attribution", () => {
    const { container } = renderTray({ open: true, degraded: "not-run", checking: true }, [])
    expect(screen.getByTestId("problems-tray-beat").textContent).toBe("checking…")
    // The resting attribution is the one word-for-word claim that a server did the
    // checking. It may not appear while the answer is still outstanding.
    expect(container.textContent ?? "").not.toContain("checked by the server")
    expect(screen.queryByTestId("problems-tray-counts")).toBeNull()
    expect(screen.queryByTestId("problems-tray-empty")).toBeNull()
  })

  it("the two SHIPPED causes behave EXACTLY as before — the asymmetry net", () => {
    // Without this, "additive" would be a claim rather than a measurement: a change that
    // altered the unreadable/unreachable rendering would still pass the two cases above.
    for (const cause of ["unreadable", "unreachable"] as const) {
      const { container, unmount } = renderTray({ open: true, degraded: cause, checking: false }, [])
      expect(screen.getByTestId("problems-tray-degraded").textContent).toBe(
        DEGRADED_SENTENCE[cause],
      )
      expect(screen.getByTestId("problems-tray").getAttribute("data-degraded")).toBe(cause)
      expect(screen.queryByTestId("problems-tray-counts")).toBeNull()
      expect(screen.queryByTestId("problems-tray-beat")).toBeNull()
      expect(screen.queryByTestId("problems-tray-empty")).toBeNull()
      expect(container.textContent ?? "").not.toMatch(CLEAN_AFFORDANCE)
      unmount()
    }
  })

  it("held-stale findings still render under `not-run`, exactly as under the other causes", () => {
    // Reachable on a SECOND open of a draft whose store still carries the last answer:
    // the findings are still true and hiding them would be a quieter way of replacing
    // them with silence. The clean COUNTS line comes back because it is no longer clean.
    renderTray({ open: true, degraded: "not-run", checking: false }, [
      verdict({ phase: "draft", severity: "error", message: "a real finding from before" }),
    ])
    expect(screen.getByTestId("problems-tray-degraded").textContent).toBe(
      DEGRADED_SENTENCE["not-run"],
    )
    expect(screen.getByTestId("problems-tray-row-draft-0")).toBeInTheDocument()
    expect(screen.getByTestId("problems-tray-counts").textContent).toBe("1 problem")
  })
})
