/**
 * Phase 243 Plan 02 (CHAT-01 / CHAT-04 / D-243-01 — sketch 235's operator-approved winner B)
 * — THE ONE REASONING RENDERER.
 *
 * Extracted verbatim from `RunCard.tsx:478-505` and mounted from `MessageItem` for BOTH
 * message shapes. Nothing about how it LOOKS changed in this move; the V1 visual diff (the
 * four dropped classes, `text-xs` → `text-sm`, `Thought for N seconds`) is 243-04's, and it
 * was deliberately kept out of here so the move could be proven byte-neutral first.
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
import { useState } from "react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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

export function ThinkingBlock({ reasoningContent, isStreaming }: ThinkingBlockProps) {
  // Phase 076.2 D-01: collapsed by default. ⚠ The DEFAULT is untouched by the move — the
  // 224-PREFLIGHT §3.2 rule holds: flipping it would be a regression dressed as consistency.
  const [thinkingOpen, setThinkingOpen] = useState(false)
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
            defect (text-xs, muted/80, a bare 12px chevron, no surface) and is fixed ONCE for
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
            ⚠ These ten class tokens are pinned by §5 of the characterization net. 243-04 is
            the ONE plan permitted to change them. */}
        <div
          data-testid="thinking-body"
          className="px-3 py-2 text-xs text-muted-foreground whitespace-pre-wrap font-mono leading-relaxed max-h-64 overflow-y-auto border-l-2 border-muted-foreground/20 ml-3"
        >
          {reasoningContent}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
