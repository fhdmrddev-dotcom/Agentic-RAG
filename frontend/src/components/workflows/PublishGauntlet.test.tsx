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
// Phase 186-16 adds `fireEvent`: the WR-10 rows below click a control that is expected to
// be REFUSED, and `userEvent` asserts pointer-events on the target before it will act — so
// a disabled button makes it throw rather than letting the suite measure "no request left".
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
// Phase 186-10 (WR-02): the F18 describe at the foot of this file reads the SERVER's own
// source instead of trusting a transcribed list — via the SAME `?raw` loader the component
// source is read with two lines above, and deliberately NOT via `node:fs`.
//
// Two reasons the obvious `readFileSync` spelling is wrong here. `tsconfig.app.json` sets
// `types: ["vite/client"]` and nothing else, on purpose: `src/**` is browser code and must
// not be able to reach a Node built-in without the typechecker objecting, so three
// `node:*` imports would have added three NEW `tsc -b` errors to a baseline this phase
// measures every plan against. And the path spelling that pairs with it —
// `new URL("…", import.meta.url)` — is a pattern Vite STATICALLY REWRITES as an asset
// reference, so `fileURLToPath` receives something that is no longer a `file:` URL and
// throws before a single test runs (observed, not predicted).
import publishServiceSource from "../../../../backend/app/services/harness/publish_service.py?raw"
// Read the component SOURCE via Vite's ?raw loader (typechecks under `vite/client`).
import publishGauntletSource from "./PublishGauntlet?raw"
// 193.2-06 (F-5, the client half): the SECOND consumer of the server's one message —
// `blockedReason` is composed here and handed to the component verbatim.
import builderPageSource from "@/pages/WorkflowBuilderPage?raw"
import { PublishGauntlet } from "./PublishGauntlet"
// 199-03 Task 1 (DES-01): the refusal sentences are read from the module that OWNS them,
// so the assertion compares the surface against the vocabulary rather than against a second
// spelling of it. A test that re-typed the sentence would go green on a re-spelled component.
import { blockedSentence } from "./verdictModel"
import type { PublishOutcome } from "@/lib/api"
import { publishWorkflow } from "@/lib/api"

/**
 * D-ITEM-187-20-01 — this suite's per-test budget, raised from the 5 s default.
 *
 * WHAT WAS ACTUALLY MEASURED, not guessed: 46/46 green in 25.6 s when this file runs
 * ALONE, and 1-2 red when it runs inside the count gate's whole blast radius. The first
 * failure is always `Test timed out in 5000ms`; the second is a cascade from it (a
 * half-mounted modal leaves the next case unable to find the trigger). Rolling the source
 * back to a pre-change commit reproduced the identical pair, so it tracks LOAD, not any
 * one phase's edit — four separate investigations have now each spent a measurement
 * proving non-attribution, which is the argument for fixing it instead of proving it a
 * fifth time.
 *
 * Every case here drives `userEvent` against a real modal with real timers; that is
 * legitimately slow and gets slower as the parallel pool fills. A budget is not an
 * assertion — NOTHING below is weakened, no case is skipped, and the gate's `failed 0`
 * requirement is untouched. A genuine hang still fails, 20 s later.
 */
vi.setConfig({ testTimeout: 20000 })

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

  it("the server-fixed stages render (the gauntlet spine) — every check plus the publish commit", async () => {
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    const spine = screen.getByTestId("gauntlet-spine")
    // Match the short human-readable stage labels (sketch 051-A UX labels — full
    // technical descriptions live in the node title= tooltip, not the visible text).
    // "Commit" is the flip itself (Phase 186-05): sketch 020-B D2 has always carried it
    // as its own row, and the spine gained a node for it when the publish commit began
    // refusing a draft that moved mid-gauntlet. "Grounding" is Phase 186-10 (WR-02) — the
    // stage the service has emitted since Phase 182 with no row here to place it.
    for (const label of [
      "Owner",
      "Valid",
      "Goal",
      "Structure",
      "Pause",
      "Grounding",
      "Golden run",
      "Citations",
      "Judge",
      "Commit",
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

    // Backdrop click close (mousedown on the dedicated backdrop button, not the card).
    // Phase 155 (A11Y-01): the dismiss handler moved from the role="dialog" element
    // onto a tabIndex=-1 backdrop <button> (jsx-a11y/no-noninteractive-element-
    // interactions) — same behavior, keyboard close still via ✕ / Escape.
    await openModal()
    await user.click(screen.getByTestId("publish-modal-backdrop"))
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
    await user.click(screen.getByTestId("publish-modal-backdrop")) // backdrop click no-op
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

// --- Phase 127-02 Task 2 (WUX-03, sketch 051-A) — worded verdict leads, raw grid on-demand ---
//
// The resolved gauntlet must LEAD with a plain-worded verdict; the verbatim 5-field
// PublishVerdict grid + the `▦ rendered verbatim` provenance cap are DEMOTED behind a
// <details data-testid="raw-verdict"> disclosure (honesty preserved, just not leading).
// The judge per-criterion rows stay FIRST-CLASS (outside the disclosure). Every existing
// honesty assertion above is unchanged — these are ADDITIVE.
describe("PublishGauntlet — worded verdict leads + raw 5-field grid on-demand (Phase 127-02)", () => {
  /** A 200 judge BLOCK with a per-criterion row + a server summary. */
  const judgeBlock: PublishOutcome = {
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
  }

  it("(a) leads a resolved block with a plain-worded headline that PRECEDES the raw-verdict disclosure", async () => {
    mockedPublish.mockResolvedValue(judgeBlock)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())
    // The worded headline conveys "blocked by the grader / hard wall" — not the bare grid.
    const headline = screen.getByTestId("verdict-headline")
    expect(headline).toHaveTextContent(/blocked by the grader/i)
    // DOM order: the worded headline precedes the raw-verdict disclosure.
    const raw = screen.getByTestId("raw-verdict")
    expect(headline.compareDocumentPosition(raw) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it("(a') leads a success with a worded 'Published … is live' headline (server-truth version)", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: { published: true, version: 3, golden_run_id: "r3", blocked_stage: null, named_failures: [] },
    } satisfies PublishOutcome)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    await waitFor(() => expect(screen.getByTestId("publish-success")).toBeInTheDocument())
    expect(screen.getByTestId("verdict-headline")).toHaveTextContent(/published.*v3.*is live/i)
  })

  it("(b) demotes the raw 5-field grid INSIDE <details data-testid=raw-verdict> — all 5 verdict-* rows are descendants", async () => {
    mockedPublish.mockResolvedValue(judgeBlock)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    const raw = await screen.findByTestId("raw-verdict")
    expect(raw.tagName).toBe("DETAILS")
    // All 5 verbatim verdict rows live inside the disclosure.
    for (const field of ["published", "version", "golden_run_id", "blocked_stage", "named_failures"]) {
      expect(within(raw).getByTestId(`verdict-${field}`)).toBeInTheDocument()
    }
  })

  it("(c) keeps the ▦ 'rendered verbatim' provenance cap INSIDE the raw-verdict disclosure", async () => {
    mockedPublish.mockResolvedValue(judgeBlock)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    const raw = await screen.findByTestId("raw-verdict")
    expect(within(raw).getByText(/rendered verbatim from the server — not re-derived/i)).toBeInTheDocument()
  })

  it("(d) keeps the judge per-criterion rows FIRST-CLASS — OUTSIDE the raw-verdict disclosure", async () => {
    mockedPublish.mockResolvedValue(judgeBlock)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    const raw = await screen.findByTestId("raw-verdict")
    // The per-criterion row is the worded "why" — it must NOT be demoted into the grid.
    expect(within(raw).queryByText(/grounded_in_evidence/)).not.toBeInTheDocument()
    // It is still present, first-class, in the block.
    expect(screen.getByText(/grounded_in_evidence/)).toBeInTheDocument()
  })
})

// --- Phase 186-05 (CONCUR-02, F7) — a refusal is never painted as a pass ------------
//
// THE PROPERTY, NOT THE PATCH. `GauntletSpine` locates the blocked node with
// `STAGES.findIndex(...)`, which answers -1 for a stage this client has never seen —
// the SAME value it uses for "no block happened at all". Both spine reads then took the
// no-block branch, so a refusal carrying an unfamiliar stage rendered every node passed:
// a full green spine underneath a "Blocked" headline that printed the server's raw
// machine token to a business user. That is the T-185-04-01 class exactly — a green
// indicator scoped to the wrong thing — and it became reachable in production the moment
// Phase 186-02 shipped its `draft_changed` refusal.
//
// The stage this suite drives is DELIBERATELY BOGUS rather than the code 186-02 added.
// Keying the guard on the stage that happens to exist today would make it a patch test;
// keyed on a code no server will ever send, it holds for EVERY blocked_stage the backend
// adds after this phase, with no edit here.
const UNKNOWN_STAGE = "a-stage-this-client-has-never-heard-of"

/** The passed-node tone, read out of `nodeTone` in `PublishGauntlet.tsx:346` in this
 *  session (`isPassed → "border-success/50 bg-success/10"`) rather than retyped from
 *  memory — a re-skin that renames the token fails here instead of going quietly green. */
const PASSED_NODE_TONE = "bg-success/10"

/** The reached-connector tone, from the connector div at `PublishGauntlet.tsx:360`
 *  (`connReached ? "bg-success/50" : "bg-border"`). A DIFFERENT literal from the node's,
 *  which is precisely what lets the two independent reads be pinned independently: a fix
 *  applied to only one of them still fails one of the two assertions below. */
const REACHED_CONNECTOR_TONE = "bg-success/50"

describe("PublishGauntlet — an unrecognised blocked_stage never renders a pass (F7)", () => {
  it("paints no passed node, no reached connector and no ✓ badge, and keeps the raw code out of the headline", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: {
        published: false,
        version: null,
        golden_run_id: "run-unknown",
        blocked_stage: UNKNOWN_STAGE,
        named_failures: ["publish was refused"],
      },
    } satisfies PublishOutcome)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())
    const spine = screen.getByTestId("gauntlet-spine")

    // The four claims are SOFT so one run reports all four numbers instead of stopping
    // at the first. That is not leniency — a soft failure still fails the test — it is
    // what makes a HALF-fix visible: the two spine reads below are separate expressions
    // in the component, and repairing one of them must not be able to hide the other.
    //
    // (1) Not one ✓ badge anywhere on the spine — counted across the WHOLE spine, not
    //     on the one node we happened to think of.
    expect.soft(within(spine).queryAllByText("✓")).toHaveLength(0)

    // (2) Not one node carries the passed tone.
    expect.soft(spine.querySelectorAll(`[class*="${PASSED_NODE_TONE}"]`)).toHaveLength(0)

    // (3) The connectors are their OWN read of the same missing index, so they get their
    //     own expect. Folding this into (2) would let a half-fix pass.
    expect.soft(spine.querySelectorAll(`[class*="${REACHED_CONNECTOR_TONE}"]`)).toHaveLength(0)

    // (4) The headline a business user reads is a sentence. The server's token still
    //     renders VERBATIM inside the raw-verdict disclosure — that honesty contract is
    //     untouched; what is forbidden is a machine code leading the surface.
    expect.soft(screen.getByTestId("verdict-headline")).not.toHaveTextContent(UNKNOWN_STAGE)
  })

  it("still renders the unfamiliar stage VERBATIM in the raw-verdict grid — demoted, never removed", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: {
        published: false,
        version: null,
        golden_run_id: null,
        blocked_stage: UNKNOWN_STAGE,
        named_failures: [],
      },
    } satisfies PublishOutcome)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    // Closing the headline leak must not have closed the honesty contract with it: the
    // server's own string is still there, byte for byte, one click away.
    const raw = await screen.findByTestId("raw-verdict")
    expect(within(raw).getByTestId("verdict-blocked_stage")).toHaveTextContent(UNKNOWN_STAGE)
  })
})

// --- Phase 186-10 (CONCUR-02, F18, WR-02) — the spine names every stage the server emits ---
//
// THE CLAIM THIS REPLACES WAS PROSE. The `STAGES` docblock in the component says the table
// mirrors the server's stage list; nothing checked it, and it had been false since Phase 182
// added `grounding_fidelity`. The consequence is not a cosmetic one: a stage the client cannot
// place renders (correctly, per F7) as a fully grey spine under the generic fallback sentence,
// so the author is told a refusal happened and shown nothing about where — for what is, on a
// KB-bound workflow, the single most likely real refusal.
//
// So the list is not transcribed here either. This suite READS `publish_service.py` and drives
// one render per stage it finds. A backend that adds a thirteenth `stage="..."` call makes this
// file go red on the next run, with no edit to the test and no one having to remember.
//
// F7 above is NOT weakened by any of this and must not be: it drives a stage no server will
// ever send, and its fail-closed property is what keeps the forgotten-stage case honest in the
// window between the backend adding one and this test catching it.
/** The call-form literal `_block(..., stage="...")` writes. Held as a SOURCE string and
 *  compiled fresh per use, so the shared `g`-flagged object can never carry a `lastIndex`
 *  from one call into the next. */
const STAGE_LITERAL_PATTERN = 'stage="([a-z_]+)"'

function extractStages(source: string): string[] {
  return [...source.matchAll(new RegExp(STAGE_LITERAL_PATTERN, "g"))].map((m) => m[1])
}

/** Every distinct `blocked_stage` value the publish service can emit, read from its source. */
const EMITTED_STAGES = new Set(extractStages(publishServiceSource))

/**
 * The stages that are emitted but provably cannot arrive here as a `blocked_stage`.
 *
 * AN ALLOW-LIST WITH REASONS, NOT A DRIFT HATCH. Each entry owes a line of evidence that
 * the value cannot reach `GauntletSpine` — and the size assertion below is what stops the
 * next forgotten stage from being parked here instead of given a row, which would quietly
 * turn this whole suite back into the prose claim it replaced.
 *
 * `already_published` (publish_service.py:130 and :385) — `api.ts:3753-3754` maps HTTP 404
 * to `{kind:"not_found"}` and HTTP 409 to `{kind:"already_published"}`. NEITHER outcome
 * carries a `verdict`, and the spine is driven by `verdict?.blocked_stage ?? null`, so this
 * stage renders as its own dedicated 409 block panel and never reaches the spine at all.
 */
const NOT_ON_THE_SPINE = new Set(["already_published"])

/** The stages that MUST each land on exactly one node. */
const SPINE_STAGES = [...EMITTED_STAGES].filter((s) => !NOT_ON_THE_SPINE.has(s))

/** The blocked-node tone, read out of `nodeTone` in `PublishGauntlet.tsx` rather than
 *  retyped from memory — the same discipline as PASSED_NODE_TONE above. */
const BLOCKED_NODE_TONE = "border-destructive/60"

describe("PublishGauntlet — F18: the spine names every stage the server can emit (WR-02)", () => {
  it("(F18a) the extraction is not vacuous — it reads real stages, and the pattern captures a planted one", () => {
    // The service has emitted at least eleven distinct stages since Phase 186-02. A refactor
    // that renamed the `_block` keyword would silently empty this set and turn the property
    // test below into zero cases, which is the one way this suite could lie.
    expect(EMITTED_STAGES.size).toBeGreaterThanOrEqual(11)
    // A positive control on the pattern itself: a source line the regex has never seen still
    // yields its stage. Without this, an over-narrow pattern reads as "nothing changed".
    const planted = 'return await _block(pool, stage="a_planted_stage", named_failures=[])'
    expect(extractStages(planted)).toEqual(["a_planted_stage"])
  })

  it("(F18c) the exclusion set is justified, not convenient — exactly one entry, and it is the 409", () => {
    expect([...NOT_ON_THE_SPINE]).toEqual(["already_published"])
    // Deliberately an equality, not a `toBeLessThanOrEqual`. Growing this set is allowed only
    // together with the evidence line in its docblock, and editing this number is the moment
    // that costs a reviewer's attention.
    expect(NOT_ON_THE_SPINE.size).toBe(1)
    // And the excluded stage really is emitted — an exclusion for a stage that does not exist
    // would be dead weight pretending to be a decision.
    expect(EMITTED_STAGES.has("already_published")).toBe(true)
  })

  it.each(SPINE_STAGES)(
    "places the server's `%s` refusal on exactly one spine node",
    async (stage) => {
      mockedPublish.mockResolvedValue({
        kind: "verdict",
        verdict: {
          published: false,
          version: null,
          golden_run_id: null,
          blocked_stage: stage,
          named_failures: ["publish was refused"],
        },
      } satisfies PublishOutcome)
      render(<PublishGauntlet definitionId="def-1" />)
      await doPublish("go")

      await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())
      const spine = screen.getByTestId("gauntlet-spine")

      // EXACTLY one. Zero is the WR-02 failure — a stage with no row, painted grey end to end.
      // Two would mean a code was copied onto a second row, which would tell an author the
      // refusal happened somewhere it did not.
      const blocked = spine.querySelectorAll(`[class*="${BLOCKED_NODE_TONE}"]`)
      expect(blocked).toHaveLength(1)

      // The blocked node is not simultaneously claimed as passed — which is also the "at least
      // one node is not passed" guarantee, asserted on the node where it matters rather than
      // on a count that a re-skin could satisfy by accident.
      expect((blocked[0] as HTMLElement).className).not.toContain(PASSED_NODE_TONE)
    },
  )
})

// --- Phase 186-05 (CONCUR-02, D-186-11) — the publish-commit refusal ----------------
//
// `draft_changed` is the refusal Phase 186-02 shipped: the gauntlet passed, but the draft
// moved while it was being checked, so the flip was refused rather than publishing a
// definition that never passed. It is the FIRST stage to reach the client that the spine
// had no node for — which is how the fail-open above was found — and it is now the ninth
// row, after the grader rather than inside it.
describe("PublishGauntlet — a draft that moved mid-gauntlet blocks at the Commit node", () => {
  /** The server's verdict for a publish-commit refusal, verbatim from 186-02's contract:
   *  HTTP 200, `published: false`, and the golden run PRESERVED as the record of what was
   *  actually checked. `named_failures` carries the server's own sentence. */
  const draftChangedBlock: PublishOutcome = {
    kind: "verdict",
    verdict: {
      published: false,
      version: null,
      golden_run_id: "a7f3c1d2-run",
      blocked_stage: "draft_changed",
      named_failures: [
        "the draft changed while it was being checked — re-publish to check the new version",
      ],
    },
  }

  /** The node box for a spine row, found by its visible label. The label sits beside the
   *  box inside the row's column, so the box is the label's preceding sibling. */
  function nodeBoxFor(label: string): HTMLElement {
    const spine = screen.getByTestId("gauntlet-spine")
    const labelEl = within(spine).getByText(label)
    const box = labelEl.previousElementSibling
    expect(box).not.toBeNull()
    return box as HTMLElement
  }

  it("blocks AT the Commit node, passes every check before it, and leads with a plain sentence", async () => {
    mockedPublish.mockResolvedValue(draftChangedBlock)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()

    await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())

    // The Commit node is the blocked one — red, and NOT wearing a ✓.
    const commit = nodeBoxFor("Commit")
    expect(commit.className).toContain("border-destructive/60")
    expect(within(commit).queryByText("✓")).not.toBeInTheDocument()

    // The grader passed, and the spine says so. Placing this code on the Judge row would
    // have told the author the opposite.
    const judge = nodeBoxFor("Judge")
    expect(judge.className).toContain(PASSED_NODE_TONE)
    expect(within(judge).getByText("✓")).toBeInTheDocument()
    // Every check passed and the LAST row is the block: every node but one wears a ✓.
    // Phase 186-10 replaced the literal 8 here with the node count. The literal was a fact
    // about the table's length, not about the property — inserting the `Grounding` row made
    // it read 9 and failed a test whose claim had not changed at all.
    const spine = screen.getByTestId("gauntlet-spine")
    const nodeBoxes = spine.querySelectorAll('[class*="rounded-xl"]')
    expect(nodeBoxes.length).toBeGreaterThan(1)
    expect(within(spine).queryAllByText("✓")).toHaveLength(nodeBoxes.length - 1)

    // The headline is a sentence and carries no machine token; the server's own words
    // render underneath, verbatim, as the block message.
    const headline = screen.getByTestId("verdict-headline")
    expect(headline).toHaveTextContent(/the draft changed while it was being checked/i)
    expect(headline).not.toHaveTextContent("draft_changed")
    expect(screen.getByText(/re-publish to check the new version/i)).toBeInTheDocument()

    // The golden run really happened and is preserved — the run affordance still gates on
    // golden_run_id, and this refusal has one.
    expect(screen.getByTestId("run-link")).toBeInTheDocument()
  })

  it("renders a real glyph on EVERY spine node — an unverified icon slug cannot ship as an invisible node", async () => {
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()

    // unplugin-icons resolves an unknown fluent-emoji slug to an EMPTY <svg> rather than
    // failing the build, so presence alone proves nothing. Assert the drawing.
    //
    // Phase 186-10 widened this from the Commit node to every node. The component's icon
    // docblock claims "the newest addition is pinned by a render assertion in the suite" —
    // scoped to one named row, that claim expired the moment `Grounding` was added and no
    // one thought to duplicate the test. Swept across the spine, it cannot expire again.
    const spine = screen.getByTestId("gauntlet-spine")
    const nodeBoxes = [...spine.querySelectorAll('[class*="rounded-xl"]')]
    expect(nodeBoxes.length).toBeGreaterThan(1)
    for (const box of nodeBoxes) {
      const svg = box.querySelector("svg")
      expect(svg).not.toBeNull()
      expect((svg as SVGSVGElement).childNodes.length).toBeGreaterThan(0)
    }
    // And the two rows this phase's suites name by hand really are on that swept list.
    expect(nodeBoxFor("Commit")).toBeInTheDocument()
    expect(nodeBoxFor("Grounding")).toBeInTheDocument()
  })

  it("pulses the Golden run row WHEREVER it sits — and pulses nothing else (Phase 186-10)", async () => {
    const user = userEvent.setup()
    mockedPublish.mockReturnValue(new Promise<PublishOutcome>(() => {})) // never resolves
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    await user.type(screen.getByLabelText(/golden_input/i), "a representative kickoff")
    await user.click(screen.getByRole("button", { name: /run the gauntlet/i }))

    // This test used to defend a WEAKER claim — that appending a row left a literal index
    // pointing at the right node. Phase 186-10 inserted `Grounding` at its true pipeline
    // position, which moved Golden run from index 5 to index 6 and would have silently
    // pulsed the wrong row. The property it defends now is the one that survives that: the
    // aura sits on the golden-run row because the component LOOKS THAT ROW UP, not because
    // the table happens to be shaped a certain way.
    await waitFor(() => expect(nodeBoxFor("Golden run").className).toContain("border-amber-500"))
    expect(nodeBoxFor("Commit").className).not.toContain("border-amber-500")
    expect(nodeBoxFor("Grounding").className).not.toContain("border-amber-500")

    // EXACTLY ONE amber node on the whole spine. Without this, a derived index that answered
    // -1 (or an every-node highlight) would still satisfy the assertion above — the count is
    // what makes the derivation falsifiable rather than merely re-passing.
    const spine = screen.getByTestId("gauntlet-spine")
    expect(spine.querySelectorAll('[class*="border-amber-500"]')).toHaveLength(1)

    // And nothing is claimed as passed while the run is still in flight.
    expect(within(spine).queryAllByText("✓")).toHaveLength(0)
  })
})

// --- Phase 186-16 (CONCUR-02, WR-10) — the INNER Publish is gated too ----------------
//
// The trigger has been refused by `blockedReason` since 184-11. The inner button was not:
// it was gated on `goldenInput.trim().length > 0 && !loading` alone, and the modal can sit
// open for as long as the author takes to write a golden input. That click is the one that
// actually spends money — a gauntlet started on top of an outstanding autosave PATCH burns
// a real golden run to reach a `draft_changed` refusal it was always going to get.
//
// EVERY ROW HERE DRIVES THE REASON IN WHILE THE MODAL IS ALREADY OPEN, via `rerender`. That
// is not a convenience: with a reason supplied from the start the TRIGGER is disabled, so
// the modal could not be opened at all. The open-then-blocked sequence is the real one, and
// it carries its own positive control — the button is proven enabled first.
describe("PublishGauntlet 186-16 — a gauntlet cannot START while a reason stands (WR-10)", () => {
  /** Deliberately NOT the Builder's own sentence: the component neither authors nor
   *  rewrites this string, so the suite proves passthrough rather than re-typing copy. */
  const CALLER_REASON = "The caller's own sentence, rendered verbatim and never rewritten"

  /** Open the modal and put a valid golden input in it — i.e. reach the exact state in
   *  which the ONLY thing that may still refuse the click is the supplied reason. */
  async function openAndArm() {
    const user = userEvent.setup()
    await openModal()
    await user.type(screen.getByLabelText(/golden_input/i), "a representative kickoff")
    const btn = screen.getByRole("button", { name: /run the gauntlet/i })
    expect(btn).toBeEnabled() // the positive control, before anything is blocked
    return { user, btn }
  }

  it("a reason arriving mid-modal disables Publish DESPITE a valid golden input, and says why INSIDE the modal", async () => {
    const { rerender } = render(<PublishGauntlet definitionId="def-1" />)
    const { btn } = await openAndArm()

    rerender(<PublishGauntlet definitionId="def-1" blockedReason={CALLER_REASON} />)

    expect(btn).toBeDisabled()
    // R12: the explanation is REACHABLE from the control it disables. The trigger's own
    // reason is behind the backdrop, so this element is not a duplicate — it is the only
    // one an author inside the dialog can read.
    const reason = screen.getByTestId("publish-inner-blocked-reason")
    expect(reason.textContent).toBe(CALLER_REASON)
    expect(btn.getAttribute("aria-describedby")).toBe(reason.getAttribute("id"))
    // …and it is TEXT, not a tooltip (the shipped refusal-copy rule).
    expect(btn.getAttribute("title")).toBeNull()
  })

  it("clicking the refused Publish issues NO publish request — the claim is that nothing left", async () => {
    const { rerender } = render(<PublishGauntlet definitionId="def-1" />)
    const { btn } = await openAndArm()
    rerender(<PublishGauntlet definitionId="def-1" blockedReason={CALLER_REASON} />)

    fireEvent.click(btn)
    // Measured on the transport, not on the rendered outcome: a golden run's cost is
    // spent the moment the request leaves, whatever the UI does afterwards.
    expect(mockedPublish).not.toHaveBeenCalled()
    // …and nothing was CLAIMED to be running either: `runGauntlet` returns before
    // `setLoading(true)`, so the button never wears the in-flight label.
    expect(btn.textContent).toBe("Publish ▸ run the gauntlet")
  })

  it("the reason CLEARING re-opens the gate — one click, exactly one request", async () => {
    mockedPublish.mockResolvedValue({
      kind: "verdict",
      verdict: { published: true, version: 1, golden_run_id: "r1", blocked_stage: null, named_failures: [] },
    } satisfies PublishOutcome)
    const { rerender } = render(<PublishGauntlet definitionId="def-1" />)
    const { btn } = await openAndArm()

    rerender(<PublishGauntlet definitionId="def-1" blockedReason={CALLER_REASON} />)
    expect(btn).toBeDisabled()

    // The write landed; the Builder stops supplying a reason. This is what makes the row
    // above a measurement of the GATE rather than of a permanently broken button.
    rerender(<PublishGauntlet definitionId="def-1" blockedReason={null} />)
    expect(btn).toBeEnabled()
    expect(screen.queryByTestId("publish-inner-blocked-reason")).not.toBeInTheDocument()
    expect(btn.getAttribute("aria-describedby")).toBeNull()

    fireEvent.click(btn)
    await waitFor(() => expect(mockedPublish).toHaveBeenCalledTimes(1))
    expect(mockedPublish).toHaveBeenCalledWith("def-1", "a representative kickoff")
  })

  it("with NO blockedReason prop the inner control is the one that shipped", async () => {
    // The guarantee every non-Builder call site rides on. The shipped assertions above
    // cover the trigger; this is the inner half, stated explicitly.
    render(<PublishGauntlet definitionId="def-1" />)
    const { btn } = await openAndArm()

    expect(screen.queryByTestId("publish-inner-blocked-reason")).not.toBeInTheDocument()
    expect(btn.hasAttribute("aria-describedby")).toBe(false)
    expect(screen.queryByTestId("publish-blocked-reason")).not.toBeInTheDocument()
    expect(screen.getByTestId("publish-trigger")).toBeEnabled()
  })

  it("the emptiness test has ONE home — a whitespace-only reason blocks nothing, inner button included", async () => {
    // A caller with nothing to say must not be able to disable the control by accident.
    // The wrapper's `blocked` derivation is the single answer both controls read, so this
    // is the same rule the trigger already obeys — not a second copy of it.
    const { rerender } = render(<PublishGauntlet definitionId="def-1" />)
    const { btn } = await openAndArm()

    rerender(<PublishGauntlet definitionId="def-1" blockedReason="   " />)
    expect(btn).toBeEnabled()
    expect(screen.queryByTestId("publish-inner-blocked-reason")).not.toBeInTheDocument()
    expect(screen.getByTestId("publish-trigger")).toBeEnabled()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// PHASE 193.2-06 (F-5, the CLIENT half / D-12) — THE REFUSAL HAS EXACTLY ONE HOME
// ═══════════════════════════════════════════════════════════════════════════════════════
//
// D-12: ONE message string feeds BOTH surfaces — the publish refusal AND `/validate` →
// `blockedReason` → the greyed Publish control. The SERVER owns that sentence; the client
// renders `verdict.message` VERBATIM and constructs no interactive-refusal sentence of its
// own. The backend half (the two callers emit the same bytes) is owned by
// `backend/tests/unit/test_publish_service.py`; this is the half that proves no SECOND copy
// lives on the client.
//
// ⚠ THIS FENCE DELIBERATELY DOES NOT HAND-TYPE THE SERVER'S SENTENCE. Spelling the server's
// copy here would ITSELF be a second home, and it would go stale silently at the next
// reword — exactly the failure `WorkflowBuilderPage.header.test.tsx:126-130` records for the
// governed door strings. So the assertion is STRUCTURAL: the client may not name the engine
// identifiers the refusal is about, and the rendered node's value must come from a variable.
describe("PublishGauntlet 193.2-06 — the interactive refusal has exactly one home (F-5)", () => {
  // The 187-24 trap: a module that DOCUMENTS why a token is absent reds a raw grep for it.
  // Both modules below carry prose about the publish refusal, so every fence here reads
  // NON-COMMENT CODE. (Recorded resolution — `rowIdentity.test.ts:89-98` lists the prior
  // instances; `libraryFilter.test.ts` scopes its own fence the same way.)
  const strip = (s: string) =>
    s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
  const gauntletCode = strip(publishGauntletSource)
  const builderCode = strip(builderPageSource)

  it("(non-vacuity) both modules really loaded, and the stripper keeps CODE while removing PROSE", () => {
    // Without this, every fence below could pass by stripping the whole file — or by
    // importing an empty string, which is how a renamed module passes a sweep silently.
    expect(publishGauntletSource.length).toBeGreaterThan(5000)
    expect(builderPageSource.length).toBeGreaterThan(5000)

    // CODE survives.
    expect(gauntletCode).toContain('data-testid="publish-blocked-reason"')
    expect(builderCode).toContain("blockedReason")

    // PROSE is removed — a token that exists ONLY in a comment must not survive.
    expect(publishGauntletSource).toContain("WR-10")
    expect(gauntletCode).not.toContain("WR-10")
  })

  it("neither client module names an engine identifier the refusal is about", () => {
    // `llm_human_input` / `ask_user` are the two tokens the pre-193.2 message leaked at a
    // person who chose neither (BUG-260815-01). The client has no business composing a
    // sentence about them: it renders whatever the server said.
    for (const [name, code] of [
      ["PublishGauntlet.tsx", gauntletCode],
      ["WorkflowBuilderPage.tsx", builderCode],
    ] as const) {
      for (const token of ["llm_human_input", "ask_user"]) {
        expect(code, `${name} names ${token} in non-comment code — that is a second home for
the refusal's vocabulary, and D-12 gives the server the only one`).not.toContain(token)
      }
    }
  })

  it("the blocked-reason node renders a VARIABLE, never a literal sentence", () => {
    // The span whose value is the server's message. If a future edit swaps `{blockedReason}`
    // for a hard-coded string, the client has silently become the author of the copy.
    const span = gauntletCode.match(
      /data-testid="publish-blocked-reason"[\s\S]{0,400}?<\/span>/,
    )?.[0]
    expect(span, "the publish-blocked-reason span is no longer findable in code").toBeTruthy()
    expect(span).toContain("{blockedReason}")
    // No quoted prose inside the node's children — the only strings the span may carry are
    // its own attributes, which sit before the `>` that opens the children.
    const children = span!.slice(span!.indexOf(">") + 1)
    expect(children).not.toMatch(/["'][A-Za-z][^"']{15,}["']/)
  })

  it("(inline plant) the needle this fence applies really does catch a client-side copy", () => {
    // A permanent positive control: without it, the three assertions above could be passing
    // because they inspect nothing. This is the literal shape the RED drive planted.
    const planted = `
      const reason = "interactive phases (llm_human_input / ask_user dispositions) cannot be validated"
    `
    expect(strip(planted)).toContain("llm_human_input")
    expect(strip(planted)).toContain("ask_user")
    // …and the stripper does NOT rescue a comment-shaped plant into invisibility by accident:
    // a plant inside a comment is correctly ignored, which is the whole point of stripping.
    expect(strip("// llm_human_input in a comment")).not.toContain("llm_human_input")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// Phase 199-03 Task 1 (DES-01 · sheet 178 `c7-gauntlet-soul`) — THE PRE-CHANGE
// INVENTORY, and the three sheet claims that had no RENDERED guard.
//
// Sheet 178 renders ZERO shipped components — every sheet is drawn from scratch — so each
// row below is a claim about OUR surface that had to be MEASURED before anything moved.
// The resting atoms are pinned PRESENT (the `192.2-05` method): a later removal is proved
// by INVERTING an assertion here to absent, never by deleting one. A deleted assertion
// proves nothing at all about what a re-presentation subtracted.
//
// Three of the sheet's claims had no rendered guard on this surface before this plan:
//  · "indeterminate while running" — the shipped spine IS honest, but nothing asserted it
//    over the RUNNING render. The F7 describe above asserts a related property over a
//    RESOLVED unknown block, which is a different moment and cannot stand in for it.
//  · "no override control anywhere" — guarded by a `?raw` regex over the source, and by one
//    button scan needled on two words. A LINK, a MENU ITEM, or a control worded any other
//    way was invisible to both, and a source regex cannot see a control whose label is
//    composed from a variable at all.
//  · "raw detail on demand" — asserted to EXIST; never asserted to be the ONLY one, so a
//    second disclosure could have been built beside it with the suite green.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every way a "go forward anyway" control could actually ARRIVE on this surface —
 * deliberately wider than the two words the shipped scan needled, and matched over a ROLE
 * set rather than over `<button>` alone.
 *
 * The `no override · <s>publish anyway</s>` strip the wall renders ON PURPOSE is not a
 * member of any of these selectors, and neither is the sentence saying there is no
 * override — both are plain text nodes. That is what lets this scan be strict about
 * controls while the deliberate ABSENCE keeps rendering.
 */
const FORWARD_CONTROL_SELECTOR = [
  "button",
  "a[href]",
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  'input[type="submit"]',
  'input[type="button"]',
].join(", ")

/** The words a control offering a way past the wall would plausibly wear. */
const OVERRIDE_NEEDLE =
  /publish anyway|override|proceed|force[-\s]?publish|bypass|ignore the (?:grader|judge)|skip the (?:grader|judge)|publish regardless|ship it/i

/** Controls inside `root` whose label, aria-label or title offers a way past. */
function forwardControlsIn(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FORWARD_CONTROL_SELECTOR)).filter((el) => {
    const surfaces = [
      el.textContent ?? "",
      el.getAttribute("aria-label") ?? "",
      el.getAttribute("title") ?? "",
    ]
    return surfaces.some((s) => OVERRIDE_NEEDLE.test(s))
  })
}

/** The judge block the whole hard-wall contract is measured against. */
const JUDGE_BLOCK: PublishOutcome = {
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
}

/** A MECHANICAL block — recoverable, and pre-run, so it carries no golden run. */
const MECHANICAL_BLOCK: PublishOutcome = {
  kind: "verdict",
  verdict: {
    published: false,
    version: null,
    golden_run_id: null,
    blocked_stage: "lint",
    named_failures: [
      { code: "unreachable_phase", phase: "summarise", message: "nothing routes to this step" },
    ],
  },
}

describe("PublishGauntlet 199-03 — the pre-change RESTING inventory (sheet c7)", () => {
  it("(rest) the closed gauntlet is ONE control and nothing else, and its label is this literal", () => {
    render(<PublishGauntlet definitionId="def-1" />)
    expect(screen.getByTestId("publish-trigger")).toHaveTextContent("◆ Publish…")
    // The sheet's at-rest row draws an eight-segment strip inside a card. Ours draws a
    // single button — already LESS, so there is nothing here to subtract.
    expect(screen.queryByTestId("publish-modal")).not.toBeInTheDocument()
    expect(screen.queryByTestId("gauntlet-spine")).not.toBeInTheDocument()
    expect(screen.queryByTestId("publish-soul")).not.toBeInTheDocument()
  })

  it("(rest) the opened modal's atoms, as LITERALS — pinned present so a removal is proved by INVERSION", async () => {
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    const modal = screen.getByTestId("publish-modal")

    // The three regions the resting modal is made of.
    expect(screen.getByTestId("publish-soul")).toBeInTheDocument()
    expect(screen.getByTestId("gauntlet-spine")).toBeInTheDocument()
    expect(screen.getByLabelText(/golden_input/i)).toBeInTheDocument()

    // The form's own words, verbatim. These say what publishing COSTS, which is the
    // purpose that has to survive any cut.
    expect(modal).toHaveTextContent("golden_input — a representative kickoff prompt")
    expect(modal).toHaveTextContent(/Publishing runs the full gauntlet above/)
    expect(modal).toHaveTextContent(/It can honestly block\./)
    expect(screen.getByRole("button", { name: /run the gauntlet/i })).toHaveTextContent(
      "Publish ▸ run the gauntlet",
    )
    expect(screen.getByPlaceholderText(/Choose something typical, not a corner case/)).toBeInTheDocument()

    // ⚠ THE DUPLICATION, MEASURED — AND THEN SUBTRACTED (Task 2). Before this plan the
    // dialog's title bar and the form's section heading said the SAME four words about two
    // lines apart. EXACTLY ONE of these two lines moved, and saying which is the point:
    //   · the FIRST is the "purpose survives the cut" guard and it reads 1 BOTH before and
    //     after — the title bar's node is untouched. (It never counted the section heading,
    //     because that node's text is "◆ Publish this workflow" and this match is exact.)
    //   · the SECOND is the INVERSION: `toHaveLength(1)` → `not.toBeInTheDocument()`. The
    //     same atom, asserted at the opposite polarity, rather than an assertion deleted.
    expect(screen.getAllByText("Publish this workflow")).toHaveLength(1)
    expect(screen.queryByText("◆ Publish this workflow")).not.toBeInTheDocument()
  })

  it("(subtraction) the whole strip FITS the modal body — arithmetic over the RENDERED widths", async () => {
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    const spine = screen.getByTestId("gauntlet-spine")

    // Widths are read BACK off the render, so this is a measurement of the shipped strip
    // and not a second copy of a number written in the component.
    const widestPx = (el: HTMLElement): number => {
      const hits = Array.from(el.className.matchAll(/w-\[(\d+)px\]/g)).map((m) => Number(m[1]))
      expect(hits.length).toBeGreaterThan(0) // non-vacuity: a class change must not silently pass
      return Math.max(...hits)
    }

    const cols = Array.from(spine.querySelectorAll<HTMLElement>('[data-testid="spine-stage"]'))
    const conns = Array.from(spine.querySelectorAll<HTMLElement>('[data-testid="spine-conn"]'))
    expect(cols).toHaveLength(10)
    expect(conns).toHaveLength(9) // one fewer than the nodes, by construction

    // The modal body's inner width: `max-w-2xl` (672px) minus `px-4` on both sides.
    const MODAL_BODY_PX = 672 - 32
    const strip = cols.length * widestPx(cols[0]) + conns.length * widestPx(conns[0])
    expect(strip).toBeLessThanOrEqual(MODAL_BODY_PX)
  })

  it("(rest) the spine names its ten server stages as literals, in the server's own order", async () => {
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    const spine = screen.getByTestId("gauntlet-spine")
    const rendered = Array.from(spine.querySelectorAll("div")).map((d) => d.textContent ?? "")
    for (const stage of [
      "Owner",
      "Valid",
      "Goal",
      "Structure",
      "Pause",
      "Grounding",
      "Golden run",
      "Citations",
      "Judge",
      "Commit",
    ]) {
      expect(rendered).toContain(stage)
    }
    // The node COUNT follows the STAGES table; it is read off the render, never written
    // twice. `rounded-xl` is the node box's own shape class and nothing else in the spine
    // carries it — the connectors are `rounded-full`, the ✓ badge is a circle.
    expect(spine.querySelectorAll('[class*="rounded-xl"]')).toHaveLength(10)
  })
})

describe("PublishGauntlet 199-03 — IN PROGRESS is INDETERMINATE (sheet c7 row 2)", () => {
  /** Put the gauntlet into the in-flight state and hand back the modal element. */
  async function startNeverResolvingPublish(): Promise<HTMLElement> {
    const user = userEvent.setup()
    mockedPublish.mockReturnValue(new Promise<PublishOutcome>(() => {}))
    render(<PublishGauntlet definitionId="def-1" />)
    await openModal()
    await user.type(screen.getByLabelText(/golden_input/i), "a representative kickoff")
    await user.click(screen.getByRole("button", { name: /run the gauntlet/i }))
    await waitFor(() => expect(screen.getByTestId("publish-elapsed")).toBeInTheDocument())
    return screen.getByTestId("publish-modal")
  }

  it("claims NO stage has passed while the run is in flight — no green node, no ✓ badge, no reached connector", async () => {
    await startNeverResolvingPublish()
    const spine = screen.getByTestId("gauntlet-spine")
    // The wire carries no per-stage progress during a publish: the request is ONE
    // synchronous call whose only answer is the final verdict. Painting any node passed
    // here would be the fabricated precision this project forbids — and it is exactly
    // what the SHEET draws (three filled segments of eight, before anything has resolved).
    expect(spine.querySelectorAll('[class*="border-success"]')).toHaveLength(0)
    expect(spine.querySelectorAll('[class*="bg-success"]')).toHaveLength(0)
    expect(spine.textContent ?? "").not.toContain("✓")
  })

  it("renders no determinate progress anywhere while running — no percentage, no 'n of 10', no aria-valuenow", async () => {
    const modal = await startNeverResolvingPublish()
    const text = modal.textContent ?? ""
    expect(text).not.toMatch(/\d+\s*%/)
    expect(text).not.toMatch(/\b\d+\s*(?:of|\/)\s*10\b/i)
    expect(text).not.toMatch(/\bstage\s*\d+\b/i)
    // An indeterminate progressbar would be legitimate; a VALUED one is the claim we
    // cannot make, so the guard is on the value and not on the role.
    for (const bar of Array.from(modal.querySelectorAll('[role="progressbar"]'))) {
      expect(bar.getAttribute("aria-valuenow")).toBeNull()
    }
    // Exactly one node is alive, and it is the only stage a user actually waits on.
    expect(screen.getByTestId("gauntlet-spine").querySelectorAll(".gauntlet-node-run")).toHaveLength(1)
  })

  it("the only number it shows while running is a MEASURED one — the elapsed clock", async () => {
    const modal = await startNeverResolvingPublish()
    expect(screen.getByTestId("publish-elapsed")).toHaveTextContent(/elapsed/i)
    // Elapsed time is observed. An estimate, a remaining, or an ETA would all be predicted.
    expect(modal.textContent ?? "").not.toMatch(
      /remaining|estimated|\beta\b|about \d+ (?:more )?(?:second|minute)/i,
    )
  })
})

describe("PublishGauntlet 199-03 — the judge wall carries NO override, over the WHOLE rendered state", () => {
  it("(non-vacuity) the scan FIRES on a planted button, a planted link and a planted menu item", () => {
    // Three plants, three arms. The shipped guard scanned `<button>` only, so a link or a
    // menu item offering the same thing was invisible to it. Driving the predicate RED
    // here — permanently — is what keeps the absence assertion below falsifiable rather
    // than vacuous: a selector typo matching nothing fails THIS case first.
    const { container } = render(
      <div>
        <button type="button">Publish anyway</button>
        <a href="/x">Override the grader</a>
        <div role="menuitem">Proceed to publish</div>
      </div>,
    )
    const hits = forwardControlsIn(container)
    expect(hits).toHaveLength(3)
    expect(hits.map((h) => h.textContent)).toEqual([
      "Publish anyway",
      "Override the grader",
      "Proceed to publish",
    ])
  })

  it("(non-vacuity) the scan does NOT fire on the deliberate absence the hard wall renders", () => {
    // `no override · <s>publish anyway</s>` is TEXT, not a control. A scan that flagged it
    // would force the honest absence to be deleted to go green — the opposite of the point.
    const { container } = render(
      <p>
        no override · <s>publish anyway</s>
      </p>,
    )
    expect(forwardControlsIn(container)).toHaveLength(0)
  })

  it("finds no forward control ANYWHERE in the judge-failure state — buttons, links, menu items", async () => {
    mockedPublish.mockResolvedValue(JUDGE_BLOCK)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()
    await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())

    // The WHOLE rendered state, not just the verdict card: a control smuggled into the
    // modal header, the spine or the soul block would be just as much of a way past.
    const modal = screen.getByTestId("publish-modal")
    expect(forwardControlsIn(modal)).toHaveLength(0)

    // …and again with the disclosure OPEN, because a closed <details> still has its
    // children in the DOM but a future collapsed region might not.
    const raw = screen.getByTestId("raw-verdict") as HTMLDetailsElement
    raw.open = true
    expect(forwardControlsIn(modal)).toHaveLength(0)

    // The one forward affordance is the honest one, and it is not a way past the wall.
    expect(screen.getByRole("button", { name: /fix & re-publish/i })).toBeEnabled()
  })

  it("the two failure kinds are separated in WORDS — and the words are IMPORTED, never re-spelled here", async () => {
    // The sheet writes its own sentences ("The workflow quality does not meet production
    // standards." / "Two phases have no knowledge source."). Ours come from the pure
    // verdict module, the ONE home for every word a surface says about a check.
    mockedPublish.mockResolvedValue(JUDGE_BLOCK)
    const { unmount } = render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()
    await waitFor(() => expect(screen.getByTestId("verdict-headline")).toBeInTheDocument())
    expect(screen.getByTestId("verdict-headline")).toHaveTextContent(blockedSentence("judge"))
    // FATAL, in words — the wall is stated, not merely coloured.
    expect(screen.getByTestId("publish-block")).toHaveTextContent(/hard wall/i)
    unmount()

    mockedPublish.mockResolvedValue(MECHANICAL_BLOCK)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()
    await waitFor(() => expect(screen.getByTestId("verdict-headline")).toBeInTheDocument())
    expect(screen.getByTestId("verdict-headline")).toHaveTextContent(blockedSentence("lint"))
    // RECOVERABLE, in words — a route forward is named, and no wall is claimed.
    expect(screen.getByTestId("publish-block")).toHaveTextContent(/Fix the cause and re-publish/i)
    expect(screen.getByTestId("publish-block")).not.toHaveTextContent(/hard wall/i)

    // Two genuinely different strings — not one sentence tinted twice.
    expect(blockedSentence("judge")).not.toEqual(blockedSentence("lint"))
  })

  it("the raw detail is ALREADY on demand, and there is exactly ONE of it (do not build a second)", async () => {
    mockedPublish.mockResolvedValue(JUDGE_BLOCK)
    render(<PublishGauntlet definitionId="def-1" />)
    await doPublish()
    await waitFor(() => expect(screen.getByTestId("publish-block")).toBeInTheDocument())

    // The sheet's "View Details" affordance. Ours is a real <details> disclosure, closed by
    // default — the sheet draws an <a href="#">, which is a dead affordance.
    expect(screen.getByTestId("publish-modal").querySelectorAll("details")).toHaveLength(1)
    const raw = screen.getByTestId("raw-verdict") as HTMLDetailsElement
    expect(raw.tagName).toBe("DETAILS")
    expect(raw.open).toBe(false)
    expect(within(raw).getByText(/Show raw verdict/i)).toBeInTheDocument()
  })
})
