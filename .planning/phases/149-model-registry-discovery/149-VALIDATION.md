---
phase: 149
slug: model-registry-discovery
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-12
---

# Phase 149 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | pytest (backend, venv) / vitest (frontend) |
| **Config file** | `backend/pytest.ini` / `frontend/vitest.config.ts` |
| **Quick run command** | `cd backend && ./venv/Scripts/python -m pytest tests/ -q -k "capability or registry or discovery or model"` |
| **Full suite command** | `cd backend && ./venv/Scripts/python -m pytest tests/ -q` + `cd frontend && npm run test && npm run build` |
| **Estimated runtime** | ~90 seconds |

---

## Sampling Rate

- **After every task commit:** Run the quick run command
- **After every plan wave:** Run the full suite command
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 120 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 149-01 schema/overlay | 01 | 1 | MODEL-01 | — | `deprecated` column + null-clears-to-DEF overlay + clamp | unit | `pytest tests/test_149_config_overlay.py tests/test_149_clamp.py -q` | ✅ | ✅ green |
| 149-02 discovery service | 02 | 1 | MODEL-02 | T-149-04 | SSRF-safe fan-out + propose-only diff (never a guessed cap) | unit | `pytest tests/test_149_discovery.py -q` | ✅ | ✅ green |
| 149-05 registry read | 05 | 2 | MODEL-01 | T-149-10 | full-union read; non-operator byte-identical 404 | unit | `pytest tests/test_149_registry_read.py tests/test_149_model_gate.py tests/test_149_enabled_enforce.py -q` | ✅ | ✅ green |
| 149-05 capability write | 05 | 2 | MODEL-01 | T-149-11 | allowlist-before-SQL PATCH; null-clears-to-DEF Reset; ✎ receipt | unit | `pytest tests/test_149_model_write.py -q` | ✅ | ✅ green |
| 149-06 no-dead-default + lock | 06 | 2 | MODEL-02 | T-149-15 | two-part 409 guard (disable-path ∧ lock-path); PUT .../lock | unit | `pytest tests/test_149_default_guard.py -q` | ✅ | ✅ green |
| 149-06 discover endpoint | 06 | 2 | MODEL-02 | T-149-14 | provider-selection allowlist → 422 before any fan-out (SSRF) | unit | `pytest tests/test_149_discover_endpoint.py -q` | ✅ | ✅ green |
| 149-06 fallback notice | 06 | 2 | MODEL-02 | T-149-16 | disabled model → org-default fallback + honest SSE notice | unit | `pytest tests/test_149_fallback_notice.py -q` | ✅ | ✅ green |
| 149-04 picker badge | 04 | 1 | MODEL-01 | T-149-08 | deprecated badge stays selectable; client adds no authority | component | `npm run test -- SettingsModelBadge` | ✅ | ✅ green |
| 149-07 registry tab (070-A) | 07 | 3 | MODEL-01 | T-149-18/20/22 | coupling chip, OVR/DEF+Reset(null), deprecated≠disabled, lock gated-on-disabled, in-row 409 | component | `npm run test -- ModelRegistryTab` | ✅ | ✅ green |
| 149-07 discovery panel (071-A) | 07 | 3 | MODEL-02 | T-149-19 | amber unknown-you-set-it inputs; enable-now disabled unless complete; vanished flagged-not-deleted | component | `npm run test -- ModelDiscoveryPanel` | ✅ | ✅ green |
| 149-07 tab unlock + wire | 07 | 3 | MODEL-01 / MODEL-02 | T-149-18 | Model Registry tab unlocked; lazy fetch + write-then-refetch | component | `npm run test -- ControlRoomPage` | ✅ | ✅ green |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [x] Backend units (schema overlay, discovery service, registry read/write, guards, discover, fallback) automate the MODEL-01/MODEL-02 correctness surface.
- [x] Frontend component tests (ModelRegistryTab, ModelDiscoveryPanel, ControlRoomPage, SettingsModelBadge) automate the 070-A/071-A honesty contracts with the api mocked.
- [x] The one thing units CANNOT prove — that a capability edit in the UI changes real cross-provider request routing with no restart — is covered by the SC#10 Manual-Only rows below (the D-149-16 gpt-5.6 flip is the "no restart" proof).

---

## Manual-Only Verifications

> **SC#10 MANDATORY (CLAUDE.md UAT scoreboard recipe).** These rows are the 4-axis
> cross-provider bandwidth for a phase that touches provider routing + UI state. They
> exercise the model-registry UI → the request path: enable/disable/lock/edit a model in
> the new tab, then verify the picker + the next request honor it across providers. All
> rows are live UAT (real providers, real streaming) — impossible to fake in a unit.
>
> **4-axis coverage:** Cross-provider = rows 1–5 (OpenAI, Anthropic, Google, OpenRouter).
> Multi-tool = row 6. Parallel-thread = row 7. Long-message = row 8.
> Prerequisite: log in at `http://localhost:5173/` as an operator, open the Control Room →
> **Model Registry** tab (now unlocked). Keys for all four providers configured in Settings.

| # | Behavior | Requirement | Why Manual | Test Instructions |
|---|----------|-------------|------------|-------------------|
| 1 | **Cross-provider · OpenAI — the D-149-16 gpt-5.6 `native_tools` flip = the "no restart" proof (SC#1)** | MODEL-01 / SC#1 / SC#10 | Needs a live OpenAI tool-calling turn against a just-edited registry — no unit can prove routing changed live | 1) In the tab, expand **OpenAI**, find `gpt-5.6-*` (an enabled, tool-capable model). 2) Toggle its **Tools** (`native_tools`) OFF; watch the ✎ recorded receipt flash. 3) WITHOUT restarting the backend, start a NEW chat on that model and ask something that needs a tool (e.g. "search my documents for X and run code to count them"). **Expected:** the tool-carrying chat still WORKS — the agent routes through the prompt-injected tool path (native tools off) rather than breaking; the change took effect within the ~30s TTL, no restart. 4) Toggle `native_tools` back ON → next chat uses native tools again. |
| 2 | **Cross-provider · Anthropic — capability edit affects the next request** | MODEL-01 / SC#10 | Live Anthropic turn against an edited numeric capability | 1) Expand **Anthropic**, click the **Max out** cell of `claude-*`, set a distinctly smaller `max_output_tokens` (e.g. 2000); confirm the OVR tag + ✎ receipt. 2) Start a new chat on that model and ask for a long (>2000-token) answer. **Expected:** the response is capped near the new limit on the very next request (no restart); a **Reset** on that field clears back to the built-in DEF and the cap lifts on the following request. |
| 3 | **Cross-provider · Google — capability edit affects the next request** | MODEL-01 / SC#10 | Live Google turn against an edited capability | 1) Expand **Google**, edit a `gemini-*` numeric cell (e.g. **Context**) and save (OVR tag + ✎ receipt). 2) Start a new chat on that model. **Expected:** the model streams normally with the edited capability honored; the picker shows the model exactly as its `enabled` state dictates (`✓ in picker`). |
| 4 | **Cross-provider · OpenRouter — capability edit affects the next request** | MODEL-01 / SC#10 | Live OpenRouter turn against an edited capability | 1) Expand **OpenRouter**, edit a routed model's **Timeout** (`llm_call_timeout_seconds`) and save. 2) Start a new chat on that model. **Expected:** the model routes/streams with the edited value; disabling it (Enabled OFF → `✕ hidden`) removes it from BOTH the Settings and chat pickers on the next fetch. |
| 5 | **Cross-provider · enable/disable coupling is REAL across the picker (the two-layer pattern)** | MODEL-01 / D-149-01 / D-149-08 | Live picker read across providers | For one model per provider: toggle **Enabled** OFF in the tab → confirm the row's chip flips to `✕ hidden`; open the chat + Settings model pickers. **Expected:** the just-disabled model is GONE from both pickers (registry-driven, not a hand-list); re-enable → it returns. No disabled model is ever selectable. |
| 6 | **Multi-tool — 2+ tools in one prompt after a capability edit** | MODEL-01 / SC#10 (multi-tool axis) | Live multi-tool turn; unit mocks cannot exercise the real loop | 1) Edit any capability (e.g. bump a model's **Context**) and save. 2) On that model, send ONE prompt that needs two tools, e.g. "Search my documents for the Q3 numbers, then run code to chart them." **Expected:** both `search_documents` and `execute_code` fire in the one turn; the edited capability is honored; no tool is dropped and the run completes cleanly. |
| 7 | **Parallel-thread — Thread A streaming while Thread B sends on a just-disabled model (D-149-10 fallback)** | MODEL-02 / SC#10 (parallel-thread axis) | Two live concurrent threads + a mid-flight disable — only observable live | 1) Thread A: start a long streaming answer on model M (leave it streaming). 2) In the tab, DISABLE model M (Enabled OFF). 3) Thread B: send a new prompt that had resolved to M. **Expected:** Thread A keeps streaming to completion uninterrupted; Thread B falls back to the org default and shows the honest inline **`model_disabled_fallback`** notice naming BOTH models — no mid-conversation break, no silent swap. |
| 8 | **Long-message — ≥50 prior messages / ≥5 KB prompt on an edited model** | MODEL-01 / SC#10 (long-message axis) | Long-context live turn against an edited capability | 1) Open (or build) a thread with ≥50 prior messages OR paste a ≥5 KB user prompt. 2) Edit that model's **Context** or **Max out** in the tab and save. 3) Send the long turn on that model. **Expected:** the long turn streams to completion honoring the edited capability; no truncation surprise beyond the configured limit; elapsed status never vanishes. |
| 9 | **Discovery propose-only (SC#3) — capabilities ✓ vs IDs-only amber "you set it"** | MODEL-02 / SC#3 | Live `/models` fan-out across the real provider matrix | In the tab, click **Run discovery**. **Expected:** per-provider run cards show **Google + OpenRouter = "capabilities ✓"** (token limits auto-filled, green values) while **OpenAI + Anthropic (+ others) = "IDs only"**; every un-returned field (incl. **Google `native_tools`**) is an amber **"unknown — you set it"** input, never a guessed value; a rate-limited/errored provider shows its VERBATIM error, excluded-not-failed; a no-key provider reads "no key — skipped". A NEW model's **Enable now** tick is DISABLED until every capability is filled — it is NEVER auto-enabled. |
| 10 | **Deprecated marker stays selectable (deprecated ≠ disabled, D-149-04)** | MODEL-01 / D-149-05 | Live picker read of the deprecated badge | In the tab, toggle a model's **deprecated** ON (add an optional reason); ✎ receipt flashes. Open the chat/Settings picker. **Expected:** the model shows its **`deprecated`** badge YET stays selectable (the coupling chip is unchanged — `✓ in picker`); deprecated is informational only, it does NOT hide the model. Toggle OFF → the badge clears. |
| 11 | **Lock-a-disabled-model refusal (no dead default, D-149-09 lock path)** | MODEL-02 / T-149-22 | Live two-part guard — the UI courtesy AND the server 409 | 1) On a **disabled** (`✕ hidden`) row, the 🔓 lock control is GATED (not clickable) with the courtesy tooltip "enable this model before locking it as the org default". 2) Enable a model, LOCK it as the org default (🔒 · org default), then try to DISABLE that same locked model. **Expected:** the server refuses with a **409** whose plain-language detail renders IN-ROW ("unlock it first" / "pick a new default first") — no dead org default is ever pinned; and attempting to lock a disabled model via the seam is refused 409 ("enable it first"). |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 120s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** ready for `/gsd:verify-work` (automated map green; SC#10 4-axis live UAT rows authored, status pending manual execution)
