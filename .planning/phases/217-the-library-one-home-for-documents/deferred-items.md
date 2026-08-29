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

---

## RESOLVED 2026-08-29 — the `D2` / `D3` sketch reds (orchestrator, at 217-08's merge)

Fixed at the wave-3 post-merge gate rather than deferred. Recorded here because the
*shape* of the defect is the finding, not the two red lines.

**It was a cross-plan seam — each side green alone.** 217-07 replaced `DocumentUpload.tsx`'s
transcribed `accept="..."` literal with a COMPUTED `accept={acceptAttribute()}`, which is the
better shape and passed every check 217-07 ran. `drive.cjs`'s `D2` parsed that literal with a
regex. Neither plan could see the break; only the merged tree shows it.

⚠ **And the break was NOT symmetrical, which is the part worth keeping:**

| fence | after 217-07 | why |
|---|---|---|
| `D2` | RED | the regex matched nothing — loud, and therefore harmless |
| `D2b` | **GREEN, VACUOUSLY** | `[].every(...)` is `true` |
| `D2c` | **GREEN, VACUOUSLY** | `![].includes(".msg")` is `true` |

Two fences reported PASS while measuring an empty set. **A guard that passes over nothing is
worse than one that fails**, and a run reading `2 failed` conceals that two of the greens were
also broken. 217-08 called `D2` *"blind, not stale"* and was exactly right.

**The repair.** `D2` now reads `acceptedFormats.ts` — the single constant the input computes
from — instead of the deleted literal, so it follows the source of truth rather than a
rendering of it. A new **`D2z` non-vacuity control** fails loudly at zero, so `D2b`/`D2c` can
never again pass over an empty list. `D2z` was **driven RED** against a moved source (renaming
`Object.freeze` in the constant) and fired; `acceptedFormats.ts` was restored **md5-identical**.

**`D3` was a different bug with the same cause.** It greps for `onUploadProgress`; 217-07 added
a docblock that *mentions* `onUploadProgress` to explain that there is none. A source grep
cannot tell code from prose, so a behavioural fence reddened over behaviour that is still true.
It now strips comments and reads code only.

**Result:** `196 passed / 2 failed` → **`199 passed / 0 failed / 199 assertions`**.
`BUILD-CONTRACT.generated.md` regenerated from the driver, never hand-edited.

**Carry-forward:** a fence that reads a *rendering* of a value breaks when the rendering is
improved. Prefer reading the constant. And every extract-then-quantify fence needs a
non-vacuity control beside it — the empty set satisfies `every` and `!includes` silently.

---

## RESOLVED 2026-08-29 — sketch fence `D4` inverted (orchestrator, at 217-10's merge)

`D4` asserted `documents.full_markdown` has **zero** non-test frontend references — a
BURIED-CAPABILITY audit: the parsed text was stored and nothing read it. Plan 217-10 shipped
`DocumentContentSection.tsx` + `lib/api/documents.ts`, so the fence began failing **at the exact
moment its subject stopped being a defect**. That is LIB-04 delivered, not a regression.

Same class as 217-04's `H2b`: **a verbatim check cannot tell "still buried (bad)" from
"deliberately surfaced (the goal)"** — it measured the symptom rather than the property.

Inverted to assert the capability IS reachable, which is the property worth defending from here
on: a later refactor that quietly drops the last reader re-buries it, and this now reds. The
original claim is preserved verbatim in a comment above it, never overwritten.

⚠ **My first RED control did not fire, and the fence was innocent — I was wrong.** I renamed
`full_markdown` -> `full_markdownXX`, and `feMentions` uses a **substring** `includes()`, so the
needle was still present. Re-driven with a true rename (`-> parsedBody`): `refs = 0`, `D4` fires,
both files restored **md5-identical**, drive back to `199 passed / 0 failed`. Recorded because a
control that silently fails to fire is exactly how a fence gets believed without evidence.

⚠ **PREDICTED for wave 5 — `D5c` is the next one to go obsolete the same way.** It asserts *"the
frontend renders only COUNTS of tables/images today"*. Plan 217-11 renders tables as tables and
image descriptions, which makes that claim false BY SUCCEEDING. Plan 11's agent has been told to
invert it rather than delete it, on this same pattern.
