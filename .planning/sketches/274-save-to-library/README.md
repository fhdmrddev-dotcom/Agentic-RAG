---
sketch: 274
name: save-to-library
question: "How does a person keep a chat file, on purpose, and see that they did?"
winner: "A — Menu on the chip (operator, 2026-10-05)"
tags: [chat, attachment, promote, library, folder-picker, dedup, phase-274, att-03]
phase: 274
requirements: [ATT-03, ATT-01]
decisions: [D-05, D-07, D-09, D-10, D-11, D-12, D-13, D-14, D-15]
extends: 236-the-file-that-belongs-to-this-chat
---

# Sketch 274: Save to Library

## Design Question

**How does a person keep a chat file, on purpose, and see that they did?**

Sketch 236 made the promise *"this chat only"*. 274-CONTEXT D-09..D-14 lock what the action
does: it **copies** the file into a **required** folder through the shipped minter. The thread keeps
its attachment, and the chip then says the file is also in the Library. This sketch decides how
that looks: the **action**, the **folder choice** and the **after-state**.

## How to View

```
open .planning/sketches/274-save-to-library/index.html
```

## Variants

Each variant is a full direction; cherry-picking across them is expected.

- **A: Menu on the chip.** An always-visible `⋯` inside the chip opens *Save to Library… / Open in panel*.
  The dialog is a **searchable list of full folder paths**. Afterwards the chip gains a green
  **`✓ In Library · Pricing`** segment.
- **B: The word on the chip.** `Save to Library` is written beside the chip at low emphasis. The
  dialog is the **folder tree**. Afterwards a **sibling chip** with the Library's amber folder icon
  shows the full path and links to the document.
- **C: Icon + plain picker.** One icon button with a tooltip. The dialog is the **shipped `Select`
  pattern minus Root**, with full paths. Afterwards **one line under the message**:
  `Saved to Library · Suppliers › Meridian › Pricing · Open it`.

## States (second bar)

| State | What it answers |
|---|---|
| Sent | The chip at rest. ⚠ It now reads `this chat only` with **no `24h`** (D-05/D-07) |
| Action offered | Is the action findable without hover? (touch has no hover: the 034 a11y lesson) |
| Pick a folder | Confirm is disabled until a folder is chosen; **no Root option** (D-10) |
| Same name → v2 | D-14's warning, said **before** confirming |
| Saved | The after-mark. Live flow shows `· indexing…` first: the row exists before search can find it |
| Same file already there | D-13: nothing new saved; says **where** the existing copy is, even if another folder was picked |
| Refused (not your folder) | The minter's own 403, verbatim, under a plain lead line (D-12) |
| Panel · Files | The second mount (D-09). The agent-written file gets **no** save action |

## What to Look For

1. **Findability vs. calm.** A hides the verb one click deep; B writes it out; C is an icon. Which
   would a person find on the first try, and which stays quiet in a long transcript?
2. **Folder choice at real scale.** A real Library has dozens of folders. The search list (A) and
   the tree (B) scale; the plain `Select` (C) is the cheapest build but breaks past ~30 entries
   (the 035 lesson).
3. **The after-state a day later.** Which one tells you, on reopening the chat, that this file is
   also in the Library *and where*? A's segment shows only the leaf folder (the full path is in the
   tooltip); B and C show the full path.

## ⚠ Findings this sketch surfaced (not design opinions)

1. **`MoveToFolderDialog` cannot be reused as-is,** even though D-10 names it. It is a flat
   `Select` that calls `moveDocument` directly, and it offers **"Root (no folder)"**
   (`frontend/src/components/health/MoveToFolderDialog.tsx`). `UploadFolderPicker` has the same
   Root sentinel. The build needs a picker **without Root** that returns a folder id and leaves the
   commit to the caller. Every variant here is that shape. ⇒ **Amend D-10** to "a folder picker with
   no Root option", built on whichever variant wins.
2. **"Saved" is not "searchable".** The minter creates the row immediately and ingestion runs after.
   A G-4 drive that searches right after saving reads empty and calls it a bug, so the after-mark
   carries `indexing…` until the row is ready.
3. **The same-file case can only be known after confirm**, unless the promote route pre-hashes the
   attachment. The sketch draws it as a result screen after confirm, which is honest either way.

## Build Contract

`COPY.js` declares every string. **Port it; do not re-type.** Engine facts are real
(`REFUSE_NOT_OWNER` = `ingest_splice.py:173`). The promote route and the mark's persistence are
**net-new** and flagged as such in `COPY.js`.

Ordered composition the build must reproduce:

| Block | Required atoms |
|---|---|
| Sent message chip row | file chip (icon · name · size · `this chat only`) · the variant's action · the variant's after-mark |
| Dialog | title · one-line sub · file chip · folder picker (no Root) · version warning / refusal slot · `[required hint]` Cancel + `Save to Library` (disabled until picked) |
| Already result | title · where it already lives (folder chip) · picked-elsewhere line when it differs · Done + Open it |
| Panel Files row | icon · name · `size · this chat only` · action or after-mark; agent files: no action |

## WINNER — A: Menu on the chip

**Operator, 2026-10-05.**

- **Action:** an always-visible `⋯` inside the attachment chip (touch-reachable, `aria-label`,
  `aria-haspopup="menu"`), opening *Save to Library… / Open in panel*. The same `⋯` is on the panel's
  Files row, where the menu offers only the verb.
- **Folder choice:** a **searchable list of full folder paths** (parent dim, leaf bold), single
  select, **no Root**. Confirm stays disabled until a folder is picked. ⚠ The list is a listbox, so
  it needs combobox/listbox a11y (`role=listbox/option`, `aria-selected`, keyboard), the same
  obligation as 035-A's typeahead.
- **After-state:** the chip gains a segment: green `✓ In Library · <leaf>` (saved) or primary
  `Already in Library · <leaf>` (same bytes elsewhere), with the full path in the tooltip and a link
  to the document. It shows `· indexing…` until the document is searchable. ⚠ Only the leaf is
  visible, so the tooltip must not be the only place the full path is readable. The panel row and
  the document link both expose it.
- **Kept from every variant (not variant-specific):** the version warning before confirm (D-14),
  the already-there result screen that names where the copy is (D-13), the verbatim 403 under a
  plain lead (D-12), and no save action on agent-written files (D-09).

**Not taken, recorded:** B's written verb + folder tree + sibling chip; C's icon + plain `Select` +
under-message line. ⚠ **If UAT shows people don't find the `⋯`, B's written verb is the cheapest
single addition.** It composes with A's dialog and segment.
