# 240-02 — SUMMARY

**Goal:** every mail document carries a conversation key that both ingest paths write and
something actually reads.
**Commit:** `d16c99df3` · **Status:** complete

## What shipped
- `thread_key_for()` in `email_extraction_service.py` — `References[0]` → `In-Reply-To` →
  `Message-ID` → `None`. Normalised, control characters dropped, capped at 512 chars.
- **Migration 175 applied to the live local DB** (`ALTER` + `CREATE INDEX` only — no reset, dev
  data intact). `full-schema.sql` regenerated without `--reset`.
- `EnrichedIngest.thread_key`, written by BOTH ingest paths.
- Promoted into `PROMOTED_TYPED_COLUMNS` **and** the resolver whitelist.

## Why headers and not Gmail's `threadId`
D-3 calls this a **retrieval-grouping** column, not a provider id. A provider thread id is
meaningless outside that provider and that account, so it could never group a hand-uploaded `.eml`
with its synced twin — and manual upload is where nearly all mail in this Library is today. It also
keeps the SOURCE CONTRACT untouched: no thread id travels through `SourceFile`, which is what lets
`base.py` close byte-identical. ⭐ Google's own reference agrees — its `threadId` description says
threading requires *"the `References` and `In-Reply-To` headers … in compliance with RFC 2822"*.

⚠ **Known weakness, recorded not hidden:** a client that omits `References` yields a thread of one.
That is a VISIBLE degradation, never a wrong grouping — the failure direction that matters.

## Driven RED, once per path
Deleting the write from the legacy path failed naming it; deleting it from the queue path failed
naming that one. Both restored.

## Three existing fences were RE-EXPRESSED, then re-driven RED
`test_ingest_enrich_shared.py` pinned the LITERAL SPELLING of the metadata write (a regex requiring
`"metadata"` to be the first key). Splicing `thread_key` into the same write changed the SHAPE and
not the PROPERTY. The assertions now name the property — and were **re-driven RED against the
original BUG-260905-06 defect** (the whole write block deleted) before being trusted.

## Ledger findings
- ⭐ **`ingest_splice.py` FIRES G-5 at 4 phases and had NO ROW** — Phase 229's own G-5 discharge
  created it, so the extraction moved code out of the guardrail's sight.
- **`email_extraction_service.py`** absent for its entire life.

## Owed
Nothing from this plan.
