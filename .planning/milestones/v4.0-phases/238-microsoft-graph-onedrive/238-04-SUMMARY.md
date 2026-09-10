---
phase: 238-microsoft-graph-onedrive
plan: "04"
subsystem: connected-sources / preview + import
type: tdd
tags: [CR-01, BL-01, SEED-253, provenance, classification-rules, caller-controlled-input]
requires:
  - "Phase 238 (Microsoft Graph) — the commit range that introduced the defect"
  - ".planning/phases/238-microsoft-graph-onedrive/238-REVIEW.md — CR-01 / BL-01"
provides:
  - "metadata.source.path is the adapter's answer or None — never a fabrication, never caller-supplied"
  - "PreviewItem.source_path — the one value that may be persisted, separate from the displayed row"
  - "WalkResult.display_paths — the assembled breadcrumb, DISPLAY only, kept out of the DTO"
affects:
  - backend/app/services/sources/preview_service.py
  - backend/app/api/connectors.py
tech-stack:
  added: []
  patterns:
    - "separate the RENDERED value from the STORED value at the point of fabrication, not downstream"
    - "a request body may not decide a stored provenance fact"
    - "server-only fields are dropped at the API boundary rather than shipped and ignored"
key-files:
  created:
    - backend/tests/unit/services/sources/test_238_04_stored_path_is_never_fabricated.py
  modified:
    - backend/app/services/sources/preview_service.py
    - backend/app/api/connectors.py
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "D-238-04.1: fix at the point of fabrication (approach (a)) — walk_source_files stops mutating SourceFile.path"
  - "D-238-04.2: the /<filename> preview-ROW fallback is KEPT; only the stored value changes"
  - "D-238-04.3: source_path is server-only and dropped at the API boundary, never round-tripped through a client"
  - "D-238-04.4: _suggest_destination keeps the display breadcrumb — advisory output, pinned by an existing green test, triage not CR-01"
  - "D-238-04.5: base.py, import_service.py, watch_service.py and ingest_enrich.py are byte-unchanged (git hash-object)"
metrics:
  duration: ~50m
  completed: 2026-09-10
  tasks: 3
  commits: 4
---

# Phase 238 Plan 04: CR-01 — a stored source path is real or it is absent

Fixed the fabricated, partly caller-controlled `metadata.source.path` by splitting the
displayed breadcrumb from the storable value **at the point of fabrication** — `walk_source_files`
no longer mutates `SourceFile.path` — after driving three behaviour fences RED against the shipped
defect.

## What was wrong

Phase 238 removed a `/<filename>` fabrication from `ingest_enrich.py` *because a fabricated value
reached a classification RULE*, and re-introduced it by a new route in the same commit:

```
walk_source_files:333-334  f.path = "/<folder>/<name>"    # MUTATES the DTO in place
build_preview:592          file_path = f.path or "/<name>"
confirm_preview:728        import_single_file(..., source_path=item.path)   # NEW in 238
import_service:233         metadata["source"]["path"] = source_path         # NEW in 238
ingest_enrich:568-571      eval_facts["path"] = src_path  ->  rule matching
```

## The trap in the review's own suggested fix — verified, not taken on faith

The review proposed reading `adapter_path = getattr(f, "path", None)` inside `build_preview`,
commented *"None means unknown, and stays None"*. **That does not work**, because
`walk_source_files` has already overwritten `f.path` on the same object. Driven, before any edit:

```
BEFORE walk : f.path = None
AFTER  walk : f.path = '/Finance/Q3 Rates.pdf'  (same object: True )
the review's fix would read getattr(f,'path',None) -> '/Finance/Q3 Rates.pdf'
```

So the review's fix would have read the lie and changed nothing — while looking, in diff, exactly
like a fix. That measurement is what chose the approach.

## Approach chosen: (a) — stop fabricating onto the DTO

**`walk_source_files` no longer writes to `SourceFile.path`.** The breadcrumb it assembles (from
the request's `folder_name` plus the folder names `browse()` returned) is recorded in a new
`WalkResult.display_paths: dict[str, str]`, keyed by file id.

`PreviewItem` now carries **two** values with different jobs:

| field | meaning | may be persisted? |
|---|---|---|
| `path` | what the ROW SHOWS — adapter path, else breadcrumb, else `/<name>` | ⛔ no |
| `source_path` | the ADAPTER's answer, or `None` | ✅ this one only |

`confirm_preview` hands `import_single_file` `item.source_path`, never `item.path`.

**Why (a) and not (b) (record which ids were fabricated):** (b) leaves the DTO carrying a value its
own contract forbids and asks every future reader to consult a side-table *to disbelieve what the
object says*. The whole failure mode here is a reader trusting `f.path`. Approach (a) makes the
honest value the only thing on the object, and forces a caller who wants the rendering to **ask for
it by name** (`walk.display_paths.get(f.id)`) — it cannot be received by accident. It is also
strictly smaller: it deletes a write rather than adding a second source of truth.

⭐ **`backend/app/services/sources/base.py` is byte-unchanged**, as preferred. Proven with
`git hash-object` (this repo rewrites LF→CRLF, so md5 is not evidence here):

```
backend/app/services/sources/base.py            5dd43f8202e783edb68f2e89ea8cb3da9c7c7fdc  (worktree == da73b2174)
backend/app/services/sources/import_service.py  6a3a5aca3023005816a86da37ac68256ad4283a5  (worktree == da73b2174)
backend/app/services/watch_service.py           9ab30c2d81399572d8dacc422983216b5deea62c  (worktree == da73b2174)
backend/app/services/ingest_enrich.py           9829edf25ee032baa6cc118f74af0d874665257c  (worktree == da73b2174)
git diff --stat da73b2174 HEAD -- <those four>  ->  empty
```

## One change the review did not mention, and it is load-bearing

`SourcePreviewItem` is `extra="forbid"`, and the API builds it with
`SourcePreviewItem(**asdict(i))`. Adding a field to the dataclass therefore **500s the whole preview
endpoint** until the boundary is taught about it (deviation Rule 3 — blocking).

It is dropped rather than shipped, via a named `_PREVIEW_ITEM_SERVER_ONLY` frozenset, and the reason
is not tidiness: **putting `source_path` on the wire would invite a future confirm door to accept it
back from a client — the caller-controlled-provenance half of CR-01 re-opened by a different route.**
`confirm_preview` re-runs `build_preview` server-side and reads `source_path` from *that*.

## The three RED drives — what was planted, what was observed

⛔ Every fence **drives the behaviour and asserts the VALUE**. There is not one source grep in the
file, deliberately: WR-08's `'"path": source_path,'` substring fence is exactly why CR-01 shipped
green, and copying its shape would have reproduced the miss.

Nothing was *planted* — **the defect was live in the shipped tree**, which is the strongest possible
RED. All three failed on `da73b2174` + the test file alone, each for the reason it names:

| # | Fence | Observed RED (verbatim) |
|---|---|---|
| 1 | `test_an_unknown_path_is_stored_as_None_not_as_a_filename` | `assert '/Q3 Rates.pdf' is None` |
| 2 | `test_a_request_supplied_folder_name_cannot_reach_the_stored_path` | `AssertionError: the request body decided a stored provenance fact: '/Finance/Q3 Rates.pdf'` |
| 3 | `test_BOTH_writers_of_metadata_source_mint_the_SAME_path_for_the_same_file[unknown]` | `AssertionError: the two writers disagree about the same file: watch minted None, hand-import minted '/Q3 Rates.pdf'` |

Fence 3 **drives both writers for real** — `WatchService.tick()` and
`confirm_preview → import_single_file` — over the same `SourceFile`, and compares the `metadata`
handed to `async_mint_document_row`. Only the network, the mint and the enqueue are stubbed; the
whole `PreviewItem → source_path → metadata["source"]["path"]` chain executes.

**Four sibling cases were GREEN before the fix and stayed green after** — they are the controls that
prove the fix does not overcorrect into silence: a real adapter path survives verbatim; a
request-supplied `folder_name` cannot overwrite a real adapter path; the two writers already agreed
in the `real` case; and **the preview ROW still shows `/Finance/Q3 Rates.pdf`** when the path is
unknown. That last one is `test_the_preview_ROW_still_shows_a_breadcrumb_when_the_path_is_unknown` —
the display fallback is fenced, not merely preserved by luck.

After the fix: `7 passed`.

## Gate figures

| | before (`da73b2174`) | after |
|---|---|---|
| `pytest tests/unit -q --continue-on-collection-errors` | **71 failed** / 4491 passed / 2 xfailed / 2 xpassed | **71 failed** / 4498 passed / 2 xfailed / 2 xpassed |
| raw `grep -c '^FAILED '` | 71 | 71 |
| failing SET diff, **both directions** | — | **empty** (0 new, 0 gone) |
| `pytest tests/unit/services/sources -q` | 322 passed (at review time) | **329 passed** (+7, all mine) |

At the ceiling with zero headroom, and the set is identical rather than merely the count.
⚠ `test_230_ingestion_jobs_db.py::test_live_claim_exclusivity_and_stale_recovery` (the known flake)
**passed in both runs** and is in neither set — no re-run was needed and none was performed.

## Deviations from Plan

### Auto-fixed

**1. [Rule 3 — Blocking] `SourcePreviewItem` is `extra="forbid"`**
- **Found during:** the GREEN step, immediately after adding `PreviewItem.source_path`
- **Issue:** `SourcePreviewItem(**asdict(i))` at `connectors.py:1882` would raise on the new key,
  500-ing `POST /connectors/connections/{id}/preview`
- **Fix:** drop server-only fields at the boundary via `_PREVIEW_ITEM_SERVER_ONLY`; the wire shape
  is **unchanged**, so no frontend change is required
- **Commit:** `9d1d34641`

**2. [Rule 2 — CLAUDE.md directive] the hot-file ledger row was stale, and its staleness hid CR-01**
- **Found during:** the post-fix G-5 audit of my own `files_modified`
- **Issue:** `preview_service.py`'s row read `5 / 3 / 772` with the disposition
  ***"238: comment-only"*** — which is how the phase that added `source_path=item.path` and
  re-opened SEED-253 was recorded as having touched nothing. `connectors.py` read `40 / 19 / 2071`.
- **Fix:** re-derived both triples from git (`8 / 4 / 826` and `41 / 19 / 2091`), rewrote the
  dispositions, and wrote CR-01's invariants into the detail section under the same-commit sync rule
- **Commit:** `4b4c9b6a6` · both gates re-run green (`check-claude-md-size.cjs`,
  `check-hot-file-ledger.cjs`)

## Observed and deliberately NOT fixed (CR-01 scope fence)

**1. `_suggest_destination` still receives the DISPLAY breadcrumb** (`preview_service.py:603`). A
fabricated, caller-seeded value therefore still reaches a rule evaluation — but at **preview** time
only, and its output (`PreviewItem.destination`) is **advisory**: `confirm_preview` imports into the
request's `destination_folder_id` and never into `item.destination`. ⚠ More to the point,
`test_preview_rules_scope.py::test_build_preview_populates_path_and_applies_watch_rule` **PINS the
caller-seeded behaviour** — it passes `folder_name="Reports"` and asserts a `path contains 'Reports'`
rule matches. Changing it flips an existing green test, which makes it a triage decision with an
owner, not a line in a blocker fix. Recorded in the ledger so whoever revisits it starts from that
test.

**2. IN-03 is now doubly stale.** `base.py:42`'s comment still reads *"no adapter currently populates
it (production falls back to '/<filename>')"* — false since 238 (Graph populates it) and now
misleading about the fallback too. Untouched by decision: it is a contract file, IN-03 is triaged
separately, and 238-04's headline evidence is that this file is byte-unchanged.

**3. WR-08's two substring fences are untouched.** They are the reason CR-01 shipped green, but
rewriting them is WR-08's job. This plan's answer to them is additive: seven driven cases that
assert values, in a file that contains no greps.

**4. `.planning/phases/238-microsoft-graph-onedrive/238-REVIEW.md` is untracked** in the working tree.
Left uncommitted — the reviewer/orchestrator owns it.

## SEED-253 — leave it `partial`, and correct its discharge note

**Verdict: LEAVE AS IS (`status: partial`). Do NOT re-open to `planted`, do NOT close.**

- The gap the seed actually names — **Google Drive supplies no `path`** — is unchanged by this fix
  and still open. Its narrowed trigger (Drive's own path becomes cheaply available / a recursive
  subfolder *watch* ships / a Drive-side *"my path rule does nothing"* report) is untouched.
- Re-opening it to `planted` would be wrong: it would re-propose the Drive path-resolution feature
  as if Graph had never been done, and would erase Phase 238's genuine Option-1 discharge.
- Closing it would be wrong for the same reason it was `partial` in the first place.

⚠ **But one paragraph inside the seed is FALSE and should be corrected in place rather than
rewritten** (the register's own convention). Its discharge note says:

> *"the substitution was removed where a fabricated value reached a **RULE**, and deliberately kept
> where it reaches a **preview row a person is looking at** … Both sites now carry a comment saying
> which they are."*

There was a **third** site — `confirm_preview → import_single_file → metadata.source.path` — added
in the same commit, and it is a RULE site, not a row site. The seed's two-site inventory was
incomplete from the moment it was written, which is exactly the shape of miss it was planted about.
⭐ The seed's own closing warning turns out to describe its own discharge: *"a test that pins a value
proves the value is handled, never that anything produces it."*

**Also still true and still owed:** `238-VERIFICATION.md` M-9 (*a `path contains '/Finance/'` rule
fires for a OneDrive file that IS in Finance*) is blocked behind the Azure app registration. This
plan proves the chain at unit level in both directions; it does not discharge M-9.

## Commits

| Gate | Commit | Message |
|---|---|---|
| RED | `3659fee1f` | `test(238-04): drive CR-01 RED — a stored path that was fabricated and caller-controlled` |
| GREEN | `9d1d34641` | `fix(238-04): a stored source path is the adapter's answer or None (CR-01)` |
| — | `4b4c9b6a6` | `docs(238-04): repair the preview_service ledger row and record CR-01's invariants` |

No REFACTOR commit: the GREEN change is a deleted write plus one added field, and there was nothing
left to clean up.

## TDD Gate Compliance

RED ✓ (`test(238-04)`, 3 failing for 3 distinct named reasons) → GREEN ✓ (`fix(238-04)`) →
REFACTOR — (not needed). ⚠ The GREEN commit uses `fix(...)` rather than `feat(...)`: this is a
defect repair, not a feature, and the conventional-commit type is the honest one.

## Self-Check: PASSED

All four claimed files exist on disk; all three claimed commits resolve in `git log --all`;
`source_path=item.source_path` is present at `preview_service.py:777`.
