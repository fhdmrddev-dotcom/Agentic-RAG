# PORT — the Workflows library, from sketch 200's `screens/library.html`

Ported directly from the sheet's markup and CSS. `200-CHECKLIST.md` and `index.html`'s
`JOURNEY` array were **not** opened — they are the change-log whose derivation lost the design.

Three commits: `6fd7a046` (card), `d29aa8ae` (toolbar), `a63d356c` (page header + grid).

---

## 1 · What was ported

### The card — `library/WorkflowCard.tsx`

| Sheet | Was | Now |
|---|---|---|
| gutter `absolute left-0 top-0 bottom-0 w-[3px]` | a flex CHILD, so inset 16px by the card's own padding and stopping 16px short at the bottom | absolute and flush, corner to corner |
| `w-2 h-2 rounded-full bg-<outcome>` leading the status line | no dot at all | an 8px dot, painted from `GUTTER_TONE` — the **same** arm-keyed table the gutter reads |
| `person` glyph on *Run by someone else*; nothing drawn for an unknown arm | — | `User` for `not-by-you`; **no mark at all** for `unknown` |
| title + version `items-baseline` | `items-center` | `items-baseline` |
| `⋯` in the header row | in the FLOW, clipping the two lines below it 32px short of the card's right edge | absolute at the card's top-right — same pixel position, no width taken |
| meta line 11px `uppercase tracking-wider` | 11px, sentence case | `uppercase tracking-wider leading-tight` (CSS only — see §4) |
| `YOURS` as plain text in the run | a `rounded-full` bordered **9px mono pill** | plain text; only the ownership TONE survives |
| `•` separators | `·` | `•` |
| footer `border-t` + bare icon+word actions | `border-border/60` + a FILLED primary button and a BORDERED secondary | full border tone; both verbs bare `icon + word`, `Play` / `ExternalLink` |
| `p-md` / `mb-sm` / `mb-md` per row | one uniform `gap-3` | per-slot spacing (8 / 16 / 16) |
| `rounded-sm`, `hover:bg-[#0f141b]` | `rounded-lg`, no hover | `rounded`, `hover:bg-accent/30` |

`mt-auto` on the footer became `mt-4` on a **growing** block above it: `mt-auto` resolves to
ZERO on the taller card of a grid row, and the rule then landed hard against the meta line.

### The toolbar — `library/LibraryToolbar.tsx`

One band, `items-center`, `justify-between`, `bg-card` against the canvas. Search is a fixed
280px field with the sheet's inset magnifier (it was `flex-1` and ran to ~700px at 1600px).
The six chips are the sheet's 32px rectangles with its rest FILL, sharing the 36px baseline.
The count takes the sheet's mono 11px. The project control is pushed right with `ml-auto` at
the sheet's 160px floor.

⚠ `ml-auto` and **never** an `order-*` utility: create is asserted to be index 0 of every
focusable node here, so a visual re-order would be a keyboard regression.

### The page — `pages/WorkflowsPage.tsx`

Header stacks: `h1` 24px/600/`-0.02em` over a 14px subtitle (it was 20px and 13px on ONE
line). Canvas takes the sheet's even 24px margin; the grid takes its `max-w-[1200px] mx-auto`
and 16px gap.

---

## 2 · Behind a hover / an ⓘ — **nothing**

No detail was moved behind a disclosure, and none needed to be. Everything the sheet draws is
inline, and everything the shipped page already said is still inline.

The one place the question arose was the toolbar's height (§3 below), and it was answered by
letting the band grow rather than by hiding a sentence.

---

## 3 · What the sheet draws that is NOT on the wire — and two deliberate departures

**Nothing was fabricated.** Every value the sheet draws is either already on the wire or was
left unrendered:

| Sheet draws | Status |
|---|---|
| `v2.4`, `v1.0`, `v3.1` | on the wire — `face.version`, `null` when absent, never faked |
| `Worked 2 days ago` / `Failed 4 days ago` / `Stopped 3 days ago` / `Never run` / `Run by someone else` | on the wire — `runFacts`' four arms, unchanged |
| `YOURS` / `SHARED` | on the wire — `identity.own` |
| `42 share this name`, `changed last month` | on the wire — `identity.ofN` / `identity.when`, `null` ⇒ nothing rendered |
| `Main` / `Analytics` / `Marketing` / `System` / `Security` / `Sandbox` | on the wire — the folder chip's `folderName` |
| **the fifth arm** — the sheet draws no card for D-08's `unknown` | **rendered as NO MARK**, not as a grey dot. A quiet dot would make *the wire did not say* look like a fact we hold. `GUTTER_TONE.unknown` is `bg-transparent` for exactly this reason; the dot follows it |
| the sheet's `31 / 108 / 80 / 3 / 81 / 77` chip counts | fixtures. The real counts come from `chipCounts` over the rendered rows, as they already did |

**Departure 1 — the toolbar is `min-h-[68px]`, not the sheet's fixed `h-[68px]`.** Two
sentences the sheet does not draw may not be dropped: the search field's D-08 hint and the
project select's D-17 starters note. The note exists because `?project_folder_id=` narrows
only the published feed — a fact that reads as a BROKEN FILTER if left unsaid (UAT row U6).
Both are real DOM text wired by `aria-describedby`, never a tooltip, because touch has no
hover. A fixed height would have meant hiding one of them.

**Departure 2 — the page subtitle is the shipped sentence, not the sheet's.** The sheet writes
*"…author, publish, and run."*; the shipped line ends *"…and Run into a thread."* That tail is
a real product fact. The sheet is the reference for STRUCTURE; it is not a licence to delete a
true statement it had no way of knowing.

**One structure the sheet merges and this port does not:** the sheet carries the project
INSIDE the meta run (`YOURS • Main • 42 share this name • …`). The folder chip is
`column.children[3]` and the suite asserts that column's order by INDEX, so merging would be a
structural change to a pinned composition for a purely typographic gain. It takes the meta
line's exact register instead, so the two read as one block that happens to wrap.

---

## 4 · `BUG-260819-01` — CLOSED

**The bug.** The state word rendered TWICE on a name-colliding row — live, as flowing text:
`… Shared starter | SHARED • Shared starter • …`.

**Neither producer was at fault and neither was changed.** `rowIdentity.ts` ranks four
discriminating axes over rows that share a name, and `state` is one of them, so on three
same-named rows of three different provenances it correctly returns the state as the segment
that narrows. D-01's line 2 renders `face.state` **unconditionally**, on every row, by design
(*"NEITHER HALF IS EVER BLANK"*). Composed, the card said one word twice within ~40px.

**The fix is one line, at the only place that can see both.** `WorkflowCard` is the sole module
holding `face` and `identity` at once — `cardFace` cannot know what the ranker spent, and the
ranker cannot know that this surface prints the state unconditionally (a third `RowIdentity`
consumer may not). So the LIST drops a segment line 2 has already said:

```ts
...identity.segs.filter((seg) => seg !== face.state),
```

**No discrimination is lost.** The dropped segment's whole job is to tell two namesakes apart
by state — and the state is still on the card, one line up, on EVERY row including those with
no collision. The comparison is against the resolved **business word**, never a provenance
spelling: both producers already share one vocabulary home, so equal words are provably the
same word.

---

## 5 · Pins that moved — four, each with its reason written inside the pin

| Pin | Moved | Why |
|---|---|---|
| `IDENTITY_SEPARATOR` in both test helpers + the planted positive control | `·` → `•` | the sheet's glyph. ⚠ A stale helper does **not** fail loudly — it stops FILTERING, and every separator silently becomes a "part". The three literals move in one commit. The control's planted glyph is kept **by hand** rather than read from the constant it controls |
| the two verb-label pins (6 sites) | `"▶ Run"` → `"Run"`, `"✎ Open"` → `"Open"` | the glyph left the LABEL STRING, not the control — it is an `aria-hidden` `Play` / `ExternalLink` node now, which is what the sheet draws. `textContent` is still asserted **exactly**, so the pin is strictly STRONGER: it now also pins that the icon contributes no text |
| `WorkflowCard.baseline.test.tsx` → *atoms 4-7* | spread `...identity.segs` → filtered | **this is the pin that caught the bug.** It spread the resolver's segments whole and was faithfully recording a card that said `Ready to run` twice. Re-stated as the RULE, driven from the resolver's real output, plus a non-vacuity check that the filter really removed something |
| `WorkflowCard.test.tsx` → D-10 draft case | `STATE_DRAFT` removed from the expected array | same argument, plus a new assertion that the word is still PRESENT on line 2 — so a regression in either direction reds |

**No pin was re-baselined to hide a regression, and no refusal was retired** (this port did not
meet one). ⚠ The `uppercase` on the meta line is **CSS**, never a second spelling: every word
still arrives from `libraryVocabulary.ts` in sentence case, so `textContent` is unchanged and a
copy change is still a one-line diff in one file.

**+2 net-new cases**, both guarding the bug fix:
- `BUG-260819-01 — the state word is said ONCE per card, on every provenance` — three rows,
  each driven with its **own** state word, counted over rendered TEXT rather than a node query
  (the defect was visible duplication; a node query would miss a second copy from a different
  element).
- its **positive control** — a DRAFT handed `STATE_RUNNABLE`, which is a real ranker output and
  must still be spent. Without it the sweep would pass on a card that purged every
  state-shaped segment.

### The 187-24 trap fired again, and the PROSE was fixed

A sentence in `LibraryToolbar.tsx` used the obvious synonym for *"utility"* — which is F6's
subject word — and `librarySubtree.fences.test.ts` went red naming this file:
`expected [ './LibraryToolbar.tsx', …(4) ] to deeply equal [ './WorkflowCard.tsx', …(3) ]`.
Widening the fence would have put a paint comment into a record about data handling. The
wording changed; the fence did not. Recorded in the file, beside the two words it already
declines to spell.

### Fences respected

`libraryVocabulary.ts`, `libraryFilter.ts` and `cardFace.ts` were **not modified** and are not
imported from outside `library/**`. `LIBRARY_SUBTREE_PATHS.toHaveLength(14)` is untouched — no
module was added.

---

## 6 · Verification

```
tsc -p tsconfig.app.json --noEmit   → 61 lines / 19 files, ALL pre-existing. ZERO in these five.
vitest src/components/workflows/library + src/pages/WorkflowsPage.test.tsx
                                    → 13 files, 747 passed, 0 failed
vitest WorkflowCanvas + WorkflowSoul + PublishedCardDelete (the other suites
       that reference these components)
                                    → 3 files, 164 passed, 0 failed
```

`GSD_VITEST_MAX_WORKERS=2` throughout; the cap was never adjusted and nothing red ever
appeared, so SEED-171's triage procedure was not entered. Both of its named flaky suites in
this blast radius (`library/WorkflowCard.test.tsx`, `WorkflowsPage.test.tsx`) were edited by
this port and were green on the **first** run of every invocation — recorded as an observation,
not as proof of innocence.

`CLAUDE.md`, `docs/HOT-FILE-LEDGER.md` and `scripts/vitest-count-gate.cjs` were **not touched**
(sibling agents are porting other screens; those three are batched afterwards). ⚠ Two ledger
rows are owed by this port and are left for that batch: `library/WorkflowCard.tsx` (row reads
`15 / 4 / 1262`) and `pages/WorkflowsPage.tsx` (row reads `37 / 14 / 1211`) — both now stale,
and `library/LibraryToolbar.tsx` (`3 / 2 / 408`) with them.
