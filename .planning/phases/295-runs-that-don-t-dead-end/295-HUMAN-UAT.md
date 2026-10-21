---
status: pending
phase: 295-runs-that-don-t-dead-end
source: [295-VALIDATION.md, 295-UI-SPEC.md]
started: 2026-10-21T00:56:00Z
updated: 2026-10-21T00:56:00Z
---

## Current Test

[awaiting human testing — the operator's G-4 recognition pass is OWED. The agent's drives in 295-VALIDATION.md are evidence; they are not the operator's sign-off.]

## Before you start

- Use the local app (`/app`) with the backend on `:8000` and vite on `5173`, signed in as yourself.
- The fixtures 295-07 left in place are named `295-07 …` in the Workflows library and the chat list. The empty folder is `295-07 empty KB folder`.
- ⚠ **Do S1 after the chat-panel fix lands.** 295-07 found that the chat thread's Workspace panel shows a live found-nothing or approval ask as **RETIRED** ("The run was stopped, so this question no longer needs an answer"). The run page (`/app?run=<id>`) shows it correctly. If you run S1 before that fix, you will see the failure below, and that result is already known.

## Tests

### 1. S1 — a KB step that finds nothing pauses and asks, in BOTH homes
expected: Run the `295-07 S1 found nothing` workflow from a chat thread ("Run a workflow"). Within about a minute the run should pause. Look in two places:
- the chat thread's Workspace panel;
- "Open the run" (the run page).

Both should show the same card: "Searched 295-07 empty KB folder and found nothing for “Find the project status”. How should the run continue?", then three choices in this order (Search another folder, Continue without sources, Stop the run), then "No deadline — the run is waiting for your answer…", and no countdown. The band reads "Paused for your answer". Reload: the card comes back. Choose Search another folder: a "Folder to search" list appears, holding only folders you can see and not the empty one. Pick "PM Demo Project (sample data)" and press Send Answer. The run should complete, and the step should show cited sources.

You'd recognise failure as:
- the run fails instead of pausing;
- either home says the run was stopped, that the window passed, or that the agent stopped;
- a folder you cannot see appears in the list;
- the re-run ignores the folder;
- the band reads ● Running while it waits.

result: [pending — known FAIL in the chat panel until PendingAskCard.tsx:897 is fixed; PASS on the run page per 295-VALIDATION.md S1]

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

result: [blocked: billing]

## Summary

total: 8
passed: 0
issues: 1
pending: 6
skipped: 0
blocked: 1

## Gaps

- **Chat-panel retirement of a live engine ask** (295 regression, found by 295-07). A paused found-nothing or approval ask is shown RETIRED in the chat thread's Workspace panel because the client never seeds the workflow lock for a durable pause (`lock_is_stale` is true with no live producer). Code: `frontend/src/components/panel/PendingAskCard.tsx:897`, `frontend/src/providers/StreamsProvider.tsx:2536`, `frontend/src/components/chat/ChatArea.tsx:380`. Not yet a bug report; proposed for `/gsd:fast` with a RED test, then the live re-drive of test 1.
- **A provider error on the KB step is offered as "found nothing"** (found on the Anthropic roster row). The step text is the raw provider error, and Continue keeps it as an unsourced output. Not yet a bug report.
- **A Stop that reaches a live producer records no "Stopped by" reason** (295-04's recorded gap). Seen live on run `b0a8203a`.
