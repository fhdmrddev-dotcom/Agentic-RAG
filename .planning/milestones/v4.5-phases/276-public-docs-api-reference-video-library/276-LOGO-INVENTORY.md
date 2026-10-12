# Phase 276 — Iris logo insertion inventory (D-24)

Read-only study, 2026-10-04, at develop `ed11a4688`. All `src/…` paths are under `frontend/src/`.
Source of the logo pass so far: `6487c22a9` (276-01), merged via `65dac260b`.

## How the logo is inserted today
- No React component: every insertion is `<img src="/brand/syrel-mark-iris.svg | syrel-lockup-iris.svg">`
  (`frontend/public/brand/`, byte copies of `docs/brand/`). Reason (`Navigation.tsx:26-27`): the SVGs share
  gradient ids `g`/`h`, so two inline copies on a page collide.
- Only inline variant: `video/src/components/ui.tsx:148-208` `LogoPlaceholder`, gradient ids made unique
  with `React.useId()` (`:154-156`). **An inline animated avatar must do the same.**
- `docs/brand/syrel-logo-iris-animated.svg` (8 s lockup loop: petals `a_p0-5`, spin `a_sp`, core `a_c`,
  slide `a_mv`, wordmark `a_d0-4`, built-in reduced-motion off) is used nowhere in `frontend/src`.
  The avatar needs only the mark parts (petals, spin, core).

## A) Assistant avatar + live states (the D-24 target)

| Location | Today | Proposed | Notes |
|---|---|---|---|
| `src/components/chat/MessageItem.tsx:476-481` | **Assistant avatar** `data-testid="assistant-bot-icon"`: 32px `rounded-full gradient-primary` + lucide `Sparkles`; `animate-brandPulse` iff `message.runStatus === "streaming"` | **Iris mark, animated by state** | Every assistant row. Fenced by `src/__tests__/components/MessageItem.test.tsx:141-217` (test id + pulse predicate). G-5 hot file. |
| `src/components/chat/RunCard.tsx:331-352` | **Second avatar** `run-card-avatar` on tool turns: provider logo (`providerLogo()`), or lucide `Bot` fallback; pulses while streaming | Provider logo stays (sketch 048). `Bot` fallback = decision | Tool turns show **two avatars pulsing together**; `run-state-honesty.md` asks for one. Fenced by `RunCard.logo.test.tsx`, `RunCard.test.tsx`. |
| `RunCard.tsx:450` | Collapsed finished run: `Bot` 16px | static mark or keep | |
| `RunCard.tsx:429-436` | Header `Loader2` + `.tool-progress-bar` | keep / maybe redundant | |
| `MessageItem.tsx:891-921` | Pre-first-token: `Loader2` + `outerBannerLabel` text + 3 `dotBounce` dots | keep text; spinner+dots replaceable by the animated avatar | thinking state |
| `MessageItem.tsx:737-739` | Streaming caret | keep | streaming-text state |
| `MessageItem.tsx:971-983` | `Loader2` + tool label / "Thinking…" | keep | tool / planning |
| `src/components/chat/WorkingBadge.tsx:34-46` | `✦ Working` brandPulse (planning gap) | keep; ✦ overlaps | |
| `ThinkingBlock.tsx:247`, `RunStatusStrip.tsx:118-128`, `StepRow.tsx:225-235`, `ToolCallPanel.tsx:341-350`, `StatusPill.tsx:99-109`, `MessageList.tsx:350-366`, `ThreadRunLine.tsx:326-358`, `ActiveRunsTray.tsx:109,138` | status text / dots | keep | not brand positions |
| `src/components/chat/MessageSkeleton.tsx:26,34` | 32px shimmer circles | optional static mark, low opacity | |

### States derivable from the `message` prop alone (no new subscription)
| Avatar state | Derivation | Evidence |
|---|---|---|
| idle / done | `runStatus === "completed"` or `undefined` (historic rows) | `RunCard.tsx:653-659` |
| thinking | streaming, no `content`, no `tool_calls`; or `isPlanning`; or reasoning/narration with empty content | `MessageItem.tsx:891-914`; `outerBannerLabel` `src/lib/toolMeta.ts:295-323` |
| tool running | streaming and a `tool_calls[].status` is `running`/`preparing` | `MessageItem.tsx:393,405-407` |
| waiting on user | `ask_user` running/interrupted (`hasPendingAsk`, `MessageItem.tsx:107-113`) or `toolApproval` without `decision` | `pending-question.md` D2: avatar stops pulsing, goes amber |
| streaming text | streaming, has content, no running tool, not planning | caret condition `:737` |
| error | `runStatus` `failed`/`timed_out` (`runError`) | `MessageItem.tsx:796` |
| cancelled | `runStatus === "cancelled"` or `stopped` | `RunCard.tsx:701-727` |
| cap-paused | `useWorkflowLockForThread(thread_id)?.capPaused` (already read `MessageItem.tsx:283`) | `:818-889` |

**Cost constraint:** `MessageItem` is `React.memo`, not virtualised. The avatar must be a pure component taking
`message` (+ the already-read lock) — no `usePhases`/`useAskUserPrompt`/`useWorkspaceFiles` (docblocks `:215-224`, `:605-615`).

**Experts do not replace the assistant avatar** (`MessageItem` never reads the Expert; `Message` has no expert
field). Expert marks: `ActiveExpertChip.tsx:37`, `ExpertSpotlightCard.tsx:151`, `ExpertEventCard.tsx:159`,
`experts/expertIcon.tsx:59,70` (`Sparkles` fallback). Moving the avatar off `Sparkles` removes a third meaning of that glyph.

### Motion conventions + an existing bug
- `tailwind.config.js:104-126` keyframes `fadeSlideUp`, `pulseGlow`, `brandPulse`.
- ⚠ **`brandPulse` is defined twice outside any `@layer`** in `src/index.css` (`:501` gentle grow; `:973` Phase 230:
  opacity → 0.55, scale → 0.82). The later wins, so the live avatar **shrinks and dims** today, contrary to
  `live-run-container.md:170-178`. The new avatar uses a **new keyframe name**.
- Reduced-motion patterns: `@media (prefers-reduced-motion: reduce)` blocks (`index.css:555,943,1025-1033,1094-1103`);
  `no-preference` inside `@layer utilities` (`:300-323,352`); `motion-safe:` (56 uses); JS `matchMedia`
  (`AnimatedNumber.tsx:25`, `citationNav.tsx:154`, `HeroSection.tsx:15`). Ungated today: `animate-spin`, `animate-pulse`, `.animate-shimmer`, `.tool-progress-bar`.

## B) App chrome
| Location | Today | Proposed |
|---|---|---|
| `src/components/chat/ChatArea.tsx:952-956` | Empty-chat hero 64px `gradient-primary` tile + `Sparkles` | **Iris mark** (static, or slow idle motion) — most visible old tile left |
| `src/components/layout/NavPanel.tsx:257` | Iris mark (done) | optionally lockup when rail expanded (`:245`) |
| `src/components/layout/ChatLayout.tsx:660-700` | Mobile drawer has no brand header | optional mark/lockup |
| `src/App.tsx:297-302` | Boot/auth loader: generic spin ring | **Iris mark animated** (splash) |
| `src/pages/SetupWizard.tsx:318,325` | `Sparkles` banner, no logo in header | static mark/lockup |
| `src/components/metadata/DocumentFileFacts.tsx:85` | **"Added to Agentic RAG"** | "Added to Syrel" (tests: `DocumentFileFacts.test.tsx:39,128,131`, `DocumentDetailPanel.file270.test.tsx:113`) |
| `src/pages/findState.ts:332-333` | **"Added to Agentic RAG (newest/oldest)"** | rename (tests: `findState.test.ts:367-368`, `FindMetaLine.test.tsx:23-24`) |
| `src/components/library/find/StructurePopovers.tsx:474` | **"Added to Agentic RAG"** | rename (tests: `StructurePopovers.test.tsx:232-244`, `FindQuickAdd.test.tsx:118-120`) |
| Provider-logo / `Bot` fallbacks (`ActiveRunsSection.tsx:193`, `PublishGauntlet.tsx:654`, `EngineHealthCard.tsx:315`, `ProviderKeyStep.tsx:171`, `RunHistory.tsx:271,397`), `OperatorBand.tsx`, user avatar, org avatar | leave (they identify a model / section / person, not Syrel) |

⚠ **Light theme:** the mark's core + wordmark are `#F2F4FE`; no light variant exists (`docs/brand/README.md:24`).
NavPanel/auth marks already nearly vanish in light theme; an avatar needs a dark backing chip or a light variant.

## C) Landing + docs
| Location | Today | Proposed |
|---|---|---|
| `src/landing/components/HeroSection.tsx:147-153` | Product-mock rail logo = empty gradient square | static mark `<img>` |
| `HeroSection.tsx:233-257` | Product-mock assistant avatar = inline `Sparkles` path | static mark (D-15: hero keeps one moving element) |
| `src/docs/DocsApp.tsx` | no header/logo yet (276-03 reuses `Navigation`/`LandingFooter`) | lockup in nav, mark in footer — via 276-03 |

## D) Public / meta / PWA / email / backend strings
| Location | Today | Proposed |
|---|---|---|
| `frontend/public/` | only `favicon.svg` + `brand/*.svg` | PNG favicons 16/32, `apple-touch-icon.png` 180, 192/512 icons (mark on `#06090F`) |
| PWA manifest | none | optional `site.webmanifest`, `theme_color` `#06090F` |
| OG/Twitter meta in `index.html`/`app.html`/`docs.html` | none | `og:*` + 1200×630 lockup PNG, `twitter:card`, `theme-color` |
| `frontend/public/icons.svg`, `src/assets/hero.png`, `react.svg`, `vite.svg` | unreferenced Vite leftovers | delete |
| `backend/app/services/email_provider.py:78-81` | invite email: no logo, no product name | hosted PNG lockup + "Syrel" (SVG is blocked by many mail clients) |
| Supabase auth emails | not in repo | operator task (dashboard) |
| `backend/app/api/connectors.py:1331` | `client_name="Agentic RAG"` on MCP OAuth registration | **"Syrel" — user-visible on vendor consent screens**; existing registrations keep the old name |
| `backend/app/main.py:763` | `FastAPI(title="Agentic RAG API")` | CONTEXT says the code title stays; the gated live explorer already shows "Syrel API" (`api_docs.py:56`) — revisit only if operator wants |

## E) Done in 6487c22a9 (verified)
Landing `Navigation.tsx:28-34` lockup · `LandingFooter.tsx:26-29` mark + "© Syrel" · `CompareSection.tsx:42,95` ·
`NavPanel.tsx:257` · `AuthCardShell.tsx:41` / `AuthPage.tsx:16` (also `AcceptInvitePage` via shell) · `favicon.svg` ·
`index.html`/`app.html` titles · `video/src/components/ui.tsx` `LogoPlaceholder` (used by 7 compositions).
`landingBrand.test.ts` scope is `src/landing` + `index.html` only — why the 3 "Added to Agentic RAG" strings survived.

## Decisions for the avatar sketch (G-2)
1. One avatar or two on tool turns (MessageItem + RunCard both pulse today; `run-state-honesty.md`: one).
2. RunCard's `Bot` fallback (`:350`, `:450`): Iris would conflate "Syrel" with "unknown model" — likely keep `Bot`.
3. New keyframe name (not `brandPulse`; fix or retire the duplicate).
4. Light theme: dark backing chip vs. light variant.
5. Which overlapping indicators go (pre-token spinner + dots, ✦ in WorkingBadge, RunCard header `Loader2`).
