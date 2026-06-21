---
phase: 111-metadata-enrichment-extraction-backend
reviewed: 2026-06-15T00:00:00Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - backend/app/services/embedding_service.py
  - backend/app/services/metadata_field_service.py
  - backend/app/api/metadata_fields.py
  - backend/app/api/documents.py
  - backend/app/models/metadata_field.py
  - backend/app/models/user_settings.py
  - backend/app/config.py
  - backend/app/main.py
  - supabase/migrations/072_app_settings_extraction_model.sql
  - backend/.env.example
findings:
  critical: 0
  warning: 2
  info: 4
  total: 6
status: issues_found
---

# Phase 111: Code Review Report

**Reviewed:** 2026-06-15
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

Phase 111 un-pins metadata extraction off the hardwired gpt-4o, lifts the
3,000-char window via a head+tail sampler, adds user-defined custom fields with
per-field confidence, and gates it all behind a default-on `enriched` mode with a
byte-identical `legacy` reversibility path.

The security posture is sound where it counts: the `/metadata-fields` CRUD service
correctly hard-sets `user_id=caller` + `is_global=false` on create (never trusting
the body), uses own-scoped `.eq("user_id", caller)` predicates on update/delete that
collapse a cross-user miss to a 404 (not 403, no existence leak), validates `field_type`
against a closed `Literal` vocabulary, and hardens `field_key` against a regex + built-in
collision + reserved-prefix blocklist. The `metadata.field.create` audit type is already
seated in the live CHECK and `VALID_ACTION_TYPES`, so no enum drift. The dynamic Pydantic
`create_model` path is injection-safe (`field_key` is regex-bounded; `field_type` is a
closed vocabulary that raises on miss). The legacy `extract_metadata` (`content[:3000]`,
`json_object`, `DocumentMetadata`) is verified byte-identical — the diff adds new functions
below it and touches no removal lines in the legacy body. All three graceful-degradation
layers hold: a failing/garbage/raising extraction model returns `{"emitted": None}` and
the document still reaches `status=completed`. `asyncio.run` inside `ingest_document` is
safe — both call paths run it in a BackgroundTask thread with no live event loop.

Two real warnings surfaced. The most important: the production confidence-attach call
site in `documents.py` reimplemented the purpose-built `attach_confidence` helper
INCORRECTLY — it leaves a flat `confidence` key in the stored metadata alongside the
nested `_confidence`, violating the D-111-3 containment-key invariant (the helper's unit
test false-greens it because it tests the helper, not the call site). Second: the router
runs on a service-role Supabase client that BYPASSES RLS, so the repeated "RLS WITH CHECK
forces it too" comments describe a backstop that does not actually fire on this path.

## Warnings

### WR-01: Production confidence-attach leaks a flat `confidence` key (bypasses `attach_confidence`)

**File:** `backend/app/api/documents.py:1428-1430`
**Issue:** The enriched call site manually re-implements the confidence rename instead of
calling the purpose-built `attach_confidence` helper, and gets it wrong:

```python
metadata_dict = emitted.model_dump(exclude_none=True) if emitted else None
if metadata_dict is not None and getattr(emitted, "confidence", None):
    metadata_dict["_confidence"] = emitted.confidence  # attach AFTER dump
```

`build_metadata_model` declares `confidence` as a PUBLIC field with a populated-dict
default specifically so it survives `model_dump(exclude_none=True)` (its docstring at
`embedding_service.py:188-191` and the RED test at
`tests/unit/test_111_confidence_survives_exclude_none.py:69` both assert this). So after
`model_dump`, `metadata_dict` already contains a **flat** `confidence` key. Line 1430 then
ADDS `_confidence` but never pops the flat `confidence`. The stored `documents.metadata`
JSONB ends up with BOTH `confidence` AND `_confidence`.

This breaks the D-111-3 / D-111-9 contract: `_confidence` is supposed to be the ONLY
confidence carrier and a DISPLAY-ONLY nested key, NEVER a flat `metadata @>` filter
dimension. The flat `confidence` map is now an unintended flat filter dimension on every
enriched document. The `attach_confidence` helper does exactly the right thing
(`out.pop("confidence", None)` then conditionally sets `_confidence`) — it is just never
called from production; it is only exercised in isolation by the unit test, which is why
the test stays green while production stores the wrong shape (the classic
test-passes-prod-wrong gap this phase's design notes warned about).

**Fix:** Replace the hand-rolled lines with the helper that already encodes the correct
contract:

```python
from app.services.embedding_service import attach_confidence  # add to the Plan-04 import block
...
metadata_dict = attach_confidence(emitted.model_dump(exclude_none=True)) if emitted else None
```

`attach_confidence` pops the flat `confidence`, only sets `_confidence` when non-empty,
and matches the asserted contract (`"confidence" not in metadata_dict`,
`metadata_dict["_confidence"] == {...}`). Consider adding a test that drives the actual
`ingest_document` enriched branch (or asserts the stored dict has no flat `confidence`)
so the call site — not just the helper — is covered.

### WR-02: Service-role client bypasses RLS — the cited "RLS WITH CHECK backstop" does not fire

**File:** `backend/app/api/metadata_fields.py:33-34, 45-46` (and `metadata_field_service.py:9, 69`; `models/metadata_field.py:7`)
**Issue:** The router resolves its client via `Depends(get_supabase)`, which returns the
module singleton built with `settings.supabase_service_role_key`
(`dependencies.py:16-20`). A service-role client **bypasses Row-Level Security entirely**
— RLS `USING` / `WITH CHECK` policies are never evaluated for its statements. Yet the
code comments repeatedly assert the RLS policy is a defense-in-depth backstop:

- `metadata_field_service.py:9` — "the RLS WITH CHECK at migration 071:168 forces the same on INSERT"
- `metadata_field_service.py:69` — "RLS WITH CHECK forces it too"
- `metadata_fields.py:8` — "the RLS WITH CHECK at migration 071:168 forces it too"
- `models/metadata_field.py:7` — "The CRUD router additionally hard-sets ... server-side"

On this code path the application layer is the SOLE gate — the same service-role/RLS-bypass
situation already correctly handled in `read_enabled_field_defs` (which scopes by hand and
fail-closes precisely because "a BackgroundTask ... service-role client BYPASSES RLS"). The
app-level scoping here IS correct (create hard-sets `user_id`/`is_global=False`;
update/delete use `.eq("user_id", caller)`), so there is no actual cross-user leak today.
The risk is future-facing: a maintainer who trusts the "RLS forces it too" comments could
remove an app-level `.eq("user_id", ...)` or the `is_global=False` hard-set believing the
DB still catches it — and it would NOT, silently opening cross-user writes / global-field
escalation.

**Fix:** Correct the comments so the single-gate reality is explicit, e.g. "NOTE: this
router uses the service-role client (RLS-bypassing), so app-level scoping is the ONLY gate
— the RLS WITH CHECK at 071:168 is a backstop ONLY for JWT-scoped clients and does NOT
fire here. Do not remove the app-level user_id/is_global guards." (Mirror the accurate
framing already in `read_enabled_field_defs`.) No runtime change required; the guards are
correct as written.

## Info

### IN-01: Non-UUID `field_id` path param yields a 500 instead of 404/422

**File:** `backend/app/services/metadata_field_service.py:100-113, 116-127` (callers `metadata_fields.py:81-97, 100-111`)
**Issue:** `metadata_field_definitions.id` is a `uuid` column (migration 071:90). PATCH/DELETE
pass the raw `field_id` path param into `.eq("id", field_id)`. A non-UUID value (e.g.
`PATCH /metadata-fields/foo`) makes PostgREST raise a `22P02 invalid input syntax for
type uuid`, which supabase-py surfaces as an uncaught exception → FastAPI 500. The intended
contract is a clean 404. Own-scoped so not a security issue, just a rough edge / noisy 500s.
**Fix:** Either declare the path param as `field_id: UUID` (FastAPI auto-422 on a bad value)
or catch the exception in the service and map it to `None`/`False` so the router returns 404.

### IN-02: `MetadataFieldUpdate` skips the enum/options consistency validation that Create enforces

**File:** `backend/app/models/metadata_field.py:54-57`
**Issue:** `MetadataFieldUpdate` accepts `options` (and `enabled`) with no validation, while
`MetadataFieldCreate` enforces `_enum_needs_options` (an enum requires non-empty options).
A PATCH can therefore clear an enum field's `options` to `[]`/`null`, leaving an
`enum`-typed def with no allowed members. This does NOT crash — `build_metadata_model`
degrades an enum-with-no-options to a free `str | None` (`embedding_service.py:214-216`) —
but it is a silent type-contract drift the Create path is specifically guarded against.
**Fix:** Re-run the enum/options consistency check on update (requires loading the existing
`field_type`, since Update doesn't carry it), or document that an emptied enum intentionally
degrades to free-string at extraction time.

### IN-03: `extraction_window_cap <= 0` produces a degenerate (but non-crashing) sample

**File:** `backend/app/services/embedding_service.py:251-259`
**Issue:** `sample_for_extraction(text, cap)` with a misconfigured `cap <= 0` and
`len(text) > cap` computes `tail = text[-int(cap*0.3):]`; for `cap=0` that is `text[-0:]`
== the FULL text, and `head = text[:0]` == empty — so the output is the whole document plus
the elision marker (the opposite of capping). No crash, but the window-lift guarantee
silently inverts. `extraction_window_cap` is admin-only (`app_settings`, default 32000), so
low risk. **Fix:** Clamp `cap` to a sane floor (e.g. `cap = max(cap, 1000)`) at the top of
`sample_for_extraction`, or validate the column on write.

### IN-04: `options` jsonb assumed to round-trip as a Python list

**File:** `backend/app/services/embedding_service.py:212-213` (read at `read_enabled_field_defs:275`)
**Issue:** `build_metadata_model` does `Literal[tuple(d["options"])]`, assuming `options` is a
Python `list`. supabase-py normally deserializes a `jsonb` column to a list, so this is fine
in the common case — but `user_settings.py:358-365` documents a real codebase footgun where
the migration runner double-serializes JSONB (`provider_model_lists` arrives as a JSON
*string*). If `options` ever arrives as a string, `tuple("...")` would iterate characters
and build a per-character `Literal`. Not observed on the live write path here (the service
inserts a real list), but it is an unguarded assumption on a known sharp edge.
**Fix:** Defensively coerce in `build_metadata_model` — if `d["options"]` is a `str`,
`json.loads` it (mirroring the `provider_model_lists` defensive handling), else use as-is;
ignore non-list results.

---

_Reviewed: 2026-06-15_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
