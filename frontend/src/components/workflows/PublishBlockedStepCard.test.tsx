/**
 * BUG-260828-09 — THE CARD RENDERS THE SENTENCE THE RUN ALREADY WROTE, AND NOT THE SLUG.
 *
 * ⚠ WHAT THIS SUITE CANNOT PROVE, STATED UP FRONT. jsdom lays nothing out — every
 * `getBoundingClientRect` is zero — so nothing here can show that a person reading this
 * surface can name the failing step, which is the property the bug report is actually about
 * and the same blind spot it names as the reason nothing caught the original. These tests
 * prove the WIRING: the server's sentence arrives intact, the slug never does, and the card
 * is absent on every path that cannot name a step. The READING is the operator's, in a
 * browser.
 */
import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { PublishBlockedStepCard } from "@/components/workflows/PublishBlockedStepCard"
import type { DefShape } from "@/components/workflows/soulData"

const LIVE_CAUSE =
  "citations_required: nothing was retrieved (0 sources) — this step reads your documents and must show where its answer came from"

const UNIQUE_SLUG = "zz-slugfence-survey-library-zz"

const LIVE_STEP = {
  step_slug: UNIQUE_SLUG,
  step_index: 0,
  step_name: null,
  reason: `Phase 1 (${UNIQUE_SLUG}) gate failed after 3 attempt(s): ${LIVE_CAUSE}`,
  cause: LIVE_CAUSE,
}

const LIVE_DEF: DefShape = {
  name: "Knowledge Base Library Structure Summary",
  phases: [
    { slug: UNIQUE_SLUG, phase_index: 0, name: null, config: { phase_type: "llm_agent" } },
    {
      slug: "write-summary",
      phase_index: 1,
      name: "Write the short library summary",
      config: { phase_type: "llm_single" },
    },
  ],
}

describe("PublishBlockedStepCard", () => {
  it("renders the server's cause sentence VERBATIM", () => {
    render(<PublishBlockedStepCard step={LIVE_STEP} definition={LIVE_DEF} />)
    expect(screen.getByTestId("blocked-step-cause")).toHaveTextContent(LIVE_CAUSE)
  })

  it("keeps the validator's own name — the one word that says WHICH check refused", () => {
    render(<PublishBlockedStepCard step={LIVE_STEP} definition={LIVE_DEF} />)
    expect(screen.getByTestId("blocked-step-cause").textContent).toContain("citations_required:")
  })

  it("never renders the slug, and never the machine-prefixed reason", () => {
    const { container } = render(
      <PublishBlockedStepCard step={LIVE_STEP} definition={LIVE_DEF} />,
    )
    const text = container.textContent ?? ""
    expect(text).not.toContain(UNIQUE_SLUG)
    // The raw sentence is DEMOTED to the shipped raw-verdict disclosure, not shown here.
    expect(text).not.toContain("gate failed after 3 attempt(s)")
    expect(text).not.toContain("Phase 1 (")
  })

  it("names the step with the AUTHORED name when there is one", () => {
    render(
      <PublishBlockedStepCard
        step={{ step_slug: "write-summary", step_index: 1, cause: "too short" }}
        definition={LIVE_DEF}
      />,
    )
    expect(screen.getByTestId("blocked-step-headline")).toHaveTextContent(
      "Write the short library summary",
    )
  })

  it("says what to do next", () => {
    render(<PublishBlockedStepCard step={LIVE_STEP} definition={LIVE_DEF} />)
    expect(screen.getByTestId("blocked-step-next").textContent?.length ?? 0).toBeGreaterThan(0)
  })

  it("renders NOTHING when the verdict names no step — the shipped surface is untouched", () => {
    // A judge block, a lint block, a pre-fix server, a crash before any phase failed.
    for (const step of [null, undefined, {}, { cause: "" }, { step_slug: "x" }, "a string"]) {
      const { container } = render(<PublishBlockedStepCard step={step} definition={LIVE_DEF} />)
      expect(container).toBeEmptyDOMElement()
    }
  })

  it("renders without a definition — the face degrades, the cause does not", () => {
    render(<PublishBlockedStepCard step={{ ...LIVE_STEP, step_name: "Survey the library" }} />)
    expect(screen.getByTestId("blocked-step-headline")).toHaveTextContent("Survey the library")
    expect(screen.getByTestId("blocked-step-cause")).toHaveTextContent(LIVE_CAUSE)
  })

  it("does not blow up on a malformed definition", () => {
    expect(() =>
      render(
        <PublishBlockedStepCard
          step={LIVE_STEP}
          definition={{ phases: [null as never, { slug: UNIQUE_SLUG } as never] }}
        />,
      ),
    ).not.toThrow()
  })
})
