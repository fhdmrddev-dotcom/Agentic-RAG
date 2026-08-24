/**
 * Phase 124-02 Task 2 (WUX-02, sketch 047-A variant A / D-01 / D-05) —
 * WorkflowDoorSwitch: the explicit-fork "two doors" shell at the Studio authoring
 * ENTRY.
 *
 * The shell holds ONE piece of local door state (`"both" | "describe" | "govern"`,
 * default `"both"`) and forks the authoring entry into two doors:
 *   - the LOOSE door (`DOOR_A_NAME`, fastest path): the describe-box lineage descended
 *     from WorkflowBuilderPage's empty screen (a textarea labelled for the business
 *     requirement + a draft CTA + an honest hint) PLUS a <WorkflowSoul scale="card">
 *     soul PREVIEW of the current draft/definition PLUS a visible switch strip
 *     (`SWITCH_PROMPT` + `SWITCH_CTA`) — D-05, nothing lost by picking fast.
 *   - the STRICT door (`DOOR_B_NAME`, full control): mounts the EXISTING
 *     `WorkflowBuilderPage` (drafted/govern view) whose form panel already owns the
 *     citation-policy picker / gate chips / folder-scope / model with LIVE tier
 *     recompute and a LOCKED-always-on judge (`llm_judge_rubric`). The advanced
 *     controls are DELEGATED, never re-implemented here (D-05).
 *
 * A persistent return control (`STRIP_BACK`) leaves either open door for the "both"
 * chooser (D-05).
 *
 * ⚠ THE DOORS' WORDS ARE NAMED HERE BY IDENTIFIER AND NEVER QUOTED (193-05, D-24(a)).
 * Every governed string lives in `doorVocabulary.ts` and reaches the JSX below as an
 * imported constant. Prose that spelled a word out would be a SECOND HOME for it, and it
 * would silently read false the moment `193-08` swaps the shipped strings for the build
 * contract's column D — which is the exact drift the vocabulary module exists to remove.
 *
 * RED LINES this shell holds:
 *  - D-01: the library-card Run path (doRun → createThread → postMessage →
 *    create_workflow_run) is NOT wrapped by this fork — it lives elsewhere
 *    (WorkflowsPage RunModal / ChatLayout.doRun) and is never routed through here.
 *  - The shell adds NO API call and NO tier re-derivation of its own. Governance is
 *    delegated to the Builder; the tier display is delegated to WorkflowSoul. A
 *    STRICT workflow can never be silently downgraded by this shell (T-124-07).
 *  - XSS (T-124-05): the describe text + the soul-preview strings render as plain
 *    React text children (auto-escaped). NEVER `dangerouslySetInnerHTML`.
 */
import { useId, useState } from "react"
import { WorkflowBuilderPage, type BuilderInitial } from "@/pages/WorkflowBuilderPage"
import { DescribeKbPicker } from "@/components/workflows/DescribeKbPicker"
// Phase 193-03 (D-05 / D-08): the govern door's header strip lives in its own module now —
// the G-5 extraction, shipped BEFORE the D-04 restack that lands on it. Imported as a VALUE
// at module scope, which is why `DoorHeaderStrip.tsx` may never import back (D-24(b)).
import { DoorHeaderStrip } from "@/components/workflows/DoorHeaderStrip"
// 193.1-08 (D-24): the SAME row this shell's govern door renders one level down, and the
// leaf that reads a held document. ONE component and ONE hook serve both describe screens —
// two implementations of one control is how the two doors would start answering differently
// to the same document.
import { DescribeTemplateRow } from "@/components/workflows/DescribeTemplateRow"
import { StarterTemplatePicker } from "@/components/workflows/StarterTemplatePicker"
import {
  useTemplateRead,
  type TemplateReadAnswer,
  type TemplateReadState,
} from "@/components/workflows/useTemplateFirstDraft"
// Phase 193-05 (D-10 / D-11 / D-23): every governed word on this surface, from the one home.
// A NAMED-IMPORT LIST, never a namespace import — the shipped convention in this directory,
// and the thing that makes an unused or a renamed id a typecheck error rather than a blank.
// ⚠ `STRIP_LABEL_GOVERN` is deliberately ABSENT: it belongs to `DoorHeaderStrip.tsx`, which
// imports it directly. One id, one consumer — routing it through here would re-create the
// coupling the 193-03 cut removed.
import {
  CHOOSER_H1,
  CHOOSER_SUB,
  DESCRIBE_CTA,
  DESCRIBE_CTA_REFUSED,
  DESCRIBE_H1,
  DESCRIBE_REFUSAL,
  DOOR_A_DESC,
  DOOR_A_NAME,
  DOOR_A_NOTE,
  DOOR_A_TIER,
  DOOR_B_DESC,
  DOOR_B_NAME,
  DOOR_B_NOTE,
  DOOR_B_TIER,
  HINT_FRAG1,
  HINT_FRAG2,
  HINT_FRAG3,
  SOUL_LABEL,
  STRIP_BACK,
  STRIP_LABEL,
  SWITCH_CTA,
  SWITCH_PROMPT,
} from "@/components/workflows/doorVocabulary"
import { WorkflowSoul } from "@/components/workflows/WorkflowSoul"
import { type DefShape } from "@/components/workflows/soulData"

type DoorState = "both" | "describe" | "govern"

/**
 * 193.1-08 (D-24) — the held document PLUS its finished reading, or `null` while there is
 * nothing complete to carry.
 *
 * ⚠ A FUNCTION RATHER THAN AN INLINE TERNARY, AND THE REASON IS THE PAIR INVARIANT. The two
 * props cross the hand-off from ONE spread, so the Builder can never receive a document
 * without the answer that goes with it — which is the only shape that could make it RE-READ,
 * and a re-read returns the reading to `loading` at the instant its one-shot auto-draft
 * fires. Excluding the two waiting arms (rather than listing the three settled ones) is what
 * makes that exhaustive: a sixth arm added later lands on the SETTLED side by default, which
 * is the safe default for this particular question — a settled arm carried across costs
 * nothing, while an unsettled one carried across is the race.
 */
function completedTemplateAnswer(
  file: File | null,
  state: TemplateReadState,
): TemplateReadAnswer | null {
  if (!file) return null
  if (state.kind === "idle" || state.kind === "loading") return null
  return { file, state }
}

export interface WorkflowDoorSwitchProps {
  /** The current draft/definition for the soul preview (undefined for a true fresh
   *  build with nothing described yet). Loose read-shape — display only. */
  def?: DefShape | null
  /** The existing definition + row id for the strict door's Open/Tweak-a-draft entry;
   *  absent for a fresh build. Passed straight through to the Builder's `initial`. */
  initial?: BuilderInitial
  /** The Builder's publish-gauntlet render seam — passed straight through to the
   *  govern door's `WorkflowBuilderPage` (the shell never owns the gauntlet). */
  renderPublish?: (
    def: import("@/pages/WorkflowBuilderPage").BuilderDefinition,
    draftId: string | null,
    /** Phase 184-11 (R12): the publish-blocking reason, or null. Passed straight
     *  through — this shell neither derives it nor reads it. */
    blockedReason?: string | null,
    /** Phase 186-07 (D-186-12): the publish-in-flight reporter the Builder's write loop
     *  holds on. Passed straight through, same as the reason above — the shell neither
     *  calls it nor observes it. */
    onPublishRunning?: (running: boolean) => void,
  ) => React.ReactNode
  /** Phase 200.3 (SEED-164 / D-03): Test Run action passed straight through to Builder */
  onTestRun?: (def: import("@/pages/WorkflowBuilderPage").BuilderDefinition, draftId: string | null) => Promise<void> | void
  /** The describe-CTA handler — the loose door forwards the describe text to the
   *  EXISTING draft/generate path (the shell adds no new sink; D-01/T-124-08). */
  onDescribeDraft?: (describe: string) => void
  /** Which door to open initially (default "both"). Open/Tweak land in "govern"
   *  (the fork is the Studio authoring entry — D-01/D-05). */
  initialDoor?: DoorState
  /** Phase 184-11 (D-184-16 debt 1) — the Builder's leave-guard registration seam,
   *  passed straight through to the govern door's `WorkflowBuilderPage`. This shell
   *  owns no dirty state and consults nothing; it is a wire, not a participant. While
   *  the chooser or the describe door is showing, NO Builder is mounted and nothing is
   *  registered, so the host's breadcrumb behaves exactly as it does today. */
  registerCanLeave?: (canLeave: (() => boolean) | null) => void
  /**
   * Phase 184.1-01 (D-184.1-01) — render this shell's door control WITHOUT its own
   * bordered band, so the Builder's merged header row can host it.
   *
   * ADDITIVE AND OPTIONAL, in the same shape as the governance-rails prop the Builder's
   * step-inspector panel gained in 184-09 (named in prose rather than by its identifier:
   * this file's own suite greps the source to zero for that component, and a guard that
   * only passes by making a comment lie is a broken guard):
   * ABSENT ⇒ today's markup, byte-identical, which is what keeps the 13 shipped
   * assertions in `WorkflowDoorSwitch.test.tsx` passing unmodified and the flag-off app
   * exactly as it ships. This shell does NOT read the canvas flag at all — the host page
   * evaluates the one shared gate rule and passes the answer down as this prop, so there is
   * no second copy of the gate here to drift from it. (Stated without naming that rule's
   * identifier: the header suite greps this source to zero for it, and a guard that only
   * passes by making a comment lie is a broken guard.)
   */
  inline?: boolean
  /** The HOST's band content (the `← Workflows` breadcrumb group), passed through
   *  untouched. This shell renders it and reads nothing out of it — `backToLibrary` and
   *  every other handler in it stay owned by `WorkflowsPage` (D-184.1-02). Only
   *  meaningful alongside `inline`. */
  headerLead?: React.ReactNode
}

export function WorkflowDoorSwitch({
  def,
  initial,
  renderPublish,
  onTestRun,
  onDescribeDraft,
  initialDoor = "both",
  registerCanLeave,
  inline,
  headerLead,
}: WorkflowDoorSwitchProps) {
  const [door, setDoor] = useState<DoorState>(initialDoor)
  /** Sketch 200 binds the describe heading to the box as a real `label`, which needs a
   *  stable id. `useId` is the shipped idiom on this surface (`DraftArrivalCard`). */
  const describeBoxId = useId()
  const [describe, setDescribe] = useState("")
  // Phase 124 CR-01 fix: the loose door's draft CTA (`DESCRIBE_CTA`) hands the typed text to
  // the govern-door Builder AND asks it to auto-run the draft. Sticky until the user
  // returns to the chooser (goBoth) so a Builder remount can't re-fire the generate.
  const [handoffDraft, setHandoffDraft] = useState(false)
  /**
   * Phase 187-26 (GAP A): the knowledge base the author chose BEFORE the AI drafts.
   *
   * `""` means "not chosen", which is the state D-187-11 is about — and it is now a state
   * the author ELECTED rather than one the door imposed by having no control at all. It
   * lives beside `describe` and is deliberately NOT cleared by `goBoth`: the hand-off is a
   * one-shot and must not re-fire, but a considered pick is not undone by looking around.
   *
   * It reaches the generator through the govern door's Builder, NOT through
   * `onDescribeDraft` — that is a parent OBSERVER hook, not a channel into the Builder.
   */
  const [kbFolderId, setKbFolderId] = useState("")
  /**
   * 193.1-08 (D-24) — the document the author supplied BEFORE describing, and its reading.
   *
   * It lives beside `describe` and `kbFolderId` and, like `kbFolderId`, is deliberately NOT
   * cleared by `goBoth`: the hand-off is a one-shot and must not re-fire, but a considered
   * pick is not undone by looking around. That is the shipped rule (`:160-166`), followed
   * rather than a second one invented for this control.
   */
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const templateRead = useTemplateRead(templateFile)
  const templateAnswer = completedTemplateAnswer(templateFile, templateRead)
  /**
   * ⚠ ONE NEW `&&` TERM, THE SAME SHAPE AND THE SAME REASON AS THE BUILDER'S (D-07 / D-08).
   * This door's CTA makes no network call — it is a HAND-OFF that arms the Builder's one-shot
   * auto-draft — so a gate that lived only on the Builder's own button would leave THIS path
   * firing `/generate` mid-read: the blind draft the phase exists to prevent, on the screen
   * that just said a document was attached.
   *
   * NO `templateFile !== null` TERM, deliberately. With nothing held the reading is `idle`,
   * never `loading`, so the absence of a read IS the absence of a gate (D-08 by construction).
   * A second conditional here could be got wrong and would read green against every behaviour
   * a suite drives.
   */
  const canDraft = describe.trim().length > 0 && templateRead.kind !== "loading"
  /**
   * 199-08 (DES-01 · sheet `c9-doors-describe` §3) — WHEN THE BOX IS REFUSING SOMETHING THE
   * AUTHOR ACTUALLY TYPED.
   *
   * ⚠ IT ADDS NO RULE AND CHANGES NO ENABLEMENT. It is the FIRST term of `canDraft` above,
   * read back so the surface can say what that term already decided — the sheet's finding is
   * that a disabled button with no sentence is the failure state, not the fix. `canDraft` is
   * untouched, and this expression is never consulted by it.
   *
   * ⚠ THE `length > 0` TERM IS LOAD-BEARING AND IS NOT A DUPLICATE OF THE TRIM. An untouched
   * empty box is refused by the same rule, and captioning it would put a refusal on the first
   * screen an author meets, before they had done anything — which is both the wrong reading and
   * a byte-for-byte change to a resting DOM three suites pin. So the sentence appears only once
   * there is an input to refuse.
   *
   * ⚠ AND IT COVERS ONLY THE FIRST TERM, DELIBERATELY. The second (`templateRead.kind`) already
   * speaks for itself: the attach row renders its own in-flight line, so a second sentence here
   * would be a second home for one fact.
   */
  const refusingDescribe = describe.length > 0 && describe.trim().length === 0

  // Return to the "both" chooser AND clear the one-shot draft hand-off (so re-entering
  // the govern door later doesn't re-trigger a generate).
  const goBoth = () => {
    setDoor("both")
    setHandoffDraft(false)
  }

  // Phase 124 WR-01 fix: with nothing typed yet show the passed def (honest
  // empty-state); once the user types, synthesize a live preview def so the soul
  // PREVIEW reflects the in-progress business requirement instead of staying frozen
  // on the empty-state (D-05 — the preview tracks what you're describing).
  const previewDef: DefShape | null | undefined =
    def ?? (describe.trim().length > 0 ? { business_requirement: describe } : undefined)

  // ── GOVERN DOOR — the EXISTING Builder (delegated, never re-implemented). The
  //    Builder's form panel owns the citation-policy picker / gate chips /
  //    folder-scope / model with live tier recompute + the LOCKED always-on judge
  //    (D-05). ──
  if (door === "govern") {
    // Phase 193-03 (D-05 / D-08) — the door group moved OUT of this file, byte-for-byte, into
    // `DoorHeaderStrip.tsx`; its docblock (which explained the `ml-auto` conditional) moved with
    // it and is not restated here. ONE component serves BOTH variants so they cannot drift, and
    // `goBoth` still never changes hands: the strip is handed the handler this component owns,
    // wherever the node is drawn (D-184.1-02, unchanged by the move).
    return (
      <div data-testid="door-govern" className="flex h-full flex-col bg-background">
        {!inline && (
          <div className="flex items-center gap-3 border-b border-border px-4 py-2">
            <DoorHeaderStrip onBack={goBoth} inline={inline} />
          </div>
        )}
        <div className="min-h-0 flex-1">
          {/* The govern door IS the existing Builder — its advanced governance
              controls are delegated, with live tier recompute + the locked judge.
              CR-01 fix: seed the typed describe text + (when arriving via the loose
              draft CTA) auto-run the draft, so the fast path never dead-ends and the
              user's requirement is never dropped. */}
          <WorkflowBuilderPage
            initial={initial}
            renderPublish={renderPublish}
            onTestRun={onTestRun}
            initialDescribe={describe}
            autoDraft={handoffDraft}
            // Phase 187-26 (GAP A): the door's KB choice, carried into the EXISTING
            // generate call so a fast-path workflow can be born BOUND. `""` (nobody
            // picked) leaves the Builder's own initializer at exactly today's value.
            initialProjectFolderId={kbFolderId}
            registerCanLeave={registerCanLeave}
            // 193.1-08 (D-24) — the supplied document and its FINISHED reading, crossing the
            // hand-off. The precedent is `initialProjectFolderId` directly above (187-26):
            // pre-draft state chosen on this door that only the Builder can spend. This is
            // that mechanism reused, not a new one — no store, no context, no global.
            //
            // SPREAD-CONDITIONAL, the idiom this file already uses for `headerLead` /
            // `headerTrail` below: with nothing supplied both props are genuinely ABSENT from
            // the element rather than present-and-undefined, so the Builder is handed exactly
            // what every other mount hands it.
            //
            // ⚠ ONE SPREAD, NOT TWO, AND THAT IS THE SEED-DO-NOT-RE-READ RULE MADE
            // STRUCTURAL. A document arriving without its answer is the only shape that could
            // make the Builder issue its own read, and a read in flight when the one-shot
            // auto-draft fires is the blind draft D-07 removes. Here the pair cannot come
            // apart: `completedTemplateAnswer` returns null until the reading has settled, and
            // until then this door's own CTA is disabled anyway.
            {...(templateAnswer
              ? { initialTemplateFile: templateAnswer.file, initialTemplateRead: templateAnswer }
              : {})}
            // SPREAD-CONDITIONAL, the D-14 idiom this file's sibling `rails` prop uses:
            // without `inline` the two slots must be genuinely ABSENT from the element, not
            // present-and-undefined, so the Builder's flag-off branch is reached by a page
            // that was handed nothing at all.
            // ⚠ ONE LINE, and mechanically so: `WorkflowBuilderPage.header.test.tsx:475` greps
            // this source for `inline ? { headerLead, headerTrail` contiguously. Wrapping it
            // across lines during the 193-03 move reddened that fence with the DOM unchanged.
            {...(inline ? { headerLead, headerTrail: <DoorHeaderStrip onBack={goBoth} inline={inline} /> } : {})}
          />
        </div>
      </div>
    )
  }

  // ── DESCRIBE DOOR — the 018-A describe-box lineage + a soul preview + the
  //    one-click switch strip to the strict door (D-05). ──
  if (door === "describe") {
    return (
      <div data-testid="door-describe" className="flex h-full flex-col bg-background">
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">
          {/* Phase 184.1-01: with `inline` the HOST has stopped drawing its own band, so
              this one adopts the breadcrumb. Without it, `undefined && …` renders nothing
              and this band is byte-identical to the one that shipped. The describe door is
              not the cramped surface the phase is about, but the `← Workflows` control must
              never simply disappear — an author with no way back is a worse defect than a
              tall header. */}
          {inline && headerLead}
          {/* ⚠ THE SECOND `strip.back` SITE. `DoorHeaderStrip.tsx` holds the first, with an
              identical class list; both render `STRIP_BACK`. That duplication is precisely
              the drift `doorVocabulary.ts` removes, and the D-24(a) fence sweeps BOTH
              sources so a future edit cannot re-type one of them (193-05, RESEARCH § H-1).

              ⚠ 193-09 (D-22) — THIS CONTROL IS DEMOTED TOO, AND ONLY DEMOTED. The govern
              strip dropped its escape hatch's box and outline under D-04; demoting one door's
              escape and not the other's would manufacture a NEW inconsistency one click away,
              which is a worse outcome than the peer reading the restack exists to break. So
              the class string below is the govern control's, character for character — read
              out of that module rather than re-typed, and PROVED equal by an assertion in
              `WorkflowDoorSwitch.test.tsx` that extracts both strings from the two `?raw`
              sources. Two hand-typed literals are two homes, and two homes drift.

              ⚠ AND NO DIVIDER ON THIS SIDE. D-22 is explicit: the demotion is the box drop
              and the muted treatment, nothing else. No locked-judge badge lives in this band,
              so there is no third peer to separate from — a rule here would be a mark with
              nothing to divide.

              ⚠ DELIBERATE NON-ACTION: this band was NOT folded into the extracted govern
              strip component. D-05's constraint is one component for the two GOVERN header
              variants (standalone and inline); this is a different band, with no badge and
              with its own host-lead slot, so folding it in would be a structural change with
              neither a decision nor a mockup behind it. Recorded so the absence reads as a
              choice rather than an oversight.

              ⚠ NO MOCKUP EXISTS FOR EITHER BAND, so UAT row U3b is this side's acceptance
              bar (U3 is the govern strip's). */}
          <button
            type="button"
            data-testid="both-doors"
            onClick={goBoth}
            className="px-1 py-1 text-[13px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline focus-visible:outline-none"
          >
            {STRIP_BACK}
          </button>
          <span className="text-[13px] font-medium text-foreground">{STRIP_LABEL}</span>
        </div>
        {/* ── SKETCH 200 (`doors.html`) — ONE CENTRED 720px COLUMN, NOT A SPLIT ──────────
            The sheet draws the whole describe screen as a single column of labelled
            sections: the box, then the knowledge picker, then the template row. The shipped
            `lg:grid-cols-[1fr_320px]` split put the soul preview in a sidebar, which is why
            the box never reached the sheet's width and the sections never read as a sequence.

            ⚠ THE SOUL PREVIEW IS KEPT AND MOVED, NOT DROPPED. The sheet has no aside — but
            `SOUL_LABEL` and `<WorkflowSoul scale="card" />` are shipped surface carrying what
            the workflow WILL DO, and removing the only place they render would lose it. It
            becomes the last section of the column instead, so the sheet's composition holds
            and nothing is lost. The `WorkflowSoul` element itself is untouched. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8">
          <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
          {/* The describe box (descends from WorkflowBuilderPage's empty screen). */}
          <div className="flex flex-col gap-2">
            {/* ⚠ THE HEADING IS THE BOX'S LABEL NOW, AND IT IS BOUND TO IT. The sheet draws
                this as a left-aligned `font-data-md` label above the textarea, not as a
                centred h1 under a decorative glyph. Dropping the ✎ is the port: the sheet
                spends no ornament here, and the glyph named nothing. */}
            <label
              htmlFor={describeBoxId}
              className="font-mono text-[14px] leading-[1.4] text-foreground"
            >
              {DESCRIBE_H1}
            </label>
            {/* ── 199-08 (sheet c9 §3) — THE BOX, AND ITS ONE TONED STATE ──
                ⚠ THE CLASS LIST IS A CONCATENATION, NEVER TWO `className` BRANCHES, and the
                shape is `DoorHeaderStrip.tsx`'s `ml-auto` conditional copied in kind for the
                same mechanical reason: with nothing refused the three slots below resolve to
                the class list that shipped, CHARACTER FOR CHARACTER, which is exactly what
                `WorkflowDoorSwitch.baseline.test.tsx` holds byte for byte across six states.
                A rewrite that grouped the tokens differently would red that pin while changing
                no pixel — and re-baselining a characterization pin to make a red go green is
                forbidden in terms.

                ⚠ TONE IS THE SECOND CARRIER, NEVER THE ONLY ONE (WCAG 1.4.1): the refusal is
                a SENTENCE first, and this border is a reinforcement of it. `destructive` is a
                shipped token that resolves in `tailwind.config.js` — verified rather than
                assumed, because fifteen of this sheet's seventeen colour tokens compile to
                nothing here and would render identically to an arm nobody painted. */}
            <textarea
              id={describeBoxId}
              aria-label="business requirement"
              data-testid="describe-box"
              value={describe}
              onChange={(e) => setDescribe(e.target.value)}
              placeholder="Describe the steps…"
              rows={5}
              // SPREAD-CONDITIONAL, this file's shipped idiom: with nothing refused the
              // attribute is genuinely ABSENT rather than present-and-false, so the resting
              // markup carries no claim at all. `aria-invalid="false"` would not be.
              {...(refusingDescribe ? { "aria-invalid": true } : {})}
              // ⚠ STILL A CONCATENATION AND NEVER TWO `className` BRANCHES — the shipped shape,
              // kept for the shipped reason: the three refusing slots resolve to the ordinary
              // class list character for character when nothing is refused.
              // ⚠ `resize-y` AND `rounded` AND `focus:ring-0` COME FROM SKETCH 200: the sheet
              // lets the author grow the box (a describe box you cannot see all of is the
              // complaint behind the whole screen), uses the 2px radius the design system's
              // DEFAULT token carries, and draws the focused border WITHOUT a second ring.
              className={`w-full resize-y rounded border ${refusingDescribe ? "border-destructive" : "border-border"} bg-card p-4 text-[14px] leading-[1.5] text-foreground ${refusingDescribe ? "focus:border-destructive" : "focus:border-primary"} focus:outline-none focus:ring-0`}
              /* ⚠ TWO TONE SLOTS NOW, NOT THREE, AND THAT IS THE SHEET'S DOING RATHER THAN A
                 WEAKENING. Sketch 200 draws this box `focus:ring-0` — the focused state is the
                 BORDER changing colour, with no second ring behind it — so there is no third
                 slot left to swing. The refusal's primary carrier also got STRONGER in the same
                 port: it is a left-accent panel with a glyph and a body-size sentence, where it
                 used to be a 12.5px line. Tone is still never the only carrier. */
            />
            {/* ── ⚠ THE REFUSAL, SAID OUT LOUD — and sketch 200 draws it as a BLOCK ──────────
                The sheet gives this its own left-accent panel with a glyph: a tinted fill, a
                hairline border, a 4px destructive rule down the left edge, and the sentence at
                body size. The shipped treatment was a 12.5px line under the box, which is the
                same words at the weight of a caption.

                `role="status"` rather than `alert`: the author is mid-typing and this is a
                standing condition, not an interruption. Rendered only while there is an input
                to refuse, so it never greets anyone.

                ⚠ TONE IS THE SECOND CARRIER, NEVER THE ONLY ONE (WCAG 1.4.1) — the refusal is
                a SENTENCE first and this panel reinforces it. `destructive` is a shipped token
                that resolves in `tailwind.config.js`, verified rather than assumed: fifteen of
                this sheet family's colour tokens compile to nothing here and would render
                identically to an arm nobody painted. */}
            {refusingDescribe && (
              <div
                data-testid="describe-refusal"
                role="status"
                className="mt-1 flex items-start gap-2 rounded-r border border-l-4 border-destructive/30 border-l-destructive bg-destructive/10 p-4"
              >
                <span aria-hidden="true" className="mt-[2px] shrink-0 text-destructive">
                  ⊘
                </span>
                <p className="text-[14px] leading-[1.5] text-destructive">{DESCRIBE_REFUSAL}</p>
              </div>
            )}
            {/* ── 193.1-08 (D-24 / SC#1) — THE PRE-DRAFT ATTACH ROW, ON THE **LOOSE** DOOR ──
                ⚠ THIS IS `WorkflowDoorSwitch.tsx`'s `door-describe` — the screen sketch 165
                actually rendered (`build.cjs:6-7`; its anchor assertions name `switch-strip`,
                which exists only in this file). The govern door's near-identical screen lives
                in `WorkflowBuilderPage.tsx` and carries its own mount; the splice anchor below
                occurs in BOTH files, so the class string cannot tell them apart and every
                assertion about this mount names this file.

                IMMEDIATELY AFTER THE KB PICKER AND BEFORE THE CTA GROUP — the sketch's own
                splice (`165/build.cjs:269` inserts the block BEFORE the CTA group, never in
                it), and the same relative position the govern door's mount takes, so the two
                screens read the same way rather than merely containing the same control.

                It renders the SAME component the Builder mounts. Ignore it and this door
                behaves exactly as it did (SC#4): no document ⇒ the reading is `idle` ⇒ no
                request, no reading block, and `canDraft` above gains nothing. */}
            {/* ── SKETCH 200 — THE CTA IS RIGHT-ALIGNED AND IT CARRIES ITS OWN REASON ──────
                The sheet draws the draft control at the end of the row (`justify-end`), and —
                this is the sheet's finding, not a restyle — draws the REFUSING state as a
                button that SAYS WHY: a block glyph and `DESCRIBE_CTA_REFUSED` in place of the
                verb. A greyed-out control with the unchanged label is the failure state the
                whole screen is about; it tells an author that something is wrong and nothing
                about what.

                ⚠ IT ADDS NO RULE AND CHANGES NO ENABLEMENT. `disabled={!canDraft}` is
                untouched and `canDraft` is untouched. `refusingDescribe` is `canDraft`'s FIRST
                TERM read back — it is never consulted by it — so a box that is empty because a
                template read is still in flight keeps the ordinary label, which is correct: the
                attach row states that condition itself, and a second sentence here would be a
                second home for one fact. */}
            <div className="flex justify-end">
              <button
                type="button"
                data-testid="describe-draft"
                disabled={!canDraft}
                onClick={() => {
                  // Forward the describe text to the EXISTING draft/generate path
                  // (the shell adds no new sink). The govern door (the Builder) owns
                  // the actual generate→draft flow — D-05/T-124-08. CR-01 fix: arm the
                  // hand-off so the Builder seeds the text AND auto-runs the draft
                  // (previously the text was dropped and the user landed on an empty
                  // screen). onDescribeDraft stays as an optional parent observer hook.
                  onDescribeDraft?.(describe)
                  setHandoffDraft(true)
                  setDoor("govern")
                }}
                className={
                  refusingDescribe
                    ? "flex cursor-not-allowed items-center gap-1 rounded border border-border bg-muted px-6 py-2 font-mono text-[14px] leading-[1.4] text-muted-foreground"
                    : "rounded bg-primary px-6 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
                }
              >
                {refusingDescribe && (
                  <span aria-hidden="true" className="text-[16px] leading-none">
                    ⊘
                  </span>
                )}
                {refusingDescribe ? DESCRIBE_CTA_REFUSED : DESCRIBE_CTA}
              </button>
            </div>
            {/* ⚠ D-12: the hint is a SENTENCE, not a string. Only the three bold fragments
                are data; this component keeps the `<b>` markup AND the non-bold connective
                text, so no template language and no parser enter a vocabulary leaf. The
                `{" "}` separators are load-bearing — JSX would otherwise drop the space
                before each `<b>`, and the byte-exact captures in
                `WorkflowBuilderPage.describe.test.tsx` hold that spacing.

                ⚠ KEPT, AND LEFT-ALIGNED. Sketch 200 draws no hint under its box — but these
                are three governed ids saying what the AI will do to your paragraph, and this
                is their only render site. It is demoted to a quiet line in the column's flow
                rather than deleted (nothing in the reference may be dropped; nothing in the
                app may be dropped silently either). */}
            <p data-testid="describe-hint" className="text-[13px] leading-[1.5] text-muted-foreground">
              You describe the goal — the AI{" "}
              <b className="font-medium text-foreground">{HINT_FRAG1}</b>,{" "}
              <b className="font-medium text-foreground">{HINT_FRAG2}</b>, and{" "}
              <b className="font-medium text-foreground">{HINT_FRAG3}</b>.
            </p>
          </div>

          {/* ⚠ SKETCH 200 DRAWS A HAIRLINE BETWEEN EVERY SECTION OF THIS COLUMN. With the
              split gone, the rule is what tells one labelled question from the next. */}
          <div aria-hidden="true" className="h-px w-full bg-border" />

          {/* Phase 187-26 (GAP A): somewhere to say what this work is ABOUT, before the
              AI drafts. OPTIONAL by construction — it touches no enablement rule, and
              ignoring it gives today's behaviour exactly. Its own file, so this shell gains a
              mount and not a surface (the D-187-14 shape).

              ⚠ IT IS ITS OWN SECTION NOW, which is sketch 200's composition: the sheet gives
              the knowledge question a labelled block of its own between two rules, rather than
              a select wedged under the box. Its three drawn arms live in that file. */}
          <DescribeKbPicker value={kbFolderId} onChange={setKbFolderId} />

          <div aria-hidden="true" className="h-px w-full bg-border" />

          {/* ── 193.1-08 (D-24 / SC#1) — THE PRE-DRAFT ATTACH ROW, ON THE **LOOSE** DOOR ──
              ⚠ THIS IS `WorkflowDoorSwitch.tsx`'s `door-describe` — the screen sketch 165
              actually rendered (`build.cjs:6-7`; its anchor assertions name `switch-strip`,
              which exists only in this file). The govern door's near-identical screen lives
              in `WorkflowBuilderPage.tsx` and carries its own mount; every assertion about
              this mount names this file.

              ⚠ ITS POSITION MOVED, AND THE MOVE IS SKETCH 200'S. The 193.1 splice put it
              between the KB picker and the CTA group, mirroring sketch 165. Sketch 200 draws
              the template question as the LAST section of the column, after the knowledge
              question — which is the same relative order (knowledge, then document) with the
              CTA lifted up into the box's own section where the sheet puts it. It renders the
              SAME component the Builder mounts; ignore it and this door behaves exactly as it
              did (SC#4): no document ⇒ the reading is `idle` ⇒ no request, no reading block,
              and `canDraft` gains nothing. */}
          <DescribeTemplateRow
            state={templateRead}
            filename={templateFile?.name}
            onPickFile={setTemplateFile}
            onClear={() => setTemplateFile(null)}
          />

          <div aria-hidden="true" className="h-px w-full bg-border" />

          {/* ── 200-WIRE — THE STARTER SHELF, WHICH THE PORT SILENTLY OMITTED ─────────────
              ⚠ `doors.html:307-319` draws a whole labelled section here — *"Start from
              something that already works"* over a row reading `Invoice audit · 4 steps ·
              Use this` — and NOTHING on this door rendered it. It was not one of the port's
              seven recorded refusals either; it was simply missing, which is the failure mode
              a written refusal exists to prevent.

              ⚠ THE PORT MISREAD WHICH SECTION WAS WHICH, and that is worth writing down
              because it is how the omission survived review. The comment on `DescribeTemplateRow`
              above says sketch 200 draws *"the template question as the LAST section of the
              column"* — but the sheet's section labelled `<!-- Template Row -->` is THIS one,
              the starter shelf. The attach-a-document row is a shipped capability the sheet
              does not draw at all. One sheet section was mapped onto a different shipped one,
              so the count came out right and the surface came out short. Both now render; the
              attach row keeps its shipped position and this arrives after it.

              ⚠ IT IS PURE WIRING. `GET /workflows/starters` ships (`backend/app/api/workflows.py:49`),
              its client is `listStarterWorkflows` (`frontend/src/lib/api.ts`), the library
              already renders a `Starters` filter chip over the same rows, and this exact
              component was ALREADY MOUNTED on the govern door's describe screen
              (`WorkflowBuilderPage.tsx`, behind `canvasEnabled`). The loose door — the one a
              fast-door author actually lands on — had zero mounts. Nothing new is built here.

              ⚠ IT IS **NOT** GATED ON `canvasEnabled`, unlike the Builder's mount. That gate
              belongs to the Builder's own screen for a flag-era reason; this door is the fast
              path and its starter shelf is not a canvas feature. The picker holds no flag of
              its own (187-05 put the gate on the mount deliberately), so the choice is made
              here, in the open.

              ⚠ IT SEEDS THE BOX AND FORKS NOTHING — `onChoose` hands back the starter's own
              `business_requirement` and the caller decides where it lands. Writing it into
              `describe` keeps the single forward path the picker's docblock guards: the text
              stays editable, nothing is created, and the CTA's `canDraft` rule is untouched
              (a seeded box is a typed box as far as it is concerned).

              ⚠ IT ADDS A SIXTH CONTROL TO THIS DOOR, and `WorkflowDoorSwitch.test.tsx`'s
              resting-control pin is re-baselined for it with the reason recorded there. */}
          <StarterTemplatePicker onChoose={setDescribe} />

          {/* D-05: nothing lost by picking fast — advanced is one click away. */}
          <div
            data-testid="switch-strip"
            className="flex flex-wrap items-center gap-2 rounded border border-accent-violet/30 bg-accent-violet/5 px-3 py-2 text-[12px] text-muted-foreground"
          >
            <span aria-hidden="true">🔧</span>
            <span>{SWITCH_PROMPT}</span>
            <button
              type="button"
              data-testid="switch-to-govern"
              onClick={() => setDoor("govern")}
              className="ml-auto rounded-sm border border-accent-violet/40 px-2.5 py-1 text-[12px] font-medium text-accent-violet hover:bg-accent-violet/10"
            >
              {SWITCH_CTA}
            </button>
          </div>

          {/* The soul PREVIEW of the current draft/definition (D-05).

              ⚠ IT IS THE LAST SECTION OF THE COLUMN NOW RATHER THAN A 320px SIDEBAR — the
              sheet's describe page is one column and has no aside. The element inside is
              UNCHANGED: `<WorkflowSoul def={previewDef} scale="card" />`, byte for byte, so
              the preview itself is moved and not re-drawn. */}
          <aside
            data-testid="describe-soul-preview"
            className="rounded border border-border bg-card/40 p-4"
          >
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              {SOUL_LABEL}
            </p>
            <WorkflowSoul def={previewDef} scale="card" />
          </aside>
          </div>
        </div>
      </div>
    )
  }

  // ── BOTH DOORS (default chooser) — two big side-by-side door cards. ──
  return (
    <div data-testid="workflow-doors" className="flex h-full flex-col bg-background">
      {/* Phase 184.1-01: same reason as the describe door — the chooser has no control of
          its own that leaves the Builder, so with `inline` set it hosts the host's
          breadcrumb. This reproduces today's two-row shape rather than improving on it,
          which is correct: the chooser is not the surface the operator reported. */}
      {inline && headerLead && (
        <div className="flex items-center gap-3 border-b border-border px-4 py-2">{headerLead}</div>
      )}
      {/* ── SKETCH 200 (`doors.html`) — THE CHOOSER IS A CENTRED 720px COLUMN ────────────
          The sheet drops the bordered header band and puts the heading in the flow of one
          column: a 32px h1, a 16px sub-line, then the two doors as a `grid-cols-2 gap-4`.
          The band's rule was the only thing separating a heading from the cards it belongs
          to, and removing it is what lets the whole screen read as one page. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto flex w-full max-w-[720px] flex-col gap-8">
          <header className="flex flex-col gap-1">
            <h1 className="text-[32px] font-semibold leading-[1.2] tracking-[-0.02em] text-foreground">
              {CHOOSER_H1}
            </h1>
            <p className="text-[16px] leading-[1.6] text-muted-foreground">{CHOOSER_SUB}</p>
          </header>

          <section className="grid gap-4 sm:grid-cols-2">
            {/* Door A — the loose door (`DOOR_A_*`). */}
            <DoorCard
              testId="door-card-describe"
              onOpen={() => setDoor("describe")}
              glyph="⚡"
              name={DOOR_A_NAME}
              tier={DOOR_A_TIER}
              desc={DOOR_A_DESC}
              note={DOOR_A_NOTE}
              tone="primary"
            />

            {/* Door B — the strict door (`DOOR_B_*`). */}
            <DoorCard
              testId="door-card-govern"
              onOpen={() => setDoor("govern")}
              glyph="🔧"
              name={DOOR_B_NAME}
              tier={DOOR_B_TIER}
              desc={DOOR_B_DESC}
              note={DOOR_B_NOTE}
              tone="violet"
            />
          </section>
        </div>
      </div>
    </div>
  )
}

/**
 * ── SKETCH 200 — ONE DOOR CARD, DRAWN THE SHEET'S WAY ────────────────────────────────
 *
 * The sheet's card is a header ROW (glyph + name on one baseline, a chip pushed to the far
 * edge) over a description paragraph, with a 2px hover lift. The shipped card stacked five
 * atoms vertically — glyph, tier, name, description, `Open ›`, note — which is why it read
 * as a list rather than as a door.
 *
 * ⚠ THE CHIP SLOT HOLDS THE **TIER**, WHICH IS THE SHEET'S OWN SHAPE FILLED WITH A FACT WE
 * HOLD. The sheet draws `CHOSEN` there, which is a state the chooser does not have — you are
 * in neither door while you are looking at both, and a card marked CHOSEN at rest would be
 * claiming a selection nobody made (the class of invention this port forbids). The tier line
 * is what already occupied that role in the shipped card, so it moves into the slot the sheet
 * drew for it rather than a badge being manufactured.
 *
 * ⚠ `Open ›` AND THE NOTE ARE REVEALED ON HOVER AND ON FOCUS, NOT DROPPED. The sheet draws
 * neither — its card is the affordance and its body is two elements. But `DOOR_A_NOTE` /
 * `DOOR_B_NOTE` are governed ids carrying what each door COSTS you, and deleting the only
 * place they render would lose the information rather than declutter it. Disclosure keeps the
 * resting card exactly as drawn and keeps the sentence one gesture away.
 *
 * ⚠ FOCUS, NOT ONLY HOVER — the same rule the knowledge picker's remove control follows. A
 * `group-hover`-only reveal is invisible to an author driving the page from the keyboard, and
 * the sheet has no opinion about that because a sheet has no keyboard.
 */
function DoorCard({
  testId,
  onOpen,
  glyph,
  name,
  tier,
  desc,
  note,
  tone,
}: {
  testId: string
  onOpen: () => void
  glyph: string
  name: string
  tier: string
  desc: string
  note: string
  /** Which accent this door wears. The two doors are told apart by colour in the sheet, and
   *  the loose/strict distinction is the one thing this shell must never blur. */
  tone: "primary" | "violet"
}) {
  const accent = tone === "primary" ? "text-primary" : "text-accent-violet"
  const chip =
    tone === "primary"
      ? "border-primary/20 bg-primary/10 text-primary"
      : "border-accent-violet/20 bg-accent-violet/10 text-accent-violet"
  const hover = tone === "primary" ? "hover:border-primary/60" : "hover:border-accent-violet/60"

  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onOpen}
      className={[
        "group relative flex flex-col gap-2 overflow-hidden rounded border border-border bg-card p-4 text-left",
        "transition-all duration-200 hover:-translate-y-[2px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary",
        hover,
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span aria-hidden="true" className={`text-[20px] leading-none ${accent}`}>
            {glyph}
          </span>
          <h2 className="text-[18px] font-semibold leading-[1.4] text-foreground">{name}</h2>
        </div>
        <span
          className={`shrink-0 rounded-sm border px-2 py-1 font-mono text-[12px] leading-[1.4] ${chip}`}
        >
          {tier}
        </span>
      </div>
      <p className="text-[14px] leading-[1.5] text-muted-foreground">{desc}</p>
      {/* The disclosure footer — nothing at rest, everything one gesture away. `Open ›` is NOT
          a governed id (the build contract's COPY table has no row for it), so it stays a
          literal here rather than travelling to the vocabulary module on a guess. */}
      <span className="flex flex-col gap-1 opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
        <span className={`text-[13px] font-medium ${accent}`}>
          Open <span aria-hidden="true">›</span>
        </span>
        <span className="text-[11px] italic text-muted-foreground">{note}</span>
      </span>
    </button>
  )
}

export default WorkflowDoorSwitch
