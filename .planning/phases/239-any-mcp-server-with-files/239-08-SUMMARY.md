---
phase: 239
plan: "08"
subsystem: frontend/settings
type: refactor
tags: [g-5, extraction, connections, mcp, source-fences]
requires:
  - "239-07 (the seam it names)"
provides:
  - "frontend/src/components/settings/SourceToolsCard.tsx"
affects:
  - "frontend/src/components/settings/ConnectionFormPanel.tsx"
tech-stack:
  added: []
  patterns:
    - "guard-clause fence travels with the component"
    - "?raw source fences extended across an extraction boundary"
key-files:
  created:
    - frontend/src/components/settings/SourceToolsCard.tsx
  modified:
    - frontend/src/components/settings/ConnectionFormPanel.tsx
    - frontend/src/components/settings/__tests__/ConnectionFormPanel.test.tsx
    - frontend/src/components/settings/__tests__/ConnectionFormPanel.argumentMapping.test.tsx
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "D-239-08-01: take ONLY the source-binding card; the wider ConnectionShapeFields.tsx seam stays OWED"
  - "D-239-08-02: the capability==='mcp' fence moves INSIDE the card as a guard clause, not left at the call site"
  - "D-239-08-03: extend the ?raw copy fences to the new file rather than relying on the panel's"
metrics:
  duration: "~1h20m"
  completed: 2026-09-08
---

# Phase 239 Plan 08: The Owed G-5 Extraction on `ConnectionFormPanel.tsx` — Summary

The named seam is taken as a **pure move**: the file-source binding card leaves the panel as
`SourceToolsCard.tsx`, `2807 → 2477` lines, with the 298 moved JSX lines proven byte-identical to
their origin apart from indentation and **not one shipped test assertion changed in meaning**.

## Base — I landed on the wrong commit, exactly as the brief predicted

`git log --oneline -1` at spawn read **`1335b4b1a`** ("Merge develop into master — ship v3.9"), not
the stated base. Reset to **`1a4f1cdf1`** before any other action, then bootstrapped. **This is the
seventh consecutive agent to hit it** — the worktree is created from `origin/HEAD` (`master`), never
from the checked-out branch.

## Before / after line counts

| File | before | after | delta |
|---|---|---|---|
| `frontend/src/components/settings/ConnectionFormPanel.tsx` | **2807** | **2477** | **−330** |
| `frontend/src/components/settings/SourceToolsCard.tsx` | — | **403** | new |

⚠ **The 403 is not 403 new lines.** 298 of them are the panel's own JSX at a different
indentation; the remainder is the docblock, the imports and the prop type. The panel's whole diff
is **three hunks**: one import added, the now-unused `SOURCE_*` copy imports removed, and the
332-line block replaced by a 20-line call site.

⭐ **The move is ASSERTED, not claimed.** A mechanical comparison stripped leading whitespace from
both the git-base block and the new file's JSX body:

```
origin JSX lines (non-blank): 298
card   JSX lines (non-blank): 298
IDENTICAL — the moved JSX differs from its origin in INDENTATION ONLY.
```

## The test-file diff — 88 added / 0 removed, and 17 / 2

⭐ **`ConnectionFormPanel.test.tsx` is `88 insertions, 0 deletions` — purely additive.** Not one
existing case was touched. The additions are a new §26 describe carrying the panel's fences over
the new file.

⭐ **`ConnectionFormPanel.sourceTools.test.tsx` (28 cases, the suite that covers this card most
directly) and `ConnectionFormPanel.refreshReceipt.test.tsx` are BYTE-UNCHANGED.** Zero diff. That
is the strongest single piece of evidence that behaviour did not move.

**`ConnectionFormPanel.argumentMapping.test.tsx` is `17 insertions, 2 deletions`. Both deletions
justified per case, and neither changes an assertion's meaning:**

| # | Removed | Why it is legitimate |
|---|---|---|
| 1 | `// …and the two SHIPPED FRONTEND files, for §5's negative scan.` | Comment only. There are now three; the word `two` became false. Zero assertions. |
| 2 | `expect(panelSource).toContain("connection-source-args")` | **A `data-testid` moved file.** The id now lives in `SourceToolsCard.tsx`, so this positive control asserted something FALSE. It was **re-pointed, not deleted** — `expect(cardSource).toContain("connection-source-args")` — and the panel's scan was given its own replacement control, `expect(panelSource).toContain("<SourceToolsCard")`, so neither source can go vacuous. |

**The negative scan was WIDENED, never relaxed:** `expect(cardSource).not.toContain(needle)` was
added alongside the existing panel and copy scans, so all three files are swept for the forbidden
vendor literals instead of one.

## ⚠ The fences — one went RED on the first run, and that is the finding

The brief named this as the single most likely way to get the refactor wrong. It was right, and it
was **caught by the fence's own positive control rather than by care**:

```
AssertionError: expected '/**\n * Phase 190-17 …' to contain 'connection-source-args'
 ❯ ConnectionFormPanel.argumentMapping.test.tsx:581:25
 Test Files  1 failed | 21 passed (22)
      Tests  1 failed | 535 passed (536)
```

⚠ **The dangerous half was the SILENT one.** The same case scans `panelSource` for vendor-name
literals with `not.toContain`. Those assertions **kept passing** after the extraction — over a
source that no longer contains the markup they exist to police. Had the positive control not been
pinned, the whole negative scan would have gone quietly vacuous while reading green. **An
extraction is a silent fence-weakening event.**

### What I did to keep the copy fences honest across the new boundary

1. **`argumentMapping` negative scan now sweeps `cardSource` too** — moving code between the two
   files can no longer buy silence on a vendor name.
2. **Positive controls on BOTH sides.** `connection-source-args` is asserted where the id now lives;
   `panelSource` is kept non-vacuous by requiring the panel to actually mount `<SourceToolsCard`.
3. **New §26 in `ConnectionFormPanel.test.tsx`** re-applies the panel's inherited rules over the new
   file — *authors no sentence of its own* (extended to the card's OWN copy constants, which a
   panel-only fence could never have seen), *zero `title=`*, and the `PhaseFormPanel` import fence.
4. ⚠ **The `PhaseFormPanel` fence on the new file is IMPORT-SCOPED even though a bare grep passes
   today.** The card's docblock does not name `PhaseFormPanel`, so the weak form is currently green
   — and would go red the day someone explains the lineage in a comment. That is the **187-24 trap**
   (eleven recorded firings); writing the weak form because it passes today is how it fires a twelfth.
5. `connectionVerbFence.test.ts` needed **no change** — it sweeps
   `/src/components/settings/**/*.{ts,tsx}` by `import.meta.glob`, so it adopted the new file
   automatically. Verified, not assumed: it is green at 22 cases.

### All four new fences driven RED against planted defects

| Plant | Fence | Result |
|---|---|---|
| `\|\| "owner"` in the path-arg default | `argumentMapping` cross-boundary scan | 🔴 `expected '…' not to contain '"owner"'` on **cardSource** |
| `title="file source mapping"` on the card div | §26 tooltip refusal | 🔴 `expected '…' not to contain 'title='` |
| capability guard removed | §26 guard-clause fence **and** the shipped `⛔ never offers the binding on a capability connection` | 🔴 **both** |
| inline `{"File source mapping"}` | §26 authors-no-sentence | 🔴 `expected '…' not to contain 'File source mapping'` |

Card restored **md5-identical** afterwards: `7cc09bbc5eca4d7d2e2a9ed666a296d6`.

⚠ **The first copy plant did NOT fire, and that was the PLANT's fault, not the fence's.** I planted
an invented sentence rather than the constant's actual value. Re-planted with the real literal it
went red immediately. Recorded because **a plant that fails to fire is indistinguishable from a
dead fence unless you check which of the two you are looking at** — I nearly recorded a working
fence as unfalsifiable.

## Verbatim gate lines

**Vitest — `src/components/settings` alone (the brief's stated contract):**

```
 Test Files  22 passed (22)
      Tests  540 passed (540)
```

Base was `22 passed (22)` / `536 passed (536)`. **+4 is exactly my four new fence cases**; the
per-file tally confirms every other suite is unchanged and **no per-file decrease anywhere**
(`ConnectionFormPanel.test.tsx` 160 → 164; every other file identical).

**Vitest — `src/components/settings src/components/sources` (the brief's command):**

```
 Test Files  1 failed | 31 passed (32)
      Tests  18 failed | 821 passed (839)
```

⚠ **All 18 failures are `src/components/sources/sourceComposition.test.tsx`, and they are
INHERITED.** Captured from the gate's own JSON **before** any re-run, then diffed against the
base-commit JSON: **the failing SET is identical, case for case, not merely the count.** The file
is absent from `git diff --numstat` — **provably unmodified**. The worker cap was not touched.

⚠ **A drift worth naming:** `CLAUDE.md` records this suite at `16 failed | 33 passed` by a Phase 235
decision. **At `1a4f1cdf1` it measures `18 failed | 31 passed`** — two cases worse than the note
claims, before this plan existed. Not mine, not fixed here, but the standing-red figure in
`CLAUDE.md` is stale.

**Typecheck — and ⚠ the brief's gate is VACUOUS, which is itself a finding:**

```
$ npx tsc --noEmit
TSC EXIT=0            ← with ZERO output
```

⛔ **That exit 0 means nothing.** `frontend/tsconfig.json` is `{"files": [], "references": [...]}`
— **`tsc --noEmit` checks ZERO files.** This is the trap already recorded in project memory. So I
measured the real one instead, on both sides:

```
base   (1a4f1cdf1):  npx tsc -p tsconfig.app.json --noEmit  →  67 errors
after  (38673e291):  npx tsc -p tsconfig.app.json --noEmit  →  67 errors
diff of the two error sets (line/col stripped): IDENTICAL ERROR SETS
```

Zero errors in `SourceToolsCard.tsx`. The 5 remaining in `ConnectionFormPanel.tsx` (`auth_type`,
`status`, the `ConnectorCapability` union) are pre-existing and byte-identical to base. ⚠ **The
extraction DID initially add 24 `TS6133` errors** — the copy imports left behind by the move, which
the vacuous root gate reported as green. They were removed; that is why the panel diff touches the
import block.

**Ledger and size gates:**

```
hot-file ledger — 2 file(s) from the command line
  scan list: 232 rows · subject: 2 files · watched: 2
ledger gate OK — every watched file has a row.

  CLAUDE.md    86233 chars   57.5% of limit  headroom   63767  [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

⚠ The ledger gate **fired first** (`[no-row] SourceToolsCard.tsx`) and was satisfied by adding a
row, not by narrowing the invocation.

## The re-derived triples — measured after the code commit, never predicted

| File | row said | **re-derived** |
|---|---|---|
| `ConnectionFormPanel.tsx` | `27 / 10 / 2807` | **`28 / 10 / 2477`** |
| `SourceToolsCard.tsx` | — | **`1 / 1 / 403`** (no — 1 phase) |

Phases for the panel unchanged: `190 · 206 · 206.1 · 211 · 212 · 213 · 221 · 222 · 231 · 239`.

⚠ **I deliberately committed the code FIRST and derived afterwards**, so the numbers include this
plan's own commit as measured fact. `239-02` recorded a plan predicting `22 / 9 / 2445` and getting
**all three wrong**; this row has been stale at four consecutive closes and I would not add a fifth
by arithmetic. Both the `CLAUDE.md` abridged row and the `docs/HOT-FILE-LEDGER.md` row + new
section landed in **one commit** (same-commit sync rule); the disposition cells are under 200 chars.

## ⛔ What I did NOT do — silence would read as done

- ⛔ **THE WIDER `ConnectionShapeFields.tsx` SEAM REMAINS OWED AND IS NOT DISCHARGED.**
  `docs/HOT-FILE-LEDGER.md` names a broader extraction — every per-shape field block into its own
  component. **Untouched.** This card was taken first because it is the unit that actually grew the
  file (~330 lines across `239-01..07`) and is self-contained; taking it **shrinks** the `mcp`
  block, so the wider seam gets easier rather than competing. `ConnectionFormPanel.tsx` still
  measures **10 phases — G-5 still FIRES on it.**
- ⛔ **No `useState` moved.** `probeResult` is still the panel's. The card reads `probeResult` and
  `draft` and writes only through `set` — exactly the coupling `239-07` measured.
- ⛔ **No behaviour changed, no copy changed, no `data-testid` renamed.** The only id that "moved"
  moved between *files*, not between *values*.
- ⛔ **Nothing in `backend/` touched. Nothing pushed. `master` / `production` untouched.**
- ⛔ **The 18 inherited `sourceComposition` failures were NOT fixed** — out of scope, and the brief
  named them as inherited. I did not touch the worker cap either.
- ⛔ **The `auth_type` / `status` / `ConnectorCapability` type errors in the panel were NOT fixed** —
  pre-existing, unrelated to this seam.
- ⚠ **One green sample is not proof of innocence.** No SEED-171 suite is in this blast radius, but
  I ran `src/components/settings` four times across the plan and it was green every time after the
  fence repair; I state that as an observation, not as a stability claim.

## Deviations from Plan

**1. [Rule 3 — Blocking] The 24 `TS6133` unused copy imports**
- **Found during:** post-extraction typecheck
- **Issue:** the `SOURCE_*` identifiers moved with the card but stayed imported in the panel. The
  brief's `tsc --noEmit` gate could not see this (zero files).
- **Fix:** removed from the panel's `connectionFormCopy` import, with a comment recording that they
  **moved, not vanished** — leaving them imported would have left the panel able to author a
  source-binding sentence again with no fence noticing.
- **Commit:** `01b1c0936`

**2. [Rule 2 — Missing critical] The copy fences did not cover the new file**
- **Found during:** the first post-extraction gate run (one RED)
- **Issue:** an extraction silently narrows every `?raw` fence's scope.
- **Fix:** documented in full above — negative scan widened, positive controls on both sides, §26
  added, all four driven RED.
- **Commit:** `01b1c0936`

## Commits

| Hash | Message |
|---|---|
| `01b1c0936` | `refactor(239-08): the owed G-5 seam, taken as a move` |
| `38673e291` | `docs(239-08): both ledger rows re-derived, and the new file gets a section` |

## Self-Check: PASSED

- `frontend/src/components/settings/SourceToolsCard.tsx` — FOUND (403 lines)
- `frontend/src/components/settings/ConnectionFormPanel.tsx` — FOUND (2477 lines)
- `01b1c0936` — FOUND in `git log`
- `38673e291` — FOUND in `git log`
- ledger gate exit 0 · size gate exit 0 · settings suite 540/540 · app-tsc error set identical to base
