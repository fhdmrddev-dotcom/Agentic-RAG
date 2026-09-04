# Stitch pass — Phase 214, a step names its service and its action

**Generated 2026-08-28** into `projects/10710316306258284608` with design system
`assets/12493500246735489470` (*Aether Intelligence — Deep Midnight*, v3), model `GEMINI_3_1_PRO`,
`deviceType: DESKTOP`.

Brief: `../STITCH-BRIEF-214-a-step-names-its-service-and-its-action.md`. Method: `../STITCH-BRIEF.md` §6.5.

⚠ **DIRECTION, NEVER AN ACCEPTANCE BAR.** Stitch renders **zero** shipped components. The G-2 bar is
the sketch that re-expresses the chosen direction against real components — steps 1 and 4 are never
collapsed (`SEED-155`).

⚠ **Ownership:** Gemini is out of this phase; **Claude runs 214 end to end.** Recorded in the brief §0.

**Four surfaces, each generated as a base plus two variants**, per the operator's instruction to see a
range rather than one answer.

---

## ✅ The palette bound — the check 212 failed

Generated **inside the project that owns the design system**, which is the fix 213 established.

```bash
grep -oiE '#[0-9a-f]{6}' <file> | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn
```

| file | top hex | verdict |
|---|---|---|
| `01`/`02`/`03` step editor | `#f4f6fe` · `#9aa3b5` · `#151b24` · `#a3a5ff` · `#ea4335` | ✅ Deep Midnight (`#ea4335` is **Gmail's own mark** — correct) |
| `04`/`05`/`06` publish refusal | `#f4f6fe` · `#212631` · `#9aa3b5` · `#151b24` · `#0d1117` · `#a3a5ff` | ✅ |
| `07`/`10`/`11` run surface | `#a3a5ff` · `#212631` · `#6bfe8f` · `#dee2f1` · `#0e131e` | ✅ |
| `09` describe door | `#212631` · `#f4f6fe` · `#9aa3b5` · `#a3a5ff` · `#151b24` | ✅ |

**Zero occurrences** of Obsidian Archive's teal `#3cddc7` or its ground `#0b1326` in any of the eleven files.

---

## A. The step's argument form — `01` base · `02` narrow · `03` wide

### ⭐ It solved the load-bearing problem, and the answer is a SOURCE GUTTER

The brief asked: how does a row declare its source without a sentence per row? Stitch's answer is
**a leading glyph per row plus a different control shape per source**, and the three read apart at a
glance:

| argument | source | how it reads |
|---|---|---|
| `To` | typed | plain input, `procurement@aether.ai` |
| `Subject` | asked at launch | **italic** placeholder + accent-bordered field |
| `Body` | from an earlier step | an inline **chip** carrying that step's authored name — `Draft the summary` — sitting inside the field |
| `Cc` | **none yet** — and required | `REQ` marker + an empty *"Select source or type value"* |
| `Reply to` | typed | plain input |

⭐ **The chip is the real find.** An upstream binding rendered as *a chip naming the step in the
author's own words*, inline where the value will land, says "this comes from there" with **no label
at all** — and it is exactly D-214-02's *phase slug, whole output, no expression* made visible. It is
also honest about the one thing that matters: the author sees a **name they wrote**, never a path.

⭐ **`03` (wide) hoists the glyphs into a left gutter** — a literal spine of source marks you read
down the column. That is the second thing the brief asked for and it works better than the base.

### ⚠ What must NOT be carried forward

- **"Provided at run-time" is our own machinery talking.** So is `REQ`. The person's word is closer
  to *"Asked when this runs"*. `doorVocabulary` discipline applies: every one of these is a governed
  id, character-asserted, never a string living in a component.
- **`02` (narrow) is the argument against the narrow panel, not for it.** In the 400px rail the body
  chip, the field and the canvas all lose — and the canvas beside it is a dead grey plane doing
  nothing. This is direct evidence for the operator's standing objection carried from 212 and 213.
- ✅ **No JSON in any of the three.** SC#1's deletion of `MCP_TOOL_ARGS_LABEL` holds, and nothing
  crept back as an "advanced" escape hatch.

---

## B. Publish refuses — `04` base · `05` quiet canvas · `06` considered review

### ⭐ `06` is the strong one and its headline is nearly shippable

> **Email the weekly summary is missing a recipient.**

**One sentence, the step in the author's own words, and the missing argument.** That is D-214-09's
refusal contract met in a single line. Below it every other step reads `VALIDATED` / `READY` and only
the offender reads `BLOCKED`, with **`Go to step`** — so the author sees the wall did a *full* job
rather than stopping at the first thing, and the way out is one control.

### ⚠ Three things in this cluster are exactly what we said not to draw

- **`05` prints internal ids on the canvas** — `ID: b_9834`, `ID: c_4416` on the nodes. A direct
  violation of *never print the mechanism*, and the sort of thing that ships if nobody names it.
- **`05` uses a warning triangle and the words "Configuration Error"** — the brief said a refusal is
  competence, not an alarm. `06` gets the tone right; `05` does not.
- **`06`'s second line is corporate filler**: *"Publication blocked. Please resolve the outstanding
  configuration requirement to proceed."* It says nothing the headline did not, in worse words. **Cut
  it** — the headline plus `Go to step` is the whole refusal. This is the "text is noise" rule and
  Stitch failed it in the one place it mattered.
- `QUALITY REVIEW REPORT` as a chip is a stage name. `BUG-260815-06`'s whole complaint is refusals
  that name a stage instead of a cause; do not import one into the refusal that is supposed to be
  right from birth.

---

## C. The run surface — `07` base · `10` rich spine · `11` spare spine

### ⭐ SC#4 and SC#5 both land, on the same screen

- **Service mark + real action name on the spine**: `Post to Slack` / *Post a message*, `Create an
  issue`. Never "external action". ✅ `SEED-206` answered.
- **The vendorless services are drawn in the interface's own ink** — `Internal DB`, `Query Knowledge
  Base` — deliberately, not as broken images. ✅ That is `connectionMark.tsx`'s shipped rule.
- **The failed step shows ITS OWN reason**, at the size a person needs it:
  > *Channel #urgent-feedback-escalations not found or bot lacks permission to post.*

  ✅ That is `BUG-260826-05` closed on the surface that was showing *"Failure reason not captured by
  the backend"*.
- **The purpose survives the cut** — one line, human: *"Analyzing customer sentiment and escalating
  critical feedback to the team."*

### ⛔ AND ONE THING HERE IS A HARD NO — it is not a taste call

**`PAYLOAD ATTEMPTED` dumps the raw Slack JSON**, channel and message body included, on a run surface
that persists. Three reasons it cannot ship:

1. It is printing the mechanism at full volume — the single rule the design system's `designMd` is
   most explicit about.
2. **It contradicts `D-213-14` / `D-08` directly.** The arguments are shown **once, in the moment, at
   the approval pause** — *"showing a person what is about to leave is the whole point of the pause;
   writing it into a queryable ledger forever is a different act."* A run surface rendering the
   payload is that different act.
3. A recipient address or a message body on a run surface is a disclosure the receipt deliberately
   refuses to carry.

**Do not carry it into the sketch.** The failure *reason* is the deliverable here; the payload is not.

### The spine fork

**`10` (rich) satisfies SC#4; `11` (spare) does not.** SC#4 says the mark **and the action's real
name** appear on the run spine. `11` reduces the spine to bare glyphs in a rail — pretty, and you
cannot tell Slack from Jira without selecting. **Rich wins on the criterion, not on taste.**

---

## D. The describe door — `09` base (variants pending)

### ⭐ The refusal is the best-written thing in the whole pass

- The description **is** the screen, at headline weight: *"Every Monday, scan Salesforce for new leads
  and post a summary to Slack."*
- `CONNECTED SERVICES` as a quiet row of marks — Slack chosen, Jira / Gmail / GitHub available and
  unshouty. ✅ D-214-20's vocabulary picker.
- The refusal names the service and offers **exactly two next actions**:
  **`Connect Salesforce →`** · **`Revise description`**. ✅ D-214-21.
- ⭐ **The generate control carries its own reason: `Waiting for connection`** — not a greyed-out
  mystery. That is precisely the `doorVocabulary.ts` finding (*"the sheet draws the disabled button
  CARRYING ITS REASON"*) arrived at independently.

### ⚠ The gap

**Nothing ties the refusal to the words that caused it.** "Salesforce" appears in the sentence at the
top and in the refusal at the bottom, with no thread between them. The sketch should close that —
the refusal is about *something the person wrote*.

---

## Cross-cutting: what to ignore in every file

⚠ **Stitch invented three different app shells across eleven screens** — `Chat / Workflows /
Knowledge`, then `Workflows / Agents / Datasets / Deployments / Analytics`, then `Workflows / Library
/ Executions / Assets / Settings`. **All three are wrong.** Our IA is the three-homes navigation
contract; none of this pass's chrome is evidence about it. Read the centre of each screen only.

Also invented and to be ignored: `v1.0-42` version strings, `Run #8492` identifiers, `Executions` and
`Deployments` sections that do not exist.

---

## What the sketch must now settle

1. **Narrow vs wide for the step editor.** `02` vs `03` is the operator's standing objection made
   visual, and `03` is the stronger drawing. `D-27` locked the push/split panel for a **3–5 field
   form**; a field-per-argument form is a different object. ⚠ Constraint: **the app has no URL
   router** (`SEED-185`), so a detail *route* is not free.
2. **The source vocabulary**, as governed ids — replacing *"Provided at run-time"* and `REQ`.
3. **Rich spine, and how much the mark costs at small sizes** on `PhaseCard` / `RunSpine` /
   `RunStepList` / chat `RunCard`.
4. **The refusal reduced to its headline** plus `Go to step`, with the filler line and the stage chip
   deleted.
5. **Tying the describe refusal to the author's own words.**

Then that sketch — rendering `ConnectionPicker`, `ExternalActionSection`, `PhaseFormPanel`,
`PhaseCard`, `RunSpine`, `RunStepList` and `connectionMark` — is the G-2 bar.

---

## Files

| # | file | screen id |
|---|---|---|
| 01 | `01-step-editor-base` | `f22bafc578f649138450ad43b1c7b9cb` |
| 02 | `02-step-editor-narrow-structural` | `cd30c2e8cdcc4993836952c49199266b` |
| 03 | `03-step-editor-wide-source-spine` | `7358681b627a482d87fafb7bde081988` |
| 04 | `04-publish-refusal-base` | `aad78f1939b148bbb7e81270c4f3df00` |
| 05 | `05-publish-refusal-quiet-canvas` | `5d5c0c6b8de24ae6932d4036a35b327c` |
| 06 | `06-publish-refusal-considered-review` | `adad6014b9da4d39ac3270cad042c080` |
| 07 | `07-run-surface-base` | `978dd3c3f7094b738751a7b7da04b031` |
| 08 | `08-run-surface-failure-detail` | `cdcf5134cdec45aeaf11b160ecee8e28` |
| 09 | `09-describe-door-base` | `974fc68513d34c288a668e713773554e` |
| 10 | `10-run-spine-rich` | `71e316a08e754872a403a21dcef02924` |
| 11 | `11-run-spine-spare` | `301db98583f84d9ca29228a9a617cc5c` |

View: `cd .planning/sketches && python -m http.server 8899 --bind 127.0.0.1`
→ `http://127.0.0.1:8899/214-stitch-step-names-service-and-action/03-step-editor-wide-source-spine.html`
