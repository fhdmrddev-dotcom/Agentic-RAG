---
phase: 298-lists-follow-the-active-org
artifact: VALIDATION
seeded_by: planner (2026-10-28, with 298-01..05-PLAN.md)
status: owed
rows_total: 9
rows_run: 0
rows_blocked: 0
---

# Phase 298 — Lists Follow the Active Org: VALIDATION (owed UAT)

⛔ **EVERY ROW BELOW IS OWED AND UNCHECKED.** Seeded at planning. A Verdict cell is filled only by the
session that drives the row, with that row's own evidence (screenshot + DOM read + DB read). Rows run at
`/gsd:verify-work 298`, after all five plans have merged and migration 217 is applied locally.

**Who drives:** Claude, in Chrome MCP, on the local stack (D-24). **Account:** the dev account, which is in
two orgs — prove which org is ACTIVE before every row (memory `reference_dev_account_is_in_two_orgs`):
read the switcher label and `localStorage` / the `X-Org-Id` on the first list request.

**G-2:** the new UI (count line, out-of-org marker, move sheet) was self-approved under D-23; the operator
sees it here for the first time. Any row the operator would reject is a FAIL, whatever the tests say.

**What the automated suites already cover (not a substitute):** `test_298_list_narrowing.py`,
`test_298_two_org_lists_live.py`, `test_298_foreign_binding.py`, `test_298_org_matrix.py` (+ live row),
`test_298_org_items_routes.py`, `test_298_org_move_live.py`, `test_298_migration_217_shape.py`, and the
298-04/05 vitest suites (org switch with out-of-order answers, Realtime filter, count line, sheet lifecycle).

## G-4 lived-experience rows (D-24)

| # | Scenario | Steps | Pass when | Fail when | Verdict | Evidence |
|---|---|---|---|---|---|---|
| G4-1 | Library switch | Open `/app/library` in org A with ≥ 1 folder in each org; switch to B from the profile menu | Tree shows "Loading folders…", never "No folders yet"; Root count omitted, never 0; then only B's folders (incl. B's org-shared); selection is Root; detail panel closed | any A folder visible after the switch; "No folders yet" or a 0 before B answers | ☐ | |
| G4-2 | Workflows + run log switch | `/app/workflows` (Yours + drafts), switch; then the run log, switch back | "Loading your workflows…" / the log's loading line, never "You have no workflows yet." or a 0 chip; only the new org's rows; project filter back to All | an old-org card or run row after the switch; an empty sentence before the answer | ☐ | |
| G4-3 | Switch with a live stream | Start a long chat in thread A; while it streams, switch org | History column shows "Loading your chats…", not "No recent chats"; no crash; the stream does what StreamsProvider already does; thread A not listed in the new org | an error boundary; "No recent chats" during the refetch; the old org's threads listed | ☐ | |
| G4-4 | Foreign folder refused | With a crafted request (curl, or devtools fetch) PATCH a draft in org A to bind a folder in org B; then try to run a workflow so bound | Builder shows "{name} — lives in {Org}" in the KB picker; the save-error span shows the server sentence naming the folder and both orgs; the Run modal shows the same sentence | a 500, "we can't read this shape yet", "inputs weren't accepted", a blank or raw-id option | ☐ | |
| G4-5 | Count + Switch | In org A with own items in B, look under each list | "N more … in {B} · Switch" with the TRUE count (check the DB); Switch lands in B on the same view with those items | the line reads 0, shows while loading, or the count disagrees with the DB / the list after Switch | ☐ | |
| G4-6 | Move a folder | ⋯ on an owned clean folder → "Move to {B}…" | Sheet: "Checking…" then "This folder, N subfolders and M documents move to {B}." before any Move button; Move → "Moved to {B} · recorded"; the folder leaves A's list on the server's answer; B's list has it; exactly ONE `audit_log` row (`org.item.move`, org_id = A) | a Move button before the preview; red anywhere; the item vanishing before the answer; zero or two audit rows | ☐ | |
| G4-7 | Move refused | Try to move a folder a chat is bound to, and an org-shared folder | The sheet shows each server sentence verbatim in the amber box with only Close; nothing moved (DB) | a generic error; a partial move; a Move button | ☐ | |

## Four-axis row (CLAUDE.md UAT scoreboard — UI state)

| # | Axis | Scenario | Pass when | Verdict | Evidence |
|---|---|---|---|---|---|
| A-1 | Parallel-thread / UI state | Thread A streaming while thread B accepts a new prompt, then an org switch (same as G4-3 plus B) | Both threads' streams behave exactly as before the phase; the list reloads for the new org without "No recent chats" | ☐ | |

**Cross-provider roster: NOT exercised — by decision (D-28).** No provider, prompt, tool or streaming code
changes in this phase; the D-25 chat-retrieval matrix row runs stubbed on one path. Multi-tool and
long-message axes are likewise not touched by this phase's diff. This is a decision, not an omission.

## SC#3 before/after matrix (D-25) — where it lives

Automated, not a manual row: `backend/tests/unit/test_298_org_matrix.py` (two-org user × {chat retrieval,
scheduled run, API-key run, publish, attended launch} × {header A, header B, no header}, plus the empty-set
and header-less rows) and its live row in `backend/tests/integration/test_298_org_matrix_live.py`. Verify-work
records their pass lines here:

| Suite | Result | Skipped | Run on |
|---|---|---|---|
| test_298_org_matrix.py | ☐ | | |
| test_298_org_matrix_live.py (`-rs`) | ☐ | | |

## Operator steps owed before deploy (D-35)

1. Paste `supabase/migrations/217_org_item_move_audit.sql` into the CLOUD Supabase SQL editor (approval-gated).
2. `get_advisors(security)` (read) — 0 new ERROR.
3. Only then deploy the backend (the boot audit guard refuses to start without 217).
</content>
</invoke>

## Register updates owed at phase close (not before verification passes)

- `SEED-389` (this phase is its answer — per-org, D-01), `SEED-313` (Root-upload arm, 298-01 Task 2) and
  `SEED-317` (Library provenance on a switch, 298-04 Task 1) are `folded_into: 298`. Flip each to its
  shipped status in its own frontmatter only after the rows above pass; leave them as they are if a row fails.
- `BUG-261027-02` stays `open` for Phase 299 (UI-D9: first-paint "No recent chats" is deliberately untouched here).
- The three seeds 298-03 plants (thread/run moves, published-workflow move, run-start folder override) stay `planted`.
