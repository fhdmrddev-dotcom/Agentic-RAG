---
status: pending
phase: 295-runs-that-don-t-dead-end
source: [295-VALIDATION.md, 295-UI-SPEC.md]
started: 2026-10-21T00:56:00Z
updated: 2026-10-21T05:00:00Z
---

## Current Test

[awaiting human testing — the operator's G-4 recognition pass is OWED. The agent's drives in 295-VALIDATION.md are evidence; they are not the operator's sign-off.]

## Before you start

- Use the local app (`/app`) with the backend on `:8000` and vite on `5173`, signed in as yourself.
- The fixtures 295-07 left in place are named `295-07 …` in the Workflows library and the chat list. The empty folder is `295-07 empty KB folder`.
- ✅ **The chat-panel fix has landed** (295-08, merged at `128266ef6`). The agent re-drove S1 on 2026-10-21 (295-VALIDATION.md, "Gap round 1 re-drive"). The panel now shows a live paused ask as `NEEDS YOU` and you can answer it there.
- ✅ **Round 1's four open defects are fixed** (295-10, merged at `9f11f3b21`, and checked live on 2026-10-21: 295-VALIDATION.md, "Gap round 2 live check"):
  - After you answer in the chat thread, the thread now follows the run. The panel reads Complete or Failed within about a second of the run ending, and a second found-nothing question appears on its own (D-r1-02).
  - A card left open in a second tab no longer says the run "has already ended". The current question replaces it, and you can answer it there (D-r1-01). The refusal words flash for only about 0.2 s, so you will not be able to read them. This is accepted (D-r2-03).
  - Typing into the composer while the run waits now says: "This thread's workflow is paused, waiting for your answer. Answer it in the panel or on the run page. To stop the run instead, open its run page and stop it there." (D-r1-03).
  - A run in one of your orgs no longer offers your own folders from your other org (D-r1-04).
- ⚠ **Two things are known and still open, so you will see them:**
  - ✅ **Fixed 2026-10-21 (D-r2-01, `07b7632bc`), checked live twice:** the approval step that comes after an answer (S2's "Approve the note?") is answerable in the same tab while the run waits. It no longer reads "Retired · The run was stopped".
  - **In the tab that followed a Continue-without-sources run to its end, the step shows no Unsourced mark.** Reopen the thread and the mark is there (D-r2-02, deferred).
- The app has no URL router. A browser reload lands on the home screen, so reopen the thread from the chat list.

## Tests

### 1. S1 — a KB step that finds nothing pauses and asks, in BOTH homes
expected: Run the `295-07 S1 found nothing` workflow from a chat thread ("Run a workflow"). Within about a minute the run should pause. Look in two places:
- the chat thread's Workspace panel;
- "Open the run" (the run page).

Both should show the same card: "Searched 295-07 empty KB folder and found nothing for “Find the project status”. How should the run continue?", then three choices in this order (Search another folder, Continue without sources, Stop the run), then "No deadline — the run is waiting for your answer…", and no countdown. The band reads "Paused for your answer". Reload: the card comes back. Choose Search another folder: a "Folder to search" list appears, holding only folders you can see and not the empty one. Pick "PM Demo Project (sample data)" and press Send Answer. The run should complete, and the step should show cited sources.

**Also check, in the chat thread (expectations changed after the 2026-10-21 re-drive):**
- With the Workspace panel closed, the full card is in the chat column. With the panel open, the chat column shows a one-line "Needs you … Answer in panel →" pointer instead.
- **Stopping a paused run.** The chat thread has no Stop button for a paused run, so stop it on the run page ("Open the run"). The run page reads Cancelled and "Why it stopped: Stopped by …".
  - Back in the chat thread, the question is gone and the step reads "Stopped".
  - A thread tab that was already open still shows the card until you switch threads. Answering it there reads "This prompt has expired — the run is no longer active".
  - This replaces the earlier expectation that the card turns "Retired · The run was stopped …". That line is not reachable for a paused run.

You'd recognise failure as:
- the run fails instead of pausing;
- either home says the run was stopped, that the window passed, or that the agent stopped, while it is still waiting;
- a folder you cannot see appears in the list;
- the re-run ignores the folder;
- the band reads ● Running while it waits;
- after your answer, the chat thread keeps reading "Running" once the run has finished (this was D-r1-02, fixed on 2026-10-21).

**Also check, after the 2026-10-21 gap round 2:** answer the card in the panel and stay in the same thread. The panel should move on without a thread switch: research reads done, then wrap reads Complete within a second or two of the run finishing. A card left open in a second tab is replaced by the current question when you press Send there.

result: [pending — the agent's drives on 2026-10-21 PASSED: the panel fix in round 1 (`b5678cc3`), then the follow-after-answer check in round 2 (`b5540647`: Complete 0.2 s after `run_completed`, same tab). The two-tab stale send shows the current question (`5b1477d6`). PASS on the run page per 295-07]

### 2. S3 — a step set to "Must prove it" never offers Continue
expected: Run `295-07 S3 locked found nothing`. The card should offer only Search another folder and Stop the run. Its prompt should say "This step is set to Must prove it, so it can't continue without sources." The words "Continue without sources" must appear nowhere on the page. Choose Stop the run and Send: the card header should read "Answered · run stopped" (this header was NOT seen live by the agent). The run's record should then say "Why it stopped: Searched 295-07 empty KB folder and found nothing for “Find the project status”. Stopped by …".

You'd recognise failure as: a Continue choice anywhere, the run failing instead of pausing, or a header that says the agent resumed.

result: [pending]

### 3. S2 — Continue without sources is marked in all four places
expected: Run `295-07 S2 continue without sources` and answer Continue without sources. The step should carry the amber "◌ Unsourced · continued by <you>" mark and the note "This output was kept without sources — it does not cite your documents." in four places:
1. the chat panel's step card;
2. the run page's spine while the run waits at "Approve the note";
3. the finished run's record (answer Yes first);
4. the downloaded JSON (`unsourced.continued_by` and `unsourced.at`).

You'd recognise failure as: any of the four showing the step plainly done, or the mark being grey and quiet.

⚠ **Known on 2026-10-21 (gap round 2), so you will see these in place 1:**
- (Fixed since: the "Approve the note?" card used to read "Retired · The run was stopped" in the same tab after Continue. After `07b7632bc` it reads answerable, and you can answer it there. D-r2-01.)
- If you stay in the tab until the run ends, the step reads plainly Complete there. Reopen the thread to see the mark (D-r2-02).

result: [pending]

### 4. S7 — runs read truthfully
expected:
- Open the two old runs "200-Word Essay Writer" (`51924c91…`) and "Knowledge Base Library Structure Summary" (`a77ed2c0…`). Each should read Cancelled and be shown, not hidden.
- Open a June failed run such as "Doc Q&A" (`5aa42b6b…`). It should read ✕ Failed and "No reason was recorded when this run failed."
- Open `295-07 S1 found nothing` run `ef53f1fc…`. It should read "Why it stopped: Finalised by the reconciler: its steps had ended."
- Start `295-07 S7 armed email`. While it waits, it reads "Paused for your answer". Press Stop: it reads Cancelled and "Why it stopped: Stopped by …".

You'd recognise failure as: any run reading ● Running or active, a failed run with a blank reason, or the waiting run reading ✕ Failed.

⚠ Decide whether a Cancelled record should carry the ⊘ glyph (it reads "Cancelled" with no glyph, while a failure reads "✕ Failed").

result: [pending]

### 5. S4 — a report step with no template is named, then refused
expected:
- Open the Builder on a workflow whose report step has no template. The tray says "“<step>” fills a template, but no template is attached to this workflow. Attach a template before you publish or run it." Publish is disabled, and Save draft works.
- Attach a template: the message clears.
- Try to start such a workflow from the Run modal without uploading a template, and from a chat thread's "Run a workflow". Each should show the same sentence.

You'd recognise failure as: the save is refused, a citation code shows, or the run starts.

⚠ The Run modal makes a chat thread before it is refused, so an empty thread is left behind. Decide whether that matters.

result: [pending]

### 6. S5 — the DMT-shaped workflow publishes
expected: Open "DMT Project Status Summary & Email" (published by 295-07 from draft `edd81b32`). It is published, and the gauntlet's judge summary talks about the email's content, not only about the email not being sent.

You'd recognise failure as: it is blocked by the judge.

result: [pending]

### 7. S6 — the next step hears the person's answer
expected: Run `295-07 S6 approve then wrap` and answer Yes. The final step's text quotes the answer ("Yes").

You'd recognise failure as: the final step talking as if no one answered.

result: [pending]

### 8. Anthropic roster row (D-33)
expected: Re-run the S1 roster row on Anthropic once billing is restored. On 2026-10-21 every KB sub-run failed with "Your credit balance is too low to access the Anthropic API".

result: [blocked: billing — still out of credit at 2026-10-21 02:46Z (run `f0d5d678`). That run now fails with the outage sentence instead of offering the found-nothing choices (WR-01)]

## Summary

total: 8
passed: 0
issues: 1
pending: 6
skipped: 0
blocked: 1

## Gaps

- ✅ **CLOSED: chat-panel retirement of a live engine ask.** Fixed by 295-08 and verified live on 2026-10-21 (run `b5678cc3`, 295-VALIDATION.md "Gap round 1 re-drive"). The original text is kept below.
- ✅ **CLOSED: a provider error on the KB step offered as "found nothing".** Fixed by 295-09 WR-01 and verified live on 2026-10-21 (run `f0d5d678`). BUG-261021-01 is closed.
- ✅ **CLOSED, D-r1-01:** a stale card refused under CR-01 said "This run has already ended" while the run waited on a newer question. Fixed by 295-10 and checked live on 2026-10-21 (runs `6bb3e0ff`, `5b1477d6`). The refusal words now flash for 0.2 s only (D-r2-03, accepted).
- ✅ **CLOSED, D-r1-02:** after an answer in the chat thread, the thread stopped following the run. Fixed by 295-10 for durable pauses, ends and failures, and checked live on 2026-10-21 (`b5540647`, `dac3d557`, `74c56c63`). The in-stream next question is D-r2-01.
- ✅ **CLOSED, D-r1-03:** on a paused run, the composer refusal told the person to cancel a run the thread cannot cancel. Fixed by 295-10, and the new sentence was seen live on 2026-10-21 (`603a0785`).
- ✅ **CLOSED, D-r1-04:** the "Search another folder" list offered the owner's own folders from the other org. Fixed by 295-10, and checked live in both orgs on 2026-10-21 (`a812cf02`, `25092977`).
- ✅ **CLOSED, D-r2-01:** after an answer in the same tab, an in-stream approval step's card read "Retired · The run was stopped" while the run waited. Fixed by `07b7632bc` (`PendingAskCard.tsx` `runIsOver`), and re-driven live on 2026-10-21 in a fresh browser context: runs `80f7d411` and `77c91d0b` showed the card answerable for the whole 20 s wait (40 of 40 samples), Send enabled once a choice was picked, and the run completed with the panel following. The stop guard held (`406625a5`: a stopped run shows no live card in a freshly opened thread).
- **OPEN, D-r2-02 (defer):** after the panel follows a Continue run to its end in the same tab, the step loses its Unsourced mark until the thread is reopened. It is somewhere in `StreamsProvider.tsx`'s end-of-run path, and the cause is not isolated.
- **ACCEPTED, D-r2-03:** a stale card's refusal words are on screen for 0.2 s before the current question replaces them.
- (original) **Chat-panel retirement of a live engine ask** (295 regression, found by 295-07). A paused found-nothing or approval ask is shown RETIRED in the chat thread's Workspace panel because the client never seeds the workflow lock for a durable pause (`lock_is_stale` is true with no live producer). Code: `frontend/src/components/panel/PendingAskCard.tsx:897`, `frontend/src/providers/StreamsProvider.tsx:2536`, `frontend/src/components/chat/ChatArea.tsx:380`. Not yet a bug report; proposed for `/gsd:fast` with a RED test, then the live re-drive of test 1.
- (original) **A provider error on the KB step is offered as "found nothing"** (found on the Anthropic roster row). The step text is the raw provider error, and Continue keeps it as an unsourced output. Not yet a bug report.
- **A Stop that reaches a live producer records no "Stopped by" reason** (295-04's recorded gap). Seen live on run `b0a8203a`.
