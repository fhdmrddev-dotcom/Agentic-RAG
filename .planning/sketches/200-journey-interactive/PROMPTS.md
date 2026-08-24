# Stitch paste pack — sketch 200, the workflow journey

---

# ▶ HOW TO USE THIS FILE

## The settings — set these ONCE, they apply to every prompt

| | |
|---|---|
| **Project** | `Aether Journey v2` |
| **Model** | **Gemini 3.1 Pro** |
| **Device** | **Desktop** |

⚠ **The model matters.** On the default model every generation stalls. On 3.1 Pro it works. If a
screen comes back mobile-shaped or never lands, check these two settings before anything else.

## The loop — one screen at a time

1. Find the next **unchecked** row in the tracker below.
2. Scroll to that numbered section. Copy everything between **`✂ COPY FROM HERE ▼`** and
   **`▲ COPY TO HERE ✂`** — nothing above, nothing below, no heading.
3. Paste it into Stitch as a **NEW SCREEN**. Wait for it to render.
4. Tell me **"N done"**. I pull it in, sweep it for banned strings, look at it, and fold anything
   I learn into the prompt you have not pasted yet.
5. Repeat.

**Do not paste two sections at once, and do not join them together.** Every section deliberately
repeats the palette and the shell, because Stitch generates each screen independently and will
invent a shell of its own if you do not hand it one.

## The order — and why it is not 1,2,3,4,5,6,7

Do the two hardest screens first. They are the ones from your screenshots, they carry almost all
the banned mechanism strings, and if they come back clean the approach is proven on the worst case
rather than the easiest one.

| Order | § | Screen | Why here |
|---|---|---|---|
| ✅ done | 1 | Workflows library | already generated and wired into the prototype |
| **▶ next** | **3** | **The authoring spine** | your 3rd screenshot · carries `phase_index`, `llm_agent`, `skip_to_phase`, `depends_on` and the whole mono legend — **more banned strings than any other screen** |
| then | **5** | **The step panel** | your 1st screenshot · home of the 24 raw `snake_case` tool ids |
| then | 4 | The canvas | your 2nd screenshot · branch condition, connection states |
| then | 2 | The run dialog | small, mostly a subtraction |
| then | 6 | The publish gauntlet | kills the emoji pip strip |
| then | 7 | The run surface | ⚠ the only screen with no "now" capture yet |
| last | R1 | **EDIT of screen 1** | ⚠ **not a new screen** — apply it TO the existing `Workflows Library` |

## ⚠ Two things that will look like failures and are not

**The proposed screens will show LESS than sketch 178 did.** Sheet c3 drew per-step timings and a
total runtime; sheet c1 drew payload counts on the connections. I measured the wire —
`WorkflowRunPhase` carries exactly `slug`, `phase_index`, `status`, `phase_type`, and **no
timestamps at all**. So those prompts deliberately leave them out rather than draw a number the
system cannot know. That gap is the amber column in the prototype's ledger, and it is the evidence
that a second presentation-only phase cannot close this.

**Small wording differences from the shipped app are intended.** `AI agent step` instead of
`llm_agent` IS the change. Do not correct the generated screen back toward the current product.


## The two right-hand panels are DIFFERENT components — measured, not assumed

Three screens in this pack draw a right-hand panel. They are **not** the same component and a
change to one does not touch the other, so there is nothing to reschedule:

| Screen | Component | Its ONLY mount | Open width | Collapsed |
|---|---|---|---|---|
| 5 · step panel | `PhaseFormPanel` | `WorkflowBuilderPage.tsx:2656` | **400px fixed** | **44px rail** |
| 7 · run surface | `WorkspacePanel` | `ChatLayout.tsx:673` | **clamp(300px, 30%, 420px)** | **52px rail** |

⚠ **`WorkspacePanel` is a CROSS-SURFACE shell whose only mount is `ChatLayout`.** It has no mount
in any workflow page at all. So a change to screen 7's panel lands in **CHAT first**, and any UAT
that only walks the workflow surface will miss it entirely. That is a build-sequencing fact, not a
design one — recorded here so it is not rediscovered later.

⚠ **NEITHER PANEL EVER COLLAPSES TO ZERO.** Both keep a permanently-visible rail so the panel is
always reopenable with the mouse. `ChatLayout.tsx:650` says so in its own words: *"NO 0 column: the
rail is always present, so the panel is always reopenable."* **My earlier prompts never mentioned
the rail**, which means a build following them literally could delete it and take the only
mouse-driven way back. Both prompts below now state it.

⚠ **Two widths in the earlier prompts were WRONG and are corrected below**: screen 5 said 420px
(it is 400px) and screen 7 said 380px (it is a clamp that maxes at 420px). Recorded rather than
silently edited, because a sketch that quotes a width the code does not use is how a "pixel-perfect"
acceptance bar ends up unbuildable.


## Motion and icons — measured against 178, and this is why the new screens look flatter

Both were checked with a real diff of the generated HTML against 178's eleven sheets:

**Icons are the SAME font** — Material Symbols Outlined on identical axes, in both sets. What differs
is consistency: **six of the seven generated screens mix `FILL 1` (solid) with `FILL 0` (outline)**,
and weights drift between 300 and 400. 178 held one setting throughout. So "cleaner" here means
*consistent*, not *different* — and the fix is one line in every prompt, not a new icon set.

**Motion is genuinely much thinner.** 178 carries **fourteen** distinct animations across its sheets
— `pulse-border`, `pulse-subtle`, `pulseAmber`, `rotate`, and crucially `march`, `flow` and
`dash-flow` on the CANVAS EDGES. The generated set carries **four**, all on one screen: the run
surface. **The canvas has zero animation at all**, which is why a live workflow reads as a static
diagram there.

⚠ **But 178 is NOT to be copied wholesale on this point.** It also carries `pulseGlow`, and the
adopted design language forbids glow outright. Importing its motion vocabulary unfiltered would
re-introduce exactly the decoration the mindset removed. So the block below takes 178's *liveness*
and drops its *glow*.


## ⭐ THE GENERALITY RULE — added after an operator correction, and it outranks the sample data

> *"Do not build the design or the code around one specific case. This has to work for any business
> problem the app's features can carry."*

This is already a recorded project decision — **`SEED-168`**, which says in its own words that
`SEED-167` *"is one INSTANCE, and planning from it alone builds a risk-register feature."* It derives
**six capability axes** — temporal · state · evidence · human role · output · accountability — from
cases across PM, HR, finance, legal, education and healthcare, and measures that **the engine
expresses exactly ONE position on each**, while most real cases need two or more.

**The line to hold, and it is a sharp one:**

| May be domain-specific | May NOT be domain-specific |
|---|---|
| Sample workflow names, step names, folder names, file names | A **labelled slot** in a component |
| The words inside an example instruction | A **step type** or a node kind |
| The example a screen is illustrated with | A **state name** or a status word |
| | The **shape** of a list a component always renders |

⚠ **The tell:** if swapping the example from "vendor contracts" to "new-starter onboarding" would
leave a label reading nonsense, that label is a design defect, not fixture text.

⚠ **AND THE OPPOSITE OVERCORRECTION IS ALSO WRONG.** Making the design domain-neutral must not make
it capability-optimistic. `SEED-168` measures real gaps — no scheduler, **no run-to-run state**
(`grep` over the harness returns ZERO hits), no item-level adjudication — and drawing those would
promise capability that does not exist. **Generic, not aspirational.**

---

# 📋 TRACKER

- [x] **1 · Workflows library** — generated, pulled, wired. Audit: all 9 banned strings clear, no emoji, no gradient/shadow/blur.
- [x] **3 · The authoring spine** — generated, pulled, wired. Audit: every banned string clear.
- [x] **5 · The step panel** — generated, pulled, wired. All 24 tool ids gone; 12 human names shipped.
- [x] **R3 · Spine synthesis** — generated as `Spine Detail View`, pulled, wired.
- [x] **R5 · Step panel synthesis** — landed as `Step Configuration - Advanced Details`. Drop shadow gone.
- [x] **4 · The canvas** — pulled, wired, audit clear.
- [x] **2 · The run dialog** — pulled, wired, audit clear.
- [x] **6 · The publish gauntlet** — pulled, wired, audit clear.
- [x] **7 · The run surface** — pulled, wired, audit clear.
- [x] **8 · The two doors + describe box** — landed. All three describe states incl. the refusal.
- [x] **9 · The draft arrival** — landed. Cleanest screen in the set; three-arm decisions list correct.
- [x] **13 · Connections** — landed. Structure right; brand marks are Stitch placeholders (tool limit, not a prompt problem).
- [x] **10 · Node identity** — landed. Eight kinds incl. external_action.
- [x] **11 · Run panel parts** — landed.
- [ ] **R-EXTERNAL · external step on canvas + spine** <- **STEP A** (2 screens)
- [ ] **R-GENERIC-9 · decisions list -> domain-neutral** <- **STEP B**
- [ ] **R-GENERIC-3 · spine shows TWO endings** <- **STEP C**
- [ ] **R-ICONS · six screens** — ⚠ did NOT apply last round <- **STEP D**
- [ ] **12 · Fork + delete** — did not land <- **STEP E**
- [x] **R-CANVAS** — landed as `Live Canvas View`. `march` + `borderPulse`, zero glow, filled icons 1 -> 0.
- [x] **R1** — landed. Four cards now share one name; `4 share this name` on exactly those four.

> **Why 8 and 9 come first:** they are not extras, they are the **first two steps of authoring**.
> The journey currently starts in the middle. See `COVERAGE.md`.

---
---

# 3 · THE AUTHORING SPINE  (done)

*Generated and wired. SUPERSEDED BY R3 below — do not re-run this one.*

### ✂ COPY FROM HERE ▼

A COMPLETE desktop application screen, 1440x900, dark "Deep Midnight" theme. Internal agentic workflow platform. Draw the WHOLE screen INCLUDING the app shell.

EXACT COLOURS: page background #060A0F, icon rail #080B11, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body, JetBrains Mono ONLY for durations.

SHELL: left icon rail 56px on #080B11, icons only, the ONLY navigation — app mark, expand, new chat, Chat, Workflows (ACTIVE), Documents, Classification, Library Health, Governance, Skills, Settings, account mark at the bottom. NO top nav, NO breadcrumb, NO global search.

BUILDER HEADER, one row: a quiet "← Workflows" back control, then the workflow's NAME "Northwind QBR" in Manrope 16px semibold with a small dim "draft" marker and a folder chip "DBA". Pushed right: a bordered "Save draft" and a filled #A3A5FF "Publish…" button.

Under it a two-tab switch: "Spine" (ACTIVE) and "Canvas". Beside the tabs, one quiet 12px line in PLAIN LANGUAGE: "View only — this is the order it will run in." NEVER a technical legend.

THE SPINE — a single vertical column of five step cards, each 1px #212631 on #0D1117, connected by a thin vertical rule down the left. Each card carries, in this hierarchy:
- A small line glyph on the left in #9AA3B5 — from ONE fixed vocabulary: search, extract, reason, branch, human, emit. The same mark represents that step everywhere it appears.
- Line 1: the step's AUTHORED NAME at 14px medium — the strongest element on the card.
- Line 2: what it does, in a plain human sentence at 12px #9AA3B5.
- Right-aligned on line 1: the chosen model name, small and dim.
- A small uppercase 10px type badge in HUMAN WORDS.

The five steps:
1. "Pull usage and support history" / "Searches the knowledge base and decides its own next move" / badge "AI AGENT" / model "GPT-4o"
2. "Pull commercial position and meeting notes" / "Searches the knowledge base and decides its own next move" / badge "AI AGENT" / model "GPT-4o"
3. "Draft the QBR narrative sections" / "Writes one piece in a single pass" / badge "ONE-SHOT WRITER" / model "Claude Sonnet"
4. "Confirm the QBR before rendering" / "Pauses and waits for a person" / badge "WAITS FOR A PERSON" — this card carries a violet #895AF6 left edge, because a human gate is different in kind from a machine step
5. "Fill the QBR template" / "Produces the finished file" / badge "PRODUCES THE FILE"

Beneath step 3, show a BRANCH row in plain language: "If this fails → go to Confirm the QBR before rendering". Draw it as a quiet inset line with a small branch glyph, not as a badge.

Every row must fit on ONE line — no label, name or sentence may wrap onto a second line; truncate with an ellipsis instead. Set every secondary line in sentence case, never in all caps.

⛔ ABSOLUTELY MUST NOT APPEAR — every one of these is on this screen in the real product today, and removing them is the entire purpose of this redesign: "phase_index", "phase_index 0", "llm_agent", "llm_single", "llm_emit", "llm_human_input", "skip_to_phase", "depends_on", "on_failure", "READ-ONLY GRAPH", "ordered by phase_index", "run order (i→i+1)", "no depends_on", "no parallel lanes", "inspect, don't drag", "NET-NEW", and any other snake_case identifier or monospace machine label.

ALSO PROHIBITED: emoji, avatars, photographs, gradients, glassmorphism, glow, drop shadows, progress bars, percentages, time estimates.

### ▲ COPY TO HERE ✂

---
---

# 5 · THE STEP PANEL  (done)

*Generated and wired. SUPERSEDED BY R5 below — do not re-run this one.*

### ✂ COPY FROM HERE ▼

A COMPLETE desktop application screen, 1440x900, dark "Deep Midnight" theme. Internal agentic workflow platform. Draw the WHOLE screen INCLUDING the app shell and a right-hand side panel.

EXACT COLOURS: page background #060A0F, icon rail #080B11, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body.

SHELL: left icon rail 56px on #080B11, icons only, ending with an account mark. NO top nav, NO breadcrumb, NO global search. In the main region show a workflow canvas, dimmed and secondary.

THE STEP PANEL — a 420px panel pushed in from the RIGHT, a 1px #212631 left border on #0D1117, full height. It is a PUSH panel, not an overlay. This is the screen where the current product is at its worst, so it must read as a small number of calm, titled GROUPS rather than one long form of labels.

Panel header: the step's authored name "Find contracts renewing in the next 90 days" at 15px semibold, a small human badge reading "AI agent step", and a close control.
Directly beneath: one quiet control reading "Explain each field", collapsed by default.

Then FOUR titled groups, each a bordered block with an 11px uppercase letter-spaced dim heading:

1. "WHAT IT DOES" — a textarea holding the step's instructions.

2. "MODEL" — a select showing "Use the run's model — today that would be GPT-4o", and beside the chosen model a small FITNESS chip reading "Strong for judging" in green with a tick. Below it, a second row showing an error state for contrast: a bordered danger-toned row reading "We couldn't load the list of models."

3. "WHAT IT CAN REACH" — a "Folders it can read" row showing a folder chip "DBA". Then "What this step can do": a set of small selectable pills, and EVERY pill carries a HUMAN NAME, never a machine identifier: "Read a document", "Search documents", "Run code", "Search a saved view", "Write a file", "Track its to-dos", "Ask a person", "Attach a skill file", "Browse the web", "Read related documents", "Query tables", "Remember something". Show some selected in indigo tint and some as dim outlines. Beneath them one always-visible sentence: "Pick from the tools this workspace allows — you cannot add one by typing."

4. "HOW STRICTLY IT IS HELD" — a two-position dial reading "Loose" and "Strict", with "Strict" selected, and one plain sentence: "Every claim must be cited from your documents." Beside it a small shield corner mark.

Every label and pill must fit on ONE line without wrapping. Set secondary sentences in sentence case, never in all caps.

⛔ ABSOLUTELY MUST NOT APPEAR — the current product shows twenty-four of these on this one panel and it is the single worst surface in the app: "analyze_document", "ask_user", "attach_skill_file", "fetch_document_file", "get_related_documents", "glob", "grep", "load_skill", "ls", "query_documents", "query_documents_by_view", "query_tables", "read_skill_file", "recall", "remember", "save_skill", "task", "tree", "web_search", "workspace_delete", "workspace_diff", "workspace_list", "workspace_read", "workspace_write", "write_todos", "phase_index", "llm_agent", or ANY other snake_case identifier anywhere on the screen.

ALSO PROHIBITED: emoji, avatars, photographs, gradients, glassmorphism, glow, drop shadows, progress bars, percentages, any row count such as "1,200 records", any named person holding a lock.

### ▲ COPY TO HERE ✂

---
---

# R3 · SPINE — SYNTHESIS WITH SKETCH 178  (done)

**An EDIT of the existing `Northwind QBR - Spine View` screen. NOT a new screen.**

*Why: the generated spine is structurally right and says everything in human words, but it is
THINNER than sketch 178's spine sheet, which carried a selected step's own detail, a real router
with two named paths, and a human gateway with its controls. This folds that density back in
WITHOUT reintroducing the machine vocabulary.*

### COPY FROM HERE (start)

Keep everything already on this screen — the shell, the header, the tabs, the five steps, their names, their plain sentences, their badges and their models. Add density in four places and change nothing else.

1. SHOW ONE STEP SELECTED AND EXPANDED. Make step 3, "Draft the QBR narrative sections", the selected step: give it a soft indigo #A3A5FF 1px border and reveal its own detail inside the same card, indented beneath its sentence. The detail is two labelled rows, each an 11px uppercase dim label with its value beneath: "WHAT IT IS TOLD TO DO" showing a short instruction in sentence case, and "HOW LITERAL IT SHOULD BE" showing the words "Very literal". Every other card stays collapsed. Never show a template filename and never show a decimal number.

2. TURN THE BRANCH INTO A REAL FORK WITH TWO NAMED PATHS. Replace the single branch line under step 3 with a fork drawn as two side-by-side lanes beneath a small hexagonal split marker labelled "Which way this goes". The left lane is the taken one: a 1px #A3A5FF border, heading "If the draft needs a person", body "Confirm the QBR before rendering", and a small uppercase tag reading "THIS WAY". The right lane is the untaken one: dim, a dashed #212631 border, heading "If it does not", body "Fill the QBR template", and a small uppercase tag reading "NOT THIS WAY". Both tags must be words. The two lanes must stay distinguishable with colour ignored, by border style and text weight alone.

3. GIVE THE HUMAN STEP ITS CONTROLS. On step 4, "Confirm the QBR before rendering", keep the violet #895AF6 left edge and add inside the card one plain sentence, "Someone has to approve this before it continues.", and two small controls side by side: a bordered "Approve" and a bordered "Send back". They are part of an authoring preview, so draw them at rest rather than as live buttons.

4. ADD A QUIET FOOTER ROW beneath the last step: a single line reading "5 steps, runs top to bottom, one person gate". 11px, dim, sentence case, no icons.

Keep every rule already in force: every row on ONE line except the expanded detail, secondary text in sentence case and never all caps, no emoji, no gradients, no glow, no drop shadows.

STILL ABSOLUTELY FORBIDDEN, and this is exactly what separates this from the old sketch: "phase_index", "llm_agent", "llm_single", "llm_emit", "llm_human_input", "skip_to_phase", "depends_on", "on_failure", "READ-ONLY GRAPH", "VECTOR", "PARSER", "REASONING", "ROUTER", "TRAVERSED", "SKIPPED", any filename ending .md or .json, any temperature or decimal setting value, any snake_case identifier, any monospace machine label.

ALSO FORBIDDEN: any duration, any elapsed time, any total runtime, any per-step timing. This is the AUTHORING view — nothing has run, so any time value here would be a fabrication.

### COPY TO HERE (end)

---
---

# R5 · STEP PANEL — SYNTHESIS WITH SKETCH 178

**An EDIT of the existing `Step Configuration Panel` screen. NOT a new screen.**

*Why: the generated panel fixed the vocabulary — all 24 machine tool ids are gone — but it is
flatter than sketch 178's panel sheet, which carried grounding sources with their locks, an armed
external action with its consequence, an attached-files list, and a summary of what is still
missing. Those are the atoms that made the sheet feel like an instrument rather than a form.*

### COPY FROM HERE (start)

Keep everything already on this screen — the shell, the dimmed canvas, the 420px right panel, its header, the "Explain each field" control, and the four existing groups with all their content. Add three groups and one summary, and change nothing else.

1. EXPAND "WHAT IT CAN REACH" INTO GROUNDING SOURCES. Under the existing "Folders it can read" row, add a small list of source rows, each a bordered row on #0F141B carrying a folder glyph, the source name, and a state on the right:
   - "Contracts" with a right-aligned bordered control reading "Lock"
   - "Compliance" showing a small closed-padlock glyph and, right-aligned in dim 11px, the words "Locked — only the person who locked it can release it"
   - beneath the list, a quiet bordered row reading "+ Add a source"
   Never name a person, and never show an owner's name or initials.

2. ADD A GROUP TITLED "WHAT IT CHANGES OUTSIDE THIS WORKFLOW". Inside it, one bordered block with a warning #F5A524 left edge, a heading "Writes to your database", one plain sentence "This step can change records that live outside this workflow.", and a small uppercase tag reading "NEEDS ARMING". Below it a second bordered row, dim, reading "Sends a Slack message". Never state a record count and never state a number of rows affected.

3. ADD A GROUP TITLED "FILES IT STARTS FROM" with three rows:
   - a dim italic row reading "Nothing attached yet"
   - a row with a document glyph reading "Renewal brief template"
   - a row with a document glyph reading "Compliance schema", followed on the same line by a danger #DC2626 note reading "We could not read this file"
   Use each file's human name, never a filename with an extension.

4. ADD A SUMMARY BLOCK AT THE BOTTOM OF THE PANEL: bordered, with a warning #F5A524 left edge, a heading "2 things still missing", then two rows in sentence case — "Choose a model" and "Connect a knowledge source" — each with a small dim chevron on the right showing it jumps to that group. No count badge, no percentage, no progress ring.

Keep every rule already in force: labels on one line, secondary text in sentence case and never all caps, no emoji, no gradients, no glow. Remove any drop shadow currently on this screen — depth is carried by 1px #212631 borders and tonal fills only.

5. CORRECT THE PANEL WIDTH AND SHOW ITS RAIL. The panel is **400px wide**, not 420px. Add, hard against the right edge of the screen and to the RIGHT of nothing at all, a permanently visible **44px collapse rail**: a narrow vertical strip on #080B11 with a 1px #212631 left border, carrying a single collapse chevron near the top. The panel must never look as though it could close to nothing — the rail is how a person gets it back.

STILL ABSOLUTELY FORBIDDEN: every snake_case tool identifier ("analyze_document", "query_documents_by_view", "workspace_write", "write_todos" and all the rest), "phase_index", "llm_agent", any file extension such as .docx or .json or .md, any named person, any row count such as "1,200 records", any percentage or progress bar, any emoji.

### COPY TO HERE (end)

---
---

# 4 · THE CANVAS

*New screen. Your 2nd screenshot.*

### ✂ COPY FROM HERE ▼

A COMPLETE desktop application screen, 1440x900, dark "Deep Midnight" theme. Internal agentic workflow platform. Draw the WHOLE screen INCLUDING the app shell.

EXACT COLOURS: page background #060A0F, icon rail #080B11, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body.

SHELL: left icon rail 56px on #080B11, icons only — app mark, expand, new chat, Chat, Workflows (ACTIVE), Documents, Classification, Library Health, Governance, Skills, Settings, account mark at the bottom. NO top nav, NO breadcrumb, NO global search.

BUILDER HEADER: a quiet "← Workflows" back control, the name "Northwind QBR" with a dim "draft" marker, then a bordered "Save draft" and a filled #A3A5FF "Publish…". A two-tab switch below: "Spine" and "Canvas" (ACTIVE).

THE CANVAS PLANE — a large dark plane on #060A0F with a very faint dot grid, holding a left-to-right flow of step NODES connected by curved lines.

Each NODE is a compact card, roughly 240x72, a 1px #212631 border on #0D1117, containing:
- A SMALL line glyph, 18px, 1.5px stroke, inline at the top-left — NOT a large filled circle, NOT a coloured disc.
- The step's authored name at 13px medium on ONE line, truncating with an ellipsis if long.
- One plain supporting sentence at 11px #9AA3B5, also on one line.
- Where a step is governed, a small shield CORNER MARK in the top-right of the card — a corner mark only, never a third badge.

Draw six nodes: "Find this quarter's vendor contracts", "Pull out renewal dates and liability caps", then a BRANCH node drawn as a distinct hexagonal shape labelled "Weigh each contract against our risk policy" which carries its OWN CONDITION in plain words beneath it — "Over £2m?" — with TWO labelled outputs leaving it, one reading "Escalate to the risk committee" and one reading "File as routine".

CONNECTIONS: show four visually distinct states, each named once in a small legend strip along the bottom of the plane — "at rest" a thin #212631 line, "selected" an indigo #A3A5FF line, "hovered" a brighter line, and "not taken" a dashed dim line. Each state must be distinguishable WITHOUT colour, by line weight and dash pattern alone.

FLOATING CONTROLS bottom-left: a small bordered cluster with zoom out, a zoom reading, zoom in, fit-to-view, and a lock control.

⛔ MUST NOT APPEAR: any count or payload label on a connection — this system does not compute them. Also: "phase_index", "llm_agent", "skip_to_phase", "depends_on", "React Flow", "NET-NEW", any snake_case identifier, any monospace machine label, any percentage or progress bar. No emoji, no gradients, no glow, no drop shadows.

### ▲ COPY TO HERE ✂

---
---

# 2 · THE RUN DIALOG

*New screen. Small — mostly a subtraction.*

### ✂ COPY FROM HERE ▼

A COMPLETE desktop application screen, 1440x900, dark "Deep Midnight" theme. Internal agentic workflow platform. Draw the WHOLE screen INCLUDING the app shell, with a modal dialog centred over it.

EXACT COLOURS: page background #060A0F, icon rail #080B11, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body.

SHELL: left icon rail 56px on #080B11, icons only, Workflows ACTIVE, account mark at the bottom. NO top nav, NO breadcrumb, NO global search. Behind the dialog, dim the workflow library card grid.

THE DIALOG — 560px wide, a 1px #212631 border on #0D1117, no shadow and no blur behind it. It collects what THIS RUN needs and describes nothing else.

Contents in order:
- Title: the workflow's own name, "Quarterly Business Review — Northwind Logistics", Manrope 17px semibold. NO decorative icon beside it. The verb in this product is "Run", never "Execute".
- A labelled select, "Knowledge base", showing "Workflow default — Template-Test" with other folders beneath it.
- A labelled textarea, "What should this run work on?", 3 rows, with a dim placeholder.
- One quiet 12px line naming what the workflow needs, in PLAIN LANGUAGE — for example "This workflow needs a starting instruction." Never a machine field name, never monospace.
- One quiet 12px line of honest destination: "Run opens this workflow's run surface. The chat thread is still created, and stays reachable from there."
- Footer, right aligned: a bordered "Cancel" and a filled #A3A5FF primary "Run workflow" with dark text.

⛔ ABSOLUTELY MUST NOT APPEAR — an earlier design drew all of these and every one is a fabrication this system cannot compute: "Target nodes", "production-cluster", "Estimated time", "~45s", "Sequence length", "3 phases", any percentage, any progress bar, any block of monospace "spec" facts, and the word "Execute".

ALSO PROHIBITED: snake_case identifiers of any kind, emoji, avatars, photographs, gradients, glassmorphism, glow, drop shadows.

### ▲ COPY TO HERE ✂

---
---

# 6 · THE PUBLISH GAUNTLET

*New screen. Kills the emoji pip strip.*

### ✂ COPY FROM HERE ▼

A COMPLETE desktop application screen, 1440x900, dark "Deep Midnight" theme. Internal agentic workflow platform. Draw the WHOLE screen INCLUDING the app shell, with a modal dialog centred over a dimmed builder.

EXACT COLOURS: page background #060A0F, icon rail #080B11, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body.

SHELL: left icon rail 56px on #080B11, icons only, account mark at the bottom. NO top nav, NO breadcrumb, NO global search.

THE DIALOG — "Publish this workflow", 680px wide, 1px #212631 on #0D1117.

Top: the workflow's PURPOSE in the author's own words, at 17px, as the hero — "Deliver a plain-text renewal brief covering vendor contracts renewing within the next 90 days, noting what changed since last term and which need renegotiation, grounded in the knowledge base."
Under it, one quiet line naming what it needs in PLAIN LANGUAGE: "Needs a starting instruction." Never a machine field name.
Then a compact inline row of the step glyphs with their names, a small "Loose" or "Strict" marker, and one line reading "Produces: an answer in chat".

THE GAUNTLET STRIP — nine stages in ONE horizontal row that FITS inside the dialog without scrolling. Each stage is a small round pip carrying a LINE ICON — never an emoji — with its name beneath in 10px uppercase: Owner, Valid, Goal, Structure, Pause, Grounding, Golden run, Citations, Judge, Commit. Passed stages carry a green #21C45D ring and a small tick, and the strip reads left to right with thin connectors between pips.

Beneath it, one plain paragraph: "Publishing runs the full check above, including a real trial run of this workflow against your knowledge base and an independent review of the result. It can honestly refuse."

Then a labelled textarea: "A typical instruction to test with", with the dim placeholder "Choose something typical, not a corner case — this is what gets graded."

Footer right: a filled #A3A5FF primary "Publish — run the checks".

⛔ MUST NOT APPEAR: any emoji anywhere — the current product draws this strip in emoji and that is precisely the defect being fixed. Also: "kickoff_prompt", "GOLDEN_INPUT", "A REPRESENTATIVE KICKOFF PROMPT", "phase_index", "llm_agent", any snake_case identifier, any uppercase monospace machine label, any percentage, progress bar or time estimate. No avatars, no gradients, no glow, no drop shadows.

### ▲ COPY TO HERE ✂

---
---

# 7 · THE RUN SURFACE

*New screen. ⚠ The only screen with no "now" capture yet — it needs a live run to photograph honestly.*

### ✂ COPY FROM HERE ▼

A COMPLETE desktop application screen, 1440x900, dark "Deep Midnight" theme. Internal agentic workflow platform. Draw the WHOLE screen INCLUDING the app shell and a right-hand panel.

EXACT COLOURS: page background #060A0F, icon rail #080B11, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body, JetBrains Mono ONLY for elapsed times.

SHELL: left icon rail 56px on #080B11, icons only, Workflows ACTIVE, account mark at the bottom. NO top nav, NO breadcrumb, NO global search.

MAIN REGION — watching one run of "Quarterly Business Review — Northwind Logistics". A quiet header carrying the workflow name, a small version marker, an elapsed time in monospace, and a bordered "Stop this run" control. Below it a calm, readable transcript area — a short receipt of what has happened, NOT a wall of chat.

RIGHT PANEL, **420px**, pushed in with a 1px #212631 left border — this panel owns the meaningful step spine. It is a push/split panel, never an overlay. Beside it, hard against the right edge of the screen, draw a permanently visible **52px collapse rail** on #080B11 with a single collapse chevron near the top: this panel never closes to nothing, and the rail is the only way a person reopens it with the mouse. A heading, then five rows, one per step, each with:
- A status mark on the left: a green tick for done, a soft indigo pulsing ring for the one running now, a dim hollow circle for waiting.
- The step's authored name at 13px.
- For finished steps, ONE kept fact in plain words at 11px dim — for example "Found 12 contracts".
- For the running step, an ELAPSED TIME in monospace only — for example "00:15". NEVER a percentage, NEVER a fraction such as "4 of 12", NEVER a progress bar, because this system genuinely cannot know how far along it is.
- One step is a HUMAN GATE, waiting: it carries a violet #895AF6 left edge, the sentence "Needs your review before it continues.", and two controls, "Approve" and "Send back".

⛔ MUST NOT APPEAR: any percentage, any progress bar, any determinate fraction, any total-runtime figure, any per-step duration for a step that has not finished, "phase_index", "llm_agent", "skip_to_phase", any snake_case identifier, and any monospace machine label other than an elapsed clock. No emoji, no avatars, no gradients, no glow, no drop shadows.

### ▲ COPY TO HERE ✂

---
---

# 8 · THE TWO DOORS + THE DESCRIBE BOX  (done)

*New screen. Closes sheet **c9** entirely. This is where authoring actually BEGINS — the journey
has been starting one step too late.*

### COPY FROM HERE (start)

A COMPLETE desktop application screen, 1440x900, dark "Deep Midnight" theme. Internal agentic workflow platform. Draw the WHOLE screen INCLUDING the app shell.

EXACT COLOURS: page background #060A0F, icon rail #080B11, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body.

SHELL: left icon rail 56px on #080B11, icons only, the ONLY navigation — app mark, expand, new chat, Chat, Workflows (ACTIVE), Documents, Classification, Library Health, Governance, Skills, Settings, account mark at the bottom. NO top nav, NO breadcrumb, NO global search.

MAIN — the moment a person starts a new workflow. Centre the content in a column about 720px wide with generous space around it. A quiet heading, "Start a new workflow", and one supporting line, "Two ways in. You can change your mind later."

THE TWO DOORS — two large side-by-side choice cards, equal size, each a 1px #212631 border on #0D1117 with a line glyph, a title and one plain sentence:
- LEFT, and shown CHOSEN: a soft indigo #A3A5FF 1px border and a faint indigo tint. Title "Describe it". Sentence "Tell me what you want to achieve and I will draft the steps."
- RIGHT, at rest: title "Build it yourself". Sentence "Start from an empty canvas and add each step by hand."
The chosen door must be identifiable with colour ignored — give it a heavier border weight and a small "Chosen" tag in words, not colour alone.

THE DESCRIBE BOX — directly beneath the doors, since the left door is chosen. A large textarea, 5 rows, on #0D1117 with a 1px #212631 border, and above it a label "What do you want this workflow to achieve?". Show it FILLED with this text, in sentence case: "Scan the incoming support inbox for priority escalation flags. If a flag is detected and the sentiment is highly negative, draft a preliminary apology and route it to the Tier 3 resolving queue. Otherwise, auto-tag and archive."

THE REFUSAL, shown as a SECOND smaller instance beneath the first, so both states are visible on one screen. Label it quietly "If what you write is too thin". Show a short textarea containing only "Automate my emails.", and directly under it a bordered danger #DC2626 block, left-edge accented, reading in sentence case: "That is not enough to work from yet. Tell me what it should produce, and where it should look." The submit control beside it is visibly disabled AND the refusal states why — never a silently dead button.

THE KNOWLEDGE PICKER — a row beneath the describe box, labelled "What should it read?". Show all three of its states stacked as small bordered rows so the whole vocabulary is visible:
- nothing chosen: a bordered row reading "+ Choose what it can read"
- one chosen: a bordered row with a folder glyph, "Legal", a dim count "1,284 documents", and a small remove control
- none available: a dim bordered row reading "You have no folders yet" with a bordered "Upload documents" control beside it

THE TEMPLATE ROW — one last quiet bordered row, labelled "Start from something that already works", carrying a document glyph, the name "Invoice audit", a dim "4 steps", and a bordered "Use this" control.

Every row on ONE line, secondary text in sentence case never all caps, no emoji, no gradients, no glow, no drop shadows.

MOTION AND ICONS — apply these exactly, they are the same in every screen of this set:
- ICONS: Material Symbols Outlined, and ALWAYS unfilled. Set `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24` on every icon without exception. Never use a filled icon anywhere, for any state, including success and error. Filled and unfilled marks side by side is the single most common inconsistency in this set.
- Icon colour is #9AA3B5 at rest, and takes the state colour ONLY when it sits beside a state word.
- MOTION, and only these three: (1) a 200ms ease-out fade on anything appearing, (2) a 4px rise on hover, (3) a slow 2s pulse on the ONE thing that is live right now. Nothing else moves.
- NO glow of any kind, NO bounce, NO scale-up, NO spin except a genuine indeterminate wait.


MUST NOT APPEAR: "phase_index", "llm_agent", "skip_to_phase", "depends_on", "kickoff_prompt", any snake_case identifier, any monospace machine label, any percentage, any progress bar, any time estimate, any fabricated document count on a folder that has none.

### COPY TO HERE (end)

---
---

# 9 · THE DRAFT ARRIVAL

*New screen. Closes sheet **c5** entirely. What a person sees the moment the draft comes back.*

### COPY FROM HERE (start)

A COMPLETE desktop application screen, 1440x900, dark "Deep Midnight" theme. Internal agentic workflow platform. Draw the WHOLE screen INCLUDING the app shell.

EXACT COLOURS: page background #060A0F, icon rail #080B11, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body.

SHELL: left icon rail 56px on #080B11, icons only, Workflows ACTIVE, account mark at the bottom. NO top nav, NO breadcrumb, NO global search.

MAIN — the moment the drafted workflow arrives back. A centred column about 780px wide.

THE ARRIVAL CARD at the top: a 1px #212631 card on #0D1117 with a soft indigo #A3A5FF left edge. Inside:
- A small quiet tag reading "Just drafted".
- The workflow's proposed NAME at 18px Manrope semibold: "Vendor renewal risk sweep".
- Beneath it, one dim line showing what it was made from, truncated with an ellipsis: "From: Every Monday, pull new vendor contracts and flag the ones renewing within 90 days…" with a small "See what I asked for" control on the same line.
- A footer row of three controls: a bordered "Open in the builder", a bordered "See the steps", and a filled #A3A5FF "Publish…" — with "Open in the builder" listed FIRST.

THE DECISIONS LIST beneath it, headed "What I decided for you". Five rows, each a bordered row on #0F141B carrying a state mark, a decision name, and a state WORD. THE STATE WORD IS ALWAYS PRESENT — colour is never the only carrier. Use exactly THREE state kinds and no more:
1. "Where it reads from" — a green #21C45D tick and the word "Settled"
2. "How it identifies a vendor" — a warning #F5A524 mark and the words "Needs you", plus on a second line inside the same row a short bordered input with a "Use this" control beside it, so the correction is made in place
3. "How long a contract runs" — a dim hollow mark and the words "Not recorded" — this is the UNKNOWN arm and it must read neutral, never as a failure and never as a success
4. "What it must cite" — a warning #F5A524 mark, the words "Needs you", and one plain sentence beneath: "You cannot publish until this is settled." THIS IS THE ONLY ROW ALLOWED TO MENTION PUBLISHING.
5. "How it weighs risk" — a green #21C45D tick and the word "Settled"

THE RECEIPT at the bottom: a quiet bordered block headed "What I applied", listing what was decided automatically as label-and-value pairs on single lines — "Model: GPT-4o" and "Reads from: Legal". Beneath the block, one dim italic line: "This block is absent when nothing was applied."

Every row on ONE line except rows 2 and 4, secondary text in sentence case never all caps, no emoji, no gradients, no glow, no drop shadows.

MOTION AND ICONS — apply these exactly, they are the same in every screen of this set:
- ICONS: Material Symbols Outlined, and ALWAYS unfilled. Set `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24` on every icon without exception. Never use a filled icon anywhere, for any state, including success and error. Filled and unfilled marks side by side is the single most common inconsistency in this set.
- Icon colour is #9AA3B5 at rest, and takes the state colour ONLY when it sits beside a state word.
- MOTION, and only these three: (1) a 200ms ease-out fade on anything appearing, (2) a 4px rise on hover, (3) a slow 2s pulse on the ONE thing that is live right now. Nothing else moves.
- NO glow of any kind, NO bounce, NO scale-up, NO spin except a genuine indeterminate wait.


MUST NOT APPEAR: any schedule, any recurrence such as "Weekly" or "Every Monday" as an applied setting — this product cannot schedule anything and drawing it would promise a feature that does not exist. Also forbidden: "phase_index", "llm_agent", "skip_to_phase", any snake_case identifier, any monospace machine label, any percentage, any progress bar, any confidence score, any count of decisions rendered as a badge.

### COPY TO HERE (end)

---
---

# R-CANVAS · GIVE THE CANVAS ITS MOTION AND FIX ITS ICONS

**An EDIT of the existing `Northwind QBR - Canvas View` screen. NOT a new screen.**

*Why: the canvas is the screen where 178 was most alive — it animated its connections with a
marching dashed flow — and the generated canvas has ZERO animation, so a running workflow reads as a
static diagram. This adds the liveness back without adding glow.*

### COPY FROM HERE (start)

Keep the whole screen as it is — the shell, the header, the tabs, the six nodes, the branch with its condition, the two named outputs, the connection legend and the floating controls. Change only motion and icon rendering.

1. ANIMATE THE ACTIVE PATH. One connection — the one leaving "Pull out renewal dates and liability caps" — is the live one. Draw it as a dashed indigo #A3A5FF line whose dashes MARCH slowly along the path, a 1s linear loop, continuously. Every other connection stays perfectly still. Add the word "running" as a small label riding that one connection, so the motion is never the only signal.

2. PULSE EXACTLY ONE NODE. The node that connection leads into carries a slow 2s pulse on its BORDER only — the border colour easing between #212631 and #A3A5FF and back. No glow, no shadow, no scale change, no bounce. Every other node is completely static.

3. ADD THE FOUR CONNECTION STATES AS A LIVE LEGEND. Keep the existing legend strip, and make each sample line actually show its treatment: "at rest" a still thin #212631 line, "hovered" a still brighter line, "selected" a still indigo line 2px thick, "not taken" a still dashed dim line. Only the active path in the plane itself moves — the legend samples do not animate.

4. MAKE EVERY ICON UNFILLED AND IDENTICAL. Set `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24` on every icon on this screen with no exceptions. There is currently at least one filled icon mixed in with outlined ones, and that inconsistency is more visible than any single mark.

FORBIDDEN, and this is where 178 itself went wrong: no glow, no `pulseGlow`, no box-shadow, no blur, no bounce, no scale-up, no spinning element. Motion is a marching dash and a border pulse, and nothing else on this screen moves.

### COPY TO HERE (end)

---
---

# R1 · REVISION OF SCREEN 1 — ⚠ AN EDIT, NOT A NEW SCREEN

⚠ **Select the existing `Workflows Library` screen and apply this as an EDIT.** If you generate it
as a new screen you get a second library and lose the one already wired into the prototype.

### ✂ COPY FROM HERE ▼

Three corrections to this screen. Nothing else changes.

1. The "+ Build a workflow" button currently WRAPS onto two lines. It must sit on a single 36px-tall line, on exactly the same baseline as the search field beside it. Widen the button as needed — the label stays "Build a workflow".

2. The six cards currently carry six DIFFERENT names, which hides the real problem this screen exists to solve. Change FOUR of the six to share the SAME name, "Quarterly Business Review", so the screen demonstrates the actual case: a person must tell four identically-named rows apart using only the run truth and the identity line beneath it. Keep the six run states exactly as they are. The two remaining cards keep their own distinct names.

3. The identity line is currently set in ALL CAPS and wraps onto two lines, which makes the quietest row on the card the heaviest-looking one. Set it in sentence case at 11px #6B7383 on a SINGLE line, truncating with an ellipsis if it does not fit. Only the ownership badge stays uppercase.

4. Every card currently reads "42 share this name" even though all six names are unique, which is a contradiction. After correction 2, only the four cards sharing the name "Quarterly Business Review" carry a share count, and it reads "4 share this name". The two uniquely-named cards carry no share count at all.

### ▲ COPY TO HERE ✂

<!-- ⚠ A FIFTH correction was drafted and then WITHDRAWN after viewing the render at full size:
     "colour appears on the whole card border". It does not — the run gutter is a 3px left edge
     only, and every other border is neutral #212631, exactly as asked. The false claim came from
     reading a 512px-wide thumbnail. Recorded rather than silently deleted, because a revision
     that "fixes" something already correct is how a good detail gets designed away. -->

---
---

# R-ICONS · ONE EDIT, APPLIED TO SIX SCREENS  <- STEP 1

**An EDIT. Apply the SAME text separately to each of these five screens:**
`Workflows Library` · `Northwind QBR - Spine View` · `Northwind QBR - Spine Detail View` ·
`QBR Run Dialog` · `Publish Workflow - Gauntlet Check` · `Step Configuration - Advanced Details`

*Why: measured across the generated HTML — five screens still mix `FILL 1` (solid) icons with
`FILL 0` (outline) ones. The canvas was fixed by R-CANVAS and now reads noticeably cleaner than its
neighbours. This is the difference between "a set of screens" and "one system", and it is one line.*

### COPY FROM HERE (start)

Change nothing on this screen except how icons render.

Every icon on this screen must be UNFILLED and identical in weight. Set `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24` on every single icon, with no exceptions anywhere — including success ticks, error marks, status dots, chevrons, folder marks and the icon rail. There must be no filled icon left on this screen.

Icon colour is #9AA3B5 at rest. An icon takes a state colour ONLY when it sits directly beside a state word that says the same thing.

Do not change any layout, any text, any spacing or any colour other than icon colour.

### COPY TO HERE (end)

---
---

# 10 · NODE IDENTITY — SHAPE, TYPE AND STATE  <- STEP 2  (state sheet, closes c2)

*Not a journey screen. One surface, all its states, side by side — this is the specimen sheet the
journey cannot contain.*

⚠ **READ THIS BEFORE PASTING — it is why the sheet is drawn the way it is.**
The shipped `PHASE_GLYPHS` map carries **seven** kinds — agent · batch agents · one-shot writer ·
programmatic · human input · emit · **external action** — and the backend has an eighth type
(`llm_judge_rubric`) with **no glyph at all**, which is a real gap worth seeing drawn.
⚠ **`external_action` already exists**: a step that calls another application is not a future
bolt-on, the vocabulary reserved a seat for it before this sketch began.
**A multi-output conditional/router node is NOT shipped and is NOT approved** — the roadmap records
*"the spine is LINEAR by design"*, and a node that fans out to several routes would revisit that
decision rather than illustrate it. The ONE branch that genuinely exists is a single alternate route
taken when a step fails. So this sheet draws the real branch as real, and marks the fan-out router
as an explicit proposal.

### COPY FROM HERE (start)

A COMPONENT SPECIMEN SHEET, desktop 1440 wide, dark "Deep Midnight" theme, for an internal agentic workflow platform. NOT an application screen — draw NO app shell, NO icon rail, NO navigation. Just the specimen sheet on the page background with section headings.

EXACT COLOURS: page background #060A0F, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body, JetBrains Mono ONLY for elapsed clocks.

Title at the top: "The step node" with one line beneath: "Every kind, every state, one sheet." Section headings are 11px uppercase, letter-spaced, dim.

SECTION 1 — "SHAPE CARRIES WHAT KIND OF THING IT IS". Three distinct silhouettes, drawn large and side by side, each labelled beneath in sentence case:
- a ROUNDED RECTANGLE, label "Does work" — the ordinary step
- a RECTANGLE WITH ONE NOTCHED CORNER (top-left cut away), label "Waits for a person" — carrying a violet #895AF6 left edge
- a HEXAGON, label "Chooses what happens next"
Beneath the three, one plain sentence: "Shape tells you the kind. The mark inside tells you which one."

SECTION 2 — "THE KINDS THAT EXIST TODAY". Eight nodes laid out in two rows of four, all the ROUNDED RECTANGLE shape except where noted, each ~240x72, a 1px #212631 border on #0D1117, each with a small unfilled line glyph, an authored name, and a plain sentence:
1. "Find the renewing contracts" / "Searches and decides its own next move"
2. "Check each contract in turn" / "Runs the same step over many items"
3. "Draft the summary" / "Writes one piece in a single pass"
4. "Work out the totals" / "Runs a fixed calculation, no AI involved"
5. "Confirm before sending" / "Waits for a person" — the NOTCHED shape with the violet #895AF6 left edge
6. "Grade the draft" / "Scores the result against a rubric"
7. "Produce the brief" / "Makes the finished file"
8. "Post to Slack" / "Acts on another application" — ⚠ THIS NODE IS DIFFERENT AND IT MATTERS. Instead of a generic glyph it carries the OTHER APPLICATION'S OWN BRAND MARK — the real Slack mark, drawn accurately in its own colours. Beside it a small amber #F5A524 tag reading "CHANGES SOMETHING OUTSIDE". Draw two more of this kind beneath the row using the real Google Drive mark and the real Jira mark, to show that the brand mark is the identity and the node frame stays identical.

Beneath section 2, one plain sentence: "A step that touches another application wears that application's own mark. Everything else wears ours."

SECTION 3 — "THE ONE BRANCH THAT EXISTS". A hexagon labelled "If this step fails", with exactly TWO routes leaving it: a solid indigo #A3A5FF route labelled "Go to the step you chose" tagged "THIS WAY", and a dim dashed route labelled "Stop the run" tagged "NOT THIS WAY". Beneath, one sentence: "A step can name one place to go if it fails. That is the only fork today."

SECTION 4 — "PROPOSED, NOT BUILT". Draw this section visibly SET APART: a dashed #212631 border around the whole section and a small amber #F5A524 tag reading "NOT BUILT — NEEDS A DECISION". Inside it, a hexagon with THREE labelled routes leaving it — "Over £2m", "Under £2m", "No value found" — and one sentence beneath: "A step that picks between several routes does not exist yet, and would change the shape of every workflow. Drawn here only so the idea can be judged."

SECTION 5 — "INTERACTION STATES". The same ordinary node repeated six times, each labelled beneath: "At rest" (1px #212631), "Hovered" (border brightens, node lifts 4px), "Selected" (1px #A3A5FF), "Being moved" (dim, slightly transparent), "Needs attention" (a warning #F5A524 left edge and the words "Missing a model"), "Locked" (a small closed padlock corner mark and the words "You cannot edit this").

SECTION 6 — "RUN STATES". The same node repeated six times, each labelled with its state WORD, never colour alone: "Waiting" (dim hollow mark), "Running" (a soft indigo pulsing border and an elapsed clock reading 00:15 in monospace — NEVER a percentage and NEVER a fraction), "Worked" (green tick and one kept fact, "Found 12 contracts"), "Failed" (danger mark and a real reason, "The knowledge base did not answer"), "Not taken" (dim, dashed border, the words "Skipped by a branch"), "Waiting for you" (violet left edge, "Needs your approval", with "Approve" and "Send back" controls).

SECTION 7 — "AT SMALL SIZE". The same node at three widths — 240px, 180px and 120px — showing what drops away as it shrinks: the sentence goes first, then the glyph, and the name is the last thing standing.

Every icon UNFILLED: `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`, no exceptions. Motion only where stated: a 2s border pulse on the running node, a 4px lift on the hovered one. No glow, no bounce, no scale-up, no spin.

MUST NOT APPEAR: "phase_index", "llm_agent", "llm_batch_agents", "llm_single", "llm_emit", "llm_human_input", "llm_judge_rubric", "skip_to_phase", "depends_on", "on_failure", any snake_case identifier, any monospace machine label other than an elapsed clock, any percentage, any progress bar, any emoji.

### COPY TO HERE (end)

---
---

# 11 · THE RUN PANEL'S OTHER PARTS  <- STEP 4  (state sheet, closes c8)

### COPY FROM HERE (start)

A COMPONENT SPECIMEN SHEET, desktop 1440 wide, dark "Deep Midnight" theme, for an internal agentic workflow platform. NOT an application screen — NO app shell, NO icon rail, NO navigation. Just the sheet on the page background.

EXACT COLOURS: page background #060A0F, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body, JetBrains Mono ONLY for sizes and clocks.

Title: "The run panel" with one line: "The parts that only appear while something is happening." Every component drawn inside a 380px-wide column, because that is the real panel width. Section headings 11px uppercase, letter-spaced, dim.

1 — "WHEN IT NEEDS YOU". Two states of the same card, side by side. OPEN: a violet #895AF6 left edge, the question "Approve the vendor risk score?", one supporting sentence, a small choice control offering "Low", "Medium", "High", a short reason field, and two controls "Send back" and "Approve". RESOLVED: the same card, quiet and dim, a green tick, the words "You approved this", and a time "14:20" in monospace.

2 — "WHEN IT IS WAITING FOR A PERSON". A slim inline cue: a violet left edge, a small raised-hand glyph, the words "Waiting for someone to approve", and nothing else.

3 — "THE FILES IT MADE". A list of file rows, each with an unfilled document glyph, a human name, a size in monospace, and when it was made. Include: "Renewal brief" 1.2 MB 2m ago · "Contract table" 450 KB 5m ago · "Risk schema" 12 KB 10m ago. Then ONE row whose time is genuinely unknown: "Raw extract" 2.4 MB and, where the time would be, the words "time unknown" in dim text — never a blank, never a dash, never a zero. Finally an empty state: "Nothing made yet."

4 — "LOOKING INSIDE A FILE". Two previews. A TABLE preview showing a small grid with a header row and three data rows, and beneath it "Showing the first 50 rows". A STRUCTURED preview showing indented key-and-value lines in monospace with a copy control, and beneath it "End of preview".

5 — "WHAT CHANGED BETWEEN VERSIONS". A compact diff block: two unchanged lines in dim, one removed line with a danger #DC2626 left edge, one added line with a success #21C45D left edge. Line numbers in monospace, dim.

6 — "WHEN THERE IS NOTHING". The empty panel: a heading "Nothing here yet" and one supporting line "Files, to-dos and anything needing your input will show up here." NO decorative illustration and NO icon — the calm of this state is the point.

Every icon UNFILLED: `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`. No emoji, no gradients, no glow, no drop shadows, no percentages, no progress bars.

MUST NOT APPEAR: any snake_case identifier, any filename with an extension, "phase_index", "llm_agent", any monospace machine label other than sizes, clocks and diff line numbers.

### COPY TO HERE (end)

---
---

# 12 · FORK + DELETE  <- STEP 5  (state sheet, closes the rest of c6)

### COPY FROM HERE (start)

A COMPONENT SPECIMEN SHEET, desktop 1440 wide, dark "Deep Midnight" theme, for an internal agentic workflow platform. NOT an application screen — NO app shell, NO icon rail, NO navigation.

EXACT COLOURS: page background #060A0F, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body.

Title: "Two dialogs, deliberately unequal" with one line beneath: "A harmless action asks lightly. A permanent one asks heavily. The difference is the design."

SECTION 1 — "MAKING A COPY (a harmless action, asked lightly)". A 480px dialog: title "Name your copy", one sentence "You are copying Quarterly Business Review. Give your copy a name you will recognise later.", a name field that is EMPTY with no placeholder text pre-filled, one quiet consequence line "Opens a new private copy you can edit. The published version stays live and unchanged.", and a footer with a bordered "Cancel" and a filled #A3A5FF "Create my copy".
Draw the field in THREE states stacked beneath, each labelled: EMPTY showing the hint "Give it a name."; CLASHING showing an amber #F5A524 hint "You already have one called this. Allowed, but you will not be able to tell them apart." with the create control STILL ENABLED; and FREE showing a quiet neutral hint. There is NO green tick and NO "available" badge anywhere — the state is said in words.

SECTION 2 — "DELETING (permanent, so asked heavily)". A 520px dialog. Show it in TWO states side by side.
LOADING: title "Delete this workflow?", a quiet line "Checking what this will remove…", and NO delete control present at all — the destructive control does not exist until the counts do.
LOADED: title "Delete this workflow?" — the workflow's name is NOT in the title. Then a group headed "Permanently removed" containing the name "Quarterly Business Review" once, with "1 version" and "17 run records". Then a second group headed "Kept — not touched": "17 chat threads become normal chats. Transcripts and files stay. Your knowledge base is untouched." Footer: a bordered "Keep it" and a filled DANGER #DC2626 "Delete forever". Beneath the footer, a quiet receipt line "Recorded with your name in the audit log." There is NO undo and NO restore anywhere.

SECTION 3 — "WHY THEY LOOK DIFFERENT". A small comparison table with two columns, "Making a copy" and "Deleting", and four rows answering yes or no in words: "Names what it affects" — no / yes. "States exact numbers first" — no / yes. "Spends danger colour" — no / yes, on the button only. "Leaves a receipt" — no / yes.

Danger colour appears ONLY on the delete button itself — never as a wash, tint or border over the notice or the panel. Every icon UNFILLED: `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`. No emoji, no gradients, no glow, no drop shadows.

MUST NOT APPEAR: a pre-filled copy name such as "(Copy)", the machine word "fork" anywhere, a green "available" tick, any snake_case identifier, any percentage.

### COPY TO HERE (end)

---
---

# 13 · CONNECTIONS — THE OTHER APPLICATIONS  <- STEP 3  (state sheet)

⚠ **Read `FORWARD-CHECK.md` first if you want the reasoning.** Three decisions are already recorded
and this sheet must obey them: connections are **provider-shaped** (one Slack account, many
capabilities — never one connection per action); they are **platform assets** usable in chat AND
workflows, not owned by any one workflow; and **every capability is a WRITE**, so nothing here is a
bare toggle.

### COPY FROM HERE (start)

A COMPONENT SPECIMEN SHEET, desktop 1440 wide, dark "Deep Midnight" theme, for an internal agentic workflow platform. NOT an application screen — NO app shell, NO icon rail, NO navigation. Just the sheet on the page background.

EXACT COLOURS: page background #060A0F, card #0D1117, raised #0F141B, muted fill #151B24, border #212631, text #F4F6FE, secondary #9AA3B5, dim #6B7383, primary soft indigo #A3A5FF, violet #895AF6, success #21C45D, warning #F5A524, danger #DC2626. Manrope headings, Inter body.

Title: "Connections" with one line beneath: "Other applications this workspace can reach. Connect once, use anywhere."

⚠ THE ONE RULE THAT GOVERNS THIS WHOLE SHEET: every connected application is identified by ITS OWN REAL BRAND MARK — the actual Slack mark, the actual Google Drive mark, the actual Jira mark, the actual GitHub mark, the actual Notion mark — drawn accurately in their own brand colours at 20px. NEVER a generic plug, link, cloud or puzzle-piece glyph, and never an invented mark. The brand mark IS the identity of the row.

SECTION 1 — "WHAT IS CONNECTED". A list of connection rows, each a bordered row on #0D1117 carrying the brand mark, the application name, one dim line of who connected it and when, and a state on the right:
- Slack — "Connected" in success #21C45D with a tick
- Google Drive — "Connected" in success #21C45D with a tick
- Jira — "Needs signing in again" in warning #F5A524, with a bordered "Sign in" control
- GitHub — "Not connected", dim, with a bordered "Connect" control
- Notion — "Not connected", dim, with a bordered "Connect" control
Every state says its word. Colour is never the only signal.

SECTION 2 — "ONE CONNECTION, MANY THINGS IT CAN DO". Expand the Slack row into a detail card showing that ONE account grants MANY capabilities — never one connection per action. The card carries the Slack brand mark, the account name, and a list of capability rows, each with a plain human name, a small tag saying whether it only READS or also CHANGES things, and a switch:
- "Read messages in a channel" — tag "READS ONLY" — switch on
- "Search past conversations" — tag "READS ONLY" — switch on
- "Post a message" — tag "CHANGES THINGS" in amber #F5A524 — switch off
- "Create a channel" — tag "CHANGES THINGS" in amber #F5A524 — switch off
Beneath the list, one plain sentence: "Reading is safe. Anything that changes something has to be armed before a workflow can use it."

SECTION 3 — "ARMING SOMETHING THAT CHANGES THINGS". The graded guard, shown as three states side by side of the same "Post a message" capability:
- AT REST: the switch is off, and beneath it one sentence "Off. A workflow cannot post anything."
- ARMING: a bordered block with a warning #F5A524 left edge, the heading "Let workflows post to Slack?", one plain consequence line "Anything you approve here can post messages that other people will see.", and two controls, a bordered "Cancel" and a filled amber "Turn it on".
- ON: the switch is on, with a quiet receipt line beneath, "Turned on by you, recorded in the audit log."
Danger and warning colour appear on the CONTROL only — never as a wash over the whole block.

SECTION 4 — "HOW A CONNECTION APPEARS INSIDE A STEP". A 400px-wide fragment of the step panel's "What it can reach" group, showing that connections sit alongside folders rather than in a separate world: a "Folders it can read" row with a folder chip "Contracts", then a "Other applications" row containing two chips, each carrying its real brand mark — a Slack chip and a Google Drive chip — plus a bordered "+ Add" chip. One dim sentence beneath: "Only connections you have already armed appear here."

SECTION 5 — "THE SAME CONNECTION IN CHAT". A small chat-message fragment showing the agent used a connection mid-conversation: a compact tool row carrying the real Slack brand mark, the words "Posted to #vendor-renewals", and a small time. One dim sentence beneath: "A connection belongs to the workspace, not to one workflow — the same one works in chat."

Every non-brand icon UNFILLED: `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`. Brand marks keep their own colours and are the ONLY coloured marks on this sheet. No emoji, no gradients, no glow, no drop shadows, no progress bars, no percentages.

MUST NOT APPEAR: a generic plug/link/cloud/puzzle glyph standing in for an application, any invented or approximated brand mark, any snake_case identifier, any OAuth or token or scope vocabulary shown to the user, any count of API calls, any latency figure.

### COPY TO HERE (end)

---
---

# R-GENERIC-9 · MAKE THE DECISIONS LIST DOMAIN-NEUTRAL  <- STEP B

**An EDIT of the existing `Vendor Renewal Risk Sweep Arrival` screen. NOT a new screen.**

*Why: three of that screen's five decision rows are contract-specific — "How it identifies a vendor",
"How long a contract runs", "How it weighs risk". Those are SLOTS in a component, not fixture text,
so the component currently reads as a contract-review feature rather than as a decisions list. An HR,
clinical or finance workflow has nothing to put in them.*

### COPY FROM HERE (start)

Keep the whole screen — the layout, the arrival card, the decisions list structure, the receipt block, every colour and every state treatment. Change only the EXAMPLE and the row LABELS, so the same component visibly works for a completely different kind of work.

1. CHANGE THE EXAMPLE ENTIRELY. The workflow is no longer about contracts. It is now "New starter onboarding check". The arrival card's name becomes "New starter onboarding check", and the line beneath reads: "From: When someone joins, check their paperwork is complete and flag anything missing before their first day…".

2. RELABEL THE FIVE DECISION ROWS so every label is about the WORK, never about a business domain. Use exactly these five, in this order, and keep the same three state kinds:
   1. "What it reads" — green tick, the word "Settled"
   2. "How it recognises the thing it's about" — warning mark, the words "Needs you", with the in-place correction row beneath it (a short bordered input and a "Use this" control)
   3. "How long it looks back" — dim hollow mark, the words "Not recorded" — the unknown arm, reading neutral, never as a failure
   4. "What it must cite" — warning mark, the words "Needs you", and beneath it the single sentence "You cannot publish until this is settled." THIS REMAINS THE ONLY ROW ALLOWED TO MENTION PUBLISHING.
   5. "How it decides" — green tick, the word "Settled"

3. UPDATE THE RECEIPT to match the new example: "Model: GPT-4o" and "Reads from: People". Keep the dim italic line "This block is absent when nothing was applied."

Every other rule stays: rows on one line except rows 2 and 4, sentence case, no emoji, no gradients, no glow, no drop shadows, every icon unfilled at `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`.

MUST NOT APPEAR: the words "vendor", "contract", "renewal" or "risk" anywhere on this screen; any schedule or recurrence as an applied setting; any confidence score; any snake_case identifier; any percentage or progress bar.

### COPY TO HERE (end)

---
---

# R-GENERIC-3 · THE SPINE MUST SHOW TWO ENDINGS, NOT ONE  <- STEP C

**An EDIT of the existing `Northwind QBR - Spine Detail View` screen. NOT a new screen.**

*Why: the spine currently ends in "Fill the QBR template" — fill-a-template. `SEED-168` measures that
as the single position the engine takes on the output axis, and it is the wall every domain hits. The
product genuinely has two output shapes (a file, or an answer in chat) and the spine only ever draws
one, which teaches a reader the wrong thing about what a workflow can be.*

### COPY FROM HERE (start)

Keep the whole screen — the shell, the header, the tabs, the selected expanded step, the fork with its two named lanes, the human step with its controls, the footer row, and every colour and spacing decision. Change only the final step, and add a second variant beside it.

1. SPLIT THE LAST STEP INTO TWO ALTERNATIVES, shown side by side under a small heading "How a workflow can end". Both are the same rounded-rectangle node shape at the same size:
   - LEFT, labelled beneath as "Ends by making a file": the step "Fill the report template" with the supporting sentence "Produces the finished file" and a small unfilled document glyph.
   - RIGHT, labelled beneath as "Ends by answering": the step "Answer in the chat" with the supporting sentence "Writes the answer straight into the conversation" and a small unfilled message glyph.
   Between them, one plain dim sentence: "A workflow ends one way or the other. Both are complete."

2. MAKE THE NAMES LESS TIED TO ONE BUSINESS. Rename the five steps so the spine reads as a shape rather than as one company's report, keeping every sentence and badge exactly as it is:
   1. "Gather the source material"
   2. "Gather the supporting notes"
   3. "Draft the sections"
   4. "Confirm before it goes out"
   5. replaced by the two alternatives above
   Change the workflow name in the header from "Northwind QBR" to "Quarterly review".

3. KEEP EVERYTHING ELSE IDENTICAL — the fork lanes still read "If the draft needs a person" / "If it does not", the human step still carries "Someone has to approve this before it continues." with "Approve" and "Send back", and the footer still reads "5 steps, runs top to bottom, one person gate".

Every icon unfilled at `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`. Sentence case for secondary text, one line per row, no emoji, no gradients, no glow, no drop shadows.

MUST NOT APPEAR: "phase_index", "llm_agent", "llm_single", "llm_emit", "llm_human_input", "skip_to_phase", "depends_on", "READ-ONLY GRAPH", any snake_case identifier, any duration or elapsed time (nothing has run on this screen), any percentage.

### COPY TO HERE (end)

---
---

# R-EXTERNAL · THE EXTERNAL STEP ON THE CANVAS AND IN THE SPINE  <- STEP A (do this first)

**TWO edits, same idea, applied to two existing screens:**
`Northwind QBR - Live Canvas View` **and** `Northwind QBR - Spine Detail View`.

*Why: § 13 drew the connections SETTINGS surface — the list, the capabilities, the arming. That was
not the ask. The ask is what a step that calls another application looks like **where you actually
author and watch a workflow**: on the canvas and in the spine. `external_action` is already a shipped
node kind, so this node exists in the vocabulary and has never been drawn in context.*

## ⚠ The design decision this settles, stated before the prompt

An external step has **two** identities competing for the same slot: it is a *kind of step*
(`external_action`, which would take a type glyph from the shared map) and it is *a specific
application* (Slack, Drive, Jira, which takes a brand mark). Drawing both puts two marks on one node,
and the house rule is at most one accent per card.

**The decision: the BRAND MARK WINS the leading slot, and the type is carried by words.** Which
application a step touches is the thing a reader needs first — "it posts to Slack" is more useful than
"it is an external action". The fact that it reaches outside is then carried by an amber tag in
words, never by a second glyph.

⚠ **Stitch cannot emit real third-party logos** — measured, it substitutes a grey placeholder. That
is a tool limit, not a design one: `@lobehub/icons` is installed and `icon-convention.md` §1 already
mandates single-sourced real marks at build time. So this prompt designs **the slot, its size, its
position and its treatment**; the real mark drops into that slot when it is built.

### COPY FROM HERE (start) — paste this to the CANVAS screen, then again to the SPINE screen

Keep the whole screen exactly as it is — the shell, the header, the tabs, every existing node, every connection, every colour, all motion. Add external-application steps and change nothing else.

1. ADD THREE EXTERNAL STEPS. These are steps that act on another application. Place them naturally in the flow, after the existing work:
   - "Post the summary to the team channel" — the application is Slack
   - "File the report in the shared drive" — the application is Google Drive
   - "Raise a ticket for anything unresolved" — the application is Jira

2. HOW AN EXTERNAL STEP IS DRAWN — this is the whole point, so follow it exactly:
   - The node frame is IDENTICAL to every other step: same size, same 1px #212631 border, same #0D1117 fill, same corner radius. An external step is not a special-looking box.
   - In the LEADING ICON SLOT, where an ordinary step carries its grey line glyph, an external step instead carries **the application's own brand mark, at 20px, in that application's own colours** — the real Slack mark, the real Google Drive mark, the real Jira mark. This mark REPLACES the step-type glyph; there is never a second glyph beside it.
   - Directly beneath the step's supporting sentence, one small uppercase tag in warning #F5A524 reading "CHANGES SOMETHING OUTSIDE". This tag, in words, is what says the step reaches out — never a second icon.
   - The application's name appears in the supporting sentence in plain words, so the step still reads correctly if the mark fails to load: for example "Posts a message to Slack".

3. ONE READ-ONLY EXTERNAL STEP FOR CONTRAST. Add a fourth: "Read this week's tickets" with the Jira mark, whose tag reads "ONLY READS" in dim grey rather than amber. Reading and writing must be distinguishable at a glance, in words as well as colour.

4. ON THE CANVAS ONLY — the connection leaving an external step is drawn exactly like any other connection. Reaching outside does not change how the flow is drawn; it changes what the node says about itself.

5. ON THE SPINE ONLY — the external steps sit in the same single column as every other step, same row height, same alignment. The brand mark sits where the type glyph sits on its neighbours, so the column of marks stays optically aligned.

Every non-brand icon stays UNFILLED at `font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`. Brand marks keep their own colours and are the only coloured marks on the screen. No emoji, no gradients, no glow, no drop shadows.

MUST NOT APPEAR: a generic plug, link, cloud, globe or puzzle glyph standing in for an application; two glyphs on one node; any OAuth, token, scope, endpoint or webhook vocabulary; any snake_case identifier; "external_action"; any latency or API-call count; any percentage.

### COPY TO HERE (end)
