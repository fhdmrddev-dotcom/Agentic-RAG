# 244-12 — the browser row that SHELL-03 actually closes on

---

> ⛔ **DRIVEN 2026-09-12 by `/gsd:verify-work 244` — VERDICT: PARTIAL.**
> R2-4: Arm 1 PASS (the blocker is fixed). Arm 2 FAILS both directions -> gap G-8. Arm 3 PASS, operator confirmation owed.
> Full readings: `244-UAT.md` § "Round 2 — DRIVEN 2026-09-12". ⚠ Solo run (D-244-21 /
> OV-SOLO-01): this is a SELF-VERIFICATION, never a review.
> The `pending` fields below are left as WRITTEN so the row's own asks stay legible.


```yaml
plan: 244-12
gap: G-6
closes: SHELL-03, BUG-260828-07
severity: blocker
status: pending
driven_by: pending
driven_on: pending
```

⛔ **THIS PLAN DID NOT CLOSE SHELL-03 AND MUST NOT BE READ AS HAVING DONE SO.** `D-244-14`:
*"`BUG-260828-07` is severity HIGH and closes on a DRIVEN row, not a fence."* Every fence this plan
added proves the approval **MOUNTS**; not one of them proves it **ANSWERS**. That distinction is
not pedantry — 244-03 shipped a green mount fence over this exact blocker and the operator found it
live nineteen plans later. This file is the row `/gsd:verify-work` drives in a real browser.

⚠ **SCOPE, carried verbatim from L-4's `not_yet_established` and NOT widened by this plan.** Only
the **WORKFLOW** path was ever proven broken. The **Deep-mode** `ask_user` path was never driven and
may well have worked all along. Say *"the workflow-raised approval has no chat controls"* — never
*"the inline approval is broken"*.

⚠ **Solo run (D-244-21 / OV-SOLO-01):** Gemini is unavailable, so the build was **self-verified**.
There is no independent reviewer standing behind the three arms below; driving them is the first
genuinely independent check this change receives.

---

## Fixture

The same one L-4 used, so the two rows are comparable rather than merely similar:

| | |
|---|---|
| Workflow | **200-Word Essay Writer** |
| Armed step | step 2, `"act"`, marked **needs-approval** |
| Pending action at L-4 | `send_email` over SMTP |
| Thread L-4 drove | `0d8fda6d-69c8-4270-a358-8541c410e1c4` |

⛔ **OPERATOR SAFETY — CARRIED FORWARD FROM L-4, NOT OPTIONAL.** The pending step is
**outward-facing and irreversible**. L-4 did **not** click *"Approve this step"*; it settled with
**"Do not run it" + Send Answer**, which is non-destructive and exercises the identical answer path.
**Hold that same discipline here.** If the armed step is outward-facing, decline it — a row that
sends a real email to prove a button works has bought its evidence at the wrong price.

---

## Arm 1 — the blocker, re-driven

**What to do:** arm a real workflow approval on the fixture above and let the run reach the pause.
Look at the **chat thread**, not the panel.

⛔ **SCORE BY POSITION AGAINST THE PANEL EDGE, NOT BY `data-testid` PRESENCE.** L-4's whole finding
was that the controls **existed** and were **all inside the panel** — a testid sweep of the chat
column returned nothing, and a testid sweep of the page would have returned everything. Measure
exactly as L-4 did: read the panel `<aside>`'s own `left`, then each control's `left`.

L-4's measurement, for comparison (`aside.left = 1082`):

| Control | measured `left` | verdict |
|---|---|---|
| `Approve this step` | 1103 | IN PANEL |
| `Do not run it` | 1103 | IN PANEL |
| `Send Answer` | 1244 | IN PANEL |
| `anyApprovalControlInChatColumn` | — | **FALSE** |
| `chatColumnHasPausedCue` | — | **FALSE** |

**Record here:**

```yaml
arm_1:
  verdict: pending
  aside_left: pending
  approve_left: pending
  decline_left: pending
  send_answer_left: pending
  anyApprovalControlInChatColumn: pending      # must be TRUE
  chat_column_renders_the_question: pending
  screenshot: pending
```

⚠ **`chatColumnHasPausedCue` is a SEPARATE reading and is NOT expected to flip on this path.**
`PausedRunCue` stayed at message level by decision (it marks the ROW that paused, which a workflow
pause does not have). If it reads FALSE while the controls read TRUE, that is the built behaviour,
not a miss — record it as an observation rather than a failure.

---

## Arm 2 — both directions settle

**Direction 1 — answer from the THREAD.** Click the decision in the chat column (declining, per the
safety rule), then **read the panel's rendered SENTENCE** with **no manual refresh**. ⛔ Read the
words, not a testid: *"a test pinning a value proves the value is right, not that anything uses it"*
is this project's own recorded lesson, and it is the reason G-6 shipped green.

**Direction 2 — answer from the PANEL.** Arm a second approval. Settle it in the **panel**. Back in
the thread, the controls must be **gone** and the row must read settled.

**The third home.** Open `WorkflowRunPage` for the same run and confirm it still renders its own
`PendingAskCard` correctly (`D-244-13`: this is a cross-surface shell — one change lands in three
places, and only two of them were touched here).

⚠ **NEITHER DIRECTION WAS REACHED AT L-4**, because there were no chat-side controls to compare
against. Both are genuinely new evidence.

```yaml
arm_2:
  verdict: pending
  thread_to_panel_settles_without_refresh: pending
  panel_sentence_read: pending                  # quote the words, not a testid
  panel_to_thread_clears_controls: pending
  thread_row_reads_settled: pending
  workflowrunpage_third_home_ok: pending
  settled_with: pending                          # MUST be "Do not run it" if outward-facing
  screenshot: pending
```

---

## Arm 3 — the G-2 order, on screen

On a live **tool-bearing** turn, read the document order of the three blocks. Expected:
**tool-call container → thinking badge → answer**.

⛔ **PRESENT THIS TO THE OPERATOR AS AN OVERRIDE AWAITING CONFIRMATION, NOT AS A FIX.** It
contradicts a rationale the operator approved at Phase 243 (*"ORDER IS THE ORDER IN TIME — above the
run card's tool rows and above the answer"*), and was changed on that same operator's live direction
during 244's UAT (*"the thinking badge it's recommended to be below the container of the tools not
above"*). **A re-reversal later is cheaper than a silent disagreement** — ask.

```yaml
arm_3:
  verdict: pending
  order_observed: pending          # e.g. "tools -> thinking -> answer"
  operator_confirms_override: pending
  screenshot: pending
```

---

## What a PASS on this row does and does not mean

- **Does:** SHELL-03 / `BUG-260828-07` closes — a workflow-raised approval is answerable from the
  chat thread, and answering in either home settles both.
- **Does NOT:** say anything about the Deep-mode `ask_user` path, which remains undriven (above).
- **Does NOT:** retire the cost recorded in `docs/HOT-FILE-LEDGER.md` — the list-level mount buys a
  measured **+4 fetches per thread open** (`getThreadPendingAsks` 0→2, `getThreadWorkflow` 1→3),
  accepted deliberately and re-openable if it is ever felt.
