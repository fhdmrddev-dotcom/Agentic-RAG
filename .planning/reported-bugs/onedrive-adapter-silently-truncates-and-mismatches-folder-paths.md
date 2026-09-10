---
id: BUG-260910-04
title: The OneDrive/Graph adapter silently stops importing past one page, injects into its own search URL, and mints folder paths that no rule can match
reported: 2026-09-10
surface: Agentic-RAG
severity: major
status: open   # WR-02 FIXED 2026-09-10 (45b4fb9dc); WR-01 and WR-03 remain
affected_areas: [backend/connectors, backend/ingestion, RAG/classification]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-253]
re_open_trigger: null
reproduces_on:
  branch: develop
  commit: da73b2174
  date: 2026-09-10
---

# Three defects in the Phase 238 Microsoft Graph adapter, all shipped, all found by the independent review

Recorded from `238-REVIEW.md` **WR-01 / WR-02 / WR-03** so they are not held only by a phase
document. ⛔ The phase's BLOCKER (**CR-01**, a fabricated path reaching a classification rule) is
being fixed separately and is NOT part of this report.

## 1. A watched folder over one page silently stops importing — WR-02 (the worst of the three)

`microsoft_graph.py:161-165` re-issues a pagination cursor **only** when it matches
`https://graph.microsoft.com/v1.0/` byte-for-byte. There is no `else: raise` — any other shape
**silently restarts the listing at page 1**. Reproduced with an uppercase host, which is a legal
URI variation:

```
page_token : https://GRAPH.microsoft.com/v1.0/me/drive/root/children?$skiptoken=Z
CURSOR URL : https://graph.microsoft.com/v1.0/me/drive/items/F1/children   <- page 1 again
```

⭐ **Both consequences are silent, and the watch one is the serious one:**
- **Preview** re-reads page 1 until `MAX_PAGES_PER_FOLDER`, then reports
  `truncated=True, stopped_by="pages"` — *"this folder is too big"* about a folder that is not.
- **Watch** trips the `seen_tokens` cycle detector, sets `listing.complete = False` (so
  deletions correctly fail CLOSED — that part works), **but the run still reports `success`.**
  ⛔ **A watched OneDrive folder larger than one page silently stops importing at ~file 200,
  forever, and the UI says the sync succeeded.**

⚠ This is the same shape as `BUG-260909-04` (*"nothing happened"* while work had succeeded) and
`SEED-261` (an attachment failure reaching no surface) — **a run status that does not describe
what the run did.**

## 2. The search query is interpolated into the URL PATH — WR-01

The OneDrive search term goes into the URL **path** with only `'` escaped. Measured:

```
search(q="a'")?$expand=children&x=(''')     <- the caller's ? opens a real query string
```

⚠ **This is a regression against the sibling it was told to mirror**: `google_drive.py:254` puts
the same value in `params`, where the client escapes it. The Graph adapter builds the URL by hand.

## 3. Folder paths mix percent-encoding with a raw filename — WR-03

`_folder_path` returns Graph's percent-encoded path and concatenates the raw filename:

```
/Team%20Docs/Q3%20Plans/Q3 Plans.pdf
```

So a rule `path contains '/Team Docs/'` **never matches**. ⭐ That is `SEED-253`'s exact failure
arriving by a new route — a path that looks real and cannot be matched. It also passes drive-internal
ids through as folder paths (`/drives/b!abc/items/01XYZ`).

⚠ **Why UAT missed it:** the live run drove only `/Attachments` with an underscored filename —
no space, so no percent-encoding, so the defect could not appear.

# The transferable lesson

⭐ **All three are silent.** None raises, none logs an error a person would see, and two of them
report SUCCESS. **A connector that fails loudly is a support ticket; one that fails quietly is a
corpus that is wrong and nobody knows.** This milestone's whole premise is that a source is
connected once and then trusted — which is precisely the condition under which silent truncation
is most expensive.

# Fixes (from the review, verified as reasonable)

1. **WR-02:** refuse rather than guess — `raise` on an unrecognised cursor. The suffix pin on
   `graph_read` already validates the host on the way out, so re-issuing an unexpected cursor is
   safe; **silently restarting is not.** Add a driven case: mismatched cursor raises; matching
   cursor is re-issued verbatim.
2. **WR-01:** put the search term in `params`, mirroring `google_drive.py:254`.
3. **WR-03:** decode the percent-encoding before use, and refuse (or return `None` for) a
   drive-internal id rather than presenting it as a folder path. ⛔ After CR-01's fix, `None` is a
   legitimate honest answer — use it.

---

# ✅ WR-02 FIXED 2026-09-10 — `45b4fb9dc`

The silent-truncation half is closed. `_get_page` now REFUSES a cursor that does not begin with
`GRAPH_API_BASE` instead of falling through to the page-1 params. A watched folder can no longer
stop importing at ~200 files while reporting success — it fails loudly or it pages correctly.

**Driven RED first**: 4 failed / 2 passed, where the 2 passing were the positive controls (a valid
`nextLink` still re-issued verbatim; `page_token=None` still starts at page 1). Gate held at the
**71** ceiling, `4498 → 4504` passed; sources suite `329 → 335`.

⚠ **ONE OF MY OWN TEST CASES WAS WRONG AND IS RECORDED RATHER THAN QUIETLY DELETED.** I first
asserted that an UPPERCASE host (`https://GRAPH.microsoft.com/...`) must be REFUSED. It must not:
RFC 3986 §3.2.2 makes the host case-insensitive, so that is a legal variation Graph may emit, and
`egress.py:383` normalises with `host.lower().rstrip(".")` before the suffix match — so it reaches
the same pinned destination and is safe. **The refusal exists to stop a SILENT RESTART, not to
police URL spelling.** The case now lives as a positive control asserting the cursor IS re-issued
verbatim and page TWO comes back.

⭐ **The harness caught its own bug before the product did.** The first draft hand-rolled a
response stub and BOTH positive controls went red — which is the control doing exactly its job:
the harness was wrong, not the product. Had those two been written as presence assertions they
would have passed and the RED would have looked like six real defects. [[SEED-270]].

## Still open here

- **WR-01** — the search term is interpolated into the URL path; move it to `params`, mirroring
  `google_drive.py:254`.
- **WR-03** — percent-encoded folder segments concatenated with a raw filename, and drive-internal
  ids passed through as folder paths. ⭐ **Now cheaper to fix than when this was filed:** CR-01
  made `None` a legitimate honest answer for an unknown path, so WR-03 can return `None` rather
  than inventing a decoded string.
