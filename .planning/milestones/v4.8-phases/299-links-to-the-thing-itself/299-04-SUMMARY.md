---
phase: 299-links-to-the-thing-itself
plan: 04
subsystem: frontend / copy-link surface, who-can-open line, Saves in <org>
tags: [frontend, share, copy-link, org-scope]
requires:
  - 299-01
  - 299-02
  - 299-03
  - 299-05
provides:
  - "lib/linkAudience.ts: audienceOf(kind, facts), audienceParts / audienceLine(audience, orgName), linkNoun(kind), TERMINAL_RUN_STATUSES — the strict-leaf twin of link_resolver.audience_of, pinned to link_audience_cases.json"
  - "share/ShareLinkMenu.tsx: ShareLinkMenu (header trigger) + ShareLinkMenuSub (card ⋯ menu) over one LinkSurfaceBody; props { route, kind, audience, orgId, orgName?, className? }; linkToThis(kind)"
  - "org/SavesInOrg.tsx: SavesInOrg({ className?, asSentence? }) — null below 2 orgs"
  - "orgItemsCopy.ts: SAVES_IN_PREFIX, savesIn(org)"
  - "lib/api/workflows.ts: createWorkflowDraft(def, signal?, opts?: { fromDefinitionId? }); WorkflowOrgRefusedError; WorkflowRunRead.org_id"
  - "useWorkflowFork: ForkFailure { name, conflict, sentence? }"
  - "types/index.ts: ExpertBundle.org_id"
affects: [299 verification, G-4 row 1]
tech-stack:
  added: []
  patterns:
    - "a client mirror of a server rule pinned to the server's own fixture and source literal via ?raw"
    - "a refusal classified by the server sentence's fixed shape, pinned to the backend source"
    - "menu bodies keep every direct role=menu child a menuitem or a group (DropdownMenuGroup wraps text)"
key-files:
  created:
    - frontend/src/lib/linkAudience.ts
    - frontend/src/lib/__tests__/linkAudience.lockstep.test.ts
    - frontend/src/components/share/ShareLinkMenu.tsx
    - frontend/src/components/share/__tests__/ShareLinkMenu.test.tsx
    - frontend/src/components/share/__tests__/shareMounts.test.tsx
    - frontend/src/components/share/__tests__/savesInOrg.test.tsx
    - frontend/src/components/org/SavesInOrg.tsx
  modified:
    - frontend/src/components/chat/ChatArea.tsx
    - frontend/src/components/workflows/library/WorkflowCardMenu.tsx
    - frontend/src/pages/WorkflowsPage.tsx
    - frontend/src/pages/WorkflowRunPage.tsx
    - frontend/src/components/workflows/RunEvidenceReport.tsx
    - frontend/src/components/experts/catalog/ExpertDetailModal.tsx
    - frontend/src/components/workflows/library/RunModal.tsx
    - frontend/src/components/workflows/library/useWorkflowFork.ts
    - frontend/src/components/org/orgItemsCopy.ts
    - frontend/src/lib/api/workflows.ts
    - frontend/src/types/index.ts
    - frontend/src/components/chat/__tests__/ChatArea.threadWorkflowPicker.test.tsx
    - frontend/src/pages/WorkflowBuilderPage.session.test.tsx
    - frontend/src/components/workflows/RunEvidenceReport.test.tsx
    - frontend/src/components/workflows/library/__tests__/WorkflowCard.seam286.pin.test.tsx
    - frontend/src/components/workflows/library/__tests__/__snapshots__/WorkflowCard.seam286.pin.test.tsx.snap
    - frontend/src/pages/__tests__/__snapshots__/WorkflowRunPage.seam286.pin.test.tsx.snap
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "A finished run's page is RunEvidenceReport (289-04's early return), so the run-page header mount only ever serves an unfinished run; the finished-run link (D-34's members-of line) is mounted in the report's actions row instead"
  - "ShareLinkMenu gained an optional orgName: the evidence read carries org_name, not org_id"
  - "The link body wraps its heading/address/status and its audience line in DropdownMenuGroups — the drawn body put bare label/code/span under role=menu, which a five-role WR-03 sweep drove RED"
  - "The Tweak org 409 is classified by the guard sentence's fixed shape (the server sends a bare string detail; the only other 409 is the slug/version clash), pinned to item_org_guard.py via ?raw; a coded detail would be stronger and is left for a later phase"
  - "ForkFailure.sentence is a narrow widening of T-192-40's prose-free shape: set only from an error named WorkflowOrgRefusedError"
  - "A starter row is the system-global shelf, so the card's audience reads is_system_global from provenance === 'starter'"
metrics:
  duration: "~2h"
  completed: 2026-10-28
---

# Phase 299 Plan 04: Copy a link, with an honest who-can-open line, and Saves in <org> Summary

Every item surface (chat, workflow card and Builder draft, run, Expert) now has a "Link" control. It shows the item's own rebuilt address, one "Copy link" item and a line saying who can open the link. That line comes from one leaf, pinned to the resolver's own fixture. The three buttons that create something (Run, Tweak, Start a chat) say "Saves in {Org}" for a person in two or more orgs. A Tweak now sends its source id, so a copy across orgs is refused in the server's own words.

## What was built

- **`lib/linkAudience.ts`** is a strict leaf with no dependencies. It uses the same rule as `link_resolver.audience_of`. `linkAudience.lockstep.test.ts` iterates every row of `backend/tests/unit/fixtures/link_audience_cases.json` and the backend `TERMINAL_RUN_STATUSES` literal through `?raw`. It also asserts each UI-D15 sentence verbatim, and checks that each one is spelled once in the leaf. An org-scoped audience with no org name falls back to the owner-only line.
- **`share/ShareLinkMenu.tsx`** is a ghost `Link2` + "Link" trigger. It is icon-only at `h-11 w-11` below md, and its aria-label is "Link to this {noun}". The surface is a `DropdownMenuContent w-[340px] p-4`. It holds the label, a `<code>` with host + `formatAppRoute(route)`, one Copy link item and the audience line. On success the item reads "✓ Link copied" for 2 s, with an sr-only status. If the copy is refused, the address is selected and the item names the shortcut. There is no toast, no popover and no input. `ShareLinkMenuSub` is the card ⋯ menu form.
- **Mounts:** there is one expression on each surface.
  - The chat header, after the title.
  - The card ⋯ menu, as its first item.
  - The Builder breadcrumb, after the draft label, and only when a `draftId` exists.
  - The run page title row, after the version chip and before Stop.
  - **The evidence report's actions row, for a finished run (deviation, below).**
  - The Expert detail header, inside `pr-8`.
- **`org/SavesInOrg.tsx`** has three mounts: under RunModal's Run row, on the card's fork consequence line (only when the verb creates something), and beside the Expert's Start a chat.
- **`createWorkflowDraft(def, signal?, { fromDefinitionId })`** sends `?from_definition_id=` only when the option is set. The Tweak path passes `wf.id` and the starter path passes nothing. A Tweak 409 in the org guard's shape throws `WorkflowOrgRefusedError`, and its sentence is shown verbatim in the fork notice (`forkFailed.sentence ?? forkFailedMessage(...)`).
- **S8:** RunModal already showed `e.message`, and `postMessage` already throws a string detail verbatim. Both are now asserted with the org sentences. None of the shown sentences contains 409, conflict, forbidden or invalid.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] The drawn link body broke WR-03's `aria-required-children`.**
- **Found during:** Task 2. A five-role sweep was added to `ShareLinkMenu.test.tsx` and went RED with `div / code / div / span[role=status]` sitting directly under `role="menu"`.
- **Fix:** the heading, address and status sit in one `DropdownMenuGroup`, and the audience line sits in another (the card menu's consequence-note precedent).
- **Commit:** `62280d4fa`. The pin went from 11 to 12.

**2. [Rule 2 - Missing functionality] The finished-run link was mounted in `RunEvidenceReport.tsx` (not in the plan's files).**
- **Found during:** Task 2. `WorkflowRunPage` returns `RunEvidenceReport` for any terminal run (289-04). The planned header mount could therefore never show "Opens for members of {Org}.", and a finished run (the run people share) had no link at all.
- **Fix:** one mount was added first in the report's `print:hidden` actions row. Its audience comes from `payload.run.status` / `org_name`. `ShareLinkMenu` gained an optional `orgName`, because the evidence read carries the name and not the id. The two exact button-name sets in `RunEvidenceReport.test.tsx` each gained "Link".
- **Commit:** `92b354b10`.

**3. [Rule 3 - Blocking] `ExpertBundle.org_id` was added to `types/index.ts` (not in the plan's files).**
- **Why:** the plan's Expert mount reads `expert.org_id`. The server has always returned it (`SELECT *`), but the client type did not declare it. One optional field, additive. The ledger row was updated.
- **Commit:** `92b354b10`.

**4. [Rule 1 - Bug] The fork notice would have mis-worded the org refusal.**
- **Found during:** Task 3. `isForkConflict` is a "409" substring test, so the org-guard 409 would have read "A version of … already exists".
- **Fix:** a typed `WorkflowOrgRefusedError` plus `ForkFailure.sentence`, with one expression changed on the page. This is the plan's "failure home that replaces the server sentence" case.
- **Commit:** `05c18eb3a`.

**5. [Test placement] The chat header and Builder draft mount cases live in those surfaces' own harnesses.**
- **Where:** `ChatArea.threadWorkflowPicker.test.tsx` (5 → 7) and `WorkflowBuilderPage.session.test.tsx` (23 → 25), not in `shareMounts.test.tsx`.
- **Why:** they need the real streams provider and the whole page `@/lib/api` factory, and `shareMounts` fakes both.

**6. [Snapshots] The plan's rule was applied to the snapshots this plan changed.**
- `WorkflowCard.seam286.pin` (5 menu snapshots + `EXPECTED_ROLES` gains one leading `menuitem` per state) and `WorkflowRunPage.seam286.pin` (`ready: a non-terminal run`) were updated.
- Each one was proven identical to the previous commit once the one new node is removed (radix ids normalised).
- The run-page `.snap` was one of the five line-ending-dirty files. Committing it normalised its line endings, and its content change is only the new mount. The other four dirty snapshots were not touched.

**8. [Rule 1 - Pin re-capture] `WorkflowBuilderPage.header.test.tsx` pins the Builder header byte for byte and word for word.**
- **Found by:** the first full count-gate run (4 failures).
- **Fix:** the draft's Link trigger was added to band 1's markup and to both atom lists, with radix ids normalised and an explanation note above the pin (the file's own re-capture rule).
- **Commit:** `cda7e3e5f`. Test count unchanged (71).

**7. [Plan wording] The RunModal caption carries the footer's `bg-muted/30 px-6 pb-3`.**
- UI-SPEC says `mt-2 text-right`. The footer's own classes were carried so the caption reads as part of the bar. G-4 row 1 should look at it.

## Gate verdicts (verbatim)

- **Vitest count gate:** this is the second run, at `cda7e3e5f`. Command: `GSD_VITEST_MAX_WORKERS=2 node scripts/vitest-count-gate.cjs`.
  ```
  total 13162  ·  failed 0  ·  pinned total 12013
  count gate OK — 565/565 pinned files present, no per-file decrease, 0 failing.
  ```
  - **First run (`8083a1963`): `RESULT: COUNT GATE VIOLATED (1 reason(s))`, `[failing-tests] 9 test(s) failed`.** The failing names were taken from the gate's own persisted JSON report before anything was re-run:
    - `WorkflowBuilderPage.header.test.tsx` ×4. **NEW, mine:** the band-1 markup pin and both atom lists did not yet include the draft's Link trigger. They were re-captured in `cda7e3e5f`. That diff is exactly the one `<button>` and the one word "Link", plus radix ids normalised, with an explanation note written above the pin.
    - `WorkflowsPage.test.tsx` ×4. **Inherited timing:** 5 s timeouts on the 200-row cases. The file is provably unmodified (`git diff --numstat effdf3a22 HEAD` is empty). `is_mine ABSENT` also timed out (5.39 s) with **all eleven changed sources checked out at `effdf3a22`**. All four passed on the second run.
    - `WorkflowCard.test.tsx` ×1. **Timing:** the 106-row scale case. The file is provably unmodified, the case passed solo with this plan's sources, and it passed on the second run. One green sample is not proof of innocence: it is load-sensitive.
  - Per-file deltas for this plan's suites: linkAudience.lockstep 20, ShareLinkMenu 12, shareMounts 14, savesInOrg 21, ChatArea.threadWorkflowPicker 7, WorkflowBuilderPage.session 25, WorkflowCard.seam286.pin 21, WorkflowRunPage.seam286.pin 10. All were at their pins, with no decrease anywhere.
- **Typecheck:** `npx tsc -p tsconfig.app.json --noEmit` gave 61 errors, and the set diff against base was **empty** (0 new). It was checked after each task and again at the end.
- **Backend unit baseline:** there is no backend change in this plan (`git diff effdf3a22 -- backend` is empty). It was run anyway under the local-DB lock:
  ```
  Failed tests:   69 (allowed ceiling: <= 71)
  [GATE PASSED] Backend unit baseline satisfied (failed: 69 <= 71, errors: 0).
  ```
- **Hot-file ledger:** `node scripts/check-hot-file-ledger.cjs .planning/phases/299-links-to-the-thing-itself` printed `ledger gate OK — every watched file has a row.` (737 rows · 87 subject files · 45 watched).
- **CLAUDE.md size:** `CLAUDE.md 103103 chars 68.7% of limit headroom 46897 [OK]` and `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- **Snapshots:** the four remaining dirty `.snap` files are line-ending only (`git diff --ignore-cr-at-eol` is empty) and were not committed.

## TDD Gate Compliance

| Task | RED commit (seen failing) | GREEN commit |
|---|---|---|
| 1 | `e4056e8ef`: both files failed to import the missing modules | `f4a95b696` (31 passed) |
| 2 | `671d936eb`: 16 failed against the unmounted surfaces (the two absence cases passed, as expected) | `92b354b10` |
| 3 | `323e9ed5a`: failed to resolve `@/components/org/SavesInOrg` | `05c18eb3a` (21 passed) |

## Acceptance checks

- `grep -c "import" lib/linkAudience.ts` = 0.
- `link_audience_cases.json?raw` appears exactly once in the lockstep test.
- No popover package. `<input` = 0 in `ShareLinkMenu.tsx`, after the docblock was worded in `8083a1963`.
- `<ShareLinkMenuSub` = 1 in `WorkflowCardMenu.tsx`. `org_id?: string | null` is present in `lib/api/workflows.ts`.
- The diff adds no re-run / relaunch control to `WorkflowRunPage.tsx` (0 hits).
- `<SavesInOrg` sites are exactly `RunModal.tsx`, `WorkflowCardMenu.tsx` and `ExpertDetailModal.tsx`.
- `fromDefinitionId` is in `useWorkflowFork.ts` and `from_definition_id` is in `lib/api/workflows.ts`.
- `grep -c "import" orgItemsCopy.ts` = 3. It was **3 at base** too: all three are docblock words ("no imports", "imports it", "imports nothing"). There is no import statement, so the leaf is still strict. The raw-grep criterion as written cannot read 0 on this file.

## Known Stubs

None.

## Threat Flags

None. No new endpoint, auth path or schema. The copied text is origin + rebuilt path (T-299-31, asserted: no `?`, no `#`). The audience comes from the pinned leaf (T-299-32). `ForkFailure.sentence` is the only new route from a server body to the screen, and it is limited to the org guard's fixed shape (T-299-36: React text only).

## Owed before the phase closes (299-VALIDATION.md)

- **G-4 rows owed:** G4-1 (Copy link → fresh tab: this plan's lived-experience bar), G4-2, G4-3, G4-4a, G4-4b, G4-4d, G4-5a and G4-5b. G4-4c is ⛔ BLOCKED (D-41, no SSO provider on cloud). **Run G4-2 first** (the other-org run link with a live chat, Stay / Switch / Switch back). It carries assumption A1 (re-attach on return), which no automated suite proves.
- **Four-axis rows owed:** X-1..X-8 (the full native roster plus OpenRouter, derived from `MODEL_CAPABILITIES`) and A-1 multi-tool, A-2 parallel-thread, A-3 long-message.
- **The operator must make one look at G4-1:** the RunModal caption placement (deviation 7) and the 340 px surface at mobile width.
- **Known limit, recorded and not widened:** a Builder that mints its draft on its first save keeps `builderInitial` null, so it shows no Link until the draft is reopened from the library.

## Self-Check: PASSED

- All seven created files exist: `linkAudience.ts`, `linkAudience.lockstep.test.ts`, `ShareLinkMenu.tsx`, `ShareLinkMenu.test.tsx`, `shareMounts.test.tsx`, `savesInOrg.test.tsx`, `SavesInOrg.tsx`.
- All nine commits exist: `e4056e8ef`, `f4a95b696`, `62280d4fa`, `671d936eb`, `92b354b10`, `323e9ed5a`, `05c18eb3a`, `8083a1963`, `cda7e3e5f`.
- `StreamsProvider.tsx` is byte-unchanged (`git diff effdf3a22 -- frontend/src/providers/StreamsProvider.tsx` is empty). STATE.md and ROADMAP.md were not touched.
