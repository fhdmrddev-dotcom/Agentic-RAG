/**
 * Phase 214-08 Task 2 (STEP-04 · D-214-16 / D-214-17 · SC#4 · `SEED-206`) — the shared
 * step-identity element's own guard.
 *
 * ── WHAT THIS SUITE IS FOR, given the element is ten lines of JSX ─────────────────────
 *
 * Almost nothing here is about whether the markup renders. It is about the four properties
 * that fail SILENTLY, three of which no type checker and no build can see:
 *
 *   1. RESOLVED-BUT-INVISIBLE — the ink contract. A mark whose slug resolves, whose body is
 *      a thousand characters, and which the person cannot see. Ported in STRUCTURE from
 *      `lib/__tests__/connectionMark.test.tsx`'s block rather than restated in prose,
 *      because sketch 216 #6 says plainly that the import fence CANNOT catch it.
 *   2. A BORROWED VENDOR LOGO — `SEED-206`'s measured ClickUp hole. Showing Slack's mark for
 *      a service that is not Slack is a claim the system cannot support.
 *   3. A FABRICATED SERVICE NAME — the null arm. "Unknown service" would be worse than the
 *      action alone, and only an assertion distinguishes the two renders.
 *   4. A WIRE ID REACHING A RUN SURFACE — invariant #4, swept over the rendered markup with
 *      a positive control beside it.
 *
 * ── ⚠ THE 187-24 TRAP FIRED HERE AND IS HANDLED, NOT AVOIDED ─────────────────────────
 *
 * `StepIdentity.tsx`'s own docblock NAMES the two forbidden spellings (`if (size` and
 * `size ===`) in the sentence that forbids them. A bare `toContain` over raw source reads
 * that prose and goes red on the comment. So the fence runs over COMMENT-STRIPPED source,
 * and a control asserts the stripper actually removed something — a fence whose stripper
 * silently ate the whole file would pass while asserting nothing.
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, cleanup } from "@testing-library/react"

import { StepIdentity, type StepIdentityProps, type StepIdentitySize } from "./StepIdentity"
import stepIdentitySource from "./StepIdentity?raw"
import {
  STEP_IDENTITY,
  STEP_IDENTITY_SERVICE_UNKNOWN,
} from "@/components/workflows/stepIdentityVocabulary"
import { connectionMark, type ConnectionMarkShape } from "@/lib/connectionMark"

afterEach(() => {
  cleanup()
})

// ── Helpers ──────────────────────────────────────────────────────────────────────────

const SIZES: readonly StepIdentitySize[] = ["chip", "row", "spine", "canvas"] as const

const SLACK: ConnectionMarkShape = { service_id: "slack" }
const JIRA: ConnectionMarkShape = { service_id: "jira" }
const SMTP: ConnectionMarkShape = { service_id: "smtp" }
const INTERCOM: ConnectionMarkShape = { service_id: "intercom" }
/** `SEED-206`'s measured hole — a real catalog service this map has never heard of. */
const CLICKUP: ConnectionMarkShape = { service_id: "clickup" }

function renderIdentity(props: Partial<StepIdentityProps> = {}) {
  const { container } = render(
    <StepIdentity
      shape={props.shape ?? SLACK}
      action={props.action ?? "Post a message"}
      service={props.service === undefined ? "Aether Slack" : props.service}
      size={props.size ?? "row"}
      className={props.className}
    />,
  )
  return container
}

function rootOf(container: HTMLElement): HTMLElement {
  const root = container.querySelector<HTMLElement>("[data-step-identity]")
  expect(root).not.toBeNull()
  return root!
}

/** The rendered BODY of the mark. SC#3's wording is against the body, never the component
 *  identity: two keys pointing at one import is a DIFFERENT defect from two imports that
 *  happen to draw the same thing, and only the body tells them apart. */
function markBodyOf(shape: ConnectionMarkShape): string {
  const container = renderIdentity({ shape })
  const svg = container.querySelector("svg")
  expect(svg).not.toBeNull()
  return svg!.innerHTML
}

function markClassOf(shape: ConnectionMarkShape, size: StepIdentitySize = "row"): string {
  const container = renderIdentity({ shape, size })
  const svg = container.querySelector("svg")
  expect(svg).not.toBeNull()
  return svg!.getAttribute("class") ?? ""
}

/** Comment-stripped source. See the header — this module's own prose names the needles. */
const codeOnly = stepIdentitySource
  .split(/\r?\n/)
  .filter((line) => !/^\s*[/*]/.test(line))
  .join("\n")

// ═══════════════════════════════════════════════════════════════════════════════════════
// 1 · Sketch 216 invariant #1 — SIZE IS A MODIFIER, NEVER A FORK
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("size selects a class, never a code path", () => {
  it("the four sizes produce FOUR DISTINCT root class strings", () => {
    const classes = SIZES.map((size) => rootOf(renderIdentity({ size })).getAttribute("class") ?? "")
    expect(new Set(classes).size).toBe(4)
    for (const c of classes) expect(c.length).toBeGreaterThan(0)
  })

  it("the four sizes produce FOUR DISTINCT mark class strings too", () => {
    // The TEXT scale lives here and the MARK scale lives in `connectionMark.tsx`. Both are
    // keyed by the same union; this is the assertion that the SECOND one was widened.
    const classes = SIZES.map((size) => markClassOf(SLACK, size))
    expect(new Set(classes).size).toBe(4)
  })

  it("⚠ the source contains NO branch on `size` — asserted over COMMENT-STRIPPED text", () => {
    expect(codeOnly).not.toContain("size ===")
    expect(codeOnly).not.toContain("if (size")
    expect(codeOnly).not.toContain("switch (size")
  })

  it("POSITIVE CONTROL — the stripper removed prose and left real code behind", () => {
    // Without this, a strip that ate the whole file would make the fence above vacuous —
    // and a strip that removed NOTHING would mean the fence never met the 187-24 trap at all.
    expect(codeOnly.length).toBeGreaterThan(200)
    expect(codeOnly).toContain("export function StepIdentity")
    expect(stepIdentitySource.length).toBeGreaterThan(codeOnly.length + 1000)
  })

  it("the mark size and the text size are driven by ONE prop, passed straight through", () => {
    expect(codeOnly).toContain("TEXT_CLASS[size]")
    expect(codeOnly).toContain("size={size}")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 2 · Sketch 216 invariant #2 — BOTH NAMES ARE PROPS, AND BOTH ARE REQUIRED
// ═══════════════════════════════════════════════════════════════════════════════════════

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type Expect<T extends true> = T

describe("the element receives its two names and resolves nothing", () => {
  it("TYPE-LEVEL — `action` and `service` are both REQUIRED, and only `service` admits null", () => {
    // These are compile-time assertions: `tsconfig.app.json` includes `src`, so a regression
    // that made either prop optional fails `tsc --noEmit -p tsconfig.app.json`, not just here.
    const bothRequired: Expect<
      Equal<
        Pick<StepIdentityProps, "action" | "service">,
        Required<Pick<StepIdentityProps, "action" | "service">>
      >
    > = true
    const serviceNullable: Expect<Equal<StepIdentityProps["service"], string | null>> = true
    const actionNotNullable: Expect<Equal<StepIdentityProps["action"], string>> = true
    const fourSizes: Expect<Equal<StepIdentitySize, "row" | "chip" | "canvas" | "spine">> = true

    expect([bothRequired, serviceNullable, actionNotNullable, fourSizes]).toEqual([
      true,
      true,
      true,
      true,
    ])
  })

  it("both names are RENDERED, each in its own node", () => {
    const container = renderIdentity({ action: "Create an issue", service: "Aether Jira" })
    expect(
      container.querySelector("[data-step-identity-action]")?.textContent,
    ).toBe("Create an issue")
    expect(
      container.querySelector("[data-step-identity-service]")?.textContent,
    ).toBe("Aether Jira")
  })

  it("⚠ it RESOLVES NOTHING — no store, no context, no fetch, no lookup in its source", () => {
    // PATTERNS §4d: `PhaseCard` / `PhaseTimeline` have no `titleOf` and read `Phase` from
    // `StreamsProvider`, while `WorkflowRunPage` DOES have one. An element that resolved its
    // own name would hand those two surfaces different answers for the same step.
    for (const forbidden of [
      "useState",
      "useEffect",
      "useContext",
      "useStreams",
      "fetch(",
      "@/lib/api",
      "useQuery",
    ]) {
      expect(codeOnly).not.toContain(forbidden)
    }
  })

  it("POSITIVE CONTROL — it DOES import the mark resolver and the vocabulary", () => {
    // Without this, a file that imported nothing at all would satisfy the sweep above.
    expect(codeOnly).toContain("@/lib/connectionMark")
    expect(codeOnly).toContain("stepIdentityVocabulary")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 3 · Sketch 216 invariant #5 — THE SEPARATOR IS ITS OWN NODE
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the house middle dot is an element, not a substring", () => {
  it("appears EXACTLY ONCE when both names are present", () => {
    const container = renderIdentity()
    expect(container.querySelectorAll("[data-step-identity-separator]")).toHaveLength(1)
  })

  it("appears ZERO times when the service is null", () => {
    const container = renderIdentity({ service: null })
    expect(container.querySelectorAll("[data-step-identity-separator]")).toHaveLength(0)
  })

  it("⚠ the identity's text is CHARACTER-FOR-CHARACTER the governed composed string", () => {
    // This is what makes the separator node safe: it is EXTRACTED from `STEP_IDENTITY` at
    // module load, not retyped, so the three nodes reassemble into the governed value.
    const container = renderIdentity({ action: "Send an email", service: "Aether Mail" })
    expect(rootOf(container).textContent).toBe(
      STEP_IDENTITY({ action: "Send an email", service: "Aether Mail" }),
    )
  })

  it("⚠ the separator is U+00B7, the house middle dot — not a bullet and not a full stop", () => {
    const container = renderIdentity()
    const sep = container.querySelector("[data-step-identity-separator]")?.textContent ?? ""
    expect(sep).toContain("·")
    expect(sep).not.toContain("•")
    expect(sep).not.toContain(".")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 4 · An unresolvable service renders THE ACTION ALONE
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("a name the system cannot know is never drawn", () => {
  it("null service ⇒ the composed `SERVICE_UNKNOWN` value, which is the action alone", () => {
    const container = renderIdentity({ action: "Post a message", service: null })
    expect(rootOf(container).textContent).toBe(
      STEP_IDENTITY_SERVICE_UNKNOWN({ action: "Post a message" }),
    )
    expect(rootOf(container).textContent).toBe("Post a message")
  })

  it("⛔ NO substitute string of any kind reaches the DOM", () => {
    const container = renderIdentity({ service: null, shape: { capability: "post_message" } })
    const html = container.innerHTML
    for (const forbidden of ["Unknown service", "unknown", "post_message", "—", "n/a", "N/A"]) {
      expect(html).not.toContain(forbidden)
    }
  })

  it("⚠ `grep`-equivalent — the phrase never appears in the component's source either", () => {
    expect(stepIdentitySource).not.toContain("Unknown service")
  })

  it("a BLANK or WHITESPACE service is the same case as null", () => {
    // The wire ships `null` and never `\"\"` — but a name rendering as nothing beside a live
    // separator is the same lie as a fabricated one, and cheaper to prevent than to detect.
    for (const blank of ["", "   ", "\t"]) {
      cleanup()
      const container = renderIdentity({ service: blank })
      expect(container.querySelectorAll("[data-step-identity-separator]")).toHaveLength(0)
      expect(rootOf(container).getAttribute("data-service-resolved")).toBe("false")
    }
  })

  it("POSITIVE CONTROL — a real service DOES resolve, so the arm above is not always taken", () => {
    expect(rootOf(renderIdentity()).getAttribute("data-service-resolved")).toBe("true")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 5 · ⭐ Sketch 216 invariant #6 — RESOLVED-BUT-EMPTY / -IDENTICAL / -INVISIBLE
//
// Ported in STRUCTURE from `lib/__tests__/connectionMark.test.tsx`. The import fence proves
// a slug EXISTS; nothing in the build can prove the person sees it.
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the ink contract, asserted through the element that renders it", () => {
  const BY_INK: [string, ConnectionMarkShape][] = [
    ["self", SLACK],
    ["fill", INTERCOM],
    ["stroke", SMTP],
  ]

  it.each(BY_INK)("ink `%s` renders a NON-EMPTY body", (_ink, shape) => {
    // resolved-but-EMPTY. A slug that resolves to nothing drawable builds, typechecks, and
    // renders a blank box.
    expect(markBodyOf(shape).length).toBeGreaterThan(0)
  })

  it.each(BY_INK)("ink `%s` is the ink the resolver says it is", (ink, shape) => {
    expect(connectionMark(shape).ink).toBe(ink)
  })

  it("two different services do NOT resolve to identical markup", () => {
    // resolved-but-IDENTICAL. A copy-paste mapping two shapes to one import satisfies every
    // other case in this block; only a body comparison fails on it.
    const bodies = [SLACK, JIRA, SMTP, INTERCOM, CLICKUP].map(markBodyOf)
    expect(new Set(bodies).size).toBe(bodies.length)
  })

  it("⚠ a `fill`-ink mark CARRIES the fill utility — without it it is INVISIBLE, not absent", () => {
    // resolved-but-INVISIBLE, and the reason this block exists rather than trusting a green
    // build. Intercom's body has ONE drawable element, ZERO fills and no `currentColor`, so
    // it inherits the SVG default `fill: black` and disappears on Deep Midnight.
    expect(markClassOf(INTERCOM)).toContain("fill-current")
  })

  it("⚠ a `stroke`-ink mark carries NO fill utility — a CSS fill beats lucide's own attribute", () => {
    // `lucide-react` sets `fill=\"none\" stroke=\"currentColor\"` as PRESENTATION attributes,
    // and a CSS rule on the same element beats them — a fill utility here fills the outline
    // into a solid blob. This cannot be a class check on the mark alone; it is an ABSENCE.
    expect(markClassOf(SMTP)).not.toContain("fill-current")
    expect(markClassOf(CLICKUP)).not.toContain("fill-current")
  })

  it("⚠ a `self`-ink mark carries NEITHER a fill NOR a colour utility", () => {
    // Slack's four drawable elements each carry their OWN fill; a colour utility would be
    // inert and a fill utility would flatten four brand colours into one.
    const cls = markClassOf(SLACK)
    expect(cls).not.toContain("fill-current")
    expect(cls).not.toContain("text-muted-foreground")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 6 · Sketch 216 invariant #7 — A VENDORLESS SHAPE TAKES THE INTERFACE'S OWN INK
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("`SEED-206`'s ClickUp hole is answered by the neutral mark, not by a new icon", () => {
  it("an UNMAPPED service takes the NAMED NEUTRAL", () => {
    expect(connectionMark(CLICKUP).key).toBe("unknown")
    expect(markBodyOf(CLICKUP).length).toBeGreaterThan(0)
  })

  it("⛔ it does NOT borrow a vendor's logo", () => {
    // Showing Slack's mark for a service that is not Slack is a claim the system cannot
    // support — the ROADMAP's own named "a logo is approximated" failure.
    const clickup = markBodyOf(CLICKUP)
    for (const vendor of [SLACK, JIRA, INTERCOM]) expect(clickup).not.toBe(markBodyOf(vendor))
  })

  it("⚠ SMTP is VENDORLESS BY NATURE and takes its own interface-ink mark, not a mail VENDOR's", () => {
    // ⚠ MEASURED, and it corrects the plan's wording: SMTP does NOT fall through to the
    // `unknown` neutral — it has its OWN named entry (`smtp` → the lucide mail glyph). The
    // property the two share is the one that matters: both are drawn in the interface's own
    // ink, and neither borrows a vendor mark. `logos` carries no SMTP mark at all, so
    // lending Gmail's to a Fastmail connection would be an approximation.
    expect(connectionMark(SMTP).key).toBe("smtp")
    expect(connectionMark(SMTP).ink).toBe("stroke")
    expect(connectionMark(CLICKUP).ink).toBe("stroke")
    expect(markBodyOf(SMTP)).not.toBe(markBodyOf(CLICKUP))
  })

  it("POSITIVE CONTROL — a KNOWN vendor still shows its own mark", () => {
    // Without this, a resolver that answered `neutral` to every input would satisfy the
    // whole block above while looking perfectly safe.
    expect(connectionMark(SLACK).key).toBe("slack")
    expect(connectionMark(SLACK).ink).toBe("self")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 7 · Sketch 216 invariant #4 — NO WIRE ID REACHES A RUN SURFACE
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("data attributes carry a SHAPE, never a wire id", () => {
  const WIRE_IDS = [
    "send_email",
    "create_ticket",
    "post_message",
    "ask_question",
    "external_action",
  ] as const

  it.each(WIRE_IDS)("`%s` never appears in the rendered markup", (id) => {
    const container = renderIdentity({
      shape: {
        capability: "post_message",
        tool_name: "ask_question",
        service_id: "slack",
        mcp_server_url: "https://example.invalid/mcp",
      },
      action: "Post a message",
      service: "Aether Slack",
    })
    expect(container.innerHTML).not.toContain(id)
  })

  it("POSITIVE CONTROL — the two HUMAN names DO appear, so the sweep is not vacuous", () => {
    const container = renderIdentity({ action: "Post a message", service: "Aether Slack" })
    expect(container.innerHTML).toContain("Post a message")
    expect(container.innerHTML).toContain("Aether Slack")
  })

  it("the only data attributes are presentation tokens and a boolean reading", () => {
    const root = rootOf(renderIdentity())
    const dataAttrs = Array.from(root.attributes)
      .map((a) => a.name)
      .filter((n) => n.startsWith("data-"))
      .sort()
    expect(dataAttrs).toEqual(["data-service-resolved", "data-size", "data-step-identity"])
    expect(root.getAttribute("data-size")).toBe("row")
  })
})

// ═══════════════════════════════════════════════════════════════════════════════════════
// 8 · Accessibility, and the one tampering shape a rendering surface can create
// ═══════════════════════════════════════════════════════════════════════════════════════

describe("the mark is decoration; the two words are the name", () => {
  it("the mark carries `aria-hidden=\"true\"` and the identity's text is its two words", () => {
    const container = renderIdentity({ action: "Create an issue", service: "Aether Jira" })
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true")

    const text = rootOf(container).textContent ?? ""
    expect(text).toContain("Create an issue")
    expect(text).toContain("Aether Jira")
  })

  it("⚠ a display name is rendered as TEXT — no `dangerouslySetInnerHTML` anywhere", () => {
    // A connection's display name is author- or admin-supplied and now reaches five surfaces
    // that previously showed a generic label.
    expect(stepIdentitySource).not.toContain("dangerouslySetInnerHTML")

    const container = renderIdentity({ service: "<img src=x onerror=alert(1)>" })
    expect(container.querySelector("img")).toBeNull()
    expect(container.querySelector("[data-step-identity-service]")?.textContent).toBe(
      "<img src=x onerror=alert(1)>",
    )
  })
})
