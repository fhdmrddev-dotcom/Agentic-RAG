/**
 * Phase 095.1-03 — RunCard.timer.test.tsx (D-04 model attribution + D-05 true reload timer)
 *
 * Honesty contract under test (CONTEXT D-095.1-04 / D-095.1-05):
 *  D-05 timer:
 *   (a) a TERMINAL run with startedAt + completedAt shows the TRUE persisted
 *       duration completedAt − startedAt — identical live and on reload.
 *   (b) a TERMINAL run with NO completedAt shows NO duration (never a
 *       current-clock fabrication — the honesty rule).
 *   (c) a STREAMING run still live-ticks from start (the 095 never-vanishes
 *       behavior must NOT regress).
 *   (d) the BUG-260606-02 regression guard — a day-old created_at with a real
 *       3s completedAt − startedAt reads ~3s, NEVER ~1440m.
 *  D-04 run-sub:
 *   (e) provider + model present → run-sub contains `{provider} · {model}`.
 *   (f) provider/model absent → run-sub is just `turn N` (graceful legacy).
 *
 * Harness mirrors RunCard.test.tsx (the makeMessage factory + the
 * `/([\d.]+)s/` seconds-regex on the `run-status-strip` testid).
 */
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { RunCard } from "./RunCard"
import type { Message } from "@/types"

function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    thread_id: "thread-1",
    role: "assistant",
    content: "",
    created_at: new Date().toISOString(),
    tool_calls: [
      {
        id: "tc-1",
        name: "execute_code",
        args: { code: "print(1)" },
        status: "running",
        startedAt: Date.now() - 1000,
      },
    ],
    runStatus: "streaming",
    iterationCount: 0,
    ...overrides,
  } as unknown as Message
}

// A done tool_calls list — terminal fixtures need at least one done tool so the
// RunCard renders the run-card frame + strip (mirrors RunCard.test.tsx).
const doneTools = [
  { id: "tc-1", name: "execute_code", args: {}, status: "done", result: "" },
]

describe("RunCard — D-05 true reload timer (completedAt − startedAt)", () => {
  it("(a) terminal run shows the TRUE startedAt→completedAt duration, not now−created_at", () => {
    // created_at is ~now (would give ~0 under the old freeze), but the run
    // actually started 6s ago and completed 1s ago → true duration = 5s.
    const now = Date.now()
    render(
      <RunCard
        message={makeMessage({
          created_at: new Date(now).toISOString(),
          runStatus: "completed",
          startedAt: new Date(now - 6000).toISOString(),
          completedAt: new Date(now - 1000).toISOString(),
          tool_calls: doneTools,
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    const strip = screen.getByTestId("run-status-strip")
    const match = strip.textContent?.match(/([\d.]+)s/)
    expect(match).not.toBeNull()
    const seconds = parseFloat(match![1])
    // True duration ≈ 5s — NOT ~0 (the old now−created_at freeze).
    expect(seconds).toBeGreaterThanOrEqual(4.5)
    expect(seconds).toBeLessThan(6)
  })

  it("(b) terminal run with NO completedAt renders NO duration (honesty rule)", () => {
    const now = Date.now()
    render(
      <RunCard
        message={makeMessage({
          // A day-old created_at — the old code would render ~1440m here.
          created_at: new Date(now - 86_400_000).toISOString(),
          runStatus: "completed",
          startedAt: new Date(now - 86_400_000).toISOString(),
          completedAt: undefined, // no real end-time
          tool_calls: doneTools,
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    // No duration segment at all — the strip must NOT carry a seconds/minutes value.
    const card = screen.getByTestId("run-card")
    const stripEl = screen.queryByTestId("run-status-strip")
    const stripText = stripEl?.textContent ?? ""
    // No `Xs` and no `Xm Ys` fabricated duration.
    expect(stripText).not.toMatch(/[\d.]+s/)
    expect(stripText).not.toMatch(/\d+m \d+s/)
    // And crucially never the inflated day-old value.
    expect(card.textContent).not.toMatch(/1440m/)
    expect(card.textContent).not.toMatch(/\d{3,}m/) // no 3+ digit minutes ever
  })

  it("(c) streaming run still live-ticks from start (never-vanishes preserved)", () => {
    const now = Date.now()
    render(
      <RunCard
        message={makeMessage({
          created_at: new Date(now - 2000).toISOString(),
          startedAt: new Date(now - 2000).toISOString(),
          completedAt: undefined,
          runStatus: "streaming",
        } as Partial<Message>)}
        isStreaming={true}
      />,
    )
    const strip = screen.getByTestId("run-status-strip")
    // A live elapsed value is present (≈2s, but at minimum a real seconds value).
    expect(strip.textContent).toMatch(/[\d.]+s/)
    expect(strip.textContent).toMatch(/⏱/)
  })

  it("(d) BUG-260606-02 guard — a day-old created_at with a real 3s run reads ~3s, never ~1440m", () => {
    const now = Date.now()
    render(
      <RunCard
        message={makeMessage({
          created_at: new Date(now - 86_400_000).toISOString(), // a day ago
          runStatus: "completed",
          startedAt: new Date(now - 86_400_000).toISOString(),
          completedAt: new Date(now - 86_400_000 + 3000).toISOString(), // +3s
          tool_calls: doneTools,
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    const strip = screen.getByTestId("run-status-strip")
    const match = strip.textContent?.match(/([\d.]+)s/)
    expect(match).not.toBeNull()
    const seconds = parseFloat(match![1])
    // ~3s, and emphatically < 60 (NOT a day-old inflation).
    expect(seconds).toBeGreaterThanOrEqual(2.5)
    expect(seconds).toBeLessThan(60)
    expect(strip.textContent).not.toMatch(/\d{3,}m/)
  })
})

describe("RunCard — D-04 model attribution (run-sub)", () => {
  it("(e) provider + model present → run-sub shows `{provider} · {model}`", () => {
    render(
      <RunCard
        message={makeMessage({
          runStatus: "completed",
          provider: "google",
          model: "gemini-3.5-flash",
          iterationCount: 0,
          tool_calls: doneTools,
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    const card = screen.getByTestId("run-card")
    expect(card.textContent).toContain("google · gemini-3.5-flash")
    expect(card.textContent).toContain("turn 1")
  })

  it("(f) provider/model absent → run-sub is just `turn N` (graceful legacy)", () => {
    render(
      <RunCard
        message={makeMessage({
          runStatus: "completed",
          provider: undefined,
          model: undefined,
          iterationCount: 2,
          tool_calls: doneTools,
        } as Partial<Message>)}
        isStreaming={false}
      />,
    )
    const card = screen.getByTestId("run-card")
    expect(card.textContent).toContain("turn 3")
    // No middot-joined provider·model segment when both are absent.
    expect(card.textContent).not.toMatch(/\S+ · \S+ · turn/)
  })
})
