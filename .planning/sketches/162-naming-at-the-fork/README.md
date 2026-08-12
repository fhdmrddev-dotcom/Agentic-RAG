---
sketch: 162
name: naming-at-the-fork
question: "Does the fork name the copy, or does the library derive it? (the phase's scope question)"
winner: null
tags: [phase-192.1, lib-05, workflows-page, fork, naming, scope, d-15, write-path, upstream]
---

# Sketch 162: Naming at the fork

## Design Question

The ROADMAP is explicit that this is **the first scope question, not an assumption**:

> It is partly UPSTREAM of the library. Nothing stops duplicates being created — `onTweak` mints
> `<same name> v(N+1)` deliberately. A read-side fix alone leaves that running.

So:

> Does the **fork** name the copy, or does the **library** derive it?

The answer decides whether Phase 192.1 touches the write path at all. Operator direction (2026-08-12)
was to sketch all three and decide from the mockup rather than assume.

## How to View

```
open .planning/sketches/162-naming-at-the-fork/index.html
```

**Open "Today (shipped)" and click `Make my own copy` a few times.** Watch the family counter climb
past 43. Use **fork ×5** in the toolbar to feel it at speed, and **reset** to return to 43.

## Variants

- **Today (shipped)** — both handlers spread `...def` and copy the name verbatim. Every fork is a
  correct fork, and every fork makes the library harder to read.
- **A: The fork names it** — the copy arrives differentiated. No new surface, no extra click; the
  fork stays the direct flip D-15 made it.
- **B: The fork asks** — a name field between click and POST. Best names, most control — and it
  **reopens a shipped decision**. See below.
- **C: Read-side only** — the write path is never touched; identity is 100% derived at render.

## What to Look For

1. **The scoreboard is the argument.** Four live measures per variant: rows under one name, distinct
   names in the family, clicks to fork, write path touched. Fork a few times and watch them move.
2. **A vs C is not "fix it" vs "don't."** A fixes *new* forks; the existing 43 keep their copied
   names either way. **A does not remove the need for 160/161** — SC#1 is a statement about rows that
   already exist. Anyone reading A as "so we can skip the library work" has read it wrong.
3. **On B, read the red box before liking it.** It is not a free option.
4. **On C, read what it permanently accepts.** Fork five times and scroll: every new row is named
   like the other 43, and the reader untangles it every time, forever.

## ⚠ B reopens a shipped decision — do not pick it by accident

**D-15 decided the fork is a DIRECT FLIP**, and the argument was recorded, not casual. From the
shipped card's own docblock (`WorkflowCard.tsx:84-87`):

> fork — DIRECT FLIP. It is non-destructive and reversible — the live version stays live and
> unchanged — so a sheet on it would spend the guard vocabulary the delete relies on to mean
> anything. **The sketch attached a confirm to 159-C; it is deliberately not shipped.**

So B is a real option only with a real answer to: **what makes a name prompt different from a
confirm?** One available answer — *a prompt that collects something the system cannot know is an
input, not a guard, and inputs do not spend guard vocabulary.* Whether that distinction holds is the
operator's call, and it belongs in this sketch rather than in review.

**B's consolation prize if it loses:** it is the only variant with a natural home for the **409**. A
name field can surface a slug collision *before* the request. WR-08 currently classifies that failure
by substring-matching error prose (`WorkflowsPage.tsx:165-167`), recorded with its own re-open
trigger. Worth noting even if B is rejected.

## Grounding (measured at HEAD, not inherited)

| Fact | Where |
|---|---|
| `onTweak` — same slug, v(N+1), `...def` spread, **name untouched** | `WorkflowsPage.tsx:600-608` |
| `onUseStarter` — fresh slug `<parent>-[a-z0-9]{6}` at v1, `...def` spread, **name untouched** | `WorkflowsPage.tsx:656-661` |
| The two handlers are **siblings, not twins** — merging them breaks a global `UNIQUE(slug, version)` | D-12, `WorkflowCard.tsx:264-272` |
| `name` is REQUIRED on the Pydantic model both write paths bind | `harness.py:519-522` |
| The insert and the update write `name` + `definition` **from one model**, so editing cannot drift them | `db/workflows.py:490-497`, `:580-598` |
| A 409 is classified by substring-matching error prose (WR-08) | `WorkflowsPage.tsx:165-167` |

## ⚠ The severity is inflated on this machine; the disease is not

Both halves, as the ROADMAP records them:

- The 42 duplicates in the dev database were **seeded, not created** — all 42 are
  `jsonb_typeof = string`, a shape the app's own write paths cannot produce (`name: str` is required
  through Pydantic, and the update writes name + definition from one model).
- **That does not dissolve LIB-05.** `onTweak` mints `<same name> v(N+1)` *by design*, so a real
  customer generates genuine duplicates by using the product normally.

Which is why this sketch judges variants against the **generated fixture** — built by applying the
real fork rules — and not against the operator's dev rows.

## ⚠ A retraction, kept visible rather than quietly replaced

A **"two names" propagation defect** was claimed for this phase on 2026-08-12 and is **RETRACTED**:
that a row carries a `name` column and a conflicting `definition->>'name'` disagreeing on 85 of 104
rows. It was generalised from **n=1** — one surprising name returned by a cleanup `DELETE` — and
written up before the population was measured.

What the measurement showed: `definition->>'name'` returns NULL on a **string scalar**, and 83 rows
are double-encoded. So "85 divergent" was 83 encoding artifacts plus **2 genuine conflicts**, both
test fixtures.

It is rendered on the *Today* tab rather than deleted, because promoting a single observation to a
mechanism is the same failure mode this phase exists to correct.

**Two real things fell out of that check, and neither is this phase:** 83 of 104 rows carry a
double-encoded `definition` (the recorded string-scalar trap, at scale, in the dev DB — whether any
*live* app path still writes that shape is unverified and worth its own check); and the duplicate
severity is a dev-data artifact, as above.

## Verification

`node --check` on the extracted inline script plus a headless JSDOM drive: **all checks pass** (68/68
across this sketch and 161). Driven, not asserted — the family starts at the measured 43 on every
tab; every tab's fork button carries the *shipped* verb string (`Make my own copy`, read from
`libraryVocabulary.ts:78` via the fixture, never retyped); *Today* and *C* produce a 44th row marked
`1 of 44`; *A* produces a row marked `unique` and flips the scoreboard's write-path measure to
**yes**; *B*'s button is disabled until named, warns on a colliding name without blocking it,
confirms a free one, and renders the D-15 reopening as a red decision box with the rejected confirm
struck through; **fork ×5 and reset both drive clean**; and the retraction is asserted present on the
Today tab so it cannot be silently dropped in a later edit.

The `[title]`-attribute count is 0 **with a positive control** proving the selector can find a
planted one.
