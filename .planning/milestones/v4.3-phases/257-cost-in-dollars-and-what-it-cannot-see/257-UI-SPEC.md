# Phase 257: Cost in Dollars, and What It Cannot See — UI Design Contract (UI-SPEC)

**Date:** 2026-09-19  
**Phase:** 257 (Cost in Dollars, and What It Cannot See)  
**Status:** Locked  
**Design Reference:** G-2 Component Sketch (`.planning/sketches/257-spend-and-metering/index.html`)  
**Tokens:** Aether Intelligence Design System (`frontend/src/index.css` / Deep Midnight palette)

---

## 1. Visual Hierarchy & Information Architecture

### 1.1 Acceptance Bar & Lineage
The design bar is established and frozen by the **G-2 Component Sketch 257** (`.planning/sketches/257-spend-and-metering/index.html`), verified pixel-perfect in browser dark mode with zero external charting library dependencies (pure Vanilla CSS + SVG).

### 1.2 Layout Structure (`/admin/spend`)

1. **Top Cockpit Header & Navigation Bar:**
   - Title: `Spend & Metering` (`text-2xl font-bold tracking-tight text-foreground`).
   - Subtitle: `"Attributable dollar spend across workflows and chat runs, with strict blind-spot honesty."`
   - Filter Bars:
     - Time Range: `Today` | `7D` | `Last 30D` (active default) | `All Time`.
     - Status Filter: `All (100)` | `Priced (92)` | `Unrated (8)` | `Incomplete Coverage (5)`.
     - Actions: Secondary `"Export Receipt (CSV)"` and Primary `"+ Reprice / Add Rate"` button.

2. **Top Metric Summary Row (4 KPI Cards):**
   - **Total Org Spend (30D)**: Primary metric (e.g. `$148.62*`), badge `METER-07`, footnote `* 92 runs priced · 8 unrated runs excluded`.
   - **Total Tokens Counted**: Large figure (e.g. `48.2M`), badge `METER-03`, token breakdown (`41.5M in · 6.7M out`).
   - **Runs Priced Ratio**: Metric `92 / 100` (92.0%), note `8 runs have no rate in model_rates`.
   - **Blind Spots & Residues**: Amber figure `13 runs`, badge `SEED-300`, breakdown `8 unrated models · 5 partial token_coverage`.

3. **Visual Charts Section (Dual SVG Column Grid):**
   - **Daily Spend Trend (14-Day Bar Chart)**:
     - SVG bar chart rendering 14 daily bars in primary indigo (`hsl(239 84% 67%)`).
     - Overlaid amber segments (`hsl(38 92% 50%)`) representing unrated run volume for each day.
     - Interactive tooltips displaying exact attributable dollar spend and unrated count.
   - **Spend by Model (Segmented SVG Donut Ring)**:
     - SVG ring showing percentage share of spend (`gpt-4o` 54%, `claude-3-5-sonnet` 28%, `deepseek-chat` 17%).
     - Explicit amber legend item for `8 unrated runs (Excl.)`.

4. **"What This View Cannot See" Honesty Summary Card:**
   - Card container with amber border (`border-warning/40`) and soft dark background.
   - Title: `"What This View Cannot See — System Blind Spots & Coverage Residues"` with warning icon.
   - Disclosure text: Explains excluded unrated runs and partial token coverage runs.
   - **Coverage Honesty Gauge**: Dual-color progress bar (`92% Certified` emerald vs `8% Unrated` amber).
   - Quick action pill buttons:
     - `"View 8 Unrated Runs →"` (sets status filter to `unrated`).
     - `"View 5 Incomplete Coverage Runs →"` (sets status filter to `incomplete`).
     - `"Open Rate Registry (Migration 183) →"` (opens Reprice modal).

5. **Attributable Runs Ledger (Interactive Data Table):**
   - Table headers: `Run / Workflow`, `Model / Provider`, `Status`, `Token Ratio (In / Out)`, `Attributable Spend`, `Coverage (METER-06)`.
   - Row elements:
     - **Provider badges**: Color-coded badges for OpenAI (`OA`), Anthropic (`AN`), DeepSeek (`DS`), OpenRouter (`OR`), LMStudio (`LM`).
     - **Token Ratio Split Bars**: Dual-tone micro progress bar displaying prompt tokens (cyan `hsl(187 92% 55%)`) vs completion tokens (violet `hsl(270 95% 75%)`) with percentage chip (`93% in`).
     - **Attributable Spend**: Monospace dollar amount (e.g. `$1.3160`) with mini spend magnitude bar underneath.
     - **Unrated Badges**: For unrated runs, renders amber badge `▲ Unrated` with hover tooltip naming model; **never renders `$0.00`**.
     - **4-Leg Coverage Track**: Four connected status dots representing `agent`, `single`, `batch`, `emit`. Fully counted runs show `● ● ● ● 4/4` (green). Runs with missing legs show amber pulse and `● ● ● ◐ 3/4`.

6. **Reprice / Add Rate Modal Dialog:**
   - Header: `"Reprice Model Rate"` with description.
   - Form fields:
     - Model ID (dropdown or text input).
     - Provider (optional dropdown: `openai`, `anthropic`, `deepseek`, etc., or `Default / Any`).
     - Input Cost per 1M tokens (USD, `numeric(12, 6)`).
     - Output Cost per 1M tokens (USD, `numeric(12, 6)`).
     - Effective From timestamp (default: `Now`).
   - Warning callout: *"Repricing is strictly append-only. Existing completed runs will not be modified."*
   - Buttons: `"Cancel"` and `"Save Effective Rate"`.

---

## 2. Run-Level Cost Affordances

### 2.1 WorkflowRunPage (`WorkflowRunPage.tsx`)
- In the run header beside runtime duration and token count:
  - If rated and full coverage: `<RunCostBadge cost="$0.1420" tokens="45.2k" />`
  - If unrated: `<RunCostBadge isUnrated={true} model="qwen-2.5-72b" tokens="12.4k" />` (renders amber `Unrated` chip, clicking opens Reprice modal).
  - If rated but incomplete coverage: `<RunCostBadge cost="$0.4500*" isIncomplete={true} tooltip="Missing emit leg" />`

### 2.2 RunCard (`RunCard.tsx`)
- Surfaced in the footer metrics area next to duration:
  - Shows compact dollar chip (e.g. `$0.04`) or amber `Unrated` chip.

---

## 3. Typography & Color Specifications

| Element | Class / Token | Purpose |
|---|---|---|
| Background | `bg-background` (`hsl(216 45% 4%)`) | App background |
| Card Surface | `bg-card` (`hsl(220 30% 7%)`) | Container surface |
| Primary Accent | `hsl(239 84% 67%)` | Spend bars, primary buttons |
| Input Tokens (Prompt) | `hsl(187 92% 55%)` | Cyan token split bar |
| Output Tokens (Completion) | `hsl(270 95% 75%)` | Violet token split bar |
| Rated Spend Value | `text-emerald-400 font-mono` | Accurate attributable USD |
| Unrated Warning Tag | `bg-amber-500/10 text-amber-400 border-amber-500/30` | Strict blind spot visibility |
| Incomplete Coverage Tag | `text-amber-300 font-mono` | Lower-bound dollar warning |

---

## 4. Copywriting & Interaction Contracts

### 4.1 Strict Anti-Falsehood Invariant (`D-257-05`)
- Under **no circumstance** may an unrated model display `$0.00` or `$0`.
- The string `"$0.00"` may only be rendered if a model's registered rate in `model_rates` is genuinely `0.000000` (e.g. free local model explicitly registered with 0 cost).

### 4.2 Honesty Disclosures (`D-257-06`, `D-257-07`)
- Whenever unrated runs are in the selected window, the total headline spend MUST carry an asterisk `*` and an explicit disclaimer line:
  `* {count} runs priced · {unrated_count} unrated runs excluded from total`
