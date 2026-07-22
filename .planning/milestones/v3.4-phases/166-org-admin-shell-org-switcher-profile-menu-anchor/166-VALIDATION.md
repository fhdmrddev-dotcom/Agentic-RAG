# Phase 166 — VALIDATION (SC#10 4-axis + lived-experience UAT)

**Status:** authored at plan-time (2026-07-21) — rows are executed at `/gsd:verify-work 166`.
**Why SC#10 applies:** this phase touches UI state + the streaming teardown (`StreamsProvider` org-switch, D-166-08). Per ROADMAP SC#10 + CLAUDE.md "UAT scoreboard recipe", any phase touching streaming / agent loop / provider routing / UI state MUST exercise cross-provider × multi-tool × parallel-thread × long-message. **The org-switch teardown MUST be exercised while a stream is in-flight** (the single most load-bearing intersection).

**Drive:** Chrome MCP (or operator-clicks + psycopg2 evidence per the reported chrome-wedge fallback). Test login: `fhdmrd@gmail.com` / `123456` at `http://localhost:5173/`. Every user is org-admin of their personal org (mig 105) — so the indigo shield + shell are reachable today for the personal org; the 2+-org switcher rows require seeding a second membership (see Setup).

> **Rows live HERE, not in PLAN.md tasks.** Phase verification passes only when all 4 axes are exercised; the org-switch-mid-stream row is the acceptance bar for D-166-08.

## Setup for the 2+-org axis (switcher visibility, D-166-02)

The switcher renders only at 2+ orgs. Seed a second membership for the test user via psycopg2 against local Supabase (`:54322`): insert an `organizations` row + an `org_members` row (`role='member'` for one, keep `org-admin` on the personal org) so the test user belongs to 2 orgs — one they manage, one they don't. This also exercises the honest-degrade (a member-only org: no indigo shield for that org, `Member` badge).

---

## Axis 1 — Cross-provider (OpenAI · Anthropic · Google · OpenRouter)

The org context is provider-agnostic (the `X-Org-Id` header rides `getAuthHeaders` for every authed call), so the cross-provider proof is that a chat stream on each provider is unaffected by the org surface, and that an org switch mid-stream reconciles identically regardless of provider.

| # | Provider (representative model) | Scenario | Expected |
|---|---|---|---|
| 1 | OpenAI (gpt class) | Start a chat stream; open ProfileMenu; confirm role badge + (if 2+ orgs) switcher render without interrupting the stream | Stream completes; org chrome is additive, no stall |
| 2 | Anthropic (claude class) | Same as #1 | Stream completes; identical org chrome |
| 3 | Google (gemini class) | Same as #1 | Stream completes; identical org chrome |
| 4 | OpenRouter (any) | Same as #1 (experimental axis — note-only if OpenRouter is flaky) | Stream completes OR documented external failure (not our code) |

## Axis 2 — Multi-tool (2+ tools in one prompt)

| # | Scenario | Expected |
|---|---|---|
| 5 | One prompt exercising `search_documents` + `execute_code`; while the tool run streams, open the org-admin shell (indigo shield) → Members tab → Audit tab, then return to chat | The shell fetches (`/org/members`, `/org/audit`) carry `X-Org-Id`; the in-flight multi-tool run is NOT torn down (navigating to the shell ≠ an org switch); returning to chat shows the completed run intact |

## Axis 3 — Parallel-thread (Thread A streaming while Thread B accepts a prompt) — **the D-166-08 teardown row**

| # | Scenario | Expected |
|---|---|---|
| 6 | Thread A is mid-stream (a long generation in flight). In the ProfileMenu, **switch to a different org** while A is still streaming. | `switchOrg` runs the teardown THROUGH the 067.5 guarded `clearThreadBucket`: the mid-stream predicate `!sendingThreadsRef.current.has(tid)` refuses to wipe A's active bucket, but the refetch-on-reconnect reconciles to the new org (Realtime is not the boundary). No cross-org data from the previous org appears after the switch. No console error, no orphaned subscription. |
| 7 | Thread A streaming (org 1); switch to org 2; immediately start Thread B with a new prompt in org 2. | B streams cleanly under org 2 (`X-Org-Id` = org 2); A's leftover events do not bleed into B; the thread list reflects org 2 after reconcile. |
| 8 | Switch to a **member-only** org (no `org:manage`). | The indigo shield is ABSENT for that org (not disabled); the role badge reads `Member`; attempting to hit the shell surface is 403 server-side (fail-closed) — never a silent empty shell. |

## Axis 4 — Long-message (≥ 50 prior messages OR ≥ 5 KB prompt)

| # | Scenario | Expected |
|---|---|---|
| 9 | In a thread with ≥ 50 prior messages (or a ≥ 5 KB user prompt) mid-stream, open the org-admin shell and the Audit tab, then switch org. | The teardown + refetch handle the heavy thread without dropping the guard; the long thread reconciles to the correct org; the audit list paginates (no CSV) without loading the whole history. |

---

## Lived-experience UAT (G-4 — "I'd recognize failure here")

Operator-recognizable failure scenarios, driven live (wire format + screenshot are insufficient per G-4):

| # | Scenario | Failure I'd recognize |
|---|---|---|
| L1 | Solo user (1 org, today's 100% case) opens the ProfileMenu | FAIL if any switcher chrome appears (must be a quiet name button, D-166-02); FAIL if the indigo shield is missing (every user is org-admin of their personal org → shield present) |
| L2 | Org-admin opens the shell; toggles `⌥ Technical-names` in the band | FAIL if the toggle doesn't flip both the band AND the audit raw-code reveal (one shared value, 146 LANG-01); FAIL if any amber appears (org zone is indigo — amber is operator-only) |
| L3 | Org-admin WITHOUT `org:audit_view` (or a single-member org) opens the Audit tab | FAIL if a silent empty list renders; MUST show the "you see only your own activity (RLS)" banner + own rows (D-166-04) |
| L4 | Member opens the Members tab | FAIL if any invite/disable/edit button renders (must be ABSENT, not disabled); the banner points at the locked Invitations tab with NO phase number |
| L5 | Click each of the 4 locked tabs (Invitations & Roles · SSO · Subscription · Retention) | FAIL if any "coming soon" copy names a roadmap phase number (T-146-10); each reads honest, not broken |
| L6 | Collapse the rail to 58px | FAIL if the ProfileMenu anchor or the indigo shield stops working icon-only (RailItem dual-render) |

## Evidence to capture

- psycopg2 (`:54322`): confirm the org-switch audit rows are scoped to the active `org_id` (no cross-org rows returned to the wrong caller); confirm `org_members` reflects the seeded 2-org membership.
- Backend uvicorn logs: a spoofed `X-Org-Id` (hand-crafted request to an org the user doesn't belong to) → 403 (D-166-06).
- Screenshots: solo vs 2+-org ProfileMenu; the indigo shield present (org-admin) vs absent (member); the audit RLS-honest banner; both themes.

## Pass condition

All 4 axes exercised (rows 1–9) with the **org-switch-mid-stream** row (#6) green, PLUS L1–L6 lived-experience green. Row #6 is the hard acceptance bar for D-166-08 — a stale in-flight subscription must not leak the previous org's data after a switch.
