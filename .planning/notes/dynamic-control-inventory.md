---
title: Dynamic-Control Master Inventory + Decision Table (Settings ↔ Control Room, everything)
date: 2026-07-12
context: Evidence-based sweep (two read-only scout agents over frontend Settings + backend config) during /gsd:explore SEED-116, at the operator's directive to "map everything once, leave nothing behind" so the Settings↔Control-Room boundary is decided comprehensively rather than knob-by-knob. This is the LIVING master registry. The boundary RULE lives in settings-control-room-boundary.md; this file is the exhaustive item-by-item map that rule is applied to.
supersedes_inventory_in: .planning/notes/settings-control-room-boundary.md (its inventory section now points here)
resolves: SEED-116 (inventory half)
feeds: [Phase 149, Phase 150, v3.4 org-RBAC + config-consolidation milestone]
---

# Dynamic-Control Master Inventory + Decision Table

## The reframe (most important finding — F1)

**Today's entire Settings page is already global + already operator-gated.** Every knob on the AI-Model /
Search / Integrations tabs saves to the *global* `app_settings` row (id='global'), NOT per-user, and the
whole page sits behind `require_visible("model_management")` — operators-only (Phase 148). The ONLY
genuinely per-user surfaces are **Memory** (`user_memory`) and the **theme** toggle (in the nav). The
`user_settings.preferences` column that would host per-user prefs has been **dead since migration 011**.

⇒ "Settings vs Control Room" is not really a *split*. **Today's Settings IS a misplaced operator console.**
The honest target: the Control Room absorbs the global platform config; Settings shrinks to a genuine
(mostly *new*) personal sliver; Profile holds identity.

## Master decision table

Legend — Home: `CR`=Control Room · `S`=Settings(personal) · `P`=Profile · `SS`=Skill Studio ·
`SH`=System Health · `INFRA`=env/deploy. Status: ✅HAVE-in-CR · ➡️MOVE(Settings→CR) · 🟢KEEP-personal ·
🔴GAP(dynamic nowhere) · 🔮FUTURE · 🗑️DEAD.

### A. Models & routing
| Knob | Today (home · storage) | Nature | → Home | Status | Milestone |
|---|---|---|---|---|---|
| Model capabilities (ctx/out/native-tools/timeout, `enabled`) | `model_capabilities_overrides` read-only seam (mig 053) | global | CR·Model Registry | 🔴GAP (write-UI net-new) | **149** |
| Model discovery (per-provider `/models`) | none | global | CR·Model Registry | 🔴GAP | **149** |
| `MODEL_CAPABILITIES` routing facets (emit_tier, max_tools, parallel, prefill, strict_json…) | hardcoded `config.py:233` | global | CR·Model Registry (adv) | 🔴GAP (not in DB-override field list) | 149 / v3.4 |
| Active/default model (`llm_model`) | Settings·AI, global | **two-layer** | CR default + **S** personal-pick | ➡️+🔴 (needs per-user layer) | v3.4 |
| Context / output / sub-agent tokens, sub-agent model, OpenRouter strategy | Settings·AI, global | global | CR·Model Registry | ➡️MOVE | v3.4 config-consolidation |
| Provider roster + base URLs | Settings·AI, global | global | CR·Providers | ➡️MOVE | 150 |

### B. Secrets
| API keys (openai/anthropic/google/deepseek/moonshot/minimax/zhipu/openrouter/tavily/rerank/embedding) | Settings, global (+ env schema-drift, no DB columns for some) | secret | CR·Secrets (encrypted) | ➡️MOVE + 🔴 | **150** |

### C. Retrieval / embeddings / ingestion (corpus-wide ⇒ inherently global, NOT per-user)
| Knob | Today | → Home | Status | Milestone |
|---|---|---|---|---|
| Embedding model / dims / base_url + re-embed lifecycle | Settings·Search, global | CR·Retrieval | ➡️MOVE | v3.4 |
| Extraction model + engines (text/table/image/equation per pdf/docx) | Settings + `app_settings` | CR·Ingestion | ➡️MOVE | v3.4 |
| Reranking (enable / provider / model / top-n) | Settings·Search, global | CR·Retrieval | ➡️MOVE | v3.4 |
| Retrieval (top-k, threshold, hybrid, vector/keyword weights, rrf_k, candidate count) | Settings·Search, global | CR·Retrieval | ➡️MOVE | v3.4 |
| Chunking (`chunk_size`=1000 / `chunk_overlap`=200) | **env only** (`config.py:861`) | CR·Ingestion | 🔴GAP | v3.4 |
| Multimodal caps, extraction window cap, confidence buckets | `app_settings` (no UI) | CR·Ingestion | ➡️surface | v3.4 |
| Retrieval residuals (dedup 0.85, rerank ×2 fetch multiplier) | hardcoded `retrieval_service.py` | CR·Retrieval (adv) | 🔴GAP | backlog |

### D. Tools & safety
| Knob | Today | → Home | Status | Milestone |
|---|---|---|---|---|
| Web search enable | **DUPLICATED**: Settings toggle *and* CR kill-switch (`web_search_enabled`) | CR·Controls | ✅HAVE / consolidate | 147 |
| Web search key + max results | Settings·Integrations, global | CR·Providers | ➡️MOVE | v3.4 |
| Code sandbox enable | **DUPLICATED**: Settings toggle *and* CR kill-switch (`sandbox_enabled`) | CR·Controls | ✅HAVE / consolidate | 147 |
| Sandbox image / timeouts / TTL / (no CPU/mem/pids caps) | env | CR·Ingestion or INFRA | 🔴GAP | v3.4 |
| Self-improve / Workflows kill-switches; Maintenance mode | `app_settings` (CR only) | CR·Controls | ✅HAVE | 147 |

### E. Governance (Control Room — shipped)
| Feature visibility (audience map) · Audit (both ledgers) · Users roster + disable/grant | `app_settings.feature_visibility` / audit tables / users | CR | ✅HAVE | 148 |

### F. Eval / skills
| Knob | Today | → Home | Status | Milestone |
|---|---|---|---|---|
| Judge model · Skill-builder model | `app_settings` (Settings·AI, inline-save) | governance | CR or keep near SS | ➡️review | v3.4 |
| Engine health (cross-provider smoke sweep) | Settings·AI card | observe | SH·System Health | ➡️MOVE | observability |
| Eval-matrix targets | Skill Studio | — | SS | 🟢KEEP (settled) | — |

### G. Prompts & templates (all hardcoded — big blank)
| System / Explorer / sub-agent / title-gen / vision prompts | hardcoded strings (`agent_loop.py`, `threads.py`, `sub_agent_service.py`, `multimodal_service.py`) | global | CR·Prompt Governance | 🔴GAP | 🔮v3.4 |

### H. Personal (the real — and mostly NEW — per-user sliver)
| Knob | Today | → Home | Status | Milestone |
|---|---|---|---|---|
| My default model (within operator-allowed set) | — | S | 🔴GAP (revive `user_settings.preferences`) | v3.4 |
| Theme | nav | P/S | 🟢KEEP | — |
| Memory (`user_memory`) | Settings·Memory | S/P | 🟢KEEP | — |
| My activity log | Settings·Audit (per-user, read-only) | S/P | 🟢KEEP | — |
| Identity (name/email/sign-out/role badge/SSO) | none (sign-out in nav) | **P** Profile menu | 🔴GAP | SEED-113 |

### I. Infra / future / dead
| Item | Today | → Home | Status | Milestone |
|---|---|---|---|---|
| Concurrency, workers, pg pool, run/step timeouts, LangSmith tracing/project | env | INFRA (+ SH read-only view) | stays env | — |
| Per-user / per-key rate limiting | **none exists** | CR·Controls | 🔴GAP | 🔮v3.4 |
| Cost / budget caps + usage metering | **none anywhere** | CR·Usage & Budget | 🔴GAP | 🔮v3.4 (prereq for schedules) |
| Scheduled / recurring triggers | **no scheduler exists** | CR·Automation | 🔴GAP | 🔮v3.4 |
| Org RBAC / departments / greenlists / doc-level ACL | none | CR + retrieval | 🔮FUTURE | v3.4 (SEED-115) |
| Dead knobs: `title_drafting_config`, `sub_agent_config`, `token_capture_enabled`, `user_settings.preferences` | columns, unread | wire-or-remove | 🗑️DEAD | quick/backlog |

## Discovery ≠ full capabilities (operator-confirmed 2026-07-12 — the SC#3 reason)

Dynamic discovery (MODEL-02) queries each provider's own `/models` endpoint so a new model the provider
ships appears automatically — **no manual model-list maintenance ever again.** BUT providers do NOT
uniformly return *capabilities*:
- **Google `models.list`** + **OpenRouter `/models`** return capability metadata (token limits;
  `context_length` + `supported_parameters` incl. tools) → auto-populate.
- **OpenAI** + **Anthropic** `/models` return ~id + created/display-name only — no ctx/out/tool data.
- Most OpenAI-compatible providers (DeepSeek/Kimi/GLM/MiniMax) are id-only.

⇒ Discovery auto-fills capabilities **where the provider publishes them**; for metadata-poor providers the
un-returned fields render as explicit **"unknown — you set it," NEVER a guess** (SC#3: reproducing the
silent no-tools bug is barred). This is the propose→confirm design, not a limitation. Per-provider payload
shapes verified in 149 research (provider-docs-first).

## Cross-cutting findings
- **F1 (reframe):** Settings today = global + operator-gated ⇒ a misplaced Control Room; personal layer barely exists.
- **F2 (duplication):** `web_search_enabled` + `sandbox_enabled` are the SAME `app_settings` column exposed as both a Settings toggle AND a CR kill-switch — one switch, two homes. Consolidate.
- **F3 (per-user seam):** the "user picks within allowed set" layer has no home; `user_settings.preferences` (dead since mig 011) is the substrate to revive.
- **F4 (secrets drift):** several `*_api_key` fields resolve from env with NO DB column — Phase 150 must reconcile before encrypting.
- **F5 (true blanks):** prompts governance, chunking, cost/budget, scheduling, rate-limiting are dynamic NOWHERE today.

## Proposed target IA (the decision — operator-approved 2026-07-12)
- **Control Room (operator governance):** Model Registry (149) · Secrets & Providers (150) ·
  Retrieval & Ingestion · Capabilities & Safety (147/148 ✅) · Audit & Users (148 ✅) ·
  Prompt Governance 🔮 · Usage & Budget 🔮 · Automation 🔮 · System Health.
- **Settings (personal):** my default model (within allowed) · theme · memory · my activity. Small, mostly new.
- **Profile menu:** identity/SSO (SEED-113).

## Milestone rollup
- **149:** model capability editor + discovery (A rows 1–3).
- **150:** secrets encryption + provider roster reconcile (B, A-row 6).
- **v3.4 config-consolidation:** move C/D-config/A-rows-4-5 into CR config tabs; revive `user_settings.preferences` for the per-user pick layer.
- **🔮 v3.4+:** prompt governance (G), cost/budget, scheduler, rate-limiting, org-RBAC/doc-ACL (SEED-115).
- **observability milestone:** engine-health + dependency-health + LangSmith into System Health (SH).
- **quick/backlog:** dead-knob cleanup (F3/I); F2 duplication consolidation.

## Related
[[settings-control-room-boundary]] (the RULE) · SEED-116 (resolved) · **SEED-117 (v3.4 config-consolidation — the milestone that executes the ➡️MOVE / 🔴GAP rows deferred out of v3.3)** · SEED-113 (profile menu) ·
SEED-115 (org-RBAC v3.4) · [[project_settings_control_room_boundary]] (memory).
