---
phase: 299-links-to-the-thing-itself
status: partial
postponed: 2026-10-29
created: 2026-10-29
rows_total: 20
rows_run: 13
rows_blocked: 2
driver: operator
---

# Phase 299 — Human UAT (owed)

Verification returned `human_needed` (`299-VERIFICATION.md`): 5/5 ROADMAP success criteria and 6/6 requirements
(LINK-02..06, FIX-02) are verified in code and tests, but the G-4 lived-experience rows and the four-axis rows
have not been driven.

## Why these are owed, not run

Every row that matters here needs a **two-org account** (other-org links, Stay / Switch) or a **signed-out**
session (return-after-sign-in). Both mean signing the operator's browser session out and entering a password,
which Claude does not do. Same constraint as 298 (`298-HUMAN-UAT.md`). Two-org accounts on local: the dev
account `fhdmrd.dev@gmail.com` (`22f9c615` + `c1f18150`) and the fixture `s296-g4-colleague@example.test`.
**Before row 1, prove the active org** (profile menu shows the org name).

## Postponed by operator decision (2026-10-29)

Operator: *"can we move to next phase and postpone these?"* — the six owed rows below and decision 4 are
**postponed, not run**. Phase 299 stays `human_needed` and is **not closed** (ROADMAP checkbox unticked);
work moves to Phase 300. Run first when resumed: **G4-5a** (it is the only thing that closes BUG-261027-02).
Phase 300 cannot close until **G4-4a** has run, because its signed-out email journey depends on 299's sign-in return.

Owed: G4-5a, G4-5b, G4-4a, G4-4b, G4-4d, the 340 px mobile Link check; decision 4; X-7 Moonshot re-run (⛔ BUG-261024-01).

## Rows

**2026-10-29 — Claude drove 13 rows** (G4-2, A-2 and X-1..X-8 after the operator signed the tab in as `fhdmrd.dev@gmail.com`; X-7 ⛔) in the operator's already-signed-in Chrome (`fhdmrd@gmail.com`, ONE org `22f9c615`, proven via `GET /org/me`). Evidence in `299-VALIDATION.md`. The rest need a **second org** (G4-2, A-2, X-1..X-8 — that account is in one org), a **signed-out session** (G4-4a/b/d) or **network throttling/blocking** (G4-5a/b), so they stay owed.

Full row text (steps, pass line, failure line) lives in `299-VALIDATION.md` → G-4 rows and four-axis rows.
Fill the Verdict + Evidence cells there.

| Row | What | Run order |
|---|---|---|
| G4-2 | Other-org run link with a live chat: Stay, Switch, Switch back | ✅ PASS 2026-10-29 (Claude) — **A1 holds: still streaming at Switch back** |
| A-2 | Thread A streams while thread B is opened by pasted address | ✅ PASS 2026-10-29 (Claude) |
| G4-1 | Copy link → fresh tab; also the RunModal "Saves in" caption and the 340 px link surface at mobile width | ✅ core + RunModal caption PASS 2026-10-29 (Claude); **340 px mobile still owed** (operator) |
| G4-3 | Missing ≡ forbidden: same card, same 404 body and headers (DevTools) | ✅ PASS 2026-10-29 (Claude) |
| G4-4a | Signed-out return — password | 5 |
| G4-4b | Signed-out return — sign-up email link | 6 |
| G4-4d | Off-site return target planted in sessionStorage → lands on chat, never off-origin | 7 |
| G4-5a | Slow 3G: "Loading your chats…" at desktop and mobile; never "No recent chats" | 8 — **BUG-261027-02 closes only if this passes** |
| G4-5b | Auth blocked: 8 s "Still connecting…", 20 s "Can't reach Syrel" + Try again keeps the URL | 9 |
| A-1 | Multi-tool run reattaches from its address in a fresh tab | ✅ PASS 2026-10-29 (Claude) |
| A-3 | ≥ 50-message thread opened by address, refreshed → same thread at its tail | ✅ PASS 2026-10-29 (Claude) |
| X-1..X-8 | Full native roster + OpenRouter (derive from `MODEL_CAPABILITIES`): stream survives A → B → Back → Forward + other-org link + Stay | ✅ 7/8 PASS 2026-10-29 (Claude); ⛔ X-7 Moonshot rate-limited (BUG-261024-01) |
| G4-4c | SSO return | ⛔ **BLOCKED (D-41)** — cloud has 0 SSO / SAML providers; covered by `useAuth.test.ts` |

Also check during G4-1/G4-2 (layout the test DOM cannot measure, 299-03 deviation 3): the chat still scrolls
normally after a notice appears above it.

## Operator decisions (from `299-VERIFICATION.md`)

Operator, 2026-10-29: *"accept all three decisions, keep going"* — decisions 1-3 below are **ACCEPTED**.

1. ✅ ACCEPTED — Run-link rail highlight is not shown (NavPanel left alone).
2. ✅ ACCEPTED — Fork refusal is recognised by sentence wording (pinned by a test against `item_org_guard.py`).
3. ✅ ACCEPTED — CR-01: a schedule whose workflow is in an org the owner left falls back to the active org.
4. OPEN (not named in the answer) — A Builder draft created by its first save shows no Link until reopened.
5. OPEN — IN-01..IN-05 (see `299-REVIEW.md`).

## Before deploy (operator)

- Add Supabase Auth Redirect URLs: `https://app.<domain>/**`, `https://<domain>/**` and the one-box origin
  (cloud setting change — per-action approval).
- After deploy: `get_advisors(security)`. No migration ships with 299.

## At close (after the rows pass)

- SEED-178, SEED-015, SEED-312 → `shipped`; BUG-261027-02 → `closed` only if G4-5a passes.
- Record the rail-highlight deviation and the A1 result in `299-VALIDATION.md`.
