---
sketch: 160
name: telling-43-apart
question: "When 43 rows carry one name, what makes a row identifiable at a glance?"
winner: null
tags: [phase-192.1, lib-05, workflows-page, identity, lineage, recency, scale, shape, card]
---

# Sketch 160: Telling 43 apart

## Design Question

Phase 192 shipped search, six honest chips, one flat list and predictable card actions. Nine of eleven
G-4 UAT rows passed on live evidence. The operator then used it and could not tell the rows apart,
because **43 of their 104 workflows are named "Compliance Gap Report."** So:

> When 43 rows carry one name, what makes a row identifiable — without opening it?

This is the **high-risk** sketch of the three: it picks the identity *axis*. 161 places whatever wins
here on the card, and 162 decides whether the fix is also allowed to touch the write path.

## How to View

```
open .planning/sketches/160-telling-43-apart/index.html
```

**Open the "Today (shipped)" tab first, then scroll to the Compliance Gap Report block.** It is the
diagnosis and it is built from the real code.

**Then flip `shape` → `distinct names` in the bottom-right toolbar.** That is the single most
important control in this sketch — see *Why no gate caught this* below.

## Variants

- **Today (shipped)** — not a variant, the reference frame: the real card, the real server ordering,
  the real 13 atoms. 43 adjacent identical rows.
- **A: Lineage-led** — names stay as they are; a subtitle says whose it is and what it was forked
  from (*"Your copy of the Compliance Gap Report starter"*, *"Your v2 of Risk Register v1"*,
  *"Original"*). Costs **nothing on the wire** — lineage is derived from the slug rules.
- **B: Disambiguate-on-collision** — for each row, compute what *actually* differs among the rows
  sharing its name, and print only that (`Finance · Still building · 3 weeks ago`). The 13 rows whose
  name is already unique get **no strip at all**.
- **C: Order & recency** — stop sorting by name. Default to recently-changed, group by time bucket,
  put a timestamp on every row. Needs one additive `updated_at` projection, flagged violet on every
  row that uses it.

## What to Look For

1. **Scroll into the 43 on every tab.** Which one lets you say *"that one"*? A says the same thing 43
   times, because the 43 genuinely *are* nearly the same thing. B says something different on every
   row. C spreads them across time but leaves row 40 in an undifferentiated block.
2. **Watch the 13 singletons** (`Board Minutes Formatter`, `NDA Redline Assistant`, …). A and C tax
   them exactly as much as the 43; B deliberately leaves them alone. Is that restraint worth B's
   variable-length region?
3. **B's strip changes as the library changes.** A row's discriminator can shift when an *unrelated*
   row is deleted, because "what differs" is a property of the set, not of the row. Decide whether
   that is acceptable before picking B.
4. **C alone, honestly.** Set sort to *Recently changed*: the four rows you touched this week float up
   and you will recognise them. That is real value for the top of the list and nothing at all for the
   bottom. C may be **necessary and insufficient**.
5. **The empty state** — type nonsense in the search box.

## Grounding (measured at HEAD, not inherited)

| Fact | Where |
|---|---|
| Both feeds are `ORDER BY name` | `db/workflows.py:303` (published), `:517` (drafts) |
| The toolbar has **no sort control at all** | `LibraryToolbar.tsx` — zero `sort` occurrences |
| The fork **copies the name verbatim** — same slug, v N+1 | `WorkflowsPage.tsx:600-608` (`onTweak`) |
| The starter fork copies the name too — fresh slug `<parent>-[a-z0-9]{6}`, v1 | `WorkflowsPage.tsx:658` (`onUseStarter`) |
| `created_at` / `updated_at` **exist on the table** | `supabase/full-schema.sql:1940-1941` |
| …but **neither query projects them, and neither TS type carries them** | `db/workflows.py:282/296/515`; `api.ts:1364`, `:3328` |
| The card renders 13 atoms; **none of them is an identity** | `WorkflowCard.tsx:366-565` |

### ⚠ The wire cost, graded — two of three axes are free

| Axis | Cost |
|---|---|
| **Lineage** | **Zero.** Derived from the slug rules above; the page already builds `draftBySlug`. |
| **Recency** | **Cheap, but net-new.** Additive `updated_at` projection on two queries + two TS types — exactly the shape Phase 192 used for `is_mine` (D-04). No migration, no predicate change. |
| **Owner by name** | **Expensive, and nobody asked for it.** The wire has `is_mine` (a boolean, only since Phase 192) and `created_by` (a uuid, never serialized). A human-readable owner needs a users join. All variants render **Yours / Shared** and stop there. |

### ⚠ The trap: the timestamp is already on the wire, and you must not read it

The drafts feed already ships `updated_at` — disguised as `token`, which is literally
`to_char(updated_at AT TIME ZONE 'UTC', …)` (`db/workflows.py:93-95`). **Do not read it for display.**
`api.ts:3338` forbids parsing it: Postgres keeps microseconds, a JS date keeps milliseconds, and a
parsed-and-re-rendered token matches zero rows — *every later save then refuses as stale* (probed
against the live database 2026-08-01). Project a separate field; never repurpose the token.

## The fixture, and why it is generated rather than typed

`../themes/library-fixture-192-1.js` builds the library by applying the **real fork rules** to a set of
sources. The duplicate names are not authored — they fall out of `copyFork`/`versionFork` copying the
name, exactly as the product does. Measured against the operator's real library:

| Name | This fixture | Operator's DB (2026-08-12) |
|---|---|---|
| Compliance Gap Report | **43 rows / 41 slugs** | 43 / 41 ✓ |
| Risk Register | **10 / 9** | 10 / 9 ✓ |
| Weekly Status Report | **8 / 5** | 8 / 5 ✓ |
| Project Meridian Risk Summary (GOOD) | **8 / 4** | 8 / 4 ✓ |
| Duplicated names | **14** | 14 ✓ |
| Largest family as % of library | **40 %** | 41 % |

107 rows, 27 distinct names, 94 rows under a duplicated name, and **lineage resolves for 100 % of the
80 forks** (0 unresolved) — so the derived-lineage claim above is measured, not assumed.

## ⚠ Why no gate caught this — flip the `shape` switch

Set `shape` → **distinct names**. Every tab, including *Today*, becomes readable, and the `duplicated
names` counter in the header reads **0**.

That is the fixture every automated check in Phase 192 ran against. The phase tested at 12 rows *and*
at 107 rows — but never at 107 rows carrying 14 duplicated names. **Volume was real; shape was not.**
`LIB-02`'s bar — *"a card shows what the workflow is for, at a glance"* — is true of one card in
isolation and false of the list.

The standing question this leaves for any list-rendering phase: **is the fixture's SHAPE realistic, not
just its SIZE?**

## Verification

`node --check` on the extracted inline script, plus a headless JSDOM drive (`drive160.cjs`):
**40/40 checks pass.** Driven, not asserted — all four tabs render 107 cards with all five soul atoms
intact; no draft exposes a Run affordance on any tab; A emits 27 originals + 80 parent-naming forks;
B emits exactly 13 no-strip singletons and 94 computed strips with >8 distinct wordings (proving they
are computed, not templated); C's buckets collapse when sort flips to name; search, all six chips,
the project select, the scale switch and the `⋯` menus all drive clean; the empty state renders.

Two fences carry **positive controls**: the `[title]`-attribute count is 0 *and* the selector is proven
able to find a planted one; the error channel reports clean *and* is proven able to capture a planted
throw. jsdom's own unimplemented `window.scrollTo` is excluded **by name**, never by silencing the
channel.
