---
phase: 235-the-source-says-what-it-did
plan: 02
subsystem: sources / library
tags: [LIB-10, vocabulary, classifier, zero-import-leaf, live-source-binding]
requires:
  - "backend/app/services/sources/ (the package preview_service.py established)"
  - "frontend/src/components/library/ingestionErrorVocabulary.ts (the pattern D-235-09 copies)"
provides:
  - "backend/app/services/sources/failure_cause.py — Cause union, HARD_CAUSES, SOFT_FAILURE_THRESHOLD, classify_failure_cause(), is_hard()"
  - "frontend/src/components/sources/sourceHealthVocabulary.ts — every sentence and control the source surfaces say"
affects:
  - "Plan 05 (watch_service release seams consume classify_failure_cause)"
  - "Plan 06 (the stopped verdict consumes HARD_CAUSES / SOFT_FAILURE_THRESHOLD)"
  - "Plans 07-11 (every source surface imports COPY / SENTENCE_FOR_CAUSE / CONTROL_FOR_CAUSE)"
  - "Plan 12 (must pin sourceHealthVocabulary.test.ts in BOTH count-gate knobs)"
tech-stack:
  added: []
  patterns:
    - "ordered MATCHERS, first match wins (ingestionErrorVocabulary.ts:99-112)"
    - "deny-by-default MACHINE_TELLS + positive proof of plainness"
    - "?raw cross-language fence, frontend suite bound to live backend source"
    - "sentence as a FUNCTION of a runtime value (notAZipSentence precedent)"
key-files:
  created:
    - backend/app/services/sources/failure_cause.py
    - backend/tests/unit/services/test_failure_cause.py
    - frontend/src/components/sources/sourceHealthVocabulary.ts
    - frontend/src/components/sources/sourceHealthVocabulary.test.ts
  modified: []
decisions:
  - "COPY has 26 keys, not the plan's 27 — measured from the sketch's own object (28 top-level, minus the two nested tables hoisted to SENTENCE_FOR_CAUSE / CONTROL_FOR_CAUSE / SENTENCE_FOR_FILE_FAILURE)"
  - "Rule 5 is asserted over PUNCTUATION dashes; an intra-word hyphen is carved out explicitly, because the BUILD-CONTRACT's own password sentence contains one"
  - "An empty connection name degrades to 'the connection' rather than printing a gap"
metrics:
  duration: ~40 min
  completed: 2026-09-06
---

# Phase 235 Plan 02: The Source Says What It Did — Cause + Vocabulary Summary

A source failure is now a **named value** on the backend and **one sentence with one control** on the
frontend, bound to each other by a `?raw` fence so a cause added on one side cannot ship silently on the
other.

## What was built

| File | Lines | What it is |
|---|---|---|
| `backend/app/services/sources/failure_cause.py` | 169 | The classifier. Writes nothing, imports no DB. `Cause` is a one-line greppable `Literal` union; `HARD_CAUSES` and `SOFT_FAILURE_THRESHOLD` are DATA; `_STATUS_CAUSE` is consulted before the ordered `_MATCHERS`; `unknown` is returned rather than guessed. |
| `backend/tests/unit/services/test_failure_cause.py` | 192 | 39 cases. Non-vacuity on `get_args(Cause)` is the **first collected test**; hard/soft is asserted as a **total partition** over the union rather than by naming four causes. |
| `frontend/src/components/sources/sourceHealthVocabulary.ts` | 315 | The strict zero-import leaf. 26 `COPY` keys, `SENTENCE_FOR_CAUSE`, `CONTROL_FOR_CAUSE`, `SENTENCE_FOR_FILE_FAILURE`, `MACHINE_TELLS`, `looksHumanWritten`, `classifySourceFailure`, `sourceFailureSentence`. |
| `frontend/src/components/sources/sourceHealthVocabulary.test.ts` | 476 | 42 cases. V-07 / V-08 / V-09. |

## ⭐ The RED drive (mandated by the plan, and it fired)

`failure_cause.py` was temporarily edited to add a fifth cause `"quota_exhausted"` to the `Cause` union.
The suite went RED with **2 failed / 40 passed**, and the message names the missing sentence:

```
FAIL src/components/sources/sourceHealthVocabulary.test.ts > V-09 — bound to failure_cause.py's LIVE source > ⚠ NON-VACUITY — the extraction actually found the four cause literals
AssertionError: expected [ Array(5) ] to have a length of 4 but got 5

AssertionError: failure_cause.py can emit "quota_exhausted" but sourceHealthVocabulary.ts has no sentence for it: expected false to be true // Object.is equality
```

**Restored md5-identical.**

| | md5 |
|---|---|
| before planting | `b2bb7b6778253a643e43a5d10a44c3f2` |
| after restoring | `b2bb7b6778253a643e43a5d10a44c3f2` |

`git status --short` after the restore showed only the not-yet-committed new file — `failure_cause.py`
was byte-unchanged.

## ⚠ A second, unplanned RED that is worth recording

The first run of the completed suite failed on **my own docblock**:

```
FAIL … > the connection name is a runtime value, never a baked fixture > no shipped string contains the sketch's fixture connection name
expect(vocabularySource).not.toContain("Legal SharePoint")
```

The leaf's source was clean of the fixture name in every *shipped string* — but a comment explaining
*why* the sentences are functions had spelled the fixture name to make the point. **The fence reads the
file as TEXT, so a literal inside a docblock is still a literal** — precisely the Pitfall-8 shape the em
dash falls into one file over. The comment was reworded to name the thing without spelling it, and a
note recording the trap was added in its place. Recorded because *the guard catching its own author on
the first run* is the strongest evidence that it is not decorative.

## Verification

| Check | Result |
|---|---|
| `pytest tests/unit/services/test_failure_cause.py -q` | **39 passed, 0 failed** |
| `pytest tests/unit/services/sources -q` (boundary fence included) | 71 passed, 0 failed |
| `npx vitest run src/components/sources/sourceHealthVocabulary.test.ts --maxWorkers=2` | **42 passed, 0 failed** |
| `npx vitest run src/components/sources --maxWorkers=2` | **5 files · 106 passed, 0 failed** |
| `pytest tests/unit -q --continue-on-collection-errors` | `72 failed, 3832 passed, 2 xfailed, 2 xpassed, 42 warnings in 159.59s` — **72 is the inherited baseline this plan was given; zero new failures** |
| `tsc -p tsconfig.app.json --noEmit` | 103 pre-existing errors across the repo, **none in either of this plan's files** (`grep sourceHealthVocabulary` → empty) |
| `grep -cE "^(import\|export .* from)" sourceHealthVocabulary.ts` | **0** |
| `grep -c "Legal SharePoint" sourceHealthVocabulary.ts` | **0** |
| `grep -n "failure_cause.py?raw"` in the suite | line 44, `../../../../backend/…` — **exactly four `../`** |
| `grep -n "Cause = Literal"` in `failure_cause.py` | line 46, single line, all four literals in plain text |
| forbidden backend imports (`app.db` / `supabase` / `asyncpg` / `dependencies`) | **0** |

## ⭐ COUNTS FOR PLAN 12 (verbatim — both knobs still owed)

`src/components/sources` is **not** a `TARGETS` directory entry, so neither knob was touched here.
Plan 12 must add BOTH, in one commit, at the gate's own printed figure.

| suite | cases | note |
|---|---|---|
| `frontend/src/components/sources/sourceHealthVocabulary.test.ts` | **42** | new — needs a `TARGETS` entry AND a `BASELINE` pin |
| `frontend/src/components/sources` (whole directory, after this plan) | **106** across 5 files | the other four are `previewVocabulary` · `SourceFolderPicker` · `SourcePreviewPanel` · `WatchedFoldersSection` |

⚠ `scripts/vitest-count-gate.cjs` was **not modified** by this plan, as instructed.

## Deviations from Plan

### 1. [Rule 1 — measured correction] `COPY` has **26** keys, not the plan's "≥ 27"

- **Found during:** Task 2, writing the non-vacuity assertion.
- **Issue:** The plan (inheriting RESEARCH C-11) says the sketch's `COPY` has 27 keys and requires
  `Object.keys(COPY).length >= 27`. Measured against the sketch's own source
  (`.planning/sketches/233-the-source-says-what-it-did/index.html:309-390`), the object has **28**
  top-level keys. Two of them — `cause` and `fileFail` — are nested tables, and the plan's own
  `<interfaces>` block hoists them out into `SENTENCE_FOR_CAUSE` / `CONTROL_FOR_CAUSE` /
  `SENTENCE_FOR_FILE_FAILURE` so they can be keyed by the union. 28 − 2 = **26**.
- **Fix:** The suite asserts `toHaveLength(26)` **exactly** (stronger than the plan's `>=`), with the
  derivation written into the test as a comment so the number is auditable rather than asserted. All
  nine keys RESEARCH C-11 named as missing from the emitted §1 table are present and separately pinned.
- **Nothing was dropped.** Every one of the sketch's 28 top-level keys is ported.
- **Files:** `sourceHealthVocabulary.ts`, `sourceHealthVocabulary.test.ts` · **Commits:** `729747122`, `afb32fe20`

### 2. [Rule 1 — bug in the copied rule] Rule 5 is asserted over PUNCTUATION dashes, not every dash

- **Found during:** Task 2, authoring the five-rule property.
- **Issue:** The analog's rule 5 (`ingestionFailureCopy.test.ts`) requires every dash-like character to
  be U+2014. Applying it verbatim would REJECT the BUILD-CONTRACT's own pinned sentence
  *"The file is password-protected — remove the password…"*, whose `password-protected` is a compound
  hyphen and must stay one. The analog never hit this because none of its four sentences contains a
  compound word.
- **Fix:** A dash between two word characters is carved out as an intra-word hyphen; every dash standing
  alone as punctuation must be the em dash. **Two extra assertions keep the carve-out honest:** a
  counter proving at least 3 real punctuation dashes were actually examined (so the rule cannot pass
  vacuously), and a positive case pinning that the compound hyphen exists and was deliberately allowed.
  Rewording the sketch's sentence was rejected — §1c is a binding copy contract.
- **Files:** `sourceHealthVocabulary.test.ts` · **Commit:** `729747122`

### 3. [Rule 2 — missing critical behaviour] An empty connection name degrades rather than printing a gap

- **Found during:** Task 2. The plan specifies `label: (connectionName) => string` but says nothing
  about an absent name. `Reconnect ` with nothing after it is a wrong instruction on the screen, and
  every caller in plans 07-11 gets its name from a nullable `connector_connections.name`.
- **Fix:** A private `named()` helper resolves blank/whitespace to `"the connection"` —
  `notAZipSentence`'s own recorded rule (*"fall back rather than guess; a wrong instruction is worse
  than a general one"*). Pinned by three assertions.
- **Files:** `sourceHealthVocabulary.ts` · **Commit:** `afb32fe20`

### 4. [Rule 2 — the threat register] `MACHINE_TELLS` widened beyond the analog's for T-235-06

- **Found during:** Task 2. The analog's tells are written for *Postgres driver* leakage (SQLSTATEs,
  `psycopg`, SQL fragments). A **source** failure leaks different things: an OAuth token fragment
  (`ya29.…`), a Drive API URL carrying a `pageToken`, an `HTTPStatusError` line.
- **Fix:** Added `https?://`, `ya29.|Bearer|access_token|refresh_token|client_secret`, `urllib3`,
  `googleapiclient`, and the `NNN Client/Server Error` status-line shape; dropped the SQLSTATE and SQL
  tells that cannot occur on this path. Driven with four realistic leak strings, each asserted to
  resolve to one of OUR sentences and to contain neither `ya29.` nor `watch_service.py`.
- **Files:** `sourceHealthVocabulary.ts`, `sourceHealthVocabulary.test.ts` · **Commits:** `729747122`, `afb32fe20`

### 5. [Rule 2 — V-07's own wording] The "map is data" claim is PROVED, not asserted

- **Found during:** Task 2. V-07 says *"a new cause needs no branch edit"*. A test that lists four rows
  and checks their action values does not establish that — it would pass equally over a `switch`.
- **Fix:** The suite imports the leaf's OWN source via `?raw` and asserts it contains no
  `switch (cause`, no `cause === "…"`, and no `case "token_revoked"`, paired with a non-vacuity floor on
  the import length. The zero-imports rule is proved the same way.
- **Files:** `sourceHealthVocabulary.test.ts` · **Commit:** `729747122`

## Known Stubs

**`SENTENCE_FOR_FILE_FAILURE.too_big` has no producer today.** `connector_watch_items.state` values
`skipped_size` and `skipped_type` are written by **nothing** (235-RESEARCH §3.5, measured). The sentence
is ported because BUILD-CONTRACT §1c pins it, and the absence is stated in a comment at the table rather
than shipped silently. This is a gap in the WRITER, not in this table — it does not block LIB-10, whose
subject is the source, not the file.

`classifySourceFailure` is a **client-side** classifier that duplicates the server's recognition. That is
deliberate, not a stub: the server decides what is STORED, and this exists for a `last_error` string
written before the classifier landed and for a surface holding a message with no cause column to read.
Both sides are kept in step by the `?raw` fence at the level that matters — the cause SET.

## Threat Flags

None. No new network endpoint, auth path, file access pattern or schema change. `failure_cause.py`
imports no DB and writes nothing; `sourceHealthVocabulary.ts` imports nothing at all.

## Self-Check: PASSED

Files:
- FOUND: `backend/app/services/sources/failure_cause.py`
- FOUND: `backend/tests/unit/services/test_failure_cause.py`
- FOUND: `frontend/src/components/sources/sourceHealthVocabulary.ts`
- FOUND: `frontend/src/components/sources/sourceHealthVocabulary.test.ts`

Commits:
- FOUND: `a24791191` test(235-02): add failing test for the source-failure cause classifier
- FOUND: `80cea3356` feat(235-02): a source failure is a named cause, table-driven
- FOUND: `729747122` test(235-02): add failing whole-table + live-source suite for source health copy
- FOUND: `afb32fe20` feat(235-02): every source cause has one sentence and one control

Not modified (as required): `.planning/STATE.md`, `.planning/ROADMAP.md`, `scripts/vitest-count-gate.cjs`.

## TDD Gate Compliance

Both tasks ran RED → GREEN with the failing test committed first:

| gate | Task 1 | Task 2 |
|---|---|---|
| RED (`test(...)`) | `a24791191` — `ModuleNotFoundError: No module named 'app.services.sources.failure_cause'` | `729747122` — module resolution failure, `no tests` |
| GREEN (`feat(...)`) | `80cea3356` — 39 passed | `afb32fe20` — 42 passed |
| REFACTOR | not needed | not needed |
