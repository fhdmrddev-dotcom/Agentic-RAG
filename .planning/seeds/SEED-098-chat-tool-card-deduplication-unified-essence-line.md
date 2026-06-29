---
id: SEED-098
status: planted
planted: 2026-06-30
planted_during: v3.2 Phase 132 execution (separate investigation — operator-recorded a DeepSeek run, asked to unify the chat tool-call surface)
trigger_when: After Phase 132 ships, OR any phase that touches the chat live-execution surface (ToolCallPanel / MessageItem / RunCard), OR a dedicated chat-UX cleanup pass
scope: Small-Medium (2 files: MessageItem.tsx + ToolCallPanel.tsx; one StreamsProvider field read)
related: [[feedback_seamless_scroll_no_boxed_chat]] [[feedback_uat_lived_experience_gap]] [[project_128_reframed]] (CTC-01..04 chat tool-card unification — this is the live-state follow-on)
re_open_trigger: First user complaint about chat noise during a live run, or the next phase touching ToolCallPanel/MessageItem
surface: Agentic-RAG
guardrails: G-2 (sketch-before-plan — active-row look) DONE; G-4 (lived-experience UAT — cross-provider live run)
---

# SEED-098: Chat tool-card de-duplication — one unified essence line, live and finished

## The problem (operator-observed, recorded)

During a live agent run the chat surface renders the **same activity in four overlapping places at once**, which reads as noise / "too much information":

1. **The Run card** (canonical, good) — bordered card, step-rail, each tool a node with a `● DONE · 1.5s` pill + step number. This is the **approved shape** (operator screenshot `screenshots/Screenshot 2026-06-30 010510.png`).
2. **Loose pointer lines below the card** — `→ updated todos  see panel →` (stacks once per `write_todos` call — can repeat 5×), `⚡ Skill activated: docx`.
3. **A bottom italic echo** — `Analyzing document… / Preparing code…` repeating the run-card header strip.
4. **The right Workspace panel** — the canonical TODOS list.

Net: todos appear in **3** places, skill activation in **2**, and the live verb in **2**. Plus the active tool's body **auto-expands** the heavy streaming panel (code / raw JSON), then **collapses** to the clean line when it finishes — the "show → collapse → uncollapse → change" flicker the operator called out.

## Root-cause map (evidence — file:line as of 2026-06-30)

| Symptom | Source | Why redundant |
|---|---|---|
| `→ updated todos  see panel →` (stacks) | `frontend/src/components/chat/MessageItem.tsx:415-429` — a `SeamPointer` per `write_todos`/`workspace_write` while streaming | `write_todos` is already a step node in the card **and** the right panel shows the real todos. One pointer per call → stacks. |
| `⚡ Skill activated: docx` (loose) | `MessageItem.tsx:430-435`, field `message.activatedSkill` | Same skill ALSO renders in-card as `Loading skill "docx"` (`ToolCallPanel.tsx:286` SkillRow, field `activatedSkills`). `StreamsProvider.tsx:656-657` sets BOTH fields on one event; the singular is commented "Legacy… DB-loaded compat" but still rendered live. Pure double-render. |
| `Preparing code… / Analyzing document…` (bottom italic) | `MessageItem.tsx:557-606` sticky bottom label | Duplicates the run-card header `RunStatusStrip` (live verb + timer). |
| Active tool body auto-expands (flicker) | `ToolCallPanel.tsx:792-993` (ExecuteCodeBody / `ToolArgsLivePanel`) auto-shown for `preparing`/`running` | Heavy streaming body shown by default, then collapses to `ToolEssenceLine` on done. |
| TODOS (right panel) | Workspace panel | **KEEP — canonical source.** |

## The locked target (operator-confirmed 2026-06-30)

**Every tool = one essence line, always** — the `ToolEssenceLine` shape (`ToolCallPanel.tsx:334`) used today only for finished tools becomes the resting shape for **active** tools too. Only the right-side pill + rail node change by state:

| State | Rail node | Right pill | `→` text |
|---|---|---|---|
| preparing | pulsing primary + step # | `● PREPARING` (or live `X.X KB`) | (none yet) |
| running | pulsing primary + step # | `● RUNNING` + live timer | live summary or none |
| done | filled green + step # | `● DONE · 1.5s` | `→ result` |

Rules:
1. **No auto-expand** of the heavy body during execution — kills the flicker.
2. Live streaming code/args stays **behind the chevron** — click any in-flight row to expand and watch it live; collapses back on its own.
3. Remove the loose lines below the card: `write_todos` SeamPointer (todos live only in the right panel), `activatedSkill` loose line (in-card `Loading skill` covers it), bottom `Preparing code…` echo. **KEEP** the `ask_user` paused cue (not duplicated).

Out of scope / leave for now: the messy **thinking** stream (no line breaks, inconsistent per provider) — lower confidence, separate concern.

## Sketch

Operator-approved active-row look lives at: `.planning/seeds/assets/SEED-098-active-row-sketch.html` (built 2026-06-30, this session). Use it as the acceptance bar for the active-row state (G-2 satisfied at scope time).

## Suggested execution shape

Small dedicated **"chat tool-card live-state unification"** phase (separate branch from 132):
- Item 4 (active-row shape) → drive from the sketch.
- Items 1-3 (remove loose duplicates) → fast deletions in `MessageItem.tsx` + stop rendering the legacy singular field live.
- G-4 lived-experience UAT: watch a real cross-provider live run end-to-end (DeepSeek + 1 native big-4) — wire format alone is insufficient.
