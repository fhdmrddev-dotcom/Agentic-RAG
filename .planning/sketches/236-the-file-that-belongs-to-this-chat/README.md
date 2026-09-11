---
sketch: 236
name: the-file-that-belongs-to-this-chat
question: "How does a person know a file is HERE, not in the Library?"
winner: "A — Scope on the chip (operator, 2026-09-11)"
tags: [chat, composer, attach, ingestion, scope, phase-244, shell-04]
phase: 244
requirements: [SHELL-04]
decisions: [D-244-01, D-244-02, D-244-03, D-244-04, D-244-05, D-244-06, D-244-18]
---

# Sketch 236: The file that belongs to this chat

## Design Question

**How does a person know a file is HERE, not in the Library?**

`BUG-260905-01` is the operator's own sentence: *"Anything in the chat should stay temporarily in
that thread, not in the Library itself."* Phase 244 makes that structurally true —
`D-244-01/03` put the bytes in `workspace_files` with no `documents` row at all, so there is nothing
for retrieval to find. **But structural truth is invisible.** The person dropping a file in sees a
menu, a chip and a sent message; nothing else. This sketch asks where the promise gets *said*.

⛔ The ROADMAP's named failure for `SHELL-04` is *"a local attach ships that quietly writes to the
Library anyway — `SEED-042`'s 'not in the KB' half is the point."* The mirror failure is just as
bad and is what this sketch is really guarding against: **the code is right and the surface still
reads as permanent**, so the person never trusts chat with a file and keeps using the Library door.

## Why only one sketch

`D-244-18`. G-2 fires narrowly on Phase 244, and the ROADMAP names *two* net-new surfaces —
`SHELL-04`'s destination moment and `SHELL-05`'s shell signal. **That is wrong by one:**
`SHELL-05`'s signal shipped at Phase 235 plan 09 (`attentionConditions.ts`, `AttentionPopover.tsx`,
badged on the desktop rail, the mobile drawer and the hamburger, three suites). Sketching it would
be redrawing a surface the operator already approved. `SHELL-01/02/03` are bug fixes on shipped
surfaces with named causes and need no sketch — **said explicitly, rather than sketching everything
or nothing.**

## How to View

```
open .planning/sketches/236-the-file-that-belongs-to-this-chat/index.html
```

## Variants

- **A: Scope on the chip** — the `+` menu stays plain (*"Attach a file"* / *"From cloud storage"*)
  and says nothing about destination. The **chip** is the only place that says
  *"this chat only · 24h"*, so the promise is made where the file actually is and **travels with it
  into the sent message**.
- **B: The door names it** — the menu carries a header (*"Add a file to this chat"*) and a footer
  (*"Files here stay in this chat. The Library is for files you keep."*); the modal repeats the
  destination as a chip. The **attachment chip then carries only the file** — no scope word,
  because it was already said.

The fork in one line: **A says it late and repeatedly; B says it once, early, and trusts it.**

## What to Look For

Switch variant on the **same state** and compare *only the words*. The states are on the second bar:

| State | What it answers |
|---|---|
| **Rest** | The composer before anything happens |
| **Menu open** | Does the menu tell you where a file goes — or not? |
| **Destination moment** | The cloud modal. B names the thread in it; A does not |
| **Attached, not sent** | ⭐ **The decisive frame.** A: `Meridian-Q4-pricing.xlsx · 84 KB │ this chat only · 24h ×`. B: `Meridian-Q4-pricing.xlsx · 84 KB ×` |
| **Sent · agent used it** | Does the scope survive into the transcript, a day later, when the menu is long forgotten? |
| **Refused (.pdf)** | See the finding below |
| **Expired (24h)** | What a person finds when they scroll back after the TTL |

Three specific things:

1. **The attachment chip sits in the composer's EXISTING chips row** — `ActiveConnectorChips`
   (`MessageInput.tsx:321-327`) already renders there. The sketch shows the new file chip beside a
   dashed connector chip deliberately, so you can judge whether they read as siblings or as clutter.
2. **The sent message.** A's scope word rides into the transcript; B's does not. A person reopening
   this chat tomorrow sees only what is in the message — which is the honest test of *"say it once."*
3. **Is `this chat only` reassuring, or does it introduce a doubt that was not there?** This is the
   *"text is noise / the purpose must survive"* fork at its sharpest. B is the braver cut.

## ⚠ Findings this sketch surfaced, which are not design opinions

**1. `.pdf` IS NOT ACCEPTED, and a PDF is the most likely first file anyone attaches.**
`_ALLOWED_EXT` (`backend/app/api/workspace.py:124-130`) is OOXML (`.docx .pptx .xlsx`) ∪ seven text
types ∪ five image types — **fifteen extensions, no PDF.** A person reviewing a supplier contract
will reach for the signed PDF first and be refused with the server's own sentence:

```
Unsupported type .pdf. Allowed: .csv, .docx, .gif, .jpeg, .jpg, .js, .json, .md,
.png, .pptx, .py, .sh, .txt, .webp, .xlsx
```

That refusal is drawn as its own state rather than left for a build to improvise. ⛔ **This is a
scope question for the plan, not for the sketch:** either the phase accepts the gap and the refusal
copy has to be good, or `_ALLOWED_EXT` gains `.pdf` — which is a real decision, because the door was
built for **workflow templates** (`kind='template_input'`), not for conversation, and `pypdf` is in
the sandbox image while nothing in `workspace.py` validates a PDF container. **It is not free and
must not be assumed either way.**

**2. The chip needs an expired state, and the TTL is a read gate rather than a delete.**
`D-244-04`: the four workspace GET routes apply a PostgREST expiry filter, so after
`template_ttl_hours` (24) the row **survives invisibly** and the file simply stops resolving. A
transcript from last week therefore contains a chip pointing at nothing. The `Expired (24h)` state
draws what that should look like — struck through, dashed, *"No longer available"* — rather than a
broken link or a silent disappearance.

**3. The menu currently has exactly one file item, and it is the wrong one.**
Today: `"Import from Cloud Storage..."` gated on `hasCloudStorage` (`MessageInput.tsx:363-379`).
Both variants replace it with **two** items and re-point the cloud one at the thread (`D-244-05`).
⚠ The `hasCloudStorage` gate means **the cloud item is absent entirely for a person with no cloud
connection** — so the local item must stand alone and read correctly on its own. Both variants are
drawn with both present; a build must check the one-item case.

## Build Contract

`COPY.js` declares every string this sketch renders — the sketch renders nothing that is not in it.
**Port the object; do not re-type strings out of this README or the HTML** (the
`feedback-sketch-to-build-drift` rule). Engine facts in `COPY.engine` are read from the shipped
source and are real: `ALLOWED_EXT`, `MAX_MB`, `TTL_HOURS`, `PLUS_BTN_TESTID`, and the server's three
422 sentences.

⚠ **A text contract is not enough on its own** — the 2026-08-29 correction to that rule recorded 200
green assertions over a surface the operator called *"nothing at all like what we designed."* So the
composition is named here too, as the ordered blocks a build must reproduce:

| Block | Required atoms |
|---|---|
| Composer chips row | file chip (icon · name · size · [scope] · remove) rendered **in the existing `ActiveConnectorChips` row**, not a new region |
| `+` menu | local item · cloud item · connectors item, in that order; `[header]` and `[footer]` only in B |
| Cloud modal | title · source line · `[destination chip]` (B only) · file list with single-select · cancel + confirm |
| Refusal | filename · the server's verbatim 422 sentence · dismiss |
| Sent message | the chip in read-only form above the user's text · the agent's one-line `Read <file>` pointer |

The business scenario (*Q4 supplier pricing review*, Meridian) is **deliberately authored** so the
wording question is readable; the engine facts around it are real.

## WINNER — A: Scope on the chip

**Operator, 2026-09-11.** The scope word lives on the chip; the `+` menu stays plain.

**What A buys, and what it therefore obliges:**

- ⭐ **The promise is made where the file is, and it SURVIVES.** A menu is read once and closed; a chip
  is on screen while the person types, and it rides into the sent message. Reopening the chat tomorrow,
  the transcript still says `this chat only` — B's footer is long gone by then. That durability is the
  reason to prefer A, and it is also the thing a build can get wrong silently: **the scope word must be
  rendered by the SENT message, not only by the pending composer chip.**
- **The menu stays plain**, which keeps the `+` dropdown short and leaves the `hasCloudStorage`
  one-item case reading correctly with no orphaned header or footer.
- ⚠ **The cloud modal therefore says nothing about destination either** (B's destination chip is not
  taken). The confirm button is the last moment before the file exists, so it must not read as a
  Library action — keep A's `Attach`, and ⛔ never `Import`, which is the word the Library door uses.

**Not taken, recorded rather than dropped:** B's menu header `Add a file to this chat`, its footer
`Files here stay in this chat. The Library is for files you keep.`, and its in-modal destination chip.
They remain in the file under tab B and in `COPY.js` under `COPY.b`. ⚠ **If UAT shows people still
expect the Library, B's footer is the cheapest single addition** — one line, no layout change — and it
composes with A rather than replacing it.

**The three findings in this README are unaffected by the choice** and still route to the plan: the
`.pdf` gap, the expired-chip state, and the one-item menu case.
