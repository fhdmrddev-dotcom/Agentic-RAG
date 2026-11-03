/**
 * Phase 307-03 (OAUTH-04; D-10, D-12, D-13, D-14, D-35, D-07; T-307-01, T-307-05, T-307-07) — the
 * consent page, every state.
 *
 * ⛔ The browser leaves Syrel ONLY through `navigate` (default `window.location.replace`), and only
 * after `redirectMatchesShown` says the server's URL names the host the page showed. A refused or
 * stale request never navigates. In a frame the page renders no Allow at all. Focus starts on the
 * title, never on Allow.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { ApiError } from "@/lib/api/_core"
import type { ConsentRequest } from "@/lib/api/oauth"
import { MCP_CATALOGUE, makeFolder } from "@/components/settings/apiKeys/__tests__/fixtures"

vi.mock("@/lib/api/oauth", () => ({
  getConsentRequest: vi.fn(),
  approveConsent: vi.fn(),
  denyConsent: vi.fn(),
  listFoldersForOrg: vi.fn(),
}))
// For the App-level route cases at the bottom (the BootScreen.test App-mount shape).
vi.mock("@/hooks/useAuth", () => ({ useAuth: vi.fn() }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getSetupStatus: vi.fn() }
})
vi.mock("@/lib/supabase", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/supabase")>()
  return { ...actual, hydrateSupabaseFromRuntime: vi.fn().mockResolvedValue(undefined) }
})

import { createMemoryRouter } from "react-router"
import { RouterProvider } from "react-router/dom"
import * as oauth from "@/lib/api/oauth"
import { getSetupStatus } from "@/lib/api"
import { useAuth } from "@/hooks/useAuth"
import App from "@/App"
import { ConsentPage } from "../ConsentPage"

const RID = "0b7f3a1e-2c4d-4e5f-8a9b-1c2d3e4f5a6b"
const READY: ConsentRequest = {
  status: "ready",
  client: {
    name: "Claude",
    name_source: "dcr",
    published_host: null,
    redirect_host: "claude.ai",
    redirect_kind: "web",
    host_seeded: true,
  },
  account: { email: "dana@acme.example" },
  orgs: [
    { id: "org-a", name: "Acme Legal", mcp_off: null, active: false },
    { id: "org-b", name: "Beta Co", mcp_off: null, active: true },
    { id: "org-c", name: "Closed Ltd", mcp_off: "org", active: false },
  ],
  tools: MCP_CATALOGUE,
}
const GOOD_URL = "https://claude.ai/api/mcp/auth_callback?code=c0de&state=st&iss=https%3A%2F%2Fapi"

const api = oauth as unknown as {
  getConsentRequest: ReturnType<typeof vi.fn>
  approveConsent: ReturnType<typeof vi.fn>
  denyConsent: ReturnType<typeof vi.fn>
  listFoldersForOrg: ReturnType<typeof vi.fn>
}

function setup(over: { framed?: boolean; request?: ConsentRequest | Error } = {}) {
  const navigate = vi.fn()
  const onSignOut = vi.fn().mockResolvedValue(undefined)
  const req = over.request ?? READY
  if (req instanceof Error) api.getConsentRequest.mockRejectedValue(req)
  else api.getConsentRequest.mockResolvedValue(req)
  const view = render(
    <ConsentPage requestId={RID} onSignOut={onSignOut} navigate={navigate} isFramed={() => over.framed ?? false} />,
  )
  return { navigate, onSignOut, ...view }
}

const allow = () => screen.getByRole("button", { name: "Allow access" })
const deny = () => screen.getByRole("button", { name: "Deny access" })

beforeEach(() => {
  api.listFoldersForOrg.mockResolvedValue({
    folders: [makeFolder({ id: "f1", name: "Contracts" }), makeFolder({ id: "f2", name: "Inbox", source: "mail" })],
  })
})
afterEach(() => {
  vi.clearAllMocks()
})

describe("307-03 ConsentPage — ready", () => {
  it("shows the loading state, then the card titled 'Connect an app' with focus on the title", async () => {
    setup()
    expect(screen.getByRole("status")).toHaveTextContent("Loading the sign-in request…")
    const title = await screen.findByTestId("consent-title")
    expect(title).toHaveTextContent("Connect an app")
    await waitFor(() => expect(title).toHaveFocus())
    expect(allow()).not.toHaveFocus()
    expect(document.title).toBe("Connect an app · Syrel")
    expect(screen.getByText("An app wants to use Syrel as you.")).toBeInTheDocument()
    // The title never carries the client's name.
    expect(title.textContent).not.toContain("Claude")
  })

  it("names the account, the client, the host and the summary sentence", async () => {
    setup()
    await screen.findByTestId("consent-title")
    expect(screen.getByTestId("consent-account")).toHaveTextContent("Signing in as dana@acme.example")
    expect(screen.getByTestId("consent-client-name")).toHaveTextContent("Claude")
    expect(screen.getByTestId("consent-host")).toHaveTextContent("claude.ai")
    expect(screen.getByTestId("consent-summary")).toHaveTextContent(
      "This app will search and read in everything you can see in Beta Co, not mail or synced sources, as you. It can't ask the agent or run workflows.",
    )
    expect(screen.getByTestId("consent-fine")).toHaveTextContent("Allowing sends you back to claude.ai.")
  })

  it("defaults to the active org when it is switched on, reads ITS folders, and switched-off orgs stay listed", async () => {
    setup()
    await screen.findByTestId("consent-title")
    expect(screen.getByRole("radio", { name: "Beta Co" })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByRole("radio", { name: /Closed Ltd/ })).toHaveAttribute("aria-disabled", "true")
    await waitFor(() => expect(api.listFoldersForOrg).toHaveBeenCalledWith("org-b", expect.anything()))
  })

  it("the active org switched off falls back to the first switched-on org", async () => {
    setup({
      request: {
        ...READY,
        orgs: [{ ...READY.orgs[2], active: true }, READY.orgs[0], { ...READY.orgs[1], active: false }],
      } as ConsentRequest,
    })
    await screen.findByTestId("consent-title")
    expect(screen.getByRole("radio", { name: "Acme Legal" })).toHaveAttribute("aria-checked", "true")
  })

  it("changing the org re-reads that org's folders and resets to All folders", async () => {
    setup()
    await screen.findByTestId("consent-title")
    await userEvent.click(screen.getByRole("radio", { name: /Only these folders/ }))
    await userEvent.click(screen.getByRole("radio", { name: "Acme Legal" }))
    await waitFor(() => expect(api.listFoldersForOrg).toHaveBeenLastCalledWith("org-a", expect.anything()))
    expect(screen.getByRole("radio", { name: /All folders I can see in Acme Legal/ })).toHaveAttribute("aria-checked", "true")
    expect(screen.getByTestId("consent-summary")).toHaveTextContent("everything you can see in Acme Legal")
  })

  it("Allow is disabled with the first unmet reason as linked text", async () => {
    setup()
    await screen.findByTestId("consent-title")
    await userEvent.click(screen.getByRole("radio", { name: /Only these folders/ }))
    expect(allow()).toBeDisabled()
    const why = screen.getByText("Tick at least one folder, or choose All folders I can see.")
    expect(allow().getAttribute("aria-describedby")).toContain(why.id)
  })

  it("no switched-on org: Allow disabled with the needOrg sentence", async () => {
    setup({ request: { ...READY, orgs: [READY.orgs[2]] } as ConsentRequest })
    await screen.findByTestId("consent-title")
    expect(allow()).toBeDisabled()
    expect(
      screen.getByText("MCP access is switched off in every organisation you belong to. Ask an admin to switch it on."),
    ).toBeInTheDocument()
  })

  it("Allow sends the picked org and pick, shows Connected, then replaces the location", async () => {
    api.approveConsent.mockResolvedValue({ redirect_url: GOOD_URL })
    const { navigate } = setup()
    await screen.findByTestId("consent-title")
    await waitFor(() => expect(allow()).toBeEnabled())
    await userEvent.click(allow())
    expect(api.approveConsent).toHaveBeenCalledWith(RID, {
      org_id: "org-b",
      tools: ["search_knowledge_base", "list_documents", "read_document"],
      folder_ids: null,
      include_external: false,
    })
    expect(await screen.findByText("Connected")).toBeInTheDocument()
    expect(screen.getByText("Taking you back to claude.ai…")).toBeInTheDocument()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(GOOD_URL))
    expect(navigate).toHaveBeenCalledTimes(1)
  })

  it("a returned URL on another host renders 'redirect not registered' and NEVER navigates", async () => {
    api.approveConsent.mockResolvedValue({ redirect_url: "https://evil.example/cb?code=x" })
    const { navigate } = setup()
    await screen.findByTestId("consent-title")
    await waitFor(() => expect(allow()).toBeEnabled())
    await userEvent.click(allow())
    expect(
      await screen.findByText("It asked to send you back to an address it didn't register, so Syrel won't send you there."),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Allow access" })).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("Deny shows Not connected and replaces the location with the server's access_denied URL", async () => {
    const url = "https://claude.ai/api/mcp/auth_callback?error=access_denied&state=st&iss=x"
    api.denyConsent.mockResolvedValue({ redirect_url: url })
    const { navigate } = setup()
    await screen.findByTestId("consent-title")
    await userEvent.click(deny())
    expect(await screen.findByText("Not connected")).toBeInTheDocument()
    expect(screen.getByText("The app gets no access to Syrel.")).toBeInTheDocument()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(url))
  })

  it("a 410 on Allow renders the expired state and never navigates", async () => {
    api.approveConsent.mockRejectedValue(new ApiError("gone", 410))
    const { navigate } = setup()
    await screen.findByTestId("consent-title")
    await waitFor(() => expect(allow()).toBeEnabled())
    await userEvent.click(allow())
    expect(await screen.findByText("This sign-in request has expired")).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("a 403 on Allow shows the server sentence in an alert, keeps the choices and re-reads the orgs", async () => {
    api.approveConsent.mockRejectedValue(new ApiError("MCP access is switched off for this organisation by an admin.", 403))
    setup()
    await screen.findByTestId("consent-title")
    await waitFor(() => expect(allow()).toBeEnabled())
    await userEvent.click(screen.getByRole("radio", { name: "Read and ask" }))
    await userEvent.click(allow())
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("MCP access is switched off for this organisation by an admin.")
    expect(screen.getByRole("radio", { name: "Read and ask" })).toHaveAttribute("aria-checked", "true")
    await waitFor(() => expect(api.getConsentRequest).toHaveBeenCalledTimes(2))
    expect(allow()).toBeEnabled()
  })

  it("a network failure on Allow says so with the detail, choices kept", async () => {
    api.approveConsent.mockRejectedValue(new Error("Failed to fetch"))
    setup()
    await screen.findByTestId("consent-title")
    await waitFor(() => expect(allow()).toBeEnabled())
    await userEvent.click(allow())
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't finish connecting the app. Failed to fetch Your choices are kept; try again.",
    )
  })

  it("while Allow is in flight every control is disabled and the button reads Connecting…", async () => {
    let resolve: (v: unknown) => void = () => {}
    api.approveConsent.mockReturnValue(new Promise((r) => (resolve = r)))
    setup()
    await screen.findByTestId("consent-title")
    await waitFor(() => expect(allow()).toBeEnabled())
    await userEvent.click(allow())
    expect(screen.getByRole("button", { name: "Connecting…" })).toBeDisabled()
    expect(deny()).toBeDisabled()
    resolve({ redirect_url: GOOD_URL })
    expect(await screen.findByText("Connected")).toBeInTheDocument()
  })

  it("'Use another account' signs out and reloads the same address", async () => {
    const reload = vi.fn()
    const { onSignOut } = setup()
    const original = window.location
    Object.defineProperty(window, "location", { configurable: true, value: { ...original, reload } })
    try {
      await screen.findByTestId("consent-title")
      await userEvent.click(screen.getByRole("button", { name: "Use another account" }))
      expect(onSignOut).toHaveBeenCalled()
      await waitFor(() => expect(reload).toHaveBeenCalled())
    } finally {
      Object.defineProperty(window, "location", { configurable: true, value: original })
    }
  })

  it("a loopback client says 'this computer' in the fine print and the after-Allow subhead", async () => {
    api.approveConsent.mockResolvedValue({ redirect_url: "http://localhost:51234/callback?code=x&state=s" })
    const { navigate } = setup({
      request: { ...READY, client: { ...READY.client, redirect_host: "localhost", redirect_kind: "loopback", host_seeded: false } } as ConsentRequest,
    })
    await screen.findByTestId("consent-title")
    expect(screen.getByTestId("consent-fine")).toHaveTextContent("Allowing sends you back to the app on this computer.")
    await waitFor(() => expect(allow()).toBeEnabled())
    await userEvent.click(allow())
    expect(await screen.findByText("Taking you back to the app on this computer…")).toBeInTheDocument()
    await waitFor(() => expect(navigate).toHaveBeenCalledWith("http://localhost:51234/callback?code=x&state=s"))
  })
})

describe("307-03 ConsentPage — every other state", () => {
  it("expired: no button, no navigation", async () => {
    const { navigate } = setup({ request: { status: "expired" } })
    expect(await screen.findByText("This sign-in request has expired")).toBeInTheDocument()
    expect(screen.getByText("Nothing was connected.")).toBeInTheDocument()
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    expect(navigate).not.toHaveBeenCalled()
  })

  const REFUSED: [string, string][] = [
    ["host_not_allowed", "It asked to send you back to evil.example, which this Syrel deployment doesn't allow."],
    ["not_registered", "It asked to send you back to an address it didn't register, so Syrel won't send you there."],
    ["unknown_client", "Syrel doesn't know this app. Go back to it and connect again; it will register itself."],
    ["metadata_unreadable", "Syrel couldn't read this app's published details at evil.example. Try connecting again in a minute."],
  ]
  it.each(REFUSED)("refused %s: its words, no control that leaves Syrel", async (reason, words) => {
    const { navigate, container } = setup({ request: { status: "refused", reason, host: "evil.example" } as ConsentRequest })
    expect(await screen.findByText("This app can't sign in here")).toBeInTheDocument()
    expect(screen.getByText("You have not been sent anywhere.")).toBeInTheDocument()
    expect(screen.getByTestId("consent-refused-body")).toHaveTextContent(words)
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    expect(container.querySelector("a")).toBeNull()
    expect(navigate).not.toHaveBeenCalled()
  })

  it("host_not_allowed also names where to ask", async () => {
    setup({ request: { status: "refused", reason: "host_not_allowed", host: "evil.example" } })
    expect(
      await screen.findByText(
        "If you expected this to work, ask the person who runs this Syrel deployment to allow evil.example in Control Room → AI tool sign-in.",
      ),
    ).toBeInTheDocument()
  })

  it("deployment off: 'Go back to the app' sends the Deny answer", async () => {
    const url = "https://claude.ai/cb?error=access_denied&state=s&iss=x"
    api.denyConsent.mockResolvedValue({ redirect_url: url })
    const { navigate } = setup({ request: { status: "deployment_off", host: "claude.ai" } })
    expect(await screen.findByText("AI tool access is switched off")).toBeInTheDocument()
    expect(screen.getByText("MCP access is switched off for this deployment by the operator.")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Go back to the app" }))
    expect(api.denyConsent).toHaveBeenCalledWith(RID)
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(url))
  })

  it("load failed: an alert with Try again, which re-reads", async () => {
    setup({ request: new Error("Failed to fetch") })
    const alert = await screen.findByRole("alert")
    expect(alert).toHaveTextContent("Couldn't load this sign-in request. Check your connection and try again.")
    api.getConsentRequest.mockResolvedValue(READY)
    await userEvent.click(within(alert).getByRole("button", { name: "Try again" }))
    expect(await screen.findByTestId("consent-title")).toHaveTextContent("Connect an app")
  })

  it("framed: 'This page can't be shown here', no Allow in the DOM, no read", async () => {
    setup({ framed: true })
    expect(screen.getByText("This page can't be shown here")).toBeInTheDocument()
    expect(screen.getByText("For your safety, Syrel's sign-in page only works in its own browser tab.")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Allow access" })).toBeNull()
    expect(screen.queryAllByRole("button")).toHaveLength(0)
    expect(api.getConsentRequest).not.toHaveBeenCalled()
  })
})

describe("307-03 App — the /app/connect/<uuid> branch (D-11, D-41)", () => {
  function renderAppAt(path: string, user: unknown) {
    window.history.replaceState(null, "", path)
    vi.mocked(useAuth).mockReturnValue({
      user,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signUp: vi.fn(),
      signInWithSSO: vi.fn(),
      signOut: vi.fn(),
    } as unknown as ReturnType<typeof useAuth>)
    vi.mocked(getSetupStatus).mockResolvedValue({ needs_setup: false, finalized: false, has_token: false })
    const router = createMemoryRouter([{ path: "*", Component: App }], { initialEntries: [path] })
    return render(<RouterProvider router={router} />)
  }
  afterEach(() => window.history.replaceState(null, "", "/"))

  it("signed out: the sign-in card with the return line, and no app name", async () => {
    renderAppAt(`/app/connect/${RID}`, null)
    expect(await screen.findByText("Sign in to your account")).toBeInTheDocument()
    expect(screen.getByText("After you sign in, you'll go to the page that connects your app.")).toBeInTheDocument()
    expect(api.getConsentRequest).not.toHaveBeenCalled()
  })

  it("signed in: the consent page, outside the app shell", async () => {
    api.getConsentRequest.mockResolvedValue(READY)
    renderAppAt(`/app/connect/${RID}`, { id: "u1", email: "dana@acme.example" })
    expect(await screen.findByTestId("consent-account")).toHaveTextContent("dana@acme.example")
    expect(api.getConsentRequest).toHaveBeenCalledWith(RID)
    // No nav rail, no chat composer: ChatLayout and the providers never mounted.
    expect(screen.queryByRole("navigation")).toBeNull()
  })
})

describe("307-03 consent sources — copy lives in oauthCopy.ts, no HTML from client strings", () => {
  const sources = import.meta.glob("../*.tsx", { query: "?raw", import: "default", eager: true }) as Record<string, string>
  const copy = import.meta.glob("../oauthCopy.ts", { query: "?raw", import: "default", eager: true }) as Record<string, string>

  it("finds the three component files (the sweep is not vacuous)", () => {
    expect(Object.keys(sources).sort()).toEqual([
      "../ConsentOrgField.tsx",
      "../ConsentPage.tsx",
      "../ConsentWhoIsAsking.tsx",
    ])
  })

  it("no JSX text literal in any consent component", () => {
    for (const [file, src] of Object.entries(sources)) {
      const stripped = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
      // JSX text between a tag's `>` (not an arrow's `=>`) and the next tag: words there are a literal.
      const literals = [...stripped.matchAll(/(?<!=)>\s*([A-Za-z][^<>{}\n=;()]*?)\s*<\/?[A-Za-z]/g)].map((m) => m[1])
      expect(literals, file).toEqual([])
    }
  })

  it("no dangerouslySetInnerHTML, no location.assign / href write, location.replace only in the page", () => {
    for (const [file, src] of Object.entries(sources)) {
      expect(src, file).not.toContain("dangerouslySetInnerHTML")
      expect(src, file).not.toMatch(/location\.(assign|href\s*=)/)
    }
    expect(sources["../ConsentPage.tsx"]).toContain("location.replace")
    expect(sources["../ConsentPage.tsx"]).toContain("window.top")
  })

  it("oauthCopy.ts imports nothing", () => {
    const src = Object.values(copy)[0]
    expect(src).not.toMatch(/^\s*import /m)
  })

  it("the consent type scale: no 600 / 500 weights and no 20px in the consent components", () => {
    for (const [file, src] of Object.entries(sources)) {
      expect(src, file).not.toMatch(/font-(semibold|medium)\b/)
      expect(src, file).not.toMatch(/text-xl\b/)
    }
  })
})
