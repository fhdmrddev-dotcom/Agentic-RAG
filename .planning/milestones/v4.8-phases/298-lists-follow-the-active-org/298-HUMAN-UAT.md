---
phase: 298-lists-follow-the-active-org
status: complete
created: 2026-10-28
rows_total: 8
rows_run: 8
driver: claude (Chrome, two-org dev account, 2026-10-30)
---

# Phase 298 — Human UAT (driven 2026-10-30)

**All 8 rows PASS** (G4-2 after the G-3 fast-fix 974ba0c24 → 5f0eb2660). Evidence per row in `298-VALIDATION.md`. The browser was already signed in as the two-org dev account, so no sign-out or password was needed.

Verification returned `human_needed`: 4/4 success criteria are verified in code and tests (`298-VERIFICATION.md`),
but the G-4 lived-experience rows have not been driven.

## Why Claude did not drive them

The local browser session (2026-10-28) is signed in as `fhdmrd@gmail.com`, a **single-org** account (org
`22f9c615`). Every G-4 row needs a switch between two orgs. The two-org accounts on local are the dev account
`fhdmrd.dev@gmail.com` (`22f9c615` + `c1f18150`) and the fixture `s296-g4-colleague@example.test`
(`22f9c615` + `fec5cbf9`). Driving them means signing the operator's session out and entering a password, which
Claude does not do. The backend (`:8000`, `--reload`, serving `/org-items/*` → 401 unauthenticated) and Vite
(`:5173`) were both up, and migration 217 is applied locally.

## Rows

The full row text (steps, pass line, failure line) lives in `298-VALIDATION.md` → "G-4 lived-experience rows" and
"Four-axis row". Fill the Verdict + Evidence cells there.

| Row | What | Run order |
|---|---|---|
| G4-1 | Library switch | 1st — the cheapest, and it proves the active org |
| G4-2 | Workflows + run log switch | 2 |
| G4-5 | "N more … in {org} · Switch" count matches the DB | 3 |
| G4-6 | Move a folder → one `org.item.move` audit row (org_id = source) | 4 |
| G4-7 | Move refused (chat-bound folder; org-shared folder; mixed-org folder — CR-01) | 5 |
| G4-4 | Foreign folder refused (Builder marker, save error, Run modal) | 6 |
| G4-3 | Switch with a live stream | 7 |
| A-1 | Thread A streaming + thread B prompt, then switch | 8 (same setup as G4-3) |

Before row 1: sign in as the two-org dev account and **prove the active org** (profile menu shows the org
switcher; `localStorage['active-org-id']`).

## Residuals to acknowledge (not gaps — `298-VERIFICATION.md`)

1. **WR-08** — the Builder's "lives in {org}" marker is relative to the viewer's active org, not the draft's. The
   server refusal is correct. Deferred to Phase 299 (`deferred-items.md` #5).
2. **WR-06** — a header-less draft create is checked against the org the mig-106 trigger stamps, via the trigger's
   own `LIMIT 1` (no `ORDER BY`). Cloud has 0 multi-org users; revisit before any cloud user joins a second org.
3. **WR-05** — a narrow race between a move and a concurrent draft save / chat folder bind; documented in
   `org_move.py`, reproduced by two live tests.
4. **deferred-items #1** — the chat composer's folder scope survives an org switch (`ChatArea.tsx`); a
   one-statement fast-fix at the next `ChatArea.tsx` touch.
