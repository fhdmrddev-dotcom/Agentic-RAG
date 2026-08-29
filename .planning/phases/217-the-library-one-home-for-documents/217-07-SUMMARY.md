---
phase: 217-the-library-one-home-for-documents
plan: 07
subsystem: frontend
tags: [upload, dropzone, ingestion, mime, cross-language-fence, library, sc2, lib-02]

# Dependency graph
requires:
  - phase: 056
    provides: "`DocumentUpload` — its props, its `Promise.allSettled` batching and its duplicate/error reporting, all reused unchanged"
  - phase: 217
    plan: "01"
    provides: "`ALLOWED_MIME_TYPES` as the derived 422 detail — the same set this plan fences against"
provides:
  - "`ACCEPTED_FORMATS` — ONE frozen constant carrying extensions, mimeTypes and displayLabels"
  - "`acceptAttribute()` / `formatsSentence()` — the `accept` attribute and the printed copy, both COMPUTED"
  - "A full-width upload band that names its target folder and prints its real formats"
  - "`acceptFormats.test.ts` — a cross-language `?raw` subset fence over `backend/app/api/documents.py`, plus a key-link sweep over `DocumentUpload.tsx`"
affects: [217-09, the Library Documents tab, LibraryPage.test.tsx, plan 12's count-gate pins]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "one constant, three consumers — the `accept` attribute is COMPUTED from the same list the UI prints, so a format cannot be advertised that the input refuses"
    - "cross-language `?raw` SUBSET fence (never equality), so the client can only ever be stricter than the server gate it mirrors"
    - "a key-link sweep over `codeOf(source)`, because the consumer's docblock deliberately names the symbols its decision forbids (the 187-24 trap)"

key-files:
  created:
    - frontend/src/components/ingestion/acceptedFormats.ts
    - frontend/src/components/ingestion/__tests__/acceptFormats.test.ts
  modified:
    - frontend/src/components/ingestion/DocumentUpload.tsx

key-decisions:
  - "The fence is a SUBSET check, never an equality — an equality red invites the one repair that must never happen (widening the server to satisfy the frontend), and `accept` is a convenience attribute rather than a control (T-217-23)"
  - "`displayLabels` are the sketch's own words (`PDF · DOCX · PPTX · XLSX · CSV · TXT · MD · EPUB`), not the plan's illustrative `PDF, Word, PowerPoint…` — the sketch is the acceptance bar and its annotation records that the set was MEASURED from the file input"
  - "The band is the sketch's tight `.dropzone` (~82px), NOT its `.dropbig` hero (~200px) — because the objection this plan reverses was specifically about vertical footprint"
  - "The read-only refusal now renders IN the band; it used to live only in a `title` attribute, which a person who cannot upload would never hover to discover"
  - "The `.csv`-announced-as-`application/vnd.ms-excel` defect found during derivation is REPORTED, not fixed — `documents.py` belongs to another agent in this wave and the defect predates this plan"

patterns-established:
  - "every plant driven RED and the file restored md5-identical — three plants, three distinct arms, each verified byte-for-byte afterwards"
  - "a non-vacuity control asserted BEFORE the claim that rests on it, and restated at the point of use"
  - "derive the format list by EXTRACTING both sets in a script, never by reading either — which is how the count in `documents.py`'s own comment was caught"

metrics:
  duration: ~50 min
  tasks: 3
  files-changed: 3
  commits: 3
  completed: 2026-08-29
---

# Phase 217 Plan 07: The Upload Front Door Summary

One frozen `ACCEPTED_FORMATS` constant now feeds the `accept` attribute, the printed format
line and the fence that pins both to the server's real gate — and the corner button is a
full-width band that names the folder the file will land in.

## What shipped

| Task | What | Commit |
|---|---|---|
| 1 + 3 | `acceptedFormats.ts` (strict leaf, zero imports) + `acceptFormats.test.ts` (cross-language `?raw` subset fence) | `773030f9c` |
| 2 | `DocumentUpload.tsx` — the full-width band; the inline `accept` literal DELETED; fence gains a key-link sweep | `50050df23` |
| — | Docblock correction: the server set is **fourteen**, not fifteen | `817c45f6f` |

## ⭐ How the accepted-format list was DERIVED (and what the derivation found)

The orchestrator's standing instruction was that "make the advertised formats true" is a claim
about the backend and must be measured there. It was — by **extracting both sets in a script**
rather than reading either, because a hand-copied list that happens to match today is exactly
the defect this plan exists to remove.

**Method.** `ALLOWED_MIME_TYPES` was pulled out of `backend/app/api/documents.py` by regex and
compared against (a) the client list, and (b) the parse dispatch that actually runs — which is
in two places, not one: `extract_text` (`documents.py:383-520`) for the seven non-PDF/DOCX
mimes, and `extraction_service.get_extractor` / `LegacyExtractor.supports` for PDF + DOCX.
`multimodal_service.py`'s frozensets (`CSV_MIMES`, `EXCEL_MIMES`, `PDF_MIME`, `DOCX_MIME`) were
checked too, and are confirmed to be a **different question** — they gate TABLE extraction, not
the upload door, and every member is already inside `ALLOWED_MIME_TYPES` (set difference: empty).

**ADVERTISED-BUT-UNPARSEABLE: none.** `client − server` is the empty set. All eight advertised
extensions resolve to a mime the server allows AND has a working parser for. The dropzone
currently tells the truth.

**PARSEABLE-BUT-UNADVERTISED: six.** `server − client`:

| Server mime | Parser that handles it | Why the dropzone stays silent |
|---|---|---|
| `text/html` | `html_to_plain_text` (`documents.py:517`) | not offered; a product decision, not a defect |
| `application/csv` | the CSV arm (`:432`) | a synonym of `text/csv`, which IS advertised |
| `message/rfc822` | `parse_eml_bytes` | ⛔ the plan explicitly forbids adding it |
| `application/vnd.ms-outlook` | `parse_msg_bytes` | ⛔ same |
| `application/x-msg` | `parse_msg_bytes` | ⛔ same |
| `application/vnd.ms-excel` | routed to `openpyxl` | ⚠ see below — this one does NOT parse |

⚠ **The plan's reason for excluding Outlook/email was "the shipped input rejects them". The
server does NOT — it allows all three and parses them.** The exclusion is still correct (it is
what makes the fence a subset rather than an equality), but its *stated* justification is wrong
at HEAD, and the subset direction is what makes that safe: the dropzone is deliberately
narrower than the gate, which equality would have forbidden. `frontend/src/lib/fileTypeMark.tsx`'s
own test already lists `eml` and `msg` among *"every extension `documents.py` will accept an
upload for"* — so the file-type-mark layer and the upload door already disagree, and only the
door is narrow. Recorded, not acted on.

## ⚠ Two defects found by the derivation — REPORTED, not fixed

Both are in `backend/app/api/documents.py`, which belongs to another agent in this wave, and
both predate this plan. Neither is caused by anything here.

**1. `documents.py:559`'s own comment miscounts the set it warns about.** It reads *"the prose
list named four formats while `ALLOWED_MIME_TYPES` (:91) holds fifteen. Derive it, never
re-type it."* The extraction counts **fourteen**. Harmless in effect — the 422 detail derives
its list with `sorted(ALLOWED_MIME_TYPES)` and never re-types it — but it is a hand-typed count
sitting *inside the comment that forbids hand-typed lists*, which is a small proof of the rule.
My own docblock inherited the wrong figure and was corrected in `817c45f6f` **only after the
script disagreed with it** — I did not spot it by reading.

**2. ⚠ A `.csv` announced as `application/vnd.ms-excel` is accepted and then dies in the
background.** Mechanism, measured rather than reasoned:

- `openpyxl.load_workbook` on the OLE2/CFB magic that every legacy `.xls` begins with raises
  **`BadZipFile: File is not a zip file`** (driven in the venv, not assumed).
- `application/vnd.ms-excel` **is** in `ALLOWED_MIME_TYPES`, so the upload passes the gate.
- `extract_text` routes it to `openpyxl` (`:407-410`).
- The correction table cannot save it: `.xls` is **absent** from `_EXT_MIME_OVERRIDES`, and
  `application/vnd.ms-excel` is **absent** from `_UNRELIABLE_MIME_TYPES` — so the
  extension-keyed repair that rescues `.md`/`.csv`/`.pptx`/`.xlsx`/`.docx`/`.pdf` never fires
  for this mime. All four facts extracted from the source, printed, and checked.
- `extract_text` runs inside the ingestion background task (`:1351`), so the upload returns
  **201** and the row later flips to `status=failed` — the silent class.

Consequence for **`.csv`**, which this dropzone DOES advertise: Windows clients with Excel
installed are widely documented to report `.csv` as `application/vnd.ms-excel`. The *mechanism*
above is measured; the *browser behaviour* is cited, not measured here — I have no browser in
this worktree. If it holds, an advertised format has a reachable dead end that this plan's
fence structurally cannot catch, because the fence compares mime SETS and this is a mime
ROUTING bug one layer deeper. **Suggested repair (one line, backend): add
`"application/vnd.ms-excel"` to `_UNRELIABLE_MIME_TYPES` so `.csv`/`.xlsx` are corrected by
extension — a genuine legacy `.xls` still fails, because `.xls` is not in the override table,
which is the correct outcome given `openpyxl` cannot read it.**

## The band, and the objection it reverses

The plan required this summary to record the rendered height and argue the file list is still
reachable, because that sentence is what G-4 row **G4-1** is judged against.

The file's own prior comment recorded why the full-width block had been shrunk: the old block
*"pushed the file list below the fold"*. That objection is answered by **size**, not by fiat —
the old block was a `p-10` hero; this is a band:

```
py-5 (20 + 20)  +  headline row 20  +  mt-1 4  +  sub-line 16  +  2 borders  ≈  82px
corner button:  py-2.5 (10 + 10)  +  text-sm 20  +  2 borders               ≈  42px
                                                                    delta   ≈  +40px
```

**Forty pixels does not move a list below any fold**, and the operator's finding was not that
the door was too small to click — it was that it could not be **found**: *"I did not see for
example where I can upload documents."* A full-width band on the landing tab is findable; a
42px button in a header's right corner is not. The shape is the sketch's tight `.dropzone`
(`index.html:911-913`, padding 26px, headline + one dim format line), deliberately **not** its
`.dropbig` hero — and the sketch's tight variant is also the one that already draws the target
folder (*"— into **Engineering**"*), which is why it satisfies D-217-17's folder-naming
requirement and the footprint constraint at the same time.

⚠ **This is an arithmetic argument, not a lived one.** jsdom cannot tell whether the band is the
first thing a person sees. **G4-1 stays OWED** and must be driven on a real browser.

## No percentage, no ETA — and the guard that proves it

D-217-19 stands on measurement: there is no `onUploadProgress` and no `XMLHttpRequest` on this
path, so bytes-sent is not observable and any percentage would be invented. The shipped
`"Uploading N files…"` and the `{uploaded, duplicates, errors[]}` batch summary are unchanged.

⚠ **The acceptance criterion for this was a grep, and a grep is the wrong instrument here.**
`grep -n "onUploadProgress\|XMLHttpRequest\|%"` over `DocumentUpload.tsx` returns **two hits,
both inside the docblock that records the ABSENCE** — the 187-24 trap, where a module that
documents why a symbol is missing reds a raw grep for that symbol. So the guard is executable
instead: section 4 of the fence sweeps `codeOf(uploadSource)` with the **line-anchored**
comment stripper, asserts none of `onUploadProgress` / `XMLHttpRequest` / `remaining` / a
literal percent sign appears **in the code**, and separately asserts the warning is still
present in the **raw** source. A stripper non-vacuity pair (`"hero panel"` present in source,
absent from code, code length > 1500) guards the guard.

## Every guard driven RED, every file restored md5-identical

| Plant | Arm that fired | Restored |
|---|---|---|
| bogus mime `application/x-bogus-planted` added to `mimeTypes` | the subset arm — and it **named** the offender rather than counting (`expected [ 'application/x-bogus-planted' ] to deeply equal []`); the wider-server arm fired too | `76dbb8a7…` → `76dbb8a7…` |
| the extraction regex renamed to a symbol `documents.py` does not contain | **the non-vacuity control fired FIRST**, before the three claims that rest on it (4 failed / 9 passed) | `5c20bcfb…` → `5c20bcfb…` |
| `— 42% · 3 min remaining` added to the uploading arm | the D-217-19 arm, and **that arm alone** (1 failed / 18 passed) | `8806d3d3…` → `8806d3d3…` |

## Verification

- `npx vitest run src/components/ingestion/__tests__/acceptFormats.test.ts --maxWorkers=2` →
  **19 passed**, well above the plan's floor of 6 assertions.
- `npx vitest run src/components/ingestion src/pages/__tests__/LibraryPage.test.tsx --maxWorkers=2`
  → **9 files / 98 tests passed**. `LibraryPage.test.tsx`'s two `DocumentUpload` assertions
  still pass; the accessible name is unchanged (`Upload to Root`).
- `npx tsc --noEmit -p tsconfig.app.json` → **33 errors, exactly the inherited wave-1 baseline,
  and zero of them in `src/components/ingestion/`.** No new errors.

## ⚠ The count gate: `failed 2`, and it is provably UNRELATED — because it never ran my code

`GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` from the repo root:

```
  total                                      5731    6459    +728
  total 6459  ·  failed 2  ·  pinned total 5731
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 2 test(s) failed — the gate requires 0.
```

Only `[failing-tests]` fired — **no per-file decrease**. Filenames were taken from the gate's
**own persisted JSON before any re-run**, per the standing rule, and the cap was not touched:

| File | Failure | Provenance |
|---|---|---|
| `src/pages/WorkflowBuilderPage.session.test.tsx` | `AssertionError: expected 1 to be +0` | SEED-171 named suite (#3 of the original three) |
| `src/pages/WorkflowRunPage.test.tsx` | `AssertionError: expected 0 to be greater than 0` | SEED-171 named suite (the fourth) |

Both are `AssertionError`, which SEED-171 records as the signature that refutes
`STACK_TRACE_ERROR` as a reliable tell. Both were last modified by `b3409d262` (214-11), long
before my base. My whole diff is three files under `src/components/ingestion/`.

⭐ **And the argument is stronger than "provably unmodified" — it is provably UNOBSERVED.** The
gate's report was interrogated directly: it executed **143 files**, of which
**`src/components/ingestion/` contributes ZERO**, `acceptFormats.test.ts` is absent, and
`LibraryPage.test.tsx` — the *only* suite in the repo that mounts `DocumentUpload` — is absent
too. The gate did not execute a single line this plan wrote or changed, so it cannot be
reporting on it. Recorded as an observation; **one red sample of a flaky suite is no more proof
of guilt than one green sample is proof of innocence.**

## ⚠ My new suite is in NEITHER count-gate knob

Confirmed against the gate's own `TARGETS` array and its report: `src/components/ingestion` has
no `TARGETS` entry (directory or file), so `acceptFormats.test.ts` **runs in no gated
invocation** and is guarded by no `BASELINE` pin. It is therefore executable-but-unwatched —
green today, silent forever if someone deletes it. **Plan 12 owns the pins**; I did not edit
`scripts/vitest-count-gate.cjs` (outside my `files_modified`).

This sharpens wave 1's inherited finding #3: it is not merely that a suite can sit on the wrong
side of one knob — an entire **directory** of nine suites and 98 tests, including the one that
mounts the app's upload door, sits outside both.

## Deviations from Plan

**1. [Rule 2 — correctness] `displayLabels` are the sketch's words, not the plan's illustration.**
The plan offered `PDF, Word, PowerPoint, Excel, CSV, Markdown, Text, EPUB` as an `e.g.`; the
sketch draws `PDF · DOCX · PPTX · XLSX · CSV · TXT · MD · EPUB` and its Task-2 instruction says
*"do not invent copy"*. The sketch wins. A side benefit is that the pairing became mechanically
checkable — each label is exactly its extension uppercased, which the fence now asserts, so
"no label without an extension behind it" is verified per-index rather than only by length.

**2. [Rule 2 — correctness] `extensions` were reordered to the sketch's print order.** The plan
said "exactly the shipped set" — a set, not an order. Pairing the two arrays index-for-index is
what lets the fence assert the mapping rather than just the counts.

**3. [Rule 2 — correctness] The read-only refusal moved from `title` into the band.** The plan
asked that a person who cannot upload "is told so rather than shown a door that fails". A
tooltip does not tell anyone anything they have to hover to find; the band has the room, so it
says it.

**4. [Rule 2 — correctness] The fence gained a fourth section (the key-link sweep).** The plan's
`key_links` declare that the `accept` attribute and the displayed list must read the same
export, but Tasks 1 and 3 as written assert only over the constant's own data. Nothing would
have caught a future edit that hard-codes the list back into the JSX. Section 4 closes that,
and it is also where D-217-19 becomes executable rather than grep-able.

**5. [correction] My own docblock's "fifteen" → "fourteen" (`817c45f6f`).** Caught by the
extraction script disagreeing with a figure I had copied from `documents.py:559`. Committed
separately so the correction is legible rather than buried.

**Not done, and why:** the plan's acceptance criterion *"the rendered dropzone contains the
target folder's name — asserted … here by a render assertion in this component's own test if
one exists"* — no such test exists, and `acceptFormats.test.ts` is a `.ts` data fence, not a
`.tsx` render suite. Renaming it would contradict the declared `files_modified`. The visible
assertion is **plan 09's**, as the plan itself says; my executable coverage is the source sweep
(`{targetName}` and `folderName ?? "Root"` both present in code).

## Threat Flags

None. No new network surface, no new auth path, no schema change. `accept` was already a
client-side convenience and remains one (T-217-23); the band renders a folder name it receives
as a prop and resolves nothing (T-217-25). No package was installed.

## Self-Check: PASSED

- `frontend/src/components/ingestion/acceptedFormats.ts` — FOUND
- `frontend/src/components/ingestion/__tests__/acceptFormats.test.ts` — FOUND
- `frontend/src/components/ingestion/DocumentUpload.tsx` — FOUND (modified)
- commits `773030f9c`, `50050df23`, `817c45f6f` — FOUND in `git log`
- working tree clean; no deletions in any commit (`git diff --diff-filter=D` empty on all three)
- STATE.md / ROADMAP.md — untouched, as required of a worktree agent
