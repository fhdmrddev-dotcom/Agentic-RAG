# Phase 190: Live Connector Slice + Connector Security — STRETCH - Context

**Gathered:** 2026-08-08
**Status:** Ready for planning
**Mode:** `--auto` equivalent — the operator delegated this session explicitly
("*I will leave you unattended … take the best decisions … decide yourself*",
2026-08-08). Every decision below was auto-selected with its rationale stated so the
operator can reverse any one of them at plan-phase without re-running discuss.

> ⚠ **TWO DECISIONS BELOW ARE ROADMAP AMENDMENTS AND ARE FLAGGED AS SUCH** (D-01, D-20).
> They are recorded in the open with their reasoning and their observable, following the
> precedent this milestone already set twice — Phase 185 / migration 114 and Phase 189 /
> migration 115, where a zero-migration promise was a scoping convenience and the honest
> word was a correctness property. **Neither amendment narrows a success criterion; D-01
> changes the MECHANISM a criterion names, because the criterion as written is
> structurally unsatisfiable alongside CONN-03 and red line D-14.** If the operator
> disagrees with D-01, plan-phase is the place to say so — but the phase cannot be
> planned without resolving it, so it is resolved here rather than deferred.

---

<domain>
## Phase Boundary

**What this phase delivers:** the app's **first real outbound egress**, and the security
envelope that makes it survivable.

Concretely: a user can bind a real destination to the `external_action` node that Phase
189 put on the canvas, publish that workflow, run it, approve the armed checkpoint — and
an email actually sends / a ticket is actually created / a message is actually posted.
Every outbound byte leaves through **one guarded seam** that validates the destination
**before** and **independently of** any credential, using org-scoped Fernet-encrypted
credentials resolved server-side by reference.

**The seam is already built.** Phase 189 shipped everything except the send:

| Already shipped (189) | What 190 changes |
|---|---|
| `external_action` phase type (7th), on the canvas, placeable | unchanged |
| Closed capability set `{send_email, create_ticket, post_message}` | unchanged — **no 4th capability in 190** |
| `_exec_external_action` — resolves, records, sends nothing | **one function** gains a real send behind the guard |
| Structurally-armed action-risk checkpoint (cannot be disarmed) | unchanged — but its approval now has a consequence |
| `recorded_not_sent` status + `phase_recorded_not_sent` SSE + the card word *"Not sent — recorded"* | **stays**, and becomes the honest terminal for an UNBOUND step |
| `Not connected` badge, slot 1, **state-conditional by construction** | retires by **DATA** — one line in `notConnectedOf` |

**This phase is a BACKEND SECURITY phase with a small author-facing edge.** The bulk of
the work is `egress`, credentials, RLS, the golden-run carve-out and the threat model.
The UI is a connection picker inside an existing section plus one Settings surface.

**Not in this phase** (by construction, not omission): broad connector catalog, inbound
webhooks, a public API, service accounts, OAuth authorization-code flows, an MCP client,
scheduling/automations, retry queues, a 4th capability, and any arbitrary-code or
expression node on the business canvas.

</domain>

<requirements_context>
## Requirements this phase closes

**CONN-02** (STRETCH) — 2–3 first-party **live** connectors runnable from a workflow
(email out, JIRA/ticket create, Slack notify) as the demo-able external-integration proof.
Broad catalog / inbound webhooks / public API sequence with Open Platform (SEED-013).

**CONN-03** (STRETCH) — every connector outbound secured: unconditional SSRF / egress
allow-list on every outbound fetch **regardless of credential state**; sandboxed
expression/template evaluation and NO arbitrary-code node; org-scoped Fernet-encrypted
credentials resolved server-side by reference; a dedicated cross-org credential-leak test.
Mandatory `/gsd:secure-phase` with `threats_open: 0`.

Both currently `Pending` in `.planning/REQUIREMENTS.md` (lines 122–123).

</requirements_context>

<decisions>
## Implementation Decisions

### A. Transport & substrate — how "MCP-first" becomes real code

- **D-01 — ⚠ ROADMAP AMENDMENT. The live slice ships as FIRST-PARTY ADAPTERS behind an
  MCP-SHAPED seam. No MCP client is built in 190.**

  ROADMAP SC#1 for this phase says *"(MCP-backed action nodes)"*. That parenthetical
  cannot be honoured **at the same time as** CONN-03 and red line D-14, and the reason is
  structural rather than a matter of effort:

  1. **A third-party MCP server makes the outbound call itself.** Our egress guard would
     then guard exactly one hop — the hop to the MCP server — and **not** the hop to
     Slack/Jira/the SMTP host. CONN-03 SC#2 says *"every connector outbound passes an
     unconditional SSRF / egress allow-list guard"*. Through a remote MCP server that
     sentence is unprovable, because the socket that matters is in someone else's process.
  2. **Credentials would live in the MCP server's config, not in our DB.** CONN-03 SC#4
     requires org-scoped, Fernet-encrypted, resolved-server-side-by-reference credentials.
     A remote MCP server holds its own token; we would satisfy the letter of SC#4 for a
     credential that is not the one doing the sending.
  3. **Running MCP servers locally is a second runtime**, which red line **D-14** forbids
     in as many words (*"action node, still no second runtime"*). stdio-subprocess MCP
     servers are exactly that: process supervision, lifecycle, sandboxing, a new failure
     class — inside a phase whose gate is `threats_open: 0`.

  **What ships instead:** one `ConnectorAdapter` protocol with **three** adapters, each of
  which we own the socket for. The protocol is deliberately **MCP-shaped** — a named
  capability, a JSON argument object, a structured result, a declared input schema — so
  that when the Open Platform milestone builds a real MCP client, adapters register
  through the same seam rather than beside it.

  **What is NOT amended:** `docs/CONNECTOR-ARCHITECTURE.md`'s verdict stands in full.
  *MCP-first* was and remains the substrate direction and the "be callable BY the tools
  users already run" bet; *first-party-thin* is exactly this three-capability slice; broad
  catalog still defers to Open Platform. **What moves is only the clause that said the
  first three connectors would ride an MCP client on day one.**

  **Required artefact:** `docs/CONNECTOR-ARCHITECTURE.md` gains a dated amendment section
  (never an in-place edit of the verdict — that doc's own rule), plus a superseding
  `D-v3.6-02` entry in `.planning/prd-reset/DECISIONS.md` pointing at it, and the ROADMAP
  Phase-190 SC#1 parenthetical is corrected with the superseded wording preserved. This
  mirrors verbatim how 189-16 corrected the migration-head bullet.

  **Its re-open trigger** (so this is a check, not a memory): the MCP client arrives with
  Open Platform (SEED-013/014). At that point each adapter either becomes an MCP client
  call behind the unchanged `ConnectorAdapter` protocol, or is retired. The observable is
  a phase number appearing on `.planning/ROADMAP.md` for SEED-013.

- **D-02 — Three adapters, three transports, all first-party:**

  | Capability | Adapter | Transport | Destination |
  |---|---|---|---|
  | `send_email` | SMTP | `smtplib` over **implicit TLS (SMTPS/465) or STARTTLS (587)** — never plaintext | org-configured host:port |
  | `create_ticket` | Jira Cloud REST v3 `POST /rest/api/3/issue` | `httpx` | org-configured `https://<site>.atlassian.net` |
  | `post_message` | Slack Web API `chat.postMessage` | `httpx` | **fixed code constant** `https://slack.com/api/` |

  Slack takes **no user-supplied URL at all** — the host is a module constant. That is the
  cheapest possible SSRF posture and it is taken deliberately: one of the three
  destinations is then unforgeable by construction, which gives the guard suite a real
  negative control.

- **D-03 — Static tokens, no OAuth authorization-code flow in 190.** Slack bot token
  (`xoxb-`), Jira API token + account email (basic auth), SMTP username/password. All
  three vendors support static credentials. OAuth adds a redirect URI, a callback route, a
  token-refresh scheduler and a consent surface — four net-new surfaces inside a phase
  gated on `threats_open: 0`. Deferred with a trigger (see `<deferred>`).

- **D-04 — No 4th capability, no capability registry extension point in 190.** The closed
  set of three is enforced in five places today (`EXTERNAL_ACTION_CAPABILITIES`, the
  backend `Literal`, two copy tables with a module-scope `assert`, and the client mirror
  fenced cross-language by a `?raw` read). 190 adds a **sixth** consumer — the adapter
  registry — and it must be keyed off the same frozenset with the same static `assert`,
  never a parallel list. *"Who may extend the capability set, and how"* is explicitly left
  open by `docs/CONNECTOR-ARCHITECTURE.md` and stays open.

### B. The egress guard (CONN-03 SC#2 — the n8n CVE class)

- **D-05 — ONE module owns every connector socket: `backend/app/security/egress.py`.**
  It sits beside `secret_cipher.py`, which is the shipped precedent for exactly this shape
  (*"no `Fernet(...)` is constructed anywhere else in the app"*). The guard's contract is
  the same sentence with the noun swapped: **no connector adapter constructs its own HTTP
  or SMTP client.** Enforced by a **source fence** — a test that walks
  `backend/app/services/connectors/**` for `httpx.`, `requests.`, `smtplib.`,
  `urllib.request`, `socket.` and requires **zero**, with a positive control. This is the
  same fence shape `tests/unit/test_189_no_egress.py` already uses, and it must be written
  **RED first** against a deliberately planted direct client.

- **D-06 — The guard runs BEFORE credential resolution, unconditionally.** This is the
  entire n8n CVE class (*"guarded only when a credential is attached"*) and it is the one
  ordering that must be asserted directly rather than inferred: a test drives a send with
  **no credential bound at all** and asserts the failure is the **egress refusal**, not a
  missing-credential error. If the credential error arrives first, the guard is
  bypassable the day someone reorders two lines.

- **D-07 — What the guard actually checks, in order:**
  1. **Scheme** — `https` only for HTTP adapters; SMTP requires TLS (implicit or STARTTLS).
     `http://` is refused with no exception, including for localhost.
  2. **Host allow-list** — per-capability, code-constant where possible (Slack), org-config
     -derived where not (Jira site, SMTP host), matched on the **registrable domain**,
     never a substring.
  3. **DNS resolution → IP validation** — every resolved address rejected if private
     (RFC1918), loopback, link-local (**including `169.254.169.254`, the cloud metadata
     endpoint**), CGNAT, multicast, reserved, or IPv6 equivalents (`::1`, `fc00::/7`,
     `fe80::/10`, and **IPv4-mapped forms of all of the above** — `::ffff:127.0.0.1` is the
     bypass people forget).
  4. **Redirects OFF** — `follow_redirects=False`. A 30x to `169.254.169.254` is the
     classic post-validation bypass, and the correct answer at this scope is not to follow
     redirects at all. Jira and Slack APIs do not require them.
  5. **Connect to the VALIDATED IP** — the DNS answer is pinned for the connection rather
     than re-resolved, closing the DNS-rebinding TOCTOU window between validation and
     connect. If pinning proves impractical for SMTP within the phase, that is recorded as
     a **named residual risk in SECURITY.md with its own trigger** — never silently
     dropped.
  6. **Timeouts + response-size cap** on every call.

- **D-08 — Refusals are auditable and never leak the credential.** An egress refusal logs
  the capability, the refused **host** and the reason — never the resolved secret, never
  the request body. This inherits the shipped secret-logging discipline (`secret_cipher`:
  *"column NAMES + counts only"*).

- **D-09 — No new expression language, and no per-field templating surface, in 190.**
  CONN-03 SC#3 (*"all expression / template evaluation is sandboxed"*) is satisfied by
  **not adding an evaluator**: `_exec_external_action` resolves its inputs today from the
  run's input bag plus the latest upstream phase text (`_external_action_inputs`), with
  `kickoff_prompt` excluded by name. 190 keeps exactly that resolution. Where a field must
  be composed, it reuses the **shipped** `SandboxedEnvironment(autoescape=True)` path
  (`template_render_service.py:657`, `tool_dispatcher.py:2473`) or nothing at all.
  **A new expression syntax on the business canvas is out of scope and out of character**
  — it is the same supply-chain-shaped affordance `docs/CONNECTOR-ARCHITECTURE.md` rules
  out *"ever"*. SC#3's proof is therefore largely a **fence over an existing property**,
  and the plan must say so rather than claiming to have built something.

### C. Credentials, org scoping, and the cross-tenant boundary

- **D-10 — A new org-scoped table, `connector_connections`, in migration 116.**
  Next free slot is **116** (`ls supabase/migrations/ | tail -1` → `115_…`, 109 files;
  head re-derived, not inherited — the ROADMAP bullet that claimed 113 was wrong in both
  halves and was corrected at 189-16).

  Shape (sized precisely at plan-phase):
  `id · org_id · created_by · capability · name · config jsonb (NON-secret: host, port,
  base_url, from_address, default_channel, project_key) · secret_ciphertext text ·
  is_enabled · created_at · updated_at`.

- **D-11 — The secret is `enc:v1:` through the SHIPPED cipher, with no new crypto.**
  `backend/app/security/secret_cipher.py` is the single home of key material and reuses
  `SECRETS_ENCRYPTION_KEY` (no new key — the ROADMAP flag says exactly this). ⚠ **One
  measured difference from the 13 existing secret columns:** those live in `app_settings`
  and are swept at boot by `main.py` via `SECRET_COLUMNS`. Connector secrets live in a
  **per-org, per-row table**, so they are encrypted **at write** and decrypted **at call
  time**, and they must **not** be added to `SECRET_COLUMNS` (that frozenset drives the
  `app_settings` boot sweep and would not fit). The plan must state which of
  `encrypt_value` / `decrypt_value` / `sweep_row` it reuses and which it does not.

  ⚠ **`get_cipher()` returns `None` when no key is configured — a deliberate fail-OPEN
  plaintext path (D-150-01).** That polarity is acceptable for a provider API key in
  `app_settings`; it is **not** acceptable for an org-scoped tenant credential.
  **190 refuses to store a connector secret when no cipher is available** — fail-CLOSED —
  and that inversion is a decision, stated here so it is not read as a bug later.

- **D-12 — RLS mirrors the shipped membership shape verbatim.** The mig-109 / mig-112
  predicate is the model:
  `org_id IN (SELECT public.current_user_org_ids()) AND (created_by = auth.uid() OR <shared>)`.
  Connections are **org-shared by default within the org** (a connection exists so
  colleagues' workflows can use it) — there is no per-user connector. There is no
  `is_system`/global escape: **a connector connection is never cross-org readable, and the
  absence of that branch is the decision**, since it is the exact branch SEED-125 had to
  close for skill files.

- **D-13 — The phase config stores a `connection_id` REFERENCE, additive-optional, ZERO
  migration.** `ExternalActionPhaseConfig` gains one optional field in the JSONB — the same
  additive-optional extension the 6th and 7th union members both used. **No secret, no
  host, no token ever enters the definition JSONB or the client**, which is CONN-03 SC#4
  read literally.

- **D-14 — ⭐ THE CROSS-ORG LEAK TEST IS THE HEADLINE SECURITY GATE, and the defect it
  hunts is NAMED IN ADVANCE:** a workflow definition belonging to org A carries a
  `connection_id` that belongs to org B. **The resolver must scope the lookup by the RUN's
  org — never by the id alone.** An `id`-only `SELECT` passes every ordinary test and
  leaks a tenant's credential to another tenant's workflow, and the milestone has this
  exact precedent twice (SEED-124 mig 110, SEED-125 mig 112). The test drives a real run
  and must be **observed RED** against an id-only resolver before the scoped one lands.

- **D-15 — Defence in depth: the resolver runs on the user-JWT client where it can.** The
  app's shipped `_call_as_user` / per-request-JWT-swap pattern (mig 110, Phase 164) means
  RLS is a *real* runtime gate rather than defence-in-depth-only for this table. Where the
  harness engine necessarily runs on the service-role/BYPASSRLS pool, the **application-code
  org filter is the real gate** and RLS is the backstop — and the plan must say which of
  the two applies at each call site rather than asserting "RLS covers it".

### D. The executor seam and run semantics

- **D-16 — ⚠ MANDATORY, AND IT IS THE ONE THAT BITES: gate the SEND on
  `ctx.is_golden_run` INSIDE the executor.** `D-189-DEF-04` is inert today and stops being
  inert on the exact commit this phase ships:

  > *"once Phase 190 wires a real send, PUBLISHING a workflow would PERFORM THE EXTERNAL
  > ACTION, with nobody asked, once per publish attempt."*

  Of the two shapes the branch comment in `harness_engine._run_phase_with_gates` names,
  **take the first**: the send is skipped, the record is not, so `_external_action_body`
  remains the single composer of that sentence and the golden run keeps exercising the real
  executor (which is what D-06 exists to prove). The alternative — a phase-type carve-out
  in the engine branch — fabricates a second vocabulary for one state.

  **The trigger is already armed:**
  `tests/test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress`
  **will go RED on the commit that adds the send** unless the carve-out lands in the same
  commit. That is the intended behaviour; the plan must **observe it RED and then green**,
  not route around it. (Note its recorded Windows trap: the loop must be built *before* the
  sentinel arms, because `asyncio.run`'s proactor self-pipe is itself a `socket.connect`.)

- **D-17 — Terminal statuses: ZERO new ones, and ZERO migration on `workflow_phases`.**

  | Outcome | Status | Word on the card |
  |---|---|---|
  | Bound + approved + sent | `completed` | the shipped complete reading |
  | Bound + approved + send FAILED | `failed` | the shipped failure reading |
  | **No connection bound** | `recorded_not_sent` | *"Not sent — recorded"* |
  | Approval declined | existing decline path | unchanged |

  `recorded_not_sent` is **not** retired by this phase — it becomes the honest terminal for
  an unbound step, which is exactly the state migration 115 was spent on. The
  `phase_recorded_not_sent` SSE (189 CR-02) keeps its meaning unchanged.

- **D-18 — At-MOST-once. No automatic retry in 190.** A retried send with no idempotency
  key double-sends an email, and a duplicate email is worse than a missing one on the
  surface whose entire discipline is not over-claiming. A failed send fails the phase and
  halts the run; the human re-runs deliberately. Idempotency keys are deferred with a
  trigger.

- **D-19 — The send happens AFTER the armed checkpoint, and the executor still owns no
  waiting.** 189's docblock records this explicitly (*"this executor runs AFTER approval
  and owns no waiting at all"*) and it stays true: 190 adds network I/O to the executor, not
  a second approval or a second wait.

### E. Migrations and the audit receipt

- **D-20 — ⚠ ROADMAP AMENDMENT (minor): TWO migrations, 116 and 117 — not "a migration
  likely".** The ROADMAP flag anticipated one (the credentials table). A second is
  **forced by a measured constraint**, not chosen:

  `harness_audit.harness_audit_event_type_check` caps `event_type` at **23 literals**
  (measured in `supabase/full-schema.sql:1124`; the column is `event_type`, **not** `kind`).
  Phase 189's **D-09** deferred the send receipt to 190 in as many words — *"where it would
  describe a real consequence"* — and a real consequence is precisely what 190 creates. So:

  - **116** — `connector_connections` (table + RLS + indexes + the `autofill_org_id` trigger
    the sibling tables carry).
  - **117** — one literal added to `harness_audit_event_type_check` for the send receipt
    (working name `external_action_sent`; the exact slug is locked at plan-phase against
    `test_audit_event_registration.py`, which 189 kept passing UNCHANGED and which this
    phase deliberately does move).

  Kept as **two** migrations rather than one because they answer to two different
  requirements and two different rollbacks. **Filenames must match `<digits>_name.sql`** —
  no letter suffixes (`116b` is silently skipped by the Supabase CLI).

- **D-21 — Apply discipline is unchanged and non-negotiable.** Author → operator applies by
  pasting into the Supabase SQL editor → `bash scripts/regenerate-full-schema.sh` (no
  `--reset`) → commit both. **Never `supabase db push` / `db reset`.** ⚠ 189-06 deviated
  (applied via `psycopg2`) and recorded the deviation; the ban itself held. This phase
  applies via the SQL editor, and if it cannot, it **records the deviation** rather than
  normalising it.

- **D-22 — ⚠ Cloud parity is OWED and grows here.** The standing queue is migrations
  **099 → 115** plus `SECRETS_ENCRYPTION_KEY`; this phase appends **116 and 117** plus any
  new env var. The `deploy-artifacts` same-commit rule (`scripts/check-deploy-drift.sh`)
  binds: any env var this phase reads must land in `deploy/onebox.env.example`,
  `docs/OPERATOR.md` Step-3 and `docker-compose.prod.yml` **in the same commit**, or be
  registered in `OMITTED_FROM_ONEBOX`.

### F. The author-facing surface

- **D-23 — The connection picker extends the EXISTING `ExternalActionSection.tsx`
  (189-14). `PhaseFormPanel.tsx` gains ZERO lines.** That file is on the hot-file ledger
  and its row records the rule *"the next surface that needs the panel gets its own
  component and one gated line"* — 189-14 already spent that one line (measured: 11
  insertions / 0 deletions, 3 of them JSX). **190's measured `git diff --numstat` on
  `PhaseFormPanel.tsx` must be `0 0`.**

- **D-24 — ⭐ The `Not connected` badge retires by DATA, in ONE LINE, and that line is
  already identified.** `phaseVocabulary.notConnectedOf` (`:811-814`) was deliberately
  written with the type test and the state test on **separate lines** so that 190 edits
  only the second:

  ```ts
  if (phase.config?.phase_type !== EXTERNAL_ACTION_PHASE_TYPE) return false
  return true                    // ← 190 replaces THIS line with the no-destination test
  ```

  **`PhaseNode.tsx`, `PhaseNodeCard.tsx` and the six fenced card-subtree modules must have
  an EMPTY diff.** If any of them is opened, D-12/D-18's design intent was not honoured and
  the plan is wrong, not the code. The badge's false branch is **unreachable today** — 190
  is the phase that makes it reachable, so the suite gains its first genuine
  bound-connection case.

- **D-25 — Connections are managed in Settings, not the Control Room.** Per the recorded
  settings↔control-room boundary: **operator sets the allowed-set and the lock; the user
  (here: an org admin) sets the preference.** Creating a connection is org-tenant
  configuration, so it lives in **Settings → Connections**. The operator's half is D-26.

- **D-26 — One operator kill-switch, reusing the SHIPPED `/admin/flags` allowlist.**
  A code-constant flag (working name `live_connectors`) joins `admin.py`'s kill-switch
  allowlist — the exact one-allowlist-entry / zero-new-endpoint path Phase 181 used for
  `visual_workflow_canvas`. **Off by default.** With it off, an `external_action` step
  behaves precisely as it does today: records, does not send, reads *"Not sent —
  recorded"*. That is a genuine, already-tested state, which is what makes this off-switch
  cheap and honest rather than a second code path.

- **D-27 — ⚠ G-2 FIRES and is HONOURED, not skipped.** This phase's scope names a live UI
  surface (a Settings → Connections page and a picker), so CLAUDE.md's G-2 requires
  `/gsd:sketch` **before** planning. The guardrail is recorded here and the recommended
  next command is `/gsd:sketch 190` (see "Next step"). **Two mitigations keep the sketch
  small:** the picker reuses `ExternalActionSection`'s shipped shape, and the Settings page
  has close analogs already sketched — the Phase 111.1 provider picker with its always-on
  🔒 endpoint footer, and the Phase 146–148 graded action-guards vocabulary. The sketch
  should be scoped to **the Settings → Connections page only**, capped at ~3 on-screen
  actions per the shipped sketch rule.

### G. Verification, UAT and the security gate

- **D-28 — `/gsd:secure-phase` with `threats_open: 0` is MANDATORY** (ROADMAP flag). The
  threat model is authored in PLAN.md, not retrofitted. Minimum threat list, each needing a
  mitigation that is a **test**, not a sentence: SSRF via org-configured host · DNS
  rebinding / TOCTOU · redirect-based bypass · cloud metadata endpoint · credential leak in
  logs · credential leak in the definition JSONB · credential leak in an SSE/API response ·
  **cross-org credential resolution (D-14)** · SSTI via any composed field · publish-time
  egress (D-16) · unbounded response / decompression · SMTP header injection via a
  user-controlled subject or recipient (a `\r\n` in a subject is a real, cheap attack on
  the email adapter specifically).

  ⚠ **The 185 lesson binds here:** *a deny-list cannot be made fail-closed by extension* —
  verify the **property** (nothing reaches a non-public IP), not the **patch** (this
  particular CIDR is blocked), and **observe every falsification RED first.**

- **D-29 — SC#10 applies: the FULL native roster + OpenRouter — 8 rows, derived from
  `MODEL_CAPABILITIES`, never re-typed.** A connector step is not an LLM step, so what the
  rows exercise is a **published workflow containing an `external_action` step, run
  end-to-end per provider**. ⚠ **Do NOT inherit the Phase-185 method here:** that method
  relies on a per-request `model` + `provider` on `POST /threads/{id}/messages`, and Phase
  187 measured that `/generate` accepts no per-request model. **Whether the workflow-run
  endpoint accepts per-request routing must be MEASURED at plan-phase**; if it does not,
  the rows run serially and that cost is stated in VALIDATION.md, not discovered mid-UAT.
  **Rows may be ⛔ with a named reason; they may never be silently omitted.**

- **D-30 — UAT rows live in VALIDATION.md, and the live-send rows need a real destination.**
  The operator must supply (or approve the creation of) one throwaway destination per
  capability — a mailbox, a Jira project, a Slack channel. **This is a blocking dependency
  on the operator and it is named now rather than discovered at UAT.** Until then the rows
  are ⛔ *awaiting operator-provided destination*, and the phase may legitimately close with
  them owed — **stated as a DECISION, never as a claim that everything ran.**

- **D-31 — G-6: how we would know this failed.** Concrete, observable:
  - A send happens with **no** approval, or during a **publish** (D-16 not taken).
  - A phase reads *"Complete"* for a send that did not leave the app.
  - A credential appears in `workflow_definitions.definition`, an SSE frame, an API
    response, or a log line.
  - Org B's workflow successfully sends using org A's connection (D-14).
  - A request reaches `169.254.169.254`, `127.0.0.1`, or any RFC1918 address.
  - The guard passes because a credential was absent (the n8n inversion, D-06).
  - A `PhaseFormPanel.tsx` / `PhaseNodeCard.tsx` diff is non-empty (D-23 / D-24).
  - One email arrives twice from one run (D-18).

### H. Scope fence

- **D-32 — Explicitly NOT built in 190**, restated so a gap-closure round cannot smuggle
  any of it in (G-7): broad connector catalog · inbound webhooks · public REST API · MCP
  client · service accounts · OAuth authorization-code flow · a 4th capability · retries /
  idempotency keys / a send queue · scheduling or automations · contact/recipient directory
  resolution · any expression language or arbitrary-code node on the canvas · the run-surface
  approval affordance (BUG-260808-02, see `<deferred>`).

### Claude's Discretion

The operator delegated the whole session. Beyond the decisions above, the following are
explicitly left to research and planning: the precise `connector_connections` column list
and index set; whether `httpx`'s transport hook or an explicit resolve-then-connect
wrapper implements D-07 step 5; the Jira REST payload shape (ADF vs plain text
description); the exact Settings → Connections route and its place in the nav; the wording
of the egress refusal shown to an author; and the plan/wave decomposition.

**Two things are NOT discretionary and must not be re-litigated downstream:** D-16 (the
golden-run send gate) and D-14 (the cross-org leak test), because both are latent defects
that this phase's own commit creates.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The connector decision (read FIRST — D-01 amends it)
- `docs/CONNECTOR-ARCHITECTURE.md` — the MCP-first / first-party-thin / Open-Platform-sequenced verdict, what it does NOT decide (§"What it does NOT decide" is literally 190's scope), and the dated re-open trigger. **D-01 above amends one clause of it; the amendment is authored INTO this file, never as an in-place edit of the verdict.**
- `.planning/prd-reset/DECISIONS.md` — the `D-v3.6-01` pointer entry; D-01 adds a superseding `D-v3.6-02`.
- `.planning/seeds/SEED-013-external-integrations-api-mcp.md` — the three consumer modes + Open Platform sequencing that breadth defers to.
- `.planning/seeds/SEED-014-automations-routines.md` — the automations sibling; binding on shape ("automations are a runtime mode for skills, not a separate primitive").
- `.planning/research/deep-dive/N8N.md` — the CVE class CONN-03 is written against.

### Phase 189 — the seam this phase completes
- `.planning/phases/189-governed-external-action-node-model/189-CONTEXT.md` — D-01…D-26, the decisions 190 inherits.
- `.planning/phases/189-governed-external-action-node-model/deferred-items.md` — **`D-189-DEF-04` is OWNED BY 190 and is mandatory (D-16).** `D-189-DEF-03` is CLOSED (CR-02 shipped the SSE); do not re-open it.
- `.planning/phases/189-governed-external-action-node-model/189-UI-SPEC.md` — §9d the NOT-SENT body's binding phrasing rules; §7b the capability picker.
- `.planning/phases/189-governed-external-action-node-model/189-SECURITY.md` — 52/52 closed, 0 open; the baseline 190's threat model extends.
- `.planning/phases/189-governed-external-action-node-model/189-VALIDATION.md` — the UAT coverage map and the driven-live-session rows.

### Backend seams (read before writing any code)
- `backend/app/services/harness/phase_types.py:1667-1903` — `_exec_external_action`, the copy tables, `RECORDED_INTENT_KEY`, `_external_action_inputs` (WR-02's named exclusion), `PHASE_TYPE_REGISTRY_ENTRIES`. **The ONE function 190 replaces.**
- `backend/app/services/harness_engine.py:805-835` — the golden-run branch comment naming D-16's two shapes.
- `backend/app/services/harness_engine.py:1731-1885` — the `recorded_intent` branch, `record_phase_not_sent`, the `phase_transition` ledger write, the `phase_recorded_not_sent` SSE.
- `backend/app/services/harness/grounding.py:947-970` — `EXTERNAL_ACTION_CAPABILITIES` + its `KB_TOOLS` disjointness assert (the closed set every new consumer must key off).
- `backend/app/models/harness.py:172-260` — `ExternalActionPhaseConfig`, the `capability` `Literal`, D-03's derived `available_tools`. **D-13 adds one optional field here.**
- `backend/app/security/secret_cipher.py` — the `enc:v1:` envelope, `MultiFernet` rotation, `SECRET_COLUMNS`, and the fail-open-when-unkeyed polarity D-11 deliberately inverts.
- `backend/app/api/admin.py:62-111` — the code-constant kill-switch allowlist D-26 reuses (Phase 181's `visual_workflow_canvas` precedent).
- `backend/app/services/template_render_service.py:639-668` and `backend/app/services/tool_dispatcher.py:2469-2473` — the shipped `SandboxedEnvironment(autoescape=True)` SSTI containment CONN-03 SC#3 is proved against.

### Frontend seams
- `frontend/src/components/workflows/phaseVocabulary.ts:788-814` — `notConnectedOf`, **the one line D-24 edits**; `:497-531` `EXTERNAL_CAPABILITY_SENTENCES` (one constant, read twice — never copied).
- `frontend/src/components/workflows/ExternalActionSection.tsx` — the section D-23 extends (its six contract properties are each separately guarded; keep all six).
- `frontend/src/components/workflows/PhaseNode.tsx:211-270` — the `BadgeSlots` tuple, explicit branches, **no spread** (a spread retires the max-2 typecheck guard).
- `frontend/src/components/workflows/canvasModel.ts:145-175, 303-360` — where `notConnected` is resolved once and passed as data.

### Database
- `supabase/migrations/115_workflow_phases_recorded_not_sent.sql` — the live head; **116 is the next free slot** (re-derive with `ls supabase/migrations/ | tail -1`, do not trust this line).
- `supabase/migrations/112_skill_files_storage_org_scope.sql` + `109` — the membership-RLS predicate D-12 mirrors, and the SEED-125 cross-org leak this phase's D-14 test is modelled on.
- `supabase/migrations/114_harness_audit_action_risk_pending.sql` — the precedent for D-20's `event_type` CHECK amendment.
- `supabase/full-schema.sql:1124` — the measured 23-literal `harness_audit_event_type_check`.
- `supabase/SETUP.md` — apply discipline (D-21).

### Tests that will bite
- `backend/tests/unit/test_189_no_egress.py` — the transport sentinel (httpx sync+async, `smtplib.SMTP`, `urllib.request.urlopen`, raw `socket.socket.connect`). **190 must re-scope it deliberately rather than delete it — it is imported by the golden-run fence.**
- `backend/tests/test_harness_engine.py::test_a_golden_run_of_an_external_action_performs_no_egress` — **goes RED on the commit that adds a real send.** That is D-16's trigger; drive it RED then green.
- `backend/tests/unit/test_189_external_action_model.py` · `backend/tests/unit/test_publish_service.py` (V20) · `backend/tests/unit/test_audit_event_registration.py` (moves for the first time in D-20).

### Project rules
- `CLAUDE.md` — G-2 (D-27), G-5 hot-file ledger (D-23/D-24), G-7 round cap, the UAT scoreboard recipe + the 8-row roster rule (D-29), deployment-artifact parity (D-22), migration apply discipline (D-21).
- `.claude/skills/sketch-findings-agentic-rag/` — load via `Skill("sketch-findings-agentic-rag")` before ANY canvas/panel/Settings work; `references/icon-convention.md` §4 is the canvas glyph vocabulary; `references/approval-and-review.md` §146-A is the decision BUG-260808-02 measures against.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`_exec_external_action`** — a single async function returning `{text, recorded_intent}`. 189 designed it as "ONE function to replace". 190 replaces it and must keep both keys: `text` is what `_latest_phase_text` scans for, `recorded_intent` is what the engine branches on.
- **`secret_cipher.py`** — `enc:v1:` envelope, `MultiFernet` rotation, prefix-based classification (never blind decrypt). Reuse wholesale; add no crypto.
- **`/admin/flags` code-constant allowlist** — a kill-switch costs one allowlist entry and zero new endpoint code (Phase 181 precedent).
- **`SandboxedEnvironment(autoescape=True)`** — already the only Jinja path; CONN-03 SC#3 is a fence over it.
- **`current_user_org_ids()` + `autofill_org_id_by_owner` trigger** — the shipped org-scoping primitives; every sibling workflow table carries the trigger.
- **`ExternalActionSection.tsx`** — 185 lines, six separately-guarded contract properties, already mounted. The connection picker belongs inside it.
- **The `?raw` cross-language fence idiom** (`PublishGauntlet.test.tsx:46`) — how a client mirror is proved equal to a Python `Literal`. If 190 adds any client-side connector enum, it needs one.

### Established Patterns
- **One module owns one dangerous thing** (`secret_cipher`: no `Fernet` elsewhere). `egress.py` inherits the pattern *and* its source fence.
- **Closed sets with a static `assert`**, never parallel lists (`EXTERNAL_ACTION_CAPABILITIES` ↔ the two copy tables).
- **Allowlist-before-touch** — validate against a code constant before any DB or network operation (`admin.py` throughout).
- **Additive-optional JSONB config fields** — the 6th and 7th `PhaseConfig` union members both arrived this way; `_StrictBase` (`extra='forbid'`) still validates old rows because an old row never names the new field.
- **Counts are DERIVED, never re-pinned** (189-10/12/13's repeated lesson). Any new count assertion derives from the frozenset's length.
- **RED first, always** — every fence in 189 was observed failing against a planted wrong fix before it was trusted. The plants must go into **production source**, then be restored md5-identical with `grep -c PLANT` → 0.

### Integration Points
1. `phase_types._exec_external_action` → `connectors/registry` → `ConnectorAdapter` → `security/egress` → the wire.
2. `connectors/*` → `connector_service.resolve(connection_id, org_id)` → `connector_connections` (org-scoped) → `secret_cipher.decrypt`.
3. `harness_engine._run_phase_with_gates` → the golden-run flag reaching the executor (D-16).
4. `harness_engine` → `harness_audit` (`external_action_sent`, migration 117).
5. `ExternalActionSection` → `GET /connectors/connections?capability=…` → the picker → `connection_id` in the definition JSONB.
6. `notConnectedOf` → `canvasModel.buildPhaseData` → `PhaseNode` badge (data only; the card is untouched).

### ⚠ Measured facts that contradict planning prose elsewhere — re-derive, do not inherit
- Migration head is **115**, next free **116**. The ROADMAP bullet claiming 113/114 was FALSE in both halves and was corrected at 189-16. **Re-derive at plan-phase.**
- The `harness_audit` column is **`event_type`**, not `kind`, and its CHECK holds **23** literals (`full-schema.sql:1124`).
- **Zero MCP code exists in `backend/app`** (`grep -rni "\bmcp\b" backend/app --include=*.py` → 0). "MCP-backed" was always a direction, never infrastructure — this is what makes D-01 an honest amendment rather than a retreat.
- `phaseVocabulary.ts` has **ZERO imports** — asserted mechanically at 189-13. A connection-aware `notConnectedOf` must not break that if the assertion still stands; **re-run it before assuming.**
- `PHASE_GLYPHS` lives in `soulData.ts:43`, **not** `phaseVocabulary.ts` — a CONTEXT pointer that was wrong for two phases because nothing typechecks prose.
- Six consecutive Phase-189 plans inherited a **stale count-gate baseline**. Re-measure the gate before quoting it.
- `tsc --noEmit` checks ZERO files here — use `-p tsconfig.app.json` (baseline **33** at 189 close; re-measure).

</code_context>

<specifics>
## Specific Ideas

- **Slack's host is a code constant, on purpose.** Making one of the three destinations
  unforgeable by construction gives the guard suite a real negative control and reduces the
  attack surface by a third for free.
- **The `Not connected` badge is the whole phase in one word.** 189 spent the canvas's last
  free badge slot on it and wrote `notConnectedOf` across two lines specifically so 190
  could retire it by data. **If 190 opens `PhaseNodeCard.tsx`, something went wrong** — the
  188.2 extraction and 189-15's slot spend both exist to make that diff empty.
- **The demo sentence to aim at:** *"a published workflow paused for approval, the operator
  approved, and an email actually arrived — and the same workflow, with the connection
  unbound, still says 'Not sent — recorded' rather than pretending."* Both halves are the
  proof; the second half is the one competitors do not have.
- **The failure this phase is most likely to ship** is not a missing feature — it is a send
  that happens without an approval (D-16) or a credential that crosses an org boundary
  (D-14). Both are latent defects that this phase's own commit creates, and both already
  have a named test. Plan them into **Wave 0**, RED, before any adapter exists.

</specifics>

<deferred>
## Deferred Ideas

Every entry carries a concrete re-open trigger, per the standing project rule.

- **MCP client (consume) + MCP server (be consumed)** — D-01. **Trigger:** SEED-013 /
  SEED-014 receiving a phase number on `.planning/ROADMAP.md`. Adapters then move behind the
  unchanged `ConnectorAdapter` protocol.
- **OAuth authorization-code flow for Slack/Jira** — D-03. **Trigger:** a named operator or
  customer who cannot use a static token (vendor policy, or a per-user-identity send
  requirement), OR the first connector whose vendor offers no static credential.
- **Idempotency keys + retry/queue for sends** — D-18. **Trigger:** the first observed
  transient failure on a real send whose manual re-run is judged unacceptable, or the first
  connector with a documented at-least-once delivery expectation.
- **A 4th+ capability and a public extension point** — D-04; also the open question
  `docs/CONNECTOR-ARCHITECTURE.md` names (*"who may extend the capability set, and how"*).
  **Trigger:** a named request for an integration outside the thin three — which is also
  re-open trigger #2 of the connector verdict itself.
- **Broad catalog, inbound webhooks, public REST API, service accounts** — the Open Platform
  milestone (SEED-013/014). **Trigger:** already dated in `docs/CONNECTOR-ARCHITECTURE.md`.
- **Per-field mapping UI / expression surface for connector inputs** — D-09. **Trigger:** an
  observed workflow that cannot express its send because upstream-text + run-inputs
  resolution is insufficient. It must arrive through the SANDBOXED path or not at all.
- **Contact / recipient directory resolution** ("send to the account owner") — no trigger
  fired; belongs with a CRM-shaped phase.

### Reported bugs — routing (CLAUDE.md MANDATORY cross-check, `surface: Agentic-RAG`, `status: open`)

- **BUG-260808-02 — the approval pause hands the user off to chat.** ⚠ **Highest-overlap
  open report, and 190 RAISES ITS STAKES**: every `external_action` step is structurally
  armed, so after this phase the approval a user must leave the run surface to give is the
  one that **actually sends**. **ROUTING: DEFER, not fold.** Three reasons: (1) the report
  itself says *"this is a new capability"* and the operator said *"do not fold this into
  this phase, just take note"*; (2) folding a run-surface IA rebuild into a phase gated on
  `threats_open: 0` is exactly the capability-smuggling G-7 names; (3) the report's own
  suggested routing is that it pairs with **SEED-139** (run threads indistinguishable in the
  chat list) and **SEED-140** (no stop control on the run surface) as **one coherent
  workflow-surface phase** — *"doing them separately means touching the run surface three
  times."* **Re-open trigger:** the next workflow-surface phase, or v3.7 milestone kickoff,
  whichever comes first — and it should be raised as a **candidate REQ-ID at that kickoff**,
  not left to be rediscovered. Frontmatter updated: `status: open`, `re_open_trigger` set.
- **BUG-260807-01** (canvas vertical-offset prototype-key NaN transform) and
  **BUG-260808-01** (node position lookup prototype slug) — both open, both the **WR-04
  prototype-pollution class**, both `security/…` tagged. **Not 190's domain** (canvas edit
  affordances / canvas model, no connector surface) → **left open**. ⚠ **But they are
  security-tagged and `/gsd:secure-phase 190` will be looking at this tree**, so they should
  be swept by **`/gsd:fast` BEFORE 190 executes** — memory already records `/gsd:fast
  (BUG-260807-01)` as the pending next action. Doing so keeps 190's SECURITY.md from
  inheriting findings it did not cause.
- **BUG-260730-02** (emit gate reports citations when citations were perfect) and
  **BUG-260731-01** (judge-model knob may be inert env singleton) — open, harness /
  publish-gauntlet. 190 touches the publish path only via D-16's golden-run gate; neither
  report's `affected_areas` overlaps connectors. **Left open.**
- **BUG-260718-02 / -03 / -04, BUG-260722-02, BUG-260609-02** — chat-surface / streaming /
  model-selection. No overlap with this phase's domain. **Left open.**
- **BUG-260714-02** — `surface: OpenRouter`. Per the filter rule, external surfaces are never
  auto-folded. **Noted only.**

### Reviewed Todos (not folded)

- **`spike-nl-workflow-authoring.md`** (matched at score 0.6 on the keywords *template / run /
  first*) — **not folded.** It is the NL→workflow authoring spike, whose subject shipped as
  **Phase 187** (AI-seeded canvas). The match is keyword-driven and semantically unrelated to
  connectors. Folding it would be scope creep in the strict sense: a different capability.

</deferred>

---

## Next step

⚠ **G-2 fires** (D-27): this phase's scope includes a live UI surface, so the guardrail
recommends a sketch before planning. It is surfaced rather than silently skipped, and it is
scoped as narrowly as honesty allows.

**Recommended:**

```
/gsd:sketch 190          # Settings → Connections page ONLY (~3 on-screen actions);
                         # the picker reuses ExternalActionSection's shipped shape
```

then

```
/gsd:plan-phase 190
```

**If the operator prefers to skip the sketch**, say so and plan directly — the override is
legitimate (the UI is genuinely small and has two close shipped analogs: the Phase 111.1
provider picker with its 🔒 endpoint footer, and the 146–148 action-guard vocabulary). It
must then be recorded under `STATE.md → Guardrail overrides`, per the orchestrator protocol.

**Blocking dependency to resolve before UAT** (D-30): the operator must provide a throwaway
mailbox, Jira project and Slack channel. Planning and implementation do not need them;
**closing the phase does.**

---

*Phase: 190-live-connector-slice-connector-security-stretch*
*Context gathered: 2026-08-08*
