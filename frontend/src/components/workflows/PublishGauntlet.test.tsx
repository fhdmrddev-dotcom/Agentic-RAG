/**
 * Phase 103-05 Task 1 (REQ-6 / WFAUTH-01, sketch 020-B) — PublishGauntlet tests.
 *
 * The publish-gauntlet UI CLIENT. The gauntlet RUNS server-side (Phase 102); this
 * client must NEVER re-derive the verdict.
 *
 * Phase 103-ux: the gauntlet now opens as a MODAL. The resting render is just a
 * compact "Publish…" trigger — the full gauntlet content (form / spine / verdict)
 * is NOT in the DOM until the trigger is clicked. Every honesty assertion below
 * therefore opens the modal first (`openModal()`); the contracts themselves are
 * unchanged. These tests pin the locked honesty contracts (the G-6 silent-pass
 * guards):
 *  - at rest only the "Publish…" trigger renders; the gauntlet content mounts on click.
 *  - the publish form is ONE golden_input textarea + a Publish button disabled on
 *    empty/whitespace; the body is {golden_input}.
 *  - the 5 PublishVerdict fields render VERBATIM (no client re-derivation of
 *    published/blocked_stage) — a 200-with-block stays a BLOCK, never relabeled.
 *  - a 200 {published:false, blocked_stage:"judge"} renders as a BLOCK with the
 *    per-criterion rows + the server summary; NO enabled "publish anyway" override
 *    exists; the only forward affordance is "Fix & re-publish".
 *  - a 200 {published:true} renders as success WITH the "view the golden run" link.
 *  - golden_run_id:null + a pre-stage-3 block → NO run link, the explicit no-run note.
 *  - the 4 HTTP outcomes (verdict / business_requirement / not_found /
 *    already_published) each render distinctly.
 *  - named_failures render by KEY-DETECTION; any bare string / unrecognized shape
 *    renders as a BLOCK, never a pass; lint codes render the LOWERCASE literals.
 */
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
// Read the component SOURCE via Vite's ?raw loader (typechecks under `vite/client`).
import publishGauntletSource from "./PublishGauntlet?raw"
import { PublishGauntlet } from "./PublishGauntlet"
import type { PublishOutcome } from "@/lib/api"
import { publishWorkflow } from "@/lib/api"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, publishWorkflow: vi.fn() }
})

const mockedPublish = vi.mocked(publishWorkflow)

beforeEach(() => {
  mockedPublish.mockReset()
})

/** Open the publish modal (click the compact "Publish…" trigger). */
async function openModal() {
  const user = userEvent.setup()
  await user.click(screen.getByTestId("publish-trigger"))
  // The modal + its golden_input textarea are now mounted.
  await waitFor(() => expect(screen.getByLabelText(/golden_input/i)).toBeInTheDocument())
}

/** Open the modal, type the golden_input, and hit the "run the gauntlet" Publish. */
async function doPublish(input = "a representative kickoff") {
  const user = userEvent.setup()
  await openModal()
  const textarea = screen.getByLabelText(/golden_input/i)
  await user.type(textarea, input)
  await user.click(screen.getByRole("button", { name: /run the gauntlet/i }))
}

describe("PublishGauntlet — form + verbatim verdict + judge hard wall", () => {
  it("at rest only the compact 'Publish…' trigger renders; the gauntlet content mounts on click", async () => {
    render(<PublishGauntlet definitionId="def-1" />)
    // The trigger is present, but the gauntlet content (form / spine) is NOT.
    expect(screen.getByTestId("publish-trigger")).toBeInTheDocument()
    expect(screen.queryByLabelText(/golden_input/i)).not.toBeInTheDocument()
    expect(screen.queryByTestId("gauntlet-spine")).not.toBeInTheDocument()
    expect(screen.queryByTestId("publish-modal")).not.toBeInTheDocument()

    await openModal()
    // After opening the modal the form + the 8-stage spine are mounted.
    expect(screen.getByTestId("publish-modal")).toBeInTheDocument()
    expect(screen.getByLabelText(/golden_input/i)).toBeInTheDocument()
    expect(screen.getByTestId("gauntlet-spine")).toBeInTheDocument()
  })

  it("Publish is disabled on empty/whitespace, enabled on non-empty, and sends {golden_input}", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: { published: true, version: 1, golden_run_id: "r1", blocked_stage: null, named_failures: [] },
    } satisfies PublishOutcome)
    const user = userEvent.setup()
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()

    const btn = screen.getByRole("button", { name: /run the gauntlet/i })
    expect(btn).toBeDisabled()

    const textarea = screen.getByLabelText(/golden_input/i)
    await user.type(textarea, "   ") // whitespace only
    expect(btn).toBeDisabled()

    await user.clear(textarea)
    await user.type(textarea, "ship the vendor brief")
    expect(btn).toBeEnabled()

    await user.click(btn)
    expect(mockedPublish).toHaveBeenCalledWith("def-1", "ship the vendor brief")
  })

  it("a 200 judge BLOCK renders as a block (NOT success), per-criterion rows + summary, NO enabled override, a Fix & re-publish affordance", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: {
        published: false,
        version: null,
        golden_run_id: "a7f3c1d2-run",
        blocked_stage: "judge",
        named_failures: [
          { criterion: "grounded_in_evidence", score: 0.42, evidence: "3 of 12 figures are uncited." },
          { summary: "a quarter of its quantitative claims are not grounded in a cited source" },
        ],
      },
    } satisfies PublishOutcome)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    // A block, not a success — verbatim verdict shows published=false + blocked_stage=judge.
    await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())
    expect(screen.queryByTestId("publish-success")).not.toBeInTheDocument()
    expect(screen.getByTestId("verdict-published")).toHaveTextContent(/false/)
    expect(screen.getByTestId("verdict-blocked_stage")).toHaveTextContent(/judge/)

    // Per-criterion row + server summary rendered.
    expect(screen.getByText(/grounded_in_evidence/)).toBeInTheDocument()
    expect(screen.getByText(/3 of 12 figures are uncited/)).toBeInTheDocument()
    expect(screen.getByText(/0\.42/)).toBeInTheDocument()
    expect(screen.getByText(/a quarter of its quantitative claims/)).toBeInTheDocument()

    // The judge is a HARD WALL — NO enabled "publish anyway"/override control.
    const overrideButtons = screen
      .queryAllByRole("button")
      .filter((b) => /publish anyway|override/i.test(b.textContent ?? ""))
    expect(overrideButtons).toHaveLength(0)
    // The deliberate absence is rendered struck-through (the <s> element, exact match —
    // the intro paragraph also mentions "publish anyway" but is not struck-through).
    const struck = screen.getByText("publish anyway", { selector: "s" })
    expect(struck.tagName).toBe("S")
    // The ONLY forward affordance is Fix & re-publish.
    expect(screen.getByRole("button", { name: /fix & re-publish/i })).toBeEnabled()
  })

  it("a 200 success renders success + the 'view the golden run' link (golden_run_id non-null)", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: { published: true, version: 2, golden_run_id: "a7f3c1d2-run", blocked_stage: null, named_failures: [] },
    } satisfies PublishOutcome)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    await waitFor(() => expect(screen.getByTestId("publish-success")).toBeInTheDocument())
    expect(screen.queryByTestId("publish-block")).not.toBeInTheDocument()
    expect(screen.getByTestId("verdict-published")).toHaveTextContent(/true/)
    expect(screen.getByTestId("verdict-version")).toHaveTextContent(/2/)
    // The run link renders (golden_run_id != null).
    expect(screen.getByTestId("run-link")).toBeInTheDocument()
    expect(screen.queryByTestId("no-run-note")).not.toBeInTheDocument()
  })

  it("a pre-stage-3 block (golden_run_id:null) shows NO run link, the explicit no-run note instead", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: {
        published: false,
        version: null,
        golden_run_id: null,
        blocked_stage: "lint",
        named_failures: [{ code: "orphan_phase", phase: "draft-summary", message: "phase is unreachable" }],
      },
    } satisfies PublishOutcome)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())
    expect(screen.queryByTestId("run-link")).not.toBeInTheDocument()
    expect(screen.getByTestId("no-run-note")).toBeInTheDocument()
    // golden_run_id renders verbatim as italic null.
    expect(screen.getByTestId("verdict-golden_run_id")).toHaveTextContent(/null/)
  })

  it("the 4 HTTP outcomes each render distinctly", async () => {
    // verdict (200)
    mockedPublish.mockResolvedValueOnce({
      kind: "verdict",
      verdict: { published: true, version: 1, golden_run_id: "r", blocked_stage: null, named_failures: [] },
    } satisfies PublishOutcome)
    const { unmount: u1 } = render(<PublishGauntlet definitionId="d" />)
    await doPublish()
    await waitFor(() => expect(screen.getByTestId("http-outcome")).toHaveTextContent(/200/))
    u1()

    // business_requirement (400)
    mockedPublish.mockResolvedValueOnce({
      kind: "business_requirement",
      verdict: {
        published: false,
        version: null,
        golden_run_id: null,
        blocked_stage: "business_requirement",
        named_failures: ["exactly one business_requirement must be declared"],
      },
    } satisfies PublishOutcome)
    const { unmount: u2 } = render(<PublishGauntlet definitionId="d" />)
    await doPublish()
    await waitFor(() => expect(screen.getByTestId("http-outcome")).toHaveTextContent(/400/))
    expect(screen.getByTestId("publish-block")).toBeInTheDocument()
    u2()

    // not_found (404)
    mockedPublish.mockResolvedValueOnce({ kind: "not_found" } satisfies PublishOutcome)
    const { unmount: u3 } = render(<PublishGauntlet definitionId="d" />)
    await doPublish()
    await waitFor(() => expect(screen.getByTestId("http-outcome")).toHaveTextContent(/404/))
    expect(screen.getByText(/workflow not found/i)).toBeInTheDocument()
    u3()

    // already_published (409)
    mockedPublish.mockResolvedValueOnce({ kind: "already_published" } satisfies PublishOutcome)
    render(<PublishGauntlet definitionId="d" />)
    await doPublish()
    await waitFor(() => expect(screen.getByTestId("http-outcome")).toHaveTextContent(/409/))
    expect(screen.getByText("Already published")).toBeInTheDocument()
  })

  it("named_failures key-detection: a MIXED list (lint dict + bare string) renders the lint row (lowercase code) AND the bare string as a block — the verdict is a block, never a pass", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: {
        published: false,
        version: null,
        golden_run_id: "run-x",
        blocked_stage: "structural_gate",
        named_failures: [
          { code: "input_unsatisfied", phase: "intake", message: "kickoff_prompt is not satisfied" },
          "the judge produced no verdict (model returned no structured output) — honest failure, not a silent pass",
        ],
      },
    } satisfies PublishOutcome)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())
    expect(screen.queryByTestId("publish-success")).not.toBeInTheDocument()
    // Lint row renders the LOWERCASE code literal.
    expect(screen.getByText("input_unsatisfied")).toBeInTheDocument()
    expect(screen.getByText(/kickoff_prompt is not satisfied/)).toBeInTheDocument()
    // The bare string renders as a block message (the honest-failure line, verbatim).
    expect(screen.getByText(/honest failure, not a silent pass/)).toBeInTheDocument()
  })

  it("an unrecognized named_failures shape (no criterion/code/phase/summary key) renders a block message, never a pass", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: {
        published: false,
        version: null,
        golden_run_id: "run-y",
        blocked_stage: "judge",
        named_failures: [{ unexpected_key: "what?" }],
      },
    } satisfies PublishOutcome)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())
    expect(screen.queryByTestId("publish-success")).not.toBeInTheDocument()
    expect(screen.getByText(/could not produce a verdict|treated as a block/i)).toBeInTheDocument()
  })

  it("the 8 server-fixed stages render (the gauntlet spine)", async () => {
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    const spine = screen.getByTestId("gauntlet-spine")
    // Match the exact server-fixed stage LABELS (8 ordered stages, sketch 020-B D2).
    for (const label of [
      "Owner check",
      "Definition valid",
      "business_requirement",
      "Structural lint",
      "Interactive-phase check",
      "Golden run on your KB",
      "Structural gate",
      "Independent judge",
    ]) {
      expect(within(spine).getByText(label)).toBeInTheDocument()
    }
  })

  // --- Phase 124-03 Task 2 (WUX-01, D-06, sketch 046-A ③) — the prepended soul block ---

  it("prepends the pub-scale soul block (purpose + tier chip) ABOVE the gauntlet ladder (D-06)", async () => {
    const definition = {
      name: "Weekly Status",
      business_requirement: "Summarize the week's progress for stakeholders.",
      phases: [
        { slug: "gather", phase_index: 0, name: "Gather", config: { phase_type: "llm_agent" } },
        { slug: "emit", phase_index: 1, name: "Emit", config: { phase_type: "llm_emit", citation_policy: "strict" } },
      ],
    }
    render(<PublishGauntlet definitionId="def-1" definition={definition} />)
    await openModal()

    // The soul block renders at pub scale with the authored purpose + the tier chip.
    const soul = screen.getByTestId("workflow-soul")
    expect(soul).toHaveAttribute("data-scale", "pub")
    expect(screen.getByText(/Summarize the week's progress/i)).toBeInTheDocument()
    expect(screen.getByTestId("soul-tier")).toHaveAttribute("data-tier", "STRICT")

    // DOM order: the soul block precedes the 8-stage gauntlet spine.
    const spine = screen.getByTestId("gauntlet-spine")
    expect(soul.compareDocumentPosition(spine) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("renders the soul's honest draft empty-state when no definition is passed — and does not crash (additive, optional prop)", async () => {
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    // The soul block still mounts; the purpose atom shows the honest empty-state (D-03).
    expect(screen.getByTestId("workflow-soul")).toBeInTheDocument()
    expect(screen.getByText(/draft · purpose not declared yet/i)).toBeInTheDocument()
    // The 8-stage ladder is unaffected (byte-behavior-identical — D-06).
    expect(screen.getByTestId("gauntlet-spine")).toBeInTheDocument()
  })

  // --- Source-grep guards (the locked render rules survive refactors) ---

  it("renderFailure uses KEY-DETECTION (criterion / code / typeof string), NOT a switch on blocked_stage", () => {
    expect(publishGauntletSource).toMatch(/typeof entry === "string"/)
    expect(publishGauntletSource).toMatch(/"criterion" in/)
    expect(publishGauntletSource).toMatch(/"code" in/)
  })

  it("calls the Plan-03 publishWorkflow client (the server verdict, not re-derived)", () => {
    expect(publishGauntletSource).toMatch(/publishWorkflow/)
  })

  it("the override is ONLY rendered struck-through (no enabled 'publish anyway' control)", () => {
    // "publish anyway" appears inside a <s> strike element (attrs allowed), never a <button>.
    expect(publishGauntletSource).toMatch(/<s\b[^>]*>[^<]*publish anyway/i)
    // No <button> renders a "publish anyway"/override label.
    expect(publishGauntletSource).not.toMatch(/<button[^>]*>\s*[^<]*publish anyway/i)
  })

  it("the run link gates on golden_run_id != null", () => {
    expect(publishGauntletSource).toMatch(/golden_run_id\s*!==?\s*null|golden_run_id != null/)
  })
})

describe("PublishGauntlet — modal shell (Phase 103-ux)", () => {
  it("is a real aria-modal dialog with the shared z-[9000] backdrop, and initial focus lands on golden_input", async () => {
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    const modal = screen.getByTestId("publish-modal")
    expect(modal).toHaveAttribute("role", "dialog")
    expect(modal).toHaveAttribute("aria-modal", "true")
    expect(modal.className).toMatch(/z-\[9000\]/)
    // Initial focus is inside the dialog (the golden_input textarea).
    await waitFor(() => expect(screen.getByLabelText(/golden_input/i)).toHaveFocus())
  })

  it("closes via the ✕ button, Escape, and a backdrop click — and the trigger reopens it", async () => {
    const user = userEvent.setup()
    render(<PublishGauntlet definitionId="def-1" />)

    // ✕ close
    await openModal()
    await user.click(screen.getByTestId("publish-modal-close"))
    await waitFor(() => expect(screen.queryByTestId("publish-modal")).not.toBeInTheDocument())

    // Escape close
    await openModal()
    await user.keyboard("{Escape}")
    await waitFor(() => expect(screen.queryByTestId("publish-modal")).not.toBeInTheDocument())

    // Backdrop click close (mousedown on the backdrop element itself, not the card)
    await openModal()
    await user.click(screen.getByTestId("publish-modal"))
    await waitFor(() => expect(screen.queryByTestId("publish-modal")).not.toBeInTheDocument())
  })

  it("blocks every close affordance WHILE a publish is in flight (✕ disabled, Escape + backdrop no-op)", async () => {
    const user = userEvent.setup()
    // A pending publish that never resolves during the assertion window.
    let resolvePublish: (v: PublishOutcome) => void = () => {}
    mockedPublish.mockReturnValue(
      new Promise<PublishOutcome>((res) => {
        resolvePublish = res
      }),
    )
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    await user.type(screen.getByLabelText(/golden_input/i), "a representative kickoff")
    await user.click(screen.getByRole("button", { name: /run the gauntlet/i }))

    // In flight: the in-progress notice + elapsed timer show; close is blocked.
    await waitFor(() => expect(screen.getByTestId("publish-elapsed")).toBeInTheDocument())
    expect(screen.getByTestId("publish-modal-close")).toBeDisabled()
    await user.keyboard("{Escape}")
    expect(screen.getByTestId("publish-modal")).toBeInTheDocument()
    await user.click(screen.getByTestId("publish-modal")) // backdrop click no-op
    expect(screen.getByTestId("publish-modal")).toBeInTheDocument()

    // Resolve → loading ends → close affordances unlock again.
    resolvePublish({
      kind: "verdict",
      verdict: { published: true, version: 1, golden_run_id: "r1", blocked_stage: null, named_failures: [] },
    })
    await waitFor(() => expect(screen.getByTestId("publish-modal-close")).toBeEnabled())
  })

  it("shows an elapsed-seconds timer while the golden run is in flight", async () => {
    const user = userEvent.setup()
    mockedPublish.mockReturnValue(new Promise<PublishOutcome>(() => {})) // never resolves
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    await user.type(screen.getByLabelText(/golden_input/i), "a representative kickoff")
    await user.click(screen.getByRole("button", { name: /run the gauntlet/i }))
    await waitFor(() => expect(screen.getByTestId("publish-elapsed")).toHaveTextContent(/elapsed/i))
  })
})
