# Phase 51: Context Window Management - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-23
**Phase:** 051-context-window-management
**Areas discussed:** Task Routing Triggers, Settings UI Placement, Model Info Card Design, tiktoken Scope

---

## Task Routing Triggers

| Option | Description | Selected |
|--------|-------------|----------|
| Output-format keywords | Match on artifact words: pptx, powerpoint, presentation, report, document, pdf, spreadsheet, excel, csv export | ✓ |
| Verb-first: creation verbs | Match on verbs: create, generate, draft, write, compose, build, design, produce | |
| Both verb + format keywords | Require either a creation verb OR a file format keyword | |

**User's choice:** Output-format keywords
**Notes:** Unambiguous — if the task mentions creating a file type, it's a generation task.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same model as main agent | Use user_settings.llm_model — no new env var needed | ✓ |
| Configurable via env var | Add SUB_AGENT_GENERATION_MODEL env var | |
| Hardcoded capable tier per provider | Always use Sonnet/GPT-4o/Gemini Flash regardless of main model | |

**User's choice:** Same model as main agent
**Notes:** Picks up from user_settings automatically, no new configuration needed.

---

## Settings UI Placement

| Option | Description | Selected |
|--------|-------------|----------|
| New section on AI Model tab | Add Context & Sub-Agent section below provider/model config | ✓ |
| New dedicated tab | Add a Context tab between AI Model and Search | |
| Inside Web/Code tab | Group with sandbox settings | |

**User's choice:** New section on AI Model tab
**Notes:** Keeps all model-related config together without adding a 6th tab.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Number inputs | Use existing NumberInput component — consistent look | |
| Sliders (as requirements say) | HTML range inputs with min/max/step | ✓ |

**User's choice:** Sliders
**Notes:** Specified in CTX-03; introduces a new SliderInput component pattern.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Token budget override | Maps to context_window_max_tokens — 0 to 200k, 0=auto | ✓ |
| Recent messages reserved | Maps to context_window_reserve_recent — range 5–30 | |

**User's choice:** Token budget override (context_window_max_tokens)

---

## Model Info Card Design

| Option | Description | Selected |
|--------|-------------|----------|
| Info icon + popover on hover | Small ℹ icon next to model name, hover shows compact popover | ✓ |
| Expanded dropdown item | Each item shows name + 2 lines of detail always visible | |
| Tooltip on model name hover | Tooltip triggered by hovering model name | |

**User's choice:** Info icon + popover on hover
**Notes:** Non-intrusive — users who don't care see the same clean list.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Context + output limits + best-for | 3 fields, skip cost tier | ✓ |
| All 4 fields as specified | Context, output, cost tier, best-for | |

**User's choice:** Context + output limits + best-for (skip cost tier)
**Notes:** Cost tier too volatile and provider-dependent to maintain accurately.

---

## tiktoken Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Optional dep, graceful fallback | Add to requirements.txt; if import fails, use chars/4 silently | ✓ |
| Hard dependency, always required | No fallback | |

**User's choice:** Optional dep, graceful fallback
**Notes:** Log once at startup if not available; don't fail on every call.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Only in context_window.py estimate_tokens() | Replace chars/4 for OpenAI models in estimate_tokens() | ✓ |
| Also in sub-agent token counting | Apply tiktoken wherever tokens are estimated | |

**User's choice:** Only in context_window.py estimate_tokens()
**Notes:** Sub-agent uses char limit not token limit — tiktoken adds no value there.

---

## Claude's Discretion

- Exact popover styling and positioning
- Slider visual design (Deep Midnight theme)
- Auto-state display on context depth slider (value=0)
- tiktoken encoding for GPT-4.1 models (use cl100k_base as specified)

## Deferred Ideas

- Cost tier lookup per model — too volatile
- tiktoken for non-OpenAI providers
- Dynamic model metadata from provider APIs
