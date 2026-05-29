---
phase: 087
slug: panel-ui
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-29
---

# Phase 087 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from 087-RESEARCH.md § Validation Architecture (HIGH confidence — all wire contracts read from source).

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest ^4.1.0 (+ @vitest/ui) [VERIFIED: frontend/package.json] |
| **Config file** | `frontend/vitest.config.ts` [VERIFIED] |
| **Quick run command** | `cd frontend && npx vitest run src/components/panel/` |
| **Full suite command** | `cd frontend && npm test` (`vitest run`) |
| **Estimated runtime** | ~30–60 seconds (panel suite ~5s) |
| **Real-browser UAT** | Chrome DevTools MCP (project convention; login fhdmrd@gmail.com / 123456 at http://localhost:5173) |

**Baseline note:** Phase 086 reported a known ~17-failure pre-existing baseline in `StreamsProvider.dedup.test.ts` / `streamsProvider.test.tsx` / `streamsProvider_075_9_clientkey.test.tsx` (argsCodeText / dedup / clientKey / 068-reconcile) — unrelated to panel work. **Phase 087 must not regress beyond that baseline; new panel tests are GREEN-only.**

---

## Sampling Rate

- **After every task commit:** Run `cd frontend && npx vitest run src/components/panel/` (panel suite quick run)
- **After every plan wave:** Run `cd frontend && npm test` (full suite; must not regress past the known baseline)
- **Before `/gsd:verify-work`:** Full suite green (minus known baseline) + Chrome MCP lived-experience UAT + cross-provider scoreboard
- **Max feedback latency:** ~60 seconds

---

## Per-Task Verification Map

| Req ID | Behavior | Test Type | Automated Command | File Exists | Status |
|--------|----------|-----------|-------------------|-------------|--------|
| PANEL-01 | Panel toggles open/rail/hidden via button + `⌘.`; mobile <768px = bottom-sheet | unit (state machine) + manual (Chrome MCP responsive) | `npx vitest run src/components/panel/__tests__/WorkspacePanel.test.tsx` | ❌ W0 | ⬜ pending |
| PANEL-02 | Todos render live with status; update on `write_todos` no refresh | unit (render from `useTodos` mock) + manual (Chrome MCP live) | `npx vitest run src/components/panel/__tests__/TodosSection.test.tsx` | ❌ W0 | ⬜ pending |
| PANEL-03 | File list + click-to-preview routes md/code/csv/img/fallback correctly | unit (per-type routing) + manual (Chrome MCP preview) | `npx vitest run src/components/panel/__tests__/FilePreview.test.tsx` | ❌ W0 | ⬜ pending |
| PANEL-03 | CSV renders as table; malformed/huge → fallback | unit | `npx vitest run src/components/panel/__tests__/CsvTablePreview.test.tsx` | ❌ W0 | ⬜ pending |
| PANEL-04 | ask_user card renders choices + free-text; submit disabled until pick/type; submit → answered + resume | unit (render + submit-gate) + manual (Chrome MCP resume) | `npx vitest run src/components/panel/__tests__/PendingAskCard.test.tsx` | ❌ W0 | ⬜ pending |
| PANEL-07 | Diff parses unified string into add/del/ctx/hunk; truncation surfaced; version pick red-base/green-target | unit (string parser) + manual (Chrome MCP diff) | `npx vitest run src/components/panel/__tests__/VersionDiff.test.tsx` | ❌ W0 | ⬜ pending |
| Seam (D-05) | Live → pointer, reloaded → card; no raw-JSON leak; additive (no card-internals change) | unit (mode routing) + manual (Chrome MCP reload) | `npx vitest run src/components/panel/__tests__/Seam.test.tsx` | ❌ W0 | ⬜ pending |
| Carry-fwd | Rapid thread-switch reconcile-abort, now with real hook consumer | manual (Chrome MCP — re-run deferred 086 UAT live) | n/a (Network: A's panel GET cancelled; B shows own data) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/components/panel/__tests__/WorkspacePanel.test.tsx` — covers PANEL-01 (toggle state machine, empty short-circuit)
- [ ] `src/components/panel/__tests__/TodosSection.test.tsx` — covers PANEL-02
- [ ] `src/components/panel/__tests__/FilePreview.test.tsx` — covers PANEL-03 routing (md/code/csv/img/fallback)
- [ ] `src/components/panel/__tests__/CsvTablePreview.test.tsx` — covers PANEL-03 CSV + malformed/huge fallback
- [ ] `src/components/panel/__tests__/PendingAskCard.test.tsx` — covers PANEL-04 (submit gate, run_id presence, answered state)
- [ ] `src/components/panel/__tests__/VersionDiff.test.tsx` — covers PANEL-07 (string parse, truncation flag, pill color/aria)
- [ ] `src/components/panel/__tests__/Seam.test.tsx` — covers seam mode routing + no-raw-JSON leak
- [ ] Shared test fixtures — mock `useTodos` / `useWorkspaceFiles` / `useAskUserPrompt` + sample wire payloads (content inline/bucket, diff string with hunks, versions list)
- [ ] Framework install: none — Vitest already present.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions (Chrome DevTools MCP) |
|----------|-------------|------------|------------------------------------------|
| Live todo updates with no refresh | PANEL-02 | Real-time SSE→Zustand reactivity is felt, not unit-observable | Watch a slow multi-tool run end-to-end: todos update live in panel; chat shows only quiet pointers (no duplicate rich cards); no chat flicker on panel events (PANEL-06) |
| ask_user resume in-place | PANEL-04 | Cross-worker Redis pub/sub resume + composer-lock interplay | Trigger `ask_user`: chat run-card turns amber + composer locks + toggle pulses when panel closed; answer in panel → run resumes in-place, composer unlocks, card flips green |
| Reload-gap closure | PANEL-04 / D-05 | Persistence across page reload | Reload mid-/post-question: answered Q&A appears as self-contained card in chat; panel shows current state only |
| Responsive breakpoints | PANEL-01 | Layout-feel at 375/768/1024/1440 | Resize: bottom-sheet <768 never occludes composer + grip dismisses; 1024 chat keeps readable floor (no illegible run-card wrap); 1440 comfortable two-canvas |
| Cross-provider parity (4-axis scoreboard) | PANEL-01..07 | Panel is first real consumer of the shared SSE vocabulary | See Cross-Provider UAT below |
| Rapid thread-switch reconcile-abort (086 carry-fwd) | — | Network-timing race; no unit proxy | Thread A streaming while Thread B accepts prompt → panel switches cleanly, no cross-thread bleed; A's panel GET shows cancelled in Network panel |

### Cross-Provider UAT (CLAUDE.md scoreboard — 4 axes, native providers)
- **Cross-provider:** trigger `write_todos` + `workspace_write` + `ask_user` on OpenAI, Anthropic, Google (3.x+), OpenRouter, DeepSeek, Moonshot — panel renders identically (one UX, four+ adapters)
- **Multi-tool:** one prompt that writes a file AND a todo list — both sections update
- **Parallel-thread:** Thread A streaming while Thread B accepts a prompt — panel switches cleanly, no cross-thread bleed (the deferred 086 abort test, now live)
- **Long-message:** ≥50 prior messages OR ≥5 KB prompt that triggers a panel tool — state updates with no drop

---

## 087-08 Live UAT — Design Contracts (Wave 2 blocking gate)

> Filled during 087-08 Task 2 (orchestrator-driven Chrome MCP). Status: ⬜ pending · ✅ pass · ❌ fail · ➖ n/a
> 004-panel-shell layout (overflow/flush/stable/mobile/contrast) already verified ✅ in 087-07; rows below are the toggle rework + the deferred feature contracts.

| Contract | Scenario (seed) | Expected | Status |
|----------|-----------------|----------|--------|
| 004 toggle | Single in-panel toggle; collapse open→rail, rail Expand→open BY MOUSE; empty/welcome + content thread; dark+light; ⌘. | One control only (no chat-header toggle); rail always present; reopen-by-mouse on welcome screen; pulsing-dot on rail when ask pending+collapsed | ⬜ |
| 004 layout no-regress | open + rail @ 1442/1280; 768/1024 floor; mobile <768 sheet | overflow=0, flush-right, stable left edge; sheet dismissable | ⬜ |
| 005 file+diff | Write /notes.md twice (v1 → v1+line) | Files drill-in; VERSIONS ≥2; unified diff red/green pills + hunks; Compare red-base/green-target; ⤢ overlay opens/closes | ⬜ |
| 006 ask_user | "use ask_user to ask bullets vs prose" | Paused amber run-card + locked composer + rail pulse + pinned PendingAskCard (gated submit) + chat quiet cue → answer → resume-in-place → composer unlocks → card green | ⬜ |
| 007 seam | Run panel tools, then reload page | Live: quiet SeamPointer (panel = canonical). Reloaded: self-contained resolved SeamCard, no raw-JSON; panel shows current state only | ⬜ |
| PANEL-02/06 | Slow multi-tool run | Todos update live no-refresh; chat quiet pointers only (no dup rich cards); no flicker on panel events | ⬜ |

### Cross-Provider Scoreboard execution log (087-08)

| Provider (representative) | Multi-tool | Parallel-thread | Long-message | Panel/seam parity | Status |
|---------------------------|-----------|-----------------|--------------|-------------------|--------|
| OpenAI (gpt-5.4) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Anthropic (claude) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| Google (gemini 3.x) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |
| OpenRouter (experimental) | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ |

> Axes per row may be combined into fewer live runs (e.g. one multi-tool prompt on a long thread on a parallel pair) — the bandwidth, not the cell count, is the bar.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (7 panel test files + fixtures)
- [ ] No watch-mode flags (use `vitest run`, never `vitest` watch)
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
