/**
 * Phase 300-04 (D-12 / UI-D13 / UI-SPEC S5) — the Control Room "Email" tile.
 *
 * The fourth dependency tile reads `signals.dependencies.email` from GET /admin/backpressure.
 * Every state is asserted by its WORDS (the dot never carries the meaning alone), and only a
 * real failure may wear the destructive dot: Off, Held back, Test mode and Ready are neutral.
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup, within } from "@testing-library/react"

import { HealthSignals } from "../HealthSignals"
import type { BackpressureSignals } from "@/lib/api"

type Email = {
  state: "up" | "down" | "off"
  mode: "off" | "held_back" | "test" | "live"
  provider: "none" | "resend" | "smtp"
  last_sent_at: string | null
  last_failure_at: string | null
  last_failure_reason: string | null
  latency_ms: null
}

const SENT = "2026-10-29T09:00:00+00:00"
const FAILED = "2026-10-29T09:05:00+00:00"

function signals(email?: Partial<Email> | null): BackpressureSignals {
  const deps: Record<string, unknown> = {
    redis: { state: "up", latency_ms: 3 },
    supabase: { state: "up", latency_ms: 12 },
    sandbox: { state: "off", latency_ms: null },
  }
  if (email !== null && email !== undefined) {
    deps.email = {
      state: "up", mode: "live", provider: "resend", last_sent_at: null, last_failure_at: null,
      last_failure_reason: null, latency_ms: null, ...email,
    }
  }
  return {
    anyio_threadpool_depth: { borrowed: 1, total: 40 },
    redis_active_runs: 0,
    postgres_pool_in_use: 2,
    per_worker_run_count: 0,
    dependencies: deps,
    secrets_encryption: { state: "encrypted" },
  } as unknown as BackpressureSignals
}

function tile() {
  return screen.getByTestId("dep-email")
}

function dot() {
  return tile().querySelector("[aria-hidden='true']") as HTMLElement
}

afterEach(() => cleanup())

describe("HealthSignals — the Email tile (UI-SPEC S5)", () => {
  it("absent payload → neutral placeholder", () => {
    render(<HealthSignals signals={signals(undefined)} showTechnical={false} />)
    const t = within(tile())
    expect(t.getByText("Email")).toBeInTheDocument()
    expect(t.getByText("—")).toBeInTheDocument()
    expect(t.getByText("email delivery")).toBeInTheDocument()
    expect(dot().className).toContain("bg-muted-foreground/25")
  })

  it("loading → neutral placeholder", () => {
    render(<HealthSignals signals={null} showTechnical={false} />)
    expect(within(tile()).getByText("—")).toBeInTheDocument()
    expect(dot().className).not.toContain("bg-destructive")
  })

  it("provider none → Off, never red", () => {
    render(<HealthSignals signals={signals({ state: "off", mode: "off", provider: "none" })} showTechnical={false} />)
    const t = within(tile())
    expect(t.getByText("Off")).toBeInTheDocument()
    expect(t.getByText("Not set up. Invitation links are copied by hand")).toBeInTheDocument()
    expect(dot().className).toContain("bg-muted-foreground/40")
  })

  it("not production, no test address → Held back, never red", () => {
    render(<HealthSignals signals={signals({ state: "off", mode: "held_back" })} showTechnical={false} />)
    const t = within(tile())
    expect(t.getByText("Held back")).toBeInTheDocument()
    expect(t.getByText("Not production and no test address, so emails are only logged")).toBeInTheDocument()
    expect(dot().className).toContain("bg-muted-foreground/40")
  })

  it("not production with a test address → Test mode, never red", () => {
    render(<HealthSignals signals={signals({ state: "up", mode: "test", last_sent_at: SENT })} showTechnical={false} />)
    const t = within(tile())
    expect(t.getByText("Test mode")).toBeInTheDocument()
    expect(t.getByText("Every email goes to the test address")).toBeInTheDocument()
    expect(dot().className).toContain("bg-muted-foreground/40")
    expect(dot().className).not.toContain("bg-destructive")
  })

  it("live and nothing attempted → Ready", () => {
    render(<HealthSignals signals={signals({})} showTechnical={false} />)
    const t = within(tile())
    expect(t.getByText("Ready")).toBeInTheDocument()
    expect(t.getByText("via Resend, nothing sent yet")).toBeInTheDocument()
    expect(dot().className).toContain("bg-muted-foreground/25")
  })

  it("latest send delivered → Sending, with the absolute time", () => {
    render(<HealthSignals signals={signals({ last_sent_at: SENT })} showTechnical={false} />)
    const t = within(tile())
    expect(t.getByText("Sending")).toBeInTheDocument()
    expect(t.getByText(`via Resend, last sent ${new Date(SENT).toLocaleString()}`)).toBeInTheDocument()
    expect(dot().className).toContain("bg-success")
  })

  it("latest attempt failed → Last send failed, when and why, the only red state", () => {
    const reason = "The mail server refused the sign-in, so nothing could be sent through it right now."
    render(
      <HealthSignals
        signals={signals({ state: "down", provider: "smtp", last_sent_at: SENT, last_failure_at: FAILED,
                           last_failure_reason: reason })}
        showTechnical={false}
      />,
    )
    const t = within(tile())
    expect(t.getByText("Last send failed")).toBeInTheDocument()
    const sub = t.getByText(`via your mail server, ${new Date(FAILED).toLocaleString()}: ${reason}`)
    expect(sub.className).toContain("break-words")
    expect(sub.className).not.toContain("truncate")
    expect(dot().className).toContain("bg-destructive")
  })

  it("a probe failure with no timestamp still names the reason", () => {
    render(
      <HealthSignals
        signals={signals({ state: "down", last_failure_reason: "Couldn't read the email delivery record." })}
        showTechnical={false}
      />,
    )
    expect(within(tile()).getByText("via Resend: Couldn't read the email delivery record.")).toBeInTheDocument()
  })

  it("⌥ Technical names reveals dependencies.email · the provider id", () => {
    render(<HealthSignals signals={signals({ provider: "smtp" })} showTechnical={true} />)
    expect(within(tile()).getByText("dependencies.email · smtp")).toBeInTheDocument()
  })

  it("the dependency row widens to four columns; the three shipped tiles keep their words", () => {
    const { container } = render(<HealthSignals signals={signals({})} showTechnical={false} />)
    const grid = tile().parentElement as HTMLElement
    expect(grid.className).toContain("sm:grid-cols-2")
    expect(grid.className).toContain("lg:grid-cols-4")
    expect(grid.className).not.toContain("sm:grid-cols-3")
    expect(screen.getByText("Redis")).toBeInTheDocument()
    expect(screen.getByText("Database")).toBeInTheDocument()
    expect(screen.getByText("Code sandbox")).toBeInTheDocument()
    expect(screen.getAllByText("Healthy")).toHaveLength(2)
    expect(screen.getByText("off by config")).toBeInTheDocument()
    expect(container.querySelectorAll(".bg-destructive")).toHaveLength(0)
  })
})
