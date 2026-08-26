# Requirements — Milestone v3.9 "Connections: Any Service, Any Tool"

**Defined:** 2026-08-26 via `/gsd:new-milestone`
**Phase numbering:** continues at **210** (v3.8 ended at 209)
**Prior milestone requirements:** archived to `.planning/milestones/v3.8-REQUIREMENTS.md`

---

## The one sentence this milestone is measured against

> A person connects a **service** — not a protocol — sees every tool it offers, grants each one
> individually, and then uses it **by name in chat** and as a **specific step** on the canvas.

⭐ **Nothing is per-vendor.** A connection is `{service identity, auth, discovered tools, per-tool
grants}`. Adding a service adds **rows, not code**. That is the property every requirement below has
to preserve, and the one a reviewer should try hardest to break.

---

## v3.9 Requirements

### Connection model — the foundation everything else rests on

`SEED-207` is a **PREREQUISITE**, not a nice-to-have: while two connection models coexist, every
downstream surface (node face, service mark, filter, chat mention, catalog entry, picker) must
branch, and **each new surface pays the branch again**.

- [ ] **CONN-04**: A connection is created against a **service**, and its available actions come from
      that service's own advertised tools — never from a fixed three-verb list
- [ ] **CONN-05**: The legacy `send_email` / `create_ticket` / `post_message` capabilities keep
      working unchanged as **one shape among many**, and no longer organise any surface
      ⚠ They must NOT be deleted — measured at `phase_types.py:2311-2322`, they are the only external
      path that works with **no MCP server**
- [ ] **CONN-06**: A user can add a service by **pasting its MCP URL**, and its tools are discovered
      and grantable with **zero engineering work on our side**
- [ ] **CONN-07**: A user can see, edit and delete a connection's identity, auth and endpoint without
      losing its existing per-tool grants
- [ ] **CONN-08**: A connection stores an OAuth-authenticated service — which has **neither a
      capability nor an MCP URL** — without the database refusing the row
      ⚠ Migration 126's `CHECK (capability IS NOT NULL OR mcp_server_url IS NOT NULL)` refuses it today

### Catalog — how a person finds a service

- [ ] **CAT-01**: A user browses connections as a **catalog of services** — each with its own mark,
      display name and one-line purpose — and can search it
- [ ] **CAT-02**: A **Popular** row offers one-click connect for a curated set, while every other
      service remains reachable through the same generic list
- [ ] **CAT-03**: The catalog filters on **connection state** (`All / Connected / Not connected`),
      never on what a connector can do
      ⚠ The competitor study's verdict, verbatim: *"we promoted an attribute to be the browse axis"*
- [ ] **CAT-04**: A connected service shows **starter prompt suggestions**, so a fresh connection is
      not a capability with no visible way in
- [ ] **CAT-05**: A user on a **cloud** install can add a connection from Settings → Connections
      (closes `BUG-260810-01`)

### Authentication — BYO first

- [ ] **OAUTH-01**: A user can connect a service through an **OAuth authorization-code flow** using a
      **client id and secret they registered themselves**, and the connection works on every
      deployment including self-hosted
- [ ] **OAUTH-02**: An expired access token is **refreshed without the user reconnecting**, and a
      revoked or unrefreshable connection says so plainly instead of failing as a tool error
- [ ] **OAUTH-03**: OAuth client secrets and refresh tokens are encrypted at rest, org-scoped, and
      readable by no database role that does not need them
      ⚠ This is the exact defect migration 118 closed for `secret_ciphertext` — do not re-introduce
      it by copying an RLS shape from a table with no secret column

### Per-tool permission & approval — the hard prerequisite for chat

- [ ] **GRANT-01**: A user grants or denies **each tool of a connection individually**, with reads
      and writes in **one list**, so search can be granted freely while a create is held back
- [ ] **GRANT-02**: A connection carries a **default approval posture** the user can set once, which
      individual tools inherit until overridden
- [ ] **GRANT-03**: When the agent calls a tool whose posture requires approval, the run **pauses and
      asks a real person**, naming the service, the tool and the arguments before anything leaves
- [ ] **GRANT-04**: A denied or ungranted tool is **refused**, and the refusal names which grant would
      allow it
- [ ] **GRANT-05**: Every outbound call made through a connection writes an **audit receipt** naming
      the service, tool, actor and outcome

### Chat surface — connections as platform assets

- [ ] **CHAT-05**: A user adds **any connected service** to a chat thread by name, and the agent
      chooses which of that service's **granted** tools to use
- [ ] **CHAT-06**: A user can see which connected services are active in the current thread and remove
      one without starting a new thread
- [ ] **CHAT-07**: A tool call made from chat renders with the **service's own mark and the tool's
      real name**, never as a generic external action

### Workflow steps — a step says what it actually does, everywhere

- [ ] **STEP-01**: An author picks a **service and then a named action** when adding an external step —
      no server URL, no hand-written JSON argument object
- [ ] **STEP-02**: A step's required arguments are **author-fillable from every launch path**, and a
      run supplies them
      ⚠ Closes BLOCKING `BUG-260826-01` — a `send_email` step can never receive its arguments today
- [ ] **STEP-03**: Publish **refuses** a workflow containing a step whose required arguments nothing
      can supply, and names the step and the missing argument (closes `BUG-260826-02`)
- [ ] **STEP-04**: The service mark and action name appear on the **run spine and the run surfaces**,
      not only on the builder canvas (`SEED-206`)
- [ ] **STEP-05**: A failed external step reports **its own failure reason** on the panel
      (closes `BUG-260826-05`)
- [ ] **STEP-06**: The describe-a-workflow door offers the author's **connected services and granted
      tools as vocabulary** before drafting, and a named-but-absent service produces a stated
      **refusal** rather than an invented step (`SEED-208`)

### Knowledge — the one ingestion scenario that dodges the hard problems

- [ ] **ATTACH-01**: A user can **pick a specific file from a connected source** and attach it to a
      thread or ingest it, as a deliberate human action
      ⚠ Deliberately human-initiated. **Automatic or background sync is OUT** — see *Out of Scope*

### Operability

- [ ] **CONN-09**: An operator can see and control the `live_connectors` kill-switch from the Control
      Room (closes `BUG-260826-04`)
- [ ] **CONN-10**: A scheduled run cannot be silently accepted on an install whose scheduler is off,
      and its default token budget does not guarantee cancellation
      (closes `BUG-260826-06` and `BUG-260826-07`)
- [ ] **CONN-11**: A manual schedule trigger succeeds when `org_id` is null instead of returning a 500
      the browser reports as CORS (closes `BUG-260826-03`)
- [ ] **RAG-09**: An embedding-provider failure is reported **as a provider failure**, never as
      "your documents returned nothing"
      ⚠ BLOCKING `BUG-260815-05`. Not connector work — folded because it poisons the trustworthiness
      of every deliverable this milestone produces

---

## Future Requirements — deferred, each with a re-open trigger

| Deferred | Why | Re-open trigger |
|---|---|---|
| **We own the OAuth application** (Claude.ai's 2-step Connect) | Our redirect URI points at our cloud, so self-hosted installs could not use it. Google's review for restricted Gmail/Drive scopes runs weeks | A hosted-only tier is confirmed, or the first customer blocked by BYO friction |
| **`SEED-209/210/211/212` — connector→KB ingestion** | `SEED-210` measures that synced documents **flatten source ACLs** and source deletions never propagate; `SEED-211` is the M-Files metadata-permissions fork. Shipping auto-ingest without them is a **security defect, not a gap** → *Connected Knowledge* milestone | **The first automatic or background sync from a connected source** |
| **`SEED-013` / `SEED-195` — inbound Open Platform** | Public REST API, webhooks, service accounts, us-as-an-MCP-server. A different product: its own auth model, quotas and versioned public contract; amplifies concurrent load (`SEED-001`) | This milestone ships and an integration partner asks to call us |
| **`SEED-198` — Experts** | A bundle of skills + connections + knowledge scope. **Depends on** this milestone; without the connection model it is a prompt pack | The connection model and per-tool grants are shipped |
| **`SEED-199` — full xyOps canvas grammar** | Two node classes, triggers/constraints as nodes, typed edges. `STEP-04` takes only the connector-mark half | A canvas phase is scoped in its own right |
| **`SEED-193` / `SEED-194` — artifacts & image generation** | *"Connections are about reaching other systems; artifacts are about what the agent produces."* ⚠ `SEED-194`'s real blocker is that `ModelCapability` has **no modality dimension** — model-registry work, unrelated to connectors | Sequenced after this milestone, and after `SEED-185` (the app has no URL router) |

---

## Out of Scope — explicit exclusions

- **Automatic / background sync from a connected source.** See the deferral above. `ATTACH-01` is
  human-initiated precisely because that dodges ACL mirroring, deletion propagation and sync loops.
- **Arbitrary-code / community-node connectors.** A supply-chain surface, excluded **by
  construction** rather than by omission — carried forward from the recorded architecture verdict.
- **A per-vendor adapter treadmill.** If a requirement can only be met by writing code per service,
  it is the wrong requirement. The custom-MCP-URL door is the answer to breadth.

---

## Cross-cutting constraints every phase inherits

1. **UAT scoreboard (CLAUDE.md, MANDATORY).** Any phase touching streaming, the agent loop, provider
   routing or UI state owes the **full 8-row native roster + OpenRouter**, plus multi-tool,
   parallel-thread and long-message rows. Blocked rows are recorded ⛔ with a reason, **never
   silently omitted**.
2. **G-2 (sketch before plan) fires on every user-visible surface here** — the catalog, the grant
   list, the approval moment, the chat service chip, the step picker. `screenshots/` is the
   acceptance bar. ⚠ **They are Claude.ai** (verified by reading the images 2026-08-26), plus one
   xyOps canvas reference.
3. **G-5 hot files already firing in this blast radius**, so a refactor recommendation is owed at
   discuss-phase before the feature: `backend/app/services/harness/phase_types.py`,
   `frontend/src/components/settings/ConnectionsTab.tsx`,
   `frontend/src/components/settings/ConnectionFormPanel.tsx`,
   `frontend/src/components/workflows/ConnectionPicker.tsx`,
   `frontend/src/components/workflows/ExternalActionSection.tsx`.
   **Re-derive each row from git — do not trust the cell.**
4. **D-v2.5-01** — no blocking I/O in an async handler. ⚠ **`mcp_client.py:220` violates this today**
   with a blocking DNS call, while the sibling capability path IS threadpooled. In scope by adjacency.
5. **Every schema change ships as a numbered migration** under `supabase/migrations/`, applied by
   pasting into the Supabase SQL editor — never `db push` / `db reset`.
6. **Deployment-artifact parity (same-commit rule)** — any new env var, seed row or bundled service
   updates the Phase-157 artifacts in the same commit.

---

## Traceability

Filled by `/gsd:new-milestone`'s roadmapper (2026-08-26). **Every requirement maps to exactly one
phase: 32 / 32 mapped, no orphans, no duplicates.**

⚠ **The scoping brief said 31 requirements; this file contains 32.** `grep -c "^- \[ \] \*\*"` returns
`32`. The roadmap is validated against the file, not against the brief.

**Counts by phase:** 210 → 4 · 211 → 3 · 212 → 6 · 213 → 5 · 214 → 6 · 215 → 3 · 216 → 5.

| REQ-ID | Phase | What the phase must make true | Status |
|---|---|---|---|
| **CONN-04** | Phase 211 | A connection is created against a service; actions come from advertised tools | Planned |
| **CONN-05** | Phase 211 | The three legacy verbs keep working as one shape among many and organise nothing | Planned |
| **CONN-06** | Phase 212 | Paste an MCP URL — tools discovered and grantable with zero engineering | Planned |
| **CONN-07** | Phase 212 | See / edit / delete a connection without losing its per-tool grants | Planned |
| **CONN-08** | Phase 211 | An OAuth-authenticated service row is accepted by the database (mig 126 CHECK) | Planned |
| **CAT-01** | Phase 212 | Browse connections as a searchable catalog of services | Planned |
| **CAT-02** | Phase 212 | A Popular row of one-click connects inside the same generic list | Planned |
| **CAT-03** | Phase 212 | Filter on connection STATE, never on what a connector can do | Planned |
| **CAT-04** | Phase 216 | Starter prompt suggestions on a connected service | Planned |
| **CAT-05** | Phase 212 | Add a connection from Settings → Connections on a cloud install | Planned |
| **OAUTH-01** | Phase 215 | Authorization-code flow with a customer-registered client id/secret | Planned |
| **OAUTH-02** | Phase 215 | Silent refresh; a revoked/unrefreshable connection says so plainly | Planned |
| **OAUTH-03** | Phase 215 | Client secrets and refresh tokens encrypted at rest and org-scoped | Planned |
| **GRANT-01** | Phase 213 | Grant or deny each tool individually, reads and writes in one list | Planned |
| **GRANT-02** | Phase 213 | A connection-level default approval posture tools inherit | Planned |
| **GRANT-03** | Phase 213 | The run pauses and asks a person, naming service / tool / arguments | Planned |
| **GRANT-04** | Phase 213 | A denied or ungranted tool is refused, naming the grant that would allow it | Planned |
| **GRANT-05** | Phase 213 | Every outbound call writes an audit receipt | Planned |
| **CHAT-05** | Phase 216 | Add any connected service to a thread by name; the agent picks a granted tool | Planned |
| **CHAT-06** | Phase 216 | See and remove the services active in the current thread | Planned |
| **CHAT-07** | Phase 216 | A chat tool call renders with the service's mark and the tool's real name | Planned |
| **STEP-01** | Phase 214 | Pick a service then a named action — no URL, no hand-written JSON | Planned |
| **STEP-02** | Phase 214 | Required arguments author-fillable from every launch path | Planned |
| **STEP-03** | Phase 214 | Publish refuses an unsatisfiable step, naming step and missing argument | Planned |
| **STEP-04** | Phase 214 | Service mark + action name on the run spine and run surfaces | Planned |
| **STEP-05** | Phase 214 | A failed external step reports its own failure reason on the panel | Planned |
| **STEP-06** | Phase 214 | The describe door is bound to connected services + granted tools, and refuses | Planned |
| **ATTACH-01** | Phase 216 | Pick one specific file from a connected source and attach or ingest it | Planned |
| **CONN-09** | Phase 210 | The `live_connectors` kill-switch is visible and controllable in the Control Room | Planned |
| **CONN-10** | Phase 210 | No silent schedule on a scheduler-off install; the default budget does not self-cancel | Planned |
| **CONN-11** | Phase 210 | A manual schedule trigger succeeds when `org_id` is null | Planned |
| **RAG-09** | Phase 210 | An embedding-provider failure is reported as a provider failure | Planned |

**Load-bearing order** (see `.planning/ROADMAP.md` → *The sequencing constraints*):
**211** (`SEED-207`, the connection model) precedes **212 / 214 / 216** · **213** (per-tool approval)
is a HARD prerequisite for **216** (chat) · **CONN-08** (211) precedes **OAUTH-01** (215) ·
MCP-first (212) precedes OAuth (215) · the governed canvas (214) precedes chat (216).

⚠ **Update a row's Status when its phase closes, not at the milestone audit.** Seven of twelve v3.8
phases had no `VERIFICATION.md` and this table was stale from day one — the second consecutive
milestone to close that way.
