---
phase: 199-the-component-map
plan: 02
subsystem: ui
tags: [react, tailwind, phase-spine, workflow-builder, workspace-panel, design-system, stitch, characterization-pin]

requires:
  - phase: 178-stitch-component-map (sketch)
    provides: "sheet c3-phase-spine — three columns (authoring / live panel / chat receipt) plus a failure variant, and its README's two self-declared flaws"
  - phase: 127-03
    provides: "density-by-status on the panel row (quiet idle / bloom active / fold done) — the decision this plan carries into the frame"
  - phase: 187-09
    provides: "D-187-16 — the spine stops swapping its title; its raw chip + raw index line are the measured basis"
provides:
  - "A verdict for every element of sheet c3, across all three columns — BUILT, ALREADY-SHIPPED, REFUSED or CANNOT-EXPRESS, none silently dropped"
  - "The authoring spine, re-presented by SUBTRACTION: the `NET-NEW · no graph lib` engineering note is gone"
  - "The live panel spine, re-presented by SUBTRACTION: the settled rows lose their box; the frame is spent only where the run needs your eye"
  - "A pre-change inventory of both spines' resting atoms, as literals, so 'renders less' is measured rather than claimed"
  - "The Col-3 CANNOT-EXPRESS report — the missing value, its real source, and the gap"
affects: [199-03, 199-05, workflow-run-surface, chat-run-receipt, sketch-178-followups]

tech-stack:
  added: []
  patterns:
    - "Subtraction proved by INVERSION: pin the atom PRESENT in one commit, invert it in the next; zero assertions deleted (both test files are +N/−0 against the base)"
    - "`border-transparent` rather than a dropped `border` utility — a tone change must not become a geometry change"

key-files:
  created:
    - .planning/phases/199-the-component-map/199-02-SUMMARY.md
  modified:
    - frontend/src/components/workflows/PhaseSpineGraph.tsx
    - frontend/src/components/workflows/PhaseSpineGraph.test.tsx
    - frontend/src/components/panel/PhaseCard.tsx
    - frontend/src/components/panel/PhaseCard.test.tsx

key-decisions:
  - "DEC-199-02-A — the sheet's `(4/12)` is REFUSED and the refusal is a FENCE, not prose: no rendered string in either spine may match /\\(\\d+\\/\\d+\\)/, asserted across the whole nine-member status taxonomy with a positive control."
  - "DEC-199-02-B — the authoring column's two-line-per-node description is INVERTED, not copied. The atom actually cut is `NET-NEW · no graph lib`: an implementation note printed to the person authoring a workflow, asserted nowhere in `frontend/src` (measured before it was spent)."
  - "DEC-199-02-C — the settled panel rows lose their box (`border-transparent`), the live and failed rows keep theirs. Sheet c3 boxes exactly two of six rows; the shipped panel boxed all six, so six frames competed and the eye had nothing to land on."
  - "DEC-199-02-D — sheet c3 Col 3 is CANNOT-EXPRESS. Per-phase timing does not reach the frontend from ANY shipped route, and the closest column (`workflow_phases.created_at`) is written for every row at RUN creation, so a duration derived from it is cumulative-from-run-start and would look right while being wrong."
  - "DEC-199-02-E — the sheet's `TRAVERSED`/`SKIPPED` words are REFUSED **in the authoring column**: that surface reads a DRAFT definition and has no run, so a traversal outcome there is a fabricated claim. The must_have ('a branch outcome reads as a WORD') is ALREADY-SHIPPED and now pinned — the dashed edge reads `on fail → skip to <slug>`, with its words asserted class-stripped."
  - "DEC-199-02-F — the locked 019-D `READ_ONLY_LEGEND` STAYS, flagged rather than cut. It prints machine vocabulary (`phase_index`, `skip_to_phase`, `depends_on`) and the sheet draws no legend at all, but it is a locked sketch contract asserted in four places (three of them the graph view's presence probe in `WorkflowBuilderPage.test.tsx`). Re-opening it is a phase, not a re-presentation."
  - "DEC-199-02-G — two candidate subtractions in the panel were EVALUATED AND DECLINED with reasons: `PhaseCard`'s active-step type one-liner (127-03's honest context, three shipped assertions) and `PhaseTimeline`'s doing-now line (WR-05's and 194-04's five shipped guards that it routes through the vocabulary table). Cutting either required deleting an assertion, which this plan forbids."

patterns-established:
  - "Pattern: a sheet element with no BUILT row still gets a written verdict. Col 2 produced ZERO BUILT rows from the sheet's own content and one from its NEGATIVE SPACE (the box it does not draw) — absence is a design statement and is readable."
  - "Pattern: the characterization pin is committed one commit BEFORE the change, then inverted. `git diff --numstat <base> HEAD` showing +N/−0 on both test files is the machine-checkable proof that no shipped assertion was spent."

requirements-completed: [DES-01]

duration: 47min
completed: 2026-08-19
---

# Phase 199 Plan 02: The Phase Spine (sheet c3) Summary

**Both shipped spines re-presented against sheet `c3-phase-spine` by SUBTRACTION only — an engineering note off the authoring column and the box off every settled panel row — with all three sheet columns carrying a written verdict, the sheet's own `(4/12)` refused as a live fence, and the chat receipt column reported as CANNOT-EXPRESS with the missing value named.**

## Performance

- **Duration:** ~47 min
- **Tasks:** 3 / 3
- **Files modified:** 4 (2 source, 2 test) — `git diff --numstat` against the dispatched base is the whole of it
- **Commits:** 3

## The planner correction, confirmed by measurement

The plan carried a correction to the ROADMAP's file mapping (`PhaseSpine.tsx` is the soul's HORIZONTAL glyph-dot spine and belongs to `199-03`, not to sheet c3). **Confirmed independently here**: `PhaseSpine.tsx`'s own docblock carries the `G-5 RED LINE` forbidding it from touching the run-surface timeline, and its suite (`PhaseSpine.test.tsx`, 11 cases) passed **UNEDITED** through this plan — which is what proves the correct file was worked on rather than merely asserted.

---

## The reconciliation table — every sheet element, one verdict

### Col 1 · the authoring spine → `frontend/src/components/workflows/PhaseSpineGraph.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 1 | Vertical spine, one glyph-node per step | **ALREADY-SHIPPED** | the `<ol>` gutter edge + the 26px bullet; the 3D mark comes from `soulData.PHASE_GLYPHS` via `phaseGlyph()`, the ONE home |
| 2 | Step name as the headline | **ALREADY-SHIPPED** | `node-title`, resolved once through `nodeTitle(phase, nameContext)` and reused in the `aria-label` (WCAG 2.5.3) |
| 3 | Type chip (`Vector`, `Parser`, `Reasoning`, `Router`) | **ALREADY-SHIPPED, in a different vocabulary and deliberately** | the shipped chip prints the RAW `phase_type`. ⚠ Swapping it for a business word would delete D-187-16's **measured basis** — the spine stopped swapping its title precisely *because* the technical vocabulary was never hidden here. Two shipped fences (`toMatch(/phase\.config\.phase_type/)`, the `phase_index` chrome case) exist to say so |
| 4 | **A two-line description under every node** | ⚠ **REFUSED (sheet flaw 2, named by sketch 178's own README)** | *"the 'text is noise' rule drifting on the widest column."* The correct read is the OPPOSITE of the drawing. **Inverted**: see row 5 |
| 5 | *(negative space)* the header's engineering note | ✅ **BUILT — the subtraction** | `NET-NEW · no graph lib` REMOVED. It named the **mechanism** to the person authoring a workflow (the adopted mindset's third rule). Safe to spend: a repo-wide grep measured **ZERO** assertions on it before it was cut |
| 6 | Branch reads as a WORD, not colour alone | **ALREADY-SHIPPED — now pinned** | the dashed edge reads `⤳on fail → skip to human-confirm`; the pin asserts the words survive with **every `class` attribute stripped**, so the claim is about text and not about a colour that happens to spell one |
| 7 | The words `TRAVERSED` / `SKIPPED` on the two branch outcomes | ⚠ **REFUSED — a third sheet flaw, found here** | the authoring spine reads a **DRAFT definition**. There is no run, so there is no traversal; drawing an outcome would be a fabricated claim of the same family as `(4/12)` |
| 8 | Per-node model chip (`GPT-4o`, `Claude-3.5-Sonnet`) | **REFUSED** | the value exists in the definition JSON, but rendering it makes the spine render **MORE at rest** — the one thing this plan's must_have forbids |
| 9 | Inline config preview (Prompt Template / Temperature) on the selected node | **REFUSED** | config has exactly one home, the 400px `PhaseFormPanel` push. A second copy inside the spine is a second home *and* an addition at rest |
| 10 | The selected-node emphasis | **ALREADY-SHIPPED** | `data-selected` + `ring-2 ring-primary` + `border-primary bg-primary/5` |
| 11 | *(the sheet draws no legend)* the shipped `READ_ONLY_LEGEND` | ⚠ **FLAGGED, NOT CUT** | see DEC-199-02-F — locked 019-D contract, asserted in four places. Recorded with a re-open trigger below |

### Col 2 · the live panel spine → `PhaseTimeline.tsx` + `PhaseCard.tsx`

| # | Sheet element | Verdict | Reason / evidence |
|---|---|---|---|
| 1 | Settled row: glyph + name | **ALREADY-SHIPPED** | the `<ol>`/`<li>` rows + the APG accordion header |
| 2 | Settled row's **kept fact** (`312 docs matched`, `48 fields extracted`) | ⚠ **CANNOT-EXPRESS** | no per-phase result summary reaches `Phase`, and `SUPPRESS-DON'T-FAKE (D-03)` forbids per-phase counts outright — they fire on the invisible sub stream |
| 3 | Active row: name + a running word + an alive affordance | **ALREADY-SHIPPED** | status atom `● Running`, the indeterminate `role="progressbar"` (no `aria-valuenow`), the `data-activity-line` pulse, the bloom |
| 4 | **`Processing liability caps section (4/12)`** | ⚠ **REFUSED (sheet flaw 1)** — and the refusal is a **live fence** | nothing in this system emits a within-a-step count. Asserted across all nine statuses with a positive control, in both spines |
| 5 | `Waiting` on the pending row | **ALREADY-SHIPPED, different word** | the panel word is `Locked` — it encodes the harness's escape-proof pipeline, which `Waiting` does not. The panel keeps its own vocabulary (`lib/phaseState.ts`'s shipped rule) |
| 6 | `Blocked` on a *second* pending row | ⚠ **REFUSED** | the sheet spells ONE state with TWO words, distinguished only by position. `phaseStatusMeta`'s whole discipline is one word per state |
| 7 | `Action Req` + **Approve / Reject inside the spine** | ⚠ **CANNOT-EXPRESS within this plan's scope** | the interrupt has one home — `PendingAskCard`, under sketch 006/010's *pin-while-active → fold*. Building the buttons into the accordion header is a **new user-facing capability** and a second home. (`Action Req` is also an abbreviation, which the copy rules refuse) |
| 8 | Failure variant: a genuine error sentence + a `Failed` chip | **ALREADY-SHIPPED** | the closed taxonomy + the separate `role="alert"` + the `reason_unknown` sentinel. ⚠ The sheet's sentence names a reviewer and a 48h limit we do not have — **no sentence may be re-spelled here**, the taxonomy is the single source |
| 9 | Ghosted aborted step (`Draft (Aborted)`, grayscale) | **ALREADY-SHIPPED for the ghosting · REFUSED for the word** | `pending` is already dim; `Aborted` would be a **tenth** state the union does not declare |
| 10 | *(negative space)* the sheet boxes **2 of 6** rows | ✅ **BUILT — the subtraction** | the settled rows lose their box (`border-transparent`); the live and failed rows keep theirs. This is 127-03's density decision carried into the **frame** |

**⚠ Col 2 produced ZERO built rows from the sheet's own content, and one from its negative space.** That is the honest read and it is recorded rather than padded: every positive element the sheet draws is either already shipped, or refused for a stated reason. The only thing worth taking from column 2 is **what it does not draw**.

### Col 3 · the chat-sized receipt → reported, not built (Task 3, below)

---

## Task 3 — the CANNOT-EXPRESS report for Col 3

*The required three parts. This task built nothing: `git diff --numstat <base> HEAD` names four files and **none is under `frontend/src/components/chat/`**.*

### 1. What the sheet asks for

A 280px **execution trace**, chat-sized: one row per step (`Retrieve`, `Extract`, `Analyze`, `Branch (High Risk)`, `Judge`, `Draft`), each carrying a **mono per-step duration** (`00:03`, `00:12`, `00:45`, `00:01`, `14:22`, `00:18`), on a continuous thin spine, closed by a **`Total Runtime 15:41`** footer.

### 2. What the shipped chat run surface can do today

- `chat/RunCard.tsx` renders a **RUN-LEVEL** elapsed figure, and renders it *honestly*: a live tick from a stable `Date.parse(message.created_at)` baseline, frozen at a true terminal, and **`hasElapsed` gates the whole segment** so a finished run with no persisted end-time shows **no duration at all** rather than a current-clock fabrication (the D-095.1-05 rule).
- It carries **no phase spine and no per-step row**. The chat↔panel split (D-094-UNIFY) is deliberate: chat = prompt + final answer + a quiet pointer; the panel owns execution legibility.
- The panel spine (Col 2) has the rows, and **no timing on any of them**.

### 3. The gap — the missing value, and where it would have to come from

**The missing value is a per-phase START timestamp.** Measured, not assumed:

| Candidate source | Measured | Verdict |
|---|---|---|
| `Phase` (`frontend/src/types/index.ts:1018`) | fields are `slug · phaseIndex · phaseType · status · attempt · error · subAgents · pendingAsk · emitSubStep · emitFailure` | **no timing field at all** |
| `WorkflowRunPhase` (`frontend/src/lib/api.ts:4178`) — the durable per-phase feed | `slug · phase_index · status · phase_type` | **no timestamps** |
| SSE `phase_started` (`harness_engine.py:1589`) | emits `phase`, `phase_index`, `phase_type` | **no timestamp on the wire** |
| `workflow_phases` table | has `created_at` / `updated_at`, and **no `started_at` / `completed_at`** | ⚠ **the trap** — `db/workflows.py:286` inserts **one row per PhaseSpec at RUN creation**, so `created_at` is identical for every phase. A duration derived from it is *cumulative from run start*, not per-step: **a number that looks right and is wrong** |
| `harness_audit` table | `event_type ∈ {phase_started, phase_completed, …}` **with a `created_at` per row** | ✅ **the value EXISTS in the database** — and reaches no frontend route |
| `workflow_runs` | has **neither** `started_at` nor `completed_at`; the only honest elapsed anchor is `updated_at − claimed_at`, at the RUN level (recorded verbatim at `api.ts:4205`) | run-level only |

**So the gap is exactly one hop, and it is a BACKEND hop.** `harness_audit` records `phase_started` and `phase_completed` with timestamps; nothing exposes them. Building Col 3 requires a new read route over `harness_audit` (or a `started_at`/`completed_at` pair added to `workflow_phases` and written by `mark_phase_active` / the completion writers) — **a migration and/or an endpoint, which this phase's scope fence forbids outright.** Faking it from `created_at` is the one thing that must not happen.

### Routing and re-open trigger

- **Routed to:** a named future phase on the **run-receipt / run-honesty** surface — NOT to a gap-closure round of 199 (G-7: a new user-facing capability is a phase, not a gap).
- **Re-open trigger:** *the first phase that adds per-phase timing to the wire* — i.e. any change that puts `started_at`/`completed_at` on `workflow_phases`, or opens a read route over `harness_audit`'s `phase_started`/`phase_completed` rows. On that commit, Col 3 becomes buildable and this report is its specification.
- ⚠ **And a placement caveat that must survive the deferral:** sketch 178's own README records that the panel is a **cross-surface shell mounted by `ChatLayout`** — so a receipt built on the chat surface *lands in chat first* and must be UAT'd there, never only on the workflow surface.

---

## Deviations from Plan

### Auto-fixed / corrected

**1. [Rule 1 — a plan acceptance criterion that was already false at HEAD] `tsc` errors under `components/panel/` and `components/workflows/`**

- **Found during:** Task 2 (baseline taken before any edit)
- **Criterion as written:** *"`npx tsc --noEmit -p tsconfig.app.json` reports 33, the baseline, with ZERO under `components/panel/` or `components/workflows/`."*
- **Measured:** the total is **33 at HEAD and 33 after this plan** ✅ — but **6 of those 33 already live under `components/panel/`**, at HEAD, before this plan touched anything: 3 × `TS2304 Cannot find name 'WorkspaceFile'` in `__tests__/FilesSection.test.tsx` and 3 × `TS2783` in `FilePreview.test.tsx`. All six are in FILES-surface test files and none is in a file this plan modified.
- **Resolution:** the criterion is **corrected, not waived** — the honest form is *"33 unmoved, and ZERO in the four files this plan touches."* Both hold. Recorded rather than silently passed, because a criterion that was unmeetable on arrival is a planning fact worth carrying forward.
- **Commit:** n/a (no code change)

### Declined with reasons (Rule 4 territory, resolved by declining rather than asking)

**2. `PhaseTimeline`'s doing-now line and `PhaseCard`'s active-step type one-liner** — both are genuine "text is noise" candidates and both were **declined**. The doing-now line duplicates the bloomed active card's own slug and word on a 380px surface; but WR-05 and 194-04 planted **five** shipped assertions specifically to prove that line routes through the vocabulary table, and 127-03 planted three on the one-liner. Cutting either required **deleting an assertion**, which this plan forbids and which is the exact "re-baseline a pin to turn red green" trap. Both are recorded here as named candidates for a future refactor phase rather than left unmentioned.

---

## Verification

| Gate | Result |
|---|---|
| `git diff --stat -- backend supabase` | **EMPTY** — asserted at every task |
| `npx tsc --noEmit -p tsconfig.app.json` | **33**, unmoved (see the correction above) |
| The four in-scope suites | **4 files / 103 tests, 0 failing** (baseline 94 → +9, arithmetic closes with no residual) |
| `PhaseSpineGraph` consumers (`WorkflowBuilderPage.test.tsx`, `WorkflowBuilderPage.canvas.test.tsx`, `PhaseSpine.test.tsx`) | **3 files / 180 tests, 0 failing** |
| `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | **`count gate OK` — 96/96 pinned files present, no per-file decrease, 0 failing · total 4699 · pinned total 4543** |
| **Zero assertions deleted** | **`git diff --numstat <base> HEAD` → `PhaseCard.test.tsx 171/0`, `PhaseSpineGraph.test.tsx 104/0`** — both `+N/−0`. The inversions edited only lines this plan's own first commit authored |

### ⚠ The count-gate figures are a FIFTH re-measurement, and they are recorded beside CLAUDE.md's, never over them

CLAUDE.md's most recent correction (2026-08-19, Phase 192.2) reads **4594 / 4328 / 92**. Measured here, from the repo root, cap 2, verdict line read verbatim: **4699 / 4543 / 96/96**. **A growing number is the gate WORKING** — its contract is *no per-file decrease* and *zero failing*, never a fixed grand total.

**This plan's own share is `+9` and it is fully attributed**: `PhaseCard.test.tsx +5`, `PhaseSpineGraph.test.tsx +4`. ⚠ The gate also printed `PhaseTimeline.test.tsx 17 → 28 (+11)` and a grand `+156`; **none of that is this plan's, and the proof is mechanical rather than asserted** — `git diff --numstat` against the dispatched base names exactly four files and `PhaseTimeline.test.tsx` is not one of them. Those deltas are **pre-existing pin staleness at the base commit**, which is precisely the "re-derive rather than doubt it" instruction working.

### The cap was neither adjusted nor needed

`GSD_VITEST_MAX_WORKERS=2` held on **every** run (5 invocations), with a sibling agent active, and **nothing red ever appeared** — so SEED-171's triage procedure was never entered. Recorded as an observation, **not as proof of innocence**: `WorkflowBuilderPage.canvas.test.tsx` (SEED-171's fifth named suite) sits inside this plan's blast radius — it wraps the REAL `PhaseSpineGraph` through `vi.importActual` — and was green on the first run of every invocation. **Provably unmodified**, not "fine".

---

## Known Stubs

None. This plan added no component, no data source and no placeholder; its whole source diff is `+42 / −7` across two files and is entirely removal-and-comment.

## Threat Flags

None. No network endpoint, auth path, file access pattern or schema touched — the scope fence (`git diff --stat -- backend supabase` EMPTY) is the mechanical proof. The plan's three registered threats are dispositioned:

| Threat ID | Disposition | Evidence |
|---|---|---|
| T-199-02-01 (Tampering · `PhaseCard.tsx`) | **mitigated** | failure copy still comes from the shipped closed taxonomy — untouched by this plan; no `dangerouslySetInnerHTML` introduced (the diff is two `className` ternary arms and their comments) |
| T-199-02-02 (Repudiation · live spine) | **mitigated** | the forward-only counter, the reconcile floor and `PhaseTimeline.tsx` itself are **byte-unchanged** — the numstat is the proof. Nothing was added that could claim progress the run did not report; the plan's whole direction was subtraction |
| T-199-02-03 (EoP · scope fence) | **mitigated** | asserted EMPTY at every task; Task 3 built nothing, and touched no file under `frontend/src/components/chat/` |

## Hot-file ledger note (same-commit sync rule)

`frontend/src/components/panel/PhaseCard.tsx` carries a G-5-FIRING row. This plan **honoured it by construction**: the change is two `className` ternary arms, and ⚠ **`SUBSTEP_META` stays TOTAL over `EmitSubStep`** — its own-property `subStepMeta` fallback and every one of the seven declared members are byte-unchanged, which the suite's `it.each(SUBSTEPS)` sweep (7 members, including `model_fallback`) re-proved on every run. `frontend/src/components/workflows/PhaseSpineGraph.tsx` has **no ledger row** and measures `commits 12 / phases 6 / lines 278` — ⚠ **it is above the G-5 threshold and invisible to its own guardrail**, the same failure eleven files were found in at Phase 196. A row is owed; it is not added here because the ledger is a shared artifact and a sibling agent is executing in the same wave (the `197-10` precedent — correctly declining to edit a shared artifact mid-wave). **Re-open trigger: the orchestrator's post-wave ledger sync for Phase 199.**

## Self-Check: PASSED
