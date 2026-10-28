---
phase: 299-links-to-the-thing-itself
artifact: VALIDATION
seeded_by: planner (2026-10-28, with 299-01..05-PLAN.md, from 299-RESEARCH.md §Validation Architecture)
status: owed
rows_total: 17
rows_run: 0
rows_blocked: 1
---

# Phase 299 — Links to the Thing Itself: VALIDATION (owed UAT)

⛔ **EVERY ROW BELOW IS OWED AND UNCHECKED.** Seeded at planning. A Verdict cell is filled only by the
session that drives the row, with that row's own evidence (screenshot + DOM read + network/DB read). Rows
run at `/gsd:verify-work 299`, after all five plans have merged.

**Who drives:** Claude, in Chrome MCP, on the local stack (D-31). **Account:** the dev account, which is in
two orgs — prove which org is ACTIVE before every row (memory `reference_dev_account_is_in_two_orgs`):
read the switcher label and the `X-Org-Id` on the first list request.

**G-2:** satisfied by the operator-picked sketches 299-1 B, 299-2 A, 299-3 C, 299-4 A (D-30) and the
approved `299-UI-SPEC.md`. Any row the operator would reject against those is a FAIL, whatever the tests say.

`.planning/config.json` has `workflow.nyquist_validation: false`; the automated map below is recorded
because the orchestrator asked for it, and it names exactly the suites the plans create.

## Automated test map (run by the plans — not a substitute for the rows below)

| Req | Behaviour | Command | Plan |
|---|---|---|---|
| LINK-02 | entity routes parse/format, lowercased; `/app` and `/app/chat` exactly `{view:"chat"}` | `cd frontend && npx vitest run src/lib/__tests__/appRoutes.test.ts` | 02 |
| LINK-02 | dev / Vercel / nginx parity for the three new shapes | `npx vitest run src/__tests__/routing/appRouteParity.test.ts` | 02 |
| LINK-02 | thread URL ⇄ selection; one history entry per action; streams survive | `npx vitest run src/hooks/__tests__/useThreadAddress.test.tsx src/__tests__/routing/navigationKeepsStreams.test.tsx` | 02 |
| LINK-02 | draft → Builder, published → focused card, Expert → detail; no writes | `npx vitest run src/components/workflows/library/__tests__/useWorkflowLinkTarget.test.tsx src/components/experts/catalog/__tests__/ExpertCatalogPage.link.test.tsx` | 02 |
| LINK-03 | link surface: copy = origin + path, refusal honest, audience per kind | `npx vitest run src/components/share/__tests__/ShareLinkMenu.test.tsx src/lib/__tests__/linkAudience.lockstep.test.ts src/components/share/__tests__/shareMounts.test.tsx` | 04 |
| LINK-03 | legacy `?run=`, `?connections=1`, `/admin/spend`, `/setup`, `/invite` cold loads unchanged | `npx vitest run src/lib/__tests__/appRoutes.test.ts src/components/layout/__tests__/ChatLayout.runDeepLink.test.tsx src/pages/__tests__/SetupWizard.test.tsx` | 02 |
| LINK-04 | resolver: same SQL for missing / forbidden; identical 404; no 403/422; 401 without bearer | `cd backend && venv/Scripts/python -m pytest tests/unit/test_299_links_route.py tests/unit/test_299_link_resolver.py tests/integration/test_299_links_live.py -q -rs` | 01 |
| LINK-04 | in-place card identical for missing / forbidden; rebuilt address only | `npx vitest run src/components/layout/__tests__/CantBeOpened.test.tsx src/components/layout/__tests__/LinkGate.test.tsx src/components/layout/__tests__/AppViewSwitch.addressStates.test.tsx` | 03 |
| LINK-05 | prompt / Stay / Switch; snapshot before switchOrg | `npx vitest run src/components/layout/__tests__/SwitchOrgPrompt.test.tsx src/components/layout/__tests__/LinkGate.test.tsx` | 03 |
| LINK-05 | write-org guards; ask + schedule stamped; run read org_id | `venv/Scripts/python -m pytest tests/unit/test_299_write_org_guards.py tests/unit/test_276_openapi_snapshot_fresh.py -q` | 01 |
| LINK-05 | "Saves in {Org}" only on create buttons at 2+ orgs; refusals verbatim | `npx vitest run src/components/share/__tests__/savesInOrg.test.tsx` | 04 |
| LINK-06 | returnTarget / kindWord / remember-take; SSO + sign-up redirect; getSession catch | `npx vitest run src/lib/__tests__/returnTo.test.ts src/hooks/__tests__/useAuth.test.ts src/pages/__tests__/AuthPage.returnLine.test.tsx src/components/auth/SignInForm.test.tsx` | 05 |
| LINK-06 | boot stages at 8 s / 20 s; Try again reloads | `npx vitest run src/components/layout/__tests__/BootScreen.test.tsx` | 05 |
| FIX-02 | pending flag; desktop first load + mobile say "Loading your chats…" | `npx vitest run src/__tests__/hooks/useThreads.orgSwitch.test.ts src/components/layout/__tests__/ChatLayout.mobileLoading.test.tsx src/components/layout/__tests__/ChatHistoryColumn.orgSwitch.test.tsx` | 05 |

Full gates once per wave: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (no per-file
decrease, 0 failing), `node scripts/check-backend-unit-baseline.cjs` (≤ 71 failed, zero headroom),
`node scripts/check-hot-file-ledger.cjs .planning/phases/299-links-to-the-thing-itself`,
`node scripts/build-public-openapi.cjs --check`, `node scripts/check-claude-md-size.cjs`, and
`npx tsc -p tsconfig.app.json --noEmit` as a set diff against base.

## G-4 lived-experience rows (D-31 — set at scope time)

| # | Scenario | Steps | Pass when | Fail when | Verdict | Evidence |
|---|---|---|---|---|---|---|
| G4-1 | Copy link → fresh tab | Chat header **Link** → **Copy link**; paste into a fresh tab; refresh | "✓ Link copied" inside the surface; line reads "Opens only for you, on any device you're signed in on."; the fresh tab opens the same thread; refresh stays on it | a toast; the line says "members"; the copied text carries `?`/`#`/a token; the fresh tab lands on chat home or the welcome composer | ✅ PASS (Claude, Chrome MCP, 2026-10-29, `fhdmrd@gmail.com`, org `22f9c615`) | Thread `54f8ac14`: **Link** → **Copy link** showed "✓ Link copied" inside the surface, no toast; line read "Opens only for you, on any device you're signed in on."; address shown `localhost:5173/app/chat/54f8ac14-…` (no `?`/`#`/token); a fresh tab opened the same thread, F5 stayed on it. ⚠ Clipboard text not read back (`clipboard.readText` hung the tab); RunModal caption ✅ (2026-10-29, `.dev` account, "Compliance Gap Report" Run modal: "Saves in fhdmrd.dev@gmail.com's Organization" under the Run row, footer style; closed without running); 340 px mobile sub-check NOT driven — the window is maximized and `resize_window` left innerWidth at 1536 |
| G4-2 | Other-org run link with a live chat | Start a long answer in org A; open a run link from org B; press **Stay**; then **Open it after all** → **Switch**; then **Switch back** and reopen the chat | Prompt shows the run title, org B's avatar + name, "Switch to {B}" as the only filled button and the "is still answering · Back to it" chip; Stay: org still A, the answer keeps streaming (subscription count unchanged, no AbortError), Stay notice shown; Switch: run opens with "Your chat in {A} is still answering. · Switch back"; Switch back: the answer is present or still streaming (assumption A1 — record which) | the org switches without a click; Stay aborts the stream or changes the org; the run opens in A; Switch back loses the answer | ✅ PASS — **A1: still streaming** (Claude, Chrome MCP, 2026-10-29, `fhdmrd.dev@gmail.com`; org A `c1f18150`, org B `22f9c615`; `GET /org/me` lists both) | Thread `20e57dc4` streaming in A (deepseek-v4-flash); opened `/app/runs/e98457c0…` (B, finished, "293 board: deepseek") by in-app navigation. Prompt: B avatar "F" + "This is in fhdmrd@gmail.com's Organization", run chip, "Switch to …" the only filled button, chip "“Sixty Facts on Map History” is still answering · Back to it"; org unchanged. **Stay**: org still A, notice "You stayed in … The link wasn't opened. · Open it after all", lands on `/app` (D-17: last non-entity place), answer kept streaming 4.7k→18.3k chars and finished; no reload, no AbortError. Second answer: link → Stay → **Open it after all** → **Switch**: run opened in B with "Your chat in fhdmrd.dev@gmail.com's Organization is still answering. · Switch back". **Switch back**: org A, `/app/chat/20e57dc4…`, "1 running", text grew 18.0k→62.5k and finished; all 121 lines of the saved 45,040-char answer present on screen, 180 list items. ⚠ Only console warning: react-router's blocker on a POP it did not create — an artefact of driving by `history.pushState` |
| G4-3 | Missing ≡ forbidden | Open `/app/runs/<made-up uuid>` and `/app/runs/<another user's real run id>`; open `/app/chat/<UPPER-UUID>`; open `/app/nonsense` | The same card, same words ("This workflow run can't be opened"), same layout and focus over the Workflows library, for both runs; DevTools shows the same 404 body and headers for both `GET /links/run/...`; the upper-case link shows the lower-case address; `/app/nonsense` shows "This address doesn't open anything" with no address line and no Copy address | any difference between the two runs (words, status, body, headers, layout); a title / org / reason anywhere; the requested path echoed; a silent fallback to chat | ✅ PASS (Claude, Chrome MCP, 2026-10-29) | `GET /links/run/<other user's real run 27aed61b>` and `/links/run/<made-up uuid>`: both 404, body `{"detail":"Not found"}`, same JS-visible headers (content-type, content-length 22). The two cards: same text ("This workflow run can't be opened" / "If someone sent you this link, ask them to check it." / address / Go to Workflows / Copy address), same box 420×219 at (587,210), focus on the heading, over the Workflows library. `/app/chat/54F8AC14-…` → address bar `/app/chat/54f8ac14-…`, thread opened. `/app/nonsense` → "This address doesn't open anything" / "It may be mistyped or out of date." / Go to Chat; no address line, no Copy address, path not echoed. ⚠ Only CORS-exposed headers comparable from page JS |
| G4-4a | Signed-out return — password | Signed out, open `/app/runs/<id>`; sign in by password | "After you sign in, you'll go to a workflow run." under the form; after sign-in the run (or S2 then the run) shows | no line; a title in the line; landing on chat home | ☐ | |
| G4-4b | Signed-out return — sign-up | Signed out at `/app/runs/<id>`, switch to sign-up, create an account, follow the email link | "After you sign up, you'll go to a workflow run."; the email link returns to the run (or chat home then the sessionStorage resume replaces it with the run) | landing on chat home with no resume; a token left in the address bar after load | ☐ | |
| G4-4c | Signed-out return — SSO | — | — | — | ⛔ | **BLOCKED (D-41):** cloud reads `auth.sso_providers` 0 · `saml_providers` 0 · `sso_domains` 0 (Supabase MCP, read-only, 2026-10-28). No SSO provider is configured, so a live round trip cannot run. SSO return is covered by `useAuth.test.ts` (`redirectTo` = origin + rebuilt path; sessionStorage resume). Re-open trigger: an SSO provider is configured on cloud |
| G4-4d | Off-site return target | Plant `//evil.example/app` (and an absolute `https://evil.example/app/runs/<id>`) as the stored return target via DevTools, then sign in | No quiet line for an off-site address; after sign-in the app lands on chat; nothing navigates off-origin | any navigation off-origin; the planted value echoed anywhere | ☐ | |
| G4-5a | Slow list | DevTools Slow 3G; load `/app` at desktop width and at mobile width (drawer list) | "Loading your chats…" until the list answers, then the list; "No recent chats" never appears for an account that has chats | "No recent chats" flashes at either width | ☐ | |
| G4-5b | Auth unreachable | Block `*/auth/v1/*`; load `/app/runs/<id>` | Iris only to 8 s; "Still connecting…" from 8 s; "Can't reach Syrel" + "Check your connection and try again. Your link is kept, so you'll still land on it." + **Try again** at 20 s; Try again keeps the URL | an endless spinner; the sign-in form shown to a signed-in person; Try again drops the address | ☐ | |

## Four-axis rows (CLAUDE.md UAT scoreboard — streaming / UI state)

**Cross-provider roster — DERIVE, never re-type.** At run time group `MODEL_CAPABILITIES`
(`backend/app/config.py`, plus the Model Registry rows) by `provider` and take the NEWEST registry-backed id
per provider for the eight required providers. Drive each row with a per-request `model` + `provider` on
`POST /threads/{id}/messages` (no global setting mutated), read verdicts from `runs` / the transcript.
A provider with no key or a known blocker is recorded ⛔ with the reason and issue id — never omitted.

| # | Provider | Row | Verdict | Evidence |
|---|---|---|---|---|
| X-1 | OpenAI | An answer keeps streaming while: thread address A → B → Back → Forward, then an other-org run link is opened and **Stay** pressed; the run completes with no gap in the transcript | ✅ PASS | `gpt-5.6-luna`, thread `0b7fe18d`: 5,457 chars, 30/30 lines on screen. Claude, 2026-10-29, `fhdmrd.dev@gmail.com` org A `c1f18150`; roster = 297's derivation (registry `model_capabilities_overrides` max(updated_at) 2026-10-24, unchanged since). Run kicked off by per-request `model`+`provider` on POST /threads/{id}/messages (no global setting); UI attached by address, then A → B (`5d0b1eb6`) → Back → Forward → `/app/runs/e98457c0` (org B) → **Stay** (org stays `c1f18150`, Stay notice shown, lands `/app`); "1 running" at every step. Verify: saved last message vs screen, every line's first+last 70 chars present |
| X-2 | Anthropic | same | ✅ PASS | `claude-opus-5-5`, thread `4f5660b0`: 6,689 chars, 30/30 lines. Claude, 2026-10-29, `fhdmrd.dev@gmail.com` org A `c1f18150`; roster = 297's derivation (registry `model_capabilities_overrides` max(updated_at) 2026-10-24, unchanged since). Run kicked off by per-request `model`+`provider` on POST /threads/{id}/messages (no global setting); UI attached by address, then A → B (`5d0b1eb6`) → Back → Forward → `/app/runs/e98457c0` (org B) → **Stay** (org stays `c1f18150`, Stay notice shown, lands `/app`); "1 running" at every step. Verify: saved last message vs screen, every line's first+last 70 chars present |
| X-3 | Google | same | ✅ PASS | `gemini-3.8-flash`, thread `6097da77`: 9,311 chars, 30/30 lines. Claude, 2026-10-29, `fhdmrd.dev@gmail.com` org A `c1f18150`; roster = 297's derivation (registry `model_capabilities_overrides` max(updated_at) 2026-10-24, unchanged since). Run kicked off by per-request `model`+`provider` on POST /threads/{id}/messages (no global setting); UI attached by address, then A → B (`5d0b1eb6`) → Back → Forward → `/app/runs/e98457c0` (org B) → **Stay** (org stays `c1f18150`, Stay notice shown, lands `/app`); "1 running" at every step. Verify: saved last message vs screen, every line's first+last 70 chars present |
| X-4 | DeepSeek | same | ✅ PASS | `deepseek-v4-pro`, thread `14197b5a`: 8,147 chars, 31/31 lines. Claude, 2026-10-29, `fhdmrd.dev@gmail.com` org A `c1f18150`; roster = 297's derivation (registry `model_capabilities_overrides` max(updated_at) 2026-10-24, unchanged since). Run kicked off by per-request `model`+`provider` on POST /threads/{id}/messages (no global setting); UI attached by address, then A → B (`5d0b1eb6`) → Back → Forward → `/app/runs/e98457c0` (org B) → **Stay** (org stays `c1f18150`, Stay notice shown, lands `/app`); "1 running" at every step. Verify: saved last message vs screen, every line's first+last 70 chars present |
| X-5 | Zhipu / GLM | same | ✅ PASS | `glm-5.3-flash`, thread `27894d3b`: 7,360 chars, 30/30 lines. Claude, 2026-10-29, `fhdmrd.dev@gmail.com` org A `c1f18150`; roster = 297's derivation (registry `model_capabilities_overrides` max(updated_at) 2026-10-24, unchanged since). Run kicked off by per-request `model`+`provider` on POST /threads/{id}/messages (no global setting); UI attached by address, then A → B (`5d0b1eb6`) → Back → Forward → `/app/runs/e98457c0` (org B) → **Stay** (org stays `c1f18150`, Stay notice shown, lands `/app`); "1 running" at every step. Verify: saved last message vs screen, every line's first+last 70 chars present |
| X-6 | MiniMax | same | ✅ PASS | `MiniMax-M3`, thread `021d16e5`: 11,189 chars, 31/31 lines. Claude, 2026-10-29, `fhdmrd.dev@gmail.com` org A `c1f18150`; roster = 297's derivation (registry `model_capabilities_overrides` max(updated_at) 2026-10-24, unchanged since). Run kicked off by per-request `model`+`provider` on POST /threads/{id}/messages (no global setting); UI attached by address, then A → B (`5d0b1eb6`) → Back → Forward → `/app/runs/e98457c0` (org B) → **Stay** (org stays `c1f18150`, Stay notice shown, lands `/app`); "1 running" at every step. Verify: saved last message vs screen, every line's first+last 70 chars present |
| X-7 | Moonshot / Kimi | same (emit_tier coerce — the weakest emission guarantee) | ⛔ BLOCKED — BUG-261024-01 | `kimi-k3.1-pro-highspeed`, thread `8015d78f`, 2026-10-29: the provider refused at once — saved answer "*Rate limited by the provider — please retry in a moment.*" + Retry turn; no stream ever started, so the navigation path ran over a finished turn and proves nothing for this provider. Same block as 297 P7 (account suspended for insufficient balance). Re-open: Moonshot balance topped up |
| X-8 | OpenRouter | same (non-native tool path) | ✅ PASS | `deepseek/deepseek-v4-pro`, thread `7a8cea0e`: 10,162 chars, 31/31 lines; rail "1 running" cleared ~15 s after the message saved. Claude, 2026-10-29, `fhdmrd.dev@gmail.com` org A `c1f18150`; roster = 297's derivation (registry `model_capabilities_overrides` max(updated_at) 2026-10-24, unchanged since). Run kicked off by per-request `model`+`provider` on POST /threads/{id}/messages (no global setting); UI attached by address, then A → B (`5d0b1eb6`) → Back → Forward → `/app/runs/e98457c0` (org B) → **Stay** (org stays `c1f18150`, Stay notice shown, lands `/app`); "1 running" at every step. Verify: saved last message vs screen, every line's first+last 70 chars present |

| # | Axis | Row | Verdict | Evidence |
|---|---|---|---|---|
| A-1 | Multi-tool | `search_documents` + `execute_code` in one prompt; open its `/app/chat/<id>` address in a fresh tab mid-run; the run reattaches and completes | ✅ PASS (Claude, 2026-10-29) | New thread `4e0638df` (deepseek-v4-flash): prompt sent in tab 1; its `/app/chat/4e0638df…` address opened in tab 2 while step 1 "Searching documents" was RUNNING; tab 2 showed the live run card, followed it to "Run · 2 steps ✓ done" (39.4 s). Messages carry `search_documents` + `execute_code` |
| A-2 | Parallel-thread | Thread A streams while thread B is opened by pasting its address; A is not aborted (subscription still present, answer completes) | ✅ PASS (Claude, 2026-10-29) | Thread A `20e57dc4` streaming; thread B `5d0b1eb6` opened by address (in-app navigation): B's title shown, rail still "1 running"; after ~40 s Back to A: answer complete, all 41 saved lines on screen, no reload |
| A-3 | Long-message | A thread with ≥ 50 messages (or a ≥ 5 KB prompt) opened by address in a fresh tab and refreshed — reopens on the same thread at its tail | ✅ PASS (Claude, 2026-10-29) | Thread `261d5f57` (82 messages) opened by address in a fresh tab, then F5: same thread, last assistant message rendered, scroller gap-to-bottom 0 px |

## Operator steps owed before deploy (D-25)

- Supabase Auth → URL Configuration → Redirect URLs: confirm `https://app.<domain>/**`, `https://<domain>/**`
  and the one-box origin are listed (docs/OPERATOR.md, docs/DEPLOYMENT-WORKFLOW.md §5 — written by 299-05).
  This is a cloud setting change: operator-approved, never applied by an agent without a per-action yes.
- No migration ships in this phase. After deploy run `get_advisors(security)` (read) — expect no new finding.

## Register updates owed at phase close (not before verification passes)

- SEED-178, SEED-015 → `shipped` (D-01/D-02); SEED-312 → `shipped` (D-26); BUG-261027-02 → `closed` only if
  G4-5a passes.
- Record the run-kind rail-highlight deviation (299-03 SUMMARY) and the A1 reattach result (G4-2) here.
