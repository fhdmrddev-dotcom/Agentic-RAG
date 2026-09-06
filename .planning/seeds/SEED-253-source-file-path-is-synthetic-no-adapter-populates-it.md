---
seed_id: SEED-253
title: A watch rule can filter on `path`, but no adapter populates it — production always substitutes `/<filename>`, so folder-shaped path rules silently never match
created: 2026-09-06
planted_during: Phase 237 reviewer re-review (claude, REVIEWER — did not build this phase)
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - Phase 237 (RULES-01 / SC#1 / SC#3) — the phase that introduced `SourceFile.path`
  - SEED-171 — the sibling lesson that a green test can coexist with a broken behaviour
  - Phase 238 (Microsoft Graph — OneDrive and SharePoint) — SharePoint's library paths are
    the natural forcing function; ⭐ this is the most likely place the gap becomes visible
trigger_when: >
  ANY of: (a) Phase 238 lands a Graph adapter, since SharePoint document-library paths are
  folder-shaped by nature and a user WILL write a path rule against them; (b) a recursive /
  subfolder watch ships, making a file's folder location meaningful rather than constant;
  (c) any user-reported bug of the shape "my path rule does nothing"; (d) any phase that
  touches `SourceFile` or `preview_service._suggest_destination`.
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
