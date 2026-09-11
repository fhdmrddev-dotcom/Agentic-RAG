/**
 * Phase 243 Plan 01 (CHAT-01 / CHAT-04 / D-243-16) — the PRE-EXTRACTION characterization net
 * for the thinking block.
 *
 * ⚠ THIS SUITE IS WRITTEN BEFORE ANYTHING MOVES, AND THAT IS ITS ENTIRE VALUE. Measured at
 * this base: `grep -rn "thinking-trigger|thinking-row"` across every suite in the tree returns
 * ZERO matches, so "the extraction changed no pixel" is today an ASSERTION and not a
 * MEASUREMENT. Plan 243-02 moves the thinking block out of `RunCard` and mounts it from
 * `MessageItem`; every case below must STILL PASS across that move, unedited. An edited fence
 * proves nothing about a move.
 *
 * ⭐ WHY THESE CASES RENDER `<MessageItem>` AND NOT THE CARD THEY CURRENTLY LIVE IN. A net
 * anchored to the component the code LEAVES cannot certify that the code moved safely. The
 * project's own precedent is one phase old: `src/__tests__/components/MessageItem.clamp.test.tsx`
 * imports `MessageItem`, not `UserMessageBubble`, which is exactly why the Phase 227 clamp cases
 * survived the bubble being extracted OUT of `MessageItem`. Only §6 anchors to the card, and
 * only because 243-02 explicitly LEAVES the planning placeholder and the elapsed segment there.
 *
 * ⛔ THE ONE PLAN PERMITTED TO CHANGE ANY OF THIS IS 243-04, and only two cases:
 *   • §5 (the body's class tokens) — sketch 234's V1 diff drops `font-mono`,
 *     `whitespace-pre-wrap`, `max-h-64` and `overflow-y-auto`, and moves `text-xs` → `text-sm`.
 *     `border-l-2` and `ml-3` STAY. Reason: the shipped body is a nested scroller in a
 *     monospaced voice; the sketch's winner is prose in the page's own scroll.
 *   • §2 / §1a (the trigger label) — `Thinking` / `Thinking...` becomes `Thought for N seconds`
 *     under D-243-13, which also has to find that number an honest source first.
 * Any other plan turning one of these red has changed a pixel it did not mean to.
 *
 * ⚠ 243-04 MADE A THIRD EDIT, AND IT IS RECORDED HERE RATHER THAN ABSORBED. §10's needle
 * gained a second arm. It is not a pixel and it is not an exemption: V1's body renders real
 * paragraphs, so the single-arm needle matched no file at all and §10c read `expected [] to
 * have a length of 1`. The uniqueness claim is UNCHANGED and the discrimination is STRONGER
 * (§10b now drives both arms plus the two innocents a looser needle would have caught).
 * ⛔ A fence re-aimed to keep passing would be the failure; this one was re-aimed to keep
 * MEANING the same thing, and the RED that forced it is quoted at the needle.
 *
 * ⚠ TWO CASES PIN A DEFECT ON PURPOSE — §8 and §9. They assert what is WRONG today so that
 * 243-02's inversion is a MEASURED improvement rather than a side effect. Neither is ever to
 * be read as desired behaviour.
 *
 * ⚠ THE SETTLED/STREAMING SPLIT IS LOAD-BEARING, NOT A STYLE CHOICE. `RunCard` gates its whole
 * body behind `expanded = isStreamingNow || !hasTools || userExpanded`, and `MessageItem` mounts
 * the card ONLY for a turn with tool calls — so through that boundary `hasTools` is always true
 * and a SETTLED turn renders no thinking block at all until the collapsed run row is clicked.
 * Every settled case below therefore expands first (§1, §4, §5, §7, §9); the streaming cases
 * (§2, §3) must NOT, because `isStreamingNow` already makes `expanded` true. A settled case that
 * asserted without expanding would be asserting against an UNRENDERED subtree — it would pass
 * with the logic entirely broken, which is the vacuous-fence failure this phase exists to avoid.
 */
import { describe, it, expect, afterEach, vi } from "vitest"
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react"
import { TooltipProvider } from "@/components/ui/tooltip"
import { MessageItem } from "@/components/chat/MessageItem"
import { RunCard } from "@/components/chat/RunCard"
import type { Message, ToolCall } from "@/types"

const NOW = new Date().toISOString()

/** The house harness, copied verbatim from RunCard.characterization.test.tsx:55-57 —
 *  TooltipProvider and nothing else. No router, no provider, no store. */
function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}

/** Local fixture factory, modelled on RunCard.characterization.test.tsx:28-53. There is no
 *  shared fixture module in this tree and this suite does not invent one. */
function makeMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-thinking-1",
    thread_id: "thread-1",
    user_id: "user-1",
    role: "assistant",
    content: "Assistant response text",
    created_at: NOW,
    updated_at: NOW,
    model: "deepseek-reasoner",
    provider: "deepseek",
    tool_calls: [
      {
        id: "tc-1",
        name: "search_documents",
        args: { query: "knowledge" },
        status: "done",
        result: JSON.stringify([{ id: "doc-1", title: "Doc 1" }]),
        startedAt: 1_000_000,
        endedAt: 1_001_500,
      } as ToolCall,
    ],
    ...overrides,
  } as Message
}

/**
 * D-243-03 measured the reasoning corpus on this machine: median 198 chars, max 33,713 — a
 * 170× spread. A suite that exercises one end has not exercised the design, so both ends are
 * fixtures here. The median one CARRIES NEWLINES deliberately: `whitespace-pre-wrap` is one of
 * the four classes 243-04 drops, and the prose has to be asserted verbatim, newlines included.
 */
const REASONING_MEDIAN = [
  "The user is asking about the retention policy.",
  "I should search the knowledge base for the current document before answering,",
  "because the policy was revised and my memory is not a source I can cite.",
].join("\n") // measured: 197 chars — one off the corpus median of 198

/** Built programmatically — 33 KB is not pasted into a tracked file.
 *  Measured: 32,951 chars, just under the corpus maximum of 33,713. */
const REASONING_LONG = Array.from(
  { length: 435 },
  (_, i) => `Step ${i + 1}: weighing the retrieved passage against the question asked, again.`,
).join("\n")

/** Identity normalizer — the newlines ARE part of the deliverable, so the default
 *  whitespace-collapsing normalizer would assert something weaker than what ships. */
const RAW = (s: string) => s

/**
 * The SOURCE SWEEP (used by 10 and 12), added by 243-02. The `import.meta.glob` form is the
 * one `WorkspacePanel.test.tsx:1137-1141` already uses - eager, `?raw`, un-stripped by Vite.
 * It is deliberately a GLOB rather than a per-file `?raw` import: a glob whose file does not
 * exist yet simply has no key, so the fence reads "expected 0 to be 1" instead of the whole
 * suite dying at module resolution.
 * The Vite plugin requires a STATIC literal here; a shared `const` is rejected.
 */
const CHAT_TSX = import.meta.glob<string>("../**/*.tsx", {
  eager: true,
  query: "?raw",
  import: "default",
})

/** Production source only - a fence that swept its own test files would red on itself. */
const CHAT_SRC: Record<string, string> = Object.fromEntries(
  Object.entries(CHAT_TSX).filter(
    ([path]) => !path.includes("__tests__") && !/\.test\.tsx?$/.test(path),
  ),
)

/**
 * COMMENTS ARE STRIPPED BEFORE ANY COUNT - a fence a comment can satisfy is not a fence.
 * Phase 194.1 tripped its own `chat` sweep twice on docblocks that merely explained the rule
 * they were breaking. (The line-comment arm keeps a preceding non-colon char so a `https`
 * URL inside a string is not mistaken for a line comment.)
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")
}

/** The stripped source of one chat file, by basename. Throws loudly if it is not swept. */
function chatSource(basename: string): string {
  const hit = Object.entries(CHAT_SRC).find(([path]) => path.endsWith("/" + basename))
  if (!hit) {
    throw new Error(
      basename + " is not in the chat sweep - " + Object.keys(CHAT_SRC).length + " files seen",
    )
  }
  return stripComments(hit[1])
}

/**
 * THE NEEDLE, AND ITS NARROWING IS THE WHOLE POINT. This matches a JSX CHILD interpolation
 * of the reasoning value - a component RENDERING the reasoning body. It deliberately does
 * NOT match:
 *   - a prop being PASSED, `reasoningContent={message.reasoningContent}` (that brace is
 *     preceded by `=`, which is why the leading `[^=]` is load-bearing, not decoration), or
 *   - a guard READING it, `!message.reasoningContent`, which state 2 still needs.
 * Written bare as /reasoningContent/ the fence would count three files and mean nothing.
 *
 * ⚠⚠ SECOND ARM ADDED BY 243-04, AND THE FENCE WOULD HAVE READ **ZERO** WITHOUT IT.
 * D-243-02 changes the body from one interpolated string to sketch 234 V1's real
 * paragraphs (`index.html:332`), so the shipped render is now
 * `{toParagraphs(reasoningContent).map(...)}` and the single-arm needle matched NOTHING -
 * §10c failed `expected [] to have a length of 1`. ⭐ That RED is the fence working: a
 * source fence has to know what a render LOOKS like, so a change to the render shape is
 * exactly the moment it must be re-aimed. ⛔ The fix is an ALTERNATION of two NAMED render
 * shapes, never a widening to `[^}]*reasoningContent[^}]*` - measured, that looser form
 * matches BOTH innocents in the tree (`RunCard.tsx:487`'s state-2 guard and
 * `MessageItem.tsx:612`'s banner-label call), which would turn a uniqueness fence into a
 * fence that reds on correct code. §10b drives both arms and both of those innocents.
 */
const RENDERS_REASONING = new RegExp(
  [
    // arm 1 - the pre-243-04 shape, kept: `{reasoningContent}` / `{message.reasoningContent}`
    "(^|[^=]){\\s*(?:message\\.)?reasoningContent\\s*}",
    // arm 2 - V1's shape: the paragraph split, rendered as children
    "(^|[^=]){\\s*toParagraphs\\(\\s*(?:message\\.)?reasoningContent\\s*\\)",
  ].join("|"),
)

/** The one JSX element that mounts `tag`, comments stripped, asserted to be unique. */
function soleMountExpression(src: string, tag: string): string {
  const occurrences = src.split("<" + tag).length - 1
  expect(occurrences).toBe(1)
  const at = src.indexOf("<" + tag)
  const end = src.indexOf("/>", at)
  expect(end).toBeGreaterThan(at)
  return src.slice(at, end + 2)
}

/**
 * ⚠ THE EXACT COPY, AND A LOOSE REGEX WILL NOT DO — MEASURED, on this suite's first run.
 * `/planning next step/` matched the RUN HEADER's own `planning next step…` (a separate
 * string, with a typographic ellipsis, from the card's status-verb helper), so §6b's
 * mutual-exclusion case failed against correct code. The thinking row's copy is this one and
 * nothing else; asserting it exactly is what distinguishes the two surfaces.
 */
const PLANNING_COPY = "Thinking · planning next step"

/** The chevron inside FoldTrigger is an SVG and contributes no text, so a trigger's
 *  textContent is exactly its label. Trimmed so a stray whitespace edit is not a failure. */
function triggerText(): string {
  return (screen.getByTestId("thinking-trigger").textContent ?? "").trim()
}

/** SETTLED CASES ONLY. `RunCard`'s `expanded` gate hides the entire body of a settled
 *  tool-bearing turn; this opens it. Forward-compatible with 243-02: once the block mounts
 *  from `MessageItem` it sits OUTSIDE that gate, so a case that clicks and then asserts
 *  still passes. */
function expandSettledRun(): void {
  fireEvent.click(screen.getByTestId("run-card-collapsed"))
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("Phase 243 — the thinking block, characterized against the UNMOVED code (D-243-16)", () => {
  // ── §1 — the settled reasoning fold. SETTLED: expands the collapsed run row first. ──
  describe("§1 — the settled reasoning fold", () => {
    it("§1a — a settled tool-bearing turn labels the trigger exactly `Thinking`, once the run row is open", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
      expandSettledRun()
      // CONTENT equality, not a substring: `Thinking...` must not satisfy this case.
      // ⚠ 243-04 changes this string to `Thought for N seconds` (D-243-13). No other plan may.
      expect(triggerText()).toBe("Thinking")
    })

    it("§1b — the fold is CLOSED by default: the reasoning prose is absent before the trigger is clicked", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
      expandSettledRun()
      // The trigger is present and correctly labelled — the positive control that proves this
      // absence is measured against a RENDERED subtree — and the prose is not.
      expect(triggerText()).toBe("Thinking")
      expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    })

    it("§1c — clicking the trigger reveals the reasoning prose verbatim, newlines included", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
      expandSettledRun()
      fireEvent.click(screen.getByTestId("thinking-trigger"))
      const body = screen.getByText(REASONING_MEDIAN, { normalizer: RAW })
      expect(body).toBeInTheDocument()
      expect(body.textContent).toBe(REASONING_MEDIAN)
      expect(body.textContent).toContain("\n")
      // This is the SHORT end of D-243-03's 170× spread — §1d drives the other one.
      expect(REASONING_MEDIAN.length).toBeLessThan(300)
    })

    it("§1d — the 33 KB end of the 170× spread renders verbatim too (D-243-03)", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_LONG })} />)
      expandSettledRun()
      fireEvent.click(screen.getByTestId("thinking-trigger"))
      const body = screen.getByText(REASONING_LONG, { normalizer: RAW })
      expect(body.textContent).toBe(REASONING_LONG)
      // The fixture is the measured end of the range, not a token long string.
      expect(REASONING_LONG.length).toBeGreaterThan(30_000)
    })
  })

  // ── §2 — STREAMING: no click. `isStreamingNow` already makes `expanded` true. ──
  it("§2 — a STREAMING turn labels the trigger exactly `Thinking...` with three ASCII dots, never the single ellipsis character", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ runStatus: "streaming", reasoningContent: REASONING_MEDIAN })}
        isStreaming
      />,
    )
    expect(triggerText()).toBe("Thinking...")
    // ⭐ The negative control is what stops a later editor "tidying" the three dots into a
    //    typographic ellipsis and reddening nothing. … is that character.
    expect(triggerText()).not.toContain("…")
    expect(triggerText()).toContain("...")
  })

  // ── §3 — STREAMING: no click. ──
  it("§3 — while streaming, reasoning accumulates behind a CLOSED fold: the prose appears only once the trigger is clicked (D-243-02)", () => {
    renderWithTooltip(
      <MessageItem
        message={makeMessage({ runStatus: "streaming", reasoningContent: REASONING_MEDIAN })}
        isStreaming
      />,
    )
    // This is the mechanical form of "auto-expanding during the stream would flip the default
    // in effect — so it does not". A later plan that opens the fold mid-stream reds here.
    expect(triggerText()).toBe("Thinking...")
    expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    expect(screen.getByText(REASONING_MEDIAN, { normalizer: RAW }).textContent).toBe(REASONING_MEDIAN)
  })

  // ── §4 — no count, ever (D-243-02). SETTLED. ──
  describe("§4 — the trigger carries no count", () => {
    it("§4a — the settled trigger's text is exactly `Thinking` and carries no unit, no total and no digit", () => {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
      expandSettledRun()
      // `FoldTrigger`'s own comment: reasoning has no countable unit and inventing one would be
      // fabricated precision. A `· 4 steps`, a `· 1,180 chars` or any other invented unit reds here.
      expect(triggerText()).toMatch(/^Thinking(\.\.\.)?$/)
    })

    it("§4b — a reasoning body FULL of digits still produces a digit-free trigger — the assertion binds to the trigger, not to the page", () => {
      const digitsEverywhere = "Counted 4 passages, 1180 characters, across 12 documents and 3 folders."
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: digitsEverywhere })} />)
      expandSettledRun()
      fireEvent.click(screen.getByTestId("thinking-trigger"))
      // Positive control: the digits ARE on the page, in the body…
      expect(screen.getByText(digitsEverywhere, { normalizer: RAW }).textContent).toContain("1180")
      // …and still not on the trigger.
      expect(triggerText()).toMatch(/^Thinking(\.\.\.)?$/)
      expect(triggerText()).not.toMatch(/\d/)
    })
  })

  // ── §5 — the body's class tokens. SETTLED. ──
  //
  // ⭐ CHANGED BY 243-04, AND THIS SUITE'S OWN DOCBLOCK AUTHORISED EXACTLY THIS EDIT
  //    ("THE ONE PLAN PERMITTED TO CHANGE ANY OF THIS IS 243-04 … §5 (the body's class
  //    tokens)"). 243-01 pinned the OPPOSITE set DELIBERATELY — it was characterizing the
  //    shipped defect so the change would be a MEASURED one rather than an assertion edited
  //    to match whatever got written. The reason for the change is a file, not an opinion:
  //    `.planning/sketches/234-the-thinking-block/index.html` §V1 (`:127-137`) — the
  //    operator-approved winner. Its `.reasoning` rule is `margin-left:12px; padding-left:16px;
  //    border-left:2px; font-size:var(--text-sm)` over REAL `<p>` elements, which is why the
  //    monospaced voice, the preserved newlines and the 16rem nested scroller all go.
  //
  // ⚠ THE ASSERTION MOVED TO THE BODY'S OWN TESTID, and that is forced by the change rather
  //   than chosen: the prose now lives in a `<p>` CHILD, so `getByText` returns the paragraph
  //   and asserting `className` on it would be asserting the wrong element's classes.
  it("§5 — the reasoning body's class tokens: V1's set, changed here by the ONE plan permitted to", () => {
    renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
    expandSettledRun()
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    const body = screen.getByTestId("thinking-body")
    const tokens = body.className.split(/\s+/)
    // ⚠ THIS IS THE CLASS-STRING FORM, AND IT IS LEGITIMATE HERE BECAUSE THE CLASSES ARE THE
    //   DELIVERABLE of 243-04's V1 diff — it is not a presence assertion in disguise.
    //     STAYING  → border-l-2 · ml-3     (D-243-02: "that is the whole visual change")
    //     CHANGING → text-xs becomes text-sm
    for (const token of ["text-sm", "border-l-2", "ml-3"]) {
      expect(tokens).toContain(token)
    }
    //     LEAVING  → the four dropped classes, plus the size step they replace.
    // ⛔ The absence half is the load-bearing one: `overflow-y-auto` + `max-h-64` are the
    //    nested scroller inside a scrolling conversation that CHAT-01 is about, and
    //    `font-mono` + `whitespace-pre-wrap` are the "machine transcript" voice the sketch
    //    replaced with the page's own prose.
    for (const token of ["text-xs", "font-mono", "whitespace-pre-wrap", "max-h-64", "overflow-y-auto"]) {
      expect(tokens).not.toContain(token)
    }
  })

  // ── §5b — ADDED BY 243-04. Real paragraphs, which is WHY dropping `whitespace-pre-wrap`
  //    is correct rather than a regression to a run-on wall. Sketch `index.html:332`:
  //    `ps.map(p => "<p>" + p + "</p>")`. SETTLED. ──
  describe("§5b — the body is real paragraphs (sketch 234 V1, `index.html:332`)", () => {
    /** Two paragraphs, blank-line separated — the shape the sketch's `ps` array carries. */
    const TWO_PARAS = [
      "The user is asking about the retention policy, and the policy was revised last quarter.",
      "So I should search the knowledge base for the current document before answering anything.",
    ]
    const REASONING_TWO_PARAS = TWO_PARAS.join("\n\n")

    /** The rendered paragraph blocks, in document order. */
    function paragraphs(): HTMLElement[] {
      return Array.from(
        screen.getByTestId("thinking-body").querySelectorAll<HTMLElement>("[data-testid='thinking-paragraph']"),
      )
    }

    function openBody(reasoning: string) {
      renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: reasoning })} />)
      expandSettledRun()
      fireEvent.click(screen.getByTestId("thinking-trigger"))
    }

    it("§5b-i — two blank-line-separated paragraphs render as TWO block elements, one paragraph's text each", () => {
      openBody(REASONING_TWO_PARAS)
      const ps = paragraphs()
      // ⭐ ELEMENT COUNT and PER-ELEMENT text, not a substring of the container: a container
      //    substring would pass with the whole thing in one undivided block, which is the
      //    exact shape this case exists to refuse.
      expect(ps).toHaveLength(2)
      expect(ps[0].textContent).toBe(TWO_PARAS[0])
      expect(ps[1].textContent).toBe(TWO_PARAS[1])
    })

    it("§5b-ii — NO NESTED SCROLLER: the body carries no overflow-y-auto and no max-h-* token at all", () => {
      openBody(REASONING_LONG)
      const tokens = screen.getByTestId("thinking-body").className.split(/\s+/)
      // ⭐ THE CASE THAT STOPS THE DEFECT BEING RESTYLED BACK IN. A scrollbar inside a
      //    scrolling conversation is what CHAT-01 is about, and `max-h-64` was only one
      //    spelling of it — so the assertion is over the SHAPE of the token, not the literal.
      expect(tokens).not.toContain("overflow-y-auto")
      expect(tokens.filter((t) => /^max-h-/.test(t))).toEqual([])
      expect(tokens.filter((t) => /^overflow-/.test(t))).toEqual([])
      // Positive control: the body really did render this fixture, so the absences above are
      // measured against a rendered element rather than an empty one.
      expect(screen.getByTestId("thinking-body").textContent?.length).toBeGreaterThan(30_000)
    })

    it("§5b-iii — a single-paragraph body renders ONE block: the median 198-char case gains no scaffolding", () => {
      openBody(REASONING_MEDIAN)
      // D-243-03: the median reasoning is 198 chars — one short paragraph. A surface that
      // wrapped it in three containers would be calm at 33 KB and fussy at the common case.
      expect(paragraphs()).toHaveLength(1)
      expect(paragraphs()[0].textContent).toBe(REASONING_MEDIAN)
    })

    it("§5b-iv — LOSSLESS: every non-blank line of the source survives the split", () => {
      const ragged = "  First thought.  \n\n\n   Second thought, after two blank lines.\n\nThird.\n\n  "
      openBody(ragged)
      const joined = paragraphs()
        .map((p) => p.textContent ?? "")
        .join("\n")
      // ⛔ A paragraph split that ATE text would still satisfy an element-count assertion.
      //    This is the case that stops a trim/filter from deleting a model's words.
      for (const line of ragged.split("\n").map((l) => l.trim()).filter(Boolean)) {
        expect(joined).toContain(line)
      }
    })
  })

  // ── §6 — the planning placeholder. THE ONLY SECTION ANCHORED TO THE CARD. ──
  //    243-02 LEAVES state 2 and the elapsed segment in `RunCard` by explicit decision, so
  //    anchoring them there is correct rather than accidental. Everything else in this file
  //    renders through `MessageItem`, which is the boundary that survives the move.
  describe("§6 — the planning placeholder (state 2), anchored to the card 243-02 leaves it in", () => {
    it("§6a — streaming + isPlanning + no reasoning renders `Thinking · planning next step`", () => {
      const msg = makeMessage({ runStatus: "streaming", isPlanning: true })
      renderWithTooltip(<RunCard message={msg} isStreaming />)
      expect(screen.getByTestId("thinking-row").textContent).toContain(PLANNING_COPY)
    })

    it("§6b — the SAME fixture with reasoning does not render the planning copy — states 1 and 2 are mutually exclusive by construction", () => {
      const msg = makeMessage({
        runStatus: "streaming",
        isPlanning: true,
        reasoningContent: REASONING_MEDIAN,
      })
      // ⚠ THE MOUNT CHANGED AT 243-02, AND ONLY THE MOUNT. `<RunCard>` no longer renders
      //   state 1 at all — it left for `ThinkingBlock`, mounted a level up — so this case's
      //   POSITIVE CONTROL could no longer be observed on the card alone. Rendering through
      //   `MessageItem` puts BOTH surfaces on one page, which is what the exclusion is
      //   actually about now, and it is STRICTLY STRONGER than the card-only form: the card
      //   is still mounted (this fixture is tool-bearing and streaming), so the two absences
      //   below are still measured against the card's own rendered body.
      //   ⛔ The two absence assertions are BYTE-UNCHANGED. Only the render line moved.
      renderWithTooltip(<MessageItem message={msg} isStreaming />)
      expect(screen.queryByText(PLANNING_COPY)).toBeNull()
      expect(screen.queryByTestId("thinking-row")).toBeNull()
      // Positive control — state 1 took the branch, so the absence above is a measured
      // exclusion rather than a fixture that rendered nothing at all.
      expect(triggerText()).toBe("Thinking...")
    })

    it("§6c — an honest start renders a duration beside the planning copy", () => {
      const msg = makeMessage({
        runStatus: "streaming",
        isPlanning: true,
        startedAt: new Date(Date.now() - 5_000).toISOString(),
      })
      renderWithTooltip(<RunCard message={msg} isStreaming />)
      const row = screen.getByTestId("thinking-row")
      expect(row.textContent).toContain(PLANNING_COPY)
      expect(within(row).getByText(/^\d+(\.\d+)?s$/)).toBeInTheDocument()
    })

    it("§6d — no honest start renders NO duration — the honesty gate, on the only input state 2 can reach", () => {
      // ⚠ MEASURED FINDING, recorded rather than papered over. The honesty rule has two arms:
      //   no parseable start, and a TERMINAL run with neither a persisted end nor a
      //   same-session frozen one. State 2 renders ONLY while streaming (see §6e), so the
      //   terminal arm is UNREACHABLE on this row and this case drives the reachable one.
      const msg = makeMessage({
        runStatus: "streaming",
        isPlanning: true,
        created_at: "not-a-date",
        startedAt: undefined,
      })
      renderWithTooltip(<RunCard message={msg} isStreaming />)
      const row = screen.getByTestId("thinking-row")
      expect(row.textContent).toContain(PLANNING_COPY)
      expect(within(row).queryByText(/^\d+(\.\d+)?s$/)).toBeNull()
    })

    it("§6e — a TERMINAL planning run renders no planning row at all, which is WHY the terminal arm of the honesty gate is unreachable here", () => {
      const msg = makeMessage({ runStatus: "completed", isPlanning: true })
      renderWithTooltip(<RunCard message={msg} />)
      // Terminal + tools ⇒ collapsed. Open it, so this absence is measured against a
      // rendered body rather than against nothing.
      expandSettledRun()
      expect(screen.queryByText(PLANNING_COPY)).toBeNull()
      expect(screen.queryByTestId("thinking-row")).toBeNull()
    })
  })

  // ── §7 — state 3. SETTLED: expand first, or the case is vacuous. ──
  it("§7 — state 3: with neither reasoning nor planning, no `Thinking` trigger and no `Thinking · planning next step` render inside an OPEN run", () => {
    renderWithTooltip(<MessageItem message={makeMessage()} />)
    expandSettledRun()
    // Positive control FIRST: the run body really is open, so the two absences below are
    // measured against a rendered subtree. An assertion made against an unrendered subtree
    // is not evidence — it would pass with the logic entirely broken.
    expect(screen.queryByTestId("run-card-collapsed")).toBeNull()
    expect(screen.getByText("Assistant response text")).toBeInTheDocument()
    expect(screen.queryByTestId("thinking-trigger")).toBeNull()
    expect(screen.queryByText(PLANNING_COPY)).toBeNull()
    expect(screen.queryByTestId("thinking-row")).toBeNull()
    expect(screen.queryByText(/^Thinking$/)).toBeNull()
  })

  // ── §8 — ⭐ INVERTED BY 243-02 (CHAT-04). At 243-01 this was a DECLARED DEFECT. ──
  it("§8 — CHAT-04 CLOSED (inverted here, by plan 243-02): a reasoning-bearing reply with ZERO tool calls renders its thinking", () => {
    // ⭐ THIS CASE ASSERTED THE OPPOSITE AT 243-01, AND THE INVERSION IS THE DELIVERABLE.
    //    Its 243-01 form asserted that the trigger and the prose were BOTH ABSENT: measured
    //    for D-243-03, 105 of 340 reasoning-bearing rows — 31% — called no tool at all, and
    //    their reasoning was INVISIBLE in the product, because the only renderer of
    //    `reasoningContent` in the codebase sat inside a card `MessageItem` mounts only for
    //    a tool-bearing turn. 243-02 moved that renderer OUT of the card and mounts it with
    //    no tool test anywhere, so the same fixture now draws.
    // ⛔ A later plan that reds this line has re-hidden 31% of the product's reasoning.
    // ⭐ The fixture is §1's, with ONE difference — an EMPTY `tool_calls`. That is what makes
    //    this a measurement of the tool-conditionality rather than of two unrelated fixtures.
    renderWithTooltip(
      <MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN, tool_calls: [] })} />,
    )
    // Positive control: the reply itself renders, so this is a message on the page WITH its
    // reasoning — not an empty render that would satisfy any assertion.
    expect(screen.getByText("Assistant response text")).toBeInTheDocument()
    // No run card mounts on a zero-tool turn (unchanged — D-09 still holds), so the fold is
    // reached in ONE click rather than two. This is the shape that never had a trigger.
    expect(screen.queryByTestId("run-card-collapsed")).toBeNull()
    expect(triggerText()).toBe("Thinking")
    // Closed by default here too — §1b's contract, now on the shape that never had one.
    expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    expect(screen.getByText(REASONING_MEDIAN, { normalizer: RAW }).textContent).toBe(REASONING_MEDIAN)
  })

  // ── §9 — ⭐ INVERTED BY 243-02. At 243-01 this was a DECLARED DEFECT. ──
  it("§9 — INVERTED here, by plan 243-02: a settled run’s reasoning is ONE fold away — the trigger exists BEFORE the run row is opened", () => {
    // ⭐ THIS CASE ASSERTED THE OPPOSITE AT 243-01, AND THE INVERSION IS THE DELIVERABLE.
    //    `expanded = isStreamingNow || !hasTools || userExpanded`, and a settled tool-bearing
    //    turn has none of the three — so the whole block, trigger included, used not to be
    //    rendered at all until the reader opened the run row, putting finished reasoning
    //    behind TWO folds. 243-02 mounts the block from `MessageItem`, OUTSIDE the card’s
    //    `expanded` gate entirely, so one of the two folds is gone.
    // ⛔ A later plan that reds this line has put the second fold back.
    renderWithTooltip(<MessageItem message={makeMessage({ reasoningContent: REASONING_MEDIAN })} />)
    // The collapsed run row is STILL there — the card’s own fold is untouched by this
    // phase, and its presence is the positive control that this is the settled shape.
    expect(screen.getByTestId("run-card-collapsed").textContent).toBeTruthy()
    // …and the thinking trigger is already on the page beside it. THIS LINE IS THE INVERSION:
    // at 243-01 it read `expect(screen.queryByTestId("thinking-trigger")).toBeNull()`.
    expect(triggerText()).toBe("Thinking")
    expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    // ⚠ THE RUN-ROW CLICK STAYS, DELIBERATELY. It is no longer NECESSARY to reach the
    //    trigger, but a case that opens the run row and then asserts must STILL pass — that
    //    is precisely the forward-compatibility 243-01 designed `expandSettledRun()` for, and
    //    deleting it here would delete the evidence that the claim was true.
    expandSettledRun()
    expect(triggerText()).toBe("Thinking")
    expect(screen.queryByText(REASONING_MEDIAN, { normalizer: RAW })).toBeNull()
    // And ONE click on the fold reaches the words (it took two at 243-01).
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    expect(screen.getByText(REASONING_MEDIAN, { normalizer: RAW }).textContent).toBe(REASONING_MEDIAN)
  })

  // =================================================================================
  // 10-13 - ADDED BY 243-02. These describe the MOVE itself, not the shipped block.
  // =================================================================================

  describe("§10 — exactly ONE renderer of the reasoning body, mechanically (D-243-01)", () => {
    it("§10a — the sweep is non-empty and can SEE the three files this plan touched", () => {
      // An absence/uniqueness assertion over zero files is vacuously true. A count is not
      // enough either - the sweep must prove it sees the files that matter, BY NAME.
      expect(Object.keys(CHAT_SRC).length).toBeGreaterThan(10)
      for (const name of ["ThinkingBlock.tsx", "RunCard.tsx", "MessageItem.tsx"]) {
        expect(Object.keys(CHAT_SRC).some((path) => path.endsWith("/" + name))).toBe(true)
      }
    })

    it("§10b — the needle DISCRIMINATES: it matches a render, and not a prop pass or prose", () => {
      // The positive control. Without it, 10c could pass because the needle matches nothing.
      expect('<div className="px-3">{reasoningContent}</div>').toMatch(RENDERS_REASONING)
      expect("        {message.reasoningContent}").toMatch(RENDERS_REASONING)
      // ...and the three innocent shapes that must NOT count as a second renderer:
      expect("<ThinkingBlock reasoningContent={message.reasoningContent} isStreaming />").not.toMatch(
        RENDERS_REASONING,
      )
      expect("if (!message.reasoningContent && isStreamingNow) return null").not.toMatch(
        RENDERS_REASONING,
      )
      expect("the block renders message.reasoningContent verbatim as text children").not.toMatch(
        RENDERS_REASONING,
      )
      // ⭐ ARM 2, ADDED BY 243-04 — V1's real-paragraph render (`index.html:332`). Without
      //    this the fence reads ZERO and §10c is red on correct code.
      expect("          {toParagraphs(reasoningContent).map((paragraph, i) => (").toMatch(
        RENDERS_REASONING,
      )
      expect("{toParagraphs(message.reasoningContent).map((p) => p)}").toMatch(RENDERS_REASONING)
      // ⛔ AND THE TWO INNOCENTS THE LOOSE FORM WOULD HAVE CAUGHT, QUOTED FROM THE TREE.
      //    A widened `\{[^}]*reasoningContent[^}]*\}` matches both of these, which is why the
      //    needle is an alternation of NAMED shapes rather than a broader pattern.
      expect("          {!message.reasoningContent && isStreamingNow && message.isPlanning && (")
        .not.toMatch(RENDERS_REASONING) // RunCard.tsx:487 — state 2's guard
      expect(
        '<span className="italic">{outerBannerLabel(null, false, message.isPlanning ?? false, false, !message.content && !!message.reasoningContent)}</span>',
      ).not.toMatch(RENDERS_REASONING) // MessageItem.tsx:612 — a label call, not a render
    })

    it("§10c — exactly one production file in components/chat renders it, and it is ThinkingBlock.tsx", () => {
      // D-243-01 / sketch 235 winner B, as a MEASUREMENT rather than a claim. Before this
      // plan the one renderer was RunCard.tsx; after it, it is ThinkingBlock.tsx. What may
      // never be true is TWO - that is the drift T-243-02-03 exists to stop.
      const renderers = Object.keys(CHAT_SRC).filter((path) =>
        RENDERS_REASONING.test(stripComments(CHAT_SRC[path])),
      )
      expect(renderers).toHaveLength(1)
      expect(renderers[0].endsWith("/ThinkingBlock.tsx")).toBe(true)
    })
  })

  it("§11 — ORDER ON SCREEN (D-243-01): thinking precedes the tool rows AND the answer — the order in time", () => {
    const { container } = renderWithTooltip(
      <MessageItem
        message={makeMessage({ runStatus: "streaming", reasoningContent: REASONING_MEDIAN })}
        isStreaming
      />,
    )
    const nodes = Array.from(container.querySelectorAll<HTMLElement>("*"))
    const indexOfTestId = (id: string) =>
      nodes.findIndex((n) => n.getAttribute("data-testid") === id)

    const thinkingAt = indexOfTestId("thinking-trigger")
    expect(thinkingAt).toBeGreaterThan(-1)

    // The first tool row. Positive control: the anchor must actually be on the page, or the
    // comparison below would be a claim about nothing.
    const firstToolRowAt = nodes.findIndex((n) => {
      const id = n.getAttribute("data-testid")
      return id === "step-node" || id === "tool-result-summary" || id === "tc-active"
    })
    expect(firstToolRowAt).toBeGreaterThan(-1)

    // The answer body - a streaming tool-bearing turn routes content through
    // StreamingNarration (MessageItem.tsx:425), which is a DIFFERENT construct from this
    // block and is deliberately left alone here (D-243-14; 243-05 owns it).
    const bodyAt = indexOfTestId("streaming-narration")
    expect(bodyAt).toBeGreaterThan(-1)

    expect(thinkingAt).toBeLessThan(firstToolRowAt)
    expect(thinkingAt).toBeLessThan(bodyAt)
    // Stated the other way too, on the DOM's own relation rather than on an index, so a
    // future container restructure cannot make the indices agree by accident.
    const thinking = nodes[thinkingAt]
    expect(
      thinking.compareDocumentPosition(nodes[firstToolRowAt]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      thinking.compareDocumentPosition(nodes[bodyAt]) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it("§12 — NO SECOND GATE: the mount carries no tool test and no key, and the block never spells tool_calls", () => {
    // D-243-01: "the tool-conditionality disappears BY CONSTRUCTION". A tool test on the
    // mount would restore the defect 8 just closed, in a form that reads as tidiness. A
    // `key=` would close an open fold on every temp-id to DB-id reconcile (13). Both are
    // cheap to write and invisible in review - hence a fence.
    const mount = soleMountExpression(chatSource("MessageItem.tsx"), "ThinkingBlock")
    expect(mount).toContain("<ThinkingBlock")
    expect(mount).not.toContain("tool_calls")
    expect(mount).not.toContain("key=")
    // And the block itself cannot be conditioned on tools even internally.
    expect(chatSource("ThinkingBlock.tsx")).not.toContain("tool_calls")
    // T-243-02-01: provider-authored reasoning renders as React TEXT CHILDREN ONLY.
    expect(chatSource("ThinkingBlock.tsx")).not.toContain("dangerouslySetInnerHTML")
  })

  it("§13 — the fold SURVIVES the temp-id to DB-id reconcile — the remount semantics, DECIDED here", () => {
    // 243-PATTERNS F.8 flagged this as a thing 243-02 must DECIDE rather than inherit.
    // `RunCard` holds `thinkingOpen` today and is not re-keyed, so an open fold survives the
    // reconcile; `MessageList.tsx:220` keys a run-bearing assistant row by `runId`, which is
    // STABLE across the id swap. THE DECISION: no `key` on the mount, so the behaviour is
    // CARRIED ACROSS the move rather than changed by it. `key={message.id}` is the cheap
    // answer and it would close an open fold on every reconcile - a behaviour change
    // smuggled in as tidiness. Case 12 fences the key; this case fences the BEHAVIOUR, so
    // the two cannot drift apart.
    const before = makeMessage({
      id: "temp-abc",
      runId: "run-1",
      runStatus: "streaming",
      reasoningContent: REASONING_MEDIAN,
    })
    const { rerender } = renderWithTooltip(<MessageItem message={before} isStreaming />)
    fireEvent.click(screen.getByTestId("thinking-trigger"))
    expect(screen.getByText(REASONING_MEDIAN, { normalizer: RAW }).textContent).toBe(REASONING_MEDIAN)

    // The reconcile: the SAME run, now carrying its persisted DB id.
    rerender(
      <TooltipProvider>
        <MessageItem message={{ ...before, id: "msg-db-1" }} isStreaming />
      </TooltipProvider>,
    )
    expect(screen.getByText(REASONING_MEDIAN, { normalizer: RAW }).textContent).toBe(REASONING_MEDIAN)
  })
})
