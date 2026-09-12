# 244-13 — the browser row `SHELL-02` actually closes on (UAT gap G-1 + review WR-07)

```yaml
plan: 244-13
requirement: SHELL-02
gap: G-1
also_closes: WR-07 (244-REVIEW.md, open at this round's start)
severity: major
status: pending
driven_by: pending
driven_on: pending
verdict: pending
```

⛔ **THIS PLAN DID NOT CLOSE `SHELL-02` AND MUST NOT BE READ AS HAVING DONE SO.** `D-244-14` /
`D-244-19`: a requirement closes on a **driven row**, not on a fence. Everything `244-13` shipped
is a jsdom fence plus a type change; **a jsdom mount cannot lay out, cannot run a real reload, and
cannot tell you whether the server re-locks the thread on the next reconcile.** This file is the
row `/gsd:verify-work` drives in a real browser.

⚠ **Solo run (`D-244-21` / `OV-SOLO-01`):** Gemini is unavailable, so the build was
**SELF-verified**. There is no independent reviewer standing behind the three arms below.

⛔ **Every verdict field below reads `pending`. Nothing here was driven by the executor.**

---

## What changed, in one paragraph, so the driver knows what they are looking at

`WorkflowLock.mode` was the single-member literal `"harness"`, hard-coded at all six write sites —
including the branch that locks a **DEEP** run paused at its iteration cap. It is now a real
discriminator (`"harness" | "cap_paused"`) set from the server's own `ThreadWorkflowState.mode`,
and three **presence** tests became **mode** tests: `useHarnessLiveForThread` (the run line),
`MessageItem`'s banner branch (the harness banner + its `getThreadWorkflow` fetch), and
`ChatArea.tsx:140` (the composer lock — `WR-07`).

---

## Setup — ⛔ the cap state is SEEDED, and that is recorded rather than hidden

⚠ **NO `cap_paused` RUN HAS EVER EXISTED ORGANICALLY IN THIS LOCAL DB.** Measured during the UAT
that found this gap: `runs` by status = **completed 1293 / failed 171 / cancelled 53 / timed_out 8
/ `cap_paused` 0**. A genuine cap fire needs 15 tool-calling iterations **and** the model to
disobey `tool_choice="none"` at the final one (`agent_loop.py:2104` `force_no_tools` + `:2575`).

So: drive a **REAL Deep run** in the browser, then set its `runs` row to
`status='cap_paused'`, `continues_used=3` and insert the `role='system'` carrier row — **the exact
rows `agent_loop.persist_cap_paused` writes**. Everything downstream of that value
(`threads.py`'s read, the thread lock, `ChatArea`'s boolean, the POST path) is untouched product
code.

⛔ **WHAT THIS ROW THEREFORE DOES NOT PROVE: that the cap FIRES correctly.** That is Phase 092's
criterion, not `SHELL-02`'s. Say *"a thread in the cap-paused state behaves correctly"*, never
*"the cap works"*.

⚠ **`continues_used=3` is load-bearing for Arm 1 step 3:** the card renders the **Continue-limit**
sentence only when continues are exhausted, and the **iteration-limit** sentence otherwise
(`MessageItem.tsx:776-778`). A seed with continues left pins the wrong sentence.

⚠ **The seeded fixture from the first UAT may still exist** — thread `68818c2a-ddde-4ce6-9945-
f87e0ac12d1c` ("Ready"), run `05fea6e9-824e-4060-8b5c-ca50a5136be3`. Verify its `status` and
`continues_used` before reusing it; do not assume.

---

## Arm 1 — `G-1` is CLOSED: the phantom is gone

⛔ **Assert in ONE `getBoundingClientRect` pass, because the defect was the two things being on
screen TOGETHER.** Asserting each separately is consistent with a product that never shows them
together, which is the whole reason the original observation is worth reproducing rather than
paraphrasing.

| # | Step | Expected | Verdict |
|---|---|---|---|
| 1 | Open the cap-paused Deep thread from the chat list | the amber Continue card renders | `pending` |
| 2 | `document.querySelectorAll('[data-run-line-state]')` | **length 0** — no run line at all, live or stopped | `pending` |
| 3 | Sweep every leaf element for `/Starting workflow|Working on phase|phases? done/i` | **zero** matches | `pending` |
| 4 | Read the Continue card's text | verbatim `Reached the Continue limit — this run is stopped. Start a new message to keep going.` ⚠ **THIS SENTENCE IS MODE-DEPENDENT SINCE `244-14` (WR-01)** — it is the DEEP wording and this arm is a Deep thread, so it is still exactly right here; a HARNESS cap-pause reads the Cancel wording instead (Arm 4 step 2b). Reading the harness sentence on THIS thread is a failure, not a variant. | `pending` |
| 5 | ⛔ **In the SAME rect pass as 4:** confirm no element carries `data-run-line-state="live"` | the card is on screen AND the phantom is not | `pending` |
| 6 | Instrument `window.setInterval` **before** opening the thread; open it; wait 5 s | **no** call registered with a `1000` ms delay (the provider's 5000 ms stream watchdog is expected and is NOT this) | `pending` |
| 7 | Count `GET /threads/{id}/workflow` calls across the thread open (Network panel or a `fetch` counter) | ⚠ **RECORD THE NUMBER rather than asserting one.** `ThreadRunLine` legitimately makes one; what must be gone is the **per-assistant-row** cost `HarnessOuterBanner` added on the Deep path. Compare against the same count on an ordinary Deep thread with no lock — they should MATCH. | `pending` |

⚠ **Step 7's shape is deliberate.** The jsdom fence (`D3`) asserts a **delta of zero** over the
streaming row's mount, which is the precise claim; a raw absolute count in a browser also picks up
the panel, the run line and any reconcile, and an absolute number would be pinned to a layout
rather than to the defect.

---

## Arm 2 — the REAL one still works (the anti-regression half)

⛔ **A fix that silences the phantom by silencing the genuine run is not a fix**, and it would pass
Arm 1 perfectly. `L-3` is the reading that must not be traded away.

| # | Step | Expected | Verdict |
|---|---|---|---|
| 1 | Launch a genuine published workflow into a thread (the `200-Word Essay Writer` fixture works) | a run starts | `pending` |
| 2 | Read the run line | present, `data-run-line-state="live"` | `pending` |
| 3 | Watch it for ~30 s | the step segment **ADVANCES** (`Step N of M` climbs) and the elapsed figure climbs | `pending` |
| 4 | Read the composer's **placeholder** | verbatim `Workflow running — Cancel to switch back` | `pending` |
| 5 | Read the composer's **`title`** attribute | the same sentence, byte-for-byte (`D-244-10` — BOTH axes) | `pending` |
| 6 | `textarea.disabled` | `true` | `pending` |

---

## Arm 3 — `SHELL-02`'s shipped half is preserved

⚠ This is `L-2`'s six steps re-driven. They PASSED before this round and must still pass; the
round's own fix is Arm 1, and Arm 3 is what proves it was not bought with the half that already
worked.

| # | Step | Expected | Verdict |
|---|---|---|---|
| 1 | On the cap-paused Deep thread, perform a **REAL reload** | `performance.getEntriesByType('navigation')[0].type === "reload"` | `pending` |
| 2 | Read the composer | `disabled=false`, `readOnly=false`, `aria-disabled=null`, placeholder `Ask anything…` | `pending` |
| 3 | Type a prompt — ⛔ **by element ref**, and assert `textarea.value` **BEFORE** pressing Return | the typed text is in the box | `pending` |
| 4 | Press Return | a **NEW** `runs` row is minted and its answer streams into the transcript | `pending` |
| 5 | Navigate Chat → Library → Chat and reopen the thread | the composer is still enabled; the lock does **not** return | `pending` |
| 6 | Sweep for the Continue-limit sentence | still rendered (⛔ the ROADMAP's named ANTI-FIX is deleting it) | `pending` |

⚠ **STEP 3'S WORDING IS A SCAR, NOT PEDANTRY.** `L-2`'s first attempt recorded *no new run* and it
was a **HARNESS MISS, not a product defect**: the viewport changed (1568×710 → 1536×639) and a
click at fixed coordinates landed outside the textarea, so nothing was typed. **A mis-click
published as a defect is exactly what this project keeps paying for.** Drive by element ref and
assert the value before committing.

---

## Arm 4 — `WR-07`, if and only if it can be reached honestly

⚠ **`WR-07`'s reconcile route is LATENT: no writer of `'cap_paused'` onto `workflow_runs.status`
was found.** ⛔ **Do not seed one just to tick this arm** — seeding a value the product never
writes measures the seed, not the product. The SSE route (a harness run hitting its own iteration
cap) is the reachable one, and reaching it needs a workflow whose step actually caps.

| # | Step | Expected | Verdict |
|---|---|---|---|
| 1 | If a harness run can be driven to a cap in reasonable time: do so | the Continue card appears on a workflow thread | `pending` |
| 2 | Read the composer | still **DISABLED**, still `Workflow running — Cancel to switch back` on both axes | `pending` |
| 2b | ⛔ **ADDED BY `244-14` (WR-01), and it is the half step 2 could not see.** In the SAME rect pass as step 2, read the Continue card's sentence | verbatim `Reached the Continue limit — this run is stopped. Cancel the workflow to start something new.` ⛔ Seeing `Start a new message to keep going.` here is the defect: the transcript would be instructing the one action the composer beside it forbids. | `pending` |
| 3 | If step 1 is not reachable | ⛔ record **BLOCKED with the reason** — never silently omit the arm (a scoreboard that lists only what passed is not a scoreboard). The jsdom fences are `ChatArea.capPausedComposer.test.tsx` D5 and `ThreadRunLineKickoff.test.tsx` D5b(a). | `pending` |

---

## What a PASS on this row does and does not buy

- **Does:** `G-1` closes; `WR-07` closes on its reachable route (or is recorded blocked with a
  reason); `SHELL-02` closes, having been **built** by `244-03` and **corrected** by `244-13`.
- **Does NOT:** say anything about whether the iteration cap FIRES correctly (Phase 092), about
  the Deep-mode `ask_user` path (never driven — see `G-6`'s `scope_limit`), or about the six
  findings this round deferred (`deferred-items.md` § `244-13`).
