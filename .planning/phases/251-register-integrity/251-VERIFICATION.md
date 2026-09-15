---
phase: 251-register-integrity
verified: 2026-09-16T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01 — NEVER "reviewed". No independent §6.3 reviewer exists for this verification pass.
status: passed
score: 3/3 success criteria verified
overrides_applied: 0
---

# Phase 251: Register Integrity Verification Report

**Phase Goal:** The registers can be trusted as an index — a reference by id resolves to exactly one
thing, a `trigger_when` is swept by something executable rather than by hope, and the operator's
queue is a list they can actually rule on.
**Verified:** 2026-09-16
**Status:** passed
**Re-verification:** No — initial verification

## Method note — a false alarm I nearly reported, and why it was false

The first re-derivation attempt for D-11 (body byte-identity) compared `git show 97bb24e4d:<path>`
(a raw git blob, LF-only) against `fs.readFileSync` on the **local working-tree checkout** of HEAD.
That comparison showed 153 of 276 sampled seed bodies differing — every line ending converted from
LF to CRLF. This looked like a large, undisclosed D-11 violation.

It was a self-inflicted false positive: this local checkout has `core.autocrlf=true` (the exact trap
CLAUDE.md documents under the Windows port-reservation / line-ending sections), so `fs.readFileSync`
on the working tree returns CRLF-materialized content that **never existed in the git object
database**. Re-running the same comparison with both sides read from git (`git archive <ref> | tar
-x`, i.e. blob vs blob, nothing touching the local working-tree checkout) gave a clean result at
every relevant commit (Plan 02's `cd0d3fa3b`, Plan 03's `5fc75a0f0`/`6c31aaff1`, Plan 04's `f49b9d51b`
and HEAD): **0 line-ending-only diffs**, and exactly the same **4 real body diffs** at every point
from `78c8cf010` onward. This is recorded here rather than silently discarded, because it is the
correct outcome of doing exactly what CLAUDE.md warns `git diff` cannot do — and it is worth a future
verifier not re-falling into the same local-checkout trap.

## Goal Achievement

### Observable Truths / Success Criteria

| # | Truth (ROADMAP SC) | Status | Evidence |
|---|---|---|---|
| 1 | REG-01: no two seeds share an id — the 8 known duplicates each resolve to exactly one seed | ✓ VERIFIED | `node scripts/check-seeds-register.cjs` → `register: 293 files · parsed: 293 · skipped: 0 · duplicate ids: 0`, exit 0. All 8 ids (`022,092,228,229,231,253,259,269`) have exactly one live seed plus one `SEED-NNN-superseded-id.md` stub naming BOTH resolutions (spot-checked SEED-022, SEED-259, SEED-253 stubs in full — each names the KEPT id, the MOVED-to id, and a disambiguation rule). 8 movers exist at 277-284, re-derivable via `251-RENUMBER-LEDGER.md`'s D-07/D-20 date-rule table, which reproduces `251-CONTEXT.md` D-20's hand-derived tie-breaks (62m56s / 13h24m) exactly. |
| 2 | REG-02: one command reads every `trigger_when` and prints seeds whose trigger is already true — executable, not a paragraph | ✓ VERIFIED | `node scripts/check-seeds-register.cjs --phase 251` executed live: fires `[trigger-fires]` on SEED-177 and SEED-284 against this phase's own `files_modified`, exits 0. The exact fenced commands in `.claude/get-shit-done/workflows/discuss-phase.md` (`<step name="cross_reference_seeds">`) and `new-milestone.md` (`## 2.5`) were extracted and run verbatim — both are real, executable ` ```bash ` blocks calling `node scripts/check-seeds-register.cjs`, not prose. Counterfactual driven: a prose-only mention ("Run the seeds sweep: check-seeds-register manually…") still matches `grep -rn "check-seeds-register"`, proving a presence-grep alone would have been insufficient evidence — the actual files were confirmed to contain runnable fences, not just the string. |
| 3 | REG-03: BUS-171's operator queue is a decision list; every unfixed finding is verified against a durable register or one is planted | ✓ VERIFIED | `251-BUS-TRIAGE.md` classifies the 5 currently-open `to:operator` items (`BUS-040/208/246/247/248`) into superseded / live-decision / unfixed-finding, each with named evidence. `SEED-286` was planted for BUS-040's orphaned finding and its content matches the finding (`ChatArea.tsx:570/609-624/103,404`, `relates_to: BUS-040`). `git diff --name-only 97bb24e4d..HEAD -- .agent-bus/` is EMPTY — Claude wrote zero bytes to the bus. `answer`/`close` commands are printed pre-filled for the operator, never executed. `.claude/hooks/agent-bus-check.sh` (extended, run live) prints `AGENT BUS — 5 open to:operator, oldest 15 days · 26 open to:gemini … · 1 open to:claude`, matching D-14/D-15 exactly. |

**Score:** 3/3 ROADMAP success criteria verified.

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `scripts/check-seeds-register.cjs` | REG-02 sweep, exit 0/1/2, zero deps | ✓ VERIFIED | 1045 lines; `require(` limited to `fs`, `path`, `child_process` (self-test/tie-break only), `os` (self-test). `--self-test` runs live: `self-test 8/8 arms PASS`, exit 0 (grew from the planned 6 arms to 8 — `1c` stub-carve-out-is-a-shape and `2b` heading-claims-wrong-id, both added mid-phase and both documented as driven RED before the fix, confirmed in `251-04-SUMMARY.md` with byte-level round-trip proofs). |
| `scripts/migrate-seeds-frontmatter.cjs` | one-shot, dry-run-default, body-md5-gated migration | ✓ VERIFIED (already run, committed) | 939 lines; imports the gate as a namespace (`gate.frontmatter`, never destructured), zero third-party deps. Body-identity re-verified independently by this report over git blobs (see method note) — clean at Plan 02's own commit and at HEAD. |
| `.planning/seeds/TEMPLATE.md` | first written frontmatter contract | ✓ VERIFIED | Exists; `status:` enum line matches `STATUS_ENUM` in the gate exactly (10 values incl. `superseded-id`); carries `trigger_paths`/`trigger_surfaces`/`migration_note`/`partial` as documented. |
| `.claude/get-shit-done/workflows/plant-seed.md` | `max(id)+1` allocator | ✓ VERIFIED | Snippet extracted and run live: `MAX=286 NEXT=287 PADDED=287` — correctly skips the now-existing SEED-286, uses `10#` base-forcing (confirmed load-bearing: `092`/`022` are invalid octal without it). |
| `251-GATE-BASELINE.md`, `251-RENUMBER-LEDGER.md`, `251-BUS-TRIAGE.md` | pre-migration census, renumber derivation, operator decision list | ✓ VERIFIED | All three exist, and their headline numbers were independently re-derived rather than trusted (see truths above and key-link section). |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `discuss-phase.md` `<step name="cross_reference_seeds">` | `scripts/check-seeds-register.cjs` | fenced `node scripts/check-seeds-register.cjs --phase "${PHASE_NUMBER}"` | WIRED | Extracted verbatim and executed against phase 251 itself: 2 real hits, exit 0. |
| `new-milestone.md` `## 2.5` | `scripts/check-seeds-register.cjs` | fenced `node scripts/check-seeds-register.cjs` / `--phase "<NNN>"` | WIRED | Extracted verbatim and executed: prints register census, exit 0. Old `## 2.5 Scan Planted Seeds` hand-read-283-files step confirmed replaced (D-19). |
| `.claude/hooks/agent-bus-check.sh` | `.agent-bus/OPEN.md` + `scripts/lib/bus-age.sh` | `age_days()` sourced from the one shared home | WIRED | Hook run live: correct `to:operator`/`to:gemini`/`to:claude` counts and oldest age. `scripts/agent-bus.sh` and the hook now both source `bus-age.sh` — confirmed no third inline copy was added (the file's own header states this explicitly and the hook's `source` line was inspected). |
| `scripts/migrate-seeds-frontmatter.cjs` | `.planning/seeds/*.md` | Buffer read, frontmatter-only rewrite via imported `gate.frontmatter` | WIRED | Committed run's own claim (`284 files changed`, `bodies verified md5-identical: N/N`) independently re-checked over git blobs at the commit boundary — clean. |

### Data-Flow Trace (Level 4)

Not applicable in the conventional sense — this phase ships no rendered UI. The equivalent trace
(gate output → real register data, not a hardcoded/static return) was exercised directly: every
number printed by `check-seeds-register.cjs` (`register:`, `parsed:`, `duplicate ids:`, `unswept:`)
is derived at run time via `fs.readdirSync` and per-file parsing, confirmed by re-running the gate
live and cross-checking `register: 293` against `ls .planning/seeds | grep -c` and the 8 new
movers/9 stubs/1 planted seed (284 base + 8 movers + 1 stub-delta... — reconciled: 284 base files
(incl. `SEED-285`) − 0 removed + 8 stubs + 1 planted `SEED-286` = 293, matching the live count exactly).

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|---|---|---|---|
| Sweep exits 0 clear on the post-migration register | `node scripts/check-seeds-register.cjs` | `seeds register gate OK — 293/293 parsed, 0 duplicate ids, 293/293 carry all 5 required keys.` exit 0 | ✓ PASS |
| Trigger sweep fires on real data, not everything | `node scripts/check-seeds-register.cjs --phase 251` | 2 of 293 seeds matched, both quoting the matched glob and path | ✓ PASS |
| Self-test arms (all 8) | `node scripts/check-seeds-register.cjs --self-test` | `self-test 8/8 arms PASS`, exit 0 | ✓ PASS |
| Allocator avoids the 9th collision | inline `MAX/NEXT/PADDED` snippet from `plant-seed.md` | `MAX=286 NEXT=287 PADDED=287` | ✓ PASS |
| Bus-age hook fires with correct counts | `bash .claude/hooks/agent-bus-check.sh` | `5 open to:operator, oldest 15 days · 26 open to:gemini … · 1 open to:claude` | ✓ PASS |
| Zero writes to `.agent-bus/` | `git diff --name-only 97bb24e4d..HEAD -- .agent-bus/` | (empty) | ✓ PASS |
| Product-source boundary held | `git diff --name-only 97bb24e4d..HEAD -- backend/ frontend/ .planning/milestones/` | (empty) | ✓ PASS |
| Body byte-identity (D-11), re-derived over git blobs, not working-tree files | custom Node script diffing `git archive <base>` vs `git archive <HEAD>` bodies (stripped of the frontmatter block via the gate's own boundary function) | `{ exactMatch: 272, lineEndingOnly: 0, realContentDiff: 4, skipped: 8 }` — the 4 real diffs are the documented D-06/D-17 live-citation updates (SEED-022→277, SEED-228→279, SEED-253→282 references) plus the one documented `[id-in-heading]` fix (SEED-068, proven byte-for-byte reversible in `251-04-SUMMARY.md`) | ✓ PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|---|---|---|---|---|
| REG-01 | 251-03 | No two seeds share an id | ✓ SATISFIED | 0 duplicate ids live; 8 stubs disambiguate; boundary held (D-17); re-derived independently above |
| REG-02 | 251-01, 251-04 | Executable sweep, wired at both GSD touchpoints | ✓ SATISFIED | Gate + wiring both executed live in this verification, not merely grepped for |
| REG-03 | 251-04 | Operator queue triaged, findings preserved | ✓ SATISFIED | `251-BUS-TRIAGE.md` + `SEED-286` + empty `.agent-bus/` diff, all confirmed |

No orphaned requirements — `REG-01/02/03` are the only ids REQUIREMENTS.md maps to Phase 251, and all
three are claimed by a plan's `requirements:` frontmatter.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | none found | — | `grep -n "TBD\|FIXME\|XXX"` over both new `.cjs` files and the two touched hook/lib files returned nothing |

### Human Verification Required

None. Every claim in this phase was mechanically re-derivable and was re-derived directly against the
codebase (gate execution, self-test execution, hook execution, git-blob body diffing, allocator
snippet execution, live fenced-command extraction) rather than accepted from SUMMARY.md prose.

### Gaps Summary

None. All three ROADMAP success criteria hold under independent, adversarial re-derivation — including
one path (D-11 body-identity) where the first re-derivation attempt produced a false alarm from a
local `core.autocrlf` checkout artifact, and the corrected re-derivation (git blob vs git blob) matches
the phase's own claims exactly. DEBT-06 (independent §6.3 review) is correctly left unticked in
`REQUIREMENTS.md` — it is a milestone-wide standing gate, not a Phase 251 success criterion, and this
verification does not adjudicate it.

**Owed, not gaps (recorded for the milestone, not blocking this phase):**
- Only 44 of 293 seeds (`36` via `trigger_paths` + `10` via `trigger_surfaces`, 2 overlapping) carry a
  structured trigger after the mechanical backfill; `134` carry no `trigger_when` at all and `114`
  carry prose the sweep cannot match on. This is the explicitly-scoped, D-18-ruled outcome ("the
  backfill is MECHANICAL ONLY") — not a defect, but a number that should keep shrinking as seeds are
  authored/edited going forward, and is reported honestly (never summed) by the gate's own `unswept:`
  line.
- 91 (independently re-counted as 90, within rounding of the ledger's own count/scope) product-source
  references across 35 files (`backend/`, `frontend/`, `scripts/`) deliberately point at the redirect
  stubs rather than the renumbered ids, per D-17. All are comments or test docstrings; none is an
  executing identifier. Listed by file in `251-RENUMBER-LEDGER.md`.
- The 26 open `to:gemini` bus items and the 22 already-closed `to:operator` items (from BUS-171's
  original 23) are explicitly out of scope (D-15, D-12) and were not re-audited by this verification,
  consistent with the phase's own stated boundary.

---

_Verified: 2026-09-16_
_Verifier: Claude (gsd-verifier)_
