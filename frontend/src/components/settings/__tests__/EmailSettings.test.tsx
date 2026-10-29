/**
 * Phase 300-05 (D-07, D-08, D-10; UI-SPEC S3) — the operator's Email card in Settings → Integrations.
 *
 * The `ApiKeyLimits` shape (293-03): the leaf owns its fetch and drafts, has NO save button, and
 * hands the tab's one Save its changed fields through `changes()` / `adopt()`. "Sent through" is
 * READ-ONLY (the env's EMAIL_PROVIDER, D-08). The delay hint follows the draft live in the email's
 * own floor words — the client twin of `run_waiting_email.duration_words`, pinned to the server's
 * by `DURATION_CASES` below, which `backend/tests/unit/test_300_settings_email_knobs.py` reads and
 * checks against the Python function. ONE case list, two languages: no second formatting rule.
 */
import { createRef } from "react"
import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react"

import * as api from "@/lib/api"
import { EmailSettings, type EmailSettingsHandle } from "../EmailSettings"
import settingsPageRaw from "@/pages/SettingsPage.tsx?raw"

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getSettings: vi.fn(), updateSettings: vi.fn() }
})

const getSettings = vi.mocked(api.getSettings)
const updateSettings = vi.mocked(api.updateSettings)

// [seconds, words] — the shared case list (read by the backend test; keep it a flat literal).
// DURATION_CASES_START
const DURATION_CASES: [number, string][] = [
  [60, "1 minute"],
  [119, "1 minute"],
  [120, "2 minutes"],
  [300, "5 minutes"],
  [3599, "59 minutes"],
  [3600, "1 hour"],
]
// DURATION_CASES_END

const LABELS = {
  delay: "Wait before emailing (seconds)",
  from: "Send from (address)",
  name: "Send from (name)",
  test: "Test address (outside production)",
}
const delay = () => screen.getByLabelText(LABELS.delay) as HTMLInputElement
const from = () => screen.getByLabelText(LABELS.from) as HTMLInputElement
const name = () => screen.getByLabelText(LABELS.name) as HTMLInputElement
const testAddr = () => screen.getByLabelText(LABELS.test) as HTMLInputElement
const delayHint = (words: string) =>
  `A run still waiting after ${words} emails its owner. Between 60 and 3600 seconds.`

function settingsWith(over: Record<string, unknown>) {
  return over as unknown as Awaited<ReturnType<typeof api.getSettings>>
}

const STORED = {
  notification_email_delay_seconds: 120,
  email_from_address: "notify@notify.example.com",
  email_from_name: "Syrel",
  email_dev_redirect_address: "",
  email_provider: "resend",
}

function renderLeaf() {
  const ref = createRef<EmailSettingsHandle>()
  render(<EmailSettings ref={ref} />)
  return ref
}

beforeEach(() => {
  getSettings.mockReset()
  updateSettings.mockReset()
})

describe("EmailSettings — the card's words (S3)", () => {
  beforeEach(() => {
    getSettings.mockResolvedValue(settingsWith(STORED))
  })

  it("shows the title, description, labels and hints", async () => {
    renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    expect(screen.getByText("Email").textContent).toBe("Email")
    expect(
      screen.getByText(
        "Who run-waiting and invitation emails come from, and how long a run waits before its owner is emailed.",
      ),
    ).toBeInTheDocument()
    expect(screen.getByText("Sent through")).toBeInTheDocument()
    expect(
      screen.getByText("Run-waiting and invitation emails come from this address. Replies are not read."),
    ).toBeInTheDocument()
    expect(screen.getByText("The sender name people see in their inbox.")).toBeInTheDocument()
    expect(screen.getByText(delayHint("2 minutes"))).toBeInTheDocument()
    expect(
      screen.getByText(
        "Outside production, every email goes here instead of to its real recipient. Leave it empty and nothing is sent outside production: each email is only logged.",
      ),
    ).toBeInTheDocument()
    expect(from().value).toBe("notify@notify.example.com")
    expect(name().value).toBe("Syrel")
    expect(testAddr().value).toBe("")
    expect(from().type).toBe("email")
    expect(testAddr().type).toBe("email")
  })

  it("has no save button of its own and never PUTs", async () => {
    renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    fireEvent.change(delay(), { target: { value: "300" } })
    fireEvent.blur(delay())
    expect(screen.queryByRole("button", { name: /save/i })).toBeNull()
    expect(updateSettings).not.toHaveBeenCalled()
  })
})

describe("EmailSettings — Sent through (read-only, D-08)", () => {
  it.each([
    ["resend", "Resend"],
    ["smtp", "Your mail server (SMTP)"],
    [
      "none",
      "Nothing yet. Emails are only logged. Set EMAIL_PROVIDER in the server environment to send them.",
    ],
    [
      undefined,
      "Nothing yet. Emails are only logged. Set EMAIL_PROVIDER in the server environment to send them.",
    ],
  ])("provider %s reads %s", async (provider, words) => {
    getSettings.mockResolvedValue(settingsWith({ ...STORED, email_provider: provider }))
    renderLeaf()
    const row = await screen.findByTestId("email-sent-through")
    expect(row.textContent).toBe(words)
    expect(row.tagName).not.toBe("INPUT")
  })

  it("never hands the provider over", async () => {
    getSettings.mockResolvedValue(settingsWith(STORED))
    const ref = renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    fireEvent.change(delay(), { target: { value: "300" } })
    expect(ref.current!.changes()).not.toHaveProperty("email_provider")
  })
})

describe("EmailSettings — the delay in floor words (D-07)", () => {
  beforeEach(() => {
    getSettings.mockResolvedValue(settingsWith(STORED))
  })

  it.each(DURATION_CASES)("%i seconds reads '%s'", async (seconds, words) => {
    renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    fireEvent.change(delay(), { target: { value: String(seconds) } })
    expect(screen.getByText(delayHint(words))).toBeInTheDocument()
  })

  it("clamps to 60..3600 on blur and on hand-over", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    fireEvent.change(delay(), { target: { value: "5" } })
    expect(ref.current!.changes()).toEqual({ notification_email_delay_seconds: 60 })
    fireEvent.blur(delay())
    expect(delay().value).toBe("60")
    fireEvent.change(delay(), { target: { value: "99999" } })
    expect(ref.current!.changes()).toEqual({ notification_email_delay_seconds: 3600 })
    fireEvent.blur(delay())
    expect(delay().value).toBe("3600")
    expect(delay().min).toBe("60")
    expect(delay().max).toBe("3600")
  })

  it("a cleared delay is never sent and restores on blur", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    fireEvent.change(delay(), { target: { value: "" } })
    expect(ref.current!.changes()).toEqual({})
    fireEvent.blur(delay())
    expect(delay().value).toBe("120")
  })
})

describe("EmailSettings — changed fields only (S3)", () => {
  beforeEach(() => {
    getSettings.mockResolvedValue(settingsWith(STORED))
  })

  it("hands over nothing until something changes", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    expect(ref.current!.changes()).toEqual({})
  })

  it("hands over each changed field", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    fireEvent.change(from(), { target: { value: "alerts@example.com" } })
    fireEvent.change(name(), { target: { value: "Syrel Alerts" } })
    fireEvent.change(testAddr(), { target: { value: "me@example.com" } })
    expect(ref.current!.changes()).toEqual({
      email_from_address: "alerts@example.com",
      email_from_name: "Syrel Alerts",
      email_dev_redirect_address: "me@example.com",
    })
  })

  it("an emptied address is handed over as empty (use the environment's address)", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(from().value).toBe("notify@notify.example.com"))
    fireEvent.change(from(), { target: { value: "" } })
    expect(ref.current!.changes()).toEqual({ email_from_address: "" })
  })

  it.each(["two words@x.y", "a@b", "nope", "a@x.y, b@x.y"])(
    "an invalid address '%s' says so under its field and is not sent",
    async (bad) => {
      const ref = renderLeaf()
      await waitFor(() => expect(delay().value).toBe("120"))
      fireEvent.change(testAddr(), { target: { value: bad } })
      fireEvent.blur(testAddr())
      const alert = await screen.findByRole("alert")
      expect(alert.textContent).toBe("That isn't an email address.")
      expect(ref.current!.changes()).toEqual({})
    },
  )

  // 300-REVIEW WR-05: an invalid address used to be silently left out of the PUT; the save then
  // said "Saved" and adopt() wiped the typed value and its error line. The card now VETOES the
  // save: invalid() names the problem, and the page returns before its PUT.
  it.each([
    ["from", () => from()],
    ["test", () => testAddr()],
  ])("an invalid changed %s address vetoes the save and shows its line", async (_label, field) => {
    const ref = renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    fireEvent.change(field(), { target: { value: "notify@" } })
    expect(screen.queryByRole("alert")).toBeNull()
    let refusal: string | null = null
    act(() => {
      refusal = ref.current!.invalid()
    })
    expect(refusal).toBe("An email address in the Email card isn't valid. Fix it, then save again.")
    // the field's own line shows even though it was never blurred, and the typed value stays
    expect((await screen.findByRole("alert")).textContent).toBe("That isn't an email address.")
    expect(field().value).toBe("notify@")
  })

  it("nothing invalid vetoes nothing (unchanged, valid, emptied)", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    expect(ref.current!.invalid()).toBeNull()
    fireEvent.change(from(), { target: { value: "" } })
    fireEvent.change(testAddr(), { target: { value: "me@example.com" } })
    expect(ref.current!.invalid()).toBeNull()
  })

  it("before the read has answered, nothing vetoes the save", async () => {
    getSettings.mockReturnValue(new Promise(() => {}))
    const ref = renderLeaf()
    await waitFor(() => expect(getSettings).toHaveBeenCalled())
    expect(ref.current!.invalid()).toBeNull()
  })

  it("a cleared name restores the loaded value on blur and is never sent", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(name().value).toBe("Syrel"))
    fireEvent.change(name(), { target: { value: "" } })
    expect(ref.current!.changes()).toEqual({})
    fireEvent.blur(name())
    expect(name().value).toBe("Syrel")
  })

  it("a name over 60 characters is not sent", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(name().value).toBe("Syrel"))
    fireEvent.change(name(), { target: { value: "x".repeat(61) } })
    expect(ref.current!.changes()).toEqual({})
    fireEvent.change(name(), { target: { value: "x".repeat(60) } })
    expect(ref.current!.changes()).toEqual({ email_from_name: "x".repeat(60) })
  })

  it("after the save, shows the SERVER's values as the new baseline", async () => {
    const ref = renderLeaf()
    await waitFor(() => expect(delay().value).toBe("120"))
    fireEvent.change(delay(), { target: { value: "500" } })
    act(() =>
      ref.current!.adopt({
        notification_email_delay_seconds: 480,
        email_from_address: "server@example.com",
        email_from_name: "Server Name",
        email_dev_redirect_address: "t@example.com",
      }),
    )
    expect(delay().value).toBe("480")
    expect(from().value).toBe("server@example.com")
    expect(name().value).toBe("Server Name")
    expect(testAddr().value).toBe("t@example.com")
    expect(ref.current!.changes()).toEqual({})
    expect(screen.getByText(delayHint("8 minutes"))).toBeInTheDocument()
  })
})

describe("EmailSettings — loading (S3)", () => {
  it("while loading the fields are empty and locked, and nothing is handed over", async () => {
    getSettings.mockReturnValue(new Promise(() => {}))
    const ref = renderLeaf()
    await waitFor(() => expect(getSettings).toHaveBeenCalledTimes(1))
    for (const field of [delay(), from(), name(), testAddr()]) {
      expect(field.value).toBe("")
      expect(field).toBeDisabled()
    }
    expect(ref.current!.changes()).toEqual({})
  })

  it("a failed read says so with Retry loading email settings", async () => {
    getSettings.mockRejectedValueOnce(new Error("Failed to get settings"))
    getSettings.mockResolvedValueOnce(settingsWith(STORED))
    const ref = renderLeaf()
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load the email settings.")
    expect(delay().value).toBe("")
    expect(ref.current!.changes()).toEqual({})
    fireEvent.click(screen.getByRole("button", { name: "Retry loading email settings" }))
    await waitFor(() => expect(delay().value).toBe("120"))
    expect(screen.queryByRole("alert")).toBeNull()
  })
})

describe("SettingsPage wiring (300-05, G-5: one ref, one spread, one adopt, one mount)", () => {
  it("mounts the card once in Integrations, after ApiKeyLimits, and rides Save Integrations", () => {
    const src = settingsPageRaw.replace(/\r\n/g, "\n")
    expect(src.split("emailSettingsRef").length - 1).toBe(5)
    expect(src).toContain("useRef<EmailSettingsHandle>(null)")
    expect(src).toContain("...emailSettingsRef.current?.changes()")
    expect(src).toContain("emailSettingsRef.current?.adopt(updated)")
    expect(src.split("<EmailSettings ").length - 1).toBe(1)
    // The useState count is unchanged from the plan base (the 293-03 pin reads the same 49).
    expect(src.split("useState(").length - 1).toBe(49)
    const card = src.indexOf("<EmailSettings ")
    expect(card).toBeGreaterThan(src.indexOf("<ApiKeyLimits "))
    expect(card).toBeLessThan(src.indexOf("Save Integrations", card))
    const save = src.indexOf("const handleSaveIntegrations")
    const spread = src.indexOf("...emailSettingsRef.current?.changes()")
    expect(spread).toBeGreaterThan(save)
    expect(spread).toBeLessThan(src.indexOf("await updateSettings(body)", save))
    // WR-05: the card's veto is read FIRST and returns before the PUT, into the error home.
    const veto = src.indexOf("emailSettingsRef.current?.invalid()")
    expect(veto).toBeGreaterThan(save)
    expect(veto).toBeLessThan(src.indexOf("setSavingIntegrations(true)", save))
    expect(src.slice(veto, src.indexOf("setSavingIntegrations(true)", save))).toMatch(
      /setError\(emailRefusal\)\s*return/,
    )
  })
})
