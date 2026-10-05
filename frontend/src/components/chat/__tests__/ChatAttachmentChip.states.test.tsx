/**
 * Phase 244 plan 05 Task 1 (SHELL-04 / D-244-22 / D-244-25) — THE ATTACHMENT CHIP,
 * ONE COMPONENT AND THREE STATES.
 *
 * Sketch 236's winner is **A — Scope on the chip** (operator, 2026-09-11), and the reason it
 * won is also the thing a build can silently drop: *"a menu is read once and closed, a chip is
 * still on screen while the person types and survives into the transcript."* So the load-bearing
 * case in this file is **Test 2** — the SENT chip still says `this chat only`. A chip that
 * carries the scope word only while pending has shipped variant B's weakness at variant A's cost.
 *
 * ⛔ EVERY STRING ASSERTED HERE IS READ FROM THE PORT (`composerCopy`), NEVER TYPED INTO THIS
 * FILE, and Test 5 closes the loop by reading the sketch's own `COPY.js` with `?raw`. A re-typed
 * string is a silently different product (the `feedback-sketch-to-build-drift` rule).
 *
 * ⚠ THE THREE EXPIRY READINGS ARE NOT A DETAIL. `FilesSection.expiryCaption` already paid for
 * this lesson twice: an absent `expires_at` is `expiry unknown` (the wire did not say), an
 * UNPARSEABLE one is the SAME third case (it used to render "expires in NaNm"), and neither is
 * amber — painting an absent field amber manufactures an alarm out of a missing value. This chip
 * IMPORTS that helper rather than re-deriving it, and these cases are what hold it there.
 */
import { render, screen, fireEvent } from "@testing-library/react"
import { describe, it, expect, vi, beforeEach } from "vitest"

// Phase 274-04: the SENT chip reads its thread (`useViewingThread`) and the thread's Library marks
// (`useLibraryLinks`). Both are mocked so each case states the thread and the mark it renders.
const useViewingThread = vi.fn<() => string | null>(() => "t-1")
vi.mock("@/providers/StreamsProvider", () => ({ useViewingThread: () => useViewingThread() }))
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: null } }) } },
}))
const linkState = vi.fn()
vi.mock("@/components/attachments/useLibraryLinks", () => ({
  useLibraryLinks: () => ({ stateFor: (id: string | undefined) => linkState(id) }),
  refreshLibraryLinks: vi.fn(),
}))

// eslint-disable-next-line import/first
import { ChatAttachmentChip } from "../ChatAttachmentChip"
// eslint-disable-next-line import/first
import { COPY } from "../composerCopy"
// eslint-disable-next-line import/first
import { COPY as SAVE_COPY } from "@/components/attachments/saveToLibraryCopy"
// eslint-disable-next-line import/first
import type { WorkspaceFile } from "@/types"

// The sketch's own copy object, read as SOURCE. The build ports this file; this import is what
// makes "ported, not re-typed" checkable rather than a promise in a docblock.
// eslint-disable-next-line import/first
import sketchCopySource from "../../../../../.planning/sketches/236-the-file-that-belongs-to-this-chat/COPY.js?raw"
// The chip's own source — Test 6 asserts the ICON comes from the shipped shared vocabulary
// (`@/lib/fileIcon`) rather than from a mark invented here (icon-convention.md §"What to avoid").
// eslint-disable-next-line import/first
import chipSource from "../ChatAttachmentChip.tsx?raw"

const HOUR = 3_600_000

/**
 * ⚠ COMMENTS ARE STRIPPED BEFORE ANY SOURCE ASSERTION, and this is not tidiness.
 * 244-02 recorded the mirror of it (*"a source fence that reads prose can be made to LIE by its
 * own docstring"*); this fence hit the opposite failure the first time it ran — the chip's
 * docblock explains WHY it carries no `dangerouslySetInnerHTML`, and `not.toContain(...)` read
 * the explanation as the thing. A fence over CODE must look at code.
 */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

/**
 * Phase 274 (D-05): a chat attachment now uploads THREAD-LIFE, so the default fixture is the row
 * the composer actually produces — `expires_at: null`. A TTL row (a workflow template input) is
 * built explicitly where a case needs one.
 */
function file(over: Partial<WorkspaceFile> = {}): WorkspaceFile {
  return {
    id: "wf-1",
    path: "Meridian-Q4-pricing.xlsx",
    size_bytes: 86_016,
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "template_input",
    created_at: new Date(Date.now() - HOUR).toISOString(),
    expires_at: null,
    ...over,
  }
}

const TTL = () => new Date(Date.now() + 23 * HOUR).toISOString()

function moreTriggers(chip: HTMLElement) {
  return chip.querySelectorAll(`button[aria-label="${SAVE_COPY.a.moreLabel}"]`)
}

beforeEach(() => {
  useViewingThread.mockReturnValue("t-1")
  linkState.mockReturnValue({ promotable: true, link: null, leaf: null, path: null })
})

describe("ChatAttachmentChip — pending / sent / expired", () => {
  it("1 — pending, thread-life: name, size, the scope word, NO 24h, a remove control, NO ⋯ (D-07, D-18)", () => {
    // Retired deliberately and rewritten (D-07, Phase 274): a chat attachment lives for its thread,
    // so the chip no longer promises 24h; the TTL word now belongs only to workflow template inputs
    // (pinned by case 4c). The pending chip is the composer's and carries no Library door (D-18).
    render(<ChatAttachmentChip file={file()} state="pending" onRemove={vi.fn()} />)

    const chip = screen.getByTestId("chat-attachment-chip")
    expect(chip.getAttribute("data-chip-state")).toBe("pending")
    expect(chip.textContent).toContain("Meridian-Q4-pricing.xlsx")
    // 86016 B -> "84.0 KB" through the ONE shared formatter (lib/formatBytes).
    expect(chip.textContent).toContain("84.0 KB")

    const scope = chip.querySelector("[data-chip-scope]")
    expect(scope).not.toBeNull()
    expect(scope!.textContent).toContain(COPY.a.chipScope)
    expect(chip.textContent).not.toContain(COPY.a.chipTtl)
    expect(chip.querySelector("[data-chip-expiry]")).toBeNull()

    const remove = chip.querySelector("[data-chip-remove]")
    expect(remove).not.toBeNull()
    expect(remove!.getAttribute("aria-label")).toContain(COPY.a.chipRemove)
    expect(moreTriggers(chip)).toHaveLength(0)
  })

  it("1b — pending: the remove control actually calls back", () => {
    const onRemove = vi.fn()
    render(<ChatAttachmentChip file={file()} state="pending" onRemove={onRemove} />)
    fireEvent.click(screen.getByTestId("chat-attachment-chip").querySelector("[data-chip-remove]")!)
    expect(onRemove).toHaveBeenCalledTimes(1)
  })

  it("2 — ⭐ sent: the SCOPE WORD survives, and there is no remove control (D-244-22)", () => {
    render(<ChatAttachmentChip file={file()} state="sent" />)

    const chip = screen.getByTestId("chat-attachment-chip")
    expect(chip.getAttribute("data-chip-state")).toBe("sent")
    expect(chip.textContent).toContain("Meridian-Q4-pricing.xlsx")

    // THE headline obligation of the phase's winning variant.
    const scope = chip.querySelector("[data-chip-scope]")
    expect(scope).not.toBeNull()
    expect(scope!.textContent).toContain(COPY.a.sentNote)
    expect(COPY.a.sentNote).toBe(COPY.a.chipScope)

    // Read-only in the transcript: nothing to undo. (274-04: the ⋯ is the one action, see 7.)
    expect(chip.querySelector("[data-chip-remove]")).toBeNull()
  })

  it("3 — expired: struck through, `No longer available`, the WHY as its title, and NO ⋯", () => {
    render(<ChatAttachmentChip file={file({ expires_at: new Date(Date.now() - HOUR).toISOString() })} state="sent" />)

    const chip = screen.getByTestId("chat-attachment-chip")
    expect(chip.getAttribute("data-chip-state")).toBe("expired")
    // Asserted on RENDERED TEXT, never on a testid — a presence assertion cannot see content drift.
    expect(chip.textContent).toContain(COPY.shared.expiredChip)
    expect(chip.getAttribute("title")).toBe(COPY.shared.expiredWhy)

    // Not a dead link and not a silent disappearance: the NAME is still there, struck through.
    const name = chip.querySelector("[data-chip-name]")
    expect(name).not.toBeNull()
    expect(name!.textContent).toContain("Meridian-Q4-pricing.xlsx")
    expect(name!.className).toContain("line-through")
    // Nothing to save: the bytes no longer resolve.
    expect(moreTriggers(chip)).toHaveLength(0)
  })

  it("4 — the three readings: ABSENT and UNPARSEABLE are the SAME third case, and neither is amber", () => {
    for (const expires_at of [undefined, "not-a-date"]) {
      const { unmount } = render(<ChatAttachmentChip file={file({ expires_at })} state="pending" />)
      const chip = screen.getByTestId("chat-attachment-chip")

      // NOT expired — an unknown value is not a past one.
      expect(chip.getAttribute("data-chip-state")).toBe("pending")
      expect(chip.textContent).not.toContain(COPY.shared.expiredChip)

      // The reading is the panel's word, mirrored exactly.
      const expiry = chip.querySelector("[data-chip-expiry]")
      expect(expiry).not.toBeNull()
      expect(expiry!.textContent).toBe("expiry unknown")

      // ⛔ never the KNOWN-NONE claim nobody made, and never NaN.
      expect(chip.textContent).not.toContain("no expiry")
      expect(chip.textContent).not.toContain("NaN")

      // ⛔ not amber — unknown is not urgent.
      expect(chip.outerHTML).not.toContain("amber")
      unmount()
    }
  })

  it("4b — a THREAD-LIFE row renders no expiry at all: no 24h, no `expires`, no `expiry unknown` (D-07)", () => {
    // Retired deliberately and rewritten (D-07, Phase 274): this case used to assert the drawn TTL
    // word on the default chat attachment. A chat attachment lives for its thread, so the chip no
    // longer promises 24h; the TTL word now belongs only to workflow template inputs (case 4c).
    for (const state of ["pending", "sent"] as const) {
      const { unmount } = render(<ChatAttachmentChip file={file()} state={state} />)
      const chip = screen.getByTestId("chat-attachment-chip")
      expect(chip.querySelector("[data-chip-expiry]")).toBeNull()
      expect(chip.textContent).not.toContain(COPY.a.chipTtl)
      expect(chip.textContent).not.toContain("expires")
      expect(chip.textContent).not.toContain("expiry unknown")
      unmount()
    }
  })

  it("4c — a TTL row (workflow template input) still renders the drawn TTL word, and a sent one gets the ⋯", () => {
    // The old behaviour stays pinned exactly where it is still TRUE: workflow template inputs expire.
    render(<ChatAttachmentChip file={file({ expires_at: TTL() })} state="sent" />)
    const chip = screen.getByTestId("chat-attachment-chip")
    expect(chip.querySelector("[data-chip-expiry]")!.textContent).toBe(COPY.a.chipTtl)
    expect(moreTriggers(chip)).toHaveLength(1)
  })

  it("5 — copy fence: every ported string is IN the sketch's COPY.js (?raw)", () => {
    // Non-vacuity first: a `?raw` fence that read an empty string would pass everything.
    expect(sketchCopySource.length).toBeGreaterThan(500)
    expect(sketchCopySource).toContain("const COPY = {")

    // key: "value" pairs, so a value that drifted to a different key is caught too.
    const pairs: [string, string][] = [
      ["itemLocal", COPY.a.itemLocal],
      ["itemCloud", COPY.a.itemCloud],
      ["itemConnectors", COPY.a.itemConnectors],
      ["chipScope", COPY.a.chipScope],
      ["chipTtl", COPY.a.chipTtl],
      ["chipRemove", COPY.a.chipRemove],
      ["cloudTitle", COPY.a.cloudTitle],
      ["cloudConfirm", COPY.a.cloudConfirm],
      ["cloudCancel", COPY.a.cloudCancel],
      ["sentNote", COPY.a.sentNote],
      ["composerPlaceholder", COPY.shared.composerPlaceholder],
      ["sendLabel", COPY.shared.sendLabel],
      ["expiredChip", COPY.shared.expiredChip],
      ["expiredWhy", COPY.shared.expiredWhy],
      ["refusalDismiss", COPY.shared.refusalDismiss],
      ["REFUSE_SIZE", COPY.engine.REFUSE_SIZE],
      ["REFUSE_EMPTY", COPY.engine.REFUSE_EMPTY],
    ]
    for (const [key, value] of pairs) {
      expect(sketchCopySource).toContain(`${key}: "${value}"`)
    }

    // The two builders are ported by SHAPE, so a reconstructed server sentence still matches.
    expect(sketchCopySource).toContain("`Unsupported type ${ext || \"(none)\"}. Allowed: ${allowed}`")
    expect(COPY.engine.REFUSE_TYPE(".pdf", ".csv, .docx")).toBe(
      "Unsupported type .pdf. Allowed: .csv, .docx",
    )
    expect(COPY.engine.REFUSE_TYPE("", ".csv")).toContain("(none)")
    expect(sketchCopySource).toContain("agentReadLine: (name) => `Read ${name}`")
    expect(COPY.shared.agentReadLine("a.xlsx")).toBe("Read a.xlsx")

    // ⛔ variant B's arm is recorded in the sketch and NOT ported — it must not leak in here.
    expect(Object.keys(COPY)).not.toContain("b")

    // D-24 (Phase 274): the expired copy no longer claims chat files are kept 24 hours, and the
    // amendment is marked in BOTH homes (the sketch and the port carry the same sentence above).
    expect(COPY.shared.expiredWhy).not.toContain("kept for 24 hours")
    expect(sketchCopySource).toContain("amended by Phase 274 D-24")
  })

  it("5a — no user-visible string is hand-typed into the chip's JSX", () => {
    // ⚠ COMMENTS STRIPPED, and that is the whole point of this case. The chip's docblock EXPLAINS
    // that it holds no copy, and an unstripped `grep` therefore measures the explanation. The
    // first draft of that docblock asserted its own `grep -c ... is 0` while containing the
    // sentence, which made the claim false by stating it. Prose about code is not code.
    const body = code(chipSource)
    expect(body).toContain("export function ChatAttachmentChip") // non-vacuity
    for (const s of [COPY.a.chipScope, COPY.a.sentNote, COPY.a.chipTtl, COPY.shared.expiredChip, COPY.shared.expiredWhy]) {
      expect(body).not.toContain(s)
    }
  })

  it("5b — the allow-list is NOT a fourth hand-typed copy", () => {
    // 244-02 collapsed three copies into `lib/workspaceAllowedExt.ts` with a ?raw lockstep fence
    // against `workspace.py`. The port must CONSUME that constant, never re-list it.
    expect(code(chipSource)).not.toMatch(/"\.docx"/)
    expect(COPY.engine.ALLOWED_EXT).toContain(".pdf")
    expect(COPY.engine.ALLOWED_EXT.length).toBe(16)
  })

  it("6 — the icon is the shipped shared mark, not one invented here", () => {
    // Source fence: the ONE per-extension icon module, and no hand-drawn glyph.
    const body = code(chipSource)
    // Non-vacuity: the stripper must not have eaten the file.
    expect(body).toContain("export function ChatAttachmentChip")
    expect(body).toMatch(/import\s*\{[^}]*\bfileIcon\b[^}]*\}\s*from\s*"@\/lib\/fileIcon"/)
    expect(body).not.toContain("<svg")
    expect(body).not.toContain("dangerouslySetInnerHTML")

    // Rendered: the decorative glyph is present and hidden from the a11y tree.
    render(<ChatAttachmentChip file={file()} state="pending" />)
    const chip = screen.getByTestId("chat-attachment-chip")
    expect(chip.querySelector('[aria-hidden="true"] svg')).not.toBeNull()
    // The name is a TEXT node — React escapes it; a crafted filename cannot become markup.
    expect(chip.querySelector("[data-chip-name]")!.className).toContain("truncate")
  })

  it("7 — sent, thread-life: the prefix-stripped name, size, `this chat only`, no deadline, ONE ⋯ (D-07, D-09, D-27)", () => {
    render(<ChatAttachmentChip file={file({ path: "a1b2c3d4-Meridian-Q4-pricing.xlsx" })} state="sent" />)
    const chip = screen.getByTestId("chat-attachment-chip")
    expect(chip.querySelector("[data-chip-name]")!.textContent).toBe("Meridian-Q4-pricing.xlsx")
    expect(chip.textContent).not.toContain("a1b2c3d4")
    expect(chip.textContent).toContain("84.0 KB")
    expect(chip.querySelector("[data-chip-scope]")!.textContent).toBe(COPY.a.sentNote)
    expect(chip.textContent).not.toContain("24h")
    expect(chip.textContent).not.toContain("expires")
    expect(chip.textContent).not.toContain("expiry unknown")
    const more = moreTriggers(chip)
    expect(more).toHaveLength(1)
    expect(more[0].getAttribute("aria-haspopup")).toBe("menu")
  })

  it("8 — sent with an ABSENT expires_at keeps the honest third reading, and still gets the ⋯", () => {
    render(<ChatAttachmentChip file={file({ expires_at: undefined })} state="sent" />)
    const chip = screen.getByTestId("chat-attachment-chip")
    expect(chip.querySelector("[data-chip-expiry]")!.textContent).toBe("expiry unknown")
    expect(moreTriggers(chip)).toHaveLength(1)
  })

  it("9 — sent + linked: the In Library segment follows the scope word, leaf visible, full path in the title (D-11)", () => {
    linkState.mockReturnValue({
      promotable: true,
      link: {
        document_id: "doc-1",
        outcome: "saved",
        folder_id: "s3",
        document_status: "completed",
        filename: "Meridian-Q4-pricing.xlsx",
      },
      leaf: "Pricing",
      path: "Suppliers › Meridian › Pricing",
    })
    render(<ChatAttachmentChip file={file()} state="sent" />)
    const chip = screen.getByTestId("chat-attachment-chip")
    const seg = chip.querySelector("[data-testid='library-link-segment']") as HTMLElement
    expect(seg).not.toBeNull()
    expect(seg.textContent).toBe(`${SAVE_COPY.shared.inLibrary} · Pricing`)
    expect(seg.getAttribute("title")).toBe("Suppliers › Meridian › Pricing")
    const scope = chip.querySelector("[data-chip-scope]")!
    expect(Boolean(scope.compareDocumentPosition(seg) & Node.DOCUMENT_POSITION_FOLLOWING)).toBe(true)
  })

  it("9b — no viewed thread → no ⋯ (nothing to save into), the chip still renders", () => {
    useViewingThread.mockReturnValue(null)
    render(<ChatAttachmentChip file={file()} state="sent" />)
    const chip = screen.getByTestId("chat-attachment-chip")
    expect(chip.querySelector("[data-chip-scope]")!.textContent).toBe(COPY.a.sentNote)
    expect(moreTriggers(chip)).toHaveLength(0)
  })
})
