# Phase 087: Panel UI - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 087-panel-ui
**Areas discussed:** CSV file preview, Parallel pending questions, Chat-cards bug routing (BUG-260529-02), "Final outputs" download link routing (BUG-260521-02)

**Note:** The 087-UI-SPEC.md (approved 6/6) already locks all visuals/interactions translated from operator-approved sketches 004–007. Discussion was scoped to the 5 implementation gaps the UI-SPEC flagged + the MANDATORY reported-bug cross-check. Token additions (#1), empty-state copy (#2), and the diff wire shape (#5) were resolved without a user question (Claude's discretion + codebase scout) and recorded in CONTEXT.md.

---

## CSV file preview (PANEL-03)

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal table | In-panel `<table>` from CSV, no new dep, graceful fallback if malformed/huge | ✓ |
| Download-only fallback | Treat CSV as binary; "No preview · Download"; defer table | |

**User's choice:** Minimal table (recommended)
**Notes:** Only preview type without an existing renderer; keeps a common file type viewable with no new dependency.

---

## Parallel pending questions (PANEL-04)

| Option | Description | Selected |
|--------|-------------|----------|
| Stack, newest on top | Each prompt its own amber card, all sticky, no cap | ✓ |
| One at a time, queue rest | Show only oldest unanswered, reveal next after answer | |
| Stack with cap + scroll | Cap visible (e.g. 3), scroll the rest | |

**User's choice:** Stack, newest on top (recommended)
**Notes:** `useAskUserPrompt` returns `PendingAsk[]`; render full array. Rare case, no cap needed.

---

## Chat-cards bug routing — BUG-260529-02

| Option | Description | Selected |
|--------|-------------|----------|
| Keep separate | Own future phase; 087 adds only additive seam renderers, must not worsen cards | ✓ |
| Fold scroll/dedup into 087 | Bring auto-scroll + dedup fixes in; expands into G-5 hot files | |

**User's choice:** Keep separate (recommended)
**Notes:** Matches UI-SPEC ruling that `PausedRunCue` is additive. Bug frontmatter updated with 087-review note (status stays open).

---

## "Final outputs" download link routing — BUG-260521-02

| Option | Description | Selected |
|--------|-------------|----------|
| Keep separate | Different surface (old pinned MessageItem card); quick Chrome-MCP re-verify later | ✓ |
| Fold re-verify/fix into 087 | Fix old pinned-panel download here; touches MessageItem hot file | |

**User's choice:** Keep separate (recommended)
**Notes:** Backend now carries url+size; existing `re_open_trigger` stands. Not 087 scope.

---

## Claude's Discretion

- `--warning` + dim-text token additions to `index.css` (UI-SPEC Open Contract #1) — token addition, not redesign.
- Empty-state heading copy (Open Contract #2) — use UI-SPEC recommended copy.
- Diff wire shape (Open Contract #5) — resolved by codebase scout: raw unified-diff string, parsed client-side; 500-line truncation already in backend.
- Amber contrast pairs verified ≥4.5:1 by executor.

## Deferred Ideas

- BUG-260529-02 chat tool-card unification → own future phase.
- BUG-260521-02 "Final outputs" download link → separate re-verify.
- User inline file editing → v2.8.
- `workspace_delete` user-facing control → agent tool only, not this phase.
