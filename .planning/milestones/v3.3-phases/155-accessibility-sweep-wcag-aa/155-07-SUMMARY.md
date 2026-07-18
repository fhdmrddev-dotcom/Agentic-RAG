---
phase: 155-accessibility-sweep-wcag-aa
plan: 07
subsystem: ui
tags: [wcag, accessibility, contrast, design-tokens, tailwind, opacity-sweep, deep-midnight-theme]

# Dependency graph
requires:
  - phase: 155-02
    provides: the D-07-operator-approved global dark --muted-foreground-dim (220 16% 70%, ~8:1) + the admin-cluster sweep + the reusable "drop the opacity modifier on meaningful text" transform recipe this plan applies to the remaining clusters
provides:
  - the remaining non-admin opacity offenders (chat / skills-studio / classification / settings / ingestion / layout / panel / workflows / pages — 27 files touched, 73 meaningful-text occurrences) swept onto full-opacity AA text-muted-foreground (~7.7:1)
  - the app-wide D-04 sweep COMPLETE — together with 155-02 every residual text-muted-foreground/{40,50,60,70} in src is a documented decorative/disabled WCAG-allowed exemption (20 total app-wide: 12 this plan + 8 from 155-02)
  - the final app-wide exemption list (feeds the D-03 live Chrome contrast scan + the D-06 SEED-092-remainder doc)
affects: [155-06, contrast-sweep, muted-text, deep-midnight-theme, D-03-live-scan]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Opacity modifier is the AA killer — meaningful muted text uses full-opacity text-muted-foreground, never text-muted-foreground/{40,50,60,70} (65% L @ 0.5-0.7 alpha composites to ~3-3.4:1, FAILS 1.4.3)"
    - "Reused the 155-02 transform recipe verbatim on disjoint files: className-only opacity-modifier drop; decorative icons / aria-hidden glyphs / disabled cursor-not-allowed controls / input placeholders stay exempt (WCAG-allowed) and are documented, not swept"

key-files:
  created:
    - .planning/phases/155-accessibility-sweep-wcag-aa/155-07-SUMMARY.md
  modified:
    - frontend/src/components/chat/CitationCard.tsx
    - frontend/src/components/chat/MessageInput.tsx
    - frontend/src/components/chat/OutputFileCard.tsx
    - frontend/src/components/chat/RunCard.tsx
    - frontend/src/components/chat/ToolCallPanel.tsx
    - frontend/src/components/chat/tool-bodies/ExecuteCodeBody.tsx
    - frontend/src/components/chat/tool-bodies/SearchDocumentsBody.tsx
    - frontend/src/components/skills/studio/RunBar.tsx
    - frontend/src/components/skills/studio/RunHistory.tsx
    - frontend/src/components/skills/studio/VersionsTab.tsx
    - frontend/src/components/skills/studio/RunCaseDetail.tsx
    - frontend/src/components/classification/RuleBuilderPanel.tsx
    - frontend/src/components/settings/ReembedConfirmModal.tsx
    - frontend/src/components/settings/ReembedStatusCard.tsx
    - frontend/src/components/settings/ProviderPicker.tsx
    - frontend/src/components/settings/EngineHealthCard.tsx
    - frontend/src/components/settings/ModelPillRow.tsx
    - frontend/src/components/ingestion/ConditionPopover.tsx
    - frontend/src/components/ingestion/AutomationGroup.tsx
    - frontend/src/components/ingestion/ViewsGroup.tsx
    - frontend/src/components/ingestion/FolderTree.tsx
    - frontend/src/components/layout/NavPanel.tsx
    - frontend/src/components/layout/ChatLayout.tsx
    - frontend/src/components/workflows/WorkflowSoul.tsx
    - frontend/src/components/workflows/WorkflowDoorSwitch.tsx
    - frontend/src/pages/SettingsPage.tsx
    - frontend/src/pages/WorkflowsPage.tsx

key-decisions:
  - "Mirrored 155-02 exactly: ALL swept meaningful text -> full-opacity text-muted-foreground (NOT text-muted-foreground-dim). The dim token has no clean Tailwind utility (only panel-scoped panel-muted-foreground-dim exists; the global --muted-foreground-dim requires the arbitrary-value form text-[hsl(var(--muted-foreground-dim))]). 155-02 uniformly used full text-muted-foreground and got D-07 operator sign-off, so the same value keeps the look consistent and the diff a clean opacity-modifier drop."
  - "Decorative icon glyphs (lucide ChevronRight/Zap/Brain/CircleDashed/SlidersHorizontal) classified as WCAG-1.4.3-N/A decorative graphics and left exempt, mirroring 155-02's LockedTab Lock-icon precedent (icon/non-text contrast is 1.4.11, out of this D-04 sweep's scope)."
  - "3 declared files (DocumentUpload, FolderBreadcrumb, PhaseCard) + 1 (MemorySection) received NO diff because every one of their occurrences is an exemption — 27 of 31 declared files changed. Correct behavior, mirroring 155-02's ModelDiscoveryPanel."

patterns-established:
  - "App-wide D-04 opacity sweep is CLOSED across 155-02 (admin) + 155-07 (everything else) — 20 residual app-wide occurrences, all documented decorative/disabled exemptions; a future regression is caught by the residual grep + the D-03 live scan."

requirements-completed: []  # A11Y-01 stays OPEN at the requirement level (false-green avoidance, 148-154 convention) — closes at /gsd:verify-work 155 after the live Chrome color-contrast scan (D-03) confirms zero failing nodes app-wide. requirements.mark-complete deliberately NOT called.

# Metrics
duration: ~8 min (3 task commits, 00:29:33 -> 00:37:20 +0400)
completed: 2026-07-16
---

# Phase 155 Plan 07: Remaining-Cluster Opacity Sweep Summary

**Swept the 73 meaningful-text `text-muted-foreground/{40,50,60,70}` opacity offenders outside the admin cluster (27 files across chat / skills-studio / classification / settings / ingestion / layout / workflows / pages) onto full-opacity AA `text-muted-foreground`, completing the app-wide D-04 sweep begun in 155-02 — G-5 red line honored, all 20 app-wide residuals documented as WCAG-allowed exemptions.**

## Performance

- **Duration:** ~8 min (Task 1 commit -> Task 3 commit)
- **Started:** 2026-07-16T00:29:33+04:00 (Task 1 commit)
- **Completed:** 2026-07-16T00:37:20+04:00 (Task 3 commit)
- **Tasks:** 3 (all `type=auto`)
- **Files modified:** 27 (of 31 declared; 4 declared files were exemption-only, no diff)
- **Occurrences:** 85 total (73 swept to full-opacity AA + 12 documented exemptions)

## Accomplishments
- **Task 1 (chat, 7 files, 26 occ):** 24 meaningful-text offenders dropped to full-opacity `text-muted-foreground`; 2 exemptions retained (input placeholder, decorative aria-hidden ChevronRight). Chat suites 58/58 green, build exit 0.
- **Task 2 (skills-studio / classification / settings, 11 files, 37 occ):** 33 offenders swept across 10 files; 4 exemptions retained; MemorySection received no diff (sole occurrence is the exempt Brain icon). Skills+settings suites 141/141 green, build exit 0.
- **Task 3 (ingestion / layout / panel / workflows / pages, 13 files, 22 occ):** 16 offenders swept across 10 files; 6 exemptions retained across 5 files; DocumentUpload/FolderBreadcrumb/PhaseCard received no diff (all exempt). Pages+ingestion suites 79/79 green, `tsc -b` = 30 baseline (0 net-new), build exit 0.
- **App-wide D-04 sweep CLOSED:** post-155-02 + this plan, `grep -rnE 'text-muted-foreground/(40|50|60|70)' src` = **20 occurrences, every one a documented decorative/disabled exemption** (12 this plan + 8 from 155-02). Zero meaningful-text opacity offenders remain app-wide.
- **G-5 RED LINE honored:** `git diff --name-only b39d60d8^..HEAD` confirms `MessageItem.tsx` / `StreamsProvider.tsx` NEVER appeared in any commit; ToolCallPanel received className-only edits (G-5-adjacent, allowed). NavPanel/ChatLayout got className-only opacity swaps — no aria/button work (that is plan 155-03); NavPanel's decorative `opacity-50` MessageSquare icon left untouched.

## Task Commits

Each task was committed atomically:

1. **Task 1: Sweep the chat-cluster opacity offenders** — `b39d60d8` (fix) — 7 files, 24/24
2. **Task 2: Sweep the studio/classification/settings offenders** — `1400df56` (fix) — 10 files, 33/33
3. **Task 3: Sweep the long-tail offenders + app-wide closing check** — `d682882b` (fix) — 10 files, 16/16

**Plan metadata:** committed with this SUMMARY + STATE.md + ROADMAP.md (docs commit).

## Verification

| Gate | Result |
|------|--------|
| Chat `__tests__` (Task 1) | 58/58 GREEN (8 files) |
| Skills + settings suites (Task 2) | 141/141 GREEN (19 files) |
| Pages `__tests__` + ingestion (Task 3) | 79/79 GREEN (9 files) |
| `npx tsc -b` | exactly **30** SEED-056/049 baseline errors, **0 net-new** |
| `npx vite build` | exit **0** (all 3 tasks) |
| Diff shape | className-only — every removed line contained a `text-muted-foreground/{40,50,60,70}` token; balanced 1:1 add/remove (73 lines) |
| Scope | all 27 touched files under `frontend/src/`; 0 backend/migration files; 0 deletions |
| G-5 | `MessageItem.tsx` / `StreamsProvider.tsx` absent from every 155-07 commit |

**Contrast SC (D-03) is proven ONLY by the live Chrome color-contrast scan** (jsdom cannot compute contrast) — recorded in 155-VALIDATION.md; NEVER claimed from the green vitest run.

## App-Wide Exemption List (WCAG-allowed residuals — feeds the D-03 live scan + D-06 remainder doc)

### 155-07 residuals (12 occurrences, this plan)

| File:Line | Occurrence | Exemption class |
|-----------|-----------|-----------------|
| `chat/MessageInput.tsx:195` | `placeholder:text-muted-foreground/50` | Input placeholder affordance |
| `chat/ToolCallPanel.tsx:421` | `<ChevronRight … text-muted-foreground/40>` (inside `aria-hidden` rail) | Decorative expand-indicator icon (lucide, aria-hidden) |
| `skills/studio/RunHistory.tsx:435` | `<span aria-hidden … text-muted-foreground/50>◈` | Decorative aria-hidden bullet glyph |
| `classification/RuleBuilderPanel.tsx:360` | disabled `cursor-not-allowed` "Global" scope label | Disabled control (AR-118-04: no client path to create global rules) |
| `settings/EngineHealthCard.tsx:324` | `<CircleDashed … text-muted-foreground/60>` | Decorative "unswept" status icon (state also carried by tile + model text) |
| `settings/MemorySection.tsx:136` | `<Brain … text-muted-foreground/50>` | Decorative empty-state icon |
| `ingestion/AutomationGroup.tsx:134` | `<Zap … text-muted-foreground/50 aria-hidden>` | Decorative icon |
| `ingestion/AutomationGroup.tsx:159` | `iconClassName … : "text-muted-foreground/40"` | Disabled-state NavRow icon color (enabled = emerald) |
| `ingestion/DocumentUpload.tsx:88` | `cursor-not-allowed … text-muted-foreground/60` | Disabled dropzone control |
| `ingestion/FolderBreadcrumb.tsx:52` | `<ChevronRight … text-muted-foreground/50>` | Decorative breadcrumb separator icon |
| `ingestion/ViewsGroup.tsx:143` | `<SlidersHorizontal … text-muted-foreground/50 aria-hidden>` | Decorative icon |
| `panel/PhaseCard.tsx:377` | `<span aria-hidden … text-muted-foreground/50>` | Decorative aria-hidden span |

### 155-02 residuals (8 occurrences, carried from 155-02 SUMMARY)

`admin/LockedTab.tsx:33` (decorative aria-hidden Lock), `admin/ModelDiscoveryPanel.tsx:534` (placeholder) + `:546` (disabled), `admin/ModelRegistryTab.tsx:591` (placeholder) + `:649` (disabled), `admin/UsersAndAccess.tsx:136` (decorative search icon) + `:145` (placeholder) + `:249` (decorative + disabled avatar initial).

**App-wide total: 20 documented exemptions. Zero meaningful-text opacity offenders remain.**

## Files with NO diff (declared but exemption-only)

`settings/MemorySection.tsx`, `ingestion/DocumentUpload.tsx`, `ingestion/FolderBreadcrumb.tsx`, `panel/PhaseCard.tsx` — each declared in the plan's file set but received no edit because every one of its `text-muted-foreground/{40,50,60,70}` occurrences is a documented exemption. Correct behavior (mirrors 155-02's ModelDiscoveryPanel), not a miss. 27 of 31 declared files changed.

## Decisions Made
- **Full token, not dim** — swept meaningful text to full-opacity `text-muted-foreground` (matching 155-02's D-07-approved uniform choice); the global dim token lacks a clean Tailwind utility and 155-02 set the precedent.
- **Decorative icons exempt** — lucide icon glyphs classified as WCAG-1.4.3-N/A decorative graphics (1.4.11 non-text contrast is out of this sweep's scope), mirroring 155-02's Lock-icon precedent.
- **Comma / arrow separators swept** — visible non-aria-hidden text glyphs (WorkflowSoul `, `, ToolCallPanel `→`) treated as meaningful adjacent text and swept, since they are visible low-contrast text the phase targets.

## Deviations from Plan

None - plan executed exactly as written. (The plan's per-task occurrence sub-counts read "26 / 30 / 22"; the live grep found "26 / 37 / 22" = 85, which matches the plan header's "85 occurrences" — the Task-2 sub-count "30" was a stale figure in the plan body, not a scope change. The residual grep, not the count, is the gate; all 85 occurrences are accounted for as 73 sweeps + 12 exemptions.)

## Threat surface
No new security-relevant surface. The one trust boundary (design-token consumers -> rendered text) was mitigated exactly as the threat register (T-155-07-VIS) prescribed: same decision rule and the same operator-approved token value as the D-07-signed-off 155-02 sweep; className-only edits, no layout/structure changes. T-155-07-G5 mitigated — `git diff --name-only` tripwire confirms MessageItem/StreamsProvider untouched. T-155-07-FALSEGREEN honored — the color-contrast zero is NOT claimed from vitest; it is owed to the D-03 live Chrome scan in VALIDATION.md.

## Next Phase Readiness
- The app-wide D-04 opacity sweep is CLOSED (155-02 admin + 155-07 remainder). The 20-entry exemption list above is the input for the D-03 live Chrome color-contrast scan (which must show 0 failing nodes on the SEED-092 baseline pages) and the D-06 SEED-092-remainder doc.
- A11Y-01 stays OPEN at the requirement level until `/gsd:verify-work 155` (full app-wide sweep + live contrast scan + keyboard walkthrough).

## Self-Check: PASSED
- SUMMARY file exists at `.planning/phases/155-accessibility-sweep-wcag-aa/155-07-SUMMARY.md`.
- Commits verified present: `b39d60d8` (Task 1), `1400df56` (Task 2), `d682882b` (Task 3) — all FOUND in git log.
- Swept files confirmed carrying full-opacity `text-muted-foreground` (ToolCallPanel, ReembedStatusCard, SettingsPage).
- App-wide residual grep = 20 occurrences, all documented decorative/disabled exemptions; 0 meaningful-text offenders.
- G-5: `MessageItem.tsx` / `StreamsProvider.tsx` absent from every 155-07 commit.
- Gates green: chat 58/58, skills+settings 141/141, pages+ingestion 79/79; `tsc -b` 30 baseline (0 net-new); `vite build` exit 0.
