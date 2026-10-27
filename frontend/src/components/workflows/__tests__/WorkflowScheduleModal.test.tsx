import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WorkflowScheduleModal } from "../WorkflowScheduleModal"
import scheduleModalSource from "../WorkflowScheduleModal?raw"
import * as api from "@/lib/api"

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return {
    ...actual,
    listWorkflowSchedules: vi.fn(),
    getEffectiveFeaturesPayload: vi.fn(),
    createWorkflowSchedule: vi.fn(),
    updateSchedule: vi.fn(),
    deleteSchedule: vi.fn(),
    triggerSchedule: vi.fn(),
  }
})

describe("WorkflowScheduleModal (CONN-10 & CONN-11)", () => {
  const dummyWorkflow = { id: "wf-123", name: "Daily ETL" }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listWorkflowSchedules).mockResolvedValue([])
    vi.mocked(api.getEffectiveFeaturesPayload).mockResolvedValue({
      features: {},
      scheduler_process_enabled: true,
    })
  })

  it("defaults token budget to 500,000 and duration to 1,800s", async () => {
    render(<WorkflowScheduleModal workflow={dummyWorkflow} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId("schedule-max-tokens")).toHaveValue(500000)
      expect(screen.getByTestId("schedule-max-duration")).toHaveValue(1800)
    })
  })

  it("renders warning banner when scheduler daemon is inactive", async () => {
    vi.mocked(api.getEffectiveFeaturesPayload).mockResolvedValue({
      features: {},
      scheduler_process_enabled: false,
    })

    render(<WorkflowScheduleModal workflow={dummyWorkflow} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.getByTestId("scheduler-inactive-warning")).toBeInTheDocument()
      expect(screen.getByText(/Scheduler daemon is inactive/)).toBeInTheDocument()
      expect(screen.getByText(/Automations scheduler daemon is inactive on this installation/)).toBeInTheDocument()
    })
  })

  it("does not render warning banner when scheduler daemon is active", async () => {
    vi.mocked(api.getEffectiveFeaturesPayload).mockResolvedValue({
      features: {},
      scheduler_process_enabled: true,
    })

    render(<WorkflowScheduleModal workflow={dummyWorkflow} onClose={vi.fn()} />)

    await waitFor(() => {
      expect(screen.queryByTestId("scheduler-inactive-warning")).not.toBeInTheDocument()
    })
  })
})

/**
 * ── 214-09 (STEP-02 / D-214-04) — THE SCHEDULE DOOR SUPPLIES THE DECLARED KEYS ───────────
 *
 * ⭐ THIS DOOR IS COMPLETE END TO END AND THE LIBRARY ONE IS NOT — the asymmetry is stated
 * here so a reader does not generalise from one to the other. `scheduler_service.py:139-162`
 * already spreads a schedule's stored `inputs` into `run_inputs`, so a key entered on this
 * form reaches the run. The library Run modal's dict stops at `onLaunch`'s argument until
 * plan `214-12` lands the `doRun` hop.
 *
 * ⚠ WHAT IS ASSERTED HERE IS THE PAYLOAD HANDED TO `createWorkflowSchedule`, and nothing
 * beyond it. `createWorkflowSchedule` is mocked in this file; a case that then announced the
 * scheduler had run something would be supplying the other side's half.
 */
describe("WorkflowScheduleModal 214-09 — declared entry inputs (STEP-02 / D-214-04)", () => {
  const dummyWorkflow = { id: "wf-123", name: "Daily ETL" }

  /** Three declared keys: an AUTHORED label, a bare key, and the RESERVED scaffolding key. */
  const declaredDefinition = {
    slug: "vendor-outreach",
    version: 1,
    // 296-04 (287-SCHED): `subject_line` is declared OPTIONAL here, so the cadence case can still
    // send it empty; an absent `required` reads true and Add schedule now refuses it empty.
    inputs: [
      { key: "to", label: "Recipient email" },
      { key: "subject_line", required: false },
      { key: "kickoff_prompt" },
    ],
    phases: [
      { slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listWorkflowSchedules).mockResolvedValue([])
    vi.mocked(api.getEffectiveFeaturesPayload).mockResolvedValue({
      features: {},
      scheduler_process_enabled: true,
    })
    vi.mocked(api.createWorkflowSchedule).mockResolvedValue({} as never)
  })

  async function openForm(definition?: unknown) {
    render(
      <WorkflowScheduleModal
        workflow={dummyWorkflow}
        definition={definition as never}
        onClose={vi.fn()}
      />,
    )
    const modal = await screen.findByTestId("schedule-modal")
    await waitFor(() => expect(within(modal).getByTestId("schedule-name")).toBeInTheDocument())
    return modal
  }

  /** Name is required for `canSubmit`; fill it and press Add. */
  function submit(modal: HTMLElement, name = "Monday report") {
    fireEvent.change(within(modal).getByTestId("schedule-name"), { target: { value: name } })
    fireEvent.click(within(modal).getByTestId("schedule-create"))
  }

  it("two arms, never three: the authored label names one field, the bare KEY names the other", async () => {
    const modal = await openForm(declaredDefinition)
    expect(within(modal).getByTestId("schedule-input-to")).toHaveAccessibleName("Recipient email")
    expect(within(modal).getByTestId("schedule-input-subject_line")).toHaveAccessibleName(
      "subject_line",
    )
    // The RESERVED key draws no field — the "Starting instruction" textarea already collects it.
    expect(within(modal).queryByTestId("schedule-input-kickoff_prompt")).toBeNull()
    expect(within(modal).getAllByTestId(/^schedule-input-/)).toHaveLength(2)
  })

  it("the declared values reach createWorkflowSchedule's inputs, ALONGSIDE kickoff_prompt", async () => {
    const modal = await openForm(declaredDefinition)
    fireEvent.change(within(modal).getByTestId("schedule-input-to"), {
      target: { value: "ops@northwind.example" },
    })
    fireEvent.change(within(modal).getByTestId("schedule-input-subject_line"), {
      target: { value: "Q3 vendor review" },
    })
    fireEvent.change(within(modal).getByTestId("schedule-kickoff"), {
      target: { value: "summarise the quarter" },
    })
    submit(modal)
    await waitFor(() => expect(api.createWorkflowSchedule).toHaveBeenCalledTimes(1))
    const [wfId, payload] = vi.mocked(api.createWorkflowSchedule).mock.calls[0]
    expect(wfId).toBe("wf-123")
    // ALONGSIDE, never replacing: `kickoff_prompt` survives the merge.
    expect(payload.inputs).toEqual({
      kickoff_prompt: "summarise the quarter",
      to: "ops@northwind.example",
      subject_line: "Q3 vendor review",
    })
  })

  it("a definition declaring NO extra keys sends the pre-change payload EXACTLY — deep equality, not a partial", async () => {
    // ⚠ THIS IS THE ONE THAT WOULD CATCH A SILENT WIDENING. The whole object is compared
    // against a literal, so an added key, a dropped `null`, or a reordered cadence pair reds
    // here rather than at 03:00 on somebody's unattended run.
    const modal = await openForm(undefined)
    expect(within(modal).queryByTestId("schedule-inputs")).toBeNull()
    fireEvent.change(within(modal).getByTestId("schedule-kickoff"), {
      target: { value: "go" },
    })
    submit(modal)
    await waitFor(() => expect(api.createWorkflowSchedule).toHaveBeenCalledTimes(1))
    const [, payload] = vi.mocked(api.createWorkflowSchedule).mock.calls[0]
    expect(payload).toEqual({
      name: "Monday report",
      cron_expression: "0 3 * * *",
      interval_seconds: null,
      timezone: expect.any(String),
      max_tokens_per_run: 500000,
      max_duration_seconds: 1800,
      inputs: { kickoff_prompt: "go" },
    })
  })

  it("the EMPTY kickoff arm is unchanged too — an empty dict, not an absent key", async () => {
    const modal = await openForm(undefined)
    submit(modal)
    await waitFor(() => expect(api.createWorkflowSchedule).toHaveBeenCalledTimes(1))
    const [, payload] = vi.mocked(api.createWorkflowSchedule).mock.calls[0]
    expect(payload.inputs).toEqual({})
  })

  it("the cadence contract is UNTOUCHED in both arms — exactly one cadence, the other explicit null", async () => {
    // Arm 1: cron (the default). Exactly one cadence key carries a value.
    const modal = await openForm(declaredDefinition)
    // 296-04 (287-SCHED): the required recipient is filled, or Add schedule refuses by name.
    fireEvent.change(within(modal).getByTestId("schedule-input-to"), {
      target: { value: "a@b.c" },
    })
    submit(modal)
    await waitFor(() => expect(api.createWorkflowSchedule).toHaveBeenCalledTimes(1))
    let [, payload] = vi.mocked(api.createWorkflowSchedule).mock.calls[0]
    expect(payload.cron_expression).toBe("0 3 * * *")
    expect(payload.interval_seconds).toBeNull()

    // Arm 2: interval. The unused cadence goes as an explicit `null`, never omitted —
    // sending both is a 422 by design and that shipped contract is not this plan's to move.
    vi.mocked(api.createWorkflowSchedule).mockClear()
    fireEvent.click(within(modal).getByTestId("schedule-kind-interval"))
    fireEvent.change(within(modal).getByTestId("schedule-input-to"), {
      target: { value: "a@b.c" },
    })
    submit(modal, "Hourly")
    await waitFor(() => expect(api.createWorkflowSchedule).toHaveBeenCalledTimes(1))
    ;[, payload] = vi.mocked(api.createWorkflowSchedule).mock.calls[0]
    expect(payload.cron_expression).toBeNull()
    expect(payload.interval_seconds).toBe(3600)
    // …and the declared key still rides alongside, in the interval arm too.
    expect(payload.inputs).toEqual({ to: "a@b.c", subject_line: "" })
  })

  it("NO free-form key/value editor exists on this surface — a ?raw fence with a positive control", () => {
    // NON-VACUITY FIRST: an empty source string makes every absence below free.
    expect(scheduleModalSource.length).toBeGreaterThan(5000)
    // …and the fence is anchored on the CODE it guards, not on a bare word: the positive
    // control below proves the matcher is capable of firing.
    const FREEFORM = /\b(add a field|add field|key\/value|key-value|freeform|free-form)\b/i
    // The component's own prose names the refusal, so strip block comments before matching —
    // a fence that counts its own explanation is the 187-24 trap.
    const code = scheduleModalSource.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")
    expect(FREEFORM.test(code)).toBe(false)
    expect(FREEFORM.test("a key/value editor")).toBe(true) // POSITIVE CONTROL
    // The only text inputs the form grows are named by a DECLARED key.
    const testIds = Array.from(code.matchAll(/data-testid=\{?`?schedule-input-\$\{f\.key\}/g))
    expect(testIds.length).toBe(1)
  })
})

/**
 * ── 296-04 (BUG-261025-01 / 295-IN-05 / 287-SCHED) — Run now says what happened, ON THE ROW ──
 *
 * Reported: pressing a row's Run now changed nothing visible near the row; the only sentence was
 * a 12px muted notice at the bottom of the create form. The server's trigger result now carries
 * an `outcome` (296-02), and its `detail` is already a worded sentence for every refusal, so it is
 * rendered verbatim, toned by outcome, inside the row that was pressed.
 */
describe("WorkflowScheduleModal 296-04 — Run now feedback on the row (BUG-261025-01)", () => {
  const dummyWorkflow = { id: "wf-123", name: "Daily ETL" }
  const row = (id: string, name: string) => ({
    id,
    workflow_id: "wf-123",
    name,
    cron_expression: "0 3 * * *",
    interval_seconds: null,
    timezone: "UTC",
    is_active: true,
    max_tokens_per_run: 500000,
    max_duration_seconds: 1800,
    inputs: {},
    last_run_at: "2026-10-25T03:00:00Z",
    next_run_at: "2026-10-27T03:00:00Z",
    last_status: "completed",
  })
  const ROWS = [row("s-1", "Morning digest"), row("s-2", "Evening digest")]

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listWorkflowSchedules).mockResolvedValue(ROWS)
    vi.mocked(api.getEffectiveFeaturesPayload).mockResolvedValue({
      features: {},
      scheduler_process_enabled: true,
    })
  })

  async function openList() {
    render(<WorkflowScheduleModal workflow={dummyWorkflow} onClose={vi.fn()} />)
    await waitFor(() => expect(screen.getAllByTestId("schedule-row")).toHaveLength(2))
    return screen.getAllByTestId("schedule-row")
  }

  it("pending: the pressed row's Run now spins, is busy and disabled, and says Starting…", async () => {
    let resolve: (v: unknown) => void = () => {}
    vi.mocked(api.triggerSchedule).mockReturnValue(new Promise((r) => (resolve = r)) as never)
    const rows = await openList()
    const btn = within(rows[1]).getByTestId("schedule-run-now")
    fireEvent.click(btn)
    await waitFor(() => expect(btn.getAttribute("aria-busy")).toBe("true"))
    expect(btn).toBeDisabled()
    expect(within(btn).getByText("Starting…").className).toContain("sr-only")
    const spinner = btn.querySelector("svg")
    expect(spinner?.getAttribute("class") ?? "").toContain("animate-spin")
    expect(spinner?.getAttribute("class") ?? "").toContain("motion-reduce:animate-none")
    // The other row is not the one starting.
    expect(within(rows[0]).getByTestId("schedule-run-now").getAttribute("aria-busy")).not.toBe("true")
    resolve({ launched: true, outcome: "launched" })
    await waitFor(() => expect(btn.getAttribute("aria-busy")).not.toBe("true"))
  })

  it("launched: ✓ + the started sentence, role=status, inside THAT row; no bottom notice", async () => {
    vi.mocked(api.triggerSchedule).mockResolvedValue({ launched: true, outcome: "launched" } as never)
    const rows = await openList()
    fireEvent.click(within(rows[1]).getByTestId("schedule-run-now"))
    const line = await within(screen.getAllByTestId("schedule-row")[1]).findByTestId("schedule-run-result")
    expect(line.getAttribute("role")).toBe("status")
    expect(line.textContent).toBe("✓Started. It runs in the background — open the run log to watch it.")
    expect(line.className).toContain("text-foreground")
    expect(within(screen.getAllByTestId("schedule-row")[0]).queryByTestId("schedule-run-result")).toBeNull()
    expect(screen.queryByTestId("schedule-notice")).toBeNull()
  })

  it.each([
    ["refused", "It didn't start: the workflow needs a typed task."],
    ["not_loaded", "It didn't start: the workflow could not be loaded (it was deleted, or is no longer yours)."],
  ])("%s: the detail verbatim, warning tone, role=status", async (outcome, detail) => {
    vi.mocked(api.triggerSchedule).mockResolvedValue({ launched: false, outcome, detail } as never)
    const rows = await openList()
    fireEvent.click(within(rows[0]).getByTestId("schedule-run-now"))
    const line = await within(screen.getAllByTestId("schedule-row")[0]).findByTestId("schedule-run-result")
    expect(line.textContent).toBe(detail)
    expect(line.getAttribute("role")).toBe("status")
    expect(line.className).toContain("text-[hsl(var(--warning))]")
  })

  it("error: the detail verbatim, the failure tone, role=alert", async () => {
    const detail = "It didn't start because of a problem on our side. Nothing ran — try again in a moment."
    vi.mocked(api.triggerSchedule).mockResolvedValue({ launched: false, outcome: "error", detail } as never)
    const rows = await openList()
    fireEvent.click(within(rows[0]).getByTestId("schedule-run-now"))
    const line = await within(screen.getAllByTestId("schedule-row")[0]).findByTestId("schedule-run-result")
    expect(line.textContent).toBe(detail)
    expect(line.getAttribute("role")).toBe("alert")
    expect(line.className).toContain("text-[hsl(0_80%_80%)]")
  })

  it("an old backend (no outcome): launched reads success, anything else the failure tone", async () => {
    vi.mocked(api.triggerSchedule).mockResolvedValue({ launched: false, detail: "Nope." } as never)
    const rows = await openList()
    fireEvent.click(within(rows[0]).getByTestId("schedule-run-now"))
    const line = await within(screen.getAllByTestId("schedule-row")[0]).findByTestId("schedule-run-result")
    expect(line.textContent).toBe("Nope.")
    expect(line.className).toContain("text-[hsl(0_80%_80%)]")
  })

  it("one result line per modal: the next action clears it", async () => {
    vi.mocked(api.triggerSchedule).mockResolvedValue({ launched: true, outcome: "launched" } as never)
    vi.mocked(api.updateSchedule).mockResolvedValue({} as never)
    const rows = await openList()
    fireEvent.click(within(rows[0]).getByTestId("schedule-run-now"))
    await within(screen.getAllByTestId("schedule-row")[0]).findByTestId("schedule-run-result")
    fireEvent.click(within(screen.getAllByTestId("schedule-row")[1]).getByTestId("schedule-toggle"))
    await waitFor(() => expect(screen.queryByTestId("schedule-run-result")).toBeNull())
  })
})

describe("WorkflowScheduleModal 296-04 — Add schedule refuses a missing required input (287-SCHED)", () => {
  const dummyWorkflow = { id: "wf-123", name: "Daily ETL" }
  const definition = {
    slug: "vendor-outreach",
    version: 1,
    inputs: [{ key: "to", label: "Recipient" }, { key: "note", required: false }],
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_single" } }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.listWorkflowSchedules).mockResolvedValue([])
    vi.mocked(api.getEffectiveFeaturesPayload).mockResolvedValue({
      features: {},
      scheduler_process_enabled: true,
    })
    vi.mocked(api.createWorkflowSchedule).mockResolvedValue({} as never)
  })

  async function open() {
    render(<WorkflowScheduleModal workflow={dummyWorkflow} definition={definition as never} onClose={vi.fn()} />)
    const modal = await screen.findByTestId("schedule-modal")
    await waitFor(() => expect(within(modal).getByTestId("schedule-name")).toBeInTheDocument())
    fireEvent.change(within(modal).getByTestId("schedule-name"), { target: { value: "Weekly" } })
    return modal
  }

  it("an empty required input is refused by name under the inputs; nothing is created; the button stays enabled", async () => {
    const modal = await open()
    fireEvent.click(within(modal).getByTestId("schedule-create"))
    const refusal = await within(modal).findByTestId("schedule-required-refusal")
    expect(refusal.textContent).toBe("Recipient is required")
    expect(refusal.getAttribute("role")).toBe("alert")
    expect(refusal.className).toContain("text-[12px]")
    expect(refusal.className).toContain("text-destructive")
    // Directly under the inputs, not at the form bottom.
    expect(refusal.previousElementSibling?.getAttribute("data-testid")).toBe("schedule-inputs")
    expect(api.createWorkflowSchedule).not.toHaveBeenCalled()
    expect(within(modal).getByTestId("schedule-create")).not.toBeDisabled()
  })

  it("the refusal clears on the next keystroke in any input", async () => {
    const modal = await open()
    fireEvent.click(within(modal).getByTestId("schedule-create"))
    await within(modal).findByTestId("schedule-required-refusal")
    fireEvent.change(within(modal).getByTestId("schedule-input-note"), { target: { value: "x" } })
    expect(within(modal).queryByTestId("schedule-required-refusal")).toBeNull()
  })

  it("filled, it creates", async () => {
    const modal = await open()
    fireEvent.change(within(modal).getByTestId("schedule-input-to"), { target: { value: "ops@x.test" } })
    fireEvent.click(within(modal).getByTestId("schedule-create"))
    await waitFor(() => expect(api.createWorkflowSchedule).toHaveBeenCalledTimes(1))
  })
})
