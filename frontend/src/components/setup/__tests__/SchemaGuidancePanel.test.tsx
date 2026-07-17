/**
 * Phase 158 Plan 09 (DEPLOY-02 / UI-SPEC §4, D-10) — SchemaGuidancePanel contract.
 *
 * Locks the schema-missing guidance rules:
 *   • AMBER tone (guidance, not an error) — never destructive/red;
 *   • the exact OPERATOR.md Step-3 sequence (full-schema.sql + the 9 ordered seeds +
 *     the ('global') row) in a copyable mono block;
 *   • the copy button writes the SQL to the clipboard;
 *   • the SHOULD "run it for me" calls postSchemaBootstrap → onBootstrapped on success,
 *     and falls back to the copy-guide on a {fallback:"guide"} response;
 *   • without a token, only the copy-guide (the MUST) renders — no auto-run button.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

import { SchemaGuidancePanel } from "../SchemaGuidancePanel"
import { postSchemaBootstrap, type SchemaBootstrapResult } from "@/lib/setupApi"

vi.mock("@/lib/setupApi", async () => {
  const actual = await vi.importActual<typeof import("@/lib/setupApi")>("@/lib/setupApi")
  return { ...actual, postSchemaBootstrap: vi.fn() }
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe("SchemaGuidancePanel (D-10) — amber copy-guide + optional auto-run", () => {
  it("renders the AMBER guidance with the exact OPERATOR.md Step-3 SQL sequence (never red)", () => {
    const { container } = render(<SchemaGuidancePanel />)

    // Guidance, not an error — amber, not destructive.
    const panel = container.querySelector<HTMLElement>('[role="status"]')!
    expect(panel.className).toMatch(/amber/)
    expect(panel.className).not.toContain("destructive")

    expect(screen.getByText(/reachable but empty/i)).toBeInTheDocument()
    // The exact Step-3 sequence: full-schema + the trio filenames + the ('global') row.
    const sql = screen.getByText(/INSERT INTO app_settings \(id\) VALUES \('global'\)/i)
    expect(sql).toBeInTheDocument()
    expect(sql.textContent).toContain("supabase/full-schema.sql")
    expect(sql.textContent).toContain("087_skill_creator_reborn.sql")
    expect(sql.textContent).toContain("089_skill_creator_file_attach_honesty.sql")
  })

  it("copies the SQL sequence to the clipboard", async () => {
    const user = userEvent.setup()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true })
    render(<SchemaGuidancePanel />)

    await user.click(screen.getByRole("button", { name: /copy the setup sql sequence/i }))
    expect(writeText).toHaveBeenCalledTimes(1)
    expect(writeText.mock.calls[0][0]).toContain("INSERT INTO app_settings (id) VALUES ('global')")
  })

  it("without a token, renders ONLY the copy-guide (no auto-run button)", () => {
    render(<SchemaGuidancePanel />)
    expect(screen.queryByRole("button", { name: /set up the database for me/i })).not.toBeInTheDocument()
    // The copy-guide (the MUST) is still there.
    expect(screen.getByRole("button", { name: /copy the setup sql sequence/i })).toBeInTheDocument()
  })

  it("the SHOULD auto-run calls postSchemaBootstrap and fires onBootstrapped on success", async () => {
    const user = userEvent.setup()
    const done: SchemaBootstrapResult = { ok: true, bootstrapped: true, schema_present: true }
    vi.mocked(postSchemaBootstrap).mockResolvedValue(done)
    const onBootstrapped = vi.fn()
    render(<SchemaGuidancePanel token="tok" bind={{ postgres_dsn: "postgres://x" }} onBootstrapped={onBootstrapped} />)

    await user.click(screen.getByRole("button", { name: /set up the database for me/i }))

    await waitFor(() => expect(onBootstrapped).toHaveBeenCalledTimes(1))
    expect(postSchemaBootstrap).toHaveBeenCalledWith("tok", { postgres_dsn: "postgres://x" })
  })

  it("a {fallback:'guide'} response keeps the copy-guide and does NOT fire onBootstrapped", async () => {
    const user = userEvent.setup()
    const guide: SchemaBootstrapResult = { ok: false, fallback: "guide", reason: "insufficient privilege" }
    vi.mocked(postSchemaBootstrap).mockResolvedValue(guide)
    const onBootstrapped = vi.fn()
    render(<SchemaGuidancePanel token="tok" onBootstrapped={onBootstrapped} />)

    await user.click(screen.getByRole("button", { name: /set up the database for me/i }))

    expect(await screen.findByText(/insufficient privilege/i)).toBeInTheDocument()
    expect(onBootstrapped).not.toHaveBeenCalled()
  })
})
