/**
 * Phase 308-05 (D-12, D-13, T-308-06; UI-SPEC §1f) — the signing secret, shown once.
 *
 * It receives the secret as a prop and keeps it nowhere else; the parent drops it on "I've saved the
 * secret". The create variant carries Send test and its verdict; the roll variant carries the
 * overlap line instead. Assertions read rendered words.
 */
import { afterEach, describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useState } from "react"
import onceRaw from "../WebhookSecretOnce.tsx?raw"
import { WebhookSecretOnce } from "../WebhookSecretOnce"
import { WebhookError } from "@/lib/api/webhooks"

const NOW = new Date(2026, 10, 4, 12, 0, 0)
const SECRET = "whsec_c2VjcmV0LXNob3duLW9uY2U="

afterEach(() => {
  vi.restoreAllMocks()
})

function Host({ mode }: { mode: "create" | "roll" }) {
  const [secret, setSecret] = useState<string | null>(SECRET)
  return secret ? (
    <WebhookSecretOnce
      mode={mode}
      secret={secret}
      host="hooks.example.com"
      overlapUntil={mode === "roll" ? new Date(2026, 10, 5, 12, 0).toISOString() : null}
      now={NOW}
      sendTest={vi.fn().mockResolvedValue({ delivered: true, status_code: 200, latency_ms: 88, error: null })}
      onDone={() => setSecret(null)}
    />
  ) : (
    <p>gone</p>
  )
}

describe("308-05 WebhookSecretOnce", () => {
  it("create: the secret with Copy, the warning, Send test, the snippets and the done button", async () => {
    render(<Host mode="create" />)
    expect(screen.getByText("Signing secret — shown once")).toBeInTheDocument()
    expect(screen.getByText("hooks.example.com")).toBeInTheDocument()
    expect(screen.getByText(SECRET)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy the signing secret" })).toBeInTheDocument()
    expect(
      screen.getByText("⚠ Copy it into your receiver now. Syrel can't show it again; roll it to get a new one."),
    ).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Send test" })).toBeInTheDocument()
    expect(screen.getByText("How to check the signature")).toBeInTheDocument()
    expect(screen.getByText(/from standardwebhooks\.webhooks import Webhook/)).toBeInTheDocument()
    expect(screen.getByText(/import \{ Webhook \} from "standardwebhooks";/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy the Python check" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Copy the Node check" })).toBeInTheDocument()
    expect(
      screen.getByText("Check the raw body exactly as it arrived. Parsing the JSON first changes the bytes and the check fails."),
    ).toBeInTheDocument()
    expect(
      screen.getByText("Retries and resends reuse the same webhook-id, so ignore an id you have already handled."),
    ).toBeInTheDocument()
    expect(screen.queryByText(/Until/)).toBeNull()
  })

  it("Send test shows the verdict pointing at this endpoint's log", async () => {
    const user = userEvent.setup()
    render(<Host mode="create" />)
    await user.click(screen.getByRole("button", { name: "Send test" }))
    expect(
      await screen.findByText("Delivered — your receiver answered 200 in 88 ms. It is in this endpoint's log."),
    ).toBeInTheDocument()
  })

  it("a rate-limited test says our words, never 'status 429'", async () => {
    const user = userEvent.setup()
    render(
      <WebhookSecretOnce
        mode="create"
        secret={SECRET}
        host="h.example.com"
        now={NOW}
        sendTest={vi.fn().mockRejectedValue(new WebhookError("Slow down", 429, "rate_limited"))}
        onDone={() => {}}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Send test" }))
    expect(await screen.findByText("You've sent several tests in a row. Try again in a minute.")).toBeInTheDocument()
    expect(screen.queryByText(/429/)).toBeNull()
  })

  it("roll: the roll warning and the overlap line, no Send test", () => {
    render(<Host mode="roll" />)
    expect(screen.getByText("⚠ Copy the new secret into your receiver now. Syrel can't show it again.")).toBeInTheDocument()
    const overlap = screen.getByText(/every message carries both the old and the new signature/)
    expect(overlap).toHaveTextContent(
      "Until 5 Nov 12:00, every message carries both the old and the new signature, so your receiver keeps working while you swap it in.",
    )
    expect(screen.queryByRole("button", { name: "Send test" })).toBeNull()
  })

  it("I've saved the secret: the secret leaves the DOM", async () => {
    const user = userEvent.setup()
    render(<Host mode="create" />)
    await user.click(screen.getByRole("button", { name: "I've saved the secret" }))
    expect(screen.getByText("gone")).toBeInTheDocument()
    expect(document.body.textContent).not.toContain(SECRET)
  })

  it("copies only on request and writes no storage", async () => {
    const user = userEvent.setup()
    const write = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText: write }, configurable: true })
    const set = vi.spyOn(Storage.prototype, "setItem")
    render(<Host mode="create" />)
    expect(write).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Copy the signing secret" }))
    expect(write).toHaveBeenCalledWith(SECRET)
    expect(set).not.toHaveBeenCalled()
    expect(onceRaw).not.toMatch(/localStorage|sessionStorage/)
  })
})
