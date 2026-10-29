/**
 * Phase 300-05 (NOTE-04 / D-09, UI-SPEC S2) — "Email me when a run is waiting on me".
 *
 * The member's own switch on the Preferences tab. Driven through the REAL network layer
 * (`lib/api/settings.ts`) with `fetch` stubbed by URL + method, so the URLs it reaches are
 * recorded rather than assumed: a member's tab must never call a `model_management`-gated route,
 * and the switch must save through its OWN PUT (the default-model PUT clears `default_model`).
 *
 * ⛔ Never shows "On" before the read answers; the shown value is always the server's reply.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

vi.mock("@/lib/api/_core", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api/_core")>()
  return { ...actual, API_BASE: "http://api.test", getAuthHeaders: vi.fn().mockResolvedValue({}) }
})

import { EmailNotificationPreference } from "./EmailNotificationPreference"
import { PreferencesSection } from "./PreferencesSection"
import leafRaw from "./EmailNotificationPreference.tsx?raw"
import sectionRaw from "./PreferencesSection.tsx?raw"
import { TechnicalNamesProvider } from "@/providers/TechnicalNamesProvider"

const TITLE = "Email me when a run is waiting on me"
const description = (words: string) =>
  `If a workflow run is still waiting for your answer or approval after ${words}, we'll email you a link to it. Turning this off stops the email only. The run still waits for you.`
const NOT_CONFIGURED = "Email isn't set up on this server yet, so nothing is sent for now."

type Prefs = {
  default_model: string | null
  effective_model: string | null
  locked: boolean
  allowed_models: string[]
  notification_email_enabled?: boolean
  notification_email_delay_words?: string
  email_configured?: boolean
}

function prefs(over: Partial<Prefs> = {}): Prefs {
  return {
    default_model: "gpt-4o",
    effective_model: "gpt-4o",
    locked: false,
    allowed_models: ["gpt-4o"],
    notification_email_enabled: true,
    notification_email_delay_words: "2 minutes",
    email_configured: true,
    ...over,
  }
}

type Reply = { status: number; body: unknown } | Promise<{ status: number; body: unknown }>
let calls: { url: string; method: string; body: unknown }[] = []
let onGet: () => Reply
let onPut: (body: { enabled: boolean }) => Reply

function respond(r: { status: number; body: unknown }) {
  return new Response(JSON.stringify(r.body), { status: r.status })
}

beforeEach(() => {
  calls = []
  onGet = () => ({ status: 200, body: prefs() })
  onPut = ({ enabled }) => ({ status: 200, body: prefs({ notification_email_enabled: enabled }) })
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      const method = (init?.method ?? "GET").toUpperCase()
      const body = init?.body ? JSON.parse(String(init.body)) : undefined
      calls.push({ url, method, body })
      if (method === "GET" && url.endsWith("/me/preferences")) return respond(await onGet())
      if (method === "PUT" && url.endsWith("/me/preferences/notification-email")) {
        return respond(await onPut(body as { enabled: boolean }))
      }
      return respond({ status: 404, body: { detail: "not stubbed" } })
    }),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const theSwitch = () => screen.getByRole("switch", { name: TITLE })

describe("EmailNotificationPreference — loading (S2)", () => {
  it("is disabled and busy with no On/Off word until the read answers", async () => {
    let release!: (r: { status: number; body: unknown }) => void
    onGet = () => new Promise((r) => (release = r))
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(calls).toHaveLength(1))
    const sw = theSwitch()
    expect(sw).toBeDisabled()
    expect(sw).toHaveAttribute("aria-busy", "true")
    expect(within(sw).queryByText("On")).toBeNull()
    expect(within(sw).queryByText("Off")).toBeNull()
    release({ status: 200, body: prefs() })
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    expect(theSwitch()).not.toBeDisabled()
    expect(theSwitch()).toHaveAttribute("aria-checked", "true")
  })

  it("shows the title and the description with the server's delay words", async () => {
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    expect(screen.getByText(TITLE).textContent).toBe(TITLE)
    expect(screen.getByText(description("2 minutes")).textContent).toBe(description("2 minutes"))
  })

  it("says 'after a short wait' when the read carries no delay words", async () => {
    onGet = () => ({ status: 200, body: prefs({ notification_email_delay_words: undefined }) })
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    expect(screen.getByText(description("a short wait"))).toBeInTheDocument()
  })

  it("reads On for a member with no stored value (an older server omits the key)", async () => {
    onGet = () => ({ status: 200, body: prefs({ notification_email_enabled: undefined }) })
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(theSwitch()).toHaveAttribute("aria-checked", "true"))
  })

  it("reads Off when the server says off", async () => {
    onGet = () => ({ status: 200, body: prefs({ notification_email_enabled: false }) })
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("Off")).toBeInTheDocument())
    expect(theSwitch()).toHaveAttribute("aria-checked", "false")
  })

  it("a failed read says so and Retry loading re-reads", async () => {
    let n = 0
    onGet = () => (n++ === 0 ? { status: 500, body: {} } : { status: 200, body: prefs() })
    render(<EmailNotificationPreference />)
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load this setting.")
    expect(screen.queryByRole("switch")).toBeNull()
    fireEvent.click(screen.getByRole("button", { name: "Retry loading" }))
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

describe("EmailNotificationPreference — save on flip (S2)", () => {
  it("saves through its own PUT and shows the server's reply", async () => {
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    fireEvent.click(theSwitch())
    await waitFor(() => expect(within(theSwitch()).getByText("Off")).toBeInTheDocument())
    const put = calls.find((c) => c.method === "PUT")!
    expect(put.url).toBe("http://api.test/me/preferences/notification-email")
    expect(put.body).toEqual({ enabled: false })
  })

  it("is disabled while saving, and the value shown is the reply, never the click", async () => {
    let release!: (r: { status: number; body: unknown }) => void
    onPut = () => new Promise((r) => (release = r))
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    fireEvent.click(theSwitch())
    await waitFor(() => expect(theSwitch()).toBeDisabled())
    expect(theSwitch()).toHaveAttribute("aria-checked", "true")
    // The server answers ON (another tab turned it back on): the switch shows ON.
    release({ status: 200, body: prefs({ notification_email_enabled: true }) })
    await waitFor(() => expect(theSwitch()).not.toBeDisabled())
    expect(theSwitch()).toHaveAttribute("aria-checked", "true")
  })

  it("a failed save returns to the last server value and says so", async () => {
    onPut = () => ({ status: 500, body: {} })
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    fireEvent.click(theSwitch())
    const alert = await screen.findByRole("alert")
    expect(alert.textContent).toBe("Couldn't save this. Try again.")
    expect(theSwitch()).toHaveAttribute("aria-checked", "true")
    expect(within(theSwitch()).getByText("On")).toBeInTheDocument()
  })

  it("Space and Enter flip it (a native button)", async () => {
    const user = userEvent.setup()
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    theSwitch().focus()
    await user.keyboard(" ")
    await waitFor(() => expect(within(theSwitch()).getByText("Off")).toBeInTheDocument())
    await user.keyboard("{Enter}")
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
  })

  it("when email is not set up, says so and still saves", async () => {
    onGet = () => ({ status: 200, body: prefs({ email_configured: false }) })
    onPut = ({ enabled }) => ({
      status: 200,
      body: prefs({ notification_email_enabled: enabled, email_configured: false }),
    })
    render(<EmailNotificationPreference />)
    const status = await screen.findByRole("status")
    expect(status.textContent).toBe(NOT_CONFIGURED)
    fireEvent.click(theSwitch())
    await waitFor(() => expect(within(theSwitch()).getByText("Off")).toBeInTheDocument())
  })

  it("does not show the not-set-up line when email is configured", async () => {
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    expect(screen.queryByText(NOT_CONFIGURED)).toBeNull()
  })
})

describe("EmailNotificationPreference — accessibility and reach (S2)", () => {
  it("is a switch labelled by the title and described by the description", async () => {
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    const sw = theSwitch()
    expect(sw.tagName).toBe("BUTTON")
    expect(sw).toHaveAttribute("type", "button")
    const title = document.getElementById(sw.getAttribute("aria-labelledby")!)
    const desc = document.getElementById(sw.getAttribute("aria-describedby")!)
    expect(title?.textContent).toBe(TITLE)
    expect(desc?.textContent).toBe(description("2 minutes"))
  })

  it("reaches only the ungated /me/preferences routes, through a full load-and-flip", async () => {
    render(<EmailNotificationPreference />)
    await waitFor(() => expect(within(theSwitch()).getByText("On")).toBeInTheDocument())
    fireEvent.click(theSwitch())
    await waitFor(() => expect(within(theSwitch()).getByText("Off")).toBeInTheDocument())
    expect(calls.length).toBeGreaterThanOrEqual(2)
    for (const c of calls) {
      expect(new URL(c.url).pathname.startsWith("/me/preferences")).toBe(true)
    }
    // ⛔ The default-model PUT is never used: it would clear the member's default model.
    expect(calls.some((c) => c.method === "PUT" && c.url.endsWith("/me/preferences"))).toBe(false)
  })

  it("names no gated route in its source", () => {
    // A route LITERAL (`"/settings"`, `` `/settings` ``, `/admin`), not the module path
    // `@/lib/api/settings` it imports from — the recorded-URL case above is the real proof.
    expect(leafRaw).not.toMatch(/["'`]\/settings["'`/?]|\/admin/)
    expect(leafRaw).toContain('from "@/lib/api/settings"')
    expect(leafRaw.split('role="switch"').length - 1).toBe(1)
  })

  it("is mounted once in the Preferences tab, after the default chat model", () => {
    const src = sectionRaw.replace(/\r\n/g, "\n")
    expect(src.split("<EmailNotificationPreference").length - 1).toBe(1)
    expect(src.indexOf("<EmailNotificationPreference")).toBeGreaterThan(
      src.indexOf("<ModelDefaultPreference"),
    )
  })

  it("renders inside the Preferences section", async () => {
    render(
      <TechnicalNamesProvider>
        <PreferencesSection />
      </TechnicalNamesProvider>,
    )
    expect(await screen.findByRole("switch", { name: TITLE })).toBeInTheDocument()
  })
})
