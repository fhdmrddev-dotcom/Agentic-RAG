---
status: partial
phase: 166-org-admin-shell-org-switcher-profile-menu-anchor
source: [166-VERIFICATION.md, 166-VALIDATION.md]
started: 2026-07-21
updated: 2026-07-21
---

## Current Test

[awaiting operator live UAT — needs a running uvicorn + browser + live provider keys]

## Why this is human-needed

Phase 166 is **code-verified (5/5 must_haves), SECURED (19/19 threats closed, 0 open), and
regression-clean** (org-isolation exit-gate 23/23; frontend `tsc` exit 0; backend org-gate 7/7).
The only thing left is the **lived experience** — the SC#10 4-axis cross-provider scoreboard and the
G-4 lived-experience sweep — which by GSD convention (and the G-4 guardrail) must be driven live in a
browser against real streams, not asserted by unit tests. Wire format + screenshots are insufficient.

**Setup (from 166-VALIDATION.md):** to exercise the switcher you must seed a **second org membership**
for the test user (single-org users see only the quiet name button, by design — D-166-02). WR-01 (the
`/org/me` bootstrap deadlock at 2+ orgs) has been **fixed**, so the switcher will now populate for a
fresh multi-org session.

## Tests

### 1. SC#10 Axis 3 row #6 — org-switch-mid-stream (D-166-08 HARD acceptance bar)
- **Do:** Start a chat stream in Thread A. While it streams, open the ProfileMenu and switch org.
- **Pass:** The 067.5 mid-stream predicate refuses to wipe A's active bucket; the refetch reconciles the
  sidebar to the new org; **no cross-org data leak; no console error; no orphaned subscription** (WR-02
  fix — the torn-down subscriptions are finalized, so the watchdog does not 404-probe the old org's thread).
- **Status:** pending

### 2. SC#10 Axis 1 rows #1–4 — cross-provider (OpenAI / Anthropic / Google / OpenRouter)
- **Do:** Run a chat stream on each provider; render the ProfileMenu/switcher during the stream.
- **Pass:** Each stream completes normally, unaffected by the org chrome (the `X-Org-Id` injection is
  provider-agnostic by construction).
- **Status:** pending

### 3. SC#10 Axis 2 row #5 — multi-tool run + shell navigation mid-stream
- **Do:** Start a multi-tool run (e.g. `search_documents` + `execute_code`); mid-run open the org-admin
  shell (Members / Audit).
- **Pass:** The run is not torn down; the org fetches carry `X-Org-Id`; the run completes intact on return.
- **Status:** pending

### 4. SC#10 Axis 3 rows #7–8 — parallel-thread cross-org isolation + member-only-org 403
- **Do:** Thread B streams under org 2 while org 1 is idle; then switch to an org where the user is a
  plain member (no `org:manage`).
- **Pass:** No org-1 event bleed into B; the indigo shield is **absent** (not disabled) for the member;
  any forced shell/route access **403s server-side**.
- **Status:** pending

### 5. SC#10 Axis 4 row #9 — long-message (≥50 messages / ≥5KB prompt) mid-stream org switch
- **Do:** In a heavy thread, switch org mid-stream.
- **Pass:** Teardown + refetch handle the heavy thread without dropping the guard; the audit list
  paginates without loading full history.
- **Status:** pending

### 6. G-4 lived-experience L1–L6 (both themes, rail collapsed + expanded)
- **Do:** Drive live: (L1) solo user = a quiet name button, zero switcher chrome; (L2) `⌥ Technical-names`
  is a shared toggle revealing table/source names; (L3) org audit shows the RLS-honest "you see only your
  own activity" banner when the caller lacks `org:audit_view`; (L4) Members tab has NO invite/edit
  affordances (absent, not disabled-that-lies); (L5) locked-tab copy = "coming soon" + a plain sentence,
  **no roadmap/phase numbers**; (L6) the ProfileMenu anchor + indigo shield work icon-only at the 58px
  collapsed rail.
- **Pass:** Each L-row's failure condition (per 166-VALIDATION.md) does NOT occur.
- **Status:** pending

---

*When all 6 pass: flip `166-VERIFICATION.md` frontmatter `status: human_needed` → `passed` and this file's
`status: partial` → `passed`.*
