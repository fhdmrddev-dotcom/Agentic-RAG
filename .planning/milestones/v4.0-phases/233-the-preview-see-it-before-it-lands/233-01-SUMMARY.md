# Plan 233-01 Summary — the preview IS the diff pass

**Executed:** 2026-09-05 · **Status:** Complete · **Requirements:** PREV-01, PREV-02, PREV-03, LIB-09

---

## What shipped

**`backend/app/services/sources/preview_service.py`** (new, ~530 L) — one classifier, run twice.

- `classify_source_file()` — **PURE**, eight ordered arms, returns `(bucket, fragment, reason)`.
- `build_preview()` — lists through the `SourceAdapter` contract, builds the tier-1 index, evaluates
  routing rules as a read, and returns counts that sum to the listed total plus a four-zero `wrote`
  receipt.
- `confirm_preview()` — **calls `build_preview` again** rather than deriving anything a second time.
- `BUCKETS` is a 4-tuple; `Outcome` is a 3-value `Literal`.

**`import_service.import_single_file`** — four new optional parameters (`folder_id`, `external_id`,
`source_version`, `source_system`) and a `_already_here` transport flag on the duplicate arm.

**`api/connectors.py`** — `POST .../preview` (read-only) and `POST .../preview/confirm` (the only
writing door), both org-scoped through `connector_service.get_connection`.

**`models/connector.py`** — five strict response models. `bucket` and `outcome` are `Literal`s, so a
fifth bucket or a fourth outcome is a `ValidationError` at the boundary, in a diff a reviewer reads.

---

## D-1's two-tier identity, and the claim this phase refuses to make

**Tier 1, at preview time:** `(source_system, external_id, source_version)` compared for **EQUALITY**.
⛔ Never a hash and never described as one.

`PROJECT.md`'s *"a `content_hash` lookup, not a guess"* is **FALSE for a list-only pass**, and the
three reasons were measured rather than reasoned about:

| Claim | Reality |
|---|---|
| we can hash it | `documents.py:620` hashes raw **bytes** — requiring the download this preview exists to avoid |
| Drive publishes a hash | **No** hash at all for native Docs / Sheets / Slides |
| Graph publishes a hash | Only `quickXorHash` is guaranteed; `sha256Hash` is documented as unsupported, and hashes are populated **after** the item is downloaded |

So the label is *"Already here — matched by source file, not by content"*, and the reason sentence
states that the bytes have not been compared.

**Tier 2, at splice:** the shipped `sha256` inside `mint_document_row`, unchanged. It is what settles
a file the preview could only say *"can't tell"* about — and when it does, the file is neither
imported again **nor embedded again**, because a duplicate mint deliberately does not schedule
`splice_document`.

---

## Decisions

- **D-233-01 — no migration.** Tier-1 identity lives in `documents.metadata.source`, a `jsonb` column
  that already exists. The ROADMAP predicted *"none expected"* and it was right.
- **D-233-03 — `source_version` is Drive's `modifiedTime`**, already returned as
  `SourceFile.modified_at`. No adapter change, no second API call, and it is honest: it says the file
  **moved**, never that the bytes differ.
- **D-233-08 — rules are evaluated as a READ.** `match_metadata` runs against the metadata the
  preview actually has (filename, modified date). A rule keyed on extracted metadata cannot fire yet,
  and the honest outcome is the chosen folder. ⛔ `build_suggestion` resolves a folder **name**; no
  folder is minted, which is what a naive build gets wrong.

## The eight classifier arms, and why the order is load-bearing

1. tier-1 equality → **here**
2. shortcut → **unk** (we can see the pointer, not the file)
3. native Doc / Sheet → **unk** (exports fine, but Drive publishes no identity for it)
4. any other Google native (Slides, Forms, Drawings) → **uns** (no readable export path)
5. no mime **and** no extension → **unk**
6. `application/pdf` → **unk**
7. mime in `ALLOWED_MIME_TYPES` → **add**
8. otherwise → **uns**

⭐ **Arm 6 is the one that matters.** `application/pdf` **is** in the supported set, so an
alphabetical or "supported-first" ordering would count every scan as *will be added*. An image-only
PDF has no text and only reading it can say so — being optimistic there is precisely how a preview
lies, and it is a ROADMAP failure mode in its own words.

---

## Verification

`pytest tests/unit/services/sources -q` → **71 passed** (34 of them new).

| Suite | Cases | What it proves |
|---|---|---|
| `test_preview_classifier.py` | 25 | each bucket; no unknown is a shrug; the `here` verdict makes no content-identity claim |
| `test_preview_service.py` | 9 | the preview writes nothing; preview and confirm agree; every file is accounted for; a duplicate is not re-embedded |

**Driven RED, not asserted.** The load-bearing fence
(`test_here_verdict_makes_no_content_identity_claim`) was driven against a reason sentence rewritten
to *"Matched by a content hash lookup, not a guess."* — it **fires**, and `preview_service.py` was
restored **md5-identical** (`bc55df4a…` before and after).

⭐ **SC#2 is structural, not inspected.** `_ReadOnlySupabase`'s every write verb **raises**, so
*"the preview wrote nothing"* is a property the harness makes impossible to violate silently rather
than a claim a test makes by looking afterwards.

**Backend baseline: no regression.** Merge base (this plan's source stashed, its tests removed)
measured **72 failed / 3567 passed**; with the plan, **72 failed / 3601 passed**. ⚠ `CLAUDE.md` locks
the ceiling at **71 with zero headroom** and the tree was already at **72 before this phase started**
— a pre-existing condition, recorded for whoever owns it.
