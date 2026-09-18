---
seed_id: SEED-170
title: Two shipped code comments credit OutputFileCard for work it does not do — a backend event comment and a FIFTH file presentation whose docblock claims a reuse that never existed
created: 2026-08-17
planted_during: Phase 195 (Show the Deliverable) — plan 195-08, at phase close
status: planted
priority: low
relates_to:
  - SEED-169 (chat's run receipts say a workflow produced nothing) — the sibling seed planted by the
    same plan. Both are measured lies in files Phase 195 deliberately did not open.
  - SEED-148 (workflow output files not surfaced) — the origin of Phase 195. ⚠ Its own "grep returns
    nothing" measurement was ALSO a true grep for the wrong noun; this seed is the same class of
    error one level down, in code comments rather than in a seed.
  - "195-VALIDATION.md § Explicitly OUT of scope" — where `SeamCard.tsx` was FIRST declared a recorded
    boundary. This seed is that boundary's durable home, outside a phase folder.
  - "195-07-SUMMARY.md D-195-07-C" — the source sweep's recorded exclusion; the sweep asserts both
    files as STRINGS and never imports them, so the boundary is measured rather than assumed.
  - "docs/HOT-FILE-LEDGER.md — OutputFileCard.tsx" — the section these comments would send a reader to.
trigger_when: >
  The NEXT phase that opens `backend/app/services/tool_dispatcher.py` or
  `frontend/src/components/panel/SeamCard.tsx` for any reason, OR any reader citing SeamCard's
  docblock as evidence that its chip already shares the file presentation, OR any phase proposing to
  extend SC#2's "one file presentation" claim to a FIFTH surface. Both fixes are one-line comment
  corrections and are legitimate `/gsd:fast` (G-3) candidates on sight.
trigger_paths:
  - "backend/app/services/tool_dispatcher.py"
  - "frontend/src/components/panel/SeamCard.tsx"
surface: Agentic-RAG
---

# SEED-170: two shipped records name `OutputFileCard` for work it does not do

## Why a comment is worth a seed

This project's standing finding is that **a record that is present and WRONG answers the auditor and
stops the audit** — which is worse than an absent one. Phase 195 spent a plan correcting exactly that
failure in a ROADMAP criterion and a design record. **These two are the same failure in shipped
source**, and source comments are read by more people, more often, and with more trust than planning
documents.

Both were found by *measuring* while converting the file presentation. Neither was found by reading.

---

## (a) `backend/app/services/tool_dispatcher.py:3570` — the event comment credits the wrong renderer

**The comment, verbatim:**

> `# VERBATIM reuse of the workspace_file_written event so OutputFileCard renders it`
> `# (no new UI). Same shared SSE vocabulary for every provider — no per-provider branch.`

**Measured: `OutputFileCard` does not render it, and never did.** `workspace_file_written` is consumed
on the workspace-file path — the streams provider's `useWorkspaceFiles(threadId)` store, which feeds
the workspace panel's **file section** and (since Phase 188-10) the workflow run page's deliverable
region. `OutputFileCard` renders **sandbox** output files, identified as `{filename, url}` and
downloaded via the sandbox download seam.

⚠ **The two paths are not merely different renderers — they are different DATA SHAPES, and confusing
them has a concrete cost.** A workspace file is `{id, path, size_bytes, mime_type}` and **has no `url`
at all**; `OutputFileCard` treats a missing `url` as a **DEAD FILE** and renders a red-bordered
*"Download unavailable — this file has no link"* row. **So a developer who believed this comment and
fed workspace files to `OutputFileCard` would render every deliverable as a broken link.** That is not
hypothetical — it is written up in `195-CONTEXT.md` D-05 as *the blocker that makes a naive reuse fail*,
and it was found only because someone went to check.

⚠ **The rest of the comment is TRUE and should survive the correction**: the event genuinely is reused
verbatim rather than invented per-provider, and there genuinely is no per-provider branch. **The fix is
to name the right consumer, not to delete the comment.**

**Suggested correction (one line):** name the workspace-file store and the panel's file section as the
consumers, and note that the run page's deliverable region reads the same store.

---

## (b) `frontend/src/components/panel/SeamCard.tsx:10` — a claimed reuse that does not exist

**The docblock, verbatim:**

> `*   - workspace_write → a file chip (reuses OutputFileCard's chip shape: icon +`
> `*                       mono filename + `· v{n}`) + "open panel ↗"`

**Measured at Phase 195's close: `grep -cE "fileIcon|formatBytes|FileRow"` over `SeamCard.tsx` → 0.**
The file imports exactly one glyph — `FileText` from lucide — and hardcodes it. It has:

- **no extension→glyph mapping** (a `.docx`, a `.png` and a `.sql` all render the same glyph)
- **no byte formatter** and no size at all
- **no download affordance**
- **no shared row**

**"Reuses OutputFileCard's chip shape" is a description of a visual resemblance, written as if it were
a code dependency.** A reader auditing SC#2 — *no second file UI* — who greps for consumers of the
shared presentation will not find `SeamCard`; a reader who reads this docblock will believe it is
already covered. **The docblock is the more likely of the two to be read.**

### ⚠ `SeamCard` is a FIFTH file presentation, and Phase 195 declared it OUT of scope on purpose

This is the load-bearing half of this seed, because it converts a future dispute into a recorded
boundary. **`195-CONTEXT.md` does not name `SeamCard` at all** — it enumerates four presentations. The
fifth was found during validation planning, and Phase 195 **explicitly excluded it**, with its reason:

> **It is a chip in a run receipt, not a file row** — no size, no download, no icon map. Its job is to
> make a reloaded transcript self-contained, not to present a file for use.

So when a later reader asks *"Phase 195 claimed one file presentation — why are there two?"*, the
answer is here, and it is a decision rather than an oversight. ⚠ **The sweep that measures SC#2 asserts
both `SeamCard.tsx` and `lib/fileIcons.tsx` as STRINGS and deliberately never imports them**, so the
exclusion is itself measured rather than assumed. **Whoever converts `SeamCard` owns adding the fifth
arm to that sweep in the same commit.**

⚠ **A related sixth path, named so no one "unifies" it by accident:** `frontend/src/lib/fileIcons.tsx`
(`getFileIcon`) serves the documents and governance-health surfaces. Also **explicitly not** unified by
Phase 195. Its re-open trigger is *a documents-surface phase touching file presentation*.

---

## Why Phase 195 did not just fix them

**The phase writes no Python** — `files_modified` contains no path under `backend/`, and a plan that
edited backend source would have been a scope breach on a phase measured and scoped as
frontend-consolidation-only. And `SeamCard.tsx` is a **file the phase declared out of scope**; editing
its docblock inside the phase that excluded it would have muddied the boundary the exclusion exists to
draw.

⚠ **There is a second, sharper reason, and it is the one worth remembering:** Phase 195's plan 07
proved SC#2 with a **source sweep over the swept files**, and that sweep reads a tree. **Touching a
swept-adjacent file after the sweep ran would mean the sweep had measured a tree that no longer
exists.** The phase deliberately closed with its source frozen.

**Both fixes are one-line comment corrections in two files, with no behaviour change, no schema, no
API surface — the textbook `/gsd:fast` (G-3) shape.** They are cheap on purpose; the reason to record
them rather than do them is boundary hygiene, not effort.

## Re-open trigger

**The next phase opening `backend/app/services/tool_dispatcher.py` or
`frontend/src/components/panel/SeamCard.tsx`, or any reader citing `SeamCard`'s docblock as evidence
that the chip already shares the file presentation, or any phase proposing to extend the
one-file-presentation claim to a fifth surface.**

*Not a date. Two named files and an observable misreading.*
