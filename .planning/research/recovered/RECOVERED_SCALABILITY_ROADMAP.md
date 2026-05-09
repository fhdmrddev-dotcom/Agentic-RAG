# Scalability Roadmap

## Current Situation

**Architecture:** React frontend → FastAPI backend (2 sync workers) → Supabase (Postgres/Auth/Storage/Realtime)

**State today:**
- Single VPS deployment
- Synchronous OpenAI client blocks workers during LLM streaming
- Document ingestion runs as background tasks on the same server
- All configuration via `.env` files
- RLS-enforced multi-user support already in place
- SSE streaming with disconnect handling (Phase 44)
- No caching layer, no queue system, no load balancer
- Docker not used; no containerization

---

## Desired Future Scenarios by Scale

### Tier 1 — Solo / Small Team (1-20 active users)
**Scenario:** Single deployment as-is. One person or a small team uses the app for personal knowledge management or internal company docs.

**Desired characteristics:**
- Low infrastructure cost
- Simple VPS deployment
- Manual upgrades via Git pull
- OpenAI API costs dominate the bill

---

### Tier 2 — Growing SaaS (20-200 active users)
**Scenario:** Multiple teams or early customers on a shared instance. Chat concurrency becomes the first bottleneck.

**Desired characteristics:**
- Backend workers handle 50+ concurrent chats without blocking
- Automatic horizontal scaling of backend instances during peak hours
- Document ingestion offloaded to a background queue so uploads don't slow chat
- Redis caching for frequent queries and session state
- Load balancer distributes traffic across 2-4 backend instances
- Usage metering per user/organization for billing
- Rate limiting prevents one customer from monopolizing resources

---

### Tier 3 — Multi-Tenant SaaS (200-2,000 active users)
**Scenario:** Selling to multiple companies. Each company has its own users, documents, and folders, but shares the same infrastructure.

**Desired characteristics:**
- Organization/team isolation layered on top of existing user RLS
- SSO/SAML integration for enterprise customers
- Audit logging already implemented scales to high volume
- Database read replicas handle heavy search/query load
- CDN serves static assets and uploaded documents globally
- Auto-scaling based on CPU/memory/connection count
- Multi-region deployment option for data residency (EU, US, Asia)
- Graceful degradation if an LLM provider is down (fallback models)

---

### Tier 4 — Enterprise / On-Premise (2,000+ users or custom deployment)
**Scenario:** Large organizations want to run the app inside their own cloud account or private data center. Or the SaaS reaches thousands of active users.

**Desired characteristics:**
- Docker/Kubernetes deployment packages for any cloud provider (AWS, Azure, GCP, private)
- Microservices architecture:
  - Chat service (LLM streaming)
  - Ingestion service (document processing, embeddings)
  - Search service (pgvector queries, hybrid search)
  - Admin/billing service
- Independent scaling of each service (e.g., 10 chat instances, 3 ingestion workers)
- Queue-based ingestion with retry logic and dead-letter queues
- Distributed tracing across all services
- Dedicated database instances per large tenant (hybrid multi-tenancy)
- SLA guarantees with monitoring and alerting
- Private LLM endpoint support (no data leaves customer's VPC)

---

## Scalability Options Summary

| Approach | Best For | Effort | Impact |
|----------|----------|--------|--------|
| Async workers + more Uvicorn workers | Tier 1→2 | Low | High |
| Background job queue for ingestion | Tier 2 | Medium | High |
| Docker containerization | Tier 2→3 | Low | Medium |
| Load balancer + multiple instances | Tier 2→3 | Medium | High |
| Redis caching + session store | Tier 2→3 | Medium | Medium |
| Kubernetes orchestration | Tier 3→4 | High | High |
| Database read replicas | Tier 3 | Medium | High |
| CDN for static assets | Tier 3 | Low | Medium |
| Microservices split | Tier 4 | Very High | Very High |
| Multi-region deployment | Tier 4 | High | High |

---

## Current Gaps to Address for Future Scaling

1. **Sync LLM client** — Workers block during streaming; limits concurrent chats
2. **No queue system** — Document ingestion competes with chat for server resources
3. **No containerization** — Hard to deploy multiple instances or move between clouds
4. **No caching layer** — Repeated queries hit the database and LLM API unnecessarily
5. **No usage metering** — Required for usage-based or per-seat billing
6. **No organization/team layer** — Required for B2B multi-tenant sales
7. **Single database connection** — No read replicas or connection pooling
8. **No auto-scaling hooks** — Manual server management only
