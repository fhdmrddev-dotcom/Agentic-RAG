/**
 * Phase 187-05 — THE FIRST PIN THE BUILDER'S DESCRIBE SCREEN HAS EVER HAD.
 *
 * WHY THIS FILE EXISTS. `describeScreen` (`WorkflowBuilderPage.tsx:1403-1495`) is built on
 * BOTH flag branches — only the `BuilderHeaderBar` wrapper at `:1483-1493` is
 * flag-dependent. So anything added to the describe screen ships with
 * `visual_workflow_canvas` OFF unless it is explicitly `canvasEnabled`-gated, and until
 * this file NO SHIPPED TEST WOULD CATCH IT: `WorkflowBuilderPage.header.test.tsx` pins the
 * three header bands and nothing below them, and `WorkflowBuilderPage.canvas.test.tsx`
 * pins flag-off BEHAVIOURS on the DRAFTED view, which the describe screen never reaches.
 * D-181-01's promise is byte-identity for everyone, operators included; a regression here
 * would have shipped green.
 *
 * IT IS WRITTEN BEFORE THE TEMPLATE DOOR, ON PURPOSE. Phase 187 Req 6 adds a template
 * picker plus "one quiet line" to exactly this screen (plans 187-14 / 187-13 / 187-15).
 * Captured afterwards, a pin would only prove the new shape; captured here, against the
 * UNMODIFIED page in wave 1, its later failure means one specific thing — THE TEMPLATE
 * DOOR LEAKED FLAG-OFF. That is the discipline the shipped header pin states in its own
 * docblock, applied to the surface the next three plans are about to touch.
 *
 * ── WHAT IS PINNED, AND WHY THAT REGION ────────────────────────────────────────────
 *
 * The CTA region: the flex column at `WorkflowBuilderPage.tsx:1450-1465` holding the
 * `Draft the workflow` button and the `describe-hint` line beneath it. That is where the
 * door lands, so that is where the pin sits. It is resolved by WALKING UP from the
 * `describe-hint` node rather than by a CSS class — a class-based selector would silently
 * start matching a different node after a Tailwind edit, and a pin that quietly moved to
 * another element is worse than no pin.
 *
 * ── THE OUTERHTML LITERAL ──────────────────────────────────────────────────────────
 *
 * ONE normalised literal, asserted for the absent-key map, and then the operator-like map
 * is asserted to produce the IDENTICAL string. That is the D-181-01 sentence stated as an
 * equality rather than as a second copied literal that could drift from the first. It is
 * deliberately verbatim rather than a shape assertion: the promise D-181-01 makes is about
 * the markup a shipped user receives, and a "looks about right" matcher cannot break when
 * a wrapper is introduced or a line is added.
 *
 * A THIRD, FORMATTING-INDEPENDENT GUARD rides alongside it, because the literal is the
 * strict half and a strict half alone tempts a re-capture: the region's text must not
 * mention a template or a starter. A whitespace change churns the literal; only a real
 * door trips the negative guard.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor } from "@testing-library/react"

// The whole api surface the page reaches, enumerated exactly as the header pin enumerates
// it. A factory mock that omits one symbol hands back `undefined` and the failure surfaces
// far from its cause — the enumeration discipline `WorkflowBuilderPage.session.test.tsx`
// states and follows.
const {
  mockGenerate,
  mockCreate,
  mockUpdate,
  mockListFolders,
  mockListSkills,
  mockValidate,
  mockBundle,
  mockPublish,
  mockListPublished,
  mockListStarters,
  mockListDrafts,
  mockDeletePreview,
  mockDeleteCascade,
} = vi.hoisted(() => ({
  mockGenerate: vi.fn(),
  mockCreate: vi.fn(),
  mockUpdate: vi.fn(),
  mockListFolders: vi.fn(),
  mockListSkills: vi.fn(),
  mockValidate: vi.fn(),
  mockBundle: vi.fn(),
  mockPublish: vi.fn(),
  mockListPublished: vi.fn(),
  mockListStarters: vi.fn(),
  mockListDrafts: vi.fn(),
  mockDeletePreview: vi.fn(),
  mockDeleteCascade: vi.fn(),
}))

vi.mock("@/lib/api", () => {
  class WorkflowConflictError extends Error {
    constructor(message = "workflow is published and cannot be modified") {
      super(message)
      this.name = "WorkflowConflictError"
    }
  }
  class WorkflowNotFoundError extends Error {
    constructor(message = "workflow not found") {
      super(message)
      this.name = "WorkflowNotFoundError"
    }
  }
  return {
    generateWorkflow: mockGenerate,
    createWorkflowDraft: mockCreate,
    updateWorkflowDraft: mockUpdate,
    listFolders: mockListFolders,
    listSkills: mockListSkills,
    validateWorkflow: mockValidate,
    getGroundingBundle: mockBundle,
    publishWorkflow: mockPublish,
    listPublishedWorkflows: mockListPublished,
    listStarterWorkflows: mockListStarters,
    listDraftWorkflows: mockListDrafts,
    getWorkflowDeletePreview: mockDeletePreview,
    deleteWorkflowCascade: mockDeleteCascade,
    WorkflowConflictError,
    WorkflowNotFoundError,
  }
})

import { WorkflowBuilderPage } from "./WorkflowBuilderPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import type { EffectiveFeatures } from "@/lib/api"

/** The canvas flag is OFF in every one of these. Three ways of being off, because
 *  D-181-01 is a statement about all of them and "operators too" is the one that a
 *  careless gate breaks first. Carried across from the header pin verbatim so the two
 *  files cannot disagree about what "off" means. */
const OFF_VARIANTS: Array<{ name: string; value: { features: EffectiveFeatures; loading: boolean } | null }> = [
  { name: "an ABSENT canvas key", value: { features: {}, loading: false } },
  { name: "an EXPLICIT false", value: { features: { visual_workflow_canvas: false }, loading: false } },
  {
    name: "an OPERATOR-LIKE map (every other governed key true, canvas absent)",
    value: {
      features: {
        skill_studio: true,
        model_management: true,
        workflow_authoring: true,
        governance_health: true,
      },
      loading: false,
    },
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockListFolders.mockResolvedValue([])
  mockListSkills.mockResolvedValue([])
  mockListPublished.mockResolvedValue([])
  mockListStarters.mockResolvedValue([])
  mockListDrafts.mockResolvedValue([])
  mockBundle.mockResolvedValue({ tools: [], folders: [], skills: [], degraded: [] })
  mockValidate.mockResolvedValue({ ok: true, verdicts: [] })
  // The ⌥ Technical-names reveal persists; a leaked value would change what the page
  // renders under us and, with it, the pinned markup.
  window.localStorage.clear()
})

afterEach(() => {
  cleanup()
})

/**
 * Mount the Builder with NO `initial`, so the store boots `builderPhase === "empty"` and
 * the page settles on the describe screen — the FRESH-BUILD route, which is the only one
 * that shows this surface.
 *
 * The two mount fetches (`listFolders` → `listSkills`, one `useEffect` at `:1107-1133`)
 * are awaited before anything is captured: an unsettled render would bake a loading shape
 * into the pin, and a `setState` landing after the assertion is an act warning at best and
 * a flake at worst.
 */
async function renderDescribeScreen(
  value: { features: EffectiveFeatures; loading: boolean } | null,
) {
  const page = (
    <div style={{ width: 1200, height: 800 }}>
      <WorkflowBuilderPage />
    </div>
  )
  const utils = render(
    value ? (
      <EffectiveFeaturesProvider value={{ ...value, refetch: vi.fn() }}>{page}</EffectiveFeaturesProvider>
    ) : (
      page
    ),
  )
  await screen.findByTestId("describe-hint")
  // Both fetches ISSUED (they are sequential awaits in one effect, so the second having
  // been called proves the first already resolved and its state landed)…
  await waitFor(() => expect(mockListSkills).toHaveBeenCalled())
  // …and one more act-wrapped tick so the second one's `setState` lands too.
  await waitFor(() => expect(screen.getByTestId("describe-hint")).toBeInTheDocument())
  return utils
}

/** Collapse whitespace runs so the literal is diffable and indentation-independent. */
const normalise = (html: string) => html.replace(/\s+/g, " ").trim()

/**
 * The region the template door lands in: the flex column holding the CTA button and the
 * `describe-hint` line (`WorkflowBuilderPage.tsx:1450-1465`).
 *
 * Resolved by WALKING UP from the hint node, never by a class selector — see the docblock.
 * The walk is asserted to have actually found the CTA, so a re-parenting that moved the
 * hint away from the button fails loudly here rather than silently pinning a smaller box.
 */
function ctaRegion(): Element {
  const hint = screen.getByTestId("describe-hint")
  const region = hint.parentElement
  expect(region).not.toBeNull()
  expect(region!.contains(screen.getByRole("button", { name: "Draft the workflow" }))).toBe(true)
  return region!
}

/** That region's `outerHTML`, normalised — the one string every pin below compares. */
function describeRegion(): string {
  return normalise(ctaRegion().outerHTML)
}

// ── THE HARNESS ITSELF: a flag-off describe screen that settles deterministically ──

describe("Builder describe screen, canvas flag OFF — the surface is reachable and settled", () => {
  for (const variant of OFF_VARIANTS) {
    it(`${variant.name} renders the describe screen with its CTA region addressable`, async () => {
      await renderDescribeScreen(variant.value)

      // The screen itself: the prompt, the box, the CTA, the hint.
      expect(screen.getByRole("heading", { name: "What recurring work should this automate?" })).toBeInTheDocument()
      expect(screen.getByLabelText("business requirement")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: "Draft the workflow" })).toBeInTheDocument()

      // …and the region the door lands in resolves by walking up from the hint, and
      // reads as one addressable string.
      expect(ctaRegion().contains(screen.getByTestId("describe-hint"))).toBe(true)
      expect(describeRegion()).toContain("Draft the workflow")
      // No flag-on chrome leaked in: the merged header bar is gated on `canvasEnabled`.
      expect(screen.queryByTestId("builder-header-bar")).toBeNull()
    })
  }

  it("NO PROVIDER at all is fail-closed and reaches the same surface", async () => {
    // A null context must read exactly like `{}` (plan 183-03's one net-new code path).
    await renderDescribeScreen(null)
    expect(screen.getByTestId("describe-hint")).toBeInTheDocument()
    expect(screen.queryByTestId("builder-header-bar")).toBeNull()
  })
})

// ── MARKUP: the exact flag-off CTA region, so ANY addition reds with a diff ────────

/**
 * The CTA region's normalised `outerHTML`, captured from the UNMODIFIED page on
 * 2026-08-02 (Phase 187 wave 1), BEFORE the template door of plans 187-14 / 187-13 /
 * 187-15 existed.
 *
 * Verbatim, and deliberately so — see the docblock. The button carries `disabled=""`
 * because the describe box is empty on arrival, which is the state a person actually
 * lands on; a pin taken with text typed in would be pinning a screen nobody sees first.
 *
 * WRITTEN ONCE. The operator-like case below asserts against THIS constant rather than
 * against a second copied literal, because two literals can drift apart and the sentence
 * being proved is that these two audiences receive the same bytes.
 */
const FLAG_OFF_DESCRIBE_MARKUP =
  `<div class="flex flex-col items-center gap-3"><button type="button" disabled="" class="rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40">Draft the workflow</button><p data-testid="describe-hint" class="text-center text-[13px] text-muted-foreground">You describe the goal — the AI <b class="font-medium text-foreground">drafts the phases</b>, <b class="font-medium text-foreground">sets the strictness</b>, and <b class="font-medium text-foreground">asks about anything it had to guess</b>.</p></div>`

describe("Builder describe screen, canvas flag OFF — the markup itself is pinned", () => {
  it("matches the captured flag-off describe-screen CTA region byte for byte", async () => {
    await renderDescribeScreen(OFF_VARIANTS[0].value)
    expect(describeRegion()).toBe(FLAG_OFF_DESCRIBE_MARKUP)
  })

  it("an OPERATOR-LIKE map produces the IDENTICAL markup (D-181-01, everyone included)", async () => {
    // Asserted as an equality against the same literal rather than as a second copied
    // literal. An operator-only affordance appearing on the flag-off describe screen —
    // the exact shape a carelessly gated template door would take — fails here.
    await renderDescribeScreen(OFF_VARIANTS[2].value)
    expect(describeRegion()).toBe(FLAG_OFF_DESCRIBE_MARKUP)
  })

  it("says NOTHING about a template or a starter — the formatting-independent guard", async () => {
    /**
     * The cheap half, and the half that survives a whitespace change. The literal above is
     * strict enough to red on a stray class, which is exactly what tempts a re-capture; a
     * re-capture would also silently swallow a leaked door. This one cannot be quieted by
     * re-running the capture — the words have to actually leave the flag-off screen.
     *
     * The picker's trigger wording is fixed in plan 187-10's copy constants; asserted here
     * as a WORD CLASS rather than a specific sentence, so it bites whatever that copy
     * turns out to say.
     */
    await renderDescribeScreen(OFF_VARIANTS[0].value)
    const region = ctaRegion()
    expect(region.textContent ?? "").not.toMatch(/template|starter/i)
    // …and not hidden in an attribute either (an `aria-label` or a `title` on the door's
    // trigger would be invisible to `textContent` and perfectly visible to a person).
    expect(describeRegion()).not.toMatch(/template|starter/i)
  })

  it("both guards FIND a planted door — the positive control", async () => {
    /**
     * A pin that has only ever been seen green is a pin nobody has watched fail. The door
     * itself cannot be planted here (`WorkflowBuilderPage.tsx` is deliberately untouched by
     * this plan — the pin's whole credibility rests on that), so the plant is made on the
     * captured STRING: the shape 187-15 will actually add, one quiet line under the CTA.
     */
    await renderDescribeScreen(OFF_VARIANTS[0].value)
    const doored = FLAG_OFF_DESCRIBE_MARKUP.replace(
      "</div>",
      `<button type="button" class="text-[13px]">Start from a template</button></div>`,
    )
    expect(doored).not.toBe(FLAG_OFF_DESCRIBE_MARKUP) // the plant actually landed
    expect(doored).not.toBe(describeRegion()) // the byte pin would red
    expect(doored).toMatch(/template|starter/i) // the word guard would red
  })
})
