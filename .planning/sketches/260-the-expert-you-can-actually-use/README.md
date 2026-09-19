---
sketch: 260
name: the-expert-you-can-actually-use
question: "How should a domain expert be invited mid-thread, visibly scope retrieval/tools while preserving conversation history, present 'Try asking...' onboarding suggestions, and be dismissed with zero new top-level composer controls?"
winner: null
tags: [experts, chat, composer, consultant-model, onboarding, scoping, pack-02, pack-03, pack-05, d-259-07]
---

# Sketch 260: The Expert You Can Actually Use (Consultant Model)

## Design Question

Phase 260 introduces chat thread integration, the expert picker, and onboarding chips (`PACK-02`, `PACK-03`, `PACK-05`).
Under operator decision **`D-259-07`** (ratified 2026-09-20, superseding `D-259-02`):

> *"An Expert is a **consultant you invite mid-thread**, sticky until dismissed — NOT a room you enter by starting a new thread... It scopes **retrieval and tools**, never conversation history. The model still sees what was said before it joined, it just stops searching outside the Expert's folders, skills, and connections."*

Furthermore, the composer was measured at 4 pickers plus 2 chip rows: **the UI budget is ZERO new top-level composer controls**.
The invite affordance must live inside the existing `+` menu alongside local/cloud files and connectors, and the active Expert must render as a dismissible chip in the existing `ActiveConnectorChips` row container.

How should this interaction feel in practice?
1. **Discovery & Invitation**: How does a user discover and summon an Expert mid-thread from the `+` menu?
2. **Scoping Legibility**: How does the user know the Expert is active, what knowledge folders/tools are restricted, and that conversation history is preserved?
3. **Onboarding & "Try Asking..."**: Where and how do prompt suggestions render so a user can immediately start a meaningful run?
4. **Dismissal & Scope Return**: How does dismissing the Expert cleanly return the thread to general scope without losing context?

---

## Shipped Architecture & Constraints

- **Migration 187 (`public.expert_bundles`)**: `name`, `slug`, `description`, `scope_mode` ('restricted' | 'biased'), `member_skills`, `knowledge_folder_ids`, `required_connections`, `prompt_suggestions` (`jsonb`), `is_system`, `org_id`.
- **First-party seed**: `financial-analyzer` (slug).
- **Phase 258 Entitlement**: `require_capability("experts")` gates listing and access.
- **Phase 259 Two-Phase Member Resolution (`expert_service.py`)**: `resolve_expert_bundle` strips cross-org or unshared private member assets (`PACK-04`).
- **Architectural Red Line**: Scope resolved as **data handed to the agent loop**, NEVER as an `if expert:` branch inside `agent_loop.py` (`PACK-01` / `EXT-01`).
- **URL Routing**: Explicitly **out of scope** for Phase 260 to keep `App.tsx` fenced.

---

## The Three Variants

### Variant A: "In-Flow Consultant" (Calm & Integrated)
- **Invite Entry**: In the composer's existing `+` menu, a clean top action `✨ Invite Expert...` with a subtle badge showing available count.
- **Picker**: Centered modal dialog `Invite Domain Expert` with search, expert cards, badges (System, Restricted), member asset summaries, and one-click "Invite to Thread".
- **Chat Announcement**: A calm system event in the thread: `✨ Financial Analyzer joined the conversation · Scoped to SEC Filings & Financial Skills`.
- **Onboarding Suggestions**: Actionable `Try asking:` pills render directly below the announcement in the chat stream (`SuggestionPills` style).
- **Composer Presence**: A clean chip `[✨ Financial Analyzer · Restricted ×]` rendered in the existing `ActiveConnectorChips` row container (sibling to connectors and file attachments).
- **Dismissal**: Clicking `×` removes the chip and posts a quiet timeline note: `Financial Analyzer dismissed · Scope returned to general`.

### Variant B: "Flyout Specialist & Scope Peek" (Density & Direct Access)
- **Invite Entry**: Inlined `EXPERTS` flyout section inside the `+` menu (mirroring `ConnectorsFlyout`), allowing 1-click invitation directly without a modal.
- **Chat Announcement**: Structured specialist card with an expandable "Scope Details" drawer listing exact member folders (e.g. `📁 10-K & Annual Reports`), skills (`🧰 ratio_calculator`), and restriction policies.
- **Composer Presence**: Interactive chip with popover trigger: `[✨ Financial Analyzer ▾ | ×]`. Clicking opens a mini scope-inspector popover.
- **Onboarding Suggestions**: Docked suggestion strip floating directly above the composer textarea until the first message is sent.
- **Dismissal**: Clicking `×` dismisses immediately with a smooth slide-out transition.

### Variant C: "Thread Header & Specialist Briefing" (Presence-Forward)
- **Invite Entry**: Command-palette style picker invoked from `+` menu.
- **Thread Announcement**: Dedicated specialist greeting bubble: avatar with purple sparkle, introductory statement, and large prompt action cards.
- **Header Badge**: Thread title in the top bar gains an active consultant badge: `Q3 Review  [✨ Financial Analyzer]`.
- **Composer Presence**: Compact pill `[✨ Finance ×]`.
- **Dismissal**: Dismissible via `×` in composer or top header badge.

---

## How to View

```bash
# Open in default browser:
start .planning/sketches/260-the-expert-you-can-actually-use/index.html
# or the flat convenience copy:
start .planning/sketches/260-the-expert-you-can-actually-use.html
```

Use the top toolbar to switch between **Variant A**, **Variant B**, and **Variant C**, toggle between **New Empty Thread** and **Mid-Thread with History**, test the interactive `+` menu, invite/dismiss the Financial Analyzer, and click "Try asking..." suggestions to see composer auto-population.
