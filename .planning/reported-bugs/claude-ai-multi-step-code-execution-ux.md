---
id: BUG-260512-01
title: Claude.ai multi-step code execution UX — eager file re-listing + dead-end QA steps
reported: 2026-05-12
surface: Claude.ai
severity: minor
status: external-noted
affected_areas: []
folded_into: null
related_seeds: []
re_open_trigger: null
reproduces_on:
  branch: n/a
  commit: n/a
  date: 2026-05-12
---

# Claude.ai — Multi-step code execution UX behavior

**Reported:** 2026-05-12
**Surface:** Claude.ai web UI (`claude.ai/code`), Opus 4.6
**Context:** Long agentic task — "search for Fahed Mrad dissertation, make a professional pptx for defence session and include comprehensive charts and visuals." Used the `pptx` skill.

> **Routing:** `surface: Claude.ai` → external observation. NOT a candidate for any Agentic-RAG phase. Kept here for the user's own product-feedback log; downstream GSD cross-checks (discuss-phase, new-milestone, complete-milestone) will SKIP this report (filter on `surface != Agentic-RAG`).

---

## What we observed

| # | Concern | What's actually happening |
|---|---|---|
| 1 | 7 code-execution steps for one task | Normal for skill-based work. The `pptx` skill is a documented multi-step pipeline: build deck chunk → generate charts → finish deck → QA → visual QA. |
| 2 | Files re-appear under every step | The sandbox is a persistent container for the whole turn. The UI snapshots the *current* file state after each step. No files are recreated — just re-listed. Looks duplicated, isn't. |
| 3 | Long pauses (especially ~169 s) | Real CPU work, not a hang. matplotlib rendering 10 styled charts is genuinely ~3 minutes. Plus ~6 sequential RAG retrievals on a 4-chapter dissertation. Two extra dead-end steps trying to find `soffice` for PDF QA. |
| 4 | "Resume" appears + refresh keeps the flow going | By design. The turn runs **server-side** as a long-lived stream. The browser is just a viewer. Refresh → server keeps going → UI re-attaches via the "Resume" affordance. |

## Step-by-step breakdown of the actual run

| # | Step | Wall time | Purpose |
|---|---|---|---|
| 1 | Build slides 1–8 | 4.8 s | python-pptx layout for first 8 slides → `defence_part1.pptx` |
| 2 | Generate 10 charts | **169.1 s** | matplotlib rendering 10 PNGs (age, gender donut, industry, org size, RPA platform, construct means, Cronbach's α, EFA variance, hypothesis results, SUCCESS radar) |
| 3 | Build slides 9–19 | 1.3 s | python-pptx layout for remaining slides → final 752 KB deck |
| 4 | Content QA (no print) | 7.9 s | Re-opened the deck, no output |
| 5 | Content QA (with print) | 1.0 s | Same QA, this time printed slide text |
| 6 | PDF conversion attempt | 0.3 s | Tried `soffice` — failed: `can't open file '/sandbox/scripts/office/soffice.py'` |
| 7 | Locate `soffice` binary | 0.9 s | `which soffice` / `which libreoffice` — both empty |

## Why it feels wrong (the real UX gap)

For a task with **one final deliverable** (`Fahed_Mrad_DBA_Defence_Presentation.pptx`) plus 10 intermediate PNGs that are just chart inputs, the eager file listing is pure noise. The PNGs are already embedded in the deck — you don't want to download them separately. But you see the same 11 files re-listed 7 times.

Claude.ai doesn't currently distinguish "deliverable" from "scratch artifact" and doesn't collapse intermediate file listings into one final summary.

## Workarounds (prompt-side, no product change needed)

1. **Clean up scratch files**: *"After embedding charts into the pptx, delete the individual PNGs so only the final deck appears in outputs."* One `os.remove()` loop kills ~90% of the noise.
2. **Single consolidated final step**: *"Do all building and chart generation, then in a single final cell save outputs and print only the path to the deck."*
3. **Skip dead-end QA**: *"Don't attempt PDF rendering for QA — trust the content QA only."* Kills steps 6 and 7.
4. **UI**: collapse intermediate code blocks manually using the caret on each block.

## What would fix this in the product

Things only Anthropic can change:

- Single sticky "Outputs" panel at the bottom that **updates in place** instead of repeating.
- Diff-style listing: each step shows only the files *it created or changed*, not the full state.
- A "Final artifacts" section at turn-end that pulls out the last-modified or model-marked deliverables.

---

## Cross-provider applicability

These behaviors are a mix of **universal agentic-LLM patterns** and **Claude.ai-specific UI choices**.

| Behavior | Anthropic (Claude.ai) | OpenAI (ChatGPT / Assistants) | Google (Gemini / AI Studio) | OpenRouter |
|---|---|---|---|---|
| Multi-step code execution | Yes (skills + raw tool use) | Yes (Code Interpreter, Responses API tools) | Yes (Gemini code execution) | Inherits from the chosen model's host |
| Persistent sandbox across steps | Yes, per turn | Yes, per conversation session (longer-lived than Claude's per-turn) | Per-turn, less persistent | N/A — OpenRouter routes the *model*; sandbox is the caller's responsibility |
| Server-side turn execution + resume on refresh | Yes | Yes (ChatGPT keeps generating if tab closes) | Yes (Gemini web) | Provider-dependent; OpenRouter itself doesn't host a UI |
| Repeated retrievals / chatty planning | Yes — model-level behavior | Yes (GPT-5 family behaves similarly) | Yes | Yes — LLM planning trait, not a vendor trait |
| Long CPU pauses on matplotlib etc. | Yes | Yes | Yes | Yes |
| **Files re-listed under every step** | **Yes (the noisy bit)** | No — files appear inline with the message that created them, not re-summarized after | Shown in a side panel, updated in place | N/A |
| Skills / pre-packaged multi-step workflows | Yes (Skills) | Yes (GPTs, Assistants with tools) | Yes (Gems) | No — OpenRouter has no skill layer |

### Implication for the Agentic RAG app

Since this project routes across OpenAI, OpenRouter, Anthropic native SDK, and Google, the **backend concerns** (long CPU pauses, persistent sandbox, server-side streaming, agentic re-planning) are **the same regardless of provider**.

The thing that varies is **how the UI presents intermediate state** — and that's a **frontend choice we own**, not a provider behavior. If our frontend builds:

- a sticky "Outputs" panel that updates in place, or
- a "files created in this step" diff (instead of full-state snapshots), or
- a final-artifact section that surfaces only the deliverable

…we'll dodge the noise pattern entirely, regardless of which provider is doing the model work underneath. The provider only controls the *agent loop*; the artifact UX is on us.

---

## TL;DR

- Nothing was broken in the Claude.ai run — it was a legit ~5 minute pptx job dominated by one 3-minute matplotlib step + two cheap dead-end QA attempts.
- "Resume + refresh continues" is correct, intended behavior (server-side streaming).
- The file-list repetition is a Claude.ai UI choice with real trade-offs; cleanest fix is prompt-side (`os.remove()` scratch files before final step).
- For our own RAG app: the backend agentic patterns are provider-neutral; the artifact UX is on us to design.
