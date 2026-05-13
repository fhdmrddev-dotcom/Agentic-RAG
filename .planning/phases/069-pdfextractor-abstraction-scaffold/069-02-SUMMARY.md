---
phase: 069-pdfextractor-abstraction-scaffold
plan: 02
subsystem: docs
tags:
  - decisions
  - agpl
  - pymupdf
  - q-v2.6-06
  - license-posture
  - phase-069

# Dependency graph
requires:
  - phase: prd-reset
    provides: D-PRD-03 (closed core + open peripherals) and D-PRD-07 (Docling-first + PyMuPDF AGPL fallback) ADRs that the appendix attaches to
provides:
  - D-PRD-07 Appendix closing Q-v2.6-06 (PyMuPDF AGPL fallback license posture for Phase 071 wire-in)
affects:
  - 070-docling-httpx-spike
  - 071-rag-docling-extractor-wire-in
  - milestone-v2.6-close

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ADR appendix-under-existing-decision (instead of new D-PRD-NN) for closing a §13 PRD question after the parent ADR is already locked"

key-files:
  created:
    - .planning/phases/069-pdfextractor-abstraction-scaffold/069-02-SUMMARY.md
  modified:
    - .planning/prd-reset/DECISIONS.md (D-PRD-07 Appendix appended, lines 599-664 in worktree post-edit; 63 net insertions)

key-decisions:
  - "Q-v2.6-06 closure recorded as an appendix UNDER D-PRD-07, not as a new D-PRD-NN (per D-069-05; ADR scope is unchanged, only the license-posture mechanism is being formalized)"
  - "Subprocess fence is the contract for Phase 071 commercial-redistribution path (a); PyMuPDF Pro path (b) is the only sanctioned alternative"
  - "Phase 069 is documentation-only — no `pymupdf` dependency, no fence implementation, no PyMuPDFExtractor skeleton; all engineering deferred to Phase 071"

patterns-established:
  - "Appendix-pattern: §13 PRD question closures land as `### Appendix — Q-vX.Y-NN closure: ...` under the binding D-PRD-NN, not as a new ADR. Documented in 069-PATTERNS.md lines 469-477."

requirements-completed: []

# Metrics
duration: ~10min
completed: 2026-05-13
---

# Phase 069 Plan 02: Q-v2.6-06 PyMuPDF AGPL Posture Appendix Summary

**D-PRD-07 Appendix locks the PyMuPDF AGPL fallback license posture (subprocess fence in dev / personal use; PyMuPDF Pro deferred to first paying customer) before Phase 071 wires the engine in.**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-05-13 (Phase 069 execution wave 1)
- **Completed:** 2026-05-13
- **Tasks:** 1 / 1
- **Files modified:** 1 (`.planning/prd-reset/DECISIONS.md`)

## Accomplishments

- Closed **Q-v2.6-06** (PRD v2.6 §13, line 433) via a 50-line appendix subsection inserted at the end of D-PRD-07 in `.planning/prd-reset/DECISIONS.md`.
- Documented all five required facts: PyMuPDF is AGPL-3.0; D-PRD-03 closed-core/open-peripherals constraint; subprocess fence is the mechanism; dev / personal-use AGPL acceptance is fine today; before any commercial redistribution either (a) keep the subprocess fence intact OR (b) acquire PyMuPDF Pro.
- Recorded explicit re-trigger conditions for future re-litigation (first paying customer; fence breaks for performance; Artifex changes license terms; closed-core distribution moves to in-process link).
- Made Phase 069 / Phase 071 scope boundary explicit in the appendix itself — Phase 069 is documentation only; Phase 071 owns `PyMuPDFExtractor` + fence implementation + `EXTRACTOR_PRIMARY` env var.
- Satisfied Phase 069 **SC#4** (per ROADMAP §Phase 069).

## Task Commits

Each task was committed atomically:

1. **Task 1: Append "D-PRD-07 Appendix — Q-v2.6-06 closure" to `.planning/prd-reset/DECISIONS.md`** — `6489e09` (docs)

_No metadata commit yet — orchestrator owns final STATE.md / ROADMAP.md updates after the worktree wave completes._

## Files Created/Modified

- `.planning/prd-reset/DECISIONS.md` — Appended a 50-line (non-blank) `### Appendix — Q-v2.6-06 closure: PyMuPDF AGPL fallback license posture (Phase 069)` subsection under D-PRD-07. Total diff: 63 insertions, 0 deletions (additive only). New section now occupies lines ~599–664; D-PRD-08 starts at line 664 (was line 601 pre-edit).

## Appendix content (verbatim reference)

The appendix is structured as: closes/authored/status header → 3-line context paragraph → **Facts** bulleted list (PyMuPDF AGPL-3.0; D-PRD-03 link constraint; subprocess fence mechanism; dev/personal-use posture; commercial-redistribution paths (a)+(b); Phase 069 scope; Phase 071 scope) → **Re-trigger conditions** bulleted list (paying customer; fence breaks; Artifex license change; in-process link before Pro). Full text lives in `.planning/prd-reset/DECISIONS.md` lines ~599-664.

**Line count:** 50 non-blank lines between the `### Appendix` heading and the next `## D-PRD-08` heading — well within the D-069-05 / PATTERNS.md target of "~30-50 lines" (and within the plan's broader 30-80 acceptance window).

## Decisions Made

- Inserted the appendix **after** `### Sources` (D-PRD-07's last subsection at line 597 pre-edit) and **before** the `---` separator that introduces D-PRD-08. This keeps the appendix inside D-PRD-07's heading scope while preserving the existing inter-ADR `---` rule. No structural reordering of D-PRD-07's existing subsections (Context / Decision / Consequences / Alternatives considered / Sources).
- Used verbatim text from the plan's `<action>` block — no paraphrasing of the five core fact bullets. Plan provided the canonical wording.
- Did NOT edit `.planning/PRDs/v2.6.md` §13 to flip Q-v2.6-06's status. Plan explicitly forbids touching the PRD (signed-off 2026-05-12). Closure lives only in DECISIONS.md per D-069-05.
- Did NOT introduce a Table of Contents — DECISIONS.md doesn't maintain one; plan explicitly forbids introducing one.

## Deviations from Plan

**None - plan executed exactly as written.**

The plan provided verbatim appendix text and a precise insertion target (after the `### Sources` subsection of D-PRD-07, before D-PRD-08). No bugs, no missing critical functionality, no blocking issues, no architectural changes were needed.

**Total deviations:** 0
**Impact on plan:** N/A — plan is documentation-only with no runtime code or dependency surface that could surface Rule 1-3 triggers.

## Issues Encountered

**Operational note (not a plan deviation):** The bash shell's cwd resets between calls. Initial commands accidentally executed from the parent repo (`C:/Vibe Apps/Agentic RAG`) rather than this worktree (`C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-ac1f61cd80625e887`), which meant the first Edit applied to the parent repo's working tree (not committed; reverted via `git checkout -- .planning/prd-reset/DECISIONS.md` on the parent, which is a file-scoped revert and matches the destructive_git_prohibition allowed-pattern of "discard changes to a specific file you modified during this task"). Edit was then re-applied to the worktree's DECISIONS.md (absolute path used) and verified before commit. Parent repo's working tree is unchanged by this plan.

Per-call cwd was made explicit (`cd "C:/Vibe Apps/Agentic RAG/.claude/worktrees/agent-ac1f61cd80625e887" && ...`) for all subsequent operations. Pre-commit HEAD-safety assertion confirmed HEAD on `worktree-agent-ac1f61cd80625e887` (matches `worktree-agent-*` allow-list) before staging.

## User Setup Required

None - no external service configuration required.

## Self-Check

**File existence (worktree-scoped):**

- `.planning/prd-reset/DECISIONS.md` — FOUND (1310 lines post-edit; 63 insertions over 1247 baseline)
- `.planning/phases/069-pdfextractor-abstraction-scaffold/069-02-SUMMARY.md` — created in this commit

**Commit existence (`git log --all --oneline | grep 6489e09`):**

- `6489e09` — FOUND (`docs(prd): close Q-v2.6-06 with D-PRD-07 AGPL fallback appendix`)

**Acceptance grep checks (all PASS):**

- `^### Appendix — Q-v2.6-06 closure: PyMuPDF AGPL fallback license posture (Phase 069)$` → present
- `Closes:** Q-v2.6-06` → present
- `AGPL-3.0` → present
- `subprocess fence` → present
- `PyMuPDF Pro` → present
- `D-PRD-03` → present (citing closed-core / open-peripherals constraint)
- `Phase 069` → present (authoring phase)
- `Phase 071` → present (defers fence implementation)

**Ordering check:** D-PRD-07 at line 502 → Appendix at line 599 → D-PRD-08 at line 664 (strict ascending). OK.

**No code/dep side-effects (worktree `git diff --stat`):**

- `backend/` → empty
- `.planning/PRDs/v2.6.md` → empty
- `backend/requirements.txt` does NOT contain `pymupdf`
- `backend/requirements-dev.txt` does NOT contain `pymupdf`
- `backend/app/services/pymupdf_extractor.py` does NOT exist

**Worktree status post-Task-1 commit:** only `.planning/prd-reset/DECISIONS.md` modified (committed in `6489e09`). Clean working tree before SUMMARY.md commit.

## Self-Check: PASSED

## Next Phase Readiness

**Phase 070 (Docling httpx spike):** unblocked — license posture for the AGPL fallback is now formally documented, so the spike can evaluate Docling primary path without ambiguity about what happens if Docling doesn't ship.

**Phase 071 (RAG-DOCLING-01 wire-in):** has a clean ADR to reference. The appendix is **the contract** for Phase 071:

- Path (a) **subprocess fence** is the default for any commercial-redistribution moment. Phase 071 MUST implement the subprocess fence; if Phase 071 wants to move PyMuPDF in-process for performance reasons, it MUST author a follow-up ADR that explicitly supersedes this appendix.
- Path (b) PyMuPDF Pro purchase remains deferred to first paying customer per the parent D-PRD-07.

**Phase 069 SC#4 status:** SATISFIED. Plan 01 (the abstraction scaffold) still owes SC#1 / SC#2 / SC#3 — those are Plan 01's exclusive scope per the CONTEXT.md plan-split.

**Milestone v2.6 closure:** Q-v2.6-06 can be marked closed in any future v2.6 PRD amendment (per the plan, the PRD §13 line is NOT edited here; that's a separate amendment decision out of Phase 069 scope).

---
*Phase: 069-pdfextractor-abstraction-scaffold*
*Plan: 02*
*Completed: 2026-05-13*
