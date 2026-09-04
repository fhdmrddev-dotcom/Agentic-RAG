# 212 — Stitch pass 1: the catalog and its doors

**Generated 2026-08-27.** Brief: `.planning/sketches/STITCH-BRIEF-212-the-catalog.md`.
Stitch project `projects/1998980346225284960` · design system `assets/12493500246735489470` v3
("Aether Intelligence — Deep Midnight") · model `GEMINI_3_1_PRO` · `DESKTOP`.

⚠ **NONE OF THIS IS AN ACCEPTANCE BAR.** Per `STITCH-BRIEF.md` §6.5 this is step 1 of 4: Stitch gives
the *language*, the operator reacts, and only then does a normal sketch re-express the chosen
direction **against components that actually ship**. `SEED-155` is the standing reason — an approved
sketch once drew a card the components structurally could not render. Steps 1 and 4 are never
collapsed.

| # | File | Screen | Size |
|---|---|---|---|
| 1 | `01-catalog-states.{html,png}` | Connections Catalog States — populated / sparse / empty / off | 2560×2736 |
| 2 | `02-row-states.{html,png}` | Connection Row Component States — six states | 2560×2122 |
| 3 | `03-paste-url-door.{html,png}` | Add Service by Address — five stages | 2560×4010 |

View: `cd .planning/sketches && python -m http.server 8899 --bind 127.0.0.1`
→ `http://127.0.0.1:8899/212-stitch-catalog/02-row-states.html`

---

## The one finding that matters most

**The same brief produced category nouns at list scale and real purposes at component scale.**

Screen 1's rows read *"Team communication"*, *"Code repository"*, *"Issue tracking"* — which is
exactly the failure the `designMd` names: *"a beautiful grid of nouns that tells you nothing about
the work."* Rule 1 (**TEXT IS NOISE, CUT IT**) was obeyed; rule 2 (**THE PURPOSE MUST SURVIVE THE
CUT**) was not.

Screen 2, asked for the *same row*, wrote *"Post updates and read channels in your workspace."* —
which is the purpose, at full weight, in one line.

**Screen 2's line is the house voice. Screen 1's is the trap.** Any variant pass should hold screen
2's copy standard at list density and see whether it survives ten rows.

---

## Honest read, per screen

### 1 · Catalog states

**Right:**
- **The uncurated row works.** `deepwiki` sits in the same list as Slack at identical height and
  weight, with a purpose-built mark rather than a grey fallback — not degraded, not errored, not a
  lesser tier. This is what migration 127's `service_id` comment binds us to and it is the hardest
  requirement in the phase.
- Filters are exactly `All / Connected / Not connected`. No capability filter anywhere — `CAT-03`
  holds and `SEED-207`'s retirement is visible rather than described.
- Every state says its word beside its dot. No colour-only state.
- No tool counts, no fabricated numbers, no mechanism vocabulary — no protocol name, no URL, no
  `capability`, no `service_id`.
- Popular is a group **inside** the list, not a separate shelf.
- The off state **removes** writes rather than greying them, with one calm line.

**Wrong:**
- Purpose lines are category nouns (see above).
- **Marks are two-letter monograms** (`SL`, `GH`, `NO`, `JI`). This conflicts with the single-source
  icon convention — provider marks come from `@lobehub/icons`. As drawn, the mark column is not
  buildable; the *generic* mark it invented for `deepwiki` is the part worth keeping.
- The EMPTY frame actually drew a **filtered** view (Not-connected active, Slack listed) rather than
  "nothing connected yet". That state did not get answered.

### 2 · Row component states — the strongest of the three

**Right:**
- **Purpose lines are real purposes.** *"Post updates and read channels in your workspace."*
- **The needs-attention row is excellent and quotable:** *"Your login for this service has expired,
  and updates have stopped."* — says what is wrong AND what it means for the person, with no error
  code, no status number, no field name.
- The uncurated row carries **`ADDED VIA URL`** as provenance, not as a warning — which is the
  distinction the brief asked for and the one most designs get wrong.
- **The unknown-purpose row has three arms, not two**: explicit *"Unknown purpose"* in words, plus a
  `Define` action. Never blank, never a tick, never invented copy.
- Writes-removed row has no action at all rather than a disabled one.

**Wrong / to watch:**
- `deepwiki`'s mark is rendered dimmer and greyer than Slack's and Jira's. It is close to first-class
  but not quite there — the brief's requirement was *same weight*, and a duller mark reads as a
  quieter tier. Worth pushing in a variant.
- Monogram marks again.

### 3 · Add-service-by-address — the novel moment

**Right:**
- **Stage 1's sentence is the whole design in one line:** *"We'll check what this service offers and
  show you a preview before anything is saved."* No jargon, no protocol, understandable by someone
  who has never heard of any of this.
- **Stage 2 obeys the no-progress-signal rule exactly** — `Checking… 0:04`, elapsed time only. No
  percentage, no bar, no "3 of 7". This is one non-streaming request and the design does not pretend
  otherwise.
- **Stage 3 makes "nothing saved yet" unmistakable**, in words, above a real readable list of
  **three** items — the true number, not a flattering twelve.
- **Stages 4 and 5 read as genuinely different outcomes**: *"We can't connect to this address for
  security reasons"* vs *"We reached the address, but it didn't respond with any services."* Both
  offer `Edit Address`. Stage 5 renders `Status: Unknown` explicitly.
- No error codes, no internal rule names, no guard names anywhere.

**Wrong:**
- ⚠ **Vocabulary collision: it calls the three discovered things "Services"** (*"Review Services"*,
  *"Add Services"*). They are the **tools of one service**. The service is `deepwiki`; the three are
  what it offers. This will collide head-on with Phase 213's per-tool grants, where "service" and
  "tool" are two different grains that must stay distinct. **This is the one thing to fix before the
  language is adopted.**
- **Stage 4 collapses several refusal reasons into one sentence.** Measured in `egress.py`, the
  validator refuses on at least four distinct grounds — non-HTTPS scheme, non-ASCII host,
  unresolvable host, and a non-public address. *"Please use a standard web address"* does not tell a
  person who pasted `http://…` what to change. More than one refusal exists; the copy needs more than
  one arm.
- Icons are Material Symbols names (`gpp_bad`, `timer_off`, `link`, `info`), not our convention.
  Direction-only, but do not carry them into a sketch.

---

## What is buildable, and what would cost a refactor

- **Screen 2's row, as drawn, is close to buildable** against the shipped row — the states map onto
  what `ConnectionsTab.tsx` already renders. The copy is the change, not the structure.
- **The mark column is not buildable as drawn** in any of the three. Monograms conflict with
  `@lobehub/icons`. The genuine open design problem — worth solving deliberately — is *the generic
  mark for a service nobody curated*, which is the one thing `@lobehub` cannot supply.
- **Screen 3's five stages do not exist in the product at all.** There is no pre-save discovery
  preview today; `ConnectionFormPanel.tsx` saves and then discovers. This is new surface, which is
  why it is the phase's most novel moment — and why it is also where a build would cost the most.

---

## Not generated in this pass

Rows 3, 4, 6 and 7 of the brief's §4 — the filter chip row on its own, the Popular row on its own,
the edit form with grants preserved, and the victim-naming delete sheet. Held deliberately: the brief
says generate the list, the row and the door first so the rest inherits a settled language rather
than each inventing one.

**Deliberately out of scope:** the per-tool grant list and the approval moment. Those are **Phase
213**, which owes its own G-2 sketch.

---

## Open, and not for these files to settle

`BUS-013` asks the operator how to sequence this against Phase 212's already-locked `212-UI-SPEC.md`
and five written plans. `BUS-014` asks Gemini to hold the frontend plans until that is answered.
Nothing here authorises a source edit.


---

# Pass 2 — variants on the row, and a vocabulary fix

**Same session, 2026-08-27.** Six more renders. Files:

| File | What it asks |
|---|---|
| `A-purpose-first.{html,png}` | the purpose line is the LOUDEST thing; the name demotes to a label |
| `B-name-leads.{html,png}` | name leads, purpose beneath at reading weight, action arrives ON HOVER — every state shown at rest AND hovered |
| `C-density.{html,png}` | **the stress test** — the same row at 3 rows (real) and at 12 rows (aspirational), side by side |
| `V1-auto-purpose-first.png` · `V2-auto-structured-columns.png` · `V3-auto-balanced-horizontal.png` | the three `generate_variants` produced on its own |

## ⚠ Two tool findings that change how the next pass is driven

**1 · The design system did NOT bind, on any of the nine renders.** `assets/12493500246735489470`
("Aether Intelligence — Deep Midnight") is scoped to project `10710316306258284608`. Passed into this
project it was **silently ignored** — no error — and Stitch auto-created **"Obsidian Archive"**
(teal `#2dd4bf` on `#0b1326`). Measured on every downloaded file: **zero** occurrences of Deep
Midnight's `#A3A5FF` or `#0D1117`.

**So every image in this directory is in the WRONG PALETTE.** That is survivable only because Stitch
output is DIRECTION and the sketch step re-expresses it against `frontend/src/index.css` tokens
anyway — **but nothing downstream may read these colours literally.** Judge composition, hierarchy,
rhythm and copy here. Never colour.

**2 · `edit_screens` reports success and changes nothing.** It returned four DOM operations with
matching `verified_html_context`; the served file was byte-identical (same file id, same md5) and
still byte-identical 25 minutes later. **The service/tool vocabulary fix in `03-paste-url-door.html`
was therefore applied BY HAND to the local file, not by Stitch** — the Stitch-side screen still reads
"Review Services" / "Add Services". Verify Stitch writes by bytes, never by the tool's report.

## The vocabulary fix, applied

`03-paste-url-door.html`, five strings — the service/tool grain now holds throughout, and it matters
because Phase 213 grants at the TOOL grain while 212 adds at the SERVICE grain:

| was | now |
|---|---|
| "Review Services" | "deepwiki — what it offers" |
| "Review the services below before adding them." | "Review the **tools** below before adding **the service**." |
| "Add Services" | "Add **service**" (singular — one service, three tools) |
| "didn't respond with any services" | "didn't respond with any **tools**" |
| "Contacting the address to discover available services." | "Contacting the address to see what **this service** offers." |

`grep -oi 'services'` now returns **0**. The "Nothing has been saved yet" promise is untouched.

## What the variants actually answered

### C is the one that earns its place — the purpose line SURVIVES density

This was the open question from pass 1 and C answers it directly. At twelve rows the name and
purpose **collapse onto one line together** and the list stays scannable; the purpose does not become
a wall of prose. Better still, **the filler rows held the house voice unprompted** — *"Track code
changes and manage pull requests"*, *"Organize notes and collaborate on documents"*, *"Chat with
customers and manage support tickets"*. Not one category noun in twelve rows. **The standard is
reachable at scale, not just in a showcase of three.**

⚠ **But C exposes a new category error, and it is the important find of this pass: `Uncurated` is
being rendered as a STATE, in the same column and slot as `Connected` / `Not Connected`.** So at
density `deepwiki` and `Custom Service A` show *"Uncurated"* where every other row shows its
connection state — **and you therefore cannot tell whether they are connected at all.** Provenance
has eaten the state. This is the peer problem from pass 1 resurfacing in a subtler form: the
uncurated row is no longer visually lesser, it is now *differently classified*, which is worse
because it costs the reader real information. **Provenance and connection state are two axes and
must not share one slot.**

Also honest in C: the needs-attention sentence wraps to a second line at density, breaking the
one-line rhythm twice in twelve rows. That is a real cost, drawn rather than hidden.

### A — purpose-first works, and quietly drops the mark

The hierarchy inversion reads well and is genuinely calm. But **five of six rows lost their brand
mark entirely** — only the uncurated row kept one. That breaks `CAT-01` ("each with its own mark")
and inverts the peer problem a third way: the uncurated row becomes the *loudest* thing in the list.
Worth knowing that pushing the purpose this hard costs the mark unless the mark is defended.

### B — the hover question, answered cleanly

At rest: name + purpose, nothing else. On hover: one action fades in. Six states × rest/hover, so the
difference is legible. **The needs-attention row correctly refuses to wait for hover** — it shows its
alert at rest, which is the right exception. **The writes-removed row shows nothing on hover**, and
that absence is the design. This is the most directly buildable of the three.

### V1–V3 — the auto-variants

`Purpose-First` re-derives A. `Structured Columns` and `Balanced Horizontal` are layout explorations
that neither push the purpose line nor test density. **The hand-written prompts produced the more
useful range**, because they could name the question; the auto-variants explore whatever they choose.

## What to push next, if there is a pass 3

The open questions this pass created rather than closed:

1. **Split provenance from state** — C's `Uncurated`-as-state must become two independent signals.
2. **Defend the mark while keeping purpose loud** — A's trade-off is not obviously necessary.
3. **The needs-attention sentence at density** — it wraps; either it shortens or the row grows.
4. **Generate in project `10710316306258284608`** so Deep Midnight actually binds.

Still nothing here is an acceptance bar. `BUS-013` remains unanswered.
