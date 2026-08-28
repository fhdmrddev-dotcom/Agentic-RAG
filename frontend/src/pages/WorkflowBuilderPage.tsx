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
 * router): the read-only `PhaseSpineGraph` + the `clamp(480px, 38%, 640px)` push
 * `PhaseFormPanel`, wired exactly like the app's existing ChatLayout push grid
 * (`gridTemplateColumns: minmax(0,1fr) <44px|clamp(480px, 38%, 640px)>`).
 * ⚠ D-214-22 (2026-08-28) widened the open track off its old fixed pixel value onto the
 * SAME clamp Settings has used since Phase 213 (`ConnectionsTab.tsx`) — the two authoring
 * panels are ONE track, not two. The 44px collapsed strip is deliberately unchanged.
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
 * `onSelectNode` callback, so the shipped `clamp(480px, 38%, 640px)` `PhaseFormPanel` opens on the clicked
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
import { Play } from "lucide-react"
import { listConnectorConnections, listFolders, listSkills } from "@/lib/api"
// 193.1-05 (D-01) — the pre-draft describe→generate concern, cut out of this page under G-5.
import { useTemplateFirstDraft } from "@/components/workflows/useTemplateFirstDraft"
import { buildToolReadOnlyMap } from "@/components/workflows/toolReadOnlyMap"
import type { TemplateReadAnswer } from "@/components/workflows/useTemplateFirstDraft"
// 193.1-07 (D-06 rule 2) — the bind's own sentence. Authored in its module, never here: an
// interpolating string is a function in a `.ts` vocabulary file, and the filename is DATA.
import { templateBindFailedMessage } from "@/components/workflows/templateFirstVocabulary"
// 193.1-08 (D-24) — the pre-draft attach row, mounted on THIS screen and on the loose door's.
// ONE component, two mounts: the marginal cost of the second is a mount and a prop, and the
// alternative is two surfaces that drift. See the mount below for WHERE it lands and why.
import { DescribeTemplateRow } from "@/components/workflows/DescribeTemplateRow"
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
  type TemplateAssetDescriptor,
} from "@/components/workflows/builderStore"
import { BuilderStoreProvider } from "@/components/workflows/BuilderStoreProvider"
import { classifyTemplateNames } from "@/components/workflows/templateNameBuckets"
import { useTemplatePlaceholders } from "@/hooks/useTemplatePlaceholders"
import { SelectedPhaseSlugProvider } from "@/components/workflows/SelectedPhaseSlugContext"
// 186-07 (G-5): the header's save region — four sentences and three controls — has its own
// file, so composing autosave into this page did not grow it.
import { BuilderSaveRegion } from "@/components/workflows/BuilderSaveRegion"
import { BuilderHeaderBar } from "@/components/workflows/BuilderHeaderBar"
// 197-09 (AUTH-02 / D-02) — the arrival card that COMPOSES the receipt. `SeedReceipt` is
// no longer imported here: this page mounts the parent, and the parent mounts the receipt
// UNMODIFIED behind its first fold. That is the whole of D-02's composition rule at the
// page level — one card in the UI, two components underneath.
import { DraftArrivalCard } from "@/components/workflows/DraftArrivalCard"
import type { DecisionsListProps } from "@/components/workflows/DecisionsList"
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
// 196-08 (AUTH-04): the ONE author-registry read on this surface. Sited here for the same
// reason the two leaf hooks above are — the panel mounts the picker FOUR times, so a fetch
// inside the component would be four requests per step click.
import { useModelRegistry } from "@/hooks/useModelRegistry"
import { useTechnicalNamesOptional } from "@/providers/TechnicalNamesProvider"
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
// ⚠ 199-09 adds `DESCRIBE_REFUSAL` to this list, and IMPORTING IT IS THE POINT. It is the
// 23rd governed door id, created by `199-08` for the door's copy of this same box; this file
// is already a SWEPT SOURCE of the D-24(a) copy fence, so spelling the sentence here instead
// of importing it turns that fence red — which is the fence working. A second spelling of a
// governed string is how a governed string stops being governed.
import {
  DESCRIBE_CTA,
  DESCRIBE_H1,
  DESCRIBE_REFUSAL,
  HINT_FRAG1,
  HINT_FRAG2,
  HINT_FRAG3,
} from "@/components/workflows/doorVocabulary"
import type { CanvasNode } from "@/components/workflows/canvasModel"
// TYPE-ONLY, and that is load-bearing: `WorkflowCanvas` is `React.lazy` so the chunk is
// never requested with the flag off, and a value import of anything from that module
// here would pull it into the main bundle and undo D-183-03's whole point.
import type { CanvasNotice, CanvasSession } from "@/components/workflows/WorkflowCanvas"
import type { GenerateReadiness, WorkflowDefinitionJSON } from "@/lib/api"
// 197-09 (D-18) — WHICH step produces the deliverable. Rows 2 and 5 of the arrival card
// both jump to it, so the page reads the ONE derivation rather than scanning for an emit
// step itself: `soulDeliverable` answers *whether* a file is produced and this answers
// *which step*, and re-implementing either here is the drift `soulData.ts` forbids.
import { terminalEmitSlug } from "@/components/workflows/soulData"

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
 * Phase 193.2-09 (D-06, `SEED-163`) — the VISIBLE half of the requirement's provenance.
 *
 * WHY A MARK AT ALL, AND WHY THIS IS NOT DECORATION. `193.2-05` made the generator PROPOSE
 * a `business_requirement` and `193.2-07` made that proposal DURABLE
 * (`WorkflowDefinition.business_requirement_seeded_by_ai`, stamped server-side after
 * validation and never read off the emitted payload). Between those two and this one the
 * field arrives pre-filled with nothing anywhere saying the AI wrote it — a decision the
 * author is never shown, which is `SEED-163`'s own root failure repeated in miniature. D-06
 * rejects that silent pre-fill explicitly, and rejects the other direction too (an empty
 * field with a click-to-accept proposal is still one extra act before publish, which is the
 * friction `SEED-163` exists to remove).
 *
 * IT IS ALSO WHAT MAKES D-09 HONEST. The publish gate is unchanged: stage 1's
 * `business_requirement_missing` (`backend/app/services/harness/grounding.py`) only checks
 * the field is non-empty, so an AI-seeded value passes it untouched. That is ACCEPTED —
 * because the author can SEE the value is the AI's and overrule it, and pressing Publish is
 * the consent (T-193.2-03). Without this mark, D-09 would be a silent weakening of the
 * judge's own `answers_business_requirement` criterion rather than a stated trade.
 *
 * THE REGISTER: what is true, plainly (D-13). Not an endorsement — it does not say the
 * proposal is good — and not a warning: the ordinary case is that the proposal is right and
 * the author ships it. It reads *the AI proposed this; it is yours to change*, and the
 * second clause is a fact about behaviour that ships in this same plan (the store clears the
 * flag on any edit), never a promise about future work. **No `planned` / `coming` / `soon` /
 * `deferred` / `future release`** — D-14, whose whole reason for existing is that `SEED-164`
 * came from a docblock calling shipped work "deferred" and leaving it reading as a plan for
 * a year.
 *
 * NO GLYPH, DELIBERATELY, AND THE RULE IS THE PROJECT'S OWN. The icon convention's §4 states
 * it for the shipped `waitsForYou` badge: *the WORD carries the meaning; tone is decoration*,
 * and an emoji there spends visual budget the design withholds. Two further reasons make it
 * binding here rather than a preference: `✦` — the one glyph a sketch has ever proposed for
 * "AI-drafted" — is REFUSED, because it is the shipped Working badge and sits on the verdict
 * mark's coordinates on a canvas-adjacent surface; and inventing a NEW canvas mark when the
 * vocabulary has none is the exact drift §4's "what to avoid" list names. The affordance's
 * own `✎` already leads the row and is not repeated.
 */
export const REQUIREMENT_AI_MARK_LABEL = "AI-proposed"

/** The fuller sentence, carried as `title` — the shipped idiom on this header, where
 *  `net-new-flag` and `judge-locked` both explain themselves the same way. */
export const REQUIREMENT_AI_MARK_EXPLANATION =
  "The generator proposed this line when this workflow was created. Edit it and this mark clears."

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

/**
 * 197-09 (AUTH-02) — HAND THE AUTHOR TO A CONTROL THAT ALREADY EXISTS.
 *
 * ⚠ FOCUS FIRST, SCROLL SECOND, AND THE ORDER IS A CORRECTNESS REQUIREMENT — MEASURED,
 * NOT REASONED. Written the other way round, both arrival-card seams did nothing at all:
 * jsdom does not implement `scrollIntoView`, the call threw, and the `focus()` on the next
 * line never ran, so `document.activeElement` stayed on `<body>`. Two cases caught it.
 *
 * The lesson generalises well past the test environment: the FOCUS is the seam's whole
 * job and the scroll is an assist, so an assist that throws must never be able to eat the
 * job. The `typeof` guard makes that structural rather than a property of statement order.
 *
 * `block: "nearest"` is deliberate — it moves the viewport the minimum needed rather than
 * yanking the header to the top of the screen, which on a jump the author did not ask for
 * is disorienting. And a focus that scrolls NOTHING is a jump the author cannot see, which
 * is why the assist exists at all.
 *
 * Module scope, not a component body: it closes over nothing and a per-render copy inside
 * a `useCallback([])` would be a stale closure waiting to be believed.
 */
function handOffTo(node: HTMLElement | null) {
  if (node === null) return
  node.focus()
  if (typeof node.scrollIntoView === "function") {
    node.scrollIntoView({ block: "nearest", inline: "nearest" })
  }
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
   * 193.1-08 (D-24) — the document the author supplied on the LOOSE door, and its
   * ALREADY-COMPLETED reading, carried across the hand-off.
   *
   * ⚠ THE PRECEDENT IS `initialProjectFolderId` DIRECTLY ABOVE, AND THAT IS THE WHOLE
   * MECHANISM — no store, no context, no global. `187-26` added that prop for the identical
   * problem: pre-draft state chosen on the door that only this page can spend. This pair is
   * the same shape, one wave later, for a different pre-draft choice.
   *
   * ⚠ THEY TRAVEL AS A PAIR OR NOT AT ALL, and the door passes them from ONE spread for
   * exactly that reason: a file arriving WITHOUT its answer is the only shape that could make
   * this page re-read, and a re-read returns the reading to `loading` at the instant the
   * one-shot auto-draft fires — the blind-draft race D-07 exists to make impossible. SEED,
   * DO NOT RE-READ. The seed is installed only for the `File` it names, so a mismatched pair
   * is ignored rather than trusted.
   *
   * BOTH ABSENT ⇒ this page behaves exactly as it does without them.
   */
  initialTemplateFile?: File | null
  initialTemplateRead?: TemplateReadAnswer | null
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
  /** Phase 200.3 (SEED-164 / D-03): Test Run action from builder header. */
  onTestRun?: (def: WorkflowDefinitionJSON, draftId: string | null) => Promise<void> | void
  headerLead?: React.ReactNode
  headerTrail?: React.ReactNode
}

export function WorkflowBuilderPage({
  renderPublish,
  onTestRun,
  initial,
  initialDescribe,
  autoDraft,
  initialProjectFolderId,
  initialTemplateFile,
  initialTemplateRead,
  registerCanLeave,
  headerLead,
  headerTrail,
}: WorkflowBuilderPageProps) {
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
  // Phase 103-ux: id→name maps so the form panel renders folder + skill NAMES (never
  // UUIDs). Fetched once on mount; failures degrade to showing the raw id.
  const [folderNames, setFolderNames] = useState<IdNameMap>({})
  const [folderOptions, setFolderOptions] = useState<Array<{ id: string; name: string }>>([])
  const [skillNames, setSkillNames] = useState<IdNameMap>({})
  // Phase 200 (FE-WIRING): connection id→name, so an `external_action` step's face names its
  // destination. Same lifecycle and same failure mode as the two maps above — fetched once on
  // mount, best-effort, and an empty map is the SHIPPED state (the destination-free sentence),
  // never a degraded one. ⚠ NAMES ONLY: nothing from `ConnectorConnection.config` is read here,
  // so no host, port or credential can reach the canvas (CONN-03 SC#4).
  const [connectionNames, setConnectionNames] = useState<IdNameMap>({})
  // Phase 209 (Item 1 fix) — connection id → mcp_server_url | null. Built alongside
  // `connectionNames` in the same mount fetch; the same PITFALL-1 applies. Stored as
  // `null` for capability-type connections (no mcp_server_url) so a missing key can mean
  // "not yet fetched" rather than "not an MCP connection" — that distinction matters for
  // the mark resolver in `canvasModel.ts`. Only `mcp_server_url` is read (CONN-03 SC#4).
  const [mcpServerUrls, setMcpServerUrls] = useState<Record<string, string | null>>({})
  // Phase 209 (Item 2 · SC#2) — connection id → tool name → the SERVER'S OWN
  // `annotations.readOnlyHint`. Read from the same `listConnectorConnections` response as the
  // two maps above, so it costs no extra request. An absent connection, an absent tool, or a
  // tool whose server sent no hint all leave the lookup `undefined`, and the banner FAILS
  // CLOSED to `CHANGES SOMETHING OUTSIDE` — never "only reads" on silence.
  const [toolReadOnly, setToolReadOnly] = useState<Record<string, Record<string, boolean>>>({})
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
  /**
   * 197-09 (D-13 / T-197-03 / T-197-27) — THE SERVER'S READINESS VERDICT ABOUT **ONE**
   * GENERATION, AND IT IS THE SAME CLASS OF VALUE AS `receiptPhases` ABOVE.
   *
   * ⚠ IT IS NOT STORE STATE AND MUST NEVER BECOME STORE STATE. Reading this verdict
   * through a store SELECTOR would make the card narrate the AUTHOR's later edits in the
   * server's voice — CR-01's shape for the fourth time, and the exact defect
   * `receiptPhases` exists to have fixed (see its comment above and `SeedReceipt`'s
   * `phases` contract). ⚠ The forbidden selector is named by ROLE here and never spelled
   * out: a grep criterion sweeps this file's raw source for it, and `196-08` tripped that
   * trap four times — once inside the comment written to explain the first three.
   *
   * ⚠ `undefined` IS A THIRD STATE, NOT A MISSING SECOND ONE. `197-06` shipped the wire
   * type with three representable arms — present, missing-with-a-message, and the whole
   * object being absent — with no empty-object default and no synthesised pass anywhere on
   * the hop. That absence survives to here unchanged and is handed to the card unchanged.
   * The two named ways to lose it are a nullish-coalesce onto an empty object, and a
   * `=== "missing"` read whose `false` branch renders a green tick; BOTH TYPECHECK, which
   * is why neither is written and why a case drives the distinction rather than a comment.
   * ⚠ Neither is spelled out here — a source fence sweeps this file for the first of them,
   * and a mention inside the comment explaining it is what `196-08` tripped on four times.
   *
   * REPLACED on every generation, never merged with a previous one — that is what makes a
   * second generation replace the first one's card rather than blend with it.
   */
  const [readiness, setReadiness] = useState<GenerateReadiness | undefined>(undefined)
  // 187-15 (Req 1 / D-187-05) — the ONE name context: values this page already holds, memoised
  // so the memoised `toCanvas` does not re-project every render. `assets` is DEFINITION-level
  // (a workflow's, never a phase's), which is why 187-04 gates the template tier on
  // `llm_emit`; read defensively — it may be absent, null or not an array. PITFALL 1,
  // ACCEPTED: the maps land asynchronously, so derived faces SETTLE when the mount fetch
  // resolves, exactly as `PhaseFormPanel` already behaves. Rejected: holding the tier until
  // the maps are non-empty (a late canvas for a cosmetic reason). Never: a placeholder.
  // 260814-q5r — the descriptor has ONE home. This `.find()` used to live inside
  // `nameContext` and produced only a filename; the authoring panel now also needs the
  // `asset_id` to ask what the template asks for. Hoisted rather than duplicated: two
  // `.find()` calls over the same array could drift, and a fields list shown under a
  // filename resolved by a DIFFERENT lookup is exactly the lie this feature prevents.
  // The defensive `typeof === "string"` coercion is kept for BOTH fields — `meta.assets`
  // may be absent, null or not an array, and its entries are untyped JSONB.
  const templateAsset = useMemo(() => {
    const assets = Array.isArray(meta.assets) ? (meta.assets as Array<Record<string, unknown>>) : []
    const found = assets.find((a) => a?.kind === "template")
    if (!found) return undefined
    const filename = typeof found.filename === "string" ? found.filename : undefined
    const assetId = typeof found.asset_id === "string" ? found.asset_id : undefined
    return { filename, assetId }
  }, [meta])

  const nameContext = useMemo<NameContext>(
    () => ({
      folderNames,
      skillNames,
      templateFilename: templateAsset?.filename,
      // Phase 200 (FE-WIRING) — the connection id→name map, so an `external_action` step's face
      // can name where it sends (`Posts a message to Slack`) instead of stopping at the verb.
      // It rides the SAME memo as the other two because it is the same class of value and has
      // the same failure mode: PITFALL 1 accepted — the map lands asynchronously, so those faces
      // SETTLE when the mount fetch resolves, exactly as the folder and skill tiers already do.
      // Rejected, for the third time and the same reason: holding the tier until the map is
      // non-empty. Never: a placeholder destination.
      connectionNames,
      // Phase 209 (Item 1 fix) — needed by `buildPhaseData` in `canvasModel.ts` so the MCP
      // mark resolves from the bound connection's `mcp_server_url`, not from the phase config
      // (which never carries that field). Same lifecycle as `connectionNames` beside it.
      mcpServerUrls,
      // Phase 209 (Item 2 · SC#2) — the per-tool read/write declaration, so `effectBannerFor`
      // can resolve `ONLY READS` from the SERVER'S annotation rather than from a name guess.
      toolReadOnly,
    }),
    [folderNames, skillNames, templateAsset, connectionNames, mcpServerUrls, toolReadOnly],
  )

  /**
   * Phase 193.1-05 (D-01 / D-25) — THE PRE-DRAFT DESCRIBE→GENERATE CONCERN, NO LONGER HERE.
   *
   * G-5 fired on this file (10 phases, 34 commits at the cut), and 193.1 adds a pre-draft
   * TEMPLATE READ STATE MACHINE to the same screen — a genuinely second concern on the seam
   * `CLAUDE.md`'s ledger row already named. So the extraction shipped FIRST, in its own wave,
   * before the feature it makes room for (the 192.1 order). No waiver was taken.
   *
   * The describe text, the pre-draft KB choice, the CTA rule, the `/generate` call and the
   * loose door's one-shot auto-draft all live in `useTemplateFirstDraft` now. What stays here
   * is what was never that concern's: `draftId` (read across the drafted view), the seed
   * receipt pair (a DRAFTED-view surface), and `selectedSlug` (the page's one selection
   * contract, shared by both graph views). Each reaches the hook as a callback — see its
   * header for why the two pre-flight resets are ONE call rather than two.
   */
  const {
    describe,
    setDescribe,
    projectFolderId,
    setProjectFolderId,
    canDraft,
    onDraft,
    // 193.1-08 (D-24) — the four values the pre-draft row renders from. The page computes
    // NOTHING about documents: it forwards the hook's own state and the hook's own writers,
    // the panel-prop discipline (`PhaseFormPanel.tsx:155-169`) applied one screen up.
    templateFile,
    templateRead,
    onPickTemplateFile,
    onClearTemplateFile,
    bindHeldTemplate,
    bindFailed,
  } = useTemplateFirstDraft({
    store,
    builderPhase,
    initialDescribe,
    autoDraft,
    initialProjectFolderId,
    // 193.1-08 (D-24) — straight through to the hook, which SEEDS its reading with them.
    // Undefined on every mount that supplies nothing, which is every shipped call site but
    // the loose door's.
    initialTemplateFile,
    initialTemplateRead,
    initialDefinitionFolderId: initial?.definition.project_folder_id,
    onDraftStarted: () => {
      setSelectedSlug(null)
      setDraftId(null)
    },
    // ⚠ 197-09 (D-13) — THE LAST HOP, AND THE ONE A GREEN TYPECHECK CANNOT PROVE. `197-06`
    // widened this callback to a SECOND parameter carrying the server's readiness verdict,
    // and recorded that the page was still ignoring it — because a ONE-ARGUMENT inline
    // callback assigns to a two-parameter signature with NO TypeScript error at all. The
    // page therefore compiled perfectly while silently dropping the verdict. Naming the
    // parameter here is what spends it into page state; the behaviour is pinned by a case
    // in `canvas.test.tsx` that reds when this parameter is deleted, never by `tsc`.
    //
    // All three writes are ONE snapshot of ONE generation, taken in the same batch as the
    // store's single `setDrafted` transition — see `readiness`' own block above.
    onDrafted: (def, verdict) => {
      setShowReceipt(true)
      setReceiptPhases(def.phases)
      setReadiness(verdict)
    },
    // ⚠ 193.1-07 (D-06 / S-3) — THE SHIPPED ATTACH HANDLER, REACHED THROUGH AN ARROW, and
    // the arrow is load-bearing rather than stylistic. `onTemplateAttached` is declared far
    // BELOW this call (it needs the write loop, which needs the callback this hook returns),
    // so naming it directly here would read an uninitialised `const` during render. An arrow
    // created here and invoked only from an async bind runs long after the whole body has
    // evaluated. Passing THIS handler rather than a second copy of it is what keeps
    // `setTemplateAsset` + `saveNow` the ONE writer on the definition JSONB.
    onTemplateBound: (asset) => onTemplateAttached(asset),
  })

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
  // a node to anchor the `clamp(480px, 38%, 640px)` form panel; click the same node
  // again to close it.
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

  /**
   * Phase 193.1-09 (AUTH-03 / SC#3 — D-10 / D-20 / D-22) — WHICH OF THE ATTACHED TEMPLATE'S
   * FIELDS THE DRAFT'S OWN STEPS NAME.
   *
   * Computed HERE and handed down finished, because the rail panel's standing rule is that a
   * definition-level fact is caller-owned: this reads `definition.inputs[]` and the phase
   * slugs, both siblings of `phases`, while that panel's only write seam patches `config`.
   * The panel gains one optional prop and one gated line and computes nothing.
   *
   * The asset id comes from the ONE `templateAsset` memo — the same descriptor whose filename
   * is already on screen — so the fields shown and the file named can never disagree. The
   * definition comes from the ONE `selectDefinition` memo above, for the same reason.
   *
   * ⚠ THE COST, STATED HERE RATHER THAN LEFT TO BE FOUND: this is a SECOND call to the
   * placeholders route for the same asset — the attach section makes its own. Two calls to one
   * pure route with identical arguments cannot disagree about content, so this is a duplicate
   * READ, not a second oracle, and the route persists nothing. The alternative — hoisting the
   * read up and passing the fields down as props — was REJECTED: it changes the data contract
   * of a component that shipped three weeks ago with a 43-case pinned suite, to save one GET.
   * A future phase that wants a single read should hoist it DELIBERATELY, as its own change.
   *
   * ⚠ AND THE HONEST EXPECTATION IS THE DEGENERATE ONE. Measured across all 74 template-binding
   * definitions, zero phase slugs match any known placeholder name, and the definition-level
   * input list stayed empty on 6 of 6 post-fix generations — so the usual answer is *every
   * field named nowhere*. That is not a defect and the surface does not render it as one.
   */
  const templateFields = useTemplatePlaceholders(draftId, templateAsset?.assetId)
  const nameCheck = useMemo(() => {
    // Only a resolved, NON-EMPTY field list produces a check. `fields` carries a non-empty
    // list by that hook's own contract, so an unread, unreadable or field-less template
    // renders nothing at all rather than an empty check that would read as an answer.
    if (templateFields.kind !== "fields") return undefined
    return { classification: classifyTemplateNames(templateFields.fields, definition) }
  }, [templateFields, definition])

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
    /**
     * ── 193.1-07 (D-06 / D-25, threat T-193.1-07-01) — THE ROW EXISTS, SO BIND THE BYTES ──
     *
     * The held document is uploaded at the FIRST INSTANT a `definition_id` exists, which is
     * exactly here: this callback is reached only from the write loop's create branch, and
     * that branch is guarded against re-entry, so "first save" is distinguished by CONTROL
     * FLOW and needs no flag.
     *
     * ⚠ **THE SHAPE OF THIS COMPOSITION IS THE GUARD, AND IT IS NOT NATURAL IN THE CODE THAT
     * CALLS IT.** The write loop invokes this from INSIDE its own `try`, whose `catch` turns
     * anything thrown into a save REFUSAL — and for a terminal-shaped refusal sets a halt flag
     * that nothing in the session ever clears. So a bind that threw would report a failed save
     * for a row that was successfully created, and could freeze autosave outright. Two things
     * prevent it: the bind is an `async` function (which converts a synchronous throw into a
     * rejection) that catches everything internally (so the rejection never escapes), and it
     * is `void`-ed here so nothing is awaited inside the loop's turn. Its suite asserts the
     * RETURNED PROMISE resolves — not merely that the state is right — because a `void`-ed
     * rejection has nowhere to be caught. The persistence hook itself is UNCHANGED by this
     * plan: `git diff --numstat` on it is empty, deliberately (D-25).
     *
     * ⚠ AND A STORAGE BLIP MAY NOT COST THE AUTHOR THEIR DRAFT. The save is the more
     * consequential of the two acts and it has already succeeded by the time this runs; the
     * upload is a follow-up that reports its own failure in its own place — the one
     * `role="status"` line in the drafted view below, gated on the bind's own state — and
     * never through the save's reading.
     *
     * ⚠ THAT LINE IS REFERRED TO BY ROLE RATHER THAN BY ITS TESTID, DELIBERATELY. The plan's
     * own acceptance check is a raw `grep -c` for that id expecting exactly ONE, so a docblock
     * spelling it would make the crude check read 2 and the constraint would stop being
     * checkable by eye. Same property, same reason, as the extracted hook's header naming
     * neither of its hosts. The suite asserts the `data-testid` occurs exactly once.
     */
    onDraftCreated: (id) => {
      setDraftId(id)
      void bindHeldTemplate(id)
    },
  })
  const persistState: PersistState = persistence.state

  const [testRunInFlight, setTestRunInFlight] = useState(false)
  const handleTestRun = useCallback(async () => {
    if (testRunInFlight) return
    setTestRunInFlight(true)
    try {
      // ⚠ 200.3 CORRECTION — this was gated on `persistence.dirty`, which is NOT a member of
      // `DraftPersistence` (the flag lives on the STORE: `store.getState().dirty`). The read was
      // `undefined`, so the guard was permanently false and the flush NEVER RAN — a Test Run
      // launched the last SAVED definition while the canvas showed newer work. `saveNow` is the
      // user-initiated write and is safe unconditionally (`useDraftPersistence.ts` D-186-03), so
      // the fix is to drop the guard rather than to reach for the store.
      await persistence.saveNow()
      if (onTestRun && definition) {
        await onTestRun(definition as WorkflowDefinitionJSON, draftId)
      }
    } finally {
      setTestRunInFlight(false)
    }
  }, [testRunInFlight, persistence, onTestRun, definition, draftId])

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
   * 196-08 (AUTH-04) — the live model registry, read ONCE for the whole panel.
   *
   * ⚠ IT IS NOT GATED ON `canvasEnabled`, unlike `bundle` directly above, and the difference
   * is deliberate. The palette IS the canvas contract (D-14 promises a flag-off surface
   * byte-identical to the shipped one). A model is not a canvas idea: the four `AI model`
   * fields have been on the Spine form since Phase 103, and gating the picker on the flag
   * would leave the surface most authors are actually on with the free-text box AUTH-04
   * exists to remove. Same reasoning `template` already carries at the mount below.
   *
   * `showTechnical` is the app-wide ⌥ reveal, read through the NON-throwing accessor: this
   * page renders in suites that mount no provider, and a leaf that still renders outside one
   * is the shipped contract (`ProblemsTray`, `StepTypePicker`, `WorkflowCanvas` all do this).
   */
  const modelRegistry = useModelRegistry()
  const showTechnical = useTechnicalNamesOptional()?.showTechnical ?? false

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
      // Phase 200 (FE-WIRING) — the connection names, third and last of the mount's id→name
      // reads. UNNARROWED (no `capability` argument): the map is joined on `connection_id`,
      // and a step's capability can be edited without re-fetching, so narrowing the fetch would
      // make the face go blank on exactly the edit that changed it.
      //
      // ⚠ ITS OWN `try`, deliberately, rather than joining the block above. This route is the
      // NEWEST of the three and the only one that can refuse for a reason unrelated to the
      // author (`no_encryption_key` — an operator-level configuration state, `ConnectorApiError`).
      // A shared `catch` would let a connectors refusal swallow the skill map that had already
      // resolved beside it, and every derived skill face would silently drop to its type
      // sentence on an installation that simply has no connectors configured.
      try {
        const connections = await listConnectorConnections()
        if (cancelled) return
        const map: IdNameMap = {}
        const urlMap: Record<string, string | null> = {}
        for (const c of connections) {
          map[c.id] = c.name
          // Phase 209 (Item 1 fix) — store null for non-MCP connections so the mark resolver
          // can distinguish "non-MCP" (null) from "not fetched yet" (missing key).
          urlMap[c.id] = c.mcp_server_url ?? null
        }
        setConnectionNames(map)
        setMcpServerUrls(urlMap)
        // Phase 209 (Item 2 · SC#2) — the per-tool read/write declaration, built by the ONE
        // module that owns the explicit-boolean-only rule. Deliberately not inlined here: the
        // judgement it carries is a safety property and belongs somewhere directly testable.
        setToolReadOnly(buildToolReadOnlyMap(connections))
      } catch {
        /* non-fatal — every external face falls back to its destination-free sentence */
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

  // 193.1-05 (D-01) — `onDraft`, its `/generate` call, the `project_folder_id` stamp, the
  // SINGLE STATE TRANSITION and the 124 CR-01 one-shot auto-draft effect all moved to
  // `useTemplateFirstDraft` with their comments. `onDraft` above is the hook's, and the two
  // page states the moved body used to write (`draftId`, the receipt pair) reach it as the
  // `onDraftStarted` / `onDrafted` callbacks. Nothing about the flow changed — the six
  // pre-draft captures `193.1-01` took on the unmoved tree hold with zero re-capture.

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
   * Phase 193 (AUTH-03, piece 2) — a template was attached to this workflow.
   *
   * IN `onGovernanceChange`'s EXACT SHAPE and for a related reason: the descriptor is a
   * DEFINITION-level fact (a sibling of `phases` in `assets[]`), and `PhaseFormPanel`'s only
   * write seam patches one step's `config`. So the panel forwards the descriptor and this
   * page performs the write, through a store action, exactly as the two `meta`-writing
   * siblings `setProjectFolder` and `setBusinessRequirement` are reached.
   *
   * ⚠ IT SAVES IMMEDIATELY, AND UNCONDITIONALLY. Every other write on this surface is a
   * keystroke that can be re-typed; this one is not — the bytes are ALREADY in Storage under
   * an id only this definition will ever reference, so a session that ends before the next
   * autosave beat leaves an orphaned object and an author who was told the template was
   * attached. `saveNow` bypasses the debounce and the dirty gate but never the hold or the
   * single-flight rule, and it reads `store.getState()` at FIRE time (`performWrite`'s
   * docblock), so the descriptor written one statement earlier is in the payload — this is
   * NOT a closure over a stale rendered value.
   *
   * It is deliberately NOT `onFieldCommit`'s dirty-checked shape: `setTemplateAsset` arms
   * `dirty` in the same `set()`, so the check would be answering a question it just asked.
   */
  const onTemplateAttached = useCallback(
    (asset: TemplateAssetDescriptor) => {
      store.getState().setTemplateAsset(asset)
      void persistence.saveNow()
    },
    [store, persistence],
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

  /**
   * ── 197-09 (AUTH-02 / D-14 / T-197-21) — THE TWO FOCUS SEAMS ────────────────────────
   *
   * THE ARRIVAL CARD'S ROWS DISPLAY THE CURRENT ANSWER AND HAND THE AUTHOR TO THE CONTROL
   * THAT ALREADY EXISTS. They own no control and they write nothing. This page's own rule
   * is the reason, and it is quoted rather than paraphrased because it is the whole
   * argument (see `kbAffordance`'s docblock below): *"A second, different answer to one
   * question is drift."* — and beside it, *"ONE CONTROL, TWO MOUNT POINTS."*
   *
   * Sketch 174 draws the same conclusion from the other end: *"Each decision hands you to
   * the control already on the screen — nothing is duplicated."* It also recorded the
   * failure a second control produces — its own header and card disagreed, because a
   * `<select>`'s value is a DOM property lost on serialisation. In the real app both read
   * `meta`, so that specific bug cannot recur; the CLASS (one screen, two answers to one
   * question) is what these seams refuse.
   *
   * ⚠ `scrollIntoView` IS PART OF THE SEAM, NOT A FLOURISH. The header can be scrolled out
   * of view on a narrow window, and a focus that scrolls nothing is a jump the author
   * cannot see — the control takes the caret somewhere off-screen and the row appears to
   * have done nothing. `block: "nearest"` is deliberate: it moves the viewport the minimum
   * needed rather than yanking the header to the top of the screen.
   *
   * ⚠ BOTH REFS SIT ON NODES **INSIDE** THE EXISTING `canvasEnabled ? (…) : null`
   * AFFORDANCES — the 193.2-09 placement, never a new node in `identityGroup`. A `ref`
   * renders no DOM attribute, so the flag-off header byte pin cannot see one either way;
   * the placement rule is what keeps that true if the element ever gains a visible
   * attribute. Band 3 stays unmovable BY CONSTRUCTION rather than by care.
   *
   * ⚠ AND NEITHER SEAM WRITES. The two affordances keep their shipped store-writing calls
   * exactly as they are — those two setter names are deliberately NOT spelled here,
   * because a criterion counts their occurrences in this file to prove no third caller was
   * added, and a mention inside the comment explaining that would defeat it (`196-08`).
   * These callbacks move focus and do nothing else, which is what keeps ONE writer per
   * question.
   */
  const kbPickerRef = useRef<HTMLSelectElement | null>(null)
  const requirementInputRef = useRef<HTMLInputElement | null>(null)

  const focusKbPicker = useCallback(() => handOffTo(kbPickerRef.current), [])

  const focusRequirementInput = useCallback(() => handOffTo(requirementInputRef.current), [])

  /** Row 4's writer — the store's own `setName`, reached through `getState()` inside a
   *  callback (never as a rendered value, the shipped selector discipline). Row 4 is the
   *  ONE row that owns a field rather than a jump, and that is not an exception to the
   *  rule above: the name has NO existing control anywhere on this screen, so the row's
   *  inline field is not a second answer — it is the first. D-17 declines `ForkNameDialog`
   *  for the same reason (it exists for naming a copy that does not yet exist). */
  const setWorkflowName = useCallback(
    (nextName: string) => store.getState().setName(nextName),
    [store],
  )

  /**
   * ── 197-09 (AUTH-02 / SC#1) — THE ARRIVAL CARD'S **LIVE** HALF ──────────────────────
   *
   * TWO CLASSES OF VALUE REACH THIS CARD AND THEY MUST NOT BE CONFLATED. `receiptPhases`
   * and `readiness` are SNAPSHOTS of one generation (see their blocks above). Everything
   * in this object is the opposite: what the definition says **NOW**, recomputed from
   * `meta` on every render with NO mirrored page copy anywhere — the shipped
   * `requirementIsAiProposed` idiom, and the same reason it gives: in the drafted view the
   * definition is the single source of truth and a second copy is the drift D-14 forbids.
   *
   * A card that passed the snapshot fence by freezing EVERYTHING would fail the live
   * fence, and vice versa. Both are pinned by cases in `canvas.test.tsx`.
   *
   * ⚠ IT LIVES **HERE**, ABOVE THE DESCRIBE SCREEN'S EARLY RETURN, AND THAT PLACEMENT IS
   * A CORRECTNESS REQUIREMENT RATHER THAN A TIDINESS ONE. This component returns the
   * pre-draft describe screen from a branch a few hundred lines below, so EVERY hook in
   * this file sits above that branch — measured, and it was true of all of them before
   * this plan. Declaring this memo where it is *consumed* (beside `graphColumn`) put a
   * hook after that return, so the empty → drafted transition rendered more hooks than
   * the render before it and React threw `Rendered more hooks than during the previous
   * render`, taking eleven cases and eight uncaught exceptions with it. The card's own
   * suite could never have seen this: it mounts the component directly.
   *
   * Each field, and why it is READ rather than re-derived:
   *
   *  • `folderName` — `boundFolderName`, the shipped header read. Its own comment records
   *    that `folderNames` and `folderOptions` are built from the SAME mount-fetch array,
   *    so *"unnameable"* and *"not offered"* are one condition — which is exactly the
   *    row's contract (`null` when unbound or unresolvable). A second `.find()` over
   *    `folderOptions` would be a second lookup that can disagree with the header chip.
   *    ⚠ The fetch function is named by ROLE, never spelled: a shipped source guard counts
   *    its occurrences in this file to prove no second fetch was added, and a mention in a
   *    comment is indistinguishable from a call site to it (`196-08`, four times).
   *  • `templateFilename` — the ONE `templateAsset` memo (`260814-q5r` hoisted it precisely
   *    so two `.find()` calls over `meta.assets` could not drift). No second scan.
   *  • `businessRequirement` / `name` — the `typeof … === "string"` narrow the requirement
   *    input already uses. ⚠ `BuilderDefinition` deliberately does NOT declare `name`
   *    (197-05 decision 2): it lands under the index signature and types as `unknown`, so
   *    this narrow is the one read site and it is the shipped idiom, not a new one.
   *  • `deliverableStepSlug` — `terminalEmitSlug` over the LIVE definition, so adding or
   *    removing an emit step moves the row. `null` is an honest absence and is never a
   *    slug that selects nothing.
   *  • `readiness` — passed straight through, `undefined` and all. NO `?? {}`.
   */
  const decisions = useMemo<DecisionsListProps>(
    () => ({
      folderName: boundFolderName,
      templateFilename: templateAsset?.filename ?? null,
      businessRequirement:
        typeof meta.business_requirement === "string" ? meta.business_requirement : "",
      name: typeof meta.name === "string" ? meta.name : "",
      deliverableStepSlug: terminalEmitSlug(definition),
      readiness,
      onChangeKb: focusKbPicker,
      onChangeRequirement: focusRequirementInput,
      onOpenStep: jumpToStep,
      onChangeName: setWorkflowName,
    }),
    [
      boundFolderName,
      templateAsset,
      meta,
      definition,
      readiness,
      focusKbPicker,
      focusRequirementInput,
      jumpToStep,
      setWorkflowName,
    ],
  )

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

  /**
   * 199-09 (DES-01 · sheet `c9-doors-describe` §3, finished on `c10`'s screen) — THE SECOND
   * DESCRIBE BOX SAYS OUT LOUD WHAT IT HAS SILENTLY REFUSED SINCE PHASE 124.
   *
   * ⚠ IT ADDS NO RULE AND CHANGES NO ENABLEMENT, and that was MEASURED before it was
   * written rather than assumed — `199-08` explicitly left the question open. The CTA below
   * is `disabled={!canDraft}`, and `useTemplateFirstDraft`'s `canDraft` opens on
   * `describe.trim().length > 0` — the identical first term the door's own gate carries. So
   * this expression reads a decision that was already made; it is never consulted by
   * `canDraft`, and `canDraft` is untouched. Had the predicate NOT existed, inventing one
   * would have been behaviour and this row would have been a report instead.
   *
   * ⚠ THE `length > 0` TERM IS LOAD-BEARING AND IS NOT A DUPLICATE OF THE TRIM. An untouched
   * empty box is refused by the same rule, and captioning it would put a refusal on the first
   * screen an author meets — the wrong reading, and a byte-for-byte change to a resting DOM
   * that `WorkflowDoorSwitch.baseline.test.tsx`'s `GOVERN_INLINE` capture pins whole.
   *
   * ⚠ AND IT COVERS ONLY THE FIRST TERM, DELIBERATELY — the same fence `199-08` drew on the
   * door. The second (`templateRead.kind !== "loading"`) already speaks for itself through
   * `DescribeTemplateRow`'s own in-flight line, and the third (`builderPhase !== "composing"`)
   * is spoken by the CTA's own "Composing…" label. A second sentence for either would be a
   * second home for one fact.
   */
  const refusingDescribe = describe.length > 0 && describe.trim().length === 0

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
            // SPREAD-CONDITIONAL, the door's shipped idiom: with nothing refused the
            // attribute is genuinely ABSENT rather than present-and-false, so the resting
            // markup is the markup `GOVERN_INLINE` pins. `aria-invalid="false"` would not be.
            {...(refusingDescribe ? { "aria-invalid": true } : {})}
            // THE CONDITIONAL IS SPELLED AS A CONCATENATION so the unconditional arm is
            // CHARACTER-IDENTICAL to what shipped — three slots move and the token count
            // does not. Written as a whole-string ternary it would be a second literal that
            // could drift from the first (the `ml-auto` idiom, `199-08` §3).
            className={`w-full resize-none rounded-lg border ${refusingDescribe ? "border-destructive" : "border-border"} bg-card px-4 py-4 text-[15px] leading-relaxed text-foreground ${refusingDescribe ? "focus:border-destructive" : "focus:border-primary"} focus:outline-none focus:ring-1 ${refusingDescribe ? "focus:ring-destructive" : "focus:ring-primary"}`}
          />
          {/* ⚠ THE REFUSAL, SAID OUT LOUD — the sheet's whole finding for this surface, and
              the one thing a disabled button cannot do. `role="status"` rather than `alert`:
              the author is mid-typing and this is a standing condition, not an interruption.
              Rendered only while there is an input to refuse, so it never greets anyone and
              the resting DOM is byte-identical.
              ⚠ IT SITS ABOVE THE CTA GROUP, and the placement is load-bearing: two byte-exact
              pins are scoped to that group alone by walking UP from `describe-hint`
              (`FLAG_OFF_DESCRIBE_MARKUP` and the `/template|starter/i` word guard), so a
              sibling above it is outside both — 193.1-08's measured reasoning, reused.
              The sentence is IMPORTED (`DESCRIBE_REFUSAL`), never spelled: this file is a
              swept source of the D-24(a) copy fence. */}
          {refusingDescribe && (
            <p
              data-testid="describe-refusal"
              role="status"
              className="-mt-2 text-[12.5px] leading-snug text-destructive"
            >
              {DESCRIBE_REFUSAL}
            </p>
          )}

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

          {/* ── 193.1-08 (D-24 / SC#1) — THE PRE-DRAFT ATTACH ROW, ON THE GOVERN DOOR ──────
              ⚠ THIS IS `WorkflowBuilderPage.tsx`'s `describeScreen`, NOT `WorkflowDoorSwitch`'s
              `door-describe`. The two screens are near-identical and the splice anchor below
              (`flex flex-col items-center gap-3`) occurs in BOTH files, so the class string
              cannot tell them apart — every assertion about this mount names this file
              (`193.1-PATTERNS.md` §C-1). Both mounts exist because a fast-door author never
              touches this screen (their CTA hands off and auto-fires the draft), while a
              govern-door author never touches theirs and calls `/generate` directly.

              ⚠ IT LANDS **BEFORE** THE CTA GROUP, AND THE PLACEMENT IS LOAD-BEARING RATHER
              THAN aesthetic. Two independent byte-exact pins are scoped to that group alone —
              they resolve it by walking UP from `describe-hint`, so a sibling above it is
              outside both: `FLAG_OFF_DESCRIBE_MARKUP` (`describe.test.tsx:307`, captured in
              Phase 187 wave 1) and the `/template|starter/i` word guard (`:324`). A mount
              INSIDE the group would red TWO assertions, not one. It is also the sketch's own
              splice — `165/build.cjs:269` inserts the block BEFORE the CTA group, never in it.

              ⚠ RENDERED UNCONDITIONALLY — deliberately NOT behind `canvasEnabled`. Gating it
              would inherit the flag-off escape hatch that let `StarterTemplatePicker` ship
              inside the pinned region without reddening it, and AUTH-03 is not a canvas
              feature: the flag-off Spine is the surface most authors are actually on. With no
              document held the row's reading is `idle`, so it renders its control and NOTHING
              else new, and the CTA is enabled exactly when it is today (D-08, by construction
              — no document ⇒ nothing to wait for ⇒ no gate, and no second conditional). */}
          <DescribeTemplateRow
            state={templateRead}
            filename={templateFile?.name}
            onPickFile={onPickTemplateFile}
            onClear={onClearTemplateFile}
          />

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

  // ── DRAFTED: the read-only spine graph (left) + the `clamp(480px, 38%, 640px)` push
  // form panel (right). ──
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
          pinned to the 1fr row by `*:last-child` rather than by auto-placement.

          197-09 (AUTH-02 / D-01 / D-02 / D-06 / T-197-24) — THE CARD REPLACED THE RECEIPT
          **IN PLACE**, and the two words are load-bearing. `graphColumn` still has exactly
          THREE children: this strip, this card, `graphChild`. A FOURTH child auto-places
          into row 3 while `[&>*:last-child]:row-start-3` forces the last one there too, so
          the graph's `minmax(0,1fr)` row collapses to 0 px — sketch 172 measured it and the
          class list above is what makes it structural. A case counts the children.

          The receipt is not gone: `DraftArrivalCard` composes it UNMODIFIED behind its first
          fold (D-02 — `SeedReceipt.tsx` is under a zero-insertion, zero-deletion criterion
          for this whole phase and stays at `0 0`).

          D-01 AND D-06 HOLD BY WHERE THIS SITS, not by a guard anyone has to write. D-01 —
          guidance is on the draft, AFTER — because this branch exists only in the drafted
          view, so nothing joins the generation's critical path and the fast door stays fast
          (the D-05 red line). D-06 — FRESH GENERATIONS ONLY — because `open` is
          `showReceipt`, which is set in the `onDrafted` handler and NOWHERE else: a
          re-opened draft, a fork and a hand-built canvas workflow never see this card, which
          is correct, because its claim (*an AI just made these decisions for you*) is true
          at exactly one moment. ⚠ Do NOT add a second gate for D-06 and do NOT widen
          `showReceipt`'s setters. */}
      <DraftArrivalCard
        phases={receiptPhases}
        kbTools={kbTools}
        nameContext={nameContext}
        open={showReceipt}
        onDismiss={() => setShowReceipt(false)}
        decisions={decisions}
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
        // 197-09 — the arrival card's row 1 FOCUSES this control rather than mounting a
        // second one. A `ref` renders no DOM attribute, so the flag-off header byte pin is
        // blind to it — and this node already lives inside the `canvasEnabled` affordance,
        // which is what makes that true by construction rather than by care.
        ref={kbPickerRef}
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
  /**
   * Phase 193.2-09 (D-06) — is the requirement on screen an AI PROPOSAL?
   *
   * READ OFF THE DEFINITION, with NO page-level `useState` mirror, for the same reason the
   * input's own value is (see its comment below): in the drafted view the definition is the
   * single source of truth and a second copy is drift. `meta` carries an index signature, so
   * the flag needs no widening of `BuilderDefinition` and gets none — the `=== true` is the
   * narrowing, and it is strict on purpose: an `unknown` off a JSONB row must not be truthy-
   * tested into a provenance claim.
   *
   * IT NEVER TRUSTS A MODEL-SUPPLIED VALUE, and that is a property of where the bit comes
   * from rather than of this line. `193.2-07` stamps the flag SERVER-SIDE after validation
   * and ignores whatever the emission claimed — in BOTH directions, each pinned and each
   * driven RED. That matters more than it reads: `WF_SCHEMA` is
   * `WorkflowDefinition.model_json_schema()`, so the emit tool now ADVERTISES this field to
   * the model, making laundering reachable rather than hypothetical. Nothing on the client
   * may add a second opinion about provenance.
   *
   * THE NON-EMPTY CLAUSE IS D-08's FALLBACK, NOT A VALIDATION RULE. A mark on a value that
   * does not exist would make the demote rule read a lie — the same sentence the server's
   * stamp obeys, inherited verbatim from D-187-03's precedent. There is deliberately NO
   * `.trim()`: trimming here would be a second copy of the server's emptiness predicate
   * (`grounding.py` is literally `not (definition.business_requirement or "").strip()`),
   * which D-182-06 forbids and which `setBusinessRequirement`'s own docblock forbids by
   * name. The whitespace-with-flag state that `!== ""` therefore admits is UNREACHABLE from
   * both ends: the server never stamps a value that trims empty, and editing a seeded value
   * down to whitespace clears the flag in the same `set()` that writes it.
   */
  const requirementIsAiProposed =
    meta.business_requirement_seeded_by_ai === true &&
    typeof meta.business_requirement === "string" &&
    meta.business_requirement !== ""

  const requirementAffordance = canvasEnabled ? (
    <span
      data-testid="builder-business-requirement"
      className="flex min-w-0 shrink items-center gap-1 rounded border border-border bg-card px-1.5 py-0.5 text-[11px] text-muted-foreground"
    >
      <span aria-hidden="true">✎</span>
      <input
        // 197-09 — the arrival card's row 3 FOCUSES this control. Same placement rule as
        // the KB picker's ref above: inside the affordance, never a node in `identityGroup`.
        ref={requirementInputRef}
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
      {/* D-06's visible half — ONE gated sibling INSIDE this affordance, never a new node in
          `identityGroup` and never a second ternary. That placement is not tidiness: band 3
          of `FLAG_OFF_HEADER_MARKUP` is the `<header>` hosting `identityGroup`, a literal
          that stood unedited for NINE phases before Phase 193 re-captured it twice (words,
          then structure) and whose own note says the phase expects NO third. Living inside
          the same `canvasEnabled ? (…) : null` as the affordance means the flag-off header
          cannot see this node at all, so band 3 is unmovable BY CONSTRUCTION rather than by
          care — and the flag-off case next door in `canvas.test.tsx` is what proves it.
          No colour, no accent and no glyph: the word carries it (see the constant's block). */}
      {requirementIsAiProposed && (
        <span
          data-testid="business-requirement-ai-mark"
          title={REQUIREMENT_AI_MARK_EXPLANATION}
          className="shrink-0 rounded border border-border px-1 py-px font-mono text-[9px] font-medium text-muted-foreground"
        >
          {REQUIREMENT_AI_MARK_LABEL}
        </span>
      )}
    </span>
  ) : null

  /**
   * Phase 205 (STATE-01 / D-07) — Stateful / Living Register mode toggle in builder header.
   */
  const isStateful = meta.is_stateful === true
  const statefulAffordance = canvasEnabled ? (
    <button
      type="button"
      data-testid="builder-stateful-toggle"
      aria-label="Toggle stateful / living register mode"
      title="Stateful mode allows recurring runs to read prior deliverable output and produce incremental deltas"
      onClick={() => {
        store.getState().setIsStateful(!isStateful)
        setHasEdited(true)
      }}
      className={`flex shrink-0 items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium transition-colors ${
        isStateful
          ? "border-primary/40 bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:bg-accent/40"
      }`}
    >
      <span aria-hidden="true" className={isStateful ? "text-primary" : "text-muted-foreground"}>
        {isStateful ? "●" : "○"}
      </span>
      <span>Living Register</span>
    </button>
  ) : null

  /**
   * 197-10 (D-19) — THE ONE IDENTITY EXPRESSION. The workflow's NAME when it has one,
   * the slug when it does not, the shipped fallback when it has neither.
   *
   * WHY IT MOVED. Before this, the header rendered the slug and `meta.name` appeared in no
   * render position anywhere on this page — the workflow's name was displayed NOWHERE.
   * D-15 accepted in words that "name and slug can disagree", but it was written before
   * anyone had measured that absence, so what it accepted was a LATENT disagreement.
   * Leaving the header on the slug ships a RENDERED one — `northwind-qbr-fa65a43c` in the
   * header against `Northwind QBR` in the arrival card's row 4, on one screen. The card's
   * row and this slot read the SAME live store value, so they agree by construction rather
   * than by synchronisation.
   *
   * ⚠ THE SLUG IS NEVER WRITTEN. This expression only DISPLAYS. `slug` stays the key
   * identity that forks and versioning use, minted once at generation; row 4's write path
   * touches `meta.name` alone.
   *
   * ⚠ THE NON-EMPTY CHECK IS A DISPLAY FALLBACK, NOT A VALIDATION RULE — and it is a named
   * deviation from D-19's literal `meta.name ?? meta.slug`, recorded rather than silent.
   * Row 4's write neither trims nor rejects the empty string (the server owns emptiness),
   * so an author who clears the field would otherwise be shown a blank identity slot. No
   * store action, no request and no predicate learns anything from this check.
   *
   * The `typeof` narrowing is the idiom forty-five lines above: `name` is not declared on
   * `BuilderDefinition` and lands under its index signature as `unknown`.
   */
  /**
   * 199-09 (DES-01 · sheet `c10-builder-chrome` §1 case 4) — THE FALLBACK NOW READS AS A
   * FALLBACK, and this is the one expression that decides both.
   *
   * ⚠ THE PREDICATE IS HOISTED, NOT DUPLICATED. `authoredName` is D-19's own non-empty
   * check with its result carried instead of re-spelled: `identityLabel` is byte-for-byte
   * the same three-arm chain it was (`name → slug → "Untitled workflow"`), and the tone
   * below reads the SAME answer rather than asking the question a second time. Two
   * spellings of one predicate is how a label and its styling come to disagree.
   *
   * ⚠ WHY IT IS A PRESENTATION CHANGE AND NOT A NEW RULE. Nothing reads `authoredName`
   * except this label and its tone. No store action, no request and no predicate learns
   * anything from it — D-19's "display fallback, not a validation rule" is preserved
   * exactly, and is now the thing the surface is honest about: `vendor-brief` painted like
   * an authored name asserts *"this workflow is called vendor-brief"* about a workflow
   * nobody has named. Muting the stand-in says *"this is what we call it until you do"*.
   */
  const authoredName =
    typeof meta.name === "string" && meta.name.length > 0 ? meta.name : null
  const identityLabel = authoredName ?? meta.slug ?? "Untitled workflow"

  const identityGroup = (
    <>
      {/* THE CONDITIONAL IS A CONCATENATION so the AUTHORED arm is character-identical to
          the class list that shipped — one slot moves and the token count does not. The
          FALLBACK arm is the deliberate, stated change; it moves band 3 of
          `FLAG_OFF_HEADER_MARKUP`, whose fixture binds no name, and that re-capture is
          scoped, diffed and justified in this suite's own note. */}
      <span
        className={`min-w-0 truncate text-[14px] font-semibold ${authoredName === null ? "text-muted-foreground" : "text-foreground"}`}
      >
        {identityLabel}
      </span>
      <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
        draft
      </span>
      {kbAffordance}
      {requirementAffordance}
      {statefulAffordance}
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
      {canvasEnabled && draftId && onTestRun && (
        <button
          type="button"
          data-testid="builder-test-run"
          onClick={() => void handleTestRun()}
          disabled={testRunInFlight || persistState.kind === "saving"}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-[13px] font-medium text-foreground transition-opacity hover:bg-accent/40 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Play className="h-3.5 w-3.5 text-success" aria-hidden="true" />
          <span>{testRunInFlight ? "Starting…" : "Test Run"}</span>
        </button>
      )}
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

      {/* ── 193.1-07 (D-06 rule 2, threat T-193.1-07-02) — THE BIND FAILED, SAID OUT LOUD ──
          The 192 `library-fork-failed` shape, transplanted whole: STATE IN THE HOOK, JSX ON
          THE HOST, sentence from a `.ts` vocabulary module, `role="status"`, EXACTLY ONE
          NODE. `role="status"` is what makes a line that appears after an act announced
          rather than merely present. There is no toast library in this repo — zero `sonner`
          imports, no `ui/toast` — and this is not the place to acquire one.

          ⚠ WHY IT IS BUILT RATHER THAN ROUTED THROUGH SOMETHING THAT EXISTS. All three
          candidates were measured and all three refused:
            • the pre-draft generate-error block is gated on the `error` phase, and by bind
              time the phase is `drafted`;
            • the save's own refusal sentence in the toolbar is FORBIDDEN by D-06 rule 2 —
              this is a silent write the person never pressed a button for, and folding it
              into the save's reading is precisely the lie the rule exists to prevent;
            • the canvas notice is retired on a history step, and a failure that vanishes on
              an undo is a failure nobody saw.

          ⚠ THE PLACEMENT IS OUTSIDE THE GRID, NOT INSIDE IT, and that is the reason it sits
          here rather than one line lower: `FLAG_OFF_HEADER_MARKUP` pins the three drafted
          header bands and this node is below them, while the grid's own first child is
          asserted by the canvas suite. Rendering nothing when `bindFailed` is null keeps the
          drafted DOM byte-identical for every session that did not hit this failure — which
          is all of them but one.

          ⚠ AND THE SENTENCE CARRIES THE CONSEQUENCE, NOT THE FACT. A deliverable step written
          to fill a document that is not attached fails at RUN time and can never publish, so
          "attaching failed" would leave the author with a workflow that dies at the worst
          possible moment. The wording lives in `templateFirstVocabulary.ts` and names the one
          place the fix lives; this page authors none of it. */}
      {bindFailed && (
        <p
          data-testid="template-bind-failed"
          role="status"
          className="border-b border-warning/30 bg-warning/5 px-4 py-2 text-[12.5px] text-muted-foreground"
        >
          {templateBindFailedMessage(bindFailed.filename)}
        </p>
      )}

      {/* ── Phase 200 (FE-WIRING) — THE GRAPH TRACK IS NOT DIMMED WHILE THE PANEL IS OPEN,
             AND THE REFUSAL IS RECORDED HERE BECAUSE THIS IS WHERE IT WOULD LIVE.

          `screens/step-panel.html:202` gives its `<main>` `opacity-60 pointer-events-none`
          behind the open aside, and the 200 audit enumerates it as an FE-WIRING row (this
          grid is the seam — nothing here dims or inerts the plane). It is DECLINED, on both
          halves, and the halves fail for different reasons:

            · `pointer-events-none` STRANDS THE AUTHOR. `panelOpen === selectedSlug !== null`,
              so the panel is open exactly while a step is selected, and the graph is the ONLY
              way to select a different one. Inerting it means every step-to-step move becomes
              close-then-reopen, and the ONE remaining exit is `Escape` or the ✕. That is not
              a focus effect; it is a dead end, and this tree's own word for a control that
              leads nowhere is on `stepReadinessContext.ts`.
            · `opacity-60` MUTES THE ONE THING THAT TIES THE TWO TRACKS TOGETHER. The selected
              node's highlight lives in the dimmed track, so the sheet's own composition would
              fade the anchor the panel is anchored TO — and it would do it for the whole
              authoring session, since selecting a step is what opens the panel in the first
              place.

          ⚠ IT IS A MOCKUP FOCUS DEVICE, WHICH IS A REAL CLASS ON THIS SHEET RATHER THAN AN
          EXCUSE. The sheet draws its plane as ten static illustrative nodes, and the audit's
          own next row records a second divergence in the same layout: the sheet shows an open
          `clamp(480px, 38%, 640px)` panel AND the 44px collapsed strip simultaneously, which in the product is the
          same grid track and therefore an unreachable state. A sheet may draw an arrangement
          the live surface cannot hold; where it does, the live surface is the constraint.

          ⚠ RE-OPEN TRIGGER, so this is dated rather than permanent: a step panel that becomes
          MODAL — one the author cannot navigate past — would make the dim honest, because the
          plane behind it really would be unreachable and saying so would be a statement rather
          than a suggestion. The grid below is what makes that false today.

          ⚠ D-214-22 (2026-08-28) — the OPEN track below is the SAME clamp Settings ships at
          `ConnectionsTab.tsx` (`clamp(480px, 38%, 640px)`), spelled byte-identically so the
          two authoring panels are one track rather than two. The `44px` collapsed strip is
          explicitly NOT part of that decision and does not change. */}
      <div
        data-testid="builder-grid"
        className="grid min-h-0 min-w-0 flex-1 overflow-hidden motion-safe:transition-[grid-template-columns] motion-safe:duration-300"
        style={{ gridTemplateColumns: "minmax(0,1fr) " + (panelOpen ? "clamp(480px, 38%, 640px)" : "44px") }}
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
          // Phase 193 (AUTH-03) — UNCONDITIONAL, unlike the two canvas-gated props above,
          // and the difference is deliberate. `rails` / `onGovernanceChange` ride the flag
          // because they ARE the canvas contract and D-181-01 promises a flag-off surface
          // identical to the shipped one. A template binding is not a canvas idea: it is the
          // only way any author can attach the file their deliverable fills in, on either
          // view, and gating it would leave the shipped Spine — the surface most authors are
          // actually on — with no door at all. The panel renders nothing for it on any step
          // that is not `llm_emit`, so the cost elsewhere is zero.
          template={{
            definitionId: draftId,
            // Both read off the ONE `templateAsset` memo, so the filename on screen and the
            // asset the fields were read from are the same descriptor by construction.
            filename: templateAsset?.filename,
            assetId: templateAsset?.assetId,
            onAttached: onTemplateAttached,
          }}
          // 193.1-09 (SC#3) — SPREAD-CONDITIONAL, the `rails` shape below rather than the
          // `template` shape above, and the difference is deliberate: `template` is a control
          // that must exist on every deliverable step, while this is an ANSWER that either
          // exists or does not. Genuinely absent when there is nothing to say, so the panel's
          // "ABSENT ⇒ NOTHING RENDERS" contract is honoured literally rather than by a falsy
          // value that happens to render the same.
          {...(nameCheck ? { nameCheck } : {})}
          // 196-08 (AUTH-04) — SPREAD-CONDITIONAL on a COMPLETE read, the `nameCheck` shape
          // above rather than the `template` shape, and the choice is the load-bearing one on
          // this plan.
          //
          // ⚠ THE REJECTED ALTERNATIVE, NAMED: passing `models: []` on a `loading` or
          // `unavailable` read. It renders a calm, correct-looking control that offers nothing
          // but its inherit option — and worse, `ModelField` would then retain every stored
          // model as `(current) — not in the registry`, telling an author that a perfectly
          // registered model is unknown and inviting them to change it. That is precisely the
          // substitution the registry hook's own docblock exists to make unconstructable, and
          // this is the caller that would have re-created it. (⚠ The hook is named by role, not
          // by token: this plan's acceptance grep counts its identifier over this file, so a
          // mention in prose inflates the count — the 187-24 trap.)
          //
          // ⚠ THE COST OF THE CHOICE, STATED RATHER THAN LEFT TO BE FOUND: while the read is in
          // flight, and for as long as it is failing, the `AI model` field is ABSENT from the
          // step form. An absent field writes nothing and says nothing false; a lying one does
          // both. `ModelField` cannot express "I could not read the registry" — it takes rows,
          // not a reading — and widening it is 196-05's file, not this plan's.
          //
          // ⚠ CORRECTED at Phase 199-06 (DES-01, sheet `c4-phase-form-panel`), in the commit
          // that closed it, and the paragraph above is kept rather than overwritten because
          // it was an accurate statement of a real cost for one phase. THE WIDENING HAPPENED:
          // the picker now takes the READING as well as the rows, so the field no longer
          // disappears — it says which of the two things is true. `196-08` named the file
          // that owed this and the hot-file ledger row carried the same line; this is it.
          //
          // ⚠ THE REJECTED ALTERNATIVE IS STILL REJECTED, and nothing here re-creates it. The
          // two non-ready arms pass NO rows to consult: the picker returns above the first
          // line that reads them, so `models: []` cannot be mistaken for an answer. What
          // makes that safe is the EXPLICIT discriminator, never the emptiness of an array —
          // and a registry that genuinely answers with nothing takes the third arm, inside
          // the normal path, with its own sentence.
          {...(modelRegistry.kind === "ready"
            ? {
                modelPicker: {
                  models: modelRegistry.models,
                  runDefaultModel: modelRegistry.runDefaultModel,
                  showTechnical,
                },
              }
            : {
                modelPicker: {
                  // Not consulted — see above. Present only because the shape requires them.
                  models: [],
                  runDefaultModel: null,
                  showTechnical,
                  noAnswer: modelRegistry.kind === "loading" ? ("loading" as const) : ("unavailable" as const),
                },
              })}
          {...(canvasEnabled ? { rails, onGovernanceChange } : {})}
          isStateful={meta.is_stateful === true}
        />
      </div>
    </div>
    </SelectedPhaseSlugProvider>
    </BuilderStoreProvider>
  )
}

export default WorkflowBuilderPage
