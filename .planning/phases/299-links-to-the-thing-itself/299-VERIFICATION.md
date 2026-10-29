---
phase: 299-links-to-the-thing-itself
verified: 2026-10-29T00:00:00Z
verification_mode: self-verified   # OV-SOLO-01: no independent reviewer
status: passed
status_history: "human_needed (2026-10-29) → passed at close 2026-10-29: human UAT 18/20 PASS (299-HUMAN-UAT.md); G4-4b email-link leg + X-7 Moonshot owed by decision; G4-4c ⛔ SSO"
score: 5/5 roadmap success criteria verified in code and tests; 6/6 requirements satisfied in code; lived-experience and 4-axis rows owed
overrides_applied: 0
re_verification: false
gaps: []
human_verification:
  - test: "G4-2 (RUN FIRST) - Other-org run link with a live chat: Stay, Switch, Switch back"
    expected: "Stay keeps the org and the stream (no AbortError, subscription count unchanged). Switch opens the run with 'Your chat in {A} is still answering. - Switch back'. Switch back shows the answer present or still streaming. Record which (assumption A1)."
    why_human: "Needs a live stream across an org switch in a browser. Unit tests cannot prove a stream survives."
  - test: "G4-1 - Copy link, then open in a fresh tab and refresh"
    expected: "'Link copied' appears inside the surface (no toast). Line reads 'Opens only for you, on any device you're signed in on.' Copied text has no ? # or token. Fresh tab opens the same thread and a refresh stays on it. Also look at the RunModal caption placement and the 340 px surface at mobile width (299-04 deviation 7)."
    why_human: "Visual and real-clipboard behaviour."
  - test: "G4-3 - Missing is the same as forbidden"
    expected: "A made-up run uuid and another user's real run id give the identical card, 404 body and headers. An upper-case uuid link shows the lower-case address. /app/nonsense shows the 'doesn't open anything' card."
    why_human: "Layout, focus and DevTools network comparison in a browser."
  - test: "G4-4a - Signed-out return by password"
    expected: "'After you sign in, you'll go to a workflow run.' under the form, then landing on the run."
    why_human: "Real auth round trip."
  - test: "G4-4b - Signed-out return by sign-up (email link)"
    expected: "'After you sign up, you'll go to a workflow run.' The email link returns to the run. No token left in the address bar."
    why_human: "Real email and Supabase redirect."
  - test: "G4-4d - Off-site return target planted in sessionStorage"
    expected: "//evil.example/app and an absolute URL are ignored. After sign-in the app lands on chat. Nothing navigates off-origin."
    why_human: "Browser DevTools plant."
  - test: "G4-5a - Slow list at desktop and mobile width"
    expected: "'Loading your chats...' until the list answers. 'No recent chats' never flashes for an account with chats."
    why_human: "Throttled network, lived experience. BUG-261027-02 closes only if this passes."
  - test: "G4-5b - Auth unreachable"
    expected: "Iris to 8 s, 'Still connecting...' from 8 s, 'Can't reach Syrel' plus Try again at 20 s. Try again keeps the URL."
    why_human: "Blocking */auth/v1/* in DevTools."
  - test: "X-1..X-8 - Cross-provider roster (full native roster plus OpenRouter, derived from MODEL_CAPABILITIES): an answer keeps streaming through address A to B, Back, Forward, then an other-org run link plus Stay"
    expected: "Run completes with no transcript gap on each provider. A provider that is blocked is recorded as blocked with a reason, never omitted."
    why_human: "Live provider streaming."
  - test: "A-1 multi-tool, A-2 parallel-thread, A-3 long-message"
    expected: "A-1 reattaches from a fresh tab mid-run. A-2 pasting thread B's address does not abort streaming thread A. A-3 a 50+ message thread reopens at its tail after refresh."
    why_human: "Live streaming and browser state."
  - test: "Operator step before deploy (D-25)"
    expected: "Supabase Auth Redirect URLs contain https://app.<domain>/**, https://<domain>/** and the one-box origin. This is a cloud setting change, approved per action, never applied by an agent."
    why_human: "Cloud configuration."
blocked_rows:
  - row: "G4-4c - SSO return"
    reason: "D-41: cloud has 0 SSO/SAML providers, so no live round trip is possible. Covered by useAuth.test.ts (redirectTo = origin + rebuilt path; sessionStorage resume). Re-open trigger: an SSO provider is configured on cloud."
---

# Phase 299: Links to the Thing Itself - Verification Report

**Phase Goal:** A chat thread, a workflow, a workflow run and an Expert each have an address that can be copied, opened in a new tab or on another signed-in machine, and reached again after sign-in. A link the user cannot open, or one in another of their orgs, says so plainly instead of guessing.
**Verified:** 2026-10-29 at HEAD `5b05ce7a9`, phase base `593068492`
**Status:** human_needed
**Re-verification:** No, initial verification

The code evidence supports every success criterion and requirement. No gap was found. G-4 and the four-axis rows are owed, so the status is `human_needed`. No SUMMARY claim was taken as evidence; the commands below were run in this session.

## Automated evidence run here

| Check | Command | Result |
|---|---|---|
| Backend unit suites | `pytest tests/unit -k "299 or link"` | 158 passed |
| Backend live suites | `pytest tests/integration/test_299_links_live.py tests/integration/test_299_review_fixes_live.py` | 8 passed (local Postgres reachable) |
| Frontend 299 suites | `vitest run` on all 31 test files changed since base, `--maxWorkers=2` | 31 files, 977 tests, all passed |
| OpenAPI | `build-public-openapi.cjs --check` | OK (226/268 paths) |
| Docs coverage | `check-docs-coverage.cjs` | OK (`router:links` covered) |
| Hot-file ledger | `check-hot-file-ledger.cjs` on the phase dir | OK |
| G-7 | `check-gap-closure-rounds.cjs 299` | clear (no gap-closure plans) |
| TBD/FIXME/XXX in changed non-test source | grep | none |
| `StreamsProvider.tsx` | `git diff --stat 593068492 HEAD` | byte-unchanged |
| `supabase/` | `git diff --stat 593068492 HEAD` | no files changed (no migration) |
| `setViewingThread` writers | grep | `ChatArea.tsx:465` and `:576` only (one component). `useThreadAddress.ts` is documented as never calling it. |

The full gates (backend 69 failed against the ceiling of 71; vitest count gate OK 565/565, 0 failing; typecheck 61 equal to base, 0 new) were cited from the orchestrator's fix-round run. They were not re-run here.

## Success criteria

| # | Criterion | Verdict | Evidence |
|---|---|---|---|
| 1 | Thread, workflow, run and Expert open from their own address. Refresh returns to the same item. Copy-link opens it in a new tab and elsewhere. Legacy 297 links still work. | VERIFIED in code and tests (lived row G4-1 owed) | Routes: `appRoutes.ts` plus `appRoutes.test.ts` and `appRouteParity.test.ts` (dev, Vercel and nginx parity). Thread binding: `useThreadAddress.ts` with `useThreadAddress.test.tsx` and `navigationKeepsStreams.test.tsx`. Workflow and Expert open by id: `useWorkflowLinkTarget.ts`, `useExpertLinkTarget.ts` and their tests. Copy link: `ShareLinkMenu.tsx`, mounted on ChatArea, WorkflowCardMenu, WorkflowRunPage, RunEvidenceReport and ExpertDetailModal (`shareMounts.test.tsx`). The audience line is held by `linkAudience.lockstep.test.ts` (TS and Python twins on one fixture). Legacy `?run=`, `?connections=1`, `/admin/spend`, `/setup` and `/invite` are in the `appRoutes` suite. All pass. |
| 2 | Missing and forbidden give the same "can't be opened" page, identical in words and response. Never falls back to chat. | VERIFIED in code and tests (G4-3 owed) | `backend/app/api/links.py:46-93`: one `NOT_FOUND_DETAIL`, malformed id, unknown kind and forbidden all raise the same `_not_found()`. The id is typed `str` so malformed input is not a 422. 401 is checked before any I/O through a router dependency. `link_resolver.py` has one statement per kind. `test_299_links_route.py`, `test_299_link_resolver.py` and `test_299_links_live.py` pass. Frontend: `LinkGate.tsx` maps only a 404 to `cant`, and a throw keeps holding and retries at 2, 4 and 8 s. `CantBeOpened.test.tsx`, `LinkGate.test.tsx` and `AppViewSwitch.addressStates.test.tsx` pass. |
| 3 | A link in another of the user's orgs asks "This is in <org> - switch?". Decline leaves org and stream untouched. Accept switches and opens. A fork or re-run from there is saved under the item's org. | VERIFIED in code and tests (G4-2 owed, A1 unproven) | `LinkGate.tsx` returns a `prompt` state when the answer's `org_id` is another membership. `SwitchOrgPrompt.tsx` plus `SwitchOrgPrompt.test.tsx` cover Stay and Switch, with the streams store read only. Write guards use `item_org_guard.refuse_if_other_org` at `threads.py:1840` (chat), `workflow_kickoff.py:312` (run), `workflows.py:1231` (Tweak) and the schedule stamp in `schedules.py`. Ask answers carry the run's org (`runs.py:951`). `test_299_write_org_guards.py` and `test_299_review_fixes_live.py` pass. CR-01 to CR-03 are fixed, and the live review-fixes suite exercises them. |
| 4 | Signed out, the user opens a link, signs in by password, SSO or sign-up, and lands on it. The boot screen gives up with a worded state and a retry. | VERIFIED in code and tests (G4-4a, b, d, 5b owed. SSO live is blocked by D-41.) | `returnTo.ts` rebuilds every target from the route table (`returnTarget`, no host, no query or hash, `//` rejected). The stored copy is re-validated on read, has a 15-minute TTL and is consumed once. It uses sessionStorage, not localStorage. `useAuth.ts:18,92,103` pass `emailRedirectTo` and `redirectTo` through `leavingRedirect()`, and `getSession` has a `.catch`. `returnTo.test.ts`, `useAuth.test.ts` and `AuthPage.returnLine.test.tsx` pass. `BootScreen.tsx` has 8 s ("Still connecting...") and 20 s ("Try again") stages, covered by `BootScreen.test.tsx`. The bound is BootScreen's clock and not an auth timer. That is a reasoned choice, and `useAuth.test.ts` asserts a signed-in user is not bounced after 120 s. |
| 5 | The chat list shows a loading state, not "No recent chats", while threads load. | VERIFIED in code and tests (G4-5a owed) | `LOADING_CHATS = "Loading your chats..."` in `orgItemsCopy.ts:13`, driven by the `pending` flag from `useThreads.ts`. `useThreads.orgSwitch.test.ts`, `ChatLayout.mobileLoading.test.tsx` (desktop first load plus mobile) and `ChatHistoryColumn.orgSwitch.test.tsx` pass. |

## Requirements coverage

| Requirement | Plans | Status | Evidence |
|---|---|---|---|
| LINK-02 addresses and refresh | 02 | SATISFIED | Criterion 1 |
| LINK-03 copy link, legacy links kept | 02, 04 | SATISFIED | Criterion 1 |
| LINK-04 one can't-be-opened page | 01, 03 | SATISFIED | Criterion 2 |
| LINK-05 switch prompt, nothing saved in the wrong org | 01, 03, 04 | SATISFIED | Criterion 3. "Saves in {Org}" is pinned by `savesInOrg.test.tsx`. |
| LINK-06 sign-in returns to the link, boot cannot hang | 03, 05 | SATISFIED (SSO live blocked, D-41) | Criterion 4 |
| FIX-02 loading state | 05 | SATISFIED | Criterion 5 |

No orphaned requirements. All six IDs are claimed by plans.

## Security checks from "How we'd know this failed"

- Forbidden distinguishable from missing: no. One status, one body, no `X-Org-Id` read, no 403 or 422 (`links.py`). The live suite pins it.
- Org switches without asking: no. The prompt gates `switchOrg`, and the snapshot is taken before it.
- Cross-org write lands in the wrong org: guarded on chat, run kickoff, Tweak and schedule, with CR-01 fixed (membership arm in `WORKFLOW_ORG_SQL`).
- Open redirect or token in the URL: `returnTarget` rebuilds from the route table, so `//host` and absolute URLs return null. No token is written into the returned value.
- SSO fails on cloud because Redirect URLs lack the app origin: this is an operator step. It is written into `docs/OPERATOR.md` and `docs/DEPLOYMENT-WORKFLOW.md` and is not applied by an agent.
- Boot hang and "No recent chats" flash: covered by unit tests. Lived rows G4-5a and G4-5b are owed.

## Decisions surfaced for the operator (not gaps)

1. **Run-link rail highlight not shown.** UI-SPEC S1 says Workflows is highlighted behind a run card. 299-03 did not do it, because `NavPanel.tsx` is a FIRING hot file at 26/14 and no rail item claims `workflow-run`. While a refused, holding or prompting run link is on screen, nothing in the rail is current. Workflow and Expert kinds highlight correctly. Choose: accept it, or make a one-line follow-up in NavPanel.
2. **Fork refusal is recognised by sentence wording** (299-REVIEW WR-01/WR-03 and the follow-up commits). Only a 403 or 404 counts as a refused Expert link. Decide whether the wording match is acceptable or needs a stable error code.
3. **CR-01 fallback.** The fix pass chose a membership arm so a left org is not stamped, and the active org is used as the fallback. The alternative was a 404. Confirm the choice.
4. **A Builder draft created by its first save shows no Link until it is reopened.**
5. **Open Info findings IN-01 to IN-05, not touched:**
   - IN-01: the Tweak guard is advisory when `from_definition_id` is omitted.
   - IN-02: a same-org thread missing from the list (an eval thread, or past the 1000-row cap) gets the card despite a 200.
   - IN-03: the write guards fail open when the membership read errors. The schedule global-definition fallback could mis-stamp.
   - IN-04: `is_enabled: null` is read differently by the TS and Python audience twins, and the fixture has no null row.
   - IN-05: the Expert link never reopens the same Expert while the address is unchanged.

   IN-02 and IN-03 each contradict a stated rule in the code (only a 404 yields the card; fail closed), so decide whether to fast-fix them or accept them.

## Anti-patterns

None blocking. No TBD, FIXME or XXX in changed source. The `deferred-items.md` entry (`router:links` docs coverage) was closed by the orchestrator, and `check-docs-coverage.cjs` is OK here. G-7 is clear.

## Owed at phase close, after the rows pass

- Flip SEED-178, SEED-015 and SEED-312 to `shipped`. Close BUG-261027-02 only if G4-5a passes.
- Record the run-kind rail-highlight deviation and the A1 reattach result (from G4-2) in VALIDATION.md.
- Run `get_advisors(security)` after deploy. Expect no new finding. There is no migration.

## Gaps Summary

No code gap. Every success criterion and requirement has implementing code and passing tests. The phase cannot be called fully verified until the operator-visible rows are driven in a browser (G4-1 to G4-5b and the X and A axes). **Run G4-2 first.** It is the only row that proves a live stream survives Stay and Switch, and the claim in the SUMMARYs that Switch back restores the answer (assumption A1) rests on it.

---

_Verified: 2026-10-29_
_Verifier: Claude (gsd-verifier)_
