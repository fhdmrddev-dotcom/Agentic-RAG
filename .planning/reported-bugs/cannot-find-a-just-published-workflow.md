---
id: BUG-260815-02
title: A just-published workflow is unfindable — the AI names it, the library sorts alphabetically, nothing sorts by recency
reported: 2026-08-15
surface: Agentic-RAG
severity: blocking
status: folded
affected_areas: [workflow/library, workflow/authoring, backend/workflows]
folded_into: "193.2"
verified_closed_by: null
related_seeds: [SEED-155]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 1dc4d509
  date: 2026-08-15
---

# BUG-260815-02: A just-published workflow is unfindable

## What the operator saw

Immediately after publishing their first template-first workflow (Phase 193.1 UAT):

> "after we publish the workflow I cannot find it … I was literally not able to find this because
> I do not know what name it created. So I have to scroll and search myself because it was at the
> bottom. So it was not arranged according to the recency."

## Root cause — measured, and it is three compounding facts

1. **The AI chooses the name and never tells the author.** The published row is
   `Quarterly Business Review — Northwind Logistics (Q3 2026)` (slug
   `northwind-qbr-q3-2026-f0f9033f`). The author typed a *description*; the name was invented by
   `generate_workflow_definition`. **They cannot search for a string they have never seen.**
2. **The library sorts ALPHABETICALLY, at three separate call sites** —
   `backend/app/db/workflows.py:316`, `:352`, `:553`, all `ORDER BY name`. **There is no recency
   ordering anywhere in the feed.**
3. **The arithmetic:** 146 published workflows; a name beginning "Q" lands at
   **position 129 of 146.** Verified with a `row_number() over (order by name)` query.

So the single most recently created thing in the product renders **17 rows from the bottom of an
alphabetical list**, under a name the author has never read. All three facts are individually
defensible; together they make the just-completed action invisible.

## Why severity: major

This is the moment immediately after a successful publish — the point of highest intent and the
first time the author looks for their own work. Phases 192 and 192.1 spent two phases making the
library legible at 200 rows (`LIB-01`…`LIB-05`); **that work solves *browsing* and does not solve
*return-to-what-I-just-made*.** They are different jobs, and only the first has been built.

## Two more things the operator raised in the same breath

**A. Card density.**

> "the card itself still displays a lot of information, a lot of text … maybe instead of cards we
> can put list option, I don't know, we can brainstorm this."

⚠ This is a **design question, not a defect**, and it must go through `/gsd:sketch` under **G-2**
before any plan. ⚠ It also lands on `SEED-155`'s exact territory — the standing lesson that a
sketch which hand-writes its own CSS is a drawing, not an acceptance bar, and that a mockup
depicting a shipped component must RENDER it. Any list-vs-card exploration must consume
`WorkflowCard`/`WorkflowSoul` as they actually are.

**B. No recency signal at all.** Even with a list view, the ordering problem survives — sorting is
the fix, layout is a separate improvement. **Do not let a layout redesign absorb the sort bug.**

## Candidate fixes, cheapest first

1. **Sort by recency by default** (`updated_at DESC`, or `created_at DESC`) — or make sort a user
   choice with recency as the default. ⚠ Three call sites share `ORDER BY name`; change them
   together or the feeds disagree. ⚠ Phase 192.1 shipped `relativeChanged`'s nine bands and
   `updated_at` is already on the wire — **the data for a recency sort already exists.**
2. **Show the author the name at publish time**, or better, **navigate straight to the row** —
   the publish response knows the id. "I published it and the product took me to it" removes the
   search entirely.
3. **Let the author name it,** or offer the AI's proposal as an editable field — the same shape
   `SEED-163` proposes for `business_requirement`. ⚠ **Both are instances of one pattern: the AI
   decides something the author then has to go and find.**

## Routing note

Genuinely blocking the *first-run experience*, and it shares a root with `SEED-163` — the
authoring path makes decisions the author is never shown. Should be scoped alongside the two
publish blockers rather than as a library-only fix.

---

## ⚠ RE-ROUTED 2026-08-15 — OPERATOR INSTRUCTION. This does NOT wait for 197.

> *"the two that we documented for business requirement and also the stop-and-ask-user are
> blocking actually and we should include in the earliest phase possible."*

The original routing sent this to **197 / AUTH-02** on the grounds that it is the phase already
scoped to the authoring surface. **That reasoning was about tidiness of scope, not about the
user's ability to use the product**, and the operator has overruled it after hitting both walls
in a single sitting on the phase's own headline path.

**The corrected routing: earliest available phase.** These two, together with `BUG-260815-02`
(a just-published workflow is unfindable), form one coherent piece of work — **everything
between "the AI wrote my workflow" and "I can actually run it and find it again"**. They
share a single root, which is the reason to fix them together rather than in three places:
**the authoring path makes decisions the author is never shown, and does not know what the
publish gate requires.**

⚠ **Sequencing note for whoever plans it:** 197 / AUTH-02 (*deepen the fast door*) remains the
right home for the BIGGER authoring redesign. Moving these three out does not empty 197 — it
removes the blockers from in front of it, so 197 can be about depth rather than repair.
