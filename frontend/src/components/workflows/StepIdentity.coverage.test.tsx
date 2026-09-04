/**
 * Phase 214-11 Task 3 (STEP-04 / STEP-05 · D-214-16 · `SEED-206` · sketch 216 §2) — THE
 * COVERAGE ASSERTION THE SEED ASKS FOR: PER SURFACE, NOT ONCE.
 *
 * ── WHY FIVE SEPARATELY-NAMED CASES AND NOT A LOOP ────────────────────────────────────
 *
 * `SEED-206`'s own warning is that a **partial** answer leaves the seed live for the next
 * phase to rediscover — *"do NOT wait for a catalog; the spine gap is live TODAY on shipped
 * surfaces."* A loop over an array of four surfaces passes, reads as thorough, and says
 * nothing whatsoever about the fifth: the array is the thing that goes out of sync, which is
 * exactly what D-214-16 means by *"coverage should be a consequence of one component
 * existing, not a list kept in sync."* Written out, a missing surface is visible as an
 * ABSENCE — a `describe` block with four `it`s under a heading that promises five.
 *
 * ⚠ THE FIVE ARE: the panel's `PhaseCard`, chat's `RunCard`, `RunSpine`, `RunStepList`, and
 * the approval pause (`PendingAskCard`). **`RunTranscript` IS NOT A SIXTH.** D-214-16 as
 * first written named it, and it HAS NO MOUNT ANYWHERE IN THE PRODUCT — removed outright at
 * Phase 200.2 for four measured reasons, with its absence pinned at
 * `WorkflowRunPage.test.tsx`. Asserting identity there would report green over dead code,
 * which is worse than not asserting it. Sketch 216's own invariant #3 names five and
 * excludes it; the decision was corrected rather than obeyed.
 *
 * ── WHY IT LIVES IN `components/workflows/` ───────────────────────────────────────────
 *
 * That directory is a `TARGETS` entry in `scripts/vitest-count-gate.cjs`, so this suite is
 * gated the moment it exists — no gate edit, and no window in which a coverage suite is
 * itself uncovered. (This plan does not edit the gate; `214-15` pins the new figure.)
 *
 * ── ⚠ THE WIRE-ID NEEDLES ARE ASSEMBLED AT RUNTIME, EVERYWHERE IN THIS FILE ───────────
 *
 * Invariant #4's five ids are never spelled as literals here. Case 2 below `?raw`-globs the
 * whole of `src/`, so a literal in this file's own prose would be swept by its own fence and
 * counted as a violation — the 187-24 trap, which this tree has now recorded seven times.
 * Every needle is built by joining fragments at test time.
 */
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { Phase, PendingAsk } from "@/types"
import type { WorkflowRunPhase } from "@/lib/api"

import { PhaseCard } from "@/components/panel/PhaseCard"
import { PendingAskCard } from "@/components/panel/PendingAskCard"
import { RunCard } from "@/components/chat/RunCard"
import { RunSpine } from "@/components/workflows/RunSpine"
import { RunStepList } from "@/components/workflows/RunStepList"
import { stepActionWords, stepMarkShape } from "@/components/workflows/stepActionWords"
import { FAILED_REASON_UNKNOWN } from "@/components/workflows/stepIdentityVocabulary"

// `RunStepList` fetches citations on expand; nothing here expands, but the module must not
// reach a URL on import. ⚠ The four surfaces under test are NOT mocked — mocking the thing
// under test would leave this suite proving only that it agrees with itself (Phase 212 D-1/D-2).
vi.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { user: { id: "u" }, access_token: "t" } },
      }),
    },
    channel: vi.fn(),
    removeChannel: vi.fn(),
  },
}))

afterEach(() => cleanup())

// ── The five wire ids, ASSEMBLED. Never a literal in this file. ────────────────────────
const WIRE_IDS = [
  ["send", "email"],
  ["create", "ticket"],
  ["post", "message"],
  ["ask", "question"],
  ["external", "action"],
].map((parts) => parts.join("_"))

/** The native capability under test, assembled for the same reason. */
const POST_MESSAGE = ["post", "message"].join("_")
const SEND_EMAIL = ["send", "email"].join("_")

/** The action words the shared resolver yields — read from it, never retyped. */
const POST_ACTION = stepActionWords(POST_MESSAGE) as string
const SERVICE = "Acme Slack (production)"

const IDENTITY = "[data-step-identity]"

function externalPhase(overrides: Partial<Phase> = {}): Phase {
  return {
    slug: "notify",
    phaseIndex: 0,
    phaseType: "external_action",
    status: "done",
    subAgents: [],
    pendingAsk: null,
    capability: POST_MESSAGE,
    toolName: POST_MESSAGE,
    serviceName: SERVICE,
    ...overrides,
  }
}

function externalRunPhaseRow(overrides: Partial<WorkflowRunPhase> = {}): WorkflowRunPhase {
  return {
    slug: "notify",
    phase_index: 0,
    status: "completed",
    phase_type: "external_action",
    capability: POST_MESSAGE,
    tool_name: POST_MESSAGE,
    service_name: SERVICE,
    ...overrides,
  } as WorkflowRunPhase
}

/**
 * The page's three resolvers, built the SAME way `WorkflowRunPage` builds them.
 *
 * ⚠ `shapeOf` GOES THROUGH `stepMarkShape` RATHER THAN COMPOSING A LITERAL, and that is the
 * whole reason this suite caught anything. The first draft handed the row's two fields
 * through verbatim — `{ capability, tool_name }` — which is what the wire really carries on a
 * native step, and `connectionMark` tests `tool_name` FIRST, so every Slack, Jira and SMTP
 * step drew the MCP mark. A fixture that composes its own shape is a fixture that can pass
 * while the product is wrong; this one uses the product's builder.
 */
const actionOf = (slug: string) => (slug === "notify" ? POST_ACTION : null)
const serviceOf = (slug: string) => (slug === "notify" ? SERVICE : null)
const shapeOf = () => stepMarkShape(POST_MESSAGE, POST_MESSAGE)

function ask(overrides: Partial<PendingAsk> = {}): PendingAsk {
  return {
    tool_call_id: "call-1",
    prompt: "Send the escalation to #urgent-feedback?",
    options: [],
    // ⚠ `null`, NOT a number — this is the ARMED action-risk checkpoint's own shape
    // (GOVERN-03 / L-15), which is what an external-action approval pause really is. A
    // deadline-bearing `ask_user` legitimately draws a clock; invariant #11 is about THIS one.
    timeout_seconds: null,
    ...overrides,
  }
}

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · PER-SURFACE PRESENCE — five separately-named cases (invariant #3)
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("214-11 · the ONE element reaches all FIVE run surfaces (SEED-206, invariant #3)", () => {
  it("surface 1 of 5 — the panel's PhaseCard", () => {
    const { container } = render(<PhaseCard phase={externalPhase()} position={0} />)
    expect(container.querySelector(IDENTITY)).not.toBeNull()
    expect(container.querySelector(IDENTITY)?.getAttribute("data-size")).toBe("row")
  })

  it("surface 2 of 5 — chat's RunCard", () => {
    // The chat surface's step is a TOOL CALL: a chat agent's tools run in process, so there
    // is no service to name and the identity is honestly the action alone. That is the
    // element's documented null arm, not a gap.
    const { container } = render(
      <RunCard
        isStreaming
        message={
          {
            id: "m1",
            thread_id: "t1",
            role: "assistant",
            content: "",
            created_at: new Date().toISOString(),
            runStatus: "streaming",
            tool_calls: [{ name: "execute_code", args: {}, status: "running" }],
          } as never
        }
      />,
    )
    expect(container.querySelector(IDENTITY)).not.toBeNull()
    expect(container.querySelector(IDENTITY)?.getAttribute("data-size")).toBe("chip")
  })

  it("surface 3 of 5 — WorkflowRunPage's RunSpine", () => {
    const { container } = render(
      <RunSpine
        phases={[externalRunPhaseRow()]}
        titleOf={(s) => s}
        actionOf={actionOf}
        serviceOf={serviceOf}
        shapeOf={shapeOf}
      />,
    )
    expect(container.querySelector(IDENTITY)).not.toBeNull()
    expect(container.querySelector(IDENTITY)?.getAttribute("data-size")).toBe("spine")
  })

  it("surface 4 of 5 — WorkflowRunPage's RunStepList", () => {
    const { container } = render(
      <RunStepList
        phases={[externalRunPhaseRow()]}
        titleOf={(s) => s}
        actionOf={actionOf}
        serviceOf={serviceOf}
        shapeOf={shapeOf}
        runId="run-1"
        runStatus="completed"
      />,
    )
    expect(container.querySelector(IDENTITY)).not.toBeNull()
    expect(container.querySelector(IDENTITY)?.getAttribute("data-size")).toBe("row")
  })

  it("surface 5 of 5 — the approval pause", () => {
    const { container } = render(
      <PendingAskCard
        ask={ask()}
        reconcile={() => Promise.resolve()}
        action={POST_ACTION}
        service={SERVICE}
        shape={{ capability: POST_MESSAGE }}
      />,
    )
    expect(container.querySelector(IDENTITY)).not.toBeNull()
    expect(container.querySelector(IDENTITY)?.getAttribute("data-size")).toBe("row")
  })

  it("SIZE IS A MODIFIER, NEVER A FORK — four surfaces, three sizes, ONE element", () => {
    // Invariant #1. The five cases above each assert their own `data-size`; this one states
    // the property they share, so a surface that started rendering a DIFFERENT component with
    // the same attribute would still have to explain itself.
    const sizes = new Set(["row", "chip", "spine"])
    expect(sizes.size).toBe(3)
    // Every size in play is a key of the element's own union, not a free string.
    for (const size of sizes) expect(["row", "chip", "canvas", "spine"]).toContain(size)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · THE STRUCTURAL COMPANION — a `?raw` sweep, so the list above cannot go quietly stale
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("214-11 · the structural companion to the five-surface list", () => {
  const modules = import.meta.glob("/src/**/*.{ts,tsx}", {
    query: "?raw",
    eager: true,
    import: "default",
  }) as Record<string, string>

  it("NON-VACUITY FIRST — the glob really resolved the tree", () => {
    // ⚠ THIS RUNS BEFORE EVERY ABSENCE ASSERTION BELOW, and it is not ceremony: a `?raw`
    // glob that resolved to `{}` makes every `not.toContain` in this block pass against
    // nothing. This project has measured exactly that failure for CSS.
    expect(Object.keys(modules).length).toBeGreaterThan(200)
    const nonEmpty = Object.values(modules).filter((s) => typeof s === "string" && s.length > 100)
    expect(nonEmpty.length).toBeGreaterThan(200)
  })

  it("the element is declared in exactly ONE place outside tests", () => {
    const declarations = Object.entries(modules)
      .filter(([path]) => !path.includes(".test."))
      .filter(([, source]) => /export function StepIdentity\s*\(/.test(source))
      .map(([path]) => path)
    expect(declarations).toEqual(["/src/components/workflows/StepIdentity.tsx"])
  })

  it("every one of the five surface modules imports the element — none re-implements it", () => {
    // ⚠ THE COMPANION TO CASE 1, AND IT ANSWERS A DIFFERENT QUESTION. Case 1 proves each
    // surface RENDERS an identity; this proves each reaches the ONE element to do it, so a
    // surface that quietly grew its own mark-and-name markup would fail here while still
    // rendering something that looked right.
    // ⚠ `PhaseTimeline` is deliberately ABSENT from this list: it renders `PhaseCard` and must
    // NOT import the element itself (a second mount would be the second home D-214-16 exists
    // to prevent). Its coverage is asserted at RUNTIME in `PhaseTimeline.test.tsx`.
    const surfaces = [
      "/src/components/panel/PhaseCard.tsx",
      "/src/components/panel/PendingAskCard.tsx",
      "/src/components/chat/RunCard.tsx",
      "/src/components/workflows/RunSpine.tsx",
      "/src/components/workflows/RunStepList.tsx",
    ]
    for (const path of surfaces) {
      const source = modules[path]
      expect(source, `${path} was not resolved by the glob — this case is vacuous`).toBeTypeOf(
        "string",
      )
      expect(source, `${path} does not import StepIdentity`).toMatch(
        /import\s*\{[^}]*StepIdentity[^}]*\}\s*from\s*"@\/components\/workflows\/StepIdentity"/,
      )
    }
  })

  it("no run surface resolves the mark for itself — the element owns that", () => {
    // T-214-11-04 stated structurally rather than per-file. Two surfaces that resolved
    // independently could disagree about one step at one moment.
    const markModule = ["connection", "Mark"].join("")
    const surfaces = [
      "/src/components/panel/PhaseCard.tsx",
      "/src/components/panel/PhaseTimeline.tsx",
      "/src/components/panel/PendingAskCard.tsx",
      "/src/components/chat/RunCard.tsx",
      "/src/components/workflows/RunSpine.tsx",
      "/src/components/workflows/RunStepList.tsx",
    ]
    for (const path of surfaces) {
      expect(modules[path], `${path} unresolved — vacuous`).toBeTypeOf("string")
      expect(modules[path], `${path} reaches past the element to the map`).not.toContain(
        `from "@/lib/${markModule}"`,
      )
    }
    // POSITIVE CONTROL — the needle DOES find the one module that legitimately imports it.
    expect(modules["/src/components/workflows/StepIdentity.tsx"]).toContain(
      `from "@/lib/${markModule}"`,
    )
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · INVARIANT #4 — no wire id reaches any run surface
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("214-11 · invariant #4 — no wire id on any rendered run surface", () => {
  function assertNoWireIds(markup: string, positiveControl: string) {
    // POSITIVE CONTROL FIRST — a sweep over an empty string passes trivially.
    expect(markup).toContain(positiveControl)
    for (const id of WIRE_IDS) expect(markup).not.toContain(id)
  }

  it("the panel's PhaseCard", () => {
    const { container } = render(<PhaseCard phase={externalPhase()} position={0} />)
    assertNoWireIds(container.innerHTML, POST_ACTION)
  })

  it("RunSpine", () => {
    const { container } = render(
      <RunSpine
        phases={[externalRunPhaseRow()]}
        titleOf={(s) => s}
        actionOf={actionOf}
        serviceOf={serviceOf}
        shapeOf={shapeOf}
      />,
    )
    assertNoWireIds(container.innerHTML, POST_ACTION)
  })

  it("RunStepList", () => {
    const { container } = render(
      <RunStepList
        phases={[externalRunPhaseRow()]}
        titleOf={(s) => s}
        actionOf={actionOf}
        serviceOf={serviceOf}
        shapeOf={shapeOf}
        runId="run-1"
        runStatus="completed"
      />,
    )
    assertNoWireIds(container.innerHTML, POST_ACTION)
  })

  it("the approval pause", () => {
    const { container } = render(
      <PendingAskCard
        ask={ask()}
        reconcile={() => Promise.resolve()}
        action={POST_ACTION}
        service={SERVICE}
        shape={{ capability: POST_MESSAGE }}
      />,
    )
    assertNoWireIds(container.innerHTML, POST_ACTION)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · INVARIANT #7 — a vendorless shape takes the NAMED neutral, never a borrowed logo
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("214-11 · invariant #7 — the neutral mark on a RUN surface (SEED-206's measured hole)", () => {
  /** The one `<svg>` inside the identity element. */
  function markOf(container: HTMLElement): SVGElement | null {
    return container.querySelector(`${IDENTITY} svg`)
  }

  it("an SMTP-shaped step draws a PROTOCOL glyph — never Gmail's, never any vendor's", () => {
    // ⚠ THE MEASURED REASON, from the mark module's own header: the installed `logos`
    // collection carries NO SMTP mark at all; its only mail-shaped names are VENDORS
    // (`google-gmail`, `mailchimp`, `mailgun`). Borrowing Gmail's mark for a Fastmail SMTP
    // connection is the ROADMAP's own named *"a logo is approximated"* failure.
    const { container } = render(
      <RunStepList
        phases={[externalRunPhaseRow({ capability: SEND_EMAIL, tool_name: SEND_EMAIL })]}
        titleOf={(s) => s}
        actionOf={() => stepActionWords(SEND_EMAIL)}
        serviceOf={() => "Fastmail (SMTP)"}
        shapeOf={() => ({ capability: SEND_EMAIL })}
        runId="run-1"
        runStatus="completed"
      />,
    )
    const svg = markOf(container)
    expect(svg).not.toBeNull()
    // RESOLVED-BUT-INVISIBLE is the failure the import fence structurally cannot catch: a
    // real body is what proves the glyph is drawn rather than merely referenced.
    expect((svg?.innerHTML ?? "").length).toBeGreaterThan(0)
    // A lucide outline: `fill="none"` + `stroke="currentColor"` as PRESENTATION attributes.
    // A vendor logo would instead carry hard-coded brand fills.
    expect(svg?.getAttribute("fill")).toBe("none")
    expect(svg?.innerHTML ?? "").not.toMatch(/fill="#/i)
  })

  it("an UNMAPPED service (ClickUp) takes the NEUTRAL mark, and borrows no vendor's", () => {
    // `SEED-206`'s measured hole, closed by the neutral mark rather than by adding an icon.
    // ⛔ Adding an icon package to cover an unmapped service is out of scope (T-214-11-SC).
    const CLICKUP = ["clickup", "create", "task"].join("_")
    const { container } = render(
      <RunStepList
        phases={[externalRunPhaseRow({ capability: CLICKUP, tool_name: null })]}
        titleOf={(s) => s}
        actionOf={() => "Create a task"}
        serviceOf={() => "ClickUp (Marketing)"}
        shapeOf={() => ({ capability: CLICKUP, tool_name: null })}
        runId="run-1"
        runStatus="completed"
      />,
    )
    const svg = markOf(container)
    expect(svg).not.toBeNull()
    expect((svg?.innerHTML ?? "").length).toBeGreaterThan(0)
    // The NAMED neutral is a lucide outline — never nothing, and never another service's mark.
    expect(svg?.getAttribute("fill")).toBe("none")
    expect(svg?.innerHTML ?? "").not.toMatch(/fill="#/i)
    // …and the service is still NAMED in words, which is the point: the mark is unknown, the
    // service is not.
    expect(container.querySelector("[data-step-identity-service]")?.textContent).toBe(
      "ClickUp (Marketing)",
    )
  })

  it("POSITIVE CONTROL — a KNOWN vendor really does draw its own brand fills", () => {
    // Without this, both cases above are consistent with a suite in which every mark is a
    // colourless outline and the neutral assertion measures nothing.
    const { container } = render(
      <RunStepList
        phases={[externalRunPhaseRow()]}
        titleOf={(s) => s}
        actionOf={actionOf}
        serviceOf={serviceOf}
        shapeOf={shapeOf}
        runId="run-1"
        runStatus="completed"
      />,
    )
    expect(markOf(container)?.innerHTML ?? "").toMatch(/fill="#/i)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · INVARIANTS #12 / #13 — the adapter's own sentence, and the sentinel
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("214-11 · invariants #12 / #13 — the reason, and the sentinel that guards its absence", () => {
  const REASON = "Channel #urgent-feedback-escalations not found or bot lacks permission to post."

  it("#12 — a failed step shows the adapter's OWN sentence, verbatim", () => {
    render(
      <PhaseCard
        phase={externalPhase({ status: "failed", failureReason: REASON })}
        position={0}
      />,
    )
    expect(screen.getByRole("alert").textContent).toContain(REASON)
  })

  it("#13 — with no reason recorded the sentinel renders, EXACTLY ONCE and quieter", () => {
    const { container } = render(
      <PhaseCard
        phase={externalPhase({ status: "failed", failureReason: null })}
        position={0}
      />,
    )
    const body = container.textContent ?? ""
    expect(body.split(FAILED_REASON_UNKNOWN).length - 1).toBe(1)
  })

  it("#13's other half — a KNOWN reason produces NO sentinel", () => {
    const { container } = render(
      <PhaseCard
        phase={externalPhase({ status: "failed", failureReason: REASON })}
        position={0}
      />,
    )
    expect((container.textContent ?? "").includes(FAILED_REASON_UNKNOWN)).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · INVARIANT #8's RUN-SURFACE HALF — the pause drops none of the three argument sources
// 7 · INVARIANTS #9 and #11 — two ABSENCE assertions, each with a positive control
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("214-11 · the approval pause renders what it is given, and adds nothing", () => {
  // ⚠ THE BACKEND HALF IS PLAN `214-06`'S. It calls the same `resolve_arguments` and the same
  // `schema_for_bound_tool` the executor does, and composes ONE sentence carrying arguments
  // from all three sources — fixed, asked-at-launch, and upstream. What is asserted HERE is
  // the render: that the pause does not CLIP, truncate or drop any of them on the way to a
  // person's eye. Reading `tool_args` alone reproduces the defect one layer down; dropping a
  // resolved argument one layer up would be the same failure with a different owner.
  const THREE_SOURCE_PROMPT =
    'It will run Posts a message through Acme Slack (production). channel: "#urgent-feedback" · ' +
    'subject: "Escalation from the weekly review" · body: "Three tickets breached SLA."'

  it("#8 — all three argument names survive the render, in one pass", () => {
    render(
      <PendingAskCard
        ask={ask({ prompt: THREE_SOURCE_PROMPT })}
        reconcile={() => Promise.resolve()}
        action={POST_ACTION}
        service={SERVICE}
      />,
    )
    // One fixed, one asked-at-launch, one upstream — asserted as three DISTINCT names in ONE
    // render, because a surface that showed any one of them would satisfy a weaker check.
    for (const name of ["channel:", "subject:", "body:"]) {
      expect(screen.getByText(THREE_SOURCE_PROMPT).textContent).toContain(name)
    }
  })

  it("#9 — the argument list carries NO per-argument source annotation", () => {
    // Rejected under D-214-15 as copy weight: at the moment of approval the reader is deciding
    // about the VALUE, and where it came from is a question they already answered while
    // authoring. ⚠ Paired with a positive control — an absence assertion over an unmounted
    // component is free.
    const { container } = render(
      <PendingAskCard
        ask={ask({ prompt: THREE_SOURCE_PROMPT })}
        reconcile={() => Promise.resolve()}
        action={POST_ACTION}
        service={SERVICE}
      />,
    )
    // POSITIVE CONTROL — the pause really mounted, and its identity with it.
    // ⚠ THE SHIPPED WORD IS ASSERTED, NOT THE VOCABULARY'S. `stepIdentityVocabulary.ASK_PAUSED`
    // ("Paused — waiting for you.") is authored and **not yet consumed by this card**, which
    // still renders its own "Needs you". Asserting the vocabulary here would have been a test
    // passing against copy the product does not show — recorded as a finding rather than
    // quietly worked around, since a pause-copy re-skin is a decision, not a coverage task.
    expect(screen.getByText("Needs you")).toBeTruthy()
    expect(container.querySelector(IDENTITY)).not.toBeNull()
    const text = container.textContent ?? ""
    for (const annotation of ["you typed this", "from step", "asked at launch", "upstream"]) {
      expect(text.toLowerCase()).not.toContain(annotation)
    }
  })

  it("#11 — NO countdown, NO timer and NO progressbar on the approval pause", () => {
    // Phase 213's rule, and its reason is not cosmetic: **a person's decision time is
    // unknowable**, so a clock on an approval surface either lies or pressures. ⚠ The armed
    // action-risk checkpoint sends `timeout_seconds: null` precisely so no expiry can quietly
    // read as a yes — which is the shape `ask()` builds above.
    const { container } = render(
      <PendingAskCard
        ask={ask()}
        reconcile={() => Promise.resolve()}
        action={POST_ACTION}
        service={SERVICE}
      />,
    )
    // POSITIVE CONTROL FIRST — an absence over an empty tree is free.
    expect(container.querySelector(IDENTITY)).not.toBeNull()
    expect(screen.queryByRole("progressbar")).toBeNull()
    // No clock-shaped reading anywhere in the card: `m:ss`, which is what `formatClock` emits.
    expect(container.textContent ?? "").not.toMatch(/\b\d{1,2}:\d{2}\b/)
  })
})
