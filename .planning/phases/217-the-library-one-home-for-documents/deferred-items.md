# Phase 217 — deferred items

Out-of-scope discoveries logged rather than fixed. Each carries a re-open trigger.

## 217-08 — two sketch-drive fences left RED because they are NOT this plan's

Measured 2026-08-29 while running `node .planning/sketches/218-the-library-and-its-tabs/drive.cjs`
at plan 08's base (`6eaa83df5`, wave 2 merged). The drive reads **196 passed · 2 failed · 198
assertions**. Both failures are on `frontend/src/components/ingestion/DocumentUpload.tsx`, which is
**byte-unchanged by plan 08** (`git diff --numstat <base> HEAD -- <that file>` is empty and
`git status --short` on it is clean). They were introduced by **plan 217-07**, commit `50050df23`
*"feat(217-07): the upload band — a front door that names its folder"*, which rewrote that file.

| Fence | Why it reds | Who owns it |
|---|---|---|
| `D2 · the shipped input accepts 8 extensions` | the fence extracts a literal `accept="…"`; the shipped input is now `accept={acceptAttribute()}`, so the extraction is `(none)` and the count is 0 | 217-07 |
| `D3 · the shipped upload path reports no byte progress` | the fence greps the source for `onUploadProgress`; 217-07 added a DOCBLOCK containing that word (`DocumentUpload.tsx:45`) while the behaviour the fence asserts is still TRUE — a comment reds a source grep | 217-07 |

⚠ **`D2` is not merely stale — it is now BLIND.** It used to read "8 extensions" out of the
attribute; with the attribute computed, the fence measures nothing at all, so it can carry no claim
about the accepted set in either direction. `D2b` / `D2c` still pass, so a reader glancing at the
block sees mostly green and one red that looks like a count drifting.

**Not fixed here** under the scope boundary (only defects directly caused by this plan's own changes
are auto-fixed) and under this plan's explicit fence-ownership rule (*"⛔ Do not touch `A3b` (plan 06
owns it) or `A7b`/`A7c`/the `src()` paths (plan 04 owns them)"* — `D2`/`D3` are the same shape of
claim over plan 07's file). Both need re-pointing at `acceptedFormats.ts` / `acceptAttribute()`
rather than at the JSX literal, which is a rewrite of the assertion, not a number bump.

**Re-open trigger:** the next plan whose `files_modified` names
`.planning/sketches/218-the-library-and-its-tabs/drive.cjs` **or**
`frontend/src/components/ingestion/DocumentUpload.tsx` — plan 12 is the natural home.
