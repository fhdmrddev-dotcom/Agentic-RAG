---
sketch: 024
name: embedding-provider-picker
question: "How does the picker make you pin WHERE a model runs (preset → base_url + model + dims + key) so a local model can't silently mis-route to cloud — reused for both embedding and extraction?"
winner: "Synthesis (A + C's always-on endpoint footer)"
tags: [phase-111.1, settings, provider-picker, embeddings, extraction, local-routing, bug-260616-01, embed-01, embed-02, embed-03]
---

# Sketch 024: Embedding & Extraction Provider Picker

## Design Question
The picker is the everyday control AND the structural cure for BUG-260616-01 (a slashed
`org/model` id mis-routing to OpenRouter cloud). The question: **what shape makes "where it
runs" impossible to skip** — so picking a model always pins its endpoint — while staying calm
and reusing ONE component for both the embedding model and the extraction model (D-06, D-09)?

## How to View
open .planning/sketches/024-embedding-provider-picker/index.html

## Variants
- **A: Preset + Advanced** — a familiar `<select>` of provider presets (modeled on the existing
  rerank `<select>` at `SettingsPage.tsx:959`). Selecting a preset auto-fills a "Runs at
  `<base_url>`" pin row (green=local / indigo=cloud) and the collapsed advanced overrides
  (model id, dims, base URL, key, threshold). Lowest-novelty, closest to today's UI.
- **B: Provider Cards** — provider chosen as a grid of cards, each carrying a loud `local`/`cloud`
  pill in the corner. The data-residency decision is the brightest signal because that's the one
  that affects your documents. Model/dims tuck into a small disclosure.
- **C: Endpoint-First** — "Runs on" and "Model" sit side-by-side as one bound unit inside a
  single bordered row, with a 🔒 footer echoing the resolved endpoint + dims + threshold. You
  literally cannot read the model without seeing where it runs; maps 1:1 to the
  stored-`(provider, model)`-pair backend fix.
- **★ Synthesis (winner): A + C's always-on footer** — A's calm preset `<select>` (lowest
  net-new, reuses the rerank pattern) with C's **persistent 🔒 endpoint footer** moved out from
  behind "Advanced" so the resolved endpoint + dims + threshold + a cloud/local tag is *always*
  visible. The everyday control stays quiet; where-it-runs is never a click away. Same picker
  drives both embedding + extraction.

## Decision (2026-06-16)
**Winner = Synthesis (A + C's always-on endpoint footer).** A is the right base — it's the
existing rerank `<select>` generalized, so least net-new and calmest for an everyday control.
C's bound-unit insight is preserved as an always-on 🔒 footer (endpoint · dims · threshold ·
cloud/local tag) rather than a click-to-reveal, which is what makes the BUG-260616-01 cure
*legible* without friction. B's loud cards were rejected as heaviest + poor-scaling.

## What to Look For
- Does the **pin/"runs at" affordance** make cloud-vs-local unmissable at a glance?
- Which shape best communicates that the **same component** drives both embedding AND extraction
  (the reuse chip)?
- Does the local relaxation (Ollama `:11434` / LM Studio `:1234`, dummy key) read as obviously
  safe/offline?
- Which best honors the calm-instrument bar — does the everyday picker stay quiet while still
  making the endpoint legible?
