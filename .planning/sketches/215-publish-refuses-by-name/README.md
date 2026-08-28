---
sketch: 215
name: publish-refuses-by-name
question: "When publish refuses a step nothing can supply, what does it say — and what must it never say?"
winner: null
tags: [phase-214, step-03, publish, refusal, gauntlet, g-2]
---

# Sketch 215 — Publish refuses by name

**Written 2026-08-28.** One of four G-2 acceptance bars for Phase 214. Step 1 (direction) is
`.planning/sketches/214-stitch-step-names-service-and-action/` screens `04`/`05`/`06`.

```
node drive.cjs           # 129 assertions
node drive.cjs --emit    # regenerates BUILD-CONTRACT.generated.md FROM the running sketch
```

Current state: **129 passed, 0 failed.** Open `index.html`, or serve `.planning/sketches/` on
`:8899`.

---

## Variants

| tab | what it is |
|---|---|
| **A · the considered review** | Stitch's `06` with the filler line and the stage chip cut. Count, offenders, the shipped gauntlet spine below the cause, and the not-retroactive note. |
| **B · refused on the canvas** | Same words beside the steps that caused them. ⚠ The trade is scale: two offenders read fine, the fourteenth is off-screen and there is no count. Also carries the **singular** refusal card. |
| **§3 · what a refusal must not say** | Stitch's four failures, kept **struck through beside their replacements** rather than deleted. |
| **§4 · all five refusals** | One per way a source arm can be unproved (D-214-09), each with its own sentence and its own way out. |

---

## 1 · The refusal contract, in one line

> **Every refusal names the step in the author's own words, the argument by the name they saw on
> the form, and exactly one way out.**

D-214-09 gives the first two; the ROADMAP gives the third — *a refusal is only honest if it names
the next action.* `drive.cjs` asserts all three on **every** rendered refusal, so a sixth kind
added later cannot skip one.

**The one deliberate exception is itself asserted.** `REFUSE_SHAPE_UNKNOWN` names **no argument**,
because when the action's schema was never discovered there *is* no argument name to give —
inventing one would break *"never draw a name the system cannot know"* on a refusal surface. The
drive asserts that it names none, rather than letting the omission look like an oversight.

---

## 2 · ⭐ Five refusals, not one — and why that is not over-design

Each source arm is proved **on its own terms**, so each failure is a different fact about the world:

| kind | what is wrong | why it needs its own sentence |
|---|---|---|
| `no-source` | no arm chosen, or *Set here* left empty | the author has not done it yet |
| `ask-undeclared` | *Ask at launch* chosen, key absent from `inputs[]` | ⭐ **`BUG-260826-01` itself** — a declared intention no launcher can honour. **This gate exists because that exact shape shipped once already.** |
| `upstream-unreachable` | the named phase exists but is not upstream | the fix is the graph, not the form |
| `shape-unknown` | the action's schema was never discovered | the fix is **re-discovery**, not an edit — the one refusal with a second control |
| `unrenderable` | a required argument this form structurally cannot fill (D-214-06) | the fix is a different action. ⚠ **Not a JSON box.** |

A single *"this step is invalid"* headline would collapse all five — which is `BUG-260815-06`'s
stage-naming failure in a new costume.

---

## 3 · The four cuts, and the one thing that was kept

§3 renders each of Stitch's four beside its replacement.

| cut | why |
|---|---|
| *"Publication blocked. Please resolve the outstanding configuration requirement to proceed."* | Says nothing the headline did not, in worse words. ⚠ The one place the stitch pass failed its own *text is noise, cut it* rule. |
| `QUALITY REVIEW REPORT` as a chip above the cause | ⚠ `BUG-260815-06`'s whole complaint is refusals that name a **stage** instead of a **cause**. |
| `ID: b_9834` on the canvas nodes | *Never print the mechanism* — and exactly the sort of thing that ships if nobody names it. |
| ⚠ *"Configuration Error"* + the warning triangle | **A refusal is competence, not an alarm.** |

**Kept:** the gauntlet's ten stage rows — but **below** the cause, and `drive.cjs` asserts the DOM
order. The shipped spine (`PublishGauntlet.tsx:169-180`) is honest and D-214-13 does not touch it.
*A spine saying where the run stopped is a different act from a stage name standing in place of a
reason.*

⚠ **Two spine invariants are asserted because a spine can lie by omission:** exactly one stage is
blocked, and **every stage after it reads *Not reached*.** A later stage rendered as *Checked* would
claim a check that never ran.

---

## 4 · The colour rule, which is structural rather than taste

**This surface spends `warning` and nothing else.** `--color-danger` is reserved for genuinely
irreversible acts; spending it on *"this step is not finished yet"* — an ordinary, safe, expected
state — is what stops red meaning anything. That is 213's override-mark argument applied one surface
over, and `drive.cjs` asserts `--color-danger` is unused in the whole file.

⚠ **The blocked node's mark is a left-edge lane, never the top-right corner.** D-185 claimed the
card's corner for the governance seal — *"top-right of the card is claimed; governance spends no
colour and no third badge"* — so a refusal mark there would be a second thing in a slot already
spoken for.

---

## 5 · Two promises the surface makes out loud

**D-214-11 — the golden run checked and sent nothing.** *"Checked what each step would send.
Nothing was sent."* ⭐ D-16's no-send line is untouched, and it is **said** rather than assumed: an
author watching a publish check an email step has every reason to wonder whether it just emailed
someone.

**D-214-12 — nothing retroactive.** *"Published workflows keep running — this check applies the next
time one is published."* Refusing to *run* already-published rows would un-run live workflows without
warning.

---

## 6 · ⚠ Three things in `drive.cjs` that are findings, not plumbing

**a · A stripped tag opens a space against the punctuation it sat beside.** `“<span
class="qs">Email the weekly summary</span>”` strips to `“ Email the weekly summary ”`, so a raw
`includes()` of the composed sentence fails on copy that is perfectly correct. `norm()` closes it —
**on both sides.** Normalising only one is 213's measured first-draft bug, ported as a rule.

**b · ⭐ The author's own step name is not our stage vocabulary, and the first draft of the fence
could not tell the difference.** A step legitimately named *"Commit the changelog"* tripped the
`Commit` stage check. Left in, that false positive would have pressured the sketch to **rename real
content to satisfy a guard**. The fix removes the `.qs` spans — names *we did not write* — before
the fence reads the headline, with three positive controls proving the exclusion removed the author's
words and kept the product's. The same exclusion now covers the severity-word fence, because an
author may legitimately name a step *"Handle the error"*.

**c · A fence written as `class="rgo"` read variant B as having no way out at all.** On the canvas
the way out is **merged into the step's own name** (`rgo rgo-quiet`) — a *"go to the step"* offered
to someone already looking at the step points at where they are. Same role, same affordance,
different noun. The `\b`-anchored match sees it; the literal one did not.

---

## 7 · Where the gate lives, and the trap already in the code

D-214-10 puts it in the **pre-golden-run lint** — `publish_service.py:175` short-circuits before
anything runs, so a refusal costs no model call and no wall-clock.

⚠ **`reachability.py:67` already does this shape of check against
`_KNOWN_RUN_INPUT_KEYS = frozenset({"kickoff_prompt", "topic"})` — and that allowlist is exactly why
nothing sees the defect today.** An adapter's `INPUT_SCHEMA` requirements are not `input_keys`.
Whether the gate extends stage 2 or becomes a sibling lint is discretionary; being **cheap and before
the golden run** is not.

---

## 8 · What this sketch does not cover

- **The argument form the refusal points back at** → sketch 214.
- **The run-time failure reason** (`BUG-260826-05`) → sketch 216. Publish refusing and a run failing
  are different moments with different vocabularies.
- **The other five gauntlet stages' refusal copy** — ⚠ deliberately untouched. D-214-13 folds
  `BUG-260815-06` **at this new refusal's edge only**; the bug stays `open` with its trigger
  rewritten to record that it fired here and was declined for the second time.
