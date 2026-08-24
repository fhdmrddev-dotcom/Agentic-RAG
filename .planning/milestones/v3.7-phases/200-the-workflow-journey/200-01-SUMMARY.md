---
phase: 200
plan: 01
subsystem: planning
tags: [acceptance-bar, checklist, baselines, g5, sketch-200]
requires: []
provides:
  - ".planning/phases/200-the-workflow-journey/200-CHECKLIST.md — the acceptance bar for plans 200-02…200-07"
  - "the phase's own count-gate / backend / tsc / migration baselines"
  - "fourteen G-5 triples re-derived from git, with four ledger-row owners assigned"
affects:
  - "200-02 (api.ts decline proof, migration 121, the RED-before backend case, its owed ledger row)"
  - "200-03 (the phase_types.py extraction)"
  - "200-04 (§1 step-panel, 14 atoms)"
  - "200-05 (§2 builder-spine, 12 atoms + the two-tense rule)"
  - "200-06 (§3 builder-canvas, 10 atoms + its owed ledger row)"
  - "200-07 (§4 run-surface, 13 atoms + two owed ledger rows)"
tech-stack:
  added: []
  patterns: ["characterization-baseline discipline applied to acceptance criteria (D-03)"]
key-files:
  created:
    - .planning/phases/200-the-workflow-journey/200-CHECKLIST.md
  modified: []
decisions:
  - "X-2 REFUTED: the llm_judge_rubric glyph gap does not exist — 7 phase types, 7 PHASE_GLYPHS keys; it is a ValidatorSpec.kind"
  - "X-2b: RESEARCH names THREE documents carrying that false claim; ROADMAP measures ZERO hits, so it is TWO"
  - "X-13 re-measured: friendlyToolName has 5 entries against 28 offered tool ids, and only 3 can ever fire"
  - "RS-3 split into RS-3a (BUILD, in slice) and RS-3b (REPORT, sub-step trace) — discharges RESEARCH R3"
  - "BS-4 and BC-1 recorded as LEDGER-DERIVED, not screen-derived — discharges RESEARCH R2"
  - "Six-digit dated quick tasks subtracted from every G-5 phase count, correcting RESEARCH X-7 (11→10) and X-8 (101→99)"
metrics:
  duration: ~55 min
  tasks: 3
  commits: 3
  files_created: 1
  source_files_modified: 0
  completed: 2026-08-19
---

# Phase 200 Plan 01: Derive the Acceptance Checklist Summary

**The acceptance bar for four screens — 49 uniquely-id'd atoms, a six-row REPORT register and the
phase's own re-derived gate baselines — committed with a provably empty source diff.**

## What was built

`.planning/phases/200-the-workflow-journey/200-CHECKLIST.md` (723 lines), in three commits that
together modify **zero source files**.

| § | Content |
|---|---|
| preamble | how to cite row ids · the D-02 colour→verdict table verbatim · the screen→plan map |
| §0 | eight known sketch defects (N-1…N-8) with the correction written in, plus two more measured here (N-9, N-10) |
| §0.2 | four refutations — X-2, X-6, X-13, X-14 — plus X-2b |
| §0.3 | the R2 derivation-provenance paragraph |
| §1–§4 | four per-screen `MUST RENDER` / `MUST NOT RENDER` inventories, 49 atoms |
| §5 | the REPORT register (6 rows, each with a named `Trigger:`) + §5.1 AUTHORED COPY + §5.2 the census |
| §6 | the phase baselines, the 14-row G-5 table, the SEED-171 triage, and the D-03 proof |

**Atom census, verified by grep against the document rather than asserted:**

| § | Screen | MR | MNR | total | owning plan |
|---|---|---|---|---|---|
| §1 | `step-panel` | 7 | 7 | 14 | `200-04` |
| §2 | `builder-spine` | 6 | 6 | 12 | `200-05` |
| §3 | `builder-canvas` | 5 | 5 | 10 | `200-06` |
| §4 | `run-surface` | 6 | 7 | 13 | `200-07` |
| | | **24** | **25** | **49** | |

## Commits

| # | Hash | What |
|---|---|---|
| 1 | `51d1efdd` | §0 — the eight defects and four refutations |
| 2 | `25b11850` | §1–§5 — 49 atoms and the REPORT register |
| 3 | `13dedaef` | §6 — the phase baselines |

**Base SHA asserted before reading the plan:** the worktree forked from
`3781a3fe4690a9619e619f4cc412bd37a7dafc52` and was `reset --hard` to the dispatched base
`393963cd0c191bf360474df48868e8f0dc05d7c7` per the branch-check protocol. ⚠ **The plan's own
`<execution_context>` says this phase was planned at `fe40ce1ce6af06ae3735aa98a539f0f4463abbdf`;
the orchestrator dispatched `393963cd` instead.** `393963cd` is the later commit — it is the
`BUG-260813-01` addendum this plan's binding constraint #7 requires — so the dispatched base is the
correct one and the plan text is the stale reference. Recorded rather than silently reconciled.

## THE D-03 PROOF — pasted verbatim

```
$ git show --name-only --format= HEAD
.planning/phases/200-the-workflow-journey/200-CHECKLIST.md

$ git show --name-only --format= HEAD | grep -v '^\.planning/' | grep -c .
0
```

Over the whole plan rather than only its last commit:

```
$ git diff --name-only 393963cd..HEAD
.planning/phases/200-the-workflow-journey/200-CHECKLIST.md

$ git diff --name-only 393963cd..HEAD | grep -v '^\.planning/' | grep -c .
0

$ git log --oneline 393963cd..HEAD
13dedaef docs(200-01): CHECKLIST §6 — the phase baselines, re-derived not inherited
25b11850 docs(200-01): CHECKLIST §1-§5 — 49 atoms across four screens, and the REPORT register
51d1efdd docs(200-01): CHECKLIST §0 — the eight sketch defects and four refutations
```

**One file, three commits, zero source paths.** The acceptance bar was fixed before a byte of the
implementation existed, so it cannot have been shaped by it.

## The phase baselines — re-derived, and what each confirms or corrects

### Count gate — CONFIRMS RESEARCH, CORRECTS CLAUDE.md

```
  total                                      4543    4970    +427
  total 4970  ·  failed 0  ·  pinned total 4543
count gate OK — 96/96 pinned files present, no per-file decrease, 0 failing.
```

Run from the worktree root at `GSD_VITEST_MAX_WORKERS=2`, with a sibling agent active, `failed 0` on
the **first** run. **This matches `200-RESEARCH.md` §D17 exactly** on a second independent run in a
different working tree — which is the strongest form the confirmation could take.

CLAUDE.md publishes `4594 · 4328 · 92/92`, **the FIFTH rot of this constant and the same day the
fourth was written**. Published trajectory: `4170` (08-17) → `4594` (08-19) → **`4970`** (08-19,
later). **Every later plan in this phase compares against `4970`, not against CLAUDE.md**, and a
bigger number is the gate working.

### Backend

```
tests/unit -q                              ⇒ 62 failed, 2350 passed, 2 xfailed, 2 xpassed, 32 warnings in 74.23s
the six wire-slice suites -q               ⇒ 1 failed, 121 passed, 3 warnings in 7.12s
FAILED tests/test_thread_workflow_endpoint.py::test_thread_workflow_state_shape
```

⚠ **That one failure is RED-BEFORE and is IN the blast radius** — it asserts the very
`ThreadWorkflowState` shape `200-02` widens (`assert body["locked"] is True` → `assert False is
True`). Named in §6.3 so it can never be attributed to this phase, and so that turning it green is a
deliberate change to explain rather than an incidental one.

### tsc and the migration number

```
npx tsc -p tsconfig.app.json --noEmit      ⇒ exit 2 · 33 errors across 19 files
ls supabase/migrations/ | sort -V | tail -1 ⇒ 120_model_capabilities_overrides_emit_tier.sql
```

**Zero of the 33 are in any of this phase's ten G-5 targets or four render files.** The criterion for
later plans is `33 / 19` **unmoved**, not "clean". Next free migration is **`121`**.

### G-5 — fourteen triples, and the finding is an ABSENCE

The table is in §6.6. Two things came out of it that the plan did not predict:

1. ⚠ **FOUR files owe hot-file-ledger rows and are ABSENT from BOTH CLAUDE.md and
   `docs/HOT-FILE-LEDGER.md`** — measured by grep against both files, which returned **zero** matches
   for all four. D-16 named one (`backend/app/api/workflow_runs.py`); X-16 found four; this plan
   confirms four. **`frontend/src/components/panel/PhaseTimeline.tsx` FIRES G-5 at five phases and has
   no row at all**, so the guardrail could never have fired on it at any count. Owners assigned:
   `workflow_runs.py` → `200-02` · `FlowEdge.tsx` → `200-06` · `PhaseTimeline.tsx` +
   `phaseStatusMeta.ts` → `200-07`, each in the **same commit** that modifies the file.
2. ⚠ **RESEARCH's own corrections X-7 and X-8 are themselves corrected**, and the reason is
   methodological rather than careless: both include **six-digit dated quick-task buckets** that
   CLAUDE.md's recipe says to subtract. `PhaseFormPanel.tsx`'s raw bucket list is
   `103 155 183 184 185 189 193 193.1 196 199 260814` — **11 raw, `260814` is a quick task ⇒ 10
   phases** (X-7 says 11). `api.ts` carries `260405` **and** `260814` — **101 raw ⇒ 99 phases** (X-8
   says 101). **Both verdicts are unchanged; both still FIRE.** What is corrected is the figure.

## The findings that will change how later plans work

### X-2 — the `llm_judge_rubric` glyph gap DOES NOT EXIST, and it is in TWO documents, not three

Seven phase types (`phase_types.py:2398-2410`; `models/harness.py`'s seven-member `PhaseConfig`
union) and seven `PHASE_GLYPHS` keys (`soulData.ts:57-65`). The map is **TOTAL**.
`llm_judge_rubric` is a **`ValidatorSpec.kind`** (`models/harness.py:350`,
`validator_kinds.py:500`) — a gate attached to a phase, with no node and therefore no glyph.
**No later plan may open work against it.**

⚠ **X-2b, measured here:** RESEARCH §C16 says THREE documents carry the false claim and names
`.planning/ROADMAP.md` as the third. `grep -n "llm_judge_rubric" .planning/ROADMAP.md` returns
**zero hits**, and the Phase 200 entry (`ROADMAP.md:892-960`) contains no glyph claim at all. The
correction is owed to **two** files — `200-CONTEXT.md:426` and `:450`, and
`FORWARD-CHECK.md:31`. Recorded because a later plan hunting a ROADMAP edit would find nothing and
could not tell whether it had already been done.

### X-13 — SP-1's numbers re-measured, and a third fact the ledger row does not contain

| | measured |
|---|---|
| `friendlyToolName` map entries (`PhaseFormPanel.tsx:874-882`) | **5** |
| tool ids the author is actually offered (`get_tools(None)` → `grounding.py:476,521` → `rails.toolOptions`) | **28** |
| map entries that name an actually-offered id | **3** (`execute_code` · `read_document` · `search_documents`) |
| ⚠ **DEAD map entries** — named but never offered | **2** — **`fetch_url`** and **`list_folders`** |
| human-named phrases the SKETCH draws | **12** |

⇒ **SP-1's real numbers are 5 / 28, of which only 3 can ever fire.** The inherited *"3 of 27"* was
right on the numerator by coincidence and wrong on the denominator. The measurement was executed, not
read: `venv/Scripts/python.exe -c "from app.services.openai_service import get_tools; …"`.

⚠ **The two dead entries are their own small finding** — a map row naming an id the server never
offers is invisible until someone counts, exactly like a hot-file row that is present and wrong.
`SP-MNR-07` makes deleting or re-pointing them an atom `200-04` owns.

### The two-tense rule — §2's whole shape, and a contradiction inside CONTEXT resolved

`PhaseSpineGraph` reads a **draft definition** and has **no run**. `199-02` refused run-time words on
it, and the hot-file ledger records the refusal. CONTEXT's `<specifics>` nevertheless says the slice
*"clears the spine's per-step timings."* **Both cannot be true of the same component in the same
mode.** §2 encodes D-09's reconciliation as structure rather than prose: every atom is tagged
`[authoring]` or `[run-tense]`, the run-tense ones ride an **OPTIONAL prop whose absence must produce
a byte-identical authoring render** (`BS-MNR-05` is that fence), and the receipt mounts on
`WorkflowRunPage.tsx` — which keeps 199-02's refusal intact **by construction** rather than by care.

### BC-MR-05 — the canvas light-mode atom, and why it needs TWO assertions

Folded in from binding constraint #7 (the `BUG-260813-01` addendum committed at `393963cd`).
`PhaseNodeCard.tsx` hardcodes **nothing** — `bg-card/30`, `text-foreground`, `border-border/50` are
all tokens. React Flow puts `colorModeClassName`, the literal string `"dark"`, on its wrapper
(`@xyflow/react/dist/esm/index.js:3736` via `useColorModeClass` `:334-349`), and `tailwind.config.js`
is `darkMode: ["class"]`, **scoped by the nearest ancestor**. So one prop wraps the whole subtree and
the single-prop fix is complete — **but its completeness is a coincidence of two unrelated mechanisms
agreeing on the spelling `dark`, which nothing documents or enforces.** `BC-MR-05` therefore requires
the **plane AND at least one node card** asserted in light mode; a fence checking only
`colorMode={theme}` in source would pass green if they ever diverged. The prop is at
`WorkflowCanvas.tsx:1317` — the report's `:1250` is stale by 67 lines.

## Deviations from Plan

### 1. [Rule 3 — blocking] Worktree base corrected before any read

The worktree forked from `3781a3fe`, not the dispatched `393963cd`. The branch-check protocol's
`reset --hard` arm ran and HEAD was verified at `393963cd` before the plan was read. Recorded because
"worktrees fork from the WRONG base" is a known repeat failure (twelve of twelve in Phase 192).

### 2. [Rule 2 — missing critical detail] Two extra sketch readings recorded as N-9 / N-10

The plan asked for eight defects; §0.1 adds two **readings** (not defects) that a later plan would
otherwise re-discover: the run-surface spine draws **five** steps and exactly **one** time (`00:15`),
so `RS-MR-02` is partly ledger-derived in the same sense as `BS-4`; and the step panel draws **twelve**
human-named tool phrases, which is the target vocabulary size `SP-MR-01` aims at. Both are labelled as
readings, not defects, so neither can be mistaken for something to correct.

### 3. [Rule 2] The screen→plan map is published, because CONTEXT's is stale

CONTEXT's `<specifics>` still lists the approved **six**-plan shape (`200-03 the step panel` …
`200-06 the run surface`). The shipped shape is **seven** — RESEARCH R1 split the backend, and every
screen plan shifted by one. The preamble publishes the correct map and says explicitly *"cite the
table above, never CONTEXT's list"*, because every atom in §1–§4 carries an owning plan id and a wrong
map would mis-assign all 49.

### 4. [Rule 2] X-2b added — RESEARCH's own document count was one too many

See above. Not in the plan's task list; recorded because leaving it would have sent a later plan
hunting a ROADMAP edit that was never owed.

### 5. [Rule 2] The G-5 phase counts apply the six-digit filter, correcting X-7 and X-8

See above. The plan said to use CLAUDE.md's published recipe and CLAUDE.md's rule says to subtract
dated quick tasks; RESEARCH's figures did not. Applying the rule as written changes two figures and
no verdicts.

### 6. Scope held — nothing outside `.planning/` was touched

Four things this plan **could** have fixed and deliberately did not, because D-03 forbids it:
correcting the `llm_judge_rubric` claim in `200-CONTEXT.md` / `FORWARD-CHECK.md`; adding the four
missing hot-file-ledger rows; correcting `icon-convention.md` §4's *"6 workflow phase types"* (X-15);
and deleting `friendlyToolName`'s two dead entries. **Each is recorded in the checklist with an owner
instead.** The ledger rows in particular are bound by CLAUDE.md's same-commit sync rule to the commit
that modifies the file, so adding them here would itself have been the drift.

## Known Stubs

None. This plan produces a planning document; it wires no data and renders no UI.

## Threat Flags

None. This plan reads no secrets, touches no runtime surface, and its `git diff --name-only` over
the whole plan contains one path, under `.planning/`.

## Self-Check: PASSED

**File exists:**
```
$ [ -f .planning/phases/200-the-workflow-journey/200-CHECKLIST.md ] && echo FOUND
FOUND   (723 lines)
```

**Commits exist:**
```
$ git log --oneline 393963cd..HEAD
13dedaef  FOUND
25b11850  FOUND
51d1efdd  FOUND
```

**Plan acceptance criteria, each re-run against the finished document:**

| Criterion | Result |
|---|---|
| first `##` heading is `## §0 KNOWN SKETCH DEFECTS` | ✅ |
| ≥ 8 `N-1…N-8` defect rows | ✅ **8** |
| `X-2` `X-6` `X-13` `X-14` all present | ✅ |
| `BS-4` + `BC-1` within 10 lines of `LEDGER-DERIVED` | ✅ (same line) |
| `3 of 27` appears only on lines also containing `stale` | ✅ **0** violations |
| `Material Symbols` present | ✅ |
| ≥ 12 unique `(SP\|BS\|BC\|RS)-(MR\|MNR)-nn` ids | ✅ **49** |
| ≥ 4 `MUST NOT RENDER` | ✅ **7** |
| ≥ 5 `Trigger:` | ✅ **7** |
| `RS-3a` and `RS-3b` in different verdict columns | ✅ (BUILD / REPORT) |
| `READ_ONLY_LEGEND` on a line also containing `RENDERED DOM` | ✅ |
| every atom row carries an owning plan `200-0[4-7]` | ✅ **0** rows without one |
| `count gate OK` + `pinned total N` pasted verbatim | ✅ |
| `test_thread_workflow_state_shape` named as RED-before | ✅ |
| `SEED-171` + the never-adjust-the-cap rule | ✅ |
| ≥ 14 G-5 rows with owners for the four owed | ✅ **14** |
| `git show --name-only --format= HEAD` outside `.planning/` = 0 | ✅ **0** |
| artifact `min_lines: 200` | ✅ **723** |
| artifact `contains: "MUST NOT RENDER"` | ✅ |
| key_link pattern `(SP\|BS\|BC\|RS)-[0-9]` | ✅ **47** lines |
