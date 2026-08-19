---
phase: 200
slug: the-workflow-journey
kind: acceptance-checklist
derived_from: .planning/sketches/200-journey-interactive/index.html
locked: true
written_at_sha: 393963cd0c191bf360474df48868e8f0dc05d7c7
written: 2026-08-19
owning_plan: 200-01
requirements: [DES-02]
---

# Phase 200 — THE ACCEPTANCE CHECKLIST

**This document is the acceptance bar. It was written before any source byte of this phase changed.**

Phase 199 verified **5/5** on its own success criteria while the operator's verdict was *"nothing
changed from a UI perspective."* Both were true, because the criteria were derived alongside the
work. D-03 fixes that by borrowing the characterization-baseline discipline this repo already
trusts — `WorkflowDoorSwitch.baseline.test.tsx`'s docblock: *"A baseline taken after the edit
proves the edit against itself."* The same objection applies to acceptance criteria, so this file
is committed in a commit whose `git diff --name-only` contains **zero source files**. That command's
output is pasted in §6.7; it is the proof rather than the promise.

### How to use this file

- **Every atom has a stable row id** — `SP-MR-01`, `BS-MNR-02`, `RS-MR-03`, and so on
  (`{screen}-{MR|MNR}-{nn}`). Later plans **cite the id**; they do not re-derive the atom and they
  do not re-read 105 KB of sketch HTML.
- **Later plans may NOT edit this file.** An atom that moves, splits or is dropped after this commit
  is a **deviation to explain in that plan's SUMMARY**, never a quiet edit. That rule is what makes
  `N/N atoms` mean something.
- **Verification reports `N/N atoms` per screen, or NAMES THE MISS.** The `MUST NOT RENDER` half is
  checked exactly as strictly as the `MUST RENDER` half — that is what makes 199-style *subtractions*
  provable rather than asserted.
- ⚠ **`ALREADY-SHIPPED` is not a pass in this phase.** It was **57 of 105** verdicts in 199. A `VERIFY`
  verdict below means *drive it and show it renders*, not *it exists in the source*.

### The resolution rule (D-02) — mechanical, by the ledger's own colour

The sketch already assigns every row a colour. The rule is therefore pointable-at rather than a
judgement per row. Verbatim from `index.html`, immediately after the `JOURNEY` array:

```js
var NEEDS = {
  none:     {label:"already shipped", color:"#21C45D"},   // green  → VERIFY, do not rebuild
  frontend: {label:"frontend only",   color:"#A3A5FF"},   // blue   → BUILD
  data:     {label:"NEEDS BACKEND",   color:"#F5A524"},   // amber  → BUILD if inside the slice, else REPORT
  capture:  {label:"not captured",    color:"#6B7383"}    // grey   → no shipped half to compare against
};
```

| Row colour | Verdict | Meaning here |
|---|---|---|
| blue — frontend only | **BUILD** | the ingredients ship; they were never composed |
| amber — **inside** the named backend slice | **BUILD** | `200-02` puts it on the wire; the screen renders it |
| amber — **outside** the slice | **REPORT**, with a **named re-open trigger** | never faked, never silently dropped (§5) |
| green — already ships | **VERIFY, do not rebuild** | drive it; `ALREADY-SHIPPED` is not a pass |
| grey — not captured | no shipped half exists to compare against | acceptance is the proposal alone |

**The four in-scope screens and their owning plans:**

| § | Screen (`JOURNEY` id) | Renders through | Owning plan |
|---|---|---|---|
| §1 | `step-panel` | `PhaseFormPanel.tsx` | **`200-04`** |
| §2 | `builder-spine` | `PhaseSpineGraph.tsx` | **`200-05`** |
| §3 | `builder-canvas` | `WorkflowCanvas.tsx` + `FlowEdge.tsx` | **`200-06`** |
| §4 | `run-surface` | `WorkflowRunPage.tsx` + `panel/PhaseTimeline.tsx` + `panel/PhaseCard.tsx` | **`200-07`** |

⚠ **The plan numbers above are the SHIPPED seven-plan shape, not `200-CONTEXT.md`'s six-plan sketch.**
CONTEXT's `<specifics>` still lists `200-03 the step panel … 200-06 the run surface`. RESEARCH R1
measured that the backend carried two non-additive concerns, so the wire slice and the human gate
split into `200-02` + `200-03` and **every screen plan shifted by one**. The ROADMAP records the
shift verbatim: *"Plans `200-04`…`200-07` are the original `03`…`06`, shifted by one."* Cite the
table above, never CONTEXT's list.

---

## §0 KNOWN SKETCH DEFECTS

A checklist derived verbatim from the sketch would turn the sketch's own recorded nits into
acceptance criteria. **Every known defect is excluded BY NAME here, with the correction written in.**
A later plan that finds itself building one of these rows has promoted a defect to a criterion.

`N-1`…`N-4` are the sketch README's own carried nits. `N-5`…`N-8` were measured by `200-RESEARCH.md`
§A2 this week by stripping tags from `screens/*.html`; the README does not list them.

| # | Defect (what the sketch DRAWS) | Where recorded | ⇒ CORRECTION — what the atom must be instead | Applies to |
|---|---|---|---|---|
| **N-1** | The spine's fork lanes name the **pre-rename** steps: `Confirm the QBR before rendering` (THIS WAY) / `Fill the QBR template` (NOT THIS WAY) | sketch `README.md` nit 1; confirmed present in `screens/builder-spine.html` and again in `screens/run-surface.html`'s spine column | Use the **current** step names. The fork lane is a *branch condition* atom (§3 `BC-MR-03`), never a name atom. No checklist row may pin either string. | §2, §4 |
| **N-2** | The draft-arrival card footer reads `How long it looks back` **twice** | sketch `README.md` nit 2 | `Open in the builder` / `See the steps`. ⚠ **NOT APPLICABLE to Phase 200** — the draft-arrival screen is one of the nine deferred screens. Listed so it is not re-discovered; **no atom derives from it.** | — (deferred screen) |
| **N-3** | The run surface has **no NOW capture at all** — `JOURNEY["run-surface"].now === null`, literally | sketch `README.md` nit 3; verified in `index.html` | There is **no shipped half to compare against**, so §4's acceptance is **the proposal alone**. This is honest, not a hole to fill: the sketch left it empty rather than drawing it from imagination. Recorded as the grey row `RS-1` in §5. | §4 |
| **N-4** | The connections sheet carries **nine** gstatic `stitch-placeholder-300x300.svg` marks | `JOURNEY.connections` gap row 1 (`MEASURED: svg count 0`) | `@lobehub/icons` via `providerLogo.tsx` (`icon-convention.md` §1). ⚠ **NOT APPLICABLE to Phase 200** — connections is a **MILESTONE**, not a screen (`SEED-144` / `SEED-145` / `SEED-146`: *every capability is a WRITE*), and no MCP client exists in the backend today. **No atom derives from it.** | — (milestone) |
| **N-5** ⚠ | **Every in-scope screen draws Material Symbols ligature NAMES as its icon vocabulary.** Measured in the rendered text of all four: `description` · `bolt` · `search` · `check_circle` · `chevron_right` · `folder` · `lock` · `shield` · `add` · `close` · `info` · `error` · `priority_high` · `sync` · `psychology` · `account_tree` · `summarize` · `save_as` · `fit_screen` · `widgets` · `remove` · `warning` · `person` · `output` · `chat_bubble` · `arrow_back` · `account_circle` · `health_and_safety` · `policy` · `category` · `dataset` · `menu` · `add_circle` · `settings` · `check` | `200-RESEARCH.md` §A2 (measured this session; re-confirmed by `200-01` against all four screen files) | The product's icon authority is **`icon-convention.md`** — §1 (`@lobehub/icons` for provider/model marks), §2 (the shared 3D `PHASE_GLYPHS` map for phase types), §4 (the canvas mark table: `⛨` `🔒` `⤳` `＋`/`✕` `↶`/`↷` `◆`). **NO Material Symbols ligature is a shippable atom.** A checklist row naming one would be a defect promoted to a criterion — which is why each screen section below carries an explicit `MUST NOT RENDER` row forbidding it. A **net-new** mark must be FLAGGED as a proposal (§4 of the convention), never passed off as shipped vocabulary. | §1 §2 §3 §4 |
| **N-6** ⚠ | The step-panel screen names **three stale model literals**: `GPT-4o`, `Claude 3.5 Sonnet`, `Llama 3 Instruct` (and a fourth reading, `Use the run's model — today that would be GPT-4o`) | `200-RESEARCH.md` §A2; confirmed in `screens/step-panel.html` | Models come from the **registry** — `useModelRegistry` / `ModelField` — **never a literal**. These are placeholder text, not atoms. ⚠ AUTH-04 (`196`) is binding here: an absent registry renders **no control at all**, emphatically no free-text box. The shipped `We couldn't load the list of models.` arm is `SP-3` (green, VERIFY). | §1 |
| **N-7** ⚠ | The step-panel screen renders the lock as `Locked — only the person who locked it can release it` — **with NO person named**, while the ledger's amber row `SP-4` reads `Locked by Alex M.` | `200-RESEARCH.md` §A2; both strings confirmed at source | **The two disagree, and the SCREEN wins.** The rendered form needs no wire data and **already ships** (199-06's one-way grounding dial). Derive the atom from the screen (`SP-MR-04`, VERIFY) and **REPORT `SP-4`** as an atom the screen itself does not draw — lock-holder attribution is not on the wire (§5). | §1 |
| **N-8** ⚠ | The run-surface screen puts the **sentence** `Summarized meeting notes` in the same slot as the **count** `Found 12 contracts` | `200-RESEARCH.md` §A2; confirmed in `screens/run-surface.html` (step 2 of the Workflow Progress column) | Under **D-07** a step with no real number renders **NOTHING** in that slot. Drawing prose there re-introduces exactly the fabricated-figure failure D-07 exists to prevent — the thing `199-05` named *"the highest-consequence lie this phase could ship."* §4 therefore carries `RS-MNR-01` forbidding prose in the count slot. | §4 |

### §0.1 Two further sketch readings measured by `200-01`, recorded rather than dropped

Neither is a defect the checklist must correct; both are facts a later plan would otherwise
re-discover, so they are written down here.

| # | Reading | Measured | Consequence |
|---|---|---|---|
| **N-9** | The run-surface spine draws **five** steps and exactly **ONE** of them carries a time (`00:15`, on `Confirm the QBR before rendering`) | text extract of `screens/run-surface.html` | The screen does **not** itself demonstrate the per-step duration on every row. `RS-MR-02` (per-step start/finish) is therefore **partly ledger-derived** in the same sense as `BS-4` — the sketch shows the *slot*, the ledger row supplies the *rule*. |
| **N-10** | The step-panel screen draws **twelve** human-named tool phrases (`Read a document` · `Search documents` · `Run code` · `Search a saved view` · `Write a file` · `Track its to-dos` · `Ask a person` · `Attach a skill file` · `Browse the web` · `Read related documents` · `Query tables` · `Remember something`) | text extract of `screens/step-panel.html` | This is the **target vocabulary size** for `SP-MR-01`, against a shipped map of **five**. See X-13 for the re-measured pair. ⚠ The twelve are the SKETCH's phrasing, not a contract — `200-04` authors phrases for the ids the server actually offers, and the sketch's twelve do not map 1:1 onto them. |

### §0.2 REFUTATIONS — claims carried by CONTEXT / ROADMAP / FORWARD-CHECK that measurement DISPROVED

Recorded here so that **no later plan opens work against them.** Each names every document that
carries the false claim, so the correction can be applied at its source.

#### X-2 — the `llm_judge_rubric` "missing glyph" gap **DOES NOT EXIST**

**REFUTED BY MEASUREMENT.** There are **seven** phase types and **seven** `PHASE_GLYPHS` keys. The
map is **TOTAL** over the shipped phase types.

- `frontend/src/components/workflows/soulData.ts:57-65` — `PHASE_GLYPHS` has exactly seven keys:
  `programmatic` · `llm_single` · `llm_agent` · `llm_batch_agents` · `llm_human_input` · `llm_emit` ·
  `external_action`.
- `backend/app/services/harness/phase_types.py:2398-2410` — `PHASE_TYPE_REGISTRY_ENTRIES`, the same seven.
- `backend/app/models/harness.py:68, 77, 93, 110, 129, 154, 242` — `PhaseConfig`'s discriminated
  union, the same seven members.
- **`llm_judge_rubric` is a `ValidatorSpec.kind`**, not a phase type — `backend/app/models/harness.py:350`
  (inside the `Literal[...]` of validator kinds) and `backend/app/services/harness/validator_kinds.py:500`
  (`@register_validator("llm_judge_rubric")`). **A validator is a GATE ATTACHED TO A PHASE. It has no
  node, so it needs no glyph.**

**Where the false claim lives — TWO documents, measured, not three:**

1. `.planning/phases/200-the-workflow-journey/200-CONTEXT.md:426` — *"`llm_judge_rubric` ships in the
   backend with NO glyph… seven keys and the backend has eight phase types… a real product gap, not a
   sketch problem"*, and again at `:450` (*"where `llm_judge_rubric`'s missing glyph belongs"*).
2. `.planning/sketches/200-journey-interactive/FORWARD-CHECK.md:31` — *"⚠ A real gap found while
   checking: the backend ships `llm_judge_rubric` as a phase type, and `PHASE_GLYPHS` has no key for it."*

⚠ **X-2b — RESEARCH §C16 says THREE documents carry it and names `.planning/ROADMAP.md` as the third.
`200-01` re-measured and the ROADMAP does NOT carry it.** `grep -n "llm_judge_rubric" .planning/ROADMAP.md`
returns **zero hits**, and the Phase 200 entry (`ROADMAP.md:892-960`) contains no glyph claim at all.
Recorded because *"a row that is present and WRONG stops the audit"* — the correction is owed to two
files, not three, and a later plan hunting a ROADMAP edit would find nothing and could not tell whether
it had already been done.

**NO LATER PLAN MAY OPEN WORK AGAINST THIS GAP.** Additionally: D-07's *"bounded to the eight shipped
phase types"* should read **seven**, and `icon-convention.md` §4's last table row reads *"phase-type
marks | the **6** workflow phase types"* — **seven** since 189 added `external_action` (X-15; correct
only if `200-06` touches §4 anyway).

**Where a judge DOES surface** is the step panel's **GATES rail** — `PhaseFormPanel.rails.test.tsx:278-330`
pins locked/unlocked gate rows, and `ValidatorSpec.kind` is what a gate row names. If `200-04` composes
sheet c4's sections, a `llm_judge_rubric` gate may want a human word — and **`phaseVocabulary` /
`definitionOps`, never `PHASE_GLYPHS`, is where that word belongs.**

#### X-6 — `BUG-260807-01` and `BUG-260808-01` are **ALREADY CODE-FIXED**

CONTEXT says *"Correctness defects under the rebuilt canvas… they widen `200-05` beyond D-01
deliberately, which the planner must budget for rather than discover."* **The code fix already
landed**, and both reports' own tails say so:

- `frontend/src/components/workflows/editAffordance.ts:540, :543` — `own(overlay, slug)` and
  `own(nudges, slug) ?? 0`, docblock at `:511` naming `BUG-260807-01`.
- `frontend/src/components/workflows/WorkflowCanvas.tsx:699, :738, :942` — all three sinks route
  through `own()`. Guard leaf: `ownProperty.ts` (zero imports by contract).

**What is OWED is exactly ONE driven browser row, shared by both reports**, with a **seeded
`constructor`-slugged fixture** — read the affordance's computed `transform` (807's half) and the
node's `style.transform` (808's half), slug control swung both ways, and **flip BOTH reports to
`closed` on that one row.** ⚠ The UI **cannot author this slug** (`D-184-11`: there is no slug field),
so the row needs a seeded `workflow_definitions` fixture. **Budget: one UAT row + a ~3-line Python
seed fixture, NOT a repair.** Neither report is a checklist atom.

The **class** stays open — `SEED-143` (constrain `slug` at the boundary). ⚠ **Recommend NOT taking it
in this phase:** it is a schema + API-surface change on a phase already carrying a behaviour change,
and CONTEXT scoped neither.

#### X-13 — `SP-1`'s inherited numbers are **STALE**, and the re-measured pair is published here

The ledger row `SP-1` reads *"24 raw snake_case tool ids against 3 human-named ones"* with the note
*"3 of 27 named makes it look half-finished"*. Both figures are stale. `200-01` re-measured them
this session, and the measurement found a **third fact the ledger row does not contain**:

| Measured | Value | How |
|---|---|---|
| `friendlyToolName` **map entries** | **5** | `frontend/src/components/workflows/PhaseFormPanel.tsx:874-882` — `search_documents` · `read_document` · `execute_code` · `fetch_url` · `list_folders` |
| **Tool ids the author is actually OFFERED** (`rails.toolOptions`) | **28** | `rails.toolOptions` ← `GroundingBundle.tools` ← `sorted(schema_tool_names)` (`backend/app/services/harness/grounding.py:521`) ← `{t["function"]["name"] for t in get_tools(None)}` (`:476`). Executed: `venv/Scripts/python.exe -c "from app.services.openai_service import get_tools; …"` ⇒ **28** |
| Map entries that name an **actually-offered** id | **3** | `execute_code` · `read_document` · `search_documents` |
| ⚠ **DEAD map entries** — named but never offered | **2** | **`fetch_url`** and **`list_folders`** are **not in `get_tools(None)`**. They can never fire. |
| Offered ids with **no** human phrase | **25** | 28 − 3 |
| Human-named phrases the SKETCH draws | **12** | §0.1 N-10 |

⇒ **`SP-1`'s real numbers are 5 map entries / 28 offered ids, of which only 3 can ever fire — so
the shipped coverage is 3 of 28, with two dead entries.** The inherited and now **stale** *"3 of 27"*
was right on the numerator by coincidence and wrong on the denominator; no later plan may quote it.

⚠ **The two dead entries are their own small finding**: a map row naming an id the server never offers
is invisible until someone counts, exactly like a hot-file row that is present and wrong. `200-04`
should delete them or re-point them, and say which.

The full offered set, published so `200-04` authors phrases against it rather than against the sketch:
`analyze_document` · `ask_user` · `attach_skill_file` · `execute_code` · `fetch_document_file` ·
`get_related_documents` · `glob` · `grep` · `load_skill` · `ls` · `query_documents` ·
`query_documents_by_view` · `query_tables` · `read_document` · `read_skill_file` · `recall` ·
`remember` · `save_skill` · `search_documents` · `task` · `tree` · `web_search` · `workspace_delete` ·
`workspace_diff` · `workspace_list` · `workspace_read` · `workspace_write` · `write_todos`.

⚠ **This set is the SCHEMA list, not a per-user one** — `toolOptions` arrives per request and can be
`"degraded"`. A checklist atom must be worded over *"every id the panel is handed"*, never over the
literal 28.

#### X-14 — the sketch README says *"the six real captures"*; there are **SEVEN files**

`.planning/sketches/200-journey-now/` holds seven PNGs. `now-01`…`now-06` each pair with a `JOURNEY`
row's `now:` field; **`now-07-chat-panel.png` is referenced by NO `JOURNEY` row** (a grep of the array
returns `now-01`…`now-06` only). It is an orphan capture, not a missing pairing. **Nobody should hunt
a seventh pairing.** Cosmetic; the README's Files table is what is stale.

Of the seven, **three are in this phase's scope**: `now-03-builder-spine.png` (§2) ·
`now-04-phase-form-panel.png` (§1) · `now-05-builder-canvas.png` (§3). **§4 has none — see N-3.**

### §0.3 DERIVATION PROVENANCE — R2 discharged

⚠ **`BS-4` and `BC-1` are LEDGER-DERIVED, NOT SCREEN-DERIVED. These are the two atoms that justify
lifting the presentation-only fence, and a checklist that omits them has dropped the phase's whole
argument.**

Measured this session by extracting the rendered text of both proposed screens:

- **`screens/builder-spine.html` draws NO per-step duration and NO total runtime.** What it draws is
  the fork lanes, per-step type sentences (`Searches the knowledge base and decides its own next move`
  / `AI AGENT`, `Writes one piece in a single pass` / `ONE-SHOT WRITER`, `Pauses and waits for a
  person` / `WAITS FOR A PERSON`, `Produces the finished file` / `PRODUCES THE FILE`, `CHANGES
  SOMETHING OUTSIDE`, `ONLY READS`), the `How a workflow can end` explainer, `View only — this is the
  order it will run in.` and the footer `5 steps, runs top to bottom, one person gate`.
- **`screens/builder-canvas.html` draws NO payload label on any connection.** What it draws is node
  sentences, a branch (`Over £2m?` → `Escalate to the risk committee` / `High risk path`, `File as
  routine` / `Standard path`), the four connection states as a **legend** (`at rest` · `selected` ·
  `hovered` · `not taken`), and zoom controls (`100%`, `fit_screen`, `lock`).

**Their drawing source is sketch 178** — `BS-4` from sheet **c3 col 3** (per-step timings + total
runtime), `BC-1` from sheet **c1** (`312 contracts → 48 extracted → 12 flagged`). Their in-Phase-200
authority is the `JOURNEY` ledger `note` on each amber row, quoted verbatim in §2 and §3.

**Consequence, stated so it cannot be missed:** a verifier who checks §2 or §3 against
`screens/*.html` alone will find `BS-MR-02` and `BC-MR-01` **absent from the screen** and could
conclude the atom was invented. It was not. **Those two atoms are checked against the LEDGER ROW and
sheet 178, and against the shipped render — never against the Phase-200 screen HTML.**

⚠ Corollary for the amber rows generally (`200-RESEARCH.md` Pitfall 7): the ledger `gap` rows do not
enumerate atoms, so an amber row's atom is always a *reading* of its `note`. Each such atom below
carries its `note` verbatim in the `source` column, so the reading is auditable rather than asserted.
