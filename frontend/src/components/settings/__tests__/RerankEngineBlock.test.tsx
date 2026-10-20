/**
 * Phase 294-04 (DEC-01 / D-01 / D-02 / D-04 / D-05 / D-20a) — the Reranking card body, sketch 294 B.
 *
 * The words ARE the deliverable here (which key an engine uses, that it cannot run without it,
 * that text leaves the server), so these cases assert rendered CONTENT, never block presence by
 * test id (the Phase 235 lesson: a presence fence stayed green while the content drifted).
 */
import { describe, it, expect, vi } from "vitest"
import { render, screen, within, fireEvent } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { RerankEngineBlock, type RerankEngineBlockProps } from "../RerankEngineBlock"

const EGRESS = "Text leaves your server."

function setup(over: Partial<RerankEngineBlockProps> = {}) {
  const props: RerankEngineBlockProps = {
    enabled: true,
    provider: "jev",
    onProviderChange: vi.fn(),
    model: "",
    onModelChange: vi.fn(),
    poolSize: 20,
    onPoolSizeChange: vi.fn(),
    keepAtMost: 5,
    onKeepAtMostChange: vi.fn(),
    hybridEnabled: true,
    hasKey: { openrouter: true, openai: true, cohere: true },
    saved: false,
    ...over,
  }
  const utils = render(<RerankEngineBlock {...props} />)
  return { props, ...utils }
}

function card(name: string) {
  return screen.getByRole("radio", { name: new RegExp(`^${name}`) })
}

describe("switch off", () => {
  it("hides the cards and says no engine is called", () => {
    setup({ enabled: false })
    expect(screen.queryAllByRole("radio")).toHaveLength(0)
    expect(screen.getByText("Search returns its candidates in today's order. No engine is called.")).toBeInTheDocument()
    expect(screen.queryByText(EGRESS)).not.toBeInTheDocument()
  })
})

describe("engine cards", () => {
  it("renders four radio cards in sketch order with the selected one checked", () => {
    setup({ provider: "openai_decisions" })
    const group = screen.getByRole("radiogroup")
    const radios = within(group).getAllByRole("radio")
    expect(radios.map((r) => r.getAttribute("data-engine"))).toEqual(["local", "jev", "openai_decisions", "cohere"])
    expect(radios[0]).toHaveTextContent("On this server")
    expect(radios[1]).toHaveTextContent("Jev via OpenRouter")
    expect(radios[2]).toHaveTextContent("OpenAI Decisions")
    expect(radios[3]).toHaveTextContent("Cohere")
    expect(radios[2]).toHaveAttribute("aria-checked", "true")
    for (const i of [0, 1, 3]) expect(radios[i]).toHaveAttribute("aria-checked", "false")
  })

  it("each card shows where it runs, its model, key status, price and capabilities", () => {
    setup()
    const local = card("On this server")
    expect(local).toHaveTextContent("● stays on your server")
    expect(local).toHaveTextContent("BAAI/bge-reranker-v2-m3")
    expect(local).toHaveTextContent("no key needed")
    expect(local).toHaveTextContent("free")
    expect(local).toHaveTextContent("reorders only · steering — · citation check —")

    const jev = card("Jev via OpenRouter")
    expect(jev).toHaveTextContent("↗ hosted · OpenRouter (TypeSafe)")
    expect(jev).toHaveTextContent("typesafe/jev-1.14")
    expect(jev).toHaveTextContent("✓ uses your saved OpenRouter key")
    expect(jev).toHaveTextContent("$0.042 / 1M input · output free")
    expect(jev).toHaveTextContent("cuts below 0.1 · steering ✓ · citation check ✓")

    const openai = card("OpenAI Decisions")
    expect(openai).toHaveTextContent("↗ hosted · OpenAI")
    expect(openai).toHaveTextContent("gpt-6-luna")
    expect(openai).toHaveTextContent("✓ uses your saved OpenAI key")
    expect(openai).toHaveTextContent("$0.10 / 1M input · output free")
    expect(openai).toHaveTextContent("cuts below 0.1 · steering ✓ · citation check ✓")

    const cohere = card("Cohere")
    expect(cohere).toHaveTextContent("↗ hosted · Cohere")
    expect(cohere).toHaveTextContent("rerank-v3.5")
    expect(cohere).toHaveTextContent("✓ uses your saved Cohere rerank key")
    expect(cohere).toHaveTextContent("per search (Cohere plan)")
    expect(cohere).toHaveTextContent("reorders only · steering — · citation check —")
  })

  it("only the On this server card carries the first-use note", () => {
    setup()
    const note = "First use downloads about 2.3 GB; until it has loaded, searches keep today's order."
    expect(card("On this server")).toHaveTextContent(note)
    for (const n of ["Jev via OpenRouter", "OpenAI Decisions", "Cohere"]) {
      expect(card(n)).not.toHaveTextContent("First use downloads")
    }
  })

  it("clicking a card picks the engine and its default model", async () => {
    const { props } = setup({ provider: "jev" })
    await userEvent.click(card("OpenAI Decisions"))
    expect(props.onProviderChange).toHaveBeenCalledWith("openai_decisions")
    expect(props.onModelChange).toHaveBeenCalledWith("gpt-6-luna")
    const providerOrder = (props.onProviderChange as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    const modelOrder = (props.onModelChange as ReturnType<typeof vi.fn>).mock.invocationCallOrder[0]
    expect(providerOrder).toBeLessThan(modelOrder)
  })

  it("arrow keys move the selection between cards", () => {
    const { props } = setup({ provider: "jev" })
    fireEvent.keyDown(card("Jev via OpenRouter"), { key: "ArrowRight" })
    expect(props.onProviderChange).toHaveBeenLastCalledWith("openai_decisions")
    fireEvent.keyDown(card("Jev via OpenRouter"), { key: "ArrowLeft" })
    expect(props.onProviderChange).toHaveBeenLastCalledWith("local")
  })

  it("only the selected card is in the tab order", () => {
    setup({ provider: "local" })
    expect(card("On this server")).toHaveAttribute("tabindex", "0")
    expect(card("Jev via OpenRouter")).toHaveAttribute("tabindex", "-1")
  })

  it("the legacy 'api' id selects Cohere and calls no setter on render (no hydrate diff)", () => {
    const { props } = setup({ provider: "api" })
    expect(card("Cohere")).toHaveAttribute("aria-checked", "true")
    expect(props.onProviderChange).not.toHaveBeenCalled()
    expect(props.onModelChange).not.toHaveBeenCalled()
    expect(props.onPoolSizeChange).not.toHaveBeenCalled()
    expect(props.onKeepAtMostChange).not.toHaveBeenCalled()
  })
})

describe("missing key", () => {
  it("Jev without an OpenRouter key says it cannot run and search keeps today's order", () => {
    setup({ provider: "jev", hasKey: { openrouter: false, openai: true, cohere: true } })
    expect(card("Jev via OpenRouter")).toHaveTextContent("✕ OpenRouter key missing")
    expect(
      screen.getByText("This engine can't run without your OpenRouter key. Until you add it, search keeps today's order."),
    ).toBeInTheDocument()
  })

  it("a missing key on an engine that is NOT selected marks only its card", () => {
    setup({ provider: "local", hasKey: { openrouter: false, openai: true, cohere: true } })
    expect(card("Jev via OpenRouter")).toHaveTextContent("✕ OpenRouter key missing")
    expect(screen.queryByText(/This engine can't run without/)).not.toBeInTheDocument()
  })

  it("OpenAI Decisions without an OpenAI key names the OpenAI key", () => {
    setup({ provider: "openai_decisions", hasKey: { openrouter: true, openai: false, cohere: true } })
    expect(
      screen.getByText("This engine can't run without your OpenAI key. Until you add it, search keeps today's order."),
    ).toBeInTheDocument()
  })
})

describe("egress notice", () => {
  it.each([
    ["jev", "OpenRouter (TypeSafe)"],
    ["openai_decisions", "OpenAI"],
  ])("%s names the vendor and the cited answer sentences", (provider, vendor) => {
    setup({ provider })
    const notice = screen.getByText(EGRESS).closest("[data-egress]") as HTMLElement
    expect(notice).not.toBeNull()
    expect(notice).toHaveTextContent(`are sent to ${vendor} to be scored`)
    expect(notice).toHaveTextContent("the cited answer sentences")
  })

  it("Cohere names Cohere without the citation clause", () => {
    setup({ provider: "cohere" })
    const notice = screen.getByText(EGRESS).closest("[data-egress]") as HTMLElement
    expect(notice).toHaveTextContent("are sent to Cohere to be scored")
    expect(notice).not.toHaveTextContent("the cited answer sentences")
  })

  it("On this server shows no egress notice", () => {
    const { container } = setup({ provider: "local" })
    expect(container).not.toHaveTextContent(EGRESS)
  })
})

describe("numbers", () => {
  it("Keep at most shows keepAtMost and reports a change", () => {
    const { props } = setup({ keepAtMost: 5 })
    const input = screen.getByRole("spinbutton", { name: "Keep at most (passages per search)" })
    expect(input).toHaveValue(5)
    fireEvent.change(input, { target: { value: "7" } })
    expect(props.onKeepAtMostChange).toHaveBeenCalledWith(7)
    expect(screen.getByText(/passages per search/)).toBeInTheDocument()
  })

  it("294-REVIEW WR-04 — a cleared Keep at most never reports 0; out-of-range values clamp to 1-50", () => {
    const { props } = setup({ keepAtMost: 5 })
    const input = screen.getByRole("spinbutton", { name: "Keep at most (passages per search)" })
    fireEvent.change(input, { target: { value: "" } })
    expect(props.onKeepAtMostChange).not.toHaveBeenCalled()
    expect(input).toHaveValue(5)
    fireEvent.change(input, { target: { value: "0" } })
    fireEvent.change(input, { target: { value: "-3" } })
    fireEvent.change(input, { target: { value: "80" } })
    expect(vi.mocked(props.onKeepAtMostChange).mock.calls).toEqual([[1], [1], [50]])
  })

  it("Score the best M candidates first shows poolSize and reports a change", () => {
    const { props } = setup({ poolSize: 20 })
    const input = screen.getByRole("spinbutton", { name: "Score the best (candidates first)" })
    expect(input).toHaveValue(20)
    fireEvent.change(input, { target: { value: "30" } })
    expect(props.onPoolSizeChange).toHaveBeenCalledWith(30)
    expect(screen.getByText("A larger pool gives the engine room to cut; measured at 20.")).toBeInTheDocument()
  })

  it("the model field shows the stored model and reports a change", () => {
    const { props } = setup({ provider: "local", model: "BAAI/bge-reranker-base" })
    const input = screen.getByRole("textbox", { name: "Model" })
    expect(input).toHaveValue("BAAI/bge-reranker-base")
    fireEvent.change(input, { target: { value: "BAAI/bge-reranker-large" } })
    expect(props.onModelChange).toHaveBeenCalledWith("BAAI/bge-reranker-large")
  })
})

describe("scope and context lines", () => {
  it("says when hybrid search is off that reranking runs on hybrid search only", () => {
    setup({ hybridEnabled: false })
    expect(screen.getByText(/runs on hybrid search only/)).toBeInTheDocument()
  })

  it("shows no hybrid note when hybrid search is on", () => {
    setup({ hybridEnabled: true })
    expect(screen.queryByText(/runs on hybrid search only/)).not.toBeInTheDocument()
  })

  it("states that the choice applies to every knowledge-base search", () => {
    setup()
    expect(screen.getByText("Applies to every knowledge-base search, including workflow steps.")).toBeInTheDocument()
  })

  it("after a save says it is saved for the whole organisation", () => {
    setup({ saved: true })
    expect(screen.getByText("Saved for the whole organisation")).toBeInTheDocument()
  })

  it("before a save says it applies to the whole organisation when saved", () => {
    setup({ saved: false })
    expect(screen.getByText("Applies to the whole organisation when you save.")).toBeInTheDocument()
  })
})

describe("Cohere key slot", () => {
  it("renders the slot only when Cohere is selected", () => {
    const slot = <input aria-label="cohere-key-slot" />
    const { rerender, props } = setup({ provider: "cohere", cohereKeySlot: slot })
    expect(screen.getByLabelText("cohere-key-slot")).toBeInTheDocument()
    rerender(<RerankEngineBlock {...props} provider="jev" cohereKeySlot={slot} />)
    expect(screen.queryByLabelText("cohere-key-slot")).not.toBeInTheDocument()
    rerender(<RerankEngineBlock {...props} provider="api" cohereKeySlot={slot} />)
    expect(screen.getByLabelText("cohere-key-slot")).toBeInTheDocument()
  })
})
