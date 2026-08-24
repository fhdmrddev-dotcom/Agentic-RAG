---
id: BUG-260819-01
title: Library card renders the state word twice on a name-colliding row ("Ready to run" stutters)
reported: 2026-08-19
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [frontend/workflows-library, frontend/workflow-card, frontend/row-identity]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-155]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: 70b7863b
  date: 2026-08-19
---

# BUG-260819-01: Library card renders the state word twice on a name-colliding row

## What we observed

On the Workflows library, a row whose **name collides with other rows** renders its lifecycle state
word **twice** on the same card:

```
Compliance Gap Report                                    v3
Worked 2 days ago  |  Ready to run                            <- line 2 (Phase 192.2, D-01)
Yours · needs a template · Ready to run · 43 share this name · changed 5 days ago
                          ^^^^^^^^^^^^                        <- the identity line (Phase 192.1)
```

**How it was found — stated precisely, because it matters for the severity call:** it was **not**
reported from manual use. It surfaced during Phase 192.2 plan `192.2-05` when three
characterization-pin cases failed with:

```
TestingLibraryElementError: Found multiple elements with the text: Ready to run
```

The pin's three fixture rows deliberately share one name, which is exactly the condition that
triggers it. **The duplication is real in the product, not an artifact of the test** — the test
merely made an already-shipping condition observable.

**Non-colliding rows are unaffected.** On a row with a unique name the identity line picks a
different discriminator (or none), so the state word appears once, on line 2.

**Expected:** the state (`Ready to run` / `Still building` / `Shared starter`) is said once per card.
**Actual:** on a colliding row it is said twice, three lines apart.

## Why it matters

**Minor, and the reasoning is given rather than asserted.** Nothing is *wrong* on screen — both
occurrences are true statements about the row, nothing is hidden, and no user action is blocked.
What it costs is the thing Phase 192.2 was opened to buy: **quiet**. D-03's whole premise is that
the resting card had nine information rows and needed fewer; a card that repeats itself spends one
of the four slots the redesign deliberately rationed.

It is also **worst exactly where it matters most**. The condition is *name collision*, and the real
library carries **43 rows called `Compliance Gap Report` across 41 distinct slugs**. So the stutter
appears on the very family the identity line exists to disambiguate — and it spends a
discrimination axis on a fact that is now printed unconditionally on every card, which means that
axis is doing **no discriminating at all** on those rows.

Who notices: an operator scanning a same-name family. What is broken from their perspective:
nothing functional; the row reads slightly redundant.

## Hypothesized cause

**Hypothesis, though a well-supported one — the mechanism was read from source, not guessed.**

`resolveIdentity` (`frontend/src/components/workflows/library/rowIdentity.ts`) ranks candidate
**discriminator axes** for a row and emits the winning ones as `segs` on the identity line. On a
name-colliding row where the other axes tie, it selects the **state** axis and emits the business
state word as a seg.

That ranker was written in **Phase 192.1**, when the state was **not** unconditionally present
elsewhere on the card — at that time spending the state axis genuinely discriminated. **Phase 192.2
D-01 then put the state on line 2 of every card, unconditionally**, which retroactively made that
axis redundant. Neither phase is at fault in isolation; the defect is the seam between them.

**The card is not the right place to fix it.** `WorkflowCard.tsx` paints `own`, then `segs` in the
order given, and its documented discipline is that *"it invents no part and drops none"* — a
discipline with its own `toEqual` assertions. Filtering the seg card-side would break that contract
and would leave the ranker still believing it had discriminated.

## Surface classification

**`Agentic-RAG`** — this app, the Workflows library surface, shipped code on `develop`. It is a
routing candidate at `/gsd:discuss-phase`, `/gsd:new-milestone` and `/gsd:complete-milestone`.

## Suggested routing

- **Fold into in-flight phase:** **n/a — and deliberately so.** Phase 192.2's CONTEXT **D-04**
  states LIB-05 stays COMPLETE and **must not be re-opened**; `rowIdentity.ts` sat outside every
  192.2 plan's `files_modified` carrying **72 pinned cases**. Fixing it inside 192.2 would have
  meant re-opening a settled requirement inside a phase that explicitly forbade it.
- **Defer to future phase / milestone:** **yes — the next phase whose scope legitimately includes
  `rowIdentity.ts`.** The change is expected to be small: **stop ranking the state axis as a
  discriminator now that the state is unconditional on every card**, which also frees that slot for
  an axis that actually discriminates.
- **Plant as seed:** not needed — this is a single-file, single-decision fix with a named home, not
  a cross-milestone concern.
- **External — note only:** no.

**⚠ RE-OPEN / PRIORITISE TRIGGER (concrete):** **an operator reads the stutter on the real shelf and
says it reads badly** — which is precisely row **U7** of
`.planning/phases/192.2-does-this-one-work/192.2-VALIDATION.md`. If U7 comes back a fail, this
report's severity rises and it should be folded into the next library-touching phase. If U7 comes
back a pass (the repeat passes unnoticed), it stays `open` at `minor`.

## Workarounds (prompt-side, code-side, or UI-side)

None needed — nothing is blocked and no information is wrong. A user who finds the repeat
distracting can narrow the search until the name family is no longer colliding, at which point the
seg is not emitted.

## Reference / evidence links

- Shipped in `70b7863b` (`192.2-05` Task 2 — the variant-C face, which put the state on line 2).
- Recorded as deviation **4** in
  `.planning/phases/192.2-does-this-one-work/192.2-05-SUMMARY.md` §5, with the full mechanical
  reasoning for not fixing it in-phase.
- Carried as UAT row **U7** in `.planning/phases/192.2-does-this-one-work/192.2-VALIDATION.md`.
- Recorded in the `library/WorkflowCard.tsx` section of `docs/HOT-FILE-LEDGER.md` so the next
  editor of that file finds a decision rather than a surprise.
- The assertion that exposed it is now **scoped to its slot** (`within(row-answer)`) in
  `WorkflowCard.baseline.test.tsx` — the correct assertion in any case, since the same word can
  legitimately render twice on one card until this is fixed.
