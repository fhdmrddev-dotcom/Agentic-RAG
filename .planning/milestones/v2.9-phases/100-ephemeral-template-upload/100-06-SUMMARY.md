---
phase: 100-ephemeral-template-upload
plan: 06
subsystem: ui
tags: [react, vite, tailwind, lucide, workspace-panel, files-section, ephemeral-template, ttl, expires-at, upload, ooxml, vitest, tdd]

# Dependency graph
requires:
  - phase: 100-01
    provides: "the FilesSection.test.tsx Wave 0 render stubs (3 it.skip — Template badge/countdown, amber near-expiry, per-ext icon) this plan flips GREEN + the GREEN D-11 agent-file no-badge guard it keeps green"
  - phase: 100-04
    provides: "POST /threads/{tid}/workspace/files upload route (multipart, field name 'file', validate_ooxml gate) this plan's uploadWorkspaceTemplate client calls + the list/content GET routes that now surface kind + expires_at for the badge/countdown"
provides:
  - "uploadWorkspaceTemplate(threadId, file) — FormData + Bearer (no Content-Type) upload client in api.ts; returns the WorkspaceFile row, throws Error(detail) on non-2xx (D-01 panel upload target)"
  - "WorkspaceFile.kind? + WorkspaceFile.expires_at? optional type fields (D-02 badge data; absent on agent files → byte-identical render, D-11)"
  - "FilesSection panel upload affordance (.docx/.pptx/.xlsx) + Template badge + live expiry countdown (no per-second timer) + amber-near-expiry tint + per-extension office icons; optimistic setWorkspaceFileForThread reconcile (no refresh)"
affects: [101-template-fill-integrity, ephemeral-template-upload]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Panel-local upload affordance (D-01): a hidden type=file input + a quiet button inside FilesSection, NOT the composer — a composer attach would read as 'add to KB', the exact ambiguity TMPL-01 closes. accept= is a UX hint only; the server's validate_ooxml is the real gate (T-100-06-01)."
    - "Render-time expiry caption (D-02): expiryCaption/isNearExpiry compute from expires_at on each natural panel re-render — NO per-second setInterval (Anti-Pattern). An absent expires_at returns null/false so an agent file renders byte-identically (D-11 red line)."
    - "Optimistic panel reconcile: on upload success, setWorkspaceFileForThread (keyed-by-path upsert) upserts the returned row so the file appears without a manual refresh; expiry vanishes via the read-path gate + reconcile (D-03)."

key-files:
  created:
    - .planning/phases/100-ephemeral-template-upload/100-06-SUMMARY.md
  modified:
    - frontend/src/lib/api.ts
    - frontend/src/types/index.ts
    - frontend/src/components/panel/FilesSection.tsx
    - frontend/src/components/panel/__tests__/FilesSection.test.tsx

key-decisions:
  - "Per-extension icons keyed on BOTH file extension AND the OOXML mime (docx→FileText, xlsx→FileSpreadsheet, pptx→Presentation), checked before the generic fallthrough — the path extension is the reliable signal for the template allowlist; the long OOXML mimes are the secondary match."
  - "amber-near-expiry uses the literal Tailwind text-amber-500 (matches the plan body + the Plan-01 test assertion `caption.className.toMatch(/amber/)`) rather than the panel's semantic --warning token — the test requires the literal 'amber' class string and the sketch color-language names amber = needs-attention."
  - "setWorkspaceFileForThread read off useStreamActions() (the existing actions accessor) rather than a new dedicated hook — keeps StreamsProvider untouched (G-5 hot file: satisfied, do not grow)."

patterns-established:
  - "Panel upload reconcile loop: uploadWorkspaceTemplate → setWorkspaceFileForThread optimistic upsert → the live panel shows the file with no refetch; the same path the Phase 101 fill output can reuse."
  - "Template-card kind-distinction: a single `file.kind === 'template_input'` guard gates ALL ephemeral chrome (badge + countdown + amber); everything else is the unchanged Phase 087 row — templates optional everywhere, agent files byte-identical (D-11)."

requirements-completed: [TMPL-01]  # the user-facing panel half of TMPL-01 lands here; the requirement marks complete at phase close (backend write+gate shipped in 100-04, sweep/pin in 100-05)

# Metrics
duration: ~5min
completed: 2026-06-10
---

# Phase 100 Plan 06: Ephemeral Template Upload — Panel Upload Affordance + Ephemeral File Card Summary

**The only user-facing surface of the phase: a panel-local Upload-template button (.docx/.pptx/.xlsx) that POSTs to the Plan 100-04 upload route and optimistically reconciles the FilesSection without a refresh, plus the kind-distinct ephemeral file card — a "Template" badge, a live expiry countdown caption (no per-second timer), an amber needs-attention tint under 1h, and per-extension office icons — with agent files rendering byte-identically (D-11).**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-06-10T16:06:32+04:00 (first task commit)
- **Completed:** 2026-06-10T16:11:05+04:00 (last task commit)
- **Tasks:** 2 (both `auto`, `tdd="true"` — the Wave 0 render stubs from Plan 100-01 are the pre-existing gate this plan flips)
- **Files modified:** 4 (224 insertions, 49 deletions across both task commits)

## Accomplishments

- **uploadWorkspaceTemplate client + WorkspaceFile type fields (Task 1, D-01/D-02):** Added `uploadWorkspaceTemplate(threadId, file)` to `api.ts` — mirrors `uploadDocument`'s FormData + Bearer shape (the NO-Content-Type detail is load-bearing so the browser sets the multipart boundary), POSTs to `/threads/{tid}/workspace/files`, returns the `WorkspaceFile` row, throws `Error(detail)` on non-2xx. `WorkspaceFile` gained optional `kind?` + `expires_at?` (absent on agent files → no badge, byte-identical render). `tsc --noEmit` clean for both files.
- **FilesSection upload button + ephemeral card (Task 2, D-01/D-02/D-03/D-04/D-11):** A panel-local "Upload template" affordance (hidden `accept=".docx,.pptx,.xlsx"` input + a quiet button at the top of the Files section — NOT the composer); on select → `uploadWorkspaceTemplate` → optimistic `setWorkspaceFileForThread` upsert (panel reconciles, no refresh, D-03) → inline error caption on failure, nothing in chat (D-04). A `kind='template_input'` row renders a "Template" badge + a live countdown (`expiryCaption` — `expires in 23h` / `expires in 45m` / `expired`, computed on render, NO per-second timer) + an `text-amber-500` needs-attention tint when `isNearExpiry` (< 1h). `iconFor` gained per-extension office icons (docx→`FileText`, xlsx→`FileSpreadsheet`, pptx→`Presentation`) before the generic fallthrough. An agent file (no `kind`/`expires_at`) renders byte-identically (D-11).
- **Flipped the 3 Plan-01 render stubs GREEN (Task 2):** Un-skipped `it.skip` → `it` for the Template badge + `/expires in \d+h/` caption, the amber needs-attention class, and the per-extension office icon; the D-11 agent-file no-badge guard stays green. FilesSection suite: **11 passed / 0 skipped** (up from the 8-passed/3-skipped baseline).

## Task Commits

Each task was committed atomically (worktree, `--no-verify` per parallel-executor protocol):

1. **Task 1: uploadWorkspaceTemplate client + WorkspaceFile kind/expires_at** — `386fd99b` (feat)
2. **Task 2: FilesSection upload button + Template badge/countdown/amber + per-ext icons** — `3d4bf1fb` (feat)

_Note: both are `feat(...)` commits. The RED gate for this TDD plan is the pre-existing Wave 0 stub set (Plan 100-01's `FilesSection.test.tsx` — 3 `it.skip` render stubs); these two commits are the GREEN production code that flips them. Task 1 lands the client + types; Task 2 lands the markup + un-skips the stubs in the same commit (the markup and its now-passing test ship together)._

## Files Created/Modified

- `frontend/src/lib/api.ts` (modified, +25) — `uploadWorkspaceTemplate(threadId, file)` FormData+Bearer client (no Content-Type); `WorkspaceFile` already imported from `../types`.
- `frontend/src/types/index.ts` (modified, +2) — `WorkspaceFile.kind?: string` + `WorkspaceFile.expires_at?: string` (optional, absent on agent files).
- `frontend/src/components/panel/FilesSection.tsx` (modified, +197/−49) — `Presentation`/`Upload` lucide imports + `useStreamActions` + `uploadWorkspaceTemplate` import; per-ext office icons in `iconFor`; module-level `expiryCaption`/`isNearExpiry` helpers; upload state (`fileInputRef`/`uploadError`/`uploading`) + `handleUpload`/`onFileInputChange`; the `uploadAffordance` JSX (hidden input + button + inline error) rendered in both the empty state and the populated list; the Template badge + countdown + amber block in each `kind='template_input'` row.
- `frontend/src/components/panel/__tests__/FilesSection.test.tsx` (modified, +36/−... within the same commit) — added the `useStreamActions` + `@/lib/api` mocks (so importing FilesSection never hits the real fetch path), tabbed past the new upload button in the keyboard-nav case (DOM order shift, contract unchanged), un-skipped the 3 render stubs.
- `.planning/phases/100-ephemeral-template-upload/deferred-items.md` (created) — logs the pre-existing `PhaseReconcile.test.tsx` worktree-env failure (out of scope).

## Verification Results

- **FilesSection vitest** `vitest run FilesSection`: **11 passed / 0 skipped** (baseline was 8 passed / 3 skipped). The 3 flipped stubs (`template file renders a Template badge + /expires in \d+h/ caption`, `a soon-to-expire template caption carries the amber needs-attention class`, `a docx/pptx/xlsx template renders a distinct per-extension icon (not FileIcon)`) all pass; the D-11 `agent file (no kind/expires_at) renders NO Template badge, NO countdown` guard stays green. **Net-new vs the Plan-01 FilesSection baseline = +3 green, 0 regressions.**
- **tsc** `tsc --noEmit`: clean for `api.ts`, `types/index.ts`, `FilesSection.tsx` (no NEW errors in any of the three).
- **Task 2 acceptance greps (all match):** `uploadWorkspaceTemplate` (2), `accept=".docx,.pptx,.xlsx"` (1), `Template` (6), `expiryCaption` (2) + `isNearExpiry` (2), `amber` (2), `kind === "template_input"` (1). **`setInterval` = 0** (no per-second timer — criterion met).
- **Panel-suite regression** `vitest run src/components/panel`: **130 tests passed**; 1 suite FILE failed to collect (`PhaseReconcile.test.tsx` — `supabaseUrl is required`, a pre-existing worktree-env error; the file does NOT import FilesSection, reproduces identically in isolation, logged to `deferred-items.md`). **Net-new failures caused by this plan = 0.**
- **Scope check:** `git diff --diff-filter=D` over both commits = **zero file deletions**; no untracked source files; STATE.md / ROADMAP.md NOT touched.

## Decisions Made

None beyond the plan's intent — executed as specified. Reaffirming the load-bearing plan choices:
- **amber = literal `text-amber-500`:** the Plan-01 test asserts `caption.className.toMatch(/amber/)` and the sketch color-language names amber = needs-attention, so the literal Tailwind amber class is correct here (not the panel's semantic `--warning` token, which would fail the grep).
- **Per-extension icon keyed on ext OR OOXML mime:** the path extension is the reliable signal for the `.docx/.pptx/.xlsx` allowlist; the long OOXML mimes are the secondary match. Checked before the generic fallthrough so a template never falls through to the generic `lucide-file`.
- **`setWorkspaceFileForThread` via `useStreamActions()`:** used the existing actions accessor (StreamsProvider untouched — G-5 hot file stays satisfied), not a new dedicated hook.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hidden file input lacked an accessible label → axe regression**
- **Found during:** Task 2 (the two pre-existing FilesSection axe tests went red)
- **Issue:** The new hidden `<input type="file">` tripped axe's "form elements must have labels" rule, breaking the populated-listbox + empty-state axe tests (a11y regression directly caused by the Task 2 markup).
- **Fix:** Added `aria-label="Upload template file"` + `tabIndex={-1}` to the hidden input (it is `hidden` and only triggered programmatically by the button click, so it should never be a tab stop).
- **Files modified:** frontend/src/components/panel/FilesSection.tsx
- **Verification:** Both axe tests green again; FilesSection suite 11/11.
- **Committed in:** `3d4bf1fb` (Task 2 commit)

**2. [Rule 1 - Bug] Keyboard-nav test broke on the new DOM order**
- **Found during:** Task 2 (the `Enter on a focused row opens the preview` test went red)
- **Issue:** The "Upload template" button is now the first tab stop above the listbox, so the test's single `user.tab()` landed on the button (and `{Enter}` opened the file picker) instead of the roving-tabindex active row. The keyboard CONTRACT is unchanged — only the DOM order shifted.
- **Fix:** Added a second `user.tab()` (Upload button → active row) so the test reaches the row before pressing Enter; documented the shift in a comment.
- **Files modified:** frontend/src/components/panel/__tests__/FilesSection.test.tsx
- **Verification:** The keyboard-path test green again; full suite 11/11.
- **Committed in:** `3d4bf1fb` (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (both Rule 1 — a11y label + a test-DOM-order reconciliation, both directly caused by the Task 2 upload affordance).
**Impact on plan:** No scope creep. Both adaptations preserve the plan's exact behavioral intent; every acceptance criterion and must_haves link is satisfied. The upload affordance is the planned D-01 surface; the fixes only make it accessible and keep the existing a11y/keyboard contracts green.

## Issues Encountered

- **Worktree had no `frontend/node_modules`** — provisioned a Windows directory junction to the main checkout's `node_modules` (created via the main venv Python's `subprocess` mklink, since the Bash tool mangles bare `C:\...` paths into doubled-drive `C:\C:\...`). Ran vitest/tsc via `node node_modules/vitest/vitest.mjs` / `node node_modules/typescript/bin/tsc` directly (the `.bin` shims don't resolve through the junction). **The junction was removed before returning** (`rmdir` the link only — never `rm -rf`).
- **`PhaseReconcile.test.tsx` collection failure** (`supabaseUrl is required`) — a pre-existing worktree-env issue (missing `VITE_SUPABASE_URL`), NOT caused by this plan; the file does not import FilesSection. Logged to `deferred-items.md`, left untouched.

## User Setup Required

None - no external service configuration required. (The upload route, REST gates, and migration 068 columns this UI consumes all shipped in Plans 100-02/03/04, applied operator-side.)

## Threat Surface Scan

No new threat surface beyond the plan's `<threat_model>`. All three registered threats are addressed:
- **T-100-06-01 (Tampering — client bypasses accept= filter):** the `accept=".docx,.pptx,.xlsx"` attribute is UX only; the server's `validate_ooxml` (Plan 100-04, D-12) is the real gate and rejects anything non-OOXML regardless of what the client sends. Defense is at the route, not the picker.
- **T-100-06-02 (Information Disclosure — XSS via uploaded filename in the badge):** the filename/path renders as React text-children (no `dangerouslySetInnerHTML`) — escaped, no HTML injection surface. The inline upload-error caption also renders the server `detail` as text-children.
- **T-100-06-03 (Spoofing — stale countdown shows a live file that expired):** accepted — the countdown is a UI hint; the server read-path filter (Plans 100-03/04) is the authoritative guarantee. An expired file vanishes on the next reconcile/refetch (D-03); a briefly-stale caption never grants access.

## Known Stubs

None introduced by this plan. The upload-reconcile flow's live exercise (button click → POST → panel upsert) is a G-4 UAT row, not a stub — the unit tests cover the render contract (badge/countdown/amber/icon/no-badge) and the upload client is mocked in the suite (the live fetch path is operator-verified). No hardcoded empty values flow to render; the template chrome is fully wired to `file.kind`/`file.expires_at` from the live GET response.

## Next Phase Readiness

- **Phase 101 (Template-Fill + Integrity Validation)** consumes this plan's surface: the uploaded `template_input` file (with its `kind` + `expires_at`) is the input the fill workflow retrieves by `kind='template_input'` in-thread; the optimistic-reconcile pattern (`uploadWorkspaceTemplate` → `setWorkspaceFileForThread`) is the same loop the fill OUTPUT can reuse to surface the produced deliverable in the panel.
- **TMPL-01 is now end-to-end:** backend write+gate (100-04) + sweep/run-pin lifecycle (100-05) + the user-facing panel upload + ephemeral card (this plan). The requirement marks complete at phase close; phase verification confirms via the G-4 live UAT rows (upload → badge/countdown visible → expiry vanishes → nothing in chat).
- No blockers. StreamsProvider was NOT grown (G-5 hot file stays satisfied); the only new wiring is the existing `useStreamActions` accessor + the `uploadWorkspaceTemplate` client.

## Self-Check: PASSED

- FOUND: frontend/src/lib/api.ts
- FOUND: frontend/src/types/index.ts
- FOUND: frontend/src/components/panel/FilesSection.tsx
- FOUND: frontend/src/components/panel/__tests__/FilesSection.test.tsx
- FOUND: .planning/phases/100-ephemeral-template-upload/100-06-SUMMARY.md
- FOUND commit: 386fd99b (Task 1)
- FOUND commit: 3d4bf1fb (Task 2)

---
*Phase: 100-ephemeral-template-upload*
*Completed: 2026-06-10*
