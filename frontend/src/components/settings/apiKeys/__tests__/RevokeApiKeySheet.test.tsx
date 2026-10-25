/**
 * Phase 293-04 (D-04, T-293-24) — the victim-naming revoke sheet (066 graded guard).
 *
 * Focus starts on `Keep it`; Esc closes; the action reads `Revoking…` in flight; success closes
 * and hands the caller a re-fetch (never an optimistic flip); failure keeps the sheet open and
 * says the key still works; the admin variant names the owner.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { RevokeApiKeySheet } from "../RevokeApiKeySheet"
import { NOW, makeCall, makeKey } from "./fixtures"

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("293-04 RevokeApiKeySheet", () => {
  it("names the key, its workflows, last use and owner; focus starts on Keep it", async () => {
    render(
      <RevokeApiKeySheet
        target={makeKey({ calls: [makeCall(), makeCall()] })}
        now={NOW}
        onClose={() => {}}
        revoke={vi.fn()}
        onDone={() => {}}
      />,
    )
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument()
    expect(screen.getByText("Revoke n8n-prod?")).toBeInTheDocument()
    expect(screen.getByText("The next call with this key is refused.")).toBeInTheDocument()
    const facts = screen.getByTestId("revoke-facts")
    expect(facts).toHaveTextContent("Starts Contract review")
    expect(facts).toHaveTextContent("Last used 10:42 · 2 calls in the last 30 days")
    expect(facts).toHaveTextContent("Owner Dana Kim · created Thu 1 Oct")
    expect(screen.getByTestId("revoke-kept")).toHaveTextContent(/Revoking can't be undone/)
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Keep it" })))
  })

  it("a live run started with this key is named in the kept box", () => {
    const live = makeCall({ verb: "read", outcome: "running", run_id: "abc123ff-0000" })
    render(<RevokeApiKeySheet target={makeKey({ calls: [live] })} now={NOW} onClose={() => {}} revoke={vi.fn()} onDone={() => {}} />)
    expect(screen.getByTestId("revoke-kept")).toHaveTextContent(
      "Run abc123 started with this key keeps going in the app, but the outside system can no longer read its result.",
    )
  })

  it("Esc closes without revoking", async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    const revoke = vi.fn()
    render(<RevokeApiKeySheet target={makeKey()} now={NOW} onClose={onClose} revoke={revoke} onDone={() => {}} />)
    await screen.findByRole("alertdialog")
    await user.keyboard("{Escape}")
    expect(onClose).toHaveBeenCalled()
    expect(revoke).not.toHaveBeenCalled()
  })

  it("in flight → Revoking… disabled; success → onDone then onClose, only after the server answers", async () => {
    const user = userEvent.setup()
    const d = deferred<unknown>()
    const revoke = vi.fn(() => d.promise)
    const onDone = vi.fn()
    const onClose = vi.fn()
    render(<RevokeApiKeySheet target={makeKey()} now={NOW} onClose={onClose} revoke={revoke} onDone={onDone} />)
    await user.click(await screen.findByRole("button", { name: "Revoke n8n-prod" }))
    expect(revoke).toHaveBeenCalledWith("k1")
    const busy = screen.getByRole("button", { name: "Revoking…" })
    expect(busy).toBeDisabled()
    expect(onDone).not.toHaveBeenCalled()
    d.resolve({})
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1))
    expect(onClose).toHaveBeenCalled()
  })

  it("failure keeps the sheet open with the server's detail and says the key still works", async () => {
    const user = userEvent.setup()
    const revoke = vi.fn().mockRejectedValue(new Error("The server is busy."))
    const onDone = vi.fn()
    const onClose = vi.fn()
    render(<RevokeApiKeySheet target={makeKey()} now={NOW} onClose={onClose} revoke={revoke} onDone={onDone} />)
    await user.click(await screen.findByRole("button", { name: "Revoke n8n-prod" }))
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't revoke n8n-prod. The server is busy. The key still works.")
    expect(screen.getByRole("alertdialog")).toBeInTheDocument()
    expect(onDone).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it("the admin variant names someone else's key's owner", () => {
    render(
      <RevokeApiKeySheet
        target={makeKey({ owner_is_you: false, owner_name: "Priya Shah" })}
        now={NOW}
        onClose={() => {}}
        revoke={vi.fn()}
        onDone={() => {}}
      />,
    )
    expect(screen.getByTestId("revoke-sub")).toHaveTextContent("This key belongs to Priya Shah. They will see that an admin revoked it.")
    expect(screen.getByTestId("revoke-facts")).toHaveTextContent("Owner Priya Shah")
  })

  it("renders nothing with no target", () => {
    render(<RevokeApiKeySheet target={null} now={NOW} onClose={() => {}} revoke={vi.fn()} onDone={() => {}} />)
    expect(screen.queryByRole("alertdialog")).toBeNull()
  })
})
