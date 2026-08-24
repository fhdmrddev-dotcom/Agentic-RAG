/**
 * Phase 155 Plan 06 Task 1 — Run modal a11y contract (152 surface, WCAG 2.1 AA / D-01).
 *
 * The net-new 152 Run modal + its two run inputs (staged template File + KB-scope
 * override) + the victim-naming workflow-delete confirm are the D-12 inventory's
 * workflow cluster. This suite locks the D-01 zero-STRUCTURAL-violations bar AND
 * asserts the ROLES/NAMES the D-09 scenario-1 keyboard drive depends on so the
 * live operator walkthrough can succeed:
 *
 *   - the file input is the CLASSIC keyboard-trap spot (D-09): the hidden
 *     `<input type="file">` carries `aria-label="Upload template file"` +
 *     `tabIndex={-1}` (Tab passes THROUGH it — not a trap) and a visible proxy
 *     `<button>` with an accessible name does the interaction;
 *   - the remove-template ✕ has `aria-label="Remove template"`;
 *   - the KB-folder scope control is reachable by role + accessible name;
 *   - the launch/upload error renders as `role="alert"`;
 *   - the workflow-delete confirm Sheet is `role="dialog"` with an accessible name
 *     + a named "Delete forever" confirm (never colour-alone).
 *
 * VERIFY (do NOT rebuild) the shipped accessible-hidden-input + proxy-button
 * pattern. STRUCTURAL axe rules only (jsdom cannot compute colour-contrast — that
 * half is the live Chrome scan in 155-VALIDATION.md). No component source is
 * modified (test-only). The Radix Sheet portal OPEN state is asserted by role/name
 * (the 155-05 convention), not axe-scanned.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, within, fireEvent, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"

const {
  mockListPublished,
  mockListDrafts,
  mockCreateDraft,
  mockGenerate,
  mockUpdate,
  mockPublish,
  mockListFolders,
  mockListSkills,
  mockListStarters,
  mockPreview,
  mockDelete,
} = vi.hoisted(() => ({
  mockListPublished: vi.fn(),
  mockListDrafts: vi.fn(),
  mockCreateDraft: vi.fn(),
  mockGenerate: vi.fn(),
  mockUpdate: vi.fn(),
  mockPublish: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockListStarters: vi.fn(),
  mockPreview: vi.fn(),
  mockDelete: vi.fn(),
}))

// Mock the api seam (the RunModal.test harness set + the 152-04 delete clients so
// the workflow-delete confirm renders its terminal "Delete forever" control).
vi.mock("@/lib/api", () => ({
  listPublishedWorkflows: mockListPublished,
  listDraftWorkflows: mockListDrafts,
  createWorkflowDraft: mockCreateDraft,
  generateWorkflow: mockGenerate,
  updateWorkflowDraft: mockUpdate,
  publishWorkflow: mockPublish,
  listFolders: mockListFolders,
  listSkills: mockListSkills,
  listStarterWorkflows: mockListStarters,
  getWorkflowDeletePreview: mockPreview,
  deleteWorkflowCascade: mockDelete,
}))

import { WorkflowsPage } from "../WorkflowsPage"
import type { Folder } from "@/types"

/** The bound author default (folder-aaa) + a distinct override target (folder-bbb)
 *  so the KB-scope <select> renders with a real override option. */
const folders: Folder[] = [
  { id: "folder-aaa", user_id: "u1", name: "DBA Chapters", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
  { id: "folder-bbb", user_id: "u1", name: "Contracts", parent_id: null, is_org_shared: false, created_at: "", updated_at: "" },
]

const boundPublished = {
  id: "pub-1",
  slug: "vendor-risk",
  name: "Vendor-risk review",
  definition: {
    slug: "vendor-risk",
    version: 2,
    project_folder_id: "folder-aaa",
    inputs: [{ key: "kickoff_prompt" }],
    phases: [{ slug: "emit", phase_index: 0, config: { phase_type: "llm_emit", citation_policy: "draft" } }],
  },
}

beforeEach(() => {
  vi.clearAllMocks()
  // Radix DropdownMenu / Sheet use pointer-capture + scrollIntoView APIs jsdom does
  // not implement; stub them so the ⋯-menu opens under user-event (the standard shim).
  if (!Element.prototype.hasPointerCapture) Element.prototype.hasPointerCapture = () => false
  if (!Element.prototype.setPointerCapture) Element.prototype.setPointerCapture = () => {}
  if (!Element.prototype.releasePointerCapture) Element.prototype.releasePointerCapture = () => {}
  if (!Element.prototype.scrollIntoView) Element.prototype.scrollIntoView = () => {}
  mockListPublished.mockResolvedValue([boundPublished])
  mockListDrafts.mockResolvedValue([])
  mockListStarters.mockResolvedValue([])
  mockListFolders.mockResolvedValue(folders)
  mockListSkills.mockResolvedValue([])
})

afterEach(() => {
  cleanup()
})

/** Render the page + open the Run modal off the first published card. */
async function openRunModal(onLaunch = vi.fn().mockResolvedValue(undefined)) {
  render(<WorkflowsPage folders={folders} onLaunch={onLaunch} />)
  const cards = await screen.findAllByTestId("published-card")
  fireEvent.click(within(cards[0]).getByTestId("published-run"))
  const modal = await screen.findByTestId("run-modal")
  return { modal, onLaunch }
}

describe("RunModal a11y — WCAG 2.1 AA (structural) across honest states", () => {
  it("no aXe structural violations — the open Run modal (idle)", async () => {
    const { modal } = await openRunModal()
    expect(await axe(modal)).toHaveNoViolations()
  })

  it("no aXe structural violations — a template File staged (the file-card + remove ✕)", async () => {
    const { modal } = await openRunModal()
    const file = new File(["stub"], "template.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    })
    fireEvent.change(within(modal).getByLabelText("Upload template file"), { target: { files: [file] } })
    await within(modal).findByTestId("run-template-file")
    expect(await axe(modal)).toHaveNoViolations()
  })
})

describe("RunModal a11y — D-09 scenario-1 file-input trap-spot contract", () => {
  it("the hidden file input is Tab-THROUGH (tabIndex=-1 + aria-label), never a trap", async () => {
    const { modal } = await openRunModal()
    // The hidden input is queryable by its accessible name (the a11y tree carries it),
    // but tabIndex=-1 means keyboard Tab passes THROUGH it — the classic file-input
    // trap is avoided by construction.
    const input = within(modal).getByLabelText("Upload template file") as HTMLInputElement
    expect(input.tagName).toBe("INPUT")
    expect(input.getAttribute("type")).toBe("file")
    expect(input.getAttribute("tabindex")).toBe("-1")
    expect(input.className).toContain("hidden")
  })

  it("a visible proxy <button> with an accessible name drives the upload (not the hidden input)", async () => {
    const { modal } = await openRunModal()
    const proxy = within(modal).getByTestId("run-template-upload")
    expect(proxy.tagName).toBe("BUTTON")
    // The proxy button carries its own accessible name (the visible "Upload template").
    expect(proxy).toHaveAccessibleName(/upload template/i)
  })

  it("the remove-template control carries aria-label='Remove template'", async () => {
    const { modal } = await openRunModal()
    const file = new File(["stub"], "template.docx", { type: "text/plain" })
    fireEvent.change(within(modal).getByLabelText("Upload template file"), { target: { files: [file] } })
    await within(modal).findByTestId("run-template-file")
    expect(within(modal).getByRole("button", { name: "Remove template" })).toBeInTheDocument()
  })
})

describe("RunModal a11y — KB-scope control + launch error roles/names", () => {
  it("the KB-folder scope control is reachable by role + accessible name", async () => {
    const { modal } = await openRunModal()
    // A native <select> wrapped by its <label> → role=combobox, named "Knowledge base:".
    const scope = within(modal).getByRole("combobox", { name: /knowledge base/i }) as HTMLSelectElement
    expect(scope.tagName).toBe("SELECT")
    // The override option is reachable by role+name inside the control.
    expect(within(scope).getByRole("option", { name: /Contracts/i })).toBeInTheDocument()
  })

  it("a launch failure surfaces the server message VERBATIM as role='alert'", async () => {
    const onLaunch = vi.fn().mockRejectedValue(new Error("Template too large — 25 MB max"))
    const { modal } = await openRunModal(onLaunch)
    fireEvent.change(within(modal).getByTestId("run-kickoff"), { target: { value: "go" } })
    fireEvent.click(within(modal).getByTestId("run-confirm"))
    const alert = await within(modal).findByRole("alert")
    expect(alert).toHaveTextContent("Template too large — 25 MB max")
    // Still zero structural violations with the error surfaced.
    expect(await axe(modal)).toHaveNoViolations()
  })
})

describe("RunModal a11y — workflow-delete confirm (152 WFIN-03) role/name/confirm", () => {
  it("⋯ → Delete opens a role=dialog with an accessible name + a NAMED confirm button", async () => {
    mockPreview.mockResolvedValue({
      name: "Vendor-risk review",
      versions: 2,
      runs: 5,
      threads: 3,
      in_flight: 0,
    })
    const user = userEvent.setup()
    render(<WorkflowsPage folders={folders} onLaunch={vi.fn().mockResolvedValue(undefined)} />)
    const cards = await screen.findAllByTestId("published-card")
    await user.click(within(cards[0]).getByRole("button", { name: /workflow actions/i }))
    await user.click(await screen.findByTestId("published-delete"))

    // The Radix Sheet portals OPEN as role=dialog, named by its SheetTitle.
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveAccessibleName(/delete this workflow\?/i)

    // The single destructive-weighted control is NAMED (never colour-alone) — the
    // word "Delete forever" carries the action, not the red styling.
    const confirm = await within(dialog).findByTestId("delete-forever")
    expect(confirm).toHaveAccessibleName(/delete forever/i)
    // The cancel-first choice is likewise a named control.
    expect(within(dialog).getByRole("button", { name: /keep it/i })).toBeInTheDocument()
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 192-03 Task 2 (D-01) — THE PRE-MOVE FOCUS / DIALOG CONTRACT.
//
// Appended at the foot of the file as a pure insertion; nothing above was edited.
//
// ⚠ THIS BLOCK IS A DIFFERENT KIND OF EVIDENCE FROM THE `innerHTML` CAPTURES IN
// `RunModal.test.tsx`, AND CONFLATING THE TWO IS HOW A REVIEWER ENDS UP
// RE-CAPTURING A BASELINE TO MAKE A RED TEST GREEN. The two answer different
// questions:
//
//   · A CAPTURE answers "does it still render what it rendered?" Its literal was
//     read out of the DOM, it is not an expectation, and a diff against it after
//     the move is a behaviour change to EXPLAIN — never a test to update.
//   · THESE ARE BEHAVIOURAL ASSERTIONS — a CONTRACT, stated in advance and on
//     purpose. They say what the dialog must DO, not what it happens to look
//     like, and they are exactly the things an `innerHTML` capture cannot see:
//     where focus lands, what a key does, and whether Tab escapes.
//
// WHY THE CONTRACT NEEDS ITS OWN GUARD. D-01 calls the RunModal a VERBATIM move.
// The modal's focus behaviour is a DELIBERATE minimal trap that the shipped source
// justifies in its own words (`WorkflowsPage.tsx:1190-1192`): "a lightweight focus
// contract for the aria-modal dialog — Escape-to-close, initial focus on the
// textarea, and Tab containment within the dialog (a minimal trap, no heavy dep /
// no shadcn Dialog rewrite)". A move that swapped it for a shadcn `Dialog` would
// keep every `data-testid` and could even keep most of the markup, so the captures
// would not necessarily notice — but it would not be a verbatim move. This block
// is what makes that substitution loud.
//
// PROOF THAT THIS PREDATES THE MOVE — the 188.2 method, recorded so it can be
// re-run rather than believed (full verbatim output in 192-03-SUMMARY.md):
//
//     $ git rev-parse HEAD
//     14b309b4bd3b04ad5718caa821c24ddb613e2d3f
//     $ git show HEAD:frontend/src/components/workflows/library/RunModal.tsx
//     fatal: path 'frontend/src/components/workflows/library/RunModal.tsx' does not
//       exist in 'HEAD'                                                    [exit 128]
//
// This plan modifies NO source file — only this file and `RunModal.test.tsx`.
// ═══════════════════════════════════════════════════════════════════════════════

/** The commit the contract below was pinned at, and at which the destination module
 *  provably does not exist. Kept beside the assertions so the two travel together. */
const CAPTURE_SHA = "14b309b4bd3b04ad5718caa821c24ddb613e2d3f"

/**
 * The focusable-element selector the shipped Tab handler uses, VERBATIM
 * (`WorkflowsPage.tsx:1212-1214`). Copied rather than approximated: a test that
 * computed "the focusables" its own way would be asserting containment over a
 * different set than the one the handler actually cycles, and would stay green
 * through a change to either.
 */
const SHIPPED_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input, textarea, select, [tabindex]:not([tabindex="-1"])'

/**
 * `waitFor`, reached by dynamic import rather than by widening this file's existing RTL
 * import line at `:27`. That keeps this block a PURE insertion — `git diff` shows one
 * contiguous addition and not one line above it touched — using the same
 * `await import(…)`-inside-a-test idiom the repo already ships at
 * `WorkflowBuilderPage.canvas.test.tsx:656`. Vite caches the module, so this is a map
 * lookup after the first call, not a second load.
 */
async function waitForRTL() {
  return (await import("@testing-library/react")).waitFor
}

describe("RunModal 192-03 — the pre-move dialog + focus CONTRACT (behaviour, not a capture)", () => {
  it("the capture commit is recorded and is a full SHA", () => {
    expect(CAPTURE_SHA).toMatch(/^[0-9a-f]{40}$/)
  })

  it("the modal root is a role=dialog with aria-modal and an accessible name", async () => {
    const { modal } = await openRunModal()
    // Named by the workflow it is about to run — `aria-label={`Run ${wf.name}`}`.
    expect(modal.getAttribute("role")).toBe("dialog")
    expect(modal.getAttribute("aria-modal")).toBe("true")
    expect(modal).toHaveAccessibleName("Run Vendor-risk review")
  })

  it("initial focus lands INSIDE the dialog, on the kickoff textarea", async () => {
    const { modal } = await openRunModal()
    const kickoff = within(modal).getByTestId("run-kickoff")
    expect(document.activeElement).toBe(kickoff)
    // …and the focused element really is inside the dialog, so a future change that
    // moved the textarea out of the modal could not satisfy this by identity alone.
    expect(modal.contains(document.activeElement)).toBe(true)
  })

  it("Escape closes the dialog", async () => {
    const waitFor = await waitForRTL()
    await openRunModal()
    expect(screen.getByTestId("run-modal")).toBeInTheDocument()
    fireEvent.keyDown(document, { key: "Escape" })
    await waitFor(() => expect(screen.queryByTestId("run-modal")).not.toBeInTheDocument())
  })

  it("POSITIVE CONTROL — Escape does NOT close mid-launch (one click = one run)", async () => {
    // Without this, "Escape closes" is satisfied by a handler that closes unconditionally:
    // a person could dismiss the modal while a launch was already in flight.
    //
    // ⚠ MEASURED, NOT ASSUMED — WHAT THIS ROW ACTUALLY GUARDS. The mid-launch dismissal
    // refusal is a DOUBLE guard, and only the OUTER half is observable from a live-page
    // drive. Driven RED against real plants at `CAPTURE_SHA`:
    //   · deleting the MODAL's own `if (!submitting)` (`WorkflowsPage.tsx:1205`) alone left
    //     this row GREEN — the page's `onCancel` (`:648-651`, `if (runSubmitting) return`)
    //     still refuses;
    //   · deleting BOTH turned it RED.
    // So this row pins the OBSERVABLE behaviour (Escape cannot dismiss a run in flight) and
    // NOT the modal's own inner guard in isolation. Stated here rather than left implied,
    // because the D-01 move takes the modal and LEAVES `onCancel` on the page: a move that
    // dropped the inner guard would not be caught by this assertion, and a later reader must
    // not inherit the belief that it would. The three focus rows below, and "Escape closes"
    // above, were each driven RED against their own plant and DO isolate the modal.
    const waitFor = await waitForRTL()
    const pending = vi.fn().mockReturnValue(new Promise<void>(() => {}))
    const { modal } = await openRunModal(pending)
    fireEvent.click(within(modal).getByTestId("run-confirm"))
    await waitFor(() =>
      expect(within(modal).getByTestId("run-confirm")).toHaveTextContent("Running…"),
    )
    fireEvent.keyDown(document, { key: "Escape" })
    // Still open — the in-flight guard held.
    expect(screen.getByTestId("run-modal")).toBeInTheDocument()
  })

  it("Tab from the LAST focusable returns into the dialog rather than leaving it", async () => {
    const { modal } = await openRunModal()
    const focusables = Array.from(
      modal.querySelectorAll<HTMLElement>(SHIPPED_FOCUSABLE_SELECTOR),
    )
    // NON-VACUITY: an empty node list would make every containment claim below trivially
    // true, and the shipped handler itself early-returns on it.
    expect(focusables.length).toBeGreaterThan(1)
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    // The shipped order, pinned: the header ✕ opens the cycle and the "▶ Run workflow"
    // button closes it.
    //
    // ⚠ RE-BASELINED BY THE SKETCH-200 PORT (2026-08-20), AND THE PREVIOUS VALUE IS KEPT
    // HERE RATHER THAN OVERWRITTEN: the first focusable used to be `run-scope-select`,
    // because the dialog had NO visible dismiss control at all. Sketch 200's `run-dialog`
    // draws one in the header, and adding it necessarily makes it first in DOM order —
    // which is also the right place for it, since a dismiss should be reachable in one Tab
    // rather than after every field. The LAST focusable is unchanged, which is the half
    // that matters most: the cycle still ENDS on the committing control.
    //
    // ⚠ The scope `<select>` is still IN the cycle and still second — this is a re-baseline
    // of an ORDER, never a narrowing of the containment claim. `focusables.length > 1`
    // above is the non-vacuity guard that keeps it falsifiable.
    expect(first).toBe(within(modal).getByTestId("run-modal-close"))
    expect(focusables[1]).toBe(within(modal).getByTestId("run-scope-select"))
    expect(last).toBe(within(modal).getByTestId("run-confirm"))

    last.focus()
    expect(document.activeElement).toBe(last)
    fireEvent.keyDown(document, { key: "Tab" })
    // Wrapped to the FIRST focusable — focus never left the dialog.
    expect(document.activeElement).toBe(first)
    expect(modal.contains(document.activeElement)).toBe(true)
  })

  it("Shift+Tab from the FIRST focusable wraps backwards — the other half of the trap", async () => {
    const { modal } = await openRunModal()
    const focusables = Array.from(
      modal.querySelectorAll<HTMLElement>(SHIPPED_FOCUSABLE_SELECTOR),
    )
    expect(focusables.length).toBeGreaterThan(1)
    const first = focusables[0]
    const last = focusables[focusables.length - 1]
    first.focus()
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(last)
    expect(modal.contains(document.activeElement)).toBe(true)
  })

  it("POSITIVE CONTROL — a Tab from the MIDDLE is left alone (a trap, not a hijack)", async () => {
    // The three assertions above are also satisfied by a handler that forces focus to a
    // fixed element on every Tab. The contract is containment at the EDGES only; in the
    // middle the browser's own tab order must be left to do its job.
    const { modal } = await openRunModal()
    const focusables = Array.from(
      modal.querySelectorAll<HTMLElement>(SHIPPED_FOCUSABLE_SELECTOR),
    )
    expect(focusables.length).toBeGreaterThan(2)
    const middle = focusables[1]
    middle.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    // Untouched: the handler did not preventDefault and did not move focus itself.
    expect(document.activeElement).toBe(middle)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Plan 193-07 Task 3 (AUTH-03 / D-18) — THE NEW LABEL IS A TEXT NODE, NOT A BINDING.
//
// Appended as a PURE INSERTION: nothing above was edited, renamed or re-described, and
// no import line was widened.
//
// ⚠ WHY THIS NEEDS A GUARD AT ALL. D-18 adds the words `Template to fill` above the
// upload control, and the obvious HTML for "words that name a form control" is a
// `<label htmlFor>`. Here that would be a REGRESSION, not good practice: the control it
// would name is `className="hidden" tabIndex={-1}` (the shipped accessible-hidden-input
// + visible-proxy-button pattern this file already pins at `:141-169`). A label bound to
// a control that cannot be focused is a promise the DOM does not keep — clicking the
// label would open the OS file dialog with no visible focus change, and assistive tech
// would be told a hidden control is the labelled one. The real interactive element is
// the proxy `<button>`, which carries its own accessible name.
//
// So the label must be inert: a text node with no `for` binding, adding nothing to the
// focus order the four rows above pin. That is a constraint on HOW the words are
// rendered, invisible to every `innerHTML` capture in `RunModal.test.tsx` (a capture
// records the tag it found — it does not object to it), which is why it lives here.
//
// Driven RED against a real `<label htmlFor>` plant in
// `components/workflows/library/RunModal.tsx`, then restored md5-identical; the observed
// failure is recorded in 193-07-SUMMARY.md rather than asserted here.
// ═══════════════════════════════════════════════════════════════════════════════

describe("RunModal 193-07 a11y — D-18's label is inert (a text node, never a binding)", () => {
  it("run-template-label is NOT a <label>, and carries no for/htmlFor binding", async () => {
    const { modal } = await openRunModal()
    const label = within(modal).getByTestId("run-template-label")

    // NON-VACUITY: the node exists and carries the words. `boundPublished` declares an
    // `llm_emit` phase with no `emitter` key, so it ADMITS (D-25) and the block renders.
    expect(label).toHaveTextContent("Template to fill")

    // The tag itself. `<p>` today; the assertion is on what it must NOT be, so a future
    // `<span>`/`<div>` is fine and a `<label>` is not.
    expect(label.tagName).not.toBe("LABEL")
    expect(label.hasAttribute("for")).toBe(false)
    expect(label.hasAttribute("htmlFor")).toBe(false)
  })

  it("NOTHING in the dialog binds a label to the hidden file input", async () => {
    const { modal } = await openRunModal()
    const input = within(modal).getByLabelText("Upload template file") as HTMLInputElement

    // The shipped pattern, re-stated as the precondition it is: the input is hidden and
    // out of the tab order, which is exactly why binding a label to it would be wrong.
    expect(input.getAttribute("tabindex")).toBe("-1")
    expect(input.className).toContain("hidden")

    // POSITIVE CONTROL for the query below — the dialog genuinely DOES contain `<label>`
    // elements (the KB-scope and kickoff fields, which WRAP their controls rather than
    // binding by id). Without this, `querySelectorAll("label[for]") === 0` would also be
    // satisfied by a dialog that rendered no labels at all, or by a broken query.
    expect(modal.querySelectorAll("label").length).toBeGreaterThan(0)

    // No id-binding of any kind exists in this dialog, so none can point at the input.
    expect(modal.querySelectorAll("label[for]").length).toBe(0)
    // …and the input offers nothing to bind TO, which is the other half of the same claim:
    // an id added here later is the first step toward the regression this row forbids.
    expect(input.hasAttribute("id")).toBe(false)
  })

  it("the new label changed NOTHING about the focus order", async () => {
    const { modal } = await openRunModal()
    const focusables = Array.from(
      modal.querySelectorAll<HTMLElement>(SHIPPED_FOCUSABLE_SELECTOR),
    )
    expect(focusables.length).toBeGreaterThan(1)

    // The same shipped cycle the 192-03 contract above pins: the header ✕ opens it and the
    // "▶ Run workflow" button closes it. A label that had become focusable — or a binding
    // that pulled the hidden input into the cycle — would move one of these.
    //
    // ⚠ RE-BASELINED BY THE SKETCH-200 PORT for the reason written out at the sibling
    // assertion above; the previous first was `run-scope-select`, before the dialog had a
    // visible dismiss. The scope `<select>` is asserted STILL PRESENT and STILL SECOND, so
    // this remains a claim about ORDER and not a weaker claim about membership.
    expect(focusables[0]).toBe(within(modal).getByTestId("run-modal-close"))
    expect(focusables[1]).toBe(within(modal).getByTestId("run-scope-select"))
    expect(focusables[focusables.length - 1]).toBe(within(modal).getByTestId("run-confirm"))

    // The label itself is not in the cycle at all.
    const label = within(modal).getByTestId("run-template-label")
    expect(focusables).not.toContain(label)
    expect(label.hasAttribute("tabindex")).toBe(false)
  })

  it("no aXe structural violations with the labelled control rendered", async () => {
    const { modal } = await openRunModal()
    within(modal).getByTestId("run-template-label")
    expect(await axe(modal)).toHaveNoViolations()
  })
})
