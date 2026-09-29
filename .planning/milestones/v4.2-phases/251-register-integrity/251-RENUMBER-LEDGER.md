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

## 3 · ⛔ D-17 EXECUTED — the product-source files deliberately left on a stub

> **This section is the ruling being carried out, not an oversight.** D-17 forbids touching any file
> under `backend/`, `frontend/` or `scripts/` in this phase: all of these references are **comments
> or test docstrings, and not one is an executing identifier**. Correcting them would put product
> files in the blast radius of a planning-register phase for zero executable change, and the
> alternative — departing from D-07 on the heaviest pair — is the one judgement call D-07 exists to
> avoid. **The redirect stub (D-05) is the mechanism that keeps every one of them followable**, which
> is exactly what D-05 is for.

### 3a · Re-derived totals — larger than research measured, and the figure published is the new one

```bash
rg --hidden -o 'SEED-(022|092|228|229|231|253|259|269)' backend/ frontend/ scripts/ \
   -g '!**/__pycache__/**' -g '!backend/venv/**'
```

| | `251-RESEARCH.md` §1.8 (2026-09-15) | **measured 2026-09-16, at execution** |
|---|---|---|
| product-source files | 33 | **35** |
| product-source occurrences | 84 | **91** |

⚠ **The plan's own phrase "the 33 files" had rotted by two files and seven occurrences in one day** —
the same class of drift this phase exists to end, and the reason every figure here is re-derived
rather than transcribed. The growth is Wave 1's and Wave 2's own scripts
(`check-seeds-register.cjs`, `migrate-seeds-frontmatter.cjs`), which cite the collisions in comments.

### 3b · The split that actually matters — WRONG vs still-correct

| | occurrences | files |
|---|---|---|
| now land on a **stub** (the reference means the MOVER) | **54** | **25** |
| still resolve correctly (the reference means the KEEPER) | **36** | 10 more |
| genuinely **ambiguous**, left on the stub rather than guessed | **1** | 1 |
| **total** | **91** | **35** |

### 3c · Per-id, with what each reference means

| id | occ | files | what they mean | lands on |
|---|---|---|---|---|
| `SEED-253` | **37** | 16 | ⛔ **ALL mean the MOVER** — the synthetic source path | `SEED-253-superseded-id.md` → `SEED-282` |
| `SEED-259` | **32** | 8 | ⭐ **ALL mean the KEEPER** — tool argument shapes. **No edit needed, including the test FILENAME `test_259_argument_shapes_are_rows_too.py`** | unchanged |
| `SEED-092` | **6** | 5 | ⛔ **ALL mean the MOVER** — every one spells it `SEED-092-remainder` | `SEED-092-superseded-id.md` → `SEED-278` |
| `SEED-231` | **6** | 4 | ⛔ **ALL mean the MOVER** — "nobody is told an approval is waiting" | `SEED-231-superseded-id.md` → `SEED-281` |
| `SEED-022` | **6** | 4 | **4 mean the KEEPER** (camelot precision floor) · 1 means the mover (a historical measurement in `check-seeds-register.cjs:373`, correct as written) · **1 AMBIGUOUS** | mixed |
| `SEED-229` | **3** | 1 | ⛔ **ALL mean the MOVER** — five suites in neither count-gate knob | `SEED-229-superseded-id.md` → `SEED-280` |
| `SEED-269` | **1** | 1 | ⛔ **means the MOVER**, and names the file by its FULL OLD FILENAME | `SEED-269-superseded-id.md` → `SEED-284` |
| `SEED-228` | **0** | 0 | — | — |

### 3d · ⛔ FOUR of the eight ids are read from product code, not one — and the fourth was found HERE

D-17 names **`SEED-253`**. Planning added **`SEED-229`** and **`SEED-231`** and recorded that as
extending the decision's class. **Execution found a fourth: `SEED-092`.**

It was missed twice for a reason worth writing down: the four references are in a11y comments and
a11y tests, and `SEED-092`'s KEEPER is *the app-wide WCAG AA seed* — so "an a11y comment means the
a11y seed" is the natural inference and it is **wrong**. Every one of them spells the name out as
**`SEED-092-remainder`**, i.e. the child, which is the seed that MOVED:

| file:line | what it says |
|---|---|
| `frontend/src/components/ingestion/NavRow.tsx:127` | *"…is logged to `SEED-092-remainder`.)"* |
| `frontend/src/components/skills/SkillCard.tsx:96` | *"…restructure is logged to `SEED-092-remainder`.)"* |
| `frontend/src/components/chat/__tests__/CitationUI.a11y.test.tsx:73` | *"…already logged to `SEED-092-remainder`"* |
| `frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx:176` | *"…logged to `SEED-092-remainder`, explicitly NOT fixed"* |

⭐ **Only reading each hit found this.** A per-id ruling would have marked all six `SEED-092`
references "keeper" and left four comments pointing at the wrong seed forever.
`SEED-092-superseded-id.md` now carries the sentence a developer arriving from any of those four
needs, and says plainly that it is the fourth of the eight rather than pretending it was expected.

### 3e · The full list, by file

**⛔ These 25 files now reference a seed through a redirect stub. Deliberate, under D-17.**

| file | id referenced | occ | means | lands on the stub at |
|---|---|---|---|---|
| `backend/app/services/sources/adapters/mcp_source.py` | `SEED-253` | 2 | `SEED-282` | `SEED-253` |
| `backend/tests/unit/services/sources/test_source_adapter_conformance.py` | `SEED-253` | 6 | `SEED-282` | `SEED-253` |
| `backend/app/services/sources/adapters/microsoft_graph.py` | `SEED-253` | 4 | `SEED-282` | `SEED-253` |
| `backend/tests/unit/services/sources/test_238_source_path_honesty.py` | `SEED-253` | 4 | `SEED-282` | `SEED-253` |
| `backend/app/services/sources/preview_service.py` | `SEED-253` | 3 | `SEED-282` | `SEED-253` |
| `backend/app/services/ingest_enrich.py` | `SEED-253` | 2 | `SEED-282` | `SEED-253` |
| `backend/app/services/sources/import_service.py` | `SEED-253` | 2 | `SEED-282` | `SEED-253` |
| `backend/tests/unit/services/sources/test_238_04_stored_path_is_never_fabricated.py` | `SEED-253` | 2 | `SEED-282` | `SEED-253` |
| `backend/tests/unit/services/sources/test_238_06_search_url_and_folder_path.py` | `SEED-253` | 2 | `SEED-282` | `SEED-253` |
| `backend/tests/unit/services/sources/test_238_microsoft_graph_adapter.py` | `SEED-253` | 2 | `SEED-282` | `SEED-253` |
| `backend/tests/unit/services/sources/test_239_mcp_source_adapter.py` | `SEED-253` | 2 | `SEED-282` | `SEED-253` |
| `backend/app/services/sources/adapters/mock_source.py` | `SEED-253` | 1 | `SEED-282` | `SEED-253` |
| `backend/app/services/sources/base.py` | `SEED-253` | 1 | `SEED-282` | `SEED-253` |
| `backend/app/services/sources/mail/mailbox.py` | `SEED-253` | 1 | `SEED-282` | `SEED-253` |
| `backend/app/services/watch_service.py` | `SEED-253` | 1 | `SEED-282` | `SEED-253` |
| `frontend/src/components/layout/attentionConditions.ts` | `SEED-231` | 3 | `SEED-281` | `SEED-231` |
| `frontend/src/components/layout/__tests__/attentionTab.test.ts` | `SEED-231` | 1 | `SEED-281` | `SEED-231` |
| `frontend/src/components/layout/__tests__/NavPanel.badge.test.tsx` | `SEED-231` | 1 | `SEED-281` | `SEED-231` |
| `scripts/vitest-count-gate.cjs` | `SEED-229` | 3 | `SEED-280` | `SEED-229` |
| `frontend/src/components/ingestion/NavRow.tsx` | `SEED-092` | 1 | `SEED-278` | `SEED-092` |
| `frontend/src/components/skills/SkillCard.tsx` | `SEED-092` | 1 | `SEED-278` | `SEED-092` |
| `frontend/src/components/chat/__tests__/CitationUI.a11y.test.tsx` | `SEED-092` | 1 | `SEED-278` | `SEED-092` |
| `frontend/src/pages/__tests__/SettingsPage.a11y.test.tsx` | `SEED-092` | 1 | `SEED-278` | `SEED-092` |
| `frontend/src/components/chat/ThinkingBlock.tsx` | `SEED-269` | 1 | `SEED-284` | `SEED-269` |
| `scripts/migrate-seeds-frontmatter.cjs` | `SEED-092`, `SEED-231`, `SEED-253` | 5 | `278` / `281` / `282` | the respective stubs |

**✅ These 10 files reference a seed that KEPT its id and need no edit at all:**

`backend/app/models/connector.py` · `backend/app/services/connector_service.py` ·
`backend/app/services/sources/adapters/mcp_source.py` (its 11 `SEED-259` refs) ·
`backend/tests/unit/services/sources/test_259_argument_shapes_are_rows_too.py` ·
`frontend/src/components/settings/connectionFormCopy.ts` ·
`frontend/src/components/settings/SourceToolsCard.tsx` ·
`frontend/src/components/settings/__tests__/ConnectionFormPanel.argumentMapping.test.tsx` ·
`backend/app/services/extractors/aspects/tables.py` ·
`backend/tests/unit/test_aspect_engines_tables.py` · `scripts/check-seeds-register.cjs`

⭐ **`SEED-259`'s 32 references are the biggest block in the whole list and every one of them stays
correct**, because D-07's date rule happened to keep the id on the side the code meant — including
the test **filename** `test_259_argument_shapes_are_rows_too.py`, the only place in the repository
where one of these ids is load-bearing in a path.

### 3f · ⚠ The one genuinely ambiguous reference — left on the stub rather than guessed

`backend/tests/integration/test_pymupdf_in_process.py:5` —
*"Plan 04 keeps the fence and plants `SEED-022` (in-process retry trigger)."*

Neither resolution is *"an in-process retry trigger"*: the keeper is a Camelot table-precision audit
and the mover is a timeout-settings UI. The plan's instruction for this case is explicit — **leave it
pointing at the stub and list it here rather than guessing** — and that is what was done. The
`SEED-022` stub names both resolutions, so a reader who follows it gets a choice rather than a wrong
answer.

---

## 4 · Live references inside the permitted set — decided by READING, one at a time

⛔ **There is no blanket find-and-replace in this plan (T-251-15).** A `sed -i` over the eight ids
would have silently re-pointed every KEEPER reference at the wrong seed. Every hit was read in
context and the rewriter **refuses** a line whose expected occurrence count does not match.

**Enumeration** — ⚠ `--hidden` is load-bearing; without it `rg` skips `.planning/` entirely and
returns a confident, wrong, near-zero (RESEARCH §8.11 published one):

```bash
rg --hidden -n 'SEED-(022|092|228|229|231|253|259|269)' \
  -g '!.planning/milestones/**' -g '!**/node_modules/**' -g '!backend/venv/**' \
  -g '!**/__pycache__/**' -g '!backend/logs/**' -g '!.git/**' .
# 393 hits across 96 files
```

### 4a · What was rewritten — 37 lines across 18 files

| file | lines | id → id |
|---|---|---|
| `docs/HOT-FILE-LEDGER.md` | 1704, 1708 | `269` → `284` (the third elapsed formatter; the one-home seed) |
| | 8305, 9828, 10574, 10631, 10927 | `253` → `282` (the fabricated `/<filename>`) |
| | 9253, 9432, 9463, 9466 | `231` → `281` (the notification tenant / the seam) |
| | 13452 | `229` → `280` (thirteenth suite in neither knob) |
| `CLAUDE.md` | 723 | `253` → `282` (the `preview_service.py` ledger row) |
| `.planning/STATE.md` | 163 | `253` → `282` |
| `.planning/HANDOFF.json` | 44, 138 | `253` → `282` |
| `.planning/HANDOFF-260914.md` | 54 | `253` → `282` |
| `.planning/phases/247-sources-and-watches/247-CONTEXT.md` | 31, **117** | `253` → `282`; line 117 names the **full filename** |
| `.planning/phases/247-sources-and-watches/247-PREFLIGHT.md` | 19 | `253` → `282` |
| `.planning/phases/247-sources-and-watches/.continue-here.md` | 24, 52, 78 | `253` → `282` |
| `.planning/sketches/233-the-source-says-what-it-did/README.md` | 205 | `231` → `281` |
| `.planning/reported-bugs/google-drive-adapter-never-writes-source-path.md` | 11 | `253` → `282` (`related_seeds`) |
| `.planning/reported-bugs/onedrive-adapter-silently-truncates-and-mismatches-folder-paths.md` | 11, 68 | `253` → `282` |
| `.planning/reported-bugs/inter-tool-narration-renders-in-the-message-body.md` | 11, 158 | `259` → `283` |
| `.planning/seeds/SEED-256-…` | 19 | `253` → `282` |
| `.planning/seeds/SEED-270-…` | 79 | `253` → `282` |
| `.planning/seeds/SEED-235-…` | 15 | `231` → `281` |
| `.planning/seeds/SEED-234-…` | 12, 59 | `228` → `279` |
| `.planning/seeds/SEED-189-…` | 11, 16 | `022` → `277` |
| `.planning/seeds/SEED-040-…` | 48 | `SEED-022/023` → `SEED-277 / SEED-023` |

⭐ **36 of the 37 are provably PURE id swaps** — the `+` line with the new id mapped back to the old
reproduces the `-` line byte-for-byte. The thirty-seventh is `SEED-040:48`, the one deliberate
expansion: the shorthand `SEED-022/023` would have become `SEED-277/023`, which reads as a fraction.

### 4b · What was deliberately LEFT — and why each class is correct

| class | hits | why it is left byte-unchanged |
|---|---|---|
| `.planning/milestones/` (sealed) | — | **D-06.** Not scanned, not touched; `git diff --name-only .planning/milestones/` is EMPTY |
| **`.planning/phases/251-register-integrity/`** | **123** across 10 files | ⛔ **This phase's own record IS the evidence of the collision.** `251-GATE-BASELINE.md` pastes the gate's verbatim pre-migration output; `251-RESEARCH.md` carries the measured 8-pair table; `251-CONTEXT.md` states D-05/D-07/D-17/D-20 about the ids as they were. **Rewriting a transcript makes it a lie about what the command printed.** Every `SEED-022` in that directory correctly means *the id as it stood* |
| `.agent-bus/OPEN.md` | 13 | A historical message log outside `.planning/` and outside D-06's live list. Same class as an archive: it records what was said on a date |
| references that mean the **KEEPER** | 55 | Already correct. Rewriting them is the exact spoofing failure T-251-15 names — among them `docs/HOT-FILE-LEDGER.md`'s eight `SEED-259` rows, four `reported-bugs` entries, `PROJECT.md:401`, and `SEED-230`'s three (*"it is NOT SEED-228… a separate live bind about whole-library intent"*, which says out loud which side it means) |
| the 8 stubs + the 8 keepers' self-references | 75 | Correct by construction |

### 4c · ⭐ ONE reference that LOOKS stale, is NOT, and must never be "fixed"

`.planning/seeds/SEED-281-nobody-is-told-an-approval-is-waiting.md:162` quotes
`attentionConditions.ts`'s own docblock **verbatim**:

> *"The seam exists so `SEED-231` (nobody is told an approval is waiting) can plug in later **without
> a second surface** growing beside this one."*

⛔ **That quotation is accurate precisely because the source file still says `SEED-231`** — D-17
leaves it there. Rewriting the quote to `SEED-281` would make the seed lie about what the module
says. It stays, and this row is why.

### 4d · ⛔ FOUR moved files still titled themselves with the OLD id — caught by the re-scan

The renumber updated `seed_id:` and added `renumbered_from`, and **four of the eight moved files
still carried the old id in their own `# H1` heading**:

| file | was | now |
|---|---|---|
| `SEED-277-timeout-settings-ui.md:26` | `# SEED-022 — Timeout Settings UI with Tier Presets` | `# SEED-277 — …` |
| `SEED-278-remainder.md:37` | `# SEED-092-remainder — the exhaustive WCAG 2.1 AA audit…` | `# SEED-278 — …` |
| `SEED-281-nobody-is-told-an-approval-is-waiting.md:67` | `# SEED-231 — the run stopped and asked…` | `# SEED-281 — …` |
| `SEED-284-one-home-for-the-elapsed-formatter.md:43` | `# SEED-269 — one home for the elapsed formatter` | `# SEED-284 — …` |

⛔ **This is the `SEED-068` bad precedent one field over** — a file whose internal id disagrees with
its filename, invisible to every scan. The gate greps `seed_id`, not `# H1`, so **it stayed green
throughout and could never have caught this.** The re-scan of the permitted set did.
