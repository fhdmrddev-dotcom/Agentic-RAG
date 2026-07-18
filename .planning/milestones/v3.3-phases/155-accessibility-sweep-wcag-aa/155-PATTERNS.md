# Phase 155: Accessibility Sweep — WCAG AA - Pattern Map

**Mapped:** 2026-07-15
**Files analyzed:** 8 categories (per-surface a11y suites, eslint config, package.json, CI workflow, index.css tokens, opacity sweep ~42 files, icon-button sweep, SEED-remainder doc)
**Analogs found:** 6 / 7 (only the SEED-remainder follow-up doc has no code analog — it follows the seed-template, not a code pattern)

> This is a **remediation + regression-lock** phase, not a feature phase. Almost every "new" file is a *copy* of an already-shipped pattern (the two reference `*.a11y.test.tsx` suites) or an *additive edit* to an existing config/token/markup file. There is very little net-new authoring — the analogs below are near-exact templates.

## File Classification

| New/Modified File(s) | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `frontend/src/components/admin/__tests__/<Sub>.a11y.test.tsx` (per net-new admin sub-component) | test | request-response (render + axe scan) | `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx` | exact |
| `frontend/src/pages/__tests__/RunModal.a11y.test.tsx` (152 Run modal + file input) | test | request-response | `RelationshipsSection.a11y.test.tsx` (has dialog + combobox states) | exact |
| `frontend/src/components/chat/{CitedMarkdown,CitationPeek,CitationList,CitationCard,AbsenceHint}.a11y.test.tsx` (153, verify-not-rebuild) | test | request-response | `DocumentDetailPanel.a11y.test.tsx` (role/aria contract asserts) | exact |
| `SettingsPage.a11y.test.tsx` / `MessageInput.a11y.test.tsx` / `DocumentStatusBadge.a11y.test.tsx` (154 surfaces) | test | request-response | `DocumentDetailPanel.a11y.test.tsx` | exact |
| `frontend/eslint.config.js` (add jsx-a11y — D-02) | config | build tooling | itself (additive spread into the flat-config array) | exact (self) |
| `frontend/package.json` (one dev dep — D-02) | config | build tooling | existing `devDependencies` block | exact (self) |
| `.github/workflows/frontend-tests.yml` (add `npm run lint` step — CI gap) | config | CI | the existing `vitest` job's `Install + test` step | role-match |
| `frontend/src/index.css` (lift `--muted-foreground-dim`, extend contrast math — D-04) | config | CDN/static tokens | the shipped Phase 088-05 `--panel-muted-foreground-dim` block (`index.css` L123-132) | exact (in-file precedent) |
| ~42 files: sweep `text-muted-foreground/{60,50,40,70}` → real tokens (D-04) | component/utility | transform (className swap) | the token-usage note in the citation CSS block (`index.css` L671) — "meaningful muted text uses `--muted-foreground`, never the dim trap" | role-match (mechanical) |
| Icon-button `aria-label` sweep app-wide (D-05) | component | markup | `CitationPeek.tsx` L148-149 (state-toggled `aria-pressed` + `aria-label`) + Run-modal `aria-label="Remove template"` | exact |
| `.planning/seeds/SEED-092-remainder.md` (D-06 follow-up list) | doc | — | no code analog — follows the seed-file template | **none** |

## Pattern Assignments

### Per-surface a11y suites — `*.a11y.test.tsx` (test, render + axe scan)

**Primary analog:** `frontend/src/components/relationships/RelationshipsSection.a11y.test.tsx`
**Secondary analog (richer contract asserts):** `frontend/src/components/metadata/DocumentDetailPanel.a11y.test.tsx`

Both are ≤240 lines, fully in context. **Copy this shape verbatim per net-new surface.** The matcher (`toHaveNoViolations`) is already globally extended in `frontend/src/setupTests.ts` (L6-8) — no per-file setup.

**Imports + mock pattern** (`RelationshipsSection.a11y.test.tsx` L13-46) — the deterministic-settle recipe every suite uses:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, waitFor, cleanup } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { axe } from "vitest-axe"                       // matcher extended in setupTests.ts

// Mock @/lib/supabase so real api.ts module-load never builds a real client:
vi.mock("@/lib/supabase", () => ({
  supabase: { auth: { getSession: vi.fn().mockResolvedValue({
    data: { session: { user: { id: "user-1" }, access_token: "token" } } }) },
    channel: vi.fn(), removeChannel: vi.fn() },
}))
// Partial-mock @/lib/api: keep everything real, override the surface's fetches to settle deterministically.
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api")
  return { ...actual, /* listX: (...a) => listX(...a) */ }
})

afterEach(() => { cleanup(); vi.clearAllMocks() })
```

**Core axe-scan-across-states pattern** (`RelationshipsSection.a11y.test.tsx` L101-136) — one `it` per honest state, each renders → waits for settle → scans:
```typescript
it("no aXe AA violations — populated", async () => {
  const { container } = render(<Surface docId="doc-1" />)
  await screen.findByText("old-policy.pdf")            // prove render settled BEFORE scanning
  expect(await axe(container)).toHaveNoViolations()    // STRUCTURAL rules only (see contrast note)
})
it("no aXe AA violations — empty",   async () => { /* mockResolvedValueOnce empty  */ })
it("no aXe AA violations — error",   async () => { /* mockRejectedValueOnce; findByRole("alert") */ })
it("loading is role=status and error is role=alert (distinct)", async () => { /* unresolved promise */ })
```

**Role/aria contract asserts** (`DocumentDetailPanel.a11y.test.tsx` L126-152) — assert the named ARIA contract, not just "no violations":
```typescript
const head = await screen.findByRole("button", { name: /^details/i })
expect(head).toHaveAttribute("aria-expanded")
expect(head).toHaveAttribute("aria-controls")
expect(screen.getByRole("region", { name: /details/i })).toBeInTheDocument()
// never-color-alone: assert a visible WORD is present, not just a hue
expect(screen.getByText(/High/)).toBeInTheDocument()
```

**Icon-only-control accessible-name assert** (`RelationshipsSection.a11y.test.tsx` L140-153) — the exact template for the D-05 sweep's regression proof:
```typescript
const remove = screen.getByRole("button", { name: /remove supersedes link to old-policy.pdf/i })
expect(remove).toBeVisible()   // in the a11y tree, queryable by role+name — never hover-gated out
```

**Reduced-motion assert** (`DocumentDetailPanel.a11y.test.tsx` L205-234) — jsdom has no `matchMedia`; stub it, then assert the element STILL renders:
```typescript
Object.defineProperty(window, "matchMedia", { writable: true, configurable: true,
  value: vi.fn().mockImplementation((q: string) => ({
    matches: q.includes("prefers-reduced-motion"), media: q, onchange: null,
    addEventListener: vi.fn(), removeEventListener: vi.fn(),
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn() })) })
```

**D-14 documented per-rule exclusion** (RESEARCH Code Examples — encode the exclusion IN the test so review sees it; NEVER a global disable):
```typescript
const results = await axe(container, {
  rules: { "some-rule-id": { enabled: false } }, // WHY: <upstream link>. Also in VALIDATION.md.
})
expect(results).toHaveNoViolations()
```

**CRITICAL — contrast is a no-op here.** Both reference suites deliberately assert only STRUCTURAL rules (roles/aria/names). jsdom cannot compute `color-contrast` (no layout engine) — a green suite does NOT prove contrast. That half lives ONLY in the live Chrome DevTools scan (D-01 HYBRID / D-03). Do not add a "verify contrast" assertion to any vitest suite.

**Placement:** co-locate in the surface's `__tests__/` dir where one exists (admin `CapabilityGrid`, `ActiveRunsSection`, `ModelDiscoveryPanel`, `ModelRegistryTab`, `ControlRoomPage` already have `__tests__/`), else alongside the component (matches the two reference suites, which sit next to their components). For the Control Room, scan each tab-panel SUB-component in isolation (inactive tabs are not rendered by the custom `role="tablist"` — a single page-level scan misses 4 of 5 tabs; RESEARCH Pitfall 3).

---

### `frontend/eslint.config.js` (config, build tooling — D-02)

**Analog:** the file itself — an ESLint 9 flat config using `defineConfig([...])`. The change is a one-line additive spread; no restructure.

**Current state** (L1-23) — react-hooks + react-refresh only, no a11y:
```javascript
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  { files: ['**/*.{ts,tsx}'], extends: [ js.configs.recommended, tseslint.configs.recommended,
      reactHooks.configs.flat.recommended, reactRefresh.configs.vite ],
    languageOptions: { ecmaVersion: 2020, globals: globals.browser } },
])
```

**Edit (D-02):** add `import jsxA11y from 'eslint-plugin-jsx-a11y'` and spread `jsxA11y.flatConfigs.recommended` into the array (`recommended` already sets rules at **error** severity — no manual escalation). Use `recommended`, NOT `strict` (strict balloons the sweep past the D-06 scope line). Any rule that lands as `warn` gets pinned to `error` explicitly.

---

### `frontend/package.json` (config — D-02)

**Analog:** the existing `devDependencies` block + `scripts` block (both present in-file). The `lint` script **already exists** — `"lint": "eslint ."` (L9). Only the dev dep is net-new:
```bash
cd frontend && npm install --save-dev eslint-plugin-jsx-a11y@6.10.2
```
`@axe-core/playwright` is explicitly NOT added (D-01a — presumes the rotted Playwright harness, SEED-049).

---

### `.github/workflows/frontend-tests.yml` (config, CI)

**Analog:** the existing `vitest` job's `Install + test` step (L38-42). The lint gate is currently **never run in CI** (`npm test` = vitest only; `npm run build` = `tsc -b && vite build`, no eslint). Without this step, D-02's "regressions cannot merge" is not enforced.

**Existing step to mirror** (L38-42):
```yaml
      - name: Install + test
        run: |
          cd frontend
          npm ci
          npm test
```

**Add** (into the `vitest` job — `npm run lint` = `eslint .`):
```yaml
      - name: Lint (jsx-a11y as errors)
        run: |
          cd frontend
          npm run lint
```

---

### `frontend/src/index.css` (config, design tokens — D-04)

**Analog:** the shipped **Phase 088-05 panel-scoped fix in the SAME file** (L123-132) — the proven AA-passing values + the documented-math convention D-04 says to "extend". This is an in-file precedent, not a foreign analog.

**The proven precedent** (L123-132) — panel-scoped tokens already lift muted text to 65-70% L for AA, with the contrast math documented inline:
```css
/* Phase 088-05 (UAT SC#2 / WCAG 2.1 AA 1.4.3) — panel-scoped muted text (dark).
   The dim meta token --muted-foreground-dim (220 16% 45% = #606d85) measures
   3.59:1 on the dark --panel-surface (#0c121d) → FAILS the ≥4.5:1 floor ...
     --panel-muted-foreground-dim : 220 16% 70% (#a6aebf) → 8.42:1 on #0c121d */
--panel-muted-foreground: 220 16% 65%;
--panel-muted-foreground-dim: 220 16% 70%;
```

**The offender to retune** (L107-109) — the GLOBAL dim token, currently 45% L (fails):
```css
/* Phase 087: dim-label token for meta text (file sizes, version chips,
   diff context gutters) — one step quieter than --muted-foreground. */
--muted-foreground-dim: 220 16% 45%;   /* → lift to 220 16% 70% (mirrors the panel token; ~8:1 on bg) */
```

**Do NOT touch the base `--muted-foreground`** (L94, `220 16% 65%`) — it already passes (~7.7:1). Only the DIM token + the opacity modifiers are broken; rewriting the base token would wash out the whole app (G-6 #4). Extend the existing documented token block with the new AA math (D-04: "extend it").

**Also relevant (do NOT duplicate):** the global focus floor already ships (L177) — `:where(a, button, input, select, textarea, [tabindex]):focus-visible { outline: 2px solid hsl(var(--ring)); outline-offset: 2px; }` (Phase 088-01, zero-specificity). Reduced-motion blocks already exist (L375, L504, L757). New per-surface focus/motion CSS is NOT needed.

---

### Opacity sweep: `text-muted-foreground/{60,50,40,70}` → real tokens (transform — D-04)

**Scope (verified this session):** **133 occurrences across 42 files.** Mechanical className transform, one pattern:
- meaningful text → `text-muted-foreground` (full opacity, already ~7.7:1)
- quietest meta → `text-muted-foreground-dim` (now lifted to AA)
- **truly decorative/disabled elements stay exempt** (WCAG-allowed — e.g. `opacity-50` on a decorative graphic icon)

**The rule is documented in-file** (`index.css` L671, the citation-CSS note is the authority): *"meaningful muted text uses `--muted-foreground` (never the `--muted-foreground-dim` ~3.6:1 trap)."* The opacity modifier is the killer — `65% L @ 0.6 alpha ≈ 3.4:1` FAILS even though the base token passes.

**Highest-density offender files** (from the count) to prioritize: `AuditTab.tsx` (13), `ToolCallPanel.tsx` (9 — G-5-adjacent, additive className only), `UsersAndAccess.tsx` (8), `RunHistory.tsx` (8), `HealthSignals.tsx` (6), `ModelRegistryTab.tsx` (6), `VersionsTab.tsx` (6), `RuleBuilderPanel.tsx` (6), `MessageInput.tsx` (5), `ExecuteCodeBody.tsx` (5).

---

### Icon-button `aria-label` sweep (markup — D-05)

**Analog (state-toggled — the gold pattern):** `frontend/src/components/chat/CitationPeek.tsx` L148-149 — a toggle button whose label AND `aria-pressed` reflect state:
```tsx
aria-pressed={pinned}
aria-label={pinned ? `Unpin citation ${n}` : `Pin citation ${n}`}
```

**Analog (static icon-only — already correct):** the Run-modal remove button (`WorkflowsPage.tsx` L1212-1223) and Stop button (`NavPanel.tsx` L204-212):
```tsx
<button type="button" aria-label="Remove template" onClick={...}>
  <X className="h-3 w-3" aria-hidden="true" />   {/* icon marked decorative */}
</button>
```
Note the `aria-hidden="true"` on the inner `<Icon>` — the label lives on the button, the glyph is decorative. ~199 aria-labels already exist app-wide; the sweep closes the gap, it does not invent a pattern.

**Named offenders in `NavPanel.tsx`** (RESEARCH — verify against fresh live scan, counts shifted since the 2026-06-20 baseline):
- **`<span onClick>` row-menu trigger** (L214-222) — NOT a `<button>`, no role/name. This is a jsx-a11y `no-static-element-interactions` / `click-events-have-key-events` target — the D-02 lint will force it. Convert to `<button aria-label="Thread options">`.
- **"New Chat"** (L353-362) and **"Choose folder"** (L363-375) use `title=` only. axe ACCEPTS `title` as an accessible name (so these may NOT be axe `button-name` failures), but `title` is tooltip-only UX — prefer `aria-label` (announced consistently). The live `button-name` scan (D-03) enumerates the real failing set.

**aria-label copy:** plain-language, consistent with the 154 term-map (`frontend/src/lib/termMap.ts`) where a term exists (Claude's Discretion, D-05).

---

### `.planning/seeds/SEED-092-remainder.md` (doc — D-06)

**No code analog.** Follow the existing seed-file format under `.planning/seeds/` (see `SEED-092-*.md` and `SEED-049-e2e-suite-revival.md` for structure). This is the documented follow-up list capturing every pre-existing finding OUTSIDE the scope line (focus-visible gaps on old pages, heading order, missing alt, full screen-reader UX pass) — visible, explicitly NOT fixed this phase, with a `re_open_trigger` pointing at the future polish slot.

## Shared Patterns

### axe matcher setup (already global — do NOT re-add per file)
**Source:** `frontend/src/setupTests.ts` L6-8 (loaded via `vitest.config.ts` `setupFiles`)
**Apply to:** every `*.a11y.test.tsx` — just `import { axe } from "vitest-axe"` and call it; the matcher is already extended:
```typescript
import * as axeMatchers from "vitest-axe/matchers"
import { expect } from "vitest"
expect.extend(axeMatchers)
```

### Deterministic-settle mocking
**Source:** `RelationshipsSection.a11y.test.tsx` L19-44 / `DocumentDetailPanel.a11y.test.tsx` L22-54
**Apply to:** every new a11y suite that renders a data-fetching surface — mock `@/lib/supabase` (auth) + partial-mock `@/lib/api` (override only that surface's fetches, keep the rest real), then `await screen.findBy…` a settled node BEFORE calling `axe()`.

### Honest-states role vocabulary (assert, don't just scan)
**Source:** both reference suites — loading = `role="status"` (`aria-live="polite"`), error = `role="alert"` (assertive), success receipt = `role="status"`, non-modal dialog = `role="dialog" aria-modal="false"`.
**Apply to:** admin suites (ActiveRunsSection loading/error), Run-modal (`launchError` is already `role="alert"`, `WorkflowsPage.tsx` L1243), citation suites (peek dialog).

### Global focus floor + reduced-motion (already ship — do NOT duplicate)
**Source:** `frontend/src/index.css` L177 (focus floor, Phase 088-01) + L375/L504/L757 (`@media (prefers-reduced-motion: reduce)` blocks).
**Apply to:** all surfaces — no new per-component focus rings or motion queries needed. The D-13/G-5 rule: inside `MessageItem.tsx` / `StreamsProvider.tsx`, ONLY additive aria attributes — never render/stream-logic edits.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `.planning/seeds/SEED-092-remainder.md` | doc | — | Planning artifact, not code. Follow the `.planning/seeds/` seed-file template (frontmatter + `re_open_trigger`), not a code pattern. |

*Every code file to be created or modified has a strong in-repo analog — this phase copies/extends shipped patterns rather than authoring new ones.*

## Metadata

**Analog search scope:** `frontend/src/components/{metadata,relationships,chat,layout,admin}/`, `frontend/src/pages/`, `frontend/src/index.css`, `frontend/eslint.config.js`, `frontend/src/setupTests.ts`, `frontend/package.json`, `.github/workflows/frontend-tests.yml`
**Files scanned:** 12 read in full/targeted + 3 grep sweeps (opacity offenders = 133/42 files; NavPanel + CitationPeek aria; index.css tokens/focus)
**Pattern extraction date:** 2026-07-15
