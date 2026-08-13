# Phase 193: Authoring Doors + Template Placement - Context

**Gathered:** 2026-08-13
**Status:** Ready for planning

<domain>
## Phase Boundary

**A user can tell the two authoring doors apart before choosing, and can find where to supply a
template.** Two requirements: **AUTH-01** (door legibility) and **AUTH-03** (template placement and
discoverability — the capability itself shipped in Phase 152 as WFIN-01; **this is NOT a rebuild**).

**The phase is naming, placement and one structural demotion.** It ships no new authoring capability,
no third door, and no new upload path.

**ROADMAP success criteria (what must be TRUE):**

1. A person who has not seen the Builder can predict what each door does before clicking.
2. The number of perceived choices does not increase (the 187 template-door lesson — seed the
   existing path, do not add a third).
3. A user with a template to fill can find where to supply it.

**Explicitly out of scope:** deepening the fast door (that is AUTH-02 / Phase 197, which depends on
this phase), any third door, any change to the upload/storage path itself, and the canvas theming
bug (see `<deferred>`).
</domain>

<decisions>
## Implementation Decisions

### Door copy — LOCKED BEFORE THE DISCUSSION (operator, 2026-08-13)

These two were decided at the G-2 sketch gate and are recorded in
`.planning/sketches/164-telling-the-doors-apart/README.md` (frontmatter `winner:`) and the sketch
MANIFEST. They are **inputs to this phase, not open questions.**

- **D-01: The door wording is VARIANT D — "the mix."** B's door NAMES with C's two uppercase TIER
  labels. Everything else in D is variant B verbatim.

  ```
  you write one paragraph           you decide every setting
  Draft it for me                   Build it myself
                ‹ Change how I start
  ```

  *Rationale:* B's names answer **who does the work**, which is the question SEED-147's operator
  actually had. C's tiers state **what it costs you** where B's state a benefit — and benefits are
  what made the shipped wording vague in the first place.

- **D-02: Variant D is DERIVED, never re-typed.** `build.cjs` defines `D_FROM_C = {doorA.tier,
  doorB.tier}` and reads B for every other id. The regenerated substitution audit reports **D: 18
  matched, 0 missed** against the real `WorkflowDoorSwitch` DOM (55 across B/C/D). **The planner
  must port column D of the contract's COPY table, not re-transcribe strings from this file.**

- **D-03: The header-strip restack is IN SCOPE.** It is the half of SEED-147 suspect #2 that copy
  provably cannot reach. ⚠ **The sketch draws NO mockup of it** — the acceptance bar for the restack
  is D-04/D-05/D-06 below, not the sketch page.

### The header strip

- **D-04: The demotion is "quiet escape + divider."** The return control stays in the strip but
  drops its border/box, becomes plain muted text, and gains a divider between it and the door label.
  The `🔒 judge always-on` badge **keeps its far-edge position, unchanged**.

  ```
  ‹ back  │  🔧 Author & govern            [🔒 judge always-on]
  └─ no border, muted   └─ current door, primary   └─ far edge, unchanged
  ```

  *Rationale:* today the three render as visual peers (`‹ both doors` + door label + judge badge),
  which is precisely the "other one" the operator could not name. Breaking the peer reading is the
  whole fix; moving the badge is not needed and would spend change budget on the one element that
  is already correctly positioned.

- **D-05: One component serves BOTH header variants.** The strip renders twice today — as its own
  bordered band (standalone) and as `headerTrail` inside the Builder's merged header row when
  `inline` is true (D-184.1). The extracted component serves both so they cannot drift.
  ⚠ **Care required with the `ml-auto` class that is already conditional on `inline`** — in the
  standalone band it is what pushes the judge badge to the far edge; inside the merged row's
  already-right-aligned trailing group it would open a gap. The shipped concatenation exists so the
  non-inline class list is character-for-character what shipped; preserve that property.

- **D-06: Rejected — moving the return control into `headerLead`.** It reads cleanest (two items in
  the strip, not three) but `headerLead` renders **only when `inline` is true**, so the standalone
  band would lose its return control entirely unless rebuilt. An author with no way back is a worse
  defect than a busy strip (the 184.1 reasoning, still binding).

### G-5 — the guardrail this phase fired, and how it is honoured

- **D-07: ⚠ G-5 FIRES on `WorkflowDoorSwitch.tsx`, and the file is ABSENT from the CLAUDE.md
  hot-file ledger.** Measured at discuss-time, not inherited:

  | | |
  |---|---|
  | commits | **8** |
  | phases | **6** — 124, 155, 184, 184.1, 186, 187 |
  | lines | **385** |

  Re-derive with `git log --oneline -- frontend/src/components/workflows/WorkflowDoorSwitch.tsx |
  wc -l` and `git log --format=%s -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' | sed -E
  's/-.*//' | sort -u`. **Six prior phases against a threshold of three.** This is the same failure
  as `WorkflowsPage.tsx` escaping G-5 for ten consecutive phases: the audit step scans PLAN.md
  `files_modified` *against the ledger table*, so a hot file absent from the table is permanently
  invisible to its own guardrail. **Phase 193 owes a ledger row for this file at close.**

- **D-08: G-5 is honoured BY CONSTRUCTION, in the 192.1 order — the extraction ships FIRST, in its
  own wave.**

  | Wave | Content |
  |---|---|
  | **1** | **Pure move, zero text changed.** 20 COPY strings → `doorVocabulary.ts`; the header strip → `DoorHeaderStrip.tsx`. Characterization baselines captured on the **UNMOVED** tree BEFORE the move. |
  | **2+** | Variant D's copy applied to the vocabulary module; the D-04 restack applied to the extracted strip component. |

  *Rationale:* the sketch's own build contract **already requires** porting the COPY table into a
  vocabulary module rather than re-typing strings into JSX — so the extraction the guardrail wants
  and the refactor the contract wants are the same act. ⚠ **A baseline only proves something if it
  PREDATES the change** (the 188.1 lesson): extracting and rewording in one commit would leave the
  move unprovable, which is why the wave split is load-bearing rather than cosmetic.

- **D-09: Rejected — a G-5 override.** Editing `WorkflowDoorSwitch.tsx` in place and logging a
  waiver under `STATE.md → Guardrail overrides` was offered and declined. No override is recorded
  for this phase.

### Where the copy lives

- **D-10: The module is `frontend/src/components/workflows/doorVocabulary.ts`.** Beside its only
  consumer, mirroring the shipped `library/libraryVocabulary.ts` naming. **Deliberately NOT under
  `library/`** — the doors are an authoring surface, not a library one, and `library/` carries the
  192 fences (nothing under it may name a `WorkflowsPage` specifier, F4). Putting authoring copy
  there would muddy a boundary Phase 192 spent a whole phase drawing.

- **D-11: ALL 20 COPY ids move into the module** — both door cards, the chooser heading and sub, the
  strip labels, the describe-door `h1` and CTA, the three hint fragments, the switch strip, and the
  soul label. Including the 2 ids variant D inherits unchanged.
  *Rationale:* the contract's audit is defined over the whole table. Porting a subset means the
  module and the contract describe different things, and the next reader cannot tell which strings
  are governed. A vocabulary module with two homes is not a single source of truth.

- **D-12: The describe-hint stays THREE NAMED FRAGMENTS composed in JSX.** The module exports
  `frag1/frag2/frag3` as plain strings; the component composes the sentence and owns the `<b>`
  markup. Matches the contract's worked examples exactly, keeps markup out of the data, and needs no
  parser. Rejected: one template string with `{1}`/`{2}`/`{3}` markers.

### AUTH-03 — the card mark

- **D-13: The mark is a PLAIN TEXT SEGMENT in the card's identity line** — muted, separated by the
  same `·` the line already uses. **No chip, no badge, no new colour, no new component.**

  ```
  Yours · needs a template · changed 2 months ago
  ```

  *Rationale, and it is a hard constraint rather than taste:* the card **structurally forbids a
  third badge** — an `@ts-expect-error` control pins it, observed RED at 34 type errors and back at
  33 (188.2). And **SEED-155 exists precisely because sketch 163 drew a chip treatment the card
  could not render** (UAT U8). A bordered chip here would repeat U8 exactly. An icon-only mark was
  also rejected: an unlabelled glyph is the same discoverability failure AUTH-03 exists to fix.

- **D-14: Slot — after provenance, before recency.** Reads as *whose it is · what it needs · when it
  changed*. Recency stays last, where 192.1 put it. ⚠ **Do NOT place it first**: 192.1 asserts the
  provenance node at **DOM position 2 by child order**, and the point of asserting by child order
  was that it does not move.

- **D-15: When the wire does not say, render NOTHING — silence, never a guess.**

  | `definition` | Renders |
  |---|---|
  | present, admits `render_template` | `· needs a template` |
  | present, does not admit it | *(nothing)* |
  | absent / null / unparseable | *(nothing)* |

  The last two are **deliberately indistinguishable**. Same rule the shipped `updated_at` field
  already follows: `undefined` means *"the wire did not say"*, and the honest rendering of that is
  no segment — never a fabricated claim. **Absence of the mark must never be readable as an
  assertion that no template is needed.** Rejected: adding a `console.warn` on absence (fires once
  per row against an older backend; the wire-shape question belongs in a test, not runtime logging).

- **D-16: ⚠ AUTH-03 needs NO backend change — measured, not assumed.** `definition` is **already
  projected on the wire** for published workflows:
  `SELECT id, slug, name, definition, created_by, is_system_global, updated_at FROM
  workflow_definitions` (`backend/app/db/workflows.py`), and `PublishedWorkflow` declares
  `definition?: WorkflowDefinitionJSON | null` (`frontend/src/lib/api.ts:1368`). The card already
  derives its strictness tier from the same field (Phase 103-06). **This is the OPPOSITE of Phase
  192's D-04 surprise** — 192 was believed frontend-only and was not. Verified before planning so
  the planner does not re-open it.

### AUTH-03 — the Run modal

- **D-17: For a workflow that does NOT fill a template, render NOTHING.** Not greyed, not disabled —
  **absent**. Today the upload renders on **every** workflow, quiet and unlabelled, so ~100 rows
  carry a control they cannot use. *Nothing is lost:* handing a template to a workflow with no fill
  phase never did anything. A disabled control still costs attention and still cannot be used.
  Rejected: a disclosure/"Advanced" toggle (same problem one click deeper, and it **adds** a
  perceived choice where SC#2 asks for fewer).

- **D-18: The control gains the label `Template to fill`.** It turns a nameless quiet button into a
  named, expected input — the naming half of AUTH-03.

- **D-19: The provenance line stays VERBATIM and moves with the control.**
  `Stored untrusted — never run as code, never fed to the fill engine.`
  This is Phase 152's threat-modelled SSTI honesty — a `template_input` file is **never** routed to
  the Jinja engine — and the build contract marks it `SHIPPED · keep verbatim`. Where the control is
  hidden there is no upload to describe, so the line goes with it. **Rewording it to read better
  under the new label was offered and REJECTED**: rewording a security claim to improve its cadence
  is how such claims quietly weaken. Worth a fence so a future edit cannot re-word it.

- **D-20: ⚠ THE MODAL'S UNKNOWN-FALLBACK IS THE OPPOSITE OF THE CARD'S, AND THE ASYMMETRY IS
  DELIBERATE.**

  | `definition` | Card (D-15) | Run modal (D-20) |
  |---|---|---|
  | admits `render_template` | `· needs a template` | labelled control |
  | **positively** does not | *(nothing)* | *(nothing)* |
  | **unknown / absent / null** | *(nothing)* | **the control, exactly as today** |

  *Rationale:* on the card, silence costs nothing — a missing mark is a quiet row. In the Run modal,
  hiding on unknown **removes a shipped capability (WFIN-01)** from a user who may genuinely need
  it, with no way to discover it existed. So the modal hides only on a **positive** reading that the
  workflow does not fill a template. A backend hiccup or a frontend deployed ahead of the backend
  must not silently strip the feature. **This asymmetry is a decision, not an oversight — do not
  "fix" it into consistency.**

### Claude's Discretion

- The exact Tailwind classes for the demoted return control and the divider (D-04), within the
  shipped token vocabulary. The sketch does not draw the restack, so pixel choices are a human
  comparison at UAT.
- The internal shape of `doorVocabulary.ts` (nested object vs flat keys), provided all 20 ids from
  the contract's column D are present and the hint fragments stay separate strings (D-12).
- Whether `DoorHeaderStrip.tsx` also absorbs the door-label `<span>` or only the return control and
  badge — the constraint is D-05 (one component, both variants), not a specific boundary.
- Test-file placement and naming, following the shipped `WorkflowDoorSwitch.test.tsx` convention.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The acceptance bar (G-2 gate — read FIRST)
- `.planning/sketches/164-telling-the-doors-apart/BUILD-CONTRACT.generated.md` — **the COPY table is
  the spec.** Column **D · THE PICK** is what ships; A/B/C are the comparison that produced it, not
  live options. Also carries the AUTH-03 template-proposal rows (`card.templateMark`,
  `run.templateLabel`, `run.templateAbsent`, `run.provenance`) and the substitution audit.
- `.planning/sketches/164-telling-the-doors-apart/README.md` — the mechanism (generated FROM the
  build), the operator's decision section, and the three measured corrections to SEED-147.
- `.planning/sketches/164-telling-the-doors-apart/index.html` — the rendered comparison; tab
  **D · THE PICK**. ⚠ The doors panel is the **real** component's DOM; the **template panel is a
  PROPOSAL** (nodes no component has yet) and carries normal sketch-drift risk.
- `.planning/sketches/164-telling-the-doors-apart/build.cjs` — `D_FROM_C` is the derivation; re-run
  `node build.cjs && node assemble.cjs` if the COPY table changes.

### Requirements and provenance
- `.planning/REQUIREMENTS.md` — AUTH-01, AUTH-03 (and the explicit note that AUTH-03 is placement,
  not a rebuild).
- `.planning/ROADMAP.md` §"Phase 193" — goal, the three success criteria, the G-2 flag.
- `.planning/seeds/SEED-147-authoring-doors-not-legible.md` — the origin observation. ⚠ **Suspect #3
  ("nothing states the consequence") was MEASURED FALSE by sketch 164** — each card already carries
  an icon, tier label, consequence sentence and footnote. Read the sketch README's corrections
  before trusting the seed's three suspects.
- `.planning/seeds/SEED-110-run-time-template-upload.md` — **CLOSED/SHIPPED** as WFIN-01 in Phase
  152. Confirms the upload path exists and must not be rebuilt.
- `.planning/seeds/SEED-155-*.md` — why a drawn-but-unrenderable atom is the failure mode this phase
  must avoid (the U8 lesson behind D-13).

### The code this phase touches
- `frontend/src/components/workflows/WorkflowDoorSwitch.tsx` (385 L) — both doors, the chooser, the
  header strip, and the `inline` variant. **G-5 fires here (D-07).**
- `frontend/src/components/workflows/WorkflowDoorSwitch.test.tsx` — the shipped suite to extend.
- `frontend/src/components/workflows/library/RunModal.tsx` (430 L) — the template upload control
  (`data-testid="run-template-upload"`), its `aria-label`, and the provenance line.
- `frontend/src/components/workflows/library/WorkflowCard.tsx` (747 L) — the identity line the mark
  joins. See the CLAUDE.md ledger row for its invariants.
- `frontend/src/components/workflows/library/libraryVocabulary.ts` — **the naming and shape
  precedent** for `doorVocabulary.ts`.
- `frontend/src/lib/api.ts:1364-1386` — `PublishedWorkflow`, including `definition` and the
  `updated_at` honesty rule that D-15 mirrors.
- `backend/app/db/workflows.py` — the SELECT list proving `definition` is on the wire (D-16).
- `backend/app/services/harness/phase_types.py` — **the authority** for `render_template` admission.
  ⚠ **Re-derive the definition-side field name at plan time** rather than trusting any prose,
  including this file's.

### Project rules that bind this phase
- `CLAUDE.md` §"Workflow guardrails" — G-2 (satisfied), **G-5 (fires — see D-07/D-08)**, G-4
  (lived-experience UAT rows are owed), G-3.
- `CLAUDE.md` §"Hot-file ledger" — `WorkflowCard.tsx` row. ⚠ **Stale again**: reads
  `6 commits / 721 L`, measured **7 / 747**. 193 makes it the card's **3rd phase**, arming G-5 for
  the phase after this one.
- `CLAUDE.md` §"UAT scoreboard recipe" — this phase touches UI state but not streaming, the agent
  loop, or provider routing; the 4-axis cross-provider board is **not** triggered. G-4 rows are.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`library/libraryVocabulary.ts`** — the shipped vocabulary-module precedent (naming, export
  shape, how a component consumes it). `doorVocabulary.ts` mirrors it (D-10).
- **`WorkflowDoorSwitch.tsx`'s `doorGroup` fragment** — the strip already exists as a single JSX
  fragment reused across the standalone band and the inline `headerTrail`. **The extraction seam is
  already drawn**; D-05 turns that fragment into a component rather than inventing a boundary.
- **The card's identity line (192.1)** — `rowIdentity.ts`, `relativeChanged.ts` and the
  `data-testid="row-identity"` node. The mark joins an existing composed line (D-13/D-14); no new
  layout.
- **`RunModal.tsx`'s existing upload block** — control, `aria-label="Upload template file"`,
  `data-testid="run-template-upload"`, submitting state and provenance line all ship. AUTH-03 adds
  a label and a render condition around them; it changes no upload logic.
- **The published-list `definition` payload** — already consumed by `deriveTier` since 103-06. The
  template signal reuses a field the card is already reading (D-16).

### Established Patterns
- **Wire-absence honesty** — `updated_at`'s rule (`undefined` = "the wire did not say" → render
  nothing, never fabricate). D-15 applies it verbatim; D-20 deliberately inverts it for a stated
  reason.
- **Verbatim-move + characterization baseline** — 188.2 and 192.1 both proved a pure extraction by
  capturing baselines on the unmoved tree first. Wave 1 (D-08) follows that shape.
- **Assert by child order, never by class name** — 192.1's `row-identity` rule. The mark's position
  (D-14) must be asserted the same way.
- **Negative source fences** — the 192 pattern (a fence must be driven RED against a real plant in a
  real file, and its SCOPE verified — a fence swept against the empty string passes green while
  defending nothing).
- **Two-badge ceiling on the card** — a third badge is a typecheck error, mechanically guarded
  (188.2). Binding on D-13.

### Integration Points
- `WorkflowDoorSwitch.tsx` → `doorVocabulary.ts` (new import; the only consumer).
- `WorkflowDoorSwitch.tsx` → `DoorHeaderStrip.tsx` (new; rendered in both the standalone band and as
  `headerTrail` when `inline`).
- `WorkflowCard.tsx` → the render_template predicate over `PublishedWorkflow.definition`. ⚠ The
  predicate is shared with `RunModal.tsx` but the two consume it under **opposite unknown-fallbacks**
  (D-15 vs D-20) — the predicate should therefore return a **three-state** answer (admits / does not
  admit / unknown), not a boolean. A boolean cannot express D-20.
- `RunModal.tsx` → the same predicate, plus the new label and the render condition.

</code_context>

<specifics>
## Specific Ideas

- **The strip, as agreed:**
  ```
  ‹ back  │  🔧 Author & govern            [🔒 judge always-on]
  ```
  Return control: no border, muted, small. Divider between it and the door label. Badge: far edge,
  unchanged.

- **The card line, as agreed:**
  ```
  Yours · needs a template · changed 2 months ago
  Yours · changed 2 months ago                      ← most rows
  ```

- **The Run modal, as agreed:**
  ```
  Template to fill
  [ Upload template ]
  Stored untrusted — never run as code, never fed to the fill engine.
  ```

- The operator's standing note behind this whole sketch mechanism: *"I always see a difference
  between the sketch we do and the actual implementation."* Sketch 164 answers it by generating from
  the build; the parts of 193 the sketch does **not** cover (the strip restack, the template panel)
  are the parts where that risk remains, and they are the parts to drive hardest at UAT.

</specifics>

<deferred>
## Deferred Ideas

- **BUG-260813-01 — the workflow canvas stays DARK in light mode** (`colorMode` hardcoded, so the
  plane ignores the app theme). Adjacent, because the govern door opens the Builder that hosts the
  canvas — but a different concern (theming, not door legibility). **Routing: left `open`, NOT
  folded into 193.** It is a one-line `colorMode → useTheme` change and belongs to `/gsd:fast` under
  G-3. Re-open trigger: any phase that touches `WorkflowCanvas.tsx`'s render props.
- **Moving the return control into the breadcrumb** (`headerLead`) — rejected for 193 by D-06
  because `headerLead` renders only when `inline` is true. Re-open trigger: if a future phase makes
  the standalone band's breadcrumb unconditional, this becomes the cleaner shape.
- **A refactor phase for `WorkflowCard.tsx`** — 193 makes it the card's 3rd phase (7 commits, 747 L).
  Per G-5 the NEXT phase to touch it owes a refactor recommendation first. Not 193's debt; recorded
  so it is inherited rather than re-derived.
- **Merging door copy and library copy into one `workflowVocabulary.ts`** — rejected for 193 (D-10)
  because moving the fence-pinned `libraryVocabulary.ts` is far outside this scope. Re-open trigger:
  a third vocabulary module appearing on the workflow surface.

### Reviewed Todos (not folded)

- **`spike-nl-workflow-authoring.md`** — *"SPIKE — NL→workflow authoring (describe + upload-template
  → AI-derived inputs/phases → KB-grounded fill → human refine → run) on a real case"*.
  `todo.match-phase 193` scored it **0.6** on keywords *authoring / template / fill / before*.

  **NOT folded — and the reason is that the todo is stale, not that it is out of scope.** Its own
  2026-07-10 routing note reads: *"largely SATISFIED by shipped work — the Phase 097 spike answered
  all 4 questions and v2.9 Phase 103 shipped NL→workflow authoring. The one unshipped slice
  (upload-template as a workflow run input) is now WFIN-01 → Phase 152; **this todo closes when 152
  ships**."* Its frontmatter carries `resolves_phase: 152`.

  **Phase 152 shipped** — `.planning/milestones/v3.3-ROADMAP.md:72` records it completed
  2026-07-15, and `SEED-110` was closed on that evidence on 2026-07-31. The todo's own closure
  condition is therefore already met and its `status: pending` is stale bookkeeping.

  ⚠ **Recommended follow-up (NOT done by this phase, and not 193's to do):** close
  `spike-nl-workflow-authoring.md` against Phase 152. Left `pending` here rather than edited,
  because closing another phase's todo inside a discuss-phase is exactly the kind of silent
  side-effect this project's guardrails exist to prevent.

  Its live remainder — the *describe → AI proposes → human refines* loop — is **AUTH-02 / Phase
  197**, which the ROADMAP already records as depending on 193.

</deferred>

---

*Phase: 193-Authoring Doors + Template Placement*
*Context gathered: 2026-08-13*
