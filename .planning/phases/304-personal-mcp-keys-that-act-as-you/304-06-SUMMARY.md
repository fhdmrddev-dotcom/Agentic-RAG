---
phase: 304-personal-mcp-keys-that-act-as-you
plan: 06
subsystem: frontend (org admin, control room) + phase bookkeeping
tags: [frontend, org-admin, control-room, kill-switch, bookkeeping, tdd]
requires:
  - 304-04 (getOrgMcpAccess / setOrgMcpAccess, list.mcp.off, FlagKey mcp_enabled, settings.mcp_enabled, the settings.update + mcp_access audit row)
  - 304-05 (McpOffNotice admin variant, MCP_KEY_COPY offAdmin + orgSwitch*, ApiKeyCard / RevokeApiKeySheet mcpTools props)
provides:
  - "OrgMcpSwitchCard: the org admin's MCP switch in Org admin → Settings (KEY-06)"
  - "the operator's deployment MCP switch: CapabilityGrid entry + ControlRoomPage mapping (KEY-06)"
  - "OrgApiKeysTab: the admin's switched-off notice, preset names, limits only with a workflow key"
  - "OrgAuditTab: the org switch's audit row in plain words"
  - "phase bookkeeping: 9 count-gate pins, measured ledger triples + sections, CLAUDE.md FIRING rows, 304-VALIDATION.md"
affects: [305]
tech-stack:
  added: []
  patterns:
    - "a switch that owns its read and write shows only the server's answer: disabled in flight, no switch after a failed read"
key-files:
  created:
    - frontend/src/components/org/OrgMcpSwitchCard.tsx
    - frontend/src/components/org/__tests__/OrgMcpSwitchCard.test.tsx
    - frontend/src/components/admin/__tests__/CapabilityGrid.mcp.test.tsx
    - .planning/phases/304-personal-mcp-keys-that-act-as-you/304-VALIDATION.md
  modified:
    - frontend/src/components/org/OrgSettingsTab.tsx
    - frontend/src/components/org/OrgAdminShell.tsx
    - frontend/src/components/org/OrgApiKeysTab.tsx
    - frontend/src/components/org/OrgAuditTab.tsx
    - frontend/src/components/admin/CapabilityGrid.tsx
    - frontend/src/components/admin/ControlRoomPage.tsx
    - frontend/src/components/org/OrgApiKeysTab.test.tsx
    - frontend/src/components/org/OrgAuditTab.test.tsx
    - frontend/src/components/org/OrgAdminShell.test.tsx
    - frontend/src/components/admin/__tests__/CapabilityGrid.test.tsx
    - frontend/src/components/admin/__tests__/CapabilityGrid.a11y.test.tsx
    - frontend/src/components/admin/__tests__/ControlRoomPage.test.tsx
    - scripts/vitest-count-gate.cjs
    - docs/HOT-FILE-LEDGER.md
    - CLAUDE.md
decisions:
  - "The org switch's audit words key on the stored metadata.enabled, so the row says on or off from what the server wrote, not from what was clicked."
  - "The admin key list shows the switched-off notice only for the ORG's switch; a deployment-wide off is the operator's and is already said on each member card."
  - "The three pre-existing 'exactly four switches' assertions were raised to five: D-03 mandates the fifth card, and a stale count would otherwise red the gate."
metrics:
  duration: ~2h 40m
  completed: 2026-10-31
  tasks: 2
  files: 20
---

# Phase 304 Plan 06: The org and operator MCP switches, and the phase bookkeeping Summary

An org admin can now switch AI tool access off for their organisation from Org admin → Settings. The switch shows only what the server answered. A flip pulses the "every action recorded" marker, and the Audit tab reads "Switched AI tool access (MCP) off for the organisation". The admin's API keys list then says that every member's AI tool key is refused. The operator has the same switch for the whole deployment as a fifth card in the Control Room, with no made-up count. The phase's bookkeeping is closed: the new suites are pinned, every 304 file has a measured ledger row and section, and every full gate ran once and is green.

## Start state

- The worktree came up on `4bc4a872f` (master). After the HEAD-namespace assertion it was reset to `16a90f4cbaf19dc16a451bbd9a109f907f3fd28d` (develop, waves 1-3 merged) before any work.

## Commits

| # | Hash | Message |
|---|------|---------|
| 1 | `965a5c622` | test(304-06): add failing tests for the org MCP switch, the admin list notice, the audit words and the operator switch (RED) |
| 2 | `b084fd4ef` | feat(304-06): the org MCP switch, the admin list notice, the audit words and the operator switch (GREEN) |
| 3 | `25527a762` | chore(304-06): phase bookkeeping — count-gate pins, ledger triples + sections, CLAUDE.md FIRING rows, 304-VALIDATION |
| 4 | `d38d9393d` | fix(304-06): keep grep -c countImpact at its base count in CapabilityGrid (comment wording only) |

## What was built

### Task 1: the switches on screen

- **`OrgMcpSwitchCard.tsx`** (new). It owns its read (`getOrgMcpAccess`) and write (`setOrgMcpAccess`) with the alive ref, on the `OrgApiKeysTab` pattern.
  - It shows "Loading…" until the read answers. After a failed read it shows "Couldn't load this setting." and Retry, and no switch.
  - ON is calm. OFF is armed: `border-destructive/50 bg-destructive/[0.06]`, the tag "off for {org}", and the impact line.
  - A click disables the switch until the server answers, then shows the server's value. A failed write leaves it where it was and shows "Couldn't change it. Try again." (`role="status"`).
  - A successful write calls `onRecorded` once. There is no confirm dialog (the 066 direct-flip arm).
  - The switch look is re-declared locally, so the FIRING grid gains no export. Every word comes from `MCP_KEY_COPY`.
- **`OrgSettingsTab.tsx`**: one mount of the card under the identity block, plus the `onRecorded` prop it forwards.
- **`OrgAdminShell.tsx`** (FIRES): exactly one line changed, +1 −1. It is now `<OrgSettingsTab key={activeOrgId ?? "none"} orgName={orgName} onRecorded={pulse} />`, the `RetentionTab` precedent.
- **`OrgApiKeysTab.tsx`**:
  - `<McpOffNotice scope="org" variant="admin">` sits under the note when `list.mcp.off === "org"`.
  - The limits line shows only when a workflow key exists.
  - `list.mcp.tools` reaches `ApiKeyCard` and `RevokeApiKeySheet`, so admin cards and the admin sheet name the preset. "How to connect" stays hidden (`showOwner`).
- **`OrgAuditTab.tsx`** (FIRES): one branch in `rowLabel`. `settings.update` with `metadata.event === "mcp_access"` reads "Switched AI tool access (MCP) {on|off} for the organisation", from the stored `enabled`. `AuditTab.tsx` and `audit_service.py` are untouched, and a test asserts AuditTab carries no `mcp_access`.
- **`CapabilityGrid.tsx`** (FIRES): one union member and one `CAPABILITIES` entry, appended last. It reads "AI tool access (MCP)" / "Members can connect AI tools with personal keys." with the count-free fallback impact and no `countImpact`. `grep -c countImpact` is unchanged from base (3).
- **`ControlRoomPage.tsx`** (FIRES): one line, +1 −0: `mcp_enabled: settings?.mcp_enabled ?? true,`.

### Task 2: bookkeeping

- **Count gate**:
  - Nine first pins with FILE-LEVEL TARGETS: `mcpSnippets` 37, `mcpKeyFacts` 15, `McpOffNotice` 5, `ApiKeyKindChoice` 4, `KeyFoldersField` 7, `McpKeyFields` 6, `McpConnectSnippets` 10, `OrgMcpSwitchCard` 8, `CapabilityGrid.mcp` 5. A direct run measured all nine before pinning: 97 passed, 0 failed.
  - Raised to the gate's printed actuals: `apiKeyFacts` 32→43, `ApiKeysTab` 17→29, `ApiKeyCard` 8→15, `RevokeApiKeySheet` 7→9, `apiKeysContract` 3→8, `OrgApiKeysTab` 7→12, `OrgAuditTab` 19→23, `OrgAdminShell` 14→17, `connectionVerbFence` 21→22. None was lowered.
- **Ledger**:
  - 42 scan-list rows were re-derived with the CLAUDE.md recipe. That includes the 16 new files planted `0 / 0 / 0`, which are now measured.
  - Each replaced cell was moved verbatim into a dated "Phase 304 refresh" section, one subsection per file. `ControlRoomPage.tsx` and `OrgSettingsTab.tsx` got their D-44 sections.
- **CLAUDE.md**:
  - 13 FIRING rows were updated.
  - Five new rows were added: `ControlRoomPage.tsx`, plus four files that now fire at 3 phases (293, 296, 304): `api/api_keys.py`, `db/api_keys.py`, `models/api_key.py` and `lib/api/apiKeys.ts`.
- **`304-VALIDATION.md`**: the three G-4 rows (owed), the four-axis non-applicability note, the D-15 and phase-close gate record, and the owed operator items.

## Gate verdicts (verbatim, each run once on the final state)

- **Backend baseline**, run under the noclobber local-DB lock (acquired `304-06 baseline 2026-10-30T22:27:26Z`, released after):
  ```
  Summary:        70 failed, 10946 passed, 1 skipped, 2 xfailed, 2 xpassed, 58 warnings in 664.74s (0:11:04)
  [GATE PASSED] Backend unit baseline satisfied (failed: 70 <= 71, errors: 0).
  ```
- **Vitest count gate** (`GSD_VITEST_MAX_WORKERS=2`, repo root). This verdict is after the new pins. The run before the pins was also `count gate OK`: 580/580, total 13517, 0 failing.
  ```
  total 13614  ·  failed 0  ·  pinned total 12574
  count gate OK — 589/589 pinned files present, no per-file decrease, 0 failing.
  ```
- **Frontend typecheck**: `npx tsc -p tsconfig.app.json --noEmit`, compared as sets with line numbers stripped. The base was re-derived in a throwaway worktree at `16a90f4cb`, which was torn down with `teardown-worktree.sh`; the source venv and node_modules were reported intact. Result: **61 at base, 61 at HEAD, 0 new, 0 gone.**
- **Hot-file ledger**: `scan list: 783 rows · subject: 86 files · watched: 40` · `ledger gate OK — every watched file has a row.`
- **CLAUDE.md size**: `CLAUDE.md  106733 chars  71.2% of limit  headroom 43267 [OK]` · `claude-md size gate OK — every CLAUDE.md loads, all under 120000 chars.`
- **Seeds register** (`--phase 304`):
  - Gate line: `seeds register gate OK — 403/403 parsed, 0 duplicate ids, 403/403 carry all 5 required keys.`
  - Unswept, reported separately and never summed: `130 carry no trigger_when at all · 113 carry prose but no structured trigger`.
  - 23 seeds matched by path.
- **Targeted suites**: `vitest run src/components/org src/components/admin src/components/settings/apiKeys` gave 58 files, 688 passed, 0 failed.
- **Acceptance**:
  - OrgAdminShell numstat `1 1`; ControlRoomPage numstat `1 0`.
  - `countImpact` count is unchanged.
  - `AuditTab.tsx`, `SettingsPage.tsx`, `audit_service.py`, `threads.py`, `agent_loop.py`, `dispatcher.py` and `lib/api.ts` are not in the diff.
  - 0 of the planted rows still read `0 / 0 / 0`.
  - The section grep for ControlRoomPage and OrgSettingsTab returns 2.

## TDD Gate Compliance

- RED `965a5c622`: 14 tests failed across 5 files, and every pre-existing case passed. Three new cases passed at RED because they assert something is absent: no notice when the switch is on, other audit rows keep their words, and AuditTab has no `mcp_access`.
- GREEN `b084fd4ef`: all passed. There is no refactor commit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Three pre-existing "exactly four switches" assertions edited**
- **Found during:** Task 1 GREEN.
- **Issue:** The plan asks for pre-existing cases to stay unedited, but D-03 adds a fifth card. Three tests break on that:
  - `CapabilityGrid.test.tsx`, `CapabilityGrid.a11y.test.tsx` and `ControlRoomPage.test.tsx` assert `toHaveLength(4)`.
  - The two grid suites' `Record<CapabilityKey, boolean>` literals would also become tsc errors.
- **Fix:** Each count was raised 4 → 5 with a dated `RAISED … at 304-06` comment, and `mcp_enabled` was added to the `ALL_ON` / `ALL_OFF` literals. No case was added or removed, so all three pins hold (7, 6, 7).
- **Files:** those three tests. **Commit:** `b084fd4ef`.

**2. [Rule 1 - Bug] The ledger rewrite script substituted `$1` in one cell**
- **Issue:** The scratch script that rewrote the scan-list rows passed the new row to `String.replace` as a replacement string. The `$1` in `dependencies.py`'s verdict (`set_config(..., $1, true)`) became the row's link, and that pushed the cell to 207 chars. A `|` in `RevokeApiKeySheet.tsx`'s verdict split the row into 7 cells.
- **Caught by:** `check-claude-md-size.cjs` (`[disposition-too-long]`, `[malformed-row]`).
- **Fix:** Both cells were corrected by hand. A grep confirmed no other row has a doubled link, and the gate is OK.
- **Commit:** `25527a762`.

**4. [Rule 1 - Acceptance] An entry comment added a 4th `countImpact` match**
- **Issue:** The GREEN commit's comment over the new entry read "NO countImpact". That raised `grep -c countImpact CapabilityGrid.tsx` from the base 3 to 4, which breaks the plan's "unchanged versus base" criterion, even though the entry carries no `countImpact`.
- **Fix:** The comment was reworded to "no count-based impact line"; the grep is 3 again. The ledger and CLAUDE.md triples for the file were re-derived to `5 / 4 / 273` in the same commit. The three grid suites pass (18/18). The behaviour is unchanged, so the gate verdicts above stand.
- **Commit:** `d38d9393d`.

**3. [Hand-off from 304-05] `OrgApiKeysTab.test.tsx`'s `admin.description` assertion moved to the reworded string**
- It now asserts "Every key in Acme Inc. A key acts as the member who made it." This cleared the count gate's last red, as 304-05 handed off.
- **Commit:** `965a5c622`.

## Known Stubs

None. The card reads and writes the live route, the notice reads `list.mcp.off`, and the operator card reads `settings.mcp_enabled`.

## Threat Flags

None outside the register. Each threat was handled as follows:
- **T-304-43** (mitigated): the switch is never optimistic. Tests cover "disabled in flight", "the server's value wins" and "failure stays put".
- **T-304-44** (mitigated): no switch is rendered after a failed read; a test covers it.
- **T-304-45** (mitigated): the switch calls `onRecorded`, a shell test covers the band pulse, and the audit row has plain words.
- **T-304-46** (accepted): the server's `require_org_manage` is the control.
- **T-304-47** (mitigated): there is no `countImpact`. A test passes `impactCounts.mcp_enabled = 7` and asserts that no 7 renders.

## Owed (recorded in 304-VALIDATION.md §5)

1. **G-4 rows 1-3.** Claude drives them in Chrome at verification, row 1 first:
   - Row 1: mint, see once, reload, gone.
   - Row 2: an empty folder set is refused in words.
   - Row 3: the admin switches MCP off. Needs DOM, a screenshot and the `audit_log` row.
2. **Cloud paste of migrations 220 and 221**, with per-action operator approval, then `get_advisors(security)`. This deploys **together with 305** (D-30).
3. **D-41**: the operator confirms there is no tier gate on MCP keys (TIER-02) before the 304 + 305 deploy.
4. **BUG-261031-01**: an `anon` call to `current_user_org_ids()` crashed local Postgres. Reproduce it on a disposable Postgres before the cloud paste. Never make that call on the shared stack.

## Self-Check: PASSED

- The files exist: `OrgMcpSwitchCard.tsx`, `OrgMcpSwitchCard.test.tsx`, `CapabilityGrid.mcp.test.tsx`, `304-VALIDATION.md`.
- The commits exist: `965a5c622`, `b084fd4ef`, `25527a762`, `d38d9393d` (`git log`).
- `STATE.md` and `ROADMAP.md` are not in `git diff 16a90f4cb..HEAD`. The local DB lock file has been removed.
