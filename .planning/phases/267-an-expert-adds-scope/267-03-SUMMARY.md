---
phase: 267-an-expert-adds-scope
plan: 03
subsystem: experts-catalog-frontend
tags: [experts, catalog, connections, scope-ledger, seed-309, studio, tdd, pack-22, pack-21, pack-25]
requires:
  - "267-01 overlay: connection_state [{slug,name,connected}] + can_connect on every Expert read"
  - "backend/tests/fixtures/phase267/expert_overlay_row.json (the wire contract)"
provides:
  - "frontend/src/components/experts/ScopeLedger.tsx — ScopeLedger / LedgerColumn / LedgerItem / LEDGER_VISIBLE (used by 267-04's dialog)"
  - "expertCatalog.ts — CONNECTION_COPY, LEDGER_COPY, START_COPY, ConnectionGate, connectionGate, connectionPills, connectionLedgerColumns; installView gains a `connect` arm; inviteGate returns the gate line"
  - "ExpertBundle.connection_state? / can_connect? (types/index.ts, via ExpertConnectionState in lib/api/experts.ts)"
  - "ExpertCatalogPage / ExpertCard / ExpertDetailModal: optional onOpenConnections + startBusy"
affects: [267-04, 267-05]
tech-stack:
  added: []
  patterns:
    - "Gate order install → connection inside the ONE gate home; a surface never shows two gate reasons"
    - "Page-owned in-flight guard (ref + state) for a start that creates a thread"
    - "Fetch-layer fence of real wiring (real hook + real page + real startScopedChat), RED-driven by source plants"
key-files:
  created:
    - frontend/src/components/experts/ScopeLedger.tsx
    - frontend/src/components/experts/__tests__/ScopeLedger.test.tsx
    - frontend/src/components/experts/catalog/__tests__/ExpertCard.connection.test.tsx
    - frontend/src/components/layout/__tests__/ChatLayout.startChat.test.tsx
  modified:
    - frontend/src/components/experts/catalog/expertCatalog.ts
    - frontend/src/components/experts/catalog/ExpertCard.tsx
    - frontend/src/components/experts/catalog/ExpertDetailModal.tsx
    - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
    - frontend/src/components/experts/ExpertAuthoringStudio.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/lib/api/experts.ts
    - frontend/src/types/index.ts
    - frontend/src/components/experts/catalog/__tests__/expertCatalog.test.ts
    - frontend/src/components/experts/catalog/__tests__/ExpertDetailModal.test.tsx
    - frontend/src/components/experts/catalog/__tests__/ExpertCatalogPage.test.tsx
    - frontend/src/components/experts/__tests__/ExpertAuthoringStudio.test.tsx
    - scripts/vitest-count-gate.cjs
decisions:
  - "The card's all-connected envelope is byte-unchanged (it still lists required_connections slugs); only the missing state swaps to the ledger. A characterization case pins this."
  - "The modal keeps itself open while a PROMISED start is in flight and closes when it settles (success or failure); a plain callback still closes at once, so the shipped modal test holds."
  - "A Connect control renders only when gate.action is non-null AND a door prop is wired; otherwise the member's words render (no button that goes nowhere)."
  - "Studio: connection rows without a service_id are not offered (nothing could match them); a saved id with no loaded match renders as its own selected chip."
  - "START_COPY.busy ('Starting…') lives in expertCatalog.ts beside the other catalog copy."
metrics:
  duration: "~1h 45m"
  completed: 2026-09-25
  tasks: 3
  files: 17
---

# Phase 267 Plan 03: Catalog connection gate, ScopeLedger and SEED-309 guards Summary

The catalog now states a missing connection at rest. The card and the detail modal show "Requires HubSpot — not connected" and a Brings / Missing ledger, both built from the server's one overlay payload. An admin gets "Connect HubSpot →" to the shipped Connections door. A member gets the sentence naming who can fix it. No Start control renders in that state. Start Chat is in-flight guarded, a fetch-layer test fences ChatLayout's real start wiring, and the studio no longer shows a dead toggle. Its picker now saves service ids.

## Commits

| Task | Gate | Commit | What |
|---|---|---|---|
| 1 | RED | `730c84d10` | CONNECTION_COPY / connectionGate / ledger columns / gate order / the `?raw` fixture case; ScopeLedger suite |
| 1 | GREEN | `7f29330ea` | wire type, overlay fields on ExpertBundle, the gate selectors, the ScopeLedger leaf |
| 2 | RED | `ed137c8ae` | card connection suite, modal + page extensions (fixture moved off the name "Edgar MCP") |
| 2 | GREEN | `f05089bc6` | card/modal connect arm, page in-flight guard, ChatLayout's one prop |
| 3 | RED | `36d326319` | studio cases; ChatLayout.startChat real-wiring fence |
| 3 | GREEN | `821f58a78` | studio toggle removed + service_id picker; count-gate adoption |

## TDD gate compliance

Each task has a `test(267-03)` commit and then a `feat(267-03)` commit.

**RED, quoted:**
- Task 1: `Tests 15 failed | 29 passed (44)`. Examples: `TypeError: Cannot read properties of undefined (reading 'gateLine')` and `TypeError: connectionGate is not a function`. `ScopeLedger.test.tsx` gave `Failed to resolve import "../ScopeLedger"`. Cases (38) (install wins) and (40) (all connected, arms unchanged) passed on base, as characterizations should.
- Task 2: `Tests 16 failed | 82 passed (98)`. The double-click case read **`AssertionError: expected "vi.fn()" to be called 1 times, but got 2 times`**, which is the 265 review's `{calls: 2}` measurement. Modal (4) failed because base rendered the slug instead of the name. The card characterization case (5) passed on base.
- Task 3 (studio): `5 failed`, for example **`AssertionError: expected [ 'HubSpot CRM' ] to deeply equal [ 'hubspot' ]`**. The toggle case received the full body text, which contained `Preserve Deliverable Tool Floor (Recommended)` and `Additive Tool Floor: Delivers…`.
- Task 3 (ChatLayout fence): it passes on the real wiring. It was **driven RED by the review's two plants**, each applied alone and then restored with `git checkout --` on that one path. After each restore, `git diff --quiet HEAD -- frontend/src/components/layout/ChatLayout.tsx` held.
  - Plant 1, `refreshThreads: loadThreads,` → `refreshThreads: async () => {},`: `AssertionError: expected [ 'POST /threads', …(2) ] to deeply equal [ 'POST /threads', …(3) ]` (the `GET /threads` refresh is gone).
  - Plant 2, `discardThread: deleteThread,` → `// PLANT`: `AssertionError: expected [ 'POST /threads', …(1) ] to include 'DELETE /threads/t-scoped'`.
  - After both: `git diff --stat e1ba56bc5 HEAD -- ChatLayout.tsx` shows `3 +++`, which is only the Task 2 prop and its comment.

## Verification

- **Targeted suites (final):** `src/components/experts` + `ChatLayout.startChat` + `ChatLayout.launch`: **11 files / 188 passed**. `src/components/layout` + `InviteExpertDialog*` + `activeViewReachability`: **17 files / 179 passed**. InviteExpertDialog consumes `inviteGate`, which now also returns the connection line.
- **Count gate**, from the worktree root with `GSD_VITEST_MAX_WORKERS=2`. Verdict line, verbatim:
  ```
    total 8877  ·  failed 0  ·  pinned total 8125
  count gate OK — 330/330 pinned files present, no per-file decrease, 0 failing.
  ```
  Per-file figures below are from the gate's own output (the first run printed `— N new`):

  | Suite | base pin | now |
  |---|---|---|
  | expertCatalog.test.ts | 27 | 44 |
  | ExpertAuthoringStudio.test.tsx | 23 | 29 |
  | ExpertDetailModal.test.tsx | 15 | 20 |
  | ExpertCatalogPage.test.tsx | 13 | 19 |
  | ScopeLedger.test.tsx | — | 8 (new, both knobs) |
  | ExpertCard.connection.test.tsx | — | 6 (new, both knobs) |
  | ChatLayout.startChat.test.tsx | — | 2 (new, both knobs) |

  ⚠ **Residual, recorded rather than explained away:** the base total was 8828. This plan adds exactly +50 cases, so the expected total is 8878, but the run read 8877. The unpinned remainder fell from 753 to 752. `git diff 785c03274 e1ba56bc5 -- frontend scripts` is empty, and this plan edited no unpinned suite. The one `pending` case in the run is the pre-existing retired `it.skip` in `sketchComposition.test.tsx`. The −1 lies in an unpinned suite this plan never touched. It was not re-measured at base. Reds: none, so there were no filenames to classify.
- **tsc set diff** (`npx tsc -p tsconfig.app.json --noEmit | grep "error TS" | sort` vs 267-BASELINES §b): **0 errors added**. The only textual change is two base errors in `ExpertAuthoringStudio.tsx` shifting up one line (`(13,3)`→`(12,3)` HelpCircle, `(42,8)`→`(41,8)` ExpertGrant), because the removed `FileCode` import was one line. The set is 70 → 70.
- `node scripts/check-hot-file-ledger.cjs 267` → `ledger gate OK — every watched file has a row.` (exit 0).
- **Acceptance greps:**
  - `export const CONNECTION_COPY` matches once.
  - The fixture is imported via `expert_overlay_row.json?raw`.
  - `ScopeLedger.tsx` does not spell the unnameable phrase (it imports `UNNAMEABLE_FOLDER`).
  - `connection_state` appears in neither ExpertCard.tsx nor ExpertDetailModal.tsx.
  - `onOpenConnections={() => onNavigate("connections")}` appears 2 times in ChatLayout.tsx.
  - No `Preserve Deliverable Tool Floor` / `Additive Tool Floor` / `requiredConnections.includes(c.name)` remains in the studio.
  - The three new suites are named 7 times in the count gate.
  - The card's only `disabled` attribute is the in-flight Start Chat. The other matches are pre-existing docblock prose.
  - ⚠ `grep -rn "not connected" frontend/src/components --include=*.tsx | grep -v __tests__` is **not empty**. It matches 4 pre-existing prose lines in `workflows/DescribeServicePicker.tsx` and `workflows/WorkflowDoorSwitch.tsx`, plus a baseline snapshot, all present at base. None is in `experts/`, `chat/` or `layout/`, and the plan's literal lives only in `expertCatalog.ts` (a `.ts` file).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Modal closed before a promised start could show its in-flight state**
- **Found during:** Task 2
- **Issue:** The shipped modal called `onStartChat(expert)` and then `onOpenChange(false)` synchronously. The page-owned `startBusy` could never be seen in the modal, and the UI-SPEC §5.5 in-flight contract was unreachable.
- **Fix:** When `onStartChat` returns a thenable, the modal closes on settle (success or failure) instead of immediately. A plain callback still closes at once, so the shipped modal case (7) is unchanged. On failure, the page's shipped error alert is visible once the modal closes.
- **Files:** `ExpertDetailModal.tsx`. **Commit:** `f05089bc6`.

**2. [Rule 2 - Correctness] A studio connection row with no `service_id` is not offered**
- **Found during:** Task 3
- **Issue:** A chip with no service id would have to store the name again, or an empty string. The resolver can match neither (the D-267-30 defect in a new form).
- **Fix:** Rows without a non-blank `service_id` are filtered out of the options. A saved id no loaded row matches is still rendered as its own selected chip, so it is never dropped.
- **Files:** `ExpertAuthoringStudio.tsx`. **Commit:** `821f58a78`.

**3. [Scope note] The `inviteGate` connection arm reaches `InviteExpertDialog` now**
- `inviteGate` returns `Requires … — not connected` once the install is ready or absent. The shipped dialog renders any non-null gate as its italic reason line with no invite control, so its behaviour is already blocked-with-reason. 267-04 replaces it with the full R3 row (ledger + Connect/ask). The invite suites stay green.

Also noted: the card keeps the shipped envelope when every connection is connected, and it still labels connections by their stored slug. The plan's characterization case requires "unchanged from base". Showing server names on the all-connected card is a small follow-up if the operator wants it; `connectionPills` already provides them.

## Threat model

- **T-267-30:** mitigated. Connect renders only when `can_connect === true` (the server fact) AND a door prop is wired. Card (1)/(2)/(4) and modal (17)/(18) cover both roles and the no-door case.
- **T-267-31:** mitigated. Only `expertCatalog.ts` reads `connection_state` / `can_connect`, and the grep fence returns nothing for the card and the modal.
- **T-267-32:** mitigated. Page `startingRef` + `startingId`. The double click was driven RED on base (`2 calls`).
- **T-267-33:** mitigated. The picker stores `service_id`, and the saved body is asserted.
- **T-267-34:** mitigated. `grep -rn dangerouslySetInnerHTML frontend/src/components/experts` returns nothing, and every server name is a React text child.

No new network endpoint, auth path or schema change was introduced.

## Re-derived ledger triples (for 267-05; this plan wrote no ledger row)

Derived from git at `821f58a78` with the CLAUDE.md recipe (6-digit quick-task buckets excluded):

| File | commits / phases / lines |
|---|---|
| `frontend/src/components/experts/catalog/expertCatalog.ts` | 6 / 3 / 368 |
| `frontend/src/components/experts/ScopeLedger.tsx` | 1 / 1 / 102 (created here) |
| `frontend/src/components/experts/catalog/ExpertCard.tsx` | 3 / 3 / 295 |
| `frontend/src/components/experts/catalog/ExpertDetailModal.tsx` | 4 / 3 / 530 |
| `frontend/src/components/experts/catalog/ExpertCatalogPage.tsx` | 7 / 4 / 359 |
| `frontend/src/components/experts/ExpertAuthoringStudio.tsx` | 6 / 3 / 1550 |
| `frontend/src/lib/api/experts.ts` | 8 / 5 / 378 |
| `frontend/src/types/index.ts` | 92 / 72 / 1440 |
| `frontend/src/components/layout/ChatLayout.tsx` | 57 / 29 / 1105 |
| `scripts/vitest-count-gate.cjs` | 253 / 57 / 6143 |

G-5 was honoured by construction on every firing row:
- ChatLayout: ONE prop and a comment.
- types: TWO optional fields via `import type`.
- The catalog: one new selector arm, two optional props, and one page-owned guard. There is no new top-level control and no new nav entry.
- ExpertAuthoringStudio (now 3 phases): two removals and a re-keyed picker.

## Known Stubs

None. Every new state renders from the server overlay. `connectionLedgerColumns(…, "dialog")` exists for 267-04 and is covered by tests here.

## Self-Check: PASSED

- All four created files exist on disk: `ScopeLedger.tsx`, `ScopeLedger.test.tsx`, `ExpertCard.connection.test.tsx` and `ChatLayout.startChat.test.tsx`.
- All six commits are present in `git log e1ba56bc5..HEAD`: `730c84d10`, `7f29330ea`, `ed137c8ae`, `f05089bc6`, `36d326319` and `821f58a78`.
- STATE.md, ROADMAP.md, docs/HOT-FILE-LEDGER.md and CLAUDE.md are untouched by this plan.
