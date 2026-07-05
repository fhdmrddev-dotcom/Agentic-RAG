---
seed_id: SEED-104
title: Comprehensive agent-driven skill file attachment — scripts, generated assets, and user-uploaded templates the agent can attach to a skill without a manual UI step
status: open
planted: 2026-07-05
phase_origin: "Operator, during Phase 137.2 live SC#4 UAT (3rd round): both DeepSeek and OpenAI runs confirmed a real, cross-provider gap — the agent has no tool to attach a file to a skill, only workspace_write (a separate scratch area). Operator wants a comprehensive fix matching Anthropic's real skill-creator capability, but explicitly deferred building it in this session to avoid stacking a 3rd decimal insert onto the 137.x chain mid-milestone."
category: product capability — skill-creator / skills platform, explicitly deferred to its own phase
related_seeds:
  - SEED-101-skill-creator-native-builtin-protected (the phase that shipped the current, file-attach-limited skill-creator)
  - SEED-096 (skill bundle-tree fidelity — a related but distinct gap: imported non-Python skill scripts are inert; this seed is about the agent's ability to CREATE/ATTACH files at all, not about executing every file type)
related_memories: [reference_js_skill_import_gap, feedback_separate_per_feature_safe_by_construction]
priority: medium
---

# SEED-104 — agent-driven skill file attachment (comprehensive, deferred)

## The finding (2026-07-05, live SC#4 UAT round 3)

Confirmed via direct investigation of `backend/app/services/tool_dispatcher.py`'s `_TOOL_REGISTRY`
(the complete list of tools available to any agent): there is **no tool that lets the agent
attach a file to a skill.** The only skill-file-write path is `_upload_skill_files` /
`upload_skill_file` in `backend/app/api/skills.py` — HTTP endpoints reachable only from an
authenticated browser request (the Skills page's upload button), never from the agent's
tool_dispatcher.

**Live evidence, cross-provider:**
- DeepSeek (thread `134c9200...`) built a skill referencing an external config file, wrote it via
  `workspace_write` (a general scratch area, NOT skill storage), correctly told the user a manual
  upload was needed, then within the SAME thread recovered by falling back to `workspace_read`
  when `read_skill_file` 404'd.
- OpenAI gpt-5.4-mini (thread `7ebcc7fe...`), asked to RUN that same skill in a fresh thread,
  correctly reported the file missing (`read_skill_file` 404) and stopped rather than guessing —
  the workspace fallback wasn't available/attempted in that thread.

Both behaviors were HONEST given the real constraint (neither model fabricated the file's
existence) — this is a genuine platform capability gap, not a prompt-adherence failure. Phase
137.2's gap-closure (migration 089) teaches skill-creator to avoid the trap by preferring inlined
content and being explicit when a file truly is external — but that is a words-only mitigation,
not the real fix.

## The comprehensive vision (operator's own framing, 2026-07-05)

Build this "similar to Claude's own skill-creator, according to our application's actual
infrastructure" — comprehensively, not as a narrow patch:

1. **The agent can attach files it creates.** Scripts, generated config/style assets, or other
   supporting material the agent writes during skill authoring should be attachable to the skill
   directly — no manual "please upload this" hand-off for content the agent itself produced.
2. **The user can attach a template, and the agent uses it.** If the user has an existing
   template file (a `.docx`, a script, a reference doc), there should be a path for the user to
   hand it to the agent DURING the skill-creation conversation, and have the agent attach it to
   the skill being built — not a separate, disconnected upload step done before or after the chat.
3. **This likely means a genuine new tool** (e.g., `attach_skill_file`), a corresponding backend
   endpoint/permission model (still owner-scoped, still RLS-respecting — reuse the existing
   `skill_files` table + `skill-files` storage bucket, don't invent a new one), and probably a
   frontend surface for the user-hands-agent-a-file-mid-chat path (likely the existing workspace
   panel's file-upload affordance, extended to route into skill_files rather than just workspace
   storage when the active context is a skill-creation flow).

## Why this is deferred, not built now (operator's own reasoning, upheld)

The operator explicitly weighed doing this now vs. as a separate wave, and chose to defer:
avoiding a THIRD decimal insert onto the 137.x chain (137, 137.1, 137.2 already exist) mid-way
through closing out v3.2's CORE phases, which risks exactly the kind of scope-creep the project's
own G-1 guardrail (`.claude/CLAUDE.md` workflow guardrails) is designed to catch — "insert-phase
chain cap: propose a refactor/consolidation phase before stacking another feature phase on the
same hot files." This capability deserves its own properly-scoped phase (discuss → plan → execute,
with its own threat model — a new WRITE-capable tool is a real security-relevant surface, and
SC#10 cross-provider proof that all providers can use the new tool correctly) rather than a rushed
mid-verification addition.

## Re-open trigger

- Planning the next milestone after v3.2, or a STRETCH-phase slot opens with budget remaining.
- Another user report of a skill silently failing at runtime because a referenced file was never
  actually attached (the same class of bug as this seed's finding, hit again).
- A milestone-level look at the Skill Studio / skill-authoring experience as a cohesive whole
  (natural pairing with SEED-096's bundle-fidelity gap — both are about what skills can and can't
  actually DO with files, from two different angles: execution fidelity vs. attachment capability).
