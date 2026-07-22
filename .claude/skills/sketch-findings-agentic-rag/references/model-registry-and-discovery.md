# Model Registry & Discovery (Phase 149)

The body of the Control Room **Model Registry** tab — how an operator reads/edits per-model capabilities, and how live discovery proposes changes without ever silently enabling a capability the provider didn't return. The band + tab shell are the shipped 061-B Control-Room shape (`references/control-room-shell-and-receipts.md`); these two sketches are only the tab BODY. Grounded in the SEED-116 two-layer boundary + the real `model_capabilities_overrides` columns (mig 053).

## Design Decisions

### D1 — Registry editor = instrument-table + inline edit (070 winner A)
The registry renders as **provider-grouped collapsible sections** of rows over the REAL columns (`context_window_tokens · max_output_tokens · native_tools · llm_call_timeout_seconds · enabled`), numeric cells **click-to-edit inline** (the 112 / FolderNode pattern), on the 068-A governance-roster lineage. It's the path of least resistance and the density winner for a 40+-model × 8-provider registry.

- **Won over B (list + right-side detail panel):** comfortable one-at-a-time editing but too sparse for cross-model comparison at registry scale.
- **Won over C (capability card grid):** most visual, weakest for scanning one column across models.

### D2 — The `enabled` → "Users see" coupling is the load-bearing chip (070, SEED-116)
The two-layer pattern (operator allowed-set + lock → user preference) is made **visible**: each row's `enabled` derives a `✓ in picker / ✕ hidden` chip so an operator sees the consequence of the toggle on what users can pick, plus a **🔓/🔒 lock** (operator pins the org default / disallows user override). This is the operator half of the SEED-116 two-layer contract rendered inline, not buried in copy.

### D3 — Override vs inherited honesty (070)
An operator edit reads as `OVR` (your stored override) — **visually distinct** from `DEF` (inherited from the built-in registry, dim + italic). Every override carries a **"Reset"** back to the inherited default. Never conflate a stored override with an inherited value.

### D4 — Real columns only; schema gaps flagged, not faked (070)
Only the mig-053 columns are editable. A concept with no column (e.g. "deprecated") renders as a `?` tag **flagged as a SCHEMA QUESTION**, never a fabricated field. Don't invent a `deprecated` column in the UI when the schema has none.

### D5 — Discovery = grouped diff, propose-only as the visible hero (071 winner A, SC#3)
Discovery runs per-provider (live run cards with **stable-ts timers**; a rate-limited provider shows its **verbatim error, excluded-not-failed** — the 058/060 lesson), then resolves into **✚ New / ± Changed / ⊘ Vanished** groups. The load-bearing honesty: a provider that returns **IDs only** (OpenAI / Anthropic / OpenAI-compat) yields **amber empty "unknown — you set it" inputs**; a provider that returns capabilities (Google / OpenRouter) auto-fills green. **A new model with unknown capabilities is NEVER auto-enabled** (bars the silent no-tools bug — SC#3).

- **Won over B (compare table):** denser for big diffs, but "you set it" is subtler in a cell.
- **Won over C (guided stepper):** most hand-holding, heaviest chrome.

### D6 — Vanished ≠ deleted (071)
A model that disappears from `/models` is **flagged for the operator** to mark deprecated / disable / keep — never auto-deleted (a provider may have paused an endpoint). A sticky confirm bar names the change count.

### D7 — Every write is a ledger receipt (070/071 → 062-A)
`model.capability.set` on every capability edit; `model.discover` when discovery runs. Inherits the 062-A always-on-ledger receipt vocabulary (✎ write mark, plain sentence, consequence ≠ receipt). Plain-first labels with **⌥ Technical names** revealing raw field names (the 146 LANG-01 pattern).

## What to Avoid

- **Auto-enabling a discovered capability the provider didn't return** — the entire reason propose-only (D5) exists; a new model's capabilities are amber "you set it" inputs, never silently on.
- **A card grid or detail-panel for a 40+-model registry** — density loses to scannability (D1); reserve the detail panel for genuinely one-at-a-time surfaces.
- **Conflating override and inherited** — `OVR` must read distinct from `DEF`; every override needs Reset (D3).
- **Inventing a schema field** — no `deprecated` column exists; flag it as a question, don't fake it (D4).
- **Auto-deleting a vanished model** — flag for operator disposition (D6).
- **A discovery run that hides a rate-limit as a failure** — show the verbatim provider error, exclude-don't-fail (D5).

## Origin

Synthesized from sketches **070-model-capability-editor** (winner A — instrument table + inline edit) and **071-model-discovery-propose-confirm** (winner A — grouped diff, propose-only hero). Source files: `sources/070-model-capability-editor/`, `sources/071-model-discovery-propose-confirm/`. Session 2026-07-12 (Phase 149, MODEL-01 / MODEL-02). Reuses the 061-B/062-A Control-Room shell + ledger, the 068-A instrument roster, the 024-A picker-footer discipline, and the 043/058/060 live-run-card + verbatim-error lineage. The future Settings home for provider/model management: SEED-095.
