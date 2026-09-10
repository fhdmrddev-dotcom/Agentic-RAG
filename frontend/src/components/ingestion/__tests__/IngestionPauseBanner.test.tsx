import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, cleanup, act } from "@testing-library/react"
import { IngestionPauseBanner } from "../IngestionPauseBanner"

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe("IngestionPauseBanner (SC#3 / BUG-260815-05)", () => {
  it("renders the exact refusal copy shape naming the provider and status code", () => {
    render(
      <IngestionPauseBanner
        provider="OpenAI"
        statusCode={429}
        statusText="insufficient_quota"
        verbatimError='Rate limit reached for text-embedding-3-small in organization org-••••7f2a on tokens per min (TPM): Limit 1,000,000, Used 998,231.'
        completedCount={218}
        totalCount={340}
        initialRetrySeconds={14}
      />
    )

    // Heading names provider
    expect(screen.getByRole("heading", { level: 4 })).toHaveTextContent("⏸ OpenAI is rate-limiting us — ingestion paused")

    // State preserves finished count and queues remainder
    expect(screen.getByText(/218 of 340 files are already added/)).toBeInTheDocument()
    expect(screen.getByText(/The remaining 122 are queued, not lost/)).toBeInTheDocument()

    // Verbatim mono block
    const verbatim = screen.getByTestId("verbatim-provider-error")
    expect(verbatim).toHaveTextContent('openai · 429 insufficient_quota — “Rate limit reached for text-embedding-3-small in organization org-••••7f2a on tokens per min (TPM): Limit 1,000,000, Used 998,231.”')

    // Retry line with "nothing for you to do"
    expect(screen.getByText(/nothing for you to do/)).toBeInTheDocument()
    expect(screen.getByTestId("retry-countdown")).toHaveTextContent("14s")

    // ⛔ NEVER says "your documents returned nothing"
    expect(screen.queryByText(/your documents returned nothing/i)).toBeNull()
  })

  it("decrements the countdown timer automatically", () => {
    vi.useFakeTimers()
    render(
      <IngestionPauseBanner
        completedCount={218}
        totalCount={340}
        initialRetrySeconds={14}
      />
    )

    expect(screen.getByTestId("retry-countdown")).toHaveTextContent("14s")

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(screen.getByTestId("retry-countdown")).toHaveTextContent("13s")

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    expect(screen.getByTestId("retry-countdown")).toHaveTextContent("10s")
  })
})
