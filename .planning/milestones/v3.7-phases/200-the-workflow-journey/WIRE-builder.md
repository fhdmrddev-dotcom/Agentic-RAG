# WIRE-builder — the four builder surfaces' FE-WIRING rows

Source of the worklist: `AUDIT-panel-canvas-spine.md`, every row bucketed **FE-WIRING** across
`step-panel.html` (4) · `builder-canvas.html` (3) · `node-identity.html` (1) ·
`builder-spine.html` (7). **Fifteen rows, all fifteen enumerated below.**

Reference for how it should look: the four `.planning/sketches/200-journey-interactive/screens/*.html`
sheets. `200-CHECKLIST.md` and `index.html`'s `JOURNEY` array were **not** consulted.

**Tally — DONE 8 · BLOCKED 2 · NOT TAKEN 5.**

---

## The fifteen rows

### `step-panel.html` — 4 rows

| # | Row | Verdict |
|---|---|---|
| 1 | Dimmed workflow canvas behind the open panel (`opacity-60 pointer-events-none`) | **NOT TAKEN** |
| 2 | `+ Add a source` dashed button | **BLOCKED** |
| 3 | Checklist row `Choose a model ›` | **NOT TAKEN** |
| 4 | Checklist row `Connect a knowledge source ›` | **BLOCKED** |

**1 — NOT TAKEN.** Both halves of the sheet's treatment fail, for *different* reasons, and both
were measured against the live grid rather than reasoned about:

- `pointer-events-none` **strands the author.** `panelOpen === (selectedSlug !== null)`
  (`WorkflowBuilderPage.tsx`), so the panel is open exactly while a step is selected, and the
  graph track is the **only** way to select a different one. Inerting it turns every
  step-to-step move into close-then-reopen and leaves `Escape` / `✕` as the sole exit.
- `opacity-60` **mutes the anchor the panel is anchored to** — the selected node's highlight
  lives inside the track that would be faded, and it would stay faded for the whole authoring
  session, because selecting a step is what opens the panel.

It is a **mockup focus device**, which is a real class on this sheet rather than an excuse: the
audit's own next row records a second divergence in the same layout (the sheet draws an open
400px panel *and* the 44px collapsed strip at once, which in the product is one grid track and
therefore unreachable). **Refusal + a dated re-open trigger are recorded in writing at the grid
itself** — `frontend/src/pages/WorkflowBuilderPage.tsx`, immediately above `data-testid="builder-grid"`.
Re-open trigger: *a step panel that becomes MODAL*, at which point the dim becomes a statement
rather than a suggestion.

**2 — BLOCKED (backend).** The panel's write seam exists, but `folder_scope` is still a
read-only display there (no `set("folder_scope")` anywhere in `PhaseFormPanel.tsx`) **and** the
write it would need is still refused upstream: `WorkflowDefinition._folder_scope_requires_project`
(`backend/app/models/harness.py:584-595`) raises when a phase declares `folder_scope` on a
workflow with no `project_folder_id`, which under D-186-04 leaves a permanently unsaveable
draft. Re-verified against the live tree, not inherited. **Out of scope per rule 2.**

**3 — NOT TAKEN, refusal re-measured and upheld.** `stepReadinessContext.ts` refuses this row
because a blank `model` is the shipped, documented, correct state. **Checked rather than
assumed:** the panel does not merely tolerate a blank — it renders it as a *named leading
option* reading `Use the run's model (gpt-5.4)`, pinned by `PhaseFormPanel.test.tsx`'s case
*"A BLANK stored model — the case 239 of 257 real phases are in"*. A checklist row would accuse
the author of omitting something the control beside it presents as a deliberate choice, on 93%
of the phases that exist. **The re-check is written into the refusal** (`stepReadinessContext.ts`,
dated 2026-08-20).

**4 — BLOCKED (backend, via row 2).** The refusal's recorded reason — *"a checklist row for a
thing the surface refuses to let you fix is a dead end wearing a chevron"* — is still literally
true, because row 2 is still blocked. **Re-open trigger written into the refusal:** the phase
that gives the panel a `folder_scope` write seam *and* resolves the 422.

---

### `builder-canvas.html` — 3 rows

| # | Row | Verdict |
|---|---|---|
| 5 | Connector node subtitle naming the destination | **DONE** |
| 6 | Zoom readout `100%` | **DONE** |
| 7 | `Lock canvas` control | **NOT TAKEN** |

**5 — DONE.** One shared seam, serving both graph views (row 13 is the same fix):

- `NameContext` gains `connectionNames?: Readonly<Record<string, string>>` and
  `DerivedFaceInputs` gains `connectionName?: string` (`phaseVocabulary.ts`).
- `derivedFaceOf` resolves `config.connection_id` through that map — **like `skill_ref`, not
  like `capability`**: a miss yields `undefined` and **never** the raw id.
- `derivedFace` tier (4) appends the destination through a new **joiner** map
  (`EXTERNAL_CAPABILITY_DESTINATION_JOINERS` — `to` / `in` / `via`), so the **verb keeps exactly
  one home** and a re-worded capability changes in one place. A parallel sentence map would have
  been a second spelling of all three verbs, free to drift from the capability *picker*, which
  reads the same map for its option labels under UI-SPEC §7b.
- `WorkflowBuilderPage.tsx` fetches `listConnectorConnections()` in the existing mount effect —
  **its own `try`**, deliberately: this route is the only one of the three that can refuse for a
  reason unrelated to the author (`no_encryption_key`), and a shared `catch` would let a
  connectors refusal swallow the already-resolved skill map.

**Three independent conditions must all hold or the shipped destination-free sentence renders
byte for byte:** a resolved name, non-blank after trimming, and a capability owning a joiner. So
a mount with no map, an unbound or dangling `connection_id`, a connection named `"   "`, and an
unknown capability all render today's string. **Both map reads are own-property guarded** (WR-04
— two doors now instead of one). **Names only:** nothing from `ConnectorConnection.config`
is read, so no host, port or credential reaches the canvas (CONN-03 SC#4 unchanged).

⚠ **Where it appears, stated plainly:** the destination lands on the **derived** face — i.e. on a
step with no author-given name — because that is where the capability sentence has always lived
(`derivedFace` tier 4, which the audit's own evidence cell names as the site). An author's own
name still wins, per D-187-04 most-specific-first. **Overriding an author's name with a derived
sentence would be a regression, not this row.**

**6 — DONE, and it required OVERRIDING a recorded refusal — the override is written into the
pin.** `WorkflowCanvas.test.tsx` carried
`it("shows NO zoom percentage — the sheet's '85%' has no shipped home")`, from `199-05-SUMMARY.md` §3.
**Both halves of that refusal are spent, for different reasons:**

1. **The scope half expired on its own terms.** 199-05 refuses it *"as out of scope"* for a plan
   whose fence forbade new user-facing capability, and names its own re-open trigger: *"the first
   phase whose scope includes canvas view controls as a feature."* Phase 200's canvas port is
   that phase and this row is on its sheet. **Honoured, not overridden.**
2. **The factual half is REFUTED BY MEASUREMENT.** The same summary calls it *"the one control in
   the sheet's cluster with no shipped counterpart."* `useViewport()` is a shipped, reactive read
   of exactly this number, and the plane already clamps it (`minZoom={0.3} maxZoom={2}`). **The
   counterpart existed the whole time.** The old sentence is preserved verbatim inside the pin
   rather than corrected in place.

Built as a leaf (`CanvasZoomReadout.tsx`) so the G-5 hot file gains one JSX child and **no new
hook**. `useViewport`, not `getZoom()` — a snapshot taken at render goes stale on the next wheel
event. The pin is **inverted, not weakened**: presence is now asserted (plus the leaf's own
element and a negative control), so the readout cannot *leave* without a diff, which is the same
guard at the same strength.

⚠ Deviation recorded in source: the sheet puts `100%` **between** `−` and `+`; `<Controls>`
renders children **after** its own buttons, and interleaving means hand-rebuilding the cluster —
trading a real dependency on the library's zoom handlers for a pixel match.

**7 — NOT TAKEN. The narrowing was BUILT, MEASURED and WITHDRAWN, and the whole account is
recorded at the control.** The obvious read is a one-word prop flip (`showInteractive`). The
narrowing tried was `showInteractive={editable}` — read-only keeps `false`, so every word of the
shipped reason (*"two clicks from a shipped read-only canvas to a draggable, connectable one"*)
still holds, while the editable Builder plane gains a control whose only transition is
editable → LOCKED and which therefore cannot *grant* a capability.

⚠ **It was withdrawn on a measured fact, and it is exactly what the audit flagged as *"the
sheet's separate lock semantics would need a decision"*:** xyflow's handler sets
`nodesDraggable`, `nodesConnectable` **and `elementsSelectable`** — all three. The third is not a
layout concern. On this surface **selecting a node is what opens the step panel**, so the
library's "lock" would also remove the author's ability to *inspect* a step. The sheet's padlock
protects an arrangement; this one would additionally make the workflow unreadable while engaged
— a different control wearing the same glyph. Deciding what a locked canvas should still permit
is a product decision, not a wiring one.

⚠ It also went red against a live source fence (`expect(workflowCanvasSource).toContain("showInteractive={false}")`).
**That fence was NOT re-baselined** — reverting was the correct answer, not moving the pin.
**Re-open trigger** (recorded at `WorkflowCanvas.tsx`): a phase that scopes canvas view controls
as a feature. The likely shape is a lock that suppresses drag and connect while **leaving
selection alive** — which is not `showInteractive` at all, but the three underlying props set
independently. That is a build, and it is why this is not one.

---

### `node-identity.html` — 1 row

| # | Row | Verdict |
|---|---|---|
| 8 | Run state — the `00:15` elapsed on the running node | **DONE (seam complete) — one supply line owed in a sibling-owned file** |

The card slot the audit named (*"`PhaseNodeCard` has no such slot"*) is built, and the full
thread with it:

- `phaseNodeCardContract.ts` → `elapsed?: string | null`
- `PhaseNodeCard.tsx` → renders it, **gated on `reading !== null` AND a non-empty string**
- `runVocabulary.ts` → `NodeRunState.elapsed`
- `PhaseNode.tsx` → passes `run?.elapsed` through untouched

**A string, not a timestamp** — the page words it, exactly as `label` and `noun` already are, so
the card never becomes a second clock beside the run band above it. **Absent ⇒ no element at
all** — never `00:00`, never a dash. **Run tense, unreachable from the Builder by construction:**
it rides `NodeRunState`, and an authoring canvas supplies no `runState` at all, so `199-02`'s
refusal now holds by shape rather than by care.

⚠ **NOT OVERCLAIMED — what is owed and where.** The one remaining line is the join in
`runStateBySlug` inside **`frontend/src/pages/WorkflowRunPage.tsx`** (`started_at` →
`fmtElapsed` → `elapsed`). **That file is sibling-owned under rule 9 and was not edited.**
Nothing renders `00:15` on screen until that line lands. Everything it needs is in place and
`phaseDuration.ts` already formats it for the spine.

⚠ One incidental find worth keeping: my first draft of the contract docblock said *"a card that
did its own `Date.now()` arithmetic…"* and turned the card-subtree scope fence RED — a `?raw`
source regex cannot tell a mention in a comment from a live call. **The fence was right and the
comment was reworded**, not the fence re-baselined. This is `196-08`'s trap, hit once more,
inside the comment written to explain the rule.

---

### `builder-spine.html` — 7 rows

| # | Row | Verdict |
|---|---|---|
| 9 | Detail label `WHAT IT IS TOLD TO DO` + the prompt inline | **DONE** |
| 10 | Detail label `HOW LITERAL IT SHOULD BE` + `Very literal` | **DONE** |
| 11 | Left-lane target title — the skip row's raw slug | **DONE** |
| 12 | Step 4 `Approve` / `Send back` buttons | **NOT TAKEN** |
| 13 | Connector subtitles naming the destination | **DONE** |
| 14 | Badge `CHANGES SOMETHING OUTSIDE` on a spine row | **DONE** |
| 15 | `＋ Add Step` dashed pill at the foot of the spine | **NOT TAKEN** |

**9 + 10 — DONE.** New leaf `spineDetailVocabulary.ts` (the one-string-home rule; a true leaf,
zero imports) carrying the two labels and `literalReading()`. Rendered **only on the selected
row**, under the sheet's dashed divider — the sheet draws it on one card of eight, and a prompt
on every row would turn a spine into eight paragraphs and destroy the scan the component is for.

**It is AUTHORING tense, not run tense**, which is why it needs no run prop: both values are
what the author wrote, read back to them. A prompt is true of the draft; a duration is not.

⚠ **The worded scale is a vocabulary over a real number, never a fabricated value.** The bands
are anchored to the shipped field's own hint (`temperature — 0 is focused and repeatable, higher
is more varied`), so the scale runs the same direction the control the author just used
describes. **An absent temperature renders NOTHING — never a default band.** **A declared `0`
renders**, which is why the test is `typeof === "number"` and never `if (temperature)`. Each
line is independently absent-able and the block itself does not render when both are: a step
with no prompt gets **no** prompt line, because the readiness checklist is the surface licensed
to say a prompt is *missing*, and a labelled empty line says it twice in a weaker voice.

**11 — DONE, and one pin re-baselined with the reason inside it.** The spine printed
`<span className="font-mono">{edge.toSlug}</span>` — a schema token, in a mono face, at a
non-technical author — while the canvas has resolved the identical target to a NAME since 187.
Now resolved through the same `nodeTitle` + the page's `nameContext`.

- **The slug is the fallback and it is not a fabrication.** `nodeTitle` is total but its floor is
  `PHASE_TYPE_SENTENCES[type] ?? type`, i.e. the **empty string** for a phase with no name, no
  derivable face and an unrecognised type — `on fail → skip to ` says less than the slug does.
  An empty resolution therefore keeps today's behaviour rather than degrading past it.
- **The mono face is kept for the fallback and dropped for a resolved name** — a mono face is how
  this tree marks a machine identifier; painting a person's own words in it would say *"this is a
  token"* about a sentence they wrote.
- `data-target-slug` is untouched, so the machine-readable target and its own assertion are unmoved.
- A `Map`, not an object literal: slugs are author-supplied JSONB and a slug spelled
  `constructor` is a WR-04 prototype sink on a plain object.

**Two pins moved in `PhaseSpineGraph.test.tsx`, both with the old wording quoted inside them:**
the `nameContext)` / `nodeTitle(` counts `1 → 2`, and the skip-edge text
`"⤳on fail → skip to human-confirm"` → `"⤳on fail → skip to Confirm"`. **Neither is a
loosening.** The count pin still guards the property it was written for — the context reaches
`nodeTitle` **and nothing else** — and both calls are now **named** in the assertions, so a bare
`toBe(2)` cannot silently absorb a different second consumer. The text pin still guards *"the
branch reads as WORDS, never as line-style alone"*, and its non-vacuity check is untouched.

**12 — NOT TAKEN.** The answer seam ships end to end (`api.ts` `answerAskUser`, driven by
`PendingAskCard.tsx`) and the author-side choices are authored in `PhaseFormPanel`. But this
component reads a **draft** definition: no run, therefore no `tool_call_id`, therefore nothing
for either button to send. They would be controls that cannot act, on the surface whose whole
promise is that what it shows is true of the workflow in front of you. **The same class of sheet
defect `199-02` caught.** The honest mount is the RUN spine (`runTense`). Recorded in the
component's own header docblock so the next reader of the sheet does not re-derive it as an
omission.

**13 — DONE.** Same shared seam as row 5 — the spine receives the same page-owned `nameContext`,
so both graph views resolve one destination through one resolver and **cannot now disagree**.

**14 — DONE.** `effectBannerFor` had exactly **two** consumers before this, both in
`PhaseNodeCard.tsx`; the spine imported it nowhere, so the same `external_action` step wore
`CHANGES SOMETHING OUTSIDE` on the canvas and **nothing at all** one toggle away. Fixed by an
**import**, never a second predicate — a re-spelled banner would agree with the canvas only
until one of them was edited.

⚠ **The banner takes the type chip's slot rather than sitting beside it**, which is the sheet's
own composition (`builder-spine.html:420-427` draws its connector rows with the warning chip and
no type chip) and is right for a reason the sheet does not state: `PHASE_TYPE_LABELS.external_action`
reads `External action`, so the two chips side by side would spell one fact twice, in the same
10px face, on the same line. **Nothing is lost to a screen reader** — the node's `aria-label`
carries the type word unconditionally, and `data-phase-type` still carries the raw id.

⚠ Its `ONLY READS` sibling stays **DECLINED** and is *not* one of my rows (the audit buckets it
BE-NEEDED): every capability this client recognises is a write. The decline and its dated
re-open trigger already live in `nodeEffectBanner.ts`.

**15 — NOT TAKEN.** The insert seam does ship on the canvas (`PlaneEditingLayer.tsx`
`data-testid="canvas-insert-N"` → `StepTypePicker`), so this is a mount decision. It is declined
because mounting it re-opens the component's locked read-only contract — and that contract is
**not documentation, it is mechanically enforced** by this component's own REQ-4 acceptance-c
case (*"STATIC drag-free DOM: … no add-node control"*, which scans every button label and every
`[data-add-node]`). Re-opening it is a phase's decision to take with that fence deliberately
re-baselined; it is not an FE-wiring pass's. Recorded in the component's header docblock.

---

## Backend gaps hit (rule 2 — reported, not built)

Only ones I actually ran into. All three of the audit's other BE-NEEDED families (the branch
model, external-action capabilities / `ONLY READS`, one-template-per-step, the absent judge step
kind) were never approached.

| Gap | Evidence | Blocks |
|---|---|---|
| `folder_scope` cannot be written from the panel on a workflow with no `project_folder_id` | `WorkflowDefinition._folder_scope_requires_project`, `backend/app/models/harness.py:584-595` — raises, and under D-186-04 leaves a permanently unsaveable draft | rows **2** and **4** |

---

## Notes for the orchestrator / siblings

1. ⚠ **One supply line is owed in a sibling-owned file.** `frontend/src/pages/WorkflowRunPage.tsx`,
   in the `runStateBySlug` memo: join `started_at` (already on the wire) through `fmtElapsed` and
   set `elapsed` on the `NodeRunState`. Everything downstream is built and typechecked. Until
   that lands, row 8's atom does not appear on screen.
2. ⚠ **A REAL mock-completeness defect was found and fixed — it was NOT flake.**
   `WorkflowBuilderPage.canvas.test.tsx` (a named SEED-171 suite) failed once. Per the standing
   procedure the filename was captured **before** any re-run and checked against
   `git diff --numstat`; the cap was **never touched**. The cause was genuine: **all six**
   `WorkflowBuilderPage*` suites mock `@/lib/api` with a whole-module factory and none declared
   `listConnectorConnections`, which the page's mount effect now reaches — the exact `196-08`
   failure mode. The symbol is declared in all six as `() => Promise.resolve([])`, which is the
   **shipped absence** (destination-free sentences), so no assertion moved. It then passed first
   try, and the full workflows tree passed 71/71.
3. **Untouched as instructed:** `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`,
   `scripts/vitest-count-gate.cjs`, `WorkflowRunPage.tsx`, `WorkspacePanel.tsx`, and every
   library / publish / dialog file.
4. **Ledger note for whoever batches the hot-file rows** (I did not edit the ledger):
   `PhaseSpineGraph.tsx` `+212/−6`, `WorkflowCanvas.tsx` `+47/−2`, `phaseVocabulary.ts` `+98/−1`,
   `WorkflowBuilderPage.tsx` `+72/−3` — and **three NEW leaves** with no ledger row:
   `spineDetailVocabulary.ts`, `CanvasZoomReadout.tsx`, plus the existing `nodeEffectBanner.ts`
   which gained its **third** consumer (its two-consumer count is now stale wherever it is quoted).

---

## Verification

- `npx tsc -p tsconfig.app.json --noEmit` → **33 errors, all pre-existing across 19 other files.
  Zero in any file I touched.** (33 is exactly the stated baseline.)
- `GSD_VITEST_MAX_WORKERS=2 npx vitest run src/components/workflows src/pages/WorkflowRunPage.test.tsx`
  → **71 files passed · 4115 tests passed · 0 failed.**
- All six `WorkflowBuilderPage*` suites → **passed.**
- `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (verbatim verdict line):
  `count gate OK — 102/102 pinned files present, no per-file decrease, 0 failing.`
  `total 5229 · failed 0 · pinned total 4824`
- ⚠ The cap stayed at `2` throughout and was never adjusted.
