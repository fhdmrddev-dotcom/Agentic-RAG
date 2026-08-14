---
sketch: 165
name: the-template-lands-first
question: "Where does 'I have a template' live on the pre-draft screen, and how do its fields become a spec the author can see the draft aimed at — without slowing the person who has no template?"
winner: null
tags: [phase-193.1, auth-03, template-first, describe-door, pre-draft, generated-from-build, g2-sketch-gate, seed-157]
---

# Sketch 165: The template lands first

> **This sketch is part of the G-2 gate for Phase 193.1** (AUTH-03, the re-opened half).
> It exists because `SEED-157` measured that `POST /workflows/generate` has accepted
> `template_placeholders` since **Phase 103** and the frontend has **never sent it** —
> so a user who describes a workflow gets a draft built *blind to the template it will
> have to fill*. Nothing fails; the retrieval steps are simply designed for the wrong
> questions.

## How to view

```
start .planning/sketches/165-the-template-lands-first/index.html
```

Five tabs: **A · Today (shipped)** · **B · Mount the shipped section** ·
**C · The spec block** · **⚠ The wall** · **The contract**.

Verified at 1440×900: no horizontal scroll on any tab, all five panels switch, the
describe box measures 746 px, the KB picker offers 4 real options, the CTA is enabled
(text is typed in). Two console messages, both benign and both inherited: the `file:`
origin notice, and a devtools *"form field should have an id or name"* issue that comes
from the **shipped** `DescribeKbPicker` `<select>` (which carries an `aria-label`, so it
is labelled — the notice is about autofill, not accessibility, and this sketch did not
introduce it).

## ⚠ The mechanism — generated FROM the build, and one step further than 164

164 inverted the sketch→build arrow: `dom.generated.json` holds the *real* rendered DOM,
variants differ in text nodes only, so layout drift is impossible. 165 keeps that and
adds something 164 could not have:

**164's template panel was a pure proposal — it drew nodes no component had, and said so.
165's central surface is not.** `TemplateAttachSection.tsx` **shipped** in Phase 193 and
grew its *"What this template asks for"* list in quick task `260814-q5r`. So:

| Region on this page | Source | Drift risk |
|---|---|---|
| the describe door — header, box, KB picker, CTA, hint, switch strip | real rendered `WorkflowDoorSwitch` | **none — it *is* the build** |
| the fields list, its heading, the filename line, the refusal copy | real rendered `TemplateAttachSection` | **none — it *is* the build** |
| the attach **control** on the pre-draft screen | proposed (`NEW`) | ordinary |
| variant C's type scale and two-column grid | proposed (`CHANGE`) | ordinary |
| the stateless-read route the filled states assume | **does not exist** | a scope decision — see the ⚠ tab |

**The eight field names are parsed out of the dump, never re-typed** — `build.cjs` reads
them with a regex over the real `<li>` elements. The page therefore *cannot* display a
field the shipped component did not render. They are the real keys of
`pm-weekly-status-report.docx`, measured during `260814-q5r`.

**The structural audit is load-bearing.** A splice into an anchor that is not there fails
*silently* and produces a variant that quietly equals the baseline — a green-looking
sketch showing nothing. So every anchor is asserted **present and unique**, the field
parse is asserted to yield 8, and **every stage is asserted to actually differ from the
shipped DOM**. `build.cjs` exits non-zero otherwise. It reports **12 assertions, 0
failing**.

Reproduce the whole chain from a clean checkout:

```bash
cp .planning/sketches/165-the-template-lands-first/emit.test.tsx.src \
   frontend/src/components/workflows/__emit165.test.tsx
cd frontend && npx vitest run src/components/workflows/__emit165.test.tsx && cd ..
rm frontend/src/components/workflows/__emit165.test.tsx     # keep the app tree clean
node .planning/sketches/165-the-template-lands-first/build.cjs
# tailwind: -c a copy of frontend/tailwind.config.js whose `content` is body.generated.html,
#           -i frontend/src/index.css -o tw.generated.css --minify
node .planning/sketches/165-the-template-lands-first/assemble.cjs
```

## The variants

| | Approach | What it costs |
|---|---|---|
| **A** | **Today, shipped, byte-identical.** No template control anywhere; `onDraft` sends `{describe, project_folder_id?}` and nothing else. | The `SEED-157` defect, invisible. |
| **B** | **Mount the shipped `TemplateAttachSection` on the describe screen.** The path of least resistance — the attach control, the filename, the fields list and four honest arms already exist. | **Measured, not asserted: it imports the rail's type ramp onto a hero screen.** The fields render at **10.5 px** on a screen whose KB picker is **14 px** and whose hint is **13 px**. The most consequential thing on the page is also the quietest. |
| **C** | **The spec block** — same data, re-presented at the describe screen's own scale: two columns, monospace keys, a rule above the promise line. | Needs a `scale` prop on a component that shipped three weeks ago (the alternative — a second presentation of one list — is two homes, and two homes drift). A real change, not a mount. |

## What to look for

1. **SC#4 first, in the *empty* stages of B and C.** The person with no template must be
   able to ignore this row entirely. Does your eye still go to **Write the first draft**?
   If either variant makes a no-template author hesitate, it has failed regardless of how
   good its filled state looks.
2. **The type ramp in B's filled stage.** 10.5 px fields directly under a 14 px picker.
   Judge whether that reads as *quiet* or as *unimportant* — the difference matters,
   because this list is the whole reason the phase exists.
3. **One sentence carries SC#2:** `spec.promise` — *"The draft will be built to fill these
   8 fields."* Everything else on screen says what the **template** contains; only this
   says what the **draft** is aimed at. It states a count, so in build it must be derived
   from the list above it, never hardcoded.
4. **The ⚠ tab is not decoration.** It renders the shipped `TEMPLATE_UNSAVED_REFUSAL`
   against the state this screen is actually in, and **no file input renders at all**.
   That dead end is what the stateless-read route exists to remove.

## ⚠ Three things this sketch deliberately does NOT resolve

1. **The chicken-and-egg route shape.** B and C both assume the **stateless read** (the
   ROADMAP's recommendation on record). If planning picks *create an empty draft up front*
   instead, both filled states change. That is a CONTEXT.md decision, not something a
   chosen variant may smuggle in — the ⚠ tab exists so it cannot be.
2. **`hint.withTemplate` is priced, not decided.** Swapping the describe hint when a
   template is attached touches a string carried in `doorVocabulary.ts` and pinned
   byte-exact by `WorkflowBuilderPage.describe.test.tsx`. It is marked `CHANGE`, not
   `NEW`. If the phase declines it, the shipped sentence stays and the screen still works
   — it just promises less.
3. **The describe column scrolls once the spec block is in it.** Measured at the 660 px
   stage: `scrollHeight 761` against `clientHeight 614`. The shipped grid already has
   `overflow-y-auto`, so this is real behaviour rather than a defect — but on a laptop
   viewport the switch-to-govern strip may fall below the fold, and that is worth looking
   at rather than discovering at UAT.

## ⚠ What has no mockup anywhere on this page

The `SEED-155` exposure in its *"draws none"* form. Stated so a later reader does not
over-trust the page:

| Surface | Settled in |
|---|---|
| the read failing, or finding no fields (`SEED-158`'s plain template) | sketch **166** |
| a template attached to an already-drafted workflow, and the mismatch (SC#3) | sketch **167** |
| the govern door | out of scope — it *is* the whole Builder; same limit 164 declared |
| hover, focus, pixel spacing | a human comparison at UAT, driven **by looking** (D-27) |
