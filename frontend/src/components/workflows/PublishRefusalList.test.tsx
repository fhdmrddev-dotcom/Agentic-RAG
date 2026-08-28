/**
 * Phase 214-10 Task 1 (STEP-03 · D-214-09 / D-214-12) — sketch 215's invariants #1, #2, #3,
 * #5, #6, #9 and #13, over the refusal surface itself.
 *
 * ⚠ EVERY SENTENCE ASSERTED HERE IS IMPORTED FROM `publishRefusalVocabulary.ts`, never
 * re-typed. A suite that spells the sentence out a second time goes green against a
 * component that was re-worded and a vocabulary that was not — which is the exact drift the
 * vocabulary module exists to make impossible.
 *
 * ⚠ THE FIXTURES CARRY THE TWO KEYS THE SURFACE MUST NEVER RENDER — the slug and the
 * server's diagnostic — on purpose. An absence assertion over a fixture that never had the
 * thing is vacuous; these entries are the six-key wire shape `214-05` actually emits.
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
// The component SOURCE, via the same `?raw` loader `PublishGauntlet.test.tsx` reads it with
// (typechecks under `vite/client`; a `node:fs` spelling would add new `tsc` errors).
import refusalListSource from "./PublishRefusalList?raw"
import { PublishRefusalList } from "./PublishRefusalList"
// ⚠ The predicate lives in its own pure module — `react-refresh/only-export-components` is
// an ACTIVE error in this repo, measured at 214-10 rather than assumed.
import { isArgumentRefusal, type ArgumentRefusal } from "./publishRefusalEntry"
import {
  ALREADY_PUBLISHED_NOTE,
  REFUSAL_FOR_KIND,
  REFUSE_COUNT_MANY,
  REFUSE_COUNT_ONE,
  REFUSE_NEXT,
  REFUSE_NEXT_REDISCOVER,
  REFUSE_REST_OK,
  REFUSE_TITLE,
  type ArgumentGapKind,
} from "./publishRefusalVocabulary"

/** The five kinds, read off the pairing map — never a sixth list of the same literals. */
const KINDS = Object.keys(REFUSAL_FOR_KIND) as ArgumentGapKind[]

/** The SLUG a refusal entry carries and this surface must never print (sketch 215 #1). */
const SLUG = "notify-abc123xyz"
/** The backend's own diagnostic — for the log and the audit receipt, never for a screen. */
const DIAGNOSTIC =
  "step 'Email the customer': the required argument 'to' is asked for at launch, but the workflow declares no matching input"

/** The full SIX-KEY wire entry `214-05` emits, with the two never-rendered keys present. */
function wireEntry(over: Partial<Record<string, unknown>> = {}): Record<string, unknown> {
  return {
    code: "no_source",
    phase: SLUG,
    message: DIAGNOSTIC,
    step_name: "Email the customer",
    argument: "to",
    upstream: null,
    ...over,
  }
}

/** One entry per kind, each with a DISTINCT step so a collapsed sentence is visible. */
const ONE_PER_KIND: Record<string, unknown>[] = [
  wireEntry({ code: "no_source", step_name: "Email the customer", argument: "to" }),
  wireEntry({ code: "ask_undeclared", step_name: "Draft the summary", argument: "subject" }),
  wireEntry({
    code: "upstream_unreachable",
    step_name: "Post the update",
    argument: "channel",
    upstream: "Collect the replies",
  }),
  wireEntry({ code: "shape_unknown", step_name: "Notify the vendor", argument: "recipient_list" }),
  wireEntry({ code: "unrenderable", step_name: "File the request", argument: "attachments" }),
]

/** N distinct refusals, for the count cases. */
function nRefusals(n: number): Record<string, unknown>[] {
  return Array.from({ length: n }, (_, i) =>
    wireEntry({ step_name: `Step number ${i + 1}`, argument: `arg_${i + 1}` }),
  )
}

/** How many times `needle` occurs in `hay` — an absence assertion wants a COUNT, not a
 *  boolean, so "zero" is measured rather than inferred from a passing `not.toMatch`. */
function occurrences(hay: string, needle: string): number {
  return hay.split(needle).length - 1
}

/**
 * ⚠ THE SEVERITY / EXCLAMATION NEEDLE (sketch 215 #5), and it is driven RED below.
 * `doorVocabulary`'s governed-refusal register binds every sentence here: no severity word,
 * no exclamation, no mechanism — it names what is missing and what to do.
 */
const SEVERITY_NEEDLE =
  /!|\b(?:error|errors|fatal|critical|invalid|illegal|failure|failed|fails|severe|warning|danger|broken|corrupt|wrong|bad)\b/i

describe("PublishRefusalList — five refusals, not one (sketch 215 #1, #2, #3)", () => {
  it("renders one item per kind, each with its OWN sentence — five distinct headlines", () => {
    render(<PublishRefusalList entries={ONE_PER_KIND} />)
    const headlines = screen.getAllByTestId("refusal-headline").map((h) => h.textContent ?? "")
    expect(headlines).toHaveLength(5)
    // Distinct, not merely present: a single collapsed "this step is invalid" would pass a
    // length check and fail this one.
    expect(new Set(headlines).size).toBe(5)
    // And each is the vocabulary's own composed sentence, character for character.
    for (const [i, kind] of KINDS.entries()) {
      const entry = ONE_PER_KIND.find((e) => e.code === kind)!
      expect(headlines).toContain(
        REFUSAL_FOR_KIND[kind]({
          step: entry.step_name as string,
          arg: (entry.argument as string) ?? "",
          upstream: (entry.upstream as string) ?? "",
        }),
      )
      expect(i).toBeLessThan(5)
    }
  })

  it("(#1) names the step in the AUTHOR'S words — and the slug appears zero times", () => {
    const { container } = render(<PublishRefusalList entries={ONE_PER_KIND} />)
    const text = container.textContent ?? ""
    // The authored name is there…
    expect(occurrences(text, "Email the customer")).toBeGreaterThanOrEqual(1)
    // …and the slug, which the same entry carried, is not. Both halves, as #1 requires.
    expect(occurrences(text, SLUG)).toBe(0)
    expect(occurrences(container.innerHTML, SLUG)).toBe(0)
  })

  it("(#1) never renders the backend diagnostic — its home is the audit receipt", () => {
    const { container } = render(<PublishRefusalList entries={ONE_PER_KIND} />)
    expect(occurrences(container.textContent ?? "", DIAGNOSTIC)).toBe(0)
    // Not just the whole sentence — no fragment of it either.
    expect(container.textContent ?? "").not.toMatch(/declares no matching input/)
  })

  it("(#3) exactly ONE headline node per item, and at least one next action per item", () => {
    render(<PublishRefusalList entries={ONE_PER_KIND} />)
    const items = screen.getAllByTestId("refusal-item")
    expect(items).toHaveLength(5)
    expect(screen.getAllByTestId("refusal-headline")).toHaveLength(items.length)
    for (const item of items) {
      expect(within(item).getAllByTestId("refusal-headline")).toHaveLength(1)
      expect(within(item).getAllByRole("button").length).toBeGreaterThanOrEqual(1)
    }
  })

  it("(#3) shape_unknown offers RE-DISCOVERY; the other four offer the step", () => {
    render(<PublishRefusalList entries={ONE_PER_KIND} />)
    for (const item of screen.getAllByTestId("refusal-item")) {
      const kind = item.getAttribute("data-refusal-kind")
      const label = within(item).getByTestId("refusal-next").textContent
      expect(label).toBe(kind === "shape_unknown" ? REFUSE_NEXT_REDISCOVER : REFUSE_NEXT)
    }
    // Exactly one of the five sends the reader somewhere other than the step.
    expect(screen.getAllByText(REFUSE_NEXT_REDISCOVER)).toHaveLength(1)
  })

  it("(#2) shape_unknown invents NO argument name — even though its entry carried one", () => {
    render(<PublishRefusalList entries={ONE_PER_KIND} />)
    const item = screen
      .getAllByTestId("refusal-item")
      .find((el) => el.getAttribute("data-refusal-kind") === "shape_unknown")!
    const headline = within(item).getByTestId("refusal-headline").textContent ?? ""
    // The fixture's argument name is distinctive and IS on the entry — its absence here is
    // the restraint, not an accident of the fixture.
    expect(headline).not.toContain("recipient_list")
    expect(headline).toContain("Notify the vendor")
  })
})

describe("PublishRefusalList — the words it may not use (sketch 215 #5)", () => {
  it("(non-vacuity) the needle FIRES on a planted severity headline", () => {
    // Without this, a typo'd regex matching nothing would read as "no severity words".
    expect("This step is invalid!").toMatch(SEVERITY_NEEDLE)
    expect("The run failed").toMatch(SEVERITY_NEEDLE)
  })

  it("no headline carries an exclamation or a severity word", () => {
    render(<PublishRefusalList entries={ONE_PER_KIND} />)
    for (const h of screen.getAllByTestId("refusal-headline")) {
      expect(h.textContent ?? "").not.toMatch(SEVERITY_NEEDLE)
    }
  })
})

describe("PublishRefusalList — the count agrees with the list (sketch 215 #6)", () => {
  /** The number the count line claims — "One" is a number spelled as a word. */
  function claimedCount(): number {
    const text = screen.getByTestId("refusal-count").textContent ?? ""
    if (text === REFUSE_COUNT_ONE) return 1
    const digits = text.match(/\d+/)
    expect(digits).not.toBeNull()
    return Number(digits![0])
  }

  it.each([1, 2, 5])("at N=%i the headline's number equals the rendered item count", (n) => {
    render(<PublishRefusalList entries={nRefusals(n)} />)
    expect(screen.getAllByTestId("refusal-item")).toHaveLength(n)
    expect(claimedCount()).toBe(n)
    expect(screen.getByTestId("refusal-count")).toHaveTextContent(
      n === 1 ? REFUSE_COUNT_ONE : REFUSE_COUNT_MANY({ count: n }),
    )
  })

  it("says what is TRUE of the rest only when the caller actually knows the total", () => {
    const { unmount } = render(<PublishRefusalList entries={nRefusals(2)} totalSteps={7} />)
    expect(screen.getByTestId("refusal-rest-ok")).toHaveTextContent(REFUSE_REST_OK({ count: 5 }))
    unmount()
    // No total ⇒ no line. Guessing a number nothing counted is the invention this whole
    // surface refuses.
    render(<PublishRefusalList entries={nRefusals(2)} />)
    expect(screen.queryByTestId("refusal-rest-ok")).not.toBeInTheDocument()
  })

  it("carries the title and the not-retroactive note (D-214-12 / #12)", () => {
    render(<PublishRefusalList entries={nRefusals(1)} />)
    expect(screen.getByTestId("refusal-title")).toHaveTextContent(REFUSE_TITLE)
    expect(screen.getByTestId("already-published-note")).toHaveTextContent(ALREADY_PUBLISHED_NOTE)
  })
})

describe("PublishRefusalList — the paint it does not spend (sketch 215 #9, #13)", () => {
  it("(#9) spends no destructive colour anywhere on the surface", () => {
    render(<PublishRefusalList entries={ONE_PER_KIND} />)
    const surface = screen.getByTestId("publish-refusals")
    const nodes = [surface, ...Array.from(surface.querySelectorAll<HTMLElement>("*"))]
    // Non-vacuity: the scan really did walk a populated subtree.
    expect(nodes.length).toBeGreaterThan(10)
    for (const n of nodes) {
      expect(String(n.className)).not.toContain("destructive")
    }
  })

  it("(#13) no wire id reaches the DOM", () => {
    const { container } = render(
      <PublishRefusalList
        entries={[
          ...ONE_PER_KIND,
          wireEntry({ message: "external_action send_email create_ticket post_message" }),
        ]}
      />,
    )
    for (const id of ["send_email", "create_ticket", "post_message", "external_action"]) {
      expect(occurrences(container.innerHTML, id)).toBe(0)
    }
  })

  it("(T-214-10-03) renders step text as TEXT — no dangerouslySetInnerHTML in the source", () => {
    // Non-vacuity: the source really loaded.
    expect(refusalListSource).toContain("PublishRefusalList")
    expect(occurrences(refusalListSource, "dangerouslySetInnerHTML")).toBe(0)
    // And a step name carrying markup is escaped rather than mounted.
    const { container } = render(
      <PublishRefusalList entries={[wireEntry({ step_name: "<img src=x onerror=alert(1)>" })]} />,
    )
    expect(container.querySelector("img")).toBeNull()
    expect(container.textContent ?? "").toContain("<img src=x onerror=alert(1)>")
  })
})

describe("PublishRefusalList — KEY DETECTION per entry (T-214-10-04)", () => {
  it("a bare string, an unknown code and a null entry all pass through without throwing", () => {
    expect(() =>
      render(
        <PublishRefusalList
          entries={[
            "publish was refused",
            null,
            undefined,
            42,
            { criterion: "grounded_in_evidence", score: 0.42 },
            { code: "no_terminal", phase: "p", message: "m" },
          ]}
        />,
      ),
    ).not.toThrow()
    // None of them is one of the five, so this component renders nothing at all — the
    // gauntlet's shipped generic renderer keeps them.
    expect(screen.queryByTestId("publish-refusals")).not.toBeInTheDocument()
  })

  it("mixes shapes: the five are claimed, everything else is left for the generic path", () => {
    render(
      <PublishRefusalList
        entries={["publish was refused", ONE_PER_KIND[0], { summary: "a paragraph" }, ONE_PER_KIND[3]]}
      />,
    )
    expect(screen.getAllByTestId("refusal-item")).toHaveLength(2)
    expect(screen.getByTestId("refusal-count")).toHaveTextContent(REFUSE_COUNT_MANY({ count: 2 }))
  })

  it("declines an entry it cannot phrase honestly — no empty curly quotes on a real screen", () => {
    // `upstream_unreachable` with no upstream, and a non-shape kind with no argument, would
    // each render a pair of quotes around nothing — a fact nothing computed, printed as
    // though it had been.
    expect(isArgumentRefusal(wireEntry({ code: "upstream_unreachable", upstream: null }))).toBe(false)
    expect(isArgumentRefusal(wireEntry({ code: "no_source", argument: null }))).toBe(false)
    expect(isArgumentRefusal(wireEntry({ step_name: "   " }))).toBe(false)
    // …while the honest shapes are claimed, including shape_unknown WITHOUT an argument.
    expect(isArgumentRefusal(wireEntry())).toBe(true)
    expect(isArgumentRefusal(wireEntry({ code: "shape_unknown", argument: null }))).toBe(true)
  })

  it("the detection set is READ OFF the pairing map — all five kinds are claimed", () => {
    for (const kind of KINDS) {
      const entry = ONE_PER_KIND.find((e) => e.code === kind)
      expect(entry, `no fixture for ${kind}`).toBeDefined()
      expect(isArgumentRefusal(entry)).toBe(true)
    }
    expect(KINDS).toHaveLength(5)
  })
})

describe("PublishRefusalList — the next action goes somewhere", () => {
  it("calls back with the refusal the reader clicked", async () => {
    const onGoToStep = vi.fn<(r: ArgumentRefusal) => void>()
    const user = userEvent.setup()
    render(<PublishRefusalList entries={ONE_PER_KIND} onGoToStep={onGoToStep} />)
    const item = screen
      .getAllByTestId("refusal-item")
      .find((el) => el.getAttribute("data-refusal-kind") === "ask_undeclared")!
    await user.click(within(item).getByTestId("refusal-next"))
    expect(onGoToStep).toHaveBeenCalledTimes(1)
    expect(onGoToStep.mock.calls[0][0].step_name).toBe("Draft the summary")
  })

  it("with no handler the control still states where the fix lives — never a dead affordance", () => {
    render(<PublishRefusalList entries={nRefusals(1)} />)
    const btn = screen.getByTestId("refusal-next")
    expect(btn).toBeDisabled()
    expect(btn.getAttribute("title")).toMatch(/builder/i)
  })
})
