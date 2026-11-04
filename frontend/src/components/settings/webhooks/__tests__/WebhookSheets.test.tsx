/**
 * Phase 308-05 (D-13, D-30; UI-SPEC §1g, §1h, §2c, A-12, A-13) — the Roll and Delete sheets.
 *
 * Delete is the 066 victim-naming guard (destructive frame, "Keep it" focused, never optimistic, a
 * refusal keeps the sheet open in the server's words) with an `admin` variant 308-06 reuses. Roll is
 * the calm sheet: "Keep this secret" focused, the overlap fact only while an overlap is running, the
 * new secret handed to the parent from the server's answer.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { DeleteWebhookSheet } from "../DeleteWebhookSheet"
import { RollWebhookSecretSheet } from "../RollWebhookSecretSheet"
import type { WebhookEndpoint } from "@/lib/api/webhooks"

const NOW = new Date(2026, 10, 4, 12, 0, 0)

function endpoint(over: Partial<WebhookEndpoint> = {}): WebhookEndpoint {
  return {
    id: "e1",
    url: "https://hooks.example.com/in?token=abc",
    description: null,
    event_types: ["run.finished"],
    enabled: true,
    disabled_reason: null,
    disabled_at: null,
    last_success_at: null,
    consecutive_failures: 0,
    previous_secret_expires_at: null,
    created_at: "2026-11-01T09:00:00Z",
    ...over,
  }
}

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("308-05 DeleteWebhookSheet (member)", () => {
  it("names the address (query masked), the facts and what is kept; Keep it holds focus", async () => {
    render(
      <DeleteWebhookSheet
        target={{ id: "e1", address: "https://hooks.example.com/in?token=••••" }}
        onClose={() => {}}
        remove={vi.fn()}
        onDone={() => {}}
      />,
    )
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByText("Delete this endpoint?")).toBeInTheDocument()
    expect(screen.getByText("https://hooks.example.com/in?token=••••")).toBeInTheDocument()
    expect(screen.getByText("Pending and retrying deliveries to it are dropped.")).toBeInTheDocument()
    expect(screen.getByText("Its delivery log is deleted.")).toBeInTheDocument()
    expect(screen.getByText(/Your other endpoints are not touched\./)).toBeInTheDocument()
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep it" })).toHaveFocus())
    expect(screen.queryByText(/abc/)).toBeNull()
  })

  it("calls remove only on confirm, reads Deleting… in flight, then hands back onDone", async () => {
    const user = userEvent.setup()
    const d = deferred<void>()
    const remove = vi.fn().mockReturnValue(d.promise)
    const onDone = vi.fn()
    const onClose = vi.fn()
    render(<DeleteWebhookSheet target={{ id: "e1", address: "https://h.example.com/" }} onClose={onClose} remove={remove} onDone={onDone} />)
    expect(remove).not.toHaveBeenCalled()
    await user.click(screen.getByRole("button", { name: "Delete endpoint" }))
    expect(remove).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Deleting…" })).toBeDisabled()
    expect(onDone).not.toHaveBeenCalled()
    d.resolve()
    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(onClose).toHaveBeenCalled()
  })

  it("a refusal keeps the sheet open with the server's words and says it is still there", async () => {
    const user = userEvent.setup()
    const onDone = vi.fn()
    render(
      <DeleteWebhookSheet
        target={{ id: "e1", address: "https://h.example.com/" }}
        onClose={() => {}}
        remove={vi.fn().mockRejectedValue(new Error("Database busy."))}
        onDone={onDone}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Delete endpoint" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't delete the endpoint. Database busy. It is still there.")
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
  })
})

describe("308-05 DeleteWebhookSheet (admin variant)", () => {
  it("names the owner and the org in the title, facts and kept line", async () => {
    render(
      <DeleteWebhookSheet
        target={{ id: "e1", address: "hooks.example.com/in" }}
        admin={{ ownerName: "Dana Kim", orgName: "Acme Legal" }}
        onClose={() => {}}
        remove={vi.fn()}
        onDone={() => {}}
      />,
    )
    expect(await screen.findByText("Delete Dana Kim's endpoint?")).toBeInTheDocument()
    expect(screen.getByText("Dana Kim's system stops getting events from Acme Legal.")).toBeInTheDocument()
    expect(screen.getByText("Pending deliveries and the log are deleted.")).toBeInTheDocument()
    expect(screen.getByText("Dana Kim sees it gone; the audit log records you.")).toBeInTheDocument()
    expect(screen.getByText(/Dana Kim's other endpoints and orgs are not touched\./)).toBeInTheDocument()
    expect(screen.queryByText("Delete this endpoint?")).toBeNull()
  })
})

describe("308-05 RollWebhookSecretSheet", () => {
  it("the calm sheet: title, the 24 h overlap, the facts and what is kept; Keep this secret holds focus", async () => {
    render(<RollWebhookSecretSheet target={endpoint()} now={NOW} onClose={() => {}} roll={vi.fn()} onRolled={() => {}} />)
    expect(await screen.findByText("Roll the signing secret?")).toBeInTheDocument()
    expect(
      screen.getByText(
        "A new secret is made and shown once. For the next 24 hours every message carries both signatures, so your receiver keeps working while you swap it in.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("After 24 hours the old secret stops working.")).toBeInTheDocument()
    expect(screen.getByText("Rolling again within 24 hours ends the current overlap early.")).toBeInTheDocument()
    expect(screen.getByText(/Deliveries keep flowing; nothing is paused\./)).toBeInTheDocument()
    expect(screen.queryByText(/is still in its overlap/)).toBeNull()
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep this secret" })).toHaveFocus())
  })

  it("says an overlap is running, and that rolling now ends it", async () => {
    render(
      <RollWebhookSecretSheet
        target={endpoint({ previous_secret_expires_at: new Date(2026, 10, 5, 9, 0).toISOString() })}
        now={NOW}
        onClose={() => {}}
        roll={vi.fn()}
        onRolled={() => {}}
      />,
    )
    expect(
      await screen.findByText(
        "A roll from 09:00 is still in its overlap. Rolling now ends it, and the secret before that stops working at once.",
      ),
    ).toBeInTheDocument()
  })

  it("an overlap already over is not mentioned", async () => {
    render(
      <RollWebhookSecretSheet
        target={endpoint({ previous_secret_expires_at: new Date(2026, 10, 4, 9, 0).toISOString() })}
        now={NOW}
        onClose={() => {}}
        roll={vi.fn()}
        onRolled={() => {}}
      />,
    )
    await screen.findByText("Roll the signing secret?")
    expect(screen.queryByText(/is still in its overlap/)).toBeNull()
  })

  it("rolls only on confirm, reads Rolling…, then hands the parent the server's answer", async () => {
    const user = userEvent.setup()
    const d = deferred<{ endpoint: WebhookEndpoint; secret: string; previous_secret_expires_at: string }>()
    const roll = vi.fn().mockReturnValue(d.promise)
    const onRolled = vi.fn()
    render(<RollWebhookSecretSheet target={endpoint()} now={NOW} onClose={() => {}} roll={roll} onRolled={onRolled} />)
    await user.click(screen.getByRole("button", { name: "Roll secret" }))
    expect(roll).toHaveBeenCalledWith("e1")
    expect(screen.getByRole("button", { name: "Rolling…" })).toBeDisabled()
    const answer = { endpoint: endpoint(), secret: "whsec_new", previous_secret_expires_at: "2026-11-05T12:00:00Z" }
    d.resolve(answer)
    await waitFor(() => expect(onRolled).toHaveBeenCalledWith(answer))
  })

  it("a failure keeps the sheet open and says the current secret still works", async () => {
    const user = userEvent.setup()
    const onRolled = vi.fn()
    render(
      <RollWebhookSecretSheet
        target={endpoint()}
        now={NOW}
        onClose={() => {}}
        roll={vi.fn().mockRejectedValue(new Error("Busy."))}
        onRolled={onRolled}
      />,
    )
    await user.click(screen.getByRole("button", { name: "Roll secret" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't roll the secret. Busy. The current secret still works.")
    expect(onRolled).not.toHaveBeenCalled()
  })
})
