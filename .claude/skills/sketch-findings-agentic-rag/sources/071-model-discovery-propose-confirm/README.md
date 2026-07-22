---
sketch: 071
name: model-discovery-propose-confirm
question: "How does discovery run → show new/changed/vanished → confirm, with propose-only (never auto-enable an un-returned capability, SC#3) as the visual hero?"
winner: "A"
tags: [control-room, model-registry, phase-149, discovery, propose-confirm, sc3-propose-only]
---

# Sketch 071: Model Discovery — Propose → Confirm

The discovery flow of the Control Room "Model Registry" tab (Phase 149, MODEL-02). Paired with Sketch 070
(the editor); "⟳ Run discovery" in 070 opens this.

## Design Question
How does an operator run discovery, review the proposed new/changed/vanished models, and confirm — with
**propose-only** (SC#3: never auto-enable a capability the provider's `/models` didn't return) as the
load-bearing, visible honesty beat?

## How to View
open .planning/sketches/071-model-discovery-propose-confirm/index.html
(Variant A: click "Run discovery" to watch the per-provider run cards resolve.)

## Variants
- **A · Grouped diff list (propose-only hero)** — per-provider run cards (stable-ts timers, verbatim
  provider error = excluded not failed), then **✚ New / ± Changed / ⊘ Vanished** groups. Un-returned
  capabilities render as explicit amber **"unknown — you set it"** inputs; vanished models are flagged,
  never auto-deleted; a sticky confirm bar names the count. *Path of least resistance; makes SC#3 the hero.*
- **B · Compare table** — current↔proposed side-by-side; denser for big diffs, but "you set it" is subtler in a cell.
- **C · Guided stepper** — Run → New → Changed → Vanished → Confirm; most hand-holding, heaviest chrome.

## What to Look For
- **Propose-only made visual** — Google & OpenRouter return capabilities (auto-filled, green); OpenAI/
  Anthropic/OpenAI-compat return IDs only, so their fields are amber empty inputs you must set. **A new
  model with unknown capabilities is never auto-enabled** (the silent no-tools bug, barred).
- **Discovery honesty** — per-provider live cards; a rate-limited provider shows its **verbatim error,
  excluded not failed** (the 058/060 lesson); "capabilities ✓" vs "IDs only" badge per provider.
- **Vanished ≠ deleted** — flagged for the operator to mark deprecated / disable / keep (a model can
  vanish because a provider paused an endpoint).
- **Receipts** — the run logs ✎ `model.discover`; each confirmed change logs ✎ `model.capability.set` (062-A ledger).

## Consistency notes
Reuses: op-band + receipts (061-B/062-A), per-provider live run cards + stable-ts + verbatim-error
(043/058/060), diff rendering (035/056), the weight-not-friction confirm posture (025-A), provider-logo
placeholders (RDD 48). New: the propose-only "unknown → you set it" input pattern (the SC#3 surface) +
the new/changed/vanished grouping.
