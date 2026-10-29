/**
 * Phase 235 plan 09 (SURF-03 · D-235-01 / D-235-03 / D-235-04) —
 * THE APP-SHELL SIGNAL: a badge on the Library rail item, at BOTH rail widths.
 *
 * ── WHY THIS SUITE EXISTS SEPARATELY FROM `NavPanel.test.tsx` ─────────────────────────
 *
 * `NavPanel.test.tsx` locks the rail's SHIPPED contract (New Chat reachability, the
 * probe-gated shields, the ☰ toggle). This file locks the one thing Phase 235 adds — a
 * signal that reaches a person who is not already looking at the Library page — and it is
 * kept apart so a red here names the phase, not the rail.
 *
 * ── ⛔ THE THREE RULES THIS FILE ENFORCES RATHER THAN DESCRIBES ───────────────────────
 *
 *  1. **A badge may decorate a control's name; it may not RENAME it.** `IngestionTab.tsx:176-188`
 *     records this project's own measurement: without `aria-hidden`, a tab's accessible name
 *     became "In progress 3" and six `getByRole` cases broke. `RailItem` sets
 *     `aria-label={label}`, so the same rule binds here — asserted BY NAME below.
 *
 *  2. **Both rail widths, in one loop.** The rail is 58px collapsed and 210px expanded, and
 *     a signal that only survives one of them is a signal that vanishes when somebody folds
 *     the rail. `NavPanel.test.tsx:59-65` is the loop shape this copies.
 *
 *  3. **`ATTENTION_PRODUCERS.length === 1`, asserted literally.** D-235-03 makes this surface
 *     GENERAL — a registry, so `SEED-231` (nobody is told an approval is waiting) can plug in
 *     later WITHOUT growing a sibling surface. ⛔ Registering a second producer *in Phase 235*
 *     is scope creep and is forbidden. This assertion is what makes that enforceable instead of
 *     aspirational: the next author adding a tenant has to come here and argue with a number.
 *
 *     ⚠ CORRECTED at Phase 301-02 (D-11): Phase 301 came here and argued with the number. The
 *     registry now has TWO tenants (`stopped-sources`, `waiting-runs` — SEED-281), and the case
 *     below asserts 2 plus both keys. Rule 3 above is kept as written because it is why that
 *     argument had to happen in a CONTEXT decision rather than in a quiet one-line edit.
 */
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MessageSquare, FileText } from "lucide-react"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { NavItem } from "@/lib/nav-items"

// ⛔ `@/lib/api/sources` IS NOT IN THE `@/lib/api` BARREL (235-RESEARCH P-10) — a
// `vi.mock("@/lib/api", …)` alone never intercepts it. It is mocked here because importing
// `attentionConditions.ts` (for the registry assertion) pulls the polled reader's module
// graph in; no case in this file CALLS it, so the factory's job is to exist.
vi.mock("@/lib/api/sources", () => ({
  getSourceHealth: vi.fn().mockResolvedValue({
    stopped: [],
    reader_running: true,
    poll_interval_seconds: 60,
  }),
  listSyncRuns: vi.fn().mockResolvedValue([]),
}))

import { NavPanel } from "../NavPanel"
import { ATTENTION_PRODUCERS, type AttentionCondition } from "../attentionConditions"
import { COPY } from "@/components/sources/sourceHealthVocabulary"

/** The rail's nav list, shaped like `NAV_ITEMS` — `documents` is labelled "Library". */
const navItems: NavItem[] = [
  { view: "chat", icon: MessageSquare, label: "Chat" },
  { view: "documents", icon: FileText, label: "Library" },
]

type NavProps = React.ComponentProps<typeof NavPanel>

/** Two stopped sources, shaped exactly as the one registered producer emits them. */
function conditions(n: number, onOpen = vi.fn()): AttentionCondition[] {
  return Array.from({ length: n }, (_, i) => ({
    mark: "library" as const, // 301-02 (D-31): every condition carries a required mark
    id: `watch-${i + 1}`,
    title: `Rate sheets ${i + 1}`,
    detail: "The watched folder is no longer shared with this connection.",
    onOpen,
  }))
}

function renderRail(overrides: Partial<NavProps> = {}) {
  const props: NavProps = {
    activeView: "chat",
    onNavigate: vi.fn(),
    navItems,
    isOperator: false,
    onNewThread: vi.fn(),
    onSignOut: vi.fn(),
    theme: "dark",
    onToggleTheme: vi.fn(),
    expanded: false,
    onToggleExpanded: vi.fn(),
    ...overrides,
  }
  const utils = render(
    <TooltipProvider>
      <NavPanel {...props} />
    </TooltipProvider>,
  )
  return { ...utils, props }
}

afterEach(() => cleanup())

// ══ NON-VACUITY FIRST ═════════════════════════════════════════════════════════════════
//
// A harness that renders nothing makes every negative case below vacuously green. The
// control asks for the thing the badge attaches TO, before any badge assertion runs.
describe("NavPanel badge — the harness itself", () => {
  it("renders the Library nav control the badge attaches to", () => {
    renderRail()
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument()
  })

  it("tags the Library rail item with its own contract hook, distinct from a plain rail item", () => {
    renderRail()
    expect(screen.getByTestId("rail-rail-item-library")).toBeInTheDocument()
    expect(screen.getAllByTestId("rail-rail-item").length).toBeGreaterThan(0)
  })
})

// ══ THE REGISTRY — EXACTLY ONE TENANT (D-235-03) ══════════════════════════════════════
describe("NavPanel badge — the producer registry", () => {
  // Title was "registers EXACTLY ONE producer in Phase 235 — a second one is forbidden scope
  // creep"; re-titled at 301-02 (D-11) with the number it now asserts.
  it("registers EXACTLY TWO producers since Phase 301 — a third one is a decision, not a fill-in", () => {
    // ⛔ D-235-03. The surface is general so the NEXT notification need plugs in; the next
    // need is not this phase's. If you are here because you added a tenant, that is the
    // decision this number exists to force you to take deliberately.
    //
    // ⚠ RE-BASELINED 1 → 2 at Phase 301-02 (D-11) — the original read `toBe(1)` with key [0]
    // only. Phase 301 is the deliberate decision this number existed to force: it argued the
    // count against D-235-03 and registered `waiting-runs` (SEED-281; SEED-231 is superseded).
    // Edited, never deleted, and both keys asserted, so a THIRD tenant still argues with it.
    expect(ATTENTION_PRODUCERS.length).toBe(2)
    expect(ATTENTION_PRODUCERS.map((p) => p.key)).toEqual(["stopped-sources", "waiting-runs"])
  })
})

// ══ THE BADGE — BOTH WIDTHS, AND IT RENAMES NOTHING ═══════════════════════════════════
describe("NavPanel badge — renders at both rail widths", () => {
  it("renders the badge at 58px collapsed AND 210px expanded", () => {
    for (const expanded of [false, true]) {
      const { unmount } = renderRail({
        expanded,
        attentionConditions: conditions(1),
        onOpenLibraryHealth: vi.fn(),
      })
      expect(screen.getByTestId("rail-badge")).toBeInTheDocument()
      unmount()
    }
  })

  it("anchors to the row's CORNER collapsed and to its CENTRE expanded", () => {
    /**
     * ⛔ THE OPERATOR SAW IT AND THE EXISTING TESTS COULD NOT (2026-09-09): *"the tag on the
     * library in the navigation menu is not center aligned"*. Both tests above render the
     * badge at both widths and assert it EXISTS — presence, which cannot see position. It
     * carried `-top-1 -right-1` in both modes: correct on the 40×40 collapsed icon, and
     * floating above the text baseline on the full-width expanded row.
     *
     * ⚠ THIS ASSERTS CLASSES, AND THAT IS A REAL LIMIT worth stating rather than hiding:
     * jsdom performs no layout, so no test here can prove where the badge actually LANDS.
     * What it can prove is that the two modes are given different anchors — which is the
     * thing that was missing. The screen is the other half, and the operator is the one who
     * found it.
     */
    const { unmount } = renderRail({
      expanded: false,
      attentionConditions: conditions(1),
      onOpenLibraryHealth: vi.fn(),
    })
    expect(screen.getByTestId("rail-badge").className).toContain("-top-1")
    unmount()

    renderRail({
      expanded: true,
      attentionConditions: conditions(1),
      onOpenLibraryHealth: vi.fn(),
    })
    const expandedBadge = screen.getByTestId("rail-badge").className
    expect(expandedBadge).toContain("top-1/2")
    expect(expandedBadge).toContain("-translate-y-1/2")
    expect(expandedBadge).not.toContain("-top-1")
  })

  it("keeps the Library control's accessible name — the badge is aria-hidden (IngestionTab's six broken cases)", () => {
    for (const expanded of [false, true]) {
      const { unmount } = renderRail({
        expanded,
        attentionConditions: conditions(2),
        onOpenLibraryHealth: vi.fn(),
      })
      // The badge decorates the control; it does not become part of its name.
      expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument()
      expect(screen.getByTestId("rail-badge")).toHaveAttribute("aria-hidden", "true")
      unmount()
    }
  })

  it("renders NOTHING when no source is stopped (SC#4 — a healthy instance is silent)", () => {
    renderRail({ attentionConditions: [], onOpenLibraryHealth: vi.fn() })
    expect(screen.queryByTestId("rail-badge")).toBeNull()
    expect(screen.queryByTestId("rail-popover")).toBeNull()
    expect(screen.getByRole("button", { name: "Library" })).toBeInTheDocument()
  })

  it("renders NOTHING when the caller wired no navigator — a dead control is worse than none", () => {
    renderRail({ attentionConditions: conditions(1) })
    expect(screen.queryByTestId("rail-badge")).toBeNull()
  })
})

// ══ THE WORDS — SINGULAR AND PLURAL, BOTH FROM THE VOCABULARY LEAF ════════════════════
describe("NavPanel badge — what it says", () => {
  it("names one stopped source in the singular", async () => {
    renderRail({ attentionConditions: conditions(1), onOpenLibraryHealth: vi.fn() })
    expect(COPY.badgeTitle(1)).toBe("1 source stopped reading")
    expect(await screen.findByRole("button", { name: COPY.badgeTitle(1) })).toBeInTheDocument()
  })

  it("names two stopped sources in the plural", async () => {
    renderRail({ attentionConditions: conditions(2), onOpenLibraryHealth: vi.fn() })
    expect(COPY.badgeTitle(2)).toBe("2 sources stopped reading")
    expect(await screen.findByRole("button", { name: COPY.badgeTitle(2) })).toBeInTheDocument()
  })

  it("shows the COUNT, not colour alone — the word-badge rule (design skill §4)", () => {
    renderRail({ attentionConditions: conditions(2), onOpenLibraryHealth: vi.fn() })
    // The number is the non-colour carrier; the WORDS live on the control's name. No glyph
    // is invented — the skill's `word-badge carries NO glyph` rule.
    expect(screen.getByTestId("rail-badge")).toHaveTextContent("2")
  })
})

// ══ THE POPOVER IS A DOOR ═════════════════════════════════════════════════════════════
describe("NavPanel badge — the popover names what is broken and opens Health", () => {
  it("opens on the badge and names each stopped source with its cause sentence", async () => {
    const user = userEvent.setup()
    renderRail({ attentionConditions: conditions(2), onOpenLibraryHealth: vi.fn() })
    await user.click(screen.getByRole("button", { name: COPY.badgeTitle(2) }))

    expect(await screen.findByTestId("rail-popover")).toBeInTheDocument()
    expect(screen.getByText(COPY.popTitle)).toBeInTheDocument()
    expect(screen.getAllByTestId("rail-pop-item")).toHaveLength(2)
    expect(screen.getByText("Rate sheets 1")).toBeInTheDocument()
    expect(
      screen.getAllByText("The watched folder is no longer shared with this connection."),
    ).toHaveLength(2)
  })

  it("⛔ carries NO repair control — the fix has ONE home, on the source card", async () => {
    const user = userEvent.setup()
    renderRail({ attentionConditions: conditions(2), onOpenLibraryHealth: vi.fn() })
    await user.click(screen.getByRole("button", { name: COPY.badgeTitle(2) }))
    await screen.findByTestId("rail-popover")

    // The sketch's first variant fork (fix-in-popover vs fix-on-card) was measured
    // UNFEELABLE and settled BY RULE: a second repair site buys two clicks and costs the
    // rule that decided every other placement in this phase.
    expect(screen.queryByRole("button", { name: /reconnect/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /pick a different folder/i })).toBeNull()
    expect(screen.queryByRole("button", { name: /retry now/i })).toBeNull()
  })

  it("its ONE action calls onOpenLibraryHealth exactly once — never a URL (SEED-185)", async () => {
    const user = userEvent.setup()
    const onOpenLibraryHealth = vi.fn()
    renderRail({ attentionConditions: conditions(1), onOpenLibraryHealth })
    await user.click(screen.getByRole("button", { name: COPY.badgeTitle(1) }))

    // ⚠ CORRECTED at Phase 301 (D-26 / BUG-261029-01): this read `findByRole("button", …)`.
    // Radix Menu cancels Tab inside its content, so a plain button there was unreachable from
    // the keyboard; the action is now a menu item, and is found by that role.
    const action = await screen.findByRole("menuitem", { name: COPY.popOpenHealth })
    await user.click(action)
    expect(onOpenLibraryHealth).toHaveBeenCalledTimes(1)
  })

  it("its ONE action is reachable from the keyboard — arrow keys + Enter (D-26, BUG-261029-01)", async () => {
    const user = userEvent.setup()
    const onOpenLibraryHealth = vi.fn()
    renderRail({ attentionConditions: conditions(1), onOpenLibraryHealth })
    screen.getByRole("button", { name: COPY.badgeTitle(1) }).focus()
    await user.keyboard("{Enter}")
    await screen.findByTestId("rail-popover")
    await user.keyboard("{ArrowDown}")
    expect(screen.getByRole("menuitem", { name: COPY.popOpenHealth })).toHaveFocus()
    await user.keyboard("{Enter}")
    expect(onOpenLibraryHealth).toHaveBeenCalledTimes(1)
  })

  // Phase 301-02 (D-12): a waiting run is NOT a Library condition. Given one library and two
  // waiting rows, the Library badge reads 1 and its popover lists exactly the library row.
  it("counts and lists ONLY library conditions — waiting rows never reach the Library badge (D-12)", async () => {
    const user = userEvent.setup()
    const waitingRow = (i: number): AttentionCondition => ({
      mark: "waiting",
      id: `n-${i}`,
      title: `Waiting workflow ${i}`,
      detail: "",
      onOpen: vi.fn(),
      runId: `run-${i}`,
      orgId: "org-a",
      orgName: "Acme",
      since: "2026-10-30T09:00:00Z",
      kind: "question",
      origin: "app",
      total: 2,
    })
    renderRail({
      attentionConditions: [...conditions(1), waitingRow(1), waitingRow(2)],
      onOpenLibraryHealth: vi.fn(),
    })
    expect(screen.getByTestId("rail-badge")).toHaveTextContent(/^1$/)
    await user.click(screen.getByRole("button", { name: COPY.badgeTitle(1) }))
    await screen.findByTestId("rail-popover")
    expect(screen.getAllByTestId("rail-pop-item")).toHaveLength(1)
    expect(screen.getByText("Rate sheets 1")).toBeInTheDocument()
    expect(screen.queryByText("Waiting workflow 1")).toBeNull()
    expect(screen.getAllByRole("menuitem", { name: COPY.popOpenHealth })).toHaveLength(1) // 301-03 D-26: was role "button"
  })

  it("a waiting-only world renders no Library badge at all", () => {
    renderRail({
      attentionConditions: [{
        mark: "waiting", id: "n-1", title: "W", detail: "", onOpen: vi.fn(), runId: "run-1",
        orgId: "org-a", orgName: "Acme", since: "2026-10-30T09:00:00Z", kind: "approval", total: 1,
      }],
      onOpenLibraryHealth: vi.fn(),
    })
    expect(screen.queryByTestId("rail-badge")).toBeNull()
  })

  it("opening the popover navigates nowhere — only the action does", async () => {
    const user = userEvent.setup()
    const onNavigate = vi.fn()
    renderRail({ onNavigate, attentionConditions: conditions(1), onOpenLibraryHealth: vi.fn() })
    await user.click(screen.getByRole("button", { name: COPY.badgeTitle(1) }))
    await screen.findByTestId("rail-popover")
    expect(onNavigate).not.toHaveBeenCalled()
  })
})
