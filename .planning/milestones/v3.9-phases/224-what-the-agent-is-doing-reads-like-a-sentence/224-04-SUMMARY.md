# 224-04 — SUMMARY

**Built by Claude** (Gemini was on Phase 226). ⚠ Two of this plan's four must_haves were **not built**
— see "Deferred" below. That is a decision, recorded, not an omission.

## Done

**The `<Square>` glyph is gone** from both terminal-status sites in `MessageItem.tsx` — the
`timed_out` / `stopped` indicator and the `cancelled — no output yet` affordance — along with its
now-unused `lucide-react` import and three stale comments that still described it.

⭐ **SC#3's real cause was contextual, not a wrong icon.** `<Square>` was chosen as a *stop* glyph and
reads correctly in isolation. It only wore a checkbox costume because **`SeamCard` rendered `☑`
directly above it** — and Winner D has now deleted that. The fix is subtraction on both sides.

## Added — a guard for an invariant nothing was guarding

`ChatArea.approval.test.tsx` (3 cases). Plan `224-03` left **one decision drawable by two components**,
prevented only by conditions in **two different files** that happen to be exact complements:

```
ChatArea.tsx    pendingApproval  →  if (!isStreaming) return null
MessageItem.tsx inline guard     →  decision || !isStreaming
```

⚠ **Neither file mentions that the other exists**, and `grep docked-tool-approval` across every test
file returned **nothing**. Delete that one line and a person gets two live sets of Approve/Reject
buttons with the whole suite green.

⭐ **Driven RED, because a guard nobody has seen fire is not a guard.** Neutralising the `isStreaming`
check produced `1 failed | 2 passed`, failing on the **negative control** — the assertion written
specifically to catch it. File restored, **md5 identical**.

⚠ **A process failure worth recording:** the first RED script crashed on output encoding *after*
planting and *before* restoring, leaving the defect on disk. Caught and restored from git, md5
verified. **The plant-and-restore pattern needs `git checkout` as the restore**, never a rewrite an
exception can skip.

## Deferred to Phase 227 — with a trigger

1. **The right-aligned step-result column.** The step rows are rendered by **`ToolCallPanel.tsx`**,
   which is **not in this plan's `files_modified`** and is a separate *extraction due* hot file.
   ⚠ **And it conflicts with the operator's own 2026-08-31 noise audit** (`ToolCallPanel.tsx:420-430`),
   which *removed* a per-row column because *"the eye went to the least informative thing on it."*
2. **The status line moving inside the run frame.** The line is `MessageItem`'s, the frame is
   `RunCard`'s — another cross-file change outside the declared blast radius.

**Both are the motivation for Phase 227**, proposed from this plan's execution.

## Verified

`tsc` **66** = baseline · **36 tests green** across `ChatArea.approval`, `ToolApproval`,
`ChatArea.model`, `ChatAreaBanner`.
