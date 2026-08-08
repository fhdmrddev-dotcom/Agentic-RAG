---
sketch: 156
name: adding-a-connection
question: "How does the create form make 'where this sends' and 'what we hold' honest — and how do the two refusals land?"
winner: null
tags: [settings, connections, connectors, phase-190, secrets, egress, refusal, fail-closed]
phase: 190
---

# Sketch 156: Adding a connection

## Design Question

The container fork is the visible question: **push/split panel · dialog · inline expand.**

The real question is underneath it. This form is where three of Phase 190's decisions either
become legible or stay invisible:

- **D-11** — `get_cipher()` fails **open** for `app_settings` (D-150-01), and 190 deliberately
  **inverts that to fail-CLOSED** for a tenant credential. That inversion is a decision, not a
  bug — so it has to *read* as a decision, in the form, at the moment it bites.
- **D-07** — the egress guard refuses a destination before any credential is read. When it
  refuses, the person who typed the host has to understand what happened and what it cost.
- **D-26** — with `live_connectors` off, a connection still saves and still binds; it just never
  sends. The form has to say that without pretending the save failed.

## How to View

```
open .planning/sketches/156-adding-a-connection/index.html
```

Use the **moment** dropdown — ten states, in the order a person meets them.

## Variants

- **A: Push/split panel** — 400px right-side panel, list stays visible (the 140-A `PhaseFormPanel`
  and 037-A rule-builder lineage; the path of least resistance in this codebase).
- **B: Dialog** — the `MoveToFolderDialog` shell (035-A). Focus-trap and restore come free.
- **C: Inline expand** — the row grows in place; no second surface at all.

**The form content is byte-identical in all three** — verified in-page
(`aEqualsB: true, aEqualsC: true`). That is deliberate: the comparison is about *placement*, so
no variant can win by happening to tell more truth than another.

## What to Look For

**The two refusals are the reason this sketch exists.** Compare moments 8 and 9:

| | 8 · egress refused | 9 · no encryption key |
|---|---|---|
| Cause | the host you typed resolves to `10.4.2.19` | the platform has no `SECRETS_ENCRYPTION_KEY` |
| Can you fix it? | **yes** — correct the host | **no** — nothing you type helps |
| So the Save button | stays **enabled**, with *"Correct the host and try again"* | goes **disabled**, with `aria-describedby` pointing at the reason |

That asymmetry is a finding, not an inconsistency: **a refusal you can fix leaves the door open;
a refusal you cannot fix closes it.** Both follow the 142-B rule — name the cause, name what the
refusal *costs* you, and put the reason in real DOM text, never a `title`.

Also worth pushing on:

- **Moment 2 (Slack) vs 3 (SMTP).** Slack has *nothing to type* — D-02 makes its host a code
  constant. The form says so out loud (*"it cannot be pointed anywhere else, by you or by a
  workflow"*). Does that read as reassuring, or as the form being coy about what it does?
- **Moment 7 (editing) — the write-only secret.** `•••••••• stored 3 Aug · [Replace]`, never the
  value, with the reason stated: *"never sent back to this browser — not to you, not to an admin,
  not to the workflow author who picks this connection."* Compare against how it looks on create.
- **Moments 4→5→6 — the check.** This is the recommendation you approved: the check runs on the
  **stored** connection, not the typed form, so no plaintext secret crosses the wire for a
  non-storage purpose *and* the check exercises the same org-scoped resolver D-14 protects.
  Moment 5's headline is the load-bearing sentence: **"Credential works — and nothing was sent."**
  Moment 6 renders the host's error **verbatim**, inheriting the 071-A verbatim-provider-error rule.
- **The always-on 🔒 destination footer** updates as you type and is never behind an Advanced
  disclosure — this is 024-A's cure for BUG-260616-01 (a silently mis-routed endpoint), applied
  to a destination instead of a model.
- **The org-shared line** at the foot of the fields. D-12 makes a connection org-shared with no
  per-user variant and no cross-org escape — the branch SEED-125 had to close for skill files.
  The form states it as a property, since the person creating it is authorising their colleagues.
- **Container-specific:** does the dialog (B) trap you at moment 6, when the honest next action is
  to go look at the list? Does the inline expand (C) survive the notice blocks growing the row to
  ~400px tall? Does the panel (A) still work at 375px width (toolbar viewport buttons)?

## Grounding

- Refusal copy never contains the credential — D-08 (*capability, host and reason; never the
  secret, never the body*). Check moment 8: it names the host and the resolved IP, nothing else.
- Moment 8's refusal explicitly states it happened **before** the password was read. That is the
  n8n CVE inversion (D-06) told in user-facing words: the guard does not depend on a credential
  being present.
- Moment 10's wording reuses the shipped `recorded_not_sent` vocabulary verbatim — *"Not sent —
  recorded"* (D-17 / migration 115), rather than inventing a second phrase for the same state.

## Open Questions

- **Is the check a `POST /connectors/connections/{id}/check`, or a query param on the read?**
  Sketch assumes a dedicated action because it has a side effect (it writes `last_checked_at`).
- **What blocks a step from using a `check`-failed connection?** Moment 6 claims *"no step will be
  allowed to use it until this passes"* — that is a **claim the sketch makes that the backend does
  not yet honour**, and it is either a real gate at bind/publish time or the sentence must go.
- **Where does the check result live?** Sketch 155's table has a `Credential` column reading
  `checked 2 days ago` — so the check needs a persisted timestamp and verdict on
  `connector_connections`, which is a column decision for migration 116.
- **`Replace` on the stored secret** — does replacing invalidate the last check verdict? It should.
