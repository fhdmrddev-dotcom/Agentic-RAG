# Phase 264 — deferred / out-of-scope discoveries

## From 264-01 (pre-existing, zero frontend files in this plan's diff)

- **`node scripts/check-landing-drift.cjs` FAILS at the phase base `e9d6a9410`.**
  `SURFACE_TABS.orgAdmin` (`OrgAdminShell.tsx`) lists an **`Experts`** tab that the landing
  canvas's `facts.ts` does not:

  ```
  Source Code: ["Members","Experts","Audit","Settings","Invitations & Roles","SSO","Subscription","Retention"]
  facts.ts:    ["Members",          "Audit","Settings","Invitations & Roles","SSO","Subscription","Retention"]
  ```

  Landed with the Experts work (261 / 263) and never mirrored into the landing facts.
  Reproduced standalone on a tree whose ONLY modified files were
  `backend/app/services/agent_loop.py` and `backend/app/services/tool_dispatcher.py`
  (`git diff --name-only HEAD` quoted in 264-01-SUMMARY.md), so it is provably not this
  plan's. The fix is a one-line `facts.ts` edit and belongs to whoever owns the landing
  canvas — 264-01 touches no frontend source at all.

  ⚠ **Still failing at 264-03's base `53ece799f`** — reproduced on a tree whose only modified
  file was `backend/app/services/tool_dispatcher.py`. The PostToolUse hook fires on every edit
  in this worktree. Not this plan's; unchanged from 264-01's finding.

## From 264-03 — a PROSE correction owed in two registers (`.or_()` applications: six → SEVEN)

> ✅ **TAKEN by `264-04` (commit `docs(264-04)`), in both registers, in one commit.** The
> correction is recorded BESIDE each original rather than over it, and the `four call sites`
> figure is explicitly affirmed in both. ⚠ The line lists in the entry below have themselves
> moved since `53ece799f`: re-measured at 264's close the applications are at
> `1373 / 1401 / 1533 / 1671 / 1683 / 2293 / 2305` and the four call sites at
> `1369 / 1529 / 1666 / 2283`. **Three different line lists now exist for one file; re-derive,
> never quote one.** The count itself is unchanged and stays pinned at `7`.

- **`RESEARCH §2.3` and, quoting it verbatim, `app/utils/skill_visibility.py`'s own module
  docstring both say the four resolver calls feed "six `.or_(...)` applications" and enumerate
  them (`:1319, :1347, :1594, :1606, :2204, :2219`). There are SEVEN.** The enumeration omits
  `_handle_save_skill`'s single `.or_(_sibling_filter)` — which the same paragraph's prose
  already says exists ("applied once"), so the two halves of one sentence disagree.

  Measured 2026-09-22 at `53ece799f` (`grep -n "^\s*\.or_(" backend/app/services/tool_dispatcher.py`):
  lines **1330 / 1358 / 1474 / 1605 / 1617 / 2217 / 2229** — `_skill_filter` ×4,
  `_sf_filter` ×2, `_sibling_filter` ×1.

  ⭐ **The `four call sites` figure is CORRECT and unaffected** — that is the number D-264-04's
  per-site table turns on, and every decision in this phase rests on it. Only the applications
  count is wrong.

  **Not fixed here, deliberately:** `app/utils/skill_visibility.py` is outside `264-03`'s
  `files_modified`, and `264-04` owns the ledger/prose obligation for this phase. The fence is
  pinned at the measured **7** in
  `backend/tests/unit/test_264_load_skill_born_for.py::test_no_or_application_line_moved`, with
  the correction written into its docstring, so the figure is executable somewhere even while
  the prose is still wrong. ⚠ Worth naming: that same paragraph is itself a CORRECTION — 264-02
  rewrote it to retire an earlier "five call sites" claim. This is the second wrong number in
  one sentence, which is why it is registered rather than left to the next reader.

  **Owner:** `264-04`. **Trigger if it is not taken there:** the next phase whose
  `files_modified` names `backend/app/utils/skill_visibility.py`.
