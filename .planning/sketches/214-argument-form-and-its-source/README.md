---
sketch: 214
name: argument-form-and-its-source
question: "How does a step's argument declare where its value comes from — and does the shipped 400px panel survive a field-per-argument form?"
winner: null
tags: [phase-214, step-01, step-02, arguments, panel-width, workflow-builder, g-2]
---

# Sketch 214 — The argument form and its source

**Written 2026-08-28.** ⭐ **This is one of the four G-2 acceptance bars for Phase 214** — step 4 of
the ratified method. Step 1 (direction) is `.planning/sketches/214-stitch-step-names-service-and-action/`;
the two are never collapsed (`SEED-155`).

```
node drive.cjs           # 141 assertions — the contract, executable
node drive.cjs --emit    # ALSO regenerates BUILD-CONTRACT.generated.md FROM the running sketch
```

Current state: **141 passed, 0 failed · 19 argument rows · 14 source-picker groups.**

## How to view

```
cd .planning/sketches && python -m http.server 8899 --bind 127.0.0.1
→ http://127.0.0.1:8899/214-argument-form-and-its-source/index.html
```

Or open `index.html` directly — it has no build step and no dependency beyond `../themes/default.css`.

---

## Variants

| tab | what it is | the trade it makes |
|---|---|---|
| **A · 400px rail** | The shipped track (`WorkflowBuilderPage.tsx:2817`). Source control stacked under each label. | **Path of least resistance** — no width change, no pin to update. Costs three stacked pickers repeating the same three words, and there is nowhere to put the gutter reading. |
| **B · wide + source gutter** | `clamp(480px, 38%, 640px)` — Settings' track since Phase 213 — with Stitch's `03` gutter hoisted into a left column. | **The scan.** Three source readings in one column, so *"where does each of these come from?"* is answered by looking down. Costs the canvas ~120px and the gutter 118px. |
| **C · wide + inline source** | Same width, no gutter column; the three arms sit at the end of the label row and the pressed arm **is** the reading. | Recovers the gutter's 118px and drops the restatement. **Gives up the scan** — the source is read three times instead of once. |
| **§4 · both widths, same step** | The two tracks over byte-identical content. | The fork judged by looking rather than by argument. |
| **§5 · the four hard states** | The states no layout choice removes, plus the first-step case. | Each is a `214-CONTEXT.md` decision made visible. |

---

## ⭐ What this sketch found that Stitch structurally could not

> **Stitch drew `Cc` and `Reply to` rows for `send_email`. Both are impossible.**

`smtp_adapter.INPUT_SCHEMA` (`smtp_adapter.py:293-311`) declares **exactly three** properties —
`to`, `subject`, `body` — under **`additionalProperties: False`**, and `send()` raises
`SmtpArgumentsInvalid` on any undeclared key (`smtp_adapter.py:337`). A `cc` field would not be an
unsupported nicety: **the adapter refuses the whole send** the moment one arrives.

A sketch that drew Stitch's five fields would have specified a form whose every submission the
backend rejects — and nothing downstream would have caught it, because the form would typecheck,
render, and pass every frontend test.

**That is the entire argument for step 4 existing.** Stitch renders zero shipped components, so it
cannot know what the backend accepts. This sketch reads `INPUT_SCHEMA` and `drive.cjs` asserts the
property list, so the next time an adapter's schema changes the assertion is where it shows up.

`cc` still appears — as **a removable leftover** (D-214-08, §5 card 4), which is the only honest
place for it.

---

## 1 · The copy replacements, and why

Stitch's own words are kept beside the replacements so the change is auditable rather than silent —
the 213 pattern.

| Stitch / D-214-01 wrote | this sketch says | why |
|---|---|---|
| *"Provided at run-time"* | **"Asked when this runs"** | *"Run-time"* is our machinery's word for its own lifecycle. The person's question is **when**, and the answer is *when this runs* — a moment they can picture. |
| `REQ` (a marker) | **"Nothing supplies this yet"** (a sentence) | ⚠ `REQ` labels the *field* and leaves the reader to infer the *problem*. The row that publish will refuse should say what is wrong with it, not what category it belongs to. `Required` / `Optional` survive as a separate, quieter mark — they are a fact about the argument, not a verdict on the row. |
| `Fixed value` (D-214-01) | **"Set here"** | *"Value"* is a wire word. The author is setting it **here**, on this form, now — and the contrast that matters is *here* vs *later* vs *elsewhere*, which is exactly what the three arms are. |
| `From an earlier step` (D-214-01) | **"From an earlier step"** — kept verbatim | It was already the person's words. Changing it would be change for its own sake. |

⚠ **All four live in `COPY.js` and none lives in a component.** `ExternalActionSection.tsx`'s own
docblock states the rule: *"a sentence that lives inside a component is a sentence nobody can test
for drift."* The table ports as `frontend/src/components/workflows/argumentVocabulary.ts`.

---

## 2 · The one real departure from Stitch — recorded, not absorbed

> **Stitch's `03` put the source glyph in a gutter and left the CONTROL in the field's own column.**
> **This sketch makes the gutter a READING and keeps the control on the row** — so the gutter never
> becomes a second place to click.

The reason is mechanical rather than stylistic. A gutter that is *also* a control is a second target
for the same decision, and a person who presses the wrong one learns the two are different by trial.
The gutter earns its 118px by being **scannable**, which is a property of text, not of a control.

⚠ **The gutter lane is always reserved.** `.arow` ships `grid-template-columns: 0 minmax(0,1fr)` and
`.gutter-on` widens *the same column* to `118px` — it never inserts one. Without that, every row
would shift when a source is chosen: a jitter no test catches and every scrolling eye does. This is
the 213 override-edge finding ported, and `drive.cjs` asserts all three parts of it.

---

## 3 · The fork this sketch does NOT decide — and what each half costs

**§4 puts both tracks over identical content so it can be judged by looking.** ⚠ **The consequence
is conditional and the plan must carry whichever half is picked:**

| if the pick is | then | and |
|---|---|---|
| **400px** (shipped) | the source **gutter is dropped** — it does not fit, which is the finding rather than a stacked deck | **variant C** is the shape: the inline control on the label row. **No width pin changes.** |
| **`clamp(480px, 38%, 640px)`** | **variant B** ships, gutter and all | `WorkflowBuilderPage.tsx:2817` **and whatever pins it** change in the same commit |

⚠ **A pinned assertion is at stake, and Phase 213 discovered its equivalent only mid-flight.**
`ConnectionFormPanel.test.tsx:571` pinned `400px` and had to be updated in the same commit as the
sketch that invalidated it. **Name the pin in the plan; do not meet it in a red gate.**

⚠ **480 is not a new magic number.** It is `ConnectionsTab.tsx:387`, shipped since Phase 213 — a
house pattern, and the measured floor where a three-way control fits *on* a row rather than wrapping
under it.

---

## 4 · Each invariant → the React equivalent Phase 214's suite must reproduce

`BUILD-CONTRACT.generated.md` §2 carries all fifteen as a table, generated from the running sketch.
The load-bearing ones:

| # | invariant | React equivalent |
|---|---|---|
| 1 | **no `<textarea>`, no "JSON", no "Tool Arguments", no key/value, no "Advanced"** — anywhere | a `?raw` source fence over `PhaseFormPanel` + `McpToolPicker` + the new component, **with a positive control**, plus an assertion that `MCP_TOOL_ARGS_LABEL` no longer exists |
| 2 | every source group has **exactly three arms, at most one pressed**, in the **same order** | `getAllByRole("radio")` is 3 per group; `{checked:true}` ≤ 1; assert accessible names in order |
| 3 | the gutter is a grid column that **widens**, never one that is inserted | assert a sourced and an unsourced row have **identical** label-column offsets |
| 4 | **no `{{ }}`, no dotted path, no slug** beside the upstream binding | assert the stored value is a bare phase slug **and** that the slug never reaches the DOM |
| 5 | the upstream chip carries the **author's own name** | render a phase whose name ≠ its slug; assert the name |
| 6 | exactly the adapter's own properties are drawn | drive the renderer from `inputSchema` (`descriptors.py:169`) and assert **no field exists for an undeclared key** |
| 7 | a leftover key is **visible and removable**, never dropped | seed `tool_args` with `cc`; assert both |
| 8 | the `body` row is **pre-set and still changeable** (D-214-03) | assert the pre-set source, the stated note, and an enabled control |
| 9 | **no capability id reaches the DOM** — `send_email` / `create_ticket` / `post_message` | the shipped `ExternalActionSection.test.tsx` fence, extended to the argument form |
| 10 | **no `[title]` carries copy** | the shipped §12 fence |
| 11 | the form spends **no destructive colour** | `--destructive` absent from the argument rules — an unfilled argument is not an irreversible act |
| 12 | the step names its **service and action**, never *"external action"* | assert both strings; assert the phrase is absent |

---

## 5 · ⚠ Two things in `drive.cjs` that are findings, not plumbing

**a · The SC#1 fence needs a `SURFACE`, not the whole document — and it needs a positive control.**
The sketch annotates itself (*"no key/value rows, no JSON"*), so a fence over the rendered text trips
on the sentence saying the surface is clean. Annotation carries `data-anno` and is stripped. ⚠ **A
stripper is a thing that can silently remove everything**, so three positive controls assert the
surface is non-empty, still carries a real argument row, and really did lose the annotation.

**b · The positive control found a real hole on its first run.** `SURFACE` harvested `placeholder`
and `aria-label` but **not `value`** — so a JSON blob sitting in a pre-filled input would have passed
the fence. The control failed, and the fix widened the fence. ⭐ *A guard nobody has seen fail is not
a guard.*

⚠ **The `<textarea>` fence deliberately runs over the WHOLE file, not the surface.** A textarea
hidden inside an annotation would still be a textarea.

---

## 6 · What this sketch does not cover

- **The publish refusal** → sketch 215.
- **The mark and the action on run surfaces, and the approval pause** → sketch 216.
- **The describe door** → sketch 217.
- **`Ask at launch` rendering as a real field in `RunModal` / the schedule modal / chat** (D-214-04)
  — the *declaration* is here; the *launcher form* is a separate surface and is not drawn.
  ⚠ SC#2 says *"from every launch path"*, so a plan that ships the declaration without the four
  launchers has met half a criterion.
