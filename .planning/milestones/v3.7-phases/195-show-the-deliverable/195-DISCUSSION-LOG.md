# Phase 195: Show the Deliverable - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 195-show-the-deliverable
**Areas discussed:** Area selection + guardrails, What counts as "the deliverable", Which presentation wins, The many-files reading (SC#3), How far across surfaces, SC#1 status

---

## Pre-discussion measurement (the ROADMAP's "first task is measurement" flag)

Run at discuss-phase rather than deferred to planning, because the flag says backend-vs-frontend
scope is unknown until it is answered. Result: the wire is fine, the run surface already shows
files, and the phase is a consolidation, not plumbing. Full working in CONTEXT.md `<domain>`.

Guardrails surfaced before any option was offered: **G-5 fires** (five files; two absent from the
ledger), **G-2 fires** (visual surface), **G-7 not in play** (zero gap-closure rounds).

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| What counts as "the deliverable" | Run-scope vs thread-scope; the one that could add backend scope | ✓ |
| Which presentation wins | RUN-03 / the OutputFileCard coupling | ✓ |
| The many-files reading (SC#3) | The retired hero/working split | ✓ |
| How far across surfaces | Run page only vs chat + panel | ✓ |

**User's choice:** all four.

---

## G-2 routing

| Option | Description | Selected |
|--------|-------------|----------|
| No sketch — reuse shipped | RUN-03 forbids new file UI; presentation already design-reviewed | ✓ |
| Sketch just the many-files case | One narrow sketch for the post-095.1 multi-file reading | |
| Full sketch of the deliverable region | Honours G-2 literally; risks re-deriving what RUN-03 says to reuse | |

**Notes:** G-2 declined deliberately and recorded as a decision (D-18), not skipped silently. The
one genuinely open visual question was decided in discussion instead (D-10).

---

## BUG-260816-05 fold

| Option | Description | Selected |
|--------|-------------|----------|
| File half only — ask stays 198 | Ask-responder is new capability; NODE-02/198 already scoped to it | ✓ |
| Take both — mount the responder here too | Data half already solved on the page (asks + reconcileAsks) | |
| File half, plus fold BUG-260813-01 | Add the canvas light-mode fix as a G-3 fast-fix | |

**Notes:** The report's `re_open_trigger` named this phase explicitly and asked the question. The
arm has now FIRED and been ANSWERED — recorded in the report's frontmatter so the ask half stays
visible to Phase 198. Report status left `deferred`, deliberately not `folded`, because a `folded`
record is invisible to the open-report routing scan.

---

## What counts as "the deliverable"

**Q1 — scoping**

| Option | Description | Selected |
|--------|-------------|----------|
| Thread-scope + honest label | Keep the existing read; stop claiming it is "what this run produced" | ✓ |
| Add real run attribution | New run_id column + backend writes on two paths | |
| Time-window filter | created_at between started_at/finished_at | |

**Notes:** Decided against the DB: 226 runs / 222 threads; histogram 0→161, 1→60, 20→1. Thread-scope
is exact for 60 of 61 file-bearing runs. Attribution would also strand all 86 existing rows at NULL.

**Q2 — inputs vs outputs**

| Option | Description | Selected |
|--------|-------------|----------|
| No distinction — one list | Template and deliverable read identically | ✓ |
| Distinguish using the existing `kind` column | kind exists but is NULL on 84/86 rows | |
| Deliverable-only, hide inputs | Requires the attribution just declined | |

**Q3 — the 161 file-less runs**

| Option | Description | Selected |
|--------|-------------|----------|
| Expected — out of scope | Cancelled/failed runs, or no llm_emit phase | ✓ |
| Measure it first, then decide | Correlate against run status + definition | |
| Chase it — treat silent loss as in scope | Widens 195 into emit-path reliability | |

**Notes:** Recorded in CONTEXT as an ACCEPTED BLIND SPOT (D-04), not as a proven absence.

---

## Which presentation wins

**Q1 — how to satisfy RUN-03**

| Option | Description | Selected |
|--------|-------------|----------|
| Extract one shared FileRow | Discriminated source: sandbox url \| workspace threadId+fileId | ✓ |
| Widen OutputFileCard itself | Fewer new files; deepens the chat coupling | |
| Minimal — kill the icon duplication only | One small diff; leaves three visibly different rows | |

**Notes:** The deciding measurement was that OutputFileCard renders a url-less file as a DEAD LINK
("Download unavailable"), and workspace files have no url at all — so a naive reuse would present
every workflow deliverable as broken.

**Q2 — home and blast radius**

| Option | Description | Selected |
|--------|-------------|----------|
| New home; convert all three | components/files/ — neutral ground; one presentation at close | ✓ |
| New home; convert the run page only | Leaves the duplication with a sanctioned original | |
| Put it in components/chat/ | Same mis-homing that produced this phase | |

**Q3 — preview**

| Option | Description | Selected |
|--------|-------------|----------|
| Hold — download only | Keeps Phase 188-10's rule; .docx cannot be previewed in-app anyway | ✓ |
| Add preview, matching the panel | FilePreview handles text/markdown, not the dominant .docx case | |
| Download primary, open-in-panel secondary | Second affordance + a surface hand-off mid-task | |

**Notes:** Creates a deliberate asymmetry (the panel row DOES open a preview), so the shared row
must parameterise activation rather than hardcode it.

---

## The many-files reading (SC#3)

**Q1 — the reading**

| Option | Description | Selected |
|--------|-------------|----------|
| One uniform quiet list | Follow shipped code (095.1 reversal), not the stale criterion | ✓ |
| Revive the hero split here | Honours SC#3 literally; re-introduces a reversed pattern | |
| Uniform now, hero when it earns it | Uniform plus a recorded revisit trigger | |

**Notes:** 60 of 61 file-bearing runs have exactly one file, and the workspace-file path carries no
hero signal at all — reviving it would mean inventing one for a population of one.

**Q2 — the stale records**

| Option | Description | Selected |
|--------|-------------|----------|
| Correct both, beside the original | ROADMAP SC#3 + the sketch-findings reference | ✓ |
| Correct SC#3 only | Leaves the design record telling the next phase to build a hero block | |
| Correct neither — satisfy by interpretation | A tick resting on an unwritten interpretation | |

**Q3 — ordering**

| Option | Description | Selected |
|--------|-------------|----------|
| Newest first | created_at DESC; deliverable above the template it filled | ✓ |
| Path / alphabetical | Template can sort above the deliverable | |
| Whatever the API returns | Ordering becomes an unstated, untested backend property | |

---

## How far across surfaces

**Q1 — the chat half**

| Option | Description | Selected |
|--------|-------------|----------|
| Run surface only — chat unchanged | RUN-02 is scoped "from the run surface" | ✓ |
| Fix RunCard's blind badge too | Closes a measurable lie; opens two hot files | |
| Full chat parity — receipt lists the files | Widest blast radius; duplicates the panel | |

**Notes:** Recorded in CONTEXT as a MEASURED LIE the phase declines (D-14), with a re-open trigger —
not as an unknown. Also flagged that D-07 ("convert all three") and D-13 ("chat unchanged") are
compatible and must not be conflated: presentation converts, capability does not.

**Q2 — empty states**

| Option | Description | Selected |
|--------|-------------|----------|
| Keep exactly as shipped | Three-way honesty; the most-seen state (161 of 222 runs) | ✓ |
| Keep the wording, add a pointer | Speculative for runs that were simply cancelled | |
| Re-decide the copy | Reopens a decision that measured well | |

**Q3 — acceptance evidence**

| Option | Description | Selected |
|--------|-------------|----------|
| Real run, canvas, download, open it | G-4 lived-experience bar, driven not owed | ✓ |
| Also re-run the 20-file thread case | Exercises presentation but not a workflow deliverable | |
| Wire + screenshot evidence is enough | Repeatedly recorded as insufficient (192, 193.1, 194) | |

---

## SC#1 status

| Option | Description | Selected |
|--------|-------------|----------|
| Record as already-true, verify first | Prove the baseline on a live run before changing anything | ✓ |
| Treat SC#1 as unproven until UAT | Planner sizes the phase blind to what 188 shipped | |
| Declare SC#1 satisfied now | Source + DB is exactly the evidence that misses what a person sees | |

---

## Claude's Discretion

- The exact component/file name and prop shape of the shared row (`FileRow` is a suggestion).
- Whether it is one component with an activation prop or a thin wrapper per surface.
- The exact wording of the honest region label (D-02).
- Test placement and how the count-gate delta is re-measured.

## Deferred Ideas

- Run-level file attribution on `workspace_files` (re-open: mixed chat/workflow threads become common).
- `RunCard`'s file badge reading 0 for a workflow deliverable; `ThreadRunLine` showing no file at all.
- Retiring the still-written, never-read `is_hero` backend field.
- Office/PDF in-panel preview — its trigger FIRED here and the deferral was knowingly renewed.
- The ask-responder mount on the run surface (Phase 198 / NODE-02).
- `BUG-260813-01` (canvas dark in light mode) — reviewed, offered, not folded; stays `open`.
- `lib/fileIcons.tsx` / `getFileIcon` on the documents surface — a fifth icon path, explicitly not swept.
