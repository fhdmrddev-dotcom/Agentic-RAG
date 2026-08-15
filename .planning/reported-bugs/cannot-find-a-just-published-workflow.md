---
id: BUG-260815-02
title: A just-published workflow is unfindable — the AI names it, the library sorts alphabetically, nothing sorts by recency
reported: 2026-08-15
surface: Agentic-RAG
severity: blocking
status: closed
affected_areas: [workflow/library, workflow/authoring, backend/workflows]
folded_into: "193.2"
verified_closed_by: "193.2 — UAT rows U1 moment 3 and U4 (`193.2-UAT.md`), driven by the operator 2026-08-15: the just-published workflow was found WITHOUT searching and WITHOUT knowing its name, at rendered position 4 of 112 (3 starters + 29 published + 80 drafts), first among the operator's own work — the measured prediction of index `starters.length` held exactly. The post-publish Run CTA also appeared and NAMED the workflow. ⚠ Recency is proved against a near-identical OLDER row rather than by alphabetical luck: the new QBR (14:17) sorts above the old Q3 one (02:07). ⚠ THE PASS IS THE OPERATOR'S JUDGEMENT, NOT A MEASUREMENT — this file predicted 4 and refused to call it findable; had they said 4 was too far down, the sort would have been no less correct and the row would have failed."
related_seeds: [SEED-155]
re_open_trigger: "CLOSED 2026-08-15 on a driven run. BOTH halves are now evidenced: the ORDERING half server-side (`list_published_workflows` + `list_draft_workflows` now `ORDER BY updated_at DESC`; starters stay alphabetical by D-16; the client merge arithmetic pinned), and the FINDABILITY JUDGEMENT by the operator at UAT row U4 — found without searching at rendered position 4 of 112. ⚠ Note this report's own arithmetic was over the wrong feed: the page passes `?scope=mine`, so the true figures are 17 of 109 -> 4 of 109, not 129 of 146. POSITION 4 IS NOT POSITION 1 and no `ORDER BY` change can make it 1, because `mergeLibrary` concatenates starters first; 4 was judged findable, not measured to be. RE-OPEN if: (a) the operator cannot find a just-published workflow again; (b) the post-publish Run CTA fails to appear (it DID appear and named the workflow, U3 — but its LATENCY was never timestamped, so a late-appearing CTA is unguarded); (c) the recency ordering reads badly in the composer's Harness picker, `WorkspacePanel`'s run-soul or `threads.py`'s kickoff — all three share this feed and ⚠ UAT row U5 was NOT DRIVEN, so that consequence remains UNOBSERVED by anyone; (d) the curated starters shelf grows enough that index `starters.length` stops being near the top. A user-facing recency-vs-A-to-Z SORT CONTROL was deliberately NOT built (D-18), as was any navigate-to-row hand-off (D-19); both remain deferred to the library layout sketch, where G-2 fires and SEED-155 binds — now joined there by BUG-260815-08."
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

---

## ⚠ SUPERSEDED THE SAME DAY — kept verbatim, not deleted

> **The section below was written BEFORE the operator drove the D-21 run, and it says this report
> stays `folded` because the findability JUDGEMENT was still owed. Hours later U4 was driven and the
> judgement was made — it is now `closed`, see the CLOSED section at the foot of this file.** It is
> preserved rather than overwritten because its split (*the ordering half is proved; the judgement is
> not*) is the honest description of what the code could and could not establish, and because **the
> prediction it records — position 4 — is only interesting if the reader can still see that it was a
> prediction.**

## ⚠ STATUS AT PHASE 193.2's CLOSE-OUT PLAN (2026-08-15, pre-UAT) — `folded`, NOT `closed`, and the split is the point

**The ordering half is CLOSED and proved. The findability judgement is OWED.** Those are two
different claims and neither may be quoted as the other.

### (a) What shipped — the server `ORDER BY` (`193.2-03`)

`list_published_workflows` and `list_draft_workflows` — **the two feeds holding the author's own
work** — now `ORDER BY updated_at DESC`. `list_starter_workflows` **deliberately does not** (D-16):
starters are a curated catalogue the author did not write, and *"most recently updated starter"* is
meaningless to someone browsing.

⚠ **This report warned "change them together or the feeds disagree", and the phase deliberately did
not.** The divergence is accepted with eyes open **on condition that it is recorded in the code and
in the `CLAUDE.md` ledger row** rather than left to look like an inconsistency — and it is, at all
three feed sites and in the new `db/workflows.py` ledger row.

**Measured facts worth not re-deriving:**

- On the published feed, `ORDER BY updated_at DESC` **IS** `ORDER BY publish-time DESC`: the publish
  flip is an `UPDATE`, `workflow_definitions_set_updated_at` is an unconditional `BEFORE UPDATE`
  trigger, and `workflow_definitions_block_published` then freezes the row. `created_at DESC` was
  rejected because the card's *"changed 2 minutes ago"* reads `updated_at`, and the list and the card
  would then disagree by construction.
- **No migration, with the reason rather than the assurance:** there was no index on `name` either,
  so the shipped sort was already unindexed; 225 rows, largest feed 118; `supabase/migrations/`
  reads 112 before and after.
- **The complete non-comment diff is TWO LINES.** Zero `WHERE` clauses, zero `params` appends, zero
  `$N` bindings, zero projections moved — which is also the security argument, because on a
  service-role pool that bypasses RLS the `WHERE` clause *is* the access boundary.
- ⚠ **The shared-consumer consequence:** with `owned_only=False`, `list_published_workflows` also
  feeds the **composer's Harness picker**, **`WorkspacePanel`'s run-soul** and **`threads.py`'s
  kickoff**. **All three moved from alphabetical to recency.** Measured: nothing asserts alphabetical
  for any of them — but *"nothing asserts it"* and *"it reads well"* are different claims. That is
  UAT row **U5**.
- A shipped green fence (192.1's `test_no_feed_orders_by_updated_at`) **forbade this change** and was
  **rewritten in place, never deleted**, with 192.1's reasoning kept verbatim under a `SUPERSEDED`
  marker, driven RED clause-by-clause against the pre-change source. ⚠ One third of the replacement
  fence would have been **inert**: a bare `D-16` needle was already satisfied on the drafts feed by a
  Phase 192.1 docblock where `D-16` names an entirely different decision. Caught by measuring, not by
  reading, and paired with a `BUG-260815-02` clause that fired RED on all three feeds.

### (b) ⚠ THIS REPORT'S OWN ARITHMETIC WAS OVER THE WRONG FEED — corrected beside, not over

The report says *"Quarterly Business Review… landed at position 129 of 146"*, derived from a
`row_number() over (order by name)` across the **whole** `workflow_definitions` table. **The page
passes `?scope=mine`.** The true rendered figures are:

| | Before | After |
|---|---|---|
| Rendered position of the just-published row | **17 of 109** | **4 of 109** |

**Position 4 is not position 1, and no `ORDER BY` change can make it 1.** `mergeLibrary` concatenates
**starters ++ published ++ drafts** client-side, so the newest published row lands at index
`starters.length` — pinned as an **expression**, never a literal, because a literal rots the moment
the curated shelf grows by one. The alternative (re-ordering the merge loops) would put it at index 0
and a **real plant proved it also inverts the dedupe precedence**, so a row the caller owns would
read as a shared starter. That cost is now a measurement rather than a caution.

⚠ **Whether position 4 satisfies "findable" is a product judgement, and nothing in this repository
may be read as having answered it.** It is UAT row **U4** (OQ-5), owed.

### (c) What was deliberately NOT built

- **A user-facing recency ⇄ A–Z sort control** (D-18) — the library surface is where **G-2 fires** and
  where card-density / list-view is already routed to `/gsd:sketch`, bound by `SEED-155`. Building a
  control the pending sketch may relocate is building it twice. **The default change is a defect fix
  and shipped regardless of any layout decision**, which is what this report asked for.
- **A navigate-to-row hand-off** (D-19). The post-publish Run CTA already names the workflow and
  offers Run; `193.2-02` ruled *it fires; SC#3 is met by the sort plus one pin; no second hand-off is
  built* — a second one would be a genuine second concern on a file carrying an inherited G-5
  obligation. ⚠ **That CTA had ZERO automated coverage from the day it shipped until this phase**
  (`run-cta` in its suite: 0 → 13 occurrences), and WR-04 had already fixed one silent drop on it
  that no test would have caught. Its latency on a real network is UAT row **U3**.
- **Any client-side sort.** D-17's fence now sweeps `libraryFilter.ts` **and** `WorkflowsPage.tsx` —
  which had **no sort coverage of any kind anywhere in the repository** before this phase — and both
  arms were driven RED against real plants in production source, separately.

---

## ✅ CLOSED 2026-08-15 — driven, with the prediction held and the judgement made by the operator

**`193.2-UAT.md` U1 moment 3 + U4.** The just-published workflow was found **without searching and
without knowing its name**, at **rendered position 4 of 112** (3 starters + 29 published + 80
drafts), **first among the operator's own work**. **The measured prediction — index
`starters.length`, i.e. 4 — held exactly.** The post-publish **Run CTA appeared and named the
workflow**, which closes the *"the product never told me the name"* half on this path.

⚠ **The recency claim is proved against a near-identical OLDER row rather than by alphabetical
luck:** the new QBR (**14:17**) sorts **above** the old Q3 one (**02:07**). Two rows whose names
would sort adjacently, ordered correctly by time. Without that pairing the observation would have
been ambiguous.

⚠ **THE PASS IS THE OPERATOR'S JUDGEMENT, NOT A MEASUREMENT, AND THAT SURVIVES THE RESULT.**
`193.2-UAT.md` predicted position 4 and **refused to call it findable**. Had the operator said 4 was
still too far down, the sort would have been no less correct and the row would have **failed** —
which is exactly why it was asked rather than asserted. **Position 4 is not position 1, and no
`ORDER BY` change can make it 1**; `mergeLibrary` concatenates starters first, and the alternative
was measured to invert the dedupe precedence.

⚠ **One consequence of this fix remains UNOBSERVED.** `list_published_workflows` also feeds the
**composer's Harness picker**, **`WorkspacePanel`'s run-soul** and **`threads.py`'s kickoff** — all
three moved from alphabetical to recency. UAT row **U5 was NOT DRIVEN**, so **the one user-visible
consequence outside the library has not been looked at by anyone.** That is a named residual, not a
silent one, and it is the first thing to check if the ordering ever reads oddly elsewhere.

**Deliberately not built, and still not built:** a user-facing recency ⇄ A–Z **sort control** (D-18)
and any **navigate-to-row** hand-off (D-19). Both remain routed to the deferred library layout
sketch, where **G-2 fires** and `SEED-155` binds — now joined there by **`BUG-260815-08`** (Workflows
header polish), filed during this same UAT session.
