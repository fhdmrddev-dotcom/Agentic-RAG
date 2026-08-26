import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { WorkflowScheduleModal } from "../WorkflowScheduleModal"
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
