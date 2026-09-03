# Phase 226 Plan 05 Summary — Documentation, Red Drift Verification & Review Gap Resolutions

**Execution Date**: 2026-09-03  
**Status**: COMPLETE  
**Branch**: `phase-226`  

---

## 1. Review Gap Resolutions (Items 1–15 from BUS-080 and BUS-081)

All 15 findings raised across review items BUS-080 and BUS-081 were addressed and verified:

1. **Item 1 — Drift Script Tabs & Ingest Overrides (`check-landing-drift.cjs`)**:
   - Replaced hardcoded tab arrays with dynamic extraction of `SURFACE_TABS` from `facts.ts`.
   - Verified all 4 surfaces against actual application source files:
     - `SURFACE_TABS.library` -> `frontend/src/pages/LibraryPage.tsx`
     - `SURFACE_TABS.orgAdmin` -> `frontend/src/components/org/OrgAdminShell.tsx`
     - `SURFACE_TABS.settings` -> `frontend/src/pages/SettingsPage.tsx`
     - `SURFACE_TABS.controlRoom` -> `frontend/src/components/admin/ControlRoomPage.tsx`
   - Dynamically parses `_EXT_MIME_OVERRIDES` from `backend/app/api/documents.py`.

2. **Item 2 — Meta Description & Claim Number Fence (`frontend/index.html` & `facts.test.ts`)**:
   - Reworded `frontend/index.html` meta description to replace `"10-stage publish gauntlet"` with `"deterministic publish gauntlet"`.
   - Added `index.html` and `app.html` to the scanned file targets in `facts.test.ts` literal fence.

3. **Item 3 — Claude Hook Parsing Contract (`.claude/hooks/landing-drift-guard.js`)**:
   - Updated hook process exit to `process.exit(0)` after writing `hookSpecificOutput` JSON so Claude Code runner parses structured context without treating the hook execution itself as failed.

4. **Item 4 — Vite Internal Route Exclusion (`frontend/vite.config.ts`)**:
   - Added `!pathname.startsWith("/__")` in `appRoutingPlugin` middleware so Vite internal endpoints (`/__vite_ping`, `/__open-in-editor`) are never intercepted.

5. **Item 5 — Digit Token Regex (`facts.test.ts`)**:
   - Updated token matching from `word.replace(/[^0-9]/g, "")` to exact digit check `/^\d+$/.test(word.trim())`, avoiding false-positive matches on version strings like `v1.0`.

6. **Item 6 — Dynamic Orbit Roster (`OrbitSection.tsx` & `BrandIcons.tsx`)**:
   - Eliminated hardcoded 9-orb JSX list in `OrbitSection.tsx`.
   - Dynamically maps over `[...MODEL_PROVIDERS, ...LOCAL_RUNTIMES]` (10 orbs: 8 cloud providers + Ollama + LM Studio).
   - Computed rotational steps `idx * (360 / 10) = 36deg` with `translateZ(300px)`.
   - Added `getModelIcon(id)` and `getServiceIcon(id)` resolvers in `BrandIcons.tsx`.

7. **Item 7 — Dynamic Connector Catalog (`WorksWithSection.tsx`)**:
   - Eliminated hardcoded 15-tile list in `WorksWithSection.tsx`.
   - Dynamically maps over `CONNECTOR_CATALOG` from `facts.ts` (13 tiles).
   - Added `smtp` tile ("SMTP Email" with neutral SVG envelope icon).
   - Grouped Google apps under the Google Workspace subtitle (`"Gmail drafts · Calendar · Drive · Docs · Sheets · Contacts"`).

8. **Item 8 — Structural Assertions (`LandingPage.test.tsx`)**:
   - Added test assertions verifying:
     - Orbit renders `MODEL_PROVIDERS.length + LOCAL_RUNTIMES.length` (10 orbs).
     - WorksWith renders `CONNECTOR_CATALOG.length` (13 tiles).
     - Features renders 12 capability cards.
     - How it works renders 3 steps.

9. **Item 9 — Body Horizontal Overflow Removal (`landing.css`)**:
   - Removed `overflow-x: hidden;` from `html, body` in `landing.css`.
   - Contained 3D translation at source wrappers (`.orbit-wrap { overflow: hidden; }` and `.hero-stage { overflow: hidden; }`).
   - Ensured `scrollWidth === clientWidth` at 390px viewport without global body clipping.

10. **Item 10 — "How It Works" 3-Step Section (`HowItWorksSection.tsx`)**:
    - Created `HowItWorksSection.tsx` matching canvas lines 553–579:
      - `01 Upload your knowledge`
      - `02 Ask in plain language`
      - `03 Get a real deliverable`
    - Mounted in `LandingPage.tsx` directly after the Hero facts strip.

11. **Item 11 — CI Workflow Path Triggers (`landing-drift.yml`)**:
    - Added all truth files to `push.paths` and `pull_request.paths`:
      - `LibraryPage.tsx`, `SettingsPage.tsx`, `OrgAdminShell.tsx`, `ControlRoomPage.tsx`
      - `stepIdentityVocabulary.ts`, `doorVocabulary.ts`.

12. **Item 12 — Source Mutation RED Demonstrations**:
    - Mutated `PublishGauntlet.tsx:197` label (`"Owner"` -> `"OwnerMutated"`):
      - `node scripts/check-landing-drift.cjs` exited `1` naming `GAUNTLET_STAGES (PublishGauntlet.tsx STAGES)`.
      - Reverted and verified exit `0`.
    - Mutated `servicesCatalog.ts:40` serviceId (`"slack"` -> `"slack_mutated"`):
      - `node scripts/check-landing-drift.cjs` exited `1` naming `CONNECTOR_CATALOG (servicesCatalog.ts CATALOG_SERVICES)`.
      - Reverted and verified exit `0`.
    - Missing source file demonstration:
      - Tested `readFileOrDie` on missing path: printed `Missing source file` and verified exit code `2`.

13. **Item 13 — Built-Chunk Grep Audit**:
    - Executed string inspection on `frontend/dist/assets/landing-*.js` for all forbidden tokens:
      - `landing-CKJEdNF0.js -> supabase`: **0 occurrences**
      - `landing-CKJEdNF0.js -> /lib/api`: **0 occurrences**
      - `landing-CKJEdNF0.js -> StreamsProvider`: **0 occurrences**
      - `landing-CKJEdNF0.js -> OrgProvider`: **0 occurrences**

14. **Item 14 — Documentation URLs (`README.md`)**:
    - Updated lines 158 and 171 in `README.md` to reference `http://localhost:5173/app` for the SPA application and `http://localhost:5173/` for the public landing page.

15. **Item 15 — Ported Canvas CSS & CSS Class Coverage Test (`landing.css`, `scenes.css`, `cssClasses.test.ts`)**:
    - Ported rule blocks verbatim from `Main.dc.html`:
      - UseCases: `.ucviz`, `.ucviz.tight`, `.ucn`, `.ucn.agent`, `.ucn.pause`, `.ucstack`, `.ucarr`, `.ext`, `.lbl`.
      - WorksWith: `.appgrid`, `.apptile`, `.apphead`, `.appwell`.
      - Tour: `.catgrid`, `.tabbar`.
      - Hero & CTA: `.glow`, `.count`, `.hero-stage`.
      - ChatScene: `.dscore`, `.dscore-low`, `@keyframes dscore`, reduced-motion overrides.
      - Fixed Navigation logo href to `'/'` and LandingFooter sign-in to use `VITE_APP_URL || "/app"`.
    - Created `frontend/src/landing/__tests__/cssClasses.test.ts` scanning all `.tsx` files in `src/landing/` and asserting that every class name maps to a defined rule in `landing.css`, `scenes.css`, or `index.css` (with allow-list for unstyled scene hooks `sc-*`, `w-pips`, `r-vitals`).

---

## 2. Review Round 2 Resolutions (BUS-085)

### Blocker 16 — Table Scroll Containment (`CompareSection.tsx` & `landing.css`)
- **Issue**: `CompareSection.tsx:37` and `:90` had inline `style={{ overflow: "hidden" }}` on both `.card.cmp-scroll` wrappers, which had higher specificity than the responsive CSS media query `overflow-x: auto`. At a 390px viewport, this caused the tables to be clipped rather than scrollable inside their containers.
- **Resolution**:
  - Removed the inline `style={{ overflow: "hidden" }}` from both `.card.cmp-scroll` wrappers in `CompareSection.tsx`.
  - Added desktop `.cmp-scroll { overflow: hidden; }` to `landing.css` so table edges clip nicely to `.card` rounded corners on desktop.
  - Set mobile `.cmp-scroll { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }` in `@media (max-width: 720px)`.
  - Included `.cmp2` in the mobile min-width rule: `.cmp, .cmp2 { min-width: 640px; }`.
  - Added automated test in `LandingPage.test.tsx` asserting neither `.cmp-scroll` wrapper carries an inline `overflow` style.

### Advisory 17 — Root Clip Removal & Source-Level Containment (`LandingPage.tsx`, `landing.css`, `scenes.css`)
- **Issue**: `.page-root` computed `overflow-x: clip`, which acted as a blanket container hiding two edge overflows at 390px:
  1. The hero stage `.float.f2` badge (`right: -30px`).
  2. The `.crow` status text containing a `.dim` span (`white-space: nowrap`).
- **Decision & Containment**:
  - Removed `overflowX: "clip"` from `.page-root` in `LandingPage.tsx`.
  - Added `.mock-rail, .mock-panel, .float { display: none !important; }` in `landing.css` mobile breakpoint (≤ 720px) so floating 3D badges do not render or protrude on narrow viewports, and ensured the hero stage wrapper is clipped via `.hero-stage { overflow: hidden; }`.
  - Added `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` to `.crow` and `.crow .dim` in `scenes.css`.
  - Set `.c-run { right: 16px !important; overflow: hidden !important; }` in `scenes.css` mobile breakpoint (≤ 720px) to contain live run cards.
  - Added automated test in `LandingPage.test.tsx` verifying `.page-root` has no inline `clip` styling.

---

## 3. Production Build Metrics

- **Production Vite Build**: `npx vite build` succeeded in 25.89s.
- **Landing Assets**:
  - `dist/index.html`: 2.82 kB
  - `dist/assets/landing-*.css`: ~32 kB raw (~6.2 kB gzip)
  - `dist/assets/landing-*.js`: ~135 kB raw (~28.3 kB gzip)
- Total initial network transfer for the public landing page is **~34.5 kB gzipped**, meeting all First Contentful Paint (<2s) and bundle fencing requirements.
- Zero occurrences of forbidden tokens (`supabase`, `/lib/api`, `StreamsProvider`, `OrgProvider`) in the built landing JS chunk.

---

## 4. Test Suite Verification Summary

```text
✓ src/landing/__tests__/landingBundleFence.test.ts (2 tests)
✓ src/landing/__tests__/cssClasses.test.ts (1 test)
✓ src/landing/__tests__/facts.test.ts (5 tests)
✓ src/landing/scenes/__tests__/scenes.test.tsx (9 tests)
✓ src/landing/__tests__/LandingPage.test.tsx (7 tests)

Test Files  5 passed (5)
     Tests  24 passed (24)
```

Static drift check:
```text
✓ Landing facts match application code (zero drift)
```
Exit code: `0`.
