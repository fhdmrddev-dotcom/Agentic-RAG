/**
 * Phase 103-04 Task 3 (REQ-5 / WFAUTH-01/02, sketch 018-A + 019-D) —
 * WorkflowBuilderPage: the describe-first authoring surface.
 *
 * The first screen is JUST the describe box — a 3-second read at rest: one
 * `<textarea>`, one hint line, one DISABLED submit button, and NOTHING else (no
 * grounding chip, strictness dial, folder picker, phase node, or left rail —
 * grounding is revealed BY the draft, post-draft, never faked up front).
 *
 * On submit the page transitions through a single state union:
 *   "empty" → "composing" → "drafted"   (ok:true)
 *   "empty" → "composing" → "error"     (ok:false OR a thrown error)
 *
 * SINGLE STATE TRANSITION (the falsifiable bar): on `ok:true` the full draft
 * definition AND the "drafted" state are committed in ONE React update, so the
 * whole graph renders in one DOM batch — no per-node enter animation, no timed
 * reveal, no incremental array push. The draft is built whole and rendered once
 * (one-shot emission is proven — spike-097).
 *
 * On `ok:false` (or a thrown/network error) the page renders an honest
 * "could not generate" surface and renders NO phase nodes — never a partial or
 * broken draft (the G-6 silent-invalid-draft guard at the UI seam, T-103-04-01).
 *
 * Refinement is FORM-LED on a READ-ONLY vertical spine (no drag-canvas, no
 * router): the read-only `PhaseSpineGraph` + the 400px push `PhaseFormPanel`,
 * wired exactly like the app's existing ChatLayout push grid
 * (`gridTemplateColumns: minmax(0,1fr) <44px|400px>`).
 *
 * ── Phase 183-07 (CANVAS-01, D-183-01 … D-183-05) — the Canvas door ─────────────
 *
 * THE CANVAS IS AN IN-BUILDER VIEW TOGGLE, NOT A PAGE (D-183-01). The app has no
 * router — navigation is a `useState<ActiveView>` switch — so a standalone canvas
 * "page" would be net-new state plumbing for no user benefit. A `[≣ Spine]
 * [⬡ Canvas]` strip sits on this page's existing graph column and swaps ONE child
 * of the unchanged push grid. Deliberately NO `NAV_ITEMS` entry is tagged
 * `visual_workflow_canvas`: D-183-01 formally released the promise Phase 181
 * deferred, and `revertByteIdentical.test.tsx`'s scope-freeze assertion depends on
 * that entry's continued absence.
 *
 * SPINE IS THE DEFAULT AND THE PREFERENCE IS SESSION-ONLY (D-183-02). The Builder
 * opens exactly as it does today; the toggle cold-starts on Spine on every mount and
 * is never written to browser storage, to a settings row, or to any server. Phase 184
 * owns the question of flipping the default.
 *
 * FLAG OFF ⇒ THE STRIP VANISHES (D-183-03). The gate is three-part and every part is
 * load-bearing: the OPTIONAL accessor (a null context reads exactly like the empty
 * map — fail-closed), a STRICT `true` comparison (an absent key hides, the
 * `visibleNavItems` VANISH contract), and `!loading` (so the strip cannot flash in
 * ~200 ms after load and shift the column). With the flag off this file renders the
 * graph column exactly as it shipped — same element, no wrapper, no reserved space —
 * for EVERYONE including operators (D-181-01).
 *
 * THE CANVAS IS CODE-SPLIT. `@xyflow/react` is ~59 KB gzip and the flag cold-defaults
 * to off for every user, so a static import would charge today's shipped users for a
 * subtree that never renders. The dynamic import also makes "the canvas subtree stays
 * out of the render path" a BUILD-level fact rather than a render-branch claim. (The
 * stylesheet still loads eagerly from `index.css` — the documented plan 183-01 trade.)
 *
 * ONE SELECTION CONTRACT, TWO VIEWS (D-183-05). Both views receive the identical
 * `onSelectNode` callback, so the shipped 400px `PhaseFormPanel` opens on the clicked
 * phase with zero net-new panel work and the toggle-off-on-reclick semantics stay
 * here, on the page, rather than being re-implemented inside either graph.
 *
 * NOT BUILT HERE (D-183-04): the published-workflow canvas door. Viewing a PUBLISHED
 * definition's canvas would require Tweak, whose draft-create call is an INSERT — so
 * merely LOOKING would mint a v(N+1) row. Opening the Canvas view fires no request
 * and writes nothing; no save path below is touched.
 *
 * (Both fences above are stated without naming the draft-create identifier or the
 * landmark element, because this file's own suite greps the source for them and a
 * guard that only passes by making a comment lie is a broken guard — the fifth
 * instance of that trap in this phase, logged as D-ITEM-183-02.)
 *
 * ── Phase 184-04 (D-184-01 / D-184-05) — where the definition lives now ────────
 *
 * THIS PAGE NO LONGER OWNS THE WORKING DEFINITION. It lived here, in a
 * `useState` union, from Phase 103 until Wave 0 of Phase 184. It now lives in ONE
 * per-mount `zustand` + `zundo` temporal store (`builderStore.ts`), created once
 * per Builder mount and carried to the subtree by `BuilderStoreProvider`. The
 * reason is undo: `PhaseFormPanel` is shared by BOTH views, so a config edit made
 * from the Spine flows through the same `onChange`, and a canvas-scoped store
 * would leave those edits outside the history. The undo/redo AFFORDANCES stay
 * canvas-only and flag-gated; the HISTORY is complete.
 *
 * WHAT DID NOT MOVE IN 184, AND HAS NOW MOVED (D-184-05 → D-186-05). 184-04 kept
 * persistence here because Phase 186 was going to rewrite exactly that seam, and it did:
 * the create-once-then-PATCH body, the debounce, the concurrency token, the hold
 * conditions and every refusal branch now live in `useDraftPersistence`
 * (`frontend/src/hooks/useDraftPersistence.ts`), which this page COMPOSES the way it
 * already composes `useLiveValidation`. Updated rather than left standing —
 * `builderStore.ts` carries the same correction (186-04) and two docblocks describing one
 * seam must agree. Selection still stays here: D-183-05, not definition state.
 *
 * ── Phase 184-11 (CANVAS-02 / CANVAS-03 · D-184-15 / D-184-16) — the session ────
 *
 * THIS PAGE IS THE COMPOSITION POINT, AND IT IS THE ONLY ONE. The live validation
 * loop, the governance rails, the cosmetic nudge and the verdict marks all arrive
 * here as hooks and leave as PROPS: `WorkflowCanvas` fetches nothing, and
 * `PhaseFormPanel` derives nothing. That is what keeps VALID-03 ("every verdict
 * comes from the server") and R11 ("no frontend tool whitelist") structural rather
 * than merely intended.
 *
 * NOTHING VALIDATES BEFORE THE AUTHOR'S FIRST EDIT (D-184-15). `hasEdited` starts
 * false and is flipped by the first real EDIT — not by mount, and not by a document
 * transition such as generate/open, which replace the whole definition without the
 * author having changed anything. A zero-step draft is therefore never greeted with
 * `ok:false` + a full problems tray; its Publish carries a plain INVITATION instead,
 * which is not a claimed verdict and therefore not client-side validation.
 *
 * THE THREE SESSION-EDGE DEBTS (D-184-16) ALL LAND HERE:
 *  1. The unsaved-work leave guard — a `canLeave()` callback registered with the
 *     host (there is no router; the breadcrumb lives in `WorkflowsPage`) plus a
 *     `beforeunload` listener mounted ONLY while the draft is dirty.
 *  2. WR-09-01 / WR-09-02 — every dismissal path converges on `clearSelection`,
 *     which COMMITS (the coalescing config run is flushed into the undo stack) and
 *     WRITES NOTHING. A dismissal must not PATCH a version.
 *  3. The 409 — a published row's conflict gets its own honest sentence instead of
 *     the generic "Couldn't save".
 *
 * ── Phase 186-07 (CONCUR-01 / CONCUR-02 · D-186-01 … D-186-12) — autosave ───────
 *
 * AUTOSAVE IS LIVE, AND IT IS ONE HOOK CALL. An edit schedules one guarded PATCH about a
 * second after the author stops; at most one write is outstanding; a write that cannot
 * safely happen is HELD with its reason said out loud; a row that moved elsewhere HALTS the
 * loop and hands the person both exits. None of that logic is here, and neither is any of
 * the copy — `BuilderSaveRegion` owns what the header says. No new band, and
 * `WorkflowCanvas.tsx` is not opened (G-5; its extraction is Phase 188's). The third 184
 * debt's sentence moved with the branch that picks it; the leave guard and the dismissal
 * contract stay, because neither is part of the write. And a cosmetic drag still reaches
 * the network ZERO times (D-186-02) — `canvasNudge.ts` imports neither the store, the
 * canvas model nor the API client, so CONCUR-01 is true BY CONSTRUCTION.
 *
 * ── Phase 184-13 (D-184-04 / R12) — the keys, and the one bottom region ─────────
 *
 * THIS PAGE NOW REGISTERS TWO GATED WINDOW KEY LISTENERS, not one. Escape (gated on
 * `panelOpen`, since 183) releases the panel in both views; `⌘Z` / `Ctrl+Z` /
 * `⇧⌘Z` / `Ctrl+Y` (gated on `canvasEnabled && activeGraphView === "canvas"`) step
 * through the undo history. Both follow the same shape and both YIELD to text fields.
 * The count is written out because it used to be one.
 *
 * THE BOTTOM REGION IS COMPOSED IN `WorkflowCanvas`, NOT HERE. R12 allows ONE
 * bottom-edge region with two rows at most — the toolbar and the problems-tray summary
 * — and the tray expands UPWARD from its own row. Publish stays in the header it
 * already had (141-B's operator correction), so this plan adds NO band anywhere: what
 * the page adds is the props those two rows render from.
 */
import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useStore } from "zustand"
import { generateWorkflow, listFolders, listSkills } from "@/lib/api"
import { PhaseSpineGraph } from "@/components/workflows/PhaseSpineGraph"
import {
  groundingCauseOf,
  nodeTitle,
  type NameContext,
  type PhaseSpecJSON,
} from "@/components/workflows/phaseVocabulary"
import {
  PhaseFormPanel,
  type PhaseConfigPatch,
  type IdNameMap,
  type PhaseFormRails,
  type PhaseGateRow,
} from "@/components/workflows/PhaseFormPanel"
import {
  createBuilderStore,
  selectDefinition,
  SAVED_STILL_A_DRAFT,
} from "@/components/workflows/builderStore"
import { BuilderStoreProvider } from "@/components/workflows/BuilderStoreProvider"
import { SelectedPhaseSlugProvider } from "@/components/workflows/SelectedPhaseSlugContext"
// 186-07 (G-5): the header's save region — four sentences and three controls — has its own
// file, so composing autosave into this page did not grow it.
import { BuilderSaveRegion } from "@/components/workflows/BuilderSaveRegion"
import { BuilderHeaderBar } from "@/components/workflows/BuilderHeaderBar"
import { SeedReceipt } from "@/components/workflows/SeedReceipt"
import { StarterTemplatePicker } from "@/components/workflows/StarterTemplatePicker"
import { useEffectiveFeaturesOptional } from "@/providers/EffectiveFeaturesProvider"
import { cn } from "@/lib/utils"
// ── Phase 184-11: the composition seams. Every one of these is a HOOK or a PURE
//    module; none of them is reachable from the canvas or the panel themselves. ──
import { useLiveValidation } from "@/hooks/useLiveValidation"
// Phase 186-07 (D-186-05): the write seam, composed in exactly the shape `useLiveValidation`
// arrives in — one call, the result held as a plain value and passed down as props.
import {
  useDraftPersistence,
  PUBLISHED_CONFLICT_MESSAGE,
  type PersistState,
} from "@/hooks/useDraftPersistence"
import { useGroundingBundle } from "@/hooks/useGroundingBundle"
import { DEGRADED_SENTENCE, groupVerdicts } from "@/components/workflows/verdictModel"
import { isCheckOutstanding } from "@/components/workflows/verdictModel" // 187-27 (GAP B)
import { clearNudges, readNudges, writeNudge } from "@/components/workflows/canvasNudge"
import {
  canRemovePhase,
  renumber,
  GOVERNANCE_GATE_ROW_LABEL,
  type PhaseGovernancePatch,
  type PhaseTypeId,
} from "@/components/workflows/definitionOps"
// Phase 193 fast-fix (AUTH-01, operator-approved 2026-08-13) — this page held a SECOND,
// ungoverned copy of the describe screen's CTA and hint fragments. `193-05` moved the door
// words into `doorVocabulary.ts` and `193-08` shipped variant D there, but this file was
// outside both plans' `files_modified` and outside the D-24(a) sweep, so after variant D the
// loose door read one CTA while this screen still read the pre-D one. Named ids, not literals.
// ⚠ FOUR literals were expected here and FIVE were found: `DESCRIBE_H1` was duplicated too,
// and is only in this list because the check was run rather than eyeballed.
import {
  DESCRIBE_CTA,
  DESCRIBE_H1,
  HINT_FRAG1,
  HINT_FRAG2,
  HINT_FRAG3,
} from "@/components/workflows/doorVocabulary"
import type { CanvasNode } from "@/components/workflows/canvasModel"
// TYPE-ONLY, and that is load-bearing: `WorkflowCanvas` is `React.lazy` so the chunk is
// never requested with the flag off, and a value import of anything from that module
// here would pull it into the main bundle and undo D-183-03's whole point.
import type { CanvasNotice, CanvasSession } from "@/components/workflows/WorkflowCanvas"
import type { WorkflowDefinitionJSON } from "@/lib/api"

/** The read-only canvas, code-split behind the toggle (see the docblock). The module
 *  also exports a `default`, so the `.then(...)` shim below is belt-and-braces — it
 *  mirrors the app's ONE shipped code-split (`KnowledgeHealthPage.tsx:32`) so both
 *  lazy boundaries read the same way. */
const WorkflowCanvas = lazy(() => import("@/components/workflows/WorkflowCanvas").then((m) => ({ default: m.WorkflowCanvas })))

/**
 * Phase 184.1-01 (D-184.1-04) — THE CANVAS GATE, DEFINED EXACTLY ONCE.
 *
 * The three-part fail-closed rule D-183-03 specified, lifted out of this component's body
 * and into the one function every consumer calls. Every part is still load-bearing: the
 * OPTIONAL accessor (a null context reads exactly like the empty map), `!loading` (so a
 * gated surface cannot flash in ~200 ms after load and shift the layout), and a STRICT
 * `true` comparison (an absent key hides — the `visibleNavItems` VANISH contract).
 *
 * WHY IT IS EXPORTED, AND WHY THAT IS NOT A SECOND GATE. The Builder header's three bands
 * are contributed at three NESTING LEVELS — `WorkflowsPage` wraps `WorkflowDoorSwitch`
 * wraps this page — and the only component that read the flag was the innermost of the
 * three. A parent cannot be handed a gate value by its child without either its own read
 * or a mount-effect callback, and the callback paints the band once before removing it,
 * which is precisely the flash-then-shift D-183-03 forbids. So the ancestors read too —
 * and they read THIS function, so there is one RULE with several call sites rather than
 * several hand-copied rules that drift the first time either side grows a condition.
 *
 * IT ADDS NO FETCH. `App.tsx` holds the single `useEffectiveFeatures()` call and broadcasts
 * the result through `EffectiveFeaturesProvider`; this is a context read, which is what
 * that provider exists for. The one-GET-per-session budget is untouched.
 *
 * The two literals below are also what `WorkflowBuilderPage.canvas.test.tsx`'s source guard
 * greps this file for, so the rule stays HERE rather than moving to a hooks module — the
 * alternative would have meant editing a shipped assertion to make a refactor look clean.
 */
export function useCanvasGate(): boolean {
  const featuresCtx = useEffectiveFeaturesOptional()
  return (
    featuresCtx !== null &&
    !featuresCtx.loading &&
    featuresCtx.features.visual_workflow_canvas === true
  )
}

/**
 * The locked save wording (184-CONTEXT `<specifics>`): the surface says the draft is
 * SAVED and, in the same breath, that it is still a draft. No word in it may imply
 * published — publishing is a separate act behind the gauntlet, and a save that reads
 * like a release is the single most expensive lie this header can tell.
 *
 * ⚠ 184-13 MOVED THE DECLARATION, not the name or the value. Two surfaces now say it —
 * this header and the canvas toolbar — and the toolbar lives on the code-split canvas
 * chunk, so it cannot reach back into this page module to read a string without dragging
 * the whole page in with it. The literal therefore lives in `builderStore.ts`, beside the
 * locked-save-wording note, and this line re-exports it so every existing caller (and
 * every existing grep) still finds it here.
 */
export { SAVED_STILL_A_DRAFT }

/**
 * The 409 sentence (D-184-16 debt 3), RE-EXPORTED — its declaration and its docblock moved
 * to `useDraftPersistence` in 186-07, because the branch that CHOOSES it moved there when
 * this page's explicit-save catch was deleted. A locked string belongs beside the code that
 * picks it, or the two drift. The name stays exported here so every existing caller and
 * every existing grep still resolves — the same thing the line above does for the wording.
 */
export { PUBLISHED_CONFLICT_MESSAGE }

/**
 * ⚠ TOMBSTONE — `GENERIC_SAVE_ERROR` ("Couldn't save") was RETIRED in 186-07 and the four
 * strings the save surface says now live in `BuilderSaveRegion.tsx`. `useDraftPersistence`
 * already ships a cause-neutral failure line, chosen by the same branch that chooses the
 * other two, so keeping this one would have left ONE situation with TWO spellings — the
 * failure 186-04 retired the store's parallel save enum for, one wave earlier in this same
 * phase. Recorded rather than deleted silently, because "why is there no generic save
 * constant here" otherwise gets re-answered by re-adding one.
 */

/**
 * The empty draft's publish reason (D-184-15). An INVITATION, not a claimed verdict:
 * the client is not validating anything here, it is saying what to do next on a
 * workflow that has no steps yet. D-182-06 stays intact precisely because no severity,
 * no code and no lint rule is being computed — a zero-length phases array is not a
 * finding, and the moment a step exists the server owns every verdict.
 */
export const EMPTY_DRAFT_INVITATION = "Add a step to get started"

/**
 * The publish reason while the write loop still has a PATCH outstanding (WR-10, 186-16).
 * A WAIT, NOT A FAULT: nothing is wrong and the author has nothing to fix, so the sentence
 * says what is happening and that it ends by itself — a greyed control with a fault-shaped
 * explanation reads as a refusal the person caused.
 *
 * WHAT THE MOMENT'S WAIT BUYS. `publish_service.py` reads `stage0_token` when the gauntlet
 * starts and spends it at the stage-5 flip minutes later, so an autosave PATCH committing
 * after that read makes the token dead on arrival: the flip answers `-2` → `draft_changed`
 * AFTER a real golden run has burned wall clock and provider spend on a publish that could
 * never have succeeded — and the author sees that refusal for an edit made BEFORE Publish.
 */
export const SAVING_PUBLISH_WAIT = "Saving your last change — Publish will be ready in a moment"

/**
 * What the header says about a workflow bound to NO knowledge base (D-186-16).
 *
 * IT STATES THE CONSEQUENCE, NOT THE STATE. "Unbound", and the describe screen's own
 * "No specific knowledge base", both sound harmless — and BUG-260731-03's live evidence
 * is that they are not. With `project_folder_id` null, "the knowledge base" is
 * *everything*: the reported run drew 11 files from 5+ folders into a compliance report,
 * and the operator reproduced the same mistake on themselves within ten minutes because
 * nothing on the canvas ever said so. The sentence has to name what actually happens.
 *
 * AN INVITATION, NOT A CLAIMED VERDICT — the rule `EMPTY_DRAFT_INVITATION` above states,
 * for the same reason. The client is not validating anything here: no severity, no code
 * and no lint rule is being computed, a null `project_folder_id` is not a finding, and
 * D-182-06 stays intact because the server owns every verdict. The deterministic
 * build-time `/validate` verdict for an unbound retrieval workflow is Phase 187's
 * (D-186-14) and is deliberately NOT built here.
 *
 * WHERE IT IS ALLOWED TO TRAVEL: the header chip, and nowhere else. `UNBOUND_KB_INVITATION`
 * must never join `blockedReason` (that would make an unbound workflow unpublishable —
 * 187's call, not this phase's), never become a `Verdict`, never enter `verdicts` or
 * `groupVerdicts`, never add a problems-tray row and never mark a node. A comment-stripped
 * source fence in `WorkflowBuilderPage.header.test.tsx` asserts exactly that, in both
 * directions.
 */
export const UNBOUND_KB_INVITATION = "No knowledge base · searches everything"

/**
 * What the header's requirement control says when the workflow has not declared its
 * purpose yet (quick 260809-klo · BUG-260809-02).
 *
 * IT ASKS FOR THE THING, AND NAMES THE CONSEQUENCE. The blocking sentence the author
 * eventually meets — "a workflow must declare exactly one business_requirement before
 * publish" — names an internal FIELD, which is precisely why the reporting operator had
 * no recovery path from inside the product. This placeholder is the other end of that
 * sentence: it asks in plain words for what the field holds, and says when it is needed.
 * (The blocking copy itself is authored in two BACKEND sites and relayed verbatim by
 * `blockedReason` below; rewriting it here would install exactly the client-side message
 * mapping D-182-06 forbids. Carried as `D-klo-DEF-01` with its own re-open trigger.)
 *
 * AN INVITATION, NOT A CLAIMED VERDICT — the same fence `UNBOUND_KB_INVITATION` above
 * carries, for the same reason. No severity and no code is computed here: an empty
 * `business_requirement` is not a client-side finding, and the emptiness rule stays the
 * server's (`grounding.py:894`). D-182-06 stays intact.
 *
 * WHERE IT IS ALLOWED TO TRAVEL: this one placeholder, and nowhere else. It must never
 * join `blockedReason`, never become a `Verdict`, never enter `verdicts` or
 * `groupVerdicts`, never add a problems-tray row and never mark a node. The server
 * already owns this verdict (`backend/app/api/workflows.py:712-721`), it already routes
 * to the tray as a workflow-wide `incomplete`, and its message is what `blockedReason`
 * relays word for word. A second warning authored here would be a second truth-teller.
 */
export const REQUIREMENT_INVITATION = "What must this workflow deliver? · required to publish"

/**
 * What the picker calls a binding it cannot NAME — a folder that is not in the author's
 * own list, because it was deleted or because the draft was forked from a workflow that
 * bound someone else's.
 *
 * It exists so an unnameable binding cannot render as a blank control, which would read
 * as *unbound* — the exact invisibility this whole plan is fixing. Still a neutral fact
 * about configuration, with no severity and no code: the workflow IS bound, we simply
 * cannot say to what. Not the raw id, because 103-ux's rule for this chip is that it
 * shows a NAME and never a UUID. Module-local: nothing outside this file says it.
 */
const UNNAMED_KB_OPTION = "A knowledge base outside your folders"

/**
 * The unsaved-work prompt (D-184-16 debt 1). Named in 184-11 because a session could then
 * be five structural edits deep with no autosave at all.
 *
 * ⚠ 186-07 KEPT THE GUARD AND CHANGED WHAT IT MEANS (D-186-03). Same words, same code, still
 * keyed on `dirty` — but autosave clears `dirty` continuously now, so what it asks moved
 * from *"you forgot to save"* (the 184 common case, the kind of prompt people learn to click
 * through) to *"a write genuinely failed or is being held"*. A guard that fires only on a
 * real refusal is worth more than one that fires on every exit; that is why it stayed.
 */
export const UNSAVED_LEAVE_PROMPT =
  "This draft has unsaved changes. Leave without saving?"

/**
 * R1 / D-184-12 — HOW MANY STEPS ACTUALLY MOVED, said in words.
 *
 * The number is COUNTED, never assumed. "Everything downstream" is the intuitive answer
 * and it is wrong at both ends: deleting the last step moves nothing at all, and a
 * definition whose `phase_index` values arrived non-contiguous (the shipped `indexGap`
 * shape) can have a step move without being downstream of the edit. So the caller
 * compares the before and after render orders index by index and hands the count here.
 *
 * The zero case gets its own sentence rather than "0 steps renumbered": the message
 * exists to tell an author what the edit did to the rest of their flow, and "0 steps
 * renumbered" makes a person stop and parse a number to learn that nothing happened.
 */
function renumberedPhrase(moved: number): string {
  if (moved === 0) return "nothing else moved"
  return `${moved} step${moved === 1 ? "" : "s"} renumbered`
}

/** How many phases present in BOTH orders changed `phase_index`. Slugs that exist on
 *  only one side are the edit itself, not something the edit moved. */
function countMoved(
  before: readonly PhaseSpecJSON[],
  after: readonly PhaseSpecJSON[],
): number {
  const afterIndex = new Map(after.map((p) => [p.slug, p.phase_index]))
  let moved = 0
  for (const phase of before) {
    const now = afterIndex.get(phase.slug)
    if (now !== undefined && now !== phase.phase_index) moved += 1
  }
  return moved
}

/**
 * The gates rail. **Phase 185 replaces the 184 derivation** (`citation_policy` plus a
 * declared `citations_required` validator) with the graded-governance reading: the row
 * appears when the step's grounding CAUSE is `detected` or `escalated`, and it carries
 * `GOVERNANCE_GATE_ROW_LABEL` — the one home of that sentence.
 *
 * ── D-185-19 — WHY THIS IS SYNTHESIZED HERE AND NOT READ OFF THE SERVER ──
 *
 * `POST /workflows/validate` returns `ValidateResponse(ok, verdicts)` where a verdict is
 * `{code, phase, message, severity}` — a list of PROBLEMS. It has no channel for "here is
 * a gate that will run", a passing gate produces nothing at all, and whether a future run
 * will retrieve anything is unknowable at author time. So nothing here waits on that
 * route. The client already holds `available_tools` and the server's `kb_tools`, so it
 * PREDICTS here while the server ENFORCES at run time — the same client-predicts /
 * server-enforces split D-185-09 established, and the reason a wrong reading is a display
 * bug rather than a safety hole. `WorkflowBuilderPage.canvas.test.tsx` pins the negative
 * with a positive control.
 *
 * ── D-185-11 — the publish half, which IS true and DOES bite ──
 *
 * The gauntlet gains no new stage for this. But its golden run drives `run_workflow` and
 * therefore the run-time enforcement seam, so a detected step whose golden run retrieves
 * nothing now blocks publish. The row is an author-time warning about a real consequence,
 * not decoration.
 *
 * Every row is LOCKED, and that is the honest reading rather than a shortcut: the cause is
 * structural from this panel's point of view. `detected` follows from the tool list a few
 * rows above — switch the document tools off and the gate goes, which is exactly what the
 * rail's own footnote promises — and `escalated` is undone on the governance dial below,
 * not by a Remove button here. Offering a Remove button that could not remove anything
 * would be the "a removable gate with no way to remove it" lie the row union exists to
 * make un-representable.
 */
function gatesFor(phase: PhaseSpecJSON | null, kbTools: readonly string[]): PhaseGateRow[] {
  if (phase === null) return []
  const cause = groundingCauseOf(phase, kbTools)
  // `already-set` deliberately produces NO row. Its gate is owned by the Sourcing-
  // strictness control a few rows above, and 185-07's section says so in words; a second
  // claim here would be two surfaces one scroll apart describing one stored field.
  return cause === "detected" || cause === "escalated"
    ? [{ label: GOVERNANCE_GATE_ROW_LABEL, locked: true }]
    : []
}

/** The Builder's working definition shape (a refinement of the opaque
 *  `WorkflowDefinitionJSON` the api layer returns). */
export interface BuilderDefinition {
  slug?: string
  version?: number
  status?: string
  business_requirement?: string
  project_folder_id?: string | null
  phases: PhaseSpecJSON[]
  [k: string]: unknown
}

/** The OPEN/TWEAK seam payload — an existing definition + its row id (every save
 *  PATCHes that row). Exported so WorkflowsPage builds + casts it at one place. */
export interface BuilderInitial {
  definition: BuilderDefinition
  draftId: string
  /**
   * Phase 186-07 (D-186-07) — the OPAQUE concurrency token for the row `draftId` names.
   *
   * IT IS BYTES. Echoed verbatim on the next write and never inspected, normalised or
   * turned into a JS date value: Postgres keeps microseconds a millisecond-precision date
   * value truncates, and a truncated token matches zero rows, so every save would then
   * refuse as stale. `useDraftPersistence` carries the same fence in code, enforced by a
   * source grep in its suite.
   *
   * ABSENT / `null` ⇒ the first write goes UNGUARDED (the 186-01 optional-`If-Match`
   * posture), which is the honest reading for a route where no row exists yet. Optional
   * for the same reason: every existing construction of this interface stays valid.
   *
   * FOUR ROUTES REACH THE BUILDER — fresh, fork a starter, Tweak, open a draft — and each
   * must carry or knowingly lack one. A route that quietly dropped it would autosave with
   * no guard and no symptom, until it clobbered something.
   */
  token?: string | null
}

export interface WorkflowBuilderPageProps {
  /** Optional Plan-05 publish-gauntlet seam — the page composes it when present
   *  (the gauntlet owns the publish-disabled-on-empty-golden_input rule). Left as
   *  a typed prop so Plan 05 can land independently without an import-before-exists
   *  break.
   *
   *  Phase 124-03 Task 2 (WUX-01, D-06): `def` is the WORKING definition forwarded
   *  to the gauntlet so its prepended pub-scale soul block reads the same authored
   *  purpose / tier / spine / needs / output. `BuilderDefinition` already carries
   *  the soul-readable fields (business_requirement / project_folder_id / phases),
   *  so this seam is additive — the describe/draft/publish flow is unchanged; the
   *  call site (WorkflowsPage) just passes the supplied `def` through as `definition`.
   *
   *  Phase 184-11 (R12): a THIRD argument carries the publish-blocking reason, or `null`
   *  when publish is not blocked. Optional and additive — a two-parameter implementation
   *  is still assignable and still behaves exactly as it did, which is what keeps the
   *  flag-off surface unchanged (this page passes `null` whenever the canvas flag is off).
   *  It rides the EXISTING seam on purpose: 141-B's operator correction is that publish
   *  stays in the header it already has, so the mount does not move and no band is added.
   *
   *  Phase 186-07 (D-186-12): a FOURTH argument that points the other way — how the publish
   *  surface tells this page a gauntlet is running, so the write loop HOLDS rather than
   *  landing an edit mid-golden-run (minutes and real provider spend). A BOOLEAN reporter
   *  and nothing more: the publish contract is not widened into a state channel, a
   *  three-parameter implementation is still assignable, and it rides this EXISTING seam
   *  rather than a new context for the same reason the third argument did. */
  renderPublish?: (
    def: BuilderDefinition,
    draftId: string | null,
    blockedReason?: string | null,
    onPublishRunning?: (running: boolean) => void,
  ) => React.ReactNode
  /** Phase 103-ux OPEN/TWEAK: when present, the Builder starts DIRECTLY in the
   *  "drafted" editing view on this existing definition — it SKIPS the
   *  describe/composing screen entirely. `draftId` seeds the rendered id AND the write
   *  loop's synchronous mirror, so every edit PATCHes the SAME row (never a duplicate
   *  create); 186-07 adds `token`, which guards that first PATCH:
   *   - Open a draft → the draft's own id (edit-in-place).
   *   - Tweak a published workflow → the freshly-forked v(N+1) draft id (the
   *     frozen published row is never touched).
   *  Absent → the existing describe-first FRESH build, byte-identical. */
  initial?: BuilderInitial
  /** Phase 124 CR-01 fix: seed the describe textarea from an upstream "Describe &
   *  run" door so the loose-path text survives the hand-off into the Builder (it was
   *  otherwise silently dropped). Only meaningful for a FRESH build (no `initial`) —
   *  the drafted editing view ignores it. */
  initialDescribe?: string
  /** Phase 124 CR-01 fix: when true (the loose door's `DESCRIBE_CTA` button), run
   *  the EXISTING generate→draft flow ONCE on mount using the seeded `initialDescribe`,
   *  so the fast path actually drafts instead of dead-ending on an empty screen. */
  autoDraft?: boolean
  /** Phase 187-26 (GAP A): the loose door's KB choice, made BEFORE the AI drafts.
   *  ABSENT ⇒ the describe screen is byte-identical to today (D-181-01). */
  initialProjectFolderId?: string
  /**
   * Phase 184-11 (D-184-16 debt 1) — the unsaved-work leave guard's registration seam.
   *
   * THERE IS NO ROUTER. Navigation in this app is a `useState<ActiveView>` switch, so
   * there is no route-change hook and no router blocker to hang a guard off. The
   * `← Workflows` breadcrumb lives in `WorkflowsPage`, and the dirty state lives in this
   * page's store — so the Builder hands the host a predicate and the host consults it
   * before it switches view. `true` means "leaving is fine"; `false` means the user said
   * no and the host must stay put.
   *
   * OPTIONAL, and an ABSENT registration must leave the host behaving exactly as it does
   * today. Every other mount of this page (the tests, the door shell's fresh-build path
   * before a Builder exists) supplies nothing and is unaffected.
   */
  registerCanLeave?: (canLeave: (() => boolean) | null) => void
  /**
   * Phase 184.1-01 (D-184.1-01) — the two MERGED-HEADER SLOTS.
   *
   * `headerLead` carries `WorkflowsPage`'s breadcrumb group (`← Workflows`, the workflow's
   * label, `NET-NEW`); `headerTrail` carries `WorkflowDoorSwitch`'s door group (`‹ both
   * doors`, `🔧 Author & govern`, `JUDGE ALWAYS-ON`). Both are OPAQUE nodes — this page
   * renders them and reads nothing out of them, so no handler and no state changes hands.
   *
   * BOTH ARE OPTIONAL, AND BOTH ARE IGNORED WITH THE FLAG OFF. An absent pair is exactly
   * the mount every existing test and the flag-off app perform, and the flag-off branch
   * below does not reference them at all — so the shipped three-band surface is preserved
   * by construction rather than by remembering to pass nothing.
   */
  headerLead?: React.ReactNode
  headerTrail?: React.ReactNode
}

export function WorkflowBuilderPage({
  renderPublish,
  initial,
  initialDescribe,
  autoDraft,
  initialProjectFolderId,
  registerCanLeave,
  headerLead,
  headerTrail,
}: WorkflowBuilderPageProps) {
  const [describe, setDescribe] = useState(initialDescribe ?? "")
  // Phase 184-04 (D-184-01): the definition's home. Created LAZILY so the factory
  // runs exactly once per mount, and never at module scope — a singleton would carry
  // one workflow's undo history into the next workflow opened in the same tab.
  // OPEN/TWEAK: when `initial` is provided the store boots straight into the drafted
  // editing view on the loaded definition (the describe/composing screen is skipped);
  // a fresh build (no `initial`) starts "empty" exactly as before.
  const [store] = useState(() => createBuilderStore(initial ? initial.definition : null))
  // Read through SELECTORS, never `getState()` in a rendered value — the shipped
  // `usePanelReconcile.ts:58-60` discipline. Side-effect reads inside callbacks may
  // use `getState()`, because those are not rendered values.
  const builderPhase = useStore(store, (s) => s.builderPhase)
  const phases = useStore(store, (s) => s.phases)
  const meta = useStore(store, (s) => s.meta)
  const errorMessage = useStore(store, (s) => s.errorMessage)
  const errorDetail = useStore(store, (s) => s.errorDetail)
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null)
  // Phase 183-07 (D-183-02): which graph the column shows. SESSION state only — it
  // cold-starts on "spine" on every mount and is persisted nowhere.
  const [graphView, setGraphView] = useState<"spine" | "canvas">("spine")
  // Phase 103-ux: the project (knowledge base) the generated workflow binds to.
  // Chosen at the describe step (ONE calm dropdown), passed to generate, and shown
  // by name in the draft header afterwards. When opening an existing definition,
  // seed it from that definition's own binding so the header shows the bound KB.
  // Phase 187-26 (GAP A): the loose door may now have bound one before generate ran.
  const [projectFolderId, setProjectFolderId] = useState<string>(
    typeof initial?.definition.project_folder_id === "string" ? initial.definition.project_folder_id : (initialProjectFolderId ?? ""),
  )
  // Phase 103-ux: id→name maps so the form panel renders folder + skill NAMES (never
  // UUIDs). Fetched once on mount; failures degrade to showing the raw id.
  const [folderNames, setFolderNames] = useState<IdNameMap>({})
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; name: string }>>([])
  const [skillNames, setSkillNames] = useState<IdNameMap>({})
  // The persisted draft id as a RENDERED value (null until the first save on a fresh build;
  // pre-seeded for Open/Tweak). The write loop keeps its own synchronous mirror — that is
  // what collapses the first save to exactly one create — and reports the id it minted here
  // through `onDraftCreated`, so the nudge key, "Tidy up" and the publish trigger all read
  // one value React actually re-renders on.
  const [draftId, setDraftId] = useState<string | null>(initial?.draftId ?? null)
  // D-186-12 — is a publish gauntlet running? Reported by the publish surface through the
  // `renderPublish` seam; the ONLY reader is the write loop's hold gate.
  const [publishInFlight, setPublishInFlight] = useState(false)
  // 187-15 (Req 5 / D-187-09) — the seed receipt, once per generated draft. Dismissal is IN-MEMORY
  // and a reload re-shows it, correctly: the grounding is still true and nothing was persisted. No
  // draft id exists yet (`setDraftId(null)`), and a storage key would fail this file's own guard.
  const [showReceipt, setShowReceipt] = useState(false)
  // 187-22 (CR-04) — the phases AS THE GENERATION EMITTED THEM. The card is a statement about
  // ONE generation and its copy is past-tense, so it must never read the live selector: see
  // `SeedReceipt`'s `phases` contract for why that made the card claim the author's own edits.
  const [receiptPhases, setReceiptPhases] = useState<readonly PhaseSpecJSON[]>([])
  // 187-15 (Req 1 / D-187-05) — the ONE name context: values this page already holds, memoised
  // so the memoised `toCanvas` does not re-project every render. `assets` is DEFINITION-level
  // (a workflow's, never a phase's), which is why 187-04 gates the template tier on
  // `llm_emit`; read defensively — it may be absent, null or not an array. PITFALL 1,
  // ACCEPTED: the maps land asynchronously, so derived faces SETTLE when the mount fetch
  // resolves, exactly as `PhaseFormPanel` already behaves. Rejected: holding the tier until
  // the maps are non-empty (a late canvas for a cosmetic reason). Never: a placeholder.
  const nameContext = useMemo<NameContext>(() => {
    const assets = Array.isArray(meta.assets) ? (meta.assets as Array<Record<string, unknown>>) : []
    const filename = assets.find((a) => a?.kind === "template")?.filename
    return { folderNames, skillNames, templateFilename: typeof filename === "string" ? filename : undefined }
  }, [folderNames, skillNames, meta])

  const canDraft = describe.trim().length > 0 && builderPhase !== "composing"
  const panelOpen = selectedSlug !== null

  // Phase 183-07 (D-183-03) — the three-part fail-closed gate, now read through the ONE
  // exported rule (see `useCanvasGate`'s docblock: 184.1 gave the two ancestor band
  // owners the same call, so the rule had to stop being an inline expression).
  const canvasEnabled = useCanvasGate()
  // The flag out-ranks stale session state: if the map is tightened mid-session while
  // the user is on Canvas, the column falls back to the Spine rather than stranding
  // them on a surface that just vanished.
  const activeGraphView = canvasEnabled ? graphView : "spine"

  // D-183-05 — ONE selection contract, shared by BOTH views, owned by the page. Click
  // a node to anchor the 400px form panel; click the same node again to close it.
  const handleSelectNode = useCallback((slug: string) => {
    setSelectedSlug((cur) => (cur === slug ? null : slug))
  }, [])

  // The view-agnostic DISMISSAL half of that same contract: `handleSelectNode`
  // anchors the panel, `clearSelection` releases it. Both live on the page because
  // both views share ONE panel — a canvas-only close would leave the shipped Spine
  // surface, where this defect was actually reported, still unable to be left.
  //
  // ── WR-09-01 / WR-09-02 (D-184-16 debt 2) — ALL THREE dismissal paths end HERE ──
  //
  // The ✕ (`PhaseFormPanel`'s header button), Escape (the gated window listener below)
  // and a click on the empty canvas pane (`WorkflowCanvas`'s `onPaneClick`) all call
  // this one callback, so the three cannot drift apart. What a dismissal does is now
  // stated in one place, and it is exactly two things:
  //
  //  1. COMMIT. `flushHistory()` ends the coalescing config run immediately, so the
  //     sentence the author just typed is ONE undo entry that exists at dismissal time
  //     rather than one that lands up to `CONFIG_COALESCE_MS` later. The VALUE itself is
  //     already in the definition — every panel field is CONTROLLED and its `onChange`
  //     reaches `store.patchConfig` on the keystroke, never on the blur — so what a
  //     dismissal used to drop was the history entry, not the text.
  //  2. RELEASE the selection. That is all.
  //
  // WHAT IT DELIBERATELY DOES NOT DO IS WRITE. The 183 review's recommended fix was to
  // BLUR the focused field before unmount so the three paths converged on the ✕'s
  // incidental PATCH. Phase 184 converges them the other way, because this phase has an
  // explicit-save contract (R6) and, from this plan on, a dirty-state leave guard plus a
  // dirty indicator that close the loss window that made a silent PATCH look attractive.
  // A dismissal that mints a version is exactly the surprise a no-autosave phase exists
  // to prevent — so the panel's ✕ also suppresses the focus transfer that used to cause
  // one (see its `onMouseDown`), and the assertion "a dismissal must not PATCH a version"
  // is now true on all three paths in a real browser, not only under a test driver that
  // never moves focus.
  const clearSelection = useCallback(() => {
    store.getState().flushHistory()
    setSelectedSlug(null)
  }, [store])

  // Escape releases the panel, in BOTH views. GATED on `panelOpen`: no listener
  // exists while the panel is closed, so this costs nothing at rest and cannot
  // accumulate across renders. One accepted interaction, recorded rather than
  // engineered around: if a modal sits above the Builder, Escape dismisses the modal
  // AND releases the selection. That is harmless — deselection is non-destructive and
  // persistence happens on field blur, not on selection — and it is preferable to a
  // fragile is-a-modal-open probe.
  useEffect(() => {
    if (!panelOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") clearSelection()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [panelOpen, clearSelection])

  /**
   * D-184-04 — `⌘Z` / `Ctrl+Z` undo, `⇧⌘Z` / `Ctrl+Y` redo. ONE listener, and it YIELDS.
   *
   * GATED EXACTLY LIKE THE ESCAPE LISTENER ABOVE, and for the same three reasons: it
   * exists only while the flagged canvas view is the one on screen, so no listener is
   * registered on the Spine or with the flag off (a flag-off surface must not grow a
   * global key binding — D-14 / D-181-01), it costs nothing at rest, and the effect
   * removes exactly the handler it added so it cannot accumulate across renders.
   *
   * IT YIELDS TO TEXT FIELDS, and that is the difference between undo being usable and
   * being a trap. A person fixing a typo in a step's description presses `⌘Z` expecting
   * the browser's own field-level undo; if this listener swallowed it, one keystroke
   * would silently revert a STRUCTURAL edit they had not thought about in ten minutes.
   * So the handler bails the moment the event's target is an `input`, a `textarea` or a
   * `contenteditable` — the same yield `WorkflowCanvas`'s `⌥←` / `⌥→` handler makes, for
   * the same reason.
   *
   * ONE PRESS IS ONE STEP. `keydown` auto-repeats while a key is held (~31/sec after the
   * initial delay), and a held `⌘Z` would walk the whole history stack in under two
   * seconds. The guard is `WorkflowCanvas.tsx`'s.
   *
   * THE TOOLBAR IS THE DISCOVERABLE PATH; these are the accelerator. Both end in the same
   * temporal actions, reached here through `getState()` — a SIDE-EFFECT call inside a
   * handler, which is exactly where `getState()` is correct (the rendered enabled state is
   * a selector read, in `CanvasToolbar`).
   *
   * AND IT NEVER WRITES (D-184-03). Only store actions are called. Stepping back past a
   * save point re-marks the draft dirty through the store's own subscription, which is
   * honest: the in-memory definition now differs from what was PATCHed.
   */
  useEffect(() => {
    if (!canvasEnabled || activeGraphView !== "canvas") return

    const onKeyDown = (event: KeyboardEvent) => {
      if (!event.metaKey && !event.ctrlKey) return
      if (event.repeat) return

      const key = event.key.toLowerCase()
      const isUndo = key === "z" && !event.shiftKey
      const isRedo = (key === "z" && event.shiftKey) || key === "y"
      if (!isUndo && !isRedo) return

      // The yield. Native field-level undo keeps working inside every text control.
      const target = event.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || target?.isContentEditable === true) return

      event.preventDefault()
      const temporal = store.temporal.getState()
      if (isUndo) temporal.undo()
      else temporal.redo()
      // Stepping the history retires the canvas notice — see `canvasNotice`'s docblock.
      // This path and the toolbar's (`onHistoryStep`) join the notice's own inline Undo,
      // which was the only one that used to do it; the other two left a sentence on
      // screen describing an edit the author had just taken back.
      setCanvasNotice(null)
    }

    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [canvasEnabled, activeGraphView, store])

  // The current working definition (drafted state only). `selectDefinition` is the ONE
  // place the store's two halves recombine into a definition — fed here from the two
  // SELECTOR values, never from `getState()`, because this one IS a rendered value.
  const definition = useMemo<BuilderDefinition | null>(
    () => (builderPhase === "drafted" ? selectDefinition({ meta, phases }) : null),
    [builderPhase, meta, phases],
  )

  const selectedPhase = useMemo<PhaseSpecJSON | null>(() => {
    if (builderPhase !== "drafted" || selectedSlug === null) return null
    return phases.find((p) => p.slug === selectedSlug) ?? null
  }, [builderPhase, phases, selectedSlug])

  // ── Phase 184-11: the live loop, the rails, the marks and the nudge ─────────────

  /**
   * D-184-15 — has the AUTHOR edited in this session? False until the first real edit,
   * and false FOREVER on a draft nobody touches, which is what keeps `/validate` silent
   * on mount.
   *
   * It is driven by the STORE rather than by the page's own callbacks on purpose: a
   * structural edit can originate at the canvas, at the panel, or (in 184-12) at a `＋`
   * that dispatches straight to a store action, and a flag wired per call site would
   * miss whichever one is added last. The subscription reads the ONE thing every edit
   * has in common — a new `phases` reference — and excludes DOCUMENT transitions, which
   * always replace `meta` (a fresh object) and usually `builderPhase` too. Generating or
   * opening a workflow is not something the author edited, so it must not start the loop.
   * 187-27 NARROWS that last sentence, deliberately and in the open: D-184-15's reason is about a draft with NO steps ("never greeted with a not-ok envelope"), and applied to one that already HAS steps it produced a fail-open — a canvas claiming "the static checks pass · checked by the server" over a check nobody made, with Publish enabled. So the loop's `enabled` is now `hasEdited || (canvasEnabled && phases.length > 0)`: `phases.length > 0` keeps D-184-15's stated reason exactly (the empty canvas still shows its INVITATION), and `canvasEnabled &&` keeps D-181-01 (a flag-off Builder issues precisely the requests it issues today, pinned at zero). `hasEdited` itself is unchanged and still owns the post-edit loop.
   *
   * Deliberately NOT reused: the store's `dirty`, which `markSaved()` clears — a save
   * would then switch validation back off.
   */
  const [hasEdited, setHasEdited] = useState(false)
  useEffect(
    () =>
      store.subscribe((state, prev) => {
        if (state.phases === prev.phases) return
        if (state.builderPhase !== prev.builderPhase || state.meta !== prev.meta) return
        setHasEdited(true)
      }),
    [store],
  )

  /**
   * The loop itself. `definition` is a `useMemo` over the store's two halves, so its
   * identity changes once per EDIT and not once per render — which is the caller
   * contract `useLiveValidation`'s docblock states, and the difference between a
   * debounced request per edit and one per keystroke of React re-render.
   */
  // 187-27 (GAP B): also on OPEN, for a flag-on draft that already has steps — see the `hasEdited` docblock.
  const validation = useLiveValidation(definition as WorkflowDefinitionJSON | null, hasEdited || (canvasEnabled && phases.length > 0))

  /**
   * Mirror the loop's answer into the store's UNTRACKED half, so the marks (canvas) and
   * the tray (184-13) read ONE source instead of two subscriptions that can disagree.
   * `partialize` keeps all three keys out of the undo stack, so an arriving response can
   * never push a history entry and `⌘Z` can never undo a server verdict (VALID-03).
   */
  useEffect(() => {
    const actions = store.getState()
    switch (validation.kind) {
      case "idle":
        actions.setChecking(false)
        break
      case "checking":
        actions.setChecking(true)
        break
      case "verdicts":
        actions.setVerdicts(validation.verdicts)
        actions.setChecking(validation.checking)
        actions.setDegraded(null)
        break
      case "degraded":
        // Held stale, dimmed — never cleared, or every mark flickers on every keystroke.
        actions.setVerdicts(validation.verdicts)
        actions.setChecking(validation.checking)
        actions.setDegraded({ kind: validation.cause === "unreadable" ? "422" : "network" })
        break
    }
  }, [validation, store])

  /**
   * ── Phase 186-07 (D-186-05) — the WRITE loop, composed exactly like the READ loop ──
   *
   * `enabled` is DRAFTED + CANVAS-ENABLED and deliberately NOT `hasEdited`: the loop's own
   * `dirty` gate is what keeps a freshly-opened draft from writing, and gating on
   * `hasEdited` as the read loop does would leave a draft opened and edited once before
   * that flag flips silently un-autosaved. The canvas flag is in it because autosave is new
   * behaviour and D-181-01 promises a flag-off surface identical to the shipped one — the
   * explicit Save button still works there, because `saveNow` is not gated on `enabled`.
   * `validationCause` is derived HERE as a primitive, per the hook's caller contract: the
   * read loop emits a new object every beat, and the hold gate must not churn on beats that
   * did not change the answer.
   */
  const validationCause = validation.kind === "degraded" ? validation.cause : null
  const persistence = useDraftPersistence({
    definition,
    enabled: canvasEnabled && builderPhase === "drafted",
    initialDraftId: initial?.draftId ?? null,
    initialToken: initial?.token ?? null,
    store,
    publishInFlight,
    validationCause,
    onDraftCreated: setDraftId,
  })
  const persistState: PersistState = persistence.state

  const verdicts = useStore(store, (s) => s.verdicts)
  const verdictGroups = useMemo(() => groupVerdicts(verdicts), [verdicts])
  /** The per-node mark, handed to the canvas as DATA. The canvas fetches nothing and
   *  derives no severity — `verdictModel` groups and counts, and classifies nothing. */
  const marks = useMemo(() => (slug: string) => verdictGroups.markFor(slug), [verdictGroups])

  /**
   * The CANVAS-04 palette. Fetched once, when the canvas is enabled, and read ONLY here —
   * the panel is handed the answer.
   *
   * Anything that is not a complete `ready` read resolves to the literal `"degraded"`,
   * which is the fail-closed side of the only choice available. An empty array would say
   * "this workspace offers no tools" (a claim we cannot make while the read is in flight
   * or has failed), and omitting the rail entirely would put the shipped free-text box
   * back on screen — and a box a user can type any string into is not a whitelist, which
   * is precisely what R11 forbids.
   */
  const bundle = useGroundingBundle(canvasEnabled)
  const toolOptions: string[] | "degraded" = bundle.kind === "ready" ? bundle.tools : "degraded"

  /**
   * The server's KB-reading tool names (Phase 185 / D-185-09), read on BOTH honest
   * readings of the palette — deliberately NOT gated the way `toolOptions` is.
   *
   * `toolOptions` answers "which tools may this person pick", so anything short of a
   * complete `ready` read must fail closed to `"degraded"`. `kbTools` answers a
   * different question — "which tool names mean this step reads your documents" — and
   * the server serves that list OUTSIDE every try/except precisely because it does not
   * depend on who is asking (185-02 / 185-06: the `unavailable` member carries the full
   * list). A folders-or-skills outage must never silently un-mark a locked step. Absent
   * (`idle` / `loading`) it is EMPTY, which marks nothing — the safe direction, because
   * the run-time gate is server-side and unconditional either way.
   *
   * ONE value, TWO readers: the same array goes to `gatesFor`, to the panel's governance
   * section via `rails.kbTools`, and to `toCanvas` via the canvas's `kbTools` prop — so
   * the seal, the dial and the locked row can never disagree about one step.
   */
  const kbTools = useMemo<readonly string[]>(
    () => (bundle.kind === "ready" || bundle.kind === "unavailable" ? bundle.kbTools : []),
    [bundle],
  )

  /** The four governance rails for the SELECTED step. Every value is derived or
   *  server-sourced HERE; the panel computes none of it. */
  const rails = useMemo<PhaseFormRails>(() => {
    const order = renumber(phases).map((p) => p.slug)
    const at = selectedSlug === null ? -1 : order.indexOf(selectedSlug)
    return {
      order: { index: at + 1, total: order.length },
      toolOptions,
      gates: gatesFor(selectedPhase, kbTools),
      kbTools,
    }
  }, [phases, selectedSlug, selectedPhase, toolOptions, kbTools])

  /**
   * The cosmetic vertical nudge. `canvasNudge.ts` owns every read and every write —
   * this page names no browser-storage API at all, which its own shipped source guard
   * enforces. Re-read through a version counter rather than an effect, so a write and
   * the render that shows it stay in one pass and no `setState`-in-effect cascade is
   * introduced.
   */
  const [nudgeVersion, setNudgeVersion] = useState(0)
  // `nudgeVersion` is an INVALIDATION KEY, not a value this read consumes: the write goes
  // to `canvasNudge.ts` (the one storage home) and the counter is how the page asks for a
  // re-read. The rule cannot see that a bumped counter means the storage behind
  // `readNudges` changed; keeping the map in page state instead would put a SECOND copy of
  // it here, which is the thing the module boundary exists to prevent.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const nudges = useMemo(() => readNudges(draftId), [draftId, nudgeVersion])
  const onNudge = useCallback(
    (slug: string, dy: number) => {
      // `dy` is the RESULTING offset, not this drag's delta — the canvas composes it, so
      // this handler stays a plain write (`WorkflowCanvasProps.onNudge`).
      writeNudge(draftId, slug, dy)
      setNudgeVersion((v) => v + 1)
    },
    [draftId],
  )

  /** A canvas-originated reorder. Both gesture paths (drag along the lane, `⌥←`/`⌥→`)
   *  arrive here and end in the ONE store op — no second reorder rule exists. */
  const onCommitNodes = useCallback(
    (nodes: readonly CanvasNode[]) => {
      store.getState().commitCanvasNodes(nodes)
    },
    [store],
  )

  // ── Phase 184-12: growing the flow, and the two refusals ───────────────────────

  /**
   * What the canvas says about the last structural act. Replaced by the next act, and
   * cleared by an Undo — a message about an edit that has been taken back is a message
   * that has started lying.
   *
   * THE RULE APPLIES TO EVERY WAY THE HISTORY CAN MOVE, and for a while it did not. The
   * Phase 184 UAT found that only the notice's OWN inline Undo cleared it: `⌘Z`/`Ctrl+Z`
   * and the toolbar's Undo/Redo both stepped the store and left the message up, with no
   * timeout, still reporting "Removed X" about a step that was visibly back. So all three
   * paths now retire it:
   *   1. the inline Undo, in `onRequestRemove`'s `onUndo`;
   *   2. the D-184-04 key bindings, in the keydown effect above;
   *   3. the toolbar, via its optional `onHistoryStep` report (its own `getState()` call
   *      stays where it is — that is `CanvasToolbar`'s zundo-#207 discipline).
   * A REDO retires it too: a notice reports an ACT the author just performed, not a caption
   * for the current state, so a message that happens to match again is luck, not
   * correctness. What must NOT happen is an indiscriminate clear — a new act still speaks,
   * because each act sets its own notice after mutating the store.
   */
  const [canvasNotice, setCanvasNotice] = useState<CanvasNotice | null>(null)

  /**
   * D-184-11 — a `＋` on the line, a type chosen there, a step that exists immediately.
   *
   * The new slug is READ BACK from the store rather than re-derived here. `slugForType`
   * is pure, so calling it a second time on the same phases would give the same answer
   * today — and would be a second copy of the slug rule, which is exactly how the two
   * silently disagree the first time either side grows a condition. The store owns slug
   * generation; this reads which phase appeared.
   *
   * Then three things, in this order and for stated reasons:
   *  1. the phase is SELECTED and the panel opens on it — the type is chosen at add time
   *     because `PhaseFormPanel` conditions on `phase.config.phase_type` and offers no
   *     control that writes it, so the very next thing an author needs is the inspector;
   *  2. the surface says how many steps moved, in the same vocabulary the delete message
   *     uses, because an insert is never cosmetic: the projection draws its sequential
   *     edge by a `phase_index + 1` LOOKUP, so a step landing in the middle renumbers
   *     every step after it;
   *  3. nothing is written to the server. R6's explicit-save contract is untouched.
   */
  const onInsertAt = useCallback(
    (index: number, type: PhaseTypeId) => {
      const actions = store.getState()
      const before = renumber(actions.phases)
      const known = new Set(before.map((p) => p.slug))

      actions.insertPhaseOfTypeAt(index, type)

      const after = renumber(store.getState().phases)
      const added = after.find((p) => !known.has(p.slug))
      // The store declines an insert outside the drafted view; saying nothing happened
      // is honest, and inventing a message about a phase that was not created is not.
      if (added === undefined) return

      setSelectedSlug(added.slug)
      setCanvasNotice({
        kind: "action",
        lead: "Added",
        // 187-15 (RESEARCH Open Q6): the SAME face the card the author just created shows.
        subject: nodeTitle(added, nameContext),
        detail: renumberedPhrase(countMoved(before, after)),
      })
    },
    [store, nameContext],
  )

  /**
   * D-184-12 — the `✕`. IMMEDIATE, with Undo, and no confirm dialog anywhere.
   *
   * R10a IS CHECKED FIRST, AND ITS ANSWER IS A REFUSAL RATHER THAN A CONFIRM. A step
   * another step's `on_failure` still points at cannot simply go: the surviving
   * `skip_to_phase` would name a slug no phase provides, which is the backend's
   * `unsatisfiable_skip`. So the edit is DECLINED with `canRemovePhase`'s own sentence
   * — no "delete anyway", because offering one would trade a broken definition for a
   * click. The predicate is a SHAPE rule read off the phases in hand; nothing here asks
   * the server anything, and a client refusal must never be mistakable for a verdict.
   *
   * WHEN IT IS ALLOWED, IT HAPPENS AT ONCE. `removePhaseBySlug` removes and renumbers,
   * so the spine re-stitches to `[0..n-1]` in the same tick, and the message carries the
   * inline Undo that makes that affordable — one temporal step back restores the exact
   * previous `phases` array and writes nothing (D-184-03).
   *
   * SELECTION MOVES TO THE FOLLOWING STEP, or to the preceding one when the deleted step
   * was last, so the author's place in the flow survives the edit. Deleting the only
   * step clears the selection and the canvas falls to its named invitation.
   */
  const onRequestRemove = useCallback(
    (slug: string) => {
      const actions = store.getState()
      const before = renumber(actions.phases)
      const at = before.findIndex((p) => p.slug === slug)
      if (at === -1) return

      const outcome = canRemovePhase(before, slug)
      if (!outcome.ok) {
        setCanvasNotice({ kind: "refusal", text: outcome.reason })
        return
      }

      const subject = nodeTitle(before[at], nameContext)
      actions.removePhaseBySlug(slug)
      const after = renumber(store.getState().phases)

      setSelectedSlug(before[at + 1]?.slug ?? before[at - 1]?.slug ?? null)
      setCanvasNotice({
        kind: "action",
        lead: "Removed",
        subject,
        detail: renumberedPhrase(countMoved(before, after)),
        onUndo: () => {
          // The temporal store is reached through `getState()` on purpose: this is a
          // side-effect call inside a callback, not a rendered value.
          store.temporal.getState().undo()
          setCanvasNotice(null)
          setSelectedSlug(slug)
        },
      })
    },
    [store, nameContext],
  )

  /**
   * R12 / D-184-15 — WHY publish is blocked, in the author's words, or `null` when it is
   * not blocked at all.
   *
   * THE FLAG GATE HIDES VERDICTS, NOT THE CLIENT'S OWN WRITE (CR-03, 186-18). The
   * distinction is the whole shape of this memo, and 186-16 got it wrong by putting the
   * outstanding-write branch one line BELOW the gate, which made it dead code on exactly
   * the surface where the write it guards against is still reachable:
   *  - A VERDICT is a claim about the WORKFLOW. The server owns it (D-182-06) and the
   *    reverted surface must never show it (D-14 / D-181-01): with `visual_workflow_canvas`
   *    off the publish trigger must be the control that shipped, for everyone including
   *    operators, so a flag-off empty draft still gets today's enabled `◆ Publish…`. Every
   *    verdict branch therefore stays BELOW the `!canvasEnabled || builderPhase` line.
   *  - AN OUTSTANDING WRITE is a fact about THIS CLIENT'S own write loop. It carries no
   *    severity, no code and no tray row, never enters `verdicts`, and says nothing about
   *    the workflow at all — so the flag has no jurisdiction over it. It is evaluated
   *    ABOVE the gate, because the write itself is reachable above the gate: D-186-03
   *    deliberately leaves `saveNow` ungated ("automatic writes obey the flag, chosen ones
   *    obey the person"), and `actionGroup` mounts BOTH `builder-save-draft` and
   *    `renderPublish` on BOTH header branches. A refusal that guards a write must be
   *    reachable everywhere the write is.
   *
   * D-181-01 is untouched by that ordering, and it is measured rather than assumed: the
   * flag-off RESTING header is unchanged (`WorkflowBuilderPage.header.test.tsx`'s two
   * byte-for-byte pins pass without editing `FLAG_OFF_HEADER_MARKUP`), because this
   * reading is reachable only while a write the person explicitly requested is still
   * outstanding — a state that cannot exist at rest.
   *
   * The reason is chosen honestly, and two of the five branches are authored here:
   *  - A WRITE OUTSTANDING → `SAVING_PUBLISH_WAIT`, ranked FIRST because it is the nearest
   *    obstacle: fixing a verdict will not make Publish go until the PATCH has landed.
   *    Still not the client computing a verdict (D-182-06). It needs no promise to be
   *    sound: `performWrite` sets `{kind:"saving"}` SYNCHRONOUSLY before the request
   *    leaves, and every automatic trigger runs from a timer callback or an effect — a
   *    different task from any later click — so the reading a click observes has already
   *    rendered and is never stale.
   *  - EMPTY DRAFT → the INVITATION. Not a verdict, not a lint code, not a severity —
   *    just what to do next. The server is never asked about a workflow with no steps.
   *  - DEGRADED → the loop's own sentence for that cause. A check that did NOT RUN must
   *    never unblock a publish (D-184-14, fail-closed).
   *  - `ok: false` → the FIRST verdict's `message`, VERBATIM, with `error` findings
   *    ordered ahead of `incomplete` ones so the thing that needs attention now is the
   *    thing that gets named. The message is never rewritten and never mapped.
   *  - anything else (`ok: true`, or nothing asked yet) → `null`, and publish behaves
   *    exactly as it does today.
   */
  const blockedReason = useMemo<string | null>(() => {
    if (persistState.kind === "saving") return SAVING_PUBLISH_WAIT
    if (!canvasEnabled || builderPhase !== "drafted") return null
    if (phases.length === 0) return EMPTY_DRAFT_INVITATION
    // 187-27 (GAP B): NEVER-RAN is fail-closed too — D-184-14's rule for a check that did not run.
    if (isCheckOutstanding(validation.kind)) return DEGRADED_SENTENCE["not-run"]
    if (validation.kind === "degraded") return DEGRADED_SENTENCE[validation.cause]
    if (validation.kind !== "verdicts" || validation.ok) return null
    const first =
      validation.verdicts.find((v) => v.severity !== "incomplete") ?? validation.verdicts[0]
    return first?.message ?? null
  }, [canvasEnabled, builderPhase, persistState, phases, validation])

  // Phase 103-ux: fetch folders + skills ONCE on mount → id→name maps for the form
  // panel + the project picker. Best-effort; a failure leaves the maps empty (the
  // panel then falls back to showing the raw id, never a crash).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const folders = await listFolders()
        if (cancelled) return
        const map: IdNameMap = {}
        for (const f of folders) map[f.id] = f.name
        setFolderNames(map)
        setFolderOptions(folders.map((f) => ({ id: f.id, name: f.name })))
      } catch {
        /* non-fatal — the panel falls back to the raw id */
      }
      try {
        const skills = await listSkills()
        if (cancelled) return
        const map: IdNameMap = {}
        for (const s of skills) map[s.id] = s.name
        setSkillNames(map)
      } catch {
        /* non-fatal */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  /**
   * The workflow's knowledge-base binding, as an ID.
   *
   * 186-08 CHANGED THE DRAFTED READING, deliberately. It used to be
   * `meta.project_folder_id || projectFolderId` — the definition's binding with the
   * describe screen's choice as a fallback. That fallback is unreachable on the way IN
   * (`onDraft` stamps the chosen id onto the definition before `setDrafted`, and Open /
   * Tweak / Use-this seed `projectFolderId` from the definition itself), and it is
   * actively WRONG on the way out: now that the header can UNBIND, `meta.project_folder_id`
   * going null would fall through to the describe screen's stale choice and the chip would
   * keep showing the folder the author just cleared. In the drafted view the DEFINITION is
   * the single source of truth for the binding — the D-14 rule, applied to `meta`.
   */
  const boundFolderId = useMemo<string>(() => {
    if (builderPhase === "drafted") {
      return typeof meta.project_folder_id === "string" ? meta.project_folder_id : ""
    }
    return projectFolderId
  }, [builderPhase, meta, projectFolderId])

  // The bound project-folder NAME for the draft header — a NAME, never a UUID (103-ux).
  // Null when the id resolves to no folder the author can see: deleted, or inherited from
  // a fork of someone else's binding. `folderNames` and `folderOptions` are built from the
  // SAME `listFolders()` array, so "unnameable" and "not offered" are one condition.
  const boundFolderName = useMemo<string | null>(
    () => (boundFolderId ? (folderNames[boundFolderId] ?? null) : null),
    [boundFolderId, folderNames],
  )

  const onDraft = useCallback(async () => {
    const text = describe.trim()
    if (text.length === 0) return
    store.getState().setComposing()
    setSelectedSlug(null)
    // 186-07: only the RENDERED id resets. The loop's own mirror needs none — this callback
    // is reachable only from the describe screen, which a session can be on only before any
    // row exists (a save requires the drafted view, and the sole way back is a generate
    // failure, which creates nothing).
    setDraftId(null)
    try {
      const result = await generateWorkflow({
        describe: text,
        // Phase 103-ux: bind the generated workflow to the chosen project (KB). The
        // backend GenerateRequest accepts project_folder_id; omit when none picked.
        ...(projectFolderId ? { project_folder_id: projectFolderId } : {}),
      })
      if (result.ok) {
        // SINGLE STATE TRANSITION: commit the complete definition + "drafted" in
        // ONE store set. The graph renders whole, in one DOM batch (no timed reveal).
        // Stamp the chosen project_folder_id onto the definition if the generator
        // didn't already bind one (so the draft + later publish carry the binding).
        const def = result.definition as unknown as BuilderDefinition
        if (projectFolderId && !def.project_folder_id) def.project_folder_id = projectFolderId
        store.getState().setDrafted(def)
        // 187-15 — beside the SINGLE transition, so the receipt lands in the SAME DOM batch
        // as the graph. `autoDraft` funnels through here too, deliberately (D-187-14).
        setShowReceipt(true)
        // 187-22 — REPLACED per generation, never frozen for the session, so a second draft
        // gets a second receipt rather than the first one's numbers (D-187-09).
        setReceiptPhases(def.phases)
      } else {
        // ok:false is an HONEST failure — never a renderable broken draft.
        store.getState().setErrorState(result.error, result.detail)
      }
    } catch (e) {
      store.getState().setErrorState(
        "Couldn't generate the workflow.",
        e instanceof Error ? e.message : undefined,
      )
    }
  }, [describe, projectFolderId, store])

  // Phase 124 CR-01 fix: when handed off from the loose "Describe & run" door's
  // `DESCRIBE_CTA` button (autoDraft), run the EXISTING generate→draft flow ONCE
  // with the seeded text — so the fast path actually drafts instead of dead-ending on
  // an empty describe screen. Guarded to fire exactly once, fresh-build ("empty") only.
  const autoDraftFiredRef = useRef(false)
  useEffect(() => {
    if (
      autoDraft &&
      !autoDraftFiredRef.current &&
      (initialDescribe ?? "").trim().length > 0 &&
      builderPhase === "empty"
    ) {
      autoDraftFiredRef.current = true
      void onDraft()
    }
  }, [autoDraft, initialDescribe, builderPhase, onDraft])

  // Merge a phase-form patch into the selected phase's config. The immutable merge
  // itself now lives in `definitionOps.patchPhaseConfig`, reached through the store's
  // `patchConfig` action — D-184-05 leaves exactly ONE mutation home, shared by both
  // views, so this page no longer declares its own copy of it.
  const onPhaseChange = useCallback(
    (patch: PhaseConfigPatch) => {
      if (selectedSlug === null) return
      store.getState().patchConfig(selectedSlug, patch)
    },
    [selectedSlug, store],
  )

  // Phase 185 (D-185-10) — the governance write, in `onPhaseChange`'s exact shape and
  // for the same reason: the immutable merge lives in `definitionOps.setPhaseGovernance`
  // and is reached through the store's `setGovernance` action, so this page declares no
  // second copy of it. It is a SEPARATE callback rather than a widening of `onPhaseChange`
  // because the two booleans are PhaseSpec-level siblings of `validators`, not config
  // keys — `PhaseConfigPatch` was deliberately not widened, which makes writing one of
  // them into `config` a typecheck error rather than a review comment.
  const onGovernanceChange = useCallback(
    (patch: PhaseGovernancePatch) => {
      if (selectedSlug === null) return
      store.getState().setGovernance(selectedSlug, patch)
    },
    [selectedSlug, store],
  )

  /**
   * The panel's blur commit — `saveNow` behind a `dirty` check, and the check is the point.
   * `saveNow` bypasses the loop's dirty gate because a person who presses Save means it,
   * but a blur is not a press: every field is CONTROLLED, so the value already reached the
   * store on the keystroke and a blur adds only immediacy. An unconditional write here
   * would bump a row nobody changed, invalidating the token every other open tab holds —
   * this phase's own conflict, manufactured by the surface that prevents it.
   */
  const onFieldCommit = useCallback(() => {
    if (store.getState().dirty) void persistence.saveNow()
  }, [store, persistence])

  // ── D-184-16 debt 1 — the unsaved-work leave guard, both halves ────────────────

  const dirty = useStore(store, (s) => s.dirty)

  // ── Phase 184-13: the one bottom region's contents ─────────────────────────────

  /**
   * The problems tray's disclosure state. It lives HERE, not inside the tray, which is
   * what makes *"it never auto-opens on a new error"* true by construction rather than by
   * an effect somebody carefully did not write (184-08). Nothing in this file opens it
   * either: the only writer is the summary line the author presses.
   */
  const [trayOpen, setTrayOpen] = useState(false)
  const toggleTray = useCallback(() => setTrayOpen((open) => !open), [])

  /** A tray row was activated — anchor the panel on that step. Selection only; this is
   *  the D-183-05 contract's one callback, not a second way to open the panel. */
  const jumpToStep = useCallback((slug: string) => setSelectedSlug(slug), [])

  /** "Tidy up" — the CURRENT workflow's nudge key only, never the whole namespace. The
   *  arrangement is browser-local (D-184-02), so this writes nothing to the server and
   *  pushes no undo entry; the re-read goes through the same invalidation counter a nudge
   *  write uses. */
  const onTidyUp = useCallback(() => {
    clearNudges(draftId)
    setNudgeVersion((v) => v + 1)
  }, [draftId])

  const checking = useStore(store, (s) => s.checking)
  const storeDegraded = useStore(store, (s) => s.degraded)

  /**
   * The toolbar's five-state reading, joined HERE from the write loop's state and the
   * store's `dirty` (which an undo re-arms, D-184-03). `CanvasToolbar.tsx` is NOT opened —
   * only the value it is handed changes. TWO deliberate collapses: `held` and `conflict`
   * are readings its five-value vocabulary has no word for, so both map to `error` and the
   * header says WHICH (a chip is not where a refusal gets explained); and `dirty` OUTRANKS
   * a receipt, which it did not have to before — the old page state fell back to `idle` on
   * a 2.5 s timer, while the loop's `saved` has no timer.
   */
  const toolbarSaveState =
    persistState.kind === "saving"
      ? "saving"
      : persistState.kind === "error" ||
          persistState.kind === "conflict" ||
          persistState.kind === "held"
        ? "error"
        : dirty
          ? "dirty"
          : persistState.kind === "saved"
            ? "saved"
            : "idle"

  /** The sentence a refusal carries into the toolbar, or `null`. ONE source — the loop
   *  picked it. A CONFLICT deliberately passes `null` so the toolbar falls back to its own
   *  shipped "not saved" label: that reading's real sentence is the banner's, and on the
   *  canvas view both are on screen at once. */
  const saveRefusalSentence =
    persistState.kind === "error" || persistState.kind === "held" ? persistState.sentence : null

  /**
   * The bottom region's whole payload, or `undefined` when the canvas flag is off — in
   * which case the canvas is never rendered anyway, and the prop's absence keeps that
   * fact stated rather than assumed (D-14 / D-181-01).
   */
  const canvasSession = useMemo<CanvasSession | undefined>(() => {
    if (!canvasEnabled) return undefined
    return {
      saveState: toolbarSaveState,
      saveErrorMessage: saveRefusalSentence,
      onSaveDraft: () => void persistence.saveNow(),
      onTidyUp,
      // The toolbar steps the history itself; this is how it reports that it did, so the
      // notice can be retired on that path too (see `canvasNotice`'s docblock).
      onHistoryStep: () => setCanvasNotice(null),
      groups: verdictGroups,
      // The store's cause is the persisted mirror; the tray's vocabulary is the loop's.
      // One translation, in the one place that has both (`"422"` is the unreadable shape,
      // `"network"` is the one worth retrying).
      // 187-27 (GAP B): never-ran OUTRANKS the mirror — a stale cause must not word a check nobody has made.
      degraded: isCheckOutstanding(validation.kind) ? "not-run" : storeDegraded === null ? null : storeDegraded.kind === "422" ? "unreadable" : "unreachable",
      checking,
      trayOpen,
      onToggleTray: toggleTray,
      onJumpToStep: jumpToStep,
    }
  }, [
    canvasEnabled,
    toolbarSaveState,
    saveRefusalSentence,
    persistence,
    onTidyUp,
    verdictGroups,
    validation,
    storeDegraded,
    checking,
    trayOpen,
    toggleTray,
    jumpToStep,
  ])

  /**
   * The in-app half. `WorkflowsPage` owns the `← Workflows` breadcrumb and this page
   * owns the dirty state, and there is no router between them — so the Builder hands the
   * host a predicate and the host asks before it switches view. Re-registered whenever
   * `dirty` changes so the closure is never stale, and UNREGISTERED on unmount so a
   * Builder that is gone cannot keep refusing to be left.
   */
  useEffect(() => {
    if (!registerCanLeave) return
    registerCanLeave(() => (dirty ? window.confirm(UNSAVED_LEAVE_PROMPT) : true))
    return () => registerCanLeave(null)
  }, [registerCanLeave, dirty])

  /**
   * The tab-close half. GATED on `dirty` in the shipped Escape-listener shape: no
   * listener exists while the draft is clean, so it costs nothing at rest and a saved
   * session never gets the browser's "leave site?" dialog. `preventDefault()` plus the
   * legacy `returnValue` assignment is what every engine still requires to show it.
   *
   * 186-07 (D-186-03): UNCHANGED CODE, CHANGED MEANING — see `UNSAVED_LEAVE_PROMPT`. With
   * autosave live it is armed almost only when a write was refused or is held, which is
   * the case it was always for.
   */
  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ""
    }
    window.addEventListener("beforeunload", onBeforeUnload)
    return () => window.removeEventListener("beforeunload", onBeforeUnload)
  }, [dirty])

  /**
   * Phase 184.1-01 — does the PRE-DRAFT screen have to host the merged row?
   *
   * Only when an ancestor actually handed a band down. With the flag on, `WorkflowsPage`
   * and `WorkflowDoorSwitch` stop drawing their own bands and pass them here — and the
   * describe screen has no `<header>` of its own, so without this the `← Workflows`
   * breadcrumb would simply VANISH on a fresh build and strand the author on a screen
   * with no way back. Gated on the slots rather than on the flag alone, because a bar
   * with nothing in it is chrome that costs height and says nothing.
   */
  const preDraftHeaderHosted =
    canvasEnabled && (headerLead !== undefined || headerTrail !== undefined)

  // ── EMPTY: just the describe box — a 3-second read, nothing else. ──
  if (builderPhase === "empty" || builderPhase === "composing" || builderPhase === "error") {
    const describeScreen = (
      <div className="flex h-full flex-col items-center justify-center bg-background px-6 py-8">
        <div className="flex w-full max-w-[640px] flex-col gap-4">
          <div className="flex flex-col items-center gap-2 text-center">
            <span aria-hidden="true" className="text-3xl">
              ✎
            </span>
            <h1 className="font-semibold text-foreground" style={{ fontSize: "1.5rem" }}>
              {DESCRIBE_H1}
            </h1>
          </div>

          <textarea
            aria-label="business requirement"
            value={describe}
            onChange={(e) => setDescribe(e.target.value)}
            placeholder="Describe the goal in plain language…"
            rows={5}
            disabled={builderPhase === "composing"}
            className="w-full resize-none rounded-lg border border-border bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />

          {/* Phase 103-ux: ONE calm project picker — binds the generated workflow to
              a knowledge base. Only shown once folders have loaded (keeps the empty
              screen calm when there are none). NOT the sketch's full infer+confirm loop. */}
          {folderOptions.length > 0 && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-muted-foreground">Which knowledge base should this use?</span>
              <select
                data-testid="project-folder-picker"
                aria-label="Which knowledge base should this use?"
                value={projectFolderId}
                onChange={(e) => setProjectFolderId(e.target.value)}
                disabled={builderPhase === "composing"}
                className="w-full rounded-lg border border-border bg-card px-3 py-2.5 text-[14px] text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              >
                <option value="">No specific knowledge base</option>
                {folderOptions.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          <div className="flex flex-col items-center gap-3">
            <button
              type="button"
              disabled={!canDraft}
              onClick={onDraft}
              className="rounded-md bg-primary px-5 py-2 text-[14px] font-medium text-primary-foreground transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
            >
              {builderPhase === "composing" ? "Composing…" : DESCRIBE_CTA}
            </button>

            <p data-testid="describe-hint" className="text-center text-[13px] text-muted-foreground">
              You describe the goal — the AI <b className="font-medium text-foreground">{HINT_FRAG1}</b>,{" "}
              <b className="font-medium text-foreground">{HINT_FRAG2}</b>, and{" "}
              <b className="font-medium text-foreground">{HINT_FRAG3}</b>.
            </p>
            {/* 187-15 (Req 6 / 151-C) — ONE quiet line, gated HERE because `describeScreen` is
                built on both branches and the picker holds no flag. Still one way in. */}
            {canvasEnabled && <StarterTemplatePicker onChoose={setDescribe} />}
          </div>

          {/* HONEST FAILURE — never a renderable broken draft (T-103-04-01). */}
          {builderPhase === "error" && (
            <div
              data-testid="generate-error"
              role="alert"
              className="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-[13px] text-foreground"
            >
              <p className="font-medium">Couldn't generate — {errorMessage}</p>
              {errorDetail && <p className="mt-1 text-[12px] text-muted-foreground">{errorDetail}</p>}
              <p className="mt-1 text-[12px] text-muted-foreground">
                Nothing was saved. Adjust your description and try again.
              </p>
            </div>
          )}
        </div>
      </div>
    )
    return (
      <BuilderStoreProvider store={store}>
        {preDraftHeaderHosted ? (
          <div className="flex h-full flex-col bg-background">
            <BuilderHeaderBar lead={headerLead} trail={headerTrail} />
            <div className="min-h-0 flex-1">{describeScreen}</div>
          </div>
        ) : (
          describeScreen
        )}
      </BuilderStoreProvider>
    )
  }

  // ── DRAFTED: the read-only spine graph (left) + the 400px push form panel (right). ──
  // The push grid mirrors the app's existing ChatLayout 2-state track exactly.

  // The graph column's CHILD — one view or the other, never both, both fed the same
  // three props so the canvas is a drop-in peer of the spine. `activeGraphView` is
  // pinned to "spine" whenever the flag is off, so the lazy chunk is never requested.
  const graphChild =
    activeGraphView === "canvas" ? (
      <Suspense
        fallback={
          <div
            data-testid="builder-canvas-loading"
            className="flex h-full min-w-0 items-center justify-center bg-background text-[12px] text-muted-foreground"
          >
            Opening the canvas…
          </div>
        }
      >
        <WorkflowCanvas
          phases={phases}
          selectedSlug={selectedSlug}
          onSelectNode={handleSelectNode}
          onClearSelection={clearSelection}
          // Phase 185 (D-185-09) — the SAME list the panel's dial and `gatesFor` read.
          // One value, three readers; the canvas derives none of it and fetches none of it.
          kbTools={kbTools}
          // 187-15 — the same context the spine gets; two views cannot name one step twice.
          nameContext={nameContext}
          // Phase 184-11 — the editing half, composed HERE and nowhere else. This branch
          // is unreachable unless `canvasEnabled` is true (`activeGraphView` pins to
          // "spine" otherwise), so the flag is passed explicitly rather than assumed.
          editable={canvasEnabled}
          marks={marks}
          nudges={nudges}
          onNudge={onNudge}
          onCommitNodes={onCommitNodes}
          // Phase 184-12 — the grow-the-flow half. Both refusals are decided HERE, from
          // `definitionOps`' shape predicates, and the canvas renders what it is told.
          onInsertAt={onInsertAt}
          onRequestRemove={onRequestRemove}
          notice={canvasNotice}
          // Phase 184-13 — R12's ONE bottom region. Everything both rows render arrives
          // in this single object: the toolbar's save reading, the tray's server-derived
          // findings, and the three callbacks. The canvas composes; it derives nothing.
          session={canvasSession}
        />
      </Suspense>
    ) : (
      <PhaseSpineGraph
        phases={phases}
        selectedSlug={selectedSlug}
        onSelectNode={handleSelectNode}
        // D-14 — SPREAD-CONDITIONAL: flag-off, genuinely ABSENT, not present-and-undefined.
        {...(canvasEnabled ? { nameContext } : {})}
      />
    )

  // D-183-03 — the strip renders ONLY when the flag resolves strictly on. With the
  // flag off `graphChild` IS the grid's first child, exactly as it ships today: no
  // wrapper element, no strip, no reserved space, nothing of the canvas in the DOM.
  const graphColumn = canvasEnabled ? (
    <div className="grid min-h-0 min-w-0 grid-rows-[auto_auto_minmax(0,1fr)] overflow-hidden [&>*:last-child]:row-start-3">
      {/* The house segmented control (`SkillStudioPage.tsx:191-212`). A plain div
          host, never a nav landmark — the Phase 155 A11Y-01 rule (an interactive
          "tablist" role must not override a landmark). Tablist semantics only. */}
      <div
        data-testid="builder-view-toggle"
        role="tablist"
        aria-label="Graph view"
        className="flex items-center gap-1 border-b border-border/60 px-4 py-2"
      >
        <button
          type="button"
          role="tab"
          data-testid="builder-view-spine"
          aria-selected={activeGraphView === "spine"}
          onClick={() => setGraphView("spine")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] transition-colors",
            activeGraphView === "spine"
              ? "bg-primary/10 font-semibold text-primary"
              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
          )}
        >
          <span aria-hidden="true" className="mr-1.5">
            ≣
          </span>
          Spine
        </button>
        <button
          type="button"
          role="tab"
          data-testid="builder-view-canvas"
          aria-selected={activeGraphView === "canvas"}
          onClick={() => setGraphView("canvas")}
          className={cn(
            "rounded-md px-3 py-1.5 text-[13px] transition-colors",
            activeGraphView === "canvas"
              ? "bg-primary/10 font-semibold text-primary"
              : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
          )}
        >
          <span aria-hidden="true" className="mr-1.5">
            ⬡
          </span>
          Canvas
        </button>
      </div>
      {/* 187-15 (Req 5 / 150-B) — above the graph, gated STRUCTURALLY by this branch: flag-off
          `kbTools` is `[]`, so an ungated receipt would report zero grounded steps on a workflow
          the run-time gate still binds. DISMISSED IT RENDERS NO NODE, which is why the graph is
          pinned to the 1fr row by `*:last-child` rather than by auto-placement. */}
      <SeedReceipt
        phases={receiptPhases}
        kbTools={kbTools}
        nameContext={nameContext}
        open={showReceipt}
        onDismiss={() => setShowReceipt(false)}
      />
      {graphChild}
    </div>
  ) : (
    graphChild
  )

  /**
   * Phase 184.1-01 — the header's two GROUPS, declared once and rendered by whichever
   * shape is in play. Extracting them into fragments changes no DOM: a fragment emits no
   * element, so the flag-off `<header>` below still renders the exact bytes Task 1's pin
   * captured from the unmodified page.
   */
  /**
   * D-186-15 — THE BINDING, PROMOTED FROM A LABEL INTO A CONTROL (BUG-260731-03).
   *
   * The shipped chip said `📁 <folder>` and could not be clicked. The knowledge base was
   * choosable ONLY on the pre-draft describe screen, so of the four ways into this
   * Builder, two (fork a starter, tweak a published workflow) never offered the choice at
   * all and a third (open a draft) inherited a binding it could not change. The only
   * in-product repair was regeneration, which discards the authored canvas.
   *
   * ONE CONTROL, TWO MOUNT POINTS. This is the same select the describe screen renders,
   * under the same test id, over the same `folderOptions` (fetched unconditionally on
   * mount, so nothing new is requested here). A net-new workflow-settings panel was
   * rejected by D-186-15: it fires G-2 (sketch-first) and would blow this phase's UI
   * budget of a status line plus a conflict banner.
   *
   * THE UNBOUND STATE RENDERS. The shipped bound-name gate hid it entirely, and the
   * operator's evidence is that the failure is invisible *precisely* when nothing is
   * shown. Unbound now reads `UNBOUND_KB_INVITATION` — a fact about configuration, never
   * a verdict (see that constant's docblock for where it may and may not travel).
   *
   * ⚠ WHY IT IS GATED ON `canvasEnabled`, and what that costs. D-181-01 promises the
   * flag-OFF Builder is byte-identical for everyone, operators included, and that promise
   * is pinned as literal markup in `WorkflowBuilderPage.header.test.tsx`. A new affordance
   * rendered unconditionally would break the v3.6 revert switch — the milestone's HARD
   * gate #1 — for a control the reporting operator reaches with the flag ON. So flag-off
   * keeps the shipped display-only chip, unchanged, and the repair path lands on the
   * canvas surface. This is 186-07's rule applied a second time (the quiet autosave line
   * is gated because it describes canvas-only machinery; the conflict banner is not,
   * because a refusal is reachable from any surface and must always be seen). The cost is
   * recorded in `deferred-items.md` with a concrete re-open trigger.
   */
  const kbAffordance = canvasEnabled ? (
    <span
      data-testid="builder-bound-folder"
      className="flex min-w-0 shrink items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
    >
      <span aria-hidden="true">📁</span>
      <select
        data-testid="project-folder-picker"
        aria-label="Knowledge base this workflow searches"
        value={boundFolderId}
        onChange={(e) => {
          const id = e.target.value
          // The store half: `setProjectFolder` writes `meta.project_folder_id` AND arms
          // `dirty` in ONE `set()` (186-04), so the leave guard and the autosave loop
          // cannot see a binding the other missed. The write itself is not this file's —
          // it lands about a second later through `useDraftPersistence` (D-186-05).
          store.getState().setProjectFolder(id || null)
          // The page half, and the decision RESEARCH left open (#4), taken as option (a):
          // flip `hasEdited` HERE. D-184-15's actual rule is "nothing is claimed before
          // the author's first EDIT", and a deliberate re-bind is an author edit — on a
          // bug whose whole story is a failure that surfaced too late, the wrong answer
          // is the one where this edit produces no live check. It is flipped at the call
          // site rather than by widening the subscription's `meta` exclusion: that
          // exclusion exists so generate/open (which always replace `meta`) do not start
          // the loop, and widening it would restart the loop on every document load. A
          // call-site flip is precise; a subscription change is a blunt instrument.
          setHasEdited(true)
          // `projectFolderId` (the describe screen's own state) is deliberately NOT
          // written: in the drafted view the definition is the single source of truth for
          // the binding, and a second copy is the drift D-14 forbids.
          //
          // UNBINDING IS ALLOWED, AND ITS TRAP IS RECORDED RATHER THAN GUARDED. A phase
          // declaring `folder_scope` on a workflow with no `project_folder_id` raises a
          // raw 422 (`_folder_scope_requires_project`), which under D-186-04's
          // hold-the-write rule would leave a permanently unsaveable draft. It is
          // unreachable today — `folder_scope` is a read-only display in `PhaseFormPanel`
          // and no authoring control writes it, pinned by a source assertion in the header
          // suite. A client-side "you can't unbind" refusal was rejected: that is the
          // client computing a validation rule, which is exactly what D-182-06 forbids.
          // Carry-forward: `.planning/phases/186-concurrency-autosave/deferred-items.md`.
        }}
        className="min-w-0 max-w-[220px] truncate bg-transparent text-[11px] text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
      >
        <option value="">{UNBOUND_KB_INVITATION}</option>
        {folderOptions.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
        {boundFolderId !== "" && !folderOptions.some((f) => f.id === boundFolderId) && (
          <option value={boundFolderId}>{UNNAMED_KB_OPTION}</option>
        )}
      </select>
    </span>
  ) : boundFolderName !== null ? (
    // Phase 103-ux, UNCHANGED: the bound project (knowledge base) NAME, not a UUID. The
    // flag-off surface keeps exactly what it shipped — including hiding when unbound.
    <span
      data-testid="builder-bound-folder"
      className="shrink-0 truncate rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
    >
      📁 {boundFolderName}
    </span>
  ) : null

  /**
   * Quick 260809-klo — THE CONTROL THAT CLOSES BUG-260809-02.
   *
   * THE BUG. A workflow authored on the CANVAS could never be published. The gauntlet's
   * stage 1 refuses without `business_requirement`; the field was reachable from the NL
   * door (the model emits it as part of the generated definition) and the template door
   * (the seeded starter row carries it) and from NOWHERE ELSE. A live-cloud census of
   * eight drafts found exactly one with a null requirement — the one built by hand. So
   * the canvas was the one authoring door of three that could not populate a
   * publish-required field, and the author discovered it only at the publish gate, after
   * doing all the work.
   *
   * THE WHOLE GAP WAS THE INPUT. Nothing else needed building, and three of the four
   * things a fix would normally need were already shipped: the store round-trips `meta`,
   * `selectDefinition` spreads it into the PATCH body (so this rides the shipped write
   * path with ZERO change to the write loop), and the author-time warning already travels
   * server → tray → `blockedReason` end to end. A second warning here would be a second
   * truth-teller; none is added.
   *
   * WHY IT LIVES IN `identityGroup`, AS A SIBLING OF `kbAffordance`. This is D-186-15's
   * shape applied a second time to the same field class with the same failure: that
   * decision fixed BUG-260731-03 — a definition-level field choosable only on the
   * pre-draft describe screen, so most ways into this Builder never offered it — by
   * promoting the KB chip into a control in this exact group under this exact gate. A
   * second, different answer to one question is drift. It also has to be the header: the
   * header renders above the grid on BOTH graph views, while a control in `graphColumn`
   * would steal a third `auto` row from the flag-on wrapper's grid and permanently
   * shorten the flow — the exact complaint 184.1 exists to have fixed. And the group is
   * already "what workflow is this" (name · draft · knowledge base); purpose is that same
   * category, and per the workflow soul it is the HERO of it — the drafted Builder
   * surfaced it nowhere at all before this.
   *
   * WHY THE `canvasEnabled` GATE IS MANDATORY, NOT STYLISTIC. D-181-01 promises the
   * flag-OFF Builder is byte-identical to what shipped, and `WorkflowBuilderPage.header.test.tsx`
   * pins that `<header>` as literal markup. An unconditional control would break the v3.6
   * revert switch — the milestone's HARD gate #1. The flag-off branch is therefore a
   * plain `null`, with no display-only fallback: that surface currently says nothing
   * about the purpose, and the byte pin requires it keep saying nothing.
   *
   * AND THE GATE COSTS THIS BUG NOTHING. The canvas door does not exist with the flag
   * off — the view-toggle strip renders only under `canvasEnabled` and `activeGraphView`
   * is pinned to `"spine"` otherwise — and BUG-260809-02 was reported against the canvas.
   * So a flag-gated control covers 100% of the reported surface. ACCEPTED RESIDUAL,
   * recorded rather than hidden: with the flag OFF the field stays unreachable, which
   * costs nothing today because both flag-off entry paths (NL generate, starter fork)
   * populate it already — the bug report's own live census is the evidence.
   *
   * THE GLYPH IS `✎`, the describe screen's own glyph on this page — deliberately NOT
   * `✦`, which is the shipped Working badge and which the icon convention refuses for
   * canvas-adjacent surfaces because it sits on the verdict mark's coordinates.
   */
  const requirementAffordance = canvasEnabled ? (
    <span
      data-testid="builder-business-requirement"
      className="flex min-w-0 shrink items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
    >
      <span aria-hidden="true">✎</span>
      <input
        type="text"
        data-testid="business-requirement-input"
        aria-label="Business requirement — the one line this workflow must satisfy"
        placeholder={REQUIREMENT_INVITATION}
        // CONTROLLED, and read straight off the definition. There is deliberately NO
        // page-level `useState` mirror of this text: in the drafted view the definition
        // is the single source of truth, and a second copy is the drift D-14 forbids —
        // the same reason `boundFolderId` reads `meta` rather than the describe screen's
        // own state. The `typeof` narrowing is because `meta` carries an index signature.
        value={typeof meta.business_requirement === "string" ? meta.business_requirement : ""}
        onChange={(e) => {
          // The store half: `setBusinessRequirement` writes `meta.business_requirement`
          // AND arms `dirty` in ONE `set()`, so the leave guard and the autosave loop
          // cannot see an edit the other missed. The write itself is not this file's — it
          // lands about a second later through `useDraftPersistence` (D-186-05), and the
          // field is already in that PATCH body the moment the store holds it, because
          // `selectDefinition` spreads `meta`.
          store.getState().setBusinessRequirement(e.target.value)
          // The page half, mirroring the KB picker's call site exactly: flip `hasEdited`
          // HERE rather than by widening the store subscription. That exclusion exists so
          // generate/open (which always replace `meta`) do not start the live-validation
          // loop, and widening it would restart the loop on every document load. A
          // call-site flip is precise; a subscription change is a blunt instrument.
          setHasEdited(true)
        }}
        // The dirty-gated blur commit that already exists. NOT a second save path, and
        // deliberately not a direct `persistence.saveNow()` — every field here is
        // controlled, so the value already reached the store on the keystroke.
        onBlur={onFieldCommit}
        className="min-w-0 w-[240px] truncate bg-transparent text-[11px] text-muted-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-1 focus:ring-primary"
      />
    </span>
  ) : null

  const identityGroup = (
    <>
      <span className="min-w-0 truncate text-[14px] font-semibold text-foreground">
        {meta.slug ?? "Untitled workflow"}
      </span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
        draft
      </span>
      {kbAffordance}
      {requirementAffordance}
    </>
  )

  const actionGroup = (
    <>
      {/* 186-07 — everything the header says about saving, and the three controls that act
          on it, in ONE component (see its docblock for the state→sentence mapping and for
          why the quiet line is flag-gated while the conflict banner is not). The page
          composes; it authors no save copy and narrows no state. */}
      <BuilderSaveRegion
        state={persistState}
        dirty={dirty}
        autosaveEnabled={canvasEnabled}
        resolving={persistence.resolving}
        onSaveNow={() => void persistence.saveNow()}
        onReload={() => void persistence.reload()}
        onOverwrite={() => void persistence.overwrite()}
      />
      {/* R12 — publish lives in the header that ALREADY EXISTS (sketch 141-B, the
          operator's correction). No net-new band: the reason travels through the
          shipped `renderPublish` seam as a third argument so the mount does not move.
          186-07 adds the fourth argument — the in-flight reporter D-186-12's hold reads. */}
      {renderPublish && definition && (
        <div>{renderPublish(definition, draftId, blockedReason, setPublishInFlight)}</div>
      )}
    </>
  )

  return (
    <BuilderStoreProvider store={store}>
    {/* Phase 190-12 (CONN-02 / D-23, UI-SPEC U-08) — the slug rides beside the store, over
        the SAME subtree, so a leaf under the form panel can write `patchConfig(slug, …)`
        without the panel gaining a prop. `PhaseFormPanel.tsx`'s diff for this phase is
        `0 0` and this wrapper is how. Children-only, so the grid's first child is unmoved.
        Only THIS mount is wrapped: the pre-draft describe mount (`:1530`) carries no panel. */}
    <SelectedPhaseSlugProvider slug={selectedSlug}>
    <div className="flex h-full flex-col bg-background">
      {/* D-184.1-01 — the WHOLE gate. Flag on ⇒ ONE row; flag off ⇒ the three-band surface
          that shipped, reached by a branch that cannot see `headerLead` / `headerTrail` at
          all. Flag-off identity therefore holds BY CONSTRUCTION rather than by a test — and
          Task 1's pin, written against the unmodified page and passing unchanged after this
          landed, is the evidence that it did.
          D-184.1-03 — with the flag ON the merged row also shows in the Spine view. That is
          permitted (D-181-01 constrains flag-OFF only) and is recorded as a decision rather
          than discovered later. */}
      {canvasEnabled ? (
        <BuilderHeaderBar
          lead={headerLead}
          trail={headerTrail}
          identity={identityGroup}
          actions={actionGroup}
        />
      ) : (
        <header className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-2">{identityGroup}</div>
          <div className="flex shrink-0 items-center gap-2">{actionGroup}</div>
        </header>
      )}

      <div
        data-testid="builder-grid"
        className="grid min-h-0 min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
        style={{ gridTemplateColumns: "minmax(0,1fr) " + (panelOpen ? "400px" : "44px") }}
      >
        {graphColumn}
        <PhaseFormPanel
          phase={selectedPhase}
          open={panelOpen}
          folderName={boundFolderName ?? undefined}
          folderNames={folderNames}
          skillNames={skillNames}
          onChange={onPhaseChange}
          // The prop's NAME is `PhaseFormPanel`'s and is not this plan's to rename; what
          // it receives is the dirty-gated commit above, not a persist callback this page
          // declares. See `onFieldCommit`.
          onPersist={onFieldCommit}
          onClose={clearSelection}
          // D-14 — SPREAD-CONDITIONAL, never `rails={canvasEnabled ? rails : undefined}`.
          // With the flag off the prop must be genuinely ABSENT from the element, not
          // present-and-undefined: this panel is ONE instance serving both the shipped
          // Spine view and the flagged Canvas view, and "absent renders today's panel" is
          // the mechanism that keeps a flag-off surface byte-identical for everyone
          // including operators.
          //
          // Phase 185's `onGovernanceChange` rides the SAME conditional rather than
          // arriving as a second, unconditional prop. The governance section is mounted
          // on `rails`, so a handler passed without it could never fire — and adding an
          // always-on governance prop would leak the canvas contract into the Spine view,
          // which is precisely what D-181-01's byte-identity promise forbids.
          {...(canvasEnabled ? { rails, onGovernanceChange } : {})}
        />
      </div>
    </div>
    </SelectedPhaseSlugProvider>
    </BuilderStoreProvider>
  )
}

export default WorkflowBuilderPage
