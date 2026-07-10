---
sketch: 039
name: signal-row-and-fix-action
question: "How does one governance signal row read, and how does its 'fix' link behave per signal type — given each signal fixes differently?"
winner: "A"
tags: [phase-119, governance-health, dgov, signal-row, fix-action, detail-panel, honesty, re-fetch, confidence-chip, accept-dismiss]
---

# Sketch 039: Signal Row & Fix Action

> **WINNER: A — inline per-signal verb buttons** (operator + adversarial judge panel
> `wf_a961f729-247`, 2026-06-21; **LOW confidence — the narrowest call**). A wins *lived
> triage* (the verb is the diagnosis — one scan, one tap) and is honesty-clean. **Honest
> tension to carry into plan:** B genuinely wins 2 of 4 lenses (honesty 94, build-cost 88) —
> it routes every fix into the already-audited shared `DocumentDetailPanel` (smallest write/
> leak surface, SC#3); a reviewer optimizing for "the page never lies in six months" could
> rationally pick B. **Ship the composite: A's verb-rows + C's expand-for-provenance caret —
> but the expand text MUST inherit the 117 no-access/missing mask** (they share the
> `.fix-primary` atom, so the graft is cheap). **C is DISQUALIFIED as-drawn:** its provenance
> line prints a target title (`supersedes → Q2-Board-Deck.pptx`, ungated) — a latent
> honesty-lock-3 leak on no-access rows. **Two plan-time build-notes:** (1) the governance
> **count must re-fetch** as rows resolve — "no list-level mutations" must NOT become "no
> list-level re-fetch", or the count silently lies about remaining work; (2) A's verbs SHOULD
> delegate into the canonical 112/117/118 edit paths rather than reimplement three parallel
> mutation paths (drift risk the README flags) — and if any verb deep-links into the shared
> panel, confirm the panel exposes a programmatic "open scrolled to section X" prop first.

The per-row mechanics inside the Phase 119 governance surface (form set by sketch 038).
Each of the three signals **fixes differently** — a broken relationship is fixed in the
relationships panel, an unclassified doc by classifying, a low-confidence field by
re-extracting — so the row needs one affordance that does the right thing per signal,
resolves honestly, and never lies about what happened.

## Design Question

How does a single governance row read, and how does its **fix-link** behave per signal
type — including how a row **resolves after a fix**, the honest empty/all-clear states,
and the metadata-confidence-vs-retrieval-similarity distinction?

## How to View

```
open .planning/sketches/039-signal-row-and-fix-action/index.html
```

Click the fix buttons to feel the loop: **Re-extract** queues async and the row fades on
re-fetch; **Open / Classify** navigates. In B, clicking a row opens the shared detail
panel scrolled+flashed to the relevant section. In C, the caret expands in-place
provenance.

## Variants

- **A: Inline verb buttons** — each row carries a primary button whose **verb matches the
  signal** (`Open links` / `Classify` / `Re-extract`) plus a quiet `Open doc`. Fast, but
  the list owns three different mutation paths.
- **B: Row → shared detail panel** — rows are quiet pointers; a click opens the **same
  112/117/118 `DocumentDetailPanel`** (right-side push/split) scrolled+flashed to the
  relevant section. The fix happens where the user already edits; **one source of truth**,
  no list-level mutations.
- **C: Hybrid (one action + expand)** — one inline fix for the common case **plus an
  expand caret** that reveals the *provenance* in place (which link dangles, which rule
  nearly matched, which field scored low) — panel only for deep edits.

## What to Look For

- **Verb honesty** — does a per-signal verb (A/C) read clearer than a generic "Open" that
  defers everything to the panel (B)?
- **Resolve-after-fix** — **re-fetch-not-optimistic** (the 117/118 lock): the row clears
  only when the backing query re-runs. Watch the Re-extract receipt: it says
  "*Re-extraction queued — this row clears when it finishes*", never a premature "Fixed".
  Sync nav ("Opening…") vs async work ("Queued") must read differently.
- **The panel reuse question** — is B's "everything routes to the detail panel" worth
  losing the one-tap fix? Or does C's hybrid get both?
- **Provenance (C)** — does in-place "*why is this flagged?*" reduce trips to the panel,
  or is it clutter the list doesn't need?
- **Honesty traps (load-bearing):**
  - Low-confidence metadata renders the **Phase-112 `ConfidenceChip`** (`Low · 0.31`) — the
    per-field extraction score, italic+dimmed+⚠ for low — NOT a retrieval-similarity %.
  - **Classify never silently moves** (CLASS-02) — it opens the suggestion/accept flow.
  - Broken-relationship rows reuse the **"linked document (no access)" mask** language from
    117 — the governance view must not leak a target's title/id either.

## Build Handover (reuse vs net-new)

- **Reuse:** `HealthDocumentRow` (icon + filename + chip + hover actions) as the row base;
  the Phase-112 `ConfidenceChip`; the shared `DocumentDetailPanel` + its `PanelSection`
  accordion (Metadata / Relationships / Classification) for B's open-to-section; the
  117 `_NO_ACCESS_MASK` copy; the 118 accept/dismiss + `moveDocument` reversal path.
- **Net-new:** the per-signal **fix-link dispatcher** (route by signal type → open-to-
  section vs. re-extract call vs. classify flow); the async **"queued" receipt** + re-fetch
  reconcile on the governance list; C's **expand-for-provenance** row (the "why flagged"
  context line is a net-new read shape per signal).
- **Decision needed at plan time:** A vs B vs C sets whether 119 ships list-level fix
  buttons, leans entirely on the detail panel, or does both — directly affects how much
  net-new mutation glue the governance page carries.
