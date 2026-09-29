---
sketch: 268
name: expert-spend-and-mid-thread-scope
question: "Where does a live thread's folder-scope control live, how does a change say what an active Expert does to it, and how does /admin/spend show spend per Expert with a 'No Expert' line that is never dropped?"
winner: "Chat A (composer chip) · Restricted: Save & say · Spend A (filter every card follows) — operator, 2026-09-28"
tags: [experts, chat, scope, transcript-event, spend, metering, chat-08, meter-08, g2-sketch-gate, phase-268]
---

# Sketch 268: Expert spend & mid-thread scope

G-2 sketch for Phase 268 (METER-08, CHAT-08). It is built on 267's winning visual language (Variant B, "Will / won't
ledger": a timestamped event card with labelled lines) and on the shipped `/admin/spend` cockpit.

## How to View

open .planning/sketches/268-expert-spend-and-mid-thread-scope/index.html

Top bar: **Surface** (Chat / Spend) × **Variant** (A / B). The chat surface also has a state bar: Expert (None /
Biased / Restricted), Run (Idle / Answer streaming), Under Restricted (Save & say / Lock), and Simulate reload.

## Grounding (measured, not assumed)

- Today the scope is a thread-creation argument only: the `<select>` lives inside `ChatArea.tsx`'s `if (!thread)`
  branch (SEED-286).
- `backend/app/services/expert_scope.py::compose_expert_scope`: **restricted** reads the Expert's folders only, so
  the thread folder is ignored. **biased** reads the thread subtree plus the Expert's folders.
- `/admin/spend` already had a finding (257) where the coverage filter moved the ledger but not the charts. Variant A
  on the spend surface is designed so that cannot happen again.

## Variants

### Chat surface
- **A · Composer chip:** a `📁 <folder> ▾` chip beside the Expert chip, above the input.
- **B · Header pill:** a `Scope <folder> ▾` pill in the thread header, next to the title.
- **Under Restricted (orthogonal toggle):** *Save & say* means the change is saved and the card says it waits for
  the Expert to leave. *Lock* means the picker refuses and gives the reason.

### Spend surface
- **A · Expert filter that every card follows:** filter pills beside Time. KPIs, charts and the ledger all follow the
  filter, and a line under the ribbon states the current filter. A "Spend by Expert" table is always shown.
- **B · Group by Model / Expert:** KPIs stay org-wide. A switch regroups the breakdown chart and table, and the
  ledger gains an Expert column.

## Shared by all variants (locked, not the choice)

- The scope change is a persisted transcript card that survives reload and is never sent to the model.
- It applies from the **next** message. An answer that is streaming keeps the old scope, and the card says so.
- A run is attributed to the Expert that was **active when the run started**, and that is stored on the run. Sub-agent
  and paused→continued runs count toward their parent run's Expert.
- `No Expert` is always a row. The Expert lines always sum to the org total, and a reconciliation footer checks it.
- USD comes from the one 257 token-to-USD calculation. Attribution is a column, not a second formula.

## What to Look For

- Chat: which home would you glance at to answer "what is this thread reading right now?" Does the Restricted
  "not searched" state read clearly at rest, without hovering?
- Spend: do you need one Expert's daily trend (A), or only the breakdown (B)?

## Winner (operator, 2026-09-28)

- **Chat: A · Composer chip.** A `📁 <folder> ▾` chip beside the Expert chip, above the input. It opens a folder
  picker whose ledger shows *Next message searches* and *Stops searching*, both built from ONE structured payload
  (267's D-267-11 rule).
- **Under Restricted: Save & say.** The change is saved. The chip goes dashed and reads `· not searched`. The
  transcript card reads `Saved / Searching: HR Policies only · HR Advisor is Restricted` and "Takes effect when HR
  Advisor leaves." Nothing is blocked, and nothing is hidden.
- **Spend: A · Expert filter that every card follows.** KPIs, both charts and the ledger all narrow together, and a
  line under the ribbon states the current filter. A "Spend by Expert" table (every Expert, plus `No Expert`) is
  always shown, with a reconciliation footer.
