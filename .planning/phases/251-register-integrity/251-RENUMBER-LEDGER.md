---
type: renumber-ledger
phase: 251
plan: "03"
derived: 2026-09-16
derived_by: claude (executor, plan 251-03)
base_commit: a229425b0
rule: "D-07 as amended by D-20 — the OLDEST seed keeps the id, by `created` IF PRESENT ELSE `planted`; ties break on the git ADD-COMMIT timestamp at `--date=iso`"
authority: "the FRONTMATTER date is authoritative; the git timestamp is the TIE-BREAK ONLY"
---

# Phase 251 — the renumber ledger

⛔ **Every figure below was DERIVED at execution time, not transcribed.** The derivation script
(`derive.cjs`, run from the session scratchpad) imports the Wave-1 gate's own reader —
`frontmatter`, `keyValue`, `readKey` — so it cannot disagree with the gate about what a seed's
frontmatter says. The result was then compared against `251-RESEARCH.md` §2.6's table, which was
produced independently a day earlier by a different method (`grep -m1` + `--date=short`).
**They agree on all 8 verdicts**, which is the property D-07 was chosen for: *a rule that produces a
different answer on two runs is not deterministic.*

---

## 0 · The id space — re-derived first, because D-05's `277+` is a claim about today

```
register: 284 files · distinct ids: 276 · highest: 285 · max+1 = 286
the 8 FREE ids at or above 277, in ascending order: 277, 278, 279, 280, 281, 282, 283, 284
```

⚠ **`SEED-285` EXISTS, so the run 277-285 is NOT contiguous and the block has EXACTLY ZERO
headroom.** Eight free slots for eight renumbers. A ninth would have had to jump to **286**, never
reuse 285. The allocation rule is therefore stated rather than merely used:

> **Fresh ids are assigned in ascending order of the OLD id, onto the ascending list of FREE ids.**
> That makes the mapping re-derivable from the register alone — `022→277, 092→278, 228→279,
> 229→280, 231→281, 253→282, 259→283, 269→284` — rather than a lookup table someone has to trust.

---

## 1 · The 8 verdicts — both dates, the supplying key, and the tie-breaks

⚠ **The `date key` column is load-bearing.** D-07 as originally written says *"by `created` date"*,
and **five of the eight pairs carry only `planted:`** — so on 5 of 8 cases the unamended rule cannot
evaluate itself. D-20's `created`-else-`planted` fallback is what makes every row below decidable.

| id | file | date key | date | git add-commit | verdict |
|---|---|---|---|---|---|
| **022** | `SEED-022-camelot-pdf-table-precision-audit.md` | `planted` | 2026-05-16 | 2026-05-16 16:36:22 +0400 | ⭐ **KEEPS 022** |
| | `SEED-022-timeout-settings-ui.md` | `planted` | 2026-05-25 | 2026-05-24 21:34:41 +0400 | → **SEED-277** |
| **092** | `SEED-092-app-wide-wcag-aa-contrast-and-icon-button-labels.md` | `planted` | 2026-06-20 | 2026-06-20 00:18:42 +0400 | ⭐ **KEEPS 092** |
| | `SEED-092-remainder.md` | `planted` | 2026-07-16 | 2026-07-16 01:56:10 +0400 | → **SEED-278** |
| **228** | `SEED-228-a-workflow-cannot-say-the-whole-library-on-purpose.md` | `planted` | 2026-08-28 | 2026-08-28 21:04:29 +0400 | ⭐ **KEEPS 228** |
| | `SEED-228-read-doc-refuses-a-docx-without-saying-why.md` | `planted` | 2026-08-31 | 2026-09-01 00:40:34 +0400 | → **SEED-279** |
| **229** | `SEED-229-does-the-golden-run-hang-on-an-armed-approval-checkpoint.md` | `planted` | 2026-08-28 | 2026-08-28 21:04:29 +0400 | ⭐ **KEEPS 229** |
| | `SEED-229-five-suites-in-neither-count-gate-knob.md` | `planted` | 2026-08-31 | 2026-09-01 00:40:34 +0400 | → **SEED-280** |
| **231** | `SEED-231-decision-coverage-gate-is-blind-to-this-repo-decision-ids.md` | `planted` | 2026-08-29 | **2026-08-29 04:00:08 +0400** | ⭐ **KEEPS 231** (tie-break) |
| | `SEED-231-nobody-is-told-an-approval-is-waiting.md` | `planted` | 2026-08-29 | **2026-08-29 05:03:04 +0400** | → **SEED-281** (tie-break) |
| **253** | `SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md` | `created` | 2026-09-06 | **2026-09-06 08:36:22 +0400** | ⭐ **KEEPS 253** (tie-break) |
| | `SEED-253-source-file-path-is-synthetic-no-adapter-populates-it.md` | `created` | 2026-09-06 | **2026-09-06 22:00:28 +0400** | → **SEED-282** (tie-break) |
| **259** | `SEED-259-tool-names-are-rows-but-argument-shapes-are-not.md` | `created` | 2026-09-08 | 2026-09-08 19:00:01 +0400 | ⭐ **KEEPS 259** |
| | `SEED-259-assistant-narration-repeats-verbatim-across-tool-turns.md` | `created` | 2026-09-13 | 2026-09-13 01:38:28 +0400 | → **SEED-283** |
| **269** | `SEED-269-explanations-are-noise-in-the-form-move-them-behind-an-info-affordance.md` | `created` | 2026-09-10 | 2026-09-10 15:44:49 +0400 | ⭐ **KEEPS 269** |
| | `SEED-269-one-home-for-the-elapsed-formatter.md` | `created` | 2026-09-11 | 2026-09-11 05:55:28 +0400 | → **SEED-284** |

**Date-key split, counted rather than eyeballed: `planted` on 10 of 16 files (pairs 022, 092, 228,
229, 231), `created` on 6 (pairs 253, 259, 269). `created` was absent on 5 of the 8 PAIRS.**

### 1a · The two ties — git consulted on exactly 2 of 8 pairs, and it says so

⛔ `--date=iso`, never `--date=short`. Both ties fall on the SAME DAY; a day-resolution date cannot
separate either, and a script that used `--date=short` would have silently fallen back to filename
order.

| pair | older (KEEPS) | younger (MOVES) | delta |
|---|---|---|---|
| `SEED-231` | `decision-coverage-gate-is-blind…` — 2026-08-29 **04:00:08** +0400 | `nobody-is-told-an-approval-is-waiting` — 2026-08-29 **05:03:04** +0400 | **1h 2m 56s** (62m 56s) |
| `SEED-253` | `mobile-has-no-drawer-trigger…` — 2026-09-06 **08:36:22** +0400 | `source-file-path-is-synthetic…` — 2026-09-06 **22:00:28** +0400 | **13h 24m 06s** |

These reproduce `251-CONTEXT.md` D-20's hand-derived *"63 min"* and *"13h 24m"*, and the Wave-1
gate's independently-derived `62m 56s` / `13h 24m 06s`. **Three derivations, three registers, one
answer.**

### 1b · ⚠ Frontmatter and git DISAGREE on two pairs — stated, never picked silently

| file | frontmatter says | git added | gap |
|---|---|---|---|
| `SEED-022-timeout-settings-ui.md` | `planted: 2026-05-25` | 2026-05-24 21:34:41 +0400 | git is **1 day earlier** |
| `SEED-228-read-doc-refuses-a-docx…` | `planted: 2026-08-31` | 2026-09-01 00:40:34 +0400 | git is **1 day later** |
| `SEED-229-five-suites-in-neither-count-gate-knob` | `planted: 2026-08-31` | 2026-09-01 00:40:34 +0400 | git is **1 day later** |

⛔ **Neither disagreement flips a verdict**, because in all three cases the keeper is older on BOTH
clocks. But the rule is written down rather than left to whichever value a script happened to read
first: **the frontmatter date is authoritative; git is the tie-break only, consulted only when two
members carry the same frontmatter date, and printed when it is.**

### 1c · ⭐ The observation CONTEXT.md asked for — recorded BESIDE the rule, never as a reason to depart from it

**It happens on exactly one pair, and it is the heaviest of the eight.**

`SEED-253` is referenced by ~53 files. **Every live reference outside the archives means the MOVER**
— `source-file-path-is-synthetic-no-adapter-populates-it`, now `SEED-282` — while the keeper,
`mobile-has-no-drawer-trigger-outside-the-chat-view`, is cited essentially nowhere outside its own
file and the sealed archives.

⛔ **D-07 still hands the id to the keeper, and that is correct.** D-07 rejects *"most-referenced
keeps it"* **by name**, on the ground that it optimises the outcome over the principle and leaves no
precedent for the ninth collision. The consequence is real and is paid for by D-05's stub and D-17's
written record, both of which exist for exactly this case. **An exception here would have been the
one judgement call the rule was chosen to avoid.**

---

## 2 · Bodies untouched — D-11's invariant applied to the renames too

Each moved file's BODY was hashed over **raw Buffers** before the write and re-read after it. ⛔ The
frontmatter is spliced as `Buffer.concat([newFrontmatterBuf, originalBodyBuf])`; **no whole-file
line-ending normalisation appears anywhere on the write path**, because 5 of the 8 movers are CRLF
and 3 are LF, and a re-serialised string write silently destroys the difference.

| file → new id | line endings | body bytes | body md5 (before == after) |
|---|---|---|---|
| `timeout-settings-ui` → 277 | CRLF | 2768 | `8ec7add98294b606503c15d9673f3b14` |
| `remainder` → 278 | LF | 8829 | `e43ddd5517b2a613059733984f5e5cb4` |
| `read-doc-refuses-a-docx…` → 279 | LF | 1367 | `68c7f0afe8a8af0a62959c605939951d` |
| `five-suites-in-neither-count-gate-knob` → 280 | LF | 1656 | `e12ca720682acc89d621dc98484f6ae3` |
| `nobody-is-told-an-approval-is-waiting` → 281 | CRLF | 8161 | `e55b4300e8532fd39ac63bb2cf6db22a` |
| `source-file-path-is-synthetic…` → 282 | CRLF | 8189 | `87929077bca1e2e38d12d2961c68514c` |
| `assistant-narration-repeats-verbatim…` → 283 | CRLF | 2018 | `09fa8cabebccb8cd4ef7cbf8a4bed85c` |
| `one-home-for-the-elapsed-formatter` → 284 | CRLF | 2842 | `b068e693be5253cc544484ffb827d602` |

### 2a · ⭐ RED — the invariant driven against a planted defect on a REAL CRLF seed

A scratch copy of `SEED-022-timeout-settings-ui.md` written through the same read-back path, once
with the naive string concat and once correctly:

```
body md5 BEFORE (raw Buffer): 8ec7add98294b606503c15d9673f3b14  2768 bytes

PLANTED DEFECT: re-serialised string concat
  body md5 AFTER : 0f70bf64770ae85920f8c76966dc8f3c
  read-back verdict: REFUSED — BODY md5 CHANGED  <-- RED
  what a NORMALISED-TEXT check would say: identical  <-- the comfortable lie

CORRECT: Buffer.concat
  body md5 AFTER : 8ec7add98294b606503c15d9673f3b14
  read-back verdict: PASS (identical)
```

⛔ **The check most people would write calls the destroyed file identical.** Same finding Wave 2
recorded, re-driven here rather than inherited, because this plan writes to eight more files.

⚠ **And `git checkout -- .planning/seeds/` was NOT used at any point in this plan.** Wave 2 measured
that it re-materialises files through `core.autocrlf=true` and moved **224 of 284 body digests while
`git status` reported the tree clean**. A byte copy of all 285 register files was taken to the
session scratchpad *before* the first rename, and is the only rollback path this plan would have used.

---

## 3 · ⛔ D-17 executed — the 33 product-source files deliberately left on a stub

*(populated by Task 3 — see §4 below)*
