# Phase 157: Deployment Presets & Runbook (STRETCH) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-07-17
**Phase:** 157-deployment-presets-runbook-stretch
**Areas discussed:** Deployment topology, Frontend-in-compose, Preset framing (vendor reframe), Scope ambition

---

## Deployment topology

| Option | Description | Selected |
|--------|-------------|----------|
| Both: engine + managed map | Portable one-VPS `docker compose` is canonical; OPERATOR.md also maps the live Coolify+Vercel variant (cross-links DEPLOYMENT-PIPELINE.md). Compose = single source. | ✓ |
| Portable self-host only | Just the generic single-VPS path; drops the live-pipeline map. | |
| Managed (Coolify+Vercel) only | Reproduce the exact live setup; but then docker-compose.prod.yml has thin reason to exist. | |

**User's choice:** Both: engine + managed map
**Notes:** The compose file's whole reason to exist is a portable, reproducible stand-up; managed is a documented variant on top.

---

## Frontend-in-compose

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — all-in-one box | Net-new frontend/Dockerfile (nginx serving Vite dist + /api proxy). Compose = FE + backend + bundled Redis; Supabase cloud external. One `docker compose up` = working app → makes SC#3 real. | ✓ |
| No — backend + redis only | Frontend always deploys to Vercel/CDN separately; compose stays backend+redis; `docker compose up` alone isn't a browsable app. | |

**User's choice:** Yes — all-in-one box

---

## Preset framing (vendor reframe)

The operator paused the option-picking to reframe the whole phase (rejected the first Solo/Team/Enterprise matrix + smoke/runbook question block to clarify first). Key input:

- **Enterprise ≠ "a bigger VPS."** Some companies run everything on their own infrastructure, even AI models on their own GPUs. → homes C (bring-your-own-cloud) + D (on-prem/air-gapped) added; the app already supports local models (Ollama/LM Studio), so the on-prem half is largely real.
- **Tier by users/audience, not box size.** Scale is a dial turned inside a home.
- **Wants the whole landscape in plain language** — what the options are, how the tech works, how it installs ("run some commands and it's installed"), how to configure it — framed as the vendor selling this product; licensing/payment is a future concern the presets must map onto.

**Response:** published a plain-language **deployment map** artifact (four "homes" — SaaS / one-box self-host / their cloud / on-prem+air-gapped; the six moving parts; the env-var switch; how install works; the licensing ladder). https://claude.ai/code/artifact/00e107fa-ac01-4300-ba2b-daed7c98e3d3

**Notes:** Framing saved to durable memory (`project_deployment_tiers_direction`).

---

## Scope ambition

| Option | Description | Selected |
|--------|-------------|----------|
| Lean | Fully build + smoke-test the 2 real-today homes (one-box self-host + managed SaaS map); BYO-cloud + on-prem as short variant sections (local-GPU pointer); full air-gapped runbook deferred until a real buyer appears. | ✓ |
| Full four homes now | All four homes as first-class presets incl. a complete on-prem/air-gapped runbook; biggest lift, most unused until an enterprise buyer exists. | |
| Minimal one-box only | Just the one-box preset + compose + OPERATOR.md; skip SaaS map, BYO-cloud, on-prem. | |

**User's choice:** Lean (recommended)
**Notes:** Right-sized for a STRETCH phase; nothing thrown away — the enterprise runbook is written properly when a real buyer exists to validate it.

---

## Claude's Discretion

- **Smoke bar (SC#3)** — stated as a default (not vetoed): local `docker compose -f docker-compose.prod.yml up` of the one-box preset → /health 200 → nginx FE loads → login → one chat turn. Operator runs `docker compose up`; Claude verifies /health.
- **OPERATOR.md location** — stated default (not vetoed): `docs/OPERATOR.md`; supersedes the recovered VPS guide (left in place as history); cross-links the 3 docs/DEPLOYMENT-*.md.
- Preset file layout, `nginx.conf` contents, compose build-vs-tag, and OPERATOR.md section ordering left to planner/executor within D-01..D-09.

## Deferred Ideas

- Full sealed on-prem / air-gapped runbook (self-hosted Supabase + local-GPU end-to-end). Re-open: a real enterprise/on-prem buyer or explicit air-gapped requirement.
- Full bring-your-own-cloud reference manifests (AWS/Azure/GCP/k8s). Re-open: a customer commits to their own cloud.
- Malware scanning (ClamAV) as an Enterprise add-on — parked in REQUIREMENTS "Future" (once DEPLOY-02 exists).
- Install wizard / `/setup` = Phase 158 (DEPLOY-02) — 157 feeds it the presets.
- Licensing / payment model + free-tier line — a later, separate business decision.
