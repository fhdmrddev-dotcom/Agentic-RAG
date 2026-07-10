---
phase: 128
slug: chat-tool-card-unification-chat-area-reclaim
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-27
---

# Phase 128 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Derived from `128-RESEARCH.md` → "Validation Architecture" (HIGH confidence).
> This phase touches **streaming + provider routing + UI state** → SC#10 4-axis coverage is **MANDATORY** (CLAUDE.md "UAT scoreboard recipe").

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.0 + @testing-library/react + vitest-axe 0.1.0 |
| **Config file** | `frontend/vitest.config.ts` (separate from `vite.config.ts`) |
| **Quick run command** | `cd frontend && npx vitest run <touched-test-file>` |
| **Full suite command** | `cd frontend && npm test` (`vitest run`) |
| **Estimated runtime** | ~30s (targeted) · full suite varies |

> **Known rot caveat (`project_frontend_vitest_rot`):** ~14–17 frontend vitest tests fail at baseline AND HEAD. Prove net-new green via a **baseline checkout diff**, not an absolute pass count.

---

## Sampling Rate

- **After every task commit:** `npx vitest run <touched-test-file>` (< 30s).
- **After every plan wave:** `cd frontend && npm test` (full vitest suite, net of known rot).
- **Phase gate:** full suite (net of rot) green **AND** the D-06 live native-7+OR scoreboard passing **BEFORE** the CTC-03 `StickyTimerBar` deletion (D-07) and before `/gsd:verify-work`.
- **Max feedback latency:** ~30 seconds (targeted run).

---

## Per-Task Verification Map

> **Finalized after planning** — task IDs (`128-NN-NN`) are assigned once PLAN.md files exist. The requirement→test mapping below is authoritative; the nyquist-auditor / `/gsd:validate-phase` binds rows to task IDs post-plan.

| Req | Behavior | Test Type | Automated Command | File Exists |
|-----|----------|-----------|-------------------|-------------|
| CTC-01 | `providerLogo("zhipu")` returns the Zhipu mark; `providerLogo("lmstudio")`/`undefined` returns null (→ Bot fallback); OpenRouter is NOT unwrapped to the routed model brand | unit | `npx vitest run src/__tests__/lib/providerLogo.test.tsx` | ❌ Wave 0 |
| TDP-02 | `preparingDescription(tc)` extracts `description` from a partial-JSON `argsCodeText`; returns null on absent; prefers parsed `tc.args.description` when present; never throws | unit | `npx vitest run src/__tests__/lib/preparingDescription.test.ts` | ❌ Wave 0 |
| CTC-01/02 | RunCard renders the provider mark for a given `message.provider`; renders Bot for unknown; `brandPulse` ring class present while streaming | component | `npx vitest run src/__tests__/components/RunCard.logo.test.tsx` | ❌ Wave 0 |
| CTC-03 | After deletion, `StickyTimerBar` no longer renders below MessageList; header strip + floating "Jump to live" chip still render (regression) | component | extend `ChatArea`/`MessageList` tests | ❌ Wave 0 (no StickyTimerBar test exists today — deletion is low-risk) |
| CTC-04 | A long user `message.content` renders the clamp container + Read-more; a short one renders unchanged (no Read-more); fade color = `hsl(258 90% 66%)` | component | `npx vitest run src/__tests__/components/MessageItem.clamp.test.tsx` | ❌ Wave 0 (extends `MessageItem.test.tsx`) |

*Status legend: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/lib/providerLogo.tsx` — the D-05 shared helper (logo map + `preparingDescription`)
- [ ] `src/__tests__/lib/providerLogo.test.tsx` — CTC-01 map + fallback + OpenRouter-no-unwrap
- [ ] `src/__tests__/lib/preparingDescription.test.ts` — TDP-02 partial-JSON extraction + honest-null
- [ ] `src/__tests__/components/RunCard.logo.test.tsx` — avatar swap + brandPulse-preserved
- [ ] `src/__tests__/components/MessageItem.clamp.test.tsx` — CTC-04 overflow-detect + Read-more
- [ ] `frontend/package.json` — `npm install @lobehub/icons@^5.10.0` (behind a `checkpoint:human-verify` per house process; commit the lockfile)

---

## Manual-Only Verifications

> **SC#10 4-Axis scoreboard (MANDATORY).** The D-06 acceptance gate that "CTC-02 holds" is a **LIVE run across the full native-7 + OpenRouter** — NOT the static screenshot matrix, NOT big-4 only (mocks/static have false-greened cross-provider before — Phase 122 caught 2 live bugs). Operator-run via Chrome DevTools MCP + psycopg2 (`:54322`) + `run:{run_id}` Redis-stream inspect. **This scoreboard MUST pass before the CTC-03 deletion (D-07).**

| Axis | Required coverage for Phase 128 | Requirement |
|------|--------------------------------|-------------|
| **Cross-provider** | The card + description + logo on **all native-7 + OpenRouter** (`openai`, `anthropic`, `google`, `deepseek`, `moonshot`, `zhipu`, `minimax`, `openrouter`). Per-provider: logo correct, description present-or-honest-fallback (`Preparing {tool}…`), status/elapsed/step-file counts uniform. | CTC-01, CTC-02, TDP-02 |
| **Multi-tool** | ≥1 row exercising 2+ tools in one prompt (e.g. `search_documents` + `execute_code`) — card stays uniform across tool switches; preparing-description updates per tool. | CTC-02, TDP-02 |
| **Parallel-thread** | ≥1 row with Thread A streaming (card live, description showing) while Thread B accepts a new prompt — no cross-thread logo/description bleed (StreamsProvider `assistantId` scoping already guards this). | CTC-02 |
| **Long-message** | ≥1 row with a ≥5KB pasted USER prompt → CTC-04 clamp + Read-more engages; AND a ≥50-prior-message thread → card/strip still render honestly (no perf regression). | CTC-04 |

**Per-provider TDP-02 expectation (from research, verify live):** Anthropic streams token-by-token (real prep window → description shows); OpenAI-compat path streams in deltas (real window → description shows); **Google delivers tool-args atomically (≈no prep window → honest `Preparing {tool}…` fallback, not a bug).** The card always renders logo + status regardless; the description is additive.

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Live cross-provider tool-card parity scoreboard | CTC-01/02, TDP-02 | Requires live LLM streaming across 8 real providers; mocks have false-greened this surface | Run a tool-using prompt on each of the 8 providers; capture the tool card (Chrome-MCP screenshot) + the `run:{run_id}` Redis stream; confirm {logo · status · elapsed · step/file · description-or-fallback} per provider |
| Fade matches the bubble (not a panel cut) | CTC-04 | Visual judgment | On a long user prompt, confirm the clamp fade dissolves into the violet bubble (`hsl(258 90% 66%)`), not the page bg |

---

## Scoreboard Results — executed 2026-06-27 (operator-driven)

**Verdict: PARTIAL PASS — core CTC-01/CTC-02 visual contract verified LIVE; the full native-7 × 4-axis exhaustive run is DEFERRED (honest, not a faked green).**

**Verified LIVE (operator-confirmed):**
- **CTC-01 / CTC-02 — the per-provider logo renders correctly and uniformly.** The operator confirmed (a) the real `@lobehub/icons` mark loads **per provider/model** on the unified tool card, and (b) the marks are **legible and look good in BOTH light and dark themes**. This live observation drove the white-chip contrast fix (`214d24d0`) — `.Mono` marks were illegible on the violet `gradient-primary` backing; mapped providers now sit on a white chip, unmapped keep the gradient + Bot fallback. The rest of the card (RunStatusStrip + step/file counts) was already provider-uniform pre-128.

**Verified STRUCTURALLY (automated, green):**
- `providerLogo` (CTC-01 map incl. the `lmstudio` local-mark override) + `preparingDescription` (TDP-02 partial-JSON `argsCodeText` parse) + `RunCard.logo` (avatar swap, white chip, brandPulse) + `MessageItem.clamp` (CTC-04) unit suites all pass; production `vite build` clean.

**DEFERRED (NOT run — recorded honestly, NOT counted as a pass):**
- The **full native-7 + OpenRouter exhaustive sweep** (one tool-using prompt per provider with a `run:{run_id}` Redis-stream `description`-during-preparing cross-check) and the **multi-tool / parallel-thread / long-message** axes were NOT exhaustively executed. **Reason:** operator hardware can't run a local model large enough to drive tool cards, and the cloud-provider exhaustive sweep was deferred to keep the phase closeable under time/resource constraints. TDP-02's per-provider description-window WIN magnitude is therefore proven structurally (unit tests) but not measured per-provider on the wire.
- **Re-open trigger:** any reported cross-provider tool-card regression → run the full scoreboard before further CTC changes. (Carries the SC#10 cross-provider mandate forward as a known, accepted gap — consistent with prior partial cross-provider UATs, e.g. Phase 116.)

**D-07 note:** the StickyTimerBar deletion (Plan 06) proceeds on the operator's explicit approval, with this PARTIAL verdict recorded — the unified card was confirmed to carry the logo + status uniformly on the providers observed; the exhaustive proof is deferred, not claimed.

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [x] SC#10 4-axis scoreboard authored + operator-run — **PARTIAL**: CTC-01/02 logo + unified card verified LIVE per-provider in both themes + structural suites green; full native-7 × 4-axis exhaustive run DEFERRED (operator resource constraints — see Scoreboard Results)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
