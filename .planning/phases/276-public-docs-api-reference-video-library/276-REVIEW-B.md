---
phase: 276-public-docs-api-reference-video-library
part: B
reviewed: 2026-10-05T00:00:00Z
depth: standard
diff_base: 2b756b1cd
files_reviewed: 86
files_reviewed_list:
  - frontend/src/App.tsx
  - frontend/src/components/auth/AuthCardShell.tsx
  - frontend/src/components/chat/ChatArea.tsx
  - frontend/src/components/chat/IrisAvatar.tsx
  - frontend/src/components/chat/MessageItem.tsx
  - frontend/src/components/chat/RunCard.test.tsx
  - frontend/src/components/chat/RunCard.tsx
  - frontend/src/components/chat/WorkingBadge.tsx
  - frontend/src/components/chat/__tests__/IrisAvatar.test.tsx
  - frontend/src/components/chat/__tests__/irisState.test.ts
  - frontend/src/components/chat/irisState.ts
  - frontend/src/components/experts/catalog/ExpertCard.tsx
  - frontend/src/components/experts/catalog/ExpertCatalogPage.tsx
  - frontend/src/components/experts/catalog/ExpertDetailModal.tsx
  - frontend/src/components/experts/catalog/__tests__/expertCatalog.test.ts
  - frontend/src/components/experts/catalog/expertCatalog.ts
  - frontend/src/components/layout/NavPanel.tsx
  - frontend/src/components/library/find/StructurePopovers.tsx
  - frontend/src/components/library/find/__tests__/FindMetaLine.test.tsx
  - frontend/src/components/library/find/__tests__/FindQuickAdd.test.tsx
  - frontend/src/components/library/find/__tests__/StructurePopovers.test.tsx
  - frontend/src/components/metadata/DocumentFileFacts.tsx
  - frontend/src/components/metadata/__tests__/DocumentDetailPanel.file270.test.tsx
  - frontend/src/components/metadata/__tests__/DocumentFileFacts.test.tsx
  - frontend/src/docs/DocsApp.tsx
  - frontend/src/docs/__tests__/ApiReference.test.tsx
  - frontend/src/docs/__tests__/Article.test.tsx
  - frontend/src/docs/__tests__/BuildStory.test.tsx
  - frontend/src/docs/__tests__/ChangelogPage.test.tsx
  - frontend/src/docs/__tests__/DocsApp.test.tsx
  - frontend/src/docs/__tests__/SearchBox.test.tsx
  - frontend/src/docs/__tests__/Stub.test.tsx
  - frontend/src/docs/__tests__/VideoSlot.test.tsx
  - frontend/src/docs/__tests__/changelog.test.ts
  - frontend/src/docs/__tests__/devRouting.test.ts
  - frontend/src/docs/__tests__/docsBundleFence.test.ts
  - frontend/src/docs/__tests__/docsContent.test.ts
  - frontend/src/docs/__tests__/docsCoverageGate.test.ts
  - frontend/src/docs/__tests__/docsVercelRouting.test.ts
  - frontend/src/docs/__tests__/helpers/docsFixture.tsx
  - frontend/src/docs/__tests__/publicOpenapi.test.ts
  - frontend/src/docs/__tests__/router.test.ts
  - frontend/src/docs/__tests__/search.test.ts
  - frontend/src/docs/components/Breadcrumbs.tsx
  - frontend/src/docs/components/Callout.tsx
  - frontend/src/docs/components/ChapterStrip.tsx
  - frontend/src/docs/components/DocBadge.tsx
  - frontend/src/docs/components/DocsHeader.tsx
  - frontend/src/docs/components/Markdown.tsx
  - frontend/src/docs/components/Pager.tsx
  - frontend/src/docs/components/SearchBox.tsx
  - frontend/src/docs/components/SearchDialog.tsx
  - frontend/src/docs/components/TocPill.tsx
  - frontend/src/docs/docs.css
  - frontend/src/docs/docsData.tsx
  - frontend/src/docs/docsManifest.ts
  - frontend/src/docs/headingId.ts
  - frontend/src/docs/icons.tsx
  - frontend/src/docs/main.tsx
  - frontend/src/docs/pages/ApiReference.tsx
  - frontend/src/docs/pages/Article.tsx
  - frontend/src/docs/pages/BuildStory.tsx
  - frontend/src/docs/pages/Changelog.tsx
  - frontend/src/docs/pages/ChangelogVersion.tsx
  - frontend/src/docs/pages/Home.tsx
  - frontend/src/docs/pages/NotFound.tsx
  - frontend/src/docs/pages/SectionIndex.tsx
  - frontend/src/docs/pages/Stub.tsx
  - frontend/src/docs/pages/copy.ts
  - frontend/src/docs/router.ts
  - frontend/src/docs/search/searchIndex.ts
  - frontend/src/docs/search/searchOptions.ts
  - frontend/src/docs/types.ts
  - frontend/src/docs/video/RemotionSlot.tsx
  - frontend/src/docs/video/VideoSlot.tsx
  - frontend/src/docs/video/YouTubeFacade.tsx
  - frontend/src/docs/video/videos.ts
  - frontend/src/docs/virtual-docs.d.ts
  - frontend/src/index.css
  - frontend/src/pages/AuthPage.tsx
  - frontend/src/pages/SetupWizard.tsx
  - frontend/src/pages/__tests__/findState.test.ts
  - frontend/src/pages/findState.ts
  - video/src/components/ui.tsx
  - video/src/energetic/kit.tsx
  - video/src/promo/SyrelPromo.tsx
findings:
  critical: 2
  warning: 5
  info: 10
  total: 17
status: issues_found
---

# Phase 276 (Part B): Code Review Report

**Reviewed:** 2026-10-05
**Depth:** standard
**Files Reviewed:** 86
**Status:** issues_found

## Summary

This part covers the public docs SPA (`frontend/src/docs`), the chat Iris avatar (`irisState`, `IrisAvatar`, and its mounts in MessageItem, RunCard, WorkingBadge, ChatArea and App), the brand-rename touches, and `video/`.

**What holds up:**
- **Markdown trust model.** `react-markdown` + `remark-gfm` runs with no raw-HTML plugin, and the default `urlTransform` drops `javascript:` links.
- **Lazy loading.** Scalar, MiniSearch, the Remotion Player and the compositions all arrive behind `import()`. The YouTube facade makes no request before the click. Scalar runs with `telemetry: false`, `agent.disabled`, `mcp.disabled` and `withDefaultFonts: false`. Every one of those keys was checked against the installed `@scalar/types` schema.
- **Single-pass decode.** `decodeEntities` decodes in one pass; `&amp;lt;` becomes `&lt;`, not `<`.
- **MessageItem.** It gained no new hook and no new store read.
- **IrisAvatar effects.** Cleanup is complete: rAF, timers and WAAPI animations are all cancelled on unmount.
- **Gradient ids.** Each instance's ids are unique and sanitised.
- **Gates.** The in-scope vitest suites pass (21 files, 253 tests). `tsc -p tsconfig.app.json` shows no errors in any reviewed source file.

**Blockers:**
1. **The Scalar API reference ships unstyled.** Its stylesheet is never imported, and the `dist/` built today contains none of its 312 KB of rules.
2. **Section deep links never scroll.** This covers every `#heading` link, whether on first load or on cross-page navigation, because the article body loads asynchronously after the scroll effect has already run.

**Warnings:**
- The avatar can sit amber ("waiting on you") on finished rows.
- The ring settle visibly snaps in roughly 10% of settles.
- In-page hash navigation steals focus to the H1. This includes Scalar's own hash routing.
- A malformed `#%` hash crashes the docs to a blank page.
- Web playback of the compositions requests `fonts.gstatic.com`, which contradicts T-276-20 and the video README's "same-origin" claim.

## Critical Issues

### CR-01: The Scalar API reference renders with no stylesheet

**File:** `frontend/src/docs/pages/ApiReference.tsx:18-19`

**Issue:** `@scalar/api-reference-react` does not inject its CSS. Its entry, `dist/index.js`, only calls `createApiReference`. The ESM `@scalar/api-reference` dist contains no `.css` import and no style injection. The 312,199-byte `@scalar/api-reference-react/dist/style.css`, which holds 1,258 `scalar-app` rules, must be imported by the host. No file in `frontend/src` imports it.

This was confirmed against the build. `frontend/dist/assets` (built 2026-10-05) holds only `app-*.css`, `docs-*.css` and `landing-*.css`. No CSS or JS asset contains a `.scalar-app{` rule, although the JS chunks do reference the `scalar-app` class. `DEEP_MIDNIGHT_CSS` (`customCss`) only sets variables and cannot stand in for the layout CSS.

The result is that `/docs/api/reference`, the DOCS-03 deliverable, mounts an unstyled Vue tree: a raw sidebar list, unstyled code blocks, and no layout.

The ApiReference tests mock `load` and never render real Scalar, so nothing could catch this.

**Fix:** Load the stylesheet with the module, behind the same dynamic import, so it stays out of first paint. The stylesheet contains only `data:` URLs, so this adds no third-party request.
```ts
const defaultLoad = (): Promise<ScalarModule> =>
  Promise.all([
    import("@scalar/api-reference-react"),
    import("@scalar/api-reference-react/style.css"),
  ]).then(([m]) => m as unknown as ScalarModule)
```
Then add a Chrome check of `/docs/api/reference` on a production build (`vite build && vite preview`). jsdom cannot see this defect.

### CR-02: Section deep links never land, on first load or across pages

**File:** `frontend/src/docs/DocsApp.tsx:120-136` (together with `frontend/src/docs/pages/Article.tsx:23-32`)

**Issue:** The scroll-to-hash logic runs in an effect keyed on `[routeKey, loc.hash]`. That effect commits in the same render that mounts `<Article>`. `Article` fetches its body through `data.loadPage(slug)`, which is a dynamic `import()` per page (`plugins/docsContent.ts:98`), so the body arrives in a later render.

When the effect runs, the `<h2 id=…>` does not exist yet, so `document.getElementById(...)` returns `null`:
- **First load** (`/docs/use/chat#stopping-a-run`): the hash is silently ignored. The browser's native fragment scroll has already given up, because parsing finished before React rendered.
- **Fresh client navigation to `/docs/x#y`** (a cross-page Markdown link, or any `navigate()` with a hash): `target` is `null`, so the code runs `window.scrollTo(0, 0)`. The reader lands at the top.

The effect never re-runs when the body arrives. As a result:
- Every "Link to this section" (`#`) anchor that `Markdown.tsx:61` renders produces a URL that does not work when shared.
- Every TOC hash someone copies is broken the same way.

No test covers hash scrolling: a grep for `scrollIntoView` and `hash` across `src/docs/__tests__` finds nothing.

**Fix:** Move the pending-hash scroll to the moment content exists. For example, let `Article` report readiness and scroll once:
```tsx
// DocsApp: keep a pending target instead of resolving it immediately
const pendingHash = useRef<string | null>(null)
// in the nav effect: pendingHash.current = loc.hash ? safeDecode(loc.hash.slice(1)) : null; try scroll; if found, clear
// pass to Article: onBodyRendered={() => { const id = pendingHash.current; if (!id) return;
//   const el = document.getElementById(id); if (el) { el.scrollIntoView(); pendingHash.current = null } }}
// Article: useEffect(() => { if (md !== null) onBodyRendered?.() }, [md])
```
Then add a test that renders `DocsApp` at `/docs/<slug>#<h2-id>` with a deferred `loadPage` and asserts that `scrollIntoView` is called on that H2 after the body resolves.

## Warnings

### WR-01: The avatar can show amber "waiting on you" on finished rows

**File:** `frontend/src/components/chat/irisState.ts:39`; related: `frontend/src/components/chat/ChatArea.tsx:766-773`, `frontend/src/providers/StreamsProvider.tsx:3167-3177`

**Issue:** The waiting check runs before the `runStatus !== "streaming"` → idle check. Any terminal row that still carries a pause signal is therefore amber for as long as it is on screen. The test table pins `"completed + ask_user interrupted → waiting"` as intended behaviour. The old `PausedRunCue` was deliberately gated on `isMessageStreaming` (MessageItem.tsx:583). The avatar drops that gate, and the inputs it trusts are not reliable after the run ends:

- **`interrupted` does not only mean a pending question.** StreamsProvider writes `status: "interrupted"` onto every running or preparing tool when the user presses Stop (`:3175`). If that run's terminal frame resolves as `done` or `reader_done` (both map to `runStatus: "completed"`), its `ask_user` row stays "interrupted" and the avatar claims the user has the next move on a run they stopped.
- **`toolApproval.decision` is not reliably written.**
  - The only writer is ChatArea's docked card, which mutates the object in place (`pendingApproval.decision = decision`, `:769`). Message identity does not change, so the `React.memo` row keeps rendering amber until an unrelated SSE event replaces the object.
  - The inline `ChatToolApprovalCard` (MessageItem.tsx:567) records its decision in local state only.
  - A server-side approval timeout writes nothing.
  - In all three cases `!m.toolApproval.decision` stays true. That leaves the row amber after completion, or amber over a run that is visibly executing tools (waiting outranks tool).

Each of these is a false claim about who has the next move, which is exactly what `pending-question.md` D2 forbids.

**Fix:**
- Gate the ask and approval arms on a live run, and keep only the cap pause as a terminal-row waiting signal (cap-pause is out-of-band by design):
  ```ts
  const live = m.runStatus === "streaming"
  if ((live && (hasPendingAsk(m.tool_calls) || (m.toolApproval && !m.toolApproval.decision))) || capPaused) return "waiting"
  ```
- Separately, replace ChatArea's in-place mutation with a store update that produces a new message object.
- Update the `completed + ask_user interrupted` table row to expect `idle`.

### WR-02: The ring settle snaps to a near-stop when the next 120° stop is close

**File:** `frontend/src/components/chat/IrisAvatar.tsx:161-173`

**Issue:**
- `dur` is floored at 450 ms.
- `y1 = Math.min(1, 0.3 * v * dur / remaining)` is clamped to 1.

When `remaining` is small, the clamp binds. The bezier's starting speed is then `(y1 / 0.3) · remaining / dur`, which is far below the live speed `v`.

**Example:** at the tool rate, `v = 360/4800 × 1.45 ≈ 0.109 °/ms`, and the ring stops 1° short of a stop.
- Needed duration: about 18 ms. It is floored to 450 ms.
- `y1` is clamped to 1, so the starting speed is about 0.0074 °/ms, a 15× instant deceleration, followed by a 1° creep over 450 ms.

**How often:** the clamp binds whenever `remaining < 0.3 · v · 450`. That is about 10° of every 120° at the thinking rate (≈8% of settles) and about 15° at the tool rate (≈12%).

This breaks the sketch's acceptance bar ("the starting slope matches the current spin speed" and "the settle never snaps"). The jsdom tests stub `getAnimations` to `undefined`, so this path never runs under test.

**Fix:** Skip to the following stop when the near one cannot be reached smoothly. Then the clamp never binds and `y1` stays below 1 with no overshoot:
```ts
let target = Math.ceil((ang + 0.001) / 120) * 120
const minCoast = (v * 450) / 3.3 // degrees needed to decelerate within the 450 ms floor at slope ≤ 1
if (target - ang < minCoast) target += 120
```

### WR-03: Any in-page hash navigation moves focus to the H1, including Scalar's routing

**File:** `frontend/src/docs/DocsApp.tsx:104-111, 122-136`

**Issue:** `interceptDocsLink` correctly leaves same-page hash links to the browser (`:95`). But a fragment navigation fires `popstate` (state `null`, so `fresh = false`), which calls `setLoc` with the new hash. The effect keyed on `loc.hash` then runs its non-first, non-fresh branch, which calls `h1.focus({ preventScroll: true })`.

Concretely:
- Activating the `#` anchor beside an H2: the browser focuses that H2 (`tabIndex={-1}`), and the effect immediately moves focus to the page H1.
- Any `[text](#section)` link in a page behaves the same way.
- On `/docs/api/reference`, Scalar's own hash routing (`#tag/...`) does the same, if Scalar changes the hash in a way that fires `popstate`. Its sidebar clicks have not been checked live, so this case is not confirmed.

The view stays put (`preventScroll`), but sequential focus restarts at the top of the page. For keyboard and screen-reader users, the next Tab press is no longer where they navigated to. This is a WCAG 2.4.3 focus-order defect.

**Fix:** Move focus to the H1 only when the route changed. Track the previous `routeKey` and skip the focus call on a hash-only change, leaving fragment focus to the browser:
```ts
const prevKey = useRef(routeKey)
// …
const routeChanged = prevKey.current !== routeKey
prevKey.current = routeKey
if (routeChanged) document.querySelector<HTMLElement>("#content h1")?.focus({ preventScroll: true })
```

### WR-04: A malformed percent sequence in the hash blanks the docs

**File:** `frontend/src/docs/DocsApp.tsx:125, 129`

**Issue:** `decodeURIComponent(loc.hash.slice(1))` throws `URIError` on input such as `#%E0%A4%A` or `#100%`. The throw happens inside a `useEffect`. There is no error boundary above `DocsApp` (the only boundary, `RouteChunkBoundary`, wraps the API route alone), so React unmounts the whole root and the public docs show a white page. Anyone can trigger this with a crafted link.

**Fix:**
```ts
function safeDecode(s: string): string { try { return decodeURIComponent(s) } catch { return s } }
```
Use it at both sites, and consider a top-level error boundary in `docs/main.tsx`.

### WR-05: Web playback of the compositions requests Google Fonts, despite the "never a third party" claim

**Files:** `video/src/theme.ts:2-7`; claims at `frontend/src/docs/video/RemotionSlot.tsx:9-12` and in the video/README "Web playback" section (`each one exists so a reader's browser stays same-origin`)

**Issue:**
- **Font requests.** `theme.ts` calls `@remotion/google-fonts` `loadFont()` at module top for both Manrope and Inter. Every composition module imports it: kit, FeatureClip, ui. `node_modules/@remotion/google-fonts/dist/esm/Inter.mjs` builds `FontFace`s from `https://fonts.gstatic.com/s/inter/...`.
- **What triggers them.** The same requests fire:
  - after the docs click;
  - on the landing hero, after a scroll with no click at all. That is the `SyrelPromo` path, which T-276-20 lists among the mitigated surfaces.
- **The claim.** The 276-05 must-have reads *"Web playback never requests a third-party URL"*. The SfxOn change gated `remotion.media` for exactly this reason, and Google is the same class of third-party host.
- **Mitigating factor.** RESEARCH:499 notes that the landing already loads these fonts from Google, so this is not a new host for that page. The written guarantee is still false, and the README presents it as the reason for the web rules.

**Fix:** Either gate the font loader the way SFX is gated, or drop the claim:
- **Gate it** by having `theme.ts` export family names only, with `loadFont` behind a Studio/render-only path. The web player inherits Inter and Manrope from the host page's `@font-face`, which docs.html and index.html already load.
- **Drop the claim** by correcting RemotionSlot's header, the README sentence and the T-276-20 row to say that Google Fonts is requested.

## Info

### IN-01: The boot-splash live region has no text to announce

**File:** `frontend/src/App.tsx:302-306`

**Issue:** `role="status"` with `aria-label="Loading Syrel"` wraps only an `aria-hidden` avatar. A live region announces its content, not its label, so most screen readers say nothing.

**Fix:** Add `<span className="sr-only">Loading Syrel…</span>` inside the region.

### IN-02: The avatar's motion logic has no test coverage

**File:** `frontend/src/components/chat/__tests__/IrisAvatar.test.tsx:154-164`

**Issue:** jsdom has no `getAnimations` or `CSSAnimation`, so `ramp()`, `settle()`, the playbackRate phase lock and the 120° coast never execute. WR-02 sits entirely in that untested code.

**Fix:** Add a unit test with a fake `getAnimations` that returns stub `CSSAnimation`-like objects, and assert the ramped rates and the settle keyframes and easing. Alternatively, record a manual Chrome seam check in VERIFICATION.

### IN-03: Re-entering work during a fade leaves the wave out of phase with the orbit

**File:** `frontend/src/components/chat/IrisAvatar.tsx:206-208` and `index.css` (`:is([data-motion="work"],[data-motion="fade"]) .wv`)

**Issue:** The `.wv` CSS animations survive the `fade` → `work` switch with their old `currentTime`, while `.spin` and `.glow` restart at 0. The "orbit-minus-wave = 0" phase lock from the sketch no longer holds. There is no visible seam, because the 360° wrap is offset-independent. The sketch accepts this edge.

**Fix:** None required. If the phase lock matters, reset `currentTime` on the `.wv` animations at spin-up.

### IN-04: `hasVideoDirective` matches `::video` inside fenced code

**File:** `frontend/src/docs/components/Markdown.tsx:40-42`

**Issue:** A page whose code block shows `::video` would suppress the default `VideoSlot` while the Markdown renders the line as code, so the video disappears.

**Fix:** Skip lines inside ``` or ~~~ fences, as `extractHeadings` in `docs-content.cjs` does.

### IN-05: Heading-id parity is only guaranteed for plain-text H2s

**File:** `frontend/src/docs/components/Markdown.tsx:53` versus `scripts/lib/docs-content.cjs:192-193`

**Issue:** The build hashes the raw Markdown source, link URLs and entities included. The browser hashes rendered text. So an H2 such as `## See [Chat](/docs/use/chat)` would get two different ids, and the TOC and search anchors would break. No H2 does this today (grep found none). Duplicate H2 texts also produce duplicate ids.

**Fix:** Have the build lint for links or entities in H2s, or derive ids from the same parsed text on both sides.

### IN-06: `decodeEntities` at display time can produce identical-looking category pills

**File:** `frontend/src/components/experts/catalog/expertCatalog.ts:80-84`; `ExpertCatalogPage.tsx:264`

**Issue:** Raw `R&amp;D` and `R&D` are two pills that both display as "R&D". The decode treats the symptom of category strings that were stored HTML-escaped.

**Fix:** Normalise the category on write or seed, or dedupe pills on the decoded value.

### IN-07: The auth card announces "Syrel" twice

**File:** `frontend/src/components/auth/AuthCardShell.tsx:40-44`

**Issue:** `alt="Syrel"` on the mark sits directly above the `CardTitle` "Syrel" on AuthPage.

**Fix:** Use `alt=""` there, as SetupWizard does, because the heading already names it.

### IN-08: The hero search's `/` hint is read aloud

**File:** `frontend/src/docs/components/SearchBox.tsx:139`

**Issue:** `<kbd className="d-kbd">/</kbd>` has no `aria-hidden`. The trigger button's copy of the hint does.

**Fix:** Add `aria-hidden="true"`.

### IN-09: An exhausted cap pause still reads as "waiting on you"

**File:** `frontend/src/components/chat/MessageItem.tsx:464`

**Issue:** When `continuesRemaining <= 0`, the Continue card shows a stop message with no action, but `capPaused` still makes the avatar amber.

**Fix:** Pass `capPaused && continuesRemaining > 0`, or give the exhausted state a dim or idle tone.

### IN-10: Navigating between two URLs that share a `routeKey` neither scrolls nor moves focus

**File:** `frontend/src/docs/DocsApp.tsx:114`

**Issue:** `/docs/api` and `/docs/api/overview` resolve to the same slug, and two unknown paths both produce `not-found::`. When navigating from one to the other, the effect does not re-run, so the page neither scrolls to top nor focuses the H1.

**Fix:** Include `loc.pathname` in the key used by the navigation effect.

---

_Reviewed: 2026-10-05_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
