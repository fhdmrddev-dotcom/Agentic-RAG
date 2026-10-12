# Phase 270: The Document as an Object - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-30
**Phase:** 270-the-document-as-an-object
**Areas discussed:** Old-document backfill, Download mechanism, Version wording + control, File-facts layout + dates

---

## Old-document backfill

| Option | Selected |
|---|---|
| Honest "not recorded" | ✓ |
| One-shot backfill script | |
| Lazy fill on first view | |

Columns: typed nullable columns ✓ (vs one jsonb, vs you decide).

## Download mechanism

Signed URL, org-checked first ✓ (vs backend-streamed). TTL 60 s ✓ (vs 5 min). No stored file: disable + say why ✓ (vs fetch from source).

## Version wording + control

One button naming its target ✓ (vs two buttons). Placement: panel header + list row ✓ (vs panel only).

## File-facts layout + dates

Two separate labelled date rows ✓ (vs merge). Skip sketch, record decision ✓ (vs run sketch). "not recorded" per fact ✓ (vs hide rows).

## Claude's Discretion

Endpoint naming, facts block position, uploader display, size format, hash-check scripting.

## Deferred Ideas

Old-doc backfill; fetch-from-source download; two-button layout.
