/**
 * Phase 243 Plan 02 (CHAT-01 / CHAT-04 / D-243-01 — sketch 235's operator-approved winner B)
 * — THE ONE REASONING RENDERER.
 *
 * Extracted verbatim from `RunCard.tsx:478-505` and mounted from `MessageItem` for BOTH
 * message shapes. Nothing about how it LOOKS changed in that move: the V1 visual diff was
 * deliberately kept out of 243-02 so the move could be proven byte-neutral first.
 *
 * ⭐ PHASE 243 PLAN 04 IS WHERE THAT DIFF LANDED — the acceptance bar is a FILE,
 * `.planning/sketches/234-the-thinking-block/index.html`, §V1. Four classes out, one size
 * step, real paragraphs, a clamp whose control removes itself, and one label.
 *
 * ⚠ NO CLASS TOKEN IS SPELLED IN THIS FILE'S PROSE, AND THAT IS DELIBERATE. The class set
 * is the deliverable and it is asserted by a `grep -o ... | sort | uniq -c` over this file;
 * a comment naming a dropped token makes that count read as though the token still shipped.
 * Same rule, one register over, as the fence-needle note further down (the 187-24 trap).
 *
 * ── WHY THE COMPONENT BOUNDARY *IS* THE FIX ─────────────────────────────────────────────
 *
 * `CHAT-04` reads as though a gate needed flipping, and it did not. `RunCard.tsx:478-502`
 * was the ONLY renderer of `reasoningContent` in the codebase, and `MessageItem.tsx:359-361`
 * mounts `RunCard` only on a turn that called a tool — so **removing a gate would have
 * revealed nothing, because the component that does the revealing was never mounted.**
 * Measured for D-243-03: **105 of 340 reasoning-bearing rows (31%) called no tool at all**,
 * and every one of them had its reasoning drawn nowhere.
 *
 * ⛔ **THE TOOL-CONDITIONALITY DISAPPEARS BY CONSTRUCTION, NEVER VIA A SECOND BRANCH.** This
 * component self-guards on its own content — the `StreamingNarration.tsx:27` shape — and
 * `MessageItem` mounts it with no test of the turn's tool list anywhere. A condition on the
 * mount would restore the defect in a form that reads as tidiness, which is why
 * `ThinkingBlock.characterization.test.tsx` §12 fences the mount expression on source.
 *
 * ⭐ **ONE FIX RIDES ALONG, AND IT IS RECORDED RATHER THAN SLIPPED IN:** the trigger gains
 * an explicit non-submit button type. `RunCard.tsx:489-493` omitted it (as `CitationList.tsx:53` does);
 * `StreamingNarration.tsx:32` and `UserMessageBubble.tsx:58` have it. A bare `<button>`
 * inside a form defaults to `submit`.
 *
 * ⚠ **NO `key` ON THE MOUNT, AND THAT IS A DECISION (243-PATTERNS §F.8).** `RunCard` held
 * this fold state and reset only its OWN `userExpanded` on an id change, so an open fold
 * survived the temp-id → DB-id reconcile. `MessageList.tsx:220` keys a run-bearing assistant
 * row by `runId`, which is stable across that swap, so the behaviour carries across this
 * move untouched. `key={message.id}` is the cheap answer and it would close an open fold on
 * every reconcile — a behaviour change smuggled in as tidiness. Fenced by §13.
 *
 * ── THE ORIGINAL CONTRACT, MOVED VERBATIM (Phase 076.2 D-01) ────────────────────────────
 *
 *   Collapsible Thinking block for DeepSeek reasoning content. Three rendering states:
 *     1. reasoningContent present (streaming or completed): collapsible block
 *     2. Streaming + isPlanning + no reasoningContent yet: placeholder shimmer
 *     3. Neither: nothing rendered
 *
 * ⚠ **CORRECTION, RECORDED BESIDE THE CONTRACT RATHER THAN OVER IT: only STATE 1 MOVED.**
 * State 2 — the `thinking-row` planning placeholder — deliberately stayed in `RunCard`, and
 * the reason is measured rather than stylistic: the duration it renders comes from 55 lines
 * of card-internal derivation (`RunCard.tsx:143-198` — the run-start baseline, the frozen
 * end, the was-streaming gate and the honesty rule) reading three fields of the whole
 * message. Moving it would have widened this leaf's props to carry machinery it has no other
 * use for. It is a planning-GAP placeholder on a live run, not a reasoning renderer — it
 * draws only when reasoning is ABSENT — so leaving it behind creates no second renderer of
 * reasoning. State 3 is this component's `return null`.
 */
import { useLayoutEffect, useRef, useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import { FoldTrigger } from "./FoldTrigger"

interface ThinkingBlockProps {
  /**
   * The model's reasoning for this turn. Narrowed deliberately: the whole-`Message` prop
   * shape belongs to exactly two components in this folder (`RunCard`, `MessageItem`) and
   * this is a leaf.
   */
  reasoningContent?: string
  /** Whether the OWNING MESSAGE is still streaming — drives the label and nothing else. */
  isStreaming?: boolean
}

/**
 * Sketch 234 V1, `index.html:332` — `ps.map(p => "<p>" + p + "</p>")`.
 *
 * ⭐ THIS IS WHY DROPPING THE PRE-WRAP RULE IS CORRECT RATHER THAN A REGRESSION TO A
 * RUN-ON WALL. The shipped body preserved every newline literally in a monospaced face; V1
 * turns BLANK-LINE breaks into real paragraph elements and lets single newlines inside a
 * paragraph collapse to spaces, which is what prose does. Measured against D-243-03's 170x
 * spread: the median 198-char body is ONE paragraph (no scaffolding around one sentence) and
 * the 33,713-char tail is readable instead of being a wall behind a scrollbar.
 *
 * ⛔ LOSSLESS BY CONSTRUCTION, and fenced as such (§5b-iv). Empty segments are dropped and
 * each paragraph is trimmed — no NON-BLANK line may be lost, because a split that ate a
 * model's words would still satisfy any element-count assertion.
 *
 * ⛔ THE ANSWER'S TWO-PASS PARAGRAPH-DEDUP HELPER IN `lib/messageText.ts` IS NOT USED HERE,
 * and the omission is a decision: applying it would silently delete a model's deliberately
 * repeated reasoning line. Reasoning is the model's raw prose, not the answer. (Its name is
 * unspelled for the same grep reason as the class tokens.)
 */
function toParagraphs(reasoning: string): string[] {
  return reasoning
    .split(/\n[ \t]*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
}

/**
 * Sketch 234 V1, `index.html:139-142` — the tail treatment's height, in pixels.
 *
 * ⛔ THE COPY `Show all of it` IS NEW. It does not exist anywhere in this tree (measured:
 * `Show all` appears at `ModelDiscoveryPanel.tsx:480`, `templateFirstVocabulary.ts:237` and
 * `runLogVocabulary.ts:50`, none of them a text-clamp control, and the shipped clamp says
 * `Read more`). WHAT IS REUSED IS THE MECHANISM, NEVER THE STRING — `UserMessageBubble.tsx:26-64`,
 * four moves: measure pre-paint, cap while collapsed, fade only while capped, and ⭐ gate the
 * CONTROL on measured overflow so it removes itself instead of sitting inert on a short body.
 * Describing this as copy reuse would be wrong, so it is described as what it is.
 *
 * ⚠ THE VALUE IS DUPLICATED IN THE CAP CLASS BELOW, AND IT HAS TO BE: Tailwind's arbitrary
 * value must be a literal for the compiler to emit the rule. The suite pins both, so the two
 * cannot drift apart silently.
 */
const CLAMP_MAX_PX = 300

export function ThinkingBlock({ reasoningContent, isStreaming }: ThinkingBlockProps) {
  // Phase 076.2 D-01: collapsed by default. ⚠ The DEFAULT is untouched by the move — the
  // 224-PREFLIGHT §3.2 rule holds: flipping it would be a regression dressed as consistency.
  const [thinkingOpen, setThinkingOpen] = useState(false)
  // ── THE CLAMP (D-243-02 / sketch 234 V1 — the shipped sketch-050 mechanism) ───────────
  const bodyRef = useRef<HTMLDivElement>(null)
  const [overflowing, setOverflowing] = useState(false)
  const [clampExpanded, setClampExpanded] = useState(false)
  // `useLayoutEffect` (NOT `useEffect`) so the measure runs PRE-PAINT — `UserMessageBubble.tsx:32-35`
  // records the reason: a post-paint measure shows one frame at full height before the cap
  // applies (RESEARCH Pitfall 5). Keyed on the content, which is what changes during a stream.
  //
  // ⚠ THE COMPARISON IS AGAINST THE CAP, NOT AGAINST `clientHeight`, AND THE DIFFERENCE IS
  //   OBSERVABLE. `scrollHeight > clientHeight` (the bubble's form) can only be true once the
  //   cap is already APPLIED, which would leave the cap class on a 198-char body forever — and
  //   D-243-02 requires the affordance to REMOVE ITSELF below the threshold, not to be present
  //   and inert. Measuring the natural height against the cap gives the same answer without
  //   that circularity. The sketch's `chars < 700` is a PROXY for this measurement; porting the
  //   number instead of the measurement would be a second rule.
  //
  // ⚠ `thinkingOpen` IS IN THE DEPS AND IT IS LOAD-BEARING, not defensive — MEASURED: the
  //   first run of this suite read `expected […] to include 'max-h-[300px]'` with the
  //   implementation already written. `CollapsibleContent` does not render its children while
  //   the fold is SHUT, so at mount `bodyRef.current` is null and there is nothing to measure;
  //   with the content alone in the deps the effect never ran again once the body appeared.
  //   D-243-02 keeps the fold CLOSED by default, so that is the ordinary path, not an edge.
  useLayoutEffect(() => {
    const el = bodyRef.current
    if (el) setOverflowing(el.scrollHeight > CLAMP_MAX_PX + 1)
  }, [reasoningContent, thinkingOpen])
  // ⛔ THE SELF-GUARD. This one line is what makes the tool-conditionality disappear by
  //    construction: the block decides for itself whether it has anything to say, and its
  //    mount site therefore needs to decide nothing.
  if (!reasoningContent) return null
  return (
    <Collapsible
      open={thinkingOpen}
      onOpenChange={setThinkingOpen}
      className="mb-2"
      data-testid="thinking-block"
    >
      <CollapsibleTrigger asChild>
        {/* Phase 224-05 (BUG-260902-07, second half): the SHARED FoldTrigger — the same
            element CitationList mounts. This trigger carried the identical buried-control
            defect (the smaller type size, muted/80, a bare 12px chevron, no surface) and is
            fixed ONCE for
            both rather than twice similarly.
            ⚠ NO `count`: reasoning has no countable unit and inventing one would be
            fabricated precision. */}
        <button
          type="button"
          data-testid="thinking-trigger"
          aria-expanded={thinkingOpen}
          className="px-3 py-1.5 text-left"
        >
          <FoldTrigger open={thinkingOpen} label={isStreaming ? "Thinking..." : "Thinking"} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0">
        {/* ⛔ T-243-02-01: provider-authored reasoning renders as React TEXT CHILDREN ONLY.
            No raw-HTML escape hatch and no markdown pipeline — the same treatment
            `blockedNotice` gets under A23 / T-174-03-01. ⚠ The forbidden API is NOT SPELLED
            here on purpose: §12 fences this file's source for it, and prose that names the
            needle turns a real fence into a lie about itself (the 187-24 trap).
            ⚠ ⭐ THE SKETCH ITSELF USES THAT ESCAPE HATCH (`index.html:332` assigns
            `innerHTML`) BECAUSE IT IS A STATIC MOCKUP OVER FIXTURE PROSE. That is exactly the
            line a port must not cross: the shape is the deliverable, the mechanism is not.

            ⚠ THE CLASS SET IS V1's, CHANGED BY 243-04 UNDER D-243-02 AND BY NO OTHER PLAN.
            Dropped: the monospaced voice, the literally-preserved newlines, and the 16rem
            nested scroller — a scrollbar inside a scrolling conversation, which is what
            CHAT-01 is about. The thin rule and its indent STAY: they are the one thing V1
            keeps. Pinned by §5 / §5b of the characterization net. */}
        <div
          ref={bodyRef}
          data-testid="thinking-body"
          className={cn(
            "px-3 py-2 text-sm text-muted-foreground leading-relaxed border-l-2 border-muted-foreground/20 ml-3",
            // ⛔ A CAP WITH A REVEAL, NEVER A SCROLLER. That distinction IS CHAT-01: the
            //    shipped body hid its tail behind a scrollbar nested inside a scrolling
            //    conversation; this hides it behind a control that gives it back.
            overflowing && !clampExpanded && "relative max-h-[300px] overflow-hidden",
          )}
        >
          {toParagraphs(reasoningContent).map((paragraph, i) => (
            <p key={i} data-testid="thinking-paragraph" className="mb-[11px] last:mb-0">
              {paragraph}
            </p>
          ))}
          {/* The fade runs to the MESSAGE BODY background. ⛔ Not to the user bubble's violet:
              that colour is matched to the bubble's own gradient and is legible only on it,
              which is one of the four bindings that make `UserBubble` copyable but not
              mountable here. */}
          {overflowing && !clampExpanded && (
            <div
              aria-hidden
              data-testid="thinking-fade"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-[76px] bg-gradient-to-t from-background to-transparent"
            />
          )}
        </div>
        {/* ⭐ GATED ON MEASURED OVERFLOW — THE MOVE THAT MATTERS. Below the threshold this
            control is not rendered at all, so the median 198-char body looks finished rather
            than truncated. The two other clamps in this tree mount their toggle
            unconditionally; D-243-02 names that shape as the thing not to copy. */}
        {overflowing && (
          <button
            type="button"
            data-testid="thinking-clamp-toggle"
            onClick={() => setClampExpanded((v) => !v)}
            className="ml-[28px] mt-[9px] text-xs text-primary underline underline-offset-2"
          >
            {clampExpanded ? "Show less" : "Show all of it"}
          </button>
        )}
      </CollapsibleContent>
    </Collapsible>
  )
}
