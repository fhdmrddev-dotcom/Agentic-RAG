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
import { describe, it, expect, vi } from "vitest"
import { ChatAttachmentChip } from "../ChatAttachmentChip"
import { COPY } from "../composerCopy"
import type { WorkspaceFile } from "@/types"

// The sketch's own copy object, read as SOURCE. The build ports this file; this import is what
// makes "ported, not re-typed" checkable rather than a promise in a docblock.
import sketchCopySource from "../../../../../.planning/sketches/236-the-file-that-belongs-to-this-chat/COPY.js?raw"
// The chip's own source — Test 6 asserts the ICON comes from the shipped shared vocabulary
// (`@/lib/fileIcon`) rather than from a mark invented here (icon-convention.md §"What to avoid").
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

function file(over: Partial<WorkspaceFile> = {}): WorkspaceFile {
  return {
    id: "wf-1",
    path: "Meridian-Q4-pricing.xlsx",
    size_bytes: 86_016,
    mime_type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    kind: "template_input",
    created_at: new Date(Date.now() - HOUR).toISOString(),
    expires_at: new Date(Date.now() + 23 * HOUR).toISOString(),
    ...over,
  }
}

describe("ChatAttachmentChip — pending / sent / expired", () => {
  it("1 — pending: name, size, the scope word, the TTL and a remove control", () => {
    render(<ChatAttachmentChip file={file()} state="pending" onRemove={vi.fn()} />)

    const chip = screen.getByTestId("chat-attachment-chip")
    expect(chip.getAttribute("data-chip-state")).toBe("pending")
    expect(chip.textContent).toContain("Meridian-Q4-pricing.xlsx")
    // 86016 B -> "84.0 KB" through the ONE shared formatter (lib/formatBytes).
    expect(chip.textContent).toContain("84.0 KB")

    const scope = chip.querySelector("[data-chip-scope]")
    expect(scope).not.toBeNull()
    expect(scope!.textContent).toContain(COPY.a.chipScope)
    expect(chip.textContent).toContain(COPY.a.chipTtl)

    const remove = chip.querySelector("[data-chip-remove]")
    expect(remove).not.toBeNull()
    expect(remove!.getAttribute("aria-label")).toContain(COPY.a.chipRemove)
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

    // Read-only in the transcript: nothing to click, nothing to undo.
    expect(chip.querySelector("[data-chip-remove]")).toBeNull()
  })

  it("3 — expired: struck through, `No longer available`, and the WHY as its title", () => {
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

  it("4b — a KNOWN-FUTURE expiry renders the drawn TTL word, not a countdown", () => {
    render(<ChatAttachmentChip file={file()} state="pending" />)
    const expiry = screen.getByTestId("chat-attachment-chip").querySelector("[data-chip-expiry]")
    expect(expiry!.textContent).toBe(COPY.a.chipTtl)
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
})
