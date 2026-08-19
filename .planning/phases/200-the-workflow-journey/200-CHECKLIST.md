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

---

## §1 `step-panel` — `PhaseFormPanel.tsx` — owning plan `200-04`

**Sketch:** `screens/step-panel.html` · **NOW capture:** `../200-journey-now/now-04-phase-form-panel.png` ·
**Sole mount:** `WorkflowBuilderPage.tsx:2656` · **Ledger rows:** `SP-1` `SP-2` (blue) · `SP-3` (green) ·
`SP-4` `SP-5` (amber, outside the slice → §5).

⚠ **`PhaseFormPanel.test.tsx:711-716` pins `useMemo(` / `useState(` / `useEffect(` at an ABSOLUTE ZERO
over this file's own `?raw` source.** Every atom below that needs state is honoured by **EXTRACTION into
a new leaf** (the `199-06` / `FieldGuidance.tsx` precedent), **never by re-baselining the pin.** ⚠ And the
pin is a **substring scan over the whole file, comments included** — a docblock that spells the needle
turns it red (the 187-24 trap; it has caught three authors in this file). Build tokens, never spell them.

### §1.1 MUST RENDER

| id | atom | source | verdict | owning plan |
|---|---|---|---|---|
| **SP-MR-01** | The tool list reads as **human-named phrases**, one per offered tool id — not raw ids | `SP-1` blue · note: *"MEASURED live. The inconsistency reads worse than the noise"* · target vocabulary size N-10 (**12** phrases drawn) · re-measured pair X-13 (**5** map entries / **28** offered ids / **3** live) | **BUILD** | `200-04` |
| **SP-MR-02** | A `MODEL` card section — the model, plus its fitness reading (`Strong for judging`) | `SP-2` blue · note: *"modelFitness.ts, the governance dial and the readiness contract ALL already exist. They were never composed into the sheet's shape."* · screen text | **BUILD** | `200-04` |
| **SP-MR-03** | A `WHAT IT CAN REACH` card section — the folders it can read, each with its lock state | `SP-2` blue · screen text (`Folders it can read` · `Contracts` · `Compliance`) | **BUILD** | `200-04` |
| **SP-MR-04** | A `WHAT IT CHANGES OUTSIDE THIS WORKFLOW` card section, carrying the `NEEDS ARMING` mark and the sentence `This step can change records that live outside this workflow.` | `SP-2` blue · screen text | **BUILD** | `200-04` |
| **SP-MR-05** | The absent-registry arm: `We couldn't load the list of models.` | `SP-3` **green** · note: *"199-06 BUILT this — the picker says it now instead of vanishing."* | **VERIFY** — drive it, do not rebuild. ⚠ `ALREADY-SHIPPED` is not a pass | `200-04` |
| **SP-MR-06** | The **person-less** lock sentence: `Locked — only the person who locked it can release it` | the SCREEN, per **N-7** (the screen and the ledger row `SP-4` disagree and the screen wins) · ships via 199-06's one-way grounding dial | **VERIFY** | `200-04` |
| **SP-MR-07** | The refusal sentence that keeps the tool list closed: `Pick from the tools this workspace allows — you cannot add one by typing.` | screen text · pinned in spirit by `PhaseFormPanel.rails.test.tsx:484` (*"`toolOptions` was NOT widened"*) | **VERIFY** | `200-04` |

### §1.2 MUST NOT RENDER

| id | atom (forbidden) | why | verdict | owning plan |
|---|---|---|---|---|
| **SP-MNR-01** | Any raw `snake_case` tool id as **visible text** in the tool list | `SP-1` is the whole point of §1; a half-named list *"looks half-finished"* | **BUILD** (a subtraction) | `200-04` |
| **SP-MNR-02** | The literals `GPT-4o`, `Claude 3.5 Sonnet`, `Llama 3 Instruct` as hardcoded model names | **N-6** — models come from the registry (`useModelRegistry` / `ModelField`), never a literal | **BUILD** | `200-04` |
| **SP-MNR-03** | Any Material Symbols ligature name as visible text (`description` · `bolt` · `folder` · `lock` · `shield` · `add` · `close` · `info` · `error` · `check_circle` · `chevron_right`) | **N-5** — the icon authority is `icon-convention.md` §1/§2/§4 | **BUILD** | `200-04` |
| **SP-MNR-04** | A **free-text model box** when the registry could not be read | AUTH-04 (`196`), pinned at `PhaseFormPanel.test.tsx:723+`: absent registry ⇒ **no control at all** | **VERIFY** (the fence already holds; do not break it) | `200-04` |
| **SP-MNR-05** | A **named lock holder** (`Locked by Alex M.` or any person's name on a lock) | `SP-4` is amber-OUTSIDE-the-slice — **who holds a lock is not on the wire** (§5). Rendering a name would be a fabricated claim, which is the exact failure class D-07 exists to prevent | **REPORT** (see §5) | `200-04` |
| **SP-MNR-06** | A **preflight row count** (`Will overwrite 1,200 records`) or any other computed consequence figure | `SP-5` is amber-OUTSIDE-the-slice — **no row count is computed anywhere** (§5) | **REPORT** (see §5) | `200-04` |
| **SP-MNR-07** | A **dead map entry** — a human phrase for a tool id the server never offers | X-13: `fetch_url` and `list_folders` are in `friendlyToolName` and **not** in `get_tools(None)`. `200-04` deletes or re-points them, and says which | **BUILD** | `200-04` |

---

## §2 `builder-spine` — `PhaseSpineGraph.tsx` — owning plan `200-05`

**Sketch:** `screens/builder-spine.html` · **NOW capture:** `../200-journey-now/now-03-builder-spine.png` ·
**Authoring mount:** `WorkflowBuilderPage.tsx:2136` · **Ledger rows:** `BS-1` `BS-2` `BS-3` (blue) ·
`BS-4` (amber, INSIDE the slice).

⚠ **THE TWO-TENSE RULE — read this before any atom below.** `PhaseSpineGraph` takes a **draft
definition** and has **NO RUN** (props at `:75-85`). `199-02` refused run-time words on it for exactly
that reason, and the hot-file ledger records the refusal: *"any run-time word on it (`TRAVERSED`/`SKIPPED`,
a duration, an elapsed) is a FABRICATED claim."* D-09 reconciles this: **one component, two tenses.**
`200-05` gives the spine an **OPTIONAL run-tense prop** — **absent ⇒ byte-identical authoring render** (the
house pattern: `WorkflowCanvas.runState`, `WorkflowCanvas.editable`, `PhaseFormPanel.rails`; the last of
those is pinned load-bearing at `PhaseFormPanel.rails.test.tsx:125`). The **authoring** mount passes
nothing and is unchanged; the **receipt** mount lives on `WorkflowRunPage.tsx` (§4 `RS-MR-05`), which
already holds the run + definition in one fetch. **That siting is what keeps 199-02's refusal intact by
construction.**

Each atom below is therefore tagged **`[authoring]`** or **`[run-tense]`**. An atom tagged `[run-tense]`
rendering on the authoring mount is a **failure**, not a bonus (see `BS-MNR-05`).

### §2.1 MUST RENDER

| id | atom | source | verdict | owning plan |
|---|---|---|---|---|
| **BS-MR-01** | `[authoring]` Per-step **model name** | `BS-3` blue · note: *"All four are already in the definition the client holds."* · screen text (`GPT-4o`, `Claude Sonnet` — placeholder values under N-6; the SLOT is the atom, not the literal) | **BUILD** | `200-05` |
| **BS-MR-02** | `[authoring]` Per-step **type badge in the canvas's words** — `AI AGENT` · `ONE-SHOT WRITER` · `WAITS FOR A PERSON` · `PRODUCES THE FILE` · `CHANGES SOMETHING OUTSIDE` · `ONLY READS` | `BS-3` blue · screen text · `BS-2`'s note names the defect it fixes: *"The SAME step reads 'AI agent step' on the canvas — two views, two languages."* | **BUILD** | `200-05` |
| **BS-MR-03** | `[run-tense]` The branch reading **`TRAVERSED` / `SKIPPED`** on the fork lanes | `BS-3` blue · ⚠ **run-tense ONLY** — on a draft this is a fabricated claim (199-02) | **BUILD** | `200-05` |
| **BS-MR-04** | `[run-tense]` **Per-step duration** | `BS-4` **amber, INSIDE the slice** · note verbatim: *"MEASURED: WorkflowRunPhase carries exactly slug, phase_index, status, phase_type. No timestamps at all."* · ⚠ **LEDGER-DERIVED** — see §0.3; the screen draws no duration | **BUILD** | `200-05` |
| **BS-MR-05** | `[run-tense]` **Total runtime** at the top of the receipt | `BS-4` **amber, INSIDE the slice** · ⚠ **LEDGER-DERIVED** (sheet 178 c3 col 3), not screen-derived | **BUILD** | `200-05` |
| **BS-MR-06** | `[authoring]` The order sentence `View only — this is the order it will run in.` and the footer count sentence | screen text · a **green** reading: it already ships | **VERIFY** | `200-05` |

### §2.2 MUST NOT RENDER

| id | atom (forbidden) | why | verdict | owning plan |
|---|---|---|---|---|
| **BS-MNR-01** | The `READ_ONLY_LEGEND` string — `READ-ONLY GRAPH · ordered by phase_index · run order (i→i+1) · on-fail branch (skip_to_phase) · no depends_on · no parallel lanes · inspect, don't drag` — ⚠ **SCAN THE RENDERED DOM, NOT THE SOURCE**: the identifier stays `export`ed at `PhaseSpineGraph.tsx:71` and a `?raw` source scan would go RED on the export while proving nothing about what a person sees | `BS-1` blue · note: *"11px mono, visible at rest. The noisiest string in the product."* ⚠ Kept by `DEC-199-02-F` as a locked 019-D contract — **`200-05` is deliberately reversing a prior decision and must say so in its SUMMARY** | **BUILD** (a subtraction) | `200-05` |
| **BS-MNR-02** | The per-step raw phase-type chip `llm_agent` (or any other raw `phase_type` id) as visible text | `BS-2` blue · kept by `D-187-16` as the spine's *"measured basis"*; its replacement is `BS-MR-02`'s canvas words | **BUILD** | `200-05` |
| **BS-MNR-03** | The `phase_index N` line | `BS-2` blue | **BUILD** | `200-05` |
| **BS-MNR-04** | N-1's pre-rename fork-lane step names — `Confirm the QBR before rendering` / `Fill the QBR template` | **N-1** — a sketch defect; pinning either string would promote a defect to a criterion | **BUILD** | `200-05` |
| **BS-MNR-05** | ⚠ **ANY run-tense word on the AUTHORING mount** — no duration, no elapsed, no `TRAVERSED`, no `SKIPPED`, no count — when the optional run prop is **absent** | 199-02's refusal, kept intact by construction. **Absent prop ⇒ byte-identical authoring render**, asserted, not assumed | **BUILD** (a fence) | `200-05` |
| **BS-MNR-06** | Any Material Symbols ligature name as visible text (`search` · `psychology` · `person` · `output` · `description` · `chat_bubble` · `info` · `add`) | **N-5** | **BUILD** | `200-05` |

---

## §3 `builder-canvas` — `WorkflowCanvas.tsx` + `FlowEdge.tsx` — owning plan `200-06`

**Sketch:** `screens/builder-canvas.html` · **NOW capture:** `../200-journey-now/now-05-builder-canvas.png` ·
**Mounts:** `WorkflowBuilderPage.tsx:2106` (`editable`) **and** `WorkflowRunPage.tsx:1091`
(`editable={false}` + `runState`) · **Ledger rows:** `BC-2` `BC-3` `BC-4` (blue) · `BC-1` (amber, INSIDE the slice).

⚠ **`WorkflowCanvas.tsx` is mounted on BOTH pages.** Any `200-06` change is a change to §4's screen too;
a regression here lands on the run surface. The two mounts differ only by `editable` and `runState`.

⚠ **D-08 — the edge label and the live per-step count are ONE mechanism.** The canvas does **not** get
its own counting path; it rides the existing `runState?: (slug: string) => NodeRunState | undefined` seam
(`WorkflowCanvas.tsx:567`). `FlowEdge.tsx` already renders labels (`DETOUR_ARMED_LABEL` `:196`,
`DETOUR_OPEN_LABEL` `:204`), so the payload label has a home.

### §3.1 MUST RENDER

| id | atom | source | verdict | owning plan |
|---|---|---|---|---|
| **BC-MR-01** | A connection carries a **payload label = the upstream step's DECLARED count** | `BC-1` **amber, INSIDE the slice** · note verbatim: *"199-05's flagship CANNOT-EXPRESS. Sheet c1 draws '312 contracts → 48 extracted → 12 flagged'."* · ⚠ **LEDGER-DERIVED** — see §0.3; `screens/builder-canvas.html` draws **no** payload label | **BUILD** | `200-06` |
| **BC-MR-02** | The **four** unexpressed connection states, drawn distinctly: `at rest` · `selected` · `hovered` · `not taken` | `BC-2` blue · note: *"199-05, measured. Only the shipped one exists."* · screen draws them as a legend | **BUILD** | `200-06` |
| **BC-MR-03** | A branch node shows **its own condition** (the screen's `Over £2m?` slot), sourced from `on_failure: skip_to_phase:<slug>` | `BC-3` blue · note: *"`on_failure: skip_to_phase:<slug>` IS in the definition. This half is frontend-only and was never built."* | **BUILD** | `200-06` |
| **BC-MR-04** | Node marks drawn in the **line vocabulary**, not as large filled circles | `BC-4` blue · note: *"Sheet c1 uses small inline line marks. icon-convention §4 has no row for three shipped marks (199-05)."* ⚠ A **net-new** mark must be FLAGGED as a proposal (`icon-convention.md` §4), never passed off as shipped vocabulary | **BUILD** | `200-06` |
| **BC-MR-05** | ⚠ **In LIGHT MODE: the canvas PLANE *and at least one node CARD* both render light.** BOTH halves are asserted — a fence that checks only `colorMode={theme}` in source would pass green if the two ever diverged | `BUG-260813-01` + its **2026-08-19 addendum** (`393963cd`). Measured: `PhaseNodeCard.tsx` hardcodes **nothing** (`bg-card/30`, `text-foreground`, `border-border/50` — all tokens); React Flow puts `colorModeClassName` — the literal string `"dark"` — on its wrapper (`@xyflow/react/dist/esm/index.js:3736`, via `useColorModeClass` `:334-349`), and `tailwind.config.js` is `darkMode: ["class"]`, **scoped by the nearest ancestor**. So ONE prop wraps the whole subtree in a `.dark` ancestor and the single-prop fix is complete — **but its completeness is a COINCIDENCE OF TWO UNRELATED MECHANISMS AGREEING ON THE SPELLING `dark`**, which nothing documents or enforces. ⚠ The prop is at **`WorkflowCanvas.tsx:1317`**, not the report's `:1250` (stale by 67 lines) | **BUILD** | `200-06` |

### §3.2 MUST NOT RENDER

| id | atom (forbidden) | why | verdict | owning plan |
|---|---|---|---|---|
| **BC-MNR-01** | ⚠ **A payload label on an edge whose upstream step declared NO count** — not `0`, not a dash, not an empty pill: **no label element at all** | **D-07 / D-08**, the `SEED-159` honesty rule. ⚠ And `0` is **NOT** absence — a search step that found nothing declared a real `0` and must show it. The client arm is `hasOwnProperty`-shaped, **never** `count ?? …` and **never** `if (count)` (`200-RESEARCH.md` Pitfall 8) | **BUILD** (a fence) | `200-06` |
| **BC-MNR-02** | A **fabricated or estimated** figure anywhere on the canvas — a count the model authored, a projected total, a domain sentence like `312 docs matched` reproduced as copy | D-07's `SEED-168` axis: *"the noun is the step's own, never the contract's."* `199-05` named this *"the highest-consequence lie this phase could ship"* | **BUILD** (a fence) | `200-06` |
| **BC-MNR-03** | A hardcoded `colorMode="dark"` — i.e. a canvas that stays dark while the app is in light mode | `BUG-260813-01`. ⚠ **`useTheme` is NOT consumed by the canvas** and there is **no `ThemeProvider`** — the honest fix is a provider modelled on `providers/TechnicalNamesProvider.tsx:15-50`, whose docblock says outright it is *"NOT a bare per-consumer hook."* A second `useTheme()` call **forks the state**. ⚠ Budget it: this lands in **CHAT** first | **BUILD** | `200-06` |
| **BC-MNR-04** | Any Material Symbols ligature name as visible text (`widgets` · `search` · `shield` · `save_as` · `summarize` · `check_circle` · `warning` · `fit_screen` · `lock` · `remove` · `add`) | **N-5** | **BUILD** | `200-06` |
| **BC-MNR-05** | A **second counting path** — any count computed on the canvas rather than read through the existing `runState` seam | **D-08**: one mechanism, not two. A second path is how the edge label and the live column drift apart | **BUILD** (a fence) | `200-06` |

---

## §4 `run-surface` — `WorkflowRunPage.tsx` + `panel/PhaseTimeline.tsx` + `panel/PhaseCard.tsx` — owning plan `200-07`

**Sketch:** `screens/run-surface.html` · **NOW capture:** ⚠ **NONE — `JOURNEY["run-surface"].now === null`**
(N-3 / `RS-1`). **This screen's acceptance is the PROPOSAL ALONE.** There is no shipped half to diff
against, so a verifier cannot fall back on *"nothing regressed"*; each atom is checked on its own terms.
**Ledger rows:** `RS-2` `RS-3` (amber, INSIDE the slice — `RS-3` split, see below) · `RS-1` (grey → §5).

⚠ **`phaseStatusMeta.ts` has NO dedicated suite** (`200-RESEARCH.md` §D18) while being the natural home
for `RS-MR-04`'s arms, and **`PhaseSpineGraph.test.tsx` carries ~4 cases of slack** (20 pinned, 24 `it(`s).
A rising pinned TOTAL proves nothing about NEW cases when slack inside an already-listed file absorbs
them — the count gate's own §187-29 correction. `200-07` pins the module it changes.

### §4.1 MUST RENDER

| id | atom | source | verdict | owning plan |
|---|---|---|---|---|
| **RS-MR-01** | **Per-step counts in the live column** — the step's own declared `{count, noun}` | `RS-2` **amber, INSIDE the slice** · note verbatim: *"'312 docs matched', '48 fields extracted' — nothing emits these."* · screen text: `Found 12 contracts` | **BUILD** | `200-07` |
| **RS-MR-02** | **`RS-3a` — per-step start / finish**, from the new `started_at` / `completed_at` | `RS-3` **amber, INSIDE the slice**, split per RESEARCH R3 · note: *"Same missing timestamps as the spine."* ⚠ partly ledger-derived: the screen shows the SLOT on exactly ONE of five steps (**N-9**) | **BUILD** | `200-07` |
| **RS-MR-03** | **`RS-3a` — a real TOTAL RUNTIME** at the top (`min(started_at) → max(completed_at)`) | `RS-3` amber, in slice · screen text `00:42` in the header · ⚠ this is the product's **first honest total runtime**: `claimed_at` is null on **0 of 149** completed runs (`WorkflowRunPage.tsx:849-851`) | **BUILD** | `200-07` |
| **RS-MR-04** | **D-06's SIX distinct renders**, each provably different from the others: `pending` → nothing · `skipped` → nothing (*never ran* — correct silence) · `active` → ticks live from `started_at` · `completed` → `12.4s` · `cancelled` → `ran 8.1s, interrupted` · **historic row (`completed`, both timestamps NULL) → `time not recorded`** | **D-06** · the lesson this repo has learned twice (`runFacts.ts`'s four arms after CR-01; `DecisionsList`'s three under D-20) | **BUILD** | `200-07` |
| **RS-MR-05** | **The receipt from `200-05` mounted here** — the same spine re-read in the past tense: step · outcome · duration · count if declared · deliverable if produced, with total runtime at the top | **D-09** · sited on this page, **not** on `WorkflowBuilderPage.tsx`, which is what keeps 199-02's refusal intact by construction | **BUILD** | `200-07` |
| **RS-MR-06** | The run's deliverable listing + download (`FileRow` at `density="run"`, `WorkflowRunPage.tsx:1143-1177`) | `SEED-148`'s run-surface half, shipped by 195 — a **green** row under D-02 | **VERIFY, do not rebuild** | `200-07` |

### §4.2 MUST NOT RENDER

| id | atom (forbidden) | why | verdict | owning plan |
|---|---|---|---|---|
| **RS-MNR-01** | **Prose in the count slot** — e.g. the screen's own `Summarized meeting notes` sitting where `Found 12 contracts` sits | **N-8**. Under D-07 a step with no real number renders **NOTHING** in that slot. Drawing prose there re-introduces the fabricated-figure failure D-07 exists to prevent | **BUILD** (a fence) | `200-07` |
| **RS-MNR-02** | A **live-ticking clock** on a step that never ran, on a `skipped` step, or on a run that has ended | **D-06** — only `active` ticks, and it ticks from `started_at` (a server timestamp), which is also structurally why `BUG-260610-01`'s mount-anchored reset cannot recur | **BUILD** (a fence) | `200-07` |
| **RS-MNR-03** | `0` or a dash standing in for a step that **declared no count** | **D-07** / `SEED-159`. ⚠ Conversely a **declared** `0` (`source_refs: []` — *"we looked and found nothing"*) is a REAL fact and MUST render | **BUILD** (a fence) | `200-07` |
| **RS-MNR-04** | `never ran` and `not recorded` rendering **the same** | **D-06** — folding an absence together with a negative is the defect, and a boolean cannot express it. This is ROADMAP SC#2's *"provably distinct renders"* | **BUILD** (a fence) | `200-07` |
| **RS-MNR-05** | A **sub-step execution trace** — the screen's `Connecting to Northwind CRM instance…`, `Analyzing risk factors`, or any of its eight `00:0x` trace lines | **`RS-3b`, REPORT** (§5). The screen draws **EIGHT** trace lines for a **FIVE**-step run; several are sub-step events whose substrate is `harness_audit` / `EmitSubStep` — a second backend concern, deliberately not stacked here | **REPORT** (see §5) | `200-07` |
| **RS-MNR-06** | Any Material Symbols ligature name as visible text (`check` · `priority_high` · `sync` · `menu` · `account_tree`) | **N-5** | **BUILD** | `200-07` |
| **RS-MNR-07** | A **file previewer** on the run page | ⚠ **A TESTED DECISION, NOT A GAP.** `WorkflowRunPage.test.tsx` carries an active fence — *"promises no preview: the previewer is neither imported nor named"* — with the reason recorded: *"the template engine emits .docx, so the flagship deliverable is exactly the artefact that cannot be shown in place."* **That fence STANDS** | **VERIFY** (do not break it) | `200-07` |

---

## §5 THE REPORT REGISTER — every REPORT atom, each with a NAMED re-open trigger

D-02's rule for an amber row **outside** the slice is **REPORT, with a named re-open trigger — never
faked, never silently dropped.** This section is that register. A verifier reads it as *"these were
found, priced and deferred on purpose"*, which is a different statement from *"these were missed"*.

| id | atom | why it is not built here | **Trigger:** |
|---|---|---|---|
| **SP-4** | `Locked by Alex M.` — a lock attributed to a **person** | Ledger note verbatim: *"Who holds a lock is not on the wire."* Lock-holder attribution is a new wire field on a phase already carrying a behaviour change. ⚠ **N-7: the SCREEN draws the person-less form, and that form SHIPS** (`SP-MR-06`) — so nothing is missing from the render; what is missing is the attribution | **Trigger:** *a phase that scopes lock ownership* (who holds a lock, and the wire field that carries it). |
| **SP-5** | `Will overwrite 1,200 records` — an armed-action consequence figure | Ledger note verbatim: *"No row count is computed anywhere."* A preflight count is a **capability** (reach the target system, count rows, before acting), not a label. Inventing one would be a fabricated business figure | **Trigger:** *the connections / approval milestone* — `SEED-146` (**every capability is a WRITE**), sequenced with `SEED-144` / `SEED-145`. |
| **RS-3b** | The **sub-step execution trace** — `Connecting to Northwind CRM instance…` · `Analyzing risk factors` · and the rest of the screen's eight `00:0x` lines | ⚠ **Discharges RESEARCH R3.** The screen draws **eight** trace lines for a **five**-step run: several are **sub-step** events, while this phase's slice is **phase-level only**. Their substrate is `harness_audit` events / `EmitSubStep` — a second backend concern, and stacking it here would make ROADMAP SC#5's *"the extraction changes no behaviour beyond the human-gate fix"* unprovable | **Trigger:** *the phase that scopes `harness_audit` / `EmitSubStep` as a client transport.* |
| **FAN-OUT** | The **fan-out router** — drawn dashed on the sketch and tagged `NOT BUILT` | The spine is **LINEAR by recorded decision** — `READ_ONLY_LEGEND` itself says *"no depends_on · no parallel lanes"*. This is a product-shape decision, not a missing render | **Trigger:** *a deliberate revisit of the linear-spine commitment* (a phase that scopes parallel lanes or `depends_on`). |
| **RS-1** | The run surface's **NOW capture** | Grey row — `JOURNEY["run-surface"].now === null` (**N-3**). There is no shipped half to compare against; the sketch left it empty rather than drawing it from imagination. §4's acceptance is the proposal alone | **Trigger:** *a run that can be driven for capture* — i.e. after `200-02`+`200-07` land, a real 1440×900 capture pairs the screen and `now-08` joins `200-journey-now/`. |
| **X-6 ROW** | The **one driven browser row** owed by `BUG-260807-01` + `BUG-260808-01` | ⚠ **Not a repair — the code fix already landed** (§0.2 X-6). What is owed is a driven row against a **seeded `constructor`-slugged fixture**, because ⚠ **the UI cannot author this slug** (`D-184-11`). Flip **BOTH** reports to `closed` on that one row | **Trigger:** *`200-06`'s UAT* — the row belongs to the canvas plan's validation, with a ~3-line Python seed fixture. The **class** (`SEED-143`, constrain `slug` at the boundary) stays open and is **NOT** taken here. |

⚠ **Nothing in this register may be quietly promoted into a build.** A later plan that finds itself
building a REPORT row has grown a capability inside a phase that did not scope one — the G-7 failure
mode, in miniature.

### §5.1 AUTHORED COPY — the three per-step count nouns

**These three words are AUTHORED COPY, not a measured fact.** The *number* is measured; the *noun* is
the step's own, chosen once by us — **never the contract's, never the domain's** (D-07 / `SEED-168`).
Reproducing the sheet's `312 docs matched` / `48 fields extracted` phrasing by letting a model author
the number would ship the fabricated business figure `199-05` refused.

| Phase type | Noun this phase ships | Reads as |
|---|---|---|
| `llm_agent` | **`sources`** | `312 sources` |
| `llm_batch_agents` | **`agents`** | `48 agents` |
| `llm_emit` | **`fields`** | `12 fields` |

**The remaining four phase types (`programmatic`, `llm_single`, `llm_human_input`, `external_action`)
declare NOTHING**, and the UI then renders nothing — never `0`, never a dash (`BC-MNR-01` / `RS-MNR-03`).

⚠ **Each noun is authored at exactly ONE executor site and pinned by ONE test case**, so a later wording
change is a one-line edit rather than a re-derivation. A second home for any of these three words is the
drift this rule exists to prevent — the same one-string-home rule the repo already enforces four times
over (`doorVocabulary.ts`, `libraryVocabulary.ts`, `decisionsVocabulary.ts`, `runVocabulary.ts`).

⚠ **A structural count over the existing `output` jsonb was REJECTED, and the reason is measured:**
`_persist_output` (`harness_engine.py:142`) stores each executor's dict **full and inline, never
truncated** (CR-02), the shapes differ per phase type, and **no key marks "the thing produced"** — so
any structural count would be the length of whichever key happened to be a list.

### §5.2 Atom census

| § | Screen | MUST RENDER | MUST NOT RENDER | total | of which REPORT |
|---|---|---|---|---|---|
| §1 | `step-panel` | 7 | 7 | **14** | 2 (`SP-MNR-05`, `SP-MNR-06`) |
| §2 | `builder-spine` | 6 | 6 | **12** | 0 |
| §3 | `builder-canvas` | 5 | 5 | **10** | 0 |
| §4 | `run-surface` | 6 | 7 | **13** | 1 (`RS-MNR-05`) |
| | **total** | **24** | **25** | **49** | **3** |

Plus six register rows in §5 (`SP-4` · `SP-5` · `RS-3b` · `FAN-OUT` · `RS-1` · `X-6 ROW`).

**Verification reports `N/N` against these counts, per screen, or NAMES THE MISS.**
