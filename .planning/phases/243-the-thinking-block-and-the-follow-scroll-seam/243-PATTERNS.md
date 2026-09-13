---
phase: 243
name: The Thinking Block and the Follow-Scroll Seam
mapped: 2026-09-11
source: "codebase read at HEAD (develop, abb2d1199) — every line number below was opened, not quoted from a report"
consumes: [243-CONTEXT.md, sketches/234-the-thinking-block/README.md, sketches/235-thinking-with-no-run/README.md]
---

# Phase 243 — Pattern Map

**Mapped:** 2026-09-11
**Files analysed:** 8 (1 new source · 4 modified source · 1–3 new suites · 1 gate script · 2 ledger artefacts)
**Analogs found:** 7 / 8 with a concrete in-repo analog · 1 with **no analog** (named below)

⚠ **Everything here is a MEASUREMENT of shipped code, not a recommendation dressed as one.**
Where a pattern does not exist, this file says so rather than inventing one — see
§"No analog found", which is the most load-bearing section for the planner.

---

## File Classification

| New / modified file | Role | Data flow | Closest analog | Match |
|---|---|---|---|---|
| `frontend/src/components/chat/ThinkingBlock.tsx` **(NEW)** | component (leaf, presentational fold) | derived-render over a streamed string | `frontend/src/components/chat/StreamingNarration.tsx` | **exact** |
| …its clamp half | component (measure→clamp→control) | layout-measure | `frontend/src/components/chat/UserMessageBubble.tsx` (`UserBubble`) | **exact** |
| …its fold control | component (shared) | — | `frontend/src/components/chat/FoldTrigger.tsx` — **mounted, never copied** | **exact (reuse)** |
| `frontend/src/components/chat/RunCard.tsx` **(MOD — deletion)** | component | — | Phase 227 extraction commits (`UserMessageBubble.tsx`, `messageText.ts`, `toolStepDerivation.ts`) | **exact** |
| `frontend/src/components/chat/MessageItem.tsx` **(MOD — mount)** | component | — | `MessageItem.tsx:352-361` (the `WorkingBadge` / `RunCard` sibling mounts) | **exact** |
| `frontend/src/providers/StreamsProvider.tsx` **(MOD — 2 callbacks)** | provider / stream reducer | streaming (SSE → setMessages) | `StreamsProvider.tsx:3525` (the ONE `makeThrottle` call site) + `tool-bodies/ShikiCode.tsx:109` (`useDeferredValue`) | **role-match, two candidates — see §E** |
| `frontend/src/components/chat/MessageList.tsx` **(MOD — scroll effect)** | component | event-driven (scroll) | `frontend/src/hooks/useFollowScroll.ts` + `src/__tests__/hooks/useFollowScroll.test.ts` | **exact** |
| **New vitest suite(s)** | test | — | `components/chat/__tests__/RunCard.characterization.test.tsx` (extraction net) · `__tests__/components/MessageItem.clamp.test.tsx` (clamp) · `__tests__/components/chat/MessageList.test.tsx:106-234` (scroll) · `__tests__/providers/streamsProvider_075_9_clientkey.test.tsx:72-86` (cadence) | **exact ×4** |
| `scripts/vitest-count-gate.cjs` **(MOD — two knobs)** | config | — | its own `:3690-3693` / `:125-128` pairing | **exact** |
| `CLAUDE.md` ledger row + `docs/HOT-FILE-LEDGER.md` section **(MOD)** | docs | — | `docs/HOT-FILE-LEDGER.md:1608` (`RunCard.tsx`), `:175` (`MessageItem.tsx`), `:1653` (`MessageList.tsx`), `:298` (`StreamsProvider.tsx`) | **exact** |

⚠ **One precision correction to CONTEXT / sketch 235, recorded beside the original rather than
over it.** Both say *"`MessageItem.tsx:425` mounts the run path only when `tool_calls.length > 0`"*.
Measured at HEAD: `:425` is the **`StreamingNarration` branch condition**
(`isMessageStreaming && (message.tool_calls?.length ?? 0) > 0 && message.role === "assistant"`),
and the **`RunCard` mount is at `:359-361`** (`message.tool_calls && message.tool_calls.length > 0`).
Both gate on the same predicate, so **every conclusion in CONTEXT and both sketches stands** — but a
plan that edits `:425` expecting to find the RunCard mount will edit the wrong construct.

---

## A. The closest analog for a small presentational chat component extracted from a big card

### The prevailing shape, measured across 12 files in `components/chat/`

| Property | What ships | Evidence |
|---|---|---|
| **Export** | **named function export, no default.** One exception. | `StreamingNarration.tsx:24` · `RunStatusStrip.tsx:42` · `CitationList.tsx:32` · `OutputFileCard.tsx:117` · `AbsenceHint.tsx:29` · `StatusPill.tsx:57` · `ConfidenceBadge.tsx:14` · `MessageSkeleton.tsx:14` · `UserMessageBubble.tsx:25` · `ToolCallDetails.tsx:20,56,135` (three named exports in one file) |
| **The one default export** | `FoldTrigger.tsx:76` — `export default FoldTrigger` **in addition to** the named export at `:53`. It is the only chat component with one. | — |
| **`memo(...)`** | **Only at the message/run boundary — never on a leaf.** Three uses tree-wide in `chat/`. | `MessageItem.tsx:220` `export const MessageItem = memo(function MessageItem({…}: Props) {` · `RunCard.tsx:70` `export const RunCard = memo(function RunCard({ message, isStreaming }: RunCardProps) {` · `WorkingBadge.tsx:52` `export const WorkingBadge = React.memo<WorkingBadgeProps>(` |
| ⇒ **for `ThinkingBlock`** | **do NOT wrap in `memo`.** Not one of `FoldTrigger` / `StreamingNarration` / `RunStatusStrip` / `CitationList` / `UserBubble` / `AbsenceHint` / `StatusPill` is memoized. Adding one here invents a pattern; the memo already lives on the parent. | `MessageItem.tsx:213-219` records why the boundary is where it is |
| **Prop shape** | **narrowed fields, not the whole message** — the whole-`Message` prop is the exception and belongs to exactly two components. | Whole-message: `RunCard.tsx:34-37` (`interface RunCardProps { message: Message; isStreaming?: boolean }`), `MessageItem.tsx:220`. Narrowed: `StreamingNarration({ content }: { content: string })` `:24` · `UserBubble({ content }: { content: string })` `:25` · `CitationList({ citations, defaultOpen, flashContainer }: Props)` `:32` |
| **Prop TYPE declaration** | 1 prop → **inline object type**. ≥2 props → a declared `interface Props` / `interface XProps` (exported when the component is shared). `RunStatusStrip` is the outlier: 5 props on an inline type. | inline: `StreamingNarration.tsx:24`, `UserMessageBubble.tsx:25` · declared: `CitationList.tsx:7` (`interface Props`), `FoldTrigger.tsx:38` (`export interface FoldTriggerProps`), `WorkingBadge.tsx:23`, `StatusPill.tsx:24` · outlier: `RunStatusStrip.tsx:42-59` |
| **`data-testid`** | on the **outermost element**, plus one per interactive / asserted sub-part. kebab-case, prefixed by the component's concept. | `StreamingNarration.tsx:29` `streaming-narration` (on the `Collapsible` root) → `:34` `streaming-narration-trigger` → `:47` `streaming-narration-body`. `UserMessageBubble.tsx:38` `user-bubble` on the wrapper `div`. `RunStatusStrip.tsx:65-66` `run-status-strip` + a `data-placement` discriminator |
| ⚠ **and where it does NOT go** | `FoldTrigger.tsx` carries **no testid at all** — the *caller's* button owns it. | `RunCard.tsx:490` `data-testid="thinking-trigger"`, `CitationList.tsx:53` (a bare `<button aria-expanded>` with none) |
| **Docblock** | **two blocks**: a phase-tagged EXTRACTION header, then the ORIGINAL contract moved verbatim below it. | `UserMessageBubble.tsx:1-7` (the 227 header) + `:11-24` (the Phase 128 contract, moved intact). Same shape at `messageText.ts:1-7` + `:9-17` and `toolStepDerivation.ts:1-12` |

### The ranked analogs

1. **`frontend/src/components/chat/StreamingNarration.tsx` — the exact analog.** Same role (a
   Radix `Collapsible` fold over streamed text sitting in the message body), same export shape,
   same inline prop type, same three-testid layout, and its body at `:48` carries the *identical*
   `max-h-64 overflow-y-auto border-l-2 border-muted-foreground/20` shape the thinking body has at
   `RunCard.tsx:501`. It is literally the sibling of the thing being extracted.

   ```tsx
   // StreamingNarration.tsx:24-54 — the shape to copy
   export function StreamingNarration({ content }: { content: string }) {
     const [open, setOpen] = useState(false)
     const gist = toGist(content)
     if (!gist) return null                                     // ← self-guard, not a caller branch
     return (
       <Collapsible open={open} onOpenChange={setOpen} data-testid="streaming-narration">
         <CollapsibleTrigger asChild>
           <button
             type="button"                                      // ← present here; ABSENT in RunCard
             aria-expanded={open}
             data-testid="streaming-narration-trigger"
             className="…"
           >…</button>
         </CollapsibleTrigger>
         <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0">
           <div data-testid="streaming-narration-body" className="…">…</div>
         </CollapsibleContent>
       </Collapsible>
     )
   }
   ```

   ⭐ `if (!gist) return null` at `:27` is the pattern for **the tool-conditionality disappearing by
   construction** (D-243-01): `ThinkingBlock` self-guards on `!content` and `MessageItem` mounts it
   unconditionally on the assistant branch — no second `tool_calls.length` test anywhere.
   `CitationList.tsx:34` (`if (!citations.length) return null`) and `AbsenceHint.tsx` do the same.

2. **`frontend/src/components/chat/UserMessageBubble.tsx` — the extraction-from-a-big-card analog
   AND the clamp analog.** It is a Phase 227 `MessageItem` extraction, and it owns the sketch-050
   clamp. Full treatment in §B.

3. **`frontend/src/components/chat/FoldTrigger.tsx` — reused, never copied.** `:21-25` is the
   shipped one-component-not-two-lookalikes rule; `:43-48` is the `count` prop's own prohibition
   for reasoning (*"inventing one would be … fabricated precision"*), which is D-243-02's `⛔ No
   count` cell in its source form. `CitationList.tsx:52-56` is the second call site and the
   composition template:

   ```tsx
   // CitationList.tsx:52-56
   <CollapsibleTrigger asChild>
     <button aria-expanded={open}>
       <FoldTrigger open={open} label={`References · ${count} source${count !== 1 ? "s" : ""}`} />
     </button>
   </CollapsibleTrigger>
   ```

4. **`frontend/src/components/chat/RunStatusStrip.tsx:3-41`** — for docblock discipline when one
   component serves several homes ("Three placement wrappers over identical segment markup (the
   build-once rule)"). If `ThinkingBlock` ends up with a variant, this is the shape of the comment
   that has to justify it.

5. **Phase 227's extraction header, verbatim, as the template for `ThinkingBlock.tsx`'s first
   docblock:**

   ```ts
   // messageText.ts:1-7 / UserMessageBubble.tsx:1-7 / toolStepDerivation.ts:1-12
   /**
    * Phase 227 Wave 3 — UserMessageBubble component (B-2).
    *
    * Encapsulates user message role presentation and 7-line clamping with gradient fade
    * extracted from MessageItem.tsx:
    *   - UserBubble: 7-line clamp, Read more/Show less toggle, and gradient fade
    */
   ```

   ⇒ `ThinkingBlock.tsx` opens with the 243 equivalent, then carries **`RunCard.tsx:473-477`'s
   Phase 076.2 D-01 three-state comment moved verbatim** below it (the "1. reasoningContent
   present · 2. streaming + isPlanning placeholder shimmer · 3. neither → nothing" contract),
   exactly as `UserMessageBubble.tsx:11-24` preserved Phase 128's.

### What is being extracted, verbatim (the source of truth for plan 1)

`RunCard.tsx:478-522` is the whole surface. Its three states, its state hook and the elapsed inputs
it reads:

```tsx
// RunCard.tsx:91 — the fold default. ⛔ D-243-02: UNCHANGED.
const [thinkingOpen, setThinkingOpen] = useState(false)

// RunCard.tsx:478-505 — state 1
{message.reasoningContent ? (
  <Collapsible open={thinkingOpen} onOpenChange={setThinkingOpen} className="mb-2">
    <CollapsibleTrigger asChild>
      <button data-testid="thinking-trigger" aria-expanded={thinkingOpen} className="px-3 py-1.5 text-left">
        <FoldTrigger open={thinkingOpen} label={isStreamingNow ? "Thinking..." : "Thinking"} />
      </button>
    </CollapsibleTrigger>
    <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0">
      <div className="px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto border-l-2 border-muted-foreground/20 ml-3">
        {message.reasoningContent}
      </div>
    </CollapsibleContent>
  </Collapsible>
) : isStreamingNow && message.isPlanning ? (     // :506 — state 2
  <div data-testid="thinking-row" className="px-3 py-1.5 text-xs italic text-muted-foreground/80 flex items-center gap-2"
       aria-label="Agent is planning the next step">
    <span aria-hidden="true">💭</span>
    <span className="flex-1 truncate">Thinking · planning next step</span>
    {hasElapsed && <span className="font-mono opacity-60 tabular-nums">{elapsedLabel}</span>}
  </div>
) : null}                                        // :522 — state 3
```

⚠ **The shipped streaming label is `"Thinking..."` — three ASCII dots, not `…`** (`:496`). Any
fence pinning it must use that spelling.

---

## B. The shipped "clamp + Show all of it" pattern from sketch 050

**FOUND — and it is not reusable as a component. Both halves of that sentence matter.**

**Sketch:** `.planning/sketches/050-long-prompt-readmore/` (`winner: "A"`, variant A =
*line-clamp + gradient fade + inline Read more*).
**Shipped as:** `frontend/src/components/chat/UserMessageBubble.tsx:25-67` — `UserBubble`.
**Its test names the sketch explicitly:** `frontend/src/__tests__/components/MessageItem.clamp.test.tsx:2`
— *"Phase 128 Plan 02 — CTC-04 user-prompt clamp (sketch 050-A / D-03)."*

### The mechanism, in four moves — this is what gets copied

```tsx
// UserMessageBubble.tsx:26-64
const pRef = useRef<HTMLParagraphElement>(null)
const [overflowing, setOverflowing] = useState(false)
const [expanded, setExpanded] = useState(false)

// (1) MEASURE — useLayoutEffect (NOT useEffect) so the measure runs pre-paint,
//     "avoids the one-frame full-height flash before the clamp applies (RESEARCH Pitfall 5)".
useLayoutEffect(() => {
  const el = pRef.current
  if (el) setOverflowing(el.scrollHeight > el.clientHeight + 1)
}, [content])                                                   // :32-35

// (2) CLAMP — classes applied only while collapsed
<p ref={pRef} className={cn(
  "whitespace-pre-wrap break-words",
  !expanded && "[display:-webkit-box] [-webkit-line-clamp:7] [-webkit-box-orient:vertical] overflow-hidden",
)}>{content}</p>                                                // :39-47

// (3) FADE — only while clamped AND overflowing
{overflowing && !expanded && (<div aria-hidden className="… bg-gradient-to-t from-[hsl(258_90%_66%)] to-transparent" />)}   // :50-55

// (4) THE CONTROL SELF-REMOVES — gated on `overflowing`, not rendered inert
{overflowing && (
  <button type="button" onClick={() => setExpanded(v => !v)} className="mt-1 text-xs text-white/80 underline">
    {expanded ? "Show less" : "Read more"}
  </button>
)}                                                              // :56-64
```

**Does it self-remove when the content is short? YES** — `:56`. The docblock states the contract at
`:16-18`: *"<= 7 lines: renders whole text with no fade and no toggle (clean text)"*. That is
exactly D-243-02's *"Below ~700 chars the control removes itself rather than sitting inert"*.

### ⛔ It cannot be mounted — it must be copied, and the reason is measured

`UserBubble` is **hard-bound to the user bubble**, not generic:

| Hard-coded | Line |
|---|---|
| `[-webkit-line-clamp:7]` — the threshold is a literal in a class string | `:43` |
| `from-[hsl(258_90%_66%)]` — the fade is matched to the **violet end of the user bubble's 135° gradient** (`index.css:199`, D-03), not to the page background | `:53` |
| `text-white/80` on the control — legible only on violet | `:60` |
| labels `Read more` / `Show less` | `:62` |
| its only prop is `content: string` | `:25` |

**There is no `useClamp` hook, no `<Clamp>` component and no shared clamp module anywhere in
`frontend/src`** — measured by grepping `line-clamp`, `lineClamp`, `maxHeight`, `Show all`,
`Show more` across the tree. Every clamp is a per-call-site implementation.

### ⚠ Two OTHER clamp implementations exist and they are the WRONG ones to copy

| Where | Mechanism | Why it is wrong for 243 |
|---|---|---|
| `components/skills/tuner/CandidateCard.tsx:42` (`line-clamp-3`) + `ShowMoreToggle` at `:154-167` | tailwind `line-clamp-N`, **no measure** | its toggle is mounted **unconditionally** at `:104` — it sits inert on short text, the exact thing D-243-02 forbids |
| `components/chat/CitationCard.tsx:185` (`line-clamp-2`) + `:196-205` | same | same — the "Show more" control is not overflow-gated |

### ⚠ `"Show all of it"` does not exist in the tree

Grepped: `Show all` appears at `components/admin/ModelDiscoveryPanel.tsx:480`,
`components/workflows/templateFirstVocabulary.ts:237` (`Show all ${count}`) and
`components/workflows/history/runLogVocabulary.ts:50` (`"Show all runs"`) — none is a text-clamp
control. The shipped clamp says `Read more` / `Show less`. **Sketch 234's `"Show all of it"` is a
new string**; the plan should say so rather than describing it as reuse.

### The jsdom caveat, already solved — copy this too

jsdom has no layout, so `scrollHeight`/`clientHeight` are both `0` and the real `useLayoutEffect`
never trips. The shipped suite forces the production branch rather than adding a test-only prop:

```ts
// __tests__/components/MessageItem.clamp.test.tsx:44-54
function forceOverflow() {
  vi.spyOn(HTMLElement.prototype, "scrollHeight", "get").mockReturnValue(400)
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(160)
}
const LONG_CONTENT = Array.from({ length: 40 }, (_, i) => `Line ${i + 1}: …`).join("\n")   // :56-59
```

⇒ D-243-03's **two ends** (198 chars / 33,713 chars) map onto: `forceOverflow()` + long fixture →
control present; no spy + short fixture → control absent. Both cases, one suite.

---

## C. The prevailing test pattern for chat components

### Where chat suites live — two homes, both current

| Home | Contents |
|---|---|
| `frontend/src/components/chat/__tests__/` | the **recent** home. Phases 227/228/224 land here (`MessageItem.cancelledRun`, `MessageItem.retry`, `RunCard.characterization`, `CitationList`, `ChatArea*`, …) |
| `frontend/src/components/chat/` (flat, beside source) | `RunCard.test.tsx`, `RunCard.timer.test.tsx`, `StatusPill.test.tsx` |
| `frontend/src/__tests__/components/` | older `MessageItem.*`, `RunCard.logo`, `ToolCallPanel` |
| `frontend/src/__tests__/components/chat/` | `MessageList.test.tsx`, `MessageList.dedup`, `MessageList.runline.baseline` |

⇒ **a new `ThinkingBlock` suite belongs in `frontend/src/components/chat/__tests__/`** (the 227/228
convention). A new `MessageList` scroll suite belongs beside its siblings in
`frontend/src/__tests__/components/chat/`.

### The render harness — `TooltipProvider`, nothing else

```tsx
// RunCard.characterization.test.tsx:55-57   ·   MessageItem.clamp.test.tsx:40-42   ·   MessageList.test.tsx:45-47
function renderWithTooltip(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>)
}
```

No router, no `StreamsProvider` wrapper, no store setup for `RunCard`-level suites.
`MessageList.test.tsx` additionally mocks the API module — and the **spread-the-actual** form is
recorded as load-bearing:

```ts
// MessageList.test.tsx:34-40 (reason at :30-33 — a hand-picked factory breaks unrelated describes)
const { mockGetThreadWorkflow } = vi.hoisted(() => ({ mockGetThreadWorkflow: vi.fn() }))
vi.mock("@/lib/api", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/api")>()
  return { ...actual, getThreadWorkflow: mockGetThreadWorkflow }
})
```

Every suite carries its **own local** `makeMessage(overrides: Partial<Message> = {}): Message`
factory — `RunCard.test.tsx:36-56`, `RunCard.characterization.test.tsx:28-53`,
`MessageList.test.tsx:69-80`, `MessageItem.clamp.test.tsx:27-38`. There is no shared fixture module.

### How streaming is simulated — three mechanisms, one per layer

| Layer | Mechanism | Evidence |
|---|---|---|
| **Provider (best for CHAT-02)** | `makeStreamCallbacks` is **exported** and driven directly against a fake `setMessages`. Deterministic, no DOM, no timers. | `__tests__/providers/streamsProvider_075_9_clientkey.test.tsx:72-86`; module mocks at `:30-49`; **import AFTER the mocks** (`:51-52`) |
| **Component** | `runStatus: "streaming"` on the fixture + the `isStreaming` prop | `RunCard.test.tsx:52,60` · `RunCard.characterization.test.tsx:61` |
| **Scroll / list** | geometry stubs + a **gesture-then-scroll** dispatch inside `act()`, over a hand-rolled rAF queue | `MessageList.test.tsx:49-57, 116-145, 152-162` |
| **Hook** | `renderHook` over a plain fake-viewport object | `__tests__/hooks/useFollowScroll.test.ts:26-46` |

The provider harness, verbatim — this is the shape a CHAT-02 coalescing fence should take:

```ts
// streamsProvider_075_9_clientkey.test.tsx:72-86
function makeHarness() {
  let messages: Message[] = [initialAssistantMessage()]
  const setMessages = (updater) => { messages = typeof updater === "function" ? updater(messages) : updater }
  const callbacks = makeStreamCallbacks({ assistantId: ASSISTANT_ID, threadId: THREAD_ID, setMessages })
  const current = () => messages[0]
  return { callbacks, current }
}
```

⇒ swap `setMessages` for a **counting** spy and the fence reads: *N calls to `onReasoningDelta`
produce ≤ M calls to `setMessages`, and the accumulated `reasoningContent` after `.flush()` equals
the concatenation of all N deltas* — the second half is what stops a throttle from silently
dropping tokens (see §E's trap).

The scroll harness, verbatim — and note the comment, which is `BUG-260904-02`'s own confession and
is the direct prior art for D-243-05's RED drive:

```ts
// MessageList.test.tsx:116-145
function setViewportGeometry(vp, geom) {
  Object.defineProperty(vp, "scrollHeight", { value: geom.scrollHeight, configurable: true })
  Object.defineProperty(vp, "clientHeight", { value: geom.clientHeight, configurable: true })
  Object.defineProperty(vp, "scrollTop", { value: geom.scrollTop, writable: true, configurable: true })
}
function fireScroll(vp) {
  act(() => {
    // "…the faithful simulation of a person scrolling is a GESTURE followed by the scroll
    //  event it causes … A bare `scroll` with no input before it is something no human can produce."
    flushRaf()
    vp.dispatchEvent(new Event("wheel"))
    vp.dispatchEvent(new Event("scroll"))
  })
}
```

…and stepping the clock past the settle window, which D-243-05's candidate residual needs:

```ts
// MessageList.test.tsx:206-211
const realNow = Date.now
vi.spyOn(Date, "now").mockImplementation(() => realNow() + 1000)   // > PROGRAMMATIC_SCROLL_SETTLE_MS (900)
```

### `data-testid` vs content assertions — both ship, and the project has already been bitten

| Form | Example |
|---|---|
| **presence only** (⛔ D-243-11 forbids it here) | `RunCard.test.tsx:59-62` — `expect(screen.getByTestId("run-card")).toBeInTheDocument()` |
| **class-string** | `RunCard.test.tsx:69-72` `expect(header!.className).toMatch(/sticky/)` · `:78-79` `expect(html).toMatch(/animate-brandPulse/)` |
| **rendered CONTENT** ⭐ the form this phase needs | `MessageList.test.tsx:189` `expect(chip).toHaveTextContent("Jump to live")` · `:191` a *composition* assertion (`chip.querySelector("[data-testid='run-status-strip']")`) |

⚠ **The class-string form is legitimate for D-243-02's four dropped classes** — the classes ARE the
deliverable there. But an **absence** assertion needs a positive control; the house form is
`StepTypePicker.test.tsx:952-959`, which asserts the fence's own regex matches a planted positive
and does not match innocent prose.

### ⛔ Existing coverage of the thinking block: **NONE. Zero. This is the headline finding of §C.**

```
grep -rn "thinking-trigger|thinking-row" frontend/src --include=*.test.tsx --include=*.test.ts
  → 0 matches
```

- The only `reasoningContent` reference in any suite is
  `components/chat/__tests__/MessageItem.harnessBanner.test.tsx:254`, which passes
  `{ reasoningContent: "thinking out loud" }` as an **outer-banner** input — it asserts nothing
  about the fold.
- `RunCard.test.tsx:340` matches `"Thinking"` only as one alternative inside a `run-status-strip`
  regex.
- `RunCard.characterization.test.tsx` — Phase 227's 8-state pre-refactor net (`:59-206`, pinned at
  `vitest-count-gate.cjs:3163`) — covers streaming / settled / failed / timed_out / cancelled /
  planning / no_tools / sub_agent. **Reasoning is not one of the eight.**

⇒ **The extraction has no safety net today.** The 227 precedent (`RunCard.characterization.test.tsx`,
whose own docblock at `:1-19` cites `admin/revertByteIdentical.test.tsx` as ITS precedent) is the
exact template: write the characterization cases against the **unmoved** `RunCard` first, then move
the code and prove the cases still pass. Without that, "the extraction changed no pixel" is an
assertion, not a measurement.

### Existing coverage of `MessageList`'s scroll effect: **indirect only**

- `MessageList.test.tsx:151-234` (5 cases, "Phase 095 Plan 04 — follow-but-release chip (D-03)")
  tests the **chip**, not the effect. And `beforeAll` at `:61-65` stubs
  `HTMLElement.prototype.scrollIntoView` to a **no-op** — so **nothing in the tree asserts how many
  times the effect at `MessageList.tsx:141-176` scrolls, or with which `behavior`.**
- `__tests__/hooks/useFollowScroll.test.ts` (10 cases, pinned at `vitest-count-gate.cjs:3145`)
  covers the hook's state machine. The two closest to D-243-05 are named with a ⭐ in the source:
  - `:161` — *"⭐ the tail of our own smooth scroll does NOT re-arm a pin the user released"*
  - `:191` — *"⭐ MEASURED IN A BROWSER: the tail cannot re-arm just because the user gestured a moment ago"*
  - `:228` — *"a user gesture CANCELS the programmatic window immediately"*

⇒ D-243-05's candidate residual — the ~600 ms gap between `hardProgrammaticUntilRef` (900 ms,
refreshed every token) and `USER_GESTURE_WINDOW_MS` (1500 ms) — is decided at
`hooks/useFollowScroll.ts:196-201`:

```ts
if (
  Date.now() >= hardProgrammaticUntilRef.current &&
  Date.now() - lastGestureAtRef.current <= USER_GESTURE_WINDOW_MS
) {
  setIsPinned(true)
}
```

Constants at `:61` and `:68`. **That is the exact line the RED drive must target**, and
`useFollowScroll.test.ts:191-227` is the case shape to extend — never a new mechanism.

---

## D. The two vitest-count-gate knobs

| Knob | Declared at | Keyed by | Consumed at |
|---|---|---|---|
| `BASELINE` | `scripts/vitest-count-gate.cjs:122` — `const BASELINE = {` | **bare filename** (`:121`: *"Keyed by BARE filename (testResults[].name is an absolute path)"*), which must be **unique tree-wide** (`:3148`) | summed at `:3634` (`BASELINE_TOTAL`) |
| `TARGETS` | `scripts/vitest-count-gate.cjs:3637` — `const TARGETS = [` | **`frontend/`-relative path**, passed straight through as vitest positional args | `:4690` (`...TARGETS` into `args`), spawned at `:4757-4762` with `cwd: FRONTEND_DIR` |

**The rule, in the script's own words** (`:144`, `:188`, `:3653`):
> `TARGETS` decides what **RUNS**, `BASELINE` decides what is **GUARDED**.

### Is `src/components/chat` covered by a directory entry? **NO — measured.**

```
grep -n '^\s*"src/components/chat",' scripts/vitest-count-gate.cjs   → no match (exit 1)
```

Every chat entry is **file-level**. The 21 of them: `:3690-3693`, `:4156-4157`, `:4316`, `:4322`,
`:4327`, `:4332`, `:4380`, `:4538`, `:4540-4545`, `:4553-4555`, `:4557-4558`. The script records
the reason beside them at `:4135-4141` and `:4311` (*"FILE-LEVEL, deliberately NOT the bare
directories `src/components/chat` …"*), and at `:4084`.

The same is true for:
- `src/__tests__/components/chat` — file-level only (`:4553-4555`)
- `src/hooks`, `src/__tests__/hooks` — file-level only (`:3864`, `:4288`, `:4315`, `:4474`, `:4534`, `:4601`)
- `src/pages` — file-level only, stated at `:3665-3671`
- ⛔ **`src/providers` / `src/__tests__/providers` — NEITHER a directory entry NOR any file-level
  entry.** Measured: no `BASELINE` key matches `/[Ss]treams/`, and no `TARGETS` entry names a
  provider suite. **All ~10 shipped `StreamsProvider` suites are currently ungated — they neither
  run under the gate nor guard anything.**

### What a NEW suite must add to EACH knob — the literal shapes

```js
// TARGETS — scripts/vitest-count-gate.cjs, beside :4557
  // ── Phase 243 (243-0N / CHAT-01 / CHAT-04) — the extracted thinking block ──
  // FILE-LEVEL, deliberately not the bare directory `src/components/chat/__tests__`,
  // verbatim the reasoning this script already records for its neighbours.
  "src/components/chat/__tests__/ThinkingBlock.test.tsx",
```

```js
// BASELINE — scripts/vitest-count-gate.cjs, beside :3176
  // ── Phase 243 (243-0N) — pinned in the SAME COMMIT that creates the file ──
  "ThinkingBlock.test.tsx": 14,
```

### Three traps the script itself records

1. ⛔ **A `BASELINE` key naming a path that does not yet exist makes the gate ERROR (exit 2), not
   fail** (`:134-135`, restated at `:3147-3148`). ⇒ **pin in the same commit that creates the
   suite**, never ahead of it.
2. ⛔ **The pinned number must be READ FROM THE GATE'S OWN `actual` COLUMN** on the run that first
   executes the file — printed as `— N new` — *"never hand-counted from `it(` literals and never
   taken from a planning document"* (`:146-149`, `:190-193`). A PLAN.md that writes a number is
   writing a number it cannot know.
3. ⚠ **The contract is *no per-file DECREASE*.** Existing chat pins:
   `RunCard.test.tsx` **29** (`:126`) · `RunCard.timer.test.tsx` **7** (`:127`) ·
   `RunCard.characterization.test.tsx` **8** (`:3163`) · `MessageList.test.tsx` **30** (`:3171`) ·
   `useFollowScroll.test.ts` **10** (`:3145`) · `MessageItem.clamp.test.tsx` **5** (`:3165`) ·
   `CitationList.test.tsx` **15** (`:125`).
   ⇒ **Moving cases OUT of `RunCard.test.tsx` into a new `ThinkingBlock.test.tsx` would red the
   gate on `RunCard.test.tsx`'s pin.** Today there are no thinking cases in it to move (§C), so
   this only bites if the extraction deletes existing RunCard cases. If it must, the pin is
   lowered **in the same commit, with the reason in the cell**.

⛔ **And one that is NOT a knob problem but will look like one:** `TARGETS` has grown past 150
entries and the composed `cmd.exe` line measured **8,078 characters**, which Windows refused
outright — *"The syntax of the command is incorrect"*, exit 255, no JSON report (`:4705-4726`).
It was fixed by spawning `process.execPath` with `shell: false` (`:4728-4762`). **The recorded rule
is: do NOT shorten `TARGETS` to fit a shell limit** — *"a gate that quietly stops running files is
worse than one that refuses to start"* (`:4722-4726`). Adding entries is safe.

---

## E. Existing throttle / coalesce usage in the UI path

### `makeThrottle` — every call site, complete

```
frontend/src/lib/throttle.ts:14          export function makeThrottle(fn, waitMs)
frontend/src/providers/StreamsProvider.tsx:101    import { makeThrottle } from "@/lib/throttle"
frontend/src/providers/StreamsProvider.tsx:1440   const throttledWriteRef = useRef<…>(null)
frontend/src/providers/StreamsProvider.tsx:3525   const throttledWrite = makeThrottle(writeNow, 500)
frontend/src/hooks/useLiveValidation.ts:18-22     names it in PROSE and deliberately does not use it
frontend/src/__tests__/lib/throttle.test.ts:13-65 its own suite
```

**One production call site.** It is the localStorage cache writer — exactly as `throttle.ts:1-13`
says (*"Used by `<StreamsProvider>` (D-068.5-03) to batch writes to localStorage during streaming
(~500ms cadence)"*). **The React render path is untouched**, confirming CHAT-02's premise.

⭐ `hooks/useLiveValidation.ts:11-22` is the shipped precedent for *reuse the SHAPE, not the
function*: it needed a **debounce**, `makeThrottle` is a **trailing-edge throttle**, so it
hand-rolled the timer half and said why. That docblock is the template for whatever 243 writes.

### Does any React-render path already coalesce? **YES — exactly one, and it lives in `components/chat/`.**

```tsx
// components/chat/tool-bodies/ShikiCode.tsx:24, 103-110
import { useEffect, useState, useDeferredValue } from "react"
export function ShikiCode({ code, language = "python", theme = "github-dark", streaming = false }) {
  // "during streaming, defer `code` so React batches rapid prop changes and the tokenizer
  //  runs at most once per scheduler slice. When not streaming, useDeferredValue returns
  //  `code` immediately — identical behavior to the pre-T4 path."
  const deferredCode = useDeferredValue(code)
  const effectiveCode = streaming ? deferredCode : code
```

Prop contract at `:92-100`; threaded from `tool-bodies/ExecuteCodeBody.tsx:26`. **This is the
shipped, phase-blessed in-render coalescing mechanism** (Phase 075.9 T4) and its docblock even
records the decision *"No manual debounce loop / lodash needed."*

### The other candidates — measured absent

| Mechanism | Occurrences in `frontend/src` |
|---|---|
| `useTransition` | **0** |
| `startTransition` | **0** |
| `useDeferredValue` | **1** (`ShikiCode.tsx:109`; docs at `ExecuteCodeBody.tsx:26`, `ShikiCode.tsx:95`) |
| `requestAnimationFrame` (production) | **7** — `MessageList.tsx:94` (listener-attach retry) · `metadata/InlineEdit.tsx:190,257` (focus restore) · `panel/FilesSection.tsx:213` · `ui/AnimatedNumber.tsx:110,117` (an animation loop) · `workflows/StepTypePicker.tsx:303`. **None coalesces state updates** — there is no rAF-batching precedent to copy |

### ⭐ The decision this hands the planner, with the evidence attached

The two shipped mechanisms sit at **different layers**, and D-243-04 is what makes the choice
consequential rather than stylistic:

| | `makeThrottle` on `onDelta` / `onReasoningDelta` (**producer**) | `useDeferredValue` in `ThinkingBlock` (**consumer**) |
|---|---|---|
| Repaint cadence of the fold | coalesced ✅ | coalesced ✅ |
| Frequency of `setMessages` | **reduced** | **unchanged** |
| Frequency of `MessageList.tsx:141-176` (`messages` in the dep array at `:176`) | **reduced** ✅ | **unchanged** ❌ |
| Satisfies CHAT-02 | yes | yes |
| Satisfies D-243-04's *"they are one line of code"* linkage to CHAT-03 | **yes** | **no** |

⇒ **Only the producer-side throttle has the property D-243-04 is written about.** A consumer-side
`useDeferredValue` would make the fold calm and leave the scroll effect running per token — it
would close CHAT-02's flicker criterion and touch CHAT-03 not at all. Say which was chosen and why;
do not choose by habit.

### ⛔ The sharpest implementation trap — `makeThrottle` is LAST-WRITE-WINS, not accumulate

```ts
// lib/throttle.ts:18-32
let lastArgs: Parameters<T> | null = null
const throttled = ((...args) => {
  lastArgs = args                          // ← previous args are DISCARDED
  if (timer === null) timer = setTimeout(invoke, waitMs)
})
```

The accumulation currently lives **inside** the `setMessages` updater:

```ts
// StreamsProvider.tsx:412-428
onDelta: (delta) => {
  setMessages(prev => prev.map(m => m.id === assistantId
    ? { ...m, isPlanning: false, content: m.content + delta } : m))     // ← `m.content + delta`
},
onReasoningDelta: (delta) => {
  setMessages(prev => prev.map(m => m.id === assistantId
    ? { ...m, reasoningContent: (m.reasoningContent ?? "") + delta } : m))
},
```

⇒ **Wrapping `onDelta` in `makeThrottle` naively DROPS TOKENS.** The correct shape is a closure
accumulator (the file already uses closure state — `let currentIteration = 0` at
`StreamsProvider.tsx:410`), flushed through the throttle, with `.flush()` called at the terminal
edges: `onDone` (`:430-434`) and `onTerminal` (`:435-437`). That mirrors the cache writer's own
flush discipline (`throttle.ts:4-6`: *"still guaranteeing a clean snapshot at terminal events + on
thread switch via `.flush()`"*).

⚠ Also: `makeThrottle` has **no leading edge** (`throttle.ts:8-9`), so the first token's paint is
delayed by up to `waitMs`. On a 500 ms window that is a visible half-second of nothing. Pick the
window deliberately and state it.

---

## Shared patterns (apply to every plan in this phase)

### 1. The fold control — mounted, never re-implemented
**Source:** `frontend/src/components/chat/FoldTrigger.tsx:53-74`
**Apply to:** `ThinkingBlock.tsx`
`:21-25` is the standing rule (*"IT IS ONE COMPONENT AND NOT TWO LOOKALIKES … A second copy is how
two surfaces drift"*). `:43-48` forbids a `count` for reasoning. `:27-32` forbids making it louder.

### 2. Self-guard, never a caller branch
**Source:** `StreamingNarration.tsx:27` · `CitationList.tsx:34`
**Apply to:** `ThinkingBlock.tsx` — `if (!content) return null`. This is the mechanical form of
D-243-01's *"the tool-conditionality disappears by construction, not via a second branch."*

### 3. Radix `Collapsible` composition + the animation classes
**Source:** `CitationList.tsx:39-58` · `StreamingNarration.tsx:29-53` · `RunCard.tsx:479-505`
**Apply to:** `ThinkingBlock.tsx`. The primitive is a bare re-export
(`components/ui/collapsible.tsx:1-9`). The `data-[state=open]:animate-in …` string at
`RunCard.tsx:500` is the shipped one — move it, do not retype it.

### 4. Two-docblock extraction header
**Source:** `UserMessageBubble.tsx:1-7` + `:11-24`
**Apply to:** `ThinkingBlock.tsx`. Phase-243 extraction header on top; `RunCard.tsx:473-477`'s
Phase 076.2 D-01 three-state contract moved verbatim beneath it.

### 5. The chat-wide RAW source fence — a NEW file in `chat/` enters it automatically
**Source:** `components/panel/__tests__/WorkspacePanel.test.tsx:1137-1141` (`CHAT_GLOB` =
`import.meta.glob("../../chat/**/*.{ts,tsx}", { eager:true, query:"?raw" })`), assertions at
`:1163-1200`.
**Apply to:** `ThinkingBlock.tsx`'s **comments as well as its code**. The sweep is raw and
un-stripped **by design** (`:1118-1122`). Forbidden spellings: `cancelRun(`, `stopThread(`,
`stopStream(` (`:1165`) and `/(?:workflowLock|lock)\s*\??\.\s*runId/` (`:1163`). The stated
workaround for prose that must discuss them: *"write it without its parenthesis"*.
⚠ Phase 194.1 tripped this fence **twice on docblocks that merely explained the rules**.

### 6. Test placement, harness, and fixture
**Source:** §C. `components/chat/__tests__/` · `render(<TooltipProvider>{ui}</TooltipProvider>)` ·
a local `makeMessage(overrides: Partial<Message> = {}): Message`.

### 7. Both gate knobs, in the same commit
**Source:** `scripts/vitest-count-gate.cjs:144`, `:3653`, `:4536-4538`
**Apply to:** every new suite. §D carries the literal shapes.

---

## No analog found — say so in the plan rather than inventing one

| What the phase needs | Status | Consequence for the planner |
|---|---|---|
| A reusable clamp component or `useClamp` hook | ⛔ **does not exist.** Three unrelated implementations (`UserMessageBubble.tsx:26-64`, `CandidateCard.tsx:42+154-167`, `CitationCard.tsx:185-205`); only the first self-removes | **copy `UserBubble`'s four-move mechanism** into `ThinkingBlock`. Do not mount `UserBubble` — it is violet-bubble-bound (`:43,53,60`) |
| A shared elapsed / duration formatter | ⛔ **does not exist — there are already TWO.** `RunCard.tsx:588-594` `formatElapsed` (file-local) and `MessageList.tsx:49-58` `formatFloatingElapsed` (a second, near-duplicate) | `"Thought for N seconds"` would make it **three**. Phase 095's build-once rule applies. Either extract one, or state plainly that a third file-local formatter is being accepted and why |
| The elapsed VALUE at the `MessageItem` mount point | ⛔ **not available there.** The derivation is 55 lines of `RunCard` internals (`:143-198`: `runStartMs` / `frozenEndRef` / `wasStreamingRef` / the honesty gate) reading `message.startedAt`, `message.created_at`, `message.completedAt` | This is the **real cost of D-243-01's move**, and no plan should discover it mid-build. Three doors: (a) `ThinkingBlock` takes the whole `message` (matches `RunCard.tsx:34-37` but widens the leaf's prop), (b) lift the derivation into a hook (a second concern in a hot file — G-5), (c) derive `N seconds` from a narrower input. **Name the door in the plan.** |
| The string `"Thought for N seconds"` | ⛔ **appears nowhere** in `frontend/src` | new copy, not reuse |
| The string `"Show all of it"` | ⛔ **appears nowhere.** `Show all` exists only at `ModelDiscoveryPanel.tsx:480`, `templateFirstVocabulary.ts:237`, `runLogVocabulary.ts:50` — none a clamp control | new copy, not reuse. The shipped clamp says `Read more` / `Show less` (`UserMessageBubble.tsx:62`) |
| Any test of the thinking block | ⛔ **zero.** `thinking-trigger` / `thinking-row` are asserted by nothing | the extraction has **no safety net**. Write the characterization cases against the UNMOVED `RunCard` first — `RunCard.characterization.test.tsx:1-19` is the template and cites its own precedent |
| Any test of `MessageList`'s scroll effect's behaviour | ⛔ **zero.** `MessageList.test.tsx:61-65` stubs `scrollIntoView` to a no-op; the 5 D-03 cases test the **chip** | nothing today can see a change in scroll cadence or `behavior`. A CHAT-03 fence must spy `scrollIntoView` and assert **call count + the `behavior` argument**, not merely that the chip appears |
| Any `StreamsProvider` suite in either gate knob | ⛔ **zero** — measured | a new cadence suite needs **both** knobs. Adopting the ~10 existing ungated provider suites is out of scope, but the plan should say it noticed |
| `useTransition` / `startTransition` / rAF render-batching | ⛔ **zero occurrences** | the only shipped in-render coalescer is `useDeferredValue` at `ShikiCode.tsx:109`. See §E for why it is probably the wrong layer here |

---

## F. Anti-patterns — drawn from these files, not from general advice

1. ⛔ **Presence-only `getByTestId`.** `RunCard.test.tsx:59-62` is the shape D-243-11 forbids:
   `expect(screen.getByTestId("run-card")).toBeInTheDocument()`. `RunCard.characterization.test.tsx`
   leans on the same form across all 8 states. **Where the words are the deliverable —
   `"Thought for N seconds"`, the absent `count`, the clamp control's presence AND its
   self-removal — assert rendered CONTENT** (`MessageList.test.tsx:189` is the good form).

2. ⛔ **A third elapsed formatter.** `RunCard.tsx:588-594` and `MessageList.tsx:49-58` are already
   two near-duplicates of the same idea. Adding `"Thought for N seconds"` as a third file-local
   helper repeats the drift that `FoldTrigger.tsx:21-25` and `lib/connectionMark.tsx` were both
   created to end.

3. ⛔ **Copying the wrong clamp.** `CandidateCard.tsx:104` mounts its toggle unconditionally;
   `CitationCard.tsx:196-205` likewise. Only `UserMessageBubble.tsx:56` gates on `overflowing`.
   Copying either of the first two ships an inert control on the **median 198-char** body, which is
   D-243-02's stated failure.

4. ⛔ **"Fixing" `StreamingNarration`'s nested scroller while you are in there.**
   `StreamingNarration.tsx:48` carries the *identical* `max-h-64 overflow-y-auto border-l-2
   border-muted-foreground/20` anti-pattern that `RunCard.tsx:501` is being fixed for. It is
   **narration, not reasoning**, and it is out of scope — CHAT-05 moves the ANSWER out of that
   component, it does not restyle the component.

5. ⛔ **Dropping `type="button"`.** `RunCard.tsx:489-493` and `CitationList.tsx:53` both omit it;
   `StreamingNarration.tsx:32` and `UserMessageBubble.tsx:58` have it. Carry the correct one into
   the extraction — a bare `<button>` inside a form defaults to `submit`.

6. ⛔ **Spelling a forbidden call in the new file's docblock.** `chat/ThinkingBlock.tsx` enters
   `WorkspacePanel.test.tsx`'s RAW `CHAT_GLOB` sweep the moment it exists (§Shared 5). Phase 194.1
   tripped that fence twice on comments alone.

7. ⛔ **"Optimising" `prev.map` into an in-place mutation.** `StreamsProvider.tsx:413-417` /
   `:422-428` allocate a new array per token, which looks wasteful — but `MessageItem.tsx:213-219`
   records that the `memo` contract **depends** on replace-not-push identity semantics
   (*"StreamsProvider mutates messagesByThread by REPLACE (not in-place push), so message prop
   identity reliably changes only when the message actually changed"*). Coalescing the **cadence**
   is in scope; changing the **update shape** is D-243-08's red line.

8. ⚠ **Losing `thinkingOpen`'s remount semantics.** `RunCard.tsx:91` holds the fold state, and
   `RunCard.tsx:92-96` resets **`userExpanded` only** on `message.id` change (with an
   `eslint-disable-next-line react-hooks/set-state-in-effect`). `thinkingOpen` has **no reset
   today**, so it survives the temp-id → DB-id reconcile because `RunCard` itself is not
   re-keyed. Moving the state into a component mounted from `MessageItem` changes that. The cheap
   answer is `key={message.id}` on the mount — but the plan must **decide** it, not inherit it by
   accident.

9. ⚠ **Deleting `data-testid="thinking-trigger"` / `"thinking-row"` silently.** Nothing asserts
   them (§C), so their removal is invisible to every gate. Keep them on the extracted component and
   add the content assertions beside them.

10. ⚠ **Retyping the streaming label.** It ships as `"Thinking..."` — three ASCII dots
    (`RunCard.tsx:496`), not `…`. A fence that pins `"Thinking…"` will red against correct code.

11. ⚠ **Reaching for `GSD_VITEST_MAX_WORKERS` when the gate reds.** D-243-10 §2 and
    `CLAUDE.md`'s Phase-195 correction: capture the failing filenames from the gate's own
    persisted JSON **before** re-running, check each against `git diff --numstat`. Two of
    `SEED-171`'s five cap-independent flaky suites are chat-adjacent.

---

## Metadata

**Analog search scope:** `frontend/src/components/chat/` (all 41 files listed + `__tests__/` 28
files + `tool-bodies/`), `frontend/src/components/chat/UserMessageBubble.tsx`,
`frontend/src/providers/StreamsProvider.tsx` (targeted reads: `:395-450`, `:101`, `:1440`, `:3525`),
`frontend/src/hooks/useFollowScroll.ts` (`:51-226`), `frontend/src/lib/throttle.ts`,
`frontend/src/__tests__/components/`, `frontend/src/__tests__/components/chat/`,
`frontend/src/__tests__/hooks/`, `frontend/src/__tests__/providers/`,
`frontend/src/components/skills/tuner/`, `frontend/src/components/ui/collapsible.tsx`,
`scripts/vitest-count-gate.cjs` (targeted reads: `:100-200`, `:3140-3180`, `:3600-3700`,
`:4520-4570`, `:4675-4770`), `docs/HOT-FILE-LEDGER.md` (index grep only),
`.planning/sketches/050-long-prompt-readmore/README.md`.

**Tree-wide greps run (whole `frontend/src`):** `line-clamp|lineClamp|Show all|Show more|maxHeight`
· `makeThrottle` · `requestAnimationFrame` · `useDeferredValue|useTransition|startTransition` ·
`debounce` · `thinking-trigger|thinking-row|reasoningContent|Thinking` (tests) ·
`scrollIntoView|isPinned|beginProgrammaticScroll` (tests) · `import.meta.glob` (tests) ·
`Thought for` · `?raw"` (chat tests).

**Line counts confirmed at HEAD** (they match `243-CONTEXT.md` D-243-07 exactly, so its triples
were not stale on this axis): `MessageList.tsx` **292** · `RunCard.tsx` **729** ·
`MessageItem.tsx` **707** · `StreamsProvider.tsx` **4189**.

**Ledger sections to read before planning** (D-243-07 requires it):
`docs/HOT-FILE-LEDGER.md:1608` (`RunCard.tsx` — the named seam is *"the run-identity header vs the
status/terminal vocabulary vs the elapsed-timer machinery"*, and `:1618` records that its G-5
obligation *"passes forward COMPLETELY UNTOUCHED AND UNDISCHARGED"*), `:175` (`MessageItem.tsx`),
`:1653` (`MessageList.tsx`), `:298` (`StreamsProvider.tsx`).

**Pattern extraction date:** 2026-09-11. **No source file was modified.**
