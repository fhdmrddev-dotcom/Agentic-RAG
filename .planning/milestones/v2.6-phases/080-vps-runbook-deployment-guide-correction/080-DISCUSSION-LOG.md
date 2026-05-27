# Phase 080: VPS Runbook + Deployment Guide Correction - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-27
**Phase:** 080-vps-runbook-deployment-guide-correction
**Areas discussed:** Redis prod setup, Postgrest patch step, Pool sizing depth, Systemd env integration, Hostinger workers, Deploy script + env updates, Doc audit strategy

---

## Redis Production Setup

| Option | Description | Selected |
|--------|-------------|----------|
| Docker container | docker run with redis:7-alpine, localhost-only, no persistence, 256MB maxmemory | |
| Both paths detailed | Full instructions for both Docker container AND hosted Redis (Upstash) | ✓ |
| Hosted only | Point operators to Upstash/cloud Redis. No local container on VPS | |

**User's choice:** Both paths detailed
**Notes:** User wants comprehensive coverage for operators with different infra preferences.

### Docker Path Format

| Option | Description | Selected |
|--------|-------------|----------|
| docker run command | One-liner standalone command | |
| docker-compose.yml | Compose file similar to dev setup | |
| Both | Both approaches documented | ✓ |

**User's choice:** Both docker run and docker-compose.yml
**Notes:** User typed "consider both options" — wants maximum flexibility.

### Upstash Detail Level

| Option | Description | Selected |
|--------|-------------|----------|
| Env var swap only | Brief: set REDIS_URL in .env | |
| Full Upstash walkthrough | Step-by-step matching Supabase setup detail | ✓ |

**User's choice:** Full Upstash walkthrough
**Notes:** Matches the existing Supabase Cloud setup detail level.

### Redis Memory Limit

| Option | Description | Selected |
|--------|-------------|----------|
| 256MB (same as dev) | Streaming buffers are ephemeral, 256MB generous | |
| 512MB for prod | Double dev default as safety margin | |
| Configurable with guidance | Default 256MB, scale to 512MB-1GB for 50+ sessions | ✓ |

**User's choice:** Configurable with guidance

### Redis Auth

| Option | Description | Selected |
|--------|-------------|----------|
| No auth, localhost-only | Not network-reachable, auth adds complexity | |
| Optional auth noted | Default no auth, brief note for adding password | ✓ |

**User's choice:** Optional auth noted

### VPS Guide Placement

| Option | Description | Selected |
|--------|-------------|----------|
| After backend setup | Between Step 6 and systemd service | ✓ |
| Before backend setup | Right after system packages | |
| After SSL | Near end as optional infrastructure | |

**User's choice:** After backend setup (Step 6)

### Hostinger Guide Placement

| Option | Description | Selected |
|--------|-------------|----------|
| Inside Stage 3 | Between backend setup (3.4) and env file (3.5) | ✓ |
| New Stage 3.5 | Separate stage between server software and systemd | |

**User's choice:** Inside Stage 3

---

## Postgrest Patch Step

| Option | Description | Selected |
|--------|-------------|----------|
| Strike + replace with note | Remove manual patch, add auto-patch note | ✓ |
| Remove entirely | Delete Step 7 completely | |
| Keep as collapsed/optional | Mark as legacy for old codebases | |

**User's choice:** Strike + replace with note

### Common Errors Table

| Option | Description | Selected |
|--------|-------------|----------|
| Update fix column | Keep row, change Fix to "Auto-patched at startup" | ✓ |
| Remove row | Delete entirely | |

**User's choice:** Update fix column

---

## Pool Sizing Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Quick reference table | Small table with formula | |
| Tuning section with explanation | Dedicated subsection explaining behavior + interaction | ✓ |
| One-liner + link | Brief formula with external link | |

**User's choice:** Tuning section with explanation

### Placement

| Option | Description | Selected |
|--------|-------------|----------|
| After systemd/service step | Logical position for tuning after service config | ✓ |
| At the end as appendix | Separate tuning appendix | |
| Inside Redis step | Bundle with Redis as production tuning | |

**User's choice:** After systemd/service step

### Supabase Cloud Defaults

| Option | Description | Selected |
|--------|-------------|----------|
| Mention defaults + dashboard link | Note pool size, point to Dashboard > Connection Pooling | ✓ |
| Just the formula | Only asyncpg_pool × workers ≤ pgbouncer_pool | |
| Full Supabase pooling guide | Detailed walkthrough of all pooling settings | |

**User's choice:** Mention defaults + dashboard link

### Hostinger Tuning Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Same content, same depth | Both guides get identical tuning section | ✓ |
| Simplified for Hostinger | Shorter section, link to VPS guide for details | |

**User's choice:** Same content, same depth

### Worker Count Guidance

| Option | Description | Selected |
|--------|-------------|----------|
| CPU-based formula | N = min(CPU_cores, 4), backpressure endpoint for scaling | ✓ |
| Fixed recommendation | Just say "use 2 workers" | |
| Tiered presets | Table: small/medium/large VPS recommendations | |

**User's choice:** CPU-based formula

---

## Systemd Env Integration

| Option | Description | Selected |
|--------|-------------|----------|
| EnvironmentFile + variable | EnvironmentFile=/path/.env with --workers ${WORKER_COUNT:-2} | ✓ |
| Hardcoded with comment | Keep --workers 2 with comment to edit | |
| Separate env file | Dedicated /etc/agentic-rag.env for systemd | |

**User's choice:** EnvironmentFile + variable

---

## Hostinger Workers

| Option | Description | Selected |
|--------|-------------|----------|
| Add workers too | Add --workers N for consistency across both guides | ✓ |
| Redis only, skip workers | Strictly follow roadmap: Redis omission only | |

**User's choice:** Add workers too
**Notes:** Consistency across both guides. A 2-line addition, not scope creep.

---

## Deploy Script + Env Vars

### Deploy Script

| Option | Description | Selected |
|--------|-------------|----------|
| Add Redis health check | docker exec redis redis-cli ping before backend restart | ✓ |
| No deploy script changes | Redis runs independently via Docker restart policy | |
| Full Redis section in script | docker pull + restart in deploy script | |

**User's choice:** Add Redis health check

### Env Var Examples

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, add both | REDIS_URL and WORKER_COUNT in .env example sections | ✓ |
| REDIS_URL only | WORKER_COUNT documented in tuning section only | |

**User's choice:** Yes, add both

---

## Doc Audit Strategy (SC#4)

| Option | Description | Selected |
|--------|-------------|----------|
| Grep command in plan | Grep .planning/ for stale single-worker patterns | ✓ |
| Manual review checklist | Check known files manually | |
| Automated + manual combo | Grep first, then manual review of each hit | |

**User's choice:** Grep command in plan

---

## Claude's Discretion

- Exact wording of the auto-patch note replacing Step 7
- Formatting of the tuning section (tables, bullet points, or prose)
- Redis docker-compose.yml file naming and placement
- Deploy script health check error message wording
- Step renumbering after Step 7 removal

## Deferred Ideas

None — discussion stayed within phase scope
