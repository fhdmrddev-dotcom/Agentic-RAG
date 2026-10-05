---
phase: 276
date: 2026-10-05
driver: orchestrator via Chrome (claude-in-chrome), operator said "go"
app: local dev, shared with Phase 274's live run (no restarts)
result: passed (2 defects found, fixed, re-driven)
---

# Phase 276 — G-4 lived-experience log

| Row | Verdict | Evidence |
|---|---|---|
| G4-2 Landing stays fast | ✅ PASS | First paint: 0 Remotion / Scalar / audio resources; only the pre-existing Google Fonts host. The promo poster shows; a programmatic scroll does NOT start it; one real wheel scroll → 14 Remotion modules load, the promo plays muted with Pause + Unmute; 0 audio files fetched. |
| G4-1 Phone 390 read-through | ⚠→✅ PASS after fix | A 390px viewport (same-origin iframe; window resize blocked by maximised Chrome). Guide reads in one column, scrollWidth 375 ≤ 390, no overflowing element. Video: 0 Remotion modules before the tap → 21 after; all Google-font requests are the page's own `<link>` before the tap (none from playback). **Defect:** menu drawer rendered 32px tall on `/` and `/docs` — the sticky header's `backdrop-filter: blur(12px)` made it the fixed drawer's containing block. **Fix `e4500169b`** (portal to `<body>`). Re-driven: drawer 780px tall (72→852 of 844), parent = body, focus inside, 9 / 20 links, search box visible. |
| G4-3 Honesty spot-check | ✅ PASS | `/docs/use/library/find` and `/docs/use/artifacts`: "Not yet released" + "v4.5, which has not shipped…"; `/docs/use/library/document-detail`: "Word and PDF files are downloaded, not previewed inside Syrel."; `/docs/changelog`: v4.5 not yet released. |
| G4-4 Deep link + refresh | ✅ PASS | Typed `/docs/use/chat`, then `location.reload()` (navigation type `reload`): title "Chatting with Syrel · Syrel Docs", `.docs-root` present, no login form. |
| API reference styling (B-CR-01) | ✅ PASS | `/docs/api/reference`: 1205 Scalar CSS rules applied, "Syrel API" title, "No API keys today" callout; no Scalar telemetry host contacted. Dev server (not a production preview). |
| Iris avatar — one live avatar, states, settle | ✅ PASS | New thread, no-tools prompt. One assistant avatar, 0 RunCard avatars animating. States thinking → streaming → idle; 8 loop animations while working, settle, then `transform: none`. playbackRate tweened 1.0 → 0.8 smoothly (rAF sampling). |
| Iris avatar — no loop stutter | ⚠→✅ PASS after fix | rAF sampling of the orbit found one real jump 14.6° → 0° at ~2.6 s: the row remounts when the key changes `temp-…` → `run-…`. **Fix `218889b32`** (all loops phase-locked to one shared page clock). Re-driven by comparing the orbit animation's own clock across the remount: expected 112.9°, actual 112.9°, **error 0.00°**. |
| Reduced motion | unit-test only | This Chrome cannot emulate `prefers-reduced-motion`; covered by the IrisAvatar / irisState / HeroPromo suites. |

Live chat traffic: 3 plain no-tools prompts in our own new threads ("Lighthouse Poem Without Tools", a harbour poem). No document search was run (per Phase 274's request) and no thread or document was deleted.
