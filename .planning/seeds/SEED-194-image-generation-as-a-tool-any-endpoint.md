---
seed_id: SEED-194
title: The agent cannot make an image — and the blocker is not the render, it is that MODEL_CAPABILITIES has no modality dimension, so every image model id falls into the chat-model inferred path
created: 2026-08-23
planted_during: Operator note review, 2026-08-23 — "for specific integrations like Nano Banana or image generation … we should support any image model endpoint"
status: planted
priority: medium
surface: Agentic-RAG
relates_to:
  - SEED-193 — agent-authored interactive artifacts. ⚠ THIS SEED RIDES THAT RAIL. An image is one
    artifact type; building a bespoke image card instead of the first vocabulary entry pre-empts
    SEED-193 with a worse version of itself.
  - SEED-042 — chat input modalities. The INPUT side of the same axis; this is the OUTPUT side.
  - SEED-006 / SEED-027 — multimodal extraction and images in retrieval. Those READ images; this
    WRITES them. Different pipelines, easily confused in scoping.
  - backend/app/config.py:151 — ModelCapability; :242 — "Unknown models default to
    native_tools=False". The whole blocker is here.
  - docs/SANDBOX-PACKAGES.md and the /sandbox/output → OutputFileCard pipeline — the
    delivery half that already exists and should be reused verbatim.
trigger_when: >
  Re-open when EITHER:
  (a) SEED-193's artifact rail is planned — do the image type as an entry in that vocabulary, in
      the same milestone, not before it and not separately;
  (b) a user asks for a generated image in a real session and is told no. Log that request here
      when it happens; there is no evidence of demand in the register yet, which is exactly why
      this is medium and not high.

  Mechanical check that the blocker is still real, from the repo root:
    grep -n "modality\|image_generation\|supports_image_output" backend/app/config.py   # → nothing today
---

# The delivery path already exists. The registry is what says no.

## What is already solved (do not rebuild it)

An image the agent produces has a home the day someone writes the tool:

- `execute_code` already writes files to `/sandbox/output/` and lists them in `output_files`.
- The sandbox image already carries matplotlib, plotly and seaborn — so *plotted* images
  already work today; this seed is about *generated* ones.
- `OutputFileCard` already renders produced files in chat, and `FilesSection` in the panel.
- Storage, download, and per-extension icons (`frontend/src/lib/fileIcon.tsx`) already exist.

So "the agent made a picture and I can see and download it" is mostly plumbing that is already
plumbed. That is the good news, and it is why this looks bigger than it is.

## ⚠ The real blocker is the model registry, and it is structural

`ModelCapability` (`backend/app/config.py:151`) is **entirely chat-shaped**: `native_tools`,
`emit_tier`, `max_output_tokens`, `context_window_tokens`, `llm_call_timeout_seconds`,
`strict_json_schema`, `uses_max_completion_tokens`. There is no modality field of any kind.

The consequence is not "image models are unsupported" — it is worse than that. `config.py:242`:
*"Unknown models default to `native_tools=False`"*, and an id absent from the registry resolves
`capability_source=inferred`. So an image model id entered anywhere in the app is silently
treated as **a chat model that cannot use tools**. This is the identical failure mode already
recorded for local models (`project_local_models_structured_mode_trap`): `native_tools=False`
short-circuits above every other gate and the failure is silent. An image endpoint would be
routed into a chat completion, and the error surfaced to the user would be about tool calling.

**So the first unit of work is a modality dimension on the registry, not a tool.** Until an id
can declare *"I am an image endpoint, I have no context window, I take a prompt and return an
image"*, "support any image model endpoint" cannot be honestly promised — the operator would be
able to type an id that resolves into nonsense.

## The shape of the work, in order

1. **Registry: a modality dimension.** `ModelCapability` gains a modality (default `chat`, so
   every existing row is unchanged by construction) and image rows carry the fields an image
   endpoint actually has. ⚠ `MODEL_CAPABILITIES` lives in `backend/app/config.py`, which FIRES
   G-5 (71 commits / 42 phases) and whose *named seam is exactly this*: "`MODEL_CAPABILITIES` +
   its readers out, with a same-commit re-export". Taking that seam is plausibly the right first
   move here rather than growing the file again.
2. **A `generate_image` tool** that writes into `/sandbox/output/` so the existing output-files
   pipeline carries it unchanged. Not a new render path — reuse.
3. **Provider adapters at the service boundary**, one per family (OpenAI images, Google/Gemini
   image models, OpenRouter, and a generic OpenAI-compatible endpoint for local/ComfyUI-style
   servers). Same rule as everywhere else: provider specifics at the boundary, shared path
   stays shared.
4. **Settings, not env.** Which image model, which endpoint, and whether the tool is offered at
   all belong in `user_settings` / `app_settings` and the Settings UI — env vars are secrets and
   infra only.

⚠ **Read `reference_lmstudio_exact_slug_and_jit_trap` before promising "any endpoint."** The
local-model lesson was that an id that *looks* accepted can silently resolve to something else
entirely. "Any endpoint" is a registry and validation promise, not a networking one.

## What NOT to do

Do not add a bespoke image card. Do not let the image tool return base64 into the message
stream. Both shortcuts work in a demo and both fork the artifact path that SEED-193 exists to
unify — and forking it costs more to undo than it saved.
