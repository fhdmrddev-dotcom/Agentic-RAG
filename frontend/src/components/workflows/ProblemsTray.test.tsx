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
