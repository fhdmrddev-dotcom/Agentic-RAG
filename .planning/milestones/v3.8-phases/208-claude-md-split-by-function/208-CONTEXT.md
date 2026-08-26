# Phase 208: CLAUDE.md split by FUNCTION — Context

**Gathered:** 2026-08-25
**Status:** ⚠ **WRITTEN AFTER EXECUTION — see the process deviation below.**
**Source:** `.planning/ROADMAP.md` row 208 (escalated by `206.2-04` on 2026-08-25),
`CLAUDE.md` → `## CLAUDE.md context budget (MANDATORY)`, and direct measurement of the file at HEAD.

---

## ⚠ PROCESS DEVIATION — this phase ran with NO GSD ceremony, and that is recorded, not excused

**`/gsd:discuss-phase`, `/gsd:plan-phase` and `/gsd:execute-phase` were NOT run.** The phase was
executed directly from the ROADMAP row, and this CONTEXT, its SUMMARY and its VERIFICATION were all
authored **after** the work landed, from the real commit and the real measurements.

**The operator caught this, not the process** — which is the finding worth keeping. Nothing in the
loop objected: the ROADMAP row existed, the commit landed, `STATE.md` was updated, and every gate was
green. **A phase can therefore be executed to completion, with correct outcomes and honest gate
evidence, while leaving `/gsd:progress` and every future forensic pass with nothing to read.**

- **What this cost:** no `D-208-NN` decision records at plan time, no plan-checker pass, no
  `files_modified` declared in advance (so no ledger scan ran against it), and no independent
  verification separate from the executor.
- **What it did NOT cost:** the outcome record. `CLAUDE.md`, `docs/HOT-FILE-LEDGER.md`, the ROADMAP
  row and `STATE.md` were all updated in the same commit, and every claim below is backed by a
  measurement taken at the time.
- **Recorded as a guardrail override** under `STATE.md → Guardrail overrides`, per CLAUDE.md's
  orchestrator protocol: *"Never silently apply OR silently skip — every fire is either honored or
  audited."* This is the audit.

---

<domain>

## Phase Boundary

`CLAUDE.md` is loaded verbatim into the system prompt of **every session and every subagent**, and
Claude Code refuses to load it over **150,000 characters** — at which point every instruction in it
silently stops applying, to every agent, everywhere. The repository has already been in that state,
unnoticed, for three commits.

**Measured at this phase's base (2026-08-25):**

| | chars | % of hard limit |
|---|---|---|
| `CLAUDE.md` total | **135,662** | 90.4% |
| `## Workflow guardrails (MANDATORY)` | 87,836 | 65% of the file |
| the hot-file ledger TABLE inside it | 74,881 | 55% of the file |
| **the table's DISPOSITION COLUMN alone** | **60,558** | **45% of the file** |

⚠ **The column is the mechanism, and it was measured rather than assumed.** 115 rows, whose
Disposition cells had each grown from a verdict into paragraphs.

### In Scope

1. **Move every disposition cell's narrative** into that file's own section in
   `docs/HOT-FILE-LEDGER.md`, **verbatim** — a move, never a rewrite or a summary.
2. **Keep the table COMPLETE.** Every hot file keeps its row, its measured triple and its G-5
   verdict. A hot file missing from the scan list is permanently invisible to its own guardrail.
3. **The structural half** — a guard that stops the column growing back.

### Explicitly Out of Scope

- Re-deriving all 113 triples. Only the two duplicated rows were re-derived, because the split
  forced a choice between two conflicting figures.
- Changing any G-5 verdict, or any row's disposition *meaning*.
- The other large sections (`Parallel execution` at 15,450; `Local dev infrastructure` at 8,548).
  They are narrative, not a scan list, and are the next split's target if one is needed.

</domain>

<decisions>

## D-208-01 — Split the DISPOSITION COLUMN, not the section

The gate's own advice names `## Workflow guardrails` as the biggest section, and the tempting move is
to move that whole section to `docs/`. **Rejected:** the section contains G-1…G-7, the orchestrator
protocol and the scan list — the parts that must be in every agent's system prompt to work at all.
The narrative inside one COLUMN is the only part with no reason to be loaded.

## D-208-02 — The table keeps the VERDICT and nothing else

Each cell is reduced to its disposition verdict (`extraction due`, `honoured by construction (194.1)`,
`young (200)`, `✅ G-5 DISCHARGED (192.2-02)`, …). Where a cell states no verdict at all — 20 of them
say only *"⚠ was ABSENT at N phases"* — a compact provenance stands in, **hand-authored, not
machine-cut**, because a wrong verdict answers the auditor and stops the audit, which is worse than an
absent row.

## D-208-03 — The structural guard, because the last split's own note predicted this one

`CLAUDE.md` says in writing: *"The split bought headroom; it changed nothing structural, so the trip
recurs unmeasured."* It was right — the 2026-08-17 split left 51,171 chars and the file was back to
135,662 eight days later, **+84,491, a faster climb than the one that tripped the limit.** So this
phase caps the disposition cell at **200 chars** in `scripts/check-claude-md-size.cjs`, and also fails
a duplicate row and a malformed row.

## D-208-04 — The HOOK must check BEFORE its size early-return

⚠ **This is the decision that makes the guard worth having.** `.claude/hooks/claude-md-size-guard.js`
exits silently below 120,000 chars. **That is exactly the range in which both trips were authored** —
at 51k the old hook said nothing while the column that would reach 60k was being written a paragraph
at a time. So the structural check runs FIRST and at ANY file size.

## D-208-05 — Every finding driven RED before the phase closes

Three findings × two guards = six firings, each driven against a planted defect with the file restored
**md5-identical** afterwards. A guard nobody has seen fire is not a guard; this repository has measured
that twice (`199-03`'s two blind fences).

</decisions>

<deferred>

- **The `Parallel execution — worktrees are ENABLED` section (15,450 chars).** Second-largest, and
  entirely narrative. **Re-open trigger:** the next time `CLAUDE.md` crosses the 120,000 warn band.
- **A cap on any OTHER table in `CLAUDE.md`.** The guard is scoped to the hot-file ledger because that
  is the table whose growth was measured. **Re-open trigger:** a second table in `CLAUDE.md` passing
  10,000 chars.
- **Re-deriving all 113 triples.** The ledger's own repeated finding is that cells go stale within a
  day. **Re-open trigger:** the next phase that reads a triple and finds it wrong.

</deferred>
