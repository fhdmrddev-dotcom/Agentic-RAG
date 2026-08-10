---
phase: 192-workflow-library-ia
plan: 05
subsystem: workflow-library-frontend
tags: [frontend, pure-derivation, vocabulary, negative-fences, D-03, D-07, D-08, D-12, D-13, D-16, D-17, LIB-01, LIB-02, LIB-03]
requires:
  - "PublishedWorkflow.is_mine / is_system_global (192-02)"
  - "soulData.tierForDefinition + soulDeliverable (shipped)"
  - "deriveTier.TIERS (shipped)"
provides:
  - "frontend/src/components/workflows/library/ — the directory the whole phase composes into"
  - "LibraryRow / Provenance / ChipId — the normalized row contract"
  - "libraryVocabulary — every user-facing library string in one home"
  - "mergeLibrary / filterLibrary / chipCounts / matchesQuery / matchesProject / CHIP_PREDICATES"
  - "UNBOUND, re-homed out of WorkflowsPage so the subtree never imports the page"
  - "F1 / F4 / F5 / TG / T-192-04 source fences over an explicitly-named seven-module subtree"
affects:
  - "192-06 RunModal move · 192-07 delete-Sheet move · 192-08 WorkflowCard · 192-09 LibraryToolbar"
  - "192-10 the page composition · 192-12 the pinning + RED-plant sweep"
tech-stack:
  added: []
  patterns:
    - "types-only leaf (phaseNodeCardContract.ts precedent)"
    - "as const satisfies Record<K,V> exhaustive table (deriveTier.ts:57-79)"
    - "type-only API-client import + ?raw purity fence (soulData.test.ts:275)"
    - "explicit-path ?raw subtree fence written before the files exist (WorkflowCanvas.test.tsx:55-83)"
    - "TypeScript-parser word-class fence with tokens assembled from parts (governanceVocabulary.test.ts)"
key-files:
  created:
    - frontend/src/components/workflows/library/libraryRow.ts
    - frontend/src/components/workflows/library/libraryVocabulary.ts
    - frontend/src/components/workflows/library/libraryFilter.ts
    - frontend/src/components/workflows/library/libraryFilter.test.ts
    - frontend/src/components/workflows/library/librarySubtree.fences.test.ts
  modified: []
decisions:
  - "Chips combine as a UNION, not an intersection — under AND, two disjoint chips render an empty list both had just promised was full"
  - "UNBOUND is re-homed into libraryFilter.ts (identical value) because F4 forbids the subtree importing WorkflowsPage"
  - "F1 is parsed, not grepped — a raw grep reds on the docblock that documents the rule"
  - "The threadGroups pin uses an in-test digest, not node:crypto, which costs a 34th tsc error"
metrics:
  duration: ~70 min
  completed: 2026-08-10
  tasks: 3
  commits: 4
---

# Phase 192 Plan 05: The Library Leaves and Their Fences Summary

`frontend/src/components/workflows/library/` now exists, holding the types leaf, the single
vocabulary home and the pure merge/filter module the other eight plans of this phase compose
over — plus a five-fence source suite scoped to an explicitly-named seven-module subtree,
four of whose modules do not exist yet, and every fence of which was driven RED against a
real plant and restored md5-identical.

## What shipped

**Task 1 — the types leaf and the one vocabulary home** (`94a565f4`).

`libraryRow.ts` emits **zero runtime values** (measured: `grep -c "^export \(const\|function\|class\|let\|var\)"` → 0), so it cannot participate in a value-level module cycle at all. It carries `Provenance`, `ChipId` and `LibraryRow`, and `LibraryRow.source` keeps the **original wire object whole** — a hand-rebuilt object that drops a draft's `token` is the D-186-07 silent clobber, a behaviour bug that typechecks.

`libraryVocabulary.ts` holds every user-facing string. Five of the six chips carry **no glyph**: they are word-badges, and `icon-convention.md` §4 forbids inventing a category-icon vocabulary — a workflow's identity on a row is already its glyph-dot phase spine. The sixth reads its mark from `TIERS.STRICT.glyph`, so `grep -c "🔒"` on the file is **0** and the chip is provably the same mark as the card's tier atom. `FORK_CONSEQUENCE` names both halves per D-13; `PROJECT_STARTERS_NOTE` ships D-17's sentence as words rather than as silence.

**Task 2 — the pure merge + filter module and its suite** (`514dd9c9`).

`mergeLibrary` dedupes on **`id`** through one `Map`, and the trap is pinned as a **positive** case: a same-slug v(N+1) draft survives the merge beside its published original, because `onTweak` deliberately mints a second row with the same slug and a slug-keyed dedupe would swallow exactly the row a user just created. `provenance` is assigned from feed origin, which is what D-12's fork branch reads.

Six predicates sit in one `as const satisfies Record<ChipId, …>` table. *Makes a file* is `soulDeliverable`; *Strict* is `tierForDefinition` — not re-implemented, and pinned by a two-emit-phase case (`draft` then `strict`) that a first-match check gets wrong. *Yours* reads `is_mine` when present and falls back to `provenance !== "starter"` when absent, so a frontend ahead of its backend is **correct**, not merely non-fatal.

`matchesQuery` is substring over name + `business_requirement` and nothing else. The paraphrase *"the thing that checks vendors"* returns **zero** rows — asserted, alongside a control showing `"vendor"` returns some, so the zero is about the phrase and not about a corpus that never matched.

**Task 3 — the subtree fences** (`8ca2df84`, `dd3cd534`).

Five fences over an **explicit seven-path list** — `libraryRow.ts`, `libraryVocabulary.ts`, `libraryFilter.ts`, `RunModal.tsx`, `WorkflowDeleteSheet.tsx`, `WorkflowCard.tsx`, `LibraryToolbar.tsx` — written in this commit, with `ls` confirming **four of the seven do not exist**. A fence written after they land only ever covers what happened to be there.

## Measured line counts (these feed 192-12's subtree delta)

| Module | Lines |
|---|---|
| `libraryRow.ts` | **100** |
| `libraryVocabulary.ts` | **162** |
| `libraryFilter.ts` | **284** |
| *source subtotal* | **546** |
| `libraryFilter.test.ts` | **367** |
| `librarySubtree.fences.test.ts` | **419** |
| *test subtotal* | **786** |
| **subtree total** | **1332** |

## Test counts, and the pin that is OWED not waived

| Suite | Tests | Failures |
|---|---|---|
| `libraryFilter.test.ts` | **36** | 0 |
| `librarySubtree.fences.test.ts` | **47** | 0 |
| **total** | **83** | **0** |

Both suites RUN inside the count gate's existing `src/components/workflows` **directory**
entry and print as `new`, which is informational. **Neither is pinned in `BASELINE`, and an
unpinned suite is an unguarded one** — the 188-12 precedent the gate script quotes about
suites whose counts are still growing. `192-12` owes both pins. No `TARGETS` entry was added:
one was not required (the directory entry already reaches them), and a `TARGETS` path that
does not resolve makes the gate **ERROR (exit 2)** rather than merely fail.

## The fences — every one observed RED against a real plant, then restored

The plan deferred the real-plant obligation to `192-12`; it was performed here anyway for the
modules that exist, because a fence that has never failed is a fence nobody has tested. **This
does not discharge 192-12's obligation** — the four modules that arrive later must be planted
in their own right.

| Fence | Real plant | Result | Restore |
|---|---|---|---|
| **F4** ESM cycle | `import type { WorkflowsPageProps } from "@/pages/WorkflowsPage"` added to `libraryFilter.ts` | **RED** — `./libraryFilter.ts imports the page in no form at all` | md5 `f94c2a3f…` → `f94c2a3f…` |
| **F5** word class | `SEARCH_PLACEHOLDER` set to the forbidden phrasing in `libraryVocabulary.ts` | **RED** — the word-hit assertion | md5 `c052f6ed…` → `c052f6ed…` |
| **F1** hover-only | a real `WorkflowCard.tsx` created carrying the attribute on a `<button>` | **RED** — `./WorkflowCard.tsx paints no hover-only explanation` | file removed; `git status` clean |
| **T-192-04** raw HTML | the same real `WorkflowCard.tsx`, rendering the purpose through the escape hatch | **RED** — `./WorkflowCard.tsx renders no raw HTML` | file removed; `git status` clean |
| **TG** byte pin | a comment line added to `lib/threadGroups.tsx` | **RED** — the byte-identity assertion | md5 `ad163534…` → `ad163534…` |

**F1's plant is also the proof that the pre-named path list works.** `WorkflowCard.tsx` is one
of the four listed-but-absent modules; the moment it existed the fence covered it, with **no
edit to the fence**. That is the property the explicit list buys, demonstrated rather than
argued.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 3 — Blocking] `node:crypto` adds a 34th typecheck error**

- **Found during:** Task 3, at the typecheck gate.
- **Issue:** the threadGroups pin was written with `createHash` from `node:crypto`. It **runs
  fine** under vitest, and `tsc -p tsconfig.app.json --noEmit` reported
  `error TS2307: Cannot find module 'node:crypto'` — 34 against a measured baseline of 33.
  `tsconfig.app.json` does not carry the Node type declarations.
- **Fix:** replaced with an in-test digest (two independent 32-bit FNV-1a lanes) pinned
  alongside the exact character length, rather than pulling `@types/node` into the app project
  to hash one file — a build-config change smuggled in by a fence. The docblock states plainly
  what the guarantee is: it detects an **edit**, and it is not a cryptographic digest. A
  second positive control was added for a **same-length** one-character edit, since the length
  pin alone would not catch one.
- **Files modified:** `librarySubtree.fences.test.ts` · **Commit:** `8ca2df84`

**2. [Rule 2 — Missing mitigation] T-192-04's second fence was absent**

- **Found during:** the pre-SUMMARY threat-surface review.
- **Issue:** the threat register states T-192-04's mitigation as *"the byte-unchanged hash
  **plus the ban on `dangerouslySetInnerHTML` in the subtree**"*. Task 3's action text listed
  only the first, so the raw-HTML ban was about to ship unwritten. D-07 renders the
  user-authored `business_requirement`, so the live threat is a second, unsafe highlight
  written next door to the safe imported one.
- **Fix:** added the fence over the same seven-path list, with a positive control, driven RED
  against a real plant.
- **Files modified:** `librarySubtree.fences.test.ts` · **Commit:** `dd3cd534`

**3. [Rule 1 — Bug] F1 as a raw grep reds on the file that documents it**

- **Found during:** Task 3 design, before the first run.
- **Issue:** VALIDATION.md and PATTERNS specify F1 as a `?raw` source check for the attribute
  spelling. `libraryVocabulary.ts` **explains the D-14 rule in its docblock** (*"never a
  `title=`, because touch has no hover"*), so a raw grep fails on the prose that documents the
  fence — the 187-24 trap in its inverted form.
- **Fix:** F1 walks JSX attributes with the TypeScript parser, the same scoping decision
  `governanceVocabulary.test.ts` makes for F5 and for the same reason: comments are not nodes,
  so they are excluded by construction rather than by stripping. Two scoping controls ship with
  it (prose is not caught; a same-named object **property** is not a JSX attribute — which
  matters here, because `HighlightTitle`'s own prop is spelled the same). The known limit is
  stated in the file: an attribute smuggled in through a spread or `setAttribute` is invisible
  to this fence, as it was to the grep it replaces.

### Design decisions the plan left open

**4. `UNBOUND` is re-homed, not imported.** The plan says *"reuse the shipped `UNBOUND`
sentinel rather than inventing one"* — and the sentinel is a module-private `const` inside
`WorkflowsPage.tsx:67`, which **F4 forbids this subtree from importing**. It is therefore
declared in `libraryFilter.ts` with the **byte-identical value** `"__unbound__"` and a comment
recording that the page adopts it from here when it is rewritten. A fence asserts the
declaration exists, so the "no cycle" claim is not satisfied by a subtree that simply does not
need the page yet. **Until the page is rewritten there are two identical declarations** — a
transient the page plan closes.

**5. The chips combine as a UNION.** Nothing in CONTEXT.md or the plan states how multiple
selected chips compose, and the answer is load-bearing for D-03. *Ready to run* and *Still
building* are **disjoint by construction**, so under an intersection a person who clicks both
gets an empty list that both chips had just promised was full — which is exactly *"a chip
promising results it cannot deliver"*. Under a union, selecting one chip yields precisely the
number that chip shows. Asserted both ways.

**6. `chipCounts` deliberately takes no `chips` argument.** The number a chip shows is the
number clicking **it** gives you, which makes the promise mechanical:
`chipCounts(rows, q, p)[c] === filterLibrary(rows, {query: q, chips: [c], projectId: p}).length`
— asserted per chip, twice (bare, and under a live query plus a project).

### Corrected inherited claims

**7. The plan's `<interfaces>` block misstates `soulDeliverable`.** It reads
`soulDeliverable(def): { kind: "file" | "chat"; label: string }`. Measured at
`soulData.ts:159`, the real shape is a **discriminated union** —
`{ kind: "file"; label: string } | { kind: "chat" }` — and the `chat` variant has **no
`label`**. Code written against the paraphrase would not compile. The *Makes a file* predicate
reads `.kind === "file"`.

**8. `tierForDefinition` accepts `null`**, not merely `undefined` (`soulData.ts:111`), so the
row's `def` needed no defensive wrapper at the call sites.

## Worktree base correction (not a code deviation)

The worktree came up at **`fda79214`** — a `master` merge commit — rather than the dispatched
base `14b309b4`. This is the second consecutive plan of this phase to hit it (192-02 recorded
the same class of drift). `git merge-base` disagreed, the startup assertion fired, and the
worktree was reset to `14b309b4`. All four commits sit directly on that base.

## Gates

| Gate | Result |
|---|---|
| `vitest run src/components/workflows/library/` | **83 passed / 0 failed** (`GSD_VITEST_MAX_WORKERS=4 --maxWorkers=4`) |
| `tsc -p tsconfig.app.json --noEmit` | **33** — the measured baseline, unmoved |
| `eslint src/components/workflows/library` | **0** |
| `eslint src/components/workflows/library -c eslint.a11y.config.js` | **0** |
| `git diff --name-only <base>..HEAD` | five files, all under `components/workflows/library/` |
| `node scripts/vitest-count-gate.cjs` | **see below — non-deterministic under three-agent parallelism** |

### ⚠ The count gate flakes under three concurrent worktree agents — attributed, not assumed

Four runs of the gate, same tree, same commit, `GSD_VITEST_MAX_WORKERS=4` on every one:
**`failed 6` → `failed 0` → `failed 1` → `failed 3`.** The failing tests were then read out of
the gate's own JSON reports rather than guessed:

| Run | Failing test | File |
|---|---|---|
| `failed 3` | an undo NEVER writes to the server (D-184-03) | `pages/WorkflowBuilderPage.canvas.test.tsx` |
| `failed 3` | has no axe violations on a rendered canvas | `components/workflows/WorkflowCanvas.test.tsx` |
| `failed 3` | has no axe violations on the empty state | `components/workflows/WorkflowCanvas.test.tsx` |
| `failed 1` | a whole session's api call log is [create, update, update] | `pages/WorkflowBuilderPage.session.test.tsx` |
| `failed 0` | — | — |

**Not one failure is in `src/components/workflows/library/`**, and the `failed 0` run happened
with this plan's code fully present. The last row is `192-RESEARCH.md` **Pitfall 7 by name**
(*the session suite "timed out at 5060 ms against a 5000 ms limit at `--maxWorkers=4`, and
passed on re-run"*); the two axe runs are the slowest assertions in the workflows tree. CLAUDE.md's
cap is applied and is still oversubscribed at **three** agents × 4 workers on a 16-core box —
the rule was measured for **two**. Recorded rather than chased: the gate is green on this
plan's scope, and the flake belongs to the wave's concurrency, not to any file here.

Also visible in the gate's table and **not this plan's**: `PhaseTimeline.test.tsx` reads
`17 → 21 (+4)` against `BASELINE`. It is outside this plan's `files_modified` and was not
touched; logged here so a later reader does not attribute it to 192-05.

## Threat Model Status

| Threat ID | Disposition | Outcome |
|---|---|---|
| T-192-04 | mitigate | **Mitigated and proved, both halves.** The highlight is imported, never re-implemented; `lib/threadGroups.tsx` is pinned byte-for-byte (digest + length, EOL-normalized) and the pin was driven RED; the raw-HTML escape hatch is fenced out of the subtree and that fence was driven RED against a real plant. |
| T-192-13 | mitigate | **Mitigated and proved.** F4 ports the canvas fence including the load-bearing `(\.[jt]sx?)?` group and the dynamic-import form, keeps the `?raw` negative controls, and was driven RED against a real type-only back-import — the shape that typechecks and lints clean. |
| T-192-14 | mitigate | **Mitigated and proved.** F5 sweeps the whole subtree (PATTERNS C-3), scoped to string literals and JSX text via the TypeScript parser, tokens assembled from parts, with comment-exemption and stem-anchor controls. Driven RED against a real placeholder plant. |
| T-192-15 | accept | **Held.** The `is_mine` fallback discloses nothing new — provenance is already derivable from feed origin. |
| T-192-SC | accept | **Held.** Zero packages installed; `@types/node` was deliberately NOT added (deviation 1). |

**Threat flags:** none. No network surface, no auth path, no file access, no schema change —
three pure modules and two test files.

## Known Stubs

None. Every export is wired to real behaviour and asserted. The four fence paths that name
files not yet on disk are **not stubs**: they are the fence's contract, and the F1 plant
demonstrated they bind the instant a file appears.

## What the next plans inherit

- **192-06 / 192-07** (the two verbatim moves): the fences already cover `RunModal.tsx` and
  `WorkflowDeleteSheet.tsx` by name. Both files carry `title=` today (the page has six), so
  **F1 will fire on the moved code** — that is D-14 working, not a fence defect, and the
  conversion to `aria-describedby` belongs with the move.
- **192-08 / 192-09** (card and toolbar): consume `CHIP_WORDS`, `CHIP_ORDER`, `FORK_VERB`,
  `FORK_CONSEQUENCE`, `SEARCH_*`, `PROJECT_*`, `LIBRARY_STATES`. Do not author a user-facing
  string outside `libraryVocabulary.ts` — F5 sweeps the whole subtree, and its own plant lives
  in the toolbar's placeholder.
- **192-10** (the page): `mergeLibrary` takes the three feeds in `(published, starters, drafts)`
  order and is **`allSettled`-shaped by construction** — it takes three arrays and never awaits,
  so a rejected `/drafts` degrades to `[]` rather than to an empty library. Import `UNBOUND`
  from `libraryFilter` and delete the page's own copy in the same commit.
- **192-12**: pin both suites in `BASELINE` from the gate's own printed `actual` across two
  agreeing runs (never by adding to a figure in a comment), and drive F1 / F4 / F5 / T-192-04
  RED against real plants in the **four modules that did not exist here**.

## Requirements

`LIB-01`, `LIB-02` and `LIB-03` are in this plan's frontmatter and **none becomes
user-observable here** — this plan ships the leaves, not the surface. They were deliberately
**not** marked complete: no `state.*`, `requirements.mark-complete` or
`roadmap.update-plan-progress` verb was called, and `STATE.md` / `ROADMAP.md` are untouched.

## Self-Check: PASSED

- `frontend/src/components/workflows/library/libraryRow.ts` — FOUND (100 L, 0 runtime exports)
- `frontend/src/components/workflows/library/libraryVocabulary.ts` — FOUND (162 L, 0 glyph literals)
- `frontend/src/components/workflows/library/libraryFilter.ts` — FOUND (284 L, 0 value imports from `@/lib/api`)
- `frontend/src/components/workflows/library/libraryFilter.test.ts` — FOUND (367 L, 36 tests)
- `frontend/src/components/workflows/library/librarySubtree.fences.test.ts` — FOUND (419 L, 47 tests)
- Commit `94a565f4` — FOUND
- Commit `514dd9c9` — FOUND
- Commit `8ca2df84` — FOUND
- Commit `dd3cd534` — FOUND
- `git status --short` — clean apart from this SUMMARY
- `STATE.md` / `ROADMAP.md` — unmodified
