---
phase: 217-the-library-one-home-for-documents
plan: 08
subsystem: frontend-ingestion-surface
tags: [ingestion, stage-strip, source-fence, ordered-comparison, realtime-merge, sketch-contract, wire-types]
requires:
  - "217-01 — DocumentResponse serializes ingestion_step + extractor, and computes tables_stage_applies / images_stage_applies from mime_type"
  - "217-04 — LibraryPage.tsx + the sketch-driver contract this plan re-emits"
  - "217-06 — the drive.cjs lightness() wrong-theme-block finding, which scopes what may be edited in that file"
  - "backend/app/api/documents.py — the six ingestion_step write sites, read rather than transcribed"
provides:
  - "frontend/src/components/ingestion/ingestionStages.ts — INGESTION_STAGES in BACKEND WRITE ORDER + isStageSkipped + stageIndex + stageTermKey"
  - "frontend/src/components/ingestion/IngestionStrip.tsx — six segments, five honest states, no percentage"
  - "frontend/src/types/index.ts — the three new optional Document fields, the corrected ingestion_step docblock, and five detail row types"
  - "frontend/src/components/ingestion/__tests__/IngestionStrip.test.tsx — 25 cases; an ORDERED fence over documents.py's live source"
  - "the sketch drawn in write order + BUILD-CONTRACT.generated.md re-emitted at 198 assertions"
affects:
  - "217-09 / 217-10 / 217-11 — they consume the five detail row types rather than re-deriving them"
  - "frontend/src/components/ingestion/DocumentList.tsx — the strip's intended mount (NOT wired here; no DocumentList change in this plan)"
tech-stack:
  added: []
  patterns:
    - "the ORDERED cross-language fence: dedupe PRESERVING ORDER and compare arrays positionally — a sorted comparison is structurally blind to a reorder, which is the defect this phase exists to fix"
    - "three-guard non-vacuity on a `?raw` import: a LENGTH floor, an IDENTITY symbol, and a COUNT control, all asserted before any claim rests on the extraction"
    - "the exclusion-by-construction pattern with its own positive control: the quoted-value regex cannot admit `\"ingestion_step\": None`, and a case proves that null really is in the source"
    - "`undefined` is not `false`: an unknown server-derived flag renders as PENDING, never as skipped — striking out what cannot be proven skipped is the same lie in the other direction"
key-files:
  created:
    - "frontend/src/components/ingestion/ingestionStages.ts"
    - "frontend/src/components/ingestion/IngestionStrip.tsx"
    - "frontend/src/components/ingestion/__tests__/IngestionStrip.test.tsx"
    - ".planning/phases/217-the-library-one-home-for-documents/deferred-items.md"
  modified:
    - "frontend/src/types/index.ts"
    - "frontend/src/hooks/useDocuments.ts"
    - "frontend/src/__tests__/hooks/useDocuments.test.ts"
    - ".planning/sketches/218-the-library-and-its-tabs/COPY.js"
    - ".planning/sketches/218-the-library-and-its-tabs/index.html"
    - ".planning/sketches/218-the-library-and-its-tabs/drive.cjs"
    - ".planning/sketches/218-the-library-and-its-tabs/BUILD-CONTRACT.generated.md"
decisions: [D-217-01, D-217-02, D-217-09, D-217-10, D-217-11, D-217-19, D-217-23, D-217-24]
requirements-completed: [LIB-03, LIB-04]
metrics:
  duration: "~35 min"
  completed: 2026-08-29
  tasks: 3
  commits: 3
---

# Phase 217 Plan 08: the six stages, in the order the pipeline writes them Summary

**The ingestion strip now draws the six stages `documents.py` actually writes, in the order it
writes them, pinned by an ORDERED fence over that file's live source — and the sketch, which drew
Tables and Images second and third, was corrected to match in the same commit.**

## Task Commits

| | Task | Commit |
|---|---|---|
| 1 | the four wire fields, five detail row types, the reconcile rule named | `b4a262e06` |
| 2 | the stage order constant and the strip's honest renderings | `9793f4a2b` |
| 3 | the ORDERED source fence, the strip suite, the sketch re-emitted | `52a4c645e` |

## ⭐ The six stages were DERIVED from the backend, and the plan's line numbers are the only thing that disagreed

The plan named the write sites at `:1834 / :2014 / :2042 / :2080 / :2091 / :2201`. Measured at this
base with `grep -n '"ingestion_step"' backend/app/api/documents.py`:

```
1543:            "ingestion_step": None,                       ← the reingest reset (D-071-10 step 4)
2069:  "ingestion_step": "extracting"
2249:  "ingestion_step": "chunking"
2277:  "ingestion_step": "embedding"
2315:      "ingestion_step": "extracting_tables"   \  both inside the ONE `if raw and mime_type:`
2326:      "ingestion_step": "extracting_images"   /  block, at :2310
2436:  "ingestion_step": "metadata"
```

**The ORDER the plan claims is correct and the LINE NUMBERS are stale** (they predate plan 01's and
plan 07's additions to that file, ~235 lines earlier in the file's own history). That is the whole
reason the fence compares the extracted sequence rather than any number written in prose: **a line
number rots on the next commit; an ordered extraction does not.** Nothing was quietly conformed —
the backend was read and it agrees.

The two conditional steps are conditional **for a measured structural reason, not a taste one**:
they are the only two written inside `if raw and mime_type:` (`documents.py:2310`), which sits
**after** the chunk insert and the embedding pass. The sketch drew them second and third; a strip
built on that order would light segment 5 and then segment 2 on every PDF — it would visibly jump
backwards.

## The observed RED of the ordered fence

Required by the plan and **driven, not described.** `INGESTION_STAGES` was edited to move
`extracting_tables` between `extracting` and `chunking` (the sketch's old drawn position), and the
suite went red — verbatim:

```
× ⭐ the six stages are in the backend's WRITE ORDER — an ORDERED comparison, never sorted
    AssertionError: expected [ 'extracting', …(5) ] to deeply equal [ 'extracting', 'chunking', …(4) ]
× an unknown or absent ingestion_step yields index -1 rather than throwing
    AssertionError: expected 3 to be 2
× processing — up to the step done, that one active, later pending
    AssertionError: expected 'done' to be 'pending'
Tests  3 failed | 22 passed (25)
```

⭐ **Three cases fired, not one, and the extra two are the point:** the reorder does not merely
break a constant, it changes what the strip RENDERS — a stage that had not run showed as `done`.
That is the user-visible defect D-217-09 names, reproduced.

The file was restored with `git checkout --` and re-run green (25/25). ⚠ **Honest note on the
restore:** the pre-plant `md5sum` read `59e59cbd…` and the post-restore reads `9e8cfa1d…`. The bytes
differ only in line endings — the pre-plant file was the LF version I had just written and git
restored the committed CRLF one (`core.autocrlf`; git warned about this at commit time). The
authority is `git status --short`, which is **clean** for that path, so the tracked content is
byte-identical to the commit. This is the same trap 217-06 recorded, arriving from the other
direction.

## ⚠ The gate knobs: BOTH new/extended suites are outside BOTH, and the gate's total will not move

Derived by parsing `scripts/vitest-count-gate.cjs`'s own `TARGETS` array (43 entries) and `BASELINE`
map, not by eye:

| Suite | in TARGETS (runs)? | in BASELINE (guarded)? | cases |
|---|---|---|---|
| `src/components/ingestion/__tests__/IngestionStrip.test.tsx` | ❌ **no** | ❌ **no** | **25** |
| `src/__tests__/hooks/useDocuments.test.ts` | ❌ **no** | ❌ **no** | **7** (was 5) |

`src/components/ingestion` has **no directory entry** and `src/__tests__` has none either —
`src/pages` is reached by NAMED FILES ONLY and `src/components` only via `workflows` / `panel` /
`settings` / `files` / `chat` / `metadata` / `admin`. So **the gate will neither execute nor guard
either file**, and a green count gate says nothing at all about this plan's 32 cases. This is the
same blind spot wave 2 recorded for nine `src/components/ingestion/` suites, now with two more
files in it.

**`scripts/vitest-count-gate.cjs` was deliberately NOT edited** — it is outside this plan's
`files_modified` and **plan 12 owns the pins**. The two numbers plan 12 needs are in the table
above.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 — Bug] My own docblock reds sketch fence `D4`**

- **Found during:** task 3, first `node drive.cjs` run.
- **Issue:** the corrected `ingestion_step` docblock in `types/index.ts` listed what the terminal
  update writes, and one of those column names is the one `D4` measures has **ZERO non-test
  frontend references**. The fence walks the frontend tree for the literal token; a mention inside
  a comment is indistinguishable from a use. Verbatim: `✗ D4 · … frontend refs: frontend\src\types\index.ts`.
- **Fix:** the column is described rather than named, with a comment saying why — so the next reader
  does not "helpfully" spell it back in. `D4` is a real finding about a buried capability; routing
  around it silently would have deleted the finding.
- **Commit:** `52a4c645e`

**2. [Rule 1 — Bug] My first `A5e` negative arm could not be satisfied by any correct sketch**

- **Found during:** task 3, first `node drive.cjs` run.
- **Issue:** I added `!/Read[\s\S]{0,200}Tbl[\s\S]{0,200}Img[\s\S]{0,200}Split/` to assert the OLD
  drawn order is gone. **The sketch draws EIGHT stage rows**, so `Read` from one row and `Tbl` from
  the NEXT row match across the row boundary regardless of what either row says. The assertion was
  unsatisfiable, not violated.
- **Fix:** the "old order is gone" claim is asserted **per row** (`A5e2`), at the grain the claim is
  actually about: every six-stage row is extracted and each must read exactly
  `Read·Split·Index·Tbl·Img·Label`, with a floor of six rows so it cannot pass over an empty match.
- **Commit:** `52a4c645e`

**3. [Rule 1 — Bug] A case-insensitive `/ETA/i` fence reds on the shipped copy**

- **Found during:** task 3, first suite run. `AssertionError: expected 'Reading the file…' not to
  match /ETA/i`.
- **Issue:** the plain label **"Reading document d-ETA-ils"** contains the substring. A
  case-insensitive substring is the wrong shape for "no acronym" — it forbids ordinary English.
- **Fix:** anchored to `/\bETA\b/` (case-sensitive), with the failure recorded in the test's own
  comment so the looser spelling is not reintroduced.
- **Commit:** `52a4c645e`

### Judgement calls, stated rather than left implicit

- **`pending` documents DO strike out inapplicable conditionals**, where the plan's per-status prose
  says *"`pending` → all six pending"*. Applicability is mime-derived and therefore known before the
  first byte is read, and the plan's own **must_have** is binding the other way: *"A conditional
  stage the pipeline would never run is STRUCK THROUGH, never left as an empty box that looks
  pending."* The must_have was followed. Nothing else about the `pending` arm changes — no segment
  is `done`, `active` or `not-reached` there, which is asserted.
- **FIVE segment states shipped, not four.** The plan says *"exactly four renderings and no fifth"*
  and then lists five bullets, so the two halves of that sentence disagree. The **acceptance
  criteria** are unambiguous — the not-reached rendering must be *"DISTINCT from both the pending
  and the skipped rendering"* — so `done · active · pending · skipped · not-reached` shipped and
  each is asserted distinct. **The failure POINT on a `failed` document did NOT get a sixth state**:
  it carries `data-failure-point` on top of `not-reached`, so it stays identifiable (which
  `text_sanitize.py:9` cares about) without inflating the vocabulary.
- **The strip renders NO status palette at all.** The plan said to take it from
  `DocumentStatusBadge`'s `styles` map; the cleanest way to honour *"never a second status palette"*
  turned out to be to render no document-status badge here — `DocumentList` already mounts one, and
  already renders `error_message`. Segment states use design-system tokens
  (`primary` / `muted` / `border` / `destructive`) and no status colour.
- **Segment labels are `title` + `aria-label` + `sr-only`, not visible text.** Every one comes from
  `usePlainLabel` over `TERM_MAP`'s six `ingest.*` entries, so the ⌥ Technical-names reveal works
  for free and no seventh vocabulary exists. Rendering the full plain labels visibly in six
  segments would have forced either truncation or the sketch's abbreviations — and the
  abbreviations (`Read`/`Tbl`/`Img`/`Split`/`Index`/`Label`) **are** a seventh vocabulary, which the
  plan forbids. ⚠ **This is a real divergence from the drawn sketch** and is flagged for G-4: the
  sketch shows short words inside each segment; the shipped strip shows the shape and names each
  stage on hover / to a screen reader.
- **`DocumentList.tsx` was NOT modified** — the strip has **no mount in the product yet**. It is a
  built component with a suite and no consumer, which is the `RunTranscript.tsx` shape the ledger
  warns about. A later plan mounts it; recorded here so the absence is a decision, not an oversight.

## ⚠ The sketch drive is at `196 passed · 2 failed`, and the two reds are provably NOT this plan's

| | |
|---|---|
| before | `197 passed · 0 failed · 197 assertions` (217-06's close) |
| now | **`196 passed · 2 failed · 198 assertions`** |

`D2` and `D3` both read only `frontend/src/components/ingestion/DocumentUpload.tsx`, which is
**byte-unchanged by this plan** — `git diff --numstat <base> HEAD -- <that file>` is **empty** and
`git status --short` on it is clean. They were broken by **plan 217-07** (`50050df23`), which
replaced the literal `accept="…"` with `accept={acceptAttribute()}` (so `D2`'s extraction now
measures **nothing at all** — it is blind, not merely stale) and added a docblock containing the
word `onUploadProgress` (so `D3`'s source grep reds on a comment while the behaviour it asserts is
still true).

**Left red, deliberately**, under the scope boundary and under this plan's own fence-ownership rule.
Logged with a re-open trigger in
`.planning/phases/217-the-library-one-home-for-documents/deferred-items.md`. **The plan's
`0 failed` acceptance criterion is therefore unmet, and that is stated rather than worked around** —
all three fences this plan owns (`A5b`, `A5e`, `A5e2`) plus `D4` are green.

⚠ **`A5b` was the fence that should have caught the reorder and could not**: it compared
`uniqueSteps.sort()` to `COPY.STAGES.map(key).sort()`, so it read green on a sketch that disagreed
with the pipeline about sequence while agreeing about membership. It now compares ORDERED arrays.
**A guard that cannot fail on the defect it exists for is not a guard.**

## Verification

| Check | Result |
|---|---|
| `vitest run IngestionStrip.test.tsx --maxWorkers=2` | ✅ **25 passed / 0 failed** |
| `vitest run useDocuments.test.ts --maxWorkers=2` | ✅ **7 passed** (was 5; +2 Realtime seam cases) |
| both together | ✅ **32 passed / 0 failed** |
| the ordered fence's RED, driven | ✅ **3 failed / 22 passed** under a planted reorder; restored, `git status` clean |
| `npx tsc --noEmit -p tsconfig.app.json` | ✅ **33 errors** — identical to the re-derived pre-plan baseline; **0 new** |
| `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs` | ⚠ **196 passed · 2 failed** — both pre-existing, both plan 07's, both on a byte-unchanged file |
| `BUILD-CONTRACT.generated.md` regenerated from the driver | ✅ `--emit`, never hand-edited |
| the contract's two stage orders now AGREE | ✅ `Reading → Splitting → Indexing → Tables? → Images? → Labelling` (`:32`) and `extracting → chunking → embedding → extracting_tables → extracting_images → metadata` (`:81`) — the D-217-09 contradiction inside one file is resolved |
| `git diff drive.cjs` shows no hunk at `A3b` / `A7b` / `A7c` / `src()` | ✅ hunks at `A5b`, `A5e`, `A5e2` only |
| `git diff useDocuments.ts` is comment-only | ✅ every added line is `//`; no statement, branch or hook call changed |
| the cap | held at `2` on every run; nothing red that was not diagnosed and named |

## G-5 statement — `frontend/src/hooks/useDocuments.ts`

Triple **re-derived in this worktree**, not copied from the CLAUDE.md cell:
`git log --oneline` = **8** commits · phase buckets `{112, 114, 165}` = **3** phases · `wc -l` =
**153** (was 120). ⚠ **FIRES — exactly at threshold.**

**Honoured by construction: the diff is COMMENT-ONLY.** Zero new branches, zero new state, zero new
hook calls, zero behaviour change — the merge was already correct for all four fields and RESEARCH
measured that before the plan was written. What the comment adds is the thing that was missing:
**a written rule about which side of the Realtime line each field falls on.** ⭐ That is the point
of listing this file at all — it is the file in the middle of this phase's main seam, and Phase
214's five blockers were every one of them a value whose middle file belonged to no plan.

The ledger's binding invariant for this file — *"Realtime is a hint, never a source of truth… a
design that assumes the socket delivered every transition will show a stale stage strip after a
reconnect"* — **named this plan's defect before the phase existed**, and it is why plan 01 put
`ingestion_step` on the `DocumentResponse` wire. The named seam is **not taken** and is not
obstructed.

## Known Stubs

**`IngestionStrip` has no mount in the product.** It is imported by its own suite and by nothing
else (`grep -rn "IngestionStrip" frontend/src --include=*.tsx` → the component and its test). This
is intentional for this plan — `DocumentList.tsx` is not in `files_modified` and the wiring belongs
with the Library's own tab work. **It is a stub in the reachability sense, not the data sense:**
every branch is real and driven by real fields; nothing is hardcoded empty. Recorded so the verifier
does not have to discover it.

## Manual rows that stay OWED

Unchanged by this plan and **not** closed by any of its 32 cases:

- **M-1** — a document already mid-ingest when the Library opens shows its stage. Invisible to any
  test that mocks `listDocuments`; the hook suite covers the MERGE, never the LOAD.
- **M-4** — the strip never jumps backwards. Only a real ingest proves a sequence.
- **G4-2 · G4-3 · G4-4 · G4-10.** ⭐ **G4-4 (reload the page mid-ingest) is the only thing that
  catches the D-217-10 defect live.**
- **NEW, from this plan's own judgement calls:** the segment-label divergence from the sketch (shape
  + hover/screen-reader name, versus the drawn short words inside each segment) has **not** been
  seen by a human eye. jsdom cannot answer whether a six-segment strip with no visible words reads
  as informative or as decoration.

## Threat Flags

None. No new network surface, no auth path, no file access and no schema change. `ingestion_step`
is never rendered raw — it is only ever a KEY into `TERM_MAP`, with the unknown-key fallback
`DocumentStatusBadge.tsx:27-32` already applies (T-217-27, asserted by a render case). The column is
never cleared and the backend is not asked to clear it (T-217-30). No package was installed.

## Self-Check: PASSED

All five created/modified artifacts resolve on disk and all four commits resolve in `git log`.
The working tree is clean (`git status --short` is empty), so nothing this plan produced is
uncommitted — including this SUMMARY.
