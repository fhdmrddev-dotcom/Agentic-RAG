# Phase 167 — VALIDATION (SC#10 4-axis + invitation/greenlist/prefs lived-experience UAT)

**Status:** authored at plan-time (2026-07-21) — rows are executed at `/gsd:verify-work 167`.
**Why SC#10 applies (D-167-09):** VIS-02's per-user model default IS provider routing — the user's chosen default must route correctly across OpenAI / Anthropic / Google / OpenRouter. So the **cross-provider axis is load-bearing** here (not incidental): a per-user Anthropic default must route to Anthropic, a per-user OpenAI default to OpenAI, with the shared Deep path byte-identical when NO preference is set (D-14). Greenlist changes are UI state (the other SC#10 trigger). Per CLAUDE.md "UAT scoreboard recipe", rows live HERE, not in PLAN.md tasks.

**Drive:** Chrome MCP (or operator-clicks + psycopg2 evidence per the reported chrome-wedge fallback). Test login: `fhdmrd@gmail.com` / `123456` at `http://localhost:5173/`. Every user is org-admin of their personal org (mig 105) → the org shell + the now-live Invitations & Roles tab are reachable for the personal org.

> **Pass condition (bottom of file):** all 4 axes green (VIS-02 cross-provider routing is the hard bar), PLUS the invite→accept→join E2E row and the greenlist fail-closed row, PLUS L1–L8 lived-experience.

## Setup

- **Second identity for invitations:** a second test email (or a throwaway) to receive an invite and accept as (a) a brand-new signup and (b) an existing account. With `EMAIL_PROVIDER=none` (default), the invite LINK is logged by the backend / returned in the send response — copy it to drive the accept.
- **Greenlist seeding:** via psycopg2 (`:54322`) confirm `app_settings.feature_visibility` after a role-audience write; seed a member-role user to prove the fail-closed deny.
- **VIS-02 lock:** toggle the operator lock (its app_settings/organizations.settings home per Plan 04) to exercise both the unlocked-pick and the locked-inert paths.

---

## Axis 1 — Cross-provider (OpenAI · Anthropic · Google · OpenRouter) — **VIS-02 routing is load-bearing (D-167-09)**

| # | Provider (representative model) | Scenario | Expected |
|---|---|---|---|
| 1 | OpenAI (gpt class) | Set the per-user default model to an OpenAI model (within the allowed set) in Settings; start a NEW chat with NO in-composer model pick | The run routes to OpenAI (the per-user default is the server-side fallback); LangSmith/logs show the OpenAI provider; response streams |
| 2 | Anthropic (claude class) | Set the per-user default to a Claude model; new chat, no in-composer pick | Routes to Anthropic — the provider is re-derived from the model id (no per-provider fork, D-14); streams |
| 3 | Google (gemini class) | Set the per-user default to a Gemini model; new chat, no in-composer pick | Routes to Google; streams |
| 4 | OpenRouter (any) | Set the per-user default to an OpenRouter model (experimental axis — note-only if flaky) | Routes to OpenRouter OR documented external failure (not our code) |
| 4b | **Deep byte-identical (D-14)** | With NO per-user preference set, start a chat | The send path is byte-identical to pre-167 (the overlay is a strict no-op when unset) — the effective model is the operator/org default, unchanged |

## Axis 2 — Multi-tool (2+ tools in one prompt)

| # | Scenario | Expected |
|---|---|---|
| 5 | With a per-user default set, one prompt exercising `search_documents` + `execute_code`; mid-run, open the org shell → Invitations & Roles tab (send an invite) then return to chat | The multi-tool run uses the per-user default model + routes correctly; opening the shell / sending an invite does NOT tear down the in-flight run; the invite send carries `X-Org-Id`; returning shows the completed run intact |

## Axis 3 — Parallel-thread (Thread A streaming while Thread B accepts a prompt)

| # | Scenario | Expected |
|---|---|---|
| 6 | Thread A mid-stream (per-user default = provider X). Start Thread B with a new prompt while A streams. | B streams under the same per-user default; no cross-thread model/provider bleed; both resolve independently. |
| 7 | While A streams, change the per-user default model in Settings, then start Thread C. | A finishes on its original model (resolution is per-run at send); C picks up the NEW default; the change never mutates the in-flight A (no shared-path fork). |

## Axis 4 — Long-message (≥ 50 prior messages OR ≥ 5 KB prompt)

| # | Scenario | Expected |
|---|---|---|
| 8 | In a thread with ≥ 50 prior messages (or a ≥ 5 KB prompt), with a per-user default set, send a message. | The per-user default overlay adds no measurable latency to the heavy send (the read is async/fail-open); the run routes to the per-user default; no regression on the long-context path. |

---

## E2E — Invite → Accept → Join (the INV-01/INV-02 acceptance bar)

| # | Scenario | Expected |
|---|---|---|
| E1 | Org-admin opens the org shell → **Invitations & Roles** tab → Send invite (email = the second identity, role = Member). | A `pending` invitation row appears; the send response/log surfaces the copy-able `link` (link-first, D-167-02); psycopg2: `org_invitations` has ONE row with a `token_hash` (never the raw token) + `status='pending'` + a 7-day `expires_at`. |
| E2 | Open the invite `link` in a fresh browser session (signed OUT) → sign UP as a brand-new user. | The mig-105 trigger makes the new user's personal org; the accept additively joins the inviting org (D-167-01); psycopg2: exactly ONE `org_members` row for the invitee in the inviting org; the invitation flips `status='accepted'`. |
| E3 | Open a SECOND invite `link` and accept as an EXISTING account (sign IN). | Keeps their personal org AND joins additively → 2+ orgs; the 166 switcher now renders both (no new switcher code, D-167-01). |
| E4 | Roster + adoption chips. | Before accept: the invitee shows a `pending` chip on the roster; after accept: an `active` chip; a never-invited user shows nothing (not-yet-invited). Chips use the 166 indigo vocabulary (no amber). |
| E5 | **Idempotency / race (INV-02).** Re-open an already-accepted link; and (if drivable) open the same fresh link in two tabs and accept near-simultaneously. | The re-accept is a no-op (still exactly ONE membership); the concurrent accepts converge to ONE `org_members` row (advisory lock + ON CONFLICT). `tests/integration/test_167_jit_race.py` corroborates. |
| E6 | **Expired / revoked (T-167-03/04).** Revoke a pending invite, then try its link; and (via psycopg2) set an invite `expires_at` in the past, then try it. | Both are rejected — no membership created; the accept surfaces an honest "invite is no longer valid" message. |
| E7 | **org:invite gate (T-167-06).** As a `member` (no org:invite), attempt the send endpoint (hand-crafted request). | 403 — default-deny; the member never sees the Send affordance in the UI (render courtesy) and the server refuses regardless. |

## Greenlist fail-closed (the VIS-01 acceptance bar)

| # | Scenario | Expected |
|---|---|---|
| G1 | Operator sets a governed feature's audience to `role` with `roles=['org-admin']` (Control Room greenlist toggle). | psycopg2: `app_settings.feature_visibility[feature]` = `{"audience":"role","roles":["org-admin"],...}` (JSONB merge, no other feature clobbered). |
| G2 | A user whose org role is `member` loads the app / hits the governed endpoint. | **Fail-closed:** the feature is HIDDEN in `GET /features` AND the endpoint returns 403 (hide == refuse). The member's role is NOT in the greenlist. |
| G3 | A user whose org role is `org-admin` loads the same. | The feature is VISIBLE and the endpoint is allowed (greenlisted role). |
| G4 | Operator + `everyone`-audience carve-out. | An operator passes every governed feature (no-op); an `everyone`-audience feature stays visible to all — byte-identical to pre-167 (require_visible not forked). |
| G5 | Malformed / unknown audience record (psycopg2-injected). | Safe-deny (fail-closed) — the resolver falls back to `_GOVERNED_FEATURES`, never raises into the request. |

## VIS-02 lock lived-experience

| # | Scenario | Expected |
|---|---|---|
| V1 | User picks a default model in Settings (unlocked). | The registry-only picker offers ONLY allowed models; save-on-select persists + re-reads; the 🔒 footer shows the effective model. |
| V2 | Operator turns the lock ON. | The user's picker select is DISABLED, the 🔒 footer names the governed default ("Set by your administrator"); the user's prior override is inert server-side (the org default flows). |
| V3 | User tries to pick a model outside the allowed set (hand-crafted PUT /me/preferences). | 400 — the server re-validates ∈ the allowed set; the client never offered it. |

---

## Lived-experience UAT (G-4 — "I'd recognize failure here")

| # | Scenario | Failure I'd recognize |
|---|---|---|
| L1 | Org-admin opens the now-LIVE Invitations & Roles tab | FAIL if it still renders the LockedTab "coming soon" placeholder; FAIL if any copy names a roadmap phase number |
| L2 | Invite modal role picker | FAIL if Dept-admin is a selectable (active) option — it MUST be greyed/disabled until Phase 169 (D-167-03); FAIL if super-admin is offered |
| L3 | Send an invite with `EMAIL_PROVIDER=none` | FAIL if the flow demands an email service / API key; MUST surface a copy-able link (link-first, offline-safe, D-167-02) |
| L4 | Inspect any invitation API response + the DB | FAIL if the raw token appears anywhere except the link; FAIL if `token_hash` is ever returned by an endpoint |
| L5 | Accept as an existing account | FAIL if the invitee's personal org is absorbed/hidden; MUST keep both + show the switcher (D-167-01) |
| L6 | Member opens the org shell | FAIL if the Send-invite affordance renders for a non-org:invite member (render courtesy absent; server 403 is the wall) |
| L7 | No-preference chat (VIS-02 unset) | FAIL if the effective model differs from pre-167 for a user with no preference (Deep byte-identical red line, D-14) |
| L8 | Greenlist a feature to org-admin, then view as member | FAIL if the member can still open/see the feature (fail-closed hide==refuse); FAIL if the UI shows it but the API 403s (they must agree) |

## Evidence to capture

- psycopg2 (`:54322`): `org_invitations` (token_hash present, raw token absent; status transitions pending→accepted/revoked; 7-day expiry); `org_members` (exactly one row per accept; join-additive for a 2-org user); `app_settings.feature_visibility` (role record shape, no clobber); `user_settings.preferences` (default_model written per-user).
- Backend uvicorn logs: the none-log invite link line; a spoofed/absent-permission send → 403; the cross-provider routing (the per-user default's provider) per Axis 1.
- LangSmith / provider logs: Axis 1 rows 1–4 show the per-user default routing to the correct provider; row 4b shows byte-identical routing when unset.
- `tests/integration/test_167_jit_race.py` output (single-membership convergence).

## Pass condition

All 4 SC#10 axes green — **Axis 1 rows 1–4 (VIS-02 cross-provider routing) + row 4b (Deep byte-identical when unset, D-14) are the hard bar** — PLUS the invite→accept→join E2E (E1–E7, with E5 idempotency/race + E6 expired/revoked + E7 org:invite gate green) PLUS the greenlist fail-closed rows (G1–G5, with G2 the fail-closed acceptance bar) PLUS V1–V3 and L1–L8. Re-run the two-org exit gate `test_v3_4_org_isolation.py` after 167 lands (per ROADMAP — the milestone exit gate re-runs after 166/167/168).
