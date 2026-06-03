---
sketch: 011
name: mode-and-composer
question: "How does the composer simplify, how is mode made unambiguous, and how is a running workflow shown once the Deep/Harness toggle + workflow picker leave the composer?"
winner: "A"
tags: [composer, mode, d-092-ux, finding-5, axes, phase-094]
---

# Sketch 011: Mode & Composer

## Design Question
Today the composer carries up to **5 pills** (Provider · Model · General/Explorer · Deep/Harness
toggle · workflow picker) and the **finding-#5 bug**: on a thread mid-Harness-run the toggle still
reads **"Deep"** (a client `useState` never reconciled to server truth — BRIEF §4.2). D-092-UX:
collapse to a stable **2-pill composer `[Model ▾][General/Explorer ▾]`**, move launch OUT to the
Workflows page (012), and make mode unambiguous.

## How to View
open .planning/sketches/011-mode-and-composer/index.html

**State cycler** (top-right): `Rest · Deep` → `Harness running` → `cap_paused` → `ask_user`.
Toggle **"show OLD composer"** to see the before (5 pills + the finding-#5 bug) under the new one.

## The fixes (true in all variants)
- **Provider folds into Model** — one grouped dropdown (`openai/gpt-5.4 ▾`), zero backend change.
- **Deep/Harness toggle + workflow picker LEAVE the composer.** Deep is the resting default
  (= no workflow running). You start a workflow from the **Workflows page** (012), which puts that
  thread into Harness. → **finding #5 is killed by construction** (no pill left to mislabel) and the
  **silent-Deep-send risk is gone** (no picker to orphan-launch).
- **The 2×2 made legible** (the in-chat cards): *How it thinks* (General/Explorer, per-message,
  `agent_mode`) is a different axis from *free chat vs locked workflow* (Deep/Harness,
  `active_workflow_run_id`, run-scoped). The old 4-adjacent-pills row blurred these into "4 modes."
- **cap_paused Continue** stays a **thread card** (amber, "Continue (2 left)"), never a composer
  control — matches the real `MessageItem.tsx` placement.

## Variants (how a RUNNING workflow is shown once the toggle is gone)
- **A: Status chip + Cancel ★** — a slim line above the composer: `⚙ Harness · Literature review ·
  phase 2/3 · Cancel`; textarea disabled. Minimal presence, **Cancel stays where your cursor is**,
  full timeline stays in the panel.
- **B: Composer → run bar** — the composer transforms into a progress bar (`phase 2/3 · 4 agents ·
  26 sources · Cancel`). Unmissable, but **duplicates** the panel's progress + Cancel.
- **C: Panel-owned, composer quiets** — composer just disables ("Running in workspace — follow along
  in the panel ▸"); mode + Cancel live only in the panel. Purest UNIFY, but **Cancel is hidden if
  the panel is collapsed to the rail.**

## Recommendation
**A.** It threads the needle: it doesn't duplicate the panel's full progress like B, and it doesn't
hide Cancel like C (Cancel/Stop must be reachable where the user's attention is — at the composer).
The *full* run state still lives in the panel (008/009); the chip is just a minimal "running +
stop." C is the purist-UNIFY option and is fine **if** we guarantee the panel is always at least a
visible rail during a run; A is safer because it doesn't depend on the panel being open.
