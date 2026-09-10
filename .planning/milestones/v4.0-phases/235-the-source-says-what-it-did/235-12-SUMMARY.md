---
phase: 235-the-source-says-what-it-did
plan: 12
subsystem: guardrails
tags: [count-gate, hot-file-ledger, seeds-register, reported-bugs, phase-close, surf-02, surf-03, lib-10]
status: complete
requires:
  - "all eleven prior plans, merged — the suites this plan pins were built by 02/04/08/09/10/11"
  - "scripts/vitest-count-gate.cjs — both knobs, and the exit-2 pairing rule"
  - "CLAUDE.md hot-file ledger — the re-derivation recipe and the 200-char disposition cap"
provides:
  - "ten suites adopted in BOTH count-gate knobs, at the gate's own printed figures"
  - "seventeen new hot-file ledger rows + sections; eleven stale rows corrected"
  - "SEED-231's seam named by FILE and SYMBOL, with D-235-02's two-part trigger in frontmatter"
  - "BUG-260906-02 closed per part, with a re_open_trigger naming what closure does NOT cover"
  - "235-BASELINE.md §7 — the green adoption run paired with the red one"
affects:
  - "every future plan: the gate now guards 237 files, +10"
  - "the next phase in src/components/sources — WatchedFoldersSection.tsx more than DOUBLED and its seam is named"
  - "whoever finishes the composition fence — 16 reds, itemised with owners, in FOUR places"
tech-stack:
  added: []
  patterns:
    - "both knobs in ONE commit, at the gate's OWN printed `— N new` figure, and never while red"
    - "a red guard is EXCLUDED loudly with a two-part trigger, never pinned with an allowance"
    - "a ledger triple is re-derived at the phase's FINAL commit — research figures rot within days"
    - "a discharge is VERIFIED by reading the code, never assumed from a plan's expectation"
key-files:
  created:
    - .planning/phases/235-the-source-says-what-it-did/235-12-SUMMARY.md
  modified:
    - scripts/vitest-count-gate.cjs
    - CLAUDE.md
    - docs/HOT-FILE-LEDGER.md
    - .planning/ROADMAP.md
    - .planning/seeds/SEED-231-nobody-is-told-an-approval-is-waiting.md
    - .planning/reported-bugs/watch-sync-button-reports-success-for-work-that-cannot-happen.md
    - .planning/phases/235-the-source-says-what-it-did/235-BASELINE.md
    - .planning/phases/235-the-source-says-what-it-did/deferred-items.md
decisions:
  - "⛔ THE FENCE IS NOT PINNED. `sourceComposition.test.tsx` closes at 16 failed / 33 passed and is in NEITHER knob. Pinning a red suite reddens the shared gate for the whole repository; pinning it with an allowance makes a gate that CANNOT FAIL — literally what sketch 218 shipped and what this fence exists to prevent"
  - "⛔ The sixteen were NOT repaired here. Two need a `data-testid` on LibraryPage's shipped TabsTriggers — product surface, forbidden to a closeout (G-7) — and five fixture/harness repairs at a FINAL commit, with no wave left to review them, would silently change what the fence measures"
  - "SEED-231 stays `status: planted`. The surface it needs shipped; its own need did not. `folded` would be a lie the register then carries forever"
  - "CLAUDE.md's backend ceiling of 71 was NOT re-pinned. This run measured exactly 71 — but the phase measured 72 elsewhere on the same tree, so the real finding is that a zero-headroom gate is non-deterministic. That is an operator decision, raised below"
  - "Ledger rows were added for `nav-items.ts` and `librarySelection.ts` even though this phase did NOT modify either — a file that was CONSIDERED and deliberately left alone is invisible unless it is written down"
requirements-completed: [SURF-02, SURF-03, LIB-10]
metrics:
  duration: ~95min
  tasks_complete: 3 of 3
  completed: 2026-09-06
---

# Phase 235 Plan 12: Adopt the guards, make the invisible files visible, and leave nothing deferred without a trigger — Summary

**Ten suites are now guarded that were guarded by nothing, seventeen files that G-5 could never
have fired on are visible to it, and the one guard this plan REFUSED to adopt is refused in
writing, in four places, with a two-part re-open trigger.**

All three tasks complete. The count gate reads **`count gate OK — 237/237 pinned files present, no
per-file decrease, 0 failing`**. `check-claude-md-size.cjs` exits 0 at **117,742 chars**. The
backend unit suite reads **71 failed** — *at* CLAUDE.md's ceiling and one *below* this phase's own
baseline of 72. `tsc` is unchanged at **66**. `check-deploy-drift.sh` PASSES.

---

## ⭐ THE DECISION THIS PLAN EXISTED TO GET RIGHT, AND IT IS A REFUSAL

`frontend/src/components/sources/sourceComposition.test.tsx` — the phase's entire design-contract
fence, generated from sketch 233's own `data-block` markers — **closes this phase in NEITHER
count-gate knob, and it is still red.**

```
$ cd frontend && npx vitest run src/components/sources/sourceComposition.test.tsx
 Test Files  1 failed (1)
      Tests  16 failed | 33 passed (49)
```

### The trajectory is real progress, and it is published so the remainder is legible

| when | fence | what moved it |
|---|---|---|
| `235-03` landed it (the deliverable was the RED run) | **37 failed / 12 passed** | — |
| after plans 09 + 10 | **26 / 23** | the rail badge and the source card were BUILT |
| after plan 11 built the Health section | **22 / 27** | four blocks appeared |
| after plan 11 repaired §3's single-match assertion | **16 / 33** | six more, all already built |

**Twenty-one cases turned green by BUILDING THE SURFACE the fence named.** That is the fence
working exactly as designed — it named missing blocks, and the blocks stopped being missing.

### Why the remaining sixteen were not pinned, and not repaired

| option | verdict |
|---|---|
| Pin it as-is with a failure allowance | ⛔ **Refused.** The gate's contract is *zero failing, forever*. A gate with an allowance is a gate that cannot fail — the exact property sketch 218 shipped, whose operator verdict was *"nothing at all like what we designed"*, and which this fence exists to prevent a third time. |
| Repair all 16 here, then pin | ⛔ **Refused, for two independent reasons.** (a) Two of the sixteen need a `data-testid` on `LibraryPage`'s shipped `TabsTrigger`s — **product surface, which a closeout plan may not build (G-7)**. (b) The other fourteen are five distinct fixture/harness repairs, each of which **changes what the fence measures**, landing at a phase's FINAL commit with no wave left to review them. |
| Pin the ten green suites; leave the fence out; itemise every red with an owner | ✅ **Taken.** |

### The sixteen, itemised — and **NONE of them is a missing surface**

| # | red cases | cause class | proven live by (a suite this plan just PINNED) |
|---|---|---|---|
| 2 | §3 `sources-instance-statement` · §5 *appears exactly once* | **fence fixture** — `primeMocks` primes `getSourceHealth` with `reader_running: true`, and D-235-12 renders the statement ONLY when the reader is off. **A one-word fixture change.** | `IngestionTab.readerOff.test.tsx` (5) |
| 5 | §3 `sources-history` · `sources-run` · `sources-quiet-fold` · `sources-fail-reason` · §4 `sources-toggle-quiet` | **behind a click** — all five live inside `RunHistoryList`, which mounts on first expansion; §3/§4 assert at MOUNT, §5 clicks `toggle-history` first and passes. | `RunHistoryList.test.tsx` (18) |
| 1 | §5 *collapsed 3 / expanded 17* | **fence fixture** — `SAMPLE_RUNS` carries no `status`, no `listing_complete` and none of the six `count_*` fields, so `isQuiet` is false for all 17 and nothing folds. | `runHistoryFold.test.ts` (17) |
| 1 | §4 `sources-report-source` | **fence fixture** — the third card row is `last_status: "paused", is_active: false` with no `degraded: true`. | `WatchedFoldersSection.test.tsx` (now 27) |
| 5 | §3 `rail-badge` · `rail-popover` · `rail-pop-item` · §4 `rail-badge` · `rail-open-health` | **fence harness** — `mountScreen("rail")` mounts `NavPanel` with no `attentionConditions`, no `onOpenLibraryHealth` and no health mock, and plan 09's contract is that **an unwired caller gets SILENCE rather than a dead control**. **A three-line widen.** | `NavPanel.badge.test.tsx` (14) |
| 2 | §3 `sources-tab-ingestion` · `sources-tab-health` | ⛔ **NOT a fixture defect** — the Library's tab triggers carry no contract hook at all. The only group needing shipped product code to change. | — |

**2 + 5 + 1 + 1 + 5 + 2 = 16.** Fourteen of the sixteen are provable against a suite pinned in this
very commit — **the strongest available evidence that the surfaces exist and it is the fence's own
harness that has not caught up.**

### ⚠ The exclusion is recorded in FOUR places, so a grep of any one finds it

1. `scripts/vitest-count-gate.cjs` — the `TARGETS` comment block.
2. `scripts/vitest-count-gate.cjs` — the `BASELINE` comment block. **Deliberately duplicated**, so a
   reader who greps one knob cannot conclude the omission was an oversight.
3. `deferred-items.md` — with a **two-part `trigger_when`**.
4. `235-BASELINE.md` §7 — beside the red run it pairs with.

**The two-part trigger, verbatim:** *(1) the next plan that edits the fence's fixtures or harness —
fourteen reds, each provable against a now-pinned suite; **OR** (2) the next plan that edits
`LibraryPage.tsx`'s `TabsTrigger`s — two attributes, trivial for a plan already in that file.* Two
independent conditions, so the item cannot be orphaned by whichever arrives first.

---

## Task 1 — ten suites adopted, both knobs, one commit (`518611b20`)

### The gate's OWN printed `— N new` figures — never a guessed number, never one from a summary

Measured on the run made with the ten `TARGETS` lines added and the ten `BASELINE` keys still
absent, so every figure is the gate reading the file rather than a summary recollecting it:

| suite | printed | before | after |
|---|---|---|---|
| `src/components/sources/sourceHealthVocabulary.test.ts` | **42** new | neither knob | BOTH |
| `src/components/sources/runHistoryFold.test.ts` | **17** new | neither | BOTH |
| `src/components/sources/RunHistoryList.test.tsx` | **18** new | neither | BOTH |
| `src/components/sources/WatchedFoldersSection.history.test.tsx` | **17** new | neither | BOTH |
| `src/components/library/__tests__/IngestionTab.readerOff.test.tsx` | **5** new | neither | BOTH |
| `src/components/library/__tests__/SourcesAttentionSection.test.tsx` | **13** new | neither | BOTH |
| `src/components/layout/__tests__/NavPanel.badge.test.tsx` | **14** new | neither | BOTH |
| `src/components/layout/__tests__/ChatLayout.badge.test.tsx` | **5** new | neither | BOTH |
| `src/hooks/__tests__/useSourceAttention.test.tsx` | **13** new | neither | BOTH |
| `src/pages/__tests__/LibraryPage.initialTab.test.tsx` | **6** new | neither | BOTH |
| `src/components/sources/WatchedFoldersSection.test.tsx` | **6 → 27** (`+21`) | BOTH, pinned 6 | re-pinned **27** |

⭐ **THE ARITHMETIC CLOSES WITH NO RESIDUAL — that is what separates GROWTH from DRIFT.** The ten
`— N new` figures sum to **exactly +150**; the grand total moved **7565 → 7715**. The pinned total
moved **6814 → 6985 = +171 = 150 + 21**, the 21 being the re-pin. An unexplained `+n` is the thing
to worry about; a bigger number that reconciles is the gate working.

⚠ **Three suites this phase MODIFIED needed NO re-pin, and that was measured rather than assumed:**
`librarySelection.test.ts` = **25** (pinned 25), `renameFence.test.ts` = **15** (pinned 15),
`IngestionTab.test.tsx` = **40** (pinned 40).

### ⚠ Checked against the array, never assumed — and the check mattered

**None** of `src/components/sources`, `src/components/library`, `src/components/layout` or
`src/hooks` is a `TARGETS` directory entry. The whole array contains **exactly TWO** directory
entries — `src/landing` and `src/components/workflows` — and a path entry recurses into nothing. So
all ten suites needed their own path line. This is the inverse of Phase 214's
`WorkflowScheduleModal.test.tsx` finding (it RAN for phases while guarding nothing), and both come
from not looking. **The gate's own comment at `:3187` already records an earlier author getting this
exactly backwards** for `src/components/library`.

### The green run, verdict line VERBATIM

```
  total                                      6985    7715    +730
  total 7715  ·  failed 0  ·  pinned total 6985
count gate OK — 237/237 pinned files present, no per-file decrease, 0 failing.
```

Exit **0**. `227/227` → **`237/237`** (+10).

⚠ **The `+730` residual is unpinned suites the gate RUNS but does not GUARD**, and they are NAMED
rather than left as an anonymous number (Phase 214's practice): `PromptVariableChips.test.tsx` (3),
`RunHero.test.tsx` (18), `automationFacts.test.ts` (11), `nodeEffectBanner.test.ts` (8),
`toolReadOnlyMap.test.ts` (7). **Not adopted here on purpose** — pinning a stranger's suite at a
closeout commit pins a number nobody has reviewed. Logged with a trigger.

### The mechanical both-knobs check — verified by script, not by eye

```
OK   TARGETS=true BASELINE=true onDisk=true  src/components/sources/sourceHealthVocabulary.test.ts
…  (11 rows, all OK)
FENCE  TARGETS-entry=false  BASELINE-key=false  mentioned-in-a-comment=true
both-knobs check OK
```

The fence assertion is deliberately two-sided: it fails if the fence appears in **either** knob, AND
it fails if the fence is **not mentioned at all** — because an exclusion nobody can find is
indistinguishable from an oversight.

---

## ⚠ A SEED-171 FLAKE FIRED TWICE, AND THE PROCEDURE WAS FOLLOWED RATHER THAN THE CAP TOUCHED

The first two gate runs read **`failed 1`**; the third read **`failed 0`** on a tree whose only diff
was the gate's own knobs. **The failing filename was captured from the gate's own persisted JSON
report BEFORE anything was re-run**, both times, and it was the same case:

```
src/pages/WorkflowBuilderPage.canvas.test.tsx
  > WorkflowBuilderPage 184-11 — with the flag OFF the panel receives NO rails key (D-14)
    POSITIVE CONTROL — with the flag ON the very same read finds the key
  AssertionError: expected 0 to be greater than 0
```

- **SEED-171's fifth named suite**, failing with **its own recorded signature verbatim** — the same
  `AssertionError: expected 0 to be greater than 0` on the same POSITIVE CONTROL.
- **Provably unmodified by Phase 235:** `git log -1` on the file names `cce6ffab6 feat(214.1-01)`.
- ⛔ **The cap was NOT touched.** `GSD_VITEST_MAX_WORKERS=2` held on all three runs.
- ⚠ **Recorded as an OBSERVATION, never as proof of innocence.** One green sample of a flaky suite
  proves nothing. What it does confirm is CLAUDE.md's own consequence: **`count gate OK` is not
  reliably reachable on demand**, so the deterministic evidence is the per-file arithmetic above —
  never the colour of a single run.

---

## Task 2 — seventeen invisible files, eleven stale rows (`a9684f836`)

### ⚠ The recipe was RUN. Seven of the eight triples `235-RESEARCH.md` published were ALREADY WRONG

Research measured them on 2026-09-06 **before the phase wrote a line**. Commands used (CLAUDE.md's
own recipe, with `--follow` and the six-digit quick-task buckets subtracted **and printed**, so the
arithmetic is auditable):

```bash
git log --oneline --follow -- <file> | wc -l
git log --format=%s --follow -- <file> | sed -E 's/^[a-z]+\(([^)]+)\).*/\1/' \
  | sed -E 's/-.*//' | grep -E '^[0-9]+(\.[0-9]+)?$' | sort -u    # then subtract ^[0-9]{6}$
wc -l <file>
```

| file | RESEARCH said | re-derived at the final commit |
|---|---|---|
| `NavPanel.tsx` | 19 / 10 / 237 | **20 / 11 / 329** |
| `nav-items.ts` | 8 / 6 / 95 | **8 / 6 / 95** ← the one that held |
| `App.tsx` | 30 / 22 / 326 | **31 / 23 / 351** |
| `HealthTab.tsx` | 8 / 1 / 184 | **9 / 2 / 199** |
| `librarySelection.ts` | 2 / 2 / 312 | **2 / 2 / 312** ← held (the phase did not modify it) |
| `lib/api/sources.ts` | 2 / 0 / 163 | **4 / 1 / 296** |
| `IngestionTab.tsx` | 16 / 5 / 487 | **17 / 6 / 512** |
| `LibraryPage.tsx` | 42 / 13 / 866 | **44 / 14 / 922** |

Quick-task buckets subtracted: `LibraryPage.tsx` **2**, `documents.py` **3**, `ingest_enrich.py`
**1**, `vitest-count-gate.cjs` **3**.

### ⚠ TWO FILES WERE INVISIBLE TO G-5 FOR THEIR ENTIRE LIVES, AT 11 AND 23 PHASES

- **`frontend/src/App.tsx` — 31 / 23 / 351.** The application's ROOT component. G-5's threshold is
  three. **It could never have fired, at any count, for twenty-three phases.**
- **`frontend/src/components/layout/NavPanel.tsx` — 20 / 11 / 329.** Same, for eleven.

**The mechanism is not carelessness and it must not be read as such:** the G-5 audit compares
`files_modified` against CLAUDE.md's table, so **a file that has never been in the table cannot be
found by the audit.** That is the identical failure `WorkflowsPage.tsx` suffered for ten phases,
`db/workflows.py` for seventeen and `ChatArea.tsx` for twenty-eight.

Both of this phase's changes are honoured by construction, and the arithmetic says so rather than
the prose: `NavPanel` gained two OPTIONAL props and
`git diff | grep '^+' | grep -cE "useState|useEffect"` reads **0**; `App.tsx` gained one navigator
in **the exact shape `handleOpenStudio` already had** twenty lines above.

### ⚠ ELEVEN EXISTING ROWS WERE STALE — and one was wrong by TEN PHASES while reading "honoured by construction"

| file | row read | re-derived | drift |
|---|---|---|---|
| `backend/app/config.py` | 78 / 37 / 1428 | **82 / 47 / 1489** | ⚠ **+10 PHASES** |
| `frontend/src/components/sources/WatchedFoldersSection.tsx` | 2 / 0 / 393 | **4 / 1 / 935** | ⚠ **+542 L — it MORE THAN DOUBLED** |
| `backend/app/api/sources.py` | 2 / 0 / 356 | **5 / 1 / 643** | +287 L |
| `frontend/src/components/chat/ChatArea.tsx` | 67 / 32 / 595 | **70 / 35 / 678** | +3 phases |
| `backend/app/api/documents.py` | 75 / 32 / 2408 | **85 / 33 / 2437** | +10 commits |
| `scripts/vitest-count-gate.cjs` | 159 / 36 / 4687 | **167 / 38 / 4786** | +8 / +2 / +99 |
| `frontend/src/pages/LibraryPage.tsx` | 40 / 12 / 825 | **44 / 14 / 922** | +2 phases |
| `frontend/src/components/layout/ChatLayout.tsx` | 46 / 24 / 921 | **49 / 25 / 997** | +1 phase |
| `frontend/src/components/library/IngestionTab.tsx` | 13 / 4 / 456 | **17 / 6 / 512** | +2 phases |
| `backend/app/db/watches.py` | 1 / 1 / 439 | **2 / 2 / 634** | +195 L |
| `backend/app/services/watch_service.py` | 2 / 1 / 458 | **3 / 2 / 599** | +141 L |

⭐ **`WatchedFoldersSection.tsx` is the one to read twice: 393 → 935 lines in a SINGLE phase**, while
its row still read `young (234) · 0 phases`. It is now the phase's largest surface and it sits at
**1 phase**, so G-5 will not fire on it until two more phases have touched it — by which time it may
be 1,500 lines. **So the seam is named NOW rather than at the threshold:** the per-source card
(outcome line, stopped sentence, degraded/report row, history disclosure) is a distinct concern from
the roster that lists them — **extract `WatchedSourceCard.tsx` before the next feature lands here.**

### Completeness, verified mechanically

```
26 non-test source files in the phase diff
ledger completeness OK          ← every one has BOTH a CLAUDE.md row and a HOT-FILE-LEDGER.md section
```

⚠ **The checker had to be corrected TWICE, and both corrections are findings about the files, not
about the checker being sloppy:**
1. The tracked files check out **CRLF** here, so a naive `"\n## path\n"` probe reported 11 false
   MISSING sections.
2. **`docs/HOT-FILE-LEDGER.md` carries TWO heading conventions** — `## path` (the Phase 233/234
   sections) and ``### `path` `` (older ones, sometimes with a trailing ` — note`). A probe
   accepting only one reported **7** more false misses. Any future mechanical sync check must accept
   both, or it will "find" drift that is not there.

### `nav-items.ts` and `librarySelection.ts` got rows although this phase did NOT modify them

⭐ **That is deliberate and it is the more useful record.** `App.tsx`'s new comment states the
decision verbatim: *"NO TWELFTH `ActiveView` MEMBER. The Library already has one… What was missing
was never a view."* **A file that was CONSIDERED and deliberately left alone is invisible unless it
is written down** — and `librarySelection.ts` is now a type the app root compiles against.

### The size gate

```
  CLAUDE.md   117742 chars   78.5% of limit   headroom 32258   [OK]
claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.
```

Exit **0**, no `[disposition-too-long]`, no `[duplicate-row]`, no `[malformed-row]`.

⚠ **BUT READ THE MARGIN: 117,742 against a WARN BAND of 120,000 — 2,258 characters.** This plan
added 17 rows (+4,951 chars). **The next phase that adds a comparable number of rows crosses the
warn band**, at which point CLAUDE.md's own rule says the split is *scheduled, not scrambled*. It is
recorded here rather than left for whoever trips it, because this file's documented failure mode is
that the trip is noticed three commits late.

---

## Task 3 — every deferral has a live trigger, every discharge has a check (`e46a55cd4`)

### ⚠ D-235-20 WAS ALREADY DISCHARGED, AND THE PLAN'S EXPECTATION WAS WRONG

`235-12-PLAN.md` instructed: *"Correct Phase 235's `**Migrations**` line from `161` to `172`."*
**Measured: it already reads `172` and already carries the D-235-20 correction note**, made at
planning time. Nothing needed correcting.

⭐ **This is recorded rather than passed over silently, because it is the same rule D-235-18 turns
on:** *verify a discharge, do not assume it.* A plan that had "corrected" this from a stale
expectation would have been editing a file that was already right.

**What the ROADMAP DID need:** all twelve plan checkboxes ticked (12 `- [ ]` → 12 `- [x]`, verified
against 12 `235-NN-PLAN.md` files on disk), and a note that the Plans line's `12 plans in 5 waves`
matches reality.

### SEED-231 — the seam is now named by FILE and by SYMBOL

The seed already carried D-235-02's option-C deferral in its body (written at planning). **What it
did not carry, and now does:**

- **Frontmatter** (`status:` is the index; prose in the body is invisible to the register scan) now
  holds `seam:`, `deferred_options:` with the two-part `trigger_when:`, `last_reviewed: 2026-09-06`
  and `reviewed_at_phase: 235`.
- **The seam is named exactly:** `frontend/src/components/layout/attentionConditions.ts`, and
  specifically its **`ATTENTION_PRODUCERS`** array — quoting that module's own docblock, which names
  SEED-231 by id.
- ⛔ **The one-tenant rule is reframed as being FOR this seed, not against it.**
  `NavPanel.badge.test.tsx` asserts `ATTENTION_PRODUCERS.length === 1` **literally**, so the next
  author must come to that file and argue with a number. That constraint exists to stop an unrelated
  phase quietly acquiring the slot; **wiring N-1 is a deliberate registration, and re-baselining the
  assertion in the same commit is the intended way past it.**
- ⚠ **A new constraint recorded for whoever builds it:** `attentionConditions.ts` derives no
  verdict. An approval producer must therefore bring its own **server-side** "is an approval
  waiting" answer — a client-side scan of run rows would be the second-source-of-truth the seed's
  own rule 2 forbids.

**`status:` stays `planted`, deliberately.** The surface shipped; this seed's own need did not.
Flipping to `folded` would be a lie the register would then carry forever. A `status_note:` says so
in the frontmatter, where the scan reads.

### BUG-260906-02 → `closed`, verified **per part**, in code

| part the report asked for | shipped? | evidence |
|---|---|---|
| 1. **Refuse rather than accept** | ✅ plan 235-07 | `backend/app/api/sources.py:379-392`. ⭐ **BETTER than the fix shape asked for**: it tests the **LIVE reader** (`getattr(request.app.state, "watch_service", None)`) rather than `settings.watch_process_enabled`, because `main.py` swallows a failed start and leaves the flag reading true — **the flag is not the fact.** It returns `status="refused"` and **writes nothing**; poking a column no process reads is the false promise itself. |
| 2. **Report the outcome, not the request** | ✅ plan 235-10 | `WatchedFoldersSection.tsx` — 7 `last_run_at`/`last_status` references, rendered as an outcome line and a stopped sentence, with the cause a **named value** from `failure_cause.py` rather than `last_error` prose. |
| 3. **Say that it was asked** | ✅ plans 235-07 + 235-10 | endpoint answers `status="asked"` with `next_check_within_seconds`; the card holds `pendingAsks`. ⭐ **D-235-16: the pending state clears only when `last_run_at` has advanced PAST the click, never on a timer** — a self-expiring pending state would have been a second overclaim. |

⚠ **Its `re_open_trigger` names what the closure does NOT cover**, so the `closed` cannot be
over-read: **`release_watch` swallows its `connector_sync_runs` INSERT**, so nothing yet proves a run
row is STORED. The rendered outcome line is correct against the `connector_watches` columns this bug
named — and those were always populated — but the **history** behind it is unproven end-to-end.

### D-235-18 — the discharge was VERIFIED, not assumed

⛔ **No plan in this phase implements D-235-18.** `BUG-260906-01` was closed by quick task
`260906-5qd` before planning. This is the record of the check:

| claim | verified how | result |
|---|---|---|
| `ingest_enrich.py` carries the rule-evaluation step | read `:474-530` — the `BUG-260906-01` block and the Phase-118 rule-eval pass, org-scoped so a malformed rule can never evaluate another user's | ✅ present |
| `test_ingest_enrich_shared.py` exists and passes | `pytest tests/unit/test_ingest_enrich_shared.py -q` | ✅ **28 passed** |
| the report reads `status: closed` | frontmatter, with `folded_into: quick-260906-5qd` and `verified_closed_by: quick-260906-5qd (423d12a3e move, 26a93b069 agreement tests)` | ✅ |

### D-235-21 — the measured value of every process-level flag this phase depends on

| where | `WATCH_PROCESS_ENABLED` | how measured |
|---|---|---|
| `backend/app/config.py:1203` (the default) | **`False`** | read at this commit |
| `backend/.env.example:326` | **`false`** | read at this commit |
| `deploy/onebox.env.example:267` | **`false`** | read at this commit |
| the operator's live `backend/.env` | **`true`** | ⚠ **NOT re-measured by me** — reading `backend/.env` is denied to this agent by the secrets guard. The value is `235-RESEARCH.md` C-5's measurement, and it is attributed rather than restated as mine. |

⛔ **THE CONSEQUENCE, STATED PLAINLY: a fresh deployment has the reader OFF.** Both shipped example
files and the code default all read `false`, so an operator who deploys the one-box artifact gets a
product whose watch loop never starts. **That is exactly why D-235-12's instance-level statement is
load-bearing rather than decorative**, and it is why Phase 234 passed every gate while being
incapable of running in the operator's own process.

⭐ **And it is why plan 07's refusal tests the LIVE reader rather than the flag** — because
`main.py` swallows a failed `WatchService.start()` and leaves the flag reading `true`. A flag-based
refusal would have been honest about configuration and silent about failure.

---

## ⛔ THE OPEN QUESTION FOR THE OPERATOR — the backend ceiling, RAISED and NOT re-pinned

CLAUDE.md: *"Milestone v4.0 locks the baseline at **71 failed**… Any new failure above 71 breaks the
gate (**zero headroom**). Never weaken this ceiling without explicit operator authorisation."*

**Measured at this phase's final commit:**

```
71 failed, 3888 passed, 2 xfailed, 2 xpassed, 42 warnings in 136.05s (0:02:16)
```

0 collection errors. Command: `cd backend && ./venv/Scripts/python.exe -m pytest tests/unit -q
--continue-on-collection-errors`.

| reading | when | value |
|---|---|---|
| Phase 234's merge base | before this phase existed | **72** |
| `235-BASELINE.md` | phase start | **72** |
| plan `235-06` | mid-phase | **71** |
| **this close** | final commit | **71** |

**No NEW failure.** The 25 distinct failing FILES are all long-standing rot
(`test_061_consumer.py`, `test_071_1_threadpool_sweep.py`, `test_075_4_unknown_provider_error.py`,
`test_182_validate.py`, `test_190_review_fix_data_layer.py`, `test_sql_service.py`,
`test_streaming_reliability.py`, …), and **not one of them is a Phase-235 test file** — the phase's
five new backend suites (`test_sources_degraded_row.py`, `test_sources_sync_honesty.py`,
`test_failure_cause.py`, `test_source_health_verdict.py`, `test_watch_sync_runs.py`) all pass.

⛔ **The ceiling was NOT edited.** Moving a project-wide gate needs explicit operator authorisation
and a surface phase is the wrong place to do it.

⭐ **But the finding is NOT "72 should become the ceiling" — it is more interesting than that.** The
same tree read **72 twice and 71 twice** across this phase. So the real property is:

> **A gate with ZERO HEADROOM on a NON-DETERMINISTIC measurement will fail for reasons no plan
> controls** — the identical structural problem CLAUDE.md already records for the vitest gate
> (*"`count gate OK` is not reliably reachable on demand"*), which is why that rule pairs the green
> verdict with deterministic per-file evidence.

**The operator's decision, framed as three options rather than one recommendation:**

| option | what it buys | what it costs |
|---|---|---|
| **Leave 71, add a documented ±1 tolerance** | acknowledges the measured variance without weakening intent | the number stops being exact |
| **Re-pin to 72** | matches the worst observed reading | ⚠ silently absorbs one real failure if one ever appears |
| **Pin by NAME, not by COUNT** (`comm -13` over normalised FAILED name-sets, the method this plan used) | ⭐ deterministic — immune to the variance entirely, and it can see a *swapped* failure that a count cannot | a one-off script, and someone has to own the name list |

⭐ **The third is the one this plan would recommend**, because it is the same lesson D-184-08 already
taught the vitest gate: *a failures-only differential cannot see a DELETED test.* A count-only
backend gate cannot see a **swapped** one.

---

## Deviations from Plan

### 1. [Rule 4 → resolved in favour of NOT building] The fence was not adopted, contrary to the plan's Task-1 list

`235-12-PLAN.md` names `sourceComposition.test.tsx` among the suites to adopt. **It was not adopted,
because the same plan forbids it:** *"never a guessed number, and never while the file is red."* The
file is red. Full option table and reasoning above and in `235-BASELINE.md` §7. **No architectural
question was escalated because the plan itself contains the governing rule** — the two instructions
conflicted and the more specific, safety-bearing one won.

### 2. Rows were added for eleven STALE files the plan did not name

The plan named two stale rows (`IngestionTab.tsx`, `LibraryPage.tsx`). **Nine more were measured
stale** and corrected, because a row that is present and WRONG answers the auditor with `satisfied`
and **stops the audit** — which the ledger's own preamble says is worse than an absent row. All
eleven are in this phase's blast radius.

### 3. Rows were added for two files this phase did not modify

`nav-items.ts` and `librarySelection.ts`. Argued above: a file considered and deliberately left
alone is invisible unless written down. The plan's `read_first` named both.

---

## Deferred / out-of-scope

### ⚠ FOUR CLAUDE.md LEDGER ANCHORS DO NOT RESOLVE — pre-existing, NOT fixed here

Found by a mechanical anchor check over all rows. **None is a row this plan wrote; all nineteen of
mine resolve.**

| row | its anchor | the section's actual slug |
|---|---|---|
| `backend/app/services/retrieval_service.py` | `#backendappservicesretrievalservicepy` | `…retrieval_service…` (the row drops the underscore) |
| `backend/app/api/knowledge_health.py` | `#backendappapiknowledgehealthpy` | `…knowledge_health…` |
| `backend/app/api/document_governance.py` | `#backendappapidocumentgovernancepy` | `…document_governance…` |
| `frontend/src/components/workflows/StepCardSection.tsx` | `…tsx--stepcardsectioncontextts` | heading carries a second path |

**Not fixed** — executor scope boundary; none was caused by this plan. **But it matters:** an
unresolved anchor makes a hot file's narrative unreachable from its row, which is the same
same-commit-sync drift the rule exists to prevent. The fix is four characters each (restore the
underscore in the row's anchor). **trigger_when:** the next phase whose `files_modified` names any of
the four.

### The other deferred items

All appended to `deferred-items.md` with concrete triggers: the fence's sixteen reds; `release_watch`
swallowing its INSERT (a **G-4 row, not a unit test** — the first honest check is a non-zero
`count(*)` on `connector_sync_runs` after a real tick); migration 172's grant narrowing (waiting on
measuring which role the asyncpg pool connects as); the prune bound unproven against live rows
(`SEED-250`); the five unpinned stranger suites; and `SettingsPage.a11y.test.tsx`'s four inherited
reds — ⚠ **re-confirmed at this plan by a NEW route: that suite is in neither gate knob, so it never
ran in any of my three gate invocations and the green verdict says nothing about it either way.**

---

## Known Stubs

**None.** This plan writes no product code. Its three commits touch one script's two configuration
arrays, two documentation files, and four planning records.

---

## Threat Flags

No new network endpoint, auth path, file access pattern or schema change.

| threat | disposition | evidence |
|---|---|---|
| T-235-40 — a suite that runs but is not guarded, or is guarded but does not run | **mitigated** | both knobs set in ONE commit and verified per basename by script; the fence's absence from both is asserted two-sidedly |
| T-235-41 — a ledger cell reading `satisfied` that stops the next audit | **mitigated** | 28 triples re-derived at the final commit with the recipe; **11 were found stale and corrected**; no row this plan wrote reads `satisfied` |
| T-235-42 — a deferral with no re-open trigger | **mitigated** | D-235-02's two-part trigger is in SEED-231's **frontmatter**, which is what the register scan reads; six more deferrals carry triggers in `deferred-items.md` |
| T-235-43 — CLAUDE.md crossing 150,000 chars and silently ceasing to apply | **mitigated, with a WARNING** | gate exits 0 at 117,742 — but **only 2,258 below the warn band**, and this plan alone added 4,951. Named above rather than left to be tripped |
| T-235-SC — package installs | **n/a** | **no package was installed.** `package.json` and `requirements.txt` are byte-unchanged |

---

## Guardrails

- **G-5:** `scripts/vitest-count-gate.cjs` (**167 / 38 / 4786**) fires. **Honoured by
  construction:** 10 `TARGETS` lines, 10 `BASELINE` keys, 1 re-pin, two comment blocks — **no logic,
  no threshold and no check was changed.** `CLAUDE.md` and `docs/HOT-FILE-LEDGER.md` are not code.
- **G-7:** not entered. This is the phase's planned closing plan, not a gap-closure round — and the
  fence decision above is precisely a refusal to smuggle a capability into a closeout.
- **G-2:** n/a — no UI surface is authored here.

---

## Self-Check

Files claimed modified — verified present and in the diff:

```
FOUND: scripts/vitest-count-gate.cjs
FOUND: CLAUDE.md
FOUND: docs/HOT-FILE-LEDGER.md
FOUND: .planning/ROADMAP.md
FOUND: .planning/seeds/SEED-231-nobody-is-told-an-approval-is-waiting.md
FOUND: .planning/reported-bugs/watch-sync-button-reports-success-for-work-that-cannot-happen.md
FOUND: .planning/phases/235-the-source-says-what-it-did/235-BASELINE.md
FOUND: .planning/phases/235-the-source-says-what-it-did/deferred-items.md
```

Commits claimed — verified in `git log c719f472d..HEAD`:

```
FOUND: 518611b20  test(235-12): nine suites adopted in both knobs — and the fence is left OUT, loudly
FOUND: a9684f836  docs(235-12): seventeen invisible files get rows, eleven stale ones get the truth
FOUND: e46a55cd4  docs(235-12): every deferral gets a live trigger and every discharge gets a check
```

⚠ **Commit `518611b20`'s subject says "nine suites" and TEN were adopted.** The message was written
against the nine NEW-and-green suites before `WatchedFoldersSection.history.test.tsx` and the
`LibraryPage.initialTab.test.tsx` count were reconciled into one list. **The commit body, the code
and every table in this summary say ten.** Recorded rather than amended — a rewritten history would
hide the discrepancy instead of explaining it.

Plan-forbidden writes — verified NOT in `git diff --name-only c719f472d HEAD`:

```
NOT PRESENT: .planning/STATE.md
NOT PRESENT: any frontend/src or backend/app source file
```

Deletions check — `git diff --diff-filter=D --name-only c719f472d HEAD` is **empty**.

## Self-Check: PASSED

## TDD Gate Compliance

**Not applicable, and stated rather than skipped.** No plan task carries `tdd="true"` and the plan's
frontmatter `type` is `execute`, not `tdd`. This plan authors **no behaviour**: it configures a gate,
records measurements, and edits documentation. The `test(235-12)` commit is correctly typed — it
changes test *configuration*, not test *code*.

## Commits

| hash | message |
|---|---|
| `518611b20` | `test(235-12): nine suites adopted in both knobs — and the fence is left OUT, loudly` |
| `a9684f836` | `docs(235-12): seventeen invisible files get rows, eleven stale ones get the truth` |
| `e46a55cd4` | `docs(235-12): every deferral gets a live trigger and every discharge gets a check` |
