# Phase 271 — UAT log (plan 271-05)

Driven 2026-10-03 on the MAIN working tree (`develop`, merged HEAD `18c4a30ae` plus 271-05's commits)
against LOCAL services only: Supabase :54321 / :54322, the backend already serving :8000 (uvicorn
`--reload`, started earlier by the operator; an unauthenticated `POST /document-search` answered 403,
so the merged route is mounted), Vite :5173 (`/app.html`). No production read or write was made.

⚠ **How the browser rows were driven.** No Chrome MCP / chrome-devtools tool was available to this
executor, so G4-1..G4-6 were driven in a **real Chromium** (Playwright 1.60, `chromium-1223`, headless,
1600×1000, dark scheme) by scripted clicks and typing, reading the rendered DOM text **at rest**. That is
a substitution for the planned Chrome MCP drive and is named here rather than hidden. Typing used
`pressSequentially` (key events), not a value setter.

⚠ **Who drove them.** A dedicated GoTrue user `g4-271-133d1a64@test.local`, in its OWN personal org
(one membership, proven from `org_members`), so the dev account's two-org ambiguity cannot make an
absence vacuous. Its rows were **seeded by SQL into the local DB** (not through the UI or the API): 8
documents (5 for G4-1, a Lease 2021 / Lease 2024 v1+v2 lineage for G4-2/G4-5, `source_created_at` on some
and not others for G4-6), one `supersedes` edge recorded on Lease 2024 **v1**, the connection
"Drive Finance", an enabled custom field `matter`, the rule "Invoices to Contracts", and an older thread
"Earlier chat about leases". Everything is deleted at the end (see Cleanup).

## Gates (merged tree)

| Gate | Result |
|---|---|
| Backend unit (`pytest tests/unit -q --continue-on-collection-errors -rf`, the canonical command plus `-rf`) | `71 failed, 6234 passed, 1 skipped, 2 xfailed, 2 xpassed` in 8:16, **0 collection errors**. Failed SET diffed node by node against `271-BASELINES.md` §(a): **identical, 71 = 71, new: none, gone: none** (one line read differently only because a `RuntimeWarning` was printed onto the same line as `test_rejects_insert_query`). Passed 6092 → 6234 = the 142 new 271 unit cases. At the ceiling, zero headroom, not above it. |
| Vitest count gate (`GSD_VITEST_MAX_WORKERS=2`, repo root) | **RED**: run 2 (quiet box, after the inherited-timeout fix) `total 9420 · failed 4 · pinned total 8659`, the 4 in two provably unmodified suites red at the base. Full triage in "Vitest verdict" at the foot of this file |
| `tsc -p tsconfig.app.json --noEmit` (frontend) | **70 errors = base 70.** Set diff vs `271-BASELINES.md` §(c): the only differences are line shifts of base errors with the same codes (`lib/api.ts` 263/264 → 267/268, `LibraryPage.tsx:50` ×2 → `:58` ×2, TS6133 `TabsList`/`TabsTrigger`). **No new error in any file**, re-measured after 271-05's own fix. |
| `check-hot-file-ledger.cjs 271-find-the-document` | exit 0 — `ledger gate OK — every watched file has a row.` (375 rows, 78 subject files, 35 watched) |
| `check-claude-md-size.cjs` | exit 0 — `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.` (119,524 after the row refresh) |
| `check-seeds-register.cjs` | exit 0 — `seeds register gate OK — 337/337 parsed, 0 duplicate ids, 337/337 carry all 5 required keys.` |
| `check-deploy-drift.sh` | exit 0 — `RESULT: PASS — the one-box deploy artifacts are in sync.` (docker compose denied here, structural fallback) |
| Extension contract (`test_259_closed_core_inventory.py`, `test_261_closed_core_inventory.py`, `test_255_extension_contract_guard.py`) | **18 passed**: no tool, executor or emitter added |

## Live proofs (backend, real RLS path)

Every case calls the ROUTE coroutine `app.api.document_search.search` with a supabase-py client built
from the ANON key plus a **GoTrue-issued access token** (the `get_user_supabase` shape, P-04). Seeded rows
carry every org column explicitly and are proven to have landed; everything is deleted in `finally`
(verified after: 0 orgs, users, documents, folders or connections left with the run markers).

| SC / decision | Proof | Result |
|---|---|---|
| SC#5 two-org fence | `test_271_two_org_fence.py` (5 cases). S ∈ {A} only, T ∈ {B} only (non-owner `member`), O = B's owner, asserted from `org_members` BEFORE any search. Same request (`name` = shared marker, `latest`): S gets exactly A's row and never B's; T gets exactly B's (positive control). Relationship target = B's doc: S gets a response **equal** to an ordinary empty answer (no existence oracle); T gets a non-error answer. `older`: S never gets B's v1; O does (control). | **5 passed** |
| SC#5, the RLS wall alone | ⚠ **Measured finding:** swapping the fence's client for the SERVICE-ROLE client (RLS off) still showed S nothing of B, because the core's own legs (`user_id = caller`, the membership-scoped global-folder list) exclude B, so the request alone cannot prove RLS. Added `test_rls_alone_fences_when_the_app_leg_is_widened`: the global-folder leg is forced to name B's folder and the request runs through S's real JWT. Passes; **the identical widened request through the service-role client FAILED with `LEAK: RLS did not stop a widened app leg`** (driven, then restored), so the case is not vacuous. | passed (plant driven red) |
| SC#1 | `test_271_search_live.py`: type + added by + document date + custom field → **exactly the one target** of five rows that each differ in ONE dimension; each dimension alone gives its exact set; no id appears twice | passed |
| Added by | `me` / connection X / `others` → exact sets; the connection's name rides the row | passed |
| SC#3 dates | a `2019-12-31T15:00Z` row is inside "added between 2019-01-01 and 2019-12-31"; `2020-01-01T00:30Z` is outside and is the only row "between 2020-01-01 and 2020-01-01" | passed |
| SC#3 folders | subtree on → F ∪ F2; off → F; `folder_id: null` → exactly the caller's root rows; a colleague's PRIVATE folder → total 0, while its owner finds the row in it (control) | passed |
| D-04 / D-05 | edge `r-a supersedes r-b`: `supersedes`+r-b = {r-a}, `superseded_by`+r-b = {}, `superseded_by`+r-a = {r-b}, `supersedes`+r-a = {}: the pairs differ and the incoming verb is non-empty | passed |
| D-116-1a | edge recorded on bx **v1**; picking bx (v2) still matches; the incoming verb follows the old endpoint to bx v2 with `older_matches` 1 | passed |
| self-lineage | edge `ln-v2 supersedes ln-v1` contributes nothing to Latest in either direction | passed |
| P-02 | edge from an OLDER own version: Latest = {ev-v2}, `older_matches` 1; the same request with `older` returns exactly {ev-v1}, total = `older_matches` | passed |
| D-06 / D-07 / P-05 | three-version lineage: Latest {v3}, Older {v1, v2}, has_earlier {v3}; **the shipped restore route** (`POST /documents/{v2}/restore`, called with the user client) → Latest {v2}, Older {v1, v3}, has_earlier {v2}; delete v1 → has_earlier {} while `version_number` is still 2 (the chevron rule `> 1` would still say yes: P-05's recorded divergence). Latest never held an `is_latest=false` row and Older never an `is_latest=true` row, at every step. | passed |
| RED drive (D-05) | incoming verbs made outgoing-only in `document_search_service.py` → `test_each_verb_pair_differs_on_an_asymmetric_edge` and `test_edge_on_an_old_version_still_matches` FAIL (`superseded_by`+r-b returned {r-a}; the incoming case returned {}); restored, md5 `9c62992a…` identical, `git status` clean | driven |
| SC#4 rules still apply | `test_118_ingest_suggest.py` + `test_118_ingest_real_splice.py` | **4 passed** |
| Resolver extraction | `test_113_view_resolve`, `test_113_view_folder_scope`, `test_114_resolve_adhoc`, `test_114_resolve_range_date`, `test_115_result_shape` | **28 passed** (= 271-01's before and after) |

The plan's verify command (`test_271_two_org_fence.py test_271_search_live.py test_118_ingest_suggest.py
test_118_ingest_real_splice.py -q -rs`) read **`19 passed`**, with **no SKIPPED line** (0 skipped).

Direction note: these tests follow 271-01's executed implementation and the plan's Pattern 3 table
(`<result> <verb> <picked>`): with `p2 references B`, `references`+B = {p2} and `referenced_by`+B = {}.
271-01 recorded why the plan's one contrary behaviour line was internally inconsistent.

## G-4 lived-experience rows (Chromium, rendered text at rest)

| Row | What was done | Observed (at rest) | Evidence | Verdict | Operator |
|---|---|---|---|---|---|
| G4-1 | Find: Document type = Contract, Added by = You, Date in the document between 2019-01-01 and 2019-12-31, `＋ condition` matter is ACME-7; then Sorted by → Date in the document (newest) | the count read **4 → 3 → 2 → 1** as each chip was added; the one row left is `Acme MSA 2019.pdf /Contracts`; no row appeared twice at any step; its visible Type **Contract**, Added by **You**, and with the document-date sort the header reads **Date in the document** and the cell **14 Mar 2019**; four set chips each with a keyboard-reachable ✕; no passage or chunk text rendered | `evidence/g4-1-four-conditions.png`, `evidence/g4-1-sorted-by-document-date.png`, `evidence/g4-1-dom.txt` | **PASS** (copy finding F-1 below) | OWED — operator away at planning; sign-off pending |
| G4-2 | Relationship = Supersedes → Lease 2021; Show them; then Is superseded by → Lease 2021; then Is superseded by → Lease 2024 | Supersedes → `Lease 2024.pdf` (latest) plus the status line **`1 more match in older (superseded) versions.`**; Show them flipped the chip to **`Version: Older versions (superseded)`** and listed the row tagged **`v1 · older version`**; Is superseded by → Lease 2021 = **`0 documents`** with the **No documents match** box (a DIFFERENT set); Is superseded by → Lease 2024 = `Lease 2021.pdf` (incoming non-empty). Contrast, composited: hint warning text on its 10% wash **9.39 : 1** (fg `rgb(247,178,59)` on `rgba(247,178,59,.1)` over `rgb(6,9,15)`); zero count **10.81 : 1** (≥ 4.5 both) | `evidence/g4-2-supersedes-lease-2021.png`, `g4-2-show-them.png`, `g4-2-is-superseded-by-lease-2021.png`, `g4-2-is-superseded-by-lease-2024.png`, `g4-2-dom.txt` | **PASS** | OWED — operator away at planning; sign-off pending |
| G4-3 | Start on Library → Ingestion; open Filing rules from the header; press Back ("Library") | the rail's 13 labelled controls hold **no Classification** (New chat, Chat, Workflows, Library, Connections, Skills, Experts, Organization admin, account menu…); the link is not `role="tab"` and sits right of every tab; the sub-view reads **Filing rules**, never "Classification rules", and lists the seeded rule **Invoices to Contracts**; Back lands on **Ingestion** (the Library tablist's selected tab; the Ingestion body's own inner tablist also reports "Add files") | `evidence/g4-3-ingestion-tab.png`, `g4-3-filing-rules.png`, `g4-3-after-back.png`, `g4-3-dom.txt` | **PASS** | OWED — operator away at planning; sign-off pending |
| G4-4 | Switch to Ask, type a question, press Enter; read the composer at 2.5 s and 5.5 s; return to the Library | Ask showed **Ask is answered in chat** and **no table row** in the Library; Enter sent exactly **one `POST /threads`** and **zero `POST /threads/{id}/messages`**; the DB then held the seeded older thread plus a NEW thread with **0 messages**; the composer held the question at 2.5 s and still at 5.5 s (no draft restore clobbered it); back in the Library the mode is **Find documents** and the file-name input is **empty** | `evidence/g4-4-ask-card.png`, `g4-4-new-chat-prefilled.png`, `g4-4-back-in-find.png`, `g4-4-dom.txt` | **PASS** | OWED — operator away at planning; sign-off pending |
| G4-5 | Supersedes → Lease 2021, Show them, open the **older-version** row; open a chip popover with the panel open; control: open a LATEST row's panel | the panel opens on the v1 row with **`This is an older version (v1). It is version history: fields can only be changed on the latest version.`**; **0** inline edit controls (the same selector finds **8** on a latest row's panel, so the zero is real); with columns shed the name cell still reads `/Contracts/Leases` and `v1 · older version`; the strip collapses to `2 filters` and a chip popover opened from it stays inside the 1600 px viewport | `evidence/g4-5-older-row-panel.png`, `g4-5-popover-with-panel.png`, `g4-5-control-latest-row-panel.png`, `g4-5-dom.txt`, `g4-5-control-dom.txt` | **PASS** (finding F-2 below) | OWED — operator away at planning; sign-off pending |
| G4-6 | Added by = You, then Sorted by → Created in the file (newest) | the date header changed from **Added** to **Created in the file**; rows in the visible column's order: Lease 2024 (Jan 2024), Lease 2021 (Jan 2021), Beta (May 2020), Acme MSA (Mar 2019), then the two rows with no recorded date, both reading **not recorded**, LAST (never interleaved) | `evidence/g4-6-created-in-file.png`, `g4-6-dom.txt` | **PASS** | OWED — operator away at planning; sign-off pending |

The browser's console showed one 404 and four 403 resource errors on every page load for this fresh
org. They were not attributed (the drive recorded requests, not statuses); none blocked a row.

## Findings from the drive

- **F-3 (FIXED in 271-05, re-driven).** After any Find quick-add editor opened, focus stayed on the chip,
  so Esc did nothing; and with the keyboard, Enter opened the editor but Tab moved to the NEXT chip, so 5
  of 6 editors were unreachable (only Version worked, because its dialog follows it in the DOM). The
  shipped tests dispatched Escape on the dialog element directly, which a keyboard cannot do. Fix:
  `StructurePopovers.tsx` `EditorShell` focuses its first enabled control on mount (+8/−2, G-3). A 6-case
  RED test in `FindQuickAdd.test.tsx` failed first (commit `e8752ae92`), passed after (`565b05c41`), and
  the Chromium probe re-drove all six: focus inside, Esc closes, focus back on the chip. Evidence:
  `evidence/finding-esc-dom.txt` (before), `evidence/finding-esc-after-fix-dom.txt` (after).
- **F-4 (inherited, observed, NOT fixed).** The shipped `＋ condition` popover (`ConditionPopover.tsx`)
  behaves the same way after a mouse open: Esc does nothing. Not this phase's code path. Routing: fold
  into the next phase that touches `ConditionPopover.tsx` (it now FIRES G-5), or a `/gsd:fast`.
- **F-1 (open, routed).** In Find, the metadata chips render the shipped field-key text:
  `document_type is Contract`, `date between 2019-01-01 – 2019-12-31`, where UI-SPEC S6 asks for
  `Document type is Contract` / a dated "Date in the document" sentence. `＋ Document type` and `＋ Date`
  also stay offered after those dimensions are set (UI-SPEC: a set single-value dimension replaces its ＋;
  271-04 made a second pick REPLACE the first, so no contradiction is ANDed). No G4-1 failure clause
  fires. A fix needs a Find-only label path, because the Views tab's chip DOM is snapshot-pinned.
  Routing: `/gsd:quick` (2 files: `FilterBar.tsx` prop + `FindQuickAdd.tsx`), operator to confirm.
- **F-2 (open, routed).** An older-version Find row still offers **Re-ingest**, **Move to folder** and
  **Delete**. Pressing Re-ingest sent `POST /documents/{v1}/reingest`; the backend refuses (its owner
  read requires `is_latest`), the shipped `DocumentList.handleReingest` sends the error only to
  `console.error`, and **nothing renders**: no toast, no alert; the row's `updated_at` is unchanged. Not
  G4-5's "raw error" clause, but a silent no-op the phase newly exposes (Find is the first surface that
  lists older rows with these actions). Move and Delete were NOT pressed (destructive; not verified).
  Routing: `/gsd:fast` in `DocumentRow.tsx` (hide or disable Re-ingest when `is_latest === false`), or
  surface the refusal; `DocumentRow.tsx` FIRES G-5, so the ledger note rides along. Evidence:
  `evidence/g4-5-older-row-reingest.png`, `evidence/g4-5-extra-dom.txt`.

## Deploy notes

- **No migration, no env var, no seed row** in this phase.
- **Deploy backend and frontend TOGETHER.** A frontend that reaches production before the backend makes
  Find call a route that does not exist yet (404).
- After the deploy: probe `POST /document-search` on production with an operator JWT and body `{}` (a
  READ: 200 means the new backend is up, 404/405 means it is not), and run `get_advisors(security)` as a
  read through the Supabase MCP. Both are reads; no write is needed.
- Operator review owed before or at the deploy: **P-01** (default sort `added_desc`) and **P-03**
  (Older versions = the caller's own rows only), plus sign-off on G4-1..G4-6.

## Cleanup

The live suites delete everything they seed in `finally` (checked after the last run: 0 orgs named
`phase-271-%`, 0 users `phase-271-%`, 0 documents/folders with the run markers, 0 connections). Two
orphan orgs left by my first GoTrue probe (deleting a GoTrue user does not delete its personal org) were
identified by name and deleted; that is why the helper deletes the personal org at creation. The G-4
user, its org and every seeded row were then deleted: 1 edge, 1 rule, 3 threads (the seeded older
thread plus one NEW thread from each of the two G4-4 runs) with **0 messages** between them, which
independently confirms neither Ask run sent anything, 8 documents, 2 folders, 1 field, 1 connection, the
GoTrue user and its org. Verified after: 0 of each.

## Vitest verdict

**RED both times. Not `count gate OK`.** Recorded faithfully, with the triage the CLAUDE.md rule asks
for (filenames from the gate's own persisted JSON BEFORE any re-run, each checked against
`git diff --numstat 20050816d HEAD` and `git status`).

**Run 1** (merged tree + 271-05's Task 1 and focus fix; `GSD_VITEST_MAX_WORKERS=2`). ⚠ Not a quiet box:
partway through it I created a throwaway worktree (a 10,018-file checkout) for the base comparison
below, and ~50 node processes were on the machine. Verdict, verbatim:

```
  total                                      8659    9420    +761
  total 9420  ·  failed 30  ·  pinned total 8659
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 30 test(s) failed — the gate requires 0.
```

Failing files (`vitest-count-gate-45332-1790991259471.json`): `WorkflowBuilderPage.canvas.test.tsx` 8,
`PhaseNode.test.tsx` 2, `PublishGauntlet.test.tsx` 2, `SettingsPage.changedFields.test.tsx` 1 (all four
**provably unmodified**: no diff in the files or in `components/workflows`, `WorkflowBuilderPage.tsx`,
`SettingsPage.tsx`; three of the four were red at the phase base), `LibraryPage.test.tsx` 9,
`sketchComposition.test.tsx` 6, `LibraryPage.find271.test.tsx` 2 (the LibraryPage-mounting family; every
one a `STACK_TRACE_ERROR` 5 s timeout or the leaked-first-render "multiple elements" follow-on).

**Settling the carry-forward question (is `sketchComposition` inherited?).** A bootstrapped worktree at
the phase base `20050816d` (byte-identical base tree; created with `bootstrap-worktree.sh`, removed with
`teardown-worktree.sh`, source venv and node_modules intact), and the main tree at HEAD, each ran
`sketchComposition.test.tsx` + `LibraryPage.test.tsx` alone at `--maxWorkers=2`, twice:

| tree | run 1 | run 2 |
|---|---|---|
| BASE `20050816d` | 4 failed / 59 passed (first cases, 5 s timeouts) | 5 failed / 58 passed |
| HEAD (before the fix) | 4 failed / 59 passed | 0 failed / 63 passed |

The first-case timeout **reproduces at the phase base on 2 of 2 runs** (the base's first run had a cold
transform cache; its second, warm, run failed too), so it is **inherited** load cost of the first dynamic
`await import("@/pages/LibraryPage")`, not a 271 regression. **Fast fix** (commit `84a958e32`, test files
only, +5 lines each, case bodies unchanged): one module-level `beforeAll` warms the module once with a
30 s budget. After: **3 of 3 runs green** (63 passed, 1 skipped). `LibraryPage.find271.test.tsx` (the
phase's own suite, static import) passed **13/13 twice** alone; its gate red is recorded as a load
observation, never as "fine".

**Run 2** (after the fix, quiet box: no browser, no worktree, no other test run of mine). Verdict,
verbatim:

```
  total                                      8659    9420    +761
  total 9420  ·  failed 4  ·  pinned total 8659
RESULT: COUNT GATE VIOLATED (1 reason(s))
  FAIL  [failing-tests] 4 test(s) failed — the gate requires 0.
```

Failing files (`vitest-count-gate-52876-1790992976220.json`): `src/pages/WorkflowsPage.test.tsx` 2
(`STACK_TRACE_ERROR`; one of SEED-171's named flaky suites; 11 red at the phase base) and
`src/components/workflows/PublishGauntlet.test.tsx` 2 (one `STACK_TRACE_ERROR`, one
`Unable to find … button "run the checks"`; 14 red at the phase base). Both **provably unmodified**:
0 diff lines in the files, in `WorkflowsPage.tsx` and in `components/workflows/`, clean status.
No LibraryPage-family suite failed in run 2.

Counts: grand total 9420 (wave 2 read 9414; +6 = the new `FindQuickAdd` focus cases), pinned 8659
unchanged, no pinned file decreased, all pinned files present. `FindQuickAdd.test.tsx` is pinned at 12
and runs 18 (an under-pin, never a decrease; `vitest-count-gate.cjs` is not 271-05's file under P-11).
The five unpinned suites (`PromptVariableChips`, `RunHero`, `automationFacts`, `nodeEffectBanner`,
`toolReadOnlyMap`) are pre-existing at the base, not 271's.
