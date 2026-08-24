---
phase: 193
plan: AUTH-03-FRONTEND
subsystem: workflow-authoring-ui
requirement: AUTH-03 (rewritten 2026-08-14)
piece: 2 of 3 (Builder UI). Piece 1 = the endpoint (`44c582a0`). Piece 3 = retire the run-time upload box.
tags: [workflows, templates, builder, upload, honesty]
key-files:
  created:
    - frontend/src/components/workflows/TemplateAttachSection.tsx
    - frontend/src/components/workflows/TemplateAttachSection.test.tsx
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/components/workflows/PhaseFormPanel.tsx
    - frontend/src/components/workflows/builderStore.ts
    - frontend/src/pages/WorkflowBuilderPage.tsx
    - scripts/vitest-count-gate.cjs
commit: 000539a3
completed: 2026-08-14
---

# Phase 193 — AUTH-03 frontend: the author can attach a template

The Builder can now **write** the descriptor its own node face has been **reading** since
Phase 187. One new component, one new store action, one API helper, one gated line in the
panel — and 25 tests.

## What the operator can now SEE, and where to click

1. Open any workflow in the Builder (`/workflows` → **Open** or **Tweak**, or build a new one).
2. Click the **deliverable** step — the one whose type is `llm_emit` ("Deliverable" on the
   node, "Output type: render_template" in the form). Either graph view works; this is not
   canvas-gated.
3. Scroll the 400px right-hand form panel to the bottom. Below the shipped fields, above
   "How strictly this step is held", there is a new section: **“The file this step fills in.”**

It reads one of two ways, and never both:

| State | What is on screen |
|---|---|
| nothing attached | *“No template attached yet. This step fills in a document you supply.”* + an **Attach a template** picker |
| attached | **📄 `Q3 Report _final_.docx`** + a **Replace this template** picker |

Pick a `.docx` / `.pptx` / `.xlsx` and it uploads, the filename appears, and the draft saves
immediately. Pick a `.png` and the panel says, in the server's own words, *“A workflow
template must be a .docx, .pptx or .xlsx document (got .png).”*

**On a draft that has never been saved** there is no picker at all — a sentence instead:
*“Save this draft first — a template attaches to a saved workflow. Use Save draft above,
then attach.”* Absent, not disabled: a disabled control is one a later edit can silently
re-enable, and `toBeDisabled()` would pass on that very defect.

## The read half was waiting, and it is CONDITIONAL — stated rather than implied

`WorkflowBuilderPage.tsx:667` already resolved `assets.find(a => a?.kind === "template")
?.filename` into `nameContext.templateFilename`, and that value reaches **three** consumers
already wired: the spine graph (`:1642`), the canvas (`:1668`, flag-gated) and the seed
receipt (`:1730`). `derivedFace` tier 2 turns it into the node face **`Fill Q3 Report.docx`**.
So attaching a template does make the graph node re-label itself — measured through the
existing path, with no change to any of it.

**But `nodeTitle`'s ladder outranks it twice, and the SUMMARY says so rather than claiming a
guaranteed visual:**

```
nodeTitle = phase.name?.trim()            // tier 0 — an author/LLM-supplied name WINS
          ?? derivedFace(...)             //   tier 1 = a bound skill; tier 2 = the template
          ?? PHASE_TYPE_SENTENCES[type]
```

So `Fill {filename}` appears on the node **only when the step carries no `name` and no bound
skill**. A canvas-placed step has neither (`minimalPhaseFor` emits `{slug, phase_index,
config}` and no `name`), so it re-labels. An NL-generated step usually carries a model-written
`name`, so it does **not** — for those the filename is visible in the panel and nowhere else.

That is why the panel section shows the filename **itself** rather than relying on the face.
No change was made to the ladder: re-ranking `nodeTitle` is a vocabulary decision with three
consumers and it is not this plan's to make.

## The design decision I was asked to name: config vs definition

**Chosen: a new optional definition-level prop on `PhaseFormPanel`, forwarded verbatim to a
component that owns everything.** Not mounted on the page beside the panel.

The seam is real. `PhaseFormPanel`'s own docblock states it: *"this panel's only write seam
(`onChange`) patches `config`"* — which is **phase**-scoped — while a template descriptor is
**definition**-scoped, a sibling of `phases` in `assets[]`. Routing it through `onChange`
would bury a definition-level fact inside one step's config, where
`resolve_template_source` would never look for it and `nameContext` would never find it.

**Why the prop and not a page-side mount:** the objective is that the author sees this *on the
emit step*, where the deliverable is configured — the template is definition-level in storage
but step-level in meaning, and a control floating beside the graph would divorce it from the
one step that consumes it. The panel is also the surface all three entry doors already share.

**Why it costs the panel almost nothing** — this is the standing G-5 order on
`PhaseFormPanel.tsx`, honoured by construction and measured, not asserted:

```
+import { TemplateAttachSection } from "./TemplateAttachSection"   ← 1 import
+  template?: { definitionId; filename?; onAttached }              ← 1 optional prop (type)
+  template,                                                       ← 1 destructure
+{template && pt === "llm_emit" && <TemplateAttachSection {...template} />}   ← ONE render line
```

**Exactly one insertion reaches the render body** (plus a three-line comment). That is the
`GovernanceSection` shape the ledger tells the next surface to keep: *"the next surface that
needs the panel gets its own component and one gated line."* Every sentence, every state,
every refusal and the upload itself live in `TemplateAttachSection.tsx`. Absent prop ⇒ nothing
renders, so every existing mount — including the flag-off Spine — is unchanged.

**One deliberate divergence from its two neighbours: the prop is UNCONDITIONAL,** where
`rails` / `onGovernanceChange` ride `canvasEnabled`. Those two ARE the canvas contract and
D-181-01 promises a flag-off surface identical to the shipped one. A template binding is not a
canvas idea — it is the only way any author can attach the file their deliverable fills in, and
gating it would leave the Spine (the surface most authors are actually on) with no door at
all. The panel renders nothing for it on any non-`llm_emit` step, so the cost elsewhere is zero.

## The write path — one writer on the JSONB, and it saves NOW

`builderStore.setTemplateAsset` is a **third structural mirror** of `setProjectFolder` /
`setBusinessRequirement`: same field class (`meta`), same `dirty`-in-the-same-`set()` reason
(the store's subscription arms `dirty` on a change to the **`phases`** reference and nothing
else, so a meta-only write would otherwise be a real definition change the leave guard never
sees), same untracked posture (`partialize` narrows undo to `phases` — a template is undone by
attaching another, not by `⌘Z`), same `drafted`-only bail.

**It REPLACES the template entry and preserves every other asset.** `assets[]` is a mixed list
(`reference` assets exist), and *both* sides of this circuit read it with
`.find(a => a.kind === "template")`. A blind append leaves `.find` returning the **old**
filename forever — the exact defect shape where a person attaches a new file and the surface
keeps showing the previous name. Two of the 25 tests exist for that one line.

`WorkflowBuilderPage.onTemplateAttached` writes the store then calls `persistence.saveNow()`
**unconditionally**. Every other write on this surface is a keystroke that can be re-typed;
this one is not — the bytes are already in Storage under an id only this definition will ever
reference, so a session that ends before the next autosave beat leaves an orphaned object and
an author who was told the template was attached. `saveNow` bypasses the debounce and the
dirty gate but never the hold or single-flight, and `performWrite` reads `store.getState()` at
**fire** time, so the descriptor written one statement earlier is in the payload — this is not
a closure over a stale rendered value.

The backend deliberately does not write the definition, so there is still exactly **one**
writer on the `definition` JSONB and Phase 186's `If-Match` token is never raced.

## Failure states say what was wrong, in words

| Wire | What the author reads |
|---|---|
| `422` | the **server's own sentence**, verbatim — *"…must be a .docx, .pptx or .xlsx document (got .png)."*, *"File too large. Maximum size is 10 MB."* |
| `422` with no readable body | *"That file was refused. Attach a .docx, .pptx or .xlsx document under 10 MB."* |
| `404` | *"This workflow could not be found. It may have been deleted, or it may not be yours."* |
| `502` | the server's clean storage apology, relayed |
| no answer at all | *"The template could not be sent. Check your connection and try again."* |

422 and 502 are **relayed**, never re-worded: the rule that refused lives on the server and a
client copy of it can drift from the gate that actually fires (D-182-06). **404 is worded
here**, because the server answers 404 for both "no such workflow" and "not yours" on purpose
(no existence oracle) — so the only honest client sentence names both and prefers neither, and
relaying the server's terse `"Workflow not found"` would invent a distinction the server
refused to make. One test asserts the terse relay is **not** what reaches the DOM.

**No bare status code ever reaches the surface** — swept over the whole rendered container,
not just the error line.

## RED-first evidence

Two plants applied to **real production source**, both observed RED before the pin existed:

1. **`setTemplateAsset` appending instead of replacing** (the `others` filter deleted from
   `builderStore.ts`) → 2 failures: *REPLACES the template rather than appending a second one*
   and *preserves every asset that is NOT the template*.
2. **The 404 branch relaying `error.detail`** instead of the both-causes sentence → 1 failure:
   *404 is worded HERE and names BOTH causes*.

Both files restored; `TemplateAttachSection.tsx` verified md5-identical at `0414bf98…`.

**One genuine RED that was not a plant, and it is the finding of this plan:** the first gate
run failed `builderStore.test.ts > the store source names no network seam`. My new docblock
*quoted the import specifier it was explaining*, and the fence reads the RAW source, so the
prose documenting the fence tripped it — the same shape 192-05 hit with its `title=` sweep.
The fence was **not weakened**; the prose was reworded, and the docblock now carries the
warning so the next person does not re-discover it.

## Gate numbers

| | baseline at HEAD | after |
|---|---|---|
| `tsc -p tsconfig.app.json` | **33** | **33** (unmoved) |
| count gate | exit 0 · total **3561** · failed **0** · **67/67** pinned | exit 0 · total **3586** · failed **0** · **68/68** pinned |
| `eslint` on the six touched files | — | **0 problems** |

`+25` is exactly the new suite. The `+24` drift column is the pre-existing, inherited drift set
(`ExternalActionSection` +9, `PhaseTimeline` +4, `WorkflowBuilderPage.canvas` +5,
`builderStore` +6) — untouched, as ten prior plans also declined to absorb it.

`GSD_VITEST_MAX_WORKERS=2` throughout, per the brief. The documented `=4` is stale at this
suite size.

## Found but deliberately NOT fixed

1. **`builderStore.test.ts` is pinned at 52 against an actual of 58** — a +6 drift owed since
   192-01. `setTemplateAsset`'s six store cases therefore live in
   `TemplateAttachSection.test.tsx`, not in `builderStore.test.ts`: adding there would have
   forced this plan either to re-pin and silently swallow somebody else's six, or to leave the
   file under-pinned. Neither is this plan's call. The suite header records why.
2. **A bound skill outranks the template on the node face.** `derivedFace` tier 1 (`Run the
   {skill}`) beats tier 2 (`Fill {file}`), so an emit step with both shows the skill. Correct
   per D-187-04 (most-specific-first) and untouched — but it means the node face is not a
   reliable confirmation, which is why the panel shows the filename itself.
3. **No detach.** There is no way to REMOVE a template once attached, only to replace it —
   the backend has no `DELETE /workflows/{id}/template` either (piece 1's own note 3). A
   `setTemplateAsset(null)` would be a one-line store change, but the endpoint and the
   orphaned-object question belong together and neither is in this piece's scope.
4. **Re-uploading orphans the previous object.** By design (piece 1 mints a new `uuid8` so a
   draft still pointing at the old `asset_id` keeps rendering), so bound templates accumulate
   in the bucket with no reaper. Inherited, not introduced.
5. **`GenerateRequest.template_asset_id` is still typed `UUID`** while a library `asset_id` is
   a Storage path — piece 1's finding 1, unchanged. A template attached through this new door
   therefore still cannot be fed to the NL-generate route's placeholder grounding; it 422s at
   FastAPI's validation. Different route, different requirement, wire-contract change.
6. **The run-time upload box is still there**, as instructed. That is piece 3.
7. **`WorkflowBuilderPage.tsx` has a pre-existing `react-refresh/only-export-components` lint
   error at `:254`** (it exports types beside a component). Not introduced here, not fixed.

## Scope check

Two new files, four modified, one gate pin. No characterization baselines, no vocabulary
module, no sketch, no generator. `STATE.md`, `ROADMAP.md` and `REQUIREMENTS.md` were not
touched and no `gsd-sdk state.*` verb or `requirements.mark-complete` was called. Only my own
files were staged, by explicit path — the ~404 pre-existing dirty/untracked files and the
pre-existing stash entry were not touched.

## Self-Check: PASSED

- `frontend/src/components/workflows/TemplateAttachSection.tsx` — FOUND
- `frontend/src/components/workflows/TemplateAttachSection.test.tsx` — FOUND, 25 passed
- commit `000539a3` — FOUND in `git log`; no file deletions in the commit
- count gate re-run after the final edit: `count gate OK — 68/68 pinned files present, no
  per-file decrease, 0 failing`
