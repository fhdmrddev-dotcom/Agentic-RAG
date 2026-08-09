---
status: passed
phase: 174-run-state-lifecycle-honesty
source: [174-VERIFICATION.md, 174-VALIDATION.md]
started: 2026-07-22
updated: 2026-07-22
result: "All 5 STATE requirements PASSED (operator-driven 2026-07-22). STATE-01a DB-confirmed (3 empty cancelled runs). STATE-01b passed via the Run-window surface (doRun deletes the orphan thread + shows the reason in the modal; DB confirms zero orphan threads) — operator accepted this as the honest, cleaner outcome vs a chat amber bubble."
---

# Phase 174 — Human UAT (SC#10 4-axis live cross-provider)

> **Why this file exists:** Every code-level must-have is verified (9/9 against live source), the full frontend vitest differential is clean (zero net-new failures), and the code review is clean (0 blocker/high). The one gate that CANNOT be automated is the SC#10 4-axis live cross-provider UAT — it needs a live operator + real provider streams + timing-critical actions. Run this, then `/gsd:verify-work 174` to flip the phase to `passed`.
>
> **Before you start:** the dev app was running during execution (5173 + 8000 both 200), but the new code shipped after that — **do a FULL browser reload** (Ctrl+Shift+R) first so React picks up the new StreamsProvider/MessageItem/toolMeta/dedup modules (stale HMR = false-fails). Test login: `fhdmrd@gmail.com` / `123456`.

## Current Test

[awaiting human testing]

## SC#10 4-Axis Matrix — run each row and check the result

### STATE-01a — DeepSeek early-cancel empty bubble → honest affordance
- [ ] Start a streaming run on **DeepSeek** (deepseek-v4-flash). Click **Stop** ~5–7s in, BEFORE the first visible token.
- [ ] **Expect:** the assistant bubble shows **"cancelled — no output yet"** (Square icon + muted italic), NOT an empty avatar-only bubble.
- [ ] Repeat on **≥1 other provider** (any).
- [ ] Nav away & back, then **full cold reload** → the affordance still holds.

### STATE-01b — killed-workflow 403 → amber reason + usable composer
- [ ] Control Plane (`/admin`) → **Workflows kill-switch OFF**.
- [ ] Launch a workflow from chat.
- [ ] **Expect:** an in-chat **amber** bubble "Workflows are currently disabled by the administrator" (the server's message, verbatim) — NOT a workflow title with a blank body.
- [ ] **Expect:** the composer is **not** left locked (you can type/send a normal Deep message immediately).
- [ ] Turn the kill-switch back ON when done.

### STATE-02 — stop indicator survives nav + full cold reload
- [ ] Start a run on any provider, click **Stop** mid-stream (after some content). Confirm "Response stopped" shows.
- [ ] (a) Nav away and back → still shows "Response stopped".
- [ ] (b) **Full cold browser reload** → still shows "Response stopped" (derived from persisted `runs.status`).

### STATE-03 — reasoning-heavy pre-answer "Reasoning…"
- [ ] Send a heavy prompt to a **reasoning model** (Kimi/Moonshot **or** GLM/zhipu — OpenAI-compat reasoning).
- [ ] **Expect:** during the pre-first-token gap the banner shows **"Reasoning…"** (with the spinner/dots), NOT a static "Setting up agent…".
- [ ] Sanity: on **Anthropic** and **Google** (which don't stream reasoning) the calm "Setting up agent…" fallback is CORRECT — not a bug.

### STATE-04 — workflow-run timer anchored + single avatar
- [ ] Launch a **multi-minute** streaming workflow. Nav away and back (repeatedly).
- [ ] **Expect:** the run-strip timer **continues from real elapsed** (no reset to seconds).
- [ ] **Expect:** exactly **one** assistant avatar (no duplicate empty avatar) — check at kickoff on a **fast** (OpenAI) provider too (the double-mount is a race, not just slow-provider).

### Cross-cutting axes (fold into the above rows)
- [ ] **Multi-tool:** ≥1 row exercises 2+ tools in one prompt (e.g. `search_documents` + `execute_code`) while watching pre-answer → tool → terminal transitions (STATE-03 + STATE-04 timer).
- [ ] **Parallel-thread:** Thread A streaming a workflow while Thread B accepts a Deep prompt → verify the STATE-01b lock-clear does NOT leak across threads, and no cross-thread avatar/timer bleed.
- [ ] **Long-message:** ≥50-msg thread OR ≥5 KB prompt, per provider → STATE-02 reload-derive on a long thread; STATE-03 reasoning window under load.
- [ ] **Deep Mode byte-identical:** a plain Deep chat on each provider behaves exactly as before (no new chrome, no regressions).

## Gaps

[none observed yet — fill in if any row fails]

## Notes

- If a row fails, capture the provider + run_id and re-open. The code seams: STATE-01a `MessageItem.tsx:651-667`; STATE-01b `StreamsProvider.tsx:2080-2101` + `MessageItem.tsx:485-493`; STATE-02 `MessageItem.tsx:693-702` + `threads.py:353` + `api.ts:198`; STATE-03 `toolMeta.ts:68-92` + `MessageItem.tsx:644`; STATE-04 `StreamsProvider.tsx:1875` + `dedupMessages.ts:52-97`.
- When all rows pass: run `/gsd:verify-work 174` to flip VERIFICATION status → `passed`, then the phase can be marked complete.
