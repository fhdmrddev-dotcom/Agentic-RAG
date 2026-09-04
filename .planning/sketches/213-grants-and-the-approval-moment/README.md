# Sketch 213 — Per-Tool Grants and the Approval Moment

**Written 2026-08-27.** ⭐ **This is the G-2 acceptance bar for Phase 213** — step 4 of the ratified
method. Step 1 (direction) is `.planning/sketches/213-stitch-grants/`; the two are never collapsed.

```
node drive.cjs           # 66 assertions — the contract, executable
node drive.cjs --emit    # ALSO regenerates BUILD-CONTRACT.generated.md FROM the running sketch
```

Open `index.html` in a browser. Current state: **66 passed, 0 failed · 7 action rows emitted.**

---

## What the operator decided, and what this sketch does with it

| decision | where it came from | how it lands here |
|---|---|---|
| **Layout A — the panel stays** | operator, choosing between A / B / the modal Stitch drew | `D-27` held. The connections list renders **real rows** beside the open panel, and `drive.cjs` asserts ≥5 of them — the property A was chosen for is tested, not assumed. |
| **Width `clamp(480px, 38%, 640px)`** | reviewer advice, operator approved | Not a bigger magic number: `ChatLayout.tsx:657` already ships `clamp(300px,30%,420px)`, so this matches a house pattern. **480 is the measured floor** where the three-way control fits *on* the row instead of wrapping under the description. |
| **The two copy lines** | operator: *"I do not understand"* | Both replaced — see below. |
| **The override mark** | operator: *"you advise"* | Kept Stitch's mechanism, **changed its colour rule** — see §2. |

---

## 1 · The two copy replacements, and why

Stitch's own words are kept beside the replacements so the change is auditable rather than silent.

| Stitch wrote | this sketch says | why |
|---|---|---|
| *"Manage agent permissions and posture for this integration."* | **"Choose what GitHub can do on your behalf."** | The original describes **our software** — `posture` and `integration` are words from the codebase. The house rule is *never name the mechanism*. A person opening this wants to know what GitHub can do to their account. |
| *"PAUSED: AWAITING HUMAN CONSENT. NO DATA HAS BEEN SENT."* | **"Paused — waiting for you."** + **"Nothing has been sent yet."** | The second half was already right and is kept almost verbatim. *"Awaiting human consent"* is what a machine says **about** a person, not **to** one. Same facts, same gravity, spoken plainly. |

---

## 2 · ⭐ The one real departure from Stitch — and it is a departure, not a drift

The operator's standing clause is *"the sketch should match perfectly Google Stitch when sketched."*
It is honoured: the composition, the hierarchy and every element are Stitch's. **One rule changed,
and it is recorded here rather than absorbed**, because an unrecorded change is exactly how the
workflow card drifted through three phases (`SEED-155`).

> **Stitch coloured the override edge BY STATE** — green for allowed, red for denied.
> **This sketch colours it by AUTHORSHIP** — always the primary indigo, whichever way you decided.

Three reasons, in weight order:

1. **One mark, one job.** Stitch's edge said *both* "you changed this" *and* "it is set to X". The
   state is already spelled out **in words** by the control on the same row, so the edge was
   re-saying it in colour — and colour is the one carrier that cannot be read reliably.
2. **It breaks the house ceiling at scale.** With green, red and amber edges plus the destructive
   tag, four state colours sit on screen at once. The rule is *at most three*, and at **44 rows** the
   list reads as a barcode.
3. **Red stops meaning anything.** Reserving `--destructive` for genuinely irreversible actions
   (`delete_repository`, `merge_pull_request`) is what keeps it legible. Spending it on "you set this
   row to Deny" — an ordinary, safe, *desirable* act — spends the alarm on a non-alarm.

**§4 of the sketch renders both side by side over the same six rows**, so the choice can be re-judged
by looking rather than by reading this paragraph.

⚠ **The edge lane is always reserved** (`border-left: 2px solid transparent` on every `.arow`).
Without it a row would shift 2px when overridden — a jitter no test catches and every scrolling eye
does. `drive.cjs` asserts it.

---

## 3 · Each invariant → the React equivalent Phase 213's suite must reproduce

`BUILD-CONTRACT.generated.md` §3 carries this as a table. The load-bearing ones:

| # | invariant | React equivalent |
|---|---|---|
| 1 | override edge is `--primary`; the rule spends **no** state colour | assert the overridden row's edge token, and assert success/destructive/warning are **absent** from that rule |
| 2 | `.arow` reserves a 2px transparent edge lane | assert an inherited and an overridden row have **identical** text offsets |
| 3 | every control has **exactly three** arms, exactly one pressed | `getAllByRole("button", {pressed: true})` is length 1 per group |
| 4 | the chosen **Deny** arm uses `--destructive`, never `--primary` | assert the pressed Deny arm's token |
| 5 | panel track is `clamp(480px,38%,640px)` | ⚠ **`ConnectionFormPanel.test.tsx:571` currently pins `400px` and MUST be updated in the same commit** — it is a shipped assertion that this sketch deliberately invalidates |
| 6 | ≥5 real connection rows beside the open panel | `D-27`'s protected property, asserted not assumed |
| 7 | unknown direction says **"Unknown"** and explains itself in real DOM text | never infer a read from an absent `readOnlyHint` |
| 8 | **zero** `[title]` attributes in rendered output | the shipped §12 fence — already asserted in `ConnectionFormPanel.test.tsx` |
| 9 | no countdown / timer / progressbar in the ask component | a person's decision time is unknowable |
| 10 | every overridden row also carries the words *"You changed this"* | colour is never the only carrier |

---

## 4 · The copy table is ported, not retyped

`COPY.js` becomes **`frontend/src/components/settings/grantsVocabulary.ts`**, beside the shipped
`connectionsCopy.ts` / `connectionFormCopy.ts` whose shape it mirrors. **The build imports the
object; it does not hunt strings through JSX.** A drifted string then fails `drive.cjs` instead of
failing a person's eye six weeks later.

---

## 5 · ⚠ Four defects the drive script caught in this sketch — recorded, because a guard nobody has seen fire is not a guard

All four were found by *running* it, none by reading it. They are kept here rather than quietly
fixed, because each is a class of error the same script will now catch in the build.

1. **`COPY.LIST_EMPTY` was declared and never rendered.** The empty state a 44-row searchable list
   reaches on the first typo did not exist. **This is precisely the gap a copy table exists to
   expose** — a string the build would otherwise have invented at the keyboard.
2. **The composed-string matcher stripped tags from ONE side.** `Always allow <span>create_pull_request</span> on this connection` failed a
   check against copy that was perfectly correct. Comparing rendered *text* to rendered *text* was
   the property wanted all along.
3. **Then it went blind to attributes.** `placeholder="Search 44 actions"` is a sentence a person
   reads, and tag-stripping erased it. **A copy check that cannot see placeholder text is blind to a
   whole class of user-facing strings** — worse than the bug it had just fixed.
4. ⚠ **The "no countdown" fence fired on this sketch's own caption saying there is no countdown.**
   The fix was to narrow the **scope** to the ask component, never to soften the pattern. *A fence
   that fires on the prose explaining the fence is measuring the annotation, not the surface.*

⚠ **And a fifth, in the emitter itself: `--emit` produced an EMPTY table while reporting success.**
The row parser split on `<div class="arow` and therefore also on `arow-main` / `arow-name` /
`arow-desc`, shredding every row into fragments that matched no field. Every assertion passed; only
a human reading the output noticed. **A generated contract that generates nothing is worse than a
transcribed one, because it looks generated.** The emitter now carries its own non-vacuity guard
(`rows.length < 6` aborts) and is scoped to §1 so §4's illustration rows cannot inflate it.

---

## 6 · What this sketch deliberately does NOT settle

- **Pixel spacing, Tailwind class choices, hover and focus states.** No generated contract can catch
  these. **Every G-4 UAT row must name this file as its reference** and be driven by *looking* —
  never by `getElementById` on a known id.
- **`SEED-214`'s unlock.** The sketch draws GitHub at 44 actions because that is the scale problem.
  ⚠ **It must not be read as designing for three one-row connections** — Slack, Jira and Email hold
  one action each *today only because of the 1:1 lock 213 removes*.
- **`BUG-260827-02`.** The grant gate is MCP-only; a capability send consults no grant at all. That
  is a backend defect folded into this phase, and no sketch can show it.
- **The audit receipt (GRANT-05).** Phases 146–148 shipped that vocabulary; inventing a second one
  here would manufacture drift where none exists.
