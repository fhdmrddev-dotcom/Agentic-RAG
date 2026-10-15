---
phase: 283
driven: 2026-10-15T21:00Z–21:30Z (orchestrator, Claude in Chrome against the local dev app)
head: 25397ae24 (all three plans merged)
environment: local Supabase (127.0.0.1:54321/54322), backend 127.0.0.1:8000, Vite localhost:5173 (/app.html)
---

# Phase 283 — live evidence (D-13, D-22 scenarios 1-3)

## Roles, proven before any row was recorded

| Role | Account | Org | Proof |
|---|---|---|---|
| Ordinary member | `fhdmrd.dev@gmail.com` (`e6dc45ca…`) | `22f9c615` | `org_members.role = member` in `22f9c615`; not in `operator_users` (which holds only `d8a54002…`) |
| Operator | `fhdmrd@gmail.com` (`d8a54002…`) | `22f9c615` | the only row in `operator_users` |

⚠ The member account is ALSO org-admin of its own org `c1f18150`; every member row below sent / ran with
`active-org-id = 22f9c615…` (localStorage read back before each drive, `X-Org-Id` on every curl).

## D-13 — live two-role check on the real auth path (real JWTs from local GoTrue, real backend)

| Caller | Request | Status | Body |
|---|---|---|---|
| member | `GET /settings` | **403** | "…available to administrators only." |
| member | `PUT /settings` `{}` | **403** | same sentence |
| member | `GET /settings/reembed-progress` | **403** | same sentence |
| member | `POST /settings/reembed` `{}` | **403** | same sentence |
| member | `GET /settings/providers` (Run carve-out) | 200 | |
| member | `GET /me/preferences` | 200 | |
| member | `GET /audit-logs` | 200 | |
| operator | `GET /settings` | 200 | |
| operator | `GET /settings/reembed-progress` | 200 | |

The UI gate and the API gate agree: every route the member's strip hides is refused, and every route the
member's strip uses answers.

## D-22 scenario 2 — the operator's view (driven FIRST, the browser was already signed in as the operator)

- Persisted `settings_active_tab` cleared to simulate a fresh landing (prior value `"0"`, restored after).
- Rail entry "Settings" present; page opens on **AI Model [ACTIVE]**.
- Strip, in order: **AI Model · Search · Integrations · Preferences · Memory · Audit Log** (6). Reset present.
- AI Model panel: "LLM Providers" present, **"Show technical names" absent** (moved).
- Preferences panel: "Show technical names" row first, "Default chat model" picker second (UI-SPEC anchor).
- **PASS.**

## D-22 scenario 1 — a member's first visit

- Session switched to the member (local test token injected into the app's own session key — no form typed).
  `settings_active_tab` cleared (first visit).
- Rail (member): Chat · Workflows · Library · Connections · Skills · Experts · **Settings**. No Control Room.
- Clicked Settings straight from chat (not via the Library — `LibraryStatTiles`' member 403 on
  `/settings/reembed-progress` is a pre-existing defect outside this phase).
- Strip: **Preferences [ACTIVE] · Memory · Audit Log** (3). No Reset. No error banner.
- API calls made by opening Settings: `/me/preferences` ×2 — nothing gated.
- Flipped "Show technical names" ON (`aria-pressed=true`, `localStorage['technical-names']="true"`) and set
  Default chat model → `claude-sonnet-5-5`. DB read-back: `user_settings.preferences->>'default_model' =
  'claude-sonnet-5-5'` for `e6dc45ca…`.
- **Reload** → Settings → Preferences: toggle still `true`, model still `claude-sonnet-5-5`.
- Memory tab: renders the member's own empty state ("No memories stored yet…").
- Audit Log tab: renders the member's own rows (e.g. `Sep 23, 2026 · search.query`). Network log for the
  tabs: `/audit-logs` 200 (×2) — no 403 anywhere.
- D-05 fallback: persisted `settings_active_tab = "1"` (an operator tab) → reload → Settings opens on
  **Preferences**, panel populated (not blank).
- Cleanup: toggle back OFF, default model back to Auto; DB read-back `default_model = NULL`.
- **PASS.**

## D-22 scenario 3 — a large document's Chunks section

⚠ **Deviation from the planning ruling (orchestrator, recorded here):** the ruling said a synthetic
1,000-chunk document would be seeded. Driven instead on the largest REAL local document,
`Fahed Mrad Chapters 1-4_FM_29032026.docx` (`59e27382…`, **764 chunks**, operator-owned, org `22f9c615`).
Reason: the bound is count-independent (a fixed max-height), 764 unbounded rows already bury every section
below, and seeding writes fake rows into the operator's working library. Phase 284's 1,000-row truncation
also caps what a seeded 1,000+ document could show.

Measured with Chunks expanded (bounding rects, never `scrollTop`):

| Measure | Value |
|---|---|
| Section header | "Chunks **764**" (count in the header) |
| Region | `role=region`, aria-label "Chunk list, 764 chunks", `tabIndex 0` |
| Region height | **384 px** (`max-height: 384px`, `overflow-y: auto`) |
| Region content height (`scrollHeight`) | **135,741 px** — what the panel would have had to scroll past |
| Next section ("Tables") top − Chunks header bottom | **401 px** |
| Whole detail panel `scrollHeight` | 1,900 px |
| `overscroll-behavior-y` | `auto` → wheel past the list's end chains to the panel |

Navigation: **PASS** — the next section is one list-height below the Chunks header at 764 chunks.

### ⛔ FINDING — keyboard: the list is NOT one Tab stop in real Chrome (D-17 failed live)

- Chrome 154 makes an overflowing scroll container keyboard-focusable when it has no focusable children
  ("keyboard-focusable scrollers"). Each chunk body is its own `max-h-32 overflow-auto` scroller.
- Measured: **736 of 764 chunk bodies overflow**; `p.focus()` on an overflowing body takes focus, a
  non-overflowing one does not. So Tab from the region walks up to 736 nested scrollers before leaving.
- The 283-03 unit fence (`region.querySelectorAll("[tabindex]")` = 0, `user.tab()` leaves) is GREEN in jsdom
  and cannot see this — jsdom does not model scroller focusability. A green fence coexisting with the defect.
- Real key presses could not be delivered (the MCP tab is `visibilityState=hidden`; 0 `keydown` events seen),
  so the finding rests on the focusability measurement above, not on a recorded Tab walk.
- Pre-existing (the per-chunk cap predates 283), but it is exactly the D-17 / roadmap failure mode
  ("the bounded list traps keyboard focus"), so it is fixed in this phase — see the fix section below.

### Fix — CR-01 (`ba3aacdde`), re-driven live on the same document

The code review (283-REVIEW CR-01) found the same defect independently from the source. Fix: the per-chunk
`max-h-32 overflow-auto` nested scroller is removed; each chunk shows its full text inside the ONE bounded
region. Re-measured in Chrome 154 at `9cc7f8e4b`, 764-chunk document, Chunks expanded:

| Measure | Before fix | After fix |
|---|---|---|
| Nested scroll containers inside the region | 736 | **0** |
| Chunk bodies that take focus | 736 | **0** |
| Region height / label | 384 px · "Chunk list, 764 chunks" | 384 px · same |
| Region content height | 135,741 px | 310,748 px (full text, still inside 384 px) |
| Next section ("Tables") below Chunks header | 401 px | **401 px** |
| `overscroll-behavior-y` | auto | auto |

The region (`tabIndex 0`) is now the only keyboard-focusable element in the list.
⚠ Still not recorded: a real Tab key walk. The MCP tab is hidden and key events are not delivered (0 `keydown`
seen), so the Tab-leaves-the-region claim rests on the focusability measurement, not on a key press.
**Owed (one row):** with the window in front, focus the chunk list, press Tab once, confirm focus lands on the
next section header.

## Verdict

| Scenario | Result |
|---|---|
| D-13 live two-role API check | PASS |
| D-22 #1 member's first visit (door, Preferences landing, save + reload persists, Memory/Audit own data, no 403) | PASS |
| D-22 #2 operator's view unchanged (6 tabs, AI Model landing, moved blocks under Preferences) | PASS |
| D-22 #3 large document Chunks section (bounded, next section reachable, no wheel trap) | PASS on 764 chunks (deviation recorded above) |
| D-22 #3 keyboard (no Tab trap) | FAILED live → fixed (`ba3aacdde`) → re-measured: 0 nested focus stops; real Tab key press OWED |

## Owed row — closed 2026-10-16

Real Tab key press on the chunk list, driven by the operator: one Tab leaves the list. D-22 #3 keyboard → **PASS**.
