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
 * `DESCRIBE_CTA` button and the `describe-hint` line beneath it. That is where the
 * door lands, so that is where the pin sits. It is resolved by WALKING UP from the
 * `describe-hint` node rather than by a CSS class — a class-based selector would silently
 * start matching a different node after a Tailwind edit, and a pin that quietly moved to
 * another element is worse than no pin.
 *
 * ── ⚠ PHASE 193-08 (2026-08-13) — THIS SUITE NEEDED **NO** RE-CAPTURE, AND THAT IS A ───
 *    MEASUREMENT, NOT AN OVERSIGHT.
 *
 * `193-08` ships variant D: every governed door word changes, and it re-captured three other
 * suites to say so. This one was named in the same plan's `files_modified` on the expectation
 * that it would red too. IT DID NOT — 19/19 green, unedited, with the CTA-region literal
 * below untouched. The reason is worth writing down, because it is the shape of a real gap:
 *
 *   THE WORDS ON THIS SCREEN ARE A **SECOND HOME**. `193-05` moved the door surface's copy
 *   into `components/workflows/doorVocabulary.ts`, but the strings pinned here are
 *   `WorkflowBuilderPage.tsx`'s OWN literals — the CTA at `:1527` and the three hint
 *   fragments at `:1531-1533`. The DOOR renders `describe-draft` from `DESCRIBE_CTA`; this
 *   page renders a visually identical, textually identical, and completely separate copy.
 *   No plan in Phase 193 owns `WorkflowBuilderPage.tsx`, so after variant D ships the loose
 *   door reads "Write the first draft" while the govern door's first screen still reads the
 *   column-A wording.
 *
 * That divergence is REAL, is VISIBLE to a user who opens each door in turn, and is recorded as a
 * deferred item with its trigger in `193-08-SUMMARY.md` § Deferred rather than fixed inside a
 * plan whose `files_modified` does not include the page. When someone does move these four
 * strings into `doorVocabulary`, THIS suite reds — and that red is the correct signal.
 *
 * ── ✅ CLOSED, SAME DAY, AND THE PREDICTION ABOVE IS WHY THIS NOTE CAN BE TRUSTED ───────
 *
 * The operator took the fix rather than the deferral (2026-08-13, after `193-09`), and the
 * paragraph above called the outcome exactly: moving the strings redded **24 cases across five
 * suites**, and every one of those reds was this file and its neighbours doing their job. The
 * deferral is closed; the trigger is spent.
 *
 * FOUR strings were predicted and **FIVE** were found — `DESCRIBE_H1` was duplicated too, and it
 * only surfaced because the page was swept programmatically against all 21 governed values
 * instead of being read by eye. That is the correction this note exists to carry forward.
 *
 * WHAT CHANGED HERE, precisely: the CTA and heading are now queried by `DESCRIBE_CTA` /
 * `DESCRIBE_H1` rather than by hard-coded names — a literal query is exactly what let the page's
 * copy rot without any suite reddening — and the `outerHTML` literal below was re-captured
 * WORDS-ONLY, proved by the ordered TAG-token sequence being identical before and after (23 tags),
 * never by re-recording whatever the page happened to render.
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
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"

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

// Phase 193 fast-fix (AUTH-01): this suite queried the CTA by a hard-coded literal, so when
// variant D landed in `doorVocabulary.ts` the page's own copy went stale WITHOUT this file
// reddening — it was pinning the inconsistency. Named ids cannot drift apart from the source.
import { DESCRIBE_CTA, DESCRIBE_H1 } from "@/components/workflows/doorVocabulary"
import { WorkflowBuilderPage } from "./WorkflowBuilderPage"
import { EffectiveFeaturesProvider } from "@/providers/EffectiveFeaturesProvider"
import type { EffectiveFeatures } from "@/lib/api"
// Phase 187-15: the door's one line and its seed formatter, IMPORTED rather than re-typed,
// so a copy change moves the assertion and the surface in one edit.
import {
  STARTER_DOOR_LINE,
  starterSeedSentence,
} from "@/components/workflows/definitionOps"

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
  expect(region!.contains(screen.getByRole("button", { name: DESCRIBE_CTA }))).toBe(true)
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
      expect(screen.getByRole("heading", { name: DESCRIBE_H1 })).toBeInTheDocument()
      expect(screen.getByLabelText("business requirement")).toBeInTheDocument()
      expect(screen.getByRole("button", { name: DESCRIBE_CTA })).toBeInTheDocument()

      // …and the region the door lands in resolves by walking up from the hint, and
      // reads as one addressable string.
      expect(ctaRegion().contains(screen.getByTestId("describe-hint"))).toBe(true)
      expect(describeRegion()).toContain(DESCRIBE_CTA)
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
  `<div class="flex flex-col items-center gap-3"><button type="button" disabled="" class="rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40">Write the first draft</button><p data-testid="describe-hint" class="text-center text-[13px] text-muted-foreground">You describe the goal — the AI <b class="font-medium text-foreground">writes the steps</b>, <b class="font-medium text-foreground">sets how strict it is</b>, and <b class="font-medium text-foreground">asks about anything it had to guess</b>.</p></div>`

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

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-15 Task 2 (VOCAB-03 / Req 6) — THE TEMPLATE DOOR, MOUNTED
//
// APPENDED, never interleaved. Everything above this line is the wave-1 pin, captured
// against the UNMODIFIED page, and NOT ONE OF ITS ASSERTIONS MOVES: `FLAG_OFF_DESCRIBE_MARKUP`
// is untouched, and if it ever needed editing that would mean exactly one thing — the door
// leaked flag-off.
//
// The door lands INSIDE the pinned CTA flex column, deliberately. 187-05's carry-forward
// warns that a SIBLING of that column would not trip the byte pin; mounting inside it means
// the strongest guard this file has is the one guarding the new line.
// ══════════════════════════════════════════════════════════════════════════════════

const FLAG_ON = { features: { visual_workflow_canvas: true }, loading: false }

/** Two curated starters in the measured shape (`187-RESEARCH` §"The template door"):
 *  `llm_agent → llm_emit`, one with a `business_requirement` and one WITHOUT, so the
 *  documented name-fallback is exercised rather than assumed. */
const STARTERS = [
  {
    id: "st-1",
    slug: "risk-register",
    name: "Risk Register",
    definition: {
      business_requirement: "Track supplier risks and flag the ones that need a decision.",
      phases: [
        { slug: "scan", phase_index: 0, config: { phase_type: "llm_agent" } },
        { slug: "write", phase_index: 1, config: { phase_type: "llm_emit" } },
      ],
    },
  },
  {
    id: "st-2",
    slug: "weekly-status",
    name: "Weekly Status Report",
    definition: {
      phases: [
        { slug: "gather", phase_index: 0, config: { phase_type: "llm_agent" } },
        { slug: "emit", phase_index: 1, config: { phase_type: "llm_emit" } },
      ],
    },
  },
]

describe("Builder describe screen, canvas flag ON — the template door (Req 6)", () => {
  it("the door's one quiet line renders INSIDE the pinned CTA region", async () => {
    mockListStarters.mockResolvedValue(STARTERS)
    await renderDescribeScreen(FLAG_ON)

    const trigger = screen.getByTestId("starter-door-trigger")
    expect(trigger).toHaveTextContent(STARTER_DOOR_LINE)
    // Inside the pinned region, not beside it — so the wave-1 byte pin is the guard.
    expect(ctaRegion().contains(trigger)).toBe(true)
  })

  for (const variant of OFF_VARIANTS) {
    it(`${variant.name} renders NO door at all — the gate is the page's`, async () => {
      mockListStarters.mockResolvedValue(STARTERS)
      await renderDescribeScreen(variant.value)
      expect(screen.queryByTestId("starter-door-trigger")).toBeNull()
      expect(screen.queryByTestId("starter-door-panel")).toBeNull()
      // And the byte pin still holds, unedited.
      expect(describeRegion()).toBe(FLAG_OFF_DESCRIBE_MARKUP)
    })
  }

  it("choosing a template FILLS the describe box, keeps you here, and enables the CTA", async () => {
    mockListStarters.mockResolvedValue(STARTERS)
    await renderDescribeScreen(FLAG_ON)

    const box = screen.getByLabelText("business requirement") as HTMLTextAreaElement
    expect(box.value).toBe("")
    expect(screen.getByRole("button", { name: DESCRIBE_CTA })).toBeDisabled()

    fireEvent.click(screen.getByTestId("starter-door-trigger"))
    const row = await screen.findByTestId("starter-door-row-risk-register")
    fireEvent.click(row)

    // The box now carries the starter's OWN sentence — produced by calling the shipped
    // formatter here rather than typed, so a copy change moves both sides at once.
    await waitFor(() => expect(box.value).toBe(starterSeedSentence(STARTERS[0])))
    // Still on the describe screen: nothing was generated, nothing navigated.
    expect(screen.getByTestId("describe-hint")).toBeInTheDocument()
    expect(screen.queryByTestId("builder-grid")).toBeNull()
    // …and the shipped `canDraft` rule did the rest: a non-empty box enables the CTA.
    expect(screen.getByRole("button", { name: DESCRIBE_CTA })).toBeEnabled()
  })

  it("the row with NO business_requirement seeds its NAME — the documented fallback", async () => {
    mockListStarters.mockResolvedValue(STARTERS)
    await renderDescribeScreen(FLAG_ON)

    fireEvent.click(screen.getByTestId("starter-door-trigger"))
    fireEvent.click(await screen.findByTestId("starter-door-row-weekly-status"))

    const box = screen.getByLabelText("business requirement") as HTMLTextAreaElement
    await waitFor(() => expect(box.value).toBe("Weekly Status Report"))
  })

  it("NO second forward path: choosing a template writes nothing and generates nothing", async () => {
    /**
     * The whole of Req 6 is that picking a template produces TEXT. The picker's own source
     * fence lives in the component, so a convenience added at the MOUNT — an "and draft it
     * now" — would not be caught there. Enumerated here instead: every create / update /
     * publish / generate symbol the page can reach, each asserted at zero.
     */
    mockListStarters.mockResolvedValue(STARTERS)
    await renderDescribeScreen(FLAG_ON)

    fireEvent.click(screen.getByTestId("starter-door-trigger"))
    fireEvent.click(await screen.findByTestId("starter-door-row-risk-register"))
    await waitFor(() =>
      expect((screen.getByLabelText("business requirement") as HTMLTextAreaElement).value).not.toBe(""),
    )

    expect(mockGenerate).toHaveBeenCalledTimes(0)
    expect(mockCreate).toHaveBeenCalledTimes(0)
    expect(mockUpdate).toHaveBeenCalledTimes(0)
    expect(mockPublish).toHaveBeenCalledTimes(0)
  })

  it("the seed receipt does NOT live on the describe screen", async () => {
    // The receipt is a DRAFTED-view surface (150-B: a card above the canvas). If any part
    // of it were mounted here it would ship flag-off with the rest of the describe screen.
    mockListStarters.mockResolvedValue(STARTERS)
    await renderDescribeScreen(FLAG_ON)
    expect(screen.queryByTestId("seed-receipt")).toBeNull()
  })
})

// ══════════════════════════════════════════════════════════════════════════════════
// Phase 187-26 Task 2 (VOCAB-02 / VOCAB-03 · GAP A) — THE OMITTED PROP.
//
// APPENDED, and NOT ONE ASSERTION ABOVE THIS LINE MOVES: `FLAG_OFF_DESCRIBE_MARKUP` is
// untouched, which is the point. This plan adds ONE additive-optional prop to the page and
// changes nothing in its render body, so every mount that supplies nothing — the tests
// above, the flag-off app, the door shell's own fresh-build path — must be byte-identical.
//
// A prop is only additive-optional if an ABSENT one is observably today's behaviour. That
// is asserted here rather than asserted by the docblock that claims it.
// ══════════════════════════════════════════════════════════════════════════════════

/** The two folders the picker would offer, in the live `Folder` shape. */
const PAGE_FOLDERS = [
  {
    id: "f-policies",
    user_id: "u-1",
    name: "Policies",
    parent_id: null,
    is_org_shared: false,
    created_at: "2026-08-04T00:00:00Z",
    updated_at: "2026-08-04T00:00:00Z",
  },
]

describe("Builder describe screen — an OMITTED initialProjectFolderId is today's page", () => {
  it("the describe screen's own picker starts UNCHOSEN when the prop is not supplied", async () => {
    // `renderDescribeScreen` mounts `<WorkflowBuilderPage />` with no props at all — the
    // exact shape every shipped call site used before this plan.
    mockListFolders.mockResolvedValue(PAGE_FOLDERS)
    await renderDescribeScreen(OFF_VARIANTS[0].value)

    const picker = (await screen.findByTestId("project-folder-picker")) as HTMLSelectElement
    expect(picker.value).toBe("")
    // …and the opt-out row is what is selected, not a fabricated default binding.
    expect(picker.selectedOptions[0].value).toBe("")
  })

  it("the wave-1 CTA byte pin still holds with folders on offer — the picker is a SIBLING", async () => {
    // The Builder's own describe-screen picker sits ABOVE the pinned CTA column, so the
    // literal captured in wave 1 is unaffected by folders existing. Asserted rather than
    // assumed, because "it did not move" is exactly the claim a re-capture would hide.
    mockListFolders.mockResolvedValue(PAGE_FOLDERS)
    await renderDescribeScreen(OFF_VARIANTS[0].value)

    await screen.findByTestId("project-folder-picker")
    expect(describeRegion()).toBe(FLAG_OFF_DESCRIBE_MARKUP)
    expect(ctaRegion().querySelector('[data-testid="project-folder-picker"]')).toBeNull()
  })

  it("an OPERATOR-LIKE map with the prop absent still produces the IDENTICAL CTA markup", async () => {
    mockListFolders.mockResolvedValue(PAGE_FOLDERS)
    await renderDescribeScreen(OFF_VARIANTS[2].value)
    expect(describeRegion()).toBe(FLAG_OFF_DESCRIBE_MARKUP)
  })
})
