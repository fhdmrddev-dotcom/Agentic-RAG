---
phase: 195-show-the-deliverable
verified: 2026-08-17T22:05:00Z
status: passed
score: 12/12 must-haves verified
overrides_applied: 0
---

# Phase 195: Show the Deliverable — Verification Report

**Phase Goal:** A workflow that produces a file shows it, reusing the shipped file presentation.
**Verified:** 2026-08-17
**Status:** passed
**Re-verification:** No — initial verification

## Method

This verification does NOT trust `195-*-SUMMARY.md` claims. Every load-bearing assertion below was
re-derived independently in this session: `tsc` was re-run, the count gate was re-run, the six in-scope
suites were re-run (300 tests / 0 failing across 9 files), `md5sum` was computed fresh on the two
"chat gained no capability" files and compared against the recorded baseline, `grep` was run directly
against `OutputFileCard.tsx`, `FilesSection.tsx`, `WorkflowRunPage.tsx`, `FileRow.tsx`, `fileRowUtils.ts`
and `docs/HOT-FILE-LEDGER.md` / `CLAUDE.md`, and the row-height fix commit (`9c985537`) was read directly
from `git show`, not from a summary's description of it.

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|---|---|---|
| 1 | SC#1 (RUN-02) — a completed workflow that produced a file shows that file from the run surface | ✓ VERIFIED | `195-BASELINE.md` arms 1-2 (pre-change, live, byte-exact download 39660B, CRC-clean OOXML) + `195-UAT.md` U1a/U1b (post-change, live, byte-exact download 39465B, CRC-clean, opened cleanly). Two independent live drives, pre- and post-conversion. |
| 2 | SC#2 (RUN-03) — the presentation reuses the shipped file UI; no second file UI | ✓ VERIFIED | Direct grep: zero local `formatBytes`/`iconFor` definitions in `OutputFileCard.tsx`, `FilesSection.tsx`, `WorkflowRunPage.tsx` — all three import `FileRow`/`fileRowUtils`/`fileIcon`. `FileRow.sweep.test.ts` (20 cases, re-run: 82/82 in the `files/__tests__` dir) asserts this at the source level with length+identity non-vacuity guards. U3 (UAT) confirms visually, operator-accepted. |
| 3 | SC#3 (corrected) — multiple files render as ONE uniform quiet row, newest-first client-side | ✓ VERIFIED (by test; **unexercised by live observation** — see caveat) | `fileRowUtils.ts:125-133` `byNewestFirst` — read directly, handles both the both-present and either-missing regimes correctly (undefined `created_at` sorts first). Used only by `WorkflowRunPage.tsx:473`; confirmed absent from `FilesSection.tsx` (grep, zero hits) — matches the documented D-195-06-D scoping decision. Covered by `fileRowUtils.test.ts` (22) + `FileRow.test.tsx` (40), both re-run green. **U4 is ⛔ undrivable — no workflow run in the live DB has ever produced 2+ files, so live observation of this criterion is not currently possible for anyone.** Named blocking condition recorded, not hidden. |
| 4 | D-20 (RUN-02) — the canvas is a place work can be FINISHED: launch → watch → download → open the file, on the POST-change surface | ✓ VERIFIED | `195-UAT.md` U1b — driven live after the conversion, run `7b594e1a`, 39465 B on disk exactly matching `workspace_files.size_bytes`, CRC-clean OOXML (17 entries, zero errors), opened via the system handler. |
| 5 | D-02 — the region's heading makes no run-scope claim it cannot deliver | ✓ VERIFIED | Direct read of `WorkflowRunPage.tsx:140`: `const COPY_DELIVERABLE_HEADING = "Files in this run's workspace"` (was `"What this run produced"` per baseline). `195-UAT.md` U2 confirms this live on three separate runs. |
| 6 | D-13 — chat gains NO new file affordance while its presentation converts | ✓ VERIFIED | Independently computed `md5sum` on `MessageItem.tsx` and `ExecuteCodeBody.tsx` this session — both match the `195-BASELINE.md` pre-phase digests exactly (`4a83da8b…`, `386ed875…`). These files are byte-identical to `BASE_SHA`, proving zero plumbing change to chat's capability surface. |
| 7 | D-08 — `OutputFileCard`'s dead-link state and `supersedes` subline survive byte-identical | ✓ VERIFIED | Direct read of `OutputFileCard.tsx:134-150` (dead branch: `<span aria-disabled="true">`, `data-dead="true"`, no size cell) and `:191-217` (live branch). `OutputFileCard.baseline.test.tsx` re-run green (21 cases, part of the 300-test run). |
| 8 | The G-4-found visual regression (row height 33→40px / 38→42px) was fixed and re-verified | ✓ VERIFIED | `git show 9c985537` read directly: adds `inline-flex items-center` to the icon wrapper span at `FileRow.tsx:234`, with the reasoning documented inline. This is the exact fix `195-UAT.md`'s amendment describes. |
| 9 | RUN-02/RUN-03 requirement coverage — every phase requirement ID is claimed by a plan, no orphans | ✓ VERIFIED | All 8 plans' `requirements:` frontmatter sum to exactly `{RUN-02, RUN-03}`. `.planning/REQUIREMENTS.md:81-83` confirms both IDs map to Phase 195 in the traceability table (`:136`). No third ID appears in any plan. |
| 10 | Hot-file ledger same-commit sync (D-17) for the newly-hot/newly-created files | ✓ VERIFIED | `CLAUDE.md:409-416` carries rows for `OutputFileCard.tsx`, `FilesSection.tsx`, `FileRow.tsx`, `fileIcon.tsx`; `docs/HOT-FILE-LEDGER.md` carries matching sections (`:523`, `:577`, `:614`, `:683`, `:685`) — grepped directly, present on both sides. |
| 11 | ROADMAP SC#3 + design-record correction (D-11) — the retired hero/working pattern is corrected, not silently left wrong | ✓ VERIFIED | `.planning/ROADMAP.md:589-598` carries the corrected SC#3 with the original preserved verbatim beside it. `chat-tool-card-unification.md` carries `SUPERSEDED`/`REVERSED` annotations at the sites grepped (`:97`, `:114`, `:224`, `:436`). |
| 12 | Non-regression floor held (tsc, count gate) | ✓ VERIFIED | Re-run independently this session: `tsc --noEmit -p tsconfig.app.json` → **33** (unmoved). Count gate → `count gate OK — 83/83 pinned files present, no per-file decrease, 0 failing.` (total 4170, pinned 4096). Six in-scope suites → 300/300 passed. |

**Score:** 12/12 truths verified (one — #3 — carries a named, non-blocking observational limit; see caveat below).

### Required Artifacts

| Artifact | Expected | Status | Details |
|---|---|---|---|
| `frontend/src/components/files/FileRow.tsx` | The ONE shared row markup, discriminated source, 3 densities | ✓ VERIFIED | Exists, 14511 bytes, wired into all three surfaces via `asChild`, icon-wrapper fix present |
| `frontend/src/components/files/fileRowUtils.ts` | `formatBytes`, `byNewestFirst`, `baseName` | ✓ VERIFIED | Exists, single source of `formatBytes`, comparator handles both regimes |
| `frontend/src/components/chat/OutputFileCard.tsx` | Converted onto `FileRow`, public prop shape byte-identical | ✓ VERIFIED | Imports `FileRow`, no local formatter/icon map, `OutputFileCardProps` unexported (grep → 0) |
| `frontend/src/components/panel/FilesSection.tsx` | Converted onto `FileRow`, listbox/roving-focus/preview unmoved | ✓ VERIFIED | Imports `FileRow`, no local `formatBytes`/icon map, no `.sort()` (matches D-195-06-D scoping) |
| `frontend/src/pages/WorkflowRunPage.tsx` | Converted onto `FileRow`, honest heading, `byNewestFirst` wired | ✓ VERIFIED | Imports `FileRow` + `fileRowUtils`, heading = `"Files in this run's workspace"`, `orderedFiles` sorted |
| `frontend/src/components/files/__tests__/FileRow.sweep.test.ts` | SC#2 source sweep, non-vacuous | ✓ VERIFIED | 20 cases, guards present (length + identity + stripper non-vacuity pair), re-run green |
| `docs/HOT-FILE-LEDGER.md` + `CLAUDE.md` | Same-commit sync for 4 files | ✓ VERIFIED | Rows/sections present on both sides for all 4 |

### Key Link Verification

| From | To | Via | Status | Details |
|---|---|---|---|---|
| `OutputFileCard.tsx` | `components/files/FileRow.tsx` | `import { FileRow }` + `asChild` render | WIRED | Confirmed by grep + read |
| `FilesSection.tsx` | `components/files/FileRow.tsx` | same | WIRED | Confirmed by grep + read |
| `WorkflowRunPage.tsx` | `components/files/FileRow.tsx` + `fileRowUtils` | same | WIRED | Confirmed by grep + read; `byNewestFirst` applied to `files` before render |
| `MessageItem.tsx` / `ExecuteCodeBody.tsx` | (unchanged) | byte-identity to `BASE_SHA` | WIRED (unchanged, verified) | Independent `md5sum` matches baseline exactly |

### Requirements Coverage

| Requirement | Source Plans | Description | Status | Evidence |
|---|---|---|---|---|
| RUN-02 | 195-01, 195-02, 195-06, 195-08 | A workflow that produces a file shows that file from the run surface | ✓ SATISFIED | Truths #1, #4, #5 above; live pre- and post-change drives |
| RUN-03 | 195-02 through 195-08 | The produced file reuses the shipped presentation, not a second one | ✓ SATISFIED | Truths #2, #6, #7 above; source sweep + byte-identity checks |

**Note:** `.planning/REQUIREMENTS.md` still shows `[ ]` (unticked) for both RUN-02 and RUN-03. This is
consistent with this project's own convention — `RUN-01` was shipped by Phase 194/194.1 and stayed
unticked for a full phase cycle until a separate, explicitly-reasoned tick was added later with its own
annotation. Ticking `REQUIREMENTS.md` is not observed anywhere in this repo's history to be an automatic
consequence of phase completion; it is a deliberate, separately-reasoned act. Not treated as a gap.

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|---|---|---|---|---|
| — | — | none found | — | Swept `FileRow.tsx`, `fileRowUtils.ts`, `OutputFileCard.tsx`, `FilesSection.tsx`, `WorkflowRunPage.tsx` for `TODO/FIXME/XXX/HACK/PLACEHOLDER`/"not yet implemented" — the only two hits are unrelated pre-existing prose about workflow-phase slug placeholders, not debt markers |

### Behavioral Spot-Checks / Direct Re-Execution

| Behavior | Command | Result | Status |
|---|---|---|---|
| Typecheck floor unmoved | `npx tsc --noEmit -p tsconfig.app.json` | 33 errors (unmoved) | ✓ PASS |
| Count gate | `GSD_VITEST_MAX_WORKERS=2 node ../scripts/vitest-count-gate.cjs` | `count gate OK — 83/83 pinned files present, no per-file decrease, 0 failing.` (total 4170, pinned 4096) | ✓ PASS |
| Six in-scope suites | `vitest run` on WorkflowRunPage/FilesSection/MessageItem.finalOutputs/fileIcon/StopControl.baseline/OutputFileCard.baseline + `files/__tests__/` | 9 test files, 300 tests, 0 failing | ✓ PASS |
| `files/__tests__/` isolated | `vitest run src/components/files/__tests__/` | 3 files, 82 tests, 0 failing (40+22+20) | ✓ PASS |
| Chat byte-identity (D-13) | `md5sum MessageItem.tsx ExecuteCodeBody.tsx` | Matches `195-BASELINE.md` digests exactly | ✓ PASS |
| No local formatBytes/iconFor in converted surfaces | `grep -rn "function formatBytes\|function iconFor"` | Zero hits outside `fileRowUtils.ts` and test files | ✓ PASS |
| Row-height fix present | `git show 9c985537` | `inline-flex items-center` present at `FileRow.tsx:234`, matches described defect+fix | ✓ PASS |

## Deep-Dive: The Two Points of Highest Scrutiny

**1. SC#2 "no second file UI" — is the sweep's guard real or vacuous?** Read `FileRow.sweep.test.ts`
directly. It carries a dedicated `describe("the sweep's own machinery — it cannot pass on an empty
string")` block plus, per swept file, a stripper non-vacuity pair (an in-prose-only token asserted
present in raw `source` and absent from stripped `code`). This is the exact guard class that would have
caught the Phase 192.1 failure mode (an empty-string sweep passing green). Independently re-run: 20/20
green in this session. Combined with the direct `grep` showing zero local `formatBytes`/`iconFor`
declarations in the three converted files, SC#2 is verified by two independent methods (source sweep +
manual grep), not merely asserted by the summary.

**2. SC#3 "many files, one row, newest-first" — is this genuinely satisfied or only claimed?** The
comparator (`fileRowUtils.ts:125-133`) was read directly and correctly implements the documented
contract, including the "no `created_at`" regime the deliverable arrives in. It is exercised by 62 unit
cases (`fileRowUtils.test.ts` 22 + `FileRow.test.tsx` 40) with fixtures that each carry their own
positive control. What is **not** available — to this verifier or to anyone — is a live multi-file
workflow run: the live DB has none (the only 2+-file thread is an unrelated agent chat, per D-01). This
is a genuine, named, non-blocking limit of the evidence, not a hidden gap: the phase's own `195-UAT.md`
records it as ⛔ with an explicit blocking condition (a run producing 2+ files) rather than omitting it
or waving it through. Given the comparator's logic is directly readable and correctly handles the
untested regime, and given the population reality (60/61 file-bearing runs have exactly one file, so
this is inherently a rare-path property), this is judged VERIFIED-by-code with the observational gap
named rather than UNCERTAIN/blocking.

## Human Verification Required

None required to close this phase. The one outstanding observational item (U4 — live multi-file
ordering) has no action a human can take today: its blocking condition (a workflow run producing 2 or
more files) does not exist in the live system. `195-UAT.md` already names this as the first row to run
once a qualifying run exists — no further action is owed by this verification.

## Gaps Summary

No gaps found. All ROADMAP success criteria (SC#1, SC#2, corrected SC#3) and all plan-level must_haves
were independently re-verified against the actual codebase — not inferred from SUMMARY.md prose. The one
G-4-caught defect (icon-wrapper line-height inflating row height) was found by the phase's own UAT, fixed
in commit `9c985537`, and the fix was confirmed present and reasoned correctly by direct code read in
this session. The one unexercised-by-observation item (SC#3's multi-file live case) is recorded with a
named blocking condition, does not correspond to any incorrect or missing code, and does not block phase
closure.

---

*Verified: 2026-08-17*
*Verifier: Claude (gsd-verifier)*
