---
phase: 279-the-expert-scope-seam
artifact: validation
plan: 04
sc_covered: [SC#3, SC#4]
independent_review: self
date: 2026-10-13
---

# Phase 279: UAT scoreboard (CLAUDE.md 4-axis bandwidth + G-4)

Phase 279 is a G-5 extraction (`expert_scope.py` → pure / statement / events, AST-identical to
`a5a94ba67`) plus the SEED-328 debt batch. The only provider-visible change is WR-08's folder-scope note,
and its new multi-path wording fires only when `len(scoped_folder_paths) > 1`; the single-folder note is
pinned byte-identical to PHASE_BASE (`test_279_scope_fixes.py::test_WR08_*`, D-17). WR-05 changes the
handoff marker's TEXT but keeps `role='user'`, so the history builder and every provider path are
untouched (D-10). No streaming, run-buffer or provider-adapter code changed (`provider_gateway/` diff
empty). Every row below is present; none is omitted.

Gate evidence (SC#4) is in `279-04-SUMMARY.md` § "Close gates". G-4 drive evidence is in `279-UAT-LOG.md`.

## 4-axis bandwidth

| Axis | Status | Row / reason |
|---|---|---|
| Cross-provider | ⛔ 0 of 8 run — **owed by decision (D-17)** | roster below |
| Multi-tool | ⛔ **owed by decision** (2026-10-13) | Offered at the Task 1 checkpoint as the recommendation: no streaming / tool-dispatch code changed beyond the guarded note. The operator replied `ready` without naming a row, so the recommendation stands as the decision |
| Parallel-thread | ⛔ **owed by decision** (2026-10-13) | same decision. **First to run if re-opened:** the WR-01 handoff gate is per-thread (`_thread_has_active_run` on the SOURCE thread), so Thread A streaming while Thread B hands off is the row most likely to show a cross-thread defect |
| Long-message | ⛔ **owed by decision** (2026-10-13) | same decision; no prompt-assembly or history code changed except the guarded WR-08 note and the WR-05 marker text |

## Cross-provider roster (derived from `MODEL_CAPABILITIES`, not re-typed)

Derived on 2026-10-13 by grouping `app.config.MODEL_CAPABILITIES` by `provider`: 8 groups (openai 17,
anthropic 7, google 7, deepseek 2, moonshot 3, minimax 8, zhipu 8, openrouter 9). Each row names the
newest registry-backed id; `native_tools` / `emit_tier` read from the registry at derivation.

| # | Provider | Model (newest registry-backed) | native_tools / emit_tier | Verdict | Reason |
|---|---|---|---|---|---|
| 1 | OpenAI | `gpt-5.6-sol` | True / force_strict | ⛔ owed by decision (D-17) | the only provider-visible change is the `> 1`-guarded scope note; single-folder note byte-identical (278 precedent) |
| 2 | Anthropic | `claude-sonnet-5` | True / force | ⛔ owed by decision (D-17) | same as row 1. ⚠ also one of the two providers that receive the IN-03 coerce directive at all |
| 3 | Google | `gemini-3.5-flash` | True / force | ⛔ owed by decision (D-17) | same as row 1. ⚠ the other IN-03 coerce recipient |
| 4 | DeepSeek | `deepseek-v4-pro` | True / force | ⛔ owed by decision (D-17) | same as row 1. (UAT-LOG N1: a local `402 Insufficient Balance` during the G-4 drive was account state, since restored) |
| 5 | Zhipu / GLM | `glm-5.2` | True / force | ⛔ owed by decision (D-17) | same as row 1 |
| 6 | MiniMax | `MiniMax-M3` | True / force | ⛔ owed by decision (D-17) | same as row 1 |
| 7 | Moonshot / Kimi | `kimi-k2.6` | True / **coerce** | ⛔ owed by decision (D-17) | same as row 1 (the only `coerce` native rows) |
| 8 | OpenRouter | `deepseek/deepseek-v4-pro` | **False** / force | ⛔ owed by decision (D-17) | same as row 1 (the non-native tool path) |

## G-4 lived-experience rows (D-12, D-13) — driven in Chrome, evidence in `279-UAT-LOG.md`

| # | Operator scenario | Items | Verdict |
|---|---|---|---|
| 1a | Swap card reads "Won't be searched:"; "Won't use" nowhere | WR-04, D-16 | ✅ pass |
| 1b | Invite dialog on a no-folder chat shows "Won't search" / "All your documents" before confirming | WR-03 | ✅ pass |
| 2a | "New chat with X →" opens with a handoff card, not a user bubble | WR-05 | ✅ pass |
| 2a-DB | The new marker row's `content` opens with the background wrapper, items fenced (local read-only SELECT) | WR-05, D-10 | ✅ pass (mitigation against TRUST-03, not enforcement) |
| 2b | No handoff action while the answer streams | WR-01 | ✅ pass |
| 3 | Chip clears and says "This chat's Expert could not be loaded."; the previous Expert never shows | WR-06 | ✅ pass (client-side injected failure; does NOT cover 267-FIX live note #5, which stays owed) |
| 4 | Catalog Start Chat on a disabled Expert names the server's reason, not "Check your connection" | WR-07, GET /experts note | ✅ pass (Expert disabled for the drive was restored) |
| 5 | Two-org send on an org-A Expert thread with org B active: the server's 409 sentence, draft kept, messages and runs unchanged | CR-03(b), D-13, D-15, D-18 | ✅ pass (SC#3 live) |

## Still owed (carried to STATE.md)

- The 8 cross-provider rows and the multi-tool / parallel-thread / long-message rows above (by decision).
  First to run if re-opened: **parallel-thread**.
- 267-FIX live note #5: the CR-03(c) snapshot-reconcile chip-clear, never browser-driven.
- IN-03 provider-docs-first check (Anthropic tool_choice auto, Gemini function-calling mode AUTO).
- D-18 cloud parity READ before promotion (`279-SEED-328-RECORD.md` § "D-18 cloud parity").
