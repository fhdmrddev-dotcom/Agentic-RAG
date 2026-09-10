---
id: BUG-260910-02
title: "Phase 240 build review — seven open warnings routed as debt after WR-01 and WR-03 were fixed"
reported: 2026-09-10
surface: Agentic-RAG
severity: minor
status: open
affected_areas: [backend/sources, backend/watches, frontend/sources, frontend/library]
folded_into: null
verified_closed_by: null
related_seeds: [SEED-260, SEED-264]
re_open_trigger: "Any phase touching services/sources/mail/, watch_service listing semantics, the boundary fence, or the watched-folder mark. WR-02 fires on its own the first time a watched label exceeds ~5,000 messages."
reproduces_on:
  branch: develop
  commit: 9e83203a2
  date: 2026-09-10
---

# BUG-260910-02: Phase 240 build review — the seven warnings left open

## What this is

`/gsd:code-review` ran against Phase 240's original four plans (`50f66ec39..962dfdfce^`) — the
build no one but its author had read, tracked as `OV-240-01`. It returned **1 Critical, 9
Warnings, 6 Info**.

- The **Critical (CR-01, a claimed ReDoS in `strip_quoted_replies`) is NOT CONFIRMED.** Measured
  against the shipped function: 32k chars in **0.001 s** where the finding predicted **36.8 s**,
  a 5 MB hostile line in **0.040 s**, and 400 randomised fuzz trials with a worst case of
  0.002 s. The mechanism does not hold either — the function uses `pat.match`, not `search`, so
  there is exactly one starting position and the lazy `.+?` expands linearly. Recorded with its
  inputs so the refutation can itself be challenged.
- **WR-01** (batch responses paired by position) and **WR-03** (archiving marks documents missing
  at source) were **fixed** — commit `9e83203a2`.
- The **seven below are open**, routed as debt under G-7 rather than triggering another build
  round: every ROADMAP success criterion for the phase is met and none of these is Critical.

## The seven

| id | what |
|---|---|
| **WR-02** | The anchor bounds where a watch STARTS; nothing bounds its growth. Past ~5,000 messages (`max_pages 200 × 25`) the listing is permanently incomplete, so H-5 deletion detection switches off for the life of the watch while still spending ~400 requests a pass. ⚠ Partly masked now that mail suppresses deletion detection anyway (WR-03's fix) — but the wasted requests and the permanently-incomplete listing are real. |
| **WR-04** | `google_drive.py:239` passes `label_name=label_id`, so a watched USER label writes `/Label_9` as the document breadcrumb, and `ingest_enrich.py:568` promotes it into the fact classification rules match on. Invisible on INBOX, which is what UAT drove. |
| **WR-05** | All seven tests of `/documents/{id}/conversation` are source-text greps. `truncated=False` would keep them green; `is_open`, ordering, `total` and the 404 path are unasserted. |
| **WR-06** | `ingest_splice.py` rewrites the whole `metadata` blob from a pre-4a snapshot, clobbering `metadata._images`. Harmless today only by coincidence of two unrelated MIME branches. |
| **WR-07** | `test_boundary_fence.py` uses a **non-recursive** glob, so every future module under `sources/mail/` is exempt from the completeness half of the fence — including SEED-260's Graph mail module. |
| **WR-08** | `gmail.py` interpolates a caller-supplied id into a request URL unvalidated; not exploitable today only because uvicorn decodes `%2F` before routing. |
| **WR-09** | `watchProductMark.ts` hardcodes Google, so a shipped Microsoft Graph watch draws **no mark at all**, and the next family needs a code edit. |

⭐ **WR-07 and WR-09 are the two that get worse with time** rather than staying still: both are
already wrong for Phase 238's shipped Graph family, and both will be wrong again for SEED-260.

## What the review cleared

Recorded so it is not re-litigated: `base.py` was verifiably byte-identical at the time,
`thread_key` cross-user isolation holds — carried by **RLS**, not by the grep-tested filter,
which is a sharper answer than the phase gave itself — the anchor encoding survived adversarial
checking, and `SourceListing.complete`'s fail-closed contract held.

## Full detail

`.planning/phases/240-mail-is-a-shape-not-a-fourth-adapter/240-REVIEW-BUILD.md` — file, line,
failure scenario and suggested fix for each.
