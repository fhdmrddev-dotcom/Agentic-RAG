/**
 * Phase 308-05 (D-24, D-27, D-46; UI-SPEC §1e, A-7, A-8, T-308-23) — the add and edit form.
 *
 * The client checks the address's FORM only; reachability is the server's, and its refusal is one
 * sentence under the address with every typed value kept. Save's disabled reason is DOM text linked
 * by aria-describedby. Assertions read rendered words.
 */
import { describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { WebhookEndpointForm } from "../WebhookEndpointForm"
import { WebhookError } from "@/lib/api/webhooks"

const REFUSED = "That address can't be reached from the internet, so Syrel won't send to it."

function deferred<T>() {
  let resolve!: (v: T) => void
  let reject!: (e: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe("308-05 WebhookEndpointForm", () => {
  it("add: title, labels, the three event sentences in a group, run events pre-ticked", () => {
    render(<WebhookEndpointForm mode="add" save={vi.fn()} onDiscard={() => {}} />)
    expect(screen.getByText("Add an endpoint")).toBeInTheDocument()
    expect(screen.getByLabelText("Address")).toHaveAttribute("placeholder", "https://hooks.example.com/syrel")
    expect(screen.getByText("https only. Must be reachable from the internet.")).toBeInTheDocument()
    const group = screen.getByRole("group", { name: "Events" })
    const boxes = within(group).getAllByRole("checkbox")
    expect(boxes).toHaveLength(3)
    expect(within(group).getByRole("checkbox", { name: /run\.finished.*A run you started finished, failed or was stopped\./ })).toBeChecked()
    expect(within(group).getByRole("checkbox", { name: /run\.waiting.*A run you started is waiting on a person in the app\./ })).toBeChecked()
    expect(within(group).getByRole("checkbox", { name: /document\.ingested.*A document you can see finished ingesting\./ })).not.toBeChecked()
    expect(screen.getByRole("button", { name: "Save endpoint" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument()
  })

  it("Save is disabled with its reason as DOM text: no address, then no event", async () => {
    const user = userEvent.setup()
    render(<WebhookEndpointForm mode="add" save={vi.fn()} onDiscard={() => {}} />)
    const save = screen.getByRole("button", { name: "Save endpoint" })
    expect(save).toBeDisabled()
    const why = screen.getByText("Enter the address your system listens on.")
    expect(save.getAttribute("aria-describedby")).toBe(why.id)

    await user.type(screen.getByLabelText("Address"), "https://hooks.example.com/in")
    await user.click(screen.getByRole("checkbox", { name: /run\.finished/ }))
    await user.click(screen.getByRole("checkbox", { name: /run\.waiting/ }))
    expect(save).toBeDisabled()
    expect(screen.getByText("Pick at least one event.")).toBeInTheDocument()
  })

  it("form lines on blur: not a URL, a name and password, a fragment", async () => {
    const user = userEvent.setup()
    render(<WebhookEndpointForm mode="add" save={vi.fn()} onDiscard={() => {}} />)
    const address = screen.getByLabelText("Address")
    await user.type(address, "hooks dot example")
    await user.tab()
    expect(screen.getByText("That isn't a web address.")).toBeInTheDocument()
    expect(address).toHaveAttribute("aria-invalid", "true")

    await user.clear(address)
    await user.type(address, "https://me:pw@hooks.example.com/")
    await user.tab()
    expect(
      screen.getByText("Take out the name and password before the @. If your receiver needs a token, put it in the query instead."),
    ).toBeInTheDocument()

    await user.clear(address)
    await user.type(address, "https://hooks.example.com/in#x")
    await user.tab()
    expect(screen.getByText("Take out the part after #.")).toBeInTheDocument()
  })

  it("saving says 'Checking the address…'; a server refusal shows the D-24 sentence and keeps every value", async () => {
    const user = userEvent.setup()
    const d = deferred<void>()
    const save = vi.fn().mockReturnValue(d.promise)
    render(<WebhookEndpointForm mode="add" save={save} onDiscard={() => {}} />)
    const address = screen.getByLabelText("Address")
    await user.type(address, "https://intranet.local/hook")
    await user.type(screen.getByLabelText("Description"), "Ops alerts")
    await user.click(screen.getByRole("button", { name: "Save endpoint" }))

    expect(save).toHaveBeenCalledWith({
      url: "https://intranet.local/hook",
      event_types: ["run.finished", "run.waiting"],
      description: "Ops alerts",
    })
    expect(screen.getByRole("button", { name: "Checking the address…" })).toBeDisabled()

    d.reject(new WebhookError(REFUSED, 422, "address_refused"))
    expect(await screen.findByText(REFUSED)).toBeInTheDocument()
    expect(address).toHaveValue("https://intranet.local/hook")
    expect(screen.getByLabelText("Description")).toHaveValue("Ops alerts")
    expect(address).toHaveAttribute("aria-invalid", "true")
    await waitFor(() => expect(address).toHaveFocus())
    // never the server's internals
    expect(screen.queryByText(/address_refused|10\.|private/)).toBeNull()
  })

  it("other refusals say the server's sentence under the buttons; an unknown failure says so and keeps the values", async () => {
    const user = userEvent.setup()
    const save = vi
      .fn()
      .mockRejectedValueOnce(new WebhookError("You have 10 endpoints in Acme, the most allowed. Delete one to add another.", 409, "cap_reached"))
      .mockRejectedValueOnce(new Error("Network down."))
    render(<WebhookEndpointForm mode="add" save={save} onDiscard={() => {}} />)
    await user.type(screen.getByLabelText("Address"), "https://hooks.example.com/in")
    await user.click(screen.getByRole("button", { name: "Save endpoint" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You have 10 endpoints in Acme, the most allowed. Delete one to add another.",
    )
    await user.click(screen.getByRole("button", { name: "Save endpoint" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't save the endpoint. Network down. Your changes are kept; try again.",
    )
    expect(screen.getByLabelText("Address")).toHaveValue("https://hooks.example.com/in")
  })

  it("no cipher on this deployment reads the D-12 sentence", async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockRejectedValue(new WebhookError("whatever", 503, "no_cipher"))
    render(<WebhookEndpointForm mode="add" save={save} onDiscard={() => {}} />)
    await user.type(screen.getByLabelText("Address"), "https://hooks.example.com/in")
    await user.click(screen.getByRole("button", { name: "Save endpoint" }))
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This Syrel deployment can't store a signing secret yet, so it can't add webhooks. Ask the person who runs it to set up secret encryption.",
    )
  })

  it("edit: the saved values, Edit words, and a counter from 80 characters", async () => {
    const user = userEvent.setup()
    const save = vi.fn().mockResolvedValue(undefined)
    render(
      <WebhookEndpointForm
        mode="edit"
        initial={{ url: "https://hooks.example.com/in?token=abc", event_types: ["document.ingested"], description: "x".repeat(79) }}
        save={save}
        onDiscard={() => {}}
      />,
    )
    expect(screen.getByText("Edit endpoint")).toBeInTheDocument()
    expect(screen.getByLabelText("Address")).toHaveValue("https://hooks.example.com/in?token=abc")
    expect(screen.getByRole("checkbox", { name: /document\.ingested/ })).toBeChecked()
    expect(screen.getByRole("checkbox", { name: /run\.finished/ })).not.toBeChecked()
    expect(screen.queryByText("79/100")).toBeNull()
    await user.type(screen.getByLabelText("Description"), "y")
    expect(screen.getByText("80/100")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Discard changes" })).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Save changes" }))
    expect(save).toHaveBeenCalledWith({
      url: "https://hooks.example.com/in?token=abc",
      event_types: ["document.ingested"],
      description: `${"x".repeat(79)}y`,
    })
  })

  it("Discard calls back; nothing builds a link from the address", async () => {
    const user = userEvent.setup()
    const onDiscard = vi.fn()
    const { container } = render(<WebhookEndpointForm mode="add" save={vi.fn()} onDiscard={onDiscard} />)
    await user.type(screen.getByLabelText("Address"), "https://hooks.example.com/in")
    expect(container.querySelector("a")).toBeNull()
    await user.click(screen.getByRole("button", { name: "Discard" }))
    expect(onDiscard).toHaveBeenCalled()
  })
})
