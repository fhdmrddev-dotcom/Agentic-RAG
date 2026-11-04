---
phase: 307
review: 307-REVIEW.md
fixed: [CR-01, WR-01, WR-02, WR-03, WR-04, WR-06, WR-07, IN-01, IN-03, IN-04]
skipped: [WR-05, IN-02]
date: 2026-11-04
---

# Phase 307 — code review fixes

The first fixer agent committed eight fixes test-first, then stalled while writing its report.
Its stale local-DB lock (about 3 h old, held by that dead agent) was removed. The orchestrator then
finished WR-06 and IN-01 test-first: each new test was run and failed before the fix.

| ID | Status | Commit | What changed |
|----|--------|--------|--------------|
| CR-01 | fixed | `d87d3c537` | `/oauth/token` and `/oauth/revoke` read their bodies through a capped stream read with `parse_qsl`, the same way `register` does. A chunked body with no `Content-Length` can no longer get past the 16 KB cap. |
| WR-02 | fixed | `fc0d8db23` | Taking a code and marking it used is now one atomic Lua script, and it fails closed on a Redis error. |
| WR-01 | fixed | `2005a34a0` | Approve writes the grant and its code as one unit, so it never leaves a grant that can't connect. |
| IN-04 | fixed | `cb3799297` | If the client was pruned between authorize and approve, the answer is 410, not 500. |
| IN-03 | fixed | `f6f284616` | `host_seeded` is read from the live allowlist entry. |
| WR-03 | fixed | `374e36c00` | The connected-app list and the revoke audits show the redirect host the member actually approved. |
| WR-04 | fixed | `56bc3704e` | Never-granted client-metadata rows are pruned, the same way self-registered client rows already were. |
| WR-07 | fixed | `e485e9659` | `check-migration-224-live.py` checks the schema rather than seeded data, and reports a harness error separately from "not live". |
| WR-06 | fixed | (orchestrator) | When the consent page swaps in a new org on its own after a re-read, it starts from a clean draft. Allow is now blocked by the number of folders it would actually send. |
| IN-01 | fixed | (orchestrator) | A refused grant row is audited with `credential: "oauth"`. Key rows are unchanged. |
| WR-05 | **skipped — deferred (SEED-397)** | `8375cd385` | The limits are door-wide ceilings until per-caller addressing lands. The token-refresh impact is now recorded in the seed body. The operator's risk acceptance from 2026-10-31 stands. |
| IN-02 | **skipped — for /gsd:secure-phase** | — | Whether the "verified" badge on a client-metadata name reads as covering the name is a copy and design question. |

## Gates after the fixes

- **Related backend unit suites** (`-k "307 or 305 or 304 or api_key or egress or 293"`): 1629 passed.
- **Frontend** (connect, apiKeys, org and admin folders): 73 files, 866 passed. tsc reports 61 errors, the same as at base.
- **Backend unit baseline:** `[GATE PASSED]` 70 failed, 12326 passed, 0 errors (ceiling 71).
