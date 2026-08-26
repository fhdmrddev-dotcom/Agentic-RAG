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

Filled by `/gsd:new-milestone`'s roadmapper. Every requirement above maps to exactly one phase.

| REQ-ID | Phase | Status |
|---|---|---|
| _pending roadmap_ | — | Planned |
