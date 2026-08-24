---
sketch: 164
name: telling-the-doors-apart
question: "Which wording lets someone who has never seen the Builder predict what each door does — before clicking?"
winner: "D — the mix (2026-08-13, operator). B's door NAMES + C's two TIER labels, derived not re-typed. The header-strip fix is IN SCOPE for 193."
tags: [phase-193, auth-01, auth-03, doors, naming, copy, template-placement, acceptance-bar, build-contract, anti-drift, g2-sketch-gate]
---

# Sketch 164: Telling the doors apart

> **This sketch is the G-2 gate for Phase 193** (AUTH-01 + AUTH-03). It exists because
> SEED-147 records an operator who, using the shipped v3.6 Builder on live cloud, could not
> tell *"Describe & run"* from *"Author & govern"* — *"there is no difference between governor
> and author and the other one if we want to draft the work."*

## How to view

```
start .planning/sketches/164-telling-the-doors-apart/index.html
```

Five tabs: **A · Today (shipped)** · **B · Plain verbs** · **C · Name the cost** ·
**AUTH-03 · Where the template goes** · **The contract**.

Verified at 1440×900: the two door cards sit side by side (537 px each, tops aligned),
both stages render unclipped, no horizontal scroll, one console message (a benign
`file:` origin notice, not a page error).

## ⚠ The mechanism — this sketch is generated FROM the build, not toward it

The operator's standing note is that *"I always see a difference between the sketch we do and
the actual implementation."* Sketch 163 shipped three artifacts to close that, and it still
was not enough: **UAT row U8 failed in 192.1 because sketch 163 drew a bordered counter pill
the card structurally cannot render** (→ `SEED-155`). The reason is a direction problem —
163's `BUILD-CONTRACT.generated.md` was emitted *from the running sketch*, so the sketch was
still the source of truth and could still describe something unbuildable.

**164 reverses the arrow.**

| Step | Artifact | What it guarantees |
|---|---|---|
| 1 | `emit.test.tsx.src` renders the **real** `WorkflowDoorSwitch` (chooser · describe door · **govern door**) + **real** `library/RunModal` under jsdom — **four** dumps since 2026-08-13, not three | `dom.generated.json` is the actual shipped DOM, not a redraw. A string no dump holds cannot be governed by the contract, which is exactly how `strip.labelGovern` went missing — see the dated section at the end. |
| 2 | `build.cjs` applies the **COPY table** to that DOM | variants differ in *text nodes only* — layout drift is impossible |
| 3 | the project's own `tailwind.config.js` builds the CSS over the generated HTML | the theme tokens are the app's Deep Midnight values, not an approximation |
| 4 | `build.cjs` emits `BUILD-CONTRACT.generated.md` from the same COPY table | the contract cannot go stale by being forgotten |

**The audit is load-bearing, and it caught its own bug on the first run.** `build.cjs` verifies
every substitution actually matched the real DOM and exits non-zero otherwise — a miss means
the COPY table has drifted from the component. Run 1 reported *37 misses*; that was the audit
comparing every string against *every* dump, when most strings live in exactly one surface.
Aggregated correctly (a real miss = matched in **no** dump) it reports **37 matched, zero
missed**. A green audit is therefore evidence, not decoration.

⚠ **That `37` was measured before variant D existed, and is CORRECTED ON MEASUREMENT here
(2026-08-13, plan `193-04`): it was already `55` at this plan's base** (B 18 + C 19 + D 18), **and it
is `57` now** (B 19 + C 19 + D 19, with the 21st id and the govern dump). The run-1 *lesson* is
unchanged and is what the paragraph is for; only its arithmetic went stale — as a figure written at
one moment always will. See the dated section at the end of this file.

Reproduce the whole chain from a clean checkout:

```bash
cp .planning/sketches/164-telling-the-doors-apart/emit.test.tsx.src \
   frontend/src/components/workflows/__emit164.test.tsx
cd frontend && npx vitest run src/components/workflows/__emit164.test.tsx && cd ..
rm frontend/src/components/workflows/__emit164.test.tsx     # keep the app tree clean
node .planning/sketches/164-telling-the-doors-apart/build.cjs
# tailwind: -c a config whose `content` is body.generated.html, -i frontend/src/index.css
node .planning/sketches/164-telling-the-doors-apart/assemble.cjs
```

## ⚠ Three measured corrections to SEED-147 — the seed's own suspects were never checked

The seed lists three suspects and says plainly *"none yet measured"*. Measured now:

| Suspect | Verdict |
|---|---|
| **#1 — "Author & govern" is two verbs and one is jargon** | **STANDS.** Unchanged since Phase 124. This is what variants B and C attack. |
| **#2 — the return control reads as a peer of the two doors** | **STANDS, and it is STRUCTURAL.** Measured: inside an open door the strip is `‹ both doors` + the current-door label; in the *govern* door it is those two **plus** `🔒 judge always-on` — three items as visual peers. That is the *"other one"* the operator could not name. |
| **#3 — "nothing states the consequence of the choice"** | **FALSE as written.** The chooser already renders, per door, an icon, a tier label (`loose · fastest path` / `power · full control`), a consequence sentence, and an italic footnote — plus *"nothing is locked, you can switch anytime"* at the top. See tab A. |

**And the chooser is reachable, which nothing had verified.** A fresh Create runs
`onCreate={openBuilderFresh}` → `builderInitial=null` → `initialDoor="both"`. So the operator
did see a chooser; the failure is that its *words* did not separate the doors, not that the
choice was hidden.

⇒ **What #3 being false changes:** the phase is not "add a consequence line" — it is *the
consequence is stated as a FEATURE LIST, in the product's vocabulary*. Variant C attacks
exactly that by stating what **you** have to supply (one paragraph vs every setting).

## The three variants

| | Axis | Door A | Door B |
|---|---|---|---|
| **A** | today, shipped, byte-identical baseline | Describe & run | Author & govern |
| **B** | **plain verbs** — one plain verb per door; the return control becomes an escape (`‹ Change how I start`) rather than a noun | Draft it for me | Build it myself |
| **C** | **name the cost** — lead with what *you* must supply, not what the feature contains | Describe it | Set it up yourself |

Every varied string, with its JSX anchor and all three values, is in
`BUILD-CONTRACT.generated.md` and on the **contract** tab. The build **ports that table into a
vocabulary module and imports it** (the shipped `libraryVocabulary.ts` shape) rather than
re-typing strings into JSX — which is the mechanism that made this sketch's own audit possible.

## AUTH-03 — where the template goes

**The capability shipped in Phase 152 and is NOT being rebuilt** (SEED-110 is closed). What is
wrong is placement, and the finding that makes this more than a copy change:

**The signal is derivable.** A template-filling workflow declares itself — a fill phase admits
`render_template` in its phase tool whitelist (`backend/app/services/harness/phase_types.py:388`
is the authority; re-derive the definition-side field name at plan time rather than trusting
this sentence). So *"does this workflow want a template?"* is an honest question the app can
answer.

Today it does not ask. The `Upload template` button renders on **every** workflow,
deliberately quiet and unlabelled — so the ~100 rows that never fill a template each carry a
control they cannot use, and the ones that do say nothing about it. The proposal (operator
pick, 2026-08-13): **mark it on the card, name it in the Run modal, and render nothing for
workflows that do not fill one.**

## ✅ THE OPERATOR'S DECISION — 2026-08-13

Both answers, recorded here because the first attempt to act on them was lost to a laptop
restart before a single byte reached disk. (Nothing was recoverable: no commit, no file, no
transcript message, no subagent — the session died with the question still on screen. That is
why this section exists **before** any planning artifact does.)

**1 · Door wording → VARIANT D, "the mix".** B's door NAMES with C's two uppercase TIER
labels:

```
you write one paragraph           you decide every setting
Draft it for me                   Build it myself
              ‹ Change how I start
```

*Why:* B's names answer **who does the work**, which is the question SEED-147's operator
actually had. C's tiers state **what it costs you** where B's state a benefit — and benefits
are what made the shipped wording vague. Everything else in D is B verbatim.

**D is DERIVED, never re-typed** (`build.cjs` — `D_FROM_C`): it reads B for every id except
`doorA.tier` / `doorB.tier`, which read C. A hand-typed D would be a *third* copy of every
string, free to drift the moment B or C is touched — precisely the failure this sketch's
generate-from-the-build mechanism exists to prevent. The regenerated substitution audit reports
**D: 18 matched, zero misses** against the real DOM. ⚠ **Now `D: 19 matched, zero misses`** — D-23
added the 21st id on 2026-08-13. The decision above is unchanged; only its count moved.

A, B and C stay on the page and in the contract table as the comparison that produced the
pick. They are **evidence, not live options** — the build ports column D.

**2 · The header strip → IN SCOPE for Phase 193.** See below; this is the half of SEED-147
that copy provably cannot reach.

## ⚠ What this sketch deliberately does NOT resolve

1. **The header-strip stacking (suspect #2).** Copy can make the return control *read* as an
   escape; it cannot restack the strip or demote the `🔒 judge always-on` badge. That is a
   structural decision and belongs in `193-CONTEXT.md` on its own, **not** smuggled in as part
   of a chosen variant. **→ The operator ruled it IN SCOPE for 193 on 2026-08-13.** It stays
   listed here as unresolved *by this sketch* — the sketch shows no mockup of the restack, so
   193 owes it a design decision in CONTEXT.md, not a copy row. Today the govern strip renders
   `‹ both doors` · `🔧 Author & govern` · `🔒 judge always-on` as three visual peers; the
   agreed direction is to demote the return control to a quiet escape and separate the judge
   badge from the door group.
2. **The template panel is a PROPOSAL, not a generated dump** — it adds nodes no component has
   yet, so there was nothing real to render. Its contract rows are marked `NEW` / `CHANGE`
   rather than `SHIPPED`. Normal sketch-drift risk applies there and nowhere else on the page.
3. **Pixel spacing, Tailwind class choices, hover/focus states.** A human comparison at UAT —
   and the G-4 rows MUST name this file as the reference and be driven **by looking**, never by
   `getElementById` on a known id (D-27, the rule Phase 192's own re-drive broke).

## 2026-08-13 — regenerated: the 21st id, and what this sketch still cannot show (plan `193-04`)

### 1 · `strip.labelGovern` — an id that did not exist when the operator picked variant D

`WorkflowDoorSwitch.tsx:166` renders `🔧 Author &amp; govern` — the current-door label inside the
**govern** strip. It was never in the COPY table (`strip.label` above is scoped to the *describe*
door's label), and the emitter never rendered the govern door, so `dom.generated.json` never held
the string either. **The audit could not have caught this**: a contract cannot govern a string no
dump contains, and it cannot report a miss on an id nobody declared. It was found at plan time
(`193-RESEARCH.md` § B.4).

Left alone, `🔧 Author & govern` would after variant D become **the one surviving instance in the
whole product of the exact wording SEED-147 reports as illegible** — on the door whose card now
reads *Build it myself*. That is the AUTH-01 failure inverted, not a leftover.

Under **D-23** it is now the 21st governed id: `B` / `D` = **`Build it myself`**, echoing the door
name so the label confirms the choice in the same words used to make it. `C` is deliberately
**absent** — the operator ruled on the shipped→D transition, and inventing a C value would be the
re-typing D-02 forbids, so the contract honestly renders *(inherit)* there.

**D is still DERIVED.** `D_FROM_C` is unchanged at `{doorA.tier, doorB.tier}`; the new id takes its
B value like every other id, and it entered through `build.cjs` rather than through JSX.

### 2 · The emitter now dumps FOUR surfaces, not three

```
EMITTED chooser=2079B describe=24089B govern=2172B runModal=2914B
```

`dom.generated.json` keys: `chooser, describe, govern, runModal`. The govern dump is the
**standalone** (non-`inline`) door — the flag-OFF path, the only one where the current-door label
renders inside this shell's own band.

⚠ **The govern dump is AUDITED but NOT STAGED, and that limit is stated rather than implied.** The
govern door *is* the whole `WorkflowBuilderPage`; drawing it here would put a second full app
surface on a page whose question is about words on the doors. So this sketch makes **no layout
claim** about the govern door — only its one string is governed. The generated contract's
drift-risk table says the same thing, so the limit survives in the artifact and not just here.

### 3 · The regenerated audit, read out of the contract rather than predicted

| | before | after |
|---|---|---|
| Variant B | 18 matched, 0 missed | **19 matched, 0 missed** |
| Variant C | 19 matched, 0 missed | **19 matched, 0 missed** |
| Variant D | 18 matched, 0 missed | **19 matched, 0 missed** |
| total | 55 | **57** |

C is unchanged because it declares no value for the new id. The COPY table now renders **21**
substantive rows; ⚠ `COPY[]` itself holds **22** entries — `describe.hint` carries `shipped: null`
(a composite descriptor, not a substitutable string) and is filtered out of the table. **The two
numbers are not the same and neither may be quoted as the other.**

### 4 · ⚠ The `🔧` asymmetry — a consequence, not a choice, and it is routed to **U6**

Under D-23 the govern strip label **loses its `🔧` glyph** (`🔧 Author & govern` → `Build it
myself`) while the describe strip **keeps its `⚡`** (`⚡ Describe & run` → `⚡ Drafting it for
you`). That falls directly out of D-23's wording — *"its string becomes variant D's door name"* —
and was not a discretionary decision made while regenerating. It is recorded rather than smoothed,
and it is an explicit thing to **look at** on UAT row **U6** (*"Open the govern door after variant D
lands. Does the header label agree with the door card that opened it?"*). If the operator wants the
glyph back, that is a one-cell edit to this table and a regenerate — not a code change.

### 5 · ⚠ What this sketch still does NOT cover — three surfaces with no mockup at all

Restated so a later reader does not over-trust the page. This is the SEED-155 exposure in its
**"draws none"** form rather than its "draws a wrong one" form — and the second form is the one
that failed U8 in 192.1, so the first deserves at least as much suspicion.

| Surface | Decisions | Mockup | Driven hardest at |
|---|---|---|---|
| The **govern** band restack (quiet escape + divider, judge badge unmoved) | D-03 / D-04 | **none, on either `inline` value** | **U3** |
| The **describe** band restack (demotion only, no divider) | D-22 | **none** — decided at plan time, after this sketch was drawn | **U3b** |
| AUTH-03: `card.templateMark`, `run.templateLabel`, `run.templateAbsent` | D-13 / D-15 / D-17 | **none — the template panel is a PROPOSAL**; no visual acceptance bar of any kind exists for these three | **U4**, **U5** |

⇒ **Rows U3 / U3b / U4 / U5 are the acceptance bar for everything in this table**, because nothing
on this page is. They must be driven **by looking**, per D-27.
