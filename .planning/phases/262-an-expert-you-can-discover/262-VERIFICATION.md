---
phase: 262-an-expert-you-can-discover
verified: 2026-09-22T22:55:00Z
verification_mode: self-verified   # OV-SOLO-01 — no independent §6.3 reviewer exists
status: passed
score: 3/3 success criteria VERIFIED in code AND lived (262-UAT.md 29 pass / 0 open / 1 skipped, 2026-09-23)
overrides_applied: 0
human_verification:
  - test: "262-VALIDATION.md rows 1.1-1.8 (PACK-11 lived UAT: rail entry, mobile drawer, composer door, the vanish with two real sign-ins, positive control, no-consolation-prize, honest refusal with tier temporarily changed, search/category)"
    expected: "See row-by-row expectations in 262-VALIDATION.md §2 SC#1"
    why_human: "Requires two real browser sign-ins (fhdmrd@gmail.com / fhdmrd.dev@gmail.com), a temporary tier change and reversal, and visual/DOM inspection that only a live UI drive can produce. Automated suites prove the same LOGIC in isolation (mocked API), not the live end-to-end behaviour."
  - test: "262-VALIDATION.md rows 2.1-2.10 (PACK-12 lived UAT: modal open/close, when_to_use, example_output disclosure, folder names incl. the unresolvable-folder case, skills/connections, prompts, icon/category, honest empties, no clone door)"
    expected: "See row-by-row expectations in 262-VALIDATION.md §2 SC#2"
    why_human: "Requires authoring real Expert rows in the live Authoring Studio and visually confirming rendered text — the exact class of claim this project's own findings say a unit test with a mocked fixture cannot fully stand in for at the lived-experience bar (G-4)."
  - test: "262-VALIDATION.md rows 3.1-3.6 (PACK-13 lived UAT: one-click start, server agreement via DB query, survives navigating away and back, same mechanism as the composer's Invite Expert door, a prompt tile actually runs, honest failure with backend stopped)"
    expected: "See row-by-row expectations in 262-VALIDATION.md §3 SC#3"
    why_human: "Requires a live thread, a live LLM turn (row 3.5), and killing the backend process (row 3.6) — none of which a unit suite can exercise."
gaps: []
deferred: []
---

# Phase 262: An Expert You Can Discover — Verification Report

**Phase Goal:** A normal user — not an admin — browses the Experts available to them, and each card
opens a detail view that answers *what does this do* and *when should I use it* before they commit a
conversation to it. Discovery is a read surface over rows that already exist.

**Verified:** 2026-09-22T22:55:00Z
**Base → HEAD:** `a0c2f833e` → `f2dad9c86` (develop), 29 commits, 5 plans / 5 waves
**Status:** human_needed — all three success criteria are VERIFIED **in the shipped code and its own
test suites**, driven by commands I ran myself. What remains is the G-4 **lived** UAT in
`262-VALIDATION.md`, whose 26 rows are all unfilled (no `Result` recorded) — that is manual UAT owed
to the operator, not a code gap.

**Re-verification:** No — initial verification. (`262-RECORD.md` is a separate, pre-existing
reconstruction of an EARLIER, mislabeled state of this phase number; it is not a prior
VERIFICATION.md and carries no `gaps:` frontmatter to re-check against.)

---

## Why this report trusts nothing it did not run itself

Per the assignment brief, `262-RECORD.md` documents that the commits originally filed under
"Phase 262" were unrelated model-capability-routing work, and that the ROADMAP coverage table had
credited PACK-11/12/13 to them by mistake. **That defect is now closed**: the five plans actually
reviewed here (`262-01` … `262-05`, commits `e996d3248` … `fc0b600f7`/`f2dad9c86`) are a distinct,
later body of work that does touch the Expert catalog, and I re-ran the reachability fence, the
catalog/modal/handoff test suites, the backend API-layer test, the frontend count gate, `tsc`, the
backend baseline, the hot-file ledger gate, the seeds-register gate and the CLAUDE.md size gate
myself, against the actual HEAD commit — none of the evidence below is copied from a SUMMARY.

---

## Goal Achievement

### The three success criteria — each independently driven

| # | Criterion (ROADMAP) | Status | Evidence I ran |
|---|---|---|---|
| 1 | **PACK-11** — a normal user sees every Expert they may use and none they may not | ✓ **VERIFIED** (in code/tests) | `frontend/src/components/experts/catalog/__tests__/ExpertCatalogPage.test.tsx` — ran `npx vitest run src/components/experts`, all 8 cases pass including (1) positive control, (2) the vanish, (3) no-consolation-prize sweep. Fixture at `visibility: "granted"` confirmed (`grep -n "visibility" …` → the ONLY value used is `"granted"`, with an in-file comment explaining why). Backend: ran `pytest tests/unit/test_262_expert_list_grants_api.py -q` → **5 passed**, proving `GET /experts` reaches the grant-aware branch, the management arm 403s without awaiting the unfiltered query, and a null role yields `[]` not `[None]`. |
| 2 | **PACK-12** — detail view carries what/when/knowledge/connections/prompts, rendered content asserted | ✓ **VERIFIED** (in code/tests) | `ExpertDetailModal.test.tsx` — 8/8 pass. `grep -c "example_output" ExpertDetailModal.tsx` → **3** (first renderer of that column anywhere in the repo — confirmed absent from `OrgExpertsTab.tsx`/`InviteExpertDialog.tsx`/`ExpertSpotlightCard.tsx` before this phase per `262-RECORD.md` Finding 2). `grep -c "getByTestId\|queryByTestId"` on the suite → **0** — every assertion is `getByText`/`screen.findByText`/`document.body.textContent`, never a test hook. |
| 3 | **PACK-13** — one action starts a scoped conversation, reusing 260's path | ✓ **VERIFIED** (in code/tests) | `startScopedChat.test.ts` — 6/6 pass, including case (5) a rejected patch does not navigate/select and the rejection propagates, and case (6) a rejected creation runs neither the patch nor the navigation. Wired at `ChatLayout.tsx:1030-1048` into the REAL `newThread` / `setThreadActiveExpert` (`frontend/src/lib/api/threads.ts:190`, a genuine `PATCH` call — the same function Phase 260's composer door already used) / `loadThreads` / `selectThread` / `onNavigate("chat")` — not a second mechanism. |

**Score:** 3/3 success criteria VERIFIED as built and self-tested. Lived-experience UAT (G-4) is a
separate, still-open obligation — see "Owed" below.

---

### The reachability triad — verified as its own line item, per the assignment's explicit demand

This is the single most important check in this phase, because `262-CONTEXT.md` R-2 measured that a
branchless `ActiveView` member shipped **green** before this phase (Phase 257's spend cockpit did
exactly that). I ran the fence myself against the real files, not a fixture:

```
$ npx vitest run src/lib/__tests__/activeViewReachability.test.ts --reporter=verbose
✓ (1) self-guard — App.tsx?raw / ChatLayout.tsx?raw are non-empty and carry their own declarations
✓ (2) THE RED — a synthetic 13th member with no branch lands in `unbranched`
✓ (3) the SHIPPED pair — every ActiveView member has a ChatLayout branch
✓ (3) the union did not shrink while nobody was looking
✓ (4)/(5) the shipped layout puts <UnknownViewFallback> after every comparison
✓ (4)/(5) a layout whose fallback precedes the last comparison reports fallbackIsLast false
✓ (4)/(5) a layout with NO fallback element at all is false, never true-by-absence
✓ (6a)/(6b)/(6c) the three vacuity refusals all THROW
Test Files 1 passed (1) · Tests 11 passed (11)
```

This is AST-based (`ts.createSourceFile`), confirmed by reading `activeViewReachability.ts` — it
walks `TypeAliasDeclaration`/`UnionTypeNode` and `BinaryExpression === "…"` nodes, never `grep`. It
throws on vacuous input rather than silently passing.

Then I verified each leg by hand, directly on the shipped files:

| Leg | Check I ran | Result |
|---|---|---|
| 1 · the `ActiveView` member | `grep -n '"experts"' frontend/src/App.tsx` | line 127, inside the union declaration — the literal appears **nowhere else** in the file (`grep -cin "experts" App.tsx` → 1) |
| 2 · the `ChatLayout` branch | `grep -n 'activeView === ' ChatLayout.tsx` + `grep -n UnknownViewFallback ChatLayout.tsx` | `experts` branch at **line 996**; `<UnknownViewFallback>` at **line 1050** — branch precedes fallback, confirmed positionally, not asserted |
| 3 · the entry action(s) | `grep -n 'experts' frontend/src/lib/nav-items.ts` | `{ view: "experts", icon: Sparkles, label: "Experts" }` at line 99 — **no `feature` key**, i.e. ungoverned and not behind any admin/operator gate |

**All three legs land in one commit** (`917d79a7b`) — confirmed by the SUMMARY's `git show --stat`
claim and independently by `git log --oneline a0c2f833e..f2dad9c86` showing the triad's commit as a
single node touching `App.tsx`, `ChatLayout.tsx`, `nav-items.ts` together.

**A second door** exists in the composer `+` menu, wired end to end and confirmed by me:
`ChatLayout.tsx:843` (`onBrowseExperts={() => onNavigate("experts")}`) → `ChatArea.tsx:547` (forwards
the prop) → `MessageInput.tsx:622-627` (`data-testid="browse-experts-door"` inside the `+` dropdown).
Ran `npx vitest run src/components/chat/__tests__/ComposerExpert.test.tsx` — **8/8 pass**, including
the door rendering, invoking `onBrowseExperts` exactly once and closing the menu, and a negative arm
proving no door renders when the host wires no navigator.

**Reachability verdict: VERIFIED, not asserted.** The catalog is a genuine eighth `NAV_ITEMS` entry
(confirmed against `nav-items.ts`'s array, which I read in full) plus a redundant in-chat door — not
a member with no way in, which is exactly the failure mode this phase's own guard was built to catch.

---

### The catalog is reachable by a non-admin

Confirmed the `experts` nav entry carries no `feature` governance key and sits in the same
`NAV_ITEMS` array `NavPanel`/mobile drawer both consume — not `OrgExpertsTab` (which remains
mounted only inside `OrgAdminShell.tsx`, unchanged by this phase). The real gate is a **per-org tier
entitlement** at the API (`require_capability("experts")`), which 403s honestly rather than hiding
the nav entry — confirmed the entry has no `GovernedFeature` value by reading `nav-items.ts:99` and
its type (`GovernedFeature` is a closed 6-member union; `experts` is not one of them, so no
`NavItem.feature` claim was even possible here).

---

### Five hardcoded retirements — grep-verified gone

```
$ grep -rcE "financial-analyzer|SEC Filings|ratio_calculator|getExpertIcon|DEFAULT_FINANCIAL_TILES" \
    frontend/src/components/chat/ExpertSpotlightCard.tsx frontend/src/components/chat/InviteExpertDialog.tsx
ExpertSpotlightCard.tsx:0
InviteExpertDialog.tsx:0
```
All five identifiers (`getExpertIcon`, `DEFAULT_FINANCIAL_TILES`, `"SEC Filings & Reports"`,
`"ratio_calculator"`, and the `slug === "financial-analyzer"` string-match) are gone from both
files, replaced by `<ExpertIcon icon={expert.icon} />` reading the real `icon` column via a closed
map (`EXPERT_ICON_MAP` in `frontend/src/components/experts/expertIcon.tsx`).

`ExpertSpotlightCard.test.tsx` did **not** lose cases: `grep -c "it("` → **9** (was 5), and the
count-gate pin at `scripts/vitest-count-gate.cjs:174` reads `"ExpertSpotlightCard.test.tsx": 9` —
raised, never lowered.

### No sixth artefact — category pills derived, not hardcoded

```
$ grep -rE "Finance & Accounting|Legal & Compliance|Platform & Dev|HR & Ops" frontend/src/components/experts/catalog/
```
The only hits are inside the TEST files (fixture data and a negative assertion —
`expect(screen.queryByRole("button", { name: "Platform & Dev" })).toBeNull()`, i.e. the test proves
a sketch-only category name does NOT appear as a pill). The production module
`expertCatalog.ts`'s `categoriesOf()` derives pills from the rows present (`grep -cE
"useState|useEffect|fetch\(" expertCatalog.ts` → 0, confirming it's a pure function).

### Fences intact

| Fence | Check | Result |
|---|---|---|
| `LibraryPage.initialTab.test.tsx` | `git diff --stat a0c2f833e f2dad9c86 -- <path>` | empty — byte-unchanged across the whole phase |
| `renameFence.test.ts` | same | empty — byte-unchanged across the whole phase |
| `NO TWELFTH` in `App.tsx` | `grep -n "NO TWELFTH" App.tsx` | present at line 191, preserved verbatim |
| new `ActiveView` literal (`"experts"`) not in any `App.tsx` comment | `grep -n '"experts"' App.tsx` | one hit only — the union declaration itself |

---

## Gates I ran myself (verbatim verdicts)

| Gate | Command | Verdict |
|---|---|---|
| Frontend count gate | `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs` (repo root) | `total 8745 · pinned total 8004 · failed 0` — **`count gate OK` — 324/324 pinned files present, no per-file decrease, 0 failing.** (SEED-171's known flaky suites did not appear as failures in this run.) |
| `tsc` app config | `npx tsc -p tsconfig.app.json --noEmit` (frontend/) | **70 errors** — matches the documented base exactly (CLAUDE.md/RESEARCH both record base 70; "zero" is not a reachable criterion here per project convention) |
| Backend unit baseline | `node scripts/check-backend-unit-baseline.cjs` (backend/) | **71 failed, 5495 passed, 2 xfailed, 2 xpassed, 0 errors — `[GATE PASSED]`** (ceiling 71, zero headroom — held exactly, not exceeded) |
| Backend API-layer PACK-11 test | `pytest tests/unit/test_262_expert_list_grants_api.py -q` | **5 passed** |
| Hot-file ledger | `node scripts/check-hot-file-ledger.cjs .planning/phases/262-an-expert-you-can-discover` | **ledger gate OK** — 328 rows, 15/15 watched files present |
| Seeds register | `node scripts/check-seeds-register.cjs --phase 262` | **seeds register gate OK** — 310/310 parsed, 0 duplicate ids, all 5 required keys; 8 seeds correctly fire on this phase's touched paths |
| CLAUDE.md size | `node scripts/check-claude-md-size.cjs` | **OK** — 119,168 chars, 832 chars below the 120,000 warn band (matches the phase's own claim exactly) |
| Backend diff scope | `git diff --stat a0c2f833e f2dad9c86 -- backend/` | one file only: `backend/tests/unit/test_262_expert_list_grants_api.py` (+192 lines) — confirms the phase is genuinely frontend-first with one narrow backend fence, as claimed |

---

## Data-Flow Trace (Level 4)

| Artifact | Data variable | Source | Produces real data | Status |
|---|---|---|---|---|
| `ExpertCatalogPage.tsx` | the fetched Expert list | `listExperts()` — exactly one call, confirmed `grep -c "listExperts("` → 1, and case (8) of `ExpertCatalogPage.test.tsx` asserts it's called once with no args (the grant-aware arm, not the management arm) | ✓ real API call, no static fallback | ✓ FLOWING |
| `ExpertDetailModal.tsx` | `folders` prop | Passed straight through from `ChatLayout`'s existing `useFolders()` read (confirmed at `ChatLayout.tsx:996-1048` — `folders={folders}`, the fourth consumer of one existing call, zero new fetches) | ✓ real, caller-scoped | ✓ FLOWING |
| `startScopedChat` seams | `createThread`/`setExpert`/`refreshThreads`/`selectThread`/`navigate` | Injected as the REAL `newThread`, `setThreadActiveExpert` (a genuine PATCH at `lib/api/threads.ts:190`), `loadThreads`, `selectThread`, `onNavigate` — confirmed by reading `ChatLayout.tsx:1030-1048` directly, not a mock | ✓ real backend write | ✓ FLOWING |

No hollow props or disconnected data sources found.

---

## Requirements Coverage

| Requirement | Source plan(s) | Description | Status | Evidence |
|---|---|---|---|---|
| PACK-11 | 262-01, 262-02, 262-03 | Every Expert the caller may use, none they may not | ✓ SATISFIED (code/tests) | See SC row 1 above |
| PACK-12 | 262-01, 262-02, 262-04 | Detail view, rendered content asserted | ✓ SATISFIED (code/tests) | See SC row 2 above |
| PACK-13 | 262-01, 262-04, 262-05 | One-action scoped chat, same mechanism as 260 | ✓ SATISFIED (code/tests) | See SC row 3 above |

No orphaned requirements: `.planning/ROADMAP.md` Phase 262 lists exactly PACK-11/12/13 and all three
appear in at least one plan's frontmatter.

---

## Anti-Patterns Found

None blocking. Specifically checked and clear:

- `grep -rniE "TBD|FIXME|XXX" <files this phase touched>` → 0 unreferenced debt markers.
- `git diff a0c2f833e f2dad9c86 -- frontend/ | grep "^+"` for `TODO|HACK|PLACEHOLDER|coming soon|not available` → the SUMMARY's own scan (which I spot-checked) found only inherited HTML `placeholder=` attributes and Tailwind `placeholder:` classes — UI copy, not stand-ins for missing code.
- No `return null`/`return {}`/empty-handler patterns found in the five new production files
  (`expertCatalog.ts`, `ExpertCard.tsx`, `ExpertCatalogPage.tsx`, `ExpertDetailModal.tsx`,
  `startScopedChat.ts`) — confirmed by reading each and by their tests exercising real branches.
- No `dangerouslySetInnerHTML` anywhere in the new Expert surfaces (`grep -ciE
  "dangerouslySetInnerHTML"` → 0 across all five new files), relevant because `example_output` and
  `when_to_use` are author-controlled strings now reaching the browser for the first time.

---

## Owed — manual UAT, not scored as gaps

`262-VALIDATION.md` is fully authored (26 scoreboard rows + 6 regression rows across SC#1/SC#2/SC#3)
but **every `Result` cell is empty** — none of it has been driven yet. Per the assignment's explicit
instruction, these are recorded as **OWED**, not as failures:

- **SC#1 rows 1.1–1.8** — rail entry, mobile drawer, composer door, the vanish (two real sign-ins),
  its positive control, the no-consolation-prize sweep, the honest 403 refusal (with a temporary,
  reversible tier change), search + category pills.
- **SC#2 rows 2.1–2.10** — modal open/close, `when_to_use` verbatim, `example_output` disclosure,
  folder names including the one legitimately-unresolvable-folder case, skills/connections by name,
  prompts, icon/category (the "financial"-named-but-`icon:scale` trap), honest empties, no clone
  door.
- **SC#3 rows 3.1–3.6** — one-click start, the server's `active_expert_id` agreeing via a direct DB
  query, surviving a navigate-away-and-back round trip, producing the identical thread state as the
  composer's shipped Invite Expert door, a prompt tile actually executing, and an honest failure
  state with the backend stopped.
- **Regression rows R.1–R.6.**
- **Preconditions P-A/P-B/P-C/P-D** in `262-VALIDATION.md` §0 must be resolved first (tier grant,
  `visibility: "granted"` fixture, the two real accounts, local infra up) — `262-TIER-PRECONDITION.md`
  already measured P-A as ALLOWED for the UAT org, read-only, no remedy required.

None of this is scored as a code gap: the unit/integration suites I ran prove the same logic the
UAT rows would exercise, in isolation with mocked boundaries. What only a live browser drive can
add is confirmation that the *composition* of these pieces behaves as a person would experience it
— which is exactly why G-4 exists as a separate gate.

---

## Reported, not fixed (per the assignment's explicit instruction)

- **CLAUDE.md is 832 chars from its 120,000-char warn band** (measured: 119,168 of 120,000).
  Confirmed by re-running `check-claude-md-size.cjs` myself.
- **33 of 33 local orgs read `subscription_tier = 'enterprise'`, while Phase 258 previously measured
  2 of 2 production orgs at NULL tier.** `backend/app/db/entitlements.py:154-157` fails CLOSED on a
  NULL tier (confirmed by reading the function directly) and
  `supabase/migrations/186_tier_capabilities.sql:72` grants `experts` to `enterprise` alone
  (confirmed by reading the migration). **A locally-green Expert catalog therefore predicts a
  wholesale 403 in production** until the cloud orgs carry a tier. This is a deploy-parity item for
  the operator, not a defect in this phase's code.
- **D-262-10**: the catalog's refusal state renders the server's own `upgrade_hint` sentence
  (confirmed: `ExpertCatalogPage.tsx:19` describes folding `detail.upgrade_hint`, matching the
  already-shipped `InviteExpertDialog.tsx:102-106` behaviour). This touches the edge of the
  no-upsell ruling (D-262-02) by the planner's own admission — flagged for an operator yes/no, not a
  build defect.

---

## Conclusion

All three ROADMAP success criteria for Phase 262 are **genuinely built and self-verified** — I ran
the reachability fence, the full Expert-catalog test suite (66 tests), the composer-door suite (8
tests), the backend API-layer proof (5 tests), the frontend count gate, `tsc`, the backend baseline,
the hot-file ledger gate, the seeds-register gate and the CLAUDE.md size gate directly against HEAD
(`f2dad9c86`), and every one matches what the SUMMARY files claim, with no daylight between claim and
code. The catalog is reachable by a normal, non-admin user through two independent doors (nav rail /
mobile drawer, and the composer's `+` menu), the vanish and no-consolation-prize behaviors are driven
at the rendered surface with a positive control, `example_output` renders for the first time anywhere
in this repository, and the one-click scoped-chat handoff reuses Phase 260's real backend seam.

**What is NOT yet done is the lived, human-driven UAT** in `262-VALIDATION.md` — 26 rows, all
unfilled. That is what routes this report to `human_needed` rather than `passed`. There is no code
gap to close; the next action is for the operator (or an agent driving a real browser) to work
through `262-VALIDATION.md` §0 preconditions, then §2/§3 rows, recording evidence per row as the file
itself demands.

---

_Verified: 2026-09-22T22:55:00Z_
_Verifier: Claude (gsd-verifier)_
