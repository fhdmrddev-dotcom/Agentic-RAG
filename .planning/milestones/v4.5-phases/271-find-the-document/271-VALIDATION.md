---
phase: 271
slug: find-the-document
status: planned
nyquist_validation: false
created: 2026-10-03
note: >
  Informational. config.json has nyquist_validation off, so this file does not drive a sampling
  gate. It exists because CLAUDE.md requires G-4 / UAT rows to live in a VALIDATION note, never in
  PLAN.md tasks that need a human. The operator was AWAY when 271 was planned: every row that
  needs the operator is marked OWED, never assumed.
---

# Phase 271 — Validation map (SC → proof) and lived-experience UAT rows

## Planning decisions the operator has not yet seen (review on return)

| Id | Decision | Why | How to override |
|---|---|---|---|
| P-01 | Default sort is **Added to Agentic RAG (newest)** (`added_desc`), not CONTEXT specifics' "Modified (newest)". "Last modified in the file (newest)" is offered as an option. | UI-SPEC §Deviations (approved): `source_modified_at` is NULL on every pre-270 row, so a default on it sinks most of the library into one unordered tail; "Modified" alone is ambiguous under 270's labelled dates. | Change `DEFAULT_SORT` in `frontend/src/pages/findState.ts` and the `sort` default in `backend/app/models/document_search.py`; both are pinned by one test each. |
| P-02 | Relationship semantics (RESEARCH A2 / Pattern 3): the picked document is matched by lineage (`_subject_version_ids`); for Latest / Has earlier each matched endpoint follows to its lineage's latest row and the picked document's own lineage is excluded; for Older versions the rows are matched row-exact; `older_matches` = non-latest endpoints that pass every other filter. Invariant: **Show them yields exactly `older_matches` rows.** | Reproduces the approved sketch's worked example and agrees with the Phase 117 panel (an edge recorded on an old version still counts, D-116-1a). | Re-plan the relationship step in `document_search_service.py`. |
| P-03 | **Older versions (superseded)** lists the caller's OWN older rows only (`user_id = caller`). Latest and Has earlier use both visibility legs (own ∪ org-shared folder). `older_matches` counts own rows only. | The conservative, RLS-safe reading of RESEARCH A3: two shipped modules (`list_document_versions`, `_resolve_readable_latest` IN-01) treat a colleague's old versions as not independently readable. Find does not expose more version history than the version-history UI does. | Re-open when the operator wants colleagues' version history findable; that needs an org-level version-history readability decision first. |
| P-04 | The two-org fence (SC#5) runs against **real PostgREST at :54321 with GoTrue-issued user JWTs** (admin create user → sign in → anon-key client with the Bearer token, the `get_user_supabase` shape), not an extended `_reembed_adapter`. | The stronger proof of "the real RLS path" (RESEARCH Pitfall 8); the adapter does not speak `in_`/`ilike`/`is_`/`range`/`count`. | — |
| P-05 | `has_earlier` uses the lineage definition server-side; the shipped chevron (`DocumentRow.hasVersions`, `version_number > 1`) is NOT changed; the divergence is recorded. | RESEARCH Open Question 3. | — |
| P-06 | In Find, `＋ condition` hides `name`, `type`, `size` (WATCH_FIELDS the resolver rejects with 422); the Views tab and the rule builder are unchanged. A 422 renders the S7 error state, never a list swap. | RESEARCH Pitfall 1 (pre-existing defect Find would inherit). | — |
| P-07 | `ClassificationRulesPage` gets ONE shape (no `embedded` flag): the outer `p-8` and the old `h1` are dropped and it renders the sub-view header itself (Back "Library" when `onBack` is given, title "Filing rules", the shipped subtitle, New rule). | The top-level ChatLayout mount is retired in the same phase, so a non-embedded arm would be dead code. | — |
| P-08 | The Ask handoff is a dependency-injected helper `askInChat.ts` (create thread → set prefill → navigate; a failed create navigates nowhere; never sends). | The shipped `handleTryInChat` does not create a thread; copying it is G-4 #4's failure. The `startScopedChat.ts` precedent makes the ORDER unit-testable. | — |
| P-09 | The server returns `version_count` and `has_earlier` per row; the folder path on the name cell is computed client-side with the shipped `folderPathOf` (scopeCopy.ts). | One batched lineage read already exists for has_earlier; the folders list is already on the page. | — |
| P-10 | "Date in the document" and Document type write into the shared `lib.filter` (the shipped compiler, `date_typed` / `document_type_norm`); "Added to Agentic RAG", "Created in the file" and "Last modified in the file" are structure conditions with timestamptz day-boundary semantics (`before d` → `< d`, `after d` → `>= d+1`, `between a b` → `>= a` and `< b+1`). | CONTEXT: reuse the shipped compiler and typed columns before adding any; RESEARCH Pitfall 3. | — |
| P-11 | `scripts/vitest-count-gate.cjs` is edited only by 271-03 (wave 1) and 271-04 (wave 2), which adopts 271-02's suites; ledger rows were added at planning and only 271-05 refreshes triples. | Parallel worktrees must not share a file. | — |
| P-12 | CLAUDE.md G-5-FIRING rows for 271's files are added at close ONLY while CLAUDE.md stays under the 120,000-char warn band (119,307 at planning). Otherwise the ledger carries them and the CLAUDE.md split is flagged as scheduled. | CLAUDE.md context-budget rule. | — |

## Success criterion → proof

| SC | Requirement | Automated proof (plan) | Live proof (271-05) |
|---|---|---|---|
| SC#1 type + owner + date range + custom field, no phrase, one row per document | FIND-01 | `test_271_search_core.py` (each applier's exact builder calls, RED drive per applier) — 271-01; `DocumentsFindBody` / LibraryPage Find suites — 271-04 | `test_271_search_live.py`: seeded rows differing in one dimension each, exact id SETS; `len(ids) == len(set(ids))` |
| SC#2 two labelled modes, no embedding call, stated field sort, no merge | FIND-02 | `test_271_no_embedding.py` (raising patch + inertness control + source fence) and the 6-sort order tests — 271-01; `FindModeSwitch` / `FindMetaLine` / `AskHandoffCard` / `askInChat` suites — 271-02 | G4-4 and G4-6 drives |
| SC#3 folder subtree, relationship both directions, version state, each exact | FIND-03 | relationship + version unit tests — 271-01; verb table pinned to backend `_INVERSE_LABEL` — 271-03 | live: subtree on/off, Not in a folder, unreachable folder → 0; each verb pair returns DIFFERENT sets on an asymmetric edge; edge on an old version still matches; self-lineage excluded; `older_matches` == rows after Show them; Latest never contains `is_latest=false`; Older never contains `is_latest=true`; `has_earlier` correct after a delete and after a restore |
| SC#4 Classification gone from the rail, Filing rules inside the Library, every rule loads and applies | FIND-06 | `activeViewReachability.test.ts`, re-pinned `nav-items.test.ts`, `LibraryHeaderBar` + `LibraryPage.filingRules271` + `ClassificationRulesPage` suites — 271-02 | `tests/integration/test_118_ingest_suggest.py` + `test_118_ingest_real_splice.py` re-run on the merged tree; G4-3 drive |
| SC#5 two-org fence on the real RLS path | FIND-01 | — | `test_271_two_org_fence.py` (P-04): single-org subject S sees 0 of org B; positive control T sees B's row through the same call; S sees its own org-A row; membership asserted from `org_members` first |

⚠ A skipped live suite is a SKIP, never a pass. 271-05 must quote pytest's `-rs` line showing 0 skipped for both live files, or record the suite as OWED with the reason.

## G-4 lived-experience rows (UI-SPEC §G-4)

Driven by Claude in a real browser (Chrome MCP / chrome-devtools) at 271-05, with rendered text asserted at rest and evidence saved under `evidence/`. **Operator sign-off is OWED for every row** (the operator was away at planning); a row Claude cannot drive is recorded ⛔ with the reason, never dropped.

| Row | Scenario | Failure the row exists to catch | Driven by | Operator |
|---|---|---|---|---|
| G4-1 | Find a 2019 contract without a phrase: Document type = Contract, Added by = You, Date in the document between 1 Jan 2019 and 31 Dec 2019, one custom field | passages appear; a document twice; a chip set and the count unchanged; a row's visible Type / Added by / Date contradicts a chip | Claude (271-05) | OWED |
| G4-2 | "What supersedes X": Relationship = Supersedes → X, then Is superseded by → X | both verbs return the same set; the hit is an older row that vanishes with no hint; Show them flips the version without the chip saying so | Claude (271-05) | OWED |
| G4-3 | Start on Library Ingestion, find and open Filing rules, press Back | the rail still offers Classification; the link reads as a sixth tab; Back lands on Documents; any page reads "Classification rules"; an existing rule is missing | Claude (271-05) | OWED |
| G4-4 | Ask leaves the Library: type a question in Ask, press Enter | a list or passage renders in the Library; chat opens in the OLD thread; the question is sent automatically; back in Find the question shows as a file-name filter; a draft restore clobbers the prefill (RESEARCH A5) | Claude (271-05) | OWED |
| G4-5 | Open the detail panel from a Find row, including an older-version row | the panel does not open for an older row; the folder/version line disappears when columns shed; a chip popover opens off-screen; an edit on an older row shows a raw error | Claude (271-05) | OWED |
| G4-6 | Change Sorted by to Created in the file (newest) | the date column header does not change; rows with no recorded date are interleaved instead of last; the order matches no visible column | Claude (271-05) | OWED |

## Cross-provider scoreboard

Not applicable: this phase touches no streaming, agent loop or provider routing. Ask only pre-fills
the composer in a new thread; the person presses Send under the existing chat path.
