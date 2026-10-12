# Phase 277: Registers Back Inside the Band - Context

**Gathered:** 2026-10-12
**Status:** Ready for planning

<domain>
## Phase Boundary

`CLAUDE.md` goes from **121,650** chars (measured 2026-10-12, gate `[WARN]`, 81.1% of the 150k limit) to **≤ 90,000**, split by FUNCTION into `docs/` with nothing deleted. The size gate is tightened so the hot-file table cannot refill. The archived v4.5 records are repaired where they are actually wrong. Docs + one gate script only: no product source file is touched, so G-5 cannot fire. Requirements: **REG-04, REG-05**.

</domain>

<decisions>
## Implementation Decisions

### Headroom target (REG-04)
- **D-01:** Land CLAUDE.md at **≤ 90,000 chars** (target band 80-90k), measured by `node scripts/check-claude-md-size.cjs` and never by `wc`. That leaves ~30k of headroom, about 15 phases at ~+2k ledger growth per phase, so the band holds through v4.6 and into the next milestone.
- **D-02:** **Two moves are mandatory, and they should be enough on their own** (estimated ~81k together):
  1. The hot-file table cells are cut down (D-04..D-06), saving ~20k.
  2. The vitest-gate correction history moves out of `## Parallel execution` rule 2 (20,445 chars measured: the CORRECTION sections dated 2026-08-17 … 2026-09-22, the SEED-171 causal correction, and the standing `sourceComposition` red) into a new `docs/VITEST-COUNT-GATE.md`. **What stays in CLAUDE.md for rule 2:** use `GSD_VITEST_MAX_WORKERS=2`; re-derive the total with `node scripts/vitest-count-gate.cjs` from the repo root and never trust a quoted number; the gate's contract (no per-file decrease, 0 failing, never a fixed total); the triage procedure (capture failing filenames from the persisted JSON BEFORE re-running, check against `git diff --numstat`, never reach for the cap); the vacuous `tsc --noEmit` warning (use `tsc -p tsconfig.app.json --noEmit`, set diff); and the planning consequence (`count gate OK` is not reachable on demand).
- **D-03:** Further moves are **optional** and only if the measured result is still above 90k. The candidates, in order: the Windows port-reservation narrative in `## Local dev infrastructure`, `**G-7 in detail**`, the worktree "measured constraints". ⛔ Stays in CLAUDE.md no matter what: every MANDATORY rule's verdict, the G-1..G-8 table, the vendored-framework wiring table (G-7 / REG-02, the re-apply list), the Supabase MCP write rule, the deploy rules, and the backend baseline gate line.

### Hot-file table cells (REG-04)
- **D-04:** **Every row and every measured triple stays in CLAUDE.md** (the scan list is complete by rule; a row missing from it is invisible to its own guardrail). Only the **Verdict** cell shrinks.
- **D-05:** The new cell is a **short verdict, ≤ 80 chars**: the disposition and its phase anchor (e.g. `extraction OWED`, `honoured by construction (275-02)`, `✅ G-5 DISCHARGED (227-02)`, `young (created 262)`).
- **D-06:** **Each current cell's full text moves VERBATIM** into that file's own section of `docs/HOT-FILE-LEDGER.md`, under a dated heading such as `#### CLAUDE.md verdict cell as of 2026-10-12 (moved by 277)`. A file that has no section yet gets one. This is the same-commit sync rule: row and section change in the SAME commit.
- **D-07:** While in there, re-derive the table's header count line (it reads "113 of 224" while the table now carries 202 rows) **from the table itself**. Keep the old figure beside the new one, per this file's convention.

### Stopping the regrowth (REG-04)
- **D-08:** Lower `LEDGER_CELL_LIMIT` in `scripts/check-claude-md-size.cjs` from **200 → 80** in the same commit that shortens the cells. Update the comment at `:62` to say why (this is the third trip toward the limit, and the cells were 37.6k of the file).
- **D-09:** No per-section budget this phase (operator chose the cell cap alone).
- **D-10:** **Drive it RED:**
  1. Plant an 81-char cell and confirm `[disposition-too-long]` fires.
  2. Re-drive `[duplicate-row]` and `[malformed-row]`, plus `check-hot-file-ledger.cjs` against a planted missing row (ROADMAP SC#3).
  3. Restore each file md5-identical.

  A guard nobody has seen fire is not a guard.

### Fixing archived records (REG-05)
- **D-11:** **Fix in place, with one dated note per touched file.** The note is a short `> ⚠ Repaired 2026-10-12 (Phase 277, REG-05): <what changed>` line (or a frontmatter comment for SUMMARYs). Bodies otherwise stay byte-identical.
- **D-12:** REG-05's real remaining drift, **measured at discuss** (most of the audit's list was already fixed at close):
  - `.planning/milestones/v4.5-REQUIREMENTS.md:9` has four traceability rows (FIND-06/03/02/01) glued onto one line ahead of the archive body. Remove that line. The correct rows already exist at `:68-73`.
  - **19 archived SUMMARY files lack a `requirements` field**: 270-01, 271-01..05, 272-01..05, 273-02, 273-05, 274-01..05, 276-01. Each one gets its field **copied from its own PLAN.md frontmatter `requirements:`**. Never inferred from prose. A plan with no `requirements` field gets `requirements: []` plus a note, not a guess.
  - ROADMAP 270/271 progress rows and FIND-01/02/03/06 status: **already correct** (`v4.5-ROADMAP.md:333-334`, `v4.5-REQUIREMENTS.md:68-73`). Re-verify against each phase's VERIFICATION frontmatter and record the result; do not edit.
- **D-15 (operator ruling at plan-check, 2026-10-12):** The five 275 SUMMARYs (275-01..05) that read `requirements-completed: []` are **in scope**. Replace the `[]` with each one's own PLAN `requirements:` list (RET-01..04, verified passed by `275-VERIFICATION.md`), using the same copy-from-PLAN method and the same dated note as the 19. 273-01/03 stay untouched: their empty list is deliberate, because they carry `requirements-contributed`. Also correct the stale "275 closed, not deployed" status at `v4.5-REQUIREMENTS.md:3`; 275 was deployed 2026-10-12 to prod `784647e2d`. **Extended at plan re-check (operator, 2026-10-12):** the archived `v4.5-ROADMAP.md:338` row for 275 still says "prod migrations 204→205→206 + get_advisors owed". Both were done 2026-10-12 (STATE.md "Owed" row 1). Fix it in place with one dated note, and change only that one line of `v4.5-ROADMAP.md`.
- **D-13:** Hand-edit only. ⛔ No `milestone.complete`, no `state.*` SDK verbs (STATE.md records eight false-record occurrences).

### Mechanical no-loss proof (REG-04, ROADMAP SC#2)
- **D-14:** In the split commit: the set of removed CLAUDE.md lines minus the set of added `docs/` lines must be **empty**. Shortened cells count as moved because D-06 copies the old cell verbatim. Script it in the scratchpad, not the tree. Paste the output into the SUMMARY.

### Claude's Discretion
- Whether the vitest history gets its own `docs/VITEST-COUNT-GATE.md` or a section of an existing doc. A new topic file is preferred, following the precedent.
- Plan count. ROADMAP says likely 2, both inline under `inline_plan_threshold: 4`. One plan for REG-04 and one for REG-05 is the natural split (no shared files).
- Exact pointer wording at each moved section's old place (one line naming the `docs/` file and section).

### Reviewed Todos (not folded)
- `spike-nl-workflow-authoring.md`: matched only on generic keywords (score 0.6: "derived, real, status, milestone, first"). It is feature work and unrelated to a docs split. Left in pending.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The file being split and its gate
- `CLAUDE.md` § "CLAUDE.md context budget (MANDATORY)": the 150k/120k limits, split-by-function rule, same-commit sync rule, the history of the two prior trips
- `scripts/check-claude-md-size.cjs`: the gate. `LEDGER_CELL_LIMIT` at `:64`, the rationale comment at `:62`, the per-cell rules at `:233`, the report at `:269`
- `.claude/hooks/claude-md-size-guard.js`: PostToolUse hook that runs the gate in the authoring turn
- `.github/workflows/claude-md-size.yml`: the CI backstop
- `scripts/check-hot-file-ledger.cjs`: G-5 gate; must still pass after the table edit

### Split precedents (copy their shape)
- `docs/HOT-FILE-LEDGER.md`: destination for every moved verdict cell (one section per file; 19,263 lines)
- `docs/SANDBOX-PACKAGES.md`: the other same-commit-sync precedent

### Records being repaired (REG-05)
- `.planning/milestones/v4.5-REQUIREMENTS.md`: `:9` mangled line; `:68-73` correct rows
- `.planning/milestones/v4.5-ROADMAP.md`: `:333-334` progress rows
- `.planning/milestones/v4.5-phases/*/` — the 19 SUMMARY + their PLAN files (list in D-12)
- `.planning/milestones/v4.5-MILESTONE-AUDIT.md`: the `tech_debt` bookkeeping item REG-05 discharges

### Requirements
- `.planning/REQUIREMENTS.md`: REG-04, REG-05
- `.planning/ROADMAP.md` `#### Phase 277`: SC#1-4 and "How we'd know this failed"

</canonical_refs>

<code_context>
## Existing Code Insights

### Measured section sizes (2026-10-12, chars)
- Workflow guardrails 55,145, of which the hot-file table is 202 rows / 37,585, G-7 detail 3,847, ledger preamble 3,171, post-table notes 3,612, vendored-framework block 1,881
- Parallel execution 24,125, of which rule 2 (vitest history) is 20,445
- Local dev infrastructure 8,574 · Rules 7,049 · Project skills 6,902 · Seeds 3,455 · Context budget 3,456 · UAT 3,397

### Established Patterns
- **Corrections are recorded beside originals, never overwritten.** This holds for CLAUDE.md prose (D-11 deliberately departs from it for the archive's mechanical fixes only, at operator choice). Moved text keeps its strike-throughs and dated corrections verbatim.
- Guards are proven by planting a defect and restoring md5-identical.
- ⚠ CRLF: `git checkout -- <dir>` is not a reliable restore here (autocrlf). Restore planted files from a saved copy and verify by md5.

### Integration Points
- Researcher must check: does any script, hook or test parse the CLAUDE.md table cell text, or `?raw`-import CLAUDE.md? (`check-claude-md-size.cjs` parses rows; confirm nothing else depends on the long cell content.)

</code_context>

<specifics>
## Specific Ideas

- The operator chose every recommended option: ~90k, short verdict cells, lower the cell cap, fix archive in place.
- "Re-measure at every later phase close." The ROADMAP flag stands: every v4.6 phase close runs the size gate and must show no warning.

</specifics>

<deferred>
## Deferred Ideas

- **Per-section size budgets** in `check-claude-md-size.cjs` (fail when one `##` section passes N chars). Considered and not chosen for 277. Revisit if a single section regrows past ~15k.
- Moving UAT recipe / Supabase MCP / deployment narrative out: not needed to reach the target.

</deferred>

---

*Phase: 277-registers-back-inside-the-band*
*Context gathered: 2026-10-12*
