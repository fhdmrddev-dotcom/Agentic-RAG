---
phase: 277-registers-back-inside-the-band
verified: 2026-10-12T00:00:00Z
status: passed
score: 4/4 roadmap success criteria verified
overrides_applied: 0
re_verification: false
---

# Phase 277: Registers Back Inside the Band - Verification Report

**Phase Goal:** CLAUDE.md sits below the 120,000-char warn band, split by function into docs/ with nothing deleted, and the v4.5 records say what actually shipped.
**Status:** passed. Every command below was re-run by the verifier, not read from SUMMARY.

## Observable Truths

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | size gate exits 0 with no warning; split lives in named docs/ files with pointers; one commit | VERIFIED | `node scripts/check-claude-md-size.cjs` printed `CLAUDE.md 89171 chars 59.4% of limit headroom 60829 [OK]`, "gate OK", exit 0. Split commit `0c2be7abe` touched CLAUDE.md, docs/HOT-FILE-LEDGER.md, docs/VITEST-COUNT-GATE.md and the two guard files. Every `docs/*.md` path named in CLAUDE.md exists. 89,171 is about 31k under the band, so Phase 278's ledger edits will not push it back. |
| 2 | Nothing lost; FIRING table stays complete | VERIFIED | Removed-minus-added set diff over `0c2be7abe` (CLAUDE.md lines removed, minus all lines added in CLAUDE.md and docs/): 137 lines differed at line level. All 137 are shortened table rows. Their old verdict cells were moved verbatim into docs/HOT-FILE-LEDGER.md (cell-substring test). One apparent miss, `FilesSection.tsx`, was an escaped-pipe (`\|`) artifact of my split; the cell text is present in the ledger (grep hit). Residual is empty. The FIRING table still carries 202 rows. `check-hot-file-ledger.cjs 277` passed ("516 rows, ledger gate OK"). |
| 3 | Guards fire after the split; file restored md5-identical | VERIFIED | Planted defects in CLAUDE.md, each exiting 1: a 120-char cell gave `[disposition-too-long]`, a duplicated row gave `[duplicate-row]`, a 2-cell row gave `[malformed-row]`, and 128 deleted rows gave `[shortlist-missing]`. The ledger gate, given a plan naming an unlisted source file, exited 1 with a missing-row report. CLAUDE.md was restored from a backup and its md5 is `d89f9959...` before and after. `git status` shows no tracked changes beyond the pre-existing `.claude/settings.local.json`, `.mcp.json` and `graphify-out/GRAPH_REPORT.md`. |
| 4 | Archived v4.5 records match phase directories (REG-05) | VERIFIED | v4.5-REQUIREMENTS: the four glued FIND-06/03/02/01 rows are removed and the proper rows at lines 69-74 are intact. They read "Complete (operator G-4 sign-off owed)" and the checkboxes are `[x]`. The ROADMAP rows read 270 "verified passed 4/4" and 271 "human_needed: G-4 sign-off + P-01/P-03 owed". Both match the VERIFICATION frontmatter (270 `passed 4/4`; 271 `human_needed`, 5/5). All 38 v4.5 SUMMARYs carry a requirements field. 273-01 and 273-03 are byte-unchanged and carry `requirements-contributed`. The 24 repaired SUMMARYs have a list equal to their PLAN's `requirements:` line, and the diff-vs-PLAN check flagged only 273-01/03. Archive diff (`git diff 11f73d932 HEAD`, 26 files, +54/-9): only the named fields changed, each with a dated "Repaired ... (D-15)" note. No `milestone.complete` or `state.*` verbs were used. |

**Score:** 4/4

## Requirements Coverage

| Req | Plan | Status | Evidence |
|---|---|---|---|
| REG-04 | 277-01 | SATISFIED | SC#1-3 above |
| REG-05 | 277-02 | SATISFIED | SC#4 above |

No orphaned requirements: REG-04 and REG-05 are the only IDs mapped to Phase 277. `.planning/REQUIREMENTS.md` still shows both as `[ ]` / "Pending" (lines 42-43, 81-82). The plans left that hand-edit to the orchestrator at phase close, so it is a close-out task and not a gap.

## Other Checks

- `bash scripts/check-deploy-drift.sh` returned PASS (2 non-blocking warnings: migrations 204/206 seed-like statements, docker compose unavailable locally).
- Anti-patterns: no debt markers were introduced in the split.
- Code review (277-REVIEW.md, 0 critical / 8 warning / 5 info): none of the warnings makes a ROADMAP SC unmet. They concern guard hardening beyond the SCs:
  - WR-01 to WR-06 cover hook suppression, silently skipped unparsable rows, truncation after a heading, uncapped triple cells, no floor on the scan-list cap, and no automatic 200-cap run on ledger-only edits.
  - WR-07 is a self-contradicting scan-list row.
  - WR-08 says shortened cells dropped a pointer, but the full text is preserved in the ledger, so there is no loss.
  - None invalidates SC#3, because the guards were driven RED.
  - Recommendation: triage them as fast-fix or defer under G-7, not as a gap round.

## Human Verification Required

None.

## Gaps Summary

None. Operator follow-up: tick REG-04 and REG-05 in `.planning/REQUIREMENTS.md` at close, by hand.

_Verifier: Claude (gsd-verifier)_
