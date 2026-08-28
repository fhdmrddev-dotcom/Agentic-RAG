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
    inputs: [
      { key: "to", label: "Recipient email" },
      { key: "subject_line" },
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
