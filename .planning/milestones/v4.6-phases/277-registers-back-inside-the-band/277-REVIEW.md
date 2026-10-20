---
phase: 277-registers-back-inside-the-band
reviewed: 2026-10-12T19:21:04Z
depth: standard
files_reviewed: 5
files_reviewed_list:
  - scripts/check-claude-md-size.cjs
  - .claude/hooks/claude-md-size-guard.js
  - CLAUDE.md
  - docs/VITEST-COUNT-GATE.md
  - docs/HOT-FILE-LEDGER.md
findings:
  critical: 0
  warning: 8
  info: 5
  total: 13
status: issues_found
---

# Phase 277: Code Review Report

**Reviewed:** 2026-10-12T19:21:04Z
**Depth:** standard
**Files Reviewed:** 5
**Status:** issues_found

## Narrative Findings (AI reviewer)

## Summary

The phase's headline claims hold up when measured independently:

- `node scripts/check-claude-md-size.cjs` → `CLAUDE.md 89171 chars [OK]`, exit 0.
- The FIRING table has 202 rows. Path and triple cells are byte-identical to base `11f73d932` (202/202), and 137 verdicts changed. The re-derived count line (`202 rows`, `172` at ≥3 phases, `30` below) matches the table.
- An independent no-loss check found 0 lost lines. All 307 removed non-table CLAUDE.md lines appear as exact whole lines in `docs/VITEST-COUNT-GATE.md` or `docs/HOT-FILE-LEDGER.md`. The ledger diff is purely additive.
- The gate binds the full 516-row scan list, and its header matches exactly once.
- Every `docs/`, `.planning/` and `scripts/` pointer in CLAUDE.md resolves. The pointers to `§"Scan list"`, `## Parallel execution …` and `SEED-171` exist.

Adversarial drives exposed real weaknesses in the guards, though. They ran against copies in the scratchpad (`r277/`, its own `git init`), and the tracked tree was never modified (`git status --short -- CLAUDE.md docs scripts .claude/hooks` is empty). Drive script: `scratchpad/drive.cjs`.

| Plant | gate | hook | Verdict |
|---|---|---|---|
| A: FIRING row with an un-backticked path cell, 300-char verdict | exit 0, OK | silent | **VACUOUS** |
| B: `## ` heading inserted after row 150; rows 151-202 get 300-char verdicts (+13.4k chars) | exit 0, OK | silent | **VACUOUS** |
| C: last FIRING row indented one space, 300-char verdict | exit 0, OK | silent | **VACUOUS** |
| D: FIRING *triple* cell stuffed with 300 chars | exit 0, OK | silent | **VACUOUS** |
| E: scan-list header renamed (`Disposition.`), plus a 300-char cell | exit 0, OK | n/a | **VACUOUS** |
| F: blank line after scan-list row 10, plus a 300-char cell at row 400 | exit 0, OK | n/a | **VACUOUS** |
| G (control): 300-char scan-list cell only | exit 1 `[disposition-too-long] … (cap 200)` | silent | fires (gate only) |
| H: CLAUDE.md padded to 159,234 chars AND one 81-char verdict | exit 1 | reports **only** `[disposition-too-long]`, no STOP | **hook hides the trip** |
| I (control): padded to 159,182 only | exit 1 | `STOP — … WILL NOT LOAD` | fires |
| J: `--json` with the FIRING header renamed | **exit 0**, no structural output | fires | `--json` blind |

None of these break what ships today. Each is a way the guard can go blind again, and that is the defect class this phase exists to close. There are no BLOCKERs: the size budget and the cap bind correctly on the current tree.

## Warnings

### WR-01: The hook suppresses the "WILL NOT LOAD" STOP whenever any structural finding exists

**File:** `.claude/hooks/claude-md-size-guard.js:149-174`
**Issue:** When `structural.length` is non-zero, the hook writes only the ledger message and `process.exit(0)`. It never reaches the `over` / `pct` branch at 176-226. Drive H: with CLAUDE.md at **159,234 chars** (over the hard limit) and a single 81-char verdict, the hook's `additionalContext` is just `HOT-FILE LEDGER — 1 structural problem(s) … [disposition-too-long] line 410 81 chars (cap 80)`. It carries no `STOP`, no `claude_md_over_limit`, and no char count in the text. Control I (padding only) does print `STOP — … It WILL NOT LOAD`. CLAUDE.md calls this hook "the primary guard". Phase 277 tightened the cap from 200 to 80 and added the floor and truncation checks, which makes structural findings far more likely to coexist with a size trip. In that case the in-turn guard reports a cell-length nit and hides the one condition that silently drops every instruction. The gate (exit 1) still catches it, but only when someone runs it.
**Fix:** Build one `additionalContext` that leads with the size verdict whenever `chars >= WARN_LIMIT`, then append the structural block:
```js
const sizeLines = chars >= WARN_LIMIT ? [ over ? `STOP — ${filePath} is ${chars} chars … WILL NOT LOAD.` : `WARNING — …`, … ] : [];
const ctx = [...sizeLines, ...(structural.length ? [`HOT-FILE LEDGER — …`, ...structural] : [])].join('\n');
// emit once, with claude_md_over_limit and ledger_structural_problems both set
```

### WR-02: Rows the parser can't recognise are skipped silently, so no cap, duplicate or malformed check applies

**File:** `scripts/check-claude-md-size.cjs:216-220`, `.claude/hooks/claude-md-size-guard.js:99-104`
**Issue:** `const m = /\`([^\`]+)\`/.exec(cells[1] || ''); if (!m) continue;` drops any table row whose first cell has no backticked path. That row is not capped, not duplicate-checked and not malformed-checked. The truncation scan only counts lines that start with `` | ` ``, so it misses the row too. Drive A replaced row 6's path with a bare `frontend/src/hooks/useMessages.ts` and a 300-char verdict: gate exit 0, hook silent. Drive C (a row indented by one space, which GFM still renders as a table row) also passes, because the loop stops at `startsWith('|')` and the truncation scan requires column 0. A new row written as a markdown link, or with a forgotten backtick, gets in completely unchecked.
**Fix:** Treat every `|` line in the table body as a row, and report rows without a backticked path instead of skipping them. Compare with `trimStart()`:
```js
for (; i < lines.length && lines[i].trimStart().startsWith('|'); i++) {
  const cells = splitCells(lines[i].trimStart());
  const m = /`([^`]+)`/.exec(cells[1] || '');
  rows.push({ line: i + 1, path: m ? m[1] : `(no path) line ${i + 1}`, cells: m ? cells.length : -1, disposition: cells[spec.verdictIndex] || '' });
}
```
(`cells: -1` makes it surface as `[malformed-row]`.) Mirror the change in the hook.

### WR-03: The truncation check stops at the first `## `, so a table split by a heading leaves every later row uncapped

**File:** `scripts/check-claude-md-size.cjs:254`, `.claude/hooks/claude-md-size-guard.js:111`
**Issue:** The gate comment at lines 82-84 promises that "the table must not be cut short partway through -- either fails as [shortlist-missing]". Drive B inserted `## Continued` after row 150 and gave rows 151-202 300-char verdicts, which grew CLAUDE.md by **13,399 chars**. Gate exit 0, hook silent. The parser stops at the blank line, 150 rows clears the 100-row floor, and the truncation loop `!lines[j].startsWith('## ')` ends on its first iteration. The 52 FIRING-shaped rows below are never examined. The floor plus truncation design only covers breaks that don't include a level-2 heading.
**Fix:** Scan the whole file (not just up to the next `## `) for lines shaped like FIRING rows outside the parsed range, ignoring fenced code:
```js
for (let j = 0; j < lines.length; j++) {
  if (j >= start && j < parsed.end) continue;
  if (/^\s*\| `/.test(lines[j]) && splitCells(lines[j].trim()).length === spec.expectedCells) k++;
}
```
The worktree-artifact table, the only other backticked 5-cell table, must be excluded by its own header range. Alternatively, pin the expected row count, which already equals the path set `check-hot-file-ledger.cjs` knows.

### WR-04: Only the verdict cell is capped; prose can regrow in the triple cell unbounded

**File:** `scripts/check-claude-md-size.cjs:93-100, 233`, `.claude/hooks/claude-md-size-guard.js:127-129`
**Issue:** `SHORTLIST_SPEC` caps `cells[3]` only. Drive D put `74 / 27 / 127 ` followed by 300 chars into the triple cell: gate exit 0, hook silent. Migration into that cell has already started. Rows such as `` | `backend/app/api/threads.py` | 265 / 90 / 2459 (was `261 / 88 / 2434`) | `` carry annotation in column 2 (the longest is 41 chars today). Both earlier trips were one column turning into prose. Capping one of the two free-text columns moves the prose rather than stopping it.
**Fix:** Validate the triple cell's shape, which is stricter than a length cap:
```js
const TRIPLE = /^\d+ \/ \d+ \/ (\d+|\*\*DELETED\*\*)( \(was `\d+ \/ \d+ \/ \d+`\))?$/;
if (!TRIPLE.test(cells[2])) malformed.push(...)
```
At minimum, also cap `cells[2]` (for example 48 chars) and report it as `[triple-too-long]`.

### WR-05: The 200-char scan-list cap has no floor or truncation check: the vacuity 277 fixed for CLAUDE.md is still present in the ledger

**File:** `scripts/check-claude-md-size.cjs:320, 328, 331, 334`
**Issue:** The ledger target gets `opts: {}`, so there is no `MIN_*` floor and no truncation scan. `if (!fs.existsSync(t.file)) continue;` and `if (f.rows === 0 && f.missing.length === 0) continue;` then turn an unparsed ledger into a clean pass. Drive E renamed the header to `| … | Disposition. |` and added a 300-char cell: gate exit 0. Drive F added a blank line after scan-list row 10 and a 300-char cell at row 400: gate exit 0, because only 10 of 516 rows were bound. Control G, with the same 300-char cell and no break, does fire `[disposition-too-long] … (cap 200)`. So the cap binds only while the table stays intact. The gate's own comment (lines 82-84) calls a binding that parses nothing "exactly how this went unseen", and the same weakness remains one file over. Moving or renaming `docs/HOT-FILE-LEDGER.md` would also disable the check silently.
**Fix:** Give the ledger target a floor and the truncation check, and fail when the file is missing:
```js
.concat(LEDGER_FILES.map((file) => ({ file, spec: SCAN_LIST_SPEC, opts: { floor: 500, required: true } })));
// in the loop: if (!fs.existsSync(t.file)) { if (t.opts.required) structural.push({ rel, table: t.spec.name, missing: ['file not found'], long: [], dupes: [], malformed: [] }); continue; }
```
The truncation scan needs the scan list's row shape: `` | [` `` prefix with 6 cells.

### WR-06: Nothing runs the 200 cap automatically when only the ledger is edited, yet CLAUDE.md still says it fires in-turn

**File:** `CLAUDE.md:62-67, 69`; `.claude/hooks/claude-md-size-guard.js:60`; `.github/workflows/claude-md-size.yml` (`paths:`)
**Issue:** CLAUDE.md:64-65 still says the cap "runs in the PostToolUse hook, so it fires in the turn the prose is authored". The Phase 277 correction at line 69 updates the numbers (80 / 200) but leaves that claim in place, and for the scan list it is false:
- the hook exits at line 60 unless `path.basename(filePath) === 'CLAUDE.md'`, and its new comment at lines 43-44 admits this ("The docs scan list's 200 cap lives in the gate only");
- the CI workflow's `paths:` filter lists `**/CLAUDE.md`, `scripts/check-claude-md-size.cjs` and the workflow file only, not `docs/HOT-FILE-LEDGER.md`.

A phase that edits only the ledger, which is the normal case under the same-commit sync rule whenever a cell's narrative grows, triggers neither guard. In drive G the hook was silent on a 300-char scan-list cell. The prose is moving to where nothing automatic watches it.
**Fix:** Add `"docs/HOT-FILE-LEDGER.md"` to both `paths:` lists in `claude-md-size.yml`. Also either extend the hook to run the `SCAN_LIST_SPEC` check when `basename === 'HOT-FILE-LEDGER.md'` (the hot-file-ledger-guard already uses a 20 s budget, so this one is cheap by comparison), or correct CLAUDE.md:64-65 to say the scan-list cap is gate-only.

### WR-07: The new dispatcher.py scan-list row contradicts itself: `FIRES` next to `BELOW threshold`

**File:** `docs/HOT-FILE-LEDGER.md` (scan-list row added by 277, line 11500); `CLAUDE.md:582`
**Issue:** The row 277 added reads:
`` | [`backend/app/services/provider_gateway/dispatcher.py`](…) | 8 / 3 / 196 | ⚠ **FIRES** | ⚠ absent its ENTIRE LIFE — row added 262, BELOW threshold | ``
The triple was re-derived in this phase (the SUMMARY's R-5 table: "all three (now FIRES)"), and the G-5 column agrees, but the disposition still says BELOW threshold. The CLAUDE.md FIRING row keeps `6 / 2 / 153 … BELOW threshold` as well. CLAUDE.md itself names this the worst kind of row: one that is "present and WRONG answers the auditor with `satisfied` and stops the audit". The phase measured the change and still copied the stale verdict next to it.
**Fix:** In the scan-list row, replace the disposition with something like `⚠ now FIRES (3 phases) · absent its ENTIRE LIFE — row added 262` (still ≤ 80 chars). Re-derive the CLAUDE.md row too, keeping the old triple beside the new one per the table's own convention (for example `8 / 3 / 196 (was \`6 / 2 / 153\`)`), and drop `BELOW threshold`. Remember D-04 froze triples for *this* commit, so this belongs in the next touch.

### WR-08: 46 shortened cells dropped a ⛔ invariant without a pointer, while 24 others say "see ledger"

**File:** `CLAUDE.md:410-611` (FIRING table)
**Issue:** All 137 shortened cells have their full text in the ledger, but only **24** carry `· see ledger`. Plan Task 1 step 3 used that suffix only for cells "with no disposition phrase". A reader of the always-loaded table therefore learns that `see ledger` means "there is more", and that its absence means there isn't. Among the cells without the marker, **46** dropped a `⛔` hard constraint and kept no `⛔`, `OWED`, `FIRST` or pointer. Examples:
- `backend/app/security/secret_cipher.py` (L507). Old: `⛔ SECRET_COLUMNS is the ONE encrypt-on-write set: a provider key column absent from it is stored PLAINTEXT and nothing says so`. New: `⚠ absent its ENTIRE LIFE — row added mig 180`. This is a security invariant.
- `backend/app/services/provider_gateway/openai_responses.py` (L583). Old: `⛔ emits call_id, NEVER item.id — … round 2 of every multi-tool turn fails`. New: `young (created 262)`, which reads as harmless.
- `backend/app/api/workspace.py` (L547), `⛔ no minter reach`. `frontend/src/components/skills/SkillFormDialog.tsx` (L577), `⛔ callers pass a STABLE reference or the reset wipes typing`. `frontend/src/lib/api/admin.ts` (L584), `⛔ … never a Pick<> of it, or an operator field travels to every author`.
- Full list (CLAUDE.md line numbers): 434, 438, 444, 448, 449, 452, 454, 458, 459, 468, 469, 479, 480, 496, 499, 507, 514, 520, 542, 546, 547, 549, 552, 556, 558, 559, 561, 565, 568, 573, 575, 577, 581, 582, 583, 584, 585, 586, 587, 588, 593, 594, 597, 604, 607, 608.

The table intro ("Verdicts abbreviated; the full cell … in the detail file") partly covers this, and leaving invariants out of cells was a plan decision. The inconsistent marker still makes the 46 cells look complete.
**Fix:** Use one uniform marker on every moved cell whose old text held a `⛔`. A 3-char `· ⛔` suffix fits under 80 for all 46. Alternatively, add a legend line directly above the table: "Every abbreviated cell's full text, including its ⛔ invariants, is under `CLAUDE.md verdict cell as of 2026-10-12` in that file's ledger section." Whichever you choose, drop `see ledger` from the 24, or add it to all 137, so the marker carries no false meaning.

## Info

### IN-01: `--json` mode skips every structural finding and exits 0 on `[shortlist-missing]`

**File:** `scripts/check-claude-md-size.cjs:341-344`
**Issue:** `if (asJson) { …; return over.length ? 1 : 0; }` runs before the structural results are emitted or checked. Drive J (FIRING header renamed) gives `--json` exit 0 with no structural key. No caller uses `--json` today (grep), so this is latent.
**Fix:** Include `structural` in the JSON payload and return `over.length || structural.length ? 1 : 0`.

### IN-02: Three new scan-list rows link to anchors that don't exist

**File:** `docs/HOT-FILE-LEDGER.md` (the 11 rows 277 appended to the scan list)
**Issue:** The rows for `secret_cipher.py`, `oauth_refresh_service.py` and `SourceFolderPicker.tsx` link to `#backendappsecuritysecret_cipherpy` and similar. Their sections are headed `### \`…secret_cipher.py\` — mig 180, ROW ADDED AT ITS SECOND PHASE` (line 14695), `… — 5 / 3 / 362 (row added at this fix)` (13698) and `… — 2 / 2 / 375 (row added at this fix)` (13763), so the slugs include those suffixes. Separately, every scan-list link uses `docs/HOT-FILE-LEDGER.md#…` from inside `docs/`, which resolves to `docs/docs/…`. That convention predates this phase.
**Fix:** Use same-file anchors (`#slug`) with the full heading slug.

### IN-03: Two shortened cells lost a qualifier that changes how they read

**File:** `CLAUDE.md:494`, `CLAUDE.md:420`
**Issue:** `frontend/src/lib/api/org.ts`: the old cell was `absent for its ENTIRE LIFE at 4 phases; row then STALE …` and the new one is `⚠ absent its ENTIRE LIFE · THIRD wire-type drift (239)`. With `— row added …` gone (every other "absent" cell keeps it), this reads as if the file is absent from the register right now. `backend/app/services/harness/phase_types.py`: `⚠ row was STALE` became bare `extraction TAKEN (200-03)`, whereas the other STALE cells kept `⚠ row STALE`.
**Fix:** `⚠ absent until a row was added · THIRD wire-type drift (239)`, and `⚠ row STALE · extraction TAKEN (200-03)`.

### IN-04: The hook matcher omits MultiEdit

**File:** `.claude/settings.json:86` (`"matcher": "Write|Edit"` for `claude-md-size-guard.js`)
**Issue:** A `MultiEdit` to CLAUDE.md skips the primary guard. Sibling hooks at lines 106 and 146 already match `Write|Edit|MultiEdit`, and the hook reads `tool_input.file_path`, which MultiEdit also supplies. This predates the phase. It matters more now that the guard is supposed to catch an 81-char cell in-turn.
**Fix:** `"matcher": "Write|Edit|MultiEdit"`.

### IN-05: The compact rule 2 no longer carries two obligations from the old rule

**File:** `CLAUDE.md:132-138`
**Issue:** These now live only in `docs/VITEST-COUNT-GATE.md`:
- "a plan that deletes a source file must say which side of the gate it was on";
- "TARGETS decides what runs; BASELINE decides what is guarded".

Both are rules agents must follow, not history. Retaining them was in D-02's scope; this note records that they left the always-loaded context.
**Fix:** If wanted, one bullet: `A suite is RUN by TARGETS and GUARDED by BASELINE; a plan deleting a source file says which side it was on.`

---

_Reviewed: 2026-10-12T19:21:04Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
