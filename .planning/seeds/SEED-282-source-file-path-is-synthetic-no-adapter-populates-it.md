---
seed_id: SEED-282
title: A watch rule can filter on `path`, but no adapter populates it — production always substitutes `/<filename>`, so folder-shaped path rules silently never match
created: 2026-09-06
planted_during: Phase 237 reviewer re-review (claude, REVIEWER — did not build this phase)
status: folded
partial: true
status_note: |
  ORIGINAL `status:` line, verbatim — displaced by Phase 251's frontmatter migration (D-10):
  status: partial   # ⚠ Phase 238 took OPTION 1 for Graph. Drive is STILL unpopulated.

  The prose that followed the token, byte-for-byte:
  # ⚠ Phase 238 took OPTION 1 for Graph. Drive is STILL unpopulated.

  Mapped `partial` -> `folded` + `partial: true`. Reason: READ SEED-253 — Graph half folded into Phase 238, Drive half still open.
priority: medium
surface: Agentic-RAG
relates_to:
  - Phase 237 (RULES-01 / SC#1 / SC#3) — the phase that introduced `SourceFile.path`
  - SEED-171 — the sibling lesson that a green test can coexist with a broken behaviour
  - Phase 238 (Microsoft Graph — OneDrive and SharePoint) — SharePoint's library paths are
    the natural forcing function; ⭐ this is the most likely place the gap becomes visible
trigger_when: >
  ANY of: (a) Phase 238 lands a Graph adapter — WIDENED 2026-09-07 from "SharePoint" to ANY
  Graph adapter, because the operator split Phase 238 and deferred SharePoint to SEED-256; left
  as written this trigger would have waited on a phase that had already passed, which is the exact
  dormant-seed failure this register exists to prevent. OneDrive alone fires it: driveItem carries
  parentReference.path, so the real folder path IS available from Graph and the synthetic
  '/<filename>' substitution becomes visibly wrong the moment a OneDrive folder is watched;
  (b) a recursive /
  subfolder watch ships, making a file's folder location meaningful rather than constant;
  (c) any user-reported bug of the shape "my path rule does nothing"; (d) any phase that
  touches `SourceFile` or `preview_service._suggest_destination`.

  ⚠ NARROWED 2026-09-07 AT PHASE 238's CLOSE. Arms (a) and (d) have FIRED and are discharged
  for Graph; what remains open is DRIVE ONLY. The live trigger is now: (i) Google Drive's own
  `path` becomes cheaply available (a `parents` walk or a cached folder map in the lister), or
  (ii) a recursive / subfolder watch ships, making a Drive file's folder location meaningful
  rather than constant, or (iii) any user-reported bug of the shape "my path rule does nothing"
  on a DRIVE source.
renumbered_from: SEED-253
renumbered_because: >
  D-07/D-20: the OLDEST seed keeps the id, by the `created`-else-`planted` date — and this pair
  TIES on it. Both this file and `SEED-253-mobile-has-no-drawer-trigger-outside-the-chat-view.md`
  read `created: 2026-09-06`, so D-20's tie-break was consulted and PRINTED rather than applied
  silently: `git log --diff-filter=A --date=iso` gives 2026-09-06 08:36:22 +0400 for the
  mobile-drawer seed and 2026-09-06 22:00:28 +0400 for this one — 13h 24m 06s apart. The older
  add-commit keeps id 253; this seed moved to 282. ⛔ Not chosen by reference weight, although this
  is the pair where that would have changed the answer: ~53 files reference SEED-253 and
  essentially every live one means THIS seed, while the keeper is cited nowhere outside its own
  file and the archives. Recorded as an observation beside the rule, never as a reason to depart
  from it — D-07 rejects `most-referenced keeps it` by name. The 25+ `backend/`/`frontend/`
  references are deliberately left on the `SEED-253` redirect stub under D-17.
---

`Phase 237` made source facts first-class filterable fields and added `path` to both the
watch-rule whitelist (`classification_rules.WATCH_ALLOWED_FIELDS`) and the rule builder's
dropdown (`ConditionPopover.WATCH_FIELDS`). It also added a `path` field to `SourceFile`
(`backend/app/services/sources/base.py:42`).

**No adapter populates it.** Measured at Phase 237's re-review, on the merge tree:

- `google_drive.py:249` constructs `SourceFile(id, name, mime_type, size, modified_at, drive_id, icon_url, web_view_url)` — **no `path=`**.
- `mock_source.py` — **no `path=`** either.
- `grep -rn "path=" backend/app/services/sources/adapters/*.py` returns **nothing**.

So `f.path` is always `None`, and both evaluation sites fall back to a synthetic value:

- `preview_service.py` — `file_path = getattr(f, "path", None) or f"/{f.name}"`
- `ingest_enrich.py` — `src_path = source_info.get("path") or (f"/{filename}" if filename else None)`
  (⚠ `watch_service.py:318` writes `metadata.source` with `system` / `external_id` / `version`
  and **no `path` key**, so this arm is dead too.)

**The user-visible consequence.** Driven against the real code:

```
path contains '/Finance/'   -> False    (even for a file that IS in Finance)
path contains 'Rates'       -> True     (it is matching the FILENAME)
path eq '/Q3 Rates.pdf'     -> True
```

A person picks `path` from the dropdown — one of only seven watch choices — writes a
folder-shaped rule, saves it with a 200, and gets silence forever. It is strictly worse than
the pre-Phase-237 state in one respect: before, `path` matched *nothing* and the rule was
obviously dead; now it matches a fabricated filename-shaped value, so the rule *looks* live.

⚠ **AND THE TESTS CANNOT SEE IT.** `backend/tests/unit/services/sources/test_preview_rules_scope.py`
pins path matching by passing `path="/Accounting/Invoices/inv_001.pdf"` and
`path="/Shared/Tax/2026"` **directly into `_suggest_destination`** — folder-shaped values the
production call site can never generate. The tests are green and correct about the parameter;
they prove nothing about the feature. **This is SEED-171's lesson in a second register: a test
that pins a value proves the value is handled, never that anything produces it.** A test that
drove `build_preview` end-to-end would have caught it; one that calls the inner function
cannot.

## What to do when the trigger fires

Two honest options, and the phase that revives this should pick deliberately rather than
drift into the first one:

1. **Populate it.** Drive's `files.list` can return `parents`, and a folder-name lookup (or a
   walk already performed by the lister) can assemble a real path. Graph returns
   `parentReference.path` directly, which is why Phase 238 is the natural forcing function.
   Cost: an extra call or a cached folder map per listing.
2. **Withdraw it.** Remove `path` / `source_path` from `WATCH_ALLOWED_FIELDS` and from
   `ConditionPopover.WATCH_FIELDS`, so a path rule is refused at build time with a reason —
   which is exactly what Phase 237's SC#3 asks for. ⚠ This costs an SC: **Phase 237's SC#1
   names `path` verbatim** ("by name, type, path or size"), so withdrawing it must be
   recorded against that criterion rather than done quietly.

⛔ **What must NOT happen is the current state persisting undocumented** — a field that
promises folder location and silently carries a filename, with green tests over it. If
neither option is taken now, the fallback needs a comment at BOTH substitution sites and on
`SourceFile.path` saying it is a stand-in and naming this seed.

---

## ⚠ PARTIALLY DISCHARGED AT PHASE 238 (2026-09-07) — and the seed's own claim is CORRECTED

**Option 1 was taken, for Microsoft Graph.** `MicrosoftGraphSourceAdapter` sets `SourceFile.path`
from `parentReference.path` (Graph returns it free, in the same payload, which is exactly why
this seed's trigger was widened to *any* Graph adapter). `MockSourceAdapter` now carries real
paths too, so the conformance suite can assert the invariant across families rather than for one
of them.

**The fabrication is gone from the arm that mattered.** `ingest_enrich.py` no longer substitutes
`/<filename>`, and `watch_service.py` now writes the real `path` into `metadata.source` — a key
that was **absent**, which is why that arm was dead code and why the substitution was reached at
all. `test_238_source_path_honesty.py` drives the seed's own three lines as cases, including the
fabricated value, preserved as a regression rather than as a paragraph.

### ⚠ THE CORRECTION — this seed overstates its own defect, measured rather than assumed

> *"production always substitutes `/<filename>`"*

**That is true of the watch → ingest path and FALSE of the preview path.**
`preview_service._walk_folder:333-334` sets `f.path` from the traversal breadcrumb
(`f"{current_path}/{f.name}"`, seeded from `folder_name`) **before** the
`or f"/{f.name}"` at `:584` is ever reached. So a previewed file inside a sub-folder already
carried a real relative path, and only a flat listing with no folder name fell through.

The correction is recorded rather than the seed rewritten, because the seed being **partly**
right is what determined the fix: the substitution was removed where a fabricated value reached
a **RULE**, and deliberately kept where it reaches a **preview row a person is looking at**, in
which position a blank path column is the less honest signal. ~~Both sites now carry a comment
saying which they are.~~

> ⛔ **THAT LAST SENTENCE WAS FALSE, AND IS STRUCK THROUGH RATHER THAN DELETED BECAUSE THE
> CLAIM ITSELF IS THE FINDING.** Corrected 2026-09-10 by Phase 238's independent review
> (`238-REVIEW.md` CR-01). **There were THREE sites, not two.** The same commit that removed
> the fabrication from `ingest_enrich.py` ADDED a third — `confirm_preview` →
> `import_single_file` → `metadata.source.path` — and that third one is a **RULE site, not a
> row site**, so it is precisely the kind this seed says must not exist.
>
> ⭐ **A discharge note that counts the sites is only as good as the count.** This one was
> written in the same commit that created the site it failed to count, and it then read as
> reassurance for thirteen days. The defect shipped, was reachable by unvalidated client
> input (`folder_name`), and made a dead classification rule look alive.
>
> **Fixed 238-04** (`9d1d34641`): `walk_source_files` no longer mutates `SourceFile.path`;
> the display breadcrumb moved to `WalkResult.display_paths`, and only the adapter's own
> answer — or `None` — may be persisted. The preview row still shows `/<filename>`, which
> was always the correct half. Guarded by a fence asserting the stored VALUE `is None`,
> not the key's presence — see [[SEED-270]] for why that distinction is the whole story.

### What is still open, and it is only this

⛔ **Google Drive still has no `path`.** `files.list` does not return one, and assembling it
needs a `parents` walk or a cached folder map — real cost, and out of Phase 238's scope by
decision (`238-CONTEXT.md`, Out of scope). A Drive-watched file therefore has **no** `path` fact,
and a folder-shaped rule against it now **declines** instead of matching a fabricated filename.

⭐ **That is a strictly better failure than the one this seed was planted about** — a rule that
does nothing and is *visibly* doing nothing, rather than one that looks alive while matching the
wrong field. But it is not the feature, and the row stays open until Drive can answer.

⚠ **The end-to-end row is OWED, not passed.** `238-VERIFICATION.md` M-9 (*a `path contains
'/Finance/'` rule fires for a OneDrive file that IS in Finance*) is blocked behind the same
Azure app registration every other live Phase 238 row is blocked behind. Until it runs, the
Graph half is proven at unit level only — which is precisely the gap this seed's own closing
paragraph warns about: *"a test that pins a value proves the value is handled, never that
anything produces it."*
