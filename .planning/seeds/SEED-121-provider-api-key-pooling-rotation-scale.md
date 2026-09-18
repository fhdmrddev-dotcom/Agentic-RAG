---
seed_id: SEED-121
title: Provider API-key pooling + rotation at scale (multiple keys per provider, rate-limit-aware admission)
status: open
planted: 2026-07-18
planted_during: v3.4 new-milestone (strategic Q&A — operator asked whether thousands of users need multiple keys per provider)
category: scale / reliability — provider rate-limit headroom under high concurrency
priority: medium
scope: Medium
related_seeds: [SEED-081, SEED-120, SEED-001, SEED-036, SEED-073]
related_memories: [project_target_scale, project_provider_feature_fit_routing, project_v34_milestone_started]
re_open_trigger: "When single-key provider rate limits (RPM/TPM 429s) are observed under real load, OR at a dedicated scale/ops milestone, OR when a co-tenant SaaS deployment fans thousands of concurrent users onto one shared provider key. Pairs with SEED-081."
surface: Agentic-RAG
trigger_when: unset
---

# SEED-121 — Provider API-key pooling + rotation at scale

## Why This Matters

Today there is **one API key per provider**. At low/medium scale that's fine. At **thousands of concurrent users** on a shared co-tenant deployment, a single key hits the provider's per-key **rate limit** (requests- and tokens-per-minute) — the LLM provider is the slowest link in the whole stack, so this is the first ceiling real production load hits.

Three mitigations, not mutually exclusive:
1. **Key pool per provider** — hold N keys per provider, admit requests round-robin / least-loaded / rate-limit-aware, back off a throttled key and shift to another.
2. **Spread across providers** — this app's multi-provider architecture is *uniquely good* at this; route by best-fit + current headroom ([[project_provider_feature_fit_routing]]).
3. **Per-org BYO keys** — offload load onto the customer's own key ([[SEED-120]]) — the cleanest at the org tier.

## Scope (when triggered)

- A keyring abstraction at the gateway boundary: `provider → [keys]` with health/throttle state, admission control, and a 429-aware backoff+rotate loop (never fork the shared streaming path — this lives at the adapter/gateway seam).
- Reuse the encrypted-secret storage (SEC-01 `enc:v1:`) for the keyring; operator-managed in the Control Room.
- Observability: per-key usage + throttle telemetry (pairs with SEED-073 cost/rate registry + SEED-074 token rollup).
- Admission/backpressure ties into the existing run-backed streaming + the v3.3 backpressure surface.

## Why NOT now

Not tenant-isolation work; not observed as a live limit yet (dev-scale). Belongs to a scale/ops milestone or surfaces reactively when 429s appear under load. [[SEED-081]] (provider rate-limit resilience / fan-out / admission) is the umbrella; this is its key-pool concretion.

## Related
[[SEED-081]] (rate-limit resilience umbrella) · [[SEED-120]] (per-org BYO keys — the org-tier alternative) · [[SEED-001]] (scale-readiness) · [[SEED-036]] (task global concurrency) · [[SEED-073]] (cost/rate registry).
