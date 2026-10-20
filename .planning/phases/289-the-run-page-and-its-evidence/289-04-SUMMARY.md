---
phase: 289-the-run-page-and-its-evidence
plan: 04
subsystem: workflow run surface / evidence report
tags: [VIS-03, TRUST-01, run-page, evidence, export, print, deep-link, tdd]
requires:
  - "289-01: PendingAskCard `paused` prop (the paused live-surface case relies on it)"
  - "289-02: StepEvidenceLine leaf + evidenceVocabulary.ts + RunPhaseConfidence"
  - "289-03 (parallel): GET /workflow-runs/{id}/evidence — built against its <interfaces> contract verbatim"
provides:
  - "lib/api/runEvidence.ts: RunEvidence wire types + getRunEvidence(runId, signal) (own specifier, not re-exported through lib/api.ts)"
  - "lib/runDeepLink.ts: readRunDeepLink / writeRunDeepLink / clearRunDeepLink (strict UUID)"
  - "components/workflows/evidenceView.ts: toEvidenceView / sectionStrings / exportPayload (one pure view-model)"
  - "components/workflows/RunEvidenceReport.tsx: loading / one 404 screen / retry / sketch-B report, JSON export, print"
  - "WorkflowRunPage: finished runs (and the owner read's 404) render the report through ONE early return"
  - "/app?run=<uuid> opens that run on boot (App + ChatLayout initializers)"
affects:
  - "289-05: the RunEvidence key-set cross-check fixture (I1), ledger rows, count-gate adoption, live drives S1-S4"
tech-stack:
  added: []
  patterns:
    - "one pure view-model feeds the DOM and the export check (D-03 by construction)"
    - "client module mocked by its own specifier, never through lib/api.ts"
    - "one @media print block keyed on a print-root attribute; ancestors unclipped via :has()"
key-files:
  created:
    - frontend/src/lib/api/runEvidence.ts
    - frontend/src/lib/api/runEvidence.test.ts
    - frontend/src/lib/runDeepLink.ts
    - frontend/src/lib/runDeepLink.test.ts
    - frontend/src/components/workflows/evidenceView.ts
    - frontend/src/components/workflows/evidenceView.test.ts
    - frontend/src/components/workflows/evidenceFixtures.testutil.ts
    - frontend/src/components/workflows/RunEvidenceReport.tsx
    - frontend/src/components/workflows/RunEvidenceReport.test.tsx
  modified:
    - frontend/src/components/workflows/evidenceVocabulary.ts
    - frontend/src/index.css
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/App.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/pages/WorkflowRunPage.test.tsx
    - frontend/src/pages/__tests__/WorkflowRunPage.seam286.pin.test.tsx
    - frontend/src/pages/__tests__/__snapshots__/WorkflowRunPage.seam286.pin.test.tsx.snap
decisions:
  - "The owner read's 404 ('missing') routes into the report, so the org-scoped evidence read is the only decider (a same-org colleague reaches the record; every refusal is the report's one 404 screen)"
  - "The report keeps a '‹ Back to Workflows' navigation button; the no-write-control assertion is the full button set by name, which includes that navigation"
  - "A step's output renders VERBATIM as text on the report (a record), not as markdown; recorded as a follow-up"
  - "The report's sentence words live in evidenceVocabulary.ts; WorkflowRunPage's retired 404 pair is tombstoned, not kept unused"
metrics:
  duration: "~2 h 40 min"
  completed: 2026-10-19
  tasks: 4
  files: 17
requirements: [VIS-03, TRUST-01]
---

# Phase 289 Plan 04: The Finished Run Is a Printable Evidence Report — Summary

**One-liner:** a finished workflow run now opens, on the same page and route, as sketch 289 B's read-only report. The report has a title block, a facts strip, version banners and four numbered sections. It is built from one pure view-model over the `GET /workflow-runs/{id}/evidence` payload, downloadable as that exact payload (JSON) and printable as itself. It mounts plan 02's evidence line on KB steps, and `/app?run=<uuid>` reaches it.

## Commits (RED before GREEN for every task)

| Task | Commit | Message |
|---|---|---|
| 1 RED | `0fb415e0f` | test(289-04): pin the evidence view-model and deep link |
| 1 GREEN | `0233d20ae` | feat(289-04): evidence client, deep link and view-model |
| 2 RED | `0ee470221` | test(289-04): pin the evidence report by content |
| 2 GREEN | `97c87e86a` | feat(289-04): the printable evidence report |
| 3 RED | `5fd2e29e6` | test(289-04): migrate the terminal-run cases to the report contract (touches ONLY `WorkflowRunPage.test.tsx`) |
| 4 GREEN | `e08e7fd7e` | feat(289-04): finished runs render the evidence report (does NOT touch `WorkflowRunPage.test.tsx`) |

## What was built

- **`lib/api/runEvidence.ts`**: the `RunEvidence` types, declared exactly as in 289-03's `<interfaces>` block, and `getRunEvidence(runId, signal?)`. The run id is passed through `encodeURIComponent`. Any failure throws `ApiError(status)`. `lib/api.ts` is untouched (`grep -c runEvidence` = 0).
- **`lib/runDeepLink.ts`**:
  - `readRunDeepLink()` accepts a strict UUID only (lowercased) and returns `null` for anything else, including when there is no `window`.
  - `writeRunDeepLink(id)` uses `replaceState`, keeps the path, the other params and the hash, and writes nothing for a value that is not a UUID.
  - `clearRunDeepLink()` removes only `run`.
- **`evidenceView.ts`**: pure, with no React import.
  - `toEvidenceView(payload)` produces the facts, the changed and predates banners (D-04), the title and sub line, the four sections, and the owner-only links.
  - `sectionStrings(view)` returns, for each of the four sections, the strings its DOM must contain.
  - `exportPayload(p)` returns `p` itself, not a copy.
  - Privacy is applied a second time on `viewer_is_owner`. The email, "(you)", the thread link and the download never reach a non-owner, even if the server leaked a field.
- **`evidenceVocabulary.ts`**: every report word was appended (read-only mark, buttons, facts, banners, section titles and ledes, verdict sentences per audit kind, R-01 / R-04 words, the 404 / loading / retry words).
- **`RunEvidenceReport.tsx`**:
  - It owns its fetch and aborts it on unmount.
  - It renders one of four states: loading, the one 404 screen ("This run isn't available"), a worded retry for any other failure, or the report in one column with `data-print-root` on the article.
  - The `StepEvidenceLine` leaf is mounted once per step row (D-10). Only KB rows render it.
  - Download JSON is a local copy of the AuditTab blob idiom: `application/json`, file name `run-evidence-<8>.json`, contents `exportPayload(payload)`.
  - Print calls `window.print()`.
  - It writes `?run=<id>` on mount and clears it on unmount.
  - It uses no `dangerouslySetInnerHTML` and does not import the receipt component.
- **`index.css`**: one `@media print` block:
  - Everything is hidden except the print root.
  - The print root's ancestors are made static and unclipped through `*:has([data-print-root])`, so nested `overflow-hidden` shells cannot cut it off.
  - Theme tokens are re-pointed to dark-on-white inside the root.
- **`WorkflowRunPage.tsx`** (D-16):
  - One import and ONE early return, placed after every hook: `loadPhase === "missing" || (loadPhase === "ready" && run && isTerminal)` renders `<RunEvidenceReport runId onBack onOpenThread={ready ? onOpenThread : undefined}/>`.
  - The old screen now serves only `broken`. The retired "That run isn't available." pair is tombstoned, because leaving it unused would be a `noUnusedLocals` error.
- **`App.tsx`**: in the existing `useState<ActiveView>` initializer, `if (readRunDeepLink()) return "workflow-run"` sits before the connections read, with no `replaceState`. **`ChatLayout.tsx`**: `useState<string | null>(() => readRunDeepLink())`.

## Terminal-case migration (W2)

**How the set was measured:** at the base (`fcaa0a853`), the page was instrumented temporarily (since reverted; the tree was confirmed clean) to record `loadPhase === "missing" || (ready && isTerminal)`. The test file got a temporary `afterEach` that logged `currentTestName`.

**Result:** **89 of 179 executions** hit a terminal or missing render. That is **87 source cases**: the band loop is one `it(` that runs three terminal arms. The research's figure was **45 of 172**. It counted explicit terminal fixtures only. The measured set also includes the cases that reach terminal mid-test (polls, wake) and the 404 case.

**Case counts:** the textual `it(` count of `WorkflowRunPage.test.tsx` was **174 at base and 179 after** (+5 new cases, 0 deleted). Executions went 179 → 184.

**Dispositions:** **19 kept-on-live-surface, 41 migrated-to-report, 27 rewritten** (87 in total).

| # | case | disposition | note |
|---|---|---|---|
| 1 | seeds every definition node from the inline run.phases array | kept-on-live-surface | completed → active |
| 2 | puts the terminal seed through the SAME derivation: completed reads Complete, pending reads Not started | migrated-to-report | Re-targeting at `active` was tried first and **measured failing** (the log's completed step reads "Complete" under a live run, not ""), so the terminal status is the case's subject. The report row reads "✓ Done" and the unreached row reads "Not reached". |
| 3 | renders the spine with no stream at all — … every node still has a reading | rewritten | Was `readings()[slug] !== "NONE"`. Now: every step has a report row, and there is no spine and no log. |
| 4 | a terminal run reads `Ran for` and names both ends of the window | migrated-to-report | The same frozen 6m 41s window, now "Completed in 6m 41s". |
| 5 | renders the ${status} band (3 terminal arms of the loop) | migrated-to-report | The terminal arms assert the Result fact contains the same needle. The live arms are unchanged. |
| 6 | names the failing step by TITLE, never by slug or index | migrated-to-report | The report row's title cell. The durable rows are matched to the slice. |
| 7 | the status sentence is on screen exactly ONCE | kept-on-live-surface | completed → active |
| 8 | a failed run raises exactly one assertive notice | rewritten | Was `run-alert` role=alert containing "Failed". Now the Result fact reads "✕ Failed" and there is no alert (see follow-ups). |
| 9 | marks the canvas region busy while the run is live and calm once it is terminal | rewritten | The terminal half: the report has no busy region. |
| 10 | a 404 renders the not-available copy and goes back | migrated-to-report | It is the report's one 404 screen. The words changed per D-14a. |
| 11 | renders the deliverable hero under its own landmark | rewritten | The hero is absent. The Deliverable fact reads "◆ name". |
| 12 | labels the hero with typed headings and never claims the run produced them | migrated-to-report | The P5 no-authorship check now runs over the report's headings. |
| 13 | lists the file the run produced, with its name and its size | migrated-to-report | The name moves to the Deliverable fact. The size and path title have no report counterpart. |
| 14 | reads the list from the RUN's thread and never from the viewed thread | migrated-to-report | The report's download uses the run's thread. |
| 15 | downloads with the RUN's thread id, the file id and the bare filename | migrated-to-report | The same three arguments, from "Download the deliverable". |
| 16 | offers NO preview for the .docx row | migrated-to-report | No iframe, embed or object on the report, and exactly one deliverable control. |
| 17 | renders the rows as a list, one row per file | rewritten | One server-named deliverable. The second workspace file is not named. |
| 18 | surfaces a failed download where the user clicked | migrated-to-report | Now says "Download failed — try again." |
| 19 | orders the list newest first | rewritten | The deliverable is the server's, not decided by the slice's order. |
| 20 | ⚠ the JUST-PRODUCED file renders FIRST | rewritten | The run's output is named and the template is not. |
| 21 | a row the listing gave with no id is shown as a fact, never as a dead control | migrated-to-report | A deliverable with `file_id: null` gets the fact and no button. |
| 22 | 195: shows the name, the size and the full path in `title` — ZERO buttons | migrated-to-report | Name and zero controls are kept. The size and title are dropped. |
| 23 | 195: the ROW now CARRIES "Download unavailable" | rewritten | The report has no per-file row or affordance (see follow-ups). |
| 24 | 195: POSITIVE CONTROL | migrated-to-report | The probe now runs over the Deliverable fact. |
| 25 | a TERMINAL run with no files says it produced none | migrated-to-report | Deliverable "None". |
| 26 | claims NEITHER while the first read is still in flight | rewritten | The report's own loading line comes first, then "None". |
| 27 | FILE ONLY — renders single file heading and newest file in hero slot | migrated-to-report | Deliverable "◆ name". |
| 28 | TEXT ONLY — the answer renders, and the file heading does NOT | migrated-to-report | "Written answer", and the text is in its step row. |
| 29 | BOTH — the deliverables heading, file, and answer beneath | migrated-to-report | Deliverable "◆ name", and the answer is in its step row. |
| 30 | GENUINELY NOTHING — D-16 completed run sentence | migrated-to-report | Deliverable "None". |
| 31 | the FOUR arms render FOUR DISTINCT texts | migrated-to-report | The body is unchanged. The four reports are compared by set size. |
| 32 | claims NEITHER absence while the first file read is in flight | rewritten | The report does not read the file slice. |
| 33 | an ANSWER renders even while the file read is in flight | rewritten | The answer is in its row while the slice is in flight. |
| 34 | the answer is the LAST row with text | migrated-to-report | |
| 35 | takes the LAST answer … a confirm's QUESTION never wins | rewritten | Was "question nowhere". The record now shows it AS the confirm step's question, never as output or deliverable. |
| 36 | an EMPTY-STRING answer is no answer at all | migrated-to-report | Deliverable "None". |
| 37 | the answer renders as sanitised markdown, with its own line breaks kept | rewritten | Verbatim pre-wrap text. Line breaks are kept and markdown is not rendered. |
| 38 | a confirm step's QUESTION is never mistaken for the run's answer (CR-02) | migrated-to-report | |
| 39 | a run whose ONLY text is a confirm question shows no answer at all (CR-02) | rewritten | Deliverable "None". The question appears only as the step's question. |
| 40 | markdown in the answer becomes real formatting | rewritten | Shown verbatim, with no `<strong>`. |
| 41 | model-authored markup in the answer cannot execute | migrated-to-report | Checked over the whole report. Stronger than before: even `<b>` stays text. |
| 42 | adds NO focus stop — the answer is prose | migrated-to-report | The answer's row. |
| 43 | polls while non-terminal, so a run that finishes stops claiming it is running | rewritten | After the poll, the report shows "✓ Completed" and there is no "● Running". |
| 44 | a finished run with no claimed_at still shows a number, anchored on created_at and SAID so | rewritten | The report's window is "Completed in 6m 52s". |
| 45 | a queued-anchored figure names its anchor in the plain layer too | rewritten | The sub line's "started … by …". |
| 46 | takes a FINAL slice + file read at the terminal edge | rewritten | The reconcile assertions are kept VERBATIM, and the report is shown. |
| 47 | stops polling once the run is terminal | rewritten | The poll assertions are kept, and there is one evidence read. |
| 48 | a run that FAILS while being watched fires the assertive alert | rewritten | The report shows "✕ Failed". The lost alert is recorded. |
| 49 | re-reads the RUN on wake, beside the slice and the file list | rewritten | The wake leads to the report. |
| 50 | Phase 200.2 — RunHero renders in BOTH log and canvas views | rewritten | No hero and no centre switch on a finished run. |
| 51 | Phase 200.2 (D-04) — centre DOM order is hero -> summary strip -> step list | rewritten | Now the order is facts → §1 → §2 → §3 → §4. |
| 52 | a terminal run does not claim a step is waiting | migrated-to-report | The row reads "Did not finish" and there is no ask card. |
| 53 | does NOT tick on a terminal run | migrated-to-report | The report's outcome is unchanged after 30 s. |
| 54 | `✓ Complete` — the control is absent | migrated-to-report | |
| 55 | `⊘ Cancelled` — the control is absent | migrated-to-report | |
| 56 | `✕ Failed at "…"` — the control is absent | migrated-to-report | |
| 57 | HEADER at rest — the four top-level regions, and nothing else | rewritten | Four `data-evidence-section` elements, and none of the live regions. |
| 58 | renders the receipt on THIS page — its first and only mount | kept-on-live-surface | `mkTimedRun({status:"active"})` |
| 59 | names each step with the SAME `nodeTitle` the canvas paints | kept-on-live-surface | |
| 60 | is mounted on the RUN page and NOWHERE on the builder | kept-on-live-surface | |
| 61 | computes the span from the PHASE timestamps | migrated-to-report | "Completed in 1m 00s", not 12s or 48s. |
| 62 | `claimed_at` being null does NOT stop it | migrated-to-report | |
| 63 | says so IN WORDS when no row carries a readable pair | migrated-to-report | "Completed, runtime not recorded". |
| 64 | `BUG-260610-01`'s TIMER HALF: BOTH figures survive a remount | migrated-to-report | Outcome and row times are identical after a remount. |
| 65 | the two figures MEASURE DIFFERENT THINGS and each says which | rewritten | One run-level figure, and no `run-elapsed`. |
| 66 | renders a real per-step duration, and `never ran` for the routed-around step | migrated-to-report | 12s / 48s / "Skipped". |
| 67 | RS-MNR-04: a historic row reads `time not recorded` | migrated-to-report | |
| 68 | RS-MNR-02: an `active` row under a TERMINAL run reads `did not finish` | migrated-to-report | |
| 69 | a STALE live-slice row does not override the durable rows | migrated-to-report | 12s and "✓ Done", never "Running". |
| 70 | the receipt survives a run with NO durable rows at all | migrated-to-report | Zero rows and "runtime not recorded". |
| 71 | renders the DECLARED count and noun on the step list line | kept-on-live-surface | +`status: "active"` |
| 72 | RS-MNR-03: a step that declared NO count renders NO count slot | kept-on-live-surface | |
| 73 | a DECLARED `0` is forwarded as the fact it is | kept-on-live-surface | |
| 74 | the NOUN passes VERBATIM | kept-on-live-surface | |
| 75 | the shipped deliverable listing still renders — a GREEN row DRIVEN | migrated-to-report | One deliverable download, clicked. |
| 76 | the receipt did NOT open a file-content path | kept-on-live-surface | |
| 77 | the REAL terminal render is clean | rewritten | Non-vacuity is re-established on the report's rows. The predicate is unchanged. |
| 78 | RS-3b — the SUB-STEP execution trace is REPORTED, and provably absent | kept-on-live-surface | |
| 79 | a TERMINAL run marks its unanswered prompt over | migrated-to-report | Stronger than before: no ask card and no textbox at all. |
| 80 | centre switch: opens on the LOG | kept-on-live-surface | The describe's `beforeEach` changed to `active`. |
| 81 | centre switch: swaps the centre — and swaps it BACK | kept-on-live-surface | |
| 82 | centre switch: the SPINE survives both views | kept-on-live-surface | |
| 83 | centre switch: is a radiogroup | kept-on-live-surface | |
| 84 | 214-11: the run log's row for an external step is named by the identity | kept-on-live-surface | `runWithExternalStep` changed to `active`. |
| 85 | 214-11: an ordinary run reaches no identity at all | kept-on-live-surface | |
| 86 | 214-11: a null service_name renders the action ALONE | kept-on-live-surface | |
| 87 | 214-11: no wire id reaches the run page's markup | kept-on-live-surface | |

**New cases (5):**
1. A TERMINAL run renders the report and no RunSpine. The owner's thread seam uses the run's thread.
2. The owner read's 404 routes into the report, whose own 404 is the one refusal screen.
3. A same-org colleague (the owner read returns 404) reads the report, with no thread link, no email and no "(you)".
4. An ACTIVE run keeps the live surface and renders no report. This case also exercises the `spineReadings` / `logTimes` helpers.
5. A PAUSED run keeps the live surface with the 289-01 card (`data-paused="true"`).

**RED at the Task 3 commit (`5fd2e29e6`):** **73 failing and 111 passing executions.**
- The 73 failures are exactly the 68 migrated or rewritten source cases (70 executions, because the band loop has three terminal arms) plus the 3 new report cases.
- Every one of them fails because there is no mount yet: `findReport()` / `run-evidence-report` is never rendered.
- No kept-on-live-surface case failed. Case 2 was first assigned "kept". It failed as kept, so it was re-classified to migrated-to-report BEFORE the RED commit, and the reason is written in the case.

**GREEN at the Task 4 commit (`e08e7fd7e`):** **184 passed, 0 failed**, with `WorkflowRunPage.test.tsx` unedited. `git show --stat e08e7fd7e` does not list it.

## seam286 pin: changed snapshot

- **Snapshot updated (exactly one):**
  - `286-03 pin — the four load screens > missing: a 404 is the not-available screen, with no Try again 1`.
  - Reason: D-05 / D-14a. The owner read's 404 now routes into the evidence report, whose org-scoped read is the only decider. It renders the report's one refusal screen ("This run isn't available" plus the sketch-B body) instead of "That run isn't available.".
  - The `.snap` diff is `1 insertion, 1 deletion`, on that entry only.
- The loading ×2, ready and broken snapshots are byte-unchanged.
- **Behaviour assertions edited, not snapshots:**
  - The 5 s poll's terminal read now expects the report's loading line instead of `run-band` "✓ Complete".
  - The terminal-edge case expects the same thing. Its one-shot reconcile counts are unchanged and pass, because the 286 hooks run before the early return.
  - The pin mocks `@/lib/api/runEvidence` (an in-flight read by default) and `@/lib/api/documents`.

## Verification

- **Task 1:** `runDeepLink.test.ts`, `evidenceView.test.ts`, `runEvidence.test.ts` and `StepEvidenceLine.test.tsx`: **59 passed**.
- **Task 2:** `RunEvidenceReport.test.tsx`, `evidenceView.test.ts` and `RunReceipt.test.tsx` (the importer pin, unchanged): **81 passed**.
- **Task 4 verify set: 350 passed across 27 files.** This was the seam286 pin, `RunEvidenceReport`, `src/components/layout` (all of it), the page-source `?raw` fences (`StopControl.baseline`, `runStepCount`, `MessageItem.inlineApproval`), `RunReceipt` and the Task 1 suites.
- **Neighbouring fence suites:** `renameFence`, `ChatArea.expertThread`, `IngestionStrip`, `previewVocabulary`, `tabsContrast`, `gutterTokens.fences`, `activeViewReachability`, `LibraryPage.initialTab` / `tabAttention`, `WorkflowBuilderPage.header`, `src/__tests__/routing` and `no-sketch-surface`: **243 passed across 12 files**.
- **Typecheck:** `npx tsc -p tsconfig.app.json --noEmit` reports **63 errors at base and 63 after**. The set diff (file and code, positions stripped) is empty both ways after Task 3 and after Task 4.
- **Acceptance greps:**
  - In `runEvidence.ts`: `getRunEvidence` = 1 and `encodeURIComponent` = 1.
  - In `lib/api.ts`: `runEvidence` = 0.
  - In `evidenceView.ts`: `from "react"` = 0.
  - In `RunEvidenceReport.tsx`: `dangerouslySetInnerHTML` = 0, `RunReceipt` = 0, `data-print-root` = 1 and `<StepEvidenceLine` = 1.
  - In `index.css`: `@media print` = 1.
  - In `WorkflowRunPage.tsx`: `<RunEvidenceReport` = 1.
  - `readRunDeepLink()` = 1 in App and 1 in ChatLayout.
- Full gates (count gate, backend baseline) and the live drives S1-S4 belong to plan 05.

## G-5 record

Triples are re-derived from git after this plan's commits, with six-digit buckets excluded. Hook counts come from `grep -c` and were taken at base (`git show fcaa0a853:`) and after.

| File | commits / phases / lines (after) | lines before → after | `useState(` | `useState<` | `useEffect(` |
|---|---|---|---|---|---|
| `frontend/src/pages/WorkflowRunPage.tsx` | 33 / 13 / 1594 | 1581 → 1594 (+13: one import, one early return, broken-only block, tombstone) | 1 → 1 | 3 → 3 | 4 → 4 |
| `frontend/src/App.tsx` | 37 / 28 / 422 | 418 → 422 (+4: one import, one seed line + comment) | 1 → 1 | 8 → 8 | 4 → 4 |
| `frontend/src/components/layout/ChatLayout.tsx` | 62 / 32 / 1140 | 1137 → 1140 (+3: one import, the initializer + comment) | 5 → 5 | 4 → 4 | 5 → 5 |
| `frontend/src/index.css` | 34 / 18 / 1196 | 1156 → 1196 (+40: one print block) | – | – | – |
| `frontend/src/components/workflows/evidenceVocabulary.ts` | 2 / 1 / 233 | 49 → 233 (words only, no logic beyond joins) | – | – | – |
| `frontend/src/components/workflows/RunEvidenceReport.tsx` | new | 0 → 462 | 2 | 1 | 2 |
| `frontend/src/components/workflows/evidenceView.ts` | new | 0 → 353 | – | – | – |
| `frontend/src/lib/api/runEvidence.ts` | new | 0 → 123 | – | – | – |
| `frontend/src/lib/runDeepLink.ts` | new | 0 → 63 | – | – | – |

**D-16 is honoured.** WorkflowRunPage has ONE mount (one early return) and no new hook, state or effect. App and ChatLayout each have one seed inside an existing initializer. The report does not import the receipt component. Nothing was re-exported through `lib/api.ts`.

**Plan 05 ledger notes:**
- `index.css` is now 34 / 18. Check that it has a ledger row.
- The four new files are young.

**Consequence for the ledger, with the evidence:** `RunHero` (and its terminal-only arms) can no longer be reached from WorkflowRunPage. It renders only when `isTerminal`, and a terminal run now returns early. The `RunHero` JSX and the deliverable-list wiring are still in the page and are dead for this surface. Removing them was deliberately NOT done here, because D-16 allows one touch. The re-open trigger is the next phase that touches WorkflowRunPage.tsx.

## Sketch fidelity (D-14) and the glyph record

The report follows variant B (index.html :199-236): one column, read-only mark, two export buttons, a four-fact strip, the changed banner, and §1-§4 with a definition `<details>`, a step table (# / Step / Status / Time), verdict rows and source rows ("cited by step N"). The step log carries the 289-confidence-on-a-step B line through the shared leaf.

Deliberate departures:
- **No "Compare with v9" button.** It is not in D-14a's list and no definition-compare view exists. The banner ships its words only. Re-open trigger: the operator asks for it.
- **No cost fact.** Sketch B has none. Re-open trigger: the operator asks for it.
- **No "Independent review" verdict (R-03).** The server drops `judge_verdict`.
- **Sources use "passage N"** (chunk_index + 1, the CitationCard convention) instead of the sketch's "p. 12 / §3.2". The wire carries chunk indexes, not page anchors.
- **A "‹ Back to Workflows" link sits above the report** (`print:hidden`). The sketch draws the report alone, but the live page has always had a way back.
- **Step outputs render verbatim as text**, not markdown. See the follow-ups.

Glyphs, checked against `.claude/skills/sketch-findings-agentic-rag/references/icon-convention.md`:
- **◉** (read-only mark), **⤓** (download), **⎙** (print): net-new to the convention. They come from the sketch and are **flagged as proposals**.
- **◆** (deliverable file): the convention already lists ◆ as **a publish-gauntlet stage** (`PublishGauntlet.tsx:967`). Here it is a deliverable marker, on a different surface (a finished-run report, never inside the gauntlet). This dual use is **flagged** for the convention owner.
- **✓ / ✕** (result and verdict): the existing pass/fail usage. ✕ is also the canvas lane's remove control, but that is a different surface and register.
- **⚠** (changed banner): the existing warning usage.

All words and glyphs live in `evidenceVocabulary.ts`. The JSX contains no copy literals.

## Deviations from Plan

1. **[Rule 2 / test infra] A new test file, `lib/api/runEvidence.test.ts`.** The client's 404/5xx `ApiError` behaviour is in the plan's Task 1 `<behavior>`, but no test file for it was listed. Commits `0fb415e0f` and `0233d20ae`.
2. **[Rule 3] A shared fixture file, `components/workflows/evidenceFixtures.testutil.ts`** (test-only, following the `stripComments.testutil.ts` precedent). It holds the owner, colleague, changed, predates and failed payloads used by both the view-model suite and the report suite. Commit `0fb415e0f`.
3. **[Rule 1 / test harness] `runDeepLink.test.ts`'s `afterEach` order was fixed in the GREEN commit.** The no-window case had stubbed `window`, and the reset ran before `unstubAllGlobals`. Commit `0233d20ae`.
4. **[Design / D-05] The report keeps a "‹ Back to Workflows" navigation button.** The RED test's button sets were updated in the Task 2 GREEN commit to include it. The no-write-control property is unchanged: the full set by accessible name is the two exports plus the back navigation, and for the owner also the thread link and the deliverable download. The report has no answer, cancel, retry or edit control. Commit `97c87e86a`.
5. **[D-16 / Rule 3] The page's missing/broken block now serves only `broken`, and its two `COPY_MISSING_*` constants are tombstoned.** After the early return, TypeScript narrows `loadPhase` and rejects a `=== "missing"` comparison (TS2367), and an unused constant fails `noUnusedLocals`. The plan itself says "the missing/broken block then serves only broken".
6. **[Measurement] The terminal-case set is 87 source cases (89 executions), not the researched 45.** It was measured by instrumentation, as recorded above.
7. **[W2] Case 2 was re-classified to migrated-to-report before the RED commit.** Its kept-on-live-surface attempt failed, so the RED set contains no kept case.

## Follow-ups recorded (not fixed here; outside D-16's one-touch budget)

| # | What | Why it matters | Re-open trigger |
|---|---|---|---|
| F-A | A run watched INTO `failed` swaps to the report, and the report raises no `role="alert"` | The assertive announcement that the live surface gave (`ALERTING_STATUSES`) is lost for screen-reader users who watch a run fail | The next phase touching `RunEvidenceReport.tsx`, or the G-4 / a11y review of this phase |
| F-B | The report renders step outputs verbatim, not as sanitised markdown | `**bold**` reads literally on the record; the old hero rendered markdown | The operator, in the S1 drive |
| F-C | An unlinked deliverable (`file_id: null`) is a bare fact, with no "Download unavailable — this file has no link" sentence | The 195-06 inversion ("say why there is no download") has no counterpart on the report | The next phase touching the report's owner links |
| F-D | `RunHero` and the page's deliverable-list wiring are dead for this surface | Dead code on a G-5 hot file | The next phase touching `WorkflowRunPage.tsx` |
| F-E | The size and full path of the deliverable are not on the report | The evidence payload carries no size | The operator asks for it |

## Threat surface

These are mitigated as planned:
- T-289-20: React text only. The definition is in a `<pre>` via `JSON.stringify`. The grep for `dangerouslySetInnerHTML` is 0, and the hostile-string tests pass for the view-model, the report and the page.
- T-289-21: the strict UUID reader, tested.
- T-289-22: owner fields are gated twice. The colleague `textContent` and button-set tests pass.
- T-289-23: the button-set tests pass.
- T-289-24: one 404 screen, and the owner read's 404 routes into the evidence read.

There are no new endpoints or auth paths. The print CSS uses `:has()`, which is supported in current Chromium, Firefox and Safari, and it is only cosmetic in print.

## Known Stubs

None. Every value in the report comes from the evidence payload. The fallback words ("Untitled workflow", "Not recorded", "None") are honest absences, not placeholders.

## TDD Gate Compliance

All four tasks have `test(289-04)` before `feat(289-04)` in `git log`:
- `0fb415e0f` → `0233d20ae`
- `0ee470221` → `97c87e86a`
- `5fd2e29e6` → `e08e7fd7e`

Task 3 is the W2 migration RED, and Task 4 is its GREEN. Each RED run failed for the intended reason: a missing module (Tasks 1-2), or a missing mount (Task 3).

## Self-Check: PASSED

- FOUR new source files exist: `lib/api/runEvidence.ts`, `lib/runDeepLink.ts`, `components/workflows/evidenceView.ts`, `components/workflows/RunEvidenceReport.tsx`.
- FIVE new test files exist: `runEvidence.test.ts`, `runDeepLink.test.ts`, `evidenceView.test.ts`, `RunEvidenceReport.test.tsx`, `evidenceFixtures.testutil.ts`.
- All six commits were found with `git log --oneline fcaa0a853..HEAD`: `0fb415e0f`, `0233d20ae`, `0ee470221`, `97c87e86a`, `5fd2e29e6`, `e08e7fd7e`.
- STATE.md and ROADMAP.md were not modified by this executor.
