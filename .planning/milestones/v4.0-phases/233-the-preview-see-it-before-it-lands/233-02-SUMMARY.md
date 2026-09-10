# Plan 233-02 Summary — the surface, and `SourceFolderPicker`'s first home

**Executed:** 2026-09-05 · **Status:** Complete · **Requirements:** PREV-01, PREV-02, PREV-03, LIB-09

---

## What shipped

| File | What |
|---|---|
| `components/sources/previewVocabulary.ts` | **new**, a strict leaf with zero imports — the four verbatim labels, the qualifier, the four-zero receipt, the Cancel toast, the three outcome words |
| `components/sources/SourcePreviewPanel.tsx` | **new** — 229-C's proportional spine at rest, 230-A's dissolve on confirm |
| `components/sources/ConnectedSourceSection.tsx` | **new** — the connection picker + folder tree + preview, as ONE child element |
| `components/library/IngestionTab.tsx` | one import, one mount, **zero branches** |
| `pages/LibraryPage.tsx` | `max-w-6xl` (D-233-07) |
| `lib/api/connectors.ts` + `lib/api.ts` | `previewSource` / `confirmSourcePreview` and their wire types |
| `scripts/vitest-count-gate.cjs` | both new suites in **TARGETS and BASELINE**, same commit |
| `components/ingestion/__tests__/IngestionStrip.test.tsx` | an **inherited red** repaired — see below |

---

## The two locked sketches, built

**229-C, the proportional spine** — at rest. One segmented bar always summing to the folder, a
four-item legend carrying the verbatim labels, four accordions beneath. The `unk` segment is
**hatched and animating** while the other three settle: *"a count of 4 beside a count of 12 is
arithmetic; a hatched sixth of a bar is a feeling."*

**230-A, the bar dissolves** — on confirm. The four preview segments are replaced by
`added` / `here` / a red `refused`. **No second screen and no new object** — the bar you were reading
becomes the bar you are watching. The reconciliation line is the SC#4 receipt.

### The one risk 229-C carried, and how it is held

229's own README named it: *"an accordion can be collapsed."* Collapsing hides the **files**, never
the bucket or its **count** — that is what keeps SC#1 met once an accordion exists, and the README
asked for a `drive.cjs` guard *"at plan-phase"*. It got one, on the React side:
`⭐ collapsing a section hides its FILES and keeps its label and its COUNT`. There is also no filter
chip, no *collapse all*, and no *hide* — asserted over every rendered `<button>`, because a filter
chip **is** a control that removes a bucket and that is exactly why sketch variant **B** lost.

---

## `SourceFolderPicker` had no home, and that was a 232 leftover

Measured 2026-09-05: `grep -rl SourceFolderPicker frontend/src` returned the component and its own
test, **and nothing else**. It shipped at `232-04` and was mounted nowhere. A component with no mount
is one nobody can find a defect in, so giving it a home was part of this phase.

**Home: the Library's Ingestion tab, under `Add files`** (D-233-06) — where getting-things-in already
lives and where Phase 234's watch loop lands. ⛔ Not a sixth tab. `ConnectedSourceSection` owns the
whole door, so `IngestionTab` gained an import and a mount and **no branch** — which is what keeps
its G-5 obligation honoured by construction.

⚠ **It renders `null` when no source-capable connection exists**, so a person with no connections
sees exactly the surface they saw before. The capability predicate is deliberately **narrow** — a
connection that is offered and then cannot browse is worse than one that is not offered — and it is
the thing to widen when Microsoft Graph lands at Phase 238.

---

## D-233-07 — the one measure, and it was the Library that was wrong

The operator asked *"why is the width reduced… we should unify the width of all"*. Re-derived:

| Page | Container | px |
|---|---|---|
| `SettingsPage.tsx:950` | `max-w-6xl` | **1152** |
| `ConnectionsPage.tsx` | `max-w-6xl` | **1152** |
| `WorkflowsPage.tsx:1238` | `max-w-[1200px]` | 1200 |
| **`LibraryPage.tsx:641`** | `p-8`, **no max-width** | **unconstrained** |

⭐ `max-w-6xl` **taken as a precedent, not invented as a fifth number** — it is the same reasoning the
un-propagated 2026-08-28 comment in `SettingsPage.tsx` used. ⚠ `WorkflowsPage`'s 48px difference is
**named, not silently folded in**: it is outside this phase's blast radius.

---

## An inherited red was repaired, and it is not this phase's

The count gate measured **`failed 2`** on the merge base, before any work here. Both were in
`IngestionStrip.test.tsx`'s ORDERED fence over `documents.py`'s live source.

**Cause, found by `git log -S` rather than guessed:** `7cca8f50a` (**`229-03`**, the email-attachment
splice cascade) added `"ingestion_step": "failed"` to `documents.py`. That is a **terminal marker**,
not a pipeline stage — a document does not pass *through* `failed`, it stops there — so the fence's
*"exactly six"* control went red.

⭐ **The fence was doing its job; what it caught was a real drift.** It cannot be excluded by
construction the way the legitimate `None` reset is (`failed` is a quoted lowercase value,
structurally identical to a stage), so the exclusion is **NAMED** — and, exactly like the `None`
case, a **positive control asserts the marker really is written**, so the exclusion is doing work
rather than describing an absence. Its pin was also **under-set at 25 against 30 actual**; re-pinned
to **31**.

---

## Verification

```
  total 7498  ·  failed 0  ·  pinned total 6771
count gate OK — 224/224 pinned files present, no per-file decrease, 0 failing.
```

**Baseline before any work: `total 7463 · failed 2 · pinned total 6731`.** So `+35` cases, `+40`
pinned, and both inherited failures gone.

⚠ **TARGETS and BASELINE are two knobs, and both were needed here.** `src/components/sources` is
**not** a directory entry — `SourceFolderPicker.test.tsx` is pinned by an explicit path, and a path
entry recurses into nothing. That was **checked against the array rather than assumed**: this is
Phase 214's `WorkflowScheduleModal.test.tsx` finding (a suite that ran for phases while guarding
nothing) in the one place where forgetting it would leave the milestone's differentiator unguarded.

### Four defects planted, four fired, both files restored md5-identical

| Planted defect | Fires |
|---|---|
| the fourth bucket is dropped | ✅ 4 |
| collapsing hides the **count** as well as the files | ✅ 1 |
| a refusal becomes a colour instead of a name | ✅ 1 |
| the `Already here` qualifier is rewritten to *"matched by content hash"* | ✅ 4 |

⚠ **The hash guard is REGION-SCOPED and asserts its region was found.** The equivalent guard in
sketch 229 was **proven broken before it was trusted** — its first version searched the whole
document, so the overclaim survived elsewhere and the sub-region regex silently matched nothing at
all. Avoided here deliberately: the vocabulary check reads the **string constants**, not the file,
because the module's docblock discusses hashes at length precisely to explain why the copy must not.

**Typecheck:** no error in any file this plan created or modified. (The tree carries pre-existing
`tsc` noise in unrelated test files and in `lib/api.ts`'s `api/library` re-exports.)
