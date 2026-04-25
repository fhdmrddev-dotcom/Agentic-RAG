# Phase 52: Multi-Provider Model Routing - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-25
**Phase:** 052-multi-provider-model-routing
**Areas discussed:** Cross-provider fix, Fallback behavior, Settings UI — model roles, MDL requirements scope

---

## Cross-Provider Fix

| Option | Description | Selected |
|--------|-------------|----------|
| Validate on save | Block Settings save if model ID not in active provider's model list | ✓ |
| Detect at call time | Ignore mismatched override at call time, fall through to provider default silently | |
| Store override per-provider | Dict keyed by provider ID in settings_override.json | |

**User's choice:** Validate on save

---

### Save validation UX

| Option | Description | Selected |
|--------|-------------|----------|
| Block save + inline error | Inline error under field: "Model X not available for provider Y." Save disabled. | ✓ |
| Allow save with warning | Yellow warning, save still allowed | |
| Clear field on provider switch | Auto-clear sub_agent_model when active provider changes | |

**User's choice:** Block save + inline error

---

## Fallback Behavior

### Trigger scope

| Option | Description | Selected |
|--------|-------------|----------|
| Retry with provider default + SSE event | 404 → fallback + `fallback_model` SSE event → toast notification | ✓ |
| Retry silently | Same fallback, no SSE event | |
| Fail the request | Surface error directly, no fallback | |

**User's choice:** Retry with provider default + SSE event

---

### Error types that trigger fallback

| Option | Description | Selected |
|--------|-------------|----------|
| 404 only | Only model-not-found errors; auth/rate-limit/server errors surface directly | ✓ |
| 404 + auth errors | Also catch 401/403 and retry with fallback model | |
| Any API error | Fallback on all errors | |

**User's choice:** 404 only

---

### Fallback scope (which callers)

| Option | Description | Selected |
|--------|-------------|----------|
| Sub-agent only | run_sub_agent, generate_suggestions, generate_thread_title | ✓ |
| Both main and sub-agent | Apply fallback to main chat model too | |
| Claude's discretion | Leave main chat error handling as-is | |

**User's choice:** Sub-agent only

---

## Settings UI — Model Roles

### Display format for title/follow-up roles

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only labels | Two info rows under sub-agent dropdown showing resolved model names | ✓ |
| Separate dropdowns per role | Individual dropdowns for title_model and followup_model | |
| Agent Roles summary table | Table showing all 4 roles; sub-agent row editable, others read-only | |

**User's choice:** Read-only labels

---

### "Auto" label display

| Option | Description | Selected |
|--------|-------------|----------|
| Show resolved name with (auto) tag | "gpt-4.1-nano (auto)" — requires resolved_sub_agent_model in settings GET | ✓ |
| Show Auto (unresolved) | Just "Auto" when no override — simpler, less informative | |
| Show provider default description | "cheapest model for active provider" — descriptive without a specific name | |

**User's choice:** Show resolved name with (auto) tag

---

## MDL Requirements Scope

### MDL-01 enforcement mechanism

| Option | Description | Selected |
|--------|-------------|----------|
| Save-time validation | Block Settings save if model not in provider's list | ✓ |
| Runtime enforcement | Ignore override at call time if provider mismatch detected | |
| Both: save-time + runtime guard | Two-layer defense | |

**User's choice:** Save-time validation only

---

### MDL-03 interpretation

| Option | Description | Selected |
|--------|-------------|----------|
| Just verify it works | Verification requirement — confirm history persists, no new code | ✓ |
| Context budget re-evaluation | Re-evaluate trimming with new model's context window | |

**User's choice:** Just verify it works (no new code)

---

### OpenRouter _SUB_AGENT_MODEL_DEFAULTS

| Option | Description | Selected |
|--------|-------------|----------|
| Leave as-is ("") | Falls through to main model — safe for varied OpenRouter subscriptions | ✓ |
| Add recommended cheap model | e.g., google/gemma-4-31b-it:free | |
| Let user configure it with hint | Show hint in UI for OpenRouter users | |

**User's choice:** Leave as-is

---

## Claude's Discretion

- Toast notification styling for `fallback_model` SSE event
- Exact inline error message wording for Settings save validation
- `resolved_sub_agent_model` field placement in settings GET response
- 404 detection across provider error shapes (use `openai.NotFoundError` exception class)

## Deferred Ideas

- Per-provider sub_agent_model storage (keyed dict)
- Separate title_model / followup_model dropdowns
- Fallback for main chat model
- Hardcoded cheap model for OpenRouter
- Runtime provider-mismatch guard at call time
