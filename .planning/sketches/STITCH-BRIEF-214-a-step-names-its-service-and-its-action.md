# STITCH BRIEF — Phase 214, a step names its service and its action

**Written 2026-08-28.** Method: `STITCH-BRIEF.md` §6.5 — Stitch first for the language, then a
normal sketch that renders components that actually ship. **Steps 1 and 4 are never collapsed**
(`SEED-155`).

⚠ **OWNERSHIP CHANGED FOR THIS PHASE.** Gemini is out (exhausted); **Claude plans and executes 214
end to end.** The `feedback_gemini_plans_claude_reviews_pipeline` division of labour does not apply
here. What survives from it, and must be applied to my own work rather than to someone else's, is
the four-check list the 204 post-mortem produced: **cross-plan seam audit · an integration test that
mocks NEITHER side · reachability of every new surface · every threat-model mitigation has a test.**
Reviewing my own plans is weaker than reviewing Gemini's, so those checks become mechanical
obligations in the plan, not a judgement call at review time.

---

## 1. WHAT THIS PHASE IS

An author adds an external step by picking a **service** and then a **named action**; that step's
required arguments arrive from whatever launched the run; publish **refuses** a step nothing can
satisfy; and **every surface a run appears on** says which service and which action — including when
it fails.

Full decisions: `.planning/phases/214-a-step-names-its-service-and-its-action/214-CONTEXT.md`
(D-214-00..21). This brief carries only what Stitch needs.

---

## 2. THE FOUR SURFACES TO SEE

### A. The step's argument form — **the new surface, and the reason this brief exists**

The service and the action are already picked (Phase 211 shipped that: *one question, then one
question*). What is new is **one row per argument**, each carrying a **source**:

| Source | Means |
|---|---|
| **Fixed value** | the author types it now |
| **Ask at launch** | it becomes a real field on the launch form |
| **From an earlier step** | it takes an earlier step's whole output |

⛔ **There is no JSON anywhere.** Today this surface is a `<textarea>` labelled *"Tool Arguments
(JSON)"*. Deleting it is SC#1. **A JSON box "for advanced cases" is the same surface under another
name** — do not draw one, not even collapsed, not even behind a disclosure.

**The load-bearing question for Stitch:** how does a row show *which source it has* without three
words of explanation per row, and how does a **required argument with no source yet** read as
incomplete without shouting? Four to six rows, two of them required, one still unset.

### B. Publish refuses — naming the step and the missing argument

The gauntlet is this product's quality wall. Today its refusal says only *"the golden run failed a
structural gate"* while the real cause sits one table away — that is a filed bug this phase is
deliberately **not** fixing wholesale, so **this new refusal must be right from birth**: name the
step, name the argument, say what would satisfy it.

### C. A run surface — service mark, action name, and a step's own failure reason

The run's spine and step list. Each external step wears **the service's own mark** and **the
action's real name**, not "external action". One step has **failed**, and it shows **its own reason**
— today the panel says *"Failure reason not captured by the backend"* while chat shows the real
error one pane away.

### D. The describe door — services as vocabulary, and a refusal

Before the AI drafts, the author is shown their **connected services and granted tools** and picks
which the workflow may use. If their prose names a service they have not connected, the door
**refuses and names a next action** — it does not draft a step that fails at 03:00.

---

## 3. NON-NEGOTIABLES — feed these, do not let Stitch invent past them

- **The mindset is in the design system's `designMd` already.** Text is noise, cut it; **the purpose
  must survive the cut**; never print the mechanism.
- **Never print the mechanism.** No `tool_args`, no `input_keys`, no `capability`, no schema
  vocabulary, no rule names. The author reads sentences; ids are wire values.
- **A refusal is only honest if it names the next action.**
- **A vendor shows its own mark; a vendorless shape is drawn in the interface's own ink.** Some
  services have no logo — that is normal and must look deliberate, never broken.
- **No photography, no stock portraits, no app-shell duplication.** Draw the component, not the app.
- **Deep Midnight**, `assets/12493500246735489470`, DESKTOP, `GEMINI_3_1_PRO`, generated **inside
  project `10710316306258284608`** — which is the project that OWNS the design system. ⚠ Phase 212
  generated into a *new* project, passed the asset id on all four calls, **bound to none of them**,
  and got a teal auto-system with **no error and no warning**. Verify the palette after generating:
  ```bash
  grep -oiE '#[0-9a-f]{6}' <file> | tr 'A-Z' 'a-z' | sort | uniq -c | sort -rn
  ```
  Deep Midnight reads `#0e131e` / `#0d1117` ground, `#dee2f1` text, `#c1c1ff` / `#a3a5ff` accent.
  **Zero** occurrences of `#3cddc7` or `#0b1326` (Obsidian Archive's teal) is the pass condition.

---

## 4. WHAT "DONE" LOOKS LIKE

A range the operator reacts to — **not** a built page and **not** an acceptance bar. Then a normal
sketch under `.planning/sketches/214-.../` re-expresses the chosen direction against
`ConnectionPicker`, `ExternalActionSection`, `PhaseFormPanel`, `PhaseCard`, `RunSpine`,
`RunStepList` and `connectionMark` — components that ship. **That** sketch is the G-2 bar.

⚠ **The panel-width question rides on this.** The operator's standing objection — *"should we open
each one in a pop up window instead of being on the right and splitting the screen which is already
narrow to 2 halves"* — was raised at 212, carried through 213, and now applies to a step form
carrying a field per argument. `D-27` locked the push/split panel for a **3–5 field form**; this is
a different object. The sketch settles it; Stitch should show at least one composition that is not
a 400px right rail.
