---
phase: 280-in-once-out-clean
plan: 02
subsystem: sources / microsoft-graph adapter
tags: [microsoft-graph, onedrive, url-encoding, pagination, input-validation]
requires: []
provides:
  - "_item_segment(id) helper: client-supplied Graph item ids cannot shape the request path"
  - "measured RED/GREEN proof that the three 238 fixes (FIX-03/04/05) and the new D-28 fix bite"
  - "Team Docs folder (105 unique files) + manifest outside the repo, input for plan 04's live drive"
affects:
  - backend/app/services/sources/adapters/microsoft_graph.py
tech-stack:
  added: []
  patterns:
    - "assert URL properties AFTER httpx.URL normalisation, never on the raw string"
    - "plant / run pin / byte-restore with sha256 check (never git checkout under autocrlf)"
key-files:
  created:
    - backend/tests/unit/services/sources/test_280_graph_ids_cannot_shape_the_path.py
  modified:
    - backend/app/services/sources/adapters/microsoft_graph.py
decisions:
  - "For a FOLDER id, '' stays a declared virtual-root id (VIRTUAL_ROOT_IDS) and lists the drive root; only '.' and '..' are refused there. For a FILE id, None/''/'.'/'..' are all refused."
  - "read_file refuses a path-syntax id before the token refresh, so a refused id costs no network at all."
  - "The 'a&$top=999' hostile row is kept but is green at base: '&' inside a path segment is not URL syntax. Recorded as a control row, not claimed as a RED."
metrics:
  duration: "~8 min (13:36Z to 13:44Z)"
  completed: 2026-10-14
  tasks: 2
  files: 2
---

# Phase 280 Plan 02: Graph ids cannot shape the path. The 238 pins were re-driven RED and back to GREEN.

A module-level `_item_segment(id)` now handles every client-supplied OneDrive item id before it reaches `_children_url` or `read_file`. It refuses `None`, empty, `.` and `..`, and otherwise returns `quote(id, safe="!")`. A hostile id can no longer change the Graph endpoint, open a query string, or truncate the request at a fragment. Each of the three already-shipped 238 fixes and the new fix was planted back in, watched to fail its pin, and restored sha256-identical. The 105-file `Team Docs` folder for plan 04 exists outside the repo.

## Task 1: `_item_segment` (FIX-04 / D-28) and the stale comment (D-17)

**RED** `67d5d9414`: 15 failed and 8 passed at base `2dd80abbe`. The failures were the intended assertions, not harness errors:
- `test_a_hostile_folder_id_cannot_change_the_children_endpoint` × 3. `x/../../drives/D1/root` was collapsed to `/v1.0/me/drive/drives/D1/root/children`. `x?$expand=children&a=` produced the query `$expand=children&a=/children`. `a#frag` produced the fragment `frag/children`.
- `test_a_hostile_folder_id_cannot_change_the_BROWSE_endpoint` × 3. These are the same three cases through `browse`, the folder-picker door.
- `test_a_hostile_file_id_cannot_change_the_metadata_endpoint` × 3. These are the same three cases through `read_file`.
- `test_a_dot_segment_folder_id_is_REFUSED_and_never_issued[.]` and `[..]` (DID NOT RAISE).
- `test_an_empty_or_dot_segment_file_id_is_REFUSED_and_never_issued[]`, `[.]` and `[..]` (DID NOT RAISE).
- `test_a_None_id_is_REFUSED_rather_than_formatted_as_the_string_None`. This one failed on an ImportError because the helper did not exist yet.
- The 8 passes at base:
  - the `a&$top=999` row × 3 (a control row; inert inside a path segment);
  - the `ABC123!105` positive control;
  - 4 virtual-root controls.

**GREEN** `b6073107c`. The adapter changed by one private helper, two call sites and one comment correction:
- `_children_url` uses the helper on its non-virtual branch: `items/{_item_segment(folder_id)}/children`.
- `read_file` computes `item_segment = _item_segment(file_id)` before `_get_auth_token`, and the metadata URL uses it.
- The `f"file_{file_id}"` display fallback is untouched.
- The cursor-prefix refusal in `_get_page` is byte-identical (A3). The diff against base has no `-` line inside the `if page_token is not None:` block.
- D-17: the stale WR-01 comment said the search term "rides HERE, in a params VALUE". It is kept, and a `⚠ CORRECTED (Phase 280, D-17)` note sits beside it. The note says the term is percent-encoded into the OData `search(q='…')` function in the URL path. It also records the measured fact that `extra_params` has no caller today.

Verify: the 280 + 238_04/05/06 suites gave **47 passed**. The 238_05 + 238_06 pins alone gave **17 passed** (unchanged), and the whole `tests/unit/services/sources/` suite gave **372 passed**. The other Graph-touching suites, `test_244_08_cloud_read_is_bounded.py` and `test_247_source_paths.py`, gave **15 passed**.

Acceptance:
- `grep -c "_item_segment("` returns 3.
- `grep 'items/{folder_id}\|items/{file_id}'` returns nothing.
- `grep "CORRECTED (Phase 280, D-17)"` returns 1 line.

## Task 2: Measure-first re-drive (SC#2)

The driver is `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/redrive_238_pins.py`, and its log is `redrive_238_pins.log` in the same folder. The snapshot `microsoft_graph.py.orig` was taken at the Task 1 commit, with sha256 `2c5a537b6b223319fc06a79f2102580ef206f6d71468ecdbd2233a9f351217df` (CRLF working copy). After every plant the driver byte-copied the snapshot back and asserted the hash.

| # | Planted defect | Pin RED (failing tests observed) | GREEN on restore | Restored sha256 == .orig |
|---|---|---|---|---|
| 1 | **FIX-03**: an unrecognised cursor falls through to page-1 params instead of raising | 3 failed / 3 passed. `test_an_unrecognised_cursor_is_REFUSED_and_never_silently_restarts[beta base]`, `[bare $skiptoken]`, and `test_the_refusal_names_the_cursor_without_dumping_the_whole_token` | 6 passed | ✅ `2c5a537b…17df` |
| 2 | **FIX-04**: search term raw (`safe = query.replace("'", "''")`) | 5 failed / 6 passed. `test_a_hostile_search_term_cannot_change_the_request_URL` × 4 (all hostile rows), and `test_the_search_term_is_transmitted_and_is_ENCODED_wherever_it_rides` | 11 passed | ✅ `2c5a537b…17df` |
| 3 | **FIX-05**: `_folder_path` returns the still-encoded path (no `unquote`) | 2 failed / 9 passed. `test_a_percent_encoded_folder_path_is_DECODED_so_a_rule_can_match`, `test_the_composed_file_path_is_ONE_encoding_end_to_end` | 11 passed | ✅ `2c5a537b…17df` |
| 4 | **D-28** (`_children_url`): raw `{folder_id}` | 8 failed / 15 passed. children-endpoint × 3, BROWSE-endpoint × 3, dot-segment folder refusal `[.]` and `[..]` | 23 passed | ✅ `2c5a537b…17df` |
| 4b | **D-28** (`read_file`): `item_segment = file_id` *(added beyond the plan, so both call sites are proven)* | 6 failed / 17 passed. metadata-endpoint × 3, and the empty/dot file refusal `[]`, `[.]`, `[..]` | 23 passed | ✅ `2c5a537b…17df` |

After the final restore, `git status --short` is empty and `git diff --stat b6073107c -- …/microsoft_graph.py` is empty.

## Task 2: The `Team Docs` folder (D-14 as corrected by D-27)

- Generator: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/make_team_docs.py`. It was run with `backend/venv/Scripts/python.exe -I`.
- Folder: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/Team Docs/`
  - **95 top-level files**: `team-note-001.txt` to `team-note-094.txt`, plus `Q3 report draft.txt` (the name with a space).
  - `Q3 Plans/` holds **10 files**, `q3-plan-01.txt` to `q3-plan-10.txt`.
  - `ls | wc -l` returns 96 for `Team Docs` (95 files plus the `Q3 Plans` folder) and 10 for `Q3 Plans`.
- Manifest: `C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/manifest.json`. It has 105 entries (path, sha256, size) with **105 unique sha256 values**. Every file carries its own name, an index and a fresh uuid4, so content-hash dedup cannot lower the count. The plan's check printed `manifest ok`.
- There is no page-size knob and no shipped config was touched. The folder is outside the repo tree, and `git status` shows nothing generated.

Task 2 has **no in-repo commit**: by the plan's design it changes no committed source. Its evidence is the table above, the log and the manifest.

## Deviations from Plan

**1. [Rule 1: spec conflict] `""` as a FOLDER id is not refused.**
- **Found during:** Task 1 (RED authoring).
- **Issue:** `<behavior>` said `""` passed as folder_id should raise. But `""` is a declared virtual-root id (`VIRTUAL_ROOT_IDS`) that lists `/me/drive/root/children`, and `browse("")` returns the root with no HTTP call. The same `<behavior>` also requires that "a virtual root id still issues `/me/drive/root/children`", so the two requirements contradict each other.
- **Fix:** I kept the shipped virtual-root contract. The folder refusal table is `.` and `..`, and a positive control pins `""` → root. The file-id refusal covers `""`, `.`, `..` and `None` as planned.
- **Commit:** `67d5d9414` / `b6073107c`.

**2. [Scope addition] Plant 4b (`read_file` call site).** The plan planted D-28 only in `_children_url`. With that plant alone, the `read_file` pins stayed green. That is correct, but it means the read_file pins had not yet been shown to fail on their own. A fifth plant proved them; there is no source change.

**3. Not every hostile row is RED at base.** `a&$top=999` passes at base for folder ids and file ids alike, because `&` inside a path segment is literal and not URL syntax. I kept it as a control row and record it here rather than claiming it as RED. The plan's literal statement "the hostile … cases must FAIL at HEAD" holds for 3 of its 4 rows.

## Not done here (owned elsewhere)

- **Hot-file ledger row.** `docs/HOT-FILE-LEDGER.md` carries a stale row for `microsoft_graph.py` (`3 / 2 / 376`, "no (2 phases)"). The plan says the file now FIRES at 4 phases. This plan's `files_modified` does not include the ledger or CLAUDE.md, so the row refresh is left to the orchestrator or a docs plan. The verdict to record is **honoured by construction (280-02: ONE private helper + two call sites + one comment correction)**. `node scripts/check-hot-file-ledger.cjs .planning/phases/280-in-once-out-clean` reports `ledger gate OK`.
- **Full backend baseline gate** (`check-backend-unit-baseline.cjs`). Per G-8 the full gate runs once per wave, by the orchestrator. Plan 01 runs concurrently in this wave, and the gate wants the local-DB lock. Only the targeted suites were run here.
- **`graphify update .`** was not run inside the worktree; it is left for after the merge.

## Threat Flags

None. No new endpoint, auth path or schema was added. T-280-08 is mitigated, and T-280-09 and T-280-10 are re-proven by plants 1 and 2. T-280-11 (user-supplied browse `page_token`) stays an accepted residual, and the cursor check was deliberately not tightened (A3).

## Known Stubs

None.

## TDD Gate Compliance

- RED `test(280-02)` `67d5d9414` was committed before GREEN `fix(280-02)` `b6073107c`. The GREEN commit type is `fix` rather than `feat`, because this closes a defect class. No refactor commit was needed.

## Self-Check: PASSED

- FOUND: backend/tests/unit/services/sources/test_280_graph_ids_cannot_shape_the_path.py
- FOUND: backend/app/services/sources/adapters/microsoft_graph.py (`def _item_segment`)
- FOUND: commits 67d5d9414, b6073107c
- FOUND: C:/Users/fhdmr/AppData/Local/Temp/agentic-rag-280/Team Docs (95 + 10), manifest.json (105 / 105 unique)
