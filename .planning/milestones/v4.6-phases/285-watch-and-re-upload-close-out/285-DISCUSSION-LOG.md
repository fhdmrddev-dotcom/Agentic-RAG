# Phase 285: Watch and Re-upload Close Out - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-10-16
**Phase:** 285-watch-and-re-upload-close-out
**Areas discussed:** Retry cap (FIX-12), 'Minted by watch' test (FIX-13), Stuck-pending fix shape (FIX-14), Live re-drive method (SC#5)

---

## Pre-areas: seeds and fold candidates

| Option | Description | Selected |
|--------|-------------|----------|
| Defer all four seeds | SEED-261, SEED-341, SEED-077, SEED-315 are new writers/capabilities, not repairs | ✓ |
| Fold SEED-261 | Attachment failures counted in the run row | |
| Fold SEED-077 | Durable queue; far bigger than this phase | |

| Option | Description | Selected |
|--------|-------------|----------|
| Fold BUG-261014-05 | Same file as FIX-13, ~5 lines, honest purge receipt | ✓ |
| Leave it open | Keep 285 to the three majors | |

## Retry cap (FIX-12)

| Option | Description | Selected |
|--------|-------------|----------|
| Cap at 3 tries, mig 209 | Attempts counter; version change resets | ✓ |
| Every sync, no cap | No migration; the listed failure mode | |
| You decide | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Every run counts it | count_errors + last_error while any item is failed | ✓ |
| Only the run that tried | Runs go clean after the cap | |

| Option | Description | Selected |
|--------|-------------|----------|
| status success + last_error | UI already renders partial; no UI change | ✓ |
| New status 'partial' | Would render as failed; UI change | |

| Option | Description | Selected |
|--------|-------------|----------|
| First 3 names + count | Bounded | ✓ |
| Every name | Unbounded | |

## 'Minted by watch' test (FIX-13)

| Option | Description | Selected |
|--------|-------------|----------|
| Column in mig 209 | Marker set when the minter answers; fail-safe backfill | ✓ |
| Derive, no column | source_connection_id + external_id at purge time | |

| Option | Description | Selected |
|--------|-------------|----------|
| Keep it | Unprovable legacy rows are treated as linked | ✓ |
| Delete it | Today's behaviour | |

| Option | Description | Selected |
|--------|-------------|----------|
| Skip it | A doc another watch item references is kept | ✓ |
| Delete it | The minting watch owns it | |

| Option | Description | Selected |
|--------|-------------|----------|
| Real count + kept | purged_count = deleted rows; additive kept_count | ✓ |
| Unchanged shape | | |

## Stuck-pending fix shape (FIX-14)

| Option | Description | Selected |
|--------|-------------|----------|
| Mark failed on enqueue fail | In-flight leg untouched | ✓ |
| Also loosen in-flight leg | Skip stale pending-no-job; risks FIX-02 | |

| Option | Description | Selected |
|--------|-------------|----------|
| Mirror storage-fail arm | 201 + status failed + message | ✓ |
| 5xx error | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Heal in mig 209 | Re-enqueue if bytes exist, else mark failed; >1 h old only | ✓ |
| Read-only count only | | |
| Leave them | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Audit all 7 minters | Same rule wherever enqueue failure is log-only | ✓ |
| /upload only | | |

## Live re-drive method (SC#5)

| Option | Description | Selected |
|--------|-------------|----------|
| Real item + forced one | Re-sync watch A (team-note-058.txt), then a one-shot read_file wrapper in a driver script | ✓ |
| Real item only | | |
| Forced one only | | |

| Option | Description | Selected |
|--------|-------------|----------|
| Claude, after your OK | As 280 D-15; ⛔ recorded if no credential | ✓ |
| You drive, Claude reads | | |

## Claude's Discretion

- Migration 209 column names/types; `last_error` formatting and length bound; where the attempts increment lives; re-mint vs re-drive for a failed item that already carries a `document_id`.

## Deferred Ideas

- SEED-261, SEED-341, SEED-077, SEED-315 (reviewed, deferred, written back to each seed).
- Retry-policy UI; a per-file failure list in Sources; a unique constraint on `ingestion_jobs.document_id`.
