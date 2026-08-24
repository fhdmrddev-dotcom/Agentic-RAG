/**
 * Phase 195 Plan 02 Task 1 — the FIRST direct coverage of `OutputFileCard`
 * anywhere in this repository (195-RESEARCH.md F5, 195-PATTERNS.md § "No Analog
 * Found": *"An `OutputFileCard.test.tsx` — ⚠ ABSENT anywhere in the tree"*).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THIS FILE PINS, AND WHY IT EXISTS BEFORE THE CHANGE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **D-08 requires the states below to survive the Phase 195 extraction
 * BYTE-IDENTICAL.** Two of them — the `supersedes` subline and the inert
 * `data-variant` attribute — had **zero coverage anywhere in the tree** when
 * this file was written, so the D-08 claim could not have been checked after
 * the fact. Plan **195-04** converts this component's internals onto the shared
 * `FileRow`; **every assertion in this file is expected to stay unchanged
 * through that conversion.** An assertion that has to be edited to make 195-04
 * pass is a behaviour change that D-08 forbids, not a test that needs updating.
 *
 * ⚠ THE ORDER IS THE POINT. This suite is authored in wave 1, against the
 * UNMOVED tree measured by `195-BASELINE.md`. A characterization written after
 * the conversion characterizes the conversion (the 188.1 lesson).
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THIS FILE IS ALSO D-20's THIRD SURFACE
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * `195-BASELINE.md` § "Arm 3" measured, LIVE, that **chat renders NOTHING for a
 * workflow deliverable** — `document.querySelector('[data-testid="output-file-card"]')`
 * returned `null` on the very thread that owns the file, by construction (D-14:
 * a workflow emit returns `path`, and `RunCard` parses `output_files` out of
 * `tool_calls`). D-20's three-surface side-by-side is therefore discharged as
 * **two LIVE surfaces + ONE FIXTURE, and this file is that fixture.** The
 * § "the chat row as it ships TODAY" block below is the phase's only record of
 * what the chat row looks like, and it deliberately pins the same properties
 * the other two surfaces were measured on so the three are comparable:
 *
 *   |            | Run page (live)      | Panel (live)                | Chat (HERE) |
 *   |------------|----------------------|-----------------------------|-------------|
 *   | Element    | BUTTON               | DIV[role=option]            | A[href][download] |
 *   | Text       | basename             | full path                   | `filename` VERBATIM |
 *   | Padding    | px-2 py-2 (33 px)    | px-2.5 py-2 (38 px)         | px-3 py-2 |
 *   | Icon       | lucide-file-text 16px, NO ribbon, THEME TOKEN class  | same, other token | `fileIcon()` 30px + `.EXT` ribbon, INLINE HEX |
 *
 * ⚠ **"One icon path" is therefore a VISIBLE change, not a no-op** — the run
 * page and the panel render a flat 16 px monochrome lucide glyph with no
 * ribbon; chat renders a stacked category-coloured glyph at 30 px WITH a mono
 * `.EXT` ribbon. This file is what makes that provable later.
 *
 * ⚠ **AND THE TRAP: assert on the CLASS / TOKEN NAME, never on a resolved
 * `rgb()`.** `195-BASELINE.md` § "REFINED 2026-08-17" measured that
 * `--muted-foreground` and `--panel-muted-foreground` are **IDENTICAL in the
 * shipped dark theme** (`220 16% 65%`) and **DIFFERENT in light** (`220 9% 46%`
 * vs `220 12% 40%`, the panel token existing because light `--muted-foreground`
 * measured **4.01:1 — below the AA floor**, `PanelSection.tsx:85`). A resolved
 * colour assertion therefore **cannot tell the two tokens apart in the theme
 * jsdom renders**: it would pass green while a light-theme contrast regression
 * ships. Every colour-adjacent assertion below is on a class name or on the
 * PRESENCE of an inline style, never on a computed value.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * DELIBERATE OMISSION, recorded so it reads as a CHOICE rather than a gap
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * **No case covers the 3 s auto-clearing in-row download error**
 * (`OutputFileCard.tsx:136-137` / `:173-175`). It needs fake timers, and it is
 * NOT one of the two states D-08 names — adding it here buys future flake for
 * zero D-08 coverage.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * CONSTRUCTION NOTES
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * - The component is rendered **DIRECTLY**, not through `MessageItem`. The only
 *   shipped coverage (`src/__tests__/components/MessageItem.finalOutputs.test.tsx`)
 *   is an INDIRECT harness, and P3(b)'s dead-branch `supersedes` arm is not
 *   reachable through it with any shipped fixture.
 * - Fixtures are **inline literals**. `OutputFileCardProps` is NOT exported
 *   (`OutputFileCard.tsx:39`), and **exporting it would itself be a
 *   public-surface change** — so this plan does not export it. `makeFile()`
 *   below therefore types its return with a local structural alias, never with
 *   an import from the component.
 * - `renderWithTooltip` mirrors `MessageItem.finalOutputs.test.tsx:32-34` ≡
 *   `NavRow.test.tsx:15-17` — two independent suites converged on it.
 */
import { describe, it, expect, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"
import type { ReactElement } from "react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { OutputFileCard } from "@/components/chat/OutputFileCard"

// ── Fixtures ──────────────────────────────────────────────────────────────────
//
// A LOCAL structural alias, not an import. `OutputFileCardProps` is unexported
// on purpose (195-PATTERNS.md § 4 gotcha (c)) and this suite must not be the
// reason it becomes public.
type FileFixture = {
  filename: string
  url?: string
  size?: number
  supersedes?: string
  is_hero?: boolean
}

/** The `make…(overrides: Partial<T> = {}) : T` idiom from
 *  `MessageItem.finalOutputs.test.tsx:36-48`. ⚠ `url` is NOT defaulted — the
 *  dead branch is selected by its ABSENCE (`!file.url`), and a builder that
 *  always supplies one makes P3(b) structurally unreachable, which is exactly
 *  the defect F5 names. */
function makeFile(overrides: Partial<FileFixture> = {}): FileFixture {
  return { filename: "renewal-letter.docx", ...overrides }
}

const LIVE = { url: "/sandbox-outputs/renewal-letter.docx" }
const SUPERSEDES = "draft-v1.docx"
/** The literal as it renders, trailing space included. Written ONCE, here, so
 *  case 3 asserts the copy rather than a paraphrase of it. */
const REPLACES_PREFIX = "Replaces: "
const REPLACES_FULL = `${REPLACES_PREFIX}${SUPERSEDES}`

function renderWithTooltip(ui: ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** The `supersedes` subline is a LEAF span (no element children). Resolving it
 *  structurally rather than by class means a class rename does not red this
 *  helper, while a COPY change still reds case 3 — which is the property under
 *  test. Returns `null` when no leaf span mentions the superseded name, which
 *  is itself the failure signal for P3(a)/P3(b). */
function sublineText(container: HTMLElement, needle: string): string | null {
  const leaves = Array.from(container.querySelectorAll("span")).filter(
    (s) => s.querySelectorAll("*").length === 0,
  )
  const hit = leaves.find((s) => (s.textContent ?? "").includes(needle))
  return hit ? (hit.textContent ?? "") : null
}

afterEach(() => cleanup())

// ─────────────────────────────────────────────────────────────────────────────
describe("195-02 — OutputFileCard `supersedes`: the subline is written TWICE and both are pinned (D-08, P3)", () => {
  /**
   * ⚠ THE SUBLINE EXISTS IN BOTH BRANCHES OF THIS COMPONENT — the live branch
   * at `OutputFileCard.tsx:168-172` and the DEAD branch at `:101-105`. P3(b)
   * records why that matters: *"a fence rendering only a url-bearing fixture
   * structurally cannot see the dead branch."* The two cases below are
   * therefore SEPARATE and each is driven RED independently (see the SUMMARY's
   * plant table: deleting one block must leave the other case GREEN).
   */

  it("LIVE branch: a url-bearing file with `supersedes` renders the Replaces subline", () => {
    const { container } = renderWithTooltip(
      <OutputFileCard file={makeFile({ ...LIVE, supersedes: SUPERSEDES })} />,
    )
    // The live branch really is the one under test: its root is the anchor.
    expect(container.firstElementChild?.tagName).toBe("A")
    expect(screen.getByText(REPLACES_FULL)).toBeTruthy()
  })

  it("DEAD branch: a file with NO url and `supersedes` renders the SAME subline", () => {
    // ⚠ The arm F5 says nothing in the tree could see before this file existed.
    // No `url` key at all — the dead branch is selected by absence, not by "".
    const { container } = renderWithTooltip(
      <OutputFileCard file={makeFile({ supersedes: SUPERSEDES })} />,
    )
    // The dead branch really is the one under test: root is a div, marked dead.
    expect(container.firstElementChild?.tagName).toBe("DIV")
    expect(container.querySelector('[data-dead="true"]')).not.toBeNull()
    expect(screen.getByText(REPLACES_FULL)).toBeTruthy()
  })

  it("the LITERAL is `Replaces: ` — asserted exactly, so a copy change reds", () => {
    // Deliberately NOT /replaces/i. A loose matcher survives "Replaced:",
    // "replaces", or a re-worded prefix — none of which is byte-identical, and
    // byte-identical is what D-08 asks for.
    const { container } = renderWithTooltip(
      <OutputFileCard file={makeFile({ ...LIVE, supersedes: SUPERSEDES })} />,
    )
    const text = sublineText(container, SUPERSEDES)
    expect(text).toBe(REPLACES_FULL)
    // Stated separately: the trailing space is part of the rendered copy. JSX
    // emits `Replaces: ` and the value as two adjacent text nodes, so the
    // single space between them is the source's, not the normalizer's.
    expect(text?.startsWith(REPLACES_PREFIX)).toBe(true)
  })

  it("NEGATIVE CONTROL — no `supersedes` renders no subline, in EITHER branch", () => {
    // Without this, cases 1-3 are equally consistent with a component that
    // renders "Replaces:" unconditionally.
    const live = renderWithTooltip(<OutputFileCard file={makeFile(LIVE)} />)
    expect(live.container.textContent ?? "").not.toContain("Replaces")
    cleanup()

    const dead = renderWithTooltip(<OutputFileCard file={makeFile()} />)
    expect(dead.container.textContent ?? "").not.toContain("Replaces")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("195-02 — OutputFileCard dead-link state, pinned in FOUR independent cases (D-08, P2)", () => {
  /**
   * ⚠ FOUR CASES, NOT FOUR `expect`s IN ONE. P2 records the reason: the shipped
   * coverage at `MessageItem.finalOutputs.test.tsx:111-125` asserts the
   * attribute and the copy with two `expect`s in a single case, and **the first
   * short-circuits the second** — so a plant that changes only the copy reds a
   * case that was already red for the attribute, and the copy clause is never
   * actually exercised. Split, each clause is proved able to fail on its own.
   */
  const DEAD = () => makeFile({ filename: "legacy.png" })

  it("(a) the ATTRIBUTE clause: the row carries data-dead=\"true\"", () => {
    const { container } = renderWithTooltip(<OutputFileCard file={DEAD()} />)
    expect(container.querySelector('[data-dead="true"]')).not.toBeNull()
  })

  it("(b) the COPY clause: the row says `Download unavailable`", () => {
    renderWithTooltip(<OutputFileCard file={DEAD()} />)
    expect(screen.getByText("Download unavailable")).toBeTruthy()
  })

  it("(c) the affordance is a <span aria-disabled=\"true\">, never a <button>", () => {
    const { container } = renderWithTooltip(<OutputFileCard file={DEAD()} />)
    const affordance = container.querySelector('[aria-disabled="true"]')
    expect(affordance).not.toBeNull()
    expect(affordance?.tagName).toBe("SPAN")
    // The title is the long-form of the same honesty and is pinned with it.
    expect(affordance?.getAttribute("title")).toBe(
      "Download unavailable — this file has no link",
    )
  })

  it("(d) the dead row contains ZERO <button> elements — pinned HERE, at its source", () => {
    /**
     * ⚠ THIS IS THE PROPERTY THAT KEEPS `WorkflowRunPage.test.tsx:991` GREEN
     * AFTER PLAN 195-06 UNIFIES (F8). That suite asserts
     * `region.querySelectorAll("button")).toHaveLength(0)` on the run page's
     * id-less row; once the region adopts the shared row, the run page inherits
     * whatever element THIS component uses for its dead affordance. Pinning it
     * at the source turns that from luck into a contract.
     */
    const { container } = renderWithTooltip(<OutputFileCard file={DEAD()} />)
    expect(container.querySelectorAll("button")).toHaveLength(0)
    // POSITIVE CONTROL — the probe really does find a button when one exists,
    // so a `toHaveLength(0)` cannot pass because the query is wrong.
    const probe = document.createElement("div")
    probe.innerHTML = "<button>x</button>"
    expect(probe.querySelectorAll("button")).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("195-02 — `variant` is INERT: it changes the attribute and NOTHING else (D-095.1-06)", () => {
  /**
   * D-095.1-06 REVERSED the hero/working visual split (operator-approved
   * CONTEXT decision, Phase 095.1 Plan 05). `variant` survives as a
   * passthrough `data-variant` for call-site back-compat ONLY — see
   * `OutputFileCard.tsx:58-63`: *"INERT layout flag … this prop no longer
   * changes the rendered shape."*
   *
   * ⚠ THIS CASE EXISTS SO A FUTURE READER CANNOT MISTAKE THE SURVIVING
   * ATTRIBUTE FOR A SURVIVING BEHAVIOUR. It also fences plan 195-04 against
   * re-introducing the retired split as a `cva` variants block while
   * "preserving the prop" (195-PATTERNS.md § 1: *"a `cva` variants block would
   * re-introduce the retired hero/working split as a code shape"*).
   */
  function shapeOf(variant: "hero" | "working") {
    const { container } = renderWithTooltip(
      <OutputFileCard file={makeFile({ ...LIVE, size: 18841 })} variant={variant} />,
    )
    const root = container.firstElementChild as HTMLElement
    const shape = {
      tag: root.tagName,
      className: root.getAttribute("class") ?? "",
      dataVariant: root.getAttribute("data-variant"),
      text: container.textContent ?? "",
      childTags: Array.from(root.children).map((c) => c.tagName).join(","),
    }
    cleanup()
    return shape
  }

  it("hero and working render the SAME tag, the SAME class list and the SAME children", () => {
    const hero = shapeOf("hero")
    const working = shapeOf("working")
    expect(hero.tag).toBe(working.tag)
    expect(hero.className).toBe(working.className)
    expect(hero.childTags).toBe(working.childTags)
    expect(hero.text).toBe(working.text)
  })

  it("…and differ ONLY in the data-variant attribute value", () => {
    expect(shapeOf("hero").dataVariant).toBe("hero")
    expect(shapeOf("working").dataVariant).toBe("working")
    // Default: an omitted prop is "working" (`OutputFileCard.tsx:74`).
    const { container } = renderWithTooltip(<OutputFileCard file={makeFile(LIVE)} />)
    expect(container.firstElementChild?.getAttribute("data-variant")).toBe("working")
  })

  it("the dead branch writes data-variant too (`:95`), not only the live one", () => {
    const { container } = renderWithTooltip(
      <OutputFileCard file={makeFile()} variant="hero" />,
    )
    expect(container.firstElementChild?.getAttribute("data-variant")).toBe("hero")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("195-02 — the size cell is rendered only when `size != null` (`:177`)", () => {
  it("a fixture with NO size renders no size cell", () => {
    const { container } = renderWithTooltip(<OutputFileCard file={makeFile(LIVE)} />)
    expect(container.textContent ?? "").not.toMatch(/\d+(\.\d+)?\s?(B|KB|MB)\b/)
  })

  it("a fixture WITH size renders formatBytes' output", () => {
    // 18841 / 1024 = 18.399… → "18.4 KB" (KiB formatting, `:27`).
    renderWithTooltip(<OutputFileCard file={makeFile({ ...LIVE, size: 18841 })} />)
    expect(screen.getByText("18.4 KB")).toBeTruthy()
  })

  it("size 0 renders `0 B` — the `!= null` guard is not a truthiness guard", () => {
    // `file.size != null` admits 0; `file.size &&` would not. Pinned because the
    // extraction is the moment that guard is most likely to be rewritten.
    renderWithTooltip(<OutputFileCard file={makeFile({ ...LIVE, size: 0 })} />)
    expect(screen.getByText("0 B")).toBeTruthy()
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("195-02 — the chat row as it ships TODAY (D-20's third surface, recorded as a FIXTURE)", () => {
  /**
   * ⚠ THIS BLOCK IS NOT A BYTE-IDENTITY FENCE — it is the phase's ONLY record
   * of the chat presentation, because `195-BASELINE.md` § "Arm 3" measured LIVE
   * that chat renders NO file card at all for a workflow deliverable. The
   * properties pinned here are deliberately the SAME ones the run page and the
   * panel were measured on, so the three-surface comparison D-20 asks for has
   * three rows instead of two.
   */

  it("the live row is an <a> with href, download and target — not a button, not a div[role]", () => {
    const { container } = renderWithTooltip(
      <OutputFileCard file={makeFile({ ...LIVE, size: 18841 })} />,
    )
    const root = container.firstElementChild as HTMLElement
    expect(root.tagName).toBe("A")
    expect(root.getAttribute("download")).toBe("renewal-letter.docx")
    expect(root.getAttribute("target")).toBe("_blank")
    expect(root.getAttribute("href")).toContain("/sandbox-outputs/renewal-letter.docx")
    // Contrast, measured live: the run page's row is a BUTTON and the panel's is
    // a DIV[role=option]. Three wrapper elements, three a11y contracts.
    expect(root.getAttribute("role")).toBeNull()
  })

  it("chat renders `filename` VERBATIM — it derives no basename (the run page does)", () => {
    // Measured live: the run page shows `Northwind-QBR-Template.docx` (basename)
    // while the panel shows `/Northwind-QBR-Template.docx` (full path). Chat
    // does neither — it prints exactly the string it was handed. A slash in the
    // fixture is what makes that a MEASUREMENT rather than a coincidence.
    renderWithTooltip(
      <OutputFileCard file={makeFile({ filename: "output/renewal-letter.docx", ...LIVE })} />,
    )
    expect(screen.getByText("output/renewal-letter.docx")).toBeTruthy()
    expect(screen.queryByText("renewal-letter.docx")).toBeNull()
  })

  it("the row's own padding classes are px-3 py-2 (run page px-2 py-2 · panel px-2.5 py-2)", () => {
    const { container } = renderWithTooltip(<OutputFileCard file={makeFile(LIVE)} />)
    const cls = container.firstElementChild?.getAttribute("class") ?? ""
    expect(cls).toContain("px-3")
    expect(cls).toContain("py-2")
  })

  it("the icon is fileIcon() — a 30 px glyph WITH a mono `.EXT` ribbon", () => {
    // ⚠ THIS IS THE EVIDENCE THAT "ONE ICON PATH" IS A VISIBLE CHANGE.
    // `195-BASELINE.md` arm 1/arm 3 measured the other two surfaces rendering a
    // flat `lucide-file-text h-4 w-4` glyph at 16×16 with **no ribbon**
    // (`svg text` node count = 0). Chat renders a stacked 30 px glyph plus the
    // parsed-extension ribbon below it.
    const { container } = renderWithTooltip(<OutputFileCard file={makeFile(LIVE)} />)
    const svg = container.querySelector("svg")
    expect(svg?.getAttribute("width")).toBe("30")
    expect(svg?.getAttribute("height")).toBe("30")
    expect(screen.getByText(".DOCX")).toBeTruthy()
  })

  it("the icon colour is an INLINE category hex, NOT a theme token class", () => {
    /**
     * ⚠ ASSERTED ON THE CLASS / TOKEN NAME, NEVER ON A RESOLVED `rgb()`, AND
     * THAT IS LOAD-BEARING. `195-BASELINE.md` § "REFINED 2026-08-17" measured
     * `--muted-foreground` and `--panel-muted-foreground` as IDENTICAL in the
     * shipped dark theme and DIFFERENT in light (where the panel token exists
     * because the global one measured 4.01:1, below the AA floor). A resolved
     * colour assertion cannot tell those two apart in the theme jsdom renders —
     * it would pass green while a light-theme contrast regression ships.
     *
     * What is pinned instead: chat's icon carries NEITHER token class, because
     * `fileIcon()` tints inline from `EXT_MAP`. So a "unify onto one token"
     * change is visible HERE as the appearance of a class, not as a colour.
     */
    const { container } = renderWithTooltip(<OutputFileCard file={makeFile(LIVE)} />)
    const iconWrapper = container.querySelector('[aria-hidden="true"].inline-flex') as HTMLElement
    expect(iconWrapper).not.toBeNull()
    const cls = iconWrapper.getAttribute("class") ?? ""
    expect(cls).not.toContain("text-muted-foreground")
    expect(cls).not.toContain("text-panel-muted-foreground")
    // POSITIVE CONTROL — the same probe DOES find those tokens when present, so
    // the two absences above are not vacuous.
    const probe = document.createElement("span")
    probe.setAttribute("class", "h-4 w-4 text-panel-muted-foreground")
    expect(probe.getAttribute("class") ?? "").toContain("text-panel-muted-foreground")
    // …and the colour really is applied, inline, from the ext map.
    expect(iconWrapper.getAttribute("style") ?? "").toContain("color")
  })
})

// ─────────────────────────────────────────────────────────────────────────────
describe("195-02 — T-195-02-01: model-derived strings are a TEXT sink, never a markup sink", () => {
  /**
   * `file.filename` and `file.supersedes` are backend/model-derived strings
   * that cross into JSX here. The threat register's disposition is `mitigate`:
   * the sink must stay text-only, and no `dangerouslySetInnerHTML` may be
   * introduced by the extraction. This was true before Phase 195 and is now
   * pinned, which is the honest scale of the claim.
   */
  const PAYLOAD = '<img src=x onerror="alert(1)">'

  it("a markup-shaped `supersedes` renders as LITERAL TEXT, injecting no element", () => {
    const { container } = renderWithTooltip(
      <OutputFileCard file={makeFile({ ...LIVE, supersedes: PAYLOAD })} />,
    )
    expect(container.querySelector("img")).toBeNull()
    expect(sublineText(container, PAYLOAD)).toBe(`${REPLACES_PREFIX}${PAYLOAD}`)
  })

  it("a markup-shaped `filename` renders as LITERAL TEXT too, in BOTH branches", () => {
    const live = renderWithTooltip(<OutputFileCard file={makeFile({ filename: PAYLOAD, ...LIVE })} />)
    expect(live.container.querySelector("img")).toBeNull()
    expect(screen.getByText(PAYLOAD)).toBeTruthy()
    cleanup()

    const dead = renderWithTooltip(<OutputFileCard file={makeFile({ filename: PAYLOAD })} />)
    expect(dead.container.querySelector("img")).toBeNull()
    expect(screen.getByText(PAYLOAD)).toBeTruthy()
  })
})
