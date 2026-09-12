# 244-15 — the browser row that G-8 actually closes on

```yaml
plan: 244-15
gap: G-8
closes: SHELL-03
severity: major
status: pending
driven_by: pending
driven_on: pending
```

⛔ **THIS PLAN DID NOT CLOSE SHELL-03 AND MUST NOT BE READ AS HAVING DONE SO.** `D-244-14` binds:
*"`BUG-260828-07` is severity HIGH and closes on a DRIVEN row, not a fence."* Every assertion
`244-15` added is a **jsdom mount over a mocked API**. They prove the settle path does what it
claims **when handed a wire shape**; **not one of them proves the product hands it that shape**, and
a jsdom mount cannot observe two sibling surfaces disagreeing after a real network round trip —
which is exactly what the operator saw. The two-homes cases mount two `PendingAskStack` instances in
**one process, one store, one synchronous scheduler**: that is a MODEL of two surfaces, not two
surfaces.

⚠ **The precedent is not hypothetical.** `244-03` shipped a green mount fence over this exact
blocker and the operator found it live nineteen plans later. `244-12` then shipped fences proving the
approval **MOUNTS**, and the half that broke was whether it **ANSWERS** — which is this row.

⚠ **Solo run (`D-244-21` / `OV-SOLO-01`):** Gemini is unavailable, so this build is
**self-verified**. There is no independent reviewer standing behind the five arms below; driving them
is the first genuinely independent check this change receives.

⚠ **SCOPE, carried verbatim from `244-12` and NOT widened.** Only the **WORKFLOW** path was ever
proven broken. The **Deep-mode** `ask_user` path was never driven and may well have worked all along
(it receives the `ask_user_response` SSE, which is the mechanism this plan substitutes for). Say
*"the workflow-raised approval does not settle across homes"* — never *"the inline approval is
broken"*.

---

## What was built (so the row knows what it is testing)

| | |
|---|---|
| The ask half | `PendingAskStack` calls the `reconcile()` it already held → one GET → `replacePendingAsksForThread` → **one** shared store key → **both** homes drop the card |
| The lock half | `releaseSettledWorkflowLock` re-reads `GET /threads/{id}/workflow` and RELEASES a lock the server has already dropped. ⛔ It never SETS one |
| Fail-closed | A **live anchor** (`locked && !lock_is_stale && active_workflow_run_id`) or **`cap_paused`** releases NOTHING and re-attaches the producer stream instead |
| The third home | `WorkflowRunPage` mounts `PendingAskCard` **directly**; the new callback is optional and it does not pass it → behaviourally byte-unchanged |

---

## Fixture

The same one `L-4` and `R2-4` used, so the three rows are comparable rather than merely similar:

| | |
|---|---|
| Workflow | **200-Word Essay Writer** |
| Armed step | step 2, `"act"`, marked **needs-approval** |
| Pending action | `send_email` over SMTP |
| Thread `L-4` drove | `0d8fda6d-69c8-4270-a358-8541c410e1c4` |

⛔ **OPERATOR SAFETY — CARRIED FORWARD IN FORCE, NOT OPTIONAL.** The pending step is
**outward-facing and irreversible**. Both `L-4` and `R2-4` settled with **"Do not run it" + Send
Answer** and never clicked *"Approve this step"*. **Hold that same discipline here.** A row that
sends a real email to prove a button works has bought its evidence at the wrong price.

---

## Arm 1 — THREAD → PANEL

**What to do:** arm a real workflow approval, let the run reach the pause, answer in the **CHAT
column** (declining), then read the **PANEL** with **no manual refresh** — at the moment, and again
at **~30 s**.

⛔ **SCORE BY THE RENDERED SENTENCE AND BY POSITION AGAINST THE PANEL EDGE.** Read `aside.left`
first, then each control's `left`, exactly as `R2-4` did. ⛔ **Never by `data-testid` presence** —
presence assertions cannot see content drift, and `R2-4`'s panel was still rendering

> *"NEEDS YOU — No deadline — the run is waiting for your answer and will not continue on its own"*

**three minutes after the answer was accepted**. Quote the sentence you read.

`R2-4`'s measurement, for comparison (`aside.left = 1136.8`):

| Control | measured `left` | where |
|---|---|---|
| chat-column controls | 546.8 / 988.4 | CHAT |
| panel copies | 1158.4 / 1298.8 | PANEL |

```yaml
arm_1:
  verdict: pending
  answered_in: chat
  aside_left: pending
  panel_controls_left_at_t0: pending
  panel_controls_left_at_t30: pending
  panel_sentence_read_at_t0: pending      # quote the WORDS, never a testid
  panel_sentence_read_at_t30: pending
  panel_card_gone_without_refresh: pending      # must be TRUE
  settled_with: pending                          # MUST be "Do not run it" if outward-facing
  screenshot: pending
```

---

## Arm 2 — PANEL → THREAD (the mirror)

**What to do:** arm a **second** approval. Settle it in the **PANEL**. Then read the **chat column**,
with no manual refresh, at the moment and again at ~30 s.

⚠ **TWO ARMS, NOT ONE, AND FOR A REASON.** The UAT measured both directions separately and they
failed for one cause — but a row over a single direction is passed by a fix that only works one way,
and nothing would say so. `R2-4` measured all three chat-column controls **still at 546.8 / 988.4 at
+6 s and +20 s**.

```yaml
arm_2:
  verdict: pending
  answered_in: panel
  chat_controls_left_at_t0: pending
  chat_controls_left_at_t20: pending
  chat_column_sentence_read: pending             # quote the WORDS
  chat_controls_gone_without_refresh: pending    # must be TRUE
  settled_with: pending
  screenshot: pending
```

---

## Arm 3 — the run line and the composer, in BOTH directions

**What to do:** after each of Arm 1 and Arm 2, read:

1. `data-run-line-state` on the thread run line — it must **stop being `live`**, and the **clock must
   stop climbing** (read it twice, ≥ 5 s apart, and record both values).
2. The composer — it must become **usable**. At `R2-4` it read **disabled** on *"Workflow running —
   Cancel to switch back"*.

**Record the elapsed time between the answer and the reading.** The release is gated on the server
having dropped the anchor, so a few seconds is expected; **a stuck reading at +60 s is a FAIL**.

⚠ **THE HONEST LIMIT, recorded as a FIELD rather than discovered in triage.** The settle is
**fail-closed**: if the wire still reports the run **live** (or `cap_paused`) at settle time, it
releases **nothing** by design. In that case it re-attaches `latest_producer_run_id` and the shipped
terminal handler releases the lock when the run really ends — but **if the wire reported live AND
carried no `latest_producer_run_id`, the release waits for the next thread switch.** Record which of
those you were in rather than scoring it silently; a fail-closed refusal is the built behaviour, not
a miss.

```yaml
arm_3:
  verdict: pending
  # --- after Arm 1 (answered in chat) ---
  a1_run_line_state_before: pending
  a1_run_line_state_after: pending               # must NOT be "live"
  a1_clock_reading_1: pending
  a1_clock_reading_2: pending                    # must equal reading_1, or be absent
  a1_composer_usable: pending
  a1_seconds_answer_to_reading: pending
  # --- after Arm 2 (answered in panel) ---
  a2_run_line_state_after: pending
  a2_composer_usable: pending
  a2_seconds_answer_to_reading: pending
  # --- the honest limit ---
  wire_reported_live_at_settle: pending          # true/false
  latest_producer_run_id_present: pending        # only meaningful if the above is true
  screenshot: pending
```

---

## Arm 4 — the receipt (what the ANSWERING home is left with)

⚠ **RULED ON HERE RATHER THAN DISCOVERED IN TRIAGE.** Once the settle lands, the **answering card
UNMOUNTS** instead of resting on its green *"Answered · agent resumed"* state. That is **not a
regression invented by this plan** — it is the SHIPPED behaviour of the `ask_user_response` SSE path
(`PendingAskCard.tsx:22`: *"the SSE then removes the prompt from the store, reactively clearing the
card"*), which this change extends to the workflow path that never receives that SSE.

**What to do:** immediately after answering (either direction), **record verbatim what the person
actually sees where the card was.** Do not summarise it and do not judge it — this is the arm that
tells the operator whether the decision was right.

```yaml
arm_4:
  verdict: pending
  answering_home_after_settle: pending           # verbatim: what is there now?
  green_answered_state_visible_at_all: pending   # true/false — and for how long?
  visible_ms_before_unmount: pending
  operator_accepts_the_receipt: pending          # the actual question this arm asks
  screenshot: pending
```

---

## Arm 5 — the third home (regression check)

**What to do:** open `WorkflowRunPage` for the same run. Its own `PendingAskCard` must render
**exactly as it did at `R2-4`**, which measured it **PASS** at `left` 1144 / 1144 / 1288.4 with an
advancing spine.

⚠ `D-244-13`: this is a **cross-surface shell with THREE homes** — one change lands in three places
and only two of them were wired here. The callback is optional and `WorkflowRunPage` does not pass
it, so the claim is that this home is *byte-unchanged in behaviour*; **this arm is what tests that
claim rather than asserting it.**

```yaml
arm_5:
  verdict: pending
  card_renders: pending
  control_lefts: pending                         # expect ~1144 / 1144 / 1288.4
  spine_advances: pending
  answering_here_still_works: pending            # decline, per the safety rule
  screenshot: pending
```

---

## What a PASS on this row does and does not mean

- **Does:** `SHELL-03` closes. A workflow-raised approval is answerable from the chat thread **and
  answering it in either home settles it in both** — ROADMAP `SC#3`, both clauses.
- **Does:** confirm the run line and composer release on the **server's word**.
- **Does NOT:** say anything about the **Deep-mode** `ask_user` path, which remains undriven.
- **Does NOT:** prove the fail-closed arms. Arms 3's `wire_reported_live_at_settle` field exists
  precisely because a green run that never entered the fail-closed branch has said nothing about it.
  The only evidence those arms have is jsdom (Tests 3, 4 and 5).
- **Does NOT:** retire the cost recorded in `docs/HOT-FILE-LEDGER.md` for `244-12`'s list-level
  mount (+4 fetches per thread open). This plan adds **one more GET per answered approval**, bounded
  by the number of answers and fired by an explicit human click — **no timer, no poller**, fenced by
  Test 8.
