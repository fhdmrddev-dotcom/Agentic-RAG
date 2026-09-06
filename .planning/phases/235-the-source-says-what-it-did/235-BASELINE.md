---
phase: 235
kind: red-baseline
recorded: 2026-09-06
plan: 235-03
---

# Phase 235 — BASELINE

**The captured RED run of the `source-composition` fence, before any wave built anything.**

Captured by plan `235-03` (Wave 1), 2026-09-06, in a bootstrapped worktree
(`worktree-agent-aac82c3d7880c2f90`, reset to base `635a3e7191ec6b064beced009b3cb829e575f077`).

> **A guard nobody has seen fire is not a guard, and a guard adopted green on a tree it never
> failed on has proved nothing about its own wiring.** Sketch 218 shipped a generated contract
> with **200 assertions, 0 failing**, and the operator's verdict on the surface it certified was
> *"nothing at all like what we designed"* — because every one of those assertions pinned WORDS
> and none could name a MISSING BLOCK. This file is the proof that its Phase-235 replacement can.

⛔ **THIS FILE IS WRITTEN ONCE AND NEVER EDITED BY A LATER WAVE.** A wave that turns a block green
records that in its own SUMMARY. Overwriting the red evidence here would destroy the only record
that the guard was ever seen to fire.

---

## §1 The command, and its output verbatim

```
$ cd frontend && npx vitest run src/components/sources/sourceComposition.test.tsx --maxWorkers=2
```

Exit code **1** — which is the correct and intended result.

```
 Test Files  1 failed (1)
      Tests  37 failed | 12 passed (49)
   Start at  06:49:05
   Duration  11.71s (transform 1.97s, setup 162ms, import 492ms, tests 9.63s, environment 1.16s)
```

The 37 failing cases, pasted from the run's own `Failed Tests 37` block rather than summarised:

```
 FAIL  … §3 every block the sketch draws > sources > renders the `instance-statement` block as [data-testid="sources-instance-statement"]
 FAIL  … §3 every block the sketch draws > sources > renders the `tab-ingestion` block as [data-testid="sources-tab-ingestion"]
 FAIL  … §3 every block the sketch draws > sources > renders the `tab-health` block as [data-testid="sources-tab-health"]
 FAIL  … §3 every block the sketch draws > sources > renders the `body-ingestion` block as [data-testid="sources-body-ingestion"]
 FAIL  … §3 every block the sketch draws > sources > renders the `source-line` block as [data-testid="sources-source-line"]
 FAIL  … §3 every block the sketch draws > sources > renders the `source-card` block as [data-testid="sources-source-card"]
 FAIL  … §3 every block the sketch draws > sources > renders the `outcome` block as [data-testid="sources-outcome"]
 FAIL  … §3 every block the sketch draws > sources > renders the `stopped-sentence` block as [data-testid="sources-stopped-sentence"]
 FAIL  … §3 every block the sketch draws > sources > renders the `history` block as [data-testid="sources-history"]
 FAIL  … §3 every block the sketch draws > sources > renders the `run` block as [data-testid="sources-run"]
 FAIL  … §3 every block the sketch draws > sources > renders the `quiet-fold` block as [data-testid="sources-quiet-fold"]
 FAIL  … §3 every block the sketch draws > sources > renders the `fail-reason` block as [data-testid="sources-fail-reason"]
 FAIL  … §3 every block the sketch draws > health  > renders the `body-health` block as [data-testid="health-body-health"]
 FAIL  … §3 every block the sketch draws > health  > renders the `attention-list` block as [data-testid="health-attention-list"]
 FAIL  … §3 every block the sketch draws > health  > renders the `attention-row` block as [data-testid="health-attention-row"]
 FAIL  … §3 every block the sketch draws > rail    > renders the `rail-item` block as [data-testid="rail-rail-item"]
 FAIL  … §3 every block the sketch draws > rail    > renders the `rail-item-library` block as [data-testid="rail-rail-item-library"]
 FAIL  … §3 every block the sketch draws > rail    > renders the `badge` block as [data-testid="rail-badge"]
 FAIL  … §3 every block the sketch draws > rail    > renders the `popover` block as [data-testid="rail-popover"]
 FAIL  … §3 every block the sketch draws > rail    > renders the `pop-item` block as [data-testid="rail-pop-item"]
 FAIL  … §4 every named control > sources · offers the `fix` control as [data-testid="sources-fix"]
 FAIL  … §4 every named control > sources · offers the `sync-now` control as [data-testid="sources-sync-now"]
 FAIL  … §4 every named control > sources · offers the `toggle-history` control as [data-testid="sources-toggle-history"]
 FAIL  … §4 every named control > sources · offers the `toggle-quiet` control as [data-testid="sources-toggle-quiet"]
 FAIL  … §4 every named control > sources · offers the `report-source` control as [data-testid="sources-report-source"]
 FAIL  … §4 every named control > health  · offers the `go-to-source` control as [data-testid="health-go-to-source"]
 FAIL  … §4 every named control > rail    · offers the `badge` control as [data-testid="rail-badge"]
 FAIL  … §4 every named control > rail    · offers the `open-health` control as [data-testid="rail-open-health"]
 FAIL  … §5 the counts that must hold > collapses every healthy source to a line — 9 `source-line`
 FAIL  … §5 the counts that must hold > ⛔ NEVER collapses a stopped or unreadable source — 3 `source-card`
 FAIL  … §5 the counts that must hold > accounts for every source exactly once — as a line or as a card, never neither
 FAIL  … §5 the counts that must hold > Health lists one `attention-row` per stopped source — 2, never all 12
 FAIL  … §5 the counts that must hold > a collapsed history shows 3 `run` rows; expanded shows all 17
 FAIL  … §5 the counts that must hold > ⭐ the reader-off statement appears EXACTLY ONCE, never per row (D-235-12)
 FAIL  … §6 the invariants a later edit must not break > ⛔ the word "scheduled" appears in NEITHER `api/sources.py`…
 FAIL  … §6 the invariants a later edit must not break > ⛔ …NOR `WatchedFoldersSection.tsx` — the frontend half (RESEARCH C-7)
 FAIL  … §6 the invariants a later edit must not break > ⛔ `--color-danger` is never applied to a source state
```

⭐ **THE FAILURE MESSAGE NAMES THE MISSING HOOK, WHICH IS THE WHOLE POINT.** The first one, verbatim:

```
TestingLibraryElementError: Unable to find an element by: [data-testid="sources-instance-statement"]
```

That sentence is precisely what sketch 218's 200 green assertions could not produce. Four other
representative messages, also verbatim — note that three failure *kinds* are represented, so the
suite is not one assertion repeated:

```
AssertionError: expected +0 to be 12 // Object.is equality
AssertionError: expected '"""phase 234 (lib-08 / surf-01 / vis-…' not to contain 'scheduled'
AssertionError: expected '/**\r\n * phase 234 (lib-08 / surf-01…' not to contain 'scheduled'
AssertionError: expected '/**\r\n * Phase 234 (LIB-08 / SURF-01…' not to match /last_status\s*===\s*"failed"[\s\S]{0,…/
```

---

## §2 What was GREEN, and why that matters

> **A run in which every case is red is indistinguishable from a broken mount harness.**

Twelve cases passed, and they were chosen to be exactly the ones that must:

**§1 — the non-vacuity floor (5/5 green).** *A moved or misnamed import resolves EMPTY rather than
throwing, and a contract of zero blocks makes every case below pass over nothing.*

| ✓ | case |
|---|---|
| ✓ | resolves to a non-empty object |
| ✓ | carries all three screens |
| ✓ | carries a character floor of real content (`JSON.stringify(CONTRACT).length > 1200` — measured **4359**) |
| ✓ | names at least 15 DISTINCT block kinds across the three screens (measured **20**) |
| ✓ | was emitted from variant B — the operator's winner, not the rejected A |

**§2 — the positive controls (3/3 green).** These prove the harness, not the feature:

| ✓ | case |
|---|---|
| ✓ | LibraryPage renders its heading — the page harness works |
| ✓ | IngestionTab mounts and carries its shipped hook — `data-testid` is the right convention |
| ✓ | the rail renders a Library nav control — the rail harness works |

**Four more green cases are load-bearing in a different way** — they are assertions over the
CONTRACT and the live sources that already hold, so the red beside them cannot be blamed on the
mechanism:

| ✓ | case | why it is green |
|---|---|---|
| ✓ | §5 · the contract's own counts are the sketch's numbers | 9 + 3 = 12, 2 attention rows, 3 vs 17 runs, 1 statement — read from the emitted JSON, not typed |
| ✓ | §6 · non-vacuity — both `?raw` imports carry their live source | `sources.py` 11,370 B · `WatchedFoldersSection.tsx` 15,574 B |
| ✓ | §6 · `"instantly"` appears in neither file | SURF-01, already honoured by 234 |
| ✓ | §6 · `"on change"` appears in neither file | SURF-01, already honoured by 234 |

⚠ The two `"instantly"` / `"on change"` cases being GREEN while the two `"scheduled"` cases are RED
is itself evidence the source fences work: same mechanism, same files, opposite verdicts.

---

## §3 What was RED, grouped by the wave that will turn it green

| block / control / property | hook | owning plan |
|---|---|---|
| `source-line` | `sources-source-line` | **Plan 10** |
| `source-card` | `sources-source-card` | **Plan 10** |
| `outcome` | `sources-outcome` | **Plan 10** |
| `stopped-sentence` | `sources-stopped-sentence` | **Plan 10** |
| `history` | `sources-history` | **Plan 10** |
| `run` | `sources-run` | **Plan 10** |
| `quiet-fold` | `sources-quiet-fold` | **Plan 10** |
| `fail-reason` | `sources-fail-reason` | **Plan 10** |
| `instance-statement` | `sources-instance-statement` | **Plan 10** |
| `body-ingestion` | `sources-body-ingestion` | **Plan 10** |
| `fix` · `sync-now` · `toggle-history` · `toggle-quiet` · `report-source` | `sources-*` | **Plan 10** |
| §5 · 9 `source-line` + 3 `source-card`, every source exactly once | — | **Plan 10** |
| §5 · 3 `run` collapsed vs 17 expanded | — | **Plan 10** |
| §5 · `instance-statement` exactly once (D-235-12) | — | **Plan 10** |
| `rail-item` | `rail-rail-item` | **Plan 09** |
| `rail-item-library` | `rail-rail-item-library` | **Plan 09** |
| `badge` | `rail-badge` | **Plan 09** |
| `popover` | `rail-popover` | **Plan 09** |
| `pop-item` | `rail-pop-item` | **Plan 09** |
| `badge` · `open-health` controls | `rail-*` | **Plan 09** |
| `body-health` | `health-body-health` | **Plan 11** |
| `attention-list` | `health-attention-list` | **Plan 11** |
| `attention-row` | `health-attention-row` | **Plan 11** |
| §5 · exactly 2 `attention-row`, and no `source-card` on Health | — | **Plan 11** |
| `go-to-source` control | `health-go-to-source` | **Plan 11** |
| `tab-ingestion` | `sources-tab-ingestion` | **Plan 08** |
| `tab-health` | `sources-tab-health` | **Plan 08** |
| §6 · `"scheduled"` in `backend/app/api/sources.py` | — | **Plan 08** (BUG-260906-02) |
| §6 · `"scheduled"` in `WatchedFoldersSection.tsx:78` | — | **Plan 10** (RESEARCH C-7) |
| §6 · `--color-danger` on a source state (`WatchedFoldersSection.tsx:275`) | — | **Plan 10** |

⚠ **The `--color-danger` red is a REAL shipped violation, not a placeholder.** The status pill at
`WatchedFoldersSection.tsx:274-275` reads
`watch.last_status === "failed" ? "bg-destructive/15 text-destructive"` — the danger token applied
to a source state, which sketch 233 §9 forbids in favour of `--color-warning`. The fence found it
on its first run.

⚠ **`instance-statement`, `tab-ingestion` and `tab-health` are red for DIFFERENT reasons and both
are recorded.** The tab triggers exist in `LibraryPage` today and simply carry no contract hook; the
instance statement does not exist at all. **A missing hook and a missing surface fail identically,
so the plan that turns each green must say which it was.**

---

## §4 The adoption contract

⛔ **The fence is in NEITHER knob of `scripts/vitest-count-gate.cjs` while it is red.** Not `TARGETS`
(what RUNS) and not `BASELINE` (what is GUARDED). The gate's contract is *zero failing, forever*;
adopting a deliberately-red suite would redden every later plan's gate for reasons it did not cause.

⚠ **Measured, so no later plan has to guess:** `src/components/sources` is **not** a TARGETS
directory entry — that directory's suites are pinned one file at a time (`SourceFolderPicker.test.tsx`,
`previewVocabulary.test.ts`, `SourcePreviewPanel.test.tsx`, `WatchedFoldersSection.test.tsx`), and
`sourceComposition.test.tsx` is in none of them. **So the suite does not even RUN in the gate until
it is pinned**, and this plan's red run cannot leak into anyone else's verification.

**Plan 12 sets BOTH knobs in ONE commit**, at the gate's **own printed `— N new` figure**, never a
guessed number, and never while any case is still red. `scripts/vitest-count-gate.cjs` was **not
modified by this plan** — `git diff --name-only` for all three of its commits names it nowhere.

---

## §5 The two gate baselines this phase compares against — MEASURED, not quoted from CLAUDE.md

⛔ **CLAUDE.md's figures for both gates are STALE.** They are recorded here verbatim so no later
plan of this phase quotes them.

**Frontend vitest count gate** — measured 2026-09-06 (research session), from the repo root:

```
total 7544  ·  failed 0  ·  pinned total 6814
count gate OK — 227/227 pinned files present, no per-file decrease, 0 failing.
```

Exit `0`. Re-derive with `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` **from the
repo root** and read the verdict line, never a summary. **A growing number is the gate WORKING** —
its contract is *no per-file DECREASE* and *zero failing*, never a fixed grand total.

**Backend unit suite** — measured 2026-09-06:

```
72 failed, 3785 passed, 2 xfailed, 2 xpassed
```

0 collection errors. Command:
`cd backend && ./venv/Scripts/python.exe -m pytest tests/unit -q --continue-on-collection-errors`.

⛔ **The 72 is PRE-EXISTING and this phase does not inherit the blame for it.** CLAUDE.md's ceiling
reads **71**; Phase 234 measured **72** on its own merge base, so the breach predates 235. **The
operative rule for this phase is: no NEW failure above 72.** A run reading 73+ has a real regression;
a run reading 72 is the inherited state. Record the number verbatim at every wave merge, and do not
"fix" the inherited 72 inside this phase.

---

## §6 The convention deviation, recorded rather than silent

`BUILD-CONTRACT.generated.md` §2 says *"Every entry is a `data-block` the React build must emit
under the same name."* The fence emits `data-testid` instead, because
`sketchComposition.test.tsx:34-38` — the shipped precedent for this exact kind of fence — records
that `data-testid` is the house convention at **~1500 occurrences** and that **`data-block` is the
SKETCH's marker and must never appear in the build**.

**Resolution (RESEARCH C-9, VALIDATION §"The composition fence"): the contract's block NAMES bind;
its attribute spelling does not.** Contradicting a 1500-occurrence house convention on the strength
of one generated sentence would be the wrong trade. Every hook above is
`data-testid="<screen>-<kind>"`, and `grep -n "data-block" sourceComposition.test.tsx` returns three
hits, all inside the docblock that states the prohibition — none inside a `getByTestId` call.
