---
phase: 269-starter-expert-library
plan: 05
subsystem: deployment-runbook / planning-registers
tags: [experts, greenfield, operator-runbook, prod-parity, seeds, tiers]
requires: ["269-04 (migration 198 applied locally, four Experts locked)"]
provides:
  - "docs/OPERATOR.md Step-3 seeds the Expert catalog on a greenfield box (186 -> 187 -> 189 -> 198)"
  - "269-PROD-PARITY.md — ordered, approval-gated production checklist (nothing applied)"
  - "SEED-325 (F-4 NULL-tier, D-269-P1), SEED-326 (silenced drift WARN list, verbatim)"
  - "BUG-260929-01 — query_documents ignores a restricted Expert's folder scope"
affects: [docs/OPERATOR.md, .planning/ROADMAP.md, .planning/REQUIREMENTS.md, .planning/STATE.md, .planning/seeds, .planning/reported-bugs]
tech-stack:
  added: []
  patterns: ["rows-after-files deploy order for seeded Experts", "a silenced guard's list preserved verbatim in a seed in the same commit"]
key-files:
  created:
    - .planning/phases/269-starter-expert-library/269-PROD-PARITY.md
    - .planning/seeds/SEED-325-new-org-null-tier-cannot-see-the-expert-library.md
    - .planning/seeds/SEED-326-greenfield-seed-rows-missing-from-the-operator-runbook.md
    - .planning/reported-bugs/query-documents-ignores-restricted-expert-folder-scope.md
  modified:
    - docs/OPERATOR.md
    - .planning/seeds/SEED-244-expert-library-reusable-specialist-agents.md
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/STATE.md
decisions:
  - "D-269-P1 recorded (operator, 2026-09-29): tiers stay operator-assigned; SC#1 holds for enterprise-tier orgs; NULL-tier gap -> SEED-325"
  - "D-269-P2 recorded (operator, 2026-09-29): Financial Analyzer copy replaced with corpus figures, shipped in 198"
  - "PACK-26/27 marked complete for FOUR Experts; security-compliance HELD and named, not claimed"
  - "BUG-260929-01 folded into no phase (G-7: not a 269 closure item); code NOT touched"
metrics:
  duration: "~45 min"
  completed: 2026-09-29
  tasks: 2
  files: 9
requirements: [PACK-26, PACK-27]
independent_review: self
---

# Phase 269 Plan 05: Greenfield runbook, prod parity, registers — Summary

**The Expert catalog is now reachable on a correctly bootstrapped box (OPERATOR.md Step-3 lists 186 → 187 → 189 → 198), production has an ordered rows-after-files checklist that applies nothing, the F-4 ruling and the silenced drift list are planted as SEED-325/326, and every register says FOUR Experts shipped with security-compliance HELD.**

## What was done

### Task 1 — greenfield runbook, SEED-326, 269-PROD-PARITY.md (`f071baa0b`)
- `docs/OPERATOR.md` Step-3: rows 10-13 = `186_tier_capabilities.sql`, `187_expert_bundles.sql`,
  `189_expert_presentation_and_grants.sql`, `198_starter_expert_library.sql` (all four read and confirmed
  idempotent: `IF NOT EXISTS`, `DROP POLICY IF EXISTS`, `ON CONFLICT`); "9" → "13"; Expert-trio order note
  (187 → 189 → 198, both later ones UPDATE the Financial Analyzer row); a prose paragraph — spelling no other
  filename — on the deliberately absent retired knowledge seed and its re-point/cleanup, that Expert
  KNOWLEDGE is installed per org and never seeded, the NULL-tier refusal (D-269-P1, SEED-325), and SEED-326.
  Added a catalog verify query to step 4 (expect exactly the four slugs). "Migrations currently run to"
  re-derived **124 → 198**, original struck beside it.
- Filename set after the edit (`grep -oE '[0-9]{3}_[a-z0-9_]+\.sql' docs/OPERATOR.md | sort -u`): the
  original 9 + exactly 186/187/189/198. No 188/193/195 filename spelled.
- **SEED-326** carries the pre-edit WARN line verbatim (26 names; `diff` against the captured run output
  printed `VERBATIM-MATCH`), which 4 of them 269 listed and why, which 3 it deliberately did not (188/193/195),
  and that the remaining 19 are UNDECIDED and out of 269's scope. No control bytes in either file (counted: 0).
- **269-PROD-PARITY.md**: A read state → B 195/196/197 if owed (cites 266/268 docs) → C backend deploy
  carrying `corpora/<slug>/` for all four slugs, manifest check in the container → D 198 (only after C) →
  E `get_advisors(security)` → F F-4 per D-269-P1 → G embedding key → H post-deploy probe. States at the top
  that nothing has been applied; names the held Expert and BUG-260929-01.

### Additional deliverable — BUG-260929-01 (`721294119`)
`.planning/reported-bugs/query-documents-ignores-restricted-expert-folder-scope.md`: surface Agentic-RAG,
status open, severity `major` (the brief said medium-high; the template enum has no such value — mapping
stated in the body). Records the live observation (security-compliance refusal turn: `query_documents`
returned the Financial Analyzer's document `297c6ee8-…` from a sibling folder, same org, filename/title
disclosed), that the four shipped Experts are not immune, and the UNVERIFIED hypothesis
(`tool_dispatcher._handle_query_documents`, `tool_dispatcher.py:978-983`, `ctx.folder_subtree_ids` possibly
unset for an Expert thread without a folder). No cross-tenant read observed. Folded into no phase; concrete
`re_open_trigger`. **No code changed.**

### Task 2 — registers (`9feddfde0`)
- **SEED-325** planted: NULL-tier signup sees the tier refusal; options (a)/(b)/(c) from 266 §F; D-269-P1
  keeps (b); local read-only count re-derived now: **13 of 52 orgs NULL-tier** (38 enterprise, 1 standard);
  TIER-02 pricing one-way door; trigger_when + trigger_paths as the plan specified.
- **SEED-244** → `status: answered`, `folded_into: "269"`, status_note names the four shipped Experts,
  migration 198, the held security-compliance, D-269-03 rejection, and SEED-291..294 deferral. Body untouched.
- **ROADMAP.md**: 269-01..05 ticked; 269 progress row 5/5 (four shipped, one held, owed items named); phase
  checklist line annotated "executed" but left `[ ]` until verification; stale 266 row corrected beside its
  struck original (M-5); an OUTCOME note under SC#4 (four, not five). SC#1 D-269-P1 qualification confirmed
  present.
- **REQUIREMENTS.md**: PACK-26/27 `[x]` + traceability Complete, each with a note — enterprise-tier per
  D-269-P1 (SEED-325), four Experts, security-compliance HELD.
- **STATE.md** (hand-edited, no SDK verbs): position → 269 executed; D-269-P1/P2 recorded; new
  "Guardrail dispositions — Phase 269" block (G-2 bar quoted as `proceed` + the recommendation it accepted,
  G-4 rows driven + screenshots OWED, G-5 watched: 0, G-8 five plans, SC#10 does not fire, 267 inherited,
  independent_review: self) and an owed list.

## Gates (re-derived at close, verdict lines verbatim)

**Deploy drift — BEFORE the OPERATOR.md edit:**
```
  ok     all 9 runbook seed migrations exist (highest listed: 089)
  WARN   migration(s) above #089 carry seed-like INSERT/UPDATE — review whether the OPERATOR.md Step-3 list needs them: 093_… … 198_starter_expert_library.sql   (26 names, full line in SEED-326)
WARN summary (2) — human review, non-blocking:
RESULT: PASS — the one-box deploy artifacts are in sync.
```
**Deploy drift — AFTER (and re-run at close):**
```
  ok     all 13 runbook seed migrations exist (highest listed: 198)
  WARN   docker compose unavailable/denied here — CI (ubuntu-latest) runs the authoritative parse; using a structural fallback
WARN summary (1) — human review, non-blocking:
RESULT: PASS — the one-box deploy artifacts are in sync.
```
**Backend unit baseline** (`node scripts/check-backend-unit-baseline.cjs`, full suite):
```
Summary:        71 failed, 6016 passed, 1 skipped, 2 xfailed, 2 xpassed, 47 warnings in 311.58s (0:05:11)
[GATE PASSED] Backend unit baseline satisfied (failed: 71 <= 71, errors: 0).
```
(At the ceiling, zero headroom; passed 6009 at 269-03 → 6016 now, the +7 being 269-04's gate suites. This plan
changed no code or test.)

**Seeds register** (`node scripts/check-seeds-register.cjs --phase 269`) — exit 0, NOT the vacuous 0-plan pass:
```
trigger sweep — phase 269 (5 plan file(s), 28 path(s) in files_modified)
seeds register gate OK — 333/333 parsed, 0 duplicate ids, 333/333 carry all 5 required keys.
```
Fired: SEED-177, 188, 198, 266, 293, 294, 306, 326 (SEED-326 is this plan's own). ⚠ "the phase declares NO
surfaces" is printed, so `trigger_surfaces` matched nothing; unswept figures `134 carry no trigger_when at
all · 114 carry prose but no structured trigger` (reported separately, never summed).

**Hot-file ledger** (`node scripts/check-hot-file-ledger.cjs .planning/phases/269-starter-expert-library`) — exit 0:
```
  scan list: 350 rows · subject: 28 files · watched: 0
ledger gate OK — every watched file has a row.
```
**watched: 0 is expected, not a skipped audit** — 269 is a data-only phase (corpora, one data migration, tests,
docs).

**CLAUDE.md size**: `CLAUDE.md 117889 chars 78.6% of limit headroom 32111 [OK]` — not edited by this plan.

**graphify update .**: `Rebuilt: 34287 nodes, 100930 edges, 2206 communities` (graphify-out left uncommitted,
as it was before this plan).

## Deviations from Plan

1. **[Updated facts] Four Experts, not five.** Every count, list and doc (OPERATOR.md row 13, parity §C/§D,
   ROADMAP, REQUIREMENTS, SEED-244, STATE) states four shipped and security-compliance HELD, per the
   orchestrator's updated facts and D-269-09.
2. **[Orchestrator addition] BUG-260929-01** created (separate commit `721294119`). Not in the plan text.
3. **[Rule 2 — correctness] OPERATOR.md step 4 gained a catalog verify query** (expect the four slugs) so a
   greenfield operator can tell the Expert trio landed, mirroring the existing skill-creator check.
4. **[Rule 1] 269-PROD-PARITY.md verify SQL** was first drafted expecting `visibility 'restricted'`; 198 was
   re-read and that column is `scope_mode` (the new rows carry `visibility 'public'`). Corrected before commit.
5. **ROADMAP phase checklist** line for 269 left `[ ]` with an "executed" annotation rather than `[x]`,
   because code review + verification have not run (the 267 precedent). The progress-table row carries 5/5.
6. **SEED-326 quotes the WARN from the script's `WARN summary` footer** (identical text, no ANSI colour bytes)
   rather than the in-section copy, to keep control bytes out of planning prose.

## Owed / not done (visible, not claimed)

- **G-4 screenshots `g4-00` … `g4-06` — OWED.** Acceptance was given on API-level evidence.
- **267 is `human_needed`** — an inherited dependency; nothing here claims it verified.
- **`/gsd:code-review 269` + the verifier** — independent_review: self.
- **BUG-260929-01** open; security-compliance ships only after a fix + a PASS refusal re-drive.
- **Production**: nothing applied — no Supabase MCP call of any kind, no push, no deploy.
- `supabase/full-schema.sql` line-ending noise left uncommitted (as instructed).

## Known Stubs

None — this plan changed documentation and registers only.

## Threat Flags

None — no new network endpoint, auth path, file access or schema change. T-269-18 (silenced guard) mitigated
by SEED-326 in the same commit as the OPERATOR.md edit; T-269-19/20 mitigated by 269-PROD-PARITY.md's
approval gates and rows-after-files order; T-269-21 accepted and planted as SEED-325.

## Self-Check: PASSED

- FOUND: 269-PROD-PARITY.md, SEED-325, SEED-326, BUG-260929-01 report, 269-05-SUMMARY.md
- FOUND commits: `f071baa0b`, `721294119`, `9feddfde0`
