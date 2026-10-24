# 292.1 G-4 orchestrator notes (2026-10-24, Chrome via claude-in-chrome; cap set to 2 in Settings → "Tool rounds per chat turn", saved "✓ Saved")

## G4-1 — structured call at the cap (gemini-3.8-flash, thread 4f4a977a, run 1e5b86bc)
- 1st drive: run paused (carrier with queued search_documents + thought_signature; run_is_cap_paused=True) but NO limit line / NO Continue live or after reload → FAIL. Root cause: GET /threads/{id}/workflow reported cap_paused only for status 'cap_paused' (first-turn pause finalizes 'completed'). Fixed a11ff25ee (RED deb7dcb58).
- After fix + reload: "Reached the tool-use limit for this turn." + "Continue (3 left)". Click → "Continuing…" → same run_id 1e5b86bc streaming, continues_used 0→1, same model gemini-3.8-flash/google (thought_signature fix f3816732a live) → completed with a real answer + 1 file. Card cleared ~6 s after completion. Reload: answer shown, no card, no markup, no error. → PASS (after fixes)

## G4-2 — text-form (DSML) call at the cap (deepseek-v4-pro native; OpenRouter ⛔ 402 credits — D-01 arm owed)
- thread 9f2fd306, run 5c95a0d4. Live: card + "Continue (3 left)" appeared within ~4 s; NO markup seen in any 2 s live poll. DB: carrier call_<24hex> (parsed DSML) + reasoning_content (SEED-323); 0 markup rows.
- ⚠ LIVE DEFECT: the card VANISHED when the stream ended (send-path onTerminal clearWorkflowLockForThread on `done`); reload showed it again. Fix in progress (frontend, TDD).
- Continue (after reload): "Continuing…" → same run, continues_used 0→1, deepseek-v4-pro/deepseek → completed, answer "All three steps are complete…", 1 user row, 1 run row, 0 markup rows. Reload: answer, no card, no markup. → PASS except the live-vanish defect.

## G4-3 — typed "continue" — PENDING (after the live-card fix merges)

### G4-2 live re-check after the live-card fix (779a0e76c) — measured in G4-3's thread
- After a full page reload (fresh bundle), a first-turn DeepSeek pause ended `completed`, and the card was STILL on screen 5 s later ("Continue (3 left)"). Live vanish fixed.

## G4-3 — typed "continue" (deepseek-v4-pro, thread e158de50, run 0b0ffc47)
- Card live and persistent after the stream ended. Typed `continue` + Enter → card showed "Continuing…" in 1.5 s, composer cleared (value ""), NO "continue" user bubble.
- DB: still 1 root run (same run_id 0b0ffc47), continues_used 0→1, model deepseek-v4-pro unchanged, user rows 1 (no row saved for the typed word), 0 markup rows → completed.
- Reload: thread shows 3 COMPLETED steps (2× search, chart + FILE), no card, no "continue" bubble, no markup. → PASS

## Cap restore (D-19)
- Set back to 15 through Settings → "Save tool rounds". app_settings reads chat_max_tool_rounds=15, explorer_max_tool_rounds=8.

## Fixes found by G-4 / the live board (all TDD, RED commit first)
- D-UAT-2 MessageResponse.run_status lacked cap_paused → 500 on reload: RED 59bc34ec2 · GREEN e7a977e6c
- D-UAT-1 Gemini thought_signature dropped by the carrier/resume: RED 7e169517c · GREEN f3816732a
- G4-1 thread state hid a first-turn pause: RED deb7dcb58 · GREEN a11ff25ee
- G4-2 live card cleared by the `done` terminal: RED 97a50019f · GREEN 1397edfbb (merge 779a0e76c), suite frontend/src/providers/__tests__/StreamsProvider.capPausedDone.test.tsx (NOT yet adopted into the count gate)

## Gates after all fixes (orchestrator, 2026-10-24 ~13:50 local)
- Backend: 70 failed, 9492 passed, 0 errors. GATE PASSED (≤71). Only failures outside the base set: the 2 inherited test_cross_worker_cancellation (order pollution from test_244, proven at base 9d3b77c88).
- Vitest: count gate OK, 507/507, 11922, 0 failing (before adopting capPausedDone).
